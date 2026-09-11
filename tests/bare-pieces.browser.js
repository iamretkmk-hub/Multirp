const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage();
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file:///home/user/Multirp/index.html'); await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(900);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+(x?"\n        "+String(x).slice(0,600):""));} };

  const R=await pg.evaluate(()=>{
    const uni=state.universes[0];
    uni.setting="A rainy port city where old money and new grudges share the same cafes.";
    uni.directingNotes="Pressure comes from money and family, never from strangers.";
    const p={id:"p_a",name:"Ayse",universeId:uni.id,avatar:"m",
      instructions:"Guarded, dry, watchful.",personality:"Wry. Slow to trust.",
      backstory:"Left at 19, came back at 34 for a funeral.",style:"Short sentences.",
      goals:"Find who sold the shop.",wardrobe:"A grey coat.",
      look:{subject:"Woman",hair:"black, short",face:"sharp",body:"tall"},
      socialGraph:"Kemal is her cousin. They do not speak about the shop."};
    const q={id:"p_b",name:"Emre",universeId:uni.id,instructions:"Loud.",personality:"Blunt.",
      backstory:"Runs the cafe.",style:"Long sentences.",goals:"Keep the peace.",look:{subject:"Man"}};
    state.personas.push(p,q);
    const chat=curChat();
    chat.gameDay=4; chat.period="Evening"; chat.location="Cafe Derya";
    chat.presentIds=[p.id]; state.user="Kemal";
    chat.messages=chat.messages||[];
    for(let i=0;i<4;i++) chat.messages.push({mid:"m"+i,role:i%2?"assistant":"user",
      speaker:i%2?"Ayse":null,speakerId:i%2?p.id:null,
      content:i%2?'*She looks up.* "You came back then."':'I sat down across from her.',
      present:[p.id],gameDay:4,gperiod:"Evening"});

    const injected={recent:[],diary:[],longterm:[]};
    const tOpts={chat,targetName:state.user,targetId:"__user__"};
    const mk=()=>Object.assign({},buildSystemPromptBlocks(injected,tOpts),
      buildTailBlocks({chat,selfP:p,selfId:p.id,selfName:p.name,
        targetName:state.user,targetId:"__user__",multi:false,injected}));
    const blocks=mk();
    const hist=[{role:"user",content:"I sat down."},{role:"assistant",content:"You came back then."}];

    // classic
    const pl=buildPayload("solo",buildSystemPromptBlocks(injected,tOpts),
      buildTailBlocks({chat,selfP:p,selfId:p.id,selfName:p.name,
        targetName:state.user,targetId:"__user__",multi:false,injected}));
    const classic=[]; if(pl.head)classic.push({role:"system",content:pl.head});
    classic.push(...hist); if(pl.tail)classic.push({role:"system",content:pl.tail});

    // template, default, templates ON
    const was=state.payloadTplOn; state.payloadTplOn=true;
    const tpl=ptBuildMessages("solo",blocks,hist,{chat,npc:p,targetName:state.user},mk);

    /* v38.1 — the STRIPPED version, produced by the button itself rather than by a copy of what
       the button used to do. It used to swap //full for bare; the headings do not ride inside the
       pieces any more, so it deletes the template's own prose lines instead. Driving the real
       function is the point: a test that reimplements the thing it is testing passes while the
       thing is broken (see tests/parity-live.browser.js). */
    ptStripHeaders("solo");
    const stripped=ptBuildMessages("solo",mk(),hist,{chat,npc:p,targetName:state.user},mk);
    ptSetTemplate("solo",null);
    state.payloadTplOn=was;

    return {defaultOn:state.payloadTplOn, storedRaw:localStorage.getItem(K.payloadTplOn),
            same:JSON.stringify(classic)===JSON.stringify(tpl),
            classicLen:JSON.stringify(classic).length, tplLen:JSON.stringify(tpl).length,
            classicHead:(classic[0]||{}).content||"", tplHead:(tpl&&tpl[0]||{}).content||"",
            strippedHead:(stripped&&stripped[0]||{}).content||"",
            strippedAll:(stripped||[]).map(m=>m.content).join("\n")};
  });

  console.log("\n[1] templates are ON by default]");
  ok("templates active on a fresh install", R.defaultOn===true, "state="+R.defaultOn+" stored="+R.storedRaw);

  console.log("\n[2] default template === classic payload, on a real scene]");
  ok("byte-identical", R.same, "classic "+R.classicLen+" chars vs template "+R.tplLen);

  console.log("\n[3] erasing the app's wording keeps the data]");
  const hadHdr=/WHO YOU ARE|RELEVANT MEMORIES|YOUR RELATIONSHIPS|SCENE RIGHT NOW/i.test(R.tplHead);
  ok("default DOES carry app headings", hadHdr, R.tplHead.slice(0,200));
  ok("stripped drops app headings", !/# WHO YOU ARE|# SCENE RIGHT NOW/i.test(R.strippedHead), R.strippedHead.slice(0,300));
  ok("stripped KEEPS the character's data", /Ayse/.test(R.strippedAll)&&/funeral/i.test(R.strippedAll), R.strippedAll.slice(0,300));
  ok("stripped is genuinely shorter", R.strippedHead.length < R.tplHead.length,
     "stripped "+R.strippedHead.length+" vs full "+R.tplHead.length);
  ok("stripped is not empty", R.strippedAll.trim().length>200, "len "+R.strippedAll.length);

  console.log("\n[4] no page errors]");
  ok("clean", errs.length===0, errs.join(" | "));
  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close(); process.exit(fail?1:0);
})();
