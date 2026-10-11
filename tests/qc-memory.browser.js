/* v144.1 — QC report §3 #8/#13, §4.8 Memory and §4.9 Relationships.
   Every model call is stubbed (window.chatCompletion / window.fetch) and the prompts it receives are
   captured, so what each engine was actually SHOWN can be asserted, not just what it stored.
   Run: NODE_PATH=/path/to/node_modules node tests/qc-memory.browser.js */
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:process.env.SM_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage({viewport:{width:412,height:915}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file://'+require('path').resolve(__dirname,'..','index.html')); await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(900);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x===undefined?c:x).slice(0,500));} };

  // ---- a small world: Ayla and Burcu talk to the player, Cem stands by, Deniz is undiscovered
  await pg.evaluate(()=>{
    const uni=state.universes[0]; state.curUniverse=uni.id;
    const mk=(id,name,extra)=>Object.assign({id,name,universeId:uni.id,instructions:"x",personality:"x",backstory:"x",style:"x",goals:"x",look:{}},extra||{});
    state.personas=state.personas.filter(p=>!["p_ay","p_bu","p_ce","p_de"].includes(p.id));
    state.personas.push(mk("p_ay","Ayla"),mk("p_bu","Burcu"),mk("p_ce","Cem"),mk("p_de","Deniz",{latent:true}));
    state.user="Emre"; state.key="sk-test"; state.mem=true; state.memMinImp=0; state.condenseOn=false;
    state.emoOn=false;   // v150.110 — the fast (body) read checked here runs with the feeling system off (tests/feel-moment covers it on)
    state.autoCharOn=false; state.relOn=true; state.embedOn=false; state.narrPrivacy=true;
    const chat=curChat(); chat.universeId=uni.id; chat.gameDay=4; chat.period="Afternoon"; chat.timeOfDay="Afternoon";
    chat.presentIds=["p_ay","p_bu","p_ce"]; chat.rel={}; chat.memEvent=null; chat.memDoneIdx=-1;
    const ALL=["p_ay","p_bu","p_ce"];
    window.__ALL=ALL;
    window.__seedChat=()=>{
      chat.messages=[
        {mid:"q1",role:"user",content:"*SECRETWHISPER meet me at the pier at midnight*",present:ALL.slice(),whisperTo:"p_bu",whisperToName:"Burcu"},
        {mid:"q2",role:"assistant",speaker:"Burcu",speakerId:"p_bu",content:"_THOUGHTBURCU he is lying to her_ \"Olur, gelirim.\"",present:ALL.slice()},
        {mid:"q3",role:"user",content:"Ayla, how was the market today?",present:ALL.slice()},
        {mid:"q4",role:"assistant",speaker:"Ayla",speakerId:"p_ay",content:"\"Crowded, but I found the figs.\"",present:ALL.slice()}
      ];
      chat.memEvent=null; chat.memDoneIdx=-1;
    };
    window.__seedChat();
    state.memory=[];
    window.__calls=[];
    window.__reply=()=>JSON.stringify({content:"A memory "+Math.random().toString(36).slice(2,8),importance_score:0.5,type:"EXPERIENCE",people:["Emre"]});
    window.chatCompletion=async(msgs,model,opts)=>{
      const dbgLabel=(opts&&opts.dbg)||"";
      window.__calls.push({dbg:dbgLabel,text:JSON.stringify(msgs)});
      return window.__reply(dbgLabel,msgs);
    };
  });
  const promptFor=(re)=>pg.evaluate(src=>{ const r=new RegExp(src); const c=window.__calls.filter(x=>r.test(x.dbg)); return c.map(x=>x.text).join("\n"); },re);

  console.log("\n[a whisper and a private thought stay with the people they belong to]");
  await pg.evaluate(async()=>{ window.__calls=[]; await commitMemoryArc(curChat(),0,3,4,"Afternoon"); });
  const ayla=await promptFor("Memory \\(arc\\) · Ayla");
  const burcu=await promptFor("Memory \\(arc\\) · Burcu");
  const cem=await promptFor("Memory \\(arc\\) · Cem");   // v147.2 — Cem is silent but within earshot: a listener memory, not the gist
  ok("Ayla's memory build ran", ayla.length>0, "no Ayla memBuild call");
  ok("Ayla's memBuild input has no whisper meant for Burcu", ayla.length>0&&ayla.indexOf("SECRETWHISPER")<0, ayla.slice(0,400));
  ok("Ayla's memBuild input has no thought of Burcu's", ayla.length>0&&ayla.indexOf("THOUGHTBURCU")<0, ayla.slice(0,400));
  ok("Burcu, the target, does get the whisper, marked as one", /SECRETWHISPER/.test(burcu)&&/whispered to Burcu alone/.test(burcu), burcu.slice(0,400));
  ok("and her own thought", /THOUGHTBURCU/.test(burcu));
  // v148.4 — the listener line no longer claims "heard every line" (an aside is shown as one; see _memAsideCue)
  ok("Cem (silent, in earshot) gets his own memory of the scene (v148.9: not an observation)", cem.length>0&&/in the same room, and heard the lines written out above/.test(cem), "no listener memBuild call");
  ok("the listener build sees neither the whisper nor the thought", cem.length>0&&!/SECRETWHISPER|THOUGHTBURCU/.test(cem), cem.slice(0,400));
  ok("a line said aloud still reaches Ayla", /figs/.test(ayla)&&/market/.test(ayla));

  await pg.evaluate(async()=>{ window.__calls=[]; state.stInterval=1; curChat()._stCount=0;
    window.__reply=()=>JSON.stringify({desire:0,comfort:5,fear:0,agitation:0,note:"A settled warmth."});
    await runShortTermRel(curChat()); });
  const fastAyla=await promptFor("Short-term · Ayla");
  ok("the fast read ran for Ayla", fastAyla.length>0, "no fast-read call");
  ok("the fast read's input for Ayla has neither the whisper nor Burcu's thought", fastAyla.length>0&&!/SECRETWHISPER|THOUGHTBURCU/.test(fastAyla), fastAyla.slice(0,500));

  console.log("\n[model output is clamped at the parse boundary]");
  const clamp=await pg.evaluate(async()=>{
    state.memory=[]; window.__seedChat();
    window.__reply=(d)=>/Memory \(arc\)/.test(d)?JSON.stringify({content:"Scaled memory "+Math.random(),importance_score:7,type:"LONGTERM"}):JSON.stringify({content:"gist "+Math.random(),importance_score:3});
    await commitMemoryArc(curChat(),0,3,4,"Afternoon");
    const m=state.memory.find(x=>x.ownerId==="p_ay");
    return m?{imp:m.importance,type:m.type,src:m.srcMids}:null; });
  ok("importance 7 is stored as 0.7", !!clamp&&Math.abs(clamp.imp-0.7)<1e-9, JSON.stringify(clamp));
  ok("a builder's \"LONGTERM\" type is rejected (filed as EXPERIENCE)", !!clamp&&clamp.type==="EXPERIENCE", JSON.stringify(clamp));
  ok("the memory records the messages it was cut from", !!clamp&&Array.isArray(clamp.src)&&clamp.src.indexOf("q4")>=0, JSON.stringify(clamp));

  console.log("\n[a temporary character is not given memories nobody can recall]");
  ok("no memory is written for a tmp_ character", await pg.evaluate(async()=>{
    const chat=curChat(); state.memory=[];
    chat.tempChars=[{id:"tmp_x",name:"Stranger",temp:true}];
    chat.messages.forEach(m=>m.present.push("tmp_x"));
    window.__reply=()=>JSON.stringify({content:"tmp "+Math.random(),importance_score:0.5});
    await commitMemoryArc(chat,0,3,4,"Afternoon");
    const got=state.memory.filter(m=>m.ownerId==="tmp_x").length;
    chat.tempChars=[]; window.__seedChat();
    return got===0 ? true : got+" memories for the temp"; }));

  console.log("\n[memory building runs once per span]");
  const race=await pg.evaluate(async()=>{
    state.memory=[]; window.__seedChat(); const chat=curChat(); _memBuildSeen.delete(chat);
    const realCommit=window.commitMemoryArc; const spans=[];
    window.commitMemoryArc=async(c,a,z,d,p)=>{ spans.push([a,z]); return realCommit(c,a,z,d,p); };
    window.__reply=async(d)=>{ if(/arc tracker/.test(d)){ await new Promise(r=>setTimeout(r,60)); return JSON.stringify({progress:"finished",topic:"same",summary:"s"}); }
      return JSON.stringify({content:"race memory "+Math.random(),importance_score:0.5}); };
    try{
      await Promise.all([maybeBuildMemory(chat),maybeBuildMemory(chat),flushMemoryArc(chat)]);
    }finally{ window.commitMemoryArc=realCommit; }
    const perOwner={}; state.memory.forEach(m=>{ perOwner[m.ownerId]=(perOwner[m.ownerId]||0)+1; });
    return {spans,perOwner,done:chat.memDoneIdx,ev:chat.memEvent}; });
  ok("two overlapping builds plus a flush commit the span once", race.spans.length===1, JSON.stringify(race.spans));
  ok("and each witness holds one memory of it", Object.values(race.perOwner).every(n=>n===1)&&Object.keys(race.perOwner).length>=2, JSON.stringify(race.perOwner));

  ok("a build with no new dialogue does not ask the tracker again", await pg.evaluate(async()=>{
    const chat=curChat(); window.__calls=[];
    await maybeBuildMemory(chat);
    return window.__calls.filter(c=>/arc tracker/.test(c.dbg)).length===0 ? true : "tracker asked again"; }));

  ok("the same span committed under the next period is caught as a duplicate", await pg.evaluate(()=>{
    const m=state.memory.find(x=>x.ownerId==="p_ay"&&x.srcMids);
    if(!m) return "no memory with srcMids";
    return !!memNearDuplicate("p_ay","Completely different words about another evening entirely",4,"Evening",m.people,m.srcMids.slice()) ? true : "not caught"; }));

  console.log("\n[a failed build keeps the arc for a retry]");
  const retry=await pg.evaluate(async()=>{
    state.memory=[]; window.__seedChat(); const chat=curChat();
    _memBuildSeen.delete(chat);   // the seeded transcript is the one already judged above
    let builds=0;
    window.__reply=async(d)=>{ if(/arc tracker/.test(d))return JSON.stringify({progress:"finished",topic:"same",summary:"s"});
      builds++; return "not json at all"; };
    await maybeBuildMemory(chat);
    const after1={ev:chat.memEvent&&{open:chat.memEvent.open,start:chat.memEvent.startIdx,fails:chat.memEvent.fails},done:chat.memDoneIdx,mems:state.memory.length,builds};
    chat.messages.push({mid:"q5",role:"user",content:"And the figs?",present:window.__ALL.slice()},
                       {mid:"q6",role:"assistant",speaker:"Ayla",speakerId:"p_ay",content:"\"Sweet ones.\"",present:window.__ALL.slice()});
    window.__reply=async(d)=>/arc tracker/.test(d)?JSON.stringify({progress:"finished",topic:"same",summary:"s"}):JSON.stringify({content:"retry memory "+Math.random(),importance_score:0.5});
    await maybeBuildMemory(chat);
    const m=state.memory.find(x=>x.ownerId==="p_ay");
    return {after1,done2:chat.memDoneIdx,ev2:chat.memEvent,src:m&&m.srcMids}; });
  ok("the parse failure was retried once inside the commit", retry.after1.builds>=4, JSON.stringify(retry.after1));
  ok("the arc is still open at its start and nothing is marked done", !!retry.after1.ev&&retry.after1.ev.open&&retry.after1.ev.start===0&&retry.after1.done===-1&&retry.after1.mems===0, JSON.stringify(retry.after1));
  // q2 is the first line Ayla took in (q1 was a whisper to Burcu) — it is only there if the arc kept its start
  ok("the next close commits it, from the original start", retry.done2===5&&Array.isArray(retry.src)&&retry.src[0]==="q2"&&retry.src.indexOf("q6")>=0, JSON.stringify(retry));

  console.log("\n[diaries never come back as \"Latest\"]");
  ok("latestArcs skips DIARY and LONGTERM", await pg.evaluate(()=>{
    const u=state.curUniverse;
    state.memory=[
      {id:"la_d",ownerId:"p_ay",content:"Dear diary",type:"DIARY",gameDay:4,universeId:u,date:3},
      {id:"la_l",ownerId:"p_ay",content:"Long ago",type:"LONGTERM",gameDay:3,universeId:u,date:2},
      {id:"la_e",ownerId:"p_ay",content:"A real arc",type:"EXPERIENCE",gameDay:3,gamePeriod:"Evening",universeId:u,date:1}];
    const got=latestArcs("p_ay",[],3).map(m=>m.id);
    return JSON.stringify(got)==='["la_e"]' ? true : JSON.stringify(got); }));

  console.log("\n[no gap in a long afternoon]");
  const gap=await pg.evaluate(async()=>{
    const chat=curChat(); const u=state.curUniverse; const ALL=window.__ALL;
    chat.messages=[]; for(let i=0;i<40;i++) chat.messages.push({mid:"g"+i,role:i%2?"assistant":"user",speaker:i%2?"Ayla":undefined,speakerId:i%2?"p_ay":undefined,content:"line "+i,present:ALL.slice()});
    state.histTurns=20;
    state.memory=[
      {id:"early",ownerId:"p_ay",content:"EARLY arc of this afternoon",type:"EXPERIENCE",gameDay:4,gamePeriod:"Afternoon",universeId:u,date:1,importance:.5,srcMids:["g2","g3","g4"]},
      {id:"late",ownerId:"p_ay",content:"LATE arc of this afternoon",type:"EXPERIENCE",gameDay:4,gamePeriod:"Afternoon",universeId:u,date:2,importance:.5,srcMids:["g36","g37","g38"]}];
    state.memRecentCount=5; window.genQuery=async()=>"";
    const r=await retrieveMemories("afternoon",chat,"p_ay");
    const ids=(r.recent||[]).map(m=>m.id);
    return {ids,latest:latestArcs("p_ay",[],5).map(m=>m.id)}; });
  ok("an arc whose lines scrolled out of the history is recalled", gap.ids.indexOf("early")>=0, JSON.stringify(gap));
  ok("an arc whose lines are still in the history is not", gap.ids.indexOf("late")<0&&gap.latest.indexOf("late")<0, JSON.stringify(gap));

  console.log("\n[the condenser counts and merges only the raw bank]");
  const cond=await pg.evaluate(async()=>{
    const u=state.curUniverse; const chat=curChat(); chat.gameDay=9; chat.period="Evening";
    state.condenseOn=true; state.memMaxBeforeCondense=50; state.memCondenseStart=30;
    let calls=0; window.__reply=(d)=>{ if(/condense/i.test(d)){ calls++; return '[{"content":"Merged: the coffee mornings with Emre."}]'; } return "{}"; };
    state.memory=[];
    for(let i=0;i<60;i++) state.memory.push({id:"dd"+i,ownerId:"p_ay",content:"Diary page "+i,type:"DIARY",gameDay:1+(i%8),universeId:u,date:i});
    for(let i=0;i<20;i++) state.memory.push({id:"lt"+i,ownerId:"p_ay",content:"Long-term "+i,type:"LONGTERM",gameDay:1,universeId:u,date:100+i});
    for(let i=0;i<5;i++) state.memory.push({id:"rw"+i,ownerId:"p_ay",content:"Raw "+i,type:"EXPERIENCE",gameDay:2,gamePeriod:"Morning",universeId:u,date:200+i});
    await maybeCondenseMemories("p_ay","Ayla",chat);
    const noTrigger=calls===0&&state.memory.length===85;
    // now a real raw bank: 35 memories of the current evening, 20 older ones about one thread (3 of them rumours)
    state.memory=[];
    for(let i=0;i<35;i++) state.memory.push({id:"now"+i,ownerId:"p_ay",content:"We had coffee with Emre at the corner cafe and talked "+i,tags:["coffee","emre"],type:"EXPERIENCE",gameDay:9,gamePeriod:"Evening",universeId:u,date:1000+i,importance:.3});
    for(let i=0;i<20;i++) state.memory.push({id:"old"+i,ownerId:"p_ay",content:"We had coffee with Emre at the corner cafe and talked "+i,tags:["coffee","emre"],type:"EXPERIENCE",gameDay:2,gamePeriod:"Morning",universeId:u,date:i,importance:.3,
      srcMids:["s"+i], people:["Emre"]});
    ["old1","old2","old3"].forEach(id=>{ const m=state.memory.find(x=>x.id===id); m.gossipId="g_1"; });
    calls=0;
    await maybeCondenseMemories("p_ay","Ayla",chat);
    const nowLeft=state.memory.filter(m=>/^now/.test(m.id)).length;
    const rumoursLeft=state.memory.filter(m=>m.gossipId).length;
    const merged=state.memory.filter(m=>m.type==="LONGTERM");
    state.condenseOn=false;
    return {noTrigger,calls,nowLeft,rumoursLeft,merged:merged.map(m=>({span:m.daySpan,per:m.periodSpan,people:m.people,src:(m.srcMids||[]).length}))}; });
  ok("diaries and long-term merges alone never trigger a condense", cond.noTrigger===true, JSON.stringify(cond));
  ok("a raw bank over the ceiling does condense", cond.calls>=1&&cond.merged.length>=1, JSON.stringify(cond));
  ok("nothing from the current day and period is merged", cond.nowLeft===35, JSON.stringify(cond));
  ok("rumour-linked memories are never merged", cond.rumoursLeft===3, JSON.stringify(cond));
  ok("the merge records its story span, people and sources", cond.merged.length>0&&JSON.stringify(cond.merged[0].span)==="[2,2]"&&cond.merged[0].per[0]==="Morning"&&cond.merged[0].people.indexOf("Emre")>=0&&cond.merged[0].src>0, JSON.stringify(cond.merged));

  console.log("\n[relationship answers are changes, and bounded]");
  const rel=await pg.evaluate(async()=>{
    const chat=curChat(); chat.rel={}; chat.gameDay=4;
    const ay=state.personas.find(p=>p.id==="p_ay");
    ay.relationships={__user__:{tie:"old friend",relationship:"AUTHORED FOUNDATION"}};
    const o=relObj(chat,"p_ay","__user__");
    window.__reply=()=>JSON.stringify({trust:50,affection:-45,respect:0,familiarity:0,jealousy:0,desire:0,comfort:0,fear:0,agitation:0,description:"You are warier of him now."});
    await evalRelationship(chat,ay,"__user__","Emre",[],[],4);
    const capped={trust:o.trust,affection:o.affection};
    o.trust=40; o.affection=30; o.respect=20; o.familiarity=50;
    window.__reply=()=>JSON.stringify({trust:42,affection:30,respect:21,familiarity:50,jealousy:0,desire:0,comfort:0,fear:0,agitation:0,description:"Much the same."});
    await evalRelationship(chat,ay,"__user__","Emre",[],[],5);
    const echo={trust:o.trust,affection:o.affection,respect:o.respect,familiarity:o.familiarity};
    o.trust=40;
    window.__reply=()=>JSON.stringify({trust:80,affection:30,respect:21,familiarity:50,jealousy:0,desire:0,comfort:0,fear:0,agitation:0,description:"x"});
    await evalRelationship(chat,ay,"__user__","Emre",[],[],6);
    const big=o.trust;
    const sheet=ay.relationships.__user__.relationship;
    // fast read: a level-shaped desire of 90 from zero
    o.st.desire=0; state.stInterval=1; chat._stCount=0;
    window.__reply=()=>JSON.stringify({desire:90,comfort:0,fear:0,agitation:0,note:"Heat."});
    await runShortTermRel(chat);
    return {capped,echo,big,sheet,desc:o.desc,fast:o.st.desire}; });
  // v148.4 — an "old friend" now starts from the tie's baseline (trust 30, affection 0; see REL_TIE_SEEDS),
  // so the capped +25 / −25 lands at 55 / −25 instead of 25 / −25.
  ok("a daily delta of +50 / −45 is capped at ±25", rel.capped.trust===55&&rel.capped.affection===-25, JSON.stringify(rel.capped));
  ok("an answer that echoes the current levels moves them by the difference, not by the level", rel.echo.trust===42&&rel.echo.affection===30&&rel.echo.familiarity===50, JSON.stringify(rel.echo));
  ok("an answer echoing the other levels is read as levels: 40 → 80 moves by +25 at most", rel.big===65, String(rel.big));
  ok("the fast read is capped at ±40", rel.fast>0&&rel.fast<=40, String(rel.fast));
  ok("the day's read stays on the chat, the authored foundation is untouched", rel.sheet==="AUTHORED FOUNDATION"&&/warier|same|x/.test(rel.desc), JSON.stringify({sheet:rel.sheet,desc:rel.desc}));
  ok("the prompts state the caps and the change-not-level rule", await pg.evaluate(()=>
    /NEVER THE NEW LEVEL/.test(DEFAULT_REL)&&/±25/.test(DEFAULT_REL)&&!/±30 to ±50/.test(DEFAULT_REL)&&/never the new level/.test(DEFAULT_REL_SHORT)&&/±40 is the ceiling/.test(DEFAULT_REL_SHORT)));

  console.log("\n[the relationship generator merges, it does not replace]");
  const gen=await pg.evaluate(async()=>{
    const ay=state.personas.find(p=>p.id==="p_ay");
    ay.relationshipsGen="";
    ay.relationships={ p_de:{tie:"childhood friend",relationship:"LATENT TIE"},
      __user__:{tie:"quest-giver",relationship:"AUTHORED USER TIE",authored:true},
      p_bu:{tie:"neighbour",relationship:"OLD BURCU"},
      p_ce:{tie:"cousin",relationship:"CEM TIE THE MODEL SKIPPED"} };
    window.__reply=()=>JSON.stringify({"Burcu":{tie:"sister",relationship:"NEW BURCU"},"Emre":{tie:"stranger",relationship:"MODEL USER TIE"}});
    await generateRelationshipsFor(ay,universeById(ay.universeId));
    return JSON.parse(JSON.stringify(ay.relationships)); });
  ok("a tie to an undiscovered character survives", !!gen.p_de&&gen.p_de.relationship==="LATENT TIE", JSON.stringify(gen));
  ok("the authored player tie survives", !!gen.__user__&&gen.__user__.relationship==="AUTHORED USER TIE", JSON.stringify(gen.__user__));
  ok("a tie the model left out survives", !!gen.p_ce&&/SKIPPED/.test(gen.p_ce.relationship), JSON.stringify(gen.p_ce));
  ok("a tie the model returned is updated", !!gen.p_bu&&gen.p_bu.relationship==="NEW BURCU", JSON.stringify(gen.p_bu));
  ok("the sheet is regenerated only after a real swing", await pg.evaluate(()=>{
    const chat=curChat(); chat.rel={};
    const a=relObj(chat,"p_ay","__user__"); a.movedDay=7; a.bigMoveDay=0;
    const small=relMovedToday(chat,"p_ay",7,true);
    a.bigMoveDay=7;
    return (!small&&relMovedToday(chat,"p_ay",7,true)) ? true : "small="+small; }));

  console.log("\n[neglect reads presence, not the fast read]");
  ok("a silent character in the scene is stamped as seen today", await pg.evaluate(async()=>{
    const chat=curChat(); chat.gameDay=6; chat.rel={};
    const o=relObj(chat,"p_ce","__user__"); o.lastSeenDay=1; o.neglectDays=3;
    state.stInterval=99; chat._stCount=0;
    await runShortTermRel(chat);
    return (o.lastSeenDay===6&&o.neglectDays===0) ? true : JSON.stringify({seen:o.lastSeenDay,n:o.neglectDays}); }));
  ok("the fast-read counter survives a save", await pg.evaluate(()=>DURABLE_CHAT_KEYS.has("_stCount")));
  ok("reading feelings for a payload creates no relationship record", await pg.evaluate(()=>{
    const chat=curChat(); chat.rel={};
    feelingsBlock(chat,"p_bu","p_ay","Ayla");
    return Object.keys(chat.rel).length===0 ? true : Object.keys(chat.rel).join(","); }));
  ok("the dead period-change relationship pass is gone", await pg.evaluate(()=>!/reEvaluateRelationshipsForDay/.test(String(onPeriodChanged))));

  console.log("\n[trackers do not all fire at once]");
  ok("at most three tracker calls are in flight", await pg.evaluate(async()=>{
    const chat=curChat(); state.trackOn=true;
    const saved=state.trackers;
    state.trackers=Array.from({length:7},(_,i)=>({id:"tq"+i,name:"T"+i,owner:"__story__",min:0,max:100,method:"llm",behavior:"free"}));
    let live=0,peak=0,n=0;
    window.__reply=async(d)=>{ if(/^Tracker/.test(d)){ n++; live++; peak=Math.max(peak,live); await new Promise(r=>setTimeout(r,30)); live--; return JSON.stringify({delta:0,triggered:false}); } return "{}"; };
    const realCur=window.curTrackers; window.curTrackers=()=>state.trackers;
    try{ await runTrackerEngine(chat); } finally{ window.curTrackers=realCur; state.trackers=saved; state.trackOn=false; }
    return (n===7&&peak<=3) ? true : "calls="+n+" peak="+peak; }));

  console.log("\n[retrieval: an unembedded memory does not beat a real match]");
  const ret=await pg.evaluate(async()=>{
    const chat=curChat(); const u=state.curUniverse; chat.gameDay=8; chat.period="Night"; chat.messages=[{mid:"z1",role:"user",content:"Remember the necklace?",present:window.__ALL.slice()}];
    state.embedOn=true; state.embedKey="ek"; state.memRecentCount=1; state.memPerTypeCap=0;
    ["Ppl","Loc","Rec","Emo","Imp"].forEach(k=>state["memW"+k]=0); state.memWSem=1;
    const VEC={q:[1,0,0],strong:[0.7,0.714,0],weak:[0.1,0.995,0],weak2:[0.12,0.99,0]};
    let embCalls=0, batchSizes=[];
    window.fetch=async(url,opts)=>{
      if(String(url).indexOf("embeddings")<0) return new Response("{}",{status:404});
      embCalls++; const body=JSON.parse(opts.body); const ins=Array.isArray(body.input)?body.input:[body.input];
      batchSizes.push(ins.length);
      const pick=t=>/STRONG/.test(t)?VEC.strong:(/WEAKTWO/.test(t)?VEC.weak2:(/WEAK/.test(t)?VEC.weak:VEC.q));
      return new Response(JSON.stringify({data:ins.map((t,i)=>({index:i,embedding:pick(t)}))}),{status:200}); };
    window.genQuery=async()=>"necklace gift mother";
    const base={ownerId:"p_ay",universeId:u,type:"EXPERIENCE",gameDay:2,gamePeriod:"Morning",importance:.5,people:[]};
    state.memory=[Object.assign({id:"strong",content:"STRONG the silver chain from my mother"},base),
                  Object.assign({id:"lexonly",content:"necklace gift mother necklace gift mother"},base)];
    state.memory[0].vec=VEC.strong; state.memory[0].vecModel=embedModelName(); state.memory[0].vecSig=_vecSig(memSearchText(state.memory[0]));
    const r=await retrieveMemories("the necklace",chat,"p_ay");
    const first=(r.recent||[]).map(m=>m.id);
    // an irrelevant pool: only weak cosines → the semantic facet stays low for all
    state.memory=[Object.assign({id:"w1",content:"WEAK about the boat"},base),Object.assign({id:"w2",content:"WEAKTWO about the car"},base)];
    state.memory.forEach(m=>{ m.vec=/WEAKTWO/.test(m.content)?VEC.weak2:VEC.weak; m.vecModel=embedModelName(); m.vecSig=_vecSig(memSearchText(m)); });
    await retrieveMemories("the necklace",chat,"p_ay");
    const e=dbgLog.slice().reverse().find(x=>/Memory retrieval/.test(x.label||""));
    const sems=e?e.payload.candidatesByTier.recent.map(c=>c.facets.semantic):[];
    // backfill: five memories without vectors → one batched request
    state.memory=Array.from({length:5},(_,i)=>Object.assign({id:"bf"+i,content:"Backfill memory "+i},base));
    while(_embBusy) await new Promise(r=>setTimeout(r,10));   // the retrieval's own background backfill
    embCalls=0; batchSizes=[]; _embBackoffUntil=0;
    await ensureMemEmbeddings("p_ay",32);
    const batched={calls:embCalls,sizes:batchSizes.slice(),vec:state.memory.every(m=>Array.isArray(m.vec))};
    // a failure stands the backfill down instead of retrying next turn
    state.memory.forEach(m=>{ delete m.vec; delete m.vecSig; });
    window.fetch=async()=>{ embCalls++; return new Response("quota",{status:429}); };
    embCalls=0; await ensureMemEmbeddings("p_ay",32); await ensureMemEmbeddings("p_ay",32);
    const backoff=embCalls; _embBackoffUntil=0;
    ["Ppl","Loc","Rec","Emo","Imp","Sem"].forEach(k=>delete state["memW"+k]); state.embedOn=false; state.memRecentCount=2;
    return {first,sems,batched,backoff}; });
  ok("a strong cosine match outranks an unembedded memory that only repeats the query words", ret.first[0]==="strong", JSON.stringify(ret.first));
  ok("in a pool where nothing really matches, no memory scores a high semantic facet", ret.sems.length===2&&Math.max(...ret.sems)<0.2, JSON.stringify(ret.sems));
  ok("the embedding backfill sends ONE batched request", ret.batched.calls===1&&ret.batched.sizes[0]===5&&ret.batched.vec, JSON.stringify(ret.batched));
  ok("after a failure the backfill backs off instead of retrying at once", ret.backoff===1, "calls="+ret.backoff);
  ok("diaries are not embedded", await pg.evaluate(()=>memNeedsEmbed({type:"DIARY",content:"x"})===false&&memNeedsEmbed({type:"EXPERIENCE",content:"x"})===true));

  console.log("\n[storage and small fixes]");
  ok("bank writes from the hot paths are coalesced", await pg.evaluate(async()=>{
    const real=mediaDB.kvSet; let n=0;
    mediaDB.kvSet=async(k,v)=>{ if(k==="memory")n++; return true; };
    try{ for(let i=0;i<6;i++)persistMemorySoon(); await new Promise(r=>setTimeout(r,550)); }
    finally{ mediaDB.kvSet=real; }
    return n===1 ? true : "writes="+n; }));
  ok("the intimacy detector sees Turkish words that start with ö/ç/ş", await pg.evaluate(()=>
    memIsIntimate({content:"bir öpüş ve sonra"})&&memIsIntimate({content:"tamamen çıplak"})&&!memIsIntimate({content:"we met in Essex"})));
  ok("an overture that landed is not recorded as rebuffed when they leave", await pg.evaluate(()=>{
    state.memory=[];
    const ev={kind:"overture",accuserId:"p_ay",intent:"making up",conviction:0.2,_departed:true};
    ev._outcome=overtureOutcomeFromConviction(ev.conviction);
    recordOvertureAftermath(curChat(),ev);
    const m=state.memory.find(x=>x.source==="overture");
    return (m&&m.overtureOutcome==="accepted"&&/It landed/.test(m.content)) ? true : JSON.stringify(m); }));
  ok("a confrontation's label and memory come from the same reading", await pg.evaluate(()=>{
    state.memory=[];
    const ev={kind:"confrontation",accuserId:"p_bu",intent:"the pier",conviction:0.65};
    recordConfrontationAftermath(curChat(),ev);
    const m=state.memory.find(x=>x.source==="confrontation");
    return (m&&m.confrontOutcome==="rupture"&&/not convinced/.test(m.content)) ? true : JSON.stringify(m); }));
  ok("the judge only scores a player line said after the event began", await pg.evaluate(()=>{
    const src=String(runSceneWriter);
    return /_evLine/.test(src)&&/if\(_judgeNow\)await runConfrontJudge/.test(src)&&/if\(_judgeNow\)await runOvertureJudge/.test(src); }));
  ok("the relationship prompt banner is not a second engine banner", await pg.evaluate(()=>true)
     && /===== RELATIONSHIP GENERATOR PROMPT =====/.test(require('fs').readFileSync(require('path').resolve(__dirname,'..','index.html'),'utf8')));
  ok("no stale prompt pipes", await pg.evaluate(()=>!(window.__stalePipes||[]).some(s=>/^rel/.test(s))), await pg.evaluate(()=>(window.__stalePipes||[]).join(" | ")));

  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log("\n  "+pass+" passed, "+fail+" failed");
  await b.close();
  process.exit(fail?1:0);
})();
