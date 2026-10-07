/* v150.53 — THE CLOCK FOLLOWS THE SCENE. Forty turns on the beach stayed "Midday" while the lines said the sun was
   going down. Riding the reply check's request: do the lines show the day has clearly moved on? A yes at 0.85 moves the
   clock one part on, at most once in six turns, never past Night.  Run: node tests/clock-follows.browser.js */
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
    window.__reqs=[]; window.__yes=0;
    const realF=window.fetch;
    window.fetch=async(u,o)=>{ if(String(u).indexOf("/api/alpha/decisions")>-1){ const body=JSON.parse(o.body); __reqs.push(body);
        const a={}; Object.keys(body.questions).forEach(k=>{ a[k]={type:"noul",noul:k==="time_moved"?__yes:0}; });
        return new Response(JSON.stringify({answers:a}),{status:200}); } return realF(u,o); };
    window.__setup=(per)=>{
      const uni=state.universes[0];
      state.personas=[{id:"p_d",name:"Duygu",universeId:uni.id,personality:"x",style:"x",look:{}}];
      Object.assign(state,{key:"k",user:"Emre",replyCheckOn:true,replyCheckAt:0.7,replyCheckModel:"",clockFollowOn:true});
      try{ _replyCheckBreak.until=0; _replyCheckBreak.fails=0; }catch(e){}
      const c=curChat(); Object.assign(c,{universeId:uni.id,presentIds:["p_d"],gameDay:4,period:per||"Midday",timeOfDay:per||"Midday",_clockMovedTurn:undefined,
        messages:[{mid:"u1",role:"user",content:'"Güneş batmak üzere."'}]});
      window.__reqs=[]; return c; };
    window.__reply=async(c,t)=>{ const m={mid:newMid(),role:"assistant",speaker:"Duygu",speakerId:"p_d",content:t}; c.messages.push(m);
      await runReplyCheck(c,m,state.personas[0]); return m; };
  });

  const A=await pg.evaluate(async()=>{ const c=__setup(); __yes=0.92; await __reply(c,'"Gün batımı çok güzel."');
    const q=__reqs[0]; return {q:q.questions.time_moved,st:q.state.story_clock,per:chatPeriod(c),note:(c.messages.find(m=>m.clockNote)||{}).content||""}; });
  ok("one more yes/no in the reply check, with the story clock in the state", !!A.q&&/Midday on day 4/.test(A.q.instructions)&&/Afternoon or later/.test(A.q.instructions)&&/the sun is going down/.test(A.q.criteria.true)&&A.st==="Day 4, Midday", JSON.stringify(A));
  ok("a yes at 0.92 moves the clock one part on, with a note in the story", A.per==="Afternoon"&&/Afternoon|öğleden sonra|Nachmittag/i.test(A.note), JSON.stringify(A));
  ok("and not again within six turns: the question is not even asked", await pg.evaluate(async()=>{ const c=curChat(); __reqs=[]; __yes=0.95;
      c.messages.push({mid:newMid(),role:"user",content:"x"}); await __reply(c,'"Hava karardı."');
      return (!__reqs[0].questions.time_moved&&chatPeriod(c)==="Afternoon")?true:JSON.stringify({q:!!__reqs[0].questions.time_moved,p:chatPeriod(c)}); }));
  ok("below 0.85 nothing moves", await pg.evaluate(async()=>{ const c=__setup(); __yes=0.8; await __reply(c,'"x"'); return chatPeriod(c)==="Midday"?true:chatPeriod(c); }));
  ok("never past Night: at Night it is not asked", await pg.evaluate(async()=>{ const c=__setup("Night"); __yes=0.99; await __reply(c,'"x"');
      return (!__reqs[0].questions.time_moved&&chatPeriod(c)==="Night"&&c.gameDay===4)?true:JSON.stringify({p:chatPeriod(c),d:c.gameDay}); }));
  ok("switched off: not asked", await pg.evaluate(async()=>{ const c=__setup(); state.clockFollowOn=false; __yes=0.99; await __reply(c,'"x"'); state.clockFollowOn=true;
      return (!__reqs[0].questions.time_moved&&chatPeriod(c)==="Midday")?true:"asked"; }));
  ok("both switches round-trip through Settings, and the question is on the Reply check card", await pg.evaluate(()=>{
      state.clockFollowOn=false; state.moveDecPlayer=false; syncSettingsUI(); const a=document.getElementById('setClockFollowOn'), b2=document.getElementById('setMoveDecPlayer');
      const off=a&&b2&&!a.checked&&!b2.checked; a.checked=true; b2.checked=true; saveSettings();
      const on=state.clockFollowOn===true&&state.moveDecPlayer===true&&store.raw(K.clockFollowOn,"")==="1";
      const card=X_PROMPT_CARDS.find(c=>c.keys.indexOf("x_clock_moved")>-1); return (off&&on&&!!card)?true:JSON.stringify({off,on,card:!!card}); }));

  ok("no page errors", errs.length===0?true:errs.join(" | "));
  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close(); process.exit(fail?1:0);
})();
