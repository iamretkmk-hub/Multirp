/* v150.74 — ASKING FOR A PHOTO BY TEXT.
   Asked: "Selfie during text messages. A Request Photo button on the text screen; she gets a list of options — reject, or
   the selfie poses in the image section (only the presets tagged selfie). She decides how she will do the pose and writes
   it as herself; that goes to the image prompt writer and the image is created. After the image she sends an RP message
   about it — she knows what her pose is." And: "Add auto download option after selfie."
   Checked:
     1. the Selfie tag and its pose text persist with the scene type; only enabled Selfie types are offered, and the scene
        selector never picks one for an in-person frame;
     2. the composer: the image button arms a photo request (chip, placeholder, × cancels), the text goes out tagged
        photoRequest with a camera mark, empty words allowed; no button outside the text window; no Selfie types → a toast;
     3. the Decisions pick: reject + each Selfie type with its text; the state carries who she is, her feelings toward the
        one asking, the people she answers to, her limits, where she is and who is around, what she has on, the request
        and the thread;
     4. reject: no writer, no image; her reply payload carries the refusal note;
     5. accept: the selfie writer gets the pose text, the place and the clothing; the image prompt writer gets her words; her
        face then the pose picture last; her photo is posted before her text, stores `selfie`; her text carries her words;
        the memory tracker reads the photo;
     6. the Decisions request fails: the chat model picks; both fail: no photo, no note;
     7. the picture fails: a notice under the request, no photo, no photo note;
     8. auto download: the switch persists; on (not iOS) saveMedia is called once with the photo's record; off it is not;
        on iOS it is not called by itself, and the bubble's Save button calls it on a tap.
   Run: node tests/selfie-request.browser.js */
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:process.env.SM_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage({viewport:{width:412,height:915}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file://'+require('path').resolve(__dirname,'..','index.html')); await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(800);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x===undefined?c:x).slice(0,900));} };

  await pg.evaluate(()=>{
    window.__sleep=ms=>new Promise(r=>setTimeout(r,ms));
    window.__DESC="I'm standing at the bedroom mirror in my red sundress, phone held up in front of my face, one hip out.";
    window.__setup=async(o)=>{
      o=o||{};
      const uni=state.universes[0];
      uni.locations=[{id:"L_flat",name:"Burcu's Flat",description:"A small flat above a bakery.",residents:[],
        sublocations:[{id:"s1",name:"Bedroom",entrance:false,description:"A bed with white sheets and a tall mirror."},{id:"s2",name:"Kitchen",entrance:true,description:"A narrow kitchen."}]}];
      state.personas=[{id:"p_b",name:"Burcu",universeId:uni.id,look:{subject:"Woman"},image:"data:image/png;base64,FACE",
        personality:"Playful, a little guarded.",backstory:"Works at the bakery.",wardrobe:"a red sundress",instructions:"x"}];
      Object.assign(state,{user:"Emre",key:"k",textsOn:true,mem:!!o.mem,emoOn:false,imgDecOn:true,routeOn:true,
        atlasKey:"test-key",imgProvider:"atlascloud",imgModel:Object.keys(ATLAS_EDIT_MODELS).find(k=>ATLAS_EDIT_MODELS[k].maxRefs>=2),selfieAutoSave:!!o.autoSave,userSubject:"Man"});
      state.curUniverse=uni.id;
      state.imgRules=[
        {id:"r_talk",label:"Talking",when:"two people talk",cast:"player",enabled:true,promptStyle:""},
        {id:"r_mirror",label:"Mirror selfie",when:"x",cast:"solo",enabled:true,selfie:true,selfieNote:"MIRROR-NOTE: standing at a mirror; she may change the room and her outfit",promptStyle:""},
        {id:"r_bed",label:"Bed selfie",when:"x",cast:"solo",enabled:true,selfie:true,selfieNote:"BED-NOTE: lying on her back on a bed",promptStyle:""},
        {id:"r_off",label:"Off selfie",when:"x",cast:"solo",enabled:false,selfie:true,selfieNote:"OFF-NOTE"}];
      if(o.noSelfie) state.imgRules.forEach(r=>{ r.selfie=false; });
      await rulePoseAdd(state.imgRules[1],"data:image/png;base64,POSE");
      try{ _selfieDecBreak.until=0; _selfieDecBreak.fails=0; }catch(e){}
      const c=curChat(); Object.assign(c,{universeId:uni.id,presentIds:[],dnd:false,gameDay:2,period:"Evening",location:"Emre's House",locationId:null,subPos:{p_b:"s1"},
        messages:[{mid:"x0",role:"assistant",speaker:"Burcu",speakerId:"p_b",content:"Evdeyim, sıkıldım.",textMsg:true,textWith:"p_b",present:[],gday:2,gperiod:"Evening"}]});
      window.resolveWorldPositions=()=>({p_b:"L_flat"});
      window.playerRefs=()=>["data:image/png;base64,EMRE"];
      window.toDataUri=async u=>u;
      window.saveMsgImage=(m,u,cb)=>{ if(cb)cb(true); }; window.captureGalleryMedia=()=>{};
      window.__toasts=[]; window.toast=t=>{ __toasts.push(String(t)); };
      window.__saved=[]; window.saveMedia=async(url,name,recId,mid)=>{ __saved.push({url,name,recId,mid}); return true; };
      window.__reqs=[]; window.__calls=[]; window.__imgBodies=[];
      window.__decMode=o.decMode||"ok"; window.__pick=o.pick||{type:"choice",choice:"s0",probabilities:{reject:0.1,s0:0.8,s1:0.1}};
      window.__chatPick=o.chatPick||"1"; window.__imgFail=!!o.imgFail;
      window.fetch=async(u,op)=>{
        const url=String(u);
        if(url.indexOf("/api/alpha/decisions")>-1){ const body=JSON.parse(op.body); __reqs.push(body);
          if(body.questions&&body.questions.photo){
            if(__decMode==="500")return new Response(JSON.stringify({error:{message:"boom"}}),{status:500});
            return new Response(JSON.stringify({answers:{photo:__pick}}),{status:200}); }
          return new Response(JSON.stringify({answers:{}}),{status:200}); }
        if(/generateImage$/.test(url)){ __imgBodies.push(JSON.parse(op.body));
          if(__imgFail)return new Response(JSON.stringify({message:"provider down"}),{status:500});
          return new Response(JSON.stringify({data:{id:"g1",status:"completed",outputs:["data:image/png;base64,OUT"]}}),{status:200}); }
        return new Response("{}",{status:404});
      };
      window.chatCompletion=async(msgs,model,opts)=>{ const d=(opts&&opts.dbg)||"";
        __calls.push({dbg:d,msgs});
        if(/^Selfie pick \(chat model\)/.test(d)){ if(__chatPick==="throw")throw {friendly:"down"}; return __chatPick; }
        if(/^Selfie writer/.test(d))return __DESC;
        if(/^Selfie image prompt writer/.test(d))return "replace the woman in the pose reference with the woman in IMAGE 1, at a bedroom mirror";
        if(/^Text reply/.test(d))return "Here, just for you.";
        if(/^Memory arc tracker/.test(d))return '{"progress":"ongoing","topic":"same","summary":"x"}';
        return "{}";
      };
      markChatDirty(c);
      return c;
    };
    window.__send=async(body,photo)=>{
      const c=curChat(), p=state.personas[0];
      openTextWith("p_b");
      if(photo){ togglePhotoRequest(); }
      document.getElementById('textPopInput').value=body;
      _sendFromTextPop();
      for(let i=0;i<120&&!__calls.some(x=>/^Text reply/.test(x.dbg));i++) await __sleep(50);
      await __sleep(150);
      const th=textThreadMsgs(c,"p_b");
      const reply=(__calls.filter(x=>/^Text reply/.test(x.dbg)).pop()||{msgs:[]}).msgs.map(m=>String(m.content)).join("\n");
      return {c,th,reply};
    };
    window.__call=re=>__calls.filter(x=>re.test(x.dbg));
    window.__usr=c=>((c&&c.msgs)||[]).filter(m=>m.role==="user").map(m=>String(m.content)).join("\n");
  });

  console.log("\n[1. the Selfie tag on a scene type]");
  const T=await pg.evaluate(async()=>{
    await __setup();
    show('settings'); renderRules('img'); toggleRuleOpen('img','r_talk'); await __sleep(200);
    const box=document.querySelector('#imgRuleList [data-k="selfie"]'), note=document.querySelector('#imgRuleList [data-k="selfieNote"]');
    const had=!!box&&!!note;
    box.checked=true; box.dispatchEvent(new Event('change'));
    note.value="TALK-SELFIE-NOTE"; note.dispatchEvent(new Event('input'));
    const saved=(store.get(K.imgRules,[])||[]).find(r=>r.id==="r_talk")||{};
    const tag=document.querySelector('#imgRuleList .ruleName.selfieTag');
    box.checked=false; box.dispatchEvent(new Event('change'));
    const saved2=(store.get(K.imgRules,[])||[]).find(r=>r.id==="r_talk")||{};
    return {had,sel:saved.selfie,note:saved.selfieNote,tag:!!tag,off:saved2.selfie};
  });
  ok("the scene type's editor has a Selfie switch and a pose-text box", T.had===true, JSON.stringify(T));
  ok("both are kept with the rule at once", T.sel===true&&T.note==="TALK-SELFIE-NOTE"&&T.off===false, JSON.stringify(T));
  ok("the row says it is a selfie type", T.tag===true, JSON.stringify(T));
  ok("only enabled Selfie types are offered", await pg.evaluate(async()=>{ await __setup(); const ids=selfieRules(state.personas[0]).map(r=>r.id).join(",");
      return ids==="r_mirror,r_bed"?true:ids; }));
  const SR=await pg.evaluate(async()=>{ await __setup();
    window.__reqs=[]; const r=await pickRule(state.imgRules,"LATEST EXCHANGE:\nEmre: hi");
    const q=(__reqs.find(x=>x.questions&&x.questions.rule)||{questions:{rule:{criteria:{}}}}).questions.rule.criteria;
    state.routeOn=false; const first=await pickRule([state.imgRules[1],state.imgRules[0]],"x"); state.routeOn=true;
    return {crit:Object.values(q).join(" | "),first:first&&first.id,pickedSelfie:!!(r&&r.selfie)}; });
  ok("the scene selector is never offered a Selfie type", !/selfie/i.test(SR.crit)&&!SR.pickedSelfie, JSON.stringify(SR));
  ok("and with routing off a Selfie type listed first is passed over", SR.first==="r_talk", JSON.stringify(SR));

  console.log("\n[2. the composer]");
  const C=await pg.evaluate(async()=>{ await __setup();
    const outside=!document.getElementById('textPhotoBtn')&&!document.querySelector('.photoBtn');
    openTextWith("p_b");
    const btn=document.getElementById('textPhotoBtn'), chip=document.getElementById('textPhotoChip'), inp=document.getElementById('textPopInput');
    const before=chip.style.display;
    btn.click(); const armed=chip.style.display!=="none"&&inp.placeholder==="What kind of photo?"&&btn.classList.contains('armed');
    chip.querySelector('button').click(); const cancelled=chip.style.display==="none"&&!_photoReqArmed&&/Message Burcu/.test(inp.placeholder);
    closeTextPop(); const gone=!document.getElementById('textPhotoBtn');
    return {outside,before,armed,cancelled,gone}; });
  ok("no photo button outside the text window", C.outside===true&&C.gone===true, JSON.stringify(C));
  ok("the image button arms a photo request: chip, placeholder, the button lit", C.before==="none"&&C.armed===true, JSON.stringify(C));
  ok("× cancels it", C.cancelled===true, JSON.stringify(C));
  ok("no Selfie types: the button explains, and nothing is armed", await pg.evaluate(async()=>{ await __setup({noSelfie:true});
      openTextWith("p_b"); document.getElementById('textPhotoBtn').click(); const t=__toasts.join(" "); const armed=_photoReqArmed; closeTextPop();
      return (/tag one or more scene types as Selfie/.test(t)&&!armed)?true:JSON.stringify({t,armed}); }));

  console.log("\n[3–5. she sends one]");
  const A=await pg.evaluate(async()=>{ await __setup({mem:true});
    const r=await __send("show me what you're wearing",true);
    const req=r.th.find(m=>m.role==="user"&&m.photoRequest);
    const mark=!!document.querySelector('#textThread .txtPhotoMark');
    const q=(__reqs.find(x=>x.questions&&x.questions.photo)||{questions:{photo:{}},state:{}});
    const photoIdx=r.th.findIndex(m=>m.selfie), textIdx=r.th.findIndex(m=>m.role==="assistant"&&!m.selfie&&/just for you/.test(m.content)), reqIdx=r.th.indexOf(req);
    const ph=r.th[photoIdx]||{};
    const bubble=[...document.querySelectorAll('#textThread [data-tmid]')].map(n=>n.getAttribute('data-tmid'));
    const img=document.querySelector('#textThread img.txtPhoto');
    await __sleep(300);
    return {req:req?{photoRequest:req.photoRequest,content:req.content,photo:req.photo}:null,mark,
      crit:q.questions.photo.criteria,ins:q.questions.photo.instructions,st:q.state,
      writer:__usr(__call(/^Selfie writer/)[0]),imgWriter:__usr(__call(/^Selfie image prompt writer/)[0]),
      images:(__imgBodies[0]||{}).images||[],imgPrompt:(__imgBodies[0]||{}).prompt||"",
      order:[reqIdx,photoIdx,textIdx],selfie:ph.selfie||null,img:ph.img||"",bubble,imgEl:!!img,reply:r.reply,
      memTracker:__usr(__call(/^Memory arc tracker/)[0])+(__call(/^Memory arc tracker/)[0]||{msgs:[]}).msgs.map(m=>m.content).join("\n"),
      poseLog:(dbgLog.slice().reverse().find(x=>/pose presets/.test(x.label||""))||{}).result||"",
      dbgLabels:dbgLog.map(x=>x.label).filter(l=>/Selfie/.test(l)),
      hist:castHistory(r.c,state.personas[0],{textReply:true}).map(m=>m.content).join("\n")};
  });
  ok("the request is a text tagged photoRequest, shown with a camera mark", A.req&&A.req.photoRequest===true&&A.req.content==="show me what you're wearing"&&A.mark===true, JSON.stringify(A.req));
  ok("the pick: reject, then each enabled Selfie type with its name and its text", A.crit&&/^Reject: /.test(A.crit.reject)&&/^Mirror selfie: MIRROR-NOTE/.test(A.crit.s0)&&/^Bed selfie: BED-NOTE/.test(A.crit.s1)&&Object.keys(A.crit).length===3, JSON.stringify(A.crit));
  ok("its question is the editable prompt", /Does Burcu send a photo now/.test(A.ins||"")&&!/REJECT:/.test(A.ins||""), A.ins);
  const st=A.st||{};
  ok("the state: who she is", st.character&&st.character.name==="Burcu"&&/Playful/.test(st.character.personality), JSON.stringify(st.character));
  ok("…her feelings toward the one asking and the people she answers to", !!st.toward_the_one_asking&&Array.isArray(st.people_they_answer_to), JSON.stringify(st).slice(0,600));
  ok("…her limits on record", Array.isArray(st.limits_on_record), JSON.stringify(st.limits_on_record));
  ok("…where she is and who is around her (texting, not together)", /Burcu's Flat — Bedroom/.test(st.where_they_are)&&/texting, not together/.test(JSON.stringify(st.who_else_can_see_or_hear||"")), JSON.stringify({w:st.where_they_are,a:st.who_else_can_see_or_hear}));
  ok("…what she has on, the request and the thread", /red sundress/.test(st.what_they_have_on)&&/show me what you're wearing/.test(st.the_request)&&/Evdeyim/.test(JSON.stringify(st.text_thread)), JSON.stringify({w:st.what_they_have_on,r:st.the_request,t:st.text_thread}));
  ok("the selfie writer gets the pose text, the place and her clothes", /MIRROR-NOTE/.test(A.writer)&&/Burcu's Flat — Bedroom/.test(A.writer)&&/red sundress/.test(A.writer)&&/show me what you're wearing/.test(A.writer), A.writer.slice(0,900));
  ok("the image prompt writer gets her own words and the pose block", A.imgWriter.indexOf("I'm standing at the bedroom mirror in my red sundress")>-1&&/POSE REFERENCE/.test(A.imgWriter)&&/THIS PICTURE IS A PHOTO/.test(A.imgWriter), A.imgWriter.slice(0,900));
  ok("her face, then the pose picture last — and nobody else's face", JSON.stringify(A.images)==='["data:image/png;base64,FACE","data:image/png;base64,POSE"]', JSON.stringify(A.images));
  ok("the debug log names the pose picture sent", /pose picture 1 of 1 last/.test(A.poseLog), A.poseLog);
  ok("debug rows: the pick, the writer, the image prompt writer, the image", ["Selfie pick (Decisions) · Burcu","Selfie image · Burcu"].every(l=>A.dbgLabels.indexOf(l)>-1), JSON.stringify(A.dbgLabels));
  ok("on screen: the request, her photo, then her text", A.order[0]>=0&&A.order[0]<A.order[1]&&A.order[1]<A.order[2], JSON.stringify(A.order));
  ok("the photo message stores the scene type and her words", A.selfie&&A.selfie.ruleId==="r_mirror"&&A.selfie.name==="Mirror selfie"&&/bedroom mirror/.test(A.selfie.desc)&&A.img==="data:image/png;base64,OUT", JSON.stringify(A.selfie));
  ok("it is drawn as a photo bubble in the thread", A.imgEl===true, JSON.stringify(A.bubble));
  ok("the request records what came of it", A.req&&A.req.photo&&A.req.photo.state==="sent", JSON.stringify(A.req));
  ok("her text after it carries THE PHOTO YOU JUST SENT with her words", /# THE PHOTO YOU JUST SENT/.test(A.reply)&&/bedroom mirror in my red sundress/.test(A.reply)&&!/# A PHOTO Emre ASKED YOU FOR/.test(A.reply), A.reply.slice(-1500));
  ok("her history shows the photo by what it showed, the request as a photo request", /\(sent a photo: I'm standing at the bedroom mirror/.test(A.hist)&&/show me what you're wearing \(asking for a photo\)/.test(A.hist), A.hist.slice(-600));
  ok("the memory tracker reads that a photo was sent and what it showed", /\(sent a photo: I'm standing at the bedroom mirror/.test(A.memTracker), A.memTracker.slice(-700));

  console.log("\n[4. she refuses]");
  const R=await pg.evaluate(async()=>{ await __setup({pick:{type:"choice",choice:"reject",probabilities:{reject:0.7,s0:0.2,s1:0.1}}});
    const r=await __send("",true);
    const req=r.th.find(m=>m.photoRequest);
    return {writer:__call(/^Selfie writer/).length,img:__imgBodies.length,photos:r.th.filter(m=>m.selfie).length,reply:r.reply,state:req&&req.photo&&req.photo.state,content:req&&req.content,
      bubble:(document.querySelector('#textThread .txtPhotoMark')||{}).textContent||""}; });
  ok("empty words are allowed: the request is just a photo", R.content==="📷"&&/Photo request/.test(R.bubble), JSON.stringify(R));
  ok("a refusal: no writer, no image, no photo", R.writer===0&&R.img===0&&R.photos===0&&R.state==="refused", JSON.stringify(R));
  ok("her reply carries the refusal note, in character", /# A PHOTO Emre ASKED YOU FOR/.test(R.reply)&&/no words about what kind/.test(R.reply)&&/Never apologise or explain like an assistant/.test(R.reply)&&!/THE PHOTO YOU JUST SENT/.test(R.reply), R.reply.slice(-1200));

  console.log("\n[6. the Decisions request fails]");
  const F=await pg.evaluate(async()=>{ await __setup({decMode:"500",chatPick:"0"});
    const r=await __send("one pic?",true);
    return {chat:__call(/^Selfie pick \(chat model\)/).length,reply:r.reply,state:(r.th.find(m=>m.photoRequest)||{}).photo}; });
  ok("the chat model picks instead (here: reject)", F.chat===1&&F.state&&F.state.state==="refused"&&/# A PHOTO Emre ASKED YOU FOR/.test(F.reply), JSON.stringify({c:F.chat,s:F.state}));
  const F2=await pg.evaluate(async()=>{ await __setup({decMode:"500",chatPick:"throw"});
    const r=await __send("one pic?",true);
    return {writer:__call(/^Selfie writer/).length,img:__imgBodies.length,reply:r.reply,state:(r.th.find(m=>m.photoRequest)||{}).photo,replies:__call(/^Text reply/).length}; });
  ok("both fail: no photo this turn, she still answers, with no photo note", F2.writer===0&&F2.img===0&&F2.state&&F2.state.state==="none"&&F2.replies===1&&!/PHOTO/.test(F2.reply.replace(/asking for a photo/g,"")), JSON.stringify({s:F2.state,w:F2.writer,r:F2.replies}));

  console.log("\n[7. the picture fails]");
  const G=await pg.evaluate(async()=>{ await __setup({imgFail:true});
    const r=await __send("pic pls",true);
    return {photos:r.th.filter(m=>m.selfie).length,state:(r.th.find(m=>m.photoRequest)||{}).photo,reply:r.reply,
      notice:(document.getElementById('textThread')||{}).textContent||"",toasts:__toasts.join(" | ")}; });
  ok("no photo is posted; a notice under the request and a toast", G.photos===0&&G.state&&G.state.state==="failed"&&/The photo didn't go through/.test(G.notice)&&/didn't go through/.test(G.toasts), JSON.stringify({s:G.state,t:G.toasts}));
  ok("her text claims no photo", !/THE PHOTO YOU JUST SENT/.test(G.reply)&&!/# A PHOTO Emre ASKED YOU FOR/.test(G.reply), G.reply.slice(-800));

  console.log("\n[an ordinary text is untouched]");
  const O=await pg.evaluate(async()=>{ await __setup(); const r=await __send("nasılsın?",false);
    return {reply:r.reply,reqs:__reqs.filter(x=>x.questions&&x.questions.photo).length,mark:!!document.querySelector('#textThread .txtPhotoMark')}; });
  ok("no pick, no photo note, no camera mark", O.reqs===0&&!/PHOTO/.test(O.reply)&&O.mark===false, JSON.stringify({n:O.reqs,m:O.mark}));

  ok("a saved fragment list from before gets the photo fragment once, before 'Respond as', on the text path only", await pg.evaluate(()=>{
      const old=JSON.parse(JSON.stringify(FRAG_DEFAULTS)).filter(f=>f.id!=="photo");
      const done=FRAG_SHIPPED_ADDS.map(a=>a.key).filter(k=>k!=="v150.74.photo").join(",");
      store.setRaw(K.fragAdds,done); state.fragments=old; _fragMigratedFor=null;
      const L=fragList(), ids=L.map(f=>f.id), f=L.find(x=>x.id==="photo");
      const good=!!f&&ids.indexOf("photo")===ids.indexOf("respond_as")-1&&f.paths.join()==="text"&&f.options.map(o=>o.code).join()==="photo_refused,photo_sent";
      state.fragments=null; _fragMigratedFor=null; store.setRaw(K.fragments,"");
      return good?true:ids.join(","); }));

  console.log("\n[8. saving the photo]");
  ok("the switch round-trips through Settings, off by default", await pg.evaluate(()=>{ const def=store.raw(K.selfieAutoSave,"")!=="1";
      state.selfieAutoSave=false; syncSettingsUI(); const box=document.getElementById('setSelfieAutoSave');
      const a=box&&box.checked===false; box.checked=true; saveSettings(); const on=state.selfieAutoSave===true&&store.raw(K.selfieAutoSave,"")==="1";
      box.checked=false; saveSettings(); const off=store.raw(K.selfieAutoSave,"x")==="";
      return (def&&a&&on&&off)?true:JSON.stringify({def,a,on,off}); }));
  const D=await pg.evaluate(async()=>{ await __setup({autoSave:true}); const r=await __send("pic?",true); await __sleep(100);
    const ph=r.th.find(m=>m.selfie)||{}; const rec=(state.images||[]).find(x=>x&&x.selfieMid===ph.mid)||{};
    return {saved:__saved.slice(),recId:rec.id,photo:ph.img}; });
  ok("on (not iOS): saveMedia is called once, with the photo and its gallery record", D.saved.length===1&&D.saved[0].recId===D.recId&&!!D.recId&&D.saved[0].url===D.photo&&/^storymind-burcu-\d{8}-\d{6}\.png$/.test(D.saved[0].name), JSON.stringify(D));
  ok("off: it is not called", await pg.evaluate(async()=>{ await __setup({autoSave:false}); await __send("pic?",true); await __sleep(100);
      return __saved.length===0?true:JSON.stringify(__saved); }));
  const I=await pg.evaluate(async()=>{ await __setup({autoSave:true});
    const keep=Object.getOwnPropertyDescriptor(navigator,'userAgent');
    Object.defineProperty(navigator,'userAgent',{configurable:true,get:()=>"Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)"});
    const ios=_iosLike();
    const r=await __send("pic?",true); await __sleep(100);
    const auto=__saved.length;
    const btn=document.querySelector('#textThread .txtPhotoSave'); const label=btn?btn.textContent:"";
    if(btn)btn.click(); await __sleep(50);
    if(keep)Object.defineProperty(navigator,'userAgent',keep); else delete navigator.userAgent;
    return {ios,auto,label,tapped:__saved.length,rec:(__saved[0]||{}).recId||null}; });
  ok("on iOS it is not called by itself", I.ios===true&&I.auto===0, JSON.stringify(I));
  ok("the bubble's Save to Photos button calls it on a tap", /Save to Photos/.test(I.label)&&I.tapped===1&&!!I.rec, JSON.stringify(I));

  ok("no page errors", errs.length===0?true:errs.join(" | "));
  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close(); process.exit(fail?1:0);
})();
