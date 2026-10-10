/* v150.95 — a prompt the player edits stays edited. Reported: "I am changing suggested replies but it reverts back." Every
   load ran each prompt-upgrade pipe again; a stored prompt that still had the old default's opening and not the newest
   sentence was put back to the shipped default each time the app opened. Each pipe now runs once per install.
   Run: NODE_PATH=/path/to/node_modules node tests/prompt-edits-stick.browser.js */
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:process.env.SM_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const ctx=await b.newContext({viewport:{width:412,height:915}});
  const pg=await ctx.newPage();
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  const url='file://'+require('path').resolve(__dirname,'..','index.html');
  await pg.goto(url); await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(600);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x===undefined?c:x).slice(0,600));} };

  // an edit that keeps the old opening the pipes look for, and drops their newest sentence
  const EDITS={
    x_reply_suggest_woman:"1. FUNNY: something light about the moment.\n2. MY OWN: what I would really say.\n3. BOLD: a step closer.",
    x_reply_suggest:"You write the three options {{user}} can tap next. A DIRECTION, NOT THE LINE. My own rules here."
  };
  const done=await pg.evaluate(()=>{ try{ return JSON.parse(localStorage.getItem("sm_pipesdone")||"[]").length; }catch(_){ return -1; } });
  ok("the first load records the upgrades it ran", done>20, done);
  await pg.evaluate(E=>{ Object.keys(E).forEach(k=>{ state[k]=E[k]; store.setRaw(K[k],E[k]); }); },EDITS);
  for(let i=0;i<2;i++){ await pg.reload(); await pg.waitForTimeout(2200); }
  const after=await pg.evaluate(keys=>{ const r={}; keys.forEach(k=>{ r[k]=state[k]; }); return r; },Object.keys(EDITS));
  Object.keys(EDITS).forEach(k=>ok(k+": the edit survives two reloads", after[k]===EDITS[k], String(after[k]).slice(0,160)));

  // an install that never ran a pipe (an old save) still gets its untouched old default upgraded once
  const OLD="You write the three options {{user}} can tap next. HOW EACH OPTION IS WRITTEN. (an old default)";
  await pg.evaluate(o=>{ localStorage.removeItem("sm_pipesdone"); store.setRaw(K.x_reply_suggest,o); },OLD);
  await pg.reload(); await pg.waitForTimeout(2200);
  const up1=await pg.evaluate(()=>({now:state.x_reply_suggest,def:X_ENGINE_PROMPTS.x_reply_suggest.def}));
  ok("an old stored default is still upgraded the first time", up1.now===up1.def, String(up1.now).slice(0,120));

  /* v150.98 — the other ways an edit looked reverted */
  console.log("\n[v150.98 — a universe's own copy]");
  const U=await pg.evaluate(()=>{
    const key="x_reply_suggest_woman", mine="1. FUNNY: mine.\n2. WARM: mine.\n3. BOLD: mine.";
    state[key]=mine; store.setRaw(K[key],mine);
    const u=curUniverseObj(); u.prompts=u.prompts||{}; delete u.prompts[key];
    const r={};
    // the universe editor opens the prompt actually in use (the global edit), not the shipped default
    _uePrompts={}; openPromptEdit(key,"universe"); r.ueShows=document.getElementById('peEditText').value===mine; try{ closeModal('promptEditModal'); }catch(_){}
    // a universe with its own copy: Settings says so and offers to use the edit there
    u.prompts[key]="1. OLD: the universe's own copy."; r.upBefore=up(key)===u.prompts[key];
    const html=_plqBlockInner("e_test",{kind:"prompt",promptKey:key}); r.warn=/uses its own copy of this prompt/.test(html)&&/plqUseGlobalHere/.test(html);
    plqUseGlobalHere(key); r.upAfter=up(key)===mine&&!(key in u.prompts);
    r.noWarn=!/uses its own copy/.test(_plqBlockInner("e_test",{kind:"prompt",promptKey:key}));
    return r; });
  ok("the universe editor opens the edited global prompt when the universe has no copy of its own", U.ueShows===true, JSON.stringify(U));
  ok("a universe's own copy is what it uses", U.upBefore===true, JSON.stringify(U));
  ok("Settings says the open universe uses its own copy, with a button to use the edit there", U.warn===true, JSON.stringify(U));
  ok("the button drops the universe's copy: the edit reaches it, and the note goes", U.upAfter===true&&U.noWarn===true, JSON.stringify(U));
  ok("each upgrade's record is written the moment it runs", await pg.evaluate(()=>{
      localStorage.removeItem("sm_pipesdone"); loadState(); const n=JSON.parse(localStorage.getItem("sm_pipesdone")||"[]").length; const src=loadState.toString(); const writes=(src.match(/localStorage\.setItem\("sm_pipesdone"/g)||[]).length;
      return (n>20&&writes>=2)?true:JSON.stringify({n,writes}); }));

  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close(); process.exit(fail?1:0);
})();
