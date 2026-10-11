/* v150.112 — THE CONNECTED FEELING SYSTEM, STEP 4: ENCOUNTERS OFF SCREEN. When a part of the day ends, characters who were at the
   same place away from the player met: an ordinary meeting goes into each one's opinion update; where the bond carries something
   (the code's gates: romance needs attraction and appeal on both sides and privacy; a quarrel needs hostility; confiding needs
   trust and closeness with one of them shaken), within the drama setting and a cooldown, one call plays it out for both — what
   happened, feelings and events through the same rules, opinions, resolutions, a memory each (secret where it should be) — and
   anyone else there remembers what they saw.
   Run: node tests/feel-encounters.browser.js */
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:process.env.SM_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage({viewport:{width:412,height:915}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file://'+require('path').resolve(__dirname,'..','index.html')); await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(800);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x===undefined?c:x).slice(0,900));} };
  const E=(f,a)=>pg.evaluate(f,a);

  await E(()=>{
    window.__calls=[]; window.__enc={};
    window.chatCompletion=async(msgs,model,opts)=>{ const dbg=(opts&&opts.dbg)||""; const t=(Array.isArray(msgs)?msgs:[]).map(m=>m.content).join("\n");
      window.__calls.push({dbg,t});
      if(/^Off-screen ·/.test(dbg)){ const k=Object.keys(window.__enc).find(x=>dbg.indexOf(x)>=0); return JSON.stringify(k?window.__enc[k]:{what:"nothing",people:[]}); }
      if(/^Opinions ·/.test(dbg))return JSON.stringify({people:[]});
      return "{}"; };
    Math.random=()=>0;   // every chance passes; the gates decide
    const uni=state.universes[0]; state.curUniverse=uni.id;
    uni.locations=(uni.locations||[]).filter(l=>!/^fe_l/.test(l.id)).concat([
      {id:"fe_lh",name:"Ana's flat",type:"home",residents:["fe_a"],sublocations:[]},
      {id:"fe_lc",name:"Corner Café",type:"poi",residents:[],sublocations:[]}]);
    state.personas=state.personas.filter(p=>!/^fe_/.test(p.id));
    const mk=(id,name,x)=>state.personas.push(Object.assign({id,name,universeId:uni.id,personality:"x",look:{}},x||{}));
    mk("fe_a","Ana",{relationships:{fe_f:{tie:"husband",relationship:"Married."},fe_b:{tie:"neighbour"}},temper:{conscience:70}});
    mk("fe_b","Bo"); mk("fe_c","Cem"); mk("fe_d","Dov"); mk("fe_e","Eli"); mk("fe_f","Fil");
    state.key="sk-test"; state.emoOn=true; state.relOn=true; state.memory=[]; state.fsDrama="dramatic";
    const c=curChat(); Object.assign(c,{universeId:uni.id,presentIds:[],emo:{},feel:{},rel:{},fsv:1,fsTurn:3,gameDay:3,period:"Evening",fsEncDone:{},messages:[],
      dayPlacement:{day:3,period:"Afternoon",positions:{fe_a:"fe_lh",fe_b:"fe_lh",fe_c:"fe_lc",fe_d:"fe_lc",fe_e:"fe_lc",fe_f:null}},worldPositions:null,_wpKey:""});
    const set=(a,b2,v,op)=>{ const o=relObj(c,a,b2); Object.assign(o,v); if(op)Object.assign(o.op,op); };
    set("fe_a","fe_b",{attraction:65,affection:30,familiarity:40,trust:30},{appealing:60,interested:50,kind:40,safe:30});
    set("fe_b","fe_a",{attraction:60,affection:25,familiarity:40,trust:30},{appealing:65,interested:55,kind:40,safe:30});
    set("fe_a","fe_f",{commitment:80,affection:50,familiarity:80});
    set("fe_c","fe_d",{affection:-55,respect:-40},{});
    set("fe_d","fe_c",{affection:-30,respect:-20},{});
    window.__enc={"Ana & Bo":{what:"intimacy",summary:"Ana and Bo slept together at her flat.",secret:true,seen_by_others:"",
        people:[{name:"Ana",feelings:{desire:"rose_a_lot",warmth:"rose"},events:["release","crossed_line"],wronged:"Fil",opinions:{kind:"rose",safe:"rose"},resolution:{kind:"keep_distance",text:"You tell yourself it cannot happen again.",strength:"passing"},memory:"I slept with Bo at my flat while Fil was away."},
                {name:"Bo",feelings:{desire:"rose_a_lot"},events:["release"],opinions:{appealing:"rose"},resolution:{kind:"pursue",text:"You want her again.",strength:"firm"},memory:"Ana and I slept together at her flat."}]},
      "Cem & Dov":{what:"quarrel",summary:"Cem and Dov argued loudly at the café.",secret:false,seen_by_others:"Cem and Dov had a loud argument at the Corner Café.",
        people:[{name:"Cem",feelings:{anger:"rose_a_lot"},opinions:{kind:"fell"},memory:"Dov and I had it out at the café."},{name:"Dov",feelings:{anger:"rose"},memory:"Cem shouted at me at the café."}]}};
  });

  console.log("\n[candidates are played out, for both of them]");
  const r=await E(async()=>{ const c=curChat(); window.__calls=[]; const played=await runOffscreenEncounters(c,3,"Afternoon");
    const g=c.feel.fe_a.list.find(f=>f.k==="guilt"), mA=state.memory.filter(m=>m.ownerId==="fe_a"), mB=state.memory.filter(m=>m.ownerId==="fe_b"), mE=state.memory.filter(m=>m.ownerId==="fe_e");
    return {played:played.map(x=>x.a+"&"+x.b+":"+x.kind+":"+x.what),dbg:window.__calls.map(x=>x.dbg),t:(window.__calls.find(x=>/Ana & Bo/.test(x.dbg))||{}).t,
      guilt:g&&{tgt:g.tgt,about:g.about,with:g.with,hold:g.hold},desireA:fsVal(c,"fe_a","desire","p:fe_b"),relief:fsVal(c,"fe_a","relief"),
      opA:c.rel["fe_a>fe_b"].op,resA:c.rel["fe_a>fe_b"].res,resB:c.rel["fe_b>fe_a"].res,mA:mA.map(m=>m.content+"|"+m.status+"|"+m.source),mB:mB.map(m=>m.status),mE:mE.map(m=>m.content+"|"+m.source),
      angerC:fsVal(c,"fe_c","anger","p:fe_d"),enc:c.rel["fe_a>fe_b"].encDay}; });
  ok("the romance (Ana & Bo, alone at her flat) and the quarrel (Cem & Dov) were played out", r.played.length===2&&r.played.some(x=>/^Ana&Bo:romance:intimacy/.test(x))&&r.played.some(x=>/^Cem&Dov:conflict:quarrel/.test(x)), JSON.stringify(r.played));
  ok("the call is told both of them: the bond, how each sees the other, who they answer to, the place", /People they answer to: Fil \(husband\)/.test(r.t)&&/The relationship toward Bo: /.test(r.t)&&/How they see Ana today:/.test(r.t)&&/THE PLACE: Ana's flat/.test(r.t)&&/Nobody else is there/.test(r.t), (r.t||"").slice(0,1500));
  ok("the rules follow: a release, and guilt about herself that wrongs her husband, unresolved", r.guilt&&r.guilt.tgt==="self"&&r.guilt.about==="fe_f"&&r.guilt.with==="fe_b"&&r.guilt.hold&&r.relief>0, JSON.stringify(r));
  ok("opinions and resolutions, each their own", r.opA.kind>40&&r.resA&&r.resA.kind==="keep_distance"&&r.resB&&r.resB.kind==="pursue"&&r.resB.strength==="firm", JSON.stringify({opA:r.opA,resA:r.resA,resB:r.resB}));
  ok("a memory each, secret where it should be", r.mA.length===1&&/I slept with Bo/.test(r.mA[0])&&/\|secret\|offscreen_encounter$/.test(r.mA[0])&&r.mB[0]==="secret", JSON.stringify({mA:r.mA,mB:r.mB}));
  ok("the quarrel moved Cem's anger, and Eli at the café remembers what he saw", r.angerC>10&&r.mE.length===1&&/loud argument/.test(r.mE[0])&&/offscreen_witness$/.test(r.mE[0]), JSON.stringify({a:r.angerC,mE:r.mE}));

  console.log("\n[ordinary meetings, gates, the cooldown]");
  const o=await E(()=>{ const c=curChat(); const ce=c.rel["fe_c>fe_e"]; return {met:ce&&ce.met,due:ce&&ce.opDue,pend:_fsOpPending(c,state.personas.find(p=>p.id==="fe_c"))}; });
  ok("an ordinary meeting (Cem and Eli at the café) goes into the opinion update", o.met&&o.met.length===1&&o.met[0].place==="Corner Café"&&o.pend.includes("fe_e"), JSON.stringify(o));
  ok("the same stretch is not played twice", await E(async()=>{ window.__calls=[]; await runOffscreenEncounters(curChat(),3,"Afternoon"); return window.__calls.length===0?true:"played again"; }));
  ok("a pair that just had one is cooling down (the next stretch, the same day)", await E(async()=>{ const c=curChat(); window.__calls=[];
      c.dayPlacement={day:3,period:"Evening",positions:{fe_a:"fe_lh",fe_b:"fe_lh"}}; await runOffscreenEncounters(c,3,"Evening");
      return window.__calls.length===0?true:JSON.stringify(window.__calls.map(x=>x.dbg)); }));
  ok("a romance needs privacy: in a busy café it is not played", await E(async()=>{ const c=curChat(); window.__calls=[]; c.rel["fe_a>fe_b"].encDay=0; c.rel["fe_b>fe_a"].encDay=0;
      c.dayPlacement={day:4,period:"Morning",positions:{fe_a:"fe_lc",fe_b:"fe_lc",fe_e:"fe_lc",fe_f:"fe_lc"}}; c.gameDay=4; await runOffscreenEncounters(c,4,"Morning");
      return !window.__calls.some(x=>/Ana & Bo/.test(x.dbg))?true:"played"; }));
  ok("a pull on one side only is not a romance", await E(()=>{ const c=curChat(); c.rel["fe_b>fe_a"].attraction=5; Object.assign(c.rel["fe_b>fe_a"].op,{appealing:0,interested:0}); c.feel={};
      const k=fsEncounterKind(c,state.personas.find(p=>p.id==="fe_a"),state.personas.find(p=>p.id==="fe_b")); return k!=="romance"?true:k; }));
  ok("someone in the player's scene is not off screen", await E(async()=>{ const c=curChat(); window.__calls=[]; c.rel["fe_b>fe_a"].attraction=60; Object.assign(c.rel["fe_b>fe_a"].op,{appealing:65,interested:55});
      c.presentIds=["fe_a"]; c.dayPlacement={day:5,period:"Morning",positions:{fe_a:"fe_lh",fe_b:"fe_lh"}}; c.gameDay=5; await runOffscreenEncounters(c,5,"Morning"); c.presentIds=[];
      return window.__calls.length===0?true:"played"; }));
  ok("the drama setting caps a stretch (quiet: one at most)", await E(async()=>{ const c=curChat(); window.__calls=[]; state.fsDrama="quiet";
      ["fe_a>fe_b","fe_b>fe_a","fe_c>fe_d","fe_d>fe_c"].forEach(k=>{ c.rel[k].encDay=0; });
      c.dayPlacement={day:6,period:"Morning",positions:{fe_a:"fe_lh",fe_b:"fe_lh",fe_c:"fe_lc",fe_d:"fe_lc"}}; c.gameDay=6;
      const played=await runOffscreenEncounters(c,6,"Morning"); state.fsDrama="dramatic"; return played.length===1?true:played.length; }));

  console.log("\n[when it runs, and the setting]");
  ok("when a part of the day ends, before the opinion updates", await E(async()=>{ const order=[]; const rE=window.runOffscreenEncounters, rO=window.runOpinionUpdates;
      window.runOffscreenEncounters=async()=>{ order.push("enc"); return []; }; window.runOpinionUpdates=async()=>{ order.push("op"); };
      try{ const c=curChat(); c.gameDay=7; c.period="Morning"; advanceTime(c,1); await new Promise(r=>setTimeout(r,600)); }finally{ window.runOffscreenEncounters=rE; window.runOpinionUpdates=rO; }
      return order.join(",")==="enc,op"?true:order.join(","); }));
  ok("the drama setting is saved", await E(()=>{ show('settings'); const e=document.getElementById('setFsDrama'); if(!e)return "no select";
      e.value="quiet"; saveSettings(false); const a=state.fsDrama==="quiet"&&store.raw(K.fsDrama,"")==="quiet"; e.value="normal"; saveSettings(false); return a?true:state.fsDrama; }));
  ok("the prompt is listed under Opinions and encounters", await E(()=>X_PROMPT_CARDS.find(x=>x.key==="opinions").keys.includes("x_offscreen_encounter")&&!!PROMPT_BY_KEY.x_offscreen_encounter));

  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close(); process.exit(fail?1:0);
})();
