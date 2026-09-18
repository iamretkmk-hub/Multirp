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

  ok("no page errors", errs.length===0?true:errs.join(" | "));
  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close(); process.exit(fail?1:0);
})();
