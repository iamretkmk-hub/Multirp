/* v96.1 — THE WHOLE CAST LIVES, AND EACH OF THEM KNOWS WHERE THEY WERE.
   Two asks, one release.
   (1) The world pulse picked the single most charged co-located PAIR every few turns and wrote that
       one encounter; everybody else stood still. Now a round runs once per part of the day over
       everyone offstage and unclaimed, PARTITIONS them — X with Y means X and Y are both spent —
       and writes something for each entry, usually something ordinary. Nothing reaches the screen.
   (2) A character could not answer "what did you do today?" about their own day: memories are
       narrative, arrive late and are retrieved by relevance, so one asked in the Afternoon where
       she was at Midday guessed, and guessed wrong. The day ledger is plain fact — period, place,
       who else was there — written only where the app already knows, and dropped at day's end.
   Run: node tests/world-round.browser.js */
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

  const world=()=>pg.evaluate(()=>{
    const uni=state.universes[0];
    uni.locations=[{id:"l_gym",name:"Gym",description:"g",residents:[],sublocations:[]},
                   {id:"l_home",name:"Akbaba Residence",description:"h",residents:[],sublocations:[]},
                   {id:"l_cafe",name:"Coffee House",description:"c",residents:[],sublocations:[]}];
    const mk=(id,n)=>({id,name:n,universeId:uni.id,instructions:"x",personality:"x",
      backstory:"x",style:"x",goals:"x",look:{}});
    state.personas=[mk("p_a","Duygu"),mk("p_b","Hakan"),mk("p_c","Burcu"),mk("p_d","Burak")];
    state.user="Emre"; state.key="k"; state.roundOn=true; state.calOn=true; state.promiseOn=true;
    const chat=curChat();
    chat.gameDay=4; chat.period="Midday"; chat.presentIds=[]; chat.locationId="l_gym";
    chat.dayLog=null; chat.worldLog=[]; chat.pulseBusy=null; chat._roundAt=null;
    chat.calendar=[]; chat.promises=[]; state.memory=[];
    chat.worldPositions={p_a:"l_home",p_b:"l_home",p_c:"l_cafe",p_d:"l_home"};
    return true;
  });

  console.log("\n[the day ledger is fact, not narrative]");
  await world();
  ok("it records period, place and company", await pg.evaluate(()=>{
      const chat=curChat(); chat.period="Morning";
      noteWhereabouts(chat,["p_a","p_b"],{placeId:"l_gym"});
      const r=whereaboutsToday(chat,"p_a")[0];
      return (r&&r.period==="Morning"&&r.place==="Gym"&&r.with.join()==="Hakan")
        ? true : JSON.stringify(r); }));
  ok("a scene played over many turns is one entry, widened, not many", await pg.evaluate(()=>{
      const chat=curChat(); chat.period="Midday";
      noteWhereabouts(chat,["p_a","__user__"],{placeId:"l_cafe"});
      noteWhereabouts(chat,["p_a","__user__"],{placeId:"l_cafe"});
      noteWhereabouts(chat,["p_a","p_c"],{placeId:"l_cafe"});
      const rows=whereaboutsToday(chat,"p_a").filter(r=>r.period==="Midday");
      return (rows.length===1 && rows[0].with.join()==="Emre,Burcu")
        ? true : JSON.stringify(rows); }));
  ok("the player is recorded as company but keeps no ledger of their own", await pg.evaluate(()=>
      whereaboutsToday(curChat(),"__user__").length===0 ));
  ok("the part of the day being lived is left out — the scene block says where you are",
     await pg.evaluate(()=>{
      const chat=curChat(); chat.period="Midday";
      const t=whereaboutsBlock(chat,"p_a",{});
      return /Morning: Gym/.test(t) && !/Midday/.test(t) ? true : t; }));
  ok("and once it is behind them it appears", await pg.evaluate(()=>{
      const chat=curChat(); chat.period="Evening";
      const t=whereaboutsBlock(chat,"p_a",{});
      return /Morning: Gym/.test(t) && /Midday: Coffee House/.test(t) && /with Emre, Burcu/.test(t)
        ? true : t; }));
  ok("somebody with no day yet gets no block at all", await pg.evaluate(()=>
      whereaboutsBlock(curChat(),"p_d",{})==="" ));
  ok("the block tells them not to invent the rest", await pg.evaluate(()=>
      /Do not put yourself anywhere else/.test(blkTpl("whereabouts_header"))
   && /do not claim company you did not have/.test(blkTpl("whereabouts_header")) ));
  ok("it is keyed to the day and rebuilt when the day turns", await pg.evaluate(()=>{
      const chat=curChat(); chat.gameDay=5;
      return whereaboutsToday(chat,"p_a").length===0 ? true : "yesterday survived the night"; }));
  ok("end of day drops it explicitly too", (()=>{
      const src=require('fs').readFileSync('/home/user/Multirp/index.html','utf8');
      return /chat\.dayLog=null;/.test(src) ? true : "endDay never clears the ledger"; })());
  ok("the player's own scene is what writes it, every turn", (()=>{
      const src=require('fs').readFileSync('/home/user/Multirp/index.html','utf8');
      const i=src.indexOf('async function postTurn(chat){');
      return /noteWhereabouts\(chat,_here\.concat\(\["__user__"\]\)\)/.test(src.slice(i,i+700))
        ? true : "postTurn does not record the scene"; })());
  ok("and it is a block the layout carries", await pg.evaluate(()=>
      REPLY_ORDER.indexOf("whereabouts")>REPLY_ORDER.indexOf("__history__")
      && !!REPLY_BLOCKS.whereabouts ));

  console.log("\n[a round covers everyone, and nobody twice]");
  await world();
  const round=await pg.evaluate(async()=>{
    const chat=curChat();
    const real=window.chatCompletion;
    window.chatCompletion=async()=>JSON.stringify({entries:[
      {who:["Duygu","Hakan"],place:"Akbaba Residence",headline:"They watched a film",
       event:"They sat through a film and barely spoke.",kind:"ordinary",
       memories:[{name:"Duygu",content:"We watched a film at home.",emotion:"calm",importance:0.3,people:["Hakan"]},
                 {name:"Hakan",content:"Watched a film with Duygu.",emotion:"calm",importance:0.3,people:["Duygu"]}],
       rel:[],plan:null,promise:null},
      {who:["Hakan","Burcu"],place:"Gym",headline:"COLLIDES",event:"x",kind:"ordinary",
       memories:[{name:"Burcu",content:"leaked",emotion:"calm",importance:0.3,people:[]}],
       rel:[],plan:null,promise:null},
      {who:["Burak"],place:"Akbaba Residence",headline:"He fixed a tap",
       event:"He spent the hour under the sink.",kind:"ordinary",
       memories:[{name:"Burak",content:"Fixed the tap.",emotion:"neutral",importance:0.2,people:[]}],
       rel:[],
       plan:{title:"Ocak kontrolu",detail:"He means to ask Hakan straight out whether the boiler was serviced, and settle who pays.",dayOffset:1,period:"Evening",where:"Akbaba Residence",who:["Burak","Hakan"]},
       promise:{holder:"Burak",to:"Hakan",promise:"you will not mention the boiler to Duygu",
                kind:"prohibition",shows_as:"the next time the three of them are in the kitchen"}}
    ]});
    let ran=0;
    try{ ran=await runWorldRound(chat,null); } finally { window.chatCompletion=real; }
    return {ran,
      log:(chat.worldLog||[]).map(e=>e.headline),
      busy:((chat.pulseBusy||{}).ids||[]).slice(),
      burcu:whereaboutsToday(chat,"p_c"),
      duygu:whereaboutsToday(chat,"p_a"),
      mems:(state.memory||[]).map(m=>m.character+": "+m.content),
      cal:(chat.calendar||[]).map(e=>({t:e.title,d:e.day,w:e.who,detail:!!e.detail})),
      pr:(chat.promises||[]).map(x=>x.holderName+"->"+x.toName)};
  });
  ok("an entry naming somebody already placed is dropped WHOLE", round.ran===2, JSON.stringify(round.ran));
  ok("its headline never reaches the log", !round.log.includes("COLLIDES"), JSON.stringify(round.log));
  ok("and its memory never reaches the person left in it",
     !round.mems.some(m=>/leaked/.test(m)), JSON.stringify(round.mems));
  ok("that person is simply left for the next round", round.burcu.length===0, JSON.stringify(round.burcu));
  ok("everyone the round did place is marked spent for the period",
     ["p_a","p_b","p_d"].every(id=>round.busy.includes(id)), JSON.stringify(round.busy));
  ok("each of them carries their own memory of it",
     round.mems.length===3 && round.mems.some(m=>/^Duygu/.test(m)) && round.mems.some(m=>/^Burak/.test(m)),
     JSON.stringify(round.mems));
  ok("and their whereabouts say who they were with",
     round.duygu.length===1 && round.duygu[0].with.join()==="Hakan", JSON.stringify(round.duygu));
  ok("a solo entry is a real entry", round.mems.some(m=>/Burak: Fixed the tap/.test(m)),
     JSON.stringify(round.mems));

  console.log("\n[what a round may leave behind]");
  ok("a plan lands on the ordinary calendar, dated forward",
     round.cal.length===1 && round.cal[0].d===5 && /Burak/.test(round.cal[0].w), JSON.stringify(round.cal));
  ok("and it carries a real reason, not a title", round.cal[0]&&round.cal[0].detail===true,
     JSON.stringify(round.cal));
  ok("a promise lands on the ordinary ledger", round.pr.join()==="Burak->Hakan", JSON.stringify(round.pr));
  ok("a plan with no stated reason is refused", await pg.evaluate(()=>{
      const chat=curChat(); const before=(chat.calendar||[]).length;
      _roundPlan(chat,{title:"Bir sey",dayOffset:1},[state.personas[0]],4);
      return (chat.calendar||[]).length===before ? true : "a reasonless plan got through"; }));
  ok("a promise with no later moment is refused by recordPromise", await pg.evaluate(()=>{
      const chat=curChat(); const before=(chat.promises||[]).length;
      _roundPromise(chat,{holder:"Duygu",to:"Hakan",promise:"you will be nicer",kind:"promise"},
        n=>(state.personas||[]).find(p=>p.name===n)||null,4);
      return (chat.promises||[]).length===before ? true : "an unshowable promise got through"; }));

  console.log("\n[it runs once per part of the day, and never on screen]");
  ok("a second call in the same period does nothing", await pg.evaluate(async()=>
      (await runWorldRound(curChat(),null))===0 ));
  ok("the period turning lets it run again", await pg.evaluate(async()=>{
      const chat=curChat(); chat.period="Evening"; chat.pulseBusy=null;
      const real=window.chatCompletion;
      window.chatCompletion=async()=>JSON.stringify({entries:[]});
      try{ await runWorldRound(chat,null); } finally { window.chatCompletion=real; }
      return chat._roundAt==="4|Evening" ? true : String(chat._roundAt); }));
  ok("nothing it writes is pushed to the transcript", (()=>{
      const src=require('fs').readFileSync('/home/user/Multirp/index.html','utf8');
      const i=src.indexOf('async function runWorldRound');
      const fn=src.slice(i,src.indexOf('\n}\n',i));
      return /_logSilentWorldEvent\(/.test(fn) && !/_pushWorldEvent\(/.test(fn)
        ? true : "the round can reach the screen"; })());
  ok("it is hooked into the pulse ahead of the single-pair encounter", (()=>{
      const src=require('fs').readFileSync('/home/user/Multirp/index.html','utf8');
      /* the whole function, not a fixed window — its comments grow and a slice that clips the
         second call reports a false failure. */
      const i=src.indexOf('async function maybeWorldPulse');
      const fn=src.slice(i,src.indexOf('\n}\n',i));
      const a=fn.indexOf('runWorldRound'), b=fn.indexOf('runOffstageInteraction');
      return (a>0 && b>0 && a<b) ? true : "round at "+a+", pair at "+b; })());
  ok("the engine is registered and editable", await pg.evaluate(()=>
      !!PROMPT_BY_KEY.worldRound && typeof up("worldRound")==="string" && up("worldRound").length>400 ));
  ok("its one hard rule is stated", await pg.evaluate(()=>{
      const t=up("worldRound")||"";
      return /EVERYBODY APPEARS EXACTLY ONCE/.test(t) && /ORDINARY IS THE POINT/.test(t)
        ? true : "the partition or the ordinariness rule is missing"; }));

  console.log("\n[the round does not reach for drama]");
  ok("ordinary is named the default, not merely permitted", await pg.evaluate(()=>{
      const t=up("worldRound")||"";
      return /"ordinary" is the DEFAULT kind and should be nearly all of them/.test(t)
          && /every single entry is ordinary is a correct answer and the usual one/.test(t)
        ? true : "ordinary is still only allowed"; }));
  ok("anything sharper needs a cause already on the page, and is capped at one", await pg.evaluate(()=>{
      const t=up("worldRound")||"";
      return /needs a cause already written on this page/.test(t) && /AT MOST ONE entry in the round/.test(t)
        ? true : "the charge budget is soft"; }));
  ok("a private want may not be acted on in the background", await pg.evaluate(()=>{
      const t=up("worldRound")||"";
      return /A scheme is not carried out in a round/.test(t)
          && /A grievance is not had out in a round/.test(t)
          && /The most a private want may do is decide who somebody chose to spend the hour with/.test(t)
        ? true : "the wants block reads as a to-do list"; }));
  ok("nothing the player would want to be there for resolves offstage", await pg.evaluate(()=>{
      const t=up("worldRound")||"";
      return /nobody confesses, nobody is caught/.test(t)
          && /scenes belong to the story the player is living/.test(t)
        ? true : "a scene can still be spent offstage"; }));
  ok("and it may not invent one either", await pg.evaluate(()=>{
      const t=up("worldRound")||"";
      return /Never invent a secret, a betrayal, a confession, an accident or a person/.test(t)
        ? true : "invention is still open"; }));
  ok("it runs cooler than the single-pair encounter", (()=>{
      const src=require('fs').readFileSync('/home/user/Multirp/index.html','utf8');
      const r=src.slice(src.indexOf('async function runWorldRound'));
      const o=src.slice(src.indexOf('async function runOffstageInteraction'));
      const t=x=>{ const m=x.match(/temp:fnTemp\("mem",([\d.]+)\)/); return m?+m[1]:null; };
      return (t(r)!==null && t(o)!==null && t(r)<t(o)) ? true : "round="+t(r)+" pair="+t(o); })());
  ok("and the two engines' opposite jobs are written down", (()=>{
      const src=require('fs').readFileSync('/home/user/Multirp/index.html','utf8');
      return /THE TWO ENGINES HAVE OPPOSITE JOBS AND BOTH ARE RIGHT/.test(src)
        ? true : "nothing stops a later reader levelling them"; })());

  console.log("\n[the plan-made memory is one language and one person]");
  ok("the wrapper is English, and a fragment rather than a string in code", await pg.evaluate(()=>
      /I settled on something I mean to do/.test(blkTpl("mem_plan_self"))
   && /and I agreed on it/.test(blkTpl("mem_plan_with")) ));
  ok("no Turkish wrapper prose survives in the code", (()=>{
      const src=require('fs').readFileSync('/home/user/Multirp/index.html','utf8')
        .replace(/\/\*[\s\S]*?\*\//g," ");
      return !/Kendime bir plan koydum|Sebebim:|Derdi \u015fu/.test(src)
        ? true : "the hand-written Turkish memory is still built in code"; })());
  ok("it carries no date — the calendar holds that and renders it live", await pg.evaluate(()=>{
      const t=blkTpl("mem_plan_self")+blkTpl("mem_plan_with")+blkTpl("mem_plan_asked");
      return !/\{\{day\}\}|\{\{period\}\}|g\u00fcn/.test(t) ? true : t; }));
  ok("but it keeps the place, which does not move", await pg.evaluate(()=>
      /\{\{place\}\}/.test(blkTpl("mem_plan_at")) ));
  ok("the title is quoted, so a story-language name sits inside an English record",
     await pg.evaluate(()=>/"\{\{title\}\}"/.test(blkTpl("mem_plan_self")) ));
  ok("the reason is turned to the first person on the way in", (()=>{
      const src=require('fs').readFileSync('/home/user/Multirp/index.html','utf8');
      return /const _why=toFirstPerson\(String\(why\|\|""\)\.trim\(\)\)/.test(src)
        ? true : "a second-person reason still lands in a first-person memory"; })());
  ok("the companion records only that it was arranged, not the other's private reason",
     await pg.evaluate(()=>{
      const t=blkTpl("mem_plan_asked");
      return !/\{\{why\}\}/.test(t) && /I said yes/.test(t) ? true : t; }));
  ok("the emotions are ones the vocabulary actually knows", await pg.evaluate(()=>
      normalizeEmotion("determined")!=="neutral" && normalizeEmotion("concerned")!=="neutral" ));

  console.log("\n[toFirstPerson knows object case]");
  ok("\"the two of you\" is not \"the two of I\"", await pg.evaluate(()=>
      /the two of us/.test(toFirstPerson("something that belongs to the two of you")) ));
  ok("a you after a preposition is me", await pg.evaluate(()=>
      toFirstPerson("It is between you and Berker.")==="It is between me and Berker." ));
  ok("a you taken as an object is me", await pg.evaluate(()=>
      /gave me his word and I believed/.test(toFirstPerson("He gave you his word and you believed him.")) ));
  ok("and the subject case still becomes I", await pg.evaluate(()=>
      /^I am the one who wanted this; my name/.test(toFirstPerson("You are the one who wanted this; your name is on it.")) ));

  console.log("\n[the pursuit writer asks for one player-facing field]");
  ok("the title is asked for in the story language, not in Turkish by name", await pg.evaluate(()=>{
      const t=up("goalPursuit")||"";
      return /IN THE STORY LANGUAGE/.test(t) && !/max 10 words, Turkish/.test(t)
        ? true : "the title is still pinned to one language"; }));
  ok("and everything else it returns is named an engine record", await pg.evaluate(()=>
      /Everything else you return is an engine record and is plain English/.test(up("goalPursuit")||"") ));
  ok("the call sends the mixed directive, not the all-English one", (()=>{
      const src=require('fs').readFileSync('/home/user/Multirp/index.html','utf8');
      return /epSend\("goalPursuit",tpl\+"\\n\\n"\+mixedLangDirective\(\["title"\]\)/.test(src)
        ? true : "the directive still contradicts the prompt"; })());

  ok("no page errors", errs.length===0?true:errs.join(" | "));
  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close(); process.exit(fail?1:0);
})();
