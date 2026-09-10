const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--autoplay-policy=no-user-gesture-required']});
  const pg=await b.newPage({viewport:{width:412,height:915}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file:///home/user/Multirp/index.html'); await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(900);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x||c).slice(0,400));} };

  // A REAL, seekable clip — recorded in the page from a canvas, so currentTime/duration behave
  // like a genuine video instead of a stub that always reads 0.
  const madeClip = await pg.evaluate(async()=>{
    try{
      const cv=document.createElement('canvas'); cv.width=cv.height=64;
      const cx=cv.getContext('2d');
      const st=cv.captureStream(25);
      const rec=new MediaRecorder(st,{mimeType:'video/webm'});
      const parts=[]; rec.ondataavailable=e=>parts.push(e.data);
      rec.start();
      for(let i=0;i<75;i++){ cx.fillStyle=i%2?"#a00":"#00a"; cx.fillRect(0,0,64,64); await new Promise(r=>setTimeout(r,40)); }
      await new Promise(r=>{ rec.onstop=r; rec.stop(); });
      window.__clip=URL.createObjectURL(new Blob(parts,{type:'video/webm'}));
      return true;
    }catch(e){ return "recorder failed: "+e.message; }
  });
  ok("built a real test clip in the page", madeClip);

  await pg.evaluate(()=>{
    state.videos=[{id:"v1",url:window.__clip,characterName:"Nil",date:Date.now(),
      cues:[{t:1,text:"first mark"},{t:2,text:"second mark"}]}];
    openVidCues("v1");
  });
  // wait for metadata
  await pg.waitForFunction(()=>{const p=document.getElementById('vidCuePlayer');return p&&p.readyState>=1;},{timeout:8000}).catch(()=>{});
  await pg.waitForTimeout(400);

  console.log("\n[the clip is on screen in the editor]");
  ok("a player exists in the cue sheet", await pg.evaluate(()=>{
      const p=document.getElementById('vidCuePlayer');
      return !!p && p.getBoundingClientRect().height>50; }));
  ok("it has native controls (scrub, play, seek)", await pg.evaluate(()=>
      document.getElementById('vidCuePlayer').hasAttribute('controls')));
  ok("the duration is read and shown", await pg.evaluate(()=>{
      const t=document.getElementById('vidCueLen').textContent;
      return /^\d+(\.\d)?s$/.test(t) && parseFloat(t)>0 ? true : "shows "+t; }));

  console.log("\n[the playhead is visible and movable]");
  ok("seeking updates the readout", await pg.evaluate(async()=>{
      vidCueSeek(2);
      await new Promise(r=>setTimeout(r,300));
      const t=document.getElementById('vidCueNow').textContent;
      return parseFloat(t)>=1.5 ? true : "readout shows "+t; }));
  ok("−1s / +1s nudge the clip", await pg.evaluate(async()=>{
      vidCueSeek(2); await new Promise(r=>setTimeout(r,200));
      vidCueNudge(-1); await new Promise(r=>setTimeout(r,250));
      const a=vidCueTime();
      vidCueNudge(1); await new Promise(r=>setTimeout(r,250));
      const c=vidCueTime();
      return (a===1 && c===2) ? true : "after -1s: "+a+", after +1s: "+c; }));
  ok("it will not seek before zero", await pg.evaluate(async()=>{
      vidCueSeek(0); await new Promise(r=>setTimeout(r,150));
      vidCueNudge(-5); await new Promise(r=>setTimeout(r,250));
      return vidCueTime()===0; }));

  console.log("\n[stamping a mark from the playhead]");
  ok("every row has set and go", await pg.evaluate(()=>{
      const r=document.querySelector('#vidCueRows .vcRow');
      const b=[...r.querySelectorAll('button')].map(x=>x.textContent);
      return b.indexOf("set")>-1 && b.indexOf("go")>-1 ? true : b.join(","); }));
  ok("'set' writes the playhead into that row", await pg.evaluate(async()=>{
      vidCueSeek(2); await new Promise(r=>setTimeout(r,300));
      const row=document.querySelector('#vidCueRows .vcRow');
      [...row.querySelectorAll('button')].find(x=>x.textContent==="set").click();
      return row.querySelector('.vcT').value==="2"
        ? true : "field reads "+row.querySelector('.vcT').value; }));
  ok("'go' jumps the clip to that row", await pg.evaluate(async()=>{
      const row=document.querySelectorAll('#vidCueRows .vcRow')[1];
      row.querySelector('.vcT').value="1";
      [...row.querySelectorAll('button')].find(x=>x.textContent==="go").click();
      await new Promise(r=>setTimeout(r,300));
      return vidCueTime()===1 ? true : "playhead at "+vidCueTime(); }));
  ok("'+ Mark here' adds a row already stamped", await pg.evaluate(async()=>{
      vidCueSeek(2); await new Promise(r=>setTimeout(r,300));
      const before=document.querySelectorAll('#vidCueRows .vcRow').length;
      addVidCueRow(vidCueTime(),'');
      const rows=document.querySelectorAll('#vidCueRows .vcRow');
      return rows.length===before+1 && rows[rows.length-1].querySelector('.vcT').value==="2"; }));

  console.log("\n[saving still works]");
  ok("marks round-trip through save", await pg.evaluate(()=>{
      const rows=document.querySelectorAll('#vidCueRows .vcRow');
      rows[0].querySelector('.vcT').value="4";
      rows[0].querySelector('textarea').value="edited mark";
      saveVidCues();
      const v=state.videos.find(x=>x.id==="v1");
      return vidCues(v).some(c=>c.t===4 && c.text==="edited mark"); }));
  ok("closing stops the clip so it does not play on behind the gallery", await pg.evaluate(()=>{
      const p=document.getElementById('vidCuePlayer');
      return p.paused && !p.getAttribute('src'); }));

  console.log("\n[nothing else got a scrub bar]");
  ok("the scene-dock player still has no native controls", await pg.evaluate(()=>{
      const host=document.createElement('div'); document.body.appendChild(host);
      smCreatePlayer(host,["https://example.com/a.mp4"],{title:"t"});
      const bad=[...host.querySelectorAll('video')].filter(v=>v.hasAttribute('controls')).length;
      host.remove();
      return bad===0 ? true : bad+" dock videos gained controls"; }));
  ok("the in-chat clip is untouched", await pg.evaluate(()=>{
      const html=sceneHTML({mid:"x",video:"https://example.com/a.mp4",vidState:"done"});
      // it always had its own controls; what matters is that no cue UI leaked into it
      return html.indexOf("vidCuePlayer")===-1 && html.indexOf("vcClock")===-1
          && html.indexOf(">set<")===-1; }));

  ok("no page errors", errs.length===0?true:errs.join(" | "));
  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close(); process.exit(fail?1:0);
})();
