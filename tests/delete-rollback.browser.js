/* v148.6 — deleting a message takes back what was built from it (the same rollback Retry uses): the
   characters' memories cut from it, the player's memory, plans stamped with it. Reported: a garbage reply the
   user deleted came back next turn as a memory of "earlier today". Also: an aftermath memory is filed where
   the move was made, not wherever the player is when the event resolves.
   Run: NODE_PATH=/path/to/node_modules node tests/delete-rollback.browser.js */
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

  const R=await pg.evaluate(async()=>{
    const uni=state.universes[0]; state.curUniverse=uni.id;
    state.personas=state.personas.filter(p=>p.id!=="dr_du"); state.personas.push({id:"dr_du",name:"Duygu Akbaba",universeId:uni.id,look:{}});
    const c=curChat(); c.universeId=uni.id; c.presentIds=["dr_du"]; c.gameDay=2; c.period="Midday";
    c.messages=[
      {mid:"d1",role:"user",content:'"Hakan ve Nil nasıl?"',present:["dr_du"]},
      {mid:"d2",role:"assistant",speaker:"Duygu Akbaba",speakerId:"dr_du",toId:"__user__",content:"Only the way in changes. Reply again as Duygu.",present:["dr_du"]},
      {mid:"d3",role:"user",content:'"Neyse, yürüyelim mi?"',present:["dr_du"]}];
    c.memDoneIdx=2;
    state.memory=(state.memory||[]).filter(m=>!/^mdr/.test(m.id));
    state.memory.push({id:"mdr1",ownerId:"dr_du",character:"Duygu Akbaba",content:"I answered that only the way in changes.",srcMids:["d1","d2"],gameDay:2,gamePeriod:"Midday",type:"EXPERIENCE",chatId:c.id,universeId:uni.id},
                      {id:"mdr2",ownerId:"dr_du",character:"Duygu Akbaba",content:"A reconciled morning.",srcMids:["d0","d2"],source:"reconciled",gameDay:2,gamePeriod:"Midday",type:"EXPERIENCE",chatId:c.id,universeId:uni.id});
    c.playerMem=[{id:"pmd",content:"She said only the way in changes.",srcMids:["d1","d2"],gameDay:2,gamePeriod:"Midday"}];
    c.calendar=[{id:"cal_d",kind:"meeting",title:"Walk to the bench",day:2,period:"Afternoon",who:"Duygu Akbaba",done:false,ftMid:"d2",ftNew:true}];
    window.uiConfirm=async()=>true;
    await deleteMessage("d2");
    return {msgs:c.messages.map(m=>m.mid).join(),arc:state.memory.some(m=>m.id==="mdr1"),merged:(state.memory.find(m=>m.id==="mdr2")||{}).srcMids,
            pm:c.playerMem.length,cal:c.calendar.length,memDone:c.memDoneIdx};
  });
  ok("the message is gone", R.msgs==="d1,d3", R.msgs);
  ok("the arc memory cut from it is taken back (the arc is re-cut from what is left)", R.arc===false&&R.memDone<=0, JSON.stringify(R));
  ok("a merged memory only loses it from its sources", JSON.stringify(R.merged)==='["d0"]', JSON.stringify(R.merged));
  ok("the player's memory built from it is taken back", R.pm===0, JSON.stringify(R));
  ok("a plan filed from it is removed", R.cal===0, JSON.stringify(R));

  const A=await pg.evaluate(()=>{ const c=curChat(); c.location="Site Market";
    const ev={kind:"confrontation",accuserId:"dr_du",conviction:0.5,_outcome:"defused",gist:"the rumour",placeName:"Isdemir — Worker Canteen"};
    const before=state.memory.length; recordConfrontationAftermath(c,ev);
    const m=state.memory.slice(before).find(x=>x.ownerId==="dr_du"); return m?m.location:"(none)"; });
  ok("an aftermath memory is filed where the move was made, not where the player is at the end", A==="Isdemir — Worker Canteen", A);

  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close(); process.exit(fail?1:0);
})();
