/* v147.2 — QC report #3 (High #2 and §3.2, living world and intents), checked with the model stubbed:
     - every future-reconcile call judges exactly its own stretch: three changes of the time of day
       merged into one queued run, then an End Day held behind its diaries while the player plays on
       into the next day — each call gets its own lines, the player named as this chat's player, and a
       "missing" hand-off reads back from the stretch's end, not the live tail;
     - the calendar executor counts 4xx / non-JSON / own exceptions as tries, lets timeouts, network
       errors and 5xx wait, closes a plan still failing that way two days overdue, and a plan that has
       to wait no longer takes one of the three slots;
     - the GM's staging lines skip a hidden holder and name this chat's player; a hidden holder's plan
       that runs out dissolves instead of being re-forced every turn;
     - waiting time-of-day runs are written down (pendingPeriodRuns) and resumed behind the day ends;
     - the world round folds a "where I was" line only for the same company and a similar line;
     - low: three pending day ends all resume; a stage is saved at once; the boot resume retries when
       the key is missing; seeded first-visit people join with a presence note; other chats' memories
       stay out of _pulseKnows / the chronicler; pursuit memories carry their period.
   Run: NODE_PATH=/home/user/Multirp/node_modules node tests/qc3-living-world.browser.js */
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:process.env.SM_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage();
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
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
      if(r instanceof Error)throw r;
      if(r&&typeof r==="object"&&r.__throw)throw r.__throw;
      return typeof r==="string"?r:JSON.stringify(r); };
    window.uiConfirm=async()=>true;
    const uni=state.universes[0]; state.curUniverse=uni.id; uni.userName="Emre"; uni.setting="A quiet harbour town.";
    uni.locations=[{id:"l_home",name:"Home",description:"x",residents:["p_a"],sublocations:[]},
                   {id:"l_gym",name:"Gym",description:"x",residents:[],sublocations:[]},
                   {id:"l_cafe",name:"Cafe",description:"x",residents:[],sublocations:[]}];
    uni.gameData={}; uni.rules=[]; uni.chronicle=[];
    Object.keys(state.chats).forEach(id=>{ if(id==="chat_other")delete state.chats[id]; });
    const mk=(id,n,o)=>Object.assign({id,name:n,universeId:uni.id,personality:"x",instructions:"x",backstory:"x",style:"x",goals:"x",look:{}},o||{});
    state.personas=[mk("p_a","Ayla"),mk("p_b","Berk"),mk("p_c","Ceren",{latent:true}),mk("p_d","Deniz",{removed:true}),
                    mk("p_e","Ercan"),mk("p_n","Canan")];
    state.user="Emre"; state.key="k"; state.mem=true; state.intentOn=true; state.sceneOn=true; state.confrontOn=true;
    state.gossipOn=false; state.calOn=true; state.pulseOn=false; state.roundOn=true; state.charQuestsOn=false;
    state.goalPursuitOn=false; state.relOn=false; state.condenseOn=false; state.trackOn=false; state.heatOn=false;
    state.gmOn=false; state.promiseOn=false; state.travelTime=0; state.npcSeedOn=false; state.textsOn=false; state.questsOn=false;
    state.memory=[]; state.gossip=[];
    const c=curChat(); c.universeId=uni.id; c.gameDay=5; c.period="Morning"; c.timeOfDay="Morning";
    c.locationId="l_home"; c.location="Home"; c.presentIds=[]; c.messages=[]; c.intents=[]; c.calendar=[];
    c.activeEvent=null; c.dnd=false; c.worldLog=[]; c.pulseBusy=null; c._roundAt=null; c._roundTry=null;
    c._dayEndDoneFor=null; c._trackersTickedFor=null; delete c.pendingDayEnd; delete c.pendingDayEnds; delete c.pendingPeriodRuns;
    c.goalActed={}; c.goalAsked={}; c.dayPlacement=null; c.worldPositions=null; c._wpKey=null; c.companionLock={};
    c.leftBehind=null; c.dayLog=null; c.memEvent=null; c.rel={}; c.memDoneIdx=-1; c.ftStretch=null; c.ftBounds=null; c.futureWatch=[];
    window.__L=(who,t)=>({mid:newMid(),role:who==="Emre"?"user":"assistant",speaker:who==="Emre"?undefined:who,speakerId:who==="Ayla"?"p_a":undefined,content:t});
    window.__idle=async(c)=>{ for(let i=0;i<300&&(chatBusy(c,"dayEndBg")||chatBusy(c,"periodEngines"));i++) await new Promise(r=>setTimeout(r,50)); };
    return true;
  });
  // The lines each reconcile call was shown, by "day period".
  const RECON=`
    window.__recon=[];
    window.__reconLines=m=>{ const s=m.map(x=>String(x.content||"")).join("\\n"); const i=s.indexOf("the whole stretch:\\n");
      const hd=(s.match(/Day (\\d+), (\\w+) — the whole stretch/)||[]).slice(1).join(" ");
      return {at:hd,lines:i<0?[]:s.slice(i+19).split("\\n").filter(l=>/^(Emre|Zed|Ayla):/.test(l))}; };`;

  // ---------------------------------------------------------------- 1. High #2: exact stretches
  await setup();
  {
    const r=await pg.evaluate(async(RECON)=>{
      eval(RECON);
      const c=curChat(); const L=window.__L;
      state.user="Zed";   // the OPEN story's player — this chat's player is the universe's "Emre"
      let release; const gate=new Promise(r=>release=r); let first=true;
      window.__reply["Future reconcile"]=async(d,m)=>{ window.__recon.push(window.__reconLines(m)); if(first){ first=false; await gate; } return {fixes:[]}; };
      c.messages.push(L("Emre","M1 morning hello"),L("Ayla","M2 morning reply"),L("Emre","M3 morning more"),L("Ayla","M4 morning end"));
      advanceTime(c,1);                        // Morning → Midday: the Morning run starts and blocks in its reconcile
      await new Promise(r=>setTimeout(r,150));
      c.messages.push(L("Emre","D1 midday one"),L("Ayla","D2 midday two"),L("Emre","D3 midday three"),L("Ayla","D4 midday four"));
      advanceTime(c,1);                        // Midday → Afternoon: queued behind it
      await new Promise(r=>setTimeout(r,100));
      const waitingPPR=JSON.stringify(c.pendingPeriodRuns||null);
      c.messages.push(L("Emre","A1 afternoon one"),L("Ayla","A2 afternoon two"),L("Emre","A3 afternoon three"),L("Ayla","A4 afternoon four"));
      advanceTime(c,1);                        // Afternoon → Evening: merged into the waiting Midday run
      await new Promise(r=>setTimeout(r,100));
      const merged=JSON.stringify((_peWaiting.get(c.id)||[]).map(x=>x.plain));
      c.messages.push(L("Emre","E1 evening one"),L("Ayla","E2 evening two"));
      release();
      await window.__idle(c);
      const part1=window.__recon.slice(); window.__recon.length=0;
      // --- the day end, held in its diaries while the player plays on into day 6
      let rel2; const g2=new Promise(r=>rel2=r);
      state.memory=[{id:"x1",ownerId:"p_a",type:"EXPERIENCE",content:"day5",gameDay:5,gamePeriod:"Evening",universeId:c.universeId,chatId:c.id}];
      window.__reply["Diary"]=async()=>{ await g2; return {content:"d"}; };
      c.messages.push(L("Emre","E3 evening three"),L("Ayla","E4 evening four"));
      await endDay();
      await new Promise(r=>setTimeout(r,150));
      c.messages.push(L("Emre","N1 day6 morning"),L("Ayla","N2 day6 morning"),L("Emre","N3 day6 morning"),L("Ayla","N4 day6 morning"));
      advanceTime(c,1);                        // Day 6 Morning → Midday: a plain run held behind the day end
      await new Promise(r=>setTimeout(r,150));
      const heldPPR=JSON.stringify(c.pendingPeriodRuns||null);
      c.messages.push(L("Emre","Q1 day6 midday"),L("Ayla","Q2 day6 midday"));
      rel2();
      await window.__idle(c);
      return {part1,part2:window.__recon.slice(),merged,waitingPPR,heldPPR,after:c.pendingPeriodRuns||null,bounds:Object.keys(c.ftBounds||{})};
    },RECON);
    const by=(arr,at)=>arr.filter(x=>x.at===at);
    const words=x=>x?x.lines.map(l=>l.replace(/^\w+: /,"").split(" ")[0]).join(","):"(none)";
    ok("merged run: the queued Midday+Afternoon runs were coalesced", r.merged.indexOf('"Midday","Afternoon"')>=0, r.merged);
    const mo=by(r.part1,"5 Morning")[0], md=by(r.part1,"5 Midday")[0], af=by(r.part1,"5 Afternoon")[0];
    ok("Morning reconcile gets exactly the four morning lines", words(mo)==="M1,M2,M3,M4", words(mo));
    ok("Midday reconcile (merged run) gets exactly the midday lines", words(md)==="D1,D2,D3,D4", words(md));
    ok("Afternoon reconcile (merged run) gets exactly the afternoon lines", words(af)==="A1,A2,A3,A4", words(af));
    ok("player lines are labelled with this chat's player, not the open story's", !!mo&&mo.lines[0].indexOf("Emre:")===0&&!JSON.stringify(r.part1).includes("Zed:"), mo&&mo.lines[0]);
    ok("a waiting run is written down while it waits (pendingPeriodRuns)", /"5":\["Morning","Midday"\]|"5":\["Midday"\]|"5":\["Morning","Midday"/.test(r.waitingPPR), r.waitingPPR);
    const ev=by(r.part2,"5 Evening")[0], d6=by(r.part2,"6 Morning")[0];
    ok("day end: the Evening reconcile gets exactly the evening lines, up to the day marker", words(ev)==="E1,E2,E3,E4", words(ev));
    ok("day end: the next day's Morning reconcile gets exactly its own lines", words(d6)==="N1,N2,N3,N4", words(d6));
    ok("the new day's run was held and recorded, then cleared when it ran", /"6":\["Morning"\]/.test(r.heldPPR)&&r.after===null, r.heldPPR+" / "+JSON.stringify(r.after));
    ok("bounds are kept per day|period", ["5|Morning","5|Midday","5|Afternoon","5|Evening","6|Morning"].every(k=>r.bounds.includes(k)), r.bounds.join(","));
  }

  // ---------------------------------------------------------------- 1b. hand-off reads the stretch; durable fields
  await setup();
  {
    const r=await pg.evaluate(async()=>{
      const c=curChat(); const L=window.__L;
      c.messages.push(L("Emre","K1 Ayla, cafe tomorrow evening?"),L("Ayla","K2 Yes, tomorrow evening."),L("Emre","K3 great"),L("Ayla","K4 see you"));
      advanceTime(c,1);
      c.messages.push(L("Emre","LATE1 something later"),L("Ayla","LATE2 later reply"));
      await window.__idle(c);
      window.__reply["Future reconcile"]={fixes:[],missing:[{kind:"meeting",about:"cafe tomorrow"}]};
      let seen=null; const real=window.runCalendarEngine;
      window.runCalendarEngine=async(ch,o)=>{ seen=recentExchangeMsgsWithTexts(ch,o.turns,o.upto).map(m=>m.content.split(" ")[0]); return 0; };
      try{ await runFutureReconcile(c,5,"Morning"); } finally{ window.runCalendarEngine=real; }
      const slim=_slimChat(c);
      return {seen,durable:!!(slim.ftBounds&&slim.ftBounds["5|Morning"])};
    });
    ok("a 'missing' meeting is handed to its writer with the stretch's lines, not the live tail", !!r.seen&&r.seen.join(",")==="K1,K2,K3,K4", JSON.stringify(r.seen));
    ok("ftBounds survives the save (not an in-flight field)", r.durable);
  }

  // ---------------------------------------------------------------- 2. executor error classes
  await setup();
  {
    const r=await pg.evaluate(async()=>{
      const c=curChat();
      const P=(id,title,who,ids,day)=>({id,kind:"meeting",title,who,charIds:ids,day,period:"",done:false,withUser:false,source:"world"});
      const run=async(n)=>{ for(let i=0;i<n;i++){ c.pulseBusy=null; await runCalendarExecutor(c,null); } };
      const out={};
      const cases={
        m403:{__throw:{friendly:"refused: moderation flagged the input",status:403}},
        nonjson:{__throw:{friendly:"OpenRouter sent back something that isn't a model reply."}},
        own:new TypeError("x is undefined"),
        tmo:{__throw:{friendly:"The model did not answer",timeout:true}},
        net:{__throw:{friendly:"Can't reach the internet.",network:true}},
        s502:{__throw:{friendly:"HTTP 502",status:502}}
      };
      for(const k of Object.keys(cases)){
        c.calendar=[P("c_"+k,"Walk "+k,"Ayla, Berk",["p_a","p_b"],5)];
        window.__reply["World pulse (calendar executor)"]=cases[k];
        await run(3);
        const e=c.calendar[0]; out[k]={done:!!e.done,tries:e.execTries||0,outcome:e.outcome||""};
      }
      // a transient failure two days overdue closes as missed
      c.calendar=[P("c_old","Old walk","Ayla, Berk",["p_a","p_b"],3)];
      window.__reply["World pulse (calendar executor)"]=cases.tmo;
      await run(1); out.stale={done:!!c.calendar[0].done,outcome:c.calendar[0].outcome||""};
      // no head-of-line blocking: three plans that must wait, then a fourth that can run
      c.calendar=[P("w1","W1","Ayla, Berk",["p_a","p_b"],5),P("w2","W2","Ayla, Ercan",["p_a","p_e"],5),P("w3","W3","Ayla, Canan",["p_a","p_n"],5),
                  P("go","Go","Berk, Ercan",["p_b","p_e"],5)];
      c.presentIds=["p_a"];   // Ayla is in the player's scene: her plans wait
      window.__reply["World pulse (calendar executor)"]={event:"They walked.",headline:"walk"};
      c.pulseBusy=null; await runCalendarExecutor(c,null);
      out.hol=c.calendar.map(e=>e.id+":"+(e.done?"done":"open")).join(" ");
      return out;
    });
    ok("403 (moderation) counts toward the tries and closes the plan", r.m403.done&&r.m403.tries===2&&r.m403.outcome==="missed", JSON.stringify(r.m403));
    ok("a non-JSON 200 counts toward the tries", r.nonjson.done&&r.nonjson.tries===2, JSON.stringify(r.nonjson));
    ok("our own exception counts toward the tries", r.own.done&&r.own.tries===2, JSON.stringify(r.own));
    ok("a timeout is free (the plan waits)", !r.tmo.done&&r.tmo.tries===0, JSON.stringify(r.tmo));
    ok("a network error is free", !r.net.done&&r.net.tries===0, JSON.stringify(r.net));
    ok("a 5xx is free", !r.s502.done&&r.s502.tries===0, JSON.stringify(r.s502));
    ok("a plan still failing in transport two days overdue closes as missed", r.stale.done&&r.stale.outcome==="missed", JSON.stringify(r.stale));
    ok("plans that must wait take no slot: the fourth due plan runs", /go:done/.test(r.hol)&&/w1:open/.test(r.hol), r.hol);
  }

  // ---------------------------------------------------------------- 3. staging and latent plans
  await setup();
  {
    const r=await pg.evaluate(()=>{
      const c=curChat(); c.presentIds=["p_a"]; state.user="Zed";
      const plan=()=>({method:"direct",steps:[{phase:"strike",gate:{type:"target_alone"},status:"pending"}],cursor:0,params:{},expires:99});
      c.intents=[{id:"lat",holderId:"p_c",holderName:"Ceren",targetId:"__user__",targetName:"Emre",kind:"grievance",status:"armed",strength:0.9,plan:plan()}];
      const latent=armedStagingSummary(c);
      c.intents.push({id:"act",holderId:"p_b",holderName:"Berk",targetId:"__user__",targetName:"Emre",kind:"grievance",status:"armed",strength:0.6,plan:plan()});
      const active=armedStagingSummary(c);
      // a hidden holder's strong plan that has run out
      c.intents=[{id:"old",holderId:"p_c",holderName:"Ceren",targetId:"__user__",kind:"grievance",status:"armed",strength:0.95,armedDay:1,
        plan:Object.assign(plan(),{expires:2,patience:0.2})}];
      checkArmedPlans(c); checkArmedPlans(c);
      const it=c.intents[0];
      return {latent,active,forced:!!it._forceNow,status:it.status};
    });
    ok("a hidden holder's plan is not staged for the GM", r.latent==="", r.latent);
    ok("an active holder's plan is staged, naming this chat's player", r.active.includes("Emre")&&!r.active.includes("Zed")&&!r.active.includes("Ceren"), r.active);
    ok("a hidden holder's expired strong plan dissolves (not re-forced every turn)", !r.forced&&r.status==="spent", JSON.stringify(r));
  }

  // ---------------------------------------------------------------- 4. resume: waiting runs behind the day ends
  await setup();
  {
    const r=await pg.evaluate(async()=>{
      const c=curChat(); const log=[];
      const real=window._runPeriodEnginesNow;
      window._runPeriodEnginesNow=async(ch,day,per,u,o)=>{ log.push(day+"/"+[].concat(per).join("+")+(o&&o.dayEnd?"(dayEnd)":"")); };
      ["Diary","Daily relationship","Goals curator","Universe chronicle"].forEach(k=>window.__reply[k]=async()=>{ await new Promise(r=>setTimeout(r,20)); return k==="Diary"?{content:"x"}:{}; });
      c.messages=[window.__L("Emre","d5"),{mid:"mk5",role:"assistant",speaker:"Narrator",dayMarker:true,dayFrom:5,dayTo:6,content:"—"},
                  window.__L("Emre","d6"),{mid:"mk6",role:"assistant",speaker:"Narrator",dayMarker:true,dayFrom:6,dayTo:7,content:"—"},
                  window.__L("Emre","d7"),{mid:"mk7",role:"assistant",speaker:"Narrator",dayMarker:true,dayFrom:7,dayTo:8,content:"—"},window.__L("Emre","d8")];
      c.gameDay=8; c._dayEndDoneFor=7;
      c.pendingDayEnds={5:{day:5,period:"Night",stage:0},6:{day:6,period:"Night",stage:0},7:{day:7,period:"Night",stage:0}};
      c.pendingPeriodRuns={8:["Morning"]};
      const n=resumePendingDayEnds();
      await window.__idle(c);
      window._runPeriodEnginesNow=real;
      return {n,log,pend:c.pendingDayEnds||null,ppr:c.pendingPeriodRuns||null};
    });
    ok("three back-to-back pending day ends all resume (the oldest is not dropped)", r.n===4&&r.log.filter(x=>/dayEnd/.test(x)).length===3, JSON.stringify(r));
    ok("the owed time-of-day run is resumed after the day ends, and cleared", r.log[r.log.length-1]==="8/Morning"&&r.ppr===null, JSON.stringify(r.log)+" "+JSON.stringify(r.ppr));
  }
  await setup();
  {
    const r=await pg.evaluate(async()=>{
      const c=curChat(); let flushed=0; const realF=window.flushPersistChats;
      window.flushPersistChats=()=>{ flushed++; };
      c.messages=[window.__L("Emre","hi")];
      await endDayBackground(c,5,c.universeId,c.messages.slice(),"Ayla","Night");
      await window.__idle(c);
      window.flushPersistChats=realF;
      // boot resume with no key yet: tries again later
      c.pendingDayEnds={4:{day:4,period:"Night",stage:0}}; state.key="";
      const realT=window.setTimeout; let later=0;
      window.setTimeout=(fn,ms)=>{ if(ms===15000)later++; return realT(()=>{},0); };
      try{ _resumeAtBoot(0); } finally{ window.setTimeout=realT; }
      delete c.pendingDayEnds; state.key="k";
      return {flushed,later};
    });
    ok("each finished day-end stage is saved at once", r.flushed>=DAYEND_STAGES_LEN(), JSON.stringify(r));
    ok("the boot resume retries later when the key is missing", r.later===1, JSON.stringify(r));
  }
  function DAYEND_STAGES_LEN(){ return 13; }

  // ---------------------------------------------------------------- 5. where-I-was folding
  await setup();
  {
    const r=await pg.evaluate(async()=>{
      const c=curChat(); c.worldPositions={p_a:"l_gym",p_b:"l_cafe",p_e:"l_home",p_n:"l_home"};
      const round=async(per,ents)=>{ c.period=per; c._roundAt=null; c._roundTry=null; c.pulseBusy=null; c.dayPlacement=null; c._wpKey=null;
        window.__reply["The day around you"]={entries:ents}; await runWorldRound(c,null); };
      const E=(who,content)=>({who,place:"Cafe",headline:"h",event:"e",kind:"ordinary",memories:[{name:"Ercan",content,importance:0.4}]});
      await round("Morning",[E(["Ercan"],"I spent the morning at the cafe reading the paper.")]);
      await round("Midday",[E(["Ercan"],"I spent midday at the cafe reading the paper again.")]);
      await round("Evening",[E(["Ercan","Canan"],"Canan told me she is thinking of leaving town.")]);
      await round("Afternoon",[E(["Ercan"],"I spent the afternoon at the cafe reading the paper, "+"and reading ".repeat(45)+"more.")]);
      return state.memory.filter(m=>m.ownerId==="p_e").map(m=>({c:m.content.slice(0,40),len:m.content.length,per:m.gamePeriod,periods:m.periods||null}));
    });
    const alone=r.filter(m=>/morning at the cafe/.test(m.c));
    ok("a similar line with the same company folds into the day's record", alone.length===1&&JSON.stringify(alone[0].periods||[]).includes("Midday"), JSON.stringify(r));
    const withCanan=r.filter(m=>/Canan told me/.test(m.c));
    ok("a different company is a memory of its own, stamped with its own period", withCanan.length===1&&withCanan[0].per==="Evening", JSON.stringify(r));
    ok("a line that would not fit is planted on its own, never cut", r.some(m=>/afternoon at the cafe/.test(m.c)&&m.per==="Afternoon")&&r.every(m=>m.len<=600), JSON.stringify(r));
  }

  // ---------------------------------------------------------------- 6. low items
  await setup();
  {
    const r=await pg.evaluate(async()=>{
      const c=curChat(); const out={};
      // other chats' same-day memories stay out
      const M=(id,chatId,content,imp)=>({id,ownerId:"p_a",character:"Ayla",type:"EXPERIENCE",content,gameDay:5,gamePeriod:"Evening",universeId:c.universeId,chatId,importance:imp||0.8});
      state.memory=[M("a1",c.id,"Ayla argued with Berk at home."),M("a2","other_chat","OTHERCHAT Ayla kissed Berk at the pier.")];
      out.knows=_pulseKnows(c,state.personas[0],"Berk",5);
      window.__reply["Universe chronicle"]={entries:[]};
      await runUniverseChronicler(c,5,null);
      out.chron=window.__sent["Universe chronicle · day 5"]||"";
      // seeded first-visit people join with a presence note
      state.npcSeedOn=true; c.locationId="l_gym"; c.location="Gym";
      window.__reply["Latent NPCs"]=[{name:"Hasan Usta",role:"owner",personality:"gruff"}];
      await maybeSeedLocationNpcs(c,"l_gym");
      const hasan=state.personas.find(p=>p.name==="Hasan Usta");
      const note=c.messages.filter(m=>m.presenceNote).pop();
      out.note=!!(hasan&&note&&Array.isArray(note.enteredIds)&&note.enteredIds.includes(hasan.id));
      // pursuit memories carry the closed period; char-quest reconcile is chat-scoped (source checks)
      out.pursuit=/_plantWorldMemory\(chat,uni,who,m,day,place,mems\.map\(x=>x&&x\.name\),period\|\|""\)/.test(String(runCharQuestPursuit));
      out.cqr=/_memOfChat\(m,chat\)/.test(String(reconcileCharQuestsForDay));
      return out;
    });
    ok("_pulseKnows reads only this chat's memories", r.knows.includes("argued")&&!r.knows.includes("OTHERCHAT"), r.knows);
    ok("the chronicler reads only this chat's day", r.chron.includes("argued")&&!r.chron.includes("OTHERCHAT"), r.chron.slice(0,300));
    ok("a seeded first-visit NPC joins with a presence note", r.note);
    ok("runCharQuestPursuit files its memories under the closed period", r.pursuit);
    ok("reconcileCharQuestsForDay reads only this chat's memories", r.cqr);
  }

  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail?1:0);
})();
