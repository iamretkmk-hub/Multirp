/* v148.1 — THE PLAYER'S OWN KNOWLEDGE: the player's memory of each stretch of a scene, their own picture of
   who is who (u.userTies / userSocialGraph), and the suggestion payload that reads both instead of the
   characters' private view of the player.
   Every model call is stubbed (window.chatCompletion) and the prompts it receives are captured.
   Run: NODE_PATH=/path/to/node_modules node tests/player-knowledge.browser.js */
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:process.env.SM_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage({viewport:{width:412,height:915}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file://'+require('path').resolve(__dirname,'..','index.html')); await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(900);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x===undefined?c:x).slice(0,900));} };

  // The report's scene: Sami and Berker (brothers) with the player Emre; Sami's card carries his PRIVATE view of Emre.
  const setup=()=>pg.evaluate(()=>{
    const uni=state.universes[0]; state.curUniverse=uni.id; uni.userName="Emre"; delete uni.userTies; delete uni.userSocialGraphAuto; uni.userSocialGraph="";
    const mk=(id,name,extra)=>Object.assign({id,name,universeId:uni.id,instructions:"x",personality:"x",backstory:"x",style:"x",goals:"x",look:{}},extra||{});
    state.personas=state.personas.filter(p=>!/^p_(sa|be|bu)$/.test(p.id));
    state.personas.push(
      mk("p_sa","Sami Özüçak",{backstory:"You drifted into the Meltshop at Isdemir. You never repaid a loan from Berker.",socialGraph:"Berker is your younger brother.",
        relationships:{__user__:{tie:"childhood friend",relationship:"You grew up together, and now he's Chief Mechanical Maintenance Engineer. You've noticed he's been looking at Burcu Atan."},
                       p_be:{tie:"younger brother",relationship:"You lean on him."}}}),
      mk("p_be","Berker Özüçak",{backstory:"You work in Isdemir's accounting department.",
        relationships:{__user__:{tie:"childhood friend",relationship:"You noticed the way he looks at Buket and said nothing."},
                       p_sa:{tie:"older brother",relationship:"You clean up after him."},
                       p_bu:{tie:"secret lover",relationship:"Nobody knows."}}}),
      mk("p_bu","Burcu Atan"));
    state.user="Emre"; state.key="sk-test"; state.mem=true; state.memMinImp=0; state.condenseOn=false; state.playerMemOn=true;
    state.autoCharOn=false; state.embedOn=false; state.narrPrivacy=true;
    const chat=curChat(); chat.universeId=uni.id; chat.gameDay=1; chat.period="Midday"; chat.timeOfDay="Midday"; chat.location="Vanadium Cafe";
    chat.presentIds=["p_sa","p_be"]; chat.rel={}; chat.memEvent=null; chat.memDoneIdx=-1; chat.messages=[]; chat.locationId=null; chat.playerMem=[];
    state.memory=[];
    window.__calls=[];
    window.__reply=(d)=>{
      if(/\(you\)/.test(d))return JSON.stringify({content:"I told Sami and Berker I would come to the mill on Friday. Sami teased me about being in a hurry.",people:["Sami Özüçak","Berker Özüçak","Emre"],importance:0.6,open:["the mill visit on Friday"]});
      if(/^Your ties/.test(d))return JSON.stringify({people:[{name:"Sami Özüçak",tie:"childhood friend",view:"Sami is your childhood friend; he works in the Meltshop and is Berker's older brother."},
        {name:"Berker",tie:"childhood friend",view:"Berker is Sami's younger brother and works in accounting."}],social_graph:"Sami and Berker are brothers you grew up with."});
      if(/Suggested replies/.test(d))return JSON.stringify({options:["Tease Sami back","Ask Berker about Friday","Head to the mill"]});
      return JSON.stringify({content:"A memory "+Math.random().toString(36).slice(2,8),importance_score:0.6});
    };
    window.chatCompletion=async(msgs,model,opts)=>{ const d=(opts&&opts.dbg)||""; window.__calls.push({dbg:d,text:JSON.stringify(msgs),opts:opts||{}}); return window.__reply(d,msgs); };
    return true;
  });
  const scene=()=>pg.evaluate(()=>{
    const chat=curChat(); const ear=["p_sa","p_be"];
    chat.messages.push({mid:"a0",role:"user",content:"\"Let's go, we'll be late.\" *I nod to Sami and Berker.*",present:ear.slice()});
    chat.messages.push({mid:"a1",role:"assistant",speaker:"Sami Özüçak",speakerId:"p_sa",content:"_He always rushes, the fool._ \"Emre, what's the hurry?\"",present:ear.slice()});
    chat.messages.push({mid:"a2",role:"user",content:"\"I'll come by the mill on Friday.\"",present:ear.slice()});
    chat.messages.push({mid:"a3",role:"assistant",speaker:"Berker Özüçak",speakerId:"p_be",content:"\"Friday then.\"",present:ear.slice()});
    chat.messages.push({mid:"q0",role:"assistant",questNote:true,content:"New quest: something"});
  });

  // ---------------------------------------------------------------------------------------------
  console.log("\n[1. the player gets a memory of their own when an arc closes]");
  await setup(); await scene();
  const M=await pg.evaluate(async()=>{
    const chat=curChat();
    await commitMemoryArc(chat,0,4,1,"Midday");
    const c=window.__calls.find(x=>/\(you\)/.test(x.dbg));
    const pm=chat.playerMem||[];
    return {dbg:c&&c.dbg,thought:!!(c&&/the fool/.test(c.text)),quest:!!(c&&/New quest/.test(c.text)),spoken:!!(c&&/what's the hurry/.test(c.text)),
      n:pm.length,rec:pm[0]||null,inBank:(state.memory||[]).some(m=>/mill on Friday/.test(m.content||"")),chars:(state.memory||[]).length};
  });
  ok("one call writes the player's memory, beside the characters'", M.dbg==="Memory (arc) · Emre (you)"&&M.chars===2, JSON.stringify(M));
  ok("it reads what the player saw and heard — not a character's thought, not app notices", M.spoken&&!M.thought&&!M.quest, JSON.stringify(M));
  ok("stored on the chat, never in the characters' memory bank", M.n===1&&!M.inBank, JSON.stringify(M));
  ok("with day, period, place, its sources and the open thread; the player is not listed among the people",
     M.rec&&M.rec.gameDay===1&&M.rec.gamePeriod==="Midday"&&M.rec.location==="Vanadium Cafe"&&M.rec.srcMids.join()==="a0,a1,a2,a3"
     &&M.rec.people.join()==="Sami Özüçak,Berker Özüçak"&&M.rec.open[0]==="the mill visit on Friday"&&M.rec.importance===0.6, JSON.stringify(M.rec));
  const D=await pg.evaluate(async()=>{
    const chat=curChat(); const k=window.__calls.length;
    await commitMemoryArc(chat,0,4,1,"Midday",{doneTo:{}});
    return {again:window.__calls.slice(k).some(x=>/\(you\)/.test(x.dbg)),n:chat.playerMem.length};
  });
  ok("the same stretch committed again (a retried arc) is not remembered twice", !D.again&&D.n===1, JSON.stringify(D));
  const Off=await pg.evaluate(async()=>{
    const chat=curChat(); chat.playerMem=[]; state.playerMemOn=false; const k=window.__calls.length;
    await commitMemoryArc(chat,0,4,1,"Midday");
    const r={call:window.__calls.slice(k).some(x=>/\(you\)/.test(x.dbg)),n:chat.playerMem.length}; state.playerMemOn=true; return r;
  });
  ok("switched off (playerMemOn=false): no call, nothing stored", !Off.call&&Off.n===0, JSON.stringify(Off));
  const RB=await pg.evaluate(async()=>{
    const chat=curChat(); chat.playerMem=[{id:"pm1",content:"x",srcMids:["a2","a3"]},{id:"pm2",content:"y",srcMids:["a0"]}];
    await _retryRollback(chat,"a3",3);
    return chat.playerMem.map(x=>x.id).join();
  });
  ok("a Retry takes back the player's memory cut from the discarded reply", RB==="pm2", RB);

  // ---------------------------------------------------------------------------------------------
  console.log("\n[2. what the player knows: their side of each tie, who is who, their own memories]");
  await setup(); await scene();
  const K1=await pg.evaluate(()=>{
    const chat=curChat();
    state.memory=[{id:"m_sa",ownerId:"p_sa",character:"Sami Özüçak",type:"EXPERIENCE",content:"I overheard Burcu calling Emre out; he kept his smirk.",people:["Emre","Burcu Atan"],gameDay:1,gamePeriod:"Midday",universeId:chat.universeId,chatId:chat.id,importance:0.6}];
    const keep=window.maybeSeedPlayerTies; window.maybeSeedPlayerTies=()=>{};   // seeding is checked on its own below
    try{ return _playerKnows(chat); }finally{ window.maybeSeedPlayerTies=keep; }
  });
  ok("no entry yet: the tie WORD from the card only — never the character's private text about the player",
     /- Sami Özüçak \(childhood friend\)/.test(K1.people)&&!/Chief Mechanical|looking at Burcu|looks at Buket/.test(K1.people), K1.people);
  ok("who is who among the people here, from the cards' public tie words (a secret one is left out)",
     /Berker Özüçak: Sami Özüçak's younger brother|Sami Özüçak: Berker Özüçak's older brother/.test(K1.social)&&!/secret lover/.test(K1.social), K1.social);
  ok("no player memory yet: the old reading of the characters' memories still stands in", /as Sami Özüçak remembers it/.test(K1.memories), K1.memories);
  const K2=await pg.evaluate(()=>{
    const chat=curChat(); const u=universeById(chat.universeId);
    u.userTies={p_sa:{tie:"childhood friend",view:"Sami is your childhood friend; he works in the Meltshop."}};
    u.userSocialGraph="Sami and Berker are brothers I grew up with."; u.userSocialGraphAuto="Everyone knows the brothers argue about money.";
    chat.playerMem=[
      {id:"pmA",content:"I promised to visit the mill on Friday.",people:["Sami Özüçak"],importance:0.7,open:["the mill on Friday"],gameDay:1,gamePeriod:"Morning",location:"Mill",srcMids:["x1"]},
      {id:"pmB",content:"We just left the cafe together.",people:["Sami Özüçak"],importance:0.4,gameDay:1,gamePeriod:"Midday",srcMids:["a0","a1"]}];
    return _playerKnows(chat,{skipMids:new Set(["a0","a1"])});
  });
  ok("the player's own entry for a person is what the payload shows", /- Sami Özüçak \(childhood friend\): Sami is your childhood friend; he works in the Meltshop\./.test(K2.people), K2.people);
  ok("the player's own words on who is who come first, then the story's", /^Sami and Berker are brothers I grew up with\.\nEveryone knows the brothers argue about money\.$/.test(K2.social), K2.social);
  ok("their own memories (with what is still open), not the characters'", /I promised to visit the mill on Friday\. \(still open: the mill on Friday\)/.test(K2.memories)&&!/remembers it/.test(K2.memories), K2.memories);
  ok("a memory made only of the lines already quoted is left out", !/We just left the cafe/.test(K2.memories), K2.memories);

  // ---------------------------------------------------------------------------------------------
  console.log("\n[3. the suggestion writer's payload]");
  await setup(); await scene();
  const S=await pg.evaluate(async()=>{
    const chat=curChat(); const u=universeById(chat.universeId);
    u.userTies={p_sa:{tie:"childhood friend",view:"Sami works in the Meltshop."},p_be:{tie:"childhood friend",view:"Berker works in accounting."}};
    chat.playerMem=[{id:"pmA",content:"I promised to visit the mill on Friday.",people:["Sami Özüçak"],importance:0.7,gameDay:1,gamePeriod:"Morning",srcMids:["x1"]}];
    _sugBusy=false; await fetchSuggestions(chat,"a3");
    const c=window.__calls.find(x=>/Suggested replies/.test(x.dbg)); return {t:c?c.text:"",seeded:window.__calls.some(x=>/^Your ties/.test(x.dbg))};
  });
  ok("it carries WHO IS WHO and WHAT THE PLAYER REMEMBERS, with the player's own entries", /WHO IS WHO \(as the player knows it\)/.test(S.t)&&/WHAT THE PLAYER REMEMBERS/.test(S.t)&&/Berker works in accounting/.test(S.t)&&/visit the mill on Friday/.test(S.t), S.t.slice(0,1400));
  ok("and nothing from the characters' private view of the player", !/Chief Mechanical|looking at Burcu|looks at Buket/.test(S.t), S.t.slice(0,1400));
  ok("everyone here already has an entry: nothing to seed", S.seeded===false, JSON.stringify(S.seeded));
  const Seed=await pg.evaluate(async()=>{
    const chat=curChat(); const u=universeById(chat.universeId); u.userTies={}; _playerSheetTried=new Set();
    const k=window.__calls.length; _playerKnows(chat); await new Promise(r=>setTimeout(r,50));
    const c=window.__calls.slice(k).find(x=>/^Your ties/.test(x.dbg)); const k2=window.__calls.length; _playerKnows(chat); await new Promise(r=>setTimeout(r,50));
    return {dbg:c&&c.dbg,bg:c&&!c.opts.foreground,again:window.__calls.slice(k2).some(x=>/^Your ties/.test(x.dbg)),ties:JSON.stringify(u.userTies),graph:u.userSocialGraphAuto};
  });
  ok("someone here with no entry: one background call writes it (once per session)", Seed.dbg==="Your ties · Sami Özüçak, Berker Özüçak"&&Seed.bg&&!Seed.again, JSON.stringify(Seed));
  ok("the answer is filed by name (a first name finds its person) with the story's who-is-who",
     /"p_sa":\{"tie":"childhood friend","view":"Sami is your childhood friend; he works in the Meltshop/.test(Seed.ties)&&/"p_be":\{"tie":"childhood friend"/.test(Seed.ties)&&Seed.graph==="Sami and Berker are brothers you grew up with.", JSON.stringify(Seed));

  // ---------------------------------------------------------------------------------------------
  console.log("\n[4. the sheet writer and the day end]");
  await setup(); await scene();
  const W=await pg.evaluate(async()=>{
    const chat=curChat(); const u=universeById(chat.universeId); u.userSocialGraph="Sami is my oldest friend.";
    chat.playerMem=[{id:"pmA",content:"Berker and I argued about the budget.",people:["Berker Özüçak"],gameDay:3,gamePeriod:"Evening"},
                    {id:"pmB",content:"Burcu said hello.",people:["Burcu Atan"],gameDay:2,gamePeriod:"Evening"}];
    const k=window.__calls.length; await playerSheetForDay(chat,3);
    const c=window.__calls.slice(k).find(x=>/^Your ties/.test(x.dbg));
    return {dbg:c&&c.dbg,t:c?c.text:"",authored:u.userSocialGraph,day:(u.userTies.p_be||{}).day};
  });
  ok("day end: the people in the player's memories of THAT day are updated", W.dbg==="Your ties · Berker Özüçak"&&W.day===3, JSON.stringify({dbg:W.dbg,day:W.day}));
  ok("the writer gets the player's own notes, the card as public facts only, and the player's memories of them",
     /YOUR OWN NOTES/.test(W.t)&&/Sami is my oldest friend/.test(W.t)&&/public facts only/.test(W.t)&&/argued about the budget/.test(W.t)&&!/Burcu said hello/.test(W.t), W.t.slice(0,1500));
  ok("the player's own words are never overwritten", W.authored==="Sami is my oldest friend.", W.authored);
  const ST=await pg.evaluate(()=>DAYEND_STAGES.slice(-2).join());
  ok("the day end has a playerSheet stage, last (a saved record's stage index stays valid)", ST==="chronicle,playerSheet", ST);

  // ---------------------------------------------------------------------------------------------
  console.log("\n[5. reset, the editor, the Auto-RP line]");
  await setup();
  const RS=await pg.evaluate(()=>{
    const u=state.universes[0]; u.userTies={p_sa:{tie:"x",view:"y"}}; u.userSocialGraphAuto="auto"; u.userSocialGraph="mine";
    try{ wipeUniverseState(u.id); }catch(e){ return "threw "+e.message; }
    return JSON.stringify({ties:u.userTies||null,auto:u.userSocialGraphAuto||null,mine:u.userSocialGraph});
  });
  ok("a universe reset forgets the story's entries and keeps the player's own words", RS==='{"ties":null,"auto":null,"mine":"mine"}', RS);
  await setup(); await scene();
  const E=await pg.evaluate(()=>{
    const chat=curChat(); const u=universeById(chat.universeId);
    u.userTies={p_sa:{tie:"childhood friend",view:"Sami works in the Meltshop."}}; u.userSocialGraph="Mine.";
    chat.playerMem=[{id:"pmA",content:"I promised to visit the mill.",gameDay:1,gamePeriod:"Morning",open:["Friday"]}];
    editUniverse(u.id);
    const ties=document.getElementById('ueUserTies').textContent, mem=document.getElementById('ueUserMem').textContent, sg=document.getElementById('ueUserSocialGraph').value;
    deletePlayerMem(chat.id,"pmA"); deleteUserTie("p_sa");
    const after={pm:chat.playerMem.length,ties:Object.keys(u.userTies).length};
    document.getElementById('ueUserSocialGraph').value="Sami and Berker are brothers."; saveUniverse();
    return {ties,mem,sg,after,saved:u.userSocialGraph};
  });
  ok("the universe editor shows the story's entries and the player's memories", /Sami Özüçak/.test(E.ties)&&/Meltshop/.test(E.ties)&&/visit the mill/.test(E.mem)&&/Still open: Friday/.test(E.mem)&&E.sg==="Mine.", JSON.stringify(E));
  ok("both can be forgotten one by one, and the player's own words are saved", E.after.pm===0&&E.after.ties===0&&E.saved==="Sami and Berker are brothers.", JSON.stringify(E));
  const AR=await pg.evaluate(()=>{ const chat=curChat(); universeById(chat.universeId).userTies={p_sa:{tie:"old friend",view:""}}; return _playerPeopleShort(chat); });
  ok("the Auto-RP narrator is told what the people here are to the player", AR==="\nWho they are to you: Sami Özüçak (old friend), Berker Özüçak (childhood friend).", JSON.stringify(AR));

  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close(); process.exit(fail?1:0);
})();
