/* v66.1 — THINKING IS PER AGENT.
   v37.6 pulled the roleplay thinking switch back off the background engines, and that was right as
   a DEFAULT: a dozen structured-JSON calls per turn, each spending a hidden thinking budget, is
   how you make JSON arrive wrapped in prose and answers get cut off at max_tokens. But it was
   also a ceiling — the gamemaster and the daily engines are exactly the jobs worth paying thought
   for, while the routers and trackers are worth keeping fast. Each agent bucket now carries its
   own Thinking (Auto / Off / On) and effort level, keyed the same way the creativity and token
   overrides already were, and every bucket ships as Auto so an untouched install is unchanged. */
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x||c).slice(0,400));} };
  const ctx=await b.newContext({viewport:{width:412,height:915},hasTouch:true,isMobile:true});
  const pg=await ctx.newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file:///home/user/Multirp/index.html'); await pg.waitForTimeout(2300);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(800);

  await pg.evaluate(()=>{
    state.key="test-key";
    window.__bodies=[];
    window.fetch=async(url,init)=>{
      let body=null; try{ body=JSON.parse(init&&init.body||"{}"); }catch(e){}
      window.__bodies.push(body);
      return { ok:true, status:200, json:async()=>({choices:[{message:{content:"ok"}}]}),
               text:async()=>JSON.stringify({choices:[{message:{content:"ok"}}]}) };
    };
  });
  const src=require('fs').readFileSync('/home/user/Multirp/index.html','utf8');
  const send=opts=>pg.evaluate(async o=>{
      window.__bodies=[];
      try{ await chatCompletion([{role:"user",content:"hi"}],"deepseek/deepseek-v4-pro",o); }catch(e){}
      return window.__bodies[0]||{}; },opts);
  const setFn=(fn,cfg)=>pg.evaluate(o=>{ state.fnCfg[o.fn]=Object.assign(state.fnCfg[o.fn]||{},o.cfg); },{fn,cfg});
  const clearFns=()=>pg.evaluate(()=>{ Object.keys(state.fnCfg||{}).forEach(k=>{
      if(state.fnCfg[k]){ delete state.fnCfg[k].reason; delete state.fnCfg[k].effort; } }); });

  console.log("\n[the helpers exist and Auto means 'say nothing']");
  ok("fnReason and fnEffort are defined", await pg.evaluate(()=>
      typeof fnReason==='function' && typeof fnEffort==='function'));
  ok("an untouched bucket reads Auto", await pg.evaluate(()=>
      fnReason("gm")===undefined && fnEffort("gm")===undefined ? true
      : "gm="+fnReason("gm")+"/"+fnEffort("gm")));
  ok("null is Auto, not Off", await pg.evaluate(()=>{
      state.fnCfg.gm=Object.assign(state.fnCfg.gm||{},{reason:null,effort:null});
      const r=fnReason("gm")===undefined && fnEffort("gm")===undefined;
      delete state.fnCfg.gm.reason; delete state.fnCfg.gm.effort;
      return r?true:"null did not read as Auto"; }));

  console.log("\n[an untouched install is exactly v37.6]");
  await clearFns();
  await pg.evaluate(()=>{ state.reasoningOn=true; state.reasoningEffort=""; });
  ok("the gamemaster still does not think on Auto", await (async()=>{
      const r=(await send({fn:"gm",temp:0,max:60})).reasoning;
      return (r&&r.enabled===false&&r.exclude===true)?true:JSON.stringify(r); })());
  ok("the roleplay reply still does", await (async()=>{
      const r=(await send({rp:true})).reasoning;
      return (r&&r.enabled===true)?true:JSON.stringify(r); })());
  ok("an untagged engine call still does not", await (async()=>{
      const r=(await send({temp:0,max:110})).reasoning;
      return (r&&r.enabled===false)?true:JSON.stringify(r); })());

  console.log("\n[turning one agent on reaches every call it owns]");
  await setFn("gm",{reason:true,effort:"high"});
  ok("the gamemaster thinks", await (async()=>{
      const r=(await send({fn:"gm",temp:0,max:60})).reasoning;
      return (r&&r.enabled===true)?true:JSON.stringify(r); })());
  ok("at the effort its card asked for", await (async()=>{
      const r=(await send({fn:"gm",temp:0.7,max:120})).reasoning;
      return (r&&r.effort==="high")?true:JSON.stringify(r); })());
  ok("and it gets the room to think in", await (async()=>{
      const bd=await send({fn:"gm",temp:0,max:60});
      return (+bd.max_tokens>=2000)?true:"max_tokens="+bd.max_tokens; })());
  ok("its NEIGHBOURS are untouched", await (async()=>{
      const r=(await send({fn:"mem",temp:0.2,max:360})).reasoning;
      return (r&&r.enabled===false)?true:JSON.stringify(r); })());
  ok("so is the router", await (async()=>{
      const r=(await send({fn:"router",temp:0,max:5})).reasoning;
      return (r&&r.enabled===false)?true:JSON.stringify(r); })());

  console.log("\n[effort alone, without thinking, changes nothing]");
  await clearFns();
  await setFn("mem",{effort:"high"});
  ok("an effort level on a bucket that isn't thinking is inert", await (async()=>{
      const r=(await send({fn:"mem",temp:0.2,max:360})).reasoning;
      return (r&&r.enabled===false&&r.effort===undefined)?true:JSON.stringify(r); })());

  console.log("\n[Off is a real answer, not the same as Auto]");
  await clearFns();
  await setFn("rp",{reason:false});
  ok("a bucket set to Off overrides the roleplay switch", await (async()=>{
      const r=(await send({fn:"rp",rp:true})).reasoning;
      return (r&&r.enabled===false&&r.exclude===true)?true:JSON.stringify(r); })());
  ok("an explicit opts.reasoning still wins over the card", await (async()=>{
      const r=(await send({fn:"rp",rp:true,reasoning:true})).reasoning;
      return (r&&r.enabled===true)?true:JSON.stringify(r); })());
  await clearFns();
  await setFn("gm",{reason:true});
  ok("and opts.reasoning:false still wins the other way", await (async()=>{
      const r=(await send({fn:"gm",reasoning:false})).reasoning;
      return (r&&r.enabled===false)?true:JSON.stringify(r); })());
  await clearFns();
  await pg.evaluate(()=>{ state.reasoningOn=false; });

  console.log("\n[every agent bucket is actually wired at its call sites]");
  ok("no per-function call site was left untagged", (()=>{
      const bare=(src.match(/\{temp:fnTemp\(/g)||[]).length;
      return bare===0?true:bare+" opts objects still start with temp:fnTemp"; })());
  for(const fn of ["rewriter","mc","mem","gm","unigen","router"]){
    const tagged=(src.match(new RegExp('\\{fn:"'+fn+'",temp:fnTemp\\("'+fn+'"','g'))||[]).length;
    ok('"'+fn+'" reaches its call sites ('+tagged+")", tagged>0?true:"no tagged call site");
  }
  /* "call" is the exception, and deliberately so: the live call never goes through
     chatCompletion, so its card reaches exactly one place — the streamed request body.
     v107.1 — and now by two routes, because that body is built for whichever provider the call
     card names: OpenRouter's reasoning object, or the portable reasoning_effort elsewhere. Both
     read the same "call" bucket, which is what this is really asserting. */
  ok('"call" reaches the streamed request body instead',
     /reqBody\.reasoning=vcReasoning\(\)/.test(src)?true:"the voice-call body no longer uses the call card");
  ok('"call" still reaches it on a non-OpenRouter provider',
     /fnReason\("call"\)===true/.test(src) && /fnEffort\("call"\)/.test(src)
       ?true:"the portable path ignores the call card's thinking switch");
  ok("no call site passes a bucket the overrides don't know", (()=>{
      const keys=new Set((src.match(/\{fn:"([a-z]+)",/g)||[]).map(m=>m.slice(5,-2)));
      /* "rp" (arrival lines, proactive texts) and "reply" (the A/B tester) share the roleplay
         creativity bucket and have no card of their own, so they simply read Auto. */
      const known=new Set(["rewriter","mc","mem","gm","unigen","router","call","rp","reply","narrate","bio"]);
      const stray=[...keys].filter(k=>!known.has(k));
      return stray.length===0?true:"unknown bucket(s): "+stray.join(", "); })());

  /* v67.1 — THE BUCKET MUST FOLLOW THE MODEL. While a bucket only carried creativity and a token
     cap this was a quiet wrong; v66.1 gave each one a THINKING switch and it became "I turned
     thinking on for Memory and my Auto-RP narrator started thinking" — because that narrator runs
     on the ROLEPLAY model and read the memory bucket. Four groups were crossed this way: every
     authoring job read Memory, the character generator read Memory and Authoring at once, the
     arrival narration ran on the roleplay model through Memory, and the narrator as above. The
     card you adjust has to be the card in play, so the model expression decides the bucket. */
  console.log("\n[every bucket belongs to the card that supplies the model]");
  {
    const WANT=[
      [/state\.memModel/,            "mem"],
      [/state\.gmModel(?!\|\|state\.rewriter)/, "gm"],
      [/state\.mcModel/,             "mc"],
      [/state\.rewriter/,            "rewriter"],
      [/state\.routerModel/,         "router"],
      [/state\.bioModel/,            "bio"],
      [/authoringModel\(\)/,          "unigen"],
      [/rpModel\(\)/,                "rp"],
    ];
    // every tagged call site: the model expression immediately before the opts object
    const sites=[...src.matchAll(/,\s*([A-Za-z_$][\w$.()|"\-\/ ]*?),\s*\{fn:"([a-z]+)"/g)]
      .map(m=>({model:m[1].trim(),fn:m[2]}));
    ok("the scan found the call sites", sites.length>60?true:"only "+sites.length+" found");
    /* A fallback chain names the PRIMARY model first — state.mcModel||state.memModel||state.model
       is a Director call that degrades, not a Memory call — so the bucket follows the leading
       token, and a rule that matched anywhere in the expression would call that a violation. */
    const bad=[];
    for(const st of sites){
      let best=null,at=Infinity;
      for(const [rx,want] of WANT){
        const m=st.model.match(rx);
        if(m && m.index<at){ at=m.index; best=want; }
      }
      if(best && st.fn!==best) bad.push(st.model+" → "+st.fn+" (want "+best+")");
    }
    ok("no call site reads another card's bucket", bad.length===0?true:bad.join(" | "));
  }
  ok("the Auto-RP narrator has its own bucket, not Memory's", (()=>{
      const m=src.match(/playerNarratePrompt[\s\S]{0,400}?\{fn:"([a-z]+)"/);
      return m&&m[1]==="narrate"?true:"narrator bucket is "+(m?m[1]:"?"); })());
  ok("the drives writer's bucket follows the gamemaster model", (()=>{
      const m=src.match(/state\.gmModel\|\|state\.rewriter,\{fn:"([a-z]+)"/);
      return m&&m[1]==="gm"?true:"drives bucket is "+(m?m[1]:"?"); })());
  ok("both new buckets have a card", await pg.evaluate(()=>{
      const b=new Set([...document.querySelectorAll('[data-kind="reason"]')].map(h=>h.dataset.ovr));
      const miss=["narrate","bio"].filter(k=>!b.has(k));
      return miss.length===0?true:"no card for: "+miss.join(", "); }));

  console.log("\n[the live voice call is wired too — it never passes through chatCompletion]");
  ok("vcReasoning is off by default", await pg.evaluate(()=>{
      const r=vcReasoning(); return (r.enabled===false&&r.exclude===true)?true:JSON.stringify(r); }));
  ok("and follows the Voice Calls card when it is turned on", await pg.evaluate(()=>{
      state.fnCfg.call=Object.assign(state.fnCfg.call||{},{reason:true,effort:"low"});
      const r=vcReasoning();
      delete state.fnCfg.call.reason; delete state.fnCfg.call.effort;
      return (r.enabled===true&&r.effort==="low")?true:JSON.stringify(r); }));

  console.log("\n[the controls are on every agent card]");
  ok("nine reason hosts, one per agent card", await pg.evaluate(()=>{
      const hosts=[...document.querySelectorAll('[data-kind="reason"]')].map(h=>h.dataset.ovr).sort();
      const want=["bio","call","gm","mc","mem","narrate","rewriter","router","unigen"];
      return JSON.stringify(hosts)===JSON.stringify(want)?true:JSON.stringify(hosts); }));
  ok("every card that has creativity/tokens also has thinking", await pg.evaluate(()=>{
      const a=new Set([...document.querySelectorAll('[data-kind="temp"]')].map(h=>h.dataset.ovr));
      const b=new Set([...document.querySelectorAll('[data-kind="reason"]')].map(h=>h.dataset.ovr));
      const miss=[...a].filter(k=>!b.has(k));
      return miss.length===0?true:"no thinking control on: "+miss.join(", "); }));
  ok("they render two pickers each", await pg.evaluate(()=>{
      if(typeof renderOvrFields==='function') renderOvrFields();
      const h=document.querySelector('[data-ovr="gm"][data-kind="reason"]');
      return (h&&h.querySelector('[data-think]')&&h.querySelector('[data-eff]'))?true:"gm host is empty"; }));
  ok("thinking offers Auto / Off / On", await pg.evaluate(()=>{
      const v=[...document.querySelector('[data-ovr="gm"][data-kind="reason"] [data-think]').options].map(o=>o.value);
      return JSON.stringify(v)===JSON.stringify(["","off","on"])?true:JSON.stringify(v); }));
  ok("effort offers Auto / low / medium / high", await pg.evaluate(()=>{
      const v=[...document.querySelector('[data-ovr="gm"][data-kind="reason"] [data-eff]').options].map(o=>o.value);
      return JSON.stringify(v)===JSON.stringify(["","low","medium","high"])?true:JSON.stringify(v); }));
  ok("effort is dead until thinking is on", await pg.evaluate(()=>
      document.querySelector('[data-ovr="gm"][data-kind="reason"] [data-eff]').disabled===true));
  ok("picking On writes through and wakes the effort picker", await pg.evaluate(()=>{
      const h=document.querySelector('[data-ovr="gm"][data-kind="reason"]');
      const th=h.querySelector('[data-think]'), ef=h.querySelector('[data-eff]');
      th.value="on"; th.dispatchEvent(new Event('change'));
      ef.value="medium"; ef.dispatchEvent(new Event('change'));
      const okk = state.fnCfg.gm.reason===true && state.fnCfg.gm.effort==="medium" && ef.disabled===false;
      th.value=""; th.dispatchEvent(new Event('change'));
      ef.value="";  ef.dispatchEvent(new Event('change'));
      return okk?true:"reason="+state.fnCfg.gm.reason+" effort="+state.fnCfg.gm.effort; }));
  ok("picking Auto again clears it back to null", await pg.evaluate(()=>
      state.fnCfg.gm.reason===null && state.fnCfg.gm.effort===null ? true
      : "reason="+state.fnCfg.gm.reason+" effort="+state.fnCfg.gm.effort));
  ok("the setting survives a save", await pg.evaluate(()=>{
      state.fnCfg.gm=Object.assign(state.fnCfg.gm||{},{reason:true,effort:"high"});
      store.set(K.fnCfg,state.fnCfg);
      const back=store.get(K.fnCfg,{});
      delete state.fnCfg.gm.reason; delete state.fnCfg.gm.effort;
      store.set(K.fnCfg,state.fnCfg);
      return (back.gm&&back.gm.reason===true&&back.gm.effort==="high")?true:JSON.stringify(back.gm); }));

  console.log("\n[and the labels no longer lie]");
  ok("the roleplay row stops claiming the engines can never think", await pg.evaluate(()=>
      !/never the background engines/.test(document.documentElement.innerHTML)
      ? true : "the old claim is still on the page"));
  ok("it points at the per-agent switches instead", await pg.evaluate(()=>
      /each background agent has its own switch/.test(document.documentElement.innerHTML)));

  ok("no page errors", errs.length===0?true:errs.join(" | "));
  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close(); process.exit(fail?1:0);
})();
