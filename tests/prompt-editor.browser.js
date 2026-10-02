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
      body:JSON.stringify({data:[{id:"deepseek/deepseek-v4-pro"},{id:"anthropic/claude-sonnet-4.5"},{id:"anthropic/claude-opus-4.5"},{id:"anthropic/claude-opus-5:batch"}]})});
    const body=JSON.parse(r.request().postData()||"{}");
    OR.calls.push({auth:r.request().headers()["authorization"]||"",body});
    const ms=OR.delay?OR.delay(body):0;
    OR.inflight=(OR.inflight||0)+1; if(ms) OR.peak=Math.max(OR.peak||0,OR.inflight);
    if(ms) await new Promise(res=>setTimeout(res,ms));
    OR.inflight--;
    const content=OR.answer(body);
    await r.fulfill({status:200,contentType:"application/json",body:JSON.stringify({choices:[{message:{role:"assistant",content},finish_reason:"stop"}]})});
  });
  /* Claude, as the Claude app serves it (the sample capability): the analyst. Its calls are recorded with
     the OpenRouter ones (model "anthropic/claude (here)") so a section can tell who answered what. */
  await ctx.exposeFunction("__claudeAnswer",async input=>{
    const body={model:"anthropic/claude (here)",messages:[{role:"user",content:String(input)}]};
    const ms=OR.delay?OR.delay(body):0;
    OR.inflight=(OR.inflight||0)+1; if(ms) OR.peak=Math.max(OR.peak||0,OR.inflight);
    if(ms) await new Promise(res=>setTimeout(res,ms));
    OR.inflight--;
    OR.calls.push({auth:"",body,claude:true}); return OR.answer(body); });
  const installClaude=p=>p.evaluate(()=>{ const f=async(input,o)=>{ const t=typeof input==="string"?input:input.map(m=>m.content).join("\n\n"); const text=String(await window.__claudeAnswer(t)); o&&o.onText&&o.onText({text}); return {text,truncated:false}; };
      f.json=async(input,o)=>{ const t=await f(input,o); const m=String(t.text).match(/\{[\s\S]*\}/); return JSON.parse(m?m[0]:t.text); };
      AI.sample=f; renderProvider(); });
  const pg=await ctx.newPage();
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x===undefined?c:x).slice(0,700));} };
  try{
    await pg.goto(base+'prompt-editor.html');
    await pg.evaluate(()=>{ try{ localStorage.setItem("sm_canary","real app data"); }catch(e){} });
    await pg.waitForFunction(()=>window.__PE&&window.__PE.ENG.ready&&window.__PE.S.preview&&window.__PE.S.preview.messages,null,{timeout:90000});
    const noClaude=await pg.evaluate(async()=>{ try{ await aiAsk("x",{}); return "answered"; }catch(e){ return e.code; } });
    ok("without the Claude app there is no analyst at all (OpenRouter never analyses)", noClaude==="no_claude", noClaude);
    await installClaude(pg);

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
    await installClaude(pg);
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
    await pg.click('#rtabs button[data-r="tests"]');
    const nScenes=await pg.evaluate(()=>__PE.DRIFT_SCENES.length);
    ok("there are twenty-three reply scenes", nScenes===23, nScenes);
    const solo4=await pg.evaluate(async()=>{
      const S=__PE.DRIFT_SCENES, by=id=>S.find(x=>x.id===id), out={};
      for(const id of ["daily","flirt","after1","after2"]){ const sc=by(id);
        const p=await __PE.engCall("build",{kind:sc.kind,speakerId:sc.speaker,targetId:"__user__",scene:{chat:sc.chat,opener:sc.opener,setup:sc.setup||null,asOf:sc.asOf||null,turns:[{role:"user",content:sc.lines[0]}]}});
        out[id]={t:p.messages.map(m=>m.content).join("\n"),speaker:p.speaker,quality:!!sc.quality}; }
      return out; });
    ok("the new scenes are quality scenes played by Buket", ["daily","flirt","after1","after2"].every(k=>solo4[k].quality&&/Buket/.test(solo4[k].speaker)));
    ok("flirting happens at Emre's house", /Emre's House/.test(solo4.flirt.t), solo4.flirt.t.slice(0,400));
    ok("the day after: her memory of the night and her decision are in the payload",
       /I ended up in his bed/.test(solo4.after1.t)&&/the one full surrender/.test(solo4.after1.t), solo4.after1.t.slice(-2500));
    ok("some days on: both nights and her softer terms are in the payload, not the first decision",
       /It happened again, on day nine/.test(solo4.after2.t)&&/on your terms/.test(solo4.after2.t)&&!/the one full surrender/.test(solo4.after2.t), solo4.after2.t.slice(-2500));
    ok("the setup does not leak into other scenes", !/ended up in his bed/.test(solo4.daily.t));
    await pg.evaluate(()=>__PE.runDriftScenes([__PE.DRIFT_SCENES[0]]));
    const d=await pg.evaluate(()=>({r:__PE.DR.results.past,html:document.querySelector("#dr_past").textContent}));
    ok("every scripted line was played, and every reply kept", d.r&&d.r.turns.length===5&&d.r.turns.every(t=>t.reply&&/Hatırlamıyorum/.test(t.reply))&&d.r.model==="deepseek/deepseek-v4-pro", JSON.stringify(d.r&&d.r.turns));
    ok("each turn was built from the real payload, with the earlier replies in the transcript",
       seen.length===5&&/Palmera'da seninle şamandıraya/.test(seen[0])&&/kırmızı mayoyu/.test(seen[1])&&/Buket/.test(seen[0])&&(seen[4].match(/Hatırlamıyorum\./g)||[]).length>=4, seen.map(x=>x.length).join(","));
    ok("the scene's own place is in the payload", /Big Özüçak's House/.test(seen[0]), seen[0].slice(0,300));
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
      document.querySelector('#rtabs button[data-r="tests"]').click();
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
    await pg.click('#rtabs button[data-r="tests"]');
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
    ok("the canteen scene is played at the canteen, with Sami and Berker", /Worker Canteen|Isdemir/.test(cant)&&/Berker/.test(cant)&&/Sami/.test(cant), cant.slice(0,300));
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

    console.log("\n[11 — one run: every payload kind, each scene shaped to it, then everything analysed together]");
    const kindsOk=await pg.evaluate(async()=>{
      const S=__PE.DRIFT_SCENES, by=id=>S.find(x=>x.id===id), out={};
      const one=async(id,turns)=>{ const sc=by(id); const p=await __PE.engCall("build",{kind:sc.kind,speakerId:sc.speaker,targetId:"__user__",scene:{chat:sc.chat,opener:sc.opener,setup:sc.setup||null,turns}}); return p.messages.map(m=>m.content).join("\n"); };
      out.kinds=[...new Set(S.map(x=>x.kind))].sort().join(",");
      out.flirtThemes=S.filter(x=>x.theme==="Flirting").map(x=>x.kind).sort().join(",");
      out.text=await one("flirt_text",[{role:"user",content:"Uyudun mu?",textMsg:true,textWith:"p_buket",textWithName:"Buket Özüçak"}]);
      out.gm=await one("flirt_gm",[{role:"user",content:"Bir çay daha?"},{role:"assistant",speaker:"Narrator",narratorEvent:true,content:"*Buket's phone lights up on the table: SAMI.*"}]);
      out.heat=await one("flirt_heat",[{role:"user",content:"*Onu kendime çekiyorum.* Buket…"}]);
      out.multi=await one("flirt_multi",[{role:"user",content:"Buket, bu akşam çok güzel olmuşsun."}]);
      return out; });
    ok("all five payload kinds are covered", kindsOk.kinds==="gm,heat,multi,solo,text", kindsOk.kinds);
    ok("the flirting theme is played in every kind", kindsOk.flirtThemes==="gm,heat,multi,solo,text", kindsOk.flirtThemes);
    ok("the text version is a text thread", /Uyudun mu\?/.test(kindsOk.text)&&/text/i.test(kindsOk.text), kindsOk.text.slice(-600));
    ok("the gamemaster version puts the beat in front of her", /phone lights up on the table: SAMI/.test(kindsOk.gm), kindsOk.gm.slice(-600));
    ok("the heat version is built as a heat beat, at Emre's", /Emre's House/.test(kindsOk.heat)&&kindsOk.heat!==kindsOk.multi, kindsOk.heat.slice(0,300));
    ok("the several-characters version has Sami in the room", /Sami/.test(kindsOk.multi));

    OR.calls=[];
    OR.answer=body=>{ const all=JSON.stringify(body.messages||[]);
      if(/reading the results of a whole test run AT ONCE/.test(all)) return JSON.stringify({score:6,summary:"s",patterns:[{pattern:"too stiff in daily talk",scenes:["Daily talk: fun and real"],cause:"x"}],
        decisions:[{id:"R:flirt_gm#1",verdict:"drop",why:"helps one scene, stiffens daily talk"}],
        edits:[{item:"frag:style_header",kind:"rewrite",cause:"c",find:"PE-DRIFT-FIX",replace:"PE-ALL-FIX",why:"w",helps:["Daily talk: fun and real","Flirting by text, at night"],risks:"none"}]});
      if(/instruction-following test/.test(all)){ const n=(all.match(/TURN \d+\\n/g)||[]).length||4;
        const ed=/Flirting at Emre's, and the world interrupts/.test(all)?[{item:"frag:style_header",kind:"add",cause:"c",find:"PE-DRIFT-FIX",replace:"PE-DRIFT-FIX ONLY-ONE-SCENE",why:"w"}]:[];
        return JSON.stringify({turns:Array.from({length:n},()=>({verdict:"held",note:"n"})),drift_at:null,score:8,summary:"ok",edits:ed}); }
      if(/BACKGROUND ENGINE/.test(all)) return JSON.stringify({verdict:"good",summary:"ok",problems:[],edits:[]});
      const sys=String(((body.messages||[])[0]||{}).content||""); return /JSON/i.test(sys)?"{}":'"Tamam." *Gülümsüyor.*'; };
    await pg.evaluate(()=>{ localStorage.setItem("pe_v1_selreply",JSON.stringify(["daily_text","flirt_gm"])); localStorage.setItem("pe_v1_seleng",JSON.stringify(["comings"]));
      localStorage.setItem("pe_v1_engpreset",JSON.stringify("flirt")); localStorage.setItem("pe_v1_engscript",JSON.stringify("")); document.querySelector("#engEndDay").checked=false; });
    await pg.click('#rtabs button[data-r="tests"]');
    OR.peak=0; OR.delay=body=>/instruction-following test|BACKGROUND ENGINE/.test(JSON.stringify(body.messages||[]))?400:0;
    const est=await pg.evaluate(()=>document.querySelector("#allEstimate").textContent);
    ok("the estimate counts what is ticked", /2 reply scenes \(9 replies\) and 1 engine scene/.test(est), est);
    await pg.evaluate(()=>__PE.runEverything());
    const all=await pg.evaluate(()=>({dt:__PE.DR.results.daily_text,fg:__PE.DR.results.flirt_gm,eng:__PE.ENGRUN.byScene.comings,overall:__PE.ALL.overall,
      box:(document.querySelector("#overallBox")||{}).textContent||""}));
    ok("both reply scenes were played and analysed", all.dt&&all.dt.judge&&all.fg&&all.fg.judge&&all.fg.turns.some(t=>t.gm), JSON.stringify({dt:!!(all.dt&&all.dt.judge),fg:!!(all.fg&&all.fg.judge)}));
    ok("the engine scene was played (its own cast) and analysed", !!(all.eng&&all.eng.calls.length&&Object.keys(all.eng.judge||{}).length), JSON.stringify(all.eng&&{n:all.eng.calls.length,j:Object.keys(all.eng.judge||{}).length}));
    const together=OR.calls.find(c=>/AT ONCE/.test(JSON.stringify(c.body.messages)));
    const tj=together?JSON.stringify(together.body.messages):"";
    ok("then Claude read everything together: every scene, every engine verdict, real payloads", !!together&&/Daily talk by text/.test(tj)&&/Flirting at Emre's, and the world interrupts/.test(tj)&&/Engine scene: Comings and goings/.test(tj)&&/A REAL TEXT MESSAGES PAYLOAD/.test(tj), tj.slice(0,400));
    ok("the combined verdict shows, with each edit's scenes", !!all.overall&&/Across all scenes/.test(all.box)&&/too stiff in daily talk/.test(all.box)&&/Helps: Daily talk/.test(all.box), all.box.slice(0,300));
    OR.delay=null;
    ok("the analysts read the scenes and engines at the same time", OR.peak>=2, OR.peak);
    ok("the overseer was handed every analyst edit by id", /\[R:flirt_gm#1\]/.test(tj)&&/OVERSEER/.test(tj), (tj.match(/.{0,80}R:flirt_gm.{0,80}/)||[""])[0]);
    const od=await pg.evaluate(()=>({box:(document.querySelector("#overallBox")||{}).textContent||"",card:(document.querySelector("#dr_flirt_gm")||{}).textContent||""}));
    ok("its decisions show, on the run and on the analyst's own edit", /1 dropped/.test(od.box)&&/Overseer: dropped helps one scene/.test(od.card), od.card.slice(-400));
    ok("the combined edit applies", await pg.evaluate(()=>{ const b=document.querySelector('#overallBox .chg [data-a="apply"]'); if(!b||b.disabled) return false; b.click(); return /PE-ALL-FIX/.test(__PE.itemVal(__PE.findItem("frag:style_header"))); }));

    console.log("\n[12 — LLM evaluation: models compared on fixed prompts, no prompt edits]");
    OR.calls=[];
    OR.answer=body=>{ const all=JSON.stringify(body.messages||[]);
      if(/You are evaluating LANGUAGE MODELS/.test(all)) return JSON.stringify({models:[{label:"A",scores:{realism:6},overall:6,good:"steady",weak:"flat"},{label:"B",scores:{realism:8},overall:8,good:"lively",weak:"long"}],
        best:"B",recommend:"Model B: livelier and in character",summary:"Model A is safe; Model B is better."});
      const sys=String(((body.messages||[])[0]||{}).content||""); return /JSON/i.test(sys)?"{}":'"Tamam." *Gülümsüyor.*'; };
    const mf=await pg.evaluate(()=>{ const f=__PE.MODEL_FIELDS.map(x=>x.key); const e=__PE.effectiveModels(); return {f,e}; });
    ok("one entry per text-model setting in StoryMind's Settings", ["model","mcModel","memModel","gmModel","rewriter","routerModel","bioModel","authorModel","gossipModel","playerNarrateModel","callModel"].every(k=>mf.f.indexOf(k)>=0), mf.f.join(","));
    ok("each starts from the model in the prompts file (blank ones use their fallback)", !!mf.e.model&&!!mf.e.memModel&&mf.e.gossipModel===(mf.e.gossipModel||mf.e.memModel), JSON.stringify(mf.e).slice(0,300));
    await pg.evaluate(()=>{ const L=__PE.LLM; L.cfg.cands={model:["x/rp-b"],memModel:["x/mem-b"]}; L.cfg.scenes=["daily_text"]; L.cfg.eng="comings"; L.cfg.per=2;
      localStorage.setItem("pe_v1_llmcfg",JSON.stringify(L.cfg)); });
    await pg.click('#rtabs button[data-r="llm"]');
    const ui=await pg.evaluate(()=>({fields:document.querySelectorAll("#llmFields [data-f]").length,est:document.querySelector("#llmEstimate").textContent}));
    ok("the tab lists every setting with its candidates", ui.fields===mf.f.length, JSON.stringify(ui));
    await pg.evaluate(()=>__PE.runLlm());
    const ev=await pg.evaluate(()=>{ const R=__PE.LLM.res; return {rp:R.fields.model,mem:R.fields.memModel,html:document.querySelector("#llmResults").textContent,apply:document.querySelectorAll("#llmResults [data-a=apply]").length}; });
    const rpModels=new Set(OR.calls.filter(c=>!/LANGUAGE MODELS/.test(JSON.stringify(c.body.messages))).map(c=>c.body.model));
    ok("the roleplay candidate played the scene itself", rpModels.has("x/rp-b")&&ev.rp&&ev.rp.runs.daily_text["x/rp-b"].length===4&&ev.rp.runs.daily_text[mf.e.model].length===4, [...rpModels].join(", "));
    const mem=ev.mem; const __dbgBase=await pg.evaluate(()=>({b:__PE.LLM.res.baseline,mode:llmMode(),here:llmHere(),fields:Object.keys(__PE.LLM.res.fields),stat:document.querySelector("#llmStat").textContent}));
    ok("the memory setting's recorded calls were replayed with the candidate, on identical input", !!mem&&mem.calls.length>0&&mem.calls.every(c=>c.outs["x/mem-b"]!=null&&c.outs[mf.e.memModel]!=null),
       JSON.stringify({calls:mem&&mem.calls.map(c=>({dbg:c.dbg,m:Object.keys(c.outs)})),err:mem&&mem.error,base:__dbgBase}));
    const rep=OR.calls.find(c=>c.body.model==="x/mem-b"), orig=mem&&mem.calls[0];
    ok("…sent with the same messages the app sent the original", !!rep&&!!orig&&JSON.stringify(rep.body.messages)===JSON.stringify(orig.messages.map(m=>({role:m.role,content:m.content})).concat([]))||(!!rep&&JSON.stringify(rep.body.messages).indexOf(String(orig.messages[0].content).slice(0,60).replace(/"/g,'\\"'))>=0));
    const judge=OR.calls.filter(c=>/You are evaluating LANGUAGE MODELS/.test(JSON.stringify(c.body.messages)));
    ok("Claude compared each setting blind, and was told not to touch the prompts", judge.length===2&&judge.every(c=>{ const t=JSON.stringify(c.body.messages); return /Model A/.test(t)&&/do not suggest prompt changes/.test(t)&&t.indexOf("x/rp-b")<0&&t.indexOf("x/mem-b")<0; }), judge.length);
    ok("the verdict names the real models again, with a table and a recommendation", /best: x\/rp-b/.test(ev.html)&&/x\/rp-b: livelier/.test(ev.html)&&/good at:/.test(ev.html), ev.html.slice(0,400));
    ok("no prompt edits are offered in the evaluation", ev.apply===0);


    ok("a batch-only model (…:batch) is never offered as a model to test", await pg.evaluate(()=>NET.models.every(m=>!/:batch$/.test(m))));
    console.log("\n[13 — your story as the data: slimmed, kept in the browser, rewound per scene]");
    const sctx=await b.newContext({viewport:{width:1300,height:900}});
    await sctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
    await sctx.route(/openrouter\.ai/,r=>r.abort());          // as inside Claude: OpenRouter out of reach
    const sp=await sctx.newPage(); const sErrs=[]; sp.on('pageerror',e=>sErrs.push(e.message));
    await sp.goto(base+'prompt-editor.html');
    await sp.waitForFunction(()=>window.__PE&&window.__PE.ENG.ready&&window.__PE.S.preview&&window.__PE.S.preview.messages,null,{timeout:90000});
    const U="u_t", BK={id:"p_x1",name:"Buket Özüçak",universeId:U,personality:"You are a calm dentist.",backstory:"Married to Sami.",instructions:"",image:"data:image/png;base64,AAAA",poseRefs:{a:["data:x"]},
      relationships:{p_x4:{tie:"neighbour's girl",relationship:"x"}},afterHeatBy:{"Emre Tokmak":{text:"SEALED_DECISION never alone with him again.",day:6,period:"Afternoon"}},
      goalsLive:{lines:["Keep Deniz away from the pool","Build a patient list"]}};
    const backup={app:"StoryMind",backupVersion:1,localStorage:{sm_curuniverse:'"'+U+'"'},collections:{
      universes:[{id:U,name:"Test Lojman",userName:"Emre Tokmak",playerHomeLocId:"L_E",image:"https://x/y.png",prompts:{x:"y"},
        chronicle:[{day:2,text:"Deniz and Emre at the pool."},{day:3,text:"Sami lost the reports."}],userTies:{p_x4:{tie:"x"},p_x2:{tie:"friend"}},
        originDoc:"Buket Özüçak is a dentist.\n\nDeniz Kaya is a cheerful fourteen-year-old.",
        locations:[{id:"L_H",name:"Big Özüçak's House",type:"home",residents:["p_x1","p_x2","p_x4"],image:"data:z",sublocations:[{id:"S_L",name:"Living Room"},{id:"S_K",name:"Kitchen"}]},
                   {id:"L_E",name:"Emre's House",type:"home",residents:[],sublocations:[{id:"S_EL",name:"Open-Plan Living Area"},{id:"S_EB",name:"Master Bedroom"}]},
                   {id:"L_P",name:"Isdemir",type:"poi",residents:[],sublocations:[{id:"S_C",name:"Worker Canteen"}]}]}],
      personas:[BK,{id:"p_x2",name:"Sami Özüçak",universeId:U,personality:"Charming.",backstory:"",instructions:""},{id:"p_x3",name:"Berker Özüçak",universeId:U,personality:"Meticulous.",backstory:"",instructions:""},
        {id:"p_x4",name:"Deniz Kaya",universeId:U,personality:"You are a cheerful fourteen-year-old.",backstory:"",instructions:""}],
      memory:[{id:"m1",ownerId:"p_x1",universeId:U,type:"EXPERIENCE",content:"EARLYMARK I walked the trail with Emre.",gameDay:3,gamePeriod:"Midday",vec:[0.1,0.2]},
              {id:"m2",ownerId:"p_x1",universeId:U,type:"INTIMACY",content:"AFTERMARK it happened at his house.",gameDay:6,gamePeriod:"Afternoon"},
              {id:"m3",ownerId:"p_x1",universeId:U,type:"EXPERIENCE",content:"I saw Deniz by the pool.",gameDay:4,gamePeriod:"Morning"},
              {id:"m4",ownerId:"p_x4",universeId:U,type:"EXPERIENCE",content:"x",gameDay:4}],
      gossip:[],
      chats:{c1:{id:"c1",universeId:U,gameDay:6,period:"Afternoon",locationId:"L_E",location:"Emre's House",presentIds:["p_x1","p_x4"],
        messages:[{mid:"a",role:"user",content:"Merhaba"},{mid:"b",role:"assistant",speaker:"Deniz Kaya",speakerId:"p_x4",content:"Selam"}],
        rel:{"p_x1>__user__":{trust:10,desc:"d"},"p_x4>__user__":{trust:1}},intents:[{id:"i1",holderId:"p_x4",targetId:"__user__",status:"brewing",aim:"x"}],
        book:{big:"x"},imgPromptBy:{p_x1:"x"},_psyche:{p_x1:{sig:"p_x1|p_x4|x",toward:"t",against:"a"}}}}}};
    const sl=await sp.evaluate(b=>{ const w=__PE.slimWorld(b); const t=JSON.stringify(w);
      return {t,left:w.left,ids:w.collections.personas.map(p=>p.id),home:w.collections.universes[0].locations.map(l=>l.id+":"+(l.sublocations||[]).map(s=>s.id).join("/")).join(" "),
        mem:w.collections.memory.length,prompts:Object.keys(w.collections.universes[0].prompts).length}; },backup);
    const noMinor=sl.t.replace(/"left":\[[^\]]*\]/,"");
    ok("a character under 18 is left out, with every record that mentions her", JSON.stringify(sl.left)==='["Deniz Kaya"]'&&!/Deniz|p_x4/.test(noMinor), (noMinor.match(/.{0,60}(Deniz|p_x4).{0,40}/)||[""])[0]);
    ok("pictures, embeddings and the book are dropped, the universe's own prompts too", !/data:|"vec"|"book"|imgPromptBy|poseRefs/.test(sl.t)&&sl.prompts===0, sl.t.slice(0,200));
    ok("Buket, Sami and Berker and their places get the ids the scenes use", sl.ids.join()==="p_buket,p_sami,p_berk"&&/l_sami:s_door?\/?s_liv\/s_kit|l_sami:s_liv\/s_kit/.test(sl.home)&&/l_emre:s_eliv\/s_ebed/.test(sl.home)&&/l_can:s_tab/.test(sl.home), sl.ids.join()+" | "+sl.home);
    await sp.click('#btnWorld'); await sp.waitForSelector('.modal, dialog, [role=dialog]',{timeout:5000}).catch(()=>{});
    await sp.setInputFiles('#fileWorld',{name:"storymind_backup.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(backup))});
    await sp.waitForFunction(()=>__PE.S.world&&__PE.S.world.source==="story",null,{timeout:30000});
    const sw=await sp.evaluate(()=>({sel:document.querySelector("#worldSel").value,opts:[...document.querySelectorAll("#worldSel option")].map(o=>o.textContent),name:__PE.STORY.w&&__PE.STORY.w.name}));
    ok("a loaded backup becomes the story every payload and test uses", sw.sel==="story"&&/Your story: Test Lojman/.test(sw.opts.join("|")), JSON.stringify(sw));
    const bs=await sp.evaluate(async()=>{ const by=id=>__PE.DRIFT_SCENES.find(x=>x.id===id), out={};
      for(const id of ["past","after1"]){ const sc=by(id);
        const p=await __PE.engCall("build",{kind:sc.kind,speakerId:sc.speaker,targetId:"__user__",scene:{chat:sc.chat,opener:sc.opener,setup:sc.setup||null,asOf:sc.asOf||null,turns:[{role:"user",content:sc.lines[0]}]}});
        out[id]=p.messages.map(m=>m.content).join("\n"); }
      return out; });
    ok("a scene set before day 6 is rewound: no memory of it, no decision after it", /EARLYMARK/.test(bs.past)&&!/AFTERMARK/.test(bs.past)&&!/SEALED_DECISION/.test(bs.past), JSON.stringify({e:/EARLYMARK/.test(bs.past),a:/AFTERMARK/.test(bs.past),s:/SEALED_DECISION/.test(bs.past)}));
    ok("the day after uses the story's own memory and decision, not the sample's stand-in", /AFTERMARK/.test(bs.after1)&&/SEALED_DECISION/.test(bs.after1)&&!/ended up in his bed/.test(bs.after1), JSON.stringify({a:/AFTERMARK/.test(bs.after1),s:/SEALED_DECISION/.test(bs.after1),e:/ended up in his bed/.test(bs.after1)}));
    ok("pieces the story never produced are filled from its facts (scenario, a condensed past)", /başhekim/.test(bs.past)&&/The first days:/.test(bs.past), bs.past.slice(0,600));
    await sp.reload();
    await sp.waitForFunction(()=>window.__PE&&window.__PE.ENG.ready&&window.__PE.S.world,null,{timeout:90000});
    ok("the story is kept in this browser across a reload", await sp.evaluate(()=>__PE.S.world.source==="story"&&__PE.STORY.w&&__PE.STORY.w.name==="Test Lojman"));

    console.log("\n[14 — LLM evaluation inside Claude: Claude's tiers are the candidates]");
    await sp.evaluate(()=>{ window.__tiers=[];
      const f=async(input,o)=>{ const t=typeof input==="string"?input:JSON.stringify(input); window.__tiers.push({tier:o&&o.modelTier,eval:/You are evaluating LANGUAGE MODELS/.test(t)});
        return {text:/Reply with ONLY|JSON/.test(t)?"{}":'"Tamam." *Gülümsüyor.*',truncated:false}; };
      f.json=async(input,o)=>{ window.__tiers.push({tier:o&&o.modelTier,eval:true});
        return {models:[{label:"A",scores:{realism:6},overall:6,good:"quick",weak:"thin"},{label:"B",scores:{realism:7},overall:7,good:"steady",weak:"plain"},{label:"C",scores:{realism:9},overall:9,good:"alive",weak:"slow"}],best:"C",recommend:"Model C: the most alive",summary:"Model C wins."}; };
      AI.sample=f; NET.ok=false;
      const L=__PE.LLM; L.cfg.cands={}; L.cfg.scenes=["daily_text"]; L.cfg.eng=""; localStorage.setItem("pe_v1_llmcfg",JSON.stringify(L.cfg)); });
    await sp.click('#rtabs button[data-r="llm"]');
    const here=await sp.evaluate(()=>({c:__PE.llmCands("model"),box:document.querySelector("#llmKeyBox").textContent}));
    ok("without OpenRouter the roleplay setting compares Claude's three tiers", here.c.join()==="claude:quick,claude:default,claude:complex"&&/Runs here, with Claude/.test(here.box), JSON.stringify(here));
    await sp.evaluate(()=>__PE.runLlm());
    const le=await sp.evaluate(()=>({res:__PE.LLM.res,tiers:window.__tiers,html:document.querySelector("#llmResults").textContent}));
    const plays=le.tiers.filter(x=>!x.eval);
    ok("each tier played the scene through Claude, at its own tier", ["quick","default","complex"].every(t=>plays.filter(x=>x.tier===t).length===4), JSON.stringify(plays.map(x=>x.tier)));
    ok("and Claude compared them blind, naming the tiers again", le.tiers.some(x=>x.eval&&x.tier==="complex")&&/best: claude:complex/.test(le.html), le.html.slice(0,300));
    const forced=await sp.evaluate(()=>{ NET.ok=true; localStorage.setItem("pe_v1_orkey",JSON.stringify("sk-or-test")); localStorage.setItem("pe_v1_llmmode",JSON.stringify("claude"));
      __PE.LLM.cfg.cands={model:["x/rp-b"]}; const c=__PE.llmCands("model"); localStorage.setItem("pe_v1_llmmode",JSON.stringify("auto")); const auto=__PE.llmCands("model"); return {c,auto}; });
    ok("with a key saved, 'Claude, here' still runs on Claude's tiers (and automatic picks OpenRouter only when it answers)", forced.c.join()==="claude:quick,claude:default,claude:complex"&&forced.auto.indexOf("x/rp-b")>=0, JSON.stringify(forced));
    errs.push(...sErrs);
    await sctx.close();

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
