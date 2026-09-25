/* v134.1 — DOES RETRIEVAL FIND WHAT THE QUERY ASKS FOR, OR JUST THE LATEST MEMORIES?
   Reported: a memory given tags, a scene using those very words, a query line naming them — and
   the memory was never even among the candidates. Four causes, each checked here:
     1. the semantic facet was (cosine+1)/2, so real cosines (a narrow band) moved it by a quarter
        of a point while people-present, recency and importance moved it by more;
     2. the lexical fallback divided hits by every word of the last two messages;
     3. a vector made before the memory was edited (tags added) was kept for ever;
     4. a memory added by hand is stamped "now" and was dropped as the current scene.
   Embeddings are stubbed with a bag-of-topics vector on top of a large shared component, which is
   what makes real cosines bunch together.
   Run: node tests/memory-retrieval.browser.js */
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage({viewport:{width:412,height:915}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file://'+require('path').resolve(__dirname,'..','index.html'));
  await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(800);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x||c).slice(0,600));} };

  await pg.evaluate(()=>{
    const VOCAB=["kolye","hediye","annem","emre","kahve","spor","plaj","yemek","telefon","iş"];
    window.__embCalls=0;
    window.__fakeVec=t=>{ t=String(t||"").toLocaleLowerCase("tr");
      return [6].concat(VOCAB.map(w=>(t.split(w).length-1))); };
    const realFetch=window.fetch;
    window.fetch=async(url,opts)=>{
      if(String(url).indexOf("embeddings")>-1){
        window.__embCalls++;
        const body=JSON.parse(opts.body);
        return new Response(JSON.stringify({data:[{embedding:window.__fakeVec(body.input)}]}),{status:200});
      }
      return realFetch(url,opts);
    };
    window.genQuery=async()=>"kolye hediye annem";
    const uni=state.universes[0];
    state.personas=state.personas.filter(p=>p.id!=="p_b"&&p.id!=="p_e");
    state.personas.push({id:"p_b",name:"Burcu",universeId:uni.id,instructions:"x",personality:"x",backstory:"x",style:"x",goals:"x",look:{}});
    state.personas.push({id:"p_e",name:"Emre",universeId:uni.id,instructions:"x",personality:"x",backstory:"x",style:"x",goals:"x",look:{}});
    const chat=curChat(); chat.presentIds=["p_b","p_e"]; chat.gameDay=7; chat.period="Evening"; chat.location="Cafe";
    chat.universeId=uni.id; state.curUniverse=uni.id;
    chat.messages=[{role:"user",content:"Annemin verdiği kolyeyi hatırlıyor musun? Hani o hediye.",speaker:state.user}];
    state.mem=true; state.key="sk-test"; state.embedOn=true; state.embedKey="ek-test";
    state.memRecentCount=2; state.memPerTypeCap=0;
    const mk=(id,day,per,content,extra)=>Object.assign({id,ownerId:"p_b",character:"Burcu",universeId:uni.id,
      content,gameDay:day,gamePeriod:per,importance:.7,type:"EXPERIENCE",people:["Emre"],emotion:"neutral",
      location:"Cafe",date:day*10},extra||{});
    state.memory=[
      mk("r1",7,"Morning","Emre ile kahve içtik, spor salonundan bahsettik."),
      mk("r2",7,"Midday","Emre ile plajda yürüdük."),
      mk("r3",6,"Evening","Emre akşam yemeğine geldi."),
      mk("r4",6,"Night","Emre gece telefon açtı."),
      mk("r5",5,"Midday","Emre ile iş hakkında konuştuk."),
      // the one the scene is asking about: old, nobody present in it, somewhere else, tagged
      mk("old",1,"Midday","Evde eski eşyaları topladım.",{people:["Ayşe"],location:"Ev",importance:.5,
        tags:["kolye","hediye","annem"]})
    ];
  });

  const ids=r=>(r.recent||[]).map(m=>m.id);

  console.log("\n[semantic: the query decides, not the clock]");
  ok("the tagged memory the query names is injected, embeddings on", await pg.evaluate(async()=>{
      await ensureMemEmbeddings("p_b",32);
      const r=await retrieveMemories("Annemin kolyesi",curChat(),"p_b");
      return r.recent.some(m=>m.id==="old") ? true : "recent = "+r.recent.map(m=>m.id).join(","); }));
  ok("its semantic facet is the top of the scale, not squeezed into a quarter of it", await pg.evaluate(async()=>{
      const r=await retrieveMemories("Annemin kolyesi",curChat(),"p_b");
      const e=dbgLog.slice().reverse().find(x=>/Memory retrieval/.test(x.label||""));
      const c=e&&e.payload.candidatesByTier.recent.find(x=>/eski eşyaları/.test(x.memory));
      if(!c) return "no trace entry for it";
      return (c.facets.semantic===1) ? true : JSON.stringify(c); }));
  ok("with no relevant query, the recent, present-person memories still win", await pg.evaluate(async()=>{
      window.genQuery=async()=>"emre kahve spor";
      const r=await retrieveMemories("kahve?",curChat(),"p_b");
      window.genQuery=async()=>"kolye hediye annem";
      return !r.recent.some(m=>m.id==="old") ? true : "recent = "+r.recent.map(m=>m.id).join(","); }));

  console.log("\n[lexical fallback: the keyword line, not the whole scene]");
  ok("with embeddings off, the tagged memory is still found", await pg.evaluate(async()=>{
      state.embedOn=false;
      state.memory.forEach(m=>{ delete m.vec; delete m.vecSig; });
      curChat().messages.push({role:"assistant",speaker:"Burcu",content:
        "*Burcu bardağını masaya koydu, pencereden dışarı baktı, uzun uzun sustu, sonra saçını kulağının arkasına attı ve derin bir nefes aldı.* Bilmiyorum, belki. O gün çok şey oldu, hepsini hatırlamıyorum ama bir şeyler var aklımda."});
      const r=await retrieveMemories("Annemin kolyesi",curChat(),"p_b");
      state.embedOn=true;
      return r.recent.some(m=>m.id==="old") ? true : "recent = "+r.recent.map(m=>m.id).join(","); }));

  console.log("\n[an edited memory is re-embedded]");
  ok("a vector made before tags were added is recognised as stale", await pg.evaluate(async()=>{
      const m=state.memory.find(x=>x.id==="r5");
      delete m.vec; delete m.vecSig;
      await ensureMemEmbeddings("p_b",32);
      const fresh=!memNeedsEmbed(m);
      m.tags=["kolye"];
      return (fresh && memNeedsEmbed(m)) ? true : "fresh="+fresh+" stale="+memNeedsEmbed(m); }));
  ok("and the backfill replaces it with one that carries the tags", await pg.evaluate(async()=>{
      const m=state.memory.find(x=>x.id==="r5");
      await ensureMemEmbeddings("p_b",32);
      return (!memNeedsEmbed(m) && m.vec[1]===1) ? true : JSON.stringify(m.vec); }));
  ok("a vector from before signatures existed is kept for scoring but queued", await pg.evaluate(()=>{
      const m=state.memory.find(x=>x.id==="r4");
      delete m.vecSig;
      return (!!memVec(m) && memNeedsEmbed(m)) ? true : "vec="+!!memVec(m); }));
  ok("saving the editor re-embeds at once", await pg.evaluate(async()=>{
      const m=state.memory.find(x=>x.id==="r3");
      openMemEditor("r3");
      document.getElementById('memEditTags').value="annem, hediye";
      const before=window.__embCalls;
      saveMemEdit();
      await new Promise(r=>setTimeout(r,200));
      return (window.__embCalls>before && !memNeedsEmbed(m) && m.vec[3]===1) ? true
        : "calls "+before+"→"+window.__embCalls+" stale="+memNeedsEmbed(m); }));

  console.log("\n[a memory written by hand is not the scene being played]");
  ok("a manual memory stamped with this day and period is still recalled", await pg.evaluate(async()=>{
      state.memory.push({id:"man",ownerId:"p_b",character:"Burcu",universeId:state.curUniverse,source:"manual",
        content:"Annem bana altın bir kolye hediye etti.",gameDay:7,gamePeriod:"Evening",importance:.6,
        type:"KNOWLEDGE",people:[],tags:["kolye"],date:999});
      const r=await retrieveMemories("Annemin kolyesi",curChat(),"p_b");
      return r.recent.some(m=>m.id==="man") ? true : "recent = "+r.recent.map(m=>m.id).join(","); }));
  ok("an arc memory of this same stretch is still left out", await pg.evaluate(async()=>{
      state.memory.push({id:"arcnow",ownerId:"p_b",character:"Burcu",universeId:state.curUniverse,
        content:"Annemin kolyesini konuştuk, kolye hediye.",gameDay:7,gamePeriod:"Evening",importance:.9,
        type:"EXPERIENCE",people:["Emre"],tags:["kolye","hediye","annem"],date:1000});
      const r=await retrieveMemories("Annemin kolyesi",curChat(),"p_b");
      return !r.recent.some(m=>m.id==="arcnow") ? true : "recent = "+r.recent.map(m=>m.id).join(","); }));

  console.log("\n[the per-type cap refills in rank order]");
  ok("a slot freed by the cap goes to the next best match, not the oldest memory", await pg.evaluate(async()=>{
      state.memPerTypeCap=1; state.memRecentCount=2;
      state.memory=state.memory.filter(m=>m.id!=="man"&&m.id!=="arcnow");
      const u=state.curUniverse;
      state.memory.unshift({id:"oldest",ownerId:"p_b",character:"Burcu",universeId:u,content:"Plajda yürüdüm.",
        gameDay:1,gamePeriod:"Morning",importance:.1,type:"OBSERVATION",people:[],date:1});
      state.memory.push({id:"obs2",ownerId:"p_b",character:"Burcu",universeId:u,content:"Annemin kolyesini vitrinde gördüm, hediye gibi.",
        gameDay:6,gamePeriod:"Midday",importance:.6,type:"OBSERVATION",people:["Emre"],tags:["kolye","annem"],date:2000});
      await ensureMemEmbeddings("p_b",32);
      const r=await retrieveMemories("Annemin kolyesi",curChat(),"p_b");
      state.memPerTypeCap=0;
      const got=r.recent.map(m=>m.id);
      return (!got.includes("oldest") && got.length===2) ? true : "recent = "+got.join(","); }));

  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log(`\n  ${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail?1:0);
})();
