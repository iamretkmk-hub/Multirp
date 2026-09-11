const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage();
  const errs=[];
  pg.on('console',m=>{ if(m.type()==='error'&&!/Failed to load resource|net::ERR_/.test(m.text())) errs.push(m.text()); });
  pg.on('pageerror',e=>errs.push('PAGEERROR: '+e.message));
  await pg.goto('file:///home/user/Multirp/index.html');
  await pg.waitForTimeout(2500);

  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+(x?"\n        "+String(x).slice(0,400):""));} };

  console.log("\n[boot]");
  ok("no page errors on load", errs.length===0, errs.join(" | "));
  ok("template engine loaded", await pg.evaluate(()=>typeof ptBuildMessages==="function"));
  ok("templates ON by default", await pg.evaluate(()=>state.payloadTplOn===true));

  console.log("\n[defaults]");
  const d=await pg.evaluate(()=>ptDefaultTemplate("solo"));
  ok("solo default has [system]", d.includes("[system]"), d.slice(0,120));
  ok("solo default calls history", d.includes("{{call//dialogue_history}}"));
  ok("text default carries timing note", await pg.evaluate(()=>ptDefaultTemplate("text").includes("{{call//text_timing//full}}")));
  ok("all 5 kinds generate", await pg.evaluate(()=>PT_KINDS.every(k=>ptDefaultTemplate(k).length>50)));

  /* v38.0 — BYTE PARITY MOVED TO tests/parity-live.browser.js, and it had to.
     This checked the template against buildPayload using STAND-IN block values ("# TASK\nBe her."),
     which worked while every call was {{call//x//full}} and the template contributed no words of
     its own. It cannot work now: a piece whose heading lives in the template takes that heading
     from the real shipped fragment, so against a stand-in value the two sides legitimately differ
     — the template says "# TASK\nYou are {{char}}…", the stand-in says "# TASK\nBe her.".
     parity-live runs the same comparison with REAL blocks from a real scene, across all five
     payload kinds, and also asserts the template path did not quietly fall back. What is worth
     keeping here is the weaker but still useful property: with stand-in blocks, nothing the
     producer supplied goes missing on the way through the template. */
  console.log("\n[no data is lost on the way through a template]");
  const carried=await pg.evaluate(()=>{
    const head={task:"# TASK\nBe her.",world:"# WORLD\nA city.",your_bio:"# YOU\nAyse.",rumors:""};
    /* v38.1 — response_target, response_guidance and drives are called by FRAGMENT now. Handed
       over as whole strings with no fragment map (exactly what an older payload or a hand-built
       block set looks like) they must still arrive, once, in the right place. */
    const tail={scene_now:"# SCENE\nEvening.",response_guidance:"# GUIDE\nAnswer.",trackers:"",
      drives:blkTpl("drive_header")+"\n\nShe wants it.\n\n"+blkTpl("drive_ego")};
    head.response_target="# TARGET\nKemal.";
    const hist=[{role:"user",content:"hi"},{role:"assistant",content:"hey"}];
    const was=state.payloadTplOn; state.payloadTplOn=true;
    const t=ptBuildMessages("solo",Object.assign({},head,tail),hist,{});
    state.payloadTplOn=was;
    const all=(t||[]).map(m=>m.content||"").join("\n");
    return {got:!!t, all,
      missing:["Be her.","A city.","Ayse.","Evening.","Answer.","Kemal.","She wants it."].filter(x=>all.indexOf(x)<0),
      // and the prose the template prints itself must not also come back in with the rescued block
      doubled:(all.split("THE TWO THINGS PULLING AT YOU").length-1)>1
        ||(all.split("Do not narrate this weighing").length-1)>1,
      order:(t||[]).map(m=>m.role).join(",")};
  });
  ok("the template path produced messages", carried.got===true);
  ok("a block handed over without its fragment map is not sent twice", carried.doubled===false,
     "the template's own prose came back in with the rescued block");
  ok("every block the producer supplied is in there", carried.missing.length===0,
     "missing: "+carried.missing.join(", "));
  ok("the transcript still sits between the two system messages",
     carried.order==="system,user,assistant,system", carried.order);

  console.log("\n[settings UI]");
  await pg.evaluate(()=>{ show('settings'); });
  await pg.waitForTimeout(400);
  await pg.evaluate(()=>{ renderPayloadList(); });
  await pg.waitForTimeout(400);
  ok("template card rendered", await pg.evaluate(()=>!!document.getElementById('payloadTplList') && document.getElementById('payloadTplList').innerHTML.length>500));
  ok("toggle present", await pg.evaluate(()=>!!document.getElementById('payloadTplOn')));
  ok("5 template editors", await pg.evaluate(()=>document.querySelectorAll('[data-pttpl]').length===5));
  ok("catalog lists pieces", await pg.evaluate(()=>document.getElementById('payloadTplList').innerHTML.includes("{{call//recent_memories}}")));
  ok("i / used-by buttons on block rows", await pg.evaluate(()=>{
      const det=document.querySelector('details[data-plq="solo"]'); det.open=true;
      renderPayloadEditor('solo');
      return document.getElementById('plqBody_solo').innerHTML.includes("ptShowUsedBy");
    }));

  console.log("\n[validation warns, never silent]");
  const v=await pg.evaluate(()=>{
    ptSetTemplate("solo","[system]\n{{call//task}}\n{{call//nope_wrong}}\n{{bogus_value}}\n[system end]\n");
    renderPayloadTemplates(); ptValidate("solo");
    return document.getElementById('ptWarn_solo').innerHTML;
  });
  ok("unknown piece flagged", v.includes("nope_wrong"), v.slice(0,200));
  ok("unknown value flagged", v.includes("bogus_value"));
  ok("missing history flagged", v.toLowerCase().includes("dialogue_history"));
  const v2=await pg.evaluate(()=>{ ptSetTemplate("solo",null); ptValidate("solo"); return document.getElementById('ptWarn_solo').innerHTML; });
  ok("clean template says so", v2.includes("exists"), v2.slice(0,160));

  console.log("\n[toggle persists]");
  await pg.evaluate(()=>ptToggle(true));
  ok("toggle writes state+storage", await pg.evaluate(()=>state.payloadTplOn===true && store.get(K.payloadTplOn,false)===true));
  await pg.evaluate(()=>ptToggle(false));


  console.log("\n[engine templates]");
  ok("engines registered", await pg.evaluate(()=>Object.keys(ENGINE_PARTS).length>=60));
  ok("engine editor rendered", await pg.evaluate(()=>{ renderEngineTemplates();
      return document.querySelectorAll('[data-eptpl]').length>=60; }));
  ok("shared library callable everywhere", await pg.evaluate(()=>{
      const k=Object.keys(ENGINE_PARTS)[0]; const n=epKnownNames(k);
      return n.trackers&&n.promises&&n.rumors&&n.scene&&n.prompt; }));
  ok("library is lazy (functions until called)", await pg.evaluate(()=>{
      const lib=engineLibrary(null); return typeof lib.trackers==="function"; }));
  ok("adding a library call to an engine works", await pg.evaluate(()=>{
      const k="gossipPrompt";
      ptSetTemplate(epTplKey(k),"[system]\n{{call//prompt}}\n[system end]\n[user]\n{{call//data}}\n\nTRACKERS:\n{{call//trackers}}\n[end user]\n");
      const was=state.payloadTplOn; state.payloadTplOn=true;
      const m=epMessages(k,"SYS",{data:"DATA_HERE"});
      state.payloadTplOn=was; ptSetTemplate(epTplKey(k),null);
      return !!m && m.some(x=>x.role==="user"&&x.content.indexOf("DATA_HERE")>-1); }));
  ok("engine warns on unknown name", await pg.evaluate(()=>{
      const k="gossipPrompt";
      ptSetTemplate(epTplKey(k),"[system]\n{{call//prompt}}\n[system end]\n[user]\n{{call//not_a_thing}}\n[end user]");
      renderEngineTemplates(); epValidate(k);
      const h=document.getElementById('epWarn_'+k).innerHTML;
      ptSetTemplate(epTplKey(k),null); return h.indexOf("not_a_thing")>-1; }));
  ok("engine warns when the prompt is dropped", await pg.evaluate(()=>{
      const k="gossipPrompt";
      ptSetTemplate(epTplKey(k),"[user]\n{{call//data}}\n[end user]");
      renderEngineTemplates(); epValidate(k);
      const h=document.getElementById('epWarn_'+k).innerHTML;
      ptSetTemplate(epTplKey(k),null); return /stop working/i.test(h); }));
  ok("toggling OFF => classic engine payload", await pg.evaluate(()=>{
      state.payloadTplOn=false;
      const m=epSend("gossipPrompt","SYS",{data:"D"});
      return m.length===2&&m[0].content==="SYS"&&m[1].content==="D"; }));


  console.log("\n[bare vs full pieces]");
  ok("bare and //full are both valid names", await pg.evaluate(()=>{
      const k=ptKnownNames(); return k["trackers"]&&k["trackers//full"]; }));
  ok("default template uses //full", await pg.evaluate(()=>ptDefaultTemplate("solo").includes("//full}}")));
  ok("erase button swaps them all to bare", await pg.evaluate(()=>{
      ptSetTemplate("solo",null); ptStripHeaders("solo");
      const t=ptTemplate("solo"); ptSetTemplate("solo",null);
      // v38.1 — your_bio is called by fragment now (bio_intro/bio_body), so it is no longer a
      // //full piece at all. trackers still is, and is what this button exists for.
      return t.indexOf("//full}}")===-1 && t.indexOf("{{call//trackers}}")>-1; }));
  ok("put-them-back restores //full", await pg.evaluate(()=>{
      ptSetTemplate("solo",null); ptStripHeaders("solo"); ptRestoreHeaders("solo");
      const t=ptTemplate("solo"); ptSetTemplate("solo",null);
      return t.indexOf("{{call//trackers//full}}")>-1 && t.indexOf("{{call//dialogue_history}}")>-1; }));

  console.log("\n[no errors accumulated]");
  ok("still no page errors", errs.length===0, errs.join(" | "));

  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close();
  process.exit(fail?1:0);
})();
