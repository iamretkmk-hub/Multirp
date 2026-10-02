/* v150.5 — ONE PROFILE PICTURE, ONE REFERENCE SHEET, AND A POSE PICTURE PER SCENE TYPE.
   Asked: "In each character's bio there are 4 picture slots for profile and 4 for reference — decrease
   these two to one. And add a new section, pose presets: each image scene in the image settings makes
   a slot in each character's bio where I upload a reference image for that pose. When that pose is
   selected for image generation, that image is uploaded instead of the character's face — no
   character or player picture is uploaded. They are uploaded only if the scene has no dedicated image.
   The location and image continuity stay as is."
   Checked:
     1. the character editor shows one profile slot, one reference-sheet slot, and a pose slot for
        every image scene type; a pose picture survives a save, and a slot for a deleted scene type
        does not;
     2. generation takes one picture per character, while the player keeps four;
     3. through a real illustrate() → atlasImage() (network stubbed): with a pose picture for the
        routed scene type, it is the ONLY picture sent and the writer and the image model are told what
        it is; another scene type, or another character, still sends the faces;
     4. with the scene chain, the previous picture still goes last after the pose picture.
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

  console.log("\n[1. the character editor]");
  const E=await pg.evaluate(async()=>{
    const uni=state.universes[0];
    state.imgRules=[{id:"r_talk",label:"Talking",cast:"player",pov:false,promptStyle:"",enabled:true},
                    {id:"r_hug",label:"Hug",cast:"player",pov:true,promptStyle:"",enabled:true}];
    state.personas=[{id:"p_sami",name:"Sami",universeId:uni.id,look:{subject:"Man"},image:"data:image/png;base64,S1",
      refImages:["data:image/png;base64,S2","data:image/png;base64,S3"],instructions:"x",personality:"x",
      poseRefs:{r_hug:"data:image/png;base64,HUG",r_gone:"data:image/png;base64,OLD"}}];   // a v150.6 card: one string per scene type
    editPersona("p_sami");
    const slots=id=>document.querySelectorAll('#'+id+' .refSlot').length;
    const out={profile:slots('peAvatarPreview'),sheet:slots('peMediaRef'),
      poseTalk:slots('pePose_r_talk'),poseHug:slots('pePose_r_hug'),
      hugFilled:document.querySelectorAll('#pePose_r_hug .refSlot img').length,talkFilled:document.querySelectorAll('#pePose_r_talk .refSlot img').length,
      labels:Array.from(document.querySelectorAll('#pePoseRefs .poseRow .poseName')).map(c=>c.textContent.trim()),
      kept:peImages.slice()};
    // several pictures for one scene type
    _pePoseAdd("r_talk","data:image/png;base64,TALK1"); _pePoseAdd("r_talk","data:image/png;base64,TALK2"); _pePoseAdd("r_talk","data:image/png;base64,TALK3");
    out.dupe=_pePoseAdd("r_talk","data:image/png;base64,TALK1");
    renderPePoseRefs();
    out.talkThumbs=document.querySelectorAll('#pePose_r_talk .refSlot img').length;
    out.talkAdd=document.querySelectorAll('#pePose_r_talk .refSlot.empty').length;
    out.talkName=document.querySelectorAll('#pePoseRefs .poseRow .poseName')[0].textContent;
    for(let i=4;i<=10;i++)_pePoseAdd("r_hug","data:image/png;base64,H"+i);
    out.hugCap=_poseList(pePoseRefs.r_hug).length; renderPePoseRefs();
    out.hugAdd=document.querySelectorAll('#pePose_r_hug .refSlot.empty').length;
    // the × removes just that one picture
    document.querySelectorAll('#pePose_r_hug .rsDel')[1].click();
    out.hugAfterDel=_poseList(pePoseRefs.r_hug);
    savePersona();
    const p=state.personas.find(x=>x.id==="p_sami");
    out.saved=p.poseRefs; out.savedImage=p.image; out.savedRefs=p.refImages;
    return out;
  });
  ok("one profile-picture slot", E.profile===1, JSON.stringify(E));
  ok("one reference-sheet slot", E.sheet===1, JSON.stringify(E));
  ok("a pose row for every image scene type, by name", /Talking/.test(E.labels[0])&&/Hug/.test(E.labels[1]), JSON.stringify(E.labels));
  ok("an older card's single pose picture reads as a list of one (with an add tile); an empty row is one line, no tiles",
     E.hugFilled===1&&E.poseHug===2&&E.talkFilled===0&&E.poseTalk===0, JSON.stringify(E));
  ok("one scene type takes several pictures, each shown with an add tile after them",
     E.talkThumbs===3&&E.talkAdd===1&&/3, one at random/.test(E.talkName), JSON.stringify(E));
  ok("the same picture is not added twice", E.dupe===false, JSON.stringify(E.dupe));
  ok("up to eight per scene type, and the add tile goes when full", E.hugCap===8&&E.hugAdd===0, JSON.stringify(E));
  ok("the × removes just that picture", E.hugAfterDel.length===7&&E.hugAfterDel.indexOf("data:image/png;base64,H4")<0&&E.hugAfterDel[0]==="data:image/png;base64,HUG", JSON.stringify(E.hugAfterDel));
  ok("only the first of an older card's pictures is kept", JSON.stringify(E.kept)==='["data:image/png;base64,S1"]', JSON.stringify(E.kept));
  ok("saving keeps every pose picture as a list and drops a scene type that is gone",
     JSON.stringify(Object.keys(E.saved).sort())==='["r_hug","r_talk"]'&&E.saved.r_hug.length===7
     &&JSON.stringify(E.saved.r_talk)==='["data:image/png;base64,TALK1","data:image/png;base64,TALK2","data:image/png;base64,TALK3"]', JSON.stringify(E.saved).slice(0,300));
  ok("and the card is left with one profile picture", E.savedImage==="data:image/png;base64,S1"&&(E.savedRefs||[]).length===0, JSON.stringify([E.savedImage,E.savedRefs]));
  const U=await pg.evaluate(async()=>{ const box=document.getElementById('pePoseRefs'); const n0=box.querySelectorAll('.poseRow').length;
    state.imgRules.push({id:"r_new",label:"Kiss",cast:"player",pov:false,promptStyle:"",enabled:true}); editPersona("p_sami");
    const n1=document.getElementById('pePoseRefs').querySelectorAll('.poseRow').length; state.imgRules.pop(); return [n0,n1]; });
  ok("a new scene type gets a new slot in every character's bio", U[0]===2&&U[1]===3, JSON.stringify(U));
  await pg.evaluate(()=>{ try{ closeModal&&closeModal('personaModal'); }catch(e){} });

  console.log("\n[2. one picture per character for generation; the player keeps four]");
  const R=await pg.evaluate(()=>({c:personRefs({id:"x",image:"a",refImages:["b","c"]}),pl:personRefs({image:"a",refImages:["b","c","d"]})}));
  ok("a character sends one picture", JSON.stringify(R.c)==='["a"]', JSON.stringify(R.c));
  ok("the player still sends up to four", JSON.stringify(R.pl)==='["a","b","c","d"]', JSON.stringify(R.pl));

  console.log("\n[3. a pose picture replaces every face]");
  await pg.evaluate(()=>{
    const uni=state.universes[0];
    uni.locations=[{id:"L_cafe",name:"Vanadium Cafe",description:"A coffee bar.",residents:[],sublocations:[{id:"c1",name:"Entrance",entrance:true,description:"A glass door."}]}];
    const mk=(id,n,subj,img,extra)=>Object.assign({id,name:n,universeId:uni.id,look:{subject:subj},image:img,instructions:"x",personality:"x"},extra||{});
    state.personas=[mk("p_sami","Sami","Man","data:S1",{poseRefs:{r_hug:"data:HUG"}}),mk("p_burcu","Burcu","Woman","data:U1")];
    state.user="Emre"; state.key="k"; state.autoImg=false; state.userSubject="Man";
    const c=curChat(); c.universeId=uni.id; state.curUniverse=uni.id;
    window.playerRefs=()=>["data:E1"]; window._playerRefHolder=()=>({look:{subject:"Man"}});
    window.toDataUri=async u=>u;
    window.saveMsgImage=(m,u,cb)=>{ if(cb)cb(true); }; window.captureGalleryMedia=()=>{};
    state.atlasKey="test-key"; state.imgProvider="atlascloud"; state.imgModel="bytedance/seedream-v4.5/edit";
    window.__rule=state.imgRules.find(r=>r.id==="r_hug");
    window.pickRule=async()=>window.__rule;
    window.chatCompletion=async(messages,model,opts)=>{ if(opts&&opts.dbg==="Image prompt writer"){ window.__writer=messages; return "the man holds the woman close"; } return "{}"; };
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
    const c=curChat(); if(a.rule)window.__rule=state.imgRules.find(r=>r.id===a.rule);
    const m={mid:"m"+c.messages.length,role:"assistant",speaker:a.who||"Sami",speakerId:a.id||"p_sami",content:a.line||"*He pulls her into a hug.*",present:c.presentIds.slice()};
    c.messages.push(m); window.__writer=null; window.__body=null;
    await illustrate(m.mid,m.content,true);
    return {state:m.imgState,err:m.imgErr||"",images:(window.__body||{}).images||[],prompt:(window.__body||{}).prompt||"",pose:m.imgPose||null,
      usr:(window.__writer||[]).filter(x=>x.role==="user").map(x=>x.content).join("\n")};
  },o||{});
  const P=await draw();
  ok("it generated", P.state==="done", JSON.stringify(P));
  ok("the pose picture is the only picture sent — no face of Sami, Burcu or the player", JSON.stringify(P.images)==='["data:HUG"]', JSON.stringify(P.images));
  ok("the image model is told it is the pose reference", /^Figure 1 is the pose reference for this scene/.test(P.prompt), P.prompt.slice(0,300));
  ok("the writer is told a pose picture goes instead of the faces, and who is in the frame",
     /POSE REFERENCE/.test(P.usr)&&/Sami, whose line this picture is for/.test(P.usr)&&/Burcu/.test(P.usr)&&!/PEOPLE IN THIS FRAME/.test(P.usr), P.usr.slice(0,800));
  ok("the clothes and the place are still described on this first picture", /WHERE THIS FRAME HAPPENS/.test(P.usr), P.usr.slice(0,1200));
  ok("the message records the pose used", P.pose==="r_hug", JSON.stringify(P.pose));

  console.log("\n[4. the scene chain still applies]");
  const Q=await draw({line:"*He holds her tighter.*"});
  ok("the pose picture first, the previous picture last, still no faces", JSON.stringify(Q.images)==='["data:HUG","https://out/1.png"]', JSON.stringify(Q.images));
  ok("and the image model is told both", /Figure 1 is the pose reference/.test(Q.prompt)&&/Figure 2 is not a person: it is the current scene/.test(Q.prompt), Q.prompt.slice(0,500));

  console.log("\n[5. no dedicated picture: the faces go as before]");
  const T=await draw({rule:"r_talk",line:"*He sits down.*"});
  ok("another scene type with an empty slot sends the faces", T.images.indexOf("data:S1")===0&&T.images.indexOf("data:HUG")<0&&T.pose===null, JSON.stringify(T.images));
  /* v150.8 — reported: an intimate scene sent two faces and the previous picture though a pose picture
     was set — on the other person in the frame. Whoever in the frame holds one supplies it. */
  const B2=await draw({rule:"r_hug",who:"Burcu",id:"p_burcu",line:"*She hugs him back.*"});
  ok("the speaker has no pose picture but the other person in the frame does: theirs is sent, no faces (the reported case)",
     B2.images[0]==="data:HUG"&&B2.images.indexOf("data:U1")<0&&B2.images.indexOf("data:S1")<0&&B2.images.indexOf("data:E1")<0&&B2.pose==="r_hug", JSON.stringify(B2.images));
  const LOG=await pg.evaluate(()=>{ const l=dbgLog; const e=(Array.isArray(l)?l:[]).slice().reverse().find(x=>x&&/pose presets/.test(x.label||"")); return e?{ep:e.endpoint,res:String(e.result||"")}:null; });
  ok("the debug log says which scene type was drawn and whose pose picture went", !!LOG&&/scene type: Hug/.test(LOG.ep)&&/sent Sami's pose picture 1 of 1/.test(LOG.res), JSON.stringify(LOG));
  const B3=await pg.evaluate(()=>{ state.personas.find(p=>p.id==="p_burcu").poseRefs={r_hug:["data:BHUG"]}; return true; });
  const B4=await draw({rule:"r_hug",who:"Burcu",id:"p_burcu",line:"*She holds on.*"});
  ok("when both have one, the speaker's own wins", B4.images[0]==="data:BHUG", JSON.stringify(B4.images));
  await pg.evaluate(()=>{ delete state.personas.find(p=>p.id==="p_burcu").poseRefs; state.personas.find(p=>p.id==="p_sami").poseRefs={}; });
  const B5=await draw({rule:"r_hug",who:"Burcu",id:"p_burcu",line:"*She lets go.*"});
  ok("nobody in the frame holds one: the faces go as before", B5.images.indexOf("data:U1")===0&&B5.images.indexOf("data:HUG")<0, JSON.stringify(B5.images));
  const LOG2=await pg.evaluate(()=>{ const l=dbgLog; const e=(Array.isArray(l)?l:[]).slice().reverse().find(x=>x&&/pose presets/.test(x.label||"")); return e?String(e.result||""):""; });
  ok("and the debug log says why", /nobody in this frame has a pose picture for "Hug"/.test(LOG2), LOG2);
  await pg.evaluate(()=>{ state.personas.find(p=>p.id==="p_sami").poseRefs={r_hug:"data:HUG"}; });

  console.log("\n[6. several pictures for one scene type: one at random, each equally likely]");
  const RR=await pg.evaluate(async()=>{
    const sami=state.personas.find(p=>p.id==="p_sami"); sami.poseRefs={r_hug:["data:H0","data:H1","data:H2"]};
    window.__rule=state.imgRules.find(r=>r.id==="r_hug");
    // the roll is uniform: 30000 rolls over 3 pictures land near 10000 each
    const n=[0,0,0]; for(let i=0;i<30000;i++)n[_poseRoll(3)]++;
    const pick=[0,0,0]; for(let i=0;i<3000;i++)pick[poseRefPick(sami,window.__rule).idx]++;
    // a fixed roll sends exactly that picture, alone
    const keep=window._poseRoll; window._poseRoll=()=>2;
    const c=curChat(); const m={mid:"mr"+c.messages.length,role:"assistant",speaker:"Sami",speakerId:"p_sami",content:"*He hugs her.*",present:c.presentIds.slice()};
    c.messages.push(m); window.__body=null; await illustrate(m.mid,m.content,true);
    window._poseRoll=keep;
    return {n,pick,one:_poseRoll(1),imgs:(window.__body||{}).images||[],idx:m.imgPoseIdx};
  });
  ok("the roll is uniform (30000 rolls over three pictures)", RR.n.every(x=>x>9400&&x<10600), JSON.stringify(RR.n));
  ok("every picture is picked, about equally often", RR.pick.every(x=>x>850&&x<1150), JSON.stringify(RR.pick));
  ok("a single picture is always the one", RR.one===0);
  ok("the picked picture is the one sent — first, alone, before the previous scene picture",
     RR.imgs[0]==="data:H2"&&RR.imgs.indexOf("data:H0")<0&&RR.imgs.indexOf("data:H1")<0&&RR.imgs.indexOf("data:S1")<0&&RR.idx===2, JSON.stringify(RR));

  ok("the two pose prompts are registry prompts on the image writer's card", await pg.evaluate(()=>
     ["x_img_pose_writer","x_img_pose_roster"].every(k=>!!PROMPT_BY_KEY[k]&&!!K[k]&&ENGINE_PAYLOAD_DEFS.some(d=>(d.blocks||[]).some(x=>x.promptKey===k)))));
  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log("\n  "+pass+" passed, "+fail+" failed");
  await b.close();
  process.exit(fail?1:0);
})();
