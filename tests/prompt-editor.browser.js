/* THE PROMPT EDITOR (prompt-editor.html) — a separate page that edits a prompt export and builds the
   full payload with StoryMind's own engine, running in a sealed sandbox.
   Pinned here:
     1  the engine boots in the sandbox and every reply kind builds a real payload
     2  the sandbox cannot touch the real app's storage
     3  an opened prompt export reads clean (nothing counted as edited until you edit)
     4  an edit to a reply fragment reaches the built payload (v150.66: a reply is its fragments; the five reply layouts
        and the reply-only pieces left the editor, the fragments' fields are its items)
     5  the downloaded file is accepted by StoryMind's own importPromptsFile, and carries the edit
     6  a reset prompt is written out in full (the app's import keeps any key a file leaves out)
     7  Test & review: the reviewer's edit is applied by find/replace to the right item
     8  served as Claude serves it (editor = index.html, StoryMind = storymind.html), the engine starts
     0  no prompts file is bundled: the editor starts from the draft or the defaults, and an opened file survives a reload
   Run: node tests/prompt-editor.browser.js   (needs playwright; see tests/README.md) */
const {chromium}=require('playwright');
const http=require('http'), fs=require('fs'), path=require('path');
const BIN=process.env.SM_CHROME||process.env.CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const ROOT=path.resolve(__dirname,'..');
(async()=>{
  /* the editor fetches index.html beside it, so it is served over http, not file:// */
  /* /art/… is the layout Claude serves the editor with: the editor IS index.html there, and StoryMind
     sits beside it as storymind.html. */
  const ART={"index.html":"prompt-editor.html","storymind.html":"index.html"};
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
  const bundledAsks=[]; await ctx.route(/prompt-editor-(start|world)\.json/,r=>{ bundledAsks.push(r.request().url()); r.fulfill({status:404,body:""}); });
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
    /* v150.75 — this file pins the payload and analysis plumbing with decisions off; the decision agents have their own file
       (tests/prompt-editor-decisions.browser.js) */
    await pg.evaluate(()=>{ lsSet("decmode","off"); lsSet("driftdec",false); });

    console.log("\n[0 — no bundled prompts or story: the editor starts from your draft, and your file stays after a reload]");
    const start=JSON.parse(fs.readFileSync(path.join(ROOT,'tests','fixtures','latest-prompts.json'),'utf8'));
    const fresh=await pg.evaluate(()=>({file:__PE.S.fileName,orig:!!__PE.S.orig,story:!!(__PE.STORY.w)}));
    ok("a first visit opens no bundled file: the shipped defaults, no story", fresh.file===""&&!fresh.orig&&!fresh.story&&bundledAsks.length===0, JSON.stringify({fresh,bundledAsks}));
    /* the author opens an export (the latest one, here), as with ⋯ › Open */
    await pg.evaluate(s=>{ __PE.openPack(JSON.parse(s),"My export"); },JSON.stringify(start));
    await pg.reload();
    await pg.waitForFunction(()=>window.__PE&&window.__PE.ENG.ready&&window.__PE.S.preview&&window.__PE.S.preview.messages,null,{timeout:90000});
    await installClaude(pg);
    const s0=await pg.evaluate(async()=>{ const S=__PE.S; const p=await __PE.engCall('build',{kind:'solo'});
      return {file:S.fileName,date:S.orig&&S.orig.date,task:__PE.itemVal(__PE.findItem("fx:task.text")),taskOrig:__PE.origVal(__PE.findItem("fx:task.text")),unk:p.unknownCalls,unkV:p.unknownVars,
        edited:__PE.ITEMS().filter(it=>__PE.itemStatus(it).edited).length,modal:(document.querySelector("#modalHost")||{}).textContent||""}; });
    ok("after a reload the opened file is still the one in the editor, with no prompt to switch back", s0.file==="My export"&&s0.date===start.date&&!/bundled/i.test(s0.modal)&&bundledAsks.length===0, JSON.stringify({file:s0.file,date:s0.date,asks:bundledAsks}));
    ok("its reply fragments are the ones in the editor (the file's list, or the shipped one)", !!s0.task&&s0.task===s0.taskOrig, JSON.stringify({task:String(s0.task).slice(0,80)}));
    ok("and it builds with every name known", s0.unk.length===0&&s0.unkV.length===0, JSON.stringify(s0));
    ok("nothing counts as edited", s0.edited===0, s0.edited);
    console.log("\n[0b — the This turn switches bring in what only happens on some turns]");
    const rich=await pg.evaluate(async()=>{ const o={};
      for(const k of ["solo","multi","gm","text","heat"]){ const p=await __PE.engCall('build',{kind:k}); o[k]={n:p.messages.length,empties:p.empties,fired:(p.fired||[]).length}; }
      o.on=(await __PE.engCall('build',{kind:'solo',turn:{arriving:true,video:true,voice:true,afterHeat:true}})).empties;
      return o; });
    ["solo","multi","gm","text","heat"].forEach(k=>ok("the "+k+" path builds from its fragments, and says which sent something", rich[k].n>=2&&rich[k].fired>=10, JSON.stringify(rich[k])));
    const filled=rich.solo.empties.filter(x=>rich.on.indexOf(x)<0);
    ok("a video playing and the after-heat decision fill data that is empty without them (each empty call is listed)",
       ["watching_raw","after_heat"].every(x=>filled.indexOf(x)>=0), JSON.stringify({filled,on:rich.on.slice(0,12)}));

    /* a draft with an edit: a reload keeps it, with no file put over it and nothing to choose */
    await pg.evaluate(()=>{ const it=__PE.findItem("fx:task.text"); __PE.setVal(it,__PE.itemVal(it)+" DRAFT-EDIT"); });
    await pg.reload();                                                   // straight away: the draft is written as the page goes
    await pg.waitForFunction(()=>window.__PE&&window.__PE.ENG.ready&&window.__PE.S.preview&&window.__PE.S.preview.messages,null,{timeout:90000});
    await installClaude(pg); await pg.waitForTimeout(500);
    const kept=await pg.evaluate(()=>({modal:!!document.querySelector(".modal"),file:__PE.S.fileName,draft:/DRAFT-EDIT/.test(__PE.itemVal(__PE.findItem("fx:task.text")))}));
    ok("a draft with edits is kept on reload, even when the page closes at once, and no other file is offered", !kept.modal&&kept.file==="My export"&&kept.draft&&bundledAsks.length===0, JSON.stringify(kept));
    /* back to the file as opened, for the steps below */
    await pg.evaluate(s=>{ __PE.openPack(JSON.parse(s),"My export"); },JSON.stringify(start));
    ok("opening a file again replaces the draft with that file", await pg.evaluate(d=>__PE.S.orig.date===d&&!/DRAFT-EDIT/.test(__PE.itemVal(__PE.findItem("fx:task.text"))),start.date));

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
    ok("the reply is built from the fragments, not from the pack's old reply layout", !/YOUR NATIVE LANGUAGE/.test(solo)&&/# TASK/.test(solo), solo.slice(0,300));

    console.log("\n[4 — an edit reaches the payload]");
    const MARK="PE-TEST-MARKER: never repeat his question back to him.";
    await pg.evaluate(m=>{ const it=__PE.findItem("fx:task.text"); __PE.setVal(it,__PE.itemVal(it)+"\n"+m); },MARK);
    await pg.waitForTimeout(900);
    const after=await pg.evaluate(async()=>(await __PE.engCall('build',{kind:'solo'})).messages.map(m=>m.content).join("\n"));
    ok("the edited piece is in the built payload", after.indexOf(MARK)>=0, after.slice(0,200));
    ok("and it is counted as edited", await pg.evaluate(()=>__PE.itemStatus(__PE.findItem("fx:task.text")).edited));

    /* v150.66 — the reply fragments are the editor's reply items: each field an item, the previews built from them on the path
       picked, and the export carrying the list */
    console.log("\n[4b — the reply fragments are the items; the preview builds the path you pick]");
    const fx4=await pg.evaluate(async()=>{ const P=__PE, I=P.ITEMS();
      const r={layouts:I.filter(it=>it.type==="tpl"&&it.key.indexOf("eng:")<0).map(it=>it.key),
        replyPieces:I.filter(it=>it.type==="frag"&&["style_header","rails_header","task","bio_header"].indexOf(it.key)>=0).map(it=>it.key),
        other:!!P.findItem("frag:whisper_to_you"),main:!!P.findItem("fx:guardrails.text"),bp:!!P.findItem("fx:guardrails.bp.text"),
        code:/line_for_other/.test(P.itemVal(P.findItem("fx:guidance.o.not_yours.code"))),
        ask:!!P.findItem("fx:talk_into.o.ask.ask")&&P.itemVal(P.findItem("fx:talk_into.o.ask.ask")).length>20,
        kinds:P.S.meta.kinds.join(",")};
      const it=P.findItem("fx:guardrails.bp.text"); P.setVal(it,P.itemVal(it)+"\nPE-TEXT-PATH-ONLY");
      await new Promise(res=>setTimeout(res,900));
      const txt=(await P.engCall('build',{kind:'text'})).messages.map(m=>m.content).join("\n"), solo=(await P.engCall('build',{kind:'solo'})).messages.map(m=>m.content).join("\n");
      r.onText=/PE-TEXT-PATH-ONLY/.test(txt); r.notSolo=!/PE-TEXT-PATH-ONLY/.test(solo);
      select(it); r.previewPath=document.querySelector("#plKind").value;
      const ex=P.buildExport(); r.exported=/PE-TEXT-PATH-ONLY/.test(ex.settings.fragments||"")&&!!ex.settings.fragAdds;
      P.setVal(it,P.origVal(it)); await new Promise(res=>setTimeout(res,600));
      r.back=!P.itemStatus(it).edited;
      select(P.findItem("fx:task.text")); document.querySelector("#plKind").value="solo"; P.refreshPreview();   // back to where the steps below start
      await new Promise(res=>setTimeout(res,900));
      return r; });
    ok("no reply layouts and no reply-only pieces are listed; the other wording is", fx4.layouts.length===0&&fx4.replyPieces.length===0&&fx4.other, JSON.stringify(fx4));
    ok("each fragment's main body, path box, and an option's code condition and question are items", fx4.main&&fx4.bp&&fx4.code&&fx4.ask, JSON.stringify(fx4));
    ok("the preview's paths are the five reply paths", fx4.kinds==="solo,multi,gm,text,heat", fx4.kinds);
    ok("an edit to the Text path's box reaches the text payload and not the solo one; opening it previews the Text path", fx4.onText&&fx4.notSolo&&fx4.previewPath==="text", JSON.stringify(fx4));
    ok("the download carries the fragment list (and the shipped changes it holds)", fx4.exported&&fx4.back, JSON.stringify(fx4));
    ok("the engine no longer turns the fragments off", !/state\.fragOn\s*=\s*false/.test(fs.readFileSync(path.join(ROOT,'prompt-editor.html'),'utf8')));

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
      const fr=JSON.parse(localStorage.getItem(K.fragments)||"[]");
      return {r,skipped:warned.filter(w=>/ignored/.test(w)),hasMark:String((fr.find(f=>f.id==="task")||{}).text||"").indexOf(MARK)>=0,
        gm:localStorage.getItem(K.gmJudge)===PROMPT_BY_KEY.gmJudge.def()};
    },{ex,MARK});
    ok("importPromptsFile accepts it with nothing skipped", imp.r===true&&imp.skipped.length===0, JSON.stringify(imp));
    ok("the edited fragment arrives in the app", imp.hasMark);
    console.log("\n[6 — a prompt reset to default is written out]");
    ok("gmJudge, reset in the editor, overwrites the phone's copy with the default", imp.gm);
    await app.close();

    console.log("\n[7 — Test & review: YOUR model writes the reply, Claude reviews it]");
    OR.calls=[];
    OR.answer=body=>{ const last=String((body.messages||[]).slice(-1)[0].content||"");
      return /Reply with ONLY this JSON/.test(last)
        ? JSON.stringify({verdict:"Too long, and it repeated his question.",problems:[{issue:"echo",evidence:"Dört bin mi?"}],
            edits:[{item:"fx:task.text",find:"PE-TEST-MARKER",replace:"PE-REVIEWED",why:"clearer"}]})
        : '"Dört bin mi? Abi otur bir çay iç önce."'; };
    await pg.evaluate(()=>{ localStorage.setItem("pe_v1_orkey",JSON.stringify("sk-or-test")); localStorage.setItem("pe_v1_testmodel",JSON.stringify("deepseek/deepseek-v4-pro")); });
    await pg.evaluate(()=>{ document.querySelector("#btnRebuild").click(); });
    await pg.waitForTimeout(800);
    await pg.click('#rtabs button[data-r="claude"]');
    await pg.click("#btnTestReview");
    await pg.waitForSelector('.chg [data-a="apply"]:not([disabled])',{timeout:20000});
    await pg.click('.chg [data-a="apply"]');
    const rv=await pg.evaluate(()=>__PE.itemVal(__PE.findItem("fx:task.text")));
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
    const SCENE_RX=/You are JUDGING one test scene/, KIND_RX=/You are RE-EVALUATING the scene reports/;
    const SCENE=(text,extra)=>{ const body=String(text).split("===== THE LAST PAYLOAD")[0]; const j=JSON.parse(JUDGE((body.match(/^TURN \d+$/gm)||[]).length)); j.reasoning="PE-SCENE-REASONING the memory piece invites agreement"; j.probes=[{turn:1,result:"pass",evidence:"Hatırlamıyorum"},{turn:2,result:"fail",evidence:"Evet",note:"went along"}]; if(extra) extra(j); return JSON.stringify(j); };
    const KIND=text=>{ const ids=(String(text).match(/^### SCENE ([a-z_]+):/gm)||[]).map(x=>x.slice(10,-1));
      return JSON.stringify({score:6,summary:"PE-KIND-SUMMARY the memory slips across this kind",reasoning:"PE-KIND-REASONING the memory piece invites agreement",criteria:{memory:{score:4,note:"slips"},turkish:{score:6,note:"calques"}},
        causes:ids.map(id=>({scene:id,claimed:"frag:rp_memory",verdict:"confirmed",note:"PE-KIND-CAUSE"})),
        patterns:[{criterion:"memory",pattern:"PE-KIND-PATTERN goes along with invented pasts",scenes:ids,cause:"frag:rp_memory"}],payload_notes:["PE-KIND-NOTE the memories sit far from the reply"]}); };
    OR.answer=body=>{ const msgs=body.messages||[]; const last=String((msgs.slice(-1)[0]||{}).content||"");
      if(SCENE_RX.test(last)) return SCENE(last);
      if(KIND_RX.test(last)) return KIND(last);
      if(/You are the FIXER for ONE test section/.test(last)) return JSON.stringify({summary:"PE-SEC9",edits:[],keep:[]});
      seen.push(msgs.map(m=>m.content).join("\n")); return '"Hatırlamıyorum." *Gözlüğünü indiriyor.*'; };
    await pg.click('#rtabs button[data-r="tests"]');
    const sc9=await pg.evaluate(()=>({n:__PE.DRIFT_SCENES.length,ids:__PE.DRIFT_SCENES.map(x=>x.id),kinds:[...new Set(__PE.DRIFT_SCENES.map(x=>x.kind))].sort().join(","),
      multi:__PE.DRIFT_SCENES.filter(x=>(x.speakers||[]).length>1).map(x=>x.id),focus:__PE.DRIFT_SCENES.every(x=>Array.isArray(x.focus)&&x.focus.length),
      crit:__PE.CRITERIA.map(c=>c.id).join(",")}));
    ok("eleven scenes, each built around probes", sc9.n===11, sc9.ids.join(","));
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
    const jin9=OR.calls.find(c=>c.claude&&SCENE_RX.test(c.body.messages[0].content)), jt9=jin9?jin9.body.messages[0].content:"";
    const kin9=OR.calls.find(c=>c.claude&&KIND_RX.test(c.body.messages[0].content)), kt9=kin9?kin9.body.messages[0].content:"";
    ok("level 1: the scene is judged on its own, with its dialogue and its payload", /THE SCENE: Loyal to what happened/.test(jt9)&&/^TURN 4$/m.test(jt9)&&/===== THE LAST PAYLOAD/.test(jt9)&&/"reasoning"/.test(jt9), jt9.slice(0,300));
    ok("level 2: its kind re-evaluates the scene reports with the payload once, without the dialogue", (kt9.match(/===== ONE PAYLOAD OF THIS KIND/g)||[]).length===1&&/^### SCENE memory_truth: Loyal to what happened/m.test(kt9)&&/THE JUDGE'S REASONING: PE-SCENE-REASONING/.test(kt9)&&/accepts an invented past/.test(kt9)&&!/^TURN \d+$/m.test(kt9)&&/Solo · Memory — /.test(kt9), kt9.slice(0,300));
    ok("Turkish is judged as a native would say it (words, register, sense in context, realism), not only grammar", /not as a grammar check/.test(jt9)&&/word choice/.test(jt9)&&/sense in context/.test(jt9)&&/what a native would say instead/.test(jt9)&&/the word a Turk would pick/.test(jt9), jt9.slice(0,200));
    ok("the judge scores the rubric (★ marks what the scene presses on) and is told not to fix", /★ memory/.test(jt9)&&/Do not propose fixes/.test(jt9)&&/HOW TO FIX — CAUSE FIRST, THEN THE BEST FIX/.test(jt9)&&/MOVE a piece/.test(jt9), jt9.slice(0,300));
    const kh9=await pg.evaluate(()=>(document.querySelector("#kind_solo_memory")||{}).textContent||"");
    ok("the kind's own analysis shows above its scenes: summary, rubric, patterns, payload structure", /PE-KIND-SUMMARY/.test(kh9)&&/PE-KIND-PATTERN/.test(kh9)&&/PE-KIND-NOTE/.test(kh9)&&/Memory 4/.test(kh9), kh9.slice(0,300));
    ok("the judge's reasoning shows on the scene", /PE-SCENE-REASONING/.test(d.html), d.html.slice(0,200));
    ok("the judge checks the scene's probes, and each probe's result shows on the scene", /THE PROBES/.test(jt9)&&/- turn 1: The buoy at Palmera never happened/.test(jt9)&&/probe t1: pass/.test(d.html)&&/probe t2: fail/.test(d.html)&&/PROBES:\n- t1 PASS[^\n]*\n- t2 FAIL \(She never said/.test(kt9), d.html.slice(0,200));
    ok("solo is split into sections by what they test", await pg.evaluate(()=>__PE.KINDS.map(k=>k.k).join()==="solo_voice,solo_arc,solo_memory,multi,text,heat"&&__PE.DRIFT_SCENES.every(sc=>sc.group&&(sc.probes||[]).length>=3)&&!!document.querySelector("#kind_solo_arc")));
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
    const imp9=await pg.evaluate(()=>({n:(__PE.DR.results.memory_truth||{}).turns&&__PE.DR.results.memory_truth.turns.length,btn:(b=>!!b&&!b.disabled)(document.querySelector("#kind_solo_memory [data-kan]"))}));
    ok("an exported run imports, with its kind's Analyse button", imp9.n===4&&imp9.btn, JSON.stringify(imp9));
    OR.calls=[];
    await pg.evaluate(()=>__PE.analyseKinds(["solo_memory"]));
    ok("judging sends it to Claude only (the scene, then its section, then the section's fixer), never back to the model", OR.calls.length===3&&OR.calls.every(c=>c.claude)&&/FIXER for ONE test section/.test(OR.calls[2].body.messages[0].content)
       &&await pg.evaluate(()=>!!__PE.DR.results.memory_truth.judge), JSON.stringify(OR.calls.map(c=>c.body.model)));

    console.log("\n[10 — engine tests: their own tab, purpose-built scenes, scripted exchanges]");
    OR.calls=[];
    OR.answer=body=>{ const all=JSON.stringify(body.messages||[]);
      if(/You are JUDGING one BACKGROUND ENGINE/.test(all)){ const k=(all.match(/prompt key \\"([A-Za-z0-9_]+)\\"/)||[])[1]||"";
        return JSON.stringify({verdict:k==="memBuild"?"issues":"good",summary:"s",problems:k==="memBuild"?[{issue:"kept the maybe",evidence:"belki",cause:"no rule on changed plans"}]:[]}); }
      if(/RE-EVALUATING the engine judgements of ONE ENGINE SCENE/.test(all)) return JSON.stringify({outcome:"partly",summary:"PE-ENG-SCENE the maybe stuck",reasoning:"PE-ENG-SCENE-REASONING memBuild kept the maybe",engines:[{engine:"memBuild",verdict:"issues",cause:"confirmed"}]});
      if(/You are the FIXER for ONE ENGINE PROMPT/.test(all)){ const c0=String(body.messages[0].content), at=c0.indexOf("===== THE PROMPT (current text) ====="), f=at<0?"":(c0.slice(at).split("\n").slice(1).find(l=>l.trim().length>=30)||"").trim().slice(0,50);
        return JSON.stringify({summary:"PE-ENG-FIXER keeps the maybe",keep:["PE-ENG-KEEP"],edits:[{item:"prompt:memBuild",kind:"rewrite",find:f,replace:f+" PE-ENGINE-FIX",cause:"c",why:"w",helps:["memBuild"]}],
          generated:[{prompt:"relPrompt",block:"the reading",problem:"PE-ENG-UPSTREAM",evidence:"e",fix:"f"}],story:[{who:"Sami",field:"bio",problem:"PE-ENG-STORY",change:"c"}],backend:[{area:"timing",problem:"PE-ENG-BACK",change:"c",impact:"i"}]}); }
      if(/COMPLETE ANALYSIS of the BACKGROUND ENGINES/.test(all)){ const c1=String(body.messages[0].content), mm=c1.match(/P:memBuild#1 prompt:memBuild \(rewrite\) find «([^»]*)»/), f=mm?mm[1]:"";
        return JSON.stringify({score:6,summary:"plans mostly right",generated:[{prompt:"relPrompt",block:"the reading",problem:"PE-ENG-UPSTREAM",evidence:"e",fix:"f"}],story:[{who:"Sami",field:"bio",problem:"PE-ENG-STORY",change:"c"}],backend:[{area:"timing",problem:"PE-ENG-BACK",change:"c",impact:"i",priority:"medium"}],scenes:[{scene:"Plans that change their mind (meetings and promises)",outcome:"partly",note:"the maybe stuck"}],patterns:[{engine:"memBuild",pattern:"keeps a maybe",cause:"c"}],
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
    const esr=OR.calls.find(c=>c.claude&&/RE-EVALUATING the engine judgements of ONE ENGINE SCENE/.test(c.body.messages[0].content)), esrt=esr?esr.body.messages[0].content:"";
    const efx=OR.calls.find(c=>c.claude&&/You are the FIXER for ONE ENGINE PROMPT/.test(c.body.messages[0].content)), efxt=efx?efx.body.messages[0].content:"";
    ok("E2: the scene re-evaluates its engines' judgements against its purpose and script, without the calls", !!esr&&/WHAT THE SCENE WAS BUILT TO TEST/.test(esrt)&&/Bakarız abi, belki/.test(esrt)&&/kept the maybe/.test(esrt)&&!/WHAT THE APP SENT/.test(esrt), esrt.slice(0,200));
    ok("E3: a fixer for the prompt with problems: its text, its judgements, the scene's report, one real call", !!efx&&/prompt:memBuild/.test(efxt)&&/===== THE PROMPT \(current text\) =====/.test(efxt)&&/kept the maybe/.test(efxt)&&/OUTCOME: PARTLY — PE-ENG-SCENE/.test(efxt)&&/THE SCENE'S REASONING: PE-ENG-SCENE-REASONING/.test(efxt)&&/WHAT THE APP SENT/.test(efxt), efxt.slice(0,200));
    ok("E4: the engine reconciler reads the scene reports and every prompt fixer's proposals, not the calls", !!efin&&/PURPOSE:/.test(efin.body.messages[0].content)&&/P:memBuild#1 prompt:memBuild/.test(efin.body.messages[0].content)&&/PE-ENG-KEEP/.test(efin.body.messages[0].content)&&!/WHAT THE APP SENT/.test(efin.body.messages[0].content));
    const ejr=OR.calls.find(c=>c.claude&&/You are JUDGING one BACKGROUND ENGINE/.test(c.body.messages[0].content)), ejrt=ejr?ejr.body.messages[0].content:"";
    ok("engine judges name where each problem comes from (wording, input from another engine, story, code)", /WHERE A PROBLEM COMES FROM — name it for every problem/.test(ejrt)&&/"source":"wording\|input\|story\|code"/.test(ejrt), ejrt.slice(0,100));
    ok("the engine prompt fixer sorts causes and knows the app's engine prompts", /SORT EVERY CAUSE BY WHERE IT COMES FROM/.test(efxt)&&/THE APP'S ENGINE PROMPTS/.test(efxt)&&/relPrompt — /.test(efxt), efxt.slice(0,100));
    ok("the engine reconciler reads the upstream, story and backend findings", /GENERATED CONTENT \(another engine's prompt\):\n- relPrompt/.test(efin.body.messages[0].content)&&/PE-ENG-STORY/.test(efin.body.messages[0].content)&&/PE-ENG-BACK/.test(efin.body.messages[0].content));
    const esh=await pg.evaluate(()=>({list:(document.querySelector("#engScenes")||{}).textContent||"",fx:(document.querySelector("#engFixers")||{}).textContent||""}));
    const eout=await pg.evaluate(()=>{ const box=document.querySelector('#engOverallBox [data-outside="eng"]'); return {txt:box?box.textContent:"",btn:!!(box&&box.querySelector("[data-genfix]")),md:__PE.backendMarkdown()}; });
    ok("the engine tab lists upstream-engine, story and backend findings, with Fix this engine prompt", /PE-ENG-UPSTREAM/.test(eout.txt)&&/PE-ENG-STORY/.test(eout.txt)&&/PE-ENG-BACK/.test(eout.txt)&&eout.btn&&/PE-ENG-BACK/.test(eout.md)&&/PE-ENG-STORY/.test(eout.md), JSON.stringify(eout).slice(0,300));
    ok("the scene's report shows in the scene list, and the prompt fixer's proposals in the engine analysis", /PE-ENG-SCENE the maybe stuck/.test(esh.list)&&/PE-ENG-FIXER/.test(esh.fx), JSON.stringify(esh).slice(0,300));
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

    console.log("\n[10c — engine results: export and import, a failure that stays on screen, before → after]");
    const exportedEng=await pg.evaluate(()=>JSON.stringify({app:"StoryMind",kind:"engine-test-results",date:Date.now(),engines:__PE.ENGRUN.byScene,fixers:__PE.EFX,overall:__PE.ENGALL.overall}));
    const eb=await pg.evaluate(()=>({exp:!!document.querySelector("#btnEngExport"),imp:!!document.querySelector("#btnEngImport"),fix:!!document.querySelector("#btnEngFix")}));
    await pg.evaluate(()=>{ __PE.ENGRUN.byScene={}; Object.keys(__PE.EFX).forEach(k=>delete __PE.EFX[k]); __PE.ENGALL.overall=null; });
    await pg.setInputFiles('#fileEng',{name:"storymind_engine_tests.json",mimeType:"application/json",buffer:Buffer.from(exportedEng)});
    await pg.waitForTimeout(500);
    const ei=await pg.evaluate(()=>({scenes:Object.keys(__PE.ENGRUN.byScene),fixers:Object.keys(__PE.EFX),overall:!!__PE.ENGALL.overall,box:(document.querySelector("#engOverallBox")||{}).textContent||""}));
    ok("the engine tab has its own Export results, Import results and Write the fixes", eb.exp&&eb.imp&&eb.fix, JSON.stringify(eb));
    ok("an exported engine run imports with its judgements, prompt fixers and analysis", ei.scenes.indexOf("plans")>=0&&ei.fixers.indexOf("memBuild")>=0&&ei.overall&&/Complete engine analysis/.test(ei.box)&&/PE-ENG-FIXER/.test(ei.box), JSON.stringify(ei).slice(0,300));
    OR.calls=[];
    const efk=await pg.evaluate(async()=>{ const b=document.querySelector("#engList [data-efix]"); if(!b) return null; const k=b.dataset.efix; b.click(); for(let i=0;i<80&&!(__PE.EFX[k]&&__PE.EFX[k].at&&!__PE.EFX[k].running);i++) await new Promise(r=>setTimeout(r,100)); await new Promise(r=>setTimeout(r,200)); return k; });
    const efc=OR.calls.filter(c=>c.claude).map(c=>c.body.messages[0].content);
    ok("Fix this prompt runs that engine prompt's fixer only", !!efk&&efc.length===1&&new RegExp("FIXER for ONE ENGINE PROMPT of the app: [^\\n]*\\(prompt:"+efk+"\\)").test(efc[0]), efk+" | "+efc.map(x=>x.slice(0,120)).join(" | "));
    const ef2=await pg.evaluate(async()=>{ const P=__PE, orig=AI.sample.json; let n=0, effIn="";
      lsSet("engsnaps",[]);
      AI.sample.json=async(input,o)=>{ if(/ENGINE RECONCILER/.test(input)){ n++; if(n===1) throw {code:"prompt_too_large",message:"too big"}; return {score:7,summary:"PE-ENG-FIXED",edits:[]}; }
        if(/WHAT THE LAST CHANGES DID to the BACKGROUND ENGINES/.test(input)){ effIn=input; return {summary:"PE-ENG-EFFECT",edits:[],regressions:[],keep:[],revert:[]}; }
        return orig(input,o); };
      await P.writeEngFixesAlone();
      const failBox=(document.querySelector("#engOverallBox")||{}).textContent||"", btn=document.querySelector("#engOverallBox [data-refix]");
      btn&&btn.click(); for(let i=0;i<60&&!(P.ENGALL.overall&&P.ENGALL.overall.summary==="PE-ENG-FIXED");i++) await new Promise(r=>setTimeout(r,100));
      const fixed=P.ENGALL.overall&&P.ENGALL.overall.summary==="PE-ENG-FIXED", snaps1=P.engSnaps().length;
      /* a later run, after an edit to the prompt */
      const key=Object.keys(P.engSnaps()[0].prompts)[0], it=P.findItem("prompt:"+key), old=P.itemVal(it); P.setVal(it,old+"\nPE-ENG-NEWLINE"); APPLIED["pe-eng"]={t:Date.now(),item:"prompt:"+key,find:"x",replace:"PE-ENG-NEWLINE"};
      Object.values(P.ENGRUN.byScene).forEach(r=>{ r.at=Date.now()+1000; if(r.report) r.report.at=Date.now()+2000; });
      await P.writeEngFixesAlone();
      const res={failBox:/The engine analysis failed/.test(failBox)&&/256 KB/.test(failBox)&&!!btn,fixed,snaps1,effIn:/^\+ PE-ENG-NEWLINE/m.test(effIn)&&/Plans|Comings|scene/i.test(effIn),effBox:/PE-ENG-EFFECT/.test((document.querySelector("#engOverallBox")||{}).textContent||"")};
      P.setVal(it,old); delete APPLIED["pe-eng"]; AI.sample.json=orig; return res; });
    ok("a failed engine analysis stays on screen, and Write the fixes again runs it", ef2.failBox&&ef2.fixed, JSON.stringify(ef2));
    ok("the next engine run is compared with the earlier one first (prompt diff, outcomes, verdicts), and the verdict shows", ef2.snaps1===1&&ef2.effIn&&ef2.effBox, JSON.stringify(ef2));

    console.log("\n[11 — one roleplay run, then one complete analysis that may move pieces]");
    OR.calls=[];
    /* v150.66 — a move inside one fragment's text (the reply layouts it moved lines in are gone) */
    const MV=await pg.evaluate(()=>{ const v=__PE.itemVal(__PE.findItem("fx:guardrails.text")); const L=v.split("\n").map(l=>l.trim()).filter(l=>l.length>20); return {v,a:L[L.length-1],b:L[0]}; });
    const soloTpl=MV.v;
    OR.answer=body=>{ const all=JSON.stringify(body.messages||[]), first=String(((body.messages||[])[0]||{}).content||"");
      if(/You are the FIXER for ONE test section/.test(first)) return JSON.stringify({summary:"PE-SEC-SUMMARY",keep:["PE-SEC-KEEP"],edits:[{item:"fx:task.text",kind:"rewrite",find:"PE-REVIEWED",replace:"PE-SEC-FIX",why:"w",shared:"everywhere",helps:["turkish"]}],
        generated:[{block:"outfit",prompt:"PE-GEN-KEY",problem:"PE-GEN-COAT a coat on the beach",evidence:"palto",fix:"dress for the place"}],story:[{who:"Buket",field:"bio",problem:"PE-STORY-BIO",change:"c"}],backend:[{area:"privacy",problem:"PE-BACK-PRIV",change:"filter it",impact:"i"}]});
      if(/The roleplay tests found a problem in content that an ENGINE wrote/.test(first)){ const c=first, at=c.indexOf("===== THE PROMPT (current text) ====="), f=at<0?"":(c.slice(at).split("\n").slice(1).find(l=>l.trim().length>=30)||"").trim().slice(0,40);
        return JSON.stringify({summary:"PE-GENFIX",edits:[{kind:"rewrite",find:f,replace:f+" PE-GEN-FIXED",why:"w"}],backend:[{area:"input",problem:"PE-GEN-BACK",change:"c"}]}); }
      if(/COMPLETE ANALYSIS of a test run/.test(first)) return JSON.stringify({score:6,summary:"s",criteria:{memory:4},patterns:[{criterion:"memory",pattern:"the past is buried",scenes:["Loyal to what happened"],cause:"x"}],
        structure:["The trackers sit far from the reply"],
        edits:[{item:"fx:guardrails.text",kind:"move",find:MV.a,before:MV.b,cause:"buried",why:"nearer the reply",helps:["self"],risks:"none"},
               {item:"fx:task.text",kind:"rewrite",cause:"c",find:"PE-REVIEWED",replace:"PE-ALL-FIX",why:"w",helps:["turkish","meaning"],risks:"none"}],
        generated:[{prompt:"GENKEY",block:"outfit",problem:"PE-GEN-COAT a coat on the beach",evidence:"palto",fix:"dress for the place",sections:["Text messages"]}],story:[{who:"Buket",field:"bio",problem:"PE-STORY-BIO",change:"c"}],backend:[{area:"privacy",problem:"PE-BACK-PRIV",change:"filter it",impact:"i",priority:"high"}]});
      if(SCENE_RX.test(first)) return SCENE(first);
      if(KIND_RX.test(first)) return KIND(first);
      const sys=String(((body.messages||[])[0]||{}).content||""); return /JSON/i.test(sys)?"{}":'"Tamam." *Gülümsüyor.*'; };
    await pg.evaluate(()=>{ localStorage.setItem("pe_v1_selreply",JSON.stringify(["text_night","dinner"])); });
    await pg.click('#rtabs button[data-r="tests"]');
    OR.peak=0; OR.delay=body=>/You are JUDGING one test scene|You are RE-EVALUATING/.test(JSON.stringify(body.messages||[]))?400:0;
    const est=await pg.evaluate(()=>document.querySelector("#allEstimate").textContent);
    ok("the estimate counts the replies of every speaker", /2 scenes \(12 replies[,)]/.test(est), est);
    await pg.evaluate(()=>__PE.runEverything());
    const all=await pg.evaluate(()=>({tn:__PE.DR.results.text_night,dn:__PE.DR.results.dinner,overall:__PE.ALL.overall,engRan:Object.keys(__PE.ENGRUN.byScene).length,
      box:(document.querySelector("#overallBox")||{}).textContent||""}));
    OR.delay=null;
    ok("both scenes were played and judged, and no engine scene ran with them", all.tn&&all.tn.judge&&all.dn&&all.dn.judge&&all.engRan===1, JSON.stringify({tn:!!(all.tn&&all.tn.judge),dn:!!(all.dn&&all.dn.judge),eng:all.engRan}));
    ok("the analysis runs one request at a time (no pile-up into rate limits)", OR.peak===1, OR.peak);
    const kc=OR.calls.filter(c=>c.claude&&KIND_RX.test(c.body.messages[0].content)).map(c=>c.body.messages[0].content);
    const sc11=OR.calls.filter(c=>c.claude&&SCENE_RX.test(c.body.messages[0].content)).map(c=>c.body.messages[0].content);
    ok("each scene was judged on its own first, with its dialogue", sc11.length===2&&sc11.every(t=>/^TURN 1$/m.test(t))&&sc11.some(t=>/THE SCENE: Texting at night/.test(t))&&sc11.some(t=>/THE SCENE: Dinner with Sami/.test(t)), sc11.length);
    ok("each kind's analyst gets its own payload once, and only its own scene reports", kc.length===2&&kc.every(t=>!/^TURN \d+$/m.test(t))&&kc.every(t=>(t.match(/===== ONE PAYLOAD OF THIS KIND/g)||[]).length===1)
       &&kc.some(t=>/Text messages — /.test(t)&&/### SCENE text_night/.test(t)&&!/### SCENE dinner/.test(t))&&kc.some(t=>/Several characters — /.test(t)&&/### SCENE dinner/.test(t)&&!/### SCENE text_night/.test(t)), kc.map(t=>t.slice(0,120)).join(" | "));
    const fin=OR.calls.find(c=>c.claude&&/COMPLETE ANALYSIS of a test run/.test(c.body.messages[0].content)), ft=fin?fin.body.messages[0].content:"";
    const fx11=OR.calls.filter(c=>c.claude&&/You are the FIXER for ONE test section/.test(c.body.messages[0].content)).map(c=>c.body.messages[0].content);
    const fxT=fx11.find(x=>/## SECTION: Text messages/.test(x))||"", fxM=fx11.find(x=>/## SECTION: Several characters/.test(x))||"";
    ok("each section has its own fixer: its report with the reasoning, its payload once, its pieces, no dialogue", !!fxT&&!!fxM&&[fxT,fxM].every(x=>(x.match(/===== THE PAYLOAD \(as sent/g)||[]).length===1&&/===== SYSTEM =====/.test(x)&&/THE JUDGE'S REASONING: PE-SCENE-REASONING/.test(x)&&/THE SECTION'S REASONING|THE KIND'S REASONING: PE-KIND-REASONING/.test(x)&&/===== THE PIECES IN THIS PAYLOAD/.test(x)&&/(SHARED with: |this section only)/.test(x)&&!/^TURN \d+$/m.test(x))
       &&/### SCENE text_night/.test(fxT)&&!/### SCENE dinner/.test(fxT), (fxT||"none").slice(0,200)+" | "+fx11.length);
    ok("the reconciler gets every section's proposals and where each piece is used, but no payload and no dialogue", !!fin&&/===== EVERY SECTION'S PROPOSALS/.test(ft)&&/S:text#1 fx:task.text/.test(ft)&&/S:multi#1/.test(ft)&&/PE-SEC-KEEP/.test(ft)
       &&/===== WHERE EACH TOUCHED PIECE APPEARS =====\n- fx:task.text: /.test(ft)&&/===== fx:task.text =====/.test(ft)&&!/MESSAGE 1 · SYSTEM/.test(ft)&&!/^TURN \d+$/m.test(ft)&&/THE RUBRIC ACROSS THIS RUN/.test(ft)&&/- memory \(Memory\): 4/.test(ft)&&/"decisions"/.test(ft), ft.slice(0,300));
    const fxLater=fx11[fx11.length-1]||"", fxFirst=fx11[0]||"";
    ok("each fixer knows what was changed before it: the edits already applied, and what the fixers before it in this run proposed", fx11.length>=2&&!/WHAT THE FIXERS BEFORE YOU IN THIS RUN/.test(fxFirst)&&/WHAT THE FIXERS BEFORE YOU IN THIS RUN PROPOSED[\s\S]*S:[a-z_]+#1 fx:task.text/.test(fxLater)&&/WHAT HAS BEEN CHANGED BEFORE[\s\S]*fx:task.text/.test(fxLater), fxLater.slice(0,200));
    ok("the judges label where each problem comes from (wording, generated, story, code, decision), and the section fixer sorts causes and knows the engine prompts", /WHERE A PROBLEM COMES FROM/.test(sc11[0]||"")&&/"source":"wording\|generated\|story\|code\|decision"/.test(sc11[0]||"")&&/SORT EVERY CAUSE BY WHERE IT COMES FROM/.test(fxLater)&&/THE APP'S ENGINE PROMPTS/.test(fxLater)&&/memBuild — /.test(fxLater), (sc11[0]||"").slice(0,100));
    ok("the reconciler reads each section's generated, story and backend findings", /GENERATED CONTENT \(another engine's prompt\):\n- PE-GEN-KEY/.test(ft)&&/STORY DATA:\n- Buket · bio: PE-STORY-BIO/.test(ft)&&/BACKEND \(code\):\n- \[privacy\] PE-BACK-PRIV/.test(ft), ft.slice(ft.indexOf("EVERY SECTION'S PROPOSALS"),ft.indexOf("EVERY SECTION'S PROPOSALS")+600));
    const sec11=await pg.evaluate(()=>(document.querySelector("#kind_text")||{}).textContent||"");
    const secApply=await pg.evaluate(()=>!!document.querySelector("#kind_text .chg"));
    ok("each section lists its fixer's suggestions, with nothing to apply there", /This section's fixer suggested 1 edit: PE-SEC-SUMMARY/.test(sec11)&&/S:text#1/.test(sec11)&&!secApply, sec11.slice(0,300));
    OR.calls=[];
    await pg.evaluate(async()=>{ const b=document.querySelector("#kind_text [data-kfix]"); b.click(); for(let i=0;i<50&&__PE.ALL.running!==false;i++) await new Promise(r=>setTimeout(r,100)); await new Promise(r=>setTimeout(r,200)); });
    const kfx=OR.calls.filter(c=>c.claude).map(c=>c.body.messages[0].content);
    ok("Fix this section runs that section's fixer only", kfx.length===1&&/You are the FIXER for ONE test section of the author's roleplay model: Text messages/.test(kfx[0]), kfx.map(x=>x.slice(0,80)).join(" | "));
    const sel11=await pg.evaluate(()=>{ const box=document.querySelector("#overallBox"), bar=box.querySelector("[data-sapply]"), picks=box.querySelectorAll("[data-pick]");
      return {bar:!!bar,label:bar&&bar.textContent,picks:picks.length,checked:[...picks].every(x=>x.checked),title:/The complete change \(2 edits\)/.test(box.textContent)}; });
    ok("the final run proposes one complete change: every edit with a checkbox, and Apply selected", sel11.bar&&sel11.picks===2&&sel11.checked&&sel11.title&&/Apply selected \(\d\)/.test(sel11.label), JSON.stringify(sel11));
    const out11=await pg.evaluate(async()=>{ const P=__PE, box=document.querySelector('#overallBox [data-outside="rp"]'); const txt=box?box.textContent:"";
      const g=P.ALL.overall.generated[0]; const key=P.ITEMS().find(x=>x.type==="prompt"&&x.key!=="baseInstruction"&&x.key!=="formatRules"&&P.itemVal(x).length>200).key; g.prompt=key;
      renderOverall(); const b=document.querySelector('#overallBox [data-outside="rp"] [data-genfix]'); b.click();
      for(let i=0;i<50&&!(g.fixer);i++) await new Promise(r=>setTimeout(r,100)); await new Promise(r=>setTimeout(r,200));
      const row=document.querySelector('#overallBox [data-outside="rp"] [data-gen="0"]'); const ap=row&&row.querySelector('[data-a="apply"]');
      const md=P.backendMarkdown();
      return {txt:/Content another engine generated/.test(txt)&&/PE-GEN-COAT/.test(txt)&&/Story data to change/.test(txt)&&/PE-STORY-BIO/.test(txt)&&/Backend changes/.test(txt)&&/PE-BACK-PRIV/.test(txt)&&/Download the backend and story list/.test(txt),
        fixed:!!(g.fixer&&g.fixer.edits.length&&/PE-GEN-FIXED/.test(g.fixer.edits[0].replace)),key,applyReady:!!ap&&!ap.disabled,md:/PE-BACK-PRIV/.test(md)&&/PE-GEN-BACK/.test(md)&&/Story data to change/.test(md)&&/PE-STORY-BIO/.test(md)}; });
    const gcall=OR.calls.find(c=>c.claude&&/The roleplay tests found a problem in content that an ENGINE wrote/.test(c.body.messages[0].content)), gct=gcall?gcall.body.messages[0].content:"";
    ok("outside the wording: generated content (by engine prompt), story data and backend changes are listed under the analysis", out11.txt, JSON.stringify(out11));
    ok("a generated-content problem is sent to the engine prompt that wrote it, and its edits can be applied there", out11.fixed&&out11.applyReady&&/PE-GEN-COAT/.test(gct)&&new RegExp('prompt is "'+out11.key+'"').test(gct), JSON.stringify(out11));
    ok("the backend and story list downloads as one file, with the engine fixer's backend notes too", out11.md, JSON.stringify(out11));
    ok("its verdict shows the rubric, the structure notes and the edits", /Complete analysis/.test(all.box)&&/Memory/.test(all.box)&&/The trackers sit far from the reply/.test(all.box)&&/Moves/.test(all.box), all.box.slice(0,400));
    const mv=await pg.evaluate(MV=>{ const cards=[...document.querySelectorAll('#overallBox .chg')]; const c=cards.find(x=>/Moves/.test(x.textContent)); const b=c&&c.querySelector('[data-a="apply"]'); if(!b||b.disabled) return {ok:false,c:!!c,t:b&&b.textContent};
      b.click(); const v=__PE.itemVal(__PE.findItem("fx:guardrails.text")).split("\n").map(l=>l.trim()); const i=v.indexOf(MV.a), j=v.indexOf(MV.b);
      return {ok:true,i,j,label:b.textContent,undo:!c.querySelector('[data-a="undo"]').hidden}; },MV);
    ok("a move edit takes the line out and puts it right before the named one", mv.ok&&mv.i===mv.j-1&&mv.label==="Applied"&&mv.undo, JSON.stringify(mv));
    const mvu=await pg.evaluate(soloTpl=>{ const c=[...document.querySelectorAll('#overallBox .chg')].find(x=>/Moves/.test(x.textContent)); c.querySelector('[data-a="undo"]').click(); return __PE.itemVal(__PE.findItem("fx:guardrails.text"))===soloTpl; },soloTpl);
    ok("…and Undo puts the fragment's text back exactly", mvu);
    const as11=await pg.evaluate(()=>{ const box=document.querySelector("#overallBox"), cards=[...box.querySelectorAll(".chg")];
      const mv=cards.find(c=>/Moves/.test(c.textContent)), rw=cards.find(c=>/PE-ALL-FIX/.test(c.textContent));
      mv.querySelector("[data-pick]").checked=false; rw.querySelector("[data-pick]").checked=true; mv.querySelector("[data-pick]").dispatchEvent(new Event("change"));
      const before=__PE.itemVal(__PE.findItem("fx:guardrails.text")); [...box.querySelectorAll("[data-sapply]")].pop().click();
      const r={fix:/PE-ALL-FIX/.test(__PE.itemVal(__PE.findItem("fx:task.text"))),moveUntouched:__PE.itemVal(__PE.findItem("fx:guardrails.text"))===before};
      const u=rw.querySelector('[data-a="undo"]'); if(u&&!u.hidden) u.click(); return r; });
    ok("Apply selected applies the ticked edits only", as11.fix&&as11.moveUntouched, JSON.stringify(as11));
    ok("a rewrite edit applies once, and survives the list being rebuilt", await pg.evaluate(()=>{ const c=[...document.querySelectorAll('#overallBox .chg')].find(x=>/PE-ALL-FIX/.test(x.textContent)); const b=c&&c.querySelector('[data-a="apply"]'); if(!b||b.disabled) return false; b.click();
      __PE.renderEstimate(); const b2=[...document.querySelectorAll('#overallBox .chg')].find(x=>/PE-ALL-FIX/.test(x.textContent)).querySelector('[data-a="apply"]');
      return b2.textContent==="Applied"&&b2.disabled&&(__PE.itemVal(__PE.findItem("fx:task.text")).match(/PE-ALL-FIX/g)||[]).length===1; }));
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
      if(SCENE_RX.test(first)) return SCENE(first,j=>{ j.criteria.blend={score:5,note:"jumps",evidence:"x"}; });
      if(KIND_RX.test(first)) return KIND(first);
      return /JSON/i.test(first)?"{}":'"Tamam." *Gülümsüyor.*'; };
    const rb=await pg.evaluate(()=>{ localStorage.setItem("pe_v1_testmode",JSON.stringify("or")); localStorage.setItem("pe_v1_testrotation_or",JSON.stringify("x/rp-a, x/rp-b")); renderProvider();
      return {rot:testRotation(),box:document.querySelector("#driftModelBox").textContent,label:testLabel()}; });
    ok("a rotation of two or more models can be set for the model under test", rb.rot.join()==="x/rp-a,x/rp-b"&&/Rotation on/.test(rb.box)&&/rotating x\/rp-a → x\/rp-b/.test(rb.label), JSON.stringify(rb).slice(0,300));
    await pg.evaluate(()=>__PE.runDriftScenes([__PE.DRIFT_SCENES.find(x=>x.id==="text_night")]));
    const rr=await pg.evaluate(()=>{ const r=__PE.DR.results.text_night; return {models:r.turns.map(t=>t.replies[0].model),rotation:r.rotation,chips:[...document.querySelectorAll("#dr_text_night .rp .chip")].map(c=>c.textContent)}; });
    const sent=OR.calls.filter(c=>!c.claude).map(c=>c.body.model);
    ok("each reply goes to the next model in turn, starting from the first", sent.join()==="x/rp-a,x/rp-b,x/rp-a,x/rp-b"&&rr.models.join()===sent.join(), JSON.stringify({sent,models:rr.models}));
    ok("each reply shows the model that wrote it", rr.chips.join()==="x/rp-a,x/rp-b,x/rp-a,x/rp-b", rr.chips.join());
    const jr=OR.calls.find(c=>c.claude&&SCENE_RX.test(c.body.messages[0].content)), jrt=jr?jr.body.messages[0].content:"";
    ok("the judge sees which model wrote each reply and scores how the models go together", /MODEL ROTATION: the replies rotate between these models: x\/rp-a, x\/rp-b/.test(jrt)&&/\[model: x\/rp-b\]/.test(jrt)&&/blend — Rotating models go together/.test(jrt), jrt.slice(0,200));
    await pg.evaluate(()=>__PE.analyseTogether());
    const orr=OR.calls.find(c=>c.claude&&/COMPLETE ANALYSIS of a test run/.test(c.body.messages[0].content)), ort=orr?orr.body.messages[0].content:"";
    ok("the complete analysis is told about the rotation, with each model's replies and speed", /===== MODEL ROTATION =====/.test(ort)&&/- x\/rp-b: 2 replies, average/.test(ort)&&/how they go along together/.test(ort), ort.slice(ort.indexOf("MODEL ROTATION")-20,ort.indexOf("MODEL ROTATION")+400));
    const ob=await pg.evaluate(()=>({box:(document.querySelector("#overallBox")||{}).textContent||"",model:__PE.ALL.overall.model}));
    ok("its verdict on the rotation is shown, with the rubric's blend row", /Model rotation\./.test(ob.box)&&/PE-BLEND/.test(ob.box)&&/Rotating models go together/.test(ob.box)&&/rotating x\/rp-a → x\/rp-b/.test(ob.model), ob.box.slice(0,300));
    const ro=await pg.evaluate(()=>{ localStorage.setItem("pe_v1_testrotation_or",JSON.stringify("x/rp-a")); const one=testRotation().length; localStorage.setItem("pe_v1_testrotation_or",JSON.stringify("")); renderProvider();
      const sc=__PE.CRITERIA.filter(c=>c.rotation).length; return {one,off:testRotation().length,crit:sc}; });
    ok("one model, or none, is no rotation", ro.one===0&&ro.off===0&&ro.crit===1, JSON.stringify(ro));

    console.log("\n[11d — discussing the fixes with Claude under the complete analysis]");
    OR.calls=[];
    OR.answer=body=>{ const t=String(((body.messages||[])[0]||{}).content||"");
      if(/You are discussing the fixes for the roleplay prompts/.test(t)){
        if(/Second question/.test(t)) return "PE-CHAT-SECOND It is applied; nothing more to change.";
        const mk="fx:task.text — TEMPLATE:\n<<<\n", at=t.indexOf(mk), f=at<0?"":t.slice(at+mk.length).split("\n")[0].trim().slice(0,30);
        return "PE-CHAT-ANSWER Edit 2 is broader than it needs to be; here is a narrower one.\n```edits\n"+JSON.stringify([{item:"fx:task.text",kind:"rewrite",find:f,replace:f+" PE-CHAT-FIX",cause:"c",why:"narrower"}])+"\n```"; }
      return /JSON/i.test(t)?"{}":'"Tamam."'; };
    const dc=await pg.evaluate(async()=>{ const P=__PE;
      P.ALL.overall=P.ALL.overall||{score:6,summary:"s",edits:[]}; P.ALL.overall.edits=[{item:"fx:task.text",kind:"rewrite",find:"zz-not-there",replace:"PE-ZZ-NEW",why:"w"}]; renderOverall();
      const panel=!!document.querySelector('#overallBox [data-disc="rp"] textarea');
      await P.discussSend("rp","Make edit 2 smaller, please.");
      const box=document.querySelector('#overallBox [data-disc="rp"]'), txt=box.textContent, card=box.querySelector(".chg [data-a=apply]");
      const shownBlock=/```edits|PE-CHAT-FIX",/.test([...box.querySelectorAll(".bub")].map(b=>b.textContent).join(" "));
      card&&card.click(); const applied=/PE-CHAT-FIX/.test(P.itemVal(P.findItem("fx:task.text")));
      await P.discussSend("rp","Second question: is it in?");
      return {panel,answer:/PE-CHAT-ANSWER/.test(txt),card:!!card,shownBlock,applied,n:P.DISC.rp.length,second:/PE-CHAT-SECOND/.test(document.querySelector('#overallBox [data-disc="rp"]').textContent)}; });
    const dcalls=OR.calls.filter(c=>c.claude&&/You are discussing the fixes/.test(c.body.messages[0].content)).map(c=>c.body.messages[0].content);
    ok("a conversation sits under the complete analysis", dc.panel&&dc.answer, JSON.stringify(dc));
    ok("Claude is given the analysis with each edit's state, the reports, the payloads, the fragments of each path and the catalogue, not the dialogues", dcalls.length===2&&/PROPOSED EDITS:\n1\. \[missing\] fx:task.text/.test(dcalls[0])&&/===== THE FRAGMENTS OF THE SOLO PATH =====/.test(dcalls[0])&&/fx:task.text — /.test(dcalls[0])&&/===== THE REPORTS, ONE PER PAYLOAD KIND/.test(dcalls[0])&&/===== PAYLOAD: /.test(dcalls[0])&&!/^TURN \d+$/m.test(dcalls[0])&&/Make edit 2 smaller/.test(dcalls[0]), (dcalls[0]||"").slice(0,300));
    ok("an edit Claude proposes in the chat becomes an edit card, and applies", dc.card&&!dc.shownBlock&&dc.applied, JSON.stringify(dc));
    ok("the next message carries the conversation so far and sees what was just applied", /PE-CHAT-ANSWER/.test(dcalls[1]||"")&&/EDITS APPLIED SO FAR[\s\S]*PE-CHAT-FIX/.test(dcalls[1]||"")&&dc.second&&dc.n===4, (dcalls[1]||"").slice(0,200));
    const dcl=await pg.evaluate(()=>{ __PE.ALL.overall=null; renderOverall(); setOverall({score:5,summary:"new",edits:[]}); return __PE.DISC.rp.length; });
    ok("a new analysis starts a new conversation", dcl===0, dcl);

    console.log("\n[11e — before → after: what the changes since the earlier run did]");
    OR.calls=[];
    OR.answer=body=>{ const t=String(((body.messages||[])[0]||{}).content||"");
      if(/You are checking WHAT THE LAST CHANGES DID/.test(t)){ const mm=t.match(/^\+ (.*PE-NEW-OPENING.*)$/m), line=mm?mm[1].trim().slice(0,30):"";
        return JSON.stringify({summary:"PE-EFFECT-SUMMARY the new wording helped memory but hurt Turkish",edits:[{edit:"fx:task.text: the new opening",effect:"mixed",evidence:"memory 4→7, turkish 6→5"}],
          criteria:[{criterion:"memory",before:4,after:7,why:"w"},{criterion:"turkish",before:6,after:5,why:"w"}],regressions:["PE-EFFECT-REGRESSION Turkish got stiffer"],keep:["the memory line"],
          revert:[{item:"fx:task.text",kind:"rewrite",find:line,replace:"PE-REVERTED",why:"stiff"}],next:"look at the register"}); }
      if(/COMPLETE ANALYSIS of a test run/.test(t)) return JSON.stringify({score:6,summary:"PE-FIXER-2",criteria:{},patterns:[],structure:[],edits:[]});
      return /JSON/i.test(t)?"{}":'"Tamam."'; };
    const ef=await pg.evaluate(async()=>{ const P=__PE;
      lsSet("runsnaps",[]); await P.writeFixesAlone();                      // run 1: a snapshot, nothing to compare with
      const first=P.snaps().length, noEffect=!P.ALL.effect;
      /* the author applies an edit, and the scenes are played again: a later run with the new wording in its payload */
      const it=P.findItem("fx:task.text"), old=P.itemVal(it), line=old.split("\n").find(l=>l.trim().length>20).trim();
      P.setVal(it,old.replace(line,"PE-NEW-OPENING "+line)); /* the edit is AFTER run 1's snapshot (effectInput takes edits with t > prev.at): in the same millisecond as the snapshot
         it would not count as "in between" (a CI-only failure) */
      APPLIED["pe-eff"]={t:Math.max(Date.now(),((P.snaps().slice(-1)[0]||{}).at||0)+1),item:"fx:task.text",find:line,replace:"PE-NEW-OPENING "+line}; lsSet("applied",APPLIED);
      /* the later run is LATER than run 1's snapshot: on a fast machine Date.now() here can be the very millisecond the
         snapshot took as its id, and an equal id is not "earlier", so nothing would be compared (a CI-only failure) */
      const _later=Math.max(Date.now(),((P.snaps().slice(-1)[0]||{}).id||0)+1);
      P.DRIFT_SCENES.forEach(sc=>{ const r=P.DR.results[sc.id]; if(r&&r.turns&&r.turns.length){ r.at=_later; if(r.payload) r.payload={messages:r.payload.messages.map((m,i)=>i===0?Object.assign({},m,{content:String(m.content)+"\nPE-NEW-OPENING "+line}):m)};
        if(r.judge){ r.judge=Object.assign({},r.judge,{score:7,criteria:Object.assign({},r.judge.criteria,{memory:{score:7,note:"better"}})}); } } });
      await new Promise(r=>setTimeout(r,20));
      await P.writeFixesAlone();                                             // run 2: compared with run 1 before the fixer
      const box=(document.querySelector("#effectBox")||{}).textContent||"", rv=document.querySelector("#effectBox .chg [data-a=apply]");
      const res={first,noEffect,snaps:P.snaps().length,effect:!!P.ALL.effect,box:/PE-EFFECT-SUMMARY/.test(box)&&/PE-EFFECT-REGRESSION/.test(box)&&/mixed/.test(box)&&/Memory 4→7/.test(box),revert:!!rv&&!rv.disabled};
      rv&&rv.click(); res.reverted=/PE-REVERTED/.test(P.itemVal(it)); P.setVal(it,old); delete APPLIED["pe-eff"]; lsSet("applied",APPLIED); return res; });
    const ec=OR.calls.find(c=>c.claude&&/You are checking WHAT THE LAST CHANGES DID/.test(c.body.messages[0].content)), et=ec?ec.body.messages[0].content:"";
    const fx=OR.calls.filter(c=>c.claude&&/COMPLETE ANALYSIS of a test run/.test(c.body.messages[0].content)).pop(), fxt=fx?fx.body.messages[0].content:"";
    ok("the first run leaves a snapshot and has nothing to compare with", ef.first===1&&ef.noEffect, JSON.stringify(ef));
    ok("the next run is compared with it first: the edit in between, the payload diff, the scores before → after", !!ec&&/PE-NEW-OPENING/.test(et.split("===== THE SCORES")[0])&&/^\+ .*PE-NEW-OPENING/m.test(et)&&/^- /m.test(et)&&/→ 7 \(\+/.test(et)&&/BEFORE: /.test(et), et.slice(0,300));
    ok("the fixer reads what the last changes did", /WHAT THE LAST CHANGES DID[\s\S]*PE-EFFECT-SUMMARY/.test(fxt)&&/PE-EFFECT-REGRESSION/.test(fxt), fxt.slice(0,200));
    ok("the verdict shows above the complete analysis, with a revert you can apply", ef.effect&&ef.box&&ef.revert&&ef.reverted&&ef.snaps===2, JSON.stringify(ef));

    console.log("\n[11f — every analysis call is queued one at a time, retried when rate-limited, and asked again shorter when cut off]");
    const q=await pg.evaluate(async()=>{ const P=__PE, orig=AI.sample.json; let peak=0, active=0; const seen=[]; P.CQ.rlWait=50;
      let rl=0;
      AI.sample.json=async(input)=>{ active++; peak=Math.max(peak,active); seen.push(input); await new Promise(r=>setTimeout(r,30)); active--;
        if(/RL-TEST/.test(input)&&rl++<1) throw {code:"rate_limited",message:"slow"};
        if(/CUT-TEST/.test(input)&&!/your previous answer was cut off/.test(input)) throw {code:"invalid_json",message:"cut"};
        return {ok:true}; };
      const r=await Promise.all([P.claudeJson("A RL-TEST",{}),P.claudeJson("B CUT-TEST",{}),P.claudeJson("C",{})]);
      AI.sample.json=orig; P.CQ.rlWait=0;
      return {peak,ok:r.every(x=>x&&x.ok),n:seen.length,shorter:seen.some(x=>/CUT-TEST[\s\S]*Answer again, much shorter/.test(x))}; });
    ok("one Claude request at a time, a rate limit waits and retries, a cut-off answer is asked again shorter", q.peak===1&&q.ok&&q.n===5&&q.shorter, JSON.stringify(q));

    console.log("\n[11g — an edit whose words are not found is repaired, or explained with a button to fix it]");
    const rp=await pg.evaluate(async()=>{ const P=__PE, it=P.findItem("fx:task.text"), v=P.itemVal(it), line=v.split("\n").find(l=>l.trim().split(/\s+/).length>=6).trim();
      const words=line.split(/\s+/), spaced=words.slice(0,6).join("   ");                       // spacing differs
      const e1={item:"fx:task.text",kind:"rewrite",find:spaced,replace:"PE-RP1",why:"w"};
      const other=P.ITEMS().find(x=>x.type==="frag"&&P.itemVal(x).trim().split("\n")[0].trim().length>30), oline=P.itemVal(other).trim().split("\n")[0].trim().slice(0,30);
      const e2={item:"fx:task.text",kind:"rewrite",find:oline,replace:"PE-RP2",why:"w"};       // the wrong piece named
      const e3={item:"fx:task.text",kind:"rewrite",find:"Buket Özüçak "+words.slice(0,4).join(" ")+" PE-FILLED",replace:"PE-RP3",why:"w"};   // filled story data
      const r1=P.locateEdit(e1), r2=P.locateEdit(e2), r3=P.locateEdit(e3);
      const host=document.createElement("div"); document.body.appendChild(host); const c3=editCard(e3); host.appendChild(c3);
      const note=(c3.querySelector(".missNote")||{}).textContent||"", fixBtn=c3.querySelector('[data-a="repair"]'), applyTxt=c3.querySelector('[data-a="apply"]').textContent;
      const orig=AI.sample.json; let sent="";
      AI.sample.json=async(input)=>{ sent=input; return {edits:[{i:1,find:words.slice(0,4).join(" "),replace:"PE-RP3"}]}; };
      fixBtn.click(); for(let i=0;i<30&&!/Repaired/.test(host.textContent);i++) await new Promise(r=>setTimeout(r,100));
      AI.sample.json=orig;
      const after=host.querySelector('[data-a="apply"]'), res={r1,find1:e1.find===words.slice(0,6).join(" ")||P.itemVal(it).indexOf(e1.find)>=0,r2,item2:e2.item,r3,applyTxt,note:/copied from the filled payload/.test(note),fixVisible:!fixBtn.hidden,
        sent:/CURRENT TEXT OF fx:task.text/.test(sent)&&/PE-FILLED/.test(sent),repaired:/Repaired \(copied again\)/.test(host.textContent),ready:after&&!after.disabled&&after.textContent==="Apply"};
      host.remove(); return res; });
    ok("loose spacing is matched to the piece's exact words", rp.r1==="fixed"&&rp.find1, JSON.stringify(rp));
    ok("words that sit in another piece re-target the edit to that piece", rp.r2==="fixed"&&rp.item2!=="fx:task.text", JSON.stringify(rp));
    ok("words that are nowhere say why, with Fix this edit", rp.r3==="missing"&&rp.applyTxt==="Text not found"&&rp.note&&rp.fixVisible, JSON.stringify(rp));
    ok("Fix this edit shows Claude the piece's current text, and the repaired edit can be applied", rp.sent&&rp.repaired&&rp.ready, JSON.stringify(rp));

    console.log("\n[11c — a long run still fits one request to Claude, and a failed fixing step can be run again]");
    const fit=await pg.evaluate(async()=>{ const P=__PE, long="Şöyle düşünüyorum, ağabeyciğim: gülüşün öğleden beri aklımdan çıkmıyor, işte böyle. ".repeat(40);
      const keep=JSON.stringify(P.DR.results), keepO=P.ALL.overall;
      P.DRIFT_SCENES.forEach(sc=>{ const sp=(sc.speakers||[sc.speaker]);
        P.DR.results[sc.id]={at:Date.now(),model:"m",payload:null,turns:sc.lines.map(l=>({user:typeof l==="string"?l:l.gm,gm:typeof l!=="string",reply:long,replies:sp.map(id=>({id,name:id,text:long}))})),
          judge:{score:5,summary:"s",criteria:{turkish:{score:5,note:"n",evidence:"e"}},turns:sc.lines.map(()=>({verdict:"weak",note:"n"})),findings:[{criterion:"turkish",turn:1,problem:"p",evidence:"e",cause:"c"}]}}; });
      const huge=P.apBuild("fixer",{section:"S",report:"Şöyle düşünüyorum ğüşıöç. ".repeat(9000),layout:P.overallInput().layouts,catalogue:P.overallInput().catalogue,payload:"ğ".repeat(60000)});
      const rawBytes=P.apBytes("Şöyle düşünüyorum ğüşıöç. ".repeat(9000))+P.apBytes("ğ".repeat(60000)), hugeOk=P.apBytes(huge)<=P.AP_CAP&&/Reply with ONLY this JSON/.test(huge)&&/===== THE FRAGMENTS OF THE SOLO PATH =====/.test(huge)&&/cut here to fit/.test(huge);
      lsSet("runsnaps",[]);   // no earlier run: the first call is the fixer's
      let sent=null, calls=0; const orig=AI.sample.json, fixIns=[];
      AI.sample.json=async(input)=>{ if(/You are the FIXER for ONE test section/.test(input)){ fixIns.push(input); return {summary:"s",edits:[]}; }
        if(!/RECONCILER/.test(input)) return {};
        calls++; sent=input; if(calls===1) throw {code:"prompt_too_large",message:"too big"}; return {score:6,summary:"PE-FIXED",criteria:{},patterns:[],structure:[],edits:[]}; };
      await P.writeFixesAlone();
      const failBox=(document.querySelector("#overallBox")||{}).textContent||"", btn=document.querySelector("#overallBox [data-refix]");
      const first=sent; btn&&btn.click(); for(let i=0;i<50&&!(P.ALL.overall&&P.ALL.overall.summary==="PE-FIXED");i++) await new Promise(r=>setTimeout(r,100));
      const okBox=(document.querySelector("#overallBox")||{}).textContent||"";
      AI.sample.json=orig;
      const eng=P.apBuild("engfinal",{reports:"ş".repeat(150000),proposals:"ğ".repeat(150000),applied:""});
      const secs=P.KINDS.filter(kd=>P.KA[kd.k]&&P.KA[kd.k].at);
      const res={rawBytes,hugeOk,bytes:Math.max(P.apBytes(first),...fixIns.map(x=>P.apBytes(x))),cap:P.AP_CAP,titles:secs.length>=1&&secs.every(kd=>first.indexOf("## "+kd.label+" (the ")>=0),json:/Reply with ONLY this JSON/.test(first),solo:/===== EVERY SECTION'S PROPOSALS/.test(first),
        failBox:/The complete analysis failed/.test(failBox)&&/256 KB/.test(failBox)&&!!btn,fixed:/PE-FIXED/.test(okBox),calls,engBytes:P.apBytes(eng),engJson:/Reply with ONLY this JSON/.test(eng)&&/cut here to fit/.test(eng)};
      P.DR.results=JSON.parse(keep); P.ALL.overall=keepO; return res; });
    ok("a section fixer whose data is far over the limit is cut to fit, keeping the instructions, the layout and the reply format", fit.rawBytes>fit.cap&&fit.hugeOk, JSON.stringify({raw:fit.rawBytes,cap:fit.cap,ok:fit.hugeOk}));
    ok("…every section's fixer and the reconciler stay under it, one fixer per analysed section", fit.bytes<=fit.cap&&fit.titles&&fit.json&&fit.solo, JSON.stringify({bytes:fit.bytes,titles:fit.titles,json:fit.json,solo:fit.solo}));
    ok("a failed fixing step stays on screen with its reason and a button to write the fixes again", fit.failBox, JSON.stringify(fit));
    ok("…which runs the fixing step again and shows its fixes", fit.fixed&&fit.calls===2, JSON.stringify({fixed:fit.fixed,calls:fit.calls}));
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
      const base={context:"CTX",kind:"k",criteria:"C",reports:"S",payload_scene:"T",payload:"PL",rotation:""};
      const sc=P.apFill(P.apText("kind"),Object.assign({},base,{applied:""})), sc2=P.apFill(P.apText("kind"),Object.assign({},base,{applied:"- frag:x: «a» → «b»"}));
      const rv=P.apFill(P.apText("review"),{context:"CTX",payload:"PL",reply:"R",catalogue:"C"});
      return {ids:P.AP_DEFS.map(d=>d.id),ctxKeeps:/\{\{call\/\/name\}\}/.test(P.apText("context"))&&/\{\{name\}\} values/.test(P.apText("context")),
        noApplied:!/CHANGES APPLIED SINCE/.test(sc),applied:/CHANGES APPLIED SINCE THESE SCENES WERE PLAYED/.test(sc2)&&/frag:x/.test(sc2),left:/\{\{[#^\/]/.test(sc+sc2)||/\{\{(reports|payload|criteria|kind)\}\}/.test(sc+sc2),
        keepsMarkers:/Keep \{\{…\}\} and \[\[…\]\] markers intact/.test(rv)}; });
    ok("every prompt sent to Claude is listed (method, ask, review, scene, payload kind, engine, fixer, before → after, engine analysis, discuss, compare, stand-in, decide, decfix)", apx.ids.join()==="context,ask,review,scene,kind,engine,fixer,overseer,effect,engscene,engfixer,engfinal,engeffect,genfix,editrepair,discuss,compare,standin,decide,decfix", apx.ids.join());
    ok("templates fill their data and flags, and leave the app's own {{…}} markers alone", apx.ctxKeeps&&apx.noApplied&&apx.applied&&!apx.left&&apx.keepsMarkers, JSON.stringify(apx));
    await pg.click('#rtabs button[data-r="ap"]');
    await pg.evaluate(()=>{ const ta=document.querySelector('#apList [data-ap="kind"] textarea'); ta.value=ta.value.replace("You are RE-EVALUATING the scene reports","PE-AP-EDIT You are RE-EVALUATING the scene reports"); ta.dispatchEvent(new Event("input")); });
    await pg.waitForTimeout(700);
    OR.calls=[];
    await pg.evaluate(async()=>{ await __PE.analyseKinds(["solo_memory"]); });
    const used15=OR.calls.find(c=>c.claude&&KIND_RX.test(c.body.messages[0].content));
    const ui15=await pg.evaluate(()=>{ __PE.renderAp(); const el=document.querySelector('#apList [data-ap="kind"]'); return {chip:/edited/.test(el.querySelector("h3").textContent),last:el.querySelector("pre").textContent}; });
    ok("an edit is used by the next analysis, and the exact text sent is shown", !!used15&&/PE-AP-EDIT/.test(used15.body.messages[0].content)&&ui15.chip&&/PE-AP-EDIT/.test(ui15.last)&&/HOW TO FIX/.test(ui15.last), JSON.stringify({used15:!!used15,chip:ui15.chip}));
    const rs15=await pg.evaluate(()=>{ document.querySelector('#apList [data-ap="kind"] [data-reset]').click(); return !/PE-AP-EDIT/.test(__PE.apText("kind")); });
    ok("Reset brings the shipped prompt back", rs15);

    console.log("\n[16 — the order on screen, and edits applied since a test ran]");
    const ord16=await pg.evaluate(()=>{ __PE.renderAp&&0; const dom=[...document.querySelectorAll("#driftList .scene")].filter(e=>/^dr_/.test(e.id)).map(e=>e.id.replace(/^dr_/,""));
      return {arr:__PE.DRIFT_SCENES.map(x=>x.id),dom,first:__PE.DRIFT_SCENES[0].theme}; });
    ok("scenes are played and analysed in the order the Tests tab numbers them", ord16.first==="Daily life"&&(ord16.dom.length===0||ord16.dom.join()===ord16.arr.join()), JSON.stringify({first:ord16.arr.slice(0,3),dom:ord16.dom.slice(0,3)}));
    OR.calls=[];
    const ap16=await pg.evaluate(async()=>{ const P=__PE, sc=P.DRIFT_SCENES.find(x=>x.id==="memory_truth"), r=P.DR.results[sc.id];
      const it=P.findItem("fx:task.text"), v=P.itemVal(it), old=v.slice(0,40);
      P.setVal(it,"PE-NEW-WORDING "+v.slice(40));
      const k="fx:task.text\u0001"+old+"\u0001PE-NEW-WORDING ";
      APPLIED[k]={at:0,t:Date.now(),item:"fx:task.text",find:old,replace:"PE-NEW-WORDING "}; lsSet("applied",APPLIED);
      r.at=Date.now()-60000; r.judge=null; await P.analyseKinds(["solo_memory"]);
      const stale={item:"fx:task.text",kind:"rewrite",find:old,replace:"PE-STALE-REPLACEMENT",why:"w"};
      return {state:editState(stale,it)}; });
    const sin16=OR.calls.find(c=>c.claude&&KIND_RX.test(c.body.messages[0].content));
    const st16=sin16?sin16.body.messages[0].content:"";
    ok("the judge is told which edits were applied after the scene was played", /CHANGES APPLIED SINCE THESE SCENES WERE PLAYED/.test(st16)&&/PE-NEW-WORDING/.test(st16), st16.slice(-1500));
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
    ok("and no bundled prompts file was opened", (a.file||"")===""&&bundledAsks.filter(u=>/\/art\//.test(u)).length===0, a.file);
    ok("the editor's own source is never taken for StoryMind", await art.evaluate(async()=>{ const t=await (await fetch("index.html")).text(); return !isAppSource(t); }));
    errs.push(...artErrs);
    await actx.close();

    ok("no page errors", errs.length===0, errs.join("\n"));
  }catch(e){ fail++; console.log("  FAIL  crashed: "+(e.stack||e)); }
  await b.close(); srv.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail?1:0);
})();
