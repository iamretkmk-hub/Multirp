/* v150.69 — PATHS ARE TICKS, CONDITIONS ARE FACTS AND DECISIONS. The report: "if you write `render_mode = solo or render_mode =
   multi or render_mode = gm` and also toggle the ticks for the same paths, the prompt appears twice in the payload" — and the
   condition box should not be choosing paths at all. Checked here:
     - the reproduction, through the real editor: a new option with its text, that condition, the paths ticked in both rows and
       the text pasted into the path boxes, saved — the text reaches each of its paths ONCE (it was twice), and nowhere else;
     - the guard: a path box that holds the main text (or starts with it) sends the main text once; an option whose text this
       fragment already sends is not sent again;
     - the semantics: an option with no condition and no question applies on the paths ticked for it; with nothing ticked as
       well it is never sent; a question with ticks is asked only there;
     - no shipped option code names render_mode; {{if render_mode = …}} inside a text and an old saved condition still work;
     - the payload is unchanged: the v150.67 shape of the four changed fragments and the shipped ones compile to the same layout
       on every path over a grid of flags, and build the same payload in the fragment-wording situations;
     - the migration: an unedited v150.67 fragment is replaced; in an edited one a condition that only chose the path moves to
       the ticks (same payload), a mixed one stays; once;
     - the editor: the condition box's label and help (decisions first, no render_mode), the note "Choose paths with the ticks
       below", "Move to ticks" for a pure path condition (live, as it is typed), the flag on the fragment's row, the two tick
       rows told apart, and the note on a path box that repeats the text above.
   Run: node tests/fragment-paths.browser.js   (needs playwright; see tests/README.md) */
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:process.env.SM_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage({viewport:{width:412,height:915}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file://'+require('path').resolve(__dirname,'..','index.html')); await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(800);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x===undefined?c:x).slice(0,900));} };
  const KINDS=["solo","multi","gm","text","heat"];

  await pg.evaluate(()=>{
    window.uiConfirm=async()=>true;
    window.__setup=()=>{
      const uni=state.universes[0];
      state.personas=[{id:"p_a",name:"Ayla",universeId:uni.id,personality:"Sharp.",relationships:{__user__:{tie:"neighbour",relationship:"Emre lives across the hall."}}},
        {id:"p_b",name:"Berk",universeId:uni.id,personality:"Loud."}];
      state.user="Emre"; state.fragments=null; store.setRaw(K.fragments,""); store.setRaw(K.fragAdds,FRAG_SHIPPED_ADDS.map(a=>a.key).join(","));
      state.autoSpeak=false; state.memory=[]; _fragMigratedFor=null;
      const c=curChat();
      Object.assign(c,{universeId:uni.id,presentIds:["p_a","p_b"],emo:{},calendar:[],intents:[],rel:{},gameDay:3,period:"Evening",
        messages:[{mid:"u1",role:"user",content:'"Hi."'},{mid:"a1",role:"assistant",speaker:"Ayla",speakerId:"p_a",content:'"Hello."'},{mid:"u2",role:"user",content:'"So?"'}]});
      return c; };
    // the real payload of one path, from the saved list (or `list`)
    window.__payload=(kind,list)=>{ const c=curChat(), p=state.personas[0]; const inj={recent:[],diary:[],longterm:[]};
      const mk=()=>Object.assign({},buildCharPromptBlocks(p,[],inj,null,{chat:c,targetName:"Emre",targetId:"__user__",payloadKind:kind,textMode:kind==="text"}),
        buildTailBlocks({chat:c,selfP:p,selfId:p.id,selfName:p.name,targetName:"Emre",targetId:"__user__",injected:inj,payloadKind:kind,textMode:kind==="text",multi:kind==="multi"}));
      if(kind==="heat")c._heatBeat={n:2,total:5}; else delete c._heatBeat;
      try{ return (ptBuildMessages(kind,mk(),[{role:"user",content:"(history)"}],{chat:c,npc:p,targetName:"Emre",fragments:list||undefined},mk)||[]).map(m=>m.role+": "+m.content).join("\n"); }
      finally{ delete c._heatBeat; } };
    window.__openEditor=()=>{ _fragDraft=null; _fragOpen=null; show('settings'); renderFragEditor();
      let d=document.getElementById('fragHost'); while(d){ if(d.tagName==="DETAILS")d.open=true; d=d.parentElement; } };
    // the v150.67 shape: the four fragments v150.69 changed, as they were
    window.__v67=()=>JSON.parse(JSON.stringify(FRAG_DEFAULTS)).map(f=>FRAG_DEFAULTS_V150_67_PATHS[f.id]?JSON.parse(JSON.stringify(FRAG_DEFAULTS_V150_67_PATHS[f.id])):f);
    // the compiled layout over a grid of flags, every path
    window.__grid=list=>{ const r={}, B=[true,false];
      ["solo","multi","gm","text","heat"].forEach(k=>B.forEach(cont=>B.forEach(voi=>B.forEach(vm=>B.forEach(st=>B.forEach(hl=>{
        const fl=ptCondFlags({render_mode:k,continuing:cont,voicing:voi,voice_markup:vm,heat_narr:st?"physical":"superego",stalled:st,has_line:hl,has_target:true,heat_last_beat:hl,
          format_rules_raw:true,narr_active:voi,base_instruction_raw:true,emotion:st?"Anger":"Calm",ego:hl?"id_winning":"superego_holding",broke_character:cont,repeated:voi});
        r[[k,cont,voi,vm,st,hl].join()]=fragCompile(k,fl,{},false,{list}); }))))));
      return r; };
  });

  console.log("\n[the reproduction, through the editor: the text once on each of its paths]");
  const run=async(label,steps)=>{
    await pg.evaluate(()=>{ __setup(); __openEditor(); });
    const i=await pg.evaluate(()=>{ const i=_fragDraftGet().findIndex(f=>f.id==="respond_as"); fragEdOpen(i); fragEdOptAdd(i); return i; });
    const fp=i+".o."+(await pg.evaluate(i=>_fragDraftGet()[i].options.length-1,i));
    const host=pg.locator('#fragHost');
    await host.locator(`textarea[data-fp="${fp}.text"]`).fill("ZEBRA RULE: keep it short.");
    await steps(host,fp);
    const note=await pg.evaluate(()=>document.getElementById('fragHost').innerHTML);
    await pg.locator('#fragHost button', {hasText:'Save fragments'}).click();
    const n=await pg.evaluate(()=>["solo","multi","gm","text","heat"].map(k=>(__payload(k).match(/ZEBRA RULE/g)||[]).length).join(","));
    return {n,note};
  };
  const typeCode=async(host,fp)=>{ await host.locator(`input[data-fp="${fp}.code"]`).fill("render_mode = solo or render_mode = multi or render_mode = gm"); };
  const tickOnly=async(host,fp)=>{ for(const p of ["solo","multi","gm"]) await host.locator(`input[onchange^="fragEdPath('${fp}','${p}'"]`).check(); };
  const pasteInBoxes=async(host,fp)=>{ for(const p of ["solo","multi","gm"]){
      const cb=host.locator(`input[onchange^="fragEdByPath('${fp}','${p}'"]`); if(!(await cb.isVisible())) await host.locator(`details[data-bp="${fp}"] > summary`).click();
      await cb.check(); await host.locator(`textarea[data-fp="${fp}.byPath.${p}"]`).fill("ZEBRA RULE: keep it short."); } };
  const R1=await run("the report",async(h,fp)=>{ await typeCode(h,fp); await tickOnly(h,fp); await pasteInBoxes(h,fp); });
  ok("the condition, the ticks and the text pasted in the path boxes: once on solo, multi and gamemaster, never on text and heat (it was twice)", R1.n==="1,1,1,0,0", R1.n);
  ok("the editor said the path box repeats the text above and the condition chooses the path", /This box repeats the text above: it is sent once/.test(R1.note)&&/Choose paths with the ticks below/.test(R1.note), "notes missing");
  const R2=await run("ticks only",async(h,fp)=>{ await tickOnly(h,fp); });
  ok("only the ticks, no condition: sent on those paths, once (it was never sent)", R2.n==="1,1,1,0,0", R2.n);
  const R3=await run("code and ticks",async(h,fp)=>{ await typeCode(h,fp); await tickOnly(h,fp); });
  ok("the condition and the ticks: once", R3.n==="1,1,1,0,0", R3.n);
  const R4=await run("nothing",async()=>{});
  ok("nothing ticked, no condition, no question: never sent, and the editor says so", R4.n==="0,0,0,0,0"&&/this option is never sent/.test(R4.note), R4.n);
  const R5=await run("more in the box",async(h,fp)=>{ await tickOnly(h,fp);
    const cb=h.locator(`input[onchange^="fragEdByPath('${fp}','gm'"]`); if(!(await cb.isVisible())) await h.locator(`details[data-bp="${fp}"] > summary`).click(); await cb.check();
    await h.locator(`textarea[data-fp="${fp}.byPath.gm"]`).fill("ZEBRA RULE: keep it short.\n\nAnd the gamemaster's own line."); });
  ok("a path box that starts with the text and adds more: the text once, then what the box adds", R5.n==="1,1,1,0,0"
    &&await pg.evaluate(()=>/ZEBRA RULE: keep it short\.\n\nAnd the gamemaster's own line\./.test(__payload("gm"))&&!/gamemaster's own line/.test(__payload("solo"))), R5.n);

  console.log("\n[the guard]");
  ok("_fragTextFor: the same text in the box is sent once; a box that goes on adds the rest; a different text is added under it", await pg.evaluate(()=>{
      const T=(m,b)=>_fragTextFor({text:m,byPath:{solo:b}},"solo");
      const r=[T("A rule.","A rule.")==="A rule.", T("A rule.","  A rule.  ")==="A rule.", T("A rule.","A rule.\n\nMore.")==="A rule.\n\nMore.", T("A rule.","A rule. More.")==="A rule. More.",
        T("Do not","Do nothing")==="Do not\n\nDo nothing", T("A rule.","Other.")==="A rule.\n\nOther.", T("","Only here.")==="Only here.", T("A rule.","")==="A rule."];
      return r.every(Boolean)?true:r.join(); }));
  ok("fragCompile: an option whose text the fragment already sends (the main body, or another option that fired) is not sent again", await pg.evaluate(()=>{
      const L=[{id:"x",name:"X",seg:"tail",paths:["solo","text"],text:"MAIN LINE.",byPath:{},mode:"any",options:[
        {id:"a",name:"a",code:"",ask:"",ctx:[],text:"OPTION LINE.",paths:["solo"],byPath:{}},{id:"b",name:"b",code:"continuing",ask:"",ctx:[],text:"OPTION LINE.",paths:[],byPath:{}},
        {id:"c",name:"c",code:"continuing",ask:"",ctx:[],text:"MAIN LINE.",paths:[],byPath:{}}]}];
      const t=fragCompile("solo",ptCondFlags({continuing:true}),{},false,{list:L}), u=fragCompile("text",ptCondFlags({continuing:true}),{},false,{list:L});
      const n=(s,re)=>(s.match(re)||[]).length;
      return (n(t,/OPTION LINE/g)===1&&n(t,/MAIN LINE/g)===1&&n(u,/OPTION LINE/g)===1&&n(u,/MAIN LINE/g)===1)?true:JSON.stringify([t,u]); }));

  console.log("\n[the semantics]");
  ok("no condition, no question: applies on its ticks; nothing ticked: never; a question with ticks is asked only there", await pg.evaluate(()=>{
      const L=[{id:"x",name:"X",seg:"tail",paths:["solo","multi","gm","text","heat"],text:"",byPath:{},mode:"any",options:[
        {id:"t",name:"t",code:"",ask:"",ctx:[],text:"TICKED.",paths:["multi","heat"],byPath:{}},{id:"n",name:"n",code:"",ask:"",ctx:[],text:"NEVER.",paths:[],byPath:{}},
        {id:"q",name:"q",code:"",ask:"Is it raining?",ctx:[],text:"ASKED.",paths:["text"],byPath:{}}]}];
      const on=k=>fragCompile(k,ptCondFlags({}),{"q_x__q":0.95},false,{list:L});
      const r={t:["solo","multi","gm","text","heat"].filter(k=>/TICKED/.test(on(k))).join(), never:["solo","multi","gm","text","heat"].some(k=>/NEVER/.test(on(k))),
        q:["solo","multi","gm","text","heat"].filter(k=>/ASKED/.test(on(k))).join(), asks:["solo","text"].map(k=>fragAskList(k,L).length).join()};
      const trace=[]; fragCompile("multi",ptCondFlags({}),{},false,{list:L,trace}); r.by=(trace[0]&&trace[0].opts[0]||{}).by;
      return (r.t==="multi,heat"&&r.never===false&&r.q==="text"&&r.asks==="0,1"&&r.by==="path")?true:JSON.stringify(r); }));

  console.log("\n[no render_mode in a shipped condition]");
  ok("no shipped option's condition names render_mode, and every shipped option has a condition, a question or ticks", await pg.evaluate(()=>{
      const bad=[], never=[]; FRAG_DEFAULTS.forEach(f=>(f.options||[]).forEach(o=>{ if(/render_mode/.test(o.code||""))bad.push(f.id+"/"+o.id);
        if(!String(o.code||"").trim()&&!String(o.ask||"").trim()&&!(o.paths||[]).length)never.push(f.id+"/"+o.id); }));
      return (!bad.length&&!never.length)?true:JSON.stringify({bad,never}); }));
  ok("the converted options: their paths are their ticks", await pg.evaluate(()=>{
      const o=(f,id)=>((FRAG_DEFAULTS.find(x=>x.id===f)||{}).options||[]).find(x=>x.id===id)||{};
      const s=(f,id)=>{ const x=o(f,id); return (x.code||"")+"|"+(x.paths||[]).join(); };
      const r=[s("format","spoken"),s("format","texting"),s("format","heat"),s("format","beat_end"),s("scene_now","live"),s("scene_now","live_text"),
        s("last_before","spoken"),s("last_before","texting"),s("last_before","heat"),s("guardrails","noecho"),s("guardrails","noecho_text")].join(" ; ");
      return r==="|solo,multi,gm ; |text ; |heat ; |heat ; |solo,multi,gm,heat ; |text ; |solo,multi,gm ; |text ; |heat ; not continuing|solo,multi,gm ; |text,heat"?true:r; }));
  ok("render_mode is still a flag: {{if render_mode = …}} inside a text (compass, language, privacy) and an old saved condition work", await pg.evaluate(()=>{
      const g=id=>FRAG_DEFAULTS.find(x=>x.id===id);
      // (v150.70 — memories left this list: it is the player's own wording now, one text on every path, with no render_mode in it)
      const inText=["compass","language","privacy"].every(id=>/\{\{if render_mode = /.test(JSON.stringify(g(id))));
      const L=[{id:"x",name:"X",seg:"tail",paths:["solo","text"],text:"",byPath:{},mode:"any",options:[{id:"o",name:"o",code:"render_mode = text",ask:"",ctx:[],text:"OLD CODE.",paths:[],byPath:{}}]}];
      const old=["solo","text"].map(k=>/OLD CODE/.test(fragCompile(k,ptCondFlags({render_mode:k}),{},false,{list:L}))).join();
      return (inText&&old==="false,true")?true:JSON.stringify({inText,old}); }));

  console.log("\n[the payload is unchanged]");
  const G=await pg.evaluate(()=>{ const a=__grid(__v67()), b=__grid(FRAG_DEFAULTS); const keys=Object.keys(a); return {n:keys.length,diff:keys.filter(k=>a[k]!==b[k])}; });
  ok("the compiled layout of every path over "+G.n+" flag combinations is the same as with the v150.67 fragments", G.n===160&&G.diff.length===0, JSON.stringify(G.diff.slice(0,5)));
  const P=await pg.evaluate(()=>{ const r={n:0,diff:[]};
    const S={plain:c=>{}, cont:c=>c.messages.push({mid:"a2",role:"assistant",speaker:"Ayla",speakerId:"p_a",content:'"Yes."'}),
      voiced:()=>{ state.autoSpeak=true; }, markup:c=>{ c.messages.splice(1,1,{mid:"a1",role:"assistant",speaker:"Ayla",speakerId:"p_a",content:'"[say quietly] Hello."'}); },
      stalled:c=>{ for(let i=0;i<3;i++){ c.messages.push({mid:"a"+i+"x",role:"assistant",speaker:"Ayla",speakerId:"p_a",content:'"No. Not the key."'},{mid:"u"+i+"x",role:"user",content:'"Give me the key."'}); } },
      flags:c=>{ c.messages[1].replyFlags=["character","player","repeat","continuity"]; c.messages.push({mid:"u9",role:"user",content:'"Well?"'}); }};
    Object.keys(S).forEach(n=>["solo","multi","gm","text","heat"].forEach(k=>{
      const c=__setup(); S[n](c); if(k==="text")c.messages.forEach(m=>{ m.textMsg=true; m.textWith="p_a"; });
      const a=__payload(k,__v67()); const c2=__setup(); S[n](c2); if(k==="text")c2.messages.forEach(m=>{ m.textMsg=true; m.textWith="p_a"; });
      const bb=__payload(k); r.n++; if(a!==bb)r.diff.push(k+"|"+n); }));
    state.autoSpeak=false; return r; });
  ok("the real payload, "+P.n+" builds (every path × plain, continuing, voiced, a stale voice session, stalled, the reply-check flags): the same as with the v150.67 fragments", P.n===30&&P.diff.length===0, JSON.stringify(P.diff));

  console.log("\n[the migration]");
  const M=await pg.evaluate(()=>{ __setup(); const r={};
    // an unedited v150.67 list: the four fragments are replaced by the shipped ones
    const keys=FRAG_SHIPPED_ADDS.map(a=>a.key).filter(k=>!/^v150\.69/.test(k)).join(",");
    state.fragments=__v67(); store.setRaw(K.fragAdds,keys); _fragMigratedFor=null; const L1=fragList();
    r.replaced=["format","scene_now","last_before","guardrails"].every(id=>_fragCanon(L1.find(f=>f.id===id))===_fragCanon(FRAG_DEFAULTS.find(f=>f.id===id)));
    // an edited list: format and guardrails edited, and a fragment of the user's own with path-only, mixed and never-true conditions
    const E=__v67(); const fmt=E.find(f=>f.id==="format"), gr=E.find(f=>f.id==="guardrails");
    fmt.options.find(o=>o.id==="spoken").name="My spoken format"; gr.text=gr.text+"\n\nMY OWN GUARDRAIL.";
    E.push({id:"f_mine",name:"Mine",seg:"tail",paths:["solo","multi","gm","text","heat"],text:"",byPath:{},mode:"any",options:[
      {id:"o1",name:"spoken",code:"render_mode = solo or render_mode = multi or render_mode = gm",ask:"",ctx:[],text:"MINE SPOKEN.",paths:["solo","multi","gm","text"],byPath:{}},
      {id:"o2",name:"not text",code:"render_mode != text",ask:"",ctx:[],text:"MINE NOT TEXT.",paths:[],byPath:{}},
      {id:"o3",name:"mixed",code:"render_mode = heat and voicing",ask:"",ctx:[],text:"MINE MIXED.",paths:[],byPath:{}},
      {id:"o4",name:"asked",code:"render_mode = text",ask:"Is {{char}} annoyed?",ctx:[],text:"MINE ASKED.",paths:[],byPath:{}},
      {id:"o5",name:"none",code:"render_mode = heat",ask:"",ctx:[],text:"MINE NONE.",paths:["solo"],byPath:{}}]});
    const before=JSON.parse(JSON.stringify(E)), gb=__grid(before);
    const gbA={}; ["solo","multi","gm","text","heat"].forEach(k=>{ gbA[k]=fragCompile(k,ptCondFlags({render_mode:k}),{"q_f_mine__o4":0.9},false,{list:before}); });
    state.fragments=E; store.setRaw(K.fragAdds,keys); _fragMigratedFor=null; const L2=fragList();
    const mine=L2.find(f=>f.id==="f_mine"), o=id=>mine.options.find(x=>x.id===id), s=x=>(x.code||"")+"|"+(x.paths||[]).join();
    r.mine=["o1","o2","o3","o4","o5"].map(id=>s(o(id))).join(" ; ");
    const f2=L2.find(f=>f.id==="format"), g2=L2.find(f=>f.id==="guardrails");
    r.fmt=s(f2.options.find(x=>x.id==="spoken"))+" ; "+s(f2.options.find(x=>x.id==="texting"))+" ; "+s(f2.options.find(x=>x.id==="beat_end"));
    r.gr=s(g2.options.find(x=>x.id==="noecho"))+" ; kept "+/MY OWN GUARDRAIL/.test(g2.text);
    const ga=__grid(L2); r.gridSame=Object.keys(gb).filter(k=>gb[k]!==ga[k]);
    r.askSame=["solo","multi","gm","text","heat"].filter(k=>gbA[k]!==fragCompile(k,ptCondFlags({render_mode:k}),{"q_f_mine__o4":0.9},false,{list:L2}));
    r.asks=["solo","text"].map(k=>fragAskList(k,L2).filter(x=>x.f.id==="f_mine").length).join();
    r.stored=/"o1"[^}]*"code":""/.test(store.raw(K.fragments,""));
    // once: a condition typed back afterwards stays
    o("o2").code="render_mode != text"; o("o2").paths=[]; _fragMigratedFor=null; fragList(); r.once=o("o2").code==="render_mode != text";
    return r; });
  ok("an unedited v150.67 fragment (format, scene_now, last_before, guardrails) is replaced by the shipped one", M.replaced===true, JSON.stringify(M));
  ok("an edited fragment: a condition that only chose the path moves to the ticks; a mixed one, and one true on none of its paths, stay",
    M.mine==="|solo,multi,gm ; |solo,multi,gm,heat ; render_mode = heat and voicing| ; |text ; render_mode = heat|solo"
    &&M.fmt==="|solo,multi,gm ; |text ; |heat"&&M.gr==="render_mode = text or render_mode = heat or not continuing| ; kept true", JSON.stringify(M));
  ok("…with the same payload: the compiled layout over the flag grid and the asked option, and the same questions", M.gridSame.length===0&&M.askSame.length===0&&M.asks==="0,1"&&M.stored===true, JSON.stringify(M));
  ok("…once", M.once===true, JSON.stringify(M));

  console.log("\n[the editor]");
  const ED=await pg.evaluate(()=>{ __setup(); const r={};
    const L=JSON.parse(JSON.stringify(FRAG_DEFAULTS)); L.push({id:"f_mine",name:"Mine",seg:"tail",paths:["solo","multi","gm","text","heat"],text:"",byPath:{},mode:"any",options:[
      {id:"o1",name:"mixed",code:"render_mode = heat and voicing",ask:"",ctx:[],text:"MINE MIXED.",paths:[],byPath:{}},
      {id:"o2",name:"typed",code:"",ask:"",ctx:[],text:"MINE TYPED.",paths:["solo"],byPath:{}}]});
    state.fragments=L; store.setRaw(K.fragments,JSON.stringify(L)); _fragMigratedFor=L;
    __openEditor(); const host=document.getElementById('fragHost'), i=_fragDraftGet().findIndex(f=>f.id==="f_mine");
    r.rowFlag=/a condition names a path/.test(document.getElementById('fragRow_'+i).textContent);
    r.otherRows=Array.from(host.querySelectorAll('.fragPathFlag')).length;
    fragEdOpen(i);
    const h=host.innerHTML, txt=host.textContent;
    r.label=/Condition — a fact or a decision \(optional\)/.test(txt);
    const help=(txt.match(/Condition — a fact or a decision \(optional\)[^]*?Blank = no condition\./)||[""])[0];
    r.helpNoRender=help.length>0&&!/render_mode/.test(help);
    const at=w=>help.indexOf(w);
    r.decisionsFirst=["emotion","intensity","tone","ego","broke_character","spoke_for_player","repeated","lost_track"].every(w=>at(w)>0&&at(w)<at("continuing"))&&at("continuing")<at("has_line")&&at("has_line")<at("target_kind");
    r.rows=/Only on these paths<\/b> — where this option applies/.test(h)&&/<b>Add text on a path:<\/b> extra text on that path, added under the text above — it does not choose where this option applies/.test(h);
    const box=j=>document.getElementById("fragCodeNote_"+i+"_o_"+j);
    r.mixedNote=/Choose paths with the ticks below/.test(box(0).textContent)&&!box(0).querySelector('button');
    r.typedNone=box(1).textContent==="";
    // typing a pure path condition: the note and "Move to ticks" appear as it is typed
    const inp=host.querySelector(`input[data-fp="${i}.o.1.code"]`); inp.value="render_mode = solo or render_mode = gm"; inp.dispatchEvent(new Event('input'));
    const btn=box(1).querySelector('button'); r.live=/Choose paths with the ticks below/.test(box(1).textContent)&&!!btn&&/Move to ticks/.test(btn.textContent);
    const o=_fragDraftGet()[i].options[1]; r.beforeMove=["solo","gm"].map(k=>/MINE TYPED/.test(fragCompile(k,ptCondFlags({render_mode:k}),{},false,{list:_fragDraftGet()}))).join();
    btn.click();
    r.moved=o.code===""&&o.paths.join()==="solo";
    r.afterMove=["solo","gm"].map(k=>/MINE TYPED/.test(fragCompile(k,ptCondFlags({render_mode:k}),{},false,{list:_fragDraftGet()}))).join();
    r.ticked=!!document.getElementById('fragHost').querySelector(`input[onchange^="fragEdPath('${i}.o.1','solo'"]`).checked&&!box(1).textContent;
    // the note on a path box that repeats the text above, live
    fragEdByPath(i+".o.1","solo",true);
    const ta=document.getElementById('fragHost').querySelector(`textarea[data-fp="${i}.o.1.byPath.solo"]`); ta.value="MINE TYPED."; ta.dispatchEvent(new Event('input'));
    r.sameNote=/This box repeats the text above: it is sent once\./.test(document.getElementById("fragBpNote_"+i+"_o_1_byPath_solo").textContent);
    _fragDraft=null; _fragOpen=null; state.fragments=null; store.setRaw(K.fragments,"");
    return r; });
  ok("the fragment's row is flagged when a condition names a path (and no shipped fragment is)", ED.rowFlag===true&&ED.otherRows===1, JSON.stringify(ED));
  ok("the box is \"Condition — a fact or a decision (optional)\"; its help lists the decisions first, then the facts, and no render_mode", ED.label&&ED.helpNoRender&&ED.decisionsFirst, JSON.stringify(ED));
  ok("\"Only on these paths\" (where it applies) and \"Add text on a path\" (extra text) are told apart", ED.rows===true, JSON.stringify(ED));
  ok("a mixed condition: \"Choose paths with the ticks below\", and no Move to ticks", ED.mixedNote===true&&ED.typedNone===true, JSON.stringify(ED));
  ok("typing a pure path condition shows the note and \"Move to ticks\" live; one tap moves it to the ticks with the same payload", ED.live&&ED.moved&&ED.ticked&&ED.beforeMove==="true,false"&&ED.afterMove==="true,false", JSON.stringify(ED));
  ok("a path box that repeats the text above says it is sent once", ED.sameNote===true, JSON.stringify(ED));

  ok("no page errors", errs.length===0, errs.join("\n"));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close(); process.exit(fail?1:0);
})();
