/* v144.1 — QC report, calendar + promises + texts (§3 #10–#12, §4.4, §4.5, §4.10).
   Each check is one finding from out/QC-REPORT.md, run against the app with a stubbed model:
   a cancelled meeting reached characters as lived, End Day with a dinner still ahead planted
   "stood up" memories and asked about it the next morning, "Do you go now?" was asked with the
   person in the room, the date parser misread ordinary phrases, offsets and periods were never
   checked, unkept memories crossed universes, the dedupe merged different meetings, the promise
   dedupe merged different promises and the cap dropped open ones, two quick texts replied at once,
   the proactive tick was keyed on the period alone, and _textArc did not survive a save.
   Run: node tests/qc-calendar.browser.js */
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
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x===undefined?c:x).slice(0,700));} };

  // One world: Aria and Mara here, an unrelated "Aria" in another universe; three places.
  const setup=(o)=>pg.evaluate((o)=>{
    const uni=state.universes[0];
    uni.locations=Array.isArray(uni.locations)?uni.locations:[];
    [["l_cafe","Cafe Nero"],["l_park","City Park"],["l_home","Emre's Flat"]].forEach(([id,name])=>{
      if(!uni.locations.some(l=>l.id===id)) uni.locations.push({id,name,description:"",sublocations:[]}); });
    if(!state.universes.some(u=>u.id==="u_other")) state.universes.push({id:"u_other",name:"Elsewhere",locations:[]});
    const mk=(id,name,uid)=>{ if(!state.personas.some(p=>p.id===id))
      state.personas.push({id,name,universeId:uid,instructions:"x",personality:"x",backstory:"x",style:"x",goals:"x",look:{}}); };
    mk("q_a","Aria",uni.id); mk("q_m","Mara",uni.id); mk("q_x","Aria","u_other");
    state.user="Emre"; state.key="test"; state.calOn=true; state.mem=true; state.textsOn=true; state.promiseOn=true;
    const chat=curChat();
    chat.universeId=uni.id; chat.gameDay=(o&&o.day)||5; chat.period=(o&&o.period)||"Afternoon"; chat.timeOfDay=chat.period;
    chat.presentIds=[]; chat.dnd=false; delete chat.activeEvent; chat.calendar=[]; chat.promises=[];
    chat.locationId="l_home"; chat.location="Emre's Flat";
    chat.messages=[{mid:"s1",role:"user",content:"hello",present:[]}];
    state.memory=(state.memory||[]).filter(m=>!/^(unkept_meeting|calendar_noshow)$/.test(m.source||""));
    window.__asks=[]; window.__answer="go"; window.__calls=[];
    window.uiChoose=async(msg,choices,op)=>{ window.__asks.push({msg,title:op&&op.title,choices:choices.map(c=>c.label)}); return window.__answer; };
    window.uiConfirm=async()=>true;
    if(!window.__realCC) window.__realCC=window.chatCompletion;
    window.chatCompletion=async(msgs,model,op)=>{ window.__calls.push({dbg:(op&&op.dbg)||"",msgs}); return window.__cc?window.__cc(msgs,op):""; };
    window.__cc=null;
    window.playCharacterTurn=async()=>{}; window.narrateCharMove=async()=>"";
    markChatDirty(chat);
  },o||{});
  const mem=(src)=>pg.evaluate((src)=>state.memory.filter(m=>m.source===src).map(m=>({owner:m.ownerId,c:m.content})),src);

  console.log("\n[#10 — a meeting that did not happen is never shown as lived]");
  await setup({day:6,period:"Evening"});
  ok("the tracker's 'cancelled' / 'failed' become outcomes, stamped with when", await pg.evaluate(()=>{
      const chat=curChat();
      chat.calendar=[{id:"k1",kind:"meeting",title:"Dinner at Cafe Nero",who:"Aria",charIds:["q_a"],withUser:true,executor:"both",day:6,period:"Midday",done:false},
                     {id:"k2",kind:"meeting",title:"Walk in the park",who:"Aria",charIds:["q_a"],withUser:true,executor:"user",day:6,period:"Morning",done:false}];
      _ftEntry(chat,"meeting","k1").end("cancelled","Aria called it off.");
      _ftEntry(chat,"meeting","k2").end("failed","It rained all day.");
      const [a,c]=chat.calendar;
      return (a.outcome==="cancelled"&&c.outcome==="missed"&&a.completedDay===6&&a.completedPeriod==="Evening"&&!("cancelled" in a)) ? true : JSON.stringify(chat.calendar); }));
  ok("neither reaches Aria under 'These are done. You lived them'", await pg.evaluate(()=>{
      const v=calendarDoneLine(curChat(),"Aria","q_a",{bare:true});
      return (!/Dinner at Cafe Nero/.test(v)&&!/Walk in the park/.test(v)) ? true : v; }));
  ok("an old save's cancelled/missed flags are read the same way", await pg.evaluate(()=>{
      const chat=curChat();
      chat.calendar.push({id:"k3",kind:"meeting",title:"Old cinema plan",who:"Aria",charIds:["q_a"],withUser:true,day:5,period:"Evening",done:true,cancelled:true,completedDay:5,result:"Called off."});
      const v=calendarDoneLine(chat,"Aria","q_a",{bare:true});
      const e=chatCalendar(chat).find(x=>x.id==="k3");
      return (!/Old cinema/.test(v)&&e.outcome==="cancelled") ? true : v+" / "+JSON.stringify(e); }));
  ok("the calendar shows the failed one as missed, with no ✓, and the cancelled one not at all", await pg.evaluate(()=>{
      const h=_calDoneSection(curChat());
      const i=h.indexOf("Walk in the park"); const row=h.slice(i,i+600);
      return (i>-1&&/didn/.test(row)&&!/#i-check/.test(row)&&!/Dinner at Cafe Nero/.test(h)) ? true : h.slice(0,900); }));
  ok("a meeting closed as 'met' (a text arrival, no result line) IS lived", await pg.evaluate(()=>{
      const chat=curChat();
      chat.calendar.push({id:"k4",kind:"meeting",title:"Aria comes over",who:"Aria",charIds:["q_a"],withUser:true,executor:"Aria",executorId:"q_a",day:5,period:"Evening",done:true,outcome:"met",completedDay:5,completedPeriod:"Evening"});
      const v=calendarDoneLine(chat,"Aria","q_a",{bare:true});
      return /Aria comes over/.test(v) ? true : v; }));

  console.log("\n[End Day with a meeting still ahead today]");
  await setup({day:5,period:"Afternoon"});
  ok("the End Day confirm names what is still ahead", await pg.evaluate(()=>{
      const chat=curChat();
      chat.calendar=[{id:"d1",kind:"meeting",title:"Dinner with Aria",who:"Aria",charIds:["q_a"],charId:"q_a",withUser:true,executor:"user",certainty:"certain",day:5,period:"Evening",done:false,locationId:"l_cafe",where:"Cafe Nero"},
                     {id:"d2",kind:"meeting",title:"Lunch with Aria",who:"Aria",charIds:["q_a"],charId:"q_a",withUser:true,executor:"user",certainty:"certain",day:5,period:"Midday",done:false,locationId:"l_cafe",where:"Cafe Nero"}];
      const s=calPendingTodaySummary(chat);
      return (/Dinner with Aria/.test(s)&&!/Lunch with Aria/.test(s)) ? true : s; }));
  await pg.evaluate(()=>{ const chat=curChat(); chat.gameDay=6; chat.period="Morning"; chat.timeOfDay="Morning";
      plantUnkeptMeetingMemories(chat,5,"Afternoon"); });
  ok("no 'stood up' memory for the dinner whose hour had not come", await pg.evaluate(()=>{
      const m=state.memory.filter(x=>x.source==="unkept_meeting"&&/Dinner/.test(x.content)); return m.length===0 ? true : JSON.stringify(m); }));
  ok("it moves to the same part of the new day, still open", await pg.evaluate(()=>{
      const e=chatCalendar(curChat()).find(x=>x.id==="d1"); return (e.day===6&&e.period==="Evening"&&!e.done) ? true : JSON.stringify(e); }));
  ok("the lunch whose hour HAD passed is remembered as unkept — by Aria, in this world only", await pg.evaluate(()=>{
      const m=state.memory.filter(x=>x.source==="unkept_meeting"&&/Lunch/.test(x.content));
      return (m.length===1&&m[0].ownerId==="q_a") ? true : JSON.stringify(m.map(x=>x.ownerId)); }));
  ok("the next morning nobody is asked \"It's time for…\" about yesterday", await pg.evaluate(async()=>{
      const moved=await resolveDueMeetings(curChat());
      return (window.__asks.length===0&&moved===false) ? true : JSON.stringify(window.__asks); }));
  ok("a second End Day before it lets it lapse quietly, blaming nobody", await pg.evaluate(()=>{
      const chat=curChat(); chat.gameDay=7; plantUnkeptMeetingMemories(chat,6,"Midday");
      const e=chatCalendar(chat).find(x=>x.id==="d1");
      const m=state.memory.filter(x=>x.source==="unkept_meeting"&&/Dinner/.test(x.content));
      return (e.done&&e.outcome==="lapsed"&&m.length===0&&!/Dinner/.test(calendarDoneLine(chat,"Aria","q_a",{bare:true}))) ? true : JSON.stringify(e)+m.length; }));
  ok("Do Not Disturb plants no blame memory", await pg.evaluate(()=>{
      const chat=curChat(); chat.gameDay=9; chat.dnd=true;
      chat.calendar.push({id:"d3",kind:"meeting",title:"Breakfast with Mara",who:"Mara",charIds:["q_m"],withUser:true,executor:"user",day:8,period:"Morning",done:false});
      plantUnkeptMeetingMemories(chat,8,"Night");
      const m=state.memory.filter(x=>x.source==="unkept_meeting"&&/Breakfast/.test(x.content));
      return m.length===0 ? true : JSON.stringify(m); }));

  console.log("\n[unkept memories: this universe, real participants]");
  await setup({day:4,period:"Morning"});
  ok("a plan naming 'Aria' (no ids) reaches this world's Aria, not the other world's", await pg.evaluate(()=>{
      const chat=curChat();
      chat.calendar=[{id:"u1",kind:"meeting",title:"Coffee",who:"Aria",withUser:true,day:3,period:"Morning",done:false},
                     {id:"u2",kind:"meeting",title:"Errand nobody was on",who:"",withUser:true,day:3,period:"Morning",done:false}];
      plantUnkeptMeetingMemories(chat,3,"Night");
      const m=state.memory.filter(x=>x.source==="unkept_meeting");
      const owners=m.map(x=>x.ownerId).sort().join(",");
      return owners==="q_a" ? true : "owners: "+owners; }));
  ok("planHasChar: a participant-less plan belongs to nobody in strict mode, to the reader otherwise", await pg.evaluate(()=>{
      const e={who:""}; return (planHasChar(e,"q_a","Aria",true)===false&&planHasChar(e,"q_a","Aria")===true
        &&planHasChar({who:"Canan"},"q_c","Can")===false) ? true : "wrong"; }));

  console.log("\n[due meetings: the person is already here]");
  await setup({day:7,period:"Evening"});
  ok("counterpart present at the meeting place → no 'Do you go now?', closed as met", await pg.evaluate(async()=>{
      const chat=curChat(); chat.presentIds=["q_a"];
      chat.calendar=[{id:"r1",kind:"meeting",title:"Talk things over",who:"Aria",charIds:["q_a"],charId:"q_a",withUser:true,executor:"user",certainty:"certain",day:7,period:"Evening",done:false,locationId:"l_home"}];
      await resolveDueMeetings(chat);
      const e=chat.calendar[0];
      return (window.__asks.length===0&&e.done&&e.outcome==="met") ? true : JSON.stringify({asks:window.__asks,e}); }));
  ok("otherwise the question offers Go / Later / Skip it — no 'Not now'", await pg.evaluate(async()=>{
      const chat=curChat(); chat.presentIds=[]; window.__answer="later";
      chat.calendar=[{id:"r2",kind:"meeting",title:"Visit Aria",who:"Aria",charIds:["q_a"],charId:"q_a",withUser:true,executor:"user",certainty:"certain",day:7,period:"Midday",done:false,locationId:"l_park"}];
      await resolveDueMeetings(chat);
      const a=window.__asks[0]||{};
      return (JSON.stringify(a.choices)===JSON.stringify(["Go now","Later","Skip it"])) ? true : JSON.stringify(a); }));
  ok("'Later' snoozes: open, not asked again this part of the day, no memory", await pg.evaluate(async()=>{
      const chat=curChat(); const e=chat.calendar[0];
      await resolveDueMeetings(chat);
      const m=state.memory.filter(x=>x.source==="calendar_noshow");
      return (!e.done&&e.snoozes===1&&window.__asks.length===1&&m.length===0) ? true : JSON.stringify({e,asks:window.__asks.length,m:m.length}); }));
  ok("…and asked again at the next part of the day", await pg.evaluate(async()=>{
      const chat=curChat(); chat.period="Night"; window.__answer="skip";
      await resolveDueMeetings(chat); return window.__asks.length===2 ? true : window.__asks.length; }));
  ok("'Skip it' does what it says: missed, and Aria remembers it in English, first person", await pg.evaluate(()=>{
      const e=curChat().calendar[0];
      const m=state.memory.filter(x=>x.source==="calendar_noshow"&&x.ownerId==="q_a");
      const t=m[0]&&m[0].content||"";
      return (e.done&&e.outcome==="missed"&&/^I was waiting for Emre/.test(t)&&!/[çğış]/.test(t)) ? true : JSON.stringify({e,t}); }));
  ok("'Attend now' on a likely meeting rolls, and never takes the counterpart along", await pg.evaluate(async()=>{
      const chat=curChat(); chat.period="Evening"; window.__travel=[];
      window.travelTo=async(loc,comp,o)=>{ window.__travel.push({loc,comp}); chat.locationId=loc; };
      const R=Math.random; Math.random=()=>0.99;
      chat.calendar=[{id:"r3",kind:"meeting",title:"Maybe drinks",who:"Aria",charIds:["q_a"],charId:"q_a",withUser:true,executor:"user",certainty:"likely",probability:10,day:9,period:"Evening",done:false,locationId:"l_park"}];
      try{ await attendPlan("r3"); } finally{ Math.random=R; }
      const e=chat.calendar[0];
      return (window.__travel.length===1&&window.__travel[0].comp.length===0&&e.outcome==="no_show"&&!presentIds(chat).includes("q_a")) ? true : JSON.stringify({t:window.__travel,e}); }));

  console.log("\n[date parser fixtures]");
  const cases=[
    ["in two days from now",{day:12}],["3 days from now",{day:13}],["tomorrow at 5",{day:11,period:"Evening"}],
    ["at 12 am",{period:"Night"}],["at 1 tonight",{period:"Night"}],["yarın gece saat ikide",{day:11,period:"Night"}],
    ["dinner at 7",{period:"Evening"}],["öğlen buluşalım",{period:"Midday"}],["öğleden sonra gel",{period:"Afternoon"}],
    ["this Friday dinner",{day:null,period:"Evening"}],["see you 9pm",{period:"Night"}],["at 21:00",{period:"Night"}],
    ["saat 9",{period:"Morning"}],["akşamüstü saat beş",{period:"Evening"}],["lunch at 1",{period:"Midday"}],
    ["the festival lasts three days",{day:null}],["on Friday",{day:null,period:null}]];
  const got=await pg.evaluate(cs=>cs.map(([t])=>_calInferDayPeriod(t,10)),cases);
  cases.forEach(([t,want],i)=>{ const g=got[i];
    const good=Object.keys(want).every(k=>g[k]===want[k]);
    ok(`"${t}" → ${JSON.stringify(want)}`, good, JSON.stringify(g)); });

  console.log("\n[a filed meeting's day and period are checked]");
  await setup({day:10,period:"Afternoon"});
  await pg.evaluate(async()=>{
    window.__cc=(msgs,op)=>JSON.stringify({new:[
      {title:"Picnic",who:"Aria",executor:"both",dayOffset:-3,period:"Midday",where:"City Park",certainty:"certain"},
      {title:"Gala",who:"Aria",executor:"Aria",dayOffset:400,period:"Evening",certainty:"certain"},
      {title:"Stroll",who:"Mara",executor:"user",dayOffset:2.6,certainty:"certain"},
      {title:"Coffee now-ish",who:"Aria",executor:"Aria",dayOffset:0,certainty:"certain"},
      {title:"Meet the ghost",who:"Zorro",executor:"user",dayOffset:1,period:"Morning",certainty:"certain"}]});
    await runCalendarEngine(curChat(),{fromTracker:true});
  });
  const filed=await pg.evaluate(()=>Object.fromEntries(chatCalendar(curChat()).map(e=>[e.title,{day:e.day,period:e.period,ids:e.charIds}])));
  ok("a negative offset is today, and a part of today already gone moves to tomorrow", filed.Picnic&&filed.Picnic.day===11&&filed.Picnic.period==="Midday", JSON.stringify(filed.Picnic));
  ok("a years-away offset is capped at 60 days", filed.Gala&&filed.Gala.day===70, JSON.stringify(filed.Gala));
  ok("a fractional offset is rounded, and a missing period is the NEXT one, not now", filed.Stroll&&filed.Stroll.day===13&&filed.Stroll.period==="Evening", JSON.stringify(filed.Stroll));
  ok("today with no period is not due at once", filed["Coffee now-ish"]&&filed["Coffee now-ish"].day===10&&filed["Coffee now-ish"].period==="Evening", JSON.stringify(filed["Coffee now-ish"]));
  ok("somebody who is not in this world gets no meeting", !filed["Meet the ghost"], JSON.stringify(filed));
  ok("filed meetings carry the resolved character ids", filed.Picnic&&JSON.stringify(filed.Picnic.ids)==='["q_a"]', JSON.stringify(filed.Picnic));
  ok("the tracker's turn day is used, not a day that moved on", await pg.evaluate(async()=>{
      const chat=curChat(); chat.calendar=[]; chat.gameDay=11; chat.period="Morning";
      window.__cc=()=>JSON.stringify({new:[{title:"Brunch with Mara",who:"Mara",executor:"user",dayOffset:1,period:"Midday",certainty:"certain"}]});
      await runCalendarEngine(chat,{fromTracker:true,at:{day:10,period:"Evening"}});
      const e=chat.calendar[0]; return (e&&e.day===11&&e.period==="Midday") ? true : JSON.stringify(e); }));

  console.log("\n[the dedupe keeps different meetings]");
  ok("'Meet Aria at the cafe' and '…at the park' on the same day are two meetings", await pg.evaluate(()=>{
      const chat=curChat(); chat.calendar=[];
      addCalendarEntry(chat,{title:"Meet Aria at the cafe",who:"Aria",day:12,period:"Afternoon",locationId:"l_cafe",where:"Cafe Nero",source:"auto"});
      const b=addCalendarEntry(chat,{title:"Meet Aria at the park",who:"Aria",day:12,period:"Afternoon",locationId:"l_park",where:"City Park",source:"auto"});
      return (b&&chat.calendar.length===2) ? true : JSON.stringify(chat.calendar.map(e=>e.title)); }));
  ok("lunch and dinner with the same person on the same day are two meetings", await pg.evaluate(()=>{
      const chat=curChat(); chat.calendar=[];
      addCalendarEntry(chat,{title:"Lunch with Aria",who:"Aria",day:12,period:"Midday",source:"auto"});
      const b=addCalendarEntry(chat,{title:"Dinner with Aria",who:"Aria",day:12,period:"Evening",source:"auto"});
      return (b&&chat.calendar.length===2) ? true : JSON.stringify(chat.calendar.map(e=>e.title)); }));
  ok("but a re-wording of the same meeting is still caught", await pg.evaluate(()=>{
      const chat=curChat(); chat.calendar=[];
      addCalendarEntry(chat,{title:"Dinner with Aria at Cafe Nero",who:"Aria",day:12,period:"Evening",locationId:"l_cafe",source:"auto"});
      const b=addCalendarEntry(chat,{title:"Dinner with Aria",who:"Aria",day:12,period:"Evening",locationId:"l_cafe",source:"auto"});
      return (b===null&&chat.calendar.length===1) ? true : JSON.stringify(chat.calendar.map(e=>e.title)); }));
  ok("a similar visit tomorrow does not swallow today's 'on my way'", await pg.evaluate(()=>{
      const chat=curChat(); chat.calendar=[];
      chat.calendar.push({id:"t1",kind:"meeting",title:"Aria comes over to Emre",who:"Aria",charIds:["q_a"],withUser:true,executor:"Aria",executorId:"q_a",day:(chat.gameDay||1)+1,period:"Evening",done:false});
      const e=_textComing(chat,state.personas.find(p=>p.id==="q_a"),"Evening");
      return (e&&e.id!=="t1"&&e.day===chat.gameDay&&chat.calendar.length===2) ? true : JSON.stringify(chat.calendar); }));

  console.log("\n[tracker updates keep ids and places honest]");
  ok("changing who re-points the ids; an unknown place is not stored as a place", await pg.evaluate(()=>{
      const chat=curChat(); chat.calendar=[{id:"f1",kind:"meeting",title:"Chat",who:"Aria",charIds:["q_a"],charId:"q_a",withUser:true,executor:"Aria",executorId:"q_a",day:chat.gameDay+1,period:"Evening",done:false}];
      const E=_ftEntry(chat,"meeting","f1"); E.apply({who:"Mara",where:"Atlantis"});
      const e=chat.calendar[0];
      const a=(JSON.stringify(e.charIds)==='["q_m"]'&&e.executorId==="q_m"&&e.locationId===null&&e.where===""&&e.whereRaw==="Atlantis");
      E.apply({where:"City Park"});
      return (a&&e.locationId==="l_park") ? true : JSON.stringify(e); }));

  console.log("\n[the character sees further than two days, compactly]");
  ok("a plan five days out reaches the payload as FURTHER OFF", await pg.evaluate(()=>{
      const chat=curChat(); chat.calendar=[{id:"w1",kind:"meeting",title:"Aria's wedding",who:"Aria",charIds:["q_a"],withUser:true,executor:"both",day:chat.gameDay+5,period:"Midday",done:false}];
      const v=calendarContextLine(chat,"Aria","q_a",{bare:true}); return /FURTHER OFF: Aria's wedding.*in five days/.test(v) ? true : v; }));

  console.log("\n[attendance persuasion: once per meeting per part of the day, never mid-resolution]");
  ok("two turns in one part of the day make one call; a meeting being resolved makes none", await pg.evaluate(async()=>{
      const chat=curChat(); chat.presentIds=["q_a"];
      chat.calendar=[{id:"a1",kind:"meeting",title:"Maybe cinema",who:"Aria",charIds:["q_a"],withUser:true,executor:"user",certainty:"likely",probability:50,day:chat.gameDay+1,period:"Evening",done:false},
                     {id:"a2",kind:"meeting",title:"Maybe bowling",who:"Aria",charIds:["q_a"],withUser:true,executor:"user",certainty:"likely",probability:50,day:chat.gameDay+2,period:"Evening",done:false,prompted:true}];
      window.__cc=()=>'{"probability":55}'; window.__calls=[];
      await adjustAttendance(chat); await adjustAttendance(chat);
      const n=window.__calls.filter(c=>/Attendance persuasion/.test(c.dbg)).length;
      return n===1 ? true : "calls: "+n; }));

  console.log("\n[promises]");
  ok("'You will not talk to Berk' is not '…to Nil'", await pg.evaluate(()=>_prSame("You will not talk to Berk","You will not talk to Nil")===false));
  ok("'you will' is not 'you will not'", await pg.evaluate(()=>_prSame("You will call Berk tonight","You will not call Berk tonight")===false));
  ok("a real restatement is still the same promise", await pg.evaluate(()=>
      _prSame("You will never tell Hakan about the money","You won't ever tell Hakan about the money")===true
      && _prSame("You promised to keep the secret from Duygu","You will keep the secret from Duygu")===true));
  ok("recordPromise files both Berk and Nil", await pg.evaluate(()=>{
      const chat=curChat(); chat.promises=[];
      recordPromise(chat,{holder:"Aria",to:"Emre",promise:"You will not talk to Berk",kind:"prohibition",shows_as:"when Berk calls"},5);
      recordPromise(chat,{holder:"Aria",to:"Emre",promise:"You will not talk to Nil",kind:"prohibition",shows_as:"when Nil calls"},5);
      return chat.promises.length===2 ? true : JSON.stringify(chat.promises.map(p=>p.promise)); }));
  ok("the cap drops settled entries first and never an open one", await pg.evaluate(()=>{
      const chat=curChat(); chat.gameDay=30; chat.promises=[];
      for(let i=0;i<55;i++) chat.promises.push({id:"o"+i,holderId:"q_a",promise:"open "+i,status:"open",day:25,seenDay:25});
      for(let i=0;i<10;i++) chat.promises.push({id:"k"+i,holderId:"q_a",promise:"kept "+i,status:"kept",day:28,statusDay:28});
      _prPrune(chat,30);
      const open=chat.promises.filter(p=>p.status==="open").length;
      return (chat.promises.length===60&&open===55&&chat.promises.some(p=>p.id==="o0")) ? true : chat.promises.length+" / open "+open; }));
  ok("an open word nobody raised for three weeks lapses — quietly", await pg.evaluate(()=>{
      const chat=curChat(); chat.promises=[{id:"L1",holderId:"q_a",holderName:"Aria",toId:"__user__",promise:"You will write every week",status:"open",day:2}];
      _prPrune(chat,30);
      const pr=chat.promises[0];
      const ctx=promiseContextFor(chat,"q_a","Aria",{});
      return (pr&&pr.status==="lapsed"&&!/write every week/.test(ctx)) ? true : JSON.stringify(pr)+" "+ctx; }));
  ok("the purge flag is saved when there was nothing to purge", await pg.evaluate(async()=>{
      const chat=curChat(); chat.promises=[]; delete chat._prPurged; const r0=chat._rev||0;
      await runPromisePurge(chat);
      return (chat._prPurged===PROMISE_PURGE_RULES&&(chat._rev||0)>r0) ? true : "rev "+r0+"→"+chat._rev; }));

  console.log("\n[texts]");
  await setup({day:8,period:"Evening"});
  ok("two quick texts: one reply at a time, the second written after the first", await pg.evaluate(async()=>{
      const chat=curChat(); const p=state.personas.find(x=>x.id==="q_a");
      let inflight=0,max=0,n=0; const seen=[];
      window.__cc=async(msgs,op)=>{
        if(!/^Text reply/.test((op&&op.dbg)||"")) return "{}";
        inflight++; max=Math.max(max,inflight); const k=++n;
        seen.push(msgs.map(m=>String(m.content)).join("\n"));
        await new Promise(r=>setTimeout(r,250)); inflight--; return "reply number "+k; };
      const a=sendTextMessage(chat,p,"first text");
      for(let i=0;i<40&&!inflight;i++) await new Promise(r=>setTimeout(r,25));
      const b2=sendTextMessage(chat,p,"second text");
      await Promise.all([a,b2]);
      const th=textThreadMsgs(chat,"q_a").map(m=>m.role[0]+":"+m.content);
      return (max===1&&n===2&&/reply number 1/.test(seen[1]||"")&&th.join("|")==="u:first text|u:second text|a:reply number 1|a:reply number 2")
        ? true : JSON.stringify({max,n,th}); }));
  ok("the proactive tick runs once per day AND part of the day", await pg.evaluate(()=>{
      const chat=curChat(); let n=0; const real=window.maybeProactiveText;
      window.maybeProactiveText=async()=>{ n++; return false; };
      try{
        delete chat._textTickPeriod; chat.gameDay=3; chat.period="Evening";
        maybeProactiveTextTick(chat); maybeProactiveTextTick(chat);
        chat.gameDay=5; maybeProactiveTextTick(chat);
      } finally { window.maybeProactiveText=real; }
      return n===2 ? true : "ticks: "+n; }));
  ok("End Day's forced text respects Do Not Disturb", await pg.evaluate(async()=>{
      const chat=curChat(); chat.dnd=true; window.__calls=[];
      const r=await maybeProactiveText(chat,{force:true}); chat.dnd=false;
      return (r===false&&window.__calls.length===0) ? true : "sent anyway"; }));
  ok("an arrival by text closes only the meeting it was for", await pg.evaluate(async()=>{
      const chat=curChat(); chat.presentIds=[]; chat.period="Evening";
      chat.calendar=[{id:"x1",kind:"meeting",title:"Aria comes over",who:"Aria",charIds:["q_a"],withUser:true,executor:"Aria",executorId:"q_a",day:chat.gameDay,period:"Evening",done:false,locationId:"l_home"},
                     {id:"x2",kind:"meeting",title:"Late drink at Cafe Nero",who:"Aria",charIds:["q_a"],withUser:true,executor:"both",day:chat.gameDay,period:"Night",done:false,locationId:"l_cafe"}];
      await _textArrive(chat,state.personas.find(p=>p.id==="q_a"));
      const [a,c]=chat.calendar;
      return (a.done&&a.outcome==="met"&&!c.done) ? true : JSON.stringify(chat.calendar); }));
  ok("_textArc survives a save (_slimChat)", await pg.evaluate(()=>{
      const chat=curChat(); chat._textArc={q_a:{start:4,summary:"about the trip"}};
      const s=_slimChat(chat); return (s._textArc&&s._textArc.q_a&&s._textArc.q_a.start===4) ? true : JSON.stringify(Object.keys(s)); }));

  console.log("\n[goals curator, strings]");
  ok("a character quest created today moves the goals score", await pg.evaluate(()=>{
      const chat=curChat(); const uni=universeById(chat.universeId); const p=state.personas.find(x=>x.id==="q_a");
      uni.gameData=uni.gameData||{}; const before=_goalsMoveScore(chat,p,40,uni.id);
      _charQuests(uni).push({id:"cq_t",holderId:"q_a",status:"active",createdDay:40,progress:[]});
      const after=_goalsMoveScore(chat,p,40,uni.id);
      uni.gameData.charQuests=_charQuests(uni).filter(q=>q.id!=="cq_t");
      return after-before===3 ? true : before+"→"+after; }));
  ok("the day marker and the new-plan line follow the story language", await pg.evaluate(()=>{
      const L=state.storyLang; state.storyLang="en";
      const a=dayMarkerLine(3,4); const chat=curChat(); _announceTaskLine(chat,"plan","Picnic");
      const last=chat.messages[chat.messages.length-1].content; state.storyLang=L;
      return (a==="— Day 3 is over. Day 4 begins. —"&&last==="— New plan: Picnic —") ? true : a+" / "+last; }));
  ok("the tracker prompt no longer offers 'on Friday'", await pg.evaluate(()=>!/on Friday/.test(X_ENGINE_PROMPTS.x_future_tracker.def)&&/counts days by number only/.test(DEFAULT_CAL)));

  ok("no page errors", errs.length===0, errs.join("\n"));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail?1:0);
})();
