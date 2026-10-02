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
  /* OpenRouter, stood in for: the model list the editor reads at start, and a chat endpoint whose
     answer each section sets. Every chat request is recorded with its headers and body. */
  const OR={calls:[],answer:()=>'"Tamam."'};
  await ctx.route(/openrouter\.ai/,async r=>{
    const url=r.request().url();
    if(/\/models/.test(url)) return r.fulfill({status:200,contentType:"application/json",
      body:JSON.stringify({data:[{id:"deepseek/deepseek-v4-pro"},{id:"anthropic/claude-sonnet-4.5"},{id:"anthropic/claude-opus-4.5"}]})});
    const body=JSON.parse(r.request().postData()||"{}");
    OR.calls.push({auth:r.request().headers()["authorization"]||"",body});
    const content=OR.answer(body);
    await r.fulfill({status:200,contentType:"application/json",body:JSON.stringify({choices:[{message:{role:"assistant",content},finish_reason:"stop"}]})});
  });
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
    ["solo","multi","gm","text"].forEach(k=>ok("v150.13 — the resistance block is in the "+k+" payload", rich[k].resist===true, JSON.stringify(rich[k])));
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

    console.log("\n[7 — Test & review: YOUR model writes the reply, Claude reviews it]");
    OR.calls=[];
    OR.answer=body=>{ const last=String((body.messages||[]).slice(-1)[0].content||"");
      return /Reply with ONLY this JSON/.test(last)
        ? JSON.stringify({verdict:"Too long, and it repeated his question.",problems:[{issue:"echo",evidence:"Dört bin mi?"}],
            edits:[{item:"frag:style_header",find:"PE-TEST-MARKER",replace:"PE-REVIEWED",why:"clearer"}]})
        : '"Dört bin mi? Abi otur bir çay iç önce."'; };
    await pg.evaluate(()=>{ localStorage.setItem("pe_v1_orkey",JSON.stringify("sk-or-test")); localStorage.setItem("pe_v1_testmodel",JSON.stringify("deepseek/deepseek-v4-pro")); });
    await pg.evaluate(()=>{ document.querySelector("#btnRebuild").click(); });
    await pg.waitForTimeout(800);
    await pg.click('#rtabs button[data-r="claude"]');
    await pg.click("#btnTestReview");
    await pg.waitForSelector('.chg [data-a="apply"]:not([disabled])',{timeout:20000});
    await pg.click('.chg [data-a="apply"]');
    const rv=await pg.evaluate(()=>__PE.itemVal(__PE.findItem("frag:style_header")));
    ok("the reviewer's edit is applied to the named piece", /PE-REVIEWED/.test(rv)&&!/PE-TEST-MARKER/.test(rv), rv.slice(-120));
    const gen=OR.calls.find(c=>c.body.model==="deepseek/deepseek-v4-pro"), rev=OR.calls.find(c=>/^anthropic\//.test(c.body.model||""));
    ok("the reply came from the model under test, through StoryMind's own request", !!gen&&gen.auth==="Bearer sk-or-test"
       &&typeof gen.body.temperature==="number"&&typeof gen.body.max_tokens==="number"&&Array.isArray(gen.body.messages)&&gen.body.messages.length>3,
       JSON.stringify(OR.calls.map(c=>({m:c.body.model,t:c.body.temperature,mx:c.body.max_tokens,n:(c.body.messages||[]).length}))));
    ok("the analyst is told to fix the cause, preferring removal and rewriting over new rules",
       !!rev&&/HOW TO FIX — FIND THE CAUSE, THEN REMOVE OR CHANGE IT/.test(JSON.stringify(rev.body.messages))&&/remove\|rewrite\|add/.test(JSON.stringify(rev.body.messages)));
    ok("each proposed edit shows what kind of change it is and how much text it adds or cuts",
       await pg.evaluate(()=>{ const t=(document.querySelector("#chat .chg")||{}).textContent||""; return /rewrite|remove|add/.test(t)&&/chars/.test(t); }));
    ok("the review was written by a Claude model", !!rev&&/Reply with ONLY this JSON/.test(JSON.stringify(rev.body.messages)), JSON.stringify(OR.calls.map(c=>c.body.model)));
    ok("the sandbox can reach nothing but OpenRouter, and only while a test is sending", await pg.evaluate(()=>{
      const A=__PE.relayAllowed, was=__PE.NET.allow;
      __PE.NET.allow=false; const idle=A("https://openrouter.ai/api/v1/chat/completions");
      __PE.NET.allow=true; const r={idle,or:A("https://openrouter.ai/api/v1/chat/completions"),other:A("https://evil.example/api"),
        lookalike:A("https://openrouter.ai.evil.example/api/v1/x"),plain:A("http://openrouter.ai/api/v1/x")};
      __PE.NET.allow=was; return !r.idle&&r.or&&!r.other&&!r.lookalike&&!r.plain; }));

    console.log("\n[9 — drift tests: ten scripted scenes, every turn through the real payload]");
    const seen=[]; OR.calls=[];
    OR.answer=body=>{ const msgs=body.messages||[]; const last=String((msgs.slice(-1)[0]||{}).content||"");
      if(/instruction-following test/.test(last)){
        const n=(last.match(/^TURN \d+$/gm)||[]).length;
        return JSON.stringify({turns:Array.from({length:n},(_,i)=>({verdict:i===2?"bent":"held",note:"t"+(i+1)})),drift_at:3,score:7,
          summary:"Held, then gave ground on turn 3.",edits:[{item:"frag:style_header",find:"PE-REVIEWED",replace:"PE-DRIFT-FIX",why:"t"}]});
      }
      seen.push(msgs.map(m=>m.content).join("\n")); return '"Hatırlamıyorum." *Gözlüğünü indiriyor.*'; };
    await pg.click('#rtabs button[data-r="drift"]');
    const nScenes=await pg.evaluate(()=>__PE.DRIFT_SCENES.length);
    ok("there are fourteen solo scenes", nScenes===14, nScenes);
    const solo4=await pg.evaluate(async()=>{
      const S=__PE.DRIFT_SCENES, by=id=>S.find(x=>x.id===id), out={};
      for(const id of ["daily","flirt","after1","after2"]){ const sc=by(id);
        const p=await __PE.engCall("build",{kind:sc.kind,speakerId:sc.speaker,targetId:"__user__",scene:{chat:sc.chat,opener:sc.opener,setup:sc.setup||null,turns:[{role:"user",content:sc.lines[0]}]}});
        out[id]={t:p.messages.map(m=>m.content).join("\n"),speaker:p.speaker,quality:!!sc.quality}; }
      return out; });
    ok("the new scenes are quality scenes played by Buket", ["daily","flirt","after1","after2"].every(k=>solo4[k].quality&&/Buket/.test(solo4[k].speaker)));
    ok("flirting happens at Emre's flat", /Emre's flat/.test(solo4.flirt.t), solo4.flirt.t.slice(0,400));
    ok("the day after: her memory of the night and her decision are in the payload",
       /I went down to Emre's flat to give back the casserole dish/.test(solo4.after1.t)&&/it will not happen again/.test(solo4.after1.t), solo4.after1.t.slice(-2500));
    ok("some days on: both nights and her softer terms are in the payload, not the first decision",
       /It happened again, on the sixth/.test(solo4.after2.t)&&/on your terms/.test(solo4.after2.t)&&!/you will be kind and you will close it/.test(solo4.after2.t), solo4.after2.t.slice(-2500));
    ok("the setup does not leak into other scenes", !/casserole dish/.test(solo4.daily.t));
    await pg.evaluate(()=>__PE.runDriftScenes([__PE.DRIFT_SCENES[0]]));
    const d=await pg.evaluate(()=>({r:__PE.DR.results.past,html:document.querySelector("#dr_past").textContent}));
    ok("every scripted line was played, and every reply kept", d.r&&d.r.turns.length===5&&d.r.turns.every(t=>t.reply&&/Hatırlamıyorum/.test(t.reply))&&d.r.model==="deepseek/deepseek-v4-pro", JSON.stringify(d.r&&d.r.turns));
    ok("each turn was built from the real payload, with the earlier replies in the transcript",
       seen.length===5&&/Antakya/.test(seen[0])&&/Selin/.test(seen[1])&&/Buket/.test(seen[0])&&(seen[4].match(/Hatırlamıyorum\./g)||[]).length>=4, seen.map(x=>x.length).join(","));
    ok("the scene's own place is in the payload", /Sami & Buket's flat/.test(seen[0]), seen[0].slice(0,300));
    ok("every scene is played by a woman character", await pg.evaluate(()=>__PE.DRIFT_SCENES.every(sc=>sc.speaker==="p_buket")));
    ok("the drift analysis carries the same method", OR.calls.some(c=>/HOW TO FIX — FIND THE CAUSE/.test(JSON.stringify(c.body.messages))&&/instruction-following test/.test(JSON.stringify(c.body.messages))));
    ok("all five turns went to the model under test, and the analysis to Claude",
       OR.calls.filter(c=>c.body.model==="deepseek/deepseek-v4-pro").length===5&&OR.calls.filter(c=>/^anthropic\//.test(c.body.model||"")).length===1,
       JSON.stringify(OR.calls.map(c=>c.body.model)));
    ok("the judge's verdicts and the drift turn are shown", /drifted at turn 3/.test(d.html)&&/7\/10/.test(d.html)&&/bent/.test(d.html), d.html.slice(0,400));
    await pg.click('#dr_past .chg [data-a="apply"]');
    ok("its edit applies to the named piece", await pg.evaluate(()=>/PE-DRIFT-FIX/.test(__PE.itemVal(__PE.findItem("frag:style_header")))));
    const ap=await pg.evaluate(()=>{
      const once=__PE.itemVal(__PE.findItem("frag:style_header"));
      __PE.DR.results.past.judge=JSON.parse(JSON.stringify(__PE.DR.results.past.judge));   // a fresh analysis render
      document.querySelector('#rtabs button[data-r="drift"]').click();
      const b=document.querySelector('#dr_past .chg [data-a="apply"]');
      const label=b.textContent, dis=b.disabled; b.click();
      const twice=__PE.itemVal(__PE.findItem("frag:style_header"));
      return {label,dis,same:once===twice,count:(twice.match(/PE-DRIFT-FIX/g)||[]).length,undo:!document.querySelector('#dr_past .chg [data-a="undo"]').hidden}; });
    ok("after the list is rebuilt, an applied edit still reads Applied and cannot be applied twice", ap.label==="Applied"&&ap.dis&&ap.same&&ap.count===1, JSON.stringify(ap));
    ok("…and offers Undo", ap.undo===true);
    await pg.click('#dr_past .chg [data-a="undo"]');
    const un=await pg.evaluate(()=>({v:__PE.itemVal(__PE.findItem("frag:style_header")),b:document.querySelector('#dr_past .chg [data-a="apply"]').textContent}));
    ok("Undo puts the old words back and the edit can be applied again", /PE-REVIEWED/.test(un.v)&&!/PE-DRIFT-FIX/.test(un.v)&&un.b==="Apply", JSON.stringify({b:un.b,tail:un.v.slice(-80)}));
    await pg.click('#dr_past .chg [data-a="apply"]');

    console.log("\n[9b — results travel: export here, import and analyse elsewhere]");
    const exported=await pg.evaluate(()=>{ const r=__PE.DR.results.past; return JSON.stringify({app:"StoryMind",kind:"drift-results",date:Date.now(),
      scenes:[{id:"past",title:"x",model:r.model,turns:r.turns,payload:r.payload,judge:null}]}); });
    await pg.evaluate(()=>{ __PE.DR.results={}; });
    await pg.setInputFiles("#fileDrift",{name:"drift.json",mimeType:"application/json",buffer:Buffer.from(exported)});
    await pg.waitForTimeout(400);
    const imp9=await pg.evaluate(()=>({n:(__PE.DR.results.past||{}).turns&&__PE.DR.results.past.turns.length,btn:!!document.querySelector("#dr_past button.pri")}));
    ok("an exported run imports, with an Analyse button", imp9.n===5&&imp9.btn, JSON.stringify(imp9));
    OR.calls=[];
    await pg.evaluate(()=>__PE.analyseDrift([__PE.DRIFT_SCENES[0]]));
    ok("Analyse sends it to Claude only, never back to the model", OR.calls.length===1&&/^anthropic\//.test(OR.calls[0].body.model)
       &&await pg.evaluate(()=>!!__PE.DR.results.past.judge), JSON.stringify(OR.calls.map(c=>c.body.model)));

    console.log("\n[10 — engine tests: the app plays for real, every background engine is recorded]");
    OR.calls=[];
    const memFind=await pg.evaluate(()=>__PE.itemVal(__PE.findItem("prompt:memBuild")).split("\n").find(l=>l.trim().length>30).trim().slice(0,40));
    OR.answer=(f=>body=>{ const all=JSON.stringify(body.messages||[]);
      if(/BACKGROUND ENGINE of the app/.test(all)){
        const k=(all.match(/prompt key \\"([A-Za-z0-9_]+)\\"/)||[])[1]||"";
        return JSON.stringify({verdict:k==="memBuild"?"issues":"good",summary:"s",problems:[],edits:k==="memBuild"?[{item:"prompt:memBuild",find:f,replace:f+" PE-ENGINE-FIX",why:"t"}]:[]}); }
      const sys=String(((body.messages||[])[0]||{}).content||"");
      return /JSON/i.test(sys)?"{}":'"Tamam." *Başını sallıyor.*'; })(memFind);
    await pg.evaluate(()=>{ localStorage.setItem("pe_v1_testmode",JSON.stringify("or")); });
    await pg.click('#rtabs button[data-r="engines"]');
    await pg.evaluate(()=>__PE.runEngines());
    await pg.waitForFunction(()=>!__PE.ENGRUN.running,null,{timeout:300000});
    const er=await pg.evaluate(()=>({groups:__PE.engGroups().map(g=>({k:g.key,n:g.calls.length,m:g.calls[0].model,err:g.calls.filter(c=>c.error).length})),
      judged:Object.keys(__PE.ENGRUN.judge).length,rest:__PE.S.world&&__PE.S.world.source}));
    const keys=er.groups.map(g=>g.k);
    ok("a played scene plus End Day fires the background engines (≥15 of them)", er.groups.length>=15, keys.join(" "));
    ["memEval","memBuild","relPrompt","daySummaryPrompt","goalsCurator","presencePrompt","routerChar","chronicler"].forEach(k=>
      ok("…including "+k, keys.indexOf(k)>=0, keys.join(" ")));
    ok("no engine call failed", er.groups.every(g=>g.err===0), JSON.stringify(er.groups.filter(g=>g.err)));
    const models=new Set(OR.calls.filter(c=>!/BACKGROUND ENGINE/.test(JSON.stringify(c.body.messages))).map(c=>c.body.model));
    ok("each engine was sent to the model StoryMind assigns it (not one model for everything)", models.size>=2, [...models].join(", "));
    ok("Claude analysed every engine", er.judged===er.groups.length, er.judged+" of "+er.groups.length);
    ok("the engine scene picker is visible at the top of the tab, not folded away", await pg.evaluate(()=>{ const sel=document.querySelector("#engPreset");
      return !!sel&&!sel.closest("details")&&sel.options.length===6&&/Sami/.test(document.querySelector("#engPresetFocus").textContent); }));
    ok("the intense scene is the default: Emre flirts with Buket in front of Sami", await pg.evaluate(()=>__PE.ENGRUN.lines.length===6&&/Buket/.test(__PE.ENGRUN.lines[0])&&/Vur hadi/.test(__PE.ENGRUN.lines[4])));
    ok("its purpose reaches the analysis (who the routers pick, realism under intensity)", OR.calls.some(c=>{ const t=JSON.stringify(c.body.messages); return /BACKGROUND ENGINE/.test(t)&&/WHAT THE SCENE WAS BUILT TO TEST/.test(t)&&/turn routers pick/.test(t)&&/Vur hadi/.test(t); }));
    ok("the characters' replies are analysed for realism, with no edits proposed against them", OR.calls.some(c=>{ const t=JSON.stringify(c.body.messages); return /judge realism, proportion and character under this pressure/.test(t); }));
    ok("the engine analysis carries the same method", OR.calls.some(c=>/HOW TO FIX — FIND THE CAUSE/.test(JSON.stringify(c.body.messages))&&/BACKGROUND ENGINE/.test(JSON.stringify(c.body.messages))));
    const cal=await pg.evaluate(()=>{ const b=[...document.querySelectorAll("#engList .scene")].find(x=>/memBuild/.test(x.textContent)); return !!(b&&b.querySelector('.chg [data-a="apply"]:not([disabled])')); });
    ok("an engine's proposed edit is offered", cal);
    if(cal){ await pg.evaluate(()=>{ const b=[...document.querySelectorAll("#engList .scene")].find(x=>/memBuild/.test(x.textContent)); b.querySelector('.chg [data-a="apply"]').click(); });
      ok("and applies to that engine's prompt", await pg.evaluate(()=>/PE-ENGINE-FIX/.test(__PE.itemVal(__PE.findItem("prompt:memBuild"))))); }
    ok("the sandbox is back to the untouched sample afterwards", await pg.evaluate(async()=>{ const p=await __PE.engCall("build",{kind:"solo"}); return p.messages.filter(m=>m.hist).length>=3; }));

    console.log("\n[10a — an engine scene with its own place and cast plays there]");
    OR.calls=[];
    await pg.evaluate(()=>{ localStorage.setItem("pe_v1_engpreset",JSON.stringify("canteen")); localStorage.setItem("pe_v1_engscript",JSON.stringify(""));
      const sel=document.querySelector("#engPreset"); sel.value="canteen"; sel.dispatchEvent(new Event("change")); document.querySelector("#engEndDay").checked=false;
      document.querySelector("#engScript").value=__PE.ENGINE_SCENES.find(x=>x.id==="canteen").lines.slice(0,2).join("\n"); });
    await pg.evaluate(()=>__PE.runEngines());
    await pg.waitForFunction(()=>!__PE.ENGRUN.running,null,{timeout:300000});
    const cant=OR.calls.filter(c=>!/BACKGROUND ENGINE/.test(JSON.stringify(c.body.messages))).map(c=>JSON.stringify(c.body.messages)).join(" ");
    ok("the canteen scene is played at the canteen, with Sami and Berker", /Isdemir Canteen/.test(cant)&&/Berker/.test(cant)&&/Sami/.test(cant), cant.slice(0,300));
    ok("its focus reaches the analysis", OR.calls.some(c=>/Two brothers set against each other in public/.test(JSON.stringify(c.body.messages))));
    await pg.evaluate(()=>{ localStorage.setItem("pe_v1_engpreset",JSON.stringify("flirt")); document.querySelector("#engEndDay").checked=true; });

    console.log("\n[10b — Claude stands in: every call goes to Claude]");
    OR.calls=[];
    await pg.evaluate(()=>{ localStorage.setItem("pe_v1_testmode",JSON.stringify("claude")); });
    await pg.evaluate(()=>{ document.querySelector("#engEndDay").checked=false; document.querySelector("#engScript").value="Merhaba Buket."; __PE.analyseEngines=__PE.analyseEngines; });
    await pg.evaluate(()=>__PE.runEngines());
    await pg.waitForFunction(()=>!__PE.ENGRUN.running,null,{timeout:300000});
    const cm=new Set(OR.calls.map(c=>c.body.model));
    ok("with Claude standing in, every call (reply, engines, analysis) went to a Claude model", OR.calls.length>3&&[...cm].every(m=>/^anthropic\//.test(m)), [...cm].join(", "));
    await pg.evaluate(()=>{ localStorage.setItem("pe_v1_testmode",JSON.stringify("or")); document.querySelector("#engEndDay").checked=true; });

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
