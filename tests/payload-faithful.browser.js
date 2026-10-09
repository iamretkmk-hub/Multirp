/* v150.64 — PAYLOAD FAITHFULNESS. Everything the reply fragments sent before v150.64 is still sent, on every path and in every
   situation, except what v150.64 removes on purpose: the quiet wants ("what you quietly want" — the private motives on the
   sheet) and the two compass lines whose cost became concrete (id_winning, id_ahead). What it adds is checked too: the
   feelings toward the one answered (the settled view in the head after the ties, the live charge in the tail before the
   compass), and nothing of it twice.
   The v150.63 payloads are in tests/fixtures/payload-v150.63.json as one hash per distinct line (whitespace collapsed), per
   path and situation, with the removed lines left out by the patterns below (REMOVED). They were written by this script
   against the v150.63 build:
       SM_FAITH_WRITE=1 SM_FAITH_INDEX=<v150.63 index.html> node tests/payload-faithful.browser.js
   The situations are the ones tests/fragment-wording.browser.js builds (same setup, copied), plus the feelings.
   v150.65 — ONE RELATIONSHIP SHEET. Two more changes on purpose (REMOVED_65): "What you have found out about them since" and
   its lines are gone from every payload, and, in the fragments, the one answered leaves the ties (their sheet line) and their
   old one-line <what_they_are_to_you> is rewritten to carry the whole entry. The v150.63 fixture was rewritten by the same
   command with those left out as well. And against the v150.64 build both ways (tests/fixtures/payload-v150.64.json: every
   line's hash, and which of them REMOVED_65 drops): every v150.64 line is still sent except those, and every line sent now
   was sent by v150.64 except inside the one answered's <what_they_are_to_you>. Written by
       SM_FAITH_WRITE=64 SM_FAITH_INDEX=<v150.64 index.html> node tests/payload-faithful.browser.js
   (Also v150.65: the "classic layout" builds were fragment builds, because the situation setup switched fragments back on;
   it built them from the classic templates, and both fixtures were written that way.)
   v150.66 — the fixtures' "classic:" payloads are no longer compared: the classic layout and the reply templates are gone, a
   reply is its fragments. Every fragment payload of both fixtures still is.
   v150.72 — the compass's id_winning / id_ahead lines and the heat guidance gain "your words stay your own" on purpose: each
   payload is also built with the v150.71 "Your inner compass" and "Guidance" (FRAG_DEFAULTS_V150_71_OLD), and the lines that
   differ are allowed in both comparisons and checked to be exactly those (see "[v150.72: only the words change]").
   v150.79 — a reply carries a live goal or a story thread only when the scene touches it. Each payload is also built with that
   switched off (state.pursuitRelevantOn=false: what the build before sent); the lines that go are allowed in both comparisons
   and checked to be exactly the story threads and the one live goal ("Get the shop keys") no line of these scenes touches —
   "Avoid Berk's debt" stays, Berk being here (see "v150.79: the only lines that go…").
   v150.81 — what a place looks like, and who is around. Each payload is also built as v150.80 sent it: the v150.80 "Scene right
   now" and "Privacy" fragments (FRAG_DEFAULTS_V150_80_OLD), the exposure label where the crowd words go (exposureLabel), and the
   areas by bare name. The lines that differ are allowed in both comparisons and checked to be exactly these (see "[v150.81:
   only the place lines change]"): the scene intro's "Who can hear you" line, the PRIVACY heading, the areas' earshot
   sentence, the "How exposed…" line (now who is around: crowded / a couple of people far off / nobody nearby), the
   alone-at-home and alone-in-public lines and the someone-in-another-room line without "can hear", and an empty private
   area marked "— empty, no one is there".
   Run: node tests/payload-faithful.browser.js   (needs playwright; see tests/README.md) */
const {chromium}=require('playwright');
const fs=require('fs'), path=require('path');
const FIX=path.resolve(__dirname,'fixtures','payload-v150.63.json');
const FIX64=path.resolve(__dirname,'fixtures','payload-v150.64.json');
const INDEX=process.env.SM_FAITH_INDEX||path.resolve(__dirname,'..','index.html');
const WRITE=process.env.SM_FAITH_WRITE||"";
// lines v150.64 removes on purpose: the quiet wants, and the two compass lines it rewrote
const REMOVED=[/what_you_quietly_want|^Privately, you (?:are working toward|are set on|want something out of)/,
  /^Right now your want has won over your conscience\. You know what it costs and you go anyway/,
  /^Right now your want is ahead of your conscience\. You are finding reasons, and the reasons are getting easier\.$/];
/* lines v150.65 removes or moves on purpose. Everywhere: what was found out (its heading and its one line here). In the
   fragments, for a reply with a target on record (tId): the target's own sheet line ("• [Emre — neighbour]") — their
   paragraph goes with them into <what_they_are_to_you> — and that block's old one-line form. Nothing else. */
const removed65=(l,classic,tId,tName)=>{
  if(/^What you have found out about them since\b/.test(l)||/^- (?:Berk — )?has stopped answering the phone$/.test(l))return true;
  if(classic||!tId)return false;
  if(l==="• ["+tName+"]"||l.indexOf("• ["+tName+" — ")===0)return true;
  return /^<what_they_are_to_you>What .+ is to you, in your own words: .+\. That, and what .+ is not yours to know\.<\/what_they_are_to_you>$/.test(l);
};
const norm=l=>String(l).replace(/\s+/g," ").trim();
const h=s=>{ let x=0x811c9dc5; for(let i=0;i<s.length;i++){ x^=s.charCodeAt(i); x=Math.imul(x,0x01000193)>>>0; } return x.toString(36); };
const linesOf=t=>[...new Set(String(t).split("\n").map(norm).filter(Boolean))];
(async()=>{
  const b=await chromium.launch({executablePath:process.env.SM_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  let pg=await b.newPage({viewport:{width:412,height:915}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  /* v150.65 — the page and the situations, as a function: the comparison against v150.64 runs on a fresh page, in the order
     it was written in (a text payload's "[here now]" reads the day's placement, which the builds before it leave on the chat) */
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x===undefined?c:x).slice(0,1200));} };
  const boot=async()=>{
  await pg.goto('file://'+INDEX); await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(800);

  await pg.evaluate(()=>{
    const uni=state.universes[0];
    const L1={id:"l_home",name:"Ayla's Flat",type:"home",residents:["p_a"],sublocations:[{id:"s1",name:"Entrance"},{id:"s2",name:"Kitchen"},{id:"s3",name:"Balcony",privacy:0.1}]};
    const L2={id:"l_bar",name:"Harbour Bar",type:"bar",residents:[],sublocations:[{id:"b1",name:"Entrance"}]};
    const L3={id:"l_emre",name:"Emre's House",type:"home",residents:[],sublocations:[{id:"e1",name:"Entrance"},{id:"e2",name:"Lounge"}]};
    uni.locations=[L1,L2,L3];
    const base=()=>{
      state.personas=[
        {id:"p_a",name:"Ayla",universeId:uni.id,personality:"Ayla is sharp.",backstory:"Grew up by the docks.",traits:"When pushed, she pushes back.\nWhen praised, she deflects.",likes:"Likes: strong tea, the harbour at dawn\nPet peeves: being rushed",
         goals:"Open her own shop.",look:{hair:"red hair",face:"freckles"},style:"Short, dry sentences.",instructions:"Hold the pause before answering.",
         wardrobe:"A green raincoat.",scenario:"The flat above the bakery, late.",
         relationships:{p_b:{tie:"my older brother",relationship:"Berk raised her after their father left."},__user__:{tie:"neighbour",relationship:"Emre lives across the hall."},p_c:{tie:"old friend",relationship:"Cem and she grew up together.",pinned:true}}},
        {id:"p_b",name:"Berk",universeId:uni.id,personality:"Berk is loud.",look:{hair:"black hair"},style:"Loud."},
        {id:"p_c",name:"Cem",universeId:uni.id,personality:"Cem is away.",look:{},style:"x"},
        {id:"p_d",name:"Deniz",universeId:uni.id,personality:"Deniz is quiet.",look:{},style:"y"}];
      state.user="Emre"; state.userBio="Emre is a carpenter."; state.userLook="Tall, grey eyes.";
      state.payloadTplOn=false; state.fragments=window.__frags||null; state.autoSpeak=false; state.narrMode=false; state.narrOn=false; state.gossip=[];
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
    /* v150.70 — the memories as v150.67 sent them, to tell what v150.70 changed on purpose from anything else: the v150.67
       "What you remember" and "What happened just before this" fragments (FRAG_DEFAULTS_V150_67_OLD), and their numbered
       entries ("Memory 1: This happened …"), which the worded blocks still carry word for word. */
    window.__oldMemBlocks=B=>{ const ent=t=>{ t=String(t||""); const i=t.indexOf("\n\n"); return i>=0?t.slice(i+2):""; };
      B._mem=Object.assign({},B._mem||{}); if(B.recent_memories)B._mem.mem_recent_entries=ent(B.recent_memories); if(B.distant_memories)B._mem.mem_distant_entries=ent(B.distant_memories);
      if(B.latest_arcs){ B._la=Object.assign({},B._la||{}); B._la.mem_latest_entries=ent(B.latest_arcs); }
      return B; };
    // the list this build would compile (fragList: the shipped one, or a copy carrying the situation's rewritten pieces), with the v150.67 memories
    window.__oldMemFrags=()=>fragList().map(f=>JSON.parse(JSON.stringify(FRAG_DEFAULTS_V150_67_OLD[f.id]||f)));
    // v150.72 — the same list with the v150.71 compass and guidance
    window.__old72Frags=()=>fragList().map(f=>JSON.parse(JSON.stringify(FRAG_DEFAULTS_V150_71_OLD[f.id]||f)));
    /* v150.81 — the same list with the v150.80 scene and privacy, where this build ships them unedited (a situation that carries
       the user's own rewritten pieces into them keeps its own, as the upgrade does) */
    window.__old81Frags=()=>fragList().map(f=>{ const d=FRAG_DEFAULTS.find(x=>x.id===f.id), o=FRAG_DEFAULTS_V150_80_OLD[f.id];
      if(!o||!d)return JSON.parse(JSON.stringify(f));
      if(_fragCanon(d)===_fragCanon(f))return JSON.parse(JSON.stringify(o));
      // the user's rewritten pieces carried into the shipped one: v150.80 had them carried into its own
      const dc=JSON.parse(JSON.stringify(d)); _fragCarryInto(dc);
      if(_fragCanon(dc)===_fragCanon(f)){ const oc=JSON.parse(JSON.stringify(o)), keep={};
        // carried as v150.80 carried it: against the v150.80 wording of the pieces v150.81 reworded
        Object.keys(BLOCK_TPL_V150_80_OLD).forEach(k=>{ keep[k]=BLOCK_TPL_DEFAULTS[k]; BLOCK_TPL_DEFAULTS[k]=BLOCK_TPL_V150_80_OLD[k]; });
        try{ _fragCarryInto(oc); } finally{ Object.keys(keep).forEach(k=>{ BLOCK_TPL_DEFAULTS[k]=keep[k]; }); }
        return oc; }
      return JSON.parse(JSON.stringify(f)); });
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
      const mk0=()=>Object.assign({},buildCharPromptBlocks(p,others,inj,o.addressed||null,hopts),buildTailBlocks(topts));
      // v150.70 — window.__oldMem: the same build as v150.67 sent its memories (see __oldMemBlocks)
      const mk=window.__oldMem?()=>__oldMemBlocks(mk0()):mk0;
      const B=mk();
      if(dataOnly){ const r=dataOnly(B,mk); state.relScope=undefined; state.formatRules=undefined; return r; }
      const m=ptBuildMessages(kind,B,[{role:"user",content:"(history)"}],Object.assign({chat:c,npc:p,targetName:tName},window.__oldMem?{fragments:__oldMemFrags()}:window.__old72?{fragments:__old72Frags()}:window.__old81?{fragments:__old81Frags()}:{}),mk)||[];
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

  /* the feelings, in situations of their own (no feelings fragment before v150.64, so nothing to compare: these check what
     was added). relOnChar: a character target; relSame: the settled view says what the tie paragraph says. */
  await pg.evaluate(()=>{
    __S.relOnChar=c=>{ state.relOn=true; const o=relObj(c,"p_a","p_b"); o.desc="You lean on him more than you admit."; o.trust=40; o.familiarity=70;
      o.st.fear=50; c.rel[relDirKey("p_a","p_b")]=o; };
    __S.relSame=c=>{ state.relOn=true; const o=relObj(c,"p_a","__user__"); o.desc="Emre lives across the hallway from you, and you see him nearly every single morning."; o.affection=10; o.familiarity=60;
      c.rel[relDirKey("p_a","__user__")]=o; state.personas[0].relationships.__user__.relationship="Emre lives across the hallway; you see him nearly every single morning."; };
    __S.relConsidered=c=>{ state.relOn=true; const o=relObj(c,"p_a","__user__"); o.desc=""; o.trust=50; o.affection=45; o.familiarity=40; c.rel[relDirKey("p_a","__user__")]=o; };
  });
  };
  await boot();
  const SITS=await pg.evaluate(()=>__SIT.map(x=>x[0]));
  const KINDS=["solo","multi","gm","text","heat"];
  const build=async(kind,name)=>pg.evaluate(([k,n])=>{ const o=(__SIT.find(x=>x[0]===n)||[0,{}])[1]; return __build(k,o); },[kind,name]);
  const fragKeys=P=>Object.keys(P).filter(key=>key.indexOf("classic:")!==0);   // v150.66 — the classic layout is gone
  /* v150.70 — what v150.70 changes on purpose, per payload: the same situation built with the v150.67 memories (window.__oldMem)
     against the build now. Only the memory lines may differ (checked below); they are what a fixture line may be missing for. */
  const buildOld=async(kind,name)=>pg.evaluate(([k,n])=>{ window.__oldMem=true; try{ const o=(__SIT.find(x=>x[0]===n)||[0,{}])[1]; return __build(k,o); } finally{ window.__oldMem=false; } },[kind,name]);
  const all68={gone:new Set(),added:new Set()};
  const diff68=async(k,nm,text)=>{ const old=linesOf(await buildOld(k,nm)), now=linesOf(text), O=new Set(old), N=new Set(now);
    const d={gone:old.filter(l=>!N.has(l)),added:now.filter(l=>!O.has(l))}; d.gone.forEach(l=>all68.gone.add(l)); d.added.forEach(l=>all68.added.add(l)); return d; };
  // v150.72 — the same, against the v150.71 compass and guidance
  const buildOld72=async(kind,name)=>pg.evaluate(([k,n])=>{ window.__old72=true; try{ const o=(__SIT.find(x=>x[0]===n)||[0,{}])[1]; return __build(k,o); } finally{ window.__old72=false; } },[kind,name]);
  const all72={gone:new Set(),added:new Set()};
  const diff72=async(k,nm,text)=>{ const old=linesOf(await buildOld72(k,nm)), now=linesOf(text), O=new Set(old), N=new Set(now);
    const d={gone:old.filter(l=>!N.has(l)),added:now.filter(l=>!O.has(l))}; d.gone.forEach(l=>all72.gone.add(l)); d.added.forEach(l=>all72.added.add(l)); return d; };

  /* v150.75 — a text payload no longer carries the outfit (it was chosen for the PLAYER's scene, and nobody in a thread sees it):
     the same situation built with the outfit kept (charBioBlock told to ignore noWear) against the build now. Only the outfit
     lines of the text path may differ (checked below). */
  const buildOld74=async(kind,name)=>pg.evaluate(([k,n])=>{ const real=window.charBioBlock;
    window.charBioBlock=function(c,o){ return real(c,Object.assign({},o||{},{noWear:false})); };
    try{ const o=(__SIT.find(x=>x[0]===n)||[0,{}])[1]; return __build(k,o); } finally{ window.charBioBlock=real; } },[kind,name]);
  const all74={gone:new Set(),added:new Set()};
  const diff74=async(k,nm,text)=>{ if(k!=="text") return {gone:[],added:[]}; const old=linesOf(await buildOld74(k,nm)), now=linesOf(text), O=new Set(old), N=new Set(now);
    const d={gone:old.filter(l=>!N.has(l)),added:now.filter(l=>!O.has(l))}; d.gone.forEach(l=>all74.gone.add(l)); d.added.forEach(l=>all74.added.add(l)); return d; };
  /* v150.79 — a reply carries a live goal or a story thread only when its scene touches it (its people here or named in the
     last lines, a key word of it in them, or why the character came): the same situation built with that switched off
     (state.pursuitRelevantOn=false, the build before v150.79) against the build now. Only goal and story-thread lines may
     differ, and only by going (checked below): a scene that does not touch a pursuit now leaves it out, on purpose. */
  const buildOld78=async(kind,name)=>pg.evaluate(([k,n])=>{ state.pursuitRelevantOn=false;
    try{ const o=(__SIT.find(x=>x[0]===n)||[0,{}])[1]; return __build(k,o); } finally{ state.pursuitRelevantOn=true; } },[kind,name]);
  const all78={gone:new Set(),added:new Set()};
  const diff78=async(k,nm,text)=>{ const old=linesOf(await buildOld78(k,nm)), now=linesOf(text), O=new Set(old), N=new Set(now);
    const d={gone:old.filter(l=>!N.has(l)),added:now.filter(l=>!O.has(l))}; d.gone.forEach(l=>all78.gone.add(l)); d.added.forEach(l=>all78.added.add(l)); return d; };
  /* v150.81 — as v150.80 sent it: the v150.80 scene and privacy fragments, the exposure label where privacy_exposure_raw now
     carries who is around, and the areas by bare name (no "— empty, no one is there"). */
  const buildOld81=async(kind,name)=>pg.evaluate(([k,n])=>{ const rk=window.crowdKey, ra=window.placeAreaNames;
    window.crowdKey=(l,c)=>{ const x=exposureLabel(l,c); CROWD_WORDS[x]=x; return x; };
    window.placeAreaNames=(c,l)=>((l&&l.sublocations)||[]).map(x=>x.name).join("; ");
    window.__old81=true;
    try{ const o=(__SIT.find(x=>x[0]===n)||[0,{}])[1]; return __build(k,o); } finally{ window.crowdKey=rk; window.placeAreaNames=ra; window.__old81=false; } },[kind,name]);
  const all81={gone:new Set(),added:new Set()};
  const diff81=async(k,nm,text)=>{ const old=linesOf(await buildOld81(k,nm)), now=linesOf(text), O=new Set(old), N=new Set(now);
    const d={gone:old.filter(l=>!N.has(l)),added:now.filter(l=>!O.has(l))}; d.gone.forEach(l=>all81.gone.add(l)); d.added.forEach(l=>all81.added.add(l)); return d; };
  // who each situation answers (null when the target is nobody on record), for removed65
  const TGT=await pg.evaluate(()=>{ const r={}; __SIT.forEach(([n,o])=>{ r[n]=[("targetId" in o)?o.targetId:"__user__",o.targetName||"Emre"]; }); return r; });
  const rm65=(l,classic,n)=>removed65(l,classic,TGT[n][0],TGT[n][1]);

  if(WRITE==="64"){
    const out={version:"v150.64",note:"per payload: all = one FNV-1a hash per distinct line (whitespace collapsed); drop = those removed65 in tests/payload-faithful.browser.js leaves out",payloads:{}};
    const put=(key,L,classic,n)=>{ out.payloads[key]={all:L.map(h),drop:L.filter(l=>rm65(l,classic,n)).map(h)}; };
    for(const k of KINDS)for(const n of SITS)put(k+"|"+n,linesOf(await build(k,n)),false,n);
    fs.writeFileSync(FIX64,JSON.stringify(out));
    console.log("wrote "+FIX64+" — "+Object.keys(out.payloads).length+" payloads");
    await b.close(); process.exit(0);
  }
  if(WRITE){
    const out={version:"v150.63",note:"one FNV-1a hash per distinct line (whitespace collapsed); lines matching REMOVED (v150.64) or removed65 (v150.65) in tests/payload-faithful.browser.js left out",payloads:{},removed:{},removed65:{}};
    for(const k of KINDS)for(const n of SITS){ const L=linesOf(await build(k,n)); out.payloads[k+"|"+n]=L.filter(l=>!REMOVED.some(r=>r.test(l))&&!rm65(l,false,n)).map(h);
      const rm=L.filter(l=>REMOVED.some(r=>r.test(l))).length; if(rm)out.removed[k+"|"+n]=rm;
      const r5=L.filter(l=>rm65(l,false,n)).length; if(r5)out.removed65[k+"|"+n]=r5; }
    fs.writeFileSync(FIX,JSON.stringify(out));
    console.log("wrote "+FIX+" — "+Object.keys(out.payloads).length+" payloads");
    await b.close(); process.exit(0);
  }

  console.log("\n[everything sent before is still sent]");
  const F=JSON.parse(fs.readFileSync(FIX,"utf8"));
  let n=0, lost=[], removedSeen=0;
  const keys=fragKeys(F.payloads);
  for(const key of keys){
    const [k,nm]=key.split("|");
    if(SITS.indexOf(nm)<0){ lost.push(key+": situation missing"); continue; }
    const text=await build(k,nm), have=new Set(linesOf(text).map(h)); n++;
    const gone=new Set((await diff68(k,nm,text)).gone.map(h));   // v150.70 — the v150.67 memory lines (checked below)
    (await diff72(k,nm,text)).gone.forEach(l=>gone.add(h(l)));   // v150.72 — the v150.71 compass / guidance lines (checked below)
    (await diff74(k,nm,text)).gone.forEach(l=>gone.add(h(l)));   // v150.75 — the text path's outfit line (checked below)
    (await diff78(k,nm,text)).gone.forEach(l=>gone.add(h(l)));   // v150.79 — goals and threads the scene does not touch (checked below)
    (await diff81(k,nm,text)).gone.forEach(l=>gone.add(h(l)));   // v150.81 — the place and who-is-around lines (checked below)
    F.payloads[key].forEach(x=>{ if(!have.has(x)&&!gone.has(x))lost.push(key+" lost a line ("+x+")"); });
  }
  Object.keys(F.removed||{}).forEach(k=>{ removedSeen+=F.removed[k]; });
  ok("in "+n+" payloads (every path × "+SITS.length+" situations — every fragment payload of the fixture), every line v150.63 sent is still sent (but v150.70's memory lines)", n===keys.length&&n>=290&&lost.length===0, lost.slice(0,10).join("\n        "));
  ok("v150.75: the only lines a text payload drops for the outfit are its outfit lines, and none is added", [...all74.gone].every(l=>/wearing|wardrobe|have on|has on|dress/i.test(l))&&all74.added.size===0, JSON.stringify({gone:[...all74.gone].slice(0,4),added:[...all74.added].slice(0,4)}));
  {const G78=[...all78.gone], QL=/^(?:# STORY THREADS YOU ARE PART OF|You are named in the current story threads? below|- The missing ledger: |- The second debt: |Latest: Day 2: The clerk)/;
   ok("v150.79: the only lines that go for an untouched pursuit are the story threads and the live goal no scene line touches ("+G78.length+"), and none is added",
     G78.length>0&&G78.every(l=>QL.test(l)||l==="- Get the shop keys")&&G78.indexOf("- Get the shop keys")>=0&&!G78.some(l=>/Avoid Berk's debt/.test(l))&&all78.added.size===0,
     JSON.stringify({gone:G78.slice(0,10),added:[...all78.added].slice(0,4)}));}
  ok("the only lines left out of the comparison are the removed ones ("+removedSeen+" of them: the quiet wants and the two old compass lines)", removedSeen>0);
  {let r5=0; Object.keys(F.removed65||{}).forEach(k=>{ r5+=F.removed65[k]; });
   ok("and v150.65's ("+r5+": what was found out, and the one answered's sheet line and old one-line entry)", r5>0&&F.removed65["solo|learned"]===3&&F.removed65["solo|player"]===1&&F.removed65["multi|char"]===2, JSON.stringify(F.removed65).slice(0,300));}

  console.log("\n[against v150.64, both ways: only what was found out goes, and the one answered's entry moves]");
  {const G=JSON.parse(fs.readFileSync(FIX64,"utf8"));
   // a fresh page, as when the fixture was written (see boot)
   await pg.close(); pg=await (await b.newContext({viewport:{width:412,height:915}})).newPage(); pg.on('pageerror',e=>errs.push(e.message));
   await boot();
   let n64=0, lost64=[], extra=[], dropped=0;
   /* the shipped base instruction, format rules and narration shape, and the format rules the "fmt" / "fmtHead" situations
      above set (filled for Ayla, as the reply fills them) */
   const own67=await pg.evaluate(()=>[up("baseInstruction")||"",_stripLangSection(up("formatRules")||""),BLOCK_TPL_DEFAULTS.narr_shape||"",
     "Write in first person. Keep it short, Ayla.","# MY RULES\nWrite in first person."].join("\n"));
   const keys64=fragKeys(G.payloads);
   for(const key of keys64){
     const [k,nm]=key.split("|");
     if(SITS.indexOf(nm)<0){ lost64.push(key+": situation missing"); continue; }
     const text=await build(k,nm), L=linesOf(text), have=new Set(L.map(h)); n64++;
     const was=new Set(G.payloads[key].all), drop=new Set(G.payloads[key].drop); dropped+=drop.size;
     const d68=await diff68(k,nm,text), gone68=new Set(d68.gone.map(h)), added68=new Set(d68.added);   // v150.70 — the memories
     { const d72=await diff72(k,nm,text); d72.gone.forEach(l=>gone68.add(h(l))); d72.added.forEach(l=>added68.add(l)); }   // v150.72 — the words
     { const d74=await diff74(k,nm,text); d74.gone.forEach(l=>gone68.add(h(l))); d74.added.forEach(l=>added68.add(l)); }   // v150.75 — no outfit in a text
     { const d78=await diff78(k,nm,text); d78.gone.forEach(l=>gone68.add(h(l))); d78.added.forEach(l=>added68.add(l)); }   // v150.79 — only what the scene touches
     { const d81=await diff81(k,nm,text); d81.gone.forEach(l=>gone68.add(h(l))); d81.added.forEach(l=>added68.add(l)); }   // v150.81 — the place lines
     G.payloads[key].all.forEach(x=>{ if(!drop.has(x)&&!have.has(x)&&!gone68.has(x))lost64.push(key+" lost a line ("+x+")"); });
     // a line v150.64 did not send is allowed only inside the one answered's <what_they_are_to_you>
     const block=new Set(); { const m=String(text).match(/<what_they_are_to_you>[\s\S]*?<\/what_they_are_to_you>/); if(m)linesOf(m[0]).forEach(l=>block.add(l)); }
     // … or from v150.67's options: the Settings base instruction, format rules and the narration shape (no fragment sent them)
     linesOf(own67).forEach(l=>block.add(l));
     L.forEach(l=>{ if(!was.has(h(l))&&!block.has(l)&&!added68.has(l))extra.push(key+" new line: "+l.slice(0,120)); });
   }
   ok("in "+n64+" payloads, every line v150.64 sent is still sent, except what was found out and the one answered's sheet line and old entry line ("+dropped+")", n64===keys64.length&&n64>=290&&lost64.length===0&&dropped>0, lost64.slice(0,10).join("\n        "));
   ok("and every line sent now was sent by v150.64, except the one answered's entry in <what_they_are_to_you>, v150.67's base instruction / format rules and v150.70's memories", extra.length===0, extra.slice(0,10).join("\n        "));}

  /* v150.70 — what the memories change is the memories, and nothing else: every line the v150.67 memories sent and the build now
     does not is a line of the old "What you remember" / "What happened just before this" or an old numbered entry; every line
     the build now adds is a line of the new fragments or an entry in the reader's format. */
  console.log("\n[v150.70: only the memories change]");
  {const NEW=await pg.evaluate(()=>{ const t=[]; ["memories","latest"].forEach(id=>{ const f=FRAG_DEFAULTS.find(x=>x.id===id); [f].concat(f.options||[]).forEach(x=>t.push(String(x.text||""))); }); return t.join("\n"); });
   const newLines=new Set(linesOf(NEW.replace(/\{\{char\}\}/g,"Ayla").replace(/\{\{user\}\}/g,"Emre")));
   const OLDRE=/^(?:# YOU REMEMBER THAT THESE HAPPENED|A past put to you|## MEMORIES YOU RECALL|(?:Earlier memory|Memory|Latest) \d+: |# WHAT HAPPENED JUST BEFORE THIS|The last things that passed between you)/;
   const badGone=[...all68.gone].filter(l=>!OLDRE.test(l)), badAdd=[...all68.added].filter(l=>!newLines.has(l)&&!/^\[[^\]]*\| [1-5]\] \S/.test(l));
   ok("the lines that go are the v150.67 memory heading, instruction and numbered entries ("+all68.gone.size+" distinct), and nothing else", all68.gone.size>0&&badGone.length===0, badGone.slice(0,8).join("\n        "));
   ok("the lines that come are the new memory fragments and the one-line entries ("+all68.added.size+" distinct), and nothing else", all68.added.size>0&&badAdd.length===0&&[...all68.added].some(l=>/^\[[a-z ]+ \| 3\] He asked where she had been\.$/.test(l)), badAdd.slice(0,8).join("\n        ")+" | "+[...all68.added].slice(0,6).join(" / "));}

  /* v150.72 — what the words change is those lines, and nothing else: every line the v150.71 compass / guidance sent and the
     build now does not is an id_winning / id_ahead line; every line the build now adds is one of them saying the want does not
     hand over her words, or the heat guidance's "your words stay your own". */
  console.log("\n[v150.72: only the words change]");
  {const badGone=[...all72.gone].filter(l=>!/^Right now your want (?:has won over|is ahead of) your conscience\./.test(l)||/does not hand over your words/.test(l));
   const badAdd=[...all72.added].filter(l=>!(/^Right now your want (?:has won over|is ahead of) your conscience\..* does not hand over your words: you still speak as yourself\. A line someone dictates to you that you would never say, you do not recite — you answer in your own words, or not at all\.$/.test(l))&&!/^Your words stay your own\. Wanting it does not mean saying whatever you are handed: repeating the other's dictated phrasing back is not desire, it is losing yourself\. Choose your own words, or say nothing\.$/.test(l));
   ok("the lines that go are the v150.71 id_winning / id_ahead lines ("+all72.gone.size+" distinct), and nothing else", all72.gone.size>0&&badGone.length===0, badGone.slice(0,8).join("\n        "));
   ok("the lines that come are the same with her own words kept, and the heat guidance's ("+all72.added.size+" distinct), and nothing else", all72.added.size>0&&badAdd.length===0&&[...all72.added].some(l=>/^Your words stay your own\./.test(l)), badAdd.slice(0,8).join("\n        "));}

  /* v150.81 — what changes is the place and who is around, and nothing else: every line the v150.80 scene and privacy sent and
     the build now does not is one of its earshot / exposure / "can hear" lines; every line the build now adds is its new
     wording. Listed exactly. */
  console.log("\n[v150.81: only the place lines change]");
  {const GONE=[/^- Who can hear you is covered under PRIVACY below, and it sets how freely you speak/,
     /^# PRIVACY — WHO CAN HEAR YOU$/,
     /^You are in the [^.]+\. Each sub-area is its own earshot — people in another sub-area cannot hear you here\.$/,
     /^SUB-AREAS of [^:]+: [^—]+\.$/,
     /^How exposed (?:the area you are standing in|this place) is: (?:private \(nothing said here gets out\)|fairly private \(talk here rarely spreads\)|semi-public \(word can get around\)|gossipy \(talk here often spreads\)|very public \(assume anything said here will spread\))\./,
     /^PRIVACY: you are ALONE with \S+ — nobody else is in the room or within earshot, and nobody can hear a word of this\./,
     /^PRIVACY: nobody you know is with you and \S+ — .* But this is a PUBLIC place\. There are strangers around: people who can see you/,
     /^Not in this room, but elsewhere in .+\. They cannot hear what you say here — but they could come in at any moment\.$/];
   const ADDED=[/^- Who is around you is covered under PRIVACY below, and it sets how freely you speak/,
     /^# PRIVACY — WHO IS AROUND YOU$/,
     /^You are in the [^.]+\.$/,
     /^SUB-AREAS of [^:]+: .*— empty, no one is there.*\.$/,
     /^(?:This is a crowded place\.|There are a couple of people far in the distance\.|There are no other people nearby\.)$/,
     /^If you want somewhere with fewer people around, .+ is quieter — you can suggest moving there\.$/,
     /^PRIVACY: you are ALONE with \S+ — nobody else is in the room or within earshot\. You can speak and act as freely as you would with no one watching\./,
     /^PRIVACY: nobody you know is with you and \S+ — .* But this is a PUBLIC place, not somebody's home: what is safe here is what is said quietly and looks like nothing\./,
     /^Not in this room, but elsewhere in .+\. They are out of earshot — but they could come in at any moment\.$/];
   const G=[...all81.gone], A=[...all81.added];
   const badGone=G.filter(l=>!GONE.some(r=>r.test(l))), badAdd=A.filter(l=>!ADDED.some(r=>r.test(l)));
   console.log("        gone ("+G.length+"):\n          "+G.map(l=>l.slice(0,150)).join("\n          "));
   console.log("        added ("+A.length+"):\n          "+A.map(l=>l.slice(0,150)).join("\n          "));
   ok("the lines that go are the v150.80 earshot, exposure and 'can hear' lines ("+G.length+" distinct), and nothing else", G.length>0&&badGone.length===0, badGone.slice(0,8).join("\n        "));
   ok("the lines that come are who is around, the areas without the earshot sentence (an empty private one marked) and the same lines without 'can hear' ("+A.length+" distinct), and nothing else",
     A.length>0&&badAdd.length===0&&A.some(l=>/^There are no other people nearby\.$/.test(l))&&A.some(l=>/^There are a couple of people far in the distance\.$/.test(l))&&A.some(l=>/— empty, no one is there/.test(l)), badAdd.slice(0,8).join("\n        "));
   ok("no payload of any situation says who can hear, how exposed, or that talk gets out", A.every(l=>!/can hear|How exposed|gets out|word can get around|spreads/i.test(l)));}

  console.log("\n[what v150.64 removes]");
  const R=await pg.evaluate(()=>{ const r={};
    ["solo","multi","gm","text","heat"].forEach(k=>["wants2","live_goals","intent_away","all"].forEach(n=>{ const t=__build(k,(__SIT.find(x=>x[0]===n)||[0,{}])[1]);
      if(/what_you_quietly_want|Privately, you are set on|Privately, you want something out of|Privately, you are working toward/.test(t))r[k+"|"+n]=true; }));
    return {left:Object.keys(r)}; });
  ok("no quiet want reaches any reply, on any path", R.left.length===0, JSON.stringify(R));

  console.log("\n[what v150.64 adds: the feelings, once]");
  const G=await pg.evaluate(()=>{ const g=(k,o)=>__build(k,o||{});
    return {solo:g("solo",{s:["relOn"]}),heat:g("heat",{s:["relOn"]}),text:g("text",{s:["relOn"]}),char:g("multi",{s:["relOnChar"],targetId:"p_b",targetName:"Berk"}),
      same:g("solo",{s:["relSame"]}),cons:g("solo",{s:["relConsidered"]}),off:g("solo",{})}; });
  const order=(t,a,b)=>t.indexOf(a)>=0&&t.indexOf(b)>t.indexOf(a);
  ok("the settled view, in the head, right after the ties: heading, the view, and its wording",
    /# WHAT YOU HAVE COME TO FEEL ABOUT Emre\nThese are your private feelings — let them shape how you speak and act, but never state them outright\.\n\nLASTING \/ CONSIDERED VIEW \(your settled, filtered opinion — this is the real foundation and should govern your behaviour\): She has never forgiven him\./.test(G.solo)
    &&order(G.solo,"# WHO THESE PEOPLE ARE TO YOU","# WHAT YOU HAVE COME TO FEEL ABOUT")&&G.solo.indexOf("# WHAT YOU HAVE COME TO FEEL ABOUT")<G.solo.indexOf("(history)"), (G.solo.match(/# WHAT YOU HAVE COME[\s\S]{0,500}/)||[""])[0]);
  ok("the live charge, in the tail, right before the compass: the reading, the paid note to play, and the tension clause",
    /# WHAT YOUR BODY IS DOING THIS SECOND\nNot your opinion of Emre — that was settled earlier/.test(G.solo)&&/What is actually running in you as you open your mouth: [^\n]+\nThis is momentary, and it changes HOW the line comes out/.test(G.solo)
    &&/play exactly this, as behaviour, not as a sentence about it:\nKeep answering him, but stand further away\. This heat isn't backed by deeper feeling/.test(G.solo)
    &&G.solo.indexOf("# WHAT YOUR BODY IS DOING")>G.solo.indexOf("(history)")&&(G.solo.indexOf("# YOUR INNER COMPASS")<0||G.solo.indexOf("# WHAT YOUR BODY IS DOING")<G.solo.indexOf("# YOUR INNER COMPASS")), (G.solo.match(/# WHAT YOUR BODY[\s\S]{0,900}/)||[""])[0]);
  ok("on heat and text too", /# WHAT YOU HAVE COME TO FEEL ABOUT Emre/.test(G.heat)&&/# WHAT YOUR BODY IS DOING THIS SECOND/.test(G.heat)&&/# WHAT YOU HAVE COME TO FEEL ABOUT Emre/.test(G.text)&&/# WHAT YOUR BODY IS DOING THIS SECOND/.test(G.text));
  ok("each sent once: the view and the note appear one time each", (G.solo.match(/She has never forgiven him/g)||[]).length===1&&(G.solo.match(/Keep answering him, but stand further away/g)||[]).length===1);
  /* v150.65 — the one answered carries their whole entry ("What you know of them"), so a character answered is no longer a line
     in the ties at all; their stance is the feelings block, and their relationship text is printed once, with them. */
  ok("a character answered: their stance is the feelings block, their entry is with them once, and they are not in the ties",
    /# WHAT YOU HAVE COME TO FEEL ABOUT Berk[\s\S]*You lean on him more than you admit\./.test(G.char)&&!/• \[Berk/.test(G.char)
    &&/<what_they_are_to_you>What Berk is to you, in your own words: my older brother\.\nBerk raised her after their father left\.\nThat, and what Berk shows/.test(G.char)
    &&(G.char.match(/Berk raised her after their father left\./g)||[]).length===1,
    (G.char.match(/# WHO THESE PEOPLE[\s\S]{0,700}/)||[""])[0]+"\n…\n"+(G.char.match(/<what_they_are_to_you>[\s\S]{0,300}/)||[""])[0]);
  ok("the player answered, and the settled view says what the tie already says: the tie paragraph stays, the view is not sent again",
    /Emre lives across the hallway; you see him nearly every single morning\./.test(G.same)&&!/LASTING \/ CONSIDERED VIEW/.test(G.same), (G.same.match(/# WHO THESE PEOPLE[\s\S]{0,600}/)||[""])[0]);
  ok("no written view: the considered one, in its own wording", /LASTING \/ CONSIDERED VIEW \(your settled, filtered opinion — governs your behaviour\): you [^\n]+\./.test(G.cons), (G.cons.match(/LASTING[^\n]*/)||[""])[0]);
  ok("relationships off or nothing on record: neither block", !/WHAT YOU HAVE COME TO FEEL|WHAT YOUR BODY IS DOING/.test(G.off));

  ok("no page errors", errs.length===0?true:errs.join(" | "));
  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close(); process.exit(fail?1:0);
})().catch(e=>{ console.error(e); process.exit(1); });
