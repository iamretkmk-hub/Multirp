/* Character quests and what the player knows. Reported: a character's own work plan (asking the head doctor for
   evening shifts — the player never heard of it) came back as a pursuit through the player: "keep the news to
   yourself". Her text then thanked him "for last night" about an afternoon at the beach.
   Covered here:
     1. each recent memory the quest designer reads says whether the player was part of it;
     2. the designer is told the player is the target only of a pursuit they are part of, and returns user_knows;
     3. a pursuit through the player asking them to keep quiet about something they don't know is not born;
     4. a pursuit whose matter is news to the player tells the text writer so;
     5. "last saw … in person" names the part of the day ("yesterday afternoon"), not just the day;
     6. a stored copy of the designer prompt gets the rule and the field in place, the player's edits kept.
   Run: NODE_PATH=/path/to/node_modules node tests/cq-player-knowledge.browser.js */
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
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x===undefined?c:x).slice(0,900));} };

  const setup=()=>pg.evaluate(()=>{
    window.__calls=[]; window.__quest=null;
    window.chatCompletion=async(m,mo,o)=>{ const d=(o&&o.dbg)||"?"; window.__calls.push({dbg:d,text:JSON.stringify(m)});
      if(/^Char quest \(spawn\)/.test(d)) return JSON.stringify({quest:window.__quest});
      if(/^Char quest \(text\)/.test(d)) return JSON.stringify({message:"Merhaba.",why:"x"});
      return "{}"; };
    const uni=state.universes[0]; state.curUniverse=uni.id;
    uni.gameData={}; uni.cqAsked={}; uni.cqLastSpawn=null;
    uni.locations=[{id:"l_beach",name:"Beach Club",description:"x",residents:[],sublocations:[]}];
    const mk=(id,n,goals)=>({id,name:n,universeId:uni.id,personality:"x",instructions:"x",goals,look:{}});
    state.personas=[mk("p_m","Mira","build a practice of her own"),mk("p_s","Stefan","")];
    state.user="Jonas"; uni.userName=""; state.key="k"; state.mem=true; state.charQuestsOn=true; state.textsOn=true;
    const c=curChat(); c.universeId=uni.id; c.gameDay=2; c.period="Afternoon"; c.timeOfDay="Afternoon";
    c.locationId="l_beach"; c.location="Beach Club"; c.presentIds=[]; c.intents=[]; c.messages=[];
    const mem=(id,content,people,per,day)=>({id,ownerId:"p_m",content,people,type:"EXPERIENCE",importance:0.7,gameDay:day||2,gamePeriod:per,universeId:uni.id,chatId:c.id,date:Date.now()});
    state.memory=[mem("m1","I met Jonas at the beach and we talked for hours.",["Jonas"],"Midday",1),
                  mem("m2","I proposed two extra evening shifts to the head doctor and he agreed.",["Head doctor"],"Afternoon")];
    return true;
  });

  console.log("\n[1-2 — the designer sees who was part of what, and is told when the player is the target]");
  await setup();
  const A=await pg.evaluate(async()=>{
    __quest={title:"Evening shifts",desc:"d",motive:"m",target:"Stefan",approach:"text",gate:{type:"any"},user_knows:false,done_when:"The petition is in."};
    await runCharQuestSpawn(curChat(),2,state.universes[0],{period:"Afternoon"});
    const c=__calls.find(x=>/Char quest \(spawn\)/.test(x.dbg)); return c?c.text:"";
  });
  ok("a memory with the player is marked as with him", /talked for hours\.? \(with Jonas\)/.test(A), A.slice(A.indexOf("Recently"),A.indexOf("Recently")+500));
  ok("her own work memory is marked as one he was not part of", /head doctor and he agreed\.? \(Jonas was not part of this\)/.test(A));
  ok("the rule: the player is the target only of a pursuit they are part of; never a secret they were never told", /is the target only when the pursuit truly runs through them/.test(A)&&/Never ask Jonas to keep quiet about something they were never told/.test(A), A.slice(A.indexOf("target"),A.indexOf("target")+900));
  ok("and the designer returns user_knows", /\\"user_knows\\"/.test(A));

  console.log("\n[3 — \"keep it to yourself\" about something the player doesn't know is not born]");
  await setup();
  const B=await pg.evaluate(async()=>{
    __quest={title:"Evening shifts petition",desc:"d",motive:"m",target:"USER",ask:"You want Jonas to keep the news of the extra shifts to himself until it is official.",approach:"either",gate:{type:"any"},user_knows:false,done_when:"The petition is in."};
    const n=await runCharQuestSpawn(curChat(),2,state.universes[0],{period:"Afternoon"});
    return {n,qs:_charQuests(state.universes[0]).length};
  });
  ok("no pursuit is born", B.n===0&&B.qs===0, JSON.stringify(B));
  await setup();
  const B2=await pg.evaluate(async()=>{
    __quest={title:"Help with the move",desc:"d",motive:"m",target:"USER",ask:"You want Jonas to help you carry the chairs to the new clinic on Saturday.",approach:"text",gate:{type:"any"},user_knows:false,done_when:"The chairs are moved."};
    const n=await runCharQuestSpawn(curChat(),2,state.universes[0],{period:"Afternoon"});
    const q=_charQuests(state.universes[0])[0]||{};
    return {n,userKnows:q.userKnows};
  });
  ok("a real ask of the player about something new to him is still born, marked as news to him", B2.n===1&&B2.userKnows===false, JSON.stringify(B2));

  console.log("\n[4-5 — the text: news to the player, and the part of the day they last met]");
  const C=await pg.evaluate(async()=>{
    const c=curChat(); c.period="Evening"; c.timeOfDay="Evening";
    c.messages=[{mid:"x1",role:"assistant",speaker:"Mira",speakerId:"p_m",content:'"See you."',present:["p_m"],status:{day:1,period:"Afternoon",location:"Beach Club"}}];
    __calls=[]; await maybeCharQuestText(c);
    const t=__calls.find(x=>/Char quest \(text\)/.test(x.dbg)); return t?t.text:"";
  });
  ok("the text writer is told the matter is news to him and must be explained first", /Jonas knows nothing about this matter yet/.test(C)&&/says what it is about before it asks/.test(C), C.slice(-700));
  ok("and when they last met, with the part of the day — not just \"yesterday\"", /last saw Jonas in person yesterday afternoon at Beach Club/.test(C), (C.match(/last saw[^.]*/)||[""])[0]);
  const W=await pg.evaluate(()=>[_seenWhen({gap:0,period:"Midday"}),_seenWhen({gap:1,period:"Night"}),_seenWhen({gap:3,period:"Morning"}),_seenWhen({gap:null,period:""})]);
  ok("_seenWhen: today, yesterday and further back all carry the part of the day", /earlier today, in the midday/.test(W[0])&&W[1]==="yesterday at night"&&/, in the morning$/.test(W[2])&&W[3]==="some time back", JSON.stringify(W));

  console.log("\n[6 — a stored copy of the designer prompt is updated in place]");
  await pg.evaluate(()=>{
    const RULE=(DEFAULT_CHARQUEST_GEN.match(/\n  · \{\{user\}\} is the target only when[^\n]*/)||[""])[0];
    const FLD=(DEFAULT_CHARQUEST_GEN.match(/"user_knows":"[^"]*",/)||[""])[0];
    store.setRaw(K.charQuestGen,DEFAULT_CHARQUEST_GEN.replace(RULE,"").replace(FLD,"")+"\nMY QUEST EDIT");
  });
  await pg.reload(); await pg.waitForTimeout(2400);
  const M=await pg.evaluate(()=>({rule:/is the target only when the pursuit truly runs through them/.test(state.charQuestGen),
    field:/"user_knows":"/.test(state.charQuestGen), kept:/MY QUEST EDIT/.test(state.charQuestGen),
    placed:state.charQuestGen.indexOf('genuinely needs {{user}}.\n  · {{user}} is the target only when')>=0}));
  ok("the rule and the field are added, after the lines they follow, the player's edit kept", M.rule&&M.field&&M.kept&&M.placed, JSON.stringify(M));

  ok("no page errors", errs.length===0?true:errs.join(" | "));
  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close(); process.exit(fail?1:0);
})();
