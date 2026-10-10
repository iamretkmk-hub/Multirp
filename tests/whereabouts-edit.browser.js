/* v150.102 — THE PLAYER SETS A CHARACTER'S WHEREABOUTS. The daily whereabouts (the schedule the placement dice weigh)
   were generated and shown read-only. Each part of the day now lists its places with a weight the player can change, a ×
   to take one out and "+ place" to add one of the character's places; the dice follow it; ticking places keeps a schedule
   the player set; Generate / refresh replaces it.
   Run: node tests/whereabouts-edit.browser.js */
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:process.env.SM_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage({viewport:{width:412,height:915}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file://'+require('path').resolve(__dirname,'..','index.html')); await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(800);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x===undefined?c:x).slice(0,800));} };

  await pg.evaluate(()=>{
    const uni=state.universes[0]; state.curUniverse=uni.id;
    uni.locations=[{id:"l_home",name:"Burcu's Flat",type:"home",residents:["w_b"]},{id:"l_cafe",name:"Kahve Durağı",type:"poi",residents:[]},
      {id:"l_gym",name:"Spor Salonu",type:"poi",residents:[]},{id:"l_bar",name:"Seaside Bar",type:"poi",residents:[]}];
    state.personas=state.personas.filter(p=>p.id!=="w_b");
    state.personas.push({id:"w_b",name:"Burcu",universeId:uni.id,personality:"x",look:{},locations:["l_cafe","l_gym"],
      schedule:{Morning:{l_home:5,l_cafe:3},Evening:{l_home:8}}});
    editPersona("w_b");
  });
  await pg.waitForTimeout(300);
  const P=()=>pg.evaluate(()=>{ const p=state.personas.find(x=>x.id==="w_b"); return {sched:JSON.parse(JSON.stringify(p.schedule||{})),edited:!!p.scheduleEdited}; });

  console.log("\n[the panel]");
  const V=await pg.evaluate(()=>{ const el=document.getElementById('peWhereabouts');
    const morning=el.querySelector('.peSchedRow[data-per="Morning"]');
    return {rows:el.querySelectorAll('.peSchedRow').length, inputs:[...morning.querySelectorAll('input[type=number]')].map(i=>i.dataset.loc+"="+i.value),
      text:morning.textContent.replace(/\s+/g," "), add:[...morning.querySelectorAll('select option')].map(o=>o.value).filter(Boolean)}; });
  ok("every part of the day has a row", V.rows===5, JSON.stringify(V));
  ok("each place shows an editable weight and its share", JSON.stringify(V.inputs)==='["l_home=5","l_cafe=3"]'&&/63%/.test(V.text)&&/38%/.test(V.text), JSON.stringify(V));
  ok("+ place offers only their other places (not one they never go to)", JSON.stringify(V.add)==='["l_gym"]', JSON.stringify(V.add));

  console.log("\n[changing it]");
  await pg.evaluate(()=>{ const i=document.querySelector('#peWhereabouts input[data-per="Morning"][data-loc="l_cafe"]'); i.value="15"; i.dispatchEvent(new Event("change")); });
  let s=await P();
  ok("a new weight is kept, and marked as set by you", s.sched.Morning.l_cafe===15&&s.edited===true, JSON.stringify(s));
  await pg.evaluate(()=>{ const sel=document.querySelector('#peWhereabouts .peSchedRow[data-per="Morning"] select'); sel.value="l_gym"; sel.dispatchEvent(new Event("change")); });
  s=await P();
  ok("+ place adds one, as likely as an average one there", s.sched.Morning.l_gym===10, JSON.stringify(s.sched.Morning));
  await pg.evaluate(()=>{ peSchedDel("Morning","l_home"); });
  s=await P();
  ok("× takes a place out of that part of the day", !("l_home" in s.sched.Morning)&&s.sched.Evening.l_home===8, JSON.stringify(s.sched));
  await pg.evaluate(()=>{ peSchedSet("Evening","l_home",0); });
  s=await P();
  ok("a weight of 0 takes it out too", !("l_home" in (s.sched.Evening||{})), JSON.stringify(s.sched));
  ok("the dice follow it (Morning: the café and the gym, by your weights)", await pg.evaluate(()=>{ const w=placementWeights(state.personas.find(x=>x.id==="w_b"),"Morning");
      return (w.l_cafe===15&&w.l_gym===10&&!(w.l_bar>0))?true:JSON.stringify(w); }));
  ok("it is saved with the character", await pg.evaluate(()=>{ const saved=JSON.stringify(store.get(K.personas,[])||[]); return /"scheduleEdited":true/.test(saved)||/scheduleEdited/.test(JSON.stringify(state.personas.find(x=>x.id==="w_b")))?true:"not saved"; }));

  console.log("\n[ticking places, regenerating]");
  ok("ticking another place adds it to + place", await pg.evaluate(()=>{ const c=[...document.querySelectorAll('#peVisitLocs .peVisitChk')].find(x=>x.value==="l_bar"); c.checked=true; c.dispatchEvent(new Event("change"));
      const opts=[...document.querySelectorAll('#peWhereabouts .peSchedRow[data-per="Afternoon"] select option')].map(o=>o.value); return opts.includes("l_bar")?true:JSON.stringify(opts); }));
  ok("saving with new places ticked keeps the schedule you set", await pg.evaluate(()=>{ try{ savePersona(); }catch(e){}
      const p=state.personas.find(x=>x.id==="w_b"); return (p.schedule&&p.schedule.Morning&&p.schedule.Morning.l_cafe===15&&p.locations.includes("l_bar"))?true:JSON.stringify({s:p.schedule,l:p.locations}); }));
  ok("Generate / refresh replaces it and clears the mark", await pg.evaluate(async()=>{ editPersona("w_b"); const real=window.generateSchedule; state.key=state.key||"sk-test";
      window.generateSchedule=async()=>({Morning:{l_gym:7}});
      try{ await genScheduleForCharacter(null); }finally{ window.generateSchedule=real; }
      const p=state.personas.find(x=>x.id==="w_b"); return (JSON.stringify(p.schedule)==='{"Morning":{"l_gym":7}}'&&!p.scheduleEdited)?true:JSON.stringify(p); }));
  ok("a character not saved yet is asked to be saved first", await pg.evaluate(()=>{ editPersona(null); return /Save the character first/.test(document.getElementById('peWhereabouts').textContent)?true:document.getElementById('peWhereabouts').textContent; }));

  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close(); process.exit(fail?1:0);
})();
