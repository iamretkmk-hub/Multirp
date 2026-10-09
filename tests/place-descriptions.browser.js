/* v150.81 — WHAT A PLACE LOOKS LIKE, AND WHO IS AROUND.
   Asked: "Each sub-location gets a new description field, used for image generation and roleplay. For image generation ONLY
   that field is sent — no location or sub-location names. Add a knowledge field for the main location, sent to the roleplay,
   never to images. The other sub-locations' descriptions are not given. Remove the 'people can hear' warning; vary it by how
   many people are around: crowded / a couple of people far in the distance / no other people nearby. When giving the
   sub-locations to the LLM just write their names; a private place nobody is in says it is empty." And: "make sure create
   with LLM fills those fields as well."
   Checked:
     1. the editor: a place's knowledge and each area's look are edited, saved, persisted, and kept by a backup round-trip
        and a universes export / import;
     2. pictures: the image prompt writer (and the scene selector) get the current area's look and nothing else — no place
        name, no area name, no knowledge, no other area's look or description; an area with no look falls back to its old
        description; a place with no areas of its own gives its description; a selfie the same;
     3. the reply, on every path: the place name, its knowledge, the area name and its look; the other areas by name only,
        an empty private one "— empty, no one is there"; nothing says who can hear, how exposed or that talk gets out; the
        text path describes the texter's own place the same way;
     4. who is around: crowded / a couple of people far in the distance / no other people nearby, by the exposure bands
        (none = 0, low under 0.45, high from 0.45; a public place is never "none");
     5. the Gamemaster's and the Scene Writer's area list: names, the empty mark, who is around — no privacy notes;
     6. the place builders and the universe generator ask for "knowledge" and "scene", and what they answer lands in the
        stored place and its areas, on every creation path;
     7. the upgrades: a stored generator prompt, a stored reply piece and a saved fragment are upgraded only while they are
        still exactly the v150.80 default; an edited one stays.
   Run: node tests/place-descriptions.browser.js   (needs playwright; see tests/README.md) */
const {chromium}=require('playwright');
const path=require('path');
(async()=>{
  const b=await chromium.launch({executablePath:process.env.SM_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage({viewport:{width:412,height:915}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  const URL='file://'+path.resolve(__dirname,'..','index.html');
  const boot=async()=>{ await pg.goto(URL); await pg.waitForTimeout(2400);
    await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
    await pg.waitForTimeout(800); };
  await boot();
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x===undefined?c:x).slice(0,1400));} };

  /* the world: a flat (a home) with three areas, a café (public) with two, a bar with only its entrance */
  const SETUP=()=>{
    const uni=state.universes[0];
    uni.locations=[
      {id:"L_flat",name:"Ayla's Flat",type:"home",residents:["p_a"],description:"FLAT-DESC a two-storey flat above a bakery.",
       knowledge:"FLAT-KNOW the bakery below opens at five and the whole building smells of bread by six.",
       sublocations:[{id:"s_ent",name:"Entrance",entrance:true,scene:"ENT-LOOK coat hooks and a cracked mirror."},
         {id:"s_kit",name:"Kitchen",scene:"KIT-LOOK copper pans over a tiled counter, a window onto the street.",description:"KIT-OLD an old kitchen."},
         {id:"s_bal",name:"Balcony",description:"BAL-DESC an iron railing and two plastic chairs."}]},
      {id:"L_cafe",name:"Harbour Cafe",type:"poi",gossipChance:0.3,description:"CAFE-DESC a glass-fronted café on the quay.",
       knowledge:"CAFE-KNOW the fishermen take the back table at dawn.",
       sublocations:[{id:"c_ent",name:"Entrance",entrance:true},{id:"c_ter",name:"Terrace",scene:"TER-LOOK wooden tables under a striped awning."}]},
      {id:"L_bar",name:"Rope Bar",type:"poi",gossipChance:0.6,description:"BAR-DESC a low room of dark wood and brass.",sublocations:[{id:"b_ent",name:"Entrance",entrance:true}]}];
    state.personas=[
      {id:"p_a",name:"Ayla",universeId:uni.id,personality:"Ayla is sharp.",look:{subject:"Woman"},refs:["data:A"],instructions:"x",style:"Short."},
      {id:"p_b",name:"Berk",universeId:uni.id,personality:"Berk is loud.",look:{subject:"Man"},refs:["data:B"],instructions:"x",style:"Loud."}];
    Object.assign(state,{user:"Emre",key:"k",autoImg:false,userLook:"",userSubject:"Man",curUniverse:uni.id,payloadTplOn:false,fragments:null,
      autoSpeak:false,narrMode:false,trackOn:false,memory:[],relOn:false,gossip:[],blockTpls:{}});
    store.setRaw(K.fragAdds,FRAG_SHIPPED_ADDS.map(a=>a.key).join(",")); _fragMigratedFor=null;
    const c=curChat(); ["_heatBeat","activeEvent","watchingNow","dayLog"].forEach(k=>{ delete c[k]; });
    Object.assign(c,{universeId:uni.id,locationId:"L_flat",location:"Ayla's Flat",subId:"s_kit",presentIds:["p_a","p_b"],subPos:{p_a:"s_kit",p_b:"s_bal"},
      emo:{},promises:[],wearing:{},calendar:[],intents:[],rel:{},gameDay:2,period:"Evening",
      messages:[{mid:"u1",role:"user",content:'"Hi."'},{mid:"a1",role:"assistant",speaker:"Ayla",speakerId:"p_a",content:'"Hello."'},{mid:"u2",role:"user",content:'"So?"'}]});
    return c;
  };
  const defineSetup=()=>pg.evaluate(`window.__SETUP=${SETUP.toString()};`);
  await defineSetup();

  /* ---------------------------------------------------------------- 1. the editor */
  console.log("\n[1. the editor: the knowledge and each area's look, saved and kept]");
  const E=await pg.evaluate(async()=>{ __SETUP();
    const u=state.universes[0]; editingUniverse=u; _ueLocs=u.locations.map(l=>JSON.parse(JSON.stringify(l)));
    editLocation(0);
    const r={};
    const kn=document.getElementById('leKnowledge'), subs=[...document.querySelectorAll('#leSubs .leSubScene')];
    {const tx=document.getElementById('locEditModal').textContent;
     r.labels=[/What people here know about this place — roleplay only, never pictures/.test(tx),/What it looks like — sent to pictures and the roleplay/.test(document.getElementById('locEditModal').innerHTML+[...document.querySelectorAll('#locEditModal [title],#locEditModal [data-help]')].map(x=>x.getAttribute('title')+" "+x.getAttribute('data-help')).join(" ")),
       subs.every(t=>t.getAttribute('aria-label')==="What it looks like — sent to pictures and the roleplay")].join();}
    r.loaded=kn.value===u.locations[0].knowledge&&subs.length===3&&subs[1].value===u.locations[0].sublocations[1].scene&&subs[2].value===""
      &&/Blank: its old description is used — BAL-DESC/.test(subs[2].placeholder);
    kn.value="EDIT-KNOW the landlord lives downstairs.";
    subs[2].value="EDIT-BAL a narrow balcony with geraniums."; subs[2].dispatchEvent(new Event('input'));
    subs[0].value=""; subs[0].dispatchEvent(new Event('input'));
    // a new area added after typing keeps what was typed (the list is drawn again)
    document.getElementById('leSubNew').value="Bathroom"; leAddSub();
    r.keptOnRedraw=[...document.querySelectorAll('#leSubs .leSubScene')][2].value==="EDIT-BAL a narrow balcony with geraniums.";
    const t=[...document.querySelectorAll('#leSubs .leSubScene')][3]; t.value="EDIT-BATH white tiles."; t.dispatchEvent(new Event('input'));
    saveLocationEdit();
    const L=_ueLocs[0];
    r.saved=L.knowledge==="EDIT-KNOW the landlord lives downstairs."&&L.sublocations[2].scene==="EDIT-BAL a narrow balcony with geraniums."
      &&!("scene" in L.sublocations[0])&&L.sublocations[3].name==="Bathroom"&&L.sublocations[3].scene==="EDIT-BATH white tiles."
      &&L.sublocations[1].description==="KIT-OLD an old kitchen.";
    // cancel does not save the knowledge
    editLocation(0); document.getElementById('leKnowledge').value="NOT SAVED"; closeModal('locEditModal');
    r.cancel=_ueLocs[0].knowledge==="EDIT-KNOW the landlord lives downstairs.";
    // the universe is saved with them
    u.locations=_ueLocs.slice(); persistUniverses(); editingUniverse=null;
    return r; });
  ok("the place's knowledge and each area's look are in the editor, under the asked labels", E.labels==="true,true,true", JSON.stringify(E));
  ok("they open with what is stored; an area with only its old description shows it as the fallback", E.loaded===true, JSON.stringify(E));
  ok("an area's look survives the list being drawn again (an area added)", E.keptOnRedraw===true, JSON.stringify(E));
  ok("Save keeps the knowledge and every area's look; a cleared look is no field at all; the old description stays", E.saved===true, JSON.stringify(E));
  ok("Cancel keeps nothing", E.cancel===true, JSON.stringify(E));

  console.log("\n[1b. a backup round-trip and a universes export keep them]");
  await pg.waitForTimeout(800);
  const BK=await pg.evaluate(async()=>{ window.uiConfirm=async()=>true;
    const bun=JSON.parse(JSON.stringify(await buildBackup({noMedia:true,noKeys:true})));
    const s=JSON.stringify(bun.collections.universes);
    window.__bun=bun;
    return {inFile:s.indexOf("EDIT-KNOW the landlord")>=0&&s.indexOf("EDIT-BAL a narrow balcony")>=0&&s.indexOf("KIT-LOOK copper pans")>=0}; });
  ok("the backup file carries the knowledge and the looks", BK.inFile===true, JSON.stringify(BK));
  await pg.evaluate(async()=>{ const bun=window.__bun;
    const u=state.universes[0]; u.locations[0].knowledge="CHANGED"; u.locations[0].sublocations.forEach(s=>{ delete s.scene; });
    persistUniverses(); await new Promise(r=>setTimeout(r,600));
    await applyBackupBundle(bun); });
  await pg.waitForTimeout(3500);
  await pg.waitForLoadState('load'); await pg.waitForTimeout(1500); await defineSetup();
  const BK2=await pg.evaluate(()=>{ const L=(state.universes[0].locations||[]).find(l=>l.id==="L_flat")||{};
    return {know:L.knowledge,looks:(L.sublocations||[]).map(s=>s.scene||"")}; });
  ok("restored: the knowledge and every area's look come back", BK2.know==="EDIT-KNOW the landlord lives downstairs."
    &&BK2.looks[1]==="KIT-LOOK copper pans over a tiled counter, a window onto the street."&&BK2.looks[2]==="EDIT-BAL a narrow balcony with geraniums."&&BK2.looks[3]==="EDIT-BATH white tiles.", JSON.stringify(BK2));
  const UX=await pg.evaluate(async()=>{ window.uiChoose=async()=>"replace"; window.uiConfirm=async()=>true;
    let file=null; window._downloadJSON=(o)=>{ file=JSON.parse(JSON.stringify(o)); };
    await exportUniverses();
    const u=state.universes[0]; u.locations[0].knowledge="GONE"; delete u.locations[0].sublocations[1].scene;
    await importUniversesFile(file,{});
    const L=(state.universes||[]).map(x=>(x.locations||[]).find(l=>l.id==="L_flat")).find(Boolean)||{};
    return {file:!!file,know:L.knowledge,look:(L.sublocations||[])[1]&&L.sublocations[1].scene}; });
  ok("a universes export and import keeps them too", UX.file&&UX.know==="EDIT-KNOW the landlord lives downstairs."&&UX.look==="KIT-LOOK copper pans over a tiled counter, a window onto the street.", JSON.stringify(UX));

  /* ---------------------------------------------------------------- 2. pictures */
  console.log("\n[2. a picture gets what the area looks like, and nothing else]");
  await pg.evaluate(()=>{ __SETUP();
    window.personRefs=p=>(p&&p.refs)||[]; window.playerRefs=()=>["data:E"]; window._playerRefHolder=()=>({look:{subject:"Man"}});
    window.toDataUri=async u=>u; window.usesRefImage=()=>false; window.saveMsgImage=(m,u,cb)=>{ if(cb)cb(true); }; window.captureGalleryMedia=()=>{};
    window.__rule={id:"r_talk",label:"Talking",when:"x",cast:"solo",enabled:true,promptStyle:""};
    window.__route=""; window.pickRule=async(r,t)=>{ window.__route=t; return window.__rule; };
    window.genImageForRule=async()=>"data:image/png;base64,iVBORw0KGgo=";
    window.__calls=[];
    window.chatCompletion=async(messages,model,opts)=>{ const d=(opts&&opts.dbg)||""; __calls.push({d,text:messages.map(m=>m.content).join("\n")});
      if(/image prompt writer/i.test(d))return "a woman sets down a cup";
      if(/^Selfie writer/.test(d))return "I hold the phone up in the kitchen.";
      if(/Visual director/.test(d))return "0";
      return "{}"; };
  });
  const draw=async(setup)=>pg.evaluate(async(setup)=>{ (new Function(setup||""))();
    const c=curChat(); c.imgContBy={}; c.lastImgRuleBy={}; c.imgPromptBy={}; c.messages.push({mid:"m"+Date.now(),role:"assistant",speaker:"Ayla",speakerId:"p_a",content:"*She sets the cup down.*",present:c.presentIds.slice()});
    window.__calls=[]; const m=c.messages[c.messages.length-1];
    await illustrate(m.mid,m.content,true);
    const w=__calls.find(x=>/^Image prompt writer/.test(x.d));
    return {usr:w?w.text:"",route:window.__route}; },setup||"");
  const NOPE=/Ayla's Flat|Kitchen|Balcony|Entrance|FLAT-KNOW|EDIT-KNOW|ENT-LOOK|BAL-DESC|KIT-OLD|FLAT-DESC|knowledge/;
  const I1=await draw(`__SETUP();`);
  ok("the writer is given the kitchen's look", /KIT-LOOK copper pans over a tiled counter/.test(I1.usr), I1.usr.slice(0,1200));
  ok("and no place name, no area name, no knowledge, no other area's look or description",
     !NOPE.test(I1.usr), (I1.usr.match(NOPE)||[""])[0]+" … "+I1.usr.slice(0,900));
  ok("the scene selector reads the same place line", /LOCATION: KIT-LOOK/.test(I1.route)&&!NOPE.test(I1.route), I1.route.slice(0,400));
  const I2=await draw(`__SETUP(); state.universes[0].locations[0].sublocations[1].scene="";`);
  ok("an area with no look: its old description, and still nothing else", /KIT-OLD an old kitchen\./.test(I2.usr)&&!/KIT-LOOK|Ayla's Flat|FLAT-KNOW|FLAT-DESC/.test(I2.usr), I2.usr.slice(0,900));
  const I3=await draw(`__SETUP(); const c=curChat(); c.locationId="L_bar"; c.location="Rope Bar"; c.subId="b_ent"; c.subPos={p_a:"b_ent",p_b:"b_ent"};`);
  ok("a place with no areas of its own: its description, without its name", /BAR-DESC a low room of dark wood and brass\./.test(I3.usr)&&!/Rope Bar|Entrance/.test(I3.usr), I3.usr.slice(0,900));
  const I4=await draw(`__SETUP(); const c=curChat(); c.locationId="L_cafe"; c.location="Harbour Cafe"; c.subId="c_ent"; c.subPos={p_a:"c_ent",p_b:"c_ent"};`);
  ok("an area with nothing written at all: the place it is part of, labelled, never a name or the knowledge",
     /the wider place this area is part of \(much of it may not be visible from here\): CAFE-DESC/.test(I4.usr)&&!/Harbour Cafe|Entrance|CAFE-KNOW|TER-LOOK/.test(I4.usr), I4.usr.slice(0,900));
  // the dressing context of a wardrobe choice, the scene video's where, the playground
  const IX=await pg.evaluate(()=>{ __SETUP(); const c=curChat(), l=locById("L_flat"), s=subById(l,"s_kit");
    const dress=_imgDressingPlace(l,s), sv=_svWhenWhere(c,[]);
    _pg.locMode="pick"; _pg.locId="L_flat"; _pg.subId="s_bal"; const pgc=_pgLocationClause();
    return {dress,sv,pgc,name:_imgPlaceName(c)}; });
  ok("the wardrobe's dressing context, the scene video's 'Where' and the playground: the look, no names",
     /^a private home, KIT-LOOK/.test(IX.dress)&&!NOPE.test(IX.dress)&&/- Where: KIT-LOOK/.test(IX.sv)&&!NOPE.test(IX.sv)
     &&IX.pgc==="BAL-DESC an iron railing and two plastic chairs.", JSON.stringify(IX));
  ok("only what compares or titles a picture keeps the name (the visual director, the stamp, the movie bar)", IX.name==="Ayla's Flat's Kitchen", IX.name);

  console.log("\n[2b. a selfie the same]");
  const SF=await pg.evaluate(async()=>{ __SETUP(); const c=curChat(); c.locationId=null; c.location="Emre's House"; c.presentIds=[];
    c.subPos={p_a:"s_kit"}; window.resolveWorldPositions=()=>({p_a:"L_flat"});
    const p=state.personas[0], rule={id:"r_self",label:"Mirror selfie",cast:"solo",enabled:true,selfie:true,selfieNote:"at a mirror",promptStyle:""};
    window.__calls=[];
    await selfieImage(c,p,rule,"I hold the phone up.");
    const w=__calls.find(x=>/Selfie image prompt writer/.test(x.d));
    window.__calls=[];
    await selfieWrite(c,p,rule,{mid:"r",role:"user",content:"(photo)",photoRequest:true});
    const sw=__calls.find(x=>/^Selfie writer/.test(x.d));
    return {img:w?w.text:"",wr:sw?sw.text:""}; });
  ok("the selfie's image prompt writer gets the kitchen's look only", /WHERE THIS PHOTO IS TAKEN[^\n]*\nKIT-LOOK copper pans/.test(SF.img)&&!NOPE.test(SF.img), SF.img.slice(0,900));
  ok("the selfie writer (her own words) gets where she is, what it looks like and what people there know", /WHERE YOU ARE: Ayla's Flat — Kitchen\nWhat it looks like: KIT-LOOK[^\n]*\nWhat people here know about it: FLAT-KNOW/.test(SF.wr)&&!/BAL-DESC|ENT-LOOK|KIT-OLD/.test(SF.wr), SF.wr.slice(0,900));

  /* ---------------------------------------------------------------- 3. the reply */
  console.log("\n[3. the reply: the place, its knowledge, this area's look; the others by name]");
  await pg.evaluate(()=>{
    window.__payload=(kind,o)=>{ o=o||{}; const c=__SETUP(); if(o.prep)(new Function("c",o.prep))(c);
      const p=state.personas[0], others=presentCast(c).filter(x=>x.id!==p.id), inj={recent:[],diary:[],longterm:[]};
      if(kind==="heat")c._heatBeat={n:2,total:5};
      if(kind==="text")c.messages.forEach(m=>{ m.textMsg=true; m.textWith="p_a"; });
      const mk=()=>Object.assign({},buildCharPromptBlocks(p,others,inj,null,{chat:c,targetName:"Emre",targetId:"__user__",payloadKind:kind,textMode:kind==="text"}),
        buildTailBlocks({chat:c,selfP:p,selfId:p.id,selfName:p.name,targetName:"Emre",targetId:"__user__",injected:inj,payloadKind:kind,textMode:kind==="text",multi:kind==="multi"}));
      try{ return (ptBuildMessages(kind,mk(),[{role:"user",content:"(history)"}],{chat:c,npc:p,targetName:"Emre"},mk)||[]).map(m=>m.content).join("\n\n"); }
      finally{ delete c._heatBeat; } };
  });
  const R=await pg.evaluate(()=>{ const r={}; ["solo","multi","gm","heat"].forEach(k=>{ r[k]=__payload(k); }); return r; });
  for(const k of ["solo","multi","gm","heat"]){
    const t=R[k], sc=t.slice(t.indexOf("# SCENE RIGHT NOW"));
    ok(k+": the place, what people here know about it, the area, and what it looks like",
       /⚠️ YOUR CURRENT LOCATION: Ayla's Flat — specifically the Kitchen\. THIS IS WHERE YOU ARE RIGHT NOW\. ⚠️/.test(t)
       &&/\n\nWhat people here know about Ayla's Flat: FLAT-KNOW the bakery below opens at five/.test(t)
       &&/\n\nWhat it looks like here: KIT-LOOK copper pans over a tiled counter, a window onto the street\./.test(t), (sc.match(/# SCENE RIGHT NOW[\s\S]{0,1600}/)||[""])[0]);
    ok(k+": the other areas by name only, the empty private one marked; no other look or description",
       /SUB-AREAS of Ayla's Flat: Entrance — empty, no one is there; Kitchen; Balcony\.\nYou are in the Kitchen\.(?:\n|$)/.test(t)&&!/ENT-LOOK|BAL-DESC|KIT-OLD/.test(t),
       (t.match(/SUB-AREAS[^\n]*\n[^\n]*/)||[""])[0]);
    ok(k+": nothing says who can hear, how exposed, or that talk gets out; who is around instead",
       !/can hear|How exposed|gets out|word can get around|spreads|talk here travels/i.test(t)&&/# PRIVACY — WHO IS AROUND YOU/.test(t)&&/\n\nThere are no other people nearby\.(?:\n|$)/.test(t),
       ((t.match(/can hear[^\n]*|How exposed[^\n]*|gets out[^\n]*/i)||[""])[0])+" … "+(t.match(/# PRIVACY[\s\S]{0,700}/)||[""])[0]);
  }
  const RT=await pg.evaluate(()=>__payload("text",{prep:'window.__rwp=window.resolveWorldPositions; window.resolveWorldPositions=()=>({p_a:"L_cafe",p_b:"L_flat"});'}));
  await pg.evaluate(()=>{ if(window.__rwp)window.resolveWorldPositions=window.__rwp; });
  ok("text: the texter's own place, what people there know, and what it looks like (no areas, no other place)",
     /WHERE YOU ARE right now, while you type this: Harbour Cafe\./.test(RT)&&/\n\nWhat people here know about Harbour Cafe: CAFE-KNOW the fishermen/.test(RT)
     &&/\n\nWhat it looks like here: CAFE-DESC a glass-fronted café on the quay\./.test(RT)&&!/SUB-AREAS|FLAT-KNOW|KIT-LOOK|TER-LOOK/.test(RT)&&!/can hear/i.test(RT),
     (RT.match(/WHERE YOU ARE[\s\S]{0,600}/)||[""])[0]);
  const RF=await pg.evaluate(()=>({nok:__payload("solo",{prep:'const l=state.universes[0].locations[0]; delete l.knowledge; l.sublocations[1].scene="";'})}));
  ok("no knowledge: nothing for it; an area with no look: its old description", !/What people here know/.test(RF.nok)&&/What it looks like here: KIT-OLD an old kitchen\./.test(RF.nok), (RF.nok.match(/⚠️ YOUR CURRENT[\s\S]{0,700}/)||[""])[0]);
  const RW=await pg.evaluate(()=>__payload("solo",{prep:'c.subPos.p_b="s_ent";'}));
  ok("an area someone is in is not marked empty; the one nobody is in is", /SUB-AREAS of Ayla's Flat: Entrance; Kitchen; Balcony — empty, no one is there\./.test(RW)
     &&/Not in this room, but elsewhere in Ayla's Flat: Berk \(in the Entrance\)\. They are out of earshot/.test(RW), (RW.match(/SUB-AREAS[^\n]*/)||[""])[0]);

  /* ---------------------------------------------------------------- 4. who is around */
  console.log("\n[4. who is around: crowded, a couple of people far off, nobody nearby]");
  const W=await pg.evaluate(()=>{ const t=k=>{ const x=__payload("solo",{prep:k}); return (x.match(/# PRIVACY[\s\S]*?(?=\n# |$)/)||[""])[0]; };
    return {high:t('c.locationId="L_bar"; c.location="Rope Bar"; c.subId="b_ent"; c.subPos={p_a:"b_ent",p_b:"b_ent"};'),
            low:t('c.locationId="L_cafe"; c.location="Harbour Cafe"; c.subId="c_ter"; c.subPos={p_a:"c_ter",p_b:"c_ter"};'),
            none:t(''),
            bands:[[{type:"home"},0],[{type:"home"},0.1],[{type:"home"},0.44],[{type:"home"},0.45],[{type:"home"},0.9],[{type:"poi"},0],[{type:"poi"},0.1],[{type:"poi"},0.5]].map(([l,c])=>crowdKey(l,c)).join(),
            labels:["high","low","none"].map(k=>blkTpl("crowd_"+k))}; });
  ok("a busy place (exposure 0.6): \"This is a crowded place.\"", /\nThis is a crowded place\.(?:\n|$)/.test(W.high)&&!/far in the distance|no other people/.test(W.high), W.high);
  ok("a quieter public place (0.3): \"There are a couple of people far in the distance.\"", /\nThere are a couple of people far in the distance\.(?:\n|$)/.test(W.low), W.low);
  ok("a home (0): \"There are no other people nearby.\"", /\nThere are no other people nearby\.(?:\n|$)/.test(W.none), W.none);
  ok("the bands: none = 0, low under 0.45, high from 0.45; a public place is never none", W.bands==="none,low,low,high,high,low,low,high", W.bands);
  ok("the three wordings are pieces of their own (Payloads → Other wording)", W.labels.join("|")==="This is a crowded place.|There are a couple of people far in the distance.|There are no other people nearby."
     &&await pg.evaluate(()=>_otherWordingKeys().indexOf("crowd_high")>=0&&_otherWordingKeys().indexOf("scene_area_empty")>=0), JSON.stringify(W.labels));

  /* ---------------------------------------------------------------- 5. the Gamemaster and the Scene Writer */
  console.log("\n[5. the Gamemaster's and the Scene Writer's area list]");
  const G=await pg.evaluate(()=>{ const c=__SETUP(); return {ss:sceneStateBlock(c),gm:directorContext(c,"gm"),psy:directorContext(c,"psyche")}; });
  ok("the areas by name, the empty private one marked, who is around — no privacy notes",
     /\nAreas within Ayla's Flat: Entrance — empty, no one is there; Kitchen; Balcony\. Emre is in the Kitchen\./.test(G.ss)&&/\nWho is around Emre's area: There are no other people nearby\./.test(G.ss)
     &&!/how private each is|nothing said here gets out|talk here|spreads|word can get around/.test(G.ss), G.ss);
  ok("and the place's knowledge and the player's area's look, never another area's", /What people here know about it: FLAT-KNOW/.test(G.ss)&&/The Kitchen, where Emre is: KIT-LOOK/.test(G.ss)&&!/BAL-DESC|ENT-LOOK/.test(G.ss), G.ss);
  ok("the Gamemaster's list of places says who is around each, not how private", /PLACES IN THIS WORLD \(and who is around at each/.test(G.gm)&&/- Rope Bar: This is a crowded place\./.test(G.gm)
     &&!/nothing said here gets out|talk here (?:rarely|often) spreads|word can get around/.test(G.gm+G.psy), (G.gm.match(/PLACES IN THIS WORLD[\s\S]{0,300}/)||[""])[0]);

  /* ---------------------------------------------------------------- 6. creating places with a model */
  console.log("\n[6. the place builders and the universe generator fill both fields]");
  const PROMPTS=await pg.evaluate(()=>["x_location_homes","x_location_quest","x_location_pois"].map(k=>up(k)).concat([up("univPrompt")]));
  ok("every place builder and the universe generator ask for a place's knowledge and each area's look (no people, no names)",
     PROMPTS.every(t=>/"knowledge"/.test(t)&&/"scene"/.test(t)&&/history, its reputation, its routines, who uses it/.test(t)&&/no people/.test(t)), PROMPTS.map(t=>t.slice(0,200)).join("\n---\n"));
  const GEN=await pg.evaluate(async()=>{ __SETUP(); const u=state.universes[0]; u.gameData={quests:[]};
    const ans={homes:'[{"name":"The Demir House","residents":["Ayla","Berk"],"description":"A narrow stone house.","knowledge":"GEN-KNOW-H built by a sea captain.","sublocations":[{"name":"Front Door","scene":"GEN-LOOK-H1 a heavy oak door."},{"name":"Parlour","scene":"GEN-LOOK-H2 velvet chairs."},"Attic"]}]',
      pois:'[{"name":"Fish Market","description":"Stalls under a tin roof.","knowledge":"GEN-KNOW-P loud before dawn.","sublocations":[{"name":"Gate","scene":"GEN-LOOK-P1 iron gate."},{"name":"Ice Room","scene":"GEN-LOOK-P2 crushed ice."}]}]',
      quest:'[{"name":"Old Lighthouse","description":"A white tower.","knowledge":"GEN-KNOW-Q closed since the storm.","sublocations":[{"name":"Door","scene":"GEN-LOOK-Q1 a salt-eaten door."},{"name":"Lamp Room","scene":"GEN-LOOK-Q2 a great brass lamp."}]}]'};
    const asked={};
    window.chatCompletion=async(m,model,opts)=>{ const d=(opts&&opts.dbg)||""; const mm=d.match(/^Location generator \((\w+)\)/); if(mm){ asked[mm[1]]=m.map(x=>x.content).join("\n"); return ans[mm[1]]; } return "{}"; };
    const out={};
    // homes: nobody housed
    u.locations=[]; out.homes=await generateLocations(u,[],"");
    // pois: everyone housed
    u.locations=[{id:"L_h",name:"Home",type:"home",residents:["p_a","p_b"],sublocations:[{id:"L_h_entrance",name:"Entrance",entrance:true}]}];
    out.pois=await generateLocations(u,u.locations,"");
    // quest: a quest names a place that does not exist
    u.gameData.quests=[{id:"q1",title:"The light",location:"Old Lighthouse",subArea:"Lamp Room"}];
    out.quest=await generateLocations(u,u.locations,"");
    // the universe editor's "Generate locations" button
    u.gameData.quests=[]; editingUniverse=u; _ueLocs=u.locations.slice(); window.askAiInstructions=async()=>"";
    document.getElementById('ueName').value=u.name||"W"; document.getElementById('ueSetting').value=u.setting||"";
    await genLocations(); out.button=_ueLocs.slice(1); editingUniverse=null;
    const pick=a=>(a||[]).map(l=>({k:l.knowledge||"",subs:(l.sublocations||[]).map(s=>(s.entrance?"*":"")+s.name+"="+(s.scene||""))}));
    return {homes:pick(out.homes),pois:pick(out.pois),quest:pick(out.quest),button:pick(out.button),asked:Object.keys(asked).map(k=>k+":"+(/"knowledge"/.test(asked[k])&&/"scene"/.test(asked[k]))).join()}; });
  ok("homes: the knowledge and each area's look land in the place (a bare area name still works)",
     JSON.stringify(GEN.homes)===JSON.stringify([{k:"GEN-KNOW-H built by a sea captain.",subs:["*Front Door=GEN-LOOK-H1 a heavy oak door.","Parlour=GEN-LOOK-H2 velvet chairs.","Attic="]}]), JSON.stringify(GEN));
  ok("public places the same", JSON.stringify(GEN.pois)===JSON.stringify([{k:"GEN-KNOW-P loud before dawn.",subs:["*Gate=GEN-LOOK-P1 iron gate.","Ice Room=GEN-LOOK-P2 crushed ice."]}]), JSON.stringify(GEN.pois));
  ok("the places a quest needs the same", JSON.stringify(GEN.quest)===JSON.stringify([{k:"GEN-KNOW-Q closed since the storm.",subs:["*Door=GEN-LOOK-Q1 a salt-eaten door.","Lamp Room=GEN-LOOK-Q2 a great brass lamp."]}]), JSON.stringify(GEN.quest));
  ok("and the universe editor's Generate locations button puts them in the editor with both", JSON.stringify(GEN.button)===JSON.stringify(GEN.pois), JSON.stringify(GEN.button));
  ok("each request carried the new contract", /homes:true/.test(GEN.asked)&&/pois:true/.test(GEN.asked)&&/quest:true/.test(GEN.asked), GEN.asked);
  const UG=await pg.evaluate(async()=>{ const before=state.universes.length;
    window.chatCompletion=async(m,model,opts)=>{ const d=(opts&&opts.dbg)||"";
      if(d==="Universe generator")return JSON.stringify({name:"Salt Town",avatar:"🌊",setting:"A port.",characters:[{name:"Mert",personality:"You are calm.",look:{hair:"black"}}],
        locations:[{name:"Mert's Boat",description:"A blue fishing boat.",type:"home",resident:"Mert",knowledge:"GEN-KNOW-U everyone has borrowed it once.",
          sublocations:[{name:"Deck",scene:"GEN-LOOK-U1 coiled ropes."},{name:"Cabin",scene:"GEN-LOOK-U2 a bunk and a lamp."}]},
          {name:"The Quay",description:"Stone steps to the water.",type:"poi",resident:""}]});
      return "{}"; };
    document.getElementById('ugBrief').value="a port"; document.getElementById('ugCount').value=1;
    await runUniverseGenerator(); await new Promise(r=>setTimeout(r,400));
    const u=state.universes[state.universes.length-1]; const L=u.locations||[];
    return {n:state.universes.length-before,name:u.name,boat:L[0]&&{k:L[0].knowledge,subs:L[0].sublocations.map(s=>(s.entrance?"*":"")+s.name+"="+(s.scene||""))},
      quay:L[1]&&{k:L[1].knowledge||"",subs:(L[1].sublocations||[]).map(s=>(s.entrance?"*":"")+s.name)}}; });
  ok("the universe generator: the knowledge and the areas with their looks land in the new universe's places; none asked for, an entrance as ever",
     UG.n===1&&UG.name==="Salt Town"&&JSON.stringify(UG.boat)===JSON.stringify({k:"GEN-KNOW-U everyone has borrowed it once.",subs:["*Deck=GEN-LOOK-U1 coiled ropes.","Cabin=GEN-LOOK-U2 a bunk and a lamp."]})
     &&JSON.stringify(UG.quay)===JSON.stringify({k:"",subs:["*Entrance"]}), JSON.stringify(UG));

  /* ---------------------------------------------------------------- 7. the upgrades */
  console.log("\n[7. upgrades: only what is still exactly the v150.80 default]");
  await pg.evaluate(async()=>{
    const old=k=>{ let t=k==="univPrompt"?DEFAULT_UNIV:X_ENGINE_PROMPTS[k].def; LOC_GEN_SWAPS_V150_81[k].forEach(([o,n])=>{ t=t.replace(n,()=>o); }); return t; };
    window.__OLDP={homes:old("x_location_homes"),pois:old("x_location_pois"),quest:old("x_location_quest"),univ:old("univPrompt")};
    store.setRaw(K.x_location_homes,__OLDP.homes);                       // untouched v150.80 copy
    store.setRaw(K.x_location_pois,__OLDP.pois+"\nMY OWN LINE.");         // edited
    store.setRaw(K.univPrompt,__OLDP.univ);
    const u=state.universes[0]; u.prompts=Object.assign({},u.prompts||{},{x_location_quest:__OLDP.quest,x_location_homes:__OLDP.homes+" (mine)"});
    u.blockTpls={scene_subareas:BLOCK_TPL_V150_80_OLD.scene_subareas};
    persistUniverses();
    store.set(K.blockTpls,{scene_subareas:BLOCK_TPL_V150_80_OLD.scene_subareas,privacy_header:BLOCK_TPL_V150_80_OLD.privacy_header,
      scene_nearby:"MY NEARBY: {{names}}."});
    // a saved fragment list: scene_now still the v150.80 default, privacy edited
    const L=JSON.parse(JSON.stringify(FRAG_DEFAULTS)).map(f=>FRAG_DEFAULTS_V150_80_OLD[f.id]?JSON.parse(JSON.stringify(FRAG_DEFAULTS_V150_80_OLD[f.id])):f);
    L.find(f=>f.id==="privacy").text+="\nMY PRIVACY NOTE";
    store.setRaw(K.fragments,JSON.stringify(L));
    store.setRaw(K.fragAdds,FRAG_SHIPPED_ADDS.map(a=>a.key).filter(k=>k!=="v150.81.place").join(","));
    await new Promise(r=>setTimeout(r,900));
  });
  await boot(); await defineSetup();
  const UP=await pg.evaluate(()=>{ const u=state.universes[0]; const L=fragList();
    return {homes:state.x_location_homes===X_ENGINE_PROMPTS.x_location_homes.def&&store.raw(K.x_location_homes,"")===X_ENGINE_PROMPTS.x_location_homes.def,
      pois:/MY OWN LINE\.$/.test(state.x_location_pois)&&!/"knowledge"/.test(state.x_location_pois),
      univ:state.univPrompt===DEFAULT_UNIV,
      uniQuest:u.prompts&&u.prompts.x_location_quest===X_ENGINE_PROMPTS.x_location_quest.def,
      uniHomes:u.prompts&&/ \(mine\)$/.test(u.prompts.x_location_homes),
      blk:!("scene_subareas" in state.blockTpls)&&!("privacy_header" in state.blockTpls)&&state.blockTpls.scene_nearby==="MY NEARBY: {{names}}.",
      uniBlk:!(u.blockTpls&&"scene_subareas" in u.blockTpls),
      scene:_fragCanon(L.find(f=>f.id==="scene_now"))===_fragCanon(FRAG_DEFAULTS.find(f=>f.id==="scene_now")),
      privacy:/MY PRIVACY NOTE/.test(L.find(f=>f.id==="privacy").text)&&/WHO CAN HEAR YOU/.test(L.find(f=>f.id==="privacy").text)}; });
  ok("a place builder's stored prompt that is exactly the v150.80 default is upgraded; an edited one is kept", UP.homes&&UP.pois, JSON.stringify(UP));
  ok("the universe generator's the same", UP.univ, JSON.stringify(UP));
  ok("a universe's own copy: the untouched one upgraded, the edited one kept", UP.uniQuest&&UP.uniHomes, JSON.stringify(UP));
  ok("a reply piece override still word for word its v150.80 default is dropped (the new one applies); an edited one is kept; a universe's too", UP.blk&&UP.uniBlk, JSON.stringify(UP));
  ok("a saved \"Scene right now\" still its v150.80 default is replaced; an edited \"Privacy\" is the user's and stays", UP.scene&&UP.privacy, JSON.stringify(UP));

  ok("no page errors", errs.length===0?true:errs.slice(0,5).join(" | "));
  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close(); process.exit(fail?1:0);
})().catch(e=>{ console.error(e); process.exit(1); });
