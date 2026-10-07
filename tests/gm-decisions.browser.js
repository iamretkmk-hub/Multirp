/* v150.41 — THE GAMEMASTER'S JUDGE AS ONE DECISIONS REQUEST. The judge was a chat call on the gamemaster model (about
   ten seconds in a live export) writing a little JSON: stale, trigger, energy, and a free-text trigger_context. It is
   one Decisions request now: stale and trigger yes/no, energy 1–5, and the kind of beat that would fit, picked from the
   kinds this scene allows (no arrival in a private moment; plan and pursuit kinds only when there is one). A yes counts
   at the eagerness setting's bar. The author still writes the beat, told the kind. A failed request falls back to the
   chat judge.  Run: node tests/gm-decisions.browser.js */
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
    window.__reqs=[]; window.__calls=[]; window.__ans=null; window.__mode="ok";
    const realF=window.fetch;
    window.fetch=async(u,o)=>{ if(String(u).indexOf("/api/alpha/decisions")>-1){ const body=JSON.parse(o.body); __reqs.push(body);
        if(__mode==="500")return new Response(JSON.stringify({error:{message:"x"}}),{status:500});
        return new Response(JSON.stringify({answers:__ans?__ans(body):{}}),{status:200}); } return realF(u,o); };
    window.chatCompletion=async(msgs,model,opts)=>{ const d=(opts&&opts.dbg)||""; __calls.push({d,msgs});
      if(d==="Gamemaster: judge")return JSON.stringify({stale:false,trigger:false,reason:"chat judge"});
      if(d==="Gamemaster: event")return "A phone buzzes on the table and stops.";
      return "{}"; };
    window.playGamemasterBeat=async()=>{ __calls.push({d:"BEAT"}); };
    window.__A=(stale,trigger,energy,kind)=>()=>({stale:{type:"noul",noul:stale},trigger:{type:"noul",noul:trigger},energy:{type:"choice",choice:String(energy)},kind:{type:"choice",choice:kind}});
    window.__setup=()=>{
      const uni=state.universes[0];
      state.personas=[{id:"p_a",name:"Ayla",universeId:uni.id,personality:"x",look:{}},{id:"p_b",name:"Berk",universeId:uni.id,personality:"x",look:{}}];
      Object.assign(state,{key:"k",user:"Emre",gmOn:true,gmEvery:3,gmSensitivity:"balanced",gmDecOn:true,intentOn:false});
      try{ _gmDecBreak.until=0; _gmDecBreak.fails=0; }catch(e){}
      const c=curChat(); c.universeId=uni.id; c.presentIds=["p_a"]; c.gmLastCheck=0; c.activeEvent=null; c.dnd=false;
      const s=(r,t)=>Object.assign({mid:"m"+Math.random(),role:r,content:t,present:["p_a"]},r==="user"?{}:{speaker:"Ayla",speakerId:"p_a"});
      c.messages=[s("user","Nice weather."),s("assistant","\"It is.\""),s("user","Yes."),s("assistant","\"Mm.\"")];
      window.__reqs=[]; window.__calls=[]; window.__ans=null; window.__mode="ok";
      return c;
    };
  });

  console.log("\n[the request]");
  const R=await pg.evaluate(async()=>{ const c=__setup(); __ans=__A(0.9,0.1,1,"inside");
    await maybeGamemaster(c,false);
    const r=__reqs[0]||{questions:{},state:{}};
    return {n:__reqs.length,q:r.questions,st:r.state,chat:__calls.filter(x=>x.d==="Gamemaster: judge").length,
      author:(__calls.find(x=>x.d==="Gamemaster: event")||{msgs:[]}).msgs.map(m=>m.content).join("\n"),beat:__calls.some(x=>x.d==="BEAT")}; });
  ok("one Decisions request, no chat judge", R.n===1&&R.chat===0, JSON.stringify({n:R.n,chat:R.chat}));
  ok("stale and trigger are yes/no, energy a pick from 1 to 5, the kind a pick", R.q.stale&&R.q.stale.type==="noul"&&R.q.trigger.type==="noul"&&JSON.stringify(Object.keys(R.q.energy.criteria))==='["1","2","3","4","5"]'&&R.q.kind.type==="choice", JSON.stringify(Object.keys(R.q)));
  ok("the state is the scene, the latest exchange and that it is not private", /Nice weather/.test(R.st.latest_exchange||"")&&typeof R.st.scene==="string"&&R.st.private_moment==="no", JSON.stringify(Object.keys(R.st)));
  ok("with nothing armed and nobody pursuing, the kinds are signal, elsewhere, inside and arrival", JSON.stringify(Object.keys(R.q.kind.criteria))==='["signal","elsewhere","inside","arrival"]', JSON.stringify(Object.keys(R.q.kind.criteria)));
  ok("stale (0.9) at balanced: the author is asked, told the kind and the energy, and the beat plays", R.beat&&/The kind of beat that fits: a small turn inside the scene itself/.test(R.author)&&/the scene has stalled/.test(R.author), R.author.slice(0,600));

  console.log("\n[what the scene allows]");
  const K=await pg.evaluate(async()=>{ const c=__setup(); __ans=__A(0.1,0.1,3,"signal");
    const out=await gmDecisionJudge(c,{ctx:"S",since:"E",_private:true,staging:"a plan waits for Emre alone",pursuitsRaw:"Ayla wants the loan"});
    const r=__reqs[0]; return {kinds:Object.keys(r.questions.kind.criteria),priv:r.state.private_moment,st:Object.keys(r.state),out}; });
  ok("a private moment: no arrival offered, and the state says so", K.kinds.indexOf("arrival")<0&&/nobody may arrive/.test(K.priv), JSON.stringify(K.kinds));
  ok("a pursuit and an armed plan add their kinds, and their text goes in the state", K.kinds.indexOf("pursuit")>=0&&K.kinds.indexOf("staging")>=0&&K.st.indexOf("what_the_people_here_are_after")>=0&&K.st.indexOf("armed_plans_waiting_on_the_scene")>=0, JSON.stringify(K));
  ok("both no: the answer says so, with no trigger context", K.out&&K.out.stale===false&&K.out.trigger===false&&K.out.trigger_context===null&&K.out.energy==="3", JSON.stringify(K.out));

  console.log("\n[eagerness is the bar]");
  const E=await pg.evaluate(async()=>{ const r={}; for(const s of ["cautious","balanced","active"]){ __setup(); state.gmSensitivity=s; __ans=__A(0.1,0.7,4,"signal");
      const o=await gmDecisionJudge(curChat(),{ctx:"S",since:"E"}); r[s]=o&&o.trigger; } return r; });
  ok("a 0.7 trigger: not for cautious (0.8), yes for balanced (0.65) and active (0.5)", E.cautious===false&&E.balanced===true&&E.active===true, JSON.stringify(E));

  console.log("\n[no, failure, off]");
  const N=await pg.evaluate(async()=>{ const c=__setup(); __ans=__A(0.2,0.3,4,"signal"); await maybeGamemaster(c,false);
    return {author:__calls.some(x=>x.d==="Gamemaster: event"),chat:__calls.some(x=>x.d==="Gamemaster: judge")}; });
  ok("both below the bar: nothing is written, and the chat judge is not asked", !N.author&&!N.chat, JSON.stringify(N));
  const F=await pg.evaluate(async()=>{ const c=__setup(); __mode="500"; await maybeGamemaster(c,false);
    return {reqs:__reqs.length,chat:__calls.some(x=>x.d==="Gamemaster: judge")}; });
  ok("a failed request falls back to the chat judge", F.reqs>=1&&F.chat, JSON.stringify(F));
  const O=await pg.evaluate(async()=>{ const c=__setup(); state.gmDecOn=false; await maybeGamemaster(c,false);
    return {reqs:__reqs.length,chat:__calls.some(x=>x.d==="Gamemaster: judge")}; });
  ok("switched off: the chat judge, and no request", O.reqs===0&&O.chat, JSON.stringify(O));
  ok("a forced beat skips the judge altogether", await pg.evaluate(async()=>{ const c=__setup(); await maybeGamemaster(c,true);
      return (__reqs.length===0&&!__calls.some(x=>x.d==="Gamemaster: judge")&&__calls.some(x=>x.d==="Gamemaster: event"))?true:JSON.stringify(__calls.map(x=>x.d)); }));

  console.log("\n[settings and prompts]");
  ok("on by default; Settings shows it and saves it", await pg.evaluate(()=>{ localStorage.removeItem(K.gmDecOn); loadState(); const d=state.gmDecOn===true;
      syncSettingsUI(); const el=document.getElementById('setGmDecOn'); if(!el)return "no switch"; const shown=el.checked;
      el.checked=false; saveSettings(); const off=store.raw(K.gmDecOn,"")==="0"&&state.gmDecOn===false; localStorage.setItem(K.gmDecOn,"1"); loadState();
      return (d&&shown&&off)?true:JSON.stringify({d,shown,off}); }));
  ok("the four questions are registry prompts on the Gamemaster card", await pg.evaluate(()=>{ const k=["x_gm_dec_stale","x_gm_dec_trigger","x_gm_dec_energy","x_gm_dec_kind"];
      const card=ENGINE_PAYLOAD_DEFS.find(d=>(d.blocks||[]).some(x=>x.promptKey==="gmJudge"));
      return (k.every(x=>PROMPT_BY_KEY[x])&&card&&k.every(x=>card.blocks.some(y=>y.promptKey===x)))?true:"missing"; }));

  ok("no page errors", errs.length===0?true:errs.join(" | "));
  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close(); process.exit(fail?1:0);
})();
