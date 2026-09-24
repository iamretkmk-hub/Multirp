/* v122.1 — THE PLAYER ON THE RIGHT, THE PLAYER'S OWN VOICE, AND THE CHAT AS A COMIC.
   Reported with a screenshot of the Story Book: "Make the player's dialogue always appear on the
   right and character dialogue on the left. Give speech to the player — a voice id, and when replies
   are spoken the player speaks his turn. Can we make this format the roleplay screen format?"
     - the side of a bubble is decided by who speaks, in the book (both layouts), the storyteller and
       the video;
     - the player has a voice id (global, and per universe); with Speak replies on a typed turn is
       voiced in it before the reply, never while the open mic is on, and the storyteller uses it;
     - Comic view: a message's opening narration is captions above its picture, what is said is
       bubbles below it (the player's on the right), thoughts their own line, text left as stored.
   Run: node tests/comic-view.browser.js */
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
    const pic=(col,w,h)=>{ const c=document.createElement('canvas'); c.width=w||64; c.height=h||64; const x=c.getContext('2d'); x.fillStyle=col; x.fillRect(0,0,c.width,c.height); return c.toDataURL('image/png'); };
    window.__pic=pic;
    window.chatCompletion=async()=>"{}";
    const uni=state.universes[0];
    state.personas=[{id:"p_b",name:"Buket",universeId:uni.id,voiceId:"Olivia",look:{}}];
    state.user="Emre"; state.key="k"; state.bookEditor=false; state.callVoice="Ashley";
    const st={day:2,period:"Afternoon",location:"Sahil",trackers:[]};
    const chat=curChat(); chat.presentIds=["p_b"]; chat.bookEdits={}; chat.bookPos={};
    chat.messages=[
      {mid:"u1",role:"user",content:'*Buket\'e gülümser.* "Gel beraber bir şeyler içelim, ne dersin?"',present:["p_b"],img:pic("#383")},
      {mid:"a1",role:"assistant",speaker:"Buket",speakerId:"p_b",content:'*Buket omzunun üzerinden bakar.* _Yine mi o?_ "Başka bir zaman." *Yürümeye devam eder.* "Acelem var."',present:["p_b"],status:st,img:pic("#833"),imgState:"done"}];
    markChatDirty(chat);
  });

  console.log("\n[the player on the right]");
  const SD=await pg.evaluate(async()=>{
    const c=curChat(); c.bookEdits={}; state.bookLayout="webtoon"; _bookDay=null; show('chat'); openStoryBook();
    await new Promise(r=>setTimeout(r,400));
    const wt=[...document.querySelectorAll('#bookBody .bkBub')].map(x=>({n:x.querySelector('b').textContent,alt:x.classList.contains('alt')}));
    toggleBookLayout(); await new Promise(r=>setTimeout(r,300));
    const pgb=[...document.querySelectorAll('#bookBody .bkBub')].map(x=>({n:x.querySelector('b').textContent,alt:x.classList.contains('alt')}));
    toggleBookLayout(); closeStoryBook();
    return {wt,pgb};
  });
  ok("in the webtoon the player's bubble is on the right, the character's on the left",
     SD.wt.find(x=>x.n==="Emre").alt===true && SD.wt.find(x=>x.n==="Buket").alt===false, JSON.stringify(SD.wt));
  ok("and on the comic page too", SD.pgb.find(x=>x.n==="Emre").alt===true && SD.pgb.find(x=>x.n==="Buket").alt===false, JSON.stringify(SD.pgb));
  ok("the saved page and the video put the player's bubble on the right", await pg.evaluate(()=>{
      const cv=document.createElement('canvas'); cv.width=MC_VID_W; cv.height=MC_VID_H; const ctx=cv.getContext('2d');
      const im=document.createElement('canvas'); im.width=im.height=100; im.getContext('2d').fillStyle="#000"; im.getContext('2d').fillRect(0,0,100,100);
      const px=(bub)=>{ ctx.clearRect(0,0,cv.width,cv.height); _mcVidDraw(ctx,{kind:"panel",im,ar:1,t0:0,dur:1,kb:0,cap:"",bub,bubAlt:bookIsPlayer(bub.speaker),fade0:-1000},0);
        const L=mcShotLayout(MC_VID_W,MC_VID_H,1,0), y=L.bot.y+80;
        return {left:ctx.getImageData(120,y,1,1).data[0], right:ctx.getImageData(MC_VID_W-120,y,1,1).data[0]}; };
      const me=px({speaker:"Emre",text:"Hi"}), her=px({speaker:"Buket",text:"Hi"});
      return (me.right>150&&me.left<50&&her.left>150&&her.right<50) ? true : JSON.stringify({me,her}); }));

  console.log("\n[the player's own voice]");
  ok("there is a voice id for the player in Settings, and it saves", await pg.evaluate(()=>{
      show('settings'); syncSettingsUI();
      const e=document.getElementById('setUserVoice'); if(!e) return "no field";
      e.value="Dennis"; saveSettings(false);
      const r={stored:store.raw(K.userVoice,null),state:state.userVoice,id:playerVoiceId()};
      show('chat');
      return (r.stored==="Dennis"&&r.id==="Dennis") ? true : JSON.stringify(r); }));
  ok("a universe can have its own", await pg.evaluate(()=>{
      const u=curUniverseObj(); u.userVoice="Mark"; applyUniverseProfile(u.id);
      const a=playerVoiceId(); u.userVoice=""; applyUniverseProfile(u.id); const b2=playerVoiceId();
      return (a==="Mark"&&b2==="Dennis"&&!!document.getElementById('ueUserVoice')) ? true : JSON.stringify({a,b2}); }));
  const VS=await pg.evaluate(()=>{
    const got=[]; const realQ=window._enqueueDub, realF=window._inworldFetchPcm;
    window._inworldFetchPcm=async(t,v)=>{ got.push({t,v}); return new Float32Array(4); };
    window._enqueueDub=()=>{};
    const m={mid:"x",role:"user",content:'*Gülümser.* "Gel beraber bir şeyler içelim."'};
    const r={};
    state.narrOn=false; state.narrMode=false;
    state.autoSpeak=false; speakPlayerTurn(m); r.off=got.length;
    state.autoSpeak=true; speakPlayerTurn(m); r.on=got.slice();
    got.length=0; state.narrMode=true; speakPlayerTurn(m); r.mic=got.length; state.narrMode=false;
    got.length=0; speakPlayerTurn({mid:"y",role:"user",content:"merhaba nasılsın"}); r.plain=got.slice();
    got.length=0; state.narrOn=true; speakPlayerTurn(m); r.narr=got.slice(); state.narrOn=false;
    state.autoSpeak=false; window._enqueueDub=realQ; window._inworldFetchPcm=realF;
    return r;
  });
  ok("with Speak replies off, the player's turn stays silent", VS.off===0, JSON.stringify(VS));
  ok("with it on, the turn is spoken in the player's voice — the words only", VS.on.length===1 && VS.on[0].v==="Dennis" && /Gel beraber/.test(VS.on[0].t) && !/Gülümser/.test(VS.on[0].t), JSON.stringify(VS.on));
  ok("never while the open mic is on — they just said it", VS.mic===0, JSON.stringify(VS));
  ok("a turn typed without marks is all speech", VS.plain.length===1 && /merhaba/.test(VS.plain[0].t), JSON.stringify(VS.plain));
  ok("with the narrator voice on, the narration goes to the narrator and the words to the player", VS.narr.length===2 && VS.narr.some(x=>/Gülümser/.test(x.t)&&x.v!=="Dennis") && VS.narr.some(x=>/Gel beraber/.test(x.t)&&x.v==="Dennis"), JSON.stringify(VS.narr));
  ok("a sent turn is voiced", await pg.evaluate(async()=>{
      let spoke=null; const real=window.speakPlayerTurn; window.speakPlayerTurn=m=>{ spoke=m.content; };
      const c=curChat(); c.presentIds=[]; state.autoRpOn=false;
      document.getElementById('chatInput').value='"Selam."'; await sendMessage();
      window.speakPlayerTurn=real; c.presentIds=["p_b"];
      return spoke==='"Selam."' ? true : String(spoke); }));
  ok("the storyteller reads the player's lines in the player's voice", await pg.evaluate(()=>{
      state.user="Emre";   // the Settings save above re-read the player name from its own field
      const r={me:_mcVoiceFor("Emre"),her:_mcVoiceFor("Buket"),user:state.user};
      return (r.me==="Dennis"&&r.her==="Olivia") ? true : JSON.stringify(r); }));

  console.log("\n[comic view]");
  const SG=await pg.evaluate(()=>({
    ai:comicSegments('*Bakar.* _Yine mi o?_ "Başka bir zaman." *Yürür.* "Acelem var."',false),
    me:comicSegments('*Gülümser.* "Gel içelim."',true),
    plain:comicSegments("merhaba nasılsın",true),
    snake:comicSegments('*Looks at the snake_case name.* "ok"',false),
    half:comicSegments('*Bakar.* "Başka bir za',false)
  }));
  ok("narration, thought and speech are told apart, in order", JSON.stringify(SG.ai.map(x=>x.k))==='["cap","think","say","cap","say"]', JSON.stringify(SG.ai));
  ok("a player's unmarked turn is speech", SG.plain.length===1 && SG.plain[0].k==="say", JSON.stringify(SG.plain));
  ok("an underscore inside a word is not a thought", SG.snake[0].k==="cap" && /snake_case/.test(SG.snake[0].t), JSON.stringify(SG.snake));
  ok("a half-revealed line still renders", SG.half.length===2 && SG.half[1].k==="say", JSON.stringify(SG.half));
  const CV=await pg.evaluate(async()=>{
    state.chatComic=false; toggleChatComic(); show('chat'); await new Promise(r=>setTimeout(r,500));
    const a=document.querySelector('#chatList .bubble[data-mid="a1"]'), u=document.querySelector('#chatList .bubble[data-mid="u1"]');
    const y=sel=>{ const e=a.querySelector(sel); return e?Math.round(e.getBoundingClientRect().top):null; };
    const r={body:document.body.dataset.chat,saved:store.get(K.chatComic,false),
      capTop:y('.cTop .cCap'), sceneTop:y('.scene'), sayTop:y('.cBot .cSay'), think:!!a.querySelector('.cBot .cThink'),
      herSide:getComputedStyle(a.querySelector('.cSay')).alignSelf, mySide:getComputedStyle(u.querySelector('.cSay')).alignSelf,
      name:(a.querySelector('.cSay b')||{}).textContent, stored:curChat().messages[1].content};
    return r;
  });
  ok("the switch saves and marks the page", CV.body==="comic" && CV.saved===true, JSON.stringify(CV));
  ok("the narration sits above the picture, the speech below it", CV.capTop!==null && CV.sceneTop!==null && CV.sayTop!==null && CV.capTop<CV.sceneTop && CV.sceneTop<CV.sayTop, JSON.stringify(CV));
  ok("the thought has its own line", CV.think===true, JSON.stringify(CV));
  ok("the character speaks on the left and the player on the right", CV.herSide==="flex-start" && CV.mySide==="flex-end", JSON.stringify(CV));
  ok("the bubble carries the speaker's name, and the stored text is untouched", CV.name==="Buket" && /^\*Buket omzunun/.test(CV.stored), JSON.stringify(CV));
  ok("the menu row reflects it, and switching off brings the classic bubble back", await pg.evaluate(async()=>{
      const on=document.querySelector('#cmSec-rp .modeRow[data-mode="comic"]').classList.contains('on');
      toggleMode('comic'); await new Promise(r=>setTimeout(r,300));
      const a=document.querySelector('#chatList .bubble[data-mid="a1"] .body');
      const classic=!a.querySelector('.cCap') && !!a.querySelector('strong');
      return (on&&classic&&document.body.dataset.chat==="") ? true : JSON.stringify({on,classic}); }));

  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log(`\n  ${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail?1:0);
})();
