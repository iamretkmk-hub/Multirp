/* v150.21 — THE BODY FROM THE CARD GOES TO THE WRITERS.
   Asked: "When the prompt is written, inject the character's body section from their bio — for image and
   video both."
   Checked, with the models stubbed, on what each writer is actually given:
     1. the story's image writer: the speaker's Body (one person), and everyone's under their own label
        (several people); someone with no Body is not listed;
     2. the playground's image writer: the actor's Body;
     3. Animate, the scene video button and the playground's image → video: the Body of everyone in it.
   Run: node tests/body-inject.browser.js */
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

  await pg.evaluate(()=>{
    const uni=state.universes[0];
    state.imgRules=[{id:"r_talk",label:"Talking",when:"x",cast:"player",pov:false,promptStyle:"",enabled:true}];
    state.vidRules=[{id:"rv_talk",label:"Talking",when:"x",keywords:"",explicit:false,motionStyle:"",soundStyle:"",enabled:true}];
    uni.locations=[{id:"L",name:"Flat",description:"A flat.",residents:[],sublocations:[{id:"s1",name:"Living Room",entrance:true}]}];
    const mk=(id,n,subj,body,img)=>({id,name:n,universeId:uni.id,look:{subject:subj,body},image:img,refs:[img],instructions:"x",personality:"x"});
    state.personas=[mk("p_b","Buket","Woman","Average height, soft curvy figure, full hips","data:B1"),
                    mk("p_s","Sami","Man","Tall, broad-shouldered, heavy-set","data:S1"),
                    mk("p_n","Nur","Woman","","data:N1")];
    state.user="Emre"; state.key="k"; state.autoImg=false; state.userSubject="Man";
    const c=curChat(); c.universeId=uni.id; state.curUniverse=uni.id;
    window.personRefs=p=>(p&&p.refs)||[]; window.playerRefs=()=>["data:E1"]; window._playerRefHolder=()=>({look:{subject:"Man"}});
    window.toDataUri=async u=>u; window.saveMsgImage=(m,u,cb)=>{ if(cb)cb(true); }; window.captureGalleryMedia=()=>{};
    state.atlasKey="test-key"; state.imgProvider="atlascloud"; state.imgModel="bytedance/seedream-v4.5/edit";
    state.vidModel=VIDEO_MODEL_DEFAULT; state.vidDur=5;
    window.pickRule=async(rules)=>rules[0];
    window.__msgs={};
    window.chatCompletion=async(messages,model,opts)=>{
      const d=opts&&opts.dbg; window.__msgs[d]=messages.map(m=>m.content).join("\n");
      if(d==="Scene video writer")return JSON.stringify({shot:"third",video_prompt:"0-5s: @image1 moves.",sound_prompt:"",end_state:"x"});
      return "a frame";
    };
    window.fetch=async(u,o)=>({ok:true,status:200,json:async()=>({data:{id:"p1",status:"completed",outputs:["https://out/1.png"]}})});
    window.atlasUpload=async u=>/^https?:/.test(u)?u:"https://host/x";
    window.atlasGenerate=async(kind,body)=>({url:"https://cdn/clip.mp4",outputs:["https://cdn/clip.mp4"],raw:{}});
    c.locationId="L"; c.location="Flat"; c.subId="s1"; c.period="Afternoon"; c.gameDay=1; c.vidSceneBy={};
  });
  const draw=(present,speaker)=>pg.evaluate(async(a)=>{
    const c=curChat(); c.presentIds=a.present; c.subPos={}; a.present.forEach(id=>c.subPos[id]="s1");
    c.messages=[]; c.imgPromptBy={}; c.imgWindowBy={}; c.lastImgRuleBy={}; c.imgContBy={};
    const sp=state.personas.find(p=>p.id===a.speaker);
    c.messages.push({mid:"m1",role:"assistant",speaker:sp.name,speakerId:sp.id,content:"*Smiles.*",present:a.present.slice()});
    window.__msgs={}; await illustrate("m1","*Smiles.*",true);
    return window.__msgs["Image prompt writer"]||"";
  },{present,speaker});

  console.log("\n[1. the story's image writer]");
  const one=await draw(["p_b"],"p_b");
  ok("one person: the speaker's Body is given", /BODY — from each person's own card/.test(one)&&/Buket\)?: Average height, soft curvy figure, full hips/.test(one), one.slice(0,600));
  const two=await draw(["p_b","p_s"],"p_b");
  ok("several people: each Body under that person's own label",
     /- the woman in IMAGE 1 \(Buket\): Average height, soft curvy figure, full hips/.test(two)&&/\(Sami\): Tall, broad-shouldered, heavy-set/.test(two), two.slice(0,1200));
  const none=await draw(["p_n"],"p_n");
  ok("someone with no Body field: no block", !/BODY — from each person's own card/.test(none), none.slice(0,300));

  console.log("\n[2. the playground's image writer]");
  const PW=await pg.evaluate(async()=>{ _pg.actorId="p_s"; _pg.ruleId="r_talk"; _pg.busy=null; window.__msgs={}; await pgWritePrompt(); return window.__msgs["Playground image prompt writer"]||""; });
  ok("the actor's Body is given", /- Sami: Tall, broad-shouldered, heavy-set/.test(PW), PW.slice(0,600));

  console.log("\n[3. the video writers]");
  const V=await pg.evaluate(async()=>{
    const c=curChat(); c.presentIds=["p_b","p_s"];
    c.messages=[{mid:"u1",role:"user",content:'"Hi."',present:["p_b","p_s"]},
      {mid:"a1",role:"assistant",speaker:"Buket",speakerId:"p_b",content:"*She leans in toward Sami.*",present:["p_b","p_s"],img:"https://cdn/still.png",imgState:"done",imgCore:"the woman leans in",imgMeta:{ids:["p_b","p_s"]}}];
    window.__msgs={}; await animateScene("a1"); const anim=window.__msgs["Video motion prompt writer"]||"";
    window.__msgs={}; await sceneVideo("a1"); const scene=window.__msgs["Scene video writer"]||"";
    state.images.push({id:"img_b1",url:"https://cdn/b.png",prompt:"the woman smiles",character:"Buket",characterId:"p_b"});
    _i2v.imgId="img_b1"; _i2v.ruleId="rv_talk"; _i2v.busy=null; window.__msgs={}; await i2vWritePrompt(); const i2v=window.__msgs["Playground video prompt writer"]||"";
    return {anim,scene,i2v};
  });
  ok("Animate: everyone in the still", /- Buket: Average height, soft curvy figure, full hips/.test(V.anim)&&/- Sami: Tall, broad-shouldered, heavy-set/.test(V.anim), V.anim.slice(-500));
  ok("the scene video button: everyone in the stretch, by their @image token", /- @image1 \(Buket\): Average height/.test(V.scene)&&/- @image\d \(Sami\): Tall/.test(V.scene), V.scene.slice(-500));
  ok("the playground's image → video: the picture's character", /- Buket: Average height, soft curvy figure, full hips/.test(V.i2v), V.i2v.slice(-400));

  ok("the block is a registry prompt on the image and video writers' cards", await pg.evaluate(()=>!!PROMPT_BY_KEY.x_body_block&&["image_writer","video_writer","scene_video"].every(k=>ENGINE_PAYLOAD_DEFS.some(d=>d.key===k&&(d.blocks||[]).some(x=>x.promptKey==="x_body_block")))));
  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log("\n  "+pass+" passed, "+fail+" failed");
  await b.close();
  process.exit(fail?1:0);
})();
