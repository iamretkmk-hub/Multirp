/* v38.4 — THE WIRE DID NOT MOVE.
   tests/engine-parity.test.js compares the template path against the classic path. Both were
   edited together in this conversion, so agreeing with each other proves nothing about what the
   background engines actually receive. This file holds the OTHER end: for every engine whose
   fixed instruction or label was lifted out of its call site, the classic user message built from
   the values the call site now passes must be byte-for-byte the string the old hand-written
   concatenation produced. The expected strings below are copied from the pre-conversion source.
   Run: node tests/engine-wire.browser.js */
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
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x||c).slice(0,700));} };

  // a story with a name and a language, so {{user}} and {{story_language}} have something to be
  await pg.evaluate(()=>{ state.user="Kemal"; state.storyLang=state.storyLang||"en"; });
  const U=await pg.evaluate(()=>state.user);
  const LANG=await pg.evaluate(()=>storyLangName());

  /* [engine, values the call site passes now, the exact string the old call site built] */
  const CASES=[
    ["latentNpc",{},"Respond with ONLY the JSON array."],
    ["x_arrival",{},"Narrate the arrival."],
    ["x_arrival_line",{},"Speak."],
    ["trackerGen",{},"Design it and respond with ONLY the JSON."],
    ["x_location_generator",{},"Generate the JSON array now."],
    ["ruleCompiler",{},"Compile the rule. JSON only."],
    ["questGen",{},"Write the arc JSON now."],
    ["questNext",{},"Write the JSON now."],
    ["x_bg_task",{},"Narrate it."],
    ["charQuestGen",{},"Decide and respond with ONLY the JSON."],
    ["memEval",{},"Judge the arc now. Return the JSON."],
    ["confrontJudge",{},"Score "+U+"'s latest turn. Return the JSON."],
    ["overtureJudge",{},"Score "+U+"'s latest turn. Return the JSON."],
    ["charMovePrompt",{data:"CTX_BLOCK"},"CTX_BLOCK\n\nWrite the short movement beat now, in "+LANG+"."],
    ["travelPrompt",{data:"CTX_BLOCK"},"CTX_BLOCK\n\nWrite the travel narration."],
    ["x_scene_recap",{convo:"CONVO"},"Scene so far:\nCONVO\n\nWrite the one-line recap."],
    ["attendancePersuade",{meeting:'The meeting: "The lawyer" (Morning), day 5.',exchange:"CONVO"},
      'The meeting: "The lawyer" (Morning), day 5.\n\nRecent exchange:\nCONVO\n\nReturn {"probability": N}.'],
    ["offstageEvent",{promises:"PR"},
      "WORDS THESE TWO ARE BOUND BY (open-ended commitments — the event must not contradict one; a character choosing between a commitment and what they want is the good version of using these):\nPR\n\nDecide and respond with ONLY the JSON."],
    ["offstageEvent",{promises:""},"Decide and respond with ONLY the JSON."],
    ["calExec",{promises:"PR"},
      "WORDS THESE PEOPLE ARE BOUND BY (open-ended commitments — how this plays out must not contradict one):\nPR\n\nResolve it and respond with ONLY the JSON."],
    ["calExec",{promises:""},"Resolve it and respond with ONLY the JSON."],
    ["charQuestStep",{promises:"PR"},
      "WORDS THESE TWO ARE BOUND BY (open-ended commitments — the move must not contradict one):\nPR\n\nDecide and respond with ONLY the JSON."],
    ["charQuestStep",{promises:""},"Decide and respond with ONLY the JSON."],
    ["goalPursuit",{promises:"WORDS Ayse IS BOUND BY (open-ended commitments — never choose a move that breaks one unless breaking it IS the move, and then say so plainly):\nPR"},
      "WORDS Ayse IS BOUND BY (open-ended commitments — never choose a move that breaks one unless breaking it IS the move, and then say so plainly):\nPR\n\nDecide and respond with ONLY the JSON."],
    ["goalPursuit",{promises:""},"Decide and respond with ONLY the JSON."],
    ["voiceCheckPrompt",{profile:"PROF",line:"LINE"},"PROF\n\nLatest line:\nLINE"],
    ["x_voice_sample_script_writer",{clip:"CLIP LENGTH: 8 seconds — the track must last that long.",actor:"BRIEF"},
      "CLIP LENGTH: 8 seconds — the track must last that long.\n\nTHE CHARACTER MAKING THESE SOUNDS:\nBRIEF"],
    ["x_schedule_generator",{card:"Character: Ayse\nPersonality: Wry\nRoutine: Opens the shop",locations:"LOCS"},
      "Character: Ayse\nPersonality: Wry\nRoutine: Opens the shop\n\nLocations:\nLOCS"],
    ["sceneSetup",{scene:"CTX",memories:"MEM",cast:"Known characters already in the cast: A; B\nPlayer: "+U,event:"EVENT"},
      "CTX\n\nMEM\n\nKnown characters already in the cast: A; B\nPlayer: "+U+"\n\nThe event just introduced:\nEVENT"],
    ["sceneSetup",{scene:"",memories:"",cast:"Known characters already in the cast: A; B\nPlayer: "+U,event:"EVENT"},
      "Known characters already in the cast: A; B\nPlayer: "+U+"\n\nThe event just introduced:\nEVENT"],
    ["playerNarratePrompt",{recent:"R1\nR2",typed:U+" just typed (rewrite this as their turn):\nRAW"},
      "Recent lines:\nR1\nR2\n\n"+U+" just typed (rewrite this as their turn):\nRAW"],
    ["playerNarratePrompt",{recent:"",typed:U+" just typed (rewrite this as their turn):\nRAW"},
      U+" just typed (rewrite this as their turn):\nRAW"],
    ["routerPlayer",{roster:"ROSTER",stimulus:U+' just said:\n"HI"',exchange:"CONVO"},
      'Characters present (in earshot):\nROSTER\n\n'+U+' just said:\n"HI"\n\nRecent exchange:\nCONVO'],
    ["presencePrompt",{roster:"Currently present: A\nOffstage (could enter): B\nAll cast: A, B",exchange:"CONVO"},
      "Currently present: A\nOffstage (could enter): B\nAll cast: A, B\n\nLatest exchange:\nCONVO"],
    ["x_video_motion_prompt_writer",{clip:"CLIP LENGTH: 5 seconds",scene:"STILL"},
      "CLIP LENGTH: 5 seconds\n\nStill scene:\nSTILL"],
    ["x_playground_video_prompt_writ",{clip:"CLIP LENGTH: 5 seconds",scene:"STILL"},
      "CLIP LENGTH: 5 seconds\n\nStill scene:\nSTILL"],
    ["condensePrompt",{ask:"These 3 of Ayse's memories are about the SAME thread/topic. Merge them:",list:"LISTED"},
      "These 3 of Ayse's memories are about the SAME thread/topic. Merge them:\n\nLISTED"],
    ["daySummaryPrompt",{ask:"Day 4 — Ayse's diary. The memories Ayse formed today:",memories:"MEMS"},
      "Day 4 — Ayse's diary. The memories Ayse formed today:\n\nMEMS"]
  ];
  /* The engines whose label or instruction names something live. Their call site hands the value
     over as a {{value}} now instead of baking it into the string. */
  const VCASES=[
    ["poiGossip",{},{place:"the tea house"},"What are people saying about "+U+"'s time at the tea house? Return the JSON."],
    ["gossipPrompt",{},{who:"Ayse"},"Decide what Ayse does with what they saw."],
    ["promptTuner",{},{world:"Kadikoy"},'Output the lightly-adjusted version of the prompt for "Kadikoy".'],
    ["directorAuthor",{request:"more money pressure"},{world:"Kadikoy"},
      'Write the director notes for "Kadikoy". Output only the notes.\n\nUSER\'S REQUEST (weave this into the notes): more money pressure'],
    ["directorAuthor",{request:""},{world:"Kadikoy"},'Write the director notes for "Kadikoy". Output only the notes.'],
    ["genrePackAuthor",{request:"noir"},{world:"Kadikoy"},
      'Write the genre pack + guide for "Kadikoy". JSON only.\n\nUSER\'S REQUEST (shape the pack around this, keep JSON only): noir'],
    ["genrePackAuthor",{request:""},{world:"Kadikoy"},'Write the genre pack + guide for "Kadikoy". JSON only.'],
    ["originGen",{request:"start after the funeral"},{},
      "Write the STATE ZERO briefing now.\n\nUSER'S REQUEST (shape the briefing around this): start after the funeral"],
    ["originGen",{request:""},{},"Write the STATE ZERO briefing now."],
    ["x_look_split",{look:"tall, grey coat"},{},"Appearance: tall, grey coat"],
    ["x_day_transition_narration",{scene:"LAST"},{day:"4",next_day:"5"},
      "The scene so far (Day 4):\nLAST\n\nWrite the day-ending transition into Day 5."],
    ["memBuild",{convo:"CONVO"},{who:"Ayse"},"Text conversation Ayse had with "+U+":\n\nCONVO"],
    ["memBuild",{data:"PLAIN"},{},"PLAIN"],
    /* the drives-and-brakes engine: eleven sections, each under its own heading. Both the
       everything-present and the sparse shape, because most turns are the sparse one. */
    ["psychePrompt",{character:"Ayse",personality:"Wry",goals:"Find the shop",backstory:"Left at 19",
      with:"Kemal",ties:"TIES",promises:"PROM",trackers:"TRK",scene:"SCENE",exchange:"EX",axes:"desire: 60"},
      {target:"Kemal"},
      "THE CHARACTER: Ayse\n\nWHO THEY ARE: Wry\n\nWHAT THEY WANT OUT OF THEIR LIFE: Find the shop"
      +"\n\nWHERE THEY CAME FROM: Left at 19\n\nTHEY ARE WITH: Kemal"
      +"\n\nEVERY TIE THEY HAVE (the people a conscience is made of):\nTIES"
      +"\n\nWHAT THEY HAVE GIVEN THEIR WORD TO:\nPROM"
      +"\n\nTRUE OF THEM RIGHT NOW:\nTRK"
      +"\n\nWHERE THEY ARE AND WHO CAN SEE:\nSCENE"
      +"\n\nWHAT HAS JUST BEEN HAPPENING:\nEX"
      +"\n\nPRIVATE READINGS toward Kemal — nobody sees these and they never appear in the story."
      +" Positive means toward, negative means away. Roughly: under 25 is faint, 25-45 real, 45-70 strong,"
      +" over 70 overwhelming.\ndesire: 60"],
    ["psychePrompt",{character:"Ayse",personality:"",goals:"",backstory:"",with:"Kemal",
      ties:"",promises:"",trackers:"",scene:"",exchange:"",axes:""},{target:"Kemal"},
      "THE CHARACTER: Ayse\n\nTHEY ARE WITH: Kemal"]
  ];

  console.log("\n[the user message each converted engine puts on the wire]");
  for(const [key,parts,want] of CASES){
    const got=await pg.evaluate(a=>{ try{ return epClassicUser(a.k,a.p); }catch(e){ return "THREW: "+e.message; } },{k:key,p:parts});
    ok(key+" ("+Object.keys(parts).filter(k=>parts[k]).join(",")+")", got===want,
       "want: "+JSON.stringify(want)+"\n        got:  "+JSON.stringify(got));
  }

  console.log("\n[and the template path agrees with it]");
  for(const [key,parts,want] of CASES){
    const got=await pg.evaluate(a=>{
      const was=state.payloadTplOn; state.payloadTplOn=true;
      let m=null; try{ m=epMessages(a.k,"SYS",a.p); }finally{ state.payloadTplOn=was; }
      return m?m.filter(x=>x.role==="user").map(x=>x.content).join("\n\n"):"(fell back)";
    },{k:key,p:parts});
    ok(key+" via template", got===want.trim(), "want: "+JSON.stringify(want.trim())+"\n        got:  "+JSON.stringify(got));
  }

  console.log("\n[labels and instructions that name something live]");
  for(const [key,parts,vars,want] of VCASES){
    const got=await pg.evaluate(a=>{ try{ return epClassicUser(a.k,a.p,a.v); }catch(e){ return "THREW: "+e.message; } },{k:key,p:parts,v:vars});
    ok(key+" ("+JSON.stringify(vars)+")", got===want,
       "want: "+JSON.stringify(want)+"\n        got:  "+JSON.stringify(got));
    const got2=await pg.evaluate(a=>{
      const was=state.payloadTplOn; state.payloadTplOn=true;
      let m=null; try{ m=epMessages(a.k,"SYS",a.p,a.v); }finally{ state.payloadTplOn=was; }
      return m?m.filter(x=>x.role==="user").map(x=>x.content).join("\n\n"):"(fell back)";
    },{k:key,p:parts,v:vars});
    ok(key+" via template", got2===want.trim(), "want: "+JSON.stringify(want.trim())+"\n        got:  "+JSON.stringify(got2));
  }

  console.log("\n[the instruction is prose in the template, not a hidden call]");
  ok("every fixed part's words are in its default template", await pg.evaluate(()=>{
      const bad=[];
      Object.keys(ENGINE_PARTS).forEach(k=>{
        (ENGINE_PARTS[k].parts||[]).forEach(p=>{
          if(p.fixed==null) return;
          const t=epDefaultTemplate(k);
          if(t.indexOf(String(p.fixed))<0) bad.push(k+"/"+p.name);
          if(t.indexOf("{{call//"+p.name+"}}")>-1) bad.push(k+"/"+p.name+" (still a call)");
        });
      });
      return bad.length?bad.join(", "):true; }));
  ok("a fixed part is not offered as a callable name", await pg.evaluate(()=>{
      const bad=[];
      Object.keys(ENGINE_PARTS).forEach(k=>{
        const known=epKnownNames(k);
        (ENGINE_PARTS[k].parts||[]).forEach(p=>{ if(p.fixed!=null && known[p.name]) bad.push(k+"/"+p.name); });
      });
      return bad.length?bad.join(", "):true; }));

  /* v38.4 — THE APP MUST NOT FLAG ITS OWN SHIPPED TEMPLATE. A label that names something live
     ("Write the director notes for {{world}}") introduces a value the generic vocabulary has never
     heard of, and the first cut of this had the editor painting eight of its own defaults red and
     the Debug log reporting them as typos on every run. */
  ok("no shipped engine template warns about itself", await pg.evaluate(()=>{
      const bad=[];
      Object.keys(ENGINE_PARTS).forEach(k=>{
        const sc=ptScan(epDefaultTemplate(k),epKnownNames(k),Object.assign(ptVars({},"any"),epOwnVars(k)));
        if(sc.unknownCall.length||sc.unknownVar.length)
          bad.push(k+": "+sc.unknownCall.concat(sc.unknownVar).join(","));
      });
      return bad.length?bad.join(" | "):true; }));
  ok("a value the call site forgot stays visible, on both paths", await pg.evaluate(()=>{
      // gossipPrompt's instruction names {{who}}; with nothing passed, neither path may invent a blank
      const classic=epClassicUser("gossipPrompt",{});
      const was=state.payloadTplOn; state.payloadTplOn=true;
      let m=null; try{ m=epMessages("gossipPrompt","SYS",{}); }finally{ state.payloadTplOn=was; }
      const tpl=m?m.filter(x=>x.role==="user").map(x=>x.content).join("\n\n"):"(fell back)";
      return (classic.indexOf("{{who}}")>-1 && tpl===classic)
        ? true : "classic: "+JSON.stringify(classic)+" template: "+JSON.stringify(tpl); }));
  ok("how many engines still send one undivided blob", await pg.evaluate(()=>{
      // not a failure — a number worth watching. It was 65 of 67 before this conversion.
      const blob=Object.keys(ENGINE_PARTS).filter(k=>{
        const ps=ENGINE_PARTS[k].parts||[];
        return ps.length===1 && ps[0].name==="data" && !ps[0].sep && ps[0].fixed==null; });
      console.log("        "+blob.length+" of "+Object.keys(ENGINE_PARTS).length+": "+blob.join(", "));
      return blob.length<=25?true:("grew to "+blob.length); }));

  ok("no page errors", errs.length===0?true:errs.join(" | "));
  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close(); process.exit(fail?1:0);
})();
