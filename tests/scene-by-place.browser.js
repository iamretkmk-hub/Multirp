/* v150.91 — video scenes by place. A video scene is ticked for the areas it was made for (Plays at). After each reply, when
   someone in the scene owns scenes ticked for the exact area, a Decisions pick chooses the one that shows the moment, or none.
   A pick plays it over the story without raising heat or running video-cue turns, and nothing is drawn while it plays; none,
   or leaving the area, takes it off and the picture is drawn at once. A scene the player started is never touched; one the
   player closes stays off in that area. The Video Book is retired: the Story Book plays the video where it came on.
   Run: NODE_PATH=/path/to/node_modules node tests/scene-by-place.browser.js */
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:process.env.SM_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage({viewport:{width:412,height:915}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file://'+require('path').resolve(__dirname,'..','index.html')); await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(900);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x===undefined?c:x).slice(0,900));} };

  await pg.evaluate(()=>{
    window.toast=()=>{};
    window.__setup=()=>{
      const uni=state.universes[0]; state.curUniverse=uni.id; state.user="Emre"; state.key="sk-test"; state.sceneAutoOn=true; state.heatOn=false; state._heatWasOn=undefined;
      uni.locations=(uni.locations||[]).filter(l=>l.id!=="L_flat");
      uni.locations.push({id:"L_flat",name:"Ayla's Flat",sublocations:[{id:"S_ent",name:"Entrance",entrance:true},{id:"S_liv",name:"Living Room",scene:"A low sofa, warm lamp light."},{id:"S_bed",name:"Bedroom"}]});
      state.personas=state.personas.filter(p=>!/^sp_/.test(p.id));
      state.personas.push({id:"sp_a",name:"Ayla",universeId:uni.id,look:{}},{id:"sp_b",name:"Berk",universeId:uni.id,look:{}});
      state.videos=(state.videos||[]).filter(v=>!/^vv/.test(v.id)).concat([{id:"vv1",url:"https://x.test/1.mp4",chars:["Ayla"],cues:[{t:1,text:"she pulls him down onto the sofa"}]},{id:"vv2",url:"https://x.test/2.mp4",chars:["Ayla"]},{id:"vv3",url:"https://x.test/3.mp4",chars:["Berk"]}]);
      state.scenes=[{id:"sc_kiss",name:"Sofa kiss",characterId:"sp_a",characterName:"Ayla",universeId:uni.id,clips:[{id:"vv1",url:"https://x.test/1.mp4"}],when:"They kiss on the sofa.",places:["L_flat|S_liv"]},
                    {id:"sc_dance",name:"Dance",characterId:"sp_a",characterName:"Ayla",universeId:uni.id,clips:[{id:"vv2",url:"https://x.test/2.mp4"}],when:"They dance slowly.",places:["L_flat|S_liv","L_flat|S_bed"]},
                    {id:"sc_berk",name:"Berk shouts",characterId:"sp_b",characterName:"Berk",universeId:uni.id,clips:[{id:"vv3",url:"https://x.test/3.mp4"}],when:"Berk shouts.",places:["L_flat|S_liv"]}];
      const c=curChat(); Object.assign(c,{universeId:uni.id,locationId:"L_flat",location:"Ayla's Flat",subId:"S_liv",presentIds:["sp_a"],sceneDockId:null,sceneDockAuto:false,sceneAutoOff:null,
        messages:[{mid:"u1",role:"user",content:'"Come here."'},{mid:"a1",role:"assistant",speaker:"Ayla",speakerId:"sp_a",content:'*She pulls him down onto the sofa and kisses him.*'}]});
      window.__drawn=[]; window.__decided=[]; window.__dec=[]; window.__player=null;
      window.illustrate=(mid)=>{ __drawn.push(mid); };
      window.decideVisual=(mid)=>{ __decided.push(mid); };
      window.autoImgActive=()=>true; window.imgMode=()=>"smart";
      window.smCreatePlayer=(el,urls,opts)=>{ window.__player={urls,cueIds:opts.cueIds}; return {destroy(){}}; };
      return c; };
    window.__answer="s0";
    const rf=window.fetch;
    window.fetch=async(u,o)=>{ if(String(u).indexOf("/api/alpha/decisions")<0)return rf(u,o); const body=JSON.parse(o.body); __dec.push(body);
      const pr={}; Object.keys(body.questions.scene.criteria).forEach(k=>{ pr[k]=k===__answer?0.9:0.1/(Object.keys(body.questions.scene.criteria).length-1); });
      return new Response(JSON.stringify({answers:{scene:{type:"choice",choice:__answer,probabilities:pr}}}),{status:200}); };
    window.__turn=async(c,mid,text)=>{ c.messages.push({mid,role:"assistant",speaker:"Ayla",speakerId:"sp_a",content:text}); autoVisualize(mid,text); for(let i=0;i<40&&_sceneAutoBusy;i++)await new Promise(r=>setTimeout(r,20)); await new Promise(r=>setTimeout(r,30)); };
  });

  console.log("\n[what the pick is offered]");
  const C=await pg.evaluate(()=>{ const c=__setup(); const r={};
    r.here=sceneAutoCandidates(c).map(s=>s.id);
    c.subId="S_bed"; r.bed=sceneAutoCandidates(c).map(s=>s.id);
    c.subId="S_ent"; r.ent=sceneAutoCandidates(c).map(s=>s.id);
    c.subId="S_liv"; c.presentIds=["sp_a","sp_b"]; r.both=sceneAutoCandidates(c).map(s=>s.id);
    return r; });
  ok("only the scenes ticked for this exact area, of the characters in the scene", C.here.join()==="sc_kiss,sc_dance"&&C.bed.join()==="sc_dance"&&C.ent.length===0&&C.both.join()==="sc_kiss,sc_dance,sc_berk", JSON.stringify(C));

  console.log("\n[a pick plays it — no heat, no cue turns, no picture]");
  const P=await pg.evaluate(async()=>{ const c=__setup(); __answer="s0"; await __turn(c,"a2",'*She kisses him on the sofa.*');
    const body=__dec[0]||{}; const m=c.messages.find(x=>x.mid==="a2");
    return {dock:c.sceneDockId,auto:c.sceneDockAuto,heat:state.heatOn,drawn:__drawn.slice(),decided:__decided.slice(),shown:m&&m.sceneShown,cues:__player&&__player.cueIds,
      crit:Object.keys((body.questions||{scene:{criteria:{}}}).scene.criteria),st:Object.keys(body.state||{}),looks:(body.state||{}).what_it_looks_like_here,
      heatLive:(state.heatOn=true,_heatLive(c)),modeOn:sceneModeActive()}; });
  ok("the picked scene goes on screen as the app's (auto), and the reply keeps it for the book", P.dock==="sc_kiss"&&P.auto===true&&P.shown&&P.shown.id==="sc_kiss"&&P.shown.clips.length===1, JSON.stringify(P));
  ok("heat of the moment is not switched on, and an auto video does not count as a heat scene", P.heat===false&&P.heatLive===false, JSON.stringify(P));
  ok("no video-cue watch turns for an auto video", Array.isArray(P.cues)&&P.cues.length===0, JSON.stringify(P.cues));
  ok("nothing is drawn while it plays", P.drawn.length===0&&P.decided.length===0&&P.modeOn, JSON.stringify(P));
  ok("the pick sees the scenes (with what they show) and none, and where it is and what it looks like", P.crit.join()==="none,s0,s1"&&P.st.includes("latest_lines")&&/low sofa/.test(P.looks), JSON.stringify(P));

  const Q=await pg.evaluate(async()=>{ state.heatOn=false; const c=curChat(); const r={};
    __answer="s0"; await __turn(c,"a3",'*She keeps kissing him.*'); r.same={dock:c.sceneDockId,drawn:__drawn.length};
    __answer="s1"; await __turn(c,"a4",'*They get up and dance.*'); r.swap={dock:c.sceneDockId,auto:c.sceneDockAuto,heat:state.heatOn};
    __answer="none"; await __turn(c,"a5",'*She sits down and asks about his day.*'); r.none={dock:c.sceneDockId,auto:c.sceneDockAuto,drawn:__drawn.slice(),heat:state.heatOn};
    return r; });
  ok("the same pick again: it keeps playing, nothing drawn", Q.same.dock==="sc_kiss"&&Q.same.drawn===0, JSON.stringify(Q));
  ok("another scene fits: it switches, still no heat", Q.swap.dock==="sc_dance"&&Q.swap.auto===true&&Q.swap.heat===false, JSON.stringify(Q));
  ok("none fits: the video goes off and the picture of this reply is drawn at once", Q.none.dock===null&&Q.none.drawn.join()==="a5"&&Q.none.heat===false, JSON.stringify(Q));

  const L=await pg.evaluate(async()=>{ const c=__setup(); __answer="s0"; await __turn(c,"a2",'x'); const n0=__dec.length;
    c.subId="S_ent"; await __turn(c,"a3",'*They go to the door.*');
    return {dock:c.sceneDockId,drawn:__drawn.slice(),decisions:__dec.length-n0}; });
  ok("an area with no scenes ticked: off without asking, and the picture is drawn", L.dock===null&&L.drawn.join()==="a3"&&L.decisions===0, JSON.stringify(L));

  const M=await pg.evaluate(async()=>{ const c=__setup(); __answer="s0"; await __turn(c,"a2",'x'); c.subId="S_ent";
    renderImageRail&&syncSceneDock(); await new Promise(r=>setTimeout(r,30));
    return {dock:c.sceneDockId,drawn:__drawn.slice()}; });
  ok("leaving the area while it plays (no reply needed): it goes off and the newest reply is drawn", M.dock===null&&M.drawn.join()==="a2", JSON.stringify(M));

  console.log("\n[the player's own scenes, and closing one]");
  const U=await pg.evaluate(async()=>{ const c=__setup(); const r={};
    playSceneInChat("sc_berk"); r.manualHeat=state.heatOn; __answer="none"; await __turn(c,"a2",'x');
    r.manual={dock:c.sceneDockId,auto:c.sceneDockAuto,dec:__dec.length,drawn:__drawn.length};
    closeSceneDock(); r.heatAfter=state.heatOn;
    __answer="s0"; await __turn(c,"a3",'x'); r.auto=c.sceneDockId;
    closeSceneDock(); r.off=c.sceneAutoOff; r.cands=sceneAutoCandidates(c).map(s=>s.id);
    c.subId="S_bed"; r.elsewhere=sceneAutoCandidates(c).map(s=>s.id); c.subId="S_liv"; c.sceneAutoOff=null;
    return r; });
  ok("a scene the player started is left alone: no pick, no picture, heat as before", U.manualHeat===true&&U.manual.dock==="sc_berk"&&U.manual.auto===false&&U.manual.dec===0&&U.manual.drawn===0&&U.heatAfter===false, JSON.stringify(U));
  ok("closing an auto video yourself keeps that scene off in this area", U.auto==="sc_kiss"&&U.off&&U.off.sceneId==="sc_kiss"&&U.cands.join()==="sc_dance", JSON.stringify(U));

  console.log("\n[one book]");
  const B=await pg.evaluate(async()=>{ const c=__setup(); __answer="s0"; await __turn(c,"a2",'*She kisses him.*'); closeSceneDock({auto:true});
    const m=c.messages.find(x=>x.mid==="a2"); const plan=bookPlan(c,"story");
    const media=[]; plan.chapters.forEach(ch=>ch.scenes.forEach(s=>s.items.forEach(it=>{ if(it.type==="media")media.push(it.mid); })));
    const blocks=plan.chapters.length?_bkBlocks(c,"story",plan,plan.chapters[0]).map(x=>x.h).join(""):"";
    const menu=[...document.querySelectorAll('button')].some(x=>/Video Book/.test(x.textContent));
    let opened=null; const ro=window._bookOpen; window._bookOpen=k=>{ opened=k; }; openVideoBook(); window._bookOpen=ro;
    return {has:_bkHasPic(m),media,video:/<figure[^>]*data-mid="a2"[\s\S]*?<video/.test(blocks),menu,opened}; });
  ok("the Story Book takes the reply the video came on with as its media, and shows a video there", B.has&&B.media.includes("a2")&&B.video, JSON.stringify(B));
  ok("the Video Book is gone from the menu, and opening it opens the Story Book", B.menu===false&&B.opened==="story", JSON.stringify(B));

  console.log("\n[the editor and the switch]");
  const E=await pg.evaluate(()=>{ __setup(); openSceneEditor("sc_berk"); const box=document.getElementById('sceneEditBody');
    const cbs=[...box.querySelectorAll('input[type=checkbox][data-place]')].map(x=>x.dataset.place);
    const bed=box.querySelector('input[data-place="L_flat|S_bed"]'); bed.checked=true; bed.onchange();
    const places=sceneById("sc_berk").places.slice(); closeSceneEditor();
    show('settings'); const t=document.getElementById('setSceneAutoOn'); t.checked=false; saveSettings(false); const off=state.sceneAutoOn===false;
    t.checked=true; saveSettings(false);
    return {cbs,places,off,on:state.sceneAutoOn===true,prompt:!!X_ENGINE_PROMPTS.x_scene_pick}; });
  ok("the scene editor lists every area of the world to tick; a tick is saved", E.cbs.includes("L_flat|S_liv")&&E.cbs.includes("L_flat|S_bed")&&E.places.includes("L_flat|S_bed")&&E.places.includes("L_flat|S_liv"), JSON.stringify(E));
  ok("Settings → Images: the switch saves both ways; the pick is an editable prompt", E.off&&E.on&&E.prompt, JSON.stringify(E));
  const OFF=await pg.evaluate(async()=>{ const c=__setup(); state.sceneAutoOn=false; await __turn(c,"a2",'x'); state.sceneAutoOn=true; return {dock:c.sceneDockId,dec:__dec.length,decided:__decided.slice()}; });
  ok("switched off: no pick, pictures as before", OFF.dock===null&&OFF.dec===0&&OFF.decided.join()==="a2", JSON.stringify(OFF));

  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close(); process.exit(fail?1:0);
})();
