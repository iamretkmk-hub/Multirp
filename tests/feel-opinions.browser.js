/* v150.111 — THE CONNECTED FEELING SYSTEM, STEP 3: OPINIONS, EACH PART OF THE DAY. When a part of the day ends (and at once after
   a big event), one call per character over the people they dealt with: each opinion rose or fell from what the person DID (the
   signals kept as evidence, raw moments counting more), what the character felt about them, and what they remember — never
   from how the character feels about themselves; a one-line read; the resolution re-examined. The code moves the numbers.
   Run: node tests/feel-opinions.browser.js */
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:process.env.SM_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage({viewport:{width:412,height:915}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file://'+require('path').resolve(__dirname,'..','index.html')); await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(800);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x===undefined?c:x).slice(0,900));} };
  const E=(f,a)=>pg.evaluate(f,a);

  await E(()=>{
    window.__calls=[]; window.__opAns=null;
    window.chatCompletion=async(msgs,model,opts)=>{ const dbg=(opts&&opts.dbg)||""; const t=(Array.isArray(msgs)?msgs:[]).map(m=>m.content).join("\n");
      window.__calls.push({dbg,t});
      if(/^Opinions ·/.test(dbg))return JSON.stringify(window.__opAns||{people:[]});
      return "{}"; };
    const uni=state.universes[0]; state.curUniverse=uni.id;
    state.personas=state.personas.filter(p=>!/^fo_/.test(p.id));
    state.personas.push({id:"fo_m",name:"Mara",universeId:uni.id,personality:"Warm.",look:{},temper:{reactivity:50,recovery:50,expressiveness:40,impulsivity:50,conscience:70,mood:0},
      relationships:{fo_t:{tie:"husband",relationship:"Married ten years."},fo_l:{tie:"neighbour",relationship:"The man next door."}}});
    state.personas.push({id:"fo_t",name:"Tomas",universeId:uni.id,personality:"x",look:{}});
    state.personas.push({id:"fo_l",name:"Leo",universeId:uni.id,personality:"x",look:{}});
    state.key="sk-test"; state.emoOn=true; state.relOn=true; state.memory=[]; state.user="Emre";
    const c=curChat(); Object.assign(c,{universeId:uni.id,presentIds:["fo_m","fo_l"],emo:{},feel:{},rel:{},fsv:1,fsTurn:5,gameDay:3,period:"Afternoon",messages:[]});
    const o=relObj(c,"fo_m","fo_l"); Object.assign(o,{affection:20,trust:20,attraction:40,familiarity:30}); Object.assign(o.op,{kind:10,reliable:10,respects:10,safe:10,interested:10,appealing:30});
    const h=relObj(c,"fo_m","fo_t"); Object.assign(h,{commitment:80,affection:50});
    window.__P=id=>state.personas.find(p=>p.id===id);
  });

  console.log("\n[what the stretch leaves behind]");
  await E(()=>{ const c=curChat(), m=__P("fo_m");
    fsCascade(c,m,{kind:"release",cause:"it happened"});
    fsCascade(c,m,{kind:"crossed_line",with:"fo_l",wronged:"fo_t",cause:"slept with Leo"});
    fsSignal(c,m,"fo_l","care",{cause:"he asked how she was, after"});
    fsSignal(c,m,"fo_l","reassurance",{cause:"he said nobody will know"});
    fsLogFeel(c,"fo_m","fo_l","warmth",14,"he held her");
    state.memory.push({id:"om1",ownerId:"fo_m",content:"I slept with Leo while Tomas was away. He was gentle about it after.",gameDay:3,gamePeriod:"Afternoon",type:"EXPERIENCE",chatId:c.id,universeId:c.universeId}); });
  const pend=await E(()=>_fsOpPending(curChat(),__P("fo_m")));
  ok("the pair with Leo has something to update (evidence, the feelings log)", pend.includes("fo_l"), JSON.stringify(pend));

  console.log("\n[one call per character, over the people they dealt with]");
  await E(()=>{ window.__calls=[]; window.__opAns={people:[{name:"Leo",opinions:{kind:"rose",reliable:"unchanged",respects:"rose_a_little",safe:"rose",interested:"rose",appealing:"unchanged"},
      read:"You think he is kinder than you gave him credit for.",resolution:{kind:"keep_distance",text:"You have decided it cannot happen again.",strength:"passing"}}]}; });
  const r1=await E(async()=>{ const c=curChat(); const before=JSON.stringify(c.rel["fo_m>fo_l"].op);
    await runOpinionUpdates(c,3,"Afternoon");
    const calls=window.__calls.filter(x=>/^Opinions ·/.test(x.dbg)); const o=c.rel["fo_m>fo_l"];
    return {n:calls.length,dbg:calls.map(x=>x.dbg),t:calls[0]&&calls[0].t,before,op:o.op,read:o.opRead,res:o.res,ev:o.evidence.length,log:o.feelLog.length,hist:(o.opHist||[]).length,at:o.opAt}; });
  ok("one call for Mara, covering Leo", r1.n===1&&/Opinions · Mara · Leo/.test(r1.dbg[0]), JSON.stringify(r1.dbg));
  ok("it is told what he did — the care counted more because she was raw — and what she felt about him", /- care, checking on them \(when you were raw — it counted more\): he asked how she was/.test(r1.t)&&/reassurance/.test(r1.t)&&/Warmth: rose 14/.test(r1.t), (r1.t||"").slice(0,2500));
  ok("…and that her guilt is about HER, not evidence about him", /Guilt about yourself, because of what happened with them \(it wrongs Tomas\)[^\n]*this is about YOU, not evidence about them/.test(r1.t), (r1.t||"").match(/Guilt[^\n]*/));
  ok("…with the relationship, how she saw him before, and what she remembers", /The relationship \(slow, counts most\): Love/.test(r1.t)&&/How you saw them before this stretch:/.test(r1.t)&&/I slept with Leo while Tomas was away/.test(r1.t));
  ok("the prompt: what the person did, never how she feels about herself; bad weighs more; the resolution re-examined", await E(()=>{ const d=X_ENGINE_PROMPTS.x_opinion_update.def;
      return /never evidence about the other person/.test(d)&&/Bad evidence weighs more than good/.test(d)&&/softens when they keep being kind/.test(d); }));
  ok("the answers move her opinions (kind, safe, interested up), with the read and the resolution", r1.op.kind>10&&r1.op.safe>10&&r1.op.interested>10&&r1.op.reliable===10&&/kinder/.test(r1.read)&&r1.res&&r1.res.kind==="keep_distance"&&r1.res.strength==="passing", JSON.stringify(r1));
  ok("the stretch's evidence is used up; a snapshot of the day's opinions is kept for the night", r1.ev===0&&r1.log===0&&r1.hist===1&&r1.at.per==="Afternoon", JSON.stringify(r1));

  console.log("\n[the resolution is not written once]");
  await E(()=>{ const c=curChat(), m=__P("fo_m"); fsSignal(c,m,"fo_l","attention",{cause:"he brought her coffee"}); fsSignal(c,m,"fo_l","care",{cause:"he checked on her"});
    window.__opAns={people:[{name:"Leo",opinions:{kind:"rose"},read:"You keep coming back to how gentle he is.",resolution:{kind:"approach",text:"You want to see him again, carefully.",strength:"passing"}}]}; });
  const r2=await E(async()=>{ const c=curChat(); c.period="Evening"; await runOpinionUpdates(c,3,"Evening"); const o=c.rel["fo_m>fo_l"];
    return {res:o.res,t:window.__calls.filter(x=>/^Opinions ·/.test(x.dbg)).slice(-1)[0].t}; });
  ok("it is shown her resolution, and a kind evening softens it", /What you had resolved toward them \(keep_distance, passing, day 3\): You have decided it cannot happen again/.test(r2.t)&&r2.res.kind==="approach", JSON.stringify(r2.res));
  ok("a pair with nothing new is not asked about", await E(async()=>{ window.__calls=[]; await runOpinionUpdates(curChat(),3,"Night"); return window.__calls.filter(x=>/^Opinions ·/.test(x.dbg)).length===0?true:"asked"; }));

  console.log("\n[a big event updates it now]");
  ok("a betrayal updates her opinion of him at once, not at the end of the stretch", await E(async()=>{ window.__calls=[]; const c=curChat(), m=__P("fo_m");
      window.__opAns={people:[{name:"Leo",opinions:{reliable:"fell_a_lot",safe:"fell"},read:"You do not trust him now.",resolution:{kind:"end_it",text:"It is over.",strength:"firm"}}]};
      fsSignal(c,m,"fo_l","betrayal",{cause:"he told Tomas"}); c.fsTurn++;
      fsMaybeEarlyOpinion(c,m,"fo_l",{signals:["betrayal"],events:[]}); await new Promise(r=>setTimeout(r,400));
      const call=window.__calls.find(x=>/^Opinions ·/.test(x.dbg)); const o=c.rel["fo_m>fo_l"];
      return (call&&/updated early: something big just happened/.test(call.t)&&o.res.kind==="end_it"&&o.op.reliable<0)?true:JSON.stringify({call:!!call,res:o.res,op:o.op}); }));

  console.log("\n[when it runs]");
  ok("when a part of the day ends", await E(async()=>{ const real=window.runOpinionUpdates; let got=null; window.runOpinionUpdates=async(c,d,p)=>{ got={d,p}; };
      try{ const c=curChat(); c.gameDay=3; c.period="Midday"; advanceTime(c,1); await new Promise(r=>setTimeout(r,600)); }finally{ window.runOpinionUpdates=real; }
      return (got&&got.d===3&&got.p==="Midday")?true:JSON.stringify(got); }));
  ok("and at the day end, before the relationship is read", await E(async()=>{ const real=window.runOpinionUpdates; let got=null; window.runOpinionUpdates=async(c,d,p)=>{ got={d,p}; };
      try{ await runDailyRelationships(curChat(),3,[]); }finally{ window.runOpinionUpdates=real; }
      return (got&&got.d===3&&got.p===null)?true:JSON.stringify(got); }));
  ok("not with the feeling system off", await E(async()=>{ window.__calls=[]; state.emoOn=false; const c=curChat(), m=__P("fo_m"); fsSignal(c,m,"fo_l","care",{});
      await runOpinionUpdates(c,3,"Evening"); state.emoOn=true; return window.__calls.length===0?true:"ran"; }));
  ok("the prompt is listed under Opinions and encounters", await E(()=>{ const card=X_PROMPT_CARDS.find(x=>x.key==="opinions"); return !!(card&&card.keys.includes("x_opinion_update")&&PROMPT_BY_KEY.x_opinion_update); }));

  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close(); process.exit(fail?1:0);
})();
