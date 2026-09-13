/* v41.0 — ONE BOX PER BLOCK: the section and condition engine.
   159 fragment boxes were unreadable on a phone (FINAL GUARDRAILS alone was 25). A block becomes
   ONE box; what the fragments carried moves inside it as [[named]] sections and {{if}} conditions.
   A section is a REGION of the same text, so a call to one can never resolve empty the way a
   missing fragment could. Run: node tests/box-sections.browser.js */
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage({viewport:{width:412,height:915}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file://'+require('path').resolve(__dirname,'..','index.html'));
  await pg.waitForTimeout(2400);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x||c).slice(0,500));} };

  const r=await pg.evaluate(()=>{
    const BOX=[
      "# FINAL GUARDRAILS","Universal line.","",
      "[[noecho]]","Do not echo them.","[[end]]","",
      "{{if render_mode = heat}}","[[heatlen]]","Heat only.","[[/heatlen]]",
      "{{else}}","Not heat.","{{endif}}","",
      "{{if language = turkish}}Türkçe.{{endif}}",
      "{{if entering and not leaving}}You walked in.{{endif}}",
      "{{if leaving or alone}}Never.{{endif}}"
    ].join("\n");
    const H=ptCondFlags({render_mode:"heat",language:"Turkish",entering:true,leaving:false,alone:""});
    const S=ptCondFlags({render_mode:"solo",language:"English",entering:false,leaving:false});
    return {
      heat:ptRenderBox(BOX,H), solo:ptRenderBox(BOX,S),
      sec:ptRenderSection(BOX,"noecho",H),
      secHeat:ptRenderSection(BOX,"heatlen",H),
      secSolo:ptRenderSection(BOX,"heatlen",S),
      missing:ptRenderSection(BOX,"nosuch",H),
      names:ptSectionNames(BOX),
      nested:ptRenderBox("{{if render_mode = heat}}A{{if entering}}B{{endif}}C{{endif}}",H),
      unbalanced:ptRenderBox("keep me {{if render_mode = heat}}and me",H),
      unknownFlag:ptRenderBox("{{if no_such}}nope{{else}}fallback{{endif}}",H),
      caseFlag:ptRenderBox("{{if RENDER_MODE = HEAT}}yes{{endif}}",H),
      notEq:ptRenderBox("{{if render_mode != solo}}yes{{endif}}",H),
      markerFree:/\[\[|\{\{if|\{\{endif|\{\{else/.test(ptRenderBox(BOX,H))
    };
  });

  ok("the whole box renders the true branch", /Heat only\./.test(r.heat) && !/Not heat/.test(r.heat), r.heat);
  ok("and the other mode gets the other branch", /Not heat\./.test(r.solo) && !/Heat only/.test(r.solo), r.solo);
  ok("a universal line is in both", /Universal line/.test(r.heat) && /Universal line/.test(r.solo));
  ok("language conditions fire", /Türkçe/.test(r.heat) && !/Türkçe/.test(r.solo));
  ok("and+not works", /You walked in/.test(r.heat) && !/You walked in/.test(r.solo));
  ok("or is false when both sides are", !/Never/.test(r.heat));
  ok("a named section returns just itself", r.sec==="Do not echo them.", JSON.stringify(r.sec));
  ok("a section inside a true condition is available", r.secHeat==="Heat only.", JSON.stringify(r.secHeat));
  ok("a section inside a FALSE condition is not", r.secSolo===null, JSON.stringify(r.secSolo));
  ok("an unknown section name is null, not empty text", r.missing===null, JSON.stringify(r.missing));
  ok("section names are discoverable", r.names.join(",")==="noecho,heatlen", JSON.stringify(r.names));
  ok("conditions nest", r.nested==="ABC", r.nested);
  ok("an unbalanced if keeps the text rather than blanking it", r.unbalanced==="keep me and me", r.unbalanced);
  ok("an unknown flag is false, not an error", r.unknownFlag==="fallback", r.unknownFlag);
  ok("flag names and values are case-insensitive", r.caseFlag==="yes", r.caseFlag);
  ok("!= works", r.notEq==="yes", r.notEq);
  ok("no marker ever survives into the rendered text", r.markerFree===false);

  /* (!) Double brackets, because SINGLE brackets are the TTS channel — [moan], [reset],
     [say quietly]. heat_format holds both kinds at once. */
  const tts=await pg.evaluate(()=>({
    single:ptRenderBox("say [moan] and [gasp] here",ptCondFlags({})),
    double:ptRenderBox("[[a]]kept[[end]]",ptCondFlags({}))
  }));
  ok("single-bracket sound tags pass through untouched", tts.single==="say [moan] and [gasp] here", tts.single);
  ok("double-bracket markers are stripped", tts.double==="kept", tts.double);

  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log(`\n  ${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail?1:0);
})();
