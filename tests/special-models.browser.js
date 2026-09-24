/* v125.1 — THE SPECIAL-PURPOSE IMAGE MODELS.
   Reported: Settings › Image › Special-purpose image models "are not working — it always uses the
   main model". Every entry point handed its model over as rule.model_id; ModelsLab and fal.ai read
   it, but atlasImage always took the main image model, so on AtlasCloud all four fields were dead.
   This drives each entry point with the AtlasCloud call stubbed, and checks the model it sent.
   Run: node tests/special-models.browser.js */
const {chromium}=require('playwright');
const path=require('path');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage({viewport:{width:412,height:915}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file://'+path.resolve(__dirname,'..','index.html')); await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(800);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x||c).slice(0,500));} };

  await pg.evaluate(()=>{
    state.imgProvider="atlascloud"; state.atlasKey="k";
    state.imgModel="MAIN/text-to-image";
    state.locModel="LOC/text-to-image"; state.portraitModel="PORTRAIT/text-to-image";
    state.mapImgModel="MAP/text-to-image"; state.uniPicModel="UNI/text-to-image";
    window.__sent=[];
    window.atlasGenerate=async(kind,body)=>{ window.__sent.push(body); return "https://example.com/x.png"; };
    window.__pick=null; window.pickRule=async()=>window.__pick;   // no router call; a rule on demand
  });
  const last=()=>pg.evaluate(()=>{ const s=window.__sent[window.__sent.length-1]; return s?{model:s.model,size:s.size}:null; });

  console.log("\n[each special-purpose field reaches AtlasCloud]");
  for(const withRule of [false,true]){
    const tag=withRule?" (a scene rule matched)":" (no rule)";
    await pg.evaluate(w=>{ window.__pick=w?{id:"r_establishing",label:"Establishing"}:null; },withRule);
    await pg.evaluate(()=>generateLocationImage({id:"l1",name:"Harbour",description:"A harbour"}));
    ok("location images use their own model"+tag, (await last()).model==="LOC/text-to-image", JSON.stringify(await last()));
    await pg.evaluate(()=>generateSubImage({id:"l1",name:"Harbour"},{id:"s1",name:"Pier"}));
    ok("a location's areas do too"+tag, (await last()).model==="LOC/text-to-image", JSON.stringify(await last()));
    await pg.evaluate(()=>generatePicForLook("short black hair"));
    ok("portraits use theirs"+tag, (await last()).model==="PORTRAIT/text-to-image", JSON.stringify(await last()));
  }
  await pg.evaluate(()=>{ window.__pick=null; });

  ok("the universe picture uses its model, in a landscape frame", await pg.evaluate(async()=>{
      show('personas'); try{ openUniverse(state.universes[0].id); }catch(e){}
      const ta=document.getElementById('uvImgPrompt'); if(!ta)return "no universe picture prompt on screen";
      ta.value="a harbour town at dusk"; await generateUniversePic();
      const s=window.__sent[window.__sent.length-1];
      return s&&s.model==="UNI/text-to-image"&&/^1\d{3}\*5\d\d$|^1024x576$|^1\d{3}x5\d\d$/.test(String(s.size).replace("*","x"))
        ? true : JSON.stringify(s&&{model:s.model,size:s.size}); }));
  ok("the world map uses the global map model", await pg.evaluate(async()=>{
      const chat=curChat(); const u=universeById(chat.universeId)||state.universes[0]; chat.universeId=u.id;
      u.locations=u.locations&&u.locations.length?u.locations:[{id:"l1",name:"Harbour",type:"poi",sublocations:[]}];
      openWorldMap(); _mapImageEditor();
      document.getElementById('mapImgPrompt').value="an old map"; document.getElementById('mapImgModel').value="";
      await _mapImgGen(); _mapClose();
      const s=window.__sent[window.__sent.length-1];
      return s&&s.model==="MAP/text-to-image" ? true : JSON.stringify(s&&s.model); }));
  ok("and a per-universe map model beats the global one", await pg.evaluate(async()=>{
      openWorldMap(); _mapImageEditor();
      document.getElementById('mapImgPrompt').value="an old map"; document.getElementById('mapImgModel').value="THIS-WORLD/t2i";
      await _mapImgGen(); _mapClose();
      const s=window.__sent[window.__sent.length-1];
      return s&&s.model==="THIS-WORLD/t2i" ? true : JSON.stringify(s&&s.model); }));

  console.log("\n[blank fields still fall back, and scene pictures are untouched]");
  ok("a blank field uses the main model", await pg.evaluate(async()=>{
      state.locModel=""; await generateLocationImage({id:"l1",name:"Harbour"});
      const s=window.__sent[window.__sent.length-1]; state.locModel="LOC/text-to-image";
      return s&&s.model==="MAIN/text-to-image" ? true : JSON.stringify(s&&s.model); }));
  ok("a scene picture through a rule still uses the main model", await pg.evaluate(async()=>{
      await genImageForRule({id:"r_pov_talk",label:"Standard"},"a scene","");
      const s=window.__sent[window.__sent.length-1];
      return s&&s.model==="MAIN/text-to-image" ? true : JSON.stringify(s&&s.model); }));
  ok("scene rules carry no model of their own to leak into that path", await pg.evaluate(()=>
      (state.imgRules||[]).every(r=>!("model_id" in r)) ? true : "a rule still has model_id"));

  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close(); process.exit(fail?1:0);
})();
