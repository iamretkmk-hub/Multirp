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

  /* ---- v41.1 — THE SECTION AS A CALL. A box is only an improvement if the pieces inside it are
     still reachable the way the fragments were: callable, listed, validated, and never reported as
     a typo just because this turn's conditions left one out. */
  console.log("\n[calling one section of a converted block]");
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(900);
  await pg.evaluate(()=>{
    const uni=state.universes[0];
    if(!state.personas.some(x=>x.id==="p_box"))
      state.personas.push({id:"p_box",name:"Ayse",universeId:uni.id,instructions:"Guarded.",
        personality:"Wry.",backstory:"Left at 19.",style:"Short.",goals:"Find it.",look:{}});
    const chat=curChat(); chat.presentIds=["p_box"]; state.user="Kemal";
    show('settings'); try{ renderPayloadList(); renderPayloadTemplates(); }catch(e){}
  });
  await pg.waitForTimeout(400);
  const call=await pg.evaluate(()=>{
    const secs=ptBoxSections("final_guardrails");
    const known=ptKnownNames();
    // a real turn's sources, so this is what a template would actually resolve against
    const p=(state.personas||[]).find(x=>x.id==="p_box")||null;
    let srcs=null;
    if(p){
      const chat=curChat();
      const inj={recent:[],diary:[],longterm:[]};
      const B=Object.assign({},
        buildCharPromptBlocks(p,[],inj,state.user,{chat,targetName:state.user,targetId:"__user__"}),
        buildTailBlocks({chat,selfP:p,selfId:p.id,selfName:p.name,targetName:state.user,
          targetId:"__user__",multi:false,injected:inj,textMode:false}));
      srcs=ptSources(B,null);
    }
    const rep={unknownCall:[],unknownVar:[],emptyVar:[]};
    const one=srcs?ptResolve(srcs,"final_guardrails","rail_voice",rep):null;
    const heatOnly=srcs?ptResolve(srcs,"final_guardrails","rail_heat_len",rep):null;
    return {
      secs, nSecs:secs.length,
      unknown:secs.filter(n=>!known["final_guardrails//"+n]),
      seeded:srcs?secs.filter(n=>!Object.prototype.hasOwnProperty.call(srcs,"final_guardrails//"+n)):["no persona"],
      one:String(one||""), heatOnly:String(heatOnly||""), reported:rep.unknownCall,
      flatStillWorks:srcs?String(ptResolve(srcs,"rail_voice",null,rep)||""):""
    };
  });
  ok("the box has its sections", call.nSecs>=15, call.nSecs+" sections");
  ok("and the validator knows all of them", call.unknown.length===0, call.unknown.join(", "));
  ok("every section is seeded in a real turn's sources",
     Array.isArray(call.seeded)&&call.seeded.length===0, String(call.seeded));
  ok("{{call//block//section}} returns that section's wording",
     call.one.length>20 && !/\[\[/.test(call.one) && !/\{\{if/.test(call.one), call.one.slice(0,80));
  ok("the flat name still resolves to the same text", call.flatStillWorks===call.one,
     call.flatStillWorks.slice(0,60));
  /* (!) THE WHOLE POINT OF SEEDING. A rail whose condition was false on a solo turn must read as
     known-and-empty. Reported as unknown, every ordinary turn would log a dozen phantom typos. */
  ok("a section this turn's conditions left out is empty, not a typo",
     call.heatOnly==="" && call.reported.length===0, call.reported.join(", "));

  /* (!) v41.3 — A FOLDED RULE IS NOT A ROW IN THE PIECE LIST. It has no wording of its own, no box
     of its own and nothing to reset, so a row offering copy / used by / edit for it is dead — and
     listing every section again as final_guardrails//rail_… would rebuild the clutter the box was
     made to remove. One row for the block. But the names must stay KNOWN, under both forms, or the
     validator flags the app's own shipped template in red. */
  console.log("\n[the piece list]");
  const cat=await pg.evaluate(()=>{
    const names=ptCatalog().map(c=>c.name);
    const secs=ptBoxSections("final_guardrails");
    const known=ptKnownNames();
    return {rails:names.filter(n=>/^rail_/.test(n)),
            sectionRows:names.filter(n=>n.indexOf("final_guardrails//")===0),
            block:names.indexOf("final_guardrails")>=0,
            flatUnknown:secs.filter(n=>!known[n]),
            blockUnknown:secs.filter(n=>!known["final_guardrails//"+n]),
            tplUnknown:ptScan(ptDefaultTemplate("solo"),ptKnownNames()).unknownCall};
  });
  ok("no folded rule is listed as a piece of its own", cat.rails.length===0, cat.rails.join(", "));
  ok("and no section is listed under its block either", cat.sectionRows.length===0, cat.sectionRows.join(", "));
  ok("the block itself is still a row", cat.block===true);
  ok("every section stays callable by its flat name", cat.flatUnknown.length===0, cat.flatUnknown.join(", "));
  ok("and by block//section", cat.blockUnknown.length===0, cat.blockUnknown.join(", "));
  ok("so the shipped template validates clean", cat.tplUnknown.length===0, cat.tplUnknown.join(", "));

  console.log("\n[the editor]");
  const ed=await pg.evaluate(()=>{
    ptEditPiece("final_guardrails");
    const ta=document.querySelector('textarea[data-btpl="rails_header"]');
    const host=document.getElementById('ptFrag_final_guardrails');
    const idx=host?host.textContent:"";
    const style=ta?String(ta.getAttribute("style")||""):"";
    ptEditPiece("final_guardrails");
    return {open:!!ta, tall:/min-height/.test(style), idx:idx.indexOf("rail_noecho")>=0,
            form:idx.indexOf("{{call//final_guardrails//name}}")>=0};
  });
  ok("the block opens one tall box, not a slot", ed.open && ed.tall, JSON.stringify(ed));
  ok("with the section names printed above it", ed.idx===true);
  ok("and the call form spelled out", ed.form===true);

  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log(`\n  ${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail?1:0);
})();
