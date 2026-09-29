/* v147.2 — QC REPORT #3, ROLEPLAY CORE (out/QC-REPORT-v147.md §1 High #3, §3.1, the §3.3 text payloads).
     - a universe switch mid-turn: no universe-1 engine prompt (memory, trackers, calendar/task/promise
       writers, Gamemaster, Scene Writer, overture judge, short-term read, rumours, routers) carries the
       other story's player, places or setting — the e2e Q3 repro, grown to every post-turn engine;
     - an arriving character's own line is in their `present` (their history and memory);
     - Retry holds the turn lock through the rollback, waits for the discarded reply's analysis, stamps
       the tracker's entries with the line it read, is refused after a Gamemaster / Scene Writer beat,
       leaves a notice on Stop (and a stopped router-2 line keeps its addressee), and a whole-turn Retry
       never re-runs the directors; Heat beat 1 in a group scene is retryable and the bursts follow it;
     - narrator beats (GM, Scene Writer, a no-show) are stamped with earshot, and a GM reaction comes
       from earshot; a reply dropped because the scene moved leaves a notice; Stop in a whisper runs no
       postTurn;
     - refusal detection: the strong verbs in character; "won't be able to write", "As a language model";
     - _thought_ spans leave ^_^, __bold__ and handles alone;
     - the heat headers agree with the POV rail (and a stored copy is upgraded in place);
     - text payloads: the memory query is the thread plus what the texter witnessed, built in the chat's
       own world; the proactive texter never reads another character's thoughts.
   Run: NODE_PATH=/path/to/node_modules node tests/qc3-roleplay.browser.js */
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
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x===undefined?c:x).slice(0,900));} };

  /* Two universes: u1 (player Emre; the Harbour Bar with a Counter and a Back room, and the Kafe) and u2
     (player Mert; "Liman Kalesi"; setting OTHER UNIVERSE SPACESHIP). Roleplay replies go through the REAL
     chatCompletion with a stubbed fetch (so Stop is real); every other call is answered from __stub.bg. */
  await pg.evaluate(()=>{
    window.__calls=[]; window.__toasts=[]; window.__fetches=[]; window.__sent={}; window.__prompts=[];
    const _toast=window.toast; window.toast=(t)=>{ window.__toasts.push(String(t)); try{ _toast(t); }catch(e){} };
    window.__stub={reply:'"Fine."', delay:0, bg:{}, bgDelay:{}};
    window.__sleep=ms=>new Promise(r=>setTimeout(r,ms));
    window.fetch=async(url,init)=>{
      const body=JSON.parse(init.body); window.__fetches.push(body);
      const d=typeof __stub.delay==="function"?__stub.delay(body):__stub.delay;
      if(d) await new Promise(r=>setTimeout(r,d));
      if(init.signal&&init.signal.aborted){ const e=new Error("aborted"); e.name="AbortError"; throw e; }
      const txt=typeof __stub.reply==="function"?__stub.reply(body):__stub.reply;
      return new Response(JSON.stringify({choices:[{message:{content:txt}}]}),{status:200,headers:{'content-type':'application/json'}});
    };
    const real=chatCompletion;
    window.chatCompletion=async(messages,model,opts)=>{
      const dbg=(opts&&opts.dbg)||"";
      window.__calls.push({dbg}); const t=JSON.stringify(messages); window.__sent[dbg]=(window.__sent[dbg]||"")+t; window.__prompts.push({dbg,t});
      if(opts&&opts.rp===true) return real(messages,model,opts);
      const kd=Object.keys(__stub.bgDelay).find(p=>dbg.indexOf(p)===0); if(kd) await new Promise(r=>setTimeout(r,__stub.bgDelay[kd]));
      const k=Object.keys(__stub.bg).sort((a,b)=>b.length-a.length).find(p=>dbg.indexOf(p)===0);
      let r=k?__stub.bg[k]:"{}"; if(typeof r==="function") r=await r(dbg,messages);
      return typeof r==="string"?r:JSON.stringify(r);
    };
    window.__setup=()=>{
      const base=state.universes[0];
      const U=(id,user,setting,locs)=>Object.assign(JSON.parse(JSON.stringify(base)),{id,name:id,userName:user,setting,locations:locs,gameData:{},rules:[],trackers:[],prompts:{}});
      state.universes=[
        U("u1","Emre","ORIGINAL WORLD HARBOUR",[{id:"l_bar",name:"Harbour Bar",description:"b",residents:[],sublocations:[{id:"s_bar",name:"Counter"},{id:"s_back",name:"Back room"}]},
                                              {id:"l_kafe",name:"Kafe",description:"k",residents:[],sublocations:[]}]),
        U("u2","Mert","OTHER UNIVERSE SPACESHIP",[{id:"l_liman",name:"Liman Kalesi",description:"s",residents:[],sublocations:[]}])];
      const mk=(id,n,u)=>({id,name:n,universeId:u,personality:"x",instructions:"x",backstory:"x",style:"x",goals:"x",interject:"x",look:{},relationships:{}});
      state.personas=[mk("p_a","Ayla Demir","u1"),mk("p_b","Berk Kaya","u1"),mk("p_c","Cem Aras","u1"),mk("p2_ayla","Ayla","u2"),mk("p2_x","Xan","u2")];
      Object.assign(state,{key:"k",mem:false,sceneOn:false,gmOn:false,autoRpOn:false,heatOn:false,suggestOn:false,autoSpeak:false,narrMode:false,
        relOn:false,trackOn:false,calOn:false,promiseOn:false,gossipOn:false,intentOn:false,pulseOn:false,roundOn:false,charQuestsOn:false,
        goalPursuitOn:false,textsOn:false,autoImg:false,imgMode:"off",streamReveal:false,fallbackModel:"",storyLang:"en",travelTime:0,mcChainCap:4,stInterval:3,voiceCheckOn:false});
      state.chats={
        c1:{id:"c1",universeId:"u1",castIds:[],presentIds:[],memCounts:{},tempChars:[],activeEvent:null,messages:[],gameDay:2,period:"Afternoon",
            locationId:"l_bar",location:"Harbour Bar",subId:"s_bar",subPos:{},calendar:[],promises:[]},
        c2:{id:"c2",universeId:"u2",castIds:[],presentIds:[],memCounts:{},tempChars:[],activeEvent:null,messages:[],gameDay:1,period:"Morning",
            locationId:"l_liman",location:"Liman Kalesi",calendar:[],promises:[]}};
      state.curUniverse="u1"; state.curChat="c1"; applyUniverseProfile("u1"); state.memory=[]; state.gossip=[];
      __stub.bg={"Turn router · player":'{"addressed":"group","responders":[]}',"Turn router":'{"continue":false}'};
      __stub.reply='"Fine."'; __stub.delay=0; __stub.bgDelay={};
      show('chat'); try{ renderChat(); }catch(e){}
    };
    window.__scene=(who,subs)=>{
      const c=state.chats.c1;
      if(state.curChat!=="c1") enterUniverseChat("u1",true);
      c.presentIds=who.slice(); c.subPos=Object.assign({},subs||{}); who.forEach(id=>{ if(!c.subPos[id])c.subPos[id]="s_bar"; });
      c.subId="s_bar"; c.subSelf=false; c.activeEvent=null; c._presenceLastRun=0; c._presenceSeenMid=null; c.autoPlay=false; c.storyMode=false;
      c.locationId="l_bar"; c.location="Harbour Bar"; c.dayLog=null; c.calendar=[]; c.promises=[]; c.rel={}; c.memDoneIdx=undefined; c.memEvent=null;
      c._stUndo=null; c._stCount=0; c._ftBusy=false; c.futureWatch=[]; c.gmLastCheck=0;
      c.messages=[{mid:newMid(),role:"assistant",speaker:"Ayla Demir",speakerId:"p_a",
        content:'*I set the glass down.* "They closed the harbour today."',present:who.slice(),toId:"__user__",toName:"Emre"}];
      window.__calls=[]; window.__toasts=[]; window.__fetches=[]; window.__sent={}; window.__prompts=[];
      document.getElementById('chatInput').value="";
      try{ renderChat(); }catch(e){}
      return c;
    };
    window.__settle=async(ms)=>{ const t=Date.now(); while(Date.now()-t<(ms||15000)){ await new Promise(r=>setTimeout(r,50));
      if(!_presentPlaying&&!_presentQueue.length&&!chatBusy(state.chats.c1,"turn")) return true; } return false; };
    window.__lines=c=>c.messages.slice(1).map(m=>(m.sysError?"SYS":m.role)+":"+(m.speaker||"")+":"+String(m.content||"").slice(0,40));
    __setup();
  });

  /* ---------------------------------------------------------------------------------------------- */
  console.log("\n[High #3 — a universe switch mid-turn: every post-turn engine stays in the old story]");
  const q3=await pg.evaluate(async()=>{
    __setup(); const c=__scene(["p_a","p_b"]);
    Object.assign(state,{mem:true,relOn:true,stInterval:1,calOn:true,promiseOn:true,charQuestsOn:true,gmOn:true,gmEvery:3,sceneOn:true,gossipOn:true});
    for(let i=0;i<4;i++){ c.messages.push({mid:"h"+i+"u",role:"user",content:"Line "+i,present:["p_a","p_b"]});
      c.messages.push({mid:"h"+i+"a",role:"assistant",speaker:"Berk Kaya",speakerId:"p_b",toId:"__user__",toName:"Emre",present:["p_a","p_b"],content:'"Sure '+i+'."'}); }
    // v148.4 — an answer is judged only with its asker in earshot (settleRumors), so each rumour names one here
    state.gossip=[{id:"g1",universeId:"u1",text:"Berk owes money",heat:0.8,status:"live",_awaitAnswer:true,stakeholderId:"p_b"},{id:"g2",universeId:"u1",text:"Ayla lied",heat:0.8,status:"live",_awaitAnswer:true,stakeholderId:"p_a"}];
    Object.assign(__stub.bg,{
      "Turn router · player":{addressed:"group",responders:["Ayla","Berk"]},
      "Future tracker":{items:[{kind:"meeting",action:"new",stage:"agreed",about:"dinner at the Kafe"},{kind:"task",action:"new",stage:"agreed",about:"fix the boat",holder:"Berk"},{kind:"promise",action:"new",stage:"agreed",about:"keep the secret"}]},
      "Meetings tracker":{new:[{title:"Dinner at the Kafe",who:"Berk Kaya, Emre",executor:"Berk Kaya",dayOffset:0,period:"Evening",where:"Kafe"}]},
      "Task writer":{task:{title:"Fix the boat",holder:"Emre",assigned_by:"Berk Kaya",target:"",desc:"x"}},
      "Memory arc tracker":{progress:"finished",topic:"same",summary:"dinner plans"},
      "Memory (arc)":{content:"We planned dinner.",importance_score:0.6},
      "Gamemaster: judge":{stale:true,trigger:false,reason:"x"},
      "Gamemaster: event":"A stranger walks in with a letter for Berk.",
      "Scene writer: setup":{type:"environment",summary:"a letter"},
      "Scene writer: advance":{narration:"The stranger waits by the door.",resolved:false},
      "Short-term":{desire:1,comfort:1,fear:0,agitation:0,note:"warm"},
      "Rumor judge":{verdict:"open"},"Overture judge":{delta:-0.1,reason:"x"},
      "Turn router · gm reaction":{continue:false}});
    __stub.reply='"Olur, sekizde."'; __stub.delay=300;
    const p=sendMessage({chat:c,text:"Berk, dinner at the Kafe tonight?"});
    await __sleep(60); enterUniverseChat("u2",true);   // the player opens the other story mid-turn
    await p; await __sleep(2500);
    // a second turn's directors with an overture live, still with u2 open
    c.activeEvent={kind:"overture",summary:"Berk reaches out",intent:"closeness",accuserId:"p_b",accuserName:"Berk Kaya",evidence:0.5,conviction:0.5,floor:0,ceiling:0.9,type:"character",turn:0,minTurns:2,maxTurns:6,resolved:false,_startMsg:c.messages.length,participant:{name:"Berk Kaya",charId:"p_b",approaching:false}};
    c.messages.push({mid:"x1",role:"user",content:"I'm glad you came.",present:["p_a","p_b"]});
    await postTurn(c); await __sleep(1200);
    await settleRumors(c,"No, that's not true.");
    const dc=directorContext(c,"gm");
    const leaks=__prompts.filter(x=>/Mert|OTHER UNIVERSE|Liman/.test(x.t)).map(x=>x.dbg);
    const seen=[...new Set(__prompts.map(x=>x.dbg.replace(/ ·.*$/,"")))];
    const out={userNow:state.user, leaks:[...new Set(leaks)], seen,
      dc:{orig:/ORIGINAL WORLD HARBOUR/.test(dc), places:/Harbour Bar/.test(dc)&&/Kafe/.test(dc), other:/Mert|OTHER UNIVERSE|Liman/.test(dc)},
      mem:state.memory.map(m=>JSON.stringify(m.people||[])), quests:((universeById("u1").gameData||{}).quests||[]).map(q=>q.title)};
    enterUniverseChat("u1",true);
    return out;
  });
  const need=["Roleplay reply","Turn router","Future tracker","Meetings tracker","Task writer","Promises & commitments","Memory arc tracker","Memory (arc)","Short-term","Gamemaster: judge","Gamemaster: event","Scene writer: setup","Scene writer: advance","Overture judge","Rumor judge (answer)"];
  ok("every post-turn engine ran after the switch (the check covers them)", need.every(n=>q3.seen.some(s=>s.indexOf(n)===0)), JSON.stringify({missing:need.filter(n=>!q3.seen.some(s=>s.indexOf(n)===0)),seen:q3.seen}));
  ok("no universe-1 prompt carries the other story's player, places or setting (Q3)", q3.leaks.length===0, JSON.stringify(q3.leaks));
  ok("the director brief is this chat's world, even called with another story open", q3.dc.orig&&q3.dc.places&&!q3.dc.other, JSON.stringify(q3.dc));
  ok("memories name this chat's player (not 'with Mert')", q3.mem.length>0&&q3.mem.every(s=>/Emre/.test(s)&&!/Mert/.test(s)), JSON.stringify(q3.mem));
  ok("the task writer files the player's own task as the player's (isMe)", q3.quests.indexOf("Fix the boat")>=0, JSON.stringify(q3.quests));
  ok("the open story's player is untouched", q3.userNow==="Mert", q3.userNow);

  /* ---------------------------------------------------------------------------------------------- */
  console.log("\n[an arriving character's own line is theirs]");
  const arr=await pg.evaluate(async()=>{
    __setup(); const c=__scene(["p_a","p_c"],{p_c:"s_back"});   // Cem stands at another area (an arrival at the entrance)
    __stub.reply='"Evening, everyone."';
    await playCharacterTurn(c,state.personas.find(p=>p.id==="p_c"),"arriving");
    const m=c.messages.find(x=>x.speakerId==="p_c");
    const hist=JSON.stringify(castHistory(c,state.personas.find(p=>p.id==="p_c")));
    return {present:m&&m.present, inHist:/Evening, everyone/.test(hist)};
  });
  ok("the speaker is always in `present` (arrival outside the player's area)", Array.isArray(arr.present)&&arr.present.indexOf("p_c")>=0&&arr.present.indexOf("p_a")>=0, JSON.stringify(arr));
  ok("and their own line is in their history", arr.inHist===true, JSON.stringify(arr));

  /* ---------------------------------------------------------------------------------------------- */
  console.log("\n[Retry holds the turn lock through the rollback]");
  const rl=await pg.evaluate(async()=>{
    __setup(); const c=__scene(["p_a"]);
    __stub.reply='"First answer."';
    await sendMessage({chat:c,text:"How are you?"}); await __settle();
    const old=c.messages[c.messages.length-1];
    const relMem=holdChatLock(c,"memBuild");                    // keep the rollback waiting
    __stub.reply='"Second answer."';
    const r=retryLastReply(old.mid);
    await __sleep(80);
    const during={busy:chatBusy(c,"turn"), btn:document.getElementById('sendBtn').disabled};
    const refused=await sendMessage({chat:c,text:"Hello??"});
    const linesDuring=__lines(c);
    relMem(); await r; await __settle();
    return {during, refused, linesDuring, after:__lines(c), busyAfter:chatBusy(c,"turn"), btnAfter:document.getElementById('sendBtn').disabled};
  });
  ok("the lock is held and Send disabled while the rollback waits", rl.during.busy===true&&rl.during.btn===true, JSON.stringify(rl.during));
  ok("a send in that gap is refused (no second answer, no lost reply)", rl.refused===false&&!rl.linesDuring.some(l=>/Hello\?\?/.test(l)), JSON.stringify(rl));
  ok("the retry lands exactly one new reply, and the lock comes back", rl.after.length===2&&/Second answer/.test(rl.after[1])&&rl.busyAfter===false&&rl.btnAfter===false, JSON.stringify(rl));

  console.log("\n[Retry waits for the discarded reply's analysis]");
  const an=await pg.evaluate(async()=>{
    __setup(); const c=__scene(["p_a"]);
    Object.assign(state,{relOn:true,stInterval:1,calOn:true});
    __stub.bg["Short-term"]={desire:6,comfort:0,fear:0,agitation:0,note:"warm"};
    __stub.bg["Future tracker"]={items:[{kind:"meeting",action:"new",stage:"agreed",about:"dinner"}]};
    __stub.bg["Meetings tracker"]={new:[{title:"Dinner at the Kafe",who:"Ayla Demir, Emre",executor:"Ayla Demir",dayOffset:1,period:"Evening",where:"Kafe"}]};
    __stub.bgDelay={"Short-term":700,"Future tracker":700};
    __stub.reply='"Dinner tomorrow, then."';
    await sendMessage({chat:c,text:"Dinner tomorrow?"}); await __settle();
    const old=c.messages[c.messages.length-1];
    __stub.bgDelay={};
    __stub.reply='"Dinner tomorrow, yes."';
    await retryLastReply(old.mid);                 // pressed while both passes are still out
    await __sleep(1200); await __settle();
    const neu=c.messages[c.messages.length-1];
    const o=c.rel&&c.rel[relDirKey("p_a","__user__")];
    return {oldMid:old.mid,newMid:neu.mid,newText:neu.content,
      cal:(c.calendar||[]).map(e=>({t:e.title,ft:e.ftMid})), episodes:o&&o.episodes&&o.episodes.length, undoMid:c._stUndo&&c._stUndo.mid};
  });
  ok("nothing filed from the discarded reply survives the Retry", an.cal.every(e=>e.ft!==an.oldMid), JSON.stringify(an));
  ok("the new reply's analysis runs and is stamped with the new reply", an.cal.some(e=>e.ft===an.newMid)&&an.undoMid===an.newMid, JSON.stringify(an));
  ok("the discarded reply's feeling read was rolled back (one read, not two)", an.episodes===1, JSON.stringify(an));

  const ft=await pg.evaluate(async()=>{
    __setup(); const c=__scene(["p_a"]); state.calOn=true; state.promiseOn=true;   // promiseOn: the pass awaits its ledger purge first
    c.messages.push({mid:"u1",role:"user",content:"Dinner tomorrow?",present:["p_a"]});
    c.messages.push({mid:"A",role:"assistant",speaker:"Ayla Demir",speakerId:"p_a",toId:"__user__",present:["p_a"],content:'"Maybe."'});
    __stub.bg["Future tracker"]={items:[{kind:"meeting",action:"new",stage:"agreed",about:"dinner"}]};
    __stub.bg["Meetings tracker"]={new:[{title:"Dinner at the Kafe",who:"Ayla Demir, Emre",executor:"Ayla Demir",dayOffset:1,period:"Evening",where:"Kafe"}]};
    const _purge=window.runPromisePurge;
    window.runPromisePurge=async()=>{ c.messages.pop(); c.messages.push({mid:"B",role:"assistant",speaker:"Ayla Demir",speakerId:"p_a",toId:"__user__",present:["p_a"],content:'"Yes, dinner."'}); };
    try{ await runFutureTracker(c); }finally{ window.runPromisePurge=_purge; }
    return (c.calendar||[]).map(e=>e.ftMid);
  });
  ok("the tracker stamps what it files with the line it READ (not the one at pass start)", ft.length===1&&ft[0]==="B", JSON.stringify(ft));

  console.log("\n[Retry is refused after a director beat; heat beat 1 is retryable]");
  const rt=await pg.evaluate(()=>{
    __setup(); const c=__scene(["p_a"]);
    const base=()=>{ c.messages=c.messages.slice(0,1);
      c.messages.push({mid:newMid(),role:"user",content:"Hi",present:["p_a"]});
      c.messages.push({mid:newMid(),role:"assistant",speaker:"Ayla Demir",speakerId:"p_a",toId:"__user__",present:["p_a"],content:'"Hi."'}); };
    base(); const plain=!!_retryTarget(c);
    c.messages.push({mid:newMid(),role:"assistant",speaker:"Narrator",gmBeat:true,narratorEvent:true,present:["p_a"],content:"A glass breaks."});
    const gm=!!_retryTarget(c);
    base(); c.messages.push({mid:newMid(),role:"assistant",speaker:"Narrator",sceneBeat:true,narratorEvent:true,present:["p_a"],content:"The stranger waits."});
    const sw=!!_retryTarget(c);
    base(); c.messages.push({mid:newMid(),role:"assistant",speaker:"Narrator",gmBeat:true,narratorEvent:true,present:["p_a"],content:"A glass breaks."});
    c.messages.push({mid:newMid(),role:"assistant",speaker:"System",sysError:true,retryable:true,retrySpeakerId:"p_a",content:"Stopped"});
    const noticeAfterGm=!!_retryTarget(c);
    base(); c.messages[c.messages.length-1].heatOpen=true; const heatOpen=!!_retryTarget(c);
    return {plain,gm,sw,noticeAfterGm,heatOpen};
  });
  ok("a plain reply is retryable", rt.plain===true, JSON.stringify(rt));
  ok("not after a Gamemaster beat, a Scene Writer beat, or a notice posted after one", rt.gm===false&&rt.sw===false&&rt.noticeAfterGm===false, JSON.stringify(rt));
  ok("heat beat 1 (heatOpen) is retryable", rt.heatOpen===true, JSON.stringify(rt));

  const hg=await pg.evaluate(async()=>{
    __setup(); const c=__scene(["p_a","p_b"]);
    state.heatOn=true; state.heatN=1;
    __stub.bg["Turn router · player"]={addressed:"Ayla",responders:["Ayla"]};
    __stub.reply='"Stay."';
    await sendMessage({chat:c,text:"Come closer."}); await __settle();
    const r1=c.messages[c.messages.length-1];
    const one={heatOpen:!!r1.heatOpen, heatBeat:!!r1.heatBeat, retry:!!_retryTarget(c)};
    state.heatN=2; __stub.reply='"Don\'t stop."';
    await sendMessage({chat:c,text:"Like this?"}); await __settle(); await __sleep(600); await __settle();
    const tail=c.messages.slice(-2).map(m=>({sp:m.speaker,open:!!m.heatOpen,beat:!!m.heatBeat}));
    state.heatOn=false;
    return {one,tail};
  });
  ok("group scene with Heat on: beat 1 is tagged heatOpen (not heatBeat) and Retry is offered", hg.one.heatOpen&&!hg.one.heatBeat&&hg.one.retry, JSON.stringify(hg));
  ok("and the heat run's burst follows it", hg.tail.length===2&&hg.tail[0].open&&hg.tail[1].beat, JSON.stringify(hg));

  console.log("\n[Stop during a Retry, a router-2 line, a whisper]");
  const sr=await pg.evaluate(async()=>{
    __setup(); const c=__scene(["p_a","p_b"]);
    c.messages.push({mid:newMid(),role:"user",content:"Hi both",present:["p_a","p_b"]});
    c.messages.push({mid:newMid(),role:"assistant",speaker:"Ayla Demir",speakerId:"p_a",toId:"__user__",present:["p_a","p_b"],content:'"Hi."'});
    const old={mid:newMid(),role:"assistant",speaker:"Berk Kaya",speakerId:"p_b",toId:"__user__",present:["p_a","p_b"],content:'"Hey."'};
    c.messages.push(old);
    __stub.delay=800; __stub.reply='"Hello there."';
    const r=retryLastReply(old.mid); await __sleep(250); stopReply(); await r; await __settle(); __stub.delay=0;
    const last=c.messages[c.messages.length-1];
    const out={single:{sys:!!last.sysError,retryable:!!last.retryable,who:last.retrySpeakerId,to:last.retryToId,oldGone:!c.messages.includes(old)}};
    // router 2: Ayla answers the player, Berk answers Ayla — Stop during Berk's line
    const c2=__scene(["p_a","p_b"]);
    __stub.bg["Turn router · player"]={addressed:"Ayla",responders:["Ayla"]};
    let n=0; __stub.bg["Turn router · character"]=()=>(++n===1)?{continue:true,responder:"Berk"}:{continue:false};
    let f=0; __stub.delay=()=>(++f===1)?0:800;
    const p=sendMessage({chat:c2,text:"Ayla, what now?"}); await __sleep(400); stopReply(); await p; await __settle();
    const nt=c2.messages[c2.messages.length-1];
    out.router2={sys:!!nt.sysError,who:nt.retrySpeakerId,to:nt.retryToId};
    __stub.delay=0; __stub.reply='"Ayla is right."';
    await retryLastReply(nt.mid); await __settle();
    const back=c2.messages[c2.messages.length-1];
    out.router2.retried={who:back.speakerId,to:back.toId,sys:!!back.sysError};
    // Stop in a whisper: no postTurn
    const c3=__scene(["p_a","p_b"]);
    let pulses=0; const _mwp=window.maybeWorldPulse; window.maybeWorldPulse=()=>{ pulses++; };
    __stub.delay=800;
    const w=sendMessage({chat:c3,text:"/whisper Ayla meet me outside"}); await __sleep(250); stopReply(); await w; await __settle(); __stub.delay=0;
    window.maybeWorldPulse=_mwp;
    const wl=c3.messages[c3.messages.length-1];
    out.whisper={pulses, future:__calls.some(x=>/Future tracker/.test(x.dbg)), notice:{sys:!!wl.sysError,who:wl.retrySpeakerId}};
    return out;
  });
  ok("Stop during a single-character Retry leaves a retryable notice for that character", sr.single.sys&&sr.single.retryable&&sr.single.who==="p_b"&&sr.single.to==="__user__"&&sr.single.oldGone, JSON.stringify(sr.single));
  ok("a stopped router-2 notice keeps its addressee (the character, not the player)", sr.router2.sys&&sr.router2.who==="p_b"&&sr.router2.to==="p_a", JSON.stringify(sr.router2));
  ok("and its Retry answers that same person", sr.router2.retried.who==="p_b"&&sr.router2.retried.to==="p_a"&&!sr.router2.retried.sys, JSON.stringify(sr.router2.retried));
  ok("Stop in a whisper runs no postTurn and leaves a notice", sr.whisper.pulses===0&&!sr.whisper.future&&sr.whisper.notice.sys&&sr.whisper.notice.who==="p_a", JSON.stringify(sr.whisper));

  console.log("\n[a whole-turn Retry after an earlier Retry does not re-run the directors]");
  const wt=await pg.evaluate(async()=>{
    __setup(); const c=__scene(["p_a"]);
    let pulses=0; const _mwp=window.maybeWorldPulse; window.maybeWorldPulse=()=>{ pulses++; };
    __stub.reply='"One."';
    await sendMessage({chat:c,text:"Tell me."}); await __settle();
    const afterFirst=pulses;
    __stub.reply='';                               // the retried reply comes back empty → a whole-turn notice
    await retryLastReply(c.messages[c.messages.length-1].mid); await __settle();
    const notice=c.messages[c.messages.length-1];
    __stub.reply='"Two."';
    await retryLastReply(notice.mid); await __settle();
    window.maybeWorldPulse=_mwp;
    return {afterFirst,pulses,notice:{sys:!!notice.sysError,one:notice.retrySpeakerId||null},lines:__lines(c)};
  });
  ok("the directors ran once for the line, not again on the whole-turn Retry", wt.afterFirst===1&&wt.pulses===1&&wt.notice.sys, JSON.stringify(wt));
  ok("and the line is answered", wt.lines.length===2&&/Two/.test(wt.lines[1]), JSON.stringify(wt.lines));

  /* ---------------------------------------------------------------------------------------------- */
  console.log("\n[narrator beats are stamped with earshot; a GM reaction comes from earshot]");
  const nb=await pg.evaluate(async()=>{
    __setup(); const c=__scene(["p_a","p_c"],{p_c:"s_back"});
    __stub.reply='"What was that?"';
    await playGamemasterBeat(c,"A glass breaks at the counter."); await __settle();
    const gm=c.messages.find(m=>m.gmBeat);
    const react=c.messages.filter(m=>m.reaction).map(m=>m.speakerId);
    const routed=__calls.some(x=>/Turn router · gm reaction/.test(x.dbg));
    state.sceneOn=true;
    c.activeEvent={summary:"a knock",turn:0,minTurns:1,maxTurns:5,type:"environment",participant:null,resolved:false};
    __stub.bg["Scene writer: advance"]={narration:"Someone knocks twice.",resolved:false};
    await runSceneWriter(c);
    const sw=c.messages.find(m=>m.sceneBeat);
    state.sceneOn=false; c.activeEvent=null;
    __stub.bg["Meeting no-show beat"]="";          // the fallback sentence, which names the player
    await narrateMeetingOutcome(c,{title:"Coffee"},state.personas.find(p=>p.id==="p_b"));
    const ns=c.messages[c.messages.length-1];
    return {gm:gm&&gm.present, react, routed, sw:sw&&sw.present, noShow:ns.present, noShowText:ns.content};
  });
  ok("the Gamemaster beat is heard by who shares the area", JSON.stringify(nb.gm)==='["p_a"]', JSON.stringify(nb));
  ok("and reacted to from earshot (the back room does not react)", nb.react.length===1&&nb.react[0]==="p_a", JSON.stringify(nb));
  ok("the Scene Writer beat and a no-show beat likewise", JSON.stringify(nb.sw)==='["p_a"]'&&JSON.stringify(nb.noShow)==='["p_a"]'&&/Emre/.test(nb.noShowText), JSON.stringify(nb));

  const dr=await pg.evaluate(async()=>{
    __setup(); const c=__scene(["p_a"]);
    __stub.delay=500; __stub.reply='"Sure."';
    const p=sendMessage({chat:c,text:"Wait here."}); await __sleep(150);
    c.subPos.p_a="s_back";                          // she walks into the back room meanwhile
    await p; await __settle(); __stub.delay=0;
    const l=c.messages[c.messages.length-1];
    return {sys:!!l.sysError,retryable:!!l.retryable,who:l.retrySpeakerId,text:l.content,posted:c.messages.some(m=>m.content==='"Sure."')};
  });
  ok("a reply dropped by the earshot check leaves a small retryable notice", dr.sys&&dr.retryable&&dr.who==="p_a"&&!dr.posted, JSON.stringify(dr));

  /* ---------------------------------------------------------------------------------------------- */
  console.log("\n[refusal detection]");
  const rf=await pg.evaluate(()=>{
    const yes=["I'm sorry, but I can't continue this roleplay.","I'm unable to assist with that request.","I apologize, but I won't be able to write this scene.",
      "As a language model, I must decline.","I cannot provide this content as it violates my guidelines.","I won't generate explicit content involving these characters.",
      "I can't comply with that request.","I cannot depict sexual content.","Sorry. I can't help with that."];
    const no=["I can't comply with your request, commander. The men are exhausted.",'*He shakes his head.* "No." I cannot assist you with this plan, it\'s madness.',
      "I can't depict what happened that night. It hurts too much.","I cannot continue this roleplay with you, Ayla! You betrayed me!",
      "I won't be able to make it tonight.","I can't provide what you want from me, Emre."];
    return {miss:yes.filter(t=>!looksLikeRefusal(t)), fp:no.filter(t=>looksLikeRefusal(t))};
  });
  ok("real refusals are caught (incl. 'won't be able to write', 'As a language model')", rf.miss.length===0, JSON.stringify(rf.miss));
  ok("in-character strong verbs are not refusals", rf.fp.length===0, JSON.stringify(rf.fp));

  console.log("\n[_thought_ spans]");
  const th=await pg.evaluate(()=>({
    emo:dropThoughtSpans('"Thanks!" ^_^ She laughs.'), bold:dropThoughtSpans('__BANG!__ The door slams.'),
    handle:dropThoughtSpans('My handle is ayla_ ok? "Add me."'), trail:dropThoughtSpans('call me name_'), snake:dropThoughtSpans('see file_name here'),
    open:dropThoughtSpans('"Hi." _He must never know I took the money.'), closed:dropThoughtSpans('_I wonder._ "Fine."'),
    orphan:dropThoughtSpans('"Two." second line_'), sentence:dropThoughtSpans('I should not have said that._ "Anyway."')}));
  ok("^_^, __bold__, handles and snake_case are left alone", th.emo.indexOf("^_^")>=0&&th.bold.indexOf("__BANG!__")>=0&&th.handle.indexOf("ayla_ ok?")>=0&&th.trail==="call me name_"&&th.snake==="see file_name here", JSON.stringify(th));
  ok("real thoughts still go (open, closed, orphan after speech or a sentence)", th.open.trim()==='"Hi."'&&th.closed.trim()==='"Fine."'&&th.orphan.trim()==='"Two."'&&th.sentence.trim()==='"Anyway."', JSON.stringify(th));

  /* ---------------------------------------------------------------------------------------------- */
  console.log("\n[text payloads]");
  const tx=await pg.evaluate(async()=>{
    __setup(); const c=__scene(["p_a","p_b"]); state.mem=true;
    state.memory=[{id:"m1",ownerId:"p_a",character:"Ayla Demir",universeId:"u1",chatId:"c1",gameDay:1,content:"x",importance:0.5,type:"EXPERIENCE"}];
    c.messages.push({mid:"t1",role:"assistant",speaker:"Ayla Demir",speakerId:"p_a",textMsg:true,textWith:"p_a",present:[],content:"OWNTEXT did you get the keys"});
    c.messages.push({mid:"t2",role:"user",textMsg:true,textWith:"p_a",present:[],content:"PLAYERTEXT yes"});
    c.messages.push({mid:"s1",role:"assistant",speaker:"Berk Kaya",speakerId:"p_b",present:["p_b"],content:'"SECRETSCENE only I know."'});
    c.messages.push({mid:"s2",role:"assistant",speaker:"Berk Kaya",speakerId:"p_b",present:["p_a","p_b"],toId:"__user__",content:'*BERKNARR leans back.* "Heard." _BERKTHOUGHT I lied._'});
    let q=null; const _rm=window.retrieveMemories; window.retrieveMemories=async(query)=>{ q=query; return {recent:[],diary:[],longterm:[]}; };
    enterUniverseChat("u2",true);
    let pl; try{ pl=await buildTextPayload(c,state.personas.find(p=>p.id==="p_a")); }finally{ window.retrieveMemories=_rm; }
    const raw=JSON.stringify(pl.rawFn());
    enterUniverseChat("u1",true);
    const scene=recentSceneMsgsFor(c,state.personas.find(p=>p.id==="p_a"),10).map(m=>m.content).join("\n");
    return {q, pay:(pl.head||"")+(pl.tail||""), raw, scene};
  });
  ok("the memory query holds the texter's own texts and the player's", /OWNTEXT/.test(tx.q)&&/PLAYERTEXT/.test(tx.q), tx.q);
  ok("and never a scene the texter did not witness, nor another's thought", !/SECRETSCENE|BERKTHOUGHT/.test(tx.q)&&/Heard/.test(tx.q), tx.q);
  ok("the payload is built in this chat's world with this chat's player", !/Mert|OTHER UNIVERSE|Liman/.test(tx.pay+tx.raw)&&/Emre/.test(tx.pay), tx.pay.slice(0,400));
  ok("the proactive texter's scene has no other character's thoughts", !/BERKTHOUGHT/.test(tx.scene)&&/Heard/.test(tx.scene), tx.scene);

  ok("no page errors", errs.length===0?true:errs.join(" | "));

  /* Heat headers agree with the POV rail and the heat format; a stored copy is upgraded in place. Runs
     last — it reloads. */
  console.log("\n[heat headers]");
  const hd=await pg.evaluate(()=>({phys:BLOCK_TPL_DEFAULTS.heat_narr_physical, guide:BLOCK_TPL_DEFAULTS.heat_guidance}));
  ok("the shipped heat fragments no longer say 'WHAT IS HAPPENING TO YOU' / 'what you do with your body'", !/WHAT IS HAPPENING TO YOU/.test(hd.phys)&&!/what you do with your body/.test(hd.guide)&&/WHAT YOUR OWN BODY IS DOING/.test(hd.phys), JSON.stringify(hd).slice(0,300));
  await pg.evaluate(()=>{
    const bag=Object.assign({},state.blockTpls||{},{
      heat_narr_physical:BLOCK_TPL_DEFAULTS.heat_narr_physical.replace("WHAT YOUR OWN BODY IS DOING, PLAINLY","WHAT IS HAPPENING TO YOU, PLAINLY")+"\nMY PHYS EDIT.",
      heat_guidance:BLOCK_TPL_DEFAULTS.heat_guidance.replace("and in your one thought — never in narrated action: this beat has no narration channel.","and what you do with your body while you say it.")+"\nMY GUIDE EDIT."});
    store.set(K.blockTpls,bag);
  });
  await pg.reload(); await pg.waitForTimeout(2400);
  const hu=await pg.evaluate(()=>({p:blkTpl("heat_narr_physical"), g:blkTpl("heat_guidance")}));
  ok("a stored copy of the old heat lines is upgraded in place (v147.2 refresh)", !/WHAT IS HAPPENING TO YOU/.test(hu.p)&&!/what you do with your body/.test(hu.g)&&/WHAT YOUR OWN BODY IS DOING/.test(hu.p)&&/never in narrated action/.test(hu.g), JSON.stringify(hu).slice(0,400));
  ok("and keeps the user's own edits", /MY PHYS EDIT\./.test(hu.p)&&/MY GUIDE EDIT\./.test(hu.g), JSON.stringify(hu).slice(0,400));
  ok("no page errors after reload", errs.length===0?true:errs.join(" | "));

  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close(); process.exit(fail?1:0);
})();
