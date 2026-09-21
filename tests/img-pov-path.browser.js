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
     &&/THE VIEWER TAKES NO IMAGE SLOT/.test(def.style), "");
  ok("and it tells the writer she looks into the lens",
     /HERE IT COMES TO THE LENS/.test(def.style)&&/SHE MAY LOOK INTO THE LENS/.test(def.style), "");
  ok("the POV template is POV all the way down — it never hands him a slot, only forbids one",
     (def.style.match(/the man in IMAGE 2/g)||[]).length
       ===(def.style.match(/Never write "the man in IMAGE 2"/g)||[]).length
     &&/never a shot from anywhere his head is not/i.test(def.style)
     &&/EXAMPLE POV FRAMES/.test(def.style), "slots: "+(def.style.match(/the man in IMAGE 2/g)||[]).join(" / "));
  ok("it carries the full structure, not a sketch — shot, pose, face, hands, clothing, closer",
     /## 1\. THE SHOT IS CHOSEN BY THE EMOTION/.test(def.style)
     &&/## 3\. WHERE SHE IS, AND THE POSE/.test(def.style)
     &&/## 5\. HER HANDS/.test(def.style)&&/## 6\. THE VIEWER'S OWN HANDS/.test(def.style)
     &&/## 7\. CLOTHING STATE/.test(def.style)&&/## 8\. ONE CLOSING COMPOSITION CLAUSE/.test(def.style)
     &&def.style.length>8000, "length "+def.style.length);

  // ---- the second path
  const inti=await pg.evaluate(()=>{
    const d=DEFAULT_IMG_RULES.find(r=>r.id==="r_intimate_std");
    return {found:!!d,pov:d&&d.pov,cast:d&&d.cast,when:d&&d.when,style:d&&d.promptStyle,
            second:DEFAULT_IMG_RULES[1]&&DEFAULT_IMG_RULES[1].id,
            shared:d&&DEFAULT_IMG_RULES.find(r=>r.id==="r_pov_talk").promptStyle!==d.promptStyle};
  });
  ok("an INTIMATE path ships, third person, right behind the POV one",
     inti.found===true&&inti.pov===false&&inti.second==="r_intimate_std", JSON.stringify({f:inti.found,p:inti.pov,s:inti.second}));
  ok("it is cast as the character and you, so both sets of pictures go up",
     inti.cast==="player", inti.cast);
  ok("its when-clause takes the whole contact side and hands talk back to POV",
     /are IN CONTACT/.test(inti.when)&&/DON'T CHOOSE while nobody is touching anybody/.test(inti.when), inti.when.slice(0,140));
  ok("its template bans the POV camera outright",
     /NEVER a first-person point of view on this path/.test(inti.style)
     &&/cannot show two bodies in contact/.test(inti.style), "");
  ok("and puts the player back in the frame as a body with a slot",
     /The player is IMAGE 2 and on this path he is a BODY IN THE FRAME/.test(inti.style)
     &&/Never write the player as a faceless viewer here/.test(inti.style), "");
  ok("the contact itself is made the subject, with the join named once",
     /THE CONTACT IS THE SUBJECT/.test(inti.style)&&/THEN NAME THE JOIN ITSELF/.test(inti.style)
     &&/WEIGHT AND PRESSURE/.test(inti.style), "");
  ok("every hand is accounted for and nobody looks at the lens",
     /EVERY HAND IS ACCOUNTED FOR/.test(inti.style)
     &&/Neither of them looks at the camera or the viewer on this path/.test(inti.style), "");
  ok("it keeps the over-the-clothes rule the standard prompt had",
     /WHAT THE ROLEPLAY HAS NOT REMOVED IS STILL BEING WORN/.test(inti.style)
     &&/he is gripping her through the denim/.test(inti.style), "");
  ok("and it carries worked poses to read from",
     /EXAMPLE COMPLEX POSES/.test(inti.style)&&/MISSIONARY/.test(inti.style)
     &&/THE MOMENT AFTER/.test(inti.style)&&inti.style.length>8000, "length "+inti.style.length);
  ok("the two paths are genuinely different documents", inti.shared===true, "");
  ok("both are offered to a customised rule in the Insert-template picker",
     await pg.evaluate(()=>{ const ids=ruleTplOptions('img').map(d=>d.id);
       return ids.indexOf("r_pov_talk")>=0&&ids.indexOf("r_intimate_std")>=0; }));

  // ---- the path helper and the writer block
  const guide=await pg.evaluate(()=>({
    on:rulePov({pov:true}), off:rulePov({pov:false}), missing:rulePov({}), none:rulePov(null),
    g:up("imgPovGuide")
  }));
  ok("rulePov reads the switch and defaults to third person",
     guide.on===true&&guide.off===false&&guide.missing===false&&guide.none===false, JSON.stringify(guide).slice(0,120));
  /* v71.1 — it still reverses the gaze, but it no longer does so by citing "characters never look
     at the camera" as a rule stated elsewhere: no layer of this stack says that, so the override
     was arguing with a phantom. The positive statement carries it. */
  ok("the POV block reverses the gaze rule explicitly",
     /LOOK STRAIGHT INTO THE LENS/.test(guide.g)&&/looking at the viewer's eyes/.test(guide.g), guide.g.slice(0,160));
  ok("it bars the player from the frame but allows his hands",
     /no mirror, no reflection/.test(guide.g)&&/HIS HANDS ARE THE ONE EXCEPTION/.test(guide.g), "");
  /* v71.1 — the contract, not the sentence that used to carry it. The rule's own template assigns
     the IMAGE slots (that is its section on who is in frame); what this layer has to guarantee is
     that the viewer is never given one, however the rule numbers the rest. */
  ok("and it stops the writer giving him an IMAGE slot",
     /takes no IMAGE slot/i.test(guide.g), guide.g.slice(0,160));

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
  ok("a customised set gains BOTH paths, POV first and intimate behind it",
     after.length===4&&after[0].id==="r_pov_talk"&&after[0].pov===true
     &&after[1].id==="r_intimate_std"&&after[1].pov===false, JSON.stringify(after.map(r=>r.id)));
  ok("and nothing the user wrote is touched",
     after[2].id==="my_a"&&after[2].style==="A"&&after[3].id==="my_b"&&after[3].style==="B",
     JSON.stringify(after.map(r=>({id:r.id,style:String(r.style).slice(0,4)}))));
  await pg.reload(); await pg.waitForTimeout(2400);
  const twice=await pg.evaluate(()=>state.imgRules.filter(r=>r.id==="r_pov_talk").length);
  ok("it never runs twice", twice===1, "found "+twice);
  ok("nor does the intimate insert",
     await pg.evaluate(()=>state.imgRules.filter(r=>r.id==="r_intimate_std").length)===1);
  const own=await pg.evaluate(async()=>{
    const mine=[{id:"my_pov",label:"My own POV",when:"w",cast:"player",pov:true,promptStyle:"P",enabled:true}];
    store.set(K.imgRules,mine); store.setRaw(K.imgPovMigration,null); return true;
  });
  await pg.reload(); await pg.waitForTimeout(2400);
  ok("a POV rule the user built themselves is never replaced, and the intimate path lands after it",
     await pg.evaluate(()=>{ const r=state.imgRules;
       return r.length===2&&r[0].id==="my_pov"&&r[0].promptStyle==="P"&&r[1].id==="r_intimate_std"; }),
     await pg.evaluate(()=>state.imgRules.map(r=>r.id).join(",")));

  // ---- v2 refreshes the short v1 template but never an edited one
  const refreshed=async(style)=>{
    await pg.evaluate(async(st)=>{
      store.set(K.imgRules,[{id:"r_pov_talk",label:"old",when:"w",cast:"player",pov:true,
                             promptStyle:st,enabled:true}]);
      store.setRaw(K.imgPovMigration,"v1");
    },style);
    await pg.reload(); await pg.waitForTimeout(2400);
    return pg.evaluate(()=>{ const r=state.imgRules.find(x=>x.id==="r_pov_talk");
      return {style:r.promptStyle,label:r.label,n:state.imgRules.length}; });
  };
  const v1style=await pg.evaluate(()=>IMG_STYLE_POV_V1);
  const r1=await refreshed(v1style);
  ok("the untouched v1 POV template is replaced by the full one",
     /THE LENS IS HIS FACE/.test(r1.style)&&r1.label==="Standard / daily — your POV", r1.label);
  const r2=await refreshed(v1style+"\n\nAND ONE LINE I ADDED MYSELF.");
  ok("one edited character anywhere in it and the whole template is left alone",
     /AND ONE LINE I ADDED MYSELF/.test(r2.style)&&!/THE LENS IS HIS FACE/.test(r2.style), r2.style.slice(-60));
  const r3=await refreshed(v1style.replace("THE SHOT IS FIRST PERSON","THE SHOT IS FIRST PERSON, ALWAYS"));
  ok("and an edit inside a heading is an edit too",
     /THE SHOT IS FIRST PERSON, ALWAYS/.test(r3.style)&&!/THE LENS IS HIS FACE/.test(r3.style), r3.style.slice(0,120));

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

  /* v71.1 — THE UNEDITABLE LAYERS WERE THE STALE ONES. An image request is assembled from the
     universal prompt, then (for an old-style rule) the foundation, then the routed rule's own
     promptStyle, then a frame note, then a POV note. The last three lived in code as string
     constants — so the one part of the stack nobody could reach was also the part that had gone
     stale: it still explained how to fill a [bracket] template in a stack whose rule templates had
     stopped having brackets, still called the wardrobe a menu to pick from after the outfit became
     a decided fact, and still overrode a "characters never look at the camera" rule that is not in
     the prompt at all. It also shipped with its newlines escaped, so it arrived as one unbroken
     line with the characters \n visible in it. */
  console.log("\n[every layer of the image request is editable]");
  {
    const LAYERS=["imgFoundation","imgFrameGuide","imgPovGuide"];
    ok("all three are registered prompts", await pg.evaluate(L=>{
        const miss=L.filter(k=>!(PROMPT_REGISTRY||[]).some(e=>e&&e.key===k));
        return miss.length===0?true:"not registered: "+miss.join(", "); },LAYERS));
    ok("each one loads with real text", await pg.evaluate(L=>{
        const thin=L.filter(k=>!(up(k)||"").trim() || up(k).length<80);
        return thin.length===0?true:"empty or stub: "+thin.join(", "); },LAYERS));
    ok("none of them is still a constant in the code", (()=>{
        const src=require('fs').readFileSync('/home/user/Multirp/index.html','utf8');
        const left=["IMG_WRITER_FOUNDATION","IMG_WRITER_FRAME_GUIDE","IMG_WRITER_POV_GUIDE"]
          .filter(n=>new RegExp("const "+n+"\\s*=").test(src));
        return left.length===0?true:"still in code: "+left.join(", "); })());
    ok("the request reads them through the registry", (()=>{
        const src=require('fs').readFileSync('/home/user/Multirp/index.html','utf8');
        const n=(src.match(/up\("imgFrameGuide"\)/g)||[]).length;
        return n===2?true:"frame guide read at "+n+" of the 2 image paths"; })());
    ok("no layer ships its newlines escaped into visible text", await pg.evaluate(L=>{
        const bad=L.concat("narrateVerbatim").filter(k=>/\\n/.test(up(k)));
        return bad.length===0?true:"literal \\n inside: "+bad.join(", "); },LAYERS));
    ok("no refresh pipe stood down", await pg.evaluate(()=>{
        const sp=window.__stalePipes||[];
        return sp.length===0?true:"stale: "+sp.join(", "); }));
  }

  console.log("\n[the remnants of the old design are gone]");
  {
    const dead=await pg.evaluate(()=>{
      const all=["imgFoundation","imgFrameGuide","imgPovGuide"].map(k=>up(k)).join("\n");
      return [
        [/\[bracket|DROP THE BRACKETS/i, "instructions for filling a [bracket] template"],
        [/WARDROBE|DRESSING CONTEXT/i,    "the wardrobe as a menu to pick from"],
        [/never look at the camera|characters never look/i, "an override of a rule that is not there"],
        [/tripod across the room/i,       "a distance rule that fought the shot section"],
      ].filter(([rx])=>rx.test(all)).map(([,n])=>n);
    });
    ok("nothing left over from the template design", dead.length===0?true:"still there: "+dead.join("; "));
  }

  console.log("\n[and each layer says only what is its own to say]");
  ok("the frame note defers to the scene-type block", await pg.evaluate(()=>
      /the block wins/.test(up("imgFrameGuide"))));
  ok("it explains the continuity reference and the decided outfit", await pg.evaluate(()=>{
      const t=up("imgFrameGuide");
      return /CONTINUITY REFERENCE/.test(t) && /already decided/.test(t)
        ? true : "the frame note no longer covers the two blocks only it can explain"; }));
  ok("the POV note owns the viewpoint but not the framing", await pg.evaluate(()=>{
      const t=up("imgPovGuide");
      return /his head and only his head/.test(t)
          && /belongs to the scene-type block above/.test(t)
        ? true : "the POV note still decides how tight the shot is"; }));
  ok("it still reverses the gaze, without citing a rule that is not there", await pg.evaluate(()=>{
      const t=up("imgPovGuide");
      return /LOOK STRAIGHT INTO THE LENS/.test(t) && !/never look at the camera/i.test(t)
        ? true : "the gaze override is missing or still cites the phantom rule"; }));
  ok("the spoken-input rule is a prompt now, not a call-site string", (()=>{
      const src=require('fs').readFileSync('/home/user/Multirp/index.html','utf8');
      return /\(\(opts&&opts\.verbatim\)\?"\\n\\n"\+up\("narrateVerbatim"\):""\)/.test(src)
        ? true : "the auto-RP narrator still builds it inline"; })());

  console.log("\n[v100.1 — the location is the writer's, and the face is named]");
  ok("the place is no longer pasted onto the tail", (()=>{
      const src=require('fs').readFileSync('/home/user/Multirp/index.html','utf8');
      const i=src.indexOf("const _appC=_imgSpeakerAppearance(speaker,{refDriven:_refDriven});");
      const blk=src.slice(i,i+1600);
      return !/const _locC=_imgLocationClause\(chat\)/.test(blk)
          && /const _det=\[_appC,_litC\]/.test(blk)
        ? true : "the location clause is still on the deterministic tail"; })());
  ok("but the lighting still is — it follows the clock, not the room", (()=>{
      const src=require('fs').readFileSync('/home/user/Multirp/index.html','utf8');
      return /const _litC=_imgLightingClause\(chat\);/.test(src) ? true : "the lighting went too"; })());
  ok("the writer is handed the place as facts to render", (()=>{
      const src=require('fs').readFileSync('/home/user/Multirp/index.html','utf8');
      return /WHERE THIS FRAME HAPPENS/.test(src)
          && /Do not copy the sentence above; it is a description for a reader, not prompt words/.test(src)
        ? true : "the request does not carry the place"; })());
  ok("and it is in the user message, before the continuity reference", (()=>{
      const src=require('fs').readFileSync('/home/user/Multirp/index.html','utf8');
      return /const usr=_dress\+_placeBlock/.test(src) ? true : "the place block is not wired in"; })());
  ok("the continuity note no longer claims the location is automatic", (()=>{
      const src=require('fs').readFileSync('/home/user/Multirp/index.html','utf8');
      return !/IGNORE any location\/setting\/lighting in it, those are added automatically/.test(src)
          && /the LOCATION is yours to write/.test(src)
        ? true : "the continuity note still lies about it"; })());
  ok("the prompt gives the writer the job, with the reason", await pg.evaluate(()=>{
      const t=up("rewritePrompt")||"";
      return /# WHERE IT HAPPENS — YOURS TO WRITE/.test(t)
          && /every picture in a room looked like the same picture/.test(t)
          && /Do not invent a window, a fireplace or a view that nobody mentioned/.test(t)
        ? true : "the location section is missing"; }));
  ok("and the auto-injection list no longer names it", await pg.evaluate(()=>{
      const t=up("rewritePrompt")||"";
      return /character appearances and lighting are Auto injected/.test(t)
          && /The LOCATION is no longer among them/.test(t)
        ? true : "the tail list still claims the location"; }));

  ok("the face is ONE named feeling plus at most three words", await pg.evaluate(()=>{
      const t=up("rewritePrompt")||"";
      return /NAME THE FEELING/.test(t)
          && /AT MOST three more words/.test(t)
          && /Four words in total is the ceiling for the whole face/.test(t)
        ? true : "the expression rule is still a tag budget"; }));
  ok("assembling a face out of parts is named as the fault", await pg.evaluate(()=>{
      const t=up("rewritePrompt")||"";
      return /Do NOT assemble a face out of parts/.test(t)
          && /the generator averages them into nothing/.test(t)
        ? true : "the failure is not named"; }));
  ok("with the old shape shown as the wrong one", await pg.evaluate(()=>{
      const t=up("rewritePrompt")||"";
      return /half-lidded eyes, parted lips, flushed cheeks, furrowed brow/.test(t)
        ? true : "no worked contrast"; }));
  ok("gaze and head turn are a pose, not part of the budget", await pg.evaluate(()=>{
      const t=up("rewritePrompt")||"";
      return /is a POSE, not an expression, and it does not count against the four/.test(t)
        ? true : "the pose exemption is missing"; }));
  ok("the physical-state marker rule survives untouched", await pg.evaluate(()=>{
      const t=up("rewritePrompt")||"";
      return /At most ONE physical-state marker where relevant/.test(t)
          && /NEVER describe streaming tears/.test(t) ? true : "a rule was lost in the rewrite"; }));
  ok("a stored copy of the old default picks both up", (()=>{
      const src=require('fs').readFileSync('/home/user/Multirp/index.html','utf8');
      return /_refreshPipe\("rewritePrompt","FACIAL EXPRESSION & PHYSICAL STATE","WHERE IT HAPPENS/.test(src)
        ? true : "no pipe — a saved override keeps the old rules"; })());

  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log("\n  "+pass+" passed, "+fail+" failed");
  await b.close();
  process.exit(fail?1:0);
})();
