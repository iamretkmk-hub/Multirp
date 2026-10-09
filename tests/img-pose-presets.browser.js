/* v150.16 — POSE PICTURES BELONG TO THE SCENE TYPE, SHARED BY EVERY CHARACTER.
   Asked: "We placed specific scenes for each character separately. Remove that; we put it on the image
   scene. Each character uses the same models from the scene, we can add more than one and it is
   randomly picked. They are 3D grey models so they fit any character."
   Also kept from earlier rounds: one profile picture and one reference sheet per character (v150.5),
   the faces first and the pose picture last (v150.11: speaker, player, pose; POV: speaker, pose), no
   previous scene picture on a pose frame (v150.10), a uniform random pick (v150.7).
   Checked:
     1. the character editor has one profile slot, one reference-sheet slot and no pose section;
     2. a scene type in Settings › Image has a pose-picture strip: pictures go to IndexedDB under
        simg:pose:<id> (so backups carry them), the rule keeps only the ids, up to eight, × removes one;
     3. through a real illustrate() → atlasImage() (network stubbed): every character gets the scene
        type's pose picture, last, after the faces; a scene type with none sends the faces as before;
        a pose picture left on a character card by an older build is ignored;
     4. the pick is uniform, and a fixed roll sends exactly that picture.
   Run: node tests/img-pose-presets.browser.js */
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:process.env.SM_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage({viewport:{width:412,height:915}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file://'+require('path').resolve(__dirname,'..','index.html'));
  await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(600);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x||c).slice(0,900));} };

  console.log("\n[1. the character editor: one profile picture, one sheet, no pose section]");
  const E=await pg.evaluate(()=>{
    const uni=state.universes[0];
    state.personas=[{id:"p_sami",name:"Sami",universeId:uni.id,look:{subject:"Man"},image:"data:image/png;base64,S1",
      refImages:["data:image/png;base64,S2"],instructions:"x",personality:"x"}];
    editPersona("p_sami");
    const slots=id=>document.querySelectorAll('#'+id+' .refSlot').length;
    const r={profile:slots('peAvatarPreview'),sheet:slots('peMediaRef'),poseSection:!!document.getElementById('pePoseRefs'),
      text:/Pose presets/.test((document.getElementById('personaModal')||document.body).textContent)};
    try{ closeModal('personaModal'); }catch(e){}
    return r;
  });
  ok("one profile slot and one reference-sheet slot", E.profile===1&&E.sheet===1, JSON.stringify(E));
  ok("no pose section on the character card any more", E.poseSection===false&&E.text===false, JSON.stringify(E));
  const R=await pg.evaluate(()=>({c:personRefs({id:"x",image:"a",refImages:["b","c"]}),pl:personRefs({image:"a",refImages:["b","c","d"]})}));
  ok("a character sends one picture, the player up to four", JSON.stringify(R.c)==='["a"]'&&JSON.stringify(R.pl)==='["a","b","c","d"]', JSON.stringify(R));

  console.log("\n[2. the scene type holds the pose pictures]");
  const S=await pg.evaluate(async()=>{
    state.imgRules=[{id:"r_talk",label:"Talking",when:"x",cast:"player",pov:false,promptStyle:"",enabled:true},
                    {id:"r_hug",label:"Hug",when:"x",cast:"player",pov:true,promptStyle:"",enabled:true},
                    {id:"r_bed",label:"In bed",when:"x",cast:"player",pov:false,promptStyle:"",enabled:true}];
    const hug=state.imgRules[1];
    await rulePoseAdd(hug,"data:HUG0"); await rulePoseAdd(hug,"data:HUG1");
    await rulePoseAdd(state.imgRules[2],"data:BED");
    const ids=rulePoseIds(hug);
    const stored=await mediaDB.kvGet("simg:pose:"+ids[0]);
    const saved=(store.get(K.imgRules,[])||[]).find(r=>r.id==="r_hug");
    const backup=(await collectStaticImageRecords()).filter(x=>/^simg:pose:/.test(x.key)).length;
    // the editor strip
    show('settings'); renderRules('img'); toggleRuleOpen('img','r_hug'); await new Promise(r=>setTimeout(r,300));
    const strip=document.querySelector('#imgRuleList .rulePoses');
    const thumbs=strip?strip.querySelectorAll('.refSlot img').length:-1, add=strip?strip.querySelectorAll('.refSlot.empty').length:-1;
    // × removes one, and its bytes
    const gone=ids[1]; strip.querySelector('[data-pose="'+gone+'"] .rsDel').click(); await new Promise(r=>setTimeout(r,300));
    const after=rulePoseIds(hug), goneBytes=await mediaDB.kvGet("simg:pose:"+gone);
    await rulePoseAdd(hug,"data:HUG1");
    // the cap
    const cap=state.imgRules[0]; for(let i=0;i<10;i++)await rulePoseAdd(cap,"data:T"+i);
    const capN=rulePoseIds(cap).length; cap.poses=[];
    return {ids:ids.length,stored,inRule:JSON.stringify(hug).indexOf("data:")<0,savedIds:saved&&saved.poses&&saved.poses.length,backup,thumbs,add,after:after.length,goneBytes,capN};
  });
  ok("pose pictures are stored in IndexedDB as static images; the rule keeps only ids", S.ids===2&&S.stored==="data:HUG0"&&S.inRule===true, JSON.stringify(S));
  ok("the ids are saved with the scene types", S.savedIds===2, JSON.stringify(S));
  ok("a full backup carries them (static image records)", S.backup>=3, JSON.stringify(S));
  ok("the scene type's editor shows every picture and an add tile", S.thumbs===2&&S.add===1, JSON.stringify(S));
  ok("× removes that picture and its bytes", S.after===1&&!S.goneBytes, JSON.stringify(S));
  ok("up to eight per scene type", S.capN===8, JSON.stringify(S));

  console.log("\n[3. every character gets the scene type's pose picture, after the faces]");
  await pg.evaluate(()=>{
    const uni=state.universes[0];
    uni.locations=[{id:"L_cafe",name:"Vanadium Cafe",description:"A coffee bar.",residents:[],sublocations:[{id:"c1",name:"Entrance",entrance:true,description:"A glass door."}]}];
    const mk=(id,n,subj,img,extra)=>Object.assign({id,name:n,universeId:uni.id,look:{subject:subj},image:img,instructions:"x",personality:"x"},extra||{});
    // Burcu still carries a v150.7-style per-character pose picture: it must be ignored now
    state.personas=[mk("p_sami","Sami","Man","data:S1"),mk("p_burcu","Burcu","Woman","data:U1",{poseRefs:{r_hug:["data:OLD"]}})];
    state.user="Emre"; state.key="k"; state.autoImg=false; state.userSubject="Man";
    const c=curChat(); c.universeId=uni.id; state.curUniverse=uni.id;
    window.playerRefs=()=>["data:E1"]; window._playerRefHolder=()=>({look:{subject:"Man"}});
    window.toDataUri=async u=>u;
    window.saveMsgImage=(m,u,cb)=>{ if(cb)cb(true); }; window.captureGalleryMedia=()=>{};
    state.atlasKey="test-key"; state.imgProvider="atlascloud"; state.imgModel="bytedance/seedream-v4.5/edit";
    window.pickRule=async()=>window.__rule;
    window.chatCompletion=async(messages,model,opts)=>{ if(opts&&opts.dbg==="Image prompt writer"){ window.__writer=messages; return "the frame"; } return "{}"; };
    window.__n=0;
    window.fetch=async(u,o)=>{
      if(/generateImage$/.test(String(u))){ window.__body=JSON.parse(o.body); window.__n++;
        return {ok:true,status:200,json:async()=>({data:{id:"p"+window.__n,status:"completed",outputs:["https://out/"+window.__n+".png"]}})}; }
      return {ok:false,status:404,json:async()=>({}),text:async()=>""};
    };
    c.locationId="L_cafe"; c.location="Vanadium Cafe"; c.subId="c1"; c.subPos={}; c.presentIds=["p_sami","p_burcu"];
    c.presentIds.forEach(id=>c.subPos[id]="c1"); c.period="Midday"; c.gameDay=1;
    c.messages=[]; c.imgPromptBy={}; c.imgWindowBy={}; c.lastImgRuleBy={}; c.imgContBy={};
  });
  const draw=(o)=>pg.evaluate(async(a)=>{
    const c=curChat(); window.__rule=state.imgRules.find(r=>r.id===a.rule);
    const m={mid:"m"+c.messages.length,role:"assistant",speaker:a.who||"Sami",speakerId:a.id||"p_sami",content:a.line||"*He pulls her into a hug.*",present:c.presentIds.slice()};
    c.messages.push(m); window.__writer=null; window.__body=null;
    const keep=window._poseRoll; if(a.roll!=null)window._poseRoll=()=>a.roll;
    await illustrate(m.mid,m.content,true);
    window._poseRoll=keep;
    const log=dbgLog.slice().reverse().find(x=>x&&/pose presets/.test(x.label||""));
    return {state:m.imgState,err:m.imgErr||"",images:(window.__body||{}).images||[],prompt:(window.__body||{}).prompt||"",pose:m.imgPose||null,
      log:log?String(log.result||""):"",usr:(window.__writer||[]).filter(x=>x.role==="user").map(x=>x.content).join("\n")};
  },o||{});
  const P=await draw({rule:"r_hug",roll:0});
  ok("a POV scene type: the speaker's face, then the scene type's pose picture last", P.state==="done"&&JSON.stringify(P.images)==='["data:S1","data:HUG0"]', JSON.stringify(P));
  ok("the image model is told Figure 2 is the pose reference", /^The man in IMAGE 1 is Figure 1/.test(P.prompt)&&/Figure 2 is the pose reference for this scene: textureless grey 3D figures/.test(P.prompt), P.prompt.slice(0,500));
  ok("the writer gets the pose block, by label", /POSE REFERENCE/.test(P.usr)&&/- the man in IMAGE 1 = Sami \(man\), whose line this picture is for \(picture 1\)/.test(P.usr)&&/Emre is the camera \(POV\)/.test(P.usr), P.usr.slice(0,800));
  ok("the debug log says which pose picture went", /sent Sami's face picture, then pose picture 1 of 2 last/.test(P.log), P.log);
  const Bu=await draw({rule:"r_hug",who:"Burcu",id:"p_burcu",line:"*She hugs him back.*",roll:1});
  ok("another character gets the SAME scene type's pose pictures (the card's old one is ignored)", JSON.stringify(Bu.images)==='["data:U1","data:HUG1"]', JSON.stringify(Bu.images));
  const NP=await draw({rule:"r_bed",line:"*He lies down beside her.*"});
  ok("not a POV scene type: the speaker, the player, then the pose picture", JSON.stringify(NP.images)==='["data:S1","data:E1","data:BED"]', JSON.stringify(NP.images));
  ok("no previous scene picture on a pose frame", NP.images.every(x=>!/^https:\/\/out\//.test(x)), JSON.stringify(NP.images));
  const T=await draw({rule:"r_talk",line:"*He sits down.*"});
  ok("a scene type with no pose pictures sends the faces as before", T.images[0]==="data:S1"&&T.images.every(x=>!/HUG|BED|OLD/.test(x))&&T.pose===null, JSON.stringify(T.images));
  ok("and the debug log says why", /"Talking" has no pose pictures — face pictures sent/.test(T.log), T.log);

  /* v150.18 — reported from a playground request: the scene type's pose picture was not sent (the face
     went alone), the writer's instructions repeated themselves, and the grey 3D figures need replacing
     with the real people, with real skin texture. */
  console.log("\n[3b. the grey figures are replaced by the real people]");
  ok("the image model is told to replace the grey figure with the speaker, as a real person",
     /Figure 2 is the pose reference for this scene: textureless grey 3D figures, not people\. Replace the man in Figure 2 with the man in IMAGE 1 \(Figure 1\)/.test(P.prompt)&&/real skin texture/.test(P.prompt), P.prompt.slice(0,700));
  ok("not POV: the woman and the man are both swapped in", /Replace the man in Figure 3 with the man in IMAGE 1 \(Figure 1\) and replace the man in Figure 3 with the man in IMAGE 2 \(Figure 2\)/.test(NP.prompt), NP.prompt.slice(0,700));
  ok("the writer is told to begin with the replacement, as real people", /textureless grey 3D model/.test(P.usr)&&/real skin texture/.test(P.usr), P.usr.slice(0,900));

  console.log("\n[3c. the playground sends the scene type's pose picture]");
  const PG=await pg.evaluate(async()=>{
    const out={};
    for(const [rid,key] of [["r_bed","bed"],["r_hug","hug"]]){
      _pg.actorId="p_sami"; _pg.ruleId=rid; _pg.refIds=[]; _pg.prompt="a man lies on a bed"; _pg.busy=null; window.__body=null;
      const keep=window._poseRoll; window._poseRoll=()=>0;
      await pgGenerate(); window._poseRoll=keep;
      out[key]={images:(window.__body||{}).images||[],prompt:(window.__body||{}).prompt||""};
    }
    // the playground's writer gets the pose block in the same labels
    let usr=""; const keepC=window.chatCompletion;
    window.chatCompletion=async(m,mod,o)=>{ if(o&&o.dbg==="Playground image prompt writer")usr=m.filter(x=>x.role==="user").map(x=>x.content).join("\n"); return "x"; };
    _pg.ruleId="r_bed"; _pg.busy=null; await pgWritePrompt(); window.chatCompletion=keepC;
    out.usr=usr; return out;
  });
  ok("the playground, not POV: the actor's face, the player's, then the pose picture (the reported case)", JSON.stringify(PG.bed.images)==='["data:S1","data:E1","data:BED"]', JSON.stringify(PG.bed.images));
  ok("the playground, POV: the actor's face, then the pose picture", JSON.stringify(PG.hug.images)==='["data:S1","data:HUG0"]', JSON.stringify(PG.hug.images));
  ok("with the same swap instruction", /Replace the man in Figure 2 with the man in IMAGE 1 \(Figure 1\)/.test(PG.hug.prompt)&&/real skin texture/.test(PG.hug.prompt), PG.hug.prompt.slice(0,500));
  /* v150.19 — reported: the playground sent the faces of whoever was in the open roleplay's scene (Burcu is in
     this chat's scene; the playground picture is of Sami alone). */
  const PS=await pg.evaluate(async()=>{
    const c=curChat(); c.presentIds=["p_sami","p_burcu"]; c.subPos={p_sami:"c1",p_burcu:"c1"};
    _pg.actorId="p_sami"; _pg.ruleId="r_talk"; _pg.refIds=[]; _pg.prompt="a man sits"; _pg.busy=null; window.__body=null;
    await pgGenerate(); return (window.__body||{}).images||[];
  });
  ok("the playground sends only its own actor (and the player), never the open scene's other people (the reported case)",
     JSON.stringify(PS)==='["data:S1","data:E1"]', JSON.stringify(PS));
  ok("the playground's writer gets the pose block, by label", /POSE REFERENCE/.test(PG.usr)&&/- the man in IMAGE 1 = Sami \(man\)/.test(PG.usr)&&/- the man in IMAGE 2 = Emre \(the player\)/.test(PG.usr), PG.usr.slice(0,700));

  console.log("\n[3d. the writer's instructions say each thing once]");
  const W=await pg.evaluate(()=>{ const f=up("imgFoundation"), g=up("imgFrameGuide"), all=f+"\n"+g;
    const n=(re)=>(all.match(re)||[]).length;
    return {brackets:n(/No square brackets/g),names:n(/never by name/gi),oneLine:n(/comma-separated English line/g),f,g}; });
  ok("one rule about brackets and lines, none of the writer's own rules repeated", W.brackets===1&&W.names===0&&W.oneLine===0, JSON.stringify({b:W.brackets,n:W.names,o:W.oneLine}));
  // an unedited copy of the old texts, saved by an earlier build, is upgraded at boot
  await pg.evaluate(()=>{
    store.setRaw(K.imgFoundation,"# FOUNDATION (base rules for this image)\nWrite ONE image prompt as a single English comma-separated line of only what is physically VISIBLE in this one frame.\nNo square brackets, no \"|\", no line breaks — write the words you chose.");
    store.setRaw(K.imgFrameGuide,"## THIS REQUEST\n- x\n- If there is NO scene-type block above, write a single comma-separated English line of what is visible this frame.");
  });
  await pg.evaluate(()=>localStorage.removeItem("sm_pipesdone")); await pg.reload(); await pg.waitForTimeout(2600);
  const UP=await pg.evaluate(()=>({f:state.imgFoundation===DEFAULT_IMG_FOUNDATION,g:state.imgFrameGuide===DEFAULT_IMG_FRAME_GUIDE}));
  ok("an old saved copy of either is upgraded to the new text", UP.f===true&&UP.g===true, JSON.stringify(UP));

  console.log("\n[4. one of them, at random, each equally likely]");
  const RR=await pg.evaluate(async()=>{
    const n=[0,0,0]; for(let i=0;i<30000;i++)n[_poseRoll(3)]++;
    const r={id:"rx",poses:[]}; await rulePoseAdd(r,"data:A"); await rulePoseAdd(r,"data:B"); await rulePoseAdd(r,"data:C");
    const pick=[0,0,0]; for(let i=0;i<1500;i++)pick[(await rulePosePick(r)).idx]++;
    const keep=window._poseRoll; window._poseRoll=()=>2; const fixed=await rulePosePick(r); window._poseRoll=keep;
    return {n,pick,one:_poseRoll(1),fixed:fixed.src,none:(await rulePosePick({id:"empty"})).src};
  });
  ok("the roll is uniform (30000 rolls over three pictures)", RR.n.every(x=>x>9400&&x<10600), JSON.stringify(RR.n));
  ok("every picture is picked, about equally often", RR.pick.every(x=>x>400&&x<600), JSON.stringify(RR.pick));
  ok("a fixed roll sends exactly that picture; one picture is always the one; none gives nothing", RR.fixed==="data:C"&&RR.one===0&&RR.none==="", JSON.stringify(RR));

  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log("\n  "+pass+" passed, "+fail+" failed");
  await b.close();
  process.exit(fail?1:0);
})();
