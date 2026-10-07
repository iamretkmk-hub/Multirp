/* v150.34 — THE EMOTION PICK: before each reply, which base emotion and how strongly.
   Checked here, with the Decisions endpoint stubbed:
     • one request with two choice questions — the emotions in the editable list (each with its description)
       and mild / clear / intense — and a state of the character and this scene;
     • the pick lands on chat.emo[id] with the tone of that intensity ("Anger" + intense → "furious"), and is a
       flag the reply payload's {{if}} conditions can read (emotion / intensity / tone);
     • the same moment is not asked twice; the previous pick in this scene goes along as context;
     • a real solo turn asks it beside the memory search, before the reply is written;
     • a failure keeps the last pick; off or no key sends nothing;
     • the list is editable in Settings (rows added, removed, edited, saved, reset) and an edited list is
       what the model is offered; settings default on.
   Run: node tests/emotion-pick.browser.js */
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:process.env.SM_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage({viewport:{width:412,height:915}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file://'+require('path').resolve(__dirname,'..','index.html'));
  await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(800);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x||c).slice(0,700));} };

  await pg.evaluate(()=>{
    window.__reqs=[]; window.__mode="ok"; window.__ans={emotion:{type:"choice",choice:"anger",probabilities:{anger:0.7,sadness:0.2}},intensity:{type:"choice",choice:"intense"}};
    const realFetch=window.fetch;
    window.fetch=async(url,opts)=>{
      const u=String(url);
      if(u.indexOf("/api/alpha/decisions")>-1){
        const body=JSON.parse(opts.body); window.__reqs.push(body);
        if(window.__mode==="500") return new Response(JSON.stringify({error:{message:"x"}}),{status:500});
        if(!body.questions.emotion) return new Response(JSON.stringify({answers:{}}),{status:200});
        return new Response(JSON.stringify({answers:window.__ans}),{status:200});
      }
      return realFetch(url,opts);
    };
    const uni=state.universes[0];
    state.personas=state.personas.filter(p=>p.id!=="p_b");
    state.personas.push({id:"p_b",name:"Burcu",universeId:uni.id,instructions:"x",personality:"Sharp, guarded.",backstory:"x",style:"x",goals:"x",look:{}});
    const chat=curChat(); chat.presentIds=["p_b"]; chat.universeId=uni.id; state.curUniverse=uni.id;
    state.user="Emre"; state.key="sk-test"; state.emoOn=true; state.emoModel=""; state.emotions=null;
    state.memJudgeOn=false; state.replyCheckOn=false; state.trackDecOn=false; state.gateOn=false;
    chat.emo={}; chat.messages=[{mid:"u1",role:"user",content:"Dün gece neredeydin?",speaker:"Emre"}];
  });

  console.log("\n[the pick]");
  const r=await pg.evaluate(async()=>{ window.__reqs=[]; const out=await emotionEnsure(curChat(),state.personas.find(p=>p.id==="p_b"),"Dün gece neredeydin?");
    return {out,reqs:window.__reqs,stored:(curChat().emo.p_b||{}).tone}; });
  const q=(r.reqs[0]||{}).questions||{};
  ok("one request, two choice questions", r.reqs.length===1&&q.emotion&&q.emotion.type==="choice"&&q.intensity&&q.intensity.type==="choice", JSON.stringify(Object.keys(q)));
  ok("the options are the thirteen shipped emotions, each with its description", q.emotion&&Object.keys(q.emotion.criteria).length===13&&/^Anger: something is wrong/.test(q.emotion.criteria.anger), JSON.stringify(q.emotion&&q.emotion.criteria).slice(0,300));
  ok("intensity is mild / clear / intense", q.intensity&&JSON.stringify(Object.keys(q.intensity.criteria))==='["mild","clear","intense"]', JSON.stringify(q.intensity&&q.intensity.criteria));
  ok("the state is the character and this scene", r.reqs[0]&&r.reqs[0].state.character.name==="Burcu"&&/neredeydin/.test(r.reqs[0].state.scene), JSON.stringify(r.reqs[0]&&r.reqs[0].state));
  ok("Anger + intense → tone 'furious', stored on chat.emo", r.out&&r.out.emotion==="Anger"&&r.out.intensity==="intense"&&r.out.tone==="furious"&&r.stored==="furious", JSON.stringify(r.out));
  ok("the same moment is not asked twice", await pg.evaluate(async()=>{ window.__reqs=[]; await emotionEnsure(curChat(),state.personas.find(p=>p.id==="p_b"),"Dün gece neredeydin?"); return window.__reqs.length===0 ? true : "asked again"; }));
  ok("the previous pick in this scene goes along", await pg.evaluate(async()=>{ const c=curChat(); c.messages.push({mid:"u2",role:"user",content:"Cevap ver.",speaker:"Emre"}); window.__reqs=[];
      await emotionEnsure(c,state.personas.find(p=>p.id==="p_b"),"Cevap ver.");
      return window.__reqs[0]&&window.__reqs[0].state.feeling_earlier_in_this_scene==="Anger (intense)" ? true : JSON.stringify(window.__reqs[0]&&window.__reqs[0].state.feeling_earlier_in_this_scene); }));
  ok("the pick is a payload condition flag (emotion / intensity / tone)", await pg.evaluate(()=>{
      const f=ptCondFlags({emotion:"Anger",intensity:"intense",tone:"furious"});
      return (ptCondTest("emotion = anger and intensity = intense",f)&&!ptCondTest("emotion = sadness",f)) ? true : "flags do not test"; }).catch(e=>"err "+e.message));

  console.log("\n[a real turn]");
  ok("a solo turn asks it before the reply is written", await pg.evaluate(async()=>{
      const c=curChat(); c.messages=[]; c.emo={}; const order=[];
      const realCC=window.chatCompletion;
      window.chatCompletion=async(msgs,model,opts)=>{ const d=(opts&&opts.dbg)||""; if(/^Roleplay reply/.test(d)){ order.push("reply"); return '"Evdeydim."'; } return "{}"; };
      const realF=window.fetch; window.fetch=async(u,o)=>{ if(String(u).indexOf("/api/alpha/decisions")>-1&&JSON.parse(o.body).questions.emotion)order.push("emotion"); return realF(u,o); };
      try{ await sendMessage({text:"Dün gece neredeydin?"}); }catch(e){ return "threw "+e.message; }
      window.chatCompletion=realCC; window.fetch=realF;
      return (order.indexOf("emotion")>=0&&order.indexOf("emotion")<order.indexOf("reply")&&c.emo.p_b&&c.emo.p_b.emotion==="Anger") ? true : JSON.stringify(order); }));


  console.log("\n[failures and switches]");
  ok("a failure keeps the last pick", await pg.evaluate(async()=>{ const c=curChat(); c.messages.push({mid:"u9",role:"user",content:"?",speaker:"Emre"}); window.__mode="500"; _emoBreak.until=0; _emoBreak.fails=0;
      await emotionEnsure(c,state.personas.find(p=>p.id==="p_b"),"?"); window.__mode="ok"; _emoBreak.fails=0;
      return c.emo.p_b&&c.emo.p_b.emotion==="Anger" ? true : JSON.stringify(c.emo.p_b); }));
  ok("off: nothing sent", await pg.evaluate(async()=>{ const c=curChat(); c.messages.push({mid:"u10",role:"user",content:"!",speaker:"Emre"}); state.emoOn=false; window.__reqs=[];
      await emotionEnsure(c,state.personas.find(p=>p.id==="p_b"),"!"); state.emoOn=true; return window.__reqs.length===0 ? true : "sent"; }));
  ok("no key: nothing sent", await pg.evaluate(async()=>{ const c=curChat(); c.messages.push({mid:"u11",role:"user",content:"!!",speaker:"Emre"}); state.key=""; window.__reqs=[];
      await emotionEnsure(c,state.personas.find(p=>p.id==="p_b"),"!!"); state.key="sk-test"; return window.__reqs.length===0 ? true : "sent"; }));

  console.log("\n[the editable list]");
  ok("Settings shows the thirteen; a row edited, one deleted and one added are saved", await pg.evaluate(()=>{
      syncSettingsUI(); const rows=()=>[...document.querySelectorAll('#emoList .emoRow')];
      if(rows().length!==13) return "rows="+rows().length;
      rows()[1].querySelector('.emoDesc').value="glad and light"; rows()[12].remove();
      emotionEditorAdd(); const r=rows()[rows().length-1];
      r.querySelector('.emoName').value="Loneliness"; r.querySelector('.emoDesc').value="missing someone; unseen";
      r.querySelector('.emoT0').value="alone"; r.querySelector('.emoT1').value="lonely"; r.querySelector('.emoT2').value="abandoned";
      saveSettings(false);
      const l=state.emotions, st=JSON.parse(store.raw(K.emotions,"null")||"null");
      return (l.length===13&&l[1].desc==="glad and light"&&!l.some(e=>e.name==="Pride")&&l[12].name==="Loneliness"&&l[12].tones[2]==="abandoned"&&st&&st.length===13) ? true : JSON.stringify(l.map(e=>e.name)); }));
  ok("the edited list is what the model is offered", await pg.evaluate(async()=>{ const c=curChat(); c.messages.push({mid:"u12",role:"user",content:"Yalnız mısın?",speaker:"Emre"}); window.__reqs=[];
      await emotionEnsure(c,state.personas.find(p=>p.id==="p_b"),"Yalnız mısın?");
      const cr=window.__reqs[0].questions.emotion.criteria; return (cr.loneliness&&!cr.pride&&/glad and light/.test(cr.joy)) ? true : JSON.stringify(Object.keys(cr)); }));
  ok("reset puts the shipped list back (saved as no override)", await pg.evaluate(()=>{ emotionEditorReset(); saveSettings(false);
      return (state.emotions.length===13&&state.emotions[12].name==="Pride"&&store.raw(K.emotions,"x")==="") ? true : JSON.stringify([state.emotions.length,store.raw(K.emotions,"x").slice(0,40)]); }));
  ok("the two prompts are on their Payloads card; a fresh install has it on", await pg.evaluate(()=>{
      const card=ENGINE_PAYLOAD_DEFS.find(d=>d.key==="emotion_pick");
      const okCard=card&&["x_emotion_pick","x_emotion_intensity"].every(k=>card.blocks.some(x=>x.promptKey===k)&&PROMPT_BY_KEY[k]);
      localStorage.removeItem(K.emoOn); loadState(); return (okCard&&state.emoOn===true) ? true : "card="+okCard+" on="+state.emoOn; }));

  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close();
  process.exit(fail?1:0);
})().catch(e=>{ console.error(e); process.exit(1); });
