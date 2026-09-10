const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x||c).slice(0,400));} };
  const IMG="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

  const setup=async(pg)=>{
    await pg.goto('file:///home/user/Multirp/index.html'); await pg.waitForTimeout(2300);
    await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
    await pg.waitForTimeout(800);
    await pg.evaluate(I=>{
      const uni=state.universes[0];
      if(!state.personas.some(p=>p.id==="p_u"))
        state.personas.push({id:"p_u",name:"Duygu",universeId:uni.id,instructions:"x",personality:"x",
          backstory:"x",style:"x",goals:"x",look:{}});
      const chat=curChat(); chat.presentIds=["p_u"]; state.user="Kemal"; chat.sceneDockId=null;
      chat.messages=[
        {mid:"u1",role:"assistant",speaker:"Duygu",speakerId:"p_u",present:["p_u"],content:'"Bir."',img:I},
        {mid:"u2",role:"assistant",speaker:"Duygu",speakerId:"p_u",present:["p_u"],content:'"Iki."'}
      ];
      state.imgSticky=true;
      state.scenes=[{id:"sc_t",name:"Clip",clips:[{id:"c1",url:"https://example.com/a.mp4"}]}];
      show('chat'); renderChat();
    },IMG);
  };

  // ---------------- portrait ----------------
  {
    const ctx=await b.newContext({viewport:{width:412,height:915},hasTouch:true,isMobile:true});
    const pg=await ctx.newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
    await setup(pg);

    console.log("\n[portrait — the story owns the screen]");
    ok("the bottom tabs are gone on the chat screen", await pg.evaluate(()=>
        getComputedStyle(document.querySelector('nav')).display==="none"));
    ok("and the destinations moved into the chat menu", await pg.evaluate(()=>
        getComputedStyle(document.querySelector('.chatMenuNav')).display!=="none"));
    ok("every other screen keeps its tabs", await pg.evaluate(()=>{
        show('settings');
        const v=getComputedStyle(document.querySelector('nav')).display!=="none";
        show('chat'); return v; }));
    ok("a long reply uses nearly the whole width", await pg.evaluate(()=>{
        // max-width is a cap, not a width: a short line is short by design. What matters is that a
        // long one is allowed to reach the edge instead of being held off it.
        const chat=curChat();
        chat.messages.push({mid:"u3",role:"assistant",speaker:"Duygu",speakerId:"p_u",present:["p_u"],
          content:'"'+"Bu cok uzun bir cumle ve ekranin tamamini kullanmasi gerekiyor. ".repeat(6)+'"'});
        renderChat();
        const list=document.getElementById('chatList').getBoundingClientRect();
        const bubs=[...document.querySelectorAll('.bubble')];
        const w=Math.max(...bubs.map(x=>x.getBoundingClientRect().width));
        return w/list.width>0.92 ? true : "widest bubble is "+Math.round(100*w/list.width)+"% of the column"; }));

    console.log("\n[portrait — no still frame under a playing clip]");
    ok("a carried-over frame shows while no clip plays", await pg.evaluate(()=>
        String(sceneHTML(curChat().messages[1])).indexOf("sticky")>-1));
    ok("and is suppressed once a clip is docked", await pg.evaluate(()=>{
        playSceneInChat("sc_t");
        return String(sceneHTML(curChat().messages[1])).indexOf("sticky")===-1; }));
    ok("the transcript is redrawn, so no stale frame is left on screen", await pg.evaluate(async()=>{
        await new Promise(r=>setTimeout(r,60));
        return document.querySelectorAll('#chatList .scene.sticky').length===0; }));
    ok("closing the clip brings the frame back", await pg.evaluate(async()=>{
        closeSceneDock(); await new Promise(r=>setTimeout(r,60));
        return String(sceneHTML(curChat().messages[1])).indexOf("sticky")>-1; }));

    console.log("\n[portrait — the clip window floats and moves]");
    await pg.evaluate(()=>{ try{localStorage.removeItem("sm_sceneDockGeo");}catch(e){} playSceneInChat("sc_t"); });
    await pg.waitForTimeout(120);
    ok("it has a move bar and a resize grip", await pg.evaluate(()=>{
        const h=document.getElementById('sceneDockHandle'), g=document.getElementById('sceneDockGrip');
        return getComputedStyle(h).display!=="none" && getComputedStyle(g).display!=="none"; }));
    ok("dragging the bar moves it on both axes", await pg.evaluate(async()=>{
        // shrink it first: at the default full width there is no horizontal room to travel into,
        // and the clamp correctly refuses to move it sideways.
        const d=document.getElementById('sceneDock');
        d.style.setProperty('--sdW','200px'); d.style.setProperty('--sceneDockH','160px');
        try{ localStorage.setItem("sm_sceneDockGeo",JSON.stringify({left:8,top:8,w:200,h:160})); }catch(e){}
        sceneDockApplyGeo();
        const a=d.getBoundingClientRect();
        const h=document.getElementById('sceneDockHandle');
        const ev=(t,x,y)=>h.dispatchEvent(new PointerEvent(t,{clientX:x,clientY:y,bubbles:true,pointerId:1}));
        ev('pointerdown',100,300); ev('pointermove',150,420); ev('pointerup',150,420);
        await new Promise(r=>setTimeout(r,60));
        const c=d.getBoundingClientRect();
        return (Math.round(c.left-a.left)>30 && Math.round(c.top-a.top)>60)
          ? true : "moved by "+Math.round(c.left-a.left)+","+Math.round(c.top-a.top); }));
    ok("the position survives a close and reopen", await pg.evaluate(async()=>{
        const before=document.getElementById('sceneDock').getBoundingClientRect();
        closeSceneDock(); await new Promise(r=>setTimeout(r,50));
        playSceneInChat("sc_t"); await new Promise(r=>setTimeout(r,80));
        const after=document.getElementById('sceneDock').getBoundingClientRect();
        return Math.abs(after.left-before.left)<2 && Math.abs(after.top-before.top)<2
          ? true : "was "+Math.round(before.left)+","+Math.round(before.top)+" now "+Math.round(after.left)+","+Math.round(after.top); }));
    ok("the grip resizes it", await pg.evaluate(async()=>{
        const d=document.getElementById('sceneDock');
        const a=d.getBoundingClientRect();
        const g=document.getElementById('sceneDockGrip');
        const r0=g.getBoundingClientRect();
        const ev=(t,x,y)=>g.dispatchEvent(new PointerEvent(t,{clientX:x,clientY:y,bubbles:true,pointerId:2}));
        ev('pointerdown',r0.left+5,r0.top+5); ev('pointermove',r0.left-60,r0.top-40); ev('pointerup',r0.left-60,r0.top-40);
        await new Promise(r=>setTimeout(r,60));
        const c=d.getBoundingClientRect();
        return (c.width<a.width-20 && c.height<a.height-10) ? true : "was "+Math.round(a.width)+"x"+Math.round(a.height)+" now "+Math.round(c.width)+"x"+Math.round(c.height); }));
    ok("it cannot be dragged off the screen", await pg.evaluate(async()=>{
        const d=document.getElementById('sceneDock');
        const h=document.getElementById('sceneDockHandle');
        const ev=(t,x,y)=>h.dispatchEvent(new PointerEvent(t,{clientX:x,clientY:y,bubbles:true,pointerId:3}));
        ev('pointerdown',100,300); ev('pointermove',9000,9000); ev('pointerup',9000,9000);
        await new Promise(r=>setTimeout(r,60));
        const c=d.getBoundingClientRect(), H=document.getElementById('chatBody').getBoundingClientRect();
        return (c.right<=H.right+1 && c.bottom<=H.bottom+1 && c.left>=H.left-1)
          ? true : "escaped to "+Math.round(c.left)+","+Math.round(c.top); }));
    ok("no page errors", errs.length===0?true:errs.join(" | "));
    await ctx.close();
  }

  // ---------------- landscape ----------------
  {
    const ctx=await b.newContext({viewport:{width:915,height:412}});
    const pg=await ctx.newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
    await setup(pg);
    await pg.evaluate(()=>{
      curChat().messages.push({mid:"u3",role:"assistant",speaker:"Duygu",speakerId:"p_u",present:["p_u"],
        content:'"'+"Bu cok uzun bir cumle ve ekranin yarisini kullanmasi gerekiyor. ".repeat(6)+'"'});
      renderChat(); });
    console.log("\n[landscape — half text, half picture]");
    ok("the screen is split down the middle", await pg.evaluate(()=>{
        const W=innerWidth;
        const l=document.getElementById('chatList').getBoundingClientRect();
        const r=document.getElementById('imageRail').getBoundingClientRect();
        return (Math.abs(l.width-W/2)<8 && Math.abs(r.width-W/2)<8 && Math.abs(r.left-W/2)<8)
          ? true : "text "+Math.round(l.width)+" picture "+Math.round(r.width)+" of "+W; }));
    ok("the picture half runs the full height, past the composer", await pg.evaluate(()=>{
        const r=document.getElementById('imageRail').getBoundingClientRect();
        const bar=document.querySelector('.inputBar').getBoundingClientRect();
        return (r.top<2 && r.bottom>=bar.bottom-1)
          ? true : "rail "+Math.round(r.top)+".."+Math.round(r.bottom)+" bar ends "+Math.round(bar.bottom); }));
    ok("the composer stays under the text half only", await pg.evaluate(()=>{
        const bar=document.querySelector('.inputBar').getBoundingClientRect();
        return Math.abs(bar.width-innerWidth/2)<8 ? true : "bar is "+Math.round(bar.width); }));
    ok("a long reply fills the text half", await pg.evaluate(()=>{
        const list=document.getElementById('chatList').getBoundingClientRect();
        const w=Math.max(...[...document.querySelectorAll('.bubble')].map(x=>x.getBoundingClientRect().width));
        return w/list.width>0.92 ? true : "widest bubble is "+Math.round(100*w/list.width)+"% of the half"; }));
    ok("the clip takes over the picture half exactly", await pg.evaluate(async()=>{
        playSceneInChat("sc_t"); await new Promise(r=>setTimeout(r,80));
        const d=document.getElementById('sceneDock').getBoundingClientRect();
        const r=document.getElementById('imageRail').getBoundingClientRect();
        return (Math.abs(d.left-r.left)<2 && Math.abs(d.width-r.width)<2 && Math.abs(d.height-r.height)<2)
          ? true : "dock "+Math.round(d.left)+"/"+Math.round(d.width)+"x"+Math.round(d.height)
                  +" rail "+Math.round(r.left)+"/"+Math.round(r.width)+"x"+Math.round(r.height); }));
    ok("the clip window is still the pinned right column", await pg.evaluate(async()=>{
        playSceneInChat("sc_t"); await new Promise(r=>setTimeout(r,80));
        const d=document.getElementById('sceneDock').getBoundingClientRect();
        const H=document.getElementById('chatBody').getBoundingClientRect();
        return (d.right>H.right-20 && d.left>H.left+H.width*0.4)
          ? true : "dock at "+Math.round(d.left)+".."+Math.round(d.right)+" in "+Math.round(H.width); }));
    ok("no move bar or grip there", await pg.evaluate(()=>
        getComputedStyle(document.getElementById('sceneDockHandle')).display==="none"
     && getComputedStyle(document.getElementById('sceneDockGrip')).display==="none"));
    ok("no page errors", errs.length===0?true:errs.join(" | "));
    await ctx.close();
  }

  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close(); process.exit(fail?1:0);
})();
