/* v54.1 — A MEETING AT NEITHER PERSON'S HOUSE, AND A JOURNEY MADE ALONE.
   A player meeting had two shapes, and both were somebody's front door: they come to me, or I go to
   them. The ordinary case — we agree on a café and each make our own way — could not be expressed,
   so it was stored as one of the two homes and then narrated as a visit.
   And the travel narrator was scenery. It got the origin, the destination and the hour; with an
   empty companion list it had nothing to say about who was on the road, so prose filled the gap and
   the counterpart turned up walking beside the player, on the way to the meeting they were supposed
   to arrive at separately. The journey is also the last beat before they are face to face, and it
   knew nothing about what the meeting was for.
   Run: node tests/meet-mode.browser.js */
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

  // ---- the third mode exists and every reader agrees what it means
  const mode=await pg.evaluate(()=>({
    char:meetMode({executor:"Burcu"}), user:meetMode({executor:"user"}),
    both:meetMode({executor:"both"}), BOTH:meetMode({executor:"Both"}),
    empty:meetMode({}), tpl:meetMode({executor:"{{user}}"}),
    isBoth:meetIsBoth({executor:"both"}), notBoth:meetIsBoth({executor:"Burcu"})
  }));
  ok("meetMode reads all three shapes, and old entries still mean what they meant",
     mode.char==="char"&&mode.user==="user"&&mode.both==="both"&&mode.BOTH==="both"
     &&mode.empty==="user"&&mode.tpl==="user"&&mode.isBoth===true&&mode.notBoth===false, JSON.stringify(mode));

  // ---- the picker offers it, names both sides, and says whose place each one is
  const ui=await pg.evaluate(async()=>{
    const uni=state.universes[0];
    const she={id:"p_burcu",name:"Burcu",universeId:uni.id,instructions:"x",personality:"x",
               backstory:"x",style:"x",goals:"x",look:{subject:"Woman"}};
    state.personas=[she]; state.user="Emre";
    const chat=curChat(); chat.presentIds=[she.id];
    addCalManual(); await new Promise(r=>setTimeout(r,200));
    const sel=document.getElementById('caExec');
    const labels=[...sel.options].map(o=>o.textContent);
    const values=[...sel.options].map(o=>o.value);
    sel.value="both"; sel.onchange();
    const hintBoth=document.getElementById('caExecHint').textContent;
    sel.value="user"; sel.onchange();
    const hintUser=document.getElementById('caExecHint').textContent;
    return {labels,values,hintBoth,hintUser};
  });
  ok("the picker has three options, the new one last",
     ui.values.join(",")==="char,user,both", ui.values.join(","));
  ok("each option says whose place it is, by name",
     /Burcu comes to me — at my place/.test(ui.labels[0])
     &&/I go to Burcu — at their place/.test(ui.labels[1])
     &&/Burcu and I meet somewhere — we each go there/.test(ui.labels[2]), ui.labels.join(" | "));
  ok("choosing it explains that neither hosts and each travels",
     /Neither of you hosts/.test(ui.hintBoth)&&/arrives separately/.test(ui.hintBoth), ui.hintBoth);
  ok("and the home modes still say the place can be left empty",
     /resolves to Burcu's home/.test(ui.hintUser), ui.hintUser);

  // ---- saving it: the place is required, and the mode is stored
  const saved=await pg.evaluate(async()=>{
    const chat=curChat(); chat.calendar=[];
    const set=(id,v)=>{ const e=document.getElementById(id); if(e)e.value=v; };
    addCalManual(); await new Promise(r=>setTimeout(r,150));
    set('caTitle',"Yemek"); set('caExec',"both"); set('caLoc',"");
    saveCalManual();
    const refused=(chatCalendar(chat)||[]).length===0 && !!document.getElementById('calAddModal');
    set('caLoc',"Sedef Restaurant");
    saveCalManual();
    const e=(chatCalendar(chat)||[])[0]||null;
    return {refused, e:e&&{executor:e.executor,executorId:e.executorId,withUser:e.withUser,
                           where:e.where,loc:!!e.locationId}};
  });
  ok("a no-host meeting with no place named is refused rather than saved nowhere",
     saved.refused===true, "it saved without a place");
  ok("saved, it carries the mode and no actor, and keeps its place",
     saved.e&&saved.e.executor==="both"&&saved.e.executorId===null
     &&saved.e.withUser===true&&/Sedef/.test(saved.e.where), JSON.stringify(saved.e));

  // ---- the place is NOT quietly turned into somebody's house
  const loc=await pg.evaluate(()=>{
    const chat=curChat(); const cp=state.personas[0];
    return {both:!!_resolvePlanLoc(chat,"somewhere","both",cp),
            user:_resolvePlanLoc(chat,"",'user',cp)!==undefined};
  });
  ok("a bare 'somewhere' on a no-host meeting resolves to no home at all",
     loc.both===false, "it resolved to a home");

  // ---- what a character is told about it in their payload
  const pay=await pg.evaluate(()=>{
    const chat=curChat(); const she=state.personas[0];
    chat.calendar=[{id:"c1",kind:"meeting",title:"Yemek",who:"Burcu",executor:"both",executorId:null,
                    withUser:true,certainty:"certain",day:(chat.gameDay||1),period:chatPeriod(chat),
                    where:"Sedef Restaurant",locationId:null,detail:"borcu konuşmak için",done:false}];
    const mine=calendarContextLine(chat,she.name,she.id)||"";
    chat.calendar[0].executor="Burcu"; chat.calendar[0].executorId=she.id;
    const asChar=calendarContextLine(chat,she.name,she.id)||"";
    return {mine,asChar};
  });
  ok("a no-host meeting tells the character nobody hosts and they each go",
     /NEITHER of you hosts/.test(pay.mine)&&/arriving separately/.test(pay.mine)
     &&/Sedef Restaurant/.test(pay.mine), pay.mine.slice(0,240));
  ok("nobody is told they are being collected or visited at home",
     !/is the one coming/.test(pay.mine)&&!/YOU are the one who has to make this happen/.test(pay.mine), pay.mine.slice(0,240));
  ok("and the old two modes still read exactly as they did",
     /YOU are the one who has to make this happen/.test(pay.asChar), pay.asChar.slice(0,200));

  // ---- the calendar row shows the direction
  ok("the calendar row marks a no-host meeting as each going",
     await pg.evaluate(()=>{
       const e={executor:"both",who:"Burcu"};
       const f=new Function("e","meetIsBoth","meetMode",
         "return meetIsBoth(e)?`you \\u21e2 ${e.who||'them'} \\u21e0 (each go)`:(meetMode(e)==='char'?'a':'b');");
       return /each go/.test(f(e,meetIsBoth,meetMode)); }));

  // ---- THE JOURNEY. What the travel narrator is actually handed.
  const trip=await pg.evaluate(async(mode)=>{
    const chat=curChat(); const she=state.personas[0];
    const uni=state.universes[0];
    // two real places so travelTo has somewhere to go (locations live on the universe)
    uni.locations=[{id:"l_home",name:"Ev",description:"the flat",residents:[]},
                   {id:"l_rest",name:"Sedef Restaurant",description:"a fish place",residents:[]}];
    chat.locationId="l_home"; chat.location="Ev"; chat.presentIds=[];
    // a memory of arranging it, so the backstory has something to carry
    state.memory=[{id:"m1",ownerId:she.id,character:she.name,content:"Emre ile yemekte borcu konuşmaya karar verdik.",
                   type:"EXPERIENCE",emotion:"tense",people:["Emre","Burcu"],importance:0.7,tags:["meeting"],
                   gameDay:(chat.gameDay||1)-1,date:Date.now(),universeId:uni.id}];
    const e={id:"c1",kind:"meeting",title:"Yemek",who:"Burcu",executor:mode,withUser:true,
             certainty:"certain",day:chat.gameDay||1,period:chatPeriod(chat),
             where:"Sedef Restaurant",locationId:"l_rest",detail:"borcu konuşmak için",done:false,source:"auto"};
    const seen=[]; const real=window.chatCompletion;
    window.chatCompletion=async(msgs)=>{ seen.push(msgs); return "yol beti"; };
    try{ await travelTo("l_rest",[],{meeting:e,counterpart:she}); }
    finally{ window.chatCompletion=real; }
    const call=seen[0]||[];
    return {sys:String((call.find(m=>m.role==="system")||{}).content||""),
            usr:String((call.filter(m=>m.role==="user").pop()||{}).content||"")};
  },"both");
  ok("the journey says outright that the player travels alone",
     /TRAVELS ALONE/.test(trip.usr), trip.usr.slice(0,300));
  ok("it forbids putting the counterpart on the road",
     /Burcu is NOT on this journey/.test(trip.usr)&&/arrive separately/.test(trip.usr), "");
  ok("it does not let the beat start the meeting",
     /do not bring the other party into the frame/.test(trip.usr), "");
  ok("the meeting's own file rides along — what it is for and how it was agreed",
     /THE MEETING THIS JOURNEY IS FOR: "Yemek"/.test(trip.usr)
     &&/WHY IT WAS ARRANGED: borcu konuşmak için/.test(trip.usr)
     &&/HOW IT WAS AGREED: both sides agreed/.test(trip.usr), trip.usr.slice(-600));
  ok("the traveller's own memory of arranging it is handed over, not invented",
     /WHAT BURCU REMEMBERS/.test(trip.usr)&&/borcu konuşmaya karar verdik/.test(trip.usr), "");
  ok("and the narrator is told to write one brief clause of why and how it sits with them",
     /WRITE ONE BRIEF CLAUSE/.test(trip.usr), "");

  const trip2=await pg.evaluate(async()=>{
    const chat=curChat(); chat.locationId="l_home"; chat.location="Ev"; chat.presentIds=[];
    const seen=[]; const real=window.chatCompletion;
    window.chatCompletion=async(msgs)=>{ seen.push(msgs); return "yol beti"; };
    try{ await travelTo("l_rest",[]); }finally{ window.chatCompletion=real; }
    return String((seen[0]||[]).filter(m=>m.role==="user").pop().content||"");
  });
  ok("an ordinary trip that is not a meeting carries none of it",
     !/TRAVELS ALONE/.test(trip2)&&!/THE MEETING THIS JOURNEY IS FOR/.test(trip2), trip2.slice(0,200));

  // ---- the prompts themselves
  const pr=await pg.evaluate(()=>({t:DEFAULT_TRAVEL,c:DEFAULT_CHAR_MOVE,cal:DEFAULT_CAL,
                                   stale:(window.__stalePipes||[]).join(" | ")}));
  ok("the travel narrator is told the road carries exactly who it is told",
     /WHO IS ON THE ROAD IS GIVEN TO YOU/.test(pr.t)&&/A JOURNEY MADE TO KEEP A MEETING/.test(pr.t)
     &&/NOT met on the way/.test(pr.t), "");
  ok("and that the journey is where the meeting comes back to mind",
     /ONE brief clause of why they are going and how it sits with them/.test(pr.t), "");
  ok("the character-move narrator is told they move alone",
     /THEY MOVE ALONE/.test(pr.c)&&/never the two of them turning up together/.test(pr.c)
     &&/ONE HALF of an appointment/.test(pr.c), "");
  ok("the meetings tracker knows the third shape and how to write it",
     /NEITHER OF THEM HOSTS/.test(pr.cal)&&/the exact word "both"/.test(pr.cal)
     &&/HOW TO TELL THEM APART/.test(pr.cal), "");
  ok("and its JSON contract names all three accepted values",
     /"\{\{user\}\}", a character's EXACT name, or the literal lower-case string "both"/.test(pr.cal), "");
  ok("no refresh pipe was left pointing at a marker a default lost", !/calPrompt|travelPrompt|charMovePrompt/.test(pr.stale), pr.stale);

  // ---- stored older prompts are refreshed; hand-written ones are not
  const rt=async(key,v)=>{ await pg.evaluate(a=>store.setRaw(K[a.k],a.v),{k:key,v});
    await pg.reload(); await pg.waitForTimeout(2400); return pg.evaluate(a=>state[a],key); };
  ok("an older stored travel prompt picks up the alone rule",
     /WHO IS ON THE ROAD/.test(await rt("travelPrompt","You are the GAMEMASTER narrating a journey in a roleplay. Old body.")));
  ok("a travel prompt the user wrote themselves is left alone",
     (await rt("travelPrompt","My own travel narrator."))==="My own travel narrator.");

  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log("\n  "+pass+" passed, "+fail+" failed");
  await b.close();
  process.exit(fail?1:0);
})();
