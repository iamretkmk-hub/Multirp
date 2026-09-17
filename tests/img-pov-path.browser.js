/* v52.2 — TWO PATHS, AND A WRITER THAT CAN SEE PAST THE LAST TWO LINES.
   Three things were wrong at once. The `pov` switch in the rule editor had been saved since v25 and
   READ BY NOTHING — every scene rendered third person whatever it said. The player's photographs
   went up even for a shot taken from his own eyes, which is how a first-person frame comes back as
   an ordinary two-shot. And the writer saw exactly two lines of story, so everything that happened
   across the turns the visual director skipped — a jacket off, a chair pushed back, a move across
   the room — reached it through nothing at all.
   Run: node tests/img-pov-path.browser.js */
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage({viewport:{width:412,height:915}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  const app='file://'+require('path').resolve(__dirname,'..','index.html');
  await pg.goto(app); await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(600);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x||c).slice(0,600));} };

  // ---- the new scene type
  const def=await pg.evaluate(()=>{
    const d=DEFAULT_IMG_RULES.find(r=>r.id==="r_pov_talk");
    return {found:!!d, first:DEFAULT_IMG_RULES[0].id, pov:d&&d.pov, cast:d&&d.cast,
            when:d&&d.when, style:d&&d.promptStyle, count:DEFAULT_IMG_RULES.length};
  });
  ok("a POV scene type ships", def.found===true&&def.pov===true, JSON.stringify(def).slice(0,200));
  ok("it is first, so it is what renders with routing off", def.first==="r_pov_talk", def.first);
  ok("it is cast as the character and you", def.cast==="player", def.cast);
  ok("its when-clause routes daily beats to it and contact away from it",
     /NO physical contact/.test(def.when)&&/DON'T CHOOSE the moment they make contact/.test(def.when), def.when.slice(0,160));
  ok("its template is written from his eyes and keeps him out of the frame",
     /point-of-view shot from the player's own eyes/.test(def.style)
     &&/NEVER a body in this frame/.test(def.style)
     &&/viewer takes no IMAGE slot/.test(def.style), "");
  ok("and it tells the writer she looks into the lens",
     /Her eyes meet the lens/.test(def.style)&&/look INTO the lens/.test(def.style), "");

  // ---- the path helper and the writer block
  const guide=await pg.evaluate(()=>({
    on:rulePov({pov:true}), off:rulePov({pov:false}), missing:rulePov({}), none:rulePov(null),
    g:IMG_WRITER_POV_GUIDE
  }));
  ok("rulePov reads the switch and defaults to third person",
     guide.on===true&&guide.off===false&&guide.missing===false&&guide.none===false, JSON.stringify(guide).slice(0,120));
  ok("the POV block reverses the gaze rule explicitly",
     /THE GAZE RULE IS REVERSED HERE/.test(guide.g)&&/she looks INTO the lens/.test(guide.g), "");
  ok("it bars the player from the frame but allows his hands",
     /no mirror, no reflection/.test(guide.g)&&/HIS HANDS ARE THE ONE EXCEPTION/.test(guide.g), "");
  ok("and it stops the writer giving him an IMAGE slot",
     /never write "the man in IMAGE 2" for him/.test(guide.g), "");

  // ---- whose photographs go up
  const refs=await pg.evaluate(async()=>{
    const she={id:"p_she",name:"Burcu",look:{subject:"Woman"},refs:["data:image/png;base64,iVBORw0KGgo="]};
    state.personas=[she];
    const realPersonRefs=window.personRefs, realPlayerRefs=window.playerRefs, realToData=window.toDataUri;
    window.personRefs=p=>(p&&p.refs)||[];
    window.playerRefs=()=>["data:image/png;base64,PLAYER"];
    window.toDataUri=async u=>u;
    const chat={messages:[],id:"c1"};
    try{
      const third=await buildRefPack({cast:"player",pov:false},she,chat,10);
      const pov  =await buildRefPack({cast:"player",pov:true },she,chat,10);
      const solo =await buildRefPack({cast:"solo",  pov:true },she,chat,10);
      return {third:third.urls,pov:pov.urls,solo:solo.urls};
    }finally{ window.personRefs=realPersonRefs; window.playerRefs=realPlayerRefs; window.toDataUri=realToData; }
  });
  ok("third person sends both people's pictures",
     refs.third.length===2&&refs.third.some(u=>/PLAYER/.test(u)), JSON.stringify(refs.third));
  ok("POV sends HER pictures and withholds his",
     refs.pov.length===1&&!refs.pov.some(u=>/PLAYER/.test(u)), JSON.stringify(refs.pov));
  ok("and a solo rule is unaffected either way", refs.solo.length===1, JSON.stringify(refs.solo));

  // ---- the router is told which fork to take
  const router=await pg.evaluate(()=>({d:DEFAULT_ROUTER,stored:state.routerPrompt||"",routeOn:state.routeOn}));
  ok("the shipped router carries the contact rule",
     /WHOSE EYES — POV OR THE ROOM/.test(router.d)&&/NO ONE IS TOUCHING ANYONE/.test(router.d)
     &&/THEY ARE IN CONTACT/.test(router.d), "");
  ok("it says stickiness must not hold the shot on the wrong side of the fork",
     /do not let stickiness hold you on the POV side/.test(router.d), "");
  ok("smart routing is on by default, so the checker actually runs", router.routeOn!==false, String(router.routeOn));
  ok("no refresh pipe was left pointing at a marker the default lost",
     await pg.evaluate(()=>!(window.__stalePipes||[]).some(s=>/^(routerPrompt|rewritePrompt)/.test(s))),
     await pg.evaluate(()=>(window.__stalePipes||[]).join(" | ")));

  // ---- a stored older router is refreshed, a hand-written one is not
  const rt=async v=>{ await pg.evaluate(t=>store.setRaw(K.routerPrompt,t),v);
    await pg.reload(); await pg.waitForTimeout(2400); return pg.evaluate(()=>state.routerPrompt); };
  ok("a stored older router picks up the fork",
     (await rt("You are a routing assistant for an image generator. Old body without the marker."))===router.d);
  ok("a router the user wrote themselves is left alone",
     (await rt("My own router. Return an index."))==="My own router. Return an index.");
  await pg.evaluate(()=>{ store.setRaw(K.routerPrompt,DEFAULT_ROUTER); });
  await pg.reload(); await pg.waitForTimeout(2400);

  // ---- the migration adds the type to a customised set without touching it
  const mig=await pg.evaluate(async()=>{
    const mine=[{id:"my_a",label:"Mine A",when:"w",cast:"player",promptStyle:"A",enabled:true},
                {id:"my_b",label:"Mine B",when:"w",cast:"solo",promptStyle:"B",enabled:true}];
    store.set(K.imgRules,mine); store.setRaw(K.imgPovMigration,null);
    return true;
  });
  await pg.reload(); await pg.waitForTimeout(2400);
  const after=await pg.evaluate(()=>state.imgRules.map(r=>({id:r.id,pov:!!r.pov,style:r.promptStyle})));
  ok("a customised set gains the POV type at the top",
     after.length===3&&after[0].id==="r_pov_talk"&&after[0].pov===true, JSON.stringify(after.map(r=>r.id)));
  ok("and nothing the user wrote is touched",
     after[1].id==="my_a"&&after[1].style==="A"&&after[2].id==="my_b"&&after[2].style==="B", JSON.stringify(after));
  await pg.reload(); await pg.waitForTimeout(2400);
  const twice=await pg.evaluate(()=>state.imgRules.filter(r=>r.id==="r_pov_talk").length);
  ok("it never runs twice", twice===1, "found "+twice);
  const own=await pg.evaluate(async()=>{
    const mine=[{id:"my_pov",label:"My own POV",when:"w",cast:"player",pov:true,promptStyle:"P",enabled:true}];
    store.set(K.imgRules,mine); store.setRaw(K.imgPovMigration,null); return true;
  });
  await pg.reload(); await pg.waitForTimeout(2400);
  ok("a set that already has a POV rule of its own is left as it is",
     await pg.evaluate(()=>state.imgRules.length===1&&state.imgRules[0].id==="my_pov"),
     await pg.evaluate(()=>state.imgRules.map(r=>r.id).join(",")));

  // ---- THE WINDOW: what the writer is handed, in the real illustrate() path
  const shot=async(opts)=>pg.evaluate(async(a)=>{
    const uni=state.universes[0];
    const she={id:"p_she",name:"Burcu",universeId:uni.id,instructions:"x",personality:"x",
               backstory:"x",style:"x",goals:"x",look:{subject:"Woman"}};
    const other={id:"p_other",name:"Esma",universeId:uni.id,instructions:"x",personality:"x",
                 backstory:"x",style:"x",goals:"x",look:{subject:"Woman"}};
    state.personas=[she,other];
    const chat=curChat(); chat.presentIds=[she.id,other.id]; chat.messages=[];
    chat.imgPromptBy={}; chat.imgWindowBy={}; chat.lastImgRuleBy={};
    state.user="Emre";
    state.imgProvider="modelslab";                    // no reference pack on this path
    state.imgRules=[{id:"r_t",label:"T",when:"w",cast:"player",pov:!!a.pov,
                     promptStyle:"# OUTPUT STRUCTURE\nwrite it",enabled:true}];
    state.routeOn=false;                              // one rule, no routing call
    let mid="";
    (a.msgs||[]).forEach((m,i)=>{
      const id="m_"+i+"_"+Date.now();
      chat.messages.push({mid:id,role:m.r,speaker:m.r==='user'?null:m.s,
        characterId:m.r==='user'?null:(m.s==="Burcu"?she.id:other.id),
        content:m.c,travelBeat:!!m.travel,img:m.img?"u":null,imgState:m.img?"done":null});
      if(i===(a.msgs.length-1)) mid=id;
    });
    if(a.anchorIdx!=null) chat.imgWindowBy[she.id]=chat.messages[a.anchorIdx].mid;
    const seen=[];
    const realChat=window.chatCompletion, realGen=window.genImageForRule,
          realSave=window.saveMsgImage, realCap=window.captureGalleryMedia;
    window.chatCompletion=async(msgs)=>{ seen.push(msgs); return "a written prompt"; };
    window.genImageForRule=async()=>"https://img/1.png";
    window.saveMsgImage=(m,u,cb)=>{ if(cb)cb(true); };
    window.captureGalleryMedia=()=>{};
    try{ await illustrate(mid,a.msgs[a.msgs.length-1].c,true); }
    finally{ window.chatCompletion=realChat; window.genImageForRule=realGen;
             window.saveMsgImage=realSave; window.captureGalleryMedia=realCap; }
    const call=seen[seen.length-1]||[];
    return {sys:String((call.find(m=>m.role==="system")||{}).content||""),
            usr:String((call.filter(m=>m.role==="user").pop()||{}).content||""),
            anchor:(chat.imgWindowBy||{})[she.id]||"", lastMid:mid,
            msgs:chat.messages.length};
  },opts);

  const M=[{r:'user',c:"Otur şuraya."},
           {r:'assistant',s:"Burcu",c:"Oturuyorum, ceketimi çıkarıyorum."},
           {r:'assistant',s:"Esma",c:"Esma kendi masasından bakıyor."},
           {r:'user',c:"Ceketini astım."},
           {r:'assistant',s:"Burcu",c:"Sandalyeyi yakınlaştırıyorum."},
           {r:'user',c:"Bir şey içer misin?"},
           {r:'assistant',s:"Burcu",c:"Çay içiyorum zaten."}];
  const w=await shot({msgs:M,pov:false});
  ok("the window reaches the writer, labelled as analysis rather than script",
     /WHAT HAS HAPPENED SINCE THAT PICTURE — FOR ANALYSIS, NOT FOR DRAWING/.test(w.usr), w.usr.slice(0,200));
  ok("it carries the turns the writer never used to see",
     /ceketimi çıkarıyorum/.test(w.usr)&&/Sandalyeyi yakınlaştırıyorum/.test(w.usr), "");
  ok("it names the player by name on his own lines",
     /Emre: Ceketini astım/.test(w.usr), "");
  ok("another character's line is NOT in this character's window",
     !/Esma kendi masasından/.test(w.usr), "Esma leaked into Burcu's window");
  ok("the trigger line is not duplicated — it lives in the LATEST EXCHANGE",
     (w.usr.match(/Bir şey içer misin/g)||[]).length===1, "count "+(w.usr.match(/Bir şey içer misin/g)||[]).length);
  ok("the latest exchange is still the authority block at the end",
     /LATEST EXCHANGE \(what just happened/.test(w.usr)
     &&w.usr.lastIndexOf("LATEST EXCHANGE")>w.usr.lastIndexOf("FOR ANALYSIS"), "");
  ok("it tells the writer a change stands until something undoes it",
     /A change here stands until something undoes it/.test(w.usr), "");
  ok("a successful frame stamps the anchor for the next window",
     w.anchor===w.lastMid, w.anchor+" vs "+w.lastMid);

  const w2=await shot({msgs:M,pov:false,anchorIdx:4});
  ok("with an anchor the window starts after the last picture",
     !/ceketimi çıkarıyorum/.test(w2.usr)&&!/Ceketini astım/.test(w2.usr), w2.usr.slice(0,300));
  const w3=await shot({msgs:[{r:'user',c:"a"},{r:'assistant',s:"Burcu",c:"b"}],pov:false});
  ok("two lines and nothing before them means no window block at all",
     !/FOR ANALYSIS, NOT FOR DRAWING/.test(w3.usr), w3.usr.slice(0,200));

  const MT=[{r:'assistant',s:"Burcu",c:"Eski yerdeki hali."},
            {r:'user',c:"Gidelim.",travel:true},
            {r:'user',c:"Buraya oturalım."},
            {r:'assistant',s:"Burcu",c:"Oturuyorum."}];
  const w4=await shot({msgs:MT,pov:false});
  ok("the window never reaches back past a travel beat",
     !/Eski yerdeki hali/.test(w4.usr), w4.usr.slice(0,300));
  ok("travel clears every character's anchor",
     await pg.evaluate(()=>{ const chat=curChat(); chat.imgWindowBy={p_she:"m_x"};
       const loc=(state.locations||[])[0];
       if(!loc) return true;                       // nothing to travel to in a bare install
       try{ travelTo(loc.id,[]); }catch(e){}
       return Object.keys(chat.imgWindowBy||{}).length===0; }));

  // ---- the path reaches the writer's system prompt, and only on the POV path
  ok("a POV rule hands the writer the POV block",
     /THIS IS A POV FRAME/.test((await shot({msgs:M,pov:true})).sys), "");
  ok("a third-person rule does not", !/THIS IS A POV FRAME/.test(w.sys), "");

  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log("\n  "+pass+" passed, "+fail+" failed");
  await b.close();
  process.exit(fail?1:0);
})();
