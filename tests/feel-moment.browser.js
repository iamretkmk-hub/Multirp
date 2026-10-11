/* v150.110 — THE CONNECTED FEELING SYSTEM, STEP 2: THE MOMENT, ONE REQUEST PER REPLY. In place of the emotion pick and the body
   read, one Decisions request before each reply asks how each feeling moved (with its target), what the other person did
   (signals), whether something set off other feelings (events) and whom a crossed line wrongs, the ego verdict against the cases
   every layer makes, and whether it is hidden. The code applies it, finds what leads, and the reply gets "What is running in you
   right now" and the ego style beside the feeling's box (masked: "…and hiding it — this is how it leaks through"). With the
   Decisions endpoint stubbed.
   Run: node tests/feel-moment.browser.js */
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:process.env.SM_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage({viewport:{width:412,height:915}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file://'+require('path').resolve(__dirname,'..','index.html')); await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard();
    state.decSplit=false; try{ store.set(K.decSplit,false); }catch(_){} });
  await pg.waitForTimeout(800);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x===undefined?c:x).slice(0,900));} };
  const E=(f,a)=>pg.evaluate(f,a);

  await E(()=>{
    window.__reqs=[]; window.__ans={};
    const realFetch=window.fetch;
    window.fetch=async(url,opts)=>{ const u=String(url);
      if(u.indexOf("/api/alpha/decisions")>-1){ const body=JSON.parse(opts.body); window.__reqs.push(body);
        const a={}; Object.keys(body.questions).forEach(k=>{ if(window.__ans[k])a[k]=window.__ans[k]; });
        return new Response(JSON.stringify({answers:Object.keys(a).length?a:{ego:{type:"choice",choice:"no_conflict"}}}),{status:200}); }
      if(u.indexOf("chat/completions")>-1)return new Response(JSON.stringify({choices:[{message:{content:"{}"}}]}),{status:200});
      return realFetch(url,opts); };
    const uni=state.universes[0]; state.curUniverse=uni.id;
    state.personas=state.personas.filter(p=>!/^fm_/.test(p.id));
    state.personas.push({id:"fm_m",name:"Mara",universeId:uni.id,personality:"Warm, careful.",look:{},
      temper:{reactivity:60,recovery:50,expressiveness:30,impulsivity:50,conscience:70,mood:0},values:"Your family.",lines:"You would never cheat — though you have thought about it.",
      relationships:{fm_t:{tie:"husband",relationship:"Married ten years."},__user__:{tie:"neighbour",relationship:"The neighbour you talk to over the fence."}},
      _speechMigrated:SPEECH_MIG,
      speech:{spoken:{main:"## SPEECH: HOW YOU TALK\nYou speak softly.",emo:{Desire:"### You are feeling full of desire — this is how you respond when you are full of desire:\n- You stand closer than you need to: \"Burada mı?\"",Guilt:"### You are feeling guilty — this is how you respond when you are guilty:\n- You get formal."},
        ego:{id_ahead:"### You are giving in — this is what you do when the want is ahead and you are finding reasons:\n- You argue yourself into it out loud: \"Sadece bir kahve.\""}},
        text:{main:"",emo:{},ego:{}},heat:{main:"",emo:{},ego:{}}}});
    state.personas.push({id:"fm_t",name:"Tomas",universeId:uni.id,personality:"x",look:{}});
    state.user="Emre"; state.key="sk-test"; state.emoOn=true; state.emoModel=""; state.emotions=null;
    state.memJudgeOn=false; state.replyCheckOn=false; state.trackDecOn=false; state.gateOn=false; state.relOn=true;
    const c=curChat(); Object.assign(c,{universeId:uni.id,presentIds:["fm_m"],emo:{},feel:{},rel:{},fsv:1,fsTurn:0,gameDay:3,period:"Evening",
      messages:[{mid:"u1",role:"user",content:"Bu akşam bir kahve içelim mi?",speaker:"Emre"}]});
    const o=relObj(c,"fm_m","__user__"); Object.assign(o,{attraction:60,affection:40,familiarity:50,trust:40}); Object.assign(o.op,{appealing:60,interested:50,safe:40,kind:50});
    const h=relObj(c,"fm_m","fm_t"); Object.assign(h,{commitment:80,affection:50,familiarity:80,trust:50});
    window.__M=()=>state.personas.find(p=>p.id==="fm_m");
  });

  console.log("\n[one request: moves, signals, events, the verdict, hidden]");
  await E(()=>{ window.__ans={f_desire:{type:"choice",choice:"rose_a_lot",probabilities:{rose_a_lot:0.8,rose:0.2}},f_warmth:{type:"choice",choice:"rose",probabilities:{rose:0.7,unchanged:0.3}},
    s_flirtation:{type:"noul",noul:0.8},ego:{type:"choice",choice:"id_ahead",probabilities:{id_ahead:0.6,torn:0.3}},masked:{type:"noul",noul:0.85}}; window.__reqs=[]; });
  const r1=await E(async()=>{ const c=curChat(); const out=await emotionEnsure(c,__M(),"Bu akşam bir kahve içelim mi?",{targetId:"__user__",targetName:"Emre"});
    const q=(window.__reqs[0]||{}).questions||{}, st=(window.__reqs[0]||{}).state||{};
    return {out:out&&{emotion:out.emotion,intensity:out.intensity,ego:out.ego,masked:out.masked,lead:out.lead,ceiling:out.ceiling,signals:out.signals},
      n:window.__reqs.length,keys:Object.keys(q),desireQ:q.f_desire,guiltQ:q.f_guilt,egoQ:q.ego,st,
      desire:fsVal(c,"fm_m","desire","p:__user__"),ev:(c.rel["fm_m>__user__"].evidence||[]).map(e=>e.s),turn:c.fsTurn}; });
  ok("one request", r1.n===1, r1.n);
  ok("a move question for every feeling, each with its target (desire about Emre, guilt about yourself)", r1.keys.filter(k=>/^f_/.test(k)).length===22&&/desire about Emre/.test(r1.desireQ.instructions)&&/guilt about yourself/.test(r1.guiltQ.instructions)&&JSON.stringify(Object.keys(r1.desireQ.criteria))==='["fell_a_lot","fell","unchanged","rose","rose_a_lot"]', JSON.stringify({k:r1.keys.length,d:r1.desireQ&&r1.desireQ.instructions.slice(0,300)}));
  ok("a yes/no for each signal and each event, whom a crossed line wrongs (her husband is a choice), the verdict and hidden", r1.keys.filter(k=>/^s_/.test(k)).length===16&&r1.keys.filter(k=>/^e_/.test(k)).length===4&&r1.keys.includes("wronged")&&r1.keys.includes("ego")&&r1.keys.includes("masked"), JSON.stringify(r1.keys));
  ok("the ego question weighs the layered cases", /THE LAYERED CASES/.test(r1.egoQ.instructions)&&JSON.stringify(Object.keys(r1.egoQ.criteria))==='["no_conflict","superego_firm","superego_ahead","torn","id_ahead","id_winning"]');
  ok("the state carries every layer in words: temperament, values, lines, the relationship, today's opinions, what is running, the two cases and how far the backing goes",
    /Things land/.test(r1.st.character.how_feelings_run_in_you)&&/family/.test(r1.st.character.values)&&r1.st.toward&&r1.st.toward.the_relationship.some(x=>/^Attraction: strong \(60\)/.test(x))&&r1.st.toward.how_you_see_them_today.length===6
    &&Array.isArray(r1.st.feelings_running_now)&&/\/100/.test(r1.st.the_case_for_acting)&&/\/100/.test(r1.st.the_case_for_holding_back)&&!!r1.st.the_furthest_the_backing_allows_now&&Array.isArray(r1.st.character.what_you_do_in_each_state), JSON.stringify(r1.st).slice(0,900));
  ok("the answers are applied: desire about Emre rose, the flirting is kept as evidence", r1.desire>20&&r1.ev.includes("flirtation"), JSON.stringify({d:r1.desire,ev:r1.ev}));
  ok("what leads becomes the emotion its box voices, with the verdict and hidden", r1.out&&r1.out.emotion==="Desire"&&r1.out.ego==="id_ahead"&&r1.out.masked===true&&r1.out.lead&&r1.out.lead.k==="desire", JSON.stringify(r1.out));
  ok("the clock moved one turn for the line answered", r1.turn===1, r1.turn);

  console.log("\n[the reply]");
  const pay=await E(()=>{
    Object.assign(state,{payloadTplOn:false,fragments:null,trackOn:false,memory:[],intentOn:false,promiseOn:false,gossip:[]});
    store.setRaw(K.fragAdds,FRAG_SHIPPED_ADDS.map(a=>a.key).join(",")); state.blockTpls={};
    const p=__M(), c=curChat(); ["_heatBeat","activeEvent"].forEach(k=>{ delete c[k]; });
    const inj={recent:[],diary:[],longterm:[]};
    const hopts={chat:c,targetName:"Emre",targetId:"__user__",payloadKind:"solo"};
    const topts={chat:c,selfP:p,selfId:p.id,selfName:p.name,targetName:"Emre",targetId:"__user__",injected:inj,payloadKind:"solo"};
    const mk=()=>Object.assign({},buildCharPromptBlocks(p,[],inj,null,hopts),buildTailBlocks(topts));
    return (ptBuildMessages("solo",mk(),[{role:"user",content:"(history)"}],{chat:c,npc:p,targetName:"Emre"},mk)||[]).map(x=>x.content).join("\n\n"); });
  ok("the reply carries what is running in her: what leads, that it is hidden, how far she will go", /# WHAT IS RUNNING IN YOU RIGHT NOW/.test(pay)&&/Leading: desire about Emre/.test(pay)&&/You are hiding it/.test(pay)&&/the furthest you will go right now/i.test(pay), pay.slice(pay.indexOf("RUNNING IN YOU")-50,pay.indexOf("RUNNING IN YOU")+700)||pay.slice(-1500));
  ok("the feeling's box says it is hidden and leaks", /### You are feeling full of desire and hiding it — this is how it leaks through:/.test(pay)&&!/You are feeling full of desire — this is how you respond/.test(pay), "");
  ok("the ego style for the verdict goes beside it", /### You are giving in — this is what you do when the want is ahead/.test(pay)&&/Sadece bir kahve/.test(pay));
  ok("the old body read sends nothing", !/WHAT YOUR BODY IS DOING THIS SECOND/.test(pay));

  console.log("\n[a release, care, crossing a line — the rules follow]");
  await E(()=>{ const c=curChat(); c.messages.push({mid:"u2",role:"user",content:"İyi misin? Pişman mısın?",speaker:"Emre"});
    window.__ans={e_release:{type:"noul",noul:0.9},e_crossed_line:{type:"noul",noul:0.85},wronged:{type:"choice",choice:"w_fm_t"},s_care:{type:"noul",noul:0.9},
      ego:{type:"choice",choice:"torn"},masked:{type:"noul",noul:0.2}}; window.__reqs=[]; });
  const r2=await E(async()=>{ const c=curChat(), before=fsVal(c,"fm_m","desire","p:__user__");
    const out=await emotionEnsure(c,__M(),"İyi misin? Pişman mısın?",{targetId:"__user__",targetName:"Emre"});
    const g=c.feel.fm_m.list.find(f=>f.k==="guilt");
    return {before,after:fsVal(c,"fm_m","desire","p:__user__"),guilt:g&&{v:g.v,tgt:g.tgt,about:g.about,with:g.with,hold:g.hold},comfort:fsVal(c,"fm_m","comfort","p:__user__"),
      ev:(c.rel["fm_m>__user__"].evidence||[]).map(e=>e.s+":"+e.x),ego:out.ego,masked:out.masked,lead:out.lead,events:out.events,op:JSON.stringify(c.rel["fm_m>__user__"].op)}; });
  ok("after the release desire drops hard", r2.after<r2.before*0.4, JSON.stringify(r2));
  ok("crossing a line raises guilt about herself, wronging her husband, unresolved — not an opinion of Emre", r2.guilt&&r2.guilt.tgt==="self"&&r2.guilt.about==="fm_t"&&r2.guilt.with==="__user__"&&r2.guilt.hold===true, JSON.stringify(r2.guilt));
  ok("his care lands, and counts more because she is raw", r2.comfort>0&&r2.ev.some(x=>/^care:/.test(x)&&+x.split(":")[1]>1.2), JSON.stringify(r2.ev));
  ok("the verdict moves on (torn), it is no longer hidden", r2.ego==="torn"&&r2.masked===false, JSON.stringify({ego:r2.ego,m:r2.masked}));

  console.log("\n[ego styles in the card]");
  ok("speech keeps a box per ego verdict, and the editor shows and saves them", await E(()=>{
      editPersona("fm_m"); const t=document.querySelector('#peSpeechBoxes .psEgo[data-ego="torn"]'); if(!t)return "no ego boxes";
      const n=document.querySelectorAll('#peSpeechBoxes .psEgo').length;
      t.value="### You are torn — this is what you do when either side could win:\n- You start a sentence twice."; savePersona();
      const p=__M(); return (n===6&&/start a sentence twice/.test(p.speech.spoken.ego.torn)&&/Sadece bir kahve/.test(p.speech.spoken.ego.id_ahead))?true:JSON.stringify({n,ego:p.speech.spoken.ego}); }));
  ok("a new character gets ego styles written after their speech (the ego styles writer)", await E(()=>/HOW|what {{char}} DOES in each state of want against conscience/.test(X_ENGINE_PROMPTS.x_ego_style_writer.def)&&/"id_winning"/.test(X_ENGINE_PROMPTS.x_ego_style_writer.def)&&typeof writeEgoStyles==="function"&&/writeEgoStyles/.test(writeStylesForNew.toString())));
  ok("the evaluation prompts are the feeling system's (the emotion pick's are retired)", await E(()=>!X_ENGINE_PROMPTS.x_emotion_pick&&!X_ENGINE_PROMPTS.x_emotion_intensity&&["x_feel_move","x_feel_signal","x_feel_event","x_feel_wronged","x_feel_masked"].every(k=>X_ENGINE_PROMPTS[k]&&PROMPT_BY_KEY[k])));

  console.log("\n[the body read stands down]");
  ok("with the feeling system on, the five-turn body read sends nothing (and still stamps who was seen)", await E(async()=>{
      const c=curChat(); let calls=0; const real=window.chatCompletion; window.chatCompletion=async()=>{ calls++; return "{}"; };
      state.stInterval=1; try{ await runShortTermRel(c); await runShortTermRel(c); }finally{ window.chatCompletion=real; }
      return calls===0?true:"body read ran "+calls; }));

  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close(); process.exit(fail?1:0);
})();
