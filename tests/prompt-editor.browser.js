/* THE PROMPT EDITOR (prompt-editor.html) — a separate page that edits a prompt export and builds the
   full payload with StoryMind's own engine, running in a sealed sandbox.
   Pinned here:
     1  the engine boots in the sandbox and every reply kind builds a real payload
     2  the sandbox cannot touch the real app's storage
     3  an opened prompt export reads clean (nothing counted as edited until you edit)
     4  an edit to a piece reaches the built payload
     5  the downloaded file is accepted by StoryMind's own importPromptsFile, and carries the edit
     6  a reset prompt is written out in full (the app's import keeps any key a file leaves out)
     7  Test & review: the reviewer's edit is applied by find/replace to the right item
     8  served as Claude serves it (editor = index.html, StoryMind = storymind.html), the engine starts
     0  prompt-editor-start.json (the latest prompts) opens on first load; a draft with edits is kept
   Run: node tests/prompt-editor.browser.js   (needs playwright; see tests/README.md) */
const {chromium}=require('playwright');
const http=require('http'), fs=require('fs'), path=require('path');
const BIN=process.env.SM_CHROME||process.env.CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const ROOT=path.resolve(__dirname,'..');
(async()=>{
  /* the editor fetches index.html beside it, so it is served over http, not file:// */
  /* /art/… is the layout Claude serves the editor with: the editor IS index.html there, and StoryMind
     sits beside it as storymind.html. */
  const ART={"index.html":"prompt-editor.html","storymind.html":"index.html","prompt-editor-start.json":"prompt-editor-start.json"};
  const srv=http.createServer((q,r)=>{
    let rel=decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/,'');
    if(rel.startsWith('art/')){ rel=ART[rel.slice(4)]||'__none__'; }
    const f=path.join(ROOT,rel||'index.html');
    if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){ r.writeHead(404); r.end(); return; }
    r.writeHead(200,{'Content-Type':f.endsWith('.html')?'text/html; charset=utf-8':'application/octet-stream'}); fs.createReadStream(f).pipe(r);
  });
  await new Promise(r=>srv.listen(0,'127.0.0.1',r));
  const base='http://127.0.0.1:'+srv.address().port+'/';
  const b=await chromium.launch({executablePath:BIN});
  const ctx=await b.newContext({viewport:{width:1300,height:900}});
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
  const pg=await ctx.newPage();
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x===undefined?c:x).slice(0,700));} };
  try{
    await pg.goto(base+'prompt-editor.html');
    await pg.evaluate(()=>{ try{ localStorage.setItem("sm_canary","real app data"); }catch(e){} });
    await pg.waitForFunction(()=>window.__PE&&window.__PE.ENG.ready&&window.__PE.S.preview&&window.__PE.S.preview.messages,null,{timeout:90000});

    console.log("\n[0 — the bundled latest prompts open on first load]");
    const start=JSON.parse(fs.readFileSync(path.join(ROOT,'prompt-editor-start.json'),'utf8'));
    const s0=await pg.evaluate(async()=>{ const S=__PE.S; const p=await __PE.engCall('build',{kind:'solo'});
      return {file:S.fileName,date:S.orig&&S.orig.date,solo:__PE.itemVal(__PE.findItem("tpl:solo")),unk:p.unknownCalls,unkV:p.unknownVars,
        edited:__PE.ITEMS().filter(it=>__PE.itemStatus(it).edited).length}; });
    ok("prompt-editor-start.json is the opened file", /^Latest prompts/.test(s0.file)&&s0.date===start.date, JSON.stringify({file:s0.file,date:s0.date}));
    ok("its solo layout is the one in the editor", s0.solo===JSON.parse(start.settings.payloadTemplates).solo);
    ok("and it builds with every name known", s0.unk.length===0&&s0.unkV.length===0, JSON.stringify(s0));
    ok("nothing counts as edited", s0.edited===0, s0.edited);
    console.log("\n[0b — every piece of the layouts has something to show]");
    const rich=await pg.evaluate(async()=>{
      const body=__PE.itemVal(__PE.findItem("frag:resistance_body")).replace(/\{\{[^}]*\}\}/g,"").trim().split("\n")[0].slice(0,40);
      const o={body};
      for(const k of ["solo","multi","gm","text","heat"]){ const p=await __PE.engCall('build',{kind:k});
        o[k]={resist:p.messages.some(m=>m.content.indexOf(body)>=0),empties:p.empties}; }
      const on=await __PE.engCall('build',{kind:'solo',turn:{arriving:true,video:true,voice:true,afterHeat:true}});
      o.on=on.empties;
      return o; });
    ["solo","multi","gm","text"].forEach(k=>ok("v150.5 — the resistance block is in the "+k+" payload", rich[k].resist===true, JSON.stringify(rich[k])));
    ok("heat beats still leave it out", rich.heat.resist===false);
    const allowed=/^(others_present|player|after_heat|situation|watching_now|spoken_delivery|private_intent)(\/\/full)?$/;
    ["solo","multi","gm","text","heat"].forEach(k=>ok("only turn-dependent blocks are empty in "+k, rich[k].empties.every(e=>allowed.test(e)), rich[k].empties.join(" ")));
    ok("the This turn switches bring in arrival, video, voice and after heat",
       ["situation","watching_now","spoken_delivery","after_heat"].every(b=>!rich.on.some(e=>e.split("//")[0]===b)), rich.on.join(" "));

    /* a draft with an edit, from an older file: reloading must not throw the edit away silently */
    await pg.evaluate(()=>{ const it=__PE.findItem("frag:style_header"); __PE.setVal(it,__PE.itemVal(it)+" DRAFT-EDIT"); __PE.S.orig.date=1; });
    await pg.waitForTimeout(800);
    await pg.reload();
    await pg.waitForFunction(()=>window.__PE&&window.__PE.ENG.ready&&window.__PE.S.preview&&window.__PE.S.preview.messages,null,{timeout:90000});
    await pg.waitForSelector(".modal",{timeout:10000});
    const kept=await pg.evaluate(()=>({modal:document.querySelector(".modal header").textContent,
      draft:/DRAFT-EDIT/.test(__PE.itemVal(__PE.findItem("frag:style_header")))}));
    ok("a draft with edits is kept, and the newer file is offered", /Newer prompts/.test(kept.modal)&&kept.draft, JSON.stringify(kept));
    await pg.click(".modal footer .btn.pri");
    await pg.waitForTimeout(600);
    ok("choosing it opens the latest prompts", await pg.evaluate(d=>__PE.S.orig.date===d&&!/DRAFT-EDIT/.test(__PE.itemVal(__PE.findItem("frag:style_header"))),start.date));

    console.log("\n[1 — the engine runs and builds every reply kind]");
    const kinds=await pg.evaluate(async()=>{ const o={}; for(const k of __PE.S.meta.kinds){ try{ const p=await __PE.engCall('build',{kind:k});
      o[k]={n:p.messages.length,sys:p.messages.filter(m=>m.role==="system").length,hist:p.messages.filter(m=>m.hist).length,speaker:p.speaker,unk:p.unknownCalls.length,first:p.messages[0].content.slice(0,200)}; }catch(e){ o[k]={err:e.message}; } } return o; });
    Object.keys(kinds).forEach(k=>{ const r=kinds[k];
      ok(k+" builds, with instructions and the dialogue", !r.err&&r.sys>=1&&r.hist>=3&&r.unk===0, JSON.stringify(r)); });
    ok("the sample's solo scene is with the woman, Buket", /Buket/.test(kinds.solo.speaker), JSON.stringify(kinds.solo));
    const eng=await pg.evaluate(async()=>{ const p=await __PE.engCall('buildEngine',{key:'gmJudge'}); return p.messages.map(m=>m.content).join("\n"); });
    ok("an engine payload builds with the prompt filled for this story", /GAMEMASTER/.test(eng)&&/Emre/.test(eng), eng.slice(0,300));

    console.log("\n[2 — the sandbox is sealed]");
    const seal=await pg.evaluate(()=>({canary:localStorage.getItem("sm_canary"),
      leaked:Object.keys(localStorage).filter(k=>/^sm_/.test(k)&&k!=="sm_canary")}));
    ok("the real localStorage was not written by the engine", seal.canary==="real app data"&&seal.leaked.length===0, JSON.stringify(seal));

    console.log("\n[3 — opening a prompt export]");
    const packTxt=fs.readFileSync(path.join(ROOT,'out','storymind_prompts_one_voice_20260920.json'),'utf8');
    await pg.evaluate(t=>__PE.openPack(JSON.parse(t),'pack.json'),packTxt);
    await pg.waitForTimeout(1200);
    const st=await pg.evaluate(()=>({edited:__PE.ITEMS().filter(it=>__PE.itemStatus(it).edited).map(it=>it.key),
      custom:__PE.ITEMS().filter(it=>__PE.itemStatus(it).custom).length}));
    ok("nothing reads as edited straight after opening", st.edited.length===0, JSON.stringify(st.edited));
    ok("the file's own versions read as changed from default", st.custom>50, st.custom);
    const solo=await pg.evaluate(async()=>(await __PE.engCall('build',{kind:'solo'})).messages[0].content);
    ok("the pack's layout is the one being built", /YOUR NATIVE LANGUAGE/.test(solo), solo.slice(0,300));

    console.log("\n[4 — an edit reaches the payload]");
    const MARK="PE-TEST-MARKER: never repeat his question back to him.";
    await pg.evaluate(m=>{ const it=__PE.findItem("frag:style_header"); __PE.setVal(it,__PE.itemVal(it)+"\n"+m); },MARK);
    await pg.waitForTimeout(900);
    const after=await pg.evaluate(async()=>(await __PE.engCall('build',{kind:'solo'})).messages.map(m=>m.content).join("\n"));
    ok("the edited piece is in the built payload", after.indexOf(MARK)>=0, after.slice(0,200));
    ok("and it is counted as edited", await pg.evaluate(()=>__PE.itemStatus(__PE.findItem("frag:style_header")).edited));

    console.log("\n[5 — the downloaded file imports into StoryMind]");
    await pg.evaluate(()=>{ const it=__PE.findItem("prompt:gmJudge"); __PE.setVal(it,__PE.itemDef(it)); });
    const ex=await pg.evaluate(()=>__PE.buildExport());
    const allStr=Object.values(ex.prompts).concat(Object.values(ex.settings)).every(v=>typeof v==="string");
    ok("same shape as Export prompts, every value a string", ex.app==="StoryMind"&&ex.kind==="prompts"&&allStr);
    const app=await ctx.newPage();
    await app.goto(base+'index.html'); await app.waitForTimeout(2600);
    const imp=await app.evaluate(async({ex,MARK})=>{
      window.uiConfirm=async()=>true;
      const warned=[]; const cw=console.warn; console.warn=(...a)=>{ warned.push(a.join(" ")); cw.apply(console,a); };
      const r=await importPromptsFile(ex,{});
      console.warn=cw;
      const bt=JSON.parse(localStorage.getItem(K.blockTpls)||"{}");
      return {r,skipped:warned.filter(w=>/ignored/.test(w)),hasMark:String(bt.style_header||"").indexOf(MARK)>=0,
        gm:localStorage.getItem(K.gmJudge)===PROMPT_BY_KEY.gmJudge.def()};
    },{ex,MARK});
    ok("importPromptsFile accepts it with nothing skipped", imp.r===true&&imp.skipped.length===0, JSON.stringify(imp));
    ok("the edited piece arrives in the app", imp.hasMark);
    console.log("\n[6 — a prompt reset to default is written out]");
    ok("gmJudge, reset in the editor, overwrites the phone's copy with the default", imp.gm);
    await app.close();

    console.log("\n[7 — Test & review applies the reviewer's edit]");
    await ctx.route(/openrouter\.ai/,async r=>{
      const body=JSON.parse(r.request().postData()||"{}");
      const last=String((body.messages||[]).slice(-1)[0].content||"");
      const content=/Reply with ONLY this JSON/.test(last)
        ? JSON.stringify({verdict:"Too long, and it repeated his question.",problems:[{issue:"echo",evidence:"Dört bin mi?"}],
            edits:[{item:"frag:style_header",find:"PE-TEST-MARKER",replace:"PE-REVIEWED",why:"clearer"}]})
        : '"Dört bin mi? Abi otur bir çay iç önce."';
      await r.fulfill({status:200,contentType:"application/json",body:JSON.stringify({choices:[{message:{content}}]})});
    });
    await pg.evaluate(()=>{ localStorage.setItem("pe_v1_orkey",JSON.stringify("sk-or-test")); });
    await pg.evaluate(()=>{ document.querySelector("#btnRebuild").click(); });
    await pg.waitForTimeout(800);
    await pg.click('#rtabs button[data-r="claude"]');
    await pg.click("#btnTestReview");
    await pg.waitForSelector('.chg [data-a="apply"]:not([disabled])',{timeout:20000});
    await pg.click('.chg [data-a="apply"]');
    const rv=await pg.evaluate(()=>__PE.itemVal(__PE.findItem("frag:style_header")));
    ok("the reviewer's edit is applied to the named piece", /PE-REVIEWED/.test(rv)&&!/PE-TEST-MARKER/.test(rv), rv.slice(-120));

    console.log("\n[9 — drift tests: ten scripted scenes, every turn through the real payload]");
    const seen=[];
    await ctx.unroute(/openrouter\.ai/);
    await ctx.route(/openrouter\.ai/,async r=>{
      const body=JSON.parse(r.request().postData()||"{}"); const msgs=body.messages||[];
      const last=String((msgs.slice(-1)[0]||{}).content||"");
      let content;
      if(/instruction-following test/.test(last)){
        const n=(last.match(/^TURN \d+$/gm)||[]).length;
        content=JSON.stringify({turns:Array.from({length:n},(_,i)=>({verdict:i===2?"bent":"held",note:"t"+(i+1)})),drift_at:3,score:7,
          summary:"Held, then gave ground on turn 3.",edits:[{item:"frag:style_header",find:"PE-REVIEWED",replace:"PE-DRIFT-FIX",why:"t"}]});
      }else{ seen.push(msgs.map(m=>m.content).join("\n")); content='"Hatırlamıyorum abi." *Çakmağı çeviriyor.*'; }
      await r.fulfill({status:200,contentType:"application/json",body:JSON.stringify({choices:[{message:{content}}]})});
    });
    await pg.click('#rtabs button[data-r="drift"]');
    const nScenes=await pg.evaluate(()=>__PE.DRIFT_SCENES.length);
    ok("there are ten scenes", nScenes===10, nScenes);
    await pg.evaluate(()=>__PE.runDriftScenes([__PE.DRIFT_SCENES[0]]));
    const d=await pg.evaluate(()=>({r:__PE.DR.results.past,html:document.querySelector("#dr_past").textContent}));
    ok("every scripted line was played, and every reply kept", d.r&&d.r.turns.length===5&&d.r.turns.every(t=>t.reply&&/Hatırlamıyorum/.test(t.reply)), JSON.stringify(d.r&&d.r.turns));
    ok("each turn was built from the real payload, with the earlier replies in the transcript",
       seen.length===5&&/Antakya/.test(seen[0])&&/Selin/.test(seen[1])&&/Buket/.test(seen[0])&&(seen[4].match(/Hatırlamıyorum abi/g)||[]).length>=4, seen.map(x=>x.length).join(","));
    ok("the scene's own place is in the payload", /Sami & Buket's flat/.test(seen[0]), seen[0].slice(0,300));
    ok("every scene is played by a woman character", await pg.evaluate(()=>__PE.DRIFT_SCENES.every(sc=>sc.speaker==="p_buket")));
    ok("the judge's verdicts and the drift turn are shown", /drifted at turn 3/.test(d.html)&&/7\/10/.test(d.html)&&/bent/.test(d.html), d.html.slice(0,400));
    await pg.click('#dr_past .chg [data-a="apply"]');
    ok("its edit applies to the named piece", await pg.evaluate(()=>/PE-DRIFT-FIX/.test(__PE.itemVal(__PE.findItem("frag:style_header")))));

    console.log("\n[8 — served the way Claude serves it: the editor is index.html]");
    const actx=await b.newContext({viewport:{width:412,height:915}});   // a fresh browser: no draft from the steps above
    await actx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
    const art=await actx.newPage(); const artErrs=[]; art.on('pageerror',e=>artErrs.push(e.message));
    await art.goto(base+'art/index.html');
    const booted=await art.waitForFunction(()=>window.__PE&&window.__PE.ENG.ready&&window.__PE.S.preview&&window.__PE.S.preview.messages,null,{timeout:90000}).then(()=>true,()=>false);
    const a=await art.evaluate(()=>({chip:document.querySelector("#engTxt").textContent,n:window.__PE&&window.__PE.S.preview&&window.__PE.S.preview.messages&&window.__PE.S.preview.messages.length,
      file:window.__PE&&window.__PE.S.fileName}));
    ok("the engine starts from storymind.html, not from the editor itself", booted&&/v\d/.test(a.chip)&&a.n>2, JSON.stringify(a));
    ok("and the bundled latest prompts are open", /^Latest prompts/.test(a.file||""), a.file);
    ok("the editor's own source is never taken for StoryMind", await art.evaluate(async()=>{ const t=await (await fetch("index.html")).text(); return !isAppSource(t); }));
    errs.push(...artErrs);
    await actx.close();

    ok("no page errors", errs.length===0, errs.join("\n"));
  }catch(e){ fail++; console.log("  FAIL  crashed: "+(e.stack||e)); }
  await b.close(); srv.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail?1:0);
})();
