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

  await pg.evaluate(()=>{ show('settings'); renderPayloadList();
    let n=document.getElementById('payloadList'); while(n){ if(n.tagName==='DETAILS')n.open=true; n=n.parentElement; }
    const d=document.querySelector('details[data-plq="solo"]'); d.open=true; renderPayloadEditor('solo'); });
  await pg.waitForTimeout(400);

  console.log("\n[part rows lead with the name]");
  const r=await pg.evaluate(()=>{
    const rows=[...document.querySelectorAll('#plqBody_solo .plqRow')];
    const names=rows.map(x=>{const c=x.querySelector('.plqName');return c?c.textContent:null;});
    return {count:rows.length, names:names.slice(0,6), allNamed:names.every(Boolean),
      hasCopy:document.getElementById('plqBody_solo').innerHTML.indexOf('>copy<')>-1,
      hasUsedBy:document.getElementById('plqBody_solo').innerHTML.indexOf('>used by<')>-1,
      historyNamed:names.includes('dialogue_history')};
  });
  ok("every part shows its name", r.allNamed, JSON.stringify(r.names));
  ok("names are the ones you type", r.names.includes("task")&&r.names.includes("your_bio"), JSON.stringify(r.names));
  ok("the transcript row is named too", r.historyNamed);
  ok("copy / used by present", r.hasCopy&&r.hasUsedBy);

  console.log("\n[arrows still work and sit on their own line]");
  const a=await pg.evaluate(()=>{
    const row=document.querySelector('#plqBody_solo .plqRow[data-b="your_bio"]');
    const head=row.querySelector('.plqHead').getBoundingClientRect();
    const btns=row.querySelector('.plqBtns').getBoundingClientRect();
    const before=payloadOrder('solo').indexOf('your_bio');
    movePayloadBlock('solo','your_bio',-1);
    const after=payloadOrder('solo').indexOf('your_bio');
    movePayloadBlock('solo','your_bio',1);
    const restored=payloadOrder('solo').indexOf('your_bio');
    return {below:btns.top>=head.bottom-1, before, after, restored,
      arrowsRight:!!row.querySelector('.plqBtns .plqArrows')};
  });
  ok("buttons sit below the name row", a.below, JSON.stringify(a));
  ok("arrows live in the button row", a.arrowsRight);
  ok("move up still works", a.after===a.before-1, JSON.stringify(a));
  ok("and move back down", a.restored===a.before);

  console.log("\n[nothing clipped at 412px]");
  const c=await pg.evaluate(()=>{
    const host=document.getElementById('plqBody_solo'); const bad=[];
    host.querySelectorAll('.plqName,.plqLabel,.plqBadge,.btn,.plqArrows button').forEach(el=>{
      if(el.scrollWidth>el.clientWidth+2) bad.push((el.textContent||"").trim().slice(0,24));
    });
    return {bad:bad.slice(0,8), overflowX:host.scrollWidth>host.clientWidth+2};
  });
  ok("no clipped names, labels, badges or buttons", c.bad.length===0, JSON.stringify(c.bad));
  ok("no horizontal overflow", !c.overflowX);

  console.log("\n[engine payloads card matches]");
  const e=await pg.evaluate(()=>{
    const det=document.querySelector('details[data-eplq]');
    det.open=true; renderEnginePayloadEditor(det.dataset.eplq);
    const host=document.getElementById('eplqBody_'+det.dataset.eplq);
    const names=[...host.querySelectorAll('.plqName')].map(x=>x.textContent);
    const bad=[]; host.querySelectorAll('.plqName,.plqLabel,.plqBadge').forEach(el=>{
      if(el.scrollWidth>el.clientWidth+2) bad.push((el.textContent||"").trim().slice(0,24)); });
    return {names, bad, overflowX:host.scrollWidth>host.clientWidth+2};
  });
  ok("prompt rows show their prompt key", e.names.length>0, JSON.stringify(e.names));
  ok("nothing clipped there either", e.bad.length===0&&!e.overflowX, JSON.stringify(e.bad));

  ok("no page errors", errs.length===0, errs.join(" | "));
  const shot=await pg.$('#plqBody_solo');
  if(shot) await shot.screenshot({path:'/tmp/claude-0/-home-user-Multirp/6f8c26fa-7571-5021-b80f-bf6808b4c48c/scratchpad/parts.png'});
  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close(); process.exit(fail?1:0);
})();
