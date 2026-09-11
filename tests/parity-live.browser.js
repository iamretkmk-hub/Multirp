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
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x||c).slice(0,1400));} };
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

  const compare=(kind,opt)=>pg.evaluate(a=>{
    const k=a.k, o=a.opt||{};
    const p=(state.personas||[]).find(x=>x.id==="p_q");
    const q=(state.personas||[]).find(x=>x.id==="p_r");
    const chat=curChat();
    const injected=(window.__pl_inj||{recent:[],diary:[],longterm:[]});
    const textMode=(k==="text");
    // v38.1 — the target may be the OTHER CHARACTER, which is the only way the player's own card
    // (and the "responding to another character" wording) ever renders.
    const tId=o.target==="char"?q.id:"__user__", tNm=o.target==="char"?q.name:state.user;
    const tOpts={chat,targetName:tNm,targetId:tId,textMode};
    if(k==="heat") chat._heatBeat={total:"3",n:"1"};
    const mk=()=>Object.assign({},
      buildCharPromptBlocks(p,[q],injected,(o.addressed||state.user),tOpts),
      buildTailBlocks({chat,selfP:p,selfId:p.id,selfName:p.name,targetName:tNm,
        targetId:tId,multi:(k==="multi"),injected,textMode}));
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
    try{ tpl=ptBuildMessages(k,blocks,hist,{chat,npc:p,targetName:tNm},mk); }
    catch(e){ threw=String(e&&e.message||e); }
    finally{ state.payloadTplOn=was; if(k==="heat")delete chat._heatBeat; }
    const A=JSON.stringify(classic,null,1), Bx=tpl?JSON.stringify(tpl,null,1):null;
    let where=null;
    if(Bx&&A!==Bx){ let i=0; while(i<A.length&&i<Bx.length&&A[i]===Bx[i])i++;
      where={at:i,classic:A.slice(Math.max(0,i-160),i+260),tpl:Bx.slice(Math.max(0,i-160),i+260)}; }
    return {classic:A, tpl:Bx, threw, where};
  },{k:kind,opt:opt||null});

  console.log("\n[the shipped engine, not a copy of it]");
  for(const kind of ["solo","multi","gm","text","heat"]){
    const r=await compare(kind);
    ok(kind+": the template path actually ran", r.tpl!==null && !r.threw
      ? true : "fell back to the classic path"+(r.threw?" — threw: "+r.threw:" (returned null)"));
    ok(kind+": and produced byte-identical output", r.tpl===r.classic
      ? true : "MISMATCH at "+(r.where&&r.where.at)+"\n--- classic ---\n"+(r.where&&r.where.classic)+"\n--- template ---\n"+(r.where&&r.where.tpl));
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
    // memories, promises and play notes — so RECENT/DISTANT MEMORIES, PROMISES, HOW YOU SPEAK and
    // YOU ALREADY SAID THIS all render for real instead of resolving empty and proving nothing.
    state.mem=true;
    window.__pl_inj={diary:[],
      recent:[{id:"m1",text:"She waited an hour at the tram stop.",emotion:"tense",day:3,location:"The port"},
              {id:"m2",text:"He paid for the coffee without looking up.",day:3}],
      longterm:[{id:"m9",text:"They stopped speaking the winter their father died.",day:1,location:"The old flat"}]};
    chat.promises=[
      {id:"pr1",status:"open",holderId:"p_q",holderName:"Ayse",toId:"__user__",toName:"Kemal",
       promise:"never to bring it up in front of his mother",ask:"because it would start the whole thing again",day:2},
      {id:"pr2",status:"open",holderId:"__user__",holderName:"Kemal",toId:"p_q",toName:"Ayse",
       promise:"to come to the hearing",weight:"soft",day:2},
      {id:"pr3",status:"broken",holderId:"p_q",holderName:"Ayse",toId:"__user__",toName:"Kemal",
       promise:"to call on Sunday",statusDay:3,day:1,note:"she did not"}];
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
      ? true : (r.threw?("threw: "+r.threw):"MISMATCH at "+(r.where&&r.where.at)+"\n--- classic ---\n"+(r.where&&r.where.classic)+"\n--- template ---\n"+(r.where&&r.where.tpl)));
  }
  ok("and those fragments really did fire", await pg.evaluate(()=>{
      const p=(state.personas||[]).find(x=>x.id==="p_q");
      const q=(state.personas||[]).find(x=>x.id==="p_r");
      const chat=curChat(); const injected=(window.__pl_inj||{recent:[],diary:[],longterm:[]});
      const B=Object.assign({},
        buildCharPromptBlocks(p,[q],injected,state.user,{chat,targetName:state.user,targetId:"__user__"}),
        buildTailBlocks({chat,selfP:p,selfId:p.id,selfName:p.name,targetName:state.user,
          targetId:"__user__",injected}));
      const miss=[];
      if(!(B._drives&&B._drives.drive_toward&&B._drives.drive_against)) miss.push("drives");
      if(!(B._rg&&B._rg.guidance_absence)) miss.push("absence note");
      if(!(B._rt&&B._rt.target_header&&B._rt.target_bg)) miss.push("target fragments");
      if(!(B.drives&&B.drives.indexOf("PULLING AT YOU")>-1)) miss.push("drives block");
      if(!(B._mem&&B._mem.mem_recent_entries&&B._mem.mem_distant_entries)) miss.push("memories");
      if(!(B._pr&&B._pr.promise_yours&&B._pr.promise_owed&&B._pr.promise_ended)) miss.push("promises");
      if(!(B._as&&B._as.already_said_lines)) miss.push("already said");
      if(!(B._ss&&B._ss.style_body&&B._ss.style_notes)) miss.push("speaking style");
      if(!(B._ll&&B._ll.last_line_body)) miss.push("last line");
      if(!(B._yb&&B._yb.bio_intro&&B._yb.bio_body)) miss.push("bio");
      if(!(B._op&&B._op.others_list&&B._op.others_footer)) miss.push("others present");
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
      ? true : (r.threw?("threw: "+r.threw):"MISMATCH at "+(r.where&&r.where.at)+"\n--- classic ---\n"+(r.where&&r.where.classic)+"\n--- template ---\n"+(r.where&&r.where.tpl)));
  }
  ok("the carry-on wording is what fired", await pg.evaluate(()=>{
      const p=(state.personas||[]).find(x=>x.id==="p_q");
      const q=(state.personas||[]).find(x=>x.id==="p_r");
      const chat=curChat(); const injected=(window.__pl_inj||{recent:[],diary:[],longterm:[]});
      const B=Object.assign({},
        buildCharPromptBlocks(p,[q],injected,state.user,{chat,targetName:state.user,targetId:"__user__"}),
        buildTailBlocks({chat,selfP:p,selfId:p.id,selfName:p.name,targetName:state.user,
          targetId:"__user__",injected}));
      const miss=[];
      if(!(B._rt&&B._rt.cont_target_header&&B._rt.cont_target_self)) miss.push("carry-on target");
      if(B._rt&&B._rt.target_header) miss.push("normal heading fired too");
      if(!(B._rg&&B._rg.guidance_continue)) miss.push("carry-on guidance");
      return miss.length?miss.join(", "):true; }));

  /* v38.1 — step 4: the eleven blocks that had never rendered in this fixture at all, which is
     exactly why nobody had looked at them. Two turned out to be whole prompts written in code. */
  await pg.evaluate(()=>{
    const chat=curChat(); const uni=state.universes[0];
    const p=(state.personas||[]).find(x=>x.id==="p_q");
    // how she feels about Kemal — settled and live, with a tension the fast axes carry
    const k=relDirKey(p.id,"__user__");
    const o=relObj(chat,p.id,"__user__");
    o.desc="She has never forgiven him and has never once said so.";
    o.affection=10; o.trust=5; o.respect=20; o.familiarity=60;
    o.st.desire=60; o.st.agitation=20;
    o.stNote="Keep answering him, but stand further away than you want to.";
    o.stNoteAt=chat.messages.length; o.stNoteDay=chat.gameDay;
    chat.rel[k]=o;
    // trackers, story threads, a private aim, a rumor she has a stake in, and voicing on
    state.trackOn=true;
    uni.gameData=uni.gameData||{};
    uni.gameData.quests=[{id:"q1",title:"The missing ledger",desc:"Ayse knows more about it than she has said.",
      charName:"Ayse",location:"The port",progress:[{day:3,text:"The clerk would not look at her."}]}];
    // the private aim only colours a turn when its target is another CHARACTER who is present
    chat.intents=[{id:"i1",holderId:p.id,targetId:"p_r",targetName:"Emre",valence:"warm",
      kind:"reach",aim:"to get him to stay past closing",status:"open",strength:60}];
    uni.trackers=[{id:"t1",name:"Trust",owner:"__story__",userVisibility:"public",
      min:0,max:100,start:20,behavior:"free",method:"llm"}];
    // one rumor she is the subject of, and one she has only heard
    state.gossip=[{id:"g1",universeId:uni.id,stakeholderId:p.id,heat:0.8,status:"open",
                   text:"that she was seen at the lawyer's office twice this week",carriers:[]},
                  {id:"g2",universeId:uni.id,stakeholderId:"p_r",heat:0.6,status:"open",
                   text:"that Emre has not paid the rent since spring",carriers:[{charId:p.id}]}];
    state.memory=[{id:"a1",ownerId:p.id,universeId:uni.id,gameDay:3,date:Date.now()-2000,
                   text:"She counted the till twice and said nothing about the gap."},
                  {id:"a2",ownerId:p.id,universeId:uni.id,gameDay:4,date:Date.now()-1000,
                   text:"He asked where she had been and she changed the subject."}];
    state.autoSpeak=true;
    chat.watchingNow={text:"the news, with the sound down",at:chat.messages.length};
    markChatDirty(chat);
  });
  console.log("\n[the eleven that had never rendered]");
  for(const kind of ["solo","multi","gm","text","heat"]){
    const r=await compare(kind);
    ok(kind+": still byte-identical", r.tpl===r.classic && !r.threw
      ? true : (r.threw?("threw: "+r.threw):"MISMATCH at "+(r.where&&r.where.at)+"\n--- classic ---\n"+(r.where&&r.where.classic)+"\n--- template ---\n"+(r.where&&r.where.tpl)));
  }
  for(const v of [{target:"char"},{addressed:"arriving"},{addressed:"leaving"}]){
    const r=await compare("solo",v);
    ok("solo "+JSON.stringify(v)+": still byte-identical", r.tpl===r.classic && !r.threw
      ? true : (r.threw?("threw: "+r.threw):"MISMATCH at "+(r.where&&r.where.at)+"\n--- classic ---\n"+(r.where&&r.where.classic)+"\n--- template ---\n"+(r.where&&r.where.tpl)));
  }
  ok("and the eleven really did render", await pg.evaluate(()=>{
      const p=(state.personas||[]).find(x=>x.id==="p_q");
      const q=(state.personas||[]).find(x=>x.id==="p_r");
      const chat=curChat(); const injected=window.__pl_inj;
      const mk=(addressed,tId,tNm)=>Object.assign({},
        buildCharPromptBlocks(p,[q],injected,addressed,{chat,targetName:tNm,targetId:tId}),
        buildTailBlocks({chat,selfP:p,selfId:p.id,selfName:p.name,targetName:tNm,targetId:tId,injected}));
      const B=mk(state.user,"__user__",state.user);
      const Bc=mk(state.user,q.id,q.name);          // aimed at the other character -> player card
      const Ba=mk("arriving","__user__",state.user); // entering the scene
      const miss=[];
      if(!(Bc._pl&&Bc._pl.player_intro)) miss.push("player");
      if(!(Ba._si&&Ba._si.situation_arriving)) miss.push("situation");
      if(!(B._sd&&Object.keys(B._sd).length)) miss.push("spoken delivery");
      if(!(B._pi&&Object.keys(B._pi).length)) miss.push("private intent");
      if(!(B._fe&&B._fe.feel_header&&B._fe.feel_lasting)) miss.push("feelings");
      if(!(B._fn&&B._fn.feel_now_header&&B._fn.feel_now_body)) miss.push("feelings now");
      if(!(B._qu&&B._qu.quest_intro&&B._qu.quest_lines)) miss.push("quests");
      if(!(B._la&&B._la.mem_latest_entries)) miss.push("latest arcs");
      if(!(B.trackers)) miss.push("trackers");
      if(!(B._ru&&B._ru.rumor_stake_header&&B._ru.rumor_stake_text&&B._ru.rumor_carrier_list)) miss.push("rumors");
      if(!(B._wn&&B._wn.watching_now)) miss.push("watching now");
      return miss.length?("never rendered: "+miss.join(", ")):true; }));

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
  /* v38.1 — and the end of the road for //full: with every piece split into named fragments, the
     only two left are the user's OWN formatting prompt and the now-playing line, and the second is
     only //full-shaped because it is one fragment with one fill. */
  ok("nothing is called as an opaque //full lump any more", await pg.evaluate(()=>{
      const left=[];
      PT_KINDS.forEach(k=>{ const t=ptDefaultTemplate(k); let m;
        const re=/\{\{call\/\/([a-zA-Z0-9_]+)\/\/full\}\}/g;
        while((m=re.exec(t))) if(left.indexOf(m[1])<0) left.push(m[1]); });
      return left.length?("still lumped: "+left.join(", ")):true; }));
  ok("erasing the headings cannot delete a piece outright", await pg.evaluate(()=>{
      // the bare form of every name the shipped template calls must be a real source, not a hole
      const s=ptSources({},null); const missing=[];
      PT_KINDS.forEach(k=>{ let m; const re=/\{\{call\/\/([a-zA-Z0-9_]+)(?:\/\/full)?\}\}/g;
        const t=ptDefaultTemplate(k);
        while((m=re.exec(t))){ const n=m[1];
          if(n!=="dialogue_history"&&!Object.prototype.hasOwnProperty.call(s,n)&&missing.indexOf(n)<0)
            missing.push(n); } });
      return missing.length?("no bare source: "+missing.join(", ")):true; }));

  ok("no page errors", errs.length===0?true:errs.join(" | "));
  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close(); process.exit(fail?1:0);
})();
