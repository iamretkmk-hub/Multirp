/* v130.1 — THE FUTURE-EVENT TRACKER: ONE CALL A TURN, AND THE ANSWER DECIDES.
   Decided with the user: every turn used to send the recent lines to a Meetings detector (every
   turn) and a Promises detector (every second turn), each writing from the last few lines, so a plan
   worked out over several turns was written when it first looked like a plan and later details were
   lost, and a thing only ASKED for could land as agreed. Now one tracker decides whether the turn
   bound the future — a MEETING, a TASK or a PROMISE — whether it is still being discussed or has
   been answered, and whether it changes or ends something on record; only then does a writer run.
   Tasks are new: a character decides one for themselves, or agrees when asked; the player can take
   one on too. Checked here with the models stubbed:
     - nothing bound → no writer runs;
     - "planning" writes nothing and remembers where it began; "agreed" runs the writer over the
       whole stretch since then;
     - a meeting agreed is filed, and the meetings pass no longer files errands of its own;
     - a change to a meeting on record updates THAT entry; the tracker is shown the ids;
     - a task agreed at the player's asking lands on the holder's card, in full, as a task; one a
       character decides about the player is carried out, never "asked" by text; the player's own
       lands in the Quests list, and finishing it chains no story arc;
     - a promise runs the promise pass at once, and a changed promise is reworded in place;
     - a switched-off kind is ignored; postTurn, texts and calls all go through the tracker.
   Run: node tests/future-tracker.browser.js */
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage();
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file://'+require('path').resolve(__dirname,'..','index.html'));
  await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(600);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x||c).slice(0,700));} };

  await pg.evaluate(()=>{
    window.__calls=[]; window.__ft=[]; window.__reply={};
    window.chatCompletion=async(m,mo,o)=>{ const d=(o&&o.dbg)||"?";
      window.__calls.push({d,m});
      if(d==="Future tracker")return JSON.stringify(window.__ft.shift()||{items:[]});
      const k=Object.keys(window.__reply).find(x=>d.indexOf(x)===0);
      return k?JSON.stringify(window.__reply[k]):"{}"; };
    const uni=state.universes[0]; state.curUniverse=uni.id; uni.gameData={};
    uni.locations=[{id:"l_cafe",name:"Cafe",description:"x",residents:[],sublocations:[]},{id:"l_park",name:"Park",description:"x",residents:[],sublocations:[]}];
    const mk=(id,n)=>({id,name:n,universeId:uni.id,personality:"x",instructions:"x",goals:"x",look:{}});
    state.personas=[mk("p_a","Ayla"),mk("p_n","Nil"),mk("p_b","Berk")];
    state.user="Emre"; state.key="k"; state.calOn=true; state.promiseOn=true; state.charQuestsOn=true; state.mem=true;
    const c=curChat(); c.universeId=uni.id; c.gameDay=2; c.period="Morning"; c.calendar=[]; c.promises=[]; c._prPurged=PROMISE_PURGE_RULES;
    c.futureWatch=[]; c.presentIds=["p_a"];
    window.__say=(who,txt)=>{ c.messages.push(who==="Emre"?{mid:newMid(),role:"user",content:txt}:{mid:newMid(),role:"assistant",speaker:who,speakerId:"p_a",content:txt}); };
    c.messages=[];
    for(let i=0;i<10;i++)window.__say(i%2?"Ayla":"Emre","line "+i);
  });
  const calls=()=>pg.evaluate(()=>window.__calls.map(x=>x.d));

  console.log("\n[nothing bound, nothing written]");
  const A=await pg.evaluate(async()=>{ window.__calls=[]; window.__ft=[{items:[]}]; await runFutureTracker(curChat()); return window.__calls.map(x=>x.d); });
  ok("one call, and no writer runs", JSON.stringify(A)==='["Future tracker"]', JSON.stringify(A));

  console.log("\n[planning, then the answer]");
  const B=await pg.evaluate(async()=>{
    const c=curChat(); window.__calls=[];
    window.__say("Emre","Shall we meet tomorrow? Maybe the cafe, maybe the park.");
    window.__ft=[{items:[{kind:"meeting",action:"new",stage:"planning",holder:"Emre",about:"meeting Ayla tomorrow"}]}];
    await runFutureTracker(c);
    const r={afterPlanning:window.__calls.map(x=>x.d),watch:c.futureWatch.map(w=>w.kind+"|"+w.about)};
    for(let i=0;i<6;i++)window.__say(i%2?"Ayla":"Emre","still deciding "+i);
    window.__say("Ayla","Yes — the park, tomorrow evening. I'll be there.");
    window.__calls=[];
    window.__ft=[{items:[{kind:"meeting",action:"new",stage:"agreed",holder:"Emre",about:"meeting Ayla tomorrow"}]}];
    window.__reply["Meetings tracker"]={new:[{title:"Emre meets Ayla at the park",dayOffset:1,period:"Evening",who:"Ayla",executor:"user",where:"Park"}],
      tasks:[{title:"Ayla brings the letter",assignee:"Ayla",who:"Ayla"}]};
    await runFutureTracker(c);
    const mt=window.__calls.find(x=>x.d==="Meetings tracker");
    r.afterAgreed=window.__calls.map(x=>x.d);
    r.linesRead=mt?mt.m.filter(x=>x.role!=="system").length-1:0;   // minus the closing instruction
    r.watchAfter=c.futureWatch.length;
    r.cal=chatCalendar(c).map(e=>e.title+"|"+e.day+"|"+e.period);
    return r;
  });
  ok("planning writes nothing yet", JSON.stringify(B.afterPlanning)==='["Future tracker"]', JSON.stringify(B));
  ok("and remembers what is being discussed", B.watch.length===1 && /^meeting\|/.test(B.watch[0]), JSON.stringify(B));
  ok("the answer runs the meetings pass", B.afterAgreed.includes("Meetings tracker"), JSON.stringify(B));
  ok("over the whole stretch since it was first raised, not just the last few lines", B.linesRead>=13, "read "+B.linesRead);
  ok("the meeting is filed and the plan is no longer 'being discussed'",
     B.cal.length===1 && /\|3\|Evening$/.test(B.cal[0]) && B.watchAfter===0, JSON.stringify(B));
  ok("the meetings pass no longer files an errand of its own (tasks have their writer)",
     B.cal.every(x=>!/letter/.test(x)), JSON.stringify(B.cal));

  console.log("\n[a change to something on record]");
  const C=await pg.evaluate(async()=>{
    const c=curChat(); const e=chatCalendar(c)[0]; window.__calls=[];
    window.__say("Ayla","Actually, make it the cafe, and at night.");
    window.__ft=[{items:[{kind:"meeting",action:"update",stage:"agreed",id:e.id,about:"the park meeting moves"}]}];
    window.__reply["Future update"]={changes:{where:"Cafe",period:"Night"},ended:"",result:""};
    await runFutureTracker(c);
    const tr=window.__calls.find(x=>x.d==="Future tracker");
    const sent=tr?tr.m.map(x=>x.content).join("\n"):"";
    return {calls:window.__calls.map(x=>x.d),n:chatCalendar(c).length,where:e.where,loc:e.locationId,period:e.period,idShown:sent.indexOf("["+e.id+"]")>=0};
  });
  ok("the tracker is shown what is on record, with ids", C.idShown===true, JSON.stringify(C));
  ok("the update patches THAT entry — no second meeting",
     C.calls.includes("Future update · meeting") && C.n===1 && C.where==="Cafe" && C.loc==="l_cafe" && C.period==="Night", JSON.stringify(C));

  console.log("\n[tasks]");
  const D=await pg.evaluate(async()=>{
    const c=curChat(), uni=state.universes[0]; window.__calls=[];
    window.__say("Emre","When you see Nil, tell her I'm sorry about the party.");
    window.__say("Ayla","I will. First thing when I see her.");
    window.__ft=[{items:[{kind:"task",action:"new",stage:"agreed",holder:"Ayla",about:"Ayla tells Nil that Emre is sorry"}]}];
    window.__reply["Task writer"]={task:{holder:"Ayla",assigned_by:"Emre",target:"Nil",title:"Tell Nil that Emre is sorry",
      desc:"You will tell Nil, word for word, that Emre is sorry about the party. He asked you to and you agreed, because the two of them have not spoken since.",
      motive:"Emre asked, and she wants them to make up",when:"the next time you see Nil",where:"",done_when:"Nil has heard the apology"}};
    await runFutureTracker(c);
    const q=_charQuests(uni).find(x=>x.source==="task");
    const card=charQuestSheetLines(state.personas.find(p=>p.id==="p_a"));
    return {calls:window.__calls.map(x=>x.d),q:q?{h:q.holderName,t:q.targetId,by:q.assignedBy,when:q.when,ask:q.ask,ap:q.approach}:null,card};
  });
  ok("a task agreed at the player's asking is written by the task writer", D.calls.includes("Task writer"), JSON.stringify(D.calls));
  ok("it is the holder's task, through the person it runs through, with who asked and when",
     D.q && D.q.h==="Ayla" && D.q.t==="p_n" && D.q.by==="Emre" && /next time you see Nil/.test(D.q.when), JSON.stringify(D.q));
  ok("and it is on the holder's card in full, as a task they agreed to",
     /YOUR TASK — "Tell Nil that Emre is sorry"/.test(D.card) && /word for word/.test(D.card) && /Emre asked this of you and you agreed/.test(D.card), D.card);

  const E=await pg.evaluate(async()=>{
    const c=curChat(), uni=state.universes[0];
    window.__say("Berk","_When I get back home I will make Emre pay for this._");
    window.__ft=[{items:[{kind:"task",action:"new",stage:"agreed",holder:"Berk",about:"Berk will make Emre pay"}]}];
    window.__reply["Task writer"]={task:{holder:"Berk",assigned_by:"",target:"Emre",title:"Make Emre pay",
      desc:"You will make Emre pay for humiliating you in front of Ayla.",motive:"humiliation",when:"when you get home",where:"",done_when:"Emre has paid"}};
    await runFutureTracker(c);
    const q=_charQuests(uni).find(x=>x.holderName==="Berk");
    return q?{t:q.targetId,by:q.assignedBy,ask:q.ask,ap:q.approach,delivered:q.delivered}:null;
  });
  ok("a task a character decides in their own thoughts is theirs, with nobody asking",
     E && E.t==="__user__" && E.by==="", JSON.stringify(E));
  ok("and one aimed at the player is carried out, never sent as a text ask", E && E.ask==="" && E.ap==="", JSON.stringify(E));

  const F=await pg.evaluate(async()=>{
    const c=curChat(), uni=state.universes[0];
    window.__say("Ayla","Can you get my ring back from Berk?"); window.__say("Emre","I'll get it back.");
    window.__ft=[{items:[{kind:"task",action:"new",stage:"agreed",holder:"Emre",about:"Emre gets Ayla's ring back"}]}];
    window.__reply["Task writer"]={task:{holder:"Emre",assigned_by:"Ayla",target:"Berk",title:"Get Ayla's ring back",
      desc:"You will get Ayla's ring back from Berk.",motive:"she asked",when:"",where:"",done_when:"the ring is back with Ayla"}};
    await runFutureTracker(c);
    const q=(uni.gameData.quests||[]).find(x=>x.source==="task");
    const r={q:q?{arc:q.arc,giver:q.giverName,active:q.startActive,npc:q.npcName}:null};
    let chained=0; const real=window.maybeGenerateNextQuest; window.maybeGenerateNextQuest=async()=>{ chained++; return null; };
    window.__say("Emre","Here's your ring."); window.__say("Ayla","You got it back!");
    window.__ft=[{items:[{kind:"task",action:"ended",stage:"agreed",id:q.id,about:"ring returned"}]}];
    window.__reply["Future update"]={changes:{},ended:"done",result:"Emre got the ring back from Berk."};
    await runFutureTracker(c); await new Promise(r=>setTimeout(r,200));
    window.maybeGenerateNextQuest=real;
    r.done=q.done; r.chained=chained;
    return r;
  });
  ok("the player's own task lands in the Quests list as a task", F.q && F.q.arc==="Tasks" && F.q.giver==="Ayla" && F.q.active===true && F.q.npc==="Berk", JSON.stringify(F));
  ok("finishing it closes it and chains no story arc after it", F.done===true && F.chained===0, JSON.stringify(F));

  console.log("\n[promises]");
  const G=await pg.evaluate(async()=>{
    const c=curChat(); window.__calls=[]; c._prCount=0;
    window.__say("Emre","From now on you won't talk to Berk."); window.__say("Ayla","Fine. I won't.");
    window.__ft=[{items:[{kind:"promise",action:"new",stage:"agreed",holder:"Ayla",about:"Ayla won't talk to Berk"}]}];
    window.__reply["Promises & commitments"]={new:[{holder:"Ayla",to:"Emre",ask:"he asked her to stop",promise:"you will not talk to Berk",kind:"prohibition",shows_as:"the next time Berk calls her"}],updates:[]};
    await runFutureTracker(c);
    const pr=livePromises(c)[0];
    const r={calls:window.__calls.map(x=>x.d),pr:pr?pr.promise:null};
    window.__say("Emre","Not Nil either."); window.__say("Ayla","Alright, not Nil either.");
    window.__ft=[{items:[{kind:"promise",action:"update",stage:"agreed",id:pr.id,about:"now Nil too"}]}];
    window.__reply["Promises & commitments"]={new:[],updates:[{id:pr.id,status:"changed",note:"widened",promise:"you will not talk to Berk or Nil"}]};
    await runFutureTracker(c);
    r.after=livePromises(c).map(x=>x.promise);
    return r;
  });
  ok("a promise runs the promise pass at once — no every-other-turn wait", G.calls.includes("Promises & commitments") && G.pr==="you will not talk to Berk", JSON.stringify(G));
  ok("a changed promise is reworded in place, not filed twice", JSON.stringify(G.after)==='["you will not talk to Berk or Nil"]', JSON.stringify(G));

  console.log("\n[switches, and where it runs]");
  const H=await pg.evaluate(async()=>{
    const c=curChat(); state.calOn=false; window.__calls=[];
    window.__ft=[{items:[{kind:"meeting",action:"new",stage:"agreed",about:"x"}]}];
    await runFutureTracker(c); state.calOn=true;
    return window.__calls.map(x=>x.d);
  });
  ok("a kind that is switched off is ignored", JSON.stringify(H)==='["Future tracker"]', JSON.stringify(H));
  const I=await pg.evaluate(async()=>{
    const c=curChat(); let n=0; const real=window.chatCompletion;
    window.chatCompletion=async(m,mo,o)=>{ if(o&&o.dbg==="Future tracker"){ n++; await new Promise(r=>setTimeout(r,150)); return '{"items":[]}'; } return "{}"; };
    const p1=runFutureTracker(c); runFutureTracker(c); runFutureTracker(c);
    await p1; await new Promise(r=>setTimeout(r,500));
    window.chatCompletion=real; return n;
  });
  ok("turns that land while a pass is out are read by ONE more pass, not dropped or stacked", I===2, "passes: "+I);
  ok("postTurn, texts and calls all go through the tracker", (()=>{
    const src=require('fs').readFileSync(require('path').resolve(__dirname,'..','index.html'),'utf8');
    const pt=src.slice(src.indexOf("async function postTurn(chat){"),src.indexOf("async function postTurn(chat){")+4000);
    const direct=(src.match(/runCalendarEngine\(chat\)|runPromiseEngine\(chat\)/g)||[]).length;
    return (/runFutureTracker\(chat\)/.test(pt) && !/runPromiseEngine\(|runCalendarEngine\(/.test(pt) && direct===0)
      ? true : "direct detector calls left: "+direct; })());
  ok("the three prompts are registry prompts on one card", await pg.evaluate(()=>
    ["x_future_tracker","x_task_extract","x_future_update"].every(k=>!!K[k]&&!!up(k))
    && X_PROMPT_CARDS.some(c=>c.key==="future_tracker"&&c.keys.length===3)));

  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log(`\n  ${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail?1:0);
})();
