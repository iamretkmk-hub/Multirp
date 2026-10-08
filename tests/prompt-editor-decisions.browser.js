/* THE PROMPT EDITOR AND THE DECISION AGENTS (v150.74). The app takes every reply's decisions (the emotion pick with its
   id/superego answer, the fragments' questions, spoken limits), checks every reply, and gates, tracks, routes and judges through
   the Decisions API — a request that is not a chat completion, so the editor's sandbox used to answer none of them and built
   payloads the phone never builds. Pinned here:
     A  the sandbox records every Decisions request and answers it by the mode: off, Claude standing in, or the real API
     B  a preview can set the decisions by hand, and the payload follows them (an option that needs a decision fires)
     C  a build can take its decisions the way the app does (the line sendMessage would hand the emotion pick)
     D  the reply check runs on a reply in its scene, and its flags reach the next payload
   Run: node tests/prompt-editor-decisions.browser.js   (needs playwright; see tests/README.md) */
const {chromium}=require('playwright');
const http=require('http'), fs=require('fs'), path=require('path');
const BIN=process.env.SM_CHROME||process.env.CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const ROOT=path.resolve(__dirname,'..');
(async()=>{
  const srv=http.createServer((q,r)=>{
    const rel=decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/,'');
    const f=path.join(ROOT,rel||'index.html');
    if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){ r.writeHead(404); r.end(); return; }
    r.writeHead(200,{'Content-Type':f.endsWith('.html')?'text/html; charset=utf-8':'application/octet-stream'}); fs.createReadStream(f).pipe(r);
  });
  await new Promise(r=>srv.listen(0,'127.0.0.1',r));
  const base='http://127.0.0.1:'+srv.address().port+'/';
  const b=await chromium.launch({executablePath:BIN});
  const ctx=await b.newContext({viewport:{width:1300,height:900}});
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
  await ctx.route(/prompt-editor-(start|world)\.json/,r=>r.fulfill({status:404,body:""}));
  /* The Decisions API stood in for: every request recorded; each question answered by DEC.answer (default: the first
     criterion of a choice, 0.9 for a yes/no). Chat completions answer a short line. */
  const DEC={calls:[],answer:null};
  const decAnswer=(k,q)=>{ if(DEC.answer){ const a=DEC.answer(k,q); if(a)return a; }
    if(q.type==="noul") return {noul:0.9};
    const keys=Object.keys(q.criteria||{}); const pr={}; keys.forEach((c,i)=>{ pr[c]=i===0?0.7:0.3/Math.max(1,keys.length-1); }); return {choice:keys[0],probabilities:pr}; };
  await ctx.route(/openrouter\.ai/,async r=>{
    const url=r.request().url();
    if(/\/models/.test(url)) return r.fulfill({status:200,contentType:"application/json",body:JSON.stringify({data:[{id:"deepseek/deepseek-v4-pro"}]})});
    const body=JSON.parse(r.request().postData()||"{}");
    if(/\/alpha\/decisions/.test(url)){ DEC.calls.push(body); const ans={}; Object.keys(body.questions||{}).forEach(k=>{ ans[k]=decAnswer(k,body.questions[k]); });
      return r.fulfill({status:200,contentType:"application/json",body:JSON.stringify({answers:ans,usage:{prompt_tokens:10}})}); }
    await r.fulfill({status:200,contentType:"application/json",body:JSON.stringify({choices:[{message:{role:"assistant",content:'"Tamam." *Gülümsüyor.*'},finish_reason:"stop"}]})});
  });
  /* Claude, as the Claude app serves it: CL.answer(input) decides what it says (default: an answers object for a decide
     prompt, "{}" otherwise). Every input is recorded. */
  const CL={calls:[],answer:null};
  await ctx.exposeFunction("__claudeAnswer",async input=>{ CL.calls.push(String(input));
    if(CL.answer){ const a=CL.answer(String(input)); if(a!=null) return a; }
    const m=String(input).match(/QUESTIONS:\n([\s\S]*)$/);
    if(/standing in for a DECISIONS model/.test(input)&&m){ let qs={}; try{ qs=JSON.parse(m[1]); }catch(e){}
      const ans={}; Object.keys(qs).forEach(k=>{ ans[k]=decAnswer(k,qs[k]); }); return JSON.stringify({answers:ans}); }
    return "{}"; });
  const installClaude=p=>p.evaluate(()=>{ const f=async(input,o)=>{ const t=typeof input==="string"?input:input.map(m=>m.content).join("\n\n"); const text=String(await window.__claudeAnswer(t)); o&&o.onText&&o.onText({text}); return {text,truncated:false}; };
      f.json=async(input,o)=>{ const t=await f(input,o); const m=String(t.text).match(/\{[\s\S]*\}/); return JSON.parse(m?m[0]:t.text); };
      AI.sample=f; renderProvider(); });
  const pg=await ctx.newPage();
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x===undefined?c:x).slice(0,900));} };
  try{
    await pg.goto(base+'prompt-editor.html');
    await pg.waitForFunction(()=>window.__PE&&window.__PE.ENG.ready&&window.__PE.S.preview&&window.__PE.S.preview.messages,null,{timeout:90000});
    await installClaude(pg);

    console.log("\n[A — the sandbox records every Decisions request and answers it by the mode]");
    const meta=await pg.evaluate(()=>__PE.S.meta.decisions);
    ok("the engine tells the editor its Decisions features, each with the prompts it reads", meta&&meta.features.length>=10&&meta.features.find(f=>f.name==="Emotion pick").keys.indexOf("x_ego_pick")>=0&&meta.features.find(f=>f.name==="Reply check").keys.length>=5, JSON.stringify(meta&&meta.features.map(f=>f.name+":"+f.keys.length)));
    ok("and the emotion list, the levels and the reply check's questions", meta.emotions.length>=10&&meta.egoLevels.length===6&&meta.emoLevels.length===3&&meta.replyChecks.length>=5, JSON.stringify({e:meta.emotions.length,g:meta.egoLevels.length}));
    const off=await pg.evaluate(async()=>{ await __PE.engCall("setDecMode",{mode:"off"}); const p=await __PE.engCall("build",{kind:"solo",decide:true}); const log=await __PE.engCall("decLog",{since:0}); return {dec:p.decisions,calls:p.decCalls,log:log.length}; });
    ok("mode off: the reply's request is recorded and gets no answer (no emotion, no asks)", off.calls.length>=1&&off.calls.every(c=>c.answers==null&&c.mode==="off")&&!(off.dec&&off.dec.emotion), JSON.stringify(off).slice(0,600));
    ok("the recorded request names its feature and the prompts it read", off.calls[0].feature==="Emotion pick"&&off.calls[0].prompts.indexOf("x_emotion_pick")>=0&&!!off.calls[0].body.questions.emotion, JSON.stringify(off.calls[0]&&{f:off.calls[0].feature,p:off.calls[0].prompts}));
    CL.calls.length=0;
    const cl=await pg.evaluate(async()=>{ await __PE.engCall("setDecMode",{mode:"claude"}); const p=await __PE.engCall("build",{kind:"solo",decide:true}); await __PE.engCall("setDecMode",{mode:"off"}); return {dec:p.decisions,calls:p.decCalls}; });
    ok("mode claude: Claude answers the typed questions, and the reply's decisions are stored", !!(cl.dec&&cl.dec.emotion&&cl.dec.ego)&&cl.calls[0].answers&&CL.calls.some(t=>/standing in for a DECISIONS model/.test(t)), JSON.stringify(cl.dec).slice(0,300));
    ok("Claude is handed the request's state and questions exactly", CL.calls.some(t=>/"emotion"/.test(t)&&/"ego"/.test(t)&&/STATE:/.test(t)), CL.calls.map(t=>t.slice(0,80)).join(" | "));
    DEC.calls.length=0;
    const orr=await pg.evaluate(async()=>{ lsSet("orkey","sk-or-test"); NET.ok=true; await pushModelToEngine();
      return await withDecisions(async()=>{ const p=await __PE.engCall("build",{kind:"solo",decide:true}); return {dec:p.decisions,calls:p.decCalls}; },"or"); });
    ok("mode or: StoryMind's own request goes to the Decisions API (the relay lets it through) and its answer is used", DEC.calls.length>=1&&!!(orr.dec&&orr.dec.emotion)&&orr.calls[0].mode==="or", JSON.stringify({n:DEC.calls.length,dec:orr.dec&&orr.dec.emotion}));

    console.log("\n[B — decisions set by hand reach the payload]");
    const hand=await pg.evaluate(async()=>{
      const em=__PE.S.meta.decisions.emotions[0].name;
      const a=await __PE.engCall("build",{kind:"solo"});
      const b=await __PE.engCall("build",{kind:"solo",decisions:{emotion:em,intensity:"intense",ego:"id_winning"}});
      return {em,a:a.fired.map(f=>f.id+":"+(f.opts||[]).map(o=>o.id).join("/")),b:b.fired.map(f=>f.id+":"+(f.opts||[]).map(o=>o.id).join("/")),dec:b.decisions}; });
    ok("the record is the one the payload reads (emotion, its tone at that intensity, the id/superego answer)", hand.dec&&hand.dec.emotion===hand.em&&hand.dec.intensity==="intense"&&!!hand.dec.tone&&hand.dec.ego==="id_winning", JSON.stringify(hand.dec));
    ok("an option that needs the decision fires only with it (the compass at id_winning)", hand.b.join(" ").indexOf("id_winning")>=0&&hand.a.join(" ").indexOf("id_winning")<0, JSON.stringify(hand));

    console.log("\n[B2 — the preview's decisions panel]");
    const pv=await pg.evaluate(async()=>{
      const em=__PE.S.meta.decisions.emotions[0].name;
      $("#plKind").value="solo"; $("#plKind").onchange();
      PV.src="hand"; PV.emotion=em; PV.intensity="intense"; PV.ego="torn"; PV.asks={}; PV.flags=["character"]; pvSave(); fillDecControls();
      const asks=[...document.querySelectorAll("#decAsks [data-ask]")].map(e=>e.dataset.ask);
      refreshPreview(); await new Promise(r=>setTimeout(r,1500));
      const p=__PE.S.preview, txt=$("#plOut").textContent;
      return {asks,dec:p.decisions,fired:(p.fired||[]).map(f=>f.id+":"+(f.opts||[]).map(o=>o.id).join("/")),line:/Decisions \(set by hand\)/.test(txt),em}; });
    ok("set by hand: the panel lists the path's questions by the key the app stores them under", pv.asks.length>=1&&pv.asks.every(k=>/^q_.+__.+/.test(k)), JSON.stringify(pv.asks));
    ok("and the preview is built with those decisions, and says so", pv.dec&&pv.dec.emotion===pv.em&&pv.dec.ego==="torn"&&pv.line, JSON.stringify(pv.dec));
    ok("a flag set on their last reply reaches the guardrails", /guardrails:[^ ]*(broke_character|consistency_character)/.test(pv.fired.join(" ")), JSON.stringify(pv.fired.filter(x=>/guard/.test(x))));
    const pa=await pg.evaluate(async()=>{ PV.src="ask"; PV.asked=null; await decAskNow(); await new Promise(r=>setTimeout(r,300));
      return {src:PV.src,dec:PV.asked&&PV.asked.decisions,calls:(PV.asked&&PV.asked.calls||[]).length,txt:/Decisions \(asked\)/.test($("#plOut").textContent)}; });
    ok("Ask: the decision model answers this reply's request and the preview uses it", pa.src==="ask"&&pa.dec&&!!pa.dec.emotion&&pa.calls>=1&&pa.txt, JSON.stringify(pa).slice(0,300));
    const items=await pg.evaluate(async()=>{
      const I=__PE.ITEMS(), dec=I.filter(it=>it.group==="Decision agents");
      const ego=__PE.findItem("prompt:x_ego_pick"), emo=I.find(it=>it.type==="emo"&&/\.desc$/.test(it.key));
      const bg=I.filter(it=>it.group==="Background engines").map(it=>it.key);
      __PE.setVal(emo,__PE.itemVal(emo)+" EMO-EDIT");
      const ex=buildExport();
      select(ego); await new Promise(r=>setTimeout(r,2500));
      const p=__PE.S.preview;
      return {n:dec.length,ego:ego&&ego.group,egoInBg:bg.indexOf("x_ego_pick")>=0,emo:emo&&emo.key,exp:ex.settings.emotions||"",
        prev:{dec:!!(p&&p.decision),feature:p&&p.feature,qs:(p&&p.messages||[]).map(m=>m.role).join(" | ")}}; });
    ok("the decision agents are their own group, by feature, and not among the background engines", items.n>=30&&items.ego==="Decision agents"&&!items.egoInBg, JSON.stringify(items).slice(0,300));
    ok("an emotion's description is an item, and its edit travels in the export's emotion list", !!items.emo&&/EMO-EDIT/.test(items.exp)&&Array.isArray(JSON.parse(items.exp)), JSON.stringify({emo:items.emo,exp:String(items.exp).slice(0,120)}));
    ok("a decision agent's prompt previews the request it sends (its state and its questions)", items.prev.dec&&items.prev.feature==="Emotion pick"&&/state/.test(items.prev.qs)&&/question · ego/.test(items.prev.qs), JSON.stringify(items.prev));

    console.log("\n[D — the reply check, in the scene]");
    const ck=await pg.evaluate(async()=>{
      const sc={chat:{presentIds:["p_buket"]},opener:"*Akşam.*",turns:[{role:"user",content:"Nasılsın?"},{role:"assistant",speaker:"Buket Özüçak",speakerId:"p_buket",content:"\"İyiyim.\" *Emre gülümsedi ve oturdu.*"}]};
      const r=await withDecisions(()=>__PE.engCall("check",{kind:"solo",speakerId:"p_buket",scene:sc}),"claude");
      const sc2=JSON.parse(JSON.stringify(sc)); sc2.turns[1].replyFlags=r?r.flags:[]; sc2.turns.push({role:"user",content:"Peki."});
      const p=await __PE.engCall("build",{kind:"solo",speakerId:"p_buket",scene:sc2});
      return {r,fired:p.fired.map(f=>f.id+":"+(f.opts||[]).map(o=>o.id).join("/"))}; });
    ok("the check answers every question and flags past the threshold", ck.r&&ck.r.probs&&Object.keys(ck.r.probs).length>=5&&ck.r.flags.length>=1&&ck.r.calls[0].feature==="Reply check", JSON.stringify(ck.r&&{p:ck.r.probs,f:ck.r.flags}));
    ok("the flags on the reply reach the next payload's guardrails", /guardrails:[^ ]*(broke_character|spoke_for_player|repeated|lost_track|consistency)/.test(ck.fired.join(" ")), JSON.stringify(ck.fired.filter(x=>/guard/.test(x))));

    ok("no page errors", errs.length===0, errs.join(" | "));
  }catch(e){ fail++; console.log("  FAIL  (threw) "+(e&&e.stack||e)); }
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close(); srv.close(); process.exit(fail?1:0);
})();
