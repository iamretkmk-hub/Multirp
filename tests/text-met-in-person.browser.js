/* v136.1 — A TEXT FOLLOWED BY A MEETING IS NOT A TEXT LEFT ON READ.
   Reported: a character texted the player, the player never answered the text — but the two of them
   then spent a scene together face to face. The next text from that character asked why the player
   was not answering. The character's texts ride the whole day window in castHistory, while their
   in-person dialogue only reaches back one prior scene, so the model saw the text and not the meeting.
   A meeting marker now stands where that meeting was, in the transcript, the engines' text threads
   and the text window.
   Run: node tests/text-met-in-person.browser.js */
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

  // Day 1 morning: Hakan texts. Day 1 evening: Hakan and Emre meet at the cafe (no reply by text).
  // Day 2: Emre is with Burak at home, then walks to the park and texts Hakan.
  const setup=()=>pg.evaluate(()=>{
    const uni=state.universes[0];
    const mk=(id,name)=>({id,name,universeId:uni.id,instructions:"x",personality:"x",
      backstory:"x",style:"x",goals:"x",look:{subject:"Man"}});
    if(!state.personas.some(p=>p.id==="t_h")) state.personas.push(mk("t_h","Hakan"));
    if(!state.personas.some(p=>p.id==="t_b")) state.personas.push(mk("t_b","Burak"));
    state.user="Emre"; delete (state.blockTpls||{}).text_met_in_person;
    const chat=curChat();
    chat.gameDay=2; chat.period="Afternoon"; chat.presentIds=[]; chat.location="Park";
    chat.messages=[
      {mid:"x1",role:"assistant",speaker:"Hakan",speakerId:"t_h",content:"Aksam gorusebilir miyiz?",textMsg:true,textWith:"t_h",present:[],gday:1,gperiod:"Morning"},
      {mid:"tb1",role:"assistant",speaker:"Narrator",narratorEvent:true,travelBeat:true,content:"Emre goes to the cafe.",present:["t_h"]},
      {mid:"c1",role:"user",content:"Geldim, kusura bakma mesajina bakamadim.",present:["t_h"]},
      {mid:"c2",role:"assistant",speaker:"Hakan",speakerId:"t_h",content:"Onemli degil, iyi ki geldin.",present:["t_h"],
        status:{day:1,period:"Evening",location:"Cafe"}},
      {mid:"dm",role:"assistant",narratorEvent:true,dayMarker:true,dayFrom:1,dayTo:2,content:"Day 2",present:[]},
      {mid:"tb2",role:"assistant",speaker:"Narrator",narratorEvent:true,travelBeat:true,content:"Emre is home.",present:["t_b"]},
      {mid:"h1",role:"user",content:"Kahve?",present:["t_b"]},
      {mid:"h2",role:"assistant",speaker:"Burak",speakerId:"t_b",content:"Olur.",present:["t_b"],status:{day:2,period:"Morning",location:"Home"}},
      {mid:"tb3",role:"assistant",speaker:"Narrator",narratorEvent:true,travelBeat:true,content:"Emre walks to the park.",present:[]},
      {mid:"x2",role:"user",content:"Naber?",textMsg:true,textWith:"t_h",textWithName:"Hakan",present:[],gday:2,gperiod:"Afternoon"}
    ];
    markChatDirty(chat);
  });
  const hakanHist=()=>pg.evaluate(()=>castHistory(curChat(),state.personas.find(p=>p.id==="t_h"))
    .map(m=>m.role+"|"+m.content));

  await setup();
  console.log("\n[the reported case: a text, then a meeting the scene cut drops]");
  const h=await hakanHist();
  ok("the cafe dialogue is not in Hakan's transcript (the scenario reproduces the cut)",
     !h.some(l=>/iyi ki geldin/.test(l)), h.join("\n"));
  const iText=h.findIndex(l=>/Aksam gorusebilir/.test(l)), iMeet=h.findIndex(l=>/face to face/.test(l)),
        iNew=h.findIndex(l=>/Naber/.test(l));
  ok("a meeting marker stands between his text and the player's new one",
     iText>-1 && iMeet>iText && iNew>iMeet, h.join("\n"));
  ok("it says when and where they met", /yesterday \(evening\) at Cafe/.test(h[iMeet]||""), h[iMeet]);
  ok("and it is a narrator line, not a line the player or Hakan said", /^user\|/.test(h[iMeet]||"") && !/Emre:|Hakan:/.test(h[iMeet]||""), h[iMeet]);
  ok("there is exactly one", h.filter(l=>/face to face/.test(l)).length===1, h.join("\n"));
  ok("Burak's transcript has no marker (they are not his texts)", await pg.evaluate(()=>
      !castHistory(curChat(),state.personas.find(p=>p.id==="t_b")).some(m=>/face to face/.test(m.content))));

  console.log("\n[no marker where none is owed]");
  ok("a meeting still visible in the transcript speaks for itself", await pg.evaluate(()=>{
      const chat=curChat();
      chat.messages=chat.messages.filter(m=>!["dm","tb2","h1","h2"].includes(m.mid));   // the cafe is now the prior scene
      const h=castHistory(chat,state.personas.find(p=>p.id==="t_h")).map(m=>m.content);
      return (h.some(c=>/iyi ki geldin/.test(c)) && !h.some(c=>/face to face/.test(c))) ? true : h.join("\n"); }));
  await setup();
  ok("a text with no meeting after it gets none", await pg.evaluate(()=>{
      const chat=curChat();
      chat.messages=chat.messages.filter(m=>!["tb1","c1","c2"].includes(m.mid));   // the beat into the cafe lists him too
      const h=castHistory(chat,state.personas.find(p=>p.id==="t_h")).map(m=>m.content);
      return !h.some(c=>/face to face/.test(c)) ? true : h.join("\n"); }));
  await setup();
  ok("a meeting BEFORE the first text gets none", await pg.evaluate(()=>{
      const chat=curChat(); const x1=chat.messages.shift();
      chat.messages.splice(chat.messages.findIndex(m=>m.mid==="x2"),0,Object.assign(x1,{gday:2}));
      const h=castHistory(chat,state.personas.find(p=>p.id==="t_h")).map(m=>m.content);
      return !h.some(c=>/face to face/.test(c)) ? true : h.join("\n"); }));

  console.log("\n[the thread the engines and the window read]");
  await setup();
  ok("textThreadWithMeetings sets the meeting in order", await pg.evaluate(()=>{
      const th=textThreadWithMeetings(curChat(),state.personas.find(p=>p.id==="t_h"));
      const s=th.map(m=>m.meetNote?`MEET(${m.gday},${m.gperiod},${m.location})`:m.mid).join(",");
      return s==="x1,MEET(1,Evening,Cafe),x2" ? true : s; }));
  ok("a meeting after the LAST text is kept too (the proactive case)", await pg.evaluate(()=>{
      const chat=curChat(); chat.messages=chat.messages.filter(m=>m.mid!=="x2");
      const th=textThreadWithMeetings(chat,state.personas.find(p=>p.id==="t_h"));
      return (th.length===2 && th[1].meetNote) ? true : JSON.stringify(th.map(m=>m.mid||"MEET")); }));
  await setup();
  ok("the engines' tail keeps the marker among the last texts", await pg.evaluate(()=>{
      const t=_textThreadTail(curChat(),state.personas.find(p=>p.id==="t_h"),1);
      return (t.length===1 && t[0].mid==="x2") ? true : JSON.stringify(t);
    }) === true && await pg.evaluate(()=>{
      const t=_textThreadTail(curChat(),state.personas.find(p=>p.id==="t_h"),2);
      return t.length===3 && t[1].meetNote===true; }));
  ok("the text window shows it", await pg.evaluate(()=>{
      _openTextPid="t_h";
      let box=document.getElementById('textThread');
      if(!box){ box=document.createElement('div'); box.id='textThread'; document.body.appendChild(box); }
      renderTextThread("t_h"); _openTextPid=null;
      const t=box.textContent; return /Met in person/.test(t)&&/Cafe/.test(t) ? true : t; }));

  console.log("\n[the reply payload itself]");
  await setup();
  ok("the text reply Hakan is asked to write carries the marker", await pg.evaluate(async()=>{
      const real=window.chatCompletion; let seen=null;
      window.chatCompletion=async(msgs,model,o)=>{ if(o&&/Text reply/.test(o.dbg||"")&&!seen) seen=msgs; return "Iyiyim."; };
      const chat=curChat(); chat.messages=chat.messages.filter(m=>m.mid!=="x2");
      try{ await sendTextMessage(chat,state.personas.find(p=>p.id==="t_h"),"Naber?"); }
      finally{ window.chatCompletion=real; }
      if(!seen) return "no text reply call was made";
      const all=seen.map(m=>String(m.content)).join("\n");
      const a=all.indexOf("Aksam gorusebilir"), b=all.indexOf("face to face"), c=all.lastIndexOf("Naber?");
      return (a>-1&&b>a&&c>b) ? true : all.slice(-1500); }));

  console.log("\n[the wording is a fragment]");
  await setup();
  ok("editing text_met_in_person changes the marker", await pg.evaluate(()=>{
      state.blockTpls=state.blockTpls||{}; state.blockTpls.text_met_in_person="EDITED {{user}} {{when}}{{where}}";
      const h=castHistory(curChat(),state.personas.find(p=>p.id==="t_h")).map(m=>m.content);
      delete state.blockTpls.text_met_in_person;
      return h.some(c=>c.indexOf("EDITED Emre yesterday (evening) at Cafe")>-1) ? true : h.join("\n"); }));
  ok("and it is claimed, so the fragment editor can reach it", await pg.evaluate(()=>
      Object.keys(REPLY_EXTRA_TPLS).some(k=>REPLY_EXTRA_TPLS[k].includes("text_met_in_person"))));

  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close(); process.exit(fail?1:0);
})();
