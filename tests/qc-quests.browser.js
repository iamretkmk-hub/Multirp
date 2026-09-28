/* v144.1 — QC report §4.6 / §4.7: quests, the Gamemaster and world rules. Model stubbed throughout.
     - the privacy lock reads words, not stems (Unicode boundaries), and a live heat run, not the setting;
     - quest knowledge goes to the person named, not to every "can" / "realize";
     - a completion lands in the universe it belongs to, even with another one open;
     - the day-end judge reads a quest whose key figure is still hidden, can say "failed", and a
       continuation that failed is tried again at the next day end;
     - quest lines are the player's (present:[] + questNote), arc names never reopen a concluded arc;
     - character quests have a cost ceiling: attempts count, stalled pursuits lapse, "false" is false;
     - editing a gate forgets the old ids; the rule compiler says what it could not match;
     - the Gamemaster counts turns (not its own lines) and drops a beat the player has overtaken.
   Run: node tests/qc-quests.browser.js */
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
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x||c).slice(0,700));} };

  const setup=()=>pg.evaluate(()=>{
    window.__calls=[]; window.__payloads=[]; window.__reply=()=>"{}";
    window.chatCompletion=async(m,mo,o)=>{ const d=(o&&o.dbg)||"?"; window.__calls.push(d); window.__payloads.push({d,m:JSON.stringify(m)});
      return window.__reply(d,JSON.stringify(m)); };
    const uni=state.universes[0]; state.curUniverse=uni.id;
    uni.gameData={quests:[],charQuests:[],arcMeta:{}}; uni.cqAsked={}; uni.cqLastSpawn=null; uni.originDoc="Day zero.";
    uni.locations=[{id:"l_home",name:"Home",description:"x",residents:[],sublocations:[]}];
    const mk=(id,n,extra)=>Object.assign({id,name:n,universeId:uni.id,personality:"x",instructions:"x",goals:"g",look:{}},extra||{});
    state.personas=[mk("p_a","Ayla"),mk("p_b","Berk"),mk("p_c","Ceren"),mk("p_h","Hidden Hakan",{latent:true})];
    state.user="Emre"; state.key="k"; state.charQuestsOn=true; state.heatOn=false; state.gmOn=true; state.sceneOn=true;
    const c=curChat(); c.universeId=uni.id; c.gameDay=5; c.period="Morning"; c.timeOfDay="Morning";
    c.locationId="l_home"; c.location="Home"; c.presentIds=[]; c.intents=[]; c.messages=[]; c.activeEvent=null; c.dnd=false;
    state.memory=[];
    return true;
  });

  /* ===== §4.7 the privacy lock ===== */
  console.log("\n[the privacy lock reads words, not stems]");
  await setup();
  const P=await pg.evaluate(()=>{
    const c=curChat(); const r={};
    const test=t=>{ c.messages=[{mid:"x",role:"user",content:t}]; return sceneIsPrivateMoment(c); };
    ["Amcam geldi","götürdüm","boşalttı","zevkli","stripped of his rank","grinding coffee","climax","in bed with fever","cocktail","Salon boşaldı"]
      .forEach(t=>r["F:"+t]=test(t));
    ["Yanağına bir öpücük kondurdu.","ÇIPLAK ayaklarla yürüdü","She leaned in for a kiss","He stood there naked"]
      .forEach(t=>r["T:"+t]=test(t));
    return r;
  });
  ok("everyday words are not intimacy", Object.keys(P).filter(k=>k[0]==="F").every(k=>P[k]===false), JSON.stringify(P));
  ok("öpücük / çıplak / kiss / naked are", Object.keys(P).filter(k=>k[0]==="T").every(k=>P[k]===true), JSON.stringify(P));
  const H=await pg.evaluate(()=>{
    const c=curChat(); c.presentIds=["p_a"]; state.heatOn=true;
    c.messages=[{mid:"a",role:"user",content:"Let's look at the ledger."},{mid:"b",role:"assistant",speaker:"Ayla",speakerId:"p_a",content:"Fine.",present:["p_a"]}];
    const off=sceneIsPrivateMoment(c);
    c.messages.push({mid:"c",role:"assistant",speaker:"Ayla",speakerId:"p_a",content:"…",heatBeat:true,present:["p_a"]});
    const live=sceneIsPrivateMoment(c);
    state.heatOn=false; c.presentIds=[];
    return {off,live};
  });
  ok("the Heat SETTING on with no live heat run is not a private moment", H.off===false, JSON.stringify(H));
  ok("a live heat run one-on-one is", H.live===true, JSON.stringify(H));
  ok("an in-person quest ask respects the lock", await pg.evaluate(()=>{
    const src=String(checkCharQuestApproach);
    return /sceneIsPrivateMoment\(chat\)/.test(src)&&!/confrontOn===false/.test(src)?true:"no lock / still tied to confrontations"; }));

  /* ===== quest-to-character matching ===== */
  console.log("\n[quest knowledge goes to the person named]");
  const N=await pg.evaluate(()=>({
    can:questNamesChar({title:"The ledger",desc:"She can realize what it means."},"Can"),
    ali:questNamesChar({title:"The ledger",desc:"You realize the debt is real."},"Ali"),
    canan:questNamesChar({title:"Find Canan",desc:"Canan knows."},"Can"),
    named:questNamesChar({title:"The ledger",desc:"Can'a mektubu götür."},"Can"),
    cast:questNamesChar({title:"x",desc:"y",castNames:["Şule"]},"Sule")
  }));
  ok('"Can" is not the word "can", "Ali" is not "realize", "Can" is not "Canan"', !N.can&&!N.ali&&!N.canan, JSON.stringify(N));
  ok("a capitalised whole-name mention (with a suffix) still counts, and cast names fold", N.named&&N.cast, JSON.stringify(N));

  /* ===== questMarkDone across universes ===== */
  console.log("\n[a completion lands in its own universe]");
  const U=await pg.evaluate(()=>{
    const other={id:"u_other_qc",name:"Other",gameData:{quests:[{id:"q_o",arc:"A",seq:0,title:"Theirs",done:false,startActive:true,progress:[]}]}};
    state.universes.push(other);
    const without=questMarkDone("q_o",{day:3});
    const res=questMarkDone("q_o",{uni:other,day:3,result:"It is done."});
    const q=other.gameData.quests[0];
    state.universes=state.universes.filter(u=>u!==other);
    return {without:!!without,res:!!res,done:q.done,day:q.completedDay,cur:state.curUniverse!==other.id};
  });
  ok("without a universe it looks only in the open one", U.without===false&&U.cur, JSON.stringify(U));
  ok("with {uni} it completes in that universe", U.res&&U.done===true&&U.day===3, JSON.stringify(U));

  /* ===== the day-end judge ===== */
  console.log("\n[the day-end judge]");
  await setup();
  const R=await pg.evaluate(async()=>{
    const uni=state.universes[0], c=curChat();
    uni.gameData.arcMeta={"The Debt":{brief:"b",premise:"p",complete:false}};
    uni.gameData.quests=[
      {id:"q_h",arc:"The Debt",seq:0,title:"Find the courier",desc:"Find out who carried the letter.",npcName:"Hidden Hakan",npcId:"p_h",castNames:[],done:false,startActive:true,progress:[]},
      {id:"q_f",arc:"Side",seq:0,title:"Save the shop",desc:"Keep the shop open.",npcName:"",castNames:[],done:false,startActive:true,progress:[]}];
    uni.gameData.arcMeta.Side={brief:"b",premise:"p",complete:false};
    state.memory=[{id:"m1",ownerId:"p_h",character:"Hidden Hakan",content:"I handed the letter to Emre myself.",gameDay:5,universeId:uni.id,type:"EXPERIENCE",importance:0.7}];
    c.messages=[{mid:"u1",role:"user",content:"I watched them board up the shop for good.",status:{day:5}}];
    let nextTry=0;
    window.__reply=(d,m)=>{
      if(d==="Quest reconcile"){
        const judged=[];
        if(/handed the letter to Emre/.test(m))judged.push({id:"q_h",done:true,failed:false,result:"Hakan admitted he carried the letter.",line:"Hakan mektubu taşıdığını itiraf etti."});
        if(/board up the shop/.test(m))judged.push({id:"q_f",done:false,failed:true,result:"The shop closed for good."});
        return JSON.stringify(judged);
      }
      if(/^Quest next/.test(d)){ nextTry++; if(nextTry<=2)throw new Error("timeout"); return JSON.stringify({quest:{name:"Follow the money",desc:"Trace the payment."}}); }
      return "{}";
    };
    await reconcileQuestsForDay(c,5,uni);
    const qh=uni.gameData.quests.find(q=>q.id==="q_h"), qf=uni.gameData.quests.find(q=>q.id==="q_f");
    const liveAfterFail=uni.gameData.quests.filter(q=>q.arc==="The Debt"&&!q.done).length;
    const notes=c.messages.filter(m=>m.questNote);
    const payload=(window.__payloads.find(p=>p.d==="Quest reconcile")||{}).m||"";
    // the next day end: the stalled arcs get the chain again, and this time it works
    state.memory=[];
    await reconcileQuestsForDay(c,6,uni);
    const liveNext=uni.gameData.quests.filter(q=>q.arc==="The Debt"&&!q.done&&q.startActive!==false);
    const ann=c.messages.filter(m=>/Follow the money/.test(m.content||""));
    return {hDone:qh.done,hFailed:!!qh.failed,fDone:qf.done,fFailed:!!qf.failed,liveAfterFail,
      notes:notes.map(m=>({p:m.present,c:m.content})),payloadHasPlayer:/board up the shop/.test(payload),
      nextTry,liveNext:liveNext.map(q=>q.title),ann:ann.map(m=>({q:!!m.questNote,p:m.present}))};
  });
  ok("a quest whose key figure is still HIDDEN is judged from their memories", R.hDone===true&&R.hFailed===false, JSON.stringify(R));
  ok("a quest with no cast is judged from the day's wider evidence and the player's own lines", R.payloadHasPlayer===true, JSON.stringify(R));
  ok('"failed" is an outcome: closed and marked failed', R.fDone===true&&R.fFailed===true, JSON.stringify(R));
  ok("outcome lines are the player's: present:[] + questNote, in the story's words",
     R.notes.length>=2&&R.notes.every(n=>Array.isArray(n.p)&&n.p.length===0)&&R.notes.some(n=>/itiraf etti/.test(n.c)), JSON.stringify(R.notes));
  ok("a failed continuation leaves the arc with nothing live…", R.liveAfterFail===0, JSON.stringify(R));
  ok("…and it is tried again at the next day end", R.liveNext.length===1&&R.liveNext[0]==="Follow the money", JSON.stringify(R));
  ok("the new quest is announced with present:[] and questNote", R.ann.length>=1&&R.ann.every(a=>a.q&&Array.isArray(a.p)&&a.p.length===0), JSON.stringify(R.ann));

  /* ===== arc names ===== */
  console.log("\n[arc names never reopen a concluded arc]");
  await setup();
  const A=await pg.evaluate(async()=>{
    const uni=state.universes[0];
    uni.gameData.arcMeta={"The Letter":{brief:"old",premise:"old",complete:true}};
    uni.gameData.quests=[{id:"q_old",arc:"The Letter",seq:0,title:"Old",done:true,startActive:true,progress:[]}];
    window.__reply=d=>/^Quest arc/.test(d)?JSON.stringify({arc:"The Letter",premise:"new",quest:{name:"A new opening"}}):"{}";
    const r=await generateQuestArc(uni,"another letter");
    return {arc:r&&r.arc,oldComplete:uni.gameData.arcMeta["The Letter"].complete,newQ:uni.gameData.quests.find(q=>q.title==="A new opening")};
  });
  ok("a colliding name gets a suffix", A.arc==="The Letter (2)"&&A.newQ&&A.newQ.arc==="The Letter (2)", JSON.stringify(A));
  ok("and the concluded arc stays concluded", A.oldComplete===true, JSON.stringify(A));
  ok("the designer's arc history is bounded", await pg.evaluate(()=>{
    const qs=[]; for(let i=0;i<30;i++)qs.push({id:"q"+i,arc:"Long",seq:i,title:"Quest "+i,desc:"d".repeat(150),done:true,result:"r",
      progress:Array.from({length:30},(_,k)=>({day:k,text:"note ".repeat(40)}))});
    const t=_questArcHistory({quests:qs},"Long");
    return (t.length<9000&&/Earlier in this arc \(25 quests/.test(t)&&/Quest 29/.test(t))?true:("length "+t.length);
  }));

  /* ===== character quests: the cost ceiling ===== */
  console.log("\n[character quests have a cost ceiling]");
  await setup();
  const C=await pg.evaluate(async()=>{
    const uni=state.universes[0], c=curChat();
    const cq=(id,h,t,extra)=>Object.assign({id,holderId:h,holderName:h,targetId:t,targetName:t,title:"T "+id,desc:"d",status:"active",createdDay:4,progress:[],nudges:0},extra||{});
    uni.gameData.charQuests=[cq("c1","p_a","p_b"),cq("c2","p_b","p_c"),cq("c3","p_c","p_a")];
    window.__reply=d=>/^Char quest \(step\)/.test(d)?JSON.stringify({moved:"false"}):"{}";
    const n1=await runCharQuestPursuit(c,5,uni); const calls1=window.__calls.filter(d=>/step/.test(d)).length;
    const again=await runCharQuestPursuit(c,5,uni); const calls2=window.__calls.filter(d=>/step/.test(d)).length;
    await runCharQuestPursuit(c,5,uni); const calls3=window.__calls.filter(d=>/step/.test(d)).length;
    const qs=uni.gameData.charQuests;
    const stalls=qs.map(q=>q.stalls||0);
    const worldEvents=c.messages.filter(m=>m.worldEvent&&!/came to nothing|emeli/.test(m.content)).length;
    // a pursuit that has stalled its limit, and one quiet for over a week, lapse without a call
    qs[0].stalls=CQ_MAX_STALLS; qs[1].createdDay=-10; window.__calls=[];
    await runCharQuestPursuit(c,6,uni);
    return {n1,calls1,calls2,calls3,again,stalls,worldEvents,st:qs.map(q=>q.status+(q.lapsed?"/lapsed":"")),
      lapsedCalls:window.__calls.filter(d=>/step/.test(d)).length,
      lapseBubbles:c.messages.filter(m=>m.worldEvent&&Array.isArray(m.present)&&m.present.length===0&&/emeli boşa çıktı|came to nothing/.test(m.content)).length};
  });
  ok("stalled attempts count toward the per-run cap (2 calls, not 3)", C.calls1===2&&C.n1===0, JSON.stringify(C));
  ok('"moved":"false" is not a move: counted as a stall, nothing narrated', C.stalls.every(x=>x===1)&&C.worldEvents===0, JSON.stringify(C));
  ok("the next run takes the one left over, and no quest is stepped twice in a day", C.calls2===3&&C.calls3===3&&C.again===0, JSON.stringify(C));
  ok("stalled / long-quiet pursuits lapse, visibly, with no call spent on them",
     C.st[0]==="failed/lapsed"&&C.st[1]==="failed/lapsed"&&C.lapseBubbles===2, JSON.stringify(C));
  const S=await pg.evaluate(async()=>{
    const uni=state.universes[0], c=curChat();
    uni.gameData.charQuests=[{id:"u1",holderId:"p_a",holderName:"Ayla",targetId:"__user__",targetName:"Emre",title:"Ask",status:"active",createdDay:1,
      delivered:true,awaitingUser:true,nudges:3,lastNudgeDay:1,progress:[]}];
    window.__reply=()=>"{}";
    await runCharQuestPursuit(c,6,uni);
    const asked=uni.gameData.charQuests[0].status;
    // spawn: at most two are asked per stretch, and an empty target is a solitary pursuit, not an ask
    uni.gameData.charQuests=[]; uni.cqAsked={};
    state.memory=["p_a","p_b","p_c"].map((o,i)=>({id:"s"+i,ownerId:o,content:"x",gameDay:6,gamePeriod:"Morning",importance:0.3+i*0.2,universeId:uni.id}));
    window.__calls=[];
    window.__reply=d=>/spawn/.test(d)?JSON.stringify({quest:{title:"Finish the novel",target:"",desc:"d",motive:"m",done_when:"it is done"}}):"{}";
    const born=await runCharQuestSpawn(c,6,uni,{period:"Morning"});
    return {asked,spawnCalls:window.__calls.filter(d=>/spawn/.test(d)),born,
      qs:uni.gameData.charQuests.map(q=>({t:q.targetId,s:!!q.solitary,h:q.holderName}))};
  });
  ok("an ask nudged three times and never answered lapses", S.asked==="failed", JSON.stringify(S));
  ok("the spawn asks at most two per stretch — those who lived through the most", S.spawnCalls.length===2&&!S.spawnCalls.some(d=>/Ayla/.test(d)), JSON.stringify(S));
  ok("an empty target is a solitary pursuit, not an ask of the player", S.born===2&&S.qs.every(q=>q.t!=="__user__"&&q.s), JSON.stringify(S));

  /* ===== the gate editor ===== */
  console.log("\n[editing a gate forgets the old ids]");
  const G=await pg.evaluate(()=>{
    const uni=state.universes[0];
    uni.gameData.charQuests=[{id:"g1",holderId:"p_a",holderName:"Ayla",targetId:"__user__",targetName:"Emre",title:"Ask",status:"active",createdDay:1,
      approach:"in_person",gate:{type:"with_char",charName:"Berk",charId:"p_b",locationName:"",locationId:null},progress:[]}];
    charQuestEditUI("g1");
    document.getElementById("cqeGateName").value="Ceren";
    charQuestEditSave("g1");
    const g=uni.gameData.charQuests[0].gate;
    const opened=(()=>{ const c=curChat(); c.presentIds=["p_c"]; const r=_cqGateOpen(c,uni.gameData.charQuests[0]); c.presentIds=[]; return r; })();
    return {g,opened};
  });
  ok("renaming the gate character clears the stale id and re-resolves", G.g.charName==="Ceren"&&G.opened===true&&G.g.charId==="p_c", JSON.stringify(G));

  /* ===== the rule compiler ===== */
  console.log("\n[the rule compiler says what it could not match]");
  const W=await pg.evaluate(async()=>{
    const uni=state.universes[0];
    window.__reply=d=>/rule compiler/i.test(d)?JSON.stringify({kind:"access",who:{mode:"ids",value:["Ayla","Zeynep"]},where:["Home","Castle"],exceptions:["Nobody"]}):"{}";
    const r1=await compileWorldRule("x",uni.locations,uni.id);
    window.__reply=d=>/rule compiler/i.test(d)?JSON.stringify({kind:"access",who:{mode:"tag",value:["enemy"]},where:["Home"],exceptions:[]}):"{}";
    const r2=await compileWorldRule("x",uni.locations,uni.id);
    return {w1:r1&&r1._warn,who:r1&&r1.who.value,w2:r2&&r2._warn};
  });
  ok("unmatched characters, places and exceptions are listed", Array.isArray(W.w1)&&/Zeynep/.test(W.w1.join())&&/Castle/.test(W.w1.join())&&/Nobody/.test(W.w1.join())&&W.who.join()==="p_a", JSON.stringify(W));
  ok("a tag nobody carries is flagged as blocking nobody", Array.isArray(W.w2)&&/no character has tag "enemy"/.test(W.w2.join()), JSON.stringify(W));

  /* ===== the Gamemaster ===== */
  console.log("\n[the Gamemaster]");
  await setup();
  const M=await pg.evaluate(async()=>{
    const c=curChat(); state.gmEvery=3; c.gmLastCheck=0; c.presentIds=["p_a"];
    const say=(r,t,x)=>Object.assign({mid:"m"+Math.random(),role:r,content:t,speaker:r==="user"?undefined:"Ayla",speakerId:r==="user"?undefined:"p_a",present:["p_a"]},x||{});
    c.messages=[say("user","hi"),say("assistant","hey"),
      {mid:"n1",role:"assistant",speaker:"Narrator",narratorEvent:true,gmBeat:true,content:"A door slams.",present:["p_a"]},
      {mid:"n2",role:"assistant",speaker:"Narrator",dayMarker:true,content:"— day —"},
      {mid:"n3",role:"assistant",speaker:"Narrator",narratorEvent:true,questNote:true,content:"New quest",present:[]}];
    const turns=_gmTurnCount(c);
    window.__calls=[];
    await maybeGamemaster(c);                 // 2 real turns < gmEvery 3 → no call at all
    const earlyCalls=window.__calls.length;
    c.messages.push(say("user","so?"));
    window.__reply=d=>{ if(d==="Gamemaster: judge"){ _dirSeq++; return JSON.stringify({stale:true,trigger:false,reason:"stalled"}); } return "Someone knocks."; };
    await maybeGamemaster(c);
    const beats=c.messages.filter(m=>m.gmBeat).length;
    c.gmLastCheck=0; window.__calls=[];
    window.__reply=d=>d==="Gamemaster: judge"?JSON.stringify({stale:"false",trigger:"false"}):"Someone knocks.";
    await maybeGamemaster(c);
    return {turns,earlyCalls,beats,stringFalse:window.__calls.slice()};
  });
  ok("the cadence counts real turns only, not GM beats / markers / quest notes", M.turns===2&&M.earlyCalls===0, JSON.stringify(M));
  ok("a beat the player overtook (_dirSeq moved) is dropped", M.beats===1, JSON.stringify(M));
  ok('"stale":"false" / "trigger":"false" do not trigger the author', M.stringFalse.length===1&&M.stringFalse[0]==="Gamemaster: judge", JSON.stringify(M));

  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log(`\n  ${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail?1:0);
})();
