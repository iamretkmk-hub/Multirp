/* v37.1 — the phone and the room are two channels, and a line from one is never the line you are
   answering on the other. Reported as: "I was texting Duygu, closed the window, typed to Hakan who
   was sitting next to me — Duygu replied to what I said to Hakan, and Hakan answered the text."
   Also covers the memory fixes: engine records in English, a part-of-day on every memory, and one
   memory per text ARC rather than one every three messages. */
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x||c).slice(0,400));} };
  const ctx=await b.newContext({viewport:{width:412,height:915},hasTouch:true,isMobile:true});
  const pg=await ctx.newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file:///home/user/Multirp/index.html'); await pg.waitForTimeout(2300);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(800);

  // Duygu is elsewhere, on her phone. Hakan is in the room. The player does both.
  await pg.evaluate(()=>{
    const uni=state.universes[0];
    const mk=(id,name)=>{ if(!state.personas.some(p=>p.id===id))
      state.personas.push({id,name,universeId:uni.id,instructions:"x",personality:"x",backstory:"x",style:"x",goals:"x",look:{}}); };
    mk("p_duygu","Duygu"); mk("p_hakan","Hakan");
    state.user="Emre";
    const chat=curChat();
    chat.presentIds=["p_hakan"];           // only Hakan is in the room
    // her thread ends with the PLAYER's text (so she has something to answer), and the newest
    // message overall is the player speaking to Hakan in the room — the exact shape of the report.
    chat.messages=[
      {mid:"t0",role:"assistant",speaker:"Duygu",speakerId:"p_duygu",content:"Iyi geceler.",textMsg:true,textWith:"p_duygu",present:[]},
      {mid:"t1",role:"user",content:"Eve geldim.",textMsg:true,textWith:"p_duygu",textWithName:"Duygu",present:[]},
      {mid:"r1",role:"user",content:"Ee baska ne yaptin kanka?",present:["p_hakan"]}
    ];
    markChatDirty(chat);
  });

  const P=id=>pg.evaluate(i=>(state.personas||[]).find(p=>p.id===i),id);
  const duygu=await P("p_duygu"), hakan=await P("p_hakan");

  console.log("\n[the room line does not reach the phone]");
  ok("texting Duygu, the line she answers is from HER thread", await pg.evaluate(()=>{
      const l=lastDialogueLine(curChat(),(state.personas||[]).find(p=>p.id==="p_duygu"),true);
      return (l&&l.text==="Eve geldim.") ? true : "she was handed: "+JSON.stringify(l); }));
  ok("and never the line said to Hakan in the room", await pg.evaluate(()=>{
      const l=lastDialogueLine(curChat(),(state.personas||[]).find(p=>p.id==="p_duygu"),true);
      return !(l&&/kanka/.test(l.text)) ? true : "leaked: "+l.text; }));
  ok("her text payload highlights the text, not the room", await pg.evaluate(()=>{
      const p=(state.personas||[]).find(x=>x.id==="p_duygu");
      const B=buildTailBlocks({chat:curChat(),selfP:p,selfId:p.id,selfName:p.name,
        targetName:state.user,targetId:"__user__",multi:false,injected:{},textMode:true});
      return /Eve geldim/.test(B.last_line||"") && !/kanka/.test(B.last_line||"")
        ? true : String(B.last_line||"(none)").slice(0,200); }));

  console.log("\n[the phone does not reach the room]");
  ok("Hakan answers the room line, not the text", await pg.evaluate(()=>{
      const l=lastDialogueLine(curChat(),(state.personas||[]).find(p=>p.id==="p_hakan"),false);
      return (l&&/kanka/.test(l.text)) ? true : "he was handed: "+JSON.stringify(l); }));
  ok("a text is invisible to him even when it is the newest message", await pg.evaluate(()=>{
      const chat=curChat();
      chat.messages.push({mid:"t3",role:"user",content:"Ozledim seni.",textMsg:true,textWith:"p_duygu",present:[]});
      const l=lastDialogueLine(chat,(state.personas||[]).find(p=>p.id==="p_hakan"),false);
      chat.messages.pop();
      return !(l&&/Ozledim/.test(l.text)) ? true : "he read the text: "+l.text; }));
  ok("his payload highlights the room line", await pg.evaluate(()=>{
      const p=(state.personas||[]).find(x=>x.id==="p_hakan");
      const B=buildTailBlocks({chat:curChat(),selfP:p,selfId:p.id,selfName:p.name,
        targetName:state.user,targetId:"__user__",multi:false,injected:{}});
      return /kanka/.test(B.last_line||"") && !/Eve geldim/.test(B.last_line||"")
        ? true : String(B.last_line||"(none)").slice(0,200); }));

  console.log("\n[a line you were not present for is not yours to answer]");
  ok("a character who was not in the room does not get the room's line", await pg.evaluate(()=>{
      const l=lastDialogueLine(curChat(),(state.personas||[]).find(p=>p.id==="p_duygu"),false);
      return !(l&&/kanka/.test(l.text)) ? true : "absent character answered: "+l.text; }));
  ok("the player's own line still reaches whoever WAS there", await pg.evaluate(()=>{
      const l=lastDialogueLine(curChat(),(state.personas||[]).find(p=>p.id==="p_hakan"),false);
      return (l&&l.name===state.user) ? true : JSON.stringify(l); }));
  ok("a legacy message with no witness list is still reachable", await pg.evaluate(()=>{
      const chat=curChat();
      chat.messages.push({mid:"old",role:"user",content:"eski mesaj"});
      const l=lastDialogueLine(chat,(state.personas||[]).find(p=>p.id==="p_duygu"),false);
      chat.messages.pop();
      return (l&&l.text==="eski mesaj") ? true : "legacy line dropped: "+JSON.stringify(l); }));

  console.log("\n[continuations respect the channel too]");
  ok("a text she sent last is a continuation on the phone", await pg.evaluate(()=>{
      const chat=curChat();
      chat.messages.push({mid:"t4",role:"assistant",speaker:"Duygu",speakerId:"p_duygu",content:"Uyumadim.",textMsg:true,textWith:"p_duygu",present:[]});
      const c=selfContinueLine(chat,(state.personas||[]).find(p=>p.id==="p_duygu"),true);
      chat.messages.pop();
      return (c&&c.text==="Uyumadim.") ? true : JSON.stringify(c); }));
  ok("but that same text is not a continuation in the room", await pg.evaluate(()=>{
      const chat=curChat();
      chat.messages.push({mid:"t4",role:"assistant",speaker:"Duygu",speakerId:"p_duygu",content:"Uyumadim.",textMsg:true,textWith:"p_duygu",present:[]});
      const c=selfContinueLine(chat,(state.personas||[]).find(p=>p.id==="p_duygu"),false);
      chat.messages.pop();
      return c===null ? true : JSON.stringify(c); }));

  console.log("\n[memories: the engine's record stays in one language]");
  ok("the left-on-read writer records an English mood, not a Turkish one", await pg.evaluate(()=>{
      // matched against the code, not a comment about it: the mood words are string literals
      const src=String(reconcileTextsDay);
      const turkish=/"kırgın|"öfkeli|"tedirgin/.test(src);
      const english=/"hurt but curious"/.test(src)&&/"angry"/.test(src)&&/"uneasy"/.test(src);
      return (!turkish&&english) ? true : "turkish="+turkish+" english="+english; }));
  ok("a proactive text plants an English memory with a period", await pg.evaluate(()=>{
      const before=(state.memory||[]).length;
      const chat=curChat();
      deliverProactiveText(chat,(state.personas||[]).find(p=>p.id==="p_duygu"),"gel","testing");
      const m=(state.memory||[])[state.memory.length-1];
      const added=(state.memory||[]).length>before;
      state.memory.pop(); chat.messages.pop();
      return (added && /I texted/.test(m.content) && !!m.gamePeriod)
        ? true : JSON.stringify(m&&{c:m.content,p:m.gamePeriod}); }));

  console.log("\n[memories: a part of the day, shown as well as stored]");
  ok("the day stamp carries the period", await pg.evaluate(()=>
      _memWhen({gameDay:3,gamePeriod:"Evening"})===" (Day 3, Evening)"));
  ok("a memory with no period still reads sensibly", await pg.evaluate(()=>
      _memWhen({gameDay:3})===" (Day 3)"));
  ok("and one with no day at all says nothing", await pg.evaluate(()=>_memWhen({})===""));

  console.log("\n[text memories are arcs, not a message counter]");
  ok("the old three-message throttle is gone", await pg.evaluate(()=>
      typeof _commitTextArc==="function" && !/(_textMemLen)/.test(String(rememberTextExchange))));
  ok("it keeps one open arc per thread", await pg.evaluate(()=>
      /_textArc/.test(String(rememberTextExchange))));
  ok("it asks the same evaluator the spoken path asks", await pg.evaluate(()=>
      /memEval/.test(String(rememberTextExchange))));
  ok("a short thread writes nothing at all", await pg.evaluate(async()=>{
      const before=(state.memory||[]).length;
      state.mem=true; state.key="x";
      await rememberTextExchange(curChat(),(state.personas||[]).find(p=>p.id==="p_duygu"));
      return (state.memory||[]).length===before ? true : "it wrote a memory from two lines"; }));

  console.log("\n[drives are written about a named person, in the third person]");
  ok("the prompt names its subject before anything else", await pg.evaluate(()=>
      /^# WHO THIS IS ABOUT/.test(DEFAULT_PSYCHE)));
  ok("it uses {{self}} and {{target}}", await pg.evaluate(()=>
      /\{\{self\}\}/.test(DEFAULT_PSYCHE) && /\{\{target\}\}/.test(DEFAULT_PSYCHE)));
  ok("both are offered in the placeholder picker", await pg.evaluate(()=>{
      const t=promptPlaceholders('psychePrompt');
      return (t.indexOf('self')>-1 && t.indexOf('target')>-1) ? true : JSON.stringify(t); }));
  ok("it forbids second person", await pg.evaluate(()=>
      /Never "you"/.test(DEFAULT_PSYCHE)));
  ok("it forbids writing the other person's inner life", await pg.evaluate(()=>
      /wrong subject/.test(DEFAULT_PSYCHE)));
  ok("the payload header says the note is not in the character's voice", await pg.evaluate(()=>
      /not in your voice/.test(BLOCK_TPL_DEFAULTS.drive_header)));

  ok("no page errors", errs.length===0?true:errs.join(" | "));
  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close(); process.exit(fail?1:0);
})();
