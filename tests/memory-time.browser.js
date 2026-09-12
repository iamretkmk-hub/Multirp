/* v38.7 — WHEN A MEMORY HAPPENED, AND WHY THAT DECIDES WHETHER YOU GET IT BACK.
   Sixteen of the nineteen writers stamped the DAY and not the part of the day. The Memory screen
   could only say "Day 4" — which cannot tell this morning's conversation from the one you are in —
   and the rule that keeps the current scene out of a character's own memories tests the PERIOD, so
   a memory without one could never be excluded. The recent-arcs block ("WHAT HAPPENED JUST BEFORE
   THIS") did not apply the rule at all: it took the newest arcs by date, so two texts sent ten
   minutes ago came back to the sender as the recent past.
   Also here: the day-end "you left me on read" pass, removed. A character who notices your silence,
   resents it, remembers it and writes again sharper cost more immersion than it bought.
   Run: node tests/memory-time.browser.js */
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

  await pg.evaluate(()=>{
    const uni=state.universes[0];
    if(!state.personas.some(p=>p.id==="m_a"))
      state.personas.push({id:"m_a",name:"Ayse",universeId:uni.id,instructions:"x",personality:"x",
        backstory:"x",style:"x",goals:"x",look:{subject:"Woman"}});
    state.user="Kemal"; state.mem=true;
    const chat=curChat();
    chat.gameDay=4; chat.period="Afternoon"; chat.presentIds=["m_a"];
    state.memory=[];
    markChatDirty(chat);
  });

  console.log("\n[every memory of a moment records the moment]");
  ok("a writer that forgets the period gets one anyway", await pg.evaluate(()=>{
      const m=rememberMemory({id:"t1",ownerId:"m_a",character:"Ayse",content:"She counted the till.",
        type:"EXPERIENCE",universeId:curUniverseObj().id,date:Date.now()});
      return (m.gamePeriod==="Afternoon"&&m.gameDay===4) ? true : JSON.stringify({d:m.gameDay,p:m.gamePeriod}); }));
  ok("a writer that sets one keeps it", await pg.evaluate(()=>{
      const m=rememberMemory({id:"t2",ownerId:"m_a",character:"Ayse",content:"Morning at the stop.",
        type:"EXPERIENCE",gameDay:4,gamePeriod:"Morning",universeId:curUniverseObj().id,date:Date.now()});
      return m.gamePeriod==="Morning" ? true : m.gamePeriod; }));
  ok("but a diary page is not pinned to one part of the day", await pg.evaluate(()=>{
      const m=rememberMemory({id:"t3",ownerId:"m_a",character:"Ayse",content:"Day 3, all of it.",
        type:"DIARY",source:"diary",gameDay:3,universeId:curUniverseObj().id,date:Date.now()});
      return m.gamePeriod===undefined||m.gamePeriod==="" ? true : "stamped "+m.gamePeriod; }));
  ok("nor is a condensed era", await pg.evaluate(()=>{
      const m=rememberMemory({id:"t4",ownerId:"m_a",character:"Ayse",content:"That winter.",
        type:"CONSOLIDATED",source:"longterm_condenser",gameDay:1,universeId:curUniverseObj().id,date:Date.now()});
      return m.gamePeriod===undefined||m.gamePeriod==="" ? true : "stamped "+m.gamePeriod; }));
  ok("restoring a backup does NOT re-stamp what it restores", await pg.evaluate(()=>{
      /* An old save's memories already happened, at whatever time they happened. Stamping them with
         the period the restore runs in would read as "this is the scene you are in" and withhold
         them from the character they belong to. */
      const src=String(importRoleplayFile||"");
      return /b\.memory\.forEach\(m=>\{ if\(!ids\.has\(m\.id\)\)state\.memory\.push\(m\)/.test(src)
        ? true : "the restore path goes through rememberMemory"; }));

  console.log("\n[the Memory screen says when]");
  ok("the card shows the day AND the time of day", await pg.evaluate(()=>{
      memFilterOwner="m_a"; show('memory'); renderMemory();
      const h=document.getElementById('memoryList').innerHTML;
      return (/Day 4 · Afternoon/.test(h)&&/Day 4 · Morning/.test(h)) ? true : "not shown"; }));
  ok("a memory that spans time still just says the day", await pg.evaluate(()=>
      memWhenLabel({gameDay:3})==="Day 3" ? true : memWhenLabel({gameDay:3})));
  ok("the editor loads and saves both halves", await pg.evaluate(()=>{
      openMemEditor("t2");
      if(document.getElementById('memEditDay').value!=="4") return "day not loaded";
      if(document.getElementById('memEditPeriod').value!=="Morning") return "period not loaded";
      document.getElementById('memEditPeriod').value="Evening";
      document.getElementById('memEditDay').value="5";
      saveMemEdit();
      const m=state.memory.find(x=>x.id==="t2");
      return (m.gameDay===5&&m.gamePeriod==="Evening") ? true : JSON.stringify({d:m.gameDay,p:m.gamePeriod}); }));
  ok("a new memory is placed in the day it is written in", await pg.evaluate(()=>{
      openMemEditor();
      const before=state.memory.length;
      document.getElementById('memEditContent').value="Hand written.";
      document.getElementById('memEditOwner').value="m_a";
      saveMemEdit();
      const m=state.memory[state.memory.length-1];
      return (state.memory.length===before+1&&m.gameDay===4&&m.gamePeriod==="Afternoon")
        ? true : JSON.stringify({d:m.gameDay,p:m.gamePeriod}); }));

  console.log("\n[the moment you are in is not handed back to you]");
  ok("an arc from this very period is withheld", await pg.evaluate(()=>{
      const got=latestArcs("m_a",[],20).map(m=>m.id);
      return !got.includes("t1") ? true : "t1 came back: "+got.join(","); }));
  ok("but this morning's is not", await pg.evaluate(()=>{
      // t2 was moved to Day 5 Evening by the editor test; put a Morning one back
      rememberMemory({id:"t5",ownerId:"m_a",character:"Ayse",content:"Earlier today.",
        type:"EXPERIENCE",gameDay:4,gamePeriod:"Morning",universeId:curUniverseObj().id,date:Date.now()});
      return latestArcs("m_a",[],20).some(m=>m.id==="t5") ? true : "this morning was withheld too"; }));
  ok("and a memory written before periods existed is never withheld", await pg.evaluate(()=>{
      rememberMemory({id:"t6",ownerId:"m_a",character:"Ayse",content:"From an older save.",
        type:"EXPERIENCE",gameDay:4,gamePeriod:"",universeId:curUniverseObj().id,date:Date.now()});
      const m=state.memory.find(x=>x.id==="t6"); m.gamePeriod="";          // as an old save has it
      return latestArcs("m_a",[],20).some(x=>x.id==="t6") ? true : "an unstamped memory was dropped"; }));
  ok("the same rule the retriever has used since v36.4", await pg.evaluate(()=>{
      // move the clock on: what was "now" becomes ordinary past and comes back
      const chat=curChat(); chat.period="Evening";
      const back=latestArcs("m_a",[],20).some(m=>m.id==="t1");
      chat.period="Afternoon";
      return back ? true : "t1 stayed withheld after the period moved on"; }));

  console.log("\n[nobody is owed a reply]");
  ok("the day-end left-on-read pass is gone", await pg.evaluate(()=>
      typeof reconcileTextsDay==="undefined" ? true : "reconcileTextsDay still exists"));
  ok("and so is the helper that decided a silence was a snub", await pg.evaluate(()=>
      typeof _looksLikeFarewell==="undefined" ? true : "_looksLikeFarewell still exists"));
  ok("the proactive-text prompt no longer asks them to resent it", await pg.evaluate(()=>{
      const t=up("textProactivePrompt");
      return (!/left on read/i.test(t) && !/unanswered/i.test(t))
        ? true : "still in the prompt"; }));
  ok("no memory of being ignored can be written any more", await pg.evaluate(()=>
      !/text_noreply/.test(String(rememberMemory))&&state.memory.every(m=>m.source!=="text_noreply")
        ? true : "an ignored-text memory exists"));

  /* v38.8 — lateness stays as INFORMATION for a reply that is already happening, and never becomes
     a reason to start one. buildTextPayload doubles as the context for the proactive texter, so the
     note went into the "does she text him now?" decision — the same left-on-read pressure v38.7
     removed, arriving through the payload instead of through a score. */
  console.log("\n[a late reply is information, not a prompt to write]");
  await pg.evaluate(()=>{
    const chat=curChat(); const p=(state.personas||[]).find(x=>x.id==="m_a");
    chat.messages=(chat.messages||[]).filter(m=>!m.textMsg);
    // she texted on day 1; it is day 4 and only now is it being answered
    chat.messages.push({mid:"lt1",role:"assistant",speaker:"Ayse",speakerId:"m_a",
      content:"Geliyor musun?",textMsg:true,textWith:"m_a",present:[],gday:1,ts:1});
    state.textsOn=true;
    markChatDirty(chat);
  });
  ok("the reply payload still says how long it sat", await pg.evaluate(async()=>{
      const p=(state.personas||[]).find(x=>x.id==="m_a");
      const pl=await buildTextPayload(curChat(),p);
      return /days ago and they are only replying now/.test(String(pl.tail||""))
          && /days ago/.test(String((pl.blocks||{}).text_timing||""))
        ? true : "the note is missing from the reply payload"; }));
  ok("the decision to text unprompted never sees it", await pg.evaluate(async()=>{
      const p=(state.personas||[]).find(x=>x.id==="m_a");
      const pl=await buildTextPayload(curChat(),p,{timing:false});
      return !/only replying now/.test(String(pl.tail||""))
          && !String((pl.blocks||{}).text_timing||"").trim()
        ? true : "the note reached the proactive context"; }));
  ok("and the proactive texter is the caller that asks for it that way", await pg.evaluate(()=>
      /buildTextPayload\(chat,p,\{timing:false\}\)/.test(String(maybeProactiveText))
        ? true : "maybeProactiveText still builds the payload with the note"));

  ok("no page errors", errs.length===0?true:errs.join(" | "));
  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close(); process.exit(fail?1:0);
})();
