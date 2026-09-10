/* v37.3 — the calendar remembers what happened, holds more than two people, and takes an errand.
   Before this: a finished plan left every character's head the moment it completed, a plan could
   name at most two tagged participants, and "go and talk to Hakan about it" had nowhere to live. */
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x||c).slice(0,400));} };
  const ctx=await b.newContext({viewport:{width:412,height:915},hasTouch:true,isMobile:true});
  const pg=await ctx.newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file:///home/user/Multirp/index.html'); await pg.waitForTimeout(2300);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(800);
  await pg.evaluate(()=>{
    const uni=state.universes[0];
    const mk=(id,name)=>{ if(!state.personas.some(p=>p.id===id))
      state.personas.push({id,name,universeId:uni.id,instructions:"x",personality:"x",backstory:"x",style:"x",goals:"x",look:{}}); };
    mk("p_d","Duygu"); mk("p_h","Hakan"); mk("p_n","Nil");
    state.user="Emre";
    const chat=curChat(); chat.gameDay=5; chat.presentIds=["p_d"]; chat.messages=[];
    chat.calendar=[
      // a group dinner the player was at, two days ago
      {id:"c1",kind:"meeting",title:"Dinner at ours",who:"Duygu, Hakan, Nil",
       charIds:["p_d","p_h","p_n"],charId:"p_d",charId2:"p_h",withUser:true,
       day:3,period:"Evening",done:true,completedDay:3,result:"It went quietly; nobody mentioned the money."},
      // an errand that ran offstage without the player
      {id:"c2",kind:"meeting",title:"Talk to Hakan about the money",who:"Duygu, Hakan",
       charIds:["p_d","p_h"],charId:"p_d",charId2:"p_h",withUser:false,source:"directive",
       executor:"Duygu",executorId:"p_d",
       day:4,period:"Afternoon",done:true,completedDay:4,result:"He brushed it off and changed the subject."},
      // one Nil was never part of
      {id:"c3",kind:"meeting",title:"Coffee with Hakan",who:"Hakan",
       charIds:["p_h"],charId:"p_h",withUser:true,day:4,done:true,completedDay:4,result:"Short and awkward."},
      // a meeting that never happened — the absence, not an event
      {id:"c4",kind:"meeting",title:"Cinema",who:"Duygu",charIds:["p_d"],withUser:true,
       day:2,done:true,completedDay:2,outcome:"missed"},
      // still upcoming
      {id:"c5",kind:"meeting",title:"Hospital",who:"Duygu",charIds:["p_d"],withUser:true,day:6,period:"Morning",done:false}
    ];
    state.calDoneN=3; markChatDirty(chat);
  });

  console.log("\n[a character remembers what they were part of]");
  ok("Duygu gets the two she was in, newest first", await pg.evaluate(()=>{
      const v=calendarDoneLine(curChat(),"Duygu","p_d",{bare:true});
      const i1=v.indexOf("Talk to Hakan"), i2=v.indexOf("Dinner at ours");
      return (i1>-1 && i2>-1 && i1<i2) ? true : v; }));
  ok("and the recorded outcome of each", await pg.evaluate(()=>{
      const v=calendarDoneLine(curChat(),"Duygu","p_d",{bare:true});
      return /brushed it off/.test(v) && /nobody mentioned the money/.test(v) ? true : v; }));
  ok("a plan she was not in never reaches her", await pg.evaluate(()=>{
      const v=calendarDoneLine(curChat(),"Duygu","p_d",{bare:true});
      return !/Coffee with Hakan/.test(v) ? true : "she got someone else's coffee"; }));
  ok("a meeting that did NOT happen is not an event", await pg.evaluate(()=>{
      const v=calendarDoneLine(curChat(),"Duygu","p_d",{bare:true});
      return !/Cinema/.test(v) ? true : "a missed meeting was reported as having happened"; }));
  ok("an upcoming plan is not in it either", await pg.evaluate(()=>{
      const v=calendarDoneLine(curChat(),"Duygu","p_d",{bare:true});
      return !/Hospital/.test(v) ? true : "an unfinished plan leaked in"; }));
  ok("it names the others who were there", await pg.evaluate(()=>{
      const v=calendarDoneLine(curChat(),"Duygu","p_d",{bare:true});
      return /with Hakan, Nil/.test(v) ? true : v; }));
  ok("it dates them the way a person would", await pg.evaluate(()=>{
      const v=calendarDoneLine(curChat(),"Duygu","p_d",{bare:true});
      return /yesterday/.test(v) ? true : v; }));
  ok("the count is the setting, and 0 turns it off", await pg.evaluate(()=>{
      state.calDoneN=1;
      const one=calendarDoneLine(curChat(),"Duygu","p_d",{bare:true}).split("\n- ").length;
      state.calDoneN=0;
      const none=calendarDoneLine(curChat(),"Duygu","p_d",{bare:true});
      state.calDoneN=3;
      return (one===1 && none==="") ? true : "one="+one+" none="+JSON.stringify(none); }));

  console.log("\n[it reaches the reply payload and the phone alike]");
  ok("the spoken reply carries it", await pg.evaluate(()=>{
      const p=(state.personas||[]).find(x=>x.id==="p_d");
      const B=buildTailBlocks({chat:curChat(),selfP:p,selfId:p.id,selfName:p.name,
        targetName:state.user,targetId:"__user__",multi:false,injected:{}});
      return /Talk to Hakan about the money/.test(B.calendar_done||"") ? true : String(B.calendar_done||"(none)"); }));
  ok("so does a text reply", await pg.evaluate(()=>{
      const p=(state.personas||[]).find(x=>x.id==="p_d");
      const B=buildTailBlocks({chat:curChat(),selfP:p,selfId:p.id,selfName:p.name,
        targetName:state.user,targetId:"__user__",multi:false,injected:{},textMode:true});
      return /Talk to Hakan about the money/.test(B.calendar_done||"") ? true : String(B.calendar_done||"(none)"); }));
  ok("it is an ordered, editable block like any other", await pg.evaluate(()=>
      REPLY_ORDER.indexOf("calendar_done")>-1 && !!REPLY_BLOCKS.calendar_done
      && typeof BLOCK_TPL_DEFAULTS.calendar_done_header==="string"));
  ok("its header tells them not to recite it", await pg.evaluate(()=>
      /Never list them/.test(BLOCK_TPL_DEFAULTS.calendar_done_header)));

  console.log("\n[a meeting can hold more than two people]");
  ok("every participant is matched by id", await pg.evaluate(()=>{
      const e=chatCalendar(curChat()).find(x=>x.id==="c1");
      return planCharIds(e).join(",")==="p_d,p_h,p_n" ? true : planCharIds(e).join(","); }));
  ok("the third person is party to it, not just the tagged two", await pg.evaluate(()=>{
      const e=chatCalendar(curChat()).find(x=>x.id==="c1");
      return planHasChar(e,"p_n","Nil")===true ? true : "Nil was left out of her own dinner"; }));
  ok("someone outside it is not", await pg.evaluate(()=>{
      const e=chatCalendar(curChat()).find(x=>x.id==="c3");
      return planHasChar(e,"p_n","Nil")===false ? true : "Nil joined a meeting she was not in"; }));
  ok("Nil's own payload carries the dinner", await pg.evaluate(()=>{
      const v=calendarDoneLine(curChat(),"Nil","p_n",{bare:true});
      return /Dinner at ours/.test(v) ? true : v||"(nothing)"; }));
  ok("the group is split on conjunctions, not only commas", await pg.evaluate(()=>{
      const e={who:"Duygu, Nil ve Hakan"};
      return planOtherNames(e,"Nil").join("|")==="Duygu|Hakan"
        ? true : planOtherNames(e,"Nil").join("|"); }));
  ok("a plan with no ids still matches by name", await pg.evaluate(()=>
      planHasChar({who:"Duygu, Hakan"},null,"Hakan")===true));
  ok("the picker offers everyone else in the universe", await pg.evaluate(()=>{
      addCalManual();
      const n=document.querySelectorAll('#caMore input[data-more]').length;
      const m=document.getElementById('calAddModal'); if(m)m.remove();
      return n===3 ? true : "offered "+n; }));

  console.log("\n[an errand you hand out comes back with a result]");
  ok("the detector is told what a task is", await pg.evaluate(()=>
      /TASKS — SOMETHING/.test(DEFAULT_CAL) && /go and talk to Hakan/.test(DEFAULT_CAL)));
  ok("it may be undated, unlike a meeting", await pg.evaluate(()=>
      /does NOT need a stated day/.test(DEFAULT_CAL)));
  ok("a refusal is not a task", await pg.evaluate(()=>
      /did not flatly refuse/.test(DEFAULT_CAL)));
  ok("a task lands as an offstage plan the executor will run", await pg.evaluate(()=>{
      const e=chatCalendar(curChat()).find(x=>x.id==="c2");
      return (e.withUser===false && e.source==="directive" && e.executorId==="p_d")
        ? true : JSON.stringify({w:e.withUser,s:e.source,x:e.executorId}); }));
  ok("and its result comes back to everyone who was in it", await pg.evaluate(()=>{
      const d=calendarDoneLine(curChat(),"Duygu","p_d",{bare:true});
      const h=calendarDoneLine(curChat(),"Hakan","p_h",{bare:true});
      return (/brushed it off/.test(d) && /brushed it off/.test(h))
        ? true : "d="+/brushed/.test(d)+" h="+/brushed/.test(h); }));

  console.log("\n[the calendar shows everything that is going on]");
  ok("ticking a plan done by hand dates it", await pg.evaluate(()=>{
      const chat=curChat();
      chat.calendar.push({id:"c9",kind:"meeting",title:"Hand ticked",who:"Duygu",charIds:["p_d"],withUser:true,day:5,done:false});
      toggleCalDone("c9");
      const e=chatCalendar(chat).find(x=>x.id==="c9");
      const okd=e.done===true&&e.completedDay===5;
      toggleCalDone("c9");
      const back=chatCalendar(chat).find(x=>x.id==="c9");
      const oku=back.done===false&&back.completedDay==null;
      chat.calendar=chat.calendar.filter(x=>x.id!=="c9");
      const cm=document.getElementById('calModal'); if(cm)cm.remove();
      return (okd&&oku) ? true : "done="+okd+" undone="+oku; }));
  ok("it has a 'what already happened' section", await pg.evaluate(()=>
      /already happened/.test(_calDoneSection(curChat()))));
  ok("a missed meeting shows there as not having happened", await pg.evaluate(()=>
      /didn't happen/.test(_calDoneSection(curChat()))));
  ok("brewing motives and suspicions have a section", await pg.evaluate(()=>{
      const chat=curChat();
      chat.intents=[{id:"i1",holderName:"Hakan",targetName:"Emre",kind:"suspicion",status:"brewing",
                     strength:.6,day:4,aim:"find out who she was with",trigger:"a message he half saw"}];
      const h=_calBrewingSection(chat); chat.intents=[];
      return (/Brewing/.test(h)&&/find out who she was with/.test(h)) ? true : h.slice(0,200)||"(empty)"; }));
  ok("a spent motive is not shown as live", await pg.evaluate(()=>{
      const chat=curChat();
      chat.intents=[{id:"i2",holderName:"Nil",kind:"grievance",status:"spent",strength:.9,aim:"gone"}];
      const h=_calBrewingSection(chat); chat.intents=[];
      return h==="" ? true : "a spent motive was listed"; }));
  ok("the living universe has a section", await pg.evaluate(()=>{
      const chat=curChat();
      chat.worldLog=[{day:4,period:"Night",place:"Bar",headline:"Hakan drank alone",event:"He sat at the bar until closing."}];
      const h=_calOffstageSection(chat); chat.worldLog=[];
      return (/living universe/.test(h)&&/drank alone/.test(h)) ? true : h.slice(0,200)||"(empty)"; }));
  ok("the modal opens with all of it and no errors", await pg.evaluate(()=>{
      const chat=curChat();
      chat.intents=[{id:"i3",holderName:"Hakan",kind:"scheme",status:"armed",strength:.5,aim:"x"}];
      chat.worldLog=[{day:4,headline:"something",event:"y"}];
      openCalendar();
      const el=document.getElementById('calModal');
      const t=el?el.textContent:"";
      if(el)el.remove(); chat.intents=[]; chat.worldLog=[];
      return (/already happened/.test(t)&&/Brewing/.test(t)&&/living universe/.test(t))
        ? true : "sections present: "+/already happened/.test(t)+"/"+/Brewing/.test(t)+"/"+/living universe/.test(t); }));

  ok("no page errors", errs.length===0?true:errs.join(" | "));
  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close(); process.exit(fail?1:0);
})();
