/* v37.2 — from a live debug export: an event kicked, the player wrote "we watched the film and went
   outside", and from there Hakan never answered again while the event kept narrating around him —
   putting words in the PLAYER's mouth and moving a buzzing phone out of Hakan's pocket into his.
   One mis-read emptied the scene; the silence and the drift followed from it.
   Also: the "you don't know them yet" block is gone, and feelings read as sentences. */
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x||c).slice(0,400));} };
  const ctx=await b.newContext({viewport:{width:412,height:915},hasTouch:true,isMobile:true});
  const pg=await ctx.newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file:///home/user/Multirp/index.html'); await pg.waitForTimeout(2300);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(800);
  await pg.evaluate(()=>{
    const uni=state.universes[0];
    if(!state.personas.some(p=>p.id==="p_h"))
      state.personas.push({id:"p_h",name:"Hakan",universeId:uni.id,instructions:"x",personality:"x",
        backstory:"x",style:"x",goals:"x",look:{}});
    state.user="Emre";
    const chat=curChat(); chat.presentIds=["p_h"]; chat.messages=[];
    markChatDirty(chat);
  });

  console.log("\n[leaving WITH the player is not leaving the player]");
  ok("the tracker is told so, in as many words", await pg.evaluate(()=>
      /LEAVING \*\*WITH\*\*/.test(DEFAULT_PRESENCE_TRACKER)));
  ok("it names the test to apply", await pg.evaluate(()=>
      /still standing next to them/.test(DEFAULT_PRESENCE_TRACKER)));
  ok("and gives the phrasings that caused it", await pg.evaluate(()=>
      /we went outside/.test(DEFAULT_PRESENCE_TRACKER) && /çıktık/.test(DEFAULT_PRESENCE_TRACKER)));
  ok("a stored copy of the old default is migrated, not kept", await pg.evaluate(()=>
      !(window.__stalePipes||[]).some(x=>/presencePrompt/.test(x))
        ? true : "the pipe stood down: "+JSON.stringify(window.__stalePipes)));

  console.log("\n[an empty room says it is empty]");
  ok("the notice helper exists and is used by both turn paths", await pg.evaluate(()=>
      typeof noteNobodyHere==="function"
      && /noteNobodyHere/.test(String(sendMessage))
      && /noteNobodyHere/.test(String(runMultiCharTurn))));
  ok("it posts a player-only line when nobody is present", await pg.evaluate(()=>{
      const chat=curChat(); chat.presentIds=[]; chat.messages=[];
      noteNobodyHere(chat);
      const m=chat.messages[chat.messages.length-1];
      return (m && m.uiNote===true && /Nobody is here|alone in the/.test(m.content))
        ? true : JSON.stringify(m&&m.content); }));
  ok("that line is never sent to a model", await pg.evaluate(()=>{
      const chat=curChat();
      const p=(state.personas||[]).find(x=>x.id==="p_h");
      const h=castHistory(chat,p);
      return !h.some(m=>/Nobody is here/.test(String(m.content||"")))
        ? true : "the notice reached the payload"; }));
  ok("it tells you where to go to fix it", await pg.evaluate(()=>{
      const chat=curChat(); chat.messages=[]; chat.presentIds=[];
      noteNobodyHere(chat);
      return /Who is here/.test(chat.messages[0].content); }));

  console.log("\n[the scene writer narrates and nothing else]");
  ok("it may not write anyone's dialogue", await pg.evaluate(()=>
      /YOU DO NOT SPEAK FOR ANYONE/.test(DEFAULT_SCENE_WRITER)));
  ok("and least of all the player's", await pg.evaluate(()=>
      /IS NOT YOURS AT ALL/.test(DEFAULT_SCENE_WRITER)));
  ok("it must hold the physical facts it was given", await pg.evaluate(()=>
      /HOLD THE PHYSICAL FACTS/.test(DEFAULT_SCENE_WRITER) && /pocket/.test(DEFAULT_SCENE_WRITER)));
  ok("its migration pipe is live, not stale", await pg.evaluate(()=>
      !(window.__stalePipes||[]).some(x=>/YOU NARRATE/.test(x))
        ? true : JSON.stringify(window.__stalePipes)));

  console.log("\n[nobody is told they don't know someone they have slept with]");
  ok("the stranger block is gone from the fragments", await pg.evaluate(()=>
      BLOCK_TPL_DEFAULTS.stranger===undefined));
  ok("so is its matching guardrail", await pg.evaluate(()=>
      BLOCK_TPL_DEFAULTS.rail_consistent_stranger===undefined));
  ok("neither is listed on any block any more", await pg.evaluate(()=>{
      const all=JSON.stringify(REPLY_BLOCKS);
      return (all.indexOf("rail_consistent_stranger")===-1 && all.indexOf('"stranger"')===-1)
        ? true : "still referenced"; }));
  ok("a character with no scored relationship gets no such notice", await pg.evaluate(()=>{
      const chat=curChat(); chat.presentIds=["p_h"];
      const f=feelingsBlock(chat,"p_h","__user__",state.user);
      return !/DON'T KNOW/.test(f.text||"") ? true : f.text.slice(0,160); }));
  ok("the payload never carries the phrase again", await pg.evaluate(()=>{
      const chat=curChat();
      const p=(state.personas||[]).find(x=>x.id==="p_h");
      const B=buildCharPromptBlocks(p,[],{},state.user,{chat,targetName:state.user,targetId:"__user__"});
      return !/DON'T KNOW/.test(JSON.stringify(B)) ? true : "still in the payload"; }));

  console.log("\n[feelings read as a state, not a row of labels]");
  // the exact shape from the report: hatred, distrust, well known, and a hot spike on top
  await pg.evaluate(()=>{
      const o=relObj(curChat(),"p_h","__user__");
      o.affection=-55; o.trust=-40; o.respect=-20; o.familiarity=60; o.jealousy=0;
      o.st={desire:-50,comfort:-60,fear:55,agitation:60};
      o.desc=""; });
  ok("no semicolon-welded axis labels", await pg.evaluate(()=>{
      const o=relObj(curChat(),"p_h","__user__");
      const v=relFeelSummary(o);
      return !/clearly repulsion|strongly fear\/tension|provoked & angry/.test(v)
        ? true : "still a stat sheet: "+v; }));
  ok("it opens on the strongest settled feeling, in words", await pg.evaluate(()=>{
      const o=relObj(curChat(),"p_h","__user__");
      const v=relConsideredNarrative(o);
      return /^you cannot stand them/.test(v) ? true : v; }));
  ok("familiarity never leads — it is how well you know them, not how you feel", await pg.evaluate(()=>{
      const o=relObj(curChat(),"p_h","__user__");
      const v=relConsideredNarrative(o);
      return !/^you know them/.test(v) ? true : "familiarity led: "+v; }));
  ok("but it still leads when it is genuinely all there is", await pg.evaluate(()=>{
      const o={familiarity:60,affection:0,trust:0,respect:0,jealousy:0,st:{}};
      return /^you know them/.test(relConsideredNarrative(o))
        ? true : relConsideredNarrative(o); }));
  ok("the rest run underneath rather than beside", await pg.evaluate(()=>{
      const o=relObj(curChat(),"p_h","__user__");
      return /Underneath that:/.test(relConsideredNarrative(o)); }));
  ok("it never starts by saying neutral and then contradicting itself", await pg.evaluate(()=>{
      const v=relFeelSummary(relObj(curChat(),"p_h","__user__"));
      return !/^neutral;/.test(v) ? true : v; }));
  ok("a flat relationship still says something honest", await pg.evaluate(()=>{
      const o={affection:0,trust:0,respect:0,familiarity:0,jealousy:0,st:{}};
      return /nothing has formed/.test(relFeelSummary(o)); }));
  ok("every slow axis has words for both poles at four strengths", await pg.evaluate(()=>{
      for(const k of REL_SLOW){
        const t=REL_SLOW_FEEL[k];
        if(!t) return k+" has no wording";
        if(t.pos.length!==4||t.neg.length!==4) return k+" is not four bands each way";
        if(t.pos.concat(t.neg).some(x=>!String(x).trim())) return k+" has a blank band";
      }
      return true; }));
  ok("the lasting block in the payload uses it", await pg.evaluate(()=>{
      const chat=curChat();
      const f=feelingsBlock(chat,"p_h","__user__",state.user);
      return !/hatred;|deep distrust;/.test(f.text||"") ? true : f.text.slice(0,200); }));

  /* v69.1 — THE EVENT'S TYPE REACHES THE WRITER. The classifier has always returned it and the
     event has always carried it, but it stopped at the event record: the writer got the summary
     and the turn budget and had to infer from prose whether this was someone arriving, a sound
     from the next room, or something that moved elsewhere. So an environment beat drew the full
     character budget and a turn minimum it had nothing to spend on — and the writer filled the gap
     the only way it could, by inventing a person to carry the sound. */
  console.log("\n[the classifier's event type reaches the scene writer]");
  {
    const src=require('fs').readFileSync('/home/user/Multirp/index.html','utf8');
    ok("the default takes a type placeholder", await pg.evaluate(()=>
        up("sceneWriter").indexOf("{{type}}")>=0));
    ok("and branches on all three kinds", await pg.evaluate(()=>{
        const t=up("sceneWriter");
        const miss=["**offstage**","**environment**","**character**"].filter(x=>t.indexOf(x)<0);
        return miss.length===0?true:"missing "+miss.join(", "); }));
    ok("every placeholder it uses is one the call site fills", await pg.evaluate(()=>{
        const used=[...new Set((up("sceneWriter").match(/\{\{[a-z_]+\}\}/g)||[]))];
        const filled=["{{user}}","{{summary}}","{{turn}}","{{min}}","{{max}}","{{type}}"];
        const un=used.filter(x=>!filled.includes(x));
        return un.length===0?true:"never filled: "+un.join(", "); }));
    ok("it renders with nothing left unsubstituted", await pg.evaluate(()=>{
        const out=fillTpl(up("sceneWriter"),
          {user:"Emre",summary:"a knock",turn:1,min:3,max:8,type:"environment"});
        const left=out.match(/\{\{[a-z_]+\}\}/g)||[];
        return left.length===0?true:"left: "+left.join(", "); }));
    ok("no refresh pipe stood down", await pg.evaluate(()=>{
        const sp=window.__stalePipes||[];
        return sp.length===0?true:"stale: "+sp.join(", "); }));

    // the wire itself: drive runSceneWriter and read the system prompt it sends
    const sent=t=>pg.evaluate(async ty=>{
      state.key="k"; state.sceneOn=true;
      window.__sys="";
      window.fetch=async(u,init)=>{ let b2={};try{b2=JSON.parse(init.body)}catch(e){}
        const sys=(b2.messages||[]).filter(m=>m.role==="system").map(m=>m.content).join("\n");
        if(sys) window.__sys=sys;
        return {ok:true,status:200,
          json:async()=>({choices:[{message:{content:JSON.stringify(
            {narration:"n",bring_in:null,resolved:true,resolution:"done"})}}]}),
          text:async()=>"x"}; };
      const u=(state.universes||[])[0];
      const chat={id:"cs"+Math.random(),universeId:u.id,gameDay:1,messages:[
          {role:"user",content:"hi",present:[]}],presentIds:[],rel:{},
        activeEvent:{summary:"a phone rang twice",type:ty,turn:1,minTurns:3,maxTurns:8,
                     resolved:false,participant:null}};
      state.chats=state.chats||{}; state.chats[chat.id]=chat; state.curChat=chat.id;
      try{ await runSceneWriter(chat); }catch(e){ return "THREW: "+e.message; }
      return window.__sys;
    },t);
    for(const ty of ["character","environment","offstage"]){
      const sys=await sent(ty);
      ok('an "'+ty+'" event tells the writer so',
         (typeof sys==="string" && new RegExp("Event type: "+ty+" ").test(sys))
           ? true : "the prompt did not name it: "+String(sys).slice(0,160));
    }
    ok("an event with no type still reads as a character event", await (async()=>{
        const sys=await sent(undefined);
        return /Event type: character /.test(String(sys))
          ? true : "fell through to: "+String(sys).slice(0,160); })());
    ok("the classifier keeps offstage instead of flattening it",
       /_t==="character"\|\|_t==="environment"\|\|_t==="offstage"/.test(src)
         ? true : "the setup path still collapses the type");
    ok("and an unrecognised type lands on environment, not character",
       /\)\?_t:"environment"/.test(src)?true:"unknown types do not default safely");
  }

  /* v73.1 — THE MINIMUM WAS SWALLOWING A SATISFIED ASK. The engine read
     `resolved && ev.turn>=ev.minTurns`, so a writer returning "resolved": true before the floor had
     its answer discarded and the event stayed open. In a traced scene the player granted the want
     on his first opportunity, the writer resolved on turn 2 of 3, the engine dropped it, and turn 3
     fired forty-three seconds later and resolved the same tension a second time with a
     near-duplicate narration. */
  console.log("\n[a satisfied ask closes the event, whatever the turn]");
  {
    const src=require('fs').readFileSync('/home/user/Multirp/index.html','utf8');
    ok("the resolve branch no longer gates on the minimum",
       /\n    if\(resolved\)\{\n      \/\/ For a confrontation/.test(src)
         ? true : "the min gate is still in front of resolveActiveEvent");
    ok("the judged kinds keep their own thresholds",
       (src.match(/if\(ev\.turn>=ev\.minTurns && c<=0\.2[85]\)/g)||[]).length===2
         ? true : "the confrontation/overture thresholds changed");
    ok("a turn asked of an already-resolved event is refused and logged",
       /a turn was requested for an already-resolved event/.test(src)
         ? true : "a resolved event can still be asked for another beat");
    ok("the early-turn note no longer tells it to fill turns", await pg.evaluate(()=>
        !/may NOT resolve yet/.test(document.documentElement.innerHTML)));
    ok("and the prompt states the win condition", await pg.evaluate(()=>{
        const t=up("sceneWriter");
        return /IF THE WANT IS GRANTED, THE EVENT RESOLVES ON THAT TURN/.test(t)
            && /re-confirming something already agreed is not a beat/.test(t)
          ? true : "the granted-want rule is not in the shipped default"; }));
    ok("no refresh pipe stood down", await pg.evaluate(()=>{
        const sp=window.__stalePipes||[];
        return sp.length===0?true:"stale: "+sp.join(", "); }));
  }

  /* v73.1 — the arc tracker can answer "finished" more than once inside one scene; each close wrote
     its own memory, and the exact-text guard never caught them because two accounts of one event
     are near-duplicates rather than identical. */
  console.log("\n[the same beat is not written to the bank twice]");
  {
    const setup=()=>pg.evaluate(()=>{
      state.memory=(state.memory||[]).filter(m=>m&&m.ownerId!=="o_dup");
      state.memory.push({id:"md_1",ownerId:"o_dup",character:"O",
        content:"We agreed to meet at five in the salon after she finishes at the gym.",
        gameDay:4,gamePeriod:"Evening",people:["Emre"],importance:0.6,date:Date.now()});
      return true; });
    await setup();
    const q=(c,d,p,pe)=>pg.evaluate(o=>!!memNearDuplicate("o_dup",o.c,o.d,o.p,o.pe),{c,d,p,pe});
    ok("a second account of the same beat is recognised",
       await q("She agreed to meet me at five in the salon once she finishes at the gym.",4,"Evening",["Emre"]));
    ok("a different beat in the same stretch is not",
       await q("He shouted at his brother about the boat and walked out.",4,"Evening",["Emre"])===false);
    ok("the same words on a different day are not",
       await q("We agreed to meet at five in the salon after she finishes at the gym.",5,"Evening",["Emre"])===false);
    ok("and a different part of the same day is not",
       await q("We agreed to meet at five in the salon after she finishes at the gym.",4,"Morning",["Emre"])===false);
    ok("the arc commit consults it before writing", (()=>{
        const src=require('fs').readFileSync('/home/user/Multirp/index.html','utf8');
        return /const _dup=memNearDuplicate\(p\.id,mem\.content,day,period,mem\.people\);/.test(src)
          ? true : "commitMemoryArc still only checks for an exact repeat"; })());
  }

  /* v73.1 — a reckoning is written AT the character; the memory bank is first person. */
  console.log("\n[a decision is not stored in the second person]");
  ok("second person becomes first, capitals intact", await pg.evaluate(()=>{
      const got=toFirstPerson("You told yourself she was the danger and you would never be alone with her again. Your hands were shaking.");
      return got==="I told myself she was the danger and I would never be alone with her again. My hands were shaking."
        ? true : got; }));
  ok("it leaves text that has no second person alone", await pg.evaluate(()=>{
      const t="She left before the rain started.";
      return toFirstPerson(t)===t?true:toFirstPerson(t); }));
  ok("the decision memory goes through it", (()=>{
      const src=require('fs').readFileSync('/home/user/Multirp/index.html','utf8');
      return /content:toFirstPerson\(text\), type:"DECISION"/.test(src)
        ? true : "the reckoning is still stored verbatim"; })());

  /* v73.1 — "Duygu slow bir nefes verdi": one English word inside Turkish prose, which the player
     reads. ASCII-only is not the test — most of Turkish is ASCII — so a curated set of English
     words four letters or longer carries it. */
  console.log("\n[a foreign word in the narration earns one retry]");
  ok("an English word inside story-language prose is caught", await pg.evaluate(()=>{
      const h=foreignWordHits("Duygu slow bir nefes verdi.");
      return (h.length===1&&h[0]==="slow")?true:JSON.stringify(h); }));
  ok("ordinary Turkish is not flagged", await pg.evaluate(()=>{
      const h=foreignWordHits("Duygu derin bir nefes verdi, sonra kapıya yöneldi ve bir şey söylemedi.");
      return h.length===0?true:"false positives: "+h.join(", "); }));
  ok("a proper noun is not flagged", await pg.evaluate(()=>
      foreignWordHits("Emre Tokmak içeri girdi, Hakan arkasından geldi.").length===0));
  ok("nothing is flagged when the story is written in English", await pg.evaluate(()=>{
      const was=state.storyLang; state.storyLang="en";
      const h=foreignWordHits("She took a slow breath with that look in her eyes.");
      state.storyLang=was;
      return h.length===0?true:"flagged in an English story: "+h.join(", "); }));
  ok("the scene writer retries once and keeps the first answer if the retry fails", (()=>{
      const src=require('fs').readFileSync('/home/user/Multirp/index.html','utf8');
      return /Scene writer: advance \(language retry\)/.test(src)
          && /if\(_j2&&_j2\.narration!=null\) out=_again;/.test(src)
        ? true : "the retry is missing or replaces the answer unconditionally"; })());

  /* v73.1 — a duration measured from the log timestamp folded the payload walk into every call. */
  console.log("\n[each call times itself, from dispatch]");
  ok("an entry carries its own dispatch clock", await pg.evaluate(()=>{
      const e=dbg("probe","svc","ep",{a:1});
      return typeof e.sentAt==="number"?true:"no sentAt on the entry"; }));
  ok("and the duration is measured from it", await pg.evaluate(()=>{
      const e=dbg("probe2","svc","ep",{a:1});
      dbgDispatched(e); const t0=e.sentAt;
      dbgDone(e,"ok","r");
      return (e.ms===e.done-t0 && t0>=e.t)?true:"ms="+e.ms+" t="+e.t+" sentAt="+t0+" done="+e.done; }));
  ok("the request re-stamps it per attempt", (()=>{
      const src=require('fs').readFileSync('/home/user/Multirp/index.html','utf8');
      return /dbgDispatched\(entry\);\s+\/\/ v73\.1/.test(src)
        ? true : "the dispatch clock is not re-stamped on a retry"; })());

  ok("no page errors", errs.length===0?true:errs.join(" | "));
  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close(); process.exit(fail?1:0);
})();
