/* v150.29 — RELEVANCE IS ASKED, NOT GUESSED.
   Retrieval ranked memories by an embedding cosine plus people-present, location, recency, mood and
   importance, and the cosine's narrow band let the others outvote it: the newest memories with whoever
   was in the room won whatever the moment was about. The relevance judge sends the scene and one yes/no
   question per shortlisted memory to the Decisions API (OpenRouter /api/alpha/decisions) and ranks by the
   probability that comes back. Checked here, with the endpoint stubbed:
     • the memory the judge rates relevant is recalled although the weights would never pick it;
     • the request: endpoint, key, default and chosen model, the scene as state, one noul question per
       memory with the memory's text and yes/no criteria, both injected tiers in one request, under the cap;
     • below the minimum relevance a memory is not recalled at all; 0 fills every slot; diary entries
       (never injected) are not asked about;
     • a failed request (5xx, junk, network) ranks exactly as with the judge off; a 401 or a refused
       model pauses it (no request, one toast) until the key changes; three network failures pause it;
     • off, or with no key, nothing is sent;
     • the three prompts are registry prompts with {{char}} {{user}} {{memory}}, and an edit reaches the request;
     • the Debug trace carries each memory's relevance, and settings round-trip.
   Run: node tests/memory-relevance.browser.js */
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:process.env.SM_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage({viewport:{width:412,height:915}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file://'+require('path').resolve(__dirname,'..','index.html'));
  await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(800);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x||c).slice(0,700));} };

  await pg.evaluate(()=>{
    /* The judge stub: a memory is relevant when its question names the necklace. __judgeMode switches
       the answer to a failure; every request is kept for inspection. */
    window.__judgeReqs=[]; window.__judgeMode="ok"; window.__toasts=[];
    const realToast=window.toast; window.toast=(m)=>{ window.__toasts.push(String(m)); try{ realToast(m); }catch(_){} };
    const realFetch=window.fetch;
    window.fetch=async(url,opts)=>{
      const u=String(url);
      if(u.indexOf("/api/alpha/decisions")>-1){
        const body=JSON.parse(opts.body);
        window.__judgeReqs.push({url:u,headers:opts.headers,body});
        const mode=window.__judgeMode;
        if(mode==="network") throw new TypeError("Failed to fetch");
        if(mode==="500") return new Response(JSON.stringify({error:{message:"upstream"}}),{status:500});
        if(mode==="401") return new Response(JSON.stringify({error:{message:"bad key"}}),{status:401});
        if(mode==="404") return new Response(JSON.stringify({error:{message:"No endpoints found"}}),{status:404});
        if(mode==="junk") return new Response(JSON.stringify({answers:{}}),{status:200});
        const answers={};
        Object.keys(body.questions).forEach(k=>{ const q=body.questions[k];
          const hit=/kolye|necklace/i.test(q.instructions);
          answers[k]={type:"noul",noul:hit?0.93:0.03}; });
        return new Response(JSON.stringify({answers,usage:{prompt_tokens:1234}}),{status:200});
      }
      if(u.indexOf("embeddings")>-1) return new Response(JSON.stringify({error:{message:"off"}}),{status:500});
      return realFetch(url,opts);
    };
    // the generated query points at coffee — the weights alone will pick the recent coffee memories
    window.genQuery=async()=>"emre kahve spor";
    const uni=state.universes[0];
    state.personas=state.personas.filter(p=>p.id!=="p_b"&&p.id!=="p_e");
    state.personas.push({id:"p_b",name:"Burcu",universeId:uni.id,instructions:"x",personality:"x",backstory:"x",style:"x",goals:"x",look:{}});
    state.personas.push({id:"p_e",name:"Emre",universeId:uni.id,instructions:"x",personality:"x",backstory:"x",style:"x",goals:"x",look:{}});
    const chat=curChat(); chat.presentIds=["p_b","p_e"]; chat.gameDay=7; chat.period="Evening"; chat.location="Cafe";
    chat.universeId=uni.id; state.curUniverse=uni.id;
    chat.messages=[{role:"user",content:"Annemin verdiği kolyeyi hatırlıyor musun? Hani o hediye.",speaker:state.user}];
    state.mem=true; state.key="sk-test"; state.embedOn=false;
    state.memRecentCount=2; state.memDistantCount=2; state.memLongtermCount=2; state.memPerTypeCap=0;
    state.memJudgeOn=true; state.memJudgeModel=""; state.memJudgeMin=0.15;
    const mk=(id,day,per,content,extra)=>Object.assign({id,ownerId:"p_b",character:"Burcu",universeId:uni.id,
      content,gameDay:day,gamePeriod:per,importance:.7,type:"EXPERIENCE",people:["Emre"],emotion:"neutral",
      location:"Cafe",date:day*10},extra||{});
    state.memory=[
      mk("r1",7,"Morning","Emre ile kahve içtik, spor salonundan bahsettik."),
      mk("r2",7,"Midday","Emre ile kahve içip plajda yürüdük."),
      mk("r3",6,"Evening","Emre akşam yemeğine geldi, kahve yaptım."),
      mk("r4",6,"Night","Emre gece telefon açtı."),
      // what the moment is about: old, nobody present in it, somewhere else, nothing in common with the query
      mk("old",1,"Midday","Annemin bana verdiği kolyeyi kaybettim, çok ağladım.",{people:["Ayşe"],location:"Ev",importance:.4}),
      mk("d1",5,"Night","Bugün Emre ile kahve içtik.",{type:"DIARY"}),
      mk("d2",3,"Night","Annemin kolyesi aklımdan çıkmıyor.",{type:"DIARY",people:[]}),
      mk("d3",2,"Night","Spor salonuna gittim.",{type:"DIARY",people:[]}),
      mk("l1",2,"Midday","Emre ile kahve içmeyi severiz.",{type:"LONGTERM"}),
      mk("l2",1,"Midday","Kolye annemin hatırasıdır.",{type:"LONGTERM",people:[]}),
      mk("l3",1,"Morning","Spor yapmayı severim.",{type:"LONGTERM",people:[]})
    ];
  });
  const run=()=>pg.evaluate(async()=>{ const r=await retrieveMemories("Annemin kolyesi",curChat(),"p_b");
    return {recent:r.recent.map(m=>m.id),diary:r.diary.map(m=>m.id),longterm:r.longterm.map(m=>m.id)}; });

  console.log("\n[off: the weights alone, as before]");
  const base=await pg.evaluate(async()=>{ state.memJudgeOn=false; window.__judgeReqs=[];
    const r=await retrieveMemories("Annemin kolyesi",curChat(),"p_b"); state.memJudgeOn=true;
    return {recent:r.recent.map(m=>m.id),diary:r.diary.map(m=>m.id),longterm:r.longterm.map(m=>m.id),sent:window.__judgeReqs.length}; });
  ok("judge off: nothing is sent", base.sent===0, JSON.stringify(base));
  ok("judge off: the weights pick the recent coffee memories, not the necklace", !base.recent.includes("old"), JSON.stringify(base));

  console.log("\n[on: relevance decides]");
  await pg.evaluate(()=>{ window.__judgeReqs=[]; });
  const on=await run();
  ok("the memory the moment is about is recalled", on.recent[0]==="old", JSON.stringify(on));
  ok("an unrelated memory below the minimum is not recalled, even with a slot free", on.recent.length===1, JSON.stringify(on));
  ok("long-term: the relevant one only", JSON.stringify(on.longterm)==='["l2"]', JSON.stringify(on));

  const req=await pg.evaluate(()=>window.__judgeReqs);
  ok("one request for both injected tiers", req.length===1, req.length+" requests");
  const r0=req[0]||{body:{questions:{}},headers:{}};
  const qs=Object.values(r0.body.questions||{});
  ok("sent to the Decisions endpoint with the OpenRouter key", r0.url==="https://openrouter.ai/api/alpha/decisions"&&r0.headers.Authorization==="Bearer sk-test", r0.url+" "+JSON.stringify(r0.headers));
  ok("default model is openai/gpt-6-luna-decisions", r0.body.model==="openai/gpt-6-luna-decisions", r0.body.model);
  ok("the scene is the state and ends on the line being answered", typeof r0.body.state==="string"&&/kolye/i.test(r0.body.state), JSON.stringify(r0.body.state));
  ok("every today and long-term memory is asked about (a small bank fits the shortlist)", qs.length===8, qs.length+" questions");
  ok("diary entries are not asked about — they are never injected", !qs.some(q=>/aklımdan çıkmıyor|Spor salonuna gittim|Bugün Emre ile/.test(q.instructions)), "a diary was asked about");
  ok("each is a noul question with true/false criteria", qs.length>0&&qs.every(q=>q.type==="noul"&&q.criteria&&typeof q.criteria.true==="string"&&q.criteria.true.length>10&&typeof q.criteria.false==="string"), JSON.stringify(qs[0]));
  ok("each question carries its memory's text and the character's name, no placeholder left", qs.some(q=>/kolyeyi kaybettim/.test(q.instructions))&&qs.every(q=>/Burcu/.test(q.instructions)&&!/\{\{/.test(q.instructions+q.criteria.true+q.criteria.false)), JSON.stringify(qs[0]));
  ok("a memory of the scene being played is never asked about", await pg.evaluate(async()=>{
      state.memory.push({id:"now1",ownerId:"p_b",character:"Burcu",universeId:state.universes[0].id,content:"Şu an kafede kolye konuşuyoruz.",
        gameDay:7,gamePeriod:"Evening",importance:.9,type:"EXPERIENCE",people:["Emre"],location:"Cafe",date:71});
      window.__judgeReqs=[]; await retrieveMemories("Annemin kolyesi",curChat(),"p_b");
      state.memory=state.memory.filter(m=>m.id!=="now1");
      const q=Object.values(window.__judgeReqs[0].body.questions);
      return q.some(x=>/Şu an kafede/.test(x.instructions)) ? "asked about the current scene" : true; }));

  ok("the scene stops at the last travel beat: an earlier scene is not sent", await pg.evaluate(async()=>{
      const c=curChat(), keep=c.messages.slice();
      c.messages=[{mid:"b1",role:"assistant",speaker:"Narrator",narratorEvent:true,content:"Özlem plajda denize giriyor."},
        {mid:"b2",role:"assistant",speaker:"Narrator",narratorEvent:true,travelBeat:true,content:"Emre eve döner."},
        {mid:"b3",role:"user",content:"Annemin verdiği kolyeyi hatırlıyor musun?",speaker:state.user}];
      window.__judgeReqs=[]; await retrieveMemories("Annemin kolyesi",c,"p_b"); c.messages=keep;
      const st=window.__judgeReqs[0].body.state;
      return (!/plajda/.test(st)&&/eve döner/.test(st)&&/kolyeyi/.test(st)) ? true : JSON.stringify(st); }));

  console.log("\n[a large bank: a shortlist, under the cap]");
  const big=await pg.evaluate(async()=>{
    const keep=state.memory.slice(), uni=state.universes[0];
    for(let i=0;i<70;i++) state.memory.push({id:"c"+i,ownerId:"p_b",character:"Burcu",universeId:uni.id,
      content:"Emre ile kafede kahve içtik ve sporu konuştuk, gün "+i+".",gameDay:6,gamePeriod:"Midday",importance:.6,
      type:"EXPERIENCE",people:["Emre"],emotion:"neutral",location:"Cafe",date:60+i});
    window.genQuery=async()=>"annem kolye";            // the query points at the necklace; the weights at the coffee
    window.__judgeReqs=[]; const r=await retrieveMemories("Annemin kolyesi",curChat(),"p_b");
    window.genQuery=async()=>"emre kahve spor"; state.memory=keep;
    const q=Object.values(window.__judgeReqs[0].body.questions);
    return {n:q.length,old:q.some(x=>/kolyeyi kaybettim/.test(x.instructions)),recent:r.recent.map(m=>m.id),
      bytes:JSON.stringify(window.__judgeReqs[0].body).length}; });
  ok("a large bank sends a shortlist under the cap", big.n<=60&&big.n<81, JSON.stringify(big));
  ok("the shortlist holds what the query pointed at, and it is recalled", big.old&&big.recent[0]==="old", JSON.stringify(big));
  console.log("        (request size for "+big.n+" questions: "+big.bytes+" bytes)");

  console.log("\n[the floor]");
  const all=await pg.evaluate(async()=>{ state.memJudgeMin=0; const r=await retrieveMemories("Annemin kolyesi",curChat(),"p_b"); state.memJudgeMin=0.15;
    return {recent:r.recent.map(m=>m.id),longterm:r.longterm.map(m=>m.id)}; });
  ok("minimum 0 fills every slot, the relevant one first", all.recent.length===2&&all.recent[0]==="old"&&all.longterm.length===2&&all.longterm[0]==="l2", JSON.stringify(all));

  console.log("\n[failures rank exactly as with the judge off]");
  for(const mode of ["500","junk","network"]){
    const r=await pg.evaluate(async(mode)=>{ window.__judgeMode=mode; _memJudgeBreak.until=0; _memJudgeBreak.fails=0;
      const x=await retrieveMemories("Annemin kolyesi",curChat(),"p_b"); window.__judgeMode="ok";
      return {recent:x.recent.map(m=>m.id),diary:x.diary.map(m=>m.id),longterm:x.longterm.map(m=>m.id)}; },mode);
    ok("a "+mode+" answer: same memories as with the judge off", JSON.stringify(r)===JSON.stringify({recent:base.recent,diary:base.diary,longterm:base.longterm}), JSON.stringify(r)+" vs "+JSON.stringify(base));
  }
  ok("three network failures in a row pause it, with one toast", await pg.evaluate(async()=>{
      _memJudgeBreak.until=0; _memJudgeBreak.fails=0; window.__toasts=[]; window.__judgeMode="network";
      for(let i=0;i<3;i++) await retrieveMemories("Annemin kolyesi",curChat(),"p_b");
      window.__judgeReqs=[]; await retrieveMemories("Annemin kolyesi",curChat(),"p_b"); window.__judgeMode="ok";
      const paused=window.__judgeReqs.length===0, t=window.__toasts.filter(x=>/relevance judge paused/i.test(x)).length;
      _memJudgeBreak.until=0; _memJudgeBreak.fails=0;
      return (paused&&t===1) ? true : "requests after 3 failures="+window.__judgeReqs.length+" toasts="+t; }));
  ok("a 401 pauses it at once; a new key resumes it", await pg.evaluate(async()=>{
      _memJudgeBreak.until=0; window.__toasts=[]; window.__judgeMode="401";
      await retrieveMemories("Annemin kolyesi",curChat(),"p_b"); window.__judgeMode="ok";
      window.__judgeReqs=[]; await retrieveMemories("Annemin kolyesi",curChat(),"p_b");
      const pausedN=window.__judgeReqs.length;
      state.key="sk-new"; window.__judgeReqs=[]; const r=await retrieveMemories("Annemin kolyesi",curChat(),"p_b");
      const resumedN=window.__judgeReqs.length; state.key="sk-test"; _memJudgeBreak.until=0;
      return (pausedN===0&&resumedN===1&&r.recent[0].id==="old"&&window.__toasts.length===1) ? true
        : "paused="+pausedN+" resumed="+resumedN+" toasts="+JSON.stringify(window.__toasts); }));
  ok("a refused model (404) pauses it", await pg.evaluate(async()=>{
      _memJudgeBreak.until=0; window.__judgeMode="404";
      await retrieveMemories("Annemin kolyesi",curChat(),"p_b"); window.__judgeMode="ok";
      window.__judgeReqs=[]; await retrieveMemories("Annemin kolyesi",curChat(),"p_b");
      const n=window.__judgeReqs.length; _memJudgeBreak.until=0; return n===0 ? true : n+" requests while paused"; }));

  console.log("\n[nothing sent without the switch or a key]");
  ok("no key: nothing sent", await pg.evaluate(async()=>{ state.key=""; window.__judgeReqs=[];
      await retrieveMemories("Annemin kolyesi",curChat(),"p_b"); state.key="sk-test"; return window.__judgeReqs.length===0 ? true : window.__judgeReqs.length+" sent"; }));

  console.log("\n[model, prompts, trace, settings]");
  ok("the chosen model is sent", await pg.evaluate(async()=>{ state.memJudgeModel="typesafe/jev-1.13"; window.__judgeReqs=[];
      await retrieveMemories("Annemin kolyesi",curChat(),"p_b"); state.memJudgeModel="";
      return window.__judgeReqs[0].body.model==="typesafe/jev-1.13" ? true : window.__judgeReqs[0].body.model; }));
  ok("the three prompts are registry prompts filling {{char}} {{user}} {{memory}}", await pg.evaluate(()=>{
      const bad=["x_mem_relevance","x_mem_relevance_yes","x_mem_relevance_no"].filter(k=>{ const ph=promptPlaceholders(k);
        return !PROMPT_BY_KEY[k]||!["char","user","memory"].every(t=>ph.includes(t)); });
      const card=ENGINE_PAYLOAD_DEFS.find(d=>d.key==="memory_retrieval");
      const inCard=card&&["x_mem_relevance","x_mem_relevance_yes","x_mem_relevance_no"].every(k=>card.blocks.some(x=>x.promptKey===k));
      return (!bad.length&&inCard) ? true : "missing: "+bad.join(",")+" inCard="+inCard; }));
  ok("an edited question reaches the request", await pg.evaluate(async()=>{
      state.x_mem_relevance="Does {{char}} think of this now? {{memory}} (asked by {{user}})"; window.__judgeReqs=[];
      await retrieveMemories("Annemin kolyesi",curChat(),"p_b"); state.x_mem_relevance="";
      const q=Object.values(window.__judgeReqs[0].body.questions);
      return q.every(x=>/^Does Burcu think of this now\?/.test(x.instructions)) ? true : q[0].instructions; }));
  ok("the Debug trace carries each memory's relevance", await pg.evaluate(async()=>{
      await retrieveMemories("Annemin kolyesi",curChat(),"p_b");
      const e=dbgLog.slice().reverse().find(x=>/Memory retrieval/.test(x.label||""));
      const c=e&&e.payload.candidatesByTier.recent.find(x=>/kolyeyi kaybettim/.test(x.memory));
      const j=e&&e.payload.relevanceJudge;
      return (c&&c.facets.relevance===0.93&&c.injected&&j&&j.answered>0) ? true : JSON.stringify({c,j}); }));
  ok("the judge's own request is a Debug row", await pg.evaluate(()=>{
      const e=dbgLog.slice().reverse().find(x=>/Memory relevance judge/.test(x.label||""));
      return (e&&e.status==="ok"&&e.result&&e.result.relevance) ? true : JSON.stringify(e&&{s:e.status,r:e.result}); }));
  ok("settings round-trip and survive a reload", await pg.evaluate(()=>{
      state.memJudgeOn=false; state.memJudgeModel="typesafe/jev-1.13"; state.memJudgeMin=0.3; syncSettingsUI();
      const on=document.getElementById('setMemJudgeOn'), mo=document.getElementById('setMemJudgeModel'), mi=document.getElementById('setMemJudgeMin');
      if(!on||!mo||!mi) return "inputs missing";
      if(on.checked||mo.value!=="typesafe/jev-1.13"||+mi.value!==0.3) return "sync: "+on.checked+" "+mo.value+" "+mi.value;
      on.checked=true; mo.value=" openai/gpt-6-luna-decisions "; mi.value="7"; saveSettings(false);
      if(state.memJudgeOn!==true||state.memJudgeModel!=="openai/gpt-6-luna-decisions"||state.memJudgeMin!==1) return "save: "+JSON.stringify([state.memJudgeOn,state.memJudgeModel,state.memJudgeMin]);
      return (store.raw(K.memJudgeOn,"")==="1"&&store.raw(K.memJudgeModel,"")==="openai/gpt-6-luna-decisions"&&store.raw(K.memJudgeMin,"")==="1") ? true : "stored: "+store.raw(K.memJudgeOn,"?")+" "+store.raw(K.memJudgeMin,"?"); }));
  ok("a fresh install has it on, minimum 0.15", await pg.evaluate(()=>{
      localStorage.removeItem(K.memJudgeOn); localStorage.removeItem(K.memJudgeMin); localStorage.removeItem(K.memJudgeModel);
      loadState(); const s=state; return (s.memJudgeOn===true&&s.memJudgeMin===0.15&&s.memJudgeModel==="") ? true : JSON.stringify([s.memJudgeOn,s.memJudgeMin,s.memJudgeModel]); }));

  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close();
  process.exit(fail?1:0);
})().catch(e=>{ console.error(e); process.exit(1); });
