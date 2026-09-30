/* v147.2 — QC report #3 (v147) §3.5 Memory and relationships.
   Every model call is stubbed (window.chatCompletion) and the prompts it receives are captured.
   Run: NODE_PATH=/path/to/node_modules node tests/qc3-memory.browser.js */
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:process.env.SM_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage({viewport:{width:412,height:915}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file://'+require('path').resolve(__dirname,'..','index.html')); await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(900);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x===undefined?c:x).slice(0,700));} };

  // One universe with Ayla/Burcu/Cem, the open chat in it; chatCompletion stubbed and recorded.
  const setup=()=>pg.evaluate(()=>{
    const uni=state.universes[0]; state.curUniverse=uni.id; uni.userName="";
    state.universes=state.universes.filter(u=>!/^u_qc3/.test(u.id));
    const mk=(id,name,u)=>({id,name,universeId:u||uni.id,instructions:"x",personality:"x",backstory:"x",style:"x",goals:"x",look:{}});
    state.personas=state.personas.filter(p=>!/^p_(ay|bu|ce|zz)$|^p2_/.test(p.id));
    state.personas.push(mk("p_ay","Ayla"),mk("p_bu","Burcu"),mk("p_ce","Cem"));
    state.user="Emre"; state.key="sk-test"; state.mem=true; state.memMinImp=0; state.condenseOn=false;
    state.autoCharOn=false; state.relOn=true; state.embedOn=false; state.narrPrivacy=true; state.histTurns=20; state.gossipOn=true;
    const chat=curChat(); chat.universeId=uni.id; chat.gameDay=4; chat.period="Evening"; chat.timeOfDay="Evening";
    chat.presentIds=["p_ay","p_bu","p_ce"]; chat.rel={}; chat.memEvent=null; chat.memDoneIdx=-1; chat.messages=[]; chat.locationId=null;
    state.memory=[];
    window.__calls=[];
    window.__reply=()=>JSON.stringify({content:"A memory "+Math.random().toString(36).slice(2,8),importance_score:0.6,charge:0.7,gist:"g"});
    window.chatCompletion=async(msgs,model,opts)=>{ const d=(opts&&opts.dbg)||""; window.__calls.push({dbg:d,text:JSON.stringify(msgs),opts:opts||{}}); return window.__reply(d,msgs); };
    return true;
  });

  // ---------------------------------------------------------------------------------------------
  console.log("\n[1. a silent listener within earshot gets a real memory, not the \"did NOT hear\" gist]");
  await setup();
  const L=await pg.evaluate(async()=>{
    const chat=curChat(); const ear=["p_ay","p_bu"];
    chat.messages.push({mid:"s0",role:"user",content:"I need to tell you — I took the money from the till.",present:ear.slice()});
    chat.messages.push({mid:"s1",role:"assistant",speaker:"Ayla",speakerId:"p_ay",content:"\"You WHAT? Emre, the owner will find out.\"",present:ear.slice()});
    chat.messages.push({mid:"s2",role:"user",content:"Keep it quiet. I'll pay it back Friday.",present:ear.slice()});
    chat.messages.push({mid:"s3",role:"assistant",speaker:"Ayla",speakerId:"p_ay",content:"\"Fine. Friday. Not a day later.\"",present:ear.slice()});
    await commitMemoryArc(chat,0,3,4,"Evening");
    const bu=window.__calls.find(c=>/Burcu/.test(c.dbg)), ce=window.__calls.find(c=>/Cem/.test(c.dbg));
    const m=state.memory.find(x=>x.ownerId==="p_bu")||{};
    // v148.4 — the listener line no longer claims "heard every line" (asides are marked; see _memAsideCue)
    return {dbg:bu&&bu.dbg,listenerFrame:!!(bu&&/in the same room, and heard the lines written out above/.test(bu.text)),notHeard:!!(bu&&/did NOT hear this/.test(bu.text)),
      secret:!!(bu&&/took the money/.test(bu.text)),type:m.type,obsOnly:!!m.observerOnly,listener:!!m.listener,charge:m.charge,cem:!!ce};
  });
  ok("Burcu (silent, in earshot) goes through the memory builder, told she heard it", L.dbg==="Memory (arc) · Burcu"&&L.listenerFrame&&!L.notHeard&&L.secret, JSON.stringify(L));
  // (!) v148.8 — CHANGED ON PURPOSE: in the same room is never an OBSERVATION; she files it like anyone there
  ok("her memory is a real one (not an OBSERVATION, not observerOnly, listener, charge kept for gossip)", L.type!=="OBSERVATION"&&!L.obsOnly&&L.listener&&L.charge===0.7, JSON.stringify(L));
  ok("Cem (not stamped on the lines) gets nothing", L.cem===false, JSON.stringify(L));
  await setup();
  const G=await pg.evaluate(async()=>{
    const chat=curChat(); const ear=["p_ay"], wide=["p_ay","p_ce"];
    // Cem is on two location-wide stamped character lines (an arrival) but on none of the player's earshot lines
    chat.messages.push({mid:"g0",role:"user",content:"So, about tonight.",present:ear.slice()});
    chat.messages.push({mid:"g1",role:"assistant",speaker:"Ayla",speakerId:"p_ay",content:"\"I found you at last.\"",present:wide.slice()});
    chat.messages.push({mid:"g2",role:"user",content:"Keep your voice down.",present:ear.slice()});
    chat.messages.push({mid:"g3",role:"assistant",speaker:"Ayla",speakerId:"p_ay",content:"\"Fine. Later, then.\"",present:wide.slice()});
    await commitMemoryArc(chat,0,3,4,"Evening");
    const ce=window.__calls.find(c=>/Cem/.test(c.dbg)); const m=state.memory.find(x=>x.ownerId==="p_ce")||{};
    return {dbg:ce&&ce.dbg,obsOnly:!!m.observerOnly};
  });
  ok("a character at the place but out of the player's earshot keeps the bystander gist", G.dbg==="Bystander gist · Cem"&&G.obsOnly, JSON.stringify(G));

  // ---------------------------------------------------------------------------------------------
  console.log("\n[2. relDeltasFrom: echoes count only beyond one step's cap (fixture table)]");
  const R=await pg.evaluate(()=>{
    const K9=REL_DIMS.map(d=>d.key);
    const z=()=>{ const o={}; K9.forEach(k=>o[k]=0); return o; };
    const run=(ans,cur,keys,cap)=>{ const r=relDeltasFrom(ans,keys||K9,k=>cur[k],cap||REL_SLOW_CAP);
      const nz={}; Object.keys(r.d).forEach(k=>{ if(r.d[k])nz[k]=r.d[k]; }); return {abs:r.absolute,d:nz}; };
    return {
      fast3042:run({desire:30,comfort:42,fear:0,agitation:0},{desire:30,comfort:40,fear:0,agitation:0},REL_FAST,REL_FAST_CAP),
      fast3042only:run({desire:30,comfort:42},{desire:30,comfort:40,fear:0,agitation:0},REL_FAST,REL_FAST_CAP),
      fastHigh:run({desire:50,comfort:62,fear:0,agitation:0},{desire:50,comfort:60,fear:0,agitation:0},REL_FAST,REL_FAST_CAP),
      fastRepeat:run({desire:30,comfort:40,fear:0,agitation:0},{desire:30,comfort:40,fear:0,agitation:0},REL_FAST,REL_FAST_CAP),
      warmDay2:run(Object.assign(z(),{familiarity:10,affection:10,desire:12,comfort:5}),Object.assign(z(),{familiarity:10,affection:10,desire:12})),
      betrayal2:run(Object.assign(z(),{trust:-25,affection:-25,respect:-25}),Object.assign(z(),{trust:-25,affection:-25,respect:-25})),
      betrayal2b:run(Object.assign(z(),{trust:-25,affection:-22,respect:-25,comfort:-10}),Object.assign(z(),{trust:-25,affection:-25,respect:-25})),
      established:run(Object.assign(z(),{trust:-25,affection:-15,respect:-10}),Object.assign(z(),{trust:60,affection:70,respect:40,familiarity:80})),
      negLevels:run(Object.assign(z(),{trust:-40,affection:-28,respect:-20}),Object.assign(z(),{trust:-40,affection:-30,respect:-20})),
      nearCeil:run(Object.assign(z(),{trust:100,affection:92,respect:90}),Object.assign(z(),{trust:95,affection:90,respect:88})),
      fearDrop:run(Object.assign(z(),{trust:40,affection:50,respect:30,fear:0}),Object.assign(z(),{trust:40,affection:50,respect:30,fear:15})),
      bigAlone:run(Object.assign(z(),{trust:-65}),Object.assign(z(),{trust:-80,affection:40})),
      newBond:run(Object.assign(z(),{familiarity:22,trust:15,affection:6}),Object.assign(z(),{familiarity:20,trust:15})),
    }; });
  ok("fast read {desire 30, comfort 42} on 30/40 is levels (comfort past the cap echoes): +0/+2", R.fast3042.abs&&JSON.stringify(R.fast3042.d)==='{"comfort":2}'&&R.fast3042only.abs, JSON.stringify(R));
  ok("fast read two levels past the cap ({50,62} on 50/60) converts", R.fastHigh.abs&&JSON.stringify(R.fastHigh.d)==='{"comfort":2}', JSON.stringify(R.fastHigh));
  ok("fast read repeating a legal +30/+40 on 30/40 stays a change", !R.fastRepeat.abs&&R.fastRepeat.d.desire===30&&R.fastRepeat.d.comfort===40, JSON.stringify(R.fastRepeat));
  ok("day 2 warm day (deltas equal to yesterday's levels) stays deltas", !R.warmDay2.abs&&R.warmDay2.d.familiarity===10&&R.warmDay2.d.desire===12, JSON.stringify(R.warmDay2));
  ok("a second betrayal (−25 on axes at −25) moves −25 again, not \"unchanged\"", !R.betrayal2.abs&&R.betrayal2.d.trust===-25&&R.betrayal2.d.respect===-25&&!R.betrayal2b.abs, JSON.stringify([R.betrayal2,R.betrayal2b]));
  ok("established bond betrayal deltas stay deltas", !R.established.abs&&R.established.d.trust===-25, JSON.stringify(R.established));
  ok("negative levels past the cap echo → converted (trust 0, affection +2)", R.negLevels.abs&&JSON.stringify(R.negLevels.d)==='{"affection":2}', JSON.stringify(R.negLevels));
  ok("levels near the ceiling convert; fear answered 0 is unchanged", R.nearCeil.abs&&R.nearCeil.d.affection===2&&R.fearDrop.abs&&!Object.keys(R.fearDrop.d).length, JSON.stringify([R.nearCeil,R.fearDrop]));
  ok("one big number alone is a big (clamped) change; a new bond's small levels read as changes", !R.bigAlone.abs&&R.bigAlone.d.trust===-25&&!R.newBond.abs, JSON.stringify([R.bigAlone,R.newBond]));

  // ---------------------------------------------------------------------------------------------
  console.log("\n[3. retrieval after the player opened another universe mid-turn]");
  await setup();
  const V=await pg.evaluate(async()=>{
    const u1=state.universes[0]; state.key=""; state.memRecentCount=3;
    const chatA=curChat(); chatA.gameDay=5; chatA.presentIds=["p_ay"];
    chatA.messages=[{mid:"a1",role:"user",content:"Did Kerem pay you back?",present:["p_ay"]}];
    state.memory=[1,2,3,4].map(i=>({id:"k"+i,ownerId:"p_ay",character:"Ayla",type:"EXPERIENCE",source:"auto",content:"Kerem owes me money, debt number "+i,gameDay:i,gamePeriod:"Morning",universeId:u1.id,chatId:chatA.id,importance:0.6,tags:[]}));
    const before=(await retrieveMemories("Did Kerem pay you back?",chatA,"p_ay")).recent.length;
    const keepU=state.curUniverse, keepC=state.curChat;
    const u2={id:"u_qc3_other",name:"Other",setting:"",locations:[],userName:"Deniz"}; state.universes.push(u2);
    state.personas.push({id:"p_zz",name:"Zeynep",universeId:u2.id,instructions:"x",personality:"x",backstory:"x",style:"x",goals:"x",look:{}});
    const cB={id:"c_qc3_b",universeId:u2.id,messages:[],gameDay:1,presentIds:["p_zz"]}; state.chats[cB.id]=cB;
    state.curUniverse=u2.id; state.curChat=cB.id; state.user="Deniz";
    const after=(await retrieveMemories("Did Kerem pay you back?",chatA,"p_ay")).recent.length;
    const vis=visibleMemories(chatA).length, visOpen=visibleMemories().length;
    state.curUniverse=keepU; state.curChat=keepC; state.user="Emre"; delete state.chats[cB.id]; state.key="sk-test";
    return {before,after,vis,visOpen};
  });
  ok("the chat's character still retrieves their memories (visibleMemories(chat))", V.before===3&&V.after===3&&V.vis===4&&V.visOpen===0, JSON.stringify(V));

  // ---------------------------------------------------------------------------------------------
  console.log("\n[4. the day-end relationship-sheet rewrite: this story's player, background]");
  await setup();
  const S=await pg.evaluate(async()=>{
    const u1=state.universes[0]; u1.userName="Emre"; u1.userBio="A tired ferry captain.";
    const chat=curChat(); const p=state.personas.find(x=>x.id==="p_ay");
    p.relationshipsGen="(old)"; p.relationships={__user__:{tie:"neighbour",relationship:"x"}};
    chat.rel={}; const o=relObj(chat,"p_ay","__user__"); o.desc="She trusts him with her keys."; o.bigMoveDay=4;
    // the player has since opened another universe
    const u2={id:"u_qc3_two",name:"Two",setting:"",locations:[],userName:"Mert"}; state.universes.push(u2);
    const keepU=state.curUniverse; state.curUniverse=u2.id; state.user="Mert"; state.userBio="A radio host.";
    window.__reply=(d)=>/Relationship generator/.test(d)?JSON.stringify({Emre:{tie:"husband",relationship:"married ten years"}}):"{}";
    await reEvaluateRelationshipsForDay(chat,4,[{role:"assistant",speaker:"Ayla",speakerId:"p_ay",content:"x"}]);
    const c=window.__calls.find(x=>/Relationship generator/.test(x.dbg))||{text:"",opts:{}};
    state.curUniverse=keepU; state.user="Emre"; state.userBio=""; u1.userName=""; delete u1.userBio;
    return {called:!!c.dbg,emre:/THE PLAYER: Emre/.test(c.text),bio:/ferry captain/.test(c.text),mert:/Mert|radio host/.test(c.text),
      opinion:/trusts him with her keys/.test(c.text),fg:!!c.opts.foreground,tie:(p.relationships.__user__||{}).tie};
  });
  ok("the sheet is written for Emre (the chat's player and bio), never Mert", S.called&&S.emre&&S.bio&&!S.mert, JSON.stringify(S));
  ok("opinions come from the chat passed in; the player's tie matched by that name", S.opinion&&S.tie==="husband", JSON.stringify(S));
  ok("it is background work (no foreground flag)", S.fg===false, JSON.stringify(S));

  // ---------------------------------------------------------------------------------------------
  console.log("\n[5. a phone call's memory is committed without touching the live transcript]");
  await setup();
  const C=await pg.evaluate(async()=>{
    const chat=curChat(); chat.presentIds=[]; chat.messages=[{mid:"o1",role:"user",content:"earlier",present:[]}];
    const live=chat.messages; let during=null;
    window.chatCompletion=async(m,mo,o)=>{ await new Promise(r=>setTimeout(r,250)); return JSON.stringify({content:"The call with Emre about Friday.",importance_score:0.6}); };
    const callee=state.personas.find(p=>p.id==="p_ay");
    const pr=commitCallMemory(callee,[{role:"user",content:"Hi Ayla QC3CALL"},{role:"assistant",content:"Hey Emre QC3CALL"}]);
    await new Promise(r=>setTimeout(r,80));
    chat.messages.push({mid:"typed",role:"user",content:"typed while the call memory was being written",present:[]});
    during={sameArray:chat.messages===live,hasCall:JSON.stringify(chat.messages).indexOf("QC3CALL")>=0,present:(chat.presentIds||[]).slice()};
    await pr;
    return {mids:chat.messages.map(m=>m.mid),during,sameArray:chat.messages===live,mem:(state.memory.find(x=>x.ownerId==="p_ay")||{}).content,present:chat.presentIds};
  });
  ok("a message typed during the commit survives", C.mids.join(",")==="o1,typed"&&C.sameArray, JSON.stringify(C));
  ok("the live chat never carries the call transcript (a save in the window cannot store it)", C.during.sameArray&&!C.during.hasCall&&C.during.present.length===0&&C.present.length===0, JSON.stringify(C));
  ok("the callee still gets the call memory", /call with Emre/.test(C.mem||""), JSON.stringify(C));

  // ---------------------------------------------------------------------------------------------
  console.log("\n[6. heat aftermath: the right character, prose only]");
  await setup();
  const H=await pg.evaluate(async()=>{
    const u1=state.universes[0]; const c=curChat();
    const u2={id:"u_qc3_h",name:"H",setting:"",locations:[],userName:"Mert"}; state.universes.push(u2);
    // a same-named Ayla in another universe, listed FIRST
    state.personas.unshift({id:"p2_ayla",name:"Ayla",universeId:u2.id,instructions:"x",personality:"x",backstory:"x",style:"x",goals:"x",look:{}});
    const me=state.personas.find(p=>p.id==="p_ay"); delete me.afterHeat; delete me.afterHeatBy;
    c.presentIds=["p_ay"];
    const beats=[{mid:"h2",role:"assistant",speaker:"Ayla",speakerId:"p_ay",heatBeat:true,present:["p_ay"],content:'*Kisses him.* "Stay."'}];
    const res={};
    for(const [k,ans] of [["empty","{}"],["trunc",'{"x":'],["short","Fine."]]){
      window.__reply=()=>ans; state.memory=[];
      res[k]={ok:await _afterHeatFor(c,"Ayla",beats,4,"Evening"),mems:state.memory.length,card:!!me.afterHeat};
    }
    window.__reply=()=>"You told yourself it meant nothing, and you already know that is a lie you will keep telling.";
    state.memory=[];
    await _afterHeatFor(c,"Ayla",beats,4,"Evening");
    const m=state.memory.find(x=>x.source==="after_heat")||{};
    window.__reply=()=>JSON.stringify({text:"You decided it cannot happen again, and you do not believe yourself."});
    state.memory=[]; await _afterHeatFor(c,"Ayla",beats,4,"Evening");
    const mj=state.memory.find(x=>x.source==="after_heat")||{};
    const other=state.personas.find(p=>p.id==="p2_ayla");
    state.personas=state.personas.filter(p=>p.id!=="p2_ayla");
    return {res,owner:m.ownerId,uni:m.universeId,right:!!me.afterHeat,wrong:!!other.afterHeat,json:mj.content||""};
  });
  ok("\"{}\", a cut-off '{\"x\":' and a one-word answer are not stored", ["empty","trunc","short"].every(k=>H.res[k].mems===0&&!H.res[k].card), JSON.stringify(H.res));
  ok("the reckoning lands on this universe's Ayla (by speakerId), not the same-named one listed first", H.owner==="p_ay"&&H.right&&!H.wrong, JSON.stringify(H));
  ok("a JSON answer gives up its text field", /cannot happen again/.test(H.json), JSON.stringify(H));

  // ---------------------------------------------------------------------------------------------
  console.log("\n[7. lows: importance scale, query names, rupture, relPeek, gossip privacy, doneTo]");
  await setup();
  const I=await pg.evaluate(()=>{
    const set=a=>{ const sc=memImpScale(a); return a.map(x=>+memImpNorm(x,-1,sc).toFixed(2)).join(","); };
    return {a:set([4,1]),b:set([4,2,1]),c:set([8,1]),d:set([80,1]),e:set([1,1]),f:set([0.9,3]),g:set([5,5])}; });
  ok("an exact 1 inside a detected scale is rescaled ({4,1}→0.8,0.2; {8,1}→0.8,0.1; {80,1}→0.8,0.01)", I.a==="0.8,0.2"&&I.b==="0.8,0.4,0.2"&&I.c==="0.8,0.1"&&I.d==="0.8,0.01", JSON.stringify(I));
  ok("…and on-contract answers are untouched ({1,1}, {0.9,3}, {5,5})", I.e==="1,1"&&I.f==="0.9,0.3"&&I.g==="1,1", JSON.stringify(I));

  const Q=await pg.evaluate(async()=>{
    const chat=curChat(); chat.presentIds=["p_ay"]; chat.messages=[{mid:"q1",role:"user",content:"Hey.",present:["p_ay"]}];
    state.memory=[{id:"qq",ownerId:"p_ay",character:"Ayla",type:"EXPERIENCE",source:"auto",content:"Kerem owes me money",gameDay:1,gamePeriod:"Morning",universeId:chat.universeId,chatId:chat.id,importance:0.5,tags:[]}];
    const strip=_memStripNames("Emre asks Ayla about Kerem's debt; Emre'nin sözü, Ayla Yılmaz",["Emre","Ayla Yılmaz"]);
    let embedded=null; const realE=window.embedText; window.embedText=async(q)=>{ embedded=q; return null; };
    window.__reply=(d)=>/query generator/i.test(d)?"Emre Ayla Kerem debt money":"{}";
    try{ await retrieveMemories("Did he pay?",chat,"p_ay"); } finally { window.embedText=realE; }
    let onlyNames=null; window.embedText=async(q)=>{ onlyNames=q; return null; };
    window.__reply=(d)=>/query generator/i.test(d)?"Emre, Ayla":"{}";
    try{ await retrieveMemories("Did he pay?",chat,"p_ay"); } finally { window.embedText=realE; }
    return {strip,embedded,onlyNames};
  });
  ok("_memStripNames drops the player's and the owner's names (with suffixes and first names)", Q.strip==="asks about Kerem's debt; sözü,", JSON.stringify(Q));
  ok("retrieval embeds the keyword line without those names; a names-only line falls back to the inline text", Q.embedded==="Kerem debt money"&&/Did he pay\?/.test(Q.onlyNames||""), JSON.stringify(Q));

  const RU=await pg.evaluate(async()=>{
    const chat=curChat(); state.memory=[]; chat.presentIds=["p_ay","p_bu"]; chat.messages=[{mid:"r1",role:"user",content:"Hi",present:["p_ay","p_bu"]}];
    const mkEv=(extra)=>Object.assign({kind:"confrontation",accuserId:"p_bu",accuserName:"Burcu",intent:"the pier",conviction:0.95,floor:0.1,ceiling:1,turn:1,maxTurns:6,minTurns:2,
      participant:{charId:"p_bu",name:"Burcu",approaching:false},_startMsg:0},extra||{});
    window.__reply=(d)=>/Scene writer|scene/i.test(d)?JSON.stringify({beat:"Burcu folds her arms.",resolved:false}):"{}";
    const out={}; const real=window.resolveActiveEvent; let resolvedCalls=0;
    window.resolveActiveEvent=async(c)=>{ resolvedCalls++; c.activeEvent=null; };
    try{
      chat.activeEvent=mkEv(); await runSceneWriter(chat);
      out.noJudge={resolved:resolvedCalls,outcome:(chat.activeEvent||{})._outcome||null,open:!!chat.activeEvent};
      resolvedCalls=0; chat.activeEvent=mkEv({_lastJudge:{delta:0.1,reason:"evasive"}}); const ev=chat.activeEvent; await runSceneWriter(chat);
      out.judged={resolved:resolvedCalls,outcome:ev._outcome||null};
    } finally { window.resolveActiveEvent=real; chat.activeEvent=null; }
    return out;
  });
  ok("a confrontation opened at 0.95 does not rupture before a judged player turn (the judge answered nothing usable)", RU.noJudge.resolved===0&&RU.noJudge.outcome!=="rupture", JSON.stringify(RU));
  ok("after a judged turn the 0.9 shortcut still resolves it as rupture", RU.judged.outcome==="rupture", JSON.stringify(RU));

  const P=await pg.evaluate(async()=>{
    const chat=curChat(); chat.rel={}; chat.presentIds=["p_ay","p_bu","p_ce"];
    chat.messages=[{mid:"p1",role:"user",content:"Hey.",present:["p_ay","p_bu"]}];
    try{ relOverview(chat); }catch(e){}
    try{ await retrieveMemories("Hey.",chat,"p_ay"); }catch(e){}
    try{ _pulseTie(chat,state.personas.find(p=>p.id==="p_ay"),state.personas.find(p=>p.id==="p_bu")); }catch(e){}
    try{ _cutScore(chat,state.personas.find(p=>p.id==="p_ce")); }catch(e){}
    const src=[estimateAttendance,meetingBackstory,maybeProactiveText,runWorldRound,runGoalPursuit,runSceneCut,runOffstageInteraction,openStoryState].map(f=>String(f));
    return {keys:Object.keys(chat.rel),writerFree:src.every(s=>!/relObj\(/.test(s))};
  });
  ok("reading (relOverview, retrieval, pulse tie, scene-cut score) creates no relationship records", P.keys.length===0, JSON.stringify(P));
  ok("the other read-only sites read through relPeek", P.writerFree, JSON.stringify(P));

  const GS=await pg.evaluate(async()=>{
    const chat=curChat(); const u=chatUni(chat);
    const loc={id:"l_qc3_bar",name:"QC Bar",type:"public",gossipChance:1,residents:["p_ce"],description:"a bar",
      sublocations:[{id:"s_ent",name:"Entrance",entrance:true},{id:"s_back",name:"Back room",gossipMult:0}]};
    u.locations=(u.locations||[]).filter(l=>l.id!==loc.id).concat([loc]);
    const realR=Math.random; Math.random=()=>0;
    const run=async(msgs,exitSub)=>{ chat.messages=msgs; window.__calls=[]; state.memory=[];
      window.__reply=(d)=>/Location gossip/.test(d)?JSON.stringify({content:"People say Emre was at the bar.",gist:"at the bar",charge:0.6,importance:0.5}):"{}";
      await runLocationGossipLeak(chat,loc,exitSub);
      const c=window.__calls.find(x=>/Location gossip/.test(x.dbg)); return {called:!!c,text:c?c.text:""}; };
    const pres=["p_ay"];
    const privateThenExit=await run([
      {mid:"t0",role:"assistant",speaker:"Narrator",narratorEvent:true,travelBeat:true,content:"They arrive at the bar.",present:pres},
      {mid:"n1",role:"assistant",speaker:"Narrator",presenceNote:true,subTo:"s_back",content:"Emre moves to the Back room"},
      {mid:"b1",role:"user",content:"BACKSECRET one",present:pres},{mid:"b2",role:"assistant",speaker:"Ayla",speakerId:"p_ay",content:"\"BACKSECRET two\"",present:pres},
      {mid:"b3",role:"user",content:"BACKSECRET three",present:pres},
      {mid:"n2",role:"assistant",speaker:"Narrator",presenceNote:true,subTo:"s_ent",content:"Emre moves to the Entrance"}],"s_ent");
    const floorThenBack=await run([
      {mid:"t0",role:"assistant",speaker:"Narrator",narratorEvent:true,travelBeat:true,content:"They arrive at the bar.",present:pres},
      {mid:"f1",role:"user",content:"FLOORTALK one",present:pres},{mid:"f2",role:"assistant",speaker:"Ayla",speakerId:"p_ay",content:"\"FLOORTALK two\"",present:pres},
      {mid:"n1",role:"assistant",speaker:"Narrator",presenceNote:true,subTo:"s_back",content:"Emre moves to the Back room"},
      {mid:"b1",role:"user",content:"BACKSECRET one",present:pres},{mid:"b2",role:"assistant",speaker:"Ayla",speakerId:"p_ay",content:"\"BACKSECRET two\"",present:pres}],"s_back");
    Math.random=realR; u.locations=u.locations.filter(l=>l.id!==loc.id);
    return {privateThenExit:privateThenExit.called,floorCalled:floorThenBack.called,floorHas:/FLOORTALK/.test(floorThenBack.text),floorLeaksBack:/BACKSECRET/.test(floorThenBack.text)};
  });
  ok("a conversation held in a ×0 back room leaks nothing though the player left from the entrance", GS.privateThenExit===false, JSON.stringify(GS));
  ok("talk on the floor can leak after a last minute in the back room — without the back-room lines", GS.floorCalled&&GS.floorHas&&!GS.floorLeaksBack, JSON.stringify(GS));

  await setup();
  const D=await pg.evaluate(async()=>{
    const chat=curChat(); const ALL=["p_ay","p_bu","p_ce"]; const NM={p_ay:"Ayla",p_bu:"Burcu",p_ce:"Cem"};
    let n=0; const push=k=>{ for(let i=0;i<k;i++){ const u=(n%2===0); const sp=["p_ay","p_bu","p_ce"][Math.floor(n/2)%3];
      chat.messages.push(u?{mid:"m"+n,role:"user",content:"Line "+n+" about topic "+n,present:ALL.slice()}:{mid:"m"+n,role:"assistant",speaker:NM[sp],speakerId:sp,content:"\"Reply "+n+" on subject "+n+"\"",present:ALL.slice()}); n++; } };
    let fail=new Set();
    window.__reply=(d)=>{ if(/arc tracker/.test(d))return JSON.stringify({progress:"finished",topic:"same",summary:"s"});
      const who=Object.values(NM).find(x=>d.indexOf(x)>=0); if(fail.has(who))return "not json";
      return JSON.stringify({content:"Memory "+Math.random().toString(36).slice(2,9)+" "+Math.random().toString(36).slice(2,9)+" unique "+Math.random(),importance_score:0.5}); };
    push(6); fail=new Set(["Burcu"]); await maybeBuildMemory(chat);
    const dt=JSON.stringify(chat.memEvent&&chat.memEvent.doneTo);
    chat.messages.splice(1,1);   // the player deletes an earlier message: every index after it shifts
    push(6); fail=new Set(); await maybeBuildMemory(chat);
    const cover={}; ALL.forEach(id=>{ const cnt={}; state.memory.filter(m=>m.ownerId===id).forEach(m=>(m.srcMids||[]).forEach(s=>cnt[s]=(cnt[s]||0)+1));
      const lines=chat.messages.map(m=>m.mid); cover[NM[id]]={missing:lines.filter(x=>!cnt[x]).join(","),dups:Object.keys(cnt).filter(k=>cnt[k]>1).join(",")}; });
    return {dt,cover};
  });
  ok("doneTo records mids", /"p_ay":"m5"/.test(D.dt||""), JSON.stringify(D));
  ok("after a deletion the retry gives every character each remaining line exactly once", Object.values(D.cover).every(c=>!c.missing&&!c.dups), JSON.stringify(D.cover));

  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail?1:0);
})();
