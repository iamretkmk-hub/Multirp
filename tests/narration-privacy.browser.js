const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage({viewport:{width:412,height:915}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file:///home/user/Multirp/index.html'); await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(900);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x||c).slice(0,400));} };

  await pg.evaluate(()=>{
    const uni=state.universes[0];
    const mk=(id,name)=>({id,name,universeId:uni.id,instructions:"x",personality:"x",
      backstory:"x",style:"x",goals:"x",look:{}});
    ["p_a","p_b"].forEach((id,i)=>{ if(!state.personas.some(p=>p.id===id))state.personas.push(mk(id,["Ayla","Bora"][i])); });
    const chat=curChat(); chat.presentIds=["p_a","p_b"]; state.user="Kemal";
    chat.gameDay=1;
    const HERE=["p_a","p_b"];   // castHistory drops a message nobody is recorded as witnessing
    chat.messages=[
      {mid:"m1",role:"user",present:HERE,content:'*Kemal masaya oturuyor.* "Merhaba."'},
      {mid:"m2",role:"assistant",speaker:"Ayla",speakerId:"p_a",present:HERE,
       content:'*Bardağı bırakıyor.* "Hoş geldin." _Bunu ona söylememeliyim._'},
      {mid:"m3",role:"assistant",speaker:"Bora",speakerId:"p_b",present:HERE,
       content:'*Pencereye bakıyor.* "Geç kaldın."'}
    ];
  });
  const histFor = (who,mode)=>pg.evaluate(o=>{
    state.narrPrivacy=o.mode;
    const p=state.personas.find(x=>x.id===o.who);
    const chat=curChat();
    return JSON.stringify(castHistory(chat,p));
  },{who,mode});

  console.log("\n[default: only what they said out loud]");
  const spokenB = await histFor("p_b","spoken");
  ok("Ayla's thought never crosses", spokenB.indexOf("söylememeliyim")===-1);
  ok("Ayla's narration does not cross either", spokenB.indexOf("Bardağı")===-1);
  ok("but her words do", spokenB.indexOf("Hoş geldin")>-1);
  ok("the player's action is kept whole", spokenB.indexOf("masaya oturuyor")>-1,spokenB.slice(0,300));
  ok("Bora's own line is kept whole, narration and all", spokenB.indexOf("Pencereye")>-1);

  console.log("\n[the default is what a fresh install gets]");
  ok("no stored value reads as 'spoken'", await pg.evaluate(()=>{
      const was=state.narrPrivacy; delete state.narrPrivacy;
      const m=narrPrivacyMode(); state.narrPrivacy=was; return m==="spoken"; }));
  ok("an old stored true also reads as 'spoken'", await pg.evaluate(()=>{
      const was=state.narrPrivacy; state.narrPrivacy=true;
      const m=narrPrivacyMode(); state.narrPrivacy=was; return m==="spoken"; }));
  ok("an old stored false still reads as 'off'", await pg.evaluate(()=>{
      const was=state.narrPrivacy; state.narrPrivacy=false;
      const m=narrPrivacyMode(); state.narrPrivacy=was; return m==="off"; }));

  console.log("\n[the other two modes still work]");
  const seenB = await histFor("p_b","seen");
  ok("'seen' lets her visible action cross", seenB.indexOf("Bardağı")>-1);
  ok("'seen' still hides her thought", seenB.indexOf("söylememeliyim")===-1);
  const offB = await histFor("p_b","off");
  ok("'off' passes everything, thought included", offB.indexOf("söylememeliyim")>-1);

  console.log("\n[the line you are answering agrees with the transcript]");
  ok("a wordless turn is not offered as the line to answer", await pg.evaluate(()=>{
      state.narrPrivacy="spoken";
      const chat=curChat();
      chat.messages.push({mid:"m4",role:"assistant",speaker:"Ayla",speakerId:"p_a",
        present:["p_a","p_b"],content:'*Sessizce ayağa kalkıyor.*'});
      const p=state.personas.find(x=>x.id==="p_b");
      const line=lastDialogueLine(chat,p);
      chat.messages.pop();
      // it must reach past the wordless turn to something actually said
      return line && line.text.indexOf("Sessizce")===-1 ? true : JSON.stringify(line); }));
  ok("and in 'seen' that same turn IS offered", await pg.evaluate(()=>{
      state.narrPrivacy="seen";
      const chat=curChat();
      chat.messages.push({mid:"m4",role:"assistant",speaker:"Ayla",speakerId:"p_a",
        present:["p_a","p_b"],content:'*Sessizce ayağa kalkıyor.*'});
      const p=state.personas.find(x=>x.id==="p_b");
      const line=lastDialogueLine(chat,p);
      chat.messages.pop(); state.narrPrivacy="spoken";
      return !!(line && line.text.indexOf("Sessizce")>-1); }));

  console.log("\n[the setting saves and reloads]");
  ok("the selector offers the three modes", await pg.evaluate(()=>{
      show('settings');
      const e=document.getElementById('setNarrPrivacy');
      if(!e||e.tagName!=="SELECT") return "not a select";
      return [...e.options].map(o=>o.value).join(",")==="spoken,seen,off"; }));
  ok("saving it round-trips", await pg.evaluate(()=>{
      show('settings');
      const e=document.getElementById('setNarrPrivacy');
      e.value="seen"; saveSettings(false);
      const a=state.narrPrivacy;
      e.value="spoken"; saveSettings(false);
      return a==="seen" && state.narrPrivacy==="spoken"; }));
  ok("and the UI reflects what is stored", await pg.evaluate(()=>{
      state.narrPrivacy="off"; syncSettingsUI();
      const e=document.getElementById('setNarrPrivacy');
      const v=e?e.value:"";
      state.narrPrivacy="spoken";
      return v==="off" ? true : "showed "+v; }));

  console.log("\n[nothing else moved]");
  ok("saveSettings does not throw", await pg.evaluate(()=>{
      show('settings'); try{ saveSettings(false); return true; }catch(e){ return "threw: "+e.message; } }));
  ok("no page errors", errs.length===0?true:errs.join(" | "));
  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close(); process.exit(fail?1:0);
})();
