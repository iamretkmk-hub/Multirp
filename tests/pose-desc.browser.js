/* v150.76 — WHAT A POSE PICTURE SHOWS.
   Asked: "Add an image description feature like the one we have for videos, but an image has just one description. Say
   I've put 4 pose pictures on one image scene type: they're all that scene, but each one is different. When one is picked
   at random, it should also say what's on screen. Unlike the video cues, it doesn't trigger a response. It's just
   information that takes its place in the characters' dialogue history."
   Checked:
     1. the scene type's editor has one box per pose picture ("Picture N — what it shows"); typing saves to rule.poseDesc at
        once, keyed by the picture's id; removing a picture removes its line;
     2. a scene picture drawn from pose 2 of 3 (a real illustrate(), the provider stubbed) stores that picture's line on the
        message, {{char}} and {{user}} filled (poseDesc, poseRuleId, poseId); the image prompt writer is told
        "This pose picture shows: …" (an editable prompt); the debug row says it too; no reply is started;
     3. the next reply's transcript carries "[ON SCREEN — a picture, not spoken by anyone] …" right after the line the
        picture belongs to, once (a real sendMessage); the wording is an editable piece (pose_on_screen, {{what}}) listed
        under Other wording; it takes no turn's place under the history cap;
     4. a picture with no line, a failed picture and a scene type with no pose pictures leave the transcript exactly as it was;
     5. a selfie by text: the writer gets the line, the photo message and her text's transcript do not (her own description
        stays the one that counts).
   Run: node tests/pose-desc.browser.js */
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
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x===undefined?c:x).slice(0,900));} };

  await pg.evaluate(async()=>{
    window.__sleep=ms=>new Promise(r=>setTimeout(r,ms));
    const uni=state.universes[0];
    uni.locations=[{id:"L_flat",name:"The Flat",description:"A small flat.",residents:[],sublocations:[{id:"s1",name:"Bedroom",entrance:true,description:"A bed."}]}];
    state.personas=[{id:"p_s",name:"Selin",universeId:uni.id,look:{subject:"Woman"},image:"data:image/png;base64,FACE",
      instructions:"x",personality:"Warm.",backstory:"x",style:"x",goals:"x"}];
    Object.assign(state,{user:"Emre",key:"k",autoImg:false,userSubject:"Man",textsOn:true,mem:false,emoOn:false,imgDecOn:false,routeOn:false,
      memJudgeOn:false,replyCheckOn:false,trackDecOn:false,gateOn:false,autoRpOn:false,
      atlasKey:"test-key",imgProvider:"atlascloud",imgModel:"bytedance/seedream-v4.5/edit"});
    state.curUniverse=uni.id;
    state.imgRules=[
      {id:"r_kneel",label:"Kneeling",when:"x",cast:"player",pov:true,promptStyle:"",enabled:true,use:"both",selfieNote:"KNEEL-NOTE"},
      {id:"r_talk",label:"Talking",when:"x",cast:"player",pov:false,promptStyle:"",enabled:true}];
    const r=state.imgRules[0];
    await rulePoseAdd(r,"data:POSE0"); await rulePoseAdd(r,"data:POSE1"); await rulePoseAdd(r,"data:POSE2");
    window.playerRefs=()=>["data:EMRE"]; window._playerRefHolder=()=>({look:{subject:"Man"}});
    window.toDataUri=async u=>u;
    window.saveMsgImage=(m,u,cb)=>{ if(cb)cb(true); }; window.captureGalleryMedia=()=>{};
    window.__toasts=[]; window.toast=t=>{ __toasts.push(String(t)); };
    window.__calls=[]; window.__imgFail=false; window.__n=0;
    window.chatCompletion=async(msgs,model,opts)=>{ const d=(opts&&opts.dbg)||"";
      __calls.push({dbg:d,msgs});
      if(d==="Image prompt writer")return "the frame";
      if(/^Roleplay reply/.test(d))return '"Buradayım."';
      if(/^Selfie writer/.test(d))return "I'm on my knees on the bedroom rug, phone held above me.";
      if(/^Selfie image prompt writer/.test(d))return "the woman in IMAGE 1 kneeling on a rug";
      if(/^Text reply/.test(d))return "Bunu sana.";
      return "{}";
    };
    window.fetch=async(u,o)=>{
      const url=String(u);
      if(/generateImage$/.test(url)){ window.__n++;
        if(window.__imgFail)return {ok:false,status:500,json:async()=>({message:"provider down"}),text:async()=>"provider down"};
        return {ok:true,status:200,json:async()=>({data:{id:"g"+window.__n,status:"completed",outputs:["https://out/"+window.__n+".png"]}})}; }
      if(url.indexOf("/api/alpha/decisions")>-1)return new Response(JSON.stringify({answers:{}}),{status:200});
      return new Response("{}",{status:404});
    };
    window.pickRule=async()=>window.__rule;
    const c=curChat(); Object.assign(c,{universeId:uni.id,locationId:"L_flat",location:"The Flat",subId:"s1",subPos:{p_s:"s1"},presentIds:["p_s"],
      period:"Evening",gameDay:1,messages:[],imgPromptBy:{},imgWindowBy:{},lastImgRuleBy:{},imgContBy:{},dnd:false});
    markChatDirty(c);
    window.__sel=()=>state.personas.find(p=>p.id==="p_s");
    window.__hist=()=>castHistory(curChat(),__sel()).map(m=>m.role+"|"+(m.name||"")+"|"+m.content);
    window.__draw=async(a)=>{
      const c=curChat(); window.__rule=state.imgRules.find(r=>r.id===a.rule);
      const m=a.mid?c.messages.find(x=>x.mid===a.mid):null;
      const msg=m||{mid:"m"+c.messages.length,role:"assistant",speaker:"Selin",speakerId:"p_s",content:a.line||"*She kneels in front of him.* Böyle mi?",present:["p_s"]};
      if(!m)c.messages.push(msg);
      const n0=__calls.filter(x=>/^Roleplay reply/.test(x.dbg)).length;
      const keep=window._poseRoll; if(a.roll!=null)window._poseRoll=()=>a.roll;
      await illustrate(msg.mid,msg.content,true);
      window._poseRoll=keep;
      const w=__calls.filter(x=>x.dbg==="Image prompt writer").pop();
      const log=dbgLog.slice().reverse().find(x=>x&&/pose presets/.test(x.label||""));
      return {mid:msg.mid,state:msg.imgState,poseDesc:msg.poseDesc,poseRuleId:msg.poseRuleId,poseId:msg.poseId,
        usr:w?w.msgs.filter(x=>x.role==="user").map(x=>x.content).join("\n"):"",log:log?String(log.result||""):"",
        replies:__calls.filter(x=>/^Roleplay reply/.test(x.dbg)).length-n0};
    };
  });

  console.log("\n[1. the editor: one box per pose picture]");
  const E=await pg.evaluate(async()=>{
    show('settings'); renderRules('img'); toggleRuleOpen('img','r_kneel'); await __sleep(400);
    const r=state.imgRules.find(x=>x.id==="r_kneel"), ids=rulePoseIds(r);
    const tas=[...document.querySelectorAll('#imgRuleList [data-pose-desc]')];
    const labels=[...document.querySelectorAll('#imgRuleList .rulePoseDescs label')].map(l=>l.textContent.replace(/\s+/g," ").trim());
    const ph=tas[0]?tas[0].getAttribute('placeholder'):"";
    const ta2=document.querySelector('#imgRuleList [data-pose-desc="'+ids[1]+'"]');
    ta2.value="{{char}} kneels in front of {{user}}, looking up at him"; ta2.dispatchEvent(new Event('input'));
    const ta3=document.querySelector('#imgRuleList [data-pose-desc="'+ids[2]+'"]');
    ta3.value="THIRD"; ta3.dispatchEvent(new Event('input'));
    const saved=((store.get(K.imgRules,[])||[]).find(x=>x.id==="r_kneel")||{}).poseDesc||{};
    const savedNow={two:saved[ids[1]],three:saved[ids[2]],one:(ids[0] in saved)};
    // × on picture 3 removes it and its line
    document.querySelector('#imgRuleList .rulePoses [data-pose="'+ids[2]+'"] .rsDel').click(); await __sleep(400);
    const after=((store.get(K.imgRules,[])||[]).find(x=>x.id==="r_kneel")||{}).poseDesc||{};
    const boxes=document.querySelectorAll('#imgRuleList [data-pose-desc]').length;
    const kept=(document.querySelector('#imgRuleList [data-pose-desc="'+ids[1]+'"]')||{}).value;
    // emptying a box drops its entry
    const ta1=document.querySelector('#imgRuleList [data-pose-desc="'+ids[0]+'"]'); ta1.value="x"; ta1.dispatchEvent(new Event('input'));
    ta1.value="  "; ta1.dispatchEvent(new Event('input'));
    // put a third picture back (no line on it) for the draws below
    await rulePoseAdd(r,"data:POSE2b");
    return {n:tas.length,labels,ph,savedNow,threeGone:!(ids[2] in after)&&!(ids[2] in (r.poseDesc||{})),twoKept:after[ids[1]],boxes,kept,
      emptyDropped:!(ids[0] in (r.poseDesc||{})),ids};
  });
  ok("one box per picture, labelled Picture N — what it shows (optional), with a placeholder",
     E.n===3&&/^Picture 1 — what it shows \(optional\)$/.test(E.labels[0])&&/^Picture 3 — what it shows/.test(E.labels[2])&&/\{\{char\}\}/.test(E.ph), JSON.stringify(E));
  ok("typing saves to rule.poseDesc at once, keyed by the picture's id", E.savedNow.two==="{{char}} kneels in front of {{user}}, looking up at him"&&E.savedNow.three==="THIRD"&&E.savedNow.one===false, JSON.stringify(E.savedNow));
  ok("removing a picture removes its line (and the box), the others stay", E.threeGone===true&&/kneels in front/.test(E.twoKept||"")&&E.boxes===2&&/kneels in front/.test(E.kept||""), JSON.stringify(E));
  ok("an emptied box keeps no entry", E.emptyDropped===true, JSON.stringify(E));

  console.log("\n[2. a scene picture drawn from pose 2 of 3]");
  const base=await pg.evaluate(()=>{ curChat().messages=[{mid:"u0",role:"user",content:"Diz çök.",present:["p_s"]}]; return __hist(); });
  const D=await pg.evaluate(()=>__draw({rule:"r_kneel",roll:1}));
  ok("the picture is posted", D.state==="done", JSON.stringify(D));
  ok("the message keeps that picture's line, names filled (poseDesc, poseRuleId, poseId)",
     D.poseDesc==="Selin kneels in front of Emre, looking up at him"&&D.poseRuleId==="r_kneel"&&D.poseId===E.ids[1], JSON.stringify(D));
  ok("the image prompt writer is told what the pose picture shows, under the pose block",
     /POSE REFERENCE[\s\S]*\nThis pose picture shows: Selin kneels in front of Emre, looking up at him\n/.test(D.usr), D.usr.slice(0,1400));
  ok("the debug row says it too", /pose picture 2 of 3 last — it shows: Selin kneels in front of Emre/.test(D.log), D.log);
  ok("no reply is started by the picture", D.replies===0, JSON.stringify(D.replies));
  const WP=await pg.evaluate(()=>{ const reg=(typeof PROMPT_BY_KEY!=="undefined")&&PROMPT_BY_KEY.x_img_pose_shows;
    return {reg:!!reg,def:up("x_img_pose_shows")}; }).catch(e=>({err:String(e)}));
  ok("the writer's line is a registry prompt with {{what}}", WP.reg===true&&WP.def==="This pose picture shows: {{what}}", JSON.stringify(WP));

  console.log("\n[3. the next reply's transcript]");
  const H=await pg.evaluate(()=>__hist());
  const iLine=H.findIndex(l=>/Böyle mi\?/.test(l)), iShow=H.findIndex(l=>/ON SCREEN/.test(l));
  ok("the ON SCREEN line stands right after the line the picture belongs to",
     iLine>-1&&iShow===iLine+1&&H[iShow]==="user|Narrator|[ON SCREEN — a picture, not spoken by anyone] Selin kneels in front of Emre, looking up at him", H.join("\n"));
  ok("exactly one, and everything else is as it was", H.filter(l=>/ON SCREEN/.test(l)).length===1&&H.length===base.length+2, H.join("\n")+"\n--- before:\n"+base.join("\n"));
  const R=await pg.evaluate(async()=>{
    const n0=__calls.filter(x=>/^Roleplay reply/.test(x.dbg)).length;
    try{ const res=await Promise.race([sendMessage({text:"Evet, böyle."}).then(()=>"done"),new Promise(r=>setTimeout(()=>r("TIMEOUT"),60000))]);
      if(res!=="done")return {err:"the turn did not finish"}; }catch(e){ return {err:"threw "+e.message}; }
    const rp=__calls.filter(x=>/^Roleplay reply/.test(x.dbg));
    const sent=(rp[rp.length-1]||{msgs:[]}).msgs.map(m=>({role:m.role,content:String(m.content)}));
    return {n:rp.length-n0,sent};
  });
  const S=(R.sent||[]);
  const sLine=S.findIndex(m=>/Böyle mi\?/.test(m.content)&&!/ON SCREEN/.test(m.content)), sShow=S.findIndex(m=>/^\[ON SCREEN — a picture, not spoken by anyone\] Selin kneels in front of Emre/.test(m.content)),
        sNew=S.findIndex(m=>/Evet, böyle\./.test(m.content));
  ok("a real reply: its payload carries the line at the picture's place, before the player's new line",
     !R.err&&sShow>-1&&sLine>-1&&sShow===sLine+1&&sNew>sShow&&S[sShow].role==="user", JSON.stringify(R.err||S.map(m=>m.role+": "+m.content.slice(0,80))).slice(0,1500));
  ok("once, and only that one reply was asked for (the line starts no turn)", R.n===1&&S.filter(m=>/ON SCREEN/.test(m.content)).length===1, JSON.stringify({n:R.n}));
  const T=await pg.evaluate(()=>{
    state.blockTpls=state.blockTpls||{}; state.blockTpls.pose_on_screen="(on the screen: {{what}})";
    const h=__hist().filter(l=>/on the screen:/.test(l)); delete state.blockTpls.pose_on_screen;
    let box=false; try{ renderOtherWording(); box=!!document.querySelector('#otherWordingList textarea[data-btpl="pose_on_screen"]'); }catch(e){}
    return {h,box,listed:Object.keys(REPLY_EXTRA_TPLS).some(k=>REPLY_EXTRA_TPLS[k].includes("pose_on_screen")),def:BLOCK_TPL_DEFAULTS.pose_on_screen};
  });
  ok("the wording is editable (pose_on_screen, {{what}})", T.h.length===1&&T.h[0]==="user|Narrator|(on the screen: Selin kneels in front of Emre, looking up at him)", JSON.stringify(T));
  ok("and listed under Other wording, with its box", T.listed===true&&T.box===true&&T.def==="[ON SCREEN — a picture, not spoken by anyone] {{what}}", JSON.stringify(T));
  const CAP=await pg.evaluate(()=>{ const keep=state.histTurns; state.histTurns=3;
    const h=castHistory(curChat(),__sel()); state.histTurns=keep;
    return {n:h.length,show:h.filter(m=>/ON SCREEN/.test(m.content)).length,lines:h.map(m=>m.content.slice(0,50))}; });
  ok("it takes no turn's place under the history cap", CAP.n===CAP.show+3, JSON.stringify(CAP));
  const MEM=await pg.evaluate(()=>{ const s=new Set(); castHistory(curChat(),__sel(),{mids:s});
    return {ids:[...s],all:[...s].every(id=>curChat().messages.some(m=>m.mid===id))}; });
  ok("the transcript's message ids are the messages' own (the line is not a message)", MEM.all===true&&MEM.ids.length>0, JSON.stringify(MEM));

  console.log("\n[4. nothing changes without a line]");
  const N=await pg.evaluate(async()=>{
    const c=curChat(); c.messages=[{mid:"u0",role:"user",content:"Diz çök.",present:["p_s"]}];
    const before=JSON.stringify(castHistory(c,__sel()));
    const d0=await __draw({rule:"r_kneel",roll:0,line:"*She kneels.*"});   // picture 1: no line
    const afterNoLine=castHistory(c,__sel());
    const t=await __draw({rule:"r_talk",line:"*She sits down.*"});            // no pose pictures at all
    const afterTalk=castHistory(c,__sel());
    // the same message, with and without its picture's fields, maps the same
    const strip=JSON.stringify(castHistory(Object.assign({},c,{messages:c.messages.map(m=>{ const x=Object.assign({},m); ["img","imgSrc","imgState","imgPrompt","imgCore","imgPose","imgPoseIdx","imgPoseId","imgRule","imgRuleId","imgMeta","ratio","characterId","imgStored"].forEach(k=>delete x[k]); return x; })}),__sel()));
    // a picture that fails keeps nothing, even where the draw would have had a line
    window.__imgFail=true; const f=await __draw({rule:"r_kneel",roll:1,line:"*She kneels again.*"}); window.__imgFail=false;
    const afterFail=castHistory(c,__sel());
    // a regenerate with a picture that has no line takes the old line off
    const g1=await __draw({rule:"r_kneel",roll:1,line:"*Once more.*"}); const had=g1.poseDesc;
    const g2=await __draw({rule:"r_kneel",roll:0,mid:g1.mid});
    return {d0:d0.poseDesc===undefined&&d0.state==="done",noLineSame:!afterNoLine.some(m=>/ON SCREEN/.test(m.content)),
      talk:t.poseDesc===undefined,afterTalk:!afterTalk.some(m=>/ON SCREEN/.test(m.content)),
      same:JSON.stringify(afterTalk)===strip,
      fail:f.state==="error"&&f.poseDesc===undefined&&f.poseRuleId===undefined&&!afterFail.some(m=>/ON SCREEN/.test(m.content)),
      noWriterLine:!/This pose picture shows/.test(d0.usr),
      regen:!!had&&g2.poseDesc===undefined&&g2.poseId===undefined, before:before.length};
  });
  ok("a pose picture with no line: nothing stored, nothing in the transcript, nothing told the writer", N.d0===true&&N.noLineSame===true&&N.noWriterLine===true, JSON.stringify(N));
  ok("a scene type with no pose pictures: nothing", N.talk===true&&N.afterTalk===true, JSON.stringify(N));
  ok("an image message with no line maps exactly as the same message without a picture", N.same===true, JSON.stringify(N));
  ok("a picture that fails keeps nothing", N.fail===true, JSON.stringify(N));
  ok("a new picture without a line takes the old line off", N.regen===true, JSON.stringify(N));

  console.log("\n[5. a selfie by text: the writer yes, the history no]");
  const SF=await pg.evaluate(async()=>{
    const c=curChat(); c.presentIds=[]; c.messages=[]; c.location="Emre's House"; c.locationId=null;
    window.resolveWorldPositions=()=>({p_s:"L_flat"});
    const r=state.imgRules.find(x=>x.id==="r_kneel"), ids=rulePoseIds(r);
    r.poseDesc={}; r.poseDesc[ids[0]]="{{char}} kneels, phone held up, for {{user}}";
    state.imgRules=[r];
    window.selfiePickDecision=async()=>({rule:r});
    window.__calls=[];
    openTextWith("p_s"); togglePhotoRequest();
    document.getElementById('textPopInput').value="bir foto?";
    const keep=window._poseRoll; window._poseRoll=()=>0;
    _sendFromTextPop();
    for(let i=0;i<160&&!__calls.some(x=>/^Text reply/.test(x.dbg));i++) await __sleep(50);
    await __sleep(200); window._poseRoll=keep;
    const w=__calls.filter(x=>/^Selfie image prompt writer/.test(x.dbg)).pop();
    const usr=w?w.msgs.filter(m=>m.role==="user").map(m=>m.content).join("\n"):"";
    const photo=textThreadMsgs(c,"p_s").find(m=>m.selfie);
    const reply=(__calls.filter(x=>/^Text reply/.test(x.dbg)).pop()||{msgs:[]}).msgs.map(m=>String(m.content)).join("\n");
    const hist=castHistory(c,__sel(),{textReply:true}).map(m=>m.content).join("\n");
    const log=dbgLog.slice().reverse().find(x=>x&&/pose presets/.test(x.label||""));
    return {usr,photo:photo?{poseDesc:photo.poseDesc,poseRuleId:photo.poseRuleId,poseId:photo.poseId,desc:photo.selfie&&photo.selfie.desc}:null,
      replyOn:/ON SCREEN/.test(reply),histOn:/ON SCREEN/.test(hist),histPhoto:/sent a photo: I'm on my knees/.test(hist),log:log?String(log.result||""):""};
  });
  ok("the selfie's image prompt writer is told what the pose picture shows (her name and the player's filled)",
     /\nThis pose picture shows: Selin kneels, phone held up, for Emre\n/.test(SF.usr), SF.usr.slice(0,1200));
  ok("the photo message keeps her own description and no pose line", !!SF.photo&&SF.photo.poseDesc===undefined&&SF.photo.poseRuleId===undefined&&/on my knees/.test(SF.photo.desc||""), JSON.stringify(SF.photo));
  ok("her text's payload and transcript carry her description, never an ON SCREEN line", SF.replyOn===false&&SF.histOn===false&&SF.histPhoto===true, JSON.stringify(SF));
  ok("the selfie's debug row says what it shows", /it shows: Selin kneels, phone held up/.test(SF.log), SF.log);

  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log("\n  "+pass+" passed, "+fail+" failed");
  await b.close();
  process.exit(fail?1:0);
})();
