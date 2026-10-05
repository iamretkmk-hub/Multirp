/* v150.17 — A VIDEO POSITION'S OWN REFERENCE VIDEOS, SHARED BY EVERY CHARACTER.
   Asked (after pose pictures moved onto the image scene types): "Also do the same for videos; this time
   we can add reference videos."
   Checked:
     1. a position in Settings › Video has a reference-video strip: the clips are Blobs in IndexedDB
        under vmotion:<id>, the rule keeps only the ids, up to eight, × removes one and its bytes;
     2. Animate: the routed position's video (one, at random) is uploaded and sent as a reference video
        after the library's own videos, and the motion writer is told its @token;
     3. the scene video button: with any position holding videos, the stretch is routed to a position and
        its video goes as @video1, named to the writer; with none, nothing is routed and nothing changes;
     4. the pick is uniform, and an uploaded video is not uploaded again in the same session.
   Run: node tests/vid-motion-refs.browser.js */
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

  console.log("\n[1. a video position holds reference videos]");
  const S=await pg.evaluate(async()=>{
    state.vidRules=[{id:"rv_talk",label:"Talking",when:"x",keywords:"",explicit:false,motionStyle:"",soundStyle:"",enabled:true},
                    {id:"rv_doggy",label:"Doggy",when:"x",keywords:"",explicit:true,motionStyle:"",soundStyle:"",enabled:true}];
    const r=state.vidRules[1];
    const vb=n=>new Blob([new Uint8Array(64).fill(n)],{type:"video/mp4"});
    await ruleMotionAdd(r,vb(1)); await ruleMotionAdd(r,vb(2));
    const ids=ruleMotionIds(r);
    const stored=await mediaDB.kvGet("vmotion:"+ids[0]);
    const saved=(store.get(K.vidRules,[])||[]).find(x=>x.id==="rv_doggy");
    show('settings'); renderRules('vid'); toggleRuleOpen('vid','rv_doggy'); await new Promise(r=>setTimeout(r,300));
    const strip=document.querySelector('#vidRuleList .rulePoses');
    const tiles=strip?strip.querySelectorAll('.refSlot video').length:-1, add=strip?strip.querySelectorAll('.refSlot.empty').length:-1;
    const gone=ids[1]; strip.querySelector('[data-motion="'+gone+'"] .rsDel').click(); await new Promise(r=>setTimeout(r,300));
    const after=ruleMotionIds(r).length, goneBytes=await mediaDB.kvGet("vmotion:"+gone);
    await ruleMotionAdd(r,vb(2));
    const cap={id:"x",motionRefs:[]}; for(let i=0;i<10;i++)await ruleMotionAdd(cap,vb(i));
    return {ids:ids.length,blob:!!(stored&&stored.size===64),inRule:JSON.stringify(r).indexOf("blob")<0,saved:saved&&saved.motionRefs&&saved.motionRefs.length,tiles,add,after,goneBytes:!!goneBytes,cap:ruleMotionIds(cap).length};
  });
  ok("the videos are Blobs in IndexedDB; the position keeps only ids, saved with the positions", S.ids===2&&S.blob===true&&S.inRule===true&&S.saved===2, JSON.stringify(S));
  ok("the position's editor shows every video and an add tile", S.tiles===2&&S.add===1, JSON.stringify(S));
  ok("× removes that video and its bytes", S.after===1&&S.goneBytes===false, JSON.stringify(S));
  ok("up to eight per position", S.cap===8, JSON.stringify(S));

  // the harness: uploads and the video endpoint stubbed, the writers captured
  await pg.evaluate(()=>{
    const uni=state.universes[0];
    state.personas=[{id:"p_a",name:"Ayla",universeId:uni.id,look:{subject:"Woman"},refs:["data:A1"],instructions:"x",personality:"x"}];
    state.user="Emre"; state.key="k"; state.autoImg=false; state.userSubject="Man";
    state.vidModel=VIDEO_MODEL_DEFAULT; state.vidDur=5; state.vidSound=true;
    window.personRefs=p=>(p&&p.refs)||[]; window.playerRefs=()=>["data:E1"];
    window.__uploads=0;
    window.atlasUpload=async u=>{ if(/^https?:/i.test(u))return u; window.__uploads++; return /^blob:/.test(u)?"https://host/motion"+window.__uploads+".mp4":"https://host/"+String(u).replace(/^data:/,"").slice(0,20); };
    window.__bodies=[]; window.__sys=[];
    window.atlasGenerate=async(kind,body)=>{ window.__bodies.push(JSON.parse(JSON.stringify(body))); const n=window.__bodies.length;
      return {url:"https://cdn/clip"+n+".mp4",outputs:["https://cdn/clip"+n+".mp4"],raw:{}}; };
    window.__routed=0; window.__route=null;
    window.pickRule=async(rules)=>{ window.__routed++; return rules.find(r=>r.id===window.__route)||rules[0]; };
    window.chatCompletion=async(messages,model,opts)=>{
      const sys=(messages.find(m=>m.role==="system")||{}).content||"";
      if(opts&&opts.dbg==="Video motion prompt writer"){ window.__sys.push(sys); return "0-5s: the woman moves, the motion, its rhythm and the body positions follow @video1."; }
      if(opts&&opts.dbg==="Scene video writer"){ window.__sys.push(sys); return JSON.stringify({shot:"third",video_prompt:"0-5s: @image1 moves; the motion follows @video1.",sound_prompt:"room tone",end_state:"still"}); }
      return "{}";
    };
    const c=curChat(); c.presentIds=["p_a"]; c.subPos={}; c.vidSceneBy={}; c.locationId=null; c.location="Room"; c.gameDay=1; c.period="Evening";
    c.messages=[{mid:"u1",role:"user",content:'"Come here."',present:["p_a"]},
                {mid:"a1",role:"assistant",speaker:"Ayla",speakerId:"p_a",content:"*She leans in.*",present:["p_a"],img:"https://cdn/still.png",imgState:"done",imgCore:"the woman leans in",imgMeta:{ids:["p_a"]}}];
  });

  console.log("\n[2. Animate: the position's video goes with the clip, and is named]");
  const A=await pg.evaluate(async()=>{
    window.__route="rv_doggy"; window.__bodies=[]; window.__sys=[];
    const keep=window._poseRoll; window._poseRoll=()=>0;
    await animateScene("a1"); window._poseRoll=keep;
    const b=window.__bodies[0]||{}; return {rv:b.reference_videos||[],prompt:b.prompt||"",sys:window.__sys[0]||"",state:curChat().messages[1].vidState,err:curChat().messages[1].vidErr||""};
  });
  ok("the clip was made", A.state==="done", JSON.stringify(A).slice(0,300));
  ok("one reference video is sent: the position's, uploaded", A.rv.length===1&&/^https:\/\/host\/motion\d+\.mp4$/.test(A.rv[0]), JSON.stringify(A.rv));
  ok("the motion writer is told its @token", /## MOTION REFERENCE/.test(A.sys)&&/@video1 is a reference video made for this position/.test(A.sys), A.sys.slice(-700));
  ok("and the token survives to the request", /follow @video1/.test(A.prompt), A.prompt);
  const A2=await pg.evaluate(async()=>{ const u0=window.__uploads; window.__route="rv_doggy"; window.__bodies=[];
    const keep=window._poseRoll; window._poseRoll=()=>0; await animateScene("a1"); window._poseRoll=keep;
    return {again:window.__uploads-u0,rv:(window.__bodies[0]||{}).reference_videos||[]}; });
  ok("the same video is not uploaded again in this session", A2.again===0&&A2.rv.length===1, JSON.stringify(A2));
  const A3=await pg.evaluate(async()=>{ window.__route="rv_talk"; window.__bodies=[]; window.__sys=[]; await animateScene("a1");
    return {rv:(window.__bodies[0]||{}).reference_videos||null,sys:window.__sys[0]||""}; });
  ok("a position with no videos: no reference video and no motion block", !A3.rv&&!/MOTION REFERENCE/.test(A3.sys), JSON.stringify(A3).slice(0,300));

  console.log("\n[3. the scene video button]");
  const V=await pg.evaluate(async()=>{
    window.__route="rv_doggy"; window.__bodies=[]; window.__sys=[]; window.__routed=0;
    const keep=window._poseRoll; window._poseRoll=()=>0;
    await sceneVideo("a1"); window._poseRoll=keep;
    const b=window.__bodies[0]||{}; return {routed:window.__routed,rv:b.reference_videos||[],ri:(b.reference_images||[]).length,prompt:b.prompt||"",sys:window.__sys[0]||""};
  });
  ok("the stretch is routed to a position and its video goes as @video1", V.routed===1&&V.rv.length===1&&/motion/.test(V.rv[0])&&V.ri>=1, JSON.stringify(V).slice(0,400));
  ok("the scene video writer is told the token", /## MOTION REFERENCE/.test(V.sys)&&/@video1 is a reference video/.test(V.sys)&&/follows @video1/.test(V.prompt), V.sys.slice(-500));
  const V2=await pg.evaluate(async()=>{
    const saved=state.vidRules.map(r=>r.motionRefs); state.vidRules.forEach(r=>r.motionRefs=[]);
    window.__bodies=[]; window.__sys=[]; window.__routed=0; curChat().messages[1].sceneClip=null;
    await sceneVideo("a1"); state.vidRules.forEach((r,i)=>r.motionRefs=saved[i]);
    const b=window.__bodies[0]||{}; return {routed:window.__routed,rv:b.reference_videos||null,sys:window.__sys[0]||""};
  });
  ok("with no position holding videos: nothing is routed and nothing changes", V2.routed===0&&!V2.rv&&!/MOTION REFERENCE/.test(V2.sys), JSON.stringify(V2).slice(0,300));

  console.log("\n[4. one of them, at random]");
  const R=await pg.evaluate(async()=>{
    const r={id:"rr",motionRefs:[]}; for(let i=0;i<3;i++)await ruleMotionAdd(r,new Blob([new Uint8Array(8).fill(i)],{type:"video/mp4"}));
    const pick=[0,0,0]; for(let i=0;i<900;i++)pick[_poseRoll(3)]++;
    const keep=window._poseRoll; window._poseRoll=()=>2; const f=await ruleMotionPick(r); window._poseRoll=keep;
    return {pick,fixed:f.id===ruleMotionIds(r)[2]&&f.idx===2&&f.of===3,none:(await ruleMotionPick({id:"e"})).url};
  });
  ok("uniform, a fixed roll picks exactly that video, none gives nothing", R.pick.every(x=>x>240&&x<360)&&R.fixed===true&&R.none==="", JSON.stringify(R));

  ok("the prompt is a registry prompt on the video writer's and the scene video writer's cards", await pg.evaluate(()=>!!PROMPT_BY_KEY.x_vid_motion_ref&&!!K.x_vid_motion_ref&&["video_writer","scene_video"].every(k=>ENGINE_PAYLOAD_DEFS.some(d=>d.key===k&&(d.blocks||[]).some(x=>x.promptKey==="x_vid_motion_ref")))));
  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log("\n  "+pass+" passed, "+fail+" failed");
  await b.close();
  process.exit(fail?1:0);
})();
