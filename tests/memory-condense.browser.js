/* v44.1 — "I see the memory condenser giving an output but I don't see that memory in the
   character's memories, and I don't see the condensed ones being deleted."

   The condenser read exactly ONE shape — an array (or object) whose FIRST entry has a `content`
   key. Anything else hit `continue` with no log, no Debug entry and no change, so the run looked
   healthy on the Debug page while the memory bank never moved. And the one entry it did read was
   arr[0] alone, while every source in the cluster was deleted — a model answering with the 1-3
   memories the prompt asks for lost two of them. */
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file:///home/user/Multirp/index.html'); await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(900);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x||c).slice(0,400));} };

  /* Seed a character over the condense ceiling with memories about ONE thread, so the clusterer
     (lexical Jaccard, embeddings off) finds something to merge. Then answer the model call with
     `reply` and report what actually changed. */
  const run=(reply)=>pg.evaluate(async(reply)=>{
    const uni=state.universes[0];
    if(!state.personas.some(x=>x.id==="p_c"))
      state.personas.push({id:"p_c",name:"Nil",universeId:uni.id,instructions:"x",personality:"x",
        backstory:"x",style:"x",goals:"x",look:{}});
    state.memory=state.memory.filter(m=>m.ownerId!=="p_c");
    for(let i=0;i<60;i++) state.memory.push({id:"mm"+i,
      content:"Emre ile kahve ictik ve uzun uzun konustuk sayi "+(i%3),
      location:"Kadikoy",emotion:"warm",importance:0.3,tags:["kahve","emre"],type:"EXPERIENCE",
      ownerId:"p_c",character:"Nil",date:Date.now()-(60-i)*1000,gameDay:1,gamePeriod:"Morning",
      source:"auto",universeId:uni.id,chatId:state.curChat});
    state.condenseOn=true; state.key="k";
    const dbgBefore=dbgLog.length;
    window.chatCompletion=async()=>reply;
    const before=memoriesOf("p_c").length;
    await maybeCondenseMemories("p_c","Nil");
    const after=memoriesOf("p_c");
    const made=after.filter(m=>m.source==="longterm_condenser");
    return {before, after:after.length, kept:made.length,
            texts:made.map(m=>m.content), types:[...new Set(made.map(m=>m.type))],
            owned:made.every(m=>m.ownerId==="p_c"),
            complained:dbgLog.slice(dbgBefore).some(e=>/NOTHING USABLE/.test(e.label||""))};
  },reply);

  console.log("\n[the documented shape still works exactly as before]");
  const A=await run('[{"content":"Emre ile kahve icmek bir aliskanlik oldu.","location":"Kadikoy","emotion":"warm","importance_score":0.6,"tags":["emre"],"type":"CONSOLIDATED"}]');
  ok("a consolidated memory is written", A.kept===1, JSON.stringify(A));
  ok("and the sources it replaced are gone", A.after<A.before, A.before+" → "+A.after);
  ok("it belongs to the character", A.owned===true);
  ok("it is stored in the long-term tier the retriever reads", A.types.join()==="LONGTERM", A.types.join());
  ok("nothing is reported as broken", A.complained===false);

  console.log("\n[the shapes that silently did nothing]");
  for(const [label,reply] of [
    ["{\"memories\":[…]}",     '{"memories":[{"content":"A durable thing that happened."}]}'],
    ["{\"consolidated\":[…]}", '{"consolidated":[{"content":"A durable thing that happened."}]}'],
    ["[{\"text\":…}]",         '[{"text":"A durable thing that happened."}]'],
    ["[{\"summary\":…}]",      '[{"summary":"A durable thing that happened."}]'],
    ["a bare object",          '{"content":"A durable thing that happened."}'],
    ["fenced json",            '```json\n[{"content":"A durable thing that happened."}]\n```']
  ]){
    const R=await run(reply);
    ok(label+" is read", R.kept===1 && R.after<R.before, JSON.stringify(R));
  }

  console.log("\n[a cluster that comes back as three memories keeps three]");
  const C=await run('[{"content":"The first durable thing."},{"content":"The second durable thing."},{"content":"The third durable thing."}]');
  ok("every entry the model wrote is stored", C.kept===3, JSON.stringify(C.texts));
  ok("and the sources are still replaced", C.after<C.before, C.before+" → "+C.after);

  console.log("\n[an answer with nothing storable in it destroys nothing, and says so]");
  const D=await run('Nil ve Emre duzenli olarak kahve iciyor, bu artik bir aliskanlik.');
  ok("no memory is invented from prose", D.kept===0, JSON.stringify(D));
  ok("and NOT ONE source is deleted", D.after===D.before, D.before+" → "+D.after);
  ok("the Debug page is told, instead of the run looking healthy", D.complained===true);
  const E=await run('[]');
  ok("an empty array is the same — nothing written, nothing lost", E.kept===0&&E.after===E.before, JSON.stringify(E));
  ok("and it is reported too", E.complained===true);

  console.log("\n[the reader itself]");
  const F=await pg.evaluate(()=>({
    arr: condenseResults('[{"content":"a"}]').length,
    obj: condenseResults('{"content":"a"}').length,
    wrapped: condenseResults('{"memories":[{"content":"a"},{"content":"b"}]}').length,
    alias: (condenseResults('[{"summary":"a"}]')[0]||{}).content,
    blank: condenseResults('[{"content":"   "}]').length,
    junk: condenseResults("nothing here").length,
    nul: condenseResults(null).length,
    keepsFields: (condenseResults('[{"content":"a","emotion":"warm","tags":["x"]}]')[0]||{}).emotion
  }));
  ok("an array comes through", F.arr===1);
  ok("a single object comes through", F.obj===1);
  ok("a wrapper key is unwrapped, with every entry", F.wrapped===2, String(F.wrapped));
  ok("summary/text stand in for content", F.alias==="a", String(F.alias));
  ok("whitespace is not prose", F.blank===0, String(F.blank));
  ok("junk is nothing", F.junk===0, String(F.junk));
  ok("null is nothing", F.nul===0, String(F.nul));
  ok("the other fields survive the normalising", F.keepsFields==="warm", String(F.keepsFields));

  ok("no page errors", errs.length===0?true:errs.join(" | "));
  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close(); process.exit(fail?1:0);
})();
