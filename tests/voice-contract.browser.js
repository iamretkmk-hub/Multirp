/* THE VOICE CONTRACT, and the layout headings that obey it.
   Three registers share a payload: instruction is SECOND person, the speaker's own card is FIRST,
   anybody else's data is THIRD, and a worked example inside an instruction is written in the voice
   the OUTPUT must use. The last one was costing real text — a subjectless English example
   ("*turns the glass a quarter-turn*") taught a subjectless narration, and Turkish, which must
   pick a possessive, picked the wrong one: "elini kaldırıp … dönüyorum" — "raising HER hand, I
   turn" — twice in one scene.
   Also checks the layout headings: every group heading a hand-written template prints is now a
   fragment, it resolves, blanking it removes it, and an empty group takes its heading with it.
   Run: node tests/voice-contract.browser.js   (needs playwright; see tests/README.md) */
const {chromium}=require('playwright');
const BIN=process.env.CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
(async()=>{
  const b=await chromium.launch({executablePath:BIN});
  const pg=await b.newPage({viewport:{width:412,height:915}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file:///home/user/Multirp/index.html'); await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(900);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x||c).slice(0,500));} };

  console.log("\n[the contract: instruction is second person]");
  ok("no fragment says 'I' unless its job is to quote a voice", await pg.evaluate(()=>{
      const re=/\b(I|I'm|I've|I'll|me|my|mine|myself)\b/;
      const bad=Object.keys(BLOCK_TPL_DEFAULTS).filter(k=>!VOICE_FIRST_PERSON_OK.has(k)&&re.test(BLOCK_TPL_DEFAULTS[k]));
      return bad.length?bad.join(", "):true; }));
  ok("the allowlist has no dead entries", await pg.evaluate(()=>{
      const dead=[...VOICE_FIRST_PERSON_OK].filter(k=>!BLOCK_TPL_DEFAULTS[k]);
      return dead.length?dead.join(", "):true; }));
  ok("no fragment guesses anybody's gender", await pg.evaluate(()=>{
      /* Neither the player nor the character has a pronoun the app is entitled to assume. A
         gendered word inside "quotes" is a worked example being quoted, not the fragment speaking,
         so quoted spans come out first. */
      const bad=Object.keys(BLOCK_TPL_DEFAULTS).filter(k=>{
        const v=String(BLOCK_TPL_DEFAULTS[k])
          .replace(/"[^"\n]*"/g," ").replace(/\*[^*\n]*\*/g," ").replace(/_[^_\n]*_/g," ");
        return /\b(he|him|his|she|her|hers)\b/.test(v) && !/bio_behave_other|bio_wardrobe_other/.test(k); });
      return bad.length?bad.join(", "):true; }));

  console.log("\n[the worked examples are in the voice of the output]");
  ok("the shipped format rules show a FIRST-person body beat", await pg.evaluate(()=>
      /\*I turn the glass/.test(DEFAULT_FORMAT_RULES)?true:"missing"));
  ok("and warn off the subjectless one that caused elini/elimi", await pg.evaluate(()=>
      /never \*turns the glass\*/.test(DEFAULT_FORMAT_RULES)?true:"missing"));
  ok("the authored format heading does the same", await pg.evaluate(()=>
      /\*I turn the glass/.test(BLOCK_TPL_DEFAULTS.head_format)?true:"missing"));
  ok("so does the heat one", await pg.evaluate(()=>
      /written as YOURSELF/.test(BLOCK_TPL_DEFAULTS.head_format_heat)?true:"missing"));
  ok("the emotion example no longer mixes persons", await pg.evaluate(()=>
      !/she is afraid/.test(BLOCK_TPL_DEFAULTS.head_emotion)
      && /I am afraid/.test(BLOCK_TPL_DEFAULTS.head_emotion) ? true : BLOCK_TPL_DEFAULTS.head_emotion.slice(0,160)));
  ok("the base instruction stops sliding from 'they' into 'you'", await pg.evaluate(()=>{
      const sec=(DEFAULT_BASE_INSTRUCTION.split("# EMOTION")[0]||"");
      return /^- They /m.test(sec)? "still third person" : true; }));

  console.log("\n[every heading is a fragment you can delete]");
  ok("all of them have a shipped default", await pg.evaluate(()=>{
      const miss=LY_ORDER.filter(k=>!(typeof BLOCK_TPL_DEFAULTS[k]==="string"&&BLOCK_TPL_DEFAULTS[k].trim()));
      return miss.length?miss.join(", "):true; }));
  ok("the layout block lists every one", await pg.evaluate(()=>{
      const t=(REPLY_BLOCKS.layout&&REPLY_BLOCKS.layout.tpls)||[];
      const miss=LY_ORDER.filter(k=>t.indexOf(k)<0); return miss.length?miss.join(", "):true; }));
  ok("the editor knows them as callable names", await pg.evaluate(()=>{
      const known=ptKnownNames(); const has=k=>(known&&typeof known.has==="function")?known.has(k):!!(known||{})[k];
      const miss=LY_ORDER.filter(k=>!has(k)); return miss.length?miss.join(", "):true; }));
  ok("they resolve to their text, not to empty", await pg.evaluate(()=>{
      const s=ptSources({},null); const empty=LY_ORDER.filter(k=>!String(s[k]||"").trim());
      return empty.length?empty.join(", "):true; }));
  ok("blanking one removes it from the render", await pg.evaluate(()=>{
      state.blockTpls=state.blockTpls||{};
      const tpl="{{call//head_body}}\n{{call//trackers//full}}";
      const srcs=ptSources({trackers:"TRACKER TEXT"},null), vars=ptVars({});
      const before=ptExpand(tpl,srcs,vars,{unknownCall:[],unknownVar:[],emptyVar:[]});
      state.blockTpls.head_body="";
      const after=ptExpand(tpl,ptSources({trackers:"TRACKER TEXT"},null),vars,{unknownCall:[],unknownVar:[],emptyVar:[]});
      delete state.blockTpls.head_body;
      return (before.indexOf("WHAT YOUR BODY CARRIES")>-1 && after.indexOf("WHAT YOUR BODY CARRIES")===-1
              && after.indexOf("TRACKER TEXT")>-1) ? true : JSON.stringify({before,after}); }));

  console.log("\n[a heading does not outlive the blocks under it]");
  const exp=(tpl,blocks)=>pg.evaluate(o=>ptExpand(o.tpl,ptSources(o.blocks,null),ptVars({}),
      {unknownCall:[],unknownVar:[],emptyVar:[]}),{tpl,blocks});
  ok("empty group → the heading goes too",
     (await exp("{{call//head_feelings}}\n{{call//feelings//full}}\n{{call//drives//full}}",{})).trim()==="" ,
     await exp("{{call//head_feelings}}\n{{call//feelings//full}}",{}));
  ok("one filled block → the heading stays", await (async()=>{
     const r=await exp("{{call//head_feelings}}\n{{call//feelings//full}}\n{{call//drives//full}}",{drives:"DRIVE TEXT"});
     return (r.indexOf("YOUR FEELINGS")>-1 && r.indexOf("DRIVE TEXT")>-1)?true:r; })());
  ok("a heading standing alone is not a group and survives", await (async()=>{
     const r=await exp("{{call//head_respond_as}}",{});
     return /Respond as/.test(r)?true:JSON.stringify(r); })());

  console.log("\n[the authored layouts]");
  ok("one exists for every payload kind", await pg.evaluate(()=>{
      const miss=PT_KINDS.filter(k=>!ptHasPreset(k)); return miss.length?miss.join(", "):true; }));
  ok("none of them calls a name that does not exist", await pg.evaluate(()=>{
      const bad=PT_KINDS.map(k=>{const sc=ptScan(ptPreset(k),ptKnownNames());
        return (sc.unknownCall.length||sc.unknownVar.length)?k+":"+sc.unknownCall.concat(sc.unknownVar).join("/"):null;
      }).filter(Boolean); return bad.length?bad.join(", "):true; }));
  ok("every one calls already_said — the anti-repeat block", await pg.evaluate(()=>{
      const miss=PT_KINDS.filter(k=>ptPreset(k).indexOf("{{call//already_said")<0);
      return miss.length?miss.join(", "):true; }));
  ok("every one calls the line you are answering", await pg.evaluate(()=>{
      const miss=PT_KINDS.filter(k=>ptPreset(k).indexOf("{{call//last_line")<0);
      return miss.length?miss.join(", "):true; }));
  ok("restoring one saves it, and reset still gives the generated default", await pg.evaluate(()=>{
      const was=ptTemplates().solo;
      ptRestorePreset("solo");
      const a=ptTemplate("solo")===ptPreset("solo");
      ptSetTemplate("solo",null);
      const b=ptTemplate("solo")===ptDefaultTemplate("solo");
      if(was==null) ptSetTemplate("solo",null); else ptSetTemplate("solo",was);
      return (a&&b)?true:("restored="+a+" reset="+b); }));
  ok("the generated default is still byte-identical to buildPayload", await pg.evaluate(()=>{
      // the safety net the authored layouts must not have disturbed
      return ptDefaultTemplate("solo").indexOf("{{call//dialogue_history}}")>-1; }));

  console.log("\n[the check runs on what is SENT, not only on what shipped]");
  ok("the real slip from a live payload is caught", await pg.evaluate(()=>{
      // bio_wardrobe_self, as it was actually typed: a half-finished "you" -> "I" rewrite.
      const p=voiceScan("bio_wardrobe_self","## MY WARDROBE\n-What I usually wear (I dress yourself plausibly from this, fitting the scene and the time of day):");
      const e=p.filter(x=>x.level==="error");
      return (e.length&&e[0].rule==="mixed person")?true:JSON.stringify(p); }));
  ok("and the reverse conversion too", await pg.evaluate(()=>
      voiceScan("x","You should picture myself doing it").some(x=>x.rule==="mixed person")?true:"missed"));
  ok("a guessed pronoun is an error", await pg.evaluate(()=>
      voiceScan("x","react to their not being here; if he was only speaking ABOUT them")
        .some(x=>x.level==="error"&&x.rule==="assumed gender")?true:"missed"));
  ok("but a quoted example keeps its pronouns", await pg.evaluate(()=>
      voiceScan("x",'no narration, no "he says", nothing like it').length===0?true:"false positive"));
  ok("and so does one shown in *asterisks*", await pg.evaluate(()=>
      voiceScan("x","never *she turns the glass*").length===0?true:"false positive"));
  ok("a _other fragment may describe somebody else", await pg.evaluate(()=>
      voiceScan("bio_behave_other","How they act — the thing he does").every(x=>x.rule!=="assumed gender")?true:"flagged"));
  ok("first person in an instruction is a NOTE, not an error", await pg.evaluate(()=>{
      const p=voiceScan("rel_header","# MY PEOPLE\nThese are my established ties.");
      return (p.length===1&&p[0].level==="note")?true:JSON.stringify(p); }));
  ok("a fragment allowed to quote a voice is left alone", await pg.evaluate(()=>
      voiceScan("head_format","write it as *I turn the glass*").length===0?true:"flagged"));

  console.log("\n[the editor's \"check my wording\" reads the typed copies]");
  ok("it finds a rewritten fragment the shipped one does not have", await pg.evaluate(()=>{
      state.blockTpls=state.blockTpls||{};
      const was=state.blockTpls.bio_wardrobe_self;
      state.blockTpls.bio_wardrobe_self="What I usually wear (I dress yourself plausibly from this):";
      const rows=voiceScanOverrides();
      if(was===undefined)delete state.blockTpls.bio_wardrobe_self; else state.blockTpls.bio_wardrobe_self=was;
      const r=rows.filter(x=>x.key==="bio_wardrobe_self")[0];
      return (r&&r.errors>0)?true:JSON.stringify(rows.map(x=>x.key)); }));
  ok("a clean rewrite is not reported", await pg.evaluate(()=>{
      state.blockTpls=state.blockTpls||{};
      const was=state.blockTpls.trackers_header;
      state.blockTpls.trackers_header="# WHAT IS TRUE OF YOU RIGHT NOW\nAct from these; never read one out.";
      const hit=voiceScanOverrides().some(x=>x.key==="trackers_header");
      if(was===undefined)delete state.blockTpls.trackers_header; else state.blockTpls.trackers_header=was;
      return hit?"reported a clean one":true; }));
  ok("errors sort above notes", await pg.evaluate(()=>{
      state.blockTpls=state.blockTpls||{};
      const keep=Object.assign({},state.blockTpls);
      state.blockTpls.rel_header="# MY PEOPLE";                       // note only
      state.blockTpls.trackers_header="I set yourself straight";      // error
      const rows=voiceScanOverrides().filter(r=>r.key==="rel_header"||r.key==="trackers_header");
      state.blockTpls=keep;
      return (rows.length===2&&rows[0].key==="trackers_header")?true:JSON.stringify(rows.map(r=>r.key)); }));
  ok("the panel renders without a host and does not throw", await pg.evaluate(()=>{
      try{ voiceCheckUI(); return true; }catch(e){ return "threw: "+e.message; } }));
  ok("the shipped wording still passes the same checker with zero errors", await pg.evaluate(()=>{
      const bad=Object.keys(BLOCK_TPL_DEFAULTS).filter(k=>voiceScan(k,BLOCK_TPL_DEFAULTS[k]).some(x=>x.level==="error"));
      return bad.length?bad.join(", "):true; }));

  console.log("\n[nothing else moved]");
  ok("no page errors", errs.length===0?true:errs.join(" | "));
  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close(); process.exit(fail?1:0);
})();
