const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file:///home/user/Multirp/index.html'); await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(900);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+(x?"\n        "+String(x).slice(0,500):""));} };

  const R=await pg.evaluate(()=>{
    const uni=state.universes[0]; uni.setting="A port city.";
    const p={id:"p_a",name:"Ayse",universeId:uni.id,instructions:"Guarded.",personality:"Wry.",
      backstory:"Came back for a funeral.",style:"Short.",goals:"Find the buyer.",look:{}};
    state.personas.push(p);
    const chat=curChat(); chat.gameDay=4; chat.period="Evening"; chat.location="Cafe Derya";
    chat.presentIds=[p.id]; state.user="Kemal"; chat.messages=[];
    const injected={recent:[],diary:[],longterm:[]};
    const mk=()=>Object.assign({},
      buildCharPromptBlocks(p,[],injected,state.user,{chat,targetName:state.user,targetId:"__user__"}),
      buildTailBlocks({chat,selfP:p,selfId:p.id,selfName:p.name,targetName:state.user,
        targetId:"__user__",multi:true,injected}));

    // ---- storage + gate plumbing ----
    const vid={id:"v1",url:"x",cues:[{t:5,text:"the glass slips out of her hand"},{t:12,text:"someone opens the door"}]};
    state.videos=[vid];
    const cues=vidCues(vid);
    const gateOff=(()=>{ state.vidCueOn=false; return _vidCueBlocked(chat); })();
    state.vidCueOn=true; state.key="test-key";
    const gateOn=_vidCueBlocked(chat);

    // ---- the cue fires: watchingNow stamped like fireVidCue does ----
    chat.watchingNow={text:"the glass slips out of her hand",at:chat.messages.length,t:5,videoId:"v1"};
    chat.messages.push({mid:"n1",role:"assistant",speaker:"Narrator",narratorEvent:true,watchCue:true,
      present:[p.id],content:"the glass slips out of her hand"});
    const withCue=mk();

    const hist=[{role:"user",content:"I sat down."}];
    const was=state.payloadTplOn; state.payloadTplOn=true;
    const tplWith=ptBuildMessages("multi",withCue,hist,{chat,npc:p,targetName:state.user},mk);
    // classic for comparison
    const pl=buildPayload("multi",
      buildCharPromptBlocks(p,[],injected,state.user,{chat,targetName:state.user,targetId:"__user__"}),
      buildTailBlocks({chat,selfP:p,selfId:p.id,selfName:p.name,targetName:state.user,targetId:"__user__",multi:true,injected}));
    const classic=[]; if(pl.head)classic.push({role:"system",content:pl.head});
    classic.push(...hist); if(pl.tail)classic.push({role:"system",content:pl.tail});

    // ---- and with NO cue (the ordinary turn) : does it log phantom warnings? ----
    chat.watchingNow=null;
    const before=dbgLog.length;
    const tplNo=ptBuildMessages("multi",mk(),hist,{chat,npc:p,targetName:state.user},mk);
    const newEntries=dbgLog.slice(before).map(e=>({label:e.label,payload:e.payload}));
    state.payloadTplOn=was;

    return {cueCount:cues.length, cueSorted:cues[0].t<cues[1].t, gateOff, gateOn,
      blockPresent:!!withCue.watching_now, blockText:withCue.watching_now||"",
      inTemplate:(tplWith||[]).map(m=>m.content).join("\n"),
      sameAsClassic:JSON.stringify(classic)===JSON.stringify(tplWith),
      noCueText:(tplNo||[]).map(m=>m.content).join("\n"),
      phantom:newEntries.filter(e=>/do not exist/i.test(e.label||"")),
      hasRunWatch:typeof runWatchTurn==="function", hasFire:typeof fireVidCue==="function",
      mcArgs:runMultiCharTurn.length};
  });

  console.log("\n[1] marks are stored and ordered");
  ok("both marks kept", R.cueCount===2);
  ok("sorted by time", R.cueSorted);

  console.log("\n[2] the gate");
  ok("blocked when the feature is off", R.gateOff==="cues off", R.gateOff);
  ok("allowed when on", R.gateOn==="", "reason: "+R.gateOn);

  console.log("\n[3] the mark reaches the character's payload");
  ok("block is built", R.blockPresent);
  ok("block says it is happening now", /IN FRONT OF YOU RIGHT NOW/i.test(R.blockText), R.blockText.slice(0,120));
  ok("the description is in it", R.blockText.indexOf("glass slips")>-1);
  ok("it reaches the payload WITH templates on", R.inTemplate.indexOf("glass slips")>-1);
  ok("template payload === classic payload", R.sameAsClassic);

  console.log("\n[4] the auto-response wiring");
  ok("runWatchTurn exists", R.hasRunWatch);
  ok("fireVidCue exists", R.hasFire);
  ok("runMultiCharTurn takes the stimulus arg", R.mcArgs===3, "arity "+R.mcArgs);

  console.log("\n[5] an ordinary turn is clean");
  ok("no cue text leaks into the next turn", R.noCueText.indexOf("glass slips")===-1);
  ok("no phantom 'name does not exist' warnings", R.phantom.length===0,
     JSON.stringify(R.phantom.map(p=>p.payload&&p.payload.unknown_calls)).slice(0,300));

  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close(); process.exit(fail?1:0);
})();
