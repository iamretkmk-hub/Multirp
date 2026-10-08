/* v150.14 — THE FEELINGS AND THE MOTIVES LEAVE THE REPLY, AND REACH THE TWO ENGINES THAT WEIGH THEM.
   The player takes these out of the reply layouts (they made characters get stuck or break too easily):
     {{call//feel_lasting}} {{call//feel_lasting_alt}}   the settled view of the person answered
     {{call//feel_now_header}} {{call//feel_now_body}}    the live charge of this moment
     {{call//intent_warm}} {{call//intent_hostile}}       a private motive toward someone present
   and keeps {{call//drives}} and the after-heat decision in the reply instead. So the drives writer and the
   after-heat reckoning must SEE all three, even when no reply layout calls them.
   Pinned:
     1  (v150.38: the drives writer is gone — the id / superego pick in the reply's Decisions request weighs them)
     2  the after-heat reckoning (the player's own engine layout) receives the settled view, the live charge and the motive
     3  with the feelings fragments taken out of the reply (v150.66: a reply is its fragments; it was the calls taken out of
        the player's reply layouts), none of the three is in the reply
   Run: node tests/feelings-to-engines.browser.js   (needs playwright; see tests/README.md) */
const {chromium}=require('playwright');
const fs=require('fs'), path=require('path');
const BIN=process.env.SM_CHROME||process.env.CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
(async()=>{
  const b=await chromium.launch({executablePath:BIN});
  const pg=await b.newPage({viewport:{width:412,height:915}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file://'+path.resolve(__dirname,'..','index.html')); await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(900);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x===undefined?c:x).slice(0,900));} };

  /* The player's own layouts (the bundled latest prompts), with the six calls taken out of the reply ones. */
  const pack=JSON.parse(fs.readFileSync(path.resolve(__dirname,'fixtures','latest-prompts.json'),'utf8'));
  const tpls=JSON.parse(pack.settings.payloadTemplates);
  /* both spellings: the fragment calls the player listed, and the whole-block calls the bundled layouts use */
  const GONE=/\{\{call\/\/(feel_lasting|feel_lasting_alt|feel_now_header|feel_now_body|intent_warm|intent_hostile|feelings|feelings_now|private_intent)(\/\/full)?\}\}\n?/g;
  ["solo","multi","gm","text","heat"].forEach(k=>{ if(tpls[k]) tpls[k]=tpls[k].replace(GONE,""); });

  await pg.evaluate(({tpls})=>{
    window.__calls=[];
    window.chatCompletion=async(messages,model,opts)=>{ window.__calls.push({dbg:(opts&&opts.dbg)||"",t:messages.map(m=>m.content).join("\n")});
      return /After it is over/.test((opts&&opts.dbg)||"")?"It happened and you will not pretend it did not. You will not let it happen again in this flat."
        :JSON.stringify({toward:"PULL_MARKER tell him a date",against:"BRAKE_MARKER Buket is right there"}); };
    /* the player's own ENGINE templates (the after-heat reckoning reads its layout from them). The reply is built from the
       fragments only (v150.66): since v150.64 the shipped ones carry the feelings ("How you feel about them", "What your body
       is doing"), so a player who does not want them deletes those two fragments, as they took the calls out of their reply
       templates before */
    state.payloadTemplates=tpls; state.payloadTplOn=true;
    state.fragments=JSON.parse(JSON.stringify(FRAG_DEFAULTS)).filter(f=>f.id!=="feelings"&&f.id!=="feelings_now");
    store.setRaw(K.fragAdds,FRAG_SHIPPED_ADDS.map(a=>a.key).join(","));
    const uni=state.universes[0];
    uni.locations=[{id:"l_f",name:"The flat",type:"home",description:"f",residents:[],sublocations:[{id:"s_l",name:"Living room"}]}];
    const mk=(id,name,x)=>Object.assign({id,name,universeId:uni.id,instructions:"",personality:"You are "+name+".",backstory:"b",style:"s",goals:"",look:{raw:name+" is tall"},relationships:{}},x||{});
    state.personas=[mk("p_b","Buket Ozucak",{relationships:{p_s:{tie:"husband",relationship:"She loves him."}}}),
                    mk("p_s","Sami Ozucak",{relationships:{p_b:{tie:"wife",relationship:"He adores her."}}})];
    Object.assign(state,{key:"k",user:"Emre",mem:false,relOn:true,intentOn:true,trackOn:false,calOn:false,promiseOn:false,gossipOn:false,
      heatOn:false,autoSpeak:false,narrMode:false,streamReveal:false,storyLang:"en",presenceOff:true});
    const c=curChat();
    Object.assign(c,{universeId:uni.id,locationId:"l_f",location:"The flat",subId:"s_l",subPos:{p_b:"s_l",p_s:"s_l"},presentIds:["p_b","p_s"],
      gameDay:3,period:"Evening",activeEvent:null,calendar:[],promises:[],_psyche:{},
      messages:[{mid:"u1",role:"user",present:["p_b","p_s"],content:'"Buket, where is the money going?"'}]});
    c.rel={
      "p_b>__user__":{desc:"SETTLED_EMRE_MARKER you trust Emre more than Sami's version of him.",trust:50,affection:30,familiarity:60,
                      st:{agitation:55,fear:30},stNote:"PLAYABLE_NOTE_MARKER she is about to ask the one question she has not asked.",stNoteAt:c.messages.length},
      "p_b>p_s":{desc:"SETTLED_SAMI_MARKER your husband; you no longer believe his explanations.",trust:-25,affection:55,familiarity:95,
                 st:{agitation:60,desire:40},stNote:"PLAYABLE_SAMI_MARKER her voice goes flat when he starts to joke.",stNoteAt:c.messages.length}};
    c.intents=[
      {id:"i1",holderId:"p_b",holderName:"Buket Ozucak",targetId:"p_s",targetName:"Sami Ozucak",valence:"hostile",kind:"suspicion",aim:"MOTIVE_SAMI_MARKER find out where the money goes",strength:0.8,status:"live",day:2},
      {id:"i2",holderId:"p_b",holderName:"Buket Ozucak",targetId:"__user__",targetName:"Emre",valence:"warm",kind:"alliance",aim:"MOTIVE_EMRE_MARKER get Emre to tell her the truth",strength:0.6,status:"live",day:3}];
  },{tpls});

  // v150.38 — section 1 (the drives writer) is gone with the writer; the id / superego pick weighs the feelings now (emotion-pick).

  console.log("\n[2 — the after-heat reckoning weighs them too (the player's own engine layout)]");
  const ah=await pg.evaluate(async()=>{
    const c=curChat(); window.__calls=[];
    c.messages.push({mid:"h1",role:"assistant",speaker:"Buket Ozucak",speakerId:"p_b",heatBeat:true,present:["p_b","p_s"],content:'"Sami…"'});
    c._afterHeatMid=null;
    await runAfterHeat(c,3,"Evening");
    const call=window.__calls.find(x=>/After it is over/.test(x.dbg)); return call?call.t:"(no after-heat call)"; });
  ok("the settled view of him", /SETTLED_SAMI_MARKER/.test(ah), ah.slice(0,800));
  ok("the live charge, with the playable note", /PLAYABLE_SAMI_MARKER/.test(ah), ah.slice(0,1600));
  ok("the private motive toward him", /MOTIVE_SAMI_MARKER/.test(ah), ah.slice(0,2400));

  console.log("\n[3 — the reply, without the feelings fragments, does not carry the raw feelings]");
  const r=await pg.evaluate(()=>{
    const c=curChat(), p=state.personas.find(x=>x.id==="p_b");
    c.messages=c.messages.filter(m=>m.mid==="u1");
    const opts={chat:c,targetName:"Emre",targetId:"__user__",payloadKind:"multi"};
    const others=state.personas.filter(x=>x.id==="p_s");
    const hb=buildCharPromptBlocks(p,others,{recent:[],diary:[],longterm:[]},null,opts);
    const tb=buildTailBlocks({chat:c,selfP:p,selfId:p.id,selfName:p.name,targetName:"Emre",targetId:"__user__",multi:true,injected:{recent:[],diary:[],longterm:[]}});
    const msgs=ptBuildMessages("multi",Object.assign({},hb,tb),tagLastForTarget(castHistory(c,p)),{chat:c,npc:p,targetName:"Emre"},
      ()=>Object.assign({},buildCharPromptBlocks(p,others,{recent:[],diary:[],longterm:[]},null,opts),
        buildTailBlocks({chat:c,selfP:p,selfId:p.id,selfName:p.name,targetName:"Emre",targetId:"__user__",multi:true,injected:{recent:[],diary:[],longterm:[]}})));
    return (msgs||[]).map(m=>m.content).join("\n"); });
  ok("the settled view is not", !/SETTLED_EMRE_MARKER/.test(r), (r.match(/.{0,120}SETTLED_EMRE_MARKER.{0,120}/)||[""])[0]);
  ok("the live charge's playable note is not", !/PLAYABLE_NOTE_MARKER/.test(r), (r.match(/.{0,120}PLAYABLE_NOTE_MARKER.{0,120}/)||[""])[0]);
  ok("the motive toward Sami is not", !/MOTIVE_SAMI_MARKER/.test(r), (r.match(/.{0,160}MOTIVE_SAMI_MARKER.{0,120}/)||[""])[0]);

  ok("no page errors", errs.length===0, errs.join("\n"));
  await b.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail?1:0);
})();
