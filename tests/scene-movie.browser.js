/* v145.1 — THE SCENE MOVIE AND THE VIDEO BOOK.
   Asked: scene clips play where the pictures are shown, stay under the latest line as the roleplay
   goes on, and every clip made in the current place plays back to back as one movie until the place
   changes. And a Video Book like the Story Book that plays the clips with the speeches, reading the
   roleplay between two clips that no clip covered as narration.
   Checked with real (tiny, recorded-in-page) clips so playback and `ended` actually happen:
     - portrait: one player, under the latest line, moving down as lines land; the reply the clip
       came from keeps a chip, not a second player; stills older than the last clip are not carried;
     - the clips of this place play in order and loop; a new clip restarts from the first; another
       place starts a new movie;
     - landscape: the same player sits at the top of the rail, above a newer still or alone;
     - the Video Book (v150.0): a novel around the clips — each run of lines is written as the passage that leads
       into its clip, no speeches; it plays each passage read aloud, then its clip.
   Run: node tests/scene-movie.browser.js */
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:process.env.SM_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--autoplay-policy=no-user-gesture-required']});
  const ctx=await b.newContext({viewport:{width:420,height:860}});
  const pg=await ctx.newPage();
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file://'+require('path').resolve(__dirname,'..','index.html'));
  await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(600);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x||c).slice(0,900));} };

  // Three real clips, recorded from a canvas: ~0.6s each, different colours.
  await pg.evaluate(async()=>{
    const rec=async(col)=>{
      const cv=document.createElement('canvas'); cv.width=64; cv.height=36; const g=cv.getContext('2d');
      const st=cv.captureStream(25); const mr=new MediaRecorder(st,{mimeType:"video/webm"}); const parts=[];
      mr.ondataavailable=e=>{ if(e.data&&e.data.size)parts.push(e.data); };
      const t=setInterval(()=>{ g.fillStyle=col; g.fillRect(0,0,64,36); g.fillStyle="#fff"; g.fillRect(Math.random()*60,0,4,36); },40);
      mr.start(); await new Promise(r=>setTimeout(r,600)); mr.stop(); await new Promise(r=>mr.onstop=r); clearInterval(t);
      return URL.createObjectURL(new Blob(parts,{type:"video/webm"}));
    };
    window.__clipA=await rec("#c00"); window.__clipB=await rec("#0c0"); window.__clipC=await rec("#00c");
  });

  const setChat=()=>pg.evaluate(()=>{
    const uni=state.universes[0];
    state.personas=[{id:"p_a",name:"Ayla",universeId:uni.id,look:{},instructions:"x",personality:"x"}];
    state.user="Emre"; state.key=""; state.autoImg=false; state.bookVoice=false; state.imgSticky=true;
    const c=curChat();
    c.presentIds=["p_a"]; c.locationId=null; c.location="Cafe Derya"; c.gameDay=2; c.period="Evening";
    c.vbookNarr={}; c.pinnedMid=null; c.pinnedPlaylist=null; c.clearedBeforeMid=null;
    const st={day:2,period:"Evening",location:"Cafe Derya"};
    const place=_svPlaceKey(c);
    const A=(mid,t,x)=>Object.assign({mid,role:"assistant",speaker:"Ayla",speakerId:"p_a",content:t,present:["p_a"],status:st},x||{});
    const U=(mid,t)=>({mid,role:"user",content:t,present:[],status:st});
    const clip=(src,from,lines,at)=>({src,recId:"",prompt:"P",shot:"pov",lines,fromMid:from,seconds:5,sound:"",endState:"Ayla sits.",place,at});
    c.messages=[
      A("t0","*The cafe is warm.*",{speaker:"Narrator",speakerId:null,narratorEvent:true,travelBeat:true}),
      U("u1",'"Hi Ayla."'),
      A("a1",'*She smiles.* "Hello, Emre."',{img:"data:image/png;base64,iVBORw0KGgo=",imgState:"done"}),
      U("u2",'"Coffee?"'),
      A("a2",'"Yes please." *She sits down.*',{sceneClip:clip(window.__clipA,"u1",4,1)}),
      U("u3",'*I bring two cups.* "Here."'),
      A("a3",'*She wraps her hands around the cup.* "You remembered."'),
      U("u4",'"Of course."'),
      A("a4",'"Then tell me about the letter." *She leans in.*',{sceneClip:clip(window.__clipB,"u4",2,2)}),
      A("a5",'*She laughs.*')
    ];
    markChatDirty(c);
    show('chat'); renderChat();
  });

  console.log("\n[portrait: one player, under the latest line]");
  await setChat();
  await pg.waitForTimeout(400);
  const P=await pg.evaluate(()=>{
    const list=document.getElementById('chatList');
    const mv=document.querySelectorAll('#svMovie');
    const kids=[...list.children]; const at=kids.indexOf(mv[0]);
    const after=kids.slice(at+1).filter(n=>n.dataset&&n.dataset.mid).length;
    const chip=document.querySelector('.bubble[data-mid="a2"] .svChip');
    return {n:mv.length,inList:!!(mv[0]&&mv[0].parentNode===list),after,clips:SvMovie.clips.map(c=>c.mid),
      src:SvMovie.vid&&SvMovie.vid.getAttribute('src'),a:window.__clipA,
      chip:!!chip,chipBtns:chip?chip.querySelectorAll('button').length:0,
      players:document.querySelectorAll('.bubble video').length,
      cnt:document.querySelector('#svMovie .svCnt').textContent};
  });
  ok("there is exactly one player, in the transcript, with nothing said after it", P.n===1&&P.inList&&P.after===0, JSON.stringify(P));
  ok("it holds this place's clips in order and starts on the first", JSON.stringify(P.clips)==='["a2","a4"]'&&P.src===P.a&&P.cnt==="1 / 2", JSON.stringify(P));
  ok("the reply a clip came from keeps a chip (play, prompt, save) and no player of its own", P.chip&&P.chipBtns===3&&P.players===0, JSON.stringify(P));
  ok("a still made before the last clip is not carried under the replies after it", await pg.evaluate(()=>
      _stickyImg(findMsg("a5"))===null && _stickyImg(findMsg("a2"))!==null));

  const M=await pg.evaluate(async()=>{
    const c=curChat();
    c.messages.push({mid:"u5",role:"user",content:'"Later."',present:[],status:c.messages[1].status});
    appendNewBubbles(); await new Promise(r=>setTimeout(r,100));
    const list=document.getElementById('chatList'); const el=document.getElementById('svMovie');
    const last=[...list.children].filter(n=>n.dataset&&n.dataset.mid).pop();
    return {moved:!!(el&&last&&(last.compareDocumentPosition(el)&Node.DOCUMENT_POSITION_FOLLOWING)),lastMid:last&&last.dataset.mid};
  });
  ok("a new line lands above it — the player stays under the latest line", M.moved&&M.lastMid==="u5", JSON.stringify(M));

  console.log("\n[the clips play back to back, as one movie]");
  const Q=await pg.evaluate(async()=>{
    const v=SvMovie.vid, seen=[];
    const wait=ms=>new Promise(r=>setTimeout(r,ms));
    _svLoad(0,true);
    for(let k=0;k<60&&seen.length<3;k++){ const s=v.getAttribute('src'); if(seen[seen.length-1]!==s)seen.push(s); await wait(100); }
    return {seen,A:window.__clipA,B:window.__clipB,playing:!v.paused};
  });
  ok("the first clip ends into the second, and the movie loops back to the first",
     JSON.stringify(Q.seen)===JSON.stringify([Q.A,Q.B,Q.A]), JSON.stringify(Q));

  const N=await pg.evaluate(async()=>{
    const c=curChat();
    _svLoad(1,false);
    const m=findMsg("a5"); m.sceneClip=Object.assign({},findMsg("a4").sceneClip,{src:window.__clipC,fromMid:"a5",lines:1,at:3});
    markChatDirty(c); svRefreshChip("a5"); syncSceneMovie({restart:true});
    return {clips:SvMovie.clips.map(x=>x.mid),idx:SvMovie.idx,src:SvMovie.vid.getAttribute('src'),A:window.__clipA};
  });
  ok("a new clip joins the movie and it starts again from the first clip", JSON.stringify(N.clips)==='["a2","a4","a5"]'&&N.idx===0&&N.src===N.A, JSON.stringify(N));

  const T=await pg.evaluate(async()=>{
    const c=curChat(); const st={day:2,period:"Night",location:"Harbour"};
    c.location="Harbour";
    c.messages.push({mid:"t1",role:"assistant",speaker:"Narrator",narratorEvent:true,travelBeat:true,content:"*They walk to the harbour.*",present:[],status:st});
    const onlyTravel=sceneMovieClips(c).length;
    c.messages.push({mid:"h1",role:"assistant",speaker:"Ayla",speakerId:"p_a",content:"*She points at a boat.*",present:["p_a"],status:st,
      sceneClip:{src:window.__clipC,prompt:"P",shot:"third",lines:1,fromMid:"h1",seconds:5,place:_svPlaceKey(c),at:4}});
    markChatDirty(c); appendNewBubbles(); syncSceneMovie({restart:true});
    return {onlyTravel,clips:SvMovie.clips.map(x=>x.mid),player:!!document.getElementById('svMovie')};
  });
  ok("travel ends the movie; the next place starts its own", T.onlyTravel===0&&JSON.stringify(T.clips)==='["h1"]'&&T.player, JSON.stringify(T));
  ok("with no clip in this place there is no player", await pg.evaluate(()=>{
      const c=curChat(); const was=c.messages.pop(); syncSceneMovie();
      const gone=!document.getElementById('svMovie');
      c.messages.push(was); markChatDirty(c); syncSceneMovie({restart:true});
      return gone&&!!document.getElementById('svMovie'); }));

  console.log("\n[landscape: the movie is where the pictures are — the rail]");
  await pg.setViewportSize({width:1280,height:760});
  await pg.waitForTimeout(500);
  const L=await pg.evaluate(()=>{
    syncSceneMovie();
    const el=document.getElementById('svMovie'), rail=document.getElementById('imageRail');
    return {inRail:!!(el&&el.parentNode&&el.parentNode.id==="svRailHost"),n:document.querySelectorAll('#svMovie').length,
      on:rail.classList.contains('svOn'),only:rail.classList.contains('svOnly')};
  });
  ok("it moves to the top of the rail — still the one player", L.inRail&&L.n===1&&L.on, JSON.stringify(L));
  ok("and fills the rail when there is no newer still", L.only===true, JSON.stringify(L));
  const L2=await pg.evaluate(()=>{
    const c=curChat();
    c.messages.push({mid:"h2",role:"assistant",speaker:"Ayla",speakerId:"p_a",content:"*A gull lands.*",present:["p_a"],status:c.messages[c.messages.length-1].status,img:"data:image/png;base64,iVBORw0KGgo=",imgState:"done"});
    markChatDirty(c); appendNewBubbles(); renderImageRail();
    const rail=document.getElementById('imageRail');
    return {only:rail.classList.contains('svOnly'),on:rail.classList.contains('svOn')};
  });
  ok("a still newer than the last clip shows under it", L2.on&&!L2.only, JSON.stringify(L2));
  await pg.setViewportSize({width:420,height:860});
  await pg.waitForTimeout(400);
  ok("back in portrait it returns under the latest line", await pg.evaluate(()=>{
      syncSceneMovie(); const el=document.getElementById('svMovie');
      return !!(el&&el.parentNode&&el.parentNode.id==="chatList"); }));

  console.log("\n[the Video Book]");
  const V=await pg.evaluate(()=>{
    const p=bookPlan(curChat(),"video"), d=p.chapters.find(c=>c.day===2);
    return d?d.scenes.map(s=>s.location+": "+s.items.map(i=>i.type==="media"?"CLIP:"+i.mid:"R/"+i.end+"["+i.mids.join(",")+"]").join(" ")):null;
  });
  ok("the clips are the book's anchors: each run of lines leads into a clip, a still is not one",
     JSON.stringify(V)==='["Cafe Derya: R/anchor[t0,u1,a1,u2,a2] CLIP:a2 R/anchor[u3,a3,u4,a4] CLIP:a4 R/anchor[a5] CLIP:a5 R/scene[u5]","Harbour: R/anchor[t1,h1] CLIP:h1 R/open[h2]"]', JSON.stringify(V));
  const NR=await pg.evaluate(async()=>{
    const c=curChat(); c.book=null; state.key="k"; state.bookAuto=true; let n=0; const sent=[];
    const rc=window.chatCompletion;
    window.chatCompletion=async(msgs,model,opts)=>{ if(/Video Book writer/.test(opts&&opts.dbg||"")){ n++; sent.push(msgs); return "Passage "+n+": Emre and Ayla, in the warm cafe."; } return "{}"; };
    const w=await bookCatchUp(c,"video",{day:2});
    window.chatCompletion=rc;
    return {w,sys:sent[0]&&sent[0][0].content,u0:sent[0]&&sent[0][1].content,u1:sent[1]&&sent[1][1].content,story:!!(c.book&&c.book.story&&Object.keys(c.book.story.passages).length)};
  });
  ok("opening the day writes its five complete runs, the open tail left for later", NR.w===5, JSON.stringify(NR.w));
  ok("the writer is told the book is shown in video clips", /shows a video clip/.test(NR.sys)&&/ends on a video clip/.test(NR.sys), (NR.sys||"").slice(0,300));
  ok("a run ends on the lines its clip shows in motion", /It ends on its last 4 lines: the video clip that follows shows them in motion, without words\./.test(NR.u0), NR.u0);
  ok("and it is told all of them, said and done", /Emre \(the player\): "Hi Ayla\."\nAyla: \*She smiles\.\* "Hello, Emre\."/.test(NR.u0)&&/It ends on its last 2 lines/.test(NR.u1), NR.u1);
  ok("the Story Book is a book of its own", NR.story===false, JSON.stringify(NR));

  const O=await pg.evaluate(async()=>{
    closeChatMenu&&closeChatMenu(); _bookDay=null; state.key=""; openVideoBook(); await new Promise(r=>setTimeout(r,300));
    const w=document.querySelector('#bookModal .bookWrap');
    const r={open:document.getElementById('bookModal').classList.contains('show'),
      name:document.querySelector('#bookModal .bookName').textContent,vb:w.classList.contains('vbMode'),
      kids:[...document.getElementById('bookBody').children].map(n=>n.className.split(" ")[0]),
      clips:document.querySelectorAll('#bookBody figure.nvFig video').length,
      speech:document.querySelectorAll('#bookBody .vbSpeech,#bookBody .bkBub').length,
      vidBtn:getComputedStyle(document.getElementById('bookVidBtn')).display,
      opt:(document.getElementById('bookDaySel').options[0]||{}).textContent};
    return r;
  });
  /* v150.91 — the Video Book is retired: one book. The menu has no Video Book, and anything that still opens it opens the
     Story Book, where a video scene plays at the point it came on (tests/scene-by-place.browser.js). */
  ok("v150.91: the Video Book is retired — opening it opens the Story Book", O.open&&O.name==="Story Book"&&!O.vb, JSON.stringify(O));
  ok("v150.91: and the menu no longer offers it", await pg.evaluate(()=>![...document.querySelectorAll('#chatMenu button')].some(x=>/Video Book/.test(x.textContent))));
  try{ await pg.evaluate(()=>closeStoryBook()); }catch(_){}

  const SB=await pg.evaluate(()=>{ closeStoryBook(); openStoryBook();
    const r={name:document.querySelector('#bookModal .bookName').textContent,vb:document.querySelector('#bookModal .bookWrap').classList.contains('vbMode')};
    closeStoryBook(); return r; });
  ok("the Story Book still opens as the Story Book", SB.name==="Story Book"&&SB.vb===false, JSON.stringify(SB));
  ok("the writer is a registry prompt on the book's payload card", await pg.evaluate(()=>
      !!PROMPT_BY_KEY.x_book_writer&&!!K.x_book_writer&&ENGINE_PAYLOAD_DEFS.some(d=>d.key==="video_book"&&(d.blocks||[]).some(x=>x.promptKey==="x_book_writer"))));
  ok("v150.91: a finished clip no longer writes a Video Book", await pg.evaluate(()=>/_bkKind\(kind\)==="video"\)return/.test(String(bookOnMedia))));

  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log(`\n  ${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail?1:0);
})();
