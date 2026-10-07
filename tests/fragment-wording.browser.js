/* v150.59 — EVERY WORD IN ITS FRAGMENT. The last reply fragments that still called a worded piece (the task, the world, who
   you are, your ties, the formats, what you already said, the scene, privacy, plans, the private motive, the spoken limits,
   the trackers, the consistency note) hold their own wording now, and call only data (*_raw). And a path's own text ADDS
   under the main body instead of replacing it. Checked here: every {{call//…}} in every shipped fragment brings in data
   only (no shipped wording) in every situation; the converted fragments say what they said, case by case and path by
   path; a saved list is upgraded once (unedited fragments replaced, a rewritten piece carried in, edited path texts
   converted losslessly), and someone who never saved a list keeps a piece they rewrote; the editor opens an empty path
   box under the main body, and ticking leaves the screen where it was.
   Run: node tests/fragment-wording.browser.js   (needs playwright; see tests/README.md) */
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
    const uni=state.universes[0];
    const L1={id:"l_home",name:"Ayla's Flat",type:"home",residents:["p_a"],sublocations:[{id:"s1",name:"Entrance"},{id:"s2",name:"Kitchen"},{id:"s3",name:"Balcony",privacy:0.1}]};
    const L2={id:"l_bar",name:"Harbour Bar",type:"bar",residents:[],sublocations:[{id:"b1",name:"Entrance"}]};
    const L3={id:"l_emre",name:"Emre's House",type:"home",residents:[],sublocations:[{id:"e1",name:"Entrance"},{id:"e2",name:"Lounge"}]};
    uni.locations=[L1,L2,L3];
    const base=()=>{
      state.personas=[
        {id:"p_a",name:"Ayla",universeId:uni.id,personality:"Ayla is sharp.",backstory:"Grew up by the docks.",traits:"When pushed, she pushes back.\nWhen praised, she deflects.",
         goals:"Open her own shop.",look:{hair:"red hair",face:"freckles"},style:"Short, dry sentences.",instructions:"Hold the pause before answering.",
         wardrobe:"A green raincoat.",scenario:"The flat above the bakery, late.",
         relationships:{p_b:{tie:"my older brother",relationship:"Berk raised her after their father left."},__user__:{tie:"neighbour",relationship:"Emre lives across the hall."},p_c:{tie:"old friend",relationship:"Cem and she grew up together.",pinned:true}}},
        {id:"p_b",name:"Berk",universeId:uni.id,personality:"Berk is loud.",look:{hair:"black hair"},style:"Loud."},
        {id:"p_c",name:"Cem",universeId:uni.id,personality:"Cem is away.",look:{},style:"x"},
        {id:"p_d",name:"Deniz",universeId:uni.id,personality:"Deniz is quiet.",look:{},style:"y"}];
      state.user="Emre"; state.userBio="Emre is a carpenter."; state.userLook="Tall, grey eyes.";
      state.payloadTplOn=false; state.fragOn=true; state.fragments=window.__frags||null; state.autoSpeak=false; state.narrMode=false; state.narrOn=false; state.gossip=[];
      state.trackOn=false; state.memory=[]; state.mem=true; state.relOn=false; state.intentOn=true; state.promiseOn=true; state.formatRules=undefined;
      store.setRaw(K.fragAdds,FRAG_SHIPPED_ADDS.map(a=>a.key).join(","));
      state.blockTpls={};
      uni.setting="A rainy port town where everyone owes someone.";
      uni.trackers=[];
      const c=curChat(); ["_heatBeat","activeEvent","watchingNow","dayLog","spokenLimits"].forEach(k=>{ delete c[k]; });
      Object.assign(c,{universeId:uni.id,presentIds:["p_a","p_b"],emo:{},promises:[],wearing:{},calendar:[],intents:[],rel:{},gameDay:3,period:"Evening",
        locationId:null,location:"",subId:null,subPos:{},
        messages:[{mid:"u1",role:"user",content:'"Hi there."'},{mid:"a1",role:"assistant",speaker:"Ayla",speakerId:"p_a",content:'"Hello."'},
          {mid:"b1",role:"assistant",speaker:"Berk",speakerId:"p_b",content:'"Hey."'},{mid:"u2",role:"user",content:'"So, what now?"'}]});
      uni.gameData=uni.gameData||{}; uni.gameData.quests=[]; uni.userWardrobe="jeans and a sweater";
      setWearingOverride(c,"p_b","a red coat"); setWearingOverride(c,"__user__","a grey sweater");
      return c; };
    const S={
      cont:c=>c.messages.push({mid:"a2",role:"assistant",speaker:"Ayla",speakerId:"p_a",content:'"I said what I said."'}),
      heat:c=>{ c._heatBeat={n:2,total:5}; },
      lastbeat:c=>{ c._heatBeat={n:5,total:5}; },
      rich:c=>{
        c.promises=[{id:"pr1",holderId:"p_a",holderName:"Ayla",toId:"__user__",toName:"Emre",promise:"never tell Berk",status:"open",day:1},
                    {id:"pr2",holderId:"__user__",holderName:"Emre",toId:"p_a",toName:"Ayla",promise:"come back tomorrow",status:"open",day:1},
                    {id:"pr3",holderId:"p_a",holderName:"Ayla",toId:"__user__",toName:"Emre",promise:"keep the key",status:"broken",statusDay:3,day:1}];
        state.gossip=[{id:"g1",universeId:uni.id,text:"Emre was seen with someone at night",stakeholderId:"p_a",heat:0.8,status:"open",raisedBy:{}},
                      {id:"g2",universeId:uni.id,text:"Berk owes money",stakeholderId:"p_b",heat:0.7,status:"open",carriers:[{charId:"p_a"}]}];
        uni.gameData.quests=[{id:"q1",title:"The missing ledger",desc:"Someone took the ledger.",npcId:"p_a",startActive:true,progress:[{day:2,text:"The clerk would not look at her."}]}];
        c.watchingNow={text:"A man drops a glass at the bar.",at:c.messages.length}; },
      spent:c=>{ S.rich(c); state.gossip[0].raisedBy={p_a:(c.gameDay||1)}; state.gossipCooldown=5;
        uni.gameData.quests.push({id:"q2",title:"The second debt",desc:"A debt comes due.",npcId:"p_a",startActive:true,progress:[]}); },
      markup:c=>{ c.messages.splice(1,1,{mid:"a1",role:"assistant",speaker:"Ayla",speakerId:"p_a",content:'"[say quietly] Hello."'}); },
      voiced:()=>{ state.autoSpeak=true; },
      narr:()=>{ state.narrMode=true; },
      absent:c=>{ c.messages.push({mid:"u3",role:"user",content:'Cem, gel buraya!'}); },
      notyours:c=>{ c.messages.push({mid:"b2",role:"assistant",speaker:"Berk",speakerId:"p_b",content:'"Emre, are you coming?"',toId:"__user__",toName:"Emre"}); },
      since:c=>{ c.messages=[{mid:"a0",role:"assistant",speaker:"Ayla",speakerId:"p_a",content:'"First."'},{mid:"u1",role:"user",content:'"Hm."'},{mid:"b1",role:"assistant",speaker:"Berk",speakerId:"p_b",content:'"Yes?"'}]; },
      event:c=>{ c.activeEvent={kind:"confrontation",trigger:"Berk slammed the door",summary:"Old debt between them",intent:"Demand the money back",_startMsg:0};
        c.messages.push({mid:"sb",role:"assistant",sceneBeat:true,speaker:"Narrator",content:"The door bangs open."}); },
      opener:c=>{ S.event(c); c.activeEvent.accuserId="p_a"; c.activeEvent.participant={approaching:false}; c.messages=c.messages.filter(m=>m.speakerId!=="p_a"); },
      // a place: her own flat, Berk in the kitchen with her and Emre; Deniz present on the balcony (nearby)
      home:c=>{ c.locationId="l_home"; c.location="Ayla's Flat"; c.subId="s2"; c.presentIds=["p_a","p_b","p_d"]; c.subPos={p_a:"s2",p_b:"s2",p_d:"s3"}; },
      // the bar, alone with the player
      bar:c=>{ c.locationId="l_bar"; c.location="Harbour Bar"; c.subId="b1"; c.presentIds=["p_a"]; c.subPos={p_a:"b1"}; },
      // Emre's house: she is a guest; alone with him
      guest:c=>{ uni.playerHomeLocId="l_emre"; c.locationId="l_emre"; c.location="Emre's House"; c.subId="e1"; c.presentIds=["p_a"]; c.subPos={p_a:"e1"}; },
      // apart: she is in another room than the player
      apart:c=>{ c.locationId="l_home"; c.location="Ayla's Flat"; c.subId="s1"; c.presentIds=["p_a","p_b"]; c.subPos={p_a:"s3",p_b:"s1"}; },
      // the scene moved since her last reply
      changed:c=>{ c.messages[1].status={day:2,period:"Morning",location:"Harbour Bar"}; c.messages[1].present=["p_a","p_b"];
        c.messages.push({mid:"pn",role:"system",presenceNote:true,content:"Cem arrives.",enteredIds:["p_c"],exitedIds:["p_d"]});
        c.locationId="l_home"; c.location="Ayla's Flat"; c.subId="s2"; c.presentIds=["p_a","p_b","p_c"]; c.subPos={p_a:"s2",p_b:"s2",p_c:"s2"}; },
      trackers:c=>{ state.trackOn=true;
        uni.trackers=[{id:"t1",name:"Trust",owner:"__story__",userVisibility:"public",min:0,max:100,start:20,behavior:"free",method:"llm"},
          {id:"t2",name:"Cycle",owner:"p_a",min:0,max:28,start:14,behavior:"free",method:"llm",stages:[{at:10,text:"You are fertile this week."}]}]; },
      trackersOwn:c=>{ state.trackOn=true;
        uni.trackers=[{id:"t2",name:"Cycle",owner:"p_a",min:0,max:28,start:14,behavior:"free",method:"llm",stages:[{at:10,text:"You are fertile this week."}]}]; },
      cal:c=>{ c.calendar=[
          {id:"c1",kind:"meeting",title:"The lawyer",who:"Ayla",charIds:["p_a"],withUser:true,day:4,period:"Morning",done:false,detail:"sign the lease",certainty:"likely",executor:"Emre",probability:60},
          {id:"c2",kind:"meeting",title:"Dinner",who:"Ayla",charIds:["p_a"],withUser:true,day:3,period:"Night",done:false,executor:"Ayla",executorId:"p_a"},
          {id:"c3",kind:"meeting",title:"The wedding",who:"Ayla",charIds:["p_a"],withUser:true,day:8,done:false},
          {id:"c4",kind:"meeting",title:"Breakfast",who:"Ayla",charIds:["p_a"],withUser:true,day:2,period:"Morning",done:false,_unkeptLogged:true},
          {id:"cd",kind:"meeting",title:"Coffee",who:"Ayla",charIds:["p_a"],withUser:true,day:2,done:true,completedDay:2,result:"It was short."}]; },
      mem:c=>{ state.memory=[{id:"m1",ownerId:"p_a",universeId:uni.id,gameDay:2,date:Date.now()-5000,text:"She counted the till twice and said nothing."}]; },
      intentWarm:c=>{ c.intents=[{id:"i1",holderId:"p_a",targetId:"p_b",targetName:"Berk",valence:"warm",kind:"reach",aim:"to get him to stay",status:"open",strength:60}]; },
      intentHostile:c=>{ c.intents=[{id:"i1",holderId:"p_a",targetId:"p_b",targetName:"Berk",valence:"hostile",kind:"grudge",aim:"to make him pay",status:"open",strength:60}]; },
      intentSelf:c=>{ c.intents=[{id:"i1",holderId:"p_a",targetId:"p_b",targetName:"Berk",valence:"self_serving",kind:"ambition",aim:"to get his boat",status:"open",strength:60}]; },
      intentAway:c=>{ c.intents=[{id:"i1",holderId:"p_a",targetId:"__user__",targetName:"Emre",valence:"warm",kind:"crush",aim:"to be asked out",status:"open",strength:60}]; },
      wants2:c=>{ c.intents=[{id:"i1",holderId:"p_a",targetId:"__user__",targetName:"Emre",valence:"hostile",kind:"grudge",aim:"to see him fail.",status:"open",strength:70},
        {id:"i2",holderId:"p_a",targetId:"p_c",targetName:"Cem",valence:"self_serving",kind:"ambition",aim:"to borrow his van",status:"open",strength:50}]; },
      motiveAside:c=>{ c.intents=[{id:"i1",holderId:"p_a",targetId:"__user__",targetName:"Emre",valence:"warm",kind:"crush",aim:"to be asked out",status:"open",strength:20},
        {id:"i2",holderId:"p_a",targetId:"p_b",targetName:"Berk",valence:"warm",kind:"reach",aim:"to get him to stay",status:"open",strength:90}]; },
      liveGoals:c=>{ state.personas[0].goalsLive={lines:["Get the shop keys","Avoid Berk's debt"]}; },
      outfits:c=>{ state.personas[0].outfits={byLoc:{l_home:"a soft cardigan",l_bar:"a black dress"},home:{},userHome:{}}; },
      afterheat:c=>{ state.personas[0].afterHeatBy={Emre:{text:"It will not happen again.",chatId:c.id}}; },
      limits:c=>{ c.spokenLimits={p_a:[{text:"Not tonight.",kind:"limit",about:"staying over",day:c.gameDay,period:"Evening",expires:"day"},
        {text:"I will call you.",kind:"commitment",day:c.gameDay,period:"Evening",expires:"until_changed"}]}; },
      flags:c=>{ c.messages[1].replyFlags=["character","player","repeat","continuity"]; c.messages.push({mid:"u9",role:"user",content:'"Well?"'}); },
      flag1:c=>{ c.messages[1].replyFlags=["repeat"]; c.messages.push({mid:"u9",role:"user",content:'"Well?"'}); },
      whereabouts:c=>{ c.dayLog={day:c.gameDay,by:{p_a:[{period:"Morning",place:"Harbour Bar",with:["Berk"],what:"argued about money"},{period:"Afternoon",place:"The market"}]}}; },
      learned:c=>{ state.personas[0].socialFacts={p_b:{text:"has stopped answering the phone",day:2}}; },
      everyone:c=>{ state.relScope="everyone"; },
      fmt:c=>{ state.formatRules="Write in first person. Keep it short, {{char}}."; },
      fmtHead:c=>{ state.formatRules="# MY RULES\nWrite in first person."; },
      stalled:c=>{ c.messages=[{mid:"u1",role:"user",content:'"Give me the key."'},{mid:"a1",role:"assistant",speaker:"Ayla",speakerId:"p_a",content:'"No. *She folds her arms.* Not the key."'},
        {mid:"u2",role:"user",content:'"Give me the key."'},{mid:"a2",role:"assistant",speaker:"Ayla",speakerId:"p_a",content:'"No. *She folds her arms.* Not the key."'},
        {mid:"u3",role:"user",content:'"Give me the key."'},{mid:"a3",role:"assistant",speaker:"Ayla",speakerId:"p_a",content:'"No. *She folds her arms.* Not the key."'},
        {mid:"u4",role:"user",content:'"Give me the key."'}]; },
      nouser:c=>{ state.userBio=""; state.userLook=""; setWearingOverride(c,"__user__",""); },
      bare:c=>{ const p=state.personas[0]; ["backstory","traits","goals","wardrobe","instructions","scenario"].forEach(k=>delete p[k]); p.relationships={}; uni.setting=""; },
      asks:c=>{ const a={}; fragList().forEach(f=>(f.options||[]).forEach(o=>{ if(o.ask)a["q_"+f.id+"__"+o.id]=1; }));
        c.emo.p_a={emotion:"Anger",intensity:"intense",tone:"cold",ego:"id_ahead",asks:a}; state.personas[0].styleEmoBy={all:{Anger:"Clipped, cold."}}; },
      carry:c=>{ store.setRaw(K.fragAdds,FRAG_SHIPPED_ADDS.map(a=>a.key).filter(k=>!/^v150\.59/.test(k)).join(","));
        state.blockTpls={rp_task:"You are {{char}}. A custom task line.",scene_present:"PRIVACY CUSTOM: {{names}} with {{target}}, nobody else.",
          consistency_repeat:"REPEAT CUSTOM for {{self}}.",intent_warm:"# CUSTOM WARM TOWARD {{target}}\nYou want {{aim}} ({{a_kind}}).{{aside}}",
          limits_header:"# CUSTOM LIMITS\nWhat {{self}} said.",text_format:"# CUSTOM TEXT FORMAT\nType to {{user}} as {{char}}.",
          already_said_which_last:"the most recent thing you said",scene_intro:"Custom intro: this is where you are.",
          heat_breaks_voiced:"### CUSTOM BREAKS\nBreak with sounds.",world_header:"# THE WORLD",bio_behave_self:"How you act:",
          heat_format:BLOCK_TPL_DEFAULTS.heat_format.replace("## YOU KNOW WHAT IS HAPPENING","## YOU KNOW EXACTLY WHAT IS HAPPENING").replace("Write this beat and STOP.","Write this beat, then STOP.")}; },
      ovr:c=>{ state.blockTpls={rel_header:"# PEOPLE\nMy own wording about ties.",task:"# TASK\nCustom task for {{char}}."}; },
      relOn:c=>{ state.relOn=true; const o=relObj(c,"p_a","__user__"); o.desc="She has never forgiven him."; o.affection=10; o.trust=5; o.respect=20; o.familiarity=60;
        o.st.desire=60; o.st.agitation=20; o.stNote="Keep answering him, but stand further away."; o.stNoteAt=c.messages.length; o.stNoteDay=c.gameDay; c.rel[relDirKey("p_a","__user__")]=o; }
    };
    window.__S=S; window.__base=base;
    window.__build=(kind,o,dataOnly)=>{
      o=o||{}; const c=base();
      if(kind==="heat")S.heat(c); (o.s||[]).forEach(k=>S[k](c));
      if(kind==="text")c.messages.forEach(m=>{ if(!m.sceneBeat&&!m.presenceNote){ m.textMsg=true; m.textWith="p_a"; } });
      const p=state.personas[0], others=presentCast(c).filter(x=>x.id!==p.id);
      const tId=("targetId" in o)?o.targetId:"__user__", tName=o.targetName||"Emre";
      const inj=(o.s||[]).indexOf("mem")>=0?{recent:[{id:"r1",ownerId:"p_a",gameDay:3,text:"He asked where she had been."}],diary:[],longterm:[{id:"d1",ownerId:"p_a",gameDay:1,text:"Her father left on a boat."}]}:{recent:[],diary:[],longterm:[]};
      const hopts={chat:c,targetName:tName,targetId:tId,textMode:kind==="text",payloadKind:kind};
      const topts={chat:c,selfP:p,selfId:p.id,selfName:p.name,targetName:("tail" in o)?o.tail:tName,targetId:tId,multi:kind==="multi",
        injected:inj,textMode:kind==="text",payloadKind:kind};
      const mk=()=>Object.assign({},buildCharPromptBlocks(p,others,inj,o.addressed||null,hopts),buildTailBlocks(topts));
      const B=mk();
      if(dataOnly){ const r=dataOnly(B,mk); state.relScope=undefined; state.formatRules=undefined; return r; }
      const m=ptBuildMessages(kind,B,[{role:"user",content:"(history)"}],{chat:c,npc:p,targetName:tName},mk)||[];
      state.relScope=undefined; state.formatRules=undefined;
      return m.map(x=>"<<"+x.role+">>\n"+x.content).join("\n\n");
    };
    const SIT=[["player",{}],["cont",{s:["cont"]}],["char",{targetId:"p_b",targetName:"Berk"}],["char_cont",{targetId:"p_b",targetName:"Berk",s:["cont"]}],
      ["rich",{s:["rich"]}],["spent",{s:["spent"]}],["markup",{s:["markup"]}],["markup_voiced",{s:["markup","voiced"]}],["voiced",{s:["voiced"]}],
      ["absent",{s:["absent"]}],["notyours",{s:["notyours"]}],["since",{s:["since"]}],["notarget",{tail:""}],
      ["arriving",{addressed:"arriving",s:["event"]}],["arriving_plain",{addressed:"arriving"}],["leaving",{addressed:"leaving"}],["opener",{s:["opener"]}],
      ["gone",{targetId:null,targetName:"Cem"}],
      ["home",{s:["home"]}],["home_char",{s:["home"],targetId:"p_b",targetName:"Berk"}],["bar",{s:["bar"]}],["guest",{s:["guest"]}],["apart",{s:["apart"]}],["changed",{s:["changed"]}],
      ["trackers",{s:["trackers"]}],["trackers_own",{s:["trackersOwn"]}],["cal",{s:["cal"]}],["mem",{s:["mem"]}],
      ["intent_warm",{s:["intentWarm"]}],["intent_hostile",{s:["intentHostile"],targetId:"p_b",targetName:"Berk"}],["intent_self",{s:["intentSelf"]}],["intent_away",{s:["intentAway"]}],
      ["live_goals",{s:["liveGoals","intentAway"]}],["outfits",{s:["outfits","home"]}],["afterheat",{s:["afterheat"]}],["limits",{s:["limits"]}],
      ["flags",{s:["flags"]}],["flag1",{s:["flag1"]}],["whereabouts",{s:["whereabouts"]}],["learned",{s:["learned"]}],["everyone",{s:["everyone","learned"]}],
      ["fmt",{s:["fmt"]}],["fmt_head",{s:["fmtHead"]}],["narr",{s:["narr","fmt"]}],["stalled",{s:["stalled"]}],["nouser",{s:["nouser"],targetId:"p_b",targetName:"Berk"}],
      ["bare",{s:["bare"]}],["asks",{s:["asks","intentWarm"]}],["wants2",{s:["wants2"]}],["motive_aside",{s:["motiveAside","asks"]}],["motive_self",{s:["intentSelf","asks"],targetId:"p_b",targetName:"Berk"}],["asks_char",{s:["asks","intentHostile","rich","cal"],targetId:"p_b",targetName:"Berk"}],
      ["carry",{s:["carry","home","flag1","intentWarm","asks","limits","cont"]}],["carry_char",{s:["carry","home","flag1","intentWarm","asks","limits","voiced"],targetId:"p_b",targetName:"Berk"}],["ovr",{s:["ovr"]}],["relon",{s:["relOn"]}],
      ["all",{s:["rich","home","trackers","cal","mem","intentWarm","afterheat","limits","flags","whereabouts","learned","liveGoals","voiced"]}],
      ["all_cont",{s:["rich","home","trackers","cal","mem","intentWarm","afterheat","limits","flag1","whereabouts","cont","markup"]}],
      ["all_char",{s:["spent","home","trackers","cal","mem","intentHostile","limits","outfits"],targetId:"p_b",targetName:"Berk"}]];
    window.__SIT=SIT;
  });

  console.log("\n[every call brings in data only]");
  /* The shipped wording is every BLOCK_TPL_DEFAULTS text, cut at its placeholders; a run of 26 characters or more of it
     inside a called value is wording that came in through a call. One exception, and it is per entry, not a heading:
     a plan with no stated reason says so on its own line (calendar_no_reason) — the fragment model has no loop to write
     one note per entry, so the entry carries it. */
  const D=await pg.evaluate(()=>{
    const names=new Set(); FRAG_DEFAULTS.forEach(f=>{ JSON.stringify(f).replace(/\{\{call\/\/([a-zA-Z0-9_]+(?:\/\/[a-zA-Z0-9_]+)?)\}\}/g,(m,k)=>names.add(k)); });
    const ALLOW={calendar_no_reason:/^plans_[a-z]+_raw$/};
    const segs=[]; Object.keys(BLOCK_TPL_DEFAULTS).forEach(k=>String(BLOCK_TPL_DEFAULTS[k]).split(/\{\{[^}]*\}\}|\[\[[^\]]*\]\]/).forEach(x=>{ x=x.trim(); if(x.length>=26)segs.push([k,x]); }));
    // and the labels code used to write around the data, now in the fragments
    ["True of this story, and known to everyone:","Private to you — act on these","What anyone around can see","UNKEPT — meetings","⏰ HAPPENING NOW:","ITS HOUR HAS PASSED TODAY","FURTHER OFF:"].forEach(x=>segs.push(["code",x]));
    const bad=new Set(); let n=0, filled=0;
    ["solo","multi","gm","text","heat"].forEach(k=>__SIT.forEach(([nm,o])=>{ n++;
      __build(k,o,(B,mk)=>{ const srcs=ptSources(B,mk);
        names.forEach(c=>{ const pp=c.split("//"); const v=String(ptResolve(srcs,pp[0],pp[1],null)||""); if(v.trim())filled++;
          segs.forEach(([key,x])=>{ if(v.indexOf(x)>=0&&!(ALLOW[key]&&ALLOW[key].test(c)))bad.add(c+" ⊃ "+key+" ("+k+"_"+nm+")"); }); }); return ""; }); }));
    return {n,filled,names:names.size,bad:[...bad]}; });
  ok("in "+D.n+" situations, every one of the "+D.names+" names the shipped fragments call brings in data only", D.n>=250&&D.filled>2000&&D.bad.length===0, D.bad.slice(0,8).join("\n        "));
  ok("no shipped fragment calls a worded piece any more: only *_raw data, the authored text, lists and memories", await pg.evaluate(()=>{
      const data=new Set(["scenario","others_list","mem_distant_entries","mem_recent_entries","mem_latest_entries","style_body","style_emotion","whereabouts_lines","rumor_carrier_list","calendar_done","quest_lines","after_heat"]);
      const bad=[]; FRAG_DEFAULTS.forEach(f=>JSON.stringify(f).replace(/\{\{call\/\/([a-zA-Z0-9_]+(?:\/\/[a-zA-Z0-9_]+)?)\}\}/g,(m,k)=>{ if(!/_raw$/.test(k)&&!data.has(k))bad.push(f.id+": "+k); }));
      const raw=new Set(); FRAG_DEFAULTS.forEach(f=>JSON.stringify(f).replace(/\{\{call\/\/([a-z0-9_]+_raw)\}\}/g,(m,k)=>raw.add(k)));
      const unknown=[...raw].filter(k=>RAW_DATA_KEYS.indexOf(k)<0), known=ptKnownNames(), unlisted=RAW_DATA_KEYS.filter(k=>!known[k]);
      const ORDERS=[].concat(RT_ORDER,RG_ORDER,DRIVE_FRAGS,YB_ORDER,OP_ORDER,SS_ORDER,LL_ORDER,AS_ORDER,PR_ORDER,PRE_ORDER,MEM_FRAGS,PL_ORDER,SI_ORDER,SD_ORDER,PI_ORDER,FE_ORDER,FN_ORDER,RU_ORDER,QU_ORDER,WA_ORDER,WN_ORDER,TT_ORDER);
      const printed=RAW_DATA_KEYS.filter(k=>ORDERS.indexOf(k)>=0);
      return (!bad.length&&!unknown.length&&!unlisted.length&&!printed.length&&raw.size>=80)?true:JSON.stringify({bad,unknown,unlisted,printed,n:raw.size}); }));
  ok("every rewritten piece's wording is in the fragment that took it, word for word (so a rewrite of it can be carried)", await pg.evaluate(()=>{
      const miss=[];
      FRAG_TPL_CARRY.forEach(c=>{ const f=FRAG_DEFAULTS.find(x=>x.id===c.frag); if(!f){ miss.push(c.key+" → "+c.frag+" (no fragment)"); return; }
        if(c.key==="scene_day")return;   // written with an {{if}} for an empty period: carried best effort
        let d=String(BLOCK_TPL_DEFAULTS[c.key]||""); Object.keys(c.map||{}).forEach(k=>{ d=d.split("{{"+k+"}}").join(c.map[k]); });
        let parts=[d]; (c.split||[]).forEach(k=>{ parts=[].concat(...parts.map(x=>x.split("{{"+k+"}}"))); });
        const all=JSON.stringify(f); parts.map(x=>x.trim()).filter(x=>x.length>=12).forEach(x=>{ if(all.indexOf(JSON.stringify(x).slice(1,-1))<0)miss.push(c.key+" → "+c.frag+": «"+x.slice(0,50)+"»"); }); });
      return (!miss.length&&FRAG_TPL_CARRY.length>=50)?true:miss.slice(0,6).join(" | "); }));

  console.log("\n[what the converted fragments say, path by path]");
  const P=await pg.evaluate(()=>{ const g=(k,o)=>__build(k,o||{}); const all={s:["rich","home","trackers","cal","mem","intentWarm","afterheat","limits","flags","whereabouts","learned","liveGoals","voiced"]};
    return {solo:g("solo",all),multi:g("multi",{s:["apart","limits"],targetId:"p_b",targetName:"Berk"}),gm:g("gm",{s:["guest","wants2"]}),text:g("text",all),heat:g("heat",all),
      heatLast:g("heat",{s:["lastbeat","trackersOwn"]}),changed:g("solo",{s:["changed"]}),bar:g("solo",{s:["bar"]}),aside:g("solo",{s:["motiveAside","asks"]}),hostile:g("multi",{s:["intentHostile","asks"],targetId:"p_b",targetName:"Berk"}),
      cont:g("solo",{s:["cont"]}),player:g("solo",{})}; });
  ok("solo: the task, the world, the identity sheet with its rules and live goals, the ties with what was found out",
    /^<<system>>\nYou are Ayla\.\n\n# TASK\nYou live as Ayla/.test(P.solo)&&/# UNIVERSE SETTING\nA rainy port town/.test(P.solo)&&/# THIS IS WHO YOU ARE\n\n<backstory>Grew up by the docks\.<\/backstory>/.test(P.solo)
    &&/<how_you_behave>Rules for how you act[^\n]*\n    When pushed, she pushes back\./.test(P.solo)&&/<goals_and_ambitions>\n    What you are actually after[^\n]*\n    - Get the shop keys/.test(P.solo)
    &&/<wardrobe>What you usually wear \([^)]*\): A green raincoat\.<\/wardrobe>/.test(P.solo)&&/# WHO THESE PEOPLE ARE TO YOU[\s\S]*What you have found out about them since[^\n]*\n- Berk — has stopped answering the phone\n\n• \[Emre — neighbour\]/.test(P.solo), P.solo.slice(0,1800));
  ok("solo: the scene in her own home, privacy with Berk and Deniz nearby, plans by group, the limits, the four consistency notes",
    /# SCENE RIGHT NOW\n+This is your live situation\.[\s\S]*CURRENT DAY: Day 3, Evening\n\n⚠️ YOUR CURRENT LOCATION: Ayla's Flat — specifically the Kitchen\. THIS IS WHERE YOU ARE RIGHT NOW\. ⚠️\n\nThis place is YOUR home/.test(P.solo)
    &&/SUB-AREAS of Ayla's Flat: Entrance; Kitchen; Balcony\./.test(P.solo)&&/# PRIVACY — WHO CAN HEAR YOU\n+PRIVACY: you are NOT alone with Emre\. Others are in the room[^\n]*: Berk — my older brother\./.test(P.solo)
    &&/Not in this room, but elsewhere in Ayla's Flat: Deniz \(in the Balcony\)\./.test(P.solo)&&/How exposed the area you are standing in is: [^\n]+\./.test(P.solo)
    &&/# YOUR FUTURE ARRANGEMENTS\n[^\n]*\n\nUNKEPT — meetings that were planned but did NOT happen[^\n]*: Breakfast/.test(P.solo)&&/\n\nTODAY: Dinner/.test(P.solo)&&/\n\nFURTHER OFF: The wedding/.test(P.solo)
    &&/# WHAT YOU HAVE SAID ABOUT HOW FAR THIS GOES\n[^\n]*\n- limit: "Not tonight\."/.test(P.solo)
    &&/LAST TIME YOU SLIPPED OUT OF CHARACTER[\s\S]*LAST TIME YOU WROTE Emre'S PART[\s\S]*LAST TIME YOU REPEATED YOURSELF[\s\S]*LAST TIME YOU LOST TRACK/.test(P.solo), (P.solo.match(/# SCENE RIGHT NOW[\s\S]{0,1600}/)||[""])[0]);
  ok("multi: apart from everyone, in the balcony", /PRIVACY: you are at Balcony, apart from everyone else\./.test(P.multi), (P.multi.match(/# PRIVACY[\s\S]{0,300}/)||[""])[0]);
  ok("gm: a guest at Emre's, alone with him; two quiet wants, each worded by its own kind",
    /This place is Emre's home — Emre lives here and you do not\. You are a GUEST/.test(P.gm)&&/PRIVACY: you are ALONE with Emre — nobody else/.test(P.gm)
    &&/<what_you_quietly_want>Privately, you are set on something concerning Emre: to see him fail \(a grudge\)\.[^\n]*\nPrivately, you want something out of Cem: to borrow his van \(an ambition\)\.[^\n]*<\/what_you_quietly_want>/.test(P.gm), (P.gm.match(/<what_you_quietly_want>[\s\S]{0,500}/)||[""])[0]);
  ok("a public place, alone with the player; what just changed, item by item",
    /But this is a PUBLIC place/.test(P.bar)&&/How exposed this place is: /.test(P.bar)&&/⚠️ WHAT JUST CHANGED[^\n]*\n\n- You have just MOVED\. You are now at Ayla's Flat — a moment ago you were at Harbour Bar\./.test(P.changed)
    &&/- Time has just JUMPED forward — it is now Day 3, Evening \(the next day\)\./.test(P.changed)&&/- Just LEFT the scene: Deniz\./.test(P.changed)&&!/Just ARRIVED/.test(P.changed), (P.changed.match(/WHAT JUST CHANGED[\s\S]{0,900}/)||[""])[0]);
  ok("text: the texting format written out, the texter's own place, privacy of a text",
    /# FORMAT — YOU ARE TEXTING \(this reply only\)\nEmre has sent you a message on your phone/.test(P.text)&&/WHERE YOU ARE right now, while you type this: Ayla's Flat\./.test(P.text)
    &&/# PRIVACY — WHO CAN HEAR YOU\n+Nobody can overhear a text\. Whatever you would only say to Emre/.test(P.text)&&!/SUB-AREAS/.test(P.text), (P.text.match(/# FORMAT[\s\S]{0,300}/)||[""])[0]);
  ok("heat: its format with the sound breaks and this beat's thought, beat 2 of 5 still going; the trackers by group",
    /# FORMAT — HEAT OF THE MOMENT \(this reply only\)[\s\S]*MANY separate short lines rather than a few long ones, 6 or more/.test(P.heat)&&/### THE BREAKS ARE SOUNDS, NOT PUNCTUATION/.test(P.heat)&&!/THE BREAKS ARE IN THE WORDS/.test(P.heat)
    &&/### THIS BEAT'S THOUGHT:/.test(P.heat)&&/This is beat 2 of 5, in a run that is still going — the next beat is generated separately, after this one lands\. Write this beat and STOP\./.test(P.heat)
    &&/# YOUR WOMAN BIOLOGY\n\nTrue of this story, and known to everyone:\n\[ Trust: 20\/100 \]\n\nPrivate to you — act on these; nobody else can see them:\n\[ Cycle: You are fertile this week\. \]/.test(P.heat), (P.heat.match(/# YOUR WOMAN BIOLOGY[\s\S]{0,300}/)||[""])[0]);
  ok("heat, the last beat: silent breaks, 'the LAST beat'; her own tracker alone needs no sub-heading",
    /THE BREAKS ARE IN THE WORDS/.test(P.heatLast)&&/This is beat 5 of 5, and it is the LAST beat of this run — after it the turn goes back to Emre\./.test(P.heatLast)
    &&/# YOUR WOMAN BIOLOGY\n\n\[ Cycle: You are fertile this week\. \]/.test(P.heatLast)&&!/Private to you/.test(P.heatLast), (P.heatLast.match(/# YOUR WOMAN BIOLOGY[\s\S]{0,200}/)||[""])[0]);
  ok("the private motive, worded by its kind, with the aside when the turn is aimed at someone else",
    /# WHAT YOU ARE QUIETLY AFTER WITH Berk\nYou privately hold a growing warmth toward Berk, who is here now — a reach, and what you actually want out of it is this: to get him to stay\.[^\n]*\nThis turn is aimed at Emre, not at Berk/.test(P.aside)
    &&/# WHAT YOU ARE QUIETLY AFTER WITH Berk\nYou privately hold a grudge toward Berk/.test(P.hostile)&&!/This turn is aimed at/.test(P.hostile), (P.aside.match(/QUIETLY AFTER[\s\S]{0,600}/)||[""])[0]);
  ok("what you already said: the label picked by carrying on or not, then the line", /\(your last line, word for word — said and spent\.[^)]*\) "Hello\."/.test(P.player)
    &&/\(the line before the one quoted above, word for word — said and spent\.[^)]*\) "Hello\."/.test(P.cont)&&!/\\u2014/.test(P.player), (P.player.match(/YOU ALREADY SAID[\s\S]{0,1400}/)||[""])[0].slice(-300));
  ok("no placeholder, condition or marker is left in any payload", await pg.evaluate(()=>{ const left=[];
      ["solo","multi","gm","text","heat"].forEach(k=>__SIT.forEach(([n,o])=>{ if(/\{\{|\[\[/.test(__build(k,o)))left.push(k+"_"+n); })); return left.length?left.slice(0,8).join(", "):true; }));

  console.log("\n[a path's text adds under the main body]");
  ok("the main body, a blank line, then the path's own text; a path without one gets the main body; an empty main body leaves the path text alone",
    await pg.evaluate(()=>{ const f={text:"MAIN",byPath:{heat:"HEAT ADD"}}, g={text:"",byPath:{text:"ONLY TEXT"}};
      return (_fragTextFor(f,"heat")==="MAIN\n\nHEAT ADD"&&_fragTextFor(f,"solo")==="MAIN"&&_fragTextFor(g,"text")==="ONLY TEXT"&&_fragTextFor(g,"solo")==="")?true:JSON.stringify([_fragTextFor(f,"heat"),_fragTextFor(g,"text")]); }));
  ok("the shipped fragments hold the shared part once: the guardrails' shared rules are the main body, text and heat add only theirs", await pg.evaluate(()=>{
      const f=FRAG_DEFAULTS.find(x=>x.id==="guardrails"), t=FRAG_DEFAULTS.find(x=>x.id==="talk_into");
      return (/^# FINAL GUARDRAILS\n\nNothing you were given about yourself/.test(f.text)&&/^This is a typed message/.test(f.byPath.text)&&/^Dialogue-dense/.test(f.byPath.heat)
        &&!/Nothing you were given/.test(f.byPath.text+f.byPath.heat)&&Object.keys(f.byPath).sort().join()==="heat,text"
        &&/WHEN SOMEONE TRIES TO TALK YOU INTO IT/.test(t.text)&&!/WHEN SOMEONE TRIES/.test(JSON.stringify(t.options)))?true:JSON.stringify({main:f.text.slice(0,60),bp:Object.keys(f.byPath)}); }));
  // v150.59 — no path box repeats another path's text: memories and compass word their one difference with {{if}}, format
  // picks spoken / texting / heat with options
  ok("no shipped fragment repeats the same text in two path boxes; memories, compass and format have no path boxes", await pg.evaluate(()=>{
      const dup=[]; FRAG_DEFAULTS.forEach(f=>{ [f].concat(f.options||[]).forEach(x=>{ const v=Object.values(x.byPath||{}); if(new Set(v).size<v.length)dup.push(f.id+"/"+(x.id||"")); }); });
      const g=id=>FRAG_DEFAULTS.find(x=>x.id===id), none=["memories","compass","format"].filter(id=>Object.keys(g(id).byPath||{}).length);
      const fo=g("format").options.slice(0,3).map(o=>o.id+":"+o.code).join("|");
      return (!dup.length&&!none.length&&fo==="spoken:render_mode = solo or render_mode = multi or render_mode = gm|texting:render_mode = text|heat:render_mode = heat"
        &&/\{\{if render_mode = solo\}\}/.test(g("memories").text)&&/\{\{if render_mode = solo\}\}/.test(g("compass").text))?true:JSON.stringify({dup,none,fo}); }));
  ok("format: each path gets its own format and no other", await pg.evaluate(()=>{
      const c=k=>{ const fl=ptCondFlags({render_mode:k,voicing:false,heat_narr:"physical"}); return ptResolveConds(fragCompile(k,fl,{}),fl); };
      const s=c("solo"), g=c("gm"), t=c("text"), h=c("heat");
      return (/THE THREE CHANNELS/.test(s)&&!/Default; a reply that is only speech/.test(s)&&/Default; a reply that is only speech/.test(g)
        &&/YOU ARE TEXTING/.test(t)&&!/THE THREE CHANNELS/.test(t)&&/HEAT OF THE MOMENT/.test(h)&&!/THE THREE CHANNELS/.test(h)&&!/YOU ARE TEXTING/.test(h+s))?true:"format leaks"; }));

  console.log("\n[a saved list]");
  const M=await pg.evaluate(()=>{
    const replaceMeaning=(x,p)=>{ const b=x.byPath&&x.byPath[p]; return (b!=null&&String(b).trim()!=="")?String(b):String(x.text||""); };
    const old=()=>FRAG_DEFAULTS.map(f=>JSON.parse(JSON.stringify(FRAG_DEFAULTS_V150_58[f.id]||f)));
    const r={};
    // 1. untouched v150.58 defaults, an edited guardrails (replace-style path texts), and a rewritten piece
    const L0=old(); const gi=L0.findIndex(f=>f.id==="guardrails"); L0[gi].text+="\n\nMINE ON EVERY SPOKEN PATH.";
    const mi=L0.findIndex(f=>f.id==="memories"); L0[mi].byPath.heat="# MY HEAT MEMORIES\n{{call//mem_recent_entries}}";
    const before={}; ["solo","text","heat"].forEach(p=>{ before["g_"+p]=replaceMeaning(L0[gi],p); before["m_"+p]=replaceMeaning(L0[mi],p); });
    state.blockTpls={rp_task:"You are {{char}}. MY OWN TASK.",scene_present:"PRIVACY MINE: {{names}}, with {{target}}."};
    state.fragments=L0; store.setRaw(K.fragAdds,"limits,already_said,guardrails.consistency,v150.57.format"); _fragMigratedFor=null;
    const L=fragList();
    const same=id=>_fragCanon(L.find(f=>f.id===id))===_fragCanon(FRAG_DEFAULTS.find(f=>f.id===id));
    r.replaced=["world","bio","ties","format","scene_now","arrangements","motive","limits","biology","delivery","compass"].every(same);
    r.carried=/MY OWN TASK/.test(L.find(f=>f.id==="task").text)&&/PRIVACY MINE: \{\{call\/\/privacy_names_raw\}\}, with \{\{user\}\}\./.test(JSON.stringify(L.find(f=>f.id==="privacy")));
    r.keptEdited=/MINE ON EVERY SPOKEN PATH/.test(JSON.stringify(L[gi]))&&/MY HEAT MEMORIES/.test(JSON.stringify(L[mi]));
    r.lossless=["solo","text","heat"].every(p=>_fragTextFor(L[gi],p).trim()===before["g_"+p].trim()&&_fragTextFor(L[mi],p).trim()===before["m_"+p].trim());
    r.gMain=L[gi].text; r.done=["v150.59.format","v150.59.bypath"].every(k=>String(store.raw(K.fragAdds,"")).split(",").indexOf(k)>=0);
    r.saved=/MY OWN TASK/.test(String(store.raw(K.fragments,"")));
    // and the payload: the edited guardrails on solo, not on text; the carried task and privacy
    window.__frags=L; const solo=__build("solo",{s:["home"]}), text=__build("text",{}); window.__frags=null;
    r.payload=/MINE ON EVERY SPOKEN PATH/.test(solo)&&!/MINE ON EVERY SPOKEN PATH/.test(text)&&/typed message/.test(text)&&/You are Ayla\. MY OWN TASK\./.test(solo)&&/PRIVACY MINE: Berk — my older brother, with Emre\./.test(solo);
    // 2. once: a second load changes nothing
    const snap=JSON.stringify(state.fragments); _fragMigratedFor=null; fragList(); r.once=JSON.stringify(state.fragments)===snap;
    // 3. a path text that adds to its main body keeps the main body (the "starts with it" case)
    const x={text:"A\n\nB",byPath:{heat:"A\n\nB\n\nC"}}; _fragByPathToAdd(x,["solo","heat"]); r.prefix=x.text==="A\n\nB"&&x.byPath.heat==="C"&&!("solo" in x.byPath);
    const y={text:"A",byPath:{heat:"Z"}}; _fragByPathToAdd(y,["solo","heat"]); r.noPrefix=y.text===""&&y.byPath.solo==="A"&&y.byPath.heat==="Z";
    const z={text:"AB",byPath:{heat:"AB\nC"}}; _fragByPathToAdd(z,["solo","heat"]); r.noBlank=z.text===""&&z.byPath.heat==="AB\nC";   // no blank line after the main body: not split
    state.fragments=null; _fragMigratedFor=null; store.setRaw(K.fragments,""); state.blockTpls={};
    return r; });
  ok("an untouched v150.58 fragment is replaced by today's, a piece the user rewrote goes in where its wording was, and it is saved",
    M.replaced&&M.carried&&M.done&&M.saved, JSON.stringify(M));
  ok("an edited fragment is the user's: its path texts now add under the main body, and every path gets exactly what it got before",
    M.keptEdited&&M.lossless&&M.gMain==="", JSON.stringify(M));
  ok("…and the reply says it: the edit on the spoken paths only, the task and the privacy line as the user wrote them", M.payload, JSON.stringify(M));
  ok("both run once", M.once, JSON.stringify(M));
  ok("the conversion keeps a main body every path starts with, and splits only at a blank line", M.prefix&&M.noPrefix&&M.noBlank, JSON.stringify(M));
  ok("someone who never saved a list keeps a piece they rewrote: the shipped list is saved once with it carried in", await pg.evaluate(()=>{
      state.fragments=null; _fragMigratedFor=null; store.setRaw(K.fragments,""); store.setRaw(K.fragAdds,"");
      state.blockTpls={limits_header:"# MY LIMITS\nWhat {{self}} said."};
      const L=fragList(), lim=L.find(f=>f.id==="limits");
      const a=lim&&lim.text==="# MY LIMITS\nWhat {{self}} said.\n{{call//limits_lines_raw}}"&&L!==FRAG_DEFAULTS&&/MY LIMITS/.test(String(store.raw(K.fragments,"")));
      window.__frags=L; const p=__build("solo",{s:["limits"]}); window.__frags=null; const b2=/# MY LIMITS\nWhat Ayla said\.\n- limit: "Not tonight\."/.test(p);
      // nothing rewritten: nothing saved, the shipped list stays in use
      state.fragments=null; _fragMigratedFor=null; store.setRaw(K.fragments,""); store.setRaw(K.fragAdds,""); state.blockTpls={};
      const c=fragList()===FRAG_DEFAULTS&&(store.raw(K.fragments,"")||"")==="";
      return (a&&b2&&c)?true:JSON.stringify({a,b2,c,lim:lim&&lim.text}); }));

  console.log("\n[the editor]");
  ok("ticking a path opens an EMPTY box, labelled as added under the main body", await pg.evaluate(()=>{
      window.uiConfirm=async()=>true; _fragDraft=null; _fragOpen=null; state.fragments=null; show('settings'); renderFragEditor();
      const i=FRAG_DEFAULTS.findIndex(f=>f.id==="limits"); fragEdOpen(i);
      const host=document.getElementById('fragHost');
      const label=/Add text on a path:/.test(host.innerHTML);
      fragEdByPath(String(i),"heat",true);
      const ta=host.querySelector(`textarea[data-fp="${i}.byPath.heat"]`);
      const lab=/Heat[^<]*<\/b> — added under the main body on this path/.test(host.innerHTML)||/<b>[^<]+<\/b> — added under the main body on this path/.test(host.innerHTML);
      const r=(ta&&ta.value===""&&label&&lab&&!/replaces the text above/.test(host.innerHTML));
      fragEdByPath(String(i),"heat",false); _fragDraft=null; _fragOpen=null; renderFragEditor();
      return r?true:JSON.stringify({ta:ta&&ta.value.slice(0,40),label,lab}); }));
  ok("ticking leaves the screen where it was: the list's scroll and the page's scroll do not move", await pg.evaluate(async()=>{
      show('settings'); _fragDraft=null; _fragOpen=null; renderFragEditor();
      const card=document.getElementById('fragCard'); if(card&&card.tagName==="DETAILS")card.open=true;
      const i=FRAG_DEFAULTS.findIndex(f=>f.id==="respond_as"); fragEdOpen(i);
      const list=document.getElementById('fragList'); if(!list)return "no #fragList";
      list.scrollTop=Math.max(0,list.scrollHeight-list.clientHeight-200);
      document.getElementById('fragHost').scrollIntoView(); window.scrollBy(0,120);
      await new Promise(r=>setTimeout(r,50));
      const lt=list.scrollTop, wy=window.scrollY;
      const box=document.getElementById('fragHost').querySelector(`input[type=checkbox][onchange^="fragEdByPath('${i}','heat'"]`); if(!box)return "no path checkbox";
      box.click(); await new Promise(r=>setTimeout(r,50));
      const list2=document.getElementById('fragList');
      const r={lt,lt2:list2.scrollTop,wy,wy2:window.scrollY};
      _fragDraft=null; _fragOpen=null; renderFragEditor();
      return (lt>100&&Math.abs(r.lt2-lt)<=2&&Math.abs(r.wy2-wy)<=2)?true:JSON.stringify(r); }));
  ok("opening a fragment brings its row into view inside the list", await pg.evaluate(()=>{
      _fragDraft=null; _fragOpen=null; renderFragEditor(); const list=document.getElementById('fragList'); list.scrollTop=0;
      const i=FRAG_DEFAULTS.length-2; fragEdOpen(i); const row=document.getElementById('fragRow_'+i), l=document.getElementById('fragList');
      const rr=row.getBoundingClientRect(), lr=l.getBoundingClientRect(); const r=rr.top>=lr.top-1&&rr.top<=lr.bottom;
      _fragDraft=null; _fragOpen=null; renderFragEditor(); return r?true:JSON.stringify({row:rr.top,list:[lr.top,lr.bottom]}); }));

  ok("no page errors", errs.length===0?true:errs.join(" | "));
  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close(); process.exit(fail?1:0);
})();
