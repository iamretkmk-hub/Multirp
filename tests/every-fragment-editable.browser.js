/* NOTHING IN THE PAYLOAD IS UNREACHABLE. v150.66 — a reply is built from its fragments only, so the guarantee is now:
   every field of every shipped reply fragment (main body, path boxes, each option's text, code condition and question)
   opens in the fragment editor holding its wording, and editing one changes the reply; the pieces the app writes outside
   the fragments ("Other wording") each open an editable box; every shipped piece is still claimed by a block or a callable
   (the drift guard the migrations rely on); the guardrails box still holds every rule.
   (Before v150.66 this checked that every BLOCK_TPL_DEFAULTS piece opened from the reply piece list and the part list's
   block rows; both are gone with the classic layout and the reply templates — see tests/README.md.)
   Run: node tests/every-fragment-editable.browser.js */
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:process.env.SM_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage({viewport:{width:412,height:915}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file://'+require('path').resolve(__dirname,'..','index.html')); await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(900);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x||c).slice(0,600));} };

  await pg.evaluate(()=>{ state.fragments=null; _fragDraft=null; show('settings'); renderPayloadList(); });

  console.log("\n[every field of every reply fragment opens in the editor]");
  ok("each shipped fragment: its main body, its path boxes, and each option's text, code condition and question", await pg.evaluate(()=>{
      const L=_fragDraftGet(), bad=[];
      L.forEach((f,i)=>{
        fragEdOpen(i);
        const q=fp=>document.querySelector('[data-fp="'+fp+'"]');
        const t=q(i+".text"); if(!t||t.value!==String(f.text||"")) bad.push(f.id+".text");
        Object.keys(f.byPath||{}).forEach(p=>{ const x=q(i+".byPath."+p); if(!x||x.value!==String(f.byPath[p]||"")) bad.push(f.id+".bp."+p); });
        (f.options||[]).forEach((o,j)=>{
          ["text","code","ask"].forEach(k=>{ const x=q(i+".o."+j+"."+k); if(!x||x.value!==String(o[k]||"")) bad.push(f.id+".o."+o.id+"."+k); });
          Object.keys(o.byPath||{}).forEach(p=>{ const x=q(i+".o."+j+".byPath."+p); if(!x||x.value!==String(o.byPath[p]||"")) bad.push(f.id+".o."+o.id+".bp."+p); });
        });
        fragEdOpen(i);   // a second tap closes it
        if(q(i+".text")) bad.push(f.id+" (stuck open)");
      });
      return bad.length?(bad.length+" fields with no editor: "+bad.slice(0,12).join(", ")):true; }));

  console.log("\n[the TASK fragment specifically]");
  ok("its box holds the wording seen in the payload", await pg.evaluate(()=>{
      const i=_fragDraftGet().findIndex(f=>f.id==="task"); fragEdOpen(i);
      const ta=document.querySelector('[data-fp="'+i+'.text"]'); const v=ta?ta.value:"";
      fragEdOpen(i);
      return (v.indexOf("# TASK")>-1&&v.indexOf("{{char}}")>-1)?true:v.slice(0,200); }));
  const built=()=>pg.evaluate(()=>{
      const uni=state.universes[0];
      if(!state.personas.some(p=>p.id==="p_frag"))
        state.personas.push({id:"p_frag",name:"Hakan Akbaba",universeId:uni.id,instructions:"x",personality:"x",backstory:"x",style:"x",goals:"x",look:{}});
      const p=state.personas.find(x=>x.id==="p_frag"); const chat=curChat();
      chat.presentIds=["p_frag"]; state.user="Kemal";
      const inj={recent:[],diary:[],longterm:[]};
      const B=Object.assign({},buildCharPromptBlocks(p,[],inj,state.user,{chat,targetName:state.user,targetId:"__user__"}),
        buildTailBlocks({chat,selfP:p,selfId:p.id,selfName:p.name,targetName:state.user,targetId:"__user__",multi:false,injected:inj}));
      return ptBuildMessages("solo",B,[],{chat,npc:p,targetName:state.user},()=>B).map(m=>m.content).join("\n"); });
  ok("editing it (and saving) changes the built reply", await pg.evaluate(()=>{
      const i=_fragDraftGet().findIndex(f=>f.id==="task"); fragEdOpen(i);
      const ta=document.querySelector('[data-fp="'+i+'.text"]');
      ta.value="MY OWN TASK LINE for {{char}}."; ta.dispatchEvent(new Event('input')); fragEdSave(); fragEdOpen(i);
      return true; })&&await (async()=>{ const t=await built(); return (t.indexOf("MY OWN TASK LINE for Hakan Akbaba.")>-1&&t.indexOf("# TASK")===-1)?true:t.slice(0,300); })());
  ok("and putting the shipped fragments back restores the wording", await pg.evaluate(()=>{
      _fragDraft=JSON.parse(JSON.stringify(FRAG_DEFAULTS)); fragEdSave(); return state.fragments===null&&!store.raw(K.fragments,""); })
     &&await (async()=>{ const t=await built(); return (/You are Hakan Akbaba\./.test(t)&&/# TASK/.test(t))?true:t.slice(0,300); })());

  console.log("\n[the wording outside the fragments]");
  ok("every piece of the Other wording opens an editable box holding its current text", await pg.evaluate(()=>{
      const keys=_otherWordingKeys(), bad=[];
      if(!keys.length) return "no other wording listed";
      keys.forEach(k=>{ const ta=document.querySelector('#otherWordingList textarea[data-btpl="'+k+'"]');
        if(!ta) bad.push(k+" (no box)"); else if(ta.value!==blkTpl(k)) bad.push(k+" (wrong text)"); });
      return bad.length?bad.join(", "):true; }));
  ok("editing one saves it, and Reset puts the shipped wording back", await pg.evaluate(()=>{
      const ta=document.querySelector('#otherWordingList textarea[data-btpl="whisper_to_you"]'); if(!ta) return "no whisper box";
      ta.value="MINE {{speaker}}"; plqTplInput(ta);
      const saved=blkTpl("whisper_to_you")==="MINE {{speaker}}"&&(store.get(K.blockTpls,{})||{}).whisper_to_you==="MINE {{speaker}}";
      plqTplReset("whisper_to_you");
      return (saved&&blkTpl("whisper_to_you")===BLOCK_TPL_DEFAULTS.whisper_to_you)?true:JSON.stringify({saved,now:blkTpl("whisper_to_you")}); }));
  ok("every shipped piece is still claimed by a block or a callable (the drift guard the migrations rely on)", await pg.evaluate(()=>{
      const claimed=new Set();
      Object.keys(REPLY_BLOCKS).forEach(id=>(REPLY_BLOCKS[id].tpls||[]).forEach(t=>claimed.add(t)));
      Object.keys(REPLY_EXTRA_TPLS).forEach(k=>REPLY_EXTRA_TPLS[k].forEach(t=>claimed.add(t)));
      const orphan=Object.keys(BLOCK_TPL_DEFAULTS).filter(k=>!claimed.has(k));
      return orphan.length?("orphaned defaults: "+orphan.join(", ")):true; }));
  /* v41.1 — FINAL GUARDRAILS is one box with the rules inside it as [[sections]] keeping their old names. What has to stay
     true is that nothing was lost on the way in: every rule is still in there, under the name that calls it. */
  ok("the guardrails box still holds every rule, under its name", await pg.evaluate(()=>{
      const secs=ptBoxSections("final_guardrails");
      const missing=RAIL_KEYS.filter(k=>secs.indexOf(k)<0);
      return missing.length?("rules lost on the way in: "+missing.join(", ")):true; }));

  console.log("\n[nothing else moved]");
  ok("saveSettings does not throw", await pg.evaluate(()=>{
      show('settings'); try{ saveSettings(false); return true; }catch(e){ return "threw: "+e.message; } }));
  ok("no page errors", errs.length===0?true:errs.join(" | "));
  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close(); process.exit(fail?1:0);
})();
