/* v37.6 — "Model reasoning / thinking" is a switch under the roleplay model, and it used to opt
   the WHOLE APP in: every memory builder, router, tracker, judge and the psyche writer as well.
   Those are structured-JSON calls that want no chain-of-thought at all — a dozen of them run per
   turn, each then spending a hidden thinking budget, likelier to wrap its JSON in prose, and able
   to run out of max_tokens before writing the answer. */
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

  // capture the body of whatever chatCompletion would POST, without a network call
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
  const send=opts=>pg.evaluate(async o=>{
      window.__bodies=[];
      try{ await chatCompletion([{role:"user",content:"hi"}],"deepseek/deepseek-v4-pro",o); }catch(e){}
      return (window.__bodies[0]||{}).reasoning||null; },opts);

  console.log("\n[with the switch ON]");
  await pg.evaluate(()=>{ state.reasoningOn=true; state.reasoningEffort=""; });
  ok("a roleplay reply thinks", await (async()=>{
      const r=await send({rp:true});
      return (r&&r.enabled===true) ? true : JSON.stringify(r); })());
  ok("a memory builder does not", await (async()=>{
      const r=await send({dbg:"Memory (arc)"});
      return (r&&r.enabled===false&&r.exclude===true) ? true : JSON.stringify(r); })());
  ok("nor a router or tracker", await (async()=>{
      const r=await send({temp:0,max:110});
      return (r&&r.enabled===false) ? true : JSON.stringify(r); })());
  ok("nor the drives writer", await (async()=>{
      const r=await send({dbg:"Drives & brakes (id / superego)"});
      return (r&&r.enabled===false) ? true : JSON.stringify(r); })());
  ok("the effort level rides along on the roleplay call", await (async()=>{
      await pg.evaluate(()=>{ state.reasoningEffort="high"; });
      const r=await send({rp:true});
      return (r&&r.effort==="high") ? true : JSON.stringify(r); })());
  ok("and never on an engine call", await (async()=>{
      const r=await send({dbg:"Meetings tracker"});
      await pg.evaluate(()=>{ state.reasoningEffort=""; });
      return (r&&r.effort===undefined&&r.enabled===false) ? true : JSON.stringify(r); })());

  console.log("\n[with the switch OFF]");
  await pg.evaluate(()=>{ state.reasoningOn=false; });
  ok("nothing thinks, including the roleplay reply", await (async()=>{
      const r=await send({rp:true});
      return (r&&r.enabled===false&&r.exclude===true) ? true : JSON.stringify(r); })());
  ok("engines are unchanged either way", await (async()=>{
      const r=await send({dbg:"Presence tracker"});
      return (r&&r.enabled===false) ? true : JSON.stringify(r); })());

  console.log("\n[an explicit per-call request still wins]");
  ok("opts.reasoning true turns it on for one call", await (async()=>{
      const r=await send({reasoning:true});
      return (r&&r.enabled===true) ? true : JSON.stringify(r); })());
  ok("opts.reasoning false turns it off even for a roleplay reply", await (async()=>{
      await pg.evaluate(()=>{ state.reasoningOn=true; });
      const r=await send({rp:true,reasoning:false});
      await pg.evaluate(()=>{ state.reasoningOn=false; });
      return (r&&r.enabled===false) ? true : JSON.stringify(r); })());

  console.log("\n[and the label says what it does]");
  ok("the reasoning row no longer claims it applies to every call", await pg.evaluate(()=>{
      // scoped to that row: "Avoid providers" is a DIFFERENT setting and does apply to every call
      const row=document.getElementById('setReasoningOn').closest('.kvline');
      return !/applies to every call/.test(row?row.textContent:"")
        ? true : "the old claim is still on the reasoning row"; }));
  ok("it says roleplay replies only", await pg.evaluate(()=>
      /roleplay replies only — never the background engines/.test(document.documentElement.innerHTML)));

  ok("no page errors", errs.length===0?true:errs.join(" | "));
  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close(); process.exit(fail?1:0);
})();
