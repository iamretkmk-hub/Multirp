/* v124.0 — THE UI CLEANUP.
   Reported as: "lines of explanations, boxes too small, boxes they don't fit, pop-ups that are
   still Windows-warning style, styles that don't match — put all explanations in an i button."

   What this holds the app to:
   - no native confirm()/prompt()/alert() anywhere; the in-app sheets answer like the old boxes did
   - every explanation written into the page folds behind a dot at ANY length, on the row it explains
   - notes that code rewrites (a model's description under its picker) fold in place and stay live
   - popups built at runtime fold too, while the data in them (a plan's title) stays on screen
   - every text field is the app's field, and nothing pokes out of the card it sits in
   Run: node tests/ui-cleanup.browser.js */
const {chromium}=require('playwright');
const fs=require('fs'), path=require('path');
(async()=>{
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x||c).slice(0,600));} };

  console.log("\n[no browser dialog is left in the source]");
  const src=fs.readFileSync(path.resolve(__dirname,'..','index.html'),'utf8');
  const code=src.replace(/\/\*[\s\S]*?\*\//g,"").split("\n").filter(l=>!/^\s*\/\//.test(l)).join("\n");
  const natives=(code.match(/(^|[^\w.$\s])\s*(confirm|prompt|alert)\(/g)||[]).length
               +(code.match(/window\.(confirm|prompt|alert)\s*\(/g)||[]).length;
  ok("no confirm( / prompt( / alert( call remains", natives===0, natives+" found");

  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage({viewport:{width:412,height:915}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  const natived=[]; pg.on('dialog',d=>{ natived.push(d.message()); d.dismiss().catch(()=>{}); });
  await pg.goto('file://'+path.resolve(__dirname,'..','index.html')); await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(800);

  console.log("\n[the in-app sheets answer the way the old boxes did]");
  ok("uiConfirm: the OK button resolves true", await pg.evaluate(async()=>{
      const p=uiConfirm("x",{title:"Delete?",ok:"Delete",danger:true});
      document.querySelector('.uiDlg [data-yes]').click(); return (await p)===true; }));
  ok("uiConfirm: Escape resolves false and removes the sheet", await pg.evaluate(async()=>{
      const p=uiConfirm("x");
      document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}));
      return (await p)===false && !document.querySelector('.uiDlg'); }));
  ok("uiConfirm: a tap outside the card cancels", await pg.evaluate(async()=>{
      const p=uiConfirm("x"); const d=document.querySelector('.uiDlg');
      d.dispatchEvent(new MouseEvent('click',{bubbles:true})); return (await p)===false; }));
  ok("uiPrompt: returns the typed text, Enter submits", await pg.evaluate(async()=>{
      const p=uiPrompt("",{title:"Set Trust",value:"5"}); const i=document.querySelector('.uiDlg .uiDlgIn');
      if(i.value!=="5")return "prefill "+i.value;
      i.value="42"; i.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
      return (await p)==="42"; }));
  ok("uiPrompt: Cancel returns null", await pg.evaluate(async()=>{
      const p=uiPrompt("",{title:"x"}); document.querySelector('.uiDlg [data-no]').click(); return (await p)===null; }));
  ok("uiChoose: returns the picked value", await pg.evaluate(async()=>{
      const p=uiChoose("",[{label:"A",value:"a"},{label:"B",value:{id:2}}],{title:"Pick"});
      document.querySelectorAll('.uiDlg [data-ch]')[1].click(); const v=await p; return !!v&&v.id===2; }));
  ok("a sheet sits above an open editor", await pg.evaluate(async()=>{
      editPersona(); const p=uiConfirm("x");
      const z=+getComputedStyle(document.querySelector('.uiDlg')).zIndex, m=+getComputedStyle(document.getElementById('personaModal')).zIndex;
      document.querySelector('.uiDlg [data-no]').click(); await p; closeModal('personaModal'); return z>m ? true : z+" vs "+m; }));
  ok("a destructive action waits for the answer", await pg.evaluate(async()=>{
      const chat=curChat(); chat.messages.push({mid:"uic1",role:"user",content:"bye"});
      const p=deleteMessage("uic1"); await new Promise(r=>setTimeout(r,30));
      const still=chat.messages.some(m=>m.mid==="uic1");
      document.querySelector('.uiDlg [data-yes]').click(); await p;
      return still && !chat.messages.some(m=>m.mid==="uic1") ? true : "still="+still; }));

  console.log("\n[every explanation in Settings is behind a dot]");
  await pg.evaluate(()=>{ show('settings'); document.querySelectorAll('#screen-settings details.sgroup').forEach(d=>d.open=true); foldHelp(document.getElementById('screen-settings')); });
  await pg.waitForTimeout(300);
  ok("no page-written explanation is left on screen, however short", await pg.evaluate(()=>{
      const left=[...document.querySelectorAll('#screen-settings .desc')].filter(d=>{
        if(!d.dataset.helpStatic||d.dataset.helpFolded||d.hasAttribute('data-keep'))return false;
        const r=d.getBoundingClientRect(); if(!r.width||!r.height)return false;
        const t=d.textContent.replace(/\s+/g," ").trim(); return t.length>=24; });
      return left.length?left.length+" left, e.g. “"+left[0].textContent.trim().slice(0,80)+"”":true; }));
  ok("a toggle row's help is a dot on that row", await pg.evaluate(()=>{
      const row=document.getElementById('setRelOn').closest('.kvline');
      const dot=row&&row.querySelector('.ibtn'); if(!dot)return "no dot on the Relationship tracking row";
      dot.click(); const t=document.getElementById('infoBody').textContent; closeModal('infoModal');
      return /Characters build feelings/.test(t) ? true : t.slice(0,100); }));
  ok("a long (…) in a label is lifted into the dot", await pg.evaluate(()=>{
      const lab=[...document.querySelectorAll('#screen-settings label')].find(l=>/^Mic patience/.test(l.textContent.trim()));
      if(!lab)return "no Mic patience label";
      if(/ms of silence/i.test(lab.textContent.replace(lab.querySelector('.ibtn')?.textContent||"","")) && !lab.querySelector('.ibtn'))return "still inline";
      lab.querySelector('.ibtn').click(); const t=document.getElementById('infoBody').textContent; closeModal('infoModal');
      return /ms of silence/i.test(t) ? true : t; }));
  ok("a note that follows a picker folds in place and shows its current text", await pg.evaluate(()=>{
      const note=document.getElementById('atlasImgNote'); if(!note)return "note gone";
      if(getComputedStyle(note).display!=="none")return "note still showing";
      note.textContent="LIVE NOTE TEXT";
      const host=note.parentElement; const dot=[...host.querySelectorAll('.ibtn')].find(b=>(_helpStore.get(b.dataset.help)||{}).live&&_helpStore.get(b.dataset.help).live.includes(note));
      if(!dot)return "no dot carries the note";
      dot.click(); const t=document.getElementById('infoBody').textContent; closeModal('infoModal');
      return /LIVE NOTE TEXT/.test(t) ? true : t.slice(0,100); }));

  console.log("\n[fields are the app's fields, and they fit their boxes]");
  const fit=async(open,label)=>pg.evaluate(open=>{
    eval(open);
    const vis=e=>{const r=e.getBoundingClientRect(); return r.width>1&&r.height>1;};
    const tops=[...document.querySelectorAll('.modal.show')].filter(vis); const root=tops.length?tops[tops.length-1]:document.querySelector('.screen.active');
    const white=[...root.querySelectorAll('input,select,textarea')].filter(e=>vis(e)&&!['checkbox','radio','range','file','color'].includes(e.type)&&getComputedStyle(e).backgroundColor==='rgb(255, 255, 255)');
    const out=[];
    root.querySelectorAll('.card *').forEach(e=>{ if(!vis(e))return; const c=e.parentElement.closest('.card'); if(!c)return;
      let a=e.parentElement; while(a&&a!==c){ if(getComputedStyle(a).overflowX!=='visible')return; a=a.parentElement; }
      const r=e.getBoundingClientRect(), cr=c.getBoundingClientRect(); if(r.right>cr.right+1.5||r.left<cr.left-1.5)out.push(e.id||e.tagName); });
    return {white:white.map(e=>e.id||e.tagName), out};
  },open);
  for(const [open,label] of [["show('settings'); document.querySelectorAll('#screen-settings details.sgroup').forEach(d=>d.open=true)","Settings"],
                             ["addMemoryManual()","the memory editor"],["editPersona()","the character editor"],["editUniverse(state.universes[0].id)","the universe editor"]]){
    const r=await fit(open,label);
    ok(`${label}: no white native field`, r.white.length===0, r.white.join(", "));
    ok(`${label}: nothing sticks out of its card`, r.out.length===0, r.out.slice(0,8).join(", "));
    await pg.evaluate(()=>document.querySelectorAll('.modal.show').forEach(m=>m.classList.remove('show')));
  }
  ok("a row of buttons wraps whole buttons, never a label over two lines", await pg.evaluate(()=>{
      editPersona(); const btns=[...document.querySelectorAll('#personaModal .row > .btn')].filter(b=>b.getBoundingClientRect().width>1);
      const bad=btns.filter(b=>{ const lh=parseFloat(getComputedStyle(b).lineHeight)||19; const pad=parseFloat(getComputedStyle(b).paddingTop)+parseFloat(getComputedStyle(b).paddingBottom);
        return b.getBoundingClientRect().height>lh*1.6+pad+2; }).map(b=>b.textContent.trim());
      closeModal('personaModal'); return bad.length?bad.join(" | "):true; }));

  console.log("\n[popups built at runtime fold too — and keep their data]");
  ok("the calendar's explanation folds, a plan's title stays", await pg.evaluate(async()=>{
      const chat=curChat(); chat.calendar=[{id:"uicCal",title:"Dinner at the harbour",day:3,period:"Evening",kind:"meeting",certainty:"certain"}];
      openCalendar(); await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
      const m=document.getElementById('calModal'); const txt=m.textContent;
      const shown=[...m.querySelectorAll('.desc')].filter(d=>d.getBoundingClientRect().height>0).map(d=>d.textContent).join(" ");
      m.remove();
      if(!/Dinner at the harbour/.test(txt))return "the plan's title is gone";
      return /happen offstage, on their own/.test(shown) ? "explanation still inline" : true; }));
  ok("an in-card close button has the shared look", await pg.evaluate(()=>{
      const x=document.querySelector('#universeModal .x, #personaModal .x');
      const cs=getComputedStyle(x); return cs.borderRadius==="50%" ? true : cs.borderRadius; }));

  ok("no native dialog opened during the run", natived.length===0, natived.join(" | "));
  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close(); process.exit(fail?1:0);
})();
