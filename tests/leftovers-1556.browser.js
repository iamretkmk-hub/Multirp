/* v150.56 — THE SMALLER ITEMS LEFT FROM TWO LIVE EXPORTS.
   · weekdays: writers that plan ahead are told the calendar has day numbers only;
   · the Story Book trims a passage cut off at the token limit back to its last whole sentence;
   · the pursuit reconcile reads only its own cast's memories (it credited Nil with Aslan Berk's afternoon);
   · a motive's kind is brought in line with its valence ("loyalty", hostile);
   · the emotion request does not send the settled view when it repeats the tie;
   · the arc tracker's summary is an English engine record;
   · a plan already on record leaves the "being discussed" watch list.
   Run: node tests/leftovers-1556.browser.js */
const {chromium}=require('playwright');
const fs=require('fs'), path=require('path');
(async()=>{
  const src=fs.readFileSync(path.resolve(__dirname,'..','index.html'),'utf8');
  const b=await chromium.launch({executablePath:process.env.SM_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage({viewport:{width:412,height:915}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file://'+path.resolve(__dirname,'..','index.html')); await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(800);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x===undefined?c:x).slice(0,700));} };

  console.log("\n[weekdays]");
  ok("the rule names today's day number and forbids weekdays", await pg.evaluate(()=>{ const r=noWeekdaysRule(4);
      return (/Today is day 4/.test(r)&&/"day 6"/.test(r)&&/never "Friday"/.test(r))?true:r; }));
  ok("the goal pursuit, the goals curator, the quest step and the quest spawn all carry it",
     /epSend\("goalPursuit",tpl\+"\\n\\n"\+noWeekdaysRule\(day\)/.test(src)&&/epSend\("goalsCurator",sys\+"\\n\\n"\+noWeekdaysRule\(day\)/.test(src)
     &&/epSend\("charQuestStep",tpl\+"\\n\\n"\+noWeekdaysRule\(day\)/.test(src)&&/epSend\("charQuestGen",tpl\+"\\n\\n"\+noWeekdaysRule\(day\)/.test(src), "not wired");

  console.log("\n[the Story Book]");
  const W=await pg.evaluate(()=>[_bkWholeEnd("Emre elini indirdi. Duygu güldü. \"Hallet de gör"),_bkWholeEnd("Whole. Ends well."),_bkWholeEnd('She said: "Fine." *nods*'),_bkWholeEnd("Short. And then a very long trailing piece that was cut off before it could ever reach its end at all")]);
  ok("a passage cut mid-sentence ends on its last whole sentence", W[0]==="Emre elini indirdi. Duygu güldü.", W[0]);
  ok("a whole passage, or one ending on a quote or an action, is left alone", W[1]==="Whole. Ends well."&&W[2]==='She said: "Fine." *nods*', JSON.stringify(W));
  ok("a cut that would lose most of it is not made", /reach its end at all$/.test(W[3]), W[3]);

  console.log("\n[the pursuit reconcile]");
  const R=await pg.evaluate(async()=>{
    const uni=state.universes[0]; const c=curChat();
    state.personas=[{id:"p_n",name:"Nil",universeId:uni.id,look:{}},{id:"p_a",name:"Aslan Berk",universeId:uni.id,look:{}}];
    uni.gameData=uni.gameData||{}; uni.gameData.charQuests=[{id:"cqn",status:"active",holderId:"p_n",holderName:"Nil",targetId:"__user__",delivered:true,title:"Get Emre to the dinner",desc:"x",ask:"come to dinner"}];
    Object.assign(c,{universeId:uni.id,gameDay:4}); state.key="k"; state.charQuestsOn=true; state.statusDecOn=false;
    state.memory=(state.memory||[]).filter(m=>m&&m.ownerId!=="p_n"&&m.ownerId!=="p_a");
    rememberMemory({id:"m_n1",ownerId:"p_n",character:"Nil",content:"I stayed home and cooked.",gameDay:4,gamePeriod:"Midday",chatId:c.id,universeId:uni.id,type:"EXPERIENCE",importance:0.5});
    rememberMemory({id:"m_a1",ownerId:"p_a",character:"Aslan Berk",content:"I spent the midday at the beach slides with Kerem and Deniz.",gameDay:4,gamePeriod:"Midday",chatId:c.id,universeId:uni.id,type:"EXPERIENCE",importance:0.5});
    let sent=""; const keep=window.chatCompletion; window.chatCompletion=async(m,mo,o)=>{ if(o&&o.dbg==="Char quest reconcile")sent=m.map(x=>x.content).join("\n"); return "[]"; };
    await reconcileCharQuestsForDay(c,4,uni,"Midday"); window.chatCompletion=keep; state.statusDecOn=true; return sent; });
  ok("only the holder's and the target's memories go in, never a bystander's", /I stayed home and cooked/.test(R)&&!/beach slides/.test(R), R.slice(0,800));

  console.log("\n[motives]");
  ok("a warm kind on a hostile motive becomes a grievance, a hostile kind on a warm one a reconciliation",
     /if\(v==="hostile"&&INTENT_WARM_KINDS\.has\(k\)\)it\.kind="grievance";/.test(src)&&/else if\(v==="warm"&&INTENT_HOSTILE_KINDS\.has\(k\)\)it\.kind="reconciliation";/.test(src)
     &&src.indexOf('INTENT_WARM_KINDS.has(k))it.kind="grievance"')<src.indexOf('const _g=await strictGate(chat,"motives · "'), "not before the gate");

  console.log("\n[the emotion request]");
  const M=await pg.evaluate(()=>[_mostlySame("Emre is someone I have known since we were all growing up here, a steady friend.","friend — Emre: known him since we were all growing up here, a steady friend who never pushes"),
      _mostlySame("Lately I find myself irritated by how he hovers and fusses over everything.","friend — Emre: known him since we were all growing up here")]);
  ok("the overlap test: the same paragraph yes, a new reading no", M[0]===true&&M[1]===false, JSON.stringify(M));
  ok("and _emoFeelState drops the settled view on that overlap", /if\(settled&&_mostlySame\(String\(settled\),who\)\)delete out\.settled_view;/.test(src), "not wired");

  console.log("\n[the arc tracker]");
  ok("both arc tracker calls ask for English records", (src.match(/up\("memEval"\),\{open_event:[a-z]+\.summary\|\|"\(nothing tracked yet\)",exchange\}\)\+"\\n\\n"\+engineLangDirective\(\)/g)||[]).length===2, "not both");

  console.log("\n[the watch list]");
  ok("a plan already on record leaves 'being discussed'; an unrelated one stays", await pg.evaluate(()=>{
    const uni=state.universes[0], c=curChat();
    uni.gameData.charQuests=[{id:"cqb",status:"active",holderId:"p_n",holderName:"Nil",title:"Fix Berker's boat engine before the weekend trip",desc:"Emre agreed to fix the boat engine for Berker"}];
    c.futureWatch=[{kind:"task",about:"Emre fixing the boat engine for Berker",since:0},{kind:"task",about:"painting the garden fence",since:0}];
    _ftWatchPrune(c); return JSON.stringify(c.futureWatch.map(w=>w.about))==='["painting the garden fence"]'?true:JSON.stringify(c.futureWatch); }));
  ok("it prunes before and after each tracker pass", (src.match(/_ftWatchPrune\(chat\);/g)||[]).length>=2, "count");

  ok("no page errors", errs.length===0?true:errs.join(" | "));
  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close(); process.exit(fail?1:0);
})();
