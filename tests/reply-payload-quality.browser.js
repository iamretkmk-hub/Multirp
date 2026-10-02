/* v148.4 — THE REPLY PAYLOAD, READ AS THE MODEL READS IT.
   A payload-quality review played a two-day Turkish session and read every roleplay reply request as
   the model sees it. Fourteen findings, pinned here one by one:
     1  the addressed character's private card was given to whoever answered them
     2  an arrival answered a line from another scene / another day; a target who had left became "the player"
     3  a quest ask / a confrontation was recorded as made before it was played (+ the rumour answer judge)
     4  /whisper: the quoted speech after the starred span was heard by the room
     5  OTHERS PRESENT and [here now] named people PRIVACY put in another area
     6  drives & brakes from the previous scene
     7  an arrival could not hear the greeting said to them at the door
     8  other characters' visible actions were stripped by default
     9  the memory query was built from lines the character never heard
    10  someone already in the room was staged as walking in
    11  the consent rail's gate could never close
    12  the engine's English verdict sat in characters' transcripts as narration
    13  ties stated twice (summary + paragraph)
    14  the turn router read whispers as ordinary lines; its hooks were clipped
   Run: node tests/reply-payload-quality.browser.js   (needs playwright; see tests/README.md) */
const {chromium}=require('playwright');
const BIN=process.env.SM_CHROME||process.env.CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
(async()=>{
  const b=await chromium.launch({executablePath:BIN});
  const pg=await b.newPage({viewport:{width:412,height:915}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file://'+require('path').resolve(__dirname,'..','index.html')); await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(900);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x===undefined?c:x).slice(0,700));} };

  /* One universe: Isdemir (a Canteen with a Table and a Kitchen), Emre's garden. Player "Emre". Every model
     call is answered by a stub and recorded (dbg + messages). */
  await pg.evaluate(()=>{
    window.__calls=[];
    window.__stub={reply:'"Tamam."', bg:{}};
    window.chatCompletion=async(messages,model,opts)=>{
      const dbg=(opts&&opts.dbg)||"";
      window.__calls.push({dbg,t:JSON.stringify(messages)});
      if(opts&&opts.rp===true) return typeof __stub.reply==="function"?__stub.reply(messages):__stub.reply;
      const k=Object.keys(__stub.bg).sort((a,b)=>b.length-a.length).find(p=>dbg.indexOf(p)===0);
      const r=k?__stub.bg[k]:"{}"; return typeof r==="string"?r:JSON.stringify(r);
    };
    window.__setup=()=>{
      const uni=state.universes[0];
      uni.locations=[
        {id:"l_can",name:"Isdemir Canteen",type:"public",description:"c",residents:[],sublocations:[{id:"s_tab",name:"Table"},{id:"s_kit",name:"Kitchen"}]},
        {id:"l_gar",name:"Emre's Garden",type:"home",description:"g",residents:[],sublocations:[]}];
      const mk=(id,name,extra)=>Object.assign({id,name,universeId:uni.id,instructions:"",personality:"You are "+name+".",
        backstory:"",style:"s",goals:"",interject:"",look:{raw:name+" looks tall"},relationships:{}},extra||{});
      state.personas=[
        mk("p_sami","Sami Ozucak",{relationships:{p_berk:{tie:"younger brother",relationship:"Sami leans on Berker's stability."},
                                                 p_oz:{tie:"sister-in-law",relationship:"Sami keeps Ozlem at arm's length."},
                                                 __user__:{tie:"old friend",relationship:"Sami owes Emre money."}},
            socialGraph:"Berker is my younger brother and I lean on him. Buket is my wife and she must never find out about the card. Berker and Buket grew up on the same street. Emre is my oldest friend."}),
        mk("p_berk","Berker Ozucak",{backstory:"You have begun to want something that belongs to you and Buket alone.",wardrobe:"a grey work jacket"}),
        mk("p_oz","Ozlem Ozucak"),
        mk("p_burak","Burak Atan"),
        mk("p_burcu","Burcu Atan"),
        mk("p_buket","Buket Ozucak")];
      Object.assign(state,{key:"k",user:"Emre",userBio:"Emre is a shift engineer at Isdemir.",userLook:"",mem:false,sceneOn:true,confrontOn:true,
        gmOn:false,autoRpOn:false,heatOn:false,suggestOn:false,autoSpeak:false,narrMode:false,relOn:false,trackOn:false,calOn:false,
        promiseOn:false,gossipOn:true,intentOn:false,pulseOn:false,roundOn:false,charQuestsOn:true,goalPursuitOn:false,textsOn:false,
        autoImg:false,imgMode:"off",streamReveal:false,storyLang:"en",voiceCheckOn:false,psycheOn:false,presenceOff:true});
      delete state.narrPrivacy;
      state.memory=[]; state.gossip=[]; uni.gameData={};
      const c=curChat();
      Object.assign(c,{universeId:uni.id,presentIds:["p_sami","p_berk"],subPos:{p_sami:"s_tab",p_berk:"s_tab"},subId:"s_tab",
        locationId:"l_can",location:"Isdemir Canteen",gameDay:2,period:"Afternoon",activeEvent:null,dnd:false,messages:[],
        calendar:[],promises:[],rel:{},_psyche:{},_cqApproachDay:null});
      window.__calls=[]; __stub.reply='"Tamam."'; __stub.bg={};
      show('chat'); try{ renderChat(); }catch(e){}
      return c;
    };
    window.__P=id=>state.personas.find(p=>p.id===id);
    window.__settle=async(ms)=>{ const t=Date.now(); while(Date.now()-t<(ms||8000)){ await new Promise(r=>setTimeout(r,60));
      if(!_presentPlaying&&!_presentQueue.length) { await new Promise(r=>setTimeout(r,120)); if(!_presentPlaying&&!_presentQueue.length) return true; } } return false; };
    window.__rp=()=>window.__calls.filter(c=>/^Roleplay reply/.test(c.dbg));
  });

  /* ------------------------------------------------------------------------------------------ */
  console.log("\n[1 — the character answered is not handed their own card]");
  const r1=await pg.evaluate(()=>{
    const c=__setup();
    c.messages=[{mid:"m1",role:"assistant",speaker:"Berker Ozucak",speakerId:"p_berk",present:["p_sami","p_berk"],content:'"Liste pazartesi masanda."'}];
    const B=buildCharPromptBlocks(__P("p_sami"),[__P("p_berk")],{recent:[],diary:[],longterm:[]},null,{chat:c,targetName:"Berker Ozucak",targetId:"p_berk"});
    const P=buildCharPromptBlocks(__P("p_sami"),[__P("p_berk")],{recent:[],diary:[],longterm:[]},null,{chat:c,targetName:"Emre",targetId:"__user__"});
    return {t:String(B.response_target||""),p:String(P.response_target||"")};
  });
  ok("Berker's private backstory is not in Sami's payload", r1.t.indexOf("belongs to you and Buket")<0 && r1.t.indexOf("their_backstory")<0, r1.t);
  ok("Sami gets his OWN tie to Berker instead", /What Berker Ozucak is to you, in your own words: younger brother/.test(r1.t), r1.t);
  ok("and how Berker looks and what he has on", /Berker Ozucak looks tall/.test(r1.t) && /grey work jacket/.test(r1.t), r1.t);
  ok("the player target keeps the player's bio, labelled as the player's", /Emre is the human player/.test(r1.p)
      && /This is Emre's own identity sheet, written TO Emre/.test(r1.p) && /shift engineer/.test(r1.p), r1.p);

  /* ------------------------------------------------------------------------------------------ */
  console.log("\n[2 — the line in front of you is from THIS scene, today; nobody absent is 'the player']");
  const r2=await pg.evaluate(()=>{
    const c=__setup();
    c.messages=[
      {mid:"d1a",role:"assistant",speaker:"Berker Ozucak",speakerId:"p_berk",present:["p_sami","p_berk","p_burak"],content:'"Liste pazartesi masanda, mangalda gorusuruz."'},
      {mid:"d1b",role:"assistant",speaker:"Burak Atan",speakerId:"p_burak",present:["p_sami","p_berk","p_burak"],content:'"Aksam nobette gorusuruz belki." *Kapiya yuruyor.*'},
      {mid:"dm",role:"assistant",dayMarker:true,sysError:true,dayFrom:1,dayTo:2,content:"Day 2"},
      {mid:"tb",role:"assistant",speaker:"Narrator",narratorEvent:true,travelBeat:true,present:[],content:"Emre walks home to the garden."},
      {mid:"ar",role:"assistant",speaker:"Narrator",presenceNote:true,sysError:true,enteredIds:["p_sami"],content:"— Sami Ozucak geldi —"}];
    c.locationId="l_gar"; c.location="Emre's Garden"; c.presentIds=["p_sami"]; c.subPos={};
    const ll=lastDialogueLine(c,__P("p_sami"));
    const sc=selfContinueLine(c,__P("p_burak"));
    // the builder with a named target who resolves to nobody
    const B=buildCharPromptBlocks(__P("p_sami"),[],{recent:[],diary:[],longterm:[]},"arriving",{chat:c,targetName:"Berker Ozucak",targetId:null});
    return {ll:JSON.stringify(ll),sc:JSON.stringify(sc),t:String(B.response_target||"")};
  });
  ok("an arrival at the garden does not answer yesterday's canteen line", r2.ll==="null", r2.ll);
  ok("a man walking in on Day 2 is not told to continue his Day 1 exit", r2.sc==="null", r2.sc);
  ok("a named target who is nobody here is never labelled the human player", !/Berker Ozucak is the human player/.test(r2.t)
      && r2.t.indexOf("shift engineer")<0, r2.t);
  const r2b=await pg.evaluate(async()=>{
    const c=__setup();
    // Berker spoke in this scene and has since left: the last reachable line is his
    c.messages=[{mid:"x1",role:"assistant",speaker:"Berker Ozucak",speakerId:"p_berk",present:["p_sami","p_berk"],content:'"Ben kalkiyorum."'}];
    c.presentIds=["p_sami"];
    await playCharacterTurn(c,__P("p_sami"),"Emre",{noWait:true});
    const t=(__rp().slice(-1)[0]||{}).t||"";
    return {human:/Berker Ozucak is the human player/.test(t), emreBio:/Berker Ozucak's own identity sheet/.test(t)};
  });
  ok("playCharacterTurn: a speaker who left is not turned into the player", !r2b.human && !r2b.emreBio, JSON.stringify(r2b));

  /* ------------------------------------------------------------------------------------------ */
  console.log("\n[3 — an ask is made when it is said]");
  const r3=await pg.evaluate(async()=>{
    const c=__setup(); const uni=state.universes[0];
    uni.gameData.charQuests=[{id:"cq_1",holderId:"p_sami",holderName:"Sami Ozucak",targetId:"__user__",status:"active",title:"The cash",
      desc:"You need the Friday money in cash.",ask:"bring the Friday money in cash",approach:"in_person",createdDay:1,progress:[]}];
    c.presentIds=[]; c.subPos={};
    const fired=startOverture(c,{accuser:__P("p_sami"),intent:"Sami asks for the cash",questAsk:true,summary:"Sami seeks out Emre",evidence:0.7});
    c.activeEvent._pendingMove={kind:"quest",qid:"cq_1",title:"The cash",holderId:"p_sami",uid:uni.id,day:2,note:"Sami Ozucak went to Emre in person and made the ask."};
    const before=charQuestSheetLines(__P("p_sami"),{brief:true});
    const q=uni.gameData.charQuests[0]; const b4={d:!!q.delivered,a:!!q.awaitingUser};
    __stub.bg["Scene writer: advance"]={narration:"",bring_in:"Sami Ozucak"};
    await __settle(9000);
    const pay=(__rp().slice(-1)[0]||{}).t||"";
    return {fired,before,b4,after:{d:!!q.delivered,a:!!q.awaitingUser,notes:(q.progress||[]).map(x=>x.text).join("|")},
            payAlready:/ALREADY asked/.test(pay), payNot:/NOT asked yet/.test(pay)||!/pursu/i.test(pay)};
  });
  ok("the overture started", r3.fired===true, JSON.stringify(r3));
  ok("before the holder speaks the ask is not recorded", r3.b4.d===false && r3.b4.a===false && /NOT asked yet/.test(r3.before), JSON.stringify(r3));
  ok("the payload that makes the ask never says it was already made", r3.payAlready===false, JSON.stringify(r3));
  ok("once the holder's line is posted, it is", r3.after.d===true && r3.after.a===true && /made the ask/.test(r3.after.notes), JSON.stringify(r3));
  ok("an event resolved before the holder spoke spends nothing", await pg.evaluate(async()=>{
      const c=__setup(); const uni=state.universes[0];
      uni.gameData.charQuests=[{id:"cq_2",holderId:"p_sami",targetId:"__user__",status:"active",title:"T",desc:"d",ask:"a",progress:[]}];
      c.activeEvent={kind:"overture",accuserId:"p_sami",_startMsg:0,resolved:false,participant:{name:"Sami Ozucak",charId:"p_sami",approaching:true},
        _pendingMove:{kind:"quest",qid:"cq_2",holderId:"p_sami",uid:uni.id,day:2,note:"made the ask"}};
      await resolveActiveEvent(c,"it passed");
      const q=uni.gameData.charQuests[0];
      return (!q.delivered&&!q.awaitingUser)?true:JSON.stringify(q); }));

  const r3b=await pg.evaluate(async()=>{
    const c=__setup(); const uni=state.universes[0];
    state.gossip=[{id:"g_1",universeId:uni.id,text:"Emre leaned in too close to Burcu at the cafe",subject:["__user__"],stakeholderId:"p_burak",
      carriers:[{charId:"p_burak",day:1}],heat:0.8,status:"open",day:1,raisedBy:{},playerStance:"",memIds:["gm1"]}];
    state.memory=[{id:"gm1",type:"GOSSIP",ownerId:"p_burak",content:"Did Emre lean in a bit too close to Burcu?",openSuspicion:true,suspicion:0.8,
      gossipId:"g_1",universeId:uni.id,gameDay:1}];
    c.presentIds=["p_sami"]; c.subPos={p_sami:"s_tab"};
    const spawned=maybeSpawnConfrontation(c,uni.id);
    const g=state.gossip[0];
    const b4={raised:JSON.stringify(g.raisedBy||{}),await:!!g._awaitAnswer};
    const tail=buildTailBlocks({chat:c,selfP:__P("p_burak"),selfId:"p_burak",selfName:"Burak Atan",targetName:"Emre",targetId:"__user__",multi:true,injected:{}});
    __stub.bg["Scene writer: advance"]={narration:"",bring_in:"Burak Atan"};
    await __settle(9000);
    const idx=c.messages.findIndex(m=>m.speakerId==="p_burak"&&!m.sysError);
    return {spawned,b4,spent:/already put this to/.test(String(tail.rumors||"")),canRaise:/rumors/.test(Object.keys(tail).join(","))&&!/already put this to/.test(String(tail.rumors||"")),
            after:{raised:(g.raisedBy||{}).p_burak,await:!!g._awaitAnswer,at:g._raise&&g._raise.at,idx}};
  });
  ok("a confrontation is spawned", r3b.spawned===true, JSON.stringify(r3b));
  ok("spawning it does not spend the raise or open an answer", r3b.b4.raised==="{}" && r3b.b4.await===false, JSON.stringify(r3b));
  ok("so the accuser's payload does not say he already put it to Emre", r3b.spent===false, JSON.stringify(r3b));
  ok("his first posted line spends it, and records where", r3b.after.raised===2 && r3b.after.await===true && r3b.after.at===r3b.after.idx && r3b.after.idx>=0, JSON.stringify(r3b));

  console.log("\n[3b — the rumour answer judge grades an answer TO the one who asked]");
  const r3c=await pg.evaluate(async()=>{
    const run=async(asker,prevAfter)=>{
      const c=__setup(); const uni=state.universes[0];
      c.presentIds=asker?["p_burak"]:["p_sami"]; c.subPos=asker?{p_burak:"s_tab"}:{p_sami:"s_tab"};
      c.messages=[{mid:"u0",role:"user",present:c.presentIds.slice(),content:'"Merhaba."'},
                  {mid:"r1",role:"assistant",speaker:"Burak Atan",speakerId:"p_burak",present:c.presentIds.concat(["p_burak"]),content:'"Emre, Burcu\'ya cok mu yaklastin?"'}];
      if(prevAfter) c.messages.push({mid:"u1",role:"user",present:c.presentIds.slice(),content:'"Hava guzel."'});
      c.messages.push({mid:"u2",role:"user",present:c.presentIds.slice(),content:'"Hayir, oyle bir sey olmadi."'});
      state.gossip=[{id:"g_2",universeId:uni.id,text:"Emre leaned in",stakeholderId:"p_burak",carriers:[],heat:0.8,status:"raised",raisedBy:{p_burak:2},
        _awaitAnswer:true,_raise:{at:1,by:"p_burak",text:'"Emre, Burcu\'ya cok mu yaklastin?"'}}];
      window.__calls=[]; __stub.bg["Rumor judge (answer)"]={verdict:"settled",why:"x"};
      await settleRumors(c,'"Hayir, oyle bir sey olmadi."');
      const call=window.__calls.find(x=>x.dbg==="Rumor judge (answer)");
      return {judged:!!call, sawAsk:!!(call&&/put it to Emre/.test(call.t)&&/yaklastin/.test(call.t)), await:!!state.gossip[0]._awaitAnswer};
    };
    return {present:await run(true,false), absent:await run(false,false), late:await run(true,true)};
  });
  ok("with the asker in earshot the answer is judged, against what was asked", r3c.present.judged && r3c.present.sawAsk, JSON.stringify(r3c));
  ok("with the asker not here, a greeting elsewhere is not graded as the answer", !r3c.absent.judged && !r3c.absent.await, JSON.stringify(r3c));
  ok("and a line two player-turns after the ask is not the answer either", !r3c.late.judged, JSON.stringify(r3c));

  /* ------------------------------------------------------------------------------------------ */
  console.log("\n[4 — /whisper: the whispered speech is private too]");
  const r4=await pg.evaluate(()=>{
    const s1=whisperSplit('*Masanin altindan dizine dokunuyorum.* "Bu aksam Burak nobette mi?"');
    const s2=whisperSplit('"Gel." *elini sikiyorum* Sonra herkese donup gulumsuyorum.');
    const s3=whisperSplit('*egilip* "bu aksam gel" Sonra yuksek sesle: "Cay isteyen?"');
    const c=__setup(); c.presentIds=["p_burcu","p_sami"]; c.subPos={p_burcu:"s_tab",p_sami:"s_tab"};
    const H=["p_burcu","p_sami"];
    c.messages=[{mid:"w1",role:"user",present:H,whisperTo:"p_burcu",whisperToName:"Burcu Atan",content:'*Masanin altindan dizine dokunuyorum.* "Bu aksam Burak nobette mi?" Sonra Sami\'ye donuyorum: "Cay?"'}];
    const sami=JSON.stringify(castHistory(c,__P("p_sami")));
    const burcu=JSON.stringify(castHistory(c,__P("p_burcu")));
    const ll=lastDialogueLine(c,__P("p_burcu"));
    return {s1,s2,s3,sami,burcu,ll:ll&&ll.text};
  });
  ok("the quoted speech right after the span is part of the aside", /Masanin/.test(r4.s1.secret) && /nobette mi/.test(r4.s1.secret) && r4.s1.open==="", JSON.stringify(r4.s1));
  ok("speech opening the body joins it; the rest stays aloud", /Gel\./.test(r4.s2.secret) && /elini sikiyorum/.test(r4.s2.secret) && /herkese donup/.test(r4.s2.open) && r4.s2.open.indexOf("Gel")<0, JSON.stringify(r4.s2));
  ok("a later quote after plain text is aloud", /bu aksam gel/.test(r4.s3.secret) && /Cay isteyen/.test(r4.s3.open), JSON.stringify(r4.s3));
  ok("the room does not hear the whispered question", r4.sami.indexOf("nobette mi")<0 && r4.sami.indexOf("Masanin")<0 && /Cay\?/.test(r4.sami), r4.sami);
  ok("the target reads the private part as private and the rest as aloud", /nobette mi/.test(r4.burcu) && /aloud — everyone here hears/.test(r4.burcu), r4.burcu);
  ok("and the highlighted line says the same", /for you alone/.test(r4.ll||"") && /aloud — everyone here hears/.test(r4.ll||""), r4.ll);

  /* ------------------------------------------------------------------------------------------ */
  console.log("\n[5 — one reading of earshot for OTHERS PRESENT, [here now] and PRIVACY]");
  const r5=await pg.evaluate(async()=>{
    const c=__setup();
    c.presentIds=["p_sami","p_berk","p_oz"]; c.subPos={p_sami:"s_tab",p_berk:"s_tab",p_oz:"s_kit"};
    c.messages=[{mid:"e1",role:"user",present:["p_sami","p_berk"],content:'"Sami, bir dakika."'}];
    await playCharacterTurn(c,__P("p_sami"),"Emre",{noWait:true});
    const t=(__rp().slice(-1)[0]||{}).t||"";
    const op=(t.match(/# OTHERS PRESENT \(within earshot\)([\s\S]*?)Address/)||[])[1]||"";
    return {op, ozMark:(t.match(/\[Ozlem Ozucak[^\]]*\][^\\]*/)||[""])[0], split:earshotSplit(c,"p_sami")};
  });
  ok("Ozlem in the kitchen is not 'within earshot'", r5.op.indexOf("Ozlem")<0 && /Berker/.test(r5.op), r5.op);
  ok("and not '[here now]' in the relationship sheet", /nearby, out of earshot/.test(r5.ozMark) && !/here now/.test(r5.ozMark), r5.ozMark);
  ok("earshotSplit is the one reading", JSON.stringify(r5.split.here)==='["p_berk"]' && JSON.stringify(r5.split.apart)==='["p_oz"]', JSON.stringify(r5.split));

  /* ------------------------------------------------------------------------------------------ */
  console.log("\n[6 — drives & brakes belong to the scene they were written for]");
  const r6=await pg.evaluate(()=>{
    const c=__setup(); const sami=__P("p_sami");
    const mk=()=>buildTailBlocks({chat:c,selfP:sami,selfId:"p_sami",selfName:"Sami Ozucak",targetName:"Emre",targetId:"__user__",multi:true,injected:{}});
    c._psyche={p_sami:{sig:psycheSig(c,sami,"__user__"),toward:"You want the money.",against:"Berker is sitting right there."}};
    const same=!!mk().drives;
    c.presentIds=["p_sami"]; c.subPos={p_sami:"s_tab"};                // Berker left: the brake is about someone gone
    const moved=!!mk().drives;
    c._psyche={p_sami:{toward:"a",against:"b"}};                        // a record from before signatures
    const legacy=!!mk().drives;
    return {same,moved,legacy};
  });
  ok("same scene: the block ships", r6.same===true, JSON.stringify(r6));
  ok("the cast changed: last scene's pull and brake wait for fresh text", r6.moved===false, JSON.stringify(r6));
  ok("a record without a signature is left as it was", r6.legacy===true, JSON.stringify(r6));

  /* ------------------------------------------------------------------------------------------ */
  console.log("\n[7 — an arrival hears the greeting said to them at the door]");
  const r7=await pg.evaluate(()=>{
    const c=__setup();
    c.messages=[{mid:"o1",role:"user",present:["p_sami","p_berk"],content:'"Is bitti mi?"'}];
    const ev={kind:"confrontation",accuserId:"p_burak",_startMsg:1,resolved:false,participant:{name:"Burak Atan",charId:"p_burak",approaching:true}};
    c.activeEvent=ev;
    c.messages.push({mid:"o2",role:"user",present:["p_sami","p_berk"],content:'"Burak! Hayirdir, nobetten once mi geldin?"'});
    c.messages.push({mid:"o3",role:"user",present:["p_sami","p_berk"],whisperTo:"p_sami",whisperToName:"Sami Ozucak",content:"Sakin ol."});
    c.presentIds.push("p_burak");
    notePresence(c,["Burak Atan"],[]);
    _stampApproachHeard(c,ev,"p_burak");
    const bu=__P("p_burak");
    const h=JSON.stringify(castHistory(c,bu));
    const ll=lastDialogueLine(c,bu);
    const tail=buildTailBlocks({chat:c,selfP:bu,selfId:"p_burak",selfName:"Burak Atan",targetName:"Emre",targetId:"__user__",multi:true,injected:{}});
    // and one with no event: nothing to answer, and no "highlighted line" sentence
    const c2=__setup(); c2.messages=[{mid:"n1",role:"user",present:["p_sami","p_berk"],content:'"Is bitti mi?"'}];
    c2.presentIds.push("p_burak"); notePresence(c2,["Burak Atan"],[]);
    const t2=buildTailBlocks({chat:c2,selfP:bu,selfId:"p_burak",selfName:"Burak Atan",targetName:"Emre",targetId:"__user__",multi:true,injected:{}});
    return {h,ll:ll&&ll.text,old:h.indexOf("Is bitti")>=0,whisper:h.indexOf("Sakin ol")>=0,g2:String(t2.response_guidance||""),ll2:!!t2.last_line};
  });
  ok("the greeting at the door is in his transcript", /nobetten once mi geldin/.test(r7.h), r7.h);
  ok("and is the line he answers", /nobetten once mi geldin/.test(r7.ll||""), r7.ll);
  ok("what was said before the event is still not his", r7.old===false, r7.h);
  ok("a whisper to someone else is still not his", r7.whisper===false, r7.h);
  ok("with nothing to answer, the guidance does not point at a highlighted line", r7.ll2===false && !/highlighted line/.test(r7.g2), r7.g2);

  /* ------------------------------------------------------------------------------------------ */
  console.log("\n[8 — the room sees what the others visibly do; thoughts stay private]");
  const r8=await pg.evaluate(()=>{
    const c=__setup();
    c.messages=[{mid:"v1",role:"assistant",speaker:"Sami Ozucak",speakerId:"p_sami",present:["p_sami","p_berk"],
      content:'*Raki bardagini kaldiriyor.* "Eski gunlere!" *Emre\'ye anlamli bir bakis atiyor.* _Cuma parasini unutmasin._'}];
    const h=JSON.stringify(castHistory(c,__P("p_berk")));
    return {mode:narrPrivacyMode(),glance:/anlamli bir bakis/.test(h),thought:/Cuma parasini/.test(h)};
  });
  ok("the default is 'seen'", r8.mode==="seen", JSON.stringify(r8));
  ok("Berker sees Sami's look at Emre", r8.glance===true, JSON.stringify(r8));
  ok("but never Sami's thought", r8.thought===false, JSON.stringify(r8));

  /* ------------------------------------------------------------------------------------------ */
  console.log("\n[9 — the memory query is what this character heard]");
  const r9=await pg.evaluate(()=>{
    const c=__setup(); c.presentIds=["p_sami","p_berk","p_burcu"]; c.subPos={p_sami:"s_tab",p_berk:"s_tab",p_burcu:"s_tab"};
    const H=["p_sami","p_berk","p_burcu"];
    c.messages=[
      {mid:"q1",role:"user",present:H,content:'"Hesabi kim odeyecek?"'},
      {mid:"q2",role:"user",present:H,whisperTo:"p_burcu",whisperToName:"Burcu Atan",content:'*Dizine dokunuyorum.* "Burak nobette mi?"'},
      {mid:"q3",role:"assistant",speaker:"Burcu Atan",speakerId:"p_burcu",present:H,whisperTo:"__user__",whisperToName:"Emre",content:'"Gece vardiyasinda." _Kalbim neden bu kadar hizli?_'},
      {mid:"q4",role:"assistant",speaker:"Ozlem Ozucak",speakerId:"p_oz",present:["p_oz"],content:'"Market kapaniyor."'}];
    return {berk:heardQueryLine(c,__P("p_berk")), src:String(playCharacterTurn).indexOf("heardQueryLine(chat,p)")>=0};
  });
  ok("Berker's query is the line he heard, not Burcu's whispered reply or thought", /Hesabi kim odeyecek/.test(r9.berk)
      && !/vardiyasinda|Kalbim|nobette|Market/.test(r9.berk), r9.berk);
  ok("and playCharacterTurn builds the query from it", r9.src===true);

  /* ------------------------------------------------------------------------------------------ */
  console.log("\n[10 — someone already in the room does not walk in]");
  const r10=await pg.evaluate(async()=>{
    const c=__setup();
    c.messages=[{mid:"k1",role:"assistant",speaker:"Sami Ozucak",speakerId:"p_sami",present:["p_sami","p_berk"],content:'"Cay?"'},
                {mid:"k2",role:"user",present:["p_sami","p_berk"],content:'"Olur."'}];
    const n0=c.messages.length;
    startOverture(c,{accuser:__P("p_sami"),intent:"Sami asks Emre for the Friday money in cash",questAsk:true,summary:"Sami seeks out Emre",evidence:0.7});
    await __settle(9000);
    const pay=(__rp().slice(-1)[0]||{}).t||"";
    const notes=c.messages.slice(n0).filter(m=>m.presenceNote&&(m.enteredIds||[]).indexOf("p_sami")>=0).length;
    return {notes, walked:/You have just walked in/.test(pay), why:/WHY & HOW YOU/.test(pay), spoke:c.messages.slice(n0).some(m=>m.speakerId==="p_sami"),
            writer:window.__calls.some(x=>/^Scene writer/.test(x.dbg))};
  });
  ok("no arrival note for someone already here", r10.notes===0, JSON.stringify(r10));
  ok("no entrance instruction", r10.walked===false, JSON.stringify(r10));
  ok("but the why-and-how of the event, and they speak", r10.why===true && r10.spoke===true, JSON.stringify(r10));
  ok("without a Scene Writer bring-in", r10.writer===false, JSON.stringify(r10));

  /* ------------------------------------------------------------------------------------------ */
  console.log("\n[11 — the consent rail ships on every turn; the actions part when a hand is on them]");
  const r11=await pg.evaluate(()=>{
    const c=__setup(); const sami=__P("p_sami"); const H=["p_sami","p_berk"];
    const tail=()=>buildTailBlocks({chat:c,selfP:sami,selfId:"p_sami",selfName:"Sami Ozucak",targetName:"Emre",targetId:"__user__",multi:true,injected:{}});
    c.messages=[
      {mid:"a1",role:"assistant",speaker:"Berker Ozucak",speakerId:"p_berk",present:H,content:'*Defteri aciyor.* "Vardiya listesi hazir."'},
      {mid:"a2",role:"assistant",speaker:"Sami Ozucak",speakerId:"p_sami",present:H,content:'*Omuz silkiyor.* "Iyi."'},
      {mid:"a3",role:"user",present:H,content:'"Pazartesi ben geceye kalirim."'}];
    const t0=tail(); const plain=!!t0.resistance&&!/AN ASK IS NOT ONLY A SENTENCE/.test(String(t0.resistance));
    c.messages.push({mid:"a4",role:"user",present:H,content:'*Elimi Sami\'nin omzuna koyuyorum.* "Yardim et."'});
    const t=tail();
    return {plain,hand:!!t.resistance,actions:/AN ASK IS NOT ONLY A SENTENCE/.test(String(t.resistance||""))};
  });
  ok("v150.13 — a plain statement ships the rail too (the ask gate is gone)", r11.plain===true, JSON.stringify(r11));
  ok("the player's hand on this character does, with the actions part", r11.hand===true && r11.actions===true, JSON.stringify(r11));

  /* ------------------------------------------------------------------------------------------ */
  console.log("\n[12 — the engine's verdict is the player's notice, not narration]");
  ok("the resolution line never reaches a character's transcript", await pg.evaluate(async()=>{
      const c=__setup();
      c.activeEvent={kind:"overture",accuserId:"p_sami",_startMsg:0,resolved:false,participant:{name:"Sami Ozucak",charId:"p_sami",approaching:false}};
      await resolveActiveEvent(c,"Emre agreed to bring the money in cash; Sami's ask was granted.");
      const note=c.messages.find(m=>/ask was granted/.test(m.content||""));
      const h=JSON.stringify(castHistory(c,__P("p_berk")));
      return (note&&note.uiNote&&h.indexOf("ask was granted")<0)?true:JSON.stringify({note,h:h.slice(0,200)}); }));

  /* ------------------------------------------------------------------------------------------ */
  console.log("\n[13 — ties once, not twice]");
  const r13=await pg.evaluate(()=>{
    const c=__setup();
    const B=buildCharPromptBlocks(__P("p_sami"),[__P("p_berk")],{recent:[],diary:[],longterm:[]},null,{chat:c,targetName:"Emre",targetId:"__user__"});
    return String(B.relationships||"");
  });
  ok("the summary sentence about Berker (who gets a paragraph) is gone", r13.indexOf("Berker is my younger brother")<0 && /leans on Berker's stability/.test(r13), r13);
  ok("the sentence about the absent wife stays", /Buket is my wife/.test(r13), r13);
  ok("and so does one about Berker AND someone absent", /Berker and Buket grew up/.test(r13), r13);

  /* ------------------------------------------------------------------------------------------ */
  console.log("\n[14 — the turn router is told what was an aside]");
  const r14=await pg.evaluate(()=>{
    const c=__setup(); const H=["p_sami","p_berk","p_burcu"];
    c.messages=[{mid:"t1",role:"user",present:H,whisperTo:"p_burcu",whisperToName:"Burcu Atan",content:'*Dizine dokunuyorum.* "Gel."'},
                {mid:"t2",role:"assistant",speaker:"Burcu Atan",speakerId:"p_burcu",present:H,whisperTo:"__user__",content:'"Olmaz."'}];
    return {x:castConvoText(c,8,undefined,{markAsides:true}), plainRoom:castConvoText(c,8,"p_sami"),
            src:String(runMultiCharTurn).indexOf("briefDesc(c.interject,300)")>=0 && String(runMultiCharTurn).indexOf("markAsides:true")>=0};
  });
  ok("the player's aside is marked as one", /whispered to Burcu Atan alone/.test(r14.x), r14.x);
  ok("and so is the whisper back", /whispered back to Emre alone/.test(r14.x), r14.x);
  ok("a character's view never gets the whisper back, split or not", r14.plainRoom.indexOf("Olmaz")<0, r14.plainRoom);
  ok("the router asks with asides marked, and hooks kept whole enough", r14.src===true);

  console.log("\n[nothing else moved]");
  ok("no page errors", errs.length===0?true:errs.join(" | "));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close(); process.exit(fail?1:0);
})();
