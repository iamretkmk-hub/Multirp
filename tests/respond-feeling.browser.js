/* v150.88 — the closing line names how they feel right now. "Respond as {{char}}." becomes "Respond as {{char}}, {{tone}}
   right now — it shows in how you speak, never in naming it." on solo / multi / gamemaster / text when an emotion is picked;
   plain when none is, and always plain in heat. "Respond as" is mode "one": the feeling option wins, switching it off leaves
   the plain line. A saved "Respond as" still at its v150.87 default is upgraded; an edited one stays.
   Run: NODE_PATH=/path/to/node_modules node tests/respond-feeling.browser.js */
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:process.env.SM_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage({viewport:{width:412,height:915}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file://'+require('path').resolve(__dirname,'..','index.html')); await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(900);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x===undefined?c:x).slice(0,900));} };

  const R=await pg.evaluate(()=>{
    const f=FRAG_DEFAULTS.find(x=>x.id==="respond_as"), L=[JSON.parse(JSON.stringify(f))];
    const line=(kind,tone,list)=>fragCompile(kind,ptCondFlags({tone:tone||"",emotion:tone?"Anger":""}),{},false,{list:list||L}).split("\n").filter(l=>/Respond as/.test(l)).join(" | ");
    const r={};
    ["solo","multi","gm","text","heat"].forEach(k=>{ r[k+"_tone"]=line(k,"irritated"); r[k+"_none"]=line(k,""); });
    const off=JSON.parse(JSON.stringify(L)); off[0].options.find(o=>o.id==="feeling").on=false; r.off=line("solo","irritated",off);
    return r; });
  ["solo","multi","gm","text"].forEach(k=>ok(k+": with an emotion picked, the line carries the feeling, shown and never named",
    R[k+"_tone"]==="- Respond as {{char}}, {{tone}} right now — it shows in how you speak, never in naming it.", R[k+"_tone"]));
  ok("with no emotion picked, the plain line on every path", ["solo","multi","gm","text","heat"].every(k=>R[k+"_none"]==="- Respond as {{char}}."), JSON.stringify(R));
  ok("heat keeps the plain line even with an emotion picked", R.heat_tone==="- Respond as {{char}}.", R.heat_tone);
  ok("the feeling option switched off: the plain line, once", R.off==="- Respond as {{char}}.", R.off);

  // the whole payload: the tone is the picked one, filled
  const P=await pg.evaluate(()=>{
    const uni=state.universes[0]; state.curUniverse=uni.id; state.user="Emre"; state.fragments=null;
    state.personas=state.personas.filter(p=>p.id!=="rf_a"); state.personas.push({id:"rf_a",name:"Ayla",universeId:uni.id,look:{},personality:"x",instructions:"x"});
    const c=curChat(); Object.assign(c,{universeId:uni.id,presentIds:["rf_a"],emo:{},messages:[{mid:"u1",role:"user",content:'"Hi."'}]});
    const p=state.personas.find(x=>x.id==="rf_a");
    const pay=kind=>{ const B=Object.assign({},buildCharPromptBlocks(p,[],{recent:[],diary:[],longterm:[]},null,{chat:c,targetName:"Emre",targetId:"__user__",payloadKind:kind}),
        buildTailBlocks({chat:c,selfP:p,selfId:p.id,selfName:p.name,targetName:"Emre",targetId:"__user__",injected:{recent:[],diary:[],longterm:[]},payloadKind:kind}));
      return (ptBuildMessages(kind,B,[{role:"user",content:"(history)"}],{chat:c,npc:p,targetName:"Emre"})||[]).map(m=>m.content).join("\n").split("\n").filter(l=>/Respond as/.test(l)).join(" | "); };
    const none=pay("solo");
    c.emo={rf_a:{emotion:"Anger",intensity:"mild",tone:"irritated",ego:"",sig:"x",scene:_placeSig(c),day:c.gameDay||1,at:Date.now(),asks:{},relAbout:{}}};
    return {none,tone:pay("solo")}; });
  ok("in a real payload: plain before a pick, then the picked tone filled in", P.none==="- Respond as Ayla."&&P.tone==="- Respond as Ayla, irritated right now — it shows in how you speak, never in naming it.", JSON.stringify(P));

  // the upgrade of a saved list
  const U=await pg.evaluate(()=>{
    const old=JSON.parse(JSON.stringify(FRAG_DEFAULTS_V150_87_RESPOND.respond_as));
    const edited=JSON.parse(JSON.stringify(old)); edited.text="- Respond as {{char}}, in character.";
    const run=fr=>{ const L=FRAG_DEFAULTS.map(f=>f.id==="respond_as"?JSON.parse(JSON.stringify(fr)):JSON.parse(JSON.stringify(f)));
      state.fragments=L; store.setRaw(K.fragAdds,FRAG_SHIPPED_ADDS.map(a=>a.key).filter(k=>k!=="v150.88.respond").join(",")); _fragMigratedFor=null; fragMigrateStored();
      const g=state.fragments.find(f=>f.id==="respond_as"); return {mode:g.mode,opts:(g.options||[]).map(o=>o.id).join(","),text:g.text}; };
    const r={unedited:run(old),edited:run(edited)}; state.fragments=null; return r; });
  ok("a saved \"Respond as\" still at its v150.87 default is upgraded", U.unedited.mode==="one"&&U.unedited.opts==="feeling,plain", JSON.stringify(U.unedited));
  ok("an edited one is the user's and stays", U.edited.mode==="any"&&U.edited.text==="- Respond as {{char}}, in character.", JSON.stringify(U.edited));

  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close(); process.exit(fail?1:0);
})();
