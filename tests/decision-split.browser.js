/* v150.87 — the reply's decisions go as one request per topic, sent together. The emotion pick, the reply's asks, the
   spoken limits, who is being talked about and the goals already done used to share one request over one state holding
   all of their material. Now each topic is its own request with the scene and only its own material; all are sent at
   once; a refusal or a failure loses that topic only; each topic pauses on its own. The one-request mode stays
   (Settings → Decisions → One request per topic OFF) and gives the same answers.
   Run: NODE_PATH=/path/to/node_modules node tests/decision-split.browser.js */
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:process.env.SM_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage({viewport:{width:412,height:915}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file://'+require('path').resolve(__dirname,'..','index.html')); await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(900);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x===undefined?c:x).slice(0,1200));} };

  await pg.evaluate(()=>{
    window.toast=()=>{};
    window.__setup=(split)=>{
      const uni=state.universes[0];
      state.personas=[{id:"p_o",name:"Özlem",universeId:uni.id,personality:"Cheerful.",goals:"Keep Berker out of it.",goalsLive:{lines:["Keep Berker out of it"],day:1},
        relationships:{p_h:{tie:"husband",relationship:"Berker is your husband."},p_s:{tie:"brother",relationship:"Sami is your brother."},__user__:{tie:"friend",relationship:"Emre is a friend."}}},
        {id:"p_h",name:"Berker",universeId:uni.id,personality:"Steady."},{id:"p_s",name:"Sami",universeId:uni.id,personality:"Loud."}];
      state.user="Emre"; state.key="sk-test"; state.fragments=null; state.emoOn=true; state.relOn=false; state.memory=[]; state.limitsOn=true; state.relScope="dynamic"; state.goalCheckOn=true;
      state.decSplit=split;
      store.setRaw(K.fragAdds,FRAG_SHIPPED_ADDS.map(a=>a.key).join(","));
      [_emoBreak,_askDecBreak,_limDecBreak,_relDecBreak,_goalDecBreak].forEach(br=>{ br.until=0; br.fails=0; });
      const c=curChat();
      Object.assign(c,{universeId:uni.id,presentIds:["p_o"],emo:{},feel:{},fsTurn:0,calendar:[],intents:[],rel:{},gameDay:4,period:"Afternoon",spokenLimits:{},spokenLimitsRead:{},
        messages:[{mid:"u1",role:"user",content:'"Did Berker call?"'},{mid:"a1",role:"assistant",speaker:"Özlem",speakerId:"p_o",content:'"Let us not talk about Berker. I will not go to the dinner tonight."'},
                  {mid:"u2",role:"user",content:'"Then stay a bit."'}]});
      return c; };
    /* a Decisions endpoint: answers every question after `delay` ms, recording each body and when it arrived;
       `mode(body)` can return {status,message} to fail one */
    window.__dec=(mode,delay)=>{ window.__bodies=[]; window.__at=[]; const rf=window.__realFetch||(window.__realFetch=window.fetch);
      window.fetch=async(u,o)=>{ if(String(u).indexOf("/api/alpha/decisions")<0)return rf(u,o);
        const body=JSON.parse(o.body); window.__bodies.push(body); window.__at.push(performance.now());
        if(delay)await new Promise(r=>setTimeout(r,delay));
        const m=mode?mode(body,window.__bodies.length):null;
        if(m&&m.status)return new Response(JSON.stringify({error:{message:m.message||"upstream"}}),{status:m.status});
        /* (!) v150.110 — CHANGED ON PURPOSE: the emotion topic is the feeling system's request now (f_ moves, s_ signals, e_ events,
           wronged, ego, masked — tests/feel-moment): desire rose a lot, nothing else moved or happened */
        const ans={}; Object.keys(body.questions).forEach(k=>{ ans[k]=k==="f_desire"?{choice:"rose_a_lot",probabilities:{rose_a_lot:0.9}}:/^f_|^fo_/.test(k)?{choice:"unchanged",probabilities:{unchanged:0.9}}
          :/^(s_|e_)|^masked$/.test(k)?{noul:0.05}:k==="wronged"?{choice:"nobody"}:k==="ego"?{choice:"id_winning",probabilities:{id_winning:0.9}}
          :/^limit_L/.test(k)?{choice:"limit_day",probabilities:{none:0.05,limit_day:0.9}}:{noul:0.93}; });
        return new Response(JSON.stringify({answers:ans}),{status:200}); }; };
    window.__undec=()=>{ if(window.__realFetch)window.fetch=window.__realFetch; };
    window.__run=async(split,mode,delay)=>{ const c=__setup(split), p=state.personas[0]; __dec(mode,delay); const t0=performance.now(); let out;
      try{ out=await emotionEnsure(c,p,"Then stay a bit.",{targetId:"__user__",targetName:"Emre",kind:"solo"}); } finally{ __undec(); }
      const pick=o=>o?{emotion:o.emotion,intensity:o.intensity,ego:o.ego,asks:o.asks,relAbout:o.relAbout}:null;
      return {out:pick(out),ms:performance.now()-t0,bodies:__bodies.map(x=>({q:Object.keys(x.questions),st:Object.keys(x.state),state:x.state})),at:__at.slice(),
        limits:JSON.stringify(c.spokenLimits||{}).replace(/"(id|at)":("[^"]*"|\d+),?/g,""),goalsDone:(p.goalsLive&&p.goalsLive.done)||[]}; };
  });

  const ONE=await pg.evaluate(()=>__run(false));
  const SPL=await pg.evaluate(()=>__run(true));
  const topic=q=>q.every(k=>/^(f_|fo_|s_|e_)|^(ego|masked|wronged)$/.test(k))?"emotion":q.every(k=>/^q_/.test(k))?"asks":q.every(k=>/^limit_/.test(k))?"limits":q.every(k=>/^goal_done_/.test(k))?"goals":q.every(k=>/^rel_/.test(k))?"relations":"mixed:"+q.join(",");
  const byTopic={}; SPL.bodies.forEach(x=>{ byTopic[topic(x.q)]=x; });
  ok("off: one request carrying every topic", ONE.bodies.length===1&&ONE.bodies[0].q.includes("ego")&&ONE.bodies[0].q.includes("f_desire")&&ONE.bodies[0].q.some(k=>/^q_/.test(k))&&ONE.bodies[0].q.some(k=>/^limit_/.test(k))&&ONE.bodies[0].q.some(k=>/^goal_done_/.test(k))&&ONE.bodies[0].q.some(k=>/^rel_/.test(k)), JSON.stringify(ONE.bodies.map(x=>x.q)));
  ok("on: one request per topic — emotion, asks, limits, who is talked about, goals", ["emotion","asks","limits","relations","goals"].every(t=>byTopic[t])&&SPL.bodies.length===5, JSON.stringify(SPL.bodies.map(x=>topic(x.q))));
  ok("…asking exactly the same questions between them", JSON.stringify(SPL.bodies.flatMap(x=>x.q).sort())===JSON.stringify(ONE.bodies[0].q.slice().sort()), JSON.stringify({one:ONE.bodies[0].q.length,split:SPL.bodies.flatMap(x=>x.q).length}));
  const has=(t,k)=>!!(byTopic[t]&&byTopic[t].st.includes(k));
  ok("each sees the scene and the character", Object.values(byTopic).every(x=>x.st.includes("scene")&&x.st.includes("character")), JSON.stringify(Object.fromEntries(Object.entries(byTopic).map(([k,v])=>[k,v.st]))));
  ok("the feelings request sees every layer and the stakes, not the goals, the limits or the absent people", has("emotion","toward")&&has("emotion","feelings_running_now")&&has("emotion","the_case_for_acting")
     &&!has("emotion","their_goals")&&!has("emotion","memories_bearing_on_goals")&&!has("emotion","their_new_lines")&&!has("emotion","people_they_know_who_are_not_here"), JSON.stringify(byTopic.emotion&&byTopic.emotion.st));
  ok("the asks keep the feelings and stakes they were written against, plus their own material", has("asks","toward")&&has("asks","feelings_running_now")&&!has("asks","their_goals")&&!has("asks","their_new_lines"), JSON.stringify(byTopic.asks&&byTopic.asks.st));
  ok("the limits, goal and who-is-talked-about checks see only the scene and their own material",
     has("limits","their_new_lines")&&!has("limits","toward_the_one_they_answer")&&has("goals","their_goals")&&!has("goals","toward_the_one_they_answer")&&!has("goals","their_new_lines")
     &&has("relations","people_they_know_who_are_not_here")&&!has("relations","their_goals"), JSON.stringify({l:byTopic.limits&&byTopic.limits.st,g:byTopic.goals&&byTopic.goals.st,r:byTopic.relations&&byTopic.relations.st}));
  ok("the same answers come out either way", JSON.stringify(SPL.out)===JSON.stringify(ONE.out)&&SPL.limits===ONE.limits&&JSON.stringify(SPL.goalsDone)===JSON.stringify(ONE.goalsDone)&&!!SPL.out&&SPL.out.emotion==="Desire",
     JSON.stringify({one:ONE.out,split:SPL.out,l1:ONE.limits,l2:SPL.limits,g1:ONE.goalsDone,g2:SPL.goalsDone}));

  const PAR=await pg.evaluate(()=>__run(true,null,300));
  ok("sent at the same time: the wait is the slowest one, not their sum", PAR.bodies.length===5&&(Math.max(...PAR.at)-Math.min(...PAR.at))<60&&PAR.ms<900, JSON.stringify({n:PAR.bodies.length,spread:Math.max(...PAR.at)-Math.min(...PAR.at),ms:PAR.ms}));

  const REF=await pg.evaluate(()=>__run(true,(body)=>(body.questions.f_desire&&!body.__seen)?{status:502,message:'OpenAI refused to answer question "f_desire"'}:null));
  const refT={}; REF.bodies.forEach(x=>{ const t=topic(x.q); refT[t]=(refT[t]||0)+1; });
  ok("a refused emotion question is retried inside its own topic only; every other topic answers first time", refT.asks===1&&refT.limits===1&&refT.goals===1&&refT.relations===1&&REF.bodies.filter(x=>x.q.includes("ego")).length===2
     &&REF.out&&REF.out.ego==="id_winning"&&Object.keys(REF.out.asks||{}).length>0, JSON.stringify({refT,out:REF.out}));

  const FL=await pg.evaluate(async()=>{ const r=await __run(true,(body)=>Object.keys(body.questions).some(k=>/^limit_/.test(k))?{status:500,message:"boom"}:null);
    return Object.assign(r,{fails:{emo:_emoBreak.fails,lim:_limDecBreak.fails,ask:_askDecBreak.fails}}); });
  ok("one topic failing loses that topic only, and counts toward its own pause", FL.out&&FL.out.emotion==="Desire"&&Object.keys(FL.out.asks).length>0&&!/Let us not talk/.test(FL.limits)&&FL.fails.lim===1&&FL.fails.emo===0&&FL.fails.ask===0, JSON.stringify({out:FL.out,limits:FL.limits,fails:FL.fails}));

  const PS=await pg.evaluate(async()=>{ const c=__setup(true), p=state.personas[0]; _emoBreak.until=Date.now()+60000; _emoBreak.key="sk-test"; __dec(null);
    let out; try{ out=await emotionEnsure(c,p,"Then stay a bit.",{targetId:"__user__",targetName:"Emre",kind:"solo"}); } finally{ __undec(); _emoBreak.until=0; }
    return {q:__bodies.map(x=>Object.keys(x.questions)),asks:out&&Object.keys(out.asks||{}).length}; });
  ok("a paused emotion pick does not stop the other topics", PS.q.length===4&&!PS.q.some(q=>q.includes("ego"))&&PS.asks>0, JSON.stringify(PS));

  const GO=await pg.evaluate(async()=>{ const c=__setup(true), p=state.personas[0];
    [_emoBreak,_askDecBreak,_limDecBreak,_relDecBreak].forEach(br=>{ br.until=Date.now()+60000; br.key="sk-test"; }); __dec(null);
    try{ await emotionEnsure(c,p,"Then stay a bit.",{targetId:"__user__",targetName:"Emre",kind:"solo"}); } finally{ __undec(); [_emoBreak,_askDecBreak,_limDecBreak,_relDecBreak].forEach(br=>{ br.until=0; }); }
    return __bodies.length; });
  ok("the goal check still only rides along: with every other topic paused, nothing is sent", GO===0, GO);

  const DB=await pg.evaluate(async()=>{ dbgLog.length=0; await __run(true); return dbgLog.map(e=>e.label+" ["+e.status+"]"); });
  ok("Debug: a summary row for the reply's decisions and one row per topic request", DB.some(l=>/^Reply decisions · Özlem · 5 requests at once \[ok\]/.test(l))&&["Feelings & ego","Reply asks","Spoken limits","Who is talked about","Goals done"].every(n=>DB.some(l=>l.startsWith(n+" · Özlem [ok]"))), JSON.stringify(DB));

  const UI=await pg.evaluate(()=>{ show('settings'); const e=document.getElementById('setDecSplit'); if(!e)return {box:false};
    state.decSplit=true; e.checked=false; saveSettings(false); const off=state.decSplit===false&&store.get(K.decSplit,true)===false;
    e.checked=true; saveSettings(false); const on=state.decSplit===true&&store.get(K.decSplit,false)===true;
    return {box:true,off,on,def:decSplitOn()}; });
  ok("Settings: the switch is saved both ways, and it is on by default", UI.box&&UI.off&&UI.on&&UI.def, JSON.stringify(UI));

  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close(); process.exit(fail?1:0);
})();
