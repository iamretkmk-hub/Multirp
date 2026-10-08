/* v150.79 — A TOPIC EARNS ITS WEIGHT. A ledger talked over at a dinner became a goal, a quest, three meetings and dozens of
   memories, while Berker's wife in the player's lap changed nothing: what got pursued was what had momentum. Checked here,
   with the Decisions endpoint and the chat calls stubbed:
     • the weight check: a new quest, motive or goal is asked "does this matter enough to pursue for days?" with who the
       character is, their ties to the people in it, how many memories and pursuits already revolve around the topic and how
       much its memories mattered, and the rules (real stakes; a detail in passing is not one; a topic that already drives
       pursuits needs more); kept at 0.6, dropped below; a failed request takes it on as before, with the spread limit strict;
     • the spread limit: a topic already behind two other people's pursuits drops a new one before it is asked about;
     • one live quest per character (a task does not count; the setting raises it);
     • fading: untouched for three days → a quest is let go quietly, a motive spent, a goal line leaves; a scene that touches
       it keeps it; no new meeting or event is filed on a faded topic (goal pursuit, the round's plan, a follow-up);
     • the reply carries a live goal or a story thread only when the scene touches it (person here or named, a key word in
       the last lines, or why they came);
     • memories: repetition caps importance, a spouse walking in after something intimate marks the stretch;
     • the memory builder's new rule reaches an untouched stored copy only.
   Run: node tests/pursuit-weight.browser.js */
const {chromium}=require('playwright');
const path=require('path');
(async()=>{
  const b=await chromium.launch({executablePath:process.env.SM_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const ctx=await b.newContext({viewport:{width:412,height:915}});
  let pg=await ctx.newPage();
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  const INDEX='file://'+path.resolve(__dirname,'..','index.html');
  await pg.goto(INDEX); await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(600);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x===undefined?c:x).slice(0,900));} };

  const setup=()=>pg.evaluate(()=>{
    window.__reqs=[]; window.__mode="ok"; window.__calls=[];
    window.__p=(k,q)=>0.5;   // (question key, instructions) → probability of yes
    if(!window.__realFetch)window.__realFetch=window.fetch;
    window.fetch=async(url,opts)=>{
      if(String(url).indexOf("/api/alpha/decisions")>-1){
        const body=JSON.parse(opts.body); window.__reqs.push(body);
        if(window.__mode==="500") return new Response(JSON.stringify({error:{message:"upstream"}}),{status:500});
        const answers={}; Object.keys(body.questions).forEach(k=>{ answers[k]={type:"noul",noul:window.__p(k,body.questions[k].instructions)}; });
        return new Response(JSON.stringify({answers}),{status:200});
      }
      return window.__realFetch(url,opts);
    };
    window.__out={};
    window.chatCompletion=async(msgs,model,opts)=>{ const d=(opts&&opts.dbg)||""; window.__calls.push(d);
      for(const k of Object.keys(window.__out)) if(d.indexOf(k)===0) return typeof window.__out[k]==="function"?window.__out[k](msgs,d):window.__out[k];
      return "{}"; };
    const uni=state.universes[0]; state.curUniverse=uni.id;
    uni.locations=[{id:"l_home",name:"Small House",type:"home",residents:["p_o","p_b"],sublocations:[{id:"s1",name:"Living room"}]},
                   {id:"l_bar",name:"Harbour Bar",type:"bar",residents:[],sublocations:[{id:"b1",name:"Entrance"}]}];
    state.personas=[
      {id:"p_o",name:"Özlem",universeId:uni.id,personality:"Warm, watchful, hides what she feels.",backstory:"Married to Berker for twelve years.",goals:"Keep her marriage from falling apart.",look:{},
       relationships:{p_b:{tie:"husband",relationship:"Berker, twelve years married; tender and tired."},__user__:{tie:"neighbour",relationship:"Emre lives next door."},p_s:{tie:"brother-in-law",relationship:"Sami, Berker's younger brother."}}},
      {id:"p_b",name:"Berker",universeId:uni.id,personality:"Proud, careful with money.",goals:"Get Sami to pay back what he owes.",look:{},
       relationships:{p_o:{tie:"wife",relationship:"Özlem."},p_s:{tie:"younger brother",relationship:"Sami."}}},
      {id:"p_s",name:"Sami",universeId:uni.id,personality:"Charming, in debt.",goals:"Keep the bank off his back.",look:{},relationships:{p_b:{tie:"older brother",relationship:"Berker."}}},
      {id:"p_d",name:"Duygu",universeId:uni.id,personality:"Organises everyone.",goals:"Host the best dinners on the street.",look:{},relationships:{}}];
    state.user="Emre"; state.key="sk-test"; state.mem=true; state.memMinImp=0; state.memory=[];
    state.charQuestsOn=true; state.intentOn=true; state.calOn=true; state.pulseOn=true; state.goalPursuitOn=true; state.promiseOn=false;
    state.gateOn=false; state.memJudgeOn=false; state.replyCheckOn=false; state.trackDecOn=false; state.emoOn=false;
    state.pursuitWeightOn=true; state.pursuitWeightAt=0.6; state.pursuitFadeDays=3; state.cqPerChar=1; state.pursuitRelevantOn=true;
    _pursuitWeightBreak.until=0; _pursuitWeightBreak.fails=0;
    store.setRaw(K.fragAdds,FRAG_SHIPPED_ADDS.map(a=>a.key).join(",")); state.fragments=null;
    uni.gameData={charQuests:[],quests:[]}; uni.cqAsked={};
    const c=curChat(); ["activeEvent","goalAsked","goalActed","_heatBeat"].forEach(k=>{ delete c[k]; });
    Object.assign(c,{universeId:uni.id,presentIds:["p_o"],emo:{},calendar:[],intents:[],rel:{},promises:[],gameDay:4,period:"Evening",locationId:"l_home",location:"Small House",subId:"s1",subPos:{p_o:"s1"},
      worldPositions:{p_o:"l_home",p_b:"l_bar",p_s:"l_bar",p_d:"l_bar"},
      messages:[{mid:"u1",role:"user",content:'"Evening."',present:["p_o"]},{mid:"a1",role:"assistant",speaker:"Özlem",speakerId:"p_o",content:'"Come in, sit."',present:["p_o"]},{mid:"u2",role:"user",content:'"Thanks."',present:["p_o"]}]});
    window.__mem=(own,day,text,imp,extra)=>Object.assign({id:"m_"+Math.random().toString(36).slice(2),ownerId:own,content:text,type:"EXPERIENCE",importance:imp,gameDay:day,gamePeriod:"Evening",
      universeId:uni.id,chatId:c.id,date:Date.now()-1000*(10-day),source:"auto",people:[]},extra||{});
    return true;
  });
  await setup();

  console.log("\n[the weight check — a new quest]");
  const QUEST=JSON.stringify({quest:{title:"Hear the ledger figures from Sami",desc:"Get Sami to read out the ledger figures, number by number, at the table.",motive:"The notebook came up at dinner.",target:"Sami",ask:"",done_when:"Sami reads the figures.",gate:{type:"any"}}});
  const spawn=async(prob,mode)=>pg.evaluate(async([prob,mode,Q])=>{
    const uni=state.universes[0], c=curChat(); uni.gameData.charQuests=[]; uni.cqAsked={}; _pursuitWeightBreak.until=0; _pursuitWeightBreak.fails=0;
    state.memory=[__mem("p_b",4,"Sami brought up the ledger figures at dinner and I wrote two of them in the notebook.",0.5),
                  __mem("p_b",3,"Went over the ledger notebook with Özlem; the figures still do not add up.",0.4),
                  __mem("p_b",2,"Sami asked to borrow money again.",0.6)];
    window.__out={"Char quest (spawn)":Q}; window.__p=()=>prob; window.__mode=mode||"ok"; window.__reqs=[];
    const n=await runCharQuestSpawn(c,4,uni,{period:"Evening"});
    window.__mode="ok";
    const e=dbgLog.slice().reverse().find(x=>/^Pursuit weight \(Decisions\) · Berker$/.test(x.label||""));
    return {n,filed:uni.gameData.charQuests.map(q=>({t:q.title,h:q.holderName,touched:q.touchedDay,src:(q.srcMems||[]).length})),
      req:window.__reqs.find(r=>r.questions&&r.questions.w0)||null,row:e?{label:e.label,status:e.status,result:e.result}:null,note:uni.cqLastSpawn&&uni.cqLastSpawn.reason};
  },[prob,mode||"ok",QUEST]);
  const s1=await spawn(0.9);
  ok("a weighty pursuit (90%) is filed, with the day it was last touched and the memories it grew out of", s1.n===1&&s1.filed.length===1&&s1.filed[0].touched===4&&s1.filed[0].src===2, JSON.stringify(s1.filed));
  const q=s1.req&&s1.req.questions.w0;
  ok("one Decisions request, one yes/no question for the candidate", !!q&&q.type==="noul"&&Object.keys(s1.req.questions).length===1, JSON.stringify(s1.req&&Object.keys(s1.req.questions)));
  ok("the question asks if it matters enough to pursue for days, with the candidate and who it involves",
     !!q&&/Does this matter enough to Berker to pursue for days\?/.test(q.instructions)&&/a personal quest\): "Hear the ledger figures from Sami"/.test(q.instructions)&&/It involves: Sami\./.test(q.instructions), q&&q.instructions);
  ok("…how many memories and pursuits already revolve around it, and how much its memories mattered",
     !!q&&/2 of Berker's memories from the last seven days are about it; 0 live pursuits already revolve around it\./.test(q.instructions)&&/the strongest of them has importance 3 of 5/.test(q.instructions), q&&q.instructions);
  ok("…and the rules: real stakes; a detail in passing is not one; a topic that already drives pursuits needs MORE weight",
     !!q&&/money that changes a life, a marriage or relationship at stake, someone's safety, a betrayal, a secret that could come out, a career, or a child/.test(q.instructions)
     &&/a book, a chore, a figure, a bill — is not a pursuit unless it carries one of those/.test(q.instructions)&&/needs MORE weight to spawn another, not less/.test(q.instructions)
     &&/YES:/.test("YES: "+q.criteria.true)&&/repeated/.test(q.criteria.false), q&&JSON.stringify(q));
  ok("the state is who the character is and their ties to the people it involves",
     !!s1.req&&s1.req.state.character.name==="Berker"&&/Proud, careful with money/.test(s1.req.state.character.who_they_are)&&s1.req.state.their_ties_to_the_people_involved.some(t=>/^Sami: younger brother/.test(t)), JSON.stringify(s1.req&&s1.req.state));
  ok("its Debug row is \"Pursuit weight (Decisions) · Berker\", with the probability and that it was kept",
     !!s1.row&&s1.row.status==="ok"&&s1.row.result.threshold===0.6&&s1.row.result.answers[0].kept===true&&s1.row.result.answers[0].p===0.9, JSON.stringify(s1.row));
  const s2=await spawn(0.3);
  ok("a detail that came up in passing (30%) is dropped — it stays a memory, nothing more", s2.n===0&&s2.filed.length===0&&/did not matter enough/.test(s2.note||"")&&s2.row&&s2.row.result.answers[0].kept===false, JSON.stringify(s2));
  const s3=await spawn(0.9,"500");
  ok("a failed request takes it on as before (the topic is not behind two pursuits)", s3.filed.length===1&&s3.row&&s3.row.status==="error", JSON.stringify(s3));
  ok("…and with the weight check switched off, nothing is sent and the same rule applies", await pg.evaluate(async Q=>{
      const uni=state.universes[0]; uni.gameData.charQuests=[]; uni.cqAsked={}; state.pursuitWeightOn=false; window.__reqs=[]; window.__out={"Char quest (spawn)":Q};
      await runCharQuestSpawn(curChat(),4,uni,{period:"Evening"}); state.pursuitWeightOn=true;
      return (window.__reqs.length===0&&uni.gameData.charQuests.length===1)?true:JSON.stringify([window.__reqs.length,uni.gameData.charQuests.length]); },QUEST));
  ok("a failed request with the topic already behind two pursuits (anyone's — his own goal included) drops it: the limit, strictly", await pg.evaluate(async Q=>{
      const uni=state.universes[0], c=curChat(); uni.gameData.charQuests=[]; uni.cqAsked={}; _pursuitWeightBreak.until=0; _pursuitWeightBreak.fails=0;
      state.memory=[__mem("p_b",4,"Sami brought up the ledger figures at dinner.",0.5)];
      state.personas.find(p=>p.id==="p_b").goalsLive={lines:["Make Sami read the ledger figures out loud"],day:3};
      c.intents=[{id:"i_x",holderId:"p_b",holderName:"Berker",targetId:"p_s",targetName:"Sami",kind:"grievance",valence:"hostile",aim:"make Sami account for every ledger figure",status:"brewing",strength:0.6,born:3,touchedDay:3}];
      window.__mode="500"; window.__out={"Char quest (spawn)":Q}; window.__reqs=[];
      await runCharQuestSpawn(c,4,uni,{period:"Evening"}); window.__mode="ok";
      delete state.personas.find(p=>p.id==="p_b").goalsLive; c.intents=[];
      const row=dbgLog.slice().reverse().find(x=>/^Pursuit spread · Berker$/.test(x.label||""));
      return (uni.gameData.charQuests.length===0&&row&&/already behind two pursuits/.test(JSON.stringify(row.payload)))?true:JSON.stringify([uni.gameData.charQuests.length,row&&row.payload]); },QUEST));

  console.log("\n[the weight check — a new motive, a new goal]");
  const iv=await pg.evaluate(async()=>{
    const c=curChat(); c.intents=[]; _pursuitWeightBreak.until=0; _pursuitWeightBreak.fails=0;
    state.memory=[__mem("p_o",4,"Berker opened the ledger notebook at dinner and read the water bill aloud.",0.6),
                  __mem("p_o",4,"Duygu said she saw Berker with another woman at the harbour.",0.8)];
    window.__out={"Intent form":JSON.stringify({intents:[
      {kind:"ambition",valence:"self_serving",target:"Berker",trigger:"the ledger at dinner",aim:"get Berker to show her the water bill figures in the notebook",strength:0.6,priority:"medium"},
      {kind:"grievance",valence:"hostile",target:"Berker",trigger:"Duygu's story about the harbour",aim:"find out whether Berker is seeing another woman",strength:0.7,priority:"high"}],revise:[]})};
    window.__p=(k,t)=>/water bill/.test(t)?0.2:0.85; window.__reqs=[];
    await runIntentEngine(c,4,state.curUniverse,{tick:false,period:"Evening"});
    const r=window.__reqs.filter(x=>x.questions.w0);
    return {aims:c.intents.map(i=>i.aim),reqs:r.length,qs:r[0]?Object.keys(r[0].questions).length:0,kinds:r[0]?Object.values(r[0].questions).map(x=>(x.instructions.match(/\(([a-z ]+)\): "/)||[])[1]):[],
      touched:c.intents.map(i=>i.touchedDay)};
  });
  ok("both new motives are weighed in ONE request (a private motive each)", iv.reqs===1&&iv.qs===2&&iv.kinds.every(k=>k==="a private motive"), JSON.stringify(iv));
  ok("the water bill (20%) is dropped, the affair (85%) is carried, touched today", iv.aims.length===1&&/another woman/.test(iv.aims[0])&&iv.touched[0]===4, JSON.stringify(iv));
  const gc=await pg.evaluate(async()=>{
    const c=curChat(); c.intents=[]; _pursuitWeightBreak.until=0; _pursuitWeightBreak.fails=0;
    const p=state.personas.find(x=>x.id==="p_o"); p.goalsLive={lines:["Keep Berker from finding out about the harbour"],day:3,meta:{"Keep Berker from finding out about the harbour":{born:2,touched:3}}};
    state.memory=[__mem("p_o",4,"Berker read the water bill from the ledger notebook again.",0.4),__mem("p_o",4,"Duygu hinted she knows about the harbour.",0.8),
                  __mem("p_o",3,"Berker counted the figures in the ledger notebook twice.",0.4),__mem("p_o",4,"Berker left the ledger notebook on the table all evening.",0.3)];
    window.__out={"Goals curator":JSON.stringify({goals:["Keep Berker from finding out about the harbour, whatever it costs","Say out loud to Berker one thing about the notebook","Learn what Duygu really knows"],changed:"x"})};
    window.__p=(k,t)=>/notebook/.test(t)?0.25:0.8; window.__reqs=[];
    await _curateGoalsFor(c,p,4,state.curUniverse,5);
    const r=window.__reqs.filter(x=>x.questions.w0);
    return {lines:p.goalsLive.lines,meta:p.goalsLive.meta,reqs:r.length,asked:r[0]?Object.values(r[0].questions).map(x=>(x.instructions.match(/"([^"]+)"/)||[])[1]):[],
      q:r[0]?Object.values(r[0].questions).find(x=>/notebook/.test(x.instructions)).instructions:""};
  });
  ok("the goals curator: a reworded line is not asked about; the two new ones are, in one request", gc.reqs===1&&gc.asked.length===2&&!gc.asked.some(t=>/harbour/.test(t)), JSON.stringify(gc.asked));
  ok("…the notebook line (25%) is left out, the rest kept", gc.lines.length===2&&!gc.lines.some(l=>/notebook/.test(l))&&gc.lines.some(l=>/Duygu/.test(l)), JSON.stringify(gc.lines));
  ok("…a kept line carries the meta of the line it rewords (born, touched); a new one starts today", gc.meta["Keep Berker from finding out about the harbour, whatever it costs"].born===2&&gc.meta["Learn what Duygu really knows"].born===4&&gc.meta["Learn what Duygu really knows"].touched===4, JSON.stringify(gc.meta));
  ok("…and the notebook's question says how much it already fills her days", /3 of Özlem's memories from the last seven days are about it/.test(gc.q), gc.q);

  console.log("\n[the spread limit]");
  const sat=await pg.evaluate(async()=>{
    const uni=state.universes[0], c=curChat(); uni.gameData.charQuests=[]; uni.cqAsked={}; c.intents=[];
    state.personas.find(p=>p.id==="p_b").goalsLive={lines:["Make Sami read the ledger figures out loud"],day:3};
    state.personas.find(p=>p.id==="p_s").goalsLive={lines:["Keep the ledger figures away from Berker"],day:3};
    state.memory=[__mem("p_o",4,"Berker and Sami fought over the ledger figures at dinner.",0.5)];
    window.__out={"Char quest (spawn)":JSON.stringify({quest:{title:"Settle the ledger figures between them",desc:"Get Berker and Sami to agree on the ledger figures.",motive:"the fight",target:"Berker",gate:{type:"any"}}})};
    window.__p=()=>0.95; window.__reqs=[];
    await runCharQuestSpawn(c,4,uni,{period:"Evening"});
    const row=dbgLog.slice().reverse().find(x=>/^Pursuit spread · Özlem$/.test(x.label||""));
    const out={filed:uni.gameData.charQuests.length,weightReqs:window.__reqs.filter(x=>x.questions.w0).length,row:row&&row.payload};
    // a different topic for the same person is not affected
    uni.cqAsked={}; window.__out={"Char quest (spawn)":JSON.stringify({quest:{title:"Find out who Berker met at the harbour",desc:"Follow the story Duygu told.",motive:"the rumour",target:"Duygu",gate:{type:"any"}}})};
    await runCharQuestSpawn(c,4,uni,{period:"Evening"});
    out.other=uni.gameData.charQuests.map(q=>q.title);
    delete state.personas.find(p=>p.id==="p_b").goalsLive; delete state.personas.find(p=>p.id==="p_s").goalsLive;
    return out;
  });
  ok("a topic already driving two other people's pursuits (Berker's and Sami's) drops a third before any weight request", sat.filed===0&&sat.weightReqs===0&&/already drives Berker and Sami/.test(JSON.stringify(sat.row)), JSON.stringify(sat));
  ok("…while a pursuit on another topic is taken on", sat.other.length===1&&/harbour/.test(sat.other[0]), JSON.stringify(sat.other));
  ok("topics: the same overlap measure (two key words, or one and a person, or a source memory); names and filler are not key words", await pg.evaluate(()=>{
    const T=(t,o)=>pursuitTopic(t,Object.assign({uid:state.curUniverse},o||{}));
    const a=T("Say out loud to Berker one thing about the notebook",{self:"p_o"}), b=T("Dinner That Outlasts Berker's Ledger: Berker is bringing the notebook",{self:"p_o"});
    const c=T("Make Duygu's dinner the best on the street"), d=T("x",{src:["m1"]}), e=T("y",{src:["m1"]});
    const r={ab:topicSame(a,b),abStrict:topicSame(a,b,true),ac:topicSame(a,c),de:topicSame(d,e),stems:[...a.stems],people:[...a.people]};
    return (r.ab&&!r.abStrict&&!r.ac&&r.de&&r.stems.join(",")==="noteb"&&r.people.join(",")==="p_b")?true:JSON.stringify(r); }));

  console.log("\n[one live quest per character]");
  const cap=await pg.evaluate(async()=>{
    const uni=state.universes[0], c=curChat(); uni.cqAsked={}; c.intents=[];
    uni.gameData.charQuests=[{id:"cq_1",holderId:"p_o",holderName:"Özlem",targetId:"p_d",targetName:"Duygu",title:"Win Duygu over",desc:"x",status:"active",createdDay:3,touchedDay:4,progress:[]}];
    state.memory=[__mem("p_o",4,"Duygu said something cruel about the harbour.",0.8)];
    window.__out={"Char quest (spawn)":JSON.stringify({quest:{title:"Find out who Berker met at the harbour",desc:"Follow the story.",motive:"m",target:"Duygu",gate:{type:"any"}}})};
    window.__p=()=>0.95; window.__calls=[];
    await runCharQuestSpawn(c,4,uni,{period:"Evening"});
    const one={asked:window.__calls.filter(d=>/^Char quest \(spawn\)/.test(d)).length,n:uni.gameData.charQuests.length,note:uni.cqLastSpawn&&uni.cqLastSpawn.reason};
    // an agreed task does not take the slot
    uni.gameData.charQuests[0].source="task"; uni.cqAsked={}; window.__calls=[];
    await runCharQuestSpawn(c,4,uni,{period:"Evening"});
    const task={asked:window.__calls.filter(d=>/^Char quest \(spawn\)/.test(d)).length,n:uni.gameData.charQuests.length};
    // the setting raises it
    uni.gameData.charQuests=[uni.gameData.charQuests[0]]; uni.gameData.charQuests[0].source=undefined; uni.cqAsked={}; state.cqPerChar=2; window.__calls=[];
    await runCharQuestSpawn(c,4,uni,{period:"Evening"}); state.cqPerChar=1;
    const two={asked:window.__calls.filter(d=>/^Char quest \(spawn\)/.test(d)).length,n:uni.gameData.charQuests.length};
    return {one,task,two};
  });
  ok("a character carrying one live quest is not asked for another", cap.one.asked===0&&cap.one.n===1&&/already carrying one/.test(cap.one.note||""), JSON.stringify(cap.one));
  ok("an agreed task does not take the slot", cap.task.asked===1&&cap.task.n===2, JSON.stringify(cap.task));
  ok("Live quests per character = 2 lets a second one in", cap.two.asked===1&&cap.two.n===2, JSON.stringify(cap.two));

  console.log("\n[fading]");
  const fd=await pg.evaluate(async()=>{
    const uni=state.universes[0], c=curChat(); c.gameDay=4; c.calendar=[];
    uni.gameData.charQuests=[
      {id:"cq_l",holderId:"p_o",holderName:"Özlem",targetId:"p_b",targetName:"Berker",title:"Dinner That Outlasts Berker's Ledger",desc:"Keep Berker away from the ledger notebook at dinner.",status:"active",createdDay:1,touchedDay:1,progress:[]},
      {id:"cq_h",holderId:"p_d",holderName:"Duygu",targetId:"p_b",targetName:"Berker",title:"Find out who Berker met at the harbour",desc:"x",status:"active",createdDay:1,touchedDay:1,progress:[]},
      {id:"cq_t",holderId:"p_s",holderName:"Sami",targetId:"p_b",targetName:"Berker",title:"Pay Berker back",desc:"x",status:"active",createdDay:1,progress:[],source:"task"},
      {id:"cq_n",holderId:"p_b",holderName:"Berker",targetId:"p_s",targetName:"Sami",title:"Old pursuit",desc:"x",status:"active",createdDay:1,progress:[]}];
    c.intents=[{id:"i_l",holderId:"p_b",holderName:"Berker",targetId:"p_s",targetName:"Sami",kind:"grievance",valence:"hostile",aim:"hear the water bill figures from Sami",status:"brewing",strength:0.6,born:1,touchedDay:1},
               {id:"i_a",holderId:"p_b",holderName:"Berker",targetId:"p_s",targetName:"Sami",kind:"grievance",valence:"hostile",aim:"x",status:"armed",strength:0.9,born:1,touchedDay:1}];
    state.personas.find(p=>p.id==="p_o").goalsLive={lines:["Keep her marriage from falling apart","Say out loud to Berker one thing about the notebook"],day:2,
      meta:{"Keep her marriage from falling apart":{born:1,touched:1},"Say out loud to Berker one thing about the notebook":{born:1,touched:1}}};
    // the harbour comes up in the player's scene with Duygu there: touched today
    c.presentIds=["p_o","p_d"]; c.messages.push({mid:"a9",role:"assistant",speaker:"Duygu",speakerId:"p_d",content:'"I saw who Berker met at the harbour."',present:["p_o","p_d"]});
    const touched=pursuitTouchTick(c);
    const nMsgs=c.messages.length;
    const n=pursuitFadeSweep(c,4,uni);
    const Q=id=>uni.gameData.charQuests.find(q=>q.id===id);
    return {touched,n,ledger:{status:Q("cq_l").status,faded:Q("cq_l").faded,lapsed:Q("cq_l").lapsed,result:Q("cq_l").result},harbour:Q("cq_h").status,harbourTouched:Q("cq_h").touchedDay,
      task:Q("cq_t").status,legacy:{status:Q("cq_n").status,touched:Q("cq_n").touchedDay},bubbles:c.messages.length-nMsgs,
      intent:{status:c.intents[0].status,faded:c.intents[0].faded},armed:c.intents[1].status,
      goals:state.personas.find(p=>p.id==="p_o").goalsLive.lines,fadedGoals:(state.personas.find(p=>p.id==="p_o").goalsLive.faded||[]).map(f=>f.text),
      memories:state.memory.filter(m=>m.source==="char_quest").length,
      status:pursuitStatusBlock([state.personas.find(p=>p.id==="p_o")],c)};
  });
  ok("a scene that touches a pursuit (the harbour, Duygu here) marks it touched today, and it does not fade", fd.touched>=1&&fd.harbourTouched===4&&fd.harbour==="active", JSON.stringify(fd));
  ok("the ledger quest untouched for three days fades: let go, marked faded, quietly (no bubble, no memory)", fd.ledger.status==="failed"&&fd.ledger.faded===true&&fd.ledger.lapsed===true&&/faded/.test(fd.ledger.result)&&fd.bubbles===0&&fd.memories===0, JSON.stringify(fd));
  ok("the untouched motive is spent and marked faded; an armed plan is left alone", fd.intent.status==="spent"&&fd.intent.faded===true&&fd.armed==="armed", JSON.stringify(fd.intent));
  ok("the notebook goal leaves the list (kept as faded); the authored goal never fades", fd.goals.length===1&&fd.goals[0]==="Keep her marriage from falling apart"&&fd.fadedGoals[0]==="Say out loud to Berker one thing about the notebook", JSON.stringify(fd.goals));
  ok("an agreed task is not timed out here; a pursuit from before v150.79 starts counting today", fd.task==="active"&&fd.legacy.status==="active"&&fd.legacy.touched===4, JSON.stringify([fd.task,fd.legacy]));
  ok("the engines' pursuit status no longer reports the faded quest as news", !/Ledger/.test(fd.status), fd.status);
  ok("0 days = never fades", await pg.evaluate(()=>{ const c=curChat(), uni=state.universes[0]; state.pursuitFadeDays=0;
    uni.gameData.charQuests=[{id:"z",holderId:"p_o",holderName:"Özlem",targetId:"p_b",title:"t",desc:"x",status:"active",createdDay:1,touchedDay:1,progress:[]}];
    const n=pursuitFadeSweep(c,20,uni); state.pursuitFadeDays=3; return (n===0&&uni.gameData.charQuests[0].status==="active")?true:n; }));

  console.log("\n[no new meeting or event from a faded pursuit]");
  const wb=await pg.evaluate(async()=>{
    const uni=state.universes[0], c=curChat(); c.calendar=[]; c.goalAsked={}; c.goalActed={}; c.presentIds=["p_o"];
    uni.gameData.charQuests=[{id:"cq_l",holderId:"p_b",holderName:"Berker",targetId:"p_s",targetName:"Sami",title:"Hear the ledger figures from Sami",desc:"Sami reads the ledger figures aloud.",status:"failed",faded:true,lapsed:true,createdDay:1,completedDay:4,progress:[]}];
    c.intents=[];
    state.personas.forEach(p=>{ delete p.goalsLive; });
    state.memory=[__mem("p_b",4,"Thought about the ledger again.",0.4)];
    window.__out={"World pulse (goal pursuit) · Berker":JSON.stringify({acted:true,plan:{title:"Sami'nin borcunu rakam rakam dinle",detail:"Make Sami read the ledger figures aloud, one by one.",day:5,period:"Evening",with:"Sami",where:"Harbour Bar"}}),
      "World pulse (goal pursuit)":JSON.stringify({acted:false})};
    await runGoalPursuit(c,4,uni,"Evening");
    const gp=c.calendar.length;
    // the round's plan, and a follow-up
    _roundPlan(c,{title:"Ledger night",detail:"Berker sits Sami down to go through the ledger figures.",dayOffset:1},[state.personas.find(p=>p.id==="p_b"),state.personas.find(p=>p.id==="p_s")],4,"Evening");
    const rp=c.calendar.length;
    const fu=_calExecFollowup(c,{headline:"x",event:"y",followup:{title:"Ledger figures again",why:"go through the ledger figures",day:5,who:"Berker, Sami"}},{title:"x",who:"Berker"},[],4);
    // an unrelated plan is filed as before
    _roundPlan(c,{title:"Fishing trip",detail:"Berker and Sami take the boat out at dawn.",dayOffset:1},[state.personas.find(p=>p.id==="p_b"),state.personas.find(p=>p.id==="p_s")],4,"Evening");
    const rows=dbgLog.filter(x=>/ · not filed$/.test(x.label||"")).slice(-3).map(x=>x.label+" — "+JSON.stringify(x.payload));
    return {gp,rp,fu:!!fu,after:c.calendar.map(e=>e.title),rows};
  });
  ok("goal pursuit does not file a meeting on Berker's faded ledger pursuit", wb.gp===0, JSON.stringify(wb));
  ok("nor does the round's plan, nor a calendar follow-up", wb.rp===0&&wb.fu===false, JSON.stringify(wb));
  ok("each says why on the Debug screen", wb.rows.length===3&&wb.rows.every(r=>/has faded/.test(r)), JSON.stringify(wb.rows));
  ok("an unrelated plan is filed as before", wb.after.length===1&&wb.after[0]==="Fishing trip", JSON.stringify(wb.after));
  ok("a meeting it made before fading stays on the calendar", await pg.evaluate(()=>{ const c=curChat(); c.calendar=[{id:"c_old",kind:"meeting",title:"Ledger night",who:"Berker, Sami",day:5,done:false}];
    pursuitFadeSweep(c,5,state.universes[0]); return c.calendar.length===1&&!c.calendar[0].done; }));

  console.log("\n[the reply carries a pursuit only when the scene touches it]");
  const rp=await pg.evaluate(()=>{
    const c=curChat(), p=state.personas.find(x=>x.id==="p_o"), uni=state.universes[0];
    c.presentIds=["p_o"]; c.calendar=[]; c.intents=[]; delete c.activeEvent;
    c.messages=[{mid:"u1",role:"user",content:'"Evening."',present:["p_o"]},{mid:"a1",role:"assistant",speaker:"Özlem",speakerId:"p_o",content:'"Come in, sit."',present:["p_o"]},{mid:"u2",role:"user",content:'"Thanks."',present:["p_o"]}];
    p.goalsLive={lines:["Say out loud to Berker one thing about the notebook","Keep the garden alive through the summer"],day:3};
    uni.gameData.quests=[{id:"q1",title:"The missing ledger",desc:"Someone took the ledger from the shop.",npcId:"p_o",startActive:true,progress:[]}];
    const build=()=>{ const B=Object.assign({},buildCharPromptBlocks(p,[],{recent:[],diary:[],longterm:[]},null,{chat:c,targetName:"Emre",targetId:"__user__",payloadKind:"solo"}),
        buildTailBlocks({chat:c,selfP:p,selfId:p.id,selfName:p.name,targetName:"Emre",targetId:"__user__",injected:{recent:[],diary:[],longterm:[]},payloadKind:"solo"}));
      return ptBuildMessages("solo",B,[{role:"user",content:"(history)"}],{chat:c,npc:p,targetName:"Emre"}).map(m=>m.content).join("\n"); };
    const t0=build();
    c.messages.push({mid:"u3",role:"user",content:'"Is Berker home tonight?"',present:["p_o"]});
    const tName=build();
    c.messages.pop(); c.messages.push({mid:"u3",role:"user",content:'"How is the garden doing?"',present:["p_o"]});
    const tTerm=build();
    c.messages.pop(); c.presentIds=["p_o","p_b"];
    const tHere=build(); c.presentIds=["p_o"];
    c.activeEvent={kind:"overture",accuserId:"p_o",intent:"Özlem comes to Emre about the notebook Berker keeps.",summary:"about the notebook",_startMsg:0};
    const tEvent=build(); delete c.activeEvent;
    c.messages.push({mid:"u4",role:"user",content:'"Did anyone find the ledger?"',present:["p_o"]});
    const tQuest=build(); c.messages.pop();
    state.pursuitRelevantOn=false; const tOff=build(); state.pursuitRelevantOn=true;
    const has=(t,s)=>t.indexOf(s)>=0, NB="Say out loud to Berker one thing about the notebook", GD="Keep the garden alive through the summer", QL="The missing ledger";
    return {none:[has(t0,NB),has(t0,GD),has(t0,QL),/<goals_and_ambitions>|<goals_ambitions>/.test(t0)],name:[has(tName,NB),has(tName,GD)],term:[has(tTerm,NB),has(tTerm,GD)],here:[has(tHere,NB),has(tHere,GD)],
      event:[has(tEvent,NB),has(tEvent,GD)],quest:has(tQuest,QL),off:[has(tOff,NB),has(tOff,GD),has(tOff,QL)]};
  });
  ok("a scene that touches neither leaves both goals, the story thread and the goals section out (the authored goals do not stand in)", rp.none.every(x=>x===false), JSON.stringify(rp.none));
  ok("Berker named in the last lines brings the notebook goal (only)", rp.name[0]===true&&rp.name[1]===false, JSON.stringify(rp.name));
  ok("a key word of it in the last lines brings the garden goal (only)", rp.term[0]===false&&rp.term[1]===true, JSON.stringify(rp.term));
  ok("Berker in the room brings the notebook goal", rp.here[0]===true&&rp.here[1]===false, JSON.stringify(rp.here));
  ok("an active event she came for, about the notebook, brings it", rp.event[0]===true&&rp.event[1]===false, JSON.stringify(rp.event));
  ok("the story thread rides when its word comes up", rp.quest===true, JSON.stringify(rp));
  ok("with the switch off, every pursuit rides as before", rp.off.every(x=>x===true), JSON.stringify(rp.off));

  console.log("\n[memories: a spike, not a repeat]");
  const mm=await pg.evaluate(async()=>{
    const uni=state.universes[0], c=curChat();
    const mk=(role,sid,name,t,pres,extra)=>Object.assign({mid:"x"+Math.random().toString(36).slice(2),role,speaker:role==='user'?undefined:name,speakerId:sid,content:t,present:pres},extra||{});
    // (b) the ledger again: three earlier memories of it at 0.5 / 0.4 / 0.5; the builder scores this one 0.75
    state.memory=[__mem("p_o",4,"In the morning Berker checked the ledger notebook figures against the water bill.",0.5,{gamePeriod:"Morning"}),
                  __mem("p_o",3,"Berker read the ledger notebook figures and the water bill again after dinner.",0.4),
                  __mem("p_o",2,"The ledger notebook with the water bill figures stayed open on the table.",0.5)];
    window.__out={"Memory (arc) · Özlem":JSON.stringify({content:"Berker took out the ledger notebook again and read the water bill figures aloud at dinner.",people:["Berker"],emotion:"tense",feelings:"tired of it",importance_score:0.75,type:"EXPERIENCE",status:""})};
    c.presentIds=["p_o"]; c.messages=[mk('user',null,"","\"So the bill?\"",["p_o"]),mk('assistant',"p_o","Özlem",'"He read it out again."',["p_o"]),mk('user',null,"",'"Again?"',["p_o"]),mk('assistant',"p_o","Özlem",'"Again."',["p_o"])];
    await commitMemoryArc(c,0,3,4,"Evening");
    const rep=state.memory.filter(m=>/took out the ledger notebook again/.test(m.content)).map(m=>({imp:m.importance,cap:m.repeatCapped}))[0];
    // a different, real moment is not capped
    window.__out={"Memory (arc) · Özlem":JSON.stringify({content:"Duygu told me she saw Berker with another woman at the harbour.",people:["Duygu"],emotion:"fearful",feelings:"x",importance_score:0.8,type:"EXPERIENCE",status:"open"})};
    c.messages=c.messages.map(m=>Object.assign({},m,{mid:"y"+Math.random().toString(36).slice(2)}));
    await commitMemoryArc(c,0,3,4,"Evening");
    const other=state.memory.filter(m=>/another woman/.test(m.content)).map(m=>m.importance)[0];
    // (c) on his lap, then her husband walks in
    state.memory=[];
    window.__out={"Memory (arc) · Özlem":JSON.stringify({content:"I was with Emre on the sofa when Berker came home early.",people:["Emre","Berker"],emotion:"fearful",feelings:"x",importance_score:0.4,type:"EXPERIENCE",status:""}),
      "Memory (arc) · Berker":JSON.stringify({content:"I came home early and found Özlem with Emre in the living room.",people:["Özlem","Emre"],emotion:"angry",feelings:"x",importance_score:0.5,type:"EXPERIENCE",status:""})};
    c.presentIds=["p_o","p_b"];
    c.messages=[mk('user',null,"",'*Emre pulls her onto his lap and kisses her neck.*',["p_o"]),mk('assistant',"p_o","Özlem",'*She sits onto his lap, kisses him back and moans softly.* "Not here…"',["p_o"]),
      mk('system',null,"","Berker arrives.",["p_o","p_b"],{presenceNote:true,enteredIds:["p_b"]}),
      mk('assistant',"p_b","Berker",'"Özlem? What is going on here?"',["p_o","p_b"]),mk('user',null,"",'"Berker — it is not what it looks like."',["p_o","p_b"]),mk('assistant',"p_o","Özlem",'"Berker, wait."',["p_o","p_b"])];
    await commitMemoryArc(c,2,5,4,"Evening");
    const sp=state.memory.filter(m=>m.ownerId==="p_o"||m.ownerId==="p_b").map(m=>({o:m.ownerId,imp:m.importance,st:m.status,spike:m.spike}));
    // the same arrival with nothing intimate or secret before it: nothing is marked
    state.memory=[];
    c.messages=[mk('user',null,"",'"Do you want more tea?"',["p_o"]),mk('assistant',"p_o","Özlem",'"Yes, please."',["p_o"]),
      mk('system',null,"","Berker arrives.",["p_o","p_b"],{presenceNote:true,enteredIds:["p_b"]}),
      mk('assistant',"p_b","Berker",'"Özlem? Emre? Evening."',["p_o","p_b"]),mk('user',null,"",'"Evening, Berker."',["p_o","p_b"]),mk('assistant',"p_o","Özlem",'"Sit with us."',["p_o","p_b"])];
    await commitMemoryArc(c,2,5,4,"Evening");
    const plain=state.memory.filter(m=>m.ownerId==="p_o"||m.ownerId==="p_b").map(m=>({o:m.ownerId,imp:m.importance,st:m.status||""}));
    return {rep,other,sp,plain};
  });
  ok("the ledger talked over a fourth time is capped at the highest of the three before it (0.75 → 0.5)", !!mm.rep&&mm.rep.imp===0.5&&mm.rep.cap===3, JSON.stringify(mm.rep));
  ok("a different, real moment keeps its importance", mm.other===0.8, JSON.stringify(mm.other));
  ok("her husband walks in after the lap and the kiss: both memories weigh at least 0.8", mm.sp.length===2&&mm.sp.every(x=>x.imp>=0.8&&x.spike==="intimate"), JSON.stringify(mm.sp));
  ok("…with a status: open for Berker, who walked in; secret for her", mm.sp.find(x=>x.o==="p_b").st==="open"&&mm.sp.find(x=>x.o==="p_o").st==="secret", JSON.stringify(mm.sp));
  ok("the same arrival over tea marks nothing", mm.plain.length===2&&mm.plain.every(x=>x.imp<0.8&&!x.st), JSON.stringify(mm.plain));
  ok("the memory builder is told: repetition is not importance, a spike is", await pg.evaluate(()=>{
    const t=DEFAULT_MEMBUILD; return (/Repetition is not importance either\. The same everyday topic coming up\n  again/.test(t)&&/a secret nearly\n  exposed, a spouse or partner walking in on someone with another person/.test(t)&&t.indexOf(MEMBUILD_RULE_V150_79)>=0)?true:"missing"; }));

  console.log("\n[the prompt, the settings]");
  ok("x_pursuit_weight is a registry prompt on the Strict gates card", await pg.evaluate(()=>{
    const card=ENGINE_PAYLOAD_DEFS.find(d=>d.key==="strict_gates");
    return (PROMPT_BY_KEY.x_pursuit_weight&&card&&card.blocks.some(x=>x.promptKey==="x_pursuit_weight"))?true:"missing"; }));
  ok("an edited weight prompt is what is asked", await pg.evaluate(async()=>{
    const uni=state.universes[0]; uni.gameData.charQuests=[]; uni.cqAsked={}; _pursuitWeightBreak.until=0; _pursuitWeightBreak.fails=0;
    state.x_pursuit_weight="MY RULE for {{char}}: {{title}} / {{echo}}\nYES: it matters\nNO: it does not";
    state.memory=[__mem("p_b",4,"Sami asked about the harbour boat.",0.5)];
    window.__out={"Char quest (spawn)":JSON.stringify({quest:{title:"Buy back the harbour boat",desc:"x",motive:"m",target:"Sami",gate:{type:"any"}}})}; window.__reqs=[]; window.__p=()=>0.9;
    await runCharQuestSpawn(curChat(),4,uni,{period:"Evening"}); state.x_pursuit_weight=X_ENGINE_PROMPTS.x_pursuit_weight.def;
    const r=window.__reqs.find(x=>x.questions.w0); const q=r&&r.questions.w0;
    return (q&&/^MY RULE for Berker: Buy back the harbour boat \/ /.test(q.instructions)&&q.criteria.true==="it matters")?true:JSON.stringify(q); }));
  ok("settings round-trip; a fresh install has the check on at 0.6, fading at 3 days, one quest each, replies scene-scoped", await pg.evaluate(()=>{
    state.pursuitWeightOn=false; state.pursuitWeightAt=0.75; state.pursuitFadeDays=5; state.cqPerChar=2; state.pursuitRelevantOn=false; syncSettingsUI();
    const g=id=>document.getElementById(id);
    if(!g('setPursuitWeightOn')||!g('setPursuitWeightAt')||!g('setPursuitFadeDays')||!g('setCqPerChar')||!g('setPursuitRelevantOn'))return "inputs missing";
    if(g('setPursuitWeightOn').checked||+g('setPursuitWeightAt').value!==0.75||+g('setPursuitFadeDays').value!==5||+g('setCqPerChar').value!==2||g('setPursuitRelevantOn').checked)return "sync";
    g('setPursuitWeightOn').checked=true; g('setPursuitWeightAt').value="0.65"; g('setPursuitFadeDays').value="0"; g('setCqPerChar').value="1"; g('setPursuitRelevantOn').checked=true;
    saveSettings(false);
    if(!(state.pursuitWeightOn===true&&state.pursuitWeightAt===0.65&&state.pursuitFadeDays===0&&state.cqPerChar===1&&state.pursuitRelevantOn===true))return "save "+JSON.stringify([state.pursuitWeightAt,state.pursuitFadeDays]);
    if(store.raw(K.pursuitWeightAt,"")!=="0.65"||store.raw(K.pursuitFadeDays,"")!=="0")return "persist";
    [K.pursuitWeightOn,K.pursuitWeightAt,K.pursuitFadeDays,K.cqPerChar,K.pursuitRelevantOn].forEach(k=>store.del(k));
    state.pursuitWeightOn=undefined; state.pursuitWeightAt=undefined; state.pursuitFadeDays=undefined; state.cqPerChar=undefined; state.pursuitRelevantOn=undefined;
    return (pursuitWeightReady()===true&&pursuitWeightAt()===0.6&&pursuitFadeDays()===3&&cqPerChar()===1&&pursuitRelevantOn()===true)?true:"defaults"; }));
  ok("the weight check is a Decisions feature of its own in the prompt editor", require('fs').readFileSync(path.resolve(__dirname,'..','prompt-editor.html'),'utf8').indexOf('{name:"Pursuit weight",')>=0);

  console.log("\n[the memory builder's new rule reaches an untouched stored copy only]");
  const OLD=await pg.evaluate(()=>DEFAULT_MEMBUILD.replace(MEMBUILD_RULE_V150_79,"").trim());
  await pg.evaluate(o=>{ localStorage.setItem(K.memBuild,o);
    const u=state.universes[0]; u.prompts=u.prompts||{}; u.prompts.memBuild=o+"\n\nMY OWN LAST LINE"; persistUniverses(); },OLD);
  await pg.waitForTimeout(600);
  await pg.reload(); await pg.waitForTimeout(2600);
  const up=await pg.evaluate(()=>({stored:state.memBuild===DEFAULT_MEMBUILD,uni:((state.universes[0].prompts||{}).memBuild||""),def:DEFAULT_MEMBUILD}));
  ok("a stored copy that is exactly the v150.78 default is upgraded", up.stored===true);
  ok("a copy the player edited is left alone", /MY OWN LAST LINE$/.test(up.uni)&&up.uni.indexOf("Repetition is not importance either")<0, up.uni.slice(-120));
  await pg.evaluate(()=>{ store.del(K.memBuild); const u=state.universes[0]; if(u.prompts)delete u.prompts.memBuild; persistUniverses(); });

  ok("no page errors", errs.length===0?true:errs.join(" | "));
  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close(); process.exit(fail?1:0);
})().catch(e=>{ console.error(e); process.exit(1); });
