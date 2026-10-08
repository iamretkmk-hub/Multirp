/* v150.65 — ONE RELATIONSHIP SHEET.
   1. "What you have found out about them since" (persona.socialFacts beside the sheet) is gone from every reply payload: the
      five fragment paths, the classic block and the classic templates; an edited ties fragment that still calls
      rel_learned_raw gets nothing there, with no error and no unknown name.
   2. What a character learns goes into that person's entry: the daily relationship read returns "relationship" (the whole
      entry, second person, the foundation kept, nothing tied to a time — the prompt says so), the parser stores what it is
      given (bounded, the dated-sentence net under it), an omitted or identical one keeps the entry, the previous text goes
      into history (the last three), toward the player too, and in the batched read.
   3. socialFacts migration: an old fact is handed to the next read for that pair as LEARNED EARLIER, then deleted once an
      entry comes back; nothing writes socialFacts.
   4. The one answered carries their whole entry in "What you know of them" (tie and relationship text, the updated one) and
      is not in the ties — a player target and a character target, switching with the target, each speaker its own. A layout
      that does not carry it (classic, or an edited fragment) keeps them in the ties.
   5. A regeneration folds what was learned in and keeps it undoable; the character editor shows the text and undoes the last
      update. 6. The fragment migration (v150.65.rel).
   Run: node tests/relationship-sheet.browser.js */
const {chromium}=require('playwright');
const path=require('path');
(async()=>{
  const b=await chromium.launch({executablePath:process.env.SM_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage({viewport:{width:412,height:915}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file://'+path.resolve(__dirname,'..','index.html')); await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(800);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x===undefined?c:x).slice(0,1400));} };

  await pg.evaluate(()=>{
    window.__setup=()=>{
      const uni=state.universes[0];
      state.personas=[
        {id:"p_a",name:"Ayla",universeId:uni.id,personality:"Ayla is sharp.",backstory:"Grew up by the docks.",look:{hair:"red hair"},style:"Short.",
         relationships:{p_b:{tie:"my older brother",relationship:"Berk raised you after your father left."},
           __user__:{tie:"neighbour",relationship:"Emre lives across the hall from you."},
           p_c:{tie:"old friend",relationship:"Cem and you grew up together.",pinned:true}}},
        {id:"p_b",name:"Berk",universeId:uni.id,personality:"Berk is loud.",look:{hair:"black hair"},style:"Loud.",
         relationships:{p_a:{tie:"little sister",relationship:"You raised Ayla after your father left."},__user__:{tie:"drinking friend",relationship:"Emre owes you a round."}}},
        {id:"p_c",name:"Cem",universeId:uni.id,personality:"Cem is away.",look:{},style:"x"}];
      state.user="Emre"; state.userBio="Emre is a carpenter."; state.userLook="Tall.";
      state.payloadTplOn=false; state.fragOn=true; state.fragments=null; state.blockTpls={}; state.relScope="dynamic";
      state.autoSpeak=false; state.narrMode=false; state.gossip=[]; state.trackOn=false; state.memory=[]; state.relOn=false; state.key="sk-test";
      store.setRaw(K.fragAdds,FRAG_SHIPPED_ADDS.map(a=>a.key).join(","));
      const c=curChat(); ["_heatBeat","activeEvent","watchingNow","dayLog","spokenLimits","dayPlacement"].forEach(k=>{ delete c[k]; });
      Object.assign(c,{universeId:uni.id,presentIds:["p_a","p_b"],emo:{},promises:[],calendar:[],intents:[],rel:{},gameDay:3,period:"Evening",
        locationId:null,location:"",subId:null,subPos:{},
        messages:[{mid:"u1",role:"user",content:'"Hi there."'},{mid:"a1",role:"assistant",speaker:"Ayla",speakerId:"p_a",content:'"Hello."'},
          {mid:"b1",role:"assistant",speaker:"Berk",speakerId:"p_b",content:'"Hey."'},{mid:"u2",role:"user",content:'"So, what now?"'}]});
      return c; };
    // one reply payload, as the fragment / template builder makes it
    window.__pay=(kind,o)=>{
      o=o||{}; const c=curChat(); const p=state.personas.find(x=>x.id===(o.speaker||"p_a"));
      if(kind==="heat")c._heatBeat={n:2,total:5}; else delete c._heatBeat;
      if(kind==="text")c.messages.forEach(m=>{ m.textMsg=true; m.textWith=p.id; }); else c.messages.forEach(m=>{ delete m.textMsg; delete m.textWith; });
      const others=presentCast(c).filter(x=>x.id!==p.id);
      const tId=("tId" in o)?o.tId:"__user__", tName=o.tName||"Emre", inj={recent:[],diary:[],longterm:[]};
      const hopts={chat:c,targetName:tName,targetId:tId,textMode:kind==="text",payloadKind:kind};
      const topts={chat:c,selfP:p,selfId:p.id,selfName:p.name,targetName:tName,targetId:tId,multi:kind==="multi",injected:inj,textMode:kind==="text",payloadKind:kind};
      const mk=()=>Object.assign({},buildCharPromptBlocks(p,others,inj,null,hopts),buildTailBlocks(topts));
      const B=mk();
      const rep={}; const m=ptBuildMessages(kind,B,[{role:"user",content:"(history)"}],{chat:c,npc:p,targetName:tName,report:rep},mk)||[];
      delete c._heatBeat;
      return {text:m.map(x=>"<<"+x.role+">>\n"+x.content).join("\n\n"),B,classic:String(B.relationships||"")};
    };
    window.__ties=t=>{ const a=t.indexOf("# WHO THESE PEOPLE ARE TO YOU"); if(a<0)return ""; const z=t.indexOf("\n# ",a+5); return t.slice(a,z<0?t.length:z); };
    window.__entry=t=>(String(t).match(/<what_they_are_to_you>[\s\S]*?<\/what_they_are_to_you>/)||[""])[0];
  });

  console.log("\n[1. what was found out is gone from every payload]");
  const L=await pg.evaluate(()=>{ __setup();
    const p=state.personas[0]; p.socialFacts={p_b:{text:"has stopped answering the phone",day:2},p_c:{text:"is invited to your table next week",day:2},__user__:{text:"lent you a ladder",day:2}};
    const r={};
    ["solo","multi","gm","text","heat"].forEach(k=>{ r[k]=__pay(k).text; });
    r.classicBlock=__pay("solo").classic;
    state.fragOn=false; state.payloadTplOn=true; r.classicTpl=__pay("solo").text; state.fragOn=true; state.payloadTplOn=false;
    // an edited ties fragment that still has the old paragraph
    const L=JSON.parse(JSON.stringify(FRAG_DEFAULTS)); const t=L.find(f=>f.id==="ties");
    t.options[0].text=FRAG_DEFAULTS_V150_64_OLD.ties.options[0].text.replace("# WHO THESE PEOPLE ARE TO YOU","# MY PEOPLE")+"\n\nTHINGS YOU LEARNED ABOUT THESE PEOPLE:\n{{call//rel_learned_raw}}";
    state.fragments=L; _fragMigratedFor=L;
    const c=curChat(), pp=state.personas[0], others=presentCast(c).filter(x=>x.id!==pp.id);
    const mk=()=>Object.assign({},buildCharPromptBlocks(pp,others,{},null,{chat:c,targetName:"Emre",targetId:"__user__",payloadKind:"solo"}),buildTailBlocks({chat:c,selfP:pp,selfId:pp.id,selfName:pp.name,targetName:"Emre",targetId:"__user__",payloadKind:"solo",injected:{recent:[],diary:[],longterm:[]}}));
    const rep={unknownCall:[],unknownVar:[],emptyVar:[]};
    const srcs=ptSources(mk(),mk); const v=ptResolve(srcs,"rel_learned_raw",null,rep);
    r.edited=__pay("solo").text; r.editedUnknown=rep.unknownCall; r.editedVal=v;
    state.fragments=null; _fragMigratedFor=null;
    return r; });
  const FOUND=/found out about them|stopped answering the phone|invited to your table|lent you a ladder|THINGS YOU LEARNED/;
  ok("no fragment path carries what was found out (solo, multi, gm, text, heat)", ["solo","multi","gm","text","heat"].every(k=>!FOUND.test(L[k])&&/# WHO THESE PEOPLE ARE TO YOU/.test(L[k])),
    ["solo","multi","gm","text","heat"].filter(k=>FOUND.test(L[k])).join(",")||"no ties at all");
  ok("nor the classic block, nor the classic templates", !FOUND.test(L.classicBlock)&&/Berk raised you/.test(L.classicBlock)&&!FOUND.test(L.classicTpl)&&/Berk raised you/.test(L.classicTpl), L.classicBlock);
  ok("an edited ties fragment that still calls rel_learned_raw: that paragraph drops, the rest is sent, no unknown name", !FOUND.test(L.edited)&&/# MY PEOPLE/.test(L.edited)&&/Berk raised you/.test(L.edited)
    &&L.editedVal===""&&L.editedUnknown.indexOf("rel_learned_raw")<0, JSON.stringify({u:L.editedUnknown,v:L.editedVal})+"\n"+__tiesOf(L.edited));
  function __tiesOf(t){ const a=t.indexOf("# MY PEOPLE"); return a<0?t.slice(0,600):t.slice(a,a+600); }
  ok("the shipped ties fragment has no found-out wording and no rel_learned_raw; the data name is still known (RAW_DATA_KEYS)", await pg.evaluate(()=>{
    const t=JSON.stringify(FRAG_DEFAULTS.find(f=>f.id==="ties"));
    return (!/found out|rel_learned_raw/.test(t)&&RAW_DATA_KEYS.indexOf("rel_learned_raw")>=0&&RAW_DATA_KEYS.indexOf("target_rel_raw")>=0
      &&!FRAG_TPL_CARRY.some(c=>c.key==="rel_learned"))?true:t.slice(0,400); }));
  ok("nothing reads socialFacts for a reply or the screens any more (socialFactLines is gone)", await pg.evaluate(()=>{
    const code=f=>String(f).replace(/\/\*[\s\S]*?\*\//g,"").replace(/\/\/.*$/gm,"");
    const s=[...document.scripts].map(x=>x.textContent).join("\n").replace(/\/\*[\s\S]*?\*\//g,"").replace(/^[ \t]*\/\/.*$/gm,"");
    const uses=(s.match(/socialFactOf\(/g)||[]).length;   // its definition and the daily read's one call
    return (typeof socialFactLines==="undefined"&&!/socialFact/.test(code(relSheetBlockFull))&&!/socialFact/.test(code(buildCharPromptBlocks))&&!/socialFact/.test(code(editPersona))
      &&uses===2)?true:"socialFactOf( x"+uses; }));

  console.log("\n[2. the daily read updates the entry]");
  await pg.evaluate(()=>{
    window.__calls=[]; window.__ans=[];
    // what is saved: a snapshot of the cast at each persistPersonas (the store itself is IndexedDB)
    window.__persisted=null; if(!window.__realPersist){ window.__realPersist=window.persistPersonas;
      window.persistPersonas=function(){ window.__persisted=JSON.parse(JSON.stringify(state.personas)); return window.__realPersist.apply(this,arguments); }; }
    window.__realChat=window.__realChat||window.chatCompletion;
    window.chatCompletion=async(msgs,model,opts)=>{ __calls.push({msgs,opts}); const a=__ans.shift(); return typeof a==="string"?a:JSON.stringify(a||{}); };
    window.__day=async(fromId,toId,toName,ans,day)=>{ __ans.push(ans); const c=curChat(); const p=state.personas.find(x=>x.id===fromId);
      await evalRelationship(c,p,toId,toName,null,[],day||c.gameDay); return __calls[__calls.length-1]; };
  });
  const D=await pg.evaluate(async()=>{ __setup(); window.__calls=[];
    const z=d=>Object.assign({trust:0,affection:2,respect:0,familiarity:1,jealousy:0,desire:0,comfort:0,fear:0,agitation:0,description:"You feel steady with him."},d||{});
    const p=state.personas[0], r={};
    const t1="Berk raised you after your father left. He told you he has stopped answering Mum's calls, and you believe him.";
    const call=await __day("p_a","p_b","Berk",z({relationship:t1}),3);
    r.sys=call.msgs.map(m=>m.role==="system"?m.content:"").join("\n"); r.umsg=call.msgs.map(m=>m.role==="user"?m.content:"").join("\n");
    r.e1=JSON.parse(JSON.stringify(p.relationships.p_b));
    // omitted → kept; identical → kept, no history
    await __day("p_a","p_b","Berk",z({}),4); r.omit=JSON.parse(JSON.stringify(p.relationships.p_b));
    await __day("p_a","p_b","Berk",z({relationship:t1}),5); r.same=JSON.parse(JSON.stringify(p.relationships.p_b));
    // three more updates: the history keeps the last three previous versions
    await __day("p_a","p_b","Berk",z({relationship:"V2. Berk raised you."}),6);
    await __day("p_a","p_b","Berk",z({relationship:"V3. Berk raised you."}),7);
    await __day("p_a","p_b","Berk",z({relationship:"V4. Berk raised you."}),8);
    r.e4=JSON.parse(JSON.stringify(p.relationships.p_b));
    // the net under the prompt's rule: a sentence tied to a time is dropped; the rest stored as given
    await __day("p_a","p_b","Berk",z({relationship:"Berk raised you. He is coming to your table next week. He told you about the debt."}),9);
    r.dated=p.relationships.p_b.relationship;
    // bounded
    await __day("p_a","p_b","Berk",z({relationship:("Berk raised you and taught you to mend nets on the harbour wall. ").repeat(25)}),10);
    r.long=p.relationships.p_b.relationship.length;
    // own name at the start becomes "You"
    await __day("p_a","p_c","Cem",z({relationship:"Ayla grew up with Cem on the same street."}),10);
    r.person=p.relationships.p_c.relationship;
    // toward the player
    await __day("p_a","__user__","Emre",z({relationship:"Emre lives across the hall from you. He fixed your door without being asked."}),10);
    r.user=p.relationships.__user__;
    // a person with no entry yet
    delete p.relationships.p_c; await __day("p_a","p_c","Cem",z({relationship:"Cem came back to town; you knew him as a boy."}),11);
    r.fresh=p.relationships.p_c;
    return r; });
  ok("the stored prompt (relPrompt) asks for the whole updated entry, the foundation kept, nothing tied to a time, at most ~700 characters, omitted when nothing durable changed",
    /WHAT THEY LEARNED GOES INTO THE RELATIONSHIP/.test(D.sys)&&/Keep the foundation: the kinship or role, the shared history, everything the author wrote/.test(D.sys)
    &&/Leave out anything tied to a time: an invitation, a plan, an appointment, "next week"/.test(D.sys)&&/at most about 700 characters/.test(D.sys)
    &&/If nothing durable changed, LEAVE THE FIELD OUT/.test(D.sys)&&/"relationship": "<the whole updated relationship entry/.test(D.sys)&&!/social_fact/.test(D.sys), D.sys.slice(-2200));
  ok("the read's message asks for it too, with the foundation, and no social_fact", /ALSO: "relationship" — Ayla's whole relationship entry for Berk \(the FOUNDATION above\)/.test(D.umsg)
    &&/FOUNDATION — who Berk already is to Ayla[^\n]*my older brother — Berk raised you after your father left\./.test(D.umsg)&&/"next week", "tomorrow", "tonight": those are kept on the calendar/.test(D.umsg)
    &&!/social_fact/.test(D.umsg), D.umsg.slice(-1500));
  ok("the parser stores what it is given, in place of the entry; the tie, the pin and the old text (history) stay", D.e1.relationship==="Berk raised you after your father left. He told you he has stopped answering Mum's calls, and you believe him."
    &&D.e1.tie==="my older brother"&&D.e1.learnedDay===3&&JSON.stringify(D.e1.history)===JSON.stringify([{text:"Berk raised you after your father left.",day:3}]), JSON.stringify(D.e1));
  ok("omitted: the entry is kept as it is; the same text again: nothing changes", JSON.stringify(D.omit)===JSON.stringify(D.e1)&&JSON.stringify(D.same)===JSON.stringify(D.e1), JSON.stringify([D.omit,D.same]));
  ok("the history keeps the last three previous versions, each with its day", D.e4.relationship==="V4. Berk raised you."&&D.e4.history.length===3
    &&D.e4.history.map(h=>h.text).join("|")==="Berk raised you after your father left. He told you he has stopped answering Mum's calls, and you believe him.|V2. Berk raised you.|V3. Berk raised you."
    &&D.e4.history.map(h=>h.day).join(",")==="6,7,8", JSON.stringify(D.e4));
  ok("a sentence tied to a time is dropped (the net under the prompt's rule), the rest kept", D.dated==="Berk raised you. He told you about the debt.", D.dated);
  ok("bounded to about 700 characters", D.long<=700&&D.long>500, String(D.long));
  ok("written to the character: their own name at the start becomes \"You\"", D.person==="You grew up with Cem on the same street.", D.person);
  ok("toward the player too", D.user.relationship==="Emre lives across the hall from you. He fixed your door without being asked."&&D.user.tie==="neighbour"&&D.user.history.length===1, JSON.stringify(D.user));
  ok("a person with no entry yet gets one", D.fresh&&D.fresh.relationship==="Cem came back to town; you knew him as a boy."&&D.fresh.tie===""&&D.fresh.learnedDay===11, JSON.stringify(D.fresh));

  const BT=await pg.evaluate(async()=>{ __setup(); window.__calls=[];
    const z=(n,d)=>Object.assign({target:n,trust:0,affection:0,respect:0,familiarity:0,jealousy:0,desire:0,comfort:0,fear:0,agitation:0,description:"Steady."},d||{});
    __ans.push({targets:[z("Emre",{relationship:"Emre lives across the hall from you. He came to the flat when the pipe burst."}),z("Berk",{})]});
    const c=curChat(), p=state.personas[0];
    await evalRelationshipsBatch(c,p,[{id:"__user__",name:"Emre"},{id:"p_b",name:"Berk"}],[],[],3);
    const u=__calls[0].msgs.map(m=>m.content).join("\n");
    return {n:__calls.length,u,user:p.relationships.__user__,berk:p.relationships.p_b}; });
  ok("the batched daily read asks each person for \"relationship\" and applies each answer to its own entry", BT.n===1&&/ALSO, per person: "relationship" — Ayla's whole relationship entry for them/.test(BT.u)&&!/social_fact/.test(BT.u)
    &&BT.user.relationship==="Emre lives across the hall from you. He came to the flat when the pipe burst."&&BT.berk.relationship==="Berk raised you after your father left."&&!BT.berk.history, JSON.stringify([BT.n,BT.user,BT.berk]));

  console.log("\n[3. the old social facts: fed to the next read, then deleted]");
  const M=await pg.evaluate(async()=>{ __setup(); window.__calls=[];
    const p=state.personas[0]; p.socialFacts={p_b:{text:"Berk — has stopped answering the phone",day:2},p_c:{text:"is invited to your table next week",day:2}};
    const z=d=>Object.assign({trust:0,affection:0,respect:0,familiarity:0,jealousy:0,desire:0,comfort:0,fear:0,agitation:0,description:"x"},d||{});
    const c1=await __day("p_a","p_b","Berk",z({}),3);      // no entry back: the fact stays for the next read
    const kept=JSON.stringify(p.socialFacts);
    const c2=await __day("p_a","p_b","Berk",z({relationship:"Berk raised you after your father left. He has stopped answering the phone."}),4);
    const u2=c2.msgs.map(m=>m.content).join("\n");
    const after=JSON.stringify(p.socialFacts);
    await __day("p_a","p_c","Cem",z({relationship:"Cem and you grew up together."}),4);
    const gone=("socialFacts" in p)?JSON.stringify(p.socialFacts):"(removed)";
    const persisted=(window.__persisted||[]).find(x=>x.id==="p_a")||{_none:true};
    // nothing writes socialFacts: a read with no old fact leaves none
    const p2=state.personas[1]; await __day("p_b","p_a","Ayla",z({relationship:"You raised Ayla after your father left. She told you she is opening a shop."}),5);
    return {u1:c1.msgs.map(m=>m.content).join("\n"),kept,u2,after,gone,persistedFacts:("socialFacts" in persisted)?JSON.stringify(persisted.socialFacts):"(none)",persistedReal:!persisted._none&&/stopped answering the phone/.test(persisted.relationships.p_b.relationship),p2:("socialFacts" in p2),
      entry:p.relationships.p_b.relationship}; });
  ok("the next read for that pair is handed the old fact as LEARNED EARLIER, to fold into the entry", /LEARNED EARLIER — something Ayla found out about Berk before, kept apart from the relationship until now: Berk — has stopped answering the phone/.test(M.u1)
    &&/there is something LEARNED EARLIER to fold in/.test(M.u1), M.u1.slice(0,1200));
  ok("no entry came back: the fact is kept for the next read", /p_b/.test(M.kept), M.kept);
  ok("an entry came back: that fact is deleted, the other person's stays until their read", !/p_b/.test(M.after)&&/p_c/.test(M.after)&&/stopped answering the phone/.test(M.entry), M.after);
  ok("the last one folded in: the store is gone, and saved that way; nothing creates one", M.gone==="(removed)"&&M.persistedFacts==="(none)"&&M.persistedReal===true&&M.p2===false, JSON.stringify(M));
  ok("a universe reset still clears it (PERSONA_PLAY_KEYS; run in tests/universe-reset.browser.js)", await pg.evaluate(()=>{ const s=[...document.scripts].map(x=>x.textContent).join("\n");
    return /const PERSONA_PLAY_KEYS=\[[^\]]*"socialFacts"/.test(s)&&/p\.socialFacts=\{\}/.test(s); }));

  console.log("\n[4. the one answered carries their whole entry; the ties do not]");
  const T=await pg.evaluate(async()=>{ __setup(); window.__calls=[];
    const z=d=>Object.assign({trust:0,affection:0,respect:0,familiarity:0,jealousy:0,desire:0,comfort:0,fear:0,agitation:0,description:"x"},d||{});
    await __day("p_a","__user__","Emre",z({relationship:"Emre lives across the hall from you. He told you his wife only says 'iyiyim' on the phone before the line goes dead."}),3);
    const r={};
    ["solo","multi","gm","text","heat"].forEach(k=>{ const t=__pay(k).text; r[k]={ties:__ties(t),entry:__entry(t),all:t}; });
    const ch=__pay("multi",{tId:"p_b",tName:"Berk"}).text; r.char={ties:__ties(ch),entry:__entry(ch),all:ch};
    const back=__pay("solo").text; r.back={ties:__ties(back),entry:__entry(back)};
    const bk=__pay("multi",{speaker:"p_b",tId:"p_a",tName:"Ayla"}).text; r.berk={ties:__ties(bk),entry:__entry(bk)};
    state.fragOn=false; state.payloadTplOn=true; const cl=__pay("solo"); r.classic={text:cl.text,block:cl.classic}; state.fragOn=true; state.payloadTplOn=false;
    // an edited "What you know of them" with no target_rel_raw: the one answered stays in the ties
    const L=JSON.parse(JSON.stringify(FRAG_DEFAULTS)); const ts=L.find(f=>f.id==="target_sheet"); ts.text="<their_backstory>{{call//target_bio_raw}}</their_backstory>";
    state.fragments=L; _fragMigratedFor=L; const ed=__pay("solo").text; r.edited={ties:__ties(ed),entry:__entry(ed)}; state.fragments=null; _fragMigratedFor=null;
    // a stranger player: no entry, unless play has written into it
    const p=state.personas[0]; p.relationships.__user__={tie:"stranger",relationship:"You have never met."}; const st=__pay("solo").text; r.stranger={ties:__ties(st),entry:__entry(st)};
    p.relationships.__user__={tie:"stranger",relationship:"You have never met. He held the door for you at the bakery.",learnedDay:3}; const sl=__pay("solo").text; r.strangerLearned={ties:__ties(sl),entry:__entry(sl)};
    // the only tie is the one answered: no empty ties heading
    p.relationships={__user__:{tie:"neighbour",relationship:"Emre lives across the hall from you."}}; const only=__pay("solo").text; r.only={ties:__ties(only),entry:__entry(only)};
    return r; });
  const PLAYER_ENTRY="<what_they_are_to_you>What Emre is to you, in your own words: neighbour.\nEmre lives across the hall from you. He told you his wife only says 'iyiyim' on the phone before the line goes dead.\nThat, and what Emre shows and says in front of you, is what you have of Emre — what goes on inside Emre is not yours to know.</what_they_are_to_you>";
  ok("the player answered, on every path: their tie and their updated relationship text are in \"What you know of them\", once", ["solo","multi","gm","text","heat"].every(k=>T[k].entry===PLAYER_ENTRY&&(T[k].all.match(/iyiyim/g)||[]).length===1),
    ["solo","multi","gm","text","heat"].map(k=>k+": "+T[k].entry).join("\n"));
  ok("…and not in the ties, which still carry everyone else (here, pinned)", ["solo","multi","gm","text","heat"].every(k=>!/• \[Emre/.test(T[k].ties)&&(k==="text"||/• \[Berk — my older brother\]/.test(T[k].ties))&&/• \[Cem — old friend\]/.test(T[k].ties)),
    T.solo.ties);
  ok("…and the entry sits in the target's section, after the heading for who you are responding to", /# ⚠️ THIS IS WHO YOU ARE RESPONDING TO ⚠️[\s\S]*<what_they_are_to_you>/.test(T.solo.all)&&T.solo.all.indexOf("<what_they_are_to_you>")>T.solo.all.indexOf("# WHO THESE PEOPLE ARE TO YOU"), "order");
  ok("a character answered: their tie and relationship text are with them, they are not in the ties, and the player is", T.char.entry==="<what_they_are_to_you>What Berk is to you, in your own words: my older brother.\nBerk raised you after your father left.\nThat, and what Berk shows and says in front of you, is what you have of Berk — what goes on inside Berk is not yours to know.</what_they_are_to_you>"
    &&!/• \[Berk/.test(T.char.ties)&&/• \[Emre — neighbour\]\n  Emre lives across the hall from you\. He told you his wife/.test(T.char.ties), T.char.ties+"\n"+T.char.entry);
  ok("the target changes back: the next reply follows (Emre with his entry, Berk back in the ties)", T.back.entry===PLAYER_ENTRY&&/• \[Berk — my older brother\]/.test(T.back.ties)&&!/• \[Emre/.test(T.back.ties), T.back.ties);
  ok("another speaker answering someone else uses their own sheet and their own target", /What Ayla is to you, in your own words: little sister\.\nYou raised Ayla after your father left\./.test(T.berk.entry)
    &&!/• \[Ayla/.test(T.berk.ties)&&/• \[Emre — drinking friend\]/.test(T.berk.ties), T.berk.ties+"\n"+T.berk.entry);
  ok("the classic layout is as it was: the one answered stays in the ties", /• \[Emre — neighbour\]/.test(T.classic.block)&&/• \[Emre — neighbour\]/.test(T.classic.text)&&!/iyiyim[\s\S]*iyiyim/.test(T.classic.text), T.classic.block);
  ok("an edited \"What you know of them\" that does not carry the entry: the one answered stays in the ties (nothing lost)", /• \[Emre — neighbour\]\n  Emre lives across the hall/.test(T.edited.ties)&&T.edited.entry==="", T.edited.ties);
  ok("a stranger player: nothing, as before; once play has written into the entry, it is sent with them", T.stranger.entry===""&&!/Emre/.test(T.stranger.ties)
    &&T.strangerLearned.entry==="<what_they_are_to_you>You have never met. He held the door for you at the bakery.\nThat, and what Emre shows and says in front of you, is what you have of Emre — what goes on inside Emre is not yours to know.</what_they_are_to_you>"
    &&!/• \[Emre/.test(T.strangerLearned.ties), JSON.stringify([T.stranger,T.strangerLearned]));
  ok("the one answered was the only tie: no ties heading over nothing", T.only.ties===""&&/Emre lives across the hall from you\./.test(T.only.entry), JSON.stringify(T.only));

  const MS=await pg.evaluate(async()=>{ __setup();
    // a two-character scene through the real multi builder: each speaker's payload, each with its own target
    const c=curChat(); const a=state.personas[0], bk=state.personas[1];
    const B1=buildCharPromptBlocks(a,[bk],{},null,{chat:c,targetName:"Berk",targetId:"p_b",payloadKind:"multi"});
    const B2=buildCharPromptBlocks(bk,[a],{},null,{chat:c,targetName:"Ayla",targetId:"p_a",payloadKind:"multi"});
    return {a:[B1._rt.target_tie_raw,B1._rt.target_rel_raw,B1._rl.rel_sheet_raw],b:[B2._rt.target_tie_raw,B2._rt.target_rel_raw,B2._rl.rel_sheet_raw]}; });
  ok("multi-character: each speaker's data names their own target's entry and leaves it out of their own ties",
    MS.a[0]==="my older brother"&&MS.a[1]==="Berk raised you after your father left."&&!/Berk/.test(MS.a[2])&&/Emre/.test(MS.a[2])
    &&MS.b[0]==="little sister"&&MS.b[1]==="You raised Ayla after your father left."&&!/Ayla/.test(MS.b[2])&&/Emre/.test(MS.b[2]), JSON.stringify(MS));

  console.log("\n[5. regeneration keeps what was learned; the editor shows it and undoes]");
  const G=await pg.evaluate(async()=>{ __setup(); window.__calls=[];
    const p=state.personas[0];
    p.relationships.p_b={tie:"my older brother",relationship:"Berk raised you. He told you about the debt to the harbour master.",learnedDay:3,history:[{text:"Berk raised you.",day:3}]};
    p.relationshipsGen="x";
    __ans.push(JSON.stringify({"Berk":{tie:"older brother",relationship:"Berk raised you after your father left; you owe him more than you say."},"Emre":{tie:"neighbour",relationship:"Emre lives across the hall from you."}}));
    await generateRelationshipsFor(p,state.universes[0],"",{background:true});
    const u=(__calls[0]&&__calls[0].msgs||[]).map(m=>m.content).join("\n");
    return {u,e:JSON.parse(JSON.stringify(p.relationships.p_b)),user:JSON.parse(JSON.stringify(p.relationships.__user__))}; });
  ok("the generator is handed each entry play wrote into, to carry into the new one", /WHAT Ayla HAS LEARNED IN PLAY[^\n]*\n- Berk: Berk raised you\. He told you about the debt to the harbour master\./.test(G.u), G.u.slice(-700));
  ok("the regenerated entry keeps the learned text in its history (undo brings it back) and its mark", G.e.relationship==="Berk raised you after your father left; you owe him more than you say."&&G.e.learnedDay===3
    &&G.e.history.length===2&&G.e.history[1].text==="Berk raised you. He told you about the debt to the harbour master."&&G.e.history[1].regen===true, JSON.stringify(G.e));
  ok("an entry play never wrote into gets no history", !G.user.history&&!G.user.learnedDay, JSON.stringify(G.user));

  const E=await pg.evaluate(async()=>{ __setup();
    const p=state.personas[0];
    p.relationships.p_b={tie:"my older brother",relationship:"V3 text.",learnedDay:5,history:[{text:"V1 text.",day:4},{text:"V2 text.",day:5}]};
    editPersona("p_a");
    const host=document.getElementById('peRelPins');
    const row=host.querySelector('.relPinRow[data-id="p_b"]');
    const r={text:row&&row.textContent,hasBtn:!!(row&&row.querySelector('button.relUndo')),userBtn:!!host.querySelector('.relPinRow[data-id="__user__"] button.relUndo')};
    host.querySelector('input.relPin[data-id="p_c"]').checked=false;   // an unsaved tick stays through an undo
    host.querySelector('.relPinRow[data-id="p_b"] button.relUndo').click();
    r.after1=p.relationships.p_b.relationship; r.h1=p.relationships.p_b.history.length;
    r.text1=host.querySelector('.relPinRow[data-id="p_b"]').textContent; r.tick=host.querySelector('input.relPin[data-id="p_c"]').checked;
    host.querySelector('.relPinRow[data-id="p_b"] button.relUndo').click();
    r.after2=p.relationships.p_b.relationship; r.h2=p.relationships.p_b.history.length; r.learned2=p.relationships.p_b.learnedDay;
    r.btn2=!!host.querySelector('.relPinRow[data-id="p_b"] button.relUndo');
    r.saved=(((window.__persisted||[]).find(x=>x.id==="p_a")||{}).relationships||{}).p_b; r.saved=r.saved&&r.saved.relationship;
    savePersona();
    const q=state.personas.find(x=>x.id==="p_a");
    r.afterSave=q.relationships.p_b.relationship; r.pinC=q.relationships.p_c.pinned;
    return r; });
  ok("\"Who they know\" shows each tie's relationship text as it stands, when it was updated, and \"Undo last update\" while there is an earlier version",
    /V3 text\./.test(E.text)&&/Updated from play, day 5/.test(E.text)&&/2 earlier versions kept/.test(E.text)&&E.hasBtn&&!E.userBtn, JSON.stringify(E));
  ok("undo restores the previous text, one step at a time, saved at once; with none left the button goes and the mark with it",
    E.after1==="V2 text."&&E.h1===1&&/V2 text\./.test(E.text1)&&E.after2==="V1 text."&&E.h2===0&&E.learned2===undefined&&!E.btn2&&E.saved==="V1 text.", JSON.stringify(E));
  ok("an unsaved tick survives the undo, and saving keeps both", E.tick===false&&E.afterSave==="V1 text."&&E.pinC===false, JSON.stringify(E));

  console.log("\n[6. the fragment migration (v150.65.rel)]");
  const F=await pg.evaluate(()=>{
    const run=L=>{ store.setRaw(K.fragAdds,FRAG_SHIPPED_ADDS.map(a=>a.key).filter(k=>k!=="v150.65.rel").join(","));
      state.fragments=L; _fragMigratedFor=null; fragList(); return state.fragments; };
    const def=id=>JSON.parse(JSON.stringify(FRAG_DEFAULTS.find(f=>f.id===id)));
    const old=id=>JSON.parse(JSON.stringify(FRAG_DEFAULTS_V150_64_OLD[id]));
    const r={};
    // unedited v150.64 defaults: both replaced
    let L=FRAG_DEFAULTS.map(f=>f.id==="ties"||f.id==="target_sheet"?old(f.id):JSON.parse(JSON.stringify(f)));
    L=run(L); r.plain=[_fragCanon(L.find(f=>f.id==="ties"))===_fragCanon(def("ties")),_fragCanon(L.find(f=>f.id==="target_sheet"))===_fragCanon(def("target_sheet"))];
    r.saved=JSON.parse(store.raw(K.fragments,"[]")).some(f=>f.id==="target_sheet"&&/target_rel_raw/.test(f.text));
    // edited: the ties keep everything the user wrote; an edited target_sheet with the old paragraph word for word gets the new one
    const t=old("ties"); t.options[0].text=t.options[0].text.replace("# WHO THESE PEOPLE ARE TO YOU","# MY PEOPLE");
    const s=old("target_sheet"); s.text="# CUSTOM\n"+s.text;
    const s2=old("target_sheet"); s2.text="<what_they_are_to_you>My own words: {{call//target_tie_raw}}.</what_they_are_to_you>";
    L=run(FRAG_DEFAULTS.map(f=>f.id==="ties"?t:f.id==="target_sheet"?s:JSON.parse(JSON.stringify(f))));
    const sNow=L.find(f=>f.id==="target_sheet").text, tNow=L.find(f=>f.id==="ties").options[0].text;
    r.edited={ties:tNow===t.options[0].text,sheet:sNow.indexOf("# CUSTOM\n<their_backstory>")===0&&/\{\{call\/\/target_rel_raw\}\}/.test(sNow)&&sNow.indexOf(FRAG_DEFAULTS_V150_64_OLD.target_sheet.text.match(/<what_they_are_to_you>[\s\S]*?<\/what_they_are_to_you>/)[0])<0};
    L=run(FRAG_DEFAULTS.map(f=>f.id==="target_sheet"?s2:JSON.parse(JSON.stringify(f))));
    r.own=L.find(f=>f.id==="target_sheet").text===s2.text;
    r.once=(()=>{ const s3=old("target_sheet"); store.setRaw(K.fragAdds,FRAG_SHIPPED_ADDS.map(a=>a.key).join(",")); state.fragments=FRAG_DEFAULTS.map(f=>f.id==="target_sheet"?s3:JSON.parse(JSON.stringify(f))); _fragMigratedFor=null; fragList();
      return _fragCanon(state.fragments.find(f=>f.id==="target_sheet"))===_fragCanon(s3); })();
    state.fragments=null; _fragMigratedFor=null; store.setRaw(K.fragAdds,FRAG_SHIPPED_ADDS.map(a=>a.key).join(","));
    return r; });
  ok("a saved list still on the v150.64 defaults gets the new ties and \"What you know of them\", and is saved", F.plain[0]&&F.plain[1]&&F.saved, JSON.stringify(F));
  ok("an edited ties fragment is the user's and stays; an edited \"What you know of them\" with the shipped paragraph word for word gets the new paragraph, the rest kept",
    F.edited.ties&&F.edited.sheet, JSON.stringify(F.edited));
  ok("one with its own wording there is left alone; and the migration runs once", F.own&&F.once, JSON.stringify(F));

  await pg.evaluate(()=>{ if(window.__realChat)window.chatCompletion=window.__realChat; });
  ok("no page errors", errs.length===0?true:errs.join(" | "));
  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close(); process.exit(fail?1:0);
})().catch(e=>{ console.error(e); process.exit(1); });
