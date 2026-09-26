/* v39.9 — HEAT N MEANS N MESSAGES, ALL OF THEM HEAT.
   Heat used to run entirely AFTER a normal reply: a turn produced one STANDARD-format reply plus
   heatN heat beats. With heatN=1 that is two messages, and the first — the one actually answering
   the player — was not in heat form at all. The player-facing reply is beat 1 now and the run
   writes 2..N. Run: node tests/heat-count.browser.js */
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage({viewport:{width:412,height:915}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file://'+require('path').resolve(__dirname,'..','index.html'));
  await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(700);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x||c).slice(0,600));} };

  // ---- heatBeginTurn marks the reply as beat 1 of the configured run
  const mark=await pg.evaluate(()=>{
    const chat=curChat(); const out={};
    delete chat._heatBeat; delete chat._heatOpened; chat.heatNarrN=0;
    state.heatOn=false; out.offReturns=heatBeginTurn(chat); out.offBeat=!!chat._heatBeat;
    state.heatOn=true; state.heatN=1;
    out.onReturns=heatBeginTurn(chat);
    out.beat=chat._heatBeat && {n:chat._heatBeat.n,total:chat._heatBeat.total};
    out.opened=chat._heatOpened===true;
    heatEndTurn(chat); out.cleared=!chat._heatBeat; out.stillOpened=chat._heatOpened===true;
    state.heatN=4; delete chat._heatOpened; heatBeginTurn(chat);
    out.total4=chat._heatBeat.total; heatEndTurn(chat);
    return out;
  });
  ok("heat off marks nothing", mark.offReturns===false && mark.offBeat===false, JSON.stringify(mark));
  ok("heat on marks the reply as beat 1", mark.onReturns===true && mark.beat.n==="1", JSON.stringify(mark.beat));
  ok("and it carries the configured run length", mark.beat.total==="1" && mark.total4==="4", JSON.stringify(mark));
  ok("ending the turn clears the beat", mark.cleared===true);
  ok("but the run still knows beat 1 was taken", mark.stillOpened===true);

  // ---- how many further beats the run writes, with playCharacterTurn stubbed
  const run=async(heatN,opened)=>pg.evaluate(async([n,op])=>{
    const chat=curChat();
    state.heatOn=true; state.heatN=n; chat.heatNarrN=0;
    delete chat._heatBeat; if(op) chat._heatOpened=true; else delete chat._heatOpened;
    const beats=[];
    const real=window.playCharacterTurn;
    window.playCharacterTurn=async()=>{ beats.push(chat._heatBeat?chat._heatBeat.n:"?"); return true; };
    const realCast=window.presentCast;
    window.presentCast=()=>[{id:"h1",name:"Ayla"}];
    await runHeatBursts(chat);
    window.playCharacterTurn=real; window.presentCast=realCast;
    return {beats, openedAfter:chat._heatOpened};
  },[heatN,opened]);

  const r1=await run(1,true);
  ok("heatN=1 → the reply is the whole run, no extra message", r1.beats.length===0, JSON.stringify(r1.beats));
  const r3=await run(3,true);
  ok("heatN=3 → two further beats, numbered 2 and 3", r3.beats.join(",")==="2,3", JSON.stringify(r3.beats));
  ok("and the run consumes the opened flag", r3.openedAfter===undefined, JSON.stringify(r3.openedAfter));
  const rNo=await run(3,false);
  ok("heat switched on mid-turn → the run owns all 3 beats", rNo.beats.join(",")==="1,2,3", JSON.stringify(rNo.beats));

  // ---- the marked reply really does take the heat path in the payload
  const fmt=await pg.evaluate(()=>{
    const chat=curChat();
    state.heatOn=true; state.heatN=1; delete chat._heatOpened; chat.heatNarrN=0;
    heatBeginTurn(chat);
    const isHeat=!!chat._heatBeat;
    const f=fillTpl(blkTpl("heat_format"),{lines:"6",total:chat._heatBeat.total,n:chat._heatBeat.n,
      user:state.user,narr:heatNarrBlock(chat),more:blkTpl("heat_more_no")});
    heatEndTurn(chat);
    return {isHeat, heatFmt:/HEAT OF THE MOMENT/.test(f), lastBeat:/LAST beat/i.test(f)};
  });
  ok("the reply carries the heat marker", fmt.isHeat===true);
  ok("so it is built with the heat format", fmt.heatFmt===true);
  ok("and heatN=1 tells it that it is the last beat", fmt.lastBeat===true);

  // ---- v135.1 — heat going off never leaves a beat behind (the payload kept routing to heat)
  const stale=await pg.evaluate(async()=>{
    const chat=curChat(); const out={};
    // the toggle
    state.heatOn=true; delete chat._heatOpened; heatBeginTurn(chat);
    await toggleMode('heat'); out.toggle=!chat._heatBeat && replyKind(chat,"solo")==="solo";
    // closing a scene clip puts heat back off
    state._heatWasOn=false; state.heatOn=true; heatBeginTurn(chat);
    _heatFollowScene(false); out.scene=!chat._heatBeat && state.heatOn===false && replyKind(chat,"solo")==="solo";
    // a burst run owns its beat: a player turn ending underneath it must not close it
    state.heatOn=true; _heatBusy=true; chat._heatBeat={total:"3",n:"2",narrN:"1"};
    heatEndTurn(chat); out.busyKept=!!chat._heatBeat; _heatBusy=false; heatEndTurn(chat);
    // the one-on-one send path closes beat 1 even when heat went off mid-reply (the clip was closed)
    const stubs=["chatCompletion","presentCast","runPresenceTracker","postTurn","maybeBuildMemory",
      "autoVisualize","autoSpeakMsg","runVoiceCheck","speakPlayerTurn","settleRumors","enqueuePresent"];
    const real={}; stubs.forEach(k=>real[k]=window[k]);
    const _pers=state.personas, _pres=chat.presentIds, _msgs=chat.messages, _key=state.key;
    state.personas=[{id:"p_h",name:"Burcu",universeId:state.universes[0].id,look:{}}];
    chat.presentIds=["p_h"]; chat.messages=[]; state.key="k";
    const solo=presentCast(chat)[0];
    let sawHeat=null;
    window.chatCompletion=async()=>{ if(sawHeat===null){ sawHeat=!!chat._heatBeat; state.heatOn=false; } return '"Tamam."'; };
    window.presentCast=()=>[solo];
    window.runPresenceTracker=async()=>({entered:[],exited:[]});
    ["postTurn","maybeBuildMemory","autoVisualize","autoSpeakMsg","runVoiceCheck","speakPlayerTurn","settleRumors","enqueuePresent"]
      .forEach(k=>window[k]=()=>{});
    const _rp=state.autoRpOn;
    try{
      state.heatOn=true; state.autoRpOn=false; delete chat._heatOpened;
      document.getElementById('chatInput').value='"Selam."'; await sendMessage();
      out.sawHeat=sawHeat; out.afterSend=!chat._heatBeat;
    }catch(e){ out.err=String(e&&e.message||e); }
    finally{ stubs.forEach(k=>window[k]=real[k]); state.heatOn=false; state.autoRpOn=_rp;
      state.personas=_pers; chat.presentIds=_pres; chat.messages=_msgs; state.key=_key; }
    return out;
  });
  ok("toggling heat off clears the beat", stale.toggle===true, JSON.stringify(stale));
  ok("closing the scene clip clears the beat", stale.scene===true, JSON.stringify(stale));
  ok("a running burst keeps its own beat", stale.busyKept===true, JSON.stringify(stale));
  ok("the solo send path ends beat 1 even when heat went off mid-reply",
     stale.sawHeat===true && stale.afterSend===true && !stale.err, JSON.stringify(stale));

  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log(`\n  ${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail?1:0);
})();
