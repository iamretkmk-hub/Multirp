const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage({viewport:{width:412,height:915},deviceScaleFactor:2});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file:///home/user/Multirp/index.html'); await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(900);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+(x?"\n        "+String(x).slice(0,400):""));} };

  const R=await pg.evaluate(()=>{
    // a realistic chat payload, the shape a reply actually sends
    const payload={model:"x/y",temperature:0.9,messages:[
      {role:"system",content:"# TASK\nYou are Nil Akbaba. Embody her fully.\n\n# UNIVERSE SETTING\nIsdemir Lojmanlari, a worn but warm housing complex.\n\n# RESPONSE FORMAT\n- Spoken dialogue: plain text in \"double quotes\".\n- Narration: *single asterisks*."},
      {role:"user",content:"I sat down across from her."},
      {role:"assistant",content:"\"You came back then.\""},
      {role:"user",content:"Day 4, Evening in Cafe Derya.\nRespond as Nil Akbaba would."}
    ]};
    const e=dbg("Roleplay reply","OpenRouter","https://x/chat/completions",payload);
    dbgDone(e,"ok","\"Looks like it.\"");
    show('debug'); renderDebug();
    const card=document.querySelector('#screen-debug .card');
    card.querySelector('[data-body]').classList.remove('hide');
    const sentText=card.querySelector('pre').innerText;
    const sentLabel=card.querySelector('label').innerText;
    const segOn=[...card.querySelectorAll('[data-dbgview]')].map(x=>({v:x.dataset.dbgview,on:x.className.indexOf('on')>-1}));
    // flip to capsules
    setDbgView('capsules');
    const card2=document.querySelector('#screen-debug .card');
    card2.querySelector('[data-body]').classList.remove('hide');
    const capText=card2.querySelector('pre').innerText;
    const capLabel=card2.querySelector('label').innerText;
    const stored=localStorage.getItem(K.dbgView);
    setDbgView('sent');
    const backText=document.querySelector('#screen-debug .card pre')?1:0;
    return {sentText,sentLabel,capText,capLabel,segOn,stored,
            defaultMode:store.raw(K.dbgView,"sent")};
  });

  console.log("\n[default view is the readable one]");
  ok("label says it is the request body", /request body/i.test(R.sentLabel), R.sentLabel);
  // it must be VALID JSON and the exact request body
  let parsed=null, perr=null;
  try{ parsed=JSON.parse(R.sentText); }catch(x){ perr=x.message; }
  ok("it is valid JSON", !!parsed, perr);
  ok("has a messages array", !!(parsed&&Array.isArray(parsed.messages)));
  ok("exactly 4 message brackets", parsed&&parsed.messages.length===4, parsed&&parsed.messages.length);
  ok("ONE system bracket holding everything", parsed&&parsed.messages[0].role==="system"
     && parsed.messages[0].content.indexOf("# TASK")>-1
     && parsed.messages[0].content.indexOf("# RESPONSE FORMAT")>-1);
  ok("dialogue turns are their own brackets", parsed&&parsed.messages[1].role==="user"&&parsed.messages[2].role==="assistant");
  ok("ONE user bracket at the end", parsed&&parsed.messages[3].role==="user"
     && parsed.messages[3].content.indexOf("Respond as Nil Akbaba")>-1);
  ok("request params are there too", parsed&&parsed.model==="x/y"&&parsed.temperature===0.9);
  ok("no capsule decomposition", R.sentText.indexOf('"capsules"')===-1&&R.sentText.indexOf('"parts"')===-1&&R.sentText.indexOf('"section"')===-1);

  console.log("\n[capsules still available]");
  ok("switch flips to capsules", /capsule/i.test(R.capLabel), R.capLabel);
  ok("capsule view is the JSON form", R.capText.indexOf('"capsules"')>-1, R.capText.slice(0,150));
  ok("choice is remembered", R.stored==="capsules", "stored="+R.stored);
  ok("segment marks the active one", R.segOn.some(x=>x.v==="sent"&&x.on), JSON.stringify(R.segOn));

  ok("no page errors", errs.length===0, errs.join(" | "));
  const card=await pg.$('#screen-debug .card');
  if(card) await card.screenshot({path:'/tmp/claude-0/-home-user-Multirp/6f8c26fa-7571-5021-b80f-bf6808b4c48c/scratchpad/dbgview.png'});
  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close(); process.exit(fail?1:0);
})();
