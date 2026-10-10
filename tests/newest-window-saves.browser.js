/* v150.108 — THE WINDOW YOU OPEN IS THE ONE THAT SAVES. Prompts, bios and pictures "reverted" because a later window ran
   read-only behind the first one (a browser tab left alive beside the installed app, an instance still in memory): its edits
   showed on screen and were never saved. Now an opening window asks the writer to save and hand over, takes the lock (or
   steals it when the writer cannot answer), and the old window goes read-only at once — saying so on every refused save —
   and takes over again, reloading the saved state, when it is shown again.
   Run: node tests/newest-window-saves.browser.js */
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:process.env.SM_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const ctx=await b.newContext({viewport:{width:412,height:915}});
  const url='file://'+require('path').resolve(__dirname,'..','index.html');
  const errs=[];
  const open=async(tag)=>{ const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(tag+": "+e.message)); p.on('dialog',d=>d.dismiss());
    await p.goto(url); await p.waitForTimeout(2600);
    await p.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
    await p.waitForTimeout(600); return p; };
  const role=async p=>{ try{ return await p.evaluate(()=>(!_tabReadOnly&&collectionsSafe)?"W":"RO"); }catch(e){ return "ERR"; } };
  const show=p=>p.evaluate(()=>{ Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>"visible"}); document.dispatchEvent(new Event('visibilitychange')); });
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x===undefined?c:x).slice(0,800));} };
  const setPrompt=(p,v)=>p.evaluate(v=>{ const t=document.createElement('textarea'); t.dataset.pkey="x_reply_suggest_woman"; t.value=v; document.body.appendChild(t); plqInput(t); t.remove(); },v);
  const storedPrompt=p=>p.evaluate(()=>localStorage.getItem(K.x_reply_suggest_woman));

  console.log("\n[a second window takes over]");
  const A=await open("A");
  ok("the first window saves", await role(A)==="W");
  await setPrompt(A,"FROM A");
  await A.evaluate(()=>{ const uni=state.universes[0]; state.curUniverse=uni.id;
    state.personas=state.personas.filter(p=>p.id!=="nw_1"); state.personas.push({id:"nw_1",name:"Ada",universeId:uni.id,personality:"BIO FROM A",look:{}}); persistPersonas();
    // a chat change still waiting for its delayed write when the next window opens
    const c=curChat(); if(c){ c._nwMark="pending from A"; c.title="NW PENDING"; persistChats(c); } });
  const B=await open("B");
  ok("the window opened last saves", await role(B)==="W", await role(B));
  ok("the first one is read-only now", await role(A)==="RO", await role(A));
  ok("…and says so where it cannot be missed", await A.evaluate(()=>{ const b=document.getElementById('tabRoBar');
      return (b.classList.contains('show')&&/opened in another window/.test(b.textContent)&&/Nothing you change here is saved/.test(b.textContent)&&/Use this window/.test(b.querySelector('button').textContent))?true:b.textContent; }));
  ok("the new window has what the first one saved (prompt and bio)", await B.evaluate(()=>(state.x_reply_suggest_woman==="FROM A"||up("x_reply_suggest_woman")==="FROM A")&&(state.personas.find(p=>p.id==="nw_1")||{}).personality==="BIO FROM A")===true);
  ok("…including a change the first one had not written yet (it saved before handing over)", await B.evaluate(()=>Object.values(state.chats||{}).some(c=>c&&c.title==="NW PENDING"))===true);

  console.log("\n[edits in the new window are kept]");
  await setPrompt(B,"FROM B");
  await B.evaluate(()=>{ const p=state.personas.find(x=>x.id==="nw_1"); p.personality="BIO FROM B"; persistPersonas(); });
  await B.waitForTimeout(600);
  ok("the prompt edited in the new window is stored", await storedPrompt(B)==="FROM B", await storedPrompt(B));
  const toasts=[]; await A.exposeFunction('__nwToast',t=>toasts.push(t)); await A.evaluate(()=>{ const t0=window.toast; window.toast=m=>{ window.__nwToast(String(m)); try{ t0(m); }catch(_){} }; _roWarnT=0; });
  await setPrompt(A,"LATE FROM A");
  ok("the old window cannot write over it", await storedPrompt(B)==="FROM B", await storedPrompt(B));
  ok("…and a refused save says it was not saved", toasts.some(t=>/NOT saved/.test(t)), JSON.stringify(toasts));

  console.log("\n[showing the old window again takes over]");
  const loads={A:0}; A.on('load',()=>loads.A++);
  await show(A); await A.waitForTimeout(3600);
  await A.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  ok("the old window reloaded and saves again", loads.A===1&&(await role(A))==="W", JSON.stringify({loads,role:await role(A)}));
  ok("…with what the other window saved", await A.evaluate(()=>(state.x_reply_suggest_woman==="FROM B"||up("x_reply_suggest_woman")==="FROM B")&&(state.personas.find(p=>p.id==="nw_1")||{}).personality==="BIO FROM B")===true);
  ok("…and the other window is read-only now", await role(B)==="RO", await role(B));

  console.log("\n[a writer that cannot answer]");
  await A.evaluate(()=>{ window._wlYield=async()=>{}; });   // as if frozen in the background
  const C=await open("C"); await C.waitForTimeout(800);
  ok("a window opening beside a frozen writer still takes over (after a moment)", await role(C)==="W", await role(C));
  ok("…and the frozen one is read-only when it wakes", await role(A)==="RO", await role(A));
  await setPrompt(C,"FROM C");
  ok("…and the new window's edit is stored", await storedPrompt(C)==="FROM C");

  console.log("\n[exactly one writer]");
  const roles=[await role(A),await role(B),await role(C)];
  ok("three windows: exactly one saves", roles.filter(r=>r==="W").length===1, JSON.stringify(roles));
  await C.close(); await A.waitForTimeout(3500);
  const after=[await role(A),await role(B)];
  ok("close the writer → exactly one of the others takes over", after.filter(r=>r==="W").length===1, JSON.stringify(after));

  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close(); process.exit(fail?1:0);
})();
