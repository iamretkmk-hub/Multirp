/* v38.5 — NO PROMPT IS UNREACHABLE.
   Eighteen background engines had their system prompt written as a template literal inside the
   function that sent it: no storage key, no per-universe override, no box in Settings, no export.
   This file holds the class shut. Two halves:
     1) structure — every engine's prompt resolves to a registry entry that has a key, a default, a
        storage slot and a card to open; nothing is swept into the catch-all.
     2) wording — the converted prompts, filled with the values their call sites now pass, are
        byte-for-byte the strings the old template literals produced. Copied from the source before
        the conversion; one long-standing typo (x_arrival's doubled comma) is asserted as-is,
        because making a prompt editable must not quietly rewrite it.
   Run: node tests/prompt-registry.browser.js */
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage();
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file://'+require('path').resolve(__dirname,'..','index.html'));
  await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(700);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x||c).slice(0,900));} };

  console.log("\n[every prompt has a home]");
  ok("every engine's prompt is a registry prompt", await pg.evaluate(()=>{
      const bad=Object.keys(ENGINE_PARTS).filter(k=>!PROMPT_BY_KEY[ENGINE_PARTS[k].promptKey]);
      return bad.length?("written in code: "+bad.join(", ")):true; }));
  ok("every registry prompt has a storage key", await pg.evaluate(()=>{
      const bad=PROMPT_REGISTRY.filter(r=>!K[r.key]).map(r=>r.key);
      return bad.length?("no K entry: "+bad.join(", ")):true; }));
  ok("every registry prompt has a non-empty default", await pg.evaluate(()=>{
      const bad=PROMPT_REGISTRY.filter(r=>!(r.def&&String(r.def()||"").trim())).map(r=>r.key);
      return bad.length?("empty default: "+bad.join(", ")):true; }));
  ok("every registry prompt has a box to open", await pg.evaluate(()=>{
      const covered=new Set(["baseInstruction","formatRules"]);
      Object.values(PAYLOAD_DEFS).forEach(d=>Object.values(d.blocks).forEach(b=>{if(b&&b.promptKey)covered.add(b.promptKey);}));
      ENGINE_PAYLOAD_DEFS.forEach(d=>d.blocks.forEach(b=>{if(b.promptKey)covered.add(b.promptKey);}));
      const bad=PROMPT_REGISTRY.filter(r=>!covered.has(r.key)).map(r=>r.key);
      return bad.length?("no card: "+bad.join(", ")):true; }));
  ok("and nothing had to be swept into the catch-all", await pg.evaluate(()=>
      !ENGINE_PAYLOAD_DEFS.some(d=>d.key==="other") ? true : "the 'Other prompts' card exists"));
  ok("no engine's Edit button says the prompt is written in code", await pg.evaluate(()=>{
      show('settings'); renderPayloadList(); renderEnginePayloads();
      const bad=[];
      Object.keys(ENGINE_PARTS).forEach(k=>{
        const d=epDef(k);
        const card=ENGINE_PAYLOAD_DEFS.find(c=>(c.blocks||[]).some(b=>b.promptKey===d.promptKey));
        if(!card) bad.push(k);
      });
      return bad.length?("no card for: "+bad.join(", ")):true; }));
  ok("an edit to one of them survives a save", await pg.evaluate(()=>{
      const before=up("x_scene_recap");
      state.x_scene_recap="MY OWN RECAP RULE.";
      saveSettings();
      const stored=store.raw(K.x_scene_recap,null);
      state.x_scene_recap=before; saveSettings();
      return stored==="MY OWN RECAP RULE." ? true : "stored: "+JSON.stringify(stored); }));
  ok("and a per-universe override wins over it", await pg.evaluate(()=>{
      const u=curUniverseObj(); u.prompts=u.prompts||{};
      u.prompts.x_scene_recap="UNIVERSE VERSION.";
      const got=up("x_scene_recap");
      delete u.prompts.x_scene_recap;
      return got==="UNIVERSE VERSION." ? true : got; }));
  ok("they are in the prompt export", await pg.evaluate(()=>{
      const bad=Object.keys(X_ENGINE_PROMPTS).filter(k=>!PROMPT_BY_KEY[k]||!K[k]);
      return bad.length?bad.join(", "):true; }));

  /* v38.5 — four helpers never went through epSend at all, so the engine audit could not see them:
     the image-prompt reviser, the chronicle condenser, the rolling recap and the voice-call
     transcript repair. Plus the tracker judge's question, which carried its own JSON contract. */
  console.log("\n[the prompts that were not even engines]");
  for(const k of ["x_prompt_reviser","x_chronicle_condense","x_rolling_recap","x_stt_repair","x_tracker_ask",
                  "x_call_role","x_call_delivery","x_call_fallback"])
    ok(k+" is a registry prompt with a key and a card", await pg.evaluate(key=>{
        if(!PROMPT_BY_KEY[key]) return "not in the registry";
        if(!K[key]) return "no storage key";
        const on=ENGINE_PAYLOAD_DEFS.some(d=>(d.blocks||[]).some(b=>b.promptKey===key));
        return on?true:"no card"; },k));
  ok("the voice call still says it is happening in person", await pg.evaluate(()=>{
      const t=fillTpl(up("x_call_role"),{char:"Ayse",user:"Kemal"});
      return /^You are Ayse, talking WITH Kemal in person/.test(t) && t.indexOf("{{")<0
        ? true : t.slice(0,140); }));
  ok("and still directs the voice actor in the story's language", await pg.evaluate(()=>{
      const t=fillTpl(up("x_call_delivery"),{lang:"Turkish"});
      return t.indexOf("everyday Turkish")>-1 && t.indexOf("[say warmly]")>-1 && t.indexOf("{{")<0
        ? true : t.slice(0,160); }));
  ok("the tracker question still carries its JSON contract", await pg.evaluate(()=>{
      const t=fillTpl(up("x_tracker_ask"),{tracker:"DEF",name:"Trust",owner:"Ayse"});
      return t==='DEF\n\nBased ONLY on the recent exchange above, decide how "Trust" for Ayse should change. Return ONLY strict JSON: {"delta": <number, 0 if no change>, "triggered": <true|false>}. Most turns produce delta 0 — only move it on a clear in-scene reason.'
        ? true : JSON.stringify(t); }));

  console.log("\n[the wording did not move]");
  const U="Kemal";
  await pg.evaluate(u=>{ state.user=u; },U);
  const CASES=[
    ["x_look_split",{},
      'Split a character\'s freeform appearance string into STRUCTURED JSON for an image generator. Output ONLY: {"face_map":"the celebrity name if one is present, else \\"\\"","hair":"hair only","face":"non-celebrity face details only (never repeat the celebrity name)","body":"physique/build only"}. English only. If a field isn\'t present in the input, use "".'],
    ["x_scene_recap",{},
      "You write a single-sentence 'Previously on…' recap of where an ongoing roleplay scene left off. Present tense, vivid, under 40 words, no quotes, no character dialogue — just the situation as it stands."],
    ["x_meeting_no_show_beat",{},
      "You are the narrator of a roleplay. Reply with ONE sentence only, no quotation marks."],
    ["x_day_transition_narration",{},
      "You write a brief, evocative transition that closes out a day in an ongoing roleplay and eases into nightfall/sleep, then hints the next day is beginning. 2-3 sentences, second person or ambient narration. No dialogue, no character names in quotes. End on the new day dawning."],
    ["x_reveal_npc",{},
      'You flesh out a roleplay character from a short sketch, consistent with the world. Return ONLY JSON: {"personality":"2-4 sentences","look":"English visual appearance for image generation (hair, build, face, clothing)","backstory":"1-3 sentences","style":"how they speak","goals":"what they want"}.'],
    /* the doubled comma below is the original's, kept on purpose — see the header */
    ["x_arrival",{user:U,place:"Entrance, Emre's Home",situation:', where this awaits: "The lawyer"',also:" Ayse is here.",lang:"ENGLISH"},
      'You are the GAMEMASTER narrator. '+U+' has just arrived at Entrance, Emre\'s Home, , where this awaits: "The lawyer". Ayse is here. Write ONE short, vivid ENGLISH narration (1-2 sentences, third person, no dialogue, no quotes) that sets up this moment and pulls '+U+' into it.'],
    ["x_arrival",{user:U,place:"The port",situation:" and Ayse is here",also:"",lang:"ENGLISH"},
      'You are the GAMEMASTER narrator. '+U+' has just arrived at The port,  and Ayse is here. Write ONE short, vivid ENGLISH narration (1-2 sentences, third person, no dialogue, no quotes) that sets up this moment and pulls '+U+' into it.'],
    ["x_arrival_line",{char:"Ayse",sheet:"SHEET",extra:"\n\nEXTRA",place:"The port",user:U,
      about:' about this: "The lawyer"',also:" Also here with you: Emre.",lang:"ENGLISH"},
      "You are Ayse.\nSHEET\n\nEXTRA\n\nYou are at The port. "+U+' has just arrived about this: "The lawyer". Also here with you: Emre. Open the moment — greet '+U+" and draw them into the matter, either as the person it concerns or as someone leading them to it, consistent with how you already know or regard them. Speak IN CHARACTER, in ENGLISH, 1-3 sentences (a brief action is fine). Do not narrate for "+U+" or speak for the others."],
    ["x_bg_task",{lang:"ENGLISH",char:"Ayse",user:U,task:"finding the deed",outcome:"FAILED",fail_note:" showing what went wrong"},
      'You narrate a brief OFFSTAGE outcome in a roleplay, in ENGLISH. Ayse spent time — away from '+U+' — working on this on their own: "finding the deed". It FAILED. Write ONE short, vivid third-person beat (1-2 sentences) showing what went wrong, plus a 3-6 word headline. Return ONLY JSON: {"headline":"...","event":"..."}.'],
    ["x_schedule_generator",{home_note:' Their home is "Emre\'s Home".'},
      "You build a believable daily schedule for a roleplay character across 5 periods: Morning, Midday, Afternoon, Evening, Night.\n\nFor EACH period, distribute 100 points across the available locations to represent how likely this character is to be at each one during that period. You don't have to use every location, and the points per period don't have to sum to exactly 100 — leftover means \"somewhere else / not around\". Make it reflect who they are (a workaholic is at work midday, home at night; a socialite is out in the evening; a homebody mostly home). Their home is \"Emre's Home\".\n\nReturn ONLY strict JSON mapping each period to {locationName: points}:\n{\"Morning\":{\"Name\":40,...},\"Midday\":{...},\"Afternoon\":{...},\"Evening\":{...},\"Night\":{...}}\nUse EXACT location names from the list. No commentary."],
    ["x_location_request",{request:"a rooftop bar"},
      "USER'S REQUEST — prioritize creating the places they describe (adapt them to fit the world, keep the exact JSON shape, never recreate an existing place):\na rooftop bar"],
    ["x_char_quest_reconcile",{user:U},null]  // long; checked for its opening line only, below
  ];
  for(const [key,vals,want] of CASES){
    if(want===null) continue;
    const got=await pg.evaluate(a=>fillTpl(up(a.k),a.v),{k:key,v:vals});
    ok(key, got===want, "want: "+JSON.stringify(want)+"\n        got:  "+JSON.stringify(got));
  }
  ok("x_char_quest_reconcile names the player", await pg.evaluate(u=>{
      const t=fillTpl(up("x_char_quest_reconcile"),{user:u});
      return t.indexOf("PERSONAL quests that involve the player ("+u+")")>-1 && t.indexOf("{{")<0
        ? true : t.slice(0,180); },U));
  ok("x_write_prompt_with_ai takes its two conditional rules", await pg.evaluate(()=>{
      const t=fillTpl(up("x_write_prompt_with_ai"),{json_rule:" JSONRULE",ph_rule:" PHRULE"});
      return /directly usable\. JSONRULE PHRULE$/.test(t) ? true : t.slice(-120); }));
  ok("no converted prompt leaves an unfilled placeholder", await pg.evaluate(()=>{
      // every {{name}} a default carries must be one the app knows how to fill
      const known=new Set(["user","char","self","target","place","situation","also","lang","sheet",
        "extra","about","task","outcome","fail_note","home_note","cast","world","count","places",
        "request","json_rule","ph_rule","seconds","beats","tracker","name","owner"]);
      const bad=[];
      Object.keys(X_ENGINE_PROMPTS).forEach(k=>{
        (String(X_ENGINE_PROMPTS[k].def).match(/\{\{(\w+)\}\}/g)||[]).forEach(t=>{
          const n=t.slice(2,-2); if(!known.has(n)) bad.push(k+"/"+n); });
      });
      return bad.length?bad.join(", "):true; }));

  ok("no page errors", errs.length===0?true:errs.join(" | "));
  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close(); process.exit(fail?1:0);
})();
