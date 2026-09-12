const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage({viewport:{width:412,height:915}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file:///home/user/Multirp/index.html'); await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(900);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+(x||c!==false?"\n        "+String(x||c).slice(0,300):""));} };

  console.log("\n[the picker is gone]");
  ok("no picker container in the DOM", await pg.evaluate(()=>!document.getElementById('imgCharPicker')));
  ok("no checkboxes left behind", await pg.evaluate(()=>document.querySelectorAll('input[data-imgchar]').length===0));
  ok("no Select all / Select none buttons", await pg.evaluate(()=>
      ![...document.querySelectorAll('button')].some(b=>/imgCharsSelect/.test(b.getAttribute('onclick')||""))));
  ok("its heading is gone from Settings", await pg.evaluate(()=>
      document.body.innerHTML.indexOf("Characters that get images during dialogue")===-1));

  console.log("\n[its code is gone]");
  for(const n of ["renderImgCharPicker","readImgCharPicker","imgCharsSelectAll","imgCharsSelectNone","imgCharAllowed"])
    ok("no "+n, await pg.evaluate(n=>typeof window[n]==="undefined",n));
  ok("no imgChars in state", await pg.evaluate(()=>!('imgChars' in state)));
  ok("no imgChars storage key", await pg.evaluate(()=>!('imgChars' in K)));

  console.log("\n[the gallery's own _imgChars is untouched]");
  ok("_imgChars still a function", await pg.evaluate(()=>typeof _imgChars==="function"));
  ok("_imgChars still reads folder names", await pg.evaluate(()=>{
      const r=_imgChars({characterName:"Nil"});
      return Array.isArray(r); }));

  console.log("\n[everyone gets illustrated]");
  ok("autoVisualize illustrates a character beat", await pg.evaluate(()=>{
      const uni=state.universes[0];
      const p={id:"p_img1",name:"Nil",universeId:uni.id,instructions:"x",personality:"x",backstory:"x",style:"x",goals:"x",look:{}};
      state.personas.push(p);
      const chat=curChat(); chat.presentIds=[p.id];
      const mid="m_img_"+Date.now();
      chat.messages.push({mid,role:"assistant",characterId:p.id,content:"hi"});
      state.imgOn=true; state.imgEveryTurns=1;
      const calls=[]; const real=window.illustrate; window.illustrate=(a,b)=>calls.push(a);
      const realScene=window.sceneModeActive; window.sceneModeActive=()=>false;
      const realAuto=window.autoImgActive; window.autoImgActive=()=>true;
      try{ autoVisualize(mid,"hi"); } finally {
        window.illustrate=real; window.sceneModeActive=realScene; window.autoImgActive=realAuto; }
      return calls.length===1 && calls[0]===mid; }));
  ok("and a narration beat with no character id", await pg.evaluate(()=>{
      const chat=curChat();
      const mid="m_narr_"+Date.now();
      chat.messages.push({mid,role:"assistant",content:"the rain fell"});
      const calls=[]; const real=window.illustrate; window.illustrate=(a)=>calls.push(a);
      const realScene=window.sceneModeActive; window.sceneModeActive=()=>false;
      const realAuto=window.autoImgActive; window.autoImgActive=()=>true;
      try{ autoVisualize(mid,"the rain fell"); } finally {
        window.illustrate=real; window.sceneModeActive=realScene; window.autoImgActive=realAuto; }
      return calls.length===1 && calls[0]===mid; }));
  ok("a stale sm_imgchars selection no longer suppresses anyone", await pg.evaluate(()=>{
      localStorage.setItem("sm_imgchars",JSON.stringify(["p_nobody"]));
      const chat=curChat();
      const mid="m_stale_"+Date.now();
      chat.messages.push({mid,role:"assistant",characterId:"p_img1",content:"hi"});
      const calls=[]; const real=window.illustrate; window.illustrate=(a)=>calls.push(a);
      const realScene=window.sceneModeActive; window.sceneModeActive=()=>false;
      const realAuto=window.autoImgActive; window.autoImgActive=()=>true;
      try{ autoVisualize(mid,"hi"); } finally {
        window.illustrate=real; window.sceneModeActive=realScene; window.autoImgActive=realAuto;
        localStorage.removeItem("sm_imgchars"); }
      return calls.length===1; }));

  console.log("\n[the rest of image settings still works]");
  /* v39.4 — the "illustrate every N replies" slider is retired; Pictures during play answers the
     same question as one of three choices. The guarantee that matters here is unchanged: whatever
     the setting says, it must not silently suppress a character. */
  ok("Pictures during play is the control now", await pg.evaluate(()=>
      !!document.getElementById('setImgMode') && !document.getElementById('setImgEveryTurns')));
  ok("saveSettings does not throw", await pg.evaluate(()=>{
      show('settings');
      try{ saveSettings(false); return true; }catch(e){ return "threw: "+e.message; } }));
  ok("and it saves the mode", await pg.evaluate(()=>{
      show('settings');
      document.getElementById('setImgMode').value="smart";
      saveSettings(false);
      return state.imgMode==="smart" && localStorage.getItem("sm_imgmode")==="smart" && state.autoImg===true; }));
  ok("and \u201cNo pictures\u201d really stops them", await pg.evaluate(()=>{
      show('settings');
      document.getElementById('setImgMode').value="off";
      saveSettings(false);
      const r=(imgMode()==="off" && autoImgActive()===false && state.autoImg===false);
      document.getElementById('setImgMode').value="always"; saveSettings(false);
      return r; }));

  ok("no page errors", errs.length===0?true:errs.join(" | "));
  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close(); process.exit(fail?1:0);
})();
