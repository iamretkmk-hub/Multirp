/* v37.0 — the two menus swapped jobs.
   The sliders button beside the text field is the QUICK sheet: what the story is made of turn to
   turn (map, clip, calendar, calls, texts, story state). The Menu is the rare half, and it is no
   longer one flat scroll — three sections, each opening its own panel with a way back.
   Also covers heat following the clip, and heat length being allowed to be 1. */
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x||c).slice(0,400));} };
  const LAND=process.argv.indexOf("--landscape")>-1;
  const ctx=await b.newContext({viewport:LAND?{width:915,height:412}:{width:412,height:915},hasTouch:true,isMobile:true});
  const pg=await ctx.newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file:///home/user/Multirp/index.html'); await pg.waitForTimeout(2300);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(800);
  await pg.evaluate(()=>{
    const chat=curChat(), u=universeById(chat.universeId);
    if(!(u.locations||[]).length) u.locations=[{id:"loc_t",name:"Kadikoy",desc:"a street"}];
    chat.locationId=u.locations[0].id;
    state.scenes=[{id:"sc_q",name:"Clip",clips:[{id:"c1",url:"https://example.com/a.mp4"}]}];
    show('chat'); renderChat(); });

  /* A row's NAME: for the two-line rows it is the first text node inside .modeTxt/.cmSecTxt (the
     line above the small grey subtitle); for a plain icon+label button it is the button's own
     text, since its first child node is the <svg> and carries none. */
  const rows=sel=>pg.evaluate(s=>[...document.querySelectorAll(s)].map(b=>{
      const t=b.querySelector('.modeTxt,.cmSecTxt');
      if(t){ const n=[...t.childNodes].find(x=>x.nodeType===3&&x.textContent.trim());
             return n?n.textContent.trim():t.textContent.trim(); }
      return b.textContent.replace(/\s+/g," ").trim();
    }).filter(Boolean),sel);

  console.log("\n[the quick sheet holds what you reach for every turn]");
  ok("it is what the sliders button opens", await pg.evaluate(()=>{
      toggleModesMenu();
      return document.getElementById('modesMenu').classList.contains('open'); }));
  ok("and it holds exactly the frequent six", JSON.stringify(await rows('#modesMenu .modeRow'))===
      JSON.stringify(["World map","Scene over the story","Calendar & tasks","Call a character","Messages","Story State"])
      ? true : JSON.stringify(await rows('#modesMenu .modeRow')));
  ok("the playback toggles are NOT in it any more", await pg.evaluate(()=>
      document.querySelectorAll('#modesMenu .modeRow[data-mode]').length===1));
  ok("its badges still exist for the badge writers to find", await pg.evaluate(()=>
      !!document.getElementById('calBadgeMenu') && !!document.getElementById('textInboxBadgeMenu')));
  ok("the button carries plans due plus unread texts", await pg.evaluate(()=>{
      const c=document.getElementById('calBadgeMenu'), t=document.getElementById('textInboxBadgeMenu');
      c.textContent="2"; t.textContent="3"; _syncQuickBadge();
      const q=document.getElementById('quickBadge');
      const v=q.textContent, shown=q.style.display!=="none";
      c.textContent=""; t.textContent=""; _syncQuickBadge();
      return (v==="5"&&shown&&document.getElementById('quickBadge').style.display==="none")
        ? true : "badge read "+v; }));
  await pg.evaluate(()=>closeModesMenu());

  console.log("\n[the Menu is the rare half, in sections]");
  ok("it opens at the top level", await pg.evaluate(()=>{
      toggleChatMenu();
      return !document.getElementById('cmRoot').classList.contains('hide')
          && document.getElementById('chatMenu').dataset.sec===""; }));
  ok("the top level is three sections and nothing else", JSON.stringify(await rows('#cmRoot .cmSecBtn'))===
      JSON.stringify(["Roleplay options","Chat & world","Go to"])
      ? true : JSON.stringify(await rows('#cmRoot .cmSecBtn')));
  ok("opening one hides the others", await pg.evaluate(()=>{
      chatMenuGo('rp');
      const open=[...document.querySelectorAll('#chatMenu .cmView')].filter(v=>!v.classList.contains('hide'));
      return open.length===1 && open[0].id==="cmSec-rp"
        ? true : open.map(v=>v.id).join(","); }));
  ok("Roleplay options carries every playback toggle", JSON.stringify(await rows('#cmSec-rp .modeRow'))===
      JSON.stringify(["Microphone","Speak replies","Pause images","Heat of the moment","Auto-RP","Do Not Disturb","Story language"])
      ? true : JSON.stringify(await rows('#cmSec-rp .modeRow')));
  ok("every section has a way back", await pg.evaluate(()=>{
      const secs=[...document.querySelectorAll('#chatMenu .cmView')].filter(v=>v.id!=="cmRoot");
      return secs.every(v=>!!v.querySelector('.cmBack')) ? true : "a section has no back row"; }));
  ok("back returns to the top level", await pg.evaluate(()=>{
      document.querySelector('#cmSec-rp .cmBack').click();
      return !document.getElementById('cmRoot').classList.contains('hide'); }));
  ok("reopening the Menu never lands mid-section", await pg.evaluate(()=>{
      chatMenuGo('goto'); toggleChatMenu(); toggleChatMenu();
      return document.getElementById('chatMenu').dataset.sec===""; }));
  ok("Chat & world holds the three rare chat actions", JSON.stringify(await rows('#cmSec-chat button:not(.cmBack)'))===
      JSON.stringify(["Clear chat window","Restart scene","Universe guide"])
      ? true : JSON.stringify(await rows('#cmSec-chat button:not(.cmBack)')));
  ok("the six screens are still reachable", JSON.stringify(await rows('#cmSec-goto .chatMenuNav button'))===
      JSON.stringify(["Characters","Gallery","Memory","Diary","Settings","Debug"])
      ? true : JSON.stringify(await rows('#cmSec-goto .chatMenuNav button')));

  console.log("\n[the toggles still work now that they moved]");
  ok("a toggle in the Menu reflects its state", await pg.evaluate(()=>{
      state.autoSpeak=false; reflectModes();
      const off=!document.querySelector('#cmSec-rp .modeRow[data-mode="tts"]').classList.contains('on');
      state.autoSpeak=true; reflectModes();
      const on=document.querySelector('#cmSec-rp .modeRow[data-mode="tts"]').classList.contains('on');
      state.autoSpeak=false; reflectModes();
      return off&&on ? true : "off="+off+" on="+on; }));
  ok("the quick sheet's one toggle still reflects too", await pg.evaluate(()=>{
      const r=document.querySelector('#modesMenu .modeRow[data-mode="scene"]');
      curChat().sceneDockId=null; reflectModes();
      const a=r.classList.contains('on');
      curChat().sceneDockId="sc_q"; reflectModes();
      const c=r.classList.contains('on');
      curChat().sceneDockId=null; reflectModes();
      return (!a&&c) ? true : "before="+a+" during="+c; }));
  ok("rows without a mode never blink on repeated reflects", await pg.evaluate(()=>{
      const plain=[...document.querySelectorAll('#modesMenu .modeRow:not([data-mode]),#chatMenu .modeRow:not([data-mode])')];
      for(let i=0;i<4;i++){ reflectModes();
        const lit=plain.find(r=>r.classList.contains('on'));
        if(lit) return "a plain row lit on pass "+i; }
      return true; }));
  ok("the active-modes dot marks the section that holds them", await pg.evaluate(()=>{
      state.heatOn=false; reflectModes();
      const off=document.getElementById('modesDot').style.display==="none";
      state.heatOn=true; reflectModes();
      const on=document.getElementById('modesDot').style.display!=="none";
      state.heatOn=false; reflectModes();
      return off&&on ? true : "off="+off+" on="+on; }));
  await pg.evaluate(()=>closeChatMenu());

  console.log("\n[a clip over the story carries the scene by itself]");
  ok("starting one turns heat on", await pg.evaluate(()=>{
      state.heatOn=false; state._heatWasOn=undefined;
      playSceneInChat("sc_q");
      return state.heatOn===true; }));
  ok("closing it puts heat back where it was", await pg.evaluate(()=>{
      closeSceneDock();
      return state.heatOn===false && state._heatWasOn===undefined
        ? true : "heat="+state.heatOn+" remembered="+state._heatWasOn; }));
  ok("a player who already had heat on keeps it after the clip", await pg.evaluate(()=>{
      state.heatOn=true; state._heatWasOn=undefined;
      playSceneInChat("sc_q"); closeSceneDock();
      const v=state.heatOn; state.heatOn=false;
      return v===true ? true : "heat came back "+v; }));
  ok("swapping clips mid-run does not re-arm the restore", await pg.evaluate(()=>{
      state.heatOn=false; state._heatWasOn=undefined;
      playSceneInChat("sc_q");
      const first=state._heatWasOn;
      state.heatOn=true;                 // pretend the player raised it during the clip
      playSceneInChat("sc_q");           // switching clips
      const same=state._heatWasOn===first;
      closeSceneDock(); state.heatOn=false;
      return same ? true : "remembered value changed"; }));

  console.log("\n[heat length can be a single reply]");
  ok("Settings accepts 1", await pg.evaluate(()=>{
      const e=document.getElementById('setHeatN');
      return +e.min===1 ? true : "min is "+e.min; }));
  ok("and saving keeps it", await pg.evaluate(()=>{
      document.getElementById('setHeatN').value="1"; saveSettings();
      return state.heatN===1 ? true : "heatN is "+state.heatN; }));
  ok("a lone beat is told it is the last one", await pg.evaluate(()=>{
      const chat=curChat(); chat._heatBeat={total:"1",n:"1"};
      const p=(state.personas||[])[0]||{id:"x",name:"Nil",look:{}};
      const B=buildCharPromptBlocks(chat,p,{},state.user);
      delete chat._heatBeat;
      return /LAST beat/.test(B.format||"") && !/still going/.test(B.format||"")
        ? true : String(B.format||"").slice(0,300); }));
  ok("a middle beat is still told more is coming", await pg.evaluate(()=>{
      const chat=curChat(); chat._heatBeat={total:"5",n:"2"};
      const p=(state.personas||[])[0]||{id:"x",name:"Nil",look:{}};
      const B=buildCharPromptBlocks(chat,p,{},state.user);
      delete chat._heatBeat;
      return /still going/.test(B.format||"") && !/LAST beat/.test(B.format||"")
        ? true : String(B.format||"").slice(0,300); }));
  ok("both wordings are editable fragments", await pg.evaluate(()=>
      typeof BLOCK_TPL_DEFAULTS.heat_more_yes==="string" && typeof BLOCK_TPL_DEFAULTS.heat_more_no==="string"));

  ok("no page errors", errs.length===0?true:errs.join(" | "));
  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close(); process.exit(fail?1:0);
})();
