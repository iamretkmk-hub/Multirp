/* THE PROMPT EDITOR AND THE DECISION AGENTS (v150.75). The app takes every reply's decisions (the emotion pick with its
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
    ok("the recorded request names its feature and the prompts it read", off.calls[0].feature==="Emotion pick"&&off.calls[0].prompts.indexOf("x_feel_move")>=0&&!!off.calls[0].body.questions.f_desire, JSON.stringify(off.calls[0]&&{f:off.calls[0].feature,p:off.calls[0].prompts}));
    CL.calls.length=0;
    const cl=await pg.evaluate(async()=>{ await __PE.engCall("setDecMode",{mode:"claude"}); const p=await __PE.engCall("build",{kind:"solo",decide:true}); await __PE.engCall("setDecMode",{mode:"off"}); return {dec:p.decisions,calls:p.decCalls}; });
    ok("mode claude: Claude answers the typed questions, and the reply's decisions are stored", !!(cl.dec&&cl.dec.emotion&&cl.dec.ego)&&cl.calls[0].answers&&CL.calls.some(t=>/standing in for a DECISIONS model/.test(t)), JSON.stringify(cl.dec).slice(0,300));
    ok("Claude is handed the request's state and questions exactly", CL.calls.some(t=>/"f_desire"/.test(t)&&/"ego"/.test(t)&&/STATE:/.test(t)), CL.calls.map(t=>t.slice(0,80)).join(" | "));
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

    console.log("\n[E — a roleplay scene takes its decisions, and is checked, reply by reply]");
    CL.answer=t=>/Below is the complete request an app sends/.test(t)?'"Tamam, gel otur." *Kapıyı açıyor.*':null;
    const sc=await pg.evaluate(async()=>{
      lsSet("testmode","claude"); lsSet("decmode","claude"); lsSet("driftdec",true);
      const scene=JSON.parse(JSON.stringify(__PE.DRIFT_SCENES.find(x=>x.kind==="solo"))); scene.lines=scene.lines.slice(0,2);
      const out=await __PE.playScene(scene,async p=>await generateReply(p,null),null,null);
      return {turns:out.turns,mode:out.decisions,ex:__PE.exchangeText(scene,out.turns)}; });
    const r0=sc.turns[0].replies[0], r1=sc.turns[1].replies[0];
    ok("each reply is built after its decisions, and carries them", sc.mode==="claude"&&r0.decisions&&!!r0.decisions.emotion&&r1.decisions&&!!r1.decisions.emotion, JSON.stringify(r0.decisions));
    ok("each reply is checked after it is posted", !!(r0.check&&r0.check.probs&&Object.keys(r0.check.probs).length>=5), JSON.stringify(r0.check));
    ok("the judge reads the decisions under each reply", /\[decided before this reply: [^\]]*\|\s*reply check/.test(sc.ex), sc.ex.slice(0,600));
    /* (!) v150.110 — CHANGED ON PURPOSE: the feelings themselves carry over (feelings_running_now), not a label "a few lines ago" */
    const carry=CL.calls.filter(t=>/standing in for a DECISIONS model/.test(t)&&/"f_desire"/.test(t));
    ok("the second reply's request knows the first one's feelings in this scene (carried over)", carry.length>=2&&/feelings_running_now/.test(carry[carry.length-1]), carry.length+" "+String(carry[carry.length-1]||"").match(/feelings_running_now[^\n]*/));
    const fx=await pg.evaluate(()=>{ const t=__PE.decisionPromptsText(); return {ego:/prompt:x_ego_pick/.test(t),chk:/prompt:x_reply_check_character/.test(t),emo:/emo:<Emotion>\.desc/.test(t)}; });
    ok("the fixers get the decision prompts and the emotions when a section ran with decisions", fx.ego&&fx.chk&&fx.emo, JSON.stringify(fx));
    const judge=await pg.evaluate(()=>__PE.apText("scene"));
    ok("the scene judge can blame a decision (a fifth source) and name its prompt", /"decision"/.test(judge)&&/x_ego_pick/.test(judge)&&/emo:<Emotion>\.desc/.test(judge), "");
    CL.answer=null;

    console.log("\n[F — a live engine run takes and records the decisions]");
    CL.answer=t=>/Below is the complete request an app sends/.test(t)?'"Evet, buradayım." *Gülümsüyor.*':null;
    CL.calls.length=0;
    const lv=await pg.evaluate(async()=>{
      await __PE.engCall("liveBegin",{mode:"claude",decMode:"claude",key:""});
      await __PE.engCall("liveTurn",{text:"Merhaba Buket, nasılsın?",maxMs:60000},90000);
      const r=await __PE.engCall("liveCalls",{since:0}); await __PE.engCall("liveEnd",{});
      const calls=r.calls, dec=calls.filter(c=>c.decision);
      const groups=__PE.engGroupsOf?__PE.engGroupsOf(calls):null;
      return {n:calls.length,dec:dec.map(c=>({f:c.feature,id:c.id,out:!!c.output,msgs:(c.messages||[]).length,prompts:c.prompts})),
        ids:calls.map(c=>c.id),groups:groups&&groups.filter(g=>g.decision).map(g=>g.label)}; });
    ok("the reply's decisions and its check are recorded among the run's calls, in its numbering", lv.dec.some(d=>d.f==="Emotion pick"&&d.out)&&lv.dec.some(d=>d.f==="Reply check"&&d.out)&&new Set(lv.ids).size===lv.ids.length, JSON.stringify(lv).slice(0,600));
    ok("each reads as a call: the questions and the state as its messages, the answers as its output", lv.dec.every(d=>d.msgs===2), JSON.stringify(lv.dec));
    ok("the run groups them as decision agents, by feature", (lv.groups||[]).some(g=>/^Decision · Emotion pick/.test(g))&&(lv.groups||[]).some(g=>/^Decision · Reply check/.test(g)), JSON.stringify(lv.groups));
    CL.calls.length=0; CL.answer=t=>/You are JUDGING one BACKGROUND ENGINE/.test(t)?'{"verdict":"good","summary":"ok","problems":[]}':null;
    const jd=await pg.evaluate(async()=>{
      await __PE.engCall("liveBegin",{mode:"claude",decMode:"claude",key:""});
      await __PE.engCall("liveTurn",{text:"Bu akşam bize gelir misin?",maxMs:60000},90000);
      const calls=(await __PE.engCall("liveCalls",{since:0})).calls; await __PE.engCall("liveEnd",{});
      const g=__PE.engGroupsOf(calls).find(x=>x.decision&&/Emotion pick/.test(x.label));
      if(!g) return {err:"no group"};
      await __PE.judgeEngine(g,{model:"claude",focus:"",lines:[],signal:null,at:0}); return {ok:true}; });
    const jt=CL.calls.find(t=>/You are JUDGING one BACKGROUND ENGINE/.test(t))||"";
    ok("a decision agent's judge is told it is one, and gets every prompt it read", jd.ok&&/This is a DECISION AGENT/.test(jt)&&/----- prompt:x_feel_move -----/.test(jt)&&/----- prompt:x_ego_pick -----/.test(jt), JSON.stringify(jd)+" "+jt.slice(0,200));
    CL.answer=null;

    console.log("\n[G — decision tests: labelled cases, scored at the app's thresholds]");
    const sc0=await pg.evaluate(()=>{ const C=__PE.DEC_CASES, by=id=>C.find(c=>c.id===id);
      const em=__PE.dtScore(by("dc_pressed"),{at:0.7,decisions:{emotion:"Fear",intensity:"clear",ego:"torn",egoP:{torn:0.6,superego_ahead:0.2},asks:{q_talk_into__ask:0.82,q_say_no__pushed:0.4}}});
      const ck=__PE.dtScore(by("dc_chk_player"),{at:0.7,probs:{player:0.91,refusal:0.02,repeat:0.75}});
      const gt=__PE.dtScore(by("dc_gate_meeting_maybe"),{at:0.8,p:0.79});
      const rl=__PE.dtScore(by("dc_rel_beach"),{at:0.5,rel:{dc_m0:0.8}});
      return {em,ck,gt,rl,features:[...new Set(C.map(c=>c.feature))].join(),n:C.length}; });
    ok("the cases cover the reply's decisions, the reply check, strict gates and memory relevance", sc0.features==="emotion,check,gate,relevance"&&sc0.n>=15, sc0.features+" "+sc0.n);
    ok("a yes/no is right only on the right side of the app's threshold (0.82 asked: yes; 0.4: no where yes was due)", sc0.em.find(r=>/talk_into/.test(r.q)).ok===true&&sc0.em.find(r=>/pushed/.test(r.q)).ok===false&&sc0.em.find(r=>/read_moment/.test(r.q)).ok===true&&/not asked/.test(sc0.em.find(r=>/read_moment/.test(r.q)).got), JSON.stringify(sc0.em));
    ok("a choice is right when it is one of the allowed answers, with its probability mass", sc0.em.find(r=>r.q==="id/superego").ok===true&&Math.abs(sc0.em.find(r=>r.q==="id/superego").p-0.8)<1e-9, JSON.stringify(sc0.em.find(r=>r.q==="id/superego")));
    ok("each miss names the prompt that asked (a fragment's question by its field, a reply check by its key)", sc0.em.find(r=>/pushed/.test(r.q)).prompt==="fx:say_no.o.pushed.ask"&&sc0.ck.find(r=>r.q==="repeats itself").prompt==="x_reply_check_repeat"&&sc0.ck.find(r=>r.q==="repeats itself").ok===false, JSON.stringify(sc0.ck));
    ok("a gate at 0.79 with the threshold at 0.8 is not filed (right for a maybe); a missing answer is a miss", sc0.gt[0].ok===true&&sc0.rl.length===2&&sc0.rl[1].ok===false, JSON.stringify({gt:sc0.gt,rl:sc0.rl}));
    CL.calls.length=0;
    const run=await pg.evaluate(async()=>{ lsSet("decmode","claude"); await __PE.runDecCases(__PE.DEC_CASES.map(c=>c.id));
      const R=__PE.DT.res; return __PE.DEC_CASES.map(c=>({id:c.id,rows:(R[c.id].rows||[]).length,err:(R[c.id].r||{}).err||"",feat:((R[c.id].calls||[])[0]||{}).feature||"",q:Object.keys((((R[c.id].calls||[])[0]||{}).body||{}).questions||{}).length})); });
    ok("every case reaches its agent through the app's own request and is scored", run.every(r=>r.rows>=1&&!r.err&&r.q>=1), JSON.stringify(run.filter(r=>!(r.rows>=1&&!r.err&&r.q>=1))));
    ok("each case went to its own feature's request", run.filter(r=>/^dc_chk/.test(r.id)).every(r=>r.feat==="Reply check")&&run.filter(r=>/^dc_gate/.test(r.id)).every(r=>r.feat==="Strict gates")&&run.find(r=>r.id==="dc_rel_beach").feat==="Memory relevance judge"&&run.find(r=>r.id==="dc_light").feat==="Emotion pick", JSON.stringify(run.map(r=>r.id+":"+r.feat)));
    CL.calls.length=0; CL.answer=t=>/You are fixing the DECISION PROMPTS/.test(t)?JSON.stringify({summary:"PE-DECFIX",prompts:[{prompt:"x_reply_check_repeat",verdict:"fix",cause:"c"}],edits:[]}):null;
    const an=await pg.evaluate(async()=>{ await __PE.analyseDecCases(); return {fix:__PE.DT.fix,html:document.querySelector("#decFix").textContent}; });
    const dt=CL.calls.find(t=>/You are fixing the DECISION PROMPTS/.test(t))||"";
    ok("the analysis reads the misses with their state, the passes, and every prompt the cases asked", /===== THE MISSES =====/.test(dt)&&/THE STATE IT WAS GIVEN/.test(dt)&&/===== prompt:x_ego_pick =====/.test(dt)&&/===== emo:/.test(dt)&&/fx:say_no\.o\.pushed\.ask/.test(dt), dt.slice(0,300));
    ok("and its verdict shows in the tab", an.fix&&an.fix.summary==="PE-DECFIX"&&/PE-DECFIX/.test(an.html), JSON.stringify(an.fix).slice(0,200));
    CL.answer=null;

    ok("no page errors", errs.length===0, errs.join(" | "));
  }catch(e){ fail++; console.log("  FAIL  (threw) "+(e&&e.stack||e)); }
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close(); srv.close(); process.exit(fail?1:0);
})();
