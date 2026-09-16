/* WHAT YOU ARE WEARING.
   A wardrobe was a menu, and two readers chose from it independently on the same turn — the reply
   payload picked one outfit and the image writer picked another, which is how a character gets
   described in the emerald dress and drawn in the yoga pants. The choosing moves into a table:
   one outfit per location, per time of day at their own home and at the player's house, plus the
   four a place cannot express. currentOutfit() resolves exactly one and hands it to both.
   Run: node tests/outfits.browser.js   (needs playwright; see tests/README.md) */
const {chromium}=require('playwright');
const BIN=process.env.CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
(async()=>{
  const b=await chromium.launch({executablePath:BIN});
  const pg=await b.newPage({viewport:{width:412,height:915}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file:///home/user/Multirp/index.html'); await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(900);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x||c).slice(0,420));} };

  await pg.evaluate(()=>{
    const uni=state.universes[0];
    uni.locations=[
      {id:"L_home",name:"Ozlem's House",residents:["o_oz"],sublocations:[{id:"s1",name:"Entrance"},{id:"s_bed",name:"Bedroom"}]},
      {id:"L_user",name:"Emre's House",residents:[],sublocations:[{id:"s2",name:"Entrance"}]},
      {id:"L_sahil",name:"Sahil",residents:[],sublocations:[{id:"s3",name:"Front Deck Entrance"},{id:"s_sea",name:"Sea"},{id:"s_gym",name:"Spor Salonu"}]}
    ];
    uni.playerHomeLocId="L_user";
    if(!state.personas.some(p=>p.id==="o_oz")) state.personas.push({id:"o_oz",name:"Ozlem",universeId:uni.id,
      instructions:"",personality:"p",backstory:"b",style:"s",goals:"",traits:"",look:{raw:"tall"},
      wardrobe:"Daily: your green dress",
      outfits:{
        byLoc:{L_sahil:"You wear a white linen sundress.",L_user:"You wear the emerald wrap dress.",L_home:"You wear a cotton housedress."},
        home:{Morning:"You wear a pink housecoat.",Midday:"You wear a cotton housedress.",Afternoon:"You wear capri pants.",Evening:"You wear a soft grey knit.",Night:"You wear a cotton nightdress."},
        userHome:{Morning:"You wear the navy blouse.",Midday:"You wear the navy blouse.",Afternoon:"You wear the emerald wrap dress.",Evening:"You wear the emerald wrap dress.",Night:"You wear the emerald wrap dress."},
        activity:{swim:"You wear a red string bikini.",sport:"You wear black yoga pants.",sleep:"You wear a cotton nightdress.",intimate:"You wear red lace."}
      }});
    if(!state.personas.some(p=>p.id==="o_no")) state.personas.push({id:"o_no",name:"Nooutfit",universeId:uni.id,
      instructions:"",personality:"p",backstory:"b",style:"s",goals:"",traits:"",look:{raw:"short"},
      wardrobe:"Daily: your brown coat"});
    const c=curChat(); c.presentIds=["o_oz","o_no"]; state.user="Emre"; c.gameDay=2;
  });
  const put=(locId,subId,period)=>pg.evaluate(o=>{
    const c=curChat(); c.locationId=o.locId; c.location=(locById(o.locId)||{}).name||"";
    c.subPos=c.subPos||{}; c.subPos.__user__=o.subId; c.subPos.o_oz=o.subId; c.sub=o.subId; c.subId=o.subId;
    c.period=o.period; c.timeOfDay=o.period;
    const p=state.personas.find(x=>x.id==="o_oz");
    return currentOutfit(p,c);
  },{locId,subId,period});

  console.log("\n[one outfit, decided from where you are and what hour it is]");
  ok("at her own home in the Morning", (await put("L_home","s1","Morning")).text==="You wear a pink housecoat.",
     JSON.stringify(await put("L_home","s1","Morning")));
  ok("same house, Afternoon, different outfit", (await put("L_home","s1","Afternoon")).text==="You wear capri pants.");
  ok("at the player's house it is the player's-house table", (await put("L_user","s2","Afternoon")).text==="You wear the emerald wrap dress.");
  ok("anywhere else it is that location's outfit", (await put("L_sahil","s3","Afternoon")).text==="You wear a white linen sundress.");

  console.log("\n[what the place alone cannot say]");
  ok("the Sea gets the swimsuit, not Sahil's sundress", (await put("L_sahil","s_sea","Afternoon")).text==="You wear a red string bikini.");
  ok("the gym gets sportswear, in Turkish too (Spor Salonu)", (await put("L_sahil","s_gym","Afternoon")).text==="You wear black yoga pants.");
  ok("Night at her own home is sleepwear", (await put("L_home","s1","Night")).why==="activity:sleep",
     JSON.stringify(await put("L_home","s1","Night")));
  ok("but Night somewhere else is not", (await put("L_sahil","s3","Night")).text==="You wear a white linen sundress.");

  console.log("\n[the scene gets the last word, and it expires by itself]");
  ok("an override wins over the table", await pg.evaluate(()=>{
      const c=curChat(); c.locationId="L_sahil"; c.subPos={o_oz:"s3"}; c.period="Afternoon";
      const p=state.personas.find(x=>x.id==="o_oz");
      setWearingOverride(c,"o_oz","bare from the waist up, jeans still on");
      return currentOutfit(p,c).text==="bare from the waist up, jeans still on"?true:currentOutfit(p,c).text; }));
  ok("moving to another place drops it", await pg.evaluate(()=>{
      const c=curChat(); c.locationId="L_home"; c.subPos={o_oz:"s1"};
      const p=state.personas.find(x=>x.id==="o_oz");
      return currentOutfit(p,c).why==="home:Afternoon"?true:JSON.stringify(currentOutfit(p,c)); }));
  ok("so does letting the hour turn", await pg.evaluate(()=>{
      const c=curChat(); c.locationId="L_sahil"; c.subPos={o_oz:"s3"}; c.period="Afternoon";
      const p=state.personas.find(x=>x.id==="o_oz");
      setWearingOverride(c,"o_oz","a borrowed coat");
      c.period="Evening";
      return currentOutfit(p,c).why==="location"?true:JSON.stringify(currentOutfit(p,c)); }));
  ok("the tracker does not fire on an ordinary turn", await pg.evaluate(()=>{
      const c=curChat();
      c.messages=[{mid:"z1",role:"user",present:["o_oz"],content:'"Çayı söyledin mi canım?"'}];
      return hasClothingCue(c)===false?true:"fired"; }));
  ok("and does on one that touches clothes, in either language", await pg.evaluate(()=>{
      const c=curChat();
      c.messages=[{mid:"z1",role:"user",present:["o_oz"],content:'*Gömleğini çıkarıyorum.*'}];
      const tr=hasClothingCue(c);
      c.messages=[{mid:"z2",role:"user",present:["o_oz"],content:'*He pulls off his shirt.*'}];
      return (tr&&hasClothingCue(c))?true:("tr="+tr); }));

  console.log("\n[both readers get the same already-chosen outfit]");
  ok("the payload says what is ON her, not a menu", await pg.evaluate(()=>{
      const c=curChat(); c.locationId="L_sahil"; c.subPos={o_oz:"s_sea"}; c.period="Afternoon"; c.wearing={};
      const p=state.personas.find(x=>x.id==="o_oz");
      const t=charBioBlock(p,{self:true,chat:c});
      return (t.indexOf("<wearing>")>-1 && t.indexOf("red string bikini")>-1 && t.indexOf("<wardrobe>")===-1)
        ? true : t.split("\n").filter(l=>/wearing|wardrobe/.test(l)).join(" | "); }));
  ok("the image writer is handed the same one, as a fact", await pg.evaluate(()=>{
      const c=curChat(); const p=state.personas.find(x=>x.id==="o_oz");
      const w=_imgWardrobeBlock(p,c);
      return (/WHAT THEY ARE WEARING/.test(w) && /red string bikini/.test(w) && !/OPTIONS/.test(w))?true:w; }));
  ok("and the dressing context is dropped — there is nothing left to choose", await pg.evaluate(()=>
      _imgOutfitDecided(state.personas.find(x=>x.id==="o_oz"))===true));

  console.log("\n[a character with no table behaves exactly as before]");
  ok("still gets the old wardrobe menu", await pg.evaluate(()=>{
      const p=state.personas.find(x=>x.id==="o_no");
      const t=charBioBlock(p,{self:true,chat:curChat()});
      return (t.indexOf("<wardrobe>")>-1 && t.indexOf("<wearing>")===-1)?true:t; }));
  ok("and the image writer still offers it as options", await pg.evaluate(()=>{
      const w=_imgWardrobeBlock(state.personas.find(x=>x.id==="o_no"),curChat());
      return /OPTIONS/.test(w)?true:w; }));
  ok("hasOutfits tells them apart", await pg.evaluate(()=>
      hasOutfits(state.personas.find(x=>x.id==="o_oz"))===true
      && hasOutfits(state.personas.find(x=>x.id==="o_no"))===false));

  console.log("\n[the slots this universe asks for]");
  ok("every location, both period tables, and the four activities", await pg.evaluate(()=>{
      const s=outfitSlots(state.personas.find(x=>x.id==="o_oz"));
      return (s.locations.length===3 && s.home && s.home.id==="L_home" && s.userHome && s.userHome.id==="L_user"
              && s.periods.length===5 && s.activities.length===4)?true:JSON.stringify(s); }));
  ok("a full table reports nothing missing", await pg.evaluate(()=>{
      const m=missingOutfitSlots(state.personas.find(x=>x.id==="o_oz"));
      return m.length===0?true:m.join(", "); }));
  ok("adding a location shows up as a gap", await pg.evaluate(()=>{
      const u=curUniverseObj(); u.locations.push({id:"L_new",name:"Çay Bahçesi",sublocations:[{id:"s9",name:"Entrance"}]});
      const m=missingOutfitSlots(state.personas.find(x=>x.id==="o_oz"));
      u.locations=u.locations.filter(l=>l.id!=="L_new");
      return (m.length===1 && /Çay Bahçesi/.test(m[0]))?true:JSON.stringify(m); }));
  ok("the generator and the tracker are real, editable prompts", await pg.evaluate(()=>{
      const a=up("x_outfits_generator"), t=up("x_wearing_tracker");
      return (a&&a.indexOf("SECOND PERSON")>-1 && t&&t.indexOf('"changed"')>-1)?true:"missing"; }));

  console.log("\n[nothing else moved]");
  ok("no page errors", errs.length===0?true:errs.join(" | "));
  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close(); process.exit(fail?1:0);
})();
