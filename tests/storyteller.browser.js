/* v150.0 — THE READER: A STORY BOOK CHAPTER READ ALOUD.
   With Inworld stubbed and the timings shortened (_mcScale):
     - the play list is what the book holds: a card per scene, each paragraph of each passage, the picture it led to —
       a part not written yet is passed over;
     - silent (no relay, or reading off) it plays through to an end card with no voice call; a paragraph is a page of
       prose, never a bubble or caption; a picture's animation plays instead of the still; a picture whose bytes are gone
       is skipped;
     - voiced, every paragraph is read in the narrator voice, through the narrator effect;
     - pause holds, next jumps, close stops everything;
     - Save as video records cards, pages and pictures into a real file.
   Run: node tests/storyteller.browser.js */
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

  await pg.evaluate(async()=>{
    const pic=(col)=>{ const c=document.createElement('canvas'); c.width=64; c.height=48; const x=c.getContext('2d'); x.fillStyle=col; x.fillRect(0,0,64,48); return c.toDataURL('image/png'); };
    window.__n=0;
    window.chatCompletion=async(m,mo,o)=>{ if(o&&/writer/.test(o.dbg||"")){ __n++; return `Passage ${__n} begins.\n\nPassage ${__n} ends.`; } return "{}"; };
    window.__tts=[]; window.__played=[];
    window._inworldFetchPcm=async(text,voice)=>{ __tts.push({text,voice}); return new Float32Array(8); };
    window._playPcmAwait=async(f32,fx)=>{ __played.push(!!fx); await new Promise(r=>setTimeout(r,5)); };
    _mcScale=0.02;
    const uni=state.universes[0];
    state.personas=[{id:"p_a",name:"Ayla",universeId:uni.id,voiceId:"Olivia",look:{}},{id:"p_b",name:"Berk",universeId:uni.id,look:{}}];
    state.user="Emre"; state.key="k"; state.bookAuto=true; state.callVoice="Ashley"; state.narrVoice="Timothy";
    const st=(day,period,location)=>({day,period,location,trackers:[]});
    const M=(o)=>Object.assign({present:[]},o);
    const chat=curChat(); chat.book=null;
    chat.messages=[
      M({mid:"m1",role:"assistant",speaker:"Ayla",speakerId:"p_a",content:'*She sets the glass down.* "They closed the harbour today."',status:st(1,"Evening","Harbour Bar"),img:pic("#a33")}),
      M({mid:"m2",role:"user",content:'*I lean in.* "Who closed it?"',img:pic("#3a3")}),
      M({mid:"m3",role:"assistant",speaker:"Berk",speakerId:"p_b",content:'"The governor did."',status:st(1,"Evening","Harbour Bar"),video:"data:video/mp4;base64,AAAA",hadVideo:true}),
      M({mid:"m4",role:"assistant",speaker:"Berk",speakerId:"p_b",content:'"Gone."',status:st(1,"Evening","Harbour Bar"),imgStored:true}),
      M({mid:"m5",role:"user",content:'"And now?"'})
    ];
    chat.messages[2].img=pic("#33a");
    markChatDirty(chat); show('chat');
    await bookCatchUp(chat,"story",{day:1});
    _bookDay=null; openStoryBook();
  });
  await pg.waitForTimeout(400);

  console.log("\n[what it plays]");
  const L=await pg.evaluate(()=>bookPlayItems(curChat(),1).map(x=>x.kind==="title"?"title:"+x.where:x.kind==="text"?"text:"+x.text:"pic:"+x.mid));
  ok("a card for the scene, then each paragraph and the picture it leads to; the part not yet written is passed over",
     JSON.stringify(L)==='["title:Harbour Bar · Evening","text:Passage 1 begins.","text:Passage 1 ends.","pic:m1","text:Passage 2 begins.","text:Passage 2 ends.","pic:m2","text:Passage 3 begins.","text:Passage 3 ends.","pic:m3","text:Passage 4 begins.","text:Passage 4 ends.","pic:m4"]', JSON.stringify(L));
  ok("Play is in the book's bar and each scene can be played from its heading", await pg.evaluate(()=>
      !!document.querySelector('.bookBar .bookPlay') && !!document.querySelector('#bookBody .nvScene button[onclick^="openBookPlayer"]')));

  const run=async(setup)=>pg.evaluate(async(setup)=>{
    (new Function(setup))();
    __tts=[]; __played=[];
    const seen=[];
    openBookPlayer();
    for(let i=0;i<300;i++){
      await new Promise(r=>setTimeout(r,20));
      const st=document.getElementById('mcStage');
      const tag=st.querySelector('video')?"video":st.querySelector('img')?"img":st.querySelector('.mcPage')?"page":st.querySelector('.mcTitle')?"title":"";
      const k=tag+"|"+((st.querySelector('.mcPage p')||{}).textContent||""); if(seen[seen.length-1]!==k)seen.push(k);
      if(_mc&&_mc.paused&&/The end of Day 1/.test(st.textContent))break;
    }
    const end=/The end of Day 1/.test(document.getElementById('mcStage').textContent);
    return {seen,end,tts:__tts,played:__played,bub:document.querySelectorAll('#mcStage .mcBub,#mcStage .mcCap').length};
  },setup);

  console.log("\n[silent]");
  const S=await run("state.ttsRelay=''; state.bookVoice=true;");
  ok("with no relay it plays through to the end card", S.end===true, JSON.stringify(S.seen));
  ok("without a single voice call", S.tts.length===0 && S.played.length===0, JSON.stringify(S.tts));
  ok("each paragraph on its own page, then its picture — no bubbles", S.seen.indexOf("page|Passage 1 begins.")>=0&&S.seen.indexOf("page|Passage 1 ends.")>S.seen.indexOf("page|Passage 1 begins.")
     &&S.seen.indexOf("img|")>S.seen.indexOf("page|Passage 1 ends.")&&S.bub===0, JSON.stringify(S.seen));
  ok("a picture's animation plays instead of the still", S.seen.indexOf("video|")>S.seen.indexOf("page|Passage 3 ends."), JSON.stringify(S.seen));
  ok("a picture whose bytes are gone is skipped", S.seen.filter(x=>x==="img|"||x==="video|").length===3&&/Passage 4 ends/.test(S.seen.join()), JSON.stringify(S.seen));
  await pg.evaluate(()=>closeBookPlayer());

  console.log("\n[voiced]");
  const V=await run("state.ttsRelay='https://relay.example'; state.bookVoice=true;");
  ok("every paragraph is read, in the narrator voice", V.end===true&&V.tts.length===8&&V.tts.every(x=>x.voice==="Timothy")&&V.tts[0].text==="Passage 1 begins.", JSON.stringify(V.tts));
  ok("through the narrator effect", V.played.length===8&&V.played.every(x=>x===true), JSON.stringify(V.played));
  await pg.evaluate(()=>closeBookPlayer());

  console.log("\n[the shot follows the picture]");
  const F=await pg.evaluate(()=>({sq:mcShotLayout(412,915,1,74),tall:mcShotLayout(412,915,9/16,74),wide:mcShotLayout(412,915,16/9,74)}));
  ok("a 9:16 picture fills a phone screen", F.tall.full===true, JSON.stringify(F.tall));
  ok("a square or landscape one is framed whole", F.sq.full===false&&F.sq.frame.w===412&&F.wide.full===false&&Math.abs(F.wide.frame.w/F.wide.frame.h-16/9)<0.02, JSON.stringify(F));

  console.log("\n[controls]");
  ok("pause holds the story where it is", await pg.evaluate(async()=>{
      state.ttsRelay=''; _mcScale=0.2; openBookPlayer();
      await new Promise(r=>setTimeout(r,150)); bookPlayerToggle(); const i=_mc.i;
      await new Promise(r=>setTimeout(r,900)); const held=_mc.i===i&&_mc.paused;
      const icon=document.querySelector('#mcPause use').getAttribute('href');
      closeBookPlayer(); _mcScale=0.02;
      return (held&&icon==="#i-play") ? true : JSON.stringify({i,now:_mc&&_mc.i,icon}); }));
  ok("next jumps on, back returns, and the counter counts pictures", await pg.evaluate(async()=>{
      _mcScale=5; openBookPlayer(); await new Promise(r=>setTimeout(r,50));
      for(let k=0;k<3;k++){ bookPlayerJump(1); await new Promise(r=>setTimeout(r,60)); }
      const a=_mc.i, prog=document.getElementById('mcProg').textContent;
      bookPlayerJump(-1); await new Promise(r=>setTimeout(r,60)); const c=_mc.i;
      closeBookPlayer(); _mcScale=0.02;
      return (a===3&&c===2&&prog==="1 / 4") ? true : JSON.stringify({a,c,prog}); }));
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
    state.ttsRelay=''; _mcScale=0.08; openStoryBook();
    const r=await bookRecordVideo({day:1});
    return r?{size:r.blob.size,type:r.mime,drawn:r.drawn,voiced:r.voiced}:null;
  });
  ok("it records the chapter into a real video file", !!VR && VR.size>1000 && /^video\/(mp4|webm)$/.test(VR.type), JSON.stringify(VR));
  ok("with the scene card, every page, every picture that can be drawn, and an end card",
     !!VR && VR.drawn.join(",")==="title,text,text,panel,text,text,panel,text,text,panel,text,text,end", JSON.stringify(VR&&VR.drawn));
  ok("silent when there is no relay", !!VR && VR.voiced===0, JSON.stringify(VR));
  const VV=await pg.evaluate(async()=>{
    state.ttsRelay='https://relay.example'; state.bookVoice=true; __tts=[];
    window._inworldFetchPcm=async(text,voice)=>{ __tts.push({text,voice}); return new Float32Array(2400); };
    const r=await bookRecordVideo({day:1}); state.ttsRelay='';
    return r?{voiced:r.voiced,size:r.blob.size,tts:__tts.length}:null;
  });
  ok("voiced, every paragraph is played into the recording", !!VV && VV.voiced===8 && VV.size>1000, JSON.stringify(VV));
  ok("a page draws its prose; a square picture is framed on the 9:16 frame, a 9:16 one fills it", await pg.evaluate(()=>{
      const cv=document.createElement('canvas'); cv.width=MC_VID_W; cv.height=MC_VID_H; const ctx=cv.getContext('2d');
      _mcVidDraw(ctx,{kind:"text",text:"The harbour lay still under a low grey sky.",fade0:-1000},0);
      const d=ctx.getImageData(0,900,MC_VID_W,120).data; let lit=0; for(let i=0;i<d.length;i+=4){ if(d[i]>200&&d[i+1]>200)lit++; }
      const sq=document.createElement('canvas'); sq.width=sq.height=100; sq.getContext('2d').fillStyle="#00ff00"; sq.getContext('2d').fillRect(0,0,100,100);
      _mcVidDraw(ctx,{kind:"panel",im:sq,ar:1,t0:0,dur:1000,kb:0,fade0:-1000},0);
      const top=ctx.getImageData(540,60,1,1).data, mid=ctx.getImageData(540,960,1,1).data;
      const tall=document.createElement('canvas'); tall.width=90; tall.height=160; tall.getContext('2d').fillStyle="#0000ff"; tall.getContext('2d').fillRect(0,0,90,160);
      _mcVidDraw(ctx,{kind:"panel",im:tall,ar:9/16,t0:0,dur:1000,kb:0,fade0:-1000},0);
      const top2=ctx.getImageData(540,60,1,1).data;
      return (lit>50 && top[1]<20 && mid[1]>200 && top2[2]>200) ? true : JSON.stringify({lit,top:[...top],mid:[...mid],top2:[...top2]}); }));
  ok("cancel stops the recording and hands nothing back", await pg.evaluate(async()=>{
      _mcScale=0.5; const p=bookRecordVideo({day:1});
      await new Promise(r=>setTimeout(r,300)); bookCancelVideo();
      const r=await p; _mcScale=0.02;
      return (r===null && _mcRec===null) ? true : "got "+JSON.stringify(r&&r.blob&&r.blob.size); }));
  ok("the player carries Save as video, and the book's options save the whole chapter", await pg.evaluate(async()=>{
      const got=[]; const real=window.bookRecordVideo;
      window.bookRecordVideo=async(o)=>{ got.push(o.fromSid||null); return null; };
      openStoryBook(); await new Promise(r=>setTimeout(r,200));
      const has=!!document.querySelector('#bookPlayer #mcSaveVid'), bar=document.getElementById('bookVidBtn');
      bar.click(); await new Promise(r=>setTimeout(r,50));
      window.bookRecordVideo=real;
      return (has&&got.length===1&&got[0]===null) ? true : JSON.stringify({has,got}); }));

  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log(`\n  ${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail?1:0);
})();
