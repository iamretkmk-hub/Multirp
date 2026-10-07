/* v150.46 — WHAT YOU SEE, AS DECISIONS. The visual director ("Let the story decide": does this beat earn a new picture?)
   and the scene selector (which image rule draws the frame) were chat calls answering "0"/"1" and an index. They are a
   typed yes/no (a new picture at 0.5) and a typed pick over the enabled rules. A failed request, or the switch off, hands
   both back to the chat calls.  Run: node tests/image-decisions.browser.js */
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
    window.__reqs=[]; window.__calls=[]; window.__ans=null; window.__mode="ok"; window.__drawn=[];
    const realF=window.fetch;
    window.fetch=async(u,o)=>{ if(String(u).indexOf("/api/alpha/decisions")>-1){ const body=JSON.parse(o.body); __reqs.push(body);
        if(__mode==="500")return new Response(JSON.stringify({error:{message:"x"}}),{status:500});
        return new Response(JSON.stringify({answers:__ans?__ans(body):{}}),{status:200}); } return realF(u,o); };
    window.chatCompletion=async(msgs,model,opts)=>{ const d=(opts&&opts.dbg)||""; __calls.push(d);
      if(d==="Scene selector (model router)")return "2"; if(d==="Visual director")return "1"; return "{}"; };
    window.illustrate=(mid)=>{ __drawn.push(mid); };
    window.__rules=[{id:"r_a",label:"Portrait",when:"one person talking"},{id:"r_b",label:"Group",when:"several people"},
      {id:"r_c",label:"Embrace",when:"two people holding each other"},{id:"r_off",label:"Disabled",when:"never",enabled:false}];
    window.__setup=()=>{
      const uni=state.universes[0];
      state.personas=[{id:"p_a",name:"Ayla",universeId:uni.id,personality:"x",look:{}}];
      Object.assign(state,{key:"k",user:"Emre",imgDecOn:true,routeOn:true});
      try{ _imgDecBreak.until=0; _imgDecBreak.fails=0; }catch(e){}
      const c=curChat(); Object.assign(c,{universeId:uni.id,presentIds:["p_a"],dnd:false,messages:[]});
      const now={loc:c.locationId||"",sub:curSubId(c)||"",period:chatPeriod(c),place:(_imgLocationClause(c).split(",")[0]||c.location||""),
        ids:(inSceneCast(c)||[]).map(x=>x.id).sort()};
      c.messages=[{mid:"m1",role:"assistant",speaker:"Ayla",speakerId:"p_a",content:"*She sits at the table.* \"Hi.\"",img:"data:x",imgState:"done",imgPrompt:"Ayla sitting at a cafe table",imgMeta:now},
        {mid:"m2",role:"user",content:"I lean in and ask about her day."},
        {mid:"m3",role:"assistant",speaker:"Ayla",speakerId:"p_a",content:"*She smiles.* \"Long.\" _He looks tired._"}];
      window.__reqs=[]; window.__calls=[]; window.__ans=null; window.__mode="ok"; window.__drawn=[];
      return c; };
  });

  console.log("\n[the scene selector]");
  const S=await pg.evaluate(async()=>{ __setup(); __ans=b=>({rule:{type:"choice",choice:"r2",probabilities:{r0:0.1,r1:0.15,r2:0.75}}});
    const r=await pickRule(__rules,"LATEST EXCHANGE:\nEmre: I hug her.");
    const q=(__reqs[0]||{questions:{rule:{criteria:{}}},state:{}});
    return {got:r&&r.id,crit:q.questions.rule&&q.questions.rule.criteria,st:q.state,ins:q.questions.rule&&q.questions.rule.instructions,chat:__calls.length}; });
  ok("one pick over the enabled rules, each with its 'when'", JSON.stringify(S.crit)===JSON.stringify({r0:"Portrait: one person talking",r1:"Group: several people",r2:"Embrace: two people holding each other"}), JSON.stringify(S.crit));
  ok("the state is the scene, latest exchange included", /I hug her/.test(S.st.scene||""), JSON.stringify(S.st));
  ok("the instructions are the editable prompt", /Which image rule should draw this frame/.test(S.ins||"")&&/Whose eyes/.test(S.ins||""), S.ins);
  ok("the likeliest rule is used; the chat router is never asked", S.got==="r_c"&&S.chat===0, JSON.stringify(S));
  ok("a choice without probabilities is taken as given", await pg.evaluate(async()=>{ __setup(); __ans=()=>({rule:{type:"choice",choice:"r1"}});
      const r=await pickRule(__rules,"x"); return r&&r.id==="r_b"?true:JSON.stringify(r); }));
  ok("a failed request: the chat router picks, as before", await pg.evaluate(async()=>{ __setup(); __mode="500";
      const r=await pickRule(__rules,"x"); return (r&&r.id==="r_c"&&__calls.indexOf("Scene selector (model router)")>-1)?true:JSON.stringify({r,c:__calls}); }));
  ok("switched off: the chat router, no request", await pg.evaluate(async()=>{ __setup(); state.imgDecOn=false;
      const r=await pickRule(__rules,"x"); state.imgDecOn=true; return (__reqs.length===0&&r&&r.id==="r_c")?true:JSON.stringify({n:__reqs.length,r}); }));
  ok("one enabled rule, or smart routing off: nothing is asked", await pg.evaluate(async()=>{ __setup();
      const one=await pickRule([__rules[0],__rules[3]],"x"); state.routeOn=false; const off=await pickRule(__rules,"x"); state.routeOn=true;
      return (one.id==="r_a"&&off.id==="r_a"&&__reqs.length===0&&__calls.length===0)?true:JSON.stringify({n:__reqs.length,c:__calls}); }));

  console.log("\n[the visual director]");
  const V=await pg.evaluate(async()=>{ __setup(); __ans=()=>({draw:{type:"noul",noul:0.2}});
    await decideVisual("m3","x"); const q=__reqs[0]||{questions:{},state:{}};
    return {drawn:__drawn.slice(),st:q.state,q:q.questions.draw,chat:__calls.length,n:__reqs.length}; });
  ok("one yes/no with what is on screen, where and when it was and is, and the exchange",
     V.q&&V.q.type==="noul"&&/Should a NEW picture be drawn/.test(V.q.instructions)&&/someone arrived or left/.test(V.q.criteria.true)&&/only SAID/.test(V.q.criteria.false)
     &&/cafe table/.test(V.st.picture_on_screen)&&typeof V.st.where_and_when_that_picture_is==="string"&&typeof V.st.where_and_when_it_is_now==="string"&&/Long/.test(V.st.latest_exchange), JSON.stringify(V));
  ok("its inner thoughts stay out of the exchange", !/He looks tired/.test(V.st.latest_exchange||""), V.st.latest_exchange);
  ok("a no (0.2) keeps the picture on screen; the chat director is never asked", V.drawn.length===0&&V.chat===0&&V.n===1, JSON.stringify(V));
  ok("a yes at 0.5 or more draws", await pg.evaluate(async()=>{ __setup(); __ans=()=>({draw:{type:"noul",noul:0.6}});
      await decideVisual("m3","x"); return (__drawn[0]==="m3"&&__calls.length===0)?true:JSON.stringify({d:__drawn,c:__calls}); }));
  ok("a failed request: the chat director decides, as before", await pg.evaluate(async()=>{ __setup(); __mode="500";
      await decideVisual("m3","x"); return (__calls.indexOf("Visual director")>-1&&__drawn[0]==="m3")?true:JSON.stringify({d:__drawn,c:__calls}); }));
  ok("switched off: the chat director, no request", await pg.evaluate(async()=>{ __setup(); state.imgDecOn=false;
      await decideVisual("m3","x"); state.imgDecOn=true; return (__reqs.length===0&&__calls.indexOf("Visual director")>-1)?true:JSON.stringify({n:__reqs.length,c:__calls}); }));
  ok("no picture on screen yet: drawn without asking", await pg.evaluate(async()=>{ const c=__setup(); c.messages.forEach(m=>{ delete m.img; delete m.imgPrompt; delete m.imgMeta; m.imgState="idle"; });
      await decideVisual("m3","x"); return (__drawn[0]==="m3"&&__reqs.length===0)?true:JSON.stringify({d:__drawn,n:__reqs.length}); }));

  console.log("\n[settings and prompts]");
  ok("the switch round-trips through Settings", await pg.evaluate(()=>{ state.imgDecOn=false; syncSettingsUI(); const box=document.getElementById('setImgDecOn');
      const a=box&&box.checked===false; box.checked=true; saveSettings(); const b=state.imgDecOn===true&&store.raw(K.imgDecOn,"")==="1"; return (a&&b)?true:JSON.stringify({a,b}); }));
  ok("both questions are on the What you see card", await pg.evaluate(()=>{ const c=X_PROMPT_CARDS.find(x=>x.key==="what_you_see");
      return (c&&c.keys.indexOf("x_visual_new")>-1&&c.keys.indexOf("x_rule_pick")>-1)?true:JSON.stringify(c&&c.keys); }));

  ok("no page errors", errs.length===0?true:errs.join(" | "));
  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close(); process.exit(fail?1:0);
})();
