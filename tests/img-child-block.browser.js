/* v150.13 — GIRL OR BOY MEANS NO PICTURES.
   Asked: "Change the underage image protection. In the character sheet we choose girl or boy. Prevent
   image generation if girl or boy is selected."
   Checked through a real illustrate() with the network stubbed:
     1. a speaker, someone else in the scene, or the player set as a girl or a boy: no request is sent,
        the message says why (no Retry), and a manual press says so too;
     2. man / woman: pictures as before;
     3. the existing check still holds alongside it: a character whose card gives an age under 18
        keeps the intimate scene types off the menu, whatever the selector says;
     4. the scene clip, the playground and the portrait generator are gated the same way.
   Run: node tests/img-child-block.browser.js */
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
    state.imgRules=[{id:"r_talk",label:"Talking",when:"x",cast:"player",pov:false,promptStyle:"",enabled:true},
                    {id:"r_intimate",label:"Intimate",when:"x",cast:"player",pov:false,promptStyle:"",enabled:true}];
    uni.locations=[{id:"L",name:"Park",description:"A park.",residents:[],sublocations:[{id:"s1",name:"Lawn",entrance:true}]}];
    const mk=(id,n,subj,extra)=>Object.assign({id,name:n,universeId:uni.id,look:{subject:subj},image:"data:"+id,instructions:"x",personality:"x"},extra||{});
    state.personas=[mk("p_w","Ayla","Woman"),mk("p_g","Nil","Girl"),mk("p_b","Can","boy "),mk("p_m","Deniz","Man"),mk("p_y","Ece","Woman",{age:16})];
    state.user="Emre"; state.key="k"; state.autoImg=false; state.userSubject="Man";
    const c=curChat(); c.universeId=uni.id; state.curUniverse=uni.id;
    window.playerRefs=()=>["data:E1"]; window._playerRefHolder=()=>({look:{subject:"Man"}});
    window.toDataUri=async u=>u;
    window.saveMsgImage=(m,u,cb)=>{ if(cb)cb(true); }; window.captureGalleryMedia=()=>{};
    state.atlasKey="test-key"; state.imgProvider="atlascloud"; state.imgModel="bytedance/seedream-v4.5/edit";
    window.__menu=null; window.pickRule=async(rules)=>{ window.__menu=rules.map(r=>r.id); return rules[0]; };
    window.chatCompletion=async(messages,model,opts)=>{ if(opts&&opts.dbg==="Image prompt writer")return "a frame"; return "{}"; };
    window.__toasts=[]; const t0=window.toast; window.toast=m=>{ window.__toasts.push(String(m)); try{ t0(m); }catch(e){} };
    window.__n=0;
    window.fetch=async(u,o)=>{
      if(/generateImage$/.test(String(u))){ window.__n++;
        return {ok:true,status:200,json:async()=>({data:{id:"p"+window.__n,status:"completed",outputs:["https://out/"+window.__n+".png"]}})}; }
      return {ok:false,status:404,json:async()=>({}),text:async()=>""};
    };
    c.locationId="L"; c.location="Park"; c.subId="s1"; c.period="Midday"; c.gameDay=1;
  });
  const draw=(o)=>pg.evaluate(async(a)=>{
    const c=curChat(); state.userSubject=a.user||"Man";
    c.presentIds=a.present; c.subPos={}; a.present.forEach(id=>c.subPos[id]="s1");
    c.messages=[]; c.imgPromptBy={}; c.imgWindowBy={}; c.lastImgRuleBy={}; c.imgContBy={};
    const sp=state.personas.find(p=>p.id===a.speaker);
    const m={mid:"m1",role:"assistant",speaker:sp.name,speakerId:sp.id,content:"*Waves.*",present:a.present.slice()};
    c.messages.push(m); const n0=window.__n; window.__toasts=[]; window.__menu=null;
    await illustrate("m1",m.content,!!a.force);
    show('chat'); renderChat(); await new Promise(r=>setTimeout(r,150));
    const bub=document.querySelector('.bubble[data-mid="m1"]');
    return {state:m.imgState,err:m.imgErr||"",sent:window.__n-n0,toasts:window.__toasts.slice(),menu:window.__menu,
            html:bub?bub.textContent.replace(/\s+/g," "):"",retry:!!(bub&&/Retry/.test(bub.textContent))};
  },o);

  console.log("\n[1. a girl or a boy in the scene: no picture]");
  const G=await draw({speaker:"p_g",present:["p_g"]});
  ok("a speaker set as a girl: nothing is sent", G.sent===0&&G.state==="blocked", JSON.stringify(G));
  ok("the message says why, with no Retry", /someone in it is set as a girl or a boy/.test(G.html)&&G.retry===false, G.html.slice(0,300));
  const B=await draw({speaker:"p_w",present:["p_w","p_b"]});
  ok("someone else in the scene set as a boy (written 'boy ', lower case): nothing is sent", B.sent===0&&B.state==="blocked", JSON.stringify(B));
  const P=await draw({speaker:"p_w",present:["p_w"],user:"Girl"});
  ok("the player set as a girl: nothing is sent", P.sent===0&&P.state==="blocked", JSON.stringify(P));
  const F=await draw({speaker:"p_g",present:["p_g"],force:true});
  ok("a manual press says why", F.sent===0&&F.toasts.some(t=>/girl or a boy/.test(t)), JSON.stringify(F.toasts));

  console.log("\n[2. man or woman: pictures as before]");
  const W=await draw({speaker:"p_w",present:["p_w","p_m"]});
  ok("a woman and a man: the picture is made", W.sent===1&&W.state==="done", JSON.stringify(W));
  ok("with every scene type on the menu", JSON.stringify(W.menu)==='["r_talk","r_intimate"]', JSON.stringify(W.menu));

  console.log("\n[3. the existing check still holds alongside]");
  const Y=await draw({speaker:"p_y",present:["p_y"]});
  ok("a card with an age under 18 set as a woman: a picture, but the intimate types are off the menu",
     Y.sent===1&&JSON.stringify(Y.menu)==='["r_talk"]', JSON.stringify(Y));

  console.log("\n[4. clips, the playground and portraits]");
  const V=await pg.evaluate(async()=>{ const c=curChat(); c.presentIds=["p_g"]; const m=c.messages[0];
    m.img="https://out/x.png"; m.imgState="done"; m.speaker="Nil"; m.speakerId="p_g"; m.imgMeta={ids:["p_g"]};
    window.__toasts=[]; let called=false; const g=window.generateVideo; window.generateVideo=async()=>{ called=true; return "https://v"; };
    await animateScene("m1"); window.generateVideo=g; return {called,toasts:window.__toasts.slice(),vs:m.vidState}; });
  ok("animating a still with a girl in it is refused", V.called===false&&V.vs==="error"&&V.toasts.some(t=>/girl or a boy/.test(t)), JSON.stringify(V));
  const PL=await pg.evaluate(()=>({g:_imgChildSubject(state.personas.find(p=>p.id==="p_g")),b:_imgChildSubject(state.personas.find(p=>p.id==="p_b")),
    w:_imgChildSubject(state.personas.find(p=>p.id==="p_w")),y:_imgChildSubject(state.personas.find(p=>p.id==="p_y"))}));
  ok("girl and boy are caught, woman is not (the age check is a separate matter)", PL.g===true&&PL.b===true&&PL.w===false&&PL.y===false, JSON.stringify(PL));
  const SRC=require('fs').readFileSync(require('path').resolve(__dirname,'..','index.html'),'utf8');
  ok("the playground refuses an actor set as a girl or a boy (both entry points)", (SRC.match(/if\(_imgChildSubject\(actor\)\)\{ toast\(IMG_CHILD_BLOCK_MSG\); return; \}/g)||[]).length===2);
  ok("the scene clip and the portrait generator are gated too",
     /if\(\(cast\.people\|\|\[\]\)\.some\(_imgChildSubject\)/.test(SRC)&&/No pictures are made for a character set as a girl or a boy/.test(SRC));

  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log("\n  "+pass+" passed, "+fail+" failed");
  await b.close();
  process.exit(fail?1:0);
})();
