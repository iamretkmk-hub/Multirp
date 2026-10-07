/* v146.1 — QC report #2 (v145) §1 High #5/#6 and §4.4 Quests and Gamemaster, plus the undiscovered-
   character visibility rule. Model stubbed throughout.
     - an in-person quest ask fires with confrontations OFF; the GM staging line is truthful;
     - Heat on does not make a one-on-one scene private: only heat lines that read as intimate (or a clip
       over this story) do; the burst flag is per chat;
     - the private-moment detector: ≥90% on 70+ explicit and 60+ ordinary EN/TR lines, ALL CAPS included;
     - lapse: asks the player took up never lapse, progress resets the clock, no blame memory; spawns
       stop while the offstage backlog is long; task pursuits through a character lapse too; a 24-day run
       lapses nothing that was never attempted;
     - arc retry is bounded and ignores legacy arcs; End this arc; deleting the live quest asks first;
       a retry-born quest is not judged the same day;
     - a spawn during a prune survives; no false "couldn't write" toast; a dropped GM beat gives its
       window back, deleting messages does not fire the GM; "Can you…" is not Can; the quest editor
       never leaves two live quests;
     - undiscovered characters: in the character list's collapsed Undiscovered group (reveal / delete),
       in none of the pickers.
   Run: node tests/qc2-quests.browser.js */
const {chromium}=require('playwright');
const FIX={
intimate:[
 "She pulled him closer and kissed him hard.","His hand slid under her shirt.","They had sex on the couch.","I unbutton her blouse slowly.",
 "She unzipped his jeans.","He cupped her breast.","Her lips found his neck.","She climaxed with a cry.","He came inside her.",
 "She's wet for you.","He licked a slow line down her stomach.","She wrapped her legs around his waist.","We fucked until dawn.",
 "Take off your clothes.","She was topless on the bed.","His cock pressed against her.","She sucked his fingers.","He pinned her to the bed and she moaned.",
 "Into bed with him she went.","In bed together, they whispered.","She slipped out of her dress.","He pulled her panties aside.",
 "Their tongues tangled.","She rode him slowly.","I want you inside me.","She straddled his lap.",
 "Onu dudaklarından öptü.","Gömleğinin düğmelerini tek tek açtı.","Elbisesini yavaşça çıkardı.","Sevişmeye başladılar.","Boynunu yaladı.",
 "Beni sikti.","Sikini okşadı.","Memesini avuçladı.","Göğsüne dokundu.","Çırılçıplak yatakta yatıyordu.","Bacaklarını beline doladı.",
 "Soyun.","Kulağına inledi.","Dudaklarını emdi.","Onu yatağa yatırdı ve üstüne çıktı.","Tenine dokunan eller titriyordu.","Seks yaptılar.",
 "İçime gir.","Kalçalarını okşadı.","Dilini ağzına soktu.","Sutyenini çıkardı.","Ateşli bir şekilde öpüştüler.","Onu soyarken gözlerine baktı.",
 "I kiss her neck and she shivers.","He slid her dress off her shoulders.","We made love by the fire.","She moaned his name.",
 "His hands roamed over her naked body.","She tossed her bra aside.","He thrust into her.","Making out in the back seat, they lost track of time.",
 "She climbed on top of him.","INTO BED WITH HER, NOW.","KISSING HER NECK SLOWLY","I trail kisses down her stomach.","He stood there naked.",
 "Onunla yattı.","Boynunu öperek aşağı indi.","Tutkuyla öpüştüler.","Üstündekileri çıkarıp yatağa girdi.","Külotunu indirdi.",
 "Orgazm oldu.","Kalçasını sıktı ve onu kendine çekti.","Göğüslerini avuçladı.","SEVİŞTİLER.","İÇİME GİR."
],
ordinary:[
 "Amcam geldi, çay koyalım.","Çantayı eve götürdüm.","Depoyu boşalttı.","Zevkli bir yemekti.","He mixed a cocktail.","She was grinding coffee.",
 "He was stripped of his rank.","The climax of the play was dull.","He's in bed with fever.","Büyüklerin elini öptük, bayram geldi.","Kediyi okşadı.",
 "Acıyla inledi, bacağı kırılmıştı.","He moaned about the weather all day.","Chicken breasts for dinner tonight.","With the naked eye you can't see it.",
 "Amına koyayım, yine mi geç kaldın!","Fuck him, he lied to us.","Fuck me, it's cold out here.","She kissed her grandmother goodbye.",
 "Ağlayan çocuğun saçını okşadı.","Nude lipstick suits you.","Siktir git buradan!","Sikerim böyle işi.","The bare truth is ugly.",
 "Meme kanseri taraması yaptırdı.","Bebek memeyi bıraktı.","Annesini yanağından öptü.","Sevgilisinden ayrıldı.","He took her to bed—she was feverish.",
 "Ignore the naked walls.","Kiss the ring, soldier.","The masseuse caressed the knot out.","Salon boşaldı.","Yatağı topladı.",
 "They shared a quick kiss at the station.","Ten tene temas bulaşıcıdır, dikkat.",
 "The rooster's cock-a-doodle woke us.","He kissed the baby's forehead.","Kiss my ass, Berk!","I'm in bed already, call me tomorrow.",
 "Take off your shoes at the door.","She unzipped her bag and took out the keys.","He unbuttoned his coat against the heat.","Seksen yaşında bir adam.",
 "Babaannemin elini öptüm.","Canımı sikti bu iş.","Kızını alnından öptü.","Ayağı çıplak yürüyordu.","Çıplak gözle görülmüyor.",
 "Göğsü sıkıştı, nefes alamadı.","Yatağa uzandı ve uyudu.","Adam acı içinde inliyordu.","He licked his lips nervously.","She rode her bike home.",
 "The singer moaned into the mic.","He pinned the map to the wall.","Her breath caught when she saw the price.","IN THE MORNING I WENT TO THE BANK.",
 "Yanağına bir öpücük kondurdu.","ÇIPLAK ayaklarla yürüdü.","Fuck this, I'm leaving."
]};
(async()=>{
  const b=await chromium.launch({executablePath:process.env.SM_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage();
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file://'+require('path').resolve(__dirname,'..','index.html'));
  await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(600);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x||c).slice(0,900));} };

  const setup=()=>pg.evaluate(()=>{
    window.__calls=[]; window.__payloads=[]; window.__reply=()=>"{}";
    window.chatCompletion=async(m,mo,o)=>{ const d=(o&&o.dbg)||"?"; window.__calls.push(d); window.__payloads.push({d,m:JSON.stringify(m)});
      return window.__reply(d,JSON.stringify(m)); };
    const uni=state.universes[0]; state.curUniverse=uni.id;
    uni.gameData={quests:[],charQuests:[],arcMeta:{}}; uni.cqAsked={}; uni.cqLastSpawn=null; uni.originDoc="Day zero.";
    uni.locations=[{id:"l_home",name:"Home",description:"x",residents:["p_a","p_h"],sublocations:[]},{id:"l_far",name:"Far",description:"x",residents:[],sublocations:[]}];
    const mk=(id,n,extra)=>Object.assign({id,name:n,universeId:uni.id,personality:"x",instructions:"x",goals:"g",look:{}},extra||{});
    state.personas=[mk("p_a","Ayla"),mk("p_b","Berk"),mk("p_c","Canan"),mk("p_can","Can"),mk("p_h","Gizli Hüma",{latent:true,boundLocId:"l_home"})];
    state.user="Emre"; state.key="k"; state.charQuestsOn=true; state.heatOn=false; state.gmOn=true; state.sceneOn=true; state.confrontOn=true;
    const c=curChat(); c.universeId=uni.id; c.gameDay=5; c.period="Morning"; c.timeOfDay="Morning";
    c.locationId="l_home"; c.location="Home"; c.presentIds=[]; c.intents=[]; c.messages=[]; c.activeEvent=null; c.dnd=false; c._cqApproachDay=null;
    delete c.sceneDockId; delete c._heatBusy;
    state.memory=[];
    window.uiConfirm=async()=>true;
    return true;
  });

  /* ===== High #5 — in-person asks with confrontations off ===== */
  console.log("\n[an in-person quest ask does not need confrontations]");
  await setup();
  const A=await pg.evaluate(()=>{
    const uni=state.universes[0], c=curChat(); c.presentIds=["p_a"];
    uni.gameData.charQuests=[{id:"a1",holderId:"p_a",holderName:"Ayla",targetId:"__user__",targetName:"Emre",title:"Help me",desc:"d",ask:"help",
      status:"active",createdDay:1,approach:"in_person",gate:{type:"any"},progress:[],nudges:0,delivered:false,awaitingUser:false}];
    state.confrontOn=false;
    const fired=checkCharQuestApproach(c), ev=c.activeEvent&&c.activeEvent.kind;
    c.activeEvent=null;
    // a confrontation-born overture still obeys the confront toggle
    const plain=startOverture(c,{accuser:state.personas[1],intent:"x"}); c.activeEvent=null;
    // staging: a closed gate is announced only for a holder who could actually come
    const q=uni.gameData.charQuests[0]; q.awaitingUser=false; q.nudges=0; q.lastNudgeDay=null; q.gate={type:"user_alone"};
    c.presentIds=["p_b"]; c._cqApproachDay=null;
    const stageOn=charQuestStagingSummary(c);
    c._cqApproachDay=c.gameDay; const stageSpent=charQuestStagingSummary(c); c._cqApproachDay=null;
    state.personas[0].latent=true; const stageHidden=charQuestStagingSummary(c); state.personas[0].latent=false;
    state.sceneOn=false; const stageNoScene=charQuestStagingSummary(c); state.sceneOn=true;
    state.confrontOn=true;
    return {fired,ev,plain,stageOn:!!stageOn,stageSpent,stageHidden,stageNoScene};
  });
  ok("with confrontations off, the ask fires as an overture", A.fired===true&&A.ev==="overture", JSON.stringify(A));
  ok("an overture from the confrontation path still respects the confront toggle", A.plain===false, JSON.stringify(A));
  ok("the GM hears about a waiting approach only while someone can come (not spent / hidden / scenes off)",
     A.stageOn&&A.stageSpent===""&&A.stageHidden===""&&A.stageNoScene==="", JSON.stringify(A));

  /* ===== High #6 — heat ===== */
  console.log("\n[Heat on does not lock a one-on-one scene]");
  await setup();
  const H=await pg.evaluate(()=>{
    const c=curChat(); c.presentIds=["p_a"]; state.heatOn=true;
    const s=(r,t,x)=>Object.assign({mid:"m"+Math.random(),role:r,content:t,present:["p_a"]},r==="user"?{}:{speaker:"Ayla",speakerId:"p_a"},x||{});
    c.messages=[s("user","Let's check the ledger."),s("assistant","Page two is missing.",{heatBeat:true}),s("assistant","Someone tore it out.",{heatBeat:true}),s("assistant","Look at the binding.",{heatBeat:true})];
    c._heatBeat={total:"3",n:"1",narrN:"1"};           // a beat in flight is not a heat scene by itself
    const ledger=sceneIsPrivateMoment(c); delete c._heatBeat;
    c.messages.push(s("assistant","She pulls him onto the bed, gasping.",{heatBeat:true}));
    const hot=sceneIsPrivateMoment(c);
    c.messages=[s("user","Let's check the ledger."),s("assistant","Fine.")];
    c.sceneDockId="sc1"; const realDock=_sceneDock; _sceneDock={chatId:c.id};
    const dock=sceneIsPrivateMoment(c); _sceneDock=realDock; delete c.sceneDockId;
    // the burst flag belongs to one chat
    const A={id:"ca",messages:[]}, B={id:"cb",messages:[]}; A._heatBusy=true;
    const other=heatBeginTurn(B), same=heatBeginTurn(A);
    state.heatOn=false;
    return {ledger,hot,dock,other,same};
  });
  ok("heat beats about a ledger (and a beat in flight) are not a private moment", H.ledger===false, JSON.stringify(H));
  ok("heat lines that read as intimate are", H.hot===true, JSON.stringify(H));
  ok("a clip playing over this story (an explicit heat scene) is", H.dock===true, JSON.stringify(H));
  ok("a burst running in one chat does not block heat in another", H.other===true&&H.same===false, JSON.stringify(H));

  /* ===== §4.4 private-moment detector ===== */
  console.log("\n[the private-moment detector]");
  await setup();
  const D=await pg.evaluate(F=>{
    const c=curChat(); c.presentIds=[];
    const test=t=>{ c.messages=[{mid:"x",role:"user",content:t}]; return sceneIsPrivateMoment(c); };
    const miss=F.intimate.filter(t=>!test(t)), fp=F.ordinary.filter(t=>test(t));
    const scene=a=>{ c.messages=a.map((t,i)=>({mid:"s"+i,role:i%2?"assistant":"user",content:t,speaker:i%2?"Ayla":undefined})); return sceneIsPrivateMoment(c); };
    return {ni:F.intimate.length,no:F.ordinary.length,miss,fp,
      fight:scene(["Amına koyayım, yine mi yalan söyledin?","Siktir git, seni görmek istemiyorum!","Bağırma bana!","Kapıyı çarpıp çıktı."]),
      family:scene(["Grandma hugged me at the door.","I kissed her cheek and set the pie down.","\"You look thin,\" she said.","We sat down to dinner."]),
      bedroom:scene(["We stumble into the bedroom.","His shirt hits the floor; I trace the scar on his chest.","She pushes me back and climbs on top of me.","Slowly, she starts to move."])};
  },FIX);
  ok(`explicit lines caught: ${D.ni-D.miss.length}/${D.ni} (≥90%)`, D.ni>=60&&(D.ni-D.miss.length)/D.ni>=0.9, JSON.stringify(D.miss));
  ok(`ordinary lines left alone: ${D.no-D.fp.length}/${D.no} (≥90%)`, D.no>=60&&(D.no-D.fp.length)/D.no>=0.9, JSON.stringify(D.fp));
  ok("English is not lowercased the Turkish way (\"Into bed…\", ALL CAPS match)", !D.miss.some(t=>/INTO BED|KISSING|Into bed|In bed/.test(t)), JSON.stringify(D.miss));
  ok("a Turkish shouting match and a family visit are not private; a bedroom scene is", D.fight===false&&D.family===false&&D.bedroom===true, JSON.stringify(D));

  /* ===== §4.4 lapse ===== */
  console.log("\n[lapse closes only what is dead]");
  await setup();
  const L=await pg.evaluate(async()=>{
    const uni=state.universes[0], c=curChat(); const r={};
    const ask=(id,extra)=>Object.assign({id,holderId:"p_a",holderName:"Ayla",targetId:"__user__",targetName:"Emre",title:"Ask "+id,status:"active",createdDay:1,delivered:true,nudges:3,lastNudgeDay:1,progress:[]},extra);
    const acc=ask("acc",{awaitingUser:false,progress:[{day:2,text:"Emre agreed and started asking around."}]});
    const wait=ask("wait",{awaitingUser:true,progress:[{day:12,text:"Emre hinted he might help."}]});
    uni.gameData.charQuests=[acc,wait];
    _cqLapseAndPrune(c,uni,14); r.accAt14=acc.status; r.waitAt14=wait.status;
    state.memory=[]; _cqLapseAndPrune(c,uni,16); r.waitAt16=wait.status+(wait.lapsed?"/lapsed":"");
    _cqLapseAndPrune(c,uni,30); r.accAt30=acc.status;
    const mem=state.memory.find(m=>m.ownerId==="p_a"&&/Ask wait/.test(m.content))||{};
    r.mem={emotion:mem.emotion,content:mem.content}; r.result=wait.result;
    // char→char: an unattempted pursuit is not its own fault; a task through a character lapses too
    const cc=(id,extra)=>Object.assign({id,holderId:"p_b",holderName:"Berk",targetId:"p_c",targetName:"Canan",title:"C "+id,status:"active",createdDay:1,progress:[]},extra);
    const starved=cc("st"), taskC=cc("tk",{source:"task",stalls:5}), taskSolo=cc("tn",{source:"task",targetId:null,targetName:"",stalls:5}), quiet=cc("qu",{stalls:1,lastStepDay:8});
    uni.gameData.charQuests=[starved,taskC,taskSolo,quiet];
    _cqLapseAndPrune(c,uni,9); r.starved9=starved.status; r.quiet9=quiet.status; r.taskC=taskC.status; r.taskSolo=taskSolo.status;
    _cqLapseAndPrune(c,uni,13); r.starved13=starved.status;
    // spawn: no new pursuit while the offstage backlog is long
    uni.gameData.charQuests=Array.from({length:CQ_STEP_PER_RUN*3+1},(_,i)=>cc("b"+i));
    state.memory=[{id:"s",ownerId:"p_a",content:"x",gameDay:6,gamePeriod:"Morning",importance:0.8,universeId:uni.id}];
    window.__calls=[]; window.__reply=d=>/spawn/.test(d)?JSON.stringify({quest:{title:"Open a bakery",target:"",desc:"d"}}):"{}";
    r.born=await runCharQuestSpawn(c,6,uni,{period:"Morning"}); r.spawnCalls=window.__calls.filter(d=>/spawn/.test(d)).length;
    r.spawnWhy=(uni.cqLastSpawn||{}).reason||"";
    return r;
  });
  ok("an ask the player took up never lapses, however long", L.accAt14==="active"&&L.accAt30==="active", JSON.stringify(L));
  ok("a waiting ask's clock restarts at its last progress note", L.waitAt14==="active"&&L.waitAt16==="failed/lapsed", JSON.stringify(L));
  ok("a lapse leaves no blame: no \"unanswered\", no frustration", L.mem.emotion==="resigned"&&!/unanswered/i.test(L.mem.content+L.result), JSON.stringify(L));
  ok("an unattempted pursuit waits (lapses only after 12 days); one quiet week with one attempt does not lapse",
     L.starved9==="active"&&L.quiet9==="active"&&L.starved13==="failed", JSON.stringify(L));
  ok("a task pursued through a character lapses on stalls; a task with no one on the other end is left to the judge",
     L.taskC==="failed"&&L.taskSolo==="active", JSON.stringify(L));
  ok("no spawn call while more than CQ_STEP_PER_RUN×3 offstage pursuits are open", L.born===0&&L.spawnCalls===0&&/offstage/.test(L.spawnWhy), JSON.stringify(L));
  const SIM=await pg.evaluate(async()=>{
    let seed=7; const rnd=()=>{ seed=(seed*16807)%2147483647; return seed/2147483647; };
    const uni=state.universes[0], c=curChat();
    uni.gameData.charQuests=[]; uni.cqAsked={};
    const names=["Ayla","Berk","Canan","Deniz","Ece","Fatih","Gül","Hakan"];
    state.personas=names.map((n,i)=>({id:"s"+i,name:n,universeId:uni.id,personality:"x",instructions:"x",goals:"wants things",look:{}}));
    window.__reply=d=>{
      if(/spawn/.test(d)){ let t=names[Math.floor(rnd()*names.length)]; if(d.includes(t))t=names[(names.indexOf(t)+1)%names.length]; return JSON.stringify({quest:{title:"Quest "+Math.floor(rnd()*1e6),target:t,desc:"d",done_when:"x"}}); }
      if(/step/.test(d))return JSON.stringify(rnd()<0.35?{moved:true,headline:"h",event:"e",note:"n"}:{moved:false});
      return "{}"; };
    let maxLive=0;
    for(let day=1;day<=24;day++){
      state.memory=state.personas.map((p,i)=>({id:"m"+day+i,ownerId:p.id,content:"x",gameDay:day,gamePeriod:"Evening",importance:0.5,universeId:uni.id}));
      c.gameDay=day;
      await runCharQuestPursuit(c,day,uni,"Evening");
      await runCharQuestSpawn(c,day,uni,{period:"Evening"});
      maxLive=Math.max(maxLive,_cqActive(uni).length);
    }
    const all=uni.gameData.charQuests, lapsed=all.filter(q=>q.lapsed);
    return {total:all.length,maxLive,lapsed:lapsed.length,neverTried:lapsed.filter(q=>q.lastStepDay==null).length};
  });
  ok("24-day run: the backlog stays bounded and nothing lapses without ever being attempted",
     SIM.maxLive<=CQ_CAP_FOR_TEST(SIM)&&SIM.neverTried===0&&SIM.total>0, JSON.stringify(SIM));
  function CQ_CAP_FOR_TEST(){ return 2*3+1+2; }   // backlog cap (6) + one over it + one stretch of spawns

  /* ===== §4.4 arc retry ===== */
  console.log("\n[the arc retry is bounded]");
  await setup();
  const R=await pg.evaluate(async()=>{
    const uni=state.universes[0], c=curChat(); const r={};
    uni.gameData.arcMeta={"Dead End":{brief:"b",premise:"p",complete:false}};
    uni.gameData.quests=[{id:"q1",arc:"Dead End",seq:0,title:"Old",done:true,startActive:true,progress:[]}];
    window.__reply=d=>/^Quest next/.test(d)?"I cannot continue this.":"[]";
    r.perDay=[];
    for(let d=5;d<=10;d++){ window.__calls=[]; await reconcileQuestsForDay(c,d,uni); r.perDay.push(window.__calls.filter(x=>/^Quest next/.test(x)).length); }
    r.retries=uni.gameData.arcMeta["Dead End"].retries;
    // legacy arc (no arcMeta) is not revived
    uni.gameData.arcMeta={};
    uni.gameData.quests=[{id:"l1",arc:"Old Story",seq:0,title:"One",done:true,startActive:true,progress:[]}];
    window.__calls=[]; window.__reply=d=>/^Quest next/.test(d)?JSON.stringify({quest:{name:"Revived",desc:"x"}}):"[]";
    await reconcileQuestsForDay(c,5,uni); r.legacyCalls=window.__calls.filter(x=>/^Quest next/.test(x)).length;
    // a retry-born quest is not judged on the day it was born
    uni.gameData.arcMeta={"Arc":{brief:"b",premise:"p",complete:false}};
    uni.gameData.quests=[{id:"q0",arc:"Arc",seq:0,title:"Old",done:true,startActive:true,progress:[]}];
    c.messages=[{mid:"u",role:"user",content:"I searched the harbor.",status:{day:5}}];
    window.__calls=[];
    window.__reply=(d,m)=>{ if(/^Quest next/.test(d))return JSON.stringify({quest:{name:"New step",desc:"Search the harbor"}});
      if(d==="Quest reconcile"){ const ids=[...m.matchAll(/#(q_[a-z0-9]+)/g)].map(x=>x[1]); return JSON.stringify(ids.map(id=>({id,done:true,result:"Found it."}))); } return "[]"; };
    await reconcileQuestsForDay(c,5,uni);
    const born=uni.gameData.quests.find(q=>q.title==="New step")||{};
    r.born={done:!!born.done,createdDay:born.createdDay}; r.judged=window.__calls.includes("Quest reconcile");
    return r;
  });
  ok("a model that will not continue an arc is asked at most 3 times, not daily for ever", JSON.stringify(R.perDay)==="[1,1,1,0,0,0]"&&R.retries===3, JSON.stringify(R));
  ok("a legacy arc (no arcMeta) is not revived", R.legacyCalls===0, JSON.stringify(R));
  ok("a retry-born quest carries its birth day and is not judged that same day", R.born.done===false&&R.born.createdDay===5&&R.judged===false, JSON.stringify(R));
  await setup();
  const E=await pg.evaluate(async()=>{
    const uni=state.universes[0], c=curChat(); const r={};
    uni.gameData.arcMeta={"Arc":{brief:"b",premise:"p",complete:false}};
    uni.gameData.quests=[{id:"q0",arc:"Arc",seq:0,title:"Done one",done:true,startActive:true,progress:[]},{id:"q1",arc:"Arc",seq:1,title:"Live one",done:false,startActive:true,progress:[]}];
    openQuestsModal();
    r.button=[...document.querySelectorAll('#questsModal button')].some(x=>/End this arc/.test(x.textContent));
    await questEndArcUI(0);
    r.meta=uni.gameData.arcMeta.Arc; r.live=uni.gameData.quests.filter(q=>!q.done).length; r.q1=!!uni.gameData.quests[1].abandoned;
    window.__calls=[]; await reconcileQuestsForDay(c,6,uni); r.callsAfter=window.__calls.filter(x=>/^Quest next/.test(x)).length;
    try{ _closeQuestsModal(); }catch(e){}
    // deleting the live quest asks first
    uni.gameData.arcMeta={"Arc":{brief:"b",premise:"p",complete:false}};
    uni.gameData.quests=[{id:"q0",arc:"Arc",seq:0,title:"Done one",done:true,startActive:true,progress:[]},{id:"q1",arc:"Arc",seq:1,title:"Live one",done:false,startActive:true,progress:[]}];
    const realChoose=window.uiChoose; let asked=0; window.uiChoose=async()=>{ asked++; return "end"; };
    window.__calls=[]; await questDeleteUI("q1");
    r.del={asked,calls:window.__calls.filter(x=>/^Quest next/.test(x)).length,complete:!!uni.gameData.arcMeta.Arc.complete};
    uni.gameData.arcMeta={"Arc":{brief:"b",premise:"p",complete:false}};
    uni.gameData.quests.push({id:"q2",arc:"Arc",seq:2,title:"Live two",done:false,startActive:true,progress:[]});
    window.uiChoose=async()=>"next"; window.__reply=d=>/^Quest next/.test(d)?JSON.stringify({quest:{name:"Next",desc:"x"}}):"[]";
    window.__calls=[]; await questDeleteUI("q2"); r.delNext=window.__calls.filter(x=>/^Quest next/.test(x)).length;
    window.uiChoose=realChoose; try{ _closeQuestsModal(); }catch(e){}
    return r;
  });
  ok("the Quests screen has an End this arc action", E.button===true, JSON.stringify(E));
  ok("ending an arc closes its quests as abandoned, and nothing more is written for it",
     E.meta.complete===true&&E.meta.endedByPlayer===true&&E.live===0&&E.q1&&E.callsAfter===0, JSON.stringify(E));
  ok("deleting the live quest asks: \"end\" stops the arc with no design call; \"write\" designs",
     E.del.asked===1&&E.del.calls===0&&E.del.complete&&E.delNext===1, JSON.stringify(E));

  /* ===== §4.4 lows ===== */
  console.log("\n[the small ones]");
  await setup();
  const S=await pg.evaluate(async()=>{
    const uni=state.universes[0], c=curChat(); const r={};
    // a spawn in flight while a pursuit prunes
    const closed=[]; for(let i=0;i<31;i++)closed.push({id:"x"+i,holderId:"p_b",holderName:"Berk",targetId:"p_c",targetName:"Canan",title:"old "+i,status:"done",completedDay:i,progress:[]});
    uni.gameData.charQuests=closed;
    state.memory=[{id:"s",ownerId:"p_a",content:"x",gameDay:6,gamePeriod:"Morning",importance:0.8,universeId:uni.id}];
    window.__reply=async d=>{ if(/spawn/.test(d)){ await new Promise(r=>setTimeout(r,200)); return JSON.stringify({quest:{title:"Open a bakery",target:"",desc:"d"}}); } return "{}"; };
    const sp=runCharQuestSpawn(c,6,uni,{period:"Morning"});
    await new Promise(r=>setTimeout(r,50));
    await runCharQuestPursuit(c,6,uni);
    r.born=await sp; r.kept=uni.gameData.charQuests.some(q=>q.title==="Open a bakery"); r.n=uni.gameData.charQuests.length;
    // no false "couldn't write" toast while the day-end chain holds the arc
    uni.gameData.arcMeta={"Arc":{brief:"b",premise:"p",complete:false}};
    uni.gameData.quests=[{id:"q1",arc:"Arc",seq:0,title:"Live",done:false,startActive:true,progress:[]}];
    const ts=[]; const ot=window.toast; window.toast=t=>ts.push(t);
    _qGenBusy.add(uni.id+"|Arc"); await questMarkDoneUI("q1"); _qGenBusy.delete(uni.id+"|Arc"); window.toast=ot;
    r.toasts=ts;
    // "Can you…" is not Can
    r.can={ask:questNamesChar({title:"x",desc:"Can you find the ledger?"},"Can"),initial:questNamesChar({title:"x",desc:"Can found the ledger."},"Can"),
      mid:questNamesChar({title:"x",desc:"Then Can took it. Will you help?"},"Can"),suffix:questNamesChar({title:"x",desc:"Can'a mektubu götür."},"Can")};
    // the quest editor never leaves two live quests
    uni.gameData.quests=[{id:"e1",arc:"Ed",seq:0,title:"Live",done:false,startActive:true,progress:[]},
      {id:"e2",arc:"Ed",seq:1,title:"Locked A",done:false,startActive:false,progress:[]},{id:"e3",arc:"Ed",seq:2,title:"Locked B",done:false,startActive:false,progress:[]}];
    questMarkDone("e2",{uni,day:5});
    r.liveAfterLockedClose=uni.gameData.quests.filter(q=>q.arc==="Ed"&&!q.done&&q.startActive!==false).map(q=>q.id);
    uni.gameData.quests=[{id:"f0",arc:"Fd",seq:0,title:"Old",done:true,startActive:true,progress:[]},{id:"f1",arc:"Fd",seq:1,title:"Newer",done:false,startActive:true,progress:[]}];
    window.toast=()=>{};
    questEditUI("f0"); document.getElementById("qeStatus").value="active"; questEditSave("f0"); window.toast=ot;
    r.liveAfterReopen=uni.gameData.quests.filter(q=>q.arc==="Fd"&&!q.done&&q.startActive!==false).map(q=>q.id);
    try{ _closeQuestsModal(); }catch(e){}
    return r;
  });
  ok("a pursuit born while a prune runs is kept (the array is pruned in place)", S.born===1&&S.kept===true, JSON.stringify(S));
  ok("no \"couldn't write the next quest\" while the day-end chain is writing it", !S.toasts.some(t=>/Couldn't write/.test(t))&&S.toasts.some(t=>/already being written/.test(t)), JSON.stringify(S.toasts));
  ok("\"Can you…\" does not name Can; \"Can found…\", \"Then Can…\", \"Can'a…\" do", S.can.ask===false&&S.can.initial&&S.can.mid&&S.can.suffix, JSON.stringify(S.can));
  ok("closing a LOCKED quest does not unlock a second live one", JSON.stringify(S.liveAfterLockedClose)==='["e1"]', JSON.stringify(S));
  ok("reopening a quest beside a newer live one reopens it locked", JSON.stringify(S.liveAfterReopen)==='["f1"]', JSON.stringify(S));

  await setup();
  const G=await pg.evaluate(async()=>{
    const c=curChat(); state.gmEvery=4; c.gmLastCheck=0; c.presentIds=["p_a"]; state.gmDecOn=false;   // v150.41 — the chat judge is the one under test
    const s=(r,t)=>Object.assign({mid:"m"+Math.random(),role:r,content:t,present:["p_a"]},r==="user"?{}:{speaker:"Ayla",speakerId:"p_a"});
    let judges=0, overtake=true;
    window.__reply=d=>{ if(d==="Gamemaster: judge"){ judges++; if(overtake)markPlayerTurn(c); return JSON.stringify({stale:true}); } return "Someone knocks at the door."; };
    const realBeat=window.playGamemasterBeat; let beats=0; window.playGamemasterBeat=async()=>{ beats++; };
    c.messages=[]; for(let i=0;i<2;i++){ c.messages.push(s("user","line "+i)); c.messages.push(s("assistant","reply "+i)); }
    await maybeGamemaster(c);
    const r={judges1:judges,stampAfterDrop:c.gmLastCheck};
    // the next turn gets the window it lost
    overtake=false; c.messages.push(s("user","next")); await maybeGamemaster(c); r.judges2=judges; r.beats=beats;
    // deleting messages does not fire the director
    for(let i=0;i<4;i++){ c.messages.push(s("user","more "+i)); c.messages.push(s("assistant","more reply "+i)); }
    judges=0; c.gmLastCheck=_gmTurnCount(c); c.messages.splice(-4); c.messages.push(s("user","after delete"));
    await maybeGamemaster(c); r.firedAfterDelete=judges; r.clamped=c.gmLastCheck===_gmTurnCount(c);
    window.playGamemasterBeat=realBeat;
    return r;
  });
  ok("a beat dropped because the player moved on gives its cadence window back", G.judges1===1&&G.stampAfterDrop===0&&G.judges2===2&&G.beats===1, JSON.stringify(G));
  ok("deleting messages does not fire the Gamemaster (the stamp is clamped)", G.firedAfterDelete===0&&G.clamped, JSON.stringify(G));

  /* ===== undiscovered characters ===== */
  console.log("\n[undiscovered characters: listed in their own group, offered nowhere]");
  await setup();
  const V=await pg.evaluate(async()=>{
    const uni=state.universes[0], c=curChat(); const r={}; const NM="Gizli Hüma";
    show('personas');
    renderPersonas();
    const list=document.getElementById('personaList');
    const grp=document.getElementById('undiscGroup');
    r.mainHas=[...list.children].some(x=>x.classList&&x.classList.contains('charCard')&&x.textContent.includes(NM));
    r.group=!!grp&&grp.textContent.includes(NM)&&/undiscovered — not met yet/.test(grp.textContent);
    r.collapsed=!!grp&&grp.open===false;
    r.card=!!grp&&!!grp.querySelector('.charCard.latent [data-reveal]')&&!!grp.querySelector('.charCard.latent [data-del]')&&!!grp.querySelector('.charCard.latent [data-edit]');
    const seen={};
    // text contacts
    openTextInbox(); seen.texts=(document.getElementById('textPop')||{}).textContent||""; try{ closeTextPop(); }catch(e){}
    // who is here
    openCast(); seen.cast=document.getElementById('castList').textContent; try{ closeModal('castModal'); }catch(e){}
    // image character picker
    try{ openPlayground(); }catch(e){} seen.playground=(document.getElementById('playgroundBody')||{}).textContent||""; try{ closeModal('playgroundModal'); }catch(e){}
    // memory editor owner
    openMemEditor(); seen.memOwner=[...document.getElementById('memEditOwner').options].map(o=>o.textContent).join("|"); try{ closeModal('memEditModal'); }catch(e){}
    // universe editor: residents picker + location list + tracker owners
    editingUniverse=uni; _ueLocs=JSON.parse(JSON.stringify(uni.locations));
    renderLocEditor(); seen.locList=document.getElementById('ueLocList').textContent;
    editLocation(0); seen.residents=document.getElementById('leResidents').textContent;
    saveLocationEdit(); r.residentKept=(_ueLocs[0].residents||[]).includes("p_h");
    try{ closeModal('locEditModal'); }catch(e){}
    toggleTrackerGenForm(); seen.trackerOwner=[...document.querySelectorAll('#tgOwner option')].map(o=>o.textContent).join("|"); toggleTrackerGenForm();
    _teRenderCharList([]); seen.trackerChars=(document.getElementById('teCharList')||{}).textContent||"";
    r.leaks=Object.keys(seen).filter(k=>seen[k].includes(NM));
    r.sane=seen.cast.includes("Ayla")&&seen.memOwner.includes("Ayla")&&seen.residents.includes("Ayla")&&seen.trackerOwner.includes("Ayla");
    editingUniverse=null;
    // reveal from the list
    show('personas'); renderPersonas();
    document.querySelector('#undiscGroup .charCard.latent [data-reveal]').click();
    const h=state.personas.find(p=>p.id==="p_h"); r.revealed=h.latent===false;
    renderPersonas(); r.groupGone=!document.getElementById('undiscGroup');
    r.nowListed=[...document.getElementById('personaList').children].some(x=>x.textContent&&x.textContent.includes(NM));
    return r;
  });
  ok("an undiscovered character is in the character list's collapsed Undiscovered group, not the main grid",
     V.mainHas===false&&V.group===true&&V.collapsed===true, JSON.stringify(V));
  ok("its card can be opened, edited, revealed and deleted", V.card===true, JSON.stringify(V));
  ok("it appears in none of the pickers (texts, cast, playground, memory owner, residents, locations, tracker owners)",
     Array.isArray(V.leaks)&&V.leaks.length===0&&V.sane, JSON.stringify(V));
  ok("hiding it from the residents picker does not drop it from the place on save", V.residentKept===true, JSON.stringify(V));
  ok("Reveal brings it into play and into the main list", V.revealed&&V.groupGone&&V.nowListed, JSON.stringify(V));

  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log(`\n  ${pass} passed, ${fail} failed`);
  await b.close(); process.exit(fail?1:0);
})();
