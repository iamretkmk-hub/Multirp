/* v148.8 — reported: "Two characters and I are in the same scene talking. The one who isn't responding creates an
   Observation memory. Then when the memory consolidator runs after the time of day changes, those observation
   memories stay as they are and only her own memories are consolidated. Characters in the same room shouldn't
   create observation memories, and all memories should be consolidated into one or two memories of that
   encounter — text memories too — so recall brings the whole encounter back, not fragments."
   Covered here:
     1. a quiet character in the same room gets their own memory of the scene (not an OBSERVATION), the charge
        the gossip pass reads kept; one in ANOTHER area still gets the bystander glimpse;
     2. the part-of-day reconcile takes every fragment — own, quiet, text, seen from another area — each labelled,
        and makes one memory of the encounter; the charge rides onto it and gossip still finds it;
     3. a stretch that was nothing but a glimpse stays a glimpse;
     4. a stored reconcile prompt gets the new paragraph in place, the player's edits kept.
   Run: NODE_PATH=/path/to/node_modules node tests/mem-one-encounter.browser.js */
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:process.env.SM_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage({viewport:{width:412,height:915}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file://'+require('path').resolve(__dirname,'..','index.html')); await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(900);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x===undefined?c:x).slice(0,900));} };

  const setup=()=>pg.evaluate(()=>{
    const uni=state.universes[0]; state.curUniverse=uni.id; uni.userName="";
    const mk=(id,name)=>({id,name,universeId:uni.id,instructions:"x",personality:"x",backstory:"x",style:"x",goals:"x",look:{}});
    state.personas=state.personas.filter(p=>!/^p_(ma|li|jo)$/.test(p.id));
    state.personas.push(mk("p_ma","Mara"),mk("p_li","Lina"),mk("p_jo","Jonas"));
    state.user="Deniz"; state.key="sk-test"; state.mem=true; state.memMinImp=0; state.condenseOn=false;
    state.autoCharOn=false; state.relOn=false; state.embedOn=false; state.narrPrivacy=true; state.histTurns=20; state.gossipOn=true;
    const chat=curChat(); chat.universeId=uni.id; chat.gameDay=2; chat.period="Afternoon"; chat.timeOfDay="Afternoon";
    chat.presentIds=["p_ma","p_li"]; chat.rel={}; chat.memEvent=null; chat.memDoneIdx=-1; chat.messages=[]; chat.locationId=null; chat.memCarry={}; chat._textArc={};
    state.memory=[];
    window.__calls=[];
    window.__reply=()=>JSON.stringify({content:"A memory "+Math.random().toString(36).slice(2,8),importance_score:0.6,charge:0.7,gist:"g",type:"OBSERVATION"});
    window.chatCompletion=async(msgs,model,opts)=>{ const d=(opts&&opts.dbg)||""; window.__calls.push({dbg:d,text:JSON.stringify(msgs)}); return window.__reply(d,msgs); };
    return true;
  });

  console.log("\n[1 — a quiet character in the same room remembers the scene as her own]");
  await setup();
  const Q=await pg.evaluate(async()=>{
    const chat=curChat(); const ear=["p_ma","p_li"];
    chat.messages.push({mid:"q0",role:"user",content:'"Mara, did you sign the lease?"',present:ear.slice()});
    chat.messages.push({mid:"q1",role:"assistant",speaker:"Mara",speakerId:"p_ma",content:'"Yesterday. We move on the first."',present:ear.slice()});
    chat.messages.push({mid:"q2",role:"user",content:'"Then we celebrate on Friday."',present:ear.slice()});
    chat.messages.push({mid:"q3",role:"assistant",speaker:"Mara",speakerId:"p_ma",content:'"Friday it is."',present:ear.slice()});
    await commitMemoryArc(chat,0,3,2,"Afternoon");
    const li=__calls.find(x=>/· Lina/.test(x.dbg));
    const m=state.memory.find(x=>x.ownerId==="p_li")||{};
    return {dbg:li&&li.dbg, own:!!li&&/in the same room, and heard the lines written out above/.test(li.text)&&/own memory of being there/.test(li.text)&&!/did NOT hear this/.test(li.text),
      type:m.type, obsOnly:!!m.observerOnly, listener:!!m.listener, charge:m.charge};
  });
  ok("Lina goes through the memory builder as part of the scene, not the bystander gist", Q.dbg==="Memory (arc) · Lina"&&Q.own, JSON.stringify(Q));
  ok("her memory is not an OBSERVATION even when the model calls it one", Q.type&&Q.type!=="OBSERVATION"&&!Q.obsOnly, JSON.stringify(Q));
  ok("the charge the gossip pass reads is kept", Q.listener&&Q.charge===0.7, JSON.stringify(Q));
  await setup();
  const G=await pg.evaluate(async()=>{
    const chat=curChat();
    // Deniz and Mara talk in one area; Lina is at the place, in another (not stamped on the player's lines)
    chat.messages.push({mid:"g0",role:"user",content:'"Mara, did you sign the lease?"',present:["p_ma"]});
    chat.messages.push({mid:"g1",role:"assistant",speaker:"Mara",speakerId:"p_ma",content:'"Yesterday."',present:["p_ma","p_li"]});
    chat.messages.push({mid:"g2",role:"user",content:'"Keep it quiet for now."',present:["p_ma"]});
    chat.messages.push({mid:"g3",role:"assistant",speaker:"Mara",speakerId:"p_ma",content:'"Of course."',present:["p_ma","p_li"]});
    await commitMemoryArc(chat,0,3,2,"Afternoon");
    const li=__calls.find(x=>/· Lina/.test(x.dbg));
    const m=state.memory.find(x=>x.ownerId==="p_li")||{};
    return {dbg:li&&li.dbg,type:m.type,obsOnly:!!m.observerOnly};
  });
  ok("one in ANOTHER area still only sees it: the bystander glimpse", G.dbg==="Bystander gist · Lina"&&G.type==="OBSERVATION"&&G.obsOnly, JSON.stringify(G));

  console.log("\n[2 — the part-of-day reconcile makes one memory of the encounter]");
  await setup();
  const R=await pg.evaluate(async()=>{
    const chat=curChat(); const base={ownerId:"p_li",character:"Lina",gameDay:2,gamePeriod:"Afternoon",universeId:chat.universeId,chatId:chat.id,importance:0.5,source:"auto",location:"the café"};
    state.memory=[Object.assign({id:"f1",content:"I told Deniz I would help with the move.",type:"EXPERIENCE",srcMids:["a"]},base),
                  Object.assign({id:"f2",content:"Mara said she signed the lease and they are moving on the first.",type:"EXPERIENCE",listener:true,charge:0.8,srcMids:["b"]},base),
                  Object.assign({id:"f3",content:"Deniz texted me the new address.",type:"EXPERIENCE",source:"text",tags:["text"],location:""},base),
                  Object.assign({id:"f4",content:"Jonas and the owner argued at the counter.",type:"OBSERVATION",observerOnly:true,gist:"an argument",charge:0.4},base),
                  Object.assign({id:"g1",content:"Rumour: Mara owes money.",type:"GOSSIP",gossipId:"x"},base)];
    const frag=memsOfPeriod("p_li",2,"Afternoon",chat).map(m=>m.id);
    window.__reply=()=>JSON.stringify({memories:[{content:"At the café Mara told us she signed the lease; I offered to help with the move, Deniz texted me the address, and Jonas argued with the owner at the counter.",importance_score:0.6,type:"OBSERVATION"}]});
    await reconcilePeriodFor(state.personas.find(p=>p.id==="p_li"),2,"Afternoon",chat);
    const c=__calls.find(x=>/Memory reconcile/.test(x.dbg));
    const mine=state.memory.filter(m=>m.ownerId==="p_li"&&m.type!=="GOSSIP");
    const t=c?c.text:"";
    const gossipFinds=state.memory.filter(m=>m.gameDay===2&&m.type!=="GOSSIP"&&!m.gossipId&&m.source!=="location_rumor"&&typeof m.charge==="number"&&m.charge>=0.6).length;
    return {frag, quiet:/THEY WERE THERE BUT QUIET/.test(t), text:/OVER TEXT MESSAGES/.test(t), seen:/SEEN FROM ANOTHER PART OF THE PLACE/.test(t),
      n:mine.length, type:mine[0]&&mine[0].type, charge:mine[0]&&mine[0].charge, listener:mine[0]&&mine[0].listener, obsOnly:mine[0]&&!!mine[0].observerOnly,
      srcMids:mine[0]&&mine[0].srcMids, rumourKept:state.memory.some(m=>m.id==="g1"), gossipFinds};
  });
  ok("every fragment of the stretch goes in — own, quiet, text and seen — but never a rumour", JSON.stringify(R.frag)==='["f1","f2","f3","f4"]', JSON.stringify(R.frag));
  ok("each is labelled for how she took part", R.quiet&&R.text&&R.seen, JSON.stringify(R));
  ok("one memory of the encounter comes out; the fragments are gone", R.n===1, JSON.stringify(R));
  ok("filed as what it was, not an OBSERVATION, and not a glimpse", R.type!=="OBSERVATION"&&!R.obsOnly, JSON.stringify(R));
  ok("it carries the highest charge and the source lines, so gossip still finds it", R.charge===0.8&&R.listener===true&&JSON.stringify(R.srcMids)==='["a","b"]'&&R.gossipFinds===1, JSON.stringify(R));
  ok("the rumour is left alone", R.rumourKept===true);

  console.log("\n[3 — a stretch that was nothing but a glimpse stays a glimpse]");
  await setup();
  const S=await pg.evaluate(async()=>{
    const chat=curChat(); const base={ownerId:"p_li",character:"Lina",gameDay:2,gamePeriod:"Afternoon",universeId:chat.universeId,chatId:chat.id,importance:0.4,source:"auto",type:"OBSERVATION",observerOnly:true};
    state.memory=[Object.assign({id:"s1",content:"Deniz and Mara were talking by the window.",gist:"a quiet talk",charge:0.3},base),
                  Object.assign({id:"s2",content:"Mara looked upset afterwards.",gist:"upset",charge:0.6},base)];
    window.__reply=()=>JSON.stringify({memories:[{content:"I saw Deniz and Mara talk by the window, and Mara looked upset after.",importance_score:0.4}]});
    await reconcilePeriodFor(state.personas.find(p=>p.id==="p_li"),2,"Afternoon",chat);
    const m=state.memory.filter(x=>x.ownerId==="p_li");
    return {n:m.length,type:m[0]&&m[0].type,obsOnly:m[0]&&m[0].observerOnly,gist:m[0]&&m[0].gist,charge:m[0]&&m[0].charge};
  });
  ok("one glimpse, still observerOnly, with its gist and top charge", S.n===1&&S.type==="OBSERVATION"&&S.obsOnly===true&&S.gist==="a quiet talk"&&S.charge===0.6, JSON.stringify(S));

  console.log("\n[4 — the prompt]");
  const P=await pg.evaluate(()=>({def:/ONE ENCOUNTER, ONE MEMORY/.test(DEFAULT_MEMRECONCILE)&&/Never a separate entry for the part they only listened to or watched/.test(DEFAULT_MEMRECONCILE)}));
  ok("the default reconciler says one encounter is one memory, and keeps heard/seen/texted straight", P.def===true);
  await pg.evaluate(()=>{ const PARA=(DEFAULT_MEMRECONCILE.match(/\n\nONE ENCOUNTER, ONE MEMORY\.[^\n]*/)||[""])[0];
    store.setRaw(K.memReconcile,DEFAULT_MEMRECONCILE.replace(PARA,"")+"\nMY RECONCILE EDIT"); });
  await pg.reload(); await pg.waitForTimeout(2400);
  const M=await pg.evaluate(()=>({has:/ONE ENCOUNTER, ONE MEMORY/.test(state.memReconcile), kept:/MY RECONCILE EDIT/.test(state.memReconcile),
    placed:state.memReconcile.indexOf("however long they took.\n\nONE ENCOUNTER")>=0, once:(state.memReconcile.match(/ONE ENCOUNTER, ONE MEMORY/g)||[]).length===1}));
  ok("a stored copy gets the paragraph in place, after the sentence it follows, the player's edit kept", M.has&&M.kept&&M.placed&&M.once, JSON.stringify(M));

  ok("no page errors", errs.length===0?true:errs.join(" | "));
  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close(); process.exit(fail?1:0);
})();
