/* v129.1 — THE LIVING WORLD MOVES AT EVERY CHANGE OF THE TIME OF DAY, NOT ONLY AT END DAY.
   Reported: "I don't see any payloads regarding character quests." The spawn only ran at End Day,
   read only the card's Goals field, could not form a first quest at the end of Day 1, and allowed
   one quest a day with three at most — all silently. Decided with the user: End Day keeps what
   touches the whole world (diaries, chronicle, gossip, reconcilers), and the one-character engines
   (goal pursuit, character quests, offstage tasks, new motives) run at every change of the time of
   day. Checked here with the model stubbed:
     - a change of the time of day asks a character who lived through something about a quest, a
       motive and a goal move — curated goals count, Day 1 counts;
     - no cap: two characters can each start a pursuit in the same stretch, and nobody is asked
       twice about the same stretch; somebody who lived through nothing is not asked;
     - motives fester at day end only; End Day still runs the engines for the last stretch;
     - travelling on past Night gets a real day end (marker + diaries) instead of nothing;
     - the reason nothing was born is shown on the Quests screen, which can also run the step;
     - promises carry no "given lightly" tier any more.
   Run: node tests/period-engines.browser.js */
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage();
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file://'+require('path').resolve(__dirname,'..','index.html'));
  await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(600);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x||c).slice(0,700));} };

  const setup=()=>pg.evaluate(()=>{
    window.__calls=[];
    window.chatCompletion=async(m,mo,o)=>{ const d=(o&&o.dbg)||"?"; window.__calls.push(d);
      if(/^Char quest \(spawn\) · (\S+)/.test(d)){ const who=d.split("· ")[1];
        return JSON.stringify({quest:{title:who+" settles a score",target:"Emre",desc:"d",motive:"m",ask:"help me",approach:"text",gate:{type:"any"},done_when:"it is settled"}}); }
      if(/^Diary/.test(d))return JSON.stringify({content:"A long day."});
      return "{}"; };
    const uni=state.universes[0]; state.curUniverse=uni.id;
    uni.gameData={}; uni.cqAsked={}; uni.cqLastSpawn=null;
    uni.locations=[{id:"l_home",name:"Home",description:"x",residents:[],sublocations:[]},{id:"l_far",name:"Far Town",description:"x",residents:[],sublocations:[],travelPeriods:1}];
    const mk=(id,n,goals,live)=>({id,name:n,universeId:uni.id,personality:"x",instructions:"x",goals,goalsLive:live?{lines:live,day:1}:undefined,look:{}});
    state.personas=[mk("p_a","Ayla","",["make Berk pay for what he said"]),mk("p_b","Berk","win the harbour contract",null),mk("p_c","Ceren","find her brother",null)];
    state.user="Emre"; state.key="k"; state.mem=true; state.charQuestsOn=true; state.pulseOn=true; state.goalPursuitOn=true;
    state.intentOn=true; state.calOn=false; state.promiseOn=false; state.gmOn=false; state.travelTime=0;
    const c=curChat(); c.universeId=uni.id; c.gameDay=1; c.period="Morning"; c.timeOfDay="Morning";
    c.locationId="l_home"; c.location="Home"; c.presentIds=[]; c.intents=[]; c.messages=[]; c.goalActed={}; c._intentSwingAsked={};
    const mem=(own,per,imp)=>({id:"m_"+Math.random().toString(36).slice(2),ownerId:own,content:"Berk mocked her in front of everyone.",
      type:"EXPERIENCE",importance:imp,gameDay:1,gamePeriod:per,universeId:uni.id,chatId:c.id,date:Date.now()});
    state.memory=[mem("p_a","Morning",0.8),mem("p_b","Morning",0.7)];   // Ceren lived through nothing
    return true;
  });
  const waitFor=(re,ms)=>pg.waitForFunction(r=>window.__calls.some(d=>new RegExp(r).test(d)),re,{timeout:ms||8000}).then(()=>true,()=>false);

  console.log("\n[a change of the time of day moves the living world]");
  await setup();
  await pg.evaluate(()=>{ advanceTime(curChat(),1); });
  const gotSpawn=await waitFor("^Char quest \\(spawn\\) · Berk");
  await pg.waitForTimeout(400);
  const A=await pg.evaluate(()=>({calls:window.__calls.slice(),qs:_charQuests(state.universes[0]).map(q=>q.holderName+"|"+q.createdPeriod)}));
  ok("Ayla, whose goals live only in the curated list, is asked about a quest on Day 1",
     A.calls.some(d=>d==="Char quest (spawn) · Ayla"), JSON.stringify(A.calls));
  ok("and so is Berk — no cap: both pursuits are born in the same stretch",
     gotSpawn && A.qs.length===2 && A.qs.every(x=>/\|Morning$/.test(x)), JSON.stringify(A));
  ok("Ceren lived through nothing this morning, so she is not asked for a quest or a motive",
     !A.calls.some(d=>/^(Char quest \(spawn\)|Intent form) · Ceren/.test(d)), JSON.stringify(A.calls));
  ok("(her offstage life still goes on — a goal move, once a day, as before)",
     A.calls.some(d=>d==="World pulse (goal pursuit) · Ceren"), JSON.stringify(A.calls));
  ok("a new motive is looked for in the same stretch", A.calls.some(d=>d==="Intent form · Ayla"), JSON.stringify(A.calls));
  ok("and a goal move", A.calls.some(d=>/^World pulse \(goal pursuit\)/.test(d)), JSON.stringify(A.calls));
  ok("motives do not fester mid-day", !A.calls.some(d=>/^Intent tick/.test(d)), JSON.stringify(A.calls));

  const B=await pg.evaluate(async()=>{ window.__calls=[]; const c=curChat();
    const n=await runCharQuestSpawn(c,1,state.universes[0],{period:"Morning"}); return {n,calls:window.__calls.slice()}; });
  ok("nobody is asked twice about the same stretch", B.n===0 && !B.calls.some(d=>/spawn/.test(d)), JSON.stringify(B));

  console.log("\n[day end]");
  const C=await pg.evaluate(async()=>{
    const c=curChat(); c.intents=[{id:"i1",holderId:"p_a",targetId:"p_b",kind:"grievance",valence:"hostile",aim:"x",strength:0.4,allies:[],status:"brewing",born:0,lastTick:0}];
    window.__calls=[]; const seen=[]; const real=window.runPeriodEngines;
    window.runPeriodEngines=async(ch,d,p,u,o)=>{ seen.push({d,p,dayEnd:!!(o&&o.dayEnd)}); return real(ch,d,p,u,o); };
    await endDayBackground(c,1,c.universeId,[],"Ayla","Night");
    window.runPeriodEngines=real;
    return {seen,calls:window.__calls.slice()};
  });
  ok("End Day runs the one-character engines for the last stretch of the day",
     C.seen.length===1 && C.seen[0].p==="Night" && C.seen[0].dayEnd===true, JSON.stringify(C.seen));
  ok("and motives fester there", C.calls.some(d=>/^Intent tick/.test(d)), JSON.stringify(C.calls));

  console.log("\n[travelling on past Night]");
  await setup();
  const D=await pg.evaluate(async()=>{
    const c=curChat(); c.period="Night"; c.timeOfDay="Night";
    state.memory.forEach(m=>m.gamePeriod="Night");
    c.messages=[{mid:"t1",role:"user",content:"let's go",gameDay:1},{mid:"t2",role:"assistant",speaker:"Ayla",speakerId:"p_a",content:"fine",gameDay:1}];
    let ran=null; const real=window.endDayBackground;
    window.endDayBackground=async(ch,d,u,snap,fb,per)=>{ ran={d,per,snap:snap.length}; };
    advanceTime(c,1);
    window.endDayBackground=real;
    const mk=c.messages.find(m=>m.dayMarker);
    return {day:c.gameDay,period:c.period,marker:mk?{from:mk.dayFrom,to:mk.dayTo}:null,ran};
  });
  ok("the day rolls with a day marker in the transcript",
     D.day===2 && D.period==="Morning" && D.marker && D.marker.from===1 && D.marker.to===2, JSON.stringify(D));
  ok("and the day end runs behind it, for Day 1, Night, with the day's messages",
     D.ran && D.ran.d===1 && D.ran.per==="Night" && D.ran.snap===2, JSON.stringify(D));

  console.log("\n[the Quests screen says why nothing was born]");
  await setup();
  const E=await pg.evaluate(async()=>{
    const uni=state.universes[0];
    state.memory=[];                                     // nobody lived through anything
    await runCharQuestSpawn(curChat(),1,uni,{period:"Morning"});
    openQuestsModal(); await new Promise(r=>setTimeout(r,200));
    const m=document.getElementById('questsModal'); const txt=m?m.textContent:"";
    const btn=m&&m.querySelector('#cqSpawnNow');
    const r={reason:(uni.cqLastSpawn||{}).reason||"",shown:/Last checked at the end of Day 1/.test(txt),btn:!!btn};
    state.memory=[{id:"mz",ownerId:"p_c",content:"x",type:"EXPERIENCE",importance:0.6,gameDay:1,gamePeriod:"Morning",universeId:uni.id}];
    window.__calls=[]; if(btn){ btn.click(); await new Promise(r=>setTimeout(r,500)); }
    r.clicked=window.__calls.slice(); r.qs=_charQuests(uni).map(q=>q.holderName);
    try{ _closeQuestsModal(); }catch(e){}
    return r;
  });
  ok("the reason is recorded", /nobody with goals lived through anything/.test(E.reason), JSON.stringify(E));
  ok("and shown on the Quests screen, with a button to look now", E.shown===true && E.btn===true, JSON.stringify(E));
  ok("the button runs the step", E.clicked.includes("Char quest (spawn) · Ceren") && E.qs.includes("Ceren"), JSON.stringify(E));

  console.log("\n[promises: the answer decides, and nothing is 'given lightly']");
  const F=await pg.evaluate(()=>{
    const t=up("promisePrompt")||"", c=curChat(); c.promises=[];
    const e=recordPromise(c,{holder:"Ayla",to:"Emre",promise:"you will not talk to Berk",kind:"prohibition",weight:"soft",shows_as:"the next time Berk calls her"},1);
    return {answer:/THE ANSWER DECIDES/.test(t),coffee:/make me a coffee/.test(t),weightField:/"weight"/.test(t),
      stored:e?("weight" in e):null, purge:/A SMALL REQUEST OR ONE-OFF FAVOUR/.test(up("promisePurge")||""), rules:PROMISE_PURGE_RULES};
  });
  ok("the extractor files only what the holder answered yes to", F.answer===true, JSON.stringify(F));
  ok("a small request is not a commitment", F.coffee===true, JSON.stringify(F));
  ok("there is no weight to file a trivial word under", F.weightField===false && F.stored===false, JSON.stringify(F));
  ok("and the stored ledger is audited again under the new rules", F.purge===true && F.rules===3, JSON.stringify(F));

  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log(`\n  ${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail?1:0);
})();
