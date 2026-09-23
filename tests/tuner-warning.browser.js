/* v113.1 — TEN WARNINGS ABOUT THE PROMPT TUNER, ALL OF THEM FALSE.
   Reported from the debug log: ten "names that did not resolve" errors, every one blamed on the
   Prompt tuner, and each listing a DIFFERENT engine's vocabulary — witness/impression/charge, then
   accuser/conviction/floor/ceiling, then a_sheet/b_sheet/a_to_b, then holder/aim/trigger… plus
   `placeholder` in every single one.
   None of them was the tuner's template. Calls are substituted first and the VALUE scan then ran
   over the result, so every {{name}} that arrived inside injected DATA was reported as a name the
   author had typed and got wrong. The tuner is the worst possible case: its input is another
   engine's entire prompt, placeholders and all, and its own instruction says to preserve every
   {{placeholder}} token — that literal is where the tenth name came from.
   Run: node tests/tuner-warning.browser.js */
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

  // ptExpand, driven directly: a template with one call, whose DATA is full of placeholders.
  const run=(tpl,srcs,vars)=>pg.evaluate(a=>{
    const report={unknownCall:[],unknownVar:[],emptyVar:[]};
    const out=ptExpand(a.tpl,a.srcs,a.vars,report);
    return {out,report};
  },{tpl,srcs,vars});

  const injected="Write the rumor {{witness}} carries about {{impression}}, weighted by {{charge}}. "
               +"EVERY {{placeholder}} token must remain exactly as-is.";
  const r1=await run("{{call//prompt}}",{prompt:injected},{world:"Site"});
  ok("a placeholder that came in with the DATA is not reported as the author's",
     r1.report.unknownVar.length===0, JSON.stringify(r1.report.unknownVar));
  ok("and it is still left standing in the text, for the tuner to preserve",
     /\{\{witness\}\}/.test(r1.out)&&/\{\{placeholder\}\}/.test(r1.out), r1.out.slice(0,160));

  const r2=await run("{{call//prompt}} for {{nope}}",{prompt:injected},{world:"Site"});
  ok("a name the author really did type is still reported",
     r2.report.unknownVar.join(",")==="nope", JSON.stringify(r2.report.unknownVar));
  ok("and only that one, not the data's names as well",
     !r2.report.unknownVar.some(n=>["witness","impression","charge","placeholder"].indexOf(n)>=0),
     JSON.stringify(r2.report.unknownVar));

  const r3=await run("{{call//prompt}} in {{world}}",{prompt:injected},{world:"Site"});
  ok("a known value in the template still fills", /in Site/.test(r3.out), r3.out.slice(-60));
  ok("with nothing reported", r3.report.unknownVar.length===0, JSON.stringify(r3.report.unknownVar));

  // a known-but-empty NAME is still the bug it always was — when the template typed it
  const r4=await run("You are {{char}}.",{},{char:""});
  ok("an empty name the template typed is still reported",
     r4.report.emptyVar.join(",")==="char", JSON.stringify(r4.report));
  const r5=await run("{{call//prompt}}",{prompt:"You are {{char}}."},{char:""});
  ok("an empty name that arrived in the data is not",
     r5.report.emptyVar.length===0, JSON.stringify(r5.report));

  // ---- the real path: the tuner, with a real engine prompt as its input
  const tuner=await pg.evaluate(()=>{
    state.payloadTplOn=true;
    const base=(typeof DEFAULT_GOSSIP==="string"&&DEFAULT_GOSSIP)
             ||(PROMPT_BY_KEY.gossipPrompt&&PROMPT_BY_KEY.gossipPrompt.def&&PROMPT_BY_KEY.gossipPrompt.def())||"";
    const sys=fillTpl(up("promptTuner"),{setting:"a steel town",directing:"",base});
    const seen=[]; const realDbg=window.dbg;
    window.dbg=(label,src,url,payload)=>{ seen.push({label,payload}); return realDbg(label,src,url,payload); };
    let msgs=null;
    try{ msgs=epMessages("promptTuner",sys,{},{world:"Site"}); }finally{ window.dbg=realDbg; }
    const warn=seen.filter(x=>/names that did not resolve/.test(x.label||""));
    return {base:base.length, warned:warn.length,
            names:warn.length?(warn[0].payload.unknown_values||[]):[],
            sent:(msgs||[]).map(m=>m.content).join("\n").length};
  });
  ok("the tuner really is handed a prompt full of placeholders", tuner.base>200, "base "+tuner.base+" chars");
  ok("and tuning one no longer reports a single false name",
     tuner.warned===0, "warned "+tuner.warned+": "+JSON.stringify(tuner.names));
  ok("while the message it sends is still built", tuner.sent>200, "sent "+tuner.sent+" chars");

  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log("\n  "+pass+" passed, "+fail+" failed");
  await b.close();
  process.exit(fail?1:0);
})();
