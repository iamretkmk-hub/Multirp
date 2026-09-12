/* v39.7 — THE PICKER WAS OFFERING A CHOICE THAT COULD NOT STICK.
   image-to-video is no longer offered, and reference-to-video is the default. While removing it:
   the boot migration matched `seedance` GENERICALLY, so it fired on the app's own family — picking
   the second shipped model, or typing a sibling id, was silently reverted on the next reload, and
   the comment promising a hand-typed id is "left alone" was false for the only vendor shipped.
   Run: node tests/video-model.browser.js */
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
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x||c).slice(0,500));} };
  const after=async id=>{ await pg.evaluate(v=>store.setRaw(K.vidModel,v),id);
    await pg.reload(); await pg.waitForTimeout(2200); return pg.evaluate(()=>state.vidModel); };

  const list=await pg.evaluate(()=>({ids:VIDEO_MODELS.map(v=>v.id), def:VIDEO_MODEL_DEFAULT}));
  ok("image-to-video is no longer offered", !list.ids.some(i=>/image-to-video/i.test(i)), list.ids.join(", "));
  ok("reference-to-video is what is offered", list.ids.length===1 && /reference-to-video/i.test(list.ids[0]), list.ids.join(", "));
  ok("the default is a model that is actually offered", list.ids.indexOf(list.def)>=0, list.def);

  ok("a chosen reference-to-video survives a reload",
     (await after("bytedance/seedance-2.0-mini/reference-to-video"))==="bytedance/seedance-2.0-mini/reference-to-video");
  ok("a hand-typed sibling survives a reload",
     (await after("bytedance/seedance-2.5-pro/image-to-video"))==="bytedance/seedance-2.5-pro/image-to-video");
  ok("a hand-typed non-seedance id survives a reload",
     (await after("someone/else-video"))==="someone/else-video");
  ok("the removed image-to-video id is migrated off",
     (await after("bytedance/seedance-2.0-mini/image-to-video"))===list.def);
  ok("a genuinely retired id is still migrated off",
     (await after("wan-2.2-turbo"))===list.def);
  ok("an empty value falls back to the default", (await after(""))===list.def);

  // routing must still recognise the family, including a typed image-to-video
  const route=await pg.evaluate(()=>({
    fam:vidFamily("bytedance/seedance-2.5-pro/image-to-video"),
    refsTyped:vidSupportsRefs("bytedance/seedance-2.5-pro/image-to-video"),
    refOnlyRef:vidIsRefOnly("bytedance/seedance-2.0-mini/reference-to-video"),
    refOnlyImg:vidIsRefOnly("bytedance/seedance-2.0-mini/image-to-video")
  }));
  ok("a typed image-to-video still routes as seedance", route.fam==="seedance" && route.refsTyped===true, JSON.stringify(route));
  ok("reference-to-video is still the ref-only endpoint", route.refOnlyRef===true);
  ok("and a typed image-to-video is not", route.refOnlyImg===false);

  // the settings picker shows the offered model, and an unlisted one falls to the custom field
  const ui=await pg.evaluate(async()=>{
    store.setRaw(K.vidModel,"bytedance/seedance-2.0-mini/reference-to-video");
    show('settings'); try{ syncVidModelUI(); }catch(e){}
    const sel=document.getElementById('setVidModelPreset');
    const opts=sel?[...sel.options].map(o=>o.value):[];
    return {found:!!sel, opts, chosen:sel?sel.value:null};
  });
  ok("the picker lists exactly what is offered, plus custom",
     ui.found===true && ui.opts.filter(o=>o!=="__custom__").length===1
       && !ui.opts.some(o=>/\/image-to-video/i.test(o)), JSON.stringify(ui));
  ok("and it shows the chosen model rather than falling to custom",
     ui.chosen==="bytedance/seedance-2.0-mini/reference-to-video", JSON.stringify(ui.chosen));

  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log(`\n  ${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail?1:0);
})();
