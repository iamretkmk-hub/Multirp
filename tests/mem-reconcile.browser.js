/* v56.1 — THE RECONCILER WAS THROWING THE ANSWER AWAY FOR ITS WRAPPER.
   A part of the day ends, the reconciler runs, the debug log shows the model returning a perfectly
   good memory — and the memory tab still shows the old fragments. The reader accepted exactly one
   shape, {"memories":[…]}, so a prompt asking for a bare {"content": …} — which is what the arc
   BUILDER's own contract looks like, and the obvious thing to write when editing this prompt —
   produced `made=[]` and an early return. Silently: no warning, no trace, originals kept.
   Two more fields were being dropped even when the shape was right: `feelings` was hardcoded to ""
   and `type` to "EXPERIENCE", both of which the arc builder has always honoured. And the two
   engines disagree on the importance field's name, which is where an edited prompt gets
   `importance_score` from.
   Run: node tests/mem-reconcile.browser.js */
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage({viewport:{width:412,height:915}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  const app='file://'+require('path').resolve(__dirname,'..','index.html');
  await pg.goto(app); await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(600);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x||c).slice(0,600));} };

  // Run a real reconcile with the model's answer scripted, and report what the bank looks like after.
  const run=async(answer)=>pg.evaluate(async(ans)=>{
    const uni=state.universes[0];
    const p={id:"p_b",name:"Burcu",universeId:uni.id,instructions:"x",personality:"x",
             backstory:"x",style:"x",goals:"x",look:{}};
    state.personas=[p]; state.mem=true; state.key="k"; state.user="Emre";
    const chat=curChat(); chat.gameDay=2;
    const mk=(i,c)=>({id:"m_frag"+i,ownerId:p.id,character:p.name,content:c,type:"EXPERIENCE",
      emotion:"tense",people:["Emre"],feelings:"",importance:0.4+i/10,tags:["yemek"],
      location:"Ev",gameDay:2,gamePeriod:"Morning",date:Date.now(),universeId:uni.id,chatId:chat.id});
    state.memory=[mk(1,"Kahvaltı hazırladım."),mk(2,"Emre ile borcu konuştuk."),mk(3,"Kavga ettik.")];
    const warn=[]; const realWarn=console.warn; console.warn=(...a)=>warn.push(a.join(" "));
    const real=window.chatCompletion;
    window.chatCompletion=async()=>ans;
    try{ await reconcilePeriodFor(p,2,"Morning"); }
    finally{ window.chatCompletion=real; console.warn=realWarn; }
    const kept=(state.memory||[]).map(m=>({id:m.id,src:m.source,content:m.content,type:m.type,
      feelings:m.feelings,imp:m.importance,emotion:m.emotion,tags:m.tags,loc:m.location,people:m.people}));
    return {kept,warn:warn.join(" | ")};
  },answer);

  // ---- the shape the user's own prompt asks for: a bare single object
  const bare=await run(JSON.stringify({
    content:"It was Day 2 in the Morning. Kahvaltıdan sonra borç konusunda kavga ettiniz.",
    location:"Ev", people:["Emre","Burcu"], emotion:"angry",
    feelings:"Onunla konuşmanın hiçbir şeyi düzeltmediğini anladın.",
    importance_score:0.8, tags:["borç","kavga"], type:"CONFLICT"}));
  ok("a bare {content:…} answer is accepted and REPLACES the fragments",
     bare.kept.length===1&&bare.kept[0].src==="reconciled"
     &&/borç konusunda kavga/.test(bare.kept[0].content), JSON.stringify(bare.kept.map(k=>k.id)));
  ok("its feelings reach the record instead of being blanked",
     /hiçbir şeyi düzeltmediğini/.test(bare.kept[0].feelings), JSON.stringify(bare.kept[0].feelings));
  ok("its type is kept rather than filed as EXPERIENCE",
     bare.kept[0].type==="CONFLICT", bare.kept[0].type);
  ok("importance_score is read — the name the arc builder uses",
     bare.kept[0].imp===0.8, String(bare.kept[0].imp));
  ok("and the other fields come through",
     bare.kept[0].emotion==="angry"&&bare.kept[0].loc==="Ev"
     &&bare.kept[0].tags.join(",")==="borç,kavga"&&bare.kept[0].people.length===2, JSON.stringify(bare.kept[0]));

  // ---- the shipped contract still works, exactly as before
  const wrapped=await run(JSON.stringify({memories:[
    {content:"Day 2, Morning. Kahvaltı ve kavga.",importance:0.9,emotion:"tense",
     people:["Emre"],tags:["kavga"],location:"Ev"}]}));
  ok("the shipped {memories:[…]} contract is untouched",
     wrapped.kept.length===1&&wrapped.kept[0].src==="reconciled"&&wrapped.kept[0].imp===0.9,
     JSON.stringify(wrapped.kept));
  ok("and a type it does not name still files as EXPERIENCE",
     wrapped.kept[0].type==="EXPERIENCE", wrapped.kept[0].type);

  // ---- the other shapes a prompt edit can produce
  const arr=await run(JSON.stringify([{content:"Bir şey oldu.",emotion:"neutral"}]));
  ok("a top-level array is accepted", arr.kept.length===1&&arr.kept[0].src==="reconciled", JSON.stringify(arr.kept.map(k=>k.src)));
  const other=await run(JSON.stringify({memory:{content:"Tek bir anı.",emotion:"content"}}));
  ok("so is a single object under another obvious wrapper word",
     other.kept.length===1&&other.kept[0].src==="reconciled", JSON.stringify(other.kept.map(k=>k.src)));
  const many=await run(JSON.stringify({memories:[
    {content:"Bir."},{content:"İki."},{content:"Üç."},{content:"Dört."}]}));
  ok("more than three is still capped at three", many.kept.length===3, String(many.kept.length));

  // ---- and a genuinely empty answer keeps the fragments AND says so
  const empty=await run("no json here at all");
  ok("an unusable answer keeps every fragment",
     empty.kept.length===3&&empty.kept.every(m=>m.src!=="reconciled"), JSON.stringify(empty.kept.map(k=>k.id)));
  ok("and it is no longer silent about it",
     /returned nothing usable/.test(empty.warn), empty.warn||"(nothing logged)");
  const emptyList=await run(JSON.stringify({memories:[]}));
  ok("an empty list is treated the same way",
     emptyList.kept.length===3&&/returned nothing usable/.test(emptyList.warn), emptyList.warn);
  const noContent=await run(JSON.stringify({content:"   "}));
  ok("so is an entry whose content is blank",
     noContent.kept.length===3&&/returned nothing usable/.test(noContent.warn), noContent.warn);

  // ---- the helpers on their own
  const h=await pg.evaluate(()=>({
    type:[_memType("intimacy"),_memType("CONFLICT"),_memType("whatever"),_memType(null)],
    imp:[_memImp({importance_score:0.7}),_memImp({importance:0.3}),_memImp({importance:5}),_memImp({}),_memImp({importance:"high"})],
    list:[_memReconcileList(null).length,_memReconcileList({}).length,
          _memReconcileList({content:"x"}).length,_memReconcileList([{content:"a"},{nope:1}]).length]
  }));
  ok("_memType only ever returns a type the memory system files by",
     h.type[0]==="INTIMACY"&&h.type[1]==="CONFLICT"&&h.type[2]===""&&h.type[3]==="", JSON.stringify(h.type));
  ok("_memImp reads both names, clamps to 0-1 and refuses a non-number",
     h.imp[0]===0.7&&h.imp[1]===0.3&&h.imp[2]===1&&h.imp[3]===0&&h.imp[4]===0, JSON.stringify(h.imp));
  ok("_memReconcileList never invents an entry out of nothing",
     h.list[0]===0&&h.list[1]===0&&h.list[2]===1&&h.list[3]===1, JSON.stringify(h.list));

  // ---- and the shipped prompt now asks for the two fields the code stopped discarding
  const pr=await pg.evaluate(()=>({d:DEFAULT_MEMRECONCILE,stale:(window.__stalePipes||[]).join(" | ")}));
  ok("the shipped contract asks for feelings and type",
     /"feelings":"…","type":"EXPERIENCE"/.test(pr.d)
     &&/- feelings: what the stretch left them carrying/.test(pr.d)
     &&/whichever the whole stretch actually was/.test(pr.d), pr.d.slice(0,400));
  ok("no refresh pipe was left pointing at a marker the default lost",
     !/memReconcile/.test(pr.stale), pr.stale);
  const rt=async v=>{ await pg.evaluate(t=>store.setRaw(K.memReconcile,t),v);
    await pg.reload(); await pg.waitForTimeout(2400); return pg.evaluate(()=>state.memReconcile); };
  ok("an older stored reconciler prompt is refreshed to it",
     /- feelings: what the stretch left them carrying/.test(
       await rt("# ROLE\nA stretch of one character's day has just ended. Old body without the marker.")));
  ok("a reconciler prompt the user wrote themselves is left exactly as it is",
     (await rt("My own reconciler. Return {\"content\":\"…\"}."))==="My own reconciler. Return {\"content\":\"…\"}.");

  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log("\n  "+pass+" passed, "+fail+" failed");
  await b.close();
  process.exit(fail?1:0);
})();
