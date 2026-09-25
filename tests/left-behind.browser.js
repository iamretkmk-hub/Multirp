/* v123.1 — LEFT BEHIND MEANS LEFT BEHIND.
   Reported: "When I am automatically placed by any function with a character, those characters seem
   to follow wherever I go, even when I pick to travel alone." Nothing recorded that the player had
   walked away from someone, so the scene cut (Autopilot, Story mode) and the Gamemaster could hand
   them straight back, and a companion lock from an earlier "Travel together" was never released by a
   later "Go alone". Checked with the model stubbed:
     - going alone leaves them where they were, and records it for the day;
     - a later trip without a locked companion releases the lock, and they stay where they were left;
     - the scene cut never picks them again that day, the Gamemaster cannot summon them this part of
       the day, and Story mode's move-on records them too;
     - taking someone along, or a new day, is not "left behind".
   Run: node tests/left-behind.browser.js */
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

  const setup=()=>pg.evaluate(()=>{
    window.__cutPlace="Cafe";
    window.chatCompletion=async(m,mo,o)=>{ const d=(o&&o.dbg)||"";
      if(/^Drop me into a scene/.test(d))return JSON.stringify({place:window.__cutPlace,narration:"They are already talking.",line:"So, as I was saying."});
      return "Narration."; };
    const uni=state.universes[0];
    uni.locations=["Home","Cafe","Park","Gym"].map(n=>({id:"l_"+n,name:n,description:n,residents:[],sublocations:[]}));
    const mk=(id,n)=>({id,name:n,universeId:uni.id,instructions:"x",personality:"x",backstory:"x",style:"x",goals:"x",look:{}});
    state.personas=[mk("p_b","Buket"),mk("p_c","Ceren")];
    state.user="Emre"; state.key="k"; state.mem=false; state.calOn=false; state.gmOn=false; state.travelTime=0;
    const c=curChat(); c.gameDay=1; c.period="Morning"; c.locationId="l_Home"; c.location="Home"; c.presentIds=[]; c.messages=[];
    c.dayPlacement={day:1,positions:{p_b:"l_Gym",p_c:"l_Gym"}}; c._lastPlacementDay=1; c.worldPositions=null; c._wpKey=null;
    c.companionLock={}; c.leftBehind=null; c.dayLog=null;
    // Buket is the stronger candidate for a cut: she has something to put to the player.
    c.intents=[{holderId:"p_b",targetId:"__user__",status:"active",aim:"wants to talk"}];
    return true;
  });

  console.log("\n[going alone leaves them where they were]");
  await setup();
  const A=await pg.evaluate(async()=>{
    const c=curChat();
    const first=cutCandidates(c)[0].p.name;
    /* the cut picks at random among the top few — pin it to the top one, as a real run often does */
    const rnd=Math.random; Math.random=()=>0;
    try{ await runSceneCut(c); } finally{ Math.random=rnd; }
    const with1=c.presentIds.slice(), at=c.location;
    await travelTo("l_Park",[]);
    const r={first,with1,at,present:c.presentIds.slice(),pos:c.worldPositions.p_b,left:wasLeftBehind(c,"p_b"),
      cands:cutCandidates(c).map(x=>x.p.name)};
    await runSceneCut(c); r.nextCut=c.presentIds.slice();
    return r;
  });
  ok("the automatic scene put Buket with the player", A.first==="Buket" && A.with1.join()==="p_b" && A.at==="Cafe", JSON.stringify(A));
  ok("going alone, she is not at the destination", A.present.indexOf("p_b")<0, JSON.stringify(A));
  ok("she stays where she was left", A.pos==="l_Cafe", JSON.stringify(A));
  ok("and it is recorded", A.left===true, JSON.stringify(A));
  ok("the next automatic scene does not hand her back", A.cands.indexOf("Buket")<0 && A.nextCut.indexOf("p_b")<0 && A.nextCut.length===1, JSON.stringify(A));
  ok("the Gamemaster cannot summon her this part of the day", await pg.evaluate(()=>{
      const c=curChat(); c.presentIds=[]; const p=gmSummonCharacter(c,"Buket");
      return (p===null && c.presentIds.indexOf("p_b")<0) ? true : "summoned"; }));
  ok("but can once the part of the day has changed", await pg.evaluate(()=>{
      const c=curChat(); c.period="Afternoon"; const p=gmSummonCharacter(c,"Buket"); const got=!!p;
      c.presentIds=(c.presentIds||[]).filter(x=>x!=="p_b"); c.period="Morning";
      return got ? true : "still refused"; }));

  console.log("\n[a companion lock is released by going alone]");
  await setup();
  const B=await pg.evaluate(async()=>{
    const c=curChat(); c.presentIds=["p_b"];
    await travelTo("l_Cafe",["p_b"]);
    const r={together:c.presentIds.slice(),lock:!!(c.companionLock||{}).p_b,leftAfterTogether:wasLeftBehind(c,"p_b")};
    await travelTo("l_Park",[]);
    r.alone=c.presentIds.slice(); r.lockAfter=!!(c.companionLock||{}).p_b; r.pos=c.worldPositions.p_b;
    resolveWorldPositions(c); r.posRead=c.worldPositions.p_b;
    await travelTo("l_Home",[]);
    r.home=c.presentIds.slice();
    return r;
  });
  ok("taking her along keeps her with the player, and is not leaving her", B.together.join()==="p_b" && B.lock===true && B.leftAfterTogether===false, JSON.stringify(B));
  ok("going alone afterwards releases the lock", B.alone.indexOf("p_b")<0 && B.lockAfter===false, JSON.stringify(B));
  ok("she stays at the place she was left", B.pos==="l_Cafe" && B.posRead==="l_Cafe", JSON.stringify(B));
  ok("and does not turn up at the next place either", B.home.indexOf("p_b")<0, JSON.stringify(B));

  console.log("\n[Story mode, and a new day]");
  ok("Story mode's move-on records who it left", await pg.evaluate(async()=>{
      const c=curChat(); c.leftBehind=null; c.presentIds=["p_c"]; c._smLeaving=true; c.period="Morning";
      const real=window.runSceneCut; window.runSceneCut=async()=>true;
      await smMoveOn(c); window.runSceneCut=real;
      return wasLeftBehind(c,"p_c") ? true : JSON.stringify(c.leftBehind); }));
  ok("a new day starts with nobody left behind", await pg.evaluate(()=>{
      const c=curChat(); noteLeftBehind(c,["p_b"],"l_Cafe"); c.gameDay=2;
      const r=wasLeftBehind(c,"p_b"); c.gameDay=1;
      return r===false ? true : "still left behind"; }));
  ok("it survives a reload", await pg.evaluate(()=>{
      const c=curChat(); noteLeftBehind(c,["p_b"],"l_Cafe");
      const slim=_slimChat(c); return (slim.leftBehind&&slim.leftBehind.p_b) ? true : "not persisted"; }));

  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log(`\n  ${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail?1:0);
})();
