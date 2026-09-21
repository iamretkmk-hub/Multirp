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
  let nanoCatFails=false;
  await pg.route('**/api/v1/models*',r=>{
    const u=r.request().url(), nano=/nano-gpt/.test(u);
    if(nano&&nanoCatFails){ r.fulfill({status:500,body:"boom"}); return; }
    r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:
      nano?[{id:"chatgpt-4o-latest"},{id:"shared/model"}]
          :[{id:"anthropic/claude-3.5-sonnet"},{id:"shared/model"}]})});
  });
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

  /* v108.1 — the model fields are free text and every agent now picks its own API, so a datalist
     that only knew OpenRouter meant a NanoGPT agent had to be typed from memory. */
  console.log("\n[the datalist carries both catalogues]");
  const cat=()=>pg.evaluate(()=>[...document.querySelectorAll('#modelList option')]
      .map(o=>({id:o.value,tag:o.textContent})));
  const reload=(cfg)=>pg.evaluate(async o=>{
      state.nanoKey=o.key; state.fnCfg=o.fn;
      localStorage.removeItem("sm_modelcache"); localStorage.removeItem("sm_modelcache_nano");
      await loadModels(true); },cfg);

  await reload({key:"",fn:{}});
  ok("an install that never touched the picker sees only OpenRouter, as before", await (async()=>{
      const c=await cat();
      return c.every(o=>o.tag==="OpenRouter") && c.some(o=>o.id==="anthropic/claude-3.5-sonnet")
        && !c.some(o=>o.id==="chatgpt-4o-latest")
        ? true : JSON.stringify(c); })());

  await reload({key:"nano-key",fn:{}});
  ok("setting the key pulls NanoGPT's catalogue in", await (async()=>{
      const c=await cat();
      return c.some(o=>o.id==="chatgpt-4o-latest") ? true : JSON.stringify(c); })());
  ok("each entry is tagged with the service that serves it", await (async()=>{
      const c=await cat(), f=id=>(c.find(o=>o.id===id)||{}).tag;
      return f("anthropic/claude-3.5-sonnet")==="OpenRouter" && f("chatgpt-4o-latest")==="NanoGPT"
        ? true : JSON.stringify(c); })());
  ok("a model both of them serve is listed once, tagged with both", await (async()=>{
      const c=await cat(), rows=c.filter(o=>o.id==="shared/model");
      return rows.length===1 && rows[0].tag==="OpenRouter · NanoGPT" ? true : JSON.stringify(rows); })());
  ok("the id stays the option's value — the tag is only a hint", await (async()=>{
      const c=await cat();
      return c.every(o=>o.id && !/·|OpenRouter|NanoGPT/.test(o.id)) ? true : JSON.stringify(c.slice(0,3)); })());

  await reload({key:"",fn:{mem:{prov:"nano"}}});
  ok("an agent already pointed there is reason enough, with no key yet", await (async()=>{
      const c=await cat();
      return c.some(o=>o.id==="chatgpt-4o-latest") ? true : "the catalogue was skipped"; })());
  ok("and the key is sent only when there is one", await pg.evaluate(async()=>{
      const seen=[]; const real=window.fetch;
      window.fetch=async(u,i)=>{ if(/\/models/.test(String(u)))seen.push({u:String(u),a:!!(i&&i.headers&&i.headers.Authorization)}); return real(u,i); };
      state.nanoKey=""; localStorage.removeItem("sm_modelcache_nano"); await loadModels(true);
      state.nanoKey="k"; localStorage.removeItem("sm_modelcache_nano"); await loadModels(true);
      window.fetch=real;
      const n=seen.filter(x=>/nano-gpt/.test(x.u));
      return (n.length===2 && n[0].a===false && n[1].a===true) ? true : JSON.stringify(seen); }));

  console.log("\n[one catalogue failing never costs you the other]");
  ok("a stale catalogue is kept rather than dropped", await (async()=>{
      await reload({key:"k",fn:{}});
      nanoCatFails=true;
      await pg.evaluate(async()=>{ await loadModels(true); });
      const c=await cat();
      return c.some(o=>o.id==="chatgpt-4o-latest") && c.some(o=>o.id==="anthropic/claude-3.5-sonnet")
        ? true : "a 500 emptied the list: "+JSON.stringify(c); })());
  ok("and with no cache to fall back on, the other still populates", await (async()=>{
      await pg.evaluate(async()=>{ localStorage.removeItem("sm_modelcache_nano"); await loadModels(true); });
      const c=await cat();
      nanoCatFails=false;
      return c.length>0 && c.every(o=>o.tag==="OpenRouter")
        ? true : "OpenRouter did not survive alone: "+JSON.stringify(c); })());
  ok("an empty catalogue is treated as a failure, not as an answer", await pg.evaluate(async()=>{
      const real=window.fetch;
      window.fetch=async(u,i)=>/nano-gpt.*models/.test(String(u))
        ? {ok:true,status:200,json:async()=>({data:[]})} : real(u,i);
      state.nanoKey="k"; localStorage.removeItem("sm_modelcache_nano");
      await loadModels(true);
      window.fetch=real;
      return localStorage.getItem("sm_modelcache_nano")===null
        ? true : "an empty list was cached for a day"; }));

  console.log("\n[the list refreshes when it would otherwise be wrong]");
  ok("there is finally a way to reach the force path", await pg.evaluate(()=>{
      const b=document.getElementById('refreshModelsBtn');
      return !!b && /loadModels\(true\)/.test(b.getAttribute('onclick')||""); }));
  ok("saving the key reloads it, so the models appear without a restart", (()=>{
      const src=require('fs').readFileSync('/home/user/Multirp/index.html','utf8');
      const i=src.indexOf('store.setRaw(K.nanoKey');
      return /loadModels\(false\)/.test(src.slice(i,i+400)) ? true : "saving does not reload the list"; })());
  ok("so does switching a card to a provider whose catalogue is not loaded", (()=>{
      const src=require('fs').readFileSync('/home/user/Multirp/index.html','utf8');
      const i=src.indexOf('state.fnCfg[fn].prov = sel.value');
      return /loadModels\(false\)/.test(src.slice(i,i+300)) ? true : "the picker does not reload the list"; })());
  ok("and the count is shown, so a half-loaded list is visible", await pg.evaluate(async()=>{
      state.nanoKey="k"; localStorage.removeItem("sm_modelcache"); localStorage.removeItem("sm_modelcache_nano");
      await loadModels(true);
      const t=document.getElementById('modelListCount').textContent;
      return /\d+ models — OpenRouter \+ NanoGPT/.test(t) ? true : t; }));
  ok("a legacy flat array still fills the list", await pg.evaluate(()=>{
      fillModels(["x/one","x/two"]);
      const c=[...document.querySelectorAll('#modelList option')];
      return c.length===2 && c[0].value==="x/one" && c[0].textContent==="OpenRouter"
        ? true : JSON.stringify(c.map(o=>o.value+":"+o.textContent)); }));

  ok("no page errors", errs.length===0?true:errs.join(" | "));
  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close(); process.exit(fail?1:0);
})();
