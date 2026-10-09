/* v150.92 — a vision model describes a pose picture. Each pose picture's "what it shows" box (Settings › Image › a scene type)
   shows its picture and a Describe button: the picture goes to the vision model (Settings → LLM Selection → Vision model) with
   the x_img_describe prompt, and the answer fills the box, where it can be edited. The model writes {{user}} (the man) and
   {{char}} (the woman) literally, so the box fills them per character as before.
   Run: NODE_PATH=/path/to/node_modules node tests/pose-vision.browser.js */
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

  const P=await pg.evaluate(()=>{ const t=up("x_img_describe");
    return {user:/The man is \{\{user\}\}/.test(t),char:/The woman is \{\{char\}\}/.test(t),literal:/exactly as they are here, braces and all/.test(t),
      hands:/hands/i.test(t),position:/position/i.test(t),explicit:/plain explicit words/.test(t),adults:/under 18/.test(t),len:/50 to 110 words/.test(t),
      reg:!!X_ENGINE_PROMPTS.x_img_describe}; });
  ok("the prompt: the man is {{user}}, the woman {{char}}, written literally; the act, positions and hands in plain explicit words; adults only; a set length", Object.values(P).every(Boolean), JSON.stringify(P));

  const R=await pg.evaluate(async()=>{
    window.toast=m=>{ (window.__toasts=window.__toasts||[]).push(String(m)); };
    state.key="sk-test"; state.visionModel="";
    const pic="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const rule={id:"r_vis",label:"Kneeling",poses:[],poseDesc:{}}; state.imgRules=(state.imgRules||[]).filter(r=>r.id!=="r_vis").concat([rule]);
    await rulePoseAdd(rule,pic); const id=rulePoseIds(rule)[0];
    const host=document.createElement('div'); document.body.appendChild(host);
    renderRulePoseDescs(rule,host); await new Promise(r=>setTimeout(r,50));
    const ta=host.querySelector(`[data-pose-desc="${id}"]`), btn=host.querySelector(`[data-pose-describe="${id}"]`), th=host.querySelector(`[data-pose-pic="${id}"]`);
    window.__reqs=[]; window.__reply="{{char}} kneels in front of {{user}}, both hands on his thighs, looking up at him.";
    const rf=window.fetchWithTimeout;
    window.fetchWithTimeout=async(url,init,o)=>{ if(/chat\/completions/.test(url)){ const body=JSON.parse(init.body); __reqs.push(body);
        if(window.__reply===null)return {res:{ok:false,status:400},data:{error:{message:"no vision"}},text:""};
        return {res:{ok:true,status:200},data:{choices:[{message:{content:window.__reply}}]},text:""}; } return rf(url,init,o); };
    dbgLog.length=0;
    btn.click(); for(let i=0;i<50&&btn.disabled;i++)await new Promise(r=>setTimeout(r,20)); await new Promise(r=>setTimeout(r,20));
    const body=__reqs[0]||{}, user=(body.messages||[])[1]||{}, parts=Array.isArray(user.content)?user.content:[];
    const r={pic:!!(th&&th.src&&th.src.startsWith("data:image")),btn:!!btn,model:body.model,sys:(body.messages||[])[0]&&body.messages[0].content,
      image:(parts.find(x=>x.type==="image_url")||{}).image_url,text:ta.value,saved:rule.poseDesc[id],
      filled:poseDescFilled(rule,id,"Ayla","Emre"),dbgImg:JSON.stringify((dbgLog.find(e=>/Vision — describe/.test(e.label))||{}).payload||{}),dbgOk:(dbgLog.find(e=>/Vision — describe/.test(e.label))||{}).status};
    // edited by hand afterwards: kept
    ta.value=r.text+" Her eyes are closed."; ta.dispatchEvent(new Event('input',{bubbles:true})); r.edited=rule.poseDesc[id];
    // a refusal, a "(not described)" and an error leave the box as it is
    const before=ta.value;
    const press=async()=>{ const n=(window.__toasts||[]).length; btn.click(); for(let i=0;i<100&&(window.__toasts||[]).length===n;i++)await new Promise(r=>setTimeout(r,20)); };
    window.__reply="I'm sorry, but I can't help with that."; await press();
    window.__reply="(not described)"; await press();
    window.__reply=null; await press();
    r.kept=ta.value===before; r.toasts=(window.__toasts||[]).slice(-3);
    state.visionModel="acme/vision-9"; __reply="{{char}} stands."; await press();
    r.model2=(__reqs[__reqs.length-1]||{}).model;
    window.fetchWithTimeout=rf; host.remove(); state.visionModel="";
    return r; });
  ok("each box shows its picture and a Describe button", R.pic&&R.btn, JSON.stringify(R));
  ok("the picture goes to the vision model (default x-ai/grok-4-fast) with the prompt", R.model==="x-ai/grok-4-fast"&&/^data:image\/png;base64,/.test(R.image&&R.image.url)&&/The man is \{\{user\}\}/.test(R.sys), JSON.stringify({model:R.model,img:R.image&&String(R.image.url).slice(0,30)}));
  ok("the answer fills the box and is saved with the picture", R.text==="{{char}} kneels in front of {{user}}, both hands on his thighs, looking up at him."&&R.saved===R.text, JSON.stringify(R));
  ok("{{char}} and {{user}} fill per character as before", R.filled==="Ayla kneels in front of Emre, both hands on his thighs, looking up at him.", R.filled);
  ok("the user's edit afterwards is kept", /Her eyes are closed\.$/.test(R.edited||""), R.edited);
  ok("a refusal, \"(not described)\" or an error leaves the box as it was, with a note", R.kept&&R.toasts.length===3, JSON.stringify(R.toasts));
  ok("the picture is never written into the Debug log", !/base64/.test(R.dbgImg)&&/not logged/.test(R.dbgImg)&&R.dbgOk==="ok", R.dbgImg.slice(0,300));
  ok("a vision model set in Settings is the one used", R.model2==="acme/vision-9", R.model2);

  const S=await pg.evaluate(()=>{ show('settings'); const e=document.getElementById('setVisionModel'); if(!e)return {box:false};
    e.value=" acme/eye-1 "; saveSettings(false); const saved=state.visionModel==="acme/eye-1"&&store.raw(K.visionModel,"")==="acme/eye-1";
    e.value=""; saveSettings(false); return {box:true,saved,cleared:visionModel()==="x-ai/grok-4-fast"}; });
  ok("Settings → LLM Selection: the vision model saves, and blank means the default", S.box&&S.saved&&S.cleared, JSON.stringify(S));

  const C=await pg.evaluate(()=>{ const d=ENGINE_PAYLOAD_DEFS.find(x=>x.key==="vision");
    const inImg=(ENGINE_PAYLOAD_DEFS.find(x=>x.key==="image_writer")||{blocks:[]}).blocks.some(b=>b.promptKey==="x_img_describe");
    return {card:!!d,label:d&&d.label,has:!!(d&&d.blocks.some(b=>b.promptKey==="x_img_describe")),inImg}; });
  ok("v150.93: Payloads → Engine payloads has a \"Vision prompt\" card holding it (no longer inside the Image Prompt Writer)", C.card&&C.label==="Vision prompt"&&C.has&&!C.inImg, JSON.stringify(C));

  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close(); process.exit(fail?1:0);
})();
