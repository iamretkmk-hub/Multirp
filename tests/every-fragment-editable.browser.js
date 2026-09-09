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
    show('settings'); renderPayloadList();
    Object.keys(PAYLOAD_DEFS).forEach(k=>{ try{ renderPayloadEditor(k); }catch(e){} });
  });
  await openAll();

  console.log("\n[nothing in the payload is unreachable]");
  ok("every declared fragment has a box in the editor", await pg.evaluate(()=>{
      const rendered=new Set([...document.querySelectorAll('textarea[data-btpl]')].map(t=>t.dataset.btpl));
      const missing=[];
      Object.keys(REPLY_BLOCKS).forEach(id=>{
        (REPLY_BLOCKS[id].tpls||[]).forEach(t=>{ if(!rendered.has(t)) missing.push(id+"/"+t); });
      });
      return missing.length?("unreachable: "+missing.join(", ")):true; }));
  ok("and every shipped default is reachable from some block", await pg.evaluate(()=>{
      const claimed=new Set();
      Object.keys(REPLY_BLOCKS).forEach(id=>(REPLY_BLOCKS[id].tpls||[]).forEach(t=>claimed.add(t)));
      const orphan=Object.keys(BLOCK_TPL_DEFAULTS).filter(k=>!claimed.has(k));
      return orphan.length?("orphaned defaults: "+orphan.join(", ")):true; }));

  console.log("\n[the six that were hidden]");
  for(const frag of ["task","gm_private_lock","format_header","narr_shape","heat_format","text_format"])
    ok(frag+" has an editable box", await pg.evaluate(f=>
        !!document.querySelector('textarea[data-btpl="'+f+'"]'),frag));

  console.log("\n[the TASK line specifically]");
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

  console.log("\n[the fragment list still works where it already did]");
  ok("a dynamic block still lists its fragments", await pg.evaluate(()=>
      !!document.querySelector('textarea[data-btpl="voice_delivery"]')
   && !!document.querySelector('textarea[data-btpl="rails_header"]')));
  ok("the customized marker still shows", await pg.evaluate(()=>{
      state.blockTpls=state.blockTpls||{}; state.blockTpls.task="mine";
      renderPayloadEditor('solo');
      const html=document.getElementById('plqBody_solo').innerHTML;
      delete state.blockTpls.task; store.set(K.blockTpls,state.blockTpls);
      renderPayloadEditor('solo');
      return html.indexOf("customized")>-1; }));
  ok("the prompt box is still there alongside the fragments", await pg.evaluate(()=>
      !!document.querySelector('textarea[data-pkey="baseInstruction"]')
   && !!document.querySelector('textarea[data-btpl="task"]')));

  console.log("\n[nothing else moved]");
  ok("saveSettings does not throw", await pg.evaluate(()=>{
      show('settings'); try{ saveSettings(false); return true; }catch(e){ return "threw: "+e.message; } }));
  ok("no page errors", errs.length===0?true:errs.join(" | "));
  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close(); process.exit(fail?1:0);
})();
