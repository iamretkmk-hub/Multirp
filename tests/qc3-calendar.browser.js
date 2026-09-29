/* v147.2 — QC report #3, calendar + promises (out/QC-REPORT-v147.md §3.3, E2E Q9/Q10). One block per item:
     1. the meeting dedupe: different people are never the same meeting (title words, exact title, pairs);
     2. a meeting with no time of its own is not a repeat of another with the same person that day;
     3. _prSame on the qc2 table + the qc3 fixture table (negators, Turkish -mAmAlI/-mA, possessives,
        numbers, one shared word), and recordPromise keeps the same words to two different people;
     4. arrangement/change promises never lapse (only a plain promise does);
     5. a live Scene Writer event: together at the place = met; environment events block nothing; a held
        slot moves on at End Day instead of being blamed;
     6. a restated, unchanged day/time keeps "Later" and `_rolledFrom` (tracker update and "on my way");
     7. End Day never resurrects an older day's meeting (DND), and ftAt is stamped only on a real change;
     8. a meeting between two characters in the current part of the day does not roll, and no notice
        reaches the player about another pair's plans;
     9. the date parser: counts before or/and/at, number words, dawn/sunset, "in 2 weeks", "akşam dokuzda",
        with the qc2 128-phrasing table and the qc3 55-phrasing table still right;
    10. the tracker stamps what it files with the line that settled it (Retry of a later reply keeps it);
    11. the calendar/promise/tracker/arrival prompt fills and notices use the CHAT's player, not the open one. */
const {chromium}=require('playwright');
const fs=require('fs'), path=require('path');
const qc2=fs.readFileSync(path.join(__dirname,'qc2-calendar.browser.js'),'utf8');
const PRSAME_OLD=eval(qc2.match(/const PRSAME_TABLE=(\[[\s\S]*?\]\]);/)[1]);
const PARSER_OLD=eval(qc2.match(/const PARSER_TABLE=(\[[\s\S]*?\]\]);/)[1]);
// [a, b, same promise?] — the qc3 audit's fixture table, plus held-out restatements that must still merge.
const PRSAME_NEW=[
["You will not tell Hakan about the money","You will not tell Hakan about the baby",false],
["You will never lie to me","You will always lie to me",false],
["You will always tell me the truth","You will never tell me the truth",false],
["You will always tell me the truth","You will tell me the truth",true],
["You won't tell Hakan","You will tell Hakan",false],
["You can't see Berk","You can see Berk",false],
["You cannot see Berk","You can see Berk",false],
["You cannot see Berk","You can't see Berk",true],
["Don't leave the house","Leave the house",false],
["Do not leave the house","Don't leave the house",true],
["You wont tell Hakan","You will tell Hakan",false],
["Kardeşimi koruyacaksın","Kardeşini koruyacaksın",false],
["Annemin evine gitmeyeceksin","Annemin evine gideceksin",false],
["Berk'le görüşmemelisin","Berk'le görüşmelisin",false],
["Berk'le görüşme","Berk'le görüşeceksin",false],
["Onunla buluşma","Onunla buluşacaksın",false],
["Hakan'ın arabasını kullanmayacaksın","Hakan'ın arabasını kullanacaksın",false],
["You will pay me 100 gold","You will pay me 500 gold",false],
["You won't tell Aria","You won't tell Mara",false],
["I'll meet you at the cafe","I will see you at the cafe",true],
["You will come home before midnight","You will come home before midnight tonight",true],
["You will visit your mother","You will visit my mother",false],
["Don't touch Nil","You won't touch Nil",true],
["You will stop drinking","You will not drink",true],
["You will stop seeing Berk","You will keep seeing Berk",false],
["You will keep seeing Berk","You will see Berk",true],
["Fatma'ya söyleyeceksin","Fatma'ya söylemeyeceksin",false],
["Fatma'ya söyleyeceksin","Fatma'ya yarın söyleyeceksin",true],
["Yılmaz'a gideceksin","Yılmaz'a gitmeyeceksin",false],
["You'll never hurt Aria","You won't hurt Aria",true],
["You'll never hurt Aria","You'll hurt Aria",false],
["You will not tell anyone about us","You won't tell anyone about us",true],
["You will tell no one","You won't tell anyone",true],
["Keep the secret about Berk","Tell everyone about Berk",false],
["You will marry Aria","You will not marry Aria",false],
["You will marry Aria","You will marry her",true],
["You will marry Aria","You will divorce her",false],
["Can'a söyleme","Can'a söyleyeceksin",false],
["Berk'e dokunmayacaksın","Berk'e dokunmazsın",true],
["Aria'yı bir daha görmeyeceksin","Aria ile bir daha görüşmeyeceksin",true],
["You shouldn't drink","You should drink",false],
["You must never tell Berk","You mustn't tell Berk",true],
["I won't let anyone hurt you","I will let anyone hurt you",false],
["Don't ever come back here","You will never come back here",true],
["You will return the book to Aria","You will give the book back to Aria",true],
["You will not tell Berk about the affair","You will not tell Berk about the debt",false],
["You will help Aria move","You will help Aria cook",false],
["You will be home by 10","You will be home by 12",false],
["Sigarayı bırakacaksın","Sigarayı bırakmayacaksın",false],
["Onu gömüyorsun","Onu gömmüyorsun",false],
["Kimseye söylemezsin","Kimseye söylersin",false],
["Ceren'e yalan söylemeyeceksin","Ceren'e yalan söylemeyeceğine söz verdin",true],
// held out (not in the audit's table): restatements that must still merge after the tightening
["You will not tell Hakan about the money","You won't tell Hakan anything about the money",true],
["Berk'le görüşmeyeceksin","Berk'le bir daha buluşmayacaksın",true],
["You will help Aria move house","You will help Aria with the move",true],
["You will be home by 10","You will be home by 10 tonight",true],
["Annene söyleme","Annene söylemeyeceksin",true],
["You will visit your mother","You will visit your mother on Sunday",true],
["You will become a better man","You will become a better man for me",true]];
/* The qc3 55-phrasing table. One expectation is corrected from the audit's table: "We have 3 days left,
   meet tonight" was listed with no part of the day, but "tonight" is Night everywhere else ("later tonight"). */
const PARSER_NEW=[
["tonight at 11",10,"Night"],["yarın sabah 9'da",11,"Morning"],["this evening",10,"Evening"],["next week",17,null],["in 2 days at noon",12,"Midday"],
["tomorrow at half past eight",11,"Morning"],["at quarter to 9 tonight",10,"Evening"],["Let's meet at 7 yarın akşam",11,"Evening"],["yarın at 10",11,"Morning"],
["tomorrow akşam",11,"Evening"],["bu akşam at 8",10,"Evening"],["in two days at 3",12,"Afternoon"],["at 11 tonight",10,"Night"],["tonight around 10",10,"Night"],
["around 10 people came",null,null],["next Monday at 9",null,"Morning"],["this evening at 6",10,"Evening"],["yarın öğlen 12'de",11,"Midday"],
["yarın sabah saat dokuzda",11,"Morning"],["gece yarısından sonra",null,"Night"],["the day after tomorrow in the evening",12,"Evening"],
["tomorrow evening at 7:30",11,"Evening"],["at 10 in the morning tomorrow",11,"Morning"],["in 3 days, around noon",13,"Midday"],["2 gün sonra saat 3'te",12,"Afternoon"],
["yarın 9'da",11,"Morning"],["yarın akşam dokuzda",11,"Night"],["tomorrow at 1",11,"Midday"],["at 9 tomorrow night",11,"Night"],["come by at 5 today",10,"Evening"],
["in 1 day",11,null],["in 2 weeks",24,null],["20 minutes later",null,null],["about 3 tomorrow",11,"Afternoon"],["around 7 or 8 tonight",10,"Evening"],
["akşam 8 gibi",null,"Evening"],["Tomorrow at 10 AM",11,"Morning"],["tonight 11pm",10,"Night"],["noon tomorrow",11,"Midday"],["yarın öğleden sonra 4'te",11,"Afternoon"],
["three days later at dawn",13,"Morning"],["at sunset",null,"Evening"],["later this evening",10,"Evening"],["early tomorrow",11,"Morning"],
["Meet at the kafe yarın 10'da",11,"Morning"],["At 20 she left home",null,null],["at 5 tonight",10,"Evening"],["yarın sabah 7 buçukta",11,"Morning"],
["tomorrow around 5pm",11,"Evening"],["in a fortnight",null,null],["We have 3 days left, meet tonight",10,"Night"],["bir saat sonra",null,null],
["in an hour",null,null],["yarın akşamüstü",11,"Evening"],["pazartesi sabah",null,"Morning"]];
// item 9 — the report's own examples, and neighbours that must keep reading as times
const PARSER_Q3=[
["about 10 or 12 guards",null,null],["there were about 20 or so of them",null,null],["around 3 and a half hours",null,null],
["around 15 at most",null,null],["we went to 2 parties at 3 bars",null,null],["about 6 then more came",null,null],["at one point",null,null],
["about three of us",null,null],["at 7 or 8",null,"Morning"],["dinner at 7-8",null,"Evening"],["around 7 to 8 tonight",10,"Evening"],
["at eight tomorrow",11,"Morning"],["eight o'clock tomorrow",11,"Morning"],["at seven tonight",10,"Evening"],["quarter past 7 tomorrow morning",11,"Morning"],
["half past 7 in the evening",null,"Evening"],["in 3 weeks",31,null],["3 hafta sonra",31,null],["2 hafta içinde",24,null],["at sunrise tomorrow",11,"Morning"],
["gün batımında",null,"Evening"],["sekizde görüşürüz",null,"Morning"],["beşte bir",null,null],["onda kaldı",null,null],["meet at 9 with Aria",null,"Morning"]];
(async()=>{
  const b=await chromium.launch({executablePath:process.env.SM_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage({viewport:{width:412,height:915}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file://'+path.resolve(__dirname,'..','index.html'));
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
    [["q_b","Berk"],["q_n","Nil"],["q_h","Hakan"],["q_c","Ceren"],["q_d","Duygu"],["q_can","Can"],["q_f","Fatma"],["q_y","Yılmaz"]].forEach(([id,n])=>mk(id,n,uni.id));
    state.user="Emre"; state.key="test"; state.calOn=true; state.mem=true; state.textsOn=true; state.promiseOn=true;
    const chat=curChat();
    chat.universeId=uni.id; chat.gameDay=(o&&o.day)||5; chat.period=(o&&o.period)||"Afternoon"; chat.timeOfDay=chat.period;
    chat.presentIds=[]; chat.dnd=false; delete chat.activeEvent; chat.calendar=[]; chat.promises=[]; delete chat.pendingDayEnd; delete chat.pendingDayEnds;
    chat.locationId=(o&&o.loc)||"l_home"; chat.location=chat.locationId==="l_cafe"?"Cafe Nero":"Emre's Flat";
    chat.messages=[{mid:"s1",role:"user",content:"hello",present:[]}];
    chat._ftBusy=false; chat._ftAgain=false; chat.futureWatch=[];
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

  console.log("\n[1 — different people are never the same meeting]");
  await setup({day:5,period:"Morning"});
  const d1=await pg.evaluate(()=>{
    const c=curChat(), D=(e,cand)=>_calIsDup([e],cand,{chat:c});
    return {
      lunch:D({id:"x",title:"Lunch with Aria at Cafe Nero",who:"Aria, Emre",locationId:"l_cafe",where:"Cafe Nero",day:6,period:"Midday"},
              {title:"Lunch with Mara at Cafe Nero",who:"Mara, Emre",locationId:"l_cafe",where:"Cafe Nero",day:6,period:"Midday"}),
      meet:D({id:"x",title:"Meet Aria at the cafe",who:"Aria, Emre",day:6,period:"Evening"},{title:"Meet Mara at the cafe",who:"Mara, Emre",day:6,period:"Evening"}),
      coffee:D({id:"y",title:"Coffee",who:"Aria, Emre",day:6,period:"Morning"},{title:"Coffee",who:"Mara, Emre",day:6,period:"Evening"}),
      coffeeSameDiffTime:D({id:"y",title:"Coffee",who:"Aria, Emre",day:6,period:"Morning"},{title:"Coffee",who:"Aria, Emre",day:6,period:"Evening"}),
      training:D({id:"z",title:"Training session",who:"Aria, Mara",executor:"Aria",withUser:false,day:6,period:"Morning"},
                 {title:"Training session",who:"Berk, Nil",executor:"Berk",withUser:false,day:6,period:"Morning"}),
      idsOnly:D({id:"w",title:"Meet at the cafe",who:"",charIds:["q_a"],day:6,period:"Evening"},{title:"Meet at the cafe",who:"Mara",day:6,period:"Evening"}),
      // still duplicates:
      reword:D({id:"r",title:"Meet Aria at the cafe",who:"Aria, Emre",day:6,period:"Evening"},{title:"Meeting Aria at the cafe",who:"Aria",day:6,period:"Evening"}),
      exactNoPeriod:D({id:"r",title:"Coffee",who:"Aria, Emre",day:6,period:"Morning"},{title:"Coffee",who:"Aria",day:6,period:null}),
      neighbour:D({id:"n",title:"Dinner with Aria",who:"Aria, Emre",day:6,period:"Evening"},{title:"Have dinner together",who:"Aria",day:6,period:"Night"}),
      oneDayOff:D({id:"o",title:"Coffee with Aria",who:"Aria, Emre",day:6,period:"Morning"},{title:"Coffee with Aria",who:"Aria",day:7,period:"Morning"}),
    };
  });
  ok("'Lunch with Mara' is not 'Lunch with Aria' at the same place and time", d1.lunch===false, JSON.stringify(d1));
  ok("'Meet Mara at the cafe' is not 'Meet Aria at the cafe'", d1.meet===false, JSON.stringify(d1));
  ok("'Coffee' with Mara (Evening) is not 'Coffee' with Aria (Morning)", d1.coffee===false, JSON.stringify(d1));
  ok("the exact title respects the time: 'Coffee' Morning vs Evening with the same person are two", d1.coffeeSameDiffTime===false, JSON.stringify(d1));
  ok("'Training session' for another pair is another meeting", d1.training===false, JSON.stringify(d1));
  ok("a plan's people are read from its ids too", d1.idsOnly===false, JSON.stringify(d1));
  ok("a re-wording with the same person, time and day is still a duplicate", d1.reword===true, JSON.stringify(d1));
  ok("the same title with no time of its own is still a duplicate", d1.exactNoPeriod===true, JSON.stringify(d1));
  ok("Evening vs Night with the same person (names branch) is still a duplicate", d1.neighbour===true, JSON.stringify(d1));
  ok("the same meeting re-sent a day off is still a duplicate", d1.oneDayOff===true, JSON.stringify(d1));
  ok("runCalendarEngine files 'Meet Mara at the cafe' beside 'Meet Aria at the cafe'", await pg.evaluate(async()=>{
    const chat=curChat();
    chat.calendar=[{id:"e1",kind:"meeting",title:"Meet Aria at the cafe",who:"Aria, Emre",charIds:["q_a"],withUser:true,executor:"user",locationId:"l_cafe",where:"Cafe Nero",day:6,period:"Evening",done:false,certainty:"certain",source:"auto"}];
    window.__cc=()=>JSON.stringify({new:[{title:"Meet Mara at the cafe",who:"Mara",executor:"user",dayOffset:1,period:"Evening",where:"Cafe Nero"}]});
    await runCalendarEngine(chat,{});
    const t=chat.calendar.map(e=>e.title+"|"+e.day+"|"+e.period);
    return t.length===2&&t[1]==="Meet Mara at the cafe|6|Evening" ? true : JSON.stringify(t); }));

  console.log("\n[2 — a meeting with no time of its own]");
  ok("'Help Aria move boxes' (no period) is filed beside 'Dinner with Aria' the same day", await pg.evaluate(async()=>{
    const chat=curChat();
    chat.calendar=[{id:"e1",kind:"meeting",title:"Dinner with Aria",who:"Aria, Emre",charIds:["q_a"],withUser:true,executor:"user",locationId:"l_cafe",where:"Cafe Nero",day:6,period:"Evening",done:false,certainty:"certain",source:"auto"}];
    window.__cc=()=>JSON.stringify({new:[{title:"Help Aria move boxes",who:"Aria",executor:"user",dayOffset:1,period:null}]});
    await runCalendarEngine(chat,{});
    return chat.calendar.length===2 ? true : JSON.stringify(chat.calendar.map(e=>e.title)); }));
  ok("…and _calIsDup says so directly (same person, same day, candidate without a period)", await pg.evaluate(()=>
    _calIsDup([{id:"e",title:"Dinner with Aria",who:"Aria, Emre",day:6,period:"Evening"}],{title:"Help Aria move boxes",who:"Aria",day:6,period:null},{chat:curChat()})===false));

  console.log("\n[3 — _prSame fixture tables ("+PRSAME_OLD.length+" + "+PRSAME_NEW.length+" pairs) and the recipient]");
  await setup({day:5});
  for(const [label,T] of [["qc2 table",PRSAME_OLD],["qc3 table",PRSAME_NEW]]){
    const r=await pg.evaluate((T)=>T.map(([a,b2,h])=>({a,b:b2,h,r:_prSame(a,b2,curChat()),r2:_prSame(b2,a,curChat())})),T);
    const bad=r.filter(x=>x.r!==x.h||x.r2!==x.h);
    ok(`_prSame ${label}: ${r.length-bad.length}/${r.length} (both directions)`, bad.length===0, JSON.stringify(bad));
  }
  const pr=await pg.evaluate(()=>{
    const c=curChat(); c.promises=[];
    const a=recordPromise(c,{holder:"Emre",to:"Aria",promise:"I will come to your birthday party",kind:"promise",shows_as:"when the party comes"},5);
    const b2=recordPromise(c,{holder:"Emre",to:"Mara",promise:"I will come to your birthday party",kind:"promise",shows_as:"when the party comes"},5);
    const d=recordPromise(c,{holder:"Aria",to:"Emre",promise:"I won't tell Hakan about the money",kind:"secret",shows_as:"when Hakan asks"},5);
    const e=recordPromise(c,{holder:"Aria",to:"Emre",promise:"I won't tell Hakan about the baby",kind:"secret",shows_as:"when Hakan asks"},5);
    const f=recordPromise(c,{holder:"Aria",to:"",promise:"I won't tell Hakan anything about the money",kind:"secret",shows_as:"when Hakan asks"},6);
    return {n:c.promises.length,ab:a!==b2,de:d!==e,restate:f===d};
  });
  ok("the same words to Aria and to Mara are two promises", pr.ab===true, JSON.stringify(pr));
  ok("'…about the money' and '…about the baby' are two promises", pr.de===true, JSON.stringify(pr));
  ok("a restatement with no recipient still merges into the first", pr.restate===true&&pr.n===4, JSON.stringify(pr));

  console.log("\n[4 — arrangement and change promises never lapse]");
  await setup({day:30,period:"Morning"});
  const lp=await pg.evaluate(()=>{
    const c=curChat();
    c.promises=[{id:"p1",holderId:"q_a",promise:"We are exclusive now",kind:"arrangement",day:1,seenDay:2,status:"open"},
      {id:"p2",holderId:"q_a",promise:"I quit drinking",kind:"change",day:1,seenDay:2,status:"open"},
      {id:"p3",holderId:"q_a",promise:"won't tell Hakan",kind:"secret",day:1,seenDay:2,status:"open"},
      {id:"p5",holderId:"q_a",promise:"stay away from Berk",kind:"prohibition",day:1,seenDay:2,status:"open"},
      {id:"p4",holderId:"q_a",promise:"I will fix the roof",kind:"promise",day:1,seenDay:2,status:"open"}];
    _prPrune(c,30);
    return Object.fromEntries(c.promises.map(p=>[p.kind,p.status]));
  });
  ok("arrangement / change / secret / prohibition stay open after 28 quiet days", lp.arrangement==="open"&&lp.change==="open"&&lp.secret==="open"&&lp.prohibition==="open", JSON.stringify(lp));
  ok("a plain promise still lapses", lp.promise==="lapsed", JSON.stringify(lp));

  console.log("\n[5 — a live Scene Writer event and a due meeting]");
  await setup({day:5,period:"Evening",loc:"l_cafe"});
  const ev=await pg.evaluate(async()=>{
    const c=curChat(); c.presentIds=["q_a"];
    c.calendar=[{id:"m1",kind:"meeting",title:"Dinner",who:"Aria, Emre",charIds:["q_a"],charId:"q_a",withUser:true,executor:"Aria",executorId:"q_a",locationId:"l_cafe",where:"Cafe Nero",day:5,period:"Evening",done:false,certainty:"certain"}];
    c.activeEvent={type:"character",summary:"a stranger bursts in",resolved:false,turn:0};
    await resolveDueMeetings(c);
    const e=c.calendar[0]; return {done:e.done,outcome:e.outcome,asks:window.__asks.length};
  });
  ok("together at the place while an event runs → the meeting is met (Q10), nothing is asked", ev.done===true&&ev.outcome==="met"&&ev.asks===0, JSON.stringify(ev));
  await setup({day:5,period:"Evening",loc:"l_cafe"});
  const ev2=await pg.evaluate(async()=>{
    const c=curChat();
    c.calendar=[{id:"m1",kind:"meeting",title:"Drinks",who:"Mara, Emre",charIds:["q_m"],charId:"q_m",withUser:true,executor:"user",locationId:"l_park",where:"City Park",day:5,period:"Evening",done:false,certainty:"certain"}];
    c.activeEvent={type:"environment",summary:"rain starts",resolved:false,turn:0};
    window.__answer="later"; await resolveDueMeetings(c);
    const envAsked=window.__asks.length;
    c.calendar[0].snoozes=0; delete c.calendar[0].snoozedAt; window.__asks=[];
    c.activeEvent={type:"character",summary:"a stranger bursts in",resolved:false,turn:0};
    await resolveDueMeetings(c);
    const e=c.calendar[0];
    const r={envAsked,charAsked:window.__asks.length,held:e.eventHeld,done:e.done};
    r.summary=calPendingTodaySummary(c);
    c.period="Night"; c.gameDay=6; c.period="Morning"; plantUnkeptMeetingMemories(c,5,"Night");
    r.after=[e.day,e.period,e.done,e._rolledFrom,!!e._unkeptLogged];
    r.mem=state.memory.filter(m=>m.source==="unkept_meeting").length;
    return r;
  });
  ok("an environment event ('rain starts') does not block the question", ev2.envAsked===1, JSON.stringify(ev2));
  ok("a character event holds the meeting and stamps the slot (eventHeld)", ev2.charAsked===0&&ev2.held===5&&!ev2.done, JSON.stringify(ev2));
  ok("End Day moves an event-held meeting to tomorrow instead of blaming anyone", /moves to tomorrow/.test(ev2.summary)&&ev2.after[0]===6&&ev2.after[2]===false&&ev2.after[3]===5&&!ev2.after[4]&&ev2.mem===0, JSON.stringify(ev2));

  console.log("\n[6 — a restated, unchanged day/time is not a new appointment]");
  await setup({day:5,period:"Morning"});
  const fs6=await pg.evaluate(()=>{
    const chat=curChat();
    chat.calendar=[{id:"m1",kind:"meeting",title:"Dinner",who:"Aria, Emre",charIds:["q_a"],charId:"q_a",withUser:true,executor:"user",day:6,period:"Evening",done:false,certainty:"certain",_rolledFrom:5,snoozes:2,snoozedAt:61}];
    const E=_ftEntry(chat,"meeting","m1"), e=chat.calendar[0];
    E.apply({day:6,period:"Evening"}); const same=[e._rolledFrom,e.snoozes,e.snoozedAt];
    E.apply({period:"Night"}); const moved=[e.period,e._rolledFrom,e.snoozes,e.snoozedAt];
    return {same,moved};
  });
  ok("the tracker restating day 6 Evening keeps _rolledFrom and the snoozes", JSON.stringify(fs6.same)==="[5,2,61]", JSON.stringify(fs6));
  ok("a real move (Evening → Night) starts it over", fs6.moved[0]==="Night"&&fs6.moved[1]==null&&fs6.moved[2]==null&&fs6.moved[3]==null, JSON.stringify(fs6));
  ok("'on my way' for the slot it already has keeps a 'Later' and the roll", await pg.evaluate(()=>{
    const chat=curChat(); chat.gameDay=5; chat.period="Afternoon";
    const p=state.personas.find(x=>x.id==="q_a");
    chat.calendar=[{id:"m2",kind:"meeting",title:"Aria visits",who:"Aria, Emre",charIds:["q_a"],charId:"q_a",withUser:true,executor:"Aria",executorId:"q_a",day:5,period:"Evening",done:false,certainty:"certain",_rolledFrom:4,snoozes:1,snoozedAt:52}];
    _textComing(chat,p,"Evening"); const e=chat.calendar[0];
    return (e._rolledFrom===4&&e.snoozes===1&&chat.calendar.length===1) ? true : JSON.stringify(e); }));

  console.log("\n[7 — End Day never resurrects an older day's meeting; ftAt only on a real change]");
  await setup({day:3,period:"Evening"});
  const dnd=await pg.evaluate(()=>{
    const c=curChat(); state.mem=false;
    c.calendar=[{id:"m1",kind:"meeting",title:"Coffee",who:"Aria, Emre",charIds:["q_a"],withUser:true,executor:"user",day:3,period:"Morning",done:false,certainty:"certain",ftAt:{day:3,period:"Morning"}}];
    c.gameDay=4; c.period="Morning"; plantUnkeptMeetingMemories(c,3,"Evening");
    c.dnd=true; c.gameDay=5; plantUnkeptMeetingMemories(c,4,"Evening");
    const e=c.calendar[0]; state.mem=true;
    return {e:[e.day,e.period,e.done,e._rolledFrom],notes:c.messages.filter(m=>m.calNote).map(m=>m.content),
      direct:_calRollsAtDayEnd(c,e,4,"Evening")};
  });
  ok("a day-3 meeting is not 'moved to today' at the day-4 end because DND is on", dnd.e[0]===3&&dnd.e[3]==null&&dnd.notes.length===0&&dnd.direct===false, JSON.stringify(dnd));
  await setup({day:6,period:"Morning"});
  const st=await pg.evaluate(()=>{
    const c=curChat();
    c.calendar=[{id:"m1",kind:"meeting",title:"Coffee",who:"Aria, Emre",charIds:["q_a"],withUser:true,executor:"user",day:6,period:"Morning",done:false,certainty:"certain",detail:"a"}];
    const e=c.calendar[0];
    let b=_ftSnapshot(c); e.detail="changed"; e.prompted=true; e.snoozes=1; _ftStampChanges(c,b,{day:6,period:"Evening"},"x1");
    const afterDetail=e.ftAt?JSON.stringify(e.ftAt):null;
    b=_ftSnapshot(c); e.period="Midday"; _ftStampChanges(c,b,{day:6,period:"Evening"},"x1");
    return {afterDetail,afterMove:e.ftAt&&e.ftAt.period,ftMid:e.ftMid||null};
  });
  ok("a detail / prompted / snooze change does not stamp ftAt", st.afterDetail===null, JSON.stringify(st));
  ok("a change of time stamps ftAt (and an existing entry gets no ftMid)", st.afterMove==="Evening"&&st.ftMid===null, JSON.stringify(st));

  console.log("\n[8 — a meeting between two characters at day end]");
  await setup({day:6,period:"Evening"});
  const cc=await pg.evaluate(()=>{
    const chat=curChat(); state.mem=false;
    chat.calendar=[{id:"m1",kind:"meeting",title:"Aria and Mara spar",who:"Aria, Mara",charIds:["q_a","q_m"],withUser:false,executor:"Aria",day:6,period:"Evening",done:false,certainty:"certain"},
      {id:"m2",kind:"meeting",title:"Berk and Nil talk",who:"Berk, Nil",charIds:["q_b","q_n"],withUser:false,executor:"Berk",day:6,period:"Night",done:false,certainty:"certain"},
      {id:"m3",kind:"meeting",title:"Dinner",who:"Aria, Emre",charIds:["q_a"],withUser:true,executor:"user",day:6,period:"Evening",done:false,certainty:"certain"}];
    chat.gameDay=7; chat.period="Morning"; plantUnkeptMeetingMemories(chat,6,"Evening"); state.mem=true;
    return {cal:chat.calendar.map(e=>[e.id,e.day,e.period]),notes:chat.messages.filter(m=>m.calNote).map(m=>m.content)};
  });
  ok("the current-period char↔char meeting does not roll", JSON.stringify(cc.cal[0])==='["m1",6,"Evening"]', JSON.stringify(cc));
  ok("a later-period char↔char meeting still moves on, and the player's own dinner rolls", JSON.stringify(cc.cal[1])==='["m2",7,"Night"]'&&JSON.stringify(cc.cal[2])==='["m3",7,"Evening"]', JSON.stringify(cc));
  ok("the only notice is about the player's dinner", cc.notes.length===1&&/Dinner/.test(cc.notes[0])&&!/spar|Berk/.test(cc.notes[0]), JSON.stringify(cc.notes));

  console.log("\n[9 — the date parser ("+PARSER_OLD.length+" + "+PARSER_NEW.length+" + "+PARSER_Q3.length+" phrasings)]");
  for(const [label,T] of [["qc2 table",PARSER_OLD],["qc3 table",PARSER_NEW],["v147.2 cases",PARSER_Q3]]){
    const r=await pg.evaluate((T)=>T.map(([ph,ed,ep])=>{ const n=_calInferDayPeriod(ph,10); return {ph,ed,ep,d:n.day,p:n.period}; }),T);
    const bad=r.filter(x=>x.d!==x.ed||x.p!==x.ep);
    ok(`parser ${label}: ${r.length-bad.length}/${r.length}`, bad.length===0, JSON.stringify(bad));
  }

  console.log("\n[10 — the tracker stamps an entry with the line that settled it]");
  await setup({day:5,period:"Morning"});
  const tr=await pg.evaluate(async()=>{
    const chat=curChat(); state.promiseOn=false; const cq=state.charQuestsOn; state.charQuestsOn=false;
    const mkMsgs=()=>[{mid:"a1",role:"user",content:"Dinner tomorrow evening, Aria?",present:["q_a"]},
      {mid:"a2",role:"assistant",speaker:"Aria",speakerId:"q_a",content:"Yes — dinner tomorrow evening.",present:["q_a"]},
      {mid:"a3",role:"user",content:"How was your day?",present:["q_a"]},
      {mid:"a4",role:"assistant",speaker:"Aria",speakerId:"q_a",content:"Long. Tell you tomorrow.",present:["q_a"]}];
    const run=async(line)=>{
      chat.messages=mkMsgs(); chat.calendar=[]; chat._ftBusy=false; chat._ftAgain=false;
      let trackerConvo="";
      window.__cc=(msgs,op)=>{
        if(op.dbg==="Future tracker"){ trackerConvo=msgs.map(m=>m.content).join("\n");
          return JSON.stringify({items:[Object.assign({kind:"meeting",action:"new",stage:"agreed",holder:"Aria",about:"dinner tomorrow"},line!=null?{line}:{})]}); }
        if(op.dbg==="Meetings tracker") return JSON.stringify({new:[{title:"Dinner with Aria",who:"Aria",executor:"user",dayOffset:1,period:"Evening"}]});
        return "{}"; };
      await runFutureTracker(chat);
      const e=chat.calendar[0];
      return {ftMid:e&&e.ftMid,ftNew:e&&e.ftNew,numbered:/#2 Aria: Yes/.test(trackerConvo)};
    };
    const withLine=await run(2);
    const kept=_retryRollbackPlans(chat,"a4")===0&&chat.calendar.length===1;
    const noLine=await run(null);
    state.promiseOn=true; state.charQuestsOn=cq;
    return {withLine,kept,noLine};
  });
  ok("the tracker reads numbered lines", tr.withLine.numbered===true, JSON.stringify(tr));
  ok("a meeting agreed on line #2 is stamped with that reply's mid, not the newest", tr.withLine.ftMid==="a2"&&tr.withLine.ftNew===true, JSON.stringify(tr));
  ok("Retry of the newest reply keeps it", tr.kept===true, JSON.stringify(tr));
  ok("no line given → the pass's own source line, as before", tr.noLine.ftMid==="a4", JSON.stringify(tr));
  ok("the tracker prompt asks for the line (and a refresh line upgrades stored copies)", await pg.evaluate(()=>
    /"line":<the number of the line that settled it>/.test(X_ENGINE_PROMPTS.x_future_tracker.def)&&/numbered #1, #2/.test(X_ENGINE_PROMPTS.x_future_tracker.def)));

  console.log("\n[11 — prompt fills and notices use the chat's own player]");
  await setup({day:5,period:"Morning"});
  const w=await pg.evaluate(async()=>{
    if(!state.universes.some(u=>u.id==="u_q3"))
      state.universes.push({id:"u_q3",name:"Other",userName:"Mert",setting:"",locations:[{id:"l_q3",name:"Liman",description:"",sublocations:[]},{id:"l_q3h",name:"Mert's Room",description:"",sublocations:[]}],gameData:{},rules:[],trackers:[]});
    if(!state.personas.some(p=>p.id==="q3_d")) state.personas.push({id:"q3_d",name:"Deniz",universeId:"u_q3",instructions:"x",personality:"x",backstory:"x",style:"x",goals:"x",look:{}});
    const c={id:"c_q3",universeId:"u_q3",castIds:[],presentIds:[],memCounts:{},tempChars:[],messages:[
      {mid:"z1",role:"user",content:"Deniz, yarın akşam yemeğe gelir misin?",present:["q3_d"]},
      {mid:"z2",role:"assistant",speaker:"Deniz",speakerId:"q3_d",content:"Tabii, yarın akşam gelirim.",present:["q3_d"]}],
      gameDay:2,period:"Morning",locationId:"l_q3",location:"Liman",calendar:[],promises:[],futureWatch:[]};
    const sys={}; window.__cc=(msgs,op)=>{ (sys[op.dbg]=sys[op.dbg]||[]).push(msgs.map(m=>m.content).join("\n"));
      if(op.dbg==="Future tracker") return JSON.stringify({items:[{kind:"meeting",action:"new",stage:"agreed",holder:"Deniz",about:"dinner",line:2}]});
      if(op.dbg==="Meetings tracker") return JSON.stringify({new:[{title:"Dinner with Deniz",who:"Deniz, {{user}}",executor:"user",dayOffset:1,period:"Evening"}]});
      return "{}"; };
    const cq=state.charQuestsOn; state.charQuestsOn=false; state.promiseOn=false;
    await runFutureTracker(c);
    state.promiseOn=true; c._prCount=5;
    await runPromiseEngine(c,{force:true});
    state.charQuestsOn=cq;
    const p=state.personas.find(x=>x.id==="q3_d");
    const tad=JSON.stringify(_textArrivalData(c,p));
    c.calendar=[]; const tc=_textComing(c,p,"Evening");
    // stood up: Deniz comes to Mert's room, Mert is elsewhere and skips
    c.calendar=[{id:"s1",kind:"meeting",title:"Deniz visits",who:"Deniz, Mert",charIds:["q3_d"],charId:"q3_d",withUser:true,executor:"Deniz",executorId:"q3_d",locationId:"l_q3h",where:"Mert's Room",day:2,period:"Morning",done:false,certainty:"certain"}];
    window.__answer="skip"; await resolveDueMeetings(c);
    const notes=c.messages.filter(m=>m.calNote).map(m=>m.content).join(" | ");
    const noshow=state.memory.filter(m=>m.chatId==="c_q3"&&m.source==="calendar_noshow").map(m=>m.content).join(" | ");
    state.memory=state.memory.filter(m=>m.chatId!=="c_q3");
    const all=JSON.stringify(sys);
    return {tracker:(sys["Future tracker"]||[""])[0],cal:(sys["Meetings tracker"]||[""])[0],prom:(sys["Promises & commitments"]||[""])[0],
      filed:c.calendar.length, tad, tcTitle:tc&&tc.title, notes, noshow, emreAnywhere:/Emre/.test(all+tad+notes+noshow)};
  });
  ok("the future tracker's prompt and lines name Mert (the chat's player), not the open story's Emre", /Mert/.test(w.tracker)&&!/Emre/.test(w.tracker), w.tracker.slice(0,300));
  ok("the meetings writer's {{user}} is Mert", /Mert/.test(w.cal)&&!/Emre/.test(w.cal), w.cal.slice(0,300));
  ok("the promise extractor's {user} is Mert", /Mert/.test(w.prom)&&!/Emre/.test(w.prom), w.prom.slice(0,300));
  ok("the text-arrival data names Mert", /Mert is at/.test(w.tad)&&!/Emre/.test(w.tad), w.tad);
  ok("an 'on my way' meeting is titled for Mert", w.tcTitle==="Deniz comes over to Mert", String(w.tcTitle));
  ok("the stood-up notice and memory name Mert", /but Mert wasn't there/.test(w.notes)&&!/Emre/.test(w.notes+w.noshow), w.notes+" || "+w.noshow);
  ok("no fill anywhere fell back to the open story's player", w.emreAnywhere===false);

  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail?1:0);
})();
