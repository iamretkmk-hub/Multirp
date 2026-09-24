/* v116.0 — THE SCENE KEEPS GOING WHEN YOU ARE QUIET.
   Reported: "If I don't type anything, the game is dead. I always need to go somewhere, bring a
   character and start with hi — and it is too exhausting to think and direct all the time."
   Every director hung off postTurn, which only ran after the player sent something.
   Two answers, both checked here with the model stubbed:
     AUTOPILOT (per chat) — after state.apDelay seconds of quiet, a character in earshot takes the
       next beat through the ordinary playCharacterTurn, carrying an editable note that tells them
       to move the moment themselves. Never the last speaker when someone else is there; a question
       left hanging doubles the wait and gets its own note; typing holds it; a run is capped.
     SUGGESTED REPLIES — when the scene settles on someone else's line, three short intentions
       appear above the text box; tapping one goes through the Auto-RP narrator even with Auto-RP
       off, because an intention is not a finished turn.
   Run: node tests/autopilot.browser.js */
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
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x||c).slice(0,700));} };

  /* The model, stubbed: every call is recorded, a roleplay reply is a short line, the suggestion
     writer returns three options, the narrator wraps what it was given, everything else is "{}". */
  const setup=()=>pg.evaluate(()=>{
    window.__calls=[];
    window.chatCompletion=async(messages,model,opts)=>{
      const dbg=(opts&&opts.dbg)||"";
      window.__calls.push({dbg,messages});
      if(/^Roleplay reply/.test(dbg)) return '*leans back* "Well, somebody has to say it."';
      if(dbg==="Suggested replies") return '{"options":["Ask what she meant","Pour two drinks","Head for the harbour"]}';
      if(dbg==="Auto-RP player narrator"){
        const u=messages.filter(m=>m.role==="user").map(m=>m.content).join("\n");
        const said=(u.match(/rewrite this as their turn\):\n([\s\S]*)$/)||[])[1]||"?";
        return '*I lean in.* "'+said.trim()+'"';
      }
      return "{}";
    };
    const uni=state.universes[0];
    uni.locations=[{id:"l_bar",name:"Harbour Bar",description:"b",residents:[],sublocations:[{id:"s_bar",name:"Counter"}]}];
    const mk=(id,n)=>({id,name:n,universeId:uni.id,instructions:"x",personality:"x",backstory:"x",style:"x",goals:"x",look:{}});
    state.personas=[mk("p_a","Ayla"),mk("p_b","Berk")];
    state.user="Emre"; state.key="k"; state.autoRpOn=false; state.heatOn=false; state.suggestOn=true;
    state.autoSpeak=false; state.narrMode=false; state.mem=false; state.gmOn=false; state.calOn=false;
    state.relOn=false; state.trackOn=false; state.promiseOn=false; state.pulseOn=false; state.autoImg=false;
    state.apDelay=10; state.apCap=3;
    const chat=curChat();
    chat.gameDay=2; chat.period="Evening"; chat.locationId="l_bar"; chat.location="Harbour Bar"; chat.subId="s_bar";
    chat.presentIds=["p_a","p_b"]; chat.subPos={p_a:"s_bar",p_b:"s_bar"};
    chat.messages=[]; chat.activeEvent=null; chat.dnd=false; chat.autoPlay=false; chat._apBeats=0;
    chat.messages.push({mid:newMid(),role:"assistant",speaker:"Ayla",speakerId:"p_a",
      content:'*She sets the glass down.* "They closed the harbour today."',present:["p_a","p_b"],toId:"__user__",toName:"Emre"});
    markChatDirty(chat);
    show('chat');
    try{ renderChat(); }catch(e){}
    document.getElementById('chatInput').value="";
    return true;
  });
  await setup();
  // Hold the once-a-second ticker still while the setup is inspected: the tests below drive apTick by hand.
  const quiet=ms=>pg.evaluate(ms=>{ _apSince=Date.now()-ms; _apLastMid=(_apTail(curChat())||{}).mid; },ms);

  console.log("\n[the switches]");
  ok("Roleplay options carries an Autopilot row and a Suggested replies row", await pg.evaluate(()=>
      !!document.querySelector('#cmSec-rp .modeRow[data-mode="autopilot"]')
   && !!document.querySelector('#cmSec-rp .modeRow[data-mode="suggest"]')));
  ok("Autopilot is per chat and starts off", await pg.evaluate(()=>curChat().autoPlay===false && _modeState('autopilot')===false));
  ok("toggling it lights the row and is stored on the chat", await pg.evaluate(()=>{
      toggleMode('autopilot');
      const on=curChat().autoPlay===true
        && document.querySelector('#cmSec-rp .modeRow[data-mode="autopilot"]').classList.contains('on');
      const slim=_slimChat(curChat());
      return (on && slim.autoPlay===true && !("_apBeats" in slim)) ? true : JSON.stringify({on,ap:slim.autoPlay}); }));
  ok("its pill appears above the text box", await pg.evaluate(()=>{
      apTick();
      const bar=document.getElementById('autoBar');
      return (!bar.classList.contains('hide') && !!document.getElementById('apPill')) ? true : bar.outerHTML.slice(0,200); }));

  console.log("\n[who takes the beat]");
  ok("never the last speaker when someone else is in earshot", await pg.evaluate(()=>{
      const p=apPickNext(curChat());
      return (p.p.name==="Berk" && p.addressed==="Ayla" && !p.hanging) ? true : JSON.stringify({n:p.p.name,a:p.addressed,h:p.hanging}); }));
  ok("the note tells them to take the beat and never speak for the player", await pg.evaluate(()=>{
      const n=apPickNext(curChat()).note;
      return (/Emre has not said anything/.test(n) && /never speak, act or decide for them/.test(n) && n.indexOf("{{")<0) ? true : n; }));
  ok("alone with one character, that character carries on", await pg.evaluate(()=>{
      const chat=curChat(); chat.presentIds=["p_a"];
      const p=apPickNext(chat); chat.presentIds=["p_a","p_b"];
      return (p.p.name==="Ayla" && p.addressed==="Emre") ? true : JSON.stringify({n:p.p.name,a:p.addressed}); }));
  ok("a question they put to the player gets the silence note instead", await pg.evaluate(()=>{
      const chat=curChat(); chat.presentIds=["p_a"];
      const m=chat.messages[chat.messages.length-1], was=m.content;
      m.content='*She waits.* "Are you coming with me or not?"';
      const p=apPickNext(chat);
      m.content=was; chat.presentIds=["p_a","p_b"];
      return (p.hanging && /let your last words hang/.test(p.note)) ? true : JSON.stringify({h:p.hanging,n:p.note.slice(0,80)}); }));
  ok("a question only in the narration is not one", await pg.evaluate(()=>
      _apAskedPlayer({role:"assistant",toId:"__user__",content:'*Would he ever come back?* "I am done here."'})===false
   && _apAskedPlayer({role:"assistant",toId:"__user__",content:'"You are coming, right?"'})===true
   && _apAskedPlayer({role:"assistant",toId:"p_b",content:'"You are coming, right?"'})===false));

  console.log("\n[when it moves]");
  ok("not before the quiet has lasted", await pg.evaluate(()=>{
      _apSince=Date.now()-4000; _apLastMid=(_apTail(curChat())||{}).mid;
      const n=curChat().messages.length; apTick();
      return (!_apBusy && curChat().messages.length===n) ? true : "a beat started early"; }));
  ok("typing holds it, and says so", await pg.evaluate(()=>{
      const inp=document.getElementById('chatInput'); inp.value="wait";
      _apSince=Date.now()-60000; apTick();
      const held=!_apBusy, label=(document.getElementById('apPillTxt')||{}).textContent;
      inp.value="";
      return (held && /paused while you type/.test(label)) ? true : JSON.stringify({held,label}); }));
  await quiet(11000);
  const beat=await pg.evaluate(async()=>{
    const chat=curChat(); const n=chat.messages.length; window.__calls=[];
    apTick();
    const started=_apBusy;
    for(let i=0;i<80&&_apBusy;i++) await new Promise(r=>setTimeout(r,100));
    const reply=window.__calls.find(c=>/^Roleplay reply/.test(c.dbg));
    const sys=reply?reply.messages.filter(m=>m.role==="system"):[];
    const last=chat.messages[chat.messages.length-1];
    return {started, added:chat.messages.length-n, speaker:last.speaker, beats:chat._apBeats,
      lastSys:sys.length?sys[sys.length-1].content:"", dbg:reply&&reply.dbg};
  });
  ok("after the quiet a beat is played", beat.started===true, JSON.stringify(beat));
  ok("by the other character, as an ordinary reply", beat.speaker==="Berk" && beat.added>=1, JSON.stringify(beat));
  ok("with the Autopilot note as the last thing it read", /has not said anything since the last line/.test(beat.lastSys), beat.lastSys.slice(0,160));
  ok("and it counts toward the run", beat.beats===1, JSON.stringify(beat));
  ok("a run stops at the cap and waits for the player", await pg.evaluate(()=>{
      const chat=curChat(); chat._apBeats=state.apCap;
      _apSince=Date.now()-600000; const n=chat.messages.length; apTick();
      const label=(document.getElementById('apPillTxt')||{}).textContent;
      return (!_apBusy && chat.messages.length===n && /your turn/.test(label)) ? true : JSON.stringify({busy:_apBusy,label}); }));
  ok("a question left hanging doubles the wait", await pg.evaluate(()=>{
      const chat=curChat(); chat._apBeats=0;
      chat.messages.push({mid:newMid(),role:"assistant",speaker:"Berk",speakerId:"p_b",
        content:'"So, are you in?"',present:["p_a","p_b"],toId:"__user__",toName:"Emre"});
      _apLastMid=chat.messages[chat.messages.length-1].mid; _apSince=Date.now()-15000;
      apTick(); const early=_apBusy;
      chat.messages.pop(); _apLastMid=(_apTail(chat)||{}).mid;
      return early===false ? true : "played at 1.5x the delay"; }));
  ok("the player sending anything starts the run over", await pg.evaluate(()=>{
      const chat=curChat(); chat._apBeats=2; apPlayerActed(chat);
      return chat._apBeats===0 ? true : chat._apBeats; }));
  ok("switched off, nothing plays", await pg.evaluate(()=>{
      const chat=curChat(); toggleAutopilot();
      _apSince=Date.now()-600000; const n=chat.messages.length; apTick();
      return (chat.autoPlay===false && !_apBusy && chat.messages.length===n && !document.getElementById('apPill')) ? true : "still playing"; }));

  console.log("\n[suggested replies]");
  const sug=await pg.evaluate(async()=>{
    const chat=curChat(); window.__calls=[];
    _sugFor=null; _sugOpts=[]; _sugBusy=false; _apSince=Date.now()-2000; _apLastMid=(_apTail(chat)||{}).mid;
    apTick();
    for(let i=0;i<40&&_sugBusy;i++) await new Promise(r=>setTimeout(r,50));
    const call=window.__calls.find(c=>c.dbg==="Suggested replies");
    const chips=[...document.querySelectorAll('#autoBar .sugChip')].map(x=>x.textContent.trim());
    return {chips, sys:call?call.messages[0].content:"", user:call?call.messages[1].content:""};
  });
  ok("the scene settling on a character's line asks for three ideas", sug.chips.filter(x=>/Ask what she meant|Pour two drinks|Head for the harbour/.test(x)).length===3, JSON.stringify(sug.chips));
  ok("with a way to keep going without choosing one", sug.chips.indexOf("Keep going")>-1, JSON.stringify(sug.chips));
  ok("the writer is the registry prompt, filled with the player's name", /You suggest what Emre could do next/.test(sug.sys) && sug.sys.indexOf("{{")<0, sug.sys.slice(0,120));
  ok("and it is shown the last lines of the scene", /THE LAST LINES:\n[\s\S]*They closed the harbour today/.test(sug.user), sug.user.slice(0,300));
  ok("it is asked once per line, not every second", await pg.evaluate(()=>{
      window.__calls=[]; apTick(); apTick();
      return window.__calls.filter(c=>c.dbg==="Suggested replies").length===0 ? true : "asked again"; }));
  ok("typing hides the ideas", await pg.evaluate(()=>{
      const inp=document.getElementById('chatInput'); inp.value="x"; renderAutoBar();
      const hidden=document.querySelectorAll('#autoBar .sugChip').length===0;
      inp.value=""; renderAutoBar();
      return hidden ? true : "still showing"; }));
  const tap=await pg.evaluate(async()=>{
    const chat=curChat(); window.__calls=[]; state.autoRpOn=false;
    const chip=[...document.querySelectorAll('#autoBar .sugChip')].find(x=>/Pour two drinks/.test(x.textContent));
    if(!chip) return {err:"no chip"};
    chip.click();
    for(let i=0;i<80;i++){ await new Promise(r=>setTimeout(r,100)); if(!document.getElementById('sendBtn').disabled&&!_presentPlaying) break; }
    const mine=chat.messages.filter(m=>m.role==="user").slice(-1)[0];
    return {narrated:window.__calls.some(c=>c.dbg==="Auto-RP player narrator"), content:mine&&mine.content,
      stillOff:state.autoRpOn===false, flag:_apForceRp, cleared:_sugOpts.length===0||_sugFor!==null};
  });
  ok("tapping one runs it through the narrator even with Auto-RP off", tap.narrated===true && tap.stillOff===true, JSON.stringify(tap));
  ok("and sends the narrated turn as the player's", /Pour two drinks/.test(tap.content||"") && /\*I lean in\.\*/.test(tap.content||""), JSON.stringify(tap));
  ok("the forced narration is spent on that one send", tap.flag===false, JSON.stringify(tap));
  ok("switched off, no ideas are asked for", await pg.evaluate(()=>{
      toggleSuggest(); window.__calls=[]; _sugFor=null; _apSince=Date.now()-5000; apTick();
      const none=window.__calls.filter(c=>c.dbg==="Suggested replies").length===0;
      const off=state.suggestOn===false && store.get(K.suggestOn,true)===false;
      toggleSuggest();
      return (none&&off) ? true : JSON.stringify({none,off}); }));

  console.log("\n[settings and prompts]");
  ok("the wait and the cap save, clamped", await pg.evaluate(()=>{
      show('settings'); syncSettingsUI();
      document.getElementById('setApDelay').value="2"; document.getElementById('setApCap').value="12";
      saveSettings(false);
      const r={d:state.apDelay,c:state.apCap,sd:store.raw(K.apDelay,null),sc:store.raw(K.apCap,null)};
      show('chat');
      return (r.d===30 && r.c===12 && r.sd==="30" && r.sc==="12") ? true : JSON.stringify(r); }));
  ok("all three prompts are registry prompts with a card", await pg.evaluate(()=>{
      const bad=["x_autopilot_beat","x_autopilot_silence","x_reply_suggest"].filter(k=>
        !PROMPT_BY_KEY[k]||!K[k]||!ENGINE_PAYLOAD_DEFS.some(d=>(d.blocks||[]).some(x=>x.promptKey===k)));
      return bad.length?bad.join(","):true; }));
  ok("an edit to the beat note reaches the next beat", await pg.evaluate(()=>{
      state.user="Emre";   // the Settings save above re-reads the player name from its own field
      const was=state.x_autopilot_beat; state.x_autopilot_beat="MY NOTE for {{user}}.";
      const n=apPickNext(curChat()).note; state.x_autopilot_beat=was;
      return n==="MY NOTE for Emre." ? true : n; }));

  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log(`\n  ${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail?1:0);
})();
