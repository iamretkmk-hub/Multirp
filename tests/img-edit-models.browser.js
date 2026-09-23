/* v51.1 — TWO SEEDREAM EDIT MODELS, ONE KEYSTROKE APART, AND NEITHER MAY BE SENT THE OTHER'S BODY.
   bytedance/seedream-v4.5/edit is a valid image model now, and the one thing that must not happen
   is 5.0 Pro's four extras (thinking, prompt_optimization_mode, output_format, background) riding
   along to a model that 400s on them — or 4.5's 2K/4K-only size enum answering with a pair 5.0 Pro
   would have taken. So this walks the ACTUAL request body for every model the picker offers, and
   then the picker itself: each entry carries its own setup, and the blank entry takes any id.
   Run: node tests/img-edit-models.browser.js */
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage({viewport:{width:412,height:915}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  const app='file://'+require('path').resolve(__dirname,'..','index.html');
  await pg.goto(app); await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(600);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x||c).slice(0,600));} };

  // One generation, with the network stubbed: hand back a finished prediction immediately and
  // keep the body that was posted. Nothing here touches AtlasCloud.
  const body=async(model,opts)=>pg.evaluate(async(a)=>{
    const real=window.fetch; let sent=null;
    window.fetch=async(u,o)=>{
      sent={url:String(u),body:JSON.parse(o.body)};
      return {ok:true,status:200,json:async()=>({data:{id:"p1",status:"completed",outputs:["https://out/1.png"]}})};
    };
    try{
      state.atlasKey="test-key"; state.imgProvider="atlascloud"; state.imgModel=a.model;
      state.imgSeed=a.seed; state.imgW=a.w; state.imgH=a.h;
      state.imgThinking="enabled"; state.imgPromptOpt="standard"; state.imgOutFormat="png"; state.imgBackground="opaque";
      await atlasImage("Woman at the pool, midday light.","blurry, extra fingers",null,
        {refs:["https://ref/1.png","https://ref/2.png"],names:["Nil","Emre"],subjects:["Woman","Man"]});
    }finally{ window.fetch=real; }
    return sent;
  },Object.assign({model,seed:4242,w:1024,h:1024},opts||{}));

  const V45="bytedance/seedream-v4.5/edit", V50="bytedance/seedream-v5.0-pro/edit";

  // ---- the spec itself
  const spec=await pg.evaluate(m=>({edit:atlasIsEditModel(m),s:atlasEditSpec(m),refs:editModelMaxRefs(m),
    fallback:editModelSize(m,""),listed:ATLAS_IMG_MODELS.some(o=>o.id===m)}),V45);
  ok("seedream v4.5 is recognised as an image-EDIT model", spec.edit===true&&spec.refs===10, JSON.stringify(spec.s));
  ok("it takes no negative prompt, no count and no seed",
     spec.s.negMax===0&&spec.s.noCount===true&&spec.s.noSeed===true&&spec.s.noPromptExtend===true, JSON.stringify(spec.s));
  ok("and it declares none of 5.0 Pro's four extras", !spec.s.opts, JSON.stringify(spec.s.opts));
  ok("it is offered in the picker", spec.listed===true);
  ok("an unparseable size falls back to one of its OWN presets",
     spec.s.sizes.indexOf(spec.fallback)>=0, spec.fallback);

  // ---- what is actually sent for v4.5
  const b45=await body(V45);
  ok("the request goes to the image endpoint with the v4.5 id",
     /model\/generateImage$/.test(b45.url)&&b45.body.model===V45, JSON.stringify(b45&&b45.url));
  ok("both reference pictures are attached",
     Array.isArray(b45.body.images)&&b45.body.images.length===2, JSON.stringify(b45.body.images));
  ok("the prompt leads with the figure roster",
     /Figure 1/.test(b45.body.prompt)&&/Figure 2/.test(b45.body.prompt)&&b45.body.prompt.length<=3600, b45.body.prompt.slice(0,160));
  {const junk=["negative_prompt","seed","num_images","n","prompt_extend","thinking","thinking_mode",
               "prompt_optimization_mode","output_format","background","enable_base64_output","guidance_scale"]
              .filter(k=>k in b45.body);
   ok("and NOTHING this model does not understand is sent", junk.length===0, "sent: "+junk.join(", "));}
  ok("a square frame is answered with a 2K square from its own enum",
     b45.body.size==="2048*2048", b45.body.size);
  {const big=await body(V45,{w:1536,h:640});
   ok("a wide frame snaps to a wide preset in the same enum",
      /^(2848\*1600|3136\*1344|6240\*2656)$/.test(big.body.size), big.body.size);}

  // ---- 5.0 Pro is untouched: the regression this change could most easily cause
  const b50=await body(V50);
  ok("5.0 Pro still gets its four own fields",
     b50.body.thinking==="enabled"&&b50.body.prompt_optimization_mode==="standard"
     &&b50.body.output_format==="png"&&b50.body.background==="opaque", JSON.stringify(b50.body));
  ok("5.0 Pro still gets no count, no seed and no negative prompt",
     !("num_images" in b50.body)&&!("n" in b50.body)&&!("seed" in b50.body)&&!("negative_prompt" in b50.body), JSON.stringify(b50.body));
  ok("5.0 Pro still sizes from ITS enum, not 4.5's",
     b50.body.size==="1024*1024", b50.body.size);

  // ---- the other three are untouched too
  const bq=await body("alibaba/qwen-image/edit-plus-20251215");
  ok("qwen still gets num_images, prompt_extend, a negative prompt and the seed",
     bq.body.num_images===1&&bq.body.prompt_extend===false&&!!bq.body.negative_prompt&&bq.body.seed===4242, JSON.stringify(bq.body));
  const bw7=await body("alibaba/wan-2.7/image-edit");
  ok("wan 2.7 still gets n + thinking_mode and the 2K tier instead of a size",
     bw7.body.n===1&&bw7.body.thinking_mode===true&&bw7.body.size==="2K"&&!("negative_prompt" in bw7.body), JSON.stringify(bw7.body));
  const bw6=await body("alibaba/wan-2.6/image-edit");
  ok("wan 2.6 still snaps to its own grid", bw6.body.size==="1024*1024", bw6.body.size);

  // ---- a free-typed id that is not an edit model is still plain text-to-image
  const bt=await pg.evaluate(async()=>{
    const real=window.fetch; let sent=null;
    window.fetch=async(u,o)=>{ sent={body:JSON.parse(o.body)};
      return {ok:true,status:200,json:async()=>({data:{id:"p1",status:"completed",outputs:["https://out/1.png"]}})}; };
    try{ state.atlasKey="test-key"; state.imgProvider="atlascloud"; state.imgModel="z-image/turbo";
      await atlasImage("A street at night","blurry",null); }finally{ window.fetch=real; }
    return sent;
  });
  ok("a text-to-image id still sends the negative prompt and no pictures",
     bt.body.model==="z-image/turbo"&&bt.body.negative_prompt==="blurry"&&!("images" in bt.body), JSON.stringify(bt.body));

  // ---- the picker
  const ui=await pg.evaluate(async()=>{
    state.imgProvider="atlascloud"; state.imgModel="bytedance/seedream-v4.5/edit";
    show('settings'); syncSettingsUI(); await new Promise(r=>setTimeout(r,120));
    const sel=document.getElementById('setAtlasImgPreset');
    const opts=[...sel.options].map(o=>o.value);
    const optsPanel=document.getElementById('atlasImgOptsWrap');
    const custom=document.getElementById('atlasImgCustomWrap');
    const note=document.getElementById('atlasImgNote');
    const out={opts, chosen:sel.value, noteV45:note.textContent,
               panelV45:getComputedStyle(optsPanel).display, customShownForPreset:getComputedStyle(custom).display};
    // pick 5.0 Pro from the dropdown: its own options must appear
    sel.value="bytedance/seedream-v5.0-pro/edit"; sel.onchange();
    out.panelV50=getComputedStyle(optsPanel).display; out.noteV50=note.textContent;
    // pick the blank entry: the free-text box appears, carrying the id that was chosen before it
    const fld=document.getElementById('setAtlasImgModel');
    sel.value="__custom__"; sel.onchange();
    out.customShown=getComputedStyle(custom).display; out.customCarried=fld.value;
    // emptied, it promises nothing
    fld.value=""; fld.dispatchEvent(new Event('input'));
    out.panelCustomEmpty=getComputedStyle(optsPanel).display; out.noteEmpty=note.textContent;
    // and a known edit id typed by hand brings its own setup with it
    fld.value="bytedance/seedream-v5.0-pro/edit"; fld.dispatchEvent(new Event('input'));
    out.panelTyped=getComputedStyle(optsPanel).display; out.noteTyped=note.textContent;
    return out;
  });
  ok("the picker offers both seedreams and ends with the blank entry",
     ui.opts.indexOf("bytedance/seedream-v4.5/edit")>=0
     && ui.opts.indexOf("bytedance/seedream-v5.0-pro/edit")>=0
     && ui.opts[ui.opts.length-1]==="__custom__", ui.opts.join(" | "));
  ok("the saved model is what the picker shows", ui.chosen==="bytedance/seedream-v4.5/edit", ui.chosen);
  ok("a preset hides the free-text box", ui.customShownForPreset==="none", ui.customShownForPreset);
  ok("v4.5 shows no extra-option panel, because it has no extra options", ui.panelV45==="none", ui.panelV45);
  ok("its note names the ten references, the 16 presets and the dropped negative prompt",
     /up to 10/.test(ui.noteV45)&&/16 presets/.test(ui.noteV45)&&/4096\*4096/.test(ui.noteV45)
     &&/not supported/.test(ui.noteV45), ui.noteV45);
  ok("picking 5.0 Pro raises its own option panel", ui.panelV50==="block", ui.panelV50);
  ok("the blank entry reveals the free-text box, carrying the id it was switched from",
     ui.customShown==="block"&&ui.customCarried==="bytedance/seedream-v5.0-pro/edit", ui.customShown+"/"+ui.customCarried);
  ok("an empty box claims no setup at all",
     ui.panelCustomEmpty==="none"&&/No model set/.test(ui.noteEmpty), ui.panelCustomEmpty+" — "+ui.noteEmpty);
  ok("a known edit id TYPED into that box brings its setup with it",
     ui.panelTyped==="block"&&/up to 10/.test(ui.noteTyped), ui.panelTyped);

  // ---- it round-trips through save and a reload, both ways
  const roundtrip=async(pick,typed)=>{
    await pg.evaluate(async(a)=>{
      state.imgProvider="atlascloud"; show('settings'); syncSettingsUI(); await new Promise(r=>setTimeout(r,80));
      const sel=document.getElementById('setAtlasImgPreset'), fld=document.getElementById('setAtlasImgModel');
      sel.value=a.pick; sel.onchange();
      if(a.typed!=null){ fld.value=a.typed; fld.dispatchEvent(new Event('input')); }
      saveSettings();
    },{pick,typed});
    await pg.reload(); await pg.waitForTimeout(2200);
    return pg.evaluate(()=>state.imgModel);
  };
  ok("a model picked from the list survives a save and a reload",
     (await roundtrip("bytedance/seedream-v4.5/edit",null))==="bytedance/seedream-v4.5/edit");
  ok("an id written into the blank entry survives a save and a reload",
     (await roundtrip("__custom__","vendor/some-unreleased-model/edit"))==="vendor/some-unreleased-model/edit");
  ok("and that free id is shown back on the blank entry, not lost to a preset",
     await pg.evaluate(async()=>{ state.imgProvider="atlascloud"; show('settings'); syncSettingsUI();
       await new Promise(r=>setTimeout(r,120));
       const sel=document.getElementById('setAtlasImgPreset'), fld=document.getElementById('setAtlasImgModel');
       return sel.value==="__custom__" && fld.value==="vendor/some-unreleased-model/edit"; }));

  /* v112.2 — Grok Imagine 2.0 edit: a THIRD dialect of this endpoint. Its references go in
     `image_urls` rather than `images`, it has no `size` at all (an aspect ratio and a separate
     resolution band instead), and its `quality` tier is the reason to pick it — low is ~8x faster
     and cheaper than medium. Any of those sent to the wrong model, or any of the others' fields
     sent to this one, is a 400. */
  const GROK="xai/grok-imagine-image-2.0-developer/edit";
  console.log("\n[grok imagine 2.0 edit]");
  const gspec=await pg.evaluate(m=>({edit:atlasIsEditModel(m),s:atlasEditSpec(m),
    refs:editModelMaxRefs(m),listed:ATLAS_IMG_MODELS.some(o=>o.id===m)}),GROK);
  ok("it is recognised as an edit model, so the references are attached at all",
     gspec.edit===true && gspec.refs===3, JSON.stringify(gspec.s));
  ok("and the picker offers it rather than leaving it to be typed", gspec.listed===true);

  const gb=await body(GROK,{w:768,h:1152});
  ok("the references go in image_urls, not images",
     Array.isArray(gb.body.image_urls) && gb.body.image_urls.length===2 && gb.body.images===undefined,
     JSON.stringify(gb.body));
  ok("the frame is sent as an aspect ratio and never as a size",
     typeof gb.body.aspect_ratio==="string" && gb.body.size===undefined, JSON.stringify(gb.body));
  ok("with the quality tier that was asked for", gb.body.quality==="low", JSON.stringify(gb.body));
  ok("and the cheap resolution band for an ordinary frame", gb.body.resolution==="1k", gb.body.resolution);
  ok("it still asks for one image", gb.body.num_images===1, JSON.stringify(gb.body));
  ok("none of the other models' fields ride along", await (async()=>{
      const bad=["negative_prompt","seed","prompt_extend","thinking","thinking_mode",
                 "prompt_optimization_mode","output_format","background","n","size","images"]
        .filter(k=>gb.body[k]!==undefined);
      return bad.length?("sent: "+bad.join(", ")):true; })());

  ok("the frame the player picked survives as a shape", await pg.evaluate(async m=>{
      const out={};
      for(const [key,want] of [["2:3","2:3"],["16:9","16:9"],["1:1","1:1"],["Portrait","2:3"],["Tall","9:16"]]){
        state.ratio=key; out[key]=_grokRatio(curImgRatioKey())===want;
      }
      state.ratio="9:16";
      const bad=Object.keys(out).filter(k=>!out[k]);
      return bad.length?("wrong ratio for: "+bad.join(", ")):true; },GROK));
  ok("every ratio it can send is one the model actually accepts", await pg.evaluate(()=>{
      const allowed=["auto","1:1","3:4","4:3","9:16","16:9","2:3","3:2","9:19.5","19.5:9","9:20","20:9","1:2","2:1"];
      const bad=Object.keys(_GROK_AR).filter(k=>allowed.indexOf(_GROK_AR[k])<0);
      return bad.length?("not in the enum: "+bad.join(", ")):true; }));
  ok("a deliberately larger frame moves it up to 2k", await pg.evaluate(()=>
      _grokRes("2048x2048")==="2k" && _grokRes("768x1152")==="1k" && _grokRes("")==="1k" ));

  ok("and its setup note describes only what is sent", await pg.evaluate(m=>{
      const n=atlasImgSetupNote(m);
      return /aspect ratio, not a pixel size/.test(n) && /Quality tier: low/.test(n)
        && /Negative prompt: not supported/.test(n) && /Seed: ignored/.test(n)
        && !/snaps to the nearest/.test(n)
        ? true : n; },GROK));

  console.log("\n[and the models beside it are untouched]");
  ok("seedream 4.5 still posts images, a size and no aspect ratio", await (async()=>{
      const v=await body(V45);
      return (Array.isArray(v.body.images) && typeof v.body.size==="string"
              && v.body.aspect_ratio===undefined && v.body.quality===undefined)
        ? true : JSON.stringify(v.body); })());

  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log("\n  "+pass+" passed, "+fail+" failed");
  await b.close();
  process.exit(fail?1:0);
})();
