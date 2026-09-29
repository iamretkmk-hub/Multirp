/* v145.1 — SCENE VIDEO: a clip made from the last lines of the roleplay.
   Asked: a create-video icon under a character's reply that takes the last N lines of the
   back-and-forth (N = the clip length in seconds, one line per second) and turns them into one
   video. The writer gets each character's reference picture and names them @image1, @image2 …,
   picks POV or third person, gets the place, the day and time and what everyone is wearing, and
   writes a separate sound prompt that is ambient only — no music, no dialogue. While the same
   character is in the same place, the previous clip comes back as continuity.
   Checked with the writer and AtlasCloud stubbed:
     - the icon is under character replies only, icon-only, in the same row as the others;
     - the window is exactly N counted lines ending on the reply, and stops at the scene's start;
     - the people are numbered speaker → others → player, and the pictures go up in that order;
     - the writer gets place, time and clothing; the final prompt carries no quoted words, no token
       past the last picture, and the ambient-only sound rule;
     - the next clip of the same character in the same place continues the last one (its prompt,
       end state and last frame); another place, or remaking the same reply, does not chain wrongly.
   Run: node tests/scene-video.browser.js */
const {chromium}=require('playwright');
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

  await pg.evaluate(()=>{
    const uni=state.universes[0];
    const mk=(id,n,subj,refs,wr)=>({id,name:n,universeId:uni.id,look:{subject:subj},refs,wardrobe:wr,instructions:"x",personality:"x"});
    state.personas=[mk("p_a","Ayla","Woman",["data:A1","data:A2"],"a red wrap dress; black jeans and a white shirt"),
                    mk("p_s","Selin","Woman",["data:S1"],"a green hoodie")];
    state.user="Emre"; state.key="k"; state.autoImg=false;
    state.vidModel=VIDEO_MODEL_DEFAULT; state.vidDur=5; state.vidSound=true;
    window.__real={personRefs:window.personRefs,playerRefs:window.playerRefs,chatCompletion:window.chatCompletion,
      atlasUpload:window.atlasUpload,atlasGenerate:window.atlasGenerate};
    window.personRefs=p=>(p&&p.refs)||[];
    window.playerRefs=()=>["data:E1"];
    window.atlasUpload=async u=>/^https?:/i.test(u)?u:"https://host/"+String(u).replace(/^data:/,"");
    window.__bodies=[]; window.__writer=[];
    window.__reply=null;
    window.atlasGenerate=async(kind,body)=>{ window.__bodies.push(JSON.parse(JSON.stringify(body)));
      const n=window.__bodies.length;
      return {url:"https://cdn/clip"+n+".mp4",outputs:["https://cdn/clip"+n+".mp4"],raw:{last_frame_url:"https://cdn/last"+n+".png"}}; };
    window.chatCompletion=async(messages,model,opts)=>{
      if(opts&&opts.dbg==="Scene video writer"){ window.__writer.push(messages);
        return window.__reply||JSON.stringify({shot:"pov",
          video_prompt:'POV shot, 0-2s: the woman @image1 in her red wrap dress leans across the table and says "I saw the governor" to the lens, @image7 in the corner. 2-5s: @image2 laughs.',
          sound_prompt:'Cafe murmur, cups clinking, soft "hello" from the back.',
          end_state:"Ayla leans on the table, red wrap dress, camera at Emre's eye level."}); }
      return "{}";
    };
  });

  const setChat=()=>pg.evaluate(()=>{
    const c=curChat();
    c.presentIds=["p_a","p_s"]; c.subPos={}; c.imgPromptBy={}; c.imgWindowBy={}; c.vidSceneBy={};
    c.locationId=null; c.location="Cafe Derya"; c.gameDay=2; c.period="Evening";
    const st={day:2,period:"Afternoon",location:"Cafe Derya"};
    const A=(mid,t,x)=>Object.assign({mid,role:"assistant",speaker:"Ayla",speakerId:"p_a",content:t,present:c.presentIds.slice(),status:st},x||{});
    const U=(mid,t)=>({mid,role:"user",content:t,present:[],status:st});
    c.messages=[
      A("t0","*We arrive at the cafe.*",{speaker:"Narrator",speakerId:null,narratorEvent:true,travelBeat:true}),
      U("u1",'"Old line one."'),
      A("a1",'"Old reply one."'),
      U("u2",'"Hey, Ayla."'),
      A("s1",'"Hi Emre!" *Selin waves.*',{speaker:"Selin",speakerId:"p_s"}),
      A("x1","a phone text",{textMsg:true}),
      {mid:"e1",role:"assistant",sysError:true,content:"error"},
      U("u3",'*I sit down.* "What did you see?"'),
      A("a2",'*She leans in.* "I saw the governor."')
    ];
    markChatDirty(c);
  });

  console.log("\n[a create-video icon under every character reply]");
  await setChat();
  const IB=await pg.evaluate(async()=>{
    show('chat'); renderChat(); await new Promise(r=>setTimeout(r,300));
    const q=mid=>document.querySelector('.bubble[data-mid="'+mid+'"] .msgActions [data-scenevid]');
    const btn=q("a2"), row=btn&&btn.closest('.msgActions'), sib=row&&row.querySelector('[data-genimg]');
    return {reply:!!btn,user:!!q("u3"),text:!!q("x1"),svg:!!(btn&&btn.querySelector('use[href="#i-video"]')),
      label:(btn&&btn.textContent.trim())||"",sameRow:!!sib,
      sameSize:!!(btn&&sib&&Math.abs(btn.getBoundingClientRect().height-sib.getBoundingClientRect().height)<1&&Math.abs(btn.getBoundingClientRect().top-sib.getBoundingClientRect().top)<1)};
  });
  ok("every character reply has it, in the action row", IB.reply===true&&IB.sameRow===true, JSON.stringify(IB));
  ok("it is the video icon only — no words — at the same size as its neighbours", IB.svg===true&&IB.label===""&&IB.sameSize===true, JSON.stringify(IB));
  ok("the player's own line and a phone text have none", IB.user===false&&IB.text===false, JSON.stringify(IB));

  console.log("\n[N lines, N = the clip length in seconds]");
  const W=await pg.evaluate(()=>{
    const c=curChat();
    const five=sceneVideoWindow(c,"a2",5).items.map(x=>x.m.mid);
    const three=sceneVideoWindow(c,"a2",3).items.map(x=>x.m.mid);
    const many=sceneVideoWindow(c,"a2",20);
    return {five,three,many:many.items.map(x=>x.m.mid),short:many.short};
  });
  ok("a 5-second clip takes the last five lines ending on the reply, skipping errors and phone texts",
     JSON.stringify(W.five)==='["a1","u2","s1","u3","a2"]', JSON.stringify(W));
  ok("a 3-second clip takes three", JSON.stringify(W.three)==='["s1","u3","a2"]', JSON.stringify(W));
  ok("and it never reaches back past the start of the scene", W.many[0]==="t0"&&W.short===true, JSON.stringify(W));

  console.log("\n[the writer and the request]");
  const R=await pg.evaluate(async()=>{
    window.__bodies=[]; window.__writer=[];
    const toasts=[]; const rt=window.toast; window.toast=t=>toasts.push(t);
    await sceneVideo("a2");
    window.toast=rt;
    const msgs=window.__writer[0]||[];
    const m=findMsg("a2");
    return {sys:(msgs.find(x=>x.role==="system")||{}).content||"",usr:msgs.filter(x=>x.role==="user").map(x=>x.content).join("\n"),
      body:window.__bodies[0]||null,video:m.video||null,clip:m.sceneClip||null,busy:m.clipState||null,toasts,cont:curChat().vidSceneBy.p_a||null};
  });
  ok("the system prompt is the registry prompt, filled with the clip's length and beats",
     /director of one short video clip/.test(R.sys)&&/5-second clip/.test(R.sys)&&/as 3 time blocks/.test(R.sys)&&!/\{\{/.test(R.sys), R.sys.slice(0,400));
  ok("people are numbered: the reply's speaker, then the others, then the player",
     /- @image1 = Ayla — the clip ends on their reply/.test(R.usr)&&/- @image2 = Selin/.test(R.usr)&&/- @image3 = Emre \(the player/.test(R.usr), R.usr.slice(0,600));
  ok("the pictures go up in exactly that order, one per person", R.body&&JSON.stringify(R.body.reference_images)==='["https://host/A1","https://host/S1","https://host/E1"]', JSON.stringify(R.body&&R.body.reference_images));
  ok("no first frame on a reference-only model", R.body&&!("image" in R.body), JSON.stringify(R.body));
  ok("the clip lasts the configured seconds", R.body&&R.body.duration===5, R.body&&R.body.duration);
  ok("the writer gets where and when — the day and time the stretch runs across",
     /WHERE AND WHEN:/.test(R.usr)&&/from Day 2, Afternoon to Day 2, Evening/.test(R.usr)&&/Cafe Derya/.test(R.usr), R.usr);
  ok("and what everyone is wearing when it begins, under their token",
     /WHAT EVERYONE IS WEARING WHEN THE STRETCH BEGINS:/.test(R.usr)&&/FOR @image1 \(Ayla\):[\s\S]*red wrap dress/.test(R.usr)&&/FOR @image2 \(Selin\):[\s\S]*green hoodie/.test(R.usr), R.usr);
  ok("and the lines, oldest first", /THE LINES[^\n]*\n[\s\S]*Ayla: "Old reply one\."[\s\S]*Emre \(the player\): \*I sit down\.\*[\s\S]*Ayla: \*She leans in\.\*/.test(R.usr)&&!/Old line one/.test(R.usr), R.usr);
  ok("no continuity on the first clip", !/PREVIOUS CLIP/.test(R.usr), R.usr);
  const P=(R.body&&R.body.prompt)||"";
  ok("quoted words never reach the model — nobody is made to speak", !/governor/.test(P)&&!/hello/.test(P), P);
  ok("a token past the last picture is dropped", !/@image7/.test(P)&&/@image1/.test(P)&&/@image2/.test(P), P);
  ok("the sound prompt rides after the picture prompt, held to ambient sound in code",
     /\n\nSound: Cafe murmur, cups clinking/.test(P)&&/No music/.test(P)&&/no dialogue/.test(P)&&R.body.generate_audio===true, P);
  ok("the clip is kept on the reply as its scene clip, POV as the writer chose",
     !!R.clip&&R.clip.src==="https://cdn/clip1.mp4"&&R.clip.shot==="pov"&&R.clip.lines===5&&R.clip.fromMid==="a1"&&!R.busy, JSON.stringify(R.clip));
  ok("apart from the reply's own animated still (msg.video is untouched)", R.video===null, R.video);
  ok("and becomes this character's continuity here", R.cont&&R.cont.mid==="a2"&&/Ayla leans on the table/.test(R.cont.endState)&&R.cont.lastFrame==="https://cdn/last1.png", JSON.stringify(R.cont));

  console.log("\n[the next clip continues the last one — same character, same place]");
  const C=await pg.evaluate(async()=>{
    const c=curChat();
    c.messages.push({mid:"u4",role:"user",content:"*I take her hand.*",present:[]},
      {mid:"a3",role:"assistant",speaker:"Ayla",speakerId:"p_a",content:"*She squeezes back and smiles.*",present:c.presentIds.slice()});
    window.__bodies=[]; window.__writer=[];
    await sceneVideo("a3");
    const usr=(window.__writer[0]||[]).filter(x=>x.role==="user").map(x=>x.content).join("\n");
    return {usr,refs:(window.__bodies[0]||{}).reference_images||[],cont:c.vidSceneBy.p_a};
  });
  ok("the writer gets the previous clip's prompt and end state", /PREVIOUS CLIP of Ayla in this same place/.test(C.usr)&&/Its end state: Ayla leans on the table/.test(C.usr), C.usr);
  ok("lines the last clip already showed are marked, the new ones are not",
     /Ayla: \*She leans in\.\*[^\n]*\[shown in the previous clip\]/.test(C.usr)&&/Emre \(the player\): \*I take her hand\.\*\n/.test(C.usr)&&!/smiles\.\* \[shown/.test(C.usr), C.usr);
  ok("and the last frame goes up after the people, named as where the previous clip ended",
     /- @image4 = WHERE THE PREVIOUS CLIP ENDED/.test(C.usr)&&C.refs.length===4&&/last1\.png/.test(C.refs[3]), JSON.stringify(C.refs));
  ok("the chain moves on to this clip", C.cont.mid==="a3"&&C.cont.prior&&C.cont.prior.mid==="a2"&&!C.cont.prior.prior, JSON.stringify(C.cont&&{mid:C.cont.mid,prior:C.cont.prior&&C.cont.prior.mid}));

  const RE=await pg.evaluate(async()=>{
    window.__bodies=[]; window.__writer=[];
    await sceneVideo("a3");
    const usr=(window.__writer[0]||[]).filter(x=>x.role==="user").map(x=>x.content).join("\n");
    return {usr,cont:curChat().vidSceneBy.p_a};
  });
  ok("remaking the same reply continues the clip BEFORE it, not itself",
     /PREVIOUS CLIP/.test(RE.usr)&&/last1\.png|WHERE THE PREVIOUS CLIP ENDED/.test(RE.usr)&&RE.cont.mid==="a3"&&RE.cont.prior&&RE.cont.prior.mid==="a2", JSON.stringify(RE.cont&&{mid:RE.cont.mid,prior:RE.cont.prior&&RE.cont.prior.mid}));

  const PL=await pg.evaluate(async()=>{
    const c=curChat(); c.location="Harbour";
    c.messages.push({mid:"a4",role:"assistant",speaker:"Ayla",speakerId:"p_a",content:"*She looks at the boats.*",present:c.presentIds.slice()});
    window.__bodies=[]; window.__writer=[];
    await sceneVideo("a4");
    const usr=(window.__writer[0]||[]).filter(x=>x.role==="user").map(x=>x.content).join("\n");
    c.location="Cafe Derya";
    return {usr,refs:(window.__bodies[0]||{}).reference_images||[]};
  });
  ok("in another place there is no previous clip to continue", !/PREVIOUS CLIP/.test(PL.usr)&&!PL.refs.some(u=>/last\d\.png/.test(u)), PL.usr.slice(0,400)+" "+JSON.stringify(PL.refs));
  ok("travel wipes the scene-video continuity with the image continuity", await pg.evaluate(()=>
      /chat\.vidSceneBy=\{\}/.test(String(travelTo))&&/delete chat\.vidSceneBy\[p\.id\]/.test(String(applyPresence))));

  console.log("\n[sound off, and a model with a first-frame slot]");
  const SO=await pg.evaluate(async()=>{
    state.vidSound=false; window.__bodies=[];
    await sceneVideo("a2");
    state.vidSound=true;
    const b=window.__bodies[0]||{};
    return {p:b.prompt||"",ga:b.generate_audio};
  });
  ok("with sound off in Video Settings the sound prompt is left off", !/Sound:/.test(SO.p)&&SO.ga!==true, JSON.stringify(SO));
  const NM=await pg.evaluate(async()=>{
    state.vidModel="bytedance/seedance-2.0/image-to-video"; window.__bodies=[];
    await sceneVideo("a3");
    state.vidModel=VIDEO_MODEL_DEFAULT;
    const b=window.__bodies[0]||{};
    return {image:b.image||"",refs:b.reference_images||[]};
  });
  ok("a model with a first-frame slot starts from where the previous clip ended, the people still referenced",
     /last\d\.png/.test(NM.image)&&NM.refs[0]==="https://host/A1", JSON.stringify(NM));

  console.log("\n[failures]");
  const KF=await pg.evaluate(async()=>{
    const m=findMsg("a2"), before=m.sceneClip&&m.sceneClip.src;
    const rg=window.atlasGenerate; window.atlasGenerate=async()=>{ throw{friendly:"AtlasCloud said no"}; };
    const toasts=[]; const rt=window.toast; window.toast=t=>toasts.push(t);
    await sceneVideo("a2");
    window.atlasGenerate=rg; window.toast=rt;
    return {before,after:m.sceneClip&&m.sceneClip.src,busy:m.clipState||null,toasts};
  });
  ok("a failed remake keeps the clip the reply already had, and says why",
     !!KF.before&&KF.after===KF.before&&!KF.busy&&KF.toasts.includes("AtlasCloud said no"), JSON.stringify(KF));
  const NP=await pg.evaluate(async()=>{
    const rp=window.personRefs, rq=window.playerRefs;
    window.personRefs=()=>[]; window.playerRefs=()=>[];
    const c=curChat(); c.vidSceneBy={};
    window.__bodies=[];
    const toasts=[]; const rt=window.toast; window.toast=t=>toasts.push(t);
    await sceneVideo("s1");
    window.personRefs=rp; window.playerRefs=rq; window.toast=rt;
    const m=findMsg("s1");
    return {calls:window.__bodies.length,clip:!!m.sceneClip,busy:m.clipState||null,toasts};
  });
  ok("with no picture of anyone, nothing is sent and the reason is shown",
     NP.calls===0&&!NP.clip&&!NP.busy&&NP.toasts.some(t=>/reference pictures/.test(t)), JSON.stringify(NP));

  // v148.4 — a minor in the clip: the writer is held to non-sexual, everyday action
  console.log("\n[a minor in the clip]");
  ok("no minor in the cast: no hard limit is added", !/HARD LIMIT — someone in this clip is a minor/.test(R.sys), "");
  const MN=await pg.evaluate(async()=>{
    const sel=state.personas.find(p=>p.name==="Selin"); const keep=sel.age; sel.age=15;
    window.__writer=[]; window.__bodies=[]; const rt=window.toast; window.toast=()=>{};
    try{ await sceneVideo("a2"); }finally{ sel.age=keep; window.toast=rt; }
    const msgs=window.__writer[0]||[]; return (msgs.find(x=>x.role==="system")||{}).content||"";
  });
  ok("with a minor in the cast the writer is told nothing sexual, suggestive or intimate may appear",
     /HARD LIMIT — someone in this clip is a minor/.test(MN)&&/Everyone fully and ordinarily clothed/.test(MN), MN.slice(-500));

  console.log("\n[the prompts are editable]");
  ok("the writer and the audio rule are registry prompts on their own card", await pg.evaluate(()=>
      ["x_scene_video_writer","x_scene_video_audio_rule"].every(k=>!!PROMPT_BY_KEY[k]&&!!K[k]
        &&ENGINE_PAYLOAD_DEFS.some(d=>d.key==="scene_video"&&(d.blocks||[]).some(x=>x.promptKey===k)))));

  await pg.evaluate(()=>{ Object.assign(window,window.__real); });
  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log(`\n  ${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail?1:0);
})();
