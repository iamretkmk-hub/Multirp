/* v119.1 — STORY BOOK: THE PICTURES OF A ROLEPLAY, READ BACK AS A COMIC.
   Reported: "I create a lot of images. I see them at the moment, then they are useless." With the
   model stubbed and real pictures drawn in the page:
     - chapters are days and scenes are (day, part of the day, place) runs, carried across unstamped
       player lines; scenes with no picture are left out;
     - out of the box a panel's bubble is the first thing said aloud in its own line and its caption
       that line's narration — never a thought;
     - the editor gets the lines and which picture was drawn where; a bubble it rewords is dropped,
       one it cut with … is kept, a repeated picture is cut, it never cuts them all, and its edit is
       cached so a chapter is edited once;
     - the reader renders panels, skips a picture whose bytes are gone, and a dragged bubble stays;
     - "Save page" draws a real PNG.
   Run: node tests/story-book.browser.js */
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
    window.__calls=[]; window.__edit=null;
    window.chatCompletion=async(messages,model,opts)=>{
      const dbg=(opts&&opts.dbg)||""; __calls.push({dbg,messages});
      if(/^Story Book editor/.test(dbg)) return typeof __edit==="function"?__edit(messages):(__edit||"{}");
      return "{}";
    };
    state.user="Emre"; state.key="k"; state.bookEditor=false;
    const st=(day,period,location)=>({day,period,location,trackers:[]});
    const M=(o)=>Object.assign({mid:newMid(),present:[]},o);
    const chat=curChat();
    chat.bookEdits={}; chat.bookPos={};
    chat.messages=[
      M({role:"assistant",speaker:"Ayla",speakerId:"p_a",content:'*She sets the glass down.* _He looks tired._ "They closed the harbour today. Nobody is saying why."',status:st(1,"Evening","Harbour Bar"),img:pic("#a33")}),
      M({role:"user",content:'*I lean in.* "Who closed it?"'}),
      M({role:"assistant",speaker:"Berk",speakerId:"p_b",content:'"The governor did. I saw his men at the gate."',status:st(1,"Evening","Harbour Bar"),img:pic("#3a3")}),
      M({role:"assistant",speaker:"Berk",speakerId:"p_b",content:'"Same gate, same men."',status:st(1,"Evening","Harbour Bar"),img:pic("#3a4")}),
      M({role:"assistant",speaker:"Ayla",speakerId:"p_a",content:'"No pictures here."',status:st(1,"Night","Home")}),
      M({role:"assistant",speaker:"Narrator",dayMarker:true,content:"— Day 2 —"}),
      M({role:"assistant",speaker:"Narrator",narratorEvent:true,content:"Morning fog rolls over the empty docks.",status:st(2,"Morning","Docks"),img:pic("#33a")}),
      M({role:"assistant",speaker:"Ayla",speakerId:"p_a",content:'"Lost picture."',status:st(2,"Morning","Docks"),imgStored:true})
    ];
    markChatDirty(chat); show('chat');
  });

  console.log("\n[the book is built from the transcript]");
  const S=await pg.evaluate(()=>bookStructure(curChat()).map(c=>({day:c.day,scenes:c.scenes.map(s=>({p:s.period,l:s.location,panels:s.panels.length,lines:s.lines.length}))})));
  ok("chapters are days", JSON.stringify(S.map(c=>c.day))==="[1,2]", JSON.stringify(S));
  ok("scenes are a part of the day at a place, and the player's unstamped line stays in its scene", S[0].scenes.length===1 && S[0].scenes[0].l==="Harbour Bar" && S[0].scenes[0].lines===4 && S[0].scenes[0].panels===3, JSON.stringify(S[0]));
  ok("a scene with no picture is left out", !S[0].scenes.some(s=>s.l==="Home"), JSON.stringify(S[0]));
  const D=await pg.evaluate(()=>{ const c=curChat(), s=bookStructure(c)[0].scenes[0], s2=bookStructure(c)[1].scenes[0];
    return {a:bookPanelView(c,s,s.panels[0]), n:bookPanelView(c,s2,s2.panels[0])}; });
  ok("out of the box the bubble is what was said at that picture", D.a.bubbles.length===1 && D.a.bubbles[0].speaker==="Ayla" && /^They closed the harbour today\./.test(D.a.bubbles[0].text), JSON.stringify(D.a));
  ok("and the caption is that line's narration — never the thought", D.a.caption==="She sets the glass down." && JSON.stringify(D.a).indexOf("tired")<0, JSON.stringify(D.a));
  ok("a narrator beat becomes a caption with no bubble", D.n.caption==="Morning fog rolls over the empty docks." && D.n.bubbles.length===0, JSON.stringify(D.n));

  console.log("\n[the editor]");
  const E=await pg.evaluate(async()=>{
    const c=curChat(), s=bookStructure(c)[0].scenes[0];
    __calls=[];
    __edit=JSON.stringify({title:"The Closed Harbour",recap:"Ayla and Berk tell Emre the governor has shut the harbour.",panels:[
      {panel:"P1",keep:true,caption:"Word travels fast in the harbour bar.",bubbles:[{speaker:"Ayla",text:"They closed the harbour today…"}]},
      {panel:"P2",keep:true,caption:"Berk has seen it himself.",bubbles:[{speaker:"Berk",text:"The governor ordered it personally."},{speaker:"Emre",text:"Who closed it?"}]},
      {panel:"P3",keep:false,caption:"",bubbles:[]}]});
    const rec=await bookEditScene(c,s);
    const call=__calls.find(x=>/^Story Book editor/.test(x.dbg));
    const v=s.panels.map(p=>bookPanelView(c,s,p));
    __calls=[]; await bookEditScene(c,s); const again=__calls.length;
    return {rec,v,user:call?call.messages[1].content:"",sys:call?call.messages[0].content:"",again};
  });
  ok("it is the registry prompt", /You are the editor of a comic book/.test(E.sys), E.sys.slice(0,100));
  ok("it is told the lines and which picture was drawn at which line", /THE LINES:\n[\s\S]*L1 Ayla:/.test(E.user) && /P1 — drawn at L1 \(Ayla's line\)/.test(E.user) && /P3 — drawn at L4/.test(E.user), E.user.slice(0,500));
  ok("its title and recap are kept", E.rec.title==="The Closed Harbour" && /governor/.test(E.rec.recap), JSON.stringify(E.rec));
  ok("a bubble cut with … is kept, because every word was said", E.v[0].bubbles[0].text==="They closed the harbour today…", JSON.stringify(E.v[0]));
  ok("a reworded bubble is dropped, a true one beside it stays", E.v[1].bubbles.length===1 && E.v[1].bubbles[0].speaker==="Emre", JSON.stringify(E.v[1]));
  ok("the editor's caption replaces the code's", E.v[1].caption==="Berk has seen it himself.", JSON.stringify(E.v[1]));
  ok("a repeated picture is cut", E.v[2].keep===false, JSON.stringify(E.v[2]));
  ok("and a scene is edited once", E.again===0, "called "+E.again+" more time(s)");
  ok("it never cuts every picture of a scene", await pg.evaluate(async()=>{
      const c=curChat(), s=bookStructure(c)[1].scenes[0];
      __edit=JSON.stringify({title:"x",recap:"y",panels:s.panels.map((p,k)=>({panel:"P"+(k+1),keep:false,caption:"",bubbles:[]}))});
      await bookEditScene(c,s,true);
      return s.panels.every(p=>bookPanelView(c,s,p).keep) ? true : "all cut"; }));
  ok("a bubble given to someone who never spoke is dropped", await pg.evaluate(()=>{
      const s=bookStructure(curChat())[0].scenes[0];
      return (_bookVerbatim(s,"Berk","They closed the harbour today")===false && _bookVerbatim(s,"Ayla","They closed the harbour today")===true) ? true : "wrong"; }));

  console.log("\n[the reader]");
  const R=await pg.evaluate(async()=>{
    state.bookEditor=false; _bookDay=null; openStoryBook();
    await new Promise(r=>setTimeout(r,400));
    const open=document.getElementById('bookModal').classList.contains('show');
    const days=[...document.querySelectorAll('#bookDaySel option')].map(o=>o.textContent);
    const day2Panels=document.querySelectorAll('#bookBody .bkPanel').length;
    bookSetDay(1); await new Promise(r=>setTimeout(r,400));
    const panels=[...document.querySelectorAll('#bookBody .bkPanel')].map(f=>f.dataset.mid);
    const title=(document.querySelector('#bookBody .bkTitle')||{}).textContent;
    const img=document.querySelector('#bookBody .bkPanel img'); const loaded=!!(img&&img.src.startsWith("data:image/png"));
    return {open,days,day2Panels,panels:panels.length,title,loaded};
  });
  ok("it opens on the latest day with a chapter list", R.open && R.days.length===2 && /^Day 1 · 3 pictures/.test(R.days[0]), JSON.stringify(R));
  ok("a picture whose bytes are gone is skipped", R.day2Panels===1, JSON.stringify(R));
  ok("the edited scene shows its title and drops the cut picture", R.title==="The Closed Harbour" && R.panels===2, JSON.stringify(R));
  ok("the pictures load from the transcript", R.loaded===true, JSON.stringify(R));
  const drag=await pg.$('#bookBody .bkBub');
  const bb=await drag.boundingBox();
  await pg.mouse.move(bb.x+10,bb.y+10); await pg.mouse.down(); await pg.mouse.move(bb.x+60,bb.y-80,{steps:6}); await pg.mouse.up();
  ok("a dragged bubble stays where it was put", await pg.evaluate(async()=>{
      const pos=curChat().bookPos, k=Object.keys(pos||{})[0];
      renderStoryBook(); await new Promise(r=>setTimeout(r,200));
      const el=k&&document.querySelector('#bookBody .bkBub[data-key="'+k+'"]');
      return (k && el && el.style.top===pos[k].y+"%") ? true : JSON.stringify(pos); }));
  ok("the editor switch saves", await pg.evaluate(()=>{
      toggleBookEditor(); const on=state.bookEditor===true && store.get(K.bookEditor,false)===true
        && document.getElementById('bookEdBtn').classList.contains('on');
      toggleBookEditor(); return on ? true : "not saved"; }));
  ok("with the editor on, an unedited scene is edited as it is opened", await pg.evaluate(async()=>{
      const c=curChat(); c.bookEdits={}; __calls=[];
      __edit='{"title":"Auto","recap":"r","panels":[]}';
      state.bookEditor=true; renderStoryBook();
      await _bookQueue; await new Promise(r=>setTimeout(r,100));
      const n=__calls.filter(x=>/^Story Book editor/.test(x.dbg)).length;
      state.bookEditor=false;
      return (n===1 && (document.querySelector('#bookBody .bkTitle')||{}).textContent==="Auto") ? true : "calls "+n; }));

  console.log("\n[a page as a picture]");
  const P=await pg.evaluate(async()=>{
    const c=curChat(), s=bookStructure(c)[0].scenes[0];
    const r=await bookRenderPageCanvas(c,s);
    const url=r.canvas.toDataURL("image/png");
    return {panels:r.panels,w:r.canvas.width,h:r.canvas.height,png:url.startsWith("data:image/png;base64,")&&url.length>2000};
  });
  ok("Save page draws the kept panels onto a PNG", P.panels===3 && P.w===1080 && P.h>600 && P.png, JSON.stringify(P));
  ok("the menu opens it", await pg.evaluate(()=>{
      closeStoryBook();
      const btn=[...document.querySelectorAll('#cmSec-goto button')].find(x=>/Story Book/.test(x.textContent));
      if(!btn) return "no menu entry";
      btn.click(); const on=document.getElementById('bookModal').classList.contains('show'); closeStoryBook();
      return on ? true : "did not open"; }));
  ok("the prompt is a registry prompt on the Story Book card", await pg.evaluate(()=>
      !!PROMPT_BY_KEY.x_book_editor && !!K.x_book_editor && ENGINE_PAYLOAD_DEFS.some(d=>d.key==="story_book"&&(d.blocks||[]).some(x=>x.promptKey==="x_book_editor"))));

  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log(`\n  ${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail?1:0);
})();
