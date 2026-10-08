/* The Payloads screen on a 412px phone. v150.66 — the reply payload templates (their switch, their piece list and its
   "edit beside the name") are gone: a reply is built from the fragments only. What is checked now: the engine templates'
   switch ("Use my engine templates", which lives in their card) does not overlap its label; the engine piece rows show the
   plain name, with an edit button each; nothing on the screen is clipped; the engine editor's buttons work.
   Run: node tests/payload-ui.browser.js */
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:process.env.SM_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage({viewport:{width:412,height:915},deviceScaleFactor:2});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file://'+require('path').resolve(__dirname,'..','index.html')); await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(900);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+(x?"\n        "+String(x).slice(0,300):""));} };

  await pg.evaluate(()=>{ show('settings'); renderPayloadList();
    let n=document.getElementById('engineTplList'); while(n){ if(n.tagName==='DETAILS')n.open=true; n=n.parentElement; }
    document.querySelectorAll('#engineTplList > details').forEach(d=>{ if(!d.dataset.eptpl) d.open=true; });   // the shared pieces and the values
  });
  await pg.waitForTimeout(500);

  console.log("\n[the engine templates' switch does not overlap its label]");
  const g=await pg.evaluate(()=>{
    const inp=document.querySelector('#engineTplList #payloadTplOn');
    const sw=inp.closest('.switchLbl'), row=sw.parentElement;
    const lab=row.querySelector('label:not(.switchLbl)');
    const a=sw.getBoundingClientRect(), b=lab.getBoundingClientRect();
    return {swW:Math.round(a.width),swH:Math.round(a.height),text:lab.textContent.trim(),
            labW:Math.round(b.width), overlap:!(a.right<=b.left||b.right<=a.left),
            labInsideSwitch:sw.contains(lab), rowCls:row.className};
  });
  ok("it is the engine templates' switch, worded for them", /^Use my engine templates/.test(g.text), JSON.stringify(g));
  ok("switch is its normal 46x26 box", g.swW===46&&g.swH===26, JSON.stringify(g));
  ok("label is NOT inside the switch", !g.labInsideSwitch);
  ok("label and switch do not overlap", !g.overlap, JSON.stringify(g));
  ok("uses the app's kvline row", g.rowCls==="kvline");

  console.log("\n[piece rows show the name, not the {{call}} wrapper]");
  const r=await pg.evaluate(()=>{
    const host=document.getElementById('engineTplList'), h=host.innerHTML;
    const codes=[...host.querySelectorAll('code[onclick]')].map(c=>c.textContent);
    return {hasWrapperInRows:codes.some(c=>c.indexOf("{{call//")===0),
            sample:codes.slice(0,8), lib:Object.keys(ENGINE_LIBRARY_LABELS).length,
            editCount:(h.match(/epEditPiece\(/g)||[]).length, oldReplyCalls:/ptEditPiece\(|ptShowUsedBy\(/.test(h)};
  });
  ok("no {{call//…}} text in the piece rows", !r.hasWrapperInRows, JSON.stringify(r.sample));
  ok("plain names shown", r.sample.includes("scene")&&r.sample.includes("exchange"), JSON.stringify(r.sample));
  ok("every shared piece has an edit button (the engine one: no reply-piece editor is left)", r.editCount>=r.lib&&!r.oldReplyCalls, "edit="+r.editCount+" of "+r.lib);

  console.log("\n[nothing is clipped on a 412px phone]");
  const clip=await pg.evaluate(()=>{
    const bad=[];
    document.querySelectorAll('#engineTplList code, #engineTplList .btn, #fragCard .btn, #otherWordingCard .btn').forEach(el=>{
      if(el.offsetParent&&el.scrollWidth>el.clientWidth+2) bad.push(el.textContent.trim().slice(0,24));
    });
    const over=["engineTplList","fragCard","otherWordingCard"].filter(id=>{ const h=document.getElementById(id); return h&&h.scrollWidth>h.clientWidth+2; });
    return {truncated:bad.slice(0,6), overflowX:over};
  });
  ok("no truncated names or buttons", clip.truncated.length===0, JSON.stringify(clip.truncated));
  ok("no horizontal overflow", clip.overflowX.length===0, JSON.stringify(clip.overflowX));

  console.log("\n[engine editor edit button]");
  const e3=await pg.evaluate(()=>{
    renderEngineTemplates();
    const h=document.getElementById('engineTplList').innerHTML;
    let threw=null; try{ epEditPrompt("gmJudge"); epEditPiece("","scene"); epEditPiece("","dialogue_history"); }catch(x){ threw=x.message; }
    return {hasBtn:h.indexOf("epEditPrompt(")>-1, threw};
  });
  ok("engines have an edit-prompt button", e3.hasBtn);
  ok("it does not throw, nor does edit on a piece with no wording", !e3.threw, e3.threw);

  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close(); process.exit(fail?1:0);
})();
