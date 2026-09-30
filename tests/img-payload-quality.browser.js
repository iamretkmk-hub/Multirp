/* v148.4 — WHAT THE IMAGE ENGINES ARE HANDED, READ AS THE MODEL READS IT.
   A payload review of a real two-day session (every request captured, stub responses) found the image
   requests pointing the writer the wrong way even where the pictures and labels were right:
     1. the scene-type templates said the location is "appended after you" (untrue since v100.1), were
        written for one "she" while IMAGE 1 was often a man, drew "only whom the exchange names" against
        the cast's "everyone listed is in the picture", and built faces from parts against the universal
        prompt — and the frame note said the template wins. Stored copies of the shipped texts must be
        refreshed, byte for byte only;
     2. the continuity reference was the speaker's last prompt in THAT frame's IMAGE numbers, so poses and
        clothes landed on whoever held the number now, and people who had left were still in it;
     3. outfits were re-read from (place, hour) every frame: guests went to the table's Night slot (boxer
        briefs) at the gate, a walk together changed everyone; the outfit text's props were "draw exactly";
     4. the words-only path gave nobody an identity ("Man", "keep them plain", no gender at all);
     5-11. the area was described by the venue's outside, narrated clothing was lost, the visual director
        judged a raw line with no place/time/people, the router and the director read inner thoughts,
        outfits went in as "You wear…" in POV frames, the since-last-picture window doubled the round and
        claimed a picture that never was, and the POV rules were stated three times.
   Checked through real illustrate() / decideVisual() calls with the models stubbed, and a real reload for
   the migration.
   Run: node tests/img-payload-quality.browser.js */
const {chromium}=require('playwright');
const fs=require('fs'), path=require('path');
const OLD=JSON.parse(fs.readFileSync(path.resolve(__dirname,'fixtures','img-writer-v148.3.json'),'utf8'));
(async()=>{
  const b=await chromium.launch({executablePath:process.env.SM_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage();
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file://'+path.resolve(__dirname,'..','index.html'));
  await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(600);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x||c).slice(0,1400));} };

  /* ---------------------------------------------------------------- 1. the shipped texts agree */
  console.log("\n[1. the scene-type templates and the frame note agree with the request]");
  const T=await pg.evaluate(()=>({pov:IMG_STYLE_POV,int:IMG_STYLE_INTIMATE,frame:up("imgFrameGuide"),povg:up("imgPovGuide"),rw:up("rewritePrompt"),txt:up("x_img_cast_text")}));
  for(const [k,t] of [["POV",T.pov],["intimate",T.int]]){
    ok(k+": the location is no longer 'appended after you' — the setting comes from WHERE THIS FRAME HAPPENS",
       !/Never a location, room, background/.test(t)&&/The setting comes from WHERE THIS FRAME HAPPENS and is yours to write/.test(t), t.slice(-900));
    ok(k+": exactly the people in PEOPLE IN THIS FRAME when the request lists them",
       /PEOPLE IN THIS FRAME/.test(t)&&!/^- Only the people the latest exchange puts in this moment\. Never add one/m.test(t), "");
    ok(k+": the face rule is path-aware — only for someone a reference picture shows",
       /Anyone a reference picture shows: never their face shape, hair, build, skin tone or age/.test(t)&&/described the way the request asks/.test(t)
       &&!/never a face, hair, build, skin tone or age for anyone/.test(t), "");
    ok(k+": faces are named the way the universal prompt says, not assembled from parts",
       /name each visible face's feeling the way the universal rules above say/.test(t)&&!/THE EYELIDS:/.test(t)&&!/An emotion word is not an expression/.test(t), "");
  }
  ok("POV: written for 'the focus', man or woman — not one 'she' who is IMAGE 1",
     /"The focus" is the person whose line this picture is for/.test(T.pov)&&/man or woman/.test(T.pov)&&!/She is IMAGE 1 and the frame is hers/.test(T.pov)
     &&!/## 4\. HER FACE/.test(T.pov)&&!/## 5\. HER HANDS/.test(T.pov), T.pov.slice(0,500));
  ok("POV: an example frame with three people, a man as IMAGE 1", /A TABLE OF THREE: [^\n]*the man in IMAGE 1[^\n]*the man in IMAGE 2[^\n]*the woman in IMAGE 3/.test(T.pov), "");
  ok("the frame note gives the template the SHOT and the request the facts: who, doing, wearing, where",
     /governs the SHOT/.test(T.frame)&&/the message below wins over it/.test(T.frame)&&/PEOPLE IN THIS FRAME/.test(T.frame)
     &&/WHAT EACH PERSON/.test(T.frame)&&/WHERE THIS FRAME HAPPENS/.test(T.frame)&&!/the block wins/.test(T.frame), T.frame.slice(0,700));
  ok("and it reads a template's 'she' as the person whose line it is, man or woman", /read it as the person whose line this picture is for, man or woman/.test(T.frame), "");
  ok("the POV note's gaze rule is not for a woman only", /THE PERSON SPEAKING TO HIM MAY LOOK STRAIGHT INTO THE LENS/.test(T.povg)&&!/SHE MAY LOOK/.test(T.povg), T.povg.slice(0,600));
  ok("the universal prompt: someone to be described in words IS described (its tail list is not absolute)",
     /The one exception is a person the request tells you to describe in words/.test(T.rw), "");

  /* ---------------------------------------------------------------- 11. stated once */
  console.log("\n[11. the POV contract is stated once, and the writer's system prompt is smaller]");
  const sysLen=await pg.evaluate(()=>{ const r=DEFAULT_IMG_RULES.find(x=>x.id==="r_pov_talk");
    const sys=up("rewritePrompt")+"\n\n"+r.promptStyle+"\n\n"+up("imgFrameGuide")+"\n\n"+up("imgPovGuide");
    const n=re=>(sys.match(re)||[]).length;
    return {len:sys.length,mirror:n(/no mirror, no reflection/g),lens:n(/MAY LOOK (?:STRAIGHT )?INTO THE LENS/g),viewerSlot:n(/TAKES NO IMAGE SLOT|takes no IMAGE slot/g),examples:n(/^- [A-Z ,]+: first-person point-of-view shot/gm)}; });
  ok("'no mirror, no reflection', the look into the lens and the no-slot rule each appear once",
     sysLen.mirror===1&&sysLen.lens===1&&sysLen.viewerSlot===1, JSON.stringify(sysLen));
  ok("two example frames instead of six, and the whole system prompt is smaller than the 17,087 chars it was", sysLen.examples===2&&sysLen.len<16500, JSON.stringify(sysLen));

  /* ---------------------------------------------------------------- 1b. migration */
  console.log("\n[1. stored copies of the v148.3 texts are refreshed — byte for byte only]");
  await pg.evaluate(o=>{
    const def=DEFAULT_IMG_RULES.find(d=>d.id==="r_pov_talk"), di=DEFAULT_IMG_RULES.find(d=>d.id==="r_intimate_std");
    store.set(K.imgRules,[Object.assign({},def,{promptStyle:o.IMG_STYLE_POV}),Object.assign({},di,{promptStyle:o.IMG_STYLE_INTIMATE}),
      {id:"my_pov",label:"Mine",when:"w",cast:"player",pov:true,promptStyle:o.IMG_STYLE_POV+"\nMY OWN LINE.",enabled:true},
      {id:"copy_int",label:"Copied",when:"w",cast:"player",pov:false,promptStyle:o.IMG_STYLE_INTIMATE,enabled:true}]);
    store.setRaw(K.imgFrameGuide,o.DEFAULT_IMG_FRAME_GUIDE);
    store.setRaw(K.imgPovGuide,o.DEFAULT_IMG_POV_GUIDE+" ");                 // one character added: the user's own
    store.setRaw(K.rewritePrompt,o.DEFAULT_REWRITE);
    store.setRaw(K.x_img_cast_text,o.x_img_cast_text);
    const u=state.universes[0]; u.prompts=u.prompts||{}; u.prompts.imgFrameGuide=o.DEFAULT_IMG_FRAME_GUIDE; persistUniverses();
  },OLD);
  await pg.waitForTimeout(400);
  await pg.reload(); await pg.waitForTimeout(2600);
  const M=await pg.evaluate(()=>{ const r=id=>(state.imgRules.find(x=>x.id===id)||{}).promptStyle||"";
    return {pov:r("r_pov_talk")===IMG_STYLE_POV,int:r("r_intimate_std")===IMG_STYLE_INTIMATE,mine:/MY OWN LINE\.$/.test(r("my_pov"))&&!/The focus/.test(r("my_pov")),
      copy:r("copy_int")===IMG_STYLE_INTIMATE,frame:state.imgFrameGuide===DEFAULT_IMG_FRAME_GUIDE,povg:/SHE MAY LOOK STRAIGHT INTO THE LENS/.test(state.imgPovGuide),
      rw:state.rewritePrompt===DEFAULT_REWRITE,txt:state.x_img_cast_text===X_ENGINE_PROMPTS.x_img_cast_text.def,
      uni:!((state.universes[0].prompts||{}).imgFrameGuide)}; });
  ok("an untouched POV and intimate template are replaced by the new ones", M.pov&&M.int, JSON.stringify(M));
  ok("so is an exact copy under another id (the Insert-template picker serves them)", M.copy, JSON.stringify(M));
  ok("an edited copy is left alone", M.mine, JSON.stringify(M));
  ok("the frame note, the universal prompt and the words-only cast prompt are refreshed", M.frame&&M.rw&&M.txt, JSON.stringify(M));
  ok("a POV note with one character changed is the user's and is kept", M.povg, JSON.stringify(M));
  ok("a universe override that is the old text is dropped", M.uni, JSON.stringify(M));
  await pg.evaluate(()=>{ store.setRaw(K.imgPovGuide,DEFAULT_IMG_POV_GUIDE); state.imgPovGuide=DEFAULT_IMG_POV_GUIDE; state.imgRules=DEFAULT_IMG_RULES.map(r=>({...r})); store.set(K.imgRules,state.imgRules); });

  /* ---------------------------------------------------------------- the illustrate harness */
  await pg.evaluate(()=>{
    const uni=state.universes[0];
    uni.locations=[
      {id:"L_cafe",name:"Vanadium Cafe",description:"A sleek coffee bar with chrome stools and a neon sign.",residents:[],sublocations:[{id:"c1",name:"Entrance",entrance:true},{id:"c2",name:"Outdoor Patio"}]},
      {id:"L_mill",name:"Isdemir",description:"A sprawling steel mill with tall smokestacks.",residents:[],sublocations:[{id:"m1",name:"Main Gate",entrance:true},{id:"m2",name:"Worker Canteen"}]},
      {id:"L_emre",name:"Emre's House",description:"A modern flat.",residents:[],sublocations:[{id:"e1",name:"Entrance",entrance:true},{id:"e2",name:"Garden"}]},
      {id:"L_sami",name:"Sami's House",description:"A flat house.",residents:["p_sami"],sublocations:[{id:"s1",name:"Entrance",entrance:true},{id:"s2",name:"Pool"}]}
    ];
    uni.playerHomeLocId="L_emre";
    const mk=(id,n,subj,refs,extra)=>Object.assign({id,name:n,universeId:uni.id,look:{subject:subj},refs,instructions:"x",personality:"x"},extra||{});
    state.personas=[
      mk("p_sami","Sami Özüçak","Man",["data:S1"],{outfits:{byLoc:{L_cafe:"You wear a cream cashmere crewneck and navy shorts.",L_mill:"You wear standard-issue navy coveralls."},
        home:{Evening:"You wear a grey tracksuit."},userHome:{Evening:"You wear a dark green silk shirt, left mostly unbuttoned, and black trousers, making yourself at home with a glass of rakı.",
        Night:"You wear a pair of low-slung black boxer briefs and a lazy, knowing grin, the rest of your clothes left in a trail from the front door."},activity:{swim:"You wear red swim shorts."}}}),
      mk("p_berk","Berker Özüçak","Man",["data:B1"],{outfits:{byLoc:{L_cafe:"You wear a bottle-green v-neck sweater.",L_mill:"You wear a steel-grey suit and a navy silk tie."},
        userHome:{Evening:"You wear a black polo, dark grey trousers, holding a bottle of good rakı."}}}),
      mk("p_burcu","Burcu Atan","Woman",["data:U1"],{outfits:{byLoc:{L_cafe:"You wear a coral-pink cardigan over a white tank top."}}}),
      mk("p_burak","Burak Atan","Man",["data:K1"],{outfits:{byLoc:{L_mill:"You wear a light blue oxford shirt and a navy tie, carrying a well-organized briefcase."}}}),
      mk("p_buket","Buket Özüçak","",[],{look:{body:"Average height"},personality:"You are a calm, competent woman who has accepted that your marriage is a second job."}),
      mk("p_ozlem","Özlem Özüçak","",[],{look:{},personality:"Cheerful and social.",instructions:"Play Özlem as upbeat. She is married, and her resistance stays measured."}),
      mk("p_hasan","Hasan","",[],{look:{},personality:"x",instructions:"x"})
    ];
    state.user="Emre"; state.key="k"; state.autoImg=false; state.userLook=""; state.userSubject="Man";
    const c=curChat(); c.universeId=uni.id; state.curUniverse=uni.id;
    window.__real={personRefs:window.personRefs,playerRefs:window.playerRefs,toDataUri:window.toDataUri,_playerRefHolder:window._playerRefHolder,
      usesRefImage:window.usesRefImage,effImgModel:window.effImgModel,editModelMaxRefs:window.editModelMaxRefs,
      pickRule:window.pickRule,genImageForRule:window.genImageForRule,chatCompletion:window.chatCompletion,saveMsgImage:window.saveMsgImage,captureGalleryMedia:window.captureGalleryMedia};
    window.personRefs=p=>(p&&p.refs)||[];
    window.playerRefs=()=>["data:E1"];
    window._playerRefHolder=()=>({look:{subject:"Man"}});
    window.toDataUri=async u=>u;
    window.usesRefImage=()=>true; window.effImgModel=()=>"bytedance/seedream-v4.5/edit"; window.editModelMaxRefs=()=>10;
    window.saveMsgImage=(m,u,cb)=>{ if(cb)cb(true); }; window.captureGalleryMedia=()=>{};
    window.__rule=Object.assign({},DEFAULT_IMG_RULES.find(r=>r.id==="r_pov_talk"));
    window.__route=""; window.pickRule=async(r,t)=>{ window.__route=t; return window.__rule; };
    window.__out="a written prompt"; window.__writer=null; window.__vd=null;
    window.genImageForRule=async(rule,prompt)=>{ window.__gen={prompt}; return "data:image/png;base64,iVBORw0KGgo="; };
    window.chatCompletion=async(messages,model,opts)=>{
      if(opts&&opts.dbg==="Image prompt writer"){ window.__writer=messages; return window.__out; }
      if(opts&&opts.dbg==="Visual director"){ window.__vd=messages; return "0"; }
      return "{}";
    };
  });
  // draw the last message of a freshly built chat; returns what the writer was given
  const draw=(setup)=>pg.evaluate(async(setup)=>{
    (new Function(setup||""))();
    const c=curChat(); window.__writer=null; window.__gen=null;
    const m=c.messages[c.messages.length-1];
    await illustrate(m.mid,m.content,true);
    const w=window.__writer||[];
    return {sys:String((w.find(x=>x.role==="system")||{}).content||""),usr:w.filter(x=>x.role==="user").map(x=>x.content).join("\n"),
            route:window.__route,prompt:(window.__gen&&window.__gen.prompt)||"",cont:JSON.parse(JSON.stringify(c.imgContBy||{}))};
  },setup||"");
  const scene=(o)=>`{ const c=curChat(); c.locationId="${o.loc||"L_cafe"}"; c.location=(locById(c.locationId)||{}).name; c.subId="${o.sub||"c2"}"; c.subPos={};
    c.presentIds=${JSON.stringify(o.present||["p_sami","p_berk","p_burcu"])}; c.presentIds.forEach(id=>c.subPos[id]=c.subId);
    c.period="${o.period||"Midday"}"; c.gameDay=${o.day||1};
    ${o.keep?"":"c.messages=[]; c.imgPromptBy={}; c.imgWindowBy={}; c.lastImgRuleBy={}; c.imgContBy={}; c.outfitHeld={}; c.wearing={};"} }`;
  const push=(arr)=>`{ const c=curChat(); ${JSON.stringify(arr)}.forEach((m,i)=>c.messages.push(Object.assign({mid:"x"+Date.now().toString(36)+"_"+c.messages.length,present:c.presentIds.slice()},m))); }`;

  /* ---------------------------------------------------------------- 2. continuity */
  console.log("\n[2. the continuity reference cannot land on the wrong person]");
  await pg.evaluate(()=>{ window.__out="the man in IMAGE 1 leans back in his chair with his arms spread; the man in IMAGE 2 holds a small coffee cup; the woman in IMAGE 3 stands at the counter in a coral cardigan"; });
  const A=await draw(scene({period:"Evening"})+push([{role:"user",content:"*I pull out a chair.*"},{role:"assistant",speaker:"Sami Özüçak",speakerId:"p_sami",content:'*Leans back and spreads his arms.* "Başmühendis Bey!" _Emre geldi._'}]));
  ok("frame A: Sami is IMAGE 1, Berker IMAGE 2, Burcu IMAGE 3", /the man in IMAGE 1 = Sami Özüçak/.test(A.usr)&&/the man in IMAGE 2 = Berker Özüçak/.test(A.usr)&&/the woman in IMAGE 3 = Burcu Atan/.test(A.usr), A.usr.slice(0,600));
  ok("it is stored by NAME under everyone it showed, without the lighting tail",
     ["p_sami","p_berk","p_burcu"].every(id=>A.cont[id]&&/\[\[Sami Özüçak\]\] leans back/.test(A.cont[id].t)&&/\[\[Berker Özüçak\]\] holds a small coffee cup/.test(A.cont[id].t))
     &&!/golden hour/.test(A.cont.p_sami.t)&&/golden hour/.test(A.prompt), JSON.stringify(A.cont).slice(0,600));
  await pg.evaluate(()=>{ window.__out="the man in IMAGE 1 sets his cup down; the man in IMAGE 2 laughs"; });
  const B=await draw(scene({period:"Evening",present:["p_sami","p_berk"],keep:true})+push([{role:"assistant",speaker:"Berker Özüçak",speakerId:"p_berk",content:"*Kahvesini bırakıyor.*"}]));
  const Bc=B.usr.slice(B.usr.lastIndexOf("CONTINUITY REFERENCE ("),B.usr.lastIndexOf("LATEST EXCHANGE ("));
  ok("frame B (Berker speaks, Burcu has gone): the old IMAGE 2 is now IMAGE 1 and the other way round",
     /the man in IMAGE 1 = Berker Özüçak/.test(B.usr)&&/the man in IMAGE 2 leans back in his chair/.test(Bc)&&/the man in IMAGE 1 holds a small coffee cup/.test(Bc), Bc);
  ok("what was said only about Burcu, who left, is taken out — no IMAGE 3 that does not exist", !/IMAGE 3/.test(Bc)&&!/coral/.test(Bc)&&!/\[\[/.test(Bc), Bc);
  ok("the block says it is in this frame's labels", /already rewritten in THIS frame's labels/.test(Bc), Bc.slice(0,300));
  await pg.evaluate(()=>{ window.usesRefImage=()=>false; window.__rule={label:"Group",cast:"group",pov:false,promptStyle:""}; window.__out="a heavy-set man leans on the table"; });
  const C=await draw(scene({period:"Evening",present:["p_sami","p_berk"],keep:true})+push([{role:"assistant",speaker:"Sami Özüçak",speakerId:"p_sami",content:"*Masaya yaslanıyor.*"}]));
  const Cc=C.usr.slice(C.usr.lastIndexOf("CONTINUITY REFERENCE ("),C.usr.lastIndexOf("LATEST EXCHANGE ("));
  ok("a words-only frame reads it by name, never by IMAGE numbers it does not have", /Berker Özüçak sets his cup down/.test(Cc)&&/Sami Özüçak laughs/.test(Cc)&&!/IMAGE \d/.test(Cc), Cc);
  await pg.evaluate(()=>{ window.usesRefImage=()=>true; window.__rule=Object.assign({},DEFAULT_IMG_RULES.find(r=>r.id==="r_pov_talk")); });
  ok("an exit takes the person's continuity with them, travel clears it all", await pg.evaluate(()=>{
      const c=curChat(); c.presentIds=["p_sami","p_berk"]; c.imgContBy={p_sami:{t:"x",mid:"m"},p_berk:{t:"y",mid:"m"}};
      applyPresence(c,[],["Sami Özüçak"]); const a=!c.imgContBy.p_sami&&!!c.imgContBy.p_berk; return a?true:JSON.stringify(c.imgContBy); }));

  /* ---------------------------------------------------------------- 10. the window */
  console.log("\n[10. the since-last-picture window: no doubles, no picture that never was]");
  const W=await draw(scene({})+push([{role:"assistant",speaker:"Sami Özüçak",speakerId:"p_sami",content:"*Gözlüğünü düzeltiyor.*"},
    {role:"user",content:"*Kafenin terasına çıkıp masalarına yaklaşıyorum.*"},{role:"assistant",speaker:"Burcu Atan",speakerId:"p_burcu",content:'"Hoş geldin." Sakin ama dikkatli bir sesle.'},
    {role:"assistant",speaker:"Sami Özüçak",speakerId:"p_sami",content:"*Sandalyesinde geriye yaslanıyor.*"}]));
  ok("with no previous picture it says so, and does not call the lines 'since that picture'",
     /\(No previous image — describe the scene fresh\.\)/.test(W.usr)&&!/SINCE THAT PICTURE/.test(W.usr)&&/WHAT HAS HAPPENED IN THIS SCENE SO FAR/.test(W.usr), W.usr.slice(-1400));
  ok("a line the LATEST EXCHANGE carries (the whole round) is not repeated in the window", (W.usr.match(/Kafenin terasına çıkıp/g)||[]).length===1, W.usr.slice(-1200));
  ok("a sentence that only says how something was said is not passed on as a pose",
     !/Sakin ama dikkatli bir sesle/.test(W.usr)&&await pg.evaluate(()=>_imgVisualOnly('"Hoş geldin." Sakin ama dikkatli bir sesle. *Masaya oturuyor.*')==="Masaya oturuyor."), W.usr.slice(-800));

  /* ---------------------------------------------------------------- 5. the area */
  console.log("\n[5. the area is not described by the venue's outside]");
  const L=await draw(scene({loc:"L_mill",sub:"m2",present:["p_sami","p_berk"]})+push([{role:"assistant",speaker:"Sami Özüçak",speakerId:"p_sami",content:"*Tepsisini bırakıyor.*"}]));
  ok("the writer is told this is an area with no description of its own, and what the wider place is",
     /Isdemir's Worker Canteen, an area of Isdemir with no description of its own — picture it from its name, the wider place it is part of \(much of it may not be visible from this area\): A sprawling steel mill/.test(L.usr), L.usr.slice(L.usr.indexOf("WHERE THIS FRAME"),L.usr.indexOf("WHERE THIS FRAME")+500));
  ok("and the router sees the area too", /LOCATION: Isdemir's Worker Canteen, an area of Isdemir/.test(L.route), L.route.slice(0,300));
  ok("an area with its own description is described by it", await pg.evaluate(()=>{ const l=locById("L_mill"); l.sublocations[1].description="Long steel tables and a serving hatch.";
      const t=_imgLocationClause(curChat()); l.sublocations[1].description=""; return /this area: Long steel tables and a serving hatch\./.test(t)?true:t; }));

  /* ---------------------------------------------------------------- 8. router */
  console.log("\n[8. the router does not read inner thoughts]");
  ok("thoughts are taken out of the exchange the router routes on", /Başmühendis Bey/.test(A.route)&&!/Emre geldi/.test(A.route), A.route.slice(-300));

  /* ---------------------------------------------------------------- 3 + 9. outfits */
  console.log("\n[3. an outfit, once decided, stays until something justifies a change]");
  const O=await pg.evaluate(async()=>{
    const c=curChat(); const P=id=>state.personas.find(p=>p.id===id);
    c.messages=[]; c.outfitHeld={}; c.wearing={}; c.gameDay=1; c.period="Midday";
    c.locationId="L_cafe"; c.subId="c2"; c.presentIds=["p_sami","p_berk"]; c.subPos={p_sami:"c2",p_berk:"c2"};
    const r={};
    r.cafe=currentOutfit(P("p_sami"),c).text;
    await travelTo("L_mill",["p_sami"]);          // Sami walks with the player; Berker stays behind
    c.subPos=c.subPos||{}; c.subPos.p_sami=curSubId(c); if(!c.presentIds.includes("p_sami"))c.presentIds.push("p_sami");
    r.walked=currentOutfit(P("p_sami"),c).text;
    r.berkerDropped=!(c.outfitHeld||{}).p_berk;
    // a guest at the player's house: Evening, then the clock turns to Night while they are still there
    c.locationId="L_emre"; c.subId="e2"; c.presentIds=["p_sami","p_berk"]; c.subPos={p_sami:"e2",p_berk:"e2"}; c.period="Evening"; c.gameDay=2;
    r.evening=currentOutfit(P("p_sami"),c).text;
    c.period="Night"; r.night=currentOutfit(P("p_sami"),c).text;
    // someone who arrives at Night gets the evening slot, not the sleepover one
    delete c.outfitHeld.p_sami; r.arriveNight=currentOutfit(P("p_sami"),c).text;
    // the wearing tracker's change outlives the hour
    c.period="Evening"; setWearingOverride(c,"p_berk","a white t-shirt, the polo off"); c.period="Night";
    r.override=currentOutfit(P("p_berk"),c).text;
    // a new day, going home, and (v148.6) an area that used to trigger an activity outfit
    c.gameDay=3; c.period="Morning"; r.newDay=currentOutfit(P("p_berk"),c).text;
    c.locationId="L_sami"; c.subId="s1"; c.subPos={p_sami:"s1"}; c.presentIds=["p_sami"]; c.period="Evening";
    r.home=currentOutfit(P("p_sami"),c).text;
    c.subPos.p_sami="s2"; r.pool=currentOutfit(P("p_sami"),c).text;
    // an absent character read by the editor is not pinned to the player's place
    c.outfitHeld={}; c.locationId="L_cafe"; c.presentIds=[]; currentOutfit(P("p_burcu"),c); r.absentHeld=!!c.outfitHeld.p_burcu;
    return r;
  });
  /* v148.6 — CHANGED ON PURPOSE: v148.4 carried the held outfit along on the walk, so Sami wore the café's
     cashmere and shorts on the plant floor (TEMPLATE-REVIEW N1). Every place has its own clothes now: a
     change of location drops the holds and he wears the plant's coveralls. */
  ok("walking together from the café to the plant, Sami is dressed for the plant", /cream cashmere/.test(O.cafe)&&/navy coveralls/.test(O.walked), JSON.stringify(O));
  ok("and whoever stayed behind is dressed afresh next time", O.berkerDropped===true, JSON.stringify(O));
  ok("a guest still at the player's house when Evening turns to Night keeps the evening clothes (the reported boxer briefs)",
     /dark green silk shirt/.test(O.evening)&&O.night===O.evening&&!/boxer/.test(O.night), JSON.stringify(O));
  ok("and a guest who only arrives at Night gets the evening slot, not the sleepover one", /dark green silk shirt/.test(O.arriveNight), O.arriveNight);
  ok("a change the wearing tracker recorded outlives the hour", /polo off/.test(O.override), O.override);
  /* v148.6 — CHANGED ON PURPOSE: the pool no longer switches him into the generic "swim" outfit (those are
     gone); the Pool area of his own house is still his house, so he keeps its Evening outfit. */
  ok("a new day and going home each justify a change; the pool area of his house does not swap in swimwear", !/polo off/.test(O.newDay)&&/grey tracksuit/.test(O.home)&&/grey tracksuit/.test(O.pool)&&!/swim shorts/.test(O.pool), JSON.stringify(O));
  ok("an absent character read from the editor gets no hold", O.absentHeld===false, JSON.stringify(O));
  ok("an exit drops the hold", await pg.evaluate(()=>{ const c=curChat(); c.presentIds=["p_sami","p_berk"]; c.outfitHeld={p_berk:{text:"x",why:"location",day:1,loc:"L_cafe"}}; applyPresence(c,[],["Berker Özüçak"]); return !c.outfitHeld.p_berk; }));

  console.log("\n[3 + 9. the writer gets garments, in third person; props are only suggestions]");
  const S=await pg.evaluate(()=>[
    _imgOutfitSplit(_imgOutfitThird("You wear a pair of low-slung black boxer briefs and a lazy, knowing grin, the rest of your clothes left in a trail from the front door.","Man")),
    _imgOutfitSplit(_imgOutfitThird("You wear a black polo, dark grey trousers, holding a bottle of good rakı.","Man")),
    _imgOutfitSplit(_imgOutfitThird("You wear a navy bomber over a white tee and black jeans.","Man")),
    _imgOutfitSplit(_imgOutfitThird("You wear your black and white striped dress and your mother's pearls.","Woman"))]);
  ok("props, business and expressions are split off the garments",
     S[0].wear==="a pair of low-slung black boxer briefs"&&/knowing grin/.test(S[0].extra)&&/the rest of his clothes/.test(S[0].extra)
     &&S[1].wear==="a black polo, dark grey trousers"&&S[1].extra==="holding a bottle of good rakı", JSON.stringify(S));
  ok("garments joined by 'and' stay whole, and 'your' becomes the person's own",
     S[2].wear==="a navy bomber over a white tee and black jeans"&&S[2].extra===""&&S[3].wear==="her black and white striped dress and her mother's pearls", JSON.stringify(S));
  await pg.evaluate(()=>{ window.__out="a written prompt"; });
  const G=await draw(scene({loc:"L_emre",sub:"e2",period:"Evening",day:2,present:["p_sami","p_berk"]})+push([{role:"assistant",speaker:"Sami Özüçak",speakerId:"p_sami",content:"*Maşayı alıp köfteleri çeviriyor.*"}]));
  const GW=G.usr.slice(G.usr.indexOf("WHAT EACH PERSON IS WEARING"),G.usr.indexOf("WHERE THIS FRAME"));
  ok("POV frame: no 'You wear…' and no 'your' in the outfit lines (the lens is 'you' here)", !/\bYou wear\b|\byour\b|yourself/i.test(GW), GW);
  ok("the garments are decided, the rakı bottle and the glass are not",
     /Berker Özüçak — already decided, draw these garments: a black polo, dark grey trousers \(not decided — only if the exchange agrees: holding a bottle of good rakı\)/.test(GW)
     &&/Sami Özüçak — already decided, draw these garments: a dark green silk shirt, left mostly unbuttoned, and black trousers \(not decided — only if the exchange agrees: making himself at home with a glass of rakı\)/.test(GW)
     &&!/draw exactly this/.test(GW), GW);

  /* ---------------------------------------------------------------- 6. narration */
  console.log("\n[6. what the narration says about someone reaches their line]");
  const N=await draw(scene({loc:"L_mill",sub:"m2",present:["p_sami","p_burak"]})+push([
    {role:"assistant",speaker:"Narrator",narratorEvent:true,content:"*Yemekhanenin kapısında Burak Atan beliriyor; gece vardiyasına daha saatler varken tulumunu giymiş.*"},
    {role:"assistant",speaker:"Sami Özüçak",speakerId:"p_sami",content:"*Tepsisini bırakıyor.*"},
    {role:"user",content:"*Burak'a el sallıyorum.*"},
    {role:"assistant",speaker:"Burak Atan",speakerId:"p_burak",content:"*Masaya yaklaşıyor.*"}]));
  ok("the narrator's line about Burak is in the window", /Narrator: Yemekhanenin kapısında Burak Atan beliriyor; gece vardiyasına daha saatler varken tulumunu giymiş/.test(N.usr), N.usr.slice(-1500));
  ok("and on Burak's own line of what each person is doing", /= Burak Atan, whose line this picture is for: [^\n]*the narration since the last picture: Yemekhanenin kapısında Burak Atan beliriyor/.test(N.usr), N.usr.slice(0,1800));
  ok("and a narrated change is allowed to beat the table's outfit", /any line in this request that says what someone has on — still overrides/.test(N.usr)
     &&/Burak Atan — already decided, draw these garments: a light blue oxford shirt and a navy tie \(not decided — only if the exchange agrees: carrying a well-organized briefcase\)/.test(N.usr), N.usr.slice(0,2200));
  ok("a narrator line about nobody in the frame stays out", await (async()=>{
      const X=await draw(scene({loc:"L_mill",sub:"m2",present:["p_sami","p_berk"]})+push([{role:"assistant",speaker:"Narrator",narratorEvent:true,content:"*Uzakta Hasan kamyonunu park ediyor.*"},
        {role:"user",content:"*Oturuyorum.*"},{role:"assistant",speaker:"Sami Özüçak",speakerId:"p_sami",content:"*Gülüyor.*"}]));
      return !/Hasan kamyonunu/.test(X.usr)?true:X.usr.slice(-900); })());
  ok("the one-on-one reply path runs the wearing tracker too", (()=>{
      const src=fs.readFileSync(path.resolve(__dirname,'..','index.html'),'utf8');
      const i=src.indexOf("only done in the multi-character path, so one-on-one scenes never ran presence detection");
      return /await runPresenceTracker\(chat\);[\s\S]{0,400}await runWearingTracker\(chat\)/.test(src.slice(i,i+700))?true:"not wired"; })());

  /* ---------------------------------------------------------------- 4. words only */
  console.log("\n[4. a picture drawn from words alone gives everyone a look]");
  await pg.evaluate(()=>{ window.usesRefImage=()=>false; window.__rule={label:"Group",cast:"group",pov:false,promptStyle:IMG_STYLE_INTIMATE}; });
  const WO=await draw(scene({loc:"L_emre",sub:"e2",period:"Evening",day:2,present:["p_sami","p_buket","p_ozlem","p_hasan"]})+push([{role:"assistant",speaker:"Sami Özüçak",speakerId:"p_sami",content:"*Gülüyor.*"}]));
  await pg.evaluate(()=>{ window.usesRefImage=()=>true; window.__rule=Object.assign({},DEFAULT_IMG_RULES.find(r=>r.id==="r_pov_talk")); });
  ok("man or woman comes from the card when the look does not say it (Buket, Özlem)",
     /- Buket Özüçak: Woman — Average height/.test(WO.usr)&&/- Özlem Özüçak: Woman\n/.test(WO.usr)&&/- Sami Özüçak, whose line this picture is for: Man/.test(WO.usr), WO.usr.slice(0,900));
  ok("someone with nothing written is given a look to keep, never 'keep them plain'",
     /- Hasan: \(no written look — choose one that fits the story, and keep it the same in every frame\)/.test(WO.usr)&&!/keep them plain/.test(WO.usr), WO.usr.slice(0,900));
  ok("the player's look is in the list too", /- Emre \(the player\): Man/.test(WO.usr), WO.usr.slice(0,900));
  ok("and the writer is told the no-face rules do not apply to these words", /any rule above against describing a face, hair, build or age does not apply here/.test(WO.usr), "");

  /* ---------------------------------------------------------------- 7. visual director */
  console.log("\n[7. the visual director sees where, when and who]");
  const VD=await pg.evaluate(async()=>{
    const c=curChat(); c.locationId="L_cafe"; c.subId="c2"; c.presentIds=["p_sami","p_berk"]; c.subPos={p_sami:"c2",p_berk:"c2"}; c.period="Evening";
    c.messages=[{mid:"v1",role:"assistant",speaker:"Sami Özüçak",speakerId:"p_sami",content:'*Kapıda Emre\'ye sarılıyor.* "Harika akşamdı kardeşim!" _Bir daha gelmem._',
                 imgState:"loading",imgMeta:{loc:"L_cafe",sub:"c2",period:"Evening",day:1,place:"Vanadium Cafe's Outdoor Patio",ids:["p_sami","p_berk"]}},
                {mid:"v2",role:"user",content:'"Görüşürüz." _Nihayet._'},
                {mid:"v3",role:"assistant",speaker:"Berker Özüçak",speakerId:"p_berk",content:"*Ceketini giyiyor.*"}];
    let drew=0; const ri=window.illustrate; window.illustrate=async()=>{ drew++; };
    window.__vd=null; await decideVisual("v3","*Ceketini giyiyor.*");
    const asked=window.__vd?window.__vd.map(m=>m.content).join("\n"):"";
    // the place changed since the picture: a new picture without asking
    c.subId="c1"; c.subPos={p_sami:"c1",p_berk:"c1"}; window.__vd=null; await decideVisual("v3","*Ceketini giyiyor.*");
    const asked2=!!window.__vd, drew2=drew;
    // someone left since the picture
    c.subId="c2"; c.subPos={p_sami:"c2"}; c.presentIds=["p_sami"]; window.__vd=null; await decideVisual("v3","x");
    const asked3=!!window.__vd;
    window.illustrate=ri;
    return {asked,asked2,drew2,asked3,drew};
  });
  ok("a picture still being drawn is described by its moment, as the camera sees it — not the raw line",
     /\(still being drawn, for this moment\) Kapıda Emre'ye sarılıyor\./.test(VD.asked)&&!/Harika akşamdı/.test(VD.asked.split("THE LATEST EXCHANGE")[0]), VD.asked);
  ok("where and when the picture is, and where and when it is now, with who",
     /WHERE AND WHEN THAT PICTURE IS: Vanadium Cafe's Outdoor Patio, Evening, showing Sami Özüçak, Berker Özüçak/.test(VD.asked)
     &&/WHERE AND WHEN IT IS NOW: Vanadium Cafe's Outdoor Patio, Evening, with Sami Özüçak, Berker Özüçak/.test(VD.asked), VD.asked);
  ok("inner thoughts are not in what it judges", !/Bir daha gelmem|Nihayet/.test(VD.asked), VD.asked);
  ok("a new area, or someone leaving, is a new picture without asking", VD.asked2===false&&VD.asked3===false&&VD.drew===2, JSON.stringify(VD));

  /* ---------------------------------------------------------------- minors */
  console.log("\n[no intimate scene type for a frame with a minor in it]");
  const MN=await pg.evaluate(async()=>{
    const uni=state.universes[0];
    if(!state.personas.some(p=>p.id==="p_nil")) state.personas.push({id:"p_nil",name:"Nil",universeId:uni.id,look:{subject:"Girl"},refs:["data:N1"],instructions:"x",personality:"x"});
    state.imgRules=DEFAULT_IMG_RULES.map(r=>({...r}));
    let seen=null; const keep=window.pickRule; window.pickRule=async(r,t)=>{ seen=(r||[]).map(x=>x.id); return (r||[])[0]; };
    const run=async(present)=>{ const c=curChat(); c.locationId="L_cafe"; c.subId="c2"; c.presentIds=present; c.subPos={}; present.forEach(id=>c.subPos[id]="c2");
      c.messages=[{mid:"n1",role:"user",content:"*I sit down.*",present},{mid:"n2",role:"assistant",speaker:"Sami Özüçak",speakerId:"p_sami",content:"*Gülüyor.*",present}];
      seen=null; await illustrate("n2","*Gülüyor.*",true); return seen||[]; };
    const had=typeof window.isMinorChar==="function", keepM=window.isMinorChar;
    const before=await run(["p_sami","p_nil"]);                     // no isMinorChar in this build: nothing changes
    window.isMinorChar=p=>!!p&&p.id==="p_nil";
    const withMinor=await run(["p_sami","p_nil"]);
    const adults=await run(["p_sami","p_berk"]);
    if(had)window.isMinorChar=keepM; else delete window.isMinorChar;
    window.pickRule=keep;
    const bad=withMinor.filter(id=>_imgRuleIntimate(state.imgRules.find(r=>r.id===id)));
    return {before:before.length,withMinor,bad,adults:adults.length,total:state.imgRules.length,
      custom:_imgRuleIntimate({id:"mine",label:"Mine",explicit:true})&&_imgRuleIntimate({id:"x",label:"Slow kiss at the door"})&&!_imgRuleIntimate({id:"y",label:"Walking together"}),
      covered:["r_intimate_std","r_kissing","r_embrace","r_intimate","r_temptation","r_groping","r_pen_missionary","r_pen_doggy","r_standing_behind","r_oral","r_facesit","r_aftermath"].every(id=>_imgRuleIntimate(state.imgRules.find(r=>r.id===id)))};
  });
  ok("with a minor in the frame, no intimate or sexual scene type reaches the router", MN.bad.length===0&&MN.withMinor.length>0&&MN.withMinor.includes("r_pov_talk"), JSON.stringify(MN));
  ok("every contact / sexual built-in counts, and a custom rule marked explicit or labelled as one does too", MN.covered&&MN.custom, JSON.stringify(MN));
  ok("adults only, or no isMinorChar in this build: the full menu as before", MN.adults===MN.total&&MN.before===MN.total, JSON.stringify(MN));

  await pg.evaluate(()=>{ Object.assign(window,window.__real); });
  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log(`\n  ${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail?1:0);
})();
