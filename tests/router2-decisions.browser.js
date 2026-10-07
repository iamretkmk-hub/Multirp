/* v150.44 — ROUTER 2 AS ONE DECISIONS PICK. After every character line in a group turn (and after a narrator event) a
   chat call decided whether someone else answers. It is one pick now: nobody (the default — the turn returns to the
   player) or one of the characters who may speak, with their hooks; a character only at 0.6 and above "nobody". A
   failed request falls back to the chat router.  Run: node tests/router2-decisions.browser.js */
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
    window.__reqs=[]; window.__calls=[]; window.__pr=null; window.__mode="ok"; window.__played=[];
    const realF=window.fetch;
    window.fetch=async(u,o)=>{ if(String(u).indexOf("/api/alpha/decisions")>-1){ const body=JSON.parse(o.body); if(body.questions&&body.questions.next)__reqs.push(body);
        if(__mode==="500")return new Response(JSON.stringify({error:{message:"x"}}),{status:500});
        const ans={}; if(body.questions.next){ const pr={}; Object.keys(body.questions.next.criteria).forEach(k=>{ pr[k]=0; });
          const want=__pr?__pr(body):{nobody:1}; Object.assign(pr,want); ans.next={type:"choice",choice:Object.keys(pr).sort((a,b)=>pr[b]-pr[a])[0],probabilities:pr}; }
        return new Response(JSON.stringify({answers:ans}),{status:200}); } return realF(u,o); };
    window.chatCompletion=async(msgs,model,opts)=>{ const d=(opts&&opts.dbg)||""; __calls.push(d); if(/^Turn router/.test(d))return JSON.stringify({continue:true,responder:"Berk"}); return "{}"; };
    window.playCharacterTurn=async(c,p)=>{ __played.push(p.name); return true; };
    window.runPresenceTracker=async()=>({entered:[],exited:[],lastBeat:null});
    window.__setup=()=>{
      const uni=state.universes[0];
      state.personas=[{id:"p_a",name:"Ayla",universeId:uni.id,personality:"x",look:{},interject:"owes Berk money"},{id:"p_b",name:"Berk",universeId:uni.id,personality:"x",look:{},interject:"hides an affair"},{id:"p_c",name:"Cem",universeId:uni.id,personality:"x",look:{}}];
      Object.assign(state,{key:"k",user:"Emre",routerDecOn:true,routerDecAt:0.6,mcChainCap:2});
      try{ _routerDecBreak.until=0; _routerDecBreak.fails=0; }catch(e){}
      const c=curChat(); Object.assign(c,{universeId:uni.id,presentIds:["p_a","p_b","p_c"],locationId:null,dnd:false,
        messages:[{mid:"n1",role:"assistant",speaker:"Narrator",narratorEvent:true,content:"A glass shatters at the bar.",present:["p_a","p_b","p_c"]}]});
      window.__reqs=[]; window.__calls=[]; window.__pr=null; window.__mode="ok"; window.__played=[];
      return c; };
  });

  console.log("\n[the pick]");
  const R=await pg.evaluate(async()=>{ const c=__setup(); const k=(b,n)=>Object.keys(b.questions.next.criteria).find(x=>b.questions.next.criteria[x].indexOf(n)===0);
    __pr=b=>{ const o={nobody:0.2}; o[k(b,"Berk")]=0.75; return o; };
    await gamemasterReactions(c); const r=__reqs[0]||{questions:{next:{criteria:{}}},state:{}};
    return {crit:r.questions.next.criteria,st:r.state,played:__played,chat:__calls.filter(x=>/^Turn router/.test(x)).length,n:__reqs.length}; });
  ok("one pick: nobody (the default) and each character who may speak, with their hooks", R.crit&&/^nobody — the turn returns to Emre/.test(R.crit.nobody)&&Object.values(R.crit).some(v=>/^Berk — hooks: hides an affair/.test(v))&&Object.keys(R.crit).length===4, JSON.stringify(R.crit));
  ok("the state has the last line, who spoke, who is present and the exchange", /glass shatters/.test(R.st.last_line)&&R.st.speaker==="the narrator"&&/Emre, Ayla, Berk, Cem/.test(R.st.present)&&typeof R.st.latest_exchange==="string", JSON.stringify(R.st));
  ok("Berk at 0.75 reacts; the chat router is never asked", R.played[0]==="Berk"&&R.chat===0, JSON.stringify(R));
  ok("after his line the next pick no longer offers him (each reacts once)", R.n===2, JSON.stringify(R));
  const N=await pg.evaluate(async()=>{ const c=__setup(); const k=(b,n)=>Object.keys(b.questions.next.criteria).find(x=>b.questions.next.criteria[x].indexOf(n)===0);
    __pr=b=>{ const o={nobody:0.45}; o[k(b,"Berk")]=0.55; return o; }; await gamemasterReactions(c); const below=__played.slice();
    __setup(); __pr=b=>{ const o={nobody:0.7}; o[Object.keys(b.questions.next.criteria).find(x=>x!=="nobody")]=0.65; return o; }; await gamemasterReactions(curChat());
    return {below,under:__played.slice()}; });
  ok("below the bar (0.55) nobody reacts; a candidate under 'nobody' does not either", N.below.length===0&&N.under.length===0, JSON.stringify(N));
  ok("a failed request: the chat router decides, as before", await pg.evaluate(async()=>{ const c=__setup(); __mode="500"; await gamemasterReactions(c);
      return (__calls.some(x=>x==="Turn router · gm reaction")&&__played[0]==="Berk")?true:JSON.stringify({calls:__calls,played:__played}); }));
  ok("switched off: the chat router, no request", await pg.evaluate(async()=>{ const c=__setup(); state.routerDecOn=false; await gamemasterReactions(c); state.routerDecOn=true;
      return (__reqs.length===0&&__calls.some(x=>x==="Turn router · gm reaction"))?true:JSON.stringify({n:__reqs.length,calls:__calls}); }));

  console.log("\n[the group turn uses it too]");
  ok("the chain router's site calls the pick with who already spoke marked", await pg.evaluate(()=>{ const src=String(runMultiCharTurn);
      return (/router2Decision\(chat,\{who:_who,speaker:lastSpeaker\?lastSpeaker\.name:cast\[0\]\.name,lastLine:_lastLine/.test(src)&&/spoke:spokenThisChain/.test(src))?true:"not wired"; }));
  ok("someone who already spoke is offered only to answer a jab", await pg.evaluate(async()=>{ const c=__setup();
      const r=await router2Decision(c,{who:"Emre",speaker:"Ayla",lastLine:"Ayla: x",present:"Emre, Ayla, Berk",others:[state.personas[1]],spoke:new Set(["p_b"]),exchange:""});
      const cr=(__reqs[0]||{questions:{next:{criteria:{}}}}).questions.next.criteria; return /already spoke this turn — only to answer a jab/.test(cr.c0||"")&&r&&r.next===null?true:JSON.stringify(cr); }));

  console.log("\n[settings and prompt]");
  ok("on by default; Settings shows and saves it", await pg.evaluate(()=>{ localStorage.removeItem(K.routerDecOn); loadState(); const d=state.routerDecOn===true;
      syncSettingsUI(); const el=document.getElementById('setRouterDecOn'); if(!el)return "no switch"; el.checked=false; saveSettings();
      const off=store.raw(K.routerDecOn,"")==="0"&&state.routerDecOn===false; localStorage.removeItem(K.routerDecOn); loadState(); return (d&&off)?true:JSON.stringify({d,off}); }));
  ok("the question is a registry prompt on the Turn router card", await pg.evaluate(()=>!!PROMPT_BY_KEY.x_router2&&ENGINE_PAYLOAD_DEFS.some(d=>(d.blocks||[]).some(x=>x.promptKey==="routerChar")&&(d.blocks||[]).some(x=>x.promptKey==="x_router2"))));

  ok("no page errors", errs.length===0?true:errs.join(" | "));
  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close(); process.exit(fail?1:0);
})();
