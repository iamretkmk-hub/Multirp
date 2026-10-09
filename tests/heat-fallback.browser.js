/* v150.80 — asked: "Add a specific LLM section for heat of the moment. When it is on, the roleplay continues with that LLM.
   Also add a fallback model: when the main LLM rejects or says it cannot continue, fall back to that model automatically
   for that response."
   Covered:
     1. the two settings exist in Settings → LLM Selection and round-trip;
     2. with Heat of the moment on (or a heat beat) a roleplay reply goes to the heat model; off, or blank, it uses the
        roleplay model; rotation is not advanced by a heat turn;
     3. a refused / empty / failed roleplay reply is asked again ONCE with the fallback model and its answer is the reply;
        blank fallback = no second call (v148.7); never after a Stop; never the same model twice;
     4. a refused text reply is asked again with the fallback model; with none set, a refusal is not posted as her text.
   Run: NODE_PATH=/path/to/node_modules node tests/heat-fallback.browser.js */
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:process.env.SM_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage({viewport:{width:412,height:915}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file://'+require('path').resolve(__dirname,'..','index.html')); await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(800);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x===undefined?c:x).slice(0,900));} };
  const REFUSAL="I'm sorry, but I can't continue with this roleplay.";

  console.log("\n[1. settings]");
  const S=await pg.evaluate(()=>{
    const has=!!document.getElementById('setHeatModel')&&!!document.getElementById('setFallbackModel');
    document.getElementById('setHeatModel').value="heat/model-x"; document.getElementById('setFallbackModel').value="fb/model-y";
    saveSettings(false);
    return {has,h:store.raw(K.heatModel,""),f:store.raw(K.fallbackModel,""),sh:state.heatModel,sf:state.fallbackModel};
  });
  ok("both fields are in LLM Selection and are saved", S.has&&S.h==="heat/model-x"&&S.f==="fb/model-y"&&S.sh==="heat/model-x"&&S.sf==="fb/model-y", JSON.stringify(S));

  await pg.evaluate(()=>{
    window.__calls=[]; window.__script=[];
    window.chatCompletion=async(msgs,model,opts)=>{ __calls.push({model,dbg:(opts&&opts.dbg)||""}); const f=__script.shift(); return typeof f==="function"?f(model):f; };
    window.__gen=async(o)=>{ const c=curChat(); c.messages=[]; c._heatBeat=o.beat?{total:"2",n:"1"}:null;
      Object.assign(state,{model:"main/m",heatOn:!!o.heatOn,heatModel:o.heatModel||"",fallbackModel:o.fb||"",rpRotation:o.rot||""});
      if(o.rot){ state.rpRotIdx=0; }
      __calls=[]; __script=o.script.slice();
      let r=null, err=null; try{ r=await generateCharacterReply(c,{id:"p",name:"Ayse"},[{role:"user",content:"hi"}],{}); }catch(e){ err=e; }
      c._heatBeat=null;
      return {r,err:err&&(err.friendly||String(err)),calls:__calls.map(x=>x.model+"|"+x.dbg),rotIdx:state.rpRotIdx}; };
  });

  console.log("\n[2. the heat model]");
  const H1=await pg.evaluate(()=>__gen({heatOn:true,heatModel:"heat/m",script:["*smiles* \"Come here.\""]}));
  ok("Heat of the moment on → the heat model answers", H1.calls.length===1&&/^heat\/m\|/.test(H1.calls[0])&&H1.r.model==="heat/m", JSON.stringify(H1));
  const H2=await pg.evaluate(()=>__gen({beat:true,heatModel:"heat/m",script:["\"Yes.\""]}));
  ok("a heat beat → the heat model too", /^heat\/m\|/.test(H2.calls[0]||""), JSON.stringify(H2));
  const H3=await pg.evaluate(()=>__gen({heatOn:false,heatModel:"heat/m",script:["\"Hello.\""]}));
  ok("Heat off → the roleplay model", /^main\/m\|/.test(H3.calls[0]||""), JSON.stringify(H3));
  const H4=await pg.evaluate(()=>__gen({heatOn:true,heatModel:"",script:["\"Hello.\""]}));
  ok("no heat model set → the roleplay model even in heat", /^main\/m\|/.test(H4.calls[0]||""), JSON.stringify(H4));
  const H5=await pg.evaluate(()=>__gen({heatOn:true,heatModel:"heat/m",rot:"a/1, b/2",script:["\"Hi.\""]}));
  ok("a heat turn does not advance the rotation", /^heat\/m\|/.test(H5.calls[0]||"")&&H5.rotIdx===0, JSON.stringify(H5));

  console.log("\n[3. the fallback model]");
  const F1=await pg.evaluate(R=>__gen({fb:"fb/m",script:[R,"*leans in* \"Fine.\""]}),REFUSAL);
  ok("refused → asked once with the fallback model; its answer is the reply", F1.calls.length===2&&/^fb\/m\|.*fallback model/.test(F1.calls[1])&&F1.r.text.indexOf("Fine")>=0&&F1.r.model==="fb/m"&&!F1.r.refused, JSON.stringify(F1));
  const F2=await pg.evaluate(()=>__gen({fb:"fb/m",script:["","\"Here.\""]}));
  ok("empty → the fallback model", F2.calls.length===2&&F2.r.text.indexOf("Here")>=0, JSON.stringify(F2));
  const F3=await pg.evaluate(()=>__gen({fb:"fb/m",script:[()=>{ throw {friendly:"HTTP 500"}; },"\"Back.\""]}));
  ok("a failed request → the fallback model", F3.calls.length===2&&!F3.err&&F3.r.text.indexOf("Back")>=0, JSON.stringify(F3));
  const F4=await pg.evaluate(R=>__gen({fb:"",script:[R]}),REFUSAL);
  ok("no fallback set → no second call, the refusal is caught as before (v148.7)", F4.calls.length===1&&F4.r.refused===true, JSON.stringify(F4));
  const F5=await pg.evaluate(()=>__gen({fb:"fb/m",script:[()=>{ throw {friendly:"Stopped.",stopped:true}; }]}));
  ok("never after a Stop", F5.calls.length===1&&F5.err==="Stopped.", JSON.stringify(F5));
  const F6=await pg.evaluate(R=>__gen({fb:"main/m",script:[R]}),REFUSAL);
  ok("never the same model twice", F6.calls.length===1&&F6.r.refused===true, JSON.stringify(F6));
  const F7=await pg.evaluate(R=>__gen({fb:"fb/m",script:[R,R]}),REFUSAL);
  ok("the fallback refuses too → refused, one extra call only", F7.calls.length===2&&F7.r.refused===true, JSON.stringify(F7));
  const F8=await pg.evaluate(R=>__gen({heatOn:true,heatModel:"heat/m",fb:"fb/m",script:[R,"\"Ok.\""]}),REFUSAL);
  ok("in heat: the heat model refuses → the fallback model answers", /^heat\/m\|/.test(F8.calls[0])&&/^fb\/m\|/.test(F8.calls[1]||"")&&F8.r.model==="fb/m", JSON.stringify(F8));

  console.log("\n[4. texts]");
  const T=await pg.evaluate(async R=>{
    const uni=state.universes[0];
    state.personas=[{id:"p_b",name:"Burcu",universeId:uni.id,look:{},personality:"x",backstory:"x",instructions:"x"}];
    Object.assign(state,{user:"Emre",key:"k",textsOn:true,mem:false,emoOn:false,curUniverse:uni.id,model:"main/m"});
    window.toast=t=>{ (window.__toasts=window.__toasts||[]).push(String(t)); };
    const run=async(fb,script)=>{ const c=curChat(); state.fallbackModel=fb;
      c.messages=[{mid:"t"+Math.random(),role:"user",content:"Naber?",textMsg:true,textWith:"p_b",present:[],gday:1,gperiod:"Evening"}];
      Object.assign(c,{universeId:uni.id,presentIds:[]}); _textSeenMid.clear(); window.__toasts=[];
      __calls=[]; __script=script.slice();
      window.chatCompletion=async(msgs,model,opts)=>{ const d=(opts&&opts.dbg)||""; __calls.push({model,dbg:d}); if(!/^Text reply/.test(d))return "{}"; const f=__script.shift(); return typeof f==="function"?f(model):f; };
      await _replyToText(c,state.personas[0],c.messages[0]);
      const th=textThreadMsgs(c,"p_b").filter(m=>m.role==="assistant");
      return {texts:th.map(m=>m.content),calls:__calls.filter(x=>/^Text reply/.test(x.dbg)).map(x=>x.model+"|"+x.dbg),toasts:__toasts.slice()}; };
    return {fb:await run("fb/m",[R,"İyiyim, sen?"]), none:await run("",[R])};
  },REFUSAL);
  ok("a refused text → the fallback model, and its text is posted", T.fb.calls.length===2&&/^fb\/m\|Text reply.*fallback model/.test(T.fb.calls[1])&&T.fb.texts.join("|").indexOf("İyiyim")>=0, JSON.stringify(T.fb));
  ok("no fallback: a refusal is not posted as her text; the player is told", T.none.calls.length===1&&!T.none.texts.some(t=>/can't continue/.test(t))&&T.none.toasts.some(t=>/refused/.test(t)), JSON.stringify(T.none));

  ok("no page errors", errs.length===0?true:errs.join(" | "));
  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close(); process.exit(fail?1:0);
})();
