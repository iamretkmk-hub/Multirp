/* v150.72 — A HEAT SCENE KEEPS THE PERSON. A live export: a married woman (Buket) in bed with the player; heat went off between
   two scene clips with the two of them still together, and "After it is over" ran twice mid-sex, saying "They have gone… you are
   on your own with it" (the player is never in presentCast) and, with no conscience state, concluding "not because the guilt
   would eat you" — which then shipped in every later reply. Her emotion pick was anchored on the last one (Desire intense, id
   winning), and nothing told her that wanting it does not mean reciting the lines the player dictated. Checked here:
     • the player counts as with her while she is in the player's scene (same place, same area): "still in the room";
     • heat going off while they are together reckons nothing (the toggle, a direct call, heat back on past the end of the
       part of the day); it is owed, and runs once when they separate (a move to another area, a character leaving) or the
       part of the day has changed — once, and about the person it was with;
     • the reckoning carries the conscience state (not free, the people they answer to, the plans at risk, the last ego and
       emotion, the open or secret matters), and its prompt the not-free rule;
     • the emotion state no longer anchors with the ego level; the ego question carries the not-free rule;
     • the compass (id_winning, id_ahead) and the heat guidance keep her own words on a fresh install, and a saved list or a
       stored prompt is upgraded only while it is still the v150.71 default.
   Run: node tests/heat-reckoning.browser.js   (needs playwright; see tests/README.md) */
const {chromium}=require('playwright');
const path=require('path');
const BIN=process.env.SM_CHROME||process.env.CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
(async()=>{
  const b=await chromium.launch({executablePath:BIN});
  const ctx=await b.newContext({viewport:{width:412,height:915}});
  const pg=await ctx.newPage();
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  const boot=async()=>{
    await pg.goto('file://'+path.resolve(__dirname,'..','index.html')); await pg.waitForTimeout(2400);
    await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
    await pg.waitForTimeout(700);
  };
  await boot();
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x===undefined?c:x).slice(0,900));} };
  const wait=ms=>pg.waitForTimeout(ms);

  await pg.evaluate(()=>{
    window.__calls=[];
    window.chatCompletion=async(messages,model,opts)=>{ const dbgL=(opts&&opts.dbg)||"";
      window.__calls.push({dbg:dbgL,sys:(messages[0]||{}).content||"",t:messages.map(m=>m.content).join("\n")});
      return /After it is over/.test(dbgL)?"You did this behind his back, and you will carry it home tonight. You will not be alone with him again this week. A night like this one would undo it.":"{}"; };
    window.__reqs=[];
    const realFetch=window.fetch;
    window.fetch=async(url,opts)=>{ const u=String(url);
      if(u.indexOf("/api/alpha/decisions")>-1){ const body=JSON.parse(opts.body); window.__reqs.push(body);
        return new Response(JSON.stringify({answers:{emotion:{type:"choice",choice:"desire"},intensity:{type:"choice",choice:"intense"},ego:{type:"choice",choice:"id_ahead"}}}),{status:200}); }
      return realFetch(url,opts); };
    const uni=state.universes[0];
    uni.locations=[{id:"l_e",name:"Emre's flat",type:"home",description:"f",residents:[],
      sublocations:[{id:"s_bed",name:"Bedroom"},{id:"s_kit",name:"Kitchen"}]}];
    const mk=(id,name,x)=>Object.assign({id,name,universeId:uni.id,instructions:"",personality:"You are "+name+". Calm, clinical, tired but fond.",backstory:"b",style:"s",goals:"",look:{},relationships:{}},x||{});
    state.personas=[mk("p_b","Buket",{relationships:{p_s:{tie:"husband",relationship:"Married twelve years; tired of each other, still fond."}}}),
                    mk("p_s","Sami",{relationships:{p_b:{tie:"wife",relationship:"He adores her."}}}),
                    mk("p_c","Cem",{})];
    Object.assign(state,{key:"k",user:"Emre",mem:false,relOn:false,intentOn:false,trackOn:false,calOn:false,promiseOn:false,gossipOn:false,
      heatOn:false,autoSpeak:false,narrMode:false,streamReveal:false,storyLang:"en",presenceOff:true,curUniverse:uni.id,emoOn:true});
    const c=curChat();
    Object.assign(c,{universeId:uni.id,locationId:"l_e",location:"Emre's flat",subId:"s_bed",subPos:{p_b:"s_bed"},presentIds:["p_b"],
      gameDay:3,period:"Evening",activeEvent:null,promises:[],messages:[],emo:{},
      calendar:[{id:"cal1",title:"Dinner at home with Sami",day:3,period:"Night",who:"Buket, Sami",where:"Buket's house"}]});
    delete c._afterHeatMid; delete c._afterHeatPending; delete c._afterHeatDone; delete c._afterHeatWith;
    state.memory=[{id:"m_sec",ownerId:"p_b",character:"Buket",content:"I kissed Emre in the stairwell and told Sami nothing.",type:"EVENT",importance:0.8,
      status:"secret",gameDay:2,gamePeriod:"Evening",date:Date.now()-86400000,chatId:c.id,universeId:uni.id,people:["Emre"]}];
    let n=0;
    window.__beat=(who,id,text)=>{ const m={mid:"hb"+(++n),role:"assistant",speaker:who,speakerId:id,heatBeat:true,present:curChat().presentIds.slice(),content:text};
      curChat().messages.push(m); return m.mid; };
    window.__ah=()=>window.__calls.filter(x=>/After it is over/.test(x.dbg));
  });

  console.log("\n[the player is with her while she is in the player's scene]");
  ok("in the same area: together; the reckoning's 'with' is the player", await pg.evaluate(()=>{
      const c=curChat(), p=state.personas[0], w=_afterHeatWithWho(c,p);
      return (w.id==="__user__"&&w.name==="Emre"&&_heatStillWith(c,p,w)===true)?true:JSON.stringify({w,still:_heatStillWith(c,p,w)}); }));
  ok("the reckoning written with them together says 'still in the room', not 'They have gone'", await pg.evaluate(async()=>{
      const c=curChat(); window.__calls=[];
      await _afterHeatFor(c,"Buket",[{mid:"x0",role:"assistant",speaker:"Buket",speakerId:"p_b",heatBeat:true,content:"\"Sami…\""}],3,"Evening");
      state.personas[0].afterHeat=null; state.personas[0].afterHeatBy={}; state.memory=state.memory.filter(m=>m.id==="m_sec");
      const t=(__ah()[0]||{}).t||"";
      return (/You are still in the room with them\./.test(t)&&!/They have gone/.test(t))?true:t.slice(0,600); }));

  console.log("\n[heat off while they are still together: nothing is reckoned, it is owed]");
  const r1=await pg.evaluate(async()=>{
    const c=curChat(); window.__calls=[];
    __beat("Buket","p_b","\"Not so fast.\""); const last=__beat("Buket","p_b","\"Sami's wife is in your bed.\"");
    // the toggle, as the scene dock does it between two clips
    state.heatOn=true; await toggleMode('heat'); await new Promise(r=>setTimeout(r,250));
    const afterToggle=__ah().length;
    const direct=await runAfterHeat(c);   // and a direct call
    return {afterToggle,direct,calls:__ah().length,mid:c._afterHeatMid||null,pend:c._afterHeatPending||null,with:c._afterHeatWith||null,heat:state.heatOn,last}; });
  ok("the toggle and a direct call reckon nothing", r1.afterToggle===0&&r1.direct===false&&r1.calls===0&&r1.heat===false, JSON.stringify(r1));
  ok("the beats stay unreckoned and a reckoning is owed, with the day and part of the day, about the player",
     r1.mid===null&&r1.pend&&r1.pend.day===3&&r1.pend.period==="Evening"&&r1.with&&r1.with.p_b&&r1.with.p_b.id==="__user__", JSON.stringify(r1));
  ok("a turn going by with them still together reckons nothing", await pg.evaluate(async()=>{
      afterHeatCatchUp(curChat()); await new Promise(r=>setTimeout(r,250));
      return __ah().length===0&&!!curChat()._afterHeatPending ? true : "reckoned: "+__ah().length; }));
  ok("the markers survive a save (durable chat keys)", await pg.evaluate(()=>{
      const sc=_slimChat({id:"x",messages:[],_afterHeatPending:{day:3,period:"Evening"},_afterHeatDone:{p_b:"m1"},_afterHeatWith:{p_b:{id:"__user__",name:"Emre"}}});
      return ["_afterHeatPending","_afterHeatDone","_afterHeatWith"].every(k=>k in sc)?true:JSON.stringify(Object.keys(sc)); }));

  console.log("\n[they separate: it runs, once]");
  const r2=await pg.evaluate(async()=>{
    const c=curChat(); window.__calls=[];
    moveToSub("s_kit",[],{quiet:true});   // the player walks to the kitchen; she stays in the bedroom
    await new Promise(r=>setTimeout(r,400));
    const a=__ah(); const once=a.length;
    await runAfterHeat(c); afterHeatCatchUp(c); await new Promise(r=>setTimeout(r,300));
    return {once,again:__ah().length,t:(a[0]||{}).t||"",sys:(a[0]||{}).sys||"",mid:c._afterHeatMid,lastBeat:c.messages.filter(m=>m.heatBeat).slice(-1)[0].mid,
      pend:c._afterHeatPending||null,rec:(state.personas[0].afterHeatBy||{}).Emre||null}; });
  ok("one reckoning when she is no longer in the player's area, about the player, written as 'They have gone'",
     r2.once===1&&/Buket's reckoning, after Emre\./.test(r2.t)&&/They have gone\. It is still the same part of the day/.test(r2.t)&&!!r2.rec, JSON.stringify({once:r2.once,t:r2.t.slice(0,400)}));
  ok("the marker moves to the last beat and nothing is owed any more; a second call reckons nothing", r2.mid===r2.lastBeat&&r2.pend===null&&r2.again===1, JSON.stringify({mid:r2.mid,last:r2.lastBeat,pend:r2.pend,again:r2.again}));

  console.log("\n[the reckoning carries the conscience state]");
  ok("not free: the husband, and it was not with him", /WHAT IS AT STAKE FOR YOU:/.test(r2.t)&&/You are not free: Sami — husband\. What happened with Emre was not with them\./.test(r2.t), r2.t.slice(0,1500));
  ok("the people she answers to, with how they stand", /The people you answer to:\n- Sami — husband \| Married twelve years/.test(r2.t), (r2.t.match(/The people you answer to:[\s\S]{0,200}/)||[""])[0]);
  ok("the plan it puts at risk tonight", /What is coming that this puts at risk:\n- Dinner at home with Sami — today, Night/.test(r2.t), (r2.t.match(/What is coming[\s\S]{0,200}/)||["(none)"])[0]);
  ok("where her conscience stood: the last ego and emotion picked (none yet here: the line is left out)", !/Where your conscience stood/.test(r2.t));
  ok("the secret she is already carrying", /What you are already carrying, open or secret:\n- \[[^\]]*\] I kissed Emre in the stairwell/.test(r2.t), (r2.t.match(/What you are already carrying[\s\S]{0,240}/)||["(none)"])[0]);
  ok("its prompt (fresh install) carries the not-free rule", /you do not conclude that guilt does not apply to you\. The conclusion can be defiant, but the cost is in it: the fear of being found out, and what it does at home tonight\./.test(r2.sys), r2.sys.slice(-900));

  console.log("\n[the part of the day changes with them still together: it runs, once]");
  const r3=await pg.evaluate(async()=>{
    const c=curChat(); window.__calls=[]; c.subId="s_bed";   // back in the bedroom
    c.emo.p_b={emotion:"Desire",intensity:"intense",tone:"consumed by desire",ego:"id_winning",sig:"s1",scene:_placeSig(c)};
    __beat("Buket","p_b","\"Again.\""); __beat("Buket","p_b","\"Don't stop.\"");
    await runAfterHeat(c);
    const held=__ah().length, pend=JSON.stringify(c._afterHeatPending||null);
    // heat back on (the next clip) and the safety net's call: still together, still waiting
    state.heatOn=true; await runAfterHeat(c,3,"Evening"); const heatOnHeld=__ah().length; state.heatOn=false;
    c.period="Night"; afterHeatCatchUp(c); await new Promise(r=>setTimeout(r,400));
    const a=__ah(); const n=a.length;
    afterHeatCatchUp(c); await runAfterHeat(c,3,"Evening"); await new Promise(r=>setTimeout(r,250));
    return {held,pend,heatOnHeld,n,again:__ah().length,t:(a[0]||{}).t||"",pendAfter:c._afterHeatPending||null}; });
  ok("held while together, and held with heat back on even past the part of the day", r3.held===0&&/"day":3,"period":"Evening"/.test(r3.pend)&&r3.heatOnHeld===0, JSON.stringify(r3).slice(0,400));
  ok("the part of the day over (heat off): one reckoning, and never again", r3.n===1&&r3.again===1&&r3.pendAfter===null, JSON.stringify({n:r3.n,again:r3.again,pend:r3.pendAfter}));
  ok("it carries where her conscience stood: id winning, Desire (intense)", /Where your conscience stood while it was happening \(the last read of you\): id winning — The want has won for now; [^\n]*; feeling Desire \(intense\)\./.test(r3.t), (r3.t.match(/Where your conscience[^\n]*/)||["(none)"])[0]);

  console.log("\n[with another character: until one of them leaves]");
  const r4=await pg.evaluate(async()=>{
    const c=curChat(); window.__calls=[]; c.period="Night";
    c.presentIds=["p_b","p_c"]; c.subPos={p_b:"s_bed",p_c:"s_bed"};
    __beat("Buket","p_b","\"Cem, the door.\"");
    await runAfterHeat(c);
    const held=__ah().length, w=JSON.stringify((c._afterHeatWith||{}).p_b||null);
    applyPresence(c,[],["Cem"]); await new Promise(r=>setTimeout(r,400));
    const a=__ah();
    return {held,w,n:a.length,t:(a[0]||{}).t||""}; });
  ok("held while Cem is with her, and the reckoning is fixed on Cem", r4.held===0&&/"id":"p_c","name":"Cem"/.test(r4.w), JSON.stringify(r4).slice(0,300));
  ok("Cem leaves: one reckoning, about Cem", r4.n===1&&/Buket's reckoning, after Cem\./.test(r4.t)&&/They have gone/.test(r4.t), JSON.stringify({n:r4.n,t:r4.t.slice(0,300)}));

  console.log("\n[the emotion pick: history, not the answer]");
  const r5=await pg.evaluate(async()=>{
    const c=curChat(); c.presentIds=["p_b"]; c.subPos={p_b:"s_bed"}; c.subId="s_bed";
    c.emo.p_b={emotion:"Desire",intensity:"intense",tone:"consumed by desire",ego:"id_winning",sig:"old",scene:_placeSig(c)};
    c.messages.push({mid:"u9",role:"user",content:"Say it again.",speaker:"Emre"}); window.__reqs=[];
    await emotionEnsure(c,state.personas[0],"Say it again.",{targetId:"__user__",targetName:"Emre"});
    const q=window.__reqs[0]||{}; return {prev:(q.state||{}).feeling_earlier_in_this_scene,ego:((q.questions||{}).ego||{}).instructions||""}; });
  ok("the previous pick goes as what it was a few lines ago, without the ego level", r5.prev==="Desire (intense) a few lines ago; it may have moved since"&&!/id|winning/.test(r5.prev), JSON.stringify(r5.prev));
  ok("the ego question: not free and behind the partner's back, the want rarely silences conscience; the want can still win",
     /Someone who is not free and is doing this behind that partner's back rarely has the want silence conscience completely, even in the middle of it: id_ahead and torn stay live during the act, and Guilt, Shame or Fear can sit beside Desire\. The want can still win\./.test(r5.ego), r5.ego.slice(0,900));

  console.log("\n[her own words: the compass and the heat guidance]");
  const r6=await pg.evaluate(()=>{
    const f=id=>FRAG_DEFAULTS.find(x=>x.id===id), o=(fid,id)=>(f(fid).options||[]).find(x=>x.id===id)||{};
    return {win:o("compass","id_winning").text,ahead:o("compass","id_ahead").text,heat:(f("guidance").byPath||{}).heat||"",
      list:JSON.stringify(fragList().find(x=>x.id==="compass"))===JSON.stringify(f("compass"))}; });
  ok("id_winning: you go on, and the want winning does not hand over your words", /and you go on anyway\.\{\{endif\}\} The want winning does not hand over your words: you still speak as yourself\. A line someone dictates to you that you would never say, you do not recite — you answer in your own words, or not at all\.$/.test(r6.win), r6.win);
  ok("id_ahead: the same", /\{\{endif\}\} The want being ahead does not hand over your words: you still speak as yourself\. A line someone dictates to you that you would never say, you do not recite/.test(r6.ahead), r6.ahead);
  ok("the heat guidance: your words stay your own, under WANTING IT AND HATING IT", /## WANTING IT AND HATING IT ARE THE SAME SECOND[\s\S]*A line that admits only one of the four is the failure here\.\nYour words stay your own\. Wanting it does not mean saying whatever you are handed: repeating the other's dictated phrasing back is not desire, it is losing yourself\. Choose your own words, or say nothing\.\nNever say any of those four words/.test(r6.heat), r6.heat.slice(0,1400));
  ok("a fresh install's list is the shipped one", r6.list===true);
  ok("a saved list still at the v150.71 compass and guidance is upgraded; an edited compass stays", await pg.evaluate(()=>{
      const keep=JSON.parse(JSON.stringify(state.fragments||null)), keepAdds=store.raw(K.fragAdds,"");
      try{
        const run=edit=>{ const L=JSON.parse(JSON.stringify(FRAG_DEFAULTS)).map(x=>FRAG_DEFAULTS_V150_71_OLD[x.id]?JSON.parse(JSON.stringify(FRAG_DEFAULTS_V150_71_OLD[x.id])):x);
          if(edit){ const cp=L.find(x=>x.id==="compass"); cp.name="My compass"; }
          state.fragments=L; _fragMigratedFor=null; store.setRaw(K.fragAdds,FRAG_SHIPPED_ADDS.map(a=>a.key).filter(k=>k!=="v150.72.words").join(","));
          fragMigrateStored();
          return {c:state.fragments.find(x=>x.id==="compass"),g:state.fragments.find(x=>x.id==="guidance"),adds:store.raw(K.fragAdds,"")}; };
        const a=run(false), e=run(true);
        const same=(x,id)=>JSON.stringify(x)===JSON.stringify(FRAG_DEFAULTS.find(y=>y.id===id));
        const r={upC:same(a.c,"compass"),upG:same(a.g,"guidance"),marked:/v150\.72\.words/.test(a.adds),
          editKept:e.c.name==="My compass"&&!/does not hand over your words/.test(JSON.stringify(e.c)),editG:same(e.g,"guidance")};
        return (r.upC&&r.upG&&r.marked&&r.editKept&&r.editG)?true:JSON.stringify(r);
      }finally{ state.fragments=keep; _fragMigratedFor=null; store.setRaw(K.fragAdds,keepAdds); }
    }));

  console.log("\n[stored prompts: upgraded only while they are the v150.71 default]");
  await pg.evaluate(()=>{
    const ahOld=DEFAULT_AFTER_HEAT.replace(AFTER_HEAT_RULE_V150_72,""), egOld=X_ENGINE_PROMPTS.x_ego_pick.def.replace(EGO_PICK_RULE_V150_72,"");
    store.setRaw(K.afterHeatPrompt,ahOld); store.setRaw(K.x_ego_pick,egOld+"\nMY OWN LINE");
    const u=state.universes[0]; u.prompts=Object.assign({},u.prompts||{},{afterHeatPrompt:ahOld+"\nMINE",x_ego_pick:egOld});
    persistUniverses();
  });
  await wait(300);
  await boot();
  const r7=await pg.evaluate(()=>{ const u=state.universes[0]||{}, up_=u.prompts||{};
    return {ah:state.afterHeatPrompt===DEFAULT_AFTER_HEAT,ahStored:store.raw(K.afterHeatPrompt,"")===DEFAULT_AFTER_HEAT,
      eg:/MY OWN LINE$/.test(state.x_ego_pick)&&state.x_ego_pick.indexOf(EGO_PICK_RULE_V150_72)<0,
      uAh:/\nMINE$/.test(up_.afterHeatPrompt||"")&&(up_.afterHeatPrompt||"").indexOf(AFTER_HEAT_RULE_V150_72)<0,
      uEg:up_.x_ego_pick===X_ENGINE_PROMPTS.x_ego_pick.def}; });
  ok("the reckoning prompt still at the v150.71 default gets the rule (and is saved)", r7.ah&&r7.ahStored, JSON.stringify(r7));
  ok("an edited ego question is the player's and is left alone", r7.eg, JSON.stringify(r7));
  ok("in a story: an edited reckoning prompt stays, an ego question still at the default is upgraded", r7.uAh&&r7.uEg, JSON.stringify(r7));

  ok("no page errors", errs.length===0?true:errs.join(" | "));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close(); process.exit(fail?1:0);
})();
