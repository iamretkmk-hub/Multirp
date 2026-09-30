/* v148.5 — reported: "Hakan entering the scene was completely unnecessary, and worse, how can he know what
   Özlem and I were talking about — his entry narration says it." Two causes, both reproduced here:
     1. every transcript builder labelled a line with no speaker as the FIRST character of the cast, so the
        app's own "— Yeni görev: … —" notice read "Hakan Akbaba: — Yeni görev …" and the presence tracker
        took it for Hakan arriving;
     2. an arrival detected by the presence tracker handed the arrival narrator the room's last three lines
        as the "why", so the newcomer walked in knowing a bet made between two other people.
   Also: three shipped narrators said "in Turkish" whatever the story's language.
   Run: NODE_PATH=/path/to/node_modules node tests/presence-notice-attribution.browser.js */
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:process.env.SM_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage({viewport:{width:412,height:915}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  const file='file://'+require('path').resolve(__dirname,'..','index.html');
  await pg.goto(file); await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(900);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x===undefined?c:x).slice(0,900));} };

  const setup=()=>pg.evaluate(()=>{
    const uni=state.universes[0]; state.curUniverse=uni.id;
    const mk=(id,name)=>({id,name,universeId:uni.id,instructions:"x",personality:"You are a restless dreamer",backstory:"x",style:"x",goals:"x",look:{}});
    state.personas=state.personas.filter(p=>!/^pa_/.test(p.id));
    // Hakan FIRST in the cast — the old fallback's pick
    state.personas.unshift(mk("pa_ha","Hakan Akbaba")); state.personas.push(mk("pa_oz","Özlem Özüçak"),mk("pa_bu","Buket Özüçak"));
    state.user="Emre"; state.key="sk-test"; state.presenceOff=false;
    const c=curChat(); c.universeId=uni.id; c.presentIds=["pa_oz","pa_bu"]; c.gameDay=1; c.period="Afternoon"; c.timeOfDay="Afternoon"; c.locationId=null; c.location="Palmera Beach Club";
    c.messages=[
      {mid:"b1",role:"assistant",speaker:"Özlem Özüçak",speakerId:"pa_oz",content:'*Kıs kıs gülüyorum.* "Bak sen şu işe! Kabul ediyorum ama ben istediğimi almadan asla bırakmam."',present:["pa_oz"]},
      {mid:"b2",role:"assistant",narratorEvent:true,questNote:true,present:[],content:"— Yeni görev: Deniz yarışı: kaybeden kıyıda ne isterse yapacak —"},
      {mid:"b3",role:"user",content:'"Göreceğiz bakalım kim kimi bırakmıyor," *diyerek aniden hızlanıyorum.*',present:["pa_oz"]},
      {mid:"b4",role:"assistant",speaker:"Özlem Özüçak",speakerId:"pa_oz",content:'*Hızla kulaç atıyorum.* "Hile yapmak yok!"',present:["pa_oz"]}];
    window.__calls=[];
    window.__reply=()=>"{}";
    window.chatCompletion=async(msgs,model,opts)=>{ const d=(opts&&opts.dbg)||""; window.__calls.push({dbg:d,text:JSON.stringify(msgs)}); return window.__reply(d,msgs); };
    return true;
  });

  console.log("\n[1. an unsigned line is the Narrator's, never the first character of the cast]");
  await setup();
  const T=await pg.evaluate(()=>{ const c=curChat();
    c.messages.push({mid:"b5",role:"assistant",narratorEvent:true,present:["pa_oz"],content:"Dalgalar kıyıya vuruyor."});
    return {room:castConvoText(c,6,"__room__"),player:castConvoText(c,6),gm:recentExchangeText(c,6),
            ls:[lineSpeaker({content:"x",questNote:true},"Hakan Akbaba"),lineSpeaker({content:"x"},"Hakan Akbaba"),lineSpeaker({speaker:"Özlem Özüçak"},"Hakan Akbaba")]}; });
  ok("the task notice is not a line anyone said: it is left out of the room's transcript", !/Yeni görev/.test(T.room)&&!/Yeni görev/.test(T.player), T.room);
  ok("a narrator beat reads as the Narrator's, not Hakan's", /Narrator: Dalgalar/.test(T.room)&&!/Hakan Akbaba:/.test(T.room)&&!/Hakan Akbaba:/.test(T.gm), T.room+"\n---\n"+T.gm);
  ok("lineSpeaker: notice → Narrator, legacy unsigned line → the fallback, a signed line → its speaker",
     JSON.stringify(T.ls)==='["Narrator","Hakan Akbaba","Özlem Özüçak"]', JSON.stringify(T.ls));

  console.log("\n[2. the presence tracker no longer reads the notice as Hakan arriving]");
  await setup();
  const P=await pg.evaluate(async()=>{ const c=curChat(); c._presenceLastRun=-99;
    await runPresenceTracker(c); const call=window.__calls.find(x=>/Presence tracker/.test(x.dbg)); return call?call.text:""; });
  ok("its latest exchange has no 'Hakan Akbaba: — Yeni görev' line", !!P&&!/Hakan Akbaba: —/.test(P)&&!/Yeni görev/.test(P), P.slice(0,900));

  console.log("\n[3. an arrival's beat knows nothing of what was said before the newcomer came]");
  await setup();
  const W=await pg.evaluate(()=>{ const c=curChat(); const h=state.personas.find(p=>p.id==="pa_ha");
    const none=_arrivalWhy(c,[h]);
    c.messages.push({mid:"b6",role:"user",content:'*Kıyıya dönüp el sallıyorum.* "Hakan! Gel buraya, hakem lazım!"',present:["pa_oz"]});
    return {none,called:_arrivalWhy(c,[h])}; });
  ok("nobody named him: no 'why' at all (not the race between Emre and Özlem)", W.none==="", JSON.stringify(W.none));
  ok("someone calls him by name: that line — and only that — is why he comes", /Hakan! Gel buraya/.test(W.called)&&!/Hile yapmak|istediğimi almadan/.test(W.called), W.called);
  await setup();
  const N=await pg.evaluate(async()=>{ const c=curChat(); window.__reply=()=>"Hakan içeri girdi.";
    c._presenceLastRun=-99; window.__reply=(d)=>/Presence/.test(d)?'{"exit":[],"enter":["Hakan Akbaba"],"move":{}}':"Hakan kulübe geldi.";
    await runPresenceTracker(c);
    const mv=window.__calls.find(x=>/Character move/.test(x.dbg)); return mv?mv.text:""; });
  ok("even when the tracker brings him in, the move narrator is told he heard nothing before and gets no conversation",
     !!N&&/heard and saw NOTHING of what was said or done here before they arrived/.test(N)&&/not known — imply an ordinary reason/.test(N)&&!/Hile yapmak|kim kimi bırakmıyor|Deniz yarışı/.test(N), N.slice(0,1400));

  console.log("\n[4. the shipped narrators follow the story's language]");
  const L=await pg.evaluate(()=>({move:/Turkish/.test(DEFAULT_CHAR_MOVE),travel:/Turkish/.test(DEFAULT_TRAVEL),gm:/in Turkish, third person/.test(DEFAULT_GM_AUTHOR),
    lang:/story's language/.test(DEFAULT_CHAR_MOVE)&&/story's language/.test(DEFAULT_TRAVEL)&&/in the story's language, third person/.test(DEFAULT_GM_AUTHOR)}));
  ok("no 'in Turkish' left in the travel, character-move and arrival narrators", !L.move&&!L.travel&&!L.gm&&L.lang, JSON.stringify(L));
  await pg.evaluate(()=>{
    const old=DEFAULT_CHAR_MOVE.replace("- Write in the story's language (the language instruction below says which), perfect and natural. Do NOT translate word-for-word from English — capture the intent and write it as a native speaker would.","- Write in perfect, natural Turkish. Do NOT translate word-for-word from English — capture the intent and write it as it should read in Turkish.").replace("third person. No JSON,","third person, in Turkish. No JSON,")+"\n(my own edit)";
    store.setRaw(K.charMovePrompt,old);
  });
  await pg.reload(); await pg.waitForTimeout(2600);
  const R=await pg.evaluate(()=>({t:state.charMovePrompt||"",}));
  ok("a stored copy is repaired in place and keeps the player's own edit", !/Turkish/.test(R.t)&&/story's language/.test(R.t)&&/\(my own edit\)/.test(R.t), R.t.slice(-400));

  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close(); process.exit(fail?1:0);
})();
