/* THE PROMPT TUNER RAN, AND THE UNIVERSE KEPT THE DEFAULTS.
   Reported with a debug log: ten "Prompt tuner" calls, every one ok, every result a sensible
   world-flavoured edit — and none of them showed up in the universe. The request goes through
   epSend, and the engine template expander filled every known {{value}} inside the base prompt
   ({{user}}, {{world}}, {{day}}, {{period}}, {{location}}) before the model saw it. The model kept
   what it was shown, so its answer no longer carried those tokens and _tunedPromptIsSafe rejected
   it. Only prompts without such tokens (intentTick) ever got through.
   Run: node tests/tuner-placeholders.browser.js */
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage({viewport:{width:412,height:915}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  const app='file://'+require('path').resolve(__dirname,'..','index.html');
  await pg.goto(app); await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(600);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x||c).slice(0,600));} };

  const r=await pg.evaluate(async()=>{
    state.key="test"; state.payloadTplOn=true; state.user="Kaan";
    const u=state.universes[0]; state.curUniverse=u.id;
    u.setting="A company housing estate on the coast."; u.prompts={};
    const sent={};
    // A model that does exactly what the tuner asks: returns the base it was shown, lightly flavoured.
    window.chatCompletion=async(msgs,model,opts)=>{
      const key=String(opts.dbg).split("· ")[1];
      const m=msgs[0].content.match(/"""\n([\s\S]*)\n"""\n\n## Rules/);
      sent[key]=m?m[1]:"";
      return sent[key]+"\nWord travels over tea on the balconies.";
    };
    editUniverse(u.id);
    await runTuneUniverse();
    saveUniverse();
    const lost={};
    UNI_TUNE_TARGETS.forEach(t=>{
      const base=PROMPT_BY_KEY[t.key].def();
      lost[t.key]=_extractPlaceholders(base).filter(p=>sent[t.key].indexOf(p.replace("{{","{{:"))<0);
    });
    return {id:u.id, targets:UNI_TUNE_TARGETS.map(t=>t.key), stored:Object.keys(u.prompts||{}),
            lost, userLeak:Object.keys(sent).filter(k=>/\bKaan\b/.test(sent[k])),
            flavoured:UNI_TUNE_TARGETS.every(t=>/tea on the balconies/.test(up(t.key,u.id))),
            restored:UNI_TUNE_TARGETS.every(t=>{
              const a=_extractPlaceholders(PROMPT_BY_KEY[t.key].def()).join(),
                    b2=_extractPlaceholders(up(t.key,u.id)).join();
              return a===b2 && up(t.key,u.id).indexOf("{{:")<0; })};
  });
  ok("every base placeholder reaches the model as a token, not a filled value",
     Object.values(r.lost).every(a=>a.length===0), JSON.stringify(r.lost));
  ok("the player's name is not baked into what the tuner sees", r.userLeak.length===0, r.userLeak.join(","));
  ok("all ten tuned prompts are stored on the universe",
     r.targets.every(k=>r.stored.indexOf(k)>=0), "stored: "+r.stored.join(","));
  ok("and up() now serves the tuned text", r.flavoured===true);
  ok("with the original {{placeholders}} restored exactly", r.restored===true);

  await pg.waitForTimeout(800);
  await pg.reload(); await pg.waitForTimeout(2400);
  const r2=await pg.evaluate(id=>{
    const u=universeById(id);
    return UNI_TUNE_TARGETS.filter(t=>!(u.prompts&&/tea on the balconies/.test(u.prompts[t.key]||""))).map(t=>t.key);
  },r.id);
  ok("the tuned prompts survive a reload", r2.length===0, "lost: "+r2.join(","));

  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log("\n  "+pass+" passed, "+fail+" failed");
  await b.close();
  process.exit(fail?1:0);
})();
