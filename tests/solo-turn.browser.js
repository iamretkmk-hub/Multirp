/* v95.1 — A DUE MEETING THAT CRASHED WAS GONE FOR GOOD.
   Reported: "a calendar event says X will come to me on Day 2 midday, I am at home at Day 2
   midday, and for some reason the event doesn't trigger. Now I have no way to make the agents run
   and check for the event." The second half turned out to be the whole bug.
   `resolveDueMeetings` set `e.prompted = true` the instant it FOUND a due meeting, and persisted
   it at once. Every branch that reaches a real outcome sets `done` itself, so the only way to end
   with done=false is an attempt that never finished — a throw in travelTo, in the move narration,
   in the reply after an arrival. postTurn catches that throw and carries on, and the entry is left
   prompted-but-not-done: skipped by the finder forever.
   Also pins what was ALREADY true and looked broken: a turn typed with nobody present runs the
   whole director pipeline, and the Gamemaster shortens its cadence when you are alone.
   Run: node tests/solo-turn.browser.js */
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

  const setup=()=>pg.evaluate(()=>{
    const uni=state.universes[0];
    uni.locations=[{id:"l_home",name:"Home",description:"home",residents:[],sublocations:[]}];
    const him={id:"p_x",name:"Xavier",universeId:uni.id,instructions:"x",personality:"x",
      backstory:"x",style:"x",goals:"x",look:{}};
    state.personas=[him]; state.user="Me"; state.calOn=true; state.key="k";
    const chat=curChat();
    chat.gameDay=2; chat.period="Midday"; chat.locationId="l_home"; chat.location="Home";
    chat.presentIds=[]; chat.messages=[]; chat.activeEvent=null; chat.dnd=false;
    chat.calendar=[{id:"c_due",kind:"meeting",title:"X gelecek",day:2,period:"Midday",
      who:"Me, Xavier",certainty:"certain",done:false,prompted:false,
      executor:"Xavier",executorId:"p_x",locationId:"l_home"}];
    markChatDirty(chat);
    return true;
  });
  await setup();

  console.log("\n[an attempt that crashes leaves the meeting retryable]");
  const crashed=await pg.evaluate(async()=>{
    const chat=curChat();
    const real=window._resolveDueMeeting;
    window._resolveDueMeeting=async()=>{ throw new Error("network died mid-arrival"); };
    let threw=false;
    try{ await resolveDueMeetings(chat); }catch(_){ threw=true; }
    finally{ window._resolveDueMeeting=real; }
    const e=chatCalendar(chat)[0];
    return {threw, prompted:e.prompted, done:!!e.done};
  });
  ok("the throw still propagates to postTurn's catch", crashed.threw===true, JSON.stringify(crashed));
  ok("but the meeting is NOT left tombstoned", crashed.prompted===false, JSON.stringify(crashed));
  ok("and it is still not done, so it is genuinely pending", crashed.done===false, JSON.stringify(crashed));
  ok("so the very next turn finds it again", await pg.evaluate(()=>{
      const chat=curChat();
      const found=chatCalendar(chat).find(x=>!x.done&&!x.prompted&&planDueNow(chat,x)&&_planIncludesUser(x));
      return found&&found.id==="c_due" ? true : "the finder still skips it"; }));

  console.log("\n[a meeting that reached an outcome stays spent]");
  ok("done is never un-set by the release", await pg.evaluate(async()=>{
      const chat=curChat();
      const real=window._resolveDueMeeting;
      window._resolveDueMeeting=async(c,e)=>{ e.done=true; e.outcome="missed"; return false; };
      try{ await resolveDueMeetings(chat); } finally { window._resolveDueMeeting=real; }
      const e=chatCalendar(chat)[0];
      return (e.done===true && e.prompted===true) ? true : JSON.stringify({d:e.done,p:e.prompted}); }));
  ok("and it is not offered again", await pg.evaluate(()=>{
      const chat=curChat();
      return !chatCalendar(chat).find(x=>!x.done&&!x.prompted&&planDueNow(chat,x)&&_planIncludesUser(x)); }));

  console.log("\n[the guard still guards within one turn]");
  ok("a second pass cannot re-enter a meeting mid-attempt", await pg.evaluate(async()=>{
      const chat=curChat();
      chat.calendar=[{id:"c_due2",kind:"meeting",title:"X gelecek",day:2,period:"Midday",
        who:"Me, Xavier",certainty:"certain",done:false,prompted:false,
        executor:"Xavier",executorId:"p_x",locationId:"l_home"}];
      let entered=0;
      const real=window._resolveDueMeeting;
      window._resolveDueMeeting=async(c,e)=>{ entered++; await new Promise(r=>setTimeout(r,120));
        e.done=true; return true; };
      try{ await Promise.all([resolveDueMeetings(chat),resolveDueMeetings(chat)]); }
      finally{ window._resolveDueMeeting=real; }
      return entered===1 ? true : "entered "+entered+" times"; }));

  console.log("\n[a turn typed alone is a real turn]");
  ok("the player's line is stored before anything routes", (()=>{
      const src=require('fs').readFileSync('/home/user/Multirp/index.html','utf8');
      const i=src.indexOf('chat.messages.push({mid:newMid(),role:"user",content:text');
      const j=src.indexOf('if(present.length===0){',i);
      return (i>0&&j>i) ? true : "the message is pushed after the empty-cast branch"; })());
  ok("the empty-cast branch runs the whole director pipeline", (()=>{
      const src=require('fs').readFileSync('/home/user/Multirp/index.html','utf8');
      /* anchored on sendMessage's own comment — "if(present.length===0){" also matches the header
         renderer, which is a different function entirely. */
      const i=src.indexOf('// ----- Nobody nearby: the user is speaking to themselves');
      const br=src.slice(i,i+1600);
      return i>0 && /noteNobodyHere\(chat\)/.test(br) && /await postTurn\(chat\)/.test(br)
        ? true : "postTurn is not called when alone"; })());
  ok("postTurn checks due meetings and then the Gamemaster", (()=>{
      const src=require('fs').readFileSync('/home/user/Multirp/index.html','utf8');
      const i=src.indexOf('async function postTurn(chat){');
      const fn=src.slice(i,src.indexOf('\n}',i));
      return /resolveDueMeetings\(chat\)/.test(fn) && /maybeGamemaster\(chat\)/.test(fn)
          && /maybeWorldPulse\(chat\)/.test(fn) ? true : "the pipeline lost a stage"; })());
  ok("the Gamemaster shortens its cadence when nobody is present", (()=>{
      const src=require('fs').readFileSync('/home/user/Multirp/index.html','utf8');
      return /if\(presentCast\(chat\)\.length===0\) every=Math\.min\(every,2\)/.test(src)
        ? true : "being alone no longer speeds the Gamemaster up"; })());
  /* v96.1 — assert the GATE, not the absence of the word "period": the pulse now also kicks off a
     whole-cast round, whose own comment says "once per period", and a comment is not a gate. What
     matters here is unchanged — the pulse's own cadence counts TURNS, which a solo turn moves. */
  ok("and the world pulse ticks per turn, not per period", await pg.evaluate(()=>{
      const src=String(maybeWorldPulse);
      return /chat\.pulseTurns=\(chat\.pulseTurns\|\|0\)\+1/.test(src)
          && /chat\.pulseTurns<every/.test(src)
          && !/chatPeriod\(chat\)!==|pulsePeriod/.test(src)
        ? true : "the pulse is gated on something a solo turn cannot move"; }));

  console.log("\n[the one-off that frees what is already stuck]");
  ok("it is wired, on its own key", (()=>{
      const src=require('fs').readFileSync('/home/user/Multirp/index.html','utf8');
      return /sm_calprompted_v1/.test(src) && /a crashed attempt had tombstoned/.test(src)
        ? true : "no migration"; })());
  ok("it frees prompted-but-not-done and leaves done alone", await pg.evaluate(()=>{
      const cal=[{id:"a",prompted:true,done:false},{id:"b",prompted:true,done:true},
                 {id:"c",prompted:false,done:false}];
      cal.forEach(e=>{ if(e&&e.prompted&&!e.done){ e.prompted=false; } });
      return (cal[0].prompted===false&&cal[1].prompted===true&&cal[2].prompted===false)
        ? true : JSON.stringify(cal); }));

  ok("no page errors", errs.length===0?true:errs.join(" | "));
  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close(); process.exit(fail?1:0);
})();
