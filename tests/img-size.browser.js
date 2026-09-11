/* v37.5 — the image size is two numbers you set, and a scene type can no longer overrule them.
   Before: the size came from an aspect KEY, and the image rule the router happened to match
   carried a ratio of its own — so a picture came out 16:9 because "Combat / action" was chosen,
   not because anyone asked for 16:9. */
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

  console.log("\n[the two numbers are the size]");
  ok("setting them decides what is generated", await pg.evaluate(()=>{
      state.imgW=896; state.imgH=1152;
      return curImgSize()==="896x1152" ? true : curImgSize(); }));
  ok("and the pair form agrees with the string", await pg.evaluate(()=>
      curImgWH().join("x")===curImgSize()));
  ok("an off-step value is snapped to a multiple of 8", await pg.evaluate(()=>{
      state.imgW=901; state.imgH=1153;
      const v=curImgSize(); state.imgW=896; state.imgH=1152;
      return v==="904x1152" ? true : v; }));
  ok("a value outside the range is refused, not clamped silently into nonsense", await pg.evaluate(()=>{
      state.imgW=60; state.imgH=1152;
      const v=curImgWH(); state.imgW=896;
      return (v[0]>=IMG_DIM_MIN) ? true : "accepted "+v[0]; }));
  ok("720 is a reachable height — the step no longer skips it", await pg.evaluate(()=>{
      state.imgH=720; const v=curImgWH()[1]; state.imgH=1152;
      return v===720 ? true : "720 became "+v; }));
  ok("an install that never set them keeps the size it had", await pg.evaluate(()=>{
      const w=state.imgW,h=state.imgH;
      state.imgW=null; state.imgH=null; state.ratio="9:16";
      const v=curImgSize(); state.imgW=w; state.imgH=h;
      return v===RATIOS["9:16"] ? true : v+" vs "+RATIOS["9:16"]; }));

  console.log("\n[a scene type cannot overrule them]");
  ok("no image rule carries a ratio into generation any more", await pg.evaluate(()=>
      !/rule\s*&&\s*rule\.ratio/.test(String(illustrate))));
  ok("the rule editor no longer offers the choice", await pg.evaluate(()=>
      !/data-k="ratio"/.test(String(renderRules))));
  ok("nor does it mention a scene aspect", await pg.evaluate(()=>
      !/Scene aspect ratio/.test(String(renderRules))));
  ok("a rule that still carries a stored ratio cannot move the size", await pg.evaluate(()=>{
      state.imgW=768; state.imgH=768;
      // the shipped rules DO carry ratios (r_combat is 16:9) — none of them may reach the size
      const shipped=/"ratio": "16:9"/.test(DEFAULT_IMG_RULES||"");
      return curImgSize()==="768x768" ? true : "size moved to "+curImgSize()+" shipped16:9="+shipped; }));

  console.log("\n[your own per-image pick still wins, for that one image]");
  ok("a frame override decides that image", await pg.evaluate(()=>{
      state.imgW=768; state.imgH=768;
      _frameOverride="16:9";
      const v=curImgSize(); _frameOverride=null;
      return v===RATIOS["16:9"] ? true : v; }));
  ok("and clearing it returns to your numbers", await pg.evaluate(()=>
      curImgSize()==="768x768"));

  console.log("\n[the presets write the numbers rather than hiding them]");
  ok("both sliders exist in Settings", await pg.evaluate(()=>
      !!document.getElementById('setImgW') && !!document.getElementById('setImgH')));
  ok("they open showing the live size", await pg.evaluate(()=>{
      state.imgW=1024; state.imgH=576; syncSettingsUI();
      return (+document.getElementById('setImgW').value===1024
           && +document.getElementById('setImgH').value===576)
        ? true : document.getElementById('setImgW').value+"x"+document.getElementById('setImgH').value; }));
  ok("the typed box shows the same number as the slider", await pg.evaluate(()=>
      +document.getElementById('setImgWNum').value===1024
   && +document.getElementById('setImgHNum').value===576));
  ok("the slider steps in 8s, so every valid size is reachable", await pg.evaluate(()=>
      +document.getElementById('setImgH').step===8
   && +document.getElementById('setImgH').min<=IMG_DIM_MIN
   && +document.getElementById('setImgH').max>=IMG_DIM_MAX));
  ok("tapping a preset writes both numbers", await pg.evaluate(()=>{
      state.imgW=768; state.imgH=768; syncSettingsUI();
      const btns=[...document.querySelectorAll('#ratioSeg button,#ratioSeg .segBtn,#ratioSeg *')]
        .filter(el=>/^9:16/.test((el.textContent||"").trim()));
      if(!btns.length)return "no 9:16 preset found";
      btns[0].click();
      return (state.imgW===IMG_WH["9:16"][0] && state.imgH===IMG_WH["9:16"][1])
        ? true : state.imgW+"x"+state.imgH; }));
  ok("and the sliders move with it", await pg.evaluate(()=>
      +document.getElementById('setImgW').value===IMG_WH["9:16"][0]));
  ok("dragging a slider changes the size", await pg.evaluate(()=>{
      const el=document.getElementById('setImgW');
      el.value="1216"; el.oninput();
      return state.imgW===1216 && curImgSize()==="1216x"+state.imgH ? true : curImgSize(); }));
  ok("and mirrors into the typed box", await pg.evaluate(()=>
      +document.getElementById('setImgWNum').value===1216));

  console.log("\n[typing an exact value]");
  ok("typing 720 into the height box sets 720", await pg.evaluate(()=>{
      const n=document.getElementById('setImgHNum');
      n.value="720"; n.oninput(); n.onchange();
      return state.imgH===720 && curImgWH()[1]===720 ? true : "got "+state.imgH; }));
  ok("and the slider follows it", await pg.evaluate(()=>
      +document.getElementById('setImgH').value===720));
  ok("an off-8 typed value is snapped when you leave the box", await pg.evaluate(()=>{
      const n=document.getElementById('setImgHNum');
      n.value="715"; n.oninput(); n.onchange();
      return state.imgH===712 ? true : "715 became "+state.imgH; }));
  ok("a value above the range is brought back inside it", await pg.evaluate(()=>{
      const n=document.getElementById('setImgHNum');
      n.value="9000"; n.oninput(); n.onchange();
      return state.imgH===IMG_DIM_MAX ? true : "9000 became "+state.imgH; }));
  ok("emptying the box does not leave a broken size", await pg.evaluate(()=>{
      const n=document.getElementById('setImgHNum');
      n.value=""; n.oninput(); n.onchange();
      const v=curImgWH()[1];
      return (v>=IMG_DIM_MIN&&v<=IMG_DIM_MAX) ? true : "size became "+v; }));
  ok("Enter commits without needing to leave the field", await pg.evaluate(()=>{
      const n=document.getElementById('setImgHNum');
      n.value="1080"; n.oninput();
      n.onkeydown({key:"Enter",preventDefault(){}});
      return state.imgH===1080 ? true : "got "+state.imgH; }));
  ok("it survives a save", await pg.evaluate(()=>{
      state.imgW=1216; state.imgH=832; saveSettings();
      return store.get(K.imgW,0)===1216 && store.get(K.imgH,0)===832
        ? true : store.get(K.imgW,0)+"x"+store.get(K.imgH,0); }));

  /* THE GAP THAT LET v37.5 SHIP BROKEN. Every check above this point called curImgSize() directly,
     with _frameOverride happening to be null — so they all passed while the real pipeline ignored
     the sliders completely. illustrate() assigned _frameOverride unconditionally, falling back to
     the global aspect KEY, and curImgWH() preferred it: picking 1:1 and dragging to 1024 still
     sent 768, because that is what IMG_WH["1:1"] says. These drive illustrate() itself and read
     the size out of the request that actually goes to the provider. */
  console.log("\n[through illustrate(), which is the only path that counts]");
  await pg.evaluate(()=>{
    // ModelsLab is the provider that sends width/height as its own fields, so the size it was
    // asked for is readable straight off the request. Its key is state.segkey.
    state.key="k"; state.segkey="k"; state.imgModel="test/model"; state.imgProvider="modelslab";
    state.autoImg=true; state.imgPauseOn=false;
    window.__imgReq=[];
    window.fetch=async(url,init)=>{
      let body=null; try{ body=JSON.parse((init&&init.body)||"{}"); }catch(e){}
      window.__imgReq.push({url:String(url),body});
      // a chat completion (the prompt writer) vs an image call — answer both plausibly
      if(/chat\/completions/.test(String(url)))
        return {ok:true,status:200,json:async()=>({choices:[{message:{content:"a woman by a window"}}]}),
                text:async()=>'{"choices":[{"message":{"content":"a woman by a window"}}]}'};
      return {ok:true,status:200,
              json:async()=>({status:"success",output:["https://example.com/i.png"]}),
              text:async()=>'{"status":"success","output":["https://example.com/i.png"]}'};
    };
    const uni=state.universes[0];
    if(!state.personas.some(p=>p.id==="p_i"))
      state.personas.push({id:"p_i",name:"Nil",universeId:uni.id,instructions:"x",personality:"x",
        backstory:"x",style:"x",goals:"x",look:{}});
    const chat=curChat(); chat.presentIds=["p_i"];
    chat.messages=[{mid:"mi1",role:"assistant",speaker:"Nil",speakerId:"p_i",present:["p_i"],
                    content:'"Merhaba."',img:null,imgState:"idle"}];
    markChatDirty(chat);
  });
  const sizeSent=()=>pg.evaluate(async()=>{
    window.__imgReq=[];
    const m=curChat().messages.find(x=>x.mid==="mi1");
    m.img=null; m.imgState="idle"; m.ratio=null;
    try{ await illustrate("mi1",'"Merhaba."',true); }catch(e){}
    const img=(window.__imgReq||[]).find(r=>r.body&&(r.body.width||r.body.height));
    return img?(img.body.width+"x"+img.body.height):"(no image request seen)";
  });
  ok("1:1 then the sliders at 1024 really sends 1024x1024", await (async()=>{
      await pg.evaluate(()=>{ state.ratio="1:1"; state.imgW=1024; state.imgH=1024; });
      const v=await sizeSent();
      return v==="1024x1024" ? true : "sent "+v; })());
  ok("a tall size set only on the sliders is honoured", await (async()=>{
      await pg.evaluate(()=>{ state.imgW=720; state.imgH=1280; });
      const v=await sizeSent();
      return v==="720x1280" ? true : "sent "+v; })());
  ok("the stored aspect key cannot drag it back", await (async()=>{
      await pg.evaluate(()=>{ state.ratio="16:9"; state.imgW=832; state.imgH=1216; });
      const v=await sizeSent();
      return v==="832x1216" ? true : "sent "+v+" (state.ratio won)"; })());
  ok("the message is stamped with the shape it ACTUALLY came out as", await pg.evaluate(()=>{
      const m=curChat().messages.find(x=>x.mid==="mi1");
      return m.ratio==="2:3"||m.ratio==="3:4" ? true : "stamped "+m.ratio; }));
  ok("a per-image pick still overrides, for that image", await (async()=>{
      await pg.evaluate(()=>{ state.imgW=832; state.imgH=1216;
        curChat().messages.find(x=>x.mid==="mi1").ratio="16:9"; });
      const v=await pg.evaluate(async()=>{
        window.__imgReq=[];
        const m=curChat().messages.find(x=>x.mid==="mi1");
        m.img=null; m.imgState="idle";
        try{ await illustrate("mi1",'"Merhaba."',true); }catch(e){}
        const img=(window.__imgReq||[]).find(r=>r.body&&(r.body.width||r.body.height));
        return img?(img.body.width+"x"+img.body.height):"(none)"; });
      return v===await pg.evaluate(()=>IMG_WH["16:9"].join("x")) ? true : "sent "+v; })());
  ok("and the override is released afterwards", await pg.evaluate(()=>
      _frameOverride===null ? true : "left set to "+_frameOverride));

  console.log("\n[the frame key describes the size, not a stored setting]");
  ok("a square size reads as 1:1", await pg.evaluate(()=>{
      state.imgW=1024; state.imgH=1024; state.ratio="16:9";
      return curFrameKey()==="1:1" ? true : curFrameKey(); }));
  ok("a tall size reads as tall", await pg.evaluate(()=>{
      state.imgW=720; state.imgH=1280;
      return curFrameKey()==="9:16" ? true : curFrameKey(); }));
  ok("a wide size reads as wide", await pg.evaluate(()=>{
      state.imgW=1280; state.imgH=720;
      return curFrameKey()==="16:9" ? true : curFrameKey(); }));

  ok("no page errors", errs.length===0?true:errs.join(" | "));
  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close(); process.exit(fail?1:0);
})();
