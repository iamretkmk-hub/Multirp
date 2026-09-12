/* v39.4 — WHETHER A BEAT IS WORTH A PICTURE.
   The "every N replies" slider was a proxy for a question it could not ask. Pictures during play is
   one choice now — every reply / let the story decide / none — and in the middle setting a small
   director answers per beat: 0 keeps what is on screen, 1 draws, a scene name plays that character's
   video scene (which docks it and raises Heat of the moment, after which the scene router takes the
   following beats). Run: node tests/visual-director.browser.js */
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage({viewport:{width:412,height:915}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file://'+require('path').resolve(__dirname,'..','index.html'));
  await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(800);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x||c).slice(0,600));} };

  // ---- the mode itself
  const m=await pg.evaluate(()=>{
    const o={};
    state.imgMode="always"; o.always=imgMode(); o.alwaysActive=autoImgActive();
    state.imgMode="off";    o.off=imgMode();    o.offActive=autoImgActive(); o.offGate=_imgGate();
    state.imgMode="smart";  o.smart=imgMode();
    state.imgMode="nonsense"; state.autoImg=true;  o.fallbackOn=imgMode();
    state.autoImg=false; o.fallbackOff=imgMode();
    state.imgMode="always"; state.autoImg=true;
    return o;
  });
  ok("always is a mode", m.always==="always" && m.alwaysActive===true, JSON.stringify(m));
  ok("off stops auto images", m.off==="off" && m.offActive===false, JSON.stringify(m));
  ok("off names itself in the gate", /No pictures/.test(m.offGate||""), m.offGate);
  ok("smart is a mode", m.smart==="smart");
  ok("an unknown value falls back to the old boolean", m.fallbackOn==="always" && m.fallbackOff==="off", JSON.stringify(m));

  // ---- the prompt is registered and editable like every other one
  const reg=await pg.evaluate(()=>{
    const r=(PROMPT_REGISTRY||[]).find(x=>x&&x.key==="visualDirector");
    return {found:!!r, hasKey:!!K.visualDirector, stateful:typeof state.visualDirector==="string",
            resolves:(typeof up==="function")?up("visualDirector").slice(0,20):"", def:(r&&typeof r.def==="function")?r.def().length:0};
  });
  ok("the visual director is in the prompt registry", reg.found===true);
  ok("it has a storage key", reg.hasKey===true);
  ok("it is loaded into state", reg.stateful===true);
  ok("up() resolves it", reg.resolves.length>0, reg.resolves);
  ok("its default is real text", reg.def>800, reg.def);

  // ---- the decision, with the model call stubbed: every branch
  const d=await pg.evaluate(async()=>{
    const out={};
    const uni=state.universes[0];
    if(!state.personas.some(p=>p.id==="v_a")) state.personas.push({id:"v_a",name:"Ayla",universeId:uni.id,
      instructions:"x",personality:"x",backstory:"x",style:"x",goals:"x",look:{subject:"Woman"}});
    state.user="Emre"; state.imgMode="smart"; state.autoImg=true; state.imgPauseOn=false;
    const chat=curChat(); chat.universeId=uni.id; chat.sceneDockId=null;
    chat.messages=[
      {mid:"m1",role:"assistant",speaker:"Ayla",speakerId:"v_a",content:"earlier",img:"x",imgPrompt:"two people at a table"},
      {mid:"m2",role:"user",content:"ne yapalim"},
      {mid:"m3",role:"assistant",speaker:"Ayla",speakerId:"v_a",content:"bilmem"}
    ];
    state.scenes=[{id:"scn_v1",name:"Bedroom",characterId:"v_a",characterName:"Ayla",universeId:uni.id,
      clips:[{id:"c1",url:"blob:x"}]}];

    const drew=[]; const played=[];
    const realIllustrate=window.illustrate, realPlay=window.playSceneInChat, realChat=window.chatCompletion;
    window.illustrate=(mid)=>{ drew.push(mid); };
    window.playSceneInChat=(id)=>{ played.push(id); };

    const run=async(answer)=>{ drew.length=0; played.length=0;
      window.chatCompletion=async()=>answer;
      await decideVisual("m3","bilmem"); return {drew:drew.slice(),played:played.slice()}; };

    out.zero  = await run("0");
    out.one   = await run("1");
    out.scene = await run("Bedroom");
    out.caseInsensitive = await run("  bedroom  ");
    out.quoted = await run("`1`");
    out.garbage = await run("maybe a picture?");
    // a scene belonging to somebody else must never be played
    state.scenes[0].characterId="someone_else"; state.scenes[0].characterName="Deniz";
    out.otherChar = await run("Bedroom");
    state.scenes[0].characterId="v_a"; state.scenes[0].characterName="Ayla";
    // a failing director draws rather than skipping
    drew.length=0; played.length=0;
    window.chatCompletion=async()=>{ throw new Error("network"); };
    await decideVisual("m3","bilmem"); out.failed={drew:drew.slice(),played:played.slice()};

    window.illustrate=realIllustrate; window.playSceneInChat=realPlay; window.chatCompletion=realChat;
    return out;
  });
  ok("0 keeps the picture on screen", d.zero.drew.length===0 && d.zero.played.length===0, JSON.stringify(d.zero));
  ok("1 draws a new picture", d.one.drew[0]==="m3" && d.one.played.length===0, JSON.stringify(d.one));
  ok("a scene name plays that scene and draws nothing", d.scene.played[0]==="scn_v1" && d.scene.drew.length===0, JSON.stringify(d.scene));
  ok("the scene name is matched case- and space-insensitively", d.caseInsensitive.played[0]==="scn_v1", JSON.stringify(d.caseInsensitive));
  ok("backticks around the answer are stripped", d.quoted.drew[0]==="m3", JSON.stringify(d.quoted));
  ok("a malformed answer draws rather than skipping", d.garbage.drew[0]==="m3", JSON.stringify(d.garbage));
  ok("another character's scene is never played", d.otherChar.played.length===0 && d.otherChar.drew[0]==="m3", JSON.stringify(d.otherChar));
  ok("a failed director draws rather than skipping", d.failed.drew[0]==="m3", JSON.stringify(d.failed));

  // ---- a docked scene still routes in smart mode even with rule routing off
  const r=await pg.evaluate(()=>{
    state.routeOn=false; state.imgMode="smart";
    const chat=curChat(); chat.sceneDockId="scn_v1";
    return {sceneMode:sceneModeActive()};
  });
  ok("a docked scene is scene mode", r.sceneMode===true);

  // ---- the settings control exists and the retired slider does not
  const ui=await pg.evaluate(()=>{
    show('settings');
    return {sel:!!document.getElementById('setImgMode'),
            slider:!!document.getElementById('setImgEveryTurns'),
            oldToggle:!!document.getElementById('setAutoImg'),
            opts:[...(document.getElementById('setImgMode')||{options:[]}).options].map(o=>o.value)};
  });
  ok("the three-way control is in Settings", ui.sel===true && ui.opts.join(",")==="always,smart,off", JSON.stringify(ui.opts));
  ok("the every-N slider is gone", ui.slider===false);
  ok("the old on/off toggle is gone", ui.oldToggle===false);

  // ---- and saving round-trips
  const save=await pg.evaluate(()=>{
    const e=document.getElementById('setImgMode'); e.value="smart";
    saveSettings();
    return {stored:store.raw(K.imgMode,""), autoImg:state.autoImg, mode:imgMode()};
  });
  ok("the mode saves", save.stored==="smart" && save.mode==="smart", JSON.stringify(save));
  ok("autoImg is kept in step for the older readers", save.autoImg===true, JSON.stringify(save));

  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log(`\n  ${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail?1:0);
})();
