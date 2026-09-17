/* v61.1 — THE PAYLOAD ARGUING WITH THE DATA.
   An audit of two live payloads found three modules asserting three different states of the same
   plot fact, and a format rule losing to an example the payload itself supplied. This test pins
   every fix in that batch, each against the failure that produced it.
   Run: node tests/payload-contradiction.browser.js */
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage({viewport:{width:412,height:915}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file:///home/user/Multirp/index.html'); await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(900);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x||c).slice(0,500));} };

  // one cast, one calendar, reused by the first three groups
  await pg.evaluate(()=>{
    const uni=state.universes[0];
    const mk=(id,name)=>({id,name,universeId:uni.id,instructions:"x",personality:"x",
      backstory:"x",style:"x",goals:"x",look:{}});
    if(!state.personas.some(p=>p.id==="p_b"))state.personas.push(mk("p_b","Burcu"));
    if(!state.personas.some(p=>p.id==="p_k"))state.personas.push(mk("p_k","Burak"));
    const chat=curChat();
    chat.gameDay=4; chat.period="Midday"; chat.timeOfDay="Midday";
    chat.calendar=[];
  });

  console.log("\n[calendar_done reports WHEN it happened, not when it was pencilled in]");
  ok("an entry stamped later than now is withheld, not asserted as lived", await pg.evaluate(()=>{
      const chat=curChat();
      chat.calendar=[{id:"c1",kind:"meeting",title:"Tell Burak the truth about last night",
        who:"Burcu, Burak",day:4,period:"Evening",done:true,completedDay:4,completedPeriod:"Evening",
        result:"She told him."}];
      return calendarDoneLine(chat,"Burcu","p_b",{bare:true})===""
        ? true : calendarDoneLine(chat,"Burcu","p_b",{bare:true}); }));
  ok("the same entry, stamped when it actually resolved, IS reported", await pg.evaluate(()=>{
      const chat=curChat();
      chat.calendar[0].completedPeriod="Morning";
      const t=calendarDoneLine(chat,"Burcu","p_b",{bare:true});
      return /Morning/.test(t)&&!/Evening/.test(t) ? true : t; }));
  ok("and a day that is today reads as earlier today, never as a time still to come",
     await pg.evaluate(()=>{
      const t=calendarDoneLine(curChat(),"Burcu","p_b",{bare:true});
      return /earlier today/.test(t) ? true : t; }));
  ok("the reconciler is asked for the hour and validates it against the period list",
     await pg.evaluate(()=>/ALSO give "period"/.test(DEFAULT_CAL_RECONCILE)
       && /PERIODS\.includes\(r\.period\)/.test(String(reconcileCalendarDay))));
  ok("a completed result is trimmed on a word boundary, never mid-word", await pg.evaluate(()=>
      !/String\(r\.result\|\|""\)\.trim\(\)\.slice/.test(String(reconcileCalendarDay))
   && /briefDesc\(String\(r\.result/.test(String(reconcileCalendarDay))));

  console.log("\n[a goal the calendar says is done is not a goal]");
  ok("a want a finished entry settles leaves the section", await pg.evaluate(()=>{
      const B=state.personas.find(p=>p.id==="p_b");
      B.goalsLive={lines:["Tell Burak the truth about last night with Emre.",
                          "Keep Aslan out of all of it."],day:3,at:Date.now()};
      const live=liveGoalsLines(B);
      return live.length===1 && /Aslan/.test(live[0]) ? true : JSON.stringify(live); }));
  ok("but the stored list is untouched, and the curator still sees the raw one",
     await pg.evaluate(()=>{
      const B=state.personas.find(p=>p.id==="p_b");
      return B.goalsLive.lines.length===2 && liveGoalsLines(B,{raw:true}).length===2; }));
  ok("nothing is suppressed by an entry the character is not even being told about yet",
     await pg.evaluate(()=>{
      const B=state.personas.find(p=>p.id==="p_b");
      curChat().calendar[0].completedPeriod="Evening";        // back into the future
      const n=liveGoalsLines(B).length;
      curChat().calendar[0].completedPeriod="Morning";
      return n===2 ? true : "suppressed anyway ("+n+" of 2)"; }));
  ok("the curator is handed what already happened, with a rule attached to it",
     await pg.evaluate(()=>/WHAT THEY ALREADY DID/.test(String(_curateGoalsFor))
       && /WHAT THEY ALREADY DID names it as finished/.test(DEFAULT_GOALS_CURATOR)));
  ok("and so is the drives writer, which reads the current want-list rather than the frozen field",
     await pg.evaluate(()=>/bits\.done=calendarDoneLine/.test(String(_writePsyche))
       && /engineGoals\(p,400\)/.test(String(_writePsyche))
       && /ALREADY HAPPENED means already happened/.test(DEFAULT_PSYCHE)));

  console.log("\n[the example stops beating the rule]");
  ok("the LIMITS rule is in the solo and multi layouts, not only in gm", await pg.evaluate(()=>{
      const miss=["solo","multi","gm"].filter(k=>ptPreset(k).indexOf("{{call//head_format_limits}}")<0);
      return miss.length?miss.join(", "):true; }));
  ok("and it is the rule that caps the beats", await pg.evaluate(()=>
      /At most ONE narration and ONE thought per reply/.test(blkTpl("head_format_limits"))));
  ok("the older quoted line is a gist, and says so rather than showing a shape",
     await pg.evaluate(()=>/in gist/.test(blkTpl("already_said_shortened"))
       && !/shape/.test(blkTpl("already_said_shortened"))));
  ok("the newest line is still verbatim — only exact words can enforce 'do not say this again'",
     await pg.evaluate(()=>/word for word/.test(blkTpl("already_said_verbatim"))));
  ok("and the block says to count beats against the rules, not against what it quotes",
     await pg.evaluate(()=>/Count your beats against the rules/.test(blkTpl("already_said_not_style"))));

  console.log("\n[exposure is not leak-chance]");
  ok("a public venue never reads as private, however quiet its corner", await pg.evaluate(()=>{
      const pub={id:"l_pub",name:"Beach Club",type:"venue"};
      const lab=exposureLabel(pub,0.05);
      return /semi-public/.test(lab) ? true : lab; }));
  ok("a home still does", await pg.evaluate(()=>{
      const home={id:"l_h",name:"Atan Residence",type:"home"};
      return /private \(nothing said here gets out\)/.test(exposureLabel(home,0)) ? true
           : exposureLabel(home,0); }));
  ok("and a genuinely public one is not floored downward", await pg.evaluate(()=>
      /very public/.test(exposureLabel({type:"venue"},0.9))));
  ok("alone at a public place says strangers are there; alone at home does not",
     await pg.evaluate(()=>/PUBLIC place/.test(blkTpl("scene_alone_public"))
       && !/PUBLIC place/.test(blkTpl("scene_alone"))
       && /scene_alone_public/.test(String(buildTailBlocks))));

  console.log("\n[a claim over a person is not a word you are owed]");
  ok("an unrecognised kind is dropped rather than filed as a promise", await pg.evaluate(()=>{
      const chat=curChat(); chat.promises=[];
      const r=recordPromise(chat,{holder:"Burcu",to:state.user,promise:"he does not stop",kind:""},4);
      return r===null && chatPromises(chat).length===0 ? true : JSON.stringify(r); }));
  ok("a real commitment still records", await pg.evaluate(()=>{
      const chat=curChat();
      const r=recordPromise(chat,{holder:"Burcu",to:state.user,promise:"never to lie to you again",
        kind:"prohibition",ask:"because it would start the whole thing again"},4);
      return !!r && r.kind==="prohibition" ? true : JSON.stringify(r); }));
  ok("the extractor is told what a claim over a person is", await pg.evaluate(()=>
      /A CLAIM OVER A PERSON/.test(DEFAULT_PROMISES)
   && /Who is BOUND, and what did THEY undertake to do/.test(DEFAULT_PROMISES)));
  ok("and the heading no longer invites a claim to be read as an oath", await pg.evaluate(()=>
      /claim somebody made ABOUT you/.test(blkTpl("promise_owed"))));

  console.log("\n[a tracker a character cannot act on]");
  ok("a staged tracker that has reached no stage is withheld from its owner", await pg.evaluate(()=>{
      const uni=state.universes[0];
      uni.trackers=[{id:"t_p",name:"Pregnancy",owner:"__story__",min:0,max:280,start:0,
        behavior:"up",method:"trigger_then_day",
        stages:[{at:1,text:"newly conceived (unaware)"},{at:90,text:"visibly showing"}]}];
      state.trackOn=true;
      const chat=curChat(); chat.trackerVals={};
      const t=trackerContext(chat,"p_b");
      return t.indexOf("Pregnancy")===-1 ? true : t; }));
  ok("once a stage is reached it is shown in words, with no raw count", await pg.evaluate(()=>{
      const chat=curChat(); const tr=curTrackers()[0];
      setTrackerValOwner(chat,tr,"__story__",120);
      const t=trackerContext(chat,"p_b");
      return /visibly showing/.test(t) && !/120/.test(t) && !/280/.test(t) ? true : t; }));
  ok("the director's omniscient view keeps the arithmetic", await pg.evaluate(()=>{
      const t=trackerContext(curChat(),null);
      return /120/.test(t) ? true : t; }));

  console.log("\n[a narrator beat is not something this character wrote]");
  ok("world beats, presence notes and day markers leave the assistant role", await pg.evaluate(()=>{
      const a=mapMsgToApi({narratorEvent:true,content:"— The wind got up. —"});
      const b=mapMsgToApi({presenceNote:true,content:"— Emre has arrived —"});
      const c=mapMsgToApi({dayMarker:true,content:"Day 5",narration:"Morning."});
      return [a,b,c].every(m=>m.role==="user"&&m.name==="Narrator") ? true : JSON.stringify([a,b,c]); }));
  ok("and stay self-identifying without the name, which some providers drop", await pg.evaluate(()=>
      /^\[NARRATION/.test(mapMsgToApi({narratorEvent:true,content:"x"}).content)));
  ok("a character's own line is untouched", await pg.evaluate(()=>{
      const m=mapMsgToApi({role:"assistant",speaker:"Burcu",content:"Selam."});
      return m.role==="assistant"&&m.name==="Burcu" ? true : JSON.stringify(m); }));

  console.log("\n[the physical-ask clause fires when there is an action to read]");
  ok("it is gated on a narrated span rather than shipped unconditionally", await pg.evaluate(()=>
      /_act && blkTpl\("resistance_actions"\)/.test(String(buildTailBlocks))));
  /* (!) The window is bounded on purpose. `_psycheBodySig` looks like the helper for this and is
     not — it scans backwards until it has six spans, with no message limit, so in any chat that
     has ever carried narration the gate would never shut. */
  ok("and on a BOUNDED window, so a span fifty turns ago cannot hold it open", await pg.evaluate(()=>
      /slice\(-6\)/.test(String(buildTailBlocks))
   && !/_psycheBodySig\(chat\)\s*;?\s*\}\s*catch/.test(String(buildTailBlocks))));
  ok("the ladder itself is not gated — it is the counterweight", await pg.evaluate(()=>
      /B\.resistance=`\$\{blkTpl\("resistance_header"\)\}/.test(String(buildTailBlocks))));

  console.log("\n[a fragment's own blank line does not leak out of a dropped block]");
  /* The four byte-identity failures across parity-live, bare-pieces, video-cues and language-rule
     were all this: `drive_ego` is inlined into the template as fixed prose, it contains a blank
     line, and that blank line split the one paragraph the auto-drop needs in order to remove the
     whole piece. So the closing note shipped on every turn the psyche engine had not written for. */
  ok("inlined prose keeps its blank lines as {{gap}}, which stays inside the paragraph",
     await pg.evaluate(()=>{
      const t=ptPieceTemplate("drives","solo");
      return !/\n[ \t]*\n/.test(t) && /\{\{gap\}\}/.test(t) ? true : JSON.stringify(t).slice(0,300); }));
  ok("so a turn with no drives at all ships none of the block", await pg.evaluate(()=>{
      const chat=curChat(); delete chat._psyche;
      const P=state.personas.find(p=>p.id==="p_b");
      const B=buildTailBlocks({chat,selfP:P,selfId:P.id,selfName:P.name,targetName:state.user,
        targetId:"__user__",multi:false,injected:{recent:[],diary:[],longterm:[]}});
      return !B.drives ? true : B.drives.slice(0,200); }));

  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log("\n  "+pass+" passed, "+fail+" failed");
  await b.close();
  process.exit(fail?1:0);
})();
