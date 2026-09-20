/* v44.4 — "The card mixes three voices in one document." It did, and the prompts asked for it.

   FIVE prompts mint character cards — the single writer, the batch writer, the universe builder,
   the latent-NPC minter and the reveal. Every one of them said "write in the second person" near
   the top and then described the fields, and wrote every worked example, in the THIRD: "their
   resting behavior", "Someone he counts as his", ten example trait lines all saying "he". A model
   copies the voice of the example it is shown, not the instruction above it — so <backstory> and
   <personality>, the largest blocks in the identity sheet, came back as "He came from…", and the
   second-person blocks around them read as noise.

   The rule is one constant now, included by all five, so they cannot drift apart again. */
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file:///home/user/Multirp/index.html'); await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(900);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x||c).slice(0,400));} };

  // Every prompt that writes a card, as the app actually resolves it (registry default → up()).
  const WRITERS=["bioPrompt","batchBioPrompt","univPrompt","latentNpc"];
  const texts=await pg.evaluate((keys)=>{
    const out={};
    keys.forEach(k=>{ out[k]=String(up(k)||""); });
    out.x_reveal_npc=String((X_ENGINE_PROMPTS.x_reveal_npc||{}).def||"");
    out._rule=typeof CARD_VOICE_RULE==="string"?CARD_VOICE_RULE:"";
    return out;
  },WRITERS);
  const ALL=WRITERS.concat(["x_reveal_npc"]);

  console.log("\n[the rule exists once and every card writer carries it]");
  ok("CARD_VOICE_RULE is a real string", texts._rule.length>200, "length "+texts._rule.length);
  ok("it names second person as the card's voice",
     /SECOND PERSON/.test(texts._rule) && /"You are…"/.test(texts._rule));
  ok("it says why not first person — the card is read as OTHER people's reference too",
     /no owner/.test(texts._rule), texts._rule.slice(0,200));
  ok("it exempts the director fields", /"instructions" and "interject"/.test(texts._rule));
  ALL.forEach(k=>ok(k+" includes it", texts[k].indexOf("## THE VOICE OF THIS CARD")>-1,
     k+" does not carry the rule"));

  console.log("\n[no third-person example is left to copy]");
  /* These are the exact phrases that taught the model the wrong voice. They are worked examples and
     field descriptions, not prose about the writing task, so any survivor is a real regression. */
  const BANNED=[
    ["a trait example written as \"he\"", /Someone he counts as his/],
    ["the ten-line profile example in third person", /nothing is asked of him/],
    ["the staging example in third person", /rubs the back of his neck/],
    ["\"their resting behavior\"", /Default is their resting behaviou?r/],
    ["\"history that shaped them\"", /sentences of history that shaped them"/],
    ["\"how they speak\" as a field description", /"1-2 sentences on how they speak/],
    ["\"what this character actively WANTS — their standing\"", /actively WANTS — their standing/]
  ];
  BANNED.forEach(([label,re])=>{
    const hit=ALL.filter(k=>re.test(texts[k]));
    ok(label+" is gone", hit.length===0, "still in: "+hit.join(", "));
  });

  console.log("\n[the character's own fields ask for second person by name]");
  ok("personality does", /"personality":[^\n]*SECOND PERSON/.test(texts.bioPrompt));
  ok("backstory does", /"backstory":[^\n]*SECOND PERSON/.test(texts.bioPrompt));
  ok("goals does", /"goals":[^\n]*SECOND PERSON/.test(texts.bioPrompt));
  ok("style does", /"style":[^\n]*SECOND PERSON/.test(texts.bioPrompt));
  ok("traits does, and its worked example is in that voice",
     /SECOND PERSON throughout/.test(texts.bioPrompt) && /nothing is asked of you/.test(texts.bioPrompt));
  ok("the batch writer's fields do too",
     /"backstory":[^\n]*SECOND PERSON/.test(texts.batchBioPrompt)
     && /"personality":[^\n]*SECOND PERSON/.test(texts.batchBioPrompt));
  ok("and so do the universe builder's",
     /"backstory":[^\n]*SECOND PERSON/.test(texts.univPrompt)
     && /"traits":[^\n]*SECOND PERSON/.test(texts.univPrompt));
  ok("the batch writer's socialGraph is no longer first person",
     /"socialGraph":[^\n]*SECOND PERSON/.test(texts.batchBioPrompt)
     && !/Selim is my younger brother/.test(texts.batchBioPrompt),
     "socialGraph still says \"my younger brother\"");

  console.log("\n[the director fields stay director-facing]");
  /* Only SCHEMA lines ("field": …) count — the rule's own prose names both fields too. */
  const schemaLines=(t,f)=>String(t).split("\n").filter(l=>new RegExp('"'+f+'"\\s*:').test(l));
  const marked=(f)=>{
    const bad=ALL.filter(k=>schemaLines(texts[k],f).some(l=>l.indexOf("DIRECTOR NOTE")===-1));
    return bad.length?("unmarked in: "+bad.join(", ")):true;
  };
  ok("instructions is marked as a director note everywhere it is asked for", marked("instructions"));
  ok("and so is interject", marked("interject"));

  console.log("\n[a contradiction inside the batch writer, found on the way past]");
  /* Its rules described TEN states while its own JSON schema asked for "Five lines, one per axis"
     in the retired Axis (low|mid|high) form — two different shapes in one prompt. */
  ok("the schema asks for the same ten states its rules describe",
     /"traits":[^\n]*TEN/.test(texts.batchBioPrompt)
     && !/Five \\n-separated lines, one per axis/.test(texts.batchBioPrompt),
     "still asks for five axes");

  /* v78.1 — ONE VOICE IN THE REPLY PAYLOAD. Every writer whose output lands in a character's own
     card must say so. The card opens "You are <name>", so anything arriving in it that speaks
     about the character from outside — or as them — teaches the actor the wrong person. This is
     the list; a new writer that feeds the card belongs on it. */
  console.log("\n[every writer that feeds the card states its voice]");
  {
    const FEEDS=["psychePrompt","goalsCurator","relPrompt","relShortPrompt","promisePurge",
                 "promisePrompt","socialGraphPrompt","relGenPrompt","afterHeatPrompt",
                 "calReconcile","goalPursuit","intentForm","x_outfits_generator"];
    const said=await pg.evaluate(ks=>ks.map(k=>{
      const t=(up(k)||"");
      return [k, /SECOND PERSON|second person|2nd person|written to them as "you"|addressed to \{\{char\}\}|as "you"/.test(t)];
    }),FEEDS);
    said.forEach(([k,okk])=>ok(k+" names its voice", okk===true?true:"no second-person rule in "+k));
  }
  ok("the drives writer is no longer clinical third person", await pg.evaluate(()=>{
      const t=up("psychePrompt");
      return /VOICE — SECOND PERSON/.test(t) && !/Write ABOUT \{\{self\}\} in the third person/.test(t)
        ? true : "psychePrompt still asks for third person"; }));
  ok("the goals rule no longer demonstrates what it forbids", await pg.evaluate(()=>{
      const t=up("goalsCurator");
      return !/look at me the way he used to/.test(t) && /pronoun INSIDE the line is SECOND PERSON/i.test(t)
        ? true : "goalsCurator still shows a first-person example"; }));

  console.log("\n[the shipped block templates carry no stray first person]");
  ok("only quoted examples use I/me/my", await pg.evaluate(()=>{
      // Lines that legitimately quote speech, a thought, or a forbidden form.
      const EXEMPT=new Set(["head_format","head_emotion","rp_last_before","head_format_heat",
        "voice_delivery","heat_delivery","heat_narr_superego","target_bg","bio_behave_other",
        "bio_wardrobe_other","quest_intro","last_line_footer","drive_ego","heat_breaks_voiced",
        "heat_breaks_silent","resistance_body","rails_header"]);
      const FP=/(?<![A-Za-z])(I|I'm|I've|my|My|MY|me|Me|mine|myself)(?![A-Za-z])/;
      const bad=Object.keys(BLOCK_TPL_DEFAULTS).filter(k=>!EXEMPT.has(k)
        && typeof BLOCK_TPL_DEFAULTS[k]==="string" && FP.test(BLOCK_TPL_DEFAULTS[k]));
      return bad.length?("first person in "+bad.join(", ")):true; }));

  console.log("\n[nothing downstream broke]");
  ok("the prompts still resolve through the registry", ALL.every(k=>texts[k].length>300));
  ok("no page errors", errs.length===0?true:errs.join(" | "));
  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close(); process.exit(fail?1:0);
})();
