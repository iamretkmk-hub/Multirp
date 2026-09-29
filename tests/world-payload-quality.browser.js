/* v148.4 — WORLD / PLANNING payload-quality review, checked with the model stubbed:
     1  Retry takes back what the discarded reply agreed and changed: a task the task writer filed (a
        character's pursuit, a task in the player's list, its announce line) and a status a line moved
        (a promise kept or broken — with the "broke their word" memory), while earlier entries stay;
     2  SAFETY — a character whose card makes them a minor is never subject to a pregnancy / fertility /
        sexual / intimacy tracker: no tracker call, no dice, no day tick, no line in the director's view or
        their own, no heat beat; an adult's tracker is unaffected; the director view skips trackers still at
        their starting value and never says "aim tension" at an intimate one;
     3  the overture / confrontation aftermath memory is written from the event's topic, not its instruction;
     4  whispers reach the room-wide engines marked as whispers;
     5  promises shown to someone other than their holder say who gave them, who is owed them and whose
        "you" the wording is; relationship lines in the director's brief say whose words they are;
     6  the character-quest reconciler sees each memory's owner, the player's own memories and the ledger;
     7  the goals curator's day-end view is relative to the day that ended;
     8  the director's window stops at the last travel beat / day marker;
     9  speaker names are real names in text transcripts, and a slug ("Berker_Ozucak") resolves to its person;
    10  lines already read are marked (future tracker, trackers), and an item settled by one is not re-run;
    11  an intimate event tracker waits for an intimate scene, and only owners in the player's earshot are read;
    12  offstage ties are ranked (family first) before the cap;
    13  contemplate's leverage is the holder's own memories of the target, not their own weak spots;
    14  the "mc" classifiers keep their own low temperature;
    15  low: task writer title language, meetings-tracker TASKS section, GM judge trim, left-behind expiry,
        calendar executor reason once.
   Run: NODE_PATH=/home/user/Multirp/node_modules node tests/world-payload-quality.browser.js */
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:process.env.SM_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage();
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  const warns=[]; pg.on('console',m=>{ if(m.type()==="warning")warns.push(m.text()); });
  await pg.goto('file://'+require('path').resolve(__dirname,'..','index.html'));
  await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(600);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x===undefined?c:x).slice(0,900));} };

  const setup=()=>pg.evaluate(()=>{
    window.__calls=[]; window.__sent={}; window.__reply={};
    window.chatCompletion=async(m,mo,o)=>{ const d=(o&&o.dbg)||"?"; window.__calls.push(d);
      window.__sent[d]=(window.__sent[d]||"")+JSON.stringify(m);
      const k=Object.keys(window.__reply).find(p=>d.indexOf(p)===0);
      let r=k?window.__reply[k]:"{}";
      if(typeof r==="function")r=await r(d,m);
      return typeof r==="string"?r:JSON.stringify(r); };
    window.uiConfirm=async()=>true;
    const uni=state.universes[0]; state.curUniverse=uni.id; uni.userName="Emre"; uni.setting="An industrial housing estate.";
    uni.locations=[{id:"l_home",name:"Emre's House",description:"x",residents:[],sublocations:[]},
                   {id:"l_mkt",name:"Site Market",description:"x",residents:[],sublocations:[{id:"s_sup",name:"Supermarket",entrance:true},{id:"s_fnt",name:"Fountain Corner"}]},
                   {id:"l_cafe",name:"Vanadium Cafe",description:"x",residents:[],sublocations:[]},
                   {id:"l_burak",name:"Atan's House",description:"x",residents:["p_burak"],sublocations:[]}];
    uni.playerHomeLocId="l_home";
    uni.gameData={quests:[],charQuests:[]}; uni.trackers=[]; uni.rules=[];
    const mk=(id,n,o)=>Object.assign({id,name:n,universeId:uni.id,personality:"x",instructions:"x",backstory:"x",style:"x",goals:"x",look:{}},o||{});
    state.personas=[
      mk("p_sami","Sami Özüçak",{personality:"You are the older brother who never grew up.",backstory:"You married Buket after a wedding.",
         goals:"Clear the credit card before Buket opens Tuesday's statement.",
         relationships:{p_burak:{tie:"childhood friend"},p_berk:{tie:"younger brother"},p_burcu:{tie:"friend's wife"},p_buket:{tie:"wife"},p_nil:{tie:"friend's daughter"}}}),
      mk("p_berk","Berker Özüçak",{personality:"You are meticulous and frugal.",backstory:"You married Özlem."}),
      mk("p_buket","Buket Özüçak",{personality:"You are a dentist.",backstory:"You met Sami at a wedding and married him quickly."}),
      mk("p_nil","Nil Akbaba",{personality:"You are a sparkling, effervescent fourteen-year-old who has learned that charm is a currency.",backstory:"Your father restores houses."}),
      mk("p_burak","Burak Atan",{personality:"You are a soft-hearted, anxious man.",backstory:"You married Burcu."}),
      mk("p_burcu","Burcu Atan",{personality:"You are observant and brisk.",backstory:"You were a shy teenager once; now your husband Burak works nights.",
         interject:"Tempted by an elegant solution; wounded by being underestimated."})];
    state.user="Emre"; state.key="k"; state.mem=false; state.intentOn=true; state.sceneOn=true; state.confrontOn=true;
    state.gossipOn=false; state.calOn=true; state.pulseOn=false; state.roundOn=false; state.charQuestsOn=true;
    state.goalPursuitOn=false; state.relOn=false; state.condenseOn=false; state.trackOn=true; state.heatOn=false;
    state.gmOn=false; state.promiseOn=true; state.travelTime=0; state.npcSeedOn=false; state.textsOn=false; state.questsOn=false;
    state.memory=[]; state.gossip=[];
    const c=curChat(); c.universeId=uni.id; c.gameDay=2; c.period="Midday"; c.timeOfDay="Midday";
    c.locationId="l_cafe"; c.location="Vanadium Cafe"; c.subId=null; c.subPos={}; c.presentIds=["p_sami","p_berk"]; c.messages=[]; c.intents=[]; c.calendar=[];
    c.promises=[]; c.playerMem=[]; c.trackerVals={}; c.trkRead={}; c._ftReadMid=null; c._prPurged=PROMISE_PURGE_RULES;
    c.activeEvent=null; c.dnd=false; c.worldLog=[]; c.dayPlacement=null; c.worldPositions=null; c._wpKey=null; c.companionLock={};
    c.leftBehind=null; c.dayLog=null; c.rel={}; c.memDoneIdx=-1; c.ftStretch=null; c.ftBounds=null; c.futureWatch=[]; c._ftBusy=false;
    window.__L=(who,t,o)=>{ const p=state.personas.find(x=>x.name===who);
      return Object.assign({mid:newMid(),role:who==="Emre"?"user":"assistant",speaker:who==="Emre"?undefined:who,speakerId:p?p.id:undefined,content:t,present:c.presentIds.slice()},o||{}); };
    return true;
  });

  // ---------------------------------------------------------------- 1. Retry takes back tasks and status changes
  console.log("\n[1. Retry takes back what the discarded reply agreed and changed]");
  await setup();
  {
    const r=await pg.evaluate(async()=>{
      const c=curChat(); const L=window.__L; const uni=universeById(c.universeId);
      // an earlier word, and a task agreed a turn earlier — neither belongs to the reply that will be retried
      recordPromise(c,{holder:"Emre",to:"Sami Özüçak",promise:"You will bring Sami the money on Friday.",kind:"promise",shows_as:"Friday"},2);
      recordPromise(c,{holder:"Emre",to:"Sami Özüçak",promise:"You will keep Sami's card trouble from Buket.",kind:"promise",shows_as:"when Buket asks"},2);
      const pMoney=c.promises[0], pSecret=c.promises[1];
      pMoney.ftMid="m_earlier"; pMoney.ftNew=true;
      uni.gameData.charQuests.push({id:"cq_old",source:"task",holderId:"p_sami",holderName:"Sami Özüçak",title:"Old task",status:"active",progress:[],ftMid:"m_earlier",ftNew:true});
      c.messages.push(L("Emre","Pazartesiye yetişir mi liste?"));
      const reply=L("Berker Özüçak","Yetiştiririm. Ama bu sefer toplantıda benim adım geçsin. Parayı da aldın zaten Sami, değil mi? Buket'e söyledim bu arada.");
      c.messages.push(reply);
      // the tracker's pass over the reply: a task (echoing the speaker SLUG as holder), a promise kept, one broken
      window.__reply["Future tracker"]={items:[{kind:"task",action:"new",stage:"agreed",about:"reducer list",holder:"Berker_Ozucak",line:2},{kind:"promise",action:"update",line:2}]};
      window.__reply["Task writer"]={task:{title:"Redüktör yedek parça listesi",desc:"You said yes on one condition: your name goes on it.",holder:"Berker_Ozucak",target:"Emre",assigned_by:"Emre",when:"Monday",done_when:"the list is on Emre's desk"}};
      window.__reply["Promises & commitments"]={new:[],updates:[{id:pMoney.id,status:"kept",note:"Emre handed Sami the money early"},{id:pSecret.id,status:"broken",note:"Berker told Buket"}]};
      await runFutureTracker(c);
      const berkTask=uni.gameData.charQuests.find(q=>q.holderId==="p_berk");
      const before={task:!!berkTask,taskHolder:berkTask&&berkTask.holderName,money:pMoney.status,secret:pSecret.status,
        brokeMem:(state.memory||[]).some(m=>m.source==="promise"&&m.prId===pSecret.id)};
      // the player rejects the reply
      const slot=c.messages.indexOf(reply); c.messages.splice(slot,1);
      await _retryRollback(c,reply.mid,slot);
      return {before,after:{task:uni.gameData.charQuests.some(q=>q.holderId==="p_berk"),old:uni.gameData.charQuests.some(q=>q.id==="cq_old"),
        money:pMoney.status,moneyNote:pMoney.note||"",moneyKept:!!c.promises.find(x=>x.id===pMoney.id),secret:pSecret.status,
        undo:!!(pMoney.ftUndo||pSecret.ftUndo),brokeMem:(state.memory||[]).some(m=>m.source==="promise"&&m.prId===pSecret.id)},
        calls:window.__calls};
    });
    ok("the task writer's slug holder resolves to Berker (the task is filed)", r.before.task&&r.before.taskHolder==="Berker Özüçak", JSON.stringify(r));
    ok("the discarded line moved two promises (kept, broken) and planted a memory", r.before.money==="kept"&&r.before.secret==="broken"&&r.before.brokeMem, JSON.stringify(r.before));
    ok("Retry removes the task the discarded reply agreed to", r.after.task===false, JSON.stringify(r.after));
    ok("and keeps the task from an earlier line", r.after.old===true, JSON.stringify(r.after));
    ok("Retry puts the promises back as they read before (open, no note)", r.after.money==="open"&&r.after.secret==="open"&&!r.after.moneyNote&&r.after.moneyKept&&!r.after.undo, JSON.stringify(r.after));
    ok("and takes back the \"broke their word\" memory", r.after.brokeMem===false, JSON.stringify(r.after));
  }
  {
    const r=await pg.evaluate(async()=>{
      const c=curChat(); const L=window.__L; const uni=universeById(c.universeId);
      c.messages=[L("Berker Özüçak","Listeyi sen çıkarır mısın Emre?")];
      const reply=L("Emre","Tamam, pazartesi ben çıkarırım.");
      c.messages.push(reply);
      const before=_ftSnapshot(c);
      window.__reply["Task writer"]={task:{title:"Reducer list",desc:"You agreed to write it.",holder:"Emre",target:"Berker Özüçak",assigned_by:"Berker Özüçak"}};
      await runTaskExtract(c,{about:"list",holder:"Emre"});
      _ftStampChanges(c,before,{day:2,period:"Midday"},reply.mid);
      const had=uni.gameData.quests.some(q=>q.source==="task"&&q.title==="Reducer list"), line=c.messages.some(m=>m.questNote&&m.taskId);
      c.messages.splice(c.messages.indexOf(reply),1);
      _retryRollbackPlans(c,reply.mid);
      return {had,line,gone:!uni.gameData.quests.some(q=>q.source==="task"&&q.title==="Reducer list"),lineGone:!c.messages.some(m=>m.questNote&&m.taskId)};
    });
    ok("a player task filed from the discarded line (and its announce line) goes with it", r.had&&r.line&&r.gone&&r.lineGone, JSON.stringify(r));
  }

  // ---------------------------------------------------------------- 2. SAFETY: minors
  console.log("\n[2. a minor is never subject to an intimate tracker]");
  {
    const r=await pg.evaluate(()=>{
      const P=(o)=>Object.assign({id:"x_"+Math.random(),name:"T",look:{}},o);
      return {
        nil:isMinorChar(P({personality:"You are a sparkling, effervescent fourteen-year-old."})),
        digits:isMinorChar(P({backstory:"She is a 14-year-old schoolgirl."})),
        tr:isMinorChar(P({personality:"On dört yaşında, neşeli bir kız."})),
        tr2:isMinorChar(P({personality:"14 yaşında bir lise öğrencisi."})),
        lise:isMinorChar(P({personality:"Bir lise öğrencisi; derslerden sıkılıyor."})),
        boy:isMinorChar(P({personality:"You are a quiet, empathetic boy on the cusp of adolescence."})),
        teen:isMinorChar(P({personality:"A moody teenager who hates mornings."})),
        age:isMinorChar(P({age:15,personality:"x"})),
        bySea:isMinorChar(P({backstory:"Grew up by the sea, a 14-year-old with big plans."})),
        parents:isMinorChar(P({backstory:"Her parents married young; she is a teenager who hates rules."})),
        adultAge:isMinorChar(P({personality:"A 35-year-old dentist."})),
        mother:isMinorChar(P({personality:"You worry about your 14-year-old daughter."})),
        past:isMinorChar(P({backstory:"You were a chubby teenager who lost the weight; your husband Hakan restores houses."})),
        when:isMinorChar(P({backstory:"When she was 14 her father left. She is a nurse now."})),
        canteen:isMinorChar(P({personality:"Works in the worker canteen at the plant."})),
        parent:isMinorChar(P({personality:"You have a child and a mortgage."})),
        plain:isMinorChar(P({personality:"You are observant and brisk."}))
      };
    });
    ok("a card that says fourteen-year-old / 14-year-old / on dört yaşında / 14 yaşında reads as a minor", r.nil&&r.digits&&r.tr&&r.tr2, JSON.stringify(r));
    ok("so do school-age words with no age (lise öğrencisi, boy on the cusp of adolescence, a moody teenager) and an age field", r.lise&&r.boy&&r.teen&&r.age, JSON.stringify(r));
    ok("a place word before the age, or the parents' marriage, does not hide a minor", r.bySea&&r.parents, JSON.stringify(r));
    ok("adults do not: a stated adult age, a mother of a 14-year-old, a married adult who was a teenager, 'when she was 14', canteen, a parent", !r.adultAge&&!r.mother&&!r.past&&!r.when&&!r.canteen&&!r.parent&&!r.plain, JSON.stringify(r));
  }
  await setup();
  {
    const r=await pg.evaluate(async()=>{
      const c=curChat(); const L=window.__L; const uni=universeById(c.universeId);
      const preg=(id,owner)=>({id,name:"Pregnancy",owner,min:0,max:280,start:0,behavior:"up",method:"trigger_then_day",
        triggerPhrase:"ejaculated inside vagina",dice:"1d6",diceHit:6,onHitSet:1,perDay:1,activateAt:1,
        stages:[{at:0,text:"⚠️ YOU ARE A FERTILE WOMAN. IF EMRE COMES INSIDE YOU IT MAY LEAD TO A CHILD ⚠️"},{at:1,text:"newly conceived"}]});
      uni.trackers=[preg("t_nil","p_nil"),preg("t_buk","p_buket"),{id:"t_mood",name:"Mood",owner:"p_nil",min:0,max:100,start:50,behavior:"free",method:"llm"}];
      c.locationId="l_home"; c.location="Emre's House";
      const intimate="*Dudaklarını öpüyorum, bedenlerimiz birbirine sarılıyor.* Seni istiyorum. *Onu yatağa çekip öpmeye devam ediyorum.*";
      window.__reply["Tracker"]={delta:0,triggered:false};
      // (a) the adult alone with the player, an intimate scene: her tracker IS read
      c.presentIds=["p_buket"]; c.messages=[L("Emre",intimate),L("Buket Özüçak",intimate)];
      window.__calls=[]; await runTrackerEngine(c);
      const adultAlone=window.__calls.filter(d=>/Pregnancy/.test(d));
      // (b) the minor in the scene: nothing intimate is read — not hers, not the adult's
      c.presentIds=["p_buket","p_nil"]; c.trkRead={}; c.messages.push(L("Emre",intimate));
      window.__calls=[]; await runTrackerEngine(c);
      const withMinor=window.__calls.slice();
      // (c) the director's view and her own view, with her value moved (bad data): no line for her
      setTrackerValOwner(c,uni.trackers[0],"p_nil",40); setTrackerValOwner(c,uni.trackers[1],"p_buket",40);
      const dir=trackerContext(c,null), own=trackerContext(c,"p_nil");
      // (d) the day tick: hers never counts, the adult's does
      tickTrackersForDay(c);
      // (e) heat never opens with her in the scene
      state.heatOn=true; const heatWith=heatBeginTurn(c); heatEndTurn(c); delete c._heatOpened;
      c.presentIds=["p_buket"]; const heatAdult=heatBeginTurn(c); heatEndTurn(c); delete c._heatOpened; state.heatOn=false;
      return {adultAlone,withMinor,dir,own,nilVal:trackerVal(c,uni.trackers[0],"p_nil"),bukVal:trackerVal(c,uni.trackers[1],"p_buket"),heatWith,heatAdult};
    });
    ok("an adult's intimate event tracker is read in an intimate scene", r.adultAlone.length===1&&/Buket/.test(r.adultAlone[0]), JSON.stringify(r.adultAlone));
    ok("with a 14-year-old in the scene: no intimate tracker call at all (no dice can roll)", !r.withMinor.some(d=>/Pregnancy/.test(d)), JSON.stringify(r.withMinor));
    ok("her non-intimate tracker is still read", r.withMinor.some(d=>/Mood · Nil/.test(d)), JSON.stringify(r.withMinor));
    ok("the director is never shown her pregnancy tracker (even with a value on it)", !/Pregnancy \(Nil/.test(r.dir)&&/Pregnancy \(Buket/.test(r.dir), r.dir);
    ok("the director's intimate lines are information, not a target", !/Aim tension at it/.test(r.dir)&&/\[intimate — background only\]/.test(r.dir)&&/never steer a scene toward sex or pregnancy/.test(r.dir), r.dir);
    ok("her own payload carries no pregnancy line", !/Pregnancy|FERTILE|conceived/i.test(r.own), r.own);
    ok("the day tick never counts hers; the adult's counts", r.nilVal===40&&r.bukVal===41, JSON.stringify({nil:r.nilVal,buk:r.bukVal}));
    ok("heat is never opened with a minor in the scene (and is with the adult alone)", r.heatWith===false&&r.heatAdult===true, JSON.stringify({w:r.heatWith,a:r.heatAdult}));
    ok("a skipped tracker is logged once in the console", warns.filter(w=>/Pregnancy" skipped — Nil Akbaba is a minor;/.test(w)).length===1, JSON.stringify(warns.filter(w=>/skipped/.test(w))));
  }
  {
    const r=await pg.evaluate(()=>{
      const c=curChat(); const uni=universeById(c.universeId);
      c.trackerVals={};
      const t=uni.trackers.find(x=>x.id==="t_buk");
      const atStart=trackerContext(c,null);
      return {atStart};
    });
    ok("the director view skips a tracker still at its starting value", !/Pregnancy/.test(r.atStart), r.atStart);
  }

  // ---------------------------------------------------------------- 3. aftermath memories
  console.log("\n[3. the aftermath memory is written from the topic]");
  await setup();
  {
    const r=await pg.evaluate(()=>{
      const c=curChat(); state.user="Zed";   // the open story's player is someone else
      const q={title:"Buket'ten önce kartı kapat"};
      recordOvertureAftermath(c,{kind:"overture",accuserId:"p_sami",conviction:0.2,
        intent:`Sami Özüçak comes to Emre about their OWN pursuit "${q.title}": You need Emre's money in cash. Emre is free to agree, bargain, or refuse.`,
        gist:`my own pursuit, "${q.title}"`,_lastJudge:{}});
      recordConfrontationAftermath(c,{kind:"confrontation",accuserId:"p_burak",conviction:0.9,
        intent:"Did Emre lean in a bit too close to Burcu Atan at Vanadium Cafe? At the Site Market they said so.",
        gist:`what I had heard ("Did Emre lean in a bit too close to Burcu Atan at Vanadium Cafe?")`});
      // an event from before this build (no gist)
      recordOvertureAftermath(c,{kind:"overture",accuserId:"p_berk",conviction:0.5,
        intent:`Berker Özüçak comes to Emre about their OWN pursuit "Adım toplantıda geçsin": You want the credit. This is Berker's own initiative.`});
      state.user="Emre";
      return state.memory.map(m=>m.content);
    });
    ok("overture memory: the pursuit, not the stage direction, and this chat's player", /^I reached out to Emre about my own pursuit, "Buket'ten önce kartı kapat"\. It landed/.test(r[0])&&!/comes to|free to agree|You need/.test(r[0]), r[0]);
    ok("confrontation memory: what they had heard, quoted", /^I confronted Emre about what I had heard \("Did Emre lean in/.test(r[1]), r[1]);
    ok("an old event without a topic falls back to its pursuit title", /about my own pursuit, "Adım toplantıda geçsin"/.test(r[2])&&!/comes to|initiative/.test(r[2]), r[2]);
  }

  // ---------------------------------------------------------------- 4. whispers
  console.log("\n[4. whispers are marked for the room-wide engines]");
  await setup();
  {
    const r=await pg.evaluate(()=>{
      const c=curChat(); const L=window.__L;
      c.messages=[L("Berker Özüçak","Planlamaya haber vermem lazım."),
        L("Emre","*Ona bir zarf gösterip avucuna sıkıştırıyorum.* \"Cuma'yı bekleme, şimdi al.\"",{whisperTo:"p_sami",whisperToName:"Sami Özüçak"}),
        L("Sami Özüçak","*Zarfı cebine atıyor.* Sağ ol abi.",{whisperTo:"__user__",whisperToName:"Emre"})];
      return {gm:recentExchangeText(c,12),ft:_ftConvoText(c,6),msgs:JSON.stringify(recentExchangeMsgsWithTexts(c,6))};
    });
    // v148.4 merge — whisperSplit now keeps quoted speech touching the *aside* with it (the player's documented
    // `/whisper <name> *narration* "speech"` form is private as a whole), so nothing of this whisper is aloud
    ok("the director reads the player's whisper as one, with who heard it", /Emre: \(whispered to Sami Özüçak alone — nobody else heard\) \*?Ona bir zarf[^\n]*"Cuma'yı bekleme, şimdi al\."/.test(r.gm)&&!/\(aloud\) "Cuma'yı bekleme/.test(r.gm), r.gm);
    ok("and the character's whisper back", /Sami Özüçak: \(whispered back to Emre alone — nobody else heard\)/.test(r.gm), r.gm);
    ok("the future tracker / promise reader transcripts carry the same marks", /whispered to Sami Özüçak alone/.test(r.ft)&&/whispered to Sami/.test(r.msgs), r.ft);
  }

  // ---------------------------------------------------------------- 5. voice per reader
  console.log("\n[5. who gave a word, who is owed it, and whose \"you\" it is]");
  {
    const r=await pg.evaluate(()=>{
      const c=curChat();
      recordPromise(c,{holder:"Emre",to:"Sami Özüçak",promise:"You will bring Sami the money on Friday.",kind:"promise",shows_as:"Friday"},2);
      c.presentIds=["p_sami"]; state.relOn=true;
      const o=relObj(c,"p_sami","__user__"); o.desc="You feel lucky to have him."; o.affection=40; o.trust=30;
      const ro=relOverview(c); state.relOn=false;
      return {pc:promiseContextForNames(c,["Sami Özüçak"]),ro};
    });
    ok("a promise shown to Sami's engines says it is Emre's word, owed to Sami, worded to Emre", /Emre promised Sami Özüçak \(Emre is bound; Sami Özüçak expects it kept; worded to Emre as "you"\): You will bring Sami the money/.test(r.pc), r.pc);
    ok("the director's feelings lines say whose words they are", /Sami Özüçak → Emre \(in Sami Özüçak's own words — "you" is Sami Özüçak\): You feel lucky/.test(r.ro), r.ro);
  }

  // ---------------------------------------------------------------- 6. quest reconciler
  console.log("\n[6. the quest reconciler sees who did what]");
  await setup();
  {
    const r=await pg.evaluate(async()=>{
      const c=curChat(); const uni=universeById(c.universeId);
      uni.gameData.charQuests.push({id:"cq_card",holderId:"p_sami",holderName:"Sami Özüçak",targetId:"__user__",targetName:"Emre",title:"Clear the card",desc:"You need Emre's money in cash.",ask:"lend the money",status:"active",delivered:true,awaitingUser:true,progress:[]});
      state.memory.push({id:"m1",ownerId:"p_sami",character:"Sami Özüçak",content:"I asked Emre for the money in the canteen.",gameDay:2,gamePeriod:"Midday",universeId:uni.id,chatId:c.id,type:"EXPERIENCE"});
      c.playerMem.push({id:"pm1",content:"I slipped Sami the envelope with the money under the table.",gameDay:2,gamePeriod:"Midday"});
      recordPromise(c,{holder:"Emre",to:"Sami Özüçak",promise:"You will bring Sami the money on Friday.",kind:"promise",shows_as:"Friday"},2);
      c.promises[0].status="kept"; c.promises[0].statusDay=2; c.promises[0].note="Emre handed Sami the money early";
      window.__reply["Char quest reconcile"]=[];
      await reconcileCharQuestsForDay(c,2,uni,"Midday");
      return window.__sent["Char quest reconcile"]||"";
    });
    ok("each memory carries its owner", /- Sami Özüçak: I asked Emre for the money/.test(r), r.slice(0,1500));
    ok("the player's own memory of the stretch is there", /- Emre: I slipped Sami the envelope/.test(r), r.slice(0,1500));
    ok("and the ledger between holder and target, with its status", /Emre → Sami Özüçak \[kept: Emre handed Sami the money early\]/.test(r), r.slice(0,1800));
  }

  // ---------------------------------------------------------------- 7. goals curator's days
  console.log("\n[7. the goals curator reads the day that ended]");
  await setup();
  {
    const r=await pg.evaluate(async()=>{
      const c=curChat(); const uni=universeById(c.universeId); const p=state.personas.find(x=>x.id==="p_sami");
      c.gameDay=3; c.period="Morning";   // the day-end pass runs after the clock rolled
      state.memory.push({id:"d1",ownerId:"p_sami",character:"Sami Özüçak",content:"Day one: I asked Emre about the card.",gameDay:1,universeId:uni.id,chatId:c.id,type:"EXPERIENCE"});
      state.memory.push({id:"d2",ownerId:"p_sami",character:"Sami Özüçak",content:"Day two: the barbecue at Emre's.",gameDay:2,universeId:uni.id,chatId:c.id,type:"EXPERIENCE"});
      c.calendar.push({id:"e_bbq",title:"Barbecue at Emre's place",who:"Sami Özüçak, Emre",character:"Sami Özüçak",charId:"p_sami",charIds:["p_sami"],day:2,period:"Evening",done:true,outcome:"met",completedDay:2,completedPeriod:"Evening",result:"It went well."});
      window.__reply["Goals curator"]={goals:["x"]};
      await _curateGoalsFor(c,p,2,uni.id,4);
      return window.__sent["Goals curator · Sami Özüçak"]||"";
    });
    ok("the day before is marked as such, the day itself as today", /\(yesterday\) Day one/.test(r)&&/\(today\) Day two/.test(r), r.slice(0,2500));
    ok("the day's own barbecue is not called yesterday", /Barbecue at Emre's place[^"\\]*\((?:earlier )?today/i.test(r)&&!/Barbecue at Emre's place[^"\\]*yesterday/.test(r), r.slice(0,2500));
  }

  // ---------------------------------------------------------------- 8. director window stops at the scene change
  console.log("\n[8. the director's window is this scene]");
  await setup();
  {
    const r=await pg.evaluate(async()=>{
      const c=curChat(); const L=window.__L;
      c.messages=[L("Berker Özüçak","CANTEEN Tamam beyler, benim için gün bitti."),L("Emre","CANTEEN Görüşürüz."),
        {mid:newMid(),role:"assistant",speaker:"Narrator",dayMarker:true,content:"Day 1 ends."},
        {mid:newMid(),role:"assistant",speaker:"Narrator",narratorEvent:true,travelBeat:true,content:"Emre drives to the market."},
        L("Emre","MARKET Merhaba Buket."),L("Buket Özüçak","MARKET Hoş geldin.")];
      state.gmOn=true; state.gmEvery=3; c.gmLastCheck=0; c.presentIds=["p_buket"];
      window.__reply["Gamemaster: judge"]={stale:false,trigger:false};
      await maybeGamemaster(c,false);
      return {text:recentExchangeText(c,12,{scene:true}),judge:window.__sent["Gamemaster: judge"]||""};
    });
    ok("the window starts at the travel beat — yesterday's canteen is gone", !/CANTEEN/.test(r.text)&&/drives to the market/.test(r.text)&&/MARKET Hoş geldin/.test(r.text), r.text);
    ok("the Gamemaster judge reads only this scene", r.judge.length>0&&!/CANTEEN/.test(r.judge)&&/MARKET/.test(r.judge), r.judge.slice(0,400));
  }

  // ---------------------------------------------------------------- 9. names, not slugs
  console.log("\n[9. real names in the transcripts]");
  {
    const r=await pg.evaluate(()=>{ const c=curChat(); return {ft:_ftConvoText(c,6),slug:unslugName(c,"Berker_Ozucak"),me:unslugName(c,"Emre"),none:unslugName(c,"Nobody_Here")}; });
    ok("a text transcript names Buket Özüçak, not Buket_Ozucak", /Buket Özüçak: MARKET/.test(r.ft)&&!/Buket_Ozucak/.test(r.ft), r.ft);
    ok("a slug resolves to its person; anything else is left alone", r.slug==="Berker Özüçak"&&r.me==="Emre"&&r.none==="Nobody_Here", JSON.stringify(r));
  }

  // ---------------------------------------------------------------- 10. already-read lines
  console.log("\n[10. lines already read are context, and not acted on twice]");
  await setup();
  {
    const r=await pg.evaluate(async()=>{
      const c=curChat(); const L=window.__L; state.calOn=false;
      const uni=universeById(c.universeId);
      uni.gameData.charQuests.push({id:"cq_list",source:"task",holderId:"p_berk",holderName:"Berker Özüçak",targetId:"__user__",targetName:"Emre",title:"List",status:"active",progress:[]});
      c.messages=[L("Emre","A"),L("Berker Özüçak","B — I'll have the list by Monday, not Friday."),L("Emre","C")];
      let updates=0; window.__reply["Future update"]=()=>{ updates++; return {changes:{when:"Monday"}}; };
      window.__reply["Future tracker"]={items:[{kind:"task",action:"update",id:"cq_list",about:"moved to Monday",line:2}]};
      await runFutureTracker(c);
      const first=updates;
      c.messages.push(L("Berker Özüçak","D"));
      window.__sent={};
      await runFutureTracker(c);   // the model reports the same update from the same line (now read)
      return {first,second:updates-first,sent:window.__sent["Future tracker"]||""};
    });
    ok("the first pass runs the update once", r.first===1, JSON.stringify(r));
    ok("the next pass marks the lines it already read", /#1 \(already read — context only\) Emre: A/.test(r.sent)&&/#4 Berker Özüçak: D/.test(r.sent)&&!/#4 \(already read/.test(r.sent), r.sent.slice(-900));
    ok("and an item settled by an already-read line is not run again", r.second===0, JSON.stringify(r));
  }
  {
    const r=await pg.evaluate(async()=>{
      const c=curChat(); const L=window.__L; const uni=universeById(c.universeId);
      uni.trackers=[{id:"t_dr",name:"Drunk",owner:"__story__",min:0,max:100,start:0,behavior:"up",method:"llm"}];
      c.trkRead={}; c.messages=[L("Emre","one"),L("Sami Özüçak","two")];
      window.__reply["Tracker"]={delta:0,triggered:false};
      window.__calls=[]; window.__sent={}; await runTrackerEngine(c); const a=window.__calls.filter(d=>/^Tracker/.test(d)).length;
      window.__calls=[]; await runTrackerEngine(c); const b=window.__calls.filter(d=>/^Tracker/.test(d)).length;   // nothing new said
      c.messages.push(L("Emre","three")); window.__calls=[]; window.__sent={}; await runTrackerEngine(c);
      const cN=window.__calls.filter(d=>/^Tracker/.test(d)).length, sent=Object.values(window.__sent).join("");
      return {a,b,cN,sent};
    });
    ok("a tracker is asked once, not again with nothing new said", r.a===1&&r.b===0, JSON.stringify(r));
    ok("with a new line, the lines it already judged are marked as context", r.cN===1&&/already judged — context only[^"]*one/.test(r.sent)&&/"content":"three"/.test(r.sent), r.sent.slice(0,1200));
  }

  // ---------------------------------------------------------------- 11. cue gate, earshot
  console.log("\n[11. an intimate event tracker waits for an intimate scene; earshot only]");
  await setup();
  {
    const r=await pg.evaluate(async()=>{
      const c=curChat(); const L=window.__L; const uni=universeById(c.universeId);
      const preg=(id,owner)=>({id,name:"Pregnancy",owner,min:0,max:280,start:0,behavior:"up",method:"trigger_then_day",triggerPhrase:"ejaculated inside vagina",onHitSet:1,perDay:1,activateAt:1});
      uni.trackers=[preg("t_b","p_buket"),preg("t_c","p_burcu")];
      c.locationId="l_mkt"; c.location="Site Market"; c.subId="s_sup"; c.presentIds=["p_buket","p_burcu"]; c.subPos={p_buket:"s_sup",p_burcu:"s_fnt"};
      window.__reply["Tracker"]={delta:0,triggered:false};
      c.messages=[L("Emre","Domates ne kadar?"),L("Buket Özüçak","Kilosu otuz lira.")];
      window.__calls=[]; await runTrackerEngine(c); const cafe=window.__calls.filter(d=>/Pregnancy/.test(d));
      c.messages.push(L("Emre","*Onu öpüyorum, dudaklarını, boynunu öpüyorum.* Seni istiyorum. *Bedenlerimiz birbirine sarılıyor, onu soyuyorum.*"));
      window.__calls=[]; await runTrackerEngine(c); const hot=window.__calls.filter(d=>/Pregnancy/.test(d));
      return {cafe,hot};
    });
    ok("an ordinary exchange asks no pregnancy tracker", r.cafe.length===0, JSON.stringify(r));
    ok("an intimate one asks it — only for the woman in the player's area, not the one at the fountain", r.hot.length===1&&/Buket/.test(r.hot[0]), JSON.stringify(r));
  }

  // ---------------------------------------------------------------- 12. ties ranked
  console.log("\n[12. the closest people first]");
  {
    const r=await pg.evaluate(()=>{ const c=curChat(); const p=state.personas.find(x=>x.id==="p_sami");
      return _rankTieCands(c,p,state.personas.filter(x=>x.id!=="p_sami")).map(x=>x.name); });
    ok("wife and brother lead Sami's ties, ahead of roster order", r[0]==="Berker Özüçak"&&r[1]==="Buket Özüçak"||r[0]==="Buket Özüçak"&&r[1]==="Berker Özüçak", JSON.stringify(r));
  }

  // ---------------------------------------------------------------- 13. contemplate
  console.log("\n[13. contemplate's leverage is what the holder witnessed]");
  await setup();
  {
    const r=await pg.evaluate(async()=>{
      const c=curChat(); const uni=universeById(c.universeId);
      const berk=state.personas.find(x=>x.id==="p_berk"); berk.interject="Wound him by calling his care control.";
      const sami=state.personas.find(x=>x.id==="p_sami"); sami.interject="Tempt him with easy money.";
      state.memory.push({id:"mw",ownerId:"p_berk",character:"Berker Özüçak",content:"I overheard Sami ask Emre for money and hide it from Buket.",people:["Sami Özüçak","Emre"],gameDay:2,universeId:uni.id,chatId:c.id,type:"OBSERVATION"});
      window.__reply["Contemplate"]={method:"direct",gate:"target_present"};
      const it={id:"i1",holderId:"p_berk",targetId:"p_sami",targetName:"Sami Özüçak",kind:"grievance",valence:"hostile",aim:"to have him admit it",trigger:"x",strength:0.7};
      await contemplatePlan(c,it,state.personas,id=>(state.personas.find(x=>x.id===id)||{}).name,uni.id,2,"Midday");
      return window.__sent["Contemplate · Berker Özüçak"]||"";
    });
    ok("the holder's memory of the target is the leverage", /overheard Sami ask Emre for money/.test(r), r.slice(0,1500));
    ok("the holder's own weak spots are not sent as leverage; the target's are labelled", !/care control/.test(r)&&/what is known of Sami Özüçak's weak spots: Tempt him/.test(r), r.slice(0,1500));
  }

  // ---------------------------------------------------------------- 14. mc temperature
  console.log("\n[14. the classifiers keep their own temperature]");
  ok("an unset \"mc\" bucket lets the wearing tracker's 0.1 through", await pg.evaluate(()=>{
    const mc=(state.fnCfg||{}).mc||{}; return (mc.temp==null&&fnTemp("mc",0.1)===0.1&&fnTok("mc",220)===220)?true:JSON.stringify(state.fnCfg); }));

  // ---------------------------------------------------------------- 15. low bundle
  console.log("\n[15. low: language, meetings prompt, judge trim, left behind, executor reason]");
  await setup();
  {
    const r=await pg.evaluate(async()=>{
      const c=curChat(); const L=window.__L;
      c.messages=[L("Emre","Listeyi çıkar."),L("Berker Özüçak","Tamam.")];
      window.__reply["Task writer"]={task:null};
      await runTaskExtract(c,{about:"list",holder:"Berker"});
      const tw=window.__sent["Task writer"]||"";
      window.__reply["Meetings tracker"]={new:[]};
      await runCalendarEngine(c,{fromTracker:true}); const mtT=window.__sent["Meetings tracker"]||""; window.__sent={};
      await runCalendarEngine(c,{}); const mtF=window.__sent["Meetings tracker"]||"";
      return {tw,twAllEn:tw.indexOf(JSON.stringify(engineLangDirective()).slice(1,-1).slice(0,80))>=0,mtT,mtF};
    });
    ok("the task writer's title may be in the story language (mixed directive, not all-English)", r.tw.length>0&&!r.twAllEn, r.tw.slice(-600));
    ok("the meetings tracker called by the future tracker gets no TASKS section", !/# TASKS —/.test(r.mtT)&&/# TASKS —/.test(r.mtF), r.mtT.slice(0,300));
  }
  {
    const r=await pg.evaluate(()=>{
      const c=curChat(); c.presentIds=["p_sami","p_berk"]; c.locationId="l_cafe";
      state.personas.find(x=>x.id==="p_berk").relationships={p_sami:{tie:"older brother"},p_buket:{tie:"sister-in-law"}};
      state.personas.find(x=>x.id==="p_buket").interject="Being seen as Sami's handler wounds her.";
      const j=directorContext(c,"judge"), g=directorContext(c,"gm");
      return {j,g};
    });
    ok("the GM judge's brief drops offstage bios and the venue list", !/pressure point:/.test(r.j)&&!/PLACES IN THIS WORLD/.test(r.j)&&/PLACES IN THIS WORLD/.test(r.g), r.j.slice(0,1500));
    ok("and its who-is-who covers only those present, each pair once", /WHO THE PEOPLE HERE ARE TO EACH OTHER:\nSami Özüçak: [^\n]*Berker Özüçak \(younger brother\)/.test(r.j)&&!/Berker Özüçak: [^\n]*Sami Özüçak \(older brother\)/.test(r.j)&&!/Buket Özüçak \(wife\)/.test(r.j), r.j.slice(-900));
  }
  {
    const r=await pg.evaluate(()=>{
      const c=curChat();
      state.personas.forEach(p=>{ p.schedule=null; });
      c.gameDay=4; c.period="Morning"; c.dayPlacement={day:4,period:"Morning",positions:{}}; c.worldPositions=null; c._wpKey=null; c.presentIds=[];
      noteLeftBehind(c,["p_burak","p_berk"],"l_home");     // left at the player's house in the morning
      noteLeftBehind(c,["p_sami"],"l_cafe");
      c.period="Midday"; const mid=resolveWorldPositions(c);
      const midP={burak:mid.p_burak,berk:mid.p_berk,sami:mid.p_sami};
      c.period="Evening"; const eve=resolveWorldPositions(c);
      return {midP,eveSami:eve.p_sami};
    });
    ok("left at a café, he is still there the next part of the day", r.midP.sami==="l_cafe", JSON.stringify(r));
    ok("a guest is never left standing in the player's home", r.midP.burak!=="l_home"&&r.midP.berk!=="l_home", JSON.stringify(r));
    ok("and it lasts one part of the day, not the rest of it", r.eveSami!=="l_cafe", JSON.stringify(r));
  }
  {
    const r=await pg.evaluate(async()=>{
      const c=curChat(); c.presentIds=[]; c.gameDay=4; c.period="Midday";
      c.calendar=[{id:"e_x",kind:"meeting",title:"See the statement",who:"Sami Özüçak, Buket Özüçak",charIds:["p_sami","p_buket"],charId:"p_sami",day:4,period:"Midday",
        origin:"Sami's own plan. You mean to see the card statement before Buket does.",detail:"You mean to see the card statement before Buket does.",withUser:false}];
      window.__reply["World pulse (calendar executor)"]={event:"x",headline:"y"};
      try{ await runCalendarExecutor(c,universeById(c.universeId)); }catch(e){}
      const s=window.__sent["World pulse (calendar executor)"]||"";
      return {n:(s.match(/You mean to see the card statement/g)||[]).length,len:s.length};
    });
    ok("the calendar executor states a plan's reason once", r.len===0||r.n===1, JSON.stringify(r));
  }

  ok("no page errors", errs.length===0, errs.join("\n"));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail?1:0);
})();
