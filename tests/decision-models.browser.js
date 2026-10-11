/* v150.64 — ONE DECISIONS MODEL, REFUSALS THAT COST ONE QUESTION, AND ANSWERS THAT BELONG TO ONE LINE. From two live exports:
   two of four emotion requests in an intimate scene failed with HTTP 502 'OpenAI refused to answer question "emotion"' and the
   whole bundle (ego, the reply's asks, limits, goals, who is being talked about) was lost and counted toward the pause; the
   next reply then read the line before's asks ("not answered with yes" beside "your want has won"); and a Decisions model
   typed into the embeddings box failed every embedding with a bare "HTTP 400 ". Checked here:
     - one "Decisions model" setting (blank = the default) is the model of every Decisions request; the five per-feature boxes
       are optional overrides; all six live in their own Settings card, apart from the embeddings box, saying they take
       Decisions-API models only; no request is built with the default model directly;
     - a refused question: the request is sent once more without it, with the scene as dialogue only, the rest of the bundle
       arrives (ego, asks), the Debug row says what happened, and a refusal never counts toward the pause;
     - a failed request keeps the emotion and ego of the last pick but never the last line's asks (or who was being talked
       about); a paused feature and a proactive text drop them too;
     - embeddings: the endpoint's own error on the Debug row, one notice naming the setting when the model is rejected, and a
       warning on save when the box holds a Decisions or chat model.
   Run: node tests/decision-models.browser.js   (needs playwright; see tests/README.md) */
const {chromium}=require('playwright');
const fs=require('fs'), path=require('path');
(async()=>{
  const b=await chromium.launch({executablePath:process.env.SM_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage({viewport:{width:412,height:915}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  const INDEX=path.resolve(__dirname,'..','index.html');
  await pg.goto('file://'+INDEX); await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  // v150.87 — this file checks the one-request bundle (Settings → Decisions → One request per topic OFF); the split is tests/decision-split.browser.js
  await pg.evaluate(()=>{ state.decSplit=false; try{ store.set(K.decSplit,false); }catch(_){} const e=document.getElementById("setDecSplit"); if(e)e.checked=false; });
  await pg.waitForTimeout(800);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x===undefined?c:x).slice(0,900));} };

  await pg.evaluate(()=>{
    window.__toasts=[]; const t=window.toast; window.toast=m=>{ window.__toasts.push(String(m)); };
    window.__setup=()=>{
      const uni=state.universes[0];
      state.personas=[{id:"p_o",name:"Özlem",universeId:uni.id,personality:"Cheerful.",goals:"Keep Berker out of it.",goalsLive:{lines:["Keep Berker out of it"],day:1},
        relationships:{p_h:{tie:"husband",relationship:"Berker is your husband."},__user__:{tie:"friend",relationship:"Emre is a friend."}}},
        {id:"p_h",name:"Berker",universeId:uni.id,personality:"Steady."}];
      state.user="Emre"; state.key="sk-test"; state.fragments=null; state.emoOn=true; state.relOn=false; state.memory=[]; state.limitsOn=true;
      store.setRaw(K.fragAdds,FRAG_SHIPPED_ADDS.map(a=>a.key).join(","));
      [_emoBreak,_replyCheckBreak,_gateBreak].forEach(br=>{ br.until=0; br.fails=0; });
      const c=curChat();
      Object.assign(c,{universeId:uni.id,presentIds:["p_o"],emo:{},feel:{},fsTurn:0,calendar:[],intents:[],rel:{},gameDay:4,period:"Afternoon",spokenLimits:{},spokenLimitsRead:{},
        messages:[{mid:"u1",role:"user",content:'*I pull her closer.* "Stay with me."'},{mid:"a1",role:"assistant",speaker:"Özlem",speakerId:"p_o",content:'*She laughs.* "Not tonight, di mi?"'},
                  {mid:"u2",role:"user",content:'*I kiss her neck.* "Aceleye gerek yok."'}]});
      return c; };
    // a Decisions endpoint that answers every question it is sent (or refuses one, or fails), recording each body
    window.__dec=(mode)=>{ window.__bodies=[]; const rf=window.__realFetch||(window.__realFetch=window.fetch);
      window.fetch=async(u,o)=>{ if(String(u).indexOf("/api/alpha/decisions")<0)return rf(u,o);
        const body=JSON.parse(o.body); window.__bodies.push(body); const m=typeof mode==="function"?mode(body,window.__bodies.length):mode;
        if(m&&m.status)return new Response(JSON.stringify(m.body||{error:{message:m.message||"upstream"}}),{status:m.status});
        /* (!) v150.110 — the feeling system's request: desire rose a lot, nothing else moved or happened */
        const ans={}; Object.keys(body.questions).forEach(k=>{ ans[k]=k==="f_desire"?{choice:"rose_a_lot",probabilities:{rose_a_lot:0.9}}:/^f_|^fo_/.test(k)?{choice:"unchanged",probabilities:{unchanged:0.9}}:/^(s_|e_)|^masked$/.test(k)?{noul:0.05}:k==="wronged"?{choice:"nobody"}:k==="ego"?{choice:"id_winning",probabilities:{id_winning:0.9}}
          :/^limit_L/.test(k)?{choice:"none",probabilities:{none:0.95}}:{noul:0.93}; });
        return new Response(JSON.stringify({answers:ans}),{status:200}); }; };
    window.__undec=()=>{ if(window.__realFetch)window.fetch=window.__realFetch; };
  });

  console.log("\n[one Decisions model]");
  const SRC=fs.readFileSync(INDEX,"utf8");
  const direct=(SRC.match(/model:\s*DECISIONS_DEFAULT_MODEL/g)||[]).length;
  const bodies=[...SRC.matchAll(/const body=\{model:([^,]+),state:/g)].map(m=>m[1]);
  const allowed=/^(decisionsModel\(\)|emotionModel\(\)|replyCheckModel\(\)|gateModel\(\)|trackDecModel\(\)|memJudgeModel\(\))$/;
  ok("no Decisions request is built with the default model directly; every one ("+bodies.length+") uses the Decisions model or a feature's override",
    direct===0&&bodies.length>=12&&bodies.every(m=>allowed.test(m.trim())), JSON.stringify({direct,bodies}));
  ok("every request sent to the Decisions endpoint is one of those", (()=>{ const calls=[...SRC.matchAll(/dbg\([^;]*?DECISIONS_URL,body\)/g)].length; return calls>=12?true:calls+" calls"; })());
  const OV=await pg.evaluate(()=>{ const keys=["emoModel","replyCheckModel","gateModel","trackDecModel","memJudgeModel"], fns=[emotionModel,replyCheckModel,gateModel,trackDecModel,memJudgeModel];
    keys.forEach(k=>{ state[k]=""; }); state.decModel="";
    const blank=[decisionsModel()].concat(fns.map(f=>f()));
    state.decModel="acme/luna-2-decisions"; const dec=fns.map(f=>f());
    state.gateModel="acme/gates-decisions"; const one=[gateModel(),emotionModel()];
    keys.forEach(k=>{ state[k]=""; }); state.decModel="";
    return {blank,dec,one}; });
  ok("blank: openai/gpt-6-luna-decisions everywhere; the Decisions model set: every feature follows it; an override: that feature only",
    OV.blank.every(m=>m==="openai/gpt-6-luna-decisions")&&OV.dec.every(m=>m==="acme/luna-2-decisions")&&OV.one[0]==="acme/gates-decisions"&&OV.one[1]==="acme/luna-2-decisions", JSON.stringify(OV));
  ok("the emotion request, a strict gate and the reply check send the Decisions model", await pg.evaluate(async()=>{
      const c=__setup(), p=state.personas[0]; state.decModel="acme/luna-2-decisions"; state.replyCheckOn=true; __dec(null);
      try{ await emotionEnsure(c,p,"Aceleye gerek yok.",{targetId:"__user__",targetName:"Emre",kind:"solo"});
        await strictGate(c,"test","state",[{prompt:"x_gate_intent",label:"x",vars:{char:"Özlem",user:"Emre",target:"Emre",kind:"desire",aim:"x",trigger:"x"}}]);
        const msg={mid:"a2",role:"assistant",speaker:"Özlem",speakerId:"p_o",content:'"Di mi?"'}; c.messages.push(msg); await runReplyCheck(c,msg,p); }
      finally{ __undec(); state.decModel=""; }
      const m=__bodies.map(x=>x.model); return (m.length>=3&&m.every(x=>x==="acme/luna-2-decisions"))?true:JSON.stringify(m); }));
  const UI=await pg.evaluate(()=>{ show('settings'); const card=document.getElementById('decModelsCard'); const emb=document.getElementById('setEmbedModel');
    const ids=["setDecModel","setMemJudgeModel","setReplyCheckModel","setTrackDecModel","setGateModel","setEmoModel"];
    // the card's help text is folded behind its "i" dots (_helpStore): read it from there as well as the card
    const txt=card?(card.textContent+" "+[...card.querySelectorAll('[data-help]')].map(d=>{ const r=_helpStore.get(d.dataset.help); return r&&r.frag?r.frag.textContent:""; }).join(" ")):"";
    const r={card:!!card,all:ids.every(id=>card&&card.contains(document.getElementById(id))),embApart:!!emb&&!!card&&!card.contains(emb),
      says:/Decisions-API models only/.test(txt),blank:/blank = the Decisions model/.test(txt)};
    document.getElementById('setDecModel').value=" acme/luna-2-decisions "; saveSettings(false);
    r.saved=state.decModel==="acme/luna-2-decisions"&&store.raw(K.decModel,"")==="acme/luna-2-decisions";
    state.decModel=""; loadState(); r.loaded=state.decModel==="acme/luna-2-decisions";
    document.getElementById('setDecModel').value=""; saveSettings(false); r.cleared=state.decModel===""&&decisionsModel()==="openai/gpt-6-luna-decisions";
    return r; });
  ok("Settings: a \"Decision models\" card with the Decisions model and the five overrides, apart from the embeddings box, saying they take Decisions-API models only",
    UI.card&&UI.all&&UI.embApart&&UI.says&&UI.blank, JSON.stringify(UI));
  ok("the Decisions model is saved, read back at load, and blank means the default", UI.saved&&UI.loaded&&UI.cleared, JSON.stringify(UI));

  console.log("\n[a refused question]");
  const RF=await pg.evaluate(async()=>{
    const c=__setup(), p=state.personas[0];
    __dec((body,n)=>n===1?{status:502,body:{error:{message:'OpenAI refused to answer question "f_desire"',code:502}}}:null);
    let out; try{ out=await emotionEnsure(c,p,"Aceleye gerek yok.",{targetId:"__user__",targetName:"Emre",kind:"solo"}); } finally{ __undec(); }
    const e=dbgLog.filter(x=>/^(Emotion|Feelings)/.test(x.label)).slice(-1)[0];
    const b1=__bodies[0], b2=__bodies[1];
    return {n:__bodies.length,first:!!(b1&&b1.questions.f_desire),second:!!(b2&&!b2.questions.f_desire&&b2.questions.ego&&b2.questions.q_talk_into__ask),
      scene1:b1&&b1.state.scene,scene2:b2&&b2.state.scene,ego:out&&out.ego,asks:out&&Object.keys(out.asks||{}).length,goals:!!(b2&&Object.keys(b2.questions).some(k=>/^goal_done_/.test(k))),
      limits:!!(b2&&Object.keys(b2.questions).some(k=>/^limit_L/.test(k))),fails:_emoBreak.fails,paused:_emoBreak.until>Date.now(),
      status:e&&e.status,retry:e&&e.retry,result:e&&JSON.stringify(e.result)}; });
  ok("sent again once, without the refused question: ego, the asks, the spoken limits and the goals still asked", RF.n===2&&RF.first&&RF.second&&RF.goals&&RF.limits, JSON.stringify(RF).slice(0,600));
  ok("the second time the scene is dialogue only: no *actions*, the words kept", /\*/.test(RF.scene1)&&!/\*/.test(RF.scene2)&&/Aceleye gerek yok/.test(RF.scene2)&&/Not tonight, di mi\?/.test(RF.scene2), JSON.stringify([RF.scene1,RF.scene2]));
  ok("the rest of the bundle arrives: the ego answer and the asks are this line's", RF.ego==="id_winning"&&RF.asks>0, JSON.stringify(RF));
  ok("a refusal never counts toward the pause", RF.fails===0&&RF.paused===false, JSON.stringify({fails:RF.fails,paused:RF.paused}));
  ok("the Debug row says what happened: refused, sent again without it, dialogue only — and it answered", RF.status==="ok"&&RF.retry&&RF.retry.refused==="f_desire"&&RF.retry.sceneDialogueOnly===true&&RF.retry.result==="answered"&&/Sent again once without it/.test(RF.retry.note)&&/\\"f_desire\\" was refused and dropped on a retry/.test(RF.result), JSON.stringify({retry:RF.retry,result:RF.result}));
  const RF2=await pg.evaluate(async()=>{
    const c=__setup(), p=state.personas[0];
    __dec(()=>({status:502,body:{error:{message:'OpenAI refused to answer question "f_desire"'}}}));
    let out; for(let i=0;i<4;i++){ c.messages.push({mid:"ux"+i,role:"user",content:'"Again '+i+'."'}); try{ out=await emotionEnsure(c,p,"Again "+i,{targetId:"__user__",targetName:"Emre",kind:"solo"}); }catch(e){} }
    __undec();
    const e=dbgLog.filter(x=>/^(Emotion|Feelings)/.test(x.label)).slice(-1)[0];
    const r={out:out===null,n:__bodies.length,fails:_emoBreak.fails,paused:_emoBreak.until>Date.now(),res:e&&String(e.result)};
    __dec(()=>({status:502,message:"Bad gateway"}));
    for(let i=0;i<3;i++){ c.messages.push({mid:"uy"+i,role:"user",content:'"More '+i+'."'}); await emotionEnsure(c,p,"More "+i,{targetId:"__user__",targetName:"Emre",kind:"solo"}); }
    __undec(); r.plainPaused=_emoBreak.until>Date.now(); _emoBreak.until=0; _emoBreak.fails=0;
    return r; });
  ok("refused again on the retry: no answer, still not counted (four lines, eight refusals, no pause), and the row says so",
    RF2.out&&RF2.n===8&&RF2.fails===0&&!RF2.paused&&/refused again on the second try/.test(RF2.res), JSON.stringify(RF2));
  ok("three ordinary failures in a row still pause the feature", RF2.plainPaused===true);
  ok("a refused question is read from the error, and a scene is cut to its words", await pg.evaluate(()=>{
      const q=[_decRefusedQ('OpenAI refused to answer question "emotion"'),_decRefusedQ("refused to answer the question 'q_talk_into__ask'"),_decRefusedQ("Bad gateway")];
      const d=_decDialogueOnly('Özlem: _Aklım sustu._ *Sırtım yatağa değer.* "Hadi bakalım."\nEmre: *Tişörtümü çıkarıyorum.*\nEmre: Merhaba, nasılsın?');
      return (q.join("|")==="emotion|q_talk_into__ask|"&&d==='Özlem: Hadi bakalım.\nEmre: Merhaba, nasılsın?')?true:JSON.stringify({q,d}); }));

  console.log("\n[the asks belong to one line]");
  const ST=await pg.evaluate(async()=>{
    const c=__setup(), p=state.personas[0]; const r={};
    __dec(null); await emotionEnsure(c,p,"Aceleye gerek yok.",{targetId:"__user__",targetName:"Emre",kind:"solo"}); __undec();
    r.first=Object.keys(c.emo.p_o.asks||{}).length;
    const build=()=>{ const B=Object.assign({},buildCharPromptBlocks(p,[],{recent:[],diary:[],longterm:[]},null,{chat:c,targetName:"Emre",targetId:"__user__",payloadKind:"solo"}),
        buildTailBlocks({chat:c,selfP:p,selfId:p.id,selfName:p.name,targetName:"Emre",targetId:"__user__",injected:{recent:[],diary:[],longterm:[]},payloadKind:"solo"}));
      return (ptBuildMessages("solo",B,[{role:"user",content:"(history)"}],{chat:c,npc:p,targetName:"Emre"})||[]).map(m=>m.content).join("\n"); };
    r.firstHasYouCanSayNo=/YOU CAN SAY NO/.test(build());
    // the next line: the request fails (an upstream error)
    c.messages.push({mid:"a2",role:"assistant",speaker:"Özlem",speakerId:"p_o",content:'"Peki."'},{mid:"u3",role:"user",content:'"Gel buraya."'});
    __dec(()=>({status:500,message:"upstream"})); const out=await emotionEnsure(c,p,"Gel buraya.",{targetId:"__user__",targetName:"Emre",kind:"solo"}); __undec(); _emoBreak.fails=0;
    r.failed=out===null; r.kept=[c.emo.p_o.emotion,c.emo.p_o.ego]; r.asks=Object.keys(c.emo.p_o.asks||{}).length; r.rel=Object.keys(c.emo.p_o.relAbout||{}).length;
    const t=build(); r.second=/YOU CAN SAY NO|it has not happened for you|Being warm is not agreeing/.test(t); r.compass=/Right now your want has won/.test(t);
    r.note=(dbgLog.filter(x=>/^(Emotion|Feelings)/.test(x.label)).slice(-1)[0].notes||[]).join(" ");
    // a paused feature: no request, and still not the last line's asks
    __dec(null); c.messages.push({mid:"u4",role:"user",content:'"Şimdi."'}); await emotionEnsure(c,p,"Şimdi.",{targetId:"__user__",targetName:"Emre",kind:"solo"}); __undec();
    r.third=Object.keys(c.emo.p_o.asks||{}).length;
    _emoBreak.until=Date.now()+600000; _emoBreak.key=String(state.key);
    c.messages.push({mid:"u5",role:"user",content:'"Bir daha."'}); const o5=await emotionEnsure(c,p,"Bir daha.",{targetId:"__user__",targetName:"Emre",kind:"solo"});
    r.paused=[o5===null,Object.keys(c.emo.p_o.asks||{}).length,c.emo.p_o.ego]; _emoBreak.until=0;
    // the same line again (a Retry) is answered from the record — no second request
    __dec(null); c.messages.push({mid:"u6",role:"user",content:'"Son."'}); await emotionEnsure(c,p,"Son.",{targetId:"__user__",targetName:"Emre",kind:"solo"});
    const n1=__bodies.length; await emotionEnsure(c,p,"Son.",{targetId:"__user__",targetName:"Emre",kind:"solo"}); r.retry=[n1,__bodies.length,Object.keys(c.emo.p_o.asks).length>0]; __undec();
    // a proactive text (no line): the record's asks are not that text's
    _emoDropLineAnswers(c,p.id,null); r.text=Object.keys(c.emo.p_o.asks).length;
    return r; });
  ok("the first line's asks are stored and injected", ST.first>0&&ST.firstHasYouCanSayNo===true, JSON.stringify(ST));
  ok("the next line's request fails: emotion and ego of the last pick stand, its asks and who-is-talked-about are gone", ST.failed&&ST.kept[0]==="Desire"&&ST.kept[1]==="id_winning"&&ST.asks===0&&ST.rel===0, JSON.stringify(ST));
  ok("…so that reply carries the compass of the last pick and none of the last line's asks", ST.second===false&&ST.compass===true, JSON.stringify(ST));
  ok("…and the Debug row says so", /not used/.test(ST.note), ST.note);
  ok("a paused feature: no request, the ego stands, the asks of the line before are not this line's", ST.paused[0]===true&&ST.paused[1]===0&&ST.paused[2]==="id_winning", JSON.stringify(ST.paused));
  ok("the same line again is answered from the record (one request), with its asks", ST.retry[0]===ST.retry[1]&&ST.retry[2]===true, JSON.stringify(ST.retry));
  ok("a text with no line (the proactive texter) drops them", ST.text===0);
  ok("with the emotion pick off, the asks still reach the reply (they are read from the record, emotion or not)", await pg.evaluate(async()=>{
      const c=__setup(), p=state.personas[0]; state.emoOn=false; __dec(null);
      try{ await emotionEnsure(c,p,"Aceleye gerek yok.",{targetId:"__user__",targetName:"Emre",kind:"solo"}); } finally{ __undec(); state.emoOn=true; }
      const B=Object.assign({},buildCharPromptBlocks(p,[],{recent:[],diary:[],longterm:[]},null,{chat:c,targetName:"Emre",targetId:"__user__",payloadKind:"solo"}),
        buildTailBlocks({chat:c,selfP:p,selfId:p.id,selfName:p.name,targetName:"Emre",targetId:"__user__",injected:{recent:[],diary:[],longterm:[]},payloadKind:"solo"}));
      const t=(ptBuildMessages("solo",B,[{role:"user",content:"(history)"}],{chat:c,npc:p,targetName:"Emre"})||[]).map(m=>m.content).join("\n");
      return (!c.emo.p_o.emotion&&/YOU CAN SAY NO/.test(t))?true:JSON.stringify({emo:c.emo.p_o.emotion,asks:c.emo.p_o.asks}); }));

  console.log("\n[embeddings]");
  const EM=await pg.evaluate(async()=>{
    state.embedOn=true; state.embedModel="typesafe/jev-1.13"; state.embedKey=""; state.embedUrl=""; state.key="sk-test"; window.__toasts=[];
    const rf=window.fetch; window.fetch=async(u,o)=>{ if(/\/embeddings$/.test(String(u)))return new Response(JSON.stringify({error:{message:"typesafe/jev-1.13 is not an embeddings model",code:400,metadata:{raw:"model does not support embeddings"}}}),{status:400}); return rf(u,o); };
    const r={};
    try{ await embedText("one",{dbgLabel:"Embeddings — memory retrieval query"}); r.row=String(dbgLog.slice(-1)[0].result);
      await embedText("two"); r.toasts=window.__toasts.filter(t=>/embeddings model/i.test(t));
      state.memory=[{id:"m1",ownerId:"p_o",content:"Something happened.",text:"Something happened.",gameDay:1}]; _embBackoffUntil=0;
      await ensureMemEmbeddings("p_o",4); r.batch=String(dbgLog.slice(-1)[0].result); }
    finally{ window.fetch=rf; state.embedOn=false; state.embedModel=""; state.memory=[]; }
    return r; });
  ok("the Debug row carries the endpoint's own words, not a bare HTTP 400", /^HTTP 400 — typesafe\/jev-1\.13 is not an embeddings model \(model does not support embeddings\)/.test(EM.row)&&/HTTP 400 — typesafe\/jev-1\.13 is not an embeddings model/.test(EM.batch), JSON.stringify(EM));
  ok("one notice, naming the setting, when the model is rejected (not one per request)", EM.toasts.length===1&&/Settings → 2 · LLM Selection → Memory & Daily Engines → Semantic-memory embeddings model/.test(EM.toasts[0])&&/typesafe\/jev-1\.13/.test(EM.toasts[0]), JSON.stringify(EM.toasts));
  const SV=await pg.evaluate(()=>{ show('settings'); const el=document.getElementById('setEmbedModel'); const r={};
    const save=v=>{ window.__toasts=[]; el.value=v; saveSettings(false); return window.__toasts.filter(t=>/Semantic-memory embeddings model/.test(t)); };
    r.dec=save("openai/gpt-6-luna-decisions"); r.dec2=save("openai/gpt-6-luna-decisions"); r.other=save("typesafe/jev-1.13-decisions");
    r.chat=save(state.model); r.good=save("openai/text-embedding-3-small"); save(""); return r; });
  ok("saving a Decisions model or a chat model into the embeddings box warns (once per value); an embeddings model does not",
    SV.dec.length===1&&/it is a Decisions model/.test(SV.dec[0])&&SV.dec2.length===0&&SV.other.length===1&&SV.chat.length===1&&/a model you use for chat/.test(SV.chat[0])&&SV.good.length===0, JSON.stringify(SV));

  ok("no page errors", errs.length===0?true:errs.join(" | "));
  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close(); process.exit(fail?1:0);
})().catch(e=>{ console.error(e); process.exit(1); });
