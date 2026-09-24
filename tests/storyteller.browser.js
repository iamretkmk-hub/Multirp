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

  console.log("\n[the shot follows the picture]");
  const F=await pg.evaluate(()=>{
    const sq=mcShotLayout(412,915,1,74), tall=mcShotLayout(412,915,9/16,74), wide=mcShotLayout(412,915,16/9,74), land=mcShotLayout(1280,720,1,74), short=mcShotLayout(900,300,1,74);
    return {sq,tall,wide,land,short};
  });
  ok("a 9:16 picture fills a phone screen", F.tall.full===true, JSON.stringify(F.tall));
  ok("a square one is framed whole, with room above for the caption and below for the bubble", F.sq.full===false && !F.sq.overlay && F.sq.frame.w===412 && F.sq.top.h>=70 && F.sq.bot.h>=70, JSON.stringify(F.sq));
  ok("a landscape one likewise", F.wide.full===false && !F.wide.overlay && Math.abs(F.wide.frame.w/F.wide.frame.h-16/9)<0.02, JSON.stringify(F.wide));
  ok("a landscape screen still frames it whole, keeping room for the text", F.land.full===false && !F.land.overlay && F.land.top.h>=70, JSON.stringify(F.land));
  ok("only with no room around the frame does the text sit over it", F.short.full===false && F.short.overlay===true, JSON.stringify(F.short));
  ok("on screen: a 4:3 picture is framed and its caption sits above the frame", await pg.evaluate(async()=>{
      state.ttsRelay=''; _mcScale=3; openBookPlayer(); bookPlayerJump(1);   // past the title card
      for(let i=0;i<60&&!document.querySelector('#mcStage .mcFrame img');i++) await new Promise(r=>setTimeout(r,50));
      for(let i=0;i<60&&document.querySelector('#mcStage .mcCap[hidden]');i++) await new Promise(r=>setTimeout(r,50));
      const st=document.getElementById('mcStage'), fr=st.querySelector('.mcFrame').getBoundingClientRect(), cap=st.querySelector('.mcCap').getBoundingClientRect();
      const framed=st.classList.contains('mcFramed');
      closeBookPlayer(); _mcScale=0.02;
      return (framed && cap.bottom<=fr.top+1) ? true : JSON.stringify({framed,cls:st.className,cap:cap.bottom,frame:fr.top}); }));

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

  console.log("\n[save as video]");
  const VR=await pg.evaluate(async()=>{
    state.ttsRelay=''; _mcScale=0.15; openStoryBook();
    const r=await bookRecordVideo({day:1});
    return r?{size:r.blob.size,type:r.mime,drawn:r.drawn,voiced:r.voiced}:null;
  });
  ok("it records the chapter into a real video file", !!VR && VR.size>1000 && /^video\/(mp4|webm)$/.test(VR.type), JSON.stringify(VR));
  ok("with the title card, every picture that can be drawn, and an end card", !!VR && VR.drawn.join(",")==="title,panel,panel,panel,end", JSON.stringify(VR&&VR.drawn));
  ok("silent when there is no relay", !!VR && VR.voiced===0, JSON.stringify(VR));
  const VV=await pg.evaluate(async()=>{
    state.ttsRelay='https://relay.example'; state.bookVoice=true; __tts=[];
    window._inworldFetchPcm=async(text,voice)=>{ __tts.push({text,voice}); return new Float32Array(4800); };
    const r=await bookRecordVideo({day:1}); state.ttsRelay='';
    return r?{voiced:r.voiced,size:r.blob.size,tts:__tts.length}:null;
  });
  ok("voiced, every caption and bubble is played into the recording", !!VV && VV.voiced>=5 && VV.size>1000, JSON.stringify(VV));
  ok("a square picture is framed on the 9:16 frame, a 9:16 one fills it", await pg.evaluate(()=>{
      const cv=document.createElement('canvas'); cv.width=MC_VID_W; cv.height=MC_VID_H; const ctx=cv.getContext('2d');
      const sq=document.createElement('canvas'); sq.width=sq.height=100; sq.getContext('2d').fillStyle="#00ff00"; sq.getContext('2d').fillRect(0,0,100,100);
      _mcVidDraw(ctx,{kind:"panel",im:sq,ar:1,t0:0,dur:1000,kb:0,cap:"",bub:null,fade0:-1000},0);
      const top=ctx.getImageData(540,60,1,1).data, mid=ctx.getImageData(540,960,1,1).data;
      const tall=document.createElement('canvas'); tall.width=90; tall.height=160; tall.getContext('2d').fillStyle="#0000ff"; tall.getContext('2d').fillRect(0,0,90,160);
      _mcVidDraw(ctx,{kind:"panel",im:tall,ar:9/16,t0:0,dur:1000,kb:0,cap:"",bub:null,fade0:-1000},0);
      const top2=ctx.getImageData(540,60,1,1).data;
      return (top[1]<20 && mid[1]>200 && top2[2]>200) ? true : JSON.stringify({top:[...top],mid:[...mid],top2:[...top2]}); }));
  ok("cancel stops the recording and hands nothing back", await pg.evaluate(async()=>{
      _mcScale=0.5; const p=bookRecordVideo({day:1});
      await new Promise(r=>setTimeout(r,300)); bookCancelVideo();
      const r=await p; _mcScale=0.02;
      return (r===null && _mcRec===null) ? true : "got "+JSON.stringify(r&&r.blob&&r.blob.size); }));
  ok("the player carries a Save as video button", await pg.evaluate(()=>!!document.querySelector('#bookPlayer #mcSaveVid')));

  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log(`\n  ${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail?1:0);
})();
