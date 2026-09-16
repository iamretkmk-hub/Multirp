/* WHO THE LINE WAS SAID TO.
   The scene this was written from: Emre walks up to a table where Burcu, Özlem and Nil are
   sitting. The turn router reads his "merhaba hanımlar" as addressed to the GROUP and queues two
   responders, Burcu then Özlem. Burcu answers him — "Merhaba Emre. Nil'le mi karşılaştınız?", a
   question put to Emre. Özlem is then built with Burcu's line as "THE LINE YOU ARE RESPONDING TO",
   and answers it: "Yok canım, Nil'le sahilde denk geldik." She has just spoken as the player.

   Two defences, both checked here:
     A. the router pins every responder it queued to the PLAYER's line, so the second one is never
        re-aimed at the first;
     B. every generated line records who it was said to, and a listener who was not the addressee
        is told so in RESPONSE GUIDANCE — last, where the correction can still win.
   Run: node tests/addressee.browser.js   (needs playwright; see tests/README.md) */
const {chromium}=require('playwright');
const BIN=process.env.CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
(async()=>{
  const b=await chromium.launch({executablePath:BIN});
  const pg=await b.newPage({viewport:{width:412,height:915}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file:///home/user/Multirp/index.html'); await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(900);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x||c).slice(0,400));} };

  // The table at the Sahil, rebuilt from the debug export.
  await pg.evaluate(()=>{
    const uni=state.universes[0];
    const mk=(id,name)=>({id,name,universeId:uni.id,instructions:"x",personality:"x",
      backstory:"x",style:"x",goals:"x",look:{}});
    [["p_burcu","Burcu Atan"],["p_ozlem","Özlem Özuçak"],["p_nil","Nil Akbaba"]]
      .forEach(([id,n])=>{ if(!state.personas.some(p=>p.id===id))state.personas.push(mk(id,n)); });
    const chat=curChat();
    chat.presentIds=["p_burcu","p_ozlem","p_nil"]; state.user="Emre"; chat.gameDay=1;
    const HERE=["p_burcu","p_ozlem","p_nil"];
    chat.messages=[
      {mid:"m1",role:"user",present:HERE,
       content:'"Merhaba hanımlar ya, hepiniz mi buradaydınız? Ben de bir çay içmeye gelmiştim."'},
      // Burcu answers the player — and her line records that it was aimed at him.
      {mid:"m2",role:"assistant",speaker:"Burcu Atan",speakerId:"p_burcu",present:HERE,
       toId:"__user__",toName:"Emre",
       content:'"Merhaba Emre. Demek çay içmeye geldin. Nil\'le mi karşılaştınız?"'}
    ];
  });

  const tail=(who,answerTo)=>pg.evaluate(o=>{
    const chat=curChat(); const p=state.personas.find(x=>x.id===o.who);
    const B=buildTailBlocks({chat,selfP:p,selfId:p.id,selfName:p.name,
      targetName:o.answerTo==="__user__"?state.user:"Burcu Atan",
      targetId:o.answerTo==="__user__"?"__user__":"p_burcu",
      multi:true,injected:{recent:[],diary:[],longterm:[]},answerTo:o.answerTo||null});
    return {last:B.last_line||"",guide:B.response_guidance||"",frag:(B._rg||{}).guidance_not_yours||""};
  },{who,answerTo});

  console.log("\n[A — the router's second responder answers the PLAYER, not the first responder]");
  ok("lastPlayerLine reaches past Burcu's reply to Emre's own line", await pg.evaluate(()=>{
      const chat=curChat(); const p=state.personas.find(x=>x.id==="p_ozlem");
      const l=lastPlayerLine(chat,p);
      return l && l.name==="Emre" && l.text.indexOf("hepiniz mi")>-1 ? true : JSON.stringify(l); }));
  {
    const pinned=await tail("p_ozlem","__user__");
    ok("pinned, the quoted line is Emre's", pinned.last.indexOf("hepiniz mi")>-1, pinned.last);
    ok("and NOT Burcu's question to him", pinned.last.indexOf("Nil'le mi")===-1, pinned.last);
    ok("so there is nothing to warn her off", pinned.frag==="", pinned.frag);
  }
  ok("playCharacterTurn takes the pin", await pg.evaluate(()=>
      playCharacterTurn.length===4 ? true : "arity "+playCharacterTurn.length));

  console.log("\n[B — a line put to someone else is heard, not answered]");
  {
    const loose=await tail("p_ozlem",null);
    ok("unpinned, Burcu's line is still what she reacts to", loose.last.indexOf("Nil'le mi")>-1, loose.last);
    ok("but the guidance names the person it was actually put to", /\bEmre\b/.test(loose.frag), loose.frag);
    ok("it names who said it", loose.frag.indexOf("Burcu Atan")>-1, loose.frag);
    ok("and forbids answering in his place", /place/i.test(loose.frag), loose.frag);
    ok("the guard reaches RESPONSE GUIDANCE, not just the map", loose.guide.indexOf(loose.frag)>-1);
    ok("it sits last, after everything telling her to answer",
       loose.guide.trim().endsWith(loose.frag.trim()), loose.guide.slice(-260));
  }
  ok("the addressee rides on the line itself", await pg.evaluate(()=>{
      const chat=curChat(); const p=state.personas.find(x=>x.id==="p_ozlem");
      const l=lastDialogueLine(chat,p);
      return l && l.toId==="__user__" && l.toName==="Emre" ? true : JSON.stringify(l); }));
  ok("the person who WAS asked gets no note", await pg.evaluate(()=>{
      // Burcu asks Özlem directly: Özlem is the addressee, so nothing warns her off answering.
      const chat=curChat(); const m=chat.messages[1];
      const was=[m.toId,m.toName]; m.toId="p_ozlem"; m.toName="Özlem Özuçak";
      const p=state.personas.find(x=>x.id==="p_ozlem");
      const B=buildTailBlocks({chat,selfP:p,selfId:p.id,selfName:p.name,targetName:"Burcu Atan",
        targetId:"p_burcu",multi:true,injected:{recent:[],diary:[],longterm:[]}});
      m.toId=was[0]; m.toName=was[1];
      return ((B._rg||{}).guidance_not_yours||"")==="" ? true : B._rg.guidance_not_yours; }));
  ok("a third listener IS warned off", await pg.evaluate(()=>{
      const chat=curChat(); const p=state.personas.find(x=>x.id==="p_nil");
      const B=buildTailBlocks({chat,selfP:p,selfId:p.id,selfName:p.name,targetName:"Burcu Atan",
        targetId:"p_burcu",multi:true,injected:{recent:[],diary:[],longterm:[]}});
      const f=(B._rg||{}).guidance_not_yours||"";
      return /\bEmre\b/.test(f) ? true : "got: "+f; }));

  console.log("\n[an old chat behaves exactly as it did before]");
  ok("a line with no addressee recorded produces no note", await pg.evaluate(()=>{
      const chat=curChat(); const m=chat.messages[1];
      const was=[m.toId,m.toName]; delete m.toId; delete m.toName;
      const p=state.personas.find(x=>x.id==="p_ozlem");
      const B=buildTailBlocks({chat,selfP:p,selfId:p.id,selfName:p.name,targetName:"Burcu Atan",
        targetId:"p_burcu",multi:true,injected:{recent:[],diary:[],longterm:[]}});
      m.toId=was[0]; m.toName=was[1];
      return ((B._rg||{}).guidance_not_yours||"")==="" ? true : B._rg.guidance_not_yours; }));

  console.log("\n[the note is an ordinary fragment — readable, editable, translatable]");
  ok("it is registered under its own prompt name", await pg.evaluate(()=>
      typeof BLOCK_TPL_DEFAULTS.guidance_not_yours==="string" && !!BLOCK_TPL_DEFAULTS.guidance_not_yours.trim()));
  ok("the response_guidance block lists it", await pg.evaluate(()=>
      (((REPLY_BLOCKS.response_guidance||{}).tpls)||[]).indexOf("guidance_not_yours")>-1));
  ok("the default template calls it", await pg.evaluate(()=>
      String(ptPieceTemplate("response_guidance")||"").indexOf("{{call//guidance_not_yours}}")>-1));
  ok("and editing it changes the payload", await pg.evaluate(()=>{
      state.blockTpls=state.blockTpls||{};
      state.blockTpls.guidance_not_yours="EDITED {{addressee}} / {{speaker}} / {{self}}";
      const chat=curChat(); const p=state.personas.find(x=>x.id==="p_ozlem");
      const B=buildTailBlocks({chat,selfP:p,selfId:p.id,selfName:p.name,targetName:"Burcu Atan",
        targetId:"p_burcu",multi:true,injected:{recent:[],diary:[],longterm:[]}});
      delete state.blockTpls.guidance_not_yours;
      return (B._rg||{}).guidance_not_yours==="EDITED Emre / Burcu Atan / Özlem Özuçak"
        ? true : (B._rg||{}).guidance_not_yours; }));

  console.log("\n[nothing else moved]");
  ok("no page errors", errs.length===0?true:errs.join(" | "));
  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close(); process.exit(fail?1:0);
})();
