/* v146.1 — QC report #2 §4.2 (living world and intents), checked with the model stubbed:
     - a day end resumed in the middle of its diaries stage writes no second diary, no second daily
       relationship read, and neglect drifts once a day;
     - two End Days back to back: each day's closing arc is filed under its own day (the next day's
       arc is never flushed under the older one), both are recorded per day, and both resume;
     - the period engines run in order and coalesce: a day end's pass is not overtaken by the next
       day's, queued runs of one day merge, and a late tick never touches a motive born the next day;
     - a background day end with another universe's chat open uses its own cast, places, setting
       and player;
     - another chat's same-day memories stay out of the period reconciler and the day's feeds;
     - the first-visit NPC seeder seeds the destination and puts its people there;
     - the world round leaves one "where I was" memory per person, day and place;
     - prep_done waits a full day; a latent holder's plan waits without blocking the others;
     - calendar-executor transport failures are not tries; "real ties first" sorts; the player's
       name is a whole name in a plan's participants.
   Run: node tests/qc2-living-world.browser.js */
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
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x||c).slice(0,900));} };

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
    const uni=state.universes[0]; state.curUniverse=uni.id; uni.userName="Emre"; uni.setting="A quiet harbour town called Liman.";
    uni.locations=[{id:"l_home",name:"Home",description:"x",residents:["p_a"],sublocations:[]},
                   {id:"l_gym",name:"Gym",description:"x",residents:[],sublocations:[]},
                   {id:"l_cafe",name:"Cafe",description:"x",residents:[],sublocations:[]}];
    uni.gameData={}; uni.rules=[];
    state.universes=state.universes.filter(u=>u.id!=="u_other");
    Object.keys(state.chats).forEach(id=>{ if(id==="chat_other")delete state.chats[id]; });
    const mk=(id,n,o)=>Object.assign({id,name:n,universeId:uni.id,personality:"x",instructions:"x",backstory:"x",style:"x",goals:"x",look:{}},o||{});
    state.personas=[mk("p_a","Ayla"),mk("p_b","Berk"),mk("p_c","Ceren",{latent:true}),mk("p_d","Deniz",{removed:true}),
                    mk("p_e","Ercan"),mk("p_n","Canan")];
    state.user="Emre"; state.key="k"; state.mem=true; state.intentOn=true; state.sceneOn=true; state.confrontOn=true;
    state.gossipOn=true; state.calOn=true; state.pulseOn=false; state.roundOn=true; state.charQuestsOn=false;
    state.goalPursuitOn=false; state.relOn=false; state.condenseOn=false; state.trackOn=false; state.heatOn=false;
    state.gmOn=false; state.promiseOn=false; state.travelTime=0; state.gossipDecay=0.2; state.npcSeedOn=false; state.textsOn=false;
    state.memory=[]; state.gossip=[];
    const c=curChat(); c.universeId=uni.id; c.gameDay=5; c.period="Morning"; c.timeOfDay="Morning";
    c.locationId="l_home"; c.location="Home"; c.presentIds=[]; c.messages=[]; c.intents=[]; c.calendar=[];
    c.activeEvent=null; c.dnd=false; c.worldLog=[]; c.pulseBusy=null; c._roundAt=null; c._roundTry=null;
    c._dayEndDoneFor=null; c._trackersTickedFor=null; delete c.pendingDayEnd; delete c.pendingDayEnds; c.goalActed={}; c.goalAsked={};
    c.dayPlacement=null; c.worldPositions=null; c._wpKey=null; c.companionLock={}; c.leftBehind=null; c.dayLog=null; c.memEvent=null;
    c.rel={}; c.neglectDay=null; c.memDoneIdx=-1;
    return true;
  });
  // A second universe with its own chat, opened by the player while this chat's background work runs.
  const openOther=()=>pg.evaluate(()=>{
    const u2={id:"u_other",name:"Other",userName:"Zed",setting:"A frozen northern fortress.",gameData:{},rules:[],
      locations:[{id:"l_fort",name:"Fortress",description:"x",residents:["p_z"],sublocations:[]}]};
    state.universes.push(u2);
    state.personas.push({id:"p_z",name:"Zeki",universeId:"u_other",personality:"x",look:{}});
    const c2={id:"chat_other",universeId:"u_other",messages:[],gameDay:1,period:"Morning",presentIds:[],intents:[],calendar:[]};
    state.chats[c2.id]=c2;
    window.__home=state.curChat; state.curChat=c2.id; state.curUniverse="u_other"; state.user="Zed";
  });
  const closeOther=()=>pg.evaluate(()=>{ state.curChat=window.__home; state.curUniverse=state.universes[0].id; state.user="Emre"; });

  console.log("\n[a day end resumed in the middle of its diaries stage]");
  await setup();
  const R=await pg.evaluate(async()=>{
    const c=curChat(); c.gameDay=6; state.relOn=true; window.__home=c.id;
    c.messages=[{mid:"a",role:"user",content:"hi"},{mid:"b",role:"assistant",speaker:"Ayla",speakerId:"p_a",content:"hello"},
                {mid:"b2",role:"assistant",speaker:"Berk",speakerId:"p_b",content:"yo"},
                {mid:"m",role:"assistant",speaker:"Narrator",dayMarker:true,dayFrom:5,dayTo:6,content:"—"}];
    state.memory=[{id:"x1",ownerId:"p_a",type:"EXPERIENCE",content:"Talked with Emre",gameDay:5,gamePeriod:"Night",universeId:c.universeId,chatId:c.id,importance:0.5},
                  {id:"x2",ownerId:"p_b",type:"EXPERIENCE",content:"Talked with Emre too",gameDay:5,gamePeriod:"Night",universeId:c.universeId,chatId:c.id,importance:0.5},
                  // Ayla's diary landed before the reload cut the stage off
                  {id:"dA",ownerId:"p_a",type:"DIARY",source:"diary",content:"Dear diary (first run)",gameDay:5,universeId:c.universeId,chatId:c.id}];
    // …and so did her daily read toward the player
    relObj(c,"p_a","__user__").dayEvalFor=5;
    c._dayEndDoneFor=5; c.pendingDayEnds={5:{day:5,period:"Night",stage:DAYEND_STAGES.indexOf("diaries")}};
    window.__reply["Diary"]={content:"Dear diary (resumed run)"};
    window.__reply["Daily relationship"]={trust:2,description:"You like him."};
    const n=resumePendingDayEnds();
    for(let i=0;i<60&&chatBusy(c,"dayEndBg");i++) await new Promise(r=>setTimeout(r,100));
    const diariesA=state.memory.filter(m=>m.type==="DIARY"&&m.ownerId==="p_a"&&m.gameDay===5).map(m=>m.content);
    const diariesB=state.memory.filter(m=>m.type==="DIARY"&&m.ownerId==="p_b"&&m.gameDay===5).length;
    const rel1=window.__calls.filter(d=>/^Daily relationship/.test(d));
    // the same stage cut off AGAIN and resumed again: nothing more is paid for
    c.pendingDayEnds={5:{day:5,period:"Night",stage:DAYEND_STAGES.indexOf("diaries")}};
    window.__calls.length=0;
    resumePendingDayEnds();
    for(let i=0;i<60&&chatBusy(c,"dayEndBg");i++) await new Promise(r=>setTimeout(r,100));
    const again={diary:window.__calls.filter(d=>/^Diary/.test(d)).length,rel:window.__calls.filter(d=>/^Daily relationship/.test(d)).length};
    // neglect: once a day, whatever calls it
    const o=relObj(c,"p_e","__user__"); o.affection=60; o.familiarity=60; o.lastSeenDay=1; o.neglectDays=0;
    c.neglectDay=null;
    runNeglectDrift(c,5,"Night"); const d1=o.neglectDays, aff1=o.affection;
    runNeglectDrift(c,5,"Night"); const d2=o.neglectDays, aff2=o.affection;
    const negMem=state.memory.find(m=>m.source==="neglect");
    return {n,diariesA,diariesB,rel1,again,d1,d2,aff1,aff2,negPer:negMem&&negMem.gamePeriod,pend:c.pendingDayEnds||null};
  });
  ok("the resumed stage does not write a second diary for someone who already has one", R.n===1 && R.diariesA.length===1 && R.diariesA[0]==="Dear diary (first run)", JSON.stringify(R));
  ok("…and still writes the one that was missing", R.diariesB===1, JSON.stringify(R));
  ok("a pair already read today is not read again (only Berk's reads run)", R.rel1.length>0 && !R.rel1.some(d=>/Ayla → Emre/.test(d)) && R.rel1.some(d=>/Berk → Emre/.test(d)), JSON.stringify(R.rel1));
  ok("resuming the same stage again pays for nothing", R.again.diary===0 && R.again.rel===0, JSON.stringify(R.again));
  ok("neglect drifts once per day", R.d1===1 && R.d2===1 && R.aff1===R.aff2, JSON.stringify(R));
  ok("the pending record is cleared when the day end finishes", R.pend===null, JSON.stringify(R.pend));

  console.log("\n[two End Days back to back]");
  await setup();
  const E=await pg.evaluate(async()=>{
    const c=curChat(); c.gameDay=5; window.__home=c.id;
    let release; const gate=new Promise(r=>release=r);
    window.__reply["Diary"]=async()=>{ await gate; return {content:"d"}; };
    const commits=[]; const realCommit=window.commitMemoryArc;
    window.commitMemoryArc=async(ch,s,e,d,p)=>{ commits.push({d,p,contents:ch.messages.slice(s,e+1).filter(m=>!m.dayMarker).map(m=>m.content).join("|")}); return {}; };
    try{
      c.messages=[{mid:"a",role:"user",content:"day5 hi"},{mid:"b",role:"assistant",speaker:"Ayla",speakerId:"p_a",content:"day5 hello"}];
      state.memory=[{id:"x1",ownerId:"p_a",type:"EXPERIENCE",content:"day5",gameDay:5,gamePeriod:"Morning",universeId:c.universeId,chatId:c.id}];
      c.memEvent={startIdx:0,open:true};
      await endDay();                                    // day 5 ends; its background blocks in the diary call
      await new Promise(r=>setTimeout(r,200));
      c.messages.push({mid:"c",role:"user",content:"day6 hi"},{mid:"d",role:"assistant",speaker:"Ayla",speakerId:"p_a",content:"day6 hello"});
      c.memEvent={startIdx:c.messages.length-2,open:true};
      await endDay();                                    // day 6 ends; its background queues behind day 5's
      const keys=Object.keys(c.pendingDayEnds||{}).sort().join();
      c.messages.push({mid:"e",role:"user",content:"day7 hi"},{mid:"f",role:"assistant",speaker:"Ayla",speakerId:"p_a",content:"day7 hello"});
      c.memEvent={startIdx:c.messages.length-2,open:true};
      await new Promise(r=>setTimeout(r,100));
      release();
      for(let i=0;i<80&&(chatBusy(c,"dayEndBg")||chatBusy(c,"periodEngines"));i++) await new Promise(r=>setTimeout(r,100));
      return {keys,commits,day:c.gameDay,openArc:!!(c.memEvent&&c.memEvent.open),pend:c.pendingDayEnds||null};
    } finally { window.commitMemoryArc=realCommit; }
  });
  ok("both day ends are recorded, one per day", E.keys==="5,6", JSON.stringify(E));
  ok("each closing arc is filed under its own day", E.commits.length===2 && E.commits[0].d===5 && E.commits[0].contents==="day5 hi|day5 hello" && E.commits[1].d===6 && E.commits[1].contents==="day6 hi|day6 hello", JSON.stringify(E.commits));
  ok("the next day's arc is never flushed under the older day — it stays open", !E.commits.some(x=>/day7/.test(x.contents)) && E.openArc===true, JSON.stringify(E));
  ok("both finish and clear their records", E.day===7 && E.pend===null, JSON.stringify(E));
  const RB=await pg.evaluate(()=>{
    const c=curChat(); const seen=[]; const real=window.endDayBackground;
    window.endDayBackground=function(ch,d,u,s,fb,per,o){ seen.push(d+":"+(o&&o.resume?"resume":"new")+":"+s.length); return Promise.resolve(); };
    try{
      c.messages=[{mid:"a",role:"user",content:"x"},{mid:"m5",dayMarker:true,dayFrom:5,dayTo:6,role:"assistant",content:"—"},
                  {mid:"b",role:"user",content:"y"},{mid:"b2",role:"user",content:"y2"},{mid:"m6",dayMarker:true,dayFrom:6,dayTo:7,role:"assistant",content:"—"}];
      c.gameDay=7; c.pendingDayEnds={6:{day:6,period:"Night",stage:2},5:{day:5,period:"Evening",stage:9}};
      return {n:resumePendingDayEnds(),seen};
    } finally { window.endDayBackground=real; }
  });
  ok("a reload resumes every pending day end, oldest first, each with its own transcript", RB.n===2 && RB.seen.join()==="5:resume:1,6:resume:2", JSON.stringify(RB));
  const RF=await pg.evaluate(async()=>{
    const c=curChat(); const commits=[]; const realCommit=window.commitMemoryArc;
    window.commitMemoryArc=async(ch,s,e,d,p)=>{ commits.push({d,p,contents:ch.messages.slice(s,e+1).filter(m=>!m.dayMarker).map(m=>m.content).join("|")}); return {}; };
    const names=["reconcileCalendarDay","reconcileQuestsForDay","writeDayDiaries","runGossipPropagation","maybeWorldPulse","runPeriodEngines","maybeProactiveText","runGoalsCurator","runUniverseChronicler"];
    const real={}; names.forEach(n=>{ real[n]=window[n]; window[n]=async()=>{}; });
    try{
      const run=async(startIdx)=>{ commits.length=0;
        c.messages=[{mid:"a",role:"user",content:"old hi"},{mid:"b",role:"assistant",speaker:"Ayla",speakerId:"p_a",content:"old hello"},
                    {mid:"m",role:"assistant",speaker:"Narrator",dayMarker:true,dayFrom:5,dayTo:6,content:"—"},
                    {mid:"c",role:"user",content:"new hi"},{mid:"d",role:"assistant",speaker:"Ayla",speakerId:"p_a",content:"new hello"}];
        c.gameDay=6; c._dayEndDoneFor=5; c.pendingDayEnds={5:{day:5,period:"Night",stage:0}}; c.memEvent={startIdx,open:true};
        resumePendingDayEnds();
        for(let i=0;i<40&&(chatBusy(c,"dayEndBg")||chatBusy(c,"memBuild"));i++) await new Promise(r=>setTimeout(r,50));
        return {commits:commits.slice(),open:!!(c.memEvent&&c.memEvent.open)}; };
      return {before:await run(0), after:await run(3)};
    } finally { window.commitMemoryArc=realCommit; names.forEach(n=>window[n]=real[n]); }
  });
  ok("a resume at stage 0 commits the ended day's open arc up to its marker, under that day", RF.before.commits.length===1 && RF.before.commits[0].d===5 && RF.before.commits[0].p==="Night" && RF.before.commits[0].contents==="old hi|old hello", JSON.stringify(RF));
  ok("…and leaves an arc that began after the marker open for the new day", RF.after.commits.length===0 && RF.after.open===true, JSON.stringify(RF));
  ok("dayEndPending answers per day, for the keyed record and an old single slot", await pg.evaluate(()=>{
      const c=curChat(); c.pendingDayEnds={5:{day:5,stage:2},6:{day:6,stage:0}};
      const a=[dayEndPending(c,5),dayEndPending(c,6),dayEndPending(c,7)];
      delete c.pendingDayEnds; c.pendingDayEnd={day:6,stage:1}; const b=[dayEndPending(c,6),dayEndPending(c,5)];
      delete c.pendingDayEnd; const z=dayEndPending(c,6);
      return (a.join()==="true,true,false"&&b.join()==="true,false"&&z===false)?true:JSON.stringify({a,b,z}); }));
  ok("an old single-slot record is still picked up", await pg.evaluate(()=>{
      const c=curChat(); delete c.pendingDayEnds; c.pendingDayEnd={day:6,period:"Night",stage:3};
      const m=_pendDayEnds(c); return (m[6]&&m[6].stage===3&&c.pendingDayEnd===undefined)?true:JSON.stringify(m); }));

  console.log("\n[the period engines: in order, coalesced, and never ticking tomorrow]");
  await setup();
  const P=await pg.evaluate(async()=>{
    const c=curChat(); state.travelTime=1; window.__home=c.id;
    const log=[]; const real=window._runPeriodEnginesNow;
    window._runPeriodEnginesNow=async(ch,day,per,u,o)=>{ log.push(day+"/"+[].concat(per).join("+")+(o&&o.dayEnd?"(dayEnd)":"")); await new Promise(r=>setTimeout(r,300)); };
    try{
      for(const d of ["l_gym","l_cafe","l_home","l_gym","l_cafe","l_home","l_gym"]){ await travelTo(d,[]); }
      for(let i=0;i<120&&(chatBusy(c,"periodEngines")||chatBusy(c,"dayEndBg"));i++) await new Promise(r=>setTimeout(r,100));
    } finally { window._runPeriodEnginesNow=real; }
    return {log,day:c.gameDay,period:c.period};
  });
  const d5end=P.log.findIndex(x=>/^5\/.*\(dayEnd\)$/.test(x)), d6=P.log.findIndex(x=>/^6\//.test(x));
  ok("seven quick trips queue far fewer than seven runs", P.log.length<=3, JSON.stringify(P));
  ok("the day end's pass runs before anything of the next day", d5end>=0 && d6>d5end, JSON.stringify(P.log));
  ok("the waiting stretches of the ended day are folded into its day-end pass, in order", /^5\/Midday\+Afternoon\+Evening\+Night\(dayEnd\)$/.test(P.log[d5end]||""), JSON.stringify(P.log));
  ok("two waiting stretches of one day are one run", P.log.filter(x=>/^6\//.test(x)).length===1 && /^6\/Morning\+Midday$/.test(P.log[d6]||""), JSON.stringify(P.log));
  await setup();
  const T=await pg.evaluate(async()=>{
    const c=curChat(); c.gameDay=6; c.period="Midday";
    c.intents=[{id:"n6",holderId:"p_a",holderName:"Ayla",targetId:"p_b",targetName:"Berk",kind:"grievance",valence:"hostile",aim:"a",trigger:"t",strength:0.7,priority:"medium",allies:[],status:"brewing",born:6,lastTick:6,fedDay:6},
               {id:"o4",holderId:"p_b",holderName:"Berk",targetId:"p_a",targetName:"Ayla",kind:"grievance",valence:"hostile",aim:"a",trigger:"t",strength:0.7,priority:"medium",allies:[],status:"brewing",born:3,lastTick:4,fedDay:3}];
    window.__reply["Intent tick"]={intents:[{id:"n6",strength_delta:0.1,ready:true},{id:"o4",strength_delta:0,ready:false}]};
    await runIntentEngine(c,5,c.universeId,{period:"Night",tick:true});   // day 5's pass, arriving late
    const n6=c.intents.find(i=>i.id==="n6"), o4=c.intents.find(i=>i.id==="o4");
    return {ticked:window.__calls.filter(d=>/^Intent tick/.test(d)),n6:{lastTick:n6.lastTick,status:n6.status},o4:{lastTick:o4.lastTick}};
  });
  ok("a late tick never touches a motive born the next day", !T.ticked.includes("Intent tick · Ayla") && T.n6.lastTick===6 && T.n6.status==="brewing", JSON.stringify(T));
  ok("…and still ticks the older ones, moving lastTick forward only", T.ticked.includes("Intent tick · Berk") && T.o4.lastTick===5, JSON.stringify(T));
  ok("a coalesced run hands the former every stretch it covers", await pg.evaluate(async()=>{
      const c=curChat(); c.intents=[];
      state.memory=[{id:"q1",ownerId:"p_a",type:"EXPERIENCE",content:"Berk mocked her.",importance:0.8,gameDay:5,gamePeriod:"Midday",universeId:c.universeId,chatId:c.id},
                    {id:"q2",ownerId:"p_b",type:"EXPERIENCE",content:"Ayla snubbed him.",importance:0.8,gameDay:5,gamePeriod:"Evening",universeId:c.universeId,chatId:c.id}];
      window.__calls.length=0; window.__reply["Intent form"]={intents:[]};
      await runIntentEngine(c,5,c.universeId,{period:["Midday","Evening"],tick:false});
      const f=window.__calls.filter(d=>/^Intent form/.test(d)).sort().join();
      return f==="Intent form · Ayla,Intent form · Berk" ? true : f; }));

  console.log("\n[a background day end with another universe's chat open]");
  await setup();
  await openOther();
  const U=await pg.evaluate(async()=>{
    const c=state.chats[window.__home]; state.relOn=true; state.pulseOn=true;
    // the round: this chat's places, setting and player
    c.worldPositions={p_a:"l_gym",p_b:"l_cafe",p_e:"l_home",p_n:"l_home"}; c._wpKey="5|Morning";
    c.dayPlacement={day:5,period:"Morning",positions:Object.assign({},c.worldPositions)};
    window.__reply["The day around you"]={entries:[{who:["Ayla"],place:"Cafe",headline:"Ayla has coffee",event:"e",kind:"ordinary",memories:[{name:"Ayla",content:"I had coffee alone."}]}]};
    const ran=await runWorldRound(c,null);
    const sent=window.__sent["The day around you (whole-cast round)"]||"";
    return {ran,aylaPos:c.worldPositions.p_a,
      prompt:{harbour:/harbour town/.test(sent),fortress:/frozen northern/.test(sent),gymName:/Ayla — at Gym/.test(sent),emre:/Emre/.test(sent),zed:/Zed/.test(sent)},
      home:personaHome(state.personas.find(p=>p.id==="p_a")), allowed:allowedLocs(state.personas.find(p=>p.id==="p_a")).join()};
  });
  await closeOther();
  // (runDailyRelationships / runNeglectDrift reading curCast(chat) is agent F's fix — covered by F's tests.)
  ok("the round names this chat's places, setting and player — not the open story's", U.ran===1 && U.aylaPos==="l_cafe" && U.prompt.harbour && !U.prompt.fortress && U.prompt.gymName && U.prompt.emre && !U.prompt.zed, JSON.stringify(U));
  ok("a character's home and places come from their own universe", U.home==="l_home" && U.allowed==="l_home", JSON.stringify(U));

  console.log("\n[another chat's day stays out]");
  await setup();
  const M=await pg.evaluate(async()=>{
    const c=curChat();
    const base=(id,chatId,content)=>({id,ownerId:"p_a",type:"EXPERIENCE",content,gameDay:5,gamePeriod:"Morning",universeId:c.universeId,chatId,importance:0.5});
    state.memory=[base("m1",c.id,"Mine one."),base("m2",c.id,"Mine two."),base("o1","chat_x","Theirs one."),base("o2","chat_x","Theirs two."),
                  Object.assign(base("n1",null,"Old, no chat."),{chatId:undefined})];
    const periodIds=memsOfPeriod("p_a",5,"Morning",c).map(m=>m.id).sort().join();
    const dayIds=memoriesForDay("p_a",5,c.universeId,c).map(m=>m.id).sort().join();
    const lines=_ownerDayMemories(state.personas.find(p=>p.id==="p_a"),5,c.universeId,{chat:c}).join("\n");
    window.__reply["Memory reconcile"]={memories:[{content:"Merged.",importance:0.5}]};
    await reconcilePeriodFor(state.personas.find(p=>p.id==="p_a"),5,"Morning",c);
    const left=state.memory.map(m=>m.id).filter(id=>/^o/.test(id)).sort().join();
    return {periodIds,left,dayIds,lines:{theirs:/Theirs/.test(lines),old:/Old, no chat/.test(lines)}};
  });
  ok("memsOfPeriod: this chat's fragments (and chat-less old ones), never another chat's", M.periodIds==="m1,m2,n1", JSON.stringify(M));
  ok("the reconciler leaves another chat's fragments alone", M.left==="o1,o2", JSON.stringify(M));
  ok("memoriesForDay and _ownerDayMemories are scoped the same way", !/o1|o2/.test(M.dayIds) && /n1/.test(M.dayIds) && !M.lines.theirs && M.lines.old, JSON.stringify(M));

  console.log("\n[the first-visit NPC seeder]");
  await setup();
  const S=await pg.evaluate(async()=>{
    const c=curChat(); state.npcSeedOn=true;
    window.__reply["Latent NPCs"]=[{name:"Vedat",role:"owner",personality:"gruff"}];
    await travelTo("l_gym",[]);
    for(let i=0;i<30&&!state.personas.some(p=>p.name==="Vedat");i++) await new Promise(r=>setTimeout(r,100));
    const u=universeById(c.universeId), v=state.personas.find(p=>p.name==="Vedat");
    return {seeded:u.locations.filter(l=>l.npcSeeded).map(l=>l.id).join(), resident:v?u.locations.filter(l=>(l.residents||[]).includes(v.id)).map(l=>l.id).join():"",
            pos:v&&c.worldPositions[v.id], present:!!(v&&c.presentIds.includes(v.id)), asked:Object.keys(window.__sent).filter(k=>/^Latent NPCs/.test(k)).join()};
  });
  ok("the destination is seeded, not the place being left", S.seeded==="l_gym" && S.asked==="Latent NPCs — Gym", JSON.stringify(S));
  ok("the seeded people live there, stand there, and are met on arrival", S.resident==="l_gym" && S.pos==="l_gym" && S.present===true, JSON.stringify(S));

  console.log("\n[one 'where I was' memory per person, day and place]");
  await setup();
  const WB=await pg.evaluate(async()=>{
    const c=curChat(); c.worldPositions={p_a:"l_gym",p_b:"l_cafe",p_e:"l_home",p_n:"l_home"};
    const round=async(per,ents)=>{ c.period=per; c._roundAt=null; c._roundTry=null; c.pulseBusy=null; c.dayPlacement=null; c._wpKey=null;
      window.__reply["The day around you"]={entries:ents}; await runWorldRound(c,null); };
    const home=(txt,kind)=>({who:["Ercan"],place:"Home",headline:"h",event:"e",kind:kind||"ordinary",memories:[{name:"Ercan",content:txt,importance:0.3}]});
    await round("Morning",[home("I spent time at home.")]);
    await round("Midday",[home("I spent time at home.")]);
    await round("Afternoon",[home("I fixed the kitchen tap.")]);
    await round("Evening",[home("Canan and I had a real fight about the money.","friction")]);
    const e=state.memory.filter(m=>m.ownerId==="p_e"&&m.source==="world_pulse");
    return {n:e.length, where:e.filter(m=>m.whereabouts).map(m=>m.content), other:e.filter(m=>!m.whereabouts).map(m=>m.content)};
  });
  // v147.2 — only a similar line with the same company folds; a different thing done there ("fixed the tap") is its own memory.
  ok("repeated ordinary entries at the same place fold into one record; a different one stays its own", WB.where.length===2 && (WB.where.join(" ").match(/spent time at home/g)||[]).length===1 && WB.where.some(w=>/^I fixed the kitchen tap\.$/.test(w)), JSON.stringify(WB));
  ok("an entry where something happened is still its own memory", WB.n===3 && WB.other.length===1 && /real fight/.test(WB.other[0]), JSON.stringify(WB));

  console.log("\n[intents: prep_done timing, latent plans]");
  await setup();
  const G=await pg.evaluate(()=>{
    const c=curChat();
    state.memory=[{id:"r1",ownerId:"p_b",type:"GOSSIP",content:"I heard...",gameDay:5,gamePeriod:"Night",universeId:c.universeId,chatId:c.id}];
    const plan={method:"undermine_first",steps:[{phase:"prep",status:"done",gate:{type:"none"}},{phase:"strike",gate:{type:"prep_done"},status:"pending"}],cursor:1,params:{spawnedRumorId:"r1"},formedDay:5};
    const at=(d,p)=>{ c.gameDay=d; c.period=p; return evaluateGate(c,plan,"__user__","p_a"); };
    return {sameNight:at(5,"Night"),nextMorning:at(6,"Morning"),nextEvening:at(6,"Evening"),nextNight:at(6,"Night"),dayAfter:at(7,"Morning")};
  });
  ok("a rumour sown at day end has not travelled by the next morning", G.sameNight===false && G.nextMorning===false && G.nextEvening===false, JSON.stringify(G));
  ok("…it has a day later, and after", G.nextNight===true && G.dayAfter===true, JSON.stringify(G));
  await setup();
  const L=await pg.evaluate(()=>{
    const c=curChat(); c.messages=[{mid:"x",role:"user",content:"hello"}];
    const mk=(id,h,s)=>({id,holderId:h,holderName:h,targetId:"__user__",targetName:"Emre",kind:"grievance",valence:"hostile",aim:"a",trigger:"t",strength:s,priority:"medium",allies:[],status:"armed",born:3,lastTick:4,
      plan:{method:"direct",approach:"",steps:[{phase:"strike",gate:{type:"none"},status:"pending"}],cursor:0,params:{},patience:0.5,expires:9,formedDay:4}});
    c.intents=[mk("lat","p_c",0.95),mk("ok","p_b",0.6)];
    const realC=window.startConfrontation; const fired=[];
    window.startConfrontation=(ch,o)=>{ fired.push(o.accuser.name); return true; };
    try{ const r=checkArmedPlans(c); const lat=c.intents.find(i=>i.id==="lat");
      return {r,fired,lat:{status:lat.status,fails:lat.surfaceFails||0},okStatus:c.intents.find(i=>i.id==="ok").status}; }
    finally{ window.startConfrontation=realC; }
  });
  ok("a latent holder's plan does not block the others: the next one fires at once", L.r===true && L.fired.join()==="Berk" && L.okStatus==="spent", JSON.stringify(L));
  ok("…and it waits: still armed, no miss counted", L.lat.status==="armed" && L.lat.fails===0, JSON.stringify(L));

  console.log("\n[the calendar executor, the round's ties, the player's name]");
  await setup();
  const X=await pg.evaluate(async()=>{
    const c=curChat();
    c.calendar=[{id:"cx",kind:"meeting",title:"Coffee",who:"Ayla, Berk",charIds:["p_a","p_b"],day:5,period:"",done:false,withUser:false,source:"world"}];
    window.__reply["World pulse (calendar executor)"]=Object.assign(new Error("timeout"),{friendly:"The model did not answer",timeout:true});
    for(let i=0;i<3;i++){ c.pulseBusy=null; await runCalendarExecutor(c,null); }
    return {done:c.calendar[0].done,tries:c.calendar[0].execTries||0,calls:window.__calls.filter(d=>/calendar executor/.test(d)).length};
  });
  ok("three transport failures: the plan is still waiting, no try counted", X.done===false && X.tries===0 && X.calls===3, JSON.stringify(X));
  ok("real ties come first in the round's payload", await pg.evaluate(async()=>{
      const c=curChat(); c.presentIds=[];
      const e=state.personas.find(p=>p.id==="p_e"); e.relationships={p_n:{tie:"cousin"}};
      let sent=""; window.__reply["The day around you"]=async(d,m)=>{ sent=JSON.stringify(m); return {entries:[]}; };
      await runWorldRound(c,null);
      const i=sent.indexOf("Ercan→Canan"), j=sent.search(/(Ayla|Berk|Canan)→/);
      return (i>=0&&j>=0&&i<j) ? true : "real tie at "+i+", first other at "+j; }));
  ok("the player's name is a whole name in a plan's participants", await pg.evaluate(()=>{
      const c=curChat(); state.user="Can"; state.universes[0].userName="Can";
      const r={canan:_planIncludesUser({who:"Canan"},c), ercan:_planIncludesUser({who:"Ercan, Ayla"},c), can:_planIncludesUser({who:"Can ve Ayla"},c),
               phrase:_planIncludesUser({who:"coffee with Can"},c), noChat:_planIncludesUser({who:"Canan"})};
      state.user="Emre"; state.universes[0].userName="Emre";
      return (!r.canan&&!r.ercan&&r.can&&r.phrase&&!r.noChat) ? true : JSON.stringify(r); }));
  ok("day end scores proactive texts on the ended day", (()=>{
      const src=require('fs').readFileSync(require('path').resolve(__dirname,'..','index.html'),'utf8');
      return /maybeProactiveText\(chat,\{(?:force:true,)?day\}\)/.test(src) && /runNeglectDrift\(chat,day,endPer\)/.test(src) ? true : "not passed"; })());

  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log(`\n  ${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail?1:0);
})();
