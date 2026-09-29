/* v140.1 — WHAT THE PLAYER WEARS.
   Characters have had an outfit table since v48.2; the player had an appearance line and nothing
   else, so every picture with the player in it dressed them however the writer guessed. The player
   now has the same table, on the universe (userOutfits + a free-text userWardrobe), edited in the
   universe editor, followed by the wearing tracker, and sent to the image writer whenever the
   player is in the frame.
   Run: node tests/player-outfits.browser.js */
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:process.env.SM_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage({viewport:{width:412,height:915}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file://'+require('path').resolve(__dirname,'..','index.html'));
  await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(800);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x||c).slice(0,700));} };

  await pg.evaluate(()=>{
    const uni=state.universes[0];
    uni.locations=[
      {id:"L_user",name:"Emre's House",residents:[],sublocations:[{id:"s2",name:"Entrance"}]},
      {id:"L_cafe",name:"Vanadium Cafe",residents:[],sublocations:[{id:"s4",name:"Entrance"}]},
      {id:"L_sahil",name:"Sahil",residents:[],sublocations:[{id:"s3",name:"Front Deck Entrance"},{id:"s_sea",name:"Sea"}]}
    ];
    uni.playerHomeLocId="L_user";
    uni.userOutfits={
      byLoc:{L_cafe:"You wear a navy bomber over a white tee and black jeans.",L_sahil:"You wear khaki shorts and a linen shirt."},
      home:{Morning:"You wear grey sweatpants and a faded band tee.",Evening:"You wear a dark green hoodie and joggers."},
      activity:{swim:"You wear black swim shorts."}};
    uni.userWardrobe="";
    if(!state.personas.some(p=>p.id==="po_a")) state.personas.push({id:"po_a",name:"Ayla",universeId:uni.id,
      instructions:"",personality:"p",backstory:"b",style:"s",goals:"",look:{subject:"Woman",raw:"tall"}});
    state.curUniverse=uni.id; state.user="Emre";
    const c=curChat(); c.universeId=uni.id; c.presentIds=["po_a"]; c.gameDay=2; delete c.wearing;
  });
  const put=(locId,subId,period)=>pg.evaluate(o=>{
    const c=curChat(); c.locationId=o.locId; c.location=(locById(o.locId)||{}).name||"";
    c.subPos=c.subPos||{}; c.subPos.__user__=o.subId; c.sub=o.subId; c.subId=o.subId; c.period=o.period;
    return currentOutfit(playerOutfitHolder(c),c);
  },{locId,subId,period});

  console.log("\n[one outfit for the player, decided like a character's]");
  ok("at their own home, by the hour", (await put("L_user","s2","Morning")).text==="You wear grey sweatpants and a faded band tee.",
     JSON.stringify(await put("L_user","s2","Morning")));
  ok("same home, Evening", (await put("L_user","s2","Evening")).text==="You wear a dark green hoodie and joggers.");
  ok("at another place, that place's outfit", (await put("L_cafe","s4","Afternoon")).text==="You wear a navy bomber over a white tee and black jeans.");
  ok("the Sea gets the swimwear", (await put("L_sahil","s_sea","Afternoon")).text==="You wear black swim shorts.");
  ok("the free-text note is the fallback where no slot fits", await pg.evaluate(()=>{
      const u=state.universes[0]; u.userWardrobe="black leather jacket, dark jeans";
      const c=curChat(); c.period="Afternoon"; c.locationId="L_user";
      const f=currentOutfit(playerOutfitHolder(c),c); u.userWardrobe="";
      return (f.why==="wardrobe"&&/leather jacket/.test(f.text)) ? true : JSON.stringify(f); }));
  ok("the scene's say wins until the place or hour changes", await pg.evaluate(()=>{
      const c=curChat(); c.locationId="L_cafe"; c.period="Afternoon";
      setWearingOverride(c,"__user__","Your jacket is off; the white tee is soaked.");
      const a=currentOutfit(playerOutfitHolder(c),c).text;
      c.period="Evening"; const b=currentOutfit(playerOutfitHolder(c),c).text;
      c.period="Afternoon"; setWearingOverride(c,"__user__","");
      return (/soaked/.test(a)&&/bomber/.test(b)) ? true : JSON.stringify({a,b}); }));
  ok("a character's own table is untouched by this", await pg.evaluate(()=>{
      const p={id:"x",name:"X",outfits:{userHome:{Afternoon:"You wear the emerald dress."}}};
      const c=curChat(); c.locationId="L_user"; c.period="Afternoon";
      return currentOutfit(p,c).text==="You wear the emerald dress."; }));

  console.log("\n[the wearing tracker follows the player too]");
  ok("a scene change to the player's clothes is recorded under __user__", await pg.evaluate(async()=>{
      const c=curChat(); c.locationId="L_cafe"; c.period="Afternoon"; state.key="test";
      c.messages=[{mid:"w1",role:"user",content:"*I take off my jacket and hang it on the chair.*",present:["po_a"]}];
      const real=window.chatCompletion; let seen="";
      window.chatCompletion=async(m,mo,o)=>{ if(/Wearing tracker/.test((o&&o.dbg)||"")){ seen=m.map(x=>x.content).join("\n");
        return '{"changed":[{"name":"Emre","wearing":"white tee and black jeans, the navy bomber hung on the chair"}]}'; } return ""; };
      try{ await runWearingTracker(c); }finally{ window.chatCompletion=real; }
      const f=currentOutfit(playerOutfitHolder(c),c);
      return (/Emre: You wear a navy bomber/.test(seen)&&f.why==="scene"&&/hung on the chair/.test(f.text)) ? true : JSON.stringify({seen:seen.slice(0,300),f}); }));
  await pg.evaluate(()=>setWearingOverride(curChat(),"__user__",""));

  console.log("\n[the image writer is told, when the player is in the frame]");
  const draw=(rule,refs)=>pg.evaluate(async([rule,refs])=>{
    const c=curChat(); c.locationId="L_cafe"; c.location="Vanadium Cafe"; c.period="Afternoon";
    c.messages=[{mid:"i1",role:"user",content:"Hi.",present:["po_a"]},
      {mid:"i2",role:"assistant",speaker:"Ayla",speakerId:"po_a",content:"\"Selam.\" *She sits across from you.*",present:["po_a"]}];
    state.key="test";
    const rp=window.pickRule, ur=window.usesRefImage, cc=window.chatCompletion;
    window.pickRule=async()=>Object.assign({name:"Two-shot",promptStyle:""},rule);
    window.usesRefImage=()=>!!refs;
    let data=null;
    window.chatCompletion=async(m,mo,o)=>{ if(/Image prompt writer/.test((o&&o.dbg)||"")){ data=m.map(x=>x.content).join("\n"); throw new Error("stop here"); } return "0"; };
    try{ await illustrate("i2","\"Selam.\" *She sits across from you.*",true); }catch(e){}
    finally{ window.pickRule=rp; window.usesRefImage=ur; window.chatCompletion=cc; }
    return data;
  },[rule,!!refs]);
  const two=await draw({cast:"player",pov:false});
  // v148.3 — with two or more people in the frame, the player's clothes are one line of WHAT EACH PERSON IS WEARING
  ok("a two-shot with the player carries their outfit", !!two&&/WHAT EACH PERSON IS WEARING/.test(two)&&/\n- Emre \(the player\) — [^\n]*navy bomber/.test(two), (two||"(writer never called)").slice(0,1400));
  const lab=await draw({cast:"player",pov:false},true);
  ok("with reference pictures it goes under the player's cast label", !!lab&&/= Emre \(the player\)/.test(lab)&&/\n- the [^=\n]+ = Emre \(the player\) — [^\n]*navy bomber/.test(lab),
     (lab||"(writer never called)").slice(0,1200));
  const pov=await draw({cast:"player",pov:true});
  ok("a shot from the player's own eyes does not", !!pov&&!/navy bomber/.test(pov), (pov||"(writer never called)").slice(0,600));
  const solo=await draw({cast:"solo",pov:false});
  ok("nor does a just-the-speaker shot", !!solo&&!/navy bomber/.test(solo), (solo||"(writer never called)").slice(0,600));
  ok("a player with no clothes on record adds nothing", await (async()=>{
      await pg.evaluate(()=>{ const u=state.universes[0]; u._keep=u.userOutfits; u.userOutfits={}; });
      const d=await draw({cast:"player",pov:false});
      await pg.evaluate(()=>{ const u=state.universes[0]; u.userOutfits=u._keep; delete u._keep; });
      return (!!d&&!/THE PLAYER\) IS IN THIS FRAME/.test(d)) ? true : (d||"(writer never called)").slice(0,600); })());

  console.log("\n[the character answering the player is told too]");
  const blocks=(o)=>pg.evaluate(o=>{
    const c=curChat(); c.locationId="L_cafe"; c.location="Vanadium Cafe"; c.period="Afternoon"; c.presentIds=["po_a","po_b"];
    if(!state.personas.some(p=>p.id==="po_b")) state.personas.push({id:"po_b",name:"Berk",universeId:state.universes[0].id,
      instructions:"",personality:"p",backstory:"b",style:"s",goals:"",look:{subject:"Man",raw:"short"}});
    const p=state.personas.find(x=>x.id==="po_a");
    const B=buildCharPromptBlocks(p,[],{recent:[],diary:[],longterm:[]},o.tn,
      {chat:c,targetName:o.tn,targetId:o.tid,textMode:!!o.text});
    return {rt:String(B.response_target||""),pl:String(B.player||"")};
  },o);
  const toMe=await blocks({tn:"Emre",tid:"__user__"});
  ok("answering the player: the target block says what they have on", /<their_clothes>What Emre is wearing right now/.test(toMe.rt)&&/navy bomber/.test(toMe.rt), toMe.rt.slice(-600));
  ok("and says whose \"you\" it is", /its "you" means Emre, never you/.test(toMe.rt));
  const toBerk=await blocks({tn:"Berk",tid:"po_b"});
  ok("answering someone else: the player's card carries it instead", !/navy bomber/.test(toBerk.rt)&&/Wearing right now \(written to Emre/.test(toBerk.pl)&&/navy bomber/.test(toBerk.pl),
     JSON.stringify(toBerk).slice(0,900));
  const txt=await blocks({tn:"Emre",tid:"__user__",text:true});
  ok("never over a text", !/navy bomber/.test(txt.rt)&&!/navy bomber/.test(txt.pl), txt.rt.slice(-400));
  ok("the scene's change reaches it", await pg.evaluate(()=>{
      const c=curChat(); setWearingOverride(c,"__user__","Your shirt is soaked through.");
      const B=buildCharPromptBlocks(state.personas.find(x=>x.id==="po_a"),[],{recent:[],diary:[],longterm:[]},"Emre",{chat:c,targetName:"Emre",targetId:"__user__"});
      setWearingOverride(c,"__user__","");
      return /soaked through/.test(String(B.response_target)); }));
  ok("with nothing on record the block is exactly as before", await pg.evaluate(()=>{
      const u=state.universes[0]; const keep=u.userOutfits; u.userOutfits={};
      const B=buildCharPromptBlocks(state.personas.find(x=>x.id==="po_a"),[],{recent:[],diary:[],longterm:[]},"Emre",{chat:curChat(),targetName:"Emre",targetId:"__user__"});
      u.userOutfits=keep; return !/their_clothes|Wearing right now/.test(String(B.response_target)); }));
  ok("the default template calls both fragments", await pg.evaluate(()=>
      RT_ORDER.includes("target_wearing")&&PL_ORDER.includes("player_wearing")
      &&/\{\{call\/\/player_wearing\}\}/.test(ptPieceTemplate("player"))&&/\{\{call\/\/target_wearing\}\}/.test(ptPieceTemplate("response_target"))));

  ok("and it reaches the assembled reply, on the template path and the classic one", await pg.evaluate(()=>{
      const c=curChat(); const p=state.personas.find(x=>x.id==="po_a");
      const inj={recent:[],diary:[],longterm:[]};
      const hb=buildCharPromptBlocks(p,[],inj,"Emre",{chat:c,targetName:"Emre",targetId:"__user__"});
      const tb=buildTailBlocks({chat:c,selfP:p,selfId:p.id,selfName:p.name,targetName:"Emre",targetId:"__user__",multi:true,injected:inj});
      const was=state.payloadTplOn; state.payloadTplOn=true;
      let tpl=""; try{ const m=ptBuildMessages("multi",Object.assign({},hb,tb),[],{chat:c,npc:p,targetName:"Emre"}); tpl=(m||[]).map(x=>x.content).join("\n"); }
      finally{ state.payloadTplOn=was; }
      const cl=buildPayload("multi",hb,tb); const classic=[cl.head,cl.tail].join("\n");
      return (/navy bomber/.test(tpl)&&/navy bomber/.test(classic)) ? true : JSON.stringify({tpl:/navy bomber/.test(tpl),classic:/navy bomber/.test(classic)}); }));

  console.log("\n[the universe editor]");
  ok("the player's section shows the table, home rows included", await pg.evaluate(()=>{
      editUniverse(state.universes[0].id);
      const rows=[...document.querySelectorAll('#ueUserOutfits input[data-outfit]')].map(i=>i.getAttribute('data-outfit'));
      const bomber=document.querySelector('#ueUserOutfits input[data-outfit="byLoc|L_cafe"]');
      return (rows.includes("byLoc|L_cafe")&&rows.includes("home|Morning")&&rows.includes("activity|swim")
              &&bomber&&/navy bomber/.test(bomber.value)&&!rows.some(r=>/^userHome/.test(r))) ? true : rows.join(","); }));
  ok("no home chosen → no home rows", await pg.evaluate(()=>{
      const sel=document.getElementById('ueUserHome'); sel.value=""; sel.onchange();
      const has=!!document.querySelector('#ueUserOutfits input[data-outfit^="home|"]');
      sel.value="L_user"; sel.onchange(); return !has; }));
  ok("an edit and the free-text note are saved to the universe", await pg.evaluate(()=>{
      const i=document.querySelector('#ueUserOutfits input[data-outfit="activity|sport"]');
      i.value="You wear a grey track suit."; i.oninput();
      document.getElementById('ueUserWardrobe').value="leather jacket, dark jeans";
      saveUniverse();
      const u=state.universes[0];
      return (u.userOutfits.activity.sport==="You wear a grey track suit."&&u.userWardrobe==="leather jacket, dark jeans"
              &&/navy bomber/.test(u.userOutfits.byLoc.L_cafe)) ? true : JSON.stringify({o:u.userOutfits,w:u.userWardrobe}); }));
  ok("Generate outfits fills only the empty slots, from the player's own details", await pg.evaluate(async()=>{
      editUniverse(state.universes[0].id);
      const cc=window.chatCompletion; let data="";
      window.chatCompletion=async(m,mo,o)=>{ data=m.map(x=>x.content).join("\n");
        return JSON.stringify({byLoc:{L_user:"You wear a flannel shirt.",L_cafe:"SHOULD NOT REPLACE"},home:{Midday:"You wear a white tee."},
          userHome:{Morning:"ignored"},activity:{sleep:"You wear boxers."}}); };
      try{ await generateUserOutfits(false); }finally{ window.chatCompletion=cc; }
      const o=_ueUserOutfits;
      return (o.byLoc.L_user==="You wear a flannel shirt."&&/navy bomber/.test(o.byLoc.L_cafe)&&o.home.Midday==="You wear a white tee."
              &&o.activity.sleep==="You wear boxers."&&!o.userHome&&/the PLAYER's own character/.test(data)&&/ONLY THESE SLOTS ARE MISSING/.test(data))
        ? true : JSON.stringify(o)+"\n"+data.slice(0,300); }));
  await pg.evaluate(()=>{ try{ closeModal('universeModal'); }catch(e){} });

  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close(); process.exit(fail?1:0);
})();
