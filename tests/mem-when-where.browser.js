/* v59.1 — THE MEMORY WRITER WAS NEVER TOLD WHAT DAY IT WAS.
   Reported: a scene played on day 3 in the afternoon came back stored as "It is Day 1 Evening", at
   "Emre Tokmak's home" — a place nobody named. The record itself carries gameDay, gamePeriod and a
   location, stamped in code from what the app knows; none of it was ever put in front of the model
   that WRITES the memory. So a prompt asking the memory to open with when it happened had nothing
   to open with, and a prompt asking for the place "from the given location list" was handed no
   list. Both get invented, and the invention is what gets stored and read back later as fact.
   The period reconciler was given this line in v44.3 for this exact reason. The three writers that
   produce nearly every memory in the bank — the arc builder, the bystander gist and the phone
   thread — never were.
   Run: node tests/mem-when-where.browser.js */
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

  // ---- the line itself
  const line=await pg.evaluate(()=>{
    const uni=state.universes[0];
    uni.locations=[{id:"l_pool",name:"Site Olympic Pool",description:"the pool",residents:[],
      sublocations:[{id:"s_deck",name:"Pool Deck"},{id:"s_gate",name:"Main Gate"}]}];
    const chat=curChat(); chat.gameDay=3; chat.locationId="l_pool"; chat.location="Site Olympic Pool";
    chat.subId="s_deck";
    return {full:memWhenWhereLine(chat,3,"Afternoon"),
            noWhere:memWhenWhereLine(chat,3,"Afternoon",{noWhere:true}),
            fromChat:memWhenWhereLine(chat)};
  });
  ok("it states the day and the part of the day",
     /^WHEN: Day 3, Afternoon\./m.test(line.full), line.full);
  ok("it states the place, down to the area",
     /WHERE: Site Olympic Pool — Pool Deck\./.test(line.full), line.full);
  ok("and it forbids inventing either, or copying one out of the instructions",
     /Never guess the day, the part of the day or the place/.test(line.full)
     &&/never carry one over from an example in your instructions/.test(line.full), "");
  ok("a phone thread gets the WHEN and no place to invent around",
     /WHEN: Day 3, Afternoon\./.test(line.noWhere)&&!/WHERE:/.test(line.noWhere), line.noWhere);
  ok("called bare, it reads the day off the chat rather than guessing",
     /WHEN: Day 3/.test(line.fromChat), line.fromChat);

  // ---- it reaches the arc builder and the bystander gist, in the real path
  const sent=await pg.evaluate(async(bystander)=>{
    const uni=state.universes[0];
    const her={id:"p_burcu",name:"Burcu",universeId:uni.id,instructions:"x",personality:"x",
               backstory:"x",style:"x",goals:"x",look:{}};
    state.personas=[her]; state.mem=true; state.key="k"; state.user="Emre";
    const chat=curChat(); chat.gameDay=3; chat.locationId="l_pool"; chat.location="Site Olympic Pool";
    chat.subId="s_deck"; chat.presentIds=[her.id]; chat.messages=[];
    const push=(role,content,speaker)=>chat.messages.push({mid:newMid(),role,content,speaker,
      speakerId:role==='user'?null:her.id,present:[her.id]});
    push('user',"Hoş geldin.");
    if(bystander){ push('assistant',"Başkasıyla konuşuyorum.","Narratorless"); chat.messages[1].speakerId="p_other"; }
    else push('assistant',"Hoş bulduk. Ev sessizmiş.","Burcu");
    push('user',"Otur şuraya.");
    push('assistant',"Oturuyorum.","Burcu");
    const seen=[]; const real=window.chatCompletion;
    window.chatCompletion=async(msgs)=>{ seen.push(msgs); return "{}"; };
    try{ await commitMemoryArc(chat,0,chat.messages.length-1,3,"Afternoon"); }
    finally{ window.chatCompletion=real; }
    const call=seen[0]||[];
    return String((call.filter(m=>m.role==="user").pop()||{}).content||"");
  },false);
  ok("the arc builder is handed the day, the part of the day and the place",
     /WHEN: Day 3, Afternoon\./.test(sent)&&/WHERE: Site Olympic Pool — Pool Deck\./.test(sent), sent.slice(0,200));
  ok("and it still carries the conversation after it",
     /Complete event Burcu witnessed/.test(sent)&&/Hoş bulduk/.test(sent), sent.slice(0,300));
  ok("the WHEN comes first — before the transcript the model reads for clues",
     sent.indexOf("WHEN: Day 3")<sent.indexOf("Complete event"), "");

  // ---- the stamped record and the line agree
  const stamp=await pg.evaluate(async()=>{
    const her=state.personas[0]; const chat=curChat();
    state.memory=[];
    const real=window.chatCompletion;
    window.chatCompletion=async()=>JSON.stringify({content:"It is Day 3, Afternoon. We talked by the pool.",
      importance_score:0.5,emotion:"neutral",people:["Emre"],tags:["pool"],location:"Site Olympic Pool — Pool Deck"});
    try{ await commitMemoryArc(chat,0,chat.messages.length-1,3,"Afternoon"); }
    finally{ window.chatCompletion=real; }
    const m=(state.memory||[])[0]||null;
    return m&&{day:m.gameDay,period:m.gamePeriod,loc:m.location,content:m.content};
  });
  ok("the record it writes and the line it was given say the same day",
     stamp&&stamp.day===3&&stamp.period==="Afternoon", JSON.stringify(stamp));
  ok("and the place it echoes back is the one it was told",
     stamp&&/Site Olympic Pool/.test(stamp.loc)&&/Day 3, Afternoon/.test(stamp.content), JSON.stringify(stamp));

  // ---- the phone thread
  const txt=await pg.evaluate(async()=>{
    const her=state.personas[0]; const chat=curChat(); chat.gameDay=3;
    const span=[{role:"user",content:"Geliyor musun?"},{role:"assistant",content:"Geliyorum."}];
    const seen=[]; const real=window.chatCompletion;
    window.chatCompletion=async(msgs)=>{ seen.push(msgs); return "{}"; };
    try{ await _commitTextArc(chat,her,span); }finally{ window.chatCompletion=real; }
    return String((((seen[0]||[]).filter(m=>m.role==="user").pop())||{}).content||"");
  });
  ok("the phone-thread builder is given the day too",
     /WHEN: Day 3/.test(txt)&&/Geliyor musun\?/.test(txt), txt.slice(0,220));
  ok("and no place, because a text thread has none to give",
     !/WHERE:/.test(txt), txt.slice(0,220));

  // ---- the prompt says the given values are the only source
  const pr=await pg.evaluate(()=>({d:DEFAULT_MEMBUILD,stale:(window.__stalePipes||[]).join(" | ")}));
  ok("the shipped builder prompt names the WHEN and WHERE lines as authoritative",
     /THE DAY, THE PART OF THE DAY AND THE PLACE ARE GIVEN TO YOU/.test(pr.d)
     &&/an invented date is stored as fact/.test(pr.d), "");
  ok("no refresh pipe was left pointing at a marker the default lost",
     !/memBuild/.test(pr.stale), pr.stale);
  const rt=async v=>{ await pg.evaluate(t=>store.setRaw(K.memBuild,t),v);
    await pg.reload(); await pg.waitForTimeout(2400); return pg.evaluate(()=>state.memBuild); };
  ok("an older stored builder prompt picks the rule up",
     /ARE GIVEN TO YOU/.test(await rt("You analyze a complete roleplay event and create one durable, first-person MEMORY. Old body.")));
  ok("one the user wrote themselves is left exactly as it is",
     (await rt("My own memory writer."))==="My own memory writer.");

  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log("\n  "+pass+" passed, "+fail+" failed");
  await b.close();
  process.exit(fail?1:0);
})();
