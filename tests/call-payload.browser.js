/* v103.1 — THE CALL PAYLOAD WAS THE NARROWEST IN THE APP.
   buildCallInstructions is the one payload assembled by hand rather than through REPLY_ORDER, and
   it had drifted: the world, the bio, the relationship sheet and four diary entries, with no date,
   no place, no memory of today, no promises, no meetings and no idea what scene the call had just
   interrupted. A character you had been standing beside a moment earlier picked up as though you
   had not spoken in a week.
   These assert the borrowed producers are actually reached, that each one's own gate still decides
   whether it renders, and that the delivery contract stays last.
   Run: node tests/call-payload.browser.js */
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
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x||c).slice(0,700));} };

  // A world with something in every ledger the call now reads.
  const build=(opts)=>pg.evaluate((o)=>{
    const uni=state.universes[0];
    uni.setting="A coastal town.";
    uni.locations=[{id:"l_cafe",name:"Coffee House",description:"c",residents:[],sublocations:[]}];
    const mk=(id,n)=>({id,name:n,universeId:uni.id,instructions:"x",personality:"warm",
      backstory:"b",style:"s",goals:"g",look:{}});
    state.personas=[mk("p_a","Duygu"),mk("p_b","Hakan")];
    state.user="Emre"; state.userBio="A photographer."; state.key="k"; state.mem=true;
    const chat=curChat();
    chat.gameDay=4; chat.locationId="l_cafe"; chat.location="Coffee House";
    chat.presentIds=o.alone?["p_a"]:["p_a","p_b"];
    chat.messages=o.quiet?[]:[
      {mid:"m1",role:"user",content:"I thought you'd left already."},
      {mid:"m2",role:"assistant",speaker:"Duygu",speakerId:"p_a",content:"Not yet. I was waiting."}];
    chat.dayLog=null; chat.calendar=[]; chat.promises=[];
    state.memory=[{id:"x1",ownerId:"p_a",content:"I argued with my brother about the shop.",
      gameDay:4,gamePeriod:"Morning",type:"EVENT",importance:0.7,date:1,location:"Coffee House"},
      {id:"x2",ownerId:"p_a",content:"A long day that ended badly.",gameDay:3,type:"DIARY",importance:0.6,date:2}];
    chat.period="Midday";
    try{ noteWhereabouts(chat,["p_a"],{placeId:"l_cafe",place:"Coffee House",what:"argued with her brother"}); }catch(e){}
    chat.period=o.period||"Evening";
    try{ recordPromise(chat,{holder:"Duygu",to:"Emre",ask:"",promise:"You said you would tell him yourself.",
      kind:"promise",weight:"binding",day:3,shows_as:"when the shop comes up at dinner tomorrow"}); }catch(e){}
    try{ addCalendarEntry(chat,{kind:"meeting",title:"Dinner at the harbour",detail:"To settle the shop question",
      day:5,period:"Evening",who:"Duygu, Emre",where:"Coffee House",executor:"Duygu",executorId:"p_a",
      withUser:true,source:"world",certainty:"certain"}); }catch(e){}
    return buildCallInstructions((state.personas||[]).find(x=>x.id==="p_a"), chat);
  },opts||{});

  const full=await build({});

  console.log("\n[the call knows when and where it is]");
  ok("the day and the part of the day are on the page", /Day 4, Evening/.test(full));
  ok("so is the place", /you are at Coffee House/.test(full));
  ok("and who else can hear it — a spoken conversation the room is in",
     /Hakan is within earshot/.test(full));

  console.log("\n[it reads the ledgers the reply reads]");
  ok("where they have already been today", /# WHERE YOU HAVE BEEN TODAY[\s\S]*Midday: Coffee House/.test(full));
  ok("today's own memories, through the reply's own producer",
     /THESE ARE YOUR RECENT MEMORIES[\s\S]*argued with my brother/.test(full));
  ok("and the diaries, stamped by the same day ladder",
     /THESE ARE YOUR DISTANT MEMORIES[\s\S]*This happened yesterday/.test(full));
  ok("the promises still in force", /# YOUR WORD[\s\S]*tell him yourself/.test(full));
  ok("the meetings with a time on them", /# MEETINGS[\s\S]*Dinner at the harbour/.test(full));
  ok("and the scene the call interrupted",
     /# WHAT WAS HAPPENING JUST BEFORE THIS[\s\S]*I thought you'd left already/.test(full));

  console.log("\n[what it deliberately does not carry]");
  ok("no drives block — they made replies philosophical and a spoken line has less room",
     !/DRIVES|WHAT PULLS AT YOU|BRAKES/i.test(full));
  ok("no private intent", !/PRIVATE INTENT|WHAT YOU ARE NOT SAYING/i.test(full));
  ok("no feelings-now block", !/HOW YOU FEEL RIGHT NOW/i.test(full));

  console.log("\n[order still means something]");
  ok("the role opener is first", /^You are Duygu, talking WITH Emre in person/.test(full.trim()));
  ok("the delivery contract is last — it is how to say everything above it",
     full.trim().endsWith("Otherwise favor short sentences."));
  ok("the scene comes before the ledgers it dates",
     full.indexOf("# WHERE YOU ARE RIGHT NOW") < full.indexOf("# WHERE YOU HAVE BEEN TODAY"));
  ok("and the interrupted scene sits just above the delivery contract",
     full.indexOf("# WHAT WAS HAPPENING JUST BEFORE THIS") < full.indexOf("# HOW YOU SPEAK") &&
     full.indexOf("# MEETINGS") < full.indexOf("# WHAT WAS HAPPENING JUST BEFORE THIS"));

  console.log("\n[each producer's own gate still decides]");
  const quiet=await build({quiet:true});
  ok("a call that interrupts nothing carries no such block",
     !/# WHAT WAS HAPPENING JUST BEFORE THIS/.test(quiet));
  const alone=await build({alone:true});
  ok("alone with the player, nobody is reported as overhearing",
     !/within earshot/.test(alone));
  const dawn=await build({period:"Morning"});
  ok("first thing in the morning there is no earlier today to report",
     !/# WHERE YOU HAVE BEEN TODAY/.test(dawn),
     "the whereabouts gate stopped filtering to periods already lived");

  console.log("\n[the new prose is editable, like every other prompt]");
  ok("the scene opener is a registry prompt", await pg.evaluate(()=>
      typeof up("x_call_scene")==="string" && /WHERE YOU ARE RIGHT NOW/.test(up("x_call_scene")) ));
  ok("so is the interrupted-scene block", await pg.evaluate(()=>
      /WHAT WAS HAPPENING JUST BEFORE THIS/.test(up("x_call_recent")||"") ));
  ok("both are on the Voice call card, so Settings can reach them", await pg.evaluate(()=>{
      const card=(X_PROMPT_CARDS||[]).find(c=>c&&c.key==="voice_call");
      if(!card)return "no voice_call card";
      return (card.keys.includes("x_call_scene")&&card.keys.includes("x_call_recent"))
        ? true : "the new keys are not on it: "+card.keys.join(","); }));

  ok("no page errors", errs.length===0?true:errs.join(" | "));
  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close(); process.exit(fail?1:0);
})();
