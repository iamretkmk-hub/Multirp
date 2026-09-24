/* v118.1 — STORY MODE (experimental): IT PLAYS YOU TOO, AND ASKS ONLY AT THE TURNING POINTS.
   Built as its own switch, apart from Autopilot, because the user was unsure how current models
   would play the player's character. Checked here with the model stubbed:
     - the switch is per chat, experimental, and exclusive with Autopilot;
     - whose move it is is decided in code (said to the player → the player's move; one-on-one with
       nobody named → the player's; two characters twice in a row → the player's; else a character);
     - the player's move is DECIDED by x_story_player and WRITTEN by the Auto-RP narrator, then goes
       through the ordinary send, without resetting Story mode's own run;
     - a choice stops the story and shows the options; picking one plays it; a second choice inside
       SM_CHOICE_GAP moves is refused in code and told to the model;
     - a leave moves the clock on and drops the player into the next scene; alone, it only finds a
       scene; at Night it stops and offers End Day; a long scene is told to wrap up;
     - it pauses after smCap moves, and the player typing resets it.
   Run: node tests/story-mode.browser.js */
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

  await pg.evaluate(()=>{
    window.__calls=[]; window.__decide='{"intent":"Ask her why the harbour closed"}';
    window.chatCompletion=async(messages,model,opts)=>{
      const dbg=(opts&&opts.dbg)||"";
      window.__calls.push({dbg,messages});
      if(/^Roleplay reply/.test(dbg)) return '*nods* "Because of the storm."';
      if(dbg==="Story mode · the player's move") return window.__decide;
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
    state.user="Emre"; state.key="k"; state.autoRpOn=false; state.heatOn=false; state.suggestOn=false;
    state.autoSpeak=false; state.narrMode=false; state.mem=false; state.gmOn=false; state.calOn=false;
    state.relOn=false; state.trackOn=false; state.promiseOn=false; state.pulseOn=false; state.autoImg=false;
    state.smDelay=8; state.smCap=20;
    const chat=curChat();
    chat.gameDay=2; chat.period="Afternoon"; chat.locationId="l_bar"; chat.location="Harbour Bar"; chat.subId="s_bar";
    chat.presentIds=["p_a","p_b"]; chat.subPos={p_a:"s_bar",p_b:"s_bar"};
    chat.messages=[{mid:newMid(),role:"assistant",speaker:"Ayla",speakerId:"p_a",
      content:'*She sets the glass down.* "They closed the harbour today."',present:["p_a","p_b"],toId:"__user__",toName:"Emre"}];
    chat.autoPlay=false; chat.storyMode=false;
    markChatDirty(chat); show('chat'); try{ renderChat(); }catch(e){}
    document.getElementById('chatInput').value="";
  });
  const settle=()=>pg.evaluate(async()=>{
    for(let i=0;i<120;i++){ await new Promise(r=>setTimeout(r,100));
      if(!_apBusy&&!_presentPlaying&&!_presentQueue.length&&!document.getElementById('sendBtn').disabled) break; }
  });
  const step=async()=>{ await pg.evaluate(()=>{ _apSince=0; _apLastMid=(_apTail(curChat())||{}).mid; apTick(); }); await settle(); };

  console.log("\n[the switch]");
  ok("Roleplay options carries Story mode, marked experimental", await pg.evaluate(()=>{
      const r=document.querySelector('#cmSec-rp .modeRow[data-mode="story"]');
      return (r && /experimental/i.test(r.textContent)) ? true : "no row"; }));
  ok("it is per chat, starts off, and is stored on the chat", await pg.evaluate(()=>{
      const off=curChat().storyMode===false;
      toggleMode('story');
      const on=curChat().storyMode===true && _slimChat(curChat()).storyMode===true
        && document.querySelector('#cmSec-rp .modeRow[data-mode="story"]').classList.contains('on');
      return (off&&on) ? true : JSON.stringify({off,on}); }));
  ok("it and Autopilot are one or the other", await pg.evaluate(()=>{
      toggleAutopilot(); const a=curChat().autoPlay===true && curChat().storyMode===false;
      toggleStoryMode(); const s=curChat().storyMode===true && curChat().autoPlay===false;
      return (a&&s) ? true : JSON.stringify({a,s}); }));
  ok("its pill replaces Autopilot's", await pg.evaluate(()=>{
      apTick(); const t=(document.getElementById('apPillTxt')||{}).textContent||"";
      return /^Story/.test(t) ? true : t; }));

  console.log("\n[whose move]");
  ok("a line said to the player → the player's move", await pg.evaluate(()=>smNextKind(curChat())==="player"));
  ok("a line said to another character → a character answers", await pg.evaluate(()=>{
      const m=curChat().messages[0]; m.toId="p_b"; const k=smNextKind(curChat()); m.toId="__user__";
      return k==="char" ? true : k; }));
  ok("two characters twice in a row → the player's move", await pg.evaluate(()=>{
      const c=curChat(), m=c.messages[0]; m.toId="p_b"; c._smCharRun=2;
      const k=smNextKind(c); m.toId="__user__"; c._smCharRun=0;
      return k==="player" ? true : k; }));
  ok("one-on-one with nobody named → the player's move", await pg.evaluate(()=>{
      const c=curChat(), m=c.messages[0]; delete m.toId; c.presentIds=["p_a"];
      const k=smNextKind(c); m.toId="__user__"; c.presentIds=["p_a","p_b"];
      return k==="player" ? true : k; }));
  ok("nobody in earshot → move on", await pg.evaluate(()=>{
      const c=curChat(); c.presentIds=[]; const k=smNextKind(c); c.presentIds=["p_a","p_b"];
      return k==="moveon" ? true : k; }));

  console.log("\n[the player's move]");
  ok("nothing before the reading time is up", await pg.evaluate(()=>{
      const c=curChat(), n=c.messages.length; _apSince=Date.now()-3000; _apLastMid=(_apTail(c)||{}).mid; apTick();
      return (!_apBusy && c.messages.length===n) ? true : "moved early"; }));
  await pg.evaluate(()=>{ window.__calls=[]; });
  await step();
  const mv=await pg.evaluate(()=>{
    const c=curChat(); const mine=c.messages.filter(m=>m.role==="user").slice(-1)[0];
    const dec=__calls.find(x=>x.dbg==="Story mode · the player's move");
    return {mine:mine&&mine.content, narrated:__calls.some(x=>x.dbg==="Auto-RP player narrator"),
      replied:__calls.some(x=>/^Roleplay reply/.test(x.dbg)), steps:c._smSteps,
      sys:dec?dec.messages[0].content:"", user:dec?dec.messages[1].content:""};
  });
  ok("the decider is the registry prompt, filled with the player's name", /You play Emre, the player's own character/.test(mv.sys) && mv.sys.indexOf("{{")<0, mv.sys.slice(0,120));
  ok("and it is shown the scene", /THE LAST LINES:\n[\s\S]*They closed the harbour today/.test(mv.user), mv.user.slice(0,300));
  ok("its intention is written out by the narrator", mv.narrated===true, JSON.stringify(mv));
  ok("and sent as the player's turn", /Ask her why the harbour closed/.test(mv.mine||"") && /\*I lean in\.\*/.test(mv.mine||""), JSON.stringify(mv));
  ok("which the characters answer as they would a typed one", mv.replied===true, JSON.stringify(mv));
  ok("and it counts as Story mode's move, not the player's", mv.steps===1, JSON.stringify(mv));

  console.log("\n[choices]");
  await pg.evaluate(()=>{ const c=curChat(); c._smSinceChoice=SM_CHOICE_GAP;
    c.messages.push({mid:newMid(),role:"assistant",speaker:"Ayla",speakerId:"p_a",content:'"Come with me tonight?"',present:["p_a","p_b"],toId:"__user__"});
    window.__decide='{"choice":true,"question":"Ayla wants you to come with her tonight.","options":["Go with her","Say you need time","Refuse"]}'; window.__calls=[]; });
  await step();
  const ch=await pg.evaluate(()=>{
    const c=curChat();
    return {choice:c._smChoice, chips:[...document.querySelectorAll('#autoBar .smOpt')].map(x=>x.textContent),
      q:(document.querySelector('#autoBar .smQ')||{}).textContent||"", sent:c.messages[c.messages.length-1].role,
      label:(document.getElementById('apPillTxt')||{}).textContent};
  });
  ok("a turning point stops the story and asks", !!ch.choice && ch.sent==="assistant" && /your choice/.test(ch.label), JSON.stringify(ch));
  ok("the question and its options are shown to tap", /come with her tonight/.test(ch.q) && ch.chips.join("|")==="Go with her|Say you need time|Refuse", JSON.stringify(ch));
  ok("nothing moves while it waits", await pg.evaluate(()=>{
      const c=curChat(), n=c.messages.length; _apSince=0; apTick();
      return (!_apBusy&&c.messages.length===n) ? true : "moved"; }));
  await pg.evaluate(()=>{ window.__calls=[]; document.querySelectorAll('#autoBar .smOpt')[1].click(); });
  await settle();
  const picked=await pg.evaluate(()=>{ const c=curChat(); const mine=c.messages.filter(m=>m.role==="user").slice(-1)[0];
    return {mine:mine&&mine.content, choice:c._smChoice, since:c._smSinceChoice}; });
  ok("picking one plays it through the narrator", /Say you need time/.test(picked.mine||"") && picked.choice===null, JSON.stringify(picked));
  await pg.evaluate(()=>{ window.__calls=[]; });
  await step();
  const again=await pg.evaluate(()=>{ const c=curChat(); const dec=__calls.find(x=>x.dbg==="Story mode · the player's move");
    const mine=c.messages.filter(m=>m.role==="user").slice(-1)[0];
    return {choice:!!c._smChoice, rule:dec?dec.messages[1].content:"", mine:mine&&mine.content}; });
  ok("right after a choice another one is refused, and the model is told", again.choice===false && /Do not ask another one now/.test(again.rule), JSON.stringify(again));
  ok("so its first option is simply played", /Go with her/.test(again.mine||""), JSON.stringify(again));

  console.log("\n[moving on]");
  const mo=await pg.evaluate(async()=>{
    const c=curChat(); window.__cutCalls=0;
    const realCut=window.runSceneCut;
    window.runSceneCut=async(ch)=>{ __cutCalls++; ch.presentIds=["p_b"]; return true; };
    c.period="Afternoon"; c._smLeaving=true;
    await smMoveOn(c);
    const r={period:c.period, cuts:__cutCalls, present:c.presentIds.join(",")};
    c._smLeaving=false; c.presentIds=[];
    await smMoveOn(c); r.alonePeriod=c.period; r.aloneCuts=__cutCalls;
    c.period="Night"; c._smLeaving=true; c.presentIds=["p_a"];
    await smMoveOn(c); r.nightOver=c._smDayOver; r.nightPeriod=c.period; r.nightCuts=__cutCalls;
    apTick(); r.chip=[...document.querySelectorAll('#autoBar .sugChip')].map(x=>x.textContent.trim()).join("|");
    c._smDayOver=false; c.period="Afternoon"; c.presentIds=["p_a","p_b"];
    window.runSceneCut=realCut;
    return r;
  });
  ok("leaving moves the clock to the next part of the day", mo.period==="Evening", JSON.stringify(mo));
  ok("and drops the player into the next scene", mo.cuts===1 && mo.present==="p_b", JSON.stringify(mo));
  ok("alone, it only finds a scene — the clock stays", mo.alonePeriod==="Evening" && mo.aloneCuts===2, JSON.stringify(mo));
  ok("at Night it stops and offers End Day instead", mo.nightOver===true && mo.nightPeriod==="Night" && mo.nightCuts===2 && /End the day/.test(mo.chip), JSON.stringify(mo));
  ok("a long scene is told to wrap up", await pg.evaluate(async()=>{
      const c=curChat(); c._smSceneAt=0; c._smSinceChoice=0;
      for(let i=0;i<SM_SCENE_WRAP;i++) c.messages.push({mid:newMid(),role:"assistant",speaker:"Berk",speakerId:"p_b",content:'"Mm."',present:["p_a","p_b"],toId:"__user__"});
      window.__calls=[]; window.__decide='{"intent":"Say goodnight and head home","leave":true}';
      _apSince=0; _apLastMid=(_apTail(c)||{}).mid; apTick();
      for(let i=0;i<120&&(_apBusy||document.getElementById('sendBtn').disabled);i++) await new Promise(r=>setTimeout(r,100));
      const dec=__calls.find(x=>x.dbg==="Story mode · the player's move");
      const rule=dec?dec.messages[1].content:"";
      return (/take their leave now/.test(rule) && c._smLeaving===true && smNextKind(c)==="moveon") ? true : JSON.stringify({rule:rule.slice(-200),leaving:c._smLeaving}); }));

  console.log("\n[it stops to check you are still there]");
  ok("after smCap moves it pauses and offers to go on", await pg.evaluate(()=>{
      const c=curChat(); c._smLeaving=false; c._smSteps=state.smCap; const n=c.messages.length;
      _apSince=0; apTick();
      const chip=[...document.querySelectorAll('#autoBar .sugChip')].map(x=>x.textContent.trim()).join("|");
      return (!_apBusy&&c.messages.length===n&&/Continue the story/.test(chip)) ? true : JSON.stringify({chip}); }));
  ok("the player typing their own turn resets the run and any choice", await pg.evaluate(()=>{
      const c=curChat(); c._smSteps=9; c._smChoice={question:"q",options:["a","b"]};
      apPlayerActed(c);
      return (c._smSteps===0&&c._smChoice===null&&c._smSinceChoice===0) ? true : JSON.stringify({s:c._smSteps}); }));
  ok("but Story mode's own sends do not", await pg.evaluate(()=>{
      const c=curChat(); c._smSteps=5; _smSending=true; apPlayerActed(c); _smSending=false;
      return c._smSteps===5 ? true : c._smSteps; }));

  console.log("\n[it knows what the player knows, and only that]");
  const kn=await pg.evaluate(async()=>{
    const c=curChat(); const uni=state.universes[0];
    state.mem=true; state.calOn=true; state.promiseOn=true; state.curUniverse=uni.id;
    c.period="Morning"; noteWhereabouts(c,["p_a","__user__"],{placeId:"l_bar",place:"Harbour Bar"}); c.period="Afternoon";
    const p=state.personas.find(x=>x.id==="p_a"); p.relationships={"__user__":{tie:"Emre's older sister",relationship:"protective of him"}};
    const mk=(o)=>Object.assign({id:"m_"+Math.random().toString(36).slice(2),universeId:uni.id,chatId:c.id,gameDay:1,gamePeriod:"Evening",importance:0.7,type:"EVENT",date:Date.now()},o);
    state.memory=[
      mk({ownerId:"p_a",character:"Ayla",people:["Emre"],content:"Emre told me he lost the boat money.",location:"Harbour Bar"}),
      mk({ownerId:"p_b",character:"Berk",people:["Ayla"],content:"SECRET: I watched Ayla meet the smuggler alone."}),
      mk({ownerId:"p_a",character:"Ayla",people:["Emre"],content:"PRIVATE: I decided I will never forgive him.",type:"DECISION",source:"after_heat"})
    ];
    c.calendar=[{id:"c1",kind:"meeting",title:"Dinner with Berk at the harbour",who:"Emre, Berk",day:2,period:"Evening",certainty:"certain",done:false}];
    c.promises=[]; recordPromise(c,{holder:"Emre",to:"Ayla",promise:"you will pay back the boat money by Friday",kind:"promise",shows_as:"when they next talk about money"},2);
    c.intents=[{holderId:"p_b",targetId:"__user__",status:"active",aim:"MOTIVE: Berk wants to ruin Emre"}];
    const k=_playerKnows(c);
    window.__calls=[]; window.__decide='{"intent":"Bring up the money"}';
    c._smChoice=null; c._smDayOver=false; c._smLeaving=false; c._smSteps=0;
    c.messages.push({mid:newMid(),role:"assistant",speaker:"Ayla",speakerId:"p_a",content:'"So?"',present:["p_a","p_b"],toId:"__user__"});
    _apSince=0; _apLastMid=(_apTail(c)||{}).mid; apTick();
    for(let i=0;i<120&&(_apBusy||document.getElementById('sendBtn').disabled);i++) await new Promise(r=>setTimeout(r,100));
    const dec=__calls.find(x=>x.dbg==="Story mode · the player's move");
    const sug=null;
    return {k, user:dec?dec.messages[1].content:"", sys:dec?dec.messages[0].content:""};
  });
  ok("where they were earlier today", /EARLIER TODAY:\n- Morning: Harbour Bar — with Ayla/.test(kn.user), kn.k.today);
  ok("their tie to the person in front of them", /THE PEOPLE HERE:\n[\s\S]*Ayla: Emre's older sister/.test(kn.user), kn.k.people);
  ok("what happened in scenes they were in", /lost the boat money/.test(kn.user), kn.k.memories);
  ok("their plans", /Dinner with Berk/.test(kn.user), kn.k.plans);
  ok("the words they have given", /pay back the boat money/.test(kn.user), kn.k.promises);
  ok("but not what somebody else saw without them", kn.user.indexOf("SECRET")<0, kn.k.memories);
  ok("nor a character's private reckoning", kn.user.indexOf("PRIVATE")<0, kn.k.memories);
  ok("nor anybody's private motive", kn.user.indexOf("MOTIVE")<0, "motive leaked");
  ok("and the prompt tells it to stay on track with all of it", /STAY ON TRACK/.test(kn.sys), kn.sys.slice(-300));
  ok("the suggestion writer is given the same", await pg.evaluate(async()=>{
      const c=curChat(); c.storyMode=false; state.suggestOn=true; window.__calls=[];
      await fetchSuggestions(c,(_apTail(c)||{}).mid);
      const call=__calls.find(x=>x.dbg==="Suggested replies"); const u=call?call.messages[1].content:"";
      c.storyMode=true; state.suggestOn=false;
      return (/Dinner with Berk/.test(u)&&/pay back the boat money/.test(u)&&/lost the boat money/.test(u)&&u.indexOf("SECRET")<0) ? true : u.slice(0,400); }));

  console.log("\n[settings and prompts]");
  ok("pace and run length save, clamped", await pg.evaluate(()=>{
      show('settings'); syncSettingsUI();
      document.getElementById('setSmDelay').value="1"; document.getElementById('setSmCap').value="30";
      saveSettings(false);
      const r={d:state.smDelay,c:state.smCap,sd:store.raw(K.smDelay,null),sc:store.raw(K.smCap,null)};
      show('chat');
      return (r.d===8&&r.c===30&&r.sd==="8"&&r.sc==="30") ? true : JSON.stringify(r); }));
  ok("all three prompts are registry prompts on the Story mode card", await pg.evaluate(()=>{
      const bad=["x_story_player","x_story_no_choice","x_story_wrap_up"].filter(k=>
        !PROMPT_BY_KEY[k]||!K[k]||!ENGINE_PAYLOAD_DEFS.some(d=>d.key==="story_mode"&&(d.blocks||[]).some(x=>x.promptKey===k)));
      return bad.length?bad.join(","):true; }));
  ok("switching it off hands the bar back", await pg.evaluate(()=>{
      toggleStoryMode(); apTick();
      return (curChat().storyMode===false && !/^Story/.test((document.getElementById('apPillTxt')||{}).textContent||"")) ? true : "still story"; }));

  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log(`\n  ${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail?1:0);
})();
