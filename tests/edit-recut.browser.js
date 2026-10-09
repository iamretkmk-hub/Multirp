/* v150.83 — editing a message re-cuts what was built from it. The transcript always read the live message, but
   the memories cut from the line (the characters' and the player's) kept the old words: "I bought the RED car"
   edited to BLUE was still remembered as RED. Now the arc memories that cite the edited line are removed and the
   same span is cut again from the new text, under the day and part of the day it was filed. Merged memories stay;
   an unchanged edit does nothing; a failed re-cut puts the old memories back.
   Run: NODE_PATH=/path/to/node_modules node tests/edit-recut.browser.js */
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:process.env.SM_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage({viewport:{width:412,height:915}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file://'+require('path').resolve(__dirname,'..','index.html')); await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(900);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x===undefined?c:x).slice(0,900));} };

  const setup=()=>pg.evaluate(()=>{
    const uni=state.universes[0]; state.curUniverse=uni.id; state.user="Emre"; state.key="k"; state.mem=true; state.playerMemOn=true; state.condenseOn=false;
    state.personas=state.personas.filter(p=>p.id!=="ed_a"); state.personas.push({id:"ed_a",name:"Ayse",universeId:uni.id,look:{},personality:"x",instructions:"x"});
    const c=curChat(); Object.assign(c,{universeId:uni.id,presentIds:["ed_a"],gameDay:3,period:"Evening"});
    c.messages=[
      {mid:"e1",role:"user",content:'"I bought the RED car."',present:["ed_a"]},
      {mid:"e2",role:"assistant",speaker:"Ayse",speakerId:"ed_a",toId:"__user__",content:'"The RED one? Nice."',present:["ed_a"]},
      {mid:"e3",role:"user",content:'"Want a ride tomorrow?"',present:["ed_a"]},
      {mid:"e4",role:"assistant",speaker:"Ayse",speakerId:"ed_a",toId:"__user__",content:'"Sure."',present:["ed_a"]}];
    c.memDoneIdx=3; c.memEvent=null; c.memCarry={ed_a:"e4"};
    state.memory=(state.memory||[]).filter(m=>!/^med/.test(m.id)&&m.ownerId!=="ed_a");
    state.memory.push(
      {id:"med1",ownerId:"ed_a",character:"Ayse",content:"Emre told me he bought a RED car.",srcMids:["e1","e2"],gameDay:2,gamePeriod:"Midday",type:"EXPERIENCE",importance:0.5,chatId:c.id,universeId:uni.id,source:"auto"},
      {id:"med2",ownerId:"ed_a",character:"Ayse",content:"A reconciled morning.",srcMids:["e0a","e0b"],source:"reconciled",gameDay:2,gamePeriod:"Morning",type:"EXPERIENCE",chatId:c.id,universeId:uni.id});
    c.playerMem=[{id:"pmed",content:"I told Ayse about the RED car.",srcMids:["e1","e2"],gameDay:2,gamePeriod:"Midday"}];
    window.__calls=[];
    window.__fail=false;
    window.chatCompletion=async(msgs,model,opts)=>{ const t=JSON.stringify(msgs); window.__calls.push((opts&&opts.dbg)||"");
      if(window.__fail)throw new Error("offline");
      const col=/BLUE/.test(t)?"BLUE":"RED";
      return JSON.stringify({content:"Emre told me he bought a "+col+" car.",memory:"I told Ayse about the "+col+" car.",importance_score:0.5,importance:0.5,type:"EXPERIENCE",emotion:"neutral",people:["Emre"],status:""}); };
  });

  await setup();
  const R=await pg.evaluate(async()=>{
    const c=curChat();
    editMessage("e1"); document.getElementById('editMsgText').value='"I bought the BLUE car."'; saveEditMessage();
    for(let i=0;i<60&&!state.memory.some(m=>m.ownerId==="ed_a"&&/BLUE/.test(m.content||""));i++)await new Promise(r=>setTimeout(r,50));
    await new Promise(r=>setTimeout(r,200));
    const mine=state.memory.filter(m=>m.ownerId==="ed_a");
    const blue=mine.find(m=>/BLUE/.test(m.content||"")&&m.source!=="reconciled");
    return {hist:JSON.stringify(castHistory(c,state.personas.find(p=>p.id==="ed_a"),{})),
      old:mine.some(m=>m.id==="med1"),blue:blue?{day:blue.gameDay,period:blue.gamePeriod,src:blue.srcMids}:null,
      merged:(mine.find(m=>m.id==="med2")||{}).content,pm:(c.playerMem||[]).map(x=>x.content||x.text||JSON.stringify(x)).join(" | "),
      carry:c.memCarry&&c.memCarry.ed_a,done:c.memDoneIdx,calls:window.__calls.length};
  });
  ok("the transcript reads the edited line", /BLUE/.test(R.hist)&&!/I bought the RED/.test(R.hist), R.hist);
  ok("the arc memory cut from the old words is taken back", R.old===false, JSON.stringify(R));
  ok("the span is cut again from the edited text", !!R.blue&&(R.blue.src||[]).includes("e1"), JSON.stringify(R));
  ok("…filed under the day and part of the day it was first filed", !!R.blue&&R.blue.day===2&&R.blue.period==="Midday", JSON.stringify(R.blue));
  ok("the player's memory of it is re-cut too", !/RED/.test(R.pm)&&/BLUE/.test(R.pm), R.pm);
  ok("the live scene's carried remainder and the arc pointer are untouched", R.carry==="e4"&&R.done===3, JSON.stringify(R));

  await setup();
  const M=await pg.evaluate(async()=>{
    state.memory=state.memory.filter(m=>m.id!=="med1"); curChat().playerMem=[];
    const r=state.memory.find(m=>m.id==="med2"); r.srcMids=["e1","e2","e3"]; r.content="A reconciled day with the RED car.";
    editMessage("e1"); document.getElementById('editMsgText').value='"I bought the BLUE car."'; saveEditMessage();
    await new Promise(r=>setTimeout(r,300));
    return {calls:window.__calls.length,merged:(state.memory.find(m=>m.id==="med2")||{}).content};
  });
  ok("a merged memory (a summary of the stretch) stays as written and nothing is re-cut", M.calls===0&&M.merged==="A reconciled day with the RED car.", JSON.stringify(M));

  await setup();
  const U=await pg.evaluate(async()=>{
    editMessage("e1"); document.getElementById('editMsgText').value='"I bought the RED car."'; saveEditMessage();
    await new Promise(r=>setTimeout(r,300));
    return {calls:window.__calls.length,old:state.memory.some(m=>m.id==="med1")};
  });
  ok("an edit that changes nothing re-cuts nothing", U.calls===0&&U.old===true, JSON.stringify(U));

  await setup();
  const F=await pg.evaluate(async()=>{
    window.__fail=true;
    editMessage("e1"); document.getElementById('editMsgText').value='"I bought the BLUE car."'; saveEditMessage();
    await new Promise(r=>setTimeout(r,600));
    const c=curChat();
    return {old:state.memory.some(m=>m.id==="med1"),pm:(c.playerMem||[]).length};
  });
  ok("a re-cut that fails puts the old memories back", F.old===true&&F.pm===1, JSON.stringify(F));

  await setup();
  const N=await pg.evaluate(async()=>{
    const c=curChat(); c.memDoneIdx=1; c.messages.push({mid:"e5",role:"user",content:'"Not cut yet."',present:["ed_a"]});
    editMessage("e5"); document.getElementById('editMsgText').value='"Still not cut."'; saveEditMessage();
    await new Promise(r=>setTimeout(r,300));
    return {calls:window.__calls.length,done:c.memDoneIdx};
  });
  ok("a line no memory was cut from is left to the open arc", N.calls===0&&N.done===1, JSON.stringify(N));

  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close(); process.exit(fail?1:0);
})();
