/* v150.64 — CONSCIENCE THAT COSTS SOMETHING. From a live export: an intimate scene with a married character (Özlem, with the
   player Emre) where the ego pick said the want had won (0.90) and its compass line reached the payload, yet conscience never
   showed; "talk you into it" said "a significant ask is not answered with yes" beside "your want has won"; the reply check
   could not see her marriage; and six of her seven lines ended on the same teasing dare. Checked here:
     - the compass's id_winning / id_ahead lines name a concrete cost, with their own wording for someone married or partnered
       (has_partner / answers_to_spouse, code facts from their own ties);
     - "talk you into it" applies only when the want has not won (not ego = id_winning), and asks about something not already
       agreed to in this scene; "crossed" names being unfaithful;
     - the ego question's state carries real stakes: how they stand with a spouse or partner (the tie, how they feel now, a
       live loyalty) and the day's plans that put them at risk (people due at their own house tonight); its prompt says a
       spouse on record is a real weight even when absent — and a stored copy of the old default is refreshed;
     - the reply check sees the tie to the one answered, the people they answer to, their likes and their speech & behaviour
       for the feeling they were picked as having, and its repeat question counts the same closing move reply after reply;
     - a relationship never keeps a dated item ("invited to dinner tomorrow evening"): the writers are told, and a dated
       sentence is dropped when the generator or the daily read writes one;
     - a saved fragment list is upgraded once: unedited fragments replaced, an edited one left alone.
   Run: node tests/ego-stakes.browser.js   (needs playwright; see tests/README.md) */
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:process.env.SM_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage({viewport:{width:412,height:915}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file://'+require('path').resolve(__dirname,'..','index.html')); await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  // v150.87 — this file checks the one-request bundle (Settings → Decisions → One request per topic OFF); the split is tests/decision-split.browser.js
  await pg.evaluate(()=>{ state.decSplit=false; try{ store.set(K.decSplit,false); }catch(_){} const e=document.getElementById("setDecSplit"); if(e)e.checked=false; });
  await pg.waitForTimeout(800);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x===undefined?c:x).slice(0,900));} };

  await pg.evaluate(()=>{
    window.__setup=()=>{
      const uni=state.universes[0];
      uni.locations=[{id:"l_oz",name:"Small Özüçak's House",type:"home",residents:["p_o","p_h"],sublocations:[{id:"o1",name:"Kitchen"}]},
                     {id:"l_em",name:"Emre's House",type:"home",residents:[],sublocations:[{id:"e1",name:"Master Bedroom"}]}];
      state.personas=[
        {id:"p_o",name:"Özlem",universeId:uni.id,personality:"Cheerful and social.",likes:"Likes: crowded tables, teasing\nPet peeves: being told what to do in her own house",
         speech:{spoken:{main:"Bright, quick, teasing.",emo:{Desire:"Low voice, short breaths; she stops joking."}},text:{main:"",emo:{}},heat:{main:"",emo:{}}},_speechMigrated:"v150.61",
         relationships:{p_h:{tie:"husband",relationship:"Berker is your husband, the steady harbour you chose; you keep private matters to yourself."},
                        __user__:{tie:"husband's childhood friend",relationship:"Emre is Berker's childhood friend."},
                        p_s:{tie:"brother-in-law",relationship:"Sami is Berker's brother."}}},
        {id:"p_h",name:"Berker",universeId:uni.id,personality:"Steady.",relationships:{p_o:{tie:"wife",relationship:"Özlem is your wife."}}},
        {id:"p_s",name:"Sami",universeId:uni.id,personality:"Chaotic."}];
      state.user="Emre"; state.fragments=null; state.relOn=true; state.intentOn=true; state.memory=[];
      store.setRaw(K.fragAdds,FRAG_SHIPPED_ADDS.map(a=>a.key).join(","));
      const c=curChat();
      Object.assign(c,{universeId:uni.id,presentIds:["p_o"],emo:{},calendar:[],intents:[],rel:{},gameDay:4,period:"Afternoon",
        locationId:"l_em",location:"Emre's House",subId:"e1",subPos:{p_o:"e1"},promises:[],
        messages:[{mid:"u1",role:"user",content:'"Stay."'},{mid:"a1",role:"assistant",speaker:"Özlem",speakerId:"p_o",content:'"Hadi bakalım... di mi?"'},
                  {mid:"u2",role:"user",content:'"Aceleye gerek yok."'}]});
      return c; };
  });

  console.log("\n[the compass: a concrete cost, and its own wording when they are not free]");
  const CP=await pg.evaluate(()=>{ const f=fl=>{ const F=ptCondFlags(Object.assign({render_mode:"solo"},fl)); return ptResolveConds(fragCompile("solo",F,{}),F); };
    return {win:f({ego:"id_winning"}),winP:f({ego:"id_winning",has_partner:true}),ahead:f({ego:"id_ahead"}),aheadP:f({ego:"id_ahead",has_partner:true})}; });
  ok("id_winning: the want has won, and it still shows in one small thing — and you go on anyway",
    /Right now your want has won over your conscience\. It still shows in one small thing — a pause, a look at the door, the clock — and you go on anyway\./.test(CP.win)&&!/You know what it costs and you go anyway/.test(CP.win), (CP.win.match(/Right now your want[^\n]*/)||[""])[0]);
  ok("id_winning, partnered: not free — a name almost said, the clock, a ring",
    /Right now your want has won over your conscience\. You are not free, and you know it: it still shows in one small thing — a name almost said, the clock, a ring — and you go on anyway\./.test(CP.winP), (CP.winP.match(/Right now your want[^\n]*/)||[""])[0]);
  ok("id_ahead: the reasons get easier, and the cost shows before the next step; partnered: a name you do not say, a ring",
    /Right now your want is ahead of your conscience\. You are finding reasons, and the reasons are getting easier\. The cost shows in one small thing/.test(CP.ahead)
    &&/You are not free, and it shows in one small thing — a name you do not say, a glance at the clock, a ring turned on a finger — before you take the next step\./.test(CP.aheadP), (CP.aheadP.match(/Right now your want[^\n]*/)||[""])[0]);
  ok("never a lecture: no moral word in the four lines", !/wrong|sin|shame on|should not|betray|guilt/i.test([CP.win,CP.winP,CP.ahead,CP.aheadP].map(t=>(t.match(/Right now your want[^\n]*/)||[""])[0]).join(" ")));
  const FACT=await pg.evaluate(()=>{ const c=__setup(), o=state.personas[0];
    const toEmre=fragCodeFacts(c,o,"__user__"), toBerker=fragCodeFacts(c,o,"p_h");
    o.relationships.p_h.tie="boyfriend"; const bf=fragCodeFacts(c,o,"__user__");
    const s=state.personas[2]; const single=fragCodeFacts(c,s,"__user__");
    return {toEmre:[toEmre.has_partner,toEmre.answers_to_spouse],toBerker:[toBerker.has_partner,toBerker.answers_to_spouse],bf:[bf.has_partner,bf.answers_to_spouse],single:[single.has_partner,single.answers_to_spouse]}; });
  ok("has_partner / answers_to_spouse from their own ties: married → both; answering the husband himself → neither; a boyfriend → partner only; nobody → neither",
    JSON.stringify(FACT)===JSON.stringify({toEmre:[true,true],toBerker:[false,false],bf:[true,false],single:[false,false]}), JSON.stringify(FACT));
  ok("in a real reply: the married character's compass line is the partnered one", await pg.evaluate(()=>{
      const c=__setup(), p=state.personas[0]; c.emo={p_o:{emotion:"Desire",intensity:"intense",tone:"",ego:"id_winning",asks:{},sig:"x"}};
      const B=Object.assign({},buildCharPromptBlocks(p,[],{recent:[],diary:[],longterm:[]},null,{chat:c,targetName:"Emre",targetId:"__user__",payloadKind:"solo"}),
        buildTailBlocks({chat:c,selfP:p,selfId:p.id,selfName:p.name,targetName:"Emre",targetId:"__user__",injected:{recent:[],diary:[],longterm:[]},payloadKind:"solo"}));
      const t=(ptBuildMessages("solo",B,[{role:"user",content:"(history)"}],{chat:c,npc:p,targetName:"Emre"})||[]).map(m=>m.content).join("\n");
      return /You are not free, and you know it: it still shows in one small thing/.test(t)?true:(t.match(/Right now your want[^\n]*/)||["(no compass line)"])[0]; }));

  console.log("\n[talk you into it: only when it can apply]");
  const TI=await pg.evaluate(()=>{ const f=FRAG_DEFAULTS.find(x=>x.id==="talk_into"), s=FRAG_DEFAULTS.find(x=>x.id==="say_no");
    const asks=["ask","ask_multi","ask_gm"].map(id=>f.options.find(o=>o.id===id));
    const a={"q_talk_into__ask":0.95,"q_talk_into__ask_multi":0.95,"q_talk_into__ask_gm":0.95};
    const won=fragCompile("solo",ptCondFlags({render_mode:"solo",ego:"id_winning"}),a), ahead=fragCompile("solo",ptCondFlags({render_mode:"solo",ego:"id_ahead"}),a),
      none=fragCompile("solo",ptCondFlags({render_mode:"solo"}),a), gmWon=fragCompile("gm",ptCondFlags({render_mode:"gm",ego:"id_winning"}),a);
    return {codes:asks.map(o=>o.code),asks:asks.map(o=>o.ask),crossed:s.options.find(o=>o.id==="crossed").ask,
      won:/being asked is not a reason/.test(won),ahead:/being asked is not a reason/.test(ahead),none:/being asked is not a reason/.test(none),gmWon:/being asked is not a reason/.test(gmWon)}; });
  ok("its three ask options carry the code condition `not ego = id_winning`", TI.codes.every(c=>c==="not ego = id_winning"), JSON.stringify(TI.codes));
  ok("the ask: something significant they have not already agreed to in this scene", TI.asks.every(a=>/something significant they have not already agreed to in this scene/.test(a)), TI.asks[0]);
  ok("asked yes with the want winning: not injected (solo, gamemaster); with the want ahead or no pick yet: injected", !TI.won&&!TI.gmWon&&TI.ahead&&TI.none, JSON.stringify(TI));
  ok("\"crossed\": going along with something that crosses a line for them (e.g. being unfaithful)", /is going along with something that crosses a line for them \(e\.g\. being unfaithful\), and will feel it afterwards\./.test(TI.crossed), TI.crossed);

  console.log("\n[the ego question's stakes]");
  const ST=await pg.evaluate(()=>{ const c=__setup(), p=state.personas[0];
    c.intents=[{id:"i1",holderId:"p_o",targetId:"p_h",targetName:"Berker",valence:"warm",kind:"loyalty",aim:"to stand beside him through Sami's mess",status:"brewing",strength:0.6}];
    const o=relObj(c,"p_o","p_h"); o.desc="You love him, and lately you have been keeping things from him."; o.affection=40; o.trust=30; o.familiarity=70; c.rel[relDirKey("p_o","p_h")]=o;
    c.calendar=[{id:"c1",kind:"meeting",title:"Dinner at home",who:"Özlem, Berker, Emre",charIds:["p_o","p_h"],withUser:true,day:4,period:"Evening",locationId:"l_oz",where:"Small Özüçak's House",done:false},
                {id:"c2",kind:"meeting",title:"The market",who:"Özlem",charIds:["p_o"],day:9,period:"Morning",done:false},
                {id:"c3",kind:"meeting",title:"Breakfast with Sami",who:"Özlem, Sami",charIds:["p_o"],day:5,period:"Morning",done:false}];
    return _emoStakeState(c,p,"__user__","solo"); });
  const at=(ST.people_they_answer_to||[]).join("\n"), pr=(ST.plans_that_put_them_at_risk||[]).join("\n");
  ok("the people they answer to: the husband first, with the tie, how they stand, how she feels now and a live loyalty — not a bare name",
    /^Berker — husband \| Berker is your husband, the steady harbour you chose[^|]*\| How Özlem feels about them now: You love him, and lately you have been keeping things from him\. \| Özlem's warm loyalty toward them: to stand beside him through Sami's mess/.test(at)&&/Sami — brother-in-law/.test(at), at);
  ok("the plans that put them at risk: tonight's dinner at her own house (people due there), tomorrow morning's breakfast; not a plan days away",
    /Dinner at home — today, Evening — with Berker, Emre — at Small Özüçak's House \(people are due at Özlem's own home\)/.test(pr)&&/Breakfast with Sami — tomorrow, Morning/.test(pr)&&!/The market/.test(pr), pr);
  ok("a text reply gets the same stakes", await pg.evaluate(()=>{ const c=__setup(), p=state.personas[0];
      c.calendar=[{id:"c1",kind:"meeting",title:"Dinner at home",who:"Özlem, Berker",charIds:["p_o","p_h"],day:4,period:"Evening",locationId:"l_oz",done:false}];
      const st=_emoStakeState(c,p,"__user__","text"); return (/Berker — husband/.test((st.people_they_answer_to||[]).join())&&/Dinner at home/.test((st.plans_that_put_them_at_risk||[]).join()))?true:JSON.stringify(st); }));
  const EG=await pg.evaluate(()=>{ const d=X_ENGINE_PROMPTS.x_ego_pick.def; return {d,state:up("x_ego_pick")}; });
  ok("the ego prompt: still no leaning on conscience by default, and a spouse or partner on record is a real weight even when not here",
    /Do not lean on conscience by default\./.test(EG.d)&&/a spouse or partner on record is a real weight even when they are not here/.test(EG.d)&&/the plans that put \{\{char\}\} at risk today/.test(EG.d)&&EG.state===EG.d, EG.d);
  ok("the request sends the stakes to the ego question", await pg.evaluate(async()=>{ const c=__setup(), p=state.personas[0];
      c.calendar=[{id:"c1",kind:"meeting",title:"Dinner at home",who:"Özlem, Berker",charIds:["p_o","p_h"],day:4,period:"Evening",locationId:"l_oz",done:false}];
      state.key="sk-test"; state.emoOn=true; window.__b=null; const rf=window.fetch;
      window.fetch=async(u,o)=>{ if(String(u).indexOf("/api/alpha/decisions")>-1){ window.__b=JSON.parse(o.body); return new Response(JSON.stringify({answers:{emotion:{choice:"desire"},intensity:{choice:"intense"},ego:{choice:"id_winning"}}}),{status:200}); } return rf(u,o); };
      try{ await emotionEnsure(c,p,"Aceleye gerek yok.",{targetId:"__user__",targetName:"Emre",kind:"solo"}); } finally{ window.fetch=rf; }
      const st=window.__b&&window.__b.state; return (st&&/steady harbour/.test(JSON.stringify(st.people_they_answer_to))&&/Dinner at home/.test(JSON.stringify(st.plans_that_put_them_at_risk))&&/real weight/.test(window.__b.questions.ego.instructions))?true:JSON.stringify(st||{}).slice(0,500); }));
  ok("a stored copy of the old ego prompt is refreshed; one the user rewrote is kept", await pg.evaluate(()=>{
      const OLD="In this moment with {{target}}, which is winning in {{char}}: what {{char}} wants (the id), or what {{char}} owes and who they want to be (the superego)? Weigh it from the state. Do not lean on conscience by default.";
      store.setRaw(K.x_ego_pick||"sm_x_ego_pick",OLD); state.x_ego_pick=OLD; localStorage.removeItem("sm_pipesdone"); loadState(); const a=up("x_ego_pick")===X_ENGINE_PROMPTS.x_ego_pick.def;
      const MINE="My own ego question about {{char}}."; state.x_ego_pick=MINE; store.setRaw(K.x_ego_pick||"sm_x_ego_pick",MINE); localStorage.removeItem("sm_pipesdone"); loadState(); const b2=up("x_ego_pick")===MINE;
      state.x_ego_pick=undefined; store.setRaw(K.x_ego_pick||"sm_x_ego_pick",""); localStorage.removeItem("sm_pipesdone"); loadState();
      return (a&&b2)?true:JSON.stringify({a,b2,now:String(up("x_ego_pick")).slice(0,80)}); }));

  console.log("\n[the reply check sees who she is to them]");
  const RC=await pg.evaluate(()=>{ const c=__setup(), p=state.personas[0];
    c.emo={p_o:{emotion:"Desire",intensity:"intense",tone:"",ego:"id_winning",asks:{},sig:"s"}};
    const msg={mid:"a2",role:"assistant",speaker:"Özlem",speakerId:"p_o",content:'"Ne kadar dayanabileceksin bakalım, di mi?"',toId:"__user__"}; c.messages.push(msg);
    return {st:_replyCheckState(c,msg,p),rep:X_ENGINE_PROMPTS.x_reply_check_repeat.def}; });
  ok("its state: her tie to the one she answered, the people she answers to, her likes, and her speech & behaviour for what she feels now",
    /^Emre — husband's childhood friend: Emre is Berker's childhood friend\./.test(RC.st.tie_to_the_one_answered||"")&&/^Berker — husband \| Berker is your husband/.test((RC.st.people_they_answer_to||[])[0]||"")
    &&/crowded tables/.test(RC.st.likes||"")&&/^Desire \(intense\): Low voice, short breaths; she stops joking\./.test(RC.st.speech_and_behaviour_for_their_feeling_now||""), JSON.stringify(RC.st).slice(0,900));
  ok("the repeat question counts the same closing move reply after reply (a dare, a tag question)", /ends with the same closing move as their earlier replies — the same dare or challenge, the same tag question/.test(RC.rep), RC.rep);
  ok("a stored copy of the old repeat question is refreshed", await pg.evaluate(()=>{
      const OLD="Does the reply repeat what {{char}} already said, did or thought earlier in this scene (their earlier lines are in the state)?\nYES: It makes the same point.\nNO: It moves on.";
      state.x_reply_check_repeat=OLD; store.setRaw(K.x_reply_check_repeat||"sm_x_reply_check_repeat",OLD); localStorage.removeItem("sm_pipesdone"); loadState(); const a=up("x_reply_check_repeat")===X_ENGINE_PROMPTS.x_reply_check_repeat.def;
      state.x_reply_check_repeat=undefined; store.setRaw(K.x_reply_check_repeat||"sm_x_reply_check_repeat",""); localStorage.removeItem("sm_pipesdone"); loadState(); return a?true:String(up("x_reply_check_repeat")).slice(0,120); }));

  console.log("\n[a relationship is not a calendar]");
  const DT=await pg.evaluate(async()=>{
    const r={};
    r.en=_relDropDated("Emre is Berker's childhood friend. He is invited to dinner at your house tomorrow evening, and you want tomorrow to come. You like him more than you planned to.");
    r.tr=_relDropDated("Emre, Berker'in çocukluk arkadaşı. Yarın akşam size yemeğe gelecek. Onu sevdiğinden fazla seviyorsun.");
    r.only=_relDropDated("Dinner tomorrow evening.");
    r.none=_relDropDated("You trust him with what you do not tell other people.");
    r.relgen=/NOTHING DATED: a plan, an invitation/.test(DEFAULT_RELGEN)&&/NOTHING DATED\. It is how they feel/.test(DEFAULT_REL);
    // the generator writes no dated sentence into a tie
    const c=__setup(), p=state.personas[0]; const rc=window.chatCompletion;
    state.key="sk-test"; window.chatCompletion=async()=>JSON.stringify({"player":{tie:"husband's childhood friend",relationship:"Emre is Berker's oldest friend and you feel seen by him. He is invited to dinner at your house tomorrow evening."},
      "Berker":{tie:"husband",relationship:"Berker is your husband."}});
    try{ await generateRelationshipsFor(p,state.universes[0],"",{background:true}); } finally{ window.chatCompletion=rc; }
    r.gen=(p.relationships.__user__||{}).relationship;
    // the daily read writes no dated sentence into how they feel
    await evalRelationship(c,p,"__user__","Emre",[],[],4,{answer:{trust:1,affection:1,respect:0,familiarity:1,jealousy:0,desire:0,comfort:0,fear:0,agitation:0,description:"You want him close. Tonight you will see him at your table."}});
    r.daily=relObj(c,"p_o","__user__").desc;
    return r; });
  ok("a dated sentence is dropped (English, Turkish); the rest of the tie stays; a text that is only dated is kept; an undated one is untouched",
    DT.en==="Emre is Berker's childhood friend. You like him more than you planned to."&&DT.tr==="Emre, Berker'in çocukluk arkadaşı. Onu sevdiğinden fazla seviyorsun."&&DT.only==="Dinner tomorrow evening."&&DT.none==="You trust him with what you do not tell other people.", JSON.stringify(DT));
  ok("the relationship writers are told: nothing dated (plans belong on the calendar)", DT.relgen===true);
  ok("written by the generator: the tie keeps who he is and loses the invitation", DT.gen==="Emre is Berker's oldest friend and you feel seen by him.", DT.gen);
  ok("written by the daily read: how she feels, without tonight", DT.daily==="You want him close.", DT.daily);

  console.log("\n[a saved fragment list]");
  ok("v150.64.decide: an unedited compass, talk-you-into-it, say-no, motive and who-you-are become the new defaults; an edited one is the user's", await pg.evaluate(()=>{
      const L=FRAG_DEFAULTS.filter(f=>f.id!=="feelings"&&f.id!=="feelings_now").map(f=>JSON.parse(JSON.stringify(FRAG_DEFAULTS_V150_63_OLD[f.id]||f)));
      const s=L.find(f=>f.id==="say_no"); s.options[0].text="MY OWN SAY NO";
      state.fragments=L; _fragMigratedFor=null; store.setRaw(K.fragAdds,FRAG_SHIPPED_ADDS.map(a=>a.key).filter(k=>!/^v150\.64|^feelings/.test(k)).join(","));
      const M=fragList(), g=id=>M.find(f=>f.id===id), d=id=>FRAG_DEFAULTS.find(f=>f.id===id);
      const same=id=>_fragCanon(g(id))===_fragCanon(d(id));
      const r={compass:same("compass"),talk:same("talk_into"),bio:same("bio"),motive:same("motive"),sayNoKept:g("say_no").options[0].text==="MY OWN SAY NO",
        feel:M.findIndex(f=>f.id==="feelings")===M.findIndex(f=>f.id==="ties")+1,now:M.findIndex(f=>f.id==="feelings_now")===M.findIndex(f=>f.id==="compass")-1};
      state.fragments=null; _fragMigratedFor=null; store.setRaw(K.fragments,""); store.setRaw(K.fragAdds,FRAG_SHIPPED_ADDS.map(a=>a.key).join(","));
      return Object.values(r).every(v=>v===true)?true:JSON.stringify(r); }));

  ok("no page errors", errs.length===0?true:errs.join(" | "));
  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close(); process.exit(fail?1:0);
})().catch(e=>{ console.error(e); process.exit(1); });
