/* v150.70 — MEMORIES IN THE REPLY AND IN THE EMOTION PICK.
   The player rewrote the "What you remember" fragment: how to read an entry ([when | importance] what happened. Felt: …
   Status: …), how a memory feels now, how it fades, and what keeps it from fading (an open or secret matter, until a later
   memory resolves it). "A woman cheating her husband should not feel calm the next day": the decision model reads the same.
   Checked here:
     • the reply's memory lists, on every path, are one line per memory in that format: when (from now in game time, the part
       of the day for today and yesterday, then days, weeks, months), importance 1–5, what happened (no "Memory 1:", no
       "This happened …", no frozen "Day N, Period." lead, no "(feeling)" tail), Felt, Status only when there is one; oldest to
       newest; an exact repeat once; the latest arcs the same way;
     • the shipped "memories" fragment is the player's text, sent only when there are memories; "latest" lists oldest first;
       a saved list gets both only while they are still the v150.67 default;
     • every memory writer's contract carries status and resolves, is shown the owner's open and secret memories, and a
       resolves answer marks the earlier memory resolved (arc builder, phone thread, period reconcile, world engines);
     • older memories with no status are classified once by the Decisions model, in the background of the first emotion
       pick (twelve at most per request), stored, and never asked again;
     • the emotion pick's state carries memories_that_weigh_now by the fading rules (a hidden affair from yesterday is in
       it, marked secret), the emotion and ego questions carry those rules, and Calm says it is not for someone carrying an
       open or secret memory; stored old defaults are upgraded.
   Run: node tests/memory-format.browser.js */
const {chromium}=require('playwright');
const USER_TEXT=`# YOUR MEMORIES

These are things that happened to you before this moment. They are true in this story. Use them as knowledge of your past, not as scripts to repeat.

## Reading an entry
Each memory looks like this:
[when | importance] what happened. Felt: how you felt then. Status: ...

- When: how long ago it happened, measured from this moment.
- Importance: how much it mattered to you.
  1 passing · 2 notable · 3 significant · 4 major · 5 life-changing
- Felt: how you felt at the time. Your feelings now start from this and change with time and with what has happened since.
- Status (when given): open, resolved, or secret.

## How memories make you feel now
Work out how you feel at this moment from all four parts together: what happened, how much it mattered, how you felt, and how long ago.

How feelings fade over time:
- Hours to a day: raw. These feelings are close to the surface and color nearly everything you do.
- A few days: still strong. They flare up whenever something reminds you.
- Weeks: in the background. They come back with reminders, the place, or the person.
- Months or more: part of who you are. What is left is a mood or a habit, not a fresh feeling.

How importance changes this:
- Importance 1–2 fades within a day or two.
- Importance 3 fades over days to weeks.
- Importance 4–5 never fully fades. With time it changes shape, for example from panic into guilt, or from grief into a quiet ache.

What stops a feeling from fading:
- An open or secret event does not fade with time alone. Guilt, fear, or resentment stays until something resolves it, and it sharpens around the people involved.
- Only a later memory can resolve it: a confession, an apology, a reckoning. Without one, the feeling is still there.

Feelings can be mixed. You can hold guilt and desire, love and resentment, relief and shame at the same time. Do not reduce them to one.

You can hide what you feel. If you act calm, let the feeling show in small ways: a pause before answering, avoiding someone's eyes, being too cheerful, a sharp word. Hiding a feeling is not the same as not having it.

## How to use them
- Act: Your feelings shape what you do, but you can change. Time, apologies, and new events can soften or harden how you feel.
- Speak: Refer to the past the way a person does: when it is relevant, briefly, and in your own words. Do not recite memories.

## Rules
- Entries are listed oldest to newest. When two memories conflict, the newer one shows where things stand now.
- If two entries describe the same event, treat them as one.
- When a past situation comes up again (same person, same action, same place), remember how it went last time and let that inform you. Do not replay your old reaction word for word; respond as who you are now.
- These are your memories as {{char}}. Things {{user}} did are things you saw or were told, not things you did.
- Only these events happened between you and the people here. Do not invent shared history that is not listed.

### Long ago
{{call//mem_distant_entries}}

### Recently
{{call//mem_recent_entries}}`;
(async()=>{
  const b=await chromium.launch({executablePath:process.env.SM_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage({viewport:{width:412,height:915}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file://'+require('path').resolve(__dirname,'..','index.html'));
  await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(800);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x===undefined?c:x).slice(0,1400));} };

  // One world: Ayla (married to Hakan), the player Emre, Berk. Day 40, evening.
  const setup=()=>pg.evaluate(()=>{
    const uni=state.universes[0]; state.curUniverse=uni.id;
    uni.locations=[{id:"l_home",name:"Ayla's Flat",type:"home",residents:["p_a"],sublocations:[{id:"s1",name:"Kitchen"}]}];
    state.personas=[
      {id:"p_a",name:"Ayla",universeId:uni.id,personality:"Ayla is sharp.",backstory:"Grew up by the docks.",look:{},style:"Short, dry sentences.",goals:"x",instructions:"x",
       relationships:{p_h:{tie:"husband",relationship:"Married to Hakan for nine years."},__user__:{tie:"neighbour",relationship:"Emre lives across the hall."}}},
      {id:"p_h",name:"Hakan",universeId:uni.id,personality:"Hakan is kind.",look:{},style:"x"},
      {id:"p_b",name:"Berk",universeId:uni.id,personality:"Berk is loud.",look:{},style:"x"}];
    state.user="Emre"; state.key="sk-test"; state.mem=true; state.memMinImp=0; state.condenseOn=false; state.relOn=false; state.embedOn=false;
    state.payloadTplOn=false; state.fragments=null; state.autoSpeak=false; state.narrMode=false; state.narrOn=false; state.gossip=[]; state.trackOn=false;
    state.emoOn=true; state.emoModel=""; state.emotions=null; state.memJudgeOn=false; state.replyCheckOn=false; state.trackDecOn=false; state.gateOn=false;
    store.setRaw(K.fragAdds,FRAG_SHIPPED_ADDS.map(a=>a.key).join(",")); state.blockTpls={};
    const c=curChat();
    Object.assign(c,{universeId:uni.id,presentIds:["p_a"],emo:{},promises:[],wearing:{},calendar:[],intents:[],rel:{},gameDay:40,period:"Evening",timeOfDay:"Evening",
      locationId:"l_home",location:"Ayla's Flat",subId:null,subPos:{},memCarry:{},memDoneIdx:-1,memEvent:null,_textArc:{},
      messages:[{mid:"u1",role:"user",content:'"Hi."',present:["p_a"]},{mid:"a1",role:"assistant",speaker:"Ayla",speakerId:"p_a",content:'"Hello."',present:["p_a"]},
        {mid:"u2",role:"user",content:'"Are you all right?"',present:["p_a"]},{mid:"a2",role:"assistant",speaker:"Ayla",speakerId:"p_a",content:'"Fine."',present:["p_a"]},
        {mid:"u3",role:"user",content:'"You look tired."',present:["p_a"]}]});
    const base={ownerId:"p_a",character:"Ayla",universeId:uni.id,chatId:c.id,type:"EXPERIENCE",source:"auto"};
    window.__M={
      old:Object.assign({id:"m_old",gameDay:38,gamePeriod:"Morning",location:"the market",content:"Day 38, Morning. I bought bread and saw Berk by the stalls.",importance:0.3,emotion:"sad"},base),
      dup:Object.assign({id:"m_dup",gameDay:38,gamePeriod:"Morning",location:"the market",content:"Day 38, Morning. I bought bread and saw Berk by the stalls.",importance:0.3,emotion:"sad"},base),
      aff:Object.assign({id:"m_aff",gameDay:39,gamePeriod:"Night",location:"Emre's House",content:"I slept with Emre at his house while Hakan was on the night shift.",
        feelings:"Guilty, and I want it again (I hate that).",importance:0.9,emotion:"tense",status:"secret"},base),
      fight:Object.assign({id:"m_fight",gameDay:40,gamePeriod:"Morning",location:"Ayla's Flat",content:"Berk and I argued about the rent and he left without paying.",
        feelings:"I am still angry at him",importance:0.5,status:"open"},base),
      lt1:Object.assign({id:"m_lt1",gameDay:1,content:"My father left on a boat when I was small.",importance:0.95,type:"LONGTERM",source:"longterm_condenser"},base),
      lt2:Object.assign({id:"m_lt2",gameDay:19,gamePeriod:"Evening",content:"Hakan and I decided not to have children yet.",importance:0.7,type:"LONGTERM",feelings:"Relieved, mostly."},base)};
    state.memory=Object.values(window.__M).map(m=>JSON.parse(JSON.stringify(m)));
    return true;
  });
  const KINDS=["solo","multi","gm","text","heat"];

  console.log("\n[the reply's memory lists: one line per memory, in the reader's format]");
  await setup();
  const P=await pg.evaluate(KINDS=>{
    const c=curChat(), p=state.personas[0], M=window.__M;
    const inj={recent:[M.fight,M.old,M.aff,M.dup],diary:[],longterm:[M.lt2,M.lt1]};
    const out={};
    KINDS.forEach(kind=>{
      if(kind==="heat")c._heatBeat={n:2,total:5}; else delete c._heatBeat;
      if(kind==="text")c.messages.forEach(m=>{ m.textMsg=true; m.textWith="p_a"; }); else c.messages.forEach(m=>{ delete m.textMsg; delete m.textWith; });
      const others=presentCast(c).filter(x=>x.id!==p.id);
      const mk=()=>Object.assign({},buildCharPromptBlocks(p,others,inj,null,{chat:c,targetName:"Emre",targetId:"__user__",textMode:kind==="text",payloadKind:kind}),
        buildTailBlocks({chat:c,selfP:p,selfId:p.id,selfName:p.name,targetName:"Emre",targetId:"__user__",multi:kind==="multi",injected:inj,textMode:kind==="text",payloadKind:kind}));
      const B=mk();
      const m=ptBuildMessages(kind,B,[{role:"user",content:"(history)"}],{chat:c,npc:p,targetName:"Emre"},mk)||[];
      out[kind]=m.map(x=>x.content).join("\n\n");
    });
    delete c._heatBeat; c.messages.forEach(m=>{ delete m.textMsg; delete m.textWith; });
    // and with nothing to recall: no memory text at all
    const others=presentCast(c).filter(x=>x.id!==p.id), none={recent:[],diary:[],longterm:[]};
    const mk0=()=>Object.assign({},buildCharPromptBlocks(p,others,none,null,{chat:c,targetName:"Emre",targetId:"__user__",payloadKind:"solo"}),
      buildTailBlocks({chat:c,selfP:p,selfId:p.id,selfName:p.name,targetName:"Emre",targetId:"__user__",injected:none,payloadKind:"solo"}));
    out.empty=(ptBuildMessages("solo",mk0(),[{role:"user",content:"(history)"}],{chat:c,npc:p,targetName:"Emre"},mk0)||[]).map(x=>x.content).join("\n\n");
    return out;
  },KINDS);
  const RECENT="### Recently\n"
    +"[two days ago, at the market | 2] I bought bread and saw Berk by the stalls. Felt: sad.\n"
    +"[last night, at Emre's House | 5] I slept with Emre at his house while Hakan was on the night shift. Felt: Guilty, and I want it again (I hate that). Status: secret.\n"
    +"[this morning, at Ayla's Flat | 3] Berk and I argued about the rent and he left without paying. Felt: I am still angry at him. Status: open.";
  const LONG="### Long ago\n"
    +"[a month ago | 5] My father left on a boat when I was small.\n"
    +"[three weeks ago | 4] Hakan and I decided not to have children yet. Felt: Relieved, mostly.";
  KINDS.forEach(k=>{
    const t=P[k]||"";
    ok(k+": the lists are one line per memory — when, importance, what happened, Felt, Status — oldest to newest", t.indexOf(RECENT)>=0&&t.indexOf(LONG)>=0&&t.indexOf(LONG)<t.indexOf(RECENT),
      (t.match(/### Long ago[\s\S]{0,900}/)||[t.slice(0,600)])[0]);
    ok(k+": the player's wording heads them, filled for Ayla and Emre", t.indexOf("# YOUR MEMORIES\n\nThese are things that happened to you before this moment.")>=0
      &&t.indexOf("- These are your memories as Ayla. Things Emre did are things you saw or were told, not things you did.")>=0&&t.indexOf("# YOU REMEMBER THAT THESE HAPPENED")<0,
      (t.match(/# YOUR MEMORIES[\s\S]{0,300}/)||[""])[0]);
    ok(k+": no old prefix, no frozen day lead, no feeling in brackets, an exact repeat once, Status only where there is one",
      !/Memory \d+:|Earlier memory|Latest \d+:|This happened|Day 38|\(felt:/.test(t)&&(t.match(/I bought bread and saw Berk/g)||[]).length===1
      &&!/stalls\. Felt: sad\. Status/.test(t)&&!/\(I am still angry at him\)/.test(t), (t.match(/### Recently[\s\S]{0,500}/)||[""])[0]);
  });
  ok("with nothing to recall, none of the memory text goes out", !/# YOUR MEMORIES|### Long ago|### Recently|Reading an entry/.test(P.empty), (P.empty.match(/# YOUR MEMORIES[\s\S]{0,200}/)||[""])[0]);

  const L=await pg.evaluate(()=>{
    const c=curChat(); c.gameDay=40;
    const op={}; latestArcsBlock("p_a",{recent:[],longterm:[],diary:[]},op,c);
    const imp=[0,0.2,0.21,0.4,0.41,0.6,0.61,0.8,0.81,1,undefined,7].map(v=>memImp5({importance:v}));
    const W=d=>memEntryWhen({gameDay:d},40), Wp=(d,p)=>memEntryWhen({gameDay:d,gamePeriod:p},40);
    return {latest:op.mem_latest_entries||"",imp,when:[Wp(40,"Morning"),Wp(40,"Night"),W(40),Wp(39,"Afternoon"),Wp(39,"Night"),W(39),W(36),W(31),W(26),W(19),W(5),W(0)]};
  });
  ok("the latest arcs are in the same format, oldest first", /^\[two days ago, at the market \| 2\] I bought bread[^\n]*\n\[last night, at Emre's House \| 5\] I slept with Emre[^\n]*Status: secret\.\n\[this morning, at Ayla's Flat \| 3\] Berk and I argued[^\n]*Status: open\.$/.test(L.latest), L.latest);
  ok("importance: ≤0.2 → 1, ≤0.4 → 2, ≤0.6 → 3, ≤0.8 → 4, else 5 (none on record → 3, a 0–10 score scaled)", JSON.stringify(L.imp)==="[1,1,2,2,3,3,4,4,5,5,3,4]", JSON.stringify(L.imp));
  ok("when: the part of the day today and yesterday, then days, last week, weeks, a month, months",
    JSON.stringify(L.when)===JSON.stringify(["this morning","tonight","earlier today","yesterday afternoon","last night","yesterday","four days ago","last week","two weeks ago","three weeks ago","a month ago",""]), JSON.stringify(L.when));

  console.log("\n[the shipped fragments, and a saved list]");
  const F=await pg.evaluate(USER_TEXT=>{
    const m=FRAG_DEFAULTS.find(f=>f.id==="memories"), l=FRAG_DEFAULTS.find(f=>f.id==="latest");
    const rec=(m.options||[]).find(o=>o.id==="recall")||{};
    return {same:rec.text===USER_TEXT, code:rec.code, main:m.text, paths:JSON.stringify(m.paths), latest:(l.options[0]||{}).text||""};
  },USER_TEXT);
  ok("the shipped 'What you remember' is the player's text, word for word, on every path", F.same&&F.main===""&&F.paths==='["solo","multi","gm","text","heat"]', JSON.stringify(F).slice(0,300));
  ok("…sent when there are memories to recall (has_memories)", F.code==="has_memories", F.code);
  ok("'What happened just before this' lists oldest first, in the same entry format", /Oldest first, the newest last; each reads \[when \| importance 1–5\] what happened\. Felt: how you felt then\./.test(F.latest)&&!/Newest first/.test(F.latest), F.latest.slice(0,400));
  const MG=await pg.evaluate(()=>{
    const r={};
    const run=edit=>{ const L=FRAG_DEFAULTS.map(f=>JSON.parse(JSON.stringify(FRAG_DEFAULTS_V150_67_OLD[f.id]||f)));
      if(edit)L.find(f=>f.id==="memories").text+="\nMY OWN MEMORY RULE.";
      state.fragments=L; store.setRaw(K.fragAdds,FRAG_SHIPPED_ADDS.map(a=>a.key).filter(k=>k!=="v150.68.memories").join(",")); _fragMigratedFor=null;
      const got=fragList(); const pick=id=>got.find(f=>f.id===id);
      return {mem:_fragCanon(pick("memories"))===_fragCanon(FRAG_DEFAULTS.find(f=>f.id==="memories")),
        lat:_fragCanon(pick("latest"))===_fragCanon(FRAG_DEFAULTS.find(f=>f.id==="latest")),
        kept:/MY OWN MEMORY RULE/.test(pick("memories").text||""),
        once:String(store.raw(K.fragAdds,"")).split(",").indexOf("v150.68.memories")>=0}; };
    r.plain=run(false); r.edited=run(true);
    state.fragments=null; store.setRaw(K.fragments,""); _fragMigratedFor=null;
    return r; });
  ok("a saved list whose memories and latest are still the v150.67 default gets the new ones, once", MG.plain.mem&&MG.plain.lat&&MG.plain.once, JSON.stringify(MG));
  ok("an edited 'What you remember' is the player's and stays (the unedited latest is still replaced)", !MG.edited.mem&&MG.edited.kept&&MG.edited.lat, JSON.stringify(MG));

  console.log("\n[the writers: status and resolves]");
  const S=await pg.evaluate(()=>{
    const parts=k=>(epDef(k)||{parts:[]}).parts.map(p=>p.name);
    return {mb:/"status": ""/.test(DEFAULT_MEMBUILD)&&/"resolves": \[\]/.test(DEFAULT_MEMBUILD)&&/- status — "open" when/.test(DEFAULT_MEMBUILD)&&/an affair kept from a spouse/.test(DEFAULT_MEMBUILD),
      rc:/"status":""\}\]\}/.test(DEFAULT_MEMRECONCILE)&&/# WHAT THIS STRETCH RESOLVED/.test(DEFAULT_MEMRECONCILE)&&/"resolves":\["<id>"\]/.test(DEFAULT_MEMRECONCILE),
      rcJson:(()=>{ try{ const ex=DEFAULT_MEMRECONCILE.split("\n").filter(l=>/^\{"memories":\[\{"content"/.test(l)); return ex.length===2&&ex.every(l=>JSON.parse(l.replace("0.5,","0.5,"))); }catch(e){ return String(e); } })(),
      world:["worldRound","offstageEvent","calExec","charQuestStep"].every(k=>/"status":/.test(up(k))&&/"resolves":/.test(up(k))&&/"secret" when that person is hiding/.test(up(k))),
      parts:["memBuild","memReconcile","worldRound","offstageEvent","calExec","charQuestStep"].every(k=>parts(k).indexOf("matters")>=0),
      stale:(window.__stalePipes||[]).slice()};
  });
  ok("the arc / thread builder asks for status and resolves, with a one-line rule each", S.mb, JSON.stringify(S));
  ok("the period reconciler too, and its examples still parse", S.rc&&S.rcJson===true, JSON.stringify(S));
  ok("the world engines (day round, offstage, calendar, quest step) ask for them in every memory", S.world, JSON.stringify(S));
  ok("each is handed the open or secret matters (a 'matters' part)", S.parts, JSON.stringify(S));

  await setup();
  const W=await pg.evaluate(async()=>{
    const c=curChat(); window.__calls=[];
    window.chatCompletion=async(msgs,model,opts)=>{ const d=(opts&&opts.dbg)||""; window.__calls.push({dbg:d,text:JSON.stringify(msgs)}); return window.__reply(d,msgs); };
    // the arc: Ayla tells Hakan the truth; the builder says it resolves the hidden night
    c.presentIds=["p_a","p_h"]; c.messages=[
      {mid:"w1",role:"assistant",speaker:"Ayla",speakerId:"p_a",content:'"Hakan, I have to tell you something about last night."',present:["p_a","p_h"]},
      {mid:"w2",role:"assistant",speaker:"Hakan",speakerId:"p_h",content:'"Go on."',present:["p_a","p_h"]},
      {mid:"w3",role:"assistant",speaker:"Ayla",speakerId:"p_a",content:'"I was with Emre."',present:["p_a","p_h"]}];
    window.__reply=d=>/Memory \(arc\) · Ayla/.test(d)
      ?JSON.stringify({content:"I told Hakan I had been with Emre. He went quiet and walked out.",importance_score:0.9,emotion:"sad",feelings:"Lighter and terrified.",type:"CONFLICT",status:"open",resolves:["m_aff","m_nope"]})
      :JSON.stringify({content:"Ayla told me she was with Emre.",importance_score:0.9,status:"open",resolves:[]});
    await commitMemoryArc(c,0,2,40,"Evening");
    const call=window.__calls.find(x=>/Memory \(arc\) · Ayla/.test(x.dbg))||{text:""};
    const aff=state.memory.find(m=>m.id==="m_aff"), told=state.memory.find(m=>m.ownerId==="p_a"&&/told Hakan/.test(m.content||""));
    const r={sawMatters:/OPEN OR SECRET MATTERS Ayla is carrying/.test(call.text)&&/\[m_aff\] \[last night, at Emre's House \| 5\]/.test(call.text)&&/\[m_fight\]/.test(call.text),
      aff:aff&&{status:aff.status,was:aff.wasStatus,by:aff.resolvedBy,day:aff.resolvedDay,per:aff.resolvedPeriod}, toldId:told&&told.id, told:told&&{status:told.status,checked:told._statusChecked},
      fight:state.memory.find(m=>m.id==="m_fight").status};
    // the reconciler: two fragments of the evening; the answer resolves the open fight
    state.memory.push(Object.assign({},window.__M.old,{id:"rc1",gameDay:40,gamePeriod:"Afternoon",content:"Berk came back with the rent.",status:"",location:"Ayla's Flat"}),
                      Object.assign({},window.__M.old,{id:"rc2",gameDay:40,gamePeriod:"Afternoon",content:"Berk apologised for this morning.",location:"Ayla's Flat"}));
    window.__reply=()=>JSON.stringify({memories:[{content:"Berk came back with the rent and apologised for the morning.",importance_score:0.5,status:"resolved"}],resolves:["m_fight"]});
    await reconcilePeriodFor(state.personas[0],40,"Afternoon",c);
    const rcCall=window.__calls.find(x=>/Memory reconcile/.test(x.dbg))||{text:""};
    const rcMem=state.memory.find(m=>m.ownerId==="p_a"&&/apologised for the morning/.test(m.content||""));
    r.rcSaw=/OPEN OR SECRET MATTERS this character was already carrying/.test(rcCall.text)&&/\[m_fight\]/.test(rcCall.text);
    r.rcFight=state.memory.find(m=>m.id==="m_fight"); r.rcFight=r.rcFight&&{status:r.rcFight.status,by:r.rcFight.resolvedBy,byIsNew:!!rcMem&&r.rcFight.resolvedBy===rcMem.id};
    r.rcMem=rcMem&&{status:rcMem.status,checked:rcMem._statusChecked};
    // a world engine's memory: Hakan's offstage memory is a secret, and resolves nothing
    const uni=universeById(c.universeId)||state.universes[0];
    const wm=_plantWorldMemory(c,uni,state.personas[1],{content:"I followed Ayla to Emre's door and said nothing to her.",emotion:"tense",importance:0.8,status:"secret",resolves:[]},40,"the hallway",["Ayla"],"Evening");
    r.world=wm&&{status:wm.status,checked:wm._statusChecked};
    // and one that resolves Berk's open memory
    state.memory.push(Object.assign({},window.__M.fight,{id:"bk1",ownerId:"p_b",character:"Berk",content:"I owe Ayla the rent and left without paying.",status:"open"}));
    const wm2=_plantWorldMemory(c,uni,state.personas[2],{content:"I paid Ayla the rent I owed her.",emotion:"content",importance:0.5,status:"resolved",resolves:["bk1"]},40,"Ayla's Flat",["Ayla"],"Evening");
    const bk=state.memory.find(m=>m.id==="bk1"); r.world2={status:bk.status,by:bk.resolvedBy===(wm2&&wm2.id)};
    r.matters=memMattersFor([state.personas[0],state.personas[2]],c);
    // what the world engines are sent
    r.epOff=JSON.stringify(epSend("offstageEvent","SYS",{pursuits:"",promises:"",matters:r.matters}));
    return r;
  });
  ok("the arc builder is shown the open and secret matters, with ids, in the reader's format", W.sawMatters, JSON.stringify(W).slice(0,600));
  ok("a resolves answer marks the earlier secret resolved (by the new memory, that day and part of the day); an unknown id does nothing",
    W.aff&&W.aff.status==="resolved"&&W.aff.was==="secret"&&W.aff.by===W.toldId&&W.aff.day===40&&W.aff.per==="Evening", JSON.stringify(W.aff));
  ok("the new memory keeps its own status, and was asked (never backfilled)", W.told&&W.told.status==="open"&&W.told.checked===true, JSON.stringify(W.told));
  ok("the period reconciler is shown them too, and its resolves marks the open fight resolved", W.rcSaw&&W.rcFight&&W.rcFight.status==="resolved"&&W.rcFight.byIsNew&&W.rcMem&&W.rcMem.status==="resolved", JSON.stringify({rcSaw:W.rcSaw,f:W.rcFight,m:W.rcMem}));
  ok("a world engine's memory takes its status, and its resolves settles that person's open memory", W.world&&W.world.status==="secret"&&W.world.checked===true&&W.world2.status==="resolved"&&W.world2.by, JSON.stringify({w:W.world,w2:W.world2}));
  ok("the world engines are sent the people's open and secret matters under their names", /OPEN OR SECRET MATTERS these people carry/.test(W.epOff)&&/Ayla:\\n- \[m_/.test(W.epOff), W.epOff.slice(0,600));

  console.log("\n[older memories: classified once, in the background of the first emotion pick]");
  await setup();
  const BF=await pg.evaluate(async()=>{
    const c=curChat(), p=state.personas[0];
    window.__reqs=[];
    window.fetch=async(url,opts)=>{ const u=String(url);
      if(u.indexOf("/api/alpha/decisions")>-1){ const body=JSON.parse(opts.body); window.__reqs.push(body);
        const ans={}; Object.keys(body.questions).forEach(k=>{
          if(/^status_M/.test(k)){ const ins=body.questions[k].instructions; ans[k]={type:"choice",choice:/slept with Emre/.test(ins.split("Later memories")[0])?"secret":/argued about the rent/.test(ins.split("Later memories")[0])?"open":"none"}; }
          else if(k==="emotion")ans[k]={type:"choice",choice:"guilt"}; else if(k==="intensity")ans[k]={type:"choice",choice:"clear"}; else if(k==="ego")ans[k]={type:"choice",choice:"torn"}; });
        return new Response(JSON.stringify({answers:ans}),{status:200}); }
      return new Response("{}",{status:404}); };
    // an old save: no status anywhere; 15 eligible (last 30 days, importance ≥ 3), plus one too old and one too slight
    state.memory=state.memory.map(m=>{ m=Object.assign({},m); delete m.status; return m; });
    for(let i=0;i<13;i++)state.memory.push(Object.assign({},window.__M.old,{id:"e"+i,gameDay:20+i,content:"An ordinary thing number "+i+".",importance:0.6}));
    state.memory.push(Object.assign({},window.__M.old,{id:"too_old",gameDay:5,content:"Something from long ago.",importance:0.9}));
    state.memory.push(Object.assign({},window.__M.old,{id:"too_slight",gameDay:39,content:"I watered the plants.",importance:0.3}));
    const elig=memStatusCandidates(c,p).map(m=>m.id);
    const wait=async()=>{ for(let i=0;i<40&&_memStatusJobs.size;i++)await new Promise(r=>setTimeout(r,50)); };
    await emotionEnsure(c,p,'"You look tired."'); await wait();
    const first=window.__reqs.filter(r=>Object.keys(r.questions).some(k=>/^status_M/.test(k)));
    const firstN=first[0]?Object.keys(first[0].questions).length:0;
    const st=id=>{ const m=state.memory.find(x=>x.id===id); return m&&{status:m.status||"",checked:!!m._statusChecked}; };
    const after1={aff:st("m_aff"),fight:st("m_fight"),e12:st("e12"),e0:st("e0")};
    // the next line: the three left are asked, then never again
    c.messages.push({mid:"u4",role:"user",content:'"Talk to me."',present:["p_a"]});
    await emotionEnsure(c,p,'"Talk to me."'); await wait();
    const second=window.__reqs.filter(r=>Object.keys(r.questions).some(k=>/^status_M/.test(k)));
    c.messages.push({mid:"u5",role:"user",content:'"Ayla?"',present:["p_a"]});
    await emotionEnsure(c,p,'"Ayla?"'); await wait();
    const third=window.__reqs.filter(r=>Object.keys(r.questions).some(k=>/^status_M/.test(k)));
    const q=first[0]&&first[0].questions; const k1=q&&Object.keys(q).find(k=>/slept with Emre/.test(q[k].instructions));
    return {elig:elig.length, hasOld:elig.indexOf("too_old")>=0, hasSlight:elig.indexOf("too_slight")>=0, firstN, secondN:second.length===2?Object.keys(second[1].questions).length:-1, thirdCount:third.length,
      emoFirst:!!(window.__reqs[0]&&window.__reqs[0].questions.emotion), q1:k1&&{type:q[k1].type,crit:Object.keys(q[k1].criteria),ins:q[k1].instructions}, ties:first[0]&&first[0].state.their_ties,
      after1, left:memStatusCandidates(c,p).length, stored:/"_statusChecked":true/.test(store.raw(K.memory,"")||JSON.stringify(state.memory))};
  });
  ok("the candidates: the last 30 days, importance 3 or more, no status (not too old, not too slight)", BF.elig===16&&!BF.hasOld&&!BF.hasSlight, JSON.stringify(BF).slice(0,300));
  ok("the emotion request goes first; the classification is its own request, twelve at most", BF.emoFirst&&BF.firstN===12, JSON.stringify({emoFirst:BF.emoFirst,firstN:BF.firstN}));
  ok("each is a choice — open, secret, resolved, none — with the memory in the reader's format, later memories and the ties",
    BF.q1&&BF.q1.type==="choice"&&JSON.stringify(BF.q1.crit)==='["open","secret","resolved","none"]'&&/\[last night, at Emre's House \| 5\] I slept with Emre/.test(BF.q1.ins)&&/Later memories of Ayla's/.test(BF.q1.ins)
      &&JSON.stringify(BF.ties).indexOf("Hakan — husband")>=0, JSON.stringify(BF.q1).slice(0,700));
  ok("the answers are stored (secret, open, and none as no status), each marked so it is never asked again", BF.after1.aff.status==="secret"&&BF.after1.aff.checked&&BF.after1.fight.status==="open"&&BF.after1.e12.status===""&&BF.after1.e12.checked, JSON.stringify(BF.after1));
  ok("the next pick asks the ones left, and after that nothing is asked again", BF.secondN===4&&BF.thirdCount===2&&BF.left===0, JSON.stringify({secondN:BF.secondN,third:BF.thirdCount,left:BF.left}));

  console.log("\n[the emotion pick feels them too]");
  await setup();
  const E=await pg.evaluate(async()=>{
    const c=curChat(), p=state.personas[0];
    state.memory.push(Object.assign({},window.__M.old,{id:"x_open_old",gameDay:-160,content:"My mother and I stopped speaking.",importance:0.6,status:"open"}),
      Object.assign({},window.__M.old,{id:"x_two_5d",gameDay:35,content:"I fixed the shelf.",importance:0.35}),
      Object.assign({},window.__M.old,{id:"x_two_1d",gameDay:39,gamePeriod:"Midday",content:"I called my sister.",importance:0.35}),
      Object.assign({},window.__M.old,{id:"x_four_60d",gameDay:-20,content:"I lost the job at the bakery.",importance:0.75}),
      Object.assign({},window.__M.old,{id:"x_four_100d",gameDay:-60,content:"I moved out of my parents' house.",importance:0.75}),
      Object.assign({},window.__M.old,{id:"x_three_20d",gameDay:20,content:"I lent Berk money.",importance:0.5}),
      Object.assign({},window.__M.old,{id:"x_diary",gameDay:39,type:"DIARY",content:"Dear diary.",importance:0.9}));
    state.memory.forEach(m=>{ m._statusChecked=true; });
    window.__reqs=[];
    window.fetch=async(url,opts)=>{ if(String(url).indexOf("/api/alpha/decisions")>-1){ const body=JSON.parse(opts.body); window.__reqs.push(body);
        return new Response(JSON.stringify({answers:{emotion:{type:"choice",choice:"guilt"},intensity:{type:"choice",choice:"clear"},ego:{type:"choice",choice:"torn"}}}),{status:200}); }
      return new Response("{}",{status:404}); };
    await emotionEnsure(c,p,'"You look tired."',{targetId:"__user__",targetName:"Emre"});
    const r=window.__reqs[0]||{state:{},questions:{}};
    // the cap: open and secret first, then the newest
    for(let i=0;i<14;i++)state.memory.push(Object.assign({},window.__M.old,{id:"cap"+i,gameDay:40,gamePeriod:"Midday",date:i,content:"A notable thing "+i+".",importance:0.5}));
    const capped=memWeighNow(c,p).map(x=>x.m.id);
    return {weigh:r.state.memories_that_weigh_now, earlier:r.state.earlier_today, emo:r.questions.emotion&&r.questions.emotion.instructions, ego:r.questions.ego&&r.questions.ego.instructions,
      calm:r.questions.emotion&&r.questions.emotion.criteria.calm, guilt:r.questions.emotion&&r.questions.emotion.criteria.guilt, state:JSON.stringify(r.state), capped};
  });
  const wl=(E.weigh||[]).join("\n");
  ok("memories_that_weigh_now carries yesterday's hidden affair, marked secret, in the reader's format",
    /\[last night, at Emre's House \| 5\] I slept with Emre at his house while Hakan was on the night shift\. Felt: Guilty, and I want it again \(I hate that\)\. Status: secret\./.test(wl), wl);
  ok("…by the fading rules: an open matter at any age, a 4 within 90 days, a 3 from today, a 2 from yesterday; not a 2 from two or five days ago, a 3 from twenty, a 4 from a hundred, a diary",
    /My mother and I stopped speaking\. Felt: sad\. Status: open\./.test(wl)&&/I lost the job at the bakery/.test(wl)&&/argued about the rent/.test(wl)&&/three weeks ago \| 4\] Hakan and I decided/.test(wl)&&/\[yesterday at midday, at the market \| 2\] I called my sister\./.test(wl)
      &&!/fixed the shelf|lent Berk money|Dear diary|moved out of my parents|I bought bread/.test(wl), wl);
  ok("…oldest to newest", wl.indexOf("My mother")<wl.indexOf("lost the job")&&wl.indexOf("lost the job")<wl.indexOf("father left")&&wl.indexOf("father left")<wl.indexOf("decided not to have")&&wl.indexOf("decided not to have")<wl.indexOf("slept with Emre")&&wl.indexOf("slept with Emre")<wl.indexOf("argued about the rent"), wl);
  ok("no memory is sent twice: today's are in the list, so earlier_today is not sent with them again", (E.state.match(/argued about the rent/g)||[]).length===1&&E.earlier===undefined, JSON.stringify({earlier:E.earlier}));
  ok("capped at ten: the open and secret ones are kept, then the newest", E.capped.length===10&&E.capped.indexOf("m_aff")>=0&&E.capped.indexOf("m_fight")>=0&&E.capped.indexOf("x_open_old")>=0&&E.capped.indexOf("cap13")>=0&&E.capped.indexOf("x_four_60d")<0, JSON.stringify(E.capped));
  ok("the emotion question carries the fading rules, and says a hidden affair from yesterday is not Calm",
    /memories_that_weigh_now/.test(E.emo||"")&&/HOW A PAST FEELING LASTS: hours to a day, it is raw/.test(E.emo||"")&&/Importance 1–2 fades in a day or two, 3 over days to weeks, 4–5 never fully fades/.test(E.emo||"")
      &&/An open or secret matter does not fade with time alone/.test(E.emo||"")&&/Acting calm is not being calm/.test(E.emo||"")&&/cheated on their spouse yesterday and is hiding it is not Calm today/.test(E.emo||""), E.emo);
  ok("the ego question carries them too, in short", /HOW A PAST FEELING LASTS: raw for hours to a day/.test(E.ego||"")&&/does not fade until a later memory resolves it/.test(E.ego||"")&&/Do not lean on conscience by default/.test(E.ego||""), E.ego);
  ok("Calm is not for someone an open or secret memory weighs on; Guilt holds when nobody knows", /^Calm: settled; nothing much is pulling at them — not when an open or secret memory is weighing on them$/.test(E.calm||"")&&/even when nobody knows/.test(E.guilt||""), E.calm+" | "+E.guilt);

  console.log("\n[stored old defaults are upgraded]");
  await pg.evaluate(()=>{
    const old67E="The state is the scene as {{char}} took it in, ending on the line {{char}} is about to answer, and who {{char}} is. Which emotion is {{char}} mainly feeling right now, as they answer it? Judge from what just happened to {{char}} and who they are, not from the mood of the room or how anyone else feels.";
    store.setRaw(K.x_emotion_pick,old67E);
    store.setRaw(K.x_ego_pick,X_ENGINE_PROMPTS.x_ego_pick.def.split("\nThe past weighs too")[0]);
    const l=JSON.parse(JSON.stringify(EMOTIONS_DEFAULT)); l.find(e=>e.name==="Calm").desc="settled; nothing much is pulling at them"; l.find(e=>e.name==="Guilt").desc="knows they did wrong to someone; their conscience is at them";
    l.push({name:"Boredom",desc:"nothing to do",tones:["idle","bored","restless"]}); store.setRaw(K.emotions,JSON.stringify(l));
    const MB_OLD=DEFAULT_MEMBUILD.replace(/\n- status — [\s\S]*?usual answer\.\n/,"\n").replace('  "type": "",\n  "status": "",\n  "resolves": []\n}','  "type": ""\n}').replace("## LANGUAGE","MY OWN MEMORY RULE.\n\n## LANGUAGE");
    store.setRaw(K.memBuild,MB_OLD);
    store.setRaw(K.offstageEvent,DEFAULT_OFFSTAGE_EVT.split(',"status":"<open|secret|resolved, or empty>","resolves":["<an id from OPEN OR SECRET MATTERS, usually none>"]').join("").replace("\n"+_MEM_STATUS_WORLD_RULE,"")+"\nMY OFFSTAGE NOTE");
    window.__mbOld=MB_OLD;
  });
  const oldMB=await pg.evaluate(()=>window.__mbOld);
  await pg.evaluate(()=>localStorage.removeItem("sm_pipesdone")); await pg.reload(); await pg.waitForTimeout(2600);
  const U=await pg.evaluate(()=>({emo:state.x_emotion_pick===X_ENGINE_PROMPTS.x_emotion_pick.def, ego:state.x_ego_pick===X_ENGINE_PROMPTS.x_ego_pick.def,
    calm:(state.emotions||[]).find(e=>e.name==="Calm").desc, guilt:(state.emotions||[]).find(e=>e.name==="Guilt").desc, boredom:!!(state.emotions||[]).find(e=>e.name==="Boredom"),
    mb:state.memBuild, off:state.offstageEvent, stale:(window.__stalePipes||[]).slice()}));
  ok("the emotion and ego questions: a stored old default becomes the new one", U.emo&&U.ego, JSON.stringify({emo:U.emo,ego:U.ego}));
  ok("a saved emotion list gets the new Calm and Guilt, and keeps its own additions", /not when an open or secret memory/.test(U.calm)&&/even when nobody knows/.test(U.guilt)&&U.boredom, JSON.stringify({calm:U.calm,guilt:U.guilt,boredom:U.boredom}));
  ok("a stored memory builder gets status and resolves in place, the player's own rule kept", /- status — "open" when/.test(U.mb)&&/"resolves": \[\]/.test(U.mb)&&/MY OWN MEMORY RULE/.test(U.mb)&&U.mb!==oldMB, U.mb.slice(-700));
  ok("a stored world prompt gets them in place too, the player's note kept", /"resolves":/.test(U.off)&&/"secret" when that person is hiding/.test(U.off)&&/MY OFFSTAGE NOTE/.test(U.off), U.off.slice(-500));
  ok("no refresh pipe stood down", U.stale.length===0, JSON.stringify(U.stale));

  ok("no page errors", errs.length===0?true:errs.join(" | "));
  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close(); process.exit(fail?1:0);
})().catch(e=>{ console.error(e); process.exit(1); });
