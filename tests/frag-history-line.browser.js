/* v150.107 — THE FRAGMENT LIST SHOWS WHERE THE DIALOGUE HISTORY GOES. A reply is the "before the history" fragments in
   list order, the conversation history, then the "after the history" fragments in list order. The list (Settings →
   Payloads → Reply fragments) now draws a "Dialogue history" line between the two; changing "Placed" moves the fragment
   to the other side of the line, next to it; ↑ / ↓ across the line changes its placing; a mixed stored list is shown in
   the order it is sent, and what is sent does not change.
   Run: node tests/frag-history-line.browser.js */
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:process.env.SM_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage({viewport:{width:412,height:915}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file://'+require('path').resolve(__dirname,'..','index.html')); await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(800);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x===undefined?c:x).slice(0,800));} };

  // What the list shows, top to bottom: fragment names, with "|" where the history line is.
  const view=()=>pg.evaluate(()=>{ const host=document.getElementById('fragHost');
    return [...host.querySelectorAll('#fragList > [id^="fragRow_"], #fragList > #fragHistLine')].map(el=>el.id==="fragHistLine"?"|":el.querySelector('b').textContent).join(","); });
  const F=(id,seg)=>({id,name:id,seg,paths:["solo"],text:"TEXT "+id,byPath:{},mode:"any",options:[]});

  await pg.evaluate(()=>{ window.uiConfirm=async()=>true; });
  console.log("\n[the line]");
  ok("the shipped list has one Dialogue history line, between the last before-fragment and the first after-fragment", await pg.evaluate(()=>{
      _fragDraft=null; _fragOpen=null; state.fragments=null; renderFragEditor();
      const lines=document.querySelectorAll('#fragHistLine'); if(lines.length!==1) return lines.length+" lines";
      const nHead=FRAG_DEFAULTS.filter(f=>f.seg!=="tail").length, line=lines[0];
      const prev=line.previousElementSibling, next=line.nextElementSibling;
      return (prev&&prev.id==="fragRow_"+(nHead-1)&&next&&next.id==="fragRow_"+nHead&&/Dialogue history/i.test(line.textContent))?true:(prev&&prev.id)+" / "+(next&&next.id); }));

  await pg.evaluate(F=>{ const mk=eval(F);
    state.fragments=[mk("A","head"),mk("x","tail"),mk("B","head"),mk("y","tail"),mk("C","head")];
    localStorage.setItem(K.fragments,JSON.stringify(state.fragments)); _fragDraft=null; _fragOpen=null; }, F.toString());
  const sentBefore=await pg.evaluate(()=>fragCompile("solo",ptCondFlags({}),{}));
  await pg.evaluate(()=>renderFragEditor());
  ok("a mixed list is shown in the order it is sent: before-fragments, the line, after-fragments", await view()==="A,B,C,|,x,y", await view());
  ok("…and what is sent is the same", await pg.evaluate(()=>{ fragEdSave(); return fragCompile("solo",ptCondFlags({}),{}); })===sentBefore);
  const order=await pg.evaluate(()=>{ const t=fragCompile("solo",ptCondFlags({}),{}); return ["A","B","C","x","y"].map(k=>t.indexOf("TEXT "+k)); });
  ok("(before-fragments come before the after-fragments in the payload)", order.every(n=>n>=0)&&Math.max(order[0],order[1],order[2])<Math.min(order[3],order[4]), JSON.stringify(order));

  console.log("\n[changing Placed moves it]");
  await pg.evaluate(()=>{ fragEdOpen(0); });
  await pg.evaluate(()=>{ const sel=document.querySelector('#fragHost select[onchange*=".seg"]'); sel.value="tail"; sel.dispatchEvent(new Event("change")); });
  ok("before → after: it moves just below the line", await view()==="B,C,|,A,x,y", await view());
  ok("…it stays open for editing in its new place", await pg.evaluate(()=>(_fragOpen!=null&&_fragDraft[_fragOpen].id==="A"&&!!document.querySelector(`#fragHost textarea[data-fp="${_fragOpen}.text"]`))?true:String(_fragOpen)));
  await pg.evaluate(()=>{ const i=_fragDraft.findIndex(f=>f.id==="y"); fragEdOpen(i); const sel=document.querySelector('#fragHost select[onchange*=".seg"]'); sel.value="head"; sel.dispatchEvent(new Event("change")); });
  ok("after → before: it moves just above the line", await view()==="B,C,y,|,A,x", await view());
  ok("the moved row is highlighted", await pg.evaluate(()=>{ const i=_fragDraft.findIndex(f=>f.id==="y"); const r=document.getElementById('fragRow_'+i); return r&&r.classList.contains('fragMoved')?true:"not highlighted"; }));
  ok("its row says where it is now", await pg.evaluate(()=>{ const i=_fragDraft.findIndex(f=>f.id==="y"); return /before the history/.test(document.getElementById('fragRow_'+i).textContent)?true:document.getElementById('fragRow_'+i).textContent; }));

  console.log("\n[↑ / ↓ across the line]");
  await pg.evaluate(()=>{ fragEdOpen(_fragOpen); const i=_fragDraft.findIndex(f=>f.id==="y"); fragEdMove(i,1); });
  ok("↓ on the last one above the line puts it below the line, first", await view()==="B,C,|,y,A,x", await view());
  ok("…and makes it an after-the-history fragment", await pg.evaluate(()=>_fragDraft.find(f=>f.id==="y").seg)==="tail");
  await pg.evaluate(()=>{ const i=_fragDraft.findIndex(f=>f.id==="y"); fragEdMove(i,-1); });
  ok("↑ on the first one below the line puts it back above", await view()==="B,C,y,|,A,x", await view());
  await pg.evaluate(()=>{ fragEdMove(0,1); });
  ok("moving inside one side still swaps", await view()==="C,B,y,|,A,x", await view());
  ok("the buttons next to the line say so", await pg.evaluate(()=>{ const i=_fragDraft.findIndex(f=>f.id==="A");
      const up=document.querySelector(`#fragRow_${i} button[onclick="fragEdMove(${i},-1)"]`); return /above the dialogue history/.test(up.title)?true:up.title; }));

  console.log("\n[saved, and sent in that order]");
  const sent=await pg.evaluate(()=>{ fragEdSave(); const t=fragCompile("solo",ptCondFlags({}),{}); return ["C","B","y","A","x"].map(k=>t.indexOf("TEXT "+k)); });
  ok("the payload follows the list: C, B, y, then the history, then A, x", sent.every((n,k)=>n>=0&&(k===0||n>sent[k-1])), JSON.stringify(sent));
  ok("the saved list is in the shown order", await pg.evaluate(()=>JSON.parse(localStorage.getItem(K.fragments)).map(f=>f.id).join(","))==="C,B,y,A,x");
  ok("with no after-fragments the line is at the bottom", await pg.evaluate(()=>{ _fragDraft.forEach(f=>f.seg="head"); renderFragEditor();
      const l=document.getElementById('fragHistLine'); return (l&&!l.nextElementSibling)?true:"not last"; }));
  ok("with no before-fragments it is at the top", await pg.evaluate(()=>{ _fragDraft.forEach(f=>f.seg="tail"); renderFragEditor();
      const l=document.getElementById('fragHistLine'); return (l&&!l.previousElementSibling)?true:"not first"; }));
  ok("saving the shipped fragments still clears the stored copy", await pg.evaluate(async()=>{ await fragEdReset(); fragEdSave();
      return (state.fragments===null&&(localStorage.getItem(K.fragments)||"")==="")?true:"stored"; }));

  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close(); process.exit(fail?1:0);
})();
