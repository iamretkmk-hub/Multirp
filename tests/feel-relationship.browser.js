/* v150.113 — THE CONNECTED FEELING SYSTEM, STEP 5: THE RELATIONSHIP, AT THE END OF THE DAY. The daily read sets the six slow axes
   (love↔hate, trust, respect, attraction, closeness, commitment) from how the opinions went through the day (part by part, with
   the reads), the resolution, what still runs, and the memories — in words; the code applies hard-to-build / easy-to-lose and the
   scars. An answer with numeric deltas (an edited prompt) is still read the old way.
   Run: node tests/feel-relationship.browser.js */
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
    window.__calls=[]; window.__relAns=null;
    window.chatCompletion=async(msgs,model,opts)=>{ const dbg=(opts&&opts.dbg)||""; const t=(Array.isArray(msgs)?msgs:[]).map(m=>m.content).join("\n");
      window.__calls.push({dbg,t}); if(/^Daily relationship/.test(dbg))return JSON.stringify(window.__relAns||{}); return "{}"; };
    const uni=state.universes[0]; state.curUniverse=uni.id;
    state.personas=state.personas.filter(p=>!/^fr_/.test(p.id));
    state.personas.push({id:"fr_m",name:"Mara",universeId:uni.id,personality:"Warm.",look:{},relationships:{fr_l:{tie:"neighbour",relationship:"The man next door."},fr_t:{tie:"husband",relationship:"Married ten years."}}});
    state.personas.push({id:"fr_l",name:"Leo",universeId:uni.id,personality:"x",look:{}}); state.personas.push({id:"fr_t",name:"Tomas",universeId:uni.id,personality:"x",look:{}});
    state.key="sk-test"; state.emoOn=true; state.relOn=true; state.memory=[]; state.relPrompt=DEFAULT_REL;
    const c=curChat(); Object.assign(c,{universeId:uni.id,emo:{},feel:{},rel:{},fsv:1,fsTurn:5,gameDay:4,period:"Night",messages:[]});
    const o=relObj(c,"fr_m","fr_l"); Object.assign(o,{affection:30,trust:80,respect:20,attraction:50,familiarity:40,commitment:10,lastSlowDelta:{}});
    o.opHist=[{day:4,per:"Afternoon",op:{kind:40,reliable:60,respects:30,safe:50,interested:40,appealing:60},read:"He was gentle with you."},
              {day:4,per:"Evening",op:{kind:-20,reliable:-40,respects:0,safe:-30,interested:40,appealing:50},read:"He told Tomas. You cannot trust him."}];
    o.res={kind:"end_it",text:"It is over.",strength:"firm",day:4,per:"Evening"};
    fsFeelMove(c,state.personas[0],{k:"guilt",tgt:"self",size:60,dir:1,with:"fr_l",about:"fr_t",hold:true,cause:"slept with Leo"});
    window.__P=id=>state.personas.find(p=>p.id===id);
  });

  console.log("\n[what the daily read is told]");
  await E(()=>{ window.__relAns={moves:{affection:"fell",trust:"fell_a_lot",respect:"fell_a_little",attraction:"unchanged",familiarity:"rose_a_little",commitment:"unchanged"},description:"You do not trust him any more."}; });
  const r1=await E(async()=>{ const c=curChat(); window.__calls=[]; const before=c.rel["fr_m>fr_l"].trust;
    await evalRelationship(c,__P("fr_m"),"fr_l","Leo",[],[],4,{dayEnd:true});
    const call=window.__calls.find(x=>/^Daily relationship/.test(x.dbg)); const o=c.rel["fr_m>fr_l"];
    return {t:call&&call.t,before,trust:o.trust,aff:o.affection,fam:o.familiarity,scar:o.scars&&o.scars.trust,desc:o.desc,swing:o.lastSlowDelta}; });
  ok("the opinions through the day lead, part by part, with the reads", /HOW Mara SAW Leo THROUGH THE DAY \(the opinions, part by part — these lead\):\n- Afternoon: kind↔cruel 40[^\n]*"He was gentle with you\."\n- Evening: kind↔cruel -20[^\n]*"He told Tomas\. You cannot trust him\."/.test(r1.t), (r1.t||"").slice(0,1800));
  ok("…with her resolution, and her guilt marked as about herself, never evidence about him", /WHAT Mara HAS RESOLVED TOWARD Leo \(end_it, firm\): It is over\./.test(r1.t)&&/Guilt about themselves \(over something done with Leo\): strong/.test(r1.t)&&/never evidence about Leo/.test(r1.t), (r1.t||"").match(/FEELINGS STILL[\s\S]{0,300}/));
  ok("the six axes as they stand, and a move asked for each, in words", /- affection \(Love: hate ↔ love\): 30/.test(r1.t)&&/- commitment \(Commitment, 0–100\): 10/.test(r1.t)&&/a MOVE for each of the six axes under "moves"/.test(r1.t)&&!/FLEETING FEELINGS/.test(r1.t), (r1.t||"").slice(0,400));
  ok("the prompt: six axes, the opinions lead, hard to build and easy to lose, never the new level", await E(()=>/THE SIX AXES/.test(DEFAULT_REL)&&/The day's OPINIONS lead/.test(DEFAULT_REL)&&/HARD TO BUILD, EASY TO LOSE/.test(DEFAULT_REL)&&/NEVER THE NEW LEVEL/.test(DEFAULT_REL)&&/never evidence about the other person/.test(DEFAULT_REL)));

  console.log("\n[the moves, by the rules]");
  ok("trust that stood high falls far, and the fall scars it", r1.before-r1.trust>=25&&r1.scar&&r1.scar.from===80, JSON.stringify(r1));
  ok("love falls, closeness grows a little; the description is kept; the swing is what moved", r1.aff<30&&r1.fam>40&&/do not trust him/.test(r1.desc)&&r1.swing.trust===r1.trust-r1.before, JSON.stringify(r1));
  ok("one read per pair per day", await E(async()=>{ window.__calls=[]; await evalRelationship(curChat(),__P("fr_m"),"fr_l","Leo",[],[],4,{dayEnd:true}); return window.__calls.length===0?true:"read again"; }));
  ok("a scarred axis regains slowly the next day", await E(async()=>{ const c=curChat(); c.gameDay=5; const o=c.rel["fr_m>fr_l"]; const t0=o.trust;
      window.__relAns={moves:{trust:"rose"}}; await evalRelationship(c,__P("fr_m"),"fr_l","Leo",[],[],5,{dayEnd:true}); const scarredGain=o.trust-t0;
      const free=relObj(c,"fr_m","fr_t"); free.trust=t0; free.scars={}; free.lastSlowDelta={}; window.__relAns={moves:{trust:"rose"}};
      await evalRelationship(c,__P("fr_m"),"fr_t","Tomas",[],[],5,{dayEnd:true}); const freeGain=free.trust-t0;
      return (scarredGain>0&&scarredGain<freeGain*0.6)?true:JSON.stringify({scarredGain,freeGain}); }));
  ok("an answer in the old form (numeric deltas) is still read the old way", await E(async()=>{ const c=curChat(); c.gameDay=6; const o=c.rel["fr_m>fr_t"]; const t0=o.trust;
      window.__relAns={trust:5,affection:0,respect:0,familiarity:0,jealousy:0,desire:0,comfort:0,fear:0,agitation:0,description:"x"}; await evalRelationship(c,__P("fr_m"),"fr_t","Tomas",[],[],6,{dayEnd:true});
      return o.trust===t0+5?true:JSON.stringify({t0,t:o.trust}); }));

  console.log("\n[several people, one call]");
  ok("a character's targets share one call, said for the moves, each applied to its own pair", await E(async()=>{ const c=curChat(); c.gameDay=7;
      const a=c.rel["fr_m>fr_l"], t=c.rel["fr_m>fr_t"]; const la=a.affection, lt=t.affection;
      window.__calls=[]; window.__relAns={targets:[{target:"Leo",moves:{affection:"fell"}},{target:"Tomas",moves:{affection:"rose"}}]};
      await evalRelationshipsBatch(c,__P("fr_m"),[{id:"fr_l",name:"Leo"},{id:"fr_t",name:"Tomas"}],[],[],7);
      const calls=window.__calls.filter(x=>/^Daily relationship/.test(x.dbg));
      return (calls.length===1&&/a MOVE for each of the six axes under "moves"/.test(calls[0].t)&&a.affection<la&&t.affection>lt)?true:JSON.stringify({n:calls.length,la,a:a.affection,lt,t:t.affection}); }));

  console.log("\n[stored copies]");
  ok("a stored copy of the old nine-axis prompt is upgraded once", await E(()=>{ const old=DEFAULT_REL.replace(/THE CONNECTED SYSTEM[^\n]*\n/,"").replace(/THE SIX AXES/,"THE NINE AXES");
      store.setRaw(K.relPrompt,old); state.relPrompt=old; localStorage.removeItem("sm_pipesdone"); loadState();
      const r=state.relPrompt===DEFAULT_REL; store.del(K.relPrompt); localStorage.removeItem("sm_pipesdone"); loadState(); return r?true:String(state.relPrompt).slice(0,120); }));

  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close(); process.exit(fail?1:0);
})();
