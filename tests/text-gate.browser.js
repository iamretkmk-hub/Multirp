/* v150.43 — THE PROACTIVE TEXT GATE. Every character whose pull cleared the bar used to get a full roleplay-model call,
   which often answered "no text". One Decisions request now asks the strongest candidates (at most three) "would they
   text now?" first; only the likeliest yes at 0.6 reaches the writer. No answer: the writer decides alone, as before.
   Run: node tests/text-gate.browser.js */
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
    window.__reqs=[]; window.__calls=[]; window.__p={}; window.__mode="ok"; window.__sent=[];
    const realF=window.fetch;
    window.fetch=async(u,o)=>{ if(String(u).indexOf("/api/alpha/decisions")>-1){ const body=JSON.parse(o.body); if(body.questions&&body.questions.text_0)__reqs.push(body);   // only the gate's request is counted
        if(__mode==="500")return new Response(JSON.stringify({error:{message:"x"}}),{status:500});
        const answers={}; Object.keys(body.questions).forEach(k=>{ const nm=Object.keys(__p).find(n=>body.questions[k].instructions.indexOf(n+" ")===0); answers[k]={type:"noul",noul:nm?__p[nm]:0.05}; });
        return new Response(JSON.stringify({answers}),{status:200}); } return realF(u,o); };
    window.chatCompletion=async(msgs,model,opts)=>{ const d=(opts&&opts.dbg)||""; if(/^Proactive text/.test(d))__calls.push(d);   // the writer's own memory search etc. are not counted
      if(/^Proactive text — /.test(d))return JSON.stringify({text:true,message:"Eve vardın mı?",why:"x"}); return "{}"; };
    window.deliverProactiveText=(c,p,m)=>{ __sent.push(p.name+": "+m); };
    window.__setup=()=>{
      const uni=state.universes[0];
      const mk=(id,name)=>({id,name,universeId:uni.id,personality:"x",look:{},relationships:{__user__:{tie:"friend",relationship:"x"}}});
      state.personas=[mk("p_a","Ayla"),mk("p_b","Berk"),mk("p_c","Cem"),mk("p_d","Deniz")];
      Object.assign(state,{key:"k",user:"Emre",textsOn:true,textGateOn:true,textGateAt:0.6});
      try{ _textGateBreak.until=0; _textGateBreak.fails=0; }catch(e){}
      const c=curChat(); Object.assign(c,{universeId:uni.id,presentIds:[],gameDay:3,dnd:false,messages:[]});
      // a strong pull for three of them: something important happened to each today
      state.memory=[["p_a",0.95,"Ayla fought with her brother."],["p_b",0.9,"Berk lost his job."],["p_c",0.88,"Cem saw Emre's wife in town."]]
        .map(([o,i,t],k)=>({id:"m"+k,ownerId:o,gameDay:3,importance:i,content:t,type:"EXPERIENCE",chatId:c.id,universeId:uni.id}));
      window.__reqs=[]; window.__calls=[]; window.__p={}; window.__mode="ok"; window.__sent=[];
      return c; };
  });

  console.log("\n[the gate]");
  const G=await pg.evaluate(async()=>{ const c=__setup(); __p={Berk:0.82,Ayla:0.7};
    const r=await maybeProactiveText(c); const q=__reqs[0]||{questions:{},state:{}};
    return {r,n:__reqs.length,keys:Object.keys(q.questions),st:q.state,calls:__calls,sent:__sent}; });
  ok("one request, a yes/no for each of the three with the strongest pull", G.n===1&&JSON.stringify(G.keys)==='["text_0","text_1","text_2"]'&&Object.values(G.st.people||[]).length===3, JSON.stringify({keys:G.keys,people:G.st.people}));
  ok("each comes with their tie, feelings, last meeting, thread and their day", G.st.people&&G.st.people.every(x=>x.to_the_player&&x.feels&&x.last_seen&&x.text_thread&&x.today)&&/lost his job/.test(JSON.stringify(G.st.people)), JSON.stringify(G.st.people));
  ok("the likeliest yes (Berk 0.82, over Ayla's stronger pull) is the one the writer is asked for", JSON.stringify(G.calls)==='["Proactive text — Berk"]'&&JSON.stringify(G.sent)==='["Berk: Eve vardın mı?"]'&&G.r===true, JSON.stringify(G));
  const N=await pg.evaluate(async()=>{ const c=__setup(); __p={Berk:0.4}; const r=await maybeProactiveText(c); return {r,calls:__calls,sent:__sent}; });
  ok("nobody at the bar: no writer call at all, no text", N.r===false&&N.calls.length===0&&N.sent.length===0, JSON.stringify(N));
  const F=await pg.evaluate(async()=>{ const c=__setup(); __mode="500"; const r=await maybeProactiveText(c); return {r,calls:__calls}; });
  ok("a failed request: the writer decides alone, for the strongest pull, as before", JSON.stringify(F.calls)==='["Proactive text — Ayla"]', JSON.stringify(F));
  const O=await pg.evaluate(async()=>{ const c=__setup(); state.textGateOn=false; await maybeProactiveText(c); return {reqs:__reqs.length,calls:__calls}; });
  ok("switched off: no request, the writer decides alone", O.reqs===0&&JSON.stringify(O.calls)==='["Proactive text — Ayla"]', JSON.stringify(O));
  ok("nobody with a pull: nothing is asked", await pg.evaluate(async()=>{ const c=__setup(); state.memory=[]; const r=await maybeProactiveText(c); return (r===false&&__reqs.length===0&&__calls.length===0)?true:JSON.stringify({r,n:__reqs.length}); }));

  console.log("\n[settings and prompt]");
  ok("on by default; Settings shows and saves it", await pg.evaluate(()=>{ localStorage.removeItem(K.textGateOn); loadState(); const d=state.textGateOn===true;
      syncSettingsUI(); const el=document.getElementById('setTextGateOn'); if(!el)return "no switch"; el.checked=false; saveSettings();
      const off=store.raw(K.textGateOn,"")==="0"&&state.textGateOn===false; localStorage.removeItem(K.textGateOn); loadState(); return (d&&off)?true:JSON.stringify({d,off}); }));
  ok("the question is a registry prompt on the Proactive Text card", await pg.evaluate(()=>!!PROMPT_BY_KEY.x_text_gate&&ENGINE_PAYLOAD_DEFS.some(d=>d.key==="text_proactive"&&(d.blocks||[]).some(x=>x.promptKey==="x_text_gate"))));

  ok("no page errors", errs.length===0?true:errs.join(" | "));
  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close(); process.exit(fail?1:0);
})();
