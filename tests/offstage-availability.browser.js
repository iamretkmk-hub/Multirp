/* v150.59 — WHO CAN BE WHERE. Reported (debug export 2026-10-07 21:39): Özlem was in the player's house — the
   scene, entries 57-78 — when the calendar executor resolved Burak's plan "Özlem'i kahveye tekrar çağır" at
   Vanadium Cafe and narrated "Özlem geldi"; the plan listed only Burak, so nothing checked the person it was
   about. Asked in the scene what she had done with Burak, Özlem had no trace of it (only Burak got a memory).
   Checked here, with the model stubbed and Math.random pinned:
     - a plan whose invitee is in the player's scene is postponed once (no call), then resolved without them,
       and the resolver is told where they really are;
     - the post-check drops a memory / rel line for somebody who could not be there, notes it on the debug
       entry, and rejects an answer that puts them in "present" (no popup with them in it);
     - while an offstage event is happening its participants are at its place on the map, and back on their
       schedule when that part of the day is over; someone in the player's scene is never moved by an event;
     - everyone the answer has present gets a memory and the day's whereabouts row, and either one's reply
       payload carries it;
     - the whole-cast round drops an entry naming somebody claimed by another event; a quest step whose
       target is with the player is told so and keeps no memory for them.
   Run: node tests/offstage-availability.browser.js */
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

  const setup=()=>pg.evaluate(()=>{
    Math.random=()=>0.42;
    window.__calls=[]; window.__sent={}; window.__reply={};
    window.chatCompletion=async(m,mo,o)=>{ const d=(o&&o.dbg)||"?"; window.__calls.push(d);
      const e=dbg(d,"stub","",{messages:m});
      window.__sent[d]=(window.__sent[d]||"")+JSON.stringify(m);
      const k=Object.keys(window.__reply).find(p=>d.indexOf(p)===0);
      let r=k?window.__reply[k]:"{}";
      if(typeof r==="function")r=await r(d,m);
      if(r instanceof Error)throw r;
      r=typeof r==="string"?r:JSON.stringify(r); dbgDone(e,"ok",r); return r; };
    window.uiConfirm=async()=>true;
    const uni=state.universes[0]; state.curUniverse=uni.id;
    uni.locations=[{id:"l_home",name:"Emre's House",description:"x",residents:[],sublocations:[]},
                   {id:"l_cafe",name:"Vanadium Cafe",description:"x",residents:[],sublocations:[]},
                   {id:"l_bu",name:"Atan's House",description:"x",residents:["p_bu"],sublocations:[]},
                   {id:"l_oz",name:"Big Özüçak's House",description:"x",residents:["p_oz"],sublocations:[]},
                   {id:"l_sa",name:"Small Özüçak's House",description:"x",residents:["p_sa"],sublocations:[]},
                   {id:"l_du",name:"Akbaba's House",description:"x",residents:["p_du"],sublocations:[]}];
    uni.gameData={charQuests:[]}; uni.rules=[];
    const mk=(id,n)=>({id,name:n,universeId:uni.id,personality:"x",instructions:"x",backstory:"x",style:"x",goals:"x",look:{}});
    state.personas=[mk("p_bu","Burak Atan"),mk("p_oz","Özlem Özüçak"),mk("p_sa","Sami Özüçak"),mk("p_du","Duygu Akbaba")];
    state.user="Emre Tokmak"; state.key="k"; state.mem=true; state.calOn=true; state.pulseOn=true; state.roundOn=true;
    state.charQuestsOn=true; state.goalPursuitOn=false; state.relOn=true; state.promiseOn=false; state.travelTime=0;
    state.memory=[]; state.gossip=[];
    const c=curChat(); c.universeId=uni.id; c.gameDay=5; c.period="Afternoon"; c.timeOfDay="Afternoon";
    c.locationId="l_home"; c.location="Emre's House"; c.presentIds=[]; c.messages=[]; c.intents=[]; c.calendar=[];
    c.activeEvent=null; c.dnd=false; c.worldLog=[]; c.pulseBusy=null; c._roundAt=null; c._roundTry=null; c.rel={};
    c.dayPlacement=null; c.worldPositions=null; c._wpKey=null; c.companionLock={}; c.leftBehind=null; c.dayLog=null;
    dbgLog.length=0;
    window.coffee=()=>({id:"c1",kind:"meeting",title:"Özlem'i kahveye tekrar çağır",who:"Burak Atan",executor:"Burak Atan",executorId:"p_bu",
      day:5,period:"Afternoon",locationId:"l_cafe",where:"Vanadium Cafe",withUser:false,source:"world",goalPlan:true,done:false,
      origin:"Burak Atan planned this on day 4 (Morning): to sit across from Özlem again"});
    return true;
  });

  console.log("\n[a plan whose invitee is with the player]");
  await setup();
  const P=await pg.evaluate(async()=>{
    const c=curChat(); c.presentIds=["p_oz"]; c.calendar=[coffee()];
    await runCalendarExecutor(c,null);
    const e=c.calendar[0];
    const first={calls:window.__calls.length,day:e.day,period:e.period,postponed:e.postponed,done:e.done};
    c.period="Evening"; c.timeOfDay="Evening";
    window.__reply["World pulse (calendar executor)"]={headline:"Burak bekledi",event:"Burak Vanadium'da bekledi; Özlem gelemeyeceğini yazdı.",
      present:["Burak Atan"],
      memories:[{name:"Burak Atan",content:"I waited at Vanadium Cafe and Özlem texted that she could not come.",emotion:"sad",importance:0.5},
                {name:"Özlem Özüçak",content:"I had coffee with Burak at Vanadium.",emotion:"content",importance:0.5}],
      rel:[{from:"Özlem Özüçak",to:"Burak Atan",affection:9},{from:"Burak Atan",to:"Özlem Özüçak",affection:-2}],followup:null};
    await runCalendarExecutor(c,null);
    const sent=window.__sent["World pulse (calendar executor)"]||"";
    const de=dbgLog.filter(x=>x.label==="World pulse (calendar executor)").pop();
    const ro=relPeek(c,"p_oz","p_bu");
    const ev=c.messages.filter(m=>m.worldEvent).pop();
    resolveWorldPositions(c);
    return {first,done:e.done,
      tells:/Özlem Özüçak is at Emre's House with Emre Tokmak/.test(sent)&&/Özlem Özüçak cannot be there in person/.test(sent),
      present:/Add \\?"present\\?" to your JSON/.test(sent),
      ozMem:state.memory.filter(m=>m.ownerId==="p_oz").map(m=>m.content),
      buMem:state.memory.filter(m=>m.ownerId==="p_bu").map(m=>m.content),
      notes:(de&&de.notes)||[], ozToBu:ro?(ro.affection||0):0,
      evWho:ev&&ev.whoIds, ozPos:c.worldPositions.p_oz, buPos:c.worldPositions.p_bu};
  });
  ok("the first check postpones it to the next part of the day, with no call", P.first.calls===0 && P.first.day===5 && P.first.period==="Evening" && P.first.postponed===1 && !P.first.done, JSON.stringify(P.first));
  ok("the second check resolves it, and the payload says where she is and that she cannot be there", P.done===true && P.tells && P.present, JSON.stringify(P));
  ok("the post-check drops her memory and keeps his", P.ozMem.length===0 && P.buMem.length===1, JSON.stringify(P));
  ok("and the rel line from her; both are noted on the debug entry",
     P.ozToBu===0 && P.notes.some(n=>/dropped a memory for Özlem Özüçak/.test(n)) && P.notes.some(n=>/dropped a rel line from Özlem Özüçak/.test(n)), JSON.stringify(P));
  ok("the popup is the checked event: only Burak is in it", JSON.stringify(P.evWho)===JSON.stringify(["p_bu"]), JSON.stringify(P.evWho));
  ok("she stays with the player on the map; he is at the cafe", P.ozPos==="l_home" && P.buPos==="l_cafe", JSON.stringify(P));

  console.log("\n[an answer that has her there anyway]");
  await setup();
  const R=await pg.evaluate(async()=>{
    const c=curChat(); c.presentIds=["p_oz"]; c.calendar=[Object.assign(coffee(),{postponed:1})];
    window.__reply["World pulse (calendar executor)"]={headline:"Kahve",event:"Burak, Özlem'i çağırdı ve Özlem geldi.",present:["Burak Atan","Özlem Özüçak"],
      memories:[{name:"Burak Atan",content:"Özlem came for coffee.",emotion:"content",importance:0.5}],rel:[],followup:null};
    await runCalendarExecutor(c,null);
    const e=c.calendar[0], de=dbgLog.filter(x=>x.label==="World pulse (calendar executor)").pop();
    return {done:e.done,tries:e.execTries,mem:state.memory.length,ev:c.messages.filter(m=>m.worldEvent).length,notes:(de&&de.notes)||[]};
  });
  ok("it is rejected: nothing lands, no popup, it counts as a try", R.done===false && R.tries===1 && R.mem===0 && R.ev===0, JSON.stringify(R));
  ok("and the rejection is on the debug entry", R.notes.some(n=>/rejected: "present" names Özlem Özüçak/.test(n)), JSON.stringify(R.notes));

  console.log("\n[during an event, on the map; everyone there remembers it]");
  await setup();
  const M=await pg.evaluate(async()=>{
    const c=curChat();
    c.calendar=[{id:"c3",kind:"meeting",title:"Duygu'ya bir kahve ısmarla",who:"Sami Özüçak",executor:"Sami Özüçak",executorId:"p_sa",
      day:5,period:"Afternoon",locationId:"l_cafe",where:"Vanadium Cafe",withUser:false,source:"world",done:false}];
    const before=Object.assign({},resolveWorldPositions(c));
    window.__reply["World pulse (calendar executor)"]={headline:"Sami ile Duygu buluştu",event:"Sami ile Duygu Vanadium'da kahve içti.",
      present:["Sami Özüçak","Duygu Akbaba"],
      memories:[{name:"Sami Özüçak",content:"I sat across from Duygu at Vanadium and asked her straight.",emotion:"content",importance:0.6},
                {name:"Duygu Akbaba",content:"Sami bought me a coffee at Vanadium and asked whether I had left a door open.",emotion:"tense",importance:0.6}],
      rel:[{from:"Duygu Akbaba",to:"Sami Özüçak",trust:3},{from:"Sami Özüçak",to:"Duygu Akbaba",affection:4}],followup:null};
    await runCalendarExecutor(c,null);
    const sent=window.__sent["World pulse (calendar executor)"]||"";
    const during=Object.assign({},resolveWorldPositions(c));
    const wbDu=whereaboutsToday(c,"p_du"), wbSa=whereaboutsToday(c,"p_sa");
    const memDu=state.memory.filter(m=>m.ownerId==="p_du"), memSa=state.memory.filter(m=>m.ownerId==="p_sa");
    const rDu=relPeek(c,"p_du","p_sa");
    c.period="Evening"; c.timeOfDay="Evening";
    const after=Object.assign({},resolveWorldPositions(c));
    const payload=id=>{ const p=state.personas.find(x=>x.id===id);
      const B=buildCharPromptBlocks(p,[],{recent:state.memory.filter(m=>m.ownerId===id),diary:[],longterm:[]},state.user,{chat:c,targetName:state.user,targetId:"__user__"});
      const T=buildTailBlocks({chat:c,selfP:p,selfId:p.id,selfName:p.name,targetName:state.user,targetId:"__user__",injected:{recent:[],diary:[],longterm:[]}});
      return JSON.stringify(B)+JSON.stringify(T); };
    const plDu=payload("p_du"), plSa=payload("p_sa");
    return {before,during,after,free:/Duygu Akbaba: free/.test(sent),
      wbDu:wbDu.map(r=>({p:r.period,place:r.place,with:r.with})), wbSa:wbSa.map(r=>({p:r.period,place:r.place,with:r.with})),
      memDu:memDu.length, memSa:memSa.length, rDu:rDu?(rDu.trust||0):0,
      plDu:/Vanadium Cafe/.test(plDu)&&/Sami Özüçak/.test(plDu)&&/Sami bought me a coffee/.test(plDu),
      plSa:/Vanadium Cafe/.test(plSa)&&/Duygu Akbaba/.test(plSa)&&/sat across from Duygu/.test(plSa)};
  });
  ok("before it resolves, the one making the plan is already at its place", M.before.p_sa==="l_cafe" && M.before.p_du==="l_du", JSON.stringify(M.before));
  ok("the person it is about is offered to the resolver as free", M.free, "");
  ok("while it is happening, everyone there is at the event's place", M.during.p_sa==="l_cafe" && M.during.p_du==="l_cafe", JSON.stringify(M.during));
  ok("when that part of the day is over, they go back to their schedule", M.after.p_sa==="l_sa" && M.after.p_du==="l_du", JSON.stringify(M.after));
  ok("both of them have their own memory of it", M.memDu===1 && M.memSa===1, JSON.stringify(M));
  ok("both have the day's whereabouts row at the cafe, with each other",
     M.wbDu.some(r=>r.p==="Afternoon"&&r.place==="Vanadium Cafe"&&r.with.includes("Sami Özüçak")) && M.wbSa.some(r=>r.p==="Afternoon"&&r.place==="Vanadium Cafe"&&r.with.includes("Duygu Akbaba")), JSON.stringify(M));
  ok("a rel line from the invitee who was there is applied", M.rDu===3, JSON.stringify(M));
  ok("either one's reply payload carries the event (places visited today + the memory)", M.plDu && M.plSa, JSON.stringify({plDu:M.plDu,plSa:M.plSa}));

  console.log("\n[the player's scene wins]");
  await setup();
  const S=await pg.evaluate(async()=>{
    const c=curChat(); c.presentIds=["p_oz"];
    c.calendar=[{id:"c4",kind:"meeting",title:"Kahve",who:"Burak Atan, Özlem Özüçak",executorId:"p_bu",executor:"Burak Atan",
      day:5,period:"Afternoon",locationId:"l_cafe",withUser:false,source:"world",done:false}];
    const pos=Object.assign({},resolveWorldPositions(c));
    const av=charAvailability(c,"p_oz");
    window.__reply["World pulse (calendar executor)"]={headline:"x",event:"Burak tek başına oturdu.",present:["Burak Atan"],memories:[],rel:[],followup:null};
    c.calendar[0].postponed=1;
    await runCalendarExecutor(c,null);
    const pos2=Object.assign({},resolveWorldPositions(c));
    // a round entry naming somebody who is at another event this part of the day is dropped whole
    c.calendar.push({id:"c5",kind:"meeting",title:"Yürüyüş",who:"Duygu Akbaba",executorId:"p_du",executor:"Duygu Akbaba",
      day:5,period:"Afternoon",locationId:"l_du",withUser:false,source:"world",done:false});
    window.__reply["The day around you"]={entries:[{who:["Sami Özüçak","Duygu Akbaba"],place:"Vanadium Cafe",headline:"Coffee",event:"They had coffee.",kind:"ordinary",
      memories:[{name:"Sami Özüçak",content:"I had coffee with Duygu.",emotion:"content",importance:0.3}],rel:[]}]};
    await runWorldRound(c,null);
    const de=dbgLog.filter(x=>x.label==="The day around you (whole-cast round)").pop();
    return {pos,av:av.kind,pos2,samiMem:state.memory.filter(m=>m.ownerId==="p_sa").length,roundSent:/Duygu Akbaba —/.test(window.__sent["The day around you (whole-cast round)"]||""),
      notes:(de&&de.notes)||[]};
  });
  ok("someone in the player's scene is with the player on the map, not at the event", S.pos.p_oz==="l_home" && S.pos.p_bu==="l_cafe" && S.av==="with_player", JSON.stringify(S));
  ok("and the event resolving does not move her", S.pos2.p_oz==="l_home", JSON.stringify(S.pos2));
  ok("the whole-cast round is not handed somebody claimed by another event, and drops an entry naming them",
     S.roundSent===false && S.samiMem===0 && S.notes.some(n=>/Duygu Akbaba cannot be there/.test(n)), JSON.stringify(S));

  console.log("\n[a quest step whose target is with the player]");
  await setup();
  const Q=await pg.evaluate(async()=>{
    const c=curChat(); c.presentIds=["p_oz"]; const uni=state.universes[0];
    uni.gameData.charQuests=[{id:"cq1",holderId:"p_bu",holderName:"Burak Atan",targetId:"p_oz",targetName:"Özlem Özüçak",title:"Win Özlem over",
      desc:"x",motive:"x",status:"active",createdDay:4,progress:[]}];
    window.__reply["Char quest (step)"]={moved:true,headline:"Mesaj",event:"Burak, Özlem'e mesaj attı.",note:"Burak texted Özlem.",outcome:"ongoing",
      memories:[{name:"Burak Atan",content:"I texted Özlem.",emotion:"neutral",importance:0.4},{name:"Özlem Özüçak",content:"Burak and I sat together at the cafe.",emotion:"content",importance:0.4}],
      rel:[{from:"Özlem Özüçak",to:"Burak Atan",affection:6}]};
    await runCharQuestPursuit(c,5,uni,"Afternoon");
    const sent=window.__sent["Char quest (step) · Burak Atan"]||"";
    const ro=relPeek(c,"p_oz","p_bu");
    return {told:/NOT AVAILABLE — Özlem Özüçak is at Emre's House with Emre Tokmak/.test(sent),
      oz:state.memory.filter(m=>m.ownerId==="p_oz").length, bu:state.memory.filter(m=>m.ownerId==="p_bu").length, rel:ro?(ro.affection||0):0};
  });
  ok("the step is told she is with the player and cannot be met in person", Q.told, JSON.stringify(Q));
  ok("and keeps no memory or rel line for her", Q.oz===0 && Q.bu===1 && Q.rel===0, JSON.stringify(Q));

  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log(`\n  ${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail?1:0);
})();
