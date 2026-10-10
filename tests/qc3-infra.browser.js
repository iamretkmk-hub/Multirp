// QC report #3 — infrastructure, security, universe reset (v147.2).
//  · Import roleplay + reload: the open universe and the open chat agree (K.curUniverse is saved after it is
//    set; a boot with them out of step is repaired toward the chat that was on screen).
//  · A reset restores the start: a found authored hidden character is hidden again, as written; a first-visit
//    character the player touched stays (an untouched one goes); the deleted chats' per-message media are
//    pruned; the character list is re-rendered; Day 1 opens at the player's home with whoever lives there.
//  · Imports snapshot only after the kind check and the yes; a forced snapshot is not repeated for one state.
//  · Player-started generators are foreground; live-call streams have an idle ceiling; a read-only tab's
//    diary font / dock geometry never write; reloading the writer tab leaves read-only tabs alone.
const {chromium}=require('playwright');
const path=require('path');
(async()=>{
  const b=await chromium.launch({executablePath:process.env.SM_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const ctx=await b.newContext();
  const pg=await ctx.newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(e.message)); pg.on('dialog',d=>d.dismiss());
  const url='file://'+path.resolve(__dirname,'..','index.html');
  await pg.goto(url); await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(store.raw(K.onboarded,null)!=="1") finishOnboard(); }); await pg.waitForTimeout(600);
  let pass=0,fail=0; const ok=(n,c,x)=>{ if(c){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+(x?"  — "+x:""));} };
  const sec=t=>console.log("\n["+t+"]");

  const seed=()=>pg.evaluate(async()=>{
    window.toast=()=>{};
    const mkU=(id,user,x)=>Object.assign({id,name:id,userName:user,setting:"A seaside town.",originDoc:"State zero.",locations:[
      {id:id+"_kafe",name:"Kafe",residents:[],sublocations:[],npcSeeded:true},{id:id+"_home",name:"Home",type:"home",residents:[],sublocations:[]}],gameData:{},trackers:[],rules:[],prompts:{}},x||{});
    const mk=(id,n,u,x)=>Object.assign({id,name:n,universeId:u,personality:"Warm.",backstory:"Grew up here.",goals:"Open a shop.",instructions:"x",style:"x",look:{},relationships:{}},x||{});
    state.universes=[mkU("uA","Emre",{playerHomeLocId:"uA_home"}),mkU("uB","Mert")];
    state.personas=[mk("pMom","Anne","uA"),mk("pOz","Özlem","uA"),mk("pB1","Deniz","uB"),
      mk("pHid","Selin","uA",{latent:true,boundLocId:"uA_kafe",personality:"A quiet diver.",backstory:"Authored past."}),
      mk("pSeedT","Kiosk Man","uA",{avatar:"🧍",backstory:"",instructions:"",image:null,origin:"seed"}),
      mk("pSeedU","Bench Guy","uA",{avatar:"🧍",backstory:"",instructions:"",image:null,origin:"seed"})];
    universeById("uA").locations[1].residents=["pMom"];
    universeById("uA").locations[0].residents=["pSeedT","pSeedU"];
    state.chats={
      cA:{id:"cA",universeId:"uA",messages:[{mid:"mA1",role:"user",content:"hi"},{mid:"mA2",role:"assistant",content:"hey",speaker:"Özlem",speakerId:"pOz"}],presentIds:["pOz"],gameDay:9,period:"Evening",locationId:"uA_kafe",location:"Kafe"},
      cB:{id:"cB",universeId:"uB",messages:[{mid:"mB1",role:"user",content:"other"}],gameDay:4}};
    state.memory=[]; state.gossip=[];
    state.curUniverse="uA"; state.curChat="cA"; applyUniverseProfile("uA");
    persistUniverses(); persistPersonas(); flushPersistChats();
    return true;
  });

  // ===================================================================================================
  sec("import + reload: the open universe and the open chat agree");
  await seed();
  await pg.evaluate(async()=>{
    let file=null; window._downloadJSON=o=>{ file=JSON.parse(JSON.stringify(o)); };
    await exportRoleplay("uA");
    const f=JSON.parse(JSON.stringify(file)); f.universe.id="u9"; f.universe.name="Imported"; f.universe.userName="Kerem";
    f.chats={c9:Object.assign({},f.chats.cA,{id:"c9",universeId:"u9"})}; f.curChat="c9";
    f.personas=f.personas.map(p=>Object.assign({},p,{id:p.id+"9",universeId:"u9"})); f.memory=[]; f.gossip=[];
    enterUniverseChat("uB",true);
    window.uiConfirm=async()=>true;
    window.__imp=await importRoleplayFile(f);
    await new Promise(r=>setTimeout(r,800));
  });
  await pg.reload(); await pg.waitForTimeout(2800);
  let R=await pg.evaluate(()=>({uni:state.curUniverse, chat:state.curChat, chatUni:(state.chats[state.curChat]||{}).universeId, user:state.user, stored:store.raw(K.curUniverse,"")}));
  ok("after Import roleplay + reload the imported universe is open",R.uni==="u9"&&R.stored==="u9",JSON.stringify(R));
  ok("…its chat is the open chat",R.chat==="c9"&&R.chatUni==="u9",JSON.stringify(R));
  ok("…with its own player",R.user==="Kerem",JSON.stringify(R));
  // a boot with the two out of step (an old import) is repaired toward the chat on screen
  await pg.evaluate(()=>{ localStorage.setItem(K.curUniverse,"uB"); });
  await pg.reload(); await pg.waitForTimeout(2800);
  R=await pg.evaluate(()=>({uni:state.curUniverse, chatUni:(state.chats[state.curChat]||{}).universeId, user:state.user, stored:store.raw(K.curUniverse,"")}));
  ok("a boot with the open universe and chat out of step is repaired",R.uni==="u9"&&R.chatUni==="u9"&&R.stored==="u9"&&R.user==="Kerem",JSON.stringify(R));

  // ===================================================================================================
  sec("a reset restores the start");
  await seed();
  R=await pg.evaluate(async()=>{
    const r={};
    // the player finds the authored hidden character with /seek; the reveal writes the sketch up
    window.__opts=[]; const real=window.chatCompletion;
    window.chatCompletion=async(m,model,o)=>{ window.__opts.push(o||{}); if(o&&/Reveal NPC/.test(o.dbg||""))return JSON.stringify({personality:"Rewritten by the reveal, a long enough personality line.",backstory:"Reveal backstory.",look:"tall"}); return ""; };
    state.key=state.key||"sk-test";
    const hid=state.personas.find(p=>p.id==="pHid");
    await revealLatentNpc(state.chats.cA,hid);
    window.chatCompletion=real;
    r.revealFg=!!(window.__opts.find(o=>/Reveal NPC/.test(o.dbg||""))||{}).foreground;
    r.revealed=!hid.latent&&hid.boundLocId==null&&/Rewritten/.test(hid.personality)&&!!hid.authoredLatent;
    // the player gives one first-visit character a picture (via the card), leaves the other alone
    const kiosk=state.personas.find(p=>p.id==="pSeedT");
    editPersona("pSeedT"); await new Promise(x=>setTimeout(x,150));
    document.getElementById('pePersonality').value="A kiosk man who knows every ferry time.";
    savePersona(); await new Promise(x=>setTimeout(x,150));
    try{ closeModal('personaModal'); }catch(e){}
    r.touched=!!kiosk.playerEdited;
    // per-message media of both universes
    await mediaDB.kvSet("mimg:mA1","data:image/png;base64,AAAA"); await mediaDB.kvSet("mvid:mA2",new Blob(["x"]));
    await mediaDB.kvSet("mimg:mB1","data:image/png;base64,BBBB");
    show('personas');
    // the reset, through the Settings row (a snapshot is taken; no copy)
    window.uiChoose=async()=>"reset";
    await wipeUniverseMemory();
    await new Promise(x=>setTimeout(x,900));
    const H=state.personas.find(p=>p.id==="pHid");
    r.hiddenAgain=!!(H&&H.latent&&H.boundLocId==="uA_kafe");
    r.asWritten=!!(H&&H.personality==="A quiet diver."&&H.backstory==="Authored past."&&!H.authoredLatent);
    r.seedKept=state.personas.some(p=>p.id==="pSeedT");
    r.seedGone=!state.personas.some(p=>p.id==="pSeedU");
    const c=state.chats[state.curChat];
    r.chat={id:state.curChat,uni:c&&c.universeId,loc:c&&c.locationId,present:c&&c.presentIds,day:c&&c.gameDay,msgs:(c&&c.messages||[]).length,
      scene:document.getElementById('chatScene').textContent};
    const keys=await mediaDB.kvKeys();
    r.media={a1:keys.includes("mimg:mA1"),a2:keys.includes("mvid:mA2"),b1:keys.includes("mimg:mB1")};
    const list=document.getElementById('personaList');
    r.list={seedU:list.innerHTML.includes("Bench Guy"), seedT:list.innerHTML.includes("Kiosk Man"),
      undisc:!!(document.getElementById('undiscGroup')&&document.getElementById('undiscGroup').innerHTML.includes("Selin"))};
    r.flagCleared=!universeById("uA").landAtHome;
    return r;
  });
  ok("/seek's reveal call is a foreground call",R.revealFg,JSON.stringify(R));
  ok("the reveal records the authored original",R.revealed,JSON.stringify(R));
  ok("editing a card marks it as the player's",R.touched,JSON.stringify(R));
  ok("after the reset the authored hidden character is hidden again at its place",R.hiddenAgain,JSON.stringify(R));
  ok("…with its card as written (the reveal's rewrite is undone)",R.asWritten,JSON.stringify(R));
  ok("a first-visit character the player wrote into is kept",R.seedKept,JSON.stringify(R));
  ok("an untouched first-visit character is still taken out",R.seedGone,JSON.stringify(R));
  ok("Day 1 opens at the player's home",R.chat.uni==="uA"&&R.chat.loc==="uA_home"&&R.chat.day===1&&R.flagCleared,JSON.stringify(R.chat));
  ok("…with whoever lives there present, and the place shown",JSON.stringify(R.chat.present)==='["pMom"]'&&/Home/.test(R.chat.scene)&&/1 nearby/.test(R.chat.scene),JSON.stringify(R.chat));
  ok("the deleted chat's scene image and clip are pruned",!R.media.a1&&!R.media.a2,JSON.stringify(R.media));
  ok("…another universe's are kept",R.media.b1,JSON.stringify(R.media));
  ok("the character list is re-rendered (gone, kept, hidden again)",!R.list.seedU&&R.list.seedT&&R.list.undisc,JSON.stringify(R.list));

  // a revealed play-made (quest) figure goes; one the player gave a picture stays
  await seed();
  R=await pg.evaluate(async()=>{
    const mk=(id,n,x)=>Object.assign({id,name:n,universeId:"uA",personality:"A figure connected to: Find the diver",backstory:"",goals:"",latent:true,questIds:["q1"],boundLocId:"uA_kafe"},x||{});
    state.personas.push(mk("pQ1","Diver One"),mk("pQ2","Diver Two"));
    revealPersonaUI("pQ1"); revealPersonaUI("pQ2");
    state.personas.find(p=>p.id==="pQ2").image="data:image/png;base64,AAAA";
    wipeUniverseState("uA");
    return {q1:state.personas.some(p=>p.id==="pQ1"), q2:(state.personas.find(p=>p.id==="pQ2")||{}).latent};
  });
  ok("a revealed quest figure is taken out by the reset",!R.q1,JSON.stringify(R));
  ok("…unless the player gave it a picture (kept, as found)",R.q2===false,JSON.stringify(R));

  // resetting a universe that is not open: its next chat still opens at home (first place when none is set)
  await seed();
  R=await pg.evaluate(async()=>{
    wipeUniverseState("uB");
    const flag=!!universeById("uB").landAtHome;
    enterUniverseChat("uB",true);
    const c=state.chats[state.curChat];
    return {flag, loc:c.locationId, uni:c.universeId, after:!!universeById("uB").landAtHome};
  });
  ok("a reset of a universe that is not open lands its next chat (first place when no home is set)",R.flag&&R.uni==="uB"&&R.loc==="uB_kafe"&&!R.after,JSON.stringify(R));
  // restarting the scene prunes the old chat's media
  await seed();
  R=await pg.evaluate(async()=>{
    await mediaDB.kvSet("mimg:mA1","data:x");
    window.uiChoose=async()=>"scene";
    await restartScene(); await new Promise(x=>setTimeout(x,500));
    return (await mediaDB.kvKeys()).includes("mimg:mA1");
  });
  ok("Restart scene prunes the old chat's stored images",R===false);

  // ===================================================================================================
  sec("imports snapshot after the yes, and not twice for one state");
  await seed(); await pg.waitForTimeout(300);
  R=await pg.evaluate(async()=>{
    const n=async()=>(await listAutoBackups()).length;
    await doAutoBackup({force:true}); const base=await n();
    const r={};
    // a snapshot at an unchanged revision is not repeated
    await doAutoBackup({force:true}); r.repeat=(await n())-base;
    // wrong file kind: no snapshot
    _importMode="roleplay";
    const mkFile=o=>({text:async()=>JSON.stringify(o)});
    persistPersonas(); await new Promise(x=>setTimeout(x,300));   // a new revision, so a snapshot WOULD be taken
    const b1=await n();
    await importDispatch(mkFile({app:"StoryMind",kind:"universes",universes:[]})); r.wrongKind=(await n())-b1;
    window.uiConfirm=async()=>false;
    await importDispatch(mkFile({app:"StoryMind",kind:"roleplay",universe:null,chats:{},memory:[]})); r.cancelled=(await n())-b1;
    window.uiConfirm=async()=>true;
    const realReload=location.reload; let reloaded=false;
    try{ window.setTimeout=(f=>(fn,ms,...a)=>f(ms===700?()=>{reloaded=true;}:fn,ms,...a))(window.setTimeout); }catch(e){}
    await importDispatch(mkFile({app:"StoryMind",kind:"roleplay",universe:null,chats:{},memory:[]})); r.accepted=(await n())-b1;
    return r;
  });
  ok("a forced snapshot of an unchanged state is not taken again",R.repeat===0,JSON.stringify(R));
  ok("a wrong-kind import takes no snapshot",R.wrongKind===0,JSON.stringify(R));
  ok("a cancelled import takes no snapshot",R.cancelled===0,JSON.stringify(R));
  ok("an accepted import takes one",R.accepted===1,JSON.stringify(R));
  await pg.reload(); await pg.waitForTimeout(2500);

  // ===================================================================================================
  sec("player-started generators are foreground");
  R=await pg.evaluate(()=>{
    const has=(f,s)=>{ try{ return String(f).includes(s); }catch(e){ return false; } };
    return {
      arc:has(generateQuestArc,'foreground:true'), next:has(generateNextQuest,'foreground:!!(qo&&qo.fg)'),
      writeNext:has(questDeleteUI,'{fg:true}'), travel:has(travelTo,'foreground:true'), day:has(_endDayRun,'foreground:true'),
      sug:has(fetchSuggestions,'foreground:!!fg')&&has(rerollSuggestions,'tail.mid,true'), edit:has(_aiEditPrompt,'foreground:true'),
      spawn:has(runCharQuestSpawn,'foreground:!!(opts&&opts.fg)')&&has(charQuestSpawnNowUI,'{fg:true}'), vb:has(_bkCatchUp,'foreground:!opts.live')};
  });
  ok("quest arc, Write what follows, travel, day, suggestions reroll, playground edit, spawn now, Video Book",Object.values(R).every(Boolean),JSON.stringify(R));

  // ===================================================================================================
  sec("live-call streams have an idle ceiling");
  R=await pg.evaluate(async()=>{
    const toasts=[]; window.toast=t=>toasts.push(String(t));
    VC_IDLE_MS=400;
    const never=()=>new Response(new ReadableStream({start(){}}),{status:200});
    const realFetch=window.fetch; window.fetch=async()=>never();
    state.ttsRelay="https://relay.example"; state.key=state.key||"sk-test";
    vc={turnSeq:1,ttsTurn:1,ttsQueue:[],ttsBusy:false,debug:null,summary:null,transcript:[],callee:{name:"Ayla"},_sysPrompt:"sys",orAbort:null,active:true};
    const t0=Date.now(); let threw=false;
    try{ await vcSynth("hello",1); }catch(e){ threw=true; }
    const ttsMs=Date.now()-t0;
    const t1=Date.now();
    await vcOnUserTurn("hi there");
    const chatMs=Date.now()-t1;
    const r={ttsMs,threw,chatMs,generating:vc.generating,toasts};
    window.fetch=realFetch; vc=null; VC_IDLE_MS=20000;
    return r;
  });
  ok("a stalled voice relay is dropped after the idle ceiling, with a word",R.ttsMs<3000&&!R.threw&&R.toasts.some(t=>/voice relay stalled/.test(t)),JSON.stringify(R));
  ok("a stalled call reply ends the turn after the idle ceiling, with a word",R.chatMs<3000&&R.generating===false&&R.toasts.some(t=>/reply stalled/.test(t)),JSON.stringify(R));

  // ===================================================================================================
  sec("a read-only tab's small settings write nothing");
  R=await pg.evaluate(()=>{
    const before=localStorage.getItem('sm_diaryfont'), geo=localStorage.getItem('sm_sceneDockGeo');
    const id=(DIARY_FONTS[1]||DIARY_FONTS[0]).id;
    _storageRO=true;
    try{ setDiaryFont(id); _sdSave({v:2,top:123}); }finally{}
    const r={font:localStorage.getItem('sm_diaryfont')===before, mem:diaryFont().id===id, geo:localStorage.getItem('sm_sceneDockGeo')===geo, geoMem:_sdGeo().top===123};
    _storageRO=false; _diaryFontMem=null; _sdGeoMem=null;
    return r;
  });
  ok("setDiaryFont / the dock geometry do not write from a read-only tab (kept in memory)",R.font&&R.mem&&R.geo&&R.geoMem,JSON.stringify(R));

  // ===================================================================================================
  sec("reloading the writer tab leaves read-only tabs alone");
  {
    const loads={A:0,B:0};
    const A=pg; A.on('load',()=>loads.A++);
    const B=await ctx.newPage(); B.on('pageerror',e=>errs.push("B: "+e.message)); B.on('load',()=>loads.B++);
    await B.goto(url); await B.waitForTimeout(2500);
    const role=async p=>{ try{ return await p.evaluate(()=>(!_tabReadOnly&&collectionsSafe)?"W":"RO"); }catch(e){ return "ERR"; } };
    /* (!) v150.108 — CHANGED ON PURPOSE: the window opened last saves now (tests/newest-window-saves), so B is the writer
       and A the read-only tab; the checks are the same with the roles swapped. */
    const before=[await role(A),await role(B)].join("/");
    const la=loads.A;
    await B.reload(); await B.waitForTimeout(4500);
    const after=[await role(A),await role(B)].join("/");
    ok("the writer reloads and stays the writer; the read-only tab is not reloaded",before==="RO/W"&&after==="RO/W"&&loads.A===la,JSON.stringify({before,after,loads}));
    await B.close(); await A.waitForTimeout(6500);
    ok("…and when the writer really closes, the read-only tab takes over",(await role(A))==="W"&&loads.A===la+1,JSON.stringify({role:await role(A),loads}));
  }

  ok("no page errors",errs.length===0,JSON.stringify(errs.slice(0,5)));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail?1:0);
})().catch(e=>{ console.error(e); process.exit(1); });
