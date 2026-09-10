const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage({viewport:{width:412,height:915}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file:///home/user/Multirp/index.html'); await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(900);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x||c).slice(0,400));} };

  console.log("\n[the counterweight no longer lies]");
  ok("two forces the SAME way are not called a tension", await pg.evaluate(()=>{
      // desire high + comfort high: both pull toward. This is the exact shape that produced
      // "a want hard to sit still under" + "nothing in you is braced" as a claimed conflict.
      const t=relMomentaryNarrative({st:{desire:60,comfort:50,fear:0,agitation:0}});
      return t.indexOf("Pulling the other way")===-1 && t.indexOf("Running with it")>-1
        ? true : t; }));
  ok("two forces that DO oppose are called a tension", await pg.evaluate(()=>{
      // desire high (toward) + fear high (away)
      const t=relMomentaryNarrative({st:{desire:60,fear:50,comfort:0,agitation:0}});
      return t.indexOf("Pulling the other way")>-1 ? true : t; }));
  ok("negative desire counts as pulling away", await pg.evaluate(()=>{
      const t=relMomentaryNarrative({st:{comfort:60,desire:-50,fear:0,agitation:0}});
      return t.indexOf("Pulling the other way")>-1 ? true : t; }));
  ok("a lone charge says neither", await pg.evaluate(()=>{
      const t=relMomentaryNarrative({st:{desire:60,comfort:0,fear:0,agitation:0}});
      return t.indexOf("Pulling the other way")===-1 && t.indexOf("Running with it")===-1 ? true : t; }));

  console.log("\n[every relationship is injected again]");
  ok("an absent spouse keeps their full prose", await pg.evaluate(()=>{
      const uni=state.universes[0];
      const mk=(id,name)=>({id,name,universeId:uni.id,instructions:"x",personality:"x",
        backstory:"x",style:"x",goals:"x",look:{}});
      if(!state.personas.some(p=>p.id==="p_d"))state.personas.push(mk("p_d","Duygu"));
      if(!state.personas.some(p=>p.id==="p_h"))state.personas.push(mk("p_h","Hakan"));
      if(!state.personas.some(p=>p.id==="p_e"))state.personas.push(mk("p_e","Emre"));
      const D=state.personas.find(x=>x.id==="p_d");
      D.relationships={
        p_h:{tie:"husband",relationship:"HUSBAND_PROSE_MARKER — the man she married, and the whole weight of it."},
        p_e:{tie:"friend",relationship:"FRIEND_PROSE_MARKER — her quiet anchor here."}};
      const chat=curChat(); chat.presentIds=["p_d","p_e"];   // Hakan is NOT in the room
      const sheet=relSheetBlockFull(D,{everyone:true});
      return sheet.indexOf("HUSBAND_PROSE_MARKER")>-1 && sheet.indexOf("FRIEND_PROSE_MARKER")>-1
        ? true : sheet.slice(0,300); }));
  ok("the absent one is marked as absent", await pg.evaluate(()=>{
      const D=state.personas.find(x=>x.id==="p_d");
      return relSheetBlockFull(D,{everyone:true}).indexOf("[not here right now]")>-1; }));
  ok("whoever is here is still marked here", await pg.evaluate(()=>{
      const D=state.personas.find(x=>x.id==="p_d");
      return relSheetBlockFull(D,{everyone:true}).indexOf("[here now]")>-1; }));
  /* v37.4 — the reply payload no longer sends a paragraph for someone who is not in the room; the
     character's own summary line at the top of the block is what carries them. The CONSCIENCE is
     the opposite case and is asserted below: a brake with no name on it does not hold, and the
     person it would cost you is usually the one who is absent. */
  ok("the reply payload does NOT spend a paragraph on the absent spouse", await pg.evaluate(()=>{
      const D=state.personas.find(x=>x.id==="p_d"); const chat=curChat();
      D.socialGraph="Hakan is my husband. Emre is my anchor.";
      state.relScope="present";
      const B=buildCharPromptBlocks(D,[],{recent:[],diary:[],longterm:[]},state.user,
        {chat,targetName:"Emre",targetId:"p_e"});
      return String(B.relationships||"").indexOf("HUSBAND_PROSE_MARKER")<0
        ? true : "absent paragraph still in the reply payload"; }));
  ok("but the summary line still says who he is", await pg.evaluate(()=>{
      const D=state.personas.find(x=>x.id==="p_d"); const chat=curChat();
      const B=buildCharPromptBlocks(D,[],{recent:[],diary:[],longterm:[]},state.user,
        {chat,targetName:"Emre",targetId:"p_e"});
      return /Hakan is my husband/.test(String(B.relationships||"")); }));
  ok("and the conscience still gets him in full", await pg.evaluate(()=>{
      const D=state.personas.find(x=>x.id==="p_d");
      return relSheetBlockFull(D,{everyone:true}).indexOf("HUSBAND_PROSE_MARKER")>-1; }));
  ok("the trimmed form is still available for callers that want it", await pg.evaluate(()=>{
      const D=state.personas.find(x=>x.id==="p_d");
      const trimmed=relSheetBlockFull(D);
      return trimmed.indexOf("HUSBAND_PROSE_MARKER")===-1; }));

  console.log("\n[the drives block]");
  ok("it is in the reply order, after the feeling", await pg.evaluate(()=>{
      const i=REPLY_ORDER.indexOf("drives"), f=REPLY_ORDER.indexOf("feelings_now");
      return i>-1 && i>f ? true : "drives="+i+" feelings_now="+f; }));
  ok("its four fragments are all editable", await pg.evaluate(()=>{
      show('settings'); renderPayloadList();
      Object.keys(PAYLOAD_DEFS).forEach(k=>{ try{ renderPayloadEditor(k); }catch(e){} });
      return ["drive_header","drive_toward","drive_against","drive_ego"]
        .every(k=>!!document.querySelector('textarea[data-btpl="'+k+'"]')); }));
  ok("nothing is emitted before the engine has written", await pg.evaluate(()=>{
      const D=state.personas.find(x=>x.id==="p_d"); const chat=curChat();
      delete chat._psyche;
      const B=buildTailBlocks({chat,selfP:D,selfId:D.id,selfName:D.name,targetName:"Emre",
        targetId:"p_e",multi:false,injected:{recent:[],diary:[],longterm:[]}});
      return !B.drives; }));
  ok("both passages reach the payload once written", await pg.evaluate(()=>{
      const D=state.personas.find(x=>x.id==="p_d"); const chat=curChat();
      chat._psyche={p_d:{sig:"x",toward:"TOWARD_TEXT",against:"AGAINST_TEXT"}};
      const B=buildTailBlocks({chat,selfP:D,selfId:D.id,selfName:D.name,targetName:"Emre",
        targetId:"p_e",multi:false,injected:{recent:[],diary:[],longterm:[]}});
      const s=String(B.drives||"");
      return s.indexOf("TOWARD_TEXT")>-1 && s.indexOf("AGAINST_TEXT")>-1
          && s.indexOf("WHAT PULLS YOU TOWARD IT")>-1 && s.indexOf("WHAT HOLDS YOU BACK")>-1; }));
  ok("one empty side drops only its own heading", await pg.evaluate(()=>{
      const D=state.personas.find(x=>x.id==="p_d"); const chat=curChat();
      chat._psyche={p_d:{sig:"x",toward:"ONLY_TOWARD",against:""}};
      const B=buildTailBlocks({chat,selfP:D,selfId:D.id,selfName:D.name,targetName:"Emre",
        targetId:"p_e",multi:false,injected:{recent:[],diary:[],longterm:[]}});
      const s=String(B.drives||"");
      return s.indexOf("ONLY_TOWARD")>-1 && s.indexOf("WHAT HOLDS YOU BACK")===-1; }));
  ok("no number ever reaches the block", await pg.evaluate(()=>{
      const D=state.personas.find(x=>x.id==="p_d"); const chat=curChat();
      chat._psyche={p_d:{sig:"x",toward:"a want you cannot sit still under",against:"Hakan would know"}};
      const B=buildTailBlocks({chat,selfP:D,selfId:D.id,selfName:D.name,targetName:"Emre",
        targetId:"p_e",multi:false,injected:{recent:[],diary:[],longterm:[]}});
      return /\d/.test(String(B.drives||"")) ? "digits present" : true; }));
  ok("the block forbids stating the outcome", await pg.evaluate(()=>
      /decides anything/.test(BLOCK_TPL_DEFAULTS.drive_header)
   && BLOCK_TPL_DEFAULTS.drive_ego.indexOf("do not invent a struggle")>-1));

  console.log("\n[the engine]");
  ok("the prompt is registered and editable", await pg.evaluate(()=>
      !!PROMPT_BY_KEY.psychePrompt && typeof up("psychePrompt")==="string" && up("psychePrompt").length>200));
  ok("it forbids deciding for the character", await pg.evaluate(()=>
      /You do NOT decide what/.test(up("psychePrompt"))));
  ok("it is a listed engine payload", await pg.evaluate(()=>!!epDef("psychePrompt")));
  ok("the signature moves when the situation moves", await pg.evaluate(()=>{
      const D=state.personas.find(x=>x.id==="p_d"); const chat=curChat();
      const a=psycheSig(chat,D,"p_e");
      const wasLoc=chat.location; chat.location="Somewhere else entirely";
      const b=psycheSig(chat,D,"p_e");
      chat.location=wasLoc;
      const c=psycheSig(chat,D,"p_e");
      return a!==b && a===c ? true : "a="+a+" b="+b; }));
  ok("it does not move when nothing has", await pg.evaluate(()=>{
      const D=state.personas.find(x=>x.id==="p_d"); const chat=curChat();
      return psycheSig(chat,D,"p_e")===psycheSig(chat,D,"p_e"); }));
  ok("a fresh signature does not re-fire the engine", await pg.evaluate(()=>{
      const D=state.personas.find(x=>x.id==="p_d"); const chat=curChat();
      const sig=psycheSig(chat,D,"p_e");
      chat._psyche={p_d:{sig,toward:"t",against:"a"}};
      let called=0; const real=window._writePsyche; window._writePsyche=()=>{called++;return Promise.resolve();};
      psycheRefreshIfStale(chat,D,"p_e","Emre");
      window._writePsyche=real;
      return called===0; }));

  console.log("\n[nothing else moved]");
  ok("saveSettings does not throw", await pg.evaluate(()=>{
      show('settings'); try{ saveSettings(false); return true; }catch(e){ return "threw: "+e.message; } }));
  ok("no page errors", errs.length===0?true:errs.join(" | "));
  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close(); process.exit(fail?1:0);
})();
