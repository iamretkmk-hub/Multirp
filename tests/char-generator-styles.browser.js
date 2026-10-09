/* v150.40 — THE CHARACTER GENERATOR WRITES WHAT THE REPLY NOW READS.
   Since v150.37 the reply reads a speaking style per path (multi, gamemaster reaction, text, heat) and per emotion the
   emotion pick can choose; since v150.39 the relationships block reads structured ties with "Always include", and the
   social graph is gone. The generator still wrote one style paragraph and a social-graph paragraph. Now:
     · x_style_writer writes the styles from a card: after "Create with AI", for each character a batch makes (in the
       background), and from the speaking-styles section's "Write with AI";
     · the batch writes "ties" (name, tie, relationship, always) that become the cast's relationships, pinned where
       "always" says so.
   v150.61: the writer writes speech & behaviour in three groups (spoken, text, heat), each with a main box and one box per
   emotion, into p.speech; an answer in the v150.40 shape is still read (see tests/speech-groups.browser.js for the rest).
   The model is stubbed.  Run: node tests/char-generator-styles.browser.js */
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:process.env.SM_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage({viewport:{width:412,height:915}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file://'+require('path').resolve(__dirname,'..','index.html')); await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(800);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x===undefined?c:x).slice(0,700));} };

  await pg.evaluate(()=>{
    window.__calls=[];
    window.__STYLE={spoken:{main:"SPOKEN_S",emotions:{anger:"ANGER_S",Joy:"JOY_S",Nonsense:"DROP_ME"}},text:{main:"TEXT_S",emotions:{Anger:"T_ANGER_S"}},
      heat:{main:"HEAT_S",emotions:{Desire:"HEAT_DESIRE_S"}},solo:{main:"ignored"}};
    window.chatCompletion=async(msgs,model,opts)=>{ const d=(opts&&opts.dbg)||""; __calls.push({d,msgs,model,opts});
      if(/^Speaking styles writer/.test(d))return JSON.stringify(__STYLE);
      if(d==="Character bio generator")return JSON.stringify({name:"Selin",avatar:"🌿",personality:"You are brisk.",likes:"Likes: tea",traits:"Default: x → y",goals:"You want the shop.",backstory:"You left at 19.",style:"You speak in short, clean sentences.",look:{face_map:"",hair:"dark",face:"",body:""},instructions:"x",interject:"y",routine:"Mornings at the shop."});
      if(/^Batch character generator/.test(d))return JSON.stringify({characters:[
        {name:"Selin Kaya",personality:"You are brisk.",style:"Short.",ties:[{name:"Mert Kaya",tie:"husband",relationship:"You married Mert young.",always:true},{name:"Deniz",tie:"rival",relationship:"You do not trust her.",always:false},{name:"Nobody Here",tie:"ghost",relationship:"x"},{name:"Emre",tie:"neighbour",relationship:"He fixed your sink."}]},
        {name:"Mert Kaya",personality:"You are slow.",style:"Long.",ties:[{name:"Selin",tie:"wife",relationship:"She runs everything.",always:"true"}]},
        {name:"Deniz",personality:"You are sharp.",style:"Dry.",socialGraph:"Selin is my rival."}]});
      return "{}"; };
    state.key="k"; state.user="Emre"; state.storyLang="tr";
    const uni=state.universes[0]; uni.userName="Emre"; uni.locations=[];
  });

  console.log("\n[the writer]");
  const W=await pg.evaluate(async()=>{ __calls=[];
    const set=await writeStyleSet({name:"Selin",personality:"You are brisk.",likes:"Likes: tea",speech:{spoken:{main:"You speak in short, clean sentences.",emo:{}}},backstory:"You left at 19."},{universe:state.universes[0],instr:"she swears when angry"});
    const c=__calls[0]; const sys=c&&c.msgs[0].content, usr=c&&c.msgs.map(m=>m.content).join("\n");
    return {set,sys,usr,model:c&&c.model,fn:c&&c.opts.fn}; });
  ok("the three groups' main boxes come back as written (spoken, text, heat; nothing else)", W.set&&W.set.spoken.main==="SPOKEN_S"&&W.set.text.main==="TEXT_S"&&W.set.heat.main==="HEAT_S"&&Object.keys(W.set).sort().join()==="heat,spoken,text", JSON.stringify(W.set));
  ok("each group's emotions take the list's own names; an emotion not in the list is dropped", W.set&&W.set.spoken.emo.Anger==="ANGER_S"&&W.set.spoken.emo.Joy==="JOY_S"&&!("Nonsense" in W.set.spoken.emo)&&W.set.text.emo.Anger==="T_ANGER_S", JSON.stringify(W.set));
  ok("heat emotions go under heat, and only there", W.set&&W.set.heat.emo.Desire==="HEAT_DESIRE_S"&&!W.set.spoken.emo.Desire, JSON.stringify(W.set));
  ok("the request carries the card, every emotion with its tones, the request and the story's language", /How they speak now \(spoken\): You speak in short/.test(W.usr)&&/Likes, dislikes and interests: Likes: tea/.test(W.usr)&&/- Anger: [^\n]*\(mild: irritated; clear: angry; intense: furious\)/.test(W.usr)&&/- Pride:/.test(W.usr)&&/she swears when angry/.test(W.usr)&&/IN Turkish/.test(W.sys)&&/You write how Selin SPEAKS AND BEHAVES/.test(W.sys), W.usr.slice(0,900));
  ok("it runs on the authoring model, in the generator's bucket", W.fn==="unigen"&&W.model===(await pg.evaluate(()=>authoringModel())), W.model);
  ok("a broken answer gives nothing, and never throws", await pg.evaluate(async()=>{ const keep=__STYLE; window.__STYLE="not json {"; let r; try{ r=await writeStyleSet({name:"x",style:"y"}); }catch(e){ return "threw"; } window.__STYLE=keep; return r===null?true:JSON.stringify(r); }));

  console.log("\n[Create with AI — one character]");
  const S=await pg.evaluate(async()=>{ __calls=[]; editPersona(null);
    document.getElementById('peAiBrief').value="a brisk shopkeeper"; _peAiMode('single');
    await runAiCreate();
    const read=peSpeechRead();
    return {order:__calls.map(c=>c.d),likes:document.getElementById('peLikes').value,read}; });
  ok("the card is written, then its speaking styles from that card", S.order[0]==="Character bio generator"&&/^Speaking styles writer · Selin/.test(S.order[1]||""), JSON.stringify(S.order));
  ok("they land in the editor's speech groups, ready to save; the card's likes in their box", S.read.text.main==="TEXT_S"&&S.read.spoken.main==="SPOKEN_S"&&S.read.spoken.emo.Anger==="ANGER_S"&&S.read.heat.emo.Desire==="HEAT_DESIRE_S"&&S.likes==="Likes: tea", JSON.stringify(S));
  ok("the card's old behaviour line went with the main boxes the writer replaced", !/Default: x/.test(S.read.spoken.main)&&!/Default: x/.test(JSON.stringify(S.read)), JSON.stringify(S.read));
  ok("saving keeps them on the character", await pg.evaluate(()=>{ savePersona(); const p=state.personas.find(x=>x.name==="Selin");
      return (p&&p.speech&&p.speech.text.main==="TEXT_S"&&p.speech.spoken.emo.Joy==="JOY_S"&&p.likes==="Likes: tea"&&!("traits" in p)&&!("styleBy" in p))?true:JSON.stringify(p); }));

  console.log("\n[Write with AI in the speaking-styles section]");
  const E=await pg.evaluate(async()=>{ const p=state.personas.find(x=>x.name==="Selin"); p.speech={spoken:{main:"KEEP_SPOKEN",emo:{Fear:"KEEP_FEAR"}},text:{main:"OLD_TEXT",emo:{}},heat:{main:"",emo:{}}}; editPersona(p.id);
    window.__STYLE={text:{main:"NEW_TEXT"},spoken:{emotions:{Anger:"NEW_ANGER"}}};
    const real=window.askAiInstructions; window.askAiInstructions=async()=>"lowercase texts"; __calls=[];
    const btn=document.getElementById('peStyleAiBtn');
    await peStyleWriteAI(); window.askAiInstructions=real;
    const r=peSpeechRead(); return {btn:!!btn,r,usr:(__calls[0]&&__calls[0].msgs.map(m=>m.content).join("\n"))||""}; });
  ok("the button is in the section and steers the writer", E.btn&&/lowercase texts/.test(E.usr), E.usr.slice(-300));
  ok("what it wrote replaces those boxes; the rest are kept", E.r.text.main==="NEW_TEXT"&&E.r.spoken.main==="KEEP_SPOKEN"&&E.r.spoken.emo.Anger==="NEW_ANGER"&&E.r.spoken.emo.Fear==="KEEP_FEAR", JSON.stringify(E.r));
  ok("with nothing on the card it asks for the card first, and sends nothing", await pg.evaluate(async()=>{ editPersona(null); __calls=[]; await peStyleWriteAI(); return __calls.length===0?true:__calls.length+" calls"; }));

  console.log("\n[Create with AI — a batch]");
  const B=await pg.evaluate(async()=>{ window.__STYLE={spoken:{main:"B_SPOKEN",emotions:{Anger:"B_ANGER"}}};
    const uni=state.universes[0];
    state.personas=state.personas.filter(p=>!/Kaya|Deniz/.test(p.name));
    editPersona(null); document.getElementById('peAiBrief').value="a family"; _peAiMode('batch'); document.getElementById('peAiBatchN').value="3";
    __calls=[]; await runAiCreate();
    const t=Date.now(); while(Date.now()-t<3000&&__calls.filter(c=>/^Speaking styles writer/.test(c.d)).length<3) await new Promise(r=>setTimeout(r,50));
    await new Promise(r=>setTimeout(r,100));
    const by=n=>state.personas.find(p=>p.name===n&&p.universeId===uni.id);
    const S=by("Selin Kaya"), M=by("Mert Kaya"), D=by("Deniz");
    return {S:S&&S.relationships,M:M&&M.relationships,ids:{S:S&&S.id,M:M&&M.id,D:D&&D.id},Ssg:S&&S.socialGraph,Dsg:D&&D.socialGraph,Dseed:D&&D._relSeeded,
      styles:[S,M,D].map(p=>p&&p.speech&&p.speech.spoken.main),gen:[S,M,D].map(p=>p&&p._speechGen),textMain:M&&M.speech.text.main,writes:__calls.filter(c=>/^Speaking styles writer/.test(c.d)).map(c=>c.d)}; });
  ok("each tie lands on the person it names, with its label and paragraph", B.S&&B.S[B.ids.M]&&B.S[B.ids.M].tie==="husband"&&/married Mert young/.test(B.S[B.ids.M].relationship)&&B.S[B.ids.D]&&B.S[B.ids.D].tie==="rival", JSON.stringify(B.S));
  ok("\"always\" is the Always include tick (true or \"true\"); otherwise unset", B.S[B.ids.M].pinned===true&&!("pinned" in B.S[B.ids.D])&&B.M&&B.M[B.ids.S]&&B.M[B.ids.S].pinned===true, JSON.stringify({S:B.S,M:B.M}));
  ok("the player is matched by name; a name nobody has is dropped", B.S.__user__&&B.S.__user__.tie==="neighbour"&&Object.keys(B.S).length===3, JSON.stringify(Object.keys(B.S)));
  ok("a card with ties has no social-graph seed; one without keeps it for the one-time generation", B.Ssg===""&&B.Dsg==="Selin is my rival."&&!B.Dseed, JSON.stringify({Ssg:B.Ssg,Dsg:B.Dsg}));
  ok("every new character gets its speech & behaviour in the background (the card's own style stays where the writer wrote nothing)", JSON.stringify(B.styles)==='["B_SPOKEN","B_SPOKEN","B_SPOKEN"]'&&B.textMain==="Long."&&B.gen.every(x=>!x)&&B.writes.length===3, JSON.stringify(B));
  ok("a character that already has emotion boxes of its own is left alone", await pg.evaluate(async()=>{ const p={id:"p_has",name:"Has",speech:{spoken:{main:"MINE",emo:{Fear:"MINE_TOO"}}},_speechMigrated:"v150.61"}; __calls=[];
      await writeStylesForNew([p],null); return (p.speech.spoken.main==="MINE"&&__calls.length===0)?true:JSON.stringify(p); }));

  console.log("\n[the prompts]");
  ok("the batch prompt asks for ties with \"always\", for every other character, both sides agreeing", await pg.evaluate(()=>{ const t=DEFAULT_BATCH_BIO;
      return (/"ties": \[/.test(t)&&/"always": "true only for someone/.test(t)&&/both sides of a tie agree/.test(t)&&!/"socialGraph":/.test(t))?true:"batch prompt"; }));
  ok("the styles writer is a registry prompt on the Character Generator card", await pg.evaluate(()=>!!PROMPT_BY_KEY.x_style_writer&&ENGINE_PAYLOAD_DEFS.some(d=>d.key==="char_generator"&&(d.blocks||[]).some(x=>x.promptKey==="x_style_writer"))));

  // last: a reload runs the boot refreshes (and drops the stubs above)
  const old=await pg.evaluate(()=>DEFAULT_BATCH_BIO.replace(/"ties": \[[\s\S]*?\} \]/,'"socialGraph": "IN THE SECOND PERSON: your CONCRETE ties to the OTHER characters in this set, by name."'));
  const rt=async(v)=>{ await pg.evaluate(v=>{ store.setRaw(K.batchBioPrompt,v); localStorage.removeItem("sm_pipesdone"); },v); await pg.reload(); await pg.waitForTimeout(2200); return pg.evaluate(()=>state.batchBioPrompt); };
  ok("a stored copy of the old shipped batch prompt is refreshed", old.indexOf('"socialGraph"')>=0&&(await rt(old))===(await pg.evaluate(()=>DEFAULT_BATCH_BIO)));
  ok("one the user wrote is left alone", (await rt("My own batch prompt."))==="My own batch prompt.");
  ok("no refresh pipe stood down", await pg.evaluate(()=>{ const sp=window.__stalePipes||[]; return sp.length===0?true:"stale: "+sp.join(", "); }));
  ok("no page errors", errs.length===0?true:errs.join(" | "));
  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close(); process.exit(fail?1:0);
})();
