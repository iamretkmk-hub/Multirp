/* v150.49 — A GOAL ALREADY DONE. The maintained goals are rewritten once a day, so a live export still pushed "get Emre
   to make that call to Ayça" at her after he said he had made it. When the reply's Decisions request goes anyway, each
   live goal (at most five) is a yes/no "already done or moot in this scene?"; a yes at the gate strictness hides it
   until the curator rewrites the list. It never sends a request of its own.  Run: node tests/goal-done.browser.js */
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:process.env.SM_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage({viewport:{width:412,height:915}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file://'+require('path').resolve(__dirname,'..','index.html')); await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(800);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x===undefined?c:x).slice(0,700));} };

  await pg.evaluate(()=>{
    window.__reqs=[]; window.__ans={};
    const realFetch=window.fetch;
    window.fetch=async(url,opts)=>{ if(String(url).indexOf("/api/alpha/decisions")>-1){ const body=JSON.parse(opts.body); __reqs.push(body);
        return new Response(JSON.stringify({answers:Object.assign({emotion:{type:"choice",choice:"calm"},intensity:{type:"choice",choice:"mild"}},__ans)}),{status:200}); }
      return realFetch(url,opts); };
    window.__setup=()=>{
      const uni=state.universes[0];
      state.personas=[{id:"p_d",name:"Duygu",universeId:uni.id,personality:"Dry.",style:"x",goals:"x",look:{},
        goalsLive:{lines:["Get Emre to actually make that call to Ayça","Keep the beach day light"],day:4}}];
      const c=curChat(); Object.assign(c,{universeId:uni.id,presentIds:["p_d"],emo:{},gameDay:4,
        messages:[{mid:"u1",role:"user",content:'"Hallettim o işi, aradım Ayça\'yı."',speaker:"Emre"}]});
      Object.assign(state,{user:"Emre",key:"sk-test",emoOn:true,emoModel:"",emotions:null,gateAt:0.8,goalCheckOn:true,memJudgeOn:false,replyCheckOn:false,trackDecOn:false,gateOn:false,fragOn:false});
      try{ _emoBreak.until=0; _emoBreak.fails=0; }catch(e){}
      window.__reqs=[]; window.__ans={}; return c; };
  });

  const R=await pg.evaluate(async()=>{ const c=__setup(); const p=state.personas[0];
    __ans={goal_done_G1:{type:"noul",noul:0.92},goal_done_G2:{type:"noul",noul:0.1}};
    await emotionEnsure(c,p,"Hallettim o işi",{targetId:"__user__",targetName:"Emre"});
    const q=__reqs[0]||{questions:{},state:{}};
    return {keys:Object.keys(q.questions),g1:q.questions.goal_done_G1,st:q.state.their_goals,live:liveGoalsLines(p),raw:liveGoalsLines(p,{raw:true}),txt:liveGoalsText(p)}; });
  ok("each live goal is a yes/no in the reply's own request, with the goals in the state",
     R.keys.indexOf("emotion")>-1&&R.keys.indexOf("goal_done_G1")>-1&&R.keys.indexOf("goal_done_G2")>-1&&R.g1.type==="noul"
     &&/make that call to Ayça/.test(R.g1.instructions)&&/already done, settled or moot/.test(R.g1.instructions)&&/the call was made/.test(R.g1.criteria.true)
     &&JSON.stringify(R.st)==='["[G1] Get Emre to actually make that call to Ayça","[G2] Keep the beach day light"]', JSON.stringify(R));
  ok("a yes at 0.92 hides that goal from what the character carries; a no keeps the other",
     JSON.stringify(R.live)==='["Keep the beach day light"]'&&!/Ayça/.test(R.txt)&&R.raw.length===2, JSON.stringify(R));
  ok("below the gate (0.7 < 0.8) nothing is hidden", await pg.evaluate(async()=>{ const c=__setup(); const p=state.personas[0];
      __ans={goal_done_G1:{type:"noul",noul:0.7}}; await emotionEnsure(c,p,"x",{targetId:"__user__"}); return liveGoalsLines(p).length===2?true:JSON.stringify(liveGoalsLines(p)); }));
  ok("the curator's rewrite brings a fresh list (the done marks go with the old one)", await pg.evaluate(()=>{ const p=state.personas[0];
      p.goalsLive={lines:["Get Emre to actually make that call to Ayça","A new want"],day:5}; return liveGoalsLines(p).length===2?true:"still hidden"; }));
  ok("it never sends a request of its own: with nothing else to ask, no request", await pg.evaluate(async()=>{ const c=__setup(); const p=state.personas[0];
      state.emoOn=false; await emotionEnsure(c,p,"x",{targetId:"__user__"}); state.emoOn=true; return __reqs.length===0?true:"sent "+__reqs.length; }));
  ok("switched off: no goal questions", await pg.evaluate(async()=>{ const c=__setup(); const p=state.personas[0]; state.goalCheckOn=false;
      await emotionEnsure(c,p,"x",{targetId:"__user__"}); state.goalCheckOn=true; const q=(__reqs[0]||{questions:{}}).questions;
      return (q.emotion&&!q.goal_done_G1)?true:JSON.stringify(Object.keys(q)); }));
  ok("the switch round-trips through Settings, and the question is on the Emotion card", await pg.evaluate(()=>{ state.goalCheckOn=false; syncSettingsUI(); const box=document.getElementById('setGoalCheckOn');
      const a=box&&box.checked===false; box.checked=true; saveSettings(); const b=state.goalCheckOn===true&&store.raw(K.goalCheckOn,"")==="1";
      const card=X_PROMPT_CARDS.find(c=>c.keys.indexOf("x_goal_done")>-1); return (a&&b&&!!card)?true:JSON.stringify({a,b,card:!!card}); }));

  ok("no page errors", errs.length===0?true:errs.join(" | "));
  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close(); process.exit(fail?1:0);
})();
