/* v92.1 — THE APP KNOWS WHAT DAY IT IS. IT SHOULD NOT BE ASKING.
   Every memory, plan and outcome is stamped with a day by the app, from its own clock. The payload
   was still shipping "(Day 5, Afternoon)" and asking the ROLEPLAY model to do the arithmetic —
   SCENE RIGHT NOW carried "if it is Day 5 now and it happened on Day 4, that is yesterday". Two
   jobs in one instruction: subtract, then translate, with nothing able to check either. So the gap
   is computed here now and what reaches the page is the phrase.
   Run: node tests/day-wording.browser.js */
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

  console.log("\n[the ladder, backwards]");
  ok("today, yesterday, then counted days", await pg.evaluate(()=>{
      const g=n=>relGapWhen(n,false);
      return (g(0)==="earlier today" && g(1)==="yesterday" && g(2)==="two days ago"
           && g(3)==="three days ago" && g(6)==="six days ago")
        ? true : [0,1,2,3,6].map(g).join(" · "); }));
  ok("the count is spelled, never a numeral", await pg.evaluate(()=>
      !/\d/.test([1,2,3,4,5,6].map(n=>relGapWhen(n,false)).join(" ")) ));
  ok("past a week it stops counting", await pg.evaluate(()=>{
      const g=n=>relGapWhen(n,false);
      return (g(7)==="last week" && g(13)==="last week" && g(14)==="a couple of weeks ago"
           && g(28)==="a while back")
        ? true : [7,13,14,28].map(g).join(" · "); }));

  console.log("\n[the ladder, forwards]");
  ok("later today, tomorrow, the day after", await pg.evaluate(()=>{
      const g=n=>relGapWhen(n,true);
      return (g(0)==="later today" && g(1)==="tomorrow" && g(2)==="the day after tomorrow")
        ? true : [0,1,2].map(g).join(" · "); }));
  ok("then counted, then vague", await pg.evaluate(()=>{
      const g=n=>relGapWhen(n,true);
      return (g(3)==="in three days" && g(7)==="next week" && g(14)==="in a couple of weeks")
        ? true : [3,7,14].map(g).join(" · "); }));
  ok("a day against a day, either direction", await pg.evaluate(()=>
      relWhen(4,5,false)==="yesterday" && relWhen(6,5,true)==="tomorrow" ));
  ok("an unstamped record gets no phrase rather than a wrong one", await pg.evaluate(()=>
      relWhen(0,5,false)==="" && relWhen(null,5,false)==="" && relWhen(3,null,false)==="" ));

  console.log("\n[the memory stamp]");
  ok("it says the phrase, and keeps the part of the day", await pg.evaluate(()=>
      _memWhen({gameDay:4,gamePeriod:"Evening"},5)===" (yesterday, Evening)" ));
  ok("no day number reaches it", await pg.evaluate(()=>
      !/Day\s*\d/.test([1,2,3,4,5].map(d=>_memWhen({gameDay:d,gamePeriod:"Morning"},5)).join(" ")) ));
  ok("a memory with a day but no period still dates itself", await pg.evaluate(()=>
      _memWhen({gameDay:3},5)===" (two days ago)" ));
  ok("one with a period but no day keeps the period alone", await pg.evaluate(()=>
      _memWhen({gamePeriod:"Night"},5)==="" ));
  ok("and the day comes from the chat when the caller does not pass one", await pg.evaluate(()=>{
      const chat=curChat(); chat.gameDay=9;
      return _memWhen({gameDay:8,gamePeriod:"Midday"})===" (yesterday, Midday)"; }));

  console.log("\n[it reaches the blocks a character actually reads]");
  const mem=await pg.evaluate(()=>{
    const uni=state.universes[0];
    const her={id:"p_o",name:"Ozlem",universeId:uni.id,instructions:"x",personality:"x",
      backstory:"x",style:"x",goals:"x",look:{}};
    state.personas=[her]; state.mem=true;
    const chat=curChat(); chat.gameDay=5; chat.location="The Site";
    const mk=(d,per,txt)=>({id:"m"+d,ownerId:her.id,gameDay:d,gamePeriod:per,content:txt,
      location:"Site Shopping Center",importance:0.5});
    const op={};
    memoryBlocks({recent:[mk(4,"Evening","We argued."),mk(1,"Morning","I bought the test.")]},"recent",op);
    return op.mem_recent_entries||"";
  });
  ok("recent memories are dated in words", /\(yesterday, Evening\)/.test(mem)&&/\(four days ago, Morning\)/.test(mem),
     mem);
  ok("and carry no day number at all", !/Day\s*\d/.test(mem), mem);
  ok("the place is untouched — it was never arithmetic", /\[Site Shopping Center\]/.test(mem), mem);

  console.log("\n[the calendar, both directions]");
  const cal=await pg.evaluate(()=>{
    const chat=curChat(); chat.gameDay=5; chat.period="Evening";
    chat.calendar=[
      {id:"c1",title:"Yuzlesme gecesi",day:6,period:"Evening",who:"Ozlem, Berker",certain:true},
      {id:"c2",title:"Kahve",day:7,period:"Midday",who:"Ozlem, Buket",certain:true}
    ];
    return calendarContextLine(chat,"Ozlem","p_o",{bare:true})||"";
  });
  ok("an upcoming plan says when in words", /\(tomorrow\)/.test(cal)&&/\(the day after tomorrow\)/.test(cal), cal);
  ok("and no Day number rides with it", !/Day\s*\d/.test(cal), cal);

  const done=await pg.evaluate(()=>{
    const chat=curChat(); chat.gameDay=5; chat.period="Evening";
    chat.calendar=[
      {id:"d1",title:"Ilk muayene",day:5,period:"Morning",completedDay:5,completedPeriod:"Morning",
       done:true,who:"Ozlem, Berker",result:"It went badly."},
      {id:"d2",title:"Pazar",day:2,period:"Midday",completedDay:2,completedPeriod:"Midday",
       done:true,who:"Ozlem, Buket",result:"Quiet."}
    ];
    return calendarDoneLine(chat,"Ozlem","p_o",{bare:true,limit:5})||"";
  });
  ok("a finished plan is dated the same way a memory is",
     /\(earlier today, Morning\)/.test(done)&&/\(three days ago, Midday\)/.test(done), done);
  ok("its outcome still rides with it", /How it went: It went badly\./.test(done), done);
  ok("and no Day number survives there either", !/Day\s*\d/.test(done), done);

  console.log("\n[the payload stops asking the model to subtract]");
  ok("the scene brief no longer sets the arithmetic", await pg.evaluate(()=>{
      const t=blkTpl("scene_intro");
      return !/if it is Day 5 now and it happened on Day 4/.test(t)
          && /already says so in words/.test(t) && /never say a day number/.test(t)
        ? true : t.slice(0,300); }));
  ok("the text version too", await pg.evaluate(()=>{
      const t=blkTpl("scene_intro_text");
      return /already says how long ago it was, in words/.test(t) && /never say a day number/.test(t)
        ? true : t.slice(0,300); }));
  ok("SCENE RIGHT NOW still states the day itself — it is the anchor", await pg.evaluate(()=>
      /Day \{\{day\}\}/.test(blkTpl("scene_day")) ));

  console.log("\n[every phrase is yours to change]");
  ok("all twelve are editable fragments", await pg.evaluate(()=>{
      const missing=WHEN_ORDER.filter(k=>!BLOCK_TPL_DEFAULTS[k]);
      return missing.length?("no default for "+missing.join(", ")):true; }));
  ok("the editor lists them under their own group", await pg.evaluate(()=>
      (REPLY_EXTRA_TPLS.when||[]).length===WHEN_ORDER.length ));
  ok("an override is what gets used", await pg.evaluate(()=>{
      state.blockTpls=state.blockTpls||{};
      state.blockTpls.when_yesterday="dün";
      const got=relGapWhen(1,false);
      delete state.blockTpls.when_yesterday;
      return got==="dün" ? true : got; }));
  ok("clearing a box restores the shipped word, as everywhere else", await pg.evaluate(()=>{
      state.blockTpls=state.blockTpls||{};
      state.blockTpls.when_yesterday="   ";
      const got=_memWhen({gameDay:4,gamePeriod:"Evening"},5);
      delete state.blockTpls.when_yesterday;
      return got===" (yesterday, Evening)" ? true : JSON.stringify(got); }));

  ok("no page errors", errs.length===0?true:errs.join(" | "));
  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close(); process.exit(fail?1:0);
})();
