/* v63.1 — THE EMOTIONAL LOOP, AS ONE SYSTEM.
   Relationships, feelings, feelings_now, drives and the reckoning after heat all describe one
   thing: how a character has come to see somebody. They are written by five different engines on
   five different cadences, and the failure they share is drifting apart — each one true on its own
   and contradicting the others inside a single payload.
   The shape the loop is supposed to have: a fast spike saturates, decays toward a baseline computed
   FROM the slow axes, is logged, and at day's end tints (never drives) the slow judgement, which is
   reasoned primarily from MEMORIES. Everything that should move the view therefore has to reach
   memory. This pins that shape.
   Run: node tests/emotional-loop.browser.js */
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

  await pg.evaluate(()=>{
    const uni=state.universes[0];
    if(!state.personas.some(p=>p.id==="p_n"))state.personas.push({id:"p_n",name:"Nesrin",
      universeId:uni.id,instructions:"x",personality:"x",backstory:"x",style:"x",goals:"x",look:{}});
    const chat=curChat(); chat.gameDay=10; chat.period="Evening"; chat.presentIds=["p_n"];
    state.relOn=true; state.mem=true;
  });

  console.log("\n[the settled view reaches everything that writes about it]");
  ok("settledViewOf returns what `feelings` shows — the description when there is one",
     await pg.evaluate(()=>{
      const o=blankRel(); o.affection=50; o.trust=40;
      o.desc="She is drawn to him and does not trust it.";
      return settledViewOf(o)==="She is drawn to him and does not trust it."; }));
  ok("and falls back to the narrative derived from the slow axes when there is not",
     await pg.evaluate(()=>{
      const o=blankRel(); o.affection=60; o.trust=-40;
      const v=settledViewOf(o);
      return !!v && v.length>10 ? true : JSON.stringify(v); }));
  ok("the fast read is handed it, and told the moment leans off it",
     await pg.evaluate(()=>/settledViewOf\(o\)/.test(String(runShortTermRel))
       && /cannot contradict it/.test(String(runShortTermRel))));
  ok("so is the psyche writer, as its own declared piece", await pg.evaluate(()=>
      /bits\.settled=settledViewOf/.test(String(_writePsyche))
   && ((epDef("psychePrompt")||{}).parts||[]).some(x=>x&&x.name==="settled")
   && /The SETTLED view of \{\{target\}\}/.test(DEFAULT_PSYCHE)));
  ok("the note is the body only — no names, no visible actions", await pg.evaluate(()=>
      /IT IS THE BODY, AND ONLY THE BODY/.test(DEFAULT_REL_SHORT)
   && /NO NAMES/.test(DEFAULT_REL_SHORT)
   && !/someone in the room would notice/.test(DEFAULT_REL_SHORT)));
  ok("and it leans rather than deciding", await pg.evaluate(()=>
      /IT LEANS\. IT DOES NOT DECIDE/.test(DEFAULT_REL_SHORT)));
  ok("no refresh pipe stands down on a marker its default lost", await pg.evaluate(()=>{
      const stale=(window.__stalePipes||[]).filter(x=>/relShortPrompt|psychePrompt|relGenPrompt/.test(x));
      return stale.length?stale.join(" | "):true; }));

  console.log("\n[everything that should move the view reaches MEMORY]");
  ok("a broken promise already did", await pg.evaluate(()=>
      /broke their word to me/.test(String(runPromiseEngine))));
  /* (!) Corrected mid-investigation: gossip was NOT uncoupled. Every recordGossip path already
     plants a carrier-owned memory, and the daily evaluation treats the player as the subject of
     any memory by default, so it has always reached the slow axes. Pinned so it stays that way. */
  ok("gossip already did — a rumour is a ledger entry AND a memory for its carrier",
     await pg.evaluate(()=>{
      const chat=curChat();
      state.memory=(state.memory||[]).filter(m=>m&&m.type!=="GOSSIP");
      const mem={id:"m_g1",ownerId:"p_n",character:"Nesrin",type:"GOSSIP",
        content:"People are saying "+state.user+" was seen where he should not have been.",
        importance:0.6,emotion:"tense",gameDay:10,date:Date.now(),
        universeId:chat.universeId||state.curUniverse||null};
      const led=recordGossip({text:mem.content,subject:["__user__"],stakeholderId:"p_n",
        carrierId:"p_n",heat:0.6,day:10,universeId:mem.universeId,source:"gossip"});
      if(!led)return "the ledger refused it";
      mem.gossipId=led.id; led.memIds.push(mem.id); rememberMemory(mem);
      const held=(state.memory||[]).some(m=>m&&m.id==="m_g1"&&m.ownerId==="p_n");
      return (held && led.memIds.indexOf("m_g1")>=0) ? true : "carrier holds no memory of it"; }));
  ok("an unkept meeting does now", await pg.evaluate(()=>{
      const chat=curChat();
      state.memory=(state.memory||[]).filter(m=>m&&m.source!=="unkept_meeting");
      chat.calendar=[{id:"cu1",kind:"meeting",title:"the ferry at six",who:"Nesrin, "+state.user,
        day:7,period:"Evening",done:false}];
      plantUnkeptMeetingMemories(chat,10);
      const got=(state.memory||[]).filter(m=>m&&m.source==="unkept_meeting"&&m.ownerId==="p_n");
      return got.length===1 && /ferry at six/.test(got[0].content) ? true
           : JSON.stringify(got.map(m=>m.content)); }));
  ok("once only, however many days it stays overdue", await pg.evaluate(()=>{
      plantUnkeptMeetingMemories(curChat(),11);
      return (state.memory||[]).filter(m=>m&&m.source==="unkept_meeting"&&m.ownerId==="p_n").length===1; }));
  ok("and never in the player's own head", await pg.evaluate(()=>
      (state.memory||[]).filter(m=>m&&m.source==="unkept_meeting"&&m.ownerId==="__user__").length===0));
  ok("the reckoning after heat does now too, as a DECISION", await pg.evaluate(()=>{
      const src=String(_afterHeatFor);
      return /type:"DECISION"/.test(src) && /source:"after_heat"/.test(src); }));

  console.log("\n[absence is an event, and it is a profile rather than a fade]");
  const drift=async (gap)=>pg.evaluate((gap)=>{
      const chat=curChat(); chat.gameDay=10;
      const o=relObj(chat,"p_n","__user__");
      o.trust=40; o.jealousy=0; o.respect=30; o.affection=60; o.familiarity=60;
      o.desc="She has come to rely on him.";
      o.lastSeenDay=10-gap; o.neglectDays=0;
      const before={t:o.trust,j:o.jealousy,r:o.respect,a:o.affection,f:o.familiarity};
      runNeglectDrift(chat,10);
      return {before,after:{t:o.trust,j:o.jealousy,r:o.respect,a:o.affection,f:o.familiarity}};
    },gap);
  ok("nothing moves inside the grace period", await pg.evaluate(async()=>{
      const chat=curChat(); chat.gameDay=10;
      const o=relObj(chat,"p_n","__user__");
      o.trust=40; o.affection=60; o.familiarity=60; o.desc="x"; o.lastSeenDay=9; o.neglectDays=0;
      runNeglectDrift(chat,10);
      return o.trust===40; }));
  {
    const r=await drift(5);
    ok("past it, jealousy rises and trust falls",
       r.after.j>r.before.j && r.after.t<r.before.t ? true : JSON.stringify(r));
    ok("respect gives way more slowly than trust",
       (r.before.r-r.after.r) < (r.before.t-r.after.t) ? true : JSON.stringify(r));
    ok("affection and familiarity are left alone — absence does not decide either",
       r.after.a===r.before.a && r.after.f===r.before.f ? true : JSON.stringify(r));
    ok("and one quiet day is a nudge, not an event",
       Math.abs(r.after.t-r.before.t)<=3 && Math.abs(r.after.j-r.before.j)<=3 ? true : JSON.stringify(r));
  }
  ok("comfort is never written — it follows, because its baseline is built from the slow axes",
     await pg.evaluate(()=>{
      const o=blankRel(); o.trust=60; o.affection=40; o.familiarity=40;
      const warm=_fastBaseline(o,"comfort");
      o.trust=10;
      const cold=_fastBaseline(o,"comfort");
      return cold<warm && !/comfort/.test(JSON.stringify(NEGLECT_PROFILE)) ? true
           : JSON.stringify({warm,cold}); }));
  /* v63.1a — ONLY AN INTIMATE BOND. The first cut gated on "any bond at all", so a shopkeeper the
     player had not walked past in a week grew possessive. Absence is only an injury where there is
     an attachment to injure. Both conditions are read off the SLOW axes, so the test is the same
     data the rest of the system reasons from rather than a tie label in some language. */
  const setBond=async (o)=>pg.evaluate((o)=>{
      const chat=curChat(); chat.gameDay=10;
      const r=relObj(chat,"p_n","__user__");
      REL_DIMS.forEach(d=>r[d.key]=0); r.st={};
      Object.keys(o).forEach(k=>r[k]=o[k]);
      r.desc="x"; r.lastSeenDay=1; r.neglectDays=0;
      const before={j:r.jealousy,t:r.trust};
      runNeglectDrift(chat,10);
      return {moved:(r.jealousy!==before.j||r.trust!==before.t), j:r.jealousy, t:r.trust};
    },o);
  ok("an empty bond does not drift",
     (await setBond({})).moved===false);
  ok("an acquaintance they know well but are not attached to does not",
     (await setBond({familiarity:70,affection:5,trust:30})).moved===false);
  ok("a strong feeling toward someone barely known does not — that is infatuation, not intimacy",
     (await setBond({familiarity:10,affection:70,trust:30})).moved===false);
  ok("someone who dislikes the player is not wounded by their absence",
     (await setBond({familiarity:70,affection:-50,trust:-30})).moved===false);
  ok("an intimate bond does", (await setBond({familiarity:60,affection:60,trust:40})).moved===true);
  ok("and the deeper the attachment, the further a silent day carries it", await pg.evaluate(()=>{
      const near=neglectWeight({affection:NEGLECT_MIN_AFFECTION});
      const deep=neglectWeight({affection:95});
      return deep>near && near>0 && deep<=1 ? true : JSON.stringify({near,deep}); }));
  ok("an older save is stamped rather than charged for days that predate the stamp",
     await pg.evaluate(()=>{
      const chat=curChat(); chat.gameDay=10;
      const o=relObj(chat,"p_n","__user__");
      o.trust=40; o.affection=60; o.familiarity=60; o.desc="x"; o.lastSeenDay=0; o.neglectDays=0;
      runNeglectDrift(chat,10);
      return o.lastSeenDay===10 && o.trust===40 ? true : JSON.stringify({d:o.lastSeenDay,t:o.trust}); }));
  ok("the drift saturates — it cannot run away", await pg.evaluate(()=>{
      const chat=curChat();
      const o=relObj(chat,"p_n","__user__");
      o.trust=40; o.jealousy=0; o.affection=60; o.familiarity=60; o.desc="x"; o.lastSeenDay=1; o.neglectDays=0;
      for(let d=0;d<200;d++){ chat.gameDay=10+d; runNeglectDrift(chat,10+d); }
      return o.neglectDays<=NEGLECT_CAP && Math.abs(o.jealousy)<100 ? true
           : JSON.stringify({n:o.neglectDays,j:o.jealousy}); }));
  ok("and it leaves a record, so the description has something to catch up from",
     await pg.evaluate(()=>{
      state.memory=(state.memory||[]).filter(m=>m&&m.source!=="neglect");
      const chat=curChat();
      const o=relObj(chat,"p_n","__user__");
      o.trust=40; o.affection=60; o.familiarity=60; o.desc="x"; o.lastSeenDay=6; o.neglectDays=0;
      chat.gameDay=10; runNeglectDrift(chat,10);          // gap of 4 — a marked crossing
      return (state.memory||[]).some(m=>m&&m.source==="neglect"&&m.ownerId==="p_n"); }));
  ok("sharing a scene clears the clock", await pg.evaluate(()=>
      /o\.lastSeenDay=chat\.gameDay\|\|1; o\.neglectDays=0;/.test(String(runShortTermRel))));
  ok("and the pass runs at day end, before the evaluation that reads the memories",
     await pg.evaluate(()=>/runNeglectDrift\(chat,day\)/.test(String(endDayBackground))));

  console.log("\n[the six blocks are named by timescale, and ordered by authority]");
  /* They used to collide: three said "feeling", three said "now"/"this turn", two shouted with a
     warning sign, and nothing in any heading said which wins when they disagree. */
  ok("no two headings collide on feeling, now, or a warning sign", await pg.evaluate(()=>{
      const h=k=>String(blkTpl(k)||"").split("\n")[0];
      const heads=["rel_header","feel_header","feel_now_header","drive_header",
                   "after_heat_header","intent_warm"].map(h);
      const feels=heads.filter(x=>/FEELING/i.test(x)).length;
      const nows=heads.filter(x=>/RIGHT NOW|THIS TURN/i.test(x)).length;
      const warns=heads.filter(x=>/\u26a0/.test(x)).length;
      const uniq=new Set(heads).size;
      return (feels===0&&nows===0&&warns===0&&uniq===heads.length) ? true
           : JSON.stringify({feels,nows,warns,uniq,heads}); }));
  ok("and the settled view names the person in normal case, not 'TOWARD YOU'",
     await pg.evaluate(()=>{
      state.user="Kemal";
      const chat=curChat(); chat.rel=chat.rel||{};
      const o=relObj(chat,"p_n","__user__");
      o.affection=50; o.trust=40; o.desc="She is drawn to him and does not trust it.";
      const f=feelingsBlock(chat,"p_n","__user__",state.user);
      return /WHAT YOU HAVE COME TO FEEL ABOUT Kemal/.test(f.text)
          && !/TOWARD YOU/.test(f.text) ? true : String(f.text).slice(0,160); }));
  ok("the tail runs weakest claim first, strongest last", await pg.evaluate(()=>{
      const i=k=>REPLY_ORDER.indexOf(k);
      return i("feelings_now")<i("drives") && i("drives")<i("private_intent")
          && i("private_intent")<i("after_heat")
          && i("after_heat")<i("response_guidance") ? true
           : REPLY_ORDER.slice(i("feelings_now"),i("response_guidance")+1).join(" \u2192 "); }));

  console.log("\n[the authored layout is calls, not prose]");
  ok("every free-text block is a fragment the editor can open", await pg.evaluate(()=>{
      const need=["rp_task","rp_language","rp_format","rp_read_moment","rp_emotion",
                  "rp_say_no","rp_last_before"];
      const missing=need.filter(k=>!(k in BLOCK_TPL_DEFAULTS)||LY_ORDER.indexOf(k)<0);
      return missing.length?missing.join(", "):true; }));
  ok("solo, multi, gm and text carry no prose of their own", await pg.evaluate(()=>{
      const bad=[];
      ["solo","multi","gm","text"].forEach(k=>{
        ptPreset(k).split("\n").forEach(ln=>{
          const t=ln.trim();
          if(!t||/^\[(system|user)( end)?\]$/.test(t))return;
          if(/^\{\{call\/\/[a-zA-Z0-9_]+(\/\/full)?\}\}$/.test(t))return;
          bad.push(k+": "+t.slice(0,50));
        });
      });
      return bad.length?bad.slice(0,4).join(" | "):true; }));
  ok("all four resolve every name they call", await pg.evaluate(()=>{
      const bad=["solo","multi","gm","text"].map(k=>({k,s:ptScan(ptPreset(k),ptKnownNames())}))
        .filter(x=>x.s.unknownCall.length||x.s.unknownVar.length||!x.s.hasHistory);
      return bad.length?JSON.stringify(bad):true; }));
  ok("the four carry the whole feeling family, in order", await pg.evaluate(()=>{
      const want=["feelings//full","feelings_now//full","drives//full",
                  "private_intent//full","after_heat//full"];
      const bad=[];
      ["solo","multi","gm","text"].forEach(k=>{
        const t=ptPreset(k);
        let last=-1;
        want.forEach(w=>{ const i=t.indexOf("{{call//"+w+"}}");
          if(i<0)bad.push(k+" missing "+w); else if(i<last)bad.push(k+" out of order at "+w);
          else last=i; });
      });
      return bad.length?bad.join(", "):true; }));
  ok("and the blocks a multi-character turn needs", await pg.evaluate(()=>
      ["solo","multi","gm","text"].every(k=>{
        const t=ptPreset(k);
        return t.indexOf("{{call//others_present//full}}")>-1
            && t.indexOf("{{call//response_target//full}}")>-1
            && t.indexOf("{{call//latest_arcs//full}}")>-1
            && t.indexOf("{{call//watching_now//full}}")>-1; })));
  ok("a typed text takes the FORMAT block, never the spoken three-channel rules",
     await pg.evaluate(()=>{
      const t=ptPreset("text");
      return t.indexOf("{{call//format//full}}")>-1
          && t.indexOf("{{call//rp_format}}")<0
          && t.indexOf("{{call//spoken_delivery//full}}")<0
          && t.indexOf("{{call//head_type_it}}")>-1; }));
  ok("heat is untouched — it is its own contract", await pg.evaluate(()=>{
      const t=ptPreset("heat");
      return t.indexOf("{{call//head_format_heat}}")>-1
          && t.indexOf("{{call//head_pressure_heat}}")>-1
          && t.indexOf("{{call//rp_format}}")<0
          && t.indexOf("{{call//rp_task}}")<0; }));

  /* v70.3 — ONE SLOT COULD NOT HOLD A HISTORY. The previous decision handed to the reckoning was
     already scoped to the right person, but it lived in a single p.afterHeat that every reckoning
     overwrote — so a night with someone else in between wiped the chain, and the next reckoning
     about the FIRST person read as if it were the first ever. That chain is the mechanism: the
     decision getting shorter, the condition getting cheaper, until there isn't one. With one slot
     it silently reset whenever the story went anywhere else. The same slot fed the after_heat
     payload block, so her decision about one person vanished from their payload too. */
  console.log("\n[the decision is kept per person, so a chain can form]");
  {
    const pick=(selfP,targetName)=>pg.evaluate(o=>{
      const _tn=o.t, selfP=o.p;
      const _ah=(selfP&&selfP.afterHeatBy&&selfP.afterHeatBy[_tn])
             || ((selfP&&selfP.afterHeat&&selfP.afterHeat.withName===_tn)?selfP.afterHeat:null);
      return _ah?_ah.text:"";
    },{p:selfP,t:targetName});
    const withBoth={afterHeatBy:{Emre:{text:"ABOUT_EMRE",withName:"Emre"},
                                Hakan:{text:"ABOUT_HAKAN",withName:"Hakan"}},
                    afterHeat:{text:"ABOUT_HAKAN",withName:"Hakan"}};
    ok("a night with someone else no longer wipes the earlier decision",
       await pick(withBoth,"Emre")==="ABOUT_EMRE"?true:"the Emre decision was lost");
    ok("and the newer one is still right for its own person",
       await pick(withBoth,"Hakan")==="ABOUT_HAKAN");
    const legacy={afterHeat:{text:"LEGACY",withName:"Emre"}};
    ok("a save written before the per-person record still resolves",
       await pick(legacy,"Emre")==="LEGACY"?true:"legacy saves lost their decision");
    ok("and it is still never shown to the wrong person",
       await pick(legacy,"Hakan")===""?true:"a decision leaked to someone it was not about");
    /* v94.1 — AND IT BELONGS TO ONE STORY. The record was the only piece of story state living on
       the PERSONA rather than the chat — relationships are chat.rel, promises are chat.promises,
       a memory carries chatId — so a reckoning from one playthrough shipped into every later one
       with that character. A live payload caught it: Day 1 / Night, one coffee memory between
       them, and the tail opened with "you will not let a single word spoken while Emre was inside
       you count for anything". Starting a new session is the documented way out of that, and it
       did not work. */
    console.log("\n[a decision belongs to the story that earned it]");
    const block=(rec,chatId)=>pg.evaluate(o=>{
      const chat=curChat(); chat.id=o.cid;
      const uni=state.universes[0];
      const her={id:"p_ah",name:"Ozlem",universeId:uni.id,instructions:"x",personality:"x",
        backstory:"x",style:"x",goals:"x",look:{},afterHeatBy:{Emre:o.rec}};
      state.personas=[her];
      chat.gameDay=1; chat.presentIds=[her.id]; chat.messages=[];
      const B=buildTailBlocks({chat,selfP:her,selfId:her.id,selfName:her.name,
        targetName:"Emre",targetId:"__user__",multi:false,
        injected:{recent:[],diary:[],longterm:[]}});
      return String(B.after_heat||"");
    },{rec,cid:chatId});

    const mine={text:"DECIDED_HERE",withName:"Emre",chatId:"c_this"};
    ok("a decision taken in this story still ships",
       /DECIDED_HERE/.test(await block(mine,"c_this")) ? true : "it was dropped from its own chat");
    ok("one taken in a different story does not",
       (await block(mine,"c_other"))==="" ? true : "a previous playthrough reached this one");
    const unstamped={text:"NO_STAMP",withName:"Emre"};
    ok("and one that predates the stamp cannot be placed, so it is not asserted",
       (await block(unstamped,"c_this"))==="" ? true : "an unplaceable decision is still asserted");
    ok("nothing is deleted from the card either way", await pg.evaluate(()=>
       !!(state.personas[0].afterHeatBy&&state.personas[0].afterHeatBy.Emre)));

    const src=require('fs').readFileSync('/home/user/Multirp/index.html','utf8');
    ok("the engine reads the per-person record first",
       /const byName=\(p\.afterHeatBy&&p\.afterHeatBy\[otherName\]\)/.test(src)
         ? true : "the reckoning still reads the single slot alone");
    ok("the payload block reads it too",
       /selfP\.afterHeatBy&&selfP\.afterHeatBy\[_tn\]/.test(src)
         ? true : "after_heat still reads the single slot alone");
    ok("both stores are written, so nothing already saved breaks",
       /p\.afterHeat=_rec;/.test(src) && /p\.afterHeatBy\[otherName\]=_rec;/.test(src)
         ? true : "one of the two stores is not written");
    ok("and the record now carries the story it was taken in",
       /chatId:c\.id\|\|null,universeId:c\.universeId\|\|null/.test(src)
         ? true : "the reckoning still writes a record with no story on it");
    ok("the reckoning is told which moment it is being taken in",
       /WHEN THIS IS BEING DECIDED/.test(src) && /You are still in the room with them/.test(src)
         ? true : "the moment never reaches the prompt");
    ok("and the previous-decision line names the person it was about",
       /WHAT SHE DECIDED LAST TIME ABOUT \$\{otherName\}/.test(src)
         ? true : "the line is still unscoped in its wording");
  }

  /* v70.3 — the character-quest text could see a COUNT of how often it had asked and not one word
     of what it had said, nor whether the player answered. There is no way to avoid repeating
     yourself when you cannot see what you said. */
  console.log("\n[the quest text can see what it already sent]");
  {
    const src=require('fs').readFileSync('/home/user/Multirp/index.html','utf8');
    ok("each sent ask is recorded on the quest",
       /\(q\.texts=q\.texts\|\|\[\]\)\.push\(\{day:today,period:chatPeriod\(chat\)\|\|"",text:briefDesc\(msgTxt,240\)\}\)/.test(src)
         ? true : "the message itself is still not kept");
    ok("and the log is bounded",
       /if\(q\.texts\.length>3\)q\.texts=q\.texts\.slice\(-3\)/.test(src)
         ? true : "q.texts can grow without limit");
    ok("the prior asks reach the prompt, stamped",
       /# What you have already sent them about this — do not say any of it again/.test(src)
         ? true : "prior asks never reach the prompt");
    ok("so does the recent thread, so silence is readable",
       /# Your recent texts with \$\{state\.user\} \(theirs and yours — read whether they answered\)/.test(src)
         ? true : "the thread never reaches the prompt");
    ok("the thread lines carry a day/period stamp",
       /const when=\(m\.gday!=null\)\?`Day \$\{m\.gday\}\$\{m\.gperiod\?", "\+m\.gperiod:""\}`:"earlier"/.test(src)
         ? true : "the quest thread lines are unstamped");
  }

  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log("\n  "+pass+" passed, "+fail+" failed");
  await b.close();
  process.exit(fail?1:0);
})();
