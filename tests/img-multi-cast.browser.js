/* v128.1 — MULTI-CHARACTER PICTURES: EVERYONE'S PHOTOS, AND THE WRITER KNOWS WHOSE IS WHOSE.
   Asked: "When there is more than one character in the scene I want each character's pictures
   uploaded, the LLM informed which image is for which character before that, and the prompt written
   according to each character's image." Found: the reference pack was built AFTER the prompt was
   written, the writer was told to say only "Man"/"Woman" and never learned who was in the frame, the
   usual "the character and you" scene type sent nobody else's pictures, and the roster numbered
   pictures while the scene templates number people. Checked here through a real illustrate() call
   with the models stubbed:
     - a third person the exchange involves has their pictures sent — and (v132.1) so does anyone
       else in the scene, after them: a POV shot of two characters used to upload one picture;
     - the writer is told the cast BEFORE writing, in the templates' own labels, with who each is;
     - the roster names the same people with the same labels, mapped to their own figures, even when
       someone has several pictures; a POV shot leaves the player out and renumbers the rest;
     - a one-person frame is written exactly as before.
   Run: node tests/img-multi-cast.browser.js */
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
    const mk=(id,n,subj,refs)=>({id,name:n,universeId:uni.id,look:{subject:subj},refs,instructions:"x",personality:"x"});
    state.personas=[mk("p_a","Ayla","Woman",["data:A1","data:A2"]),mk("p_s","Selin","Woman",["data:S1"]),mk("p_d","Deniz","Man",["data:D1"])];
    state.user="Emre"; state.key="k";
    window.__real={personRefs:window.personRefs,playerRefs:window.playerRefs,toDataUri:window.toDataUri,
      usesRefImage:window.usesRefImage,effImgModel:window.effImgModel,editModelMaxRefs:window.editModelMaxRefs,
      pickRule:window.pickRule,genImageForRule:window.genImageForRule,chatCompletion:window.chatCompletion};
    window.personRefs=p=>(p&&p.refs)||[];
    window.playerRefs=()=>["data:E1"];
    window._playerRefHolder=()=>({look:{subject:"Man"}});
    window.toDataUri=async u=>u;
    window.usesRefImage=()=>true; window.effImgModel=()=>"bytedance/seedream-v4.5/edit"; window.editModelMaxRefs=()=>10;
    window.__rule={label:"Talk",cast:"player",pov:false,promptStyle:""};
    window.pickRule=async()=>window.__rule;
    window.__gen=null; window.__writer=null;
    window.genImageForRule=async(rule,prompt,neg)=>{ window.__gen={prompt,pack:_refPack}; return "data:image/png;base64,iVBORw0KGgo="; };
    window.chatCompletion=async(messages,model,opts)=>{
      if(opts&&opts.dbg==="Image prompt writer"){ window.__writer=messages; return "the woman in IMAGE 1 leans toward the man in IMAGE 2 while the woman in IMAGE 3 watches"; }
      return "{}";
    };
    state.autoImg=false;
  });
  const shot=(setup)=>pg.evaluate(async(setup)=>{
    const c=curChat();
    c.presentIds=["p_a","p_s","p_d"]; c.subPos={}; c.messages=[]; c.imgPromptBy={}; c.lastImgRuleBy={}; c.imgWindowBy={};
    c.messages.push({mid:"m1",role:"assistant",speaker:"Selin",speakerId:"p_s",content:'"Ayla, tell him what you saw."',present:c.presentIds.slice()});
    c.messages.push({mid:"m2",role:"assistant",speaker:"Ayla",speakerId:"p_a",content:'*She leans toward Emre.* "Fine. I saw the governor at the gate."',present:c.presentIds.slice()});
    (new Function(setup||""))();
    window.__gen=null; window.__writer=null;
    await illustrate("m2",c.messages[1].content,true);
    const pack=window.__gen&&window.__gen.pack;
    const usr=window.__writer?window.__writer.filter(m=>m.role==="user").map(m=>m.content).join("\n"):"";
    return {people:pack?pack.people.map(p=>({n:p.name,l:p.label,f:p.from,t:p.to})):[],names:pack?pack.names:[],subjects:pack?pack.subjects:[],
      urls:pack?pack.urls:[],usr,roster:pack?editPrompt("bytedance/seedream-v4.5/edit","SCENE",pack.names,pack.subjects):""};
  },setup||"");

  console.log("\n[everyone in the scene has their pictures sent]");
  const A=await shot();
  ok("the speaker, the player and the person being answered go up first, in the templates' order",
     JSON.stringify(A.people.map(p=>p.n).slice(0,3))==='["Ayla","Emre","Selin"]', JSON.stringify(A.people));
  ok("each with all of their own pictures", JSON.stringify(A.urls)==='["data:A1","data:A2","data:E1","data:S1","data:D1"]', JSON.stringify(A.urls));
  ok("somebody in the scene but not named in the exchange goes up too, after them", A.people[3]&&A.people[3].n==="Deniz", JSON.stringify(A.people));
  ok("each person is labelled by their IMAGE slot, unique even for two women",
     JSON.stringify(A.people.map(p=>p.l))==='["the woman in IMAGE 1","the man in IMAGE 2","the woman in IMAGE 3","the man in IMAGE 4"]', JSON.stringify(A.people));

  console.log("\n[the writer is told before it writes]");
  ok("the prompt writer receives the cast", /PEOPLE IN THIS FRAME/.test(A.usr), A.usr.slice(0,300));
  ok("with who each person is and which pictures are theirs",
     /- the woman in IMAGE 1 = Ayla, whose line this picture is for \(pictures 1-2\)/.test(A.usr)
     && /- the man in IMAGE 2 = Emre \(the player\) \(picture 3\)/.test(A.usr)
     && /- the woman in IMAGE 3 = Selin \(picture 4\)/.test(A.usr), A.usr.slice(0,600));
  ok("and is told to write those labels, never names or a bare 'woman'", /Call each person ONLY by their label/.test(A.usr) && /Never a name/.test(A.usr), A.usr.slice(0,700));
  ok("the cast comes first, before the exchange it has to be read against", A.usr.indexOf("PEOPLE IN THIS FRAME")<A.usr.indexOf("LATEST EXCHANGE"), "order");

  console.log("\n[the roster says the same thing to the image model]");
  ok("it maps each labelled person to their own figures",
     /IMAGE numbers the people in the scene; Figure numbers the pictures/.test(A.roster)
     && /The woman in IMAGE 1: Figure 1 is her face — match it exactly; Figure 2 is the same person from another angle/.test(A.roster)
     && /The man in IMAGE 2 is Figure 3/.test(A.roster) && /The woman in IMAGE 3 is Figure 4/.test(A.roster), A.roster.slice(0,500));
  ok("and the scene text reaches it after the roster", /\. SCENE$|SCENE$/.test(A.roster) && A.roster.indexOf("SCENE")>A.roster.indexOf("IMAGE 3"), A.roster.slice(-120));

  console.log("\n[a POV shot, and a one-person frame]");
  const P=await shot("window.__rule={label:'POV',cast:'player',pov:true,promptStyle:''};");
  ok("on a POV shot the player takes no slot and the others move up",
     JSON.stringify(P.people.map(p=>p.l))==='["the woman in IMAGE 1","the woman in IMAGE 2","the man in IMAGE 3"]' && P.people[1].n==="Selin" && P.people.every(p=>p.n!=="Emre"), JSON.stringify(P.people));
  const P2=await shot("window.__rule={label:'POV',cast:'player',pov:true,promptStyle:''}; curChat().presentIds=['p_a','p_s']; curChat().messages[0].content='\"Look at the sea.\"';");
  ok("two characters seen from the player's eyes: both their pictures go up, his do not (the reported case)",
     JSON.stringify(P2.people.map(p=>p.n))==='["Ayla","Selin"]' && JSON.stringify(P2.urls)==='["data:A1","data:A2","data:S1"]', JSON.stringify(P2));
  ok("and the writer is told both, by label", /PEOPLE IN THIS FRAME/.test(P2.usr) && /IMAGE 2 = Selin/.test(P2.usr), P2.usr.slice(0,400));
  /* v132.2 — the reported payload: one picture sent ("the man in IMAGE 1"), a prompt with "the woman
     in IMAGE 1" and "the man in IMAGE 2". The speaker had no pictures and dropped out of the pack,
     so the man beside her moved up to IMAGE 1 while the writer followed the template's numbering. */
  const U=await shot("window.__rule={label:'POV',cast:'player',pov:true,promptStyle:''}; curChat().presentIds=['p_a','p_d']; curChat().messages[0].speaker='Deniz'; curChat().messages[0].speakerId='p_d'; curChat().messages[0].content='\"Come, sit with us.\"'; window.__refsA=state.personas[0].refs; state.personas[0].refs=[];");
  await pg.evaluate(()=>{ state.personas[0].refs=window.__refsA; });
  ok("a speaker with no pictures is not silently dropped: the one picture is the man's, labelled IMAGE 1",
     JSON.stringify(U.people.map(p=>p.n+"|"+p.l))==='["Deniz|the man in IMAGE 1"]' && JSON.stringify(U.urls)==='["data:D1"]', JSON.stringify(U));
  ok("and the writer is told she is in the frame with NO PICTURE, to be described in words",
     /- the woman with no picture = Ayla, whose line this picture is for — NO PICTURE: describe them in words/.test(U.usr)
     && /- the man in IMAGE 1 = Deniz \(picture 1\)/.test(U.usr), U.usr.slice(0,700));
  ok("and that this list's numbers win over the scene template's", /THIS list wins/.test(U.usr) && /no IMAGE number beyond the last one listed/.test(U.usr), U.usr.slice(0,900));
  /* v148.2 — asked: "the prompt mentions two characters but it only uploads the speaker's image. When
     there are multiple characters nearby all characters' reference images should be uploaded." A
     one-person scene type with others in earshot is cast as a group for that picture. */
  const S=await shot("window.__rule={label:'Portrait',cast:'solo',pov:false,promptStyle:''};");
  ok("a solo scene type with others nearby sends everyone's pictures (the reported case)", JSON.stringify(S.people.map(p=>p.n).sort())==='["Ayla","Deniz","Emre","Selin"]', JSON.stringify(S.people));
  ok("and its writer is told who each of them is", /PEOPLE IN THIS FRAME/.test(S.usr)&&/IMAGE 1 = Ayla, whose line this picture is for/.test(S.usr), S.usr.slice(0,400));
  ok("the stored scene type is not changed", await pg.evaluate(()=>window.__rule.cast==="solo"));
  const S1=await shot("window.__rule={label:'Portrait',cast:'solo',pov:false,promptStyle:''}; curChat().presentIds=['p_a']; curChat().messages.forEach(m=>m.present=['p_a']);");
  ok("a solo scene type with nobody else here stays one person", JSON.stringify(S1.people.map(p=>p.n))==='["Ayla"]', JSON.stringify(S1.people));
  ok("and its writer gets no cast block — written exactly as before", S1.usr.indexOf("PEOPLE IN THIS FRAME")<0, S1.usr.slice(0,200));
  const RT=await pg.evaluate(async()=>{ let seen=""; const keep=window.pickRule; window.pickRule=async(r,t)=>{ seen=t; return window.__rule; };
    const c=curChat(); c.presentIds=["p_a","p_s","p_d"]; await illustrate("m2",c.messages[1].content,true); window.pickRule=keep; return seen; });
  ok("the scene-type router is told who else is in the scene", /ALSO IN THE SCENE WITH Ayla, within reach of the camera: Selin, Deniz, and Emre \(the player\)/.test(RT), RT.slice(0,300));
  const CAP=await shot("window.__rule={label:'Group',cast:'group',pov:false,promptStyle:''}; window.editModelMaxRefs=()=>2;");
  await pg.evaluate(()=>{ window.editModelMaxRefs=()=>10; });
  ok("more people than picture slots: those past the cap are described in words, not dropped",
     CAP.people.length===2&&/NO PICTURE: describe them in words/.test(CAP.usr)&&/Selin/.test(CAP.usr)&&/Deniz/.test(CAP.usr), JSON.stringify({p:CAP.people,u:CAP.usr.slice(0,700)}));
  const TX=await shot("window.usesRefImage=()=>false; window.__rule={label:'Portrait',cast:'solo',pov:false,promptStyle:''}; state.personas.find(p=>p.id==='p_s').look={subject:'Woman',hair:'red curls'}; state.personas.find(p=>p.id==='p_a').look={subject:'Woman',hair:'black bob'};");
  const TXprompt=await pg.evaluate(()=>{ const r=window.__gen&&window.__gen.prompt; window.usesRefImage=()=>true; return r||""; });
  ok("a model that draws from words alone: the writer gets every person with their look, to describe each separately",
     /PEOPLE IN THIS FRAME — the picture is drawn from your words alone/.test(TX.usr)&&/- Ayla, whose line this picture is for: Woman — [^\n]*black bob/.test(TX.usr)&&/- Selin: Woman — [^\n]*red curls/.test(TX.usr)&&/Emre \(the player\)/.test(TX.usr)&&/Describe each person SEPARATELY/.test(TX.usr), TX.usr.slice(0,900));
  ok("and the speaker's look is not stamped on the tail, where it could belong to anyone", !/black bob/.test(TXprompt), TXprompt);
  const G=await shot("window.__rule={label:'Group',cast:'group',pov:false,promptStyle:''};");
  ok("a group scene type sends everyone in the scene, the player included when it is not his eyes", JSON.stringify(G.people.map(p=>p.n).sort())==='["Ayla","Deniz","Emre","Selin"]', JSON.stringify(G.people));
  ok("the rule editor offers one 'everyone in the scene' choice", await pg.evaluate(()=>
     JSON.stringify(CAST_EDITOR_MODES)==='["solo","player","none"]' && /Everyone in the scene/.test(CAST_LABELS.player)));
  ok("the cast prompt is a registry prompt on the image writer's card", await pg.evaluate(()=>
      !!PROMPT_BY_KEY.x_img_cast && !!K.x_img_cast && ENGINE_PAYLOAD_DEFS.some(d=>(d.blocks||[]).some(x=>x.promptKey==="x_img_cast")&&(d.blocks||[]).some(x=>x.promptKey==="imgFrameGuide"))));

  /* v148.3 — asked: "their faces are different but the clothing is the same — what they wear should be
     given specifically; dialogue is not needed for image generation; when more than one character has
     spoken before the player, each one's narration should be sent stating whose it is." */
  console.log("\n[person by person: what each is doing and wearing, and no dialogue]");
  const PP=await shot("window.__rule={label:'Group',cast:'group',pov:false,promptStyle:''};"
    +"const c=curChat(); c.wearing={p_a:{text:'an emerald silk dress',key:_wearKey(c)}};"
    +"state.personas.find(p=>p.id==='p_s').wardrobe='a grey wool coat over a red jumpsuit';"
    +"state.universes[0].userWardrobe='a navy suit, white shirt'; c.universeId=state.universes[0].id;");
  const W=PP.usr;
  ok("each person's clothes are listed under their own label", /WHAT EACH PERSON IS WEARING/.test(W)
     // v148.4 — "draw exactly this" became "draw these garments": props in an outfit text are only suggestions
     &&/- the woman in IMAGE 1 = Ayla — already decided, draw these garments: an emerald silk dress/.test(W)
     &&/- the woman in IMAGE 3 = Selin — choose ONE outfit from what they own[^\n]*grey wool coat over a red jumpsuit/.test(W)
     &&/- the man in IMAGE 2 = Emre \(the player\) — choose ONE outfit[^\n]*navy suit/.test(W)
     &&/- the man in IMAGE 4 = Deniz — nothing given: choose clothes/.test(W), W.slice(0,2400));
  ok("and the writer is told never to dress two people alike", /never dress two people alike or swap a garment between them/.test(W), "");
  ok("the old unlabelled 'what they are wearing' block is not sent beside it", !/WHAT THEY ARE WEARING right now/.test(W), W.slice(0,1600));
  ok("what each person is doing: those who acted this round point to their labelled line, the rest are placed apart",
     /WHAT EACH PERSON IN THE FRAME IS DOING/.test(W)&&/- the woman in IMAGE 1 = Ayla, whose line this picture is for: their own line in the LATEST EXCHANGE below/.test(W)
     &&/- the woman in IMAGE 3 = Selin: their own line in the LATEST EXCHANGE below/.test(W)
     &&/- the man in IMAGE 4 = Deniz: \(no action of their own — place them naturally, NOT in anyone else's pose\)/.test(W), W.slice(0,2400));
  const LX=W.slice(W.indexOf("LATEST EXCHANGE (what just happened"));
  ok("the latest exchange has every line of the round, each under its speaker's label (the reported case)",
     /Selin \(the woman in IMAGE 3\): \(speaks\)/.test(LX)&&/Ayla \(the woman in IMAGE 1\): She leans toward Emre\./.test(LX), LX);
  ok("dialogue is taken out everywhere", !/governor at the gate/.test(W)&&!/tell him what you saw/.test(W), W.slice(-600));
  const P3=await pg.evaluate(()=>[
    _imgVisualOnly('*She sets the cup down.* "I told you so." *Then she laughs.*'),
    _imgVisualOnly('"Only words here."'),
    _imgVisualOnly('_I hate this._ He turns to the window, “fine,” he says.'),
    _imgVisualOnly('/whisper Ayla Demir *slides a note across* "read it"')]);
  ok("a line as the camera sees it: narration kept; speech, thoughts and the whisper command gone",
     JSON.stringify(P3)==='["She sets the cup down. Then she laughs.","","He turns to the window, he says.","slides a note across"]', JSON.stringify(P3));
  const EAR=await shot("window.__rule={label:'Group',cast:'group',pov:false,promptStyle:''};"
    +"const c=curChat(); c.messages.unshift({mid:'m0',role:'assistant',speaker:'Deniz',speakerId:'p_d',content:'*Deniz leans on the doorframe, arms crossed.* \"Well?\"',present:c.presentIds.slice()},{mid:'u0',role:'user',content:'*I sit down.*',present:c.presentIds.slice()});");
  ok("someone who acted earlier in the scene (before the player's last line) keeps their own action, marked as earlier",
     /- the man in IMAGE 4 = Deniz: \(earlier in the scene\) Deniz leans on the doorframe, arms crossed\./.test(EAR.usr)
     &&/Emre \(the man in IMAGE 2\): I sit down\./.test(EAR.usr.slice(EAR.usr.indexOf("LATEST EXCHANGE (what"))), EAR.usr.slice(0,2400));
  const ONE=await shot("window.__rule={label:'Portrait',cast:'solo',pov:false,promptStyle:''}; curChat().presentIds=['p_a']; curChat().messages.forEach(m=>m.present=['p_a']);");
  ok("a one-person frame gets no per-person blocks", !/WHAT EACH PERSON/.test(ONE.usr), ONE.usr.slice(0,400));

  console.log("\n[a generate-image icon under every reply]");
  const IB=await pg.evaluate(async()=>{
    // v150.9 — the icon opens the scene picker first (tests/img-scene-picker.browser.js)
    const c=curChat(); let called=null; const real=window.pickSceneAndIllustrate; window.pickSceneAndIllustrate=mid=>{ called=mid; };
    c.messages=[{mid:"g1",role:"user",content:'"hi"',present:[]},
      {mid:"g2",role:"assistant",speaker:"Ayla",speakerId:"p_a",content:'"hello"',present:[]},
      {mid:"g3",role:"assistant",speaker:"Ayla",speakerId:"p_a",content:"a text",textMsg:true,textWith:"p_a",present:[]}];
    show('chat'); renderChat(); await new Promise(r=>setTimeout(r,300));
    const q=mid=>document.querySelector('.bubble[data-mid="'+mid+'"] .msgActions [data-genimg]');
    const btn=q("g2"), row=btn&&btn.closest('.msgActions');
    const sib=row&&row.querySelector('[data-dub]');
    const r={reply:!!btn,user:!!q("g1"),svg:!!(btn&&btn.querySelector('svg')),text:(btn&&btn.textContent.trim())||"",
      sameRow:!!sib, sameSize:!!(btn&&sib&&Math.abs(btn.getBoundingClientRect().height-sib.getBoundingClientRect().height)<1&&Math.abs(btn.getBoundingClientRect().top-sib.getBoundingClientRect().top)<1)};
    if(btn)btn.click(); r.called=called; window.pickSceneAndIllustrate=real;
    return r;
  });
  ok("every character reply has a generate-image icon in its action row", IB.reply===true && IB.sameRow===true, JSON.stringify(IB));
  ok("it is an icon only, the same size and line as the others", IB.svg===true && IB.text==="" && IB.sameSize===true, JSON.stringify(IB));
  ok("the player's own line has none", IB.user===false, JSON.stringify(IB));
  ok("tapping it asks which scene for that reply's picture", IB.called==="g2", JSON.stringify(IB));

  await pg.evaluate(()=>{ Object.assign(window,window.__real); });
  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log(`\n  ${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail?1:0);
})();
