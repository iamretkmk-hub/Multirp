/* v146.1 — QC report #2 (v145) §1 High #1 and §4.5 Memory and relationships.
   Every model call is stubbed (window.chatCompletion) and the prompts it receives are captured.
   Run: NODE_PATH=/path/to/node_modules node tests/qc2-memory.browser.js */
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:process.env.SM_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage({viewport:{width:412,height:915}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file://'+require('path').resolve(__dirname,'..','index.html')); await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(900);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x===undefined?c:x).slice(0,600));} };

  await pg.evaluate(()=>{
    const uni=state.universes[0]; state.curUniverse=uni.id;
    const mk=(id,name,extra)=>Object.assign({id,name,universeId:uni.id,instructions:"x",personality:"x",backstory:"x",style:"x",goals:"x",look:{}},extra||{});
    state.personas=state.personas.filter(p=>!["p_ay","p_bu","p_ce","p_x"].includes(p.id));
    state.personas.push(mk("p_ay","Ayla"),mk("p_bu","Burcu"),mk("p_ce","Cem"));
    state.user="Emre"; state.key="sk-test"; state.mem=true; state.memMinImp=0; state.condenseOn=false;
    state.autoCharOn=false; state.relOn=true; state.embedOn=false; state.narrPrivacy=true; state.histTurns=20;
    const chat=curChat(); chat.universeId=uni.id; chat.gameDay=4; chat.period="Afternoon"; chat.timeOfDay="Afternoon";
    chat.presentIds=["p_ay","p_bu","p_ce"]; chat.rel={}; chat.memEvent=null; chat.memDoneIdx=-1; chat.messages=[];
    state.memory=[];
    window.__calls=[];
    window.__reply=()=>JSON.stringify({content:"A memory "+Math.random().toString(36).slice(2,8),importance_score:0.5});
    window.chatCompletion=async(msgs,model,opts)=>{ const d=(opts&&opts.dbg)||""; window.__calls.push({dbg:d,text:JSON.stringify(msgs)}); return window.__reply(d,msgs); };
  });

  // ---------------------------------------------------------------------------------------------
  console.log("\n[1. relDeltasFrom: a big number is a big change, not a level]");
  const rd=await pg.evaluate(()=>{
    const keys=REL_DIMS.map(d=>d.key);
    const zeros=()=>{ const o={}; keys.forEach(k=>o[k]=0); return o; };
    const cur=Object.assign(zeros(),{affection:70,trust:55,respect:40,familiarity:80,desire:30,comfort:45});
    const run=(ans,c,kk,cap)=>relDeltasFrom(ans,kk||keys,k=>c[k],cap||REL_SLOW_CAP);
    const betrayal=run(Object.assign(zeros(),{trust:-70,affection:-20,respect:-15}),cur);
    const hostile=run(Object.assign(zeros(),{trust:-65}),Object.assign({},cur,{trust:-80}));
    const fc={desire:10,comfort:50,fear:0,agitation:20};
    const fast=run({desire:70,comfort:10,fear:0,agitation:-5},fc,REL_FAST,REL_FAST_CAP);
    const echoAns=Object.assign(zeros(),{affection:72,trust:55,respect:38,familiarity:80,desire:30,comfort:45});
    const echo=run(echoAns,cur);
    const allZero=run(zeros(),cur);
    const strings=run(Object.assign(zeros(),{trust:"-12",affection:"+8",respect:"−30",comfort:" "}),cur);
    return {betrayal,hostile,fast,echo,allZero,strings}; });
  const D=r=>JSON.stringify(r);
  ok("betrayal (trust −70, others 0): trust −25, affection −20, respect −15, the rest untouched",
    rd.betrayal.d.trust===-25&&rd.betrayal.d.affection===-20&&rd.betrayal.d.respect===-15&&rd.betrayal.d.familiarity===0&&rd.betrayal.d.desire===0&&rd.betrayal.d.comfort===0&&rd.betrayal.absolute===false&&rd.betrayal.big===true, D(rd.betrayal));
  ok("already hostile: trust −65 against −80 is −25, never +15", rd.hostile.d.trust===-25&&rd.hostile.absolute===false, D(rd.hostile));
  ok("intimate fast read {desire:70, comfort:10}: desire +40 (the cap), comfort +10", rd.fast.d.desire===40&&rd.fast.d.comfort===10&&rd.fast.d.agitation===-5&&rd.fast.absolute===false, D(rd.fast));
  ok("a true absolute (echo) answer converts every key to the change it meant", rd.echo.absolute===true&&rd.echo.d.affection===2&&rd.echo.d.respect===-2&&rd.echo.d.trust===0&&rd.echo.d.familiarity===0, D(rd.echo));
  ok("an all-zero answer changes nothing", Object.values(rd.allZero.d).every(v=>v===0)&&rd.allZero.absolute===false, D(rd.allZero));
  ok("string numbers (−, +, Unicode minus) are read; a blank string is not a number", rd.strings.d.trust===-12&&rd.strings.d.affection===8&&rd.strings.d.respect===-25&&!("comfort" in rd.strings.d), D(rd.strings));

  ok("the daily read applies a betrayal to trust only (end to end)", await pg.evaluate(async()=>{
    const chat=curChat(); chat.rel={}; const ay=state.personas.find(p=>p.id==="p_ay"); ay.relationships={};
    const o=relObj(chat,"p_ay","__user__"); Object.assign(o,{affection:70,trust:55,respect:40,familiarity:80,desire:30,comfort:45});
    window.__reply=()=>JSON.stringify({trust:-70,affection:0,respect:0,familiarity:0,jealousy:0,desire:0,comfort:0,fear:0,agitation:0,description:"Betrayed."});
    await evalRelationship(chat,ay,"__user__","Emre",[],[],4);
    return (o.trust===30&&o.affection===70&&o.respect===40&&o.familiarity===80&&o.comfort===45) ? true : JSON.stringify(o); }));

  // ---------------------------------------------------------------------------------------------
  console.log("\n[2. a partly failed arc is retried per character]");
  const pr=await pg.evaluate(async()=>{
    const chat=curChat(); state.memory=[]; const A=["p_ay","p_bu"]; chat.presentIds=A.slice();
    const line=(i,t)=>({mid:"r"+i,role:i%2?"assistant":"user",speaker:i%2?(i%4===1?"Ayla":"Burcu"):undefined,speakerId:i%2?(i%4===1?"p_ay":"p_bu"):undefined,content:"\""+t+" "+i+"\"",present:A.slice()});
    chat.messages=[]; for(let i=0;i<6;i++)chat.messages.push(line(i,"the harbour and the boat"));
    chat.memEvent=null; chat.memDoneIdx=-1; _memBuildSeen.delete(chat);
    let failBurcu=true; const prompts={};
    window.__reply=(d,msgs)=>{ if(/arc tracker/.test(d))return JSON.stringify({progress:"finished",topic:"same",summary:"s"});
      if(/Burcu/.test(d)&&failBurcu)return "not json";
      prompts[d]=JSON.stringify(msgs);
      const txt=JSON.stringify(msgs); return JSON.stringify({content:/money fight/.test(txt)?"Kerem still owes money and we fought about it.":"We sat by the harbour watching the boats.",importance_score:0.5}); };
    await maybeBuildMemory(chat);
    const ev1=chat.memEvent&&{open:chat.memEvent.open,fails:chat.memEvent.fails,doneTo:chat.memEvent.doneTo};
    for(let i=6;i<12;i++)chat.messages.push(line(i,"the money fight, Kerem owes"));
    failBurcu=false; Object.keys(prompts).forEach(k=>delete prompts[k]);
    await maybeBuildMemory(chat);
    const mems=state.memory.map(m=>({who:m.ownerId,src:m.srcMids||[]}));
    return {ev1,mems,done:chat.memDoneIdx,ev2:chat.memEvent,aylaPrompt:prompts["Memory (arc) · Ayla"]||""}; });
  const ayMems=pr.mems.filter(m=>m.who==="p_ay"), buMems=pr.mems.filter(m=>m.who==="p_bu");
  ok("after the partial failure the arc stays open, and records that Ayla's part is done (v147.2: by mid)", !!pr.ev1&&pr.ev1.open&&pr.ev1.fails===1&&pr.ev1.doneTo&&pr.ev1.doneTo.p_ay==="r5"&&!("p_bu" in pr.ev1.doneTo), JSON.stringify(pr.ev1));
  ok("Ayla (whose memory landed) remembers what came after: a second memory of r6..r11 only",
    ayMems.length===2&&ayMems[1].src[0]==="r6"&&ayMems[1].src.indexOf("r11")>=0&&ayMems[1].src.indexOf("r1")<0, JSON.stringify(ayMems));
  ok("her retry prompt carries only the new lines", /money fight/.test(pr.aylaPrompt)&&!/harbour/.test(pr.aylaPrompt), pr.aylaPrompt.slice(0,300));
  ok("Burcu (who failed) gets the whole span", buMems.length===1&&buMems[0].src[0]==="r0"&&buMems[0].src.indexOf("r11")>=0, JSON.stringify(buMems));
  ok("the arc is closed after the retry", pr.done===11&&!pr.ev2, JSON.stringify({done:pr.done,ev:pr.ev2}));

  const mf=await pg.evaluate(async()=>{
    const chat=curChat(); state.memory=[]; const A=["p_ay"]; chat.presentIds=A.slice();
    chat.messages=[]; chat.memEvent=null; chat.memDoneIdx=-1; _memBuildSeen.delete(chat);
    window.__reply=d=>/arc tracker/.test(d)?JSON.stringify({progress:"finished",topic:"same",summary:"s"}):"not json";
    const seen=[]; let n=0;
    const add=()=>{ chat.messages.push({mid:"f"+(n++),role:"user",content:"line "+n,present:A.slice()},{mid:"f"+(n++),role:"assistant",speaker:"Ayla",speakerId:"p_ay",content:"\"reply "+n+"\"",present:A.slice()}); };
    for(let k=0;k<3;k++){ add(); await maybeBuildMemory(chat); seen.push(chat.memEvent?{open:true,fails:chat.memEvent.fails}:{open:false,done:chat.memDoneIdx}); }
    return {seen,max:MEM_ARC_MAX_FAILS}; });
  ok("MEM_ARC_MAX_FAILS=2: held open after the 1st and 2nd failure, let go on the 3rd",
    mf.max===2&&mf.seen[0].open&&mf.seen[0].fails===1&&mf.seen[1].open&&mf.seen[1].fails===2&&!mf.seen[2].open&&mf.seen[2].done===5, JSON.stringify(mf));

  // ---------------------------------------------------------------------------------------------
  console.log("\n[3. the condenser counts only what it can merge; glimpses have their own cap]");
  const cd=await pg.evaluate(async()=>{
    const chat=curChat(); chat.gameDay=10; chat.period="Evening";
    state.condenseOn=true; state.memMaxBeforeCondense=50; state.memCondenseStart=30;
    const P=["Morning","Midday","Afternoon","Evening"];
    const real=(i,day)=>({id:"e"+i,ownerId:"p_ay",character:"Ayla",type:"EXPERIENCE",source:"auto",content:"Emre and I cooked dinner in the kitchen and talked about work "+i,gameDay:day,gamePeriod:P[i%4],importance:0.4,tags:[]});
    const glimpse=i=>({id:"g"+i,ownerId:"p_ay",character:"Ayla",type:"OBSERVATION",observerOnly:true,source:"auto",content:"I watched Burcu and Cem argue across the room "+i,gameDay:9+(i%2),gamePeriod:"Morning",importance:0.3,tags:[]});
    let calls=0; window.__reply=d=>{ if(/condense/i.test(d)){ calls++; return JSON.stringify([{content:"Merged: Emre and I often cooked dinner together.",importance:0.5}]); } return "{}"; };
    // (a) the audit probe: 20 real experiences + 35 glimpses (+ rumours, manual, superseded) — nothing mergeable is over the line
    state.memory=[]; for(let i=0;i<20;i++)state.memory.push(real(i,1+Math.floor(i/3)));
    for(let i=0;i<35;i++)state.memory.push(glimpse(i));
    for(let i=0;i<4;i++)state.memory.push({id:"man"+i,ownerId:"p_ay",type:"EXPERIENCE",source:"manual",content:"hand note "+i,gameDay:9,gamePeriod:"Morning"});
    for(let i=0;i<4;i++)state.memory.push({id:"sup"+i,ownerId:"p_ay",type:"DECISION",superseded:true,content:"old decision "+i,gameDay:9,gamePeriod:"Morning"});
    await maybeCondenseMemories("p_ay","Ayla",chat);
    const a={calls,real:state.memory.filter(m=>m.type==="EXPERIENCE"&&m.source==="auto").length,lt:state.memory.filter(m=>m.type==="LONGTERM").length};
    // (b) 60 real experiences + 35 glimpses: condenses, and the newest 30 real ones are protected
    calls=0; state.memory=[]; for(let i=0;i<60;i++)state.memory.push(real(i,1+Math.floor(i/7)));
    for(let i=0;i<35;i++)state.memory.push(glimpse(i));
    await maybeCondenseMemories("p_ay","Ayla",chat);
    const newest30=Array.from({length:60},(_,i)=>real(i,1+Math.floor(i/7))).sort((x,y)=>(_memGameOrd(y)-_memGameOrd(x))).slice(0,30).map(m=>m.id);
    const bb={calls,protectedLeft:newest30.filter(id=>state.memory.some(m=>m.id===id)).length,glimpsesLeft:state.memory.filter(m=>m.observerOnly).length,lt:state.memory.filter(m=>m.type==="LONGTERM").length};
    state.condenseOn=false;
    // (c) glimpse soft cap: 70 glimpses over days 1..7 + 5 from today → trimmed to MEM_GLIMPSE_KEEP, today's kept, a rumour-tied one kept
    state.memory=[];
    for(let i=0;i<70;i++)state.memory.push({id:"og"+i,ownerId:"p_ay",type:"OBSERVATION",observerOnly:true,content:"old glimpse "+i,gameDay:1+(i%7),gamePeriod:"Morning",charge:0.1});
    state.memory.find(m=>m.id==="og0").gossipId="gs_1";
    for(let i=0;i<5;i++)state.memory.push({id:"tg"+i,ownerId:"p_ay",type:"OBSERVATION",observerOnly:true,content:"today glimpse "+i,gameDay:10,gamePeriod:"Morning"});
    const dropped=_memTrimGlimpses("p_ay",10);
    const gl=state.memory.filter(m=>m.observerOnly);
    const c={dropped,left:gl.length,today:gl.filter(m=>m.gameDay===10).length,rumour:gl.some(m=>m.id==="og0"),oldestLeft:Math.min(...gl.filter(m=>m.gameDay!==10&&!m.gossipId).map(m=>m.gameDay)),keep:MEM_GLIMPSE_KEEP};
    return {a,b:bb,c}; });
  ok("20 real experiences + 35 glimpses + manual/superseded: no condense (only 20 mergeable)", cd.a.calls===0&&cd.a.real===20&&cd.a.lt===0, JSON.stringify(cd.a));
  ok("60 real experiences + 35 glimpses: condenses, the newest 30 real ones are all kept, glimpses untouched", cd.b.calls>=1&&cd.b.lt>=1&&cd.b.protectedLeft===30&&cd.b.glimpsesLeft===35, JSON.stringify(cd.b));
  ok("glimpses past their soft cap are trimmed to the keep size, oldest first", cd.c.left===cd.c.keep&&cd.c.dropped===75-cd.c.keep&&cd.c.oldestLeft>=3, JSON.stringify(cd.c));
  ok("today's glimpses and a rumour-tied one are never trimmed", cd.c.today===5&&cd.c.rumour===true, JSON.stringify(cd.c));

  // ---------------------------------------------------------------------------------------------
  console.log("\n[4. a reconciled memory keeps its fragments' source lines]");
  const rc=await pg.evaluate(async()=>{
    const chat=curChat(); chat.gameDay=4; chat.period="Afternoon"; state.memory=[];
    const base={ownerId:"p_ay",character:"Ayla",type:"EXPERIENCE",gameDay:4,gamePeriod:"Morning",importance:0.5,universeId:state.curUniverse,chatId:chat.id,source:"auto"};
    state.memory.push(Object.assign({id:"f1",content:"We talked at the beach about the boat.",srcMids:["t0","t1","t2"]},base));
    state.memory.push(Object.assign({id:"f2",content:"Emre asked me about Kerem's debt.",srcMids:["t3","t4","t5"]},base));
    window.__reply=()=>JSON.stringify({memories:[{content:"This morning at the beach Emre and I talked about the boat and Kerem's debt.",importance:4},{content:"I worried about Kerem.",importance:5}]});
    await reconcilePeriodFor(state.personas.find(p=>p.id==="p_ay"),4,"Morning");
    const ms=state.memory.filter(x=>x.source==="reconciled");
    return ms.map(m=>({src:m.srcMids,imp:m.importance,day:m.gameDay,per:m.gamePeriod})); });
  ok("the reconciled memory carries the union of srcMids, in order, and its day/period", rc.length===2&&JSON.stringify(rc[0].src)==='["t0","t1","t2","t3","t4","t5"]'&&rc[0].day===4&&rc[0].per==="Morning", JSON.stringify(rc));
  ok("an answer set on a 0–5 scale (4, 5) is read as 0.8 / 1.0", rc.length===2&&Math.abs(rc[0].imp-0.8)<1e-9&&rc[1].imp===1, JSON.stringify(rc));

  // ---------------------------------------------------------------------------------------------
  console.log("\n[5. location gossip hears only what the room could]");
  const lg=await pg.evaluate(async()=>{
    const chat=curChat(); state.memory=[]; const A=["p_ay","p_bu"]; chat.presentIds=A.slice(); chat.gameDay=4;
    /* v148.4 — INTENTIONALLY CHANGED: (a) "spoken" is no longer the default, so this section asks for it by
       name; (b) quoted speech touching the whispered span is part of the whisper now (the documented
       `/whisper Name *narration* "speech"` form), so the public part is set off with plain text first. */
    state.narrPrivacy="spoken";
    chat.messages=[
      {mid:"v0",role:"assistant",speaker:"Narrator",narratorEvent:true,travelBeat:true,content:"You arrive at the tea garden.",present:A.slice()},
      {mid:"v1",role:"user",content:"*SECRETWHISPER the money is in the boat* Then, to everyone: \"Nice evening.\"",present:A.slice(),whisperTo:"p_bu",whisperToName:"Burcu"},
      {mid:"v2",role:"assistant",speaker:"Burcu",speakerId:"p_bu",content:"_THOUGHTBURCU he is lying_ \"PUBLICWORDS it really is.\"",present:A.slice()},
      {mid:"v3",role:"assistant",speaker:"Ayla",speakerId:"p_ay",content:"*ACTIONAYLA she pours the tea* \"More tea?\"",present:A.slice()},
      {mid:"v4",role:"user",content:"\"Yes please.\" _THOUGHTEMRE I hope nobody saw_",present:A.slice()}];
    const loc={id:"loc_tea",name:"Tea Garden",type:"public",gossipChance:1,residents:["p_ce"],sublocations:[]};
    let prompt="";
    window.__reply=(d,msgs)=>{ if(/Location gossip/.test(d)){ prompt=JSON.stringify(msgs); return JSON.stringify({content:"People are saying Emre was at the tea garden.",importance_score:7,charge:0.8,gist:"Emre at the tea garden"}); } return "{}"; };
    await runLocationGossipLeak(chat,loc,null);
    delete state.narrPrivacy;
    const m=state.memory.find(x=>x.ownerId==="p_ce"&&x.source==="location_rumor");
    return {prompt,imp:m&&m.importance,charge:m&&m.charge}; });
  ok("the gossip prompt ran", lg.prompt.length>0, "no Location gossip call");
  ok("no whisper secret and no thought (Burcu's or the player's) reaches it", lg.prompt.length>0&&!/SECRETWHISPER|THOUGHTBURCU|THOUGHTEMRE/.test(lg.prompt), lg.prompt.slice(0,600));
  ok("the public part does (the open end of the whisper, spoken words)", /Nice evening/.test(lg.prompt)&&/PUBLICWORDS/.test(lg.prompt)&&/More tea/.test(lg.prompt), lg.prompt.slice(0,600));
  ok("another character's narrated action stays out in spoken mode", !/ACTIONAYLA/.test(lg.prompt), lg.prompt.slice(0,600));
  ok("an importance of 7 is stored as 0.7", Math.abs((lg.imp||0)-0.7)<1e-9&&Math.abs((lg.charge||0)-0.8)<1e-9, JSON.stringify(lg));

  // ---------------------------------------------------------------------------------------------
  console.log("\n[6. \"still on screen\" is what castHistory actually carries]");
  const tw=await pg.evaluate(()=>{
    const chat=curChat(); const A=["p_ay"]; chat.presentIds=A.slice(); state.histTurns=20; chat.gameDay=4; chat.period="Afternoon";
    chat.messages=[]; let n=0;
    const add=o=>chat.messages.push(Object.assign({mid:"t"+(n++),present:A.slice()},o));
    for(let i=0;i<6;i++) add({role:i%2?"assistant":"user",speaker:i%2?"Ayla":undefined,speakerId:i%2?"p_ay":undefined,content:"\"SCENE-A beach talk "+i+"\""});
    add({role:"assistant",speaker:"Narrator",narratorEvent:true,travelBeat:true,content:"You walk to the cafe."});
    for(let i=0;i<4;i++) add({role:i%2?"assistant":"user",speaker:i%2?"Ayla":undefined,speakerId:i%2?"p_ay":undefined,content:"\"SCENE-B cafe talk "+i+"\""});
    add({role:"assistant",speaker:"Narrator",narratorEvent:true,travelBeat:true,content:"You walk home."});
    for(let i=0;i<4;i++) add({role:i%2?"assistant":"user",speaker:i%2?"Ayla":undefined,speakerId:i%2?"p_ay":undefined,content:"\"SCENE-C home talk "+i+"\""});
    const p=state.personas.find(x=>x.id==="p_ay");
    const hist=castHistory(chat,p).map(m=>m.content).join(" | ");
    const win=memTranscriptMids(chat,"p_ay");
    const memA={id:"mA",ownerId:"p_ay",content:"beach",srcMids:["t0","t1","t2","t3","t4","t5"],gameDay:4,gamePeriod:"Afternoon"};
    const memC={id:"mC",ownerId:"p_ay",content:"home",srcMids:["t13","t14","t15","t16"],gameDay:4,gamePeriod:"Afternoon"};
    // partial overlap: a long scene of 30 lines with histTurns 20 — an arc over lines 5..14 has its first half scrolled out
    const chat2={id:"c_tw2",universeId:chat.universeId,gameDay:4,period:"Afternoon",presentIds:A.slice(),messages:[]};
    for(let i=0;i<30;i++) chat2.messages.push({mid:"L"+i,present:A.slice(),role:i%2?"assistant":"user",speaker:i%2?"Ayla":undefined,speakerId:i%2?"p_ay":undefined,content:"\"long talk "+i+"\""});
    const win2=memTranscriptMids(chat2,"p_ay");
    const half={srcMids:Array.from({length:10},(_,i)=>"L"+(5+i)),gameDay:4,gamePeriod:"Afternoon"};
    const whole={srcMids:Array.from({length:10},(_,i)=>"L"+(18+i)),gameDay:4,gamePeriod:"Afternoon"};
    const hist2=castHistory(chat2,p);
    return {histHasA:/SCENE-A/.test(hist),winHasA:win.has("t0"),aNow:memIsNow(memA,4,"Afternoon",win),cNow:memIsNow(memC,4,"Afternoon",win),
      win2Size:win2.size,hist2Len:hist2.length,halfNow:memIsNow(half,4,"Afternoon",win2),wholeNow:memIsNow(whole,4,"Afternoon",win2),
      winHasB:win.has("t7")}; });
  ok("a scene two travels back is not in castHistory, and not in the memory window either", tw.histHasA===false&&tw.winHasA===false, JSON.stringify(tw));
  ok("so its memory is recalled (not \"now\"); the scene on screen is \"now\"", tw.aNow===false&&tw.cNow===true, JSON.stringify(tw));
  ok("the window is exactly as long as castHistory's capped history", tw.win2Size===tw.hist2Len&&tw.hist2Len===20, JSON.stringify(tw));
  ok("an arc whose first half scrolled out is recalled; one wholly on screen is not", tw.halfNow===false&&tw.wholeNow===true, JSON.stringify(tw));
  ok("latestArcs takes the chat it is given", await pg.evaluate(()=>/latestArcs\(ownerId,used,RECENT_ARCS_N,chatArg\)/.test(String(latestArcsBlock))&&/chatArg\|\|curChat\(\)/.test(String(latestArcs))));

  // ---------------------------------------------------------------------------------------------
  console.log("\n[7. the people facet: the generated query naming the player does not count]");
  const pf=await pg.evaluate(async()=>{
    const chat=curChat(); chat.gameDay=6; chat.period="Evening"; chat.presentIds=["p_ay"]; chat.location="Cafe";
    chat.messages=[{mid:"z1",role:"user",content:"hey",present:["p_ay"]}];
    state.memRecentCount=4; state.memLongtermCount=0; state.memDistantCount=0; state.embedOn=false;
    ["Sem","Loc","Rec","Emo","Imp"].forEach(k=>state["memW"+k]=0); state.memWPpl=1;
    state.memory=[{id:"pe",ownerId:"p_ay",universeId:state.curUniverse,content:"Emre fixed my tap",people:["Emre"],type:"EXPERIENCE",gameDay:2,gamePeriod:"Morning",importance:.5}];
    const facet=async(ut)=>{ await retrieveMemories(ut,chat,"p_ay"); const e=dbgLog.slice().reverse().find(x=>/Memory retrieval/.test(x.label||""));
      const c=e&&e.payload.candidatesByTier.recent.find(x=>/fixed my tap/.test(x.memory)); return c?c.facets.people:null; };
    window.genQuery=async()=>"Emre asks Ayla about the tap and the kitchen";
    const byQuery=await facet("How was your day?");
    const byLine=await facet("Did Burcu tell you what Emre did yesterday?");
    ["Sem","Ppl","Loc","Rec","Emo","Imp"].forEach(k=>delete state["memW"+k]); delete window.genQuery;
    return {byQuery,byLine}; });
  ok("the query names the player, the line does not → the player is not a people hit", pf.byQuery===0, JSON.stringify(pf));
  ok("the line being answered names the player → it is", pf.byLine===1, JSON.stringify(pf));

  // ---------------------------------------------------------------------------------------------
  console.log("\n[8. day-end relationship passes read the chat they are given]");
  const de=await pg.evaluate(async()=>{
    const u2={id:"u_qc2mem",name:"Other world",userName:"Deniz",locations:[]};
    state.universes=state.universes.filter(u=>u.id!==u2.id); state.universes.push(u2);
    state.personas.push({id:"p_x",name:"Xavi",universeId:u2.id,look:{}});
    const other={id:"c_qc2mem",universeId:u2.id,gameDay:5,period:"Evening",presentIds:["p_x"],rel:{},messages:[]};
    runNeglectDrift(other,5);
    const keys=Object.keys(other.rel);
    const judged=[]; const real=window.evalRelationship;
    window.evalRelationship=async(chat,fromP,toId,toName)=>{ judged.push(fromP.id+">"+toId+":"+toName); };
    const snap=[{mid:"o1",role:"user",content:"hi",present:["p_x"]},{mid:"o2",role:"assistant",speaker:"Xavi",speakerId:"p_x",content:"\"hello\"",present:["p_x"]}];
    try{ await runDailyRelationships(other,5,snap); } finally{ window.evalRelationship=real; }
    const openRel=Object.keys(curChat().rel||{}).filter(k=>/p_x/.test(k));
    state.personas=state.personas.filter(p=>p.id!=="p_x"); state.universes=state.universes.filter(u=>u.id!==u2.id);
    return {keys,judged,openRel}; });
  ok("runNeglectDrift stamps the given chat's cast, not the open chat's", de.keys.length===1&&/^p_x>/.test(de.keys[0]), JSON.stringify(de));
  ok("runDailyRelationships judges the given chat's cast, toward that world's player", de.judged.length===1&&de.judged[0]==="p_x>__user__:Deniz"&&de.openRel.length===0, JSON.stringify(de));

  // ---------------------------------------------------------------------------------------------
  console.log("\n[9. low: queued stamps, 0–5 scales, the accuser who leaves early]");
  const qs=await pg.evaluate(async()=>{
    const chat=curChat(); state.memory=[]; const A=["p_ay"]; chat.presentIds=A.slice(); chat.gameDay=4; chat.period="Morning"; chat.timeOfDay="Morning";
    chat.messages=[]; let n=0; const add=(t)=>{ chat.messages.push({mid:"q"+(n++),role:"user",content:t,present:A.slice()},{mid:"q"+(n++),role:"assistant",speaker:"Ayla",speakerId:"p_ay",content:"\"ok "+t+"\"",present:A.slice()}); };
    add("morning one"); chat.memEvent=null; chat.memDoneIdx=-1; _memBuildSeen.delete(chat);
    let k=0;
    window.__reply=async(d)=>{ if(/arc tracker/.test(d)){ k++; await new Promise(r=>setTimeout(r,120)); return JSON.stringify({progress:k===1?"ongoing":"finished",topic:"same",summary:"s"}); }
      return JSON.stringify({content:"mem "+Math.random(),importance_score:0.5}); };
    const p1=maybeBuildMemory(chat);
    await new Promise(r=>setTimeout(r,20));
    add("morning two");
    const p2=maybeBuildMemory(chat);                // queued while it is still Morning
    chat.period="Afternoon"; chat.timeOfDay="Afternoon";
    add("AFTERNOON line");                          // said after the clock moved
    await Promise.all([p1,p2]);
    const m=state.memory.find(x=>x.ownerId==="p_ay");
    return m?{per:m.gamePeriod,src:m.srcMids}:null; });
  ok("a build queued in the Morning files its arc under Morning, without the Afternoon lines", !!qs&&qs.per==="Morning"&&qs.src.indexOf("q3")>=0&&qs.src.indexOf("q4")<0, JSON.stringify(qs));
  const sc=await pg.evaluate(()=>({
    lone4:memImpNorm(4,0), frac:memImpNorm("4/5",0), outOf:memImpNorm("3 out of 10",0), pct:memImpNorm("80%",0),
    set5:memImpNorm(4,0,memImpScale([4,2])), set10:memImpNorm(4,0,memImpScale([4,7])), dec:memImpNorm(0.7,0,memImpScale([0.7,0.2])),
    one:memImpNorm(1,0,memImpScale([1,1])), bad:memImpNorm("high",0.3)}));
  ok("memImpNorm: '4/5' → 0.8, '3 out of 10' → 0.3, '80%' → 0.8, lone 4 → 0.4", Math.abs(sc.frac-0.8)<1e-9&&Math.abs(sc.outOf-0.3)<1e-9&&Math.abs(sc.pct-0.8)<1e-9&&Math.abs(sc.lone4-0.4)<1e-9, JSON.stringify(sc));
  ok("memImpNorm with the answer set: {4,2} is a 0–5 set (4 → 0.8); {4,7} is 0–10; decimals untouched", Math.abs(sc.set5-0.8)<1e-9&&Math.abs(sc.set10-0.4)<1e-9&&sc.dec===0.7&&sc.one===1&&sc.bad===0.3, JSON.stringify(sc));
  const ac=await pg.evaluate(async()=>{
    const chat=curChat(); state.memory=[]; chat.presentIds=["p_ay"];
    const mkEv=(extra)=>Object.assign({kind:"confrontation",accuserId:"p_bu",accuserName:"Burcu",intent:"the pier",conviction:0.7,turn:1,maxTurns:6,minTurns:2,
      participant:{charId:"p_bu",name:"Burcu",approaching:false},_startMsg:0},extra||{});
    const out={};
    const real=window.resolveActiveEvent; window.resolveActiveEvent=async(c)=>{ c.activeEvent=null; };
    try{
      chat.activeEvent=mkEv(); await runSceneWriter(chat);
      out.noJudge=(state.memory.find(x=>x.source==="confrontation")||{}).confrontOutcome;
      state.memory=[];
      chat.activeEvent=mkEv({_lastJudge:{delta:0.1,reason:"evasive"}}); await runSceneWriter(chat);
      out.judged=(state.memory.find(x=>x.source==="confrontation")||{}).confrontOutcome;
      out.emotionNoJudge=null;
    } finally { window.resolveActiveEvent=real; }
    return out; });
  ok("an accuser who leaves before any judged turn records \"unresolved\", not \"rupture\"", ac.noJudge==="unresolved", JSON.stringify(ac));
  ok("after a judged turn the conviction decides (0.7 → rupture)", ac.judged==="rupture", JSON.stringify(ac));

  ok("no page errors", errs.length===0, errs.join("\n"));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail?1:0);
})();
