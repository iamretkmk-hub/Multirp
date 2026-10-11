/* v150.59 — A TEXT EXCHANGE, AS THE ONE ON THE OTHER END READ IT (debug export 2026-10-07 21:25, texting with Duygu).
   Checked with the model and the Decisions API stubbed:
     - the player's texts (present:[]) reach the emotion pick, the relevance judge, the goal check and the memory
       query writer; the first text of a thread gets its emotion pick (the scene used to be empty);
     - the line answered is the newest text; _textMemQuery puts the thread last and cuts from the front;
     - the goal check gets her memories bearing on the goals whole, and the player's lines; x_goal_done judges from
       the scene OR the memories (newest wins), and a stored old default is upgraded;
     - for a text, "who else can see or hear" says they are texting, not together, and who is around the texter;
     - someone the player walks away from who said they were going goes home, not stays at the beach;
     - the text memory writer gets the thread's topic, the lines before and two reading rules; the text arc
       tracker is told the name in front of a line is who typed it;
     - a world memory in another language or the third person is not planted (the quest step's note stands in);
     - the memory query is one clean line (junk script, a second line and repeats dropped), 0.3 unless overridden;
     - a motive toward the player colours the reply the player gets (the fragment ask can inject it);
     - a quotation mark is not followed by the space a stripped delivery tag left.
   Run: node tests/text-witness.browser.js */
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:process.env.SM_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage({viewport:{width:412,height:915}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  const OLD_GOAL_DONE=`One of {{char}}'s goals is: "{{text}}". Judging from the scene in the state, is this goal already done, settled or moot?
YES: The scene shows it happened or was resolved (the thing was done, the call was made, the question was answered, the plan was dropped), or after what happened it no longer makes sense for {{char}} to want it.
NO: It is still open: only talked about, promised, half done or not touched in this scene; or you are unsure.`;
  await pg.addInitScript(t=>{ try{ if(!sessionStorage.getItem("tw_seeded")){ localStorage.setItem("sm_x_goal_done",t); sessionStorage.setItem("tw_seeded","1"); } }catch(e){} },OLD_GOAL_DONE);
  await pg.goto('file://'+require('path').resolve(__dirname,'..','index.html')); await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  // v150.87 — this file checks the one-request bundle (Settings → Decisions → One request per topic OFF); the split is tests/decision-split.browser.js
  await pg.evaluate(()=>{ state.decSplit=false; try{ store.set(K.decSplit,false); }catch(_){} const e=document.getElementById("setDecSplit"); if(e)e.checked=false; });
  await pg.waitForTimeout(800);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x===undefined?c:x).slice(0,900));} };

  ok("a stored copy of the old goal-check default is upgraded on load", await pg.evaluate(()=>{
      const s=String(state.x_goal_done||"");
      return (/the newest one is what is true now/.test(s)&&/memories_bearing_on_goals/.test(s)&&s===X_ENGINE_PROMPTS.x_goal_done.def)?true:s.slice(0,200); }));

  await pg.evaluate(()=>{
    Math.random=()=>0.42;
    window.__dec=[]; window.__sent={}; window.__opts={}; window.__reply={};
    const realFetch=window.fetch;
    window.fetch=async(url,opts)=>{ if(String(url).indexOf("/api/alpha/decisions")>-1){ const body=JSON.parse(opts.body); __dec.push(body);
        return new Response(JSON.stringify({answers:{emotion:{type:"choice",choice:"calm"},intensity:{type:"choice",choice:"mild"}}}),{status:200}); }
      return realFetch(url,opts); };
    window.chatCompletion=async(m,mo,o)=>{ const d=(o&&o.dbg)||"?"; __sent[d]=JSON.stringify(m); __opts[d]=o;
      const k=Object.keys(__reply).find(p=>d.indexOf(p)===0); let r=k?__reply[k]:"{}"; if(typeof r==="function")r=await r(d,m);
      return typeof r==="string"?r:JSON.stringify(r); };
    window.embedText=async()=>null;
    window.__setup=()=>{
      const uni=state.universes[0]; state.curUniverse=uni.id;
      uni.locations=[{id:"l_home",name:"Emre's House",description:"x",residents:[],sublocations:[],type:"home"},
                     {id:"l_beach",name:"Palmera Beach Club",description:"x",residents:[],sublocations:[]},
                     {id:"l_du",name:"Akbaba's House",description:"x",residents:["p_d","p_h"],sublocations:[],type:"home"}];
      uni.gameData={charQuests:[]}; uni.rules=[];
      state.personas=[{id:"p_d",name:"Duygu Akbaba",universeId:uni.id,personality:"Dry.",style:"x",goals:"x",look:{},
          goalsLive:{lines:["Get Emre to actually make that call to Ayça about Asran's school","Keep the beach day light"],day:4}},
        {id:"p_h",name:"Hakan Akbaba",universeId:uni.id,personality:"x",style:"x",goals:"x",look:{}}];
      Object.assign(state,{user:"Emre Tokmak",key:"sk-test",emoOn:true,emoModel:"",emotions:null,gateAt:0.8,goalCheckOn:true,memJudgeOn:true,
        replyCheckOn:false,trackDecOn:false,gateOn:false,mem:true,intentOn:true,calOn:false,promiseOn:false,charQuestsOn:false});
      try{ _emoBreak.until=0; _emoBreak.fails=0; _memJudgeBreak.until=0; _memJudgeBreak.fails=0; }catch(e){}
      const c=curChat();
      Object.assign(c,{universeId:uni.id,presentIds:[],emo:{},gameDay:4,period:"Afternoon",timeOfDay:"Afternoon",locationId:"l_home",location:"Emre's House",
        intents:[],calendar:[],worldPositions:null,dayPlacement:null,_wpKey:null,companionLock:{},leftBehind:null,pulseBusy:null,_textArc:{},
        messages:[
          {mid:"s1",role:"user",content:'"Ayça\'yı aradım bu sabah, okulu konuştuk."',present:["p_d"]},
          {mid:"s2",role:"assistant",speaker:"Duygu Akbaba",speakerId:"p_d",content:'"[speak in a dry, amused tone] [scoff] Hadi ordan, laf cambazı seni."',present:["p_d"]},
          {mid:"tb",role:"assistant",speaker:"Narrator",narratorEvent:true,travelBeat:true,content:"Emre walked home.",present:[]},
          {mid:"t1",role:"user",content:"Selam",textMsg:true,textWith:"p_d",textWithName:"Duygu Akbaba",present:[],gday:4,gperiod:"Afternoon"}]});
      state.memory=[{id:"mm1",ownerId:"p_d",character:"Duygu Akbaba",content:"At the Bamboo Bar I asked Emre Tokmak again whether he had called about Ayça's school, and he snapped at me for repeating the question, saying he had already called her that morning and talked through Asran's school, lunch and sleep with her, and that he did not want to be asked a third time while we were sitting in front of everybody on the beach.",
        type:"EXPERIENCE",importance:0.6,gameDay:4,gamePeriod:"Midday",chatId:c.id,universeId:uni.id,date:Date.now()-5000}];
      __dec=[]; __sent={}; __opts={}; __reply={};
      return c; };
  });

  console.log("\n[the player's text is read by the one it was sent to]");
  const E=await pg.evaluate(async()=>{ const c=__setup(); const p=state.personas[0];
    const pl=await buildTextPayload(c,p);
    const emo=__dec.find(x=>x.questions&&x.questions.ego);
    const judge=__dec.find(x=>x.questions&&x.questions.m0);
    const q=__sent["Memory query generator"]||"";
    return {emo:!!emo,scene:emo&&emo.state.scene,judge:judge&&judge.state,q,line:_newestPlayerText(c,p),
      who:emo&&emo.state.who_else_can_see_or_hear,mem:emo&&emo.state.memories_bearing_on_goals,pl:emo&&emo.state.player_lines,goals:emo&&Object.keys(emo.questions).filter(k=>/^goal_done/.test(k))}; });
  ok("the first text of a thread gets its emotion pick (the scene used to be empty)", E.emo===true, JSON.stringify(E).slice(0,600));
  ok("its scene has the player's text, labelled as a text to her, as the last line", /Emre Tokmak \(text message to Duygu Akbaba\): Selam$/.test(E.scene||""), E.scene);
  ok("and the in-person lines she heard before it come first, without the delivery tag's space", /^Emre Tokmak: .*Ayça'yı aradım[\s\S]*Duygu Akbaba: "Hadi ordan/.test(E.scene||""), E.scene);
  ok("the relevance judge reads the same thread, ending on the text", /Selam$/.test(String(E.judge||"")), JSON.stringify(E.judge));
  ok("the memory query writer sees the player's text and is handed it as the newest message",
     /Emre Tokmak \(text message to Duygu Akbaba\): Selam/.test(E.q) && /newest message:\\nSelam/.test(E.q), E.q.slice(0,700));
  ok("for a text, who can see or hear says they are texting, not together, and who is around her",
     Array.isArray(E.who)&&/texting, not together/.test(E.who[0])&&/Duygu Akbaba is at /.test(E.who[0])&&/Emre Tokmak is at Emre's House/.test(E.who[0]), JSON.stringify(E.who));
  ok("the goal check gets her memory bearing on the goal, whole (over 160 characters, with its day)",
     Array.isArray(E.mem)&&E.mem.some(x=>/^\[day 4, Midday\]/.test(x)&&/already called her that morning/.test(x)&&x.length>300), JSON.stringify(E.mem));
  ok("and the player's lines she took in, the text among them", Array.isArray(E.pl)&&E.pl.some(x=>/text message to Duygu Akbaba\): Selam/.test(x))&&E.pl.some(x=>/Ayça'yı aradım/.test(x)), JSON.stringify(E.pl));
  ok("the goal question reads scene OR memories, newest wins", await pg.evaluate(()=>{ const c=__setup(); const p=state.personas[0];
      const g=goalDoneQuestions(c,p,{char:p.name,user:"Emre Tokmak"}); const q=g.questions.goal_done_G1;
      return (/AND from Duygu Akbaba's own memories/.test(q.instructions)&&/the newest one is what is true now/.test(q.instructions)&&/the call was made/.test(q.criteria.true))?true:JSON.stringify(q); }));

  console.log("\n[a texter reads none of the player's room]");
  const X=await pg.evaluate(async()=>{ const c=__setup(); const uni=state.universes[0];
    state.personas.push({id:"p_b",name:"Burcu Atan",universeId:uni.id,personality:"x",style:"x",goals:"x",look:{}},
                        {id:"p_o",name:"Özlem Özüçak",universeId:uni.id,personality:"x",style:"x",goals:"x",look:{}});
    uni.locations.push({id:"l_bu",name:"Atan's House",description:"x",residents:["p_b"],sublocations:[],type:"home"});
    c.presentIds=["p_o"];
    c.messages=[
      {mid:"r1",role:"assistant",speaker:"Narrator",narratorEvent:true,content:"ROOMNARR Özlem Özüçak bahçe kapısından içeri girip mutfağa geçti."},
      {mid:"r2",role:"assistant",speaker:"Narrator",presenceNote:true,subTo:"kitchen",content:"— ROOMMOVE Emre Tokmak, Özlem Özüçak ile birlikte şuraya geçti: Kitchen —"},
      {mid:"r3",role:"assistant",speaker:"Narrator",narratorEvent:true,present:["p_o"],content:"ROOMTAGGED Özlem yatak odasına geçti."},
      {mid:"r4",role:"assistant",speaker:"Özlem Özüçak",speakerId:"p_o",present:["p_o"],content:'"ROOMLINE Gel buraya."'},
      {mid:"r5",role:"user",content:"Selam Burcu",textMsg:true,textWith:"p_b",present:[]},
      {mid:"r6",role:"assistant",speaker:"Burcu Atan",speakerId:"p_b",content:"Selam. Hayırdır, bi şey mi oldu?",textMsg:true,textWith:"p_b",present:[]},
      {mid:"r7",role:"user",content:"Yok, öyle yazdım",textMsg:true,textWith:"p_b",present:[]}];
    state.memory=[{id:"mb",ownerId:"p_b",character:"Burcu Atan",content:"I made Aslan help me with the laundry.",type:"EXPERIENCE",importance:0.4,gameDay:4,gamePeriod:"Morning",chatId:c.id,universeId:uni.id,date:Date.now()-9000}];
    const p=state.personas.find(x=>x.id==="p_b");
    __dec=[]; __sent={};
    await buildTextPayload(c,p);
    const emo=__dec.find(x=>x.questions&&x.questions.ego)||{state:{}};
    const judge=__dec.find(x=>x.questions&&x.questions.m0);
    const hist=JSON.stringify(castHistory(c,p,{textReply:true}));
    const rex=JSON.stringify(recentExchangeFor(c,p,6));
    return {scene:emo.state.scene||"",who:emo.state.who_else_can_see_or_hear,judge:JSON.stringify(judge&&judge.state||""),
      q:__sent["Memory query generator"]||"",hist,rex,gq:JSON.stringify(_goalDoneEvidence(c,p,["laundry and Aslan"]))}; });
  const room=/ROOM(NARR|MOVE|TAGGED|LINE)/;
  ok("the texter's emotion state has the thread and none of the player's room (narration, move notes, lines)",
     /Selam\. Hayırdır/.test(X.scene)&&/Yok, öyle yazdım$/.test(X.scene)&&!room.test(X.scene), X.scene);
  ok("and does not call it being alone with him", Array.isArray(X.who)&&/texting, not together/.test(X.who[0])&&/at Atan's House/.test(X.who[0])&&!/alone with/.test(X.who.join(" ")), JSON.stringify(X.who));
  ok("nor does the relevance judge, the query writer or the goal check", /Hayırdır/.test(X.judge)&&/Hayırdır/.test(X.q)&&!room.test(X.judge)&&!room.test(X.q)&&!room.test(X.gq), (X.judge+X.q+X.gq).slice(0,600));
  ok("nor the text reply's own history, nor the fast read of her moment", !room.test(X.hist)&&/Hayırdır/.test(X.hist)&&!room.test(X.rex), X.hist.slice(0,600)+" | "+X.rex.slice(0,300));

  console.log("\n[the text memory query]");
  ok("_textMemQuery puts the thread last and cuts from the front", await pg.evaluate(()=>{ const c=__setup(); const p=state.personas[0];
      for(let i=0;i<6;i++)c.messages.push({mid:"x"+i,role:i%2?"assistant":"user",speaker:i%2?p.name:undefined,speakerId:i%2?p.id:undefined,content:"mesaj "+i+" "+"uzun ".repeat(40),textMsg:true,textWith:"p_d",present:[]});
      const q=_textMemQuery(c,p,600), full=_textMemQuery(c,p,99999);
      return (q.length<=601+1&&/mesaj 5/.test(q)&&!/Hadi ordan/.test(q)&&/Hadi ordan[\s\S]*mesaj 5/.test(full))?true:JSON.stringify({q:q.slice(0,200),len:q.length}); }));

  console.log("\n[the memory query writer's answer]");
  const Q=await pg.evaluate(async()=>{ const c=__setup();
    __reply["Memory query generator"]="Emre Tokmak, Duygu Akbaba, Ayça, flirtatious banter, wine next week, Ayça phone call\n天天买彩票\nETwitter\n\nEmre Tokmak, Duygu Akbaba, Ayça, flirtatious banter";
    const out=await genQuery("Selam",c,"p_d",{text:true});
    const t=__opts["Memory query generator"].temp;
    state.fnCfg=Object.assign({},state.fnCfg||{},{mc:{temp:0.7}}); await genQuery("Selam",c,"p_d"); const t2=__opts["Memory query generator"].temp;
    state.fnCfg.mc={temp:null,tok:null};
    __reply["Memory query generator"]="天天买彩票 dinner plans, dinner plans, Hakan";
    const out2=await genQuery("x",c,"p_d");
    return {out,t,t2,out2}; });
  ok("one clean line: the junk lines and the repeated block are gone", Q.out==="Emre Tokmak, Duygu Akbaba, Ayça, flirtatious banter, wine next week, Ayça phone call", JSON.stringify(Q));
  ok("a run of another script inside the line is dropped, and each term is kept once", Q.out2==="dinner plans, Hakan", JSON.stringify(Q));
  ok("temperature 0.3 by default; an explicit override is respected", Q.t===0.3&&Q.t2===0.7, JSON.stringify(Q));

  console.log("\n[left behind, but they said they were going]");
  const L=await pg.evaluate(async()=>{ const c=__setup();
    c.locationId="l_beach"; c.location="Palmera Beach Club"; c.presentIds=["p_d","p_h"];
    c.messages=[{mid:"a1",role:"assistant",speaker:"Duygu Akbaba",speakerId:"p_d",present:["p_d","p_h"],
      content:'*Havlusunu omzuna atıyor.* "Kalkalım tabii. Ben toparlanıp geçiyorum artık, Nil evde tek başına ne yapıyor kim bilir."'},
      {mid:"a2",role:"assistant",speaker:"Hakan Akbaba",speakerId:"p_h",present:["p_d","p_h"],content:'"Ben biraz daha denize bakacağım."'}];
    state.mem=false;
    await travelTo("l_home",[]);
    const lb=c.leftBehind||{};
    const r={du:c.worldPositions.p_d,ha:c.worldPositions.p_h,lbDu:lb.p_d&&lb.p_d.locId,lbHa:lb.p_h&&lb.p_h.locId};
    resolveWorldPositions(c); r.read=c.worldPositions.p_d;
    c.period="Evening"; c.timeOfDay="Evening"; resolveWorldPositions(c); r.next=c.worldPositions.p_d; c.period="Afternoon";
    return r; });
  ok("she said she was going home: she is placed at home, not at the beach", L.du==="l_du"&&L.lbDu==="l_du"&&L.read==="l_du", JSON.stringify(L));
  ok("he said nothing of the kind: left where he was", L.ha==="l_beach"&&L.lbHa==="l_beach", JSON.stringify(L));

  console.log("\n[the text memory writer and the arc tracker]");
  const W=await pg.evaluate(async()=>{ const c=__setup(); const p=state.personas[0];
    c.messages=c.messages.filter(m=>m.textMsg);
    const T=(role,content,i)=>({mid:"w"+i,role,speaker:role==="assistant"?p.name:undefined,speakerId:role==="assistant"?p.id:undefined,content,textMsg:true,textWith:"p_d",present:[],gday:4,gperiod:"Afternoon"});
    c.messages=[T("user","Selam",0),T("assistant","Selam? Hayırdır?",1),T("user","Özledim",2),
      T("assistant","Lafı dolandıracağına Ayça'yı aradın mı sen onu söyle asıl.",3),T("user","Bu soruyu 3. kez soruyorsun, 3. kez aradığımı söylüyorum.",4),
      T("assistant","İyi madem, aradıysan mesele kalmadı.",5)];
    c._textArc={p_d:{start:3,summary:"Duygu asks Emre whether he called Ayça"}};
    __reply["Memory arc tracker (text)"]={progress:"finished",topic:"same",summary:"Duygu asks Emre whether he called Ayça; he says he did"};
    __reply["Memory (text)"]={content:"Emre told me by text that he had called Ayça, the third time I asked.",people:["Emre Tokmak","Ayça"],emotion:"tense",importance_score:0.5,tags:["texting"],type:"RELATIONSHIP"};
    await rememberTextExchange(c,p);
    return {arc:__sent["Memory arc tracker (text) · Duygu Akbaba"]||"",mem:__sent["Memory (text) · Duygu Akbaba"]||"",
      kept:state.memory.filter(m=>m.source==="text").map(m=>m.people)}; });
  ok("the arc tracker is told the name in front of a line is who typed it", /WHO SAID IT: every line begins with the name of the person who typed it \(Emre Tokmak or Duygu Akbaba\)/.test(W.arc), W.arc.slice(0,300));
  ok("the writer gets the thread's topic and the lines before the stretch",
     /WHAT THIS STRETCH OF THE THREAD IS ABOUT \(the tracker's note\): Duygu asks Emre whether he called Ayça; he says he did/.test(W.mem)
     &&/EARLIER IN THE THREAD[\s\S]*Duygu Akbaba: Selam\? Hayırdır\?[\s\S]*THE STRETCH TO REMEMBER:\\nDuygu Akbaba: Lafı dolandıracağına/.test(W.mem), W.mem.slice(-900));
  ok("and the reading rules: a condition is not a statement, people includes whoever the messages are about",
     /a condition \(\\"if you called\\"\) is not a statement/.test(W.mem)&&/everyone the messages are about/.test(W.mem), W.mem.slice(0,200));
  ok("the memory keeps Ayça among its people", W.kept.length===1&&W.kept[0].includes("Ayça"), JSON.stringify(W.kept));

  console.log("\n[a world memory is English and first person]");
  const M=await pg.evaluate(async()=>{ const c=__setup(); const uni=state.universes[0]; const p=state.personas[0];
    const a=_plantWorldMemory(c,uni,p,{content:"Duygu, Nil evde kulaklığıyla kapalıyken telefonu eline aldı ve Özlem'i aradı; perşembe akşamını kararlaştırdılar.",emotion:"content"},4,"Palmera Beach Club",[],"Afternoon");
    const b=_plantWorldMemory(c,uni,p,{content:"Duygu Akbaba called Özlem and settled on Thursday evening.",emotion:"content"},4,"",[],"Afternoon");
    const ok1=_plantWorldMemory(c,uni,p,{content:"I called Özlem and we settled on Thursday evening.",emotion:"content"},4,"",[],"Afternoon");
    state.charQuestsOn=true; c.presentIds=[];
    uni.gameData.charQuests=[{id:"cq1",holderId:"p_d",holderName:"Duygu Akbaba",targetId:"p_h",targetName:"Hakan Akbaba",title:"Get Hakan to the table",desc:"x",motive:"x",status:"active",createdDay:4,progress:[]}];
    __reply["Char quest (step)"]={moved:true,headline:"Duygu aradı",event:"Duygu, Hakan'ı aradı ve masayı konuştular.",note:"Duygu phoned Hakan and got him to agree to the dinner table.",outcome:"progress",
      memories:[{name:"Duygu Akbaba",content:"Duygu, Hakan'ı aradı ve perşembe akşamı masaya oturmasını istedi; Hakan kabul etti ama sesi isteksizdi.",emotion:"content",importance:0.5}],rel:[]};
    const sent0=Object.keys(__sent).length;
    await runCharQuestPursuit(c,4,uni,"Afternoon");
    const step=__sent["Char quest (step) · Duygu Akbaba"]||"";
    return {a:!!a,b:!!b,ok1:!!ok1,mems:state.memory.filter(m=>m.ownerId==="p_d"&&m.source==="world_pulse").map(m=>m.content),rule:/MEMORIES: each \\"memories\\" content is that person's OWN memory/.test(step)}; });
  ok("another language is not planted", M.a===false, JSON.stringify(M));
  ok("the third person about its owner is not planted; the first person is", M.b===false&&M.ok1===true, JSON.stringify(M));
  ok("a quest step's memory that retells the event in the story language gives way to its English note",
     M.mems.some(x=>/^I phoned Hakan and got him to agree/.test(x))&&!M.mems.some(x=>/Hakan.ı aradı/.test(x)), JSON.stringify(M.mems));
  ok("and the step is told memories are English, first person", M.rule===true, "");

  console.log("\n[a motive toward the player]");
  const I=await pg.evaluate(()=>{ const c=__setup();
    c.intents=[{id:"i1",holderId:"p_d",targetId:"__user__",targetName:"Emre Tokmak",status:"active",valence:"warm",kind:"alliance",aim:"to have him come to your table next week"}];
    const a=intentParts(c,"p_d","__user__","Emre Tokmak");
    const B=buildTailBlocks({chat:c,selfP:state.personas[0],selfId:"p_d",selfName:"Duygu Akbaba",targetName:"Emre Tokmak",targetId:"__user__",injected:{recent:[],diary:[],longterm:[]}});
    const bio=intentParts(c,"p_d");
    return {col:a.coloring,key:a.coloringKey,pi:B._pi&&B._pi.intent_warm,bioWant:bio.quietWant}; });
  ok("toward the one they answer, the player, it becomes this beat's colouring (intent_warm)", I.key==="intent_warm"&&/to have him come to your table next week/.test(I.col)&&/Emre Tokmak/.test(I.col), JSON.stringify(I));
  ok("so the fragment ask's {{call//intent_warm}} has something to inject", /to have him come to your table/.test(I.pi||""), JSON.stringify(I));
  ok("the standing aim still rides in the bio (its call names no addressee)", /to have him come to your table/.test(I.bioWant||""), JSON.stringify(I));
  // (v150.66 — "with the fragment model off, nothing changes" is gone with the switch: the fragments are the only reply builder)

  console.log("\n[a stripped delivery tag leaves no space inside the quote]");
  ok("stripDeliveryTags trims inside the quotation marks", await pg.evaluate(()=>{
      const a=stripDeliveryTags('*Gözlerimi deviriyorum.* "[speak in a dry, amused tone] [scoff] Hadi ordan, laf cambazı seni. [reset]"');
      const b=stripDeliveryTags('"Tamam" dedi, sonra "[sigh] peki" diye ekledi.');
      const c=stripDeliveryTags('end of it" and then "start');
      const d=_cleanTextReply('"[say softly] Hadi ordan, git hadi."',"Duygu Akbaba");
      return (a==='*Gözlerimi deviriyorum.* "Hadi ordan, laf cambazı seni."'&&b==='"Tamam" dedi, sonra "peki" diye ekledi.'&&c==='end of it" and then "start'&&d==="Hadi ordan, git hadi.")?true:JSON.stringify({a,b,c,d}); }));

  ok("no page errors", errs.length===0?true:errs.join(" | "));
  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close(); process.exit(fail?1:0);
})();
