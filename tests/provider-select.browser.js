/* v107.1 — TWO CHAT APIS, CHOSEN PER AGENT.
   Every LLM call in the app went to OpenRouter, with its key, its provider-routing block, its
   `reasoning` object and its Gemini safety passthrough hardcoded at the fetch. NanoGPT serves the
   same OpenAI chat-completions shape at a different host — so the body is portable but those four
   OpenRouter-only pieces are not, and an unknown field is a 400 on a strict gateway (a 400 that
   reads to the player as the model refusing, mid-scene).
   These pin: that each agent's own fnCfg bucket chooses its API, that an untouched agent still
   produces exactly the OpenRouter request it always did, that the non-OpenRouter body is stripped
   to the portable shape, and that a picker aimed at a provider with no key says so.
   Run: node tests/provider-select.browser.js */
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage({viewport:{width:412,height:915}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  const reqs=[];
  await pg.route('**/chat/completions',r=>{
    const q=r.request();
    reqs.push({url:q.url(),auth:q.headers()['authorization']||'',ref:q.headers()['http-referer']||null,
      body:JSON.parse(q.postData()||'{}')});
    r.fulfill({status:200,contentType:'application/json',
      body:JSON.stringify({choices:[{message:{content:"OK"},finish_reason:"stop"}]})});
  });
  await pg.goto('file:///home/user/Multirp/index.html'); await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(900);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x||c).slice(0,600));} };

  const fire=()=>pg.evaluate(async()=>{
    state.key="or-key"; state.nanoKey="nano-key"; state.provDeny="Alibaba";
    state.fnCfg=state.fnCfg||{};
    state.fnCfg.mem={prov:"nano",reason:true,effort:"high"};
    state.fnCfg.gm={reason:false};                 // untouched provider → OpenRouter
    state.fnCfg.rp={prov:"nano"};
    await chatCompletion([{role:"user",content:"x"}],"some/model",{fn:"mem",max:300,dbg:"A"});
    await chatCompletion([{role:"user",content:"x"}],"google/gemini-pro",{fn:"gm",max:300,dbg:"B"});
    await chatCompletion([{role:"user",content:"x"}],"m",{rp:true,max:300,dbg:"C"});
  });
  await fire();
  const [A,B,C]=reqs;

  console.log("\n[the bucket that owns the agent owns its API]");
  ok("an agent set to NanoGPT is called at NanoGPT, with the NanoGPT key",
     !!A && A.url==="https://nano-gpt.com/api/v1/chat/completions" && A.auth==="Bearer nano-key",
     A&&(A.url+" / "+A.auth));
  ok("an agent left alone still goes to OpenRouter with the OpenRouter key",
     !!B && B.url==="https://openrouter.ai/api/v1/chat/completions" && B.auth==="Bearer or-key",
     B&&(B.url+" / "+B.auth));
  ok("a roleplay reply reads the Roleplay card's own picker, not a bucket name",
     !!C && C.url==="https://nano-gpt.com/api/v1/chat/completions", C&&C.url);

  console.log("\n[the OpenRouter request is exactly what it always was]");
  ok("its reasoning object is still the object", !!B && JSON.stringify(B.body.reasoning)==='{"enabled":false,"exclude":true}',
     B&&JSON.stringify(B.body.reasoning));
  ok("its provider deny-list still rides along", !!B && JSON.stringify(B.body.provider)==='{"ignore":["Alibaba"],"allow_fallbacks":true}',
     B&&JSON.stringify(B.body.provider));
  ok("the Gemini safety passthrough still attaches", !!B && Array.isArray(B.body.safety_settings) && B.body.safety_settings.length===4,
     B&&JSON.stringify(B.body.safety_settings));
  ok("and it still identifies itself to OpenRouter", !!B && B.ref==="https://storymind.app", B&&B.ref);

  console.log("\n[and the other request carries none of it]");
  ok("no reasoning object — that shape is OpenRouter's", !!A && A.body.reasoning===undefined,
     A&&JSON.stringify(A.body.reasoning));
  ok("thinking arrives as the portable reasoning_effort instead", !!A && A.body.reasoning_effort==="high",
     A&&JSON.stringify(A.body.reasoning_effort));
  ok("no provider-routing block", !!A && A.body.provider===undefined, A&&JSON.stringify(A.body.provider));
  ok("no Gemini safety block", !!A && A.body.safety_settings===undefined);
  ok("and no OpenRouter attribution headers", !!A && A.ref===null, A&&A.ref);
  ok("thinking OFF elsewhere sends nothing rather than an invented field",
     !!C && C.body.reasoning===undefined && C.body.reasoning_effort===undefined,
     C&&JSON.stringify({r:C.body.reasoning,e:C.body.reasoning_effort}));
  ok("but the thinking headroom is still granted, wherever it runs",
     !!A && A.body.max_tokens>=6000, A&&A.body.max_tokens);

  console.log("\n[a key is checked against the API actually being called]");
  ok("an agent aimed at a provider with no key fails by name, not as a 401", await pg.evaluate(async()=>{
      state.nanoKey=""; state.fnCfg.mem={prov:"nano"};
      try{ await chatCompletion([{role:"user",content:"x"}],"m",{fn:"mem",max:5,dbg:"D"}); return "it did not refuse"; }
      catch(e){ return /No NanoGPT API key set/.test(String(e&&e.friendly)) ? true : String(e&&e.friendly); }
      finally{ state.nanoKey="nano-key"; }}));
  ok("and the credit/auth messages name that provider too", await pg.evaluate(()=>{
      const n=httpMsg(402,{label:"NanoGPT",funds:"Top up your balance at nano-gpt.com."});
      const o=httpMsg(402,{label:"OpenRouter",funds:"Add funds at openrouter.ai."});
      return /Out of NanoGPT credit/.test(n) && /nano-gpt\.com/.test(n)
          && /Out of OpenRouter credit/.test(o) && /openrouter\.ai/.test(o)
        ? true : n+" || "+o; }));
  ok("an unknown provider id falls back to OpenRouter rather than breaking the turn", await pg.evaluate(()=>{
      state.fnCfg.bio={prov:"not-a-provider"};
      const r=provFor("bio").id==="or";
      delete state.fnCfg.bio; return r; }));

  console.log("\n[every agent card carries the picker]");
  ok("all ten of them, the roleplay card included", await pg.evaluate(()=>{
      if(typeof renderFnOverrides==='function')renderFnOverrides();
      const got=[...document.querySelectorAll('[data-ovr][data-kind="prov"]')].map(h=>h.getAttribute('data-ovr'));
      const want=["rp","narrate","rewriter","mc","mem","gm","bio","unigen","router","call"];
      const missing=want.filter(w=>!got.includes(w));
      return missing.length?("missing a picker: "+missing.join(", ")):true; }));
  ok("the options are built from PROVIDERS, so a new one needs no card edits", await pg.evaluate(()=>{
      const sel=document.querySelector('[data-ovr][data-kind="prov"] select[data-prov]');
      const got=[...sel.options].map(o=>o.value).sort().join(",");
      const want=Object.keys(PROVIDERS).sort().join(",");
      return got===want?true:got+" vs "+want; }));
  ok("picking OpenRouter stores nothing, so an untouched install stays untouched", await pg.evaluate(()=>{
      const host=[...document.querySelectorAll('[data-ovr][data-kind="prov"]')].find(h=>h.getAttribute('data-ovr')==='router');
      const sel=host.querySelector('[data-prov]');
      sel.value='nano'; sel.dispatchEvent(new Event('change'));
      const a=(state.fnCfg.router||{}).prov;
      sel.value='or'; sel.dispatchEvent(new Event('change'));
      const b=(state.fnCfg.router||{}).prov;
      return (a==="nano" && (b===null||b===undefined)) ? true : JSON.stringify({a,b}); }));
  ok("a picker aimed at a keyless provider warns on the card", await pg.evaluate(()=>{
      state.nanoKey="";
      const host=[...document.querySelectorAll('[data-ovr][data-kind="prov"]')].find(h=>h.getAttribute('data-ovr')==='mc');
      const sel=host.querySelector('[data-prov]'), w=host.querySelector('[data-provwarn]');
      sel.value='nano'; sel.dispatchEvent(new Event('change'));
      const shown=w.style.display!=='none' && /No NanoGPT key set/.test(w.textContent);
      state.nanoKey="k"; sel.dispatchEvent(new Event('change'));
      const cleared=w.style.display==='none';
      return (shown&&cleared)?true:JSON.stringify({shown,cleared,txt:w.textContent}); }));

  console.log("\n[the key itself]");
  ok("there is a field for it", await pg.evaluate(()=>!!document.getElementById('setNanoKey')));
  ok("and a test button beside OpenRouter's", await pg.evaluate(()=>
      !!document.getElementById('testNanoBtn') && typeof testNanoConnection==='function' ));
  ok("it survives a save and a reload of the form", await pg.evaluate(()=>{
      document.getElementById('setNanoKey').value="  round-trip-key  ";
      saveSettings(false);
      const stored=localStorage.getItem(K.nanoKey);
      state.nanoKey=store.raw(K.nanoKey,"");      // as a fresh boot would read it
      syncSettingsUI();
      const back=document.getElementById('setNanoKey').value;
      return (stored==="round-trip-key" && state.nanoKey==="round-trip-key" && back==="round-trip-key")
        ? true : JSON.stringify({stored,state:state.nanoKey,field:back}); }));

  console.log("\n[the live call resolves the same bucket, on its own]");
  ok("it no longer hardcodes an OpenRouter URL", (()=>{
      const src=require('fs').readFileSync('/home/user/Multirp/index.html','utf8');
      return !/VC_OR_URL/.test(src) ? true : "VC_OR_URL is still referenced"; })());
  ok("it builds its endpoint from the call bucket's provider", (()=>{
      const src=require('fs').readFileSync('/home/user/Multirp/index.html','utf8');
      return /_capi=provFor\("call"\)/.test(src) && /_capi\.base\+"\/chat\/completions"/.test(src)
        ? true : "the call still does not resolve a provider"; })());
  ok("and only sends latency routing where that means something", (()=>{
      const src=require('fs').readFileSync('/home/user/Multirp/index.html','utf8');
      return /if\(_cOR\)\{ reqBody\.reasoning=vcReasoning\(\); reqBody\.provider=\{sort:"latency"\}; \}/.test(src)
        ? true : "latency routing is unconditional again"; })());

  ok("no page errors", errs.length===0?true:errs.join(" | "));
  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close(); process.exit(fail?1:0);
})();
