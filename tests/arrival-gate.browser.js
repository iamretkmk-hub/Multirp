/* v150.78 — ARRIVALS WAIT FOR A REASON. An export: Buket's overture resolved and one turn later Sami (her husband) let
   himself into Emre's house while she sat on Emre's lap; his event resolved and one turn later Nil walked into the living
   room. Checked here, with the model and the Decisions endpoint stubbed:
     - the privacy lock: alone together in a private home area holds arrivals (the sub-area was read as a location and
       never held); the Turkish lines from that scene read as intimate, ordinary ones do not;
     - the gap: nothing surfaces for EVENT_GAP_TURNS real turns after an event ends, and it may after; a second arrival at
       the same place in the same part of the day waits too; the Gamemaster stands down in the gap without spending its window;
     - the arrival gate: a no keeps the plan armed with no event (three noes hold it to the next part of the day), a yes
       starts the event, no answer surfaces nothing; the state carries whose home it is, where the holder is, what they are
       due to do, the room's last lines and the rules; someone already in earshot is not asked;
     - resolved means resolved: no beat for a resolved event or one at its last turn, and never two beats at once;
     - quoted dialogue is taken out of the scene writer's narration;
     - the scene writer's home rule, upgraded into a stored copy only while it is the v150.77 default.
   Run: node tests/arrival-gate.browser.js */
const {chromium}=require('playwright');
const path=require('path');
(async()=>{
  const b=await chromium.launch({executablePath:process.env.SM_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage({viewport:{width:412,height:915}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  const boot=async()=>{
    await pg.goto('file://'+path.resolve(__dirname,'..','index.html')); await pg.waitForTimeout(2400);
    await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
    await pg.waitForTimeout(700);
  };
  await boot();
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x===undefined?c:x).slice(0,900));} };

  const install=()=>pg.evaluate(()=>{
    window.__reqs=[]; window.__calls=[]; window.__dec=null; window.__mode="ok"; window.__kicks=[]; window.__writer=null;
    const realF=window.__realFetch||window.fetch; window.__realFetch=realF;
    window.fetch=async(u,o)=>{ if(String(u).indexOf("/api/alpha/decisions")>-1){ const body=JSON.parse(o.body); __reqs.push(body);
        if(__mode==="500")return new Response(JSON.stringify({error:{message:"server error"}}),{status:500});
        return new Response(JSON.stringify({answers:__dec?__dec(body):{}}),{status:200}); } return realF(u,o); };
    window.chatCompletion=async(msgs,model,opts)=>{ const d=(opts&&opts.dbg)||""; __calls.push({d,msgs});
      if(/^Scene writer: advance/.test(d)&&__writer)return await __writer(msgs); return "{}"; };
    window._kickEventOpening=(chat,ev,who)=>{ __kicks.push(who&&who.name); };
    window.uiConfirm=async()=>true;
    window.__yes=p=>body=>{ const out={}; Object.keys(body.questions).forEach(k=>{ out[k]={type:"noul",noul:p}; }); return out; };
    // the world: Emre's house (his home, two areas), Sami and Buket's house, Sami's office, a cafe
    window.__setup=(o)=>{ o=o||{};
      const uni=state.universes[0]; state.curUniverse=uni.id;
      uni.playerHomeLocId="l_emre";
      uni.locations=[
        {id:"l_emre",name:"Emre's House",type:"home",description:"A villa with a pool.",residents:[],
         sublocations:[{id:"s_liv",name:"Living Room",entrance:true,description:"sofa"},{id:"s_ter",name:"Terrace",description:"by the pool"}]},
        {id:"l_sami",name:"Sami's House",type:"home",description:"A flat.",residents:["p_sami","p_buket"],sublocations:[{id:"s_sl",name:"Hall",entrance:true}]},
        {id:"l_office",name:"Office",type:"poi",description:"Sami's workplace.",residents:[],sublocations:[{id:"s_of",name:"Desk",entrance:true}]},
        {id:"l_cafe",name:"Cafe",type:"poi",description:"A busy cafe.",residents:[],sublocations:[{id:"s_cf",name:"Tables",entrance:true}]}];
      uni.gameData={}; uni.rules=[];
      const mk=(id,name,rel)=>({id,name,universeId:uni.id,personality:"x",instructions:"x",look:{},relationships:rel||{}});
      state.personas=[mk("p_buket","Buket",{__user__:{tie:"friend's wife"},p_sami:{tie:"husband"}}),
        mk("p_sami","Sami",{__user__:{tie:"friend"},p_buket:{tie:"wife"},p_duygu:{tie:"crush"}}),
        mk("p_nil","Nil"),mk("p_duygu","Duygu",{p_sami:{tie:"acquaintance"}})];
      Object.assign(state,{key:"k",user:"Emre",intentOn:true,sceneOn:true,confrontOn:true,charQuestsOn:false,gmOn:false,heatOn:false,
        arrivalGateOn:true,arrivalGateAt:0.6,moveDecOn:false,routerDecOn:false,textGateOn:false,pulseOn:false,calOn:false,relOn:false,trackOn:false,mem:false});
      try{ _arrivalDecBreak.until=0; _arrivalDecBreak.fails=0; }catch(e){}
      state.memory=[];
      const c=curChat();
      Object.assign(c,{universeId:uni.id,gameDay:5,period:"Afternoon",timeOfDay:"Afternoon",locationId:o.loc||"l_emre",location:o.locName||"Emre's House",
        subId:o.sub||"s_liv",presentIds:o.present||["p_buket","p_duygu"],subPos:Object.assign({p_buket:"s_liv",p_duygu:"s_liv",p_sami:"s_liv",p_nil:"s_liv"},o.pos||{}),
        activeEvent:null,dnd:false,expected:[],intents:[],calendar:o.calendar||[],messages:[],gmLastCheck:0,
        dayPlacement:{day:5,period:"Afternoon",positions:{p_sami:"l_office",p_nil:"l_cafe",p_buket:"l_emre",p_duygu:"l_emre"}},worldPositions:null,_wpKey:null,companionLock:{},leftBehind:null});
      delete c.lastEventEndTurn; delete c.lastEventEnd; delete c.lastArrival; delete c._heatBeat; delete c.sceneDockId;
      const lines=o.lines||[["user","Çay ister misiniz?"],["Buket","Olur, teşekkürler."],["Duygu","Ben de alayım."]];
      lines.forEach(([who,t],i)=>c.messages.push(who==="user"?{mid:"m"+i,role:"user",content:t,present:c.presentIds.slice()}
        :{mid:"m"+i,role:"assistant",speaker:who,speakerId:(state.personas.find(p=>p.name===who)||{}).id,content:t,present:c.presentIds.slice()}));
      window.__reqs=[]; window.__calls=[]; window.__kicks=[]; window.__dec=null; window.__mode="ok"; window.__writer=null;
      return c; };
    window.__plan=(o)=>Object.assign({id:"i_sami",holderId:"p_sami",holderName:"Sami",targetId:"__user__",targetName:"Emre",kind:"courtship",valence:"warm",
      aim:"to have Emre put in a word with Duygu",trigger:"t",strength:0.7,priority:"medium",allies:[],status:"armed",born:3,lastTick:4,
      plan:{method:"direct",approach:"",steps:[{phase:"strike",gate:{type:"none"},status:"pending"}],cursor:0,params:{},patience:0.5,expires:99,formedDay:4}},o||{});
    window.__turns=(c,n)=>{ for(let i=0;i<n;i++){ c.messages.push(i%2?{mid:"t"+Math.random(),role:"assistant",speaker:"Buket",speakerId:"p_buket",content:"Hı hı.",present:c.presentIds.slice()}
        :{mid:"t"+Math.random(),role:"user",content:"Peki.",present:c.presentIds.slice()}); } };
    window.__run=async c=>{ let r=checkArmedPlans(c); const promise=!!(r&&typeof r.then==="function"); if(promise)r=await r; return {r,promise}; };
  });
  await install();

  // ------------------------------------------------------------------ the privacy lock
  console.log("\n[the privacy lock]");
  const P=await pg.evaluate(async()=>{
    const r={};
    let c=__setup({present:["p_buket"]}); r.homeOneOnOne=sceneIsPrivateMoment(c);
    c.intents=[__plan()]; const a=await __run(c); r.held=a.r===false&&c.intents[0].status==="armed"&&__reqs.length===0&&!c.activeEvent;
    c=__setup({present:["p_buket"],pos:{p_buket:"s_ter"}}); r.otherArea=sceneIsPrivateMoment(c);
    c=__setup({present:["p_buket","p_duygu"]}); r.twoHere=sceneIsPrivateMoment(c);
    c=__setup({loc:"l_cafe",locName:"Cafe",sub:"s_cf",present:["p_buket"],pos:{p_buket:"s_cf"}}); r.cafe=sceneIsPrivateMoment(c);
    // the scene from the export, at the cafe with two people (so only the words decide)
    const T=["*Kalçalarından tutup kucağıma alıyorum. Kanepeye oturuyorum. Üzerime oturtuyorum. Dudaklarım dudaklarında ellerim kalçasında.*",
      "_Bütün gün aklımda bu vardı zaten._ *Bacaklarımı iki yanına açıp kucağına iyice yerleşiyorum, parmaklarımı saçlarının arasına dolayıp nefesimi yüzüne veriyorum.* \"Hani çok sabırlıydın sen?\"",
      "Sus *diyerek kalçasına bir tokat indiriyorum.*",
      "_Canımı yakışı bile içimdeki yangını körüklüyor resmen._ *Tokadın acısıyla kesik bir nefes verip kalçamı kucağına daha sert bastırıyorum, tırnaklarımı omuzlarına geçirirken gözlerimi gözlerinden ayırmıyorum.* \"Sustur o zaman...\""];
    r.lap=intimacyReads(T[0]);
    r.slapTail=intimacyReads(T.slice(2).join("\n"));
    c=__setup({loc:"l_cafe",locName:"Cafe",sub:"s_cf",present:["p_buket","p_duygu"],pos:{p_buket:"s_cf",p_duygu:"s_cf"},
      lines:[["user",T[0]],["Buket",T[1]],["user",T[2]],["Buket",T[3]]]});
    r.scene=sceneIsPrivateMoment(c);
    const ordinary=["Çocuğu kucağına aldı.","Annesinin elini öptü.","Suratına bir tokat attı, kavga büyüdü.","Ellerini dizlerine koyup oturdu.","Kapıdaki tabelada Kapalı yazıyordu.","Dudaklarını büzdü ve sustu."];
    r.ordinary=ordinary.filter(t=>intimacyReads(t));
    return r; });
  ok("alone together in a private home area is a private moment (the area of the place, not its id)", P.homeOneOnOne===true, JSON.stringify(P));
  ok("…and an armed plan does not bring anyone in: no gate asked, no event, still armed", P.held===true, JSON.stringify(P));
  ok("not when the one character is in another area, two are here, or the place is a public one", P.otherArea===false&&P.twoHere===false&&P.cafe===false, JSON.stringify(P));
  ok("\"Dudaklarım dudaklarında … kucağıma alıyorum\" reads as intimate", P.lap===true, JSON.stringify(P));
  ok("a slap on the hip and the lap that answers it read as intimate (no fight context)", P.slapTail===true, JSON.stringify(P));
  ok("the export's last four lines are a private moment wherever they are said", P.scene===true, JSON.stringify(P));
  ok("ordinary lines stay ordinary (a child on a lap, a hand kiss, a slap in a fight, pursed lips)", P.ordinary.length===0, JSON.stringify(P.ordinary));

  // ------------------------------------------------------------------ the gap
  console.log("\n[the gap after an event]");
  const G=await pg.evaluate(async()=>{
    const r={};
    // Sami is already here (in earshot), so the gate is not part of this
    const c=__setup({present:["p_buket","p_duygu","p_sami"]});
    c.activeEvent={kind:"overture",summary:"Buket reaches out",accuserId:"p_buket",accuserName:"Buket",turn:2,minTurns:2,maxTurns:3,resolved:false,type:"character",participant:{name:"Buket",charId:"p_buket",approaching:false}};
    const ev=c.activeEvent;
    await resolveActiveEvent(c,"it lands");
    r.stamp={turn:c.lastEventEndTurn,now:_gmTurnCount(c),end:c.lastEventEnd,resolvedFlag:ev.resolved};
    c.intents=[__plan()];
    const a=await __run(c); r.right=a.r; r.armed=c.intents[0].status; r.fails=c.intents[0].surfaceFails||0;
    __turns(c,EVENT_GAP_TURNS-1); const b=await __run(c); r.five=b.r; r.armed5=c.intents[0].status;
    __turns(c,1); const d=await __run(c); r.six=d.r; r.promise6=d.promise; r.spent=c.intents[0].status; r.ev=c.activeEvent&&c.activeEvent.accuserName; r.kicks=__kicks.slice();
    r.reqs=__reqs.length;
    return r; });
  ok("resolving an event stamps when it ended: the turn, the day, the part of the day, the place", G.stamp.turn===G.stamp.now&&G.stamp.end&&G.stamp.end.day===5&&G.stamp.end.period==="Afternoon"&&G.stamp.end.place==="l_emre"&&G.stamp.resolvedFlag===true, JSON.stringify(G.stamp));
  ok("right after, an armed plan does not surface — and that is not a miss", G.right===false&&G.armed==="armed"&&G.fails===0, JSON.stringify(G));
  ok("…nor "+5+" turns later", G.five===false&&G.armed5==="armed", JSON.stringify(G));
  ok("after EVENT_GAP_TURNS (6) real turns it surfaces (someone already here: no gate, at once)", G.six===true&&G.promise6===false&&G.spent==="spent"&&G.ev==="Sami"&&G.reqs===0, JSON.stringify(G));

  const AR=await pg.evaluate(async()=>{
    const r={};
    let c=__setup(); c.intents=[__plan()];
    c.lastArrival={turn:_gmTurnCount(c),day:5,period:"Afternoon",place:"l_emre",who:"Nil"};
    const a=await __run(c); r.second=a.r; r.reqs=__reqs.length; r.armed=c.intents[0].status;
    c=__setup({present:["p_buket","p_duygu","p_sami"]}); c.intents=[__plan()];
    c.lastArrival={turn:_gmTurnCount(c),day:5,period:"Afternoon",place:"l_emre",who:"Nil"};
    const b=await __run(c); r.here=b.r;
    c=__setup(); c.intents=[__plan()]; c.lastArrival={turn:_gmTurnCount(c),day:5,period:"Morning",place:"l_emre",who:"Nil"};
    __dec=__yes(0.9); const d=await __run(c); r.otherPeriod=d.r;
    return r; });
  ok("a second arrival at the same place in the same part of the day waits (not even asked)", AR.second===false&&AR.reqs===0&&AR.armed==="armed", JSON.stringify(AR));
  ok("…someone already in earshot may still speak up", AR.here===true, JSON.stringify(AR));
  ok("…and an arrival in another part of the day is not held by it", AR.otherPeriod===true, JSON.stringify(AR));

  const GM=await pg.evaluate(async()=>{
    const r={};
    const c=__setup(); state.gmOn=true; state.gmEvery=3; __turns(c,6);
    c.lastEventEndTurn=_gmTurnCount(c); c.gmLastCheck=0;
    await maybeGamemaster(c); r.inGap=c.gmLastCheck; r.callsInGap=__calls.length+__reqs.length;
    __turns(c,EVENT_GAP_TURNS); await maybeGamemaster(c); r.after=c.gmLastCheck; r.now=_gmTurnCount(c);
    state.gmOn=false;
    // no second arrival from the Gamemaster either: its kinds lose "arrival"
    let kinds=null; const c3=__setup(); state.gmOn=true; __turns(c3,10); c3.lastArrival={turn:_gmTurnCount(c3),day:5,period:"Afternoon",place:"l_emre",who:"Nil"}; c3.gmLastCheck=0;
    __dec=body=>{ if(body.questions.kind)kinds=Object.keys(body.questions.kind.criteria); return {}; };
    await maybeGamemaster(c3); r.kinds=kinds; state.gmOn=false;
    return r; });
  ok("the Gamemaster stands down in the gap and does not spend its window", GM.inGap===0&&GM.callsInGap===0, JSON.stringify(GM));
  ok("…and checks again once the gap is over", GM.after===GM.now, JSON.stringify(GM));
  ok("after an arrival here this part of the day, the Gamemaster is not offered an arrival", Array.isArray(GM.kinds)&&GM.kinds.indexOf("arrival")<0&&GM.kinds.indexOf("signal")>=0, JSON.stringify(GM));

  // ------------------------------------------------------------------ the arrival gate
  console.log("\n[the arrival gate]");
  const N=await pg.evaluate(async()=>{
    const r={};
    const c=__setup({calendar:[{id:"cal1",day:5,period:"Evening",title:"Dinner with Buket",who:"Sami",charId:"p_sami",locationId:"l_sami",done:false}]});
    c.intents=[__plan()]; __dec=__yes(0.2);
    const a=await __run(c); const it=c.intents[0];
    r.promise=a.promise; r.r=a.r; r.status=it.status; r.fails=it.surfaceFails||0; r.refusals=it.arrivalRefusals; r.ev=!!c.activeEvent; r.kicks=__kicks.length;
    const q=__reqs[0]||{state:{},questions:{}}; r.state=q.state; r.q=q.questions.arrive; r.model=q.model;
    r.row=!!dbgLog.find(e=>e&&e.label==="Arrival gate (Decisions) · Sami");
    // two more noes: the plan waits until the next part of the day
    await __run(c); await __run(c); r.hold=it.arrivalHold; r.statusAfter3=it.status;
    const n=__reqs.length; await __run(c); r.askedWhileHeld=__reqs.length-n;
    c.period="Evening"; c.timeOfDay="Evening"; c.dayPlacement=null; __dec=__yes(0.2); const m=__reqs.length; await __run(c); r.askedNextPeriod=__reqs.length-m;
    return r; });
  ok("the holder is not here: the gate is asked first (a promise checkArmedPlans hands postTurn)", N.promise===true&&N.model===await pg.evaluate(()=>decisionsModel()), JSON.stringify(N.model));
  ok("a no: no event, the plan stays armed, no surfacing miss, one refusal counted", N.r===false&&N.status==="armed"&&N.fails===0&&N.refusals===1&&N.ev===false&&N.kicks===0, JSON.stringify(N));
  ok("the debug row is \"Arrival gate (Decisions) · Sami\"", N.row===true);
  const S=N.state||{};
  ok("state: the place is Emre's private home, and Sami does not live there (he would have to ring or knock)",
     /Emre's House/.test(S.place||"")&&/private home — Emre's home/.test(S.place||"")&&/does not live here: coming here means ringing the bell or knocking/.test(S.their_right_to_be_here||""), JSON.stringify(S));
  ok("state: where Sami is now (the office) and what he is due to do today (dinner, Evening)",
     /Office/.test(S.where_they_are_now||"")&&/Evening: Dinner with Buket at Sami's House/.test((S.due_today||[]).join("|")), JSON.stringify(S));
  ok("state: the time, who is with Emre, Sami's ties to them, the room's last lines and what he would come for",
     S.time==="Day 5, Afternoon"&&S.the_one_who_would_come==="Sami"&&(S.with_the_player||[]).join()==="Buket,Duygu"&&/Buket: wife/.test((S.their_ties||[]).join("|"))&&/Emre \(the player\): friend/.test((S.their_ties||[]).join("|"))
     &&/Çay ister misiniz\?/.test((S.latest_lines||[]).join("|"))&&/Ben de alayım/.test((S.latest_lines||[]).join("|"))&&/put in a word with Duygu/.test(S.what_they_would_come_for||""), JSON.stringify(S));
  const Q=N.q||{};
  ok("the question: would Sami come to Emre's House right now — with the rules",
     Q.type==="noul"&&/Would Sami come to Emre's House right now, as things stand\?/.test(Q.instructions||"")
     &&/People do not walk into someone else's home uninvited/.test((Q.criteria||{}).false||"")&&/ringing or knocking/.test((Q.criteria||{}).false||"")
     &&/at work, somewhere else, or due somewhere else soon does not appear/.test((Q.criteria||{}).false||"")&&/Nobody bursts in on an intimate or private scene/.test((Q.criteria||{}).false||""), JSON.stringify(Q));
  ok("three noes hold the plan to the next part of the day (not asked meanwhile), then it is asked again",
     N.hold&&N.hold.day===5&&N.hold.period==="Afternoon"&&N.statusAfter3==="armed"&&N.askedWhileHeld===0&&N.askedNextPeriod===1, JSON.stringify(N));

  const Y=await pg.evaluate(async()=>{
    const r={};
    let c=__setup(); c.intents=[__plan()]; __dec=__yes(0.8);
    const a=await __run(c); const it=c.intents[0];
    r.yes={r:a.r,status:it.status,ev:c.activeEvent&&c.activeEvent.kind,who:c.activeEvent&&c.activeEvent.accuserName,kicks:__kicks.slice(),arr:c.lastArrival};
    c=__setup(); c.intents=[__plan()]; __mode="500";
    const b=await __run(c); r.fail={r:b.r,status:c.intents[0].status,fails:c.intents[0].surfaceFails||0,refusals:c.intents[0].arrivalRefusals||0,ev:!!c.activeEvent};
    c=__setup(); c.intents=[__plan()]; __dec=()=>({});   // an answer with no usable probability
    const d=await __run(c); r.empty={r:d.r,ev:!!c.activeEvent,refusals:c.intents[0].arrivalRefusals||0};
    c=__setup(); c.intents=[__plan()]; _arrivalDecBreak.until=Date.now()+60000; _arrivalDecBreak.key=String(state.key);
    const e=await __run(c); r.paused={r:e.r,reqs:__reqs.length,ev:!!c.activeEvent}; _arrivalDecBreak.until=0;
    // the player moved on while it was asked
    c=__setup(); c.intents=[__plan()]; __dec=__yes(0.9);
    const p=checkArmedPlans(c); markPlayerTurn(c); r.superseded={r:await p,ev:!!c.activeEvent,status:c.intents[0].status};
    // already in earshot: no gate
    c=__setup({present:["p_buket","p_duygu","p_sami"]}); c.intents=[__plan()];
    const h=checkArmedPlans(c); r.here={r:h,reqs:__reqs.length,ev:c.activeEvent&&c.activeEvent.accuserName};
    // at this place but out of earshot (on the terrace): asked, and the state says so
    c=__setup({present:["p_buket","p_duygu","p_sami"],pos:{p_sami:"s_ter"}}); c.intents=[__plan()]; __dec=__yes(0.2);
    const t=await __run(c); r.terrace={promise:t.promise,where:(__reqs[0]&&__reqs[0].state.where_they_are_now)||""};
    // the gate off: as before
    c=__setup(); c.intents=[__plan()]; state.arrivalGateOn=false;
    const f=checkArmedPlans(c); r.off={r:f,reqs:__reqs.length}; state.arrivalGateOn=true;
    return r; });
  ok("a yes (0.8 ≥ 0.6): the event starts and the plan is spent; the arrival is recorded", Y.yes.r===true&&Y.yes.status==="spent"&&Y.yes.ev==="overture"&&Y.yes.who==="Sami"&&Y.yes.kicks.join()==="Sami"&&Y.yes.arr&&Y.yes.arr.who==="Sami"&&Y.yes.arr.place==="l_emre", JSON.stringify(Y.yes));
  ok("a failed request: nobody arrives, nothing counted, the plan stays armed", Y.fail.r===false&&Y.fail.status==="armed"&&Y.fail.fails===0&&Y.fail.refusals===0&&Y.fail.ev===false, JSON.stringify(Y.fail));
  ok("no usable answer, or the gate paused: nobody arrives this turn", Y.empty.r===false&&Y.empty.ev===false&&Y.empty.refusals===0&&Y.paused.r===false&&Y.paused.reqs===0&&Y.paused.ev===false, JSON.stringify([Y.empty,Y.paused]));
  ok("the player moved on while it was asked: dropped", Y.superseded.r===false&&Y.superseded.ev===false&&Y.superseded.status==="armed", JSON.stringify(Y.superseded));
  ok("someone already in earshot is not asked: it surfaces at once", Y.here.r===true&&Y.here.reqs===0&&Y.here.ev==="Sami", JSON.stringify(Y.here));
  ok("someone at this place but in another area is asked, and the state says where", Y.terrace.promise===true&&/already at Emre's House, in the Terrace — not in Emre's area/.test(Y.terrace.where), JSON.stringify(Y.terrace));
  ok("with the gate off it surfaces as before", Y.off.r===true&&Y.off.reqs===0, JSON.stringify(Y.off));
  ok("postTurn awaits the gate's answer", await pg.evaluate(()=>/_armed=await _armed/.test(String(postTurn))));

  // ------------------------------------------------------------------ resolved means resolved
  console.log("\n[resolved means resolved]");
  const R=await pg.evaluate(async()=>{
    const r={};
    const mkEv=o=>Object.assign({kind:"overture",summary:"Sami comes to Emre",intent:"x",accuserId:"p_sami",accuserName:"Sami",conviction:0.5,floor:0,ceiling:0.9,evidence:0.6,
      turn:2,minTurns:2,maxTurns:3,resolved:false,type:"character",_startMsg:9999,participant:{name:"Sami",charId:"p_sami",approaching:false}},o||{});
    let c=__setup({present:["p_buket","p_sami"]});
    c.activeEvent=mkEv({resolved:true}); r.resolved=await runSceneWriter(c); r.callsResolved=__calls.filter(x=>/^Scene writer/.test(x.d)).length;
    c=__setup({present:["p_buket","p_sami"]}); c.activeEvent=mkEv({turn:3}); const cap=c.activeEvent;
    r.cap=await runSceneWriter(c); r.capCalls=__calls.filter(x=>/^Scene writer/.test(x.d)).length; r.capTurn=cap.turn; r.capCleared=c.activeEvent===null;
    r.capEnd=typeof c.lastEventEndTurn==="number"; r.capMem=!!state.memory.find(m=>m&&m.source==="overture"&&m.ownerId==="p_sami");
    // two runs at once: the second does not start
    c=__setup({present:["p_buket","p_sami"]}); c.activeEvent=mkEv(); const ev=c.activeEvent;
    let release; const gate=new Promise(res=>{ release=res; });
    __writer=async()=>{ await gate; return JSON.stringify({narration:"Sami korkuluğa yaslandı.",bring_in:null,resolved:true,resolution:"x"}); };
    const A=runSceneWriter(c); await new Promise(res=>setTimeout(res,30));
    r.second=await runSceneWriter(c); r.writerCalls=__calls.filter(x=>/^Scene writer: advance/.test(x.d)).length; r.turnMid=ev.turn;
    release(); await A; r.after={turn:ev.turn,resolved:ev.resolved,cleared:c.activeEvent===null};
    r.third=await runSceneWriter(c); r.writerCalls2=__calls.filter(x=>/^Scene writer: advance/.test(x.d)).length;
    return r; });
  ok("a resolved event gets no beat", R.resolved===false&&R.callsResolved===0, JSON.stringify(R));
  ok("an event already at its last turn is closed with no beat (and its aftermath kept)", R.cap===false&&R.capCalls===0&&R.capTurn===3&&R.capCleared&&R.capEnd&&R.capMem, JSON.stringify(R));
  ok("a second scene writer for the same event does not start while the first is writing (no \"Turn 4 of 3\")", R.second===false&&R.writerCalls===1&&R.turnMid===3, JSON.stringify(R));
  ok("…and the first one resolves it at turn 3; nothing advances it after", R.after.turn===3&&R.after.resolved===true&&R.after.cleared===true&&R.third===false&&R.writerCalls2===1, JSON.stringify(R));

  // ------------------------------------------------------------------ the narration sanitizer
  console.log("\n[quoted speech out of the narration]");
  const D=await pg.evaluate(async()=>{
    const r={};
    const t73="Sami ayağa kalkıp mutfağa doğru yürüdü, buzdolabını açıp iki şişe su aldı, birini Emre'ye uzattı ve sesini biraz düşürüp terasa doğru başını eğdi. \"Kardeş, seninle iki dakka baş başa konuşsak... havuza inip bir sigara içelim mi? Buket de otursun, yorgundur o.\"";
    r.t73=stripNarrationDialogue(t73);
    r.curly=stripNarrationDialogue("Nil kapıda durdu: “Emre, bir dakika gelir misin?”");
    r.mid=stripNarrationDialogue("Sami \"Tamam, tamam,\" dercesine elini kaldırdı.");
    r.label=stripNarrationDialogue("Kapıdaki tabelada \"Kapalı\" yazıyordu.");
    r.only=stripNarrationDialogue("\"Geldim!\"");
    r.plain=stripNarrationDialogue("Kapı açıldı ve Meral içeri girdi.");
    const c=__setup({present:["p_buket","p_sami"]});
    c.activeEvent={summary:"a knock",type:"environment",turn:0,minTurns:1,maxTurns:5,resolved:false,participant:null};
    __writer=async()=>JSON.stringify({narration:t73,bring_in:null,resolved:false});
    await runSceneWriter(c); const beat=[...c.messages].reverse().find(m=>m&&m.sceneBeat); r.posted=beat&&beat.content;
    return r; });
  ok("the export's beat loses Sami's line and keeps the narration", D.t73==="Sami ayağa kalkıp mutfağa doğru yürüdü, buzdolabını açıp iki şişe su aldı, birini Emre'ye uzattı ve sesini biraz düşürüp terasa doğru başını eğdi.", D.t73);
  ok("curly quotes too, and the colon left behind goes", D.curly==="Nil kapıda durdu.", D.curly);
  ok("a line in the middle of a sentence is taken out without a stray space or comma", D.mid==="Sami dercesine elini kaldırdı.", D.mid);
  ok("a single quoted word with no sentence mark (a sign) stays; a beat that was only dialogue becomes nothing; plain narration is untouched",
     D.label==="Kapıdaki tabelada \"Kapalı\" yazıyordu."&&D.only===""&&D.plain==="Kapı açıldı ve Meral içeri girdi.", JSON.stringify(D));
  ok("runSceneWriter posts the beat without the quoted line", D.posted==="Sami ayağa kalkıp mutfağa doğru yürüdü, buzdolabını açıp iki şişe su aldı, birini Emre'ye uzattı ve sesini biraz düşürüp terasa doğru başını eğdi.", D.posted);

  // ------------------------------------------------------------------ the scene writer's home rule
  console.log("\n[the scene writer: at someone else's home a visitor rings]");
  const W=await pg.evaluate(()=>({has:DEFAULT_SCENE_WRITER.indexOf(SCENE_WRITER_HOME_RULE_V150_78)>0,
    rule:/AT SOMEONE ELSE'S HOME: a visitor never lets themselves in\. They ring the bell\s+or knock and are let in, or they are seen at the gate or the door/.test(SCENE_WRITER_HOME_RULE_V150_78),
    zero:DEFAULT_SCENE_WRITER.indexOf("## RULE ZERO")<DEFAULT_SCENE_WRITER.indexOf("AT SOMEONE ELSE'S HOME")&&DEFAULT_SCENE_WRITER.indexOf("AT SOMEONE ELSE'S HOME")<DEFAULT_SCENE_WRITER.indexOf("## WHAT bring_in IS"),
    fresh:state.sceneWriter===DEFAULT_SCENE_WRITER||!store.raw(K.sceneWriter,null)}));
  ok("the shipped prompt carries the home rule, in Rule Zero", W.has&&W.rule&&W.zero, JSON.stringify(W));
  await pg.evaluate(()=>{
    const old=DEFAULT_SCENE_WRITER.replace(SCENE_WRITER_HOME_RULE_V150_78,"");
    store.setRaw(K.sceneWriter,old);
    const u=state.universes[0]; u.prompts=Object.assign({},u.prompts||{},{sceneWriter:old+"\nMY OWN RULE"});
    if(state.universes[1]){ state.universes[1].prompts=Object.assign({},state.universes[1].prompts||{},{sceneWriter:old}); }
    persistUniverses();
  });
  await pg.waitForTimeout(300);
  await boot(); await install();
  const U=await pg.evaluate(()=>{ const u=state.universes[0]||{}, p=u.prompts||{};
    return {state:state.sceneWriter===DEFAULT_SCENE_WRITER,stored:store.raw(K.sceneWriter,"")===DEFAULT_SCENE_WRITER,
      edited:/\nMY OWN RULE$/.test(p.sceneWriter||"")&&(p.sceneWriter||"").indexOf(SCENE_WRITER_HOME_RULE_V150_78)<0,
      second:state.universes[1]?state.universes[1].prompts.sceneWriter===DEFAULT_SCENE_WRITER:true}; });
  ok("a stored copy still at the v150.77 default gets the rule (and is saved)", U.state&&U.stored&&U.second, JSON.stringify(U));
  ok("an edited copy is the player's and is left alone", U.edited, JSON.stringify(U));

  // ------------------------------------------------------------------ settings and prompts
  console.log("\n[settings and prompts]");
  const ST=await pg.evaluate(()=>{ localStorage.removeItem(K.arrivalGateOn); localStorage.removeItem(K.arrivalGateAt); loadState();
    const def={on:state.arrivalGateOn,at:arrivalGateAt()};
    state.arrivalGateOn=false; state.arrivalGateAt=0.7; syncSettingsUI();
    const shown={on:document.getElementById("setArrivalGateOn").checked,at:+document.getElementById("setArrivalGateAt").value};
    document.getElementById("setArrivalGateOn").checked=true; document.getElementById("setArrivalGateAt").value="0.8"; saveSettings(false);
    const saved={on:store.raw(K.arrivalGateOn,""),at:store.raw(K.arrivalGateAt,""),st:state.arrivalGateAt};
    return {def,reg:!!X_ENGINE_PROMPTS.x_arrival_gate&&/\{\{holder\}\}/.test(X_ENGINE_PROMPTS.x_arrival_gate.def),
      card:JSON.stringify((ENGINE_PAYLOAD_DEFS.find(d=>d.key==="intent")||{}).blocks||[]).indexOf('"x_arrival_gate"')>=0,shown,saved,
      pack:PROMPT_PACK_KEYS.indexOf("arrivalGateOn")>=0&&PROMPT_PACK_KEYS.indexOf("arrivalGateAt")>=0,
      ui:!!document.getElementById("setArrivalGateOn")&&!!document.getElementById("setArrivalGateAt"),gap:EVENT_GAP_TURNS}; }).catch(e=>({err:String(e)}));
  ok("on by default at 0.6; the gap is six turns", ST.def&&ST.def.on===true&&ST.def.at===0.6&&ST.gap===6, JSON.stringify(ST));
  ok("the question is an editable prompt on the Intent Engine card, in prompt packs, with its switches in Settings", ST.reg&&ST.card&&ST.pack&&ST.ui, JSON.stringify(ST));
  ok("Settings shows and saves both", ST.shown&&ST.shown.on===false&&ST.shown.at===0.7&&ST.saved.on==="1"&&ST.saved.at==="0.8"&&ST.saved.st===0.8, JSON.stringify(ST));
  const pe=require('fs').readFileSync(path.resolve(__dirname,'..','prompt-editor.html'),'utf8');
  ok("the prompt editor lists it with the other decision prompts", /\{name:"Arrival gate",label:"[^"]+",keys:\["x_arrival_gate"\]\}/.test(pe));

  ok("no page errors", errs.length===0?true:errs.join(" | "));
  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close();
  process.exit(fail?1:0);
})();
