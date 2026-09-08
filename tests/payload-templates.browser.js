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
  ok("templates OFF by default", await pg.evaluate(()=>state.payloadTplOn===false));

  console.log("\n[defaults]");
  const d=await pg.evaluate(()=>ptDefaultTemplate("solo"));
  ok("solo default has [system]", d.includes("[system]"), d.slice(0,120));
  ok("solo default calls history", d.includes("{{call//dialogue_history}}"));
  ok("text default carries timing note", await pg.evaluate(()=>ptDefaultTemplate("text").includes("{{call//text_timing}}")));
  ok("all 5 kinds generate", await pg.evaluate(()=>PT_KINDS.every(k=>ptDefaultTemplate(k).length>50)));

  console.log("\n[parity: default template === classic buildPayload]");
  const parity=await pg.evaluate(()=>{
    const head={task:"# TASK\nBe her.",world:"# WORLD\nA city.",your_bio:"# YOU\nAyse.",rumors:""};
    const tail={scene_now:"# SCENE\nEvening.",response_guidance:"# GUIDE\nAnswer.",trackers:""};
    const hist=[{role:"user",content:"hi"},{role:"assistant",content:"hey"}];
    const pl=buildPayload("solo",head,tail);
    const classic=[]; if(pl.head)classic.push({role:"system",content:pl.head});
    classic.push(...hist); if(pl.tail)classic.push({role:"system",content:pl.tail});
    const was=state.payloadTplOn; state.payloadTplOn=true;
    const t=ptBuildMessages("solo",Object.assign({},head,tail),hist,{});
    state.payloadTplOn=was;
    return {same:JSON.stringify(classic)===JSON.stringify(t),classic,t};
  });
  ok("byte-identical to classic", parity.same, JSON.stringify(parity.t));

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
  ok("templates OFF => classic engine payload", await pg.evaluate(()=>{
      state.payloadTplOn=false;
      const m=epSend("gossipPrompt","SYS",{data:"D"});
      return m.length===2&&m[0].content==="SYS"&&m[1].content==="D"; }));

  console.log("\n[no errors accumulated]");
  ok("still no page errors", errs.length===0, errs.join(" | "));

  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close();
  process.exit(fail?1:0);
})();
