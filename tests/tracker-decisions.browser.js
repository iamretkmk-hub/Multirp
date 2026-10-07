/* v150.31 — TRACKERS IN ONE REQUEST.
   Every tracker due this turn used to be its own chat call re-reading the same six lines. With the
   Decisions API on, the eligible ones are typed questions in ONE request. Checked here, with the
   endpoint and the chat calls stubbed:
     • one request for every tracker (v150.33: a tracker's own prompt is its rule in the question, its own
       chat model is used only on the chat path); a move or an event needs the strictness bar (0.7);
     • the state is the exchange as numbered lines, sent once; a judged tracker is a choice between moves
       sized to its range and behaviour, an event tracker a yes/no from its YES:/NO: prompt;
     • the most likely move is applied (through the tracker's behaviour), an event at 0.5+ triggers the
       on-hit value; each question names the first line not yet judged, and a turn with no new line
       sends nothing;
     • a failed request sends every tracker through its own call, as before; the switch off or no key keep
       everything on the chat path;
     • settings round-trip and default on.
   Run: node tests/tracker-decisions.browser.js */
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
    window.__reqs=[]; window.__mode="ok"; window.__chat=[];
    window.__ans={};   // question key → answer object, by tracker id (filled per case)
    const realFetch=window.fetch;
    window.fetch=async(url,opts)=>{
      const u=String(url);
      if(u.indexOf("/api/alpha/decisions")>-1){
        const body=JSON.parse(opts.body); window.__reqs.push(body);
        if(window.__mode==="500") return new Response(JSON.stringify({error:{message:"upstream"}}),{status:500});
        const answers={};
        Object.keys(body.questions).forEach(k=>{ const q=body.questions[k];
          const id=(q.instructions.match(/Tracker: "([^"]+)"/)||[])[1];
          if(window.__ans[id]) answers[k]=window.__ans[id]; });
        return new Response(JSON.stringify({answers}),{status:200});
      }
      return realFetch(url,opts);
    };
    window.chatCompletion=async(msgs,model,opts)=>{ const d=(opts&&opts.dbg)||""; window.__chat.push({d,model});
      if(/^Tracker · /.test(d)) return JSON.stringify({delta:1,triggered:false}); return "{}"; };
    const uni=state.universes[0];
    state.personas=state.personas.filter(p=>p.id!=="p_b");
    state.personas.push({id:"p_b",name:"Burcu",universeId:uni.id,instructions:"x",personality:"x",backstory:"x",style:"x",goals:"x",look:{},gender:"female",age:30});
    const chat=curChat(); chat.presentIds=["p_b"]; chat.universeId=uni.id; state.curUniverse=uni.id;
    state.user="Emre"; state.key="sk-test"; state.trackOn=true; state.trackDecOn=true; state.trackDecModel=""; state.memJudgeOn=false; state.replyCheckOn=false;
    window.__T=[
      {id:"tLove",name:"Love",owner:"__story__",min:0,max:100,method:"llm",behavior:"free"},
      {id:"tTrust",name:"Trust",owner:"p_b",min:0,max:100,method:"llm",behavior:"up"},
      {id:"tKiss",name:"Kissed",owner:"__story__",min:0,max:10,method:"trigger_then_day",behavior:"up",onHitSet:5,triggerPhrase:"they kiss"},
      {id:"tOwn",name:"Plug",owner:"__story__",min:0,max:1,method:"llm",behavior:"free",model:"some/model",prompt:"Raise it by 1 only when the plug is put in; lower it by 1 when it is taken out."}
    ];
    window.curTrackers=()=>window.__T;
    const L=(who,t)=>({mid:newMid(),role:who==="Emre"?"user":"assistant",speaker:who==="Emre"?undefined:who,speakerId:who==="Emre"?undefined:"p_b",content:t,present:["p_b"]});
    window.__L=L;
    chat.trackerVals={}; chat.trkRead={};
    chat.messages=[L("Emre","Merhaba."),L("Burcu","Selam."),L("Emre","Seni özledim."),L("Burcu","*Gülümser.* Ben de."),L("Emre","*Onu öper.*"),L("Burcu","*Karşılık verir.*")];
  });

  console.log("\n[one request for the eligible trackers]");
  const r1=await pg.evaluate(async()=>{
    window.__ans={Love:{type:"choice",choice:"rise",probabilities:{rise:0.6,none:0.3,rise_little:0.1}},Trust:{type:"choice",choice:"rise_sharp"},Kissed:{type:"noul",noul:0.82},
      Plug:{type:"choice",choice:"rise_little",probabilities:{rise_little:0.4,none:0.6}}};
    window.__reqs=[]; window.__chat=[];
    const chat=curChat(); await runTrackerEngine(chat);
    const v=id=>trackerVal(chat,window.__T.find(t=>t.id===id),window.__T.find(t=>t.id===id).owner);
    return {reqs:window.__reqs,chat:window.__chat.map(c=>c.d),love:v("tLove"),trust:v("tTrust"),kiss:v("tKiss"),own:v("tOwn")};
  });
  const body=r1.reqs[0]||{questions:{}};
  const qs=Object.values(body.questions||{});
  ok("one Decisions request carrying all four trackers, the own-prompt/own-model one included", r1.reqs.length===1&&qs.length===4, r1.reqs.length+" requests, "+qs.length+" questions");
  ok("no tracker makes its own chat call", r1.chat.filter(d=>/^Tracker · /.test(d)).length===0, JSON.stringify(r1.chat));
  ok("the tracker's own prompt is its rule in the question", qs.some(q=>/"Plug"/.test(q.instructions)&&/Its rule: Raise it by 1 only when the plug is put in/.test(q.instructions)), JSON.stringify(qs.map(q=>q.instructions.slice(0,80))));
  ok("default model openai/gpt-6-luna-decisions", body.model==="openai/gpt-6-luna-decisions", body.model);
  ok("the state is the exchange as numbered lines, once", typeof body.state==="string"&&/^1\. Emre: Merhaba\./.test(body.state)&&/\n6\. Burcu: /.test(body.state), JSON.stringify(body.state));
  const love=qs.find(q=>/"Love"/.test(q.instructions)), trust=qs.find(q=>/"Trust"/.test(q.instructions)), kiss=qs.find(q=>/"Kissed"/.test(q.instructions));
  ok("a free 0..100 tracker chooses between seven moves sized 3/8/20", love&&love.type==="choice"&&JSON.stringify(Object.keys(love.criteria))==='["fall_sharp","fall","fall_little","none","rise_little","rise","rise_sharp"]'&&/^\+8:/.test(love.criteria.rise)&&/^\+20:/.test(love.criteria.rise_sharp), JSON.stringify(love&&love.criteria));
  ok("an up-only tracker cannot fall", trust&&JSON.stringify(Object.keys(trust.criteria))==='["none","rise_little","rise","rise_sharp"]', JSON.stringify(trust&&Object.keys(trust.criteria)));
  ok("an event tracker is a yes/no with its YES/NO meanings", kiss&&kiss.type==="noul"&&/^It clearly happened/.test(kiss.criteria.true)&&/^It did not/.test(kiss.criteria.false)&&/they kiss/.test(kiss.instructions), JSON.stringify(kiss));
  ok("each question names line 1 as the first one to judge, and the tracker's current value", qs.every(q=>/judging only line 1 onward|in line 1 or later/i.test(q.instructions))&&/Current value: 0\./.test(love.instructions), love&&love.instructions);
  ok("sure enough that it moved (0.7): the most likely move is applied, Love +8", r1.love===8, "love="+r1.love);
  ok("Trust rises sharply: +20", r1.trust===20, "trust="+r1.trust);
  ok("the event at 0.82 triggers the on-hit value", r1.kiss===5, "kiss="+r1.kiss);
  ok("only 40% sure it moved: Plug stays put", r1.own===0, "plug="+r1.own);

  console.log("\n[the strictness bar]");
  ok("65% sure a tracker moved is not enough at 0.7; an event at 0.6 does not fire", await pg.evaluate(async()=>{
      const c=curChat(); c.messages.push(__L("Burcu","Belki.")); window.__reqs=[];
      window.__ans={Love:{type:"choice",choice:"rise",probabilities:{rise:0.65,none:0.35}},Trust:{type:"choice",choice:"none"},Kissed:{type:"noul",noul:0.6},Plug:{type:"choice",choice:"none"}};
      const before=trackerVal(c,__T[0],"__story__"); const kBefore=trackerVal(c,__T[2],"__story__"); c.trackerVals[__T[2].id]["__story__"]=0;
      await runTrackerEngine(c);
      const a=trackerVal(c,__T[0],"__story__")===before, b=trackerVal(c,__T[2],"__story__")===0;
      c.trackerVals[__T[2].id]["__story__"]=kBefore;
      return (a&&b) ? true : "love moved="+!a+" event fired="+!b; }));
  ok("at strictness 0.5 the same answers move and fire", await pg.evaluate(async()=>{
      const c=curChat(); c.messages.push(__L("Emre","Evet.")); state.trackDecStrict=0.5;
      const before=trackerVal(c,__T[0],"__story__"); const kBefore=trackerVal(c,__T[2],"__story__"); c.trackerVals[__T[2].id]["__story__"]=0;
      await runTrackerEngine(c); state.trackDecStrict=0.7;
      const a=trackerVal(c,__T[0],"__story__")===before+8, b=trackerVal(c,__T[2],"__story__")===5;
      c.trackerVals[__T[2].id]["__story__"]=kBefore;
      return (a&&b) ? true : "love +8="+a+" event fired="+b; }));

  console.log("\n[lines already judged]");
  ok("a turn with no new line sends nothing", await pg.evaluate(async()=>{ window.__reqs=[]; window.__chat=[];
      await runTrackerEngine(curChat()); return (window.__reqs.length===0&&!window.__chat.length) ? true : window.__reqs.length+" requests, "+window.__chat.length+" calls"; }));
  ok("after one new line, each question starts at it (line 6 of the window)", await pg.evaluate(async()=>{
      const c=curChat(); c.messages.push(__L("Emre","Kahve?")); window.__reqs=[];
      window.__ans={Love:{type:"choice",choice:"none"},Trust:{type:"choice",choice:"none"},Kissed:{type:"noul",noul:0.1},Plug:{type:"choice",choice:"none"}};
      await runTrackerEngine(c);
      const q=Object.values(window.__reqs[0].body?window.__reqs[0].body.questions:window.__reqs[0].questions);
      return q.every(x=>/line 6/.test(x.instructions)&&/before line 6 were judged/.test(x.instructions)) ? true : q[0].instructions; }));
  ok("'none' and a low event move nothing", await pg.evaluate(()=>{ const c=curChat(), v=id=>trackerVal(c,__T.find(t=>t.id===id),__T.find(t=>t.id===id).owner);
      return (v("tLove")===16&&v("tTrust")===20&&v("tKiss")===5) ? true : [v("tLove"),v("tTrust"),v("tKiss")].join(","); }));   // 16: +8 twice (first run, strictness 0.5)

  console.log("\n[sizes by range and behaviour]");
  ok("counter: none/once/twice/three; down-only: none and falls; a 0..10 range moves 1/2/3", await pg.evaluate(()=>{
      const k=t=>_trackDecMoves(t).map(m=>m.k+":"+m.d).join(",");
      const a=k({behavior:"counter",min:0,max:100}), d=k({behavior:"down",min:0,max:100}), f=k({behavior:"free",min:0,max:10});
      return (a==="none:0,once:1,twice:2,three:3"&&d==="none:0,fall_little:-3,fall:-8,fall_sharp:-20"&&f==="fall_sharp:-3,fall:-2,fall_little:-1,none:0,rise_little:1,rise:2,rise_sharp:3") ? true : [a,d,f].join(" | "); }));

  console.log("\n[fallbacks]");
  ok("a failed request sends every tracker through its own call", await pg.evaluate(async()=>{
      const c=curChat(); c.messages.push(__L("Burcu","Olur.")); window.__mode="500"; _trackDecBreak.until=0; _trackDecBreak.fails=0;
      window.__reqs=[]; window.__chat=[]; await runTrackerEngine(c); window.__mode="ok"; _trackDecBreak.fails=0;
      const n=window.__chat.filter(x=>/^Tracker · /.test(x.d)).length;
      return (window.__reqs.length===1&&n===4) ? true : window.__reqs.length+" requests, "+n+" calls"; }));
  ok("an edited chat-path tracker prompt no longer keeps trackers off the request", await pg.evaluate(async()=>{
      const c=curChat(); c.messages.push(__L("Emre","Hadi.")); state.trackPrompt=DEFAULT_TRACK+"\nBe generous.";
      window.__reqs=[]; window.__chat=[]; await runTrackerEngine(c); state.trackPrompt=DEFAULT_TRACK;
      const n=window.__chat.filter(x=>/^Tracker · /.test(x.d)).length;
      return (window.__reqs.length===1&&n===0) ? true : window.__reqs.length+" requests, "+n+" calls"; }));
  ok("own prompt and own model are both eligible; an End-Day-only tracker is not", await pg.evaluate(()=>trackDecEligible(curChat(),{name:"x",method:"llm",prompt:"custom",model:"m"})===true&&trackDecEligible(curChat(),{name:"x",method:"endday"})===false));
  ok("switch off: nothing sent, every tracker its own call", await pg.evaluate(async()=>{
      const c=curChat(); c.messages.push(__L("Burcu","Tamam.")); state.trackDecOn=false;
      window.__reqs=[]; window.__chat=[]; await runTrackerEngine(c); state.trackDecOn=true;
      const n=window.__chat.filter(x=>/^Tracker · /.test(x.d)).length;
      return (window.__reqs.length===0&&n===4) ? true : window.__reqs.length+" requests, "+n+" calls"; }));
  ok("the request is a Debug row with each answer", await pg.evaluate(()=>{
      const e=dbgLog.slice().reverse().find(x=>/^Trackers — \d+ in one request/.test(x.label||"")&&x.status==="ok");
      return (e&&e.result&&e.result.answers) ? true : JSON.stringify(e&&e.result); }));

  console.log("\n[prompts and settings]");
  ok("the two prompts are registry prompts on the Tracker Engine card", await pg.evaluate(()=>{
      const card=ENGINE_PAYLOAD_DEFS.find(d=>d.key==="trackers");
      const keys=["x_tracker_dec_change","x_tracker_dec_trigger"];
      return (keys.every(k=>PROMPT_BY_KEY[k]&&["tracker","name","owner","from"].every(t=>promptPlaceholders(k).includes(t)))&&card&&keys.every(k=>card.blocks.some(b=>b.promptKey===k))) ? true : "missing"; }));
  ok("settings round-trip; a fresh install has it on", await pg.evaluate(()=>{
      state.trackDecOn=false; state.trackDecModel="typesafe/jev-1.13"; state.trackDecStrict=0.8; syncSettingsUI();
      const on=document.getElementById('setTrackDecOn'), mo=document.getElementById('setTrackDecModel'), st=document.getElementById('setTrackDecStrict');
      if(!on||!mo||!st) return "inputs missing";
      if(on.checked||mo.value!=="typesafe/jev-1.13"||+st.value!==0.8) return "sync";
      on.checked=true; mo.value=""; st.value="0.2"; saveSettings(false);
      if(state.trackDecOn!==true||state.trackDecModel!==""||state.trackDecStrict!==0.5||store.raw(K.trackDecOn,"")!=="1"||store.raw(K.trackDecStrict,"")!=="0.5") return "save "+state.trackDecStrict;
      localStorage.removeItem(K.trackDecOn); localStorage.removeItem(K.trackDecStrict); loadState(); return (state.trackDecOn===true&&state.trackDecStrict===0.7) ? true : "fresh install: "+state.trackDecOn+" "+state.trackDecStrict; }));

  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close();
  process.exit(fail?1:0);
})().catch(e=>{ console.error(e); process.exit(1); });
