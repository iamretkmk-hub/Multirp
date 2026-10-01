/* v150.0 — THE BOOK: THE ROLEPLAY RETOLD AS A NOVEL AROUND ITS PICTURES.
   Asked: "like a book written by a third person with pictures … use image generation as a trigger … the LLM should
   receive all the dialogue, narration and thoughts and write the gap between the images like a writer … no dialogue
   bubbles." With the model stubbed and real pictures drawn in the page:
     - the plan: chapters are days, scenes are places (a journey starts one, a line after End Day belongs to the new day);
       a run ends at a picture, at the end of a scene or day, or goes on at the live edge; a picture being drawn holds it;
     - the writer gets everything: thoughts, speech, actions, the app's events, a sheet per person (looks, personality,
       background marked as not for telling, ties, readings, FIRST TIME IN THE BOOK), the player, the book so far, where
       the passage sits and a length — through the registry prompt;
     - the trigger: a finished picture writes the current day's complete runs (not a day nobody illustrates), End Day
       writes its closing passage, and the switch turns it off;
     - the failsafes: a picture taken out of the book or whose bytes are gone leaves the text; a deleted or edited line
       makes its passage a ghost that is written again; a picture added mid-passage re-cuts it; a regenerated picture
       changes nothing; no key shows the lines as played;
     - the page: prose and pictures, no bubbles; Save chapter writes one HTML file.
   Run: node tests/story-book.browser.js */
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
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x||c).slice(0,900));} };

  const setup=()=>pg.evaluate(()=>{
    window.__pic=(col)=>{ const c=document.createElement('canvas'); c.width=64; c.height=48; const x=c.getContext('2d'); x.fillStyle=col; x.fillRect(0,0,64,48); return c.toDataURL('image/png'); };
    window.__calls=[]; window.__n=0;
    window.chatCompletion=async(messages,model,opts)=>{
      const dbg=(opts&&opts.dbg)||""; __calls.push({dbg,messages,opts});
      if(/writer/.test(dbg)){ __n++; return "Passage "+__n+": the harbour lay still.\n\nShe thought of *rain*."; }
      return "{}";
    };
    const uni=state.universes[0];
    state.personas=[
      {id:"p_a",name:"Ayla",universeId:uni.id,personality:"Warm but guarded with {{user}}.",backstory:"Secretly owns the bar.",style:"Short, dry sentences.",look:{hair:"black curls",body:"tall"},relationships:{p_b:{tie:"brother"}}},
      {id:"p_b",name:"Berk",universeId:uni.id,personality:"Loud.",look:{}}];
    state.user="Emre"; state.key="k"; state.bookAuto=true; state.bookLen="medium"; state.bookModel="";
    const st=(day,period,location)=>({day,period,location,trackers:[]});
    const M=(o)=>Object.assign({present:["p_a","p_b"]},o);
    const chat=curChat(); chat.book=null; chat.universeId=uni.id;
    chat.messages=[
      M({mid:"a1",role:"assistant",speaker:"Ayla",speakerId:"p_a",content:'*She sets the glass down.* _He looks tired._ "They closed the harbour today."',status:st(1,"Evening","Harbour Bar")}),
      M({mid:"u1",role:"user",content:'*I lean in.* "Who closed it?"'}),
      M({mid:"b1",role:"assistant",speaker:"Berk",speakerId:"p_b",content:'"The governor did."',status:st(1,"Evening","Harbour Bar"),img:__pic("#a33"),imgState:"done"}),
      M({mid:"n1",role:"assistant",speaker:"Narrator",presenceNote:true,content:"Berk leaves."}),
      M({mid:"u2",role:"user",content:"let us go home"}),
      M({mid:"a2",role:"assistant",speaker:"Ayla",speakerId:"p_a",content:'"Fine." *She grabs her coat.*',status:st(1,"Night","Harbour Bar")}),
      M({mid:"t1",role:"assistant",speaker:"Narrator",narratorEvent:true,travelBeat:true,content:"Emre and Ayla walk home through the rain."}),
      M({mid:"a3",role:"assistant",speaker:"Ayla",speakerId:"p_a",content:'"Home at last."',status:st(1,"Night","Home"),img:__pic("#3a3"),imgState:"done"}),
      M({mid:"u3",role:"user",content:'"Good night."'}),
      M({mid:"d1",role:"assistant",speaker:"Narrator",dayMarker:true,dayFrom:1,dayTo:2,narration:"The night closes over the town.",content:"— Day 2 —"}),
      M({mid:"u4",role:"user",content:"good morning"}),
      M({mid:"a4",role:"assistant",speaker:"Ayla",speakerId:"p_a",content:'"Morning."',status:st(2,"Morning","Home")})
    ];
    markChatDirty(chat); show('chat');
  });
  const shape=()=>pg.evaluate(()=>bookPlan(curChat(),"story").chapters.map(c=>({day:c.day,anchors:c.anchors,written:c.written,
    scenes:c.scenes.map(s=>s.location+": "+s.items.map(i=>i.type==="media"?"PIC":(i.type==="passage"?"P":"R/"+i.end)+"["+i.mids.join(",")+"]").join(" "))})));
  await setup();

  console.log("\n[the plan]");
  const S=await shape();
  ok("chapters are days; a line typed after End Day belongs to the new day", S.length===2&&S[1].day===2&&/\[u4,a4\]/.test(S[1].scenes[0]), JSON.stringify(S));
  ok("a run ends at a picture, the bar's tail closes the scene, the journey opens the next place",
     S[0].scenes[0]==="Harbour Bar: R/anchor[a1,u1,b1] PIC R/scene[n1,u2,a2]"&&/^Home: R\/anchor\[t1,a3\] PIC R\/day\[u3,d1\]$/.test(S[0].scenes[1]), JSON.stringify(S[0]));
  ok("after the day's last picture the story goes on", /R\/open\[u4,a4\]/.test(S[1].scenes[0])&&S[1].anchors===0, JSON.stringify(S[1]));
  ok("a picture still being drawn holds the run there", await pg.evaluate(()=>{
      const c=curChat(), m=c.messages.find(x=>x.mid==="a2"); m.imgState="loading";
      const p=bookPlan(c,"story"), r=p.chapters[0].scenes[0].items[2]; m.imgState=undefined;
      return (r.end==="waiting"&&r.closed===false) ? true : JSON.stringify({end:r.end,closed:r.closed}); }));

  console.log("\n[the writer]");
  const W=await pg.evaluate(async()=>{
    __calls=[]; const n=await bookCatchUp(curChat(),"story",{day:1});
    const c=__calls.filter(x=>/writer/.test(x.dbg));
    return {n,sys:c[0]&&c[0].messages[0].content,u0:c[0]&&c[0].messages[1].content,u1:c[1]&&c[1].messages[1].content,u3:c[3]&&c[3].messages[1].content,
      model:c[0]&&c[0].opts,fg:c[0]&&c[0].opts.foreground};
  });
  ok("opening a chapter writes every run it is missing — four passages, in order", W.n===4, JSON.stringify(W.n));
  ok("it is the registry prompt, third person, written around pictures", /author of a novel/.test(W.sys)&&/third person/.test(W.sys)&&/shows a picture/.test(W.sys)&&W.sys.indexOf("{{")<0, (W.sys||"").slice(0,300));
  ok("it gets the lines with speech, actions AND thoughts, the player marked",
     /THE LINES THIS PASSAGE TELLS[^\n]*\nAyla: \*She sets the glass down\.\* \(unspoken thought: He looks tired\.\) "They closed the harbour today\."\nEmre \(the player\): \*I lean in\.\* "Who closed it\?"\nBerk: "The governor did\."/.test(W.u0), W.u0);
  ok("a sheet per person: looks, personality, how they talk, a background marked not for telling, their ties",
     /## Ayla\nFIRST TIME IN THE BOOK\nLooks: black curls, tall\nPersonality[^\n]*Warm but guarded with Emre\.\nHow they talk: Short, dry sentences\.\nBackground — to understand them, never to reveal[^\n]*Secretly owns the bar\./.test(W.u0)&&/With Berk: Berk is Ayla's brother\./.test(W.u0)&&/## Berk/.test(W.u0), W.u0);
  ok("it knows where the passage sits, and how long to make it", /WHERE THIS PASSAGE SITS:\nIt opens the book\. It ends on the moment of its last line: the picture that follows shows it\./.test(W.u0)&&/LENGTH:\nAbout \d+ words\./.test(W.u0), W.u0);
  ok("the next one reads the book so far, someone already met is no longer new, and the app's events are in brackets",
     /THE BOOK SO FAR \(its last pages\):\nPassage 1: the harbour lay still\./.test(W.u1)&&!/## Ayla\nFIRST TIME/.test(W.u1)&&/\[Berk leaves\.\]/.test(W.u1)&&/\[Time passes — it is now Night\.\]/.test(W.u1)&&/It closes this scene/.test(W.u1), W.u1);
  ok("the day's closing passage carries the night's narration", /\[The day ends\.\] The night closes over the town\./.test(W.u3)&&/It closes the day, and the chapter with it\./.test(W.u3), W.u3);
  ok("an opened chapter writes in the foreground, on the story's model", W.fg===true, JSON.stringify(W.model));
  ok("a thought reaches the writer marked as material, and the prompt forbids putting it on the page",
     /THOUGHTS ARE MATERIAL, NOT TEXT/.test(W.sys)&&/never copied onto the page: not quoted, not in italics/.test(W.sys)&&/\(unspoken thought: He looks tired\.\)/.test(W.u0)&&!/_He looks tired\._/.test(W.u0), (W.u0||"").slice(-700));
  ok("the book so far is whole passages, newest last; only what does not fit is left out", await pg.evaluate(()=>{
      const P=n=>String(n).repeat(2500), old=["o1","o2","o3"].map(x=>x+" "+"x".repeat(995)).join("\n\n");
      const a=_bkSoFar(["first passage.","second passage."]), b=_bkSoFar([old,P(1),P(2)]);
      const c=_bkSoFar(["a".repeat(1500)+"\n\n"+"b".repeat(1500)+"\n\nlast para of the old one.",P(1),P(2)]);
      return (a==="first passage.\n\nsecond passage."&&b==="…\n\n"+P(1)+"\n\n"+P(2)&&/^…\n\nlast para of the old one\.\n\n1/.test(c)) ? true : JSON.stringify({a,b:b.slice(0,40),c:c.slice(0,60)}); }));
  ok("written once: opening again writes nothing", await pg.evaluate(async()=>{ __calls=[]; const n=await bookCatchUp(curChat(),"story",{day:1}); return n===0&&__calls.length===0 ? true : "wrote "+n; }));

  console.log("\n[the page]");
  const R=await pg.evaluate(async()=>{
    _bookDay=1; openStoryBook(); await new Promise(r=>setTimeout(r,500));
    const body=document.getElementById('bookBody');
    return {open:document.getElementById('bookModal').classList.contains('show'),
      kids:[...body.children].map(n=>n.className.split(" ")[0]),
      pics:body.querySelectorAll('figure.nvFig img').length, loaded:[...body.querySelectorAll('figure.nvFig img')].every(i=>/^data:image\/png/.test(i.src)),
      bubbles:body.querySelectorAll('.bkBub,.bkCap,.mcBub,.cSay').length, lead:!!body.querySelector('.nvPass.nvLead'),
      em:(body.querySelector('.nvPass em')||{}).textContent, opts:[...document.querySelectorAll('#bookDaySel option')].map(o=>o.textContent)};
  });
  ok("the chapter reads as prose and pictures: heading, place, passage, picture, passage, place, passage, picture, passage",
     JSON.stringify(R.kids)==='["nvDay","nvScene","nvPass","nvFig","nvPass","nvScene","nvPass","nvFig","nvPass","nvEnd"]', JSON.stringify(R.kids));
  ok("no speech bubbles or caption boxes anywhere", R.bubbles===0&&R.pics===2&&R.loaded, JSON.stringify(R));
  ok("the chapter opens on a drop capital and a thought in italics stays italic", R.lead&&R.em==="rain", JSON.stringify(R));
  ok("the chapter list counts pictures", /^Day 1 · 2 pictures$/.test(R.opts[0])&&/^Day 2 · no pictures$/.test(R.opts[1]), JSON.stringify(R.opts));
  ok("a day with no pictures is left alone, with an offer to write it as text", await pg.evaluate(async()=>{
      bookSetDay(2); await new Promise(r=>setTimeout(r,200));
      const t=document.getElementById('bookBody').textContent; bookSetDay(1); await new Promise(r=>setTimeout(r,200));
      return (/No picture was made on Day 2/.test(t)&&/Write this day as text/.test(t)&&/The story goes on — 2 lines/.test(t)) ? true : t.slice(0,400); }));

  console.log("\n[taking a picture out — the text stays]");
  const H=await pg.evaluate(async()=>{
    const before=document.querySelectorAll('#bookBody .nvPass').length; __calls=[];
    bookHidePic("b1"); await new Promise(r=>setTimeout(r,200));
    const r={before,after:document.querySelectorAll('#bookBody .nvPass').length,pics:document.querySelectorAll('#bookBody .nvFig').length,
      note:/1 picture taken out of this chapter/.test(document.getElementById('bookBody').textContent),inChat:!!curChat().messages.find(x=>x.mid==="b1").img};
    const n=await bookCatchUp(curChat(),"story",{day:1}); r.rewrites=n;
    bookUnhideDay(); await new Promise(r=>setTimeout(r,200)); r.back=document.querySelectorAll('#bookBody .nvFig').length;
    return r;
  });
  ok("the picture leaves the book, the chat keeps it", H.pics===1&&H.inChat&&H.note, JSON.stringify(H));
  ok("every passage stays as written — nothing is rewritten", H.before===4&&H.after===4&&H.rewrites===0, JSON.stringify(H));
  ok("put back, it returns where it was", H.back===2, JSON.stringify(H));
  ok("a picture whose bytes are gone is passed over, its text kept", await pg.evaluate(async()=>{
      const m=curChat().messages.find(x=>x.mid==="a3"); const keep=m.img; m.img=null; m.imgStored=true;
      await new Promise(r=>setTimeout(r,300)); await mediaDB.kvDelete(_bkMediaKey(curChat().universeId,"story","a3"));   // and no kept copy either (see the kept book below)
      document.getElementById('bookBody').innerHTML=""; renderBook(); await new Promise(r=>setTimeout(r,400));   // as after a reload
      const gone=document.querySelector('#bookBody figure.nvFig[data-mid="a3"]'), r=(gone&&gone.classList.contains('gone')&&document.querySelectorAll('#bookBody .nvPass').length===4);
      m.img=keep; delete m.imgStored; document.getElementById('bookBody').innerHTML=""; renderBook();
      return r ? true : "picture shown or text lost"; }));

  console.log("\n[when the story changes]");
  const D=await pg.evaluate(async()=>{
    const c=curChat(); __calls=[];
    c.messages=c.messages.filter(x=>x.mid!=="u2"); markChatDirty(c);      // the player's line deleted
    const p=bookPlan(c,"story"), it=p.chapters[0].scenes[0].items[2];
    renderBook(); await new Promise(r=>setTimeout(r,100));
    const ghost=!!document.querySelector('#bookBody .nvGhost')&&/written again/.test(document.getElementById('bookBody').textContent);
    const n=await bookCatchUp(c,"story",{day:1});
    const u=(__calls.find(x=>/writer/.test(x.dbg))||{messages:[{},{content:""}]}).messages[1].content;
    return {type:it.type,end:it.end,ghostText:/Passage 2/.test(it.ghost),ghost,n,u,passages:Object.keys(c.book.story.passages).length};
  });
  ok("a deleted line unseats the passage that told it; its old text shows faded meanwhile", D.type==="run"&&D.end==="scene"&&D.ghostText&&D.ghost, JSON.stringify(D));
  ok("and it is written again from what is left", D.n===1&&/Ayla: "Fine\."/.test(D.u)&&!/let us go home/.test(D.u)&&D.passages===4, JSON.stringify({n:D.n,p:D.passages,u:D.u.slice(-400)}));
  ok("an edited line does the same", await pg.evaluate(async()=>{
      const c=curChat(); c.messages.find(x=>x.mid==="u3").content='"Sleep well, Ayla."'; __calls=[];
      const n=await bookCatchUp(c,"story",{day:1}); const u=__calls[0]&&__calls[0].messages[1].content;
      return (n===1&&/Sleep well, Ayla/.test(u)) ? true : JSON.stringify({n,u}); }));
  ok("a picture regenerated on the same line changes nothing", await pg.evaluate(async()=>{
      const c=curChat(); c.messages.find(x=>x.mid==="b1").img=__pic("#33f"); c.messages.find(x=>x.mid==="b1").imgPrompt="new";
      __calls=[]; const n=await bookCatchUp(c,"story",{day:1}); return n===0 ? true : "rewrote "+n; }));
  const RC=await pg.evaluate(async()=>{
    const c=curChat(); c.messages.find(x=>x.mid==="u1").img=__pic("#ff0"); c.messages.find(x=>x.mid==="u1").imgState="done";   // Generate image on an old line
    const before=bookPlan(c,"story").chapters[0].scenes[0].items.map(i=>i.type+(i.end?"/"+i.end:""));
    __calls=[]; const n=await bookCatchUp(c,"story",{day:1});
    const after=bookPlan(c,"story").chapters[0].scenes[0].items.map(i=>i.type==="media"?"PIC:"+i.mid:i.type+"["+i.mids.join(",")+"]");
    return {before,n,after};
  });
  ok("a picture added mid-passage re-cuts it into two passages around the picture",
     RC.n===2&&JSON.stringify(RC.after)==='["passage[a1,u1]","PIC:u1","passage[b1]","PIC:b1","passage[n1,a2]"]', JSON.stringify(RC));

  console.log("\n[the trigger]");
  const T=await pg.evaluate(async()=>{
    const c=curChat(); __calls=[];
    // the morning gets its first picture: Day 2 becomes a chapter that is being written
    c.messages.push({mid:"a5",role:"assistant",speaker:"Ayla",speakerId:"p_a",content:'"Coffee?"',present:["p_a"],status:{day:2,period:"Morning",location:"Home",trackers:[]},img:__pic("#0ff"),imgState:"done"});
    bookOnMedia(c,"story",{delay:0}); await new Promise(r=>setTimeout(r,50)); await _bkJob(c,"story").p;
    const live=__calls.filter(x=>/writer/.test(x.dbg)).map(x=>({bg:x.opts.foreground===false,u:x.messages[1].content}));
    const sh=bookPlan(c,"story").chapters[1].scenes[0].items.map(i=>i.type);
    // a further line, then the switch off: nothing is written
    state.bookAuto=false; __calls=[];
    c.messages.push({mid:"u5",role:"user",content:'"Yes."'},{mid:"a6",role:"assistant",speaker:"Ayla",speakerId:"p_a",content:'"Here."',status:{day:2,period:"Morning",location:"Home",trackers:[]},img:__pic("#f0f"),imgState:"done"});
    bookOnMedia(c,"story",{delay:0}); await new Promise(r=>setTimeout(r,50)); await _bkJob(c,"story").p;
    const off=__calls.length; state.bookAuto=true;
    return {live,sh,off};
  });
  ok("a finished picture writes up to it, in the background", T.live.length===1&&T.live[0].bg&&/It opens a new day: Day 2\./.test(T.live[0].u)&&/Emre \(the player\): good morning/.test(T.live[0].u), JSON.stringify(T.live.map(x=>x.u.slice(-300))));
  ok("and the picture follows its passage", JSON.stringify(T.sh)==='["passage","media"]', JSON.stringify(T.sh));
  ok("with Write as you play off, nothing is written", T.off===0, JSON.stringify(T));
  ok("the image writer's completion is the trigger", await pg.evaluate(()=>/bookOnMedia\(chat,"story"\)/.test(String(illustrate))));
  ok("End Day writes what the day it ended still owed, ending on its closing passage", await pg.evaluate(async()=>{
      const c=curChat(); __calls=[];
      c.messages.push({mid:"u6",role:"user",content:'"Bye."'},{mid:"d2",role:"assistant",speaker:"Narrator",dayMarker:true,dayFrom:2,dayTo:3,narration:"Evening falls.",content:"— Day 3 —"});
      bookOnDayEnd(c,2); await new Promise(r=>setTimeout(r,30)); await _bkJob(c,"story").p; await _bkJob(c,"video").p;
      const w=__calls.filter(x=>/writer/.test(x.dbg));
      const last=w[w.length-1];   // the picture made while the writer was off, then the day's close
      return (w.length===2&&w.every(x=>/Story Book · |Story Book writer/.test(x.dbg))&&/\[The day ends\.\] Evening falls\./.test(last.messages[1].content)&&/It closes the day/.test(last.messages[1].content)) ? true : JSON.stringify(w.map(x=>x.dbg)); }));
  ok("a live trigger never writes an older day behind the player's back", await pg.evaluate(async()=>{
      const c=curChat(); delete c.book.story.passages["a1"]; __calls=[];
      c.messages.push({mid:"a7",role:"assistant",speaker:"Ayla",speakerId:"p_a",content:'"Day three."',status:{day:3,period:"Morning",location:"Home",trackers:[]},img:__pic("#999"),imgState:"done"});
      bookOnMedia(c,"story",{delay:0}); await new Promise(r=>setTimeout(r,50)); await _bkJob(c,"story").p;
      const w=__calls.filter(x=>/writer/.test(x.dbg));
      return (w.length===1&&/Day 3/.test(w[0].dbg)) ? true : JSON.stringify(w.map(x=>x.dbg)); }));

  console.log("\n[failures and no key]");
  ok("without a key nothing is called and the lines show as played", await pg.evaluate(async()=>{
      state.key=""; __calls=[]; _bookDay=1; renderBook(); await new Promise(r=>setTimeout(r,200));
      const n=await bookCatchUp(curChat(),"story",{day:1});
      const t=document.getElementById('bookBody').textContent; state.key="k";
      return (n===0&&__calls.length===0&&/Not written yet — as it was played/.test(t)&&/They closed the harbour today/.test(t)) ? true : JSON.stringify({n,t:t.slice(0,300)}); }));
  ok("a failed write leaves the run unwritten and stops", await pg.evaluate(async()=>{
      const real=window.chatCompletion; let k=0; window.chatCompletion=async()=>{ k++; throw new Error("boom"); };
      const n=await bookCatchUp(curChat(),"story",{day:1}); window.chatCompletion=real;
      return (n===0&&k===1) ? true : JSON.stringify({n,k}); }));
  ok("Write it fills a run in by hand", await pg.evaluate(async()=>{
      __calls=[]; const c=curChat(); bookWriteNow("a1"); await new Promise(r=>setTimeout(r,30)); await _bkJob(c,"story").p;
      return (!!c.book.story.passages["a1"]&&__calls.length===1) ? true : "not written"; }));
  ok("Rewrite writes a passage again, its old text faded meanwhile", await pg.evaluate(async()=>{
      __calls=[]; const c=curChat(), old=c.book.story.passages["a1"].text; bookRewrite("a1");
      const ghost=!!document.querySelector('#bookBody .nvGhost');
      await _bkJob(c,"story").p; const now=c.book.story.passages["a1"];
      return (ghost&&__calls.length===1&&now&&!now.stale&&now.text!==old) ? true : JSON.stringify({ghost,n:__calls.length,now}); }));

  console.log("\n[thoughts copied onto the page]");
  const TC=await pg.evaluate(async()=>{
    const c=curChat(); const real=window.chatCompletion; const sent=[];
    c.messages.push({mid:"th1",role:"assistant",speaker:"Ayla",speakerId:"p_a",content:'*She sits.* _I should never have come back to this town._ "Hello."',present:["p_a"],status:{day:4,period:"Morning",location:"Square",trackers:[]},img:__pic("#123"),imgState:"done"});
    window.chatCompletion=async(m,mo,o)=>{ sent.push(m); return sent.length===1?"Ayla sat. I should never have come back to this town, she thought. \"Hello.\""
      :"Ayla sat, and the old town closed around her like a hand she had once escaped. \"Hello.\""; };
    const n=await bookCatchUp(c,"story",{day:4}); window.chatCompletion=real;
    const last=sent[1]?sent[1][sent[1].length-1].content:"";
    return {n,calls:sent.length,last,prevDraft:sent[1]&&sent[1][sent[1].length-2].role,text:c.book.story.passages.th1&&c.book.story.passages.th1.text};
  });
  ok("a draft that copies a thought word for word goes back once, naming it", TC.calls===2&&TC.prevDraft==="assistant"&&/copies these unspoken thoughts onto the page word for word:\n- I should never have come back to this town\./.test(TC.last), JSON.stringify(TC));
  ok("and the second draft is the one kept", TC.n===1&&/closed around her/.test(TC.text||""), JSON.stringify(TC));
  ok("a passage that only echoes a word or two of a thought is not sent back", await pg.evaluate(()=>{
      const lines=[{m:{content:"_I should never have come back to this town._"}}];
      return (_bkCopiedThoughts("She wished she had never come back.",lines).length===0&&_bkCopiedThoughts("never have come back to this town",lines).length===1) ? true : "wrong"; }));

  console.log("\n[settings and saving]");
  ok("the writer's settings save", await pg.evaluate(()=>{
      toggleBookOpts(); const shown=!document.getElementById('bookOpts').hidden;
      setBookAuto(false); setBookLen("long"); setBookModel(" my/model ");
      const r=shown&&store.get(K.bookAuto,true)===false&&store.raw(K.bookLen,"")==="long"&&store.raw(K.bookModel,"")==="my/model"
        &&document.querySelector('#bookOpts [data-len="long"]').classList.contains('on');
      setBookAuto(true); setBookLen("medium"); setBookModel(""); toggleBookOpts();
      return r ? true : "not saved"; }));
  ok("the writer uses its own model when one is set, and a longer length when asked", await pg.evaluate(async()=>{
      state.bookModel="my/model"; state.bookLen="long"; __calls=[]; let model="";
      const real=window.chatCompletion; window.chatCompletion=async(m,mo,o)=>{ model=mo; return real(m,mo,o); };
      bookRewrite("a1"); await _bkJob(curChat(),"story").p; window.chatCompletion=real; state.bookModel=""; state.bookLen="medium";
      const u=__calls[0].messages[1].content; const w=+(/About (\d+) words/.exec(u)||[])[1];
      return (model==="my/model"&&w>=120) ? true : JSON.stringify({model,w}); }));

  console.log("\n[the kept book: one per story, with its own pictures]");
  const KB=await pg.evaluate(async()=>{
    const c=curChat(); await bookKeep(c,"story");
    const kept=await bookKept(c.universeId,"story"), live=Object.keys(c.book.story.passages).length;
    const pic=await mediaDB.kvGet(_bkMediaKey(c.universeId,"story","b1"));
    return {n:kept.sections.length,live,pic:/^data:image\/png/.test(pic||""),chats:[...new Set(kept.sections.map(x=>x.chat))].length,
      first:kept.sections[0]&&{day:kept.sections[0].day,where:kept.sections[0].where,media:kept.sections[0].media}};
  });
  ok("every written passage is bound into the kept book, in order", KB.n===KB.live&&KB.chats===1&&KB.first.day===1&&/Harbour Bar/.test(KB.first.where), JSON.stringify(KB));
  ok("with its own copy of each picture, taken while the chat still has it", KB.pic===true, JSON.stringify(KB));
  ok("a picture the chat has lost still shows in the book and is still in the saved book", await pg.evaluate(async()=>{
      const c=curChat(), m=c.messages.find(x=>x.mid==="b1"), keep=m.img;
      m.img=null; m.imgSrc="https://expired.example/b1.png"; m.imgStored=true; await mediaDB.kvDelete("mimg:b1");
      _bookDay=1; openStoryBook(); document.getElementById('bookBody').innerHTML=""; renderBook(); await new Promise(r=>setTimeout(r,500));
      const img=document.querySelector('#bookBody figure.nvFig[data-mid="b1"] img'), shown=!!(img&&/^data:image\/png/.test(img.src)&&!img.closest('figure').classList.contains('gone'));
      await bookKeep(c,"story"); const h=await bookKeptHTML(c.universeId,"story");
      const kept=await bookKept(c.universeId,"story"), sec=kept.sections.find(x=>x.media==="b1");
      m.img=keep; delete m.imgSrc; delete m.imgStored; closeStoryBook();
      return (shown&&!!sec&&(h.match(/<img src="data:image\/png/g)||[]).length>=3) ? true : JSON.stringify({shown,sec:!!sec,imgs:(h.match(/<img /g)||[]).length}); }));
  const RS=await pg.evaluate(async()=>{
    // the story is reset: a new chat for the same universe, starting again at Day 1
    const old=curChat(); const nc={id:"c_reset",universeId:old.universeId,castIds:[],presentIds:[],memCounts:{},tempChars:[],messages:[],gameDay:1,title:old.title};
    nc.messages=[{mid:"r1",role:"assistant",speaker:"Ayla",speakerId:"p_a",content:'"A new day, a new start."',present:["p_a"],status:{day:1,period:"Morning",location:"Pier",trackers:[]},img:__pic("#0a0"),imgState:"done"}];
    state.chats[nc.id]=nc; state.curChat=nc.id;
    await bookCatchUp(nc,"story",{day:1}); await bookKeep(nc,"story");
    const kept=await bookKept(nc.universeId,"story"), h=await bookKeptHTML(nc.universeId,"story");
    state.curChat=old.id; delete state.chats[nc.id];
    return {chats:kept.sections.map(x=>x.chat).filter((x,i,a)=>a.indexOf(x)===i),last:kept.sections[kept.sections.length-1].chat,
      oldStill:kept.sections.some(x=>x.chat===old.id), days:(h.match(/<h2><small>Chapter<\/small>Day 1<\/h2>/g)||[]).length, orn:/class="orn"/.test(h), title:/<h1>/.test(h)};
  });
  ok("after a reset it is still ONE book: the earlier telling kept, the new one added after it", RS.chats.length===2&&RS.last==="c_reset"&&RS.oldStill&&RS.days===2&&RS.orn&&RS.title, JSON.stringify(RS));
  const FS=await pg.evaluate(async()=>{
    // a browser that can write to a file: the first Save picks it, every later Save — and a new passage — rewrites it
    const writes=[]; let picks=0;
    const handle={name:"Story — Story Book.html",queryPermission:async()=>"granted",requestPermission:async()=>"granted",
      createWritable:async()=>{ let buf=""; return {write:async b=>{ buf=await b.text(); },close:async()=>{ writes.push(buf); }}; }};
    window.showSaveFilePicker=async()=>{ picks++; return handle; };
    const realSet=mediaDB.kvSet.bind(mediaDB), realGet=mediaDB.kvGet.bind(mediaDB); let stored=null;
    mediaDB.kvSet=async(k,v)=>{ if(/^bookfile:/.test(k)){ stored=v; return true; } return realSet(k,v); };
    mediaDB.kvGet=async k=>(/^bookfile:/.test(k)?stored:realGet(k));
    _bookDay=1; openStoryBook(); await new Promise(r=>setTimeout(r,100));
    await bookSaveBook(); await bookSaveBook();
    const before=writes.length;
    // a new section arrives: the file is rewritten on its own
    const c=curChat(); c.messages.push({mid:"z1",role:"assistant",speaker:"Ayla",speakerId:"p_a",content:'"One more thing."',present:["p_a"],status:{day:3,period:"Night",location:"Home",trackers:[]},img:__pic("#abc"),imgState:"done"});
    await bookCatchUp(c,"story",{day:3}); await new Promise(r=>setTimeout(r,1200)); await bookKeep(c,"story"); await new Promise(r=>setTimeout(r,2900));
    const opts=document.getElementById('bookFileTxt').textContent;
    mediaDB.kvSet=realSet; mediaDB.kvGet=realGet; delete window.showSaveFilePicker; closeStoryBook();
    return {picks,before,after:writes.length,whole:/Day 1/.test(writes[0]||"")&&/Day 3/.test(writes[writes.length-1]||"")&&/<img src="data:image/.test(writes[0]||""),opts};
  });
  ok("Save picks the file once and rewrites that one file with the whole book", FS.picks===1&&FS.before===2&&FS.whole, JSON.stringify(FS));
  ok("and a new section is added to it on its own", FS.after===3, JSON.stringify(FS));
  ok("elsewhere Save hands over the whole book as one file", await pg.evaluate(async()=>{
      const got=[]; const realClick=HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click=function(){ got.push(this.download); };
      const realShare=navigator.canShare; try{ navigator.canShare=()=>false; }catch(e){}
      _bookDay=1; openStoryBook(); await bookSaveBook(); HTMLAnchorElement.prototype.click=realClick; try{ navigator.canShare=realShare; }catch(e){} closeStoryBook();
      return (got.length===1&&/Story Book\.html$/.test(got[0])) ? true : JSON.stringify(got); }));
  ok("the Save button is in the book's bar", await pg.evaluate(()=>{ const b=document.querySelector('.bookBar #bookSaveBtn'); return !!(b&&/bookSaveBook/.test(b.getAttribute('onclick'))); }));
  ok("the menu opens it", await pg.evaluate(()=>{ closeStoryBook(); toggleChatMenu&&toggleChatMenu();
      const btn=[...document.querySelectorAll('button')].find(x=>/openStoryBook/.test(x.getAttribute('onclick')||"")); if(btn)btn.click();
      const r=document.getElementById('bookModal').classList.contains('show'); closeStoryBook(); return r ? true : "not opened"; }));
  ok("the writer is a registry prompt on the book card, and the comic editor is gone", await pg.evaluate(()=>
      !!PROMPT_BY_KEY.x_book_writer&&!!PROMPT_BY_KEY.x_book_writer_redo&&!PROMPT_BY_KEY.x_book_editor&&!PROMPT_BY_KEY.x_video_book_narrator&&X_PROMPT_CARDS.some(c=>c.key==="story_book"&&c.keys.includes("x_book_writer"))
      &&typeof bookStructure==="undefined"&&typeof toggleBookLayout==="undefined"));

  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log(`\n  ${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail?1:0);
})();
