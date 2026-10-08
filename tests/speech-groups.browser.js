/* v150.61 — LIKES, AND SPEECH & BEHAVIOUR IN THREE GROUPS.
   "Core traits" (ten "State: trigger → behavior" lines in the identity sheet) became "Likes, dislikes & interests"; how a
   character speaks and what they do moved into three groups: Spoken (solo, multi, gamemaster), Text and Heat. Each group
   has a main box and one box per emotion in Settings → Emotions. What a box shows is what is sent; there is no "All
   paths" box and no fallback. Checked here:
     · the editor: three groups, no All; switching keeps what was typed; save writes p.speech and p.likes and leaves the
       old fields as they were;
     · the reply: each path reads its group (spoken for solo, multi, gm), the picked emotion's box, a blank box sends
       nothing (no fallback to another group);
     · the migration (once per character, at load and on import): old style / styleBy / styleEmoBy and the behaviour
       lines into the three groups, and FAITHFULNESS: every sentence the old payload sent on a path is still sent there;
     · likes in the speaker's own sheet and in the sheet others read; the "Who you are" fragment migration;
     · the writer's three groups, an older writer's answer and an older card generator's "traits".
   The model is stubbed.  Run: node tests/speech-groups.browser.js */
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

  // The old character: everything the v150.60 payload read (main style, a style per path, per emotion for all paths and
  // per path, and the ten behaviour lines).
  const OLD={id:"p_old",name:"Ayla",style:"You speak in short, dry sentences. You rarely ask questions.",
    styleBy:{multi:"In company you go quieter. You let others finish first.",gm:"News makes you blunt. You say what it costs.",text:"You text in lowercase. No full stops.",heat:"You speak in fragments. Breath between words."},
    styleEmoBy:{all:{Anger:"Clipped and cold. You stop explaining.",Joy:"You talk more than usual. You tease."},
      multi:{Anger:"Icy politeness in front of others."},heat:{Desire:"Slow and low. You say names."},text:{Joy:"Extra exclamation marks!"}},
    traits:"Default: nothing is asked of you → easy, unhurried, good company.\nJoyful: something you built comes out right → you want someone to come and look.\nAngry: it is implied you failed someone → you go cold and short.\nGuilty: someone notices you were not there → you pay it back in work.\nAshamed: seen as less than you claim → you make it small with a joke.\nJealous: someone you count as yours is easy with another → you get warmer and funnier.\nAfraid: a conversation is coming you cannot fix → you find work elsewhere.\nRejected: your help is waved off → you shrug it off, then carry it for days.\nIn conflict: someone needs more than you have → you agree to all of it, flatly.\nIntimate: alone with someone who wants nothing from you → your guard drops."};

  await pg.evaluate(OLD=>{
    window.__OLD=OLD;
    const uni=state.universes[0];
    state.user="Emre"; state.userBio="Emre is a carpenter."; state.userLook="Tall.";
    state.payloadTplOn=false; state.fragments=null; state.autoSpeak=false; state.narrMode=false; state.narrOn=false;
    state.trackOn=false; state.memory=[]; state.relOn=false; state.intentOn=false; state.promiseOn=false; state.gossip=[]; state.emotions=null;
    store.setRaw(K.fragAdds,FRAG_SHIPPED_ADDS.map(a=>a.key).join(",")); state.blockTpls={};
    window.__base=(persona)=>{
      state.personas=[Object.assign({universeId:uni.id,personality:"You are sharp.",backstory:"You grew up by the docks.",look:{hair:"red hair"}},JSON.parse(JSON.stringify(persona))),
        {id:"p_b",name:"Berk",universeId:uni.id,personality:"Berk is loud.",look:{},likes:"Likes: football",speech:{spoken:{main:"Loud.",emo:{}}},_speechMigrated:"v150.61"}];
      const c=curChat(); ["_heatBeat","activeEvent","watchingNow","dayLog","spokenLimits"].forEach(k=>{ delete c[k]; });
      Object.assign(c,{universeId:uni.id,presentIds:["p_old","p_b"],emo:{},promises:[],wearing:{},calendar:[],intents:[],rel:{},gameDay:3,period:"Evening",
        locationId:null,location:"",subId:null,subPos:{},
        messages:[{mid:"u1",role:"user",content:'"Hi there."'},{mid:"a1",role:"assistant",speaker:"Ayla",speakerId:"p_old",content:'"Hello."'},{mid:"u2",role:"user",content:'"So?"'}]});
      return c; };
    // the whole reply payload on a path, with the speaker feeling `emo` (or nothing)
    window.__payload=(kind,emo,persona)=>{
      const c=__base(persona||__OLD); if(kind==="heat")c._heatBeat={n:2,total:5};
      if(kind==="text")c.messages.forEach(m=>{ m.textMsg=true; m.textWith="p_old"; });
      if(emo)c.emo={p_old:{emotion:emo,intensity:"clear"}};
      const p=state.personas[0], others=presentCast(c).filter(x=>x.id!==p.id);
      const inj={recent:[],diary:[],longterm:[]};
      const hopts={chat:c,targetName:"Emre",targetId:"__user__",textMode:kind==="text",payloadKind:kind};
      const topts={chat:c,selfP:p,selfId:p.id,selfName:p.name,targetName:"Emre",targetId:"__user__",multi:kind==="multi",injected:inj,textMode:kind==="text",payloadKind:kind};
      const mk=()=>Object.assign({},buildCharPromptBlocks(p,others,inj,null,hopts),buildTailBlocks(topts));
      const m=ptBuildMessages(kind,mk(),[{role:"user",content:"(history)"}],{chat:c,npc:p,targetName:"Emre"},mk)||[];
      return m.map(x=>x.content).join("\n\n");
    };
  },OLD);

  console.log("\n[the editor: three groups, no All]");
  const ED=await pg.evaluate(()=>{
    __base(__OLD); editPersona("p_old");
    const seg=document.getElementById('peSpeechSeg');
    const labels=seg?Array.from(seg.querySelectorAll('button')).map(b=>b.textContent.trim()):[];
    const boxes=document.getElementById('peSpeechBoxes');
    const emoBoxes=boxes?boxes.querySelectorAll('.psEmo').length:0;
    const lbl=boxes?Array.from(boxes.querySelectorAll('label')).map(l=>l.textContent.replace(/\s+/g," ").trim()):[];
    const gone=["peStyle","peStyleMore","peStylePath","peTraits","peStyleBoxes"].filter(id=>document.getElementById(id));
    return {labels,emoBoxes,n:emotionList().length,main:boxes&&boxes.querySelector('.psMain').value,lbl,gone,
      all:/All paths/.test(document.getElementById('personaModal').textContent),likesPh:document.getElementById('peLikes').placeholder}; });
  ok("Spoken, Text, Heat — and no All", JSON.stringify(ED.labels)==='["Spoken","Text","Heat"]'&&!ED.all&&ED.gone.length===0, JSON.stringify(ED));
  ok("one main box and one box per emotion in Settings → Emotions, each labelled with what it is for",
    ED.emoBoxes===ED.n&&/^Main — how you speak and what you do, on solo, group and gamemaster replies/.test(ED.lbl[0])&&ED.lbl.some(l=>/^Anger — how you speak and what you do when you mainly feel anger/.test(l)), JSON.stringify(ED.lbl.slice(0,3)));
  ok("the old character's boxes show what that path was sent (spoken: the main style, the group's and the reaction's own, the behaviour lines)",
    /^You speak in short, dry sentences\. You rarely ask questions\.\n\nIn a group: In company you go quieter[^\n]*\n\nReacting to something that happened: News makes you blunt[^\n]*\n\n### Behaviour\n- Default: /.test(ED.main), ED.main);
  ok("the likes box asks for likes, dislikes, hobbies, habits, favourite things and pet peeves", /Likes: …\nDislikes: …\nHobbies & pastimes: …\nHabits: …\nFavourite things: …\nPet peeves: …/.test(ED.likesPh), ED.likesPh);
  const SW=await pg.evaluate(()=>{
    const box=()=>document.getElementById('peSpeechBoxes'), em=n=>box().querySelector(`.psEmo[data-emo="${n}"]`);
    peSpeechSwitch("heat"); const heatMain=box().querySelector('.psMain').value, heatDesire=em("Desire").value;
    box().querySelector('.psMain').value="HEAT TYPED"; em("Fear").value="HEAT FEAR TYPED";
    peSpeechSwitch("text"); const textMain=box().querySelector('.psMain').value; box().querySelector('.psMain').value="TEXT TYPED"; em("Anger").value="";
    peSpeechSwitch("heat"); const back=[box().querySelector('.psMain').value,em("Fear").value];
    peSpeechSwitch("text"); const back2=[box().querySelector('.psMain').value,em("Anger").value];
    const on=Array.from(document.querySelectorAll('#peSpeechSeg button.on')).map(b=>b.dataset.g);
    document.getElementById('peLikes').value="Likes: strong tea\nPet peeves: being rushed";
    savePersona(); const p=state.personas.find(x=>x.id==="p_old");
    return {heatMain,heatDesire,textMain,back,back2,on,speech:p.speech,likes:p.likes,old:{style:p.style,styleBy:p.styleBy,styleEmoBy:p.styleEmoBy,traits:p.traits},mig:p._speechMigrated}; });
  ok("heat and text show their own main style and emotion boxes", /^You speak in fragments\. Breath between words\.\n\n### Behaviour/.test(SW.heatMain)&&SW.heatDesire==="Slow and low. You say names."&&/^You text in lowercase\. No full stops\./.test(SW.textMain), JSON.stringify(SW).slice(0,500));
  ok("switching groups keeps what was typed, and the switch shows the group", SW.back[0]==="HEAT TYPED"&&SW.back[1]==="HEAT FEAR TYPED"&&SW.back2[0]==="TEXT TYPED"&&SW.back2[1]===""&&JSON.stringify(SW.on)==='["text"]', JSON.stringify(SW.back.concat(SW.back2,SW.on)));
  ok("save writes p.speech (a cleared box is gone) and p.likes", SW.speech.heat.main==="HEAT TYPED"&&SW.speech.heat.emo.Fear==="HEAT FEAR TYPED"&&SW.speech.text.main==="TEXT TYPED"&&!("Anger" in SW.speech.text.emo)
    &&/^You speak in short/.test(SW.speech.spoken.main)&&SW.likes==="Likes: strong tea\nPet peeves: being rushed"&&SW.mig==="v150.61", JSON.stringify(SW.speech).slice(0,600));
  ok("the old fields are left exactly as they were (the undo copy)", JSON.stringify(SW.old)===JSON.stringify({style:OLD.style,styleBy:OLD.styleBy,styleEmoBy:OLD.styleEmoBy,traits:OLD.traits}), JSON.stringify(SW.old).slice(0,300));

  console.log("\n[the reply reads the group for its path]");
  const SP={id:"p_old",name:"Ayla",likes:"",_speechMigrated:"v150.61",speech:{spoken:{main:"SPOKEN MAIN.",emo:{Anger:"SPOKEN ANGER."}},text:{main:"TEXT MAIN.",emo:{Anger:"TEXT ANGER."}},heat:{main:"HEAT MAIN.",emo:{Desire:"HEAT DESIRE."}}}};
  const R=await pg.evaluate(SP=>{ const out={};
    ["solo","multi","gm","text","heat"].forEach(k=>{ out[k]=__payload(k,k==="heat"?"Desire":"Anger",SP); out[k+"_none"]=__payload(k,"Joy",SP); });
    return out; },SP);
  const has=(t,x)=>t.indexOf(x)>=0;
  ok("solo, multi and gamemaster read Spoken: its main box and the picked emotion's box", ["solo","multi","gm"].every(k=>has(R[k],"SPOKEN MAIN.")&&has(R[k],"SPOKEN ANGER.")&&!has(R[k],"TEXT MAIN.")&&!has(R[k],"HEAT MAIN.")), ["solo","multi","gm"].map(k=>(R[k].match(/SPOKEN[^\n]*|TEXT[^\n]*|HEAT[^\n]*/g)||[]).join("|")).join(" / "));
  ok("text reads Text, heat reads Heat", has(R.text,"TEXT MAIN.")&&has(R.text,"TEXT ANGER.")&&!has(R.text,"SPOKEN")&&has(R.heat,"HEAT MAIN.")&&has(R.heat,"HEAT DESIRE.")&&!has(R.heat,"SPOKEN"), (R.text.match(/TEXT[^\n]*|SPOKEN[^\n]*/g)||[]).join("|")+" / "+(R.heat.match(/HEAT[^\n]*|SPOKEN[^\n]*/g)||[]).join("|"));
  ok("an emotion with a blank box sends no emotion text", ["solo","text","heat"].every(k=>!/ANGER\.|DESIRE\./.test(R[k+"_none"])&&has(R[k+"_none"],k==="solo"?"SPOKEN MAIN.":k.toUpperCase()+" MAIN.")), "");
  const BL=await pg.evaluate(()=>{ const P={id:"p_old",name:"Ayla",_speechMigrated:"v150.61",style:"OLD MAIN STYLE.",styleEmoBy:{all:{Anger:"OLD ALL ANGER."}},
      speech:{spoken:{main:"ONLY SPOKEN.",emo:{Anger:"ONLY SPOKEN ANGER."}},text:{main:"",emo:{}},heat:{main:"",emo:{}}}};
    const t=__payload("text","Anger",P), h=__payload("heat","Anger",P);
    const c=__base(P); c.emo={p_old:{emotion:"Anger",intensity:"clear"}}; const ss=buildTailBlocks({chat:c,selfP:state.personas[0],selfId:"p_old",selfName:"Ayla",targetName:"Emre",targetId:"__user__",textMode:true,payloadKind:"text",injected:{recent:[],diary:[],longterm:[]}})._ss;
    return {t:/ONLY SPOKEN|OLD MAIN|OLD ALL/.test(t),h:/ONLY SPOKEN|OLD MAIN|OLD ALL/.test(h),ss:ss||null}; });
  ok("a blank box sends nothing: no fallback to another group, nor to the old fields", !BL.t&&!BL.h&&BL.ss===null, JSON.stringify(BL));

  console.log("\n[the migration]");
  const MG=await pg.evaluate(()=>{ const p=JSON.parse(JSON.stringify(__OLD)); speechMigrate(p); return p; });
  const S=MG.speech;
  ok("spoken: the solo style, then the group's and the reaction's own where they differ, labelled", /^You speak in short, dry sentences\. You rarely ask questions\.\n\nIn a group: In company you go quieter\. You let others finish first\.\n\nReacting to something that happened: News makes you blunt\. You say what it costs\./.test(S.spoken.main), S.spoken.main);
  ok("text and heat: their own style (else the main one)", /^You text in lowercase\. No full stops\./.test(S.text.main)&&/^You speak in fragments\./.test(S.heat.main), S.text.main+" | "+S.heat.main);
  ok("each emotion: its path's box, else the all-paths box; spoken adds the group's own, labelled", /^Clipped and cold\. You stop explaining\.\n\nIn a group: Icy politeness in front of others\./.test(S.spoken.emo.Anger)&&/^Clipped and cold/.test(S.text.emo.Anger)
    &&/^Extra exclamation marks!/.test(S.text.emo.Joy)&&/^You talk more than usual/.test(S.spoken.emo.Joy)&&S.heat.emo.Desire==="Slow and low. You say names."&&!S.spoken.emo.Desire, JSON.stringify(S).slice(0,900));
  ok("behaviour lines: Angry → Anger, Joyful → Joy, Afraid → Fear, Guilty → Guilt, Ashamed → Shame, Jealous → Jealousy, in all three groups",
    ["spoken","text","heat"].every(g=>/### Behaviour\n- Angry: it is implied/.test(S[g].emo.Anger)&&/### Behaviour\n- Joyful:/.test(S[g].emo.Joy)&&/^### Behaviour\n- Afraid:/.test(S[g].emo.Fear)
      &&/^### Behaviour\n- Guilty:/.test(S[g].emo.Guilt)&&/^### Behaviour\n- Ashamed:/.test(S[g].emo.Shame)&&/^### Behaviour\n- Jealous:/.test(S[g].emo.Jealousy)), JSON.stringify(S.heat.emo).slice(0,700));
  ok("Default, Rejected, In conflict and Intimate go to each main box, as they were", ["spoken","text","heat"].every(g=>/### Behaviour\n- Default: nothing is asked of you → easy, unhurried, good company\.\n- Rejected: [^\n]*\n- In conflict: [^\n]*\n- Intimate: [^\n]*$/.test(S[g].main)&&!/Angry:/.test(S[g].main)), S.text.main);
  ok("likes start empty; the old fields stay; it is marked and runs once", MG.likes===""&&MG.traits===OLD.traits&&MG.style===OLD.style&&MG._speechMigrated==="v150.61"
    &&await pg.evaluate(()=>{ const p=JSON.parse(JSON.stringify(__OLD)); speechMigrate(p); p.speech.spoken.main="EDITED"; return speechMigrate(p)===false&&p.speech.spoken.main==="EDITED"; }), JSON.stringify({likes:MG.likes,mig:MG._speechMigrated}));
  ok("emotion names are matched without case against the user's list; a state whose emotion is not in it goes to the main box", await pg.evaluate(()=>{
      const list=[{name:"anger",desc:"x",tones:["a","b","c"]},{name:"Joy",desc:"y",tones:[]}];
      const sp=speechFromOld({style:"S",traits:"Angry: a → b\nAfraid: c → d\nANGER: e → f\nJoyful: g → h"},list);
      return (/- Angry: a → b\n- ANGER: e → f/.test(sp.spoken.emo.anger)&&/- Afraid: c → d/.test(sp.spoken.main)&&/- Joyful: g → h/.test(sp.text.emo.Joy)&&!sp.spoken.emo.Fear)?true:JSON.stringify(sp); }));

  /* FAITHFULNESS: for every path and every emotion the pick can give (and none), every sentence the v150.60 payload sent
     from the old fields is in the new payload of the migrated character. The old payload: the path's style (styleBy, else
     style), the emotion's style (styleEmoBy[path], else .all), and every behaviour line (the bio sent them on every turn).
     The behaviour lines of an emotion state are sent when that emotion is picked (they are in its box now). */
  const F=await pg.evaluate(()=>{
    const O=__OLD, list=emotionList().map(e=>e.name), miss=[]; let checked=0;
    const sents=t=>String(t||"").split(/\n+|(?<=[.!?])\s+/).map(x=>x.trim()).filter(x=>x.length>2);
    const lines=String(O.traits).split(/\n+/).map(x=>x.trim()).filter(Boolean);
    const emoOf=l=>{ const lab=l.split(":")[0].trim().toLowerCase(); const want=TRAIT_STATE_EMO[lab]; return want?list.find(n=>n.toLowerCase()===want)||null:null; };
    ["solo","multi","gm","text","heat"].forEach(path=>[null].concat(list).forEach(E=>{
      const oldMain=(O.styleBy[path]||O.style), oldEmo=E?((O.styleEmoBy[path]||{})[E]||(O.styleEmoBy.all||{})[E]||""):"";
      const want=sents(oldMain).concat(sents(oldEmo)), wantLines=lines.filter(l=>{ const e=emoOf(l); return !e||e===E; });
      const P=__payload(path,E,O);
      want.forEach(x=>{ checked++; if(P.indexOf(x)<0)miss.push(path+"/"+(E||"-")+": "+x); });
      wantLines.forEach(x=>{ checked++; if(P.indexOf(x)<0)miss.push(path+"/"+(E||"-")+": "+x.slice(0,40)); });
    }));
    return {checked,miss}; });
  ok("faithful: in all "+F.checked+" checks over five paths and every emotion, what the old payload sent is still sent", F.checked>=400&&F.miss.length===0, F.miss.slice(0,8).join("\n        "));
  const OLDP=await pg.evaluate(()=>__payload("solo","Anger",__OLD));
  ok("and the behaviour lines left the identity sheet (they are in the speech groups now)", !/how_you_behave/.test(OLDP)&&/In conflict: someone needs more than you have/.test(OLDP), (OLDP.match(/# THIS IS WHO YOU ARE[\s\S]{0,400}/)||[""])[0]);

  const LD=await (async()=>{
    await pg.evaluate(async()=>{ const p=JSON.parse(JSON.stringify(__OLD)); p.id="p_load"; p.universeId=state.universes[0].id;
      state.personas=state.personas.filter(x=>x.id!=="p_load").concat([p]); await _kvPersist("personas",()=>state.personas); });
    await pg.reload(); await pg.waitForTimeout(2600);
    return pg.evaluate(()=>{ const p=state.personas.find(x=>x.id==="p_load"); return p?{sp:p.speech,mig:p._speechMigrated,traits:p.traits,styleBy:p.styleBy}:null; }); })();
  ok("at load: an old character gets its groups once, and keeps its old fields", LD&&LD.mig==="v150.61"&&/^You speak in short/.test(LD.sp.spoken.main)&&/Clipped and cold/.test(LD.sp.text.emo.Anger)&&LD.traits===OLD.traits&&JSON.stringify(LD.styleBy)===JSON.stringify(OLD.styleBy), JSON.stringify(LD).slice(0,400));

  // the stubs and helpers were dropped by the reload; set up again
  await pg.evaluate(OLD=>{ window.__OLD=OLD; window.uiConfirm=async()=>true; state.user="Emre"; },OLD);
  ok("importing an old card runs the same migration", await pg.evaluate(async()=>{
      const p=JSON.parse(JSON.stringify(__OLD)); p.id="p_imp"; p.universeId=state.universes[0].id;
      await importRoleplayFile({kind:"roleplay",universe:null,personas:[p],chats:{},memory:[]},null);
      const q=state.personas.find(x=>x.id==="p_imp");
      return (q&&q._speechMigrated==="v150.61"&&/### Behaviour\n- Jealous:/.test(q.speech.spoken.emo.Jealousy)&&q.traits===__OLD.traits)?true:JSON.stringify(q&&q.speech).slice(0,300); }));

  console.log("\n[likes in the identity sheet]");
  const LK=await pg.evaluate(()=>{ const P={id:"p_l",name:"Selin",likes:"Likes: strong tea\nPet peeves: being rushed",_speechMigrated:"v150.61",speech:{spoken:{main:"You speak plainly.",emo:{}}}};
    const self=charBioBlock(P,{self:true}), other=charBioBlock(P,{self:false}), out={};
    charBioBlock(P,{self:true,noWho:true,styleTail:true,out});
    return {self,other,raw:out.bio_likes_raw,fragHas:/<what_you_like>[^<]*\{\{call\/\/bio_likes_raw\}\}/.test(JSON.stringify(FRAG_DEFAULTS.find(f=>f.id==="bio"))),
      fragOld:/how_you_behave|bio_traits_raw/.test(JSON.stringify(FRAG_DEFAULTS.find(f=>f.id==="bio")))}; });
  ok("the speaker's own sheet: <what_you_like>, second person, one line each", /<what_you_like>What you like and dislike, and what you do with your time\.[^\n]*\n    Likes: strong tea\n    Pet peeves: being rushed\n  <\/what_you_like>/.test(LK.self)&&!/how_you_behave/.test(LK.self), LK.self);
  ok("the sheet others read: about Selin, by name", /<what_you_like>What Selin likes and dislikes, and does with their time\. This is Selin's own sheet[^\n]*\n    Likes: strong tea/.test(LK.other)&&/<speaking_style>You speak plainly\.<\/speaking_style>/.test(LK.other), LK.other);
  ok("the \"Who you are\" fragment holds the wording and calls bio_likes_raw (data only)", LK.fragHas&&!LK.fragOld&&LK.raw==="    Likes: strong tea\n    Pet peeves: being rushed", JSON.stringify(LK.raw));
  ok("a saved list: the v150.60 \"Who you are\" is replaced; an edited one gets the likes paragraph in place of the behaviour one, the rest kept", await pg.evaluate(()=>{
      const L0=FRAG_DEFAULTS.map(f=>JSON.parse(JSON.stringify(FRAG_DEFAULTS_V150_61_OLD[f.id]||f)));
      state.fragments=L0; store.setRaw(K.fragAdds,FRAG_SHIPPED_ADDS.map(a=>a.key).filter(k=>k!=="v150.61.likes").join(",")); _fragMigratedFor=null;
      const a=_fragCanon(fragList().find(f=>f.id==="bio"))===_fragCanon(FRAG_DEFAULTS.find(f=>f.id==="bio"));
      const L1=FRAG_DEFAULTS.map(f=>JSON.parse(JSON.stringify(FRAG_DEFAULTS_V150_61_OLD[f.id]||f))); const bi=L1.findIndex(f=>f.id==="bio"); L1[bi].options[0].text+="\n\nMY OWN LINE.";
      state.fragments=L1; store.setRaw(K.fragAdds,FRAG_SHIPPED_ADDS.map(a=>a.key).filter(k=>k!=="v150.61.likes").join(",")); _fragMigratedFor=null;
      const t=fragList().find(f=>f.id==="bio").options[0].text;
      const b2=/MY OWN LINE\./.test(t)&&/<what_you_like>[^<]*\{\{call\/\/bio_likes_raw\}\}/.test(t)&&!/how_you_behave/.test(t);
      state.fragments=null; _fragMigratedFor=null; store.setRaw(K.fragments,""); store.setRaw(K.fragAdds,FRAG_SHIPPED_ADDS.map(a=>a.key).join(","));
      return (a&&b2)?true:JSON.stringify({a,b2,t:t.slice(0,300)}); }));

  console.log("\n[the writers]");
  await pg.evaluate(()=>{ window.__calls=[]; state.key="k"; state.storyLang="tr";
    window.chatCompletion=async(msgs,model,opts)=>{ const d=(opts&&opts.dbg)||""; __calls.push({d,msgs,opts});
      if(/^Speaking styles writer/.test(d))return typeof __W==="string"?__W:JSON.stringify(__W);
      if(d==="Character bio generator")return JSON.stringify(__BIO);
      return "{}"; }; });
  const WR=await pg.evaluate(async()=>{
    window.__W={spoken:{main:"## SPEECH: HOW YOU TALK\nYou speak plain Turkish.\n### Baseline\n- Short: \"Kapı açık.\"",emotions:{Anger:"### When you mainly feel Anger\n- Shorter: \"Yeter.\"",Joy:"J"}},
      text:{main:"## TEXTING\n- lowercase: \"tmm\"",emotions:{Anger:"TA"}},heat:{main:"## HEAT",emotions:{Desire:"HD",Bogus:"x"}}};
    const set=await writeStyleSet({name:"Selin",personality:"You are brisk."},{universe:state.universes[0]});
    const sys=__calls[0].msgs[0].content, max=__calls[0].opts.max;
    window.__W={paths:{multi:"OLD MULTI",text:"OLD TEXT",heat:"OLD HEAT"},emotions:{anger:"OLD ANGER"},heat_emotions:{Desire:"OLD DESIRE"}};
    const old=await writeStyleSet({name:"Selin",personality:"You are brisk.",speech:{spoken:{main:"MY MAIN",emo:{}},text:{main:"MY TEXT",emo:{}},heat:{main:"MY HEAT",emo:{}}}},{});
    return {set,old,sys,max}; });
  ok("the writer's answer becomes the three groups (an emotion not in the list is dropped)", WR.set&&/Kapı açık/.test(WR.set.spoken.main)&&WR.set.spoken.emo.Anger.indexOf("Yeter")>=0&&WR.set.text.emo.Anger==="TA"&&WR.set.heat.emo.Desire==="HD"&&!("Bogus" in WR.set.heat.emo), JSON.stringify(WR.set).slice(0,500));
  ok("its prompt asks for speech AND behaviour in three groups, with example lines in the story's language, and has room for it",
    /SPEAKS AND BEHAVES/.test(WR.sys)&&/"spoken":\{"main"/.test(WR.sys)&&/"text":\{"main"/.test(WR.sys)&&/"heat":\{"main"/.test(WR.sys)&&/1-3 short example lines IN Turkish/.test(WR.sys)
    &&/what they DO/.test(WR.sys)&&!/never write what they do or decide/.test(WR.sys)&&!/at most one short example per entry/.test(WR.sys)&&WR.max>=9000, WR.sys.slice(0,400));
  ok("an older writer's answer (paths / emotions / heat_emotions) is read the way the migration reads it, over the card's own main box",
    WR.old&&WR.old.spoken.main==="MY MAIN\n\nIn a group: OLD MULTI"&&WR.old.text.main==="OLD TEXT"&&WR.old.heat.main==="OLD HEAT"&&WR.old.spoken.emo.Anger==="OLD ANGER"&&WR.old.text.emo.Anger==="OLD ANGER"&&WR.old.heat.emo.Desire==="OLD DESIRE", JSON.stringify(WR.old));
  const BI=await pg.evaluate(async()=>{
    window.__BIO={name:"Nur",avatar:"🌿",personality:"You are kind.",style:"You speak softly.",traits:"Default: x → y\nAngry: a → b",goals:"g",backstory:"b",look:{},instructions:"i",interject:"j"};
    const old=await generateBio("x",null,{universe:state.universes[0]});
    window.__BIO={name:"Nur",avatar:"🌿",personality:"You are kind.",style:"You speak softly.",likes:"Likes: figs\nDislikes: noise",goals:"g",backstory:"b",look:{},instructions:"i",interject:"j"};
    const now=await generateBio("x",null,{universe:state.universes[0]});
    return {old:old&&old.speech,now:now&&{likes:now.likes,speech:now.speech}}; });
  ok("an older card generator's \"traits\" go through the same mapping (the Angry line to Anger, Default to the main box)",
    BI.old&&/^You speak softly\.\n\n### Behaviour\n- Default: x → y$/.test(BI.old.spoken.main)&&/- Angry: a → b/.test(BI.old.heat.emo.Anger), JSON.stringify(BI.old));
  ok("today's card generator gives likes, and its style as each group's main box", BI.now&&BI.now.likes==="Likes: figs\nDislikes: noise"&&["spoken","text","heat"].every(g=>BI.now.speech[g].main==="You speak softly."), JSON.stringify(BI.now));
  ok("the card writers ask for likes, not the behaviour profile", await pg.evaluate(()=>[DEFAULT_BIO,DEFAULT_BATCH_BIO,DEFAULT_UNIV].every(t=>/"likes":/.test(t)&&!/"traits":/.test(t)&&!/BEHAVIOR PROFILE/.test(t)&&/Pet peeves/.test(t))));

  console.log("\n[stored prompts]");
  const rt=async(key,v)=>{ await pg.evaluate(a=>store.setRaw(K[a.key],a.v),{key,v}); await pg.reload(); await pg.waitForTimeout(2200); return pg.evaluate(k=>state[k],key); };
  const OLDW='You write how {{char}} SPEAKS, for a roleplay character card. ... Return ONLY this JSON:\n{"paths":{"multi":"…"},\n "emotions":{},\n "heat_emotions":{}}';
  ok("a stored copy of the old styles writer is refreshed", (await rt("x_style_writer",OLDW))===(await pg.evaluate(()=>X_ENGINE_PROMPTS.x_style_writer.def)));
  ok("a stored copy of the old card writer is refreshed", (await rt("bioPrompt","You are a character-card writer for an adult roleplay app. Given a short user brief … For \"traits\", write a compact BEHAVIOR PROFILE — ten lines"))===(await pg.evaluate(()=>DEFAULT_BIO)));
  ok("one the user wrote is left alone", (await rt("x_style_writer","My own styles prompt."))==="My own styles prompt.");
  ok("no refresh pipe stood down", await pg.evaluate(()=>{ const sp=window.__stalePipes||[]; return sp.length===0?true:"stale: "+sp.join(", "); }));
  ok("no page errors", errs.length===0?true:errs.join(" | "));
  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close(); process.exit(fail?1:0);
})();
