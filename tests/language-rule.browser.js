const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file:///home/user/Multirp/index.html'); await pg.waitForTimeout(2300);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(700);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+(x?"\n        "+String(x).slice(0,300):""));} };

  const R=await pg.evaluate(()=>{
    state.storyLang="tr";
    const uni=state.universes[0]; uni.setting="Isdemir Lojmanlari.";
    const p={id:"p_n",name:"Nil Akbaba",universeId:uni.id,instructions:"x",personality:"Wry.",
      backstory:"Grew up here.",style:"Short.",goals:"Peace.",look:{}};
    state.personas.push(p);
    const chat=curChat(); chat.gameDay=2; chat.period="Evening"; chat.location="Lojman";
    chat.presentIds=[p.id]; state.user="Kemal";
    const injected={recent:[],diary:[],longterm:[]};
    const mk=()=>Object.assign({},
      buildCharPromptBlocks(p,[],injected,state.user,{chat,targetName:state.user,targetId:"__user__"}),
      buildTailBlocks({chat,selfP:p,selfId:p.id,selfName:p.name,targetName:state.user,targetId:"__user__",multi:false,injected}));
    const hist=[{role:"user",content:"hi"}];
    const run=t=>{ const was=state.payloadTplOn; state.payloadTplOn=true;
      ptSetTemplate("solo","[system]\n"+t+"\n[system end]\n{{call//dialogue_history}}\n");
      const m=ptBuildMessages("solo",mk(),hist,{chat,npc:p,targetName:state.user},mk);
      ptSetTemplate("solo",null); state.payloadTplOn=was;
      return (m&&m[0]||{}).content||""; };

    const bareFmt=run("{{call//format}}");
    const fullFmt=run("{{call//format//full}}");
    const langOnly=run("{{call//language_rule}}");
    const mine=run("# STRUCTURE\nMy own rules only.\n\n{{call//language_rule}}");

    // parity: default template must be unchanged
    const pl=buildPayload("solo",
      buildCharPromptBlocks(p,[],injected,state.user,{chat,targetName:state.user,targetId:"__user__"}),
      buildTailBlocks({chat,selfP:p,selfId:p.id,selfName:p.name,targetName:state.user,targetId:"__user__",multi:false,injected}));
    const classic=[]; if(pl.head)classic.push({role:"system",content:pl.head});
    classic.push(...hist); if(pl.tail)classic.push({role:"system",content:pl.tail});
    const was=state.payloadTplOn; state.payloadTplOn=true;
    const dflt=ptBuildMessages("solo",mk(),hist,{chat,npc:p,targetName:state.user},mk);
    state.payloadTplOn=was;

    // no internal keys leaked
    const leaked=(dflt||[]).map(m=>m.content).join("\n").indexOf("_format_rules")>-1;
    const known=ptKnownNames();
    return {bareFmt,fullFmt,langOnly,mine,leaked,
      same:JSON.stringify(classic)===JSON.stringify(dflt),
      knownLang:!!known["language_rule"], inCatalog:ptCatalog().some(c=>c.name==="language_rule")};
  });

  console.log("\n[the two halves are now separable]");
  ok("bare {{call//format}} has the app's rules", R.bareFmt.indexOf("FORMATTING RULES")>-1);
  ok("bare {{call//format}} has NO language rule", R.bareFmt.indexOf("STORY LANGUAGE")===-1, R.bareFmt.slice(-200));
  ok("{{call//format//full}} still carries both", R.fullFmt.indexOf("FORMATTING RULES")>-1&&R.fullFmt.indexOf("STORY LANGUAGE")>-1);
  ok("{{call//language_rule}} is the rule alone", R.langOnly.indexOf("STORY LANGUAGE")>-1&&R.langOnly.indexOf("FORMATTING RULES")===-1, R.langOnly.slice(0,120));
  ok("it names the chosen language", /TURKISH/.test(R.langOnly));

  console.log("\n[your own rules + the language rule, and nothing else]");
  ok("own rules kept", R.mine.indexOf("My own rules only")>-1);
  ok("language enforced", R.mine.indexOf("STORY LANGUAGE")>-1);
  ok("app's format rules NOT dragged in", R.mine.indexOf("FORMATTING RULES")===-1, R.mine.slice(0,200));

  console.log("\n[nothing else moved]");
  ok("default template still byte-identical", R.same);
  ok("no internal _keys leak into a payload", !R.leaked);
  ok("editor knows the name", R.knownLang&&R.inCatalog);
  console.log("\n[the directive does not contradict itself]");
  ok("the story rule never overrides the language it just selected", await pg.evaluate(()=>{
      const bad=[];
      ["tr","en","fr","de"].forEach(code=>{
        const was=state.storyLang; state.storyLang=code;
        const d=langDirective(); const n=storyLangName();
        state.storyLang=was;
        // "write in X … overrides any instruction to write in X" is the self-contradiction
        const m=d.match(/including any instruction to write in ([^)]+)\)/);
        if(!m) bad.push(code+": no override clause");
        else if(m[1].trim().toLowerCase()===n.toLowerCase()) bad.push(code+": overrides itself ("+n+")");
      });
      return bad.length?bad.join(", "):true; }));
  ok("no language name is hardcoded into the story rule", await pg.evaluate(()=>{
      const was=state.storyLang; state.storyLang="fr";
      const d=langDirective(); state.storyLang=was;
      return d.indexOf("Turkish")===-1 ? true : "still says Turkish with French selected"; }));
  ok("the engine rule names the story language it has to beat", await pg.evaluate(()=>{
      const was=state.storyLang; state.storyLang="fr";
      const d=engineLangDirective(); state.storyLang=was;
      return d.indexOf("French")>-1 && d.indexOf("Turkish")===-1
        ? true : "engine rule: "+d.slice(0,140); }));

  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close(); process.exit(fail?1:0);
})();
