/* v150.5 — THE SCENE CHAIN: WITH AN EDIT MODEL, EACH PICTURE EDITS THE ONE BEFORE IT.
   Asked: "We will also upload the previous image generated to the model, always as the last uploaded
   image, describe it as the current scene and rewrite the prompts to describe the changes in this
   image. The first image after a location change is the base reference image that only has face
   references. Clothing is given only in the first image; after that the image carries it. The
   sub-location description is injected only in the first image of every sub-location change, where
   the background is prompted to change — but no clothing change."
   Checked through a real illustrate() → atlasImage() with only the network stubbed, so what is
   asserted is the request body AtlasCloud would receive and the messages the prompt writer got:
     1. the first picture in a place: faces only, clothes and the area described;
     2. the next picture in the same area: the previous picture goes LAST, the roster calls it the
        current scene, and the writer gets an edit brief with no clothes, no room, no old prompt;
     3. a new area of the same place: the previous picture goes last, the background is replaced
        with the new area (described once), still no clothes;
     4. a new location, or a new day, starts again from faces only;
     5. someone not in the previous picture still has their clothes described;
     6. a regenerate edits the same previous picture; a model that is not an edit model never chains.
   Run: node tests/img-scene-chain.browser.js */
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:process.env.SM_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage();
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file://'+require('path').resolve(__dirname,'..','index.html'));
  await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(600);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x||c).slice(0,900));} };

  await pg.evaluate(()=>{
    const uni=state.universes[0];
    uni.locations=[
      {id:"L_cafe",name:"Vanadium Cafe",description:"A sleek coffee bar with chrome stools and a neon sign.",residents:[],
       sublocations:[{id:"c1",name:"Entrance",entrance:true,description:"A glass door and a chalkboard menu."},{id:"c2",name:"Outdoor Patio",description:"Wooden tables under a striped awning, potted olive trees."}]},
      {id:"L_mill",name:"Isdemir",description:"A sprawling steel mill.",residents:[],sublocations:[{id:"m1",name:"Main Gate",entrance:true},{id:"m2",name:"Worker Canteen"}]}
    ];
    const mk=(id,n,subj,refs,extra)=>Object.assign({id,name:n,universeId:uni.id,look:{subject:subj},refs,instructions:"x",personality:"x"},extra||{});
    state.personas=[
      mk("p_sami","Sami","Man",["data:S1"],{outfits:{byLoc:{L_cafe:"You wear a cream cashmere crewneck and navy shorts.",L_mill:"You wear navy coveralls."}}}),
      mk("p_burcu","Burcu","Woman",["data:U1"],{outfits:{byLoc:{L_cafe:"You wear a coral-pink cardigan over a white tank top."}}})
    ];
    state.user="Emre"; state.key="k"; state.autoImg=false; state.userLook=""; state.userSubject="Man";
    const c=curChat(); c.universeId=uni.id; state.curUniverse=uni.id;
    window.personRefs=p=>(p&&p.refs)||[];
    window.playerRefs=()=>["data:E1"];
    window._playerRefHolder=()=>({look:{subject:"Man"}});
    window.toDataUri=async u=>u;
    window.saveMsgImage=(m,u,cb)=>{ if(cb)cb(true); }; window.captureGalleryMedia=()=>{};
    state.atlasKey="test-key"; state.imgProvider="atlascloud"; state.imgModel="bytedance/seedream-v4.5/edit";
    window.__rule={label:"Talk",cast:"player",pov:false,promptStyle:""};
    window.pickRule=async()=>window.__rule;
    window.__out="the man in IMAGE 1 leans on the table";
    window.chatCompletion=async(messages,model,opts)=>{
      if(opts&&opts.dbg==="Image prompt writer"){ window.__writer=messages; return window.__out; }
      return "{}";
    };
    window.__n=0;
    window.fetch=async(u,o)=>{
      if(/generateImage$/.test(String(u))){
        window.__body=JSON.parse(o.body); window.__n++;
        return {ok:true,status:200,json:async()=>({data:{id:"p"+window.__n,status:"completed",outputs:["https://out/"+window.__n+".png"]}})};
      }
      return {ok:false,status:404,json:async()=>({}),text:async()=>""};
    };
  });
  // where the chat is; `fresh` empties it first
  const at=(o)=>pg.evaluate(o=>{
    const c=curChat();
    if(o.fresh){ c.messages=[]; c.imgPromptBy={}; c.imgWindowBy={}; c.lastImgRuleBy={}; c.imgContBy={}; c.outfitHeld={}; c.wearing={}; }
    c.locationId=o.loc||"L_cafe"; c.location=(locById(c.locationId)||{}).name; c.subId=o.sub||"c1"; c.subPos={};
    c.presentIds=o.present||["p_sami"]; c.presentIds.forEach(id=>c.subPos[id]=c.subId);
    c.period="Midday"; c.gameDay=o.day||1;
  },o||{});
  // add a line (or a travel beat) and draw it; returns the body sent and what the writer was given
  const draw=(line,opts)=>pg.evaluate(async(a)=>{
    const c=curChat();
    if(a.travel) c.messages.push({mid:"t"+c.messages.length,role:"assistant",speaker:"Narrator",narratorEvent:true,travelBeat:true,content:"You head over."});
    let m;
    if(a.redo){ m=c.messages[c.messages.length-1]; }
    else{ m={mid:"m"+c.messages.length,role:"assistant",speaker:a.who||"Sami",speakerId:a.id||"p_sami",content:a.line,present:c.presentIds.slice()}; c.messages.push(m); }
    window.__writer=null; window.__body=null;
    await illustrate(m.mid,m.content,true);
    const usr=(window.__writer||[]).filter(x=>x.role==="user").map(x=>x.content).join("\n");
    const bd=window.__body||{};
    return {mid:m.mid,state:m.imgState,err:m.imgErr||"",img:m.img,chain:m.imgChain||null,images:bd.images||[],prompt:bd.prompt||"",usr};
  },Object.assign({line},opts||{}));

  console.log("\n[1. the first picture in a place: faces only, clothes and the area described]");
  await at({fresh:true,loc:"L_cafe",sub:"c1"});
  const A=await draw("*Sami pulls out a chair at the counter.*");
  ok("it generated", A.state==="done"&&A.img==="https://out/1.png", JSON.stringify(A));
  ok("only face pictures go up — no previous picture", JSON.stringify(A.images)==='["data:S1","data:E1"]', JSON.stringify(A.images));
  ok("the writer is told what Sami wears", /cashmere crewneck/.test(A.usr), A.usr.slice(0,900));
  ok("and where the frame happens", /WHERE THIS FRAME HAPPENS/.test(A.usr)&&/chalkboard menu/.test(A.usr), A.usr.slice(0,900));
  ok("it is not an edit", A.chain===null&&!/EDITING THE CURRENT SCENE/.test(A.usr)&&!/current scene/.test(A.prompt), A.prompt.slice(0,300));

  console.log("\n[2. the next picture in the same area edits the previous one]");
  await at({loc:"L_cafe",sub:"c1"});
  const B=await draw("*Sami leans forward on his elbows.*");
  ok("the previous picture is sent, LAST, after the faces", JSON.stringify(B.images)==='["data:S1","data:E1","https://out/1.png"]', JSON.stringify(B.images));
  ok("the image model is told that last picture is the current scene to edit",
     /Figure 3 is not a person: it is the current scene — edit it/.test(B.prompt) && B.prompt.indexOf("Figure 3 is not a person")<B.prompt.indexOf("the man in IMAGE 1 leans"), B.prompt.slice(0,700));
  ok("the writer gets the edit brief", /EDITING THE CURRENT SCENE/.test(B.usr)&&/Write only what has to CHANGE/.test(B.usr), B.usr.slice(0,600));
  ok("no clothes are injected", !/cashmere/.test(B.usr)&&!/WHAT THEY ARE WEARING/.test(B.usr)&&!/WARDROBE/.test(B.usr), B.usr.slice(0,900));
  ok("no location is injected", !/WHERE THIS FRAME HAPPENS/.test(B.usr)&&!/chalkboard/.test(B.usr), B.usr.slice(0,900));
  ok("and no old prompt as a continuity reference — the picture is the continuity", !/CONTINUITY REFERENCE/.test(B.usr)&&!/No previous image/.test(B.usr), B.usr.slice(0,900));
  ok("the message records what it edited", B.chain&&B.chain.from===A.mid&&B.chain.mode==="edit", JSON.stringify(B.chain));
  const B2=await draw("",{redo:true});
  ok("a regenerate of that picture edits the same previous one, not itself",
     JSON.stringify(B2.images)==='["data:S1","data:E1","https://out/1.png"]'&&B2.chain&&B2.chain.from===A.mid, JSON.stringify(B2.images));
  const C=await draw("*Sami taps the cup.*");
  ok("the picture after that edits the newest one", C.images[C.images.length-1]==="https://out/3.png"&&C.chain.from===B.mid, JSON.stringify(C.images));

  console.log("\n[3. a new area of the same place: same clothes, new background]");
  await at({loc:"L_cafe",sub:"c2"});
  const D=await draw("*Sami carries the cups out to the patio.*");
  ok("the previous picture still goes last", D.images[D.images.length-1]==="https://out/4.png"&&D.images.length===3, JSON.stringify(D.images));
  ok("the image model is told to keep the people and their clothes and replace the background",
     /it is the previous scene\. Keep the people in it and exactly the clothes they wear, and replace the whole background/.test(D.prompt), D.prompt.slice(0,500));
  ok("the writer gets the move brief with the new area described, once", /THE PEOPLE HAVE MOVED TO ANOTHER AREA/.test(D.usr)&&/striped awning/.test(D.usr)&&/Outdoor Patio/.test(D.usr), D.usr.slice(0,900));
  ok("and still no clothes", !/cashmere/.test(D.usr)&&!/WHAT THEY ARE WEARING/.test(D.usr), D.usr.slice(0,900));
  ok("recorded as a move", D.chain&&D.chain.mode==="move", JSON.stringify(D.chain));
  const E=await draw("*Sami sits down under the awning.*");
  ok("the next picture on the patio is a plain edit again, with no area description", E.chain&&E.chain.mode==="edit"&&!/striped awning/.test(E.usr)&&!/MOVED TO ANOTHER AREA/.test(E.usr), E.usr.slice(0,600));

  console.log("\n[4. a new location, or a new day, starts from faces again]");
  await at({loc:"L_mill",sub:"m1"});
  const F=await draw("*Sami walks through the gate.*",{travel:true});
  ok("after travel: faces only", JSON.stringify(F.images)==='["data:S1","data:E1"]'&&F.chain===null, JSON.stringify(F.images));
  ok("and the clothes for the new place are described", /navy coveralls/.test(F.usr), F.usr.slice(0,900));
  const G=await draw("*Sami waves at the guard.*");
  ok("then it chains again at the new place", G.images[G.images.length-1]==="https://out/"+(await pg.evaluate(()=>window.__n-1))+".png"&&G.chain&&G.chain.from===F.mid, JSON.stringify(G.images));
  await at({loc:"L_mill",sub:"m1",day:2});
  const H=await draw("*Sami is back at the gate the next morning.*");
  ok("a new day in the same place starts from faces", JSON.stringify(H.images)==='["data:S1","data:E1"]'&&H.chain===null, JSON.stringify(H.images));
  await at({loc:"L_cafe",sub:"c1",day:2});
  const H2=await draw("*Sami is at the cafe.*");
  ok("a location change without a travel beat still starts from faces", JSON.stringify(H2.images)==='["data:S1","data:E1"]'&&H2.chain===null, JSON.stringify(H2.images));

  console.log("\n[5. someone new to the frame still gets their clothes]");
  await at({loc:"L_cafe",sub:"c1",day:2,present:["p_sami","p_burcu"]});
  await pg.evaluate(()=>{ window.__out="the man in IMAGE 1 turns to the woman in IMAGE 3"; });
  const N=await draw("*Burcu walks in and Sami turns to her.*");
  ok("the previous picture goes last, after all three people's faces", N.images.length===4&&N.images[3]==="https://out/"+(await pg.evaluate(()=>window.__n-1))+".png", JSON.stringify(N.images));
  ok("Burcu, not in the previous picture, is dressed", /NEW IN THE FRAME/.test(N.usr)&&/coral-pink cardigan/.test(N.usr), N.usr.slice(0,1400));
  ok("Sami, who was, is not", !/cashmere/.test(N.usr), N.usr.slice(0,1400));
  const N2=await draw("*Burcu sits down.*",{who:"Burcu",id:"p_burcu"});
  ok("once she has been in a picture, nobody's clothes are described", !/coral-pink/.test(N2.usr)&&!/cashmere/.test(N2.usr)&&!/NEW IN THE FRAME/.test(N2.usr)&&/WHAT EACH PERSON IN THE FRAME IS DOING/.test(N2.usr), N2.usr.slice(0,1400));

  console.log("\n[6. only edit models chain]");
  await at({loc:"L_cafe",sub:"c1",day:2,present:["p_sami"]});
  const T=await pg.evaluate(()=>{ const c=curChat(); state.imgModel="z-image/turbo"; const r=_imgChainPrev(c,c.messages.length); state.imgModel="bytedance/seedream-v4.5/edit"; return r; });
  ok("a text-to-image model never gets a previous picture", T===null, JSON.stringify(T));
  const X=await pg.evaluate(async()=>{ const keep=window._imgChainSrc; window._imgChainSrc=async()=>""; const c=curChat();
    const m={mid:"m"+c.messages.length,role:"assistant",speaker:"Sami",speakerId:"p_sami",content:"*Sami smiles.*",present:["p_sami"]}; c.messages.push(m);
    window.__writer=null; await illustrate(m.mid,m.content,true); window._imgChainSrc=keep;
    return {images:(window.__body||{}).images||[],chain:m.imgChain||null,usr:(window.__writer||[]).filter(x=>x.role==="user").map(x=>x.content).join("\n")}; });
  ok("a previous picture that cannot be loaded makes this a base frame, clothes and place described",
     X.chain===null&&X.images.length===2&&/WHERE THIS FRAME HAPPENS/.test(X.usr)&&/cashmere/.test(X.usr), JSON.stringify(X).slice(0,600));

  ok("the four prompts are registry prompts on the image writer's card", await pg.evaluate(()=>
     ["x_img_edit_scene","x_img_edit_move","x_img_edit_roster_scene","x_img_edit_roster_move"].every(k=>!!PROMPT_BY_KEY[k]&&!!K[k]
       &&ENGINE_PAYLOAD_DEFS.some(d=>(d.blocks||[]).some(x=>x.promptKey===k)))));
  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log("\n  "+pass+" passed, "+fail+" failed");
  await b.close();
  process.exit(fail?1:0);
})();
