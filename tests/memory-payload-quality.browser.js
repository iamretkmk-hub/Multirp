/* v148.4 — payload-quality review, MEMORY / RELATIONSHIP family.
   Every model call is stubbed (window.chatCompletion) and the prompts it receives are captured.
   Covers: shipped prompts carry no real cast (and the stored copies are repaired without losing the
   player's edits); the arc cutter keeps a late arrival's first line, a re-arrival's earlier lines, a
   one-line remainder (carried or, at a close, written) and never splits a line from its reply; an aside
   is not "heard every line"; (v148.9) every fragment of a stretch goes into the part-of-day reconcile, labelled; relationships are
   seeded from the sheet's tie; a phone thread's closing exchange is remembered; the fast read stops at
   the last scene cut; gossip and diary payloads; the daily relationship read is batched per character.
   Run: NODE_PATH=/path/to/node_modules node tests/memory-payload-quality.browser.js */
const {chromium}=require('playwright');
const fs=require('fs'), path=require('path');
(async()=>{
  const b=await chromium.launch({executablePath:process.env.SM_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage({viewport:{width:412,height:915}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  const SRC=fs.readFileSync(path.resolve(__dirname,'..','index.html'),'utf8');
  await pg.goto('file://'+path.resolve(__dirname,'..','index.html')); await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(900);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x===undefined?c:x).slice(0,900));} };

  // ---------------------------------------------------------------------------------------------
  console.log("\n[1. no shipped prompt names the cast of a real story, and no example is about a minor]");
  const CAST="Emre|Burcu|Burak|Nil|Sami|Berker|Özüçak|Özuçak|Tokmak|Isdemir|İsdemir|Vanadium|Duygu|Hakan|Özlem|Buket|Ayça|Akbaba|Ceyda|Arslan|Mümtaz";
  const defNames=[...new Set([...SRC.matchAll(/^const (DEFAULT_[A-Z0-9_]+)=/gm)].map(m=>m[1]))];
  const P=await pg.evaluate(({defNames,CAST})=>{
    const re=new RegExp("(?<![\\p{L}])(?:"+CAST+")(?![\\p{L}])|Site (?:Market|Fitness)","u");
    const hits=[];
    const look=(where,t)=>{ if(typeof t!=="string")return; const m=t.match(re); if(m)hits.push(where+": "+m[0]+" … "+t.slice(Math.max(0,m.index-40),m.index+40).replace(/\n/g," ")); };
    defNames.forEach(n=>{ let v; try{ v=eval(n); }catch(e){ return; } if(typeof v==="string")look(n,v); else if(v&&typeof v==="object")Object.keys(v).forEach(k=>look(n+"."+k,typeof v[k]==="string"?v[k]:(v[k]&&v[k].def))); });
    (PROMPT_REGISTRY||[]).forEach(r=>{ try{ look("registry."+r.key,r.def?r.def():""); }catch(e){} });
    Object.keys(X_ENGINE_PROMPTS).forEach(k=>look("x."+k,X_ENGINE_PROMPTS[k].def));
    Object.keys(BLOCK_TPL_DEFAULTS).forEach(k=>look("blk."+k,BLOCK_TPL_DEFAULTS[k]));
    ["ueUserSocialGraph"].forEach(id=>{ const el=document.getElementById(id); if(el)look("placeholder#"+id,el.getAttribute("placeholder")); });
    const ex=(DEFAULT_MEMBUILD.match(/## EXAMPLES\n[\s\S]*?\n(?=\n## A CONVERSATION)/)||[""])[0];
    const minor=/\b(?:child|children|daughter|son|girl|boy|kid|teen\w*|\d+[- ]year[- ]old|school)\b/i.exec(ex);
    const sexual=/\bsex\w*|\bkitchen counter|\bbedroom/i.exec(ex);
    const rc=(DEFAULT_MEMRECONCILE.match(/A worked one[\s\S]*?\n\n/)||[""])[0];
    return {hits,exLen:ex.length,minor:minor&&minor[0],sexual:sexual&&sexual[0],rcPeople:(rc.match(/"people":\[[^\]]*\]/)||[""])[0],
      teach:["third person","padded","reads as a report","too thin","a transcript in reported speech","this is her own memory"].every(s=>ex.indexOf(s)>=0)};
  },{defNames,CAST});
  ok("no DEFAULT_*, registry, engine, block template or placeholder text names the real cast", P.hits.length===0, P.hits.join("\n        "));
  ok("the memory builder's examples: no minor, nothing sexual, every teaching point kept", P.exLen>800&&!P.minor&&!P.sexual&&P.teach, JSON.stringify(P));
  ok("the reconciler's worked example no longer names the player", /Tomas/.test(P.rcPeople), P.rcPeople);
  const tg=(SRC.match(/id="tgBrief"[^>]*placeholder="([^"]*)"/)||[])[1]||"";
  ok("the tracker-brief placeholder is neutral too", !!tg&&!new RegExp("(?<![\\p{L}])(?:"+CAST+")(?![\\p{L}])","u").test(tg), tg);

  // ---------------------------------------------------------------------------------------------
  console.log("\n[2. stored copies of the old text are repaired; the player's own edits are kept]");
  const OLD_SEC="## EXAMPLES\nThese are format demonstrations from other households.\n\nA boundary drawn\n❌ content: \"…comparing me to\n   a top model and claiming…\"\n✅ content: \"…said he was counting my sets instead of his own. I told him…\"\n\nSomething noticed, nothing said\n✅ content: \"…I said nothing, just washed them. My hands wouldn't stop\n   shaking.\"\n\nA consequence landing\n✅ content: \"…asked and went to the medicine cabinet.\"\n";
  await pg.evaluate(({OLD_SEC})=>{
    const NEW=(DEFAULT_MEMBUILD.match(/## EXAMPLES\n[\s\S]*?\n(?=\n## A CONVERSATION)/)||[])[0];
    const old=DEFAULT_MEMBUILD.replace(NEW,()=>OLD_SEC).replace("## LANGUAGE","MY OWN RULE: two sentences, never three.\n\n## LANGUAGE");
    store.setRaw(K.memBuild,old);
    store.setRaw(K.memReconcile,DEFAULT_MEMRECONCILE.replace('"people":["Tomas"],"tags":["debt","breakfast","home"],"location":"the flat"','"people":["Emre"],"tags":["debt","breakfast","home"],"location":"Ev"')+"\nMY RECONCILE EDIT");
    store.setRaw(K.calPrompt,DEFAULT_CAL.split('"go and talk to Tomas about the money",').join('"go and talk to Hakan about the money",')+"\nMY CAL EDIT");
    store.setRaw(K.gossipPrompt,DEFAULT_GOSSIP.replace("## What the witness saw (a vague glance, not a transcript — unless the impression says they overheard it)\n","## What the witness saw (a vague glance, not a transcript)\n"));
    store.set(K.blockTpls,{rp_format:BLOCK_TPL_DEFAULTS.rp_format.replace('"Lena iyi.','"Nil iyi.')});
  },{OLD_SEC});
  await pg.reload(); await pg.waitForTimeout(2600);
  const R1=await pg.evaluate(()=>({
    mbNew:/held the boat for me/.test(state.memBuild), mbOld:/a top model|medicine cabinet/.test(state.memBuild), mbEdit:/MY OWN RULE: two sentences/.test(state.memBuild),
    mbStored:/held the boat for me/.test(store.raw(K.memBuild,"")),
    rc:/"people":\["Tomas"\]/.test(state.memReconcile)&&!/"Ev"/.test(state.memReconcile)&&/MY RECONCILE EDIT/.test(state.memReconcile),
    cal:/go and talk to Tomas about the money/.test(state.calPrompt)&&!/Hakan/.test(state.calPrompt)&&/MY CAL EDIT/.test(state.calPrompt),
    gos:state.gossipPrompt===DEFAULT_GOSSIP,
    blk:/"Lena iyi\./.test((state.blockTpls||{}).rp_format||"")&&!/Nil iyi/.test((state.blockTpls||{}).rp_format||""),
    stale:(window.__stalePipes||[]).slice()}));
  ok("memBuild: the old EXAMPLES block is replaced by the new one (in state and in storage)", R1.mbNew&&!R1.mbOld&&R1.mbStored, JSON.stringify(R1));
  ok("…and the player's own edit elsewhere in that prompt is kept", R1.mbEdit, JSON.stringify(R1));
  ok("memReconcile's worked example is repaired in place, the edit kept", R1.rc, JSON.stringify(R1));
  ok("a cast sentence in another prompt (meetings detector) is swapped word for word, the edit kept", R1.cal, JSON.stringify(R1));
  ok("the gossip prompt's glance line and the reply-format example are refreshed", R1.gos&&R1.blk, JSON.stringify(R1));
  ok("no refresh pipe stood down", R1.stale.length===0, JSON.stringify(R1.stale));
  // an edited copy — the player rewrote the examples — is left exactly as it is
  const EDITED=await pg.evaluate(()=>{
    const NEW=(DEFAULT_MEMBUILD.match(/## EXAMPLES\n[\s\S]*?\n(?=\n## A CONVERSATION)/)||[])[0];
    const mine=DEFAULT_MEMBUILD.replace(NEW,()=>"## EXAMPLES\nMy own example: he said he was counting my sets instead of his own, and I laughed.\n")+"\nMY TAIL";
    store.setRaw(K.memBuild,mine); return mine; });
  await pg.reload(); await pg.waitForTimeout(2600);
  const R2=await pg.evaluate(()=>state.memBuild);
  ok("a memBuild copy whose examples the player rewrote is kept verbatim", R2===EDITED, R2.slice(0,200));

  // ---------------------------------------------------------------------------------------------
  const setup=()=>pg.evaluate(()=>{
    const uni=state.universes[0]; state.curUniverse=uni.id; uni.userName="";
    const mk=(id,name)=>({id,name,universeId:uni.id,instructions:"x",personality:"x",backstory:"x",style:"x",goals:"x",look:{}});
    state.personas=state.personas.filter(p=>!/^p_(sa|be|bu|zz)$/.test(p.id));
    state.personas.push(mk("p_sa","Sam"),mk("p_be","Bert"),mk("p_bu","Bruno"));
    state.user="Deniz"; state.key="sk-test"; state.mem=true; state.memMinImp=0; state.condenseOn=false;
    state.autoCharOn=false; state.relOn=true; state.embedOn=false; state.narrPrivacy=true; state.histTurns=20; state.gossipOn=true;
    const chat=curChat(); chat.universeId=uni.id; chat.gameDay=2; chat.period="Afternoon"; chat.timeOfDay="Afternoon";
    chat.presentIds=["p_sa","p_be"]; chat.rel={}; chat.memEvent=null; chat.memDoneIdx=-1; chat.messages=[]; chat.locationId=null; chat.memCarry={}; chat._textArc={};
    state.memory=[];
    window.__calls=[];
    window.__reply=()=>JSON.stringify({content:"A memory "+Math.random().toString(36).slice(2,8),importance_score:0.6,charge:0.7,gist:"g"});
    window.chatCompletion=async(msgs,model,opts)=>{ const d=(opts&&opts.dbg)||""; window.__calls.push({dbg:d,text:JSON.stringify(msgs),opts:opts||{}}); return window.__reply(d,msgs); };
    return true;
  });
  const call=(C,re)=>C.find(c=>re.test(c.dbg));

  // ---------------------------------------------------------------------------------------------
  console.log("\n[3. a late arrival remembers the turn that brought them in; a re-arrival cuts nothing]");
  await setup();
  const A=await pg.evaluate(async()=>{
    const chat=curChat();
    chat.messages.push({mid:"a0",role:"user",content:"*Gözlüğümü düzeltip* \"Bruno! Hayırdır, nöbetten önce mi geldin?\"",present:["p_sa"]});
    chat.messages.push({mid:"a1",role:"assistant",speaker:"Sam",speakerId:"p_sa",content:"\"Bruno! Gel otur, çay söyleyelim.\"",present:["p_sa"]});
    chat.messages.push({mid:"a2",role:"assistant",speaker:"Narrator",narratorEvent:true,content:"*Bruno masalara doğru yürüyor.*",present:["p_sa"]});
    chat.messages.push({mid:"a3",role:"assistant",speaker:"Narrator",presenceNote:true,enteredIds:["p_bu"],content:"— Bruno geldi —"});
    chat.messages.push({mid:"a4",role:"assistant",speaker:"Bruno",speakerId:"p_bu",content:"\"Selam. Kahve ısmarlamışsın Deniz, öyle mi?\"",present:["p_sa","p_bu"]});
    await commitMemoryArc(chat,0,4,2,"Afternoon");
    const c=window.__calls.find(x=>/Memory \(arc\) · Bruno/.test(x.dbg));
    return {bruno:!!c,own:!!c&&/Kahve ısmarlamışsın/.test(c.text),turn:!!c&&/nöbetten önce mi geldin/.test(c.text)&&/Gel otur/.test(c.text),mem:state.memory.some(m=>m.ownerId==="p_bu")};
  });
  ok("the arriving character gets a memory with their own first line and the turn that brought them in", A.bruno&&A.own&&A.turn&&A.mem, JSON.stringify(A));
  await setup();
  const A2=await pg.evaluate(async()=>{
    const chat=curChat();
    chat.messages.push({mid:"b0",role:"assistant",speaker:"Sam",speakerId:"p_sa",content:"\"Cuma günü parayı getir, olur mu?\"",present:["p_sa","p_be"]});
    chat.messages.push({mid:"b1",role:"assistant",speaker:"Bert",speakerId:"p_be",content:"\"Çay geliyor.\"",present:["p_sa","p_be"]});
    chat.messages.push({mid:"b2",role:"assistant",speaker:"Narrator",presenceNote:true,enteredIds:["p_sa"],content:"— Sam geldi —"});
    chat.messages.push({mid:"b3",role:"assistant",speaker:"Sam",speakerId:"p_sa",content:"\"Nakit getir ama, havale olmasın.\"",present:["p_sa","p_be"]});
    await commitMemoryArc(chat,0,3,2,"Afternoon");
    const c=window.__calls.find(x=>/Memory \(arc\) · Sam/.test(x.dbg));
    return {sam:!!c,first:!!c&&/Cuma günü parayı getir/.test(c.text),second:!!c&&/Nakit getir/.test(c.text)};
  });
  ok("a presence note for someone already in the scene cuts none of their earlier lines", A2.sam&&A2.first&&A2.second, JSON.stringify(A2));
  await setup();
  const A3=await pg.evaluate(async()=>{
    const chat=curChat();
    chat.messages.push({mid:"c0",role:"user",content:"\"Sam, the money is ready.\"",present:["p_sa","p_be"]});
    chat.messages.push({mid:"c1",role:"assistant",speaker:"Sam",speakerId:"p_sa",content:"\"Good. Friday then.\"",present:["p_sa","p_be"]});
    chat.messages.push({mid:"c2",role:"assistant",speaker:"Narrator",presenceNote:true,enteredIds:["p_bu"],content:"— Bruno has arrived —"});
    chat.messages.push({mid:"c3",role:"user",content:"\"Hello Bruno.\"",present:["p_sa","p_be","p_bu"]});
    chat.messages.push({mid:"c4",role:"assistant",speaker:"Sam",speakerId:"p_sa",content:"\"Sit down, Bruno.\"",present:["p_sa","p_be","p_bu"]});
    await commitMemoryArc(chat,0,4,2,"Afternoon");
    const s=window.__calls.find(x=>/Memory \(arc\) · Sam/.test(x.dbg));
    return {samEarly:!!s&&/the money is ready/.test(s.text)};
  });
  ok("a note about someone else never cuts this character's earlier lines", A3.samEarly, JSON.stringify(A3));

  // ---------------------------------------------------------------------------------------------
  console.log("\n[4. a one-line remainder is carried to the next arc (mid-scene) or written (at a close)]");
  await setup();
  const C=await pg.evaluate(async()=>{
    const chat=curChat(); chat.presentIds=["p_sa","p_be"];
    // Sam has ONE line in the first span; Bert and the player carry the rest
    chat.messages.push({mid:"d0",role:"user",content:"\"Bert, did you fix the boiler?\"",present:["p_be"]});
    chat.messages.push({mid:"d1",role:"assistant",speaker:"Bert",speakerId:"p_be",content:"\"Yesterday.\"",present:["p_be"]});
    chat.messages.push({mid:"d2",role:"assistant",speaker:"Sam",speakerId:"p_sa",content:"\"Bring the cash on Friday, not a transfer.\"",present:["p_sa"]});
    await commitMemoryArc(chat,0,2,2,"Afternoon");
    const first=!!window.__calls.find(x=>/Memory \(arc\) · Sam/.test(x.dbg)), carry=(chat.memCarry||{}).p_sa;
    window.__calls.length=0;
    chat.messages.push({mid:"d3",role:"user",content:"\"Cash it is, Sam.\"",present:["p_sa","p_be"]});
    chat.messages.push({mid:"d4",role:"assistant",speaker:"Sam",speakerId:"p_sa",content:"\"Good.\"",present:["p_sa","p_be"]});
    await commitMemoryArc(chat,3,4,2,"Afternoon");
    const s=window.__calls.find(x=>/Memory \(arc\) · Sam/.test(x.dbg));
    return {first,carry,second:!!s,carried:!!s&&/Bring the cash on Friday/.test(s.text),cleared:!(chat.memCarry||{}).p_sa,
      src:(state.memory.find(m=>m.ownerId==="p_sa")||{}).srcMids};
  });
  ok("mid-scene: one line is not built, it is parked on chat.memCarry", C.first===false&&C.carry==="d2", JSON.stringify(C));
  ok("the next commit gives that character the carried line with the new ones, then clears the carry", C.second&&C.carried&&C.cleared&&(C.src||[]).indexOf("d2")>=0, JSON.stringify(C));
  await setup();
  const C2=await pg.evaluate(async()=>{
    const chat=curChat();
    chat.messages.push({mid:"e0",role:"user",content:"\"Sam, are you coming tonight?\"",present:["p_sa","p_be"]});
    chat.messages.push({mid:"e1",role:"assistant",speaker:"Bert",speakerId:"p_be",content:"\"He always says yes.\"",present:["p_be"]});
    chat.memDoneIdx=0;   // the player's line was already committed with an earlier arc
    chat.memEvent={startIdx:1,open:true};
    chat.messages.push({mid:"e2",role:"assistant",speaker:"Sam",speakerId:"p_sa",content:"\"I'll be there at nine.\"",present:["p_sa"]});
    await flushMemoryArc(chat,2,"Afternoon");
    const s=window.__calls.find(x=>/Memory \(arc\) · Sam/.test(x.dbg));
    return {sam:!!s,own:!!s&&/at nine/.test(s.text),answered:!!s&&/are you coming tonight/.test(s.text)};
  });
  ok("at a close, a single line of their own is written with the line it answered", C2.sam&&C2.own&&C2.answered, JSON.stringify(C2));

  // ---------------------------------------------------------------------------------------------
  console.log("\n[5. a \"different\" topic never splits a line from its reply (and a Retry does not either)]");
  await setup();
  const S=await pg.evaluate(async()=>{
    const chat=curChat(); chat.presentIds=["p_sa","p_be"];
    chat.messages.push({mid:"f0",role:"user",content:"*Zarfı uzatıyorum* \"Cuma'yı bekleme, şimdi al.\"",whisperTo:"p_sa",present:["p_sa","p_be"]});
    chat.messages.push({mid:"f1",role:"assistant",speaker:"Sam",speakerId:"p_sa",content:"\"Sağ ol. Kimse bilmesin.\"",present:["p_sa","p_be"]});
    chat.memEvent={startIdx:0,open:true,paused:false,summary:"the envelope"};
    window.__reply=(d)=>/arc tracker/.test(d)?JSON.stringify({progress:"ongoing",topic:"different",summary:"the barbecue"}):JSON.stringify({content:"Took the envelope "+Math.random(),importance_score:0.8});
    await maybeBuildMemory(chat);
    const s=window.__calls.find(x=>/Memory \(arc\) · Sam/.test(x.dbg));
    return {sam:!!s,both:!!s&&/Cuma'yı bekleme/.test(s.text)&&/Kimse bilmesin/.test(s.text),done:chat.memDoneIdx,ev:chat.memEvent,mem:state.memory.some(m=>m.ownerId==="p_sa")};
  });
  ok("no player line after the arc's start: the whole arc closes, the whisper with its reply", S.sam&&S.both&&S.mem&&S.done===1&&!S.ev, JSON.stringify(S));
  ok("the split fallback no longer exists in the source", !/let newStart=arcEnd;/.test(SRC), "newStart=arcEnd still present");

  // ---------------------------------------------------------------------------------------------
  console.log("\n[6. an aside held at the window is not \"heard every line\"]");
  await setup();
  const W=await pg.evaluate(async()=>{
    const chat=curChat(); const ear=["p_sa","p_be"];
    chat.messages.push({mid:"g0",role:"user",content:"\"Nice tea, Bert.\"",present:ear.slice()});
    chat.messages.push({mid:"g1",role:"assistant",speaker:"Sam",speakerId:"p_sa",content:"\"He makes it strong.\"",present:ear.slice()});
    chat.messages.push({mid:"g2",role:"assistant",speaker:"Sam",speakerId:"p_sa",toId:"__user__",toName:"Deniz",content:"*Bert tepsiyi bırakmaya gidince Deniz'i pencerenin önüne çekip sesini alçaltıyor.* \"Bak, Cuma getireceğin parayı nakit getir. Buket hesaba bakıyor.\"",present:ear.slice()});
    chat.messages.push({mid:"g3",role:"user",content:"\"Tamam, nakit getiririm.\"",present:ear.slice()});
    await commitMemoryArc(chat,0,3,2,"Afternoon");
    const be=window.__calls.find(x=>/· Bert/.test(x.dbg)), sa=window.__calls.find(x=>/Memory \(arc\) · Sam/.test(x.dbg));
    return {dbg:be&&be.dbg,leak:!!be&&/nakit getir|hesaba bakıyor/.test(be.text),marked:!!be&&/said something aside to Deniz/.test(be.text),
      every:!!be&&/heard every line/.test(be.text),onlySaw:!!be&&/only saw, not heard/.test(be.text),samKeeps:!!sa&&/nakit getir/.test(sa.text)};
  });
  ok("the quiet listener does not get the aside's words, nor the player's answer to it", W.dbg==="Memory (arc) · Bert"&&!W.leak&&W.marked, JSON.stringify(W));
  ok("…and is told a marked aside was only seen, never that they heard every line", !W.every&&W.onlySaw, JSON.stringify(W));
  ok("the speaker keeps the whole aside in their own memory", W.samKeeps, JSON.stringify(W));
  await setup();
  const W2=await pg.evaluate(async()=>{
    const chat=curChat(); const ear=["p_sa","p_be"];
    chat.messages.push({mid:"h0",role:"assistant",speaker:"Sam",speakerId:"p_sa",toId:"__user__",toName:"Deniz",content:"*leans in and lowers his voice* \"Not in front of Bert.\"",present:ear.slice()});
    chat.messages.push({mid:"h1",role:"user",content:"\"Fine.\"",present:ear.slice()});
    await commitMemoryArc(chat,0,1,2,"Afternoon");
    const be=window.__calls.find(x=>/· Bert/.test(x.dbg));
    return {dbg:be&&be.dbg,leak:!!be&&/Not in front of Bert/.test(be.text)};
  });
  /* (!) v148.9 — CHANGED ON PURPOSE: in the same room is never an observation. He gets his own memory of the scene,
     still without the aside's words (it is marked as seen, not heard). */
  ok("one who caught nothing but an aside is still in the scene: his own memory, the aside's words kept out", W2.dbg==="Memory (arc) · Bert"&&!W2.leak, JSON.stringify(W2));
  ok("_memAsideCue reads stage directions, not speech", await pg.evaluate(()=>
    !!_memAsideCue("*pulls her aside by the window* \"Listen.\"")&&!!_memAsideCue("*kulağına eğilip* \"Sus.\"")&&!_memAsideCue("*sets the cup down* \"Don't whisper, speak up.\"")));

  // ---------------------------------------------------------------------------------------------
  /* (!) v148.9 — CHANGED ON PURPOSE. v148.4 kept an overheard exchange out of the reconcile so its charge survived;
     the day's one encounter then came back as a consolidated half and loose observations beside it. Every
     fragment now goes in, labelled for how they took part, and the charge rides onto what they become. */
  console.log("\n[7. the part-of-day reconcile takes every fragment, labelled; fragments show what they left]");
  await setup();
  const RC=await pg.evaluate(async()=>{
    const chat=curChat(); const base={ownerId:"p_be",character:"Bert",gameDay:2,gamePeriod:"Afternoon",universeId:chat.universeId,chatId:chat.id,importance:0.5,source:"auto"};
    state.memory=[Object.assign({id:"r1",content:"I served the tea and we talked about the boiler.",type:"EXPERIENCE",feelings:"I still don't trust that boiler."},base),
                  Object.assign({id:"r2",content:"Sam and Deniz agreed something at the window while I sat there.",type:"EXPERIENCE",listener:true,charge:0.8},base),
                  Object.assign({id:"r3",content:"I walked Deniz to the gate.",type:"EXPERIENCE"},base)];
    const frag=memsOfPeriod("p_be",2,"Afternoon",chat).map(m=>m.id);
    window.__reply=()=>JSON.stringify({memories:[{content:"I served tea, sat through Sam and Deniz's talk at the window and walked Deniz out.",importance_score:0.5}]});
    await reconcilePeriodFor(state.personas.find(p=>p.id==="p_be"),2,"Afternoon",chat);
    const c=window.__calls.find(x=>/Memory reconcile/.test(x.dbg));
    const left=state.memory.filter(m=>m.ownerId==="p_be");
    return {frag,leftWith:!!c&&/left with: I still don't trust that boiler/.test(c.text),quietLabel:!!c&&/THEY WERE THERE BUT QUIET/.test(c.text),
      n:left.length,charge:left[0]&&left[0].charge,listener:left[0]&&left[0].listener,type:left[0]&&left[0].type};
  });
  ok("memsOfPeriod takes the quiet part too", JSON.stringify(RC.frag)==='["r1","r2","r3"]', JSON.stringify(RC));
  ok("it goes in labelled as heard, not said", RC.quietLabel===true, JSON.stringify(RC));
  ok("one memory comes out, carrying the charge for the End-Day gossip", RC.n===1&&RC.charge===0.8&&RC.listener===true&&RC.type!=="OBSERVATION", JSON.stringify(RC));
  ok("each FRAGMENT carries what it left them with", RC.leftWith, JSON.stringify(RC));

  // ---------------------------------------------------------------------------------------------
  console.log("\n[8. a bond starts where the relationship sheet says it does]");
  await setup();
  const RL=await pg.evaluate(async()=>{
    const chat=curChat(); chat.rel={};
    const sa=state.personas.find(p=>p.id==="p_sa"), be=state.personas.find(p=>p.id==="p_be"), bu=state.personas.find(p=>p.id==="p_bu");
    sa.relationships={__user__:{tie:"childhood friend",relationship:"We grew up on the same street."},p_be:{tie:"brother",relationship:"x"},p_bu:{tie:"daughter of the Brandts",relationship:"x"}};
    be.relationships={__user__:{tie:"husband",relationship:"x"}};
    bu.relationships={__user__:{tie:"stranger",relationship:""}};
    const peek=relPeek(chat,"p_sa","__user__"); const peekWrote=!!chat.rel[relDirKey("p_sa","__user__")];
    const cf=Object.assign({},relObj(chat,"p_sa","__user__"));   // a copy: the daily read below moves the live record
    const kin=relObj(chat,"p_sa","p_be"), thr=relObj(chat,"p_sa","p_bu"), sp=relObj(chat,"p_be","__user__"), st=relObj(chat,"p_bu","__user__");
    // an existing value is never overwritten
    chat.rel[relDirKey("p_be","p_sa")]=Object.assign(blankRel(),{trust:5});
    be.relationships.p_sa={tie:"brother",relationship:"x"};
    const kept=relObj(chat,"p_be","p_sa");
    // the daily read says where the numbers came from
    window.__reply=()=>JSON.stringify({trust:1,description:"You trust him."});
    await evalRelationship(chat,sa,"__user__","Deniz",null,[],2,{});
    const c=window.__calls.find(x=>/Daily relationship/.test(x.dbg));
    return {peekFam:peek.familiarity,peekWrote,cf:{f:cf.familiarity,t:cf.trust,a:cf.affection,seed:cf.seeded&&cf.seeded.tie},
      kin:{f:kin.familiarity,a:kin.affection,kin:!!kin.kin,desire:_fastBaseline(kin,"desire")},thr:{f:thr.familiarity,k:thr.seeded&&thr.seeded.kind},
      sp:{f:sp.familiarity,a:sp.affection},st:{f:st.familiarity,s:!!st.seeded},kept:{t:kept.trust,f:kept.familiarity},
      baseline:!!c&&/starting baseline read off the tie \\"childhood friend\\"/.test(c.text)};
  });
  ok("a childhood friend starts familiar and trusted, not at 0 — without an affection that would feed desire", RL.cf.f===60&&RL.cf.t===30&&RL.cf.a===0&&RL.cf.seed==="childhood friend", JSON.stringify(RL));
  ok("a reader sees the seeded values without a record being written", RL.peekFam===60&&RL.peekWrote===false, JSON.stringify(RL));
  ok("kin: familiar, no affection seeded, and desire never rests above 0", RL.kin.f===70&&RL.kin.a===0&&RL.kin.kin&&RL.kin.desire===0, JSON.stringify(RL.kin));
  ok("a spouse starts close; someone else's kin is only known through them; a stranger is not seeded", RL.sp.f===75&&RL.sp.a===45&&RL.thr.f===20&&RL.thr.k==="through"&&RL.st.f===0&&!RL.st.s, JSON.stringify(RL));
  ok("an existing value is never overwritten", RL.kept.t===5&&RL.kept.f===0, JSON.stringify(RL.kept));
  ok("the first daily read is told the numbers are a baseline from the tie", RL.baseline, JSON.stringify(RL));

  // ---------------------------------------------------------------------------------------------
  console.log("\n[9. a phone thread's closing exchange is remembered]");
  await setup();
  const T=await pg.evaluate(async()=>{
    const chat=curChat(); const p=state.personas.find(x=>x.id==="p_sa");
    const tx=(role,c,mid)=>chat.messages.push({mid,role,speaker:role==="user"?undefined:"Sam",speakerId:role==="user"?undefined:"p_sa",content:c,textMsg:true,textWith:"p_sa",gday:2,gperiod:"Afternoon",present:[]});
    tx("user","Thanks for the coffee.","t0"); tx("assistant","Thank you, it was nice.","t1");
    tx("user","Maybe coffee again sometime, somewhere quieter.","t2"); tx("assistant","Maybe… but let's be careful.","t3");
    window.__reply=(d)=>/arc tracker \(text\)/.test(d)?JSON.stringify({progress:"ongoing",topic:"different",summary:"a quieter place"}):JSON.stringify({content:"Texted about coffee "+Math.random(),importance_score:0.6});
    await rememberTextExchange(chat,p);
    const c=window.__calls.find(x=>/Memory \(text\) · Sam/.test(x.dbg));
    const first={closing:!!c&&/somewhere quieter/.test(c.text)&&/let's be careful/.test(c.text),arc:JSON.stringify(chat._textArc.p_sa)};
    // an arc the tracker left open is flushed when the part of the day ends
    window.__calls.length=0;
    tx("user","Are you home?","t4"); tx("assistant","Yes, just got in.","t5");
    chat.gameDay=2; chat.period="Evening"; chat.timeOfDay="Evening";
    await flushTextArcs(chat,2,"Afternoon");
    const f=window.__calls.find(x=>/Memory \(text\) · Sam/.test(x.dbg));
    const m=state.memory.filter(x=>x.source==="text").slice(-1)[0]||{};
    return {first,flushed:!!f&&/just got in/.test(f.text),per:m.gamePeriod,when:!!f&&/WHEN: Day 2, Afternoon/.test(f.text),arc2:JSON.stringify(chat._textArc.p_sa)};
  });
  ok("\"different\" with nothing tracked yet commits the whole thread, closing exchange included", T.first.closing&&/"start":4/.test(T.first.arc), JSON.stringify(T));
  ok("an open phone thread is flushed at the period change, filed under the stretch that ended", T.flushed&&T.per==="Afternoon"&&T.when&&/"start":6/.test(T.arc2), JSON.stringify(T));
  ok("the period change and the day end both flush phone threads", /flushMemoryArc\(chat,prevDay,prevPeriod\);[^\n]*\n[^\n]*flushTextArcs\(chat,prevDay,prevPeriod\)/.test(SRC)&&/await flushTextArcs\(chat,day,endPeriod/.test(SRC), "flushTextArcs not wired");

  // ---------------------------------------------------------------------------------------------
  console.log("\n[10. the fast read's moment starts at the last scene cut]");
  await setup();
  const F=await pg.evaluate(()=>{
    const chat=curChat(); const ear=["p_sa"];
    chat.messages.push({mid:"i0",role:"assistant",speaker:"Sam",speakerId:"p_sa",content:"*Kapıya doğru yürüyüp yemekhaneden çıkıyor.*",present:ear.slice()});
    chat.messages.push({mid:"i1",role:"assistant",speaker:"Narrator",dayMarker:true,dayFrom:1,dayTo:2,content:"Day 2 — Morning",narration:"A grey morning."});
    chat.messages.push({mid:"i2",role:"user",content:"\"Sam! Günaydın.\"",present:ear.slice()});
    chat.messages.push({mid:"i3",role:"assistant",speaker:"Sam",speakerId:"p_sa",content:"\"Günaydın.\"",present:ear.slice()});
    const ex=recentExchangeFor(chat,state.personas.find(p=>p.id==="p_sa"),6);
    return {n:ex.length,head:ex[0]&&ex[0].content,old:ex.some(m=>/yemekhaneden/.test(m.content))};
  });
  ok("yesterday's lines are cut; the day marker heads the window", !F.old&&/^\[Day 2 — Morning\]/.test(F.head||"")&&F.n===3, JSON.stringify(F));

  // ---------------------------------------------------------------------------------------------
  console.log("\n[11. gossip: the witness's sheet is labelled, and an overheard exchange is not a glance]");
  await setup();
  const G=await pg.evaluate(async()=>{
    const chat=curChat(); const be=state.personas.find(p=>p.id==="p_be");
    be.relationships={p_bu:{tie:"friend",relationship:"You have known him since school."},p_sa:{tie:"brother",relationship:"x"}};
    state.memory=[{id:"o1",ownerId:"p_be",character:"Bert",type:"OBSERVATION",listener:true,charge:0.9,content:"Deniz and Sam agreed on cash, behind Buket's back.",gameDay:2,gamePeriod:"Afternoon",universeId:chat.universeId,chatId:chat.id,importance:0.6}];
    window.__reply=()=>JSON.stringify({spread:[]});
    await runGossipPropagation(chat,2,chat.universeId,"Afternoon");
    const c=window.__calls.find(x=>/Gossip · Bert/.test(x.dbg));
    return {called:!!c,heard:!!c&&/HEARD this — not a glance/.test(c.text),label:!!c&&/every \\"you\\" in it is Bert, not you/.test(c.text)};
  });
  ok("the referee is told the listener heard it, and whose \"you\" the sheet uses", G.called&&G.heard&&G.label, JSON.stringify(G));

  // ---------------------------------------------------------------------------------------------
  console.log("\n[12. the diary is told the part of the day, what each moment left, and who is who]");
  await setup();
  const D=await pg.evaluate(async()=>{
    const chat=curChat(); const sa=state.personas.find(p=>p.id==="p_sa");
    sa.relationships={p_be:{tie:"brother",relationship:"x"},__user__:{tie:"childhood friend",relationship:"x"}};
    state.memory=[{id:"y1",ownerId:"p_sa",character:"Sam",type:"EXPERIENCE",content:"Bert didn't say good morning.",feelings:"It stung more than it should.",people:["Bert","Deniz"],gameDay:2,gamePeriod:"Morning",universeId:chat.universeId,chatId:chat.id,importance:0.5}];
    window.__reply=()=>JSON.stringify({content:"Dear diary."});
    await writeDayDiaries(chat,2,chat.universeId,[{role:"assistant",speaker:"Sam",speakerId:"p_sa",content:"x"}],"Sam");
    const c=window.__calls.find(x=>/Diary · Sam/.test(x.dbg));
    return {per:!!c&&/\(Morning\) Bert didn't say good morning/.test(c.text),feel:!!c&&/It stung more than it should/.test(c.text),
      who:!!c&&/Bert — brother/.test(c.text)&&/Deniz — childhood friend/.test(c.text)};
  });
  ok("diary lines carry the period and the feelings; the people in them get their tie", D.per&&D.feel&&D.who, JSON.stringify(D));

  // ---------------------------------------------------------------------------------------------
  console.log("\n[13. the daily relationship read: one call per character, the rules sent once]");
  await setup();
  const B=await pg.evaluate(async()=>{
    const chat=curChat(); chat.rel={};
    const day=[{role:"user",content:"hi",present:["p_sa","p_be"]},{role:"assistant",speaker:"Sam",speakerId:"p_sa",content:"hello",present:["p_sa","p_be"]},{role:"assistant",speaker:"Bert",speakerId:"p_be",content:"yo",present:["p_sa","p_be"]}];
    chat.messages=day.slice();
    window.__reply=(d)=>{
      if(/Daily relationship · Sam → Deniz, Bert/.test(d))return JSON.stringify({targets:[{target:"Deniz",trust:4,description:"You like him."},{target:"Bert",trust:-3,description:"You are tired of him."}]});
      if(/Daily relationship · Bert → Deniz, Sam/.test(d))return JSON.stringify({targets:[{target:"Deniz",trust:2,description:"Fine."}]});   // Sam missing → his own call
      if(/Daily relationship · Bert → Sam/.test(d))return JSON.stringify({trust:7,description:"Your brother."});
      return "{}"; };
    await runDailyRelationships(chat,2,day);
    const labels=window.__calls.filter(x=>/Daily relationship/.test(x.dbg)).map(x=>x.dbg);
    const sys=(window.__calls.find(x=>/Sam → Deniz, Bert/.test(x.dbg))||{}).text||"";
    const once=(sys.match(/THE SIX AXES/g)||[]).length;   // v150.113 — the six-axis daily read
    return {labels,once,contract:/\\"targets\\"/.test(sys),
      v:{sd:relObj(chat,"p_sa","__user__").trust,sb:relObj(chat,"p_sa","p_be").trust,bd:relObj(chat,"p_be","__user__").trust,bs:relObj(chat,"p_be","p_sa").trust},
      stamped:relObj(chat,"p_sa","p_be").dayEvalFor};
  });
  ok("each character's targets share one call, the rules appear once", B.labels.indexOf("Daily relationship · Sam → Deniz, Bert")>=0&&B.once===1&&B.contract, JSON.stringify(B));
  ok("every entry of the answer is applied to its own pair (same contract)", B.v.sd===4&&B.v.sb===-3&&B.v.bd===2&&B.stamped===2, JSON.stringify(B.v));
  ok("a person missing from the answer falls back to their own read", B.labels.indexOf("Daily relationship · Bert → Sam")>=0&&B.v.bs===7, JSON.stringify(B));

  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail?1:0);
})();
