/* v150.64 — WHAT THE MODEL THOUGHT, AND THE WHOLE LOG. A reasoning model's message carries its reasoning (message.reasoning /
   reasoning_content, or reasoning_details), and it was thrown away; and the debug export took the last 120 entries of a
   200-entry log, which cut the start of the turn being reported. Checked here:
     - the reasoning is stored on the debug entry (each shape: reasoning, reasoning_content, reasoning_details text / summary,
       encrypted only), bounded, and never taken for the reply;
     - the expanded card shows it under "The model's reasoning", folded by default, readable (wrapped, escaped), and opening
       it or selecting in it does not collapse the card;
     - the export holds every entry in the log (up to its 200 cap), with the reasoning and a Decisions retry note.
   Run: node tests/debug-reasoning.browser.js   (needs playwright; see tests/README.md) */
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

  const R=await pg.evaluate(async()=>{
    state.key="sk-test"; dbgLog=[]; const rf=window.fetch; let reply=null;
    window.fetch=async(u,o)=>{ if(/\/chat\/completions$/.test(String(u)))return new Response(JSON.stringify(reply),{status:200}); return rf(u,o); };
    const run=async(msg,label)=>{ reply={choices:[{message:msg,finish_reason:"stop"}],usage:{prompt_tokens:10,completion_tokens:5}};
      const out=await chatCompletion([{role:"user",content:"x"}],"some/model",{rp:true,dbg:label}); const e=dbgLog.slice(-1)[0]; return {out,reasoning:e.reasoning||null}; };
    const r={};
    try{
      r.plain=await run({content:"\"Hello.\"",reasoning:"She is nervous <b>and</b> hides it.\nSo: short."},"Roleplay reply");
      r.content=await run({content:"\"Hi.\"",reasoning_content:"Thinking in the other field."},"Roleplay reply");
      r.details=await run({content:"\"Yes.\"",reasoning_details:[{type:"reasoning.summary",summary:"A summary of the thought."},{type:"reasoning.text",text:"And the text."}]},"Roleplay reply");
      r.enc=await run({content:"\"No.\"",reasoning_details:[{type:"reasoning.encrypted",data:"xyz"}]},"Roleplay reply");
      r.none=await run({content:"\"Fine.\""},"Roleplay reply");
      r.big=await run({content:"\"Ok.\"",reasoning:"y".repeat(30000)},"Roleplay reply");
    } finally{ window.fetch=rf; }
    r.big={len:r.big.reasoning.length,out:r.big.out};
    return r; });
  ok("message.reasoning is kept on the entry, and the reply is still the content", R.plain.reasoning==="She is nervous <b>and</b> hides it.\nSo: short."&&R.plain.out==="\"Hello.\"", JSON.stringify(R.plain));
  ok("reasoning_content, and reasoning_details (summary and text, in order)", R.content.reasoning==="Thinking in the other field."&&R.details.reasoning==="A summary of the thought.\n\nAnd the text.", JSON.stringify([R.content,R.details]));
  ok("an encrypted block only is said to be one; no reasoning, nothing stored", /1 encrypted reasoning block/.test(R.enc.reasoning||"")&&R.none.reasoning===null, JSON.stringify([R.enc,R.none]));
  ok("bounded at 20000 characters", R.big.len===20001&&R.big.out==="\"Ok.\"", JSON.stringify(R.big));

  const C=await pg.evaluate(async()=>{
    show('debug'); renderDebug();
    const cards=[...document.querySelectorAll('#debugList .card')];
    const target=cards.find(c=>/She is nervous/.test(c.textContent));   // the first reply logged above
    target.click(); await new Promise(r=>setTimeout(r,30));
    const det=target.querySelector('details[data-reasoning]'), body=target.querySelector('[data-body]');
    const r={has:!!det,closed:det&&!det.open,title:det&&/The model's reasoning/.test(det.querySelector('summary').textContent),
      escaped:det&&/She is nervous <b>and<\/b> hides it\./.test(det.querySelector('div').textContent)&&!det.querySelector(':scope > div b'),
      wrap:det&&getComputedStyle(det.querySelector('div')).whiteSpace==="pre-wrap"};
    det.querySelector('summary').click(); await new Promise(r=>setTimeout(r,30));
    r.opened=det.open&&!body.classList.contains('hide');
    det.querySelector('div').click(); await new Promise(r=>setTimeout(r,30));
    r.stillOpen=!body.classList.contains('hide');
    const none=cards.find(c=>/Roleplay reply/.test(c.textContent)&&!c.querySelector('details[data-reasoning]')); none.click(); await new Promise(r=>setTimeout(r,30));
    r.noneHasNo=!none.querySelector('details[data-reasoning]');
    return r; });
  ok("the expanded card shows \"The model's reasoning\", folded by default, readable and escaped", C.has&&C.closed&&C.title&&C.escaped&&C.wrap, JSON.stringify(C));
  ok("opening it, and clicking inside it, keeps the card open", C.opened&&C.stillOpen, JSON.stringify(C));
  ok("an entry with no reasoning has no such section", C.noneHasNo===true, JSON.stringify(C));

  const X=await pg.evaluate(async()=>{
    dbgLog=[]; for(let i=0;i<230;i++){ const e=dbg("Entry "+i,"Test","x",{n:i}); dbgDone(e,"ok","r"+i); }
    dbgLog[dbgLog.length-1].reasoning="Why it answered."; dbgLog[dbgLog.length-2].retry={refused:"emotion",note:"Sent again once without it."};
    let blob=null; const cu=URL.createObjectURL, ck=HTMLAnchorElement.prototype.click;
    URL.createObjectURL=b=>{ blob=b; return "blob:x"; }; HTMLAnchorElement.prototype.click=function(){};
    try{ exportDebug(); } finally{ URL.createObjectURL=cu; HTMLAnchorElement.prototype.click=ck; }
    const j=JSON.parse(await blob.text()); dbgLog=[];
    return {count:j.count,total:j.totalInLog,first:j.entries[0].label,last:j.entries[j.entries.length-1].label,reasoning:j.entries[j.entries.length-1].reasoning,retry:j.entries[j.entries.length-2].retry,dec:j.env.decisionsModel}; });
  ok("the export holds every entry in the log, up to the 200 cap (the oldest kept one first)", X.count===200&&X.total===200&&X.first==="Entry 30"&&X.last==="Entry 229", JSON.stringify(X));
  ok("…with the reasoning, a refusal retry, and the Decisions model in its environment", X.reasoning==="Why it answered."&&X.retry&&X.retry.refused==="emotion"&&X.dec==="openai/gpt-6-luna-decisions", JSON.stringify(X));

  ok("no page errors", errs.length===0?true:errs.join(" | "));
  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close(); process.exit(fail?1:0);
})().catch(e=>{ console.error(e); process.exit(1); });
