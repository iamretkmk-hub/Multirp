/* v39.2 — {{gap}} IS NOT A BLANK LINE, AND THAT COSTS YOU YOUR OWN PROSE.
   ptExpand drops a whole paragraph when it holds calls and every one resolves empty. {{gap}} is a
   blank line that deliberately does NOT end the paragraph, so a block's heading vanishes with its
   content — which is why it exists. The cost: hand-written prose written next to {{gap}} joins that
   paragraph and dies with the call beside it. A real user template lost its "# TASK", the
   character's name line and its whole behaviour doctrine on every turn {{call//world}} was empty.
   These lock the documented semantics and the editor note that warns about it.
   Run: node tests/gap-vs-blank.browser.js */
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage({viewport:{width:412,height:915}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file://'+require('path').resolve(__dirname,'..','index.html'));
  await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(700);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x||c).slice(0,500));} };

  const r=await pg.evaluate(()=>{
    const MINE="MY OWN WORDING that must not disappear";
    const withGap=["# TASK","Play her as a real person.","{{gap}}","{{call//world}}","{{gap}}",MINE].join("\n");
    const withBlank=withGap.split("\n").map(l=>l==="{{gap}}"?"":l).join("\n");
    const run=(t,w)=>ptExpand(t,{world:()=>w},{},null);
    return {
      gapEmpty:   run(withGap,""),
      gapFull:    run(withGap,"# WORLD\nA seaside town."),
      blankEmpty: run(withBlank,""),
      blankFull:  run(withBlank,"# WORLD\nA seaside town."),
      // a heading that SHOULD vanish with its block still does
      headGone:   run(["# OTHERS PRESENT","{{gap}}","{{call//world}}"].join("\n"),""),
      headStays:  run(["# OTHERS PRESENT","{{gap}}","{{call//world}}"].join("\n"),"Ayla is here.")
    };
  });
  const MINE="MY OWN WORDING that must not disappear";
  ok("{{gap}} + an empty call takes the prose with it", r.gapEmpty.indexOf(MINE)<0 && r.gapEmpty.indexOf("# TASK")<0, JSON.stringify(r.gapEmpty));
  ok("{{gap}} + a filled call keeps everything", r.gapFull.indexOf(MINE)>=0 && r.gapFull.indexOf("# TASK")>=0, JSON.stringify(r.gapFull));
  ok("a blank line keeps the prose when the call is empty", r.blankEmpty.indexOf(MINE)>=0 && r.blankEmpty.indexOf("# TASK")>=0, JSON.stringify(r.blankEmpty));
  ok("a blank line drops only the empty call's own line", r.blankEmpty.indexOf("{{call")<0, JSON.stringify(r.blankEmpty));
  ok("a blank line keeps everything when the call is filled", r.blankFull.indexOf(MINE)>=0 && r.blankFull.indexOf("seaside")>=0, JSON.stringify(r.blankFull));
  ok("a block heading still vanishes with its empty block", r.headGone.trim()==="", JSON.stringify(r.headGone));
  ok("a block heading stays when its block fills", r.headStays.indexOf("# OTHERS PRESENT")>=0, JSON.stringify(r.headStays));

  // the editor warns about it, above every template box
  const ui=await pg.evaluate(()=>{
    show('settings');
    renderPayloadTemplates();
    const h=(document.getElementById('payloadTplList')||{innerHTML:""}).innerHTML;
    const n=(h.match(/Separate your own wording from a call with a BLANK LINE/g)||[]).length;
    return {n, kinds:(typeof PT_KINDS!=="undefined"?PT_KINDS.length:0)};
  });
  ok("the editor states the rule once per template", ui.n===ui.kinds && ui.n>0, ui.n+" notes for "+ui.kinds+" templates");

  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log(`\n  ${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail?1:0);
})();
