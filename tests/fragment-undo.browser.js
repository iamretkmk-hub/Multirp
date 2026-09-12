/* v39.0 — A RESET YOU CAN TAKE BACK.
   "Reset N fragments you have rewritten" used to live inside a single block's accordion; v38.2 made
   it one button over the whole list, which means one tap can take a whole payload's worth of
   hand-written sections, with no undo anywhere in the app. This checks that every reset — bulk and
   single — photographs the rewritten set first, that the undo puts them back, and that a fragment
   rewritten AFTER the reset survives the undo (the snapshot must never become a second deletion).
   Run: node tests/fragment-undo.browser.js */
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage({viewport:{width:412,height:915}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file://'+require('path').resolve(__dirname,'..','index.html'));
  await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(800);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x||c).slice(0,600));} };

  // the confirm() in the bulk reset must not stop the test
  await pg.evaluate(()=>{ window.confirm=()=>true; window.__toasts=[]; const t=window.toast; window.toast=m=>{window.__toasts.push(String(m)); try{t&&t(m);}catch(e){}}; });

  const keys=await pg.evaluate(()=>Object.keys(BLOCK_TPL_DEFAULTS).slice(0,3));
  const MINE="MY OWN WORDING — ";

  const r=await pg.evaluate(([keys,MINE])=>{
    const out={};
    state.blockTpls={};
    keys.forEach((k,i)=>{ state.blockTpls[k]=MINE+k+" "+i; });
    store.set(K.blockTpls,state.blockTpls);
    out.before=keys.filter(k=>_tplCustomized(k)).length;
    out.snapBefore=!!tplUndoSnapshot();
    plqTplResetMany();
    out.afterReset=keys.filter(k=>_tplCustomized(k)).length;
    const snap=tplUndoSnapshot();
    out.snapAfter=snap?Object.keys(snap.tpls).length:0;
    // rewrite ONE of them again after the reset — the undo must not overwrite this newer text
    state.blockTpls[keys[0]]="WRITTEN AFTER THE RESET";
    store.set(K.blockTpls,state.blockTpls);
    plqTplUndoReset();
    out.kept=blkTpl(keys[0]);
    out.back1=blkTpl(keys[1]);
    out.back2=blkTpl(keys[2]);
    out.snapSpent=!!tplUndoSnapshot();
    return out;
  },[keys,MINE]);

  ok("three fragments start out rewritten", r.before===3, r.before);
  ok("nothing to undo before the first reset", r.snapBefore===false);
  ok("the bulk reset clears all three", r.afterReset===0, r.afterReset);
  ok("the reset photographed all three first", r.snapAfter===3, r.snapAfter);
  ok("undo puts back an untouched fragment", r.back1===MINE+keys[1]+" 1", JSON.stringify(r.back1));
  ok("undo puts back the third too", r.back2===MINE+keys[2]+" 2", JSON.stringify(r.back2));
  ok("text written after the reset survives the undo", r.kept==="WRITTEN AFTER THE RESET", JSON.stringify(r.kept));
  ok("the snapshot is spent once used", r.snapSpent===false);

  // a single-fragment reset is undoable on the same terms
  const s=await pg.evaluate(([k,MINE])=>{
    const out={};
    state.blockTpls={}; state.blockTpls[k]=MINE+"single";
    store.set(K.blockTpls,state.blockTpls);
    store.setRaw(K.blockTplsUndo,"");
    plqTplReset(k);
    out.gone=!_tplCustomized(k);
    out.snap=!!tplUndoSnapshot();
    plqTplUndoReset();
    out.back=blkTpl(k);
    return out;
  },[keys[0],MINE]);
  ok("a single reset clears that fragment", s.gone===true);
  ok("a single reset is photographed too", s.snap===true);
  ok("undo restores the single fragment", s.back===MINE+"single", JSON.stringify(s.back));

  // the button only appears when there is something to put back
  const ui=await pg.evaluate(()=>{
    const out={};
    state.blockTpls={}; store.set(K.blockTpls,state.blockTpls); store.setRaw(K.blockTplsUndo,"");
    show('settings');
    renderPayloadTemplates();
    out.noUndoBtn=(document.getElementById('payloadTplList')||{innerHTML:""}).innerHTML.indexOf("plqTplUndoReset")<0;
    const k=Object.keys(BLOCK_TPL_DEFAULTS)[0];
    state.blockTpls[k]="x-custom"; store.set(K.blockTpls,state.blockTpls);
    plqTplResetMany();
    out.undoBtn=(document.getElementById('payloadTplList')||{innerHTML:""}).innerHTML.indexOf("plqTplUndoReset")>=0;
    return out;
  });
  ok("no undo button with nothing to put back", ui.noUndoBtn===true);
  ok("the undo button appears after a reset", ui.undoBtn===true);

  // the snapshot survives a reload — the user may only notice tomorrow
  await pg.reload(); await pg.waitForTimeout(2400);
  const after=await pg.evaluate(()=>{ const s=tplUndoSnapshot(); return s?Object.keys(s.tpls).length:0; });
  ok("the snapshot is still there after a reload", after>=1, after);

  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log(`\n  ${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail?1:0);
})();
