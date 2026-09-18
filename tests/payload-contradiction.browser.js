/* v61.1 — THE PAYLOAD ARGUING WITH THE DATA.
   An audit of two live payloads found three modules asserting three different states of the same
   plot fact, and a format rule losing to an example the payload itself supplied. This test pins
   every fix in that batch, each against the failure that produced it.
   Run: node tests/payload-contradiction.browser.js */
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage({viewport:{width:412,height:915}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file:///home/user/Multirp/index.html'); await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(900);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x||c).slice(0,500));} };

  // one cast, one calendar, reused by the first three groups
  await pg.evaluate(()=>{
    const uni=state.universes[0];
    const mk=(id,name)=>({id,name,universeId:uni.id,instructions:"x",personality:"x",
      backstory:"x",style:"x",goals:"x",look:{}});
    if(!state.personas.some(p=>p.id==="p_b"))state.personas.push(mk("p_b","Burcu"));
    if(!state.personas.some(p=>p.id==="p_k"))state.personas.push(mk("p_k","Burak"));
    const chat=curChat();
    chat.gameDay=4; chat.period="Midday"; chat.timeOfDay="Midday";
    chat.calendar=[];
  });

  console.log("\n[calendar_done reports WHEN it happened, not when it was pencilled in]");
  ok("an entry stamped later than now is withheld, not asserted as lived", await pg.evaluate(()=>{
      const chat=curChat();
      chat.calendar=[{id:"c1",kind:"meeting",title:"Tell Burak the truth about last night",
        who:"Burcu, Burak",day:4,period:"Evening",done:true,completedDay:4,completedPeriod:"Evening",
        result:"She told him."}];
      return calendarDoneLine(chat,"Burcu","p_b",{bare:true})===""
        ? true : calendarDoneLine(chat,"Burcu","p_b",{bare:true}); }));
  ok("the same entry, stamped when it actually resolved, IS reported", await pg.evaluate(()=>{
      const chat=curChat();
      chat.calendar[0].completedPeriod="Morning";
      const t=calendarDoneLine(chat,"Burcu","p_b",{bare:true});
      return /Morning/.test(t)&&!/Evening/.test(t) ? true : t; }));
  ok("and a day that is today reads as earlier today, never as a time still to come",
     await pg.evaluate(()=>{
      const t=calendarDoneLine(curChat(),"Burcu","p_b",{bare:true});
      return /earlier today/.test(t) ? true : t; }));
  ok("the reconciler is asked for the hour and validates it against the period list",
     await pg.evaluate(()=>/ALSO give "period"/.test(DEFAULT_CAL_RECONCILE)
       && /PERIODS\.includes\(r\.period\)/.test(String(reconcileCalendarDay))));
  ok("a completed result is trimmed on a word boundary, never mid-word", await pg.evaluate(()=>
      !/String\(r\.result\|\|""\)\.trim\(\)\.slice/.test(String(reconcileCalendarDay))
   && /briefDesc\(String\(r\.result/.test(String(reconcileCalendarDay))));

  console.log("\n[a goal the calendar says is done is not a goal]");
  ok("a want a finished entry settles leaves the section", await pg.evaluate(()=>{
      const B=state.personas.find(p=>p.id==="p_b");
      B.goalsLive={lines:["Tell Burak the truth about last night with Emre.",
                          "Keep Aslan out of all of it."],day:3,at:Date.now()};
      const live=liveGoalsLines(B);
      return live.length===1 && /Aslan/.test(live[0]) ? true : JSON.stringify(live); }));
  ok("but the stored list is untouched, and the curator still sees the raw one",
     await pg.evaluate(()=>{
      const B=state.personas.find(p=>p.id==="p_b");
      return B.goalsLive.lines.length===2 && liveGoalsLines(B,{raw:true}).length===2; }));
  ok("nothing is suppressed by an entry the character is not even being told about yet",
     await pg.evaluate(()=>{
      const B=state.personas.find(p=>p.id==="p_b");
      curChat().calendar[0].completedPeriod="Evening";        // back into the future
      const n=liveGoalsLines(B).length;
      curChat().calendar[0].completedPeriod="Morning";
      return n===2 ? true : "suppressed anyway ("+n+" of 2)"; }));
  ok("the curator is handed what already happened, with a rule attached to it",
     await pg.evaluate(()=>/WHAT THEY ALREADY DID/.test(String(_curateGoalsFor))
       && /WHAT THEY ALREADY DID names it as finished/.test(DEFAULT_GOALS_CURATOR)));
  ok("and so is the drives writer, which reads the current want-list rather than the frozen field",
     await pg.evaluate(()=>/bits\.done=settledEventLines/.test(String(_writePsyche))
       && /engineGoals\(p,400\)/.test(String(_writePsyche))
       && /ALREADY HAPPENED means already happened/.test(DEFAULT_PSYCHE)));
  /* v62.1 — and all three read ONE source, so a resolved quest cannot be settled for the drives
     writer and still pending for the goal list. */
  ok("the goal filter, the curator and the drives writer share one settled-event source",
     await pg.evaluate(()=>/settledEventLines/.test(String(_goalsSettledTexts))
       && /settledEventLines/.test(String(_curateGoalsFor))
       && /settledEventLines/.test(String(_writePsyche))));
  ok("and it reads the pursuits and the world quests, not only the calendar",
     await pg.evaluate(()=>{
      const src=String(settledEventLines);
      return /_charQuests/.test(src) && /gameData&&uni\.gameData\.quests/.test(src)
          && /calendarDoneLine/.test(src); }));
  ok("a resolved pursuit settles the goal that describes it", await pg.evaluate(()=>{
      const B=state.personas.find(p=>p.id==="p_b");
      const uni=state.universes[0];
      const gd=uni.gameData=(uni.gameData&&typeof uni.gameData==="object")?uni.gameData:{};
      gd.charQuests=[{id:"cq1",holderId:"p_b",title:"Get Burak to look at me the way he used to",
        status:"done",completedDay:4,result:"He did."}];
      B.goalsLive={lines:["Get Burak to look at me the way he used to.",
                          "Keep Aslan out of all of it."],day:3,at:Date.now()};
      const live=liveGoalsLines(B);
      gd.charQuests=[];
      return live.length===1 && /Aslan/.test(live[0]) ? true : JSON.stringify(live); }));

  console.log("\n[the example stops beating the rule]");
  ok("the LIMITS rule is in the solo and multi layouts, not only in gm", await pg.evaluate(()=>{
      const miss=["solo","multi","gm"].filter(k=>ptPreset(k).indexOf("{{call//head_format_limits}}")<0);
      return miss.length?miss.join(", "):true; }));
  ok("and it is the rule that caps the beats", await pg.evaluate(()=>
      /At most ONE narration and ONE thought per reply/.test(blkTpl("head_format_limits"))));
  ok("the older quoted line is a gist, and says so rather than showing a shape",
     await pg.evaluate(()=>/in gist/.test(blkTpl("already_said_shortened"))
       && !/shape/.test(blkTpl("already_said_shortened"))));
  /* v62.1 — and the NEWEST line too. The verbatim slot was the road every format error travelled:
     the character's own last reply, reproduced exactly, a few hundred characters from generation,
     and the strongest evidence in the payload about what a reply looks like. A gist carries the
     anti-repeat signal without carrying the shape. The two prose paragraphs that used to argue
     against the exemplar go with it — a rule that never wins teaches that the rules are advisory. */
  ok("every quoted line is a gist — the verbatim slot is gone entirely", await pg.evaluate(()=>
      !("already_said_verbatim" in BLOCK_TPL_DEFAULTS)
   && !/already_said_verbatim/.test(String(buildTailBlocks))));
  ok("and the two paragraphs that used to argue with the example are gone", await pg.evaluate(()=>
      !("already_said_not_style" in BLOCK_TPL_DEFAULTS)
   && !/already_said_not_style/.test(String(buildTailBlocks))));
  ok("the block no longer calls its own quotes word-for-word", await pg.evaluate(()=>
      /in gist/.test(blkTpl("already_said_instr")) && !/word for word/.test(blkTpl("already_said_instr"))));

  console.log("\n[the channel normalizer repairs a malformed turn before it is stored]");
  ok("underscores doing narration's job are re-delimited", await pg.evaluate(()=>{
      const out=normalizeChannels('"Selam." _elini masaya koyuyor._');
      return /\*elini masaya koyuyor\.\*/.test(out) && !/_/.test(out) ? true : out; }));
  ok("a reply that already uses the narration channel is untouched", await pg.evaluate(()=>{
      const src='*Elini kaldiriyorum.* "Selam." _Bunu neden yaptim._';
      return normalizeChannels(src)===src ? true : normalizeChannels(src); }));
  ok("a snake_case word is not a thought and is not converted", await pg.evaluate(()=>{
      const src='"Dosya adi build_step_two olmali."';
      return normalizeChannels(src)===src ? true : normalizeChannels(src); }));
  ok("heat is exempt — its own format forbids asterisks, so the test fires on every beat",
     await pg.evaluate(()=>{
      const src='"Ah—" _Dayanamiyorum._';
      return normalizeChannels(src,{heat:true})===src ? true : normalizeChannels(src,{heat:true}); }));
  ok("and all three spoken paths run it before storing", await pg.evaluate(()=>{
      const miss=[];
      if(!/normalizeChannels\(stripChannelLabel\(reply\)\)/.test(String(sendMessage))) miss.push("solo");
      if(!/normalizeChannels\(/.test(String(playCharacterTurn))) miss.push("multi/heat");
      if(!/\{heat:_wasHeat\}/.test(String(playCharacterTurn))) miss.push("multi heat-exempt");
      return miss.length?miss.join(", "):true; }));

  console.log("\n[exposure is not leak-chance]");
  ok("a public venue never reads as private, however quiet its corner", await pg.evaluate(()=>{
      const pub={id:"l_pub",name:"Beach Club",type:"venue"};
      const lab=exposureLabel(pub,0.05);
      return /semi-public/.test(lab) ? true : lab; }));
  ok("a home still does", await pg.evaluate(()=>{
      const home={id:"l_h",name:"Atan Residence",type:"home"};
      return /private \(nothing said here gets out\)/.test(exposureLabel(home,0)) ? true
           : exposureLabel(home,0); }));
  ok("and a genuinely public one is not floored downward", await pg.evaluate(()=>
      /very public/.test(exposureLabel({type:"venue"},0.9))));
  ok("alone at a public place says strangers are there; alone at home does not",
     await pg.evaluate(()=>/PUBLIC place/.test(blkTpl("scene_alone_public"))
       && !/PUBLIC place/.test(blkTpl("scene_alone"))
       && /scene_alone_public/.test(String(buildTailBlocks))));

  console.log("\n[a claim over a person is not a word you are owed]");
  ok("an unrecognised kind is dropped rather than filed as a promise", await pg.evaluate(()=>{
      const chat=curChat(); chat.promises=[];
      const r=recordPromise(chat,{holder:"Burcu",to:state.user,promise:"he does not stop",kind:""},4);
      return r===null && chatPromises(chat).length===0 ? true : JSON.stringify(r); }));
  ok("a real commitment still records", await pg.evaluate(()=>{
      const chat=curChat();
      const r=recordPromise(chat,{holder:"Burcu",to:state.user,promise:"never to lie to you again",
        kind:"prohibition",ask:"because it would start the whole thing again",
        shows_as:"the next time he asks her where she was"},4);
      return !!r && r.kind==="prohibition" && /where she was/.test(r.showsAs||"")
        ? true : JSON.stringify(r); }));
  /* v62.1 — a commitment that constrains no later turn is not one. Asking the extractor to NAME
     the moment is the cheapest real test available, and the entries that failed it are exactly the
     ones reaching "WHAT WAS SWORN TO YOU" as narration or as a claim over a person. */
  ok("a commitment that names no future moment is not recorded", await pg.evaluate(()=>{
      const chat=curChat();
      const a=recordPromise(chat,{holder:"Burcu",to:state.user,promise:"to be better",
        kind:"change",shows_as:""},4);
      const b=recordPromise(chat,{holder:"Burcu",to:state.user,promise:"to be better",
        kind:"change",shows_as:"always"},4);
      return (a===null&&b===null) ? true : JSON.stringify([a,b]); }));
  ok("the schema and the purge pass both ask for it", await pg.evaluate(()=>
      /"shows_as"/.test(DEFAULT_PROMISES) && /shows_as/.test(DEFAULT_PROMISE_PURGE)));
  ok("the purge pass is registered, editable, and mapped to its own card", await pg.evaluate(()=>
      !!PROMPT_BY_KEY.promisePurge && typeof up("promisePurge")==="string"
   && ENGINE_PAYLOAD_DEFS.some(d=>(d.blocks||[]).some(b=>b&&b.promptKey==="promisePurge"))));
  ok("and it runs once per chat, before the extractor", await pg.evaluate(()=>
      /await runPromisePurge\(chat\)/.test(String(runPromiseEngine))
   && /chat\._prPurged/.test(String(runPromisePurge))));

  console.log("\n[one copy of each thing]");
  ok("a superseded decision stops being read back as current", await pg.evaluate(()=>{
      const before=visibleMemories().length;
      state.memory.push({id:"m_sup",ownerId:"p_b",character:"Burcu",type:"DECISION",
        content:"I am not going back to that house.",gameDay:3,gamePeriod:"Night",
        universeId:state.universes[0].id,date:Date.now(),superseded:true});
      const after=visibleMemories().filter(m=>m.id==="m_sup").length;
      state.memory=state.memory.filter(m=>m.id!=="m_sup");
      return after===0 ? true : "superseded memory still injected"; }));
  ok("the reconciler is what marks it, from the stretch that reversed it", await pg.evaluate(()=>
      /_liveDecisionsFor/.test(String(reconcilePeriodFor))
   && /supersedes/.test(String(reconcilePeriodFor))
   && /WHAT THIS STRETCH REVERSED/.test(DEFAULT_MEMRECONCILE)));
  ok("the stance of whoever the turn is aimed at is stated once, in feelings",
     await pg.evaluate(()=>/stanceElsewhere/.test(String(relSheetBlockFull))
       && /_feelHasSettled/.test(String(buildCharPromptBlocks))));
  ok("and a private aim the goal list already carries is not restated beside it",
     await pg.evaluate(()=>/liveGoalsLines\(_selfP\)/.test(String(intentParts))));
  ok("the extractor is told what a claim over a person is", await pg.evaluate(()=>
      /A CLAIM OVER A PERSON/.test(DEFAULT_PROMISES)
   && /Who is BOUND, and what did THEY undertake to do/.test(DEFAULT_PROMISES)));
  ok("and the heading no longer invites a claim to be read as an oath", await pg.evaluate(()=>
      /claim somebody made ABOUT you/.test(blkTpl("promise_owed"))));

  console.log("\n[a tracker a character cannot act on]");
  ok("a staged tracker that has reached no stage is withheld from its owner", await pg.evaluate(()=>{
      const uni=state.universes[0];
      uni.trackers=[{id:"t_p",name:"Pregnancy",owner:"__story__",min:0,max:280,start:0,
        behavior:"up",method:"trigger_then_day",
        stages:[{at:1,text:"newly conceived (unaware)"},{at:90,text:"visibly showing"}]}];
      state.trackOn=true;
      const chat=curChat(); chat.trackerVals={};
      const t=trackerContext(chat,"p_b");
      return t.indexOf("Pregnancy")===-1 ? true : t; }));
  ok("once a stage is reached it is shown in words, with no raw count", await pg.evaluate(()=>{
      const chat=curChat(); const tr=curTrackers()[0];
      setTrackerValOwner(chat,tr,"__story__",120);
      const t=trackerContext(chat,"p_b");
      return /visibly showing/.test(t) && !/120/.test(t) && !/280/.test(t) ? true : t; }));
  ok("the director's omniscient view keeps the arithmetic", await pg.evaluate(()=>{
      const t=trackerContext(curChat(),null);
      return /120/.test(t) ? true : t; }));

  console.log("\n[a narrator beat is not something this character wrote]");
  ok("world beats, presence notes and day markers leave the assistant role", await pg.evaluate(()=>{
      const a=mapMsgToApi({narratorEvent:true,content:"— The wind got up. —"});
      const b=mapMsgToApi({presenceNote:true,content:"— Emre has arrived —"});
      const c=mapMsgToApi({dayMarker:true,content:"Day 5",narration:"Morning."});
      return [a,b,c].every(m=>m.role==="user"&&m.name==="Narrator") ? true : JSON.stringify([a,b,c]); }));
  ok("and stay self-identifying without the name, which some providers drop", await pg.evaluate(()=>
      /^\[NARRATION/.test(mapMsgToApi({narratorEvent:true,content:"x"}).content)));
  ok("a character's own line is untouched", await pg.evaluate(()=>{
      const m=mapMsgToApi({role:"assistant",speaker:"Burcu",content:"Selam."});
      return m.role==="assistant"&&m.name==="Burcu" ? true : JSON.stringify(m); }));

  console.log("\n[resistance ships when something was asked, and not otherwise]");
  /* v62.1 — v61.1 gated only the physical-ask clause and left the ~900-word ladder shipping every
     turn. On a turn where nothing was asked it had nothing to apply to, and the cheapest way to
     satisfy a wall of rules about holding out is to act as though there were something to hold out
     against. The gate FAILS OPEN at every step: a question, a stall, a live pursuit or an
     unreadable line all keep it. What it excludes is the turn that answers a statement. */
  ok("the whole block is gated, not just the physical-ask clause", await pg.evaluate(()=>
      /if\(_asked\)\{/.test(String(buildTailBlocks))
   && /_physical && blkTpl\("resistance_actions"\)/.test(String(buildTailBlocks))));
  ok("and the physical half still reads a BOUNDED window", await pg.evaluate(()=>
      /slice\(-6\)/.test(String(buildTailBlocks))
   && !/_psycheBodySig\(chat\)/.test(String(buildTailBlocks))));
  ok("every uncertain case fails open — a question, a stall, a pursuit, an unreadable line",
     await pg.evaluate(()=>{
      const src=String(buildTailBlocks);
      return /if\(!_answering\) return true;/.test(src)
          && /\[\?\uff1f\]/.test(src)
          && /exchangeIsStalled\(chat,selfP\)/.test(src)
          && /charQuestSheetLines/.test(src)
          && /catch\(e\)\{ return true; \}/.test(src); }));
  ok("the self-gating paragraph is gone from the text, now that code decides",
     await pg.evaluate(()=>!/THIS ONLY APPLIES IF SOMETHING WAS ACTUALLY ASKED/.test(blkTpl("resistance_body"))));
  ok("and the duplicate heading is gone from every layout", await pg.evaluate(()=>
      ["solo","multi","gm","text","heat"].every(k=>ptPreset(k).indexOf("{{call//head_resistance}}")<0)));

  console.log("\n[the absence note answers direct address, not any mention]");
  /* Merely MENTIONING somebody who is not here is how people talk about other people, and it was
     raising a paragraph of "do NOT reply AS them" every time a name came up — on turns where
     nobody was going to. The note earns its place when the player is TALKING TO the absent person,
     which is what it was written for. An unparseable name fails open and keeps it. */
  const _absence=async (line)=>pg.evaluate((line)=>{
      const uni=state.universes[0];
      const mk=(id,name)=>({id,name,universeId:uni.id,instructions:"x",personality:"x",
        backstory:"x",style:"x",goals:"x",look:{}});
      if(!state.personas.some(p=>p.id==="p_z"))state.personas.push(mk("p_z","Deniz"));
      const chat=curChat(); chat.presentIds=["p_b"];
      chat.messages=[{mid:"z1",role:"user",content:line,present:["p_b"]}];
      const B=state.personas.find(p=>p.id==="p_b");
      const T=buildTailBlocks({chat,selfP:B,selfId:B.id,selfName:B.name,targetName:state.user,
        targetId:"__user__",multi:false,injected:{recent:[],diary:[],longterm:[]}});
      return !!(T._rg&&T._rg.guidance_absence);
    },line);
  ok("addressed by name → the note fires", await _absence("Deniz, neredesin?")===true);
  ok("asked after in the third person → it does not",
     await _absence("Deniz bu aksam nerede acaba?")===false);
  ok("not mentioned at all → it does not", await _absence("Bugun hava guzel.")===false);

  console.log("\n[the tracker block speaks to a person]");
  ok("no shouting in the heading or the group labels", await pg.evaluate(()=>{
      const uni=state.universes[0];
      uni.trackers=[{id:"t_l",name:"Love",owner:"__story__",min:0,max:100,start:0,behavior:"free",
        stages:[{at:0,text:"indifferent"},{at:45,text:"clearly attracted"}]}];
      state.trackOn=true;
      const chat=curChat(); chat.trackerVals={};
      const rendered=blkTpl("trackers_header")+"\n"+trackerContext(chat,"p_b");
      return !/YOUR TRACKERS|STORY TRACKERS|YOUR PERSONAL TRACKERS|PUBLICLY VISIBLE/.test(rendered)
          && /True of this story/.test(rendered)
        ? true : rendered.slice(0,240); }));
  ok("and the debug capsule splitter follows the new labels", await pg.evaluate(()=>
      /True of this story/.test(String(_subCapsules))));

  console.log("\n[a fragment's own blank line does not leak out of a dropped block]");
  /* The four byte-identity failures across parity-live, bare-pieces, video-cues and language-rule
     were all this: `drive_ego` is inlined into the template as fixed prose, it contains a blank
     line, and that blank line split the one paragraph the auto-drop needs in order to remove the
     whole piece. So the closing note shipped on every turn the psyche engine had not written for. */
  ok("inlined prose keeps its blank lines as {{gap}}, which stays inside the paragraph",
     await pg.evaluate(()=>{
      const t=ptPieceTemplate("drives","solo");
      return !/\n[ \t]*\n/.test(t) && /\{\{gap\}\}/.test(t) ? true : JSON.stringify(t).slice(0,300); }));
  ok("so a turn with no drives at all ships none of the block", await pg.evaluate(()=>{
      const chat=curChat(); delete chat._psyche;
      const P=state.personas.find(p=>p.id==="p_b");
      const B=buildTailBlocks({chat,selfP:P,selfId:P.id,selfName:P.name,targetName:state.user,
        targetId:"__user__",multi:false,injected:{recent:[],diary:[],longterm:[]}});
      return !B.drives ? true : B.drives.slice(0,200); }));

  console.log("\n[one copy of each rule, in the place it fires hardest]");
  ok("do-not-recap is stated once, under the quoted line", await pg.evaluate(()=>{
      const n=["last_line_footer","guidance_reply"].filter(k=>/do not recap|never by repeating it back/i.test(blkTpl(k)));
      const heading=["solo","multi","gm","text","heat"].some(k=>ptPreset(k).indexOf("{{call//head_react_not_recap}}")>-1);
      return (n.length===1 && n[0]==="last_line_footer" && !heading) ? true
           : JSON.stringify({n,heading}); }));
  ok("who the turn is aimed at is asserted once, at the generation point", await pg.evaluate(()=>{
      const said=["target_player","target_char"].filter(k=>/aimed at/i.test(blkTpl(k)));
      return (said.length===0 && /aimed at/i.test(blkTpl("guidance_target"))) ? true
           : JSON.stringify(said); }));
  ok("and the per-module recitation bans are gone — rail_indirect covers them", await pg.evaluate(()=>{
      const bad=["mem_recent_instr","calendar_done_header","quest_intro","trackers_header"]
        .filter(k=>/never recite|never read one out|never list them/i.test(blkTpl(k)));
      return bad.length===0 && /never as an announcement/i.test(blkTpl("rails_header"))
        ? true : JSON.stringify(bad); }));
  ok("the wearing line states the outfit and attaches no rule to it", await pg.evaluate(()=>
      !/do not describe/i.test(blkTpl("bio_wearing_self"))));

  console.log("\n[the voice machinery stays out of the prose]");
  ok("a delivery tag is stripped from anything quoted back", await pg.evaluate(()=>{
      const out=stripDeliveryTags('"[say quietly with a low tone] Gelmeyecegini dusunmustum." <break>');
      return !/\[|\]|</.test(out) && /Gelmeyecegini/.test(out) ? true : out; }));
  ok("and both quoting blocks run it", await pg.evaluate(()=>
      /stripDeliveryTags\(x\)/.test(String(buildTailBlocks))
   && /stripDeliveryTags\(line\.text\)/.test(String(buildTailBlocks))));
  ok("directions are prosody, never an emotion label", await pg.evaluate(()=>
      /Never name the emotion/.test(blkTpl("voice_delivery"))
   && /never spend the reply's one narration beat on the voice/.test(blkTpl("voice_delivery"))));

  console.log("\n[a dated word lives in one block]");
  ok("a meeting the reader themselves swore to drops from the calendar", await pg.evaluate(()=>{
      const chat=curChat(); chat.gameDay=4; chat.period="Midday";
      chat.calendar=[{id:"c9",kind:"meeting",title:"Come to the hearing",who:"Burcu",day:5,period:"Morning"}];
      chat.promises=[{id:"pr9",status:"open",holderId:"p_b",holderName:"Burcu",toId:"__user__",
        toName:state.user,promise:"to come to the hearing",kind:"promise",weight:"binding",day:3}];
      const withPromise=calendarContextLine(chat,"Burcu","p_b",{bare:true});
      chat.promises=[];
      const without=calendarContextLine(chat,"Burcu","p_b",{bare:true});
      return (!/hearing/i.test(withPromise) && /hearing/i.test(without)) ? true
           : JSON.stringify({withPromise,without}); }));

  console.log("\n[the narrator speaks the story's language]");
  ok("the movement logs are fragments, not hard-coded English", await pg.evaluate(()=>
      ["narr_move_self","narr_move_with","narr_move_char"].every(k=>k in BLOCK_TPL_DEFAULTS)
   && /blkTpl\("narr_move_self"\)/.test(String(syncPlayerSubArea))));
  ok("and the guardrail written against the app's own example is gone", await pg.evaluate(()=>
      !/the narrator's/.test(blkTpl("rails_header"))
   && /never put words in .*mouth/.test(blkTpl("rails_header"))));

  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log("\n  "+pass+" passed, "+fail+" failed");
  await b.close();
  process.exit(fail?1:0);
})();
