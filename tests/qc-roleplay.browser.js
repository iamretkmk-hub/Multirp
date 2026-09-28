/* v144.1 — QC REPORT, ROLEPLAY CORE. Pins the fixes from out/QC-REPORT.md §3 (#1 #5 #7 #9) and §4.1:
     - a one-on-one Gamemaster reaction is posted (it threw on a reassigned const), through the same
       generator as every other reply ("Name:" stripped, refusals caught);
     - one turn at a time per chat: a second send is refused and the typed line stays in the box;
     - switching chats mid-turn leaves the old chat's presence alone and draws nothing into the new one;
     - in-character lines are not refusals, canned refusals are (curly apostrophes too);
     - the Scene Writer never posts raw JSON, and an empty narration posts nothing;
     - stripNarration / spokenOnly survive unbalanced asterisks;
     - the presence pre-check matches whole words (girl/center/appearance are not cues);
     - solo vs multi is chosen by earshot; router 1 resolves a first name;
     - Retry regenerates the last reply without duplicating the player's line;
     - language directives are language-neutral; the POV rail forbids narrating the player.
   Run: node tests/qc-roleplay.browser.js */
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:process.env.SM_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage({viewport:{width:412,height:915}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file://'+require('path').resolve(__dirname,'..','index.html'));
  await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(800);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x||c).slice(0,700));} };

  /* A scene at the Harbour Bar with two rooms. Every model call is stubbed and recorded; the reply
     text, the routers' answers and an optional delay are set per test through window.__stub. */
  await pg.evaluate(()=>{
    window.__calls=[]; window.__toasts=[];
    const _toast=window.toast; window.toast=(t)=>{ window.__toasts.push(String(t)); try{ _toast(t); }catch(e){} };
    window.__stub={reply:'*I nod.* "Fine."', delay:0, router1:'{"addressed":"group","responders":[]}', router2:'{"continue":false}', scene:'{}'};
    window.chatCompletion=async(messages,model,opts)=>{
      const dbg=(opts&&opts.dbg)||"";
      window.__calls.push({dbg,messages,model});
      if(/^Roleplay reply/.test(dbg)){
        if(window.__stub.delay) await new Promise(r=>setTimeout(r,window.__stub.delay));
        return typeof window.__stub.reply==="function"?window.__stub.reply(dbg,messages):window.__stub.reply;
      }
      if(dbg==="Turn router · player") return window.__stub.router1;
      if(/^Turn router/.test(dbg)) return window.__stub.router2;
      if(/^Scene writer/.test(dbg)) return window.__stub.scene;
      return "{}";
    };
    const uni=state.universes[0];
    uni.locations=[{id:"l_bar",name:"Harbour Bar",description:"b",residents:[],
      sublocations:[{id:"s_bar",name:"Counter"},{id:"s_back",name:"Back room"}]}];
    const mk=(id,n)=>({id,name:n,universeId:uni.id,instructions:"x",personality:"x",backstory:"x",style:"x",goals:"x",look:{}});
    state.personas=[mk("p_a","Ayla Demir"),mk("p_b","Berk Kaya")];
    state.user="Emre"; state.key="k"; state.autoRpOn=false; state.heatOn=false; state.suggestOn=false;
    state.autoSpeak=false; state.narrMode=false; state.mem=false; state.gmOn=false; state.calOn=false;
    state.relOn=false; state.trackOn=false; state.promiseOn=false; state.pulseOn=false; state.autoImg=false;
    state.sceneOn=false; state.streamReveal=false; state.fallbackModel=""; state.storyLang="tr";
    const chat=curChat();
    chat.gameDay=2; chat.period="Afternoon"; chat.locationId="l_bar"; chat.location="Harbour Bar"; chat.subId="s_bar";
    chat.autoPlay=false; chat.storyMode=false; chat.activeEvent=null;
    markChatDirty(chat); show('chat');
    window.__scene=(who,subs)=>{
      const c=curChat();
      c.presentIds=who.slice(); c.subPos=Object.assign({},subs||{}); who.forEach(id=>{ if(!c.subPos[id])c.subPos[id]="s_bar"; });
      c.subId="s_bar"; c.activeEvent=null; c._presenceLastRun=0; c._presenceSeenMid=null;
      c.messages=[{mid:newMid(),role:"assistant",speaker:"Ayla Demir",speakerId:"p_a",
        content:'*I set the glass down.* "They closed the harbour today."',present:who.slice(),toId:"__user__",toName:"Emre"}];
      window.__calls=[]; window.__toasts=[];
      document.getElementById('chatInput').value="";
      try{ renderChat(); }catch(e){}
      return c;
    };
  });
  const settle=()=>pg.evaluate(async()=>{
    for(let i=0;i<100;i++){ await new Promise(r=>setTimeout(r,60));
      if(!_presentPlaying&&!_presentQueue.length&&!chatBusy(curChat(),"turn")) break; }
  });

  console.log("\n[#1 the one-on-one Gamemaster reaction is posted]");
  const gm=await pg.evaluate(async()=>{
    const c=__scene(["p_a"]); __stub.reply='Ayla Demir: *I look at the door.* "Did you hear that?"';
    const p=state.personas[0]; const n=c.messages.length;
    await playSingleReaction(c,p,"A crash from the kitchen.");
    const last=c.messages[c.messages.length-1];
    return {added:c.messages.length-n, speaker:last.speaker, content:last.content, toasts:__toasts.slice(),
      dbg:(__calls.find(x=>/gamemaster reaction/.test(x.dbg))||{}).dbg};
  });
  ok("the reaction lands as a line (it used to throw a TypeError)", gm.added===1 && gm.speaker==="Ayla Demir", JSON.stringify(gm));
  ok("with no 'reaction failed' toast", !gm.toasts.some(t=>/reaction failed|assignment|constant/i.test(t)), JSON.stringify(gm.toasts));
  ok("and the leading 'Name:' is stripped like every other reply", /^\*I look at the door\.\*/.test(gm.content||""), gm.content);
  ok("its debug label is kept", gm.dbg==="Roleplay reply (gamemaster reaction)", gm.dbg);
  ok("a refusal is caught instead of posted", await pg.evaluate(async()=>{
      const c=__scene(["p_a"]); __stub.reply="I'm sorry, but I can't continue this roleplay.";
      const n=c.messages.length; await playSingleReaction(c,state.personas[0],"x");
      return (c.messages.length===n && __toasts.some(t=>/declined/.test(t))) ? true : JSON.stringify({n:c.messages.length-n,t:__toasts}); }));
  ok("the reaction is built for THAT character, not the first one present", await pg.evaluate(async()=>{
      const c=__scene(["p_a","p_b"]); __stub.reply='"Hm."';
      await playSingleReaction(c,state.personas[1],"x");
      const call=__calls.find(x=>/gamemaster reaction/.test(x.dbg));
      const sys=call?call.messages.filter(m=>m.role==="system").map(m=>m.content).join("\n"):"";
      return /Berk Kaya/.test(sys.slice(0,4000)) ? true : sys.slice(0,300); }));

  console.log("\n[#5 one turn at a time]");
  const lock=await pg.evaluate(async()=>{
    const c=__scene(["p_a"]); __stub.reply='"Fine."'; __stub.delay=400;
    const inp=document.getElementById('chatInput');
    inp.value="First line"; const p1=sendMessage();
    await new Promise(r=>setTimeout(r,30));
    inp.value="Second line"; const r2=await sendMessage();
    const keptAfterClick=inp.value;
    inp.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
    await new Promise(r=>setTimeout(r,30));
    const keptAfterEnter=inp.value, busy=chatBusy(c,"turn");
    await p1; __stub.delay=0;
    const users=c.messages.filter(m=>m.role==="user").map(m=>m.content);
    const replies=__calls.filter(x=>/^Roleplay reply/.test(x.dbg)).length;
    const freed=!chatBusy(c,"turn");
    inp.value="";
    return {r2, keptAfterClick, keptAfterEnter, busy, users, replies, freed, toasts:__toasts.slice()};
  });
  ok("a second send while the first is answering is refused", lock.r2===false && lock.busy===true, JSON.stringify(lock));
  ok("and the typed line stays in the box (button and Enter alike)", lock.keptAfterClick==="Second line" && lock.keptAfterEnter==="Second line", JSON.stringify(lock));
  ok("with a hint instead of silence", lock.toasts.some(t=>/Still answering/.test(t)), JSON.stringify(lock.toasts));
  ok("only ONE turn ran: one player line, one reply", lock.users.length===1 && lock.users[0]==="First line" && lock.replies===1, JSON.stringify(lock));
  ok("the lock is released when the turn ends", lock.freed===true);
  ok("voice input holds while a turn is running", await pg.evaluate(()=>/chatBusy\(curChat\(\),"turn"\)/.test(String(nmFlush))));

  console.log("\n[#9 switching chat mid-turn]");
  const sw=await pg.evaluate(async()=>{
    const c=__scene(["p_a"]); __stub.reply='"Later."'; __stub.delay=500;
    const u1=state.universes[0];
    let u2=state.universes.find(u=>u.id==="u_qc2");
    if(!u2){ u2=JSON.parse(JSON.stringify(u1)); u2.id="u_qc2"; u2.name="Elsewhere"; state.universes.push(u2); }
    state.personas.push({id:"p_z",name:"Zed",universeId:"u_qc2",instructions:"x",personality:"x",backstory:"x",style:"x",goals:"x",look:{}});
    const inp=document.getElementById('chatInput'); inp.value="Stay a while";
    const p=sendMessage();
    await new Promise(r=>setTimeout(r,80));
    enterUniverseChat("u_qc2");
    const other=curChat(); other.messages=other.messages||[]; renderChat();
    await p; __stub.delay=0;
    await new Promise(r=>setTimeout(r,300));
    const reply=c.messages.filter(m=>m.role==="assistant").slice(-1)[0];
    const drawn=!!document.querySelector('#chatList [data-mid="'+(reply&&reply.mid)+'"]');
    const res={oldPresent:c.presentIds.slice(), otherId:other.id, oldId:c.id, replied:!!(reply&&reply.content==='"Later."'),
      drawn, otherHas:other.messages.some(m=>m.content==='"Later."'), pending:_presentPendingMids.size};
    enterUniverseChat(u1.id);
    state.personas=state.personas.filter(x=>x.id!=="p_z");
    return res;
  });
  ok("the old chat keeps its present list (it was pruned against the new universe's cast)", sw.oldPresent.join()==="p_a" && sw.otherId!==sw.oldId, JSON.stringify(sw));
  ok("the reply lands in the chat it belongs to", sw.replied===true && sw.otherHas===false, JSON.stringify(sw));
  ok("and no bubble of it is drawn into the chat now open", sw.drawn===false && sw.pending===0, JSON.stringify(sw));
  ok("Story mode sends into its own chat and bails if the player left", await pg.evaluate(()=>{
      const s=String(_smSend);
      return /state\.curChat!==chat\.id/.test(s) && /sendMessage\(\{chat,text:intent/.test(s) && !/inp\.value=/.test(s) ? true : s; }));

  console.log("\n[#7 refusals vs in-character lines]");
  const ref=await pg.evaluate(()=>{
    const no=['"I\'m sorry, but I can\'t stay tonight."',"I'm sorry, but I can't stay tonight.",
      '"I can\'t help it," *I laugh.*',"I cannot continue like this.","I'm not able to sleep.",
      "I can’t help you with that, detective. Not tonight.",'*I shake my head.* “I’m sorry, I can’t do this anymore.”',
      "I can't continue this relationship, Mark.",'"Selam." *Gülümsüyorum.*'];
    const yes=["I'm sorry, but I can't continue this roleplay.","I’m sorry, but I can’t help with that.",
      "I can't assist with that request.","I'm unable to provide that content.","As an AI language model, I must decline.",
      "*I step back.* I'm sorry, I can't continue with this scene as it violates content guidelines.",
      "I apologize, but I cannot fulfill this request.","你好，我无法给到相关内容。"];
    return {fp:no.filter(s=>looksLikeRefusal(s)), fn:yes.filter(s=>!looksLikeRefusal(s))};
  });
  ok("in-character lines are never refusals", ref.fp.length===0, JSON.stringify(ref.fp));
  ok("canned refusals still are, curly apostrophe included", ref.fn.length===0, JSON.stringify(ref.fn));
  ok("the refusal fallback is compared with the model that actually answered", await pg.evaluate(()=>{
      const s=String(generateCharacterReply);
      return /state\.mcModel!==model/.test(s) && /fb!==model/.test(s) && !/state\.model\)/.test(s) ? true : "still compares with state.model"; }));

  console.log("\n[Scene Writer output]");
  const sc=await pg.evaluate(async()=>{
    const out={};
    const run=async(raw)=>{
      const c=__scene(["p_a"]); state.sceneOn=true;
      c.activeEvent={summary:"a storm rolls in",turn:0,minTurns:1,maxTurns:5,type:"environment"};
      __stub.scene=raw; const n=c.messages.length;
      try{ await runSceneWriter(c); }catch(e){ return {err:String(e&&e.message||e)}; }
      await new Promise(r=>setTimeout(r,50));
      const added=c.messages.slice(n).filter(m=>m.narratorEvent||m.sceneBeat).map(m=>m.content);
      c.activeEvent=null; state.sceneOn=false; return {added};
    };
    out.empty=await run('{"narration":"","bring_in":null,"resolved":false,"resolution":null}');
    out.good=await run('{"narration":"Rain hammers the window.","bring_in":null,"resolved":false,"resolution":null}');
    out.broken=await run('{"narration":"The lights flicker.", "bring_in": null, "resolved": fals');
    out.junk=await run('{ this is not json at all');
    return out;
  });
  ok("an empty narration (no beat this turn) posts nothing", sc.empty.added&&sc.empty.added.length===0, JSON.stringify(sc.empty));
  ok("a normal narration is posted", sc.good.added&&sc.good.added[0]==="Rain hammers the window.", JSON.stringify(sc.good));
  ok("an unparseable reply posts only its narration field", sc.broken.added&&sc.broken.added.length===1&&sc.broken.added[0]==="The lights flicker.", JSON.stringify(sc.broken));
  ok("and raw JSON never reaches the player", sc.junk.added&&sc.junk.added.every(t=>!/^[\[{]/.test(t)) && [sc.empty,sc.good,sc.broken].every(r=>(r.added||[]).every(t=>!/^[\[{]/.test(t))), JSON.stringify(sc));

  console.log("\n[unbalanced asterisks]");
  const st=await pg.evaluate(()=>{
    const a='"Fine." *I sigh… "Whatever you say," I mutter. *I turn back.*';
    return {
      a1:spokenOnly(a), a2:stripNarration(a),
      open:spokenOnly('"Hi." *I think about how much I hate him'),
      inner:spokenOnly('*I lean in, "come here," and smile*'),
      emph:spokenOnly('"I *really* mean it." *I nod.*'),
      closer:spokenOnly('She sighs.* "Fine."'),
      balanced:spokenOnly('*sighs* "Fine." *walks off*'),
      plain:stripNarration('No marks at all, just a plain line of prose.')
    };
  });
  ok("a missing asterisk no longer deletes the dialogue", /"Whatever you say,"/.test(st.a1) && /"Fine\."/.test(st.a1) && /"Whatever you say,"/.test(st.a2), JSON.stringify(st));
  ok("nor keeps the narration as if it were said", !/turn back|sigh/.test(st.a1) && !/turn back|sigh/.test(st.a2), JSON.stringify(st));
  ok("an unclosed *… does not leak private narration", st.open==='"Hi."', st.open);
  ok("spoken words inside an action span stay spoken", st.inner==='"come here,"', st.inner);
  ok("an asterisk inside a quote is emphasis, not narration", st.emph==='"I *really* mean it."', st.emph);
  ok("a closer with no opener reaches back to the line start", st.closer==='"Fine."', st.closer);
  ok("balanced spans behave as before", st.balanced==='"Fine."' && st.plain==='No marks at all, just a plain line of prose.', JSON.stringify(st));

  console.log("\n[presence pre-check]");
  const cue=await pg.evaluate(()=>{
    const t=s=>hasPresenceCue({messages:[{mid:"x1",role:"assistant",content:s}]});
    return {
      noEn:["The girl stands at the center of the room, her appearance neat.","She raises her left hand.","It is a digital age."].filter(t),
      noTr:["Güzel bir gün, gelecek hafta bilgisayar alacağım.","Hayır, bunu hiç istemiyorum.","Bu gelenek çok eski."].filter(t),
      yesEn:["She walks in.","Berk arrived an hour ago.","Goodbye, Emre.","I should go.","There's a knock at the door."].filter(s=>!t(s)),
      yesTr:["Emre içeri girdi.","Görüşürüz, ben kaçtım.","Hakan kapıdan çıktı.","Ayla eve geldi.","Hoş geldin!"].filter(s=>!t(s))
    };
  });
  ok("girl / center / appearance / left hand are not cues", cue.noEn.length===0, JSON.stringify(cue.noEn));
  ok("ordinary Turkish sentences are not cues", cue.noTr.length===0, JSON.stringify(cue.noTr));
  ok("real arrivals and departures are (English)", cue.yesEn.length===0, JSON.stringify(cue.yesEn));
  ok("real arrivals and departures are (Turkish)", cue.yesTr.length===0, JSON.stringify(cue.yesTr));
  ok("a line the tracker already read is not a new cue", await pg.evaluate(()=>{
      const c={messages:[{mid:"m1",role:"user",content:"Goodbye!"},{mid:"m2",role:"assistant",content:'"Mm."'}],_presenceSeenMid:"m1"};
      return hasPresenceCue(c)===false ? true : "re-read"; }));
  ok("the presence tracker reads THIS chat's cast", await pg.evaluate(()=>/const cast=curCast\(chat\)/.test(String(runPresenceTracker))));

  console.log("\n[solo vs multi by earshot]");
  const ear=await pg.evaluate(async()=>{
    const c=__scene(["p_a","p_b"],{p_a:"s_bar",p_b:"s_back"}); __stub.reply='"Mm."';
    document.getElementById('chatInput').value="Hello?"; await sendMessage();
    const r={router:__calls.some(x=>x.dbg==="Turn router · player"),
      replies:__calls.filter(x=>/^Roleplay reply/.test(x.dbg)).map(x=>x.dbg),
      speaker:(c.messages.filter(m=>m.role==="assistant"&&!m.sysError&&!m.presenceNote).slice(-1)[0]||{}).speaker};
    const c2=__scene(["p_b"],{p_b:"s_back"}); c2.subSelf=true;   // the player walked off on purpose — nobody follows
    document.getElementById('chatInput').value="Anyone?"; await sendMessage(); c2.subSelf=false;
    r.alone={replies:__calls.filter(x=>/^Roleplay reply/.test(x.dbg)).length, note:c2.messages.some(m=>m.presenceNote&&/can't hear you/.test(m.content))};
    return r;
  });
  ok("one character in earshot → the one-on-one path, even with another in the back room", ear.router===false && ear.replies.length===1 && ear.replies[0]==="Roleplay reply" && ear.speaker==="Ayla Demir", JSON.stringify(ear));
  ok("nobody in earshot → nobody answers, and the player is told who can't hear", ear.alone.replies===0 && ear.alone.note===true, JSON.stringify(ear.alone));

  console.log("\n[router 1 resolves a first name]");
  const r1=await pg.evaluate(async()=>{
    __scene(["p_a","p_b"]); __stub.reply='"Yes?"'; __stub.router1='{"addressed":"Berk","responders":["Berk"]}';
    document.getElementById('chatInput').value="Berk, a word?"; await sendMessage();
    __stub.router1='{"addressed":"group","responders":[]}';
    return __calls.filter(x=>/^Roleplay reply/.test(x.dbg)).map(x=>x.dbg);
  });
  ok("\"Berk\" plays Berk Kaya, not the first person present", r1.length===1 && /Berk Kaya/.test(r1[0]), JSON.stringify(r1));
  ok("the Gamemaster reaction router no longer cuts the beat at 400 characters", await pg.evaluate(()=>{
      const s=String(gamemasterReactions);
      return /_routerLastLine\(/.test(s) && !/\.slice\(0,400\)/.test(s) && !/Present:\\n\$\{_hooksSheet\}/.test(s) ? true : "still cut / hooks repeated"; }));
  await settle();

  console.log("\n[Retry]");
  const rt=await pg.evaluate(async()=>{
    const c=__scene(["p_a"]); __stub.reply='"First try."';
    document.getElementById('chatInput').value="How was the sea?"; await sendMessage();
    await new Promise(r=>setTimeout(r,100));
    const t=_retryTarget(c); const marked=!!document.querySelector('#chatList .bubble.canRetry[data-mid="'+(t&&t.m.mid)+'"]');
    __stub.reply='"Second try."';
    await retryLastReply(t&&t.m.mid);
    const users=c.messages.filter(m=>m.role==="user").map(m=>m.content);
    const replies=c.messages.filter(m=>m.role==="assistant"&&m.speakerId==="p_a").map(m=>m.content);
    return {marked, users, replies};
  });
  ok("the latest reply carries the Retry button", rt.marked===true, JSON.stringify(rt));
  ok("Retry replaces the reply and never duplicates the player's line", rt.users.length===1 && rt.replies.slice(-1)[0]==='"Second try."' && rt.replies.indexOf('"First try."')<0, JSON.stringify(rt));
  const errb=await pg.evaluate(async()=>{
    const c=__scene(["p_a","p_b"]);
    const real=window.runPresenceTracker; window.runPresenceTracker=async()=>{ throw {friendly:"The model timed out."}; };
    try{ await runMultiCharTurn(c,"hi"); } finally{ window.runPresenceTracker=real; }
    const e=c.messages[c.messages.length-1];
    return {speaker:e.speaker, sysError:!!e.sysError, retryable:!!e.retryable};
  });
  ok("a failed multi-character turn is attributed to System, not the player's persona, and can be retried", errb.speaker==="System" && errb.sysError && errb.retryable, JSON.stringify(errb));
  await settle();

  console.log("\n[language directives]");
  ok("mixedLangDirective no longer names Turkish as the competitor", await pg.evaluate(()=>{
      const was=state.storyLang; state.storyLang="de"; const s=mixedLangDirective(["narration"]); state.storyLang=was;
      return !/Turkish/.test(s) && /another language/.test(s) ? true : s.slice(0,200); }));
  ok("German words shared with English are not 'foreign' in a German story", await pg.evaluate(()=>{
      const was=state.storyLang; state.storyLang="de";
      const h=foreignWordHits("Es war still und warm, sie hielt die Tasse."), h2=foreignWordHits("Sie atmete slow ein.");
      state.storyLang=was; return (h.length===0&&h2.join()==="slow") ? true : JSON.stringify({h,h2}); }));
  ok("Turkish keeps the whole marker list", await pg.evaluate(()=>{
      const was=state.storyLang; state.storyLang="tr"; const h=foreignWordHits("Oda still ve warm."); state.storyLang=was;
      return h.join()==="still,warm" ? true : JSON.stringify(h); }));

  console.log("\n[point of view]");
  ok("the voice rail forbids narrating the player", await pg.evaluate(()=>{
      const box=BLOCK_TPL_DEFAULTS.rails_header;
      const m=box.match(/\[\[rail_voice\]\]\n([\s\S]*?)\n\[\[end\]\]/); const t=m?m[1]:"";
      return /never put words in \{\{user\}\}'s mouth/.test(t) && /is not yours to narrate/.test(t) && /does, thinks, feels/.test(t) ? true : t; }));

  ok("no page errors", errs.length===0?true:errs.join(" | "));

  /* The upgrade of a CUSTOMISED guardrails box: its rail_voice section is still the old default
     sentence, another section was edited by the user. After a reload the section is upgraded and
     the user's own edit survives. Runs last — it reloads the page. */
  console.log("\n[a customised guardrails box gets the new rail_voice, and keeps its own edits]");
  await pg.evaluate(()=>{
    const OLD="You are {{self}} and nobody else. One turn, in your own voice. Never write a script of several characters, and never put words in {{user}}'s mouth.";
    let box=BLOCK_TPL_DEFAULTS.rails_header.replace(/(\[\[rail_voice\]\]\n)[\s\S]*?(\n\[\[end\]\])/,"$1"+OLD+"$2");
    box=box.replace(/(\[\[rail_facts\]\]\n)[\s\S]*?(\n\[\[end\]\])/,"$1MY OWN FACTS RULE.$2");
    const bag=Object.assign({},state.blockTpls||{},{rails_header:box});
    store.set(K.blockTpls,bag);
  });
  await pg.reload(); await pg.waitForTimeout(2400);
  const up=await pg.evaluate(()=>{ const t=blkTpl("rails_header"); return {voice:/is not yours to narrate/.test(t), mine:/MY OWN FACTS RULE\./.test(t)}; });
  ok("the old rail_voice sentence is upgraded in place", up.voice===true, JSON.stringify(up));
  ok("and the user's edit to another section survives", up.mine===true, JSON.stringify(up));
  ok("no page errors after reload", errs.length===0?true:errs.join(" | "));

  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close(); process.exit(fail?1:0);
})();
