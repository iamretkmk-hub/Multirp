/* v150.104 — AN EMOTION BOX SAYS WHAT THEY FEEL. Each emotion box opened "### When you mainly feel Guilt": a condition to
   check, never telling the character they ARE feeling it. It reads "### You are feeling guilty — this is how you respond
   when you are guilty:". The writer is asked for that heading; a stored box with the old heading is rewritten on load and
   by the writer's merge; the payload rewrites any old heading it is handed.
   Run: node tests/emotion-heading.browser.js */
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
  const OLDBOX="### When you mainly feel Guilt\n- You over-offer help via text: \"Ben alayım.\"";

  const R=await pg.evaluate(OLDBOX=>{
    const r={};
    r.fix=emoHeadingFix(OLDBOX,"Guilt");
    r.anger=emoHeadingFix("### When you mainly feel Anger\n- x","Anger").split("\n")[0];
    r.custom=emoHeadingFix("### When you mainly feel Nostalgia\n- x","Nostalgia").split("\n")[0];
    r.untouched=emoHeadingFix("### Baseline: the memo\n- x","Guilt");
    r.gen=X_ENGINE_PROMPTS.x_style_writer.def;
    // the writer's merge
    const merged=speechMerge(speechBlank(),{text:{main:"## TEXTING",emo:{Guilt:OLDBOX}}});
    r.merged=merged.text.emo.Guilt.split("\n")[0];
    return r; },OLDBOX);
  ok("the old heading becomes 'You are feeling guilty — this is how you respond when you are guilty:'", R.fix.split("\n")[0]==="### You are feeling guilty — this is how you respond when you are guilty:"&&/over-offer help/.test(R.fix), R.fix);
  ok("in the word they would use for it (anger → angry)", R.anger==="### You are feeling angry — this is how you respond when you are angry:", R.anger);
  ok("an emotion of your own is said plainly", R.custom==="### You are feeling nostalgia — this is how you respond when you feel nostalgia:", R.custom);
  ok("other headings are left alone", R.untouched==="### Baseline: the memo\n- x", R.untouched);
  ok("the writer is asked for the new heading, with its example rewritten", /"### You are feeling <how they feel> — this is how you respond when you are <how they feel>:"/.test(R.gen)&&/### You are feeling angry — this is how you respond when you are angry:/.test(R.gen)&&!/### When you mainly feel/.test(R.gen), R.gen.slice(0,600));
  ok("what the writer returns is merged in with the new heading", R.merged==="### You are feeling guilty — this is how you respond when you are guilty:", R.merged);

  console.log("\n[a stored character]");
  ok("a stored box with the old heading is rewritten on load, and kept", await pg.evaluate(OLDBOX=>{
      const uni=state.universes[0];
      state.personas=state.personas.filter(p=>p.id!=="eh_d");
      state.personas.push({id:"eh_d",name:"Duygu",universeId:uni.id,personality:"x",look:{},_speechMigrated:SPEECH_MIG,
        speech:{spoken:{main:"",emo:{}},text:{main:"## TEXTING: HOW YOU WRITE MESSAGES",emo:{Guilt:OLDBOX}},heat:{main:"",emo:{}}}});
      persistPersonas(); speechMigrateAll();
      const p=state.personas.find(x=>x.id==="eh_d");
      return /^### You are feeling guilty — this is how you respond when you are guilty:/.test(p.speech.text.emo.Guilt)?true:p.speech.text.emo.Guilt; },OLDBOX));

  console.log("\n[the payload]");
  ok("a text reply's payload, feeling guilt, carries the new heading and never the old", await pg.evaluate(OLDBOX=>{
      const uni=state.universes[0];
      Object.assign(state,{user:"Emre",payloadTplOn:false,fragments:null,trackOn:false,memory:[],relOn:false,intentOn:false,promiseOn:false,gossip:[],emotions:null});
      store.setRaw(K.fragAdds,FRAG_SHIPPED_ADDS.map(a=>a.key).join(",")); state.blockTpls={};
      const p=state.personas.find(x=>x.id==="eh_d"); p.speech.text.emo.Guilt=OLDBOX;   // as if a box still had it
      const c=curChat(); ["_heatBeat","activeEvent"].forEach(k=>{ delete c[k]; });
      Object.assign(c,{universeId:uni.id,presentIds:["eh_d"],emo:{eh_d:{emotion:"Guilt",intensity:"clear"}},promises:[],wearing:{},calendar:[],intents:[],rel:{},gameDay:3,period:"Evening",locationId:null,location:"",subId:null,subPos:{},
        messages:[{mid:"u1",role:"user",content:"naber",textMsg:true,textWith:"eh_d"}]});
      const inj={recent:[],diary:[],longterm:[]};
      const hopts={chat:c,targetName:"Emre",targetId:"__user__",textMode:true,payloadKind:"text"};
      const topts={chat:c,selfP:p,selfId:p.id,selfName:p.name,targetName:"Emre",targetId:"__user__",injected:inj,textMode:true,payloadKind:"text"};
      const mk=()=>Object.assign({},buildCharPromptBlocks(p,[],inj,null,hopts),buildTailBlocks(topts));
      const all=(ptBuildMessages("text",mk(),[{role:"user",content:"(history)"}],{chat:c,npc:p,targetName:"Emre"},mk)||[]).map(x=>x.content).join("\n\n");
      return (/### You are feeling guilty — this is how you respond when you are guilty:/.test(all)&&!/When you mainly feel/.test(all))?true:all.slice(0,1500); },OLDBOX));
  ok("a stored copy of the old writer prompt is upgraded once", await pg.evaluate(()=>{
      const old=X_ENGINE_PROMPTS.x_style_writer.def.replace(/An emotion entry opens with a heading[^\n]*/,'An emotion entry opens with "### When you mainly feel <emotion>", then 2-3 bullets.').replace("### You are feeling angry — this is how you respond when you are angry:","### When you mainly feel Anger");
      store.setRaw(K.x_style_writer,old); state.x_style_writer=old; localStorage.removeItem("sm_pipesdone"); loadState();
      const r=state.x_style_writer===X_ENGINE_PROMPTS.x_style_writer.def;
      store.del(K.x_style_writer); localStorage.removeItem("sm_pipesdone"); loadState(); return r?true:String(state.x_style_writer).slice(0,200); }));
  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close(); process.exit(fail?1:0);
})();
