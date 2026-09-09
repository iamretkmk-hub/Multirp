const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x||c).slice(0,400));} };

  for(const [label,vp] of [["portrait",{width:412,height:915}],["landscape",{width:915,height:412}]]){
    const ctx=await b.newContext({viewport:vp,hasTouch:true,isMobile:true});
    const pg=await ctx.newPage();
    const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
    await pg.goto('file:///home/user/Multirp/index.html'); await pg.waitForTimeout(2300);
    await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
    await pg.waitForTimeout(800);
    // A run of PLAIN replies — no image anywhere. This is the case that had no route at all.
    await pg.evaluate(()=>{
      const uni=state.universes[0];
      if(!state.personas.some(p=>p.id==="p_s"))
        state.personas.push({id:"p_s",name:"Nil",universeId:uni.id,instructions:"x",personality:"x",
          backstory:"x",style:"x",goals:"x",look:{}});
      const chat=curChat(); chat.presentIds=["p_s"]; chat.sceneDockId=null;
      chat.messages=(chat.messages||[]).filter(m=>!m.mid||m.mid.indexOf("m_s")!==0);
      chat.messages.push({mid:"m_s1",role:"assistant",name:"Nil",speakerId:"p_s",content:"merhaba"});
      state.autoImg=false;
      state.scenes=[{id:"sc_t",name:"Test scene",clips:[{id:"c1",url:"https://example.com/a.mp4"}]}];
      show('chat'); renderChat();
    });

    console.log("\n["+label+" — reachable with no image on screen]");
    ok("no film dropdown exists (the old and only route)", await pg.evaluate(()=>
        [...document.querySelectorAll('button')].filter(x=>(x.getAttribute('title')||'').indexOf('Video')===0).length===0));
    const modes=await pg.$('#modesBtn');
    ok("the playback button is tappable", !!modes);
    try{ await modes.click({timeout:2500}); }catch(e){ ok("open the playback menu", "click failed: "+e.message.split("\n")[0]); }
    await pg.waitForTimeout(200);
    ok("the scene row is visible in it", await pg.evaluate(()=>{
        const r=document.querySelector('#modesMenu .modeRow[data-mode="scene"]');
        if(!r) return "row missing";
        const b=r.getBoundingClientRect();
        return (b.width>0&&b.height>0) ? true : "row has no size"; }));
    ok("its sub-label offers to play", await pg.evaluate(()=>
        (document.getElementById('modeSceneSub')||{}).textContent==="Play one of your scenes over the chat"));

    const row=await pg.$('#modesMenu .modeRow[data-mode="scene"]');
    try{ await row.click({timeout:2500}); }catch(e){ ok("tap the row", "click failed: "+e.message.split("\n")[0]); }
    await pg.waitForTimeout(350);
    ok("the scene picker opens", await pg.evaluate(()=>{
        const m=document.getElementById('scenePickModal');
        return m&&getComputedStyle(m).display!=="none" ? true : "picker display: "+(m?getComputedStyle(m).display:"absent"); }));
    const card=await pg.$('#scenePickModal .sceneCard');
    ok("a scene card is offered", !!card);
    try{ await card.click({timeout:2500}); }catch(e){ ok("tap the card","click failed: "+e.message.split("\n")[0]); }
    await pg.waitForTimeout(400);
    ok("the dock opens with real size", await pg.evaluate(()=>{
        const d=document.getElementById('sceneDock'); const r=d.getBoundingClientRect();
        return (d.classList.contains('on')&&r.width>100&&r.height>100)
          ? true : "on="+d.classList.contains('on')+" "+Math.round(r.width)+"x"+Math.round(r.height); }));
    ok("and it sits inside the viewport", await pg.evaluate(()=>{
        const r=document.getElementById('sceneDock').getBoundingClientRect();
        return (r.top>=0&&r.left>=0&&r.right<=window.innerWidth+1&&r.bottom<=window.innerHeight+1)
          ? true : JSON.stringify({t:Math.round(r.top),l:Math.round(r.left),r:Math.round(r.right),b:Math.round(r.bottom)}); }));

    console.log("\n["+label+" — the same row closes it]");
    ok("the row now reads as playing", await pg.evaluate(()=>{
        reflectModes();
        const r=document.querySelector('#modesMenu .modeRow[data-mode="scene"]');
        return r.classList.contains('on')
          && (document.getElementById('modeSceneSub')||{}).textContent==="Playing — tap to close it"; }));
    ok("tapping it again closes the dock", await pg.evaluate(()=>{
        toggleMode('scene');
        const d=document.getElementById('sceneDock');
        const c=curChat();
        return !d.classList.contains('on') && !c.sceneDockId; }));

    console.log("\n["+label+" — nothing else moved]");
    ok("the other playback rows still toggle", await pg.evaluate(()=>{
        const was=state.imgPauseOn;
        toggleMode('noimg'); const flipped=state.imgPauseOn!==was;
        toggleMode('noimg'); const back=state.imgPauseOn===was;
        return flipped&&back; }));
    ok("no page errors", errs.length===0?true:errs.join(" | "));
    await ctx.close();
  }

  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close(); process.exit(fail?1:0);
})();
