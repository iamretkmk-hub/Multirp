/* v150.9 — THE MANUAL GENERATE BUTTON ASKS WHICH SCENE.
   Asked: "When the manual image generation button is pressed, allow the user to select the pose,
   bypassing the scene selector."
   Checked:
     1. the Generate icon opens a picker: "Automatic" first, then every enabled scene type, with the
        ones where someone in the scene holds pose pictures marked;
     2. picking a scene type draws with exactly that type — the scene selector is never asked — and
        its pose picture is what is sent;
     3. "Automatic" goes through the scene selector as before;
     4. a regenerate (Retry) keeps the hand-picked type; automatic pictures are unaffected;
     5. an intimate type is not offered, and not honoured, for a scene with a minor in it.
   Run: node tests/img-scene-picker.browser.js */
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:process.env.SM_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage({viewport:{width:412,height:915}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file://'+require('path').resolve(__dirname,'..','index.html'));
  await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(600);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x||c).slice(0,900));} };

  await pg.evaluate(()=>{
    const uni=state.universes[0];
    state.imgRules=[{id:"r_talk",label:"Talking",when:"talk",cast:"player",pov:false,promptStyle:"",enabled:true},
                    {id:"r_hug",label:"Hug",when:"hug",cast:"player",pov:false,promptStyle:"",enabled:true},
                    {id:"r_off",label:"Switched off",when:"x",cast:"player",pov:false,promptStyle:"",enabled:false}];
    uni.locations=[{id:"L_cafe",name:"Vanadium Cafe",description:"A coffee bar.",residents:[],sublocations:[{id:"c1",name:"Entrance",entrance:true}]}];
    const mk=(id,n,subj,img,extra)=>Object.assign({id,name:n,universeId:uni.id,look:{subject:subj},image:img,instructions:"x",personality:"x"},extra||{});
    state.personas=[mk("p_sami","Sami","Man","data:S1"),mk("p_burcu","Burcu","Woman","data:U1",{poseRefs:{r_hug:["data:HUG"]}})];
    state.user="Emre"; state.key="k"; state.autoImg=false; state.userSubject="Man";
    const c=curChat(); c.universeId=uni.id; state.curUniverse=uni.id;
    window.playerRefs=()=>["data:E1"]; window._playerRefHolder=()=>({look:{subject:"Man"}});
    window.toDataUri=async u=>u;
    window.saveMsgImage=(m,u,cb)=>{ if(cb)cb(true); }; window.captureGalleryMedia=()=>{};
    state.atlasKey="test-key"; state.imgProvider="atlascloud"; state.imgModel="bytedance/seedream-v4.5/edit";
    window.__routed=0; window.__realPick=window.pickRule;
    window.pickRule=async(rules)=>{ window.__routed++; return rules.find(r=>r.id==="r_talk"); };
    window.chatCompletion=async(messages,model,opts)=>{ if(opts&&opts.dbg==="Image prompt writer")return "the man smiles"; return "{}"; };
    window.__n=0;
    window.fetch=async(u,o)=>{
      if(/generateImage$/.test(String(u))){ window.__body=JSON.parse(o.body); window.__n++;
        return {ok:true,status:200,json:async()=>({data:{id:"p"+window.__n,status:"completed",outputs:["https://out/"+window.__n+".png"]}})}; }
      return {ok:false,status:404,json:async()=>({}),text:async()=>""};
    };
    c.locationId="L_cafe"; c.location="Vanadium Cafe"; c.subId="c1"; c.subPos={}; c.presentIds=["p_sami","p_burcu"];
    c.presentIds.forEach(id=>c.subPos[id]="c1"); c.period="Midday"; c.gameDay=1;
    c.messages=[{mid:"u1",role:"user",content:'"Come here."',present:c.presentIds.slice()},
                {mid:"a1",role:"assistant",speaker:"Sami",speakerId:"p_sami",content:"*Sami opens his arms.*",present:c.presentIds.slice()}];
    c.imgPromptBy={}; c.imgWindowBy={}; c.lastImgRuleBy={}; c.imgContBy={};
    show('chat'); renderChat();
  });
  await pg.waitForTimeout(300);

  console.log("\n[1. the Generate icon opens the scene picker]");
  const P=await pg.evaluate(()=>{
    const btn=document.querySelector('.bubble[data-mid="a1"] .msgActions [data-genimg]'); if(!btn)return {btn:false};
    btn.click();
    const ov=document.getElementById('scenePickModal');
    const rows=ov?Array.from(ov.querySelectorAll('[data-scene]')).map(x=>({id:x.getAttribute('data-scene'),t:x.textContent.replace(/\s+/g," ").trim()})):[];
    return {btn:true,open:!!(ov&&ov.classList.contains('open')||ov&&getComputedStyle(ov).display!=="none"),rows,generated:window.__n};
  });
  ok("tapping Generate opens the picker and draws nothing yet", P.btn&&P.open&&P.generated===0, JSON.stringify(P));
  ok("Automatic comes first, then every enabled scene type", JSON.stringify(P.rows.map(r=>r.id))==='["","r_talk","r_hug"]'&&/Automatic/.test(P.rows[0].t), JSON.stringify(P.rows));
  ok("a scene type with a pose picture says whose", /Hug · pose picture: Burcu/.test(P.rows[2].t)&&!/pose picture/.test(P.rows[1].t), JSON.stringify(P.rows));

  console.log("\n[2. a picked scene type skips the scene selector]");
  const H=await pg.evaluate(async()=>{
    window.__routed=0;
    document.querySelector('#scenePickModal [data-scene="r_hug"]').click();
    for(let i=0;i<60&&curChat().messages[1].imgState!=="done"&&curChat().messages[1].imgState!=="error";i++)await new Promise(r=>setTimeout(r,50));
    const m=curChat().messages[1];
    return {state:m.imgState,err:m.imgErr||"",routed:window.__routed,rule:m.imgRule,forced:m.imgForcedRule,images:(window.__body||{}).images||[]};
  });
  ok("it generated with the picked type", H.state==="done"&&H.rule==="Hug", JSON.stringify(H));
  ok("the scene selector was never asked", H.routed===0, JSON.stringify(H));
  ok("and that type's pose picture is what was sent — last, after the speaker's and the player's faces (v150.11)", JSON.stringify(H.images)==='["data:S1","data:E1","data:HUG"]', JSON.stringify(H.images));

  console.log("\n[3. a regenerate keeps it; Automatic goes back to the selector]");
  const R=await pg.evaluate(async()=>{ window.__routed=0; await illustrate("a1",curChat().messages[1].content,true); const m=curChat().messages[1]; return {routed:window.__routed,rule:m.imgRule}; });
  ok("Retry / a new frame keeps the hand-picked type", R.routed===0&&R.rule==="Hug", JSON.stringify(R));
  const A=await pg.evaluate(async()=>{ window.__routed=0; pickSceneAndIllustrate("a1"); document.querySelector('#scenePickModal [data-scene=""]').click();
    for(let i=0;i<60&&window.__routed===0;i++)await new Promise(r=>setTimeout(r,50));
    await new Promise(r=>setTimeout(r,300)); const m=curChat().messages[1]; return {routed:window.__routed,rule:m.imgRule,forced:m.imgForcedRule||null}; });
  ok("Automatic asks the scene selector and clears the hand-picked type", A.routed===1&&A.rule==="Talking"&&A.forced===null, JSON.stringify(A));
  const AUTO=await pg.evaluate(async()=>{ const c=curChat(); c.messages.push({mid:"a2",role:"assistant",speaker:"Sami",speakerId:"p_sami",content:"*He waves.*",present:c.presentIds.slice()});
    window.__routed=0; await illustrate("a2","*He waves.*"); return window.__routed; });
  ok("an automatic picture still goes through the scene selector", AUTO===1, String(AUTO));

  console.log("\n[4. never an intimate type for a scene with a minor]");
  const M=await pg.evaluate(async()=>{
    state.imgRules.find(r=>r.id==="r_hug").intimate=true;
    const keep=window._imgIsMinor; window._imgIsMinor=c=>!!(c&&c.id==="p_burcu");
    pickSceneAndIllustrate("a1");
    const ids=Array.from(document.querySelectorAll('#scenePickModal [data-scene]')).map(x=>x.getAttribute('data-scene'));
    closeModal('scenePickModal');
    window.__routed=0; await illustrate("a1",curChat().messages[1].content,true,{ruleId:"r_hug"});
    const m=curChat().messages[1];
    window._imgIsMinor=keep; delete state.imgRules.find(r=>r.id==="r_hug").intimate;
    return {ids,routed:window.__routed,rule:m.imgRule,intimate:_imgRuleIntimate({id:"r_hug",intimate:true})};
  });
  ok("an intimate type is not offered", M.intimate===false||M.ids.indexOf("r_hug")<0, JSON.stringify(M));
  ok("and is not honoured if asked for: the selector picks a safe type", M.intimate===false||(M.routed===1&&M.rule==="Talking"), JSON.stringify(M));

  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log("\n  "+pass+" passed, "+fail+" failed");
  await b.close();
  process.exit(fail?1:0);
})();
