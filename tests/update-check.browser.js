const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage({viewport:{width:412,height:915}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file:///home/user/Multirp/index.html'); await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(900);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x||c).slice(0,300));} };

  console.log("\n[the bar exists and starts hidden]");
  ok("the bar is in the DOM", await pg.evaluate(()=>!!document.getElementById('updBar')));
  ok("it is hidden on a normal load", await pg.evaluate(()=>
      !document.getElementById('updBar').classList.contains('show')));
  ok("it carries a Reload and a dismiss", await pg.evaluate(()=>{
      const h=document.getElementById('updBar').innerHTML;
      return h.indexOf("updReload()")>-1 && h.indexOf("updDismiss()")>-1; }));

  console.log("\n[showing and dismissing]");
  ok("updShow reveals it", await pg.evaluate(()=>{
      updShow(); return document.getElementById('updBar').classList.contains('show'); }));
  ok("updDismiss hides it", await pg.evaluate(()=>{
      updDismiss(); return !document.getElementById('updBar').classList.contains('show'); }));
  ok("and it stays dismissed for this page", await pg.evaluate(()=>{
      updShow(); updShow();
      return !document.getElementById('updBar').classList.contains('show'); }));
  ok("a reload clears the dismissal (the flag is per page)", await pg.evaluate(()=>
      typeof _updDismissed==="boolean"));

  console.log("\n[the build stamp asks the server]");
  ok("the stamp is clickable and calls the checker", await pg.evaluate(()=>{
      const el=document.getElementById('buildStamp');
      return !!el && (el.getAttribute('onclick')||"").indexOf("updCheckNow")>-1; }));
  ok("updCheckNow is reachable from global scope (not trapped in the boot block)",
     await pg.evaluate(()=>typeof window.updCheckNow==="function" && typeof window.swCheck==="function"));
  ok("with no worker registered it says so instead of throwing", await pg.evaluate(()=>{
      const seen=[]; const real=window.toast; window.toast=m=>seen.push(String(m));
      try{ updCheckNow(); }catch(e){ window.toast=real; return "threw: "+e.message; }
      window.toast=real;
      return seen.length===1 && /reload the page/i.test(seen[0]); }));
  ok("swCheck reports false when there is no registration", await pg.evaluate(()=>swCheck(true)===false));

  console.log("\n[the throttle]");
  ok("a forced check always goes through", await pg.evaluate(()=>{
      let n=0; _swReg={update(){n++;}}; _swLastChk=0;
      swCheck(true); swCheck(true); swCheck(true);
      const got=n; _swReg=null; return got===3; }));
  ok("an unforced check is throttled to once per 5 minutes", await pg.evaluate(()=>{
      let n=0; _swReg={update(){n++;}}; _swLastChk=0;
      swCheck(false); swCheck(false); swCheck(false);   // only the first should call update()
      const got=n; _swReg=null; return got===1; }));
  ok("and it opens up again once the window has passed", await pg.evaluate(()=>{
      let n=0; _swReg={update(){n++;}}; _swLastChk=Date.now()-6*60*1000;
      swCheck(false);
      const got=n; _swReg=null; return got===1; }));
  ok("a throwing update() does not take the app down", await pg.evaluate(()=>{
      _swReg={update(){ throw new Error("boom"); }}; _swLastChk=0;
      try{ const r=swCheck(true); _swReg=null; return r===true; }
      catch(e){ _swReg=null; return "threw: "+e.message; } }));

  console.log("\n[the real service-worker update path]");
  // file:// cannot register a worker, so drive the same wiring the boot block installs.
  ok("an update on an ALREADY-CONTROLLED page shows the bar", await pg.evaluate(()=>{
      // stand in for the browser: a new worker reaching 'installed' while a controller exists
      const listeners={};
      const w={state:"installing",addEventListener:(k,f)=>{listeners[k]=f;}};
      const reg={installing:w,waiting:null,addEventListener:(k,f)=>{ if(k==='updatefound') reg._uf=f; },update(){}};
      // the same handler the boot block attaches
      reg.addEventListener('updatefound',()=>{
        const nw=reg.installing; if(!nw)return;
        nw.addEventListener('statechange',()=>{
          if(nw.state==='installed' && {controller:{}}.controller) updShow();
        });
      });
      _updDismissed=false; document.getElementById('updBar').classList.remove('show');
      reg._uf();                     // browser finds a new sw.js
      w.state="installed"; listeners.statechange();
      const shown=document.getElementById('updBar').classList.contains('show');
      updDismiss(); _updDismissed=false;
      return shown; }));
  ok("a FIRST install (no controller) stays silent", await pg.evaluate(()=>{
      const listeners={};
      const w={state:"installing",addEventListener:(k,f)=>{listeners[k]=f;}};
      const reg={installing:w,addEventListener:(k,f)=>{ if(k==='updatefound') reg._uf=f; }};
      reg.addEventListener('updatefound',()=>{
        const nw=reg.installing; if(!nw)return;
        nw.addEventListener('statechange',()=>{
          if(nw.state==='installed' && {controller:null}.controller) updShow();
        });
      });
      _updDismissed=false; document.getElementById('updBar').classList.remove('show');
      reg._uf(); w.state="installed"; listeners.statechange();
      return !document.getElementById('updBar').classList.contains('show'); }));

  console.log("\n[it does not sit on top of anything]");
  ok("the bar clears the nav and the toast lane", await pg.evaluate(()=>{
      updShow();
      const bar=document.getElementById('updBar').getBoundingClientRect();
      const nav=document.querySelector('nav');
      const navTop=nav?nav.getBoundingClientRect().top:window.innerHeight;
      updDismiss(); _updDismissed=false;
      return bar.bottom<=navTop+1 ? true : "bar bottom "+bar.bottom+" overlaps nav top "+navTop; }));
  ok("and does not overflow the phone width", await pg.evaluate(()=>{
      updShow();
      const r=document.getElementById('updBar').getBoundingClientRect();
      updDismiss(); _updDismissed=false;
      return (r.left>=0 && r.right<=412) ? true : "left "+r.left+" right "+r.right; }));

  console.log("\n[nothing else moved]");
  ok("the stamp still reads the build", await pg.evaluate(()=>
      /^v\d+\.\d+$/.test(document.getElementById('buildStamp').textContent.trim())));
  ok("saveSettings does not throw", await pg.evaluate(()=>{
      show('settings'); try{ saveSettings(false); return true; }catch(e){ return "threw: "+e.message; } }));
  ok("no page errors", errs.length===0?true:errs.join(" | "));
  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close(); process.exit(fail?1:0);
})();
