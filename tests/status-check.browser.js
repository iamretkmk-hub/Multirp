/* v150.55 — STATUS CHECKS AS DECISIONS. Whether a promise was kept or broken, a meeting happened or was missed, a task or
   quest was done or failed, was decided by several chat engines. It is one typed question per open item now (open, done,
   failed, called off): after a turn for what is in play, and for everything open when a part of the day ends, with the
   stretch and what people remember of it. The vetoes still hold; while it answers, the old engines do not close anything.
   Run: node tests/status-check.browser.js */
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:process.env.SM_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage({viewport:{width:412,height:915}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file://'+require('path').resolve(__dirname,'..','index.html')); await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(800);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x===undefined?c:x).slice(0,700));} };

  await pg.evaluate(()=>{
    window.__reqs=[]; window.__mode="ok"; window.__v={};   // text in the question → {verdict:p}
    const realF=window.fetch;
    window.fetch=async(u,o)=>{ if(String(u).indexOf("/api/alpha/decisions")>-1){ const body=JSON.parse(o.body); __reqs.push(body);
        if(__mode==="500")return new Response(JSON.stringify({error:{message:"x"}}),{status:500});
        const a={}; Object.keys(body.questions).forEach(k=>{ const q=body.questions[k]; const pr={open:1,done:0,failed:0,cancelled:0};
          Object.keys(__v).forEach(t=>{ if(q.instructions.indexOf(t)>=0){ Object.assign(pr,{open:0},__v[t]); } });
          a[k]={type:"choice",choice:Object.keys(pr).sort((x,y)=>pr[y]-pr[x])[0],probabilities:pr}; });
        return new Response(JSON.stringify({answers:a}),{status:200}); } return realF(u,o); };
    window.__setup=()=>{
      const uni=state.universes[0];
      state.personas=[{id:"p_d",name:"Duygu",universeId:uni.id,personality:"x",look:{}},{id:"p_b",name:"Berker",universeId:uni.id,personality:"x",look:{}}];
      Object.assign(state,{key:"k",user:"Emre",statusDecOn:true,gateAt:0.8,calOn:true,promiseOn:true,charQuestsOn:true});
      try{ _statusBreak.until=0; _statusBreak.fails=0; }catch(e){}
      uni.gameData=uni.gameData||{}; uni.gameData.charQuests=[{id:"cq1",status:"active",holderId:"p_d",holderName:"Duygu",targetId:"p_b",targetName:"Berker",title:"Make peace with Berker over the boat",desc:"Duygu wants Berker to apologise about the boat",doneWhen:"Berker apologises"}];
      uni.gameData.quests=[];
      const c=curChat(); Object.assign(c,{universeId:uni.id,presentIds:["p_d"],gameDay:4,period:"Midday",timeOfDay:"Midday",location:"Palmera Beach Club",
        promises:[{id:"pr1",holderId:"p_d",holderName:"Duygu",toId:"__user__",toName:"Emre",promise:"you will bring Emre the cold lemonade",status:"open",kind:"promise",day:4},
                  {id:"pr2",holderId:"__user__",holderName:"Emre",toId:"p_d",toName:"Duygu",promise:"you will never tell anyone about the boat",status:"open",kind:"secret",day:4},
                  {id:"pr3",holderId:"__user__",holderName:"Emre",toId:"p_d",toName:"Duygu",promise:"you will call Ayça about the dinner tonight",status:"open",kind:"promise",day:4}],
        calendar:[{id:"ca1",kind:"meeting",title:"Lunch with Duygu at the Bamboo Bar",who:"Duygu, Emre",charIds:["p_d"],charId:"p_d",withUser:true,day:4,period:"Midday",where:"Bamboo Bar",detail:"lunch"},
                  {id:"ca2",kind:"meeting",title:"Dinner with Duygu at the Bamboo Bar tomorrow",who:"Duygu, Emre",charIds:["p_d"],charId:"p_d",withUser:true,day:5,period:"Evening",where:"Bamboo Bar",detail:"dinner"}],
        messages:[{mid:"u1",role:"user",content:'"Where is the lemonade you promised? And the lunch at the Bamboo Bar?"'},
                  {mid:"a1",role:"assistant",speaker:"Duygu",speakerId:"p_d",content:'*hands him the cold lemonade* "Here. And forget lunch at the Bamboo Bar, about the boat — Berker never apologised. Dinner tomorrow?"'}]});
      state.memory=(state.memory||[]).filter(m=>m&&m.ownerId!=="p_d");
      window.__reqs=[]; window.__mode="ok"; window.__v={}; return c; };
  });

  console.log("\n[after a turn]");
  const T=await pg.evaluate(async()=>{ const c=__setup();
    __v={"cold lemonade":{done:0.9},"Lunch with Duygu":{failed:0.88},"Dinner with Duygu":{done:0.95},"never tell anyone":{done:0.9}};
    const n=await runStatusCheck(c,{mode:"turn"}); const q=__reqs[0]||{questions:{},state:{}};
    const qs=Object.values(q.questions);
    return {n,count:qs.length,crit:qs.map(x=>Object.keys(x.criteria).join(",")),ins:qs.map(x=>x.instructions.split("\n")[1]||""),st:q.state,
      pr:c.promises.map(p=>p.id+":"+p.status),ca:c.calendar.map(e=>e.id+":"+(e.done?e.outcome:"open"))}; });
  ok("one request, one question per item in play: open / done / failed / called off, with the item's own facts", T.count>=4&&T.crit.every(c=>c==="open,done,failed,cancelled")&&T.ins.some(x=>/MEETING: Lunch with Duygu/.test(x))&&T.ins.some(x=>/PROMISE: Duygu → Emre/.test(x)), JSON.stringify(T.ins));
  ok("the state is now and the latest exchange", /Day 4, Midday, at Palmera Beach Club/.test(T.st.now)&&/hands him the cold lemonade/.test(T.st.latest_exchange), JSON.stringify(T.st).slice(0,400));
  ok("kept at 0.9: the promise is kept", T.pr.indexOf("pr1:kept")>=0, JSON.stringify(T.pr));
  ok("missed at 0.88: the meeting is closed as missed", T.ca.indexOf("ca1:missed")>=0, JSON.stringify(T.ca));
  ok("a meeting still ahead cannot have happened: refused, still open", T.ca.indexOf("ca2:open")>=0, JSON.stringify(T.ca));
  ok("a word that holds for good is not kept by one afternoon: refused, still open", T.pr.indexOf("pr2:open")>=0, JSON.stringify(T.pr));
  ok("what the lines do not show stays open", T.pr.indexOf("pr3:open")>=0&&T.n===2, JSON.stringify({n:T.n,pr:T.pr}));

  ok("below the bar (0.7) nothing closes", await pg.evaluate(async()=>{ const c=__setup(); __v={"cold lemonade":{done:0.7,open:0.3}};
      await runStatusCheck(c,{mode:"turn"}); return c.promises[0].status==="open"?true:c.promises[0].status; }));
  ok("a broken word to a character is remembered by them", await pg.evaluate(async()=>{ const c=__setup(); __v={"call Ayça":{failed:0.9}};
      await runStatusCheck(c,{mode:"turn"}); const m=(state.memory||[]).filter(x=>x.ownerId==="p_d"&&/broke their word/.test(x.content));
      return (c.promises[2].status==="broken"&&m.length===1)?true:JSON.stringify({s:c.promises[2].status,m:m.length}); }));
  ok("a pursuit done: closed through its own completion", await pg.evaluate(async()=>{ const c=__setup(); __v={"Make peace with Berker":{done:0.9}};
      c.messages.push({mid:"a2",role:"assistant",speaker:"Duygu",speakerId:"p_d",content:'"Berker finally apologised about the boat. Peace with Berker."'});
      await runStatusCheck(c,{mode:"turn"}); const q=state.universes[0].gameData.charQuests[0]; return q.status==="done"?true:q.status; }));

  console.log("\n[when a part of the day ends]");
  const S=await pg.evaluate(async()=>{ const c=__setup(); c.presentIds=[]; c.messages=[];
    rememberMemory({id:"m_s1",ownerId:"p_d",character:"Duygu",content:"I had lunch with Emre at the Bamboo Bar.",gameDay:4,gamePeriod:"Midday",chatId:c.id,universeId:c.universeId,type:"EXPERIENCE",importance:0.5});
    __v={"Lunch with Duygu":{done:0.9}};
    const n=await runStatusCheck(c,{mode:"stretch",day:4,period:"Midday"}); const q=__reqs[0]||{questions:{},state:{}};
    return {n,count:Object.keys(q.questions).length,st:q.state,ca:c.calendar[0].done?c.calendar[0].outcome:"open",ok:c._statusOkDay}; });
  ok("every open item is asked about, nobody being present", S.count===6, String(S.count));
  ok("the state is the stretch and what people remember of it", /Day 4, Midday — the stretch that just ended/.test(S.st.judging)&&JSON.stringify(S.st.what_people_remember_of_it).indexOf("Duygu: I had lunch with Emre")>=0&&typeof S.st.the_stretch==="string", JSON.stringify(S.st).slice(0,500));
  ok("the meeting it remembers is closed as met, and the day is marked as judged", S.ca==="met"&&S.ok===4, JSON.stringify(S));
  ok("it runs first at a period end", await pg.evaluate(()=>{ const f=String(_runPeriodEnginesNow); const a=f.indexOf("runStatusCheck"), b=f.indexOf("runFutureReconcile"); return (a>0&&a<b)?true:"order"; }));

  console.log("\n[the older engines defer while it answers]");
  ok("the future update, the reconcile, the promise engine and the day-end reconcilers no longer close anything themselves", await pg.evaluate(()=>{
      const u=String(runFutureUpdate), r=String(runFutureReconcile), pe=String(runPromiseEngine), cal=String(reconcileCalendarDay), qv=String(_reconcileQuestVerdicts), cq=String(reconcileCharQuestsForDay);
      return (/ended:statusDecActive\(chat\)\?"":j\.ended/.test(u)&&/_sdh=statusDecActive\(chat,day\)/.test(r)&&/if\(f&&_sdh&&f\.ended\)/.test(r)&&/if\(statusDecActive\(chat\)\)return;/.test(pe)
        &&/if\(statusDecActive\(chat,day\)\)return;/.test(cal)&&/_sd=statusDecActive\(chat,day\)/.test(qv)&&/if\(!_sd&&T\(r\.done\)\)/.test(cq))?true:"not wired"; }));
  ok("they step aside only once it has answered that day", await pg.evaluate(async()=>{ const c=__setup(); delete c._statusOkDay; const before=statusDecActive(c);
      await runStatusCheck(c,{mode:"turn"}); const after=statusDecActive(c); c.gameDay=5; const nextDay=statusDecActive(c); c.gameDay=4;
      return (before===false&&after===true&&nextDay===false)?true:JSON.stringify({before,after,nextDay}); }));
  ok("a failed request: no answer (null), nothing closed, and the older engines still may", await pg.evaluate(async()=>{ const c=__setup(); __mode="500"; __v={"cold lemonade":{done:0.95}};
      const r=await runStatusCheck(c,{mode:"turn"}); return (r===null&&c.promises[0].status==="open")?true:JSON.stringify({r,s:c.promises[0].status}); }));
  ok("switched off: no request, and the older engines decide", await pg.evaluate(async()=>{ const c=__setup(); state.statusDecOn=false;
      const r=await runStatusCheck(c,{mode:"turn"}); const h=statusDecHandles(c); state.statusDecOn=true; return (r===null&&__reqs.length===0&&h===false)?true:JSON.stringify({r,n:__reqs.length,h}); }));
  ok("the switch round-trips through Settings, and the three questions are on the Strict gates card", await pg.evaluate(()=>{
      state.statusDecOn=false; syncSettingsUI(); const box=document.getElementById('setStatusDecOn'); const a=box&&box.checked===false; box.checked=true; saveSettings();
      const b2=state.statusDecOn===true&&store.raw(K.statusDecOn,"")==="1"; const card=X_PROMPT_CARDS.find(c=>c.keys.indexOf("x_status_meeting")>-1);
      return (a&&b2&&card&&card.keys.indexOf("x_status_promise")>-1&&card.keys.indexOf("x_status_task")>-1)?true:JSON.stringify({a,b2,card:!!card}); }));

  ok("no page errors", errs.length===0?true:errs.join(" | "));
  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close(); process.exit(fail?1:0);
})();
