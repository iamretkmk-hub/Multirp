/* v137.1 — WHO IS COMING OVER IS READ FROM WHAT THEY SAID.
   Two reports, one cause. A regex over the PLAYER's text ("gel", "come over") filed a certain
   "<char> is coming to you" meeting without reading the reply, so a character who had just said no
   was walked in anyway. And a character texting "I'm at the door", "I'm in" changed nothing in the
   story — nothing executed it. One judge (x_text_arrival) now reads the thread after every text the
   character sends and answers from their words: arrived → they enter the player's scene now;
   coming → a certain meeting today at the player's place; none → nothing.
   Run: node tests/text-arrival.browser.js */
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage({viewport:{width:412,height:915}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file://'+require('path').resolve(__dirname,'..','index.html'));
  await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(800);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x||c).slice(0,700));} };

  // A stubbed model: the judge answers whatever the test sets; everything else gets a short line.
  const setup=()=>pg.evaluate(()=>{
    const uni=state.universes[0];
    if(!state.personas.some(p=>p.id==="t_o")) state.personas.push({id:"t_o",name:"Ozlem",universeId:uni.id,
      instructions:"x",personality:"x",backstory:"x",style:"x",goals:"x",look:{subject:"Woman"}});
    state.user="Emre"; state.key="test"; state.textsOn=true; state.calOn=true; state.mem=false;
    const chat=curChat();
    chat.gameDay=8; chat.period="Evening"; chat.presentIds=[]; chat.location="Emre's House";
    delete chat.activeEvent; chat.dnd=false;
    chat.calendar=[]; chat.messages=[{mid:"s1",role:"user",content:"I sit on the couch.",present:[]}];
    if(chat.worldPositions) delete chat.worldPositions.t_o;
    window.__judge='{"move":"none"}'; window.__judgeSeen=[];
    if(!window.__realCC) window.__realCC=window.chatCompletion;
    window.chatCompletion=async(msgs,model,o)=>{
      const dbg=(o&&o.dbg)||"";
      if(/^Text arrival/.test(dbg)){ window.__judgeSeen.push(msgs); return window.__judge; }
      if(/^Text reply/.test(dbg)) return window.__reply||"Tamam.";
      if(/move|arriv/i.test(dbg)) return "Ozlem walks in, shaking the rain off her coat.";
      return "";
    };
    markChatDirty(chat);
  });
  const ozlem='state.personas.find(p=>p.id==="t_o")';
  const settle=()=>pg.waitForTimeout(250);

  console.log("\n[a refusal files nothing — the old regex false positive]");
  await setup();
  await pg.evaluate(async()=>{ window.__reply="Hayir, bu aksam gelemem."; window.__judge='{"move":"none","why":"she said no"}';
    await sendTextMessage(curChat(),state.personas.find(p=>p.id==="t_o"),"Neden bana gelmiyorsun? Gel hadi."); });
  await settle();
  ok("\"gel\" in the player's text plus a no creates no meeting", await pg.evaluate(()=>{
      const c=chatCalendar(curChat()); return c.length===0 ? true : JSON.stringify(c.map(e=>e.title)); }));
  ok("and nobody walks in", await pg.evaluate(()=>!presentIds(curChat()).includes("t_o")));
  ok("the judge read her answer, not just the invitation", await pg.evaluate(()=>{
      const m=window.__judgeSeen[0]; if(!m) return "the judge never ran";
      const all=m.map(x=>String(x.content)).join("\n");
      return (/Hayir, bu aksam gelemem/.test(all)&&/Gel hadi/.test(all)) ? true : all.slice(-800); }));
  ok("the old regex path is gone", await pg.evaluate(()=>typeof maybeTextInvite==="undefined"&&typeof _TEXT_INVITE_RX==="undefined"));

  console.log("\n[\"on my way\" files a meeting that the resolver can walk in]");
  await setup();
  await pg.evaluate(async()=>{ window.__reply="Tamam, yola ciktim."; window.__judge='{"move":"coming","period":"now"}';
    await sendTextMessage(curChat(),state.personas.find(p=>p.id==="t_o"),"Gelsene."); });
  await settle();
  ok("a certain meeting for now, at the player's place, with her travelling", await pg.evaluate(()=>{
      const chat=curChat(); const c=chatCalendar(chat);
      if(c.length!==1) return "entries: "+c.length;
      const e=c[0];
      return (e.day===8&&e.period==="Evening"&&e.certainty==="certain"&&meetMode(e)==="char"
              &&e.executorId==="t_o"&&e.where==="Emre's House"&&planDueNow(chat,e)&&_planIncludesUser(e))
        ? true : JSON.stringify(e); }));
  ok("a second \"coming\" does not double it", await pg.evaluate(async()=>{
      await runTextArrival(curChat(),state.personas.find(p=>p.id==="t_o"));
      return chatCalendar(curChat()).length===1 ? true : "entries: "+chatCalendar(curChat()).length; }));
  ok("a plan already made with her today is moved here instead of doubled", await pg.evaluate(async()=>{
      const chat=curChat(); chat.calendar=[];
      addCalendarEntry(chat,{kind:"meeting",source:"auto",title:"Go to Ozlem's tonight",who:"Ozlem",executor:"user",
        withUser:true,charId:"t_o",day:8,period:"Night",where:"Ozlem's flat",certainty:"likely",probability:40});
      window.__judge='{"move":"coming","period":"Night"}';
      await runTextArrival(chat,state.personas.find(p=>p.id==="t_o"));
      const c=chatCalendar(chat);
      return (c.length===1&&meetMode(c[0])==="char"&&c[0].where==="Emre's House"&&c[0].period==="Night"&&c[0].certainty==="certain")
        ? true : JSON.stringify(c); }));
  ok("a period already past is never scheduled into the past", await pg.evaluate(async()=>{
      const chat=curChat(); chat.calendar=[]; window.__judge='{"move":"coming","period":"Morning"}';
      await runTextArrival(chat,state.personas.find(p=>p.id==="t_o"));
      const c=chatCalendar(chat); return (c[0]&&c[0].period==="Evening") ? true : JSON.stringify(c); }));

  console.log("\n[\"I'm at the door\" brings her in now]");
  await setup();
  await pg.evaluate(async()=>{
    const chat=curChat();
    addCalendarEntry(chat,{kind:"meeting",source:"auto",title:"Ozlem comes over tonight",who:"Ozlem",executor:"Ozlem",
      executorId:"t_o",withUser:true,charId:"t_o",day:8,period:"Night",where:"Emre's House",certainty:"certain"});
    window.__reply="Kapidayim, ac hadi."; window.__judge='{"move":"arrived"}';
    await sendTextMessage(chat,state.personas.find(p=>p.id==="t_o"),"Hazirim.");
  });
  await pg.waitForTimeout(500);
  ok("she is in the scene", await pg.evaluate(()=>presentIds(curChat()).includes("t_o")));
  ok("with a narrated arrival in the story", await pg.evaluate(()=>{
      const n=curChat().messages.filter(m=>m.presenceNote||m.narratorEvent).map(m=>m.content).join(" | ");
      return /Ozlem/.test(n) ? true : n; }));
  ok("the meeting she came for is closed as kept", await pg.evaluate(()=>{
      const e=chatCalendar(curChat())[0]; return (e&&e.done===true&&e.outcome==="met") ? true : JSON.stringify(e); }));
  ok("once she is here, the judge is not asked again", await pg.evaluate(async()=>{
      const n=window.__judgeSeen.length;
      await runTextArrival(curChat(),state.personas.find(p=>p.id==="t_o"));
      return window.__judgeSeen.length===n; }));

  console.log("\n[never walked in on a live scene event]");
  await setup();
  ok("during an event she is filed as due instead", await pg.evaluate(async()=>{
      const chat=curChat(); chat.activeEvent={resolved:false,summary:"x"};
      window.__judge='{"move":"arrived"}';
      await runTextArrival(chat,state.personas.find(p=>p.id==="t_o"));
      const c=chatCalendar(chat); delete chat.activeEvent;
      return (!presentIds(chat).includes("t_o")&&c.length===1&&planDueNow(chat,c[0])) ? true : JSON.stringify(c); }));

  console.log("\n[an unprompted \"I'm outside\" counts too]");
  await setup();
  ok("a proactive text runs the judge", await pg.evaluate(async()=>{
      window.__judge='{"move":"arrived"}';
      deliverProactiveText(curChat(),state.personas.find(p=>p.id==="t_o"),"Disaridayim, in asagi!","");
      await new Promise(r=>setTimeout(r,400));
      return (window.__judgeSeen.length===1&&presentIds(curChat()).includes("t_o")) ? true
        : "judge calls "+window.__judgeSeen.length+", present "+presentIds(curChat()).join(","); }));

  console.log("\n[the prompt is a registry prompt]");
  ok("x_text_arrival has a key, a default and a card", await pg.evaluate(()=>
      !!K.x_text_arrival && /ONLY JSON/.test(up("x_text_arrival"))
      && X_PROMPT_CARDS.some(c=>c.keys.includes("x_text_arrival"))));

  await pg.evaluate(()=>{ if(window.__realCC) window.chatCompletion=window.__realCC; });
  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close(); process.exit(fail?1:0);
})();
