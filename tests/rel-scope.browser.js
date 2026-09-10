/* v37.4 — the relationship block was sending a full paragraph about every tie on every reply:
   in a live payload, five paragraphs about people who were not in the room and could not be
   spoken to, under a summary line that had already said who each of them was. */
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x||c).slice(0,400));} };
  const ctx=await b.newContext({viewport:{width:412,height:915},hasTouch:true,isMobile:true});
  const pg=await ctx.newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file:///home/user/Multirp/index.html'); await pg.waitForTimeout(2300);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(800);

  // Hakan's sheet, the shape from the report: a summary paragraph plus five full ties, only one
  // of those people in the room.
  await pg.evaluate(()=>{
    const uni=state.universes[0];
    const mk=(id,name)=>{ let p=state.personas.find(x=>x.id===id);
      if(!p){ p={id,name,universeId:uni.id,instructions:"x",personality:"x",backstory:"x",style:"x",goals:"x",look:{}}; state.personas.push(p); }
      return p; };
    const hakan=mk("p_h","Hakan");
    mk("p_e","Emre2"); mk("p_d","Duygu"); mk("p_n","Nil"); mk("p_b","Berker");
    state.user="Emre";
    hakan.socialGraph="Duygu is my wife. Nil is my daughter. Emre is my oldest friend. Berker is my brother in exhaustion.";
    hakan.relationships={
      "__user__":{tie:"oldest friend",relationship:"Emre is my oldest friend and his couch is the one place I can breathe."},
      "p_e":{tie:"neighbour",relationship:"We nod in the stairwell and nothing more."},
      "p_d":{tie:"wife",relationship:"Duygu is my wife. I cannot bear the disappointment in her eyes, so I avoid her."},
      "p_n":{tie:"daughter",relationship:"Nil is my daughter. I do not know how to talk to a teenage girl."},
      "p_b":{tie:"childhood friend",relationship:"Berker balanced the ledgers. We sit and say nothing important."}
    };
    const chat=curChat(); chat.presentIds=["p_e"]; chat.messages=[]; markChatDirty(chat);
  });
  const sheet=scope=>pg.evaluate(sc=>relSheetBlockFull(
      (state.personas||[]).find(p=>p.id==="p_h"),{scope:sc}),scope);

  console.log("\n[present: the summary, then only the people who are here]");
  const pres=await sheet("present");
  ok("the summary line always goes", /Duygu is my wife\. Nil is my daughter/.test(pres) ? true : pres.slice(0,160));
  ok("the player gets their full paragraph", /couch is the one place I can breathe/.test(pres) ? true : "player paragraph missing");
  ok("someone in the room gets theirs", /nod in the stairwell/.test(pres) ? true : "present character missing");
  ok("an absent wife gets no paragraph", !/cannot bear the disappointment/.test(pres) ? true : "absent paragraph still sent");
  ok("nor an absent daughter", !/how to talk to a teenage girl/.test(pres) ? true : "absent paragraph still sent");
  ok("and there is no leftover list of the absent", !/\[not here right now\]/.test(pres) ? true : "absent people still listed");
  ok("but the summary still names them, so nobody is a stranger", await pg.evaluate(()=>{
      const v=relSheetBlockFull((state.personas||[]).find(p=>p.id==="p_h"),{scope:"present"});
      return /Nil is my daughter/.test(v) && /Berker/.test(v); }));
  ok("it is markedly shorter than sending everyone", await pg.evaluate(()=>{
      const p=(state.personas||[]).find(x=>x.id==="p_h");
      const a=relSheetBlockFull(p,{scope:"present"}).length;
      const c=relSheetBlockFull(p,{scope:"everyone"}).length;
      return c>a*1.8 ? true : "present "+a+" vs everyone "+c; }));

  console.log("\n[the other two scopes still do what they say]");
  ok("brief adds a one-line tie for the absent", await pg.evaluate(()=>{
      const v=relSheetBlockFull((state.personas||[]).find(p=>p.id==="p_h"),{scope:"brief"});
      return /Duygu — wife/.test(v) && !/cannot bear the disappointment/.test(v)
        ? true : v.slice(-200); }));
  ok("everyone still sends every paragraph", await pg.evaluate(()=>{
      const v=relSheetBlockFull((state.personas||[]).find(p=>p.id==="p_h"),{scope:"everyone"});
      return /cannot bear the disappointment/.test(v) && /teenage girl/.test(v); }));
  ok("the conscience keeps everyone — a brake needs the absent by name", await pg.evaluate(()=>
      /everyone:true/.test(String(_writePsyche))));

  console.log("\n[the reply payload uses the setting]");
  ok("it defaults to present", await pg.evaluate(()=>state.relScope==="present"));
  ok("and the payload block follows it", await pg.evaluate(()=>{
      state.relScope="present";
      const p=(state.personas||[]).find(x=>x.id==="p_h");
      const B=buildCharPromptBlocks(p,[],{},state.user,{chat:curChat(),targetName:state.user,targetId:"__user__"});
      return !/cannot bear the disappointment/.test(B.relationships||"") ? true : "absent paragraph in the payload"; }));
  ok("switching to everyone brings them back", await pg.evaluate(()=>{
      state.relScope="everyone";
      const p=(state.personas||[]).find(x=>x.id==="p_h");
      const B=buildCharPromptBlocks(p,[],{},state.user,{chat:curChat(),targetName:state.user,targetId:"__user__"});
      state.relScope="present";
      return /cannot bear the disappointment/.test(B.relationships||""); }));
  ok("a character with NO summary falls back to the tie lines", await pg.evaluate(()=>{
      const p=(state.personas||[]).find(x=>x.id==="p_h");
      const keep=p.socialGraph; p.socialGraph="";
      const B=buildCharPromptBlocks(p,[],{},state.user,{chat:curChat(),targetName:state.user,targetId:"__user__"});
      p.socialGraph=keep;
      return /Duygu — wife/.test(B.relationships||"")
        ? true : "an absent bond was dropped with nothing to carry it"; }));

  console.log("\n[and it is a setting you can see]");
  ok("the selector is in Settings", await pg.evaluate(()=>!!document.getElementById('setRelScope')));
  ok("Settings shows what is in state", await pg.evaluate(()=>{
      state.relScope="brief"; syncSettingsUI();
      return document.getElementById('setRelScope').value==="brief"; }));
  ok("and saving reads it back", await pg.evaluate(()=>{
      document.getElementById('setRelScope').value="everyone"; saveSettings();
      const a=state.relScope==="everyone" && store.raw(K.relScope,"")==="everyone";
      document.getElementById('setRelScope').value="present"; saveSettings();
      return a && state.relScope==="present"; }));
  ok("a junk value falls back to present", await pg.evaluate(()=>{
      const el=document.getElementById('setRelScope');
      el.innerHTML+='<option value="nonsense">x</option>'; el.value="nonsense"; saveSettings();
      return state.relScope==="present"; }));

  ok("no page errors", errs.length===0?true:errs.join(" | "));
  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close(); process.exit(fail?1:0);
})();
