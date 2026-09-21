/* v92.2 — AN EVENT WITH NO INTENT BEHIND IT IS NOT AN EVENT.
   Two reported symptoms, one cause. (1) A plan reads "Berker will visit Emre and talk"; Berker
   arrives, says he wants to talk, and cannot name a subject, so the scene becomes "you know what
   about". (2) A Gamemaster beat reads "Duygu's phone buzzed twice" — nobody knows who called or
   what it would mean to her, so the only possible reaction is a shrug, and she checks her phone
   vaguely for three turns.
   Both are the same hole: the thing that was written was the OUTSIDE of an event whose inside was
   never decided. The fix is order — settle who wants what, concretely, then craft the beat or the
   plan as the visible part of it — plus refusing to let a title stand in for a reason.
   Run: node tests/event-intent.browser.js */
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage({viewport:{width:412,height:915}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file://'+require('path').resolve(__dirname,'..','index.html'));
  await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(800);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x||c).slice(0,700));} };

  console.log("\n[a meeting has to say what it is for]");
  ok("the detector is asked for the substance, not a subject line", await pg.evaluate(()=>{
      const t=up("calPrompt")||"";
      return /WHAT THE PERSON WHO WANTED THIS MEETING IS ACTUALLY AFTER/.test(t)
          && /it is a subject line/.test(t) ? true : "the why is still one short sentence"; }));
  ok("with the failing shape shown against the working one", await pg.evaluate(()=>{
      const t=up("calPrompt")||"";
      return /WRONG: "to talk about what happened yesterday\."/.test(t) && /RIGHT: "He wants to ask her straight out/.test(t)
        ? true : "no worked contrast"; }));
  ok("and an absent reason is returned empty, never invented", await pg.evaluate(()=>{
      const t=up("calPrompt")||"";
      return /return "" rather than inventing one/.test(t) ? true : "it may still make one up"; }));

  console.log("\n[so does an errand]");
  ok("a task carries what a good answer would look like", await pg.evaluate(()=>{
      const t=up("calPrompt")||"";
      return /WHAT \{\{user\}\} IS ACTUALLY AFTER/.test(t) && /Not a subject line/.test(t)
          && /without saying it came from me/.test(t) ? true : "the task is still one sentence"; }));

  console.log("\n[so does a plan a character makes for themselves]");
  ok("the pursuit writer states what it is after, at length", await pg.evaluate(()=>{
      const t=up("goalPursuit")||"";
      return /WHAT YOU ARE AFTER/.test(t) && /Two or three sentences/.test(t)
        ? true : "detail is still one short phrase"; }));
  ok("it may not come back empty", await pg.evaluate(()=>{
      const t=up("goalPursuit")||"";
      return /NEVER empty/.test(t) && /you should have returned acted:false instead/.test(t)
        ? true : "an empty purpose is still allowed"; }));
  ok("and it is still second person, still the character's own reason", await pg.evaluate(()=>{
      const t=up("goalPursuit")||"";
      return /SECOND PERSON wherever a pronoun is needed/.test(t)
          && /no "she decides"/.test(t) && /no third person, no name/.test(t)
        ? true : "the voice rule was lost in the rewrite"; }));
  ok("the title can no longer stand in for the reason", (()=>{
      const src=require('fs').readFileSync('/home/user/Multirp/index.html','utf8');
      return /const why=String\(pl\.detail\|\|""\)\.slice\(0,240\)/.test(src)
          && !/const why=String\(pl\.detail\|\|pl\.title\)/.test(src)
        ? true : "it still falls back to the title"; })());
  ok("and the provenance line says so when there is none", (()=>{
      const src=require('fs').readFileSync('/home/user/Multirp/index.html','utf8');
      return /no reason was recorded when it was made/.test(src)
        ? true : "an empty purpose still reads as a complete premise"; })());

  console.log("\n[what the character is handed at the hour]");
  const cal=await pg.evaluate(()=>{
    const uni=state.universes[0];
    const her={id:"p_o",name:"Ozlem",universeId:uni.id,instructions:"x",personality:"x",
      backstory:"x",style:"x",goals:"x",look:{}};
    state.personas=[her]; state.calOn=true;
    const chat=curChat(); chat.gameDay=5; chat.period="Evening"; chat.calendar=[];
    const line=d=>{ chat.calendar=[{id:"c1",kind:"meeting",title:"Konusma",who:"Ozlem, Berker",
      day:6,period:"Evening",certainty:"certain",done:false,detail:d}];
      return calendarContextLine(chat,"Ozlem","p_o",{bare:true})||""; };
    return {with:line("He wants to ask her straight out whether she cancelled the appointment on her own."),
            without:line("")};
  });
  ok("a purpose that was recorded reaches them whole",
     /for: He wants to ask her straight out whether she cancelled the appointment on her own\./.test(cal.with),
     cal.with);
  ok("one that was not is named as missing, not passed over in silence",
     /you genuinely do not know what it is about/.test(cal.without)&&/If it matters to you, ask/.test(cal.without),
     cal.without);
  ok("and the gap is an editable fragment like everything else", await pg.evaluate(()=>
      !!BLOCK_TPL_DEFAULTS.calendar_no_reason ));

  console.log("\n[the Gamemaster's middle move has somebody behind it]");
  ok("it decides who and why before writing the beat", await pg.evaluate(()=>{
      const t=up("gmAuthor")||"";
      return /DECIDE WHO IS BEHIND IT BEFORE YOU WRITE IT, AND PUT THEM IN THE LINE/.test(t)
        ? true : "move 2 is still anonymous"; }));
  ok("the failing beat is named as the thing not to write", await pg.evaluate(()=>{
      const t=up("gmAuthor")||"";
      return /A beat with nobody behind it is noise/.test(t)
          && /tells the people in the room nothing/.test(t) ? true : "no diagnosis of the shrug"; }));
  ok("with a beat that works shown against one that does not", await pg.evaluate(()=>{
      const t=up("gmAuthor")||"";
      return /ekranda Berker'in adı vardı/.test(t) && /Bir telefon çaldı\." is not/.test(t)
        ? true : "no worked contrast"; }));
  ok("no nameable cause means no move 2 at all", await pg.evaluate(()=>{
      const t=up("gmAuthor")||"";
      return /you do not have a move 2\. Take move 1 instead/.test(t)
        ? true : "it can still write an anonymous beat"; }));

  console.log("\n[and naming the cause did not reopen the stranger hole]");
  ok("the cause is always somebody already on the roster", await pg.evaluate(()=>{
      const t=up("gmAuthor")||"";
      return /The cause of a move 2 is always someone already on\s+the roster/.test(t)
        ? true : "the roster rule was lost"; }));
  ok("naming them is distinguished from inventing them", await pg.evaluate(()=>{
      const t=up("gmAuthor")||"";
      return /Naming the person is not inventing one/.test(t)
          && /that is still forbidden/.test(t) ? true : "the two are now confusable"; }));
  ok("they still do not arrive — that is move 3", await pg.evaluate(()=>{
      const t=up("gmAuthor")||"";
      return /they stay offstage, and nobody comes through the door unless you are taking move 3/.test(t)
        ? true : "move 2 can now bring someone in"; }));
  ok("the test for a real beat is whether the room could read it", await pg.evaluate(()=>{
      const t=up("gmAuthor")||"";
      return /could say what just happened and\s+why it matters to them/.test(t)
          && /If they could only shrug, you have not written a beat/.test(t)
        ? true : "no readability test"; }));
  ok("atmosphere for its own sake is still out", await pg.evaluate(()=>{
      const t=up("gmAuthor")||"";
      return /atmosphere for its own sake is never one/.test(t) ? true : "weather is back"; }));
  ok("and the arrival move is untouched", await pg.evaluate(()=>{
      const t=up("gmAuthor")||"";
      return /ALWAYS name them/.test(t) && /A real, completed entrance/.test(t)
          && /A mention is NOT a summons/.test(t) ? true : "move 3 lost a rule"; }));

  /* v105.1 — the same hole one level up. An offstage event's result carried a throwaway
     condition ("fine, but first let's sort out the treadmills at the gym"), and the goals curator
     promoted it to a standing ambition for BOTH men in the deal. It survived every nightly rewrite
     afterwards, so two engineers spent a dinner party arguing about gym equipment.
     The section had a floor for vagueness and none for triviality — and "concrete and gettable",
     the rule meant to stop moods, was exactly what let an errand win a slot. */
  console.log("\n[a want is not an errand]");
  ok("the bar has two ends now, not one", await pg.evaluate(()=>{
      const t=up("goalsCurator")||"";
      if(/Concrete and gettable, or concretely dreaded/.test(t))
        return "the old one-ended rule is still there";
      return /Big enough to carry, small enough to act on/.test(t)
        && /A mood is too vague to be one; an errand is too small/.test(t)
        ? true : "the floor is missing"; }));
  ok("and it is worked through on the case that found it", await pg.evaluate(()=>{
      const t=up("goalsCurator")||"";
      return /treadmills at the gym/.test(t) && /is an errand/.test(t)
        && /Thursday table/.test(t) && /is a want/.test(t)
        ? true : "the WRONG/RIGHT pair did not survive"; }));
  ok("a detail dropped inside something that happened is named as not a want", await pg.evaluate(()=>{
      const t=up("goalsCurator")||"";
      return /a snag, a chore, a condition somebody attached to a yes — is NOT a want/.test(t)
        && /not to be mined for lines/.test(t) ? true : "the mining rule is missing"; }));
  ok("with a test the model can actually apply", await pg.evaluate(()=>
      /still be carrying this a week from now, with nobody reminding them/.test(up("goalsCurator")||"") ));

  console.log("\n[and it cleans out what is already in the section]");
  ok("an errand already written in is a DROP, not a KEEP", await pg.evaluate(()=>{
      const t=up("goalsCurator")||"";
      return /it was never a want at all — a chore or an errand that got written in/.test(t)
        ? true : "the drop rule still only covers finished and stale wants"; }));
  ok("the bar is stated to cover kept lines, not only added ones", await pg.evaluate(()=>
      /applies to every line you keep, not only to lines you add/.test(up("goalsCurator")||"") ));
  ok("the settled calendar is for closing wants, not opening them", (()=>{
      const src=require('fs').readFileSync('/home/user/Multirp/index.html','utf8');
      return /Read these to CLOSE wants, not to find new ones/.test(src)
        ? true : "the WHAT THEY ALREADY DID label still reads as a source"; })());

  console.log("\n[the new bar reaches an edited copy]");
  ok("a stored copy written before this is refreshed", await pg.evaluate(()=>{
      const old=String(DEFAULT_GOALS_CURATOR).replace(
        /- Big enough to carry[^\n]*\n/,
        "- Concrete and gettable, or concretely dreaded. Not a mood.\n");
      if(old===DEFAULT_GOALS_CURATOR) return "could not build a pre-v105.1 copy to test with";
      return old.indexOf("WHAT THEY ARE AFTER")>-1 && old.indexOf("an errand is too small")<0
        ? true : "the pipe's fingerprint or marker would not match a real old copy"; }));
  ok("and the pipe is not firing against the shipped default", await pg.evaluate(()=>{
      const sp=window.__stalePipes||[];
      return !sp.some(x=>/^goalsCurator/.test(x))
        ? true : "stale: "+sp.filter(x=>/^goalsCurator/.test(x)).join(" | "); }));

  ok("no page errors", errs.length===0?true:errs.join(" | "));
  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close(); process.exit(fail?1:0);
})();
