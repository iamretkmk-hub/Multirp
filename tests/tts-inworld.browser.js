const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage({viewport:{width:412,height:915}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file:///home/user/Multirp/index.html'); await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(900);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+(x?"\n        "+String(x).slice(0,300):""));} };

  console.log("\n[xAI is gone]");
  ok("no atlasTTS", await pg.evaluate(()=>typeof atlasTTS==="undefined"));
  ok("no ttsVoiceFor", await pg.evaluate(()=>typeof ttsVoiceFor==="undefined"));
  ok("no xAI voice roster", await pg.evaluate(()=>typeof XAI_TTS_VOICES==="undefined"));
  ok("no engine setting in state", await pg.evaluate(()=>!('ttsEngine' in state)));
  ok("engine dropdown removed from the UI", await pg.evaluate(()=>!document.getElementById('setTtsEngine')));
  ok("xAI voice picker removed", await pg.evaluate(()=>!document.getElementById('setTtsVoice')&&!document.getElementById('setTtsVoiceCustom')));
  ok("persona dub-voice field removed", await pg.evaluate(()=>!document.getElementById('peTtsVoiceSel')));
  ok("persona Inworld voice field kept", await pg.evaluate(()=>!!document.getElementById('peVoiceId')));

  console.log("\n[Inworld does everything]");
  ok("speakText exists and takes (text,persona)", await pg.evaluate(()=>typeof speakText==="function"));
  ok("inworldSpeakToUrl exists", await pg.evaluate(()=>typeof inworldSpeakToUrl==="function"));
  ok("voiceIdFor falls back to the call voice", await pg.evaluate(()=>{
      state.callVoice="Ashley";
      return voiceIdFor(null)==="Ashley" && voiceIdFor({voiceId:"Deborah"})==="Deborah"; }));
  ok("WAV encoder produces a valid RIFF data URI", await pg.evaluate(()=>{
      const f=new Float32Array(2400).map((_,i)=>Math.sin(i/10)*0.5);
      const u=_pcmToWavDataUri(f,24000);
      if(u.indexOf("data:audio/wav;base64,")!==0) return false;
      const bin=atob(u.split(",")[1]);
      return bin.slice(0,4)==="RIFF" && bin.slice(8,12)==="WAVE" && bin.length===44+2400*2; }));
  ok("WAV encoder handles a long clip (no arg-limit blowup)", await pg.evaluate(()=>{
      try{ const f=new Float32Array(24000*60); const u=_pcmToWavDataUri(f,24000); return u.length>1000000; }
      catch(e){ return "threw: "+e.message; } })===true);

  console.log("\n[xAI's angle markup is always dropped]");
  ok("angle tags removed", await pg.evaluate(()=>
      ttsCleanText('"Hello <whisper>there</whisper>"').indexOf("whisper")===-1));
  ok("and the words survive", await pg.evaluate(()=>
      /Hello/.test(ttsCleanText('"Hello <whisper>there</whisper>"'))));
  ok("stripTags:true still strips every bracket", await pg.evaluate(()=>
      ttsCleanText('"[say quietly] Hello [laugh]"',true).indexOf("[")===-1));

  console.log("\n[settings still save]");
  ok("saveSettings does not throw with the removed inputs", await pg.evaluate(()=>{
      show('settings');
      try{ saveSettings(false); return "ok"; }catch(e){ return "threw: "+e.message; } })==="ok");
  ok("speaking speed survived (Inworld uses it)", await pg.evaluate(()=>!!document.getElementById('setTtsSpeed')));

  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close(); process.exit(fail?1:0);
})();
