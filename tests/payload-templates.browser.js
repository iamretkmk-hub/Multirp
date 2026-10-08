/* ENGINE PAYLOAD TEMPLATES, and the reply path a turn is built for.
   v150.66 — the five reply payload templates are gone (a reply is built from its fragments only); what this file kept is
   what still stands: the engine templates (their own switch, the shared library, the warnings, the classic engine payload
   when they are off), the heat kind a beat resolves to (now: the heat path's fragments run), and the preview building the
   kind it says it is. The reply-template checks (generated defaults, the template editor, its validation, "erase the app's
   wording") are deleted — see tests/README.md.
   Run: node tests/payload-templates.browser.js */
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:process.env.SM_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage();
  const errs=[];
  pg.on('console',m=>{ if(m.type()==='error'&&!/Failed to load resource|net::ERR_/.test(m.text())) errs.push(m.text()); });
  pg.on('pageerror',e=>errs.push('PAGEERROR: '+e.message));
  await pg.goto('file://'+require('path').resolve(__dirname,'..','index.html'));
  await pg.waitForTimeout(2500);

  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+(x?"\n        "+String(x).slice(0,400):""));} };

  console.log("\n[boot]");
  ok("no page errors on load", errs.length===0, errs.join(" | "));
  ok("the reply builder and the engine template engine loaded", await pg.evaluate(()=>typeof ptBuildMessages==="function"&&typeof epMessages==="function"));
  ok("engine templates ON by default", await pg.evaluate(()=>state.payloadTplOn===true));

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
  // v38.4 — gossipPrompt's user message is fixed prose now, so it is no longer an engine that
  // simply echoes a `data` value. rewritePrompt still is, and is what this check needs.
  ok("toggling OFF => classic engine payload", await pg.evaluate(()=>{
      state.payloadTplOn=false;
      const m=epSend("rewritePrompt","SYS",{data:"D"});
      return m.length===2&&m[0].content==="SYS"&&m[1].content==="D"; }));


  /* (!) v41.6 — HEAT BEAT 1 MUST BE A HEAT PAYLOAD WHEN ONE CHARACTER IS PRESENT. heatBeginTurn()
     claims the player-facing reply as beat 1 and sets chat._heatBeat, documented as "what switches
     the payload to the heat layout". The multi path asked _heatBeat?"heat":"multi"; the solo path
     asked for "solo" BY NAME and never switched — so a hand-written heat template was ignored and
     the solo one ran, and with heatN=1 (where beat 1 is the whole run) heat never used its own
     template at all.
     v150.66 — the reply is its fragments, so the markers are a fragment's per-path text: the heat path's, and the solo
     path's. */
  console.log("\n[heat beat 1, with one character present]");
  const hk=await pg.evaluate(()=>{
    const uni=state.universes[0];
    if(!state.personas.some(x=>x.id==="p_k"))
      state.personas.push({id:"p_k",name:"Ayse",universeId:uni.id,instructions:"x",personality:"x",
        backstory:"x",style:"x",goals:"x",look:{}});
    const p=state.personas.find(x=>x.id==="p_k"); const chat=curChat();
    chat.presentIds=["p_k"]; state.user="Kemal";
    const wasF=state.fragments;
    state.fragments=JSON.parse(JSON.stringify(FRAG_DEFAULTS)).concat([{id:"zz_mark",name:"Marker",seg:"head",paths:FRAG_PATHS.slice(),text:"",
      byPath:{solo:"SOLO-TEMPLATE-MARKER",heat:"HEAT-TEMPLATE-MARKER"},options:[]}]);
    store.setRaw(K.fragAdds,FRAG_SHIPPED_ADDS.map(a=>a.key).join(","));
    const inj={recent:[],diary:[],longterm:[]};
    const build=()=>{
      const hb=buildCharPromptBlocks(p,[],inj,state.user,{chat,targetName:state.user,targetId:"__user__"});
      const tb=buildTailBlocks({chat,selfP:p,selfId:p.id,selfName:p.name,targetName:state.user,
        targetId:"__user__",multi:false,injected:inj});
      const kind=replyKind(chat,"solo");
      const msgs=ptBuildMessages(kind,Object.assign({},hb,tb),[],{chat,npc:p,targetName:state.user});
      return {kind,text:(msgs||[]).map(m=>m.content).join("\n")};
    };
    chat._heatBeat={total:"1",n:"1",narrN:"1"};  const heat=build();
    delete chat._heatBeat;                        const solo=build();
    state.fragments=wasF;
    return {heat,solo};
  });
  ok("a heat beat resolves to the heat kind", hk.heat.kind==="heat", hk.heat.kind);
  ok("and an ordinary turn still resolves to solo", hk.solo.kind==="solo", hk.solo.kind);
  ok("the heat path's fragment text is the one that runs",
     /HEAT-TEMPLATE-MARKER/.test(hk.heat.text), hk.heat.text.slice(0,90));
  ok("and the solo path's does not leak into it",
     !/SOLO-TEMPLATE-MARKER/.test(hk.heat.text), hk.heat.text.slice(0,90));
  ok("an ordinary turn still gets the solo path's",
     /SOLO-TEMPLATE-MARKER/.test(hk.solo.text) && !/HEAT-TEMPLATE-MARKER/.test(hk.solo.text),
     hk.solo.text.slice(0,90));
  /* One function decides this for both reply paths, so they cannot drift apart again. */
  ok("replyKind carries any base through when heat is off", await pg.evaluate(()=>
      replyKind({},"multi")==="multi" && replyKind({},"solo")==="solo"
      && replyKind({_heatBeat:{n:"1"}},"multi")==="heat"
      && replyKind({_heatBeat:{n:"1"}},"solo")==="heat"));

  /* (!) v41.8 — PREVIEWING HEAT MUST BUILD A HEAT PAYLOAD. textMode was threaded through for the
     text kind, but heat had no equivalent, so the heat preview rendered at render_mode "solo": no
     heat format, and a FINAL GUARDRAILS with every {{if render_mode = heat}} section switched off.
     Someone checking their heat template against that preview was reading a payload heat never
     sends — and would conclude the heat rails do not exist. */
  console.log("\n[the preview builds the kind it says it is]");
  const pv=await pg.evaluate(()=>{
    const uni=state.universes[0];
    if(!state.personas.some(x=>x.id==="p_pv"))
      state.personas.push({id:"p_pv",name:"Emre",universeId:uni.id,instructions:"x",personality:"x",
        backstory:"x",style:"x",goals:"x",look:{}});
    const chat=curChat(); chat.presentIds=["p_pv"]; state.user="Duygu";
    const heat=ptPreviewBlocks("heat"), solo=ptPreviewBlocks("solo"), text=ptPreviewBlocks("text");
    const mode=o=>((o.blocks||{})._railFlags||{}).render_mode;
    const rails=o=>String((o.blocks||{}).final_guardrails||"");
    const has=(o,n)=>rails(o).indexOf(ptBoxSectionText("final_guardrails",n).slice(0,40))>=0;
    return {heat:mode(heat), solo:mode(solo), text:mode(text),
      heatRails:["rail_heat_len","rail_heat_narr","rail_heat_intact","rail_heat_end"].filter(n=>has(heat,n)),
      soloLeak:has(solo,"rail_heat_narr"),
      heatFormat:/HEAT OF THE MOMENT/.test(String((heat.blocks||{}).format||"")),
      // (!) the preview borrows the real chat object — it must not leave a heat beat on it
      left:Object.prototype.hasOwnProperty.call(chat,"_heatBeat")};
  });
  ok("previewing heat renders at render_mode heat", pv.heat==="heat", String(pv.heat));
  ok("and every heat rail is in the guardrails", pv.heatRails.length===4, pv.heatRails.join(", "));
  ok("and the heat format block is built", pv.heatFormat===true);
  ok("solo and text are unchanged", pv.solo==="solo" && pv.text==="text", pv.solo+" / "+pv.text);
  ok("no heat rail leaks into the solo preview", pv.soloLeak===false);
  /* (!) The preview borrows the live chat. A beat left on it would turn the next real reply into a
     heat beat that nobody asked for. */
  ok("the preview leaves no heat beat on the live chat", pv.left===false);

  /* v41.8 — "This place is Emre & Emre's home". loc.residents is a list of ids with nothing
     stopping a repeat, and the host line joined them with " & ", so one owner read as two people. */
  ok("a resident listed twice is still one person", await pg.evaluate(()=>{
      const p=(state.personas||[]).find(x=>x.id==="p_pv");
      const names=residentsOf({id:"l_dup",name:"X",type:"home",residents:[p.id,p.id]}).map(x=>x.name);
      const none=residentsOf({id:"l0",name:"X"}).length;
      return names.length===1 && names[0]==="Emre" && none===0
        ? true : JSON.stringify(names); }));

  console.log("\n[no errors accumulated]");
  ok("still no page errors", errs.length===0, errs.join(" | "));

  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close();
  process.exit(fail?1:0);
})();
