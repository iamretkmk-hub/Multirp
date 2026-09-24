/* v120.1 — THE STORYTELLER: A STORY BOOK CHAPTER PLAYED AS A MOTION COMIC.
   With Inworld stubbed and the timings shortened (_mcScale):
     - the play list is a title card per scene, then the book's kept panels — exactly what the book
       shows, editor's cut included;
     - silent (no relay, or voices off) it plays every panel through to an end card with no voice call;
     - voiced, the caption is read by the narrator voice through the narrator effect, each bubble by
       the voice of whoever said it, and the player's own line by the default call voice;
     - a clip plays instead of the still; a picture whose bytes are gone is skipped;
     - pause holds, next jumps, close stops everything.
   Run: node tests/storyteller.browser.js */
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
    const pic=(col)=>{ const c=document.createElement('canvas'); c.width=64; c.height=48; const x=c.getContext('2d'); x.fillStyle=col; x.fillRect(0,0,64,48); return c.toDataURL('image/png'); };
    window.chatCompletion=async()=>"{}";
    window.__tts=[]; window.__played=[];
    window._inworldFetchPcm=async(text,voice)=>{ __tts.push({text,voice}); return new Float32Array(8); };
    window._playPcmAwait=async(f32,fx)=>{ __played.push(!!fx); await new Promise(r=>setTimeout(r,5)); };
    _mcScale=0.02;
    const uni=state.universes[0];
    state.personas=[{id:"p_a",name:"Ayla",universeId:uni.id,voiceId:"Olivia",look:{}},{id:"p_b",name:"Berk",universeId:uni.id,look:{}}];
    state.user="Emre"; state.key="k"; state.bookEditor=false; state.callVoice="Ashley"; state.narrVoice="Timothy";
    const st=(day,period,location)=>({day,period,location,trackers:[]});
    const M=(o)=>Object.assign({mid:newMid(),present:[]},o);
    const chat=curChat(); chat.bookEdits={}; chat.bookPos={};
    chat.messages=[
      M({role:"assistant",speaker:"Ayla",speakerId:"p_a",content:'*She sets the glass down.* "They closed the harbour today."',status:st(1,"Evening","Harbour Bar"),img:pic("#a33")}),
      M({role:"user",content:'*I lean in.* "Who closed it?"',img:pic("#3a3")}),
      M({role:"assistant",speaker:"Berk",speakerId:"p_b",content:'"The governor did."',status:st(1,"Evening","Harbour Bar"),video:"data:video/mp4;base64,AAAA",hadVideo:true}),
      M({role:"assistant",speaker:"Berk",speakerId:"p_b",content:'"Gone."',status:st(1,"Evening","Harbour Bar"),imgStored:true})
    ];
    chat.messages[2].img=pic("#33a");
    markChatDirty(chat); show('chat'); _bookDay=null; openStoryBook();
  });
  await pg.waitForTimeout(400);

  console.log("\n[what it plays]");
  const L=await pg.evaluate(()=>bookPlayItems(curChat(),1).map(x=>x.kind==="title"?"title:"+x.where:"panel:"+x.v.bubbles.map(b=>b.speaker).join(",")));
  ok("a title card for the scene, then its panels", L[0]==="title:Evening · Harbour Bar" && L.filter(x=>x.startsWith("panel")).length===4, JSON.stringify(L));
  ok("the Play button is in the book's bar and each scene has Play from here", await pg.evaluate(()=>
      !!document.querySelector('.bookBar .bookPlay') && !!document.querySelector('#bookBody .bkTools button[onclick^="openBookPlayer"]')));

  const run=async(setup)=>pg.evaluate(async(setup)=>{
    (new Function(setup))();
    __tts=[]; __played=[];
    const seen=[];
    openBookPlayer();
    for(let i=0;i<200;i++){
      await new Promise(r=>setTimeout(r,20));
      const st=document.getElementById('mcStage');
      const tag=st.querySelector('video')?"video":st.querySelector('img')?"img":st.querySelector('.mcTitle')?"title":"";
      const cap=(st.querySelector('.mcCap:not([hidden])')||{}).textContent||"";
      const bub=(st.querySelector('.mcBub:not([hidden])')||{}).textContent||"";
      const k=tag+"|"+cap+"|"+bub; if(seen[seen.length-1]!==k)seen.push(k);
      if(_mc&&_mc.paused&&/The end of Day 1/.test(st.textContent))break;
    }
    const end=/The end of Day 1/.test(document.getElementById('mcStage').textContent);
    return {seen,end,tts:__tts,played:__played};
  },setup);

  console.log("\n[silent]");
  const S=await run("state.ttsRelay=''; state.bookVoice=true;");
  ok("with no relay it plays through to the end card", S.end===true, JSON.stringify(S.seen));
  ok("without a single voice call", S.tts.length===0 && S.played.length===0, JSON.stringify(S.tts));
  ok("showing each caption and bubble in turn", S.seen.some(x=>/^img\|She sets the glass down\.\|AylaThey closed the harbour today\./.test(x)) && S.seen.some(x=>/EmreWho closed it\?/.test(x)), JSON.stringify(S.seen));
  ok("a clip plays instead of the still", S.seen.some(x=>/^video\|.*BerkThe governor did\./.test(x)), JSON.stringify(S.seen));
  ok("a picture whose bytes are gone is skipped", !S.seen.some(x=>/Gone\./.test(x)), JSON.stringify(S.seen));
  await pg.evaluate(()=>closeBookPlayer());

  console.log("\n[voiced]");
  const V=await run("state.ttsRelay='https://relay.example'; state.bookVoice=true;");
  const byText=t=>V.tts.find(x=>x.text.indexOf(t)>-1)||{};
  ok("it plays through with voices", V.end===true && V.played.length>=4, JSON.stringify({end:V.end,n:V.played.length}));
  ok("the caption is read by the narrator voice", byText("She sets the glass down").voice==="Timothy", JSON.stringify(V.tts));
  ok("a bubble by the voice of whoever said it", byText("They closed the harbour today").voice==="Olivia", JSON.stringify(V.tts));
  ok("someone with no voice of their own gets the default", byText("The governor did").voice==="Ashley", JSON.stringify(V.tts));
  ok("and the player's own line the default call voice", byText("Who closed it?").voice==="Ashley", JSON.stringify(V.tts));
  ok("narration goes through the narrator effect, speech does not", V.played.includes(true) && V.played.includes(false), JSON.stringify(V.played));
  await pg.evaluate(()=>closeBookPlayer());

  console.log("\n[controls]");
  ok("pause holds the story where it is", await pg.evaluate(async()=>{
      state.ttsRelay=''; _mcScale=0.2; openBookPlayer();
      await new Promise(r=>setTimeout(r,150)); bookPlayerToggle(); const i=_mc.i;
      await new Promise(r=>setTimeout(r,900)); const held=_mc.i===i&&_mc.paused;
      const icon=document.querySelector('#mcPause use').getAttribute('href');
      closeBookPlayer(); _mcScale=0.02;
      return (held&&icon==="#i-play") ? true : JSON.stringify({i,now:_mc&&_mc.i,icon}); }));
  ok("next jumps to the next panel, back returns", await pg.evaluate(async()=>{
      _mcScale=5; openBookPlayer(); await new Promise(r=>setTimeout(r,50));
      bookPlayerJump(1); await new Promise(r=>setTimeout(r,80)); const a=_mc.i;
      bookPlayerJump(1); await new Promise(r=>setTimeout(r,80)); const b2=_mc.i;
      bookPlayerJump(-1); await new Promise(r=>setTimeout(r,80)); const c=_mc.i;
      const prog=document.getElementById('mcProg').textContent;
      closeBookPlayer(); _mcScale=0.02;
      return (a===1&&b2===2&&c===1&&prog==="1 / 4") ? true : JSON.stringify({a,b2,c,prog}); }));
  ok("close stops everything and clears the stage", await pg.evaluate(async()=>{
      openBookPlayer(); await new Promise(r=>setTimeout(r,40)); closeBookPlayer();
      return (_mc===null && !document.getElementById('bookPlayer').classList.contains('show') && document.getElementById('mcStage').innerHTML==="") ? true : "still playing"; }));
  ok("the voice switch saves", await pg.evaluate(()=>{
      state.bookVoice=true; bookPlayerVoice(); const off=state.bookVoice===false&&store.get(K.bookVoice,true)===false;
      bookPlayerVoice(); return off ? true : "not saved"; }));
  ok("closing the book closes the player too", await pg.evaluate(async()=>{
      openBookPlayer(); await new Promise(r=>setTimeout(r,40)); closeStoryBook();
      return (_mc===null && !document.getElementById('bookModal').classList.contains('show')) ? true : "left running"; }));

  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log(`\n  ${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail?1:0);
})();
