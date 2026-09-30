/* v149.2 — SUGGESTED REPLIES READ THE MOMENT, IN ONE OF FIVE MODES.
   The writer used to be handed the player's whole past (today's ledger, eight memories with their open
   threads, the calendar, every word given, the quests) and kept offering it back. Now:
     - the three styles come from ONE mode prompt picked in code from who is in earshot: one-on-one with a
       woman, with a man, a group, an intimate moment with a woman, or anyone else (a minor here, or no tag);
       only the picked prompt reaches the call;
     - the payload is the player's bio, the scene (day, part of the day, place, area, privacy, earshot), each
       person in full (tie to the player, public facts, card personality and background), who is who, at
       most three memories that involve somebody here (no open threads), the options offered recently,
       the last 30 lines and the player's own last line — no plans, no words given, no quests, no day ledger;
     - each option comes back with a tone, and tapping it hands that tone to the Auto-RP narrator.
   Every model call is stubbed (window.chatCompletion) and the prompts it receives are captured.
   Run: node tests/suggest-modes.browser.js */
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

  // Ayla and Kerem are married; Lale is fifteen; Deniz has no tag at all.
  await pg.evaluate(()=>{
    const uni=state.universes[0]; state.curUniverse=uni.id; uni.userName="Emre"; delete uni.userTies; delete uni.userSocialGraphAuto; uni.userSocialGraph="";
    const mk=(id,name,extra)=>Object.assign({id,name,universeId:uni.id,instructions:"x",personality:"",backstory:"",style:"x",goals:"x",look:{}},extra||{});
    state.personas=state.personas.filter(p=>!/^p_(ay|ke|la|de)$/.test(p.id));
    state.personas.push(
      mk("p_ay","Ayla Kaya",{tags:["Woman","neighbour"],personality:"Quick to laugh, hates being bored.",backstory:"You run the bakery on the corner. You married {{user}}'s old classmate Kerem.",
        relationships:{__user__:{tie:"neighbour",relationship:"PRIVATE: you think about him more than you should."},p_ke:{tie:"husband",relationship:"x"}}}),
      mk("p_ke","Kerem Kaya",{tags:["man"],backstory:"You drive a taxi at night.",relationships:{__user__:{tie:"old classmate",relationship:"x"},p_ay:{tie:"wife",relationship:"x"}}}),
      mk("p_la","Lale Kaya",{tags:["woman"],age:15,backstory:"You are Ayla's niece."}),
      mk("p_de","Deniz Ak",{backstory:"You fix boats."}));
    state.user="Emre"; state.key="sk-test"; state.mem=true; state.playerMemOn=true; state.autoCharOn=false; state.embedOn=false; state.heatOn=false;
    const chat=curChat(); chat.universeId=uni.id; chat.gameDay=3; chat.period="Evening"; chat.timeOfDay="Evening"; chat.location="Corner Bakery"; chat.locationId=null;
    chat.rel={}; chat.messages=[]; chat.playerMem=[]; state.memory=[];
    chat.calendar=[{id:"c1",kind:"meeting",title:"Dinner with Kerem at the harbour",who:"Emre, Kerem Kaya",day:4,period:"Evening",certainty:"certain",done:false}];
    chat.promises=[]; recordPromise(chat,{holder:"Emre",to:"Kerem Kaya",promise:"you will lend Kerem the van on Sunday",kind:"promise",shows_as:"when cars come up"},3);
    window.__calls=[];
    window.__sug='{"options":[{"tone":"FUNNY","text":"Joke that the bread smells like a bribe"},{"tone":"flirt","text":"Ask if she saves the warm ones for him"},{"tone":"SINCERE","text":"Ask how she has really been lately"}]}';
    window.chatCompletion=async(msgs,model,opts)=>{ const d=(opts&&opts.dbg)||""; window.__calls.push({dbg:d,msgs});
      if(d==="Suggested replies")return window.__sug;
      if(d==="Auto-RP player narrator")return '*Emre leans on the counter.* "You save the warm ones for me?"';
      if(/^Your ties/.test(d))return '{"people":[],"social_graph":""}';
      return "{}"; };
    window.__scene=(ids,lines)=>{
      const c=curChat(); c.presentIds=ids.slice(); c.messages=[]; c._sugPrev=[];
      (lines||[]).forEach((l,i)=>c.messages.push(Object.assign({mid:"m"+i,present:ids.slice()},l)));
    };
    window.__ask=async()=>{
      const c=curChat(); window.__calls=[]; _sugBusy=false; _sugSeq++;
      await fetchSuggestions(c,(_sugTail(c)||{}).mid);
      const call=window.__calls.find(x=>x.dbg==="Suggested replies");
      return {sys:call?call.msgs[0].content:"",user:call?call.msgs[1].content:"",opts:_sugOpts.slice(),tones:_sugTones.slice(),mode:suggestMode(c).key};
    };
  });
  const say=(who,text)=>who==="Emre"?{role:"user",content:text}:{role:"assistant",speaker:who,speakerId:{"Ayla Kaya":"p_ay","Kerem Kaya":"p_ke","Lale Kaya":"p_la","Deniz Ak":"p_de"}[who],content:text,toId:"__user__"};
  const STYLES={woman:"2. FLIRT: subtle flirting, and the only style that flirts",man:"3. SEED:",group:"3. SWITCH:",heat:"3. DIRTY:",neutral:"Nothing flirtatious or sexual"};
  const onlyStyle=(sys,want)=>Object.keys(STYLES).every(k=>(k===want)===(sys.indexOf(STYLES[k])>-1));

  // ---------------------------------------------------------------------------------------------
  console.log("\n[1. the mode is picked in code, and only its prompt is sent]");
  const W=await pg.evaluate(async d=>{ __scene(["p_ay"],[d.a,d.b]); return __ask(); },{a:say("Emre",'"Evening, Ayla."'),b:say("Ayla Kaya",'"You again? We are closing."')});
  ok("one-on-one with a card tagged Woman → the woman styles, and only those", W.mode==="x_reply_suggest_woman"&&onlyStyle(W.sys,"woman"), W.mode+"\n"+W.sys.slice(-900));
  ok("…with her name filled in and no placeholder left", /one-on-one with Ayla Kaya, a woman/.test(W.sys)&&W.sys.indexOf("{{")<0, W.sys.slice(-900));
  ok("…after the general rules, which read the moment", /^You write the three options Emre can tap next/.test(W.sys)&&/READ THE MOMENT\./.test(W.sys), W.sys.slice(0,200));

  const M=await pg.evaluate(async d=>{ __scene(["p_ke"],[d.a]); return __ask(); },{a:say("Kerem Kaya",'"Long night ahead."')});
  ok("one-on-one with a man → the man styles, and only those", M.mode==="x_reply_suggest_man"&&onlyStyle(M.sys,"man")&&/one-on-one with Kerem Kaya, a man/.test(M.sys), M.mode+"\n"+M.sys.slice(-700));

  const G=await pg.evaluate(async d=>{ __scene(["p_ay","p_ke"],[d.a]); return __ask(); },{a:say("Kerem Kaya",'"Sit down, Emre."')});
  ok("two or more in earshot → the group styles, and only those", G.mode==="x_reply_suggest_group"&&onlyStyle(G.sys,"group"), G.mode+"\n"+G.sys.slice(-900));
  ok("…told who the women and men are, and who is married to whom (from the cards' tie words)",
     /Women here: Ayla Kaya\. Men here: Kerem Kaya\./.test(G.sys)&&/Couples here: (Kerem Kaya is Ayla Kaya's husband|Ayla Kaya is Kerem Kaya's wife)\./.test(G.sys), G.sys.slice(-900));

  const H=await pg.evaluate(async d=>{ __scene(["p_ay"],[d.a,d.b]); return __ask(); },
    {a:say("Emre",'*I unzip her dress and kiss her neck.*'),b:say("Ayla Kaya",'*She moans and pulls him onto the bed, her breasts pressed to his chest.*')});
  ok("an intimate moment one-on-one with a woman → the heat styles, and only those", H.mode==="x_reply_suggest_heat"&&onlyStyle(H.sys,"heat"), H.mode+"\n"+H.sys.slice(-700));

  const L=await pg.evaluate(async d=>{ __scene(["p_la"],[d.a,d.b]); return __ask(); },
    {a:say("Emre",'*I unzip her dress and kiss her neck.*'),b:say("Lale Kaya",'"Hi."')});
  ok("a minor in earshot → never flirting, never heat: the neutral styles", L.mode==="x_reply_suggest_neutral"&&onlyStyle(L.sys,"neutral"), L.mode+"\n"+L.sys.slice(-500));
  const LG=await pg.evaluate(async d=>{ __scene(["p_ay","p_la"],[d.a]); return __ask(); },{a:say("Ayla Kaya",'"Lale, say hello."')});
  ok("…in a group too", LG.mode==="x_reply_suggest_neutral"&&onlyStyle(LG.sys,"neutral"), LG.mode);

  const D=await pg.evaluate(async d=>{ __scene(["p_de"],[d.a]); return __ask(); },{a:say("Deniz Ak",'"Boat is fixed."')});
  ok("no tag and nothing in the look → the neutral styles", D.mode==="x_reply_suggest_neutral"&&onlyStyle(D.sys,"neutral"), D.mode);
  const D2=await pg.evaluate(()=>{ const p=state.personas.find(x=>x.id==="p_de"); p.look={subject:"a weathered man in his forties"}; const r=suggestMode(curChat()).key; p.look={}; return r; });
  ok("…but a look that says \"a man\" is read as one", D2==="x_reply_suggest_man", D2);
  ok("tags are read in other languages and any case", await pg.evaluate(()=>personSex({tags:["Kadın"]})==="f"&&personSex({tags:["ERKEK"]})==="m"&&personSex({tags:["female"]})==="f"&&personSex({tags:["hostile"]})===""));

  // ---------------------------------------------------------------------------------------------
  console.log("\n[2. the payload is the moment, not the past]");
  const P=await pg.evaluate(async()=>{
    const lines=[];
    for(let i=0;i<40;i++)lines.push(i%2?{role:"assistant",speaker:"Ayla Kaya",speakerId:"p_ay",content:'"Line '+i+' from Ayla."'}:{role:"user",content:'"Line '+i+' from Emre."'});
    __scene(["p_ay"],lines);
    const c=curChat();
    c.playerMem=[1,2,3,4,5].map(i=>({id:"pm"+i,content:"Ayla memory "+i+".",people:["Ayla Kaya"],importance:0.5,open:["open thread "+i],gameDay:2,gamePeriod:"Morning"}))
      .concat([{id:"pmX",content:"Deniz memory about boats.",people:["Deniz Ak"],importance:1,gameDay:3,gamePeriod:"Morning"}]);
    return __ask();
  });
  ok("no plans, no words given, no quests, no day ledger", !/Dinner with Kerem|lend Kerem the van|EARLIER TODAY|THE PLAYER'S PLANS|WORDS GIVEN|QUESTS/.test(P.user), P.user.slice(0,1200));
  ok("the player, the scene (day, part of the day, place, earshot) and the people here in full",
     /THE PLAYER:\nName: Emre/.test(P.user)&&/THE SCENE:\nDay 3, Evening, at Corner Bakery/.test(P.user)&&/Within earshot of Emre: Ayla Kaya\./.test(P.user)
     &&/THE PEOPLE HERE:\n## Ayla Kaya \(woman\)/.test(P.user)&&/Personality \(from their card[^\n]*Quick to laugh/.test(P.user)&&/Background \(from their card[^\n]*bakery on the corner\. You married Emre's old classmate Kerem\./.test(P.user), P.user.slice(0,1400));
  ok("…but never the character's private view of the player", !/think about him more than you should/.test(P.user), P.user.slice(0,1400));
  const conv=(P.user.split("THE LAST LINES:\n")[1]||"").split("\n\n")[0].split("\n");
  ok("the last 30 lines, no more", conv.length===30&&/Line 10 from Emre/.test(conv[0])&&/Line 39 from Ayla/.test(conv[29]), conv.length+" | "+conv[0]+" … "+conv[conv.length-1]);
  ok("the player's own last line, called out", /THE PLAYER'S OWN LAST LINE:\nEmre: "Line 38 from Emre\."/.test(P.user), P.user.slice(-400));
  const mem=(P.user.split("A FEW THINGS THE PLAYER REMEMBERS:\n")[1]||"").split("\n\n")[0];
  ok("at most three memories, only about the people here, with no open threads", mem.split("\n").length===3&&!/Deniz|still open|open thread/.test(mem), mem);

  // ---------------------------------------------------------------------------------------------
  console.log("\n[3. no repeats, and the tone reaches the narrator]");
  const R=await pg.evaluate(async()=>{ const a=await __ask(); const b=await __ask(); return {a,b}; });
  ok("each option comes back with its style, matched to the mode's names whatever the case", R.a.opts.length===3&&R.a.tones.map(t=>t&&t.name).join("|")==="FUNNY|FLIRT|SINCERE"&&/^subtle flirting, and the only style that flirts/.test(R.a.tones[1].desc), JSON.stringify([R.a.opts,R.a.tones]));
  ok("the next set is told what was already offered — last, right before the ask, as spent ideas", /ALREADY OFFERED \(spent: none of these ideas again, not even in other words\):\n- Joke that the bread smells like a bribe[\s\S]*\n\nWrite the three options/.test(R.b.user)&&R.b.user.indexOf("ALREADY OFFERED")>R.b.user.indexOf("THE LAST LINES"), R.b.user.slice(-900));
  ok("plain-string options still work, with no style guessed for them", await pg.evaluate(async()=>{ const s=window.__sug; window.__sug='{"options":["Ask what she meant","Pour two drinks","Head out"]}';
      const r=await __ask(); window.__sug=s; return r.opts.length===3&&r.tones.every(t=>t===null) ? true : JSON.stringify(r.tones); }));
  ok("the chips carry the style's name, so the three read apart", await pg.evaluate(async()=>{ state.suggestOn=true; await __ask(); _sugSig=""; renderAutoBar();
      const tags=[...document.querySelectorAll('#autoBar .sugChip .sugTag')].map(x=>x.textContent);
      return tags.join("|")==="FUNNY|FLIRT|SINCERE" ? true : JSON.stringify(tags); }));
  const T=await pg.evaluate(async()=>{
    const c=curChat(); state.suggestOn=true; await __ask(); window.__calls=[];
    sendSuggestion(1);
    for(let i=0;i<60&&!window.__calls.some(x=>x.dbg==="Auto-RP player narrator");i++) await new Promise(r=>setTimeout(r,50));
    const n=window.__calls.find(x=>x.dbg==="Auto-RP player narrator");
    return {u:n?n.msgs[1].content:"",s:n?n.msgs[0].content:"",left:_apForceTone};
  });
  ok("tapping an option hands the direction and its style in full to the Auto-RP narrator", /intention for this turn[^\n]*:\nAsk if she saves the warm ones for him\nTone: FLIRT: subtle flirting, and the only style that flirts/.test(T.u)&&T.left==="", T.u.slice(-500));
  ok("…whose prompt says the direction is not the words: it writes them, in that style, without repeating the player", /DIRECTION, NOT THE WORDS/.test(T.s)&&/Write the words yourself/.test(T.s)&&/MOVE IT FORWARD/.test(T.s), T.s.slice(0,300));
  ok("…and it is no longer handed the ledger of words given", !/Words given|lend Kerem the van/.test(T.u), T.u.slice(0,600));

  // ---------------------------------------------------------------------------------------------
  console.log("\n[3b. directions, not lines; this scene only]");
  const DS=await pg.evaluate(()=>__ask());
  ok("the writer is told to give a direction, not the line, and that only a flirting style flirts",
     /A DIRECTION, NOT THE LINE/.test(DS.sys)&&/3 to 10 words/.test(DS.sys)&&/Only a style that says it flirts may flirt/.test(DS.sys)&&!/HOW EACH OPTION IS WRITTEN/.test(DS.sys), DS.sys.slice(0,600));
  ok("an idea used once in the scene, or already offered, is spent — not again, not in other words",
     /AN IDEA IS SPENT/.test(DS.sys)&&/same idea in different words is a repeat/.test(DS.sys)&&/3\. SINCERE:[^\n]*it is spent: ask about her instead/.test(DS.sys), DS.sys.slice(0,900));
  ok("the woman's FUNNY and SINCERE styles forbid flirting and compliments on looks",
     /1\. FUNNY:[^\n]*No flirting, no compliment on her looks/.test(DS.sys)&&/3\. SINCERE:[^\n]*No flirting, no compliment on her looks/.test(DS.sys), DS.sys.slice(-900));
  const SC=await pg.evaluate(async()=>{
    __scene(["p_ay"],[{role:"user",content:'"Old beach line from Emre."'},{role:"assistant",speaker:"Kerem Kaya",speakerId:"p_ke",content:'"Old beach line from Kerem."'},
      {role:"assistant",speaker:"Narrator",narratorEvent:true,travelBeat:true,content:"Emre walks to the bakery."},
      {role:"assistant",speaker:"Ayla Kaya",speakerId:"p_ay",content:'"Oh, you."',toId:"__user__"}]);
    const a=await __ask();
    const c=curChat(); c.messages.push({mid:"cut",role:"assistant",speaker:"Narrator",narratorEvent:true,sceneCut:true,content:"Later, at the counter."},
      {mid:"cut2",role:"assistant",speaker:"Ayla Kaya",speakerId:"p_ay",content:'"Coffee?"',toId:"__user__"});
    const b=await __ask();
    window.__calls=[]; await narratePlayerTurn("Say yes",c,{intent:true});
    const n=window.__calls.find(x=>x.dbg==="Auto-RP player narrator");
    return {a:a.user,b:b.user,n:n?n.msgs[1].content:""};
  });
  ok("the last lines start at the travel beat: the scene before it is not sent", /THE LAST LINES:\nNarrator: Emre walks to the bakery\.\nAyla Kaya: "Oh, you\."/.test(SC.a)&&!/Old beach line/.test(SC.a), SC.a.slice(-500));
  ok("…and at a scene cut", /THE LAST LINES:\nNarrator: Later, at the counter\.\nAyla Kaya: "Coffee\?"/.test(SC.b)&&!/Oh, you|walks to the bakery/.test(SC.b), SC.b.slice(-400));
  ok("the narrator reads this scene only too", /Later, at the counter/.test(SC.n)&&!/Old beach line|walks to the bakery/.test(SC.n), SC.n.slice(0,500));

  console.log("\n[4. the prompts are editable]");
  ok("the five mode prompts are registry prompts on the Autopilot card", await pg.evaluate(()=>{
    const ks=["x_reply_suggest_woman","x_reply_suggest_man","x_reply_suggest_group","x_reply_suggest_heat","x_reply_suggest_neutral"];
    const card=X_PROMPT_CARDS.find(g=>g.key==="autopilot");
    const bad=ks.filter(k=>!X_ENGINE_PROMPTS[k]||!K[k]||!PROMPT_BY_KEY[k]||!card||card.keys.indexOf(k)<0);
    return bad.length?bad.join(", "):true; }));
  ok("an edited mode prompt is what is sent", await pg.evaluate(async()=>{
    state.x_reply_suggest_man="MY OWN MAN STYLES for {{focus}}"; __scene(["p_ke"],[{role:"assistant",speaker:"Kerem Kaya",speakerId:"p_ke",content:'"Hey."'}]);
    const r=await __ask(); state.x_reply_suggest_man=X_ENGINE_PROMPTS.x_reply_suggest_man.def;
    return /MY OWN MAN STYLES for Kerem Kaya/.test(r.sys)&&!/3\. SEED:/.test(r.sys) ? true : r.sys.slice(-300); }));

  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close(); process.exit(fail?1:0);
})();
