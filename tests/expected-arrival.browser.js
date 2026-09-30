/* v148.7 — reported: "I'm in an area with a character, I say I'll go to another area and they say they'll come
   later. I move myself, type something to pass the turn — and only the future tracker runs, so they never come.
   Same when a character says they'll bring tea: they go to the kitchen on their own, and never come back,
   because the engine that moves people doesn't run after my line. It should run after my line only when I'm
   alone; with someone else it runs after their reply, not mine."
   Covered here:
     1. alone, the player's line runs the presence tracker (it used to run postTurn only);
     2. a promise to come ("coming") is kept on the chat and shown to every later run as EXPECTED TO JOIN,
        with how many turns ago — so the tea comes back; the player is not walked into the kitchen after them;
     3. a character still at the place, 6 turns past their promise, is walked back in code;
     4. someone offstage who said "I'll come later" is listed too, so the tracker can bring them in;
     5. with company the tracker does not run on the player's line before anyone answers — only after replies;
     6. a stored copy of the old default prompt is refreshed.
   Run: NODE_PATH=/path/to/node_modules node tests/expected-arrival.browser.js */
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

  await pg.evaluate(()=>{
    window.__sleep=ms=>new Promise(r=>setTimeout(r,ms));
    window.__calls=[];
    window.__presence=()=>"{}";
    window.chatCompletion=async(messages,model,opts)=>{
      const dbg=(opts&&opts.dbg)||"";
      __calls.push({dbg,text:JSON.stringify(messages)});
      if(/Presence tracker/.test(dbg)) return __presence(JSON.stringify(messages));
      if(/^Turn router · player/.test(dbg)) return '{"addressed":"group","responders":["Duygu Akbaba","Hakan Akbaba"]}';
      if(/^Turn router · character/.test(dbg)) return '{"continue":false}';
      if(/Character move|move/i.test(dbg)&&!/tracker/i.test(dbg)) return "";
      if(opts&&opts.rp===true) return '*Bardağı uzatıyorum.* "Al bakalım, taze demledim."';
      return "{}";
    };
    window.__setup=(opts)=>{
      opts=opts||{};
      const base=state.universes[0];
      const U=Object.assign({},base,{id:"u1",name:"Test",characters:[],
        locations:[{id:"l_ev",name:"Akbaba Evi",description:"a house",residents:[],
          sublocations:[{id:"s_salon",name:"Salon"},{id:"s_mutfak",name:"Mutfak"},{id:"s_bahce",name:"Bahçe"}]}],
        gameData:{},rules:[],trackers:[],prompts:{}});
      state.universes=[U];
      const mk=(id,n)=>({id,name:n,universeId:"u1",personality:"x",instructions:"x",backstory:"x",style:"x",goals:"x",look:{},relationships:{}});
      state.personas=[mk("p_d","Duygu Akbaba"),mk("p_h","Hakan Akbaba"),mk("p_o","Özlem Kaya")];
      Object.assign(state,{key:"k",user:"Emre",mem:false,sceneOn:false,gmOn:false,autoRpOn:false,heatOn:false,suggestOn:false,autoSpeak:false,narrMode:false,
        relOn:false,trackOn:false,calOn:false,promiseOn:false,gossipOn:false,intentOn:false,pulseOn:false,roundOn:false,charQuestsOn:false,
        goalPursuitOn:false,textsOn:false,autoImg:false,imgMode:"off",streamReveal:false,storyLang:"tr",travelTime:0,presenceOff:false,presenceCueGate:false});
      state.payloadTplOn=false;
      const present=opts.present||["p_d"];
      const subPos={}; present.forEach(id=>subPos[id]="s_salon");
      Object.assign(subPos,opts.subPos||{});
      state.chats={c1:{id:"c1",universeId:"u1",castIds:[],presentIds:present,memCounts:{},tempChars:[],activeEvent:null,gameDay:1,period:"Afternoon",
        locationId:"l_ev",location:"Akbaba Evi",subId:opts.subId||"s_salon",subSelf:!!opts.subSelf,subPos,calendar:[],promises:[],rel:{},
        messages:(opts.messages||[]).map(m=>Object.assign({mid:newMid(),present:present.slice()},m))}};
      state.curUniverse="u1"; state.curChat="c1"; applyUniverseProfile("u1"); state.memory=[];
      __calls=[]; __presence=()=>"{}";
      show('chat'); try{ renderChat(); }catch(e){}
      return state.chats.c1;
    };
    window.__settle=async()=>{ const t=Date.now(); while(Date.now()-t<15000){ await __sleep(50);
      if(!_presentPlaying&&!_presentQueue.length&&!chatBusy(state.chats.c1,"turn")) return true; } return false; };
  });

  console.log("\n[1-2 — \"I'll bring tea\": she goes to the kitchen, the player stays, and she comes back]");
  const T=await pg.evaluate(async()=>{
    const c=__setup({messages:[
      {role:"user",content:'"Bir çay içer miyiz?"'},
      {role:"assistant",speaker:"Duygu Akbaba",speakerId:"p_d",content:'"Tabii, hemen çay getireyim." *Kalkıp mutfağa yürüyorum.*'}]});
    __presence=()=>'{"exit":[],"enter":[],"move":{"Duygu Akbaba":"Mutfak"},"coming":{"Duygu Akbaba":"çay getirecek"}}';
    await runPresenceTracker(c);
    const after1={duygu:charSubId(c,"p_d"),player:curSubId(c),expected:JSON.parse(JSON.stringify(c.expected||[]))};
    // the player passes the turn, alone in the salon
    __calls=[];
    let roster="";
    __presence=(t)=>{ if(!roster) roster=t; return roster===t?'{"exit":[],"enter":[],"move":{"Duygu Akbaba":"Salon"}}':"{}"; };
    await sendMessage({chat:c,text:'*Koltuğa yaslanıp bekliyorum.*'}); await __settle();
    const dbgs=__calls.map(x=>x.dbg);
    const last=c.messages[c.messages.length-1];
    return {after1, roster, dbgs, duygu:charSubId(c,"p_d"), expected:(c.expected||[]).length,
      lastSpeaker:last&&last.speaker, nobody:c.messages.some(m=>/Nobody is here|You're alone/.test(m.content||""))};
  });
  ok("she goes to the kitchen and the player is NOT walked in after her", T.after1.duygu==="s_mutfak"&&T.after1.player==="s_salon", JSON.stringify(T.after1));
  ok("her promise is kept on the chat", T.after1.expected.length===1&&T.after1.expected[0].id==="p_d"&&/çay/.test(T.after1.expected[0].said), JSON.stringify(T.after1.expected));
  ok("alone, the player's line runs the presence tracker (it used to run only the future tracker)", T.dbgs.filter(d=>/Presence tracker/.test(d)).length>=1&&T.dbgs.findIndex(d=>/Presence tracker/.test(d))<Math.max(0,T.dbgs.findIndex(d=>/Roleplay reply/.test(d))), JSON.stringify(T.dbgs));
  ok("and it is told who is expected, what they said and how long ago", /EXPECTED TO JOIN [^\\n]* \(they said they would come\)/.test(T.roster)&&/Duygu Akbaba — \\"çay getirecek\\" \(1 turn ago\)/.test(T.roster), T.roster.slice(T.roster.indexOf("EXPECTED TO JOIN",T.roster.indexOf("Currently present"))-20).slice(0,300));
  ok("she comes back to the salon, and the promise is spent", T.duygu==="s_salon"&&T.expected===0, JSON.stringify({duygu:T.duygu,expected:T.expected}));
  ok("she is here now, so she answers — no \"nobody is here\" notice", T.lastSpeaker==="Duygu Akbaba"&&!T.nobody, JSON.stringify({last:T.lastSpeaker,nobody:T.nobody,dbgs:T.dbgs}));

  console.log("\n[1 — alone and nobody due: the tracker still runs, the notice says who is expected]");
  const A=await pg.evaluate(async()=>{
    const c=__setup({present:["p_d"],subPos:{p_d:"s_bahce"},subSelf:true,messages:[
      {role:"assistant",speaker:"Duygu Akbaba",speakerId:"p_d",content:'"Sen geç, ben sonra gelirim."'}]});
    c.expected=[{id:"p_d",name:"Duygu Akbaba",said:"sonra gelecek",turn:_playerTurns(c)}];
    await sendMessage({chat:c,text:'"Burada bekliyorum."'}); await __settle();
    const note=c.messages.filter(m=>m.uiNote).map(m=>m.content).pop()||"";
    return {dbgs:__calls.map(x=>x.dbg), note, still:(c.expected||[]).length};
  });
  ok("one presence call on the player's line", A.dbgs.filter(d=>/Presence tracker/.test(d)).length===1, JSON.stringify(A.dbgs));
  ok("the notice names who said they would come", /Duygu Akbaba said they’d come/.test(A.note), A.note);
  ok("the promise is still open", A.still===1);

  console.log("\n[3 — six turns past the promise and still in the kitchen: walked back in code]");
  const F=await pg.evaluate(async()=>{
    const c=__setup({present:["p_d"],subPos:{p_d:"s_mutfak"},subSelf:true,messages:[
      {role:"user",content:"a"},{role:"user",content:"b"},{role:"user",content:"c"},{role:"user",content:"d"},{role:"user",content:"e"},{role:"user",content:"f"},{role:"user",content:"g"}]});
    c.expected=[{id:"p_d",name:"Duygu Akbaba",said:"çay getirecek",turn:1}];
    let roster=""; __presence=(t)=>{ roster=t; return "{}"; };
    await runPresenceTracker(c);
    return {duygu:charSubId(c,"p_d"), expected:(c.expected||[]).length, overdue:/OVERDUE/.test(roster)};
  });
  ok("the roster marks her OVERDUE", F.overdue===true);
  ok("the model said nothing, so the app brings her back itself", F.duygu==="s_salon"&&F.expected===0, JSON.stringify(F));
  const F2=await pg.evaluate(async()=>{
    const c=__setup({present:["p_d"],subPos:{p_d:"s_mutfak"},subSelf:true,messages:[{role:"user",content:"a"},{role:"user",content:"b"},{role:"user",content:"c"}]});
    c.expected=[{id:"p_d",name:"Duygu Akbaba",said:"çay getirecek",turn:1}];
    await runPresenceTracker(c);
    return charSubId(c,"p_d");
  });
  ok("two turns in, it waits for the model (no forced move)", F2==="s_mutfak", F2);
  const F3=await pg.evaluate(async()=>{
    const c=__setup({present:["p_d"],messages:[]});
    c.expected=[{id:"p_d",name:"Duygu Akbaba",said:"x",turn:-20}];
    _pruneExpected(c); const stale=(c.expected||[]).length;
    c.expected=[{id:"p_d",name:"Duygu Akbaba",said:"x",turn:0}];
    _pruneExpected(c); const here=(c.expected||[]).length;
    return {stale,here};
  });
  ok("a promise 12 turns old is dropped; one from someone already beside the player too", F3.stale===0&&F3.here===0, JSON.stringify(F3));

  console.log("\n[4 — offstage \"I'll come later\" is listed, and an enter brings them to the player]");
  const O=await pg.evaluate(async()=>{
    const c=__setup({present:[],messages:[{role:"assistant",speaker:"Özlem Kaya",speakerId:"p_o",content:'"Siz başlayın, ben akşama doğru uğrarım."'}]});
    c.presentIds=[];
    c.expected=[{id:"p_o",name:"Özlem Kaya",said:"akşama doğru uğrayacak",turn:0}];
    c.messages.push({mid:newMid(),role:"user",content:'"Özlem nerede kaldı?"',present:[]});
    let roster=""; __presence=(t)=>{ roster=t; return '{"exit":[],"enter":["Özlem Kaya"],"move":{}}'; };
    await runPresenceTracker(c);
    return {listed:/Özlem Kaya — \\"akşama doğru uğrayacak\\"/.test(roster), here:inSceneIds(c).includes("p_o"), expected:(c.expected||[]).length};
  });
  ok("offstage, she is listed as expected", O.listed===true, JSON.stringify(O));
  ok("entered into the player's area, the promise is spent", O.here&&O.expected===0, JSON.stringify(O));

  console.log("\n[5 — with company, the tracker runs after the reply, never on the player's line first]");
  const S=await pg.evaluate(async()=>{
    const c=__setup({present:["p_d"],messages:[{role:"assistant",speaker:"Duygu Akbaba",speakerId:"p_d",content:'"Hoş geldin."'}]});
    await sendMessage({chat:c,text:'"Nasılsın?"'}); await __settle();
    const solo=__calls.map(x=>x.dbg).filter(d=>/Presence tracker|Roleplay reply/.test(d));
    const c2=__setup({present:["p_d","p_h"],messages:[{role:"assistant",speaker:"Duygu Akbaba",speakerId:"p_d",content:'"Hoş geldin."'}]});
    await sendMessage({chat:c2,text:'"Nasılsınız?"'}); await __settle();
    const multi=__calls.map(x=>x.dbg).filter(d=>/Presence tracker|Roleplay reply/.test(d));
    return {solo,multi};
  });
  ok("one on one: the reply first, then one presence read", S.solo[0]&&/Roleplay reply/.test(S.solo[0])&&S.solo.filter(d=>/Presence/.test(d)).length===1, JSON.stringify(S.solo));
  ok("in a group: no presence read before the first reply", S.multi[0]&&/Roleplay reply/.test(S.multi[0])&&S.multi.some(d=>/Presence/.test(d)), JSON.stringify(S.multi));

  console.log("\n[6 — the prompt]");
  const P=await pg.evaluate(()=>({def:/EXPECTED TO JOIN \{\{user\}\}/.test(DEFAULT_PRESENCE_TRACKER)&&/"coming":\{"Name"/.test(DEFAULT_PRESENCE_TRACKER),
    mig:/_refreshPipe\("presencePrompt","You track who is physically present","EXPECTED TO JOIN"/.test(document.documentElement.innerHTML)}));
  ok("the default asks for \"coming\" and explains EXPECTED TO JOIN", P.def===true);
  ok("stored copies of the old default are refreshed", P.mig===true);

  ok("no page errors", errs.length===0?true:errs.join(" | "));
  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close(); process.exit(fail?1:0);
})();
