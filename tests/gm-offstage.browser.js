/* v150.94 — a Gamemaster event that happens somewhere else is the player's to read, not the room's. Reported: the Gamemaster
   wrote "Özlem decided to act as if nothing happened and started deleting her messages with Emre" while Burcu and Emre were at
   the beach club; it was posted to everyone in the player's area, and Burcu's next payload carried Özlem's private decision as
   narration. Each event now gets one yes/no (x_gm_event_here) before it is posted: here → the scene as before; elsewhere →
   present:[] + worldEvent + gmOffstage, no scene event, no arrival check, nobody reacts; no answer → as before.
   Run: NODE_PATH=/path/to/node_modules node tests/gm-offstage.browser.js */
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:process.env.SM_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage({viewport:{width:412,height:915}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file://'+require('path').resolve(__dirname,'..','index.html')); await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(900);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x===undefined?c:x).slice(0,900));} };

  await pg.evaluate(()=>{
    window.toast=()=>{};
    window.__setup=()=>{
      const uni=state.universes[0]; state.curUniverse=uni.id; state.user="Emre"; state.key="sk-test"; state.sceneOn=true;
      state.personas=state.personas.filter(p=>!/^go_/.test(p.id));
      state.personas.push({id:"go_b",name:"Burcu",universeId:uni.id,look:{}},{id:"go_o",name:"Özlem",universeId:uni.id,look:{}});
      _gmPlaceBreak.until=0; _gmPlaceBreak.fails=0;
      const c=curChat(); Object.assign(c,{universeId:uni.id,presentIds:["go_b"],location:"Kumsal Beach Club",gameDay:2,period:"Midday",_gmBusy:false,
        messages:[{mid:"u1",role:"user",content:'"Gerçekten huzur verici."',present:["go_b"]},{mid:"a1",role:"assistant",speaker:"Burcu",speakerId:"go_b",content:'"Hakikaten öyle ya."',present:["go_b"]}]});
      window.__calls={setup:0,presence:0,react:0,single:0};
      window.setupActiveEvent=async()=>{ __calls.setup++; }; window.runPresenceTracker=async()=>{ __calls.presence++; };
      window.gamemasterReactions=async()=>{ __calls.react++; }; window.playSingleReaction=async()=>{ __calls.single++; };
      window.maybeBuildMemory=()=>{};
      return c; };
    window.__dec=(v,fail)=>{ window.__bodies=[]; const rf=window.__rf||(window.__rf=window.fetch);
      window.fetch=async(u,o)=>{ if(String(u).indexOf("/api/alpha/decisions")<0)return rf(u,o); const body=JSON.parse(o.body); __bodies.push(body);
        if(fail)return new Response(JSON.stringify({error:{message:"boom"}}),{status:500});
        return new Response(JSON.stringify({answers:{here:{noul:v}}}),{status:200}); }; };
    window.__undec=()=>{ if(window.__rf)window.fetch=window.__rf; };
  });

  const EV="Özlem Özüçak, İskenderun dönüşü Buket'in yanında hiçbir şey olmamış gibi davranmaya karar verdi ve Emre'yle olan yazışmalarını tek tek silmeye başladı.";
  const A=await pg.evaluate(async(EV)=>{ const c=__setup(); __dec(0.08);
    try{ await playGamemasterBeat(c,EV); } finally{ __undec(); }
    const m=c.messages[c.messages.length-1], burcu=state.personas.find(p=>p.id==="go_b");
    const hist=JSON.stringify(castHistory(c,burcu,{})), player=JSON.stringify(castHistory(c,null,{}));
    const body=__bodies[0]||{};
    return {posted:m&&m.content===EV,present:m&&m.present,world:!!(m&&m.worldEvent),off:!!(m&&m.gmOffstage),calls:Object.assign({},__calls),
      inBurcu:/silmeye/.test(hist),inPlayer:/silmeye/.test(player),busy:c._gmBusy,
      q:body.questions&&Object.keys(body.questions),st:body.state&&Object.keys(body.state),people:body.state&&body.state.people_here}; },EV);
  ok("an event elsewhere is still posted, for the player to read", A.posted&&A.inPlayer, JSON.stringify(A));
  ok("…with no one in the room as a witness (present:[], worldEvent, gmOffstage)", Array.isArray(A.present)&&A.present.length===0&&A.world&&A.off, JSON.stringify(A));
  ok("…and it never reaches a character's history", A.inBurcu===false, JSON.stringify(A));
  ok("…no scene event, no arrival check, nobody reacts", A.calls.setup===0&&A.calls.presence===0&&A.calls.react===0&&A.calls.single===0&&A.busy===false, JSON.stringify(A.calls));
  ok("the question sees where, who is here (the player too) and the event", JSON.stringify(A.q)==='["here"]'&&A.st.includes("where")&&A.st.includes("event")&&A.people.some(x=>/Emre/.test(x))&&A.people.includes("Burcu"), JSON.stringify(A));

  const B=await pg.evaluate(async()=>{ const c=__setup(); __dec(0.9); const ev="Bar tarafından bir bardak yere düşüp kırılıyor.";
    try{ await playGamemasterBeat(c,ev); } finally{ __undec(); }
    const m=c.messages[c.messages.length-1], burcu=state.personas.find(p=>p.id==="go_b");
    return {present:m.present,off:!!m.gmOffstage,inBurcu:/kırılıyor/.test(JSON.stringify(castHistory(c,burcu,{}))),calls:Object.assign({},__calls)}; });
  ok("an event here is posted to the scene as before: the people here see it and react", JSON.stringify(B.present)==='["go_b"]'&&!B.off&&B.inBurcu&&B.calls.setup===1&&B.calls.presence===1&&B.calls.single===1, JSON.stringify(B));

  const C=await pg.evaluate(async()=>{ const c=__setup(); __dec(0,true); const ev="Something happens.";
    try{ await playGamemasterBeat(c,ev); } finally{ __undec(); }
    const m=c.messages[c.messages.length-1]; return {present:m.present,off:!!m.gmOffstage,calls:Object.assign({},__calls)}; });
  ok("no answer: posted to the scene as before", JSON.stringify(C.present)==='["go_b"]'&&!C.off&&C.calls.setup===1, JSON.stringify(C));

  ok("the question is an editable prompt on the Gamemaster's card", await pg.evaluate(()=>!!X_ENGINE_PROMPTS.x_gm_event_here&&ENGINE_PAYLOAD_DEFS.some(d=>(d.blocks||[]).some(b=>b.promptKey==="x_gm_event_here"))));
  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close(); process.exit(fail?1:0);
})();
