/* v38.6 — THE PHONE IS NOT THE ROOM.
   Four defects, all from the same assumption — that a text and a spoken line are the same kind of
   thing and can share a surface:
     1) texts were drawn into the story window, so the scene you were reading was interrupted by a
        conversation happening on a phone — and a reply typed into the main box became a line spoken
        out loud to whoever was standing there;
     2) "— {{user}} is bent over his phone, texting somebody —" was shown to everyone in the room,
        including the person on the other end of that phone, four times over;
     3) the transcript's "(text message)" tag was copied by the model into its own reply, saved into
        the message, and then tagged again next turn;
     4) a loosely-agreed meeting told whoever was reading "you have not committed", on the same line
        as "{{user}} is the one coming; you are expected to be there".
   Run: node tests/text-channel.browser.js */
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
    const uni=state.universes[0];
    const mk=(id,name)=>({id,name,universeId:uni.id,instructions:"x",personality:"x",
      backstory:"x",style:"x",goals:"x",look:{subject:"Man"}});
    if(!state.personas.some(p=>p.id==="t_h")) state.personas.push(mk("t_h","Hakan"));
    if(!state.personas.some(p=>p.id==="t_b")) state.personas.push(mk("t_b","Burak"));
    state.user="Emre";
    const chat=curChat();
    chat.gameDay=1; chat.presentIds=["t_h","t_b"]; chat.location="The block";
    chat.messages=[
      {mid:"r1",role:"user",content:"I sat down.",present:["t_h","t_b"]},
      {mid:"r2",role:"assistant",speaker:"Hakan",speakerId:"t_h",content:"Gel otur.",present:["t_h","t_b"]},
      {mid:"x1",role:"user",content:"Aksam musait misin?",textMsg:true,textWith:"t_h",textWithName:"Hakan",present:[]},
      {mid:"x2",role:"assistant",speaker:"Hakan",speakerId:"t_h",content:"Musait sayilir.",textMsg:true,textWith:"t_h",present:[]}
    ];
    markChatDirty(chat); show('chat'); renderChat();
  });
  await pg.waitForTimeout(400);

  console.log("\n[a text is read in the text window, not in the story]");
  ok("the story window draws only the room lines", await pg.evaluate(()=>{
      const mids=[...document.querySelectorAll('#chatList [data-mid]')].map(n=>n.dataset.mid);
      return (mids.includes("r1")&&mids.includes("r2")&&!mids.includes("x1")&&!mids.includes("x2"))
        ? true : "rendered: "+mids.join(","); }));
  ok("a text arriving later does not appear there either", await pg.evaluate(()=>{
      const chat=curChat();
      chat.messages.push({mid:"x3",role:"assistant",speaker:"Hakan",speakerId:"t_h",
        content:"Bira getir.",textMsg:true,textWith:"t_h",present:[]});
      appendNewBubbles();
      return !document.querySelector('#chatList [data-mid="x3"]') ? true : "it was drawn"; }));
  ok("but a room line still appears immediately", await pg.evaluate(()=>{
      const chat=curChat();
      chat.messages.push({mid:"r3",role:"assistant",speaker:"Burak",speakerId:"t_b",
        content:"Ben de varim.",present:["t_h","t_b"]});
      appendNewBubbles();
      return !!document.querySelector('#chatList [data-mid="r3"]') ? true : "the room line was dropped"; }));
  ok("the text window still has the whole thread", await pg.evaluate(()=>{
      const th=textThreadMsgs(curChat(),"t_h").map(m=>m.mid);
      return (th.join(",")==="x1,x2,x3") ? true : "thread: "+th.join(","); }));
  ok("and the transcript still holds them for the payloads", await pg.evaluate(()=>{
      const h=castHistory(curChat(),(state.personas||[]).find(p=>p.id==="t_h"));
      return h.some(m=>/Musait sayilir/.test(m.content)) ? true : "the text left the payload too"; }));

  console.log("\n[nobody tells you that you are being texted]");
  ok("the person being texted is not in the notice's audience", await pg.evaluate(()=>{
      const chat=curChat(); delete chat._textSeenAt;
      _notePlayerTexting(chat,"t_h");
      const n=chat.messages[chat.messages.length-1];
      if(!n.textNotice) return "no notice was posted";
      return (!n.present.includes("t_h") && n.present.includes("t_b")) ? true : "present: "+n.present.join(","); }));
  ok("and it never reaches them even when an old one named them", await pg.evaluate(()=>{
      const chat=curChat(); const p=(state.personas||[]).find(x=>x.id==="t_h");
      chat.messages.push({mid:"n_old",role:"assistant",speaker:"Narrator",narratorEvent:true,
        textNotice:true,textWith:"t_h",present:["t_h","t_b"],
        content:"— Emre telefonuna eğilmiş, birine mesaj yazıyor —"});
      const mine=castHistory(chat,p).filter(m=>/birine mesaj/.test(m.content)).length;
      const theirs=castHistory(chat,(state.personas||[]).find(x=>x.id==="t_b"))
        .filter(m=>/birine mesaj/.test(m.content)).length;
      return (mine===0&&theirs>0) ? true : "recipient saw "+mine+", bystander saw "+theirs; }));
  ok("with nobody else in the room the notice is not written at all", await pg.evaluate(()=>{
      const chat=curChat(); const was=chat.presentIds.slice();
      chat.presentIds=["t_h"]; delete chat._textSeenAt;
      const before=chat.messages.length;
      _notePlayerTexting(chat,"t_h");
      const grew=chat.messages.length-before;
      chat.presentIds=was;
      return grew===0 ? true : "it posted "+grew; }));

  console.log("\n[the channel label is not part of the message]");
  ok("one label comes off", await pg.evaluate(()=>stripChannelLabel("(text message) Tamam.")==="Tamam."));
  ok("so does a pile of them", await pg.evaluate(()=>
      stripChannelLabel("(text message) (text message) (text message) Tamam.")==="Tamam."));
  ok("and the possessive form", await pg.evaluate(()=>
      stripChannelLabel("(Emre's text message) 👍")==="👍"));
  ok("a label the model wrote never reaches the thread", await pg.evaluate(()=>
      _cleanTextReply("(text message) Aksam gorunuruz.","Hakan")==="Aksam gorunuruz."));
  ok("nor one hiding behind a name prefix", await pg.evaluate(()=>
      _cleanTextReply("Hakan: (text message) Aksam gorunuruz.","Hakan")==="Aksam gorunuruz."));
  ok("a parenthesis that is NOT the label is left alone", await pg.evaluate(()=>
      _cleanTextReply("(guldu) Tamam.","Hakan")==="(guldu) Tamam."));
  ok("the saved transcript is cleaned of labels written before the fix", await pg.evaluate(()=>{
      const chat=curChat();
      chat.messages.push({mid:"x9",role:"assistant",speaker:"Hakan",speakerId:"t_h",
        content:"(text message) (text message) Evdeler.",textMsg:true,textWith:"t_h",present:[]});
      store.setRaw("sm_textlabel_v1","");                 // let the one-off run again
      Object.values(state.chats||{}).forEach(c=>(c&&c.messages||[]).forEach(m=>{
        if(m&&typeof m.content==="string") m.content=stripChannelLabel(m.content); }));
      const m=chat.messages.find(x=>x.mid==="x9");
      return m.content==="Evdeler." ? true : JSON.stringify(m.content); }));

  console.log("\n[whose commitment is in doubt]");
  ok("the host is not told to hedge about their own house", await pg.evaluate(()=>{
      const chat=curChat();
      chat.calendar=[{id:"c1",kind:"meeting",title:"Visit Hakan at his place",who:"Hakan",
        charIds:["t_h"],withUser:true,day:chat.gameDay,period:"Evening",done:false,
        certainty:"likely",probability:80,executor:"user"}];
      const line=calendarContextLine(chat,"Hakan","t_h",{bare:true});
      if(/you have not committed/.test(line)) return "still second person: "+line;
      return /Emre has not committed/.test(line)&&/~80% likely/.test(line)
        ? true : line; }));
  ok("but the one who has to show up still is", await pg.evaluate(()=>{
      const chat=curChat();
      chat.calendar=[{id:"c2",kind:"meeting",title:"Come to Emre's",who:"Hakan",
        charIds:["t_h"],withUser:true,day:chat.gameDay,period:"Evening",done:false,
        certainty:"likely",probability:60,executor:"Hakan",executorId:"t_h"}];
      const line=calendarContextLine(chat,"Hakan","t_h",{bare:true});
      return /you have not committed/.test(line) ? true : line; }));

  console.log("\n[the beat is story text, so it is yours]");
  ok("it comes from an editable prompt, not from the code", await pg.evaluate(()=>{
      if(!PROMPT_BY_KEY.x_text_notice) return "not in the registry";
      const before=up("x_text_notice");
      state.x_text_notice="— {{user}} is on his phone —";
      const chat=curChat(); delete chat._textSeenAt; chat.presentIds=["t_h","t_b"];
      _notePlayerTexting(chat,"t_h");
      const n=chat.messages[chat.messages.length-1];
      state.x_text_notice=before;
      return n.content==="— Emre is on his phone —" ? true : JSON.stringify(n.content); }));

  /* v70.2 — WHAT THE PROACTIVE COMPOSER WAS MISSING. _stampText has always written gday/gperiod
     onto every text message and the thread rendered neither, so three unanswered messages an hour
     apart and three spread over three days read identically — and "how long have I been left on
     read", the thing that most decides whether a person writes again and what they write, was not
     in the payload. Nor was where either of them is standing: without it the composer could not
     tell texting someone across town from texting someone in the same room. */
  console.log("\n[the proactive composer knows when and where]");
  {
    const src=require('fs').readFileSync('/home/user/Multirp/index.html','utf8');
    ok("the thread carries a day/period stamp per line",
       /const when=\(m\.gday!=null\)\?`Day \$\{m\.gday\}/.test(src)
         ? true : "thread lines are still unstamped");
    ok("and is trimmed to the recent few now that each line says when",
       /textThreadMsgs\(chat,p\.id\)\.slice\(-4\)/.test(src)
         ? true : "the thread window did not change");
    ok("a where-line is built and reaches the Now block",
       /const whereLine=/.test(src) && /\$\{whereLine\?"\\n"\+whereLine:""\}/.test(src)
         ? true : "the locations never reach the prompt");
    ok("the same-room case is stated, not left to be inferred",
       /you are in the same room right now/.test(src)
         ? true : "nothing tells the composer they are standing together");
    ok("the stamps it renders are the ones _stampText writes", await pg.evaluate(()=>{
        const chat={gameDay:7,period:"Evening",messages:[]};
        const m=_stampText(chat,{role:"user",content:"hi",textMsg:true});
        return (m.gday===7 && typeof m.gperiod==="string")
          ? true : "stamp shape changed: "+JSON.stringify({gday:m.gday,gperiod:m.gperiod}); }));
  }

  /* v70.2 — {{open_intents}} had nothing behind it, so a prompt naming it shipped the literal
     placeholder. The engine asks whether a NEW motive has formed; it needs to know which ones this
     person already carries, or the same grievance re-forms from the same memories every night. */
  console.log("\n[the intent former knows what this character is already after]");
  ok("an empty record says so plainly", await pg.evaluate(()=>
      /nothing on record/.test(holderIntentRecord({intents:[]},"h1",x=>x,5))));
  ok("a live motive is named with its strength", await pg.evaluate(()=>{
      const t=holderIntentRecord({intents:[{holderId:"h1",targetId:"t1",kind:"grudge",
        aim:"to make him admit it",strength:0.62,status:"brewing",born:3}]},"h1",()=>"Hakan",5);
      return /STILL LIVE/.test(t)&&/Hakan/.test(t)&&/0\.62/.test(t) ? true : t; }));
  ok("a spent one is marked as already acted on", await pg.evaluate(()=>{
      const t=holderIntentRecord({intents:[{holderId:"h1",targetId:"t2",kind:"overture",
        aim:"to be forgiven",status:"spent",born:2}]},"h1",()=>"Burcu",5);
      return /ALREADY ACTED ON/.test(t)&&/an overture/.test(t) ? true : t; }));
  ok("another character's motive never appears in it", await pg.evaluate(()=>{
      const t=holderIntentRecord({intents:[
        {holderId:"OTHER",targetId:"t1",kind:"grudge",aim:"SECRET_MARKER",status:"brewing",born:1}
      ]},"h1",()=>"Hakan",5);
      return !/SECRET_MARKER/.test(t) ? true : "it leaked another holder's intent"; }));
  ok("the call site actually passes it", (()=>{
      const src=require('fs').readFileSync('/home/user/Multirp/index.html','utf8');
      return /open_intents:holderIntentRecord\(chat,holderId,nameById,day\)/.test(src)
        ? true : "intentForm still sends no open_intents"; })());

  /* v76.1 — a phone-thread memory survives the shape its own note asks for.
     The note appended after memBuild is user-editable, and an edit that asked for
     {"memories":[…]} made _commitTextArc read j.content off an object that had none,
     so it returned without writing and no text thread ever remembered anything. */
  console.log("\n[a text memory is read out of whatever sane shape comes back]");
  ok("a wrapped {memories:[…]} answer is still a memory", await pg.evaluate(()=>{
      const j=parseJSON('{"memories":[{"content":"We argued about the money by text.","importance":0.6,"emotion":"tense","people":["Hakan"],"tags":["money"]}]}');
      const l=_memReconcileList(j);
      return (l.length===1 && l[0].content==="We argued about the money by text.") ? true : JSON.stringify(j); }));
  ok("a flat answer is unchanged by the same read", await pg.evaluate(()=>{
      const j=parseJSON('{"content":"He never replied.","importance_score":0.4}');
      const l=_memReconcileList(j);
      return ((l.length?l[0]:j).content==="He never replied.") ? true : JSON.stringify(j); }));
  ok("the text builder reads through that helper, not off the top level", (()=>{
      const src=require('fs').readFileSync('/home/user/Multirp/index.html','utf8');
      const fn=src.slice(src.indexOf("async function _commitTextArc"),src.indexOf("async function _commitTextArc")+2600);
      return /_memReconcileList\(raw\)/.test(fn) && /typeof j\.importance==="number"/.test(fn)
        ? true : "_commitTextArc still reads j.content off the raw answer"; })());

  /* v76.1 — the Gamemaster is allowed to decline, and declining must not be narrated. */
  console.log("\n[a Gamemaster that declines the turn says nothing]");
  ok("a bare refusal never reaches the story", (()=>{
      const src=require('fs').readFileSync('/home/user/Multirp/index.html','utf8');
      const m=src.match(/if\(\/\^\(skip\|none\|nothing\|no\[\\s-\]\?event\|pass\)\[\.!\]\?\$\/i\.test\(clean\)\)\{/);
      return m ? true : "a Gamemaster answering SKIP is still posted as a Narrator line"; })());
  ok("only a bare refusal is swallowed", await pg.evaluate(()=>{
      const re=/^(skip|none|nothing|no[\s-]?event|pass)[.!]?$/i;
      return (re.test("SKIP") && re.test("skip.") && re.test("nothing")
           && !re.test("Skip the rest of the evening; a car door closes in the street below.")
           && !re.test("Nothing in the room moves, but two floors down a key turns.")) ? true : "the guard is too greedy"; }));

  ok("no page errors", errs.length===0?true:errs.join(" | "));
  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close(); process.exit(fail?1:0);
})();
