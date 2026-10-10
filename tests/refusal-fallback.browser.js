/* v150.99 — A REFUSAL THE REPLY CHECK SEES IS WRITTEN AGAIN BY THE FALLBACK MODEL. looksLikeRefusal sends the usual
   refusal wordings to the fallback model before anything is posted; one it does not know ("Bu konuda yardımcı olamam.")
   was posted, and the reply check's "refusal" flag only put a pill on it. With a fallback model set, a flagged refusal is
   retried once with it as soon as the turn has finished, through the Retry path: the refused line goes, the fallback
   model's reply takes its place.
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
    window.chatCompletion=async(msgs,model,o)=>{ const d=(o&&o.dbg)||""; __calls.push({d,model});
      if(/^Roleplay reply/.test(d)) return model==="fb/model"?'*Burcu fincanı alır.* "Olur, bir kahve iyi gelir."':REF;
      return "{}"; };
    const uni=state.universes[0];
    state.personas=state.personas.filter(p=>p.id!=="p_b");
    state.personas.push({id:"p_b",name:"Burcu",universeId:uni.id,instructions:"x",personality:"Sharp.",backstory:"x",style:"Short.",goals:"x",look:{}});
    Object.assign(state,{user:"Emre",key:"sk-test",replyCheckOn:true,replyCheckAt:0.7,replyCheckModel:"",memJudgeOn:false,model:"main/model",fallbackModel:"fb/model",heatOn:false,heatModel:"",gmOn:false,presenceOff:true,imgMode:"off"});
    window.__setup=()=>{ const chat=curChat(); chat.presentIds=["p_b"]; chat.universeId=uni.id; state.curUniverse=uni.id;
      chat.messages=[{mid:"u1",role:"user",content:"Kahve ister misin?",speaker:"Emre"},
        {mid:"a1",role:"assistant",speaker:"Burcu",speakerId:"p_b",toId:"__user__",content:REF,genModel:"main/model",img:null,imgState:"idle",vidState:"idle",video:null}];
      window.__calls=[]; return chat; };
  },REF);

  console.log("\n[a refusal the check sees]");
  const R=await pg.evaluate(async()=>{ const c=__setup(); const p=state.personas.find(x=>x.id==="p_b");
    looksLikeRefusal(c.messages[1].content);
    const regex=looksLikeRefusal(c.messages[1].content);
    await runReplyCheck(c,c.messages[1],p);
    for(let i=0;i<100&&(c.messages.some(m=>m.mid==="a1")||!c.messages.some(m=>m.role==="assistant"&&/Olur/.test(m.content||"")));i++) await new Promise(r=>setTimeout(r,100));
    const last=[...c.messages].reverse().find(m=>m.role==="assistant"&&!m.sysError&&!m.uiNote);
    return {regex,old:c.messages.some(m=>m.mid==="a1"),last:last&&{content:last.content,model:last.genModel},fb:__calls.filter(x=>/^Roleplay reply/.test(x.d)).map(x=>x.model+" | "+x.d)}; });
  ok("the wording is one the pattern check does not know (so only the decision model can see it)", R.regex===false, JSON.stringify(R));
  ok("the fallback model is asked for the reply again", R.fb.length===1&&/^fb\/model \| Roleplay reply.*fallback model \(refusal\)/.test(R.fb[0]), JSON.stringify(R.fb));
  ok("the refused line is gone and the fallback model's reply takes its place", R.old===false&&R.last&&/Olur, bir kahve/.test(R.last.content)&&R.last.model==="fb/model", JSON.stringify(R));

  console.log("\n[when it does not]");
  ok("no fallback model set: the line stays, flagged, and nothing is asked again", await pg.evaluate(async()=>{ const c=__setup(); state.fallbackModel="";
      await runReplyCheck(c,c.messages[1],state.personas.find(x=>x.id==="p_b")); await new Promise(r=>setTimeout(r,500)); state.fallbackModel="fb/model";
      return (c.messages.some(m=>m.mid==="a1")&&(c.messages[1].replyFlags||[]).includes("refusal")&&!__calls.some(x=>/^Roleplay reply/.test(x.d)))?true:JSON.stringify(__calls); }));
  ok("below the threshold: nothing is asked again", await pg.evaluate(async()=>{ const c=__setup(); __p={refusal:0.3};
      await runReplyCheck(c,c.messages[1],state.personas.find(x=>x.id==="p_b")); await new Promise(r=>setTimeout(r,500)); __p={refusal:0.95};
      return (c.messages.some(m=>m.mid==="a1")&&!__calls.some(x=>/^Roleplay reply/.test(x.d)))?true:JSON.stringify(__calls); }));
  ok("the fallback model's own refusal is not retried again", await pg.evaluate(async()=>{ const c=__setup(); c.messages[1].genModel="fb/model";
      await runReplyCheck(c,c.messages[1],state.personas.find(x=>x.id==="p_b")); await new Promise(r=>setTimeout(r,500));
      return (c.messages.some(m=>m.mid==="a1")&&!__calls.some(x=>/^Roleplay reply/.test(x.d)))?true:JSON.stringify(__calls); }));
  ok("once the player has answered, the old line is left as it is", await pg.evaluate(async()=>{ const c=__setup();
      c.messages.push({mid:"u2",role:"user",content:"Peki.",speaker:"Emre"});
      await runReplyCheck(c,c.messages[1],state.personas.find(x=>x.id==="p_b")); await new Promise(r=>setTimeout(r,500));
      return (c.messages.some(m=>m.mid==="a1")&&!__calls.some(x=>/^Roleplay reply/.test(x.d)))?true:JSON.stringify(__calls); }));
  ok("it waits for the turn to finish before it asks", await pg.evaluate(async()=>{ const c=__setup(); const un=holdChatLock(c,"turn");
      await runReplyCheck(c,c.messages[1],state.personas.find(x=>x.id==="p_b")); await new Promise(r=>setTimeout(r,600));
      const before=__calls.filter(x=>/^Roleplay reply/.test(x.d)).length; un();
      for(let i=0;i<100&&c.messages.some(m=>m.mid==="a1");i++) await new Promise(r=>setTimeout(r,100));
      const after=__calls.filter(x=>/^Roleplay reply/.test(x.d)).length;
      return (before===0&&after===1&&!c.messages.some(m=>m.mid==="a1"))?true:JSON.stringify({before,after}); }));
  ok("a reply records the model that wrote it", await pg.evaluate(()=>/genModel:g\.model/.test(document.documentElement.innerHTML)));

  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close(); process.exit(fail?1:0);
})();
