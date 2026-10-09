/* v150.38 — WHAT A CHARACTER HAS SAID ABOUT HOW FAR THIS GOES, READ IN THE REPLY'S DECISIONS REQUEST.
   The drives writer is gone (about fifteen seconds per reply, and characters fixated on what did not matter).
   The spoken limits it used to read ("Bari şuradaki banka kadar gidelim, daha fazla değil" — to that bench, no
   further) are now questions in the request asked before the character's next reply, beside their emotion:
   one choice per new line of theirs (none, or a limit / commitment for the scene, the day, or until changed), one
   yes/no per limit on record (taken back?), both at the strict gates' certainty. Stored, surfaced and checked as
   before. Pinned through the reply fragments (v150.66: the only reply builder; it was the user's own template), the real
   send path, and a stubbed Decisions endpoint.
   Run: node tests/spoken-limits.browser.js   (needs playwright; see tests/README.md) */
const {chromium}=require('playwright');
const BIN=process.env.SM_CHROME||process.env.CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
(async()=>{
  const b=await chromium.launch({executablePath:BIN});
  const pg=await b.newPage({viewport:{width:412,height:915}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file://'+require('path').resolve(__dirname,'..','index.html')); await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  // v150.87 — this file checks the one-request bundle (Settings → Decisions → One request per topic OFF); the split is tests/decision-split.browser.js
  await pg.evaluate(()=>{ state.decSplit=false; try{ store.set(K.decSplit,false); }catch(_){} const e=document.getElementById("setDecSplit"); if(e)e.checked=false; });
  await pg.waitForTimeout(900);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x===undefined?c:x).slice(0,900));} };

  await pg.evaluate(()=>{
    window.__calls=[]; window.__decs=[];
    window.__stub={reply:'"Tamam."', dec:null, mode:"ok"};
    window.chatCompletion=async(messages,model,opts)=>{
      const dbg=(opts&&opts.dbg)||"";
      window.__calls.push({dbg,t:JSON.stringify(messages),messages,opts:Object.assign({},opts||{}),at:window.__calls.length});
      if(opts&&opts.rp===true) return typeof __stub.reply==="function"?__stub.reply(messages):__stub.reply;
      return "{}";
    };
    const realFetch=window.fetch;
    window.fetch=async(url,o)=>{
      if(String(url).indexOf("/api/alpha/decisions")>-1){
        const body=JSON.parse(o.body); __decs.push(body);
        if(__stub.mode==="500") return new Response(JSON.stringify({error:{message:"upstream"}}),{status:500});
        const answers={};
        Object.keys(body.questions).forEach(k=>{
          const q=body.questions[k];
          if(q.type==="choice"){ const keys=Object.keys(q.criteria); const pr={}; keys.forEach(x=>{ pr[x]=x===keys[0]?1:0; }); answers[k]={type:"choice",choice:keys[0],probabilities:pr}; }
          else answers[k]={type:"noul",noul:0.02};
        });
        if(__stub.dec) Object.assign(answers,__stub.dec(body)||{});
        return new Response(JSON.stringify({answers}),{status:200});
      }
      return realFetch(url,o);
    };
    window.__lim=(kind,p)=>{ const pr={}; ["none","limit_scene","limit_day","limit_until_changed","commitment_scene","commitment_day","commitment_until_changed"].forEach(k=>{ pr[k]=0; });
      pr.none=1-p; pr[kind]=p; return {type:"choice",choice:p>=0.5?kind:"none",probabilities:pr}; };
    window.__setup=()=>{
      const uni=state.universes[0];
      uni.locations=[
        {id:"l_lake",name:"Lakeside Trail",type:"public",description:"A running trail by a lake.",residents:[],gossipChance:0.4,
         sublocations:[{id:"s_kiosk",name:"Trailhead Kiosk"},{id:"s_bench",name:"Shaded Rest Stop with bench"}]},
        {id:"l_park",name:"City Park",type:"public",description:"A park.",residents:[],sublocations:[]}];
      const mk=(id,name,extra)=>Object.assign({id,name,universeId:uni.id,instructions:"",personality:"You are "+name+".",
        backstory:"",style:"s",goals:"",interject:"",look:{raw:name+" looks tall"},relationships:{}},extra||{});
      state.personas=[mk("p_d","Duygu",{relationships:{p_h:{tie:"husband",relationship:"You married Hakan twelve years ago."},__user__:{tie:"friend",relationship:"Emre is an old friend."}}}),mk("p_h","Hakan")];
      Object.assign(state,{key:"k",user:"Emre",userBio:"Emre is an engineer.",userLook:"",mem:false,sceneOn:true,confrontOn:false,
        gmOn:false,autoRpOn:false,heatOn:false,suggestOn:false,autoSpeak:false,narrMode:false,relOn:false,trackOn:false,calOn:false,
        promiseOn:false,gossipOn:false,intentOn:false,pulseOn:false,roundOn:false,charQuestsOn:false,goalPursuitOn:false,textsOn:false,
        autoImg:false,imgMode:"off",streamReveal:false,storyLang:"en",voiceCheckOn:false,presenceOff:true,
        emoOn:true,limitsOn:true,gateAt:0.8,replyCheckOn:false,memJudgeOn:false,trackDecOn:false});
      try{ _emoBreak.until=0; _emoBreak.fails=0; }catch(e){}
      state.fragments=null;
      state.memory=[]; state.gossip=[]; uni.gameData={};
      const c=curChat();
      Object.assign(c,{universeId:uni.id,presentIds:["p_d"],subPos:{p_d:"s_bench"},subId:"s_bench",
        locationId:"l_lake",location:"Lakeside Trail",gameDay:2,period:"Midday",activeEvent:null,dnd:false,messages:[],
        calendar:[],promises:[],rel:{},emo:{},spokenLimits:{},spokenLimitsRead:{}});
      window.__calls=[]; window.__decs=[]; __stub.reply='"Tamam."'; __stub.dec=null; __stub.mode="ok";
      show('chat'); try{ renderChat(); }catch(e){}
      return c;
    };
    window.__settle=async(ms)=>{ const t=Date.now(); while(Date.now()-t<(ms||8000)){ await new Promise(r=>setTimeout(r,60));
      if(!_presentPlaying&&!_presentQueue.length) { await new Promise(r=>setTimeout(r,120)); if(!_presentPlaying&&!_presentQueue.length) return true; } } return false; };
    window.__turn=async(text)=>{ const n0=__calls.length, d0=__decs.length; await sendMessage({text}); await __settle(); return {calls:__calls.slice(n0),decs:__decs.slice(d0)}; };
    window.__rep=cs=>cs.filter(c=>/^Roleplay reply( · |$)/.test(c.dbg));
  });

  console.log("\n[1 — no drives writer]");
  const r1=await pg.evaluate(async()=>{ __setup(); const t=await __turn('"Hey Duygu, how is life?"');
    return {drv:t.calls.filter(c=>/Drives/i.test(c.dbg)).length, rp:__rep(t.calls).length, decs:t.decs.length,
      gone:["psycheEnsure","_writePsyche","psycheFor","DEFAULT_PSYCHE"].filter(n=>{ try{ return typeof eval(n)!=="undefined"; }catch(e){ return false; } }),
      reg:typeof PROMPT_REGISTRY!=="undefined"&&PROMPT_REGISTRY.some(x=>x&&x.key==="psychePrompt")}; });
  ok("a turn makes no drives call: one roleplay reply, and the reply's Decisions request", r1.drv===0&&r1.rp===1&&r1.decs>=1, JSON.stringify(r1));
  ok("the writer, its prompt and its default are gone", r1.gone.length===0&&r1.reg===false, JSON.stringify(r1));

  console.log("\n[2 — a limit she states is read, stored, surfaced, and checked]");
  const r5=await pg.evaluate(async()=>{
    const c=__setup();
    __stub.reply='"Bari şuradaki banka kadar gidelim, daha fazla değil." *Çayımı iki elimle tutuyorum.*';
    await __turn('"Shall we walk a bit?"');
    const said=c.messages.filter(m=>m.speakerId==="p_d"||m.speaker==="Duygu").pop();
    __stub.reply='"Tamam."';
    __stub.dec=body=>{ const q=body.questions.limit_L1; return q&&/banka kadar/.test(q.instructions)?{limit_L1:__lim("limit_scene",0.93)}:{}; };
    const t=await __turn('*walks past the bench* "Come on, a little further."');
    const req=t.decs.find(d=>d.questions.limit_L1)||null, p=__rep(t.calls);
    const lim=(c.spokenLimits.p_d||[])[0]||null;
    const D=state.personas.find(x=>x.id==="p_d");
    const B=buildTailBlocks({chat:c,selfP:D,selfId:"p_d",selfName:"Duygu",targetName:"Emre",targetId:"__user__",multi:false,injected:{recent:[],diary:[],longterm:[]}});
    const one=t=>[{id:"x",name:"X",seg:"tail",paths:["solo"],text:t,options:[]}];   // a fragment of its own (v150.66: it was a template)
    const pm=ptBuildMessages("solo",B,[],{chat:c,npc:D,targetName:"Emre",fragments:one("{{call//limits//full}}")},()=>B)||[];
    const piece=((ptBuildMessages("solo",B,[],{chat:c,npc:D,targetName:"Emre",fragments:one("{{call//drives//full}}")},()=>B)||[])[0]||{}).content||"";
    const frag=(ptBuildMessages("solo",B,[],{chat:c,npc:D,targetName:"Emre"},()=>B)||[]).map(m=>m.content).join("\n");   // v150.48 — the shipped fragments
    return {req:req&&{qk:Object.keys(req.questions),crit:Object.keys(req.questions.limit_L1.criteria),state:req.state,emo:!!req.questions.emotion,ins:req.questions.limit_L1.instructions},
      rep:p.length?p[0].t:"",lim,saidMid:said&&said.mid,read:(c.spokenLimitsRead||{}).p_d||null,
      limitsBlk:String(B.limits||""),drives:String(B.drives||""),resist:String(B.resistance||""),tplCall:pm.map(m=>m.content).join("\n"),piece,frag};
  });
  ok("her own new line is one choice question in the same request as her emotion",
     !!r5.req&&r5.req.emo&&r5.req.crit.join(",")==="none,limit_scene,limit_day,limit_until_changed,commitment_scene,commitment_day,commitment_until_changed"&&/banka kadar/.test(r5.req.ins)&&!/Çayımı/.test(r5.req.ins),
     JSON.stringify(r5.req));
  ok("the state carries her new lines, numbered, and the limits already on record", !!r5.req&&/\[L1\][^"]*banka kadar/.test(JSON.stringify(r5.req.state.their_new_lines))&&JSON.stringify(r5.req.state.limits_already_on_record)==='["(none)"]', JSON.stringify(r5.req&&r5.req.state));
  ok("the limit is stored per chat per character: her spoken words, tied to the line, scoped as answered",
     !!r5.lim&&r5.lim.kind==="limit"&&r5.lim.saidMid===r5.saidMid&&r5.lim.expires==="scene"&&r5.lim.day===2&&/Midday/i.test(r5.lim.period)&&/Lakeside Trail/.test(r5.lim.place)&&/banka kadar/.test(r5.lim.text)&&!/Çayımı/.test(r5.lim.text),
     JSON.stringify(r5.lim));
  ok("the read pointer moves past that line", r5.read===r5.saidMid, r5.read+" vs "+r5.saidMid);
  ok("the SAME turn's reply shows it (the reply fragments: the limits fragment)",
     /WHAT YOU HAVE SAID ABOUT HOW FAR THIS GOES[\s\S]*banka kadar/.test(r5.rep), r5.rep.slice(-2500));
  ok("the resistance block quotes the line she drew", /YOU HAVE ALREADY SAID WHERE YOUR LINE IS[\s\S]*banka kadar/.test(r5.resist), r5.resist);
  ok("{{call//limits//full}} works in a fragment of its own", /WHAT YOU HAVE SAID ABOUT HOW FAR THIS GOES[\s\S]*banka kadar/.test(r5.tplCall), r5.tplCall);
  ok("(v150.49) the suggested-replies writer is told the line she drew", await pg.evaluate(()=>{ const c=curChat(), D=state.personas.find(x=>x.id==="p_d");
      const t=_sugPeopleBlock(c,[D],"Emre"); return /has said out loud about how far this goes[\s\S]*banka kadar/.test(t)?true:t; }));
  ok("the shipped fragments carry it (v150.48)", /WHAT YOU HAVE SAID ABOUT HOW FAR THIS GOES[\s\S]*banka kadar/.test(r5.frag), r5.frag.slice(-1500));
  ok("the drives block is now exactly the limits block, and calling it in a fragment renders it", r5.drives===r5.limitsBlk&&r5.limitsBlk.length>0&&r5.piece.trim()===r5.limitsBlk.trim(), JSON.stringify({d:r5.drives,p:r5.piece}));

  const r6=await pg.evaluate(async()=>{
    const c=curChat();
    __stub.dec=null;
    const t=await __turn('"Just to the lake then?"');
    const req=t.decs.find(d=>d.questions.limit_release_K1)||null;
    state.relOn=true; state.stInterval=1; c._stCount=0; const n0=__calls.length;
    try{ await runShortTermRel(c); }catch(e){}
    const st=__calls.slice(n0).filter(x=>/^Short-term/.test(x.dbg)).map(x=>x.t).join("\n");
    state.relOn=false;
    const n1=__calls.length;
    try{ await runOvertureJudge(c,{kind:"overture",accuserId:"p_d",accuserName:"Duygu",intent:"a walk",conviction:0.5},"*takes her hand*"); }catch(e){}
    const ov=__calls.slice(n1).filter(x=>x.dbg==="Overture judge").map(x=>x.t).join("\n");
    const n2=__calls.length;
    try{ await runConfrontJudge(c,{kind:"confrontation",accuserId:"p_d",accuserName:"Duygu",intent:"x",conviction:0.5},"no"); }catch(e){}
    const cf=__calls.slice(n2).filter(x=>x.dbg==="Confrontation judge").map(x=>x.t).join("\n");
    return {req:req&&{q:req.questions.limit_release_K1,state:req.state},st,ov,cf,n:activeLimits(c,"p_d").length};
  });
  ok("her next request asks whether she took it back, with it on record in the state",
     !!r6.req&&r6.req.q.type==="noul"&&/banka kadar/.test(r6.req.q.instructions)&&/banka kadar/.test(JSON.stringify(r6.req.state.limits_already_on_record)), JSON.stringify(r6.req));
  ok("a 'no' keeps it", r6.n===1, String(r6.n));
  ok("the intimacy read (short-term) is told the line she drew", /HAS SAID OUT LOUD ABOUT HOW FAR THIS GOES[\s\S]*banka kadar/.test(r6.st), r6.st.slice(-700));
  ok("the overture judge is told it", /HAS SAID OUT LOUD ABOUT HOW FAR THIS GOES[\s\S]*banka kadar/.test(r6.ov), r6.ov.slice(-500));
  ok("the confrontation judge is told it", /HAS SAID OUT LOUD ABOUT HOW FAR THIS GOES[\s\S]*banka kadar/.test(r6.cf), r6.cf.slice(-500));

  console.log("\n[3 — strict: unsure, already on record, a failure, switched off]");
  const r8=await pg.evaluate(async()=>{
    const out={};
    let c=__setup(); __stub.reply='"Go make a salad, I will set the table."'; await __turn('"Hungry?"');
    __stub.reply='"Tamam."'; __stub.dec=b=>b.questions.limit_L1?{limit_L1:__lim("limit_day",0.6)}:{};
    await __turn('"Sure."'); out.unsure=(c.spokenLimits.p_d||[]).length; out.readUnsure=!!(c.spokenLimitsRead||{}).p_d;
    c=__setup(); __stub.reply='"Not tonight."'; await __turn('"Stay?"');
    __stub.reply='"Tamam."'; __stub.dec=b=>b.questions.limit_L1&&/not tonight/i.test(JSON.stringify(b.state.their_new_lines))?{limit_L1:__lim("limit_day",0.95)}:{}; await __turn('"Ok."');
    __stub.reply='"I said not tonight."'; await __turn('"Please?"');
    __stub.reply='"Tamam."'; __stub.dec=b=>b.questions.limit_L1?{limit_L1:__lim("limit_day",0)}:{}; const t2=await __turn('"Fine."');
    out.dupe=(c.spokenLimits.p_d||[]).length; out.dupeState=JSON.stringify((t2.decs.find(d=>d.questions.limit_L1)||{state:{}}).state.limits_already_on_record||"");
    c=__setup(); __stub.reply='"Not past the gate."'; await __turn('"Walk?"');
    __stub.reply='"Tamam."'; __stub.mode="500"; await __turn('"Ok."'); __stub.mode="ok";
    out.failN=(c.spokenLimits.p_d||[]).length; out.failRead=(c.spokenLimitsRead||{}).p_d||null;
    try{ _emoBreak.until=0; _emoBreak.fails=0; }catch(e){}
    __stub.dec=b=>b.questions.limit_L1?{limit_L1:__lim("limit_scene",0.9)}:{}; await __turn('"Still ok?"');
    out.retried=(c.spokenLimits.p_d||[]).length;
    c=__setup(); state.limitsOn=false; state.emoOn=false; __stub.reply='"Not past the gate."'; await __turn('"Walk?"');
    __stub.reply='"Tamam."'; const t3=await __turn('"Ok."');
    /* v150.66 — the reply fragments' asked options still go (there is no switch to turn the fragments off): no limit and no
       emotion question; and with no asked option on the path, no request at all */
    out.offLimitQ=t3.decs.filter(d=>Object.keys(d.questions||{}).some(k=>/^limit_|^emotion$/.test(k))).length;
    state.fragments=JSON.parse(JSON.stringify(FRAG_DEFAULTS)).map(f=>Object.assign(f,{options:(f.options||[]).map(o=>Object.assign(o,{ask:""}))}));
    __stub.reply='"Peki."'; const t4=await __turn('"Sure?"'); out.offDecs=t4.decs.length; state.fragments=null;
    state.limitsOn=true; state.emoOn=true;
    return out;
  });
  ok("below the gate's certainty nothing is filed, and the line is not read again", r8.unsure===0&&r8.readUnsure===true, JSON.stringify(r8));
  ok("one already on record goes in the state, and 'none' files nothing new", r8.dupe===1&&/not tonight/i.test(r8.dupeState), JSON.stringify(r8));
  ok("a failed request files nothing and leaves the line to be read next time", r8.failN===0&&r8.failRead===null&&r8.retried===1, JSON.stringify(r8));
  ok("switched off (and the emotion pick off): no limit question is asked", r8.offLimitQ===0, JSON.stringify(r8));
  ok("…and with no asked fragment option on the path, no Decisions request at all", r8.offDecs===0, JSON.stringify(r8));

  console.log("\n[4 — released and expired]");
  const r7=await pg.evaluate(async()=>{
    const c=__setup();
    __stub.reply='"Bari şuradaki banka kadar gidelim, daha fazla değil."'; await __turn('"Walk?"');
    __stub.reply='"Tamam, biraz daha yürüyelim, göle kadar."';
    __stub.dec=b=>b.questions.limit_L1?{limit_L1:__lim("limit_scene",0.93)}:{}; await __turn('"Please?"');
    __stub.reply='"Tamam."';
    __stub.dec=b=>b.questions.limit_release_K1&&/göle kadar/.test(JSON.stringify(b.state.their_new_lines))?{limit_release_K1:{type:"noul",noul:0.9}}:{};
    await __turn('"Great."');
    const released=activeLimits(c,"p_d").length===0 && (c.spokenLimits.p_d||[]).some(l=>l.released);
    const base={text:"x",kind:"limit",about:"",day:c.gameDay,period:"Midday",place:"Lakeside Trail",placeId:"l_lake",at:1};
    const mid=c.messages[c.messages.length-1].mid;
    c.spokenLimits.p_d=[Object.assign({},base,{id:"a",expires:"scene",saidMid:mid}),Object.assign({},base,{id:"b",expires:"day",saidMid:mid}),
                        Object.assign({},base,{id:"c",expires:"until_changed",saidMid:mid}),Object.assign({},base,{id:"d",expires:"scene",saidMid:"gone_mid"})];
    const ids=()=>activeLimits(c,"p_d").map(l=>l.id).join(",");
    const now=ids();
    c.locationId="l_park"; c.location="City Park"; const travelled=ids();
    c.gameDay=3; const nextDay=ids();
    c.gameDay=12; const muchLater=ids();
    c.gameDay=2; c.locationId="l_lake";
    return {released,now,travelled,nextDay,muchLater};
  });
  ok("she takes it back herself → it is released", r7.released===true);
  ok("a limit whose line was taken back (Retry/delete) no longer holds", r7.now==="a,b,c", r7.now);
  ok("travel ends a scene-scoped limit; a day or standing one survives it", r7.travelled==="b,c", r7.travelled);
  ok("the day's end ends a day-scoped limit; a standing one survives it", r7.nextDay==="c", r7.nextDay);
  ok("even a standing one is not carried past a week", r7.muchLater==="", r7.muchLater);

  console.log("\n[5 — settings and prompts]");
  ok("the switch is on by default, saved and read back", await pg.evaluate(()=>{ localStorage.removeItem(K.limitsOn); loadState(); const d=state.limitsOn===true;
      syncSettingsUI(); const e=document.getElementById('setLimitsOn'); e.checked=false; saveSettings(); const off=localStorage.getItem(K.limitsOn)==="0";
      loadState(); const back=state.limitsOn===false; localStorage.setItem(K.limitsOn,"1"); loadState(); return (d&&off&&back)?true:JSON.stringify({d,off,back}); }));
  ok("both questions are editable on the Strict gates card", await pg.evaluate(()=>{ const card=X_PROMPT_CARDS.find(c=>c.key==="strict_gates");
      return (card&&card.keys.indexOf("x_limit_read")>=0&&card.keys.indexOf("x_limit_release")>=0&&card.keys.indexOf("x_gate_limit")<0&&!!up("x_limit_read")&&!!up("x_limit_release"))?true:JSON.stringify(card&&card.keys); }));

  ok("no page errors", errs.length===0?true:errs.join(" | "));
  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close();
  process.exit(fail?1:0);
})().catch(e=>{ console.error(e); process.exit(1); });
