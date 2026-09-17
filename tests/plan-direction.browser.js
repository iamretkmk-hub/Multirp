/* v60.1 — A PLAN THAT TOLD HER THE PLAYER WAS COMING, TO HIS OWN HOUSE.
   From a live payload. The entry's own words were "She plans to go to Emre's house and ask directly
   why he never came to the pool" — and the line under it read "Emre Tokmak is the one coming; you
   are expected to be there", while she was standing in his kitchen having already asked him.
   Three separate faults stacked:
     · runGoalPursuit wrote no `executor` at all;
     · the boot back-fill then stamped "user" on any entry that had none, inventing a direction
       nobody had recorded;
     · _hereNow could never fire for a plan whose only named person is the reader, so a plan being
       KEPT still read as pending — and planDueNow stays true all day, so an Afternoon plan was
       still announcing HAPPENING NOW in the Evening.
   Plus two things that were quietly wrong in the same payload: the purpose was cut mid-word at 120
   characters, and the proactive-text memory carried the engine's own reason for sending, in the
   third person, in whichever language that engine answered in.
   Run: node tests/plan-direction.browser.js */
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

  const setup=()=>pg.evaluate(()=>{
    const uni=state.universes[0];
    uni.locations=[{id:"l_emre",name:"Emre's Luxury Residence",description:"his house",residents:[],
                    sublocations:[{id:"s_kitchen",name:"Gourmet Kitchen"}]},
                   {id:"l_home",name:"Atan Residence",description:"her house",residents:[]}];
    const her={id:"p_burcu",name:"Burcu Atan",universeId:uni.id,instructions:"x",personality:"x",
               backstory:"x",style:"x",goals:"x",look:{}};
    state.personas=[her]; state.user="Emre Tokmak"; state.calOn=true;
    try{ store.setRaw(K.user,"Emre Tokmak"); }catch(e){}   // so the name survives the reload below
    const chat=curChat(); chat.gameDay=3; chat.calendar=[]; chat.presentIds=[her.id];
    chat.locationId="l_emre"; chat.location="Emre's Luxury Residence"; chat.subId="s_kitchen";
    try{ persistPersonas(); }catch(e){}
    try{ if(typeof persistUniverses==="function")persistUniverses(); }catch(e){}
    markChatDirty(chat); persistChats();
    return her.id;
  });
  const herId=await setup();

  // ---- the back-fill stops inventing a direction
  const mig=await pg.evaluate(async(id)=>{
    const chat=curChat();
    chat.calendar=[
      {id:"c_none",kind:"meeting",title:"No direction recorded",who:"Burcu Atan",day:3,period:"Evening",
       certainty:"certain",done:false},
      {id:"c_doer",kind:"meeting",title:"Old entry with a doer",who:"Burcu Atan",day:3,period:"Evening",
       doer:"Burcu Atan",certainty:"certain",done:false},
      {id:"c_doer_u",kind:"meeting",title:"Old entry the player owned",who:"Burcu Atan",day:3,period:"Evening",
       doer:state.user,certainty:"certain",done:false}];   // whatever name the load actually carries
    markChatDirty(chat); persistChats();
    await new Promise(r=>setTimeout(r,900));   // persistChats reaches IndexedDB asynchronously
    return chatCalendar(chat).length;
  },herId);
  ok("the three fixtures are on the chat before the reload", mig===3, "wrote "+mig);
  await pg.reload(); await pg.waitForTimeout(2400);
  const after=await pg.evaluate(()=>{
    const chat=curChat();
    const g=id=>(chatCalendar(chat)||[]).find(e=>e.id===id)||{};
    return {none:g("c_none").executor, doer:g("c_doer").executor, doerU:g("c_doer_u").executor};
  });
  ok("an entry nobody recorded a direction for keeps none",
     after.none===undefined||after.none===null||after.none==="", JSON.stringify(after));
  ok("an old entry's doer still becomes its executor", after.doer==="Burcu Atan", JSON.stringify(after));
  ok("and a doer that was the player still maps to user", after.doerU==="user",
     JSON.stringify(after)+" (user is "+(await pg.evaluate(()=>state.user))+")");

  await setup();   // the reload above dropped the in-memory fixtures
  // ---- with no executor, nothing is asserted about who comes
  const silent=await pg.evaluate(async()=>{
    const chat=curChat(); const her=state.personas[0];
    chat.locationId="l_home"; chat.location="Atan Residence";
    chat.calendar=[{id:"c1",kind:"meeting",title:"Something",who:"Burcu Atan",day:3,period:"Evening",
                    certainty:"certain",done:false,where:"Emre's Luxury Residence",locationId:"l_emre"}];
    return calendarContextLine(chat,her.name,her.id)||"";
  });
  ok("an entry with no executor claims nobody is coming",
     !/is the one coming/.test(silent)&&!/YOU are the one who has to make this happen/.test(silent), silent.slice(0,240));

  // ---- a goal plan names its own actor
  const goal=await pg.evaluate(()=>{
    const chat=curChat(); const her=state.personas[0];
    chat.calendar=[{id:"c2",kind:"meeting",title:"Confront Emre at his house about the pool",
      who:"Burcu Atan",day:3,period:"Afternoon",certainty:"certain",done:false,
      where:"Emre's Luxury Residence",locationId:"l_emre",
      executor:"Burcu Atan",executorId:her.id,withUser:false,source:"world",goalPlan:true,
      detail:"to ask him why he never came to the pool"}];
    chat.locationId="l_home"; chat.location="Atan Residence";
    return calendarContextLine(chat,her.name,her.id)||"";
  });
  ok("a plan she made reaches her as HERS to carry out",
     /YOU are the one who has to make this happen/.test(goal), goal.slice(0,300));
  ok("and never as the player coming to her",
     !/is the one coming/.test(goal), goal.slice(0,300));

  // ---- being at the place at the hour reads as keeping it
  const here=await pg.evaluate(()=>{
    const chat=curChat(); const her=state.personas[0];
    chat.locationId="l_emre"; chat.location="Emre's Luxury Residence";
    chat.calendar[0].period=chatPeriod(chat);
    return calendarContextLine(chat,her.name,her.id)||"";
  });
  ok("a solo plan being kept reads as underway, not as pending",
     /You are AT the place and the hour is now/.test(here)
     &&/this is you keeping it, already underway/.test(here), here.slice(0,300));
  ok("and it no longer tells her to make it happen while she is making it happen",
     !/YOU are the one who has to make this happen/.test(here), here.slice(0,300));

  // ---- an hour that has passed is not "happening now"
  const late=await pg.evaluate(()=>{
    const chat=curChat(); const her=state.personas[0];
    chat.locationId="l_home"; chat.location="Atan Residence";            // not where it is
    chat.period="Evening";                                               // pin the clock
    chat.calendar[0].period="Afternoon";                                 // its hour has gone
    const line=calendarContextLine(chat,her.name,her.id)||"";
    chat.calendar[0].period="Evening";                                   // its hour is now
    return {late:line, now:calendarContextLine(chat,her.name,her.id)||""};
  });
  ok("a plan whose hour has passed moves off HAPPENING NOW",
     /ITS HOUR HAS PASSED TODAY/.test(late.late)&&!/HAPPENING NOW/.test(late.late), late.late.slice(0,240));
  ok("a plan whose hour IS now still says so",
     /HAPPENING NOW/.test(late.now), late.now.slice(0,240));

  // ---- the purpose is cut on a word, not through one
  const cut=await pg.evaluate(()=>{
    const chat=curChat(); const her=state.personas[0];
    chat.calendar[0].detail="to ask him directly why he never came to the pool after saying he would, and to hear what he actually has to say about it before deciding anything";
    const line=calendarContextLine(chat,her.name,her.id)||"";
    const m=line.match(/— for: ([^—]+)/);
    return m?m[1].trim():"";
  });
  ok("a long purpose ends on a whole word", /…$/.test(cut)&&!/\s\w{1,2}…$/.test(cut), cut);
  ok("and it is still capped", cut.length<=125, cut.length+" chars");

  // ---- the proactive-text memory is hers, not the engine's
  const mem=await pg.evaluate(async()=>{
    const chat=curChat(); const her=state.personas[0];
    state.memory=[];
    const real=window.renderTextThread, realB=window.updateTextBadges, realT=window.toast,
          realS=window.autoSpeakMsg;
    window.renderTextThread=()=>{}; window.updateTextBadges=()=>{}; window.toast=()=>{};
    window.autoSpeakMsg=()=>{};
    try{ deliverProactiveText(chat,her,"Bugün akşam restorana geliyorsan haber ver.",
          "The loosely floated meeting needs a nudge, and she wants to make it concrete"); }
    finally{ window.renderTextThread=real; window.updateTextBadges=realB; window.toast=realT;
             window.autoSpeakMsg=realS; }
    const m=(state.memory||[])[0]||null;
    return m&&m.content;
  });
  ok("the memory records what she sent",
     /^I texted Emre Tokmak first: "Bugün akşam restorana geliyorsan haber ver\./.test(mem), mem);
  ok("and carries none of the engine's reasoning about her",
     !/loosely floated/.test(mem)&&!/she wants to/.test(mem)&&!/\(/.test(mem), mem);

  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log("\n  "+pass+" passed, "+fail+" failed");
  await b.close();
  process.exit(fail?1:0);
})();
