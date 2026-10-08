/* v150.45 — THE CONSISTENCY NOTE. The reply check (v150.30) marks a reply that is out of character or writes the
   player's part, but nothing told the character. Their NEXT reply now carries a one-time note at the end of the
   guardrails — on the whole block, as its own section (callable from a fragment), and as a fragment option — and only
   that one reply: the note goes once a newer reply of theirs exists.  Run: node tests/consistency-note.browser.js */
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:process.env.SM_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage({viewport:{width:412,height:915}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file://'+require('path').resolve(__dirname,'..','index.html')); await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(800);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x===undefined?c:x).slice(0,700));} };

  await pg.evaluate(()=>{
    window.__setup=(flags,who)=>{
      const uni=state.universes[0];
      state.personas=[{id:"p_a",name:"Ayla",universeId:uni.id,personality:"x",look:{},style:"s"},{id:"p_b",name:"Berk",universeId:uni.id,personality:"x",look:{},style:"s"}];
      state.user="Emre";
      const c=curChat(); Object.assign(c,{universeId:uni.id,presentIds:["p_a","p_b"],emo:{},
        messages:[{mid:"u1",role:"user",content:'"Hi."'},{mid:"a1",role:"assistant",speaker:"Ayla",speakerId:"p_a",content:'"Hello."',replyFlags:flags||[]},
          {mid:"b1",role:"assistant",speaker:"Berk",speakerId:"p_b",content:'"Hey."'},{mid:"u2",role:"user",content:'"So?"'}]});
      return c; };
    window.__tail=(id)=>{ const c=curChat(), p=state.personas.find(x=>x.id===(id||"p_a"));
      return buildTailBlocks({chat:c,selfP:p,selfId:p.id,selfName:p.name,targetName:"Emre",targetId:"__user__",injected:{recent:[],diary:[],longterm:[]}}); };
  });

  console.log("\n[the note]");
  const C=await pg.evaluate(()=>{ __setup(["character"]); const B=__tail(); return {g:B.final_guardrails,sec:B._rails.consistency_note,f:B._railFlags}; });
  ok("out of character: the note ends the guardrails, addressed to Ayla", /LAST TIME YOU SLIPPED OUT OF CHARACTER/.test(C.g)&&/sound like Ayla/.test(C.g)&&C.g.trim().endsWith(C.sec.trim())&&C.f.broke_character===true, (C.g||"").slice(-400));
  const P=await pg.evaluate(()=>{ __setup(["player","character"]); const B=__tail(); return {g:B.final_guardrails}; });
  ok("both flags: both notes, the player's named", /SLIPPED OUT OF CHARACTER/.test(P.g)&&/LAST TIME YOU WROTE Emre'S PART/.test(P.g), (P.g||"").slice(-500));
  ok("(v150.49) repeated, and lost track: their own notes, and the flags fragments can test", await pg.evaluate(()=>{ __setup(["repeat","continuity"]); const B=__tail(), g=B.final_guardrails;
      return (/LAST TIME YOU REPEATED YOURSELF/.test(g)&&/LAST TIME YOU LOST TRACK OF THE SCENE/.test(g)&&B._railFlags.repeated===true&&B._railFlags.lost_track===true
        &&/LAST TIME YOU REPEATED YOURSELF/.test(fragCompile("solo",ptCondFlags({repeated:true}),{})))?true:(g||"").slice(-600); }));   // v150.59 — the wording is an option of its own
  ok("no flag: no note", await pg.evaluate(()=>{ __setup([]); const B=__tail(); return (!/LAST TIME YOU/.test(B.final_guardrails)&&!B._rails.consistency_note)?true:"note present"; }));
  ok("only the flagged character's next reply carries it, not Berk's", await pg.evaluate(()=>{ __setup(["character"]); const B=__tail("p_b"); return !/LAST TIME YOU/.test(B.final_guardrails)?true:"Berk got it"; }));
  ok("once: after Ayla's next reply (unflagged) it is gone", await pg.evaluate(()=>{ const c=__setup(["character"]); c.messages.push({mid:"a2",role:"assistant",speaker:"Ayla",speakerId:"p_a",content:'"Fine."'});
      const B=__tail(); return !/LAST TIME YOU/.test(B.final_guardrails)?true:"still there"; }));

  console.log("\n[every way a payload is built]");
  /* v150.66 — a reply is built from the fragments only (the generated layout and the classic builder are gone) */
  ok("the reply payload (the fragments) carries the player's note", await pg.evaluate(()=>{ __setup(["player"]);
      const p=state.personas[0], c=curChat();
      const hb=buildCharPromptBlocks(p,[state.personas[1]],{recent:[],diary:[],longterm:[]},"Emre",{chat:c,targetName:"Emre",targetId:"__user__"});
      const tb=__tail(); const B=Object.assign({},hb,tb);
      const t=ptBuildMessages("solo",B,[],{chat:c,npc:p,targetName:"Emre"},()=>B).map(x=>x.content).join("\n");
      return /WROTE Emre'S PART/.test(t)?true:t.slice(-600); }));
  ok("a fragment calling final_guardrails//full gets it", await pg.evaluate(()=>{ __setup(["character"]); const p=state.personas[0], c=curChat(); const B=__tail();
      const m=ptBuildMessages("solo",B,[],{chat:c,npc:p,targetName:"Emre",fragments:[{id:"g",name:"G",seg:"tail",paths:["solo"],text:"{{call//final_guardrails//full}}",options:[]}]},()=>B);
      return /SLIPPED OUT OF CHARACTER/.test((m||[]).map(x=>x.content).join("\n"))?true:"missing"; }));
  // v150.59 — one choose-when option per flag, each holding its own wording
  ok("the fragment model's guardrails carry it as a choose-when option", await pg.evaluate(()=>{
      const on=fragCompile("solo",ptCondFlags({broke_character:true}),{}), off=fragCompile("solo",ptCondFlags({broke_character:false,spoke_for_player:false}),{});
      return (/LAST TIME YOU SLIPPED OUT OF CHARACTER/.test(on)&&!/LAST TIME YOU WROTE/.test(on)&&!/LAST TIME YOU/.test(off))?true:"fragment option"; }));
  ok("both wordings are editable fragments of the guardrails block", await pg.evaluate(()=>{
      return (!!BLOCK_TPL_DEFAULTS.consistency_character&&!!BLOCK_TPL_DEFAULTS.consistency_player)?true:"defaults missing"; }));

  ok("no page errors", errs.length===0?true:errs.join(" | "));
  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close(); process.exit(fail?1:0);
})();
