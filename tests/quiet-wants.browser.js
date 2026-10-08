/* v150.64 — A PRIVATE MOTIVE IS SOMETHING A CHARACTER DOES, NOT SOMETHING THEY ARE TOLD EVERY TURN. "What you quietly want"
   (the live private motives, on the identity sheet of every reply) made characters steer every line toward it. It left the
   reply; the motive now drives the background systems that turn it into something concrete, and that reaches the reply
   only through the plans / threads / brief fragments, when it is due. Checked here:
     - no reply carries a quiet want (fragments or the classic layout, every path), and the live goals ("YOUR GOALS") stay;
     - the decision-gated "Your private motive" toward the one being answered stays;
     - the world pulse (runGoalPursuit) asks a character who carries a live motive and has no written goals, with the motive
       in its prompt, and the plan it commits to lands on the calendar — and reaches that character's reply as a plan, today;
     - the quest designer (runCharQuestSpawn) asks a character with a live motive and no goals, with the motive in its prompt,
       and the pursuit is filed;
     - a motive that matured (armed) surfaces as a scene of its own (an overture), which reaches the reply as why they are
       here; while it waits, the Gamemaster is told what moment it needs, never the motive itself.
   Run: node tests/quiet-wants.browser.js   (needs playwright; see tests/README.md) */
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:process.env.SM_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage({viewport:{width:412,height:915}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file://'+require('path').resolve(__dirname,'..','index.html')); await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(800);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x===undefined?c:x).slice(0,900));} };

  await pg.evaluate(()=>{
    window.__setup=()=>{
      const uni=state.universes[0];
      uni.locations=[{id:"l_home",name:"Ayla's Flat",type:"home",residents:["p_a"],sublocations:[{id:"s1",name:"Kitchen"}]},
                     {id:"l_bar",name:"Harbour Bar",type:"bar",residents:[],sublocations:[{id:"b1",name:"Entrance"}]}];
      state.personas=[
        {id:"p_a",name:"Ayla",universeId:uni.id,personality:"Sharp.",goals:"Open her own shop.",goalsLive:{lines:["Open the shop before winter"],day:1},
         relationships:{__user__:{tie:"neighbour",relationship:"Emre lives across the hall."},p_b:{tie:"older brother",relationship:"Berk raised her."}}},
        {id:"p_b",name:"Berk",universeId:uni.id,personality:"Loud, restless.",relationships:{p_a:{tie:"younger sister",relationship:"Ayla is your sister."}}}];
      state.user="Emre"; state.key="sk-test"; state.fragments=null; state.intentOn=true; state.mem=true; state.memory=[]; state.relOn=false;
      state.arrivalGateOn=false;   // v150.78 — surfacing itself is tested here; the arrival gate has its own test (arrival-gate)
      state.pulseOn=true; state.goalPursuitOn=true; state.charQuestsOn=true; state.gateOn=false; state.sceneOn=true; state.confrontOn=true;
      store.setRaw(K.fragAdds,FRAG_SHIPPED_ADDS.map(a=>a.key).join(","));
      uni.gameData=uni.gameData||{}; uni.gameData.charQuests=[]; uni.cqAsked={};
      const c=curChat(); ["activeEvent","goalAsked","goalActed"].forEach(k=>{ delete c[k]; });
      Object.assign(c,{universeId:uni.id,presentIds:["p_a"],emo:{},calendar:[],intents:[],rel:{},gameDay:3,period:"Morning",locationId:"l_home",location:"Ayla's Flat",subId:"s1",subPos:{p_a:"s1"},
        worldPositions:{p_a:"l_home",p_b:"l_bar"},messages:[{mid:"u1",role:"user",content:'"Morning."'},{mid:"a1",role:"assistant",speaker:"Ayla",speakerId:"p_a",content:'"Hi."'},{mid:"u2",role:"user",content:'"Coffee?"'}]});
      c.intents=[{id:"i_a",holderId:"p_a",holderName:"Ayla",targetId:"__user__",targetName:"Emre",valence:"warm",kind:"crush",aim:"to be asked out by Emre",status:"brewing",strength:0.6,born:1},
                 {id:"i_b",holderId:"p_b",holderName:"Berk",targetId:"p_a",targetName:"Ayla",valence:"warm",kind:"protection",aim:"to talk Ayla out of the loan before she signs",status:"brewing",strength:0.7,born:1}];
      return c; };
    window.__payload=(c,p,tId,tName,kind,cl,addressed)=>{ kind=kind||"solo";   // v150.66 — the reply is its fragments (cl, the classic layout, is gone)
      { const B=Object.assign({},buildCharPromptBlocks(p,[],{recent:[],diary:[],longterm:[]},addressed||null,{chat:c,targetName:tName,targetId:tId,payloadKind:kind,textMode:kind==="text"}),
          buildTailBlocks({chat:c,selfP:p,selfId:p.id,selfName:p.name,targetName:tName,targetId:tId,injected:{recent:[],diary:[],longterm:[]},payloadKind:kind,textMode:kind==="text"}));
        return ptBuildMessages(kind,B,[{role:"user",content:"(history)"}],{chat:c,npc:p,targetName:tName}).map(m=>m.content).join("\n"); } };
  });

  console.log("\n[no quiet want in the reply]");
  // v150.79 — a live goal rides in a reply when the scene touches it: here the shop comes up in the last lines (and in the text thread)
  const Q=await pg.evaluate(()=>{ const c=__setup(), p=state.personas[0]; const r={}; c.messages.push({mid:"a2",role:"assistant",speaker:"Ayla",speakerId:"p_a",content:'"The shop can wait."'},
      {mid:"t1",role:"user",content:"How is the shop?",textMsg:true,textWith:"p_a",present:[]});
    ["solo","multi","gm","text","heat"].forEach(k=>{ if(k==="heat")c._heatBeat={n:1,total:3}; const t=__payload(c,p,"p_b","Berk",k); delete c._heatBeat;
      r[k]=!/what_you_quietly_want|Privately, you are working toward|asked out by Emre/.test(t)&&/Open the shop before winter/.test(t); });
    return r; });
  ok("no path carries the quiet want, and the live goals stay (answering Berk, a motive toward Emre)", ["solo","multi","gm","text","heat"].every(k=>Q[k]===true), JSON.stringify(Q));
  ok("the decision-gated motive toward the one answered stays: asked yes, it is injected", await pg.evaluate(()=>{ const c=__setup(), p=state.personas[0];
      c.emo={p_a:{emotion:"Joy",intensity:"mild",tone:"",ego:"no_conflict",asks:{q_motive__bears:0.95},sig:"x"}};
      const t=__payload(c,p,"__user__","Emre"); return /# WHAT YOU ARE QUIETLY AFTER WITH Emre[\s\S]*to be asked out by Emre/.test(t)&&!/what_you_quietly_want/.test(t)?true:(t.match(/QUIETLY[\s\S]{0,200}/)||["(none)"])[0]; }));

  console.log("\n[the world pulse turns a motive into a plan]");
  const GP=await pg.evaluate(async()=>{ const c=__setup(), uni=state.universes[0]; const rc=window.chatCompletion; const seen=[];
    window.chatCompletion=async(msgs,model,opts)=>{ const t=JSON.stringify(msgs); seen.push({dbg:opts&&opts.dbg,t});
      if(/goal pursuit/i.test(String(opts&&opts.dbg)))return JSON.stringify({acted:true,plan:{title:"Ayla'yı krediden vazgeçir",detail:"To make her see the loan will sink her, before she signs it on Friday.",with:"",where:"Ayla's Flat",day:3,period:"Evening"}});
      return "{}"; };
    let n=0; try{ n=await runGoalPursuit(c,3,uni,"Morning"); } finally{ window.chatCompletion=rc; }
    const call=seen.find(x=>/Berk/.test(String(x.dbg)));
    const e=(c.calendar||[]).find(x=>x&&/krediden/.test(x.title||""));
    // later that day, Berk is with the player and answers him: the plan is in his arrangements, today
    c.period="Afternoon"; c.presentIds=["p_a","p_b"]; c.worldPositions={p_a:"l_home",p_b:"l_home"};
    const t=e?__payload(c,state.personas[1],"__user__","Emre"):"";
    return {n,asked:!!call,motive:!!call&&/to talk Ayla out of the loan before she signs/.test(call.t),goalsNone:!!call&&/\(nothing stated\)/.test(call.t),
      entry:e?{who:e.who,executor:e.executor,day:e.day,period:e.period,goalPlan:e.goalPlan}:null,
      reply:/# YOUR FUTURE ARRANGEMENTS[\s\S]*Ayla'yı krediden vazgeçir/.test(t),noWant:!/to talk Ayla out of the loan before she signs[^"]/.test(t.replace(/YOUR FUTURE ARRANGEMENTS[\s\S]*/,""))}; });
  ok("Berk has no written goals but a live motive: the pulse asks him, with the motive in the prompt", GP.asked&&GP.motive&&GP.goalsNone, JSON.stringify(GP));
  ok("the plan he commits to lands on the calendar, his own", GP.n===1&&GP.entry&&GP.entry.who==="Berk"&&GP.entry.executor==="Berk"&&GP.entry.day===3&&GP.entry.period==="Evening"&&GP.entry.goalPlan===true, JSON.stringify(GP));
  ok("…and reaches his reply as a plan (YOUR FUTURE ARRANGEMENTS), not as a quiet want", GP.reply&&GP.noWant, JSON.stringify(GP));

  console.log("\n[the quest designer turns a motive into a pursuit]");
  const CQ=await pg.evaluate(async()=>{ const c=__setup(), uni=state.universes[0]; const rc=window.chatCompletion; let prompt="";
    state.memory=[{id:"m1",ownerId:"p_b",universeId:uni.id,gameDay:3,gamePeriod:"Morning",content:"I heard Ayla is about to sign a loan.",text:"I heard Ayla is about to sign a loan.",importance:0.7}];
    window.chatCompletion=async(msgs,model,opts)=>{ if(/Char quest \(spawn\) · Berk/.test(String(opts&&opts.dbg))){ prompt=JSON.stringify(msgs);
        return JSON.stringify({quest:{title:"Stop the loan",desc:"Make Ayla see the loan will sink her.",motive:"He raised her; he will not watch her drown.",target:"Ayla",done_when:"Ayla says she will not sign."}}); }
      return JSON.stringify({quest:false}); };
    let n=0; try{ n=await runCharQuestSpawn(c,3,uni,{period:"Morning"}); } finally{ window.chatCompletion=rc; }
    const q=_charQuests(uni).find(x=>x&&x.holderId==="p_b");
    return {n,asked:!!prompt,motive:/to talk Ayla out of the loan before she signs/.test(prompt),quest:q?{title:q.title,target:q.targetName,status:q.status}:null}; });
  ok("Berk, with a live motive and no goals, is asked by the quest designer, the motive in its prompt", CQ.asked&&CQ.motive, JSON.stringify(CQ));
  ok("the pursuit is filed: his, toward Ayla, active", CQ.n===1&&CQ.quest&&CQ.quest.title==="Stop the loan"&&CQ.quest.target==="Ayla"&&CQ.quest.status==="active", JSON.stringify(CQ));

  console.log("\n[a matured motive surfaces as a scene of its own]");
  const AR=await pg.evaluate(async()=>{ const c=__setup(); const rc=window.chatCompletion; window.chatCompletion=async()=>"{}";
    const it=c.intents[0]; it.status="armed"; _armIntent(it,3); it.plan.steps[0].gate={type:"target_alone",note:""};
    c.presentIds=["p_a","p_b"];   // not alone with Emre: it waits, and the Gamemaster is told only what moment it needs
    const wait=armedStagingSummary(c);
    c.presentIds=[];   // Emre alone: the gate opens, and she comes to him
    let fired=false; try{ fired=checkArmedPlans(c); await new Promise(r=>setTimeout(r,50)); } finally{ window.chatCompletion=rc; }
    const ev=c.activeEvent;
    c.presentIds=["p_a"]; const t=ev?__payload(c,state.personas[0],"__user__","Emre","solo",false,"arriving"):"";
    return {t:t.slice(0,0)+(t.match(/WHY & HOW[\s\S]{0,600}/)||[""])[0],wait,fired,ev:ev?{kind:ev.kind,who:ev.accuserName,intent:String(ev.intent||"")}:null,spent:it.status,brief:/to be asked out by Emre/.test(t),noSheet:!/what_you_quietly_want/.test(t)}; });
  ok("while it waits, the Gamemaster is told the moment it needs, never the motive", /WAITING MOMENTS/.test(AR.wait)&&/left alone/.test(AR.wait)&&!/asked out/.test(AR.wait), AR.wait);
  ok("when the moment comes, it surfaces as an overture and is spent", AR.fired===true&&AR.ev&&AR.ev.kind==="overture"&&AR.ev.who==="Ayla"&&/to be asked out by Emre/.test(AR.ev.intent)&&AR.spent==="spent", JSON.stringify(AR));
  ok("…and reaches her reply as the scene she is in, not as a want on her sheet", AR.brief&&AR.noSheet, JSON.stringify(AR));

  ok("no page errors", errs.length===0?true:errs.join(" | "));
  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close(); process.exit(fail?1:0);
})().catch(e=>{ console.error(e); process.exit(1); });
