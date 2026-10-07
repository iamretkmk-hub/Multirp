/* v150.12 — A NEW SCENE TYPE IS A NEW POSITION.
   Reported: "When the position changes, the previous pose prompt is corrupting the new pose. Since we
   send the previous prompt to the LLM and ask it to be consistent, it mixed the prompts. When the scene
   changes, state that the scene has changed, keep only the latest clothing state from the previous
   image and write the rest according to the new pose."
   Checked through a real illustrate() (network stubbed), on the prompt writer's message:
     1. the same scene type again: the previous frame goes over as the CONTINUITY REFERENCE, as before;
     2. a different scene type: no continuity reference, a "scene has changed" block naming both types,
        and only the previous frame's clothing phrases — none of its pose, position or framing;
     3. with the scene chain (the previous picture being edited): the block says the picture carries
        the clothing, and the writer is told to restage;
     4. the clothing filter keeps garments and nakedness and drops positions ("on top", "on all fours").
   Run: node tests/img-type-change.browser.js */
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
    state.imgRules=[{id:"r_doggy",label:"Doggy",when:"x",cast:"player",pov:true,promptStyle:"",enabled:true},
                    {id:"r_miss",label:"Missionary",when:"x",cast:"player",pov:true,promptStyle:"",enabled:true}];
    uni.locations=[{id:"L_home",name:"Emre's House",description:"A flat.",residents:[],sublocations:[{id:"h1",name:"Master Bedroom",entrance:true,description:"A wide bed."}]}];
    state.personas=[{id:"p_b",name:"Buket",universeId:uni.id,look:{subject:"Woman"},image:"data:B1",instructions:"x",personality:"x"}];
    state.user="Emre"; state.key="k"; state.autoImg=false; state.userSubject="Man";
    const c=curChat(); c.universeId=uni.id; state.curUniverse=uni.id;
    window.playerRefs=()=>["data:E1"]; window._playerRefHolder=()=>({look:{subject:"Man"}});
    window.toDataUri=async u=>u;
    window.saveMsgImage=(m,u,cb)=>{ if(cb)cb(true); }; window.captureGalleryMedia=()=>{};
    state.atlasKey="test-key"; state.imgProvider="atlascloud"; state.imgModel="bytedance/seedream-v4.5/edit";
    window.__rule="r_doggy"; window.pickRule=async()=>state.imgRules.find(r=>r.id===window.__rule);
    window.__out="";
    window.chatCompletion=async(messages,model,opts)=>{ if(opts&&opts.dbg==="Image prompt writer"){ window.__writer=messages; return window.__out; } return "{}"; };
    window.__n=0;
    window.fetch=async(u,o)=>{
      if(/generateImage$/.test(String(u))){ window.__body=JSON.parse(o.body); window.__n++;
        return {ok:true,status:200,json:async()=>({data:{id:"p"+window.__n,status:"completed",outputs:["https://out/"+window.__n+".png"]}})}; }
      return {ok:false,status:404,json:async()=>({}),text:async()=>""};
    };
    c.locationId="L_home"; c.location="Emre's House"; c.subId="h1"; c.subPos={p_b:"h1"}; c.presentIds=["p_b"]; c.period="Afternoon"; c.gameDay=1;
    c.messages=[]; c.imgPromptBy={}; c.imgWindowBy={}; c.lastImgRuleBy={}; c.imgContBy={};
  });
  const draw=(o)=>pg.evaluate(async(a)=>{
    window.__rule=a.rule; window.__out=a.out;
    const c=curChat(); const m={mid:"m"+c.messages.length,role:"assistant",speaker:"Buket",speakerId:"p_b",content:a.line,present:["p_b"]};
    c.messages.push(m); window.__writer=null; window.__body=null;
    await illustrate(m.mid,m.content,true);
    return {state:m.imgState,err:m.imgErr||"",changed:m.imgTypeChanged||null,images:(window.__body||{}).images||[],
      usr:(window.__writer||[]).filter(x=>x.role==="user").map(x=>x.content).join("\n")};
  },o);

  console.log("\n[without the scene chain — the written continuity path]");
  await pg.evaluate(()=>{ window.__chainPrev=window._imgChainPrev; window._imgChainPrev=()=>null; });
  const A=await draw({rule:"r_doggy",line:"*Dizlerimin üzerine çöküyorum.*",
    out:"the woman in IMAGE 1 on all fours being taken from behind, head turned back over her shoulder, fully naked, red lace panties pulled aside, skin glistening, the viewer's hands gripping her hips"});
  ok("the first frame generated", A.state==="done", JSON.stringify(A));
  const B=await draw({rule:"r_doggy",line:"*Kalçalarımı ona doğru itiyorum.*",out:"the woman in IMAGE 1 arches her back"});
  ok("the same scene type again: the previous frame is the continuity reference, as before",
     /CONTINUITY REFERENCE/.test(B.usr)&&/on all fours/.test(B.usr)&&!/THE SCENE HAS CHANGED/.test(B.usr)&&B.changed===null, B.usr.slice(0,700));
  const C=await draw({rule:"r_miss",line:"*Sırt üstü uzanıp onu üstüme çekiyorum.*",out:"the woman in IMAGE 1 on her back"});
  ok("a new scene type: the writer is told the scene has changed, from which type to which",
     /THE SCENE HAS CHANGED — from "Doggy" to "Missionary"/.test(C.usr)&&C.changed&&C.changed.from==="Doggy"&&C.changed.to==="Missionary", C.usr.slice(0,700));
  ok("no continuity reference, and nothing of the old position (the reported case)",
     !/CONTINUITY REFERENCE/.test(C.usr)&&!/all fours/.test(C.usr)&&!/from behind/.test(C.usr)&&!/over her shoulder/.test(C.usr)&&!/gripping her hips/.test(C.usr)&&!/arches her back/.test(C.usr), C.usr.slice(0,1200));
  ok("only the previous frame's clothing state carries over", /fully naked/.test(C.usr)&&/red lace panties pulled aside/.test(C.usr), C.usr.slice(0,1200));
  const D=await draw({rule:"r_miss",line:"*Bacaklarımı beline doluyorum.*",out:"the woman in IMAGE 1 wraps her legs around"});
  ok("the next frame of the new type is a continuation again", /CONTINUITY REFERENCE/.test(D.usr)&&!/THE SCENE HAS CHANGED/.test(D.usr), D.usr.slice(0,500));
  await pg.evaluate(()=>{ window._imgChainPrev=window.__chainPrev; });

  console.log("\n[with the scene chain — the previous picture is being edited]");
  await pg.evaluate(()=>{ const c=curChat(); c.messages=[]; c.imgContBy={}; c.imgPromptBy={}; c.imgWindowBy={}; c.lastImgRuleBy={}; });
  await draw({rule:"r_doggy",line:"*Dizlerimin üzerine çöküyorum.*",out:"the woman in IMAGE 1 on all fours, fully naked"});
  const E=await draw({rule:"r_miss",line:"*Sırt üstü dönüyorum.*",out:"restage"});
  ok("the previous picture is still sent last", E.images[E.images.length-1]&&/^https:\/\/out\//.test(E.images[E.images.length-1]), JSON.stringify(E.images));
  ok("the writer is told the scene has changed, to restage, and to write the clothing out (v150.51: never 'the same clothing')",
     /THE SCENE HAS CHANGED — from "Doggy" to "Missionary"/.test(E.usr)&&/written out garment by garment with colours/.test(E.usr)&&/Write them fresh/.test(E.usr), E.usr.slice(0,1200));

  console.log("\n[the clothing filter]");
  const F=await pg.evaluate(()=>_imgClothingClauses("woman on top, riding him, fully naked, black lace bra pushed up, on all fours, white shirt unbuttoned, hands on his chest, close-up from below"));
  ok("keeps garments and nakedness, drops positions and framing", F==="fully naked, black lace bra pushed up, white shirt unbuttoned", F);

  ok("the prompt is a registry prompt on the image writer's card", await pg.evaluate(()=>!!PROMPT_BY_KEY.x_img_type_changed&&!!K.x_img_type_changed&&ENGINE_PAYLOAD_DEFS.some(d=>(d.blocks||[]).some(x=>x.promptKey==="x_img_type_changed"))));
  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log("\n  "+pass+" passed, "+fail+" failed");
  await b.close();
  process.exit(fail?1:0);
})();
