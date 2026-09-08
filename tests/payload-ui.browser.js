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
    document.querySelectorAll('details').forEach(d=>{ if(d.querySelector('#payloadTplList')||d.id==='') d.open=true; });
    let n=document.getElementById('payloadTplList'); while(n){ if(n.tagName==='DETAILS')n.open=true; n=n.parentElement; }
    const cat=document.querySelector('#payloadTplList details'); if(cat)cat.open=true;
  });
  await pg.waitForTimeout(500);

  console.log("\n[toggle no longer overlaps its label]");
  const g=await pg.evaluate(()=>{
    const inp=document.getElementById('payloadTplOn');
    const sw=inp.closest('.switchLbl'), row=sw.parentElement;
    const lab=row.querySelector('label:not(.switchLbl)');
    const a=sw.getBoundingClientRect(), b=lab.getBoundingClientRect();
    return {swW:Math.round(a.width),swH:Math.round(a.height),
            labW:Math.round(b.width), overlap:!(a.right<=b.left||b.right<=a.left),
            labInsideSwitch:sw.contains(lab), rowCls:row.className};
  });
  ok("switch is its normal 46x26 box", g.swW===46&&g.swH===26, JSON.stringify(g));
  ok("label is NOT inside the switch", !g.labInsideSwitch);
  ok("label and switch do not overlap", !g.overlap, JSON.stringify(g));
  ok("uses the app's kvline row", g.rowCls==="kvline");

  console.log("\n[piece rows show the name, not the {{call}} wrapper]");
  const r=await pg.evaluate(()=>{
    const h=document.getElementById('payloadTplList').innerHTML;
    const codes=[...document.querySelectorAll('#payloadTplList code[onclick]')].map(c=>c.textContent);
    return {hasWrapperInRows:codes.some(c=>c.indexOf("{{call//")===0),
            sample:codes.slice(0,6), hasEdit:h.indexOf("ptEditPiece(")>-1,
            editCount:(h.match(/ptEditPiece\(/g)||[]).length,
            usedByCount:(h.match(/ptShowUsedBy\(/g)||[]).length};
  });
  ok("no {{call//…}} text in the piece rows", !r.hasWrapperInRows, JSON.stringify(r.sample));
  ok("plain names shown", r.sample.includes("task")&&r.sample.includes("your_bio"), JSON.stringify(r.sample));
  ok("every piece has an edit button", r.editCount>=32, "edit="+r.editCount);

  console.log("\n[nothing is clipped on a 412px phone]");
  const clip=await pg.evaluate(()=>{
    const bad=[];
    document.querySelectorAll('#payloadTplList code, #payloadTplList .btn').forEach(el=>{
      if(el.scrollWidth>el.clientWidth+2) bad.push(el.textContent.trim().slice(0,24));
    });
    const host=document.getElementById('payloadTplList');
    return {truncated:bad.slice(0,6), overflowX:host.scrollWidth>host.clientWidth+2};
  });
  ok("no truncated names or buttons", clip.truncated.length===0, JSON.stringify(clip.truncated));
  ok("no horizontal overflow", !clip.overflowX);

  console.log("\n[edit jumps to the right place]");
  const e1=await pg.evaluate(()=>{
    ptEditPiece("your_bio");
    const row=document.querySelector('#plqBody_solo .plqRow[data-b="your_bio"]');
    return {found:!!row, open:!!(row&&row.closest('details[data-plq]')&&row.closest('details[data-plq]').open),
            highlighted:!!(row&&row.style.outline)};
  });
  ok("edit opens the block's row", e1.found&&e1.open, JSON.stringify(e1));
  ok("and highlights it", e1.highlighted);
  const e2=await pg.evaluate(()=>{ try{ ptEditPiece("dialogue_history"); ptEditPiece("scene"); return "ok"; }catch(x){ return "threw: "+x.message; } });
  ok("pieces with no wording degrade gracefully", e2==="ok", e2);

  console.log("\n[engine editor edit button]");
  const e3=await pg.evaluate(()=>{
    renderEngineTemplates();
    const h=document.getElementById('engineTplList').innerHTML;
    let threw=null; try{ epEditPrompt("gmJudge"); }catch(x){ threw=x.message; }
    return {hasBtn:h.indexOf("epEditPrompt(")>-1, threw};
  });
  ok("engines have an edit-prompt button", e3.hasBtn);
  ok("it does not throw", !e3.threw, e3.threw);

  ok("no page errors", errs.length===0, errs.join(" | "));
  const host=await pg.$('#payloadTplList');
  if(host) await host.screenshot({path:'/tmp/claude-0/-home-user-Multirp/6f8c26fa-7571-5021-b80f-bf6808b4c48c/scratchpad/ui-fixed.png'});
  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close(); process.exit(fail?1:0);
})();
