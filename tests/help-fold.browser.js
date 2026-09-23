/* v111.1 — THE HELP DOT.
   Reported with a screenshot of Settings → Payloads: two paragraphs and a red warning box stand
   between the card's heading and its first control, and the whole app reads that way — an essay
   with inputs embedded in it. 116 blocks of long help across seven screens and nine editor
   modals, the character editor alone carrying twelve.

   Nothing is deleted and nothing is rewritten. One runtime pass folds the long help in each card
   behind a single dot on that card's heading, and the dot opens the ORIGINAL markup — bold, code
   spans, the warning box, nested <details> — in a sheet. It runs over the DOM rather than the
   source so it reaches every screen without 116 hand edits, catches help in content rendered at
   runtime, and keeps the threshold as one number instead of a judgement repeated a hundred times.
   Run: node tests/help-fold.browser.js */
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage({viewport:{width:412,height:915}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file:///home/user/Multirp/index.html'); await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(900);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x||c).slice(0,600));} };

  // the same test the fold itself applies, so the audit cannot disagree with the pass
  const LONG=`d=>{ if(d.closest('#infoModal'))return false;
    if(/display\\s*:\\s*inline/i.test(d.getAttribute('style')||''))return false;
    if(d.closest('label,summary'))return false;
    return String(d.textContent||'').replace(/\\s+/g,' ').trim().length>=160; }`;

  console.log("\n[no screen is an essay any more]");
  for(const s of ['chat','personas','gallery','memory','diary','settings','debug']){
    const r=await pg.evaluate(async([id,src])=>{
      show(id); await new Promise(r=>setTimeout(r,200));
      const scr=document.getElementById('screen-'+id);
      scr.querySelectorAll('details.sgroup').forEach(d=>d.open=true);
      foldHelp(scr);
      const test=eval('('+src+')');
      const left=[...scr.querySelectorAll('.desc')].filter(test);
      return {n:left.length, first:left.length?left[0].textContent.replace(/\s+/g,' ').trim().slice(0,80):""};
    },[s,LONG]);
    ok(`${s} carries no unfolded help`, r.n===0, r.n+" left, e.g. “"+r.first+"…”");
  }

  console.log("\n[and neither does any editor]");
  ok("every modal folds when it opens", await pg.evaluate(src=>{
      const test=eval('('+src+')');
      const bad=[];
      document.querySelectorAll('.modal').forEach(m=>{
        if(m.id==='infoModal')return;
        openModal(m.id); closeModal(m.id);
        const left=[...m.querySelectorAll('.desc')].filter(test);
        if(left.length)bad.push(m.id+":"+left.length);
      });
      return bad.length?bad.join(", "):true; },LONG));
  ok("re-opening one does not stack dots", await pg.evaluate(()=>{
      const before=document.querySelectorAll('#personaModal .ibtn').length;
      for(let i=0;i<4;i++){ openModal('personaModal'); closeModal('personaModal'); }
      const after=document.querySelectorAll('#personaModal .ibtn').length;
      return before===after ? true : before+" → "+after; }));

  console.log("\n[the text is moved, never lost]");
  ok("a dot's sheet holds the words that were on the page", await pg.evaluate(()=>{
      show('settings');
      const h=[...document.querySelectorAll('.card h3')].find(x=>/How payloads/i.test(x.textContent));
      if(!h)return "the payloads card is gone";
      const dot=h.querySelector('.ibtn'); if(!dot)return "no dot on it";
      dot.click();
      const body=document.getElementById('infoBody').textContent;
      closeModal('infoModal');
      return /Placeholders are NOT universal/.test(body) && /A payload is an ordered stack of parts/.test(body)
        ? true : body.slice(0,120); }));
  ok("with its markup intact — the warning box, the bold, the code spans", await pg.evaluate(()=>{
      const h=[...document.querySelectorAll('.card h3')].find(x=>/How payloads/i.test(x.textContent));
      h.querySelector('.ibtn').click();
      const body=document.getElementById('infoBody');
      const html=body.innerHTML;
      const boxed=[...body.querySelectorAll('.desc')].some(d=>/border/i.test(d.getAttribute('style')||''));
      closeModal('infoModal');
      return (boxed && /<b>/i.test(html) && /<code>/i.test(html))
        ? true : "boxed="+boxed+" html="+html.slice(0,120); }));
  ok("the sheet is titled with the card it came from", await pg.evaluate(()=>{
      const h=[...document.querySelectorAll('.card h3')].find(x=>/How payloads/i.test(x.textContent));
      h.querySelector('.ibtn').click();
      const t=document.querySelector('#infoTitle span').textContent;
      closeModal('infoModal');
      return /How payloads/.test(t) ? true : t; }));
  ok("opening a second dot replaces the first sheet rather than appending", await pg.evaluate(()=>{
      const dots=[...document.querySelectorAll('#screen-settings .ibtn')];
      if(dots.length<2)return "not enough dots to test";
      dots[0].click(); const a=document.getElementById('infoBody').innerHTML; closeModal('infoModal');
      dots[1].click(); const b2=document.getElementById('infoBody').innerHTML; closeModal('infoModal');
      return (a!==b2 && b2.indexOf(a)!==0) ? true : "the second sheet carried the first"; }));

  console.log("\n[what it must never touch]");
  ok("a short hint stays where it was", await pg.evaluate(()=>{
      const el=[...document.querySelectorAll('#screen-settings .desc')]
        .find(d=>/blank = memory model/i.test(d.textContent));
      return el ? true : "an inline label hint was folded away"; }));
  ok("a help block carrying a control is left alone", await pg.evaluate(()=>{
      const card=document.createElement('div'); card.className='card';
      card.innerHTML='<h3>T</h3><div class="desc">'+('x'.repeat(200))+' <button id="tstBtn">go</button></div>';
      document.body.appendChild(card);
      foldHelp(card);
      const kept=!!card.querySelector('#tstBtn') && !card.querySelector('.ibtn');
      card.remove(); return kept ? true : "a block with a button was moved into a sheet"; }));
  ok("data-keep opts a block out", await pg.evaluate(()=>{
      const card=document.createElement('div'); card.className='card';
      card.innerHTML='<h3>T</h3><div class="desc" data-keep>'+('y'.repeat(220))+'</div>';
      document.body.appendChild(card);
      foldHelp(card);
      const kept=!!card.querySelector('.desc') && !card.querySelector('.ibtn');
      card.remove(); return kept ? true : "data-keep was ignored"; }));
  ok("the sheet's own text is never folded into itself", await pg.evaluate(()=>{
      foldHelp(document.getElementById('infoModal'));
      return document.querySelectorAll('#infoModal .ibtn').length===0
        ? true : "the info sheet grew a dot"; }));

  console.log("\n[a card that was only help does not stay as an empty box]");
  ok("it is removed and its dot goes up to the section header", await pg.evaluate(()=>{
      const grp=[...document.querySelectorAll('details.sgroup')]
        .find(d=>/LLM Selection/i.test(d.querySelector('summary').textContent));
      if(!grp)return "the LLM group is gone";
      const dot=grp.querySelector(':scope > summary .ibtn');
      if(!dot)return "no dot on the section header";
      dot.click();
      const body=document.getElementById('infoBody').textContent;
      closeModal('infoModal');
      return /Every LLM used anywhere in the app is selectable here/.test(body)
        ? true : body.slice(0,120); }));
  ok("and the dot sits beside the title, not under the subtitle", await pg.evaluate(()=>{
      const grp=[...document.querySelectorAll('details.sgroup')]
        .find(d=>/LLM Selection/i.test(d.querySelector('summary').textContent));
      const meta=grp.querySelector(':scope > summary .sg-meta');
      const dot=meta.querySelector('.ibtn'), sub=meta.querySelector('.sg-sub');
      return (dot&&sub&&(dot.compareDocumentPosition(sub)&Node.DOCUMENT_POSITION_FOLLOWING))
        ? true : "the dot is below the subtitle again"; }));

  console.log("\n[a card with no heading still gets one somewhere sensible]");
  ok("it hangs off the card's own bold label", await pg.evaluate(()=>{
      openModal('personaModal');
      const b2=[...document.querySelectorAll('#personaModal b')].find(x=>/The voice of this card/i.test(x.textContent));
      const r=!!(b2&&b2.querySelector('.ibtn'));
      closeModal('personaModal');
      return r ? true : "the voice card's dot is not on its label"; }));
  ok("and with neither heading nor label it takes a corner, costing no height", await pg.evaluate(()=>{
      const card=document.createElement('div'); card.className='card';
      card.innerHTML='<div class="desc">'+('z'.repeat(220))+'</div><input id="tstIn">';
      document.body.appendChild(card);
      foldHelp(card);
      const corner=card.classList.contains('hasHelpCorner') && !!card.querySelector(':scope > .ibtn');
      card.remove(); return corner ? true : "a headless card did not take a corner dot"; }));

  console.log("\n[folding must never delete a card that still does something]");
  ok("a card whose only other content is a bare input survives", await pg.evaluate(()=>{
      /* This one deleted the card outright in the first draft: an <input> has no text and no
         children, so a descendants-only emptiness check read it as nothing. */
      const host=document.createElement('div'); document.body.appendChild(host);
      host.innerHTML='<div class="card"><div class="desc">'+('q'.repeat(220))+'</div><input id="tstKeep"></div>';
      foldHelp(host);
      const alive=!!document.getElementById('tstKeep') && !!host.querySelector('.card');
      host.remove(); return alive ? true : "the card was removed along with its help"; }));
  ok("so does one holding only a select, a button or a picture", await pg.evaluate(()=>{
      const bad=[];
      ['<select id="z1"><option>a</option></select>','<button id="z2"></button>','<img id="z3">'].forEach((ctl,i)=>{
        const host=document.createElement('div'); document.body.appendChild(host);
        host.innerHTML='<div class="card"><div class="desc">'+('w'.repeat(220))+'</div>'+ctl+'</div>';
        foldHelp(host);
        if(!host.querySelector('.card'))bad.push(i);
        host.remove();
      });
      return bad.length?("removed for control "+bad.join(",")):true; }));
  ok("but a card that really is only help is still removed", await pg.evaluate(()=>{
      const host=document.createElement('div'); document.body.appendChild(host);
      host.innerHTML='<div class="card"><div class="desc">'+('e'.repeat(220))+'</div></div>';
      foldHelp(host);
      const gone=!host.querySelector('.card');
      host.remove(); return gone ? true : "an empty box was left behind"; }));

  ok("no page errors", errs.length===0?true:errs.join(" | "));
  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close(); process.exit(fail?1:0);
})();
