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
     - the Video Book: the day's clips with scene cards, speeches from each clip's own lines (a line
       two clips share is spoken once), and narration for an uncovered stretch between two clips,
       written once and cached, with the gap's own narration as the fallback; it plays in order.
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
    const ch=vbookChapters(curChat());
    const d=ch.find(c=>c.day===2);
    return d?d.items.map(x=>x.kind==="clip"?{k:"clip",mid:x.mid,sp:x.speeches.map(s=>s.speaker+": "+s.text+(s.player?" (p)":""))}
      :x.kind==="gap"?{k:"gap",n:x.lines.length,key:x.key}:{k:"scene",w:x.where}):null;
  });
  ok("a day reads: place card, clip, the uncovered stretch, clip, clip, the walk to the next place, its card, clip",
     JSON.stringify(V.map(x=>x.k))==='["scene","clip","gap","clip","clip","gap","scene","clip"]', JSON.stringify(V));
  ok("the travel between two places is an uncovered stretch too", V[5].key==="a5>h1"&&V[5].n===2, JSON.stringify(V[5]));
  ok("each clip's speeches are what was said aloud in its own lines, by who said it",
     JSON.stringify(V[1].sp)==='["Emre: Hi Ayla. (p)","Ayla: Hello, Emre.","Emre: Coffee? (p)","Ayla: Yes please."]', JSON.stringify(V[1]));
  ok("the gap is the lines neither clip covered", V[2].n===2&&V[2].key==="a2>a4", JSON.stringify(V[2]));
  ok("a line two clips share is spoken once — in the first", JSON.stringify(V[4].sp)==='[]'&&JSON.stringify(V[3].sp)==='["Emre: Of course. (p)","Ayla: Then tell me about the letter."]', JSON.stringify([V[3],V[4]]));

  const NR=await pg.evaluate(async()=>{
    const c=curChat(); const gap=vbookChapters(c)[0].items.find(x=>x.kind==="gap");
    const fb=await vbNarration(c,gap);                 // no key: the gap's own narrated passages
    state.key="k"; let calls=0, sent=null;
    const rc=window.chatCompletion;
    window.chatCompletion=async(msgs,model,opts)=>{ if(opts&&opts.dbg==="Video Book narrator"){ calls++; sent=msgs; return '"Emre brings coffee, and Ayla is touched he remembered."'; } return "{}"; };
    const t1=await vbNarration(c,gap), t2=await vbNarration(c,gap);
    window.chatCompletion=rc;
    const usr=sent?sent.filter(m=>m.role==="user").map(m=>m.content).join("\n"):"";
    return {fb,t1,t2,calls,usr,cached:c.vbookNarr&&c.vbookNarr["a2>a4"]&&c.vbookNarr["a2>a4"].text};
  });
  ok("without a key the gap is told from its own narrated passages", /I bring two cups/.test(NR.fb)&&/wraps her hands/.test(NR.fb)&&!/You remembered/.test(NR.fb), NR.fb);
  ok("with a key the narrator writes it once, it is cached, and quotes are taken out",
     NR.t1==="Emre brings coffee, and Ayla is touched he remembered."&&NR.t2===NR.t1&&NR.calls===1&&NR.cached===NR.t1, JSON.stringify(NR));
  ok("the narrator gets the lines between, how the clip before ended and what the next opens on",
     /THE CLIP BEFORE ENDS ON:\nAyla sits\./.test(NR.usr)&&/THE LINES BETWEEN THE TWO CLIPS[^\n]*\nEmre \(the player\): \*I bring two cups/.test(NR.usr)&&/THE NEXT CLIP OPENS ON:\nEmre: "Of course\."/.test(NR.usr), NR.usr);

  const O=await pg.evaluate(()=>{
    closeChatMenu&&closeChatMenu(); _bookDay=null; openVideoBook();
    const w=document.querySelector('#bookModal .bookWrap');
    const hid=id=>getComputedStyle(document.getElementById(id)).display==="none";
    return {open:document.getElementById('bookModal').classList.contains('show'),
      name:document.querySelector('#bookModal .bookName').textContent,vb:w.classList.contains('vbMode'),
      hidden:hid('bookLayBtn')&&hid('bookEdBtn')&&hid('bookVidBtn'),
      clips:document.querySelectorAll('#bookBody .vbClip video').length,
      narr:(document.querySelector('#bookBody .vbNarr')||{}).textContent||"",
      speech:document.querySelectorAll('#bookBody .vbClip[data-mid="a2"] .vbSpeech>div').length,
      opt:(document.getElementById('bookDaySel').options[0]||{}).textContent};
  });
  ok("the menu's Video Book opens the book in video mode", O.open&&O.name==="Video Book"&&O.vb&&O.hidden, JSON.stringify(O));
  ok("with the day's clips, their speeches and the cached narration between them",
     O.clips===4&&O.speech===4&&/touched he remembered/.test(O.narr)&&/4 clips/.test(O.opt), JSON.stringify(O));

  const PL=await pg.evaluate(async()=>{
    _mcScale=0.02; const said=[], shown=[];
    const rs=window._mcSay;
    window._mcSay=async(f32,text,seq,fx)=>{ said.push((fx?"N:":"S:")+text); return rs(f32,text,seq,fx); };
    openBookPlayer();
    const t0=Date.now();
    while(Date.now()-t0<20000){
      const st=document.getElementById('mcStage'); const h=st?st.innerHTML:"";
      const k=/<video/.test(h)?"clip":/vbNarrCard/.test(h)?"narr":/The end of Day/.test(h)?"end":/mcWhere/.test(h)?"scene":"";
      if(k&&shown[shown.length-1]!==k)shown.push(k);
      if(k==="end")break;
      await new Promise(r=>setTimeout(r,30));
    }
    window._mcSay=rs;
    const prog=document.getElementById('mcProg').textContent;
    const r={said,shown,prog,vb:document.getElementById('bookPlayer').classList.contains('vb')};
    closeBookPlayer(); _mcScale=1;
    return r;
  });
  ok("Play runs the day in order: card, clip, narration, clips, narration, card, clip, the end",
     JSON.stringify(PL.shown)==='["scene","clip","narr","clip","narr","scene","clip","end"]', JSON.stringify(PL.shown));
  ok("the speeches are spoken over their clips and the narration between them",
     JSON.stringify(PL.said.slice(0,6))==='["S:Hi Ayla.","S:Hello, Emre.","S:Coffee?","S:Yes please.","N:Emre brings coffee, and Ayla is touched he remembered.","S:Of course."]', JSON.stringify(PL.said));
  ok("the counter counts clips", /^4 \/ 4$/.test(PL.prog)&&PL.vb, PL.prog);

  const SB=await pg.evaluate(()=>{ closeStoryBook(); openStoryBook();
    const r={name:document.querySelector('#bookModal .bookName').textContent,vb:document.querySelector('#bookModal .bookWrap').classList.contains('vbMode')};
    closeStoryBook(); return r; });
  ok("the Story Book still opens as the Story Book", SB.name==="Story Book"&&SB.vb===false, JSON.stringify(SB));
  ok("the narrator is a registry prompt on the Video Book card", await pg.evaluate(()=>
      !!PROMPT_BY_KEY.x_video_book_narrator&&!!K.x_video_book_narrator&&ENGINE_PAYLOAD_DEFS.some(d=>d.key==="video_book"&&(d.blocks||[]).some(x=>x.promptKey==="x_video_book_narrator"))));

  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log(`\n  ${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail?1:0);
})();
