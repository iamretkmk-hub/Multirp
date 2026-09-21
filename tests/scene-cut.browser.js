/* v98.1 — DROP ME INTO A SCENE.
   A cut, not an arrival: the player and one character are put somewhere plausible with the
   conversation ALREADY RUNNING — no hello, no walking in, no explaining how either got there.
   WHO it is with is scored in code, from the three things the request named: somebody who has been
   left out, somebody not seen for a while, somebody with an actual reason to meet. A model would
   pick whoever is most fun to write, which is how the same two people end up in every scene.
   Run: node tests/scene-cut.browser.js */
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage({viewport:{width:412,height:915}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file://'+require('path').resolve(__dirname,'..','index.html'));
  await pg.waitForTimeout(2600);
  await pg.evaluate(()=>{ try{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); }catch(e){} });
  await pg.waitForTimeout(800);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x||c).slice(0,700));} };

  const setup=()=>pg.evaluate(()=>{
    const uni=state.universes[0];
    uni.locations=[{id:"l_cafe",name:"Coffee House",description:"c",residents:[],sublocations:[{id:"s_in",name:"Inside"}]},
                   {id:"l_gym",name:"Gym",description:"g",residents:[],sublocations:[{id:"s_g",name:"Floor"}]},
                   {id:"l_home",name:"My House",description:"h",residents:[],sublocations:[{id:"s_h",name:"Hall"}]}];
    const mk=(id,n)=>({id,name:n,universeId:uni.id,instructions:"x",personality:"x",
      backstory:"x",style:"x",goals:"x",look:{}});
    state.personas=[mk("p_near","Yakin"),mk("p_far","Uzak"),mk("p_owed","Sozlu")];
    state.user="Emre"; state.key="k";
    const chat=curChat();
    chat.gameDay=6; chat.period="Afternoon"; chat.presentIds=[]; chat.locationId="l_home";
    chat.location="My House"; chat.subId="s_h"; chat.messages=[]; chat.calendar=[]; chat.promises=[];
    chat.dayLog=null; chat.intents=[]; chat.rel={};
    chat.worldPositions={p_near:"l_cafe",p_far:"l_gym",p_owed:"l_cafe"};
    // Yakin was with the player earlier today; Uzak has never been met; Sozlu is owed a word.
    noteWhereabouts(chat,["p_near","__user__"],{placeId:"l_home"});
    chat.messages.push({mid:newMid(),role:"assistant",speaker:"Yakin",speakerId:"p_near",
      content:"Buradayim.",present:["p_near"],status:{day:6,period:"Morning",location:"My House"}});
    recordPromise(chat,{holder:"Sozlu",to:"Emre",promise:"you will bring the money on Friday",
      kind:"promise",shows_as:"the next time they are both at the cafe"},6);
    return true;
  });
  await setup();

  console.log("\n[who it picks, and why]");
  const ranked=await pg.evaluate(()=>cutCandidates(curChat()).map(x=>({n:x.p.name,sc:x.sc,why:x.why})));
  ok("somebody already with the player today is pushed down",
     ranked[ranked.length-1].n==="Yakin", JSON.stringify(ranked));
  ok("and the reason is recorded",
     ranked.find(x=>x.n==="Yakin").why.join().indexOf("already with them today")>=0, JSON.stringify(ranked));
  ok("never having been met at all scores",
     ranked.find(x=>x.n==="Uzak").why.join().indexOf("never met on screen")>=0, JSON.stringify(ranked));
  ok("a word between them scores",
     ranked.find(x=>x.n==="Sozlu").why.join().indexOf("a word between them")>=0, JSON.stringify(ranked));
  ok("both outrank the one just seen",
     ranked.find(x=>x.n==="Uzak").sc>ranked.find(x=>x.n==="Yakin").sc
  && ranked.find(x=>x.n==="Sozlu").sc>ranked.find(x=>x.n==="Yakin").sc, JSON.stringify(ranked));
  ok("anybody already in the scene is not a candidate at all", await pg.evaluate(()=>{
      const chat=curChat(); chat.presentIds=["p_far"];
      const r=cutCandidates(chat).map(x=>x.p.id); chat.presentIds=[];
      return r.indexOf("p_far")<0 ? true : JSON.stringify(r); }));
  ok("and so is anybody a due plan already owns", await pg.evaluate(()=>{
      const chat=curChat();
      chat.calendar.push({id:"due",kind:"meeting",title:"x",who:"Uzak",day:6,period:"Afternoon",done:false});
      const r=cutCandidates(chat).map(x=>x.p.id);
      chat.calendar=chat.calendar.filter(e=>e.id!=="due");
      return r.indexOf("p_far")<0 ? true : JSON.stringify(r); }));

  console.log("\n[the cut itself]");
  const cut=await pg.evaluate(async()=>{
    const chat=curChat();
    let sent=null;
    const real=window.chatCompletion;
    window.chatCompletion=async(msgs)=>{ sent=msgs;
      return JSON.stringify({place:"Coffee House",
        narration:"Kahveler yarilanmis, masada iki bardak duruyor. Uzun zamandir konusmadiklari icin konu doner dolasir gecen haftaya geliyor.",
        line:'"Yani sen de biliyordun da bana soylemedin, oyle mi?"'}); };
    let okd=false;
    try{ okd=await runSceneCut(chat); } finally { window.chatCompletion=real; }
    const last=chat.messages.slice(-2);
    return {okd, loc:chat.location, present:chat.presentIds.slice(),
      narr:last[0], line:last[1],
      prompt:String((sent||[]).map(m=>m.content||"").join("\n")),
      where:whereaboutsToday(chat,chat.presentIds[0])};
  });
  ok("it opens", cut.okd===true, JSON.stringify(cut.okd));
  ok("the player is moved to the place the scene chose", cut.loc==="Coffee House", cut.loc);
  ok("the character is present", cut.present.length===1, JSON.stringify(cut.present));
  ok("the narration lands as a narrator beat, not a presence note",
     cut.narr&&cut.narr.narratorEvent===true&&!cut.narr.presenceNote, JSON.stringify(cut.narr&&cut.narr.speaker));
  ok("nobody is narrated as arriving",
     !/presenceNote/.test(JSON.stringify(cut.narr))&&!/girdi|arrived|geldi/i.test(cut.narr.content), cut.narr.content);
  ok("the character's line is posted as theirs",
     cut.line&&cut.line.role==="assistant"&&cut.line.speakerId&&/soylemedin/.test(cut.line.content),
     JSON.stringify(cut.line&&cut.line.content));
  ok("and the day ledger records that they were together",
     (cut.where||[]).some(r=>(r.with||[]).indexOf("Emre")>=0), JSON.stringify(cut.where));

  console.log("\n[what the model was actually handed]");
  const P=cut.prompt;
  ok("the character's tie and settled view", /WHAT THEY ARE TO Emre/.test(P)&&/HOW .* HAS COME TO SEE Emre/.test(P), P.slice(0,200));
  ok("when the two were last in a room", /THE LAST TIME THESE TWO WERE IN A ROOM/.test(P));
  ok("everything live between them", /WHAT IS ACTUALLY LIVE BETWEEN THEM/.test(P));
  ok("what they remember of the player", /WHAT .* REMEMBERS OF Emre/.test(P));
  ok("their day so far", /'S DAY SO FAR/.test(P));
  ok("where each of them is, and the places that exist",
     /WHERE .* ACTUALLY IS RIGHT NOW/.test(P)&&/PLACES THAT EXIST/.test(P));

  console.log("\n[the prompt refuses to be interesting for its own sake]");
  ok("no greeting, no arrival, no explaining how it started", await pg.evaluate(()=>{
      const t=up("sceneCut")||"";
      return /does NOT say hello, does not have anyone arrive, sit down, order, or greet/.test(t)
          && /does not explain how the conversation started/.test(t) ? true : "the no-hello rule is missing"; }));
  ok("the line is from the middle of a conversation", await pg.evaluate(()=>{
      const t=up("sceneCut")||"";
      return /Never a greeting, never an opener/.test(t) && /from the MIDDLE of a conversation/.test(t)
        ? true : "the line can still be an opener"; }));
  ok("the subject must come from the material", await pg.evaluate(()=>{
      const t=up("sceneCut")||"";
      return /Take the subject from the material above/.test(t) ? true : "the subject is free-invented"; }));
  ok("and nothing in particular is explicitly allowed", await pg.evaluate(()=>{
      const t=up("sceneCut")||"";
      return /that is FINE/.test(t) && /An ordinary opening is better than an invented crisis/.test(t)
        ? true : "small talk is not licensed"; }));
  ok("invention is closed", await pg.evaluate(()=>{
      const t=up("sceneCut")||"";
      return /Do NOT invent an event, a revelation, a confession, an accident/.test(t) ? true : "it may invent"; }));
  ok("and nothing resolves in a doorway", await pg.evaluate(()=>{
      const t=up("sceneCut")||"";
      return /nothing is decided here, nothing comes to a head/.test(t)
          && /the charge is UNDER the talk, not in it/.test(t) ? true : "it can spend the scene"; }));
  ok("the place must be one that exists", await pg.evaluate(()=>{
      const t=up("sceneCut")||"";
      return /never a place not on the list/.test(t) ? true : "it can invent a venue"; }));

  console.log("\n[the button]");
  ok("it is in the map hub bar", (()=>{
      const src=require('fs').readFileSync('/home/user/Multirp/index.html','utf8');
      return /id="mapCutBtn" onclick="sceneCutFromMenu\(this\)/.test(src) ? true : "no button"; })());
  ok("a second tap cannot open two scenes at once", (()=>{
      const src=require('fs').readFileSync('/home/user/Multirp/index.html','utf8');
      const i=src.indexOf('async function sceneCutFromMenu');
      const fn=src.slice(i,src.indexOf('\n}\n',i));
      return /if\(btn&&btn\.disabled\)return;/.test(fn) && /btn\.disabled=true/.test(fn)
        ? true : "the button is re-entrant"; })());
  ok("a failure leaves the map open", (()=>{
      const src=require('fs').readFileSync('/home/user/Multirp/index.html','utf8');
      const i=src.indexOf('async function sceneCutFromMenu');
      const fn=src.slice(i,src.indexOf('\n}\n',i));
      return /if\(okd\)\{ try\{ _mapClose\(\)/.test(fn) ? true : "it closes even when nothing opened"; })());
  ok("the engine has its own Settings card", await pg.evaluate(()=>
      (ENGINE_PAYLOAD_DEFS||[]).some(d=>d&&d.key==="scene_cut") ));

  console.log("\n[a request that never answers cannot hang for ever]");
  ok("a stalled fetch is aborted and reported AS a timeout", await pg.evaluate(async()=>{
      state.key="k";
      const real=window.fetch;
      window.fetch=(u,o)=>new Promise((res,rej)=>{ if(o&&o.signal)o.signal.addEventListener("abort",()=>{
        const e=new Error("aborted"); e.name="AbortError"; rej(e); }); });
      let msg="";
      try{ await chatCompletion([{role:"user",content:"x"}],"m",{timeoutMs:5000,retries:0,dbg:"t"}); }
      catch(e){ msg=(e&&e.friendly)||String(e); } finally{ window.fetch=real; }
      return /did not answer within 5 seconds/.test(msg) ? true : msg; }));
  ok("and the debug row says so, with a duration instead of a null", await pg.evaluate(()=>{
      const e=dbgLog.slice(-1)[0];
      return (e&&e.status==="error"&&e.ms>0&&/Timed out after 5s/.test(e.result))
        ? true : JSON.stringify(e&&{s:e.status,ms:e.ms,r:e.result}); }));
  ok("a timeout is told apart from a network error", await pg.evaluate(async()=>{
      const real=window.fetch;
      window.fetch=async()=>{ throw new Error("dns"); };
      let msg=""; try{ await chatCompletion([{role:"user",content:"x"}],"m",{retries:0,dbg:"n"}); }
      catch(e){ msg=(e&&e.friendly)||String(e); } finally{ window.fetch=real; }
      return /Can't reach the internet/.test(msg) ? true : msg; }));
  ok("a good response is untouched", await pg.evaluate(async()=>{
      const real=window.fetch;
      window.fetch=async()=>({ok:true,status:200,json:async()=>({choices:[{message:{content:"hi"}}]})});
      let out=""; try{ out=await chatCompletion([{role:"user",content:"x"}],"m",{retries:0,dbg:"g"}); }
      finally{ window.fetch=real; }
      return out==="hi" ? true : JSON.stringify(out); }));
  ok("an HTTP error still reports its status", await pg.evaluate(async()=>{
      const real=window.fetch;
      window.fetch=async()=>({ok:false,status:401,json:async()=>({})});
      try{ await chatCompletion([{role:"user",content:"x"}],"m",{retries:0,dbg:"h"}); }
      catch(e){} finally{ window.fetch=real; }
      return dbgLog.slice(-1)[0].result==="HTTP 401"; }));
  ok("the ceiling is generous by default, tight where it blocks the UI", (()=>{
      const src=require('fs').readFileSync('/home/user/Multirp/index.html','utf8');
      return /opts\.timeoutMs!=null\)\?opts\.timeoutMs:180000/.test(src)
          && /timeoutMs:75000,retries:1,dbg:"Drop me into a scene/.test(src)
        ? true : "the ceilings are not set"; })());

  console.log("\n[the cut says what actually went wrong]");
  ok("a failing call surfaces its reason instead of swallowing it", await pg.evaluate(async()=>{
      const chat=curChat();
      const real=window.chatCompletion; const toasts=[]; const rt=window.toast;
      window.toast=t=>toasts.push(String(t));
      window.chatCompletion=async()=>{ throw {friendly:"API key invalid or unauthorized. Check Settings."}; };
      try{ await runSceneCut(chat); } finally { window.chatCompletion=real; window.toast=rt; }
      return toasts.some(t=>/API key invalid/.test(t)) ? true : JSON.stringify(toasts); }));
  ok("an unparseable answer is named as that, not as silence", await pg.evaluate(async()=>{
      const chat=curChat();
      const real=window.chatCompletion; const toasts=[]; const rt=window.toast;
      window.toast=t=>toasts.push(String(t));
      window.chatCompletion=async()=>"I'm sorry, I can't help with that.";
      try{ await runSceneCut(chat); } finally { window.chatCompletion=real; window.toast=rt; }
      return toasts.some(t=>/answered but not in the shape/.test(t)) ? true : JSON.stringify(toasts); }));
  ok("an empty answer is named as that", await pg.evaluate(async()=>{
      const chat=curChat();
      const real=window.chatCompletion; const toasts=[]; const rt=window.toast;
      window.toast=t=>toasts.push(String(t));
      window.chatCompletion=async()=>"";
      try{ await runSceneCut(chat); } finally { window.chatCompletion=real; window.toast=rt; }
      return toasts.some(t=>/returned nothing at all/.test(t)) ? true : JSON.stringify(toasts); }));

  ok("no page errors", errs.length===0?true:errs.join(" | "));
  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close(); process.exit(fail?1:0);
})();
