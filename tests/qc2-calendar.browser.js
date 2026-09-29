/* v146.1 — QC report #2, calendar + promises + texts (out/QC-REPORT-v145.md §1 High #4, §4.3, and the
   end-to-end findings "world-engine plans filed without a period" / "missed meetings stay open for good").
   Each block is one finding, run against the app with a stubbed model:
     - End Day with a meeting in the CURRENT part of the day: the confirm and the roll-forward agree;
       the player is never listed as their own company; a meeting put off with "Later" is named and rolls;
     - the meeting dedupe reads the model's own period, an exact title on the same day, a neighbouring
       period on the names branch, and never treats the player as the shared person;
     - a meeting moved on purpose starts over (no silent lapse), and a lapse always posts a notice;
     - "UNKEPT … it stung" never reaches a character before the day end has settled the meeting;
     - promises: secrets/prohibitions never lapse, old saves are seeded, a corrected word is "seen";
     - _prSame on a 30+ pair fixture table (cast names, reordering, pronouns, Turkish negation);
     - a certain "they come to you" meeting asks Go home now / Later / Skip it;
     - the date parser fixture table (counts are not clock times, Turkish suffixed forms, "in a week");
     - tracker stamps use the turn's clock; world-engine plans get a period; unkept meetings close;
     - a group "who" ("Emre and Özlem Özüçak") files the real counterpart only, never the player.
   Run: node tests/qc2-calendar.browser.js */
const {chromium}=require('playwright');
const PARSER_TABLE=[
 ["meet at 10",null,"Morning"],["see you at 11",null,"Midday"],["at 10 tomorrow",11,"Morning"],["tomorrow at 11",11,"Midday"],
 ["tomorrow at 5",11,"Evening"],["tomorrow at 3",11,"Afternoon"],["dinner at 7",null,"Evening"],["dinner at 8 tomorrow",11,"Evening"],
 ["breakfast at 8",null,"Morning"],["lunch at 1",null,"Midday"],["lunch at 12",null,"Midday"],["at noon tomorrow",11,"Midday"],
 ["at 12 am",null,"Night"],["at 12 pm",null,"Midday"],["at 1 tonight",10,"Night"],["tonight at 9",10,"Night"],["tonight at 8",10,"Evening"],
 ["9pm",null,"Night"],["meet me at 7:30 pm",null,"Evening"],["at 6am tomorrow",11,"Morning"],["at 18:00",null,"Evening"],["at 07:30",null,"Morning"],
 ["3 days from now",13,null],["in 3 days",13,null],["in two days, in the morning",12,"Morning"],["the day after tomorrow at 10",12,"Morning"],
 ["next week",17,null],["on Friday",null,null],["this Friday evening",null,"Evening"],["this afternoon",10,"Afternoon"],["this morning at 9",10,"Morning"],
 ["at midnight",null,"Night"],["the festival lasts three days",null,null],["I'll be there around 4",null,"Afternoon"],["at 2 in the morning",null,"Night"],
 ["in the evening around 6",null,"Evening"],["we have 2 cats; meet tomorrow",11,null],["room 12 at the inn, tomorrow",11,null],
 ["saat 8'de",null,"Morning"],["sabah 7",null,"Morning"],["sabah 7'de",null,"Morning"],["yarın saat 10'da",11,"Morning"],["yarın sabah",11,"Morning"],
 ["yarın akşam 8'de",11,"Evening"],["akşam yemeği saat 7",null,"Evening"],["bu akşam",10,"Evening"],["bu gece saat 11'de",10,"Night"],["gece 12'de",null,"Night"],
 ["öğlen buluşalım",null,"Midday"],["öğleden sonra",null,"Afternoon"],["yarın öğleden sonra saat 3",11,"Afternoon"],["öbür gün",12,null],["üç gün sonra",13,null],
 ["3 gün sonra akşam",13,"Evening"],["haftaya",17,null],["cuma günü",null,null],["akşamüstü saat beş gibi",null,"Evening"],["saat beşte",null,"Evening"],
 ["saat dokuzda",null,"Morning"],["saat on birde",null,"Midday"],["gece saat ikide",null,"Night"],["yarın kahvaltıda",11,"Morning"],["şimdi gel",10,null],
 ["saat 14.30'da",null,"Afternoon"],
 ["akşama görüşürüz",null,"Evening"],["yarın akşama",11,"Evening"],["öğlene doğru",null,"Midday"],["sabaha karşı",null,"Morning"],["akşam yemeğinde",null,"Evening"],
 ["yarınki toplantı",11,null],["bu akşamki parti",10,"Evening"],["sabahleyin",null,"Morning"],["8 o'clock",null,"Morning"],["at 8 o'clock tonight",10,"Evening"],
 ["half past 7 in the evening",null,"Evening"],["saat sekizde",null,"Morning"],["saat yedi buçukta",null,"Morning"],["akşam saat sekizde",null,"Evening"],
 ["saat 8 buçukta",null,"Morning"],["at 10 tonight",10,"Night"],["tonight at 12",10,"Night"],["tomorrow morning at 11",11,"Midday"],["at 5 in the morning",null,"Night"],
 ["at 6",null,"Evening"],["at 7",null,"Morning"],["at 4",null,"Afternoon"],["there were about 20 guards",null,null],["around 5 minutes later",null,null],
 ["about 3 of us",null,null],["at 9 sharp",null,"Morning"],["at 9 in the evening",null,"Night"],["dinner tomorrow",11,"Evening"],["supper",null,"Evening"],
 ["brunch tomorrow",11,null],["after school",null,null],["later today",10,null],["later tonight",10,"Night"],["tomorrow night",11,"Night"],["yarın gece",11,"Night"],
 ["gece yarısı",null,"Night"],["two days from now",12,null],["2 days later",12,null],["iki gün içinde",12,null],["in a couple of days",null,null],
 ["in a week",17,null],["bir hafta sonra",17,null],["10 gün sonra",20,null],["next Friday",null,null],["this weekend",null,null],["hafta sonu",null,null],
 ["in 90 days",null,null],
 ["yarın akşama kadar",11,"Evening"],["akşamki yemek",null,"Evening"],["öğlene kadar gel",null,"Midday"],["sabahleyin erkenden",null,"Morning"],
 ["yarınki akşam yemeği",11,"Evening"],["around 5 minutes later we left",null,null],["there were about 20 guards at the gate",null,null],
 ["about 3 of us will come",null,null],["see you around 8 tonight",10,"Evening"],["about 9 tomorrow",11,"Morning"],["at 8 o'clock",null,"Morning"],
 ["in a week, in the evening",17,"Evening"],["a week from now",17,null],["bir hafta sonra akşam",17,"Evening"],["akşama saat 8'de",null,"Evening"],
 ["sabaha karşı saat 5",null,"Night"],["kahvaltıda saat 9",null,"Morning"]];
// [a, b, same promise?]
const PRSAME_TABLE=[
 ["You will not talk to Berk","You will not talk to Nil",false],
 ["You will not talk to Berk again","You won't talk to Berk anymore",true],
 ["You will not talk to Berk again","You won't speak to him again",true],
 ["You will never tell Hakan about the money","Don't tell Hakan about the money",true],
 ["Stop seeing Berk","You will not see Berk anymore",true],
 ["Keep away from Berk","Don't go near Berk",true],
 ["You will tell Hakan the truth","You will not tell Hakan the truth",false],
 ["Hakan'a gerçeği söyleyeceksin","Hakan'a gerçeği söylemeyeceksin",false],
 ["Hakan'a parayı söylemeyeceksin","Hakan'a parayı asla söylemeyeceksin",true],
 ["Berk'le bir daha konuşmayacaksın","Berk ile konuşmayacaksın artık",true],
 ["You will keep the secret about the Ring","You will keep the secret about the ring",true],
 ["You will meet me in Istanbul","You will meet me in Ankara",false],
 ["You will pay back the money by Friday","You will pay the money back",true],
 ["You will protect Aria","You will protect Aria and Nil",false],
 ["You will bring the medicine","You will bring the food",false],
 ["You will call me every night","You will call me every morning",false],
 ["You will come to the hearing","You will come to the wedding",false],
 ["Don't drink tonight","You won't drink tonight",true],
 ["You'll bring the medicine tomorrow","You'll bring me the medicine",true],
 ["You will call Berk tonight","You will not call Berk tonight",false],
 ["You will never tell Hakan about the money","You won't ever tell Hakan about the money",true],
 ["You promised to keep the secret from Duygu","You will keep the secret from Duygu",true],
 ["You will keep the secret","You will tell the secret",false],
 ["Berk'e yalan söylemeyeceksin","Berk'e yalan söyleyeceksin",false],
 ["Nil'e dokunma","Nil'e dokunmayacaksın",true],
 ["Nil'e dokunma","Nil'e dokunacaksın",false],
 ["Yarın Hakan'ı arayacaksın","Hakan'ı yarın arayacaksın",true],
 ["You can visit Ceren","You can visit Duygu",false],
 ["You will look after the kids","You will look after the children",true],
 ["Aria'ya her şeyi anlatacaksın","Aria'ya hiçbir şey anlatmayacaksın",false],
 ["You will not drink","You will not drink again",true],
 ["You will marry Can","You can marry Nil",false],
 ["Ceren'i korumayacaksın","Ceren'i koruyacaksın",false],
 ["You will wait for Duygu at the station","You'll wait at the station for Duygu",true]];
(async()=>{
  const b=await chromium.launch({executablePath:process.env.SM_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage({viewport:{width:412,height:915}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file://'+require('path').resolve(__dirname,'..','index.html'));
  await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(800);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x===undefined?c:x).slice(0,900));} };

  const setup=(o)=>pg.evaluate((o)=>{
    const uni=state.universes[0];
    uni.locations=Array.isArray(uni.locations)?uni.locations:[];
    [["l_cafe","Cafe Nero"],["l_park","City Park"],["l_home","Emre's Flat"]].forEach(([id,name])=>{
      if(!uni.locations.some(l=>l.id===id)) uni.locations.push({id,name,description:"",sublocations:[]}); });
    uni.playerHomeLocId="l_home";
    const mk=(id,name,uid)=>{ if(!state.personas.some(p=>p.id===id))
      state.personas.push({id,name,universeId:uid,instructions:"x",personality:"x",backstory:"x",style:"x",goals:"x",look:{}}); };
    mk("q_a","Aria",uni.id); mk("q_m","Mara",uni.id); mk("q_o","Özlem Özüçak",uni.id);
    [["q_b","Berk"],["q_n","Nil"],["q_h","Hakan"],["q_c","Ceren"],["q_d","Duygu"],["q_can","Can"]].forEach(([id,n])=>mk(id,n,uni.id));
    state.user="Emre"; state.key="test"; state.calOn=true; state.mem=true; state.textsOn=true; state.promiseOn=true;
    const chat=curChat();
    chat.universeId=uni.id; chat.gameDay=(o&&o.day)||5; chat.period=(o&&o.period)||"Afternoon"; chat.timeOfDay=chat.period;
    chat.presentIds=[]; chat.dnd=false; delete chat.activeEvent; chat.calendar=[]; chat.promises=[]; delete chat.pendingDayEnd;
    chat.locationId=(o&&o.loc)||"l_home"; chat.location=chat.locationId==="l_cafe"?"Cafe Nero":"Emre's Flat";
    chat.messages=[{mid:"s1",role:"user",content:"hello",present:[]}];
    state.memory=(state.memory||[]).filter(m=>!/^(unkept_meeting|calendar_noshow)$/.test(m.source||""));
    window.__asks=[]; window.__answer="go"; window.__calls=[]; window.__travel=null;
    window.uiChoose=async(msg,choices,op)=>{ window.__asks.push({msg,title:op&&op.title,choices:choices.map(c=>c.label)}); return window.__answer; };
    window.uiConfirm=async()=>true;
    window.chatCompletion=async(msgs,model,op)=>{ window.__calls.push({dbg:(op&&op.dbg)||"",msgs}); return window.__cc?window.__cc(msgs,op):""; };
    window.__cc=null;
    window.playCharacterTurn=async()=>{}; window.narrateCharMove=async()=>"";
    window.travelTo=async(id)=>{ window.__travel=id; const c=curChat(); c.locationId=id; };
    markChatDirty(chat);
  },o||{});
  const notices=()=>pg.evaluate(()=>curChat().messages.filter(m=>m.calNote).map(m=>m.content));

  console.log("\n[High #4 — End Day with a meeting in the CURRENT part of the day]");
  for(const per of ["Evening","Night"]){
    await setup({day:5,period:per});
    const r=await pg.evaluate((per)=>{
      const chat=curChat();
      chat.calendar=[{id:"m1",kind:"meeting",title:"Dinner",who:"Aria, Emre",charIds:["q_a"],withUser:true,executor:"user",locationId:"l_cafe",where:"Cafe Nero",day:5,period:per,done:false,certainty:"certain"}];
      const summary=calPendingTodaySummary(chat);
      chat.gameDay=6; chat.period="Morning";
      plantUnkeptMeetingMemories(chat,5,per);
      const e=chat.calendar[0];
      return {summary,day:e.day,period:e.period,done:e.done,mems:state.memory.filter(m=>m.source==="unkept_meeting").length};
    },per);
    ok(`${per} dinner, End Day at ${per}: the confirm says it moves to tomorrow, and it does`,
       /moves to tomorrow/.test(r.summary)&&r.day===6&&r.period===per&&!r.done&&r.mems===0, JSON.stringify(r));
    ok(`the confirm does not list the player as company ("with Aria", not "with Aria, Emre")`,
       /with Aria"/.test(r.summary)&&!/Emre/.test(r.summary), r.summary);
  }
  await setup({day:5,period:"Evening"});
  const snz=await pg.evaluate(async()=>{
    const chat=curChat(); chat.period="Midday"; window.__answer="later";
    chat.calendar=[{id:"m2",kind:"meeting",title:"Lunch at the cafe",who:"Aria, Emre",charIds:["q_a"],withUser:true,executor:"user",locationId:"l_cafe",where:"Cafe Nero",day:5,period:"Midday",done:false,certainty:"certain"},
                   {id:"m3",kind:"meeting",title:"Coffee with Mara",who:"Mara, Emre",charIds:["q_m"],withUser:true,executor:"user",day:5,period:"Morning",done:false,certainty:"certain"}];
    await resolveDueMeetings(chat);           // m3 (Morning) is found first: "Later"
    await resolveDueMeetings(chat);
    const s0=chat.calendar.map(e=>e.id+":"+(e.snoozedAt||""));
    chat.calendar[0].snoozedAt=5*10+1; delete chat.calendar[1].snoozedAt; delete chat.calendar[1].snoozes;   // lunch put off; coffee simply never resolved
    chat.period="Evening";
    const summary=calPendingTodaySummary(chat);
    chat.gameDay=6; chat.period="Morning"; plantUnkeptMeetingMemories(chat,5,"Evening");
    return {s0,summary,lunch:{day:chat.calendar[0].day,done:chat.calendar[0].done},
      mems:state.memory.filter(m=>m.source==="unkept_meeting").map(m=>m.ownerId)};
  });
  ok("a meeting put off with \"Later\" today is named in the confirm and rolls to tomorrow",
     /You still have "Lunch at the cafe with Aria" \(Midday\)/.test(snz.summary)&&snz.lunch.day===6&&!snz.lunch.done, JSON.stringify(snz));
  ok("one due earlier and never resolved is named as what ending the day makes of it — and is exactly that",
     /"Coffee with Mara" \(Morning\) was due earlier today.*counts it as missed/.test(snz.summary)&&snz.mems.join()==="q_m", JSON.stringify(snz));

  console.log("\n[meeting dedupe]");
  await setup({day:5,period:"Morning"});
  ok("a re-sent meeting with no period is the one already filed for Evening (dedupe before the default)", await pg.evaluate(async()=>{
    const chat=curChat();
    chat.calendar=[{id:"e1",kind:"meeting",title:"Meet Aria at Cafe Nero",who:"Aria, Emre",charIds:["q_a"],withUser:true,executor:"user",locationId:"l_cafe",where:"Cafe Nero",day:7,period:"Evening",done:false,certainty:"certain",source:"auto"}];
    window.__cc=()=>JSON.stringify({new:[{title:"Meet Aria at Cafe Nero",who:"Aria",executor:"user",dayOffset:2,where:"Cafe Nero"}]});
    await runCalendarEngine(chat,{});
    return chat.calendar.length===1 ? true : chat.calendar.map(e=>e.title+"|"+e.day+"|"+e.period).join("; "); }));
  ok("the tracker is shown each tracked meeting's part of the day", await pg.evaluate(()=>{
    const u=window.__calls.slice(-1)[0].msgs.slice(-1)[0].content; return /Meet Aria at Cafe Nero \(with Aria, Emre\) day 7 Evening/.test(u) ? true : u; }));
  await setup({day:5,period:"Morning"});
  ok("same person, same day, neighbouring period (Evening/Night) is one meeting on the names branch", await pg.evaluate(async()=>{
    const chat=curChat();
    chat.calendar=[{id:"e1",kind:"meeting",title:"Dinner with Aria",who:"Aria, Emre",charIds:["q_a"],withUser:true,executor:"user",day:6,period:"Evening",done:false,certainty:"certain",source:"auto"}];
    window.__cc=()=>JSON.stringify({new:[{title:"Have dinner together",who:"Aria",executor:"Aria",dayOffset:1,period:"Night"}]});
    await runCalendarEngine(chat,{});
    return chat.calendar.length===1 ? true : chat.calendar.map(e=>e.title+"|"+e.day+"|"+e.period).join("; "); }));
  // v147.2 — the exact title respects the time now (QC report #3 §3.3): Morning vs Evening are two, a neighbour or no time is one.
  ok("an exact title on the same day is a duplicate at about the same time (or with no time of its own)", await pg.evaluate(()=>{
    const cal=[{id:"x",title:"Talk to Aria",who:"Aria",day:6,period:"Morning"}], D=p=>_calIsDup(cal,{title:"talk to aria",who:"Aria",day:6,period:p},{chat:curChat()});
    return (D("Midday")===true&&D(null)===true&&D("Evening")===false) ? true : JSON.stringify([D("Midday"),D(null),D("Evening")]); }));
  ok("the player is not the shared person: dinner with Aria and drinks with Mara, same evening, are both filed", await pg.evaluate(async()=>{
    const chat=curChat();
    chat.calendar=[{id:"e1",kind:"meeting",title:"Dinner with Aria",who:"Aria, Emre",charIds:["q_a"],withUser:true,executor:"user",day:6,period:"Evening",done:false,certainty:"certain",source:"auto"}];
    window.__cc=()=>JSON.stringify({new:[{title:"Drinks with Mara",who:"Mara, Emre",executor:"user",dayOffset:1,period:"Evening"}]});
    await runCalendarEngine(chat,{});
    return chat.calendar.length===2 ? true : chat.calendar.map(e=>e.title).join("; "); }));
  ok("lunch and dinner with the same person the same day stay two meetings", await pg.evaluate(()=>{
    const cal=[{id:"x",title:"Lunch with Aria",who:"Aria, Emre",day:6,period:"Midday"}];
    return _calIsDup(cal,{title:"Dinner with Aria",who:"Aria, Emre",day:6,period:"Evening"},{chat:curChat()})===false ? true : "merged"; }));

  console.log("\n[a group 'who' — the counterpart only, never the player as a character]");
  await setup({day:5,period:"Morning"});
  const grp=await pg.evaluate(async()=>{
    const chat=curChat(); const n0=state.personas.length;
    window.__cc=()=>JSON.stringify({new:[{title:"Dinner at the old harbour",who:"Emre and Özlem Özüçak",executor:"user",dayOffset:1,period:"Evening",where:"the old harbour"}]});
    await runCalendarEngine(chat,{});
    const e=chat.calendar[0]||{};
    bindPendingTasks(chat);
    return {n:chat.calendar.length,charIds:e.charIds,charId:e.charId,character:e.character,charName:e.charName,who:e.who,withUser:e.withUser,
      minted:state.personas.length-n0,counterpart:(meetingCounterpart(chat,e)||{}).id};
  });
  ok("stored with the real counterpart's id", grp.n===1&&JSON.stringify(grp.charIds)==='["q_o"]'&&grp.charId==="q_o"&&grp.counterpart==="q_o", JSON.stringify(grp));
  ok("character/charName are the counterpart alone — no player name", grp.character==="Özlem Özüçak"&&grp.charName==="Özlem Özüçak", JSON.stringify(grp));
  ok("it is a meeting with the player, and the binder mints nobody", grp.withUser===true&&/Emre/.test(grp.who)&&grp.minted===0, JSON.stringify(grp));
  ok("a tracker change of 'who' to a group keeps the player out of character/charName", await pg.evaluate(()=>{
    const chat=curChat(); const e=chat.calendar[0];
    _ftEntry(chat,"meeting",e.id).apply({who:"Emre ve Aria"});
    return (e.character==="Aria"&&e.charName==="Aria"&&JSON.stringify(e.charIds)==='["q_a"]'&&/Emre/.test(e.who)) ? true : JSON.stringify(e); }));

  console.log("\n[a moved meeting starts over; a lapse is never silent]");
  await setup({day:5,period:"Midday"});
  const mv=await pg.evaluate(()=>{
    const chat=curChat();
    chat.calendar=[{id:"m3",kind:"meeting",title:"Cinema",who:"Aria, Emre",charIds:["q_a"],withUser:true,executor:"user",locationId:"l_cafe",where:"Cafe Nero",day:5,period:"Evening",done:false,certainty:"certain"}];
    chat.gameDay=6; chat.period="Morning"; plantUnkeptMeetingMemories(chat,5,"Midday");
    const e=chat.calendar[0]; const rolled=e._rolledFrom;
    _ftEntry(chat,"meeting","m3").apply({day:9,period:"Evening"});
    const after={day:e.day,rolled:e._rolledFrom,snoozes:e.snoozes};
    chat.gameDay=9; chat.period="Afternoon";
    const summary=calPendingTodaySummary(chat);
    chat.gameDay=10; chat.period="Morning"; plantUnkeptMeetingMemories(chat,9,"Afternoon");
    return {rolled,after,summary,final:{day:e.day,done:e.done,outcome:e.outcome}};
  });
  ok("rescheduled by the tracker: _rolledFrom is cleared, so the next day end rolls it again instead of lapsing it",
     mv.rolled===5&&mv.after.day===9&&mv.after.rolled===undefined&&/moves to tomorrow/.test(mv.summary)&&mv.final.day===10&&!mv.final.done, JSON.stringify(mv));
  // v147.2 — only when it moves the meeting: the same slot restated keeps a "Later" and the roll (QC report #3 §3.3).
  ok("an 'on my way' text that moves a rolled meeting resets it", await pg.evaluate(()=>{
    const chat=curChat(); const e=chat.calendar[0]; e.period="Night"; e._rolledFrom=9; e.snoozes=2; e.snoozedAt=101;
    _textComing(chat,state.personas.find(p=>p.id==="q_a"),"Evening");
    return (e._rolledFrom===undefined&&e.snoozes===undefined&&e.snoozedAt===undefined) ? true : JSON.stringify(e); }));
  ok("moved by hand in the calendar editor: reset too", await pg.evaluate(()=>{
    const chat=curChat(); const e=chat.calendar[0]; e._rolledFrom=9; e.snoozes=1;
    const box=document.createElement('div'); box.id="__caTest";
    const f={caEditId:e.id,caType:"user",caTitle:"Cinema",caDay:"12",caPeriod:"Evening",caLoc:"",caChar:"q_a",caExec:"user",caCert:"certain",caProb:"",caWhy:""};
    Object.keys(f).forEach(k=>{ const i=document.createElement('input'); i.id=k; i.value=f[k]; box.appendChild(i); });
    document.body.appendChild(box);
    try{ saveCalManual(); }finally{ box.remove(); try{ _calClose(); }catch(_){} }
    return (e.day===12&&e._rolledFrom===undefined&&e.snoozes===undefined) ? true : JSON.stringify(e); }));
  await setup({day:5,period:"Afternoon"});
  const dnd=await pg.evaluate(()=>{
    const chat=curChat(); chat.dnd=true;
    chat.calendar=[{id:"m4",kind:"meeting",title:"Lunch",who:"Aria, Emre",charIds:["q_a"],withUser:true,executor:"user",day:5,period:"Midday",done:false,certainty:"certain"}];
    chat.gameDay=6; chat.period="Morning"; plantUnkeptMeetingMemories(chat,5,"Afternoon");
    const e=chat.calendar[0]; const a=e.day;
    chat.gameDay=7; plantUnkeptMeetingMemories(chat,6,"Night");
    return {a,done:e.done,outcome:e.outcome};
  });
  const nts=await notices();
  ok("Do Not Disturb two days running: the lapse posts a notice", dnd.a===6&&dnd.done&&dnd.outcome==="lapsed"&&nts.some(t=>/"Lunch" did not happen/.test(t)), JSON.stringify(dnd)+" "+JSON.stringify(nts));

  console.log("\n[UNKEPT never reaches a character before the day end settled it]");
  await setup({day:5,period:"Evening"});
  const win=await pg.evaluate(()=>{
    const chat=curChat();
    chat.calendar=[{id:"w1",kind:"meeting",title:"Dinner at the cafe",who:"Aria, Emre",charIds:["q_a"],withUser:true,executor:"user",day:5,period:"Evening",done:false,certainty:"certain"},
                   {id:"w2",kind:"meeting",title:"Morning run",who:"Aria, Emre",charIds:["q_a"],withUser:true,executor:"user",day:5,period:"Morning",done:false,certainty:"certain"}];
    chat.gameDay=6; chat.period="Morning"; chat.pendingDayEnd={day:5,period:"Evening",stage:0};
    const before=calendarContextLine(chat,"Aria","q_a",{bare:true});
    plantUnkeptMeetingMemories(chat,5,"Evening");
    const after=calendarContextLine(chat,"Aria","q_a",{bare:true});
    delete chat.pendingDayEnd;
    return {before,after};
  });
  ok("in the window between the day roll and the planting stage: no UNKEPT line", !/UNKEPT/.test(win.before), win.before);
  ok("after planting: the dinner is today's, the missed run is UNKEPT", /UNKEPT[^\n]*Morning run/.test(win.after)&&!/UNKEPT[^\n]*Dinner/.test(win.after)&&/Dinner at the cafe/.test(win.after), win.after);

  console.log("\n[unkept meetings close once the sting has passed]");
  await setup({day:8,period:"Morning"});
  ok("an unkept meeting older than the 3-day window is closed as missed (badge and tracker list drop it)", await pg.evaluate(()=>{
    const chat=curChat();
    chat.calendar=[{id:"u1",kind:"meeting",title:"Old coffee",who:"Aria, Emre",charIds:["q_a"],withUser:true,executor:"user",day:3,period:"Morning",done:false,_unkeptLogged:1},
                   {id:"u2",kind:"meeting",title:"Recent coffee",who:"Aria, Emre",charIds:["q_a"],withUser:true,executor:"user",day:6,period:"Morning",done:false,_unkeptLogged:1}];
    plantUnkeptMeetingMemories(chat,7,"Night");
    const [a,c]=chat.calendar;
    return (a.done&&a.outcome==="missed"&&!c.done&&plansDue(chat).length===1&&!/Old coffee/.test(_ftRecord(chat))) ? true : JSON.stringify(chat.calendar); }));

  console.log("\n[a certain 'they come to you' meeting, player elsewhere]");
  for(const ans of ["later","go","skip"]){
    await setup({day:5,period:"Evening",loc:"l_cafe"});
    const r=await pg.evaluate(async(ans)=>{
      const chat=curChat(); window.__answer=ans;
      chat.calendar=[{id:"c7",kind:"meeting",title:"Aria visits",who:"Aria, Emre",charIds:["q_a"],withUser:true,executor:"Aria",executorId:"q_a",locationId:"l_home",where:"Emre's Flat",day:5,period:"Evening",done:false,certainty:"certain"}];
      await resolveDueMeetings(chat); const e=chat.calendar[0];
      return {asks:window.__asks,done:e.done,outcome:e.outcome,snoozes:e.snoozes,travel:window.__travel,
        noshow:state.memory.filter(m=>m.source==="calendar_noshow").length};
    },ans);
    if(ans==="later") ok("asked Go home now / Later / Skip it instead of an instant no-show; Later puts it off",
       r.asks.length===1&&JSON.stringify(r.asks[0].choices)==='["Go home now","Later","Skip it"]'&&!r.done&&r.snoozes===1&&r.noshow===0, JSON.stringify(r));
    if(ans==="go") ok("Go home now: the player travels home and it is met", r.travel==="l_home"&&r.done&&r.outcome==="met"&&r.noshow===0, JSON.stringify(r));
    if(ans==="skip") ok("Skip it: they came and nobody was there (stood up)", r.done&&r.outcome==="stood_up"&&r.noshow===1, JSON.stringify(r));
  }

  console.log("\n[promises: lapse rules]");
  await setup({day:30,period:"Morning"});
  ok("a kept secret and a kept prohibition never lapse; an ordinary word unmentioned for 3 weeks does", await pg.evaluate(()=>{
    const chat=curChat();
    chat.promises=[{id:"s1",holderId:"q_a",holderName:"Aria",toId:"__user__",promise:"You will keep the affair secret",kind:"secret",status:"open",day:2,seenDay:2},
                   {id:"s2",holderId:"q_a",holderName:"Aria",toId:"__user__",promise:"You will not talk to Berk",kind:"prohibition",status:"open",day:2,seenDay:2},
                   {id:"s3",holderId:"q_a",holderName:"Aria",toId:"__user__",promise:"You will write every week",kind:"promise",status:"open",day:2,seenDay:2}];
    _prPrune(chat,30);
    const st=chat.promises.map(p=>p.status).join(",");
    const ctx=promiseContextFor(chat,"q_a","Aria",{});
    return (st==="open,open,lapsed"&&/affair secret/.test(ctx)) ? true : st+" / "+ctx; }));
  ok("an old save's open words (no seenDay) are seeded with today, not lapsed all at once", await pg.evaluate(()=>{
    const chat=curChat();
    chat.promises=[{id:"o1",holderId:"q_a",holderName:"Aria",toId:"__user__",promise:"You will call your mother",kind:"promise",status:"open",day:2},
                   {id:"o2",holderId:"q_a",holderName:"Aria",toId:"__user__",promise:"You will fix the roof",kind:"arrangement",status:"open",day:3}];
    _prPrune(chat,30);
    return chat.promises.every(p=>p.status==="open"&&p.seenDay===30) ? true : JSON.stringify(chat.promises); }));
  ok("a word corrected by the tracker counts as raised (seenDay stamped)", await pg.evaluate(()=>{
    const chat=curChat(); const pr=chat.promises[0]; pr.seenDay=10;
    _ftEntry(chat,"promise",pr.id).apply({promise:"You will call your mother every Sunday"});
    return pr.seenDay===30 ? true : JSON.stringify(pr); }));
  ok("a newly recorded promise carries seenDay", await pg.evaluate(()=>{
    const chat=curChat(); chat.promises=[];
    const e=recordPromise(chat,{holder:"Aria",to:"Emre",promise:"You will bring the map",kind:"promise",shows_as:"when they set out"},30);
    return (e&&e.seenDay===30) ? true : JSON.stringify(e); }));

  console.log("\n[_prSame fixture table ("+PRSAME_TABLE.length+" pairs)]");
  await setup({day:5});
  const prs=await pg.evaluate((T)=>T.map(([a,b2,h])=>{ const r=_prSame(a,b2,curChat()); return {a,b:b2,h,r}; }),PRSAME_TABLE);
  prs.forEach(x=>ok(`${x.h?"same":"different"}: "${x.a}" / "${x.b}"`, x.r===x.h, "got "+x.r));
  ok("recordPromise files a Turkish word and its negation as two promises", await pg.evaluate(()=>{
    const chat=curChat(); chat.promises=[];
    recordPromise(chat,{holder:"Aria",to:"Emre",promise:"Hakan'a gerçeği söyleyeceksin",kind:"promise",shows_as:"Hakan sorunca"},5);
    recordPromise(chat,{holder:"Aria",to:"Emre",promise:"Hakan'a gerçeği söylemeyeceksin",kind:"prohibition",shows_as:"Hakan sorunca"},5);
    recordPromise(chat,{holder:"Aria",to:"Emre",promise:"You will keep the secret about the ring",kind:"secret",shows_as:"when asked"},5);
    recordPromise(chat,{holder:"Aria",to:"Emre",promise:"You will keep the secret about the Ring",kind:"secret",shows_as:"when asked"},5);
    return chat.promises.length===3 ? true : JSON.stringify(chat.promises.map(p=>p.promise)); }));

  console.log("\n[date parser fixture table ("+PARSER_TABLE.length+" phrasings)]");
  const pt=await pg.evaluate((T)=>T.map(([ph,ed,ep])=>{ const n=_calInferDayPeriod(ph,10); return {ph,ed,ep,d:n.day,p:n.period}; }),PARSER_TABLE);
  const bad=pt.filter(x=>x.d!==x.ed||x.p!==x.ep);
  ok("every phrasing reads the way a person means it", bad.length===0, bad.map(x=>`${JSON.stringify(x.ph)} expect ${x.ed}/${x.ep} got ${x.d}/${x.p}`).join("\n        "));
  ok("counts after about/around are not clock times", await pg.evaluate(()=>
    statedHour("there were about 20 guards")===null&&statedHour("around 5 minutes later")===null&&statedHour("I'll be there around 4")===16));

  console.log("\n[stamps, world plans, cast, notes]");
  await setup({day:6,period:"Morning"});
  ok("the tracker stamps what it filed with the turn's clock, not the live one", await pg.evaluate(()=>{
    const chat=curChat(); const before=_ftSnapshot(chat);
    chat.calendar.push({id:"t1",kind:"meeting",title:"Late drink",who:"Aria",day:6,period:"Evening",done:false});
    _ftStampChanges(chat,before,{day:5,period:"Night"});
    const e=chat.calendar[0]; return (e.ftAt&&e.ftAt.day===5&&e.ftAt.period==="Night") ? true : JSON.stringify(e.ftAt); }));
  await setup({day:5,period:"Afternoon"});
  ok("a world-engine plan with no period gets the next part of the day, and a past day is bounded to today", await pg.evaluate(()=>{
    const chat=curChat();
    const a=addCalendarEntry(chat,{kind:"meeting",title:"Mara visits Aria",who:"Mara, Aria",charIds:["q_m","q_a"],day:5,period:"",withUser:false,source:"world",executor:"Mara",executorId:"q_m"});
    const c=addCalendarEntry(chat,{kind:"meeting",title:"Berk and Nil talk",who:"Berk, Nil",day:3,period:"Morning",withUser:false,source:"world",executor:"Berk"});
    return (a&&a.day===5&&a.period==="Evening"&&c&&c.day===6&&c.period==="Morning") ? true : JSON.stringify([a,c]); }));
  ok("…and is deduped on the period it gave, before the default", await pg.evaluate(()=>{
    const chat=curChat(); const n=chat.calendar.length;
    const d=addCalendarEntry(chat,{kind:"meeting",title:"Mara visits Aria",who:"Mara, Aria",day:5,period:"",withUser:false,source:"world",executor:"Mara"});
    return (d===null&&chat.calendar.length===n) ? true : "filed twice"; }));
  ok("runPromiseEngine reads the cast of the chat it was handed", await pg.evaluate(()=>/curCast\(chat\)/.test(String(runPromiseEngine))&&!/curCast\(\)/.test(String(runPromiseEngine))));
  ok("a called-off task's note says called off, not failed", await pg.evaluate(async()=>{
    const got=[]; const real=window.questProgressNote; window.questProgressNote=(u,q,d,t)=>got.push(t);
    try{ await _afterQuestDone(curChat(),state.universes[0],{quest:{id:"qx",title:"Fetch",source:"task",failed:true,cancelled:true,outcome:"cancelled",result:"It was called off."}},5); }
    finally{ window.questProgressNote=real; }
    return (got.length===1&&/^Quest called off/.test(got[0])) ? true : JSON.stringify(got); }));
  ok("the day-end text stage has no stale 'left on read' comment or unused force flag", await pg.evaluate(()=>{
    const s=String(_endDayBackgroundRun); return !/left on read all day/.test(s)&&!/maybeProactiveText\(chat,\{force:true\}\)/.test(s); }));

  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail?1:0);
})();
