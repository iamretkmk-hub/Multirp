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
    if(body.model==="x/think-only"&&!(body.reasoning&&body.reasoning.enabled)) return r.fulfill({status:400,contentType:"application/json",
      body:JSON.stringify({error:{message:"Reasoning is mandatory for this endpoint and cannot be disabled.",code:400}})});
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
  /* NanoGPT, stood in for the same way: its model list and a chat endpoint, every request recorded. */
  const NANO={calls:[]};
  await ctx.route(/nano-gpt\.com/,async r=>{
    const url=r.request().url();
    if(/\/models/.test(url)) return r.fulfill({status:200,contentType:"application/json",body:JSON.stringify({data:[{id:"nano/rp-1"},{id:"nano/rp-2"}]})});
    const body=JSON.parse(r.request().postData()||"{}");
    NANO.calls.push({url,auth:r.request().headers()["authorization"]||"",body});
    await r.fulfill({status:200,contentType:"application/json",body:JSON.stringify({choices:[{message:{role:"assistant",content:'"Nano burada." *Gülüyor.*'},finish_reason:"stop"}]})});
  });
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
    ok("the analyst is told to find the cause, then take the best fix (remove, rewrite, move or add)",
       !!rev&&/HOW TO FIX — CAUSE FIRST, THEN THE BEST FIX/.test(JSON.stringify(rev.body.messages))&&/MOVE a piece/.test(JSON.stringify(rev.body.messages))&&/remove\|rewrite\|add/.test(JSON.stringify(rev.body.messages)));
    ok("each proposed edit shows what kind of change it is and how much text it adds or cuts",
       await pg.evaluate(()=>{ const t=(document.querySelector("#chat .chg")||{}).textContent||""; return /rewrite|remove|add/.test(t)&&/chars/.test(t); }));
    ok("the review was written by a Claude model", !!rev&&/Reply with ONLY this JSON/.test(JSON.stringify(rev.body.messages)), JSON.stringify(OR.calls.map(c=>c.body.model)));
    ok("the sandbox can reach nothing but OpenRouter, and only while a test is sending", await pg.evaluate(()=>{
      const A=__PE.relayAllowed, was=__PE.NET.allow;
      __PE.NET.allow=false; const idle=A("https://openrouter.ai/api/v1/chat/completions");
      __PE.NET.allow=true; const r={idle,or:A("https://openrouter.ai/api/v1/chat/completions"),other:A("https://evil.example/api"),
        lookalike:A("https://openrouter.ai.evil.example/api/v1/x"),plain:A("http://openrouter.ai/api/v1/x")};
      __PE.NET.allow=was; return !r.idle&&r.or&&!r.other&&!r.lookalike&&!r.plain; }));

    console.log("\n[9 — roleplay scenes: fewer, sharper, every turn through the real payload; judges score, they do not fix]");
    const seen=[]; OR.calls=[];
    const JUDGE=n=>JSON.stringify({turns:Array.from({length:n},(_,i)=>({verdict:i===1?"weak":"good",note:"t"+(i+1)})),
      criteria:{turkish:{score:6,note:"calques",evidence:"x"},memory:{score:4,note:"forgot",evidence:"y"},self:{score:8,note:"ok",evidence:"z"}},score:6,summary:"Held mostly; the memory slipped.",
      findings:[{criterion:"memory",turn:2,problem:"accepts an invented past",evidence:"Evet hatırlıyorum",cause:"frag:rp_memory says 'go along with the player'"}]});
    OR.answer=body=>{ const msgs=body.messages||[]; const last=String((msgs.slice(-1)[0]||{}).content||"");
      if(/You are JUDGING one test scene/.test(last)) return JUDGE((last.match(/^TURN \d+$/gm)||[]).length);
      seen.push(msgs.map(m=>m.content).join("\n")); return '"Hatırlamıyorum." *Gözlüğünü indiriyor.*'; };
    await pg.click('#rtabs button[data-r="tests"]');
    const sc9=await pg.evaluate(()=>({n:__PE.DRIFT_SCENES.length,ids:__PE.DRIFT_SCENES.map(x=>x.id),kinds:[...new Set(__PE.DRIFT_SCENES.map(x=>x.kind))].sort().join(","),
      multi:__PE.DRIFT_SCENES.filter(x=>(x.speakers||[]).length>1).map(x=>x.id),focus:__PE.DRIFT_SCENES.every(x=>Array.isArray(x.focus)&&x.focus.length),
      crit:__PE.CRITERIA.map(c=>c.id).join(",")}));
    ok("twelve sharper scenes instead of twenty-three", sc9.n===12, sc9.ids.join(","));
    ok("solo, several characters, text and heat are all played (gamemaster beats get the gamemaster payload)", sc9.kinds==="heat,multi,solo,text", sc9.kinds);
    ok("in the several-character scenes the husband answers too", sc9.multi.join()==="dinner,flirt_husband,after_dinner", sc9.multi.join());
    ok("one rubric for every scene, each naming what it presses on", sc9.focus&&sc9.crit==="turkish,meaning,character,pacing,self,surroundings,others,memory,agency,rules,blend", sc9.crit);
    const b9=await pg.evaluate(async()=>{ const S=__PE.DRIFT_SCENES, by=id=>S.find(x=>x.id===id), out={};
      for(const id of ["daily","flirt_alone","heat","after_nextday","after_days","memory_echo"]){ const sc=by(id);
        const p=await __PE.engCall("build",{kind:sc.kind,speakerId:sc.speaker,targetId:"__user__",scene:{chat:sc.chat,opener:sc.opener,setup:sc.setup||null,asOf:sc.asOf||null,turns:[{role:"user",content:typeof sc.lines[0]==="string"?sc.lines[0]:"x"}]}});
        out[id]=p.messages.map(m=>m.content).join("\n"); }
      return out; });
    ok("seduction happens at Emre's house", /Emre's House/.test(b9.flirt_alone), b9.flirt_alone.slice(0,300));
    ok("in the heat scene she knows she is fertile and off the pill", /fertile days/.test(b9.heat)&&/stopped taking the pill/.test(b9.heat)&&!/one full surrender/.test(b9.heat), b9.heat.slice(-1500));
    ok("the day after: her memory of it and her own decision are in the payload", /I ended up in his bed/.test(b9.after_nextday)&&/the one full surrender/.test(b9.after_nextday));
    ok("some days on: both times and her softer terms, not the first decision", /on day nine/.test(b9.after_days)&&/on your terms/.test(b9.after_days)&&!/the one full surrender/.test(b9.after_days));
    ok("when the past repeats, the memory of the first time is retrieved", /touched my waist/.test(b9.memory_echo)&&/Palmera/.test(b9.memory_echo), b9.memory_echo.slice(-1500));
    ok("no scene's setup leaks into another", !/ended up in his bed|fertile days/.test(b9.daily));
    await pg.evaluate(()=>__PE.runDriftScenes([__PE.DRIFT_SCENES.find(x=>x.id==="memory_truth")]));
    const d=await pg.evaluate(()=>({r:__PE.DR.results.memory_truth,html:document.querySelector("#dr_memory_truth").textContent}));
    ok("every scripted line was played, and every reply kept", d.r&&d.r.turns.length===4&&d.r.turns.every(t=>t.reply&&/Hatırlamıyorum/.test(t.reply))&&d.r.model==="deepseek/deepseek-v4-pro", JSON.stringify(d.r&&d.r.turns).slice(0,300));
    ok("each turn was built from the real payload, with the earlier replies in the transcript",
       seen.length===4&&/şamandıraya/.test(seen[0])&&/keşke evli olmasaydım/.test(seen[1])&&(seen[3].match(/Hatırlamıyorum\./g)||[]).length>=3, seen.map(x=>x.length).join(","));
    ok("the scene's own place is in the payload", /Big Özüçak's House/.test(seen[0]));
    const jin9=OR.calls.find(c=>c.claude&&/You are JUDGING one test scene/.test(c.body.messages[0].content)), jt9=jin9?jin9.body.messages[0].content:"";
    ok("Turkish is judged as a native would say it (words, register, sense in context, realism), not only grammar", /not as a grammar check/.test(jt9)&&/word choice/.test(jt9)&&/sense in context/.test(jt9)&&/what a native would say instead/.test(jt9)&&/the word a Turk would pick/.test(jt9), jt9.slice(0,200));
    ok("the judge scores the rubric (★ marks what the scene presses on) and is told not to fix", /★ memory/.test(jt9)&&/Do not propose fixes/.test(jt9)&&/HOW TO FIX — CAUSE FIRST, THEN THE BEST FIX/.test(jt9)&&/MOVE a piece/.test(jt9), jt9.slice(0,300));
    ok("its scores, findings and likely causes are shown, and no edit is offered on the scene", /Memory 4/.test(d.html)&&/accepts an invented past/.test(d.html)&&/likely cause/.test(d.html)
       &&await pg.evaluate(()=>!document.querySelector("#dr_memory_truth .chg")), d.html.slice(0,500));
    OR.calls=[]; seen.length=0;
    await pg.evaluate(()=>__PE.runDriftScenes([__PE.DRIFT_SCENES.find(x=>x.id==="flirt_husband")]));
    const fh=await pg.evaluate(()=>__PE.DR.results.flirt_husband);
    const rpCalls=OR.calls.filter(c=>!c.claude).map(c=>c.body.messages.map(m=>m.content).join("\n"));
    ok("several characters: each line is answered by Buket, then by Sami", fh.turns.length===6&&fh.turns.every(t=>t.replies.length===2&&t.replies[0].id==="p_buket"&&t.replies[1].id==="p_sami"), JSON.stringify(fh.turns.map(t=>(t.replies||[]).map(x=>x.id))));
    ok("…Sami's payload is his own and already holds Buket's reply to the same line", rpCalls.length===12&&/You are Sami/.test(rpCalls[1])&&(rpCalls[1].match(/Hatırlamıyorum/g)||[]).length>=1, rpCalls.length);
    ok("…and a gamemaster beat is answered through the gamemaster payload", fh.turns[2].gm&&(fh.turns[2].kinds||[]).indexOf("gm")>=0);

    console.log("\n[9b — results travel: export here, import and judge elsewhere]");
    const exported=await pg.evaluate(()=>{ const r=__PE.DR.results.memory_truth; return JSON.stringify({app:"StoryMind",kind:"drift-results",date:Date.now(),
      scenes:[{id:"memory_truth",title:"x",model:r.model,turns:r.turns,payload:r.payload,judge:null}]}); });
    await pg.evaluate(()=>{ __PE.DR.results={}; });
    await pg.setInputFiles("#fileDrift",{name:"drift.json",mimeType:"application/json",buffer:Buffer.from(exported)});
    await pg.waitForTimeout(400);
    const imp9=await pg.evaluate(()=>({n:(__PE.DR.results.memory_truth||{}).turns&&__PE.DR.results.memory_truth.turns.length,btn:!!document.querySelector("#dr_memory_truth button.pri")}));
    ok("an exported run imports, with a Judge button", imp9.n===4&&imp9.btn, JSON.stringify(imp9));
    OR.calls=[];
    await pg.evaluate(()=>__PE.analyseDrift([__PE.DRIFT_SCENES.find(x=>x.id==="memory_truth")]));
    ok("judging sends it to Claude only, never back to the model", OR.calls.length===1&&OR.calls[0].claude
       &&await pg.evaluate(()=>!!__PE.DR.results.memory_truth.judge), JSON.stringify(OR.calls.map(c=>c.body.model)));

    console.log("\n[10 — engine tests: their own tab, purpose-built scenes, scripted exchanges]");
    OR.calls=[];
    OR.answer=body=>{ const all=JSON.stringify(body.messages||[]);
      if(/You are JUDGING one BACKGROUND ENGINE/.test(all)){ const k=(all.match(/prompt key \\"([A-Za-z0-9_]+)\\"/)||[])[1]||"";
        return JSON.stringify({verdict:k==="memBuild"?"issues":"good",summary:"s",problems:k==="memBuild"?[{issue:"kept the maybe",evidence:"belki",cause:"no rule on changed plans"}]:[]}); }
      if(/COMPLETE ANALYSIS of the BACKGROUND ENGINES/.test(all)){ const c0=String(body.messages[0].content), at=c0.indexOf("===== prompt:memBuild ====="), f=at<0?"":(c0.slice(at).split("\n").slice(1).find(l=>l.trim().length>=30)||"").trim().slice(0,50);
        return JSON.stringify({score:6,summary:"plans mostly right",scenes:[{scene:"Plans that change their mind (meetings and promises)",outcome:"partly",note:"the maybe stuck"}],patterns:[{engine:"memBuild",pattern:"keeps a maybe",cause:"c"}],
          edits:[{item:"prompt:memBuild",kind:"rewrite",find:f,replace:f+" PE-ENGINE-FIX",cause:"c",why:"w",helps:["memBuild"]}]}); }
      const sys=String(((body.messages||[])[0]||{}).content||"");
      return /JSON/i.test(sys)?"{}":'"Tamam." *Başını sallıyor.*'; };
    await pg.evaluate(()=>{ localStorage.setItem("pe_v1_testmode",JSON.stringify("or")); localStorage.setItem("pe_v1_seleng",JSON.stringify(["plans"])); localStorage.setItem("pe_v1_engpreset",JSON.stringify("plans")); localStorage.setItem("pe_v1_engscript",JSON.stringify("")); });
    await pg.click('#rtabs button[data-r="eng"]');
    const ui10=await pg.evaluate(()=>({tab:getComputedStyle(document.querySelector("#rEngT")).display,inTests:!!document.querySelector("#rTests #engList"),n:__PE.ENGINE_SCENES.length,
      script:document.querySelector("#engScript").value}));
    ok("engine tests have their own tab, apart from the roleplay tests", ui10.tab==="flex"&&!ui10.inTests&&ui10.n===8, JSON.stringify({tab:ui10.tab,inTests:ui10.inTests,n:ui10.n}));
    ok("the lines read as a script: the player, the characters' scripted replies, gamemaster beats", /^Emre: Cumartesi akşamı/m.test(ui10.script)&&/^Sami: Bakarız abi, belki/m.test(ui10.script)&&/^Buket: Dur, şimdi hatırladım/m.test(ui10.script), ui10.script.slice(0,300));
    await pg.evaluate(()=>__PE.runEngineTests());
    await pg.waitForFunction(()=>!__PE.ENGALL.running,null,{timeout:400000});
    const er=await pg.evaluate(()=>({groups:__PE.engGroups().map(g=>({k:g.key,n:g.calls.length,err:g.calls.filter(c=>c.error).length})),judged:Object.keys(__PE.ENGRUN.judge).length,
      ins:__PE.ENGRUN.calls.map(c=>c.messages.map(m=>m.content).join("\n")),rp:__PE.ENGRUN.calls.filter(c=>c.rp).length,
      box:(document.querySelector("#engOverallBox")||{}).textContent||""}));
    const keys=er.groups.map(g=>g.k);
    ok("the scripted exchanges and End Day fire the background engines", er.groups.length>=10, keys.join(" "));
    ["memBuild","relPrompt","daySummaryPrompt","goalsCurator"].forEach(k=>ok("…including "+k, keys.indexOf(k)>=0, keys.join(" ")));
    ok("no engine call failed", er.groups.every(g=>g.err===0), JSON.stringify(er.groups.filter(g=>g.err)));
    ok("the engines read the scripted words exactly (the maybe, the no, the yes, the cancelled lift)", er.ins.some(t=>/Bakarız abi, belki/.test(t)&&/Tamam be abi, ikna ettin/.test(t)&&/Gelemem, kusura bakma/.test(t)), er.ins.length);
    ok("only the last, unscripted line was answered by your model", er.rp>=1&&er.rp<=3, er.rp);
    const ej=OR.calls.find(c=>c.claude&&/You are JUDGING one BACKGROUND ENGINE/.test(c.body.messages[0].content)), ejt=ej?ej.body.messages[0].content:"";
    ok("each engine is judged knowing the scene's purpose and that the script is known", ej&&/WHAT THE SCENE WAS BUILT TO TEST/.test(ejt)&&/recorded as agreed only from the moment Sami says yes/.test(ejt)&&/Lines with a character's name were scripted/.test(ejt)&&/Do not propose fixes/.test(ejt));
    ok("Claude judged every engine", er.judged===er.groups.length, er.judged+" of "+er.groups.length);
    const efin=OR.calls.find(c=>c.claude&&/COMPLETE ANALYSIS of the BACKGROUND ENGINES/.test(c.body.messages[0].content));
    ok("then one complete engine analysis reads every scene's purpose, script and judgements, with the prompts' text", !!efin&&/PURPOSE:/.test(efin.body.messages[0].content)&&/===== prompt:memBuild =====/.test(efin.body.messages[0].content));
    ok("its verdict and its edits show in the engine tab", /Complete engine analysis/.test(er.box)&&/the maybe stuck/.test(er.box), er.box.slice(0,300));
    const eap=await pg.evaluate(()=>{ const b=document.querySelector('#engOverallBox .chg [data-a="apply"]'); if(!b||b.disabled) return {ok:false,b:!!b,t:b&&b.textContent,card:((document.querySelector('#engOverallBox .chg')||{}).textContent||"").slice(0,300),ed:JSON.stringify((__PE.ENGALL.overall||{}).edits||null).slice(0,300)}; b.click(); return {ok:/PE-ENGINE-FIX/.test(__PE.itemVal(__PE.findItem("prompt:memBuild")))}; });
    ok("and its edit applies to the engine's prompt", eap.ok, JSON.stringify(eap));
    ok("the sandbox is back to the untouched sample afterwards", await pg.evaluate(async()=>{ const p=await __PE.engCall("build",{kind:"solo"}); return p.messages.filter(m=>m.hist).length>=3; }));

    console.log("\n[10b — Claude stands in: every call goes to Claude]");
    OR.calls=[];
    await pg.evaluate(()=>{ localStorage.setItem("pe_v1_testmode",JSON.stringify("claude")); document.querySelector("#engEndDay").checked=false; document.querySelector("#engScript").value="Emre: Merhaba Buket."; });
    await pg.evaluate(()=>__PE.runEngines());
    await pg.waitForFunction(()=>!__PE.ENGRUN.running,null,{timeout:300000});
    ok("with Claude standing in, every call (reply, engines, judges) went to Claude", OR.calls.length>3&&OR.calls.every(c=>c.claude), JSON.stringify([...new Set(OR.calls.map(c=>c.body.model))]));
    await pg.evaluate(()=>{ localStorage.setItem("pe_v1_testmode",JSON.stringify("or")); document.querySelector("#engEndDay").checked=true; });

    console.log("\n[11 — one roleplay run, then one complete analysis that may move pieces]");
    OR.calls=[];
    const soloTpl=await pg.evaluate(()=>__PE.itemVal(__PE.findItem("tpl:solo")));
    OR.answer=body=>{ const all=JSON.stringify(body.messages||[]), first=String(((body.messages||[])[0]||{}).content||"");
      if(/COMPLETE ANALYSIS of a test run/.test(first)) return JSON.stringify({score:6,summary:"s",criteria:{memory:4},patterns:[{criterion:"memory",pattern:"the past is buried",scenes:["Loyal to what happened"],cause:"x"}],
        structure:["The trackers sit far from the reply"],
        edits:[{item:"tpl:solo",kind:"move",find:"{{call//trackers//full}}",before:"{{call//drives//full}}",cause:"buried",why:"nearer the reply",helps:["self"],risks:"none"},
               {item:"frag:style_header",kind:"rewrite",cause:"c",find:"PE-REVIEWED",replace:"PE-ALL-FIX",why:"w",helps:["turkish","meaning"],risks:"none"}]});
      if(/You are JUDGING one test scene/.test(first)) return JUDGE((first.match(/^TURN \d+$/gm)||[]).length);
      const sys=String(((body.messages||[])[0]||{}).content||""); return /JSON/i.test(sys)?"{}":'"Tamam." *Gülümsüyor.*'; };
    await pg.evaluate(()=>{ localStorage.setItem("pe_v1_selreply",JSON.stringify(["text_night","dinner"])); });
    await pg.click('#rtabs button[data-r="tests"]');
    OR.peak=0; OR.delay=body=>/You are JUDGING/.test(JSON.stringify(body.messages||[]))?400:0;
    const est=await pg.evaluate(()=>document.querySelector("#allEstimate").textContent);
    ok("the estimate counts the replies of every speaker", /2 scenes \(12 replies\)/.test(est), est);
    await pg.evaluate(()=>__PE.runEverything());
    const all=await pg.evaluate(()=>({tn:__PE.DR.results.text_night,dn:__PE.DR.results.dinner,overall:__PE.ALL.overall,engRan:Object.keys(__PE.ENGRUN.byScene).length,
      box:(document.querySelector("#overallBox")||{}).textContent||""}));
    OR.delay=null;
    ok("both scenes were played and judged, and no engine scene ran with them", all.tn&&all.tn.judge&&all.dn&&all.dn.judge&&all.engRan===1, JSON.stringify({tn:!!(all.tn&&all.tn.judge),dn:!!(all.dn&&all.dn.judge),eng:all.engRan}));
    ok("the judges read the scenes at the same time", OR.peak>=2, OR.peak);
    const fin=OR.calls.find(c=>c.claude&&/COMPLETE ANALYSIS of a test run/.test(c.body.messages[0].content)), ft=fin?fin.body.messages[0].content:"";
    ok("the complete analysis reads every scene, the rubric, the layouts and the full text of every piece", !!fin&&/Texting at night/.test(ft)&&/Dinner with Sami/.test(ft)&&/THE RUBRIC ACROSS THIS RUN/.test(ft)&&/- memory \(Memory\): 4/.test(ft)
       &&/===== tpl:solo =====/.test(ft)&&/===== frag:style_header =====/.test(ft)&&/"move"/.test(ft), ft.slice(0,300));
    ok("its verdict shows the rubric, the structure notes and the edits", /Complete analysis/.test(all.box)&&/Memory/.test(all.box)&&/The trackers sit far from the reply/.test(all.box)&&/Moves/.test(all.box), all.box.slice(0,400));
    const mv=await pg.evaluate(()=>{ const cards=[...document.querySelectorAll('#overallBox .chg')]; const c=cards.find(x=>/Moves/.test(x.textContent)); const b=c&&c.querySelector('[data-a="apply"]'); if(!b||b.disabled) return {ok:false,c:!!c,t:b&&b.textContent,v:__PE.itemVal(__PE.findItem("tpl:solo")).split("\n").filter(l=>/trackers|drives/.test(l))};
      b.click(); const v=__PE.itemVal(__PE.findItem("tpl:solo")).split("\n").map(l=>l.trim()); const i=v.indexOf("{{call//trackers//full}}"), j=v.indexOf("{{call//drives//full}}");
      return {ok:true,i,j,label:b.textContent,undo:!c.querySelector('[data-a="undo"]').hidden}; });
    ok("a move edit takes the line out and puts it right before the named one", mv.ok&&mv.i===mv.j-1&&mv.label==="Applied"&&mv.undo, JSON.stringify(mv));
    const mvu=await pg.evaluate(soloTpl=>{ const c=[...document.querySelectorAll('#overallBox .chg')].find(x=>/Moves/.test(x.textContent)); c.querySelector('[data-a="undo"]').click(); return __PE.itemVal(__PE.findItem("tpl:solo"))===soloTpl; },soloTpl);
    ok("…and Undo puts the layout back exactly", mvu);
    ok("a rewrite edit applies once, and survives the list being rebuilt", await pg.evaluate(()=>{ const c=[...document.querySelectorAll('#overallBox .chg')].find(x=>/PE-ALL-FIX/.test(x.textContent)); const b=c&&c.querySelector('[data-a="apply"]'); if(!b||b.disabled) return false; b.click();
      __PE.renderEstimate(); const b2=[...document.querySelectorAll('#overallBox .chg')].find(x=>/PE-ALL-FIX/.test(x.textContent)).querySelector('[data-a="apply"]');
      return b2.textContent==="Applied"&&b2.disabled&&(__PE.itemVal(__PE.findItem("frag:style_header")).match(/PE-ALL-FIX/g)||[]).length===1; }));
    OR.calls=[];
    await pg.evaluate(()=>__PE.analyseEverything());
    const fin2=OR.calls.find(c=>c.claude&&/COMPLETE ANALYSIS of a test run/.test(c.body.messages[0].content)), ft2=fin2?fin2.body.messages[0].content:"";
    ok("the next analysis sees the earlier run and the edits applied since", /EARLIER RUNS/.test(ft2)&&/edits applied after it/.test(ft2)&&/PE-ALL-FIX/.test(ft2)&&/previous run 4/.test(ft2), ft2.slice(ft2.indexOf("EARLIER RUNS"),ft2.indexOf("EARLIER RUNS")+600));
    const hist=await pg.evaluate(()=>({h:JSON.parse(localStorage.getItem("pe_v1_runhist")||"[]").length,box:(document.querySelector("#overallBox")||{}).textContent||""}));
    ok("each run is kept, and the table shows the change from the previous run", hist.h>=2&&/previous/.test(hist.box), JSON.stringify({h:hist.h}));

    const beforeImp=await pg.evaluate(()=>!!__PE.ALL.overall&&!!document.querySelector("#overallBox .scene"));
    const mtImp=await pg.evaluate(()=>__PE.DR.results.memory_truth);
    const set2Imp={app:"StoryMind",kind:"test-results",date:Date.now(),scenes:[{id:"daily",title:"x",model:"m",at:Date.now(),turns:[{user:"a",reply:"b"}],payload:null,judge:null},Object.assign({id:"memory_truth",title:"Loyal"},mtImp)],engines:{}};
    await pg.setInputFiles('#fileDrift',{name:"storymind_tests_new.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(set2Imp))});
    await pg.waitForTimeout(500);
    const afterImp=await pg.evaluate(()=>({overall:__PE.ALL.overall,box:!!document.querySelector("#overallBox .scene"),ids:Object.keys(__PE.DR.results),eng:Object.keys(__PE.ENGRUN.byScene)}));
    ok("importing a new test set replaces the old results and clears the old complete analysis", beforeImp&&afterImp.overall===null&&!afterImp.box&&afterImp.ids.join()==="daily,memory_truth"&&afterImp.eng.length===0, JSON.stringify(afterImp).slice(0,300));

    console.log("\n[11b — model rotation: two models take turns on the roleplay replies, and the analysis judges how they go together]");
    OR.calls=[];
    OR.answer=body=>{ const first=String(((body.messages||[])[0]||{}).content||"");
      if(/COMPLETE ANALYSIS of a test run/.test(first)) return JSON.stringify({score:6,summary:"s",criteria:{blend:5},patterns:[],structure:[],edits:[],
        rotation:{blend:"PE-BLEND the second model is wordier",models:[{model:"x/rp-a",good:"terse",weak:"flat"},{model:"x/rp-b",good:"warm",weak:"long"}],keep:"keep both"}});
      if(/You are JUDGING one test scene/.test(first)){ const j=JSON.parse(JUDGE((first.match(/^TURN \d+$/gm)||[]).length)); j.criteria.blend={score:5,note:"jumps",evidence:"x"}; return JSON.stringify(j); }
      return /JSON/i.test(first)?"{}":'"Tamam." *Gülümsüyor.*'; };
    const rb=await pg.evaluate(()=>{ localStorage.setItem("pe_v1_testmode",JSON.stringify("or")); localStorage.setItem("pe_v1_testrotation_or",JSON.stringify("x/rp-a, x/rp-b")); renderProvider();
      return {rot:testRotation(),box:document.querySelector("#driftModelBox").textContent,label:testLabel()}; });
    ok("a rotation of two or more models can be set for the model under test", rb.rot.join()==="x/rp-a,x/rp-b"&&/Rotation on/.test(rb.box)&&/rotating x\/rp-a → x\/rp-b/.test(rb.label), JSON.stringify(rb).slice(0,300));
    await pg.evaluate(()=>__PE.runDriftScenes([__PE.DRIFT_SCENES.find(x=>x.id==="text_night")]));
    const rr=await pg.evaluate(()=>{ const r=__PE.DR.results.text_night; return {models:r.turns.map(t=>t.replies[0].model),rotation:r.rotation,chips:[...document.querySelectorAll("#dr_text_night .rp .chip")].map(c=>c.textContent)}; });
    const sent=OR.calls.filter(c=>!c.claude).map(c=>c.body.model);
    ok("each reply goes to the next model in turn, starting from the first", sent.join()==="x/rp-a,x/rp-b,x/rp-a,x/rp-b"&&rr.models.join()===sent.join(), JSON.stringify({sent,models:rr.models}));
    ok("each reply shows the model that wrote it", rr.chips.join()==="x/rp-a,x/rp-b,x/rp-a,x/rp-b", rr.chips.join());
    const jr=OR.calls.find(c=>c.claude&&/You are JUDGING one test scene/.test(c.body.messages[0].content)), jrt=jr?jr.body.messages[0].content:"";
    ok("the judge sees which model wrote each reply and scores how the models go together", /MODEL ROTATION: the replies rotate between these models: x\/rp-a, x\/rp-b/.test(jrt)&&/\[model: x\/rp-b\]/.test(jrt)&&/blend — Rotating models go together/.test(jrt), jrt.slice(0,200));
    await pg.evaluate(()=>__PE.analyseTogether());
    const orr=OR.calls.find(c=>c.claude&&/COMPLETE ANALYSIS of a test run/.test(c.body.messages[0].content)), ort=orr?orr.body.messages[0].content:"";
    ok("the complete analysis is told about the rotation, with each model's replies and speed", /===== MODEL ROTATION =====/.test(ort)&&/- x\/rp-b: 2 replies, average/.test(ort)&&/how they go along together/.test(ort), ort.slice(ort.indexOf("MODEL ROTATION")-20,ort.indexOf("MODEL ROTATION")+400));
    const ob=await pg.evaluate(()=>({box:(document.querySelector("#overallBox")||{}).textContent||"",model:__PE.ALL.overall.model}));
    ok("its verdict on the rotation is shown, with the rubric's blend row", /Model rotation\./.test(ob.box)&&/PE-BLEND/.test(ob.box)&&/Rotating models go together/.test(ob.box)&&/rotating x\/rp-a → x\/rp-b/.test(ob.model), ob.box.slice(0,300));
    const ro=await pg.evaluate(()=>{ localStorage.setItem("pe_v1_testrotation_or",JSON.stringify("x/rp-a")); const one=testRotation().length; localStorage.setItem("pe_v1_testrotation_or",JSON.stringify("")); renderProvider();
      const sc=__PE.CRITERIA.filter(c=>c.rotation).length; return {one,off:testRotation().length,crit:sc}; });
    ok("one model, or none, is no rotation", ro.one===0&&ro.off===0&&ro.crit===1, JSON.stringify(ro));

    console.log("\n[11c — a long run still fits one request to Claude, and a failed fixing step can be run again]");
    const fit=await pg.evaluate(async()=>{ const P=__PE, long="Şöyle düşünüyorum, ağabeyciğim: gülüşün öğleden beri aklımdan çıkmıyor, işte böyle. ".repeat(40);
      const keep=JSON.stringify(P.DR.results), keepO=P.ALL.overall;
      P.DRIFT_SCENES.forEach(sc=>{ const sp=(sc.speakers||[sc.speaker]);
        P.DR.results[sc.id]={at:Date.now(),model:"m",payload:null,turns:sc.lines.map(l=>({user:typeof l==="string"?l:l.gm,gm:typeof l!=="string",reply:long,replies:sp.map(id=>({id,name:id,text:long}))})),
          judge:{score:5,summary:"s",criteria:{turkish:{score:5,note:"n",evidence:"e"}},turns:sc.lines.map(()=>({verdict:"weak",note:"n"})),findings:[{criterion:"turkish",turn:1,problem:"p",evidence:"e",cause:"c"}]}}; });
      const huge=P.apBuild("overseer",{scenes:"Şöyle düşünüyorum ğüşıöç. ".repeat(9000),pieces:P.overallInput().pieces,layouts:P.overallInput().layouts,payload:"ğ".repeat(60000),scores:"x"});
      const rawBytes=P.apBytes("Şöyle düşünüyorum ğüşıöç. ".repeat(9000))+P.apBytes("ğ".repeat(60000)), hugeOk=P.apBytes(huge)<=P.AP_CAP&&/Reply with ONLY this JSON/.test(huge)&&/===== tpl:solo =====/.test(huge)&&/cut here to fit/.test(huge);
      let sent=null, calls=0; const orig=AI.sample.json;
      AI.sample.json=async(input)=>{ calls++; sent=input; if(calls===1) throw {code:"prompt_too_large",message:"too big"}; return {score:6,summary:"PE-FIXED",criteria:{},patterns:[],structure:[],edits:[]}; };
      await P.writeFixesAlone();
      const failBox=(document.querySelector("#overallBox")||{}).textContent||"", btn=document.querySelector("#overallBox [data-refix]");
      const first=sent; btn&&btn.click(); for(let i=0;i<50&&!(P.ALL.overall&&P.ALL.overall.summary==="PE-FIXED");i++) await new Promise(r=>setTimeout(r,100));
      const okBox=(document.querySelector("#overallBox")||{}).textContent||"";
      AI.sample.json=orig;
      const eng=P.apBuild("engfinal",{scenes:"ş".repeat(150000),prompts:"ğ".repeat(150000),applied:""});
      const res={rawBytes,hugeOk,bytes:P.apBytes(first),cap:P.AP_CAP,titles:P.DRIFT_SCENES.every(sc=>first.indexOf(sc.title)>=0),json:/Reply with ONLY this JSON/.test(first),solo:/===== tpl:solo =====/.test(first),
        failBox:/The complete analysis failed/.test(failBox)&&/256 KB/.test(failBox)&&!!btn,fixed:/PE-FIXED/.test(okBox),calls,engBytes:P.apBytes(eng),engJson:/Reply with ONLY this JSON/.test(eng)&&/cut here to fit/.test(eng)};
      P.DR.results=JSON.parse(keep); P.ALL.overall=keepO; return res; });
    ok("a complete analysis whose data is far over the limit is cut to fit, keeping the instructions, the layouts and the reply format", fit.rawBytes>fit.cap&&fit.hugeOk, JSON.stringify({raw:fit.rawBytes,cap:fit.cap,ok:fit.hugeOk}));
    ok("…and the complete analysis sent to Claude stays under it, with every scene, the layouts and the reply format", fit.bytes<=fit.cap&&fit.titles&&fit.json&&fit.solo, JSON.stringify({bytes:fit.bytes,titles:fit.titles,json:fit.json,solo:fit.solo}));
    ok("a failed fixing step stays on screen with its reason and a button to write the fixes again", fit.failBox, JSON.stringify(fit));
    ok("…which runs only the complete analysis and shows its fixes", fit.fixed&&fit.calls===2, JSON.stringify({fixed:fit.fixed,calls:fit.calls}));
    ok("the complete engine analysis is fitted the same way", fit.engBytes<=fit.cap&&fit.engJson, JSON.stringify({b:fit.engBytes,j:fit.engJson}));

    console.log("\n[12 — LLM evaluation: models compared on fixed prompts, no prompt edits]");
    OR.calls=[];
    OR.answer=body=>{ const all=JSON.stringify(body.messages||[]);
      if(/You are evaluating LANGUAGE MODELS/.test(all)) return JSON.stringify({models:[{label:"A",scores:{realism:6},overall:6,good:"steady",weak:"flat"},{label:"B",scores:{realism:8},overall:8,good:"lively",weak:"long"}],
        best:"B",recommend:"Model B: livelier and in character",summary:"Model A is safe; Model B is better."});
      const sys=String(((body.messages||[])[0]||{}).content||""); return /JSON/i.test(sys)?"{}":'"Tamam." *Gülümsüyor.*'; };
    const mf=await pg.evaluate(()=>{ const f=__PE.MODEL_FIELDS.map(x=>x.key); const e=__PE.effectiveModels(); return {f,e}; });
    ok("one entry per text-model setting in StoryMind's Settings", ["model","mcModel","memModel","gmModel","rewriter","routerModel","bioModel","authorModel","gossipModel","playerNarrateModel","callModel"].every(k=>mf.f.indexOf(k)>=0), mf.f.join(","));
    ok("each starts from the model in the prompts file (blank ones use their fallback)", !!mf.e.model&&!!mf.e.memModel&&mf.e.gossipModel===(mf.e.gossipModel||mf.e.memModel), JSON.stringify(mf.e).slice(0,300));
    await pg.evaluate(()=>{ const L=__PE.LLM; L.cfg.cands={model:["x/rp-b"],memModel:["x/mem-b"]}; L.cfg.scenes=["text_night"]; L.cfg.eng="comings"; L.cfg.per=2;
      localStorage.setItem("pe_v1_llmcfg",JSON.stringify(L.cfg)); });
    await pg.click('#rtabs button[data-r="llm"]');
    const ui=await pg.evaluate(()=>({fields:document.querySelectorAll("#llmFields [data-f]").length,est:document.querySelector("#llmEstimate").textContent}));
    ok("the tab lists every setting with its candidates", ui.fields===mf.f.length, JSON.stringify(ui));
    await pg.evaluate(()=>__PE.runLlm());
    const ev=await pg.evaluate(()=>{ const R=__PE.LLM.res; return {tm:testModel(),rp:R.fields.model,mem:R.fields.memModel,html:document.querySelector("#llmResults").textContent,apply:document.querySelectorAll("#llmResults [data-a=apply]").length}; });
    const rpModels=new Set(OR.calls.filter(c=>!/LANGUAGE MODELS/.test(JSON.stringify(c.body.messages))).map(c=>c.body.model));
    ok("the roleplay candidate played the scene itself", rpModels.has("x/rp-b")&&ev.rp&&ev.rp.runs.text_night["x/rp-b"].length===4&&ev.rp.runs.text_night[ev.tm].length===4, [...rpModels].join(", "));
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
    console.log("\n[12b — NanoGPT: the model under test on NanoGPT, and NanoGPT candidates]");
    await pg.click('#rtabs button[data-r="tests"]');
    const nb=await pg.evaluate(async()=>{ localStorage.setItem("pe_v1_testmode",JSON.stringify("nano")); localStorage.setItem("pe_v1_nanokey",JSON.stringify("nano-key-123"));
      localStorage.setItem("pe_v1_testmodel_nano",JSON.stringify("nano/rp-1")); await nanoProbe(); renderProvider(); await pushModelToEngine();
      return {mode:testMode(),can:canTest(),label:testLabel(),box:document.querySelector("#driftModelBox").textContent,list:[...document.querySelectorAll("#pmModels option")].map(o=>o.value)}; });
    ok("NanoGPT is a choice for the model under test, with its own key and model list", nb.mode==="nano"&&nb.can&&/NanoGPT/.test(nb.label)&&/your model on NanoGPT/.test(nb.box)&&nb.list.indexOf("nano/rp-2")>=0, JSON.stringify(nb).slice(0,300));
    NANO.calls=[]; const orBefore=OR.calls.filter(c=>!c.claude).length;
    const nr=await pg.evaluate(async()=>{ await __PE.refreshPreview(); return await generateReply(__PE.S.preview); });
    const nc=NANO.calls[0];
    ok("a reply to the payload is sent to NanoGPT by StoryMind's own request, with the NanoGPT key and model", /Nano burada/.test(nr)&&!!nc&&/nano-gpt\.com\/api\/v1\/chat\/completions/.test(nc.url)&&nc.auth==="Bearer nano-key-123"&&nc.body.model==="nano/rp-1"&&!nc.body.provider&&!nc.body.reasoning&&OR.calls.filter(c=>!c.claude).length===orBefore,
       JSON.stringify(nc&&{url:nc.url,auth:nc.auth,model:nc.body.model,keys:Object.keys(nc.body)}));
    NANO.calls=[];
    const nl=await pg.evaluate(async()=>{ localStorage.setItem("pe_v1_llmmode",JSON.stringify("auto")); const L=__PE.LLM; L.cfg.cands={model:["nano:nano/rp-2","openrouter:x/rp-b"]}; L.cfg.scenes=["text_night"]; L.cfg.eng=""; localStorage.setItem("pe_v1_llmcfg",JSON.stringify(L.cfg));
      return {c:__PE.llmCands("model")}; });
    ok("LLM evaluation candidates can name their API (nano:…, openrouter:…)", nl.c.join()==="nano/rp-1,nano:nano/rp-2,openrouter:x/rp-b", JSON.stringify(nl));
    const orN=OR.calls.filter(c=>!c.claude&&c.body.model==="x/rp-b").length;
    await pg.evaluate(()=>__PE.runLlm());
    ok("…and each one is sent to its own API", NANO.calls.filter(c=>c.body.model==="nano/rp-2").length===4&&NANO.calls.filter(c=>c.body.model==="nano/rp-1").length===4&&OR.calls.filter(c=>!c.claude&&c.body.model==="x/rp-b").length-orN===4,
       JSON.stringify({nano:NANO.calls.map(c=>c.body.model),or:OR.calls.filter(c=>!c.claude).slice(-6).map(c=>c.body.model)}));
    await pg.evaluate(()=>{ localStorage.setItem("pe_v1_testmode",JSON.stringify("or")); renderProvider(); });
    const ll=await pg.evaluate(()=>({html:document.querySelector("#llmResults").textContent}));
    const jin=OR.calls.filter(c=>c.claude&&/You are evaluating LANGUAGE MODELS/.test(JSON.stringify(c.body.messages))).pop();
    ok("the comparison is told each model's measured response time, and scores speed", !!jin&&/MEASURED RESPONSE TIME/.test(jin.body.messages[0].content)&&/Model A: average \d/.test(jin.body.messages[0].content)&&/- speed \(/.test(jin.body.messages[0].content), jin?jin.body.messages[0].content.slice(0,200):"none");
    ok("the results show each model's response time", /Response time/.test(ll.html)&&/avg/.test(ll.html)&&/time \(avg\)/.test(ll.html), ll.html.slice(0,300));

    console.log("\n[12d — Claude never runs on a paid API from the editor]");
    OR.calls=[];
    const pc=await pg.evaluate(async()=>{ NET.allow=true; let err="";
      try{ await __PE.engCall("complete",{messages:[{role:"user",content:"hi"}],model:"anthropic/claude-opus-4.5",prov:"or"},30000); }catch(e){ err=String(e.message||e); } NET.allow=false;
      return {err,listed:NET.models.filter(m=>/claude|anthropic/i.test(m))}; });
    ok("a Claude model is refused before anything is sent, and never listed", !!pc.err&&OR.calls.filter(c=>!c.claude).length===0&&pc.listed.length===0, JSON.stringify(pc));
    console.log("\n[12c — models that only work with reasoning]");
    OR.calls=[];
    const th=await pg.evaluate(async()=>{ localStorage.setItem("pe_v1_testmodel",JSON.stringify("x/think-only")); await pushModelToEngine();
      const out=await generateReply(__PE.S.preview); const out2=await generateReply(__PE.S.preview); return {out,out2}; });
    const tc=OR.calls.filter(c=>c.body.model==="x/think-only");
    ok("a model that refuses reasoning off is sent again with reasoning on, and remembered", tc.length===3&&tc[0].body.reasoning&&tc[0].body.reasoning.enabled===false&&tc[1].body.reasoning.enabled===true&&tc[2].body.reasoning.enabled===true&&!!th.out&&!!th.out2,
       JSON.stringify(tc.map(c=>c.body.reasoning)));
    OR.calls=[];
    await pg.evaluate(async()=>{ localStorage.setItem("pe_v1_testmodel",JSON.stringify("deepseek/deepseek-v4-pro")); localStorage.setItem("pe_v1_testreasoning",JSON.stringify(true)); renderProvider(); await pushModelToEngine(); await generateReply(__PE.S.preview); });
    const rc=OR.calls.filter(c=>!c.claude).pop();
    ok("the thinking switch turns reasoning on for the model under test", !!rc&&rc.body.reasoning&&rc.body.reasoning.enabled===true, JSON.stringify(rc&&rc.body.reasoning));
    await pg.evaluate(async()=>{ localStorage.setItem("pe_v1_testreasoning",JSON.stringify(false)); await pushModelToEngine(); });

    console.log("\n[15 — the analyst prompts: shown, editable, used15]");
    const apx=await pg.evaluate(()=>{ const P=__PE;
      const base={context:"CTX",title:"T",tests:"x",kind:"k",facts:"f",expect:"e",criteria:"C",exchange:"E",payload:"PL",rotation:""};
      const sc=P.apFill(P.apText("scene"),Object.assign({},base,{applied:""})), sc2=P.apFill(P.apText("scene"),Object.assign({},base,{applied:"- frag:x: «a» → «b»"}));
      const rv=P.apFill(P.apText("review"),{context:"CTX",payload:"PL",reply:"R",catalogue:"C"});
      return {ids:P.AP_DEFS.map(d=>d.id),ctxKeeps:/\{\{call\/\/piece\}\}/.test(P.apText("context"))&&/\{\{name\}\} values/.test(P.apText("context")),
        noApplied:!/CHANGES APPLIED SINCE/.test(sc),applied:/CHANGES APPLIED SINCE THIS SCENE WAS PLAYED/.test(sc2)&&/frag:x/.test(sc2),left:/\{\{[#^\/]/.test(sc+sc2)||/\{\{(title|exchange|payload|criteria)\}\}/.test(sc+sc2),
        keepsMarkers:/Keep \{\{…\}\} and \[\[…\]\] markers intact/.test(rv)}; });
    ok("every prompt sent to Claude is listed (method, ask, review, scene, engine, complete analyses, compare, stand-in)", apx.ids.join()==="context,ask,review,scene,engine,overseer,engfinal,compare,standin", apx.ids.join());
    ok("templates fill their data and flags, and leave the app's own {{…}} markers alone", apx.ctxKeeps&&apx.noApplied&&apx.applied&&!apx.left&&apx.keepsMarkers, JSON.stringify(apx));
    await pg.click('#rtabs button[data-r="ap"]');
    await pg.evaluate(()=>{ const ta=document.querySelector('#apList [data-ap="scene"] textarea'); ta.value=ta.value.replace("You are JUDGING one test scene","PE-AP-EDIT You are JUDGING one test scene"); ta.dispatchEvent(new Event("input")); });
    await pg.waitForTimeout(700);
    OR.calls=[];
    await pg.evaluate(async()=>{ const sc=__PE.DRIFT_SCENES.find(x=>x.id==="memory_truth"); __PE.DR.results[sc.id].judge=null; await __PE.analyseDrift([sc]); });
    const used15=OR.calls.find(c=>c.claude&&/You are JUDGING one test scene/.test(c.body.messages[0].content));
    const ui15=await pg.evaluate(()=>{ __PE.renderAp(); const el=document.querySelector('#apList [data-ap="scene"]'); return {chip:/edited/.test(el.querySelector("h3").textContent),last:el.querySelector("pre").textContent}; });
    ok("an edit is used by the next analysis, and the exact text sent is shown", !!used15&&/PE-AP-EDIT/.test(used15.body.messages[0].content)&&ui15.chip&&/PE-AP-EDIT/.test(ui15.last)&&/HOW TO FIX/.test(ui15.last), JSON.stringify({used15:!!used15,chip:ui15.chip}));
    const rs15=await pg.evaluate(()=>{ document.querySelector('#apList [data-ap="scene"] [data-reset]').click(); return !/PE-AP-EDIT/.test(__PE.apText("scene")); });
    ok("Reset brings the shipped prompt back", rs15);

    console.log("\n[16 — the order on screen, and edits applied since a test ran]");
    const ord16=await pg.evaluate(()=>{ __PE.renderAp&&0; const dom=[...document.querySelectorAll("#driftList .scene")].map(e=>e.id.replace(/^dr_/,""));
      return {arr:__PE.DRIFT_SCENES.map(x=>x.id),dom,first:__PE.DRIFT_SCENES[0].theme}; });
    ok("scenes are played and analysed in the order the Tests tab numbers them", ord16.first==="Daily life"&&(ord16.dom.length===0||ord16.dom.join()===ord16.arr.join()), JSON.stringify({first:ord16.arr.slice(0,3),dom:ord16.dom.slice(0,3)}));
    OR.calls=[];
    const ap16=await pg.evaluate(async()=>{ const P=__PE, sc=P.DRIFT_SCENES.find(x=>x.id==="memory_truth"), r=P.DR.results[sc.id];
      const it=P.findItem("frag:style_header"), v=P.itemVal(it), old=v.slice(0,40);
      P.setVal(it,"PE-NEW-WORDING "+v.slice(40));
      const k="frag:style_header\u0001"+old+"\u0001PE-NEW-WORDING ";
      APPLIED[k]={at:0,t:Date.now(),item:"frag:style_header",find:old,replace:"PE-NEW-WORDING "}; lsSet("applied",APPLIED);
      r.at=Date.now()-60000; r.judge=null; await P.analyseDrift([sc]);
      const stale={item:"frag:style_header",kind:"rewrite",find:old,replace:"x",why:"w"};
      return {state:editState(stale,it)}; });
    const sin16=OR.calls.find(c=>c.claude&&/You are JUDGING one test scene/.test(c.body.messages[0].content));
    const st16=sin16?sin16.body.messages[0].content:"";
    ok("the judge is told which edits were applied after the scene was played", /CHANGES APPLIED SINCE THIS SCENE WAS PLAYED/.test(st16)&&/PE-NEW-WORDING/.test(st16), st16.slice(-1500));
    ok("an edit quoting words that were already changed says so, not 'Text not found'", ap16.state==="superseded", JSON.stringify(ap16));

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
      for(const id of ["memory_truth","after_nextday"]){ const sc=by(id);
        const p=await __PE.engCall("build",{kind:sc.kind,speakerId:sc.speaker,targetId:"__user__",scene:{chat:sc.chat,opener:sc.opener,setup:sc.setup||null,asOf:sc.asOf||null,turns:[{role:"user",content:sc.lines[0]}]}});
        out[id]=p.messages.map(m=>m.content).join("\n"); }
      return out; });
    ok("a scene set before day 6 is rewound: no memory of it, no decision after it", /EARLYMARK/.test(bs.memory_truth)&&!/AFTERMARK/.test(bs.memory_truth)&&!/SEALED_DECISION/.test(bs.memory_truth), JSON.stringify({e:/EARLYMARK/.test(bs.memory_truth),a:/AFTERMARK/.test(bs.memory_truth),s:/SEALED_DECISION/.test(bs.memory_truth)}));
    ok("the day after uses the story's own memory and decision, not the sample's stand-in", /AFTERMARK/.test(bs.after_nextday)&&/SEALED_DECISION/.test(bs.after_nextday)&&!/ended up in his bed/.test(bs.after_nextday), JSON.stringify({a:/AFTERMARK/.test(bs.after_nextday),s:/SEALED_DECISION/.test(bs.after_nextday),e:/ended up in his bed/.test(bs.after_nextday)}));
    ok("pieces the story never produced are filled from its facts (scenario, a condensed past)", /başhekim/.test(bs.memory_truth)&&/The first days:/.test(bs.memory_truth), bs.memory_truth.slice(0,600));
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
      const L=__PE.LLM; L.cfg.cands={}; L.cfg.scenes=["text_night"]; L.cfg.eng=""; localStorage.setItem("pe_v1_llmcfg",JSON.stringify(L.cfg)); });
    await sp.click('#rtabs button[data-r="llm"]');
    const here=await sp.evaluate(()=>({c:__PE.llmCands("model"),box:document.querySelector("#llmKeyBox").textContent}));
    ok("without OpenRouter the roleplay setting compares Claude's three tiers", here.c.join()==="claude:quick,claude:default,claude:complex"&&/Runs here, with Claude/.test(here.box), JSON.stringify(here));
    await sp.evaluate(()=>__PE.runLlm());
    const le=await sp.evaluate(()=>({res:__PE.LLM.res,tiers:window.__tiers,html:document.querySelector("#llmResults").textContent}));
    const plays=le.tiers.filter(x=>!x.eval);
    ok("each tier played the scene through Claude, at its own tier", ["quick","default","complex"].every(t=>plays.filter(x=>x.tier===t).length===4), JSON.stringify(plays.map(x=>x.tier)));
    ok("and Claude compared them blind, naming the tiers again", le.tiers.some(x=>x.eval&&x.tier==="complex")&&/best: claude:complex/.test(le.html), le.html.slice(0,300));
    const retry=await sp.evaluate(async()=>{ const R=__PE.LLM.res, F=R.fields.model; delete F.verdict;
      F.error="The comparison failed: OpenRouter 404: anthropic/claude-opus-5:batch cannot be used with the chat/completions endpoint";
      __PE.LLM.res=llmMigrate(R); renderLlm();
      const b=document.querySelector('#llmResults [data-cmp="model"]'); if(!b||b.disabled) return {btn:false};
      b.click(); for(let i=0;i<50&&__PE.LLM.running;i++) await new Promise(r=>setTimeout(r,100)); await new Promise(r=>setTimeout(r,300));
      return {btn:true,best:F.verdict&&F.verdict.best,html:document.querySelector("#llmResults").textContent}; });
    ok("a comparison that failed before (even one imported from the site) is compared again, per setting", retry.btn&&retry.best==="claude:complex"&&!/OpenRouter 404/.test(retry.html), JSON.stringify(retry).slice(0,300));
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
