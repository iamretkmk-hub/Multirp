const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage({viewport:{width:412,height:915}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file:///home/user/Multirp/index.html'); await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(900);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x||c).slice(0,400));} };

  await pg.evaluate(()=>{
    const uni=state.universes[0];
    if(!state.personas.some(p=>p.id==="p_m"))
      state.personas.push({id:"p_m",name:"Duygu",universeId:uni.id,instructions:"x",personality:"x",
        backstory:"x",style:"x",goals:"x",look:{}});
    const chat=curChat(); chat.presentIds=["p_m"]; chat.gameDay=3; chat.period="Midday"; chat.timeOfDay="Midday";
    state.mem=true; state.key=state.key||"sk-test";
    state.memory=[
      {id:"mm_now1",ownerId:"p_m",character:"Duygu",content:"NOW_A — the scene I am in",gameDay:3,gamePeriod:"Midday",importance:.8,type:"EXPERIENCE",date:1},
      {id:"mm_now2",ownerId:"p_m",character:"Duygu",content:"NOW_B — same scene, later beat",gameDay:3,gamePeriod:"Midday",importance:.7,type:"EXPERIENCE",date:2},
      {id:"mm_morn",ownerId:"p_m",character:"Duygu",content:"EARLIER_TODAY — the morning",gameDay:3,gamePeriod:"Morning",importance:.6,type:"EXPERIENCE",date:3},
      {id:"mm_yest",ownerId:"p_m",character:"Duygu",content:"YESTERDAY — day two",gameDay:2,gamePeriod:"Evening",importance:.6,type:"EXPERIENCE",date:4},
      {id:"mm_old", ownerId:"p_m",character:"Duygu",content:"UNSTAMPED — from before this change",gameDay:3,importance:.6,type:"EXPERIENCE",date:5}
    ];
  });

  console.log("\n[the now is not a memory]");
  ok("memories from this day AND this period are excluded", await pg.evaluate(async()=>{
      const r=await retrieveMemories("test",curChat(),"p_m");
      const all=[...(r.recent||[]),...(r.diary||[]),...(r.longterm||[])].map(m=>m.content).join("|");
      return all.indexOf("NOW_A")===-1 && all.indexOf("NOW_B")===-1 ? true : all.slice(0,200); }));
  ok("earlier today, different period, still reaches the character", await pg.evaluate(async()=>{
      const r=await retrieveMemories("morning",curChat(),"p_m");
      const all=[...(r.recent||[]),...(r.diary||[]),...(r.longterm||[])].map(m=>m.content).join("|");
      return all.indexOf("EARLIER_TODAY")>-1 ? true : all.slice(0,200); }));
  ok("a memory with no period recorded is never dropped", await pg.evaluate(async()=>{
      const r=await retrieveMemories("before",curChat(),"p_m");
      const all=[...(r.recent||[]),...(r.diary||[]),...(r.longterm||[])].map(m=>m.content).join("|");
      return all.indexOf("UNSTAMPED")>-1 ? true : all.slice(0,200); }));
  ok("the exclusion follows the clock", await pg.evaluate(async()=>{
      const chat=curChat(); chat.period="Evening"; chat.timeOfDay="Evening";
      const r=await retrieveMemories("test",chat,"p_m");
      const all=[...(r.recent||[]),...(r.diary||[]),...(r.longterm||[])].map(m=>m.content).join("|");
      chat.period="Midday"; chat.timeOfDay="Midday";
      // now that it is Evening, the Midday pair is a real past memory again
      return all.indexOf("NOW_A")>-1 ? true : "midday memories still hidden in the evening"; }));

  console.log("\n[new memories carry the part of the day]");
  ok("memsOfPeriod finds exactly that stretch", await pg.evaluate(()=>{
      const n=memsOfPeriod("p_m",3,"Midday").length, m=memsOfPeriod("p_m",3,"Morning").length;
      return n===2 && m===1 ? true : "midday="+n+" morning="+m; }));
  ok("it ignores diaries and consolidations", await pg.evaluate(()=>{
      state.memory.push({id:"mm_d",ownerId:"p_m",content:"D",gameDay:3,gamePeriod:"Midday",type:"DIARY",date:9});
      const n=memsOfPeriod("p_m",3,"Midday").length;
      state.memory=state.memory.filter(m=>m.id!=="mm_d");
      return n===2; }));

  console.log("\n[the reconcile fires on a period change, not a day roll]");
  ok("moving the clock within a day calls it", await pg.evaluate(()=>{
      const chat=curChat(); chat.gameDay=3; chat.period="Midday";
      const seen=[]; const real=window.onPeriodChanged;
      window.onPeriodChanged=(c,d,p)=>seen.push(d+"/"+p);
      advanceTime(chat,1);
      window.onPeriodChanged=real; chat.period="Midday"; chat.gameDay=3;
      return seen.length===1 && seen[0]==="3/Midday" ? true : JSON.stringify(seen); }));
  ok("a day roll passes the day that ended, so the guard can see it", await pg.evaluate(()=>{
      const chat=curChat(); chat.gameDay=3; chat.period="Night";
      const seen=[]; const real=window.onPeriodChanged;
      window.onPeriodChanged=(c,d,p)=>seen.push({d,p,now:c.gameDay});
      advanceTime(chat,1);   // Night -> Morning of day 4
      window.onPeriodChanged=real; chat.gameDay=3; chat.period="Midday";
      return seen.length===1 && seen[0].d===3 && seen[0].now===4 ? true : JSON.stringify(seen); }));
  ok("and the guard actually refuses a day roll", await pg.evaluate(()=>{
      const chat=curChat(); chat.gameDay=4; chat.period="Morning";
      let called=0; const real=window.flushMemoryArc;
      window.flushMemoryArc=()=>{called++;return Promise.resolve();};
      onPeriodChanged(chat,3,"Night");    // previous day -> must not reconcile
      window.flushMemoryArc=real; chat.gameDay=3; chat.period="Midday";
      return called===0; }));
  ok("nothing happens when the clock did not move", await pg.evaluate(()=>{
      const chat=curChat(); chat.gameDay=3; chat.period="Midday";
      let called=0; const real=window.flushMemoryArc;
      window.flushMemoryArc=()=>{called++;return Promise.resolve();};
      onPeriodChanged(chat,3,"Midday");
      window.flushMemoryArc=real;
      return called===0; }));

  console.log("\n[the reconcile itself]");
  ok("a single fragment is left alone", await pg.evaluate(async()=>{
      let called=0; const real=window.chatCompletion;
      window.chatCompletion=()=>{called++;return Promise.resolve("{}");};
      await reconcilePeriodFor(state.personas.find(p=>p.id==="p_m"),3,"Morning");
      window.chatCompletion=real;
      return called===0; }));
  ok("several fragments become one memory", await pg.evaluate(async()=>{
      const real=window.chatCompletion;
      window.chatCompletion=()=>Promise.resolve(JSON.stringify({memories:[
        {content:"RECONCILED — the whole midday, held as one thing",importance:0.9,emotion:"tense",
         people:["Emre"],tags:["mirror"],location:"Emre's flat"}]}));
      await reconcilePeriodFor(state.personas.find(p=>p.id==="p_m"),3,"Midday");
      window.chatCompletion=real;
      const left=state.memory.filter(m=>m.ownerId==="p_m"&&m.gameDay===3&&m.gamePeriod==="Midday");
      return left.length===1 && left[0].content.indexOf("RECONCILED")>-1
          && left[0].source==="reconciled" && left[0].reconciledFrom===2
        ? true : JSON.stringify(left.map(m=>m.content)); }));
  ok("it keeps the highest importance of what it replaced", await pg.evaluate(()=>{
      const m=state.memory.find(x=>x.source==="reconciled");
      return m && m.importance>=0.8; }));
  ok("a failed call loses nothing", await pg.evaluate(async()=>{
      state.memory.push(
        {id:"f1",ownerId:"p_m",character:"Duygu",content:"FRAG_1",gameDay:5,gamePeriod:"Night",importance:.5,type:"EXPERIENCE",date:1},
        {id:"f2",ownerId:"p_m",character:"Duygu",content:"FRAG_2",gameDay:5,gamePeriod:"Night",importance:.5,type:"EXPERIENCE",date:2});
      const real=window.chatCompletion;
      window.chatCompletion=()=>Promise.reject(new Error("boom"));
      await reconcilePeriodFor(state.personas.find(p=>p.id==="p_m"),5,"Night");
      window.chatCompletion=real;
      return memsOfPeriod("p_m",5,"Night").length===2; }));
  ok("unparseable output loses nothing either", await pg.evaluate(async()=>{
      const real=window.chatCompletion;
      window.chatCompletion=()=>Promise.resolve("not json at all");
      await reconcilePeriodFor(state.personas.find(p=>p.id==="p_m"),5,"Night");
      window.chatCompletion=real;
      return memsOfPeriod("p_m",5,"Night").length===2; }));
  ok("it will not split beyond three", await pg.evaluate(async()=>{
      const real=window.chatCompletion;
      window.chatCompletion=()=>Promise.resolve(JSON.stringify({memories:[1,2,3,4,5].map(i=>({content:"R"+i}))}));
      await reconcilePeriodFor(state.personas.find(p=>p.id==="p_m"),5,"Night");
      window.chatCompletion=real;
      return memsOfPeriod("p_m",5,"Night").length===3; }));

  console.log("\n[the prompt is yours to edit]");
  ok("registered and editable", await pg.evaluate(()=>
      !!PROMPT_BY_KEY.memReconcile && up("memReconcile").length>200));
  ok("it forbids quoting dialogue back", await pg.evaluate(()=>
      up("memReconcile").indexOf("quoted lines get re-said")>-1));
  ok("listed as an engine payload", await pg.evaluate(()=>!!epDef("memReconcile")));

  ok("no page errors", errs.length===0?true:errs.join(" | "));
  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close(); process.exit(fail?1:0);
})();
