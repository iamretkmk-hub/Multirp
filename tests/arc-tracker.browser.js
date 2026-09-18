/* v52.1 — THE ARC TRACKER CLOSES EARLY NOW, AND THE OLD PROMPT MUST NOT SURVIVE IN STORAGE.
   The tracker spent v21.3–v44 being told to keep one thread open across a whole scene. One arc is
   ONE memory, so that made a twenty-beat scene a few sentences with its middle missing — lost at
   write time, where no consolidator can reach it. The bias is inverted; fragments are fine because
   reconcilePeriodFor merges a period's memories afterwards.
   Two things are easy to get wrong and are what this pins: the shipped default must actually carry
   the new rule (and none of the old one's), and every stored copy of an older default must be
   refreshed at boot — a prompt is user-editable and lives in localStorage, so a new default alone
   changes nothing for an existing install. Plus the commit arithmetic the new prompt promises:
   closing early skips no message.
   Run: node tests/arc-tracker.browser.js */
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

  // ---- the shipped default says close, not hold
  const t=await pg.evaluate(()=>DEFAULT_MEMEVAL);
  ok("the golden rule is to close at the first resting point",
     /CLOSE AT THE FIRST RESTING POINT/.test(t)&&/your DEFAULT is to CLOSE/.test(t), t.slice(0,300));
  ok("none of the old keep-it-open wording is left",
     !/KEEP ARCS OPEN/.test(t)&&!/Anti-fragmentation/i.test(t)
     &&!/DEFAULT is always "ongoing"/.test(t), t.match(/KEEP ARCS OPEN|Anti-fragmentation|DEFAULT is always "ongoing"/g));
  ok("finished is the default and a landed beat is enough to earn it",
     /"finished" \(DEFAULT\)/.test(t)&&/A beat ending IS the arc ending/.test(t), "");
  ok("an intimate encounter is now beat by beat, not one thread",
     /beat by beat, not as one thread/.test(t)&&!/is ONE arc, not a new thread per beat/.test(t), "");
  ok("a continuous scene is many arcs",
     /is MANY arcs/.test(t)&&!/continuous scene in one place is ONE arc/.test(t), "");
  ok("the tie-break goes to different/finished",
     /ALWAYS choose "different" \/ "finished"/.test(t)&&!/ALWAYS choose "same" \/ "ongoing"/.test(t), "");
  ok("it still explains that closing loses nothing, and that the consolidator merges fragments",
     /NEVER drops a line and never skips one/.test(t)&&/consolidator/.test(t), "");
  ok("paused is restricted rather than removed",
     /"paused": RARE/.test(t)&&/never reach for "paused" as a way to avoid closing/.test(t), "");
  ok("both placeholders survive the rewrite",
     t.indexOf("{{open_event}}")>=0&&t.indexOf("{{exchange}}")>=0, "");
  ok("the JSON contract is unchanged",
     /"progress": "ongoing" \| "finished" \| "paused"/.test(t)&&/"topic": "same" \| "different"/.test(t)
     &&/"summary"/.test(t), "");
  ok("and the fingerprint later migrations match on is intact",
     t.indexOf("silent ARC TRACKER")>=0, "");

  // ---- a stored copy of EVERY older default is replaced at boot; a hand-written one is not
  const OLD_V21=`You are a silent ARC TRACKER for a roleplay.

## THE GOLDEN RULE — KEEP ARCS OPEN AND WHOLE
Your DEFAULT is always "ongoing" + "same".`;
  const OLD_V44=`You are a silent ARC TRACKER for a roleplay.

## THE GOLDEN RULE — KEEP ARCS OPEN AND WHOLE
- **A continuous physical or intimate encounter is ONE arc, not a new thread per beat.**`;
  const MINE=`I wrote this myself. Judge the arc: {{open_event}} / {{exchange}}. Return JSON.`;
  const stored=async v=>{ await pg.evaluate(t=>store.setRaw(K.memEval,t),v);
    await pg.reload(); await pg.waitForTimeout(2400); return pg.evaluate(()=>state.memEval); };
  ok("a stored v21-era prompt is refreshed to the new default",
     (await stored(OLD_V21))===t);
  ok("a stored v44-era prompt is refreshed too",
     (await stored(OLD_V44))===t);
  ok("a prompt the user wrote themselves is left exactly as it is",
     (await stored(MINE))===MINE);
  ok("the new default is not itself flagged as a stale refresh pipe",
     await pg.evaluate(()=>!(window.__stalePipes||[]).some(s=>/^memEval/.test(s))),
     await pg.evaluate(()=>(window.__stalePipes||[]).join(" | ")));

  // ---- the arithmetic the prompt promises: closing early skips no message
  await pg.evaluate(()=>store.setRaw(K.memEval,DEFAULT_MEMEVAL));
  await pg.reload(); await pg.waitForTimeout(2400);
  const cover=await pg.evaluate(async()=>{
    // Drive maybeBuildMemory with a scripted tracker verdict per turn and record which message
    // range each commit covered. No network: memEval and the builder are both stubbed.
    const verdicts=[]; const commits=[];
    const realChat=window.chatCompletion, realCommit=window.commitMemoryArc;
    window.chatCompletion=async()=>JSON.stringify(verdicts.shift()||{progress:"ongoing",topic:"same",summary:"x"});
    window.commitMemoryArc=async(chat,a,z)=>{ commits.push([a,z]); };
    const chat={messages:[],memEvent:null,memDoneIdx:-1,gameDay:1};
    const push=(role,c)=>chat.messages.push({role,content:c,speaker:role==='user'?null:"Nil"});
    const step=async v=>{ verdicts.push(v); push('user',"line"); push('assistant',"reply"); await maybeBuildMemory(chat); };
    try{
      state.mem=true; state.key="k"; state.autoCharOn=false; state.condenseOn=false;
      await step({progress:"finished",topic:"same",summary:"a"});      // closes at once
      await step({progress:"ongoing",topic:"same",summary:"b"});
      await step({progress:"finished",topic:"same",summary:"b"});      // closes after two turns
      await step({progress:"ongoing",topic:"different",summary:"c"});  // splits
      await step({progress:"finished",topic:"same",summary:"c"});
    }finally{ window.chatCompletion=realChat; window.commitMemoryArc=realCommit; }
    return {commits,total:chat.messages.length,done:chat.memDoneIdx};
  });
  {const c=cover.commits;
   ok("every close committed a real span", c.length>=4&&c.every(([a,z])=>z>=a), JSON.stringify(c));
   // sorted by start, the spans must tile [0..n] with no gap and no overlap
   const sorted=c.slice().sort((x,y)=>x[0]-y[0]);
   let nextExpected=0, gap=null, overlap=null;
   for(const [a,z] of sorted){ if(a>nextExpected)gap=[nextExpected,a]; if(a<nextExpected)overlap=[a,nextExpected]; nextExpected=Math.max(nextExpected,z+1); }
   ok("closing early leaves NO message uncovered", gap===null, "gap at "+JSON.stringify(gap)+" in "+JSON.stringify(sorted));
   ok("and no message is cut into two memories", overlap===null, "overlap at "+JSON.stringify(overlap)+" in "+JSON.stringify(sorted));
   ok("the committed spans reach the end of the transcript",
      nextExpected===cover.total, nextExpected+" of "+cover.total+" — "+JSON.stringify(sorted));}

  // ---- the two backstops: a tracker that never closes, and one parked on "paused"
  const valve=await pg.evaluate(async(verdict)=>{
    const commits=[]; const realChat=window.chatCompletion, realCommit=window.commitMemoryArc;
    window.chatCompletion=async()=>JSON.stringify(verdict);
    window.commitMemoryArc=async(chat,a,z)=>{ commits.push([a,z]); };
    const chat={messages:[],memEvent:null,memDoneIdx:-1,gameDay:1};
    try{
      state.mem=true; state.key="k"; state.autoCharOn=false; state.condenseOn=false;
      for(let i=0;i<20;i++){
        chat.messages.push({role:'user',content:"line"},{role:'assistant',content:"reply",speaker:"Nil"});
        await maybeBuildMemory(chat);
      }
    }finally{ window.chatCompletion=realChat; window.commitMemoryArc=realCommit; }
    const longest=commits.reduce((m,[a,z])=>Math.max(m,z-a+1),0);
    return {commits,longest,total:chat.messages.length};
  },{progress:"ongoing",topic:"same",summary:"x"});
  const cap=await pg.evaluate(()=>MEM_ARC_CAP);
  ok("the cap is low enough to catch a failure before the memory is over-compressed",
     cap<=12, "MEM_ARC_CAP="+cap);
  ok("a tracker that never closes still commits, bounded by the cap",
     valve.commits.length>=3&&valve.longest<=cap, "longest "+valve.longest+" of cap "+cap+" in "+JSON.stringify(valve.commits));

  const paused=await pg.evaluate(async()=>{
    const commits=[]; const realChat=window.chatCompletion, realCommit=window.commitMemoryArc;
    window.chatCompletion=async()=>JSON.stringify({progress:"paused",topic:"same",summary:"held"});
    window.commitMemoryArc=async(chat,a,z)=>{ commits.push([a,z]); };
    const chat={messages:[],memEvent:null,memDoneIdx:-1,gameDay:1};
    try{
      state.mem=true; state.key="k"; state.autoCharOn=false; state.condenseOn=false;
      for(let i=0;i<20;i++){
        chat.messages.push({role:'user',content:"line"},{role:'assistant',content:"reply",speaker:"Nil"});
        await maybeBuildMemory(chat);
      }
    }finally{ window.chatCompletion=realChat; window.commitMemoryArc=realCommit; }
    return {commits,longest:commits.reduce((m,[a,z])=>Math.max(m,z-a+1),0),total:chat.messages.length};
  });
  ok("a tracker parked on \"paused\" no longer grows an arc without limit",
     paused.commits.length>=3&&paused.longest<=cap,
     "longest "+paused.longest+" of cap "+cap+" over "+paused.total+" messages: "+JSON.stringify(paused.commits));
  {const sorted=paused.commits.slice().sort((x,y)=>x[0]-y[0]);
   let next=0, bad=null;
   for(const [a,z] of sorted){ if(a!==next)bad=[next,a]; next=Math.max(next,z+1); }
   ok("and the valve's own spans still tile the transcript", bad===null, "break at "+JSON.stringify(bad)+" in "+JSON.stringify(sorted));}

  /* v68.1 — THE MEMORY WENT TO WHOEVER WAS STILL STANDING THERE. commitMemoryArc filtered the
     cast by presentIds(chat) — presence as of the instant of the commit — so a character who had
     just walked out was not eligible for the memory of the scene they had just lived. Leaving is
     not an edge case here: "she says she has to get home and goes" is precisely the beat that
     makes the tracker answer "finished", so the departure and the commit fire on the same turn
     every time, and the departure lands first. The tracker said finished, the debug log showed it,
     and nothing was written — the last memory of every visit, lost. */
  console.log("\n[the memory goes to whoever LIVED the arc]");
  {
    const setup=()=>pg.evaluate(()=>{
      state.key="k"; state.mem=true; state.memMinImp=0;
      /* Unique content per call on purpose: commitMemoryArc refuses a memory whose text this
         character already holds, so a stub that answers the same thing twice makes the SECOND
         case look like a failure to build when it was a successful de-duplication. */
      window.__n=0;
      window.fetch=async()=>({ok:true,status:200,
        json:async()=>({choices:[{message:{content:JSON.stringify({content:"a memory "+(++window.__n),
          location:"here",people:["P"],emotion:"tense",importance_score:0.9})}}]}),
        text:async()=>"x"});
      const u=(state.universes||[])[0];
      if(!(state.personas||[]).some(x=>x&&x.id==="c_gone"))
        (state.personas=state.personas||[]).push({id:"c_gone",name:"Gone",universeId:u.id});
      window.__mkChat=(presentNow,stamps)=>{
        const mk=(role,sid,t,pres)=>({role,speaker:role==='user'?state.user:"Gone",speakerId:sid,
                                      content:t,present:pres});
        return {id:"c"+Math.random(),universeId:u.id,gameDay:1,location:"Room",rel:{},
          presentIds:presentNow,
          messages:[mk('user',null,"hi",stamps[0]),mk('assistant',"c_gone","hello",stamps[1]),
                    mk('user',null,"stay?",stamps[2]),mk('assistant',"c_gone","I must go.",stamps[3])]};
      };
      return true;
    });
    await setup();
    const run=(presentNow,stamps)=>pg.evaluate(async o=>{
      const c=window.__mkChat(o.p,o.s);
      const before=(state.memory||[]).length;
      await commitMemoryArc(c,0,3,1,"Evening");
      return (state.memory||[]).length-before;
    },{p:presentNow,s:stamps});
    const ALL=["c_gone"];
    ok("still there → a memory", await run(ALL,[ALL,ALL,ALL,ALL])===1);
    ok("walked out one beat before the tracker closed it → still a memory",
       await run([],[ALL,ALL,ALL,ALL])===1);
    ok("there for only the first half → a memory of the half they lived",
       await run([],[ALL,ALL,[],[]])===1);
    ok("never in the span at all → no memory invented for them",
       await run([],[[],[],[],[]])===0);
    ok("the commit does not read presence-now as the cast", (()=>{
        const src=require('fs').readFileSync('/home/user/Multirp/index.html','utf8');
        return /const memCast=cast\.filter\(p=>p&&\(spanPresent\.has\(p\.id\)\|\|p\.temp\)\)/.test(src)
          ? true : "commitMemoryArc still filters on presentIds alone"; })());
  }

  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log("\n  "+pass+" passed, "+fail+" failed");
  await b.close();
  process.exit(fail?1:0);
})();
