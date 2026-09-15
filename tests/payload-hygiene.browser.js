/* v43.7 — four things the payload was carrying that are not content.
   1. A narrator beat written for one room arriving in another character's turn (the last channel
      in castHistory that read POSITION and never the witness tag).
   2. The same beat, or a regenerated reply, read back two and three times in one built history.
   3. The memory-retrieval embedding taking the keyword line glued to the whole last two beats.
   4. A relationship sheet that came back in a shape the reader didn't know, so the character kept
      no structured ties at all. */
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file:///home/user/Multirp/index.html'); await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(900);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x||c).slice(0,400));} };

  const setup=()=>pg.evaluate(()=>{
    const uni=state.universes[0];
    const mk=(id,name)=>{ let p=state.personas.find(x=>x&&x.id===id);
      if(!p){ p={id,name,universeId:uni.id,instructions:"x",personality:"x",backstory:"x",style:"x",goals:"x",look:{}}; state.personas.push(p); }
      p.name=name; return p; };
    const oz=mk("p_oz","Ozlem"), du=mk("p_du","Duygu");
    const chat=curChat();
    chat.presentIds=[oz.id,du.id];
    state.stripNarr=false; state.histTurns=60;
    return {oz:oz.id,du:du.id};
  });
  const ids=await setup();

  console.log("\n[a narrator beat belongs to the room it happened in]");
  const A=await pg.evaluate((ids)=>{
    const chat=curChat();
    chat.messages=[
      {mid:"h1",role:"user",name:"You",present:[ids.oz,ids.du],content:"Ikiniz de buradasiniz."},
      // written while only Ozlem was in the room
      {mid:"h2",role:"assistant",speaker:"Narrator",narratorEvent:true,sceneBeat:true,present:[ids.oz],
       content:"Ozlem yatagin kenarina oturdu ve yavasca uzandi, nefesi kesilmisti."},
      {mid:"h3",role:"assistant",speaker:"Duygu",speakerId:ids.du,present:[ids.oz,ids.du],content:"Ne oluyor?"}
    ];
    const txt=p=>castHistory(chat,p).map(m=>m.content).join("\n");
    return {
      forDuygu: txt(state.personas.find(x=>x.id===ids.du)),
      forOzlem: txt(state.personas.find(x=>x.id===ids.oz)),
      forPlayer: txt(null)
    };
  },ids);
  ok("a character who was not in the room never sees it", A.forDuygu.indexOf("yatagin kenarina")===-1,
     A.forDuygu.slice(0,300));
  ok("the character who WAS in the room still does", A.forOzlem.indexOf("yatagin kenarina")>-1, A.forOzlem.slice(0,300));
  ok("and the player, who reads everything posted, still does", A.forPlayer.indexOf("yatagin kenarina")>-1);
  ok("a beat with no present tag at all is untouched (old chats)", await pg.evaluate((ids)=>{
      const chat=curChat();
      chat.messages=[{mid:"g1",role:"assistant",speaker:"Narrator",narratorEvent:true,
                      content:"Kapi acildi ve iceri soguk girdi."}];
      return castHistory(chat,state.personas.find(x=>x.id===ids.du))
             .map(m=>m.content).join("\n").indexOf("Kapi acildi")>-1; },ids));

  console.log("\n[an echo is not content]");
  const B=await pg.evaluate((ids)=>{
    const chat=curChat();
    const beat="— Emre, Nil'in gelecegini umarak saatlerce kapiya bakti —";
    const longLine="Sen... hep sen. Her seferinde ayni seyi soyluyorsun ve ben her seferinde inaniyorum, "
                  +"cunku baska ne yapabilirim ki bilmiyorum.";
    chat.messages=[
      {mid:"e1",role:"assistant",speaker:"Narrator",narratorEvent:true,present:[ids.oz,ids.du],content:beat},
      {mid:"e2",role:"user",name:"You",present:[ids.oz,ids.du],content:"Anlat bana."},
      {mid:"e3",role:"assistant",speaker:"Narrator",narratorEvent:true,present:[ids.oz,ids.du],content:beat},
      {mid:"e4",role:"assistant",speaker:"Duygu",speakerId:ids.du,present:[ids.oz,ids.du],content:longLine},
      {mid:"e5",role:"assistant",speaker:"Duygu",speakerId:ids.du,present:[ids.oz,ids.du],content:longLine+" Gercekten."},
      {mid:"e6",role:"assistant",speaker:"Narrator",narratorEvent:true,present:[ids.oz,ids.du],content:beat}
    ];
    const h=castHistory(chat,null);
    const all=h.map(m=>m.content);
    return {beats:all.filter(t=>t.indexOf("saatlerce kapiya")>-1).length,
            duygu:all.filter(t=>t.indexOf("hep sen")>-1),
            joined:all.join(" | ")};
  },ids);
  ok("a narrator beat posted three times is read once", B.beats===1, "appeared "+B.beats+" times");
  ok("three near-copies of one reply collapse to one", B.duygu.length===1, JSON.stringify(B.duygu).slice(0,300));
  ok("and the version kept is the LAST one", (B.duygu[0]||"").indexOf("Gercekten")>-1, B.duygu[0]);
  ok("two different lines from one speaker both survive", await pg.evaluate((ids)=>{
      const chat=curChat();
      chat.messages=[
        {mid:"d1",role:"assistant",speaker:"Duygu",speakerId:ids.du,present:[ids.du],
         content:"Bu aksam ablamlara gidecegim, sabaha kadar donmem, anahtari sana birakiyorum."},
        {mid:"d2",role:"assistant",speaker:"Duygu",speakerId:ids.du,present:[ids.du],
         content:"Yarin isten cikinca pazara ugrayip biraz meyve alayim diyorum, sen de gelir misin?"}
      ];
      return castHistory(chat,null).length===2; },ids));
  ok("the player typing the same thing twice is still twice", await pg.evaluate((ids)=>{
      const chat=curChat();
      const line="Beni duyuyor musun, sana bir sey soruyorum ve cevap vermeni bekliyorum simdi.";
      chat.messages=[{mid:"u1",role:"user",name:"You",present:[ids.du],content:line},
                     {mid:"u2",role:"user",name:"You",present:[ids.du],content:line}];
      return castHistory(chat,null).length===2; },ids));
  ok("a presence note is allowed to happen twice", await pg.evaluate((ids)=>{
      const chat=curChat();
      chat.messages=[
        {mid:"p1",role:"assistant",speaker:"Narrator",narratorEvent:true,presenceNote:true,present:[ids.du],content:"— Ozlem has arrived —"},
        {mid:"p2",role:"user",name:"You",present:[ids.du],content:"Merhaba."},
        {mid:"p3",role:"assistant",speaker:"Narrator",narratorEvent:true,presenceNote:true,present:[ids.du],content:"— Ozlem has arrived —"}];
      return castHistory(chat,null).filter(m=>m.content.indexOf("has arrived")>-1).length===2; },ids));

  console.log("\n[what gets embedded is the keywords, not the scene]");
  ok("the retrieval query embeds a clean line, not the query glued to the transcript",
     await pg.evaluate(()=>{
       const src=String(retrieveMemories);
       return /const embedQuery\s*=\s*cleanQuery\s*\|\|/.test(src)
           && /embedText\(embedQuery/.test(src)
           && !/embedText\(query/.test(src)
         ? true : "retrieveMemories still embeds the combined string"; }));
  ok("the lexical facet still sees the combined text", await pg.evaluate(()=>
      /const qTok\s*=\s*new Set\(memTokens\(query\)\)/.test(String(retrieveMemories))));
  ok("the fallback embed is capped, so a scene can never become the vector", await pg.evaluate(()=>
      /inlineQuery\.slice\(0,\s*\d+\)/.test(String(retrieveMemories))));

  console.log("\n[a relationship sheet is read whatever shape it arrives in]");
  const C=await pg.evaluate(()=>({
    plain: relSheetShape({"Nil":{tie:"sister",relationship:"you trust her"}}),
    wrapped: relSheetShape({relationships:{"Nil":{tie:"sister",relationship:"you trust her"}}}),
    list: relSheetShape([{name:"Nil",tie:"sister",relationship:"you trust her"}]),
    mixedList: relSheetShape([{"Nil":{tie:"sister",relationship:"you trust her"}}]),
    junk: relSheetShape("not json"),
    stutter: deStutter("I am I am not close to him"),
    stutter2: deStutter("I am I am proud of him"),
    intact: deStutter("Cok cok iyi anlasiyorsunuz"),
    empty: deStutter(null)
  }));
  ok("the documented shape is unchanged", C.plain && C.plain.Nil && C.plain.Nil.tie==="sister");
  ok("a {relationships:…} wrapper is unwrapped", C.wrapped && C.wrapped.Nil && C.wrapped.Nil.tie==="sister",
     JSON.stringify(C.wrapped));
  ok("a [{name,tie,relationship}] list folds in", C.list && C.list.Nil && C.list.Nil.tie==="sister",
     JSON.stringify(C.list));
  ok("a list of bare {Name:{…}} objects folds in too", C.mixedList && C.mixedList.Nil && C.mixedList.Nil.tie==="sister",
     JSON.stringify(C.mixedList));
  ok("junk is still refused", C.junk===null, JSON.stringify(C.junk));
  ok("a restarted sentence is collapsed", C.stutter==="I am not close to him", C.stutter);
  ok("...both of them", C.stutter2==="I am proud of him", C.stutter2);
  ok("a real repeated word is left alone", C.intact==="Cok cok iyi anlasiyorsunuz", C.intact);
  ok("and nothing at all stays nothing", C.empty==="", JSON.stringify(C.empty));
  ok("the generator runs its result through the normaliser", await pg.evaluate(()=>
      /relSheetShape\(parseJSON\(text\)\)/.test(String(generateRelationshipsFor))
        ? true : "generateRelationshipsFor still parses raw"));

  ok("no page errors", errs.length===0?true:errs.join(" | "));
  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close(); process.exit(fail?1:0);
})();
