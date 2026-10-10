/* v150.99 — A REFUSAL THE REPLY CHECK SEES IS WRITTEN AGAIN BY THE FALLBACK MODEL. looksLikeRefusal sends the usual
   refusal wordings to the fallback model before anything is posted; one it does not know ("Bu konuda yardımcı olamam.")
   was posted, and the reply check's "refusal" flag only put a pill on it. With a fallback model set, the SAME payload the
   reply was written from goes to the fallback model and its answer overwrites the refused text in the same message.
   Nothing is removed or rolled back.
   Run: node tests/refusal-fallback.browser.js */
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
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x===undefined?c:x).slice(0,700));} };
  const REF="Bu konuda yardımcı olamam.";

  await pg.evaluate(REF=>{
    window.__p={refusal:0.95}; window.__calls=[];
    const realFetch=window.fetch;
    window.fetch=async(url,opts)=>{
      if(String(url).indexOf("/api/alpha/decisions")>-1){
        const body=JSON.parse(opts.body); const answers={};
        Object.keys(body.questions).forEach(k=>{ answers[k]={type:"noul",noul:(k in window.__p)?window.__p[k]:0.01}; });
        return new Response(JSON.stringify({answers}),{status:200});
      }
      return realFetch(url,opts);
    };
    window.__REF=REF; window.__fbRefuses=false; window.__PAYLOAD={messages:[{role:"system",content:"You are Burcu."},{role:"user",content:"Emre: Kahve ister misin?"}],opts:{rp:true,dbg:"Roleplay reply"},heat:false};
    window.chatCompletion=async(msgs,model,o)=>{ const d=(o&&o.dbg)||""; __calls.push({d,model,msgs});
      if(/^Roleplay reply/.test(d)) return (model==="fb/model"&&!window.__fbRefuses)?'*Burcu fincanı alır.* "Olur, bir kahve iyi gelir."':REF;
      return "{}"; };
    const uni=state.universes[0];
    state.personas=state.personas.filter(p=>p.id!=="p_b");
    state.personas.push({id:"p_b",name:"Burcu",universeId:uni.id,instructions:"x",personality:"Sharp.",backstory:"x",style:"Short.",goals:"x",look:{}});
    Object.assign(state,{user:"Emre",key:"sk-test",replyCheckOn:true,replyCheckAt:0.7,replyCheckModel:"",memJudgeOn:false,model:"main/model",fallbackModel:"fb/model",heatOn:false,heatModel:"",gmOn:false,presenceOff:true,imgMode:"off"});
    window.__setup=()=>{ const chat=curChat(); chat.presentIds=["p_b"]; chat.universeId=uni.id; state.curUniverse=uni.id;
      chat.messages=[{mid:"u1",role:"user",content:"Kahve ister misin?",speaker:"Emre"},
        {mid:"a1",role:"assistant",speaker:"Burcu",speakerId:"p_b",toId:"__user__",content:REF,genModel:"main/model",img:null,imgState:"idle",vidState:"idle",video:null}];
      _replyPayloads.set(chat.messages[1],__PAYLOAD);
      window.__calls=[]; return chat; };
  },REF);

  console.log("\n[a refusal the check sees]");
  const R=await pg.evaluate(async()=>{ const c=__setup(); const p=state.personas.find(x=>x.id==="p_b");
    const regex=looksLikeRefusal(c.messages[1].content);
    const before=JSON.stringify(c.messages.map(m=>m.mid));
    await runReplyCheck(c,c.messages[1],p);
    for(let i=0;i<60&&!/Olur/.test(c.messages[1].content);i++) await new Promise(r=>setTimeout(r,100));
    const rp=__calls.filter(x=>/^Roleplay reply/.test(x.d));
    return {regex,mids:JSON.stringify(c.messages.map(m=>m.mid))===before,m:c.messages[1],rp:rp.map(x=>({model:x.model,d:x.d,same:JSON.stringify(x.msgs)===JSON.stringify(__PAYLOAD.messages)}))}; });
  ok("the wording is one the pattern check does not know (so only the decision model can see it)", R.regex===false, JSON.stringify(R));
  ok("the same payload goes to the fallback model, once", R.rp.length===1&&R.rp[0].model==="fb/model"&&R.rp[0].same===true&&/fallback model \(refusal\)/.test(R.rp[0].d), JSON.stringify(R.rp));
  ok("its answer overwrites the refused text in the same message", R.m.mid==="a1"&&/Olur, bir kahve/.test(R.m.content)&&R.m.genModel==="fb/model"&&R.m.fbReplaced===true, JSON.stringify(R.m));
  ok("nothing is removed: every message is still there, in place", R.mids===true, JSON.stringify(R));
  ok("the refusal pill goes with the refusal", !(R.m.replyFlags||[]).includes("refusal"), JSON.stringify(R.m.replyFlags));
  ok("after the player answered it is still overwritten in place", await pg.evaluate(async()=>{ const c=__setup();
      c.messages.push({mid:"u2",role:"user",content:"Peki.",speaker:"Emre"});
      await runReplyCheck(c,c.messages[1],state.personas.find(x=>x.id==="p_b"));
      for(let i=0;i<60&&!/Olur/.test(c.messages[1].content);i++) await new Promise(r=>setTimeout(r,100));
      return (c.messages.length===3&&c.messages[1].mid==="a1"&&/Olur/.test(c.messages[1].content))?true:JSON.stringify(c.messages); }));

  console.log("\n[v150.100 — on screen]");
  const S=await pg.evaluate(async()=>{ const c=__setup(); const p=state.personas.find(x=>x.id==="p_b");
    try{ closeSettings&&closeSettings(); }catch(_){} renderChat();
    const node=()=>document.querySelector('.bubble[data-mid="a1"]');
    const r={drawn:!!node(), before:node()&&node().querySelector('.body').textContent};
    await runReplyCheck(c,c.messages[1],p);
    r.pillBefore=!!(node()&&node().querySelector('.replyFlag[data-flag="refusal"]'));
    for(let i=0;i<60&&!/Olur/.test((node()&&node().querySelector('.body').textContent)||"");i++) await new Promise(r=>setTimeout(r,100));
    r.after=node()&&node().querySelector('.body').textContent;
    r.pillAfter=!!(node()&&node().querySelector('.replyFlag[data-flag="refusal"]'));
    return r; });
  ok("the bubble shows the refusal before", S.drawn===true&&/yardımcı olamam/.test(S.before||""), JSON.stringify(S));
  ok("the bubble on screen shows the fallback model's reply after", /Olur, bir kahve/.test(S.after||"")&&!/yardımcı olamam/.test(S.after||""), JSON.stringify(S));
  ok("and the refusal pill is gone from it", S.pillAfter===false, JSON.stringify(S));
  ok("a line still typing out is drawn again once it has finished", await pg.evaluate(async()=>{ const c=__setup(); renderChat();
      _revealTimers["a1"]=12345;   // the typewriter is still on it
      await runReplyCheck(c,c.messages[1],state.personas.find(x=>x.id==="p_b"));
      for(let i=0;i<30&&!/Olur/.test(c.messages[1].content);i++) await new Promise(r=>setTimeout(r,100));
      const body=()=>document.querySelector('.bubble[data-mid="a1"] .body').textContent;
      const during=body(); delete _revealTimers["a1"];
      for(let i=0;i<20&&!/Olur/.test(body());i++) await new Promise(r=>setTimeout(r,100));
      return (/yardımcı olamam/.test(during)&&/Olur/.test(body()))?true:JSON.stringify({during,after:body()}); }));

  console.log("\n[when it does not]");
  const none=async(fn)=>pg.evaluate(async src=>{ const c=__setup(); const restore=(new Function("c",src))(c);
      await runReplyCheck(c,c.messages[1],state.personas.find(x=>x.id==="p_b")); await new Promise(r=>setTimeout(r,500));
      try{ if(typeof restore==="function")restore(); }catch(_){}
      return (c.messages[1].content===__REF&&!__calls.some(x=>/^Roleplay reply/.test(x.d)))?true:JSON.stringify({c:c.messages[1].content,calls:__calls.map(x=>x.d)}); },fn);
  ok("no fallback model set: the line stays, flagged, and nothing is asked", await none('state.fallbackModel=""; return ()=>{ state.fallbackModel="fb/model"; };'));
  ok("below the threshold: nothing is asked", await none('__p={refusal:0.3}; return ()=>{ __p={refusal:0.95}; };'));
  ok("the fallback model's own refusal is not asked again", await none('c.messages[1].genModel="fb/model";'));
  ok("no payload kept for it (after a reload): nothing is asked", await none('_replyPayloads.delete(c.messages[1]);'));
  ok("if the fallback model refuses too, the line stays as it was", await pg.evaluate(async()=>{ const c=__setup(); __fbRefuses=true;
      await runReplyCheck(c,c.messages[1],state.personas.find(x=>x.id==="p_b")); await new Promise(r=>setTimeout(r,500)); __fbRefuses=false;
      return (c.messages[1].content===__REF&&__calls.filter(x=>/^Roleplay reply/.test(x.d)).length===1)?true:JSON.stringify(c.messages[1]); }));
  ok("every reply path keeps its payload and model (solo, group, Gamemaster reaction)", await pg.evaluate(()=>{
      const src=document.documentElement.innerHTML; return ((src.match(/_replyPayloads\.set\(msg,g\.payload\)/g)||[]).length===3&&(src.match(/genModel:g\.model/g)||[]).length===3)?true:"missing"; }));
  ok("the generator returns the payload it sent", await pg.evaluate(async()=>{ const c=__setup(); const p=state.personas.find(x=>x.id==="p_b");
      const msgs=[{role:"system",content:"S"},{role:"user",content:"U"}];
      const g=await generateCharacterReply(c,p,msgs); return (g.payload&&g.payload.messages===msgs&&g.payload.opts&&g.payload.opts.rp===true)?true:JSON.stringify(g); }));

  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close(); process.exit(fail?1:0);
})();
