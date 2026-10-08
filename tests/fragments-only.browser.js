/* v150.66 — THE FRAGMENTS ARE THE ONLY WAY A REPLY IS BUILT. The classic part list (payloadOrder / buildPayload /
   PAYLOAD_DEFS), the five reply payload templates and the fragments' on/off switch are gone. Checked here:
     • the switch, the classic builder and the reply templates are gone; every reply path is a fragment path;
     • every reply call site — solo (sendMessage), multi and heat (playCharacterTurn), gamemaster (playSingleReaction) and
       text (sendTextMessage) — sends the compiled fragments of its own path, with an old fragOn=false, the engine-template
       switch on and a reply layout an older build stored all ignored;
     • a saved fragment list that throws falls back to the SHIPPED list, with a Debug entry and a toast; when the shipped
       list fails too the reply fails with Retry (never a silent empty payload);
     • the proactive texter's context (it joined some text-payload blocks with buildPayload) is unchanged: the same blocks
       in the same order, deduped the same way;
     • the Payloads screen has no classic part list, no reply templates, no A/B panel and no "＋ Placeholder"; the engine
       templates still work and their switch ("Use my engine templates") is in their card;
     • "Preview the payload" builds each of the five paths from the DRAFT (an unsaved edit shows up), with the readable
       coloured renderer, and lists the fragments and options that fired and the asked options (no stored answer = no);
     • settings: an old prompt pack with payloadLayouts / payloadRemoved / payloadTemplates / payloadTplOn imports without
       error, and the fragments travel in a pack now.
   Run: node tests/fragments-only.browser.js   (needs playwright; see tests/README.md) */
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:process.env.SM_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage({viewport:{width:412,height:915}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file://'+require('path').resolve(__dirname,'..','index.html'));
  await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(800);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x===undefined?c:x).slice(0,900));} };

  await pg.evaluate(()=>{
    window.__sleep=ms=>new Promise(r=>setTimeout(r,ms));
    window.__calls=[];
    window.chatCompletion=async(messages,model,opts)=>{
      const dbg=(opts&&opts.dbg)||"";
      __calls.push({dbg,msgs:JSON.parse(JSON.stringify(messages)),text:JSON.stringify(messages)});
      if(/^Turn router · player/.test(dbg)) return '{"addressed":"group","responders":["Duygu"]}';
      if(/^Turn router · character/.test(dbg)) return '{"continue":false}';
      if(/^Text reply/.test(dbg)) return 'Tamam.';
      if(/^Proactive text/.test(dbg)) return '{"text":false}';
      if(opts&&opts.rp===true) return '"Peki."';
      return "{}";
    };
    window.__marker=()=>{
      const L=JSON.parse(JSON.stringify(FRAG_DEFAULTS));
      L.push({id:"zz_marker",name:"Marker",seg:"tail",paths:FRAG_PATHS.slice(),text:"ZZ-MARKER for {{char}}",
        byPath:{solo:"ZZ-PATH-solo",multi:"ZZ-PATH-multi",gm:"ZZ-PATH-gm",text:"ZZ-PATH-text",heat:"ZZ-PATH-heat"},mode:"any",options:[]});
      return L; };
    window.__setup=(opts)=>{
      opts=opts||{};
      const base=state.universes[0];
      const U=Object.assign({},base,{id:"u1",name:"Test",characters:[],setting:"A small town by the sea.",
        locations:[{id:"l_ev",name:"Akbaba Evi",description:"a house",residents:[],sublocations:[{id:"s_salon",name:"Salon"}]}],
        gameData:{},rules:[],trackers:[],prompts:{}});
      state.universes=[U];
      const mk=(id,n)=>({id,name:n,universeId:"u1",personality:n+" is calm.",instructions:"x",backstory:n+" grew up here.",style:"Short sentences.",goals:"x",look:{},relationships:{}});
      state.personas=[mk("p_d","Duygu"),mk("p_h","Hakan"),mk("p_o","Özlem")];
      Object.assign(state,{key:"k",user:"Emre",routerDecOn:false,moveDecOn:false,textGateOn:false,mem:false,sceneOn:false,gmOn:false,autoRpOn:false,heatOn:false,suggestOn:false,autoSpeak:false,narrMode:false,
        relOn:false,trackOn:false,calOn:false,promiseOn:false,gossipOn:false,intentOn:false,pulseOn:false,roundOn:false,charQuestsOn:false,emoOn:false,replyCheckOn:false,limitsOn:false,
        goalPursuitOn:false,textsOn:false,autoImg:false,imgMode:"off",streamReveal:false,storyLang:"tr",travelTime:0,presenceOff:true,presenceCueGate:false});
      /* what used to switch the fragments off, and a reply layout an older build stored: all of it is ignored now */
      state.fragOn=false; store.setRaw(K.fragOn,"0");
      state.payloadTplOn=true;
      state.payloadTemplates={};
      FRAG_PATHS.forEach(k=>{ state.payloadTemplates[k]="[system]\nCLASSIC-SENTINEL-"+k+"\n[system end]\n\n{{call//dialogue_history}}\n"; });
      state.fragments=opts.fragments===undefined?__marker():opts.fragments;
      store.setRaw(K.fragAdds,FRAG_SHIPPED_ADDS.map(a=>a.key).join(","));
      const present=opts.present||["p_d"];
      const subPos={}; present.forEach(id=>subPos[id]="s_salon");
      state.chats={c1:{id:"c1",universeId:"u1",castIds:[],presentIds:present,memCounts:{},tempChars:[],activeEvent:null,gameDay:1,period:"Afternoon",
        locationId:"l_ev",location:"Akbaba Evi",subId:"s_salon",subPos,calendar:[],promises:[],rel:{},emo:{},
        messages:(opts.messages||[{role:"user",content:'"Merhaba."'},{role:"assistant",speaker:"Duygu",speakerId:"p_d",content:'"Selam."'}])
          .map(m=>Object.assign({mid:newMid(),present:present.slice()},m))}};
      state.curUniverse="u1"; state.curChat="c1"; applyUniverseProfile("u1"); state.memory=[];
      __calls=[];
      show('chat'); try{ renderChat(); }catch(e){}
      return state.chats.c1;
    };
    window.__settle=async()=>{ const t=Date.now(); while(Date.now()-t<15000){ await __sleep(50);
      if(!_presentPlaying&&!_presentQueue.length&&!chatBusy(state.chats.c1,"turn")) return true; } return false; };
    window.__reply=re=>{ const c=__calls.filter(x=>re.test(x.dbg)).pop(); return c?c.text:""; };
  });

  console.log("\n[the switch, the classic builder and the reply templates are gone]");
  const G=await pg.evaluate(()=>({
    fragOnFor:FRAG_PATHS.every(k=>fragOnFor(k)===true)&&fragOnFor("other")===false,
    gone:["fragToggle","buildPayload","payloadOrder","payloadRemovedSet","ptPieceTemplate","renderPayloadTemplates","renderPayloadEditor",
      "ptToggle","ptPreview","ptStripHeaders","renderAbPanel","abRun","_abSide","phAddMenu","movePayloadBlock","resetPayloadOrder","ptEditPiece"]
      .filter(n=>{ try{ return typeof eval(n)!=="undefined"; }catch(e){ return false; } }),
    consts:["PAYLOAD_DEFS","PT_PRESETS","PT_KINDS"].filter(n=>{ try{ eval(n); return true; }catch(e){ return false; } }),
    notInState:!("fragOn" in state)||true,
    ptReply:ptTemplate("solo")===""&&ptDefaultTemplate("solo")==="",
    ptEng:ptDefaultTemplate("eng:"+Object.keys(ENGINE_PARTS)[0]).length>0}));
  ok("every reply path is a fragment path, and nothing else is", G.fragOnFor===true);
  ok("the switch, the classic builder, the reply templates, the A/B panel and the placeholder menu are gone", G.gone.length===0, G.gone.join(", "));
  ok("…and PAYLOAD_DEFS, PT_PRESETS and PT_KINDS", G.consts.length===0, G.consts.join(", "));
  ok("a reply kind has no template any more; an engine still has its default", G.ptReply===true&&G.ptEng===true, JSON.stringify(G));
  ok("the state no longer reads sm_fragon (an old \"0\" switches nothing off)", await pg.evaluate(()=>{ const s=String(document.documentElement.innerHTML); return !/fragOn:store\.raw\(K\.fragOn/.test(s); }));

  console.log("\n[every reply call site builds from its own path's fragments]");
  const S=await pg.evaluate(async()=>{
    const c=__setup({present:["p_d"]});
    await sendMessage({chat:c,text:'"Nasılsın?"'}); await __settle();
    return __reply(/^Roleplay reply$/);
  });
  ok("solo (sendMessage): the fragments, the solo path", /ZZ-MARKER for Duygu/.test(S)&&/ZZ-PATH-solo/.test(S)&&!/ZZ-PATH-(multi|gm|text|heat)/.test(S), S.slice(0,400));
  ok("…not the stored solo template, though the engine-template switch is on and fragOn is false", S&&!/CLASSIC-SENTINEL/.test(S));
  ok("…and the shipped wording is there (the task, the universe setting)", /# TASK/.test(S)&&/# UNIVERSE SETTING/.test(S)&&/A small town by the sea\./.test(S));
  const M=await pg.evaluate(async()=>{
    const c=__setup({present:["p_d","p_h"]});
    await playCharacterTurn(c,state.personas.find(p=>p.id==="p_h"),"Emre",{noWait:true}); await __settle();
    return __calls.filter(x=>/^Roleplay reply/.test(x.dbg)).map(x=>x.text).pop()||"";
  });
  ok("multi (playCharacterTurn): the multi path", /ZZ-MARKER for Hakan/.test(M)&&/ZZ-PATH-multi/.test(M)&&!/CLASSIC-SENTINEL/.test(M), M.slice(0,400));
  const H=await pg.evaluate(async()=>{
    const c=__setup({present:["p_d","p_h"]});
    c._heatBeat={n:1,total:3,narrN:"1"};
    await playCharacterTurn(c,state.personas.find(p=>p.id==="p_d"),"Emre",{noWait:true}); await __settle();
    delete c._heatBeat;
    return __calls.filter(x=>/^Roleplay reply/.test(x.dbg)).map(x=>x.text).pop()||"";
  });
  ok("heat (playCharacterTurn with a heat beat): the heat path", /ZZ-MARKER for Duygu/.test(H)&&/ZZ-PATH-heat/.test(H)&&!/ZZ-PATH-multi/.test(H)&&!/CLASSIC-SENTINEL/.test(H), H.slice(0,400));
  const GM=await pg.evaluate(async()=>{
    const c=__setup({present:["p_d"]});
    await playSingleReaction(c,state.personas.find(p=>p.id==="p_d"),"A glass breaks in the kitchen."); await __settle();
    return __reply(/gamemaster reaction/);
  });
  ok("gamemaster (playSingleReaction): the gm path", /ZZ-MARKER for Duygu/.test(GM)&&/ZZ-PATH-gm/.test(GM)&&!/CLASSIC-SENTINEL/.test(GM), GM.slice(0,400));
  const T=await pg.evaluate(async()=>{
    const c=__setup({present:[],messages:[]});
    await sendTextMessage(c,state.personas.find(p=>p.id==="p_o"),"selam");
    for(let i=0;i<80&&!__calls.some(x=>/^Text reply/.test(x.dbg));i++) await __sleep(100);
    return __reply(/^Text reply/);
  });
  ok("text (sendTextMessage): the text path", /ZZ-MARKER for Özlem/.test(T)&&/ZZ-PATH-text/.test(T)&&!/CLASSIC-SENTINEL/.test(T), T.slice(0,400));

  console.log("\n[the safety net: a saved list that throws, and then the shipped list]");
  const F=await pg.evaluate(async()=>{
    const bad=[{id:"bad",name:"Broken",seg:"head",paths:5,text:"BROKEN-LIST",options:{}}];
    const c=__setup({present:["p_d"],fragments:bad});
    const n0=dbgLog.length;
    let toastSeen="";
    const realToast=window.toast; window.toast=m=>{ toastSeen+=m+"\n"; try{ realToast(m); }catch(e){} };
    try{ await sendMessage({chat:c,text:'"Orada mısın?"'}); await __settle(); } finally{ window.toast=realToast; }
    const sent=__reply(/^Roleplay reply$/);
    const entries=dbgLog.slice(n0).filter(e=>/Reply fragments FAILED \(solo\)/.test(e.label));
    /* direct: ptBuildMessages with the broken list falls back; with the shipped list itself broken it throws */
    const pb=Object.assign({},buildCharPromptBlocks(state.personas[0],[],{recent:[],diary:[],longterm:[]},"Emre",{chat:c,targetName:"Emre",targetId:"__user__"}),
      buildTailBlocks({chat:c,selfP:state.personas[0],selfId:"p_d",selfName:"Duygu",targetName:"Emre",targetId:"__user__",multi:false,injected:{recent:[],diary:[],longterm:[]}}));
    const rep={}; const m2=ptBuildMessages("solo",pb,[{role:"user",content:"x"}],{chat:c,npc:state.personas[0],targetName:"Emre",report:rep});
    const realC=window.fragCompile; let thrown="", lastNotice="";
    window.fragCompile=()=>{ throw new Error("both lists broken"); };
    try{ ptBuildMessages("solo",pb,[],{chat:c,npc:state.personas[0],targetName:"Emre"}); }catch(e){ thrown=e.message; }
    /* and a reply whose payload cannot be built at all fails with Retry */
    state.fragments=null;
    try{ await sendMessage({chat:c,text:'"Hâlâ?"'}); await __settle(); } finally{ window.fragCompile=realC; }
    const notices=c.messages.filter(m=>m.retryNotice||m.retry||/Retry|went wrong/i.test(String(m.content||""))&&m.sysError);
    lastNotice=JSON.stringify(c.messages.slice(-1)[0]||{});
    return {sent:sent.slice(0,300),hasTask:/# TASK/.test(sent),broken:/BROKEN-LIST/.test(sent),entries:entries.length,entry:entries[0]?JSON.stringify(entries[0].payload):"",
      toast:toastSeen,repList:rep.list,fell:!!rep.fellBack,m2:Array.isArray(m2)&&m2.length>0,thrown,lastNotice,notices:notices.length,
      lastIsUser:(c.messages.slice(-1)[0]||{}).role};
  });
  ok("a saved list that throws: the reply is still sent, built from the shipped fragments", F.hasTask&&!F.broken, F.sent);
  ok("…with a Debug entry that says so", F.entries===1&&/your saved fragments/.test(F.entry), F.entries+" "+F.entry);
  ok("…and a toast", /Your reply fragments failed — sent the shipped fragments instead/.test(F.toast), F.toast);
  ok("ptBuildMessages reports the fall-back (list: shipped)", F.m2&&F.fell&&F.repList==="shipped", JSON.stringify({m2:F.m2,fell:F.fell,list:F.repList}));
  ok("when the shipped list fails too, the error goes up (no silent empty payload)", /both lists broken/.test(F.thrown), F.thrown);
  ok("…and the reply fails with a Retry notice instead of being sent", F.notices>=1, F.lastNotice);

  console.log("\n[the proactive texter's context is unchanged]");
  const P=await pg.evaluate(async()=>{
    const c=__setup({present:[],messages:[{role:"assistant",speaker:"Özlem",speakerId:"p_o",content:"Bugün gelecek misin?",textMsg:true,textWith:"p_o",present:[]}]});
    const p=state.personas.find(x=>x.id==="p_o");
    p.relationships={__user__:{tie:"neighbour",relationship:"Emre lives next door."}};
    p.scenario="She runs the bakery downstairs.";
    /* v150.64 build's join, verbatim: payloadOrder("text") with no saved layout is REPLY_ORDER */
    const oldJoin=(blocks)=>{
      const head=[],tail=[]; let afterHist=false;
      REPLY_ORDER.forEach(id=>{ if(id==="__history__"){afterHist=true;return;} const cc=blocks[id]; if(!cc)return; (afterHist?tail:head).push(cc); });
      const h=_dedupePayloadSections(head.join("\n\n"));
      const t=_dedupePayloadSections(tail.join("\n\n"));
      const hKeys=new Set(h.split(/\n(?=#{1,2} )/).map(s=>s.replace(/\s+/g," ").trim()).filter(s=>s.length>40));
      const t2=t.split(/\n(?=#{1,2} )/).filter(s=>!hKeys.has(s.replace(/\s+/g," ").trim())).join("\n");
      return [h,t2].filter(Boolean).join("\n\n"); };
    const pl=await buildTextPayload(c,p,{timing:false});
    const _b=pl.blocks||{}, keep={};
    ["world","relationships","scenario","feelings","feelings_now","distant_memories","latest_arcs","scene_now","trackers",
     "promises","promises_ended","whereabouts","calendar_done","quests","speaking_style"].forEach(k=>{ if(typeof _b[k]==="string"&&_b[k].trim())keep[k]=_b[k]; });
    const want=oldJoin(keep), got=textContextJoin(keep);
    /* a head section repeated in the tail is dropped, as before */
    const dup={world:"# UNIVERSE SETTING\nA small town by the sea, where everyone knows everyone else.",scene_now:"# UNIVERSE SETTING\nA small town by the sea, where everyone knows everyone else.\n# SCENE RIGHT NOW\nDay 1."};
    /* and the real thing: what maybeProactiveText sends */
    Object.assign(state,{textsOn:true,key:"k",textGateOn:false});
    c.gameDay=2; c.period="Evening";
    state.memory=[{id:"mb",ownerId:"p_o",character:"Özlem",type:"EXPERIENCE",content:"Emre waved at me from the gate.",people:["Emre"],gameDay:2,gamePeriod:"Evening",universeId:"u1",chatId:c.id,importance:1}];
    __calls=[];
    await maybeProactiveText(c,{});
    const call=__calls.find(x=>/^Proactive text/.test(x.dbg));
    const sys=call?String((call.msgs.find(m=>m.role==="system")||{}).content||""):"";
    const pl2=await buildTextPayload(c,p,{timing:false}); const b2=pl2.blocks||{}, keep2={};
    ["world","relationships","scenario","feelings","feelings_now","distant_memories","latest_arcs","scene_now","trackers",
     "promises","promises_ended","whereabouts","calendar_done","quests","speaking_style"].forEach(k=>{ if(typeof b2[k]==="string"&&b2[k].trim())keep2[k]=b2[k]; });
    const want2=oldJoin(keep2);
    state.textsOn=false;
    return {same:want===got,want:want.slice(0,300),got:got.slice(0,300),n:Object.keys(keep).length,
      dupSame:oldJoin(dup)===textContextJoin(dup),dupOnce:(textContextJoin(dup).match(/# UNIVERSE SETTING/g)||[]).length,
      called:!!call,starts:!!want2&&sys.indexOf(want2+"\n\n---\n\n")===0,sys:sys.slice(0,300),want2:want2.slice(0,200)};
  });
  ok("the same blocks in the same order give the same text as the v150.64 join ("+P.n+" blocks)", P.same===true&&P.n>=3, JSON.stringify(P));
  ok("…deduped the same way (a head section repeated in the tail is sent once)", P.dupSame===true&&P.dupOnce===1, JSON.stringify(P));
  ok("maybeProactiveText sends that context, then the texter's prompt", P.called&&P.starts, JSON.stringify({called:P.called,sys:P.sys,want:P.want2}));

  console.log("\n[the Payloads screen]");
  const U=await pg.evaluate(()=>{
    __setup({present:["p_d"]});
    state.fragments=null; _fragDraft=null;
    renderPayloadList();
    const sg=document.getElementById('fragCard').closest('.sgbody');
    const txt=sg?sg.innerText:"";
    const eng=document.getElementById('engineTplList');
    const sw=eng?eng.querySelector('#payloadTplOn'):null;
    return {
      noClassic:!document.getElementById('payloadList')&&!document.getElementById('payloadTplList')&&!document.getElementById('classicPayloadDetails'),
      noAb:!document.getElementById('abHost'),
      noPlaceholderBtn:!/＋ Placeholder/.test(sg?sg.innerHTML:""),
      noSwitchInFrag:!document.getElementById('fragOnSw')&&!/Build replies from fragments/.test(txt),
      engSwitch:!!sw&&/Use my engine templates/.test(eng.innerText),
      engSwitchOnce:document.querySelectorAll('#payloadTplOn').length===1,
      pv:!!document.getElementById('fragPvKind')&&!!document.getElementById('fragPvBtn'),
      pvKinds:[...document.querySelectorAll('#fragPvKind option')].map(o=>o.textContent).join(","),
      other:!!document.querySelector('#otherWordingList details[data-ow="when"] textarea[data-btpl]'),
      dataBox:/Data you can call in a fragment/.test(document.getElementById('fragDataHost').innerText),
      noClassicWords:!/Classic layout|Write my own payload structure|Try two versions of a piece/.test(txt)};
  });
  ok("no classic part list, no reply templates (their hosts are gone)", U.noClassic===true, JSON.stringify(U));
  ok("no A/B panel, no \"＋ Placeholder\", and none of the old cards' words", U.noAb&&U.noPlaceholderBtn&&U.noClassicWords, JSON.stringify(U));
  ok("the fragments card has no on/off switch", U.noSwitchInFrag===true);
  ok("the engine templates' switch is in their card, worded \"Use my engine templates\"", U.engSwitch&&U.engSwitchOnce, JSON.stringify(U));
  ok("the preview: a path selector (Solo / Multi / Gamemaster / Text / Heat) and a Preview button", U.pv&&U.pvKinds==="Solo,Multi,Gamemaster,Text,Heat", U.pvKinds);
  ok("the other wording (outside the reply) is still editable, and the data a fragment can call is listed", U.other&&U.dataBox, JSON.stringify(U));
  const E=await pg.evaluate(()=>{
    const key="gm_judge"in ENGINE_PARTS?"gm_judge":Object.keys(ENGINE_PARTS)[0];
    const sw=document.querySelector('#engineTplList #payloadTplOn');
    sw.checked=false; sw.dispatchEvent(new Event('change'));
    const off={flag:state.payloadTplOn,stored:store.get(K.payloadTplOn,true),msgs:epMessages(key,"SYS",{})};
    sw.checked=true; sw.dispatchEvent(new Event('change'));
    ptSetTemplate(epTplKey(key),"[system]\n{{call//prompt}}\n[system end]\n\n[user]\nENGINE-TPL-MARK\n[user end]\n");   // an engine message needs a user part
    const on={flag:state.payloadTplOn,msgs:epMessages(key,"SYS",{})};
    ptSetTemplate(epTplKey(key),null);
    return {off:off.flag===false&&off.stored===false&&off.msgs===null, on:on.flag===true&&Array.isArray(on.msgs)&&JSON.stringify(on.msgs).indexOf("ENGINE-TPL-MARK")>=0, j:JSON.stringify({off,on}).slice(0,400)};
  });
  ok("the switch turns the engine templates off (standard payload) and on (the edited template is sent)", E.off&&E.on, E.j);

  console.log("\n[Preview the payload — each path, from the draft]");
  const V=await pg.evaluate(async()=>{
    const c=__setup({present:["p_d"],fragments:null});
    _fragDraft=null; renderPayloadList();
    /* an unsaved edit: the task fragment's main body, typed into its box */
    const ti=_fragDraftGet().findIndex(f=>f.id==="task");
    fragEdOpen(ti);
    const ta=document.querySelector(`textarea[data-fp="${ti}.text"]`);
    ta.value=ta.value+"\n\nUNSAVED-DRAFT-EDIT for {{char}}"; ta.dispatchEvent(new Event('input'));
    /* an asked option with no stored answer, and one stored answer for this character */
    c.emo={p_d:{asks:{q_talk_into__ask:0.95}}};
    const out={};
    for(const k of FRAG_PATHS){
      const sel=document.getElementById('fragPvKind'); sel.value=k; sel.dispatchEvent(new Event('change'));
      document.getElementById('fragPvBtn').click();
      const o=document.getElementById('fragPvOut');
      out[k]={draft:/UNSAVED-DRAFT-EDIT for Duygu/.test(o.innerText),readable:!!o.querySelector('.pvView .pvMsg'),green:!!o.querySelector('.pvd'),
        fired:(document.getElementById('fragPvFired')||{}).innerText||"",asked:(document.getElementById('fragPvAsked')||{}).innerText||"",
        label:new RegExp("The "+FRAG_PATH_LABEL[k]+" payload").test(o.innerText),mem:/Memories are left out/.test(o.innerText),
        heat:/beat 1 of 3|# HEAT|HEAT OF THE MOMENT/i.test(o.innerText)};
    }
    const saved=state.fragments;   // the draft was never saved
    return {out,saved,stored:store.raw(K.fragments,"")};
  });
  for(const k of ["solo","multi","gm","text","heat"]){
    const o=V.out[k]||{};
    ok(k+": the preview renders the "+k+" payload with the unsaved edit, in the readable coloured view", o.draft&&o.readable&&o.green&&o.label, JSON.stringify(o));
    ok(k+": …and lists the fragments that fired, and says memories are left out", /Fragments that sent something \(\d+\):/.test(o.fired)&&/Task/.test(o.fired)&&o.mem, o.fired.slice(0,300));
  }
  ok("the asked options are listed, a missing answer said to count as no, the stored one used", /No stored answer, so treated as no:/.test(V.out.solo.asked)&&/last ones stored for Duygu/.test(V.out.solo.asked), V.out.solo.asked);
  ok("an asked option answered yes (stored for her) fires and is listed with its answer", /asked: 95%/.test(V.out.solo.fired)||/Yes \(at least \d+% sure\): [^.]*95%/.test(V.out.solo.asked), V.out.solo.fired+" | "+V.out.solo.asked);
  ok("the heat preview is a heat payload (the heat beat is set as before)", V.out.heat.heat===true, JSON.stringify(V.out.heat));
  ok("previewing saves nothing", V.saved==null&&!V.stored, JSON.stringify({saved:!!V.saved,stored:V.stored}));

  console.log("\n[settings: old keys, and the fragments in a prompt pack]");
  const I=await pg.evaluate(async()=>{
    const realC=window.uiConfirm; window.uiConfirm=async()=>true;
    const keep={};["sm_payloadlayouts","sm_payloadremoved","sm_payloadtemplates","sm_payloadtplon","sm_fragments","sm_fragadds"].forEach(k=>{ keep[k]=localStorage.getItem(k); });
    let err="", res=null;
    try{ res=await importPromptsFile({app:"StoryMind",kind:"prompts",prompts:{},settings:{
      payloadLayouts:JSON.stringify({solo:["task","__history__"]}),payloadRemoved:JSON.stringify({solo:["rumors"]}),
      payloadTemplates:JSON.stringify({solo:"[system]\nOLD\n[system end]","eng:gm_judge":"{{call//prompt}}"}),payloadTplOn:"true",fragOn:"0",
      fragments:JSON.stringify([{id:"x",name:"X",seg:"head",paths:["solo"],text:"PACKED",options:[]}])}}); }catch(e){ err=e.message; }
    const after={tpl:localStorage.getItem("sm_payloadtemplates"),frag:localStorage.getItem("sm_fragments"),lay:localStorage.getItem("sm_payloadlayouts")};
    Object.keys(keep).forEach(k=>{ if(keep[k]==null)localStorage.removeItem(k); else localStorage.setItem(k,keep[k]); });
    window.uiConfirm=realC;
    return {err,res,after,packKeys:PROMPT_PACK_KEYS.filter(k=>/payload|frag/.test(k))};
  });
  ok("an old prompt pack (payloadLayouts, payloadRemoved, payloadTemplates, payloadTplOn, fragOn) imports without error", I.err===""&&I.res===true, JSON.stringify(I));
  ok("…its engine templates and switch are taken; the part order is not", /eng:gm_judge/.test(I.after.tpl||"")&&I.after.lay!==JSON.stringify({solo:["task","__history__"]}), JSON.stringify(I.after));
  ok("the fragments travel in a prompt pack now", /PACKED/.test(I.after.frag||"")&&I.packKeys.indexOf("fragments")>=0&&I.packKeys.indexOf("payloadLayouts")<0, JSON.stringify(I.packKeys));

  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close(); process.exit(fail?1:0);
})();
