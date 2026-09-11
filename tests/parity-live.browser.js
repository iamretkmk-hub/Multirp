/* v38.0 — PARITY, AGAINST THE SHIPPED ENGINE.
   tests/payload-parity.test.js reimplements ptBuildMessages/ptExpand/ptSources inside itself and
   compares that copy against a copy of buildPayload. It never loads index.html — so it passed,
   byte-identical, while the real ptSources in the app referenced an identifier that did not exist
   and every template build was throwing and silently falling back to the classic path. A guarantee
   that cannot see the shipped code is not a guarantee.
   This runs the app's own functions in a browser: the template path must produce exactly what the
   classic path produces, for every reply payload kind, and it must not have fallen back to get
   there. */
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x||c).slice(0,900));} };
  const pg=await (await b.newContext()).newPage();
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file:///home/user/Multirp/index.html'); await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(900);

  await pg.evaluate(()=>{
    const uni=state.universes[0];
    uni.setting="A rainy port city.";
    const mk=(id,name,extra)=>Object.assign({id,name,universeId:uni.id,instructions:"Guarded.",
      personality:"Wry.",backstory:"Left at 19.",style:"Short sentences.",goals:"Find the shop.",
      wardrobe:"A grey coat.",scenario:"The cafe at closing.",
      look:{subject:"Woman",hair:"black",face:"sharp",body:"tall"}},extra||{});
    const p=mk("p_q","Ayse",{socialGraph:"Kemal is her cousin.",
      relationships:{"__user__":{tie:"cousin",relationship:"We do not speak."}}});
    const q=mk("p_r","Emre",{});
    state.personas.push(p,q);
    state.user="Kemal";
    const chat=curChat();
    chat.gameDay=4; chat.presentIds=[p.id,q.id];
    chat.calendar=[{id:"cq",kind:"meeting",title:"The lawyer",who:"Ayse",charIds:[p.id],
      withUser:true,day:5,period:"Morning",done:false},
      {id:"cd",kind:"meeting",title:"Coffee",who:"Ayse",charIds:[p.id],withUser:true,
       day:3,done:true,completedDay:3,result:"It was short."}];
    chat.messages=[{mid:"q0",role:"user",content:"I sat down.",present:[p.id,q.id]},
      {mid:"q1",role:"assistant",speaker:"Ayse",speakerId:p.id,content:'"You came back."',present:[p.id,q.id]},
      {mid:"q2",role:"user",content:"I did.",present:[p.id,q.id]}];
    markChatDirty(chat);
  });

  const compare=kind=>pg.evaluate(k=>{
    const p=(state.personas||[]).find(x=>x.id==="p_q");
    const q=(state.personas||[]).find(x=>x.id==="p_r");
    const chat=curChat();
    const injected={recent:[],diary:[],longterm:[]};
    const textMode=(k==="text");
    const tOpts={chat,targetName:state.user,targetId:"__user__",textMode};
    if(k==="heat") chat._heatBeat={total:"3",n:"1"};
    const mk=()=>Object.assign({},
      buildCharPromptBlocks(p,[q],injected,state.user,tOpts),
      buildTailBlocks({chat,selfP:p,selfId:p.id,selfName:p.name,targetName:state.user,
        targetId:"__user__",multi:(k==="multi"),injected,textMode}));
    const blocks=mk();
    const hist=[{role:"user",content:"I sat down."},{role:"assistant",content:'"You came back."'}];
    // classic assembly, exactly as the non-template path does it
    const pl=buildPayload(k,blocks,{});
    const classic=[];
    if(pl.head)classic.push({role:"system",content:pl.head});
    classic.push.apply(classic,hist);
    if(pl.tail)classic.push({role:"system",content:pl.tail});
    const was=state.payloadTplOn; state.payloadTplOn=true;
    let tpl=null,threw=null;
    try{ tpl=ptBuildMessages(k,blocks,hist,{chat,npc:p,targetName:state.user},mk); }
    catch(e){ threw=String(e&&e.message||e); }
    finally{ state.payloadTplOn=was; if(k==="heat")delete chat._heatBeat; }
    return {classic:JSON.stringify(classic,null,1), tpl:tpl?JSON.stringify(tpl,null,1):null, threw};
  },kind);

  console.log("\n[the shipped engine, not a copy of it]");
  for(const kind of ["solo","multi","gm","text","heat"]){
    const r=await compare(kind);
    ok(kind+": the template path actually ran", r.tpl!==null && !r.threw
      ? true : "fell back to the classic path"+(r.threw?" — threw: "+r.threw:" (returned null)"));
    ok(kind+": and produced byte-identical output", r.tpl===r.classic
      ? true : "MISMATCH\n--- classic ---\n"+String(r.classic).slice(0,400)+"\n--- template ---\n"+String(r.tpl).slice(0,400));
  }

  /* v38.1 — THE EMPTY SCENE PROVES ALMOST NOTHING. The fixture above has no drives, nobody absent,
     no scene change and nobody who spoke last, so the conditional fragments of WHO YOU ARE
     RESPONDING TO, RESPONSE GUIDANCE and DRIVES & BRAKES never fire — and a piece that never fires
     is byte-identical for free. This second pass lights every one of them, so parity is being
     asserted on the fragments that were actually moved into the template. */
  const loaded=await pg.evaluate(()=>{
    const uni=state.universes[0];
    const chat=curChat();
    const p=(state.personas||[]).find(x=>x.id==="p_q");
    // somebody real, active in this universe, who is NOT in the room — and then named out loud
    state.personas.push({id:"p_s",name:"Deniz",universeId:uni.id,instructions:"Blunt.",
      personality:"Loud.",backstory:"Never left.",look:{subject:"Man"}});
    chat.location="The port"; chat.locationId=null;
    state.userBio="A ledger clerk who counts other people's money.";
    state.userLook="Thin, greying, always in the same coat.";
    chat.messages=[
      {mid:"q0",role:"user",content:"I sat down.",present:["p_q","p_r"]},
      {mid:"q1",role:"assistant",speaker:"Ayse",speakerId:"p_q",content:'"You came back."',
       present:["p_q","p_r"],status:{location:"The cafe",day:3,period:"Evening"}},
      {mid:"q2",role:"user",content:"Where is Deniz tonight?",present:["p_q","p_r"]}];
    chat._psyche={p_q:{toward:"She wants to be told she was missed.",
                       against:"Saying it first would cost her the only ground she has."}};
    markChatDirty(chat);
    const t=ptDefaultTemplate("solo");
    return {tplHasDrives:/PULLING AT YOU/.test(t)&&/\{\{call\/\/drive_toward\}\}/.test(t)};
  });
  ok("the drives heading and closing note are prose in the template",
     loaded.tplHasDrives===true?true:"drives not unpacked");

  console.log("\n[with drives, an absent name, and a scene that moved]");
  for(const kind of ["solo","multi","gm","text","heat"]){
    const r=await compare(kind);
    ok(kind+": still byte-identical", r.tpl===r.classic && !r.threw
      ? true : (r.threw?("threw: "+r.threw):"MISMATCH\n--- classic ---\n"+String(r.classic).slice(0,900)+"\n--- template ---\n"+String(r.tpl).slice(0,900)));
  }
  ok("and those fragments really did fire", await pg.evaluate(()=>{
      const p=(state.personas||[]).find(x=>x.id==="p_q");
      const q=(state.personas||[]).find(x=>x.id==="p_r");
      const chat=curChat(); const injected={recent:[],diary:[],longterm:[]};
      const B=Object.assign({},
        buildCharPromptBlocks(p,[q],injected,state.user,{chat,targetName:state.user,targetId:"__user__"}),
        buildTailBlocks({chat,selfP:p,selfId:p.id,selfName:p.name,targetName:state.user,
          targetId:"__user__",injected}));
      const miss=[];
      if(!(B._drives&&B._drives.drive_toward&&B._drives.drive_against)) miss.push("drives");
      if(!(B._rg&&B._rg.guidance_absence)) miss.push("absence note");
      if(!(B._rt&&B._rt.target_header&&B._rt.target_bg)) miss.push("target fragments");
      if(!(B.drives&&B.drives.indexOf("PULLING AT YOU")>-1)) miss.push("drives block");
      return miss.length?("never fired: "+miss.join(", ")):true; }));

  /* And the OTHER half of WHO YOU ARE RESPONDING TO: when the character spoke last and nothing
     new is aimed at them, the block swaps to a different heading and a different opening, and the
     guidance swaps its last line with it. Neither wording is reachable from the passes above. */
  await pg.evaluate(()=>{
    const chat=curChat();
    chat.messages.push({mid:"q3",role:"assistant",speaker:"Ayse",speakerId:"p_q",
      content:'"He is not here."',present:["p_q","p_r"],
      status:{location:"The port",day:4,period:"Evening"}});
    markChatDirty(chat);
  });
  console.log("\n[when the character spoke last]");
  for(const kind of ["solo","heat"]){
    const r=await compare(kind);
    ok(kind+": still byte-identical", r.tpl===r.classic && !r.threw
      ? true : (r.threw?("threw: "+r.threw):"MISMATCH\n--- classic ---\n"+String(r.classic).slice(0,900)+"\n--- template ---\n"+String(r.tpl).slice(0,900)));
  }
  ok("the carry-on wording is what fired", await pg.evaluate(()=>{
      const p=(state.personas||[]).find(x=>x.id==="p_q");
      const q=(state.personas||[]).find(x=>x.id==="p_r");
      const chat=curChat(); const injected={recent:[],diary:[],longterm:[]};
      const B=Object.assign({},
        buildCharPromptBlocks(p,[q],injected,state.user,{chat,targetName:state.user,targetId:"__user__"}),
        buildTailBlocks({chat,selfP:p,selfId:p.id,selfName:p.name,targetName:state.user,
          targetId:"__user__",injected}));
      const miss=[];
      if(!(B._rt&&B._rt.cont_target_header&&B._rt.cont_target_self)) miss.push("carry-on target");
      if(B._rt&&B._rt.target_header) miss.push("normal heading fired too");
      if(!(B._rg&&B._rg.guidance_continue)) miss.push("carry-on guidance");
      return miss.length?miss.join(", "):true; }));

  console.log("\n[the pieces the template now spells out]");
  ok("the task heading is prose in the template, not a call", await pg.evaluate(()=>{
      const t=ptDefaultTemplate("solo");
      return /# TASK/.test(t) && /\{\{call\/\/task\}\}/.test(t) && !/call\/\/task\/\/full/.test(t)
        ? true : t.slice(0,200); }));
  ok("so is the relationships heading", await pg.evaluate(()=>
      /RELATIONSHIPS/.test(ptDefaultTemplate("solo"))));
  ok("the guardrails are listed one rail per line", await pg.evaluate(()=>{
      const t=ptDefaultTemplate("solo");
      return /\{\{call\/\/rail_voice\}\}/.test(t) && /\{\{call\/\/rail_form\}\}/.test(t)
          && !/call\/\/final_guardrails/.test(t) ? true : "rails not unpacked"; }));
  ok("each payload kind lays them in its own order", await pg.evaluate(()=>{
      const heat=ptDefaultTemplate("heat"), text=ptDefaultTemplate("text");
      return /rail_heat_len/.test(heat) && !/rail_heat_len/.test(text)
          && /rail_text_channel/.test(text) && !/rail_text_channel/.test(heat)
        ? true : "orders did not differ"; }));
  ok("a rail that did not fire is a known name, not a typo", await pg.evaluate(()=>{
      const s=ptSources({},null);
      return Object.prototype.hasOwnProperty.call(s,"rail_form") ? true : "rail_form unknown"; }));

  ok("no page errors", errs.length===0?true:errs.join(" | "));
  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close(); process.exit(fail?1:0);
})();
