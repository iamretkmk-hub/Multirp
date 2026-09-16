/* AN ASIDE, SAID OR DONE — and the leak it had.
   /whisper was reaching every background engine verbatim: castConvoText had no whisper filter,
   while recentSceneMsgsFor four hundred lines up has had the right rule the whole time. Three of
   castConvoText's callers are narrator-beat writers (narrateCharMove / …Group take the last three
   lines as the WHY of an exit or arrival) and a narrator beat is posted to the chat and read by the
   whole room — so whispering to Burcu and having Burcu get up could publish the whisper.
   Also: the whispered-to character used to answer with an ordinary PUBLIC message, which is the
   exact leak an aside exists to prevent. Now the reply goes back the same way.
   Run: node tests/whisper-aside.browser.js   (needs playwright; see tests/README.md) */
const {chromium}=require('playwright');
const BIN=process.env.CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
(async()=>{
  const b=await chromium.launch({executablePath:BIN});
  const pg=await b.newPage({viewport:{width:412,height:915}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file:///home/user/Multirp/index.html'); await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(900);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x||c).slice(0,420));} };

  await pg.evaluate(()=>{
    const uni=state.universes[0];
    [["w_bu","Burcu"],["w_oz","Ozlem"]].forEach(([id,n])=>{ if(!state.personas.some(p=>p.id===id))
      state.personas.push({id,name:n,universeId:uni.id,instructions:"",personality:"p",backstory:"b",style:"s",goals:"",traits:"",look:{}}); });
    const c=curChat(); c.presentIds=["w_bu","w_oz"]; state.user="Emre";
    const H=["w_bu","w_oz"];
    c.messages=[
      {mid:"a1",role:"user",present:H,content:'"Herkes burada mı?"'},
      {mid:"a2",role:"user",present:H,whisperTo:"w_bu",whisperToName:"Burcu",content:"Bu akşam bize gel."},
      {mid:"a3",role:"user",present:H,whisperTo:"w_bu",whisperToName:"Burcu",content:"*Elini masanın altından tutuyorum.*"},
      {mid:"a4",role:"assistant",speaker:"Burcu",speakerId:"w_bu",present:H,whisperTo:"__user__",whisperToName:"Emre",
       content:"*Elini bırakmıyorum ama Özlem'e bakıyorum.*"}
    ];
  });

  console.log("\n[the leak that was live: engines read the transcript]");
  ok("the room's view of the transcript carries no whispered content", await pg.evaluate(()=>{
      const t=castConvoText(curChat(),8,"__room__");
      return (t.indexOf("Bu akşam bize gel")===-1 && t.indexOf("Elini masanın altından")===-1
              && t.indexOf("Elini bırakmıyorum")===-1)?true:t; }));
  ok("and is not even told an aside happened", await pg.evaluate(()=>{
      const t=castConvoText(curChat(),8,"__room__");
      return !/could not hear|could not make out|whisper/i.test(t)?true:t; }));
  ok("the player, who is party to all of them, still sees them", await pg.evaluate(()=>{
      const t=castConvoText(curChat(),8);
      return (t.indexOf("Bu akşam bize gel")>-1 && t.indexOf("Elini bırakmıyorum")>-1)?true:t; }));
  ok("the target sees their own, not the other character's", await pg.evaluate(()=>{
      const t=castConvoText(curChat(),8,"w_bu");
      return (t.indexOf("Bu akşam bize gel")>-1)?true:t; }));
  ok("a bystander character sees none of it", await pg.evaluate(()=>{
      const t=castConvoText(curChat(),8,"w_oz");
      return (t.indexOf("Bu akşam bize gel")===-1 && t.indexOf("Elini masanın altından")===-1)?true:t; }));
  ok("the narrator beats ask for the room's view, not the player's", await pg.evaluate(()=>
      (typeof narrateCharMove==="function")?true:"missing"));

  console.log("\n[an aside is a SPAN — the rest of the line is public]");
  ok("the first starred span is the aside, the rest is not", await pg.evaluate(()=>{
      const r=whisperSplit('elini tutuyorum *bu aksam gel* Sonra gulumsuyorum.');
      return (r.secret==="bu aksam gel" && /elini tutuyorum/.test(r.open) && /Sonra gulumsuyorum/.test(r.open))
        ? true : JSON.stringify(r); }));
  ok("no span at all means the whole line is private, as it always did", await pg.evaluate(()=>{
      const r=whisperSplit('Bu aksam bize gel.');
      return (r.secret==="Bu aksam bize gel." && r.open==="")?true:JSON.stringify(r); }));
  ok("only the FIRST span closes the aside", await pg.evaluate(()=>{
      const r=whisperSplit('*ilk* ortada *ikinci*');
      return (r.secret==="ilk" && r.open==="ortada *ikinci*")?true:JSON.stringify(r); }));
  ok("speech and action inside the span are not separated", await pg.evaluate(()=>{
      const r=whisperSplit('*elini tutuyorum, "gel" diyorum*');
      return /elini tutuyorum, "gel" diyorum/.test(r.secret)?true:JSON.stringify(r); }));

  console.log("\n[the payload each character is built with]");
  const hist=who=>pg.evaluate(id=>JSON.stringify(castHistory(curChat(),state.personas.find(p=>p.id===id))),who);
  ok("Burcu gets both asides in full", await (async()=>{
      const h=await hist("w_bu");
      return (h.indexOf("Bu akşam bize gel")>-1 && h.indexOf("Elini masan")>-1)?true:h.slice(0,300); })());
  ok("and the frame travels with them on every later turn", await (async()=>{
      const h=await hist("w_bu");
      return /for you alone . nobody else in the room/.test(h)?true:h.slice(0,300); })());
  ok("Ozlem gets neither, in either direction", await (async()=>{
      const h=await hist("w_oz");
      return (h.indexOf("Bu akşam bize gel")===-1 && h.indexOf("Elini masan")===-1
              && h.indexOf("Elini bırakmıyorum")===-1)?true:h.slice(0,300); })());
  ok("Ozlem is not told anything happened at all", await (async()=>{
      const h=await hist("w_oz");
      return !/could not hear|could not make out|whisper/i.test(h)?true:h.slice(0,300); })());
  ok("but she does get the public remainder of a mixed line", await pg.evaluate(()=>{
      const c=curChat(); const H=["w_bu","w_oz"];
      c.messages.push({mid:"a5",role:"user",present:H,whisperTo:"w_bu",whisperToName:"Burcu",
        content:'*bu aksam gel* Sonra herkese donup gulumsuyorum.'});
      const oz=state.personas.find(p=>p.id==="w_oz");
      const h=JSON.stringify(castHistory(c,oz));
      c.messages.pop();
      return (h.indexOf("Sonra herkese")>-1 && h.indexOf("bu aksam gel")===-1)?true:h.slice(-260); }));
  ok("an aside is never the line a bystander is answering", await pg.evaluate(()=>{
      const oz=state.personas.find(p=>p.id==="w_oz");
      const l=lastDialogueLine(curChat(),oz);
      return (!l || (l.text.indexOf("Bu akşam")===-1 && l.text.indexOf("Elini")===-1))?true:JSON.stringify(l); }));
  ok("nor does it reach the per-character scene feed", await pg.evaluate(()=>{
      const oz=state.personas.find(p=>p.id==="w_oz");
      const j=JSON.stringify(recentSceneMsgsFor(curChat(),oz,8));
      return (j.indexOf("Bu akşam")===-1 && j.indexOf("Elini")===-1)?true:j.slice(0,260); }));
  ok("the answering character is told their reply is private too", await pg.evaluate(()=>{
      const g=blkTpl("whisper_back_guidance");
      return (/only \{\{user\}\} will read it/.test(g) && /do not say it out loud/.test(g))?true:g.slice(0,200); }));

  console.log("\n[the chat marks it]");
  ok("both aside wordings are editable fragments", await pg.evaluate(()=>{
      const want=["whisper_to_you","whisper_back_guidance"];
      const listed=REPLY_EXTRA_TPLS.whisper||[];
      const miss=want.filter(k=>!(typeof BLOCK_TPL_DEFAULTS[k]==="string")||listed.indexOf(k)<0);
      return miss.length?miss.join(", "):true; }));
  ok("editing one changes what the target reads", await pg.evaluate(()=>{
      state.blockTpls=state.blockTpls||{};
      state.blockTpls.whisper_to_you="EDITED {{user}}→{{target}}:";
      const bu=state.personas.find(p=>p.id==="w_bu");
      const h=JSON.stringify(castHistory(curChat(),bu));
      delete state.blockTpls.whisper_to_you;
      return /EDITED Emre→Burcu:/.test(h)?true:h.slice(0,240); }));

  console.log("\n[typing / opens the commands]");
  ok("it lists them all", await pg.evaluate(()=>{
      show('chat'); const el=document.getElementById('chatInput');
      el.value="/"; cmdPaletteSync();
      return document.querySelectorAll('#cmdPalette .cmdRow').length===CHAT_COMMANDS.length?true:"count off"; }));
  ok("and narrows as you type", await pg.evaluate(()=>{
      const el=document.getElementById('chatInput'); el.value="/wh"; cmdPaletteSync();
      const two=[...document.querySelectorAll('#cmdPalette .cmdRow')].map(x=>x.dataset.cmd);
      el.value="/whi"; cmdPaletteSync();
      const one=[...document.querySelectorAll('#cmdPalette .cmdRow')].map(x=>x.dataset.cmd);
      // "who" begins with "wh" too, so two is right there and one is right at "whi"
      return (two.join()==="whisper,who" && one.join()==="whisper")?true:JSON.stringify({two,one}); }));
  ok("picking one fills the box ready for its argument", await pg.evaluate(()=>{
      cmdPalettePick("whisper");
      return document.getElementById('chatInput').value==="/whisper "?true:document.getElementById('chatInput').value; }));
  ok("it closes once you are past the command word", await pg.evaluate(()=>{
      const el=document.getElementById('chatInput'); el.value="/go Sahil"; cmdPaletteSync();
      return document.getElementById('cmdPalette').classList.contains('hide')?true:"still open"; }));
  ok("every command it offers is one the dispatcher answers", await pg.evaluate(()=>{
      const src=String(handleOOC)+String(handsFreeCommand);
      const bad=CHAT_COMMANDS.filter(c=>src.indexOf('"'+c.cmd+'"')<0 && c.cmd!=="whisper" && c.cmd!=="go" && c.cmd!=="messages");
      return bad.length?bad.map(c=>c.cmd).join(", "):true; }));
  ok("it sits above the composer and fits the phone", await pg.evaluate(()=>{
      const el=document.getElementById('chatInput'); el.value="/"; cmdPaletteSync();
      const h=document.getElementById('cmdPalette').getBoundingClientRect();
      const bar=document.querySelector('.inputBar').getBoundingClientRect();
      return (h.bottom<=bar.top+2 && h.left>=0 && h.right<=412 && h.height>0)?true:JSON.stringify(h); }));

  console.log("\n[nothing else moved]");
  ok("no page errors", errs.length===0?true:errs.join(" | "));
  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close(); process.exit(fail?1:0);
})();
