/* v139.1 — A NOTICE ON SCREEN DOES NOT TAKE THE SUGGESTED REPLIES AWAY.
   Reported: "the reply suggestions disappeared … it seems like after a notification comes on screen".
   The chips were shown only when the newest message was not a sysError, and an arrival/leaving note
   ("Özlem has arrived") is a presenceNote carrying sysError — so whenever somebody came or went the
   chips vanished until somebody spoke. Player-facing notices (a plan filed, a calendar note) did not
   hide them but threw a good set away to fetch a new one about nothing.
   Run: node tests/suggest-after-notice.browser.js */
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:process.env.SM_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage({viewport:{width:412,height:915}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file://'+require('path').resolve(__dirname,'..','index.html'));
  await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(700);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x||c).slice(0,700));} };
  const chips=()=>pg.evaluate(()=>[...document.querySelectorAll('#autoBar .sugChip')]
    .filter(b=>!b.classList.contains('sugKeep')&&!b.classList.contains('sugRe')&&!b.classList.contains('sugWait')).map(b=>b.textContent));

  await pg.evaluate(()=>{
    const uni=state.universes[0];
    const mk=(id,n)=>({id,name:n,universeId:uni.id,instructions:"x",personality:"x",backstory:"x",style:"x",goals:"x",look:{subject:"Woman"}});
    if(!state.personas.some(p=>p.id==="sn1")) state.personas.push(mk("sn1","Ayla"));
    if(!state.personas.some(p=>p.id==="sn2")) state.personas.push(mk("sn2","Ozlem"));
    state.key="test"; state.suggestOn=true; state.user="Emre";
    const chat=curChat(); chat.presentIds=["sn1"]; chat.autoPlay=false; chat.storyMode=false;
    chat.messages=[{mid:"a1",role:"user",content:"Merhaba.",present:["sn1"]},
      {mid:"a2",role:"assistant",speaker:"Ayla",speakerId:"sn1",content:"\"Selam?\"",present:["sn1"],toId:"__user__"}];
    window.__sug=[];
    window.chatCompletion=async(msgs,model,o)=>{
      if(/Suggested/.test((o&&o.dbg)||"")){ window.__sug.push(msgs.map(m=>String(m.content)).join("\n"));
        return '{"options":["Idea '+window.__sug.length+'","B","C"]}'; }
      return ""; };
    show('chat'); renderChat();
  });
  await pg.waitForTimeout(3000);
  ok("suggestions show on a character's line", (await chips()).length===3, JSON.stringify(await chips()));

  console.log("\n[an arrival note]");
  await pg.evaluate(()=>{ const chat=curChat(); chat.presentIds.push("sn2"); notePresence(chat,["Ozlem"],[],""); });
  await pg.waitForTimeout(300);
  ok("the note is the newest message and it is a presenceNote", await pg.evaluate(()=>{
      const m=curChat().messages.slice(-1)[0]; return !!(m.presenceNote&&m.sysError); }));
  ok("the chips do not vanish", (await chips()).length===3, JSON.stringify(await chips()));
  await pg.waitForTimeout(3000);
  ok("and a fresh set is fetched for the new moment", await pg.evaluate(()=>window.__sug.length===2), await pg.evaluate(()=>window.__sug.length));
  ok("which knows who just arrived", await pg.evaluate(()=>/Ozlem/.test(window.__sug[1]||"")), await pg.evaluate(()=>(window.__sug[1]||"").slice(-500)));
  ok("and is shown", (await chips())[0]==="Idea 2", JSON.stringify(await chips()));

  console.log("\n[a leaving note]");
  await pg.evaluate(()=>{ const chat=curChat(); chat.presentIds=chat.presentIds.filter(id=>id!=="sn2");
    chat.messages.push({mid:"a3",role:"assistant",speaker:"Ayla",speakerId:"sn1",content:"\"Gitti mi?\"",present:["sn1"]});
    notePresence(chat,[],["Ozlem"],""); });
  await pg.waitForTimeout(3500);
  ok("chips are still there after somebody leaves", (await chips()).length===3, JSON.stringify(await chips()));

  console.log("\n[player-facing notices]");
  const before=await pg.evaluate(()=>window.__sug.length);
  const shown=await chips();
  await pg.evaluate(()=>{ _announceTaskLine(curChat(),"plan","Meet Ayla tomorrow"); _calNotice(curChat(),"A plan note"); });
  await pg.waitForTimeout(3500);
  ok("a plan or calendar notice keeps the same chips", JSON.stringify(await chips())===JSON.stringify(shown), JSON.stringify(await chips()));
  ok("and fetches nothing new", await pg.evaluate(b=>window.__sug.length===b,before));

  console.log("\n[nobody here]");
  await pg.evaluate(()=>{ const chat=curChat(); chat.presentIds=[]; notePresence(chat,[],["Ayla"],""); });
  await pg.waitForTimeout(1500);
  ok("with nobody left in the scene there is nothing to suggest", (await chips()).length===0, JSON.stringify(await chips()));

  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close(); process.exit(fail?1:0);
})();
