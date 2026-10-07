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
  await pg.evaluate(()=>{ state.fragOn=false; store.setRaw(K.fragOn,"0"); });   // v150.57 — fragments are on by default; this pins the classic layout
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

  console.log("\n[id or superego — v150.35]");
  ok("the same request asks who is winning, from no conflict to the want winning", q.ego&&q.ego.type==="choice"&&JSON.stringify(Object.keys(q.ego.criteria))==='["no_conflict","superego_firm","superego_ahead","torn","id_ahead","id_winning"]'&&/Do not lean on conscience by default/.test(q.ego.instructions), JSON.stringify(q.ego&&Object.keys(q.ego.criteria)));
  ok("the state carries the feelings toward the one answered: right now, lasting, the tie, the settled view", await pg.evaluate(async()=>{
      const c=curChat(), p=state.personas.find(x=>x.id==="p_b");
      p.relationships={__user__:{tie:"neighbour",relationship:"The neighbour she flirts with when her husband is away."}};
      const o=relObj(c,"p_b","__user__"); o.st=o.st||{}; o.st.desire=60; o.trust=40; o.affection=55;
      c.messages.push({mid:"u3",role:"user",content:"Gel bu gece.",speaker:"Emre"}); window.__reqs=[];
      window.__ans.ego={type:"choice",choice:"id_ahead",probabilities:{id_ahead:0.6,torn:0.3}};
      const out=await emotionEnsure(c,p,"Gel bu gece.",{targetId:"__user__",targetName:"Emre"});
      const f=window.__reqs[0]&&window.__reqs[0].state.toward_the_one_they_answer;
      return (f&&f.toward==="Emre"&&/neighbour/.test(f.who_they_are_to_them)&&f.feelings_right_now&&!/nothing strong/.test(f.feelings_right_now)&&f.lasting_feelings&&!/nothing settled/.test(f.lasting_feelings)&&out.ego==="id_ahead"&&/Emre/.test(window.__reqs[0].questions.ego.instructions)) ? true : JSON.stringify({f,ego:out&&out.ego}); }));
  ok("the state carries what happened earlier today, the people they answer to and who can see (v150.36)", await pg.evaluate(async()=>{
      const c=curChat(), p=state.personas.find(x=>x.id==="p_b"); c.gameDay=4;
      state.personas=state.personas.filter(x=>x.id!=="p_h"); state.personas.push({id:"p_h",name:"Burak",universeId:state.curUniverse,look:{}});
      p.relationships=Object.assign({},p.relationships,{p_h:{tie:"husband",relationship:"Married twelve years."}});
      state.memory=[{id:"t1",ownerId:"p_b",gameDay:4,date:40,content:"Burak and I fought about money this morning.",type:"EXPERIENCE",people:["Burak"]}];
      c.messages.push({mid:"u4",role:"user",content:"Kal bu gece.",speaker:"Emre"}); window.__reqs=[];
      await emotionEnsure(c,p,"Kal bu gece.",{targetId:"__user__",targetName:"Emre"});
      const st=window.__reqs[0]&&window.__reqs[0].state;
      return (st&&/fought about money/.test(JSON.stringify(st.earlier_today))&&/Burak — husband/.test(JSON.stringify(st.people_they_answer_to))&&/alone with Emre/.test(JSON.stringify(st.who_else_can_see_or_hear))&&/who else can see or hear/.test(window.__reqs[0].questions.ego.instructions)) ? true : JSON.stringify(st); }));
  ok("in a public place the state says strangers can see and hear, not 'alone' (v150.42)", await pg.evaluate(()=>{
      const c=curChat(), p=state.personas.find(x=>x.id==="p_b"); const uni=universeById(c.universeId)||state.universes[0];
      uni.locations=(uni.locations||[]).filter(l=>l.id!=="l_pub").concat([{id:"l_pub",name:"Palmera Beach Club",type:"poi",gossipChance:0.6,description:"x",residents:[],sublocations:[{id:"s_bw",name:"Boardwalk",entrance:true}]}]);
      const keep={l:c.locationId,n:c.location,pr:c.presentIds}; c.locationId="l_pub"; c.location="Palmera Beach Club"; c.presentIds=["p_b"];
      const pubW=JSON.stringify(_emoStakeState(c,p,"__user__").who_else_can_see_or_hear);
      c.locationId=keep.l; c.location=keep.n; c.presentIds=keep.pr;
      return (/strangers and staff at Palmera Beach Club/.test(pubW)&&!/alone with/.test(pubW))?true:pubW; }));
  ok("a layout's own {{if ego = …}} and {{if emotion = …}} pick their text", await pg.evaluate(()=>{
      const keepOn=state.payloadTplOn, keepT=state.payloadTemplates;
      state.payloadTplOn=true; state.payloadTemplates={solo:"[system]\nBASE\n\n{{if ego = id_winning or ego = id_ahead}}Your desire is winning over your conscience.{{else}}Your conscience holds.{{endif}}\n\n{{if emotion = anger}}You are angry.{{endif}}\n[system end]\n\n{{call//dialogue_history}}\n"};
      const a=ptBuildMessages("solo",{_railFlags:{ego:"id_ahead",emotion:"Anger"}},[],{});
      const b=ptBuildMessages("solo",{_railFlags:{ego:"superego_firm",emotion:"Joy"}},[],{});
      state.payloadTplOn=keepOn; state.payloadTemplates=keepT;
      const ta=JSON.stringify(a), tb=JSON.stringify(b);
      return (/desire is winning/.test(ta)&&/You are angry/.test(ta)&&!/conscience holds/.test(ta)&&/conscience holds/.test(tb)&&!/angry/.test(tb)) ? true : ta.slice(0,300)+" || "+tb.slice(0,300); }));

  console.log("\n[a real turn]");
  ok("a solo turn asks it before the reply is written", await pg.evaluate(async()=>{
      const c=curChat(); c.messages=[]; c.emo={}; const order=[];
      const realCC=window.chatCompletion;
      window.chatCompletion=async(msgs,model,opts)=>{ const d=(opts&&opts.dbg)||""; if(/^Roleplay reply/.test(d)){ order.push("reply"); return '"Evdeydim."'; } return "{}"; };
      const realF=window.fetch; window.fetch=async(u,o)=>{ if(String(u).indexOf("/api/alpha/decisions")>-1&&JSON.parse(o.body).questions.emotion)order.push("emotion"); return realF(u,o); };
      /* A pending timer keeps this evaluate's promise reachable while the turn runs: without it the browser could
         collect the promise mid-turn ("Resulting promise was garbage collected", about one run in six, on every
         build). A turn that really hangs now fails here, by name, instead of disappearing. */
      try{ const res=await Promise.race([sendMessage({text:"Dün gece neredeydin?"}).then(()=>"done"),new Promise(r=>setTimeout(()=>r("TIMEOUT"),60000))]);
           if(res!=="done")return "the turn did not finish in 60s: "+JSON.stringify(order); }catch(e){ return "threw "+e.message; }
      window.chatCompletion=realCC; window.fetch=realF;
      return (order.indexOf("emotion")>=0&&order.indexOf("emotion")<order.indexOf("reply")&&c.emo.p_b&&c.emo.p_b.emotion==="Anger") ? true : JSON.stringify(order); }));


  console.log("\n[failures and switches]");
  ok("a failure keeps the last pick", await pg.evaluate(async()=>{ const c=curChat(); c.messages.push({mid:"u9",role:"user",content:"?",speaker:"Emre"}); window.__mode="500"; _emoBreak.until=0; _emoBreak.fails=0;
      await emotionEnsure(c,state.personas.find(p=>p.id==="p_b"),"?"); window.__mode="ok"; _emoBreak.fails=0;
      return c.emo.p_b&&c.emo.p_b.emotion==="Anger" ? true : JSON.stringify(c.emo.p_b); }));
  // v150.38 — spoken limits ride in the same request, so they are switched off here too
  ok("off (and spoken limits off): nothing sent", await pg.evaluate(async()=>{ const c=curChat(); c.messages.push({mid:"u10",role:"user",content:"!",speaker:"Emre"}); state.emoOn=false; state.limitsOn=false; window.__reqs=[];
      await emotionEnsure(c,state.personas.find(p=>p.id==="p_b"),"!"); state.emoOn=true; state.limitsOn=true; return window.__reqs.length===0 ? true : "sent"; }));
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
  ok("the three prompts are on their Payloads card; a fresh install has it on", await pg.evaluate(()=>{
      const card=ENGINE_PAYLOAD_DEFS.find(d=>d.key==="emotion_pick");
      const okCard=card&&["x_emotion_pick","x_emotion_intensity","x_ego_pick"].every(k=>card.blocks.some(x=>x.promptKey===k)&&PROMPT_BY_KEY[k]);
      localStorage.removeItem(K.emoOn); loadState(); return (okCard&&state.emoOn===true) ? true : "card="+okCard+" on="+state.emoOn; }));

  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close();
  process.exit(fail?1:0);
})().catch(e=>{ console.error(e); process.exit(1); });
