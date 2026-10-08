/* v150.71 — THE DECISION MODEL'S ANSWERS AS TEXT. {{emotion}}, {{intensity}}, {{tone}} and {{ego}} print the emotion pick of
   the one writing this turn inside any fragment ("You feel {{tone}}."); without a pick they are empty, and a sentence
   wrapped in {{if tone}}…{{endif}} drops. In Debug → Readable they are red, like the options a decision chose.
   Run: node tests/decision-values.browser.js */
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:process.env.SM_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage({viewport:{width:412,height:915}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file://'+require('path').resolve(__dirname,'..','index.html')); await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(600);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x===undefined?c:x).slice(0,600));} };

  await pg.evaluate(()=>{
    const uni=state.universes[0];
    state.personas=(state.personas||[]).filter(p=>p.id!=="p_dv").concat([{id:"p_dv",name:"Ayla",universeId:uni.id,look:{}}]);
    window.__frag=[{id:"dv",name:"Values",seg:"head",paths:["solo","multi","gm","text","heat"],mode:"any",byPath:{},
      text:"You feel {{tone}} ({{emotion}}, {{intensity}}, {{ego}}).\n\n{{if tone}}TONE-LINE {{tone}}.{{endif}}",options:[]}];
    window.__build=(emo)=>{ const c=curChat(); c.emo=emo?{p_dv:emo}:{}; state.fragments=__frag; _fragMigratedFor=__frag;
      const fl={render_mode:"solo"}; if(emo){ fl.emotion=emo.emotion; fl.intensity=emo.intensity; fl.tone=emo.tone; fl.ego=emo.ego; }
      const m=ptBuildMessages("solo",{_railFlags:fl},[],{chat:c,npc:state.personas.find(p=>p.id==="p_dv")})||[];
      state.fragments=null; _fragMigratedFor=null;
      return m.map(x=>x.content).join("\n\n"); };
  });
  const withPick=await pg.evaluate(()=>__build({emotion:"Anger",intensity:"intense",tone:"furious",ego:"torn",sig:"x"}));
  ok("the values print the pick: tone, emotion, intensity, ego", /You feel furious \(Anger, intense, torn\)\./.test(withPick)&&/TONE-LINE furious\./.test(withPick), withPick);
  const noPick=await pg.evaluate(()=>__build(null));
  ok("without a pick they are empty and an {{if tone}} sentence drops", /You feel  \(, , \)\./.test(noPick)&&!/TONE-LINE/.test(noPick), noPick);
  ok("they are listed as reply values", await pg.evaluate(()=>{ const n=PT_VALUES.map(v=>v.name); return ["emotion","intensity","tone","ego"].every(x=>n.indexOf(x)>=0)?true:JSON.stringify(n); }));
  ok("in the coloured copy for Debug they are red, and the sent text has no markers", await pg.evaluate(()=>{
      const c=curChat(); c.emo={p_dv:{emotion:"Joy",intensity:"mild",tone:"content",ego:"no_conflict",sig:"y"}}; state.fragments=__frag; _fragMigratedFor=__frag;
      const fl={render_mode:"solo",emotion:"Joy",intensity:"mild",tone:"content",ego:"no_conflict"};
      const m=ptBuildMessages("solo",{_railFlags:fl},[],{chat:c,npc:state.personas.find(p=>p.id==="p_dv")})||[];
      state.fragments=null; _fragMigratedFor=null;
      const sent=m.map(x=>x.content).join("\n"), ann=m.map(x=>pvAnnotFor(x.content)||"").join("\n");
      return (!PV_HAS.test(sent)&&ann.indexOf(PV_R0+"content"+PV_R1)>=0)?true:JSON.stringify({sent:sent.slice(0,120),ann:ann.slice(0,160)}); }));

  ok("no page errors", errs.length===0?true:errs.join(" | "));
  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close(); process.exit(fail?1:0);
})();
