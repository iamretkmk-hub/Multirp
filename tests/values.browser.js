const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage({viewport:{width:412,height:915},deviceScaleFactor:2});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file:///home/user/Multirp/index.html'); await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(900);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+(x?"\n        "+String(x).slice(0,320):""));} };

  const R=await pg.evaluate(()=>{
    const uni=state.universes[0];
    const p={id:"p_a",name:"Ayse",universeId:uni.id,instructions:"x",personality:"x",backstory:"x",style:"x",goals:"x",look:{}};
    state.personas.push(p);
    const chat=curChat(); chat.gameDay=4; chat.period="Evening"; chat.location="Cafe Derya";
    chat.presentIds=[p.id]; state.user="Kemal";
    const reply=ptVars({chat,npc:p,targetName:"Kemal"});
    const eng=ptVars({chat},"any");
    // does {{npc.name}} actually resolve in a reply template?
    const blocks={task:"# TASK\nx"};
    const was=state.payloadTplOn; state.payloadTplOn=true;
    ptSetTemplate("solo","[system]\n{{call//task}}\n[system end]\n{{call//dialogue_history}}\n[user]\nYou are {{npc.name}}, it is {{period}} on day {{current_day}} in {{location}}. Language: {{story_language}}. Area: {{sub_area}}.\n[end user]\n");
    const m=ptBuildMessages("solo",blocks,[{role:"user",content:"hi"}],{chat,npc:p,targetName:"Kemal"},()=>blocks);
    ptSetTemplate("solo",null);
    // engine scan should REJECT npc.name
    const engScan=ptScan("[system]\n{{call//prompt}}\n[system end]\n[user]\n{{npc.name}} {{period}}\n[end user]",
                          epKnownNames("gmJudge"), ptVars({},"any"));
    const replyScan=ptScan("{{npc.name}} {{period}} {{nonsense}}", ptKnownNames());
    state.payloadTplOn=was;
    return {replyKeys:Object.keys(reply).sort(), engKeys:Object.keys(eng).sort(),
      sent:(m||[]).map(x=>x.content).join("\n"),
      engRejects:engScan.unknownVar, replyRejects:replyScan.unknownVar,
      total:PT_VALUES.length};
  });

  console.log("\n[{{npc.name}} is valid in a reply payload]");
  ok("listed as a reply value", R.replyKeys.includes("npc.name"), JSON.stringify(R.replyKeys));
  ok("actually resolves to the character", R.sent.indexOf("You are Ayse")>-1, R.sent.slice(-260));
  ok("period / day / location resolve", /Evening on day 4 in Cafe Derya/.test(R.sent), R.sent.slice(-260));
  ok("new value story_language resolves", !/\{\{story_language\}\}/.test(R.sent), R.sent.slice(-200));
  ok("new value sub_area resolves", !/\{\{sub_area\}\}/.test(R.sent), R.sent.slice(-200));

  console.log("\n[engines are scoped: no single speaker there]");
  ok("engine value set excludes npc.name", !R.engKeys.includes("npc.name"), JSON.stringify(R.engKeys));
  ok("engine value set keeps the scene ones", R.engKeys.includes("period")&&R.engKeys.includes("location"));
  ok("{{npc.name}} is FLAGGED in an engine template", R.engRejects.includes("npc.name"), JSON.stringify(R.engRejects));
  ok("{{period}} is not flagged there", !R.engRejects.includes("period"));
  ok("reply templates still accept npc.name", !R.replyRejects.includes("npc.name")&&R.replyRejects.includes("nonsense"), JSON.stringify(R.replyRejects));

  console.log("\n[the list is in the UI now]");
  const u=await pg.evaluate(()=>{
    show('settings'); renderPayloadList(); renderEngineTemplates();
    let n=document.getElementById('payloadTplList'); while(n){ if(n.tagName==='DETAILS')n.open=true; n=n.parentElement; }
    document.querySelectorAll('#payloadTplList details, #engineTplList details').forEach(d=>d.open=true);
    const rep=document.getElementById('payloadTplList').innerText;
    const engRows=[...document.querySelectorAll('#engineTplList code')].map(c=>c.textContent);
    const eng=document.getElementById('engineTplList').innerText;
    return {repHas:rep.indexOf("Values you can drop")>-1, repNpc:rep.indexOf("npc.name")>-1,
            engHas:eng.indexOf("Values you can drop")>-1, engNpc:engRows.indexOf("npc.name")>-1, engRows};
  });
  ok("reply editor lists the values", u.repHas&&u.repNpc);
  ok("engine editor lists values too", u.engHas);
  ok("engine value ROWS omit npc.name", !u.engNpc, JSON.stringify((u.engRows||[]).filter(x=>x.indexOf("npc")>-1)));

  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log("\n"+pass+" passed, "+fail+" failed  ("+R.total+" values registered)");
  await b.close(); process.exit(fail?1:0);
})();
