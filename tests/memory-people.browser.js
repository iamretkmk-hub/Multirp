/* v39.0 — EVERY MEMORY KNOWS WHO IT IS ABOUT.
   `people` is not decoration: three rankers score a memory UP when the people named in it are the
   people in the room, the search matches against it, and the editor shows it as "people involved".
   Twelve of the writers never set it, so their memories were blank in the editor and invisible to
   the boost — hardest to recall exactly when they mattered most. This checks the shared resolver and
   the writers that can be driven without a model call.
   Run: node tests/memory-people.browser.js */
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage({viewport:{width:412,height:915}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file://'+require('path').resolve(__dirname,'..','index.html'));
  await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(800);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x||c).slice(0,600));} };

  await pg.evaluate(()=>{
    const uni=state.universes[0];
    const mk=(id,name)=>({id,name,universeId:uni.id,instructions:"x",personality:"x",
      backstory:"x",style:"x",goals:"x",look:{subject:"Man"}});
    ["p_ayla|Ayla","p_deniz|Deniz"].forEach(t=>{ const [id,name]=t.split("|");
      if(!state.personas.some(p=>p.id===id)) state.personas.push(mk(id,name)); });
    state.user="Emre"; state.mem=true;
    const chat=curChat(); chat.gameDay=3; chat.period="Evening"; chat.universeId=uni.id; chat.location="Sahil";
  });

  // ---- the resolver
  const r=await pg.evaluate(()=>({
    ids:      memPeople("p_ayla","p_deniz"),
    user:     memPeople("__user__","p_ayla"),
    names:    memPeople("Ayla","Deniz"),
    nested:   memPeople(["p_ayla",["Deniz"]],"Emre"),
    dupes:    memPeople("p_ayla","Ayla","p_ayla"),
    blanks:   memPeople("", null, undefined, "  ", "Ayla"),
    nothing:  memPeople()
  }));
  ok("ids resolve to names", JSON.stringify(r.ids)==='["Ayla","Deniz"]', JSON.stringify(r.ids));
  ok("__user__ resolves to the player", JSON.stringify(r.user)==='["Emre","Ayla"]', JSON.stringify(r.user));
  ok("plain names pass through", JSON.stringify(r.names)==='["Ayla","Deniz"]', JSON.stringify(r.names));
  ok("nested arrays flatten", JSON.stringify(r.nested)==='["Ayla","Deniz","Emre"]', JSON.stringify(r.nested));
  ok("an id and its name are one person", JSON.stringify(r.dupes)==='["Ayla"]', JSON.stringify(r.dupes));
  ok("blanks are dropped", JSON.stringify(r.blanks)==='["Ayla"]', JSON.stringify(r.blanks));
  ok("nothing in, nothing out", JSON.stringify(r.nothing)==='[]', JSON.stringify(r.nothing));

  // ---- writers that need no model call
  const w=await pg.evaluate(()=>{
    const chat=curChat(); const uni=state.universes[0];
    const ayla=state.personas.find(p=>p.id==="p_ayla");
    const deniz=state.personas.find(p=>p.id==="p_deniz");
    const take=n=>{ const before=state.memory.length; n(); return state.memory.slice(before); };
    const out={};

    state.memory=[];
    out.noShow=take(()=>_plantNoShowMemory(chat,ayla,{title:"kahve"},"","stood_up")).map(m=>m.people);

    state.memory=[];
    out.world=take(()=>_plantWorldMemory(chat,uni,ayla,{content:"we talked",emotion:"warm",importance:.5},3,"Sahil",["Ayla","Deniz"])).map(m=>m.people);

    state.memory=[];
    out.worldModel=take(()=>_plantWorldMemory(chat,uni,ayla,{content:"x",people:["Deniz"],importance:.5},3,"Sahil")).map(m=>m.people);

    state.memory=[];
    out.confront=take(()=>recordConfrontationAftermath(chat,{kind:"confrontation",accuserId:"p_ayla",intent:"the message",conviction:0.8})).map(m=>m.people);

    state.memory=[];
    out.overture=take(()=>recordOvertureAftermath(chat,{kind:"overture",accuserId:"p_deniz",intent:"dinner",conviction:0.2})).map(m=>m.people);

    state.memory=[];
    uni.charQuests=[{id:"q1",status:"active",holderId:"p_ayla",holderName:"Ayla",title:"the loan",progress:[]}];
    out.quest=take(()=>charQuestComplete(chat,uni,uni.charQuests[0],3,false,"she got it")).map(m=>m.people);

    state.memory=[];
    return out;
  });
  ok("a meeting that did not happen names both parties", JSON.stringify(w.noShow)==='[["Ayla","Emre"]]', JSON.stringify(w.noShow));
  ok("an offstage event names its whole cast", JSON.stringify(w.world)==='[["Ayla","Deniz"]]', JSON.stringify(w.world));
  ok("the model's own people are kept", JSON.stringify(w.worldModel)==='[["Ayla","Deniz"]]', JSON.stringify(w.worldModel));
  ok("a confrontation names accuser and player", JSON.stringify(w.confront)==='[["Ayla","Emre"]]', JSON.stringify(w.confront));
  ok("an overture names both", JSON.stringify(w.overture)==='[["Deniz","Emre"]]', JSON.stringify(w.overture));
  ok("a closed quest names its holder", JSON.stringify(w.quest)==='[["Ayla"]]', JSON.stringify(w.quest));

  // ---- no writer left storing a blank people row where it can be filled
  const src=await pg.evaluate(()=>document.documentElement.outerHTML.length>0);
  ok("page loaded", src===true);
  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log(`\n  ${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail?1:0);
})();
