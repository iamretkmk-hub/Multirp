const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage({viewport:{width:412,height:915}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file:///home/user/Multirp/index.html'); await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(900);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x||c).slice(0,300));} };

  console.log("\n[the two blocks exist and are independent]");
  ok("voice_delivery exists", await pg.evaluate(()=>!!BLOCK_TPL_DEFAULTS.voice_delivery));
  ok("heat_delivery exists", await pg.evaluate(()=>!!BLOCK_TPL_DEFAULTS.heat_delivery));
  ok("voice_format_reset kept", await pg.evaluate(()=>!!BLOCK_TPL_DEFAULTS.voice_format_reset));
  ok("they are different texts", await pg.evaluate(()=>
      BLOCK_TPL_DEFAULTS.voice_delivery!==BLOCK_TPL_DEFAULTS.heat_delivery));
  ok("all three are listed under the spoken_delivery block", await pg.evaluate(()=>{
      const t=(REPLY_BLOCKS.spoken_delivery||{}).tpls||[];
      return ["voice_delivery","heat_delivery","voice_format_reset"].every(n=>t.indexOf(n)>-1); }));
  ok("editing the normal one leaves heat untouched", await pg.evaluate(()=>{
      const heatWas=blkTpl("heat_delivery");
      state.blockTpls=state.blockTpls||{}; state.blockTpls.voice_delivery="MY OWN NORMAL RULES";
      const okNow = blkTpl("voice_delivery")==="MY OWN NORMAL RULES" && blkTpl("heat_delivery")===heatWas;
      delete state.blockTpls.voice_delivery;
      return okNow; }));
  ok("editing heat leaves the normal one untouched", await pg.evaluate(()=>{
      const normWas=blkTpl("voice_delivery");
      state.blockTpls=state.blockTpls||{}; state.blockTpls.heat_delivery="MY OWN HEAT RULES";
      const okNow = blkTpl("heat_delivery")==="MY OWN HEAT RULES" && blkTpl("voice_delivery")===normWas;
      delete state.blockTpls.heat_delivery;
      return okNow; }));

  console.log("\n[the right block reaches the right turn]");
  const setup = ()=>pg.evaluate(()=>{
    const uni=state.universes[0];
    if(!state.personas.some(p=>p.id==="p_tts")){
      state.personas.push({id:"p_tts",name:"Nil",universeId:uni.id,instructions:"x",
        personality:"x",backstory:"x",style:"x",goals:"x",look:{}});
    }
    const chat=curChat(); chat.presentIds=["p_tts"]; state.user="Kemal";
  });
  await setup();
  const tail = (opts)=>pg.evaluate(o=>{
    const p=state.personas.find(x=>x.id==="p_tts"); const chat=curChat();
    state.autoSpeak=!!o.speak; state.narrMode=false;
    if(o.heat) chat._heatBeat={n:2,total:5}; else delete chat._heatBeat;
    const inj={recent:[],diary:[],longterm:[]};
    let B;
    try{ B=buildTailBlocks({chat,selfP:p,selfId:p.id,selfName:p.name,targetName:state.user,
          targetId:"__user__",multi:false,injected:inj,textMode:!!o.text}); }
    finally{ state.autoSpeak=false; delete chat._heatBeat; }
    return String(B.spoken_delivery||"");
  },opts);

  ok("voicing on, normal turn -> the normal block",
     (await tail({speak:true})).indexOf("SPOKEN DELIVERY — THIS REPLY IS READ ALOUD")>-1);
  ok("voicing on, heat beat -> the heat block",
     (await tail({speak:true,heat:true})).indexOf("HEAT OF THE MOMENT, READ ALOUD")>-1);
  ok("heat turn does NOT carry the normal block",
     (await tail({speak:true,heat:true})).indexOf("THIS REPLY IS READ ALOUD")===-1);
  ok("normal turn does NOT carry the heat block",
     (await tail({speak:true})).indexOf("HEAT OF THE MOMENT, READ ALOUD")===-1);
  ok("a typed text message gets no delivery block at all",
     (await tail({speak:true,text:true})).indexOf("READ ALOUD")===-1);
  ok("voicing off -> no coaching", (await tail({speak:false}))==="");

  console.log("\n[voicing off, but the transcript still carries tags -> the reset]");
  ok("the reset fires and the coaching does not", await pg.evaluate(async()=>{
      const p=state.personas.find(x=>x.id==="p_tts"); const chat=curChat();
      chat.messages.push({mid:"m_tag_"+Date.now(),role:"assistant",name:"Nil",
        content:'"[say quietly with a low tone and deliberate pauses] I did not think you would come."'});
      state.autoSpeak=false; state.narrMode=false;
      const inj={recent:[],diary:[],longterm:[]};
      const B=buildTailBlocks({chat,selfP:p,selfId:p.id,selfName:p.name,targetName:state.user,
        targetId:"__user__",multi:false,injected:inj});
      const s=String(B.spoken_delivery||"");
      return s.indexOf("FORMAT RESET")>-1 && s.indexOf("READ ALOUD")===-1; }));

  console.log("\n[a direction reaches the voice, never the screen]");
  const LINE='*She looks up.* "[say quietly with a low tone and deliberate pauses] I did not think you would come. [laugh] Really."';
  ok("ttsCleanText keeps the direction", await pg.evaluate(l=>
      ttsCleanText(l).indexOf("[say quietly with a low tone and deliberate pauses]")>-1,LINE));
  ok("ttsCleanText keeps the sound", await pg.evaluate(l=>
      ttsCleanText(l).indexOf("[laugh]")>-1,LINE));
  ok("ttsCleanText still drops the *action*", await pg.evaluate(l=>
      ttsCleanText(l).indexOf("looks up")===-1,LINE));
  ok("_dispText hides both from the bubble", await pg.evaluate(l=>{
      state.autoSpeak=true;
      const d=_dispText(l);
      state.autoSpeak=false;
      return d.indexOf("[")===-1 && d.indexOf("say quietly")===-1 && d.indexOf("laugh")===-1
          && d.indexOf("I did not think you would come")>-1; },LINE));
  ok("a long direction is hidden too (the old 32-char cap left it on screen)", await pg.evaluate(()=>{
      state.autoSpeak=true;
      const d=_dispText('"[speak fast and bright barely finishing one thought before starting the next] Wait."');
      state.autoSpeak=false;
      return d.indexOf("[")===-1 && d.indexOf("barely finishing")===-1 && d.indexOf("Wait.")>-1; }));
  ok("extractDialogue carries the direction out of the quotes", await pg.evaluate(l=>
      extractDialogue(l).indexOf("[say quietly")>-1,LINE));
  ok("narration keeps its own direction for the narrator voice", await pg.evaluate(()=>
      ttsCleanText(narrSplit('*[say slowly in a low tone] The door swung open.* "Hello."').narr)
        .indexOf("[say slowly in a low tone]")>-1));

  console.log("\n[brackets that are not directions are dropped]");
  const junk=[["[Scene: the kitchen]","a colon-structured note"],
              ["[OOC: be careful]","an out-of-character note"],
              ["[3s]","a bare duration"],
              ["[/whisper]","a closing xAI tag"]];
  for(const [tag,what] of junk)
    ok("drops "+what+" "+tag, await pg.evaluate(t=>ttsCleanText('"'+t+' Hello."').indexOf("[")===-1,tag));
  const keep=["[reset]","[laugh]","[clear throat]","[say quietly with a low tone and deliberate pauses]"];
  for(const tag of keep)
    ok("keeps "+tag, await pg.evaluate(t=>ttsCleanText('"'+t+' Hello."').indexOf(t)>-1,tag));

  console.log("\n[nothing else moved]");
  ok("spoken_delivery still in REPLY_ORDER", await pg.evaluate(()=>REPLY_ORDER.indexOf("spoken_delivery")>-1));
  ok("saveSettings does not throw", await pg.evaluate(()=>{
      show('settings'); try{ saveSettings(false); return true; }catch(e){ return "threw: "+e.message; } }));

  ok("no page errors", errs.length===0?true:errs.join(" | "));
  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close(); process.exit(fail?1:0);
})();
