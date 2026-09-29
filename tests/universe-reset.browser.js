// Universe reset + the calendar binder (v146.1).
//  · "Reset universe" is a real fresh start: the universe's chats (transcript and every per-chat engine
//    field: promises, meetings, intents…), its memories, rumours, generated relationships, play-made
//    characters, quests and chronicle go; authored cards, places, the setting and state zero stay; another
//    universe is untouched.
//  · "Restart scene" says what carries over and offers the full reset.
//  · A meeting whose "who" names a group with the player ("Emre and Özlem") binds to the real person and
//    never mints a character called "Emre and Özlem"; the clean-up removes such stubs on load.
const {chromium}=require('playwright');
const path=require('path');
(async()=>{
  const b=await chromium.launch({executablePath:process.env.SM_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await (await b.newContext()).newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  const url='file://'+path.resolve(__dirname,'..','index.html');
  await pg.goto(url); await pg.waitForTimeout(2400);
  let pass=0,fail=0; const ok=(n,c,x)=>{ if(c){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+(x?"  — "+x:""));} };

  const seed=()=>pg.evaluate(async()=>{
    const mkU=(id,user)=>({id,name:id,userName:user,setting:"A seaside town.",originDoc:"State zero.",locations:[
      {id:id+"_home",name:"Home",residents:[],sublocations:[]},{id:id+"_kafe",name:"Kafe",residents:[],sublocations:[],npcSeeded:true}],gameData:{},trackers:[],rules:[]});
    const mk=(id,n,u,x)=>Object.assign({id,name:n,universeId:u,personality:"Warm.",backstory:"Grew up here.",goals:"Open a shop.",socialGraph:"Knows everyone.",instructions:"x",style:"x",look:{},relationships:{}},x||{});
    state.universes=[mkU("uA","Emre"),mkU("uB","Mert")];
    state.personas=[mk("pOz","Özlem Özüçak","uA"),mk("pSa","Sami Özüçak","uA"),mk("pB1","Deniz","uB"),
      mk("pSeed","Kiosk Man","uA",{avatar:"🧍",backstory:"",instructions:"",image:null,origin:"seed"}),
      mk("pSeedOld","Old Guard","uA",{avatar:"🧍",backstory:"",instructions:"",image:null}),
      mk("pQ","Diver","uA",{latent:true,questIds:["q1"]}),
      {id:"pStub",universeId:"uA",name:"Emre and Özlem Özüçak",personality:"A figure connected to: Meet at the aqua park.",backstory:"",goals:"",latent:true,boundLocId:"uA_kafe",questIds:[]}];
    universeById("uA").locations[1].residents=["pSeed","pSeedOld","pStub"];
    const oz=state.personas[0]; oz.relationships={pSa:{tag:"sister"}}; oz.socialFacts={a:"b"}; oz.goalsLive="Win"; oz.socialGraphAuto="Discovered: x"; oz.questIds=["q1"];
    state.chats={
      cA:{id:"cA",universeId:"uA",messages:[{mid:"m1",role:"user",content:"hi"}],presentIds:["pOz"],gameDay:9,period:"Evening",
        promises:[{id:"pr1",holderId:"pOz",promise:"I'll keep it"}],calendar:[{id:"cal1",kind:"meeting",title:"Aqua park",who:"Emre and Özlem Özüçak",charId:"pStub",charIds:["pStub"],day:10}],
        intents:[{id:"i1"}],rel:{"a>b":{trust:40}},trackerVals:{t:5},dayLog:{day:9},worldPositions:{a:1},pendingDayEnd:{day:8},_dayEndDoneFor:8,activeEvent:{type:"x"}},
      cB:{id:"cB",universeId:"uB",messages:[{mid:"z1",role:"user",content:"other"}],promises:[{id:"prX"}],gameDay:4}};
    state.curUniverse="uA"; state.curChat="cA";
    state.memory=[{id:"mA",ownerId:"pOz",universeId:"uA",chatId:"cA",content:"remember"},{id:"mB",ownerId:"pB1",universeId:"uB",chatId:"cB",content:"other"}];
    state.gossip=[{id:"gA",universeId:"uA",stakeholderId:"pOz",status:"open"},{id:"gB",universeId:"uB",status:"open"}];
    const u=universeById("uA"); u.gameData={quests:[{id:"q1"}],charQuests:[{id:"cq"}],arcMeta:{a:{}}}; u.chronicle=[{t:"x"}]; u.chronicleEras=[{}]; u.cqAsked={a:1}; u.cqLastSpawn={day:3};
    return true;
  });

  // ---- the binder: a group "who" never becomes one person
  await seed();
  const B=await pg.evaluate(()=>{
    const c=state.chats.cA; const n0=state.personas.length;
    c.calendar.push({id:"calY",kind:"meeting",title:"Swim at Water World",who:"Emre and Özlem Özüçak",where:"Water World",_needsBind:true,day:10});
    c.calendar.push({id:"calZ",kind:"task",title:"Find the lifeguard",who:"Kemal the lifeguard",where:"Water World",_needsBind:true,day:10});
    bindPendingTasks(c);
    const y=c.calendar.find(e=>e.id==="calY"), z=c.calendar.find(e=>e.id==="calZ");
    return {meetingBound:y.charId==="pOz", made:state.personas.slice(n0).map(p=>p.name), taskFigure:(state.personas.find(p=>p.id===z.charId)||{}).name,
      split:splitNames("Emre and Özlem Özüçak"), splitTr:splitNames("Burcu ile Sami, Aslan Berk Atan"), canCanan:findByName([{name:"Canan"}],"Can")};
  });
  ok("a meeting with 'Emre and Özlem Özüçak' binds to the real Özlem",B.meetingBound,JSON.stringify(B));
  ok("…and creates nobody called 'Emre and Özlem Özüçak'",!B.made.some(n=>/ and /.test(n)),JSON.stringify(B.made));
  ok("a task naming one unknown person still gets its figure",B.taskFigure==="Kemal the lifeguard",JSON.stringify(B));
  ok("splitNames splits a group and keeps full names whole",JSON.stringify(B.split)==='["Emre","Özlem Özüçak"]'&&JSON.stringify(B.splitTr)==='["Burcu","Sami","Aslan Berk Atan"]',JSON.stringify([B.split,B.splitTr]));
  ok('findByName: "Can" is not "Canan"',B.canCanan===null);

  // ---- the clean-up on load removes the stub and re-points its plan
  await seed();
  await pg.evaluate(async()=>{ await persistUniverses(); await persistPersonas(); await persistChatsNow(); await new Promise(r=>setTimeout(r,400)); });
  await pg.reload(); await pg.waitForTimeout(2800);
  const C=await pg.evaluate(()=>({stub:!!state.personas.find(p=>p.id==="pStub"), resident:universeById("uA").locations[1].residents.includes("pStub"),
    plan:(state.chats.cA.calendar.find(e=>e.id==="cal1")||{}).charId}));
  ok("load clean-up removes the group-name stub and its residency",!C.stub&&!C.resident,JSON.stringify(C));
  ok("…and points its plan at the real Özlem",C.plan==="pOz",JSON.stringify(C));

  // ---- Reset universe
  await seed();
  const R=await pg.evaluate(async()=>{
    window.uiChoose=async()=>"reset";
    await wipeEditingUniverseMemory(); await new Promise(r=>setTimeout(r,300));
    const uA=Object.values(state.chats).filter(c=>c.universeId==="uA"); const c=uA[0]||{};
    const oz=state.personas.find(p=>p.id==="pOz"); const u=universeById("uA");
    return {n:uA.length, day:c.gameDay, msgs:(c.messages||[]).length, promises:(c.promises||[]).length, calendar:(c.calendar||[]).length, intents:(c.intents||[]).length,
      pending:c.pendingDayEnd, doneFor:c._dayEndDoneFor, ev:c.activeEvent,
      other:state.chats.cB&&state.chats.cB.messages.length===1&&state.chats.cB.promises.length===1,
      mems:state.memory.map(m=>m.id), gossip:state.gossip.map(g=>g.id),
      gone:["pSeed","pSeedOld","pQ"].filter(id=>state.personas.some(p=>p.id===id)), kept:["pOz","pSa","pB1"].every(id=>state.personas.some(p=>p.id===id)),
      oz:{rel:oz.relationships,facts:oz.socialFacts,goalsLive:oz.goalsLive,auto:oz.socialGraphAuto,q:oz.questIds,backstory:oz.backstory,goals:oz.goals,graph:oz.socialGraph},
      u:{quests:u.gameData.quests.length,cq:u.gameData.charQuests.length,chron:u.chronicle.length,cqAsked:u.cqAsked,cqLast:u.cqLastSpawn,seeded:u.locations.some(l=>l.npcSeeded),
        residents:u.locations[1].residents, setting:u.setting, origin:u.originDoc, locs:u.locations.length}};
  });
  ok("reset: the universe's chat restarts on Day 1 with an empty transcript",R.n===1&&R.day===1&&R.msgs===0,JSON.stringify(R));
  ok("reset: promises, meetings, intents, day-end markers and the event are gone",!R.promises&&!R.calendar&&!R.intents&&!R.pending&&!R.doneFor&&!R.ev,JSON.stringify(R));
  ok("reset: this universe's memories and rumours are gone; the other universe's stay",JSON.stringify(R.mems)==='["mB"]'&&JSON.stringify(R.gossip)==='["gB"]',JSON.stringify([R.mems,R.gossip]));
  ok("reset: the other universe's chat is untouched",R.other);
  ok("reset: first-visit NPCs (tagged and old) and never-met quest figures are removed",R.gone.length===0&&R.u.residents.length===0,JSON.stringify([R.gone,R.u.residents]));
  ok("reset: the authored cast stays",R.kept);
  ok("reset: generated relationships, facts, live goals and quest links are cleared",JSON.stringify(R.oz.rel)==="{}"&&JSON.stringify(R.oz.facts)==="{}"&&R.oz.goalsLive===undefined&&R.oz.auto===""&&R.oz.q.length===0,JSON.stringify(R.oz));
  ok("reset: authored card fields (backstory, goals, written social graph) are kept",R.oz.backstory==="Grew up here."&&R.oz.goals==="Open a shop."&&R.oz.graph==="Knows everyone.",JSON.stringify(R.oz));
  ok("reset: quests, character quests, the chronicle and pursuit bookkeeping are cleared",R.u.quests===0&&R.u.cq===0&&R.u.chron===0&&R.u.cqAsked===undefined&&R.u.cqLast===undefined,JSON.stringify(R.u));
  ok("reset: places are kept and first visits will seed afresh",R.u.locs===2&&!R.u.seeded&&R.u.setting==="A seaside town."&&R.u.origin==="State zero.",JSON.stringify(R.u));

  // ---- Save a copy first: the export runs before anything is wiped; a failed export resets nothing
  await seed();
  const S=await pg.evaluate(async()=>{
    const log=[]; const realExport=window.exportRoleplay;
    window.exportRoleplay=async()=>{ log.push("export:"+Object.values(state.chats).filter(c=>c.universeId==="uA").map(c=>c.messages.length).join(",")); };
    window.uiChoose=async()=>"save"; await wipeEditingUniverseMemory();
    const savedThenReset=log[0]==="export:1"&&Object.values(state.chats).filter(c=>c.universeId==="uA")[0].messages.length===0;
    await (async()=>{})();
    return {savedThenReset,log};
  });
  ok("'Save a copy first' exports the story before resetting it",S.savedThenReset,JSON.stringify(S));
  await seed();
  const F=await pg.evaluate(async()=>{
    window.exportRoleplay=async()=>{ throw new Error("disk full"); };
    window.uiChoose=async()=>"save"; await wipeEditingUniverseMemory();
    return {msgs:state.chats.cA&&state.chats.cA.messages.length, mems:state.memory.length};
  });
  ok("a failed export resets nothing",F.msgs===1&&F.mems===2,JSON.stringify(F));

  // ---- Restart scene: scene only vs full reset vs cancel
  await seed();
  const RS=await pg.evaluate(async()=>{
    const out={};
    window.uiChoose=async()=>"scene"; await restartScene();
    out.scene={msgs:Object.values(state.chats).filter(c=>c.universeId==="uA")[0].messages.length,mems:state.memory.length,gossip:state.gossip.length};
    return out;
  });
  ok("restart scene (scene only): the chat restarts, the world's memory carries on",RS.scene.msgs===0&&RS.scene.mems===2&&RS.scene.gossip===2,JSON.stringify(RS));
  await seed();
  const RF=await pg.evaluate(async()=>{ window.uiChoose=async()=>"reset"; await restartScene(); return {mems:state.memory.map(m=>m.id),gossip:state.gossip.map(g=>g.id)}; });
  ok("restart scene → fresh start resets the whole universe",JSON.stringify(RF.mems)==='["mB"]'&&JSON.stringify(RF.gossip)==='["gB"]',JSON.stringify(RF));
  await seed();
  const RC=await pg.evaluate(async()=>{ window.uiChoose=async()=>null; await restartScene(); return state.chats.cA&&state.chats.cA.messages.length; });
  ok("restart scene cancelled changes nothing",RC===1);

  ok("no page errors",errs.length===0,errs.join(" | "));
  console.log(`\n  ${pass} passed, ${fail} failed`);
  await b.close(); process.exit(fail?1:0);
})();
