const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage({viewport:{width:412,height:915},deviceScaleFactor:2});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file:///home/user/Multirp/index.html'); await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(900);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+(x?"\n        "+String(x).slice(0,300):""));} };

  await pg.evaluate(()=>{ show('settings'); renderPayloadList();
    let n=document.getElementById('engineTplList'); while(n){ if(n.tagName==='DETAILS')n.open=true; n=n.parentElement; } });
  await pg.waitForTimeout(400);

  console.log("\n[the 65 engines are findable]");
  const f=await pg.evaluate(()=>{
    const all=document.querySelectorAll('#engineTplList details[data-eptpl]').length;
    epFilterList("gossip");
    const g=[...document.querySelectorAll('#engineTplList details[data-eptpl]')].filter(d=>!d.hidden).length;
    epFilterList("memory");
    const m=[...document.querySelectorAll('#engineTplList details[data-eptpl]')].filter(d=>!d.hidden).length;
    epFilterList("zzzznope");
    const none=[...document.querySelectorAll('#engineTplList details[data-eptpl]')].filter(d=>!d.hidden).length;
    const msg=!document.getElementById('epNoMatch').hidden;
    epFilterList("");
    const back=[...document.querySelectorAll('#engineTplList details[data-eptpl]')].filter(d=>!d.hidden).length;
    return {all,g,m,none,msg,back};
  });
  ok("filter box exists and narrows", f.g>0&&f.g<f.all, JSON.stringify(f));
  ok("finds memory engines too", f.m>0&&f.m<f.all, "memory="+f.m);
  ok("empty result says so", f.none===0&&f.msg);
  ok("clearing restores all "+f.all, f.back===f.all);

  console.log("\n[per-engine piece list]");
  const p=await pg.evaluate(()=>{
    const det=document.querySelector('#engineTplList details[data-eptpl="gmJudge"]');
    const beforeHtml=document.getElementById('epPieces_gmJudge').innerHTML.length;
    det.open=true; renderEnginePieces('gmJudge');
    const host=document.getElementById('epPieces_gmJudge');
    const names=[...host.querySelectorAll('code[onclick]')].map(c=>c.textContent);
    return {lazyBefore:beforeHtml, names, hasEdit:host.innerHTML.indexOf("epEditPiece(")>-1,
            wrapper:names.some(n=>n.indexOf("{{call//")===0)};
  });
  ok("piece list is empty until opened (lazy)", p.lazyBefore===0);
  ok("shows this engine's own pieces", p.names.includes("prompt")&&p.names.includes("scene")&&p.names.includes("exchange"), JSON.stringify(p.names));
  ok("plain names, no {{call//…}} wrapper", !p.wrapper, JSON.stringify(p.names));
  ok("rows carry an edit button", p.hasEdit);

  console.log("\n[edit routes correctly inside an engine]");
  const e=await pg.evaluate(()=>{
    const out={};
    try{ epEditPiece("gmJudge","prompt");
         const card=ENGINE_PAYLOAD_DEFS.find(c=>(c.blocks||[]).some(b=>b.promptKey==="gmJudge"));
         const d=card?document.querySelector('details[data-eplq="'+card.key+'"]'):null;
         out.promptOpens=!!(d&&d.open); }catch(x){ out.promptErr=x.message; }
    try{ epEditPiece("gmJudge","data"); out.data="ok"; }catch(x){ out.data="threw "+x.message; }
    try{ epEditPiece("gmJudge","scene"); out.scene="ok"; }catch(x){ out.scene="threw "+x.message; }
    try{ epEditPiece("gmJudge","trackers"); out.lib="ok"; }catch(x){ out.lib="threw "+x.message; }
    return out;
  });
  ok("edit on `prompt` opens that engine's prompt box", e.promptOpens, JSON.stringify(e));
  ok("edit on `data` explains instead of throwing", e.data==="ok", e.data);
  ok("edit on a built piece explains", e.scene==="ok", e.scene);
  ok("edit on a shared piece explains", e.lib==="ok", e.lib);

  console.log("\n[phone width: nothing clipped]");
  const c=await pg.evaluate(()=>{
    const host=document.getElementById('engineTplList');
    const bad=[];
    host.querySelectorAll('code[onclick], .btn, summary').forEach(el=>{
      if(el.scrollWidth>el.clientWidth+2) bad.push((el.textContent||"").trim().slice(0,26));
    });
    return {bad:bad.slice(0,6), overflowX:host.scrollWidth>host.clientWidth+2};
  });
  ok("no clipped names, buttons or titles", c.bad.length===0, JSON.stringify(c.bad));
  ok("no horizontal overflow", !c.overflowX);

  ok("no page errors", errs.length===0, errs.join(" | "));
  await pg.evaluate(()=>{ const d=document.querySelector('#engineTplList details[data-eptpl="gmJudge"]'); d.scrollIntoView(); });
  await pg.waitForTimeout(200);
  const shot=await pg.$('#epPieces_gmJudge');
  if(shot) await shot.screenshot({path:'/tmp/claude-0/-home-user-Multirp/6f8c26fa-7571-5021-b80f-bf6808b4c48c/scratchpad/engine-pieces.png'});
  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close(); process.exit(fail?1:0);
})();
