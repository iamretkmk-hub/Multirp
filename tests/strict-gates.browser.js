/* v150.33 — STRICT GATES: promises, tasks, meetings, character quests and motives are filed only when real.
   Every future tense became a promise, every errand a task. Each NEW one is now put to the Decisions API as a
   yes/no question and filed only at the gate's certainty (0.8 by default). Checked here, with the endpoint and
   the chat calls stubbed:
     • future tracker: one gate request for the new agreed items; a promise or task that fails never reaches
       its writer and stays on the watch list; one that passes does; a meeting that passes reaches the calendar;
       updates, planning items and lines already read are not gated; the questions carry the item and its line
       and the state is the numbered conversation;
     • a failed gate request files as before (every writer runs);
     • character quests: a proposed pursuit the gate refuses is not filed, one it passes is;
     • motives: a proposed motive the gate refuses is not filed, one it passes is;
     • switch off: nothing is sent; strictness is the setting; the prompts are registry prompts on their card;
       settings round-trip and default on at 0.8.
   Run: node tests/strict-gates.browser.js */
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:process.env.SM_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage({viewport:{width:412,height:915}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file://'+require('path').resolve(__dirname,'..','index.html'));
  await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(800);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x||c).slice(0,700));} };

  await pg.evaluate(()=>{
    window.__reqs=[]; window.__mode="ok"; window.__calls=[];
    window.__p=q=>0.5;   // question text → probability of yes
    const realFetch=window.fetch;
    window.fetch=async(url,opts)=>{
      const u=String(url);
      if(u.indexOf("/api/alpha/decisions")>-1){
        const body=JSON.parse(opts.body); window.__reqs.push(body);
        if(window.__mode==="500") return new Response(JSON.stringify({error:{message:"upstream"}}),{status:500});
        const answers={}; Object.keys(body.questions).forEach(k=>{ answers[k]={type:"noul",noul:window.__p(body.questions[k].instructions)}; });
        return new Response(JSON.stringify({answers}),{status:200});
      }
      return realFetch(url,opts);
    };
    window.__out={};   // dbg label prefix → reply
    window.chatCompletion=async(msgs,model,opts)=>{ const d=(opts&&opts.dbg)||""; window.__calls.push(d);
      for(const k of Object.keys(window.__out)) if(d.indexOf(k)===0) return typeof window.__out[k]==="function"?window.__out[k](msgs):window.__out[k];
      return "{}"; };
    const uni=state.universes[0];
    state.personas=state.personas.filter(p=>p.id!=="p_b");
    state.personas.push({id:"p_b",name:"Burcu",universeId:uni.id,instructions:"x",personality:"Sharp.",backstory:"x",style:"x",goals:"Get the promotion at the clinic.",look:{}});
    const chat=curChat(); chat.presentIds=["p_b"]; chat.universeId=uni.id; state.curUniverse=uni.id; chat.gameDay=3;
    state.user="Emre"; state.key="sk-test"; state.calOn=true; state.promiseOn=true; state.charQuestsOn=true; state.intentOn=true; state.mem=true;
    state.gateOn=true; state.gateAt=0.8; state.gateModel=""; state.memJudgeOn=false; state.replyCheckOn=false; state.trackDecOn=false;
    chat._prPurged=PROMISE_PURGE_RULES;
    const L=(who,t)=>({mid:newMid(),role:who==="Emre"?"user":"assistant",speaker:who==="Emre"?undefined:who,speakerId:who==="Emre"?undefined:"p_b",content:t,present:["p_b"]});
    window.__L=L;
    window.__reset=()=>{ const c=curChat(); c.futureWatch=[]; c._ftReadMid=null; c._ftBusy=false; c._ftAgain=false; c.promises=[]; c.calendar=[];
      c.messages=[L("Emre","Akşam ne yapıyorsun?"),L("Burcu","Salata yapacağım. Mektubu da yarın postaneye götürürüm, söz."),L("Emre","Cuma akşamı yemeğe çıkalım mı?"),L("Burcu","Olur, cuma sekizde.")]; };
    window.__items=JSON.stringify({items:[
      {kind:"promise",action:"new",stage:"agreed",holder:"Burcu",about:"make a salad tonight",line:2},
      {kind:"task",action:"new",stage:"agreed",holder:"Burcu",about:"take the letter to the post office tomorrow",line:2},
      {kind:"meeting",action:"new",stage:"agreed",holder:"Burcu",about:"dinner with Emre on Friday at eight",line:4},
      {kind:"promise",action:"new",stage:"planning",holder:"Emre",about:"maybe call her",line:3}]});
  });

  console.log("\n[the future tracker's gate]");
  const f1=await pg.evaluate(async()=>{
    __reset(); window.__reqs=[]; window.__calls=[];
    window.__out={"Future tracker":__items,"Promises & commitments":'{"new":[],"updates":[]}',"Task writer":'{"task":null}',"Meetings tracker":"{}"};
    window.__p=q=>/salad/.test(q)?0.1:(/post office/.test(q)?0.9:(/Friday/.test(q)?0.95:0.5));
    await runFutureTracker(curChat());
    return {reqs:window.__reqs,calls:window.__calls,watch:curChat().futureWatch.map(w=>w.kind+":"+w.about)};
  });
  const gq=f1.reqs[0]?Object.values(f1.reqs[0].questions):[];
  ok("one gate request for the three new agreed items (the planning one is not asked)", f1.reqs.length===1&&gq.length===3, f1.reqs.length+" requests, "+gq.length+" questions");
  ok("the questions name the item and its line; promise/task/meeting each get their own prompt", gq.some(q=>/^Line #2 was noted as a PROMISE: Burcu — make a salad/.test(q.instructions))&&gq.some(q=>/^Line #2 was noted as a TASK for Burcu/.test(q.instructions))&&gq.some(q=>/^Line #4 was noted as a MEETING/.test(q.instructions)), JSON.stringify(gq.map(q=>q.instructions.slice(0,70))));
  ok("the YES/NO meanings are the criteria", gq.every(q=>q.type==="noul"&&q.criteria.true.length>20&&q.criteria.false.length>20), JSON.stringify(gq[0]));
  ok("the state is the numbered conversation", f1.reqs[0]&&/#2 Burcu: Salata/.test(f1.reqs[0].state)&&/\nNow: Day 3/.test(f1.reqs[0].state), JSON.stringify(f1.reqs[0]&&f1.reqs[0].state));
  ok("the salad 'promise' (10%) never reaches the promise writer", !f1.calls.some(d=>/^Promises & commitments/.test(d)), JSON.stringify(f1.calls));
  ok("…and stays on the watch list in case it is agreed later", f1.watch.some(w=>/^promise:make a salad/.test(w)), JSON.stringify(f1.watch));
  ok("the real task (90%) reaches the task writer", f1.calls.filter(d=>/^Task writer/.test(d)).length===1, JSON.stringify(f1.calls));
  ok("the agreed meeting (95%) reaches the calendar", f1.calls.some(d=>/^Meetings tracker/.test(d)), JSON.stringify(f1.calls));

  ok("the gate sees what is already on record, and each question says that is a NO", await pg.evaluate(async()=>{
      __reset(); const c=curChat(); c.calendar=[{id:"cal_dinner",kind:"meeting",title:"Dinner with Emre on Friday",who:"Emre",day:5,period:"Evening",done:false}];
      window.__reqs=[]; await runFutureTracker(c);
      const r=window.__reqs[0]; if(!r) return "no request";
      const q=Object.values(r.questions);
      return (/^ALREADY ON RECORD/.test(r.state)&&/\[cal_dinner\] MEETING: Dinner with Emre on Friday/.test(r.state)&&q.every(x=>/already on record/i.test(x.criteria.false))) ? true : JSON.stringify([r.state.slice(0,200),q[0].criteria.false.slice(0,80)]); }));
  ok("at strictness 0.95 the 90% task is refused too", await pg.evaluate(async()=>{
      __reset(); state.gateAt=0.95; window.__calls=[]; await runFutureTracker(curChat()); state.gateAt=0.8;
      return !window.__calls.some(d=>/^Task writer/.test(d))&&window.__calls.some(d=>/^Meetings tracker/.test(d)) ? true : JSON.stringify(window.__calls); }));
  ok("a failed gate request files as before: every writer runs", await pg.evaluate(async()=>{
      __reset(); window.__mode="500"; _gateBreak.until=0; _gateBreak.fails=0; window.__calls=[];
      await runFutureTracker(curChat()); window.__mode="ok"; _gateBreak.fails=0;
      const c=window.__calls; return (c.some(d=>/^Promises & commitments/.test(d))&&c.some(d=>/^Task writer/.test(d))&&c.some(d=>/^Meetings tracker/.test(d))) ? true : JSON.stringify(c); }));
  ok("updates to entries on record are not gated", await pg.evaluate(async()=>{
      __reset(); window.__reqs=[]; window.__calls=[];
      window.__out["Future tracker"]=JSON.stringify({items:[{kind:"task",action:"update",id:"cq_x",holder:"Burcu",about:"the letter",line:4}]});
      await runFutureTracker(curChat()); window.__out["Future tracker"]=__items;
      return window.__reqs.length===0 ? true : window.__reqs.length+" gate requests"; }));
  ok("switch off: nothing sent, every writer runs", await pg.evaluate(async()=>{
      __reset(); state.gateOn=false; window.__reqs=[]; window.__calls=[]; await runFutureTracker(curChat()); state.gateOn=true;
      const c=window.__calls; return (window.__reqs.length===0&&c.some(d=>/^Promises & commitments/.test(d))&&c.some(d=>/^Task writer/.test(d))) ? true : window.__reqs.length+" "+JSON.stringify(c); }));
  ok("the gate's request is a Debug row with each item's probability and whether it was filed", await pg.evaluate(()=>{
      const e=dbgLog.slice().reverse().find(x=>/^Strict gate — \d+ future item/.test(x.label||"")&&x.status==="ok");
      return (e&&Array.isArray(e.result.answers)&&e.result.answers.some(a=>a.filed===false&&a.p===0.1)) ? true : JSON.stringify(e&&e.result); }));

  console.log("\n[character quests]");
  const quest=JSON.stringify({quest:{title:"Win the clinic promotion",desc:"Make the case to the head doctor before Friday.",motive:"She was passed over today.",target:"",ask:"",done_when:"She is promoted.",gate:{type:"any"}}});
  const cq=async(prob)=>pg.evaluate(async(a)=>{
      const [prob,quest]=a; const uni=state.universes[0], c=curChat();
      uni.gameData=uni.gameData||{}; uni.gameData.charQuests=[]; uni.cqAsked={};
      state.memory=[{id:"mq1",ownerId:"p_b",universeId:uni.id,content:"I was passed over for the promotion today.",gameDay:3,gamePeriod:"Midday",importance:.8,type:"EXPERIENCE",people:[]}];
      window.__out={"Char quest (spawn)":quest}; window.__p=q=>prob; window.__reqs=[];
      await runCharQuestSpawn(c,3,uni,{period:"Midday"});
      const filed=(uni.gameData.charQuests||[]).filter(q=>q&&q.holderId==="p_b").map(q=>q.title);
      return {filed,reqs:window.__reqs.filter(r=>r.questions&&r.questions.g0).length,   // v150.79 — gate requests; a pursuit that passes is then weighed in a request of its own (tests/pursuit-weight)
             q:window.__reqs[0]&&Object.values(window.__reqs[0].questions)[0],st:window.__reqs[0]&&window.__reqs[0].state};
    },[prob,quest]);
  const q1=await cq(0.2), q2=await cq(0.9);
  ok("a pursuit the gate refuses (20%) is not filed", q1.reqs===1&&q1.filed.length===0, JSON.stringify(q1));
  ok("one it passes (90%) is filed", q2.reqs===1&&q2.filed.length===1&&q2.filed[0]==="Win the clinic promotion", JSON.stringify(q2));
  ok("the quest gate sees the pursuits already on record", /^ALREADY ON RECORD/.test(q2.st||"")&&/already on record/i.test(q1.q.criteria.false), JSON.stringify([String(q1.st).slice(0,120),q1.q&&q1.q.criteria.false.slice(0,80)]));
  ok("the quest question carries its title and detail", q1.q&&/Win the clinic promotion/.test(q1.q.instructions)&&/head doctor/.test(q1.q.instructions), JSON.stringify(q1.q));

  console.log("\n[motives]");
  const iv=async(prob)=>pg.evaluate(async(prob)=>{
      const c=curChat(); c.intents=[];
      state.memory=[{id:"mi1",ownerId:"p_b",universeId:state.curUniverse,content:"Emre laughed at me in front of Nil.",gameDay:3,gamePeriod:"Evening",importance:.8,type:"EXPERIENCE",people:["Emre"]}];
      window.__out={"Intent form":JSON.stringify({intents:[{kind:"grievance",valence:"hostile",target:"Emre",trigger:"he laughed at her",aim:"make him apologise in front of Nil",strength:0.6,priority:"medium"}],revise:[]})};
      window.__p=q=>prob; window.__reqs=[];
      await runIntentEngine(c,3,state.curUniverse,{tick:false,period:"Evening"});
      return {n:(c.intents||[]).length,reqs:window.__reqs.filter(r=>r.questions&&r.questions.g0).length,   // v150.79 — gate requests (see above)
             q:window.__reqs[0]&&Object.values(window.__reqs[0].questions)[0],st:window.__reqs[0]&&window.__reqs[0].state};
    },prob);
  const i1=await iv(0.3), i2=await iv(0.92);
  ok("a motive the gate refuses (30%) is not filed", i1.reqs===1&&i1.n===0, JSON.stringify(i1));
  ok("one it passes (92%) is filed", i2.reqs===1&&i2.n===1, JSON.stringify(i2));
  ok("the motive gate sees the motives already carried", /^MOTIVES Burcu ALREADY CARRIES/.test(i1.st||"")&&/already carries/i.test(i1.q.criteria.false), JSON.stringify([String(i1.st).slice(0,120)]));
  ok("the motive question carries kind, target and aim", i1.q&&/a grievance toward Emre/.test(i1.q.instructions)&&/apologise/.test(i1.q.instructions), JSON.stringify(i1.q));

  // v150.38 — limits are no longer gated after the drives writer: they are read, strictly, in the reply's
  // Decisions request (tests/spoken-limits.browser.js).

  console.log("\n[prompts and settings]");
  ok("the gate prompts (and the two spoken-limit questions) are registry prompts on the Strict gates card", await pg.evaluate(()=>{
      const keys=["x_gate_promise","x_gate_task","x_gate_meeting","x_gate_quest","x_gate_intent","x_limit_read","x_limit_release"];
      const card=ENGINE_PAYLOAD_DEFS.find(d=>d.key==="strict_gates");
      return (keys.every(k=>PROMPT_BY_KEY[k])&&card&&keys.every(k=>card.blocks.some(x=>x.promptKey===k))) ? true : "missing"; }));
  ok("settings round-trip; a fresh install has it on at 0.8", await pg.evaluate(()=>{
      state.gateOn=false; state.gateAt=0.9; state.gateModel="typesafe/jev-1.13"; syncSettingsUI();
      const on=document.getElementById('setGateOn'), at=document.getElementById('setGateAt'), mo=document.getElementById('setGateModel');
      if(!on||!at||!mo) return "inputs missing";
      if(on.checked||+at.value!==0.9||mo.value!=="typesafe/jev-1.13") return "sync";
      on.checked=true; at.value="2"; mo.value=""; saveSettings(false);
      if(state.gateOn!==true||state.gateAt!==0.99||state.gateModel!=="") return "save "+JSON.stringify([state.gateOn,state.gateAt,state.gateModel]);
      localStorage.removeItem(K.gateOn); localStorage.removeItem(K.gateAt); loadState();
      return (state.gateOn===true&&state.gateAt===0.8) ? true : "fresh: "+state.gateOn+" "+state.gateAt; }));

  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close();
  process.exit(fail?1:0);
})().catch(e=>{ console.error(e); process.exit(1); });
