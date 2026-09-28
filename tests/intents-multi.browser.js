/* v143.1 — A CHARACTER CARRIES SEVERAL MOTIVES, WITH PRIORITIES, AND THEY COOL OFF.
   Reported: "Each character only has one [intent] and once it is generated it almost never changes."
   The former skipped anyone already holding a live motive, asked for "at most 1", and the whole
   story shared a cap of four; the tick read each motive with nothing about the day and only moved it
   by the model's nudge. Checked here with the model stubbed:
     - a character who already carries a motive is still asked, and can take on more, up to the
       per-character setting; a full character only takes a new one that outweighs the weakest,
       which is crowded out; the same want toward the same person reinforces instead of doubling;
     - the former revises what is carried: fed, eased, re-ranked, reshaped, dropped;
     - the tick is one call per holder over all their motives, with the day's memories;
     - an unfed motive cools in code every day (a failed call still cools), a high priority one
       more slowly, and cools out entirely; a fed one does not cool;
     - priority orders the reply colouring and shows in the Brewing list;
     - each holder keeps their last three spent motives on record.
   Run: node tests/intents-multi.browser.js */
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
    window.__calls=[]; window.__reply={}; window.__sent={};
    window.chatCompletion=async(m,mo,o)=>{ const d=(o&&o.dbg)||"?"; window.__calls.push(d);
      window.__sent[d]=JSON.stringify(m);
      const k=Object.keys(window.__reply).find(r=>d.indexOf(r)===0);
      if(k){ const v=window.__reply[k]; if(v instanceof Error)throw v; return typeof v==="string"?v:JSON.stringify(v); }
      return "{}"; };
    const uni=state.universes[0]; state.curUniverse=uni.id;
    const mk=(id,n)=>({id,name:n,universeId:uni.id,personality:"x",instructions:"x",goals:"",look:{}});
    state.personas=[mk("p_a","Ayla"),mk("p_b","Berk"),mk("p_c","Ceren")];
    state.user="Emre"; state.key="k"; state.mem=true; state.intentOn=true; state.intentPerChar=3;
    const c=curChat(); c.universeId=uni.id; c.gameDay=5; c.presentIds=[]; c.intents=[]; c.rel={}; c._intentSwingAsked={};
    state.memory=[{id:"m1",ownerId:"p_a",content:"Berk mocked her in front of everyone.",type:"EXPERIENCE",
      importance:0.8,gameDay:5,gamePeriod:"Morning",universeId:uni.id,chatId:c.id,date:Date.now()}];
    return true;
  });
  const I=(id,o)=>Object.assign({id,holderId:"p_a",holderName:"Ayla",targetId:"p_b",targetName:"Berk",kind:"grievance",
    valence:"hostile",aim:"to make him take it back",trigger:"t",strength:0.6,priority:"medium",allies:[],status:"brewing",born:3,lastTick:4,fedDay:3},o||{});

  console.log("\n[a character can carry more than one motive]");
  await setup();
  const A=await pg.evaluate(async(I0)=>{
    const c=curChat(); c.intents=[I0];
    window.__reply["Intent form"]={intents:[
      {kind:"desire",valence:"warm",target:"Ceren",trigger:"she stood up for her",aim:"to be closer to her",strength:0.6,priority:"high"},
      {kind:"ambition",valence:"self_serving",target:"Emre",trigger:"an opening",aim:"to get the job",strength:0.5,priority:"low"}],revise:[]};
    await runIntentEngine(c,5,c.universeId,{period:"Morning",tick:false});
    return {calls:window.__calls.slice(),sent:window.__sent["Intent form · Ayla"]||"",
      live:c.intents.filter(i=>i.status!=="spent").map(i=>i.kind+"|"+i.priority)};
  },I("i1"));
  ok("a character who already carries a motive is still asked", A.calls.includes("Intent form · Ayla"), JSON.stringify(A.calls));
  ok("and is shown what they carry, with its id, and how much room is left",
     /\[i1\] STILL LIVE/.test(A.sent) && /room for 2 more/.test(A.sent), A.sent.slice(0,400));
  ok("two new motives join the first, each with its priority",
     A.live.length===3 && A.live.includes("desire|high") && A.live.includes("ambition|low"), JSON.stringify(A.live));

  await setup();
  const B=await pg.evaluate(async()=>{
    const c=curChat();
    const base={holderId:"p_a",holderName:"Ayla",valence:"hostile",trigger:"t",allies:[],status:"brewing",born:3,lastTick:4,fedDay:3};
    c.intents=[Object.assign({id:"w1",targetId:"p_b",targetName:"Berk",kind:"grievance",aim:"a",strength:0.3,priority:"low"},base),
               Object.assign({id:"w2",targetId:"p_c",targetName:"Ceren",kind:"rivalry",aim:"b",strength:0.7,priority:"high"},base),
               Object.assign({id:"w3",targetId:"__user__",targetName:"Emre",kind:"scheme",aim:"c",strength:0.6,priority:"medium",status:"armed"},base)];
    window.__reply["Intent form"]={intents:[{kind:"courtship",valence:"warm",target:"Emre",trigger:"x",aim:"to win you",strength:0.7,priority:"high"},
                                           {kind:"resentment",valence:"hostile",target:"Ceren",trigger:"x",aim:"d",strength:0.36,priority:"low"}]};
    await runIntentEngine(c,5,c.universeId,{period:"Morning",tick:false});
    const w1=c.intents.find(i=>i.id==="w1");
    return {live:c.intents.filter(i=>i.status!=="spent").map(i=>i.kind), w1:w1&&w1.status, why:w1&&w1.spentWhy};
  });
  ok("a full character takes a new motive only by crowding out the weakest (never an armed one)",
     B.live.length===3 && B.live.includes("courtship") && B.live.includes("scheme") && B.w1==="spent" && /crowded out/.test(B.why||""), JSON.stringify(B));
  ok("and a weaker new one does not get in", !B.live.includes("resentment"), JSON.stringify(B));

  await setup();
  const C=await pg.evaluate(async()=>{
    const c=curChat();
    const base={holderId:"p_a",holderName:"Ayla",valence:"hostile",trigger:"t",allies:[],status:"brewing",born:3,lastTick:4,fedDay:3,targetId:"p_b",targetName:"Berk"};
    c.intents=[Object.assign({id:"r1",kind:"grievance",aim:"old aim",strength:0.5,priority:"medium"},base),
               Object.assign({id:"r2",kind:"rivalry",aim:"x",strength:0.5,priority:"medium"},base),
               Object.assign({id:"r3",kind:"scheme",aim:"x",strength:0.5,priority:"medium",targetId:"p_c",targetName:"Ceren"},base)];
    window.__reply["Intent form"]={intents:[{kind:"grievance",valence:"hostile",target:"Berk",trigger:"again",aim:"z",strength:0.6,priority:"high"}],
      revise:[{id:"[r2]",strength_delta:0.2,priority:"low",aim:"to hear him admit it",why:"he did it again"},{id:"r3",drop:true,why:"they made up"}]};
    await runIntentEngine(c,5,c.universeId,{period:"Morning",tick:false});
    const g=id=>c.intents.find(i=>i.id===id)||{};
    return {n:c.intents.filter(i=>i.status!=="spent").length, r1:g("r1"), r2:g("r2"), r3:g("r3")};
  });
  ok("the same want toward the same person reinforces the motive instead of doubling it",
     C.n===2 && C.r1.strength>0.6 && C.r1.priority==="high" && C.r1.fedDay===5, JSON.stringify(C));
  ok("the former revises what is carried: fed, re-ranked, reshaped",
     Math.abs(C.r2.strength-0.7)<1e-9 && C.r2.priority==="low" && C.r2.aim==="to hear him admit it" && C.r2.fedDay===5, JSON.stringify(C.r2));
  ok("and drops what is over", C.r3.status==="spent" && C.r3.spentWhy==="they made up", JSON.stringify(C.r3));

  console.log("\n[motives cool off]");
  await setup();
  const D=await pg.evaluate(async()=>{
    const c=curChat(); state.memory=[];
    const base={holderId:"p_a",holderName:"Ayla",valence:"hostile",trigger:"t",allies:[],status:"brewing",born:1,lastTick:4,targetId:"p_b",targetName:"Berk",kind:"grievance",aim:"a"};
    c.intents=[Object.assign({id:"c1",strength:0.6,priority:"medium",fedDay:1},base),
               Object.assign({id:"c2",strength:0.6,priority:"high",fedDay:1,kind:"rivalry"},base),
               Object.assign({id:"c3",strength:0.6,priority:"medium",fedDay:1,kind:"scheme"},base),
               Object.assign({id:"c4",strength:0.21,priority:"low",fedDay:1,kind:"resentment"},base)];
    window.__reply["Intent tick"]={intents:[{id:"c1",strength_delta:0,fed:false},{id:"c2",strength_delta:0,fed:false},
                                            {id:"c3",strength_delta:0.1,fed:true,note:"he did it again"}]};
    await runIntentEngine(c,5,c.universeId,{tick:true,period:"Night"});
    const g=id=>c.intents.find(i=>i.id===id)||{};
    return {calls:window.__calls.filter(d=>/Intent tick/.test(d)), sent:window.__sent["Intent tick · Ayla"]||"",
            c1:g("c1").strength, c2:g("c2").strength, c3:g("c3").strength, c3fed:g("c3").fedDay, c4:g("c4").status, c4why:g("c4").spentWhy};
  });
  ok("one tick call for the holder, over all their motives", D.calls.length===1 && /\[c1\]/.test(D.sent) && /\[c3\]/.test(D.sent), JSON.stringify(D.calls));
  ok("an unfed motive cools in code", D.c1<0.6 && D.c1>0.4, String(D.c1));
  ok("a high-priority one cools more slowly", D.c2<0.6 && D.c2>D.c1, D.c1+" / "+D.c2);
  ok("a fed one does not cool, and is marked fed today", Math.abs(D.c3-0.7)<1e-9 && D.c3fed===5, JSON.stringify(D));
  ok("a weak unfed one cools out entirely", D.c4==="spent" && D.c4why==="cooled off", JSON.stringify(D));

  await setup();
  const E=await pg.evaluate(async()=>{
    const c=curChat();
    c.intents=[{id:"e1",holderId:"p_a",holderName:"Ayla",targetId:"p_b",targetName:"Berk",kind:"grievance",valence:"hostile",aim:"a",trigger:"t",strength:0.6,priority:"medium",allies:[],status:"brewing",born:1,lastTick:4,fedDay:1}];
    window.__reply["Intent tick"]=new Error("offline");
    await runIntentEngine(c,5,c.universeId,{tick:true,period:"Night"});
    const one=c.intents[0].strength;
    c.intents[0].strength=0.6; c.intents[0].fedDay=1;
    window.__reply["Intent tick"]={strength_delta:0.1,recruit:[],ready:false};   // an older one-motive prompt
    await runIntentEngine(c,5,c.universeId,{tick:true,period:"Night"});
    return {one, two:c.intents[0].strength};
  });
  ok("a failed tick call still cools", E.one<0.6, JSON.stringify(E));
  ok("an older one-motive tick prompt's answer still applies", Math.abs(E.two-0.7)<1e-9, JSON.stringify(E));

  console.log("\n[priority is used]");
  await setup();
  const F=await pg.evaluate(()=>{
    const c=curChat(); c.presentIds=["p_b","p_c"];
    const base={holderId:"p_a",holderName:"Ayla",allies:[],status:"brewing",born:1,trigger:"t"};
    c.intents=[Object.assign({id:"f1",targetId:"p_b",targetName:"Berk",kind:"grievance",valence:"hostile",aim:"to see him squirm",strength:0.55,priority:"low"},base),
               Object.assign({id:"f2",targetId:"p_c",targetName:"Ceren",kind:"friendship",valence:"warm",aim:"to be her friend",strength:0.5,priority:"high"},base)];
    const p=intentParts(c,"p_a","__user__","Emre");
    const h=_calBrewingSection(c);
    return {key:p.coloringKey, brew:/high priority/.test(h)&&/low priority/.test(h), first:h.indexOf("Ceren")<h.indexOf("Berk")};
  });
  ok("the higher-priority motive colours the reply, not merely the hotter one", F.key==="intent_warm", JSON.stringify(F));
  ok("the Brewing list shows priority and ranks by it", F.brew && F.first, JSON.stringify(F));

  const G=await pg.evaluate(async()=>{
    const c=curChat(); c.intents=[];
    for(let k=0;k<5;k++)c.intents.push({id:"s"+k,holderId:"p_a",holderName:"Ayla",targetId:"p_b",targetName:"Berk",kind:"grievance",valence:"hostile",aim:"a",strength:0.5,status:"spent",born:1});
    c.intents.push({id:"live",holderId:"p_a",holderName:"Ayla",targetId:"p_b",targetName:"Berk",kind:"grievance",valence:"hostile",aim:"a",strength:0.5,priority:"medium",allies:[],status:"brewing",born:5,lastTick:5,fedDay:5});
    await runIntentEngine(c,5,c.universeId,{tick:false,period:"Morning"});
    return c.intents.map(i=>i.id);
  });
  ok("each holder keeps their last three spent motives on record", JSON.stringify(G)===JSON.stringify(["s2","s3","s4","live"]), JSON.stringify(G));

  const H=await pg.evaluate(()=>({per:intentsPerChar(), ui:!!document.getElementById('setIntentPerChar'), old:!!document.getElementById('setIntentMax'),
    form:/revise it, do not just add to it/.test(up("intentForm")), tick:/Motives cool off/.test(up("intentTick"))}));
  ok("the setting is per character", H.per===3 && H.ui && !H.old, JSON.stringify(H));
  ok("both prompts are the new ones", H.form && H.tick, JSON.stringify(H));

  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log(`\n  ${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail?1:0);
})();
