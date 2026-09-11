const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage({viewport:{width:412,height:915}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file:///home/user/Multirp/index.html'); await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(900);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x||c).slice(0,600));} };

  const openAll=()=>pg.evaluate(()=>{
    show('settings'); renderPayloadList(); renderPayloadTemplates();
    Object.keys(PAYLOAD_DEFS).forEach(k=>{ try{ renderPayloadEditor(k); }catch(e){} });
  });
  await openAll();

  /* v38.2 — THE CHUNK BOXES ARE GONE, SO THIS ASKS THE NEW QUESTION. It used to check that every
     fragment had a textarea somewhere in the payload editor; every one of those textareas has been
     replaced by a named call in the payload template, whose wording opens beside its name in the
     piece list. The guarantee is the same and still the point: no fragment may be unreachable. */
  console.log("\n[nothing in the payload is unreachable]");
  ok("every declared fragment is a named piece you can call", await pg.evaluate(()=>{
      const known=ptKnownNames();
      const missing=[];
      Object.keys(REPLY_BLOCKS).forEach(id=>{
        (REPLY_BLOCKS[id].tpls||[]).forEach(t=>{
          // either the fragment is callable itself, or its whole block is
          if(!known[t]&&!known[id]) missing.push(id+"/"+t);
        });
      });
      return missing.length?("uncallable: "+missing.join(", ")):true; }));
  /* EVERY shipped fragment, not a sample of them: each one must open an editable box holding its
     current wording — by its own call name where it has one, otherwise through the piece it
     belongs to. This is the guarantee the chunk boxes used to carry. */
  ok("and every one of them opens an editable box", await pg.evaluate(()=>{
      const rows=new Set(ptCatalog().map(c=>c.name));
      const owner={};
      Object.keys(REPLY_BLOCKS).forEach(id=>(REPLY_BLOCKS[id].tpls||[]).forEach(t=>{ if(!owner[t])owner[t]=id; }));
      Object.keys(REPLY_EXTRA_TPLS).forEach(id=>REPLY_EXTRA_TPLS[id].forEach(t=>{ if(!owner[t])owner[t]=id; }));
      const bad=[];
      Object.keys(BLOCK_TPL_DEFAULTS).forEach(k=>{
        const via=rows.has(k)?k:owner[k];
        if(!via){ bad.push(k+" (no route)"); return; }
        ptEditPiece(via);
        const ta=document.querySelector('textarea[data-btpl="'+k+'"]');
        if(!ta) bad.push(k+" (via "+via+")");
        else if(ta.value!==blkTpl(k)) bad.push(k+" (wrong text)");
        ptEditPiece(via);                      // second tap closes it again
        if(document.querySelector('textarea[data-btpl="'+k+'"]')) bad.push(k+" (stuck open)");
      });
      return bad.length?(bad.length+" with no editor: "+bad.slice(0,12).join(", ")):true; }));
  ok("a block with no wording of its own lists the fragments it is made of", await pg.evaluate(()=>{
      ptEditPiece("final_guardrails");
      const host=document.getElementById('ptFrag_final_guardrails');
      const n=host?host.querySelectorAll('textarea[data-btpl]').length:0;
      ptEditPiece("final_guardrails");
      return n>=10?true:("only "+n+" fragments offered"); }));
  ok("and every shipped default is reachable from some block", await pg.evaluate(()=>{
      const claimed=new Set();
      Object.keys(REPLY_BLOCKS).forEach(id=>(REPLY_BLOCKS[id].tpls||[]).forEach(t=>claimed.add(t)));
      // v38.1 — a few fragments belong to a CALLABLE rather than to an ordered block (text_timing
      // is called by name in the text template but is not one of the blocks). Declared, not lost.
      Object.keys(REPLY_EXTRA_TPLS).forEach(k=>REPLY_EXTRA_TPLS[k].forEach(t=>claimed.add(t)));
      const orphan=Object.keys(BLOCK_TPL_DEFAULTS).filter(k=>!claimed.has(k));
      return orphan.length?("orphaned defaults: "+orphan.join(", ")):true; }));

  /* v38.2 — a fragment without a call name of its own is reached through the piece it belongs to,
     which opens ALL of that piece's sentences. That is how these six were found missing in the
     first place, so it is still what is checked. */
  console.log("\n[the six that were hidden]");
  for(const [piece,frag] of [["task","task"],["task","gm_private_lock"],["format","format_header"],
                             ["format","narr_shape"],["format","heat_format"],["format","text_format"]])
    ok(frag+" opens an editable box (via "+piece+")", await pg.evaluate(a=>{
        ptEditPiece(a.piece);
        const ta=document.querySelector('textarea[data-btpl="'+a.frag+'"]');
        const ok=!!ta && ta.value===blkTpl(a.frag);
        ptEditPiece(a.piece); return ok; },{piece,frag}));

  console.log("\n[the TASK line specifically]");
  await pg.evaluate(()=>ptEditPiece("task"));
  ok("its box holds the wording seen in the payload", await pg.evaluate(()=>{
      const ta=document.querySelector('textarea[data-btpl="task"]');
      return !!ta && ta.value.indexOf("# TASK")>-1 && ta.value.indexOf("{{char}}")>-1; }));
  ok("editing it changes the built payload", await pg.evaluate(()=>{
      const uni=state.universes[0];
      if(!state.personas.some(p=>p.id==="p_frag"))
        state.personas.push({id:"p_frag",name:"Hakan Akbaba",universeId:uni.id,instructions:"x",
          personality:"x",backstory:"x",style:"x",goals:"x",look:{}});
      const p=state.personas.find(x=>x.id==="p_frag"); const chat=curChat();
      chat.presentIds=["p_frag"]; state.user="Kemal";
      const ta=document.querySelector('textarea[data-btpl="task"]');
      ta.value="MY OWN TASK LINE for {{char}}."; plqTplInput(ta);
      const built=String(buildCharPromptBlocks(p,[],{recent:[],diary:[],longterm:[]},state.user,
        {chat,targetName:state.user,targetId:"__user__"}).task||"");
      plqTplReset("task");
      return built.indexOf("MY OWN TASK LINE for Hakan Akbaba.")>-1
          && built.indexOf("# TASK")===-1; }));
  ok("and Reset puts the shipped wording back", await pg.evaluate(()=>{
      const p=state.personas.find(x=>x.id==="p_frag"); const chat=curChat();
      const built=String(buildCharPromptBlocks(p,[],{recent:[],diary:[],longterm:[]},state.user,
        {chat,targetName:state.user,targetId:"__user__"}).task||"");
      return built.indexOf("You are Hakan Akbaba.")>-1; }));

  console.log("\n[what the block rows say now the boxes are gone]");
  ok("no block row carries a fragment textarea any more", await pg.evaluate(()=>{
      Object.keys(PAYLOAD_DEFS).forEach(k=>{ try{ renderPayloadEditor(k); }catch(e){} });
      const n=document.querySelectorAll('#plqBody_solo textarea[data-btpl]').length;
      return n===0?true:(n+" chunk boxes still rendered"); }));
  ok("a block with fixed sentences says where they went", await pg.evaluate(()=>{
      renderPayloadEditor('solo');
      const h=document.getElementById('plqBody_solo').innerHTML;
      return /named pieces in the payload template/.test(h); }));
  ok("and carries a button that opens them", await pg.evaluate(()=>{
      renderPayloadEditor('solo');
      const row=document.querySelector('#plqBody_solo .plqRow[data-b="drives"]');
      if(!row||!/ptEditPiece\('drives'\)/.test(row.innerHTML)) return "no wording button";
      ptEditPiece("drives");
      const n=document.querySelectorAll('#ptFrag_drives textarea[data-btpl]').length;
      ptEditPiece("drives");
      return n===4?true:("opened "+n+" of 4"); }));
  ok("the customized count still shows", await pg.evaluate(()=>{
      state.blockTpls=state.blockTpls||{}; state.blockTpls.task="mine";
      renderPayloadEditor('solo');
      const html=document.getElementById('plqBody_solo').innerHTML;
      delete state.blockTpls.task; store.set(K.blockTpls,state.blockTpls);
      renderPayloadEditor('solo');
      return html.indexOf("customized by you")>-1; }));
  ok("the user's OWN prompt box is untouched", await pg.evaluate(()=>
      !!document.querySelector('textarea[data-pkey="baseInstruction"]')));

  console.log("\n[nothing else moved]");
  ok("saveSettings does not throw", await pg.evaluate(()=>{
      show('settings'); try{ saveSettings(false); return true; }catch(e){ return "threw: "+e.message; } }));
  ok("no page errors", errs.length===0?true:errs.join(" | "));
  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close(); process.exit(fail?1:0);
})();
