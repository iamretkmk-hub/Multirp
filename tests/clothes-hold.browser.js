/* CLOTHES DO NOT CHANGE MID-SCENE (v150.96).
   Two ways the clothes changed between two lines of one scene:
     - the wearing tracker waited for a cue word, so an undressing in words the list did not know never
       reached it and the table's outfit stayed on record (the next picture put the clothes back on);
     - the clock following the lines (v150.53) turned the hour at home, and the home table's next slot
       re-dressed everyone mid-conversation.
   Run: node tests/clothes-hold.browser.js   (needs playwright; see tests/README.md) */
const {chromium}=require('playwright');
const BIN=process.env.SM_CHROME||process.env.CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
(async()=>{
  const b=await chromium.launch({executablePath:BIN});
  const pg=await b.newPage({viewport:{width:412,height:915}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file://'+require('path').resolve(__dirname,'..','index.html')); await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(900);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x||c).slice(0,420));} };

  await pg.evaluate(()=>{
    const uni=state.universes[0];
    uni.locations=[
      {id:"L_home",name:"Ozlem's House",residents:["o_oz"],sublocations:[{id:"s1",name:"Living room"},{id:"s_bed",name:"Bedroom"}]},
      {id:"L_user",name:"Emre's House",residents:[],sublocations:[{id:"s2",name:"Entrance"}]}
    ];
    uni.playerHomeLocId="L_user";
    if(!state.personas.some(p=>p.id==="o_oz")) state.personas.push({id:"o_oz",name:"Ozlem",universeId:uni.id,
      instructions:"",personality:"p",backstory:"b",style:"s",goals:"",traits:"",look:{raw:"tall"},wardrobe:"",
      outfits:{byLoc:{L_home:"You wear a cotton housedress."},
        home:{Morning:"You wear a pink housecoat.",Midday:"You wear a cotton housedress.",Afternoon:"You wear capri pants.",Evening:"You wear a soft grey knit.",Night:"You wear a cotton nightdress."}}});
    const c=curChat(); c.presentIds=["o_oz"]; state.user="Emre"; c.gameDay=2;
    c.locationId="L_home"; c.location="Ozlem's House"; c.subPos={__user__:"s1",o_oz:"s1"};
    c.period="Afternoon"; c.timeOfDay="Afternoon"; c.outfitHeld={}; c.wearing={};
  });
  const oz=()=>pg.evaluate(()=>currentOutfit(state.personas.find(x=>x.id==="o_oz"),curChat()));

  console.log("\n[the hour the lines move on is not a new scene]");
  ok("at home in the Afternoon she wears the Afternoon slot (and it is held)", await pg.evaluate(()=>{
      const f=currentOutfit(state.personas.find(x=>x.id==="o_oz"),curChat());
      return (f.text==="You wear capri pants."&&curChat().outfitHeld.o_oz&&curChat().outfitHeld.o_oz.text===f.text)?true:JSON.stringify(f); }));
  ok("the clock following the lines into the Evening keeps her in it", await pg.evaluate(()=>{
      const c=curChat(); c._clockMovedTurn=-99; const moved=_clockApply(c,0.95);
      const f=currentOutfit(state.personas.find(x=>x.id==="o_oz"),c);
      return (moved&&chatPeriod(c)==="Evening"&&f.text==="You wear capri pants."&&f.held&&c.outfitHeld.o_oz.per==="Evening")?true:JSON.stringify({moved,per:chatPeriod(c),f,h:c.outfitHeld.o_oz}); }));
  ok("but a real jump in time (not the lines) dresses her from the table again", await pg.evaluate(()=>{
      const c=curChat(); advanceTime(c,1);   // Evening → Night by a jump (Story mode's move on, by hand): no stamp for it
      const f=currentOutfit(state.personas.find(x=>x.id==="o_oz"),c);   // a guest is here, so Night keeps the Evening slot
      return (chatPeriod(c)==="Night"&&f.text==="You wear a soft grey knit.")?true:JSON.stringify({per:chatPeriod(c),f}); }));
  ok("a scene's own change survives the clock following the lines", await pg.evaluate(()=>{
      const c=curChat(); c.period="Afternoon"; c.timeOfDay="Afternoon"; c._clockMovedTurn=-99;
      setWearingOverride(c,"o_oz","only a silk slip");
      _clockApply(c,0.95);
      const f=currentOutfit(state.personas.find(x=>x.id==="o_oz"),c); setWearingOverride(c,"o_oz","");
      return f.text==="only a silk slip"?true:JSON.stringify(f); }));
  ok("_clockApply stamps the holds", /_outfitCarryClock\(chat\)/.test(await pg.evaluate(()=>_clockApply.toString())));

  console.log("\n[the wearing tracker reads every response, not only the ones with a cue word]");
  const W=await pg.evaluate(async()=>{
    const c=curChat(); c.period="Evening"; c.timeOfDay="Evening"; c.outfitHeld={}; c.wearing={}; delete c._wearSeenMid;
    const real=window.chatCompletion; let calls=0, sent="";
    window.chatCompletion=async(m,mo,o)=>{ if(/Wearing tracker/.test((o&&o.dbg)||"")){ calls++; sent=m.map(x=>x.content).join("\n");
        return JSON.stringify({changed:[{name:"Ozlem",wearing:"nothing — the grey knit is on the floor"}]}); } return ""; };
    const r={};
    try{
      c.messages.push({mid:newMid(),role:"user",content:"Come here."});
      c.messages.push({mid:newMid(),role:"assistant",speaker:"Ozlem",speakerId:"o_oz",content:"She lets the knit fall from her shoulders and steps closer."});
      r.cue=hasClothingCue(c);
      await runWearingTracker(c); r.c1=calls; r.sent=/lets the knit fall/.test(sent);
      r.after=currentOutfit(state.personas.find(x=>x.id==="o_oz"),c).text;
      await runWearingTracker(c); r.c2=calls;                    // nothing new said
      c.messages.push({mid:newMid(),role:"assistant",speaker:"Ozlem",speakerId:"o_oz",content:"\"Yavaş.\" She smiles."});
      await runWearingTracker(c); r.c3=calls;                    // a new line: read once
      state.wearCueGate=true;
      c.messages.push({mid:newMid(),role:"assistant",speaker:"Ozlem",speakerId:"o_oz",content:"She leans in."});
      await runWearingTracker(c); r.c4=calls;                    // the old cue gate, on request: no cue, no call
      state.wearCueGate=false;
    }finally{ window.chatCompletion=real; }
    return r; });
  ok("an undressing the cue list does not know (no cue word in the lines)", W.cue===false, JSON.stringify(W));
  ok("still reaches the tracker and is recorded", W.c1===1&&W.sent&&W.after==="nothing — the grey knit is on the floor", JSON.stringify(W));
  ok("a response already read never runs it twice", W.c2===1, JSON.stringify(W));
  ok("a new response is read once", W.c3===2, JSON.stringify(W));
  ok("state.wearCueGate keeps the old cue-gated behaviour for anyone who wants it", W.c4===2, JSON.stringify(W));
  ok("the editor hint says it runs after every response", await pg.evaluate(()=>/After every response/.test(X_ENGINE_PROMPTS.x_wearing_tracker.hint)));

  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close(); process.exit(fail?1:0);
})();
