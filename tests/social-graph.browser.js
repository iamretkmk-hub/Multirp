/* v65.1 — CREATE A SOCIAL GRAPH.
   `socialGraph` is the author's one-paragraph "who is who to me", and only ONE of the three
   creation paths ever wrote it: `batchBioPrompt`, which makes a set of characters who already know
   each other. A character made singly, or by the universe generator, got none — which is why some
   have one and some do not.
   It is not cosmetic: `relSheetBlockFull` checks for it at render time, and without it the
   relationships block cannot run at `present` scope, so the character pays for the gap in every
   payload. This writes one from what already exists.
   Run: node tests/social-graph.browser.js */
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage({viewport:{width:412,height:915}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file:///home/user/Multirp/index.html'); await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(900);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x||c).slice(0,420));} };

  console.log("\n[the prompt is registered like every other]");
  ok("editable, and mapped to a Settings card rather than swept into the catch-all",
     await pg.evaluate(()=>!!PROMPT_BY_KEY.socialGraphPrompt
       && typeof up("socialGraphPrompt")==="string"
       && ENGINE_PAYLOAD_DEFS.some(d=>(d.blocks||[]).some(x=>x&&x.promptKey==="socialGraphPrompt"))
       && !ENGINE_PAYLOAD_DEFS.some(d=>d.key==="other")));
  ok("it round-trips through storage", await pg.evaluate(()=>{
      const was=state.socialGraphPrompt;
      state.socialGraphPrompt="MINE."; saveSettings&&0; store.setRaw(K.socialGraphPrompt,"MINE.");
      const back=store.raw(K.socialGraphPrompt,DEFAULT_SOCIAL_GRAPH);
      store.setRaw(K.socialGraphPrompt,was); state.socialGraphPrompt=was;
      return back==="MINE."; }));
  ok("it asks for the second person, and says the other people stay third",
     await pg.evaluate(()=>/SECOND PERSON throughout/.test(DEFAULT_SOCIAL_GRAPH)
       && /Only \{\{char\}\} is "you"/.test(DEFAULT_SOCIAL_GRAPH)));
  ok("and forbids inventing a tie that is not in the material",
     await pg.evaluate(()=>/If a tie is not there, \{\{char\}\} does not have it/.test(DEFAULT_SOCIAL_GRAPH)));

  console.log("\n[it compresses what is there — the ties come first]");
  ok("the ties are the primary input, labelled as the thing to compress",
     await pg.evaluate(()=>{
      const src=String(generateSocialGraphFor);
      return /persona\.relationships/.test(src)
          && /COMPRESS THESE/.test(src)
          && /socialFactLines\(persona\)/.test(src); }));
  ok("with no ties on record it still runs, and says the answer is thinner",
     await pg.evaluate(()=>/none on record yet/.test(String(generateSocialGraphFor))));
  ok("the world, the cast and who lives where all reach it", await pg.evaluate(()=>{
      const src=String(generateSocialGraphFor);
      return /uni\.setting/.test(src) && /l\.residents\.includes/.test(src)
          && /EVERYONE ELSE IN THIS WORLD/.test(src) && /THE PLAYER/.test(src); }));

  console.log("\n[it is the author's field, so it does not take it quietly]");
  ok("an existing graph is confirmed before it is replaced",
     await pg.evaluate(()=>/confirm\(/.test(String(genSocialGraphForCharacter))
       && /Replace /.test(String(genSocialGraphForCharacter))));
  ok("the result is trimmed on a word boundary, never mid-word",
     await pg.evaluate(()=>/briefDesc\(text,1200\)/.test(String(generateSocialGraphFor))));
  ok("and it writes the field the relationships block actually reads", await pg.evaluate(()=>
      /persona\.socialGraph=/.test(String(generateSocialGraphFor))
   && /persona\.socialGraph/.test(String(relSheetBlockFull))));

  console.log("\n[having one is what unlocks present scope]");
  ok("no summary falls the relationships block back to brief", await pg.evaluate(()=>
      /_hasSummary/.test(String(buildCharPromptBlocks))
   && /_wantScope==="present"&&!_hasSummary/.test(String(buildCharPromptBlocks))));

  console.log("\n[the editor]");
  ok("the button sits under the field it writes", await pg.evaluate(()=>{
      const btn=document.getElementById('peSocGraphBtn');
      const box=document.getElementById('peSocialGraph');
      return !!btn && !!box
        && /Create social graph/.test(btn.textContent)
        && !!(box.compareDocumentPosition(btn)&Node.DOCUMENT_POSITION_FOLLOWING); }));
  ok("and the placeholder no longer shows first person, which no generator asks for",
     await pg.evaluate(()=>{
      const ph=document.getElementById('peSocialGraph').getAttribute('placeholder')||"";
      return /is your younger sister/.test(ph) && !/is my younger sister/.test(ph); }));

  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log("\n  "+pass+" passed, "+fail+" failed");
  await b.close();
  process.exit(fail?1:0);
})();
