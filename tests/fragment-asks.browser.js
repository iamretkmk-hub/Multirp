/* v150.64 — AN ASK THAT CAN INJECT, AND AN EDITOR THAT SHOWS ONLY WHAT MATTERS. Checked here:
     - "Your private motive" (q_motive__bears, has_motive): a motive toward the player answered yes injects its wording (v150.61
       offered the colouring but not the data the fragment words it from, so a yes injected nothing); a self-serving motive
       has wording of its own; with no motive that can be rendered (none toward the one answered, no aim, motives off) the
       question is not asked at all — and in general an option whose code condition reads only facts known before the request
       and is false is not asked, while one that reads a fact the same request decides (ego) is;
     - the feelings fragments reach a saved list once (after "ties", before "compass"), with a feeling piece the user had
       rewritten carried in, and someone with no saved list who rewrote one gets a saved copy that holds it;
     - the editor: "What the question also gets" only while the ask box has text (live, ticks kept in the draft), the ask box
       labelled optional, and "Add text on a path" folded until a path box is ticked.
   Run: node tests/fragment-asks.browser.js   (needs playwright; see tests/README.md) */
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
      state.personas=[{id:"p_a",name:"Ayla",universeId:uni.id,personality:"Sharp.",relationships:{p_b:{tie:"older brother",relationship:"Berk raised her."},__user__:{tie:"neighbour",relationship:"Emre lives across the hall."}}},
        {id:"p_b",name:"Berk",universeId:uni.id,personality:"Loud."}];
      state.user="Emre"; state.key="sk-test"; state.fragments=null; state.emoOn=true; state.intentOn=true; state.relOn=false; state.memory=[];
      store.setRaw(K.fragAdds,FRAG_SHIPPED_ADDS.map(a=>a.key).join(",")); _emoBreak.until=0; _emoBreak.fails=0;
      const c=curChat();
      Object.assign(c,{universeId:uni.id,presentIds:["p_a","p_b"],emo:{},calendar:[],intents:[],rel:{},gameDay:3,period:"Evening",
        messages:[{mid:"u1",role:"user",content:'"Hi."'},{mid:"a1",role:"assistant",speaker:"Ayla",speakerId:"p_a",content:'"Hello."'},{mid:"u2",role:"user",content:'"So?"'}]});
      return c; };
    window.__payload=(c,p,tId,tName)=>{ const B=Object.assign({},buildCharPromptBlocks(p,[],{recent:[],diary:[],longterm:[]},null,{chat:c,targetName:tName,targetId:tId,payloadKind:"solo"}),
        buildTailBlocks({chat:c,selfP:p,selfId:p.id,selfName:p.name,targetName:tName,targetId:tId,injected:{recent:[],diary:[],longterm:[]},payloadKind:"solo"}));
      return (ptBuildMessages("solo",B,[{role:"user",content:"(history)"}],{chat:c,npc:p,targetName:tName})||[]).map(m=>m.content).join("\n"); };
    window.__asked=async(c,p,tId)=>{ const rf=window.fetch; let body=null;
      window.fetch=async(u,o)=>{ if(String(u).indexOf("/api/alpha/decisions")>-1){ body=JSON.parse(o.body); const a={}; Object.keys(body.questions).forEach(k=>{ a[k]=k==="emotion"?{choice:"calm"}:k==="intensity"?{choice:"mild"}:k==="ego"?{choice:"id_winning"}:{noul:0.95}; });
        return new Response(JSON.stringify({answers:a}),{status:200}); } return rf(u,o); };
      c.messages.push({mid:"u"+Date.now()+Math.random(),role:"user",content:'"Well?"'});
      try{ await emotionEnsure(c,p,"Well?",{targetId:tId,targetName:tId==="__user__"?"Emre":"Berk",kind:"solo"}); } finally{ window.fetch=rf; }
      return body?Object.keys(body.questions):[]; };
  });

  console.log("\n[your private motive: asked when it can inject, injected when asked yes]");
  const M=await pg.evaluate(async()=>{ const r={};
    // toward the player, the one being answered
    let c=__setup(), p=state.personas[0];
    c.intents=[{id:"i1",holderId:"p_a",targetId:"__user__",targetName:"Emre",valence:"warm",kind:"crush",aim:"to be asked out",status:"brewing",strength:0.6}];
    r.facts=fragCodeFacts(c,p,"__user__").has_motive; r.asked=(await __asked(c,p,"__user__")).indexOf("q_motive__bears")>=0;
    r.yes=__payload(c,p,"__user__","Emre");
    // self-serving, toward a character here who is answered
    c=__setup(); c.intents=[{id:"i2",holderId:"p_a",targetId:"p_b",targetName:"Berk",valence:"self_serving",kind:"ambition",aim:"to get his boat",status:"brewing",strength:0.6}];
    r.selfAsked=(await __asked(c,p,"p_b")).indexOf("q_motive__bears")>=0; r.self=__payload(c,p,"p_b","Berk");
    // no motive toward the one answered; a motive with no aim; motives switched off
    c=__setup(); r.none=(await __asked(c,p,"__user__")).indexOf("q_motive__bears")>=0;
    c=__setup(); c.intents=[{id:"i3",holderId:"p_a",targetId:"__user__",targetName:"Emre",valence:"warm",kind:"crush",aim:"",status:"brewing",strength:0.6}];
    r.noAim=[fragCodeFacts(c,p,"__user__").has_motive,(await __asked(c,p,"__user__")).indexOf("q_motive__bears")>=0];
    c=__setup(); c.intents=[{id:"i4",holderId:"p_a",targetId:"__user__",targetName:"Emre",valence:"warm",kind:"crush",aim:"to be asked out",status:"brewing",strength:0.6}]; state.intentOn=false;
    r.off=[fragCodeFacts(c,p,"__user__").has_motive,(await __asked(c,p,"__user__")).indexOf("q_motive__bears")>=0]; state.intentOn=true;
    // the strongest motive in the room is toward someone else: as before, theirs with the aside
    c=__setup(); c.intents=[{id:"i5",holderId:"p_a",targetId:"__user__",targetName:"Emre",valence:"warm",kind:"crush",aim:"to be asked out",status:"brewing",strength:0.2},
      {id:"i6",holderId:"p_a",targetId:"p_b",targetName:"Berk",valence:"warm",kind:"reach",aim:"to get him to stay",status:"brewing",strength:0.9}];
    await __asked(c,p,"__user__"); r.aside=__payload(c,p,"__user__","Emre");
    return r; });
  ok("toward the player: has_motive, asked, and a yes injects the wording with the motive's own words",
    M.facts===true&&M.asked===true&&/# WHAT YOU ARE QUIETLY AFTER WITH Emre\nYou privately hold a growing warmth toward Emre, who is here now — a crush, and what you actually want out of it is this: to be asked out\./.test(M.yes), (M.yes.match(/QUIETLY AFTER[\s\S]{0,300}/)||["(nothing injected)"])[0]);
  ok("a self-serving motive has its own wording (it had none in the fragment)",
    M.selfAsked===true&&/# WHAT YOU ARE QUIETLY AFTER WITH Berk\nYou want something out of Berk, who is here now — an ambition, and what you are after is this: to get his boat\. You are not saying so\. Nothing turns cold/.test(M.self), (M.self.match(/QUIETLY AFTER[\s\S]{0,300}/)||["(nothing injected)"])[0]);
  ok("nothing that can be injected → not asked: no motive toward them, a motive with no aim, motives switched off", M.none===false&&M.noAim.join()==="false,false"&&M.off.join()==="false,false", JSON.stringify(M));
  ok("as before: the strongest motive in the room, toward someone else, comes with the aside", /# WHAT YOU ARE QUIETLY AFTER WITH Berk[\s\S]*This turn is aimed at Emre, not at Berk/.test(M.aside), (M.aside.match(/QUIETLY AFTER[\s\S]{0,500}/)||["(nothing)"])[0]);
  ok("an option whose code reads only facts known before the request, and is false, is not asked; one that reads a fact the request decides is",
    await pg.evaluate(()=>{ const pre=ptCondFlags({render_mode:"solo",has_motive:false,alone:true});
      const r=[_fragAskApplies({code:"has_motive"},pre),_fragAskApplies({code:"not ego = id_winning"},pre),_fragAskApplies({code:"alone and has_motive"},pre),_fragAskApplies({code:"alone"},pre),
        _fragAskApplies({code:"render_mode = text"},pre),_fragAskApplies({code:""},pre),_fragAskApplies({code:"has_line"},pre)];
      return r.join()==="false,true,false,true,false,true,true"?true:r.join(); }));

  console.log("\n[the feelings reach a saved list, once]");
  const SV=await pg.evaluate(()=>{
    const L=JSON.parse(JSON.stringify(FRAG_DEFAULTS)).filter(f=>f.id!=="feelings"&&f.id!=="feelings_now");
    state.fragments=L; _fragMigratedFor=null; state.blockTpls={feel_now_header:"# MY BODY RIGHT NOW\nNot what you think of {{target}}: what you are as you speak."};
    store.setRaw(K.fragAdds,FRAG_SHIPPED_ADDS.map(a=>a.key).filter(k=>k!=="feelings"&&k!=="feelings_now").join(","));
    const M=fragList(), ids=M.map(f=>f.id), r={feel:ids.indexOf("feelings")===ids.indexOf("ties")+1,now:ids.indexOf("feelings_now")===ids.indexOf("compass")-1,
      carried:/# MY BODY RIGHT NOW\nNot what you think of \{\{call\/\/feel_target_raw\}\}: what you are as you speak\./.test(JSON.stringify(M.find(f=>f.id==="feelings_now")).replace(/\\n/g,"\n"))};
    M.splice(M.findIndex(f=>f.id==="feelings"),1); _fragMigratedFor=null; state.fragments=M; r.deletedStays=!fragList().some(f=>f.id==="feelings");
    // nobody saved a list, but a feeling piece was rewritten: a copy that holds it is saved, once
    state.fragments=null; _fragMigratedFor=null; store.setRaw(K.fragments,"");
    store.setRaw(K.fragAdds,FRAG_SHIPPED_ADDS.map(a=>a.key).filter(k=>k!=="feelings"&&k!=="feelings_now").join(","));
    state.blockTpls={feel_header:"# HOW I FEEL ABOUT {{target}}\nKeep it to yourself."};
    const D=fragList(); r.defaultsCarried=Array.isArray(state.fragments)&&/# HOW I FEEL ABOUT \{\{call\/\/feel_target_raw\}\}\\nKeep it to yourself\./.test(JSON.stringify(D.find(f=>f.id==="feelings")))
      &&_fragCanon(D.find(f=>f.id==="compass"))===_fragCanon(FRAG_DEFAULTS.find(f=>f.id==="compass"));
    state.blockTpls={}; state.fragments=null; _fragMigratedFor=null; store.setRaw(K.fragments,""); store.setRaw(K.fragAdds,FRAG_SHIPPED_ADDS.map(a=>a.key).join(","));
    return r; });
  ok("a saved list gets \"How you feel about them\" after the ties and \"What your body is doing\" before the compass, a rewritten piece carried in; deleting one sticks",
    SV.feel&&SV.now&&SV.carried&&SV.deletedStays, JSON.stringify(SV));
  ok("no saved list, a feeling piece rewritten: a saved copy holds it, every other fragment shipped", SV.defaultsCarried===true, JSON.stringify(SV));

  console.log("\n[the editor]");
  const ED=await pg.evaluate(()=>{
    window.uiConfirm=async()=>true; _fragDraft=null; _fragOpen=null; state.fragments=null; show('settings'); renderFragEditor();
    const host=document.getElementById('fragHost'), r={};
    const i=FRAG_DEFAULTS.findIndex(f=>f.id==="say_no"); fragEdOpen(i);
    const ctx=j=>document.getElementById(`fragCtx_${i}_o_${j}`);
    r.label=/<b>Ask the decision model \(optional\)<\/b>/.test(host.innerHTML);
    r.shownWithAsk=!!ctx(0)&&ctx(0).style.display!=="none";
    fragEdOptAdd(i); const j=_fragDraft[i].options.length-1;
    r.hiddenNoAsk=!!ctx(j)&&ctx(j).style.display==="none";
    const ta=host.querySelector(`textarea[data-fp="${i}.o.${j}.ask"]`); ta.value="Is {{char}} tired?"; fragEdInput(ta);
    r.liveShown=ctx(j).style.display!=="none"&&document.activeElement!==null;
    fragEdCtx(`${i}.o.${j}`,"memories",true); r.ticked=(_fragDraft[i].options[j].ctx||[]).indexOf("memories")>=0;
    const ta2=host.querySelector(`textarea[data-fp="${i}.o.${j}.ask"]`); ta2.value="  "; fragEdInput(ta2);
    r.liveHidden=ctx(j).style.display==="none"&&(_fragDraft[i].options[j].ctx||[]).indexOf("memories")>=0;
    // "Add text on a path": folded while no path box is ticked, open once one is
    const bp=()=>host.querySelector(`details.fragBp[data-bp="${i}"]`);
    r.folded=!!bp()&&!bp().open&&/Add text on a path:/.test(bp().querySelector('summary').textContent);
    fragEdByPath(String(i),"heat",true); r.openTicked=!!bp()&&bp().open&&!!host.querySelector(`textarea[data-fp="${i}.byPath.heat"]`);
    fragEdByPath(String(i),"heat",false);
    const oj=host.querySelector(`details.fragBp[data-bp="${i}.o.0"]`); r.optFolded=!!oj&&!oj.open;
    _fragDraft=null; _fragOpen=null; renderFragEditor();
    return r; });
  ok("the ask box is labelled optional", ED.label===true, JSON.stringify(ED));
  ok("\"What the question also gets\" shows for an option with an ask, hides for one without", ED.shownWithAsk&&ED.hiddenNoAsk, JSON.stringify(ED));
  ok("it follows the ask box live, and what is ticked stays in the draft while it is hidden", ED.liveShown&&ED.ticked&&ED.liveHidden, JSON.stringify(ED));
  ok("\"Add text on a path\" is folded until a path box is ticked, then open (fragments and options)", ED.folded&&ED.openTicked&&ED.optFolded, JSON.stringify(ED));

  ok("no page errors", errs.length===0?true:errs.join(" | "));
  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close(); process.exit(fail?1:0);
})().catch(e=>{ console.error(e); process.exit(1); });
