/* v150.73 — reported: "Check this memory consolidation. The memories are extremely long and almost keeping everything
   verbatim. Also the shower memory never saved as a memory. Rewrite the reconciler's prompt. It should keep the important
   details but not include everything."
   Covered here:
     1. every answer the reconciler returns is stored (it kept the first three and dropped the rest — the shower and the
        goodbye — after deleting every fragment); past five, the rest is folded into the fifth, never thrown away;
     2. the reckoning after a heat scene (source after_heat) is not folded into the stretch: it stays its own record;
     3. the shipped prompt says what to keep, what to drop, how long, how many, and that only a decision's own subject
        reverses it;
     4. a stored copy that is exactly the v150.72 default is upgraded; an edited one is left alone.
   Run: NODE_PATH=/path/to/node_modules node tests/mem-reconcile-keep.browser.js */
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

  const setup=()=>pg.evaluate(()=>{
    const uni=state.universes[0]; state.curUniverse=uni.id;
    state.personas=state.personas.filter(p=>p.id!=="p_bk");
    state.personas.push({id:"p_bk",name:"Buket",universeId:uni.id,instructions:"x",personality:"x",backstory:"x",style:"x",goals:"x",look:{}});
    state.user="Emre"; state.key="sk-test"; state.mem=true; state.memMinImp=0; state.embedOn=false;
    const chat=curChat(); chat.universeId=uni.id; chat.gameDay=5; chat.period="Afternoon";
    state.memory=[]; window.__calls=[];
    window.chatCompletion=async(msgs,model,opts)=>{ const d=(opts&&opts.dbg)||""; window.__calls.push({dbg:d,text:JSON.stringify(msgs)}); return window.__reply(d,msgs); };
    return true;
  });
  const frags=n=>pg.evaluate(n=>{ const chat=curChat(); const base={ownerId:"p_bk",character:"Buket",gameDay:5,gamePeriod:"Afternoon",universeId:chat.universeId,chatId:chat.id,importance:0.5,source:"auto",location:"Emre's House",type:"EXPERIENCE"};
    for(let i=1;i<=n;i++)state.memory.push(Object.assign({id:"f"+i,content:"Fragment "+i+"."},base)); return true; },n);

  console.log("\n[1 — every answer is stored]");
  await setup(); await frags(8);
  const A=await pg.evaluate(async()=>{
    const mk=t=>({content:t,importance_score:0.7,type:"INTIMACY",feelings:"f"});
    window.__reply=()=>JSON.stringify({memories:[mk("The texts."),mk("The kitchen."),mk("The bedroom."),mk("The shower."),mk("The goodbye.")]});
    await reconcilePeriodFor(state.personas.find(p=>p.id==="p_bk"),5,"Afternoon",curChat());
    const m=state.memory.filter(x=>x.ownerId==="p_bk");
    return {n:m.length, shower:m.some(x=>x.content==="The shower."), bye:m.some(x=>x.content==="The goodbye."), frag:m.some(x=>/^Fragment/.test(x.content))};
  });
  ok("five answers, five memories: the shower and the goodbye are kept", A.n===5&&A.shower&&A.bye&&!A.frag, JSON.stringify(A));
  await setup(); await frags(8);
  const B=await pg.evaluate(async()=>{
    const mk=t=>({content:t,importance_score:0.5});
    window.__reply=()=>JSON.stringify({memories:[mk("One."),mk("Two."),mk("Three."),mk("Four."),mk("Five."),mk("Six."),mk("Seven.")]});
    await reconcilePeriodFor(state.personas.find(p=>p.id==="p_bk"),5,"Afternoon",curChat());
    const m=state.memory.filter(x=>x.ownerId==="p_bk");
    return {n:m.length, last:(m.find(x=>/^Five\./.test(x.content))||{}).content};
  });
  ok("past five, the rest is folded into the fifth, not thrown away", B.n===5&&B.last==="Five. Six. Seven.", JSON.stringify(B));

  console.log("\n[2 — the reckoning after a heat scene stays its own record]");
  await setup(); await frags(3);
  const C=await pg.evaluate(async()=>{
    const chat=curChat();
    state.memory.push({id:"ah1",ownerId:"p_bk",character:"Buket",gameDay:5,gamePeriod:"Afternoon",universeId:chat.universeId,chatId:chat.id,
      content:"I have decided this was not an accident.",type:"DECISION",importance:0.75,source:"after_heat"});
    const ids=memsOfPeriod("p_bk",5,"Afternoon",chat).map(m=>m.id);
    window.__reply=()=>JSON.stringify({memories:[{content:"The afternoon.",importance_score:0.6}]});
    await reconcilePeriodFor(state.personas.find(p=>p.id==="p_bk"),5,"Afternoon",chat);
    const sent=(__calls.find(x=>/Memory reconcile/.test(x.dbg))||{}).text||"";
    return {ids, inPrompt:/not an accident/.test(sent), kept:state.memory.some(m=>m.id==="ah1")};
  });
  ok("not among the stretch's fragments, not sent, and still there afterwards", JSON.stringify(C.ids)==='["f1","f2","f3"]'&&!C.inPrompt&&C.kept, JSON.stringify(C));

  console.log("\n[3 — the prompt]");
  const P=await pg.evaluate(()=>{ const d=DEFAULT_MEMRECONCILE;
    return {keep:/KEEP what they would still know a week later/.test(d), drop:/DROP the road there/.test(d), len:/at most about 120 words/.test(d),
      sex:/never a stroke-by-stroke account either/.test(d)&&/Never "we had sex"/.test(d), many:/Never more than five/.test(d)&&/the shower, the goodbye/.test(d),
      quote:/at most one per memory/.test(d), strict:/only that decision's own subject can reverse it/.test(d),
      kept:/ONE ENCOUNTER, ONE MEMORY/.test(d)&&/WHAT THIS STRETCH RESOLVED/.test(d)&&/"status":""/.test(d)&&/- feelings: what the stretch left them carrying/.test(d),
      noThree:!/Never more than three/.test(d)}; });
  ok("says what to keep, what to drop, how long, how many and how to tell intimacy", P.keep&&P.drop&&P.len&&P.sex&&P.many&&P.quote&&P.noThree, JSON.stringify(P));
  ok("only a decision's own subject reverses it", P.strict, JSON.stringify(P));
  ok("keeps one-encounter, status and resolves", P.kept, JSON.stringify(P));

  console.log("\n[4 — stored copies]");
  await pg.evaluate(()=>{ store.setRaw(K.memReconcile,MEMRECONCILE_V150_72_OLD); });
  await pg.reload(); await pg.waitForTimeout(2400);
  const U=await pg.evaluate(()=>state.memReconcile===DEFAULT_MEMRECONCILE);
  ok("an untouched v150.72 copy is upgraded", U===true);
  await pg.evaluate(()=>{ store.setRaw(K.memReconcile,MEMRECONCILE_V150_72_OLD+"\nMY EDIT"); });
  await pg.reload(); await pg.waitForTimeout(2400);
  const E=await pg.evaluate(()=>({edit:/MY EDIT/.test(state.memReconcile), old:/Never more than three/.test(state.memReconcile)}));
  ok("an edited copy is left alone", E.edit&&E.old, JSON.stringify(E));

  ok("no page errors", errs.length===0?true:errs.join(" | "));
  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close(); process.exit(fail?1:0);
})();
