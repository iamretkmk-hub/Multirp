/* v150.42 — CHARACTERS MOVE AROUND A PLACE ON THEIR OWN. Moves used to happen only when a line said so (the presence
   tracker reads it): nobody got up by themselves, and a player alone in one area stayed alone while the others sat in
   another. After each turn one Decisions request looks at everyone at the place — where each is, what each area is,
   what is going on, whether the player is alone — and picks for each: stay or an area, and why. A move counts at 0.75,
   at most two a turn, nobody twice in three turns, never into a private moment; it is narrated and is the turn's beat.
   Run: node tests/move-decision.browser.js */
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:process.env.SM_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage({viewport:{width:412,height:915}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file://'+require('path').resolve(__dirname,'..','index.html')); await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(800);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x===undefined?c:x).slice(0,800));} };

  await pg.evaluate(()=>{
    window.__reqs=[]; window.__calls=[]; window.__ans=null; window.__mode="ok";
    const realF=window.fetch;
    window.fetch=async(u,o)=>{ if(String(u).indexOf("/api/alpha/decisions")>-1){ const body=JSON.parse(o.body); __reqs.push(body);
        if(__mode==="500")return new Response(JSON.stringify({error:{message:"x"}}),{status:500});
        return new Response(JSON.stringify({answers:__ans?__ans(body):{}}),{status:200}); } return realF(u,o); };
    window.chatCompletion=async(msgs,model,opts)=>{ const d=(opts&&opts.dbg)||""; __calls.push({d,msgs}); if(/^Character move/.test(d))return "NARRATED_MOVE"; return "{}"; };
    // answer: for the question about NAME, move to AREA with p (else stay), why WHY
    window.__plan={};
    window.__ans=body=>{ const out={}; Object.keys(body.questions).forEach(k=>{ const q=body.questions[k];
        const nm=Object.keys(__plan).find(n=>q.instructions.indexOf(n+" ")>=0);
        if(/^move_/.test(k)){ const keys=Object.keys(q.criteria); const pr={}; keys.forEach(x=>{ pr[x]=0; });
          const want=nm&&__plan[nm]; const dest=want&&keys.find(x=>q.criteria[x].indexOf(want.to)===0);
          if(dest){ pr[dest]=want.p; pr.stay=1-want.p; } else pr.stay=1;
          out[k]={type:"choice",choice:dest&&want.p>=0.5?dest:"stay",probabilities:pr}; }
        else if(/^why_/.test(k)){ const want=nm&&__plan[nm]; out[k]={type:"choice",choice:(want&&want.why)||"done"}; } });
      return out; };
    window.__setup=(o)=>{ o=o||{};
      const uni=state.universes[0];
      uni.locations=[{id:"l_h",name:"Duygu's House",type:"home",description:"A family house.",residents:[],
        sublocations:[{id:"s_liv",name:"Living Room",entrance:true,description:"sofa and TV"},{id:"s_kit",name:"Kitchen",description:"the stove"},{id:"s_gar",name:"Garden",description:"behind the house"}]},
        {id:"l_one",name:"Kiosk",type:"poi",description:"x",residents:[],sublocations:[{id:"s_one",name:"Counter",entrance:true}]}];
      const mk=(id,name)=>({id,name,universeId:uni.id,personality:"x",look:{},relationships:{__user__:{tie:"friend",relationship:"x"}}});
      state.personas=[mk("p_a","Ayla"),mk("p_b","Berk"),mk("p_c","Cem")];
      Object.assign(state,{key:"k",user:"Emre",moveDecOn:true,moveAt:0.75,presenceOff:false,gmOn:false});
      try{ _moveDecBreak.until=0; _moveDecBreak.fails=0; }catch(e){}
      const c=curChat(); Object.assign(c,{universeId:uni.id,locationId:"l_h",location:"Duygu's House",presentIds:["p_a","p_b","p_c"],
        subId:o.player||"s_liv",subSelf:!!o.subSelf,subPos:Object.assign({p_a:"s_liv",p_b:"s_kit",p_c:"s_gar"},o.pos||{}),activeEvent:null,dnd:false,expected:[],_moveDecAt:{},_moveDecTurn:null,
        messages:[{mid:"u1",role:"user",content:'"Nice place."',present:["p_a"]},{mid:"a1",role:"assistant",speaker:"Ayla",speakerId:"p_a",toId:"__user__",content:'"Thanks."',present:["p_a"]}]});
      delete c._heatBeat; window.__reqs=[]; window.__calls=[]; window.__plan={}; window.__mode="ok";
      return c; };
  });

  console.log("\n[the request]");
  const R=await pg.evaluate(async()=>{ const c=__setup(); await maybeMoveDecision(c); const r=__reqs[0]||{questions:{},state:{}};
    const q=Object.keys(r.questions); const ber=Object.values(r.questions).find(x=>x.type==="choice"&&/^Berk /.test(x.instructions)&&x.criteria.stay);
    return {n:__reqs.length,q,st:r.state,berk:ber&&Object.keys(ber.criteria),berkC:ber&&ber.criteria,why:Object.values(r.questions).find(x=>/main reason/.test(x.instructions))}; });
  ok("one request: a move pick and a reason pick for each of the three", R.n===1&&R.q.filter(k=>/^move_/.test(k)).length===3&&R.q.filter(k=>/^why_/.test(k)).length===3, JSON.stringify(R.q));
  ok("each one's options are stay and the OTHER areas, each with what it is and who is there", JSON.stringify(R.berk)==='["stay","to_s_liv","to_s_gar"]'&&/^Living Room — sofa and TV; .*here: Emre \(the player\), Ayla/.test(R.berkC.to_s_liv), JSON.stringify(R.berkC));
  ok("the state: the place, every area with who is in it, the player, the people, the latest exchange, not private",
     /Duygu's House/.test(R.st.place)&&R.st.areas.length===3&&/^Emre is in Living Room$/.test(R.st.the_player)&&R.st.people.length===3&&/Berk — in Kitchen/.test(R.st.people.join("|"))&&/Nice place/.test(R.st.latest_exchange)&&R.st.private_moment==="no", JSON.stringify(R.st));
  ok("the reason is a pick too", !!R.why&&R.why.type==="choice"&&!!R.why.criteria.check&&!!R.why.criteria.someone, JSON.stringify(R.why));

  console.log("\n[a move]");
  const M=await pg.evaluate(async()=>{ const c=__setup(); __plan={Berk:{to:"Living Room",p:0.9,why:"someone"}};
    const moved=await maybeMoveDecision(c); const note=c.messages[c.messages.length-1];
    const nar=__calls.find(x=>/^Character move/.test(x.d));
    return {moved,pos:c.subPos.p_b,note:note&&{content:note.content,pn:note.presenceNote,md:note.moveDec},cool:c._moveDecAt.p_b,nar:nar?nar.msgs.map(m=>m.content).join("\n"):""}; });
  ok("Berk (0.9) goes to the living room; the move is narrated and posted as a presence note", M.moved===true&&M.pos==="s_liv"&&M.note&&/ARRATED_MOVE/.test(M.note.content)&&M.note.pn&&M.note.md, JSON.stringify(M.note));
  ok("the narration is told why", /Berk goes to the Living Room, to be with someone there/.test(M.nar), M.nar.slice(-600));
  ok("below the bar (0.6) nobody moves", await pg.evaluate(async()=>{ const c=__setup(); __plan={Berk:{to:"Living Room",p:0.6}}; const m=await maybeMoveDecision(c); return (m===false&&c.subPos.p_b==="s_kit"&&!__calls.length)?true:JSON.stringify(c.subPos); }));
  ok("at most two move in a turn — the surest two", await pg.evaluate(async()=>{ const c=__setup(); __plan={Ayla:{to:"Kitchen",p:0.8},Berk:{to:"Garden",p:0.95},Cem:{to:"Kitchen",p:0.9}};
      await maybeMoveDecision(c); return (c.subPos.p_b==="s_gar"&&c.subPos.p_c==="s_kit"&&c.subPos.p_a==="s_liv")?true:JSON.stringify(c.subPos); }));
  ok("someone who just moved is not asked again for three turns", await pg.evaluate(async()=>{ const c=__setup(); __plan={Berk:{to:"Living Room",p:0.9}};
      await maybeMoveDecision(c); __reqs=[]; c.messages.push({mid:"u2",role:"user",content:"x"}); await maybeMoveDecision(c);
      const asked=Object.values((__reqs[0]||{questions:{}}).questions).some(q=>/^Berk /.test(q.instructions));
      return (__reqs.length===1&&!asked)?true:JSON.stringify({n:__reqs.length,asked}); }));
  ok("asked once per player turn", await pg.evaluate(async()=>{ const c=__setup(); await maybeMoveDecision(c); await maybeMoveDecision(c); return __reqs.length===1?true:__reqs.length+" requests"; }));

  console.log("\n[the player alone in an area]");
  const A=await pg.evaluate(async()=>{ const c=__setup({player:"s_gar",subSelf:true,pos:{p_c:"s_kit"}}); __plan={Ayla:{to:"Garden",p:0.85,why:"check"}};
    await maybeMoveDecision(c); const r=__reqs[0]; const nar=(__calls.find(x=>/^Character move/.test(x.d))||{msgs:[]}).msgs.map(m=>m.content).join("\n");
    return {player:r&&r.state.the_player,pos:c.subPos.p_a,nar}; });
  ok("the state says the player is alone there", /^Emre is in Garden — alone there$/.test(A.player||""), A.player);
  ok("someone may come to them, and the narration says why", A.pos==="s_gar"&&/to see why Emre is on their own/.test(A.nar), JSON.stringify(A));

  console.log("\n[never into a private moment; nothing when it does not apply]");
  const P=await pg.evaluate(async()=>{ const c=__setup(); const real=window.sceneIsPrivateMoment; window.sceneIsPrivateMoment=()=>true;
    await maybeMoveDecision(c); window.sceneIsPrivateMoment=real; const r=__reqs[0];
    const cem=Object.values(r.questions).find(q=>/^Cem /.test(q.instructions)&&q.criteria.stay);
    return {priv:r.state.private_moment,cem:cem&&Object.keys(cem.criteria)}; });
  ok("a private moment: the player's area is not an option, and the state says so", /nobody walks in/.test(P.priv)&&JSON.stringify(P.cem)==='["stay","to_s_kit"]', JSON.stringify(P));
  ok("one area, an active event, heat, do-not-disturb, switched off: no request", await pg.evaluate(async()=>{ const r=[];
      let c=__setup(); c.locationId="l_one"; await maybeMoveDecision(c); r.push(__reqs.length);
      c=__setup(); c.activeEvent={resolved:false}; await maybeMoveDecision(c); r.push(__reqs.length);
      c=__setup(); c._heatBeat={n:1}; await maybeMoveDecision(c); r.push(__reqs.length);
      c=__setup(); c.dnd=true; await maybeMoveDecision(c); r.push(__reqs.length);
      c=__setup(); state.moveDecOn=false; await maybeMoveDecision(c); r.push(__reqs.length); state.moveDecOn=true;
      return r.join(",")==="0,0,0,0,0"?true:r.join(","); }));
  ok("someone who promised to come back is left to that path", await pg.evaluate(async()=>{ const c=__setup(); c.expected=[{id:"p_b",name:"Berk",turn:1}];
      await maybeMoveDecision(c); return Object.values(__reqs[0].questions).some(q=>/^Berk /.test(q.instructions))?"Berk was asked":true; }));
  ok("a failed request moves nobody", await pg.evaluate(async()=>{ const c=__setup(); __mode="500"; __plan={Berk:{to:"Living Room",p:0.9}}; const m=await maybeMoveDecision(c); return (m===false&&c.subPos.p_b==="s_kit")?true:JSON.stringify(c.subPos); }));

  console.log("\n[the turn]");
  ok("postTurn runs the move decision beside the Gamemaster, and the move happens", await pg.evaluate(async()=>{ const c=__setup(); __plan={Berk:{to:"Living Room",p:0.9}};
      const real=window.maybeGamemaster; let gm=0; window.maybeGamemaster=()=>{ gm++; }; state.calOn=false; state.sceneOn=false;
      await postTurn(c); const job=_moveDecJobs.get(c.id); const moved=job?await job:false; window.maybeGamemaster=real;
      return (moved===true&&c.subPos.p_b==="s_liv"&&gm===1)?true:JSON.stringify({moved,gm,pos:c.subPos.p_b}); }));
  ok("a move is the turn's beat: a Gamemaster about to write one waits for it and stands down", await pg.evaluate(async()=>{
      const c=__setup(); state.gmOn=true; state.gmEvery=3; state.gmDecOn=false; c.gmLastCheck=0;
      ["x","y"].forEach((t,i)=>{ c.messages.push({mid:"u"+t,role:"user",content:t}); c.messages.push({mid:"a"+t,role:"assistant",speaker:"Ayla",speakerId:"p_a",content:t}); });
      const realCC=window.chatCompletion; let event=0;
      window.chatCompletion=async(m,mo,o)=>{ const d=(o&&o.dbg)||""; if(d==="Gamemaster: judge")return JSON.stringify({stale:true,trigger:false}); if(d==="Gamemaster: event"){ event++; return "A door slams."; } return realCC(m,mo,o); };
      let release; _moveDecJobs.set(c.id,new Promise(r=>{ release=r; }));
      const gm=maybeGamemaster(c,false); await new Promise(r=>setTimeout(r,50)); const waited=event===0;
      release(true); await gm; _moveDecJobs.delete(c.id); window.chatCompletion=realCC; state.gmOn=false; state.gmDecOn=true;
      return (waited&&event===0)?true:JSON.stringify({waited,event}); }));
  ok("and with nobody moving, the Gamemaster writes its beat", await pg.evaluate(async()=>{
      const c=__setup(); state.gmOn=true; state.gmEvery=3; state.gmDecOn=false; c.gmLastCheck=0;
      ["x","y"].forEach(t=>{ c.messages.push({mid:"u"+t,role:"user",content:t}); c.messages.push({mid:"a"+t,role:"assistant",speaker:"Ayla",speakerId:"p_a",content:t}); });
      const realCC=window.chatCompletion, realB=window.playGamemasterBeat; let event=0; window.playGamemasterBeat=async()=>{};
      window.chatCompletion=async(m,mo,o)=>{ const d=(o&&o.dbg)||""; if(d==="Gamemaster: judge")return JSON.stringify({stale:true,trigger:false}); if(d==="Gamemaster: event"){ event++; return "A door slams."; } return realCC(m,mo,o); };
      _moveDecJobs.set(c.id,Promise.resolve(false)); await maybeGamemaster(c,false); _moveDecJobs.delete(c.id);
      window.chatCompletion=realCC; window.playGamemasterBeat=realB; state.gmOn=false; state.gmDecOn=true;
      return event===1?true:"events "+event; }));

  // v150.47 — the move note never holds the turn
  ok("the move narration has its own ceiling (45 s, one retry, 30 s rescue)", await pg.evaluate(async()=>{ const c=__setup(); __plan={Berk:{to:"Living Room",p:0.9}};
      const realCC=window.chatCompletion; let seen=null; window.chatCompletion=async(m,mo,o)=>{ if(/^Character move/.test((o&&o.dbg)||""))seen=o; return realCC(m,mo,o); };
      await maybeMoveDecision(c); window.chatCompletion=realCC;
      return (seen&&seen.timeoutMs===45000&&seen.rescueTimeoutMs===30000&&seen.retries===1)?true:JSON.stringify(seen&&{t:seen.timeoutMs,r:seen.rescueTimeoutMs,n:seen.retries}); }));
  ok("a Gamemaster waits a bounded time, and stands down on a move already applied while the narration is still out", await pg.evaluate(async()=>{
      const c=__setup(); state.gmOn=true; state.gmEvery=3; state.gmDecOn=false; c.gmLastCheck=0; const keep=MOVE_GM_WAIT_MS; MOVE_GM_WAIT_MS=120;
      ["x","y"].forEach(t=>{ c.messages.push({mid:"u"+t,role:"user",content:t}); c.messages.push({mid:"a"+t,role:"assistant",speaker:"Ayla",speakerId:"p_a",content:t}); });
      const realCC=window.chatCompletion; let event=0;
      window.chatCompletion=async(m,mo,o)=>{ const d=(o&&o.dbg)||""; if(d==="Gamemaster: judge")return JSON.stringify({stale:true,trigger:false}); if(d==="Gamemaster: event"){ event++; return "A door slams."; } return realCC(m,mo,o); };
      _moveDecJobs.set(c.id,new Promise(()=>{})); c._movedAtTurn=_playerTurns(c);
      const t0=Date.now(); await maybeGamemaster(c,false); const ms=Date.now()-t0;
      _moveDecJobs.delete(c.id); delete c._movedAtTurn; window.chatCompletion=realCC; state.gmOn=false; state.gmDecOn=true; MOVE_GM_WAIT_MS=keep;
      return (event===0&&ms<3000)?true:JSON.stringify({event,ms}); }));

  console.log("\n[settings and prompts]");
  ok("on by default at 0.75; Settings shows and saves both", await pg.evaluate(()=>{ localStorage.removeItem(K.moveDecOn); localStorage.removeItem(K.moveAt); loadState();
      const d=state.moveDecOn===true&&moveAt()===0.75; syncSettingsUI(); const on=document.getElementById('setMoveDecOn'), at=document.getElementById('setMoveAt');
      if(!on||!at)return "no inputs"; on.checked=false; at.value="0.9"; saveSettings();
      const saved=store.raw(K.moveDecOn,"")==="0"&&store.raw(K.moveAt,"")==="0.9"; localStorage.removeItem(K.moveDecOn); localStorage.removeItem(K.moveAt); loadState();
      return (d&&saved)?true:JSON.stringify({d,saved}); }));
  ok("both questions are registry prompts on the Gamemaster card", await pg.evaluate(()=>{ const card=ENGINE_PAYLOAD_DEFS.find(d=>(d.blocks||[]).some(x=>x.promptKey==="gmJudge"));
      return (PROMPT_BY_KEY.x_move_pick&&PROMPT_BY_KEY.x_move_why&&card&&["x_move_pick","x_move_why"].every(k=>card.blocks.some(x=>x.promptKey===k)))?true:"missing"; }));

  ok("no page errors", errs.length===0?true:errs.join(" | "));
  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close(); process.exit(fail?1:0);
})();
