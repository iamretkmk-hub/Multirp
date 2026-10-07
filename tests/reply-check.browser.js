/* v150.30 — THE REPLY CHECK: three yes/no questions about every posted character reply.
   One Decisions-API request (OpenRouter /api/alpha/decisions) asks whether the reply is the AI refusing,
   whether it writes the player's part, and whether it is out of character, and gets a probability for
   each. Checked here, with the endpoint stubbed:
     • the request: endpoint, key, default and chosen model, three noul questions whose instructions and
       yes/no criteria come from the three editable prompts (the YES:/NO: lines split out), and a state
       holding the character's sheet, the player, the scene before the reply (not the reply) and the reply;
     • at or above the threshold a question flags the reply: stored on the message, a pill on the bubble
       naming the doubt and its likelihood; below it, nothing is shown; the threshold is the setting;
     • it only marks — the reply stays posted as given and no second roleplay call is made (v148.7);
     • a real solo turn through sendMessage fires it once, after the reply is posted;
     • any failure leaves the reply unmarked; a 401 pauses the reply check without pausing the memory
       judge; off or with no key nothing is sent; an edited prompt reaches the request;
     • settings round-trip and default on at 0.7.
   Run: node tests/reply-check.browser.js */
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
    window.__reqs=[]; window.__mode="ok"; window.__p={refusal:0.02,player:0.91,character:0.4};
    const realFetch=window.fetch;
    window.fetch=async(url,opts)=>{
      const u=String(url);
      if(u.indexOf("/api/alpha/decisions")>-1){
        const body=JSON.parse(opts.body); window.__reqs.push({url:u,headers:opts.headers,body});
        if(window.__mode==="network") throw new TypeError("Failed to fetch");
        if(window.__mode==="401") return new Response(JSON.stringify({error:{message:"bad key"}}),{status:401});
        if(window.__mode==="500") return new Response(JSON.stringify({error:{message:"upstream"}}),{status:500});
        const answers={};
        Object.keys(body.questions).forEach(k=>{ answers[k]={type:"noul",noul:(k in window.__p)?window.__p[k]:0.01}; });
        return new Response(JSON.stringify({answers}),{status:200});
      }
      return realFetch(url,opts);
    };
    const uni=state.universes[0];
    state.personas=state.personas.filter(p=>p.id!=="p_b");
    state.personas.push({id:"p_b",name:"Burcu",universeId:uni.id,instructions:"x",personality:"Sharp, guarded, dry humour.",backstory:"x",style:"Short sentences, never gushes.",goals:"x",look:{}});
    const chat=curChat(); chat.presentIds=["p_b"]; chat.universeId=uni.id; state.curUniverse=uni.id;
    state.user="Emre"; state.key="sk-test"; state.replyCheckOn=true; state.replyCheckAt=0.7; state.replyCheckModel="";
    state.memJudgeOn=false;
    chat.messages=[{mid:"u1",role:"user",content:"Kahve ister misin?",speaker:"Emre"}];
    window.__mkReply=(text)=>{ const c=curChat(); const m={mid:newMid(),role:"assistant",speaker:"Burcu",speakerId:"p_b",content:text,img:null,imgState:"idle",vidState:"idle",video:null};
      c.messages.push(m); return m; };
  });

  console.log("\n[the request]");
  const r=await pg.evaluate(async()=>{ window.__reqs=[]; const m=__mkReply('*Burcu fincanı alır.* "Olur." Emre gülümser ve ona sarılır.');
    await runReplyCheck(curChat(),m,state.personas.find(p=>p.id==="p_b")); return {req:window.__reqs,m}; });
  const q=(r.req[0]||{body:{questions:{}}}).body;
  ok("one request to the Decisions endpoint with the OpenRouter key", r.req.length===1&&r.req[0].url==="https://openrouter.ai/api/alpha/decisions"&&r.req[0].headers.Authorization==="Bearer sk-test", JSON.stringify(r.req.map(x=>x.url)));
  ok("default model is openai/gpt-6-luna-decisions", q.model==="openai/gpt-6-luna-decisions", q.model);
  ok("five noul questions: refusal, player, character, and (v150.49) repeat and continuity", JSON.stringify(Object.keys(q.questions||{}).filter(k=>k!=="time_moved"))==='["refusal","player","character","repeat","continuity"]'&&Object.values(q.questions).every(x=>x.type==="noul"), JSON.stringify(Object.keys(q.questions||{})));
  ok("YES:/NO: lines become the criteria, the rest the instructions, placeholders filled", (()=>{ const x=q.questions.player||{};
      return /^Does the reply write Emre's part/.test(x.instructions||"")&&!/YES:|NO:/.test(x.instructions)&&/^It puts words in Emre's mouth/.test(x.criteria.true)&&/^It plays only Burcu/.test(x.criteria.false)
        &&!/\{\{/.test(JSON.stringify(q.questions)); })(), JSON.stringify(q.questions&&q.questions.player));
  ok("the state: sheet, player, the scene before the reply, the reply", q.state&&q.state.character&&q.state.character.name==="Burcu"&&/guarded/.test(q.state.character.personality)&&/Short sentences/.test(q.state.character.speaking_style)
      &&q.state.player==="Emre"&&/Kahve ister misin/.test(q.state.scene_before_the_reply)&&!/fincanı/.test(q.state.scene_before_the_reply)&&/sarılır/.test(q.state.reply), JSON.stringify(q.state));

  ok("(v150.49) the state has their own earlier lines in this scene (not this reply), and where and who", await pg.evaluate(async()=>{
      const c=curChat(), keep=c.messages.slice();
      c.messages=[{mid:"e1",role:"user",content:"Kahve?",speaker:"Emre"},{mid:"e2",role:"assistant",speaker:"Burcu",speakerId:"p_b",content:'"Düşmem, çocuk değiliz."'},
        {mid:"e3",role:"user",content:"*sits on the rock*",speaker:"Emre"}];
      window.__reqs=[]; const m=__mkReply('"Kendim düşerim, merak etme."'); await runReplyCheck(c,m,state.personas.find(p=>p.id==="p_b"));
      const st=window.__reqs[0].body.state; c.messages=keep;
      return (JSON.stringify(st.their_own_earlier_lines_this_scene)==='["\\"Düşmem, çocuk değiliz.\\""]'&&/present: Emre, Burcu/.test(st.where_and_who)&&/merak etme/.test(st.reply))?true:JSON.stringify(st); }));
  ok("(v150.49) the repeat question names the deflection and the doubled sound; continuity names asking for what was already done", await pg.evaluate(()=>{
      const r=X_ENGINE_PROMPTS.x_reply_check_repeat.def, c=X_ENGINE_PROMPTS.x_reply_check_continuity.def;
      return (/same deflection, excuse or refusal/.test(r)&&/\[sigh\] tag and a \*sighs\*/.test(r)&&/telling someone to sit who already sat/.test(c))?true:"wording"; }));

  ok("the scene before the reply stops at the last scene cut", await pg.evaluate(async()=>{
      const c=curChat(), keep=c.messages.slice();
      c.messages=[{mid:"s1",role:"assistant",speaker:"Narrator",narratorEvent:true,content:"Plajda dalgalar."},
        {mid:"s2",role:"assistant",speaker:"Narrator",narratorEvent:true,sceneCut:true,content:"Akşam, Emre'nin evi."},
        {mid:"s3",role:"user",content:"Çay?",speaker:"Emre"}];
      window.__reqs=[]; const m=__mkReply('"Olur."'); await runReplyCheck(c,m,state.personas.find(p=>p.id==="p_b"));
      const st=window.__reqs[0].body.state.scene_before_the_reply; c.messages=keep;
      return (!/Plajda/.test(st)&&/Emre'nin evi/.test(st)&&/Çay\?/.test(st)) ? true : JSON.stringify(st); }));

  console.log("\n[it marks, and only marks]");
  ok("above the threshold: flagged on the message with its probabilities", JSON.stringify(r.m.replyFlags)==='["player"]'&&r.m.replyCheck.player===0.91&&r.m.replyCheck.character===0.4, JSON.stringify([r.m.replyFlags,r.m.replyCheck]));
  ok("the bubble shows one pill naming the doubt and its likelihood", await pg.evaluate(()=>{
      const c=curChat(), m=c.messages[c.messages.length-1]; renderChat();
      const el=document.querySelector('.bubble[data-mid="'+m.mid+'"]'); if(!el) return "no bubble";
      const pills=[...el.querySelectorAll('.replyFlag')];
      return (pills.length===1&&/speaks for you/.test(pills[0].textContent)&&/91% likely writing your part/.test(pills[0].title)) ? true : el.innerHTML.slice(0,400); }));
  ok("the reply text is left exactly as given", await pg.evaluate(()=>{ const c=curChat(), m=c.messages[c.messages.length-1];
      return m.content==='*Burcu fincanı alır.* "Olur." Emre gülümser ve ona sarılır.' ? true : m.content; }));
  ok("below the threshold nothing is shown; the threshold is the setting", await pg.evaluate(async()=>{
      window.__p={refusal:0.02,player:0.65,character:0.1};
      const m=__mkReply('"Olur."'); await runReplyCheck(curChat(),m,state.personas.find(p=>p.id==="p_b"));
      const a=m.replyFlags.length===0&&m.replyCheck.player===0.65&&replyCheckPills(m)==="";
      state.replyCheckAt=0.6; const m2=__mkReply('"Olur."'); await runReplyCheck(curChat(),m2,state.personas.find(p=>p.id==="p_b"));
      state.replyCheckAt=0.7;
      return (a&&JSON.stringify(m2.replyFlags)==='["player"]') ? true : JSON.stringify([m.replyFlags,m2.replyFlags]); }));

  console.log("\n[a real turn]");
  ok("a solo turn through sendMessage is checked once, after the reply is posted, with no second roleplay call", await pg.evaluate(async()=>{
      window.__p={refusal:0.97,player:0.02,character:0.02}; window.__reqs=[];
      const calls=[]; const realCC=window.chatCompletion;
      window.chatCompletion=async(msgs,model,opts)=>{ const d=(opts&&opts.dbg)||""; calls.push(d);
        if(/^Roleplay reply/.test(d)) return '"Bunu yazamam, üzgünüm."'; return "{}"; };
      const c=curChat(); c.messages=[];
      try{ await sendMessage({text:"Anlat bakalım."}); }catch(e){ return "sendMessage threw: "+e.message; }
      const t=Date.now(); while(Date.now()-t<6000&&!window.__reqs.length) await new Promise(r=>setTimeout(r,50));
      await new Promise(r=>setTimeout(r,300));
      window.chatCompletion=realCC;
      const rp=calls.filter(d=>/^Roleplay reply/.test(d)).length;
      const m=c.messages.filter(x=>x.role==="assistant"&&!x.sysError).pop();
      if(!m) return "no reply posted; calls="+JSON.stringify(calls);
      // the turn also sends the emotion pick (its own Decisions request); only the reply check's is counted here
      const rc=window.__reqs.filter(r=>r.body&&r.body.questions&&r.body.questions.refusal);
      return (rc.length===1&&rp===1&&JSON.stringify(m.replyFlags)==='["refusal"]'&&rc[0].body.state.reply===m.content) ? true
        : JSON.stringify({reqs:rc.length,rp,flags:m.replyFlags,content:m.content}); }));

  console.log("\n[failures, pauses, switches]");
  for(const mode of ["500","network"]){
    ok("a "+mode+" leaves the reply unmarked", await pg.evaluate(async(mode)=>{ window.__mode=mode; _replyCheckBreak.until=0; _replyCheckBreak.fails=0;
        const m=__mkReply('"Olur."'); await runReplyCheck(curChat(),m,state.personas.find(p=>p.id==="p_b")); window.__mode="ok";
        return (!m.replyCheck&&!m.replyFlags) ? true : JSON.stringify(m); },mode));
  }
  ok("a 401 pauses the reply check, not the memory judge", await pg.evaluate(async()=>{
      _replyCheckBreak.until=0; _memJudgeBreak.until=0; window.__mode="401";
      await runReplyCheck(curChat(),__mkReply('"Olur."'),state.personas.find(p=>p.id==="p_b")); window.__mode="ok";
      window.__reqs=[]; await runReplyCheck(curChat(),__mkReply('"Olur."'),state.personas.find(p=>p.id==="p_b"));
      const paused=window.__reqs.length===0, memOk=(state.memJudgeOn=true, memJudgeReady()); state.memJudgeOn=false; _replyCheckBreak.until=0;
      return (paused&&memOk) ? true : "reply paused="+paused+" memory ready="+memOk; }));
  ok("off: nothing sent", await pg.evaluate(async()=>{ state.replyCheckOn=false; window.__reqs=[];
      await runReplyCheck(curChat(),__mkReply('"Olur."'),state.personas.find(p=>p.id==="p_b")); state.replyCheckOn=true; return window.__reqs.length===0 ? true : window.__reqs.length+" sent"; }));
  ok("no key: nothing sent", await pg.evaluate(async()=>{ state.key=""; window.__reqs=[];
      await runReplyCheck(curChat(),__mkReply('"Olur."'),state.personas.find(p=>p.id==="p_b")); state.key="sk-test"; return window.__reqs.length===0 ? true : window.__reqs.length+" sent"; }));
  ok("an error notice is never checked", await pg.evaluate(async()=>{ window.__reqs=[]; const m=__mkReply("Something went wrong."); m.sysError=true;
      await runReplyCheck(curChat(),m,state.personas.find(p=>p.id==="p_b")); return window.__reqs.length===0 ? true : "checked"; }));

  console.log("\n[model, prompts, settings]");
  ok("the chosen model is sent", await pg.evaluate(async()=>{ state.replyCheckModel="typesafe/jev-1.13"; window.__reqs=[];
      await runReplyCheck(curChat(),__mkReply('"Olur."'),state.personas.find(p=>p.id==="p_b")); state.replyCheckModel="";
      return window.__reqs[0].body.model==="typesafe/jev-1.13" ? true : window.__reqs[0].body.model; }));
  ok("the three prompts are registry prompts on their own Payloads card", await pg.evaluate(()=>{
      const keys=["x_reply_check_refusal","x_reply_check_player","x_reply_check_character"];
      const card=ENGINE_PAYLOAD_DEFS.find(d=>d.key==="reply_check");
      const bad=keys.filter(k=>!PROMPT_BY_KEY[k]||!["char","user"].every(t=>promptPlaceholders(k).includes(t)));
      return (!bad.length&&card&&keys.every(k=>card.blocks.some(x=>x.promptKey===k))) ? true : "bad="+bad.join(",")+" card="+!!card; }));
  ok("an edited prompt reaches the request; one with no YES:/NO: lines still asks", await pg.evaluate(async()=>{
      state.x_reply_check_character="Does {{char}} sound like a robot here?"; window.__reqs=[];
      await runReplyCheck(curChat(),__mkReply('"Olur."'),state.personas.find(p=>p.id==="p_b")); state.x_reply_check_character="";
      const x=window.__reqs[0].body.questions.character;
      return (x.instructions==="Does Burcu sound like a robot here?"&&x.criteria.true==="Yes."&&x.criteria.false==="No.") ? true : JSON.stringify(x); }));
  ok("the check's request is a Debug row with its probabilities", await pg.evaluate(()=>{
      const e=dbgLog.slice().reverse().find(x=>/^Reply check · Burcu/.test(x.label||""));
      return (e&&e.status==="ok"&&e.result&&e.result.probabilities) ? true : JSON.stringify(e&&{s:e.status,r:e.result}); }));
  ok("settings round-trip", await pg.evaluate(()=>{
      state.replyCheckOn=false; state.replyCheckAt=0.5; state.replyCheckModel="typesafe/jev-1.13"; syncSettingsUI();
      const on=document.getElementById('setReplyCheckOn'), at=document.getElementById('setReplyCheckAt'), mo=document.getElementById('setReplyCheckModel');
      if(!on||!at||!mo) return "inputs missing";
      if(on.checked||+at.value!==0.5||mo.value!=="typesafe/jev-1.13") return "sync: "+[on.checked,at.value,mo.value];
      on.checked=true; at.value="0"; mo.value=" "; saveSettings(false);
      return (state.replyCheckOn===true&&state.replyCheckAt===0.05&&state.replyCheckModel===""&&store.raw(K.replyCheckOn,"")==="1"&&store.raw(K.replyCheckAt,"")==="0.05") ? true
        : JSON.stringify([state.replyCheckOn,state.replyCheckAt,state.replyCheckModel,store.raw(K.replyCheckAt,"?")]); }));
  ok("a fresh install has it on at 0.7", await pg.evaluate(()=>{
      localStorage.removeItem(K.replyCheckOn); localStorage.removeItem(K.replyCheckAt); localStorage.removeItem(K.replyCheckModel);
      loadState(); return (state.replyCheckOn===true&&state.replyCheckAt===0.7&&state.replyCheckModel==="") ? true : JSON.stringify([state.replyCheckOn,state.replyCheckAt]); }));

  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close();
  process.exit(fail?1:0);
})().catch(e=>{ console.error(e); process.exit(1); });
