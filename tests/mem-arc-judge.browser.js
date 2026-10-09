/* v150.89 — reported: a night out came back as one "reconciled" memory of ~2,500 words — every fragment back to back.
   "The memory arc is triggering very often. Ask the decision model if the arc has completely ended; first create fewer
   arcs, then reconcile them better."
   1. The arc judge (Decisions API): two yes/no questions — has the stretch completely ended, did something separate begin.
      Unsure is "still going"; it closes only at MEM_ARC_DEC_AT. The chat tracker is asked only when the judge is off or has
      no answer. An arc the judge holds gets the old backstop of 40 lines; the chat tracker's keeps 12.
   2. The reconciler's length guard: a memory over MEM_RECON_MAX_WORDS, or an answer as long as most of what went in, is
      sent back once with its length named; the shorter answer replaces it; a failed or longer retry leaves the first.
   Run: NODE_PATH=/path/to/node_modules node tests/mem-arc-judge.browser.js */
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

  await pg.evaluate(()=>{
    window.toast=()=>{};
    window.__setup=(n)=>{
      const uni=state.universes[0]; state.curUniverse=uni.id; state.user="Emre"; state.key="sk-test"; state.mem=true; state.memArcDec=true; state.autoCharOn=false;
      state.personas=state.personas.filter(p=>p.id!=="aj_d"); state.personas.push({id:"aj_d",name:"Duygu",universeId:uni.id,look:{},personality:"x",instructions:"x"});
      _memArcBreak.until=0; _memArcBreak.fails=0;
      const c=curChat(); Object.assign(c,{universeId:uni.id,presentIds:["aj_d"],gameDay:2,period:"Night",memDoneIdx:-1,memEvent:null,messages:[]});
      for(let i=0;i<(n||4);i++)c.messages.push(i%2===0?{mid:"u"+i,role:"user",content:'"Line '+i+'."',present:["aj_d"]}:{mid:"a"+i,role:"assistant",speaker:"Duygu",speakerId:"aj_d",content:'"Answer '+i+'."',present:["aj_d"]});
      window.__commits=[]; window.__evals=0; window.__decBodies=[]; try{ _memBuildSeen.delete(c); }catch(_){}   // the same lines judged again: a fresh judgement
      window.commitMemoryArc=async(chat,from,to)=>{ __commits.push([from,to]); return {failed:0,wrote:1}; };
      window.chatCompletion=async(m,mo,o)=>{ if(/Memory arc tracker/.test((o&&o.dbg)||"")){ __evals++; return JSON.stringify({progress:"ongoing",topic:"same",summary:"x"}); } return "{}"; };
      return c; };
    window.__dec=(over,nw,fail)=>{ const rf=window.__rf||(window.__rf=window.fetch);
      window.fetch=async(u,o)=>{ if(String(u).indexOf("/api/alpha/decisions")<0)return rf(u,o); const body=JSON.parse(o.body); __decBodies.push(body);
        if(fail)return new Response(JSON.stringify({error:{message:"boom"}}),{status:500});
        return new Response(JSON.stringify({answers:{arc_over:{noul:over},arc_new:{noul:nw}}}),{status:200}); }; };
    window.__undec=()=>{ if(window.__rf)window.fetch=window.__rf; };
    window.__step=async(c,add)=>{ if(add){ const i=c.messages.length; c.messages.push(i%2===0?{mid:"u"+i,role:"user",content:'"Line '+i+'."',present:["aj_d"]}:{mid:"a"+i,role:"assistant",speaker:"Duygu",speakerId:"aj_d",content:'"Answer '+i+'."',present:["aj_d"]}); }
      await maybeBuildMemory(c); };
  });

  console.log("\n[1 — the arc judge]");
  const A=await pg.evaluate(async()=>{ const r={};
    let c=__setup(6); __dec(0.4,0.3); await __step(c); r.unsure={commits:__commits.slice(),evals:__evals,ev:!!(c.memEvent&&c.memEvent.open)};
    const b=__decBodies[0]; r.body={q:b&&Object.keys(b.questions),st:b&&Object.keys(b.state),latest:b&&b.state.latest_lines.length,over:b&&b.questions.arc_over.type};
    c=__setup(6); __dec(0.92,0.1); await __step(c); r.over={commits:__commits.slice(),evals:__evals};
    c=__setup(8); c.memEvent={startIdx:0,open:true,paused:false,summary:""}; __dec(0.2,0.9); await __step(c); r.sep={commits:__commits.slice(),next:c.memEvent&&c.memEvent.startIdx};
    c=__setup(6); state.memArcDec=false; __dec(0.95,0.95); await __step(c); r.off={commits:__commits.slice(),evals:__evals,dec:__decBodies.length}; state.memArcDec=true;
    c=__setup(6); __dec(0,0,true); await __step(c); r.failed={evals:__evals,dec:__decBodies.length};
    __undec(); return r; });
  ok("unsure (0.4 over, 0.3 separate): the arc stays open, nothing is cut, the chat tracker is not asked", A.unsure.commits.length===0&&A.unsure.evals===0&&A.unsure.ev, JSON.stringify(A.unsure));
  ok("one request, two yes/no questions, with the stretch so far and the latest lines", JSON.stringify(A.body.q)==='["arc_over","arc_new"]'&&A.body.over==="noul"&&A.body.st.includes("arc_so_far")&&A.body.st.includes("latest_lines")&&A.body.latest>0, JSON.stringify(A.body));
  ok("completely over (0.92): the whole arc is cut as one", A.over.commits.length===1&&A.over.commits[0][0]===0&&A.over.commits[0][1]===5&&A.over.evals===0, JSON.stringify(A.over));
  ok("something separate began (0.9): the arc closes before the line that began it, the new one opens there", A.sep.commits.length===1&&A.sep.commits[0][1]===5&&A.sep.next===6, JSON.stringify(A.sep));
  ok("judge off: the chat tracker decides, no Decisions request", A.off.evals===1&&A.off.dec===0, JSON.stringify(A.off));
  ok("judge failed: the chat tracker decides that turn", A.failed.evals===1&&A.failed.dec>=1, JSON.stringify(A.failed));

  const CAP=await pg.evaluate(async()=>{ const c=__setup(4); c.memEvent={startIdx:0,open:true,paused:false,summary:"x"}; __dec(0.2,0.1);
    let firstAt=-1; for(let i=0;i<44&&firstAt<0;i++){ await __step(c,true); if(__commits.length)firstAt=c.messages.length; }
    __undec(); return {firstAt,commit:__commits[0]}; });
  ok("an arc the judge keeps open is cut by the backstop at 40 lines, not 12", CAP.firstAt>=40&&CAP.commit&&CAP.commit[1]-CAP.commit[0]+1>=40, JSON.stringify(CAP));

  console.log("\n[2 — the reconciler sends a transcript back]");
  const words=n=>Array.from({length:n},(_,i)=>"w"+i).join(" ")+".";
  const R=await pg.evaluate(async(W)=>{ const r={};
    const mk=()=>{ const uni=state.universes[0]; const c=curChat(); state.personas=state.personas.filter(p=>p.id!=="aj_d"); state.personas.push({id:"aj_d",name:"Duygu",universeId:uni.id,look:{},personality:"x",instructions:"x"});
      state.mem=true; state.key="sk-test"; state.memory=[]; c.universeId=uni.id;
      const base={ownerId:"aj_d",character:"Duygu",gameDay:2,gamePeriod:"Night",universeId:uni.id,chatId:c.id,importance:0.6,source:"auto",location:"Arsuz Night Club",type:"EXPERIENCE"};
      for(let i=1;i<=12;i++)state.memory.push(Object.assign({id:"g"+i,content:"Beat "+i+" "+W.slice(0,140)},base));
      return c; };
    const run=async(first,second)=>{ const c=mk(); const calls=[];
      window.chatCompletion=async(m,mo,o)=>{ const d=(o&&o.dbg)||""; calls.push(d); if(/too long, sent back/.test(d)){ calls.sent=JSON.stringify(m); return second; } return first; };
      await reconcilePeriodFor(state.personas.find(p=>p.id==="aj_d"),2,"Night",c);
      const m=state.memory.filter(x=>x.ownerId==="aj_d"); return {n:m.length,words:m.map(x=>(x.content.match(/\S+/g)||[]).length),calls:calls.length,sent:calls.sent||"",frag:m.some(x=>/^Beat/.test(x.content))}; };
    const longMem=JSON.stringify({memories:[{content:W,importance_score:0.9,type:"INTIMACY",feelings:"f",status:"secret"}]});
    const shortMem=JSON.stringify({memories:[{content:"I met Emre at the club and we slept together in his lounge; I went home to my husband.",importance_score:0.9,type:"INTIMACY",status:"secret"}]});
    r.fixed=await run(longMem,shortMem);
    r.kept=await run(longMem,"not json");
    r.ok=await run(shortMem,shortMem);
    return r; },words(400));
  ok("a 400-word merge is sent back once, with its length named, and the short answer replaces it", R.fixed.n===1&&R.fixed.words[0]<40&&R.fixed.calls===2&&/400 words/.test(R.fixed.sent)&&/at most about 120 words/.test(R.fixed.sent)&&!R.fixed.frag, JSON.stringify(Object.assign({},R.fixed,{sent:R.fixed.sent.slice(0,200)})));
  ok("a retry that fails leaves the first answer (the fragments are never lost)", R.kept.n===1&&R.kept.words[0]===400&&R.kept.calls===2, JSON.stringify(R.kept));
  ok("a short answer is not sent back", R.ok.n===1&&R.ok.calls===1, JSON.stringify(R.ok));

  const S=await pg.evaluate(()=>{ show('settings'); const e=document.getElementById('setMemArcDec'); if(!e)return {box:false};
    e.checked=false; saveSettings(false); const off=state.memArcDec===false; e.checked=true; saveSettings(false);
    return {box:true,off,on:state.memArcDec===true,prompts:!!(X_ENGINE_PROMPTS.x_mem_arc_over&&X_ENGINE_PROMPTS.x_mem_arc_new)}; });
  ok("Settings → Memory: the arc judge switch saves both ways; its two questions are editable prompts", S.box&&S.off&&S.on&&S.prompts, JSON.stringify(S));

  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close(); process.exit(fail?1:0);
})();
