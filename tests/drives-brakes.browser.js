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
  // v38.2 — the chunk boxes are gone; a piece's wording opens beside its name in the piece list.
  ok("its four fragments are all editable", await pg.evaluate(()=>{
      show('settings'); renderPayloadList(); renderPayloadTemplates();
      ptEditPiece("drives");
      const got=["drive_header","drive_toward","drive_against","drive_ego"]
        .every(k=>{ const t=document.querySelector('textarea[data-btpl="'+k+'"]');
                    return !!t && t.value===blkTpl(k); });
      ptEditPiece("drives");
      return got; }));
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
  /* v62.1 — ONE SIDE IS NOT "THE TWO PULLS". This used to ship the half it had, dropping only the
     missing heading. But the block's own heading promises a conflict and its closing note says an
     empty side is genuinely empty — so what reached the model was a single unopposed push inside a
     frame claiming to be a weighing. A nudge, not a deliberation. It waits for the other side. */
  ok("one empty side holds the whole block back", await pg.evaluate(()=>{
      const D=state.personas.find(x=>x.id==="p_d"); const chat=curChat();
      chat._psyche={p_d:{sig:"x",toward:"ONLY_TOWARD",against:""}};
      const B=buildTailBlocks({chat,selfP:D,selfId:D.id,selfName:D.name,targetName:"Emre",
        targetId:"p_e",multi:false,injected:{recent:[],diary:[],longterm:[]}});
      return !B.drives ? true : String(B.drives).slice(0,160); }));
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
  /* ============ v67.1 — WHAT THIS WRITER ACTUALLY RECEIVES ============
     The audit of one live payload found the drives writer reading the gamemaster's brief, the
     social graph three times over, and — underneath all of it — a relationship accessor that has
     never existed. */
  console.log("\n[the relationship actually reaches this engine]");
  ok("relOf is gone; nothing calls a function that was never defined", (()=>{
      const src=require('fs').readFileSync('/home/user/Multirp/index.html','utf8');
      const calls=(src.match(/\brelOf\s*\(/g)||[]).length;
      return calls===0?true:calls+" live call(s) to relOf remain"; })());
  ok("relObj is what the engine reads, like every other consumer", (()=>{
      const src=require('fs').readFileSync('/home/user/Multirp/index.html','utf8');
      return /const o=targetId\?relObj\(chat,p\.id,targetId\):null;/.test(src)
        ? true : "the writer does not read relObj(chat,p.id,targetId)"; })());
  ok("the signature moves when the feelings move", await pg.evaluate(()=>{
      const u=(state.universes||[])[0]; if(!u)return "no universe";
      const p={id:"c_sig",name:"S"};
      const chat={id:"cs",universeId:u.id,gameDay:1,messages:[],rel:{}};
      const a=psycheSig(chat,p,"__user__");
      const o=relObj(chat,"c_sig","__user__"); o.st.desire=60; o.trust=40;
      const b=psycheSig(chat,p,"__user__");
      return a!==b ? true : "the signature is blind to the relationship ("+a+")"; }));
  ok("a signature read does not conjure a relationship record", await pg.evaluate(()=>{
      const u=(state.universes||[])[0];
      const chat={id:"cs2",universeId:u.id,gameDay:1,messages:[],rel:{}};
      psycheSig(chat,{id:"c_none",name:"N"},"__user__");
      return Object.keys(chat.rel).length===0 ? true : "it wrote "+JSON.stringify(Object.keys(chat.rel)); }));

  console.log("\n[the scene block is a scene, not the director's brief]");
  ok("the psyche mode exists and is what the writer asks for", (()=>{
      const src=require('fs').readFileSync('/home/user/Multirp/index.html','utf8');
      return /bits\.scene=directorContext\(chat,"psyche"\)/.test(src)
        ? true : "the writer still asks for another mode"; })());
  ok("it carries the scene and the earshot and nothing else", await pg.evaluate(()=>{
      const u=(state.universes||[])[0]; if(!u)return "no universe";
      const loc={id:"loc_psy",name:"Probe Gym",description:"A gym.",
        sublocations:[{id:"s1",name:"Front Entrance"},{id:"s2",name:"Weights"}]};
      (u.locations=u.locations||[]).push(loc);
      u.directingNotes="DIRECTOR_NOTES_MARKER";
      const chat={id:"cpsy",universeId:u.id,locationId:"loc_psy",gameDay:1,messages:[],rel:{}};
      const t=directorContext(chat,"psyche")||"";
      const leaks=[
        [/DIRECTOR_NOTES_MARKER|HOW DRAMA WORKS IN THIS WORLD/,"the director guidance"],
        [/you may bring in|WHO IS WHERE/,               "the offstage roster"],
        [/PLACES IN THIS WORLD/,                        "the venue list"],
        [/ALL TRACKERS/,                                "everyone's trackers"],
        [/WHO PEOPLE ARE TO EACH OTHER/,                "the who-is-who matrix"],
        [/CHARACTER PRESSURE POINTS/,                   "the pressure points"],
        [/WHAT CHARACTERS ARE AFTER/,                   "the standing goals"],
        [/WORLD SETTING/,                               "the world setting"],
      ].filter(([rx])=>rx.test(t)).map(([,n])=>n);
      return leaks.length===0 ? true : "still ships "+leaks.join(", "); }));
  ok("the gamemaster's own brief is untouched", await pg.evaluate(()=>{
      const u=(state.universes||[])[0];
      const chat={id:"cgm",universeId:u.id,locationId:"loc_psy",gameDay:1,messages:[],rel:{}};
      const t=directorContext(chat,"gm")||"";
      return /DIRECTOR_NOTES_MARKER/.test(t) ? true : "the gm mode lost its directing notes"; }));

  console.log("\n[one rendering of the social graph, not three]");
  ok("the writer asks for the sheets alone", (()=>{
      const src=require('fs').readFileSync('/home/user/Multirp/index.html','utf8');
      return /bits\.ties=relSheetBlockFull\(p,\{everyone:true,sheetsOnly:true\}\)/.test(src)
        ? true : "ties is not scoped to the sheets"; })());
  ok("sheetsOnly drops the note that restates them, and only for this caller", await pg.evaluate(()=>{
      const p={id:"c_sg",name:"G",socialGraph:"SOCIAL_GRAPH_MARKER text.",
               relationships:{__user__:{tie:"friend",relationship:"They go back years."}}};
      const withNote=relSheetBlockFull(p,{everyone:true})||"";
      const without =relSheetBlockFull(p,{everyone:true,sheetsOnly:true})||"";
      return (/SOCIAL_GRAPH_MARKER/.test(withNote) && !/SOCIAL_GRAPH_MARKER/.test(without)
              && /go back years/.test(without))
        ? true : JSON.stringify({withNote:withNote.slice(0,80),without:without.slice(0,80)}); }));

  console.log("\n[the readings are sent when there are readings]");
  ok("a zeroed pair sends no table of noughts", await pg.evaluate(()=>{
      const u=(state.universes||[])[0];
      const chat={id:"cz",universeId:u.id,gameDay:1,messages:[],rel:{}};
      const o=relObj(chat,"c_z","__user__");
      const live=!!(o && (REL_FAST.concat(REL_SLOW).some(k=>{
        const v=(o.st&&o.st[k]!=null)?o.st[k]:o[k]; return v?Math.round(v):0; }) || relHasContent(o)));
      return live===false ? true : "a blank record reads as live"; }));

  console.log("\n[the two pulls stopped presuming a transgression]");
  {
    const src=require('fs').readFileSync('/home/user/Multirp/index.html','utf8');
    const psy=(src.match(/const DEFAULT_PSYCHE=`([\s\S]*?)`;/)||[])[1]||"";
    ok("an ordinary moment is allowed to be ordinary",
       /Most moments are not transgressions/.test(psy)?true:"no size rule");
    ok("an empty side is stated to be a correct answer",
       /correct and ordinary answer, not a failure/.test(psy)?true:"empty is still framed as failure");
    ok("the brake may not invent a judgement nobody voiced",
       /not a spouse's judgement nobody in the material has voiced/.test(psy)?true:"the work example is not pinned");
    ok("the pull is no longer told to find what this person supplies",
       !/Include what this person supplies/.test(psy)?true:"the old mandate survives");
    ok("the brake is no longer a checklist that opens on who gets hurt",
       !/- the PERSON who would be hurt, BY NAME/.test(psy)?true:"the old checklist survives");
    ok("a named cost is still required when one is real",
       /[Aa] brake with no name on it does not hold/.test(psy)?true:"the naming rule was lost");
    ok("the moment may be about the work rather than the people",
       /the work, the money, a body, a task, someone's standing/.test(psy)?true:"no non-relational framing");
    ok("the settled view still governs both sides",
       /The SETTLED view of \{\{target\}\}/.test(psy)?true:"the alignment rule was lost");
    ok("and the length cap survives",
       /Keep each side under 70 words/.test(psy)?true:"the cap was lost");
  }
  ok("no refresh pipe stood down", await pg.evaluate(()=>{
      const sp=window.__stalePipes||[];
      return sp.length===0?true:"stale: "+sp.join(", "); }));
  ok("a goal is cut on a word, not mid-word", await pg.evaluate(()=>{
      const t=clipWords("Quietly, you also want to be seen as more than the family's fixer — to be chosen",60);
      return (!/ ch…$/.test(t) && /…$/.test(t) && t.length<=62) ? true : "got: "+t; }));

  /* v77.1 — an empty answer must not be cached as fresh, and thinking must get room. */
  console.log("\n[nothing is not an answer to cache]");
  ok("an empty pair leaves the previous record and its older sig", await pg.evaluate(async()=>{
      const chat=curChat(); const p=curCast()[0]; if(!p) return "no cast";
      chat._psyche={}; chat._psyche[p.id]={sig:"OLD",toward:"a real pull",against:"a real brake",at:1};
      const real=window.chatCompletion;
      window.chatCompletion=async()=>'{"toward":"","against":""}';
      try{ await _writePsyche(chat,p,null,state.user,"NEW"); } finally { window.chatCompletion=real; }
      const r=chat._psyche[p.id];
      return (r.sig==="OLD" && r.toward==="a real pull") ? true : JSON.stringify(r); }));
  ok("a real answer still writes, with the new sig", await pg.evaluate(async()=>{
      const chat=curChat(); const p=curCast()[0];
      chat._psyche={}; chat._psyche[p.id]={sig:"OLD",toward:"x",against:"y",at:1};
      const real=window.chatCompletion;
      window.chatCompletion=async()=>'{"toward":"she wants it said out loud","against":""}';
      try{ await _writePsyche(chat,p,null,state.user,"NEW"); } finally { window.chatCompletion=real; }
      const r=chat._psyche[p.id];
      return (r.sig==="NEW" && /said out loud/.test(r.toward) && r.against==="") ? true : JSON.stringify(r); }));
  ok("thinking room scales with the effort asked for", (()=>{
      const src=require('fs').readFileSync('/home/user/Multirp/index.html','utf8');
      return /_room=\{low:1200,medium:2400,high:4800\}/.test(src)
        ? true : "the reasoning headroom is still a flat +1200"; })());

  /* (!) v87.1 — the conscience was being handed the director's ledger: every open commitment in
     the world, under a heading written for the Gamemaster. A live payload gave this character two
     promises Duygu made to Emre about accepting his gym feedback. */
  console.log("\n[the words that bind are this character's, both directions, nobody else's]");
  ok("only promises this character gave or was given are sent", await pg.evaluate(()=>{
      const chat=curChat();
      chat.promises=[
        {id:"p1",status:"open",holderName:"Özlem",toName:"Emre",promise:"you will call him first"},
        {id:"p2",status:"open",holderName:"Emre",toName:"Özlem",promise:"you will wait for her call"},
        {id:"p3",status:"open",holderName:"Duygu",toName:"Emre",promise:"you will accept his feedback"},
        {id:"p4",status:"open",holderName:"Berker",toName:"Buket",promise:"you will not tell her"}
      ];
      const t=promiseContextForNames(chat,["Özlem"])||"";
      if(!/call him first/.test(t)) return "the character's own promise is missing";
      if(!/wait for her call/.test(t)) return "a promise owed to them is missing";
      if(/Duygu/.test(t)) return "somebody else's promise leaked in";
      if(/Berker/.test(t)) return "an unrelated pair leaked in";
      return true; }));
  ok("the drives writer asks for that list, not the director's", (()=>{
      const src=require('fs').readFileSync('/home/user/Multirp/index.html','utf8');
      const i=src.indexOf("async function _writePsyche");
      const fn=src.slice(i,src.indexOf("\nasync function",i+10));
      return /bits\.promises=promiseContextForNames\(chat,\[p\.name\]\)/.test(fn)
        && !/bits\.promises=promiseDirectorBlock/.test(fn)
        ? true : "it still sends promiseDirectorBlock"; })());
  ok("the director's heading no longer rides into the payload", await pg.evaluate(()=>{
      const chat=curChat();
      chat.promises=[{id:"p1",status:"open",holderName:"Özlem",toName:"Emre",promise:"you will call him first"}];
      const t=promiseContextForNames(chat,["Özlem"])||"";
      return !/STANDING COMMITMENTS/.test(t) && !/never write a beat/.test(t)
        ? true : "the Gamemaster's heading is still inside the value"; }));
  ok("the section label matches what is now under it", await pg.evaluate(()=>{
      const def=epDef("psychePrompt");
      const part=(def&&def.parts||[]).find(x=>x.name==="promises");
      const t=JSON.stringify(part||"");
      return /THE WORDS THAT BIND/.test(t) && /Nobody else/.test(t)
        ? true : "the separator still says only what they have GIVEN"; }));

  ok("no page errors", errs.length===0?true:errs.join(" | "));
  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close(); process.exit(fail?1:0);
})();
