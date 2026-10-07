/* v146.1 — QC REPORT #2, ROLEPLAY CORE. Pins the fixes for out/QC-REPORT-v145.md §1 #7 #8 #9, §4.1 and
   the end-to-end findings R1–R5 (the audit's probes turned into regression checks):
     - a universe switch mid-turn: the old chat's turn keeps its own world setting, places (earshot) and
       player name — in the payload, the reply's toName and the day ledger (R3);
     - the Scene Writer never stages a same-named character from another universe (R1);
     - a whisper never reaches a non-recipient's drives & brakes prompt (R2);
     - unclosed _thought_ spans are removed like unclosed *narration* (per line, snake_case kept);
     - `present` is stamped by earshot: the back room does not hear the counter;
     - Stop ends a multi-character chain (one toast, no postTurn), never leaks into the next turn, and
       reads as Stopped inside the repeat retry;
     - Retry only takes a reply to the player, is offered after Stop / refusal / empty / a failed group
       reply, rolls back the discarded reply's memories, plans and fast relationship read, and the new
       reply is remembered (R5);
     - a reply generated while the player travelled does not land in the new place (R4);
     - a video cue takes the turn lock;
     - typing dots never run ahead of a queued line; in-character lines are not refusals; heat never
       asks the character to narrate the player (and a stored heat fragment is upgraded in place).
   Run: NODE_PATH=/path/to/node_modules node tests/qc2-roleplay.browser.js */
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

  /* Two universes: u1 (player Emre; the Harbour Bar with a counter and a back room, and a home) and u2
     (player Mert). Roleplay replies go through the REAL chatCompletion with a stubbed fetch, so Stop and
     the abort path are real; every other model call is answered from window.__stub.bg by label prefix. */
  await pg.evaluate(()=>{
    window.__calls=[]; window.__toasts=[]; window.__fetches=[]; window.__sent={};
    const _toast=window.toast; window.toast=(t)=>{ window.__toasts.push(String(t)); try{ _toast(t); }catch(e){} };
    window.__stub={reply:'"Fine."', delay:0, fail:false, bg:{}, bgDelay:0};
    window.__sleep=ms=>new Promise(r=>setTimeout(r,ms));
    window.fetch=async(url,init)=>{
      // v150.30 — the reply check's Decisions request is not a roleplay call: answered empty, never recorded
      if(String(url).indexOf("/api/alpha/decisions")>-1) return new Response(JSON.stringify({answers:{}}),{status:200,headers:{'content-type':'application/json'}});
      const body=JSON.parse(init.body); window.__fetches.push(body);
      const d=typeof __stub.delay==="function"?__stub.delay(body):__stub.delay;
      if(d) await new Promise(r=>setTimeout(r,d));
      const f=typeof __stub.fail==="function"?__stub.fail(body):__stub.fail;
      if(f) return new Response(JSON.stringify({error:{message:"boom"}}),{status:400,headers:{'content-type':'application/json'}});
      const txt=typeof __stub.reply==="function"?__stub.reply(body):__stub.reply;
      return new Response(JSON.stringify({choices:[{message:{content:txt}}]}),{status:200,headers:{'content-type':'application/json'}});
    };
    const real=chatCompletion;
    window.chatCompletion=async(messages,model,opts)=>{
      const dbg=(opts&&opts.dbg)||"";
      window.__calls.push({dbg}); window.__sent[dbg]=(window.__sent[dbg]||"")+JSON.stringify(messages);
      if(opts&&opts.rp===true) return real(messages,model,opts);
      if(__stub.bgDelay) await new Promise(r=>setTimeout(r,__stub.bgDelay));
      const k=Object.keys(__stub.bg).sort((a,b)=>b.length-a.length).find(p=>dbg.indexOf(p)===0);
      let r=k?__stub.bg[k]:"{}"; if(typeof r==="function") r=await r(dbg,messages);
      return typeof r==="string"?r:JSON.stringify(r);
    };
    window.__setup=()=>{
      const base=state.universes[0];
      const U=(id,user,setting,locs)=>Object.assign(JSON.parse(JSON.stringify(base)),{id,name:id,userName:user,setting,locations:locs,gameData:{},rules:[],trackers:[],prompts:{}});
      state.universes=[
        U("u1","Emre","ORIGINAL WORLD HARBOUR",[{id:"l_bar",name:"Harbour Bar",description:"b",residents:[],sublocations:[{id:"s_bar",name:"Counter"},{id:"s_back",name:"Back room"}]},
                                              {id:"l_ev",name:"Ev",description:"home",residents:[],sublocations:[]}]),
        U("u2","Mert","OTHER UNIVERSE SPACESHIP",[{id:"l_ship",name:"Ship",description:"s",residents:[],sublocations:[]}])];
      const mk=(id,n,u)=>({id,name:n,universeId:u,personality:"x",instructions:"x",backstory:"x",style:"x",goals:"x",look:{},relationships:{}});
      state.personas=[mk("p_a","Ayla Demir","u1"),mk("p_b","Berk Kaya","u1"),mk("p_c","Cem Aras","u1"),mk("p2_ayla","Ayla","u2"),mk("p2_x","Xan","u2")];
      Object.assign(state,{key:"k",mem:false,sceneOn:false,gmOn:false,autoRpOn:false,heatOn:false,suggestOn:false,autoSpeak:false,narrMode:false,
        relOn:false,trackOn:false,calOn:false,promiseOn:false,gossipOn:false,intentOn:false,pulseOn:false,roundOn:false,charQuestsOn:false,
        goalPursuitOn:false,textsOn:false,autoImg:false,imgMode:"off",streamReveal:false,fallbackModel:"",storyLang:"en",travelTime:0,mcChainCap:4});
      state.chats={
        c1:{id:"c1",universeId:"u1",castIds:[],presentIds:[],memCounts:{},tempChars:[],activeEvent:null,messages:[],gameDay:2,period:"Afternoon",
            locationId:"l_bar",location:"Harbour Bar",subId:"s_bar",subPos:{},calendar:[],promises:[]},
        c2:{id:"c2",universeId:"u2",castIds:[],presentIds:[],memCounts:{},tempChars:[],activeEvent:null,messages:[],gameDay:1,period:"Morning",
            locationId:"l_ship",location:"Ship",calendar:[],promises:[]}};
      state.curUniverse="u1"; state.curChat="c1"; applyUniverseProfile("u1"); state.memory=[];
      __stub.bg={"Turn router · player":'{"addressed":"group","responders":[]}',"Turn router":'{"continue":false}'};
      __stub.reply='"Fine."'; __stub.delay=0; __stub.fail=false; __stub.bgDelay=0;
      show('chat'); try{ renderChat(); }catch(e){}
    };
    window.__scene=(who,subs)=>{
      const c=state.chats.c1;
      if(state.curChat!=="c1") enterUniverseChat("u1",true);
      c.presentIds=who.slice(); c.subPos=Object.assign({},subs||{}); who.forEach(id=>{ if(!c.subPos[id])c.subPos[id]="s_bar"; });
      c.subId="s_bar"; c.subSelf=false; c.activeEvent=null; c._presenceLastRun=0; c._presenceSeenMid=null; c.autoPlay=false; c.storyMode=false;
      c.locationId="l_bar"; c.location="Harbour Bar"; c.dayLog=null; c.calendar=[]; c.promises=[]; c.rel={}; c.memDoneIdx=undefined; c.memEvent=null;
      c.messages=[{mid:newMid(),role:"assistant",speaker:"Ayla Demir",speakerId:"p_a",
        content:'*I set the glass down.* "They closed the harbour today."',present:who.slice(),toId:"__user__",toName:"Emre"}];
      window.__calls=[]; window.__toasts=[]; window.__fetches=[]; window.__sent={};
      document.getElementById('chatInput').value="";
      try{ renderChat(); }catch(e){}
      return c;
    };
    window.__settle=async(ms)=>{ const t=Date.now(); while(Date.now()-t<(ms||15000)){ await new Promise(r=>setTimeout(r,50));
      if(!_presentPlaying&&!_presentQueue.length&&!chatBusy(state.chats.c1,"turn")) return true; } return false; };
    window.__lines=c=>c.messages.slice(1).map(m=>(m.sysError?"SYS":m.role)+":"+(m.speaker||"")+":"+String(m.content||"").slice(0,40));
    __setup();
  });

  console.log("\n[#7 / R3 — a universe switch mid-turn leaves the old chat's turn in its own world]");
  const uw=await pg.evaluate(async()=>{
    __setup();
    const c=__scene(["p_a","p_b","p_c"],{p_c:"s_back"});
    __stub.bg["Turn router · player"]='{"addressed":"group","responders":["Ayla","Berk"]}';
    __stub.reply='"ok."'; __stub.delay=600;
    const before=inSceneIds(c).slice();
    const p=sendMessage({chat:c,text:"Hi both"});
    await __sleep(300);
    enterUniverseChat("u2",true);                  // the player opens the other story meanwhile
    const after=inSceneIds(c).slice();
    await p; __stub.delay=0; await __sleep(300);
    const pay=__fetches.map(f=>JSON.stringify(f.messages));
    const replies=c.messages.filter(m=>m.speakerId&&m.role==="assistant"&&!m.sysError&&m!==c.messages[0]);
    const out={before,after,n:pay.length,
      orig:pay.every(s=>s.includes("ORIGINAL WORLD HARBOUR")), other:pay.some(s=>s.includes("OTHER UNIVERSE")),
      mert:pay.some(s=>/Mert/.test(s)), emre:pay.every(s=>/Emre/.test(s)),
      toNames:replies.map(m=>m.toName), ledger:JSON.stringify(c.dayLog||{}), userNow:state.user};
    // the one-on-one path (R3's own shape)
    enterUniverseChat("u1",true);
    const c1=__scene(["p_a"]); __stub.delay=400; __stub.reply='"Hi there."';
    const p2=sendMessage({chat:c1,text:"Good morning, Ayla."});
    await __sleep(100); enterUniverseChat("u2",true);
    await p2; __stub.delay=0; await __sleep(300);
    const r=c1.messages.find(m=>m.speakerId==="p_a"&&m!==c1.messages[0]);
    out.solo={toName:r&&r.toName, ledger:JSON.stringify(c1.dayLog||{}), pay:JSON.stringify((__fetches[0]||{}).messages||[]), userNow:state.user};
    enterUniverseChat("u1",true);
    out.back=state.user;
    return out;
  });
  ok("the payloads built after the switch carry the OLD chat's world setting", uw.n===2&&uw.orig&&!uw.other, JSON.stringify(uw));
  ok("and the old chat's player, never the other story's", uw.emre&&!uw.mert, JSON.stringify(uw));
  ok("earshot is resolved from the old chat's places (the back room stays out of earshot)", JSON.stringify(uw.before)===JSON.stringify(uw.after)&&uw.after.indexOf("p_c")<0, JSON.stringify(uw));
  ok("the replies' toName is the old chat's player (R3)", uw.toNames.length===2&&uw.toNames.every(n=>n==="Emre"), JSON.stringify(uw.toNames));
  ok("and the day ledger never names the other story's player", !/Mert/.test(uw.ledger)&&!/Mert/.test(uw.solo.ledger), uw.ledger+" | "+uw.solo.ledger);
  ok("one-on-one: toName and payload stay in the old story (R3)", uw.solo.toName==="Emre"&&/ORIGINAL WORLD/.test(uw.solo.pay)&&!/Mert|OTHER UNIVERSE/.test(uw.solo.pay), JSON.stringify(uw.solo).slice(0,300));
  ok("the open story's player is untouched by the old turn", uw.userNow==="Mert"&&uw.solo.userNow==="Mert"&&uw.back==="Emre", JSON.stringify({a:uw.userNow,b:uw.solo.userNow,c:uw.back}));
  ok("inChatWorld scopes the open-story readers and always restores them", await pg.evaluate(()=>{
    __setup(); enterUniverseChat("u2",true);
    const c1=state.chats.c1;
    const inside=inChatWorld(c1,()=>({u:state.user,set:curWorldSetting(),loc:!!locById("l_bar"),cast:curCast().map(p=>p.id).join()}));
    let threw=false; try{ inChatWorld(c1,()=>{ throw new Error("x"); }); }catch(e){ threw=true; }
    const after={u:state.user,set:curWorldSetting()};
    enterUniverseChat("u1",true);
    return (inside.u==="Emre"&&/ORIGINAL/.test(inside.set)&&inside.loc&&/p_a/.test(inside.cast)&&!/p2_/.test(inside.cast)&&threw&&after.u==="Mert"&&/OTHER/.test(after.set))?true:JSON.stringify({inside,after,threw}); }));

  console.log("\n[#8 / R1 — the Scene Writer stages only this story's people]");
  const sw=await pg.evaluate(async()=>{
    __setup(); const c=__scene([]); state.sceneOn=true; const out={};
    const stage=async(name)=>{ c.activeEvent=null; c.presentIds=[];
      __stub.bg["Scene writer: setup"]={type:"character",participant:{name,approaching:false},summary:name+" drops by"};
      await setupActiveEvent(c,"Someone knocks.");
      return {part:c.activeEvent&&c.activeEvent.participant, present:presentIds(c).slice()}; };
    out.xan=await stage("Xan");        // only exists in u2
    out.ayla=await stage("Ayla");      // "Ayla" in u2, "Ayla Demir" in u1
    out.player=await stage("Emre");
    out.setupPrompt=__sent["Scene writer: setup"]||"";
    // the writer's bring_in fallback too
    c.activeEvent={summary:"a knock",turn:0,minTurns:1,maxTurns:5,type:"environment",participant:null}; c.presentIds=["p_a"];
    __stub.bg["Scene writer: advance"]='{"narration":"Someone is at the door.","bring_in":"Xan","resolved":false,"resolution":null}';
    await runSceneWriter(c);
    out.bringIn=presentIds(c).slice();
    state.sceneOn=false; c.activeEvent=null;
    return out;
  });
  ok("a name that only exists in another universe stages nobody (R1)", sw.xan.part===null&&sw.xan.present.indexOf("p2_x")<0, JSON.stringify(sw.xan));
  ok("a shared first name resolves to THIS story's character", sw.ayla.part&&sw.ayla.part.charId==="p_a"&&sw.ayla.present.indexOf("p2_ayla")<0, JSON.stringify(sw.ayla));
  ok("the player is never staged as a participant", sw.player.part===null, JSON.stringify(sw.player));
  ok("the setup prompt lists this story's cast and player", /Ayla Demir/.test(sw.setupPrompt)&&/Player: Emre/.test(sw.setupPrompt)&&!/Xan/.test(sw.setupPrompt), sw.setupPrompt.slice(0,300));
  ok("the writer's bring_in cannot pull another universe's character in", sw.bringIn.indexOf("p2_x")<0, JSON.stringify(sw.bringIn));

  console.log("\n[#9 / R2 — a whisper never reaches a non-recipient's drives & brakes]");
  const ps=await pg.evaluate(async()=>{
    __setup(); const c=__scene(["p_a","p_b"]);
    c.messages.push({mid:"w1",role:"user",content:"ZUMRUT7731 is the door code, don't tell Ayla.",present:["p_a","p_b"],whisperTo:"p_b",whisperToName:"Berk Kaya"});
    c.messages.push({mid:"w2",role:"assistant",speaker:"Berk Kaya",speakerId:"p_b",content:'"Okay." _ZUMRUT7731, got it._',present:["p_a","p_b"],whisperTo:"__user__"});
    c.messages.push({mid:"w3",role:"assistant",speaker:"Berk Kaya",speakerId:"p_b",content:'"Nice weather." _I must remember QUARTZ55._',present:["p_a","p_b"],toId:"__user__"});
    __stub.bg["Drives & brakes"]={toward:"x",against:"y"};
    await _writePsyche(c,state.personas[0],"__user__","Emre","sig-a");
    const a=__sent["Drives & brakes (id / superego)"]||""; __sent={};
    await _writePsyche(c,state.personas[1],"__user__","Emre","sig-b");
    const bb=__sent["Drives & brakes (id / superego)"]||"";
    return {aSecret:a.indexOf("ZUMRUT7731")>=0, aThought:a.indexOf("QUARTZ55")>=0, aWeather:/Nice weather/.test(a), bSecret:bb.indexOf("ZUMRUT7731")>=0, bMarked:/whispered to Berk Kaya alone/.test(bb)};
  });
  ok("the non-recipient's psyche prompt has neither the whisper nor Berk's thoughts (R2)", !ps.aSecret&&!ps.aThought&&ps.aWeather, JSON.stringify(ps));
  ok("the recipient's has it, marked as whispered to them", ps.bSecret&&ps.bMarked, JSON.stringify(ps));

  console.log("\n[unclosed _thought_ spans]");
  const th=await pg.evaluate(()=>{
    const T={
      open:'_I hate him so much. "Hello, Berk," I say warmly.',
      nl:'"Hi." _He must never know I took the money.\n*I smile.* "Coffee?"',
      mixed:'_I took the money_ "Hi." _and I will again',
      snake:'"Check my_file_name and the user_id," she says.',
      closedQuote:'_"Why me," I think._ "Morning."',
      stray:'I took it, she will never know_ "Hi there."',
      noCross:'"One." _first thought\n"Two." second line_'
    };
    const o={}; Object.keys(T).forEach(k=>{ o[k]={s:spokenOnly(T[k]),p:perceivedOnly(T[k])}; });
    o.strip=stripNarration('"Hello there, my friend, how are you doing?" _He is lying, I can tell, and I will not let it go this time.');
    return o;
  });
  ok("an unclosed thought is removed to the end of its line", th.open.p==='"Hello, Berk,"'&&!/hate/.test(th.open.s), JSON.stringify(th.open));
  ok("it never crosses a newline", /Coffee/.test(th.nl.p)&&!/money/.test(th.nl.p)&&/I smile/.test(th.nl.p), JSON.stringify(th.nl));
  ok("closed and unclosed spans in one line", th.mixed.p==='"Hi."'&&th.mixed.s==='"Hi."', JSON.stringify(th.mixed));
  ok("snake_case is not a thought", th.snake.p.indexOf("my_file_name")>=0&&th.snake.p.indexOf("user_id")>=0, JSON.stringify(th.snake));
  ok("a CLOSED thought goes quotes and all", th.closedQuote.p==='"Morning."', JSON.stringify(th.closedQuote));
  ok("a closer with no opener reaches back to the line start, keeping speech", th.stray.p==='"Hi there."', JSON.stringify(th.stray));
  ok("two lines each keep their own speech", /"One\."/.test(th.noCross.p)&&/"Two\."/.test(th.noCross.p)&&!/first thought|second line/.test(th.noCross.p), JSON.stringify(th.noCross));
  ok("stripNarration uses the same reading", !/lying/.test(th.strip)&&/Hello there/.test(th.strip), th.strip);

  console.log("\n[other areas of the same place do not hear the scene]");
  const ear=await pg.evaluate(async()=>{
    __setup(); const c=__scene(["p_a","p_b"],{p_b:"s_back"}); __stub.reply='"Only you can hear this."';
    await sendMessage({chat:c,text:"My secret plan is to rob the bank"}); await __settle();
    const berk=state.personas[1];
    const out={present:c.messages.slice(1).map(m=>m.present), hist:castHistory(c,berk).map(m=>String(m.content))};
    out.witnessed=c.messages.slice(1).map(m=>witnessedBy(m,berk));
    c.subPos.p_b="s_bar"; __fetches=[];
    __stub.reply='"What did I miss?"';
    await playCharacterTurn(c,berk,"__user__"); await __settle();
    out.berkPayload=JSON.stringify((__fetches[0]||{}).messages||[]);
    return out;
  });
  ok("the player's line and the reply are stamped with who could hear them", JSON.stringify(ear.present)==='[["p_a"],["p_a"]]', JSON.stringify(ear.present));
  ok("the back room did not witness them", ear.witnessed.every(x=>x===false), JSON.stringify(ear.witnessed));
  ok("his history holds nothing said at the counter", !ear.hist.some(t=>/rob the bank|Only you/.test(t)), JSON.stringify(ear.hist));
  ok("and when he walks over, his payload has no secret", ear.berkPayload.length>20&&!/rob the bank/.test(ear.berkPayload), ear.berkPayload.slice(0,200));

  console.log("\n[Stop]");
  const st=await pg.evaluate(async()=>{
    __setup(); const out={};
    // A chain: Ayla and Berk respond, router 2 would add Cem; Stop during Ayla's call.
    let c=__scene(["p_a","p_b","p_c"]);
    __stub.bg["Turn router · player"]='{"addressed":"group","responders":["Ayla","Berk"]}';
    let r2=0; __stub.bg["Turn router · character"]=()=>(++r2===1)?'{"continue":true,"responder":"Cem Aras"}':'{"continue":false}';
    __stub.reply='"Line."'; __stub.delay=1500;
    const p=sendMessage({chat:c,text:"Hi all"}); await __sleep(400); stopReply(); await p; await __settle();
    __stub.delay=0;
    const last=c.messages[c.messages.length-1];
    out.chain={lines:__lines(c), toasts:__toasts.slice(), calls:__calls.map(x=>x.dbg), last:{sys:!!last.sysError,retry:!!last.retryable,one:last.retrySpeakerId||null},
      stopped:_rpStopped, end:_rpStopEnd===null};
    // Stop during an Autopilot beat (send button enabled), then the player sends at once.
    c=__scene(["p_a"]); __stub.reply='"AP line."'; __stub.delay=2000;
    const ap=apBeat(c); await __sleep(300);
    out.sbEnabled=!document.getElementById('sendBtn').disabled;
    stopReply(); out.flagAfterApStop=_rpStopped; await ap;
    __stub.delay=0; __stub.reply='"Answer to player."'; __toasts=[];
    await sendMessage({chat:c,text:"Are you there?"}); await __settle();
    out.ap={lines:__lines(c), toasts:__toasts.slice()};
    // A second Stop replaces the first one's timer; a new player turn clears the stop at once.
    const sb=document.getElementById('sendBtn'); sb.disabled=true;
    __stub.delay=3000;
    const k1=chatCompletion([{role:"user",content:"x"}],"m",{rp:true,dbg:"qc2 a"}).catch(e=>e); await __sleep(50);
    stopReply(); const e1=_rpStopEnd; await k1;
    const k2=chatCompletion([{role:"user",content:"x"}],"m",{rp:true,dbg:"qc2 b"}).catch(e=>e); await __sleep(50);
    const refusedWhileStopped=!!(await k2).stopped;
    _rpStopped=false;   // let a fresh call out, then stop it
    const k3=chatCompletion([{role:"user",content:"x"}],"m",{rp:true,dbg:"qc2 c"}).catch(e=>e); await __sleep(50);
    stopReply(); const e2=_rpStopEnd; await k3;
    out.timers={distinct:!!e1&&!!e2&&e1!==e2, refusedWhileStopped, flag:_rpStopped};
    markPlayerTurn(c);
    out.timers.clearedByTurn=(_rpStopped===false&&_rpStopEnd===null);
    sb.disabled=false; __stub.delay=0;
    // v148.7 — a reply that repeats Ayla's own line is posted as is: no second call.
    c=__scene(["p_a"]); let n=0;
    __stub.reply=()=>'*I set the glass down.* "They closed the harbour today."';
    __stub.delay=()=>(++n===1)?0:2000;
    const p3=sendMessage({chat:c,text:"What happened?"}); await __sleep(600); stopReply(); await p3; await __settle();
    __stub.delay=0;
    out.repeat={lines:__lines(c), fetches:n, toasts:__toasts.filter(t=>/Stopped/.test(t)).length};
    return out;
  });
  ok("Stop ends the chain: nobody after the stopped speaker, no router 2, no postTurn", st.chain.lines.length===2&&!st.chain.calls.some(d=>/Berk Kaya|Cem Aras|Turn router · character|Future tracker/.test(d)), JSON.stringify(st.chain));
  ok("with ONE 'Stopped.' toast", st.chain.toasts.filter(t=>/Stopped/.test(t)).length===1&&st.chain.toasts.length===1, JSON.stringify(st.chain.toasts));
  ok("and a notice Retry can act on (the whole turn, since nobody answered)", st.chain.last.sys&&st.chain.last.retry&&st.chain.last.one===null, JSON.stringify(st.chain.last));
  ok("the stop is over when the turn ends", st.chain.stopped===false&&st.chain.end===true, JSON.stringify(st.chain));
  ok("Stop during an Autopilot beat refuses nothing afterwards", st.sbEnabled===true&&st.flagAfterApStop===false, JSON.stringify(st));
  ok("so the player's next line is answered", /Answer to player/.test(st.ap.lines.join("|"))&&!st.ap.lines.some(l=>/AP line/.test(l)), JSON.stringify(st.ap));
  ok("a second Stop replaces the first one's timer; the turn's calls are refused meanwhile", st.timers.distinct&&st.timers.refusedWhileStopped&&st.timers.flag===true, JSON.stringify(st.timers));
  ok("a new player turn clears the stop at once", st.timers.clearedByTurn===true, JSON.stringify(st.timers));
  ok("a repeated line is posted as the model gave it — one call, no hidden retry", st.repeat.fetches===1&&st.repeat.lines.length===2&&!/^SYS/.test(st.repeat.lines[1])&&/They closed/.test(st.repeat.lines[1]), JSON.stringify(st.repeat));

  console.log("\n[Retry]");
  const rt=await pg.evaluate(async()=>{
    __setup(); const out={};
    const tgt=c=>{ const t=_retryTarget(c); return t?(t.m.sysError?"SYS:"+t.m.content.slice(0,20):t.m.content):null; };
    let c=__scene(["p_a"]); __stub.reply='"Reply one."';
    await sendMessage({chat:c,text:"Hello there"}); await __settle();
    out.reply=tgt(c);
    __stub.reply='"Reaction to the crash."';
    await playSingleReaction(c,state.personas[0],"A crash."); await __settle();
    out.afterReaction=tgt(c);
    c=__scene(["p_a"]); __stub.reply='"Answer to you."';
    await sendMessage({chat:c,text:"How are you"}); await __settle();
    __stub.reply='"Autopilot beat line."'; await apBeat(c); await __settle();
    out.afterAutopilot=tgt(c);
    c.messages.push({mid:newMid(),role:"assistant",speaker:"Ayla Demir",speakerId:"p_a",content:'"Heat."',heatBeat:true,toId:"__user__",present:["p_a"]});
    out.afterHeat=tgt(c);
    // retryable notices: refusal, empty reply
    c=__scene(["p_a"]); __stub.reply="I'm sorry, but I can't continue this roleplay.";
    await sendMessage({chat:c,text:"Hey"}); await __settle();
    out.refusal=tgt(c);
    c=__scene(["p_a"]); __stub.reply="";
    await sendMessage({chat:c,text:"Hey"}); await __settle();
    out.empty=tgt(c);
    __stub.reply='"Now I answer."'; await retryLastReply(); await __settle();
    out.afterEmptyRetry=__lines(c);
    // a failed group reply: Ayla answers, Berk's call fails → a notice for Berk; Retry asks only Berk
    c=__scene(["p_a","p_b"]);
    __stub.bg["Turn router · player"]='{"addressed":"group","responders":["Ayla","Berk"]}';
    let k=0; __stub.fail=()=>(++k===2); __stub.reply='"Group line."';
    await sendMessage({chat:c,text:"Hi you two"}); await __settle();
    __stub.fail=false;
    const nt=c.messages[c.messages.length-1];
    out.group={lines:__lines(c), notice:{sys:!!nt.sysError,retry:!!nt.retryable,one:nt.retrySpeakerId}};
    __stub.reply='"Berk again."'; __calls=[];
    await retryLastReply(); await __settle();
    out.group.after=__lines(c); out.group.rp=__calls.filter(x=>/^Roleplay reply/.test(x.dbg)).map(x=>x.dbg);
    return out;
  });
  ok("a reply to the player is the retry target", rt.reply==='"Reply one."', JSON.stringify(rt));
  ok("a Gamemaster reaction, an Autopilot beat or a heat beat is never retried (no double answer)", rt.afterReaction===null&&rt.afterAutopilot===null&&rt.afterHeat===null, JSON.stringify(rt));
  ok("a refusal leaves a retryable notice", /^SYS:The model declined/.test(rt.refusal||""), JSON.stringify(rt.refusal));
  ok("an empty reply leaves a retryable notice, and Retry answers", /^SYS:Empty reply/.test(rt.empty||"")&&rt.afterEmptyRetry.join("|")==='user::Hey|assistant:Ayla Demir:"Now I answer."', JSON.stringify(rt));
  ok("a failed group reply leaves a notice for THAT character", rt.group.notice.sys&&rt.group.notice.retry&&rt.group.notice.one==="p_b"&&/Group line/.test(rt.group.lines.join("|")), JSON.stringify(rt.group));
  ok("and Retry asks only that character again", rt.group.rp.length===1&&/Berk Kaya/.test(rt.group.rp[0])&&rt.group.after.filter(l=>/Ayla Demir/.test(l)).length===1&&/Berk again/.test(rt.group.after.join("|"))&&!rt.group.after.some(l=>/^SYS/.test(l)), JSON.stringify(rt.group));

  console.log("\n[Retry rolls back the discarded reply and remembers the new one (R5)]");
  const r5=await pg.evaluate(async()=>{
    __setup(); const c=__scene(["p_a"]); c.messages=[]; c.memDoneIdx=undefined; c.memEvent=null;
    state.mem=true; state.promiseOn=true; let rn=0;
    __stub.reply=()=>'"Reply number '+(++rn)+'."';
    __stub.bg["Memory arc tracker"]={progress:"finished",topic:"same",summary:"x"};
    let mi=0; const words=["apples oranges bananas picnic","trains rivers bridges journey","mountain music violins concert","harbour boats seagulls fishing"];
    // v148.1 — the player's own memory of the arc is a call of its own; it must not shift the characters' rotation
    __stub.bg["Memory (arc)"]=async(d,m)=>/\(you\)$/.test(d)?({content:"my own memory "+Math.random().toString(36).slice(2,8),importance:0.5}):({content:words[(mi++)%4]+" "+((JSON.stringify(m).match(/Reply number \d+/g)||[]).join(",")),importance_score:0.6});
    await sendMessage({chat:c,text:"First line."}); await __settle(); await __sleep(300);
    await sendMessage({chat:c,text:"Second line."}); await __settle(); await __sleep(1200);
    const old=c.messages[c.messages.length-1];
    const withOld=state.memory.filter(m=>(m.srcMids||[]).includes(old.mid)).length;
    // what a future-tracker pass and a fast relationship read filed from the old reply
    const before=_ftSnapshot(c);
    addCalendarEntry(c,{title:"Dinner at the harbour",day:3,period:"Evening",who:"Ayla Demir",source:"auto"});
    c.promises.push({id:"pr_x",holderId:"p_a",holderName:"Ayla Demir",promise:"I will call you",kind:"promise",status:"open",day:2});
    _ftStampChanges(c,before,null,old.mid);   // (chat, before, at, srcMid) since the calendar and roleplay fixes merged
    const stamped={cal:c.calendar.filter(e=>e.ftMid===old.mid&&e.ftNew).length, pr:c.promises.filter(e=>e.ftMid===old.mid&&e.ftNew).length};
    const o=relObj(c,"p_a","__user__"); o.st.desire=5;
    c._stUndo={mid:old.mid,rows:{"p_a>__user__":{st:Object.assign({},o.st),stNote:"",stNoteDay:0,stNoteAt:0,ep:0,op:0}}};
    o.st.desire=35; o.stNote="flustered";
    __calls=[];
    await retryLastReply(old.mid); await __settle(); await __sleep(1500);
    const neu=c.messages[c.messages.length-1];
    return {withOld, stamped, citeOld:state.memory.filter(m=>(m.srcMids||[]).includes(old.mid)).length,
      citeNew:state.memory.filter(m=>(m.srcMids||[]).includes(neu.mid)).length, newText:neu.content, oldText:old.content,
      memDoneIdx:c.memDoneIdx, newIdx:c.messages.indexOf(neu), cal:c.calendar.length, pr:c.promises.length, desire:o.st.desire, note:o.stNote||"",
      users:c.messages.filter(m=>m.role==="user").length, ft:__calls.filter(x=>x.dbg==="Future tracker").length, gm:__calls.filter(x=>/Gamemaster/.test(x.dbg)).length};
  });
  await pg.evaluate(()=>{ state.mem=false; state.promiseOn=false; });
  ok("setup: the old reply was committed to memory and stamped plans exist", r5.withOld>=1&&r5.stamped.cal===1&&r5.stamped.pr===1, JSON.stringify(r5));
  ok("Retry removes the memories cut from the discarded reply (R5)", r5.citeOld===0, JSON.stringify(r5));
  ok("and the NEW reply is remembered (R5)", r5.citeNew>=1&&r5.newText!==r5.oldText, JSON.stringify(r5));
  ok("plans and promises the future tracker created from it are removed", r5.cal===0&&r5.pr===0, JSON.stringify(r5));
  ok("the fast relationship read taken on it is put back", r5.desire===5&&r5.note==="", JSON.stringify(r5));
  ok("the new reply is analysed (future tracker), the directors do not run again, the player's line is not duplicated", r5.ft>=1&&r5.gm===0&&r5.users===2, JSON.stringify(r5));

  console.log("\n[R4 — a reply written while the player travelled does not land in the new place]");
  const r4=await pg.evaluate(async()=>{
    __setup(); const c=__scene(["p_a"]);
    __stub.delay=500; __stub.reply='"Wait, before you go—"';
    __stub.bg["Travel narration"]="You walk home.";
    const p=sendMessage({chat:c,text:"Bye Ayla."});
    await __sleep(120);
    await travelTo("l_ev",[]);
    await p; __stub.delay=0; await __settle();
    const tb=c.messages.findIndex(m=>m.travelBeat);
    return {loc:c.locationId, after:c.messages.slice(tb+1).filter(m=>m.speakerId==="p_a").length, tb, lines:__lines(c)};
  });
  ok("the player arrived home and Ayla's late line is not posted there (R4)", r4.loc==="l_ev"&&r4.tb>=0&&r4.after===0, JSON.stringify(r4));

  console.log("\n[a video cue takes the turn lock]");
  const vc=await pg.evaluate(async()=>{
    __setup(); const c=__scene(["p_a"]); __stub.reply='"Reply."'; __stub.delay=800;
    const p1=sendMessage({chat:c,text:"Player line"}); await __sleep(100);
    const p2=runWatchTurn(c,"A car explodes outside."); await __sleep(100);
    const inFlight=__fetches.length;
    await Promise.all([p1,p2]); __stub.delay=0; await __settle();
    const one=__lines(c);
    const p3=runWatchTurn(c,"A dog barks."); await p3; await __settle();
    return {inFlight, one, two:__lines(c), retry:_retryTarget(c)};
  });
  ok("a cue arriving mid-turn does not start a second reply", vc.inFlight===1&&vc.one.filter(l=>/Reply\./.test(l)).length===1&&!vc.one.some(l=>/explodes/.test(l)), JSON.stringify(vc));
  ok("a cue on an idle chat still plays its beat and a reply", /A dog barks/.test(vc.two.join("|"))&&vc.two.filter(l=>/Reply\./.test(l)).length===2, JSON.stringify(vc.two));
  ok("a reply to a video cue is not retried as an answer to the player's older line", vc.retry===null, JSON.stringify(vc.retry));

  console.log("\n[typing dots never run ahead of a queued line]");
  const ty=await pg.evaluate(async()=>{
    __setup(); const c=__scene(["p_a","p_b","p_c"]); state.streamReveal=true; state.revealCps=12;
    __stub.bg["Turn router · player"]='{"addressed":"group","responders":["Ayla","Berk"]}';
    let r2=0; __stub.bg["Turn router · character"]=()=>(++r2===1)?'{"continue":true,"responder":"Cem Aras"}':'{"continue":false}';
    let k=0; __stub.reply=()=>'"Reply number '+(++k)+' which is long enough that the reveal is slow."';
    __stub.delay=700;
    const bad=[]; let sawTyping=0;
    const obs=setInterval(()=>{
      const list=document.getElementById('chatList'); if(!list)return;
      const typing=list.querySelector('.typing'); if(!typing)return; sawTyping++;
      const pushed=c.messages.filter(m=>m.role==="assistant"&&m.speakerId&&m!==c.messages[0]).map(m=>m.mid);
      const shown=pushed.filter(mid=>list.querySelector('[data-mid="'+mid+'"]'));
      const last=list.lastElementChild; const typingLast=!!(last&&last.querySelector&&last.querySelector('.typing'));
      if(shown.length<pushed.length||!typingLast)bad.push(shown.length+"/"+pushed.length+(typingLast?"":" notlast"));
    },60);
    await sendMessage({chat:c,text:"Talk to me"}); await __settle(30000); clearInterval(obs);
    state.streamReveal=false; __stub.delay=0;
    return {bad, sawTyping, lines:__lines(c)};
  });
  ok("dots only show once every earlier line is on screen, and always last", ty.bad.length===0&&ty.sawTyping>0&&ty.lines.length===4, JSON.stringify(ty));

  console.log("\n[refusals vs in-character lines]");
  const rf=await pg.evaluate(()=>{
    const no=["I will not continue this conversation. Get out.","I can't provide what you want from me, Emre.",
      "*I cross my arms.* I'm not comfortable with this request, Emre.","I can't engage in this conversation any longer. You hurt me.",
      "I'm sorry but I can't continue with this. You lied to me.","I'm sorry, but I can't stay tonight.","No. I won't write that letter for you.",
      "I cannot continue like this.","I can’t help you with that, detective. Not tonight.","I can't continue this relationship, Mark."];
    const yes=["I can't continue this roleplay.","I'm sorry, but I can't continue with this request.","I can’t write that.","Sorry, I cannot assist with that.",
      "I won't write explicit content involving that.","Unfortunately I am unable to generate this content as it violates the guidelines.",
      "I cannot participate in this kind of roleplay.","I cannot comply.","I can't create that kind of scene","I’m sorry, but I can’t help with that.",
      "I'm unable to provide that content.","As an AI language model, I must decline.","I apologize, but I cannot fulfill this request.",
      "*I step back.* I'm sorry, I can't continue with this scene as it violates content guidelines."];
    return {fp:no.filter(s=>looksLikeRefusal(s)), fn:yes.filter(s=>!looksLikeRefusal(s))};
  });
  ok("in-character endings are not refusals", rf.fp.length===0, JSON.stringify(rf.fp));
  ok("canned refusals still are", rf.fn.length===0, JSON.stringify(rf.fn));

  console.log("\n[heat never asks the character to narrate the player]");
  const ht=await pg.evaluate(()=>{
    const D=BLOCK_TPL_DEFAULTS, all=["heat_format","heat_narr_physical","heat_narr_physical_short","heat_target_self"].map(k=>D[k]).join("\n");
    return {old:/what is being done to you|What is being done, where/.test(all), fmt:/is never narrated or decided by you/.test(D.heat_format),
      tgt:/never by writing what \{\{target\}\} does next/.test(D.heat_target_self), phys:/Only your side of it/.test(D.heat_narr_physical)};
  });
  ok("the heat fragments no longer say 'what is being done to you'", ht.old===false, JSON.stringify(ht));
  ok("and say plainly that the player's half is theirs to write", ht.fmt&&ht.tgt&&ht.phys, JSON.stringify(ht));

  ok("no page errors", errs.length===0?true:errs.join(" | "));

  /* A stored heat_format copy that still carries the OLD sentence, plus an edit of the user's own: after a
     reload the old sentence is replaced in place and the user's edit survives. Runs last — it reloads. */
  console.log("\n[a customised heat fragment is upgraded in place, and keeps its own edits]");
  await pg.evaluate(()=>{
    const OLD="You know exactly what is being done to you, who is doing it, and what you are doing back.";
    const NEWS="You know exactly what is happening between you and what you are doing in it.";
    let box=BLOCK_TPL_DEFAULTS.heat_format.replace(NEWS,OLD).replace(" Only your half is yours to write: what {{user}} does, says, feels or decides is never narrated or decided by you — you answer it.","")+"\nMY OWN HEAT LINE.";
    const bag=Object.assign({},state.blockTpls||{},{heat_format:box,heat_narr_physical_short:"flat and physical — what is being done to you and what you are doing back, with no feeling in it"});
    store.set(K.blockTpls,bag);
  });
  await pg.reload(); await pg.waitForTimeout(2400);
  const hu=await pg.evaluate(()=>{ const t=blkTpl("heat_format"), s=blkTpl("heat_narr_physical_short");
    return {old:/what is being done to you/.test(t+s), neu:/is never narrated or decided by you/.test(t)&&/what your own body is doing/.test(s), mine:/MY OWN HEAT LINE\./.test(t)}; });
  ok("the old heat sentences are upgraded in place", hu.old===false&&hu.neu===true, JSON.stringify(hu));
  ok("and the user's own edit survives", hu.mine===true, JSON.stringify(hu));
  ok("no page errors after reload", errs.length===0?true:errs.join(" | "));

  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close(); process.exit(fail?1:0);
})();
