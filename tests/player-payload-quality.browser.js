/* v148.4 — THE PLAYER-SIDE PAYLOADS, READ AS THE MODEL READS THEM (payload-quality review, player engines).
   - every player engine (suggestions, Story mode, the Auto-RP narrator, the recap) reads the transcript as the
     player lived it: no one's _thoughts_, no offstage world news, whispers marked; a whisper BACK is private
     as a whole; the player's own text is labelled; a narration-only stretch writes no player memory
   - a suggestion or a Story move can be a whisper, and a narrated turn that comes back as "/whisper Name …"
     is sent as one (it was posted publicly)
   - the Your-ties writer gets public facts, never the character's card prose
   - THE PLAYER'S PLANS holds the player's meetings; the card's directional tie word is not the player's tie
   - open threads close (the writer's "closed", the promise ledger, age) and show once
   - a texter reads only what they witnessed, with "[here now]" from their own place; the proactive texter
     gets only fresh news it was part of, without the reply rules
   - the scene line says who is in earshot and who is elsewhere at the place
   Every model call is stubbed (window.chatCompletion) and the payloads it receives are captured.
   Run: NODE_PATH=/path/to/node_modules node tests/player-payload-quality.browser.js */
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

  /* The review's table: Emre with Sami and Berker (brothers) at the cafe's patio; Duygu inside, out of earshot;
     Burcu at home. Sami's card holds his private view of Emre; Berker's a secret tie. */
  const setup=()=>pg.evaluate(()=>{
    const uni=state.universes[0]; state.curUniverse=uni.id; uni.userName="Emre"; delete uni.userTies; delete uni.userSocialGraphAuto; uni.userSocialGraph="";
    uni.locations=[{id:"l_cafe",name:"Vanadium Cafe",type:"public",description:"c",residents:[],sublocations:[{id:"s_pat",name:"Patio"},{id:"s_in",name:"Inside"}]},
                   {id:"l_bu",name:"Atan House",type:"home",description:"h",residents:["p_bu"],sublocations:[{id:"s_bu",name:"Kitchen"}]}];
    const mk=(id,name,extra)=>Object.assign({id,name,universeId:uni.id,instructions:"x",personality:"x",backstory:"x",style:"x",goals:"x",look:{}},extra||{});
    state.personas=[
      mk("p_sa","Sami Özüçak",{backstory:"You never repaid a loan from Berker and you hide your card debt from Buket.",personality:"You resent your brother.",
        socialGraph:"Berker is your younger brother; you secretly envy him.",look:{face_map:"Some Actor",hair:"black curly hair",body:"stocky build"},
        relationships:{__user__:{tie:"childhood friend",relationship:"You've noticed he's been looking at Burcu."},p_be:{tie:"younger brother",relationship:"You lean on him."}}}),
      mk("p_be","Berker Özüçak",{backstory:"You have begun to want something that belongs to you and Buket alone.",
        relationships:{__user__:{tie:"husband's childhood friend",relationship:"x"},p_sa:{tie:"older brother",relationship:"x"},p_bu:{tie:"secret lover",relationship:"x"},p_du:{tie:"the woman I pity",relationship:"x"}}}),
      mk("p_bu","Burcu Atan",{relationships:{__user__:{tie:"husband's childhood friend",relationship:"x"},p_sa:{tie:"neighbour",relationship:"x"}}}),
      mk("p_du","Duygu Akbaba")];
    state.user="Emre"; state.key="sk-test"; state.mem=true; state.memMinImp=0; state.condenseOn=false; state.playerMemOn=true;
    state.autoCharOn=false; state.embedOn=false; state.narrPrivacy=true; state.autoRpOn=false; state.heatOn=false; state.suggestOn=false;
    state.autoSpeak=false; state.narrMode=false; state.gmOn=false; state.calOn=false; state.relOn=false; state.trackOn=false; state.promiseOn=true;
    state.pulseOn=false; state.autoImg=false; state.textsOn=true; state.recapOn=true;
    const chat=curChat(); chat.universeId=uni.id; chat.gameDay=1; chat.period="Midday"; chat.timeOfDay="Midday";
    chat.locationId="l_cafe"; chat.location="Vanadium Cafe"; chat.subId="s_pat";
    chat.presentIds=["p_sa","p_be","p_du"]; chat.subPos={p_sa:"s_pat",p_be:"s_pat",p_du:"s_in"};
    chat.rel={}; chat.memEvent=null; chat.memDoneIdx=-1; chat.messages=[]; chat.playerMem=[]; chat.calendar=[]; chat.promises=[]; chat.intents=[];
    chat.autoPlay=false; chat.storyMode=false; chat.dnd=false; chat._smChoice=null; chat._smSteps=0;
    state.memory=[];
    window.__calls=[];
    window.__sug=JSON.stringify({options:["Tease Sami back","Ask Berker about Friday","Head back to the plant"]});
    window.__decide='{"intent":"Ask Sami about Friday"}';
    window.__pm=JSON.stringify({content:"I sat with Sami and Berker.",people:["Sami Özüçak"],importance:0.5,open:[],closed:[]});
    window.__narr=null;
    window.chatCompletion=async(msgs,model,opts)=>{
      const d=(opts&&opts.dbg)||""; const text=JSON.stringify(msgs);
      window.__calls.push({dbg:d,text,msgs,opts:opts||{}});
      if(/^Roleplay reply/.test(d))return '"Tamam."';
      if(d==="Suggested replies")return window.__sug;
      if(d==="Story mode · the player's move")return window.__decide;
      if(d==="Auto-RP player narrator"){
        const u=msgs.filter(m=>m.role==="user").map(m=>m.content).join("\n");
        if(window.__narr)return window.__narr(u);
        const said=(u.match(/(?:rewrite this as their turn|not words they typed|No \/whisper prefix):\n([\s\S]*)$/)||[])[1]||"?";
        return /PRIVATE aside/.test(u)?'*'+said.trim()+'*':'*I lean in.* "'+said.trim()+'"';
      }
      if(/\(you\)/.test(d))return window.__pm;
      if(/^Your ties/.test(d))return JSON.stringify({people:[]});
      if(/^Text reply/.test(d))return "tamam";
      if(/^Proactive text/.test(d))return '{"text":false}';
      if(d==="Scene recap")return "Emre is back at the cafe.";
      return "{}";
    };
    markChatDirty(chat); show('chat'); try{ renderChat(); }catch(e){}
    document.getElementById('chatInput').value="";
    return true;
  });
  // A table scene with everything the player must not read: a thought, an offstage world event, a whisper each way.
  const scene=()=>pg.evaluate(()=>{
    const chat=curChat(); const ear=["p_sa","p_be","p_du"];
    chat.messages.push({mid:"s0",role:"user",content:'"Friday, then." *I nod to Sami.*',present:ear.slice()});
    chat.messages.push({mid:"s1",role:"assistant",speaker:"Sami Özüçak",speakerId:"p_sa",content:'"Cash, Emre." _Buket must never find out._',present:ear.slice(),toId:"__user__"});
    chat.messages.push({mid:"s2",role:"assistant",speaker:"Narrator",narratorEvent:true,worldEvent:true,present:[],content:"**Buket went to the bank**\nBuket asked the bank for a copy of the card statement."});
    chat.messages.push({mid:"s3",role:"user",content:"*I slip the envelope into his palm.*",whisperTo:"p_sa",whisperToName:"Sami Özüçak",present:ear.slice()});
    chat.messages.push({mid:"s4",role:"assistant",speaker:"Sami Özüçak",speakerId:"p_sa",whisperTo:"__user__",whisperToName:"Emre",content:'*He pockets it.* "Not here, everyone is watching." _Finally._',present:ear.slice()});
    chat.messages.push({mid:"s5",role:"assistant",speaker:"Berker Özüçak",speakerId:"p_be",content:'"What are you two whispering about?"',present:ear.slice(),toId:"__user__"});
  });
  const settle=()=>pg.evaluate(async()=>{
    for(let i=0;i<150;i++){ await new Promise(r=>setTimeout(r,100));
      if(!_apBusy&&!_presentPlaying&&!_presentQueue.length&&!document.getElementById('sendBtn').disabled&&!chatBusy(curChat(),"turn")) break; }
  });

  // ---------------------------------------------------------------------------------------------
  console.log("\n[1. what the player heard — one reader for every player engine]");
  await setup(); await scene();
  const H=await pg.evaluate(()=>{
    const c=curChat(); const m=id=>c.messages.find(x=>x.mid===id);
    return {thought:_playerHeardText(m("s1")),world:_playerHeardText(m("s2")),mine:_playerHeardText(m("s3")),back:_playerHeardText(m("s4")),
      text:_playerHeardText({role:"user",textMsg:true,textWith:"p_bu",textWithName:"Burcu Atan",content:"Maybe coffee one day?"}),
      note:_playerHeardLine({role:"assistant",presenceNote:true,sysError:true,content:"— Burak Atan arrived —"},"Emre")};
  });
  ok("a character's _thought_ never reaches the player's engines", /Cash, Emre/.test(H.thought)&&!/never find out/.test(H.thought), JSON.stringify(H));
  ok("an offstage world event is not something the player saw", H.world==="", JSON.stringify(H));
  ok("the player's own whisper is marked as one", /^\(whispered to Sami Özüçak alone\) I slip the envelope/.test(H.mine), H.mine);
  ok("a whisper BACK is private as a whole — the spoken part is not '(aloud)', and no thought", /^\(whispered to me alone\) \*He pockets it\.\* "Not here, everyone is watching\."$/.test(H.back)&&!/aloud|Finally/.test(H.back), H.back);
  ok("the player's own text is labelled as a text to that person", H.text==="(text message to Burcu Atan) Maybe coffee one day?", H.text);
  ok("who came and went is something the player saw", H.note==="Narrator: — Burak Atan arrived —", H.note);

  const S=await pg.evaluate(async()=>{
    const chat=curChat(); _sugBusy=false; await fetchSuggestions(chat,"s5");
    const c=window.__calls.find(x=>x.dbg==="Suggested replies"); return c?c.msgs[1].content:"";
  });
  const lastLines=t=>(t.split("THE LAST LINES:\n")[1]||"").split("\n\n")[0];
  ok("Suggested replies: THE LAST LINES carry no thought and no offstage news", /Cash, Emre/.test(lastLines(S))&&!/never find out|Finally|bank/.test(S), lastLines(S));
  ok("Suggested replies: the whispers are marked, both ways", /Emre: \(whispered to Sami Özüçak alone\)/.test(S)&&/Sami Özüçak: \(whispered to me alone\)/.test(S), lastLines(S));
  const SM=await pg.evaluate(async()=>{
    const chat=curChat(); window.__decide='{"choice":true,"question":"Tell Berker?","options":["Tell him","Keep quiet"]}'; chat._smSinceChoice=99;
    await smPlayerMove(chat); const c=window.__calls.find(x=>x.dbg==="Story mode · the player's move"); chat._smChoice=null; return c?c.msgs[1].content:"";
  });
  ok("Story mode: the same scene, as the player lived it", /whispered to Sami Özüçak alone/.test(SM)&&!/never find out|Finally|bank/.test(SM), lastLines(SM));

  const N=await pg.evaluate(async()=>{
    const chat=curChat();
    chat.playerMem=[{id:"pmA",content:"I promised Sami the money in cash on Friday.",people:["Sami Özüçak"],importance:0.8,gameDay:1,gamePeriod:"Morning",srcMids:["x1"]}];
    recordPromise(chat,{holder:"Emre",to:"Sami Özüçak",promise:"you will keep Sami's card trouble from Buket",kind:"promise",shows_as:"when money comes up"},1);
    const out=await narratePlayerTurn("give Sami the envelope",chat,{intent:true});
    const c=window.__calls.filter(x=>x.dbg==="Auto-RP player narrator").slice(-1)[0];
    return {u:c?c.msgs[1].content:"",out};
  });
  ok("Auto-RP narrator: the round since the player's last line (four lines at least), as heard — no thought, no world news", /Recent lines:\nSami Özüçak: "Cash, Emre\."\nEmre: \(whispered to Sami Özüçak alone\)/.test(N.u)&&/What are you two whispering about/.test(N.u)&&!/never find out|Finally|bank/.test(N.u), N.u.slice(0,900));
  ok("…and what the player remembers and the words they gave", /What you remember:\n- .*money in cash on Friday/.test(N.u)&&/Words given:[\s\S]*card trouble from Buket/.test(N.u), N.u.slice(0,900));
  ok("…and a suggestion or Story move is labelled an intention, not typed words", /Emre's intention for this turn \(play it out as their turn — it is what they mean to do, not words they typed\):\ngive Sami the envelope/.test(N.u)&&!/just typed/.test(N.u), N.u.slice(-300));

  const R=await pg.evaluate(async()=>{
    const chat=curChat(); chat.lastActive=1;
    await maybeShowRecap(chat); const c=window.__calls.find(x=>x.dbg==="Scene recap"); return c?c.msgs[1].content:"";
  });
  ok("Scene recap: the lines as the player lived them, and WHERE THINGS STAND NOW", /WHERE THINGS STAND NOW:\nDay 1, Midday, at Vanadium Cafe\./.test(R)&&/whispered to Sami Özüçak alone/.test(R)&&!/never find out|bank/.test(R), R);

  const SL=await pg.evaluate(()=>{ const c=curChat(); const a=_autoRpSceneLine(c); c.subPos.p_du="s_pat"; const b=_autoRpSceneLine(c); c.subPos.p_du="s_in";
    const keep=c.presentIds; c.presentIds=[]; const d=_autoRpSceneLine(c); c.presentIds=keep; return {a,b,d}; });
  ok("the scene line: who can hear, then who is elsewhere at the place", /Present \(within earshot\): Sami Özüçak, Berker Özüçak\. Also here, out of earshot: Duygu Akbaba\.$/.test(SL.a), SL.a);
  ok("…nobody out of earshot, no second list; nobody at all, alone", !/out of earshot/.test(SL.b)&&/You are alone\.$/.test(SL.d), JSON.stringify(SL));

  // ---------------------------------------------------------------------------------------------
  console.log("\n[2. the player's memory]");
  await setup();
  const PM=await pg.evaluate(async()=>{
    const chat=curChat(); const ear=["p_sa","p_be"];
    chat.messages.push({mid:"t0",role:"assistant",speaker:"Narrator",narratorEvent:true,travelBeat:true,present:ear,content:"The three of them walk to the canteen."});
    chat.messages.push({mid:"t1",role:"assistant",presenceNote:true,sysError:true,present:ear,content:"— Emre moves to the Worker Canteen —"});
    const k=window.__calls.length;
    const r1=await buildPlayerMemory(chat,chat.messages.slice(0,2),1,"Afternoon");
    return {r1,called:window.__calls.slice(k).some(x=>/\(you\)/.test(x.dbg))};
  });
  ok("a stretch of nothing but narration writes no memory (nothing was said or done)", PM.r1===false&&!PM.called, JSON.stringify(PM));
  const OT=await pg.evaluate(async()=>{
    const chat=curChat(); chat.gameDay=5;
    chat.playerMem=[
      {id:"o1",content:"Old one.",people:["Sami Özüçak"],importance:0.9,open:["visit the old mill"],gameDay:1,gamePeriod:"Morning",srcMids:["y0"]},
      {id:"o2",content:"I told Sami I'd bring the money.",people:["Sami Özüçak"],importance:0.9,open:["bring Sami the money on Friday","call Burak back"],gameDay:5,gamePeriod:"Morning",srcMids:["y1"]},
      {id:"o3",content:"Sami asked again about the money.",people:["Sami Özüçak"],importance:0.9,open:["bring Sami the money on Friday"],gameDay:5,gamePeriod:"Midday",srcMids:["y2"]}];
    chat.gameDay=9; const aged=playerMemoryLines(chat,8); chat.gameDay=5;
    const once=playerMemoryLines(chat,8);
    chat.promises=[]; recordPromise(chat,{holder:"Emre",to:"Sami Özüçak",promise:"you will bring Sami the money on Friday",kind:"promise",shows_as:"when money comes up"},3);
    chat.promises.forEach(p=>{ p.status="kept"; });
    const kept=playerMemoryLines(chat,8);
    chat.promises=[];
    const ear=["p_sa","p_be"];
    chat.messages=[{mid:"z0",role:"user",content:'"Here, the rest of it."',present:ear},{mid:"z1",role:"assistant",speaker:"Sami Özüçak",speakerId:"p_sa",content:'"Thanks, brother."',present:ear}];
    const threads=_playerOpenThreads(chat,5,8);
    window.__pm=JSON.stringify({content:"I gave Sami the rest of the money.",people:["Sami Özüçak"],importance:0.6,open:[],closed:[threads.indexOf("bring Sami the money on Friday")+1]});
    const k=window.__calls.length;
    await buildPlayerMemory(chat,chat.messages,5,"Evening");
    const c=window.__calls.slice(k).find(x=>/\(you\)/.test(x.dbg));
    return {aged,once,kept,threads,sent:c?c.msgs[1].content:"",after:JSON.stringify(chat.playerMem.map(x=>x.open||[]))};
  });
  ok("a thread older than a few days is no longer 'still open'", !/still open/.test(OT.aged), OT.aged);
  ok("the same thread in two memories is shown once, on the newest; one from four days back is gone", !/old mill/.test(OT.once)&&(OT.once.match(/bring Sami the money on Friday/g)||[]).length===1&&/Sami asked again about the money\. \(still open: bring Sami the money on Friday\)/.test(OT.once), OT.once);
  ok("a thread whose promise is on the ledger as kept is settled", !/bring Sami the money/.test(OT.kept)&&/call Burak back/.test(OT.kept), OT.kept);
  ok("the memory writer sees the recent open threads, numbered, each once", /THREADS STILL OPEN FROM BEFORE:\n1\. bring Sami the money on Friday\n2\. call Burak back/.test(OT.sent)&&!/old mill/.test(OT.sent), OT.sent);
  ok("…and the numbers it returns as closed come off every memory carrying them", OT.after==='[["visit the old mill"],["call Burak back"],[],[]]', OT.after);

  // ---------------------------------------------------------------------------------------------
  console.log("\n[3. a move can be private]");
  await setup(); await scene();
  const W1=await pg.evaluate(async()=>{
    const chat=curChat();
    window.__sug=JSON.stringify({options:["/whisper Sami Özüçak Slip him the rest of the money","Laugh it off with Berker",{text:"Ask Sami quietly about Buket",whisper_to:"Sami"},"/whisper Nobody Here Say hi"]});
    _sugBusy=false; await fetchSuggestions(chat,"s5");
    const opts=_sugOpts.slice(); state.suggestOn=true; renderAutoBar();
    const chips=[...document.querySelectorAll('#autoBar .sugChip')].map(x=>x.textContent.trim());
    return {opts,chips};
  });
  ok("a suggestion meant for one person alone keeps its target (either form); an unknown name plays publicly",
     W1.opts[0]==="/whisper Sami Özüçak Slip him the rest of the money"&&W1.opts[1]==="Laugh it off with Berker"&&W1.opts[2]==="/whisper Sami Özüçak Ask Sami quietly about Buket", JSON.stringify(W1.opts));
  ok("…and its button says who it is for", W1.chips.some(c=>c==="🤫 Sami: Slip him the rest of the money"), JSON.stringify(W1.chips));
  const W2=await pg.evaluate(async()=>{
    const chat=curChat(); const n=chat.messages.length; window.__calls=[];
    sendSuggestion(0);
    for(let i=0;i<150;i++){ await new Promise(r=>setTimeout(r,100)); if(!chatBusy(chat,"turn")&&!document.getElementById('sendBtn').disabled)break; }
    const mine=chat.messages.slice(n).filter(m=>m.role==="user");
    const narr=window.__calls.find(x=>x.dbg==="Auto-RP player narrator");
    const reply=chat.messages.slice(n).filter(m=>m.role==="assistant"&&m.speakerId==="p_sa").slice(-1)[0];
    return {mine:mine.map(m=>({c:m.content,to:m.whisperTo})),narr:narr?narr.msgs[1].content:"",reply:reply?{c:reply.content,to:reply.whisperTo}:null,
      others:chat.messages.slice(n).filter(m=>m.role==="assistant"&&m.speakerId==="p_be").length};
  });
  ok("tapping it sends a whisper to Sami, written out by the narrator as the aside", W2.mine.length===1&&W2.mine[0].to==="p_sa"&&W2.mine[0].c==="*Slip him the rest of the money*", JSON.stringify(W2));
  ok("…the narrator was told it is a private aside, kept in one *span*", /a PRIVATE aside to Sami Özüçak/.test(W2.narr)&&/inside ONE pair of \*asterisks\*/.test(W2.narr), W2.narr.slice(-400));
  ok("…and only Sami answers, privately", W2.reply&&W2.reply.to==="__user__"&&W2.others===0, JSON.stringify(W2));

  await setup(); await scene();
  const W3=await pg.evaluate(async()=>{
    const chat=curChat(); const n=chat.messages.length;
    window.__decide='{"intent":"Slip him the envelope","whisper_to":"Sami Özüçak"}';
    await smPlayerMove(chat);
    for(let i=0;i<150;i++){ await new Promise(r=>setTimeout(r,100)); if(!chatBusy(chat,"turn"))break; }
    const mine=chat.messages.slice(n).filter(m=>m.role==="user");
    return mine.map(m=>({c:m.content,to:m.whisperTo}));
  });
  ok("a Story move with whisper_to is played as a whisper", W3.length===1&&W3[0].to==="p_sa"&&W3[0].c==="*Slip him the envelope*", JSON.stringify(W3));

  await setup(); await scene();
  const W4=await pg.evaluate(async()=>{
    const chat=curChat(); const n=chat.messages.length; state.autoRpOn=true;
    window.__narr=()=>'/whisper Sami Özüçak *Zarfı avucuna sıkıştırıyorum.*';
    document.getElementById('chatInput').value="give it to him quietly";
    await sendMessage();
    for(let i=0;i<150;i++){ await new Promise(r=>setTimeout(r,100)); if(!chatBusy(chat,"turn"))break; }
    state.autoRpOn=false; window.__narr=null;
    const mine=chat.messages.slice(n).filter(m=>m.role==="user");
    return {mine:mine.map(m=>({c:m.content,to:m.whisperTo})),leak:chat.messages.some(m=>/^\s*\/whisper/.test(String(m.content||"")))};
  });
  ok("a narrated turn that comes back as '/whisper Name …' is sent as that whisper — never posted in public", W4.mine.length===1&&W4.mine[0].to==="p_sa"&&W4.mine[0].c==="*Zarfı avucuna sıkıştırıyorum.*"&&!W4.leak, JSON.stringify(W4));

  // ---------------------------------------------------------------------------------------------
  console.log("\n[4. the Your-ties writer: public facts only]");
  await setup(); await scene();
  const T=await pg.evaluate(async()=>{
    const chat=curChat(); chat.playerMem=[{id:"pmA",content:"Sami asked me for money.",people:["Sami Özüçak"],gameDay:1,gamePeriod:"Midday"}];
    const k=window.__calls.length; await updatePlayerSheet(chat,["p_sa","p_be","p_bu"]);
    const c=window.__calls.slice(k).find(x=>/^Your ties/.test(x.dbg)); return c?c.msgs[1].content+"\n"+c.msgs[0].content:"";
  });
  ok("none of the card's prose: backstory, personality, social graph", !/never repaid|card debt|resent your brother|secretly envy|belongs to you and Buket/.test(T), T.slice(0,1500));
  ok("public facts from the structured fields: looks (no likeness name), home, family ties by tie word",
     /Looks: black curly hair, stocky build/.test(T)&&!/Some Actor/.test(T)&&/Lives at: Atan House/.test(T)&&/Their people, by the tie word on their card: Berker Özüçak \(younger brother\)/.test(T), T.slice(0,1500));
  ok("a private tie, or a tie in the character's own voice, is left out", !/secret lover|woman I pity/.test(T), T.slice(0,1500));
  ok("what they said where the player could hear it — without their thoughts", /What they said where you could hear it[\s\S]*Cash, Emre/.test(T)&&!/never find out|Finally/.test(T), T.slice(0,1500));
  ok("the prompt says only public facts are given", /ONLY PUBLIC FACTS ARE GIVEN TO YOU/.test(T), T.slice(-900));

  // ---------------------------------------------------------------------------------------------
  console.log("\n[5. the player's plans and ties]");
  await setup();
  const P=await pg.evaluate(()=>{
    const chat=curChat(); window.maybeSeedPlayerTies=()=>{};
    chat.calendar=[
      {id:"c1",kind:"meeting",title:"Barbecue at Emre's place",who:"Sami Özüçak, Berker Özüçak",charIds:["p_sa","p_be"],executor:"user",day:2,period:"Evening",certainty:"certain",done:false},
      {id:"c2",kind:"meeting",title:"Coffee between Sami and Duygu",who:"Sami Özüçak, Duygu Akbaba",charIds:["p_sa","p_du"],withUser:false,day:2,period:"Evening",certainty:"certain",done:false}];
    const k=_playerKnows(chat);
    return {plans:k.plans,people:k.people,short:_playerPeopleShort(chat),
      named:(()=>{ state.personas[1].relationships.__user__.tie="Emre's cousin's husband"; return playerTieLine(chat,state.personas[1]); })()};
  });
  ok("THE PLAYER'S PLANS holds the player's own meeting, with the others named", /Barbecue at Emre's place \(Evening\) with Sami Özüçak, Berker Özüçak/.test(P.plans), P.plans);
  ok("…the player is told it is theirs to make happen", /YOU are the one who has to make this happen/.test(P.plans)&&!/Emre is the one coming/.test(P.plans), P.plans);
  ok("…and two characters' plan between themselves is not the player's", !/Coffee between/.test(P.plans), P.plans);
  ok("no entry yet: a tie that reads the same both ways crosses; a directional one does not", /- Sami Özüçak \(childhood friend\)/.test(P.people)&&/- Berker Özüçak: no entry of yours yet/.test(P.people)&&!/husband's/.test(P.people), P.people);
  ok("…nor into the narrator's line", P.short==="\nWho they are to you: Sami Özüçak (childhood friend).", JSON.stringify(P.short));
  ok("…a tie that names the player outright can only be read one way", P.named==="- Berker Özüçak (Emre's cousin's husband)", P.named);

  // ---------------------------------------------------------------------------------------------
  console.log("\n[6. texts: only what the texter witnessed]");
  await setup();
  const TX=await pg.evaluate(async()=>{
    const chat=curChat(); const ear=["p_sa","p_be"]; chat.presentIds=["p_sa","p_be"]; chat.subPos={p_sa:"s_pat",p_be:"s_pat"};
    chat.worldPositions={p_bu:"l_bu",p_sa:"l_cafe",p_be:"l_cafe",p_du:"l_cafe"};
    chat.messages=[
      {mid:"u0",role:"assistant",speaker:"Burcu Atan",speakerId:"p_bu",content:"Seen the news?",textMsg:true,textWith:"p_bu",present:[]},
      {mid:"u1",role:"assistant",speaker:"Narrator",narratorEvent:true,travelBeat:true,present:ear,content:"Emre moves to the Worker Canteen, with Sami and Berker."},
      {mid:"u2",role:"assistant",speaker:"Sami Özüçak",speakerId:"p_sa",content:'"Cash, on Friday."',present:ear,status:{day:1,period:"Midday",location:"Vanadium Cafe"}},
      {mid:"u3",role:"assistant",speaker:"Narrator",presenceNote:true,sysError:true,content:"— Emre agreed to bring the money in cash —"},
      {mid:"u4",role:"assistant",speaker:"Narrator",presenceNote:true,sysError:true,present:ear,exitedIds:["p_du"],content:"— Duygu Akbaba left —"}];
    await sendTextMessage(chat,state.personas.find(p=>p.id==="p_bu"),"selam");
    for(let i=0;i<60&&!window.__calls.some(x=>/^Text reply/.test(x.dbg));i++) await new Promise(r=>setTimeout(r,100));
    const c=window.__calls.find(x=>/^Text reply/.test(x.dbg));
    return {t:c?c.text:"",src:String(resolveActiveEvent)};
  });
  ok("a texter does not read the player's scene: no travel beat, no presence note they did not witness", TX.t&&!/Worker Canteen|money in cash|Duygu Akbaba left|Cash, on Friday/.test(TX.t), TX.t.slice(0,1500));
  ok("…their own thread is still there", /Seen the news\?/.test(TX.t)&&/selam/.test(TX.t), TX.t.slice(0,600));
  ok("…nobody at the player's table is '[here now]' with them, and no 'Just LEFT the scene'", !/\[here now\]/.test(TX.t)&&!/Just LEFT the scene/.test(TX.t), (TX.t.match(/.{80}\[here now\].{20}/)||[""])[0]);
  ok("the event-resolution note is stamped with who was there", /presenceNote:true,sysError:true,\s*content:"— "\+\(how\|\|"the event passes"\)\+" —",present:inSceneIds\(chat\)\.slice\(\)/.test(TX.src), "not stamped");

  const PT=await pg.evaluate(async()=>{
    const chat=curChat(); chat.gameDay=2; chat.period="Evening"; chat.timeOfDay="Evening";
    state.memory=[{id:"mb",ownerId:"p_bu",character:"Burcu Atan",type:"EXPERIENCE",content:"Emre looked at me for too long.",people:["Emre"],gameDay:2,gamePeriod:"Evening",universeId:chat.universeId,chatId:chat.id,importance:1}];
    const run=async o=>{ const k=window.__calls.length; await maybeProactiveText(chat,o); const c=window.__calls.slice(k).find(x=>/^Proactive text/.test(x.dbg)); return c?c.text:""; };
    const other=await run({eventText:"Buket asked the bank for the card statement.",eventWho:["p_du"]});
    const hers=await run({eventText:"Burak picked a fight at the market.",eventWho:["p_bu"]});
    const got=[]; const real=window.maybeProactiveText; window.maybeProactiveText=async(c,o)=>{ got.push(o||{}); return false; };
    try{
      chat.messages.push({mid:"w1",role:"assistant",narratorEvent:true,worldEvent:true,present:[],content:"**Old news**\nThis morning.",whoIds:["p_bu"],gday:2,gperiod:"Morning"});
      chat._textTickPeriod=null; maybeProactiveTextTick(chat);
      _pushWorldEvent(chat,"Fresh","Just now.",["p_bu"]);
      chat._textTickPeriod=null; maybeProactiveTextTick(chat);
    }finally{ window.maybeProactiveText=real; }
    return {other,hers,got};
  });
  ok("proactive text: a world event about somebody else is not handed to the texter", PT.other&&!/A background event just happened|card statement/.test(PT.other), PT.other.slice(0,400));
  ok("…one they were part of is", /A background event just happened\\n[^"]*picked a fight/.test(PT.hers), (PT.hers.match(/background event.{0,80}/)||["none"])[0]);
  ok("…and the reply rules are gone from its context (format, get-a-yes, guidance, guardrails)", PT.hers&&!/OUTPUT ONLY THE WORDS YOU TYPE|WHAT IT TAKES TO GET A YES|# RESPONSE GUIDANCE|# FINAL GUARDRAILS/.test(PT.hers)&&/Return the JSON/.test(PT.hers), PT.hers.slice(0,600));
  ok("the tick passes only this part of the day's news, with who it happened to", !PT.got[0].eventText&&/Fresh/.test(PT.got[1].eventText||"")&&JSON.stringify(PT.got[1].eventWho)==='["p_bu"]', JSON.stringify(PT.got));

  // ---------------------------------------------------------------------------------------------
  console.log("\n[7. stored prompts are refreshed]");
  const RF=await pg.evaluate(()=>{
    const cur=X_ENGINE_PROMPTS.x_player_sheet.def;
    const old=cur.replace(/ONLY PUBLIC FACTS ARE GIVEN TO YOU:[^\n]*/,"The notes about each person are written from THEIR side and may contain their private thoughts: take only public facts from them and never repeat a private thought.");
    store.setRaw(K.x_player_sheet,old);
    const oldSug=X_ENGINE_PROMPTS.x_reply_suggest.def.replace(/\n\nKEEPING IT PRIVATE[^\n]*/,"");
    store.setRaw(K.x_reply_suggest,oldSug);
    return old!==cur&&oldSug!==X_ENGINE_PROMPTS.x_reply_suggest.def;
  });
  await pg.reload(); await pg.waitForTimeout(2400);
  const RF2=await pg.evaluate(()=>({sheet:state.x_player_sheet===X_ENGINE_PROMPTS.x_player_sheet.def,sug:state.x_reply_suggest===X_ENGINE_PROMPTS.x_reply_suggest.def,
    mem:/THREADS STILL OPEN FROM BEFORE/.test(X_ENGINE_PROMPTS.x_player_memory.def)&&/"closed"/.test(X_ENGINE_PROMPTS.x_player_memory.def),
    story:/"whisper_to"/.test(X_ENGINE_PROMPTS.x_story_player.def)}));
  ok("a stored copy of the old Your-ties and suggestion prompts is refreshed at load", RF===true&&RF2.sheet&&RF2.sug, JSON.stringify({RF,RF2}));
  ok("the shipped memory and Story prompts carry 'closed' and 'whisper_to'", RF2.mem&&RF2.story, JSON.stringify(RF2));

  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close(); process.exit(fail?1:0);
})();
