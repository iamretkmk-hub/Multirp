/* v148.6 — NARRATOR LINES IN THE STORY LANGUAGE, WITH A SUBJECT AND A REASON; NO GENERIC CLOTHING STATES.
   From the user's real log (a Turkish story):
     "Haritaya son bir kez bakıp kiosktan ayrıldı, … banka doğru yürüdü."        — a move beat that names nobody
     "— Emre moves to the Shaded Rest Stop with bench, with Duygu Akbaba —"       — hard-coded English, no reason
   right after Duygu had said "Bari şuradaki banka kadar gidelim, daha fazla değil." And at "Lakeside Running
   Trail — Shaded Rest Stop with bench" she wore a swimsuit and he swim shorts: the generic "swim" outfit,
   picked because the place's name contains "lake". Those generic outfits are gone.
   Run: node tests/narration-clothing.browser.js */
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
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x||c).slice(0,700));} };

  const DUYGU='*Çaylardan birini alıyorum, yürüyüş yoluna doğru birkaç adım atıyorum.* "Bari şuradaki banka kadar gidelim, daha fazla değil."';
  const SUBJECTLESS="Haritaya son bir kez bakıp kiosktan ayrıldı, karton bardaktaki çayı iki eliyle kavrayarak ağaçların gölgesine düşen banka doğru yürüdü.";
  /* A scene at the trail: Emre and Duygu at the kiosk; Sami, in the back area, said something about going
     home that neither of them heard (another conversation — it must never become their reason). */
  const setup=(lang)=>pg.evaluate(([lang,DUYGU])=>{
    const uni=state.universes[0];
    uni.locations=[
      {id:"L_trail",name:"Lakeside Running Trail",description:"A trail around the lake.",residents:[],
        sublocations:[{id:"t_kiosk",name:"Trailhead Kiosk",entrance:true},{id:"t_bench",name:"Shaded Rest Stop with bench"},{id:"t_back",name:"Boathouse"}]},
      {id:"L_canteen",name:"Worker Canteen",description:"A canteen.",residents:[],sublocations:[{id:"c1",name:"Entrance",entrance:true}]},
      {id:"L_home",name:"Duygu's Flat",description:"A flat.",residents:["p_duygu"],sublocations:[{id:"h1",name:"Entrance",entrance:true}]}
    ];
    const mk=(id,n,extra)=>Object.assign({id,name:n,universeId:uni.id,instructions:"x",personality:"x",backstory:"x",style:"x",goals:"",look:{raw:"x"}},extra||{});
    state.personas=(state.personas||[]).filter(p=>!/^p_/.test(p.id)).concat([
      mk("p_duygu","Duygu Akbaba"),mk("p_sami","Sami"),mk("p_berker","Berker")]);
    state.curUniverse=uni.id; state.user="Emre"; state.storyLang=lang; state.key="test";
    const c=curChat(); c.universeId=uni.id; c.locationId="L_trail"; c.location="Lakeside Running Trail";
    // Sami spoke in the boathouse and has since gone; only Duygu is here with Emre
    c.presentIds=["p_duygu"]; c.subId="t_kiosk"; c.subSelf=false; c.subPos={p_duygu:"t_kiosk",p_sami:"t_back"};
    c.gameDay=2; c.period="Midday"; c.timeOfDay="Midday"; c._presenceSeenMid=null; c._presenceLastRun=0; c.outfitHeld={}; c.wearing={};
    c.messages=[
      {mid:"m1",role:"user",content:'"Tamam, kısa tutarız." *Çaylar hazırlanırken yürüyüş yoluna yöneliyorum.*',present:["p_duygu"]},
      {mid:"m2",role:"assistant",speaker:"Duygu Akbaba",speakerId:"p_duygu",content:DUYGU,present:["p_duygu"]},
      {mid:"m3",role:"assistant",speaker:"Sami",speakerId:"p_sami",content:'"Hadi eve gidelim, SAMI_PRIVATE burada sıkıldım."',present:["p_sami"]}];
    return true;
  },[lang,DUYGU]);
  // Stub the model: the presence tracker moves Duygu to the bench; the move narrator answers `beat`.
  const runPresence=(beat)=>pg.evaluate(async(beat)=>{
    const c=curChat(); const real=window.chatCompletion; const sent={};
    window.chatCompletion=async(m,mo,o)=>{ const d=(o&&o.dbg)||"";
      if(/Presence tracker/.test(d)) return '{"move":{"Duygu Akbaba":"Shaded Rest Stop with bench"},"enter":[],"exit":[]}';
      if(/Character move/.test(d)){ sent.move=m.map(x=>x.content).join("\n"); return beat; }
      return ""; };
    const n0=c.messages.length;
    try{ await runPresenceTracker(c); } finally { window.chatCompletion=real; }
    return {notes:c.messages.slice(n0).map(x=>x.content), sent:sent.move||"", sub:c.subId};
  },beat);

  console.log("\n[1. a move beat that names nobody gets its subject — Turkish story]");
  await setup("tr");
  const T1=await runPresence(SUBJECTLESS);
  ok("the subject-less beat is given the mover's name, in natural Turkish order",
     T1.notes[0]==="Duygu Akbaba haritaya son bir kez bakıp kiosktan ayrıldı, karton bardaktaki çayı iki eliyle kavrayarak ağaçların gölgesine düşen banka doğru yürüdü.", JSON.stringify(T1.notes));
  ok("the move narrator was told to name her, and handed her own line as the reason", /The first sentence names Duygu Akbaba/.test(T1.sent)&&/Bari şuradaki banka kadar gidelim/.test(T1.sent), T1.sent.slice(-900));
  ok("…and never another conversation (Sami's line in the boathouse she was not in)", !/SAMI_PRIVATE/.test(T1.sent), T1.sent.slice(-900));
  ok("the player follows her, and that note is in Turkish, with who he is with",
     T1.notes[1]==="— Emre, Duygu Akbaba ile birlikte şuraya geçti: Shaded Rest Stop with bench —"&&T1.sub==="t_bench", JSON.stringify(T1));
  ok("no English stage direction anywhere in it", !T1.notes.some(n=>/moves to the|steps away|, with /.test(n)), JSON.stringify(T1.notes));

  await setup("tr");
  const T2=await runPresence("");
  ok("when the narrator fails, the terse note is Turkish and carries her own reason",
     T2.notes[0]==='— Duygu Akbaba şuraya geçti: Shaded Rest Stop with bench. Duygu Akbaba "Bari şuradaki banka kadar gidelim, daha fazla değil" demişti. —', JSON.stringify(T2.notes));
  await setup("tr");
  const T3=await runPresence("O, çayını alıp banka doğru yürüdü.");
  ok("a Turkish beat that opens with 'O' has the pronoun replaced by her name", T3.notes[0]==="Duygu Akbaba çayını alıp banka doğru yürüdü.", T3.notes[0]);

  console.log("\n[2. the same scene in an English story]");
  await setup("en");
  const E1=await runPresence("She takes her tea and walks over to the bench.");
  ok("a pronoun subject is replaced by the name", E1.notes[0]==="Duygu Akbaba takes her tea and walks over to the bench.", E1.notes[0]);
  ok("the player's note is in English", E1.notes[1]==="— Emre moves to the Shaded Rest Stop with bench, with Duygu Akbaba —", JSON.stringify(E1.notes));
  await setup("en");
  const E2=await runPresence("Takes one last look at the map and walks to the bench.");
  ok("an English beat with no subject and no pronoun falls back to the localized note, with the reason",
     E2.notes[0]==='— Duygu Akbaba steps away to the Shaded Rest Stop with bench. Duygu Akbaba had said: "Bari şuradaki banka kadar gidelim, daha fazla değil" —', JSON.stringify(E2.notes));
  await setup("de");
  const D1=await runPresence("");
  ok("German too", D1.notes[0].startsWith("— Duygu Akbaba geht hinüber: Shaded Rest Stop with bench. Duygu Akbaba hatte gesagt: „Bari")
     && D1.notes[1]==="— Emre geht mit Duygu Akbaba hinüber: Shaded Rest Stop with bench —", JSON.stringify(D1.notes));

  console.log("\n[3. several movers: each must be named, or the notes stand in]");
  const G=await pg.evaluate(async()=>{
    state.storyLang="tr";
    const c=curChat(); const P=id=>state.personas.find(p=>p.id===id);
    const real=window.chatCompletion; const out={};
    try{
      window.chatCompletion=async()=>"İkisi de banka doğru yürüdü.";
      out.none=await narrateCharMoveGroup(c,[{p:P("p_duygu"),toName:"x"},{p:P("p_sami"),toName:"x"}],{dir:"submove"});
      window.chatCompletion=async()=>"Duygu banka yürüdü, Sami ise kioskta kaldı ve sonra peşinden gitti.";
      out.both=await narrateCharMoveGroup(c,[{p:P("p_duygu"),toName:"x"},{p:P("p_sami"),toName:"x"}],{dir:"submove"});
    } finally { window.chatCompletion=real; }
    out.list=[_nameList(["Sami"]),_nameList(["Sami","Berker"]),_nameList(["A","B","C"])];
    state.storyLang="en"; out.listEn=_nameList(["Sami","Berker"]); state.storyLang="tr";
    return out;
  });
  ok("a group beat that names nobody is dropped (the per-person notes name them)", G.none==="", G.none);
  ok("a group beat that names each mover (first names count) is kept", /^Duygu banka/.test(G.both), G.both);
  ok("names are joined in the story language", G.list.join("|")==="Sami|Sami ve Berker|A, B ve C"&&G.listEn==="Sami and Berker", JSON.stringify(G));

  console.log("\n[4. the player's own moves: Move-to-area, and travel]");
  await setup("tr");
  const M=await pg.evaluate(()=>{
    const c=curChat();
    c.presentIds=["p_duygu","p_sami","p_berker"]; c.subPos={p_duygu:"t_kiosk",p_sami:"t_kiosk",p_berker:"t_kiosk"};
    c.messages.push({mid:"m4",role:"user",content:'"Hadi şu banka gidelim, gölgede oturalım."',present:["p_duygu","p_sami","p_berker"]});
    const n0=c.messages.length;
    moveToSub("t_bench",["p_duygu","p_berker"]);
    const note=c.messages.slice(n0)[0].content;
    // with nothing said about going anywhere since that move, no reason is made up (the bench line was spent on it)
    c.messages.push({mid:"m5",role:"user",content:'"Nasılsın?"',present:["p_duygu"]});
    const n1=c.messages.length;
    moveToSub("t_kiosk",[]);
    return {note,plain:c.messages.slice(n1)[0].content};
  });
  ok("Move to area: Turkish, both companions joined with 've', and the player's own reason",
     M.note==='— Emre, Duygu Akbaba ve Berker ile birlikte şuraya geçti: Shaded Rest Stop with bench. Emre "Hadi şu banka gidelim, gölgede oturalım" demişti. —', M.note);
  ok("…and with no line about going anywhere, no reason is invented", M.plain==="— Emre şuraya geçti: Trailhead Kiosk —", M.plain);

  const travel=(lang,beat)=>pg.evaluate(async([lang,beat])=>{
    state.storyLang=lang; state.mem=false;
    const c=curChat(); c.locationId="L_trail"; c.location="Lakeside Running Trail"; c.subId="t_kiosk";
    c.presentIds=["p_duygu","p_sami","p_berker"]; c.subPos={p_duygu:"t_kiosk",p_sami:"t_kiosk",p_berker:"t_kiosk"};
    c.messages.push({mid:"tv"+Math.random(),role:"user",content:'"Ben kantine gidiyorum, EMRE_OWN karnım aç."',present:["p_duygu"]});
    c.messages.push({mid:"tw"+Math.random(),role:"assistant",speaker:"Duygu Akbaba",speakerId:"p_duygu",content:'"DUYGU_SAID Tamam, git bakalım."',present:["p_duygu"]});
    const real=window.chatCompletion; let sent="";
    window.chatCompletion=async(m,mo,o)=>{ if(/Travel narration/.test((o&&o.dbg)||"")){ sent=m.map(x=>x.content).join("\n"); return beat; } return ""; };
    const n0=c.messages.length;
    try{ await travelTo("L_canteen",["p_sami","p_berker"]); } finally { window.chatCompletion=real; }
    const tb=c.messages.slice(n0).find(x=>x.travelBeat);
    return {beat:tb?tb.content:"(none)",sent};
  },[lang,beat]);
  const V1=await travel("tr","Kiosktan ayrılıp kantine doğru yürüdü, öğle güneşi sırtını ısıtıyordu.");
  ok("a Turkish travel beat that names nobody gets the traveller's name", V1.beat==="Emre kiosktan ayrılıp kantine doğru yürüdü, öğle güneşi sırtını ısıtıyordu.", V1.beat);
  ok("the travel narrator is told to name him and why he is going — from his own words only", /The first sentence names Emre/.test(V1.sent)&&/EMRE_OWN/.test(V1.sent)&&!/DUYGU_SAID/.test(V1.sent), V1.sent.slice(-700));
  await setup("en");
  const V2=await travel("en","Leaves the kiosk behind and walks to the canteen.");
  ok("an English travel beat that cannot be given a subject becomes the localized note",
     V2.beat==="— Emre moves to the Worker Canteen, with Sami and Berker —", V2.beat);

  console.log("\n[5. the code's other narrator notes are in the story language]");
  const L=await pg.evaluate(()=>{
    const src=String(resolveActiveEvent)+String(narrateMeetingOutcome);
    state.storyLang="tr";
    const k={away:fillTpl(blkTpl("narr_move_away"),{char:"Sami",area:"Boathouse"}),char:fillTpl(blkTpl("narr_move_char"),{char:"Sami",area:"Boathouse"})};
    // a player's own edit of a fragment is theirs, and is used as written
    const was=state.blockTpls; state.blockTpls=Object.assign({},was||{},{narr_move_away:"— {{char}} → {{area}} —"});
    k.edited=fillTpl(blkTpl("narr_move_away"),{char:"Sami",area:"Boathouse"});
    // an override that is only the English default word for word still answers in the story language
    state.blockTpls.narr_move_away=BLOCK_TPL_DEFAULTS.narr_move_away;
    k.stale=fillTpl(blkTpl("narr_move_away"),{char:"Sami",area:"Boathouse"});
    state.blockTpls=was;
    return {src,k};
  });
  ok("the event-passes and no-show fallbacks go through sLine", /sLine\(\{en:"the event passes",tr:/.test(L.src)&&/tr:`\$\{_u\} bekledi/.test(L.src), "still English");
  ok("the character notes are Turkish", L.k.away==="— Sami şuraya geçti: Boathouse —"&&L.k.char==="— Sami şuraya geldi: Boathouse —", JSON.stringify(L.k));
  ok("a player's own wording is used as written; an untouched English copy is not", L.k.edited==="— Sami → Boathouse —"&&L.k.stale==="— Sami şuraya geçti: Boathouse —", JSON.stringify(L.k));

  console.log("\n[6. the shipped prompts ask for a subject and a reason]");
  const P=await pg.evaluate(()=>({cm:DEFAULT_CHAR_MOVE,tr:DEFAULT_TRAVEL,cur:up("charMovePrompt")}));
  ok("character move: the first sentence names who moves", /The FIRST sentence NAMES who moves, by name, as its subject/.test(P.cm)&&!/no names in a "Name:" prefix/.test(P.cm), P.cm.slice(-400));
  ok("character move: the reason, when given, is carried in the movement", /why they are moving now when you are told/.test(P.cm));
  ok("travel: the first sentence names {{user}}, and carries why they are going", /The FIRST sentence NAMES \{\{user\}\}/.test(P.tr)&&/why \{\{user\}\} is going, carry it/.test(P.tr), P.tr.slice(-400));

  console.log("\n[7. no generic clothing state is ever chosen]");
  const C=await pg.evaluate(()=>{
    state.storyLang="tr";
    const uni=state.universes[0];
    uni.locations=uni.locations.concat([
      {id:"L_beach",name:"Beach",sublocations:[{id:"b1",name:"Entrance"},{id:"b2",name:"Sea"}]},
      {id:"L_pool",name:"Pool",sublocations:[{id:"p1",name:"Entrance"}]},
      {id:"L_gym",name:"Gym",sublocations:[{id:"g1",name:"Entrance"}]},
      {id:"L_bed",name:"Bedroom Suite",sublocations:[{id:"r1",name:"Bedroom"}]}]);
    const act={swim:"You wear a matte black high-cut one-piece swimsuit.",sport:"You wear yoga pants.",sleep:"You wear a silk nightie.",intimate:"You wear red lace."};
    const withE={id:"p_e",name:"E",wardrobe:"",outfits:{byLoc:{L_beach:"You wear a white linen sundress.",L_pool:"You wear a navy racing swimsuit.",L_gym:"You wear a grey track suit.",L_bed:"You wear cotton pyjamas.",
      L_trail:"You wear black running tights and a light windbreaker."},home:{},userHome:{},activity:act}};
    const none={id:"p_n",name:"N",wardrobe:"jeans and a grey tee",outfits:{byLoc:{L_canteen:"x"},home:{},userHome:{},activity:act}};
    const homeOnly={id:"p_duygu",name:"Duygu Akbaba",wardrobe:"",outfits:{byLoc:{},home:{Midday:"You wear a soft cotton house dress.",Night:"You wear flannel pyjamas."},userHome:{},activity:act}};
    const chat={id:"cc",universeId:uni.id,gameDay:1,messages:[],rel:{},presentIds:["p_e","p_n","p_duygu"],subPos:{},period:"Midday",timeOfDay:"Midday"};
    const at=(p,loc,sub,per)=>{ chat.locationId=loc; chat.subPos[p.id]=sub; chat.period=per||"Midday"; chat.timeOfDay=chat.period; chat.outfitHeld={}; return currentOutfit(p,chat); };
    const r={
      trail:at(withE,"L_trail","t_bench"), beach:at(withE,"L_beach","b2"), pool:at(withE,"L_pool","p1"), gym:at(withE,"L_gym","g1"), bed:at(withE,"L_bed","r1","Night"),
      noneBeach:at(none,"L_beach","b2"), noneTrail:at(none,"L_trail","t_bench"),
      // her home with only the household there (v148.6: guests keep the evening clothes on — see section 9)
      homeMid:(()=>{ chat.presentIds=["p_duygu"]; uni.playerHomeLocId="L_home"; return at(homeOnly,"L_home","h1"); })(),
      homeNight:at(homeOnly,"L_home","h1","Night"),
      _reset:(()=>{ chat.presentIds=["p_e","p_n","p_duygu"]; delete uni.playerHomeLocId; return null; })(),
      hasOnlyAct:hasOutfits({outfits:{activity:act}}),
      missing:missingOutfitSlots(withE,uni).filter(x=>/activity/.test(x)),
      slots:Object.keys(outfitSlots(withE,uni))};
    // a hold saved before this build from an activity outfit (the reported swimsuit) is not kept
    chat.locationId="L_trail"; chat.subPos.p_e="t_bench"; chat.period="Midday";
    chat.outfitHeld={p_e:{text:act.swim,why:"activity:swim",day:1,loc:"L_trail",atHome:false}};
    r.staleHold=currentOutfit(withE,chat);
    chat.outfitHeld={p_n:{text:act.swim,why:"activity:swim",day:1,loc:"L_trail",atHome:false}};
    r.staleHoldNone=currentOutfit(none,chat); r.staleDropped=!chat.outfitHeld.p_n;
    return r;
  });
  const bad=Object.entries(C).filter(([k,v])=>v&&v.why&&/^activity/.test(v.why)).map(([k])=>k);
  ok("no rule ever answers 'activity:…'", bad.length===0, bad.join(", "));
  ok("the running trail wears the trail's own outfit (the reported swimsuit is gone)", C.trail.text==="You wear black running tights and a light windbreaker."&&C.trail.why==="location", JSON.stringify(C.trail));
  ok("Beach / Pool / Gym / Bedroom with their own entries use those entries",
     C.beach.text==="You wear a white linen sundress."&&C.pool.text==="You wear a navy racing swimsuit."&&C.gym.text==="You wear a grey track suit."&&C.bed.text==="You wear cotton pyjamas.", JSON.stringify(C));
  ok("with no entry they fall back to the wardrobe, never a swimsuit", C.noneBeach.why==="wardrobe"&&C.noneTrail.why==="wardrobe"&&!/swim/.test(C.noneBeach.text), JSON.stringify([C.noneBeach,C.noneTrail]));
  ok("at home, the home's hour (Night is what they sleep in)", C.homeMid.text==="You wear a soft cotton house dress."&&C.homeNight.why==="home:Night"&&/flannel/.test(C.homeNight.text), JSON.stringify([C.homeMid,C.homeNight]));
  ok("an old activity entry alone is no table, and no slot asks for one", C.hasOnlyAct===false&&C.missing.length===0&&!C.slots.includes("activities"), JSON.stringify(C));
  ok("a swimsuit held from before this build is not kept", C.staleHold.why==="location"&&!/swimsuit/.test(C.staleHold.text)&&C.staleHoldNone.why==="wardrobe"&&C.staleDropped===true, JSON.stringify([C.staleHold,C.staleHoldNone]));

  const ED=await pg.evaluate(async()=>{
    const uni=state.universes[0];
    editingPersona={id:"p_ed",name:"Ed",universeId:uni.id,outfits:{byLoc:{},home:{},userHome:{},activity:{swim:"KEEP_ME"}}};
    let host=document.getElementById('peOutfits'); if(!host){ host=document.createElement('div'); host.id="peOutfits"; document.body.appendChild(host); }
    renderOutfitEditor();
    const rows=[...host.querySelectorAll('input[data-outfit]')].map(i=>i.getAttribute('data-outfit'));
    const html=host.innerHTML;
    const real=window.chatCompletion; let sys="",data="";
    window.chatCompletion=async(m)=>{ sys=m.map(x=>x.content).join("\n"); data=String(((m||[]).filter(x=>x&&x.role==="user").pop()||{}).content||"");
      return JSON.stringify({byLoc:{L_trail:"You wear running tights."},activity:{swim:"a bikini",sport:"yoga pants"}}); };
    try{ await generateOutfits(true,""); } finally { window.chatCompletion=real; }
    return {rows,cant:/Whatever the place cannot say/.test(html),sys,data,o:editingPersona.outfits,def:X_ENGINE_PROMPTS.x_outfits_generator.def};
  });
  ok("the outfit editor has no activity rows", ED.rows.length>0&&!ED.rows.some(r=>/^activity/.test(r))&&ED.cant===false, ED.rows.join(","));
  ok("the generator asks for no activity outfit, and lists each place's areas", !/"activity"/.test(ED.def)&&!/"swim"/.test(ED.def)&&/areas: Trailhead Kiosk, Shaded Rest Stop with bench, Boathouse/.test(ED.data), ED.data.slice(0,600));
  ok("the generator's one entry covers a place's areas (no generic layer)", /There is no separate outfit for swimming, sport or sleep/.test(ED.def)&&/a trail by a lake is still a trail/.test(ED.def));
  ok("an activity the model returns anyway is not written; the stored one is left alone", ED.o.byLoc.L_trail==="You wear running tights."&&ED.o.activity&&ED.o.activity.swim==="KEEP_ME"&&!ED.o.activity.sport, JSON.stringify(ED.o));

  console.log("\n[9. every place has its own clothes: travel drops what was held; the host is not in bed with guests]");
  const H=await pg.evaluate(async()=>{
    const uni=state.universes[0]; state.mem=false; state.storyLang="tr";
    uni.locations=[
      {id:"L_cafe",name:"Vanadium Cafe",residents:[],sublocations:[{id:"c1",name:"Entrance",entrance:true},{id:"c2",name:"Terrace"}]},
      {id:"L_plant",name:"Steel Plant",residents:[],sublocations:[{id:"pl1",name:"Entrance",entrance:true}]},
      {id:"L_emre",name:"Emre's House",residents:[],sublocations:[{id:"e1",name:"Entrance",entrance:true},{id:"e2",name:"Garden Gate"}]}];
    uni.playerHomeLocId="L_emre";
    uni.userOutfits={byLoc:{L_cafe:"You wear a navy jacket over a light blue oxford.",L_plant:"You wear a hard hat and a hi-vis vest over your shirt."},
      home:{Evening:"You wear a dark green linen shirt and chinos.",Night:"You sleep in nothing but grey boxer briefs."}};
    const mk=(id,n,o)=>({id,name:n,universeId:uni.id,instructions:"x",personality:"x",backstory:"x",style:"x",goals:"",look:{raw:"x"},outfits:o});
    state.personas=(state.personas||[]).filter(p=>!/^h_/.test(p.id)).concat([
      mk("h_sami","Sami",{byLoc:{L_cafe:"You wear a cream cashmere crewneck and navy shorts.",L_plant:"You wear navy coveralls and steel-toe boots.",L_emre:"You wear a dark shirt."},home:{},userHome:{Evening:"You wear a dark shirt."}})]);
    state.curUniverse=uni.id; state.user="Emre";
    const c=curChat(); c.universeId=uni.id; c.locationId="L_cafe"; c.location="Vanadium Cafe"; c.subId="c1"; c.subPos={h_sami:"c1"};
    c.presentIds=["h_sami"]; c.gameDay=1; c.period="Midday"; c.timeOfDay="Midday"; c.outfitHeld={}; c.wearing={}; c.messages=[];
    const S=()=>state.personas.find(p=>p.id==="h_sami"), U=()=>playerOutfitHolder(c);
    const r={};
    r.cafeSami=currentOutfit(S(),c).text;
    setWearingOverride(c,"__user__","light blue oxford, sleeves rolled; the navy jacket on the back of the chair");
    r.cafeEmre=currentOutfit(U(),c).text;
    // a move between areas of the same place keeps both
    moveToSub("c2",["h_sami"]);
    r.subEmre=currentOutfit(U(),c).text; r.subSami=currentOutfit(S(),c).text;
    const real=window.chatCompletion; window.chatCompletion=async()=>"";
    try{ await travelTo("L_plant",["h_sami"]); } finally { window.chatCompletion=real; }
    if(!c.presentIds.includes("h_sami")) c.presentIds.push("h_sami");
    r.plantSami=currentOutfit(S(),c); r.plantEmre=currentOutfit(U(),c);
    // the host at home at Night: guests present → the evening clothes stay on; alone → the Night slot
    c.locationId="L_emre"; c.location="Emre's House"; c.subId="e2"; c.subPos={h_sami:"e2"}; c.presentIds=["h_sami"];
    c.gameDay=2; c.period="Evening"; c.timeOfDay="Evening"; c.outfitHeld={}; c.wearing={};
    r.hostEvening=currentOutfit(U(),c);
    c.period="Night"; c.timeOfDay="Night";
    r.hostNightGuests=currentOutfit(U(),c);
    c.presentIds=[];
    r.hostNightAlone=currentOutfit(U(),c);
    return r;
  });
  ok("inside one place (moving to another area) the held outfit and the scene's change stay",
     /jacket on the back of the chair/.test(H.subEmre)&&/cashmere/.test(H.subSami), JSON.stringify(H));
  ok("travel to another place: each person takes the destination's outfit (not the café's cashmere)",
     /cashmere/.test(H.cafeSami)&&/navy coveralls/.test(H.plantSami.text)&&H.plantSami.why==="location", JSON.stringify(H.plantSami));
  ok("…and the café's scene change ('jacket on the back of the chair') does not come along",
     /hi-vis vest/.test(H.plantEmre.text)&&!/chair/.test(H.plantEmre.text), JSON.stringify(H.plantEmre));
  ok("the host at the garden gate with a guest at Night keeps the evening clothes (no boxer briefs)",
     /dark green linen/.test(H.hostEvening.text)&&H.hostNightGuests.text===H.hostEvening.text&&!/boxer/.test(H.hostNightGuests.text), JSON.stringify([H.hostEvening,H.hostNightGuests]));
  ok("once the guests have gone, the home's Night slot applies", /boxer briefs/.test(H.hostNightAlone.text)&&H.hostNightAlone.why==="home:Night", JSON.stringify(H.hostNightAlone));

  console.log("\n[8. stored copies of the changed prompts are refreshed in place, edits kept]");
  const RF=await pg.evaluate(()=>{
    // a pre-v148.5 copy ("in Turkish") with a player's own addition: both refreshes chain onto it
    const oldCm=DEFAULT_CHAR_MOVE
      .replace("and why they are moving now when you are told (one brief clause carried in the movement itself — never a report of what was said, and never a reason you were not given).","and — lightly — why (let the reason color the movement; do not explain it as a report).")
      .replace(/Output ONLY the narration, 1-2 short sentences[^\n]*/,'Output ONLY the narration, 1-2 short sentences, third person, in Turkish. No JSON, no labels, no names in a "Name:" prefix.')+"\nMY OWN EDIT.";
    const oldTr=DEFAULT_TRAVEL.replace(/Output ONLY the narration text[^\n]*/,"Output ONLY the narration text, 2-4 sentences, third person. No JSON, no labels, no dialogue, in Turkish.")+"\nMY TRAVEL EDIT.";
    const oldGen=X_ENGINE_PROMPTS.x_outfits_generator.def
      .replace('"Night": "..." }\n}','"Night": "..." },\n  "activity": { "swim": "...", "sport": "...", "sleep": "...", "intimate": "..." }\n}')
      .replace(/- Each "byLoc" entry dresses them for that WHOLE place[^\n]*/,'- "activity" covers what a place alone cannot say: "swim" for the sea or a pool, "sport" for exercise, "sleep" for what they actually sleep in, "intimate" for what is seen only by someone they are undressed with. Write all four.')+"\nGEN EDIT.";
    store.setRaw(K.charMovePrompt,oldCm); store.setRaw(K.travelPrompt,oldTr); store.setRaw(K.x_outfits_generator,oldGen);
    return oldCm!==DEFAULT_CHAR_MOVE&&/"activity"/.test(oldGen);
  });
  await pg.reload(); await pg.waitForTimeout(2400);
  const RF2=await pg.evaluate(()=>({cm:state.charMovePrompt,tr:state.travelPrompt,gen:state.x_outfits_generator}));
  ok("the character-move copy gets the naming and reason sentences, keeping the edit",
     RF===true&&/The FIRST sentence NAMES who moves/.test(RF2.cm)&&/why they are moving now when you are told/.test(RF2.cm)&&/MY OWN EDIT\./.test(RF2.cm)&&!/in Turkish/.test(RF2.cm), RF2.cm.slice(-500));
  ok("the travel copy too", /The FIRST sentence NAMES \{\{user\}\}/.test(RF2.tr)&&/MY TRAVEL EDIT\./.test(RF2.tr), RF2.tr.slice(-400));
  ok("the outfit generator copy loses the activity slot, keeping the edit", !/"activity"/.test(RF2.gen)&&/There is no separate outfit for swimming/.test(RF2.gen)&&/GEN EDIT\./.test(RF2.gen), RF2.gen.slice(-600));

  ok("no page errors", errs.length===0?true:errs.join(" | "));
  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close(); process.exit(fail?1:0);
})();
