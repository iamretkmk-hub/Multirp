/* v144.1 — QC report §4.2 / §4.3 (living world, intentions and motives). Checked with the model stubbed:
     - End Day tapped twice at once advances ONE day and starts ONE background run; a day that
       ended is not ended again by travelling on; trackers tick once;
     - a day end cut off by a reload resumes at the next stage;
     - a rumour planted at day end is stamped with the ENDED period and reaches the day-end former;
     - memsOfPeriod never hands a rumour to the period reconciler;
     - latent and removed characters never reach the motive former or tick prompts;
     - an armed plan is spent only when it actually surfaces, and waits out a private moment;
     - "Can" is not "Canan" (or "Ercan");
     - the world round drops somebody who joined the player during its call, and retries a failure;
     - the period engines never run side by side;
     - a failed calendar-executor call keeps the plan for a retry, then closes it as "didn't happen";
       an executor follow-up never involves the player;
     - gossip decays per universe and a cooled rumour is not called disproved;
     - hand-made drives resolve their target; placement follows the schedule per part of the day.
   Run: node tests/qc-living-world.browser.js */
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:process.env.SM_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage();
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file://'+require('path').resolve(__dirname,'..','index.html'));
  await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(600);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x||c).slice(0,700));} };

  /* A fresh world for every case. window.__reply maps a debug-label prefix to what the model
     "answers" (a value, an Error to throw, or a function); every prompt sent is kept by label. */
  const setup=()=>pg.evaluate(()=>{
    window.__calls=[]; window.__sent={}; window.__reply={};
    window.chatCompletion=async(m,mo,o)=>{ const d=(o&&o.dbg)||"?"; window.__calls.push(d);
      window.__sent[d]=(window.__sent[d]||"")+JSON.stringify(m);
      const k=Object.keys(window.__reply).find(p=>d.indexOf(p)===0);
      let r=k?window.__reply[k]:"{}";
      if(typeof r==="function")r=await r(d,m);
      if(r instanceof Error)throw r;
      return typeof r==="string"?r:JSON.stringify(r); };
    window.uiConfirm=async()=>true;
    const uni=state.universes[0]; state.curUniverse=uni.id;
    uni.locations=[{id:"l_home",name:"Home",description:"x",residents:["p_a"],sublocations:[]},
                   {id:"l_gym",name:"Gym",description:"x",residents:[],sublocations:[]},
                   {id:"l_cafe",name:"Cafe",description:"x",residents:[],sublocations:[]}];
    uni.gameData={}; uni.rules=[];
    const mk=(id,n,o)=>Object.assign({id,name:n,universeId:uni.id,personality:"x",instructions:"x",backstory:"x",style:"x",goals:"x",look:{}},o||{});
    state.personas=[mk("p_a","Ayla"),mk("p_b","Berk"),mk("p_c","Ceren",{latent:true}),mk("p_d","Deniz",{removed:true}),
                    mk("p_e","Ercan"),mk("p_n","Canan")];
    state.user="Emre"; state.key="k"; state.mem=true; state.intentOn=true; state.sceneOn=true; state.confrontOn=true;
    state.gossipOn=true; state.calOn=true; state.pulseOn=false; state.roundOn=true; state.charQuestsOn=false;
    state.goalPursuitOn=false; state.relOn=false; state.condenseOn=false; state.trackOn=false; state.heatOn=false;
    state.gmOn=false; state.promiseOn=false; state.travelTime=0; state.gossipDecay=0.2;
    state.memory=[]; state.gossip=[];
    const c=curChat(); c.universeId=uni.id; c.gameDay=5; c.period="Morning"; c.timeOfDay="Morning";
    c.locationId="l_home"; c.location="Home"; c.presentIds=[]; c.messages=[]; c.intents=[]; c.calendar=[];
    c.activeEvent=null; c.dnd=false; c.worldLog=[]; c.pulseBusy=null; c._roundAt=null; c._roundTry=null;
    c._dayEndDoneFor=null; c._trackersTickedFor=null; delete c.pendingDayEnd; delete c.pendingDayEnds; c.goalActed={}; c.goalAsked={};
    c.dayPlacement=null; c.worldPositions=null; c._wpKey=null; c.companionLock={}; c.leftBehind=null; c.dayLog=null;
    return true;
  });

  console.log("\n[End Day runs once per day]");
  await setup();
  const A=await pg.evaluate(async()=>{
    const c=curChat(); let bg=0, ticks=0;
    const realRun=window._endDayBackgroundRun, realTick=window.tickTrackersForDay;
    window._endDayBackgroundRun=async()=>{ bg++; };
    window.tickTrackersForDay=()=>{ ticks++; };
    window.__reply["Day transition narration"]=async()=>{ await new Promise(r=>setTimeout(r,150)); return "The day draws to a close."; };
    try{
      await Promise.all([endDay(),endDay()]);
      const afterTwo={day:c.gameDay,bg,ticks,markers:c.messages.filter(m=>m.dayMarker).length,done:c._dayEndDoneFor,pend:c.pendingDayEnds&&c.pendingDayEnds[5]&&c.pendingDayEnds[5].day};   // v146.1 — keyed by day
      // Travelling on is not a second day end for the day that already ended.
      _quietDayEnd(c,5,"Night");
      afterTwo.bgAfterQuiet=bg; afterTwo.markersAfterQuiet=c.messages.filter(m=>m.dayMarker).length;
      return afterTwo;
    } finally { window._endDayBackgroundRun=realRun; window.tickTrackersForDay=realTick; }
  });
  ok("two End Day taps advance the story ONE day", A.day===6 && A.markers===1, JSON.stringify(A));
  ok("and start ONE background run, marked done for that day and saved as pending", A.bg===1 && A.done===5 && A.pend===5, JSON.stringify(A));
  ok("the per-day trackers tick once", A.ticks===1, JSON.stringify(A));
  ok("a quiet day end for the same day does nothing", A.bgAfterQuiet===1 && A.markersAfterQuiet===1, JSON.stringify(A));
  ok("the done-for-day and tracker markers survive a save", await pg.evaluate(()=>{
      const sc=_slimChat({id:"x",messages:[],_dayEndDoneFor:5,_trackersTickedFor:6});
      return (sc._dayEndDoneFor===5&&sc._trackersTickedFor===6) ? true : JSON.stringify(sc); }));

  console.log("\n[a reload during the day end]");
  await setup();
  const R=await pg.evaluate(async()=>{
    const c=curChat(); c.gameDay=6;
    c.messages=[{mid:"a",role:"user",content:"hi"},{mid:"b",role:"assistant",speaker:"Ayla",speakerId:"p_a",content:"hello"},
                {mid:"m",role:"assistant",speaker:"Narrator",dayMarker:true,dayFrom:5,dayTo:6,content:"—"},
                {mid:"c",role:"user",content:"new day"}];
    c._dayEndDoneFor=5; c.pendingDayEnd={day:5,period:"Night",stage:7};   // gossip (stage 6) already ran — the v144.1 single slot, as an older save holds it
    const seen=[]; const names=["runGossipPropagation","maybeWorldPulse","runPeriodEngines","maybeProactiveText","runGoalsCurator","runUniverseChronicler","flushMemoryArc"];
    const real={}; names.forEach(n=>{ real[n]=window[n]; window[n]=async()=>{ seen.push(n); }; });
    let snap=null; const realBg=window.endDayBackground;
    window.endDayBackground=function(ch,d,u,s,fb,per,o){ snap={d,per,len:s.length,resume:!!(o&&o.resume)}; return realBg.apply(this,arguments); };
    try{
      const n=resumePendingDayEnds();
      await new Promise(r=>setTimeout(r,300));
      return {n,snap,seen,pend:(c.pendingDayEnds&&c.pendingDayEnds[5])||c.pendingDayEnd||null};
    } finally { names.forEach(k=>window[k]=real[k]); window.endDayBackground=realBg; }
  });
  ok("a pending day end is resumed with the ended day's own transcript", R.n===1 && R.snap && R.snap.d===5 && R.snap.per==="Night" && R.snap.len===2 && R.snap.resume, JSON.stringify(R));
  ok("from the stage it had reached — nothing before it runs again, the open arc is not flushed",
     !R.seen.includes("runGossipPropagation") && !R.seen.includes("flushMemoryArc") && R.seen.includes("maybeWorldPulse") && R.seen.includes("runUniverseChronicler"), JSON.stringify(R.seen));
  ok("and the marker is cleared when it finishes", R.pend===null, JSON.stringify(R.pend));
  ok("a running day end asks before the page is left", (()=>{
      const src=require('fs').readFileSync(require('path').resolve(__dirname,'..','index.html'),'utf8');
      return /addEventListener\('beforeunload'[\s\S]{0,200}chatBusy\(c,"dayEndBg"\)/.test(src) ? true : "no beforeunload guard"; })());

  console.log("\n[a rumour planted at day end becomes a motive]");
  await setup();
  const G=await pg.evaluate(async()=>{
    const c=curChat(); c.gameDay=6; c.period="Morning";           // the day has already advanced
    const a=state.personas.find(p=>p.id==="p_a"), bk=state.personas.find(p=>p.id==="p_b");
    a.relationships={p_b:{tie:"friend"}}; bk.relationships={p_a:{tie:"friend"}};
    state.memory=[{id:"o1",ownerId:"p_a",type:"OBSERVATION",content:"Emre was very close with a stranger at the bar.",
      charge:0.9,importance:0.6,gameDay:5,gamePeriod:"Night",universeId:c.universeId,chatId:c.id,date:Date.now()},
      // the same day number in ANOTHER chat of this universe is not this story's day
      {id:"o2",ownerId:"p_a",type:"OBSERVATION",content:"Something from another story.",charge:0.95,importance:0.6,
      gameDay:5,gamePeriod:"Night",universeId:c.universeId,chatId:"other_chat",date:Date.now()}];
    window.__reply["Gossip"]={spread:[{teller:"Ayla",recipient:"Berk",motive:"concern",
      rumor:"I heard Emre was getting close with a stranger at the bar — I don't know if it's true.",
      stakeholder:"Berk",about:["Emre"],suspicion_strength:0.7}]};
    await runGossipPropagation(c,5,c.universeId,"Night");
    const g=state.memory.find(m=>m.type==="GOSSIP");
    window.__reply["Intent form"]={intents:[]};
    await runIntentEngine(c,5,c.universeId,{period:"Night",tick:false});
    return {g:g?{day:g.gameDay,per:g.gamePeriod,owner:g.ownerId}:null, gossipCalls:window.__calls.filter(d=>/^Gossip/.test(d)).length,
            formed:window.__calls.includes("Intent form · Berk"), sent:window.__sent["Intent form · Berk"]||"",
            other:/another story/.test(window.__sent["Gossip · Ayla"]||"")};
  });
  ok("the rumour is filed under the day and period that ENDED", G.g && G.g.day===5 && G.g.per==="Night" && G.g.owner==="p_b", JSON.stringify(G.g));
  ok("the day-end former is asked about the carrier, with the rumour in front of it",
     G.formed && /stranger at the bar/.test(G.sent), JSON.stringify(G).slice(0,500));
  ok("another chat's day 5 does not feed this chat's gossip", G.gossipCalls===1 && !G.other, JSON.stringify(G).slice(0,300));

  console.log("\n[the period reconciler never swallows a rumour]");
  await setup();
  ok("memsOfPeriod excludes GOSSIP, ledger-linked and open-suspicion memories", await pg.evaluate(()=>{
      const base={ownerId:"p_a",gameDay:5,gamePeriod:"Morning",content:"x"};
      state.memory=[Object.assign({id:"e1",type:"EXPERIENCE"},base),Object.assign({id:"g1",type:"GOSSIP"},base),
                    Object.assign({id:"g2",type:"EXPERIENCE",gossipId:"g_1"},base),Object.assign({id:"g3",type:"EXPERIENCE",openSuspicion:true},base)];
      const ids=memsOfPeriod("p_a",5,"Morning").map(m=>m.id);
      return ids.join()==="e1" ? true : ids.join(); }));

  console.log("\n[latent and removed characters stay out of motives]");
  await setup();
  const L=await pg.evaluate(async()=>{
    const c=curChat();
    state.memory=[{id:"m1",ownerId:"p_a",type:"EXPERIENCE",content:"Berk mocked her in front of everyone.",importance:0.8,
      gameDay:5,gamePeriod:"Morning",universeId:c.universeId,chatId:c.id,date:Date.now()},
      {id:"d1",ownerId:"p_a",type:"DIARY",content:"Dear diary.",importance:0.9,gameDay:5,universeId:c.universeId,chatId:c.id,date:Date.now()},
      {id:"d2",ownerId:"p_b",type:"DIARY",content:"Dear diary, a quiet day.",importance:0.9,gameDay:5,universeId:c.universeId,chatId:c.id,date:Date.now()}];
    window.__reply["Intent form"]={intents:[{kind:"grievance",valence:"hostile",target:"Ceren",trigger:"x",aim:"a",strength:0.7},
                                           {kind:"grievance",valence:"hostile",target:"Deniz",trigger:"x",aim:"a",strength:0.7}]};
    await runIntentEngine(c,5,c.universeId,{period:"Morning",tick:false});
    const formSent=window.__sent["Intent form · Ayla"]||"";
    const made=c.intents.map(i=>i.targetId);
    c.intents=[{id:"t1",holderId:"p_a",holderName:"Ayla",targetId:"p_b",targetName:"Berk",kind:"grievance",valence:"hostile",
      aim:"a",trigger:"t",strength:0.6,priority:"medium",allies:[],status:"brewing",born:3,lastTick:4,fedDay:3}];
    window.__reply["Intent tick"]={intents:[{id:"t1",strength_delta:0,recruit:["Ceren","Deniz"]}]};
    await runIntentEngine(c,5,c.universeId,{period:"Night",tick:true});
    const tickSent=window.__sent["Intent tick · Ayla"]||"";
    const allies=c.intents[0].allies.slice();
    const tickCalls=window.__calls.filter(d=>/^Intent tick/.test(d)).length;
    await runIntentEngine(c,5,c.universeId,{period:"Night",tick:true});   // the same day again
    return {formLeak:/Ceren|Deniz/.test(formSent), made, tickLeak:/Ceren|Deniz/.test(tickSent), allies,
            diaryOnly:window.__calls.includes("Intent form · Berk"),
            tickCalls, tickCalls2:window.__calls.filter(d=>/^Intent tick/.test(d)).length};
  });
  ok("the former's roster names nobody latent or removed", L.formLeak===false, JSON.stringify(L));
  ok("and a motive aimed at them is not formed", L.made.length===0, JSON.stringify(L.made));
  ok("the tick's recruit candidates leave them out, and they cannot be recruited", L.tickLeak===false && L.allies.length===0, JSON.stringify(L));
  ok("a diary alone does not buy a former call", L.diaryOnly===false, JSON.stringify(L));
  ok("a day is ticked once — a second day end for it costs nothing", L.tickCalls===1 && L.tickCalls2===1, JSON.stringify(L));

  console.log("\n[armed plans surface honestly]");
  await setup();
  const S=await pg.evaluate(async()=>{
    const c=curChat(); c.messages=[{mid:"x",role:"user",content:"Let's grab a coffee."}];
    const mkIt=()=>({id:"a1",holderId:"p_a",holderName:"Ayla",targetId:"__user__",targetName:"Emre",kind:"grievance",valence:"hostile",
      aim:"make him answer",trigger:"t",strength:0.7,priority:"medium",allies:["p_c","p_b"],status:"armed",born:3,lastTick:4,
      plan:{method:"direct",approach:"",steps:[{phase:"strike",gate:{type:"none"},status:"pending"}],cursor:0,params:{},patience:0.5,expires:9,formedDay:4}});
    c.intents=[mkIt()];
    const realC=window.startConfrontation; let got=null;
    window.startConfrontation=(ch,o)=>{ got=o; return false; };
    const r1=checkArmedPlans(c); const st1=c.intents[0].status, fails=c.intents[0].surfaceFails;
    window.startConfrontation=(ch,o)=>{ got=o; return true; };
    const r2=checkArmedPlans(c); const st2=c.intents[0].status; const summary=got&&got.summary;
    // a private moment holds it
    c.intents=[mkIt()]; got=null;
    const realP=window.sceneIsPrivateMoment; window.sceneIsPrivateMoment=()=>true;
    const r3=checkArmedPlans(c); const st3=c.intents[0].status; const got3=got;
    state.memory=[{id:"s1",type:"GOSSIP",openSuspicion:true,suspicion:0.8,ownerId:"p_a",content:"x",universeId:c.universeId}];
    const conf=maybeSpawnConfrontation(c,c.universeId);
    window.sceneIsPrivateMoment=realP; window.startConfrontation=realC;
    return {r1,st1,fails,r2,st2,summary,r3,st3,got3,conf,used:!!state.memory[0]._confrontUsed};
  });
  ok("a plan that fails to surface stays armed (and counts the miss)", S.r1===false && S.st1==="armed" && S.fails===1, JSON.stringify(S));
  ok("it is spent when it does surface", S.r2===true && S.st2==="spent", JSON.stringify(S));
  ok("a latent ally is not named when it surfaces", !/Ceren/.test(S.summary||"") && /Berk/.test(S.summary||""), S.summary);
  ok("in a private moment nothing arrives and the plan keeps waiting", S.r3===false && S.st3==="armed" && S.got3===null, JSON.stringify(S));
  ok("nor does a day-end confrontation, and the suspicion is not consumed", S.conf===false && S.used===false, JSON.stringify(S));
  ok("a plan's target removed from play ends the plan", await pg.evaluate(()=>{
      const c=curChat(); c.intents=[{id:"z",holderId:"p_a",targetId:"p_d",targetName:"Deniz",kind:"grievance",valence:"hostile",aim:"a",strength:0.7,status:"armed",
        plan:{method:"direct",steps:[{phase:"strike",gate:{type:"none"},status:"pending"}],cursor:0,params:{},expires:9}}];
      checkArmedPlans(c); return c.intents[0].status==="spent" ? true : c.intents[0].status; }));

  console.log("\n[names are whole names]");
  await setup();
  const N=await pg.evaluate(()=>{
    const c=curChat(); const f=s=>_pulsePersonasByName(c,s).map(p=>p.name).join(",");
    const r={can:f("Can"), canan:f("Canan"), both:f("Ercan and Canan"), latent:f("Ceren")};
    state.personas.push({id:"p_can",name:"Can",universeId:c.universeId,personality:"x",look:{}});
    r.canExists=f("Can");
    c.calendar=[{id:"k1",title:"Gym",who:"Canan",day:5,period:"",done:false,withUser:false}];
    r.duePlanCan=_pulseHasDuePlan(c,state.personas.find(p=>p.id==="p_can"));
    r.duePlanCanan=_pulseHasDuePlan(c,state.personas.find(p=>p.id==="p_n"));
    return r;
  });
  ok("\"Can\" does not resolve to Canan or Ercan", N.can==="", JSON.stringify(N));
  ok("an exact name still resolves, lists split, latent people are nobody", N.canan==="Canan" && N.both==="Ercan,Canan" && N.latent==="", JSON.stringify(N));
  ok("with a real Can in the world, \"Can\" is Can", N.canExists==="Can", JSON.stringify(N));
  ok("a plan for Canan does not claim Can", N.duePlanCan===false && N.duePlanCanan===true, JSON.stringify(N));

  console.log("\n[the world round does not trust its own snapshot]");
  await setup();
  const W=await pg.evaluate(async()=>{
    const c=curChat(); c.worldPositions={p_a:"l_home",p_b:"l_cafe",p_e:"l_home",p_n:"l_home"}; c._wpKey="5|Morning";
    c.dayPlacement={day:5,period:"Morning",positions:Object.assign({},c.worldPositions)};
    let n=0;
    window.__reply["The day around you"]=async()=>{ n++;
      if(n===1)return "the provider timed out";
      c.presentIds.push("p_b");                                   // Berk walks into the player's scene meanwhile
      return {entries:[{who:["Ayla"],place:"Gym",headline:"Ayla trains",event:"e",memories:[{name:"Ayla",content:"I trained at the gym."}]},
                       {who:["Berk"],place:"Gym",headline:"Berk at the gym",event:"e",memories:[{name:"Berk",content:"I was at the gym with Hakan."}]}]}; };
    const r1=await runWorldRound(c,null); const at1=c._roundAt;
    const r2=await runWorldRound(c,null);
    const berkMem=state.memory.filter(m=>m.ownerId==="p_b"&&m.source==="world_pulse").length;
    const aylaMem=state.memory.filter(m=>m.ownerId==="p_a"&&m.source==="world_pulse");
    return {r1,at1,r2,at2:c._roundAt,berkMem,aylaPer:aylaMem[0]&&aylaMem[0].gamePeriod,berkPos:c.worldPositions.p_b,aylaPos:c.worldPositions.p_a,
            ties:/Ayla/.test(window.__sent["The day around you (whole-cast round)"]||"")};
  });
  ok("a failed round is tried again in the same part of the day", W.r1===0 && W.at1!=="5|Morning" && W.at2==="5|Morning", JSON.stringify(W));
  ok("somebody who joined the player during the call is left out: not moved, no memory of elsewhere",
     W.berkMem===0 && W.berkPos==="l_cafe", JSON.stringify(W));
  ok("everyone else's entry lands, filed under the period it was written for", W.r2===1 && W.aylaPos==="l_gym" && W.aylaPer==="Morning", JSON.stringify(W));
  ok("the round's ties are shared out across the whole cast", await pg.evaluate(()=>{
      const c=curChat(); c._roundAt=null; c._roundTry=null; c.presentIds=[]; c.pulseBusy=null;
      const uni=state.universes[0];
      for(let i=0;i<9;i++)state.personas.push({id:"px"+i,name:"Extra"+i,universeId:uni.id,personality:"x",look:{}});
      let sent=""; window.__reply["The day around you"]=async(d,m)=>{ sent=JSON.stringify(m); return {entries:[]}; };
      return runWorldRound(c,null).then(()=>{
        const who=state.personas.filter(p=>isActiveChar(p)).map(p=>p.name);
        const missing=who.filter(n=>!new RegExp(n+"\\\\u2192|"+n+"→").test(sent));
        return missing.length===0 ? true : "no ties for: "+missing.join(", "); }); }));

  console.log("\n[the period engines run one at a time]");
  await setup();
  const P=await pg.evaluate(async()=>{
    const c=curChat(); state.key="";
    let active=0, max=0, runs=0; const real=window.runFutureReconcile;
    window.runFutureReconcile=async()=>{ active++; runs++; max=Math.max(max,active); await new Promise(r=>setTimeout(r,60)); active--; };
    try{ await Promise.all([runPeriodEngines(c,5,"Morning"),runPeriodEngines(c,5,"Midday")]); }
    finally{ window.runFutureReconcile=real; }
    return {max,runs};
  });
  ok("two period changes queue instead of overlapping (and neither is dropped)", P.max===1 && P.runs===2, JSON.stringify(P));
  ok("goal pursuit asks each character once a day, whatever they answer", await pg.evaluate(async()=>{
      const c=curChat(); state.key="k"; state.pulseOn=true; state.goalPursuitOn=true;
      window.__calls=[]; window.__reply["World pulse (goal pursuit)"]={acted:false};
      await runGoalPursuit(c,5,state.universes[0],"Morning");
      const first=window.__calls.filter(d=>/goal pursuit/.test(d)).length;
      await runGoalPursuit(c,5,state.universes[0],"Midday");
      const second=window.__calls.filter(d=>/goal pursuit/.test(d)).length;
      return (first>0 && second===first) ? true : first+" then "+second; }));

  console.log("\n[the calendar executor]");
  await setup();
  const X=await pg.evaluate(async()=>{
    const c=curChat();
    const plan=()=>({id:"cx",kind:"meeting",title:"Coffee",who:"Ayla, Berk",charIds:["p_a","p_b"],day:5,period:"",done:false,withUser:false,source:"world"});
    c.calendar=[plan()];
    window.__reply["World pulse (calendar executor)"]="not json at all";
    await runCalendarExecutor(c,null);
    const e1={done:c.calendar[0].done,tries:c.calendar[0].execTries};
    // v146.1 — a transport failure is not a try (it used to close the plan here); a second unreadable answer is.
    window.__reply["World pulse (calendar executor)"]=Object.assign(new Error("offline"),{network:true});   // v147.2 — the shape chatCompletion throws for a network failure (a bare Error is our own bug, and counts)
    await runCalendarExecutor(c,null);
    const eT={done:c.calendar[0].done,tries:c.calendar[0].execTries};
    window.__reply["World pulse (calendar executor)"]="still not json";
    await runCalendarExecutor(c,null);
    const e2={done:c.calendar[0].done,outcome:c.calendar[0].outcome,result:c.calendar[0].result||"",eT};
    c.calendar=[plan()]; c.pulseBusy=null;
    window.__reply["World pulse (calendar executor)"]={headline:"Coffee",event:"They had coffee.",memories:[],rel:[],
      followup:{title:"Talk to Emre together",day:40,period:"Evening",who:"Ayla, Emre, Berk"}};
    await runCalendarExecutor(c,null);
    const f=c.calendar.find(e=>e.id!=="cx");
    return {e1,e2,ok:c.calendar[0].done&&c.calendar[0].result, f:f?{who:f.who,withUser:f.withUser,day:f.day,ex:f.executor}:null,
            userPlan:c.calendar.some(e=>e.id!=="cx"&&_planIncludesUser(e))};
  });
  ok("a failed call keeps the plan pending for a retry", X.e1.done===false && X.e1.tries===1, JSON.stringify(X));
  ok("a transport failure does not count as a try", X.e2.eT.done===false && X.e2.eT.tries===1, JSON.stringify(X));
  ok("after the second unreadable answer it closes as \"didn't happen\", not as lived", X.e2.done===true && X.e2.outcome==="missed" && X.e2.result==="", JSON.stringify(X));
  ok("a success closes it with its result", !!X.ok, JSON.stringify(X));
  ok("a follow-up naming the player is between the characters only, bounded to four days",
     X.f && X.f.withUser===false && !/Emre/.test(X.f.who) && X.f.day===9 && X.f.ex==="Ayla" && X.userPlan===false, JSON.stringify(X));

  console.log("\n[gossip lives and dies in its own universe]");
  await setup();
  const D=await pg.evaluate(()=>{
    const c=curChat(); const u=c.universeId;
    state.gossip=[{id:"g_a",universeId:u,text:"t",subject:["__user__"],stakeholderId:"p_a",carriers:[],heat:0.15,status:"open",day:1,raisedBy:{},memIds:["gm"]},
                  {id:"g_b",universeId:"other_uni",text:"t",subject:["__user__"],stakeholderId:"p_x",carriers:[],heat:0.15,status:"open",day:1,raisedBy:{},memIds:[]},
                  {id:"g_old",universeId:u,text:"t",subject:[],stakeholderId:"p_a",carriers:[],heat:0,status:"dead",day:1,resolvedDay:1,raisedBy:{},memIds:[]}];
    state.memory=[{id:"gm",type:"GOSSIP",gossipId:"g_a",ownerId:"p_a",content:"I heard Emre was out late.",openSuspicion:true}];
    decayGossip(20,u);
    const ga=gossipById("g_a"), gb=gossipById("g_b");
    return {a:ga&&ga.status, b:gb&&gb.status, bHeat:gb&&gb.heat, old:!!gossipById("g_old"), mem:state.memory[0].content, open:state.memory[0].openSuspicion};
  });
  ok("decay touches only the universe whose day ended", D.a==="dead" && D.b==="open" && D.bHeat===0.15, JSON.stringify(D));
  ok("a rumour that cooled is not called disproved", /^People stopped talking about this/.test(D.mem) && !/turned out to be nothing/.test(D.mem) && D.open===false, D.mem);
  ok("a long-closed rumour is pruned from the ledger", D.old===false, JSON.stringify(D));
  ok("a customised gossip prompt with no stakeholder does not make a bystander the stakeholder", await pg.evaluate(()=>{
      const a=state.personas.find(p=>p.id==="p_a"), bk=state.personas.find(p=>p.id==="p_b"), e=state.personas.find(p=>p.id==="p_e");
      a.relationships={}; bk.relationships={}; e.relationships={p_a:{tie:"husband"}};
      const s1=_gossipGuessStake(bk,["p_a"],state.personas,null);      // Berk is not tied to Ayla, Ercan is
      const s2=_gossipGuessStake(bk,["__user__"],state.personas,null);  // about the player: the recipient, as before
      return (s1==="p_e"&&s2==="p_b") ? true : s1+" / "+s2; }));
  ok("a planted rumour carries the talk, never the schemer's plan", await pg.evaluate(()=>{
      const c=curChat(); state.memory=[]; state.gossip=[];
      const a=state.personas.find(p=>p.id==="p_a"); a.relationships={p_e:{tie:"friend"},p_c:{tie:"friend"}};
      const it={id:"i9",holderId:"p_a",targetId:"p_b",kind:"scheme",strength:0.7,aim:"ruin him"};
      const id=plantDirectedRumor(c,it,state.personas,x=>(state.personas.find(p=>p.id===x)||{}).name,c.universeId,
        {rumor:"that he owes money all over town"},"wait until he is alone, then corner him",{day:5,period:"Evening"});
      const m=state.memory.find(x=>x.id===id)||{};
      return (m.ownerId==="p_e" && /owes money/.test(m.content) && !/corner him|ruin him/.test(m.content) && m.gamePeriod==="Evening")
        ? true : JSON.stringify(m); }));

  console.log("\n[hand-made drives, motives in the reply, placement]");
  await setup();
  const H=await pg.evaluate(()=>{
    const c=curChat(); const rt=window.toast; let said=""; window.toast=s=>{ said=String(s); };
    editIntent("p_a",null);
    const set=(id,v)=>{ document.getElementById(id).value=v; };
    set('ieTarget',"Nobodyhere"); set('ieAim',"x"); set('ieStatus',"armed");
    saveIntentEdit(); const refused=c.intents.length===0 && /Nobody called/.test(said);
    set('ieTarget',"Berk"); saveIntentEdit();
    const it=c.intents[0]||{};
    const m=document.getElementById('intentEditModal'); if(m)m.remove();
    window.toast=rt;
    return {refused, target:it.targetId, plan:!!(it.plan&&it.plan.steps&&it.plan.steps.length), c2c:it.c2c};
  });
  ok("a drive toward a name nobody has is refused, not aimed at the player", H.refused===true, JSON.stringify(H));
  ok("a drive armed by hand gets the plan it needs to fire", H.target==="p_b" && H.plan===true && H.c2c===true, JSON.stringify(H));
  ok("when the heaviest motive is already in the goal list, the next one reaches the reply", await pg.evaluate(()=>{
      const c=curChat(); c.presentIds=[];
      const a=state.personas.find(p=>p.id==="p_a"); a.goalsLive={lines:["make Berk take back what he said"],day:5};
      c.intents=[{id:"q1",holderId:"p_a",targetId:"p_b",targetName:"Berk",kind:"grievance",valence:"hostile",aim:"make Berk take back what he said",strength:0.9,status:"brewing"},
                 {id:"q2",holderId:"p_a",targetId:"__user__",targetName:"Emre",kind:"courtship",valence:"warm",aim:"win Emre over at the harbour",strength:0.5,status:"brewing"}];
      const w=intentParts(c,"p_a","__user__","Emre").quietWant;
      return (/harbour/.test(w) && !/take back/.test(w)) ? true : w; }));
  ok("placement follows the schedule through the day", await pg.evaluate(()=>{
      const c=curChat(); const a=state.personas.find(p=>p.id==="p_a");
      a.locations=["l_gym"]; a.schedule={Morning:{l_gym:50},Night:{l_home:50}};
      c.period="Morning"; c.dayPlacement=null; c.worldPositions=null; c._wpKey=null;
      /* the schedule alone decides here: who is with the player, who was left behind and who travels along all
         override it, and earlier steps in this file (or their background engines on a slow runner) can leave them set */
      c.presentIds=[]; c.leftBehind=null; c.companionLock={};
      const m=resolveWorldPositions(c).p_a;
      c.period="Night"; const n=resolveWorldPositions(c).p_a;
      c.period="Night"; c.presentIds=["p_a"]; c.locationId="l_cafe"; c.period="Evening";
      const kept=resolveWorldPositions(c).p_a;                      // with the player: stays with the player
      return (m==="l_gym"&&n==="l_home"&&kept==="l_cafe") ? true : [m,n,kept].join(" / ")+" | "+JSON.stringify({lb:c.leftBehind,lock:c.companionLock,loc:c.locationId}); }));

  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log(`\n  ${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail?1:0);
})();
