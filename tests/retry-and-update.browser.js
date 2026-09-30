/* v36.9 — two things that were quietly costing the player.
   1. Every roleplay reply was generated twice, because a hardcoded narration checker enforced a
      rule that lives in an editable prompt. Rewriting that prompt made the checker fire on nearly
      every turn.
   2. The update check read the first 64KB of index.html looking for a build stamp that sits at
      byte ~230,000, so it always reported the server unreachable. */
const {chromium}=require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
(async()=>{
  /* Served over HTTP, not file:// — the update check fetches index.html back, and a file://
     page cannot fetch its own directory. This is also the only way to prove the streaming read
     works against a real response body. */
  const ROOT=require('path').resolve(__dirname,'..');
  const srv=http.createServer((rq,rs)=>{
    const f=path.join(ROOT,decodeURIComponent(rq.url.split('?')[0]).replace(/^\/+/,'')||'index.html');
    fs.readFile(f,(e,d)=>{ if(e){rs.statusCode=404;rs.end('no');return;}
      rs.setHeader('Content-Type',/\.js$/.test(f)?'text/javascript':'text/html'); rs.end(d); });
  });
  await new Promise(r=>srv.listen(0,'127.0.0.1',r));
  const BASE='http://127.0.0.1:'+srv.address().port+'/';
  const b=await chromium.launch({executablePath:process.env.SM_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x||c).slice(0,400));} };
  const ctx=await b.newContext({viewport:{width:412,height:915},hasTouch:true,isMobile:true});
  const pg=await ctx.newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto(BASE+'index.html'); await pg.waitForTimeout(2300);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(800);

  console.log("\n[there is no automatic narration retry (v148.7)]");
  ok("the checker and its helpers are gone", await pg.evaluate(()=>
      typeof overNarrated==='undefined' && typeof repeatKind==='undefined'
      && typeof retryAsRewrite==='undefined' && typeof retryOutputUsable==='undefined'));
  ok("and so is the setting", await pg.evaluate(()=>
      !document.getElementById('setNarrRetryOn') && !document.getElementById('setNarrMaxSpans')));
  ok("saving Settings still works without it", await pg.evaluate(()=>{
      try{ saveSettings(); return true; }catch(e){ return e.message; } }));
  ok("the manual Retry button is still there", (()=>{
      const src=require('fs').readFileSync(require('path').resolve(__dirname,'..','index.html'),'utf8');
      return /function retryLastReply|retryMsg|onclick="[^"]*[Rr]etry/.test(src) ? true : "no manual retry found"; })());

  console.log("\n[the update check reads far enough to find the stamp]");
  ok("the build stamp really is past the old 64KB window", await pg.evaluate(async()=>{
      const t=await (await fetch('index.html?probe=1')).text();
      const i=t.indexOf('id="buildStamp"');
      return i>65536 ? true : "stamp at "+i+" — this test no longer proves anything"; }));
  ok("serverBuild finds it anyway", await pg.evaluate(async()=>{
      const v=await serverBuild();
      return /^v\d+\.\d+$/.test(v) ? true : "got "+JSON.stringify(v); }));
  ok("it agrees with the running build", await pg.evaluate(async()=>{
      const a=runningBuild(), b=await serverBuild();
      return a===b ? true : "running "+a+" server "+b; }));
  ok("it no longer sends a Range header", await pg.evaluate(async()=>{
      let sawRange=false;
      const real=window.fetch;
      window.fetch=(u,o)=>{ const h=(o&&o.headers)||{}; if(h.Range||h.range)sawRange=true; return real(u,o); };
      await serverBuild(); window.fetch=real;
      return !sawRange; }));
  ok("and busts the cache so a stale copy cannot answer", await pg.evaluate(async()=>{
      let url="";
      const real=window.fetch;
      window.fetch=(u,o)=>{ url=String(u); return real(u,o); };
      await serverBuild(); window.fetch=real;
      return /index\.html\?/.test(url) ? true : "asked for "+url; }));
  ok("checking says you are current, not that the server is unreachable", await pg.evaluate(async()=>{
      await updCheckNow(); await new Promise(r=>setTimeout(r,150));
      const t=document.getElementById('toast').textContent;
      return /newest build/.test(t) ? true : "toast said: "+t; }));

  console.log("\n[a refused image says which switch refused it]");
  ok("no reason while everything is on", await pg.evaluate(()=>{
      state.autoImg=true; state.imgPauseOn=false;
      const c=curChat(); c.sceneDockId=null; c.pinnedMid=null;
      return _imgGate()===""; }));
  ok("the pause row names itself", await pg.evaluate(()=>{
      state.imgPauseOn=true; const r=_imgGate(); state.imgPauseOn=false;
      return /Pause images/.test(r) ? true : r; }));
  ok("the settings switch names itself", await pg.evaluate(()=>{
      state.autoImg=false; const r=_imgGate(); state.autoImg=true;
      return /auto-illustration/.test(r) ? true : r; }));
  ok("a playing clip names itself", await pg.evaluate(()=>{
      state.scenes=[{id:"sc_g",name:"S",clips:[{id:"c",url:"x"}]}];
      const c=curChat(); c.sceneDockId="sc_g"; const r=_imgGate(); c.sceneDockId=null;
      return /scene video/.test(r) ? true : r; }));
  ok("speaking replies is NOT one of the reasons", await pg.evaluate(()=>{
      state.autoSpeak=true; const r=_imgGate(); state.autoSpeak=false;
      return r==="" ? true : "TTS produced: "+r; }));

  ok("no page errors", errs.length===0?true:errs.join(" | "));
  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close(); srv.close(); process.exit(fail?1:0);
})();
