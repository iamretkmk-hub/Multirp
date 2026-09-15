/* v44.3 — "There is no duplicate card. When I check a location's setting page I see a Nil
   character. That is not visible in universe cards, and when I generate relationships characters
   create a relationship for that Nil persona as well. So it is living somewhere I don't see."

   Nil is a LATENT NPC — minted as an inhabitant of a place on first visit and, per isActiveChar,
   "hidden from ALL play until /seek reveals them". The Characters screen honoured that. Four other
   readers did not, each with its own idea of who the cast is.

   Also covers the reconciler being told WHICH day and part of the day it is condensing — the
   fragments carry gameDay/gamePeriod, and none of it reached the model. */
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file:///home/user/Multirp/index.html'); await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(900);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x||c).slice(0,400));} };

  const S=await pg.evaluate(()=>{
    const uni=state.universes[0];
    const mk=(id,name,extra)=>{ let p=state.personas.find(x=>x&&x.id===id);
      if(!p){ p={id,name,universeId:uni.id,instructions:"x",personality:"x",backstory:"x",
                 style:"x",goals:"x",look:{}}; state.personas.push(p); }
      p.name=name; delete p.latent; delete p.removed; Object.assign(p,extra||{}); return p; };
    const emre=mk("p_emre","Emre");
    const nil =mk("p_nil","Nil",{latent:true});          // undiscovered — bound to the house
    const gone=mk("p_gone","Kerem",{removed:true});      // out of play, card kept
    const home={id:"loc_home",name:"Emre's Home",type:"home",
                residents:[emre.id,nil.id,gone.id],sublocations:[]};
    uni.locations=[home];
    const chat=curChat(); chat.universeId=uni.id; chat.locationId=home.id;
    chat.location=home.name; chat.presentIds=[emre.id];
    return {uni:uni.id,home:home.id};
  });

  console.log("\n[an undiscovered character is not on the Characters screen — the rule everything else missed]");
  ok("the universe grid hides them", await pg.evaluate(()=>{
      const shown=personasInUniverse(state.universes[0].id).filter(p=>!p.latent).map(p=>p.name);
      return shown.indexOf("Nil")===-1 && shown.indexOf("Emre")>-1 ? true : JSON.stringify(shown); }));
  ok("and isActiveChar is the reason why", await pg.evaluate(()=>
      isActiveChar(state.personas.find(p=>p.id==="p_nil"))===false
      && isActiveChar(state.personas.find(p=>p.id==="p_emre"))===true));

  console.log("\n[the location's residents]");
  const R=await pg.evaluate(()=>residentsOf(locById("loc_home")).map(p=>p.name));
  ok("the undiscovered inhabitant is not listed", R.indexOf("Nil")===-1, JSON.stringify(R));
  ok("a removed one is not either", R.indexOf("Kerem")===-1, JSON.stringify(R));
  ok("the real resident still is", R.indexOf("Emre")>-1, JSON.stringify(R));
  ok("and /seek can still find them — the reveal path reads loc.residents, not this", await pg.evaluate(()=>{
      const here=_latentNpcsHere(curChat()).map(p=>p.name);
      return here.indexOf("Nil")>-1 ? true : "reveal can no longer see them: "+JSON.stringify(here); }));

  console.log("\n[the relationship generator]");
  ok("it never offers an undiscovered character to write a tie toward", await pg.evaluate(()=>{
      const src=String(generateRelationshipsFor);
      return /universeId===uni\.id&&isActiveChar\(p\)/.test(src)
        ? true : "generateRelationshipsFor still takes the whole universe"; }));
  ok("a tie already stored toward one stays out of the payload", await pg.evaluate(()=>{
      const p=state.personas.find(x=>x.id==="p_emre");
      p.relationships={ p_nil:{tie:"neighbour",relationship:"I have known her for years."},
                        p_gone:{tie:"cousin",relationship:"We grew up together."},
                        __user__:{tie:"friend",relationship:"I trust him."} };
      const sheets=[relSheetBlock(p)||"", relSheetBlockFull(p,{everyone:true})||""].join("\n");
      delete p.relationships;
      return (sheets.indexOf("Nil")===-1 && sheets.indexOf("Kerem")===-1)
        ? true : sheets.slice(0,300); }));
  ok("but the stored tie is only skipped, never deleted — revealing restores it", await pg.evaluate(()=>{
      const p=state.personas.find(x=>x.id==="p_emre");
      p.relationships={ p_nil:{tie:"neighbour",relationship:"I have known her for years."} };
      relSheetBlock(p);
      const kept=!!(p.relationships&&p.relationships.p_nil);
      const nil=state.personas.find(x=>x.id==="p_nil");
      nil.latent=false;
      const shown=(relSheetBlock(p)||"").indexOf("Nil")>-1;
      nil.latent=true; delete p.relationships;
      return kept&&shown ? true : "kept="+kept+" shownAfterReveal="+shown; }));

  console.log("\n[the payload's own cast list]");
  ok("{{cast_all}} does not name an undiscovered character", await pg.evaluate(()=>{
      const lib=engineLibrary(curChat())||{};
      const v=typeof lib.cast_all==="function"?lib.cast_all():lib.cast_all;
      return (String(v).indexOf("Nil")===-1 && String(v).indexOf("Emre")>-1)
        ? true : "cast_all = "+v; }));

  console.log("\n[the reconciler is told which day and which part of it]");
  ok("the WHEN line is built from the fragments' own stamp", await pg.evaluate(()=>{
      const src=String(reconcilePeriodFor);
      return /WHEN: Day \$\{day\}, \$\{period\}/.test(src)
        ? true : "reconcilePeriodFor still says only \"one part of one day\""; }));
  const W=await pg.evaluate(async()=>{
    const uni=state.universes[0];
    state.memory=(state.memory||[]).filter(m=>m.ownerId!=="p_emre");
    for(let i=0;i<3;i++) state.memory.push({id:"rm"+i,content:"Fragment "+i+" of the morning.",
      location:"Emre's Home",emotion:"calm",importance:0.4,tags:["ev"],type:"EXPERIENCE",
      ownerId:"p_emre",character:"Emre",date:Date.now()+i,gameDay:7,gamePeriod:"Morning",
      source:"auto",universeId:uni.id,chatId:state.curChat});
    state.mem=true; state.key="k";
    let sent="";
    window.chatCompletion=async(messages)=>{ sent=JSON.stringify(messages);
      return '{"memories":[{"content":"Day 7, Morning. It was a quiet morning at home.","importance":0.5,"emotion":"calm","people":["Emre"],"tags":["ev"],"location":"Emre\'s Home"}]}'; };
    await reconcilePeriodFor(state.personas.find(p=>p.id==="p_emre"),7,"Morning");
    const made=memoriesOf("p_emre").filter(m=>m.source==="reconciled");
    return {sawDay:/Day 7/.test(sent), sawPeriod:/Morning/.test(sent),
            made:made.length, stamp:made[0]?(made[0].gameDay+" "+made[0].gamePeriod):"",
            left:memoriesOf("p_emre").length};
  });
  ok("the model is handed the day", W.sawDay===true, JSON.stringify(W));
  ok("and the part of the day", W.sawPeriod===true, JSON.stringify(W));
  ok("the fragments are replaced by the one memory", W.made===1&&W.left===1, JSON.stringify(W));
  ok("which keeps the stamp it was reconciled for", W.stamp==="7 Morning", W.stamp);

  ok("no page errors", errs.length===0?true:errs.join(" | "));
  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close(); process.exit(fail?1:0);
})();
