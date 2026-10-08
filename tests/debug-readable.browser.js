/* v150.63 — DEBUG'S READABLE VIEW. "Readable" replaced "Capsules" in the Debug list: a chat payload is one block per
   message with a bold badge, headings bold, and its text coloured by where it came from — white the fixed wording,
   green the live data ({{call//…}} values, {{value}} fills, the conversation), red what the decision model chose (an
   option whose ask passed, or whose condition reads a decision-made flag such as the emotion). Checked here:
     • a reply payload built through the fragment model, sent through chatCompletion, reads that way in Debug;
     • what is sent carries no marker and is exactly the payload built with the annotation pass switched off, and
       chatCompletion strips a stray marker as the last line of defence; the export stays the clean payload;
     • a stored "capsules" choice shows Readable; copy in Readable gives plain text, then the response;
     • a Decisions request reads as its state and its questions; a payload with no annotation still reads
       (system white, the conversation green); the Payloads preview uses the same renderer;
     • at 412px nothing scrolls sideways.
   Run: node tests/debug-readable.browser.js */
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:process.env.SM_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage({viewport:{width:412,height:915},deviceScaleFactor:2});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file://'+require('path').resolve(__dirname,'..','index.html')); await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(900);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x===undefined?c:x).slice(0,700));} };

  await pg.evaluate(()=>{
    window.__setup=()=>{
      const uni=state.universes[0];
      state.personas=[{id:"p_a",name:"Ayla",universeId:uni.id,personality:"Proud and quick to bristle",look:{},style:"s"},
                      {id:"p_b",name:"Berk",universeId:uni.id,personality:"x",look:{},style:"s"}];
      state.user="Emre"; state.payloadTplOn=false; state.fragments=null; state.fragAt=0.7;
      const c=curChat(); Object.assign(c,{universeId:uni.id,presentIds:["p_a","p_b"],
        // the emotion pick (a decision) and one answered ask: the say-no "past she does not have" option
        emo:{p_a:{emotion:"Anger",intensity:"intense",tone:"furious",ego:"id_ahead",asks:{"q_say_no__unknown_past":0.9}}},
        messages:[{mid:"u1",role:"user",content:'"Hi."'},{mid:"a1",role:"assistant",speaker:"Ayla",speakerId:"p_a",content:'"Hello."',replyFlags:[]},
          {mid:"u2",role:"user",content:'"So?"'}]});
      return c; };
    window.__build=()=>{
      const c=__setup(), p=state.personas[0];
      const hb=buildCharPromptBlocks(p,[state.personas[1]],{recent:[],diary:[],longterm:[]},"Emre",{chat:c,targetName:"Emre",targetId:"__user__"});
      const tb=buildTailBlocks({chat:c,selfP:p,selfId:p.id,selfName:p.name,targetName:"Emre",targetId:"__user__",injected:{recent:[],diary:[],longterm:[]}});
      const B=Object.assign({},hb,tb);
      const hist=[{role:"user",content:'"Hi."'},{role:"assistant",content:'"Hello."'}];
      return ptBuildMessages("solo",B,hist,{chat:c,npc:p,targetName:"Emre"},()=>B);
    };
    state.key="test-key";
    window.__sent=[];
    window.fetch=async(url,init)=>{
      window.__sent.push(String(init&&init.body||""));
      const j={choices:[{message:{content:'"Fine. Sit down."'},finish_reason:"stop"}]};
      return {ok:true,status:200,json:async()=>j,text:async()=>JSON.stringify(j),clone(){ return this; },headers:{get:()=>null}};
    };
    window.__clip=null;
    try{ Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async t=>{ window.__clip=t; }}}); }catch(e){}
  });

  console.log("\n[what is sent is untouched]");
  const S=await pg.evaluate(async()=>{
    const MK=/[\uE000-\uE003]/;
    const built=__build();
    // the same build with the annotation pass switched off: fragCompile and ptExpand never see the flag
    const fc=fragCompile, pe=ptExpand, pr=pvRemember;
    fragCompile=(k,f,a)=>fc(k,f,a); ptExpand=(t,s,v,r)=>pe(t,s,v,r); pvRemember=()=>{};
    let off; try{ off=__build(); } finally{ fragCompile=fc; ptExpand=pe; pvRemember=pr; }
    const ann=pvAnnotList(built);
    window.__sent=[];
    await chatCompletion(built,"x/y",{rp:true,dbg:"Roleplay reply"});
    const wire=window.__sent[0]||"";
    const body=JSON.parse(wire||"{}");
    // a stray marker handed to chatCompletion directly is taken off before the request leaves
    window.__sent=[];
    await chatCompletion([{role:"system",content:"A \uE000marked\uE001 \uE002line\uE003."},{role:"user",content:"hi"}],"x/y",{dbg:"stray marker"});
    const stray=window.__sent[0]||"";
    return {n:built.length,same:JSON.stringify(built)===JSON.stringify(off),mk:built.some(m=>MK.test(m.content)),
      wireMk:MK.test(wire),wireSame:JSON.stringify(body.messages)===JSON.stringify(built),
      annotated:!!ann&&ann.filter(Boolean).length, annStrips:!!ann&&ann.every((a,i)=>!a||a.replace(/[\uE000-\uE003]/g,"")===built[i].content),
      annHasMk:!!ann&&ann.some(a=>a&&MK.test(a)),
      strayMk:MK.test(stray), strayText:(JSON.parse(stray||"{}").messages||[{}])[0].content};
  });
  ok("the reply payload is built through the fragment model (system, the history, the user tail)", S.n===4, S.n);
  ok("the built messages carry no marker", S.mk===false);
  ok("…and are exactly the payload built with the annotation pass switched off", S.same===true);
  ok("the request on the wire carries no marker and is that payload", S.wireMk===false&&S.wireSame===true);
  ok("an annotated copy exists for the built messages, and stripped it is the sent text", S.annotated>=2&&S.annStrips===true&&S.annHasMk===true, JSON.stringify(S));
  ok("chatCompletion takes a stray marker off before sending", S.strayMk===false&&S.strayText==="A marked line.", S.strayText);

  console.log("\n[Readable in Debug]");
  const R=await pg.evaluate(()=>{
    store.setRaw(K.dbgView,"readable");
    show('debug'); renderDebug();
    const card=[...document.querySelectorAll('#screen-debug .card')].find(c=>/Roleplay reply/.test(c.textContent));
    card.querySelector('[data-arrow]').click();
    const host=card.querySelector('[data-payload]');
    const col=v=>{ const d=document.createElement('span'); d.style.color=v; document.body.appendChild(d); const c=getComputedStyle(d).color; d.remove(); return c; };
    const WHITE=col("var(--text)"), GREEN=col("var(--good)"), RED=col("var(--danger)");
    const spans=[...host.querySelectorAll('pre span')];
    const find=(re,cls)=>spans.find(s=>re.test(s.textContent)&&(!cls||s.classList.contains(cls)));
    const colorOf=el=>el?getComputedStyle(el).color:null;
    const bold=el=>!!el&&+getComputedStyle(el).fontWeight>=700;
    const pres=[...host.querySelectorAll('pre')];
    const badges=[...host.querySelectorAll('.pvBadge')].map(x=>({t:x.textContent.trim(),bold:bold(x.querySelector('b'))}));
    const task=[...host.querySelectorAll('.pvH')].find(x=>/^# TASK$/.test(x.textContent));
    const emoHead=[...host.querySelectorAll('.pvH')].find(x=>/YOUR EMOTION — YOU SHOW/.test(x.textContent));
    const askSpan=find(/it has not happened for you/);
    const nameSpan=pres[0]&&[...pres[0].querySelectorAll('span')].find(s=>s.textContent==="Ayla");
    const fixedSpan=find(/you act as the person you are in this exact moment/);
    const histSpan=pres[1]&&pres[1].querySelector('span');
    const egoSpan=find(/want is ahead of your conscience/);
    const legend=(host.querySelector('.pvLegend')||{}).textContent||"";
    return {WHITE,GREEN,RED,badges,legend,
      label:card.querySelector('label').textContent,
      task:!!task&&bold(task)&&[...task.querySelectorAll('span')].every(s=>colorOf(s)===WHITE),
      emoHead:!!emoHead&&bold(emoHead)&&[...emoHead.querySelectorAll('span')].every(s=>colorOf(s)===RED),
      ask:colorOf(askSpan), name:colorOf(nameSpan), fixed:colorOf(fixedSpan), hist:colorOf(histSpan), histText:histSpan&&histSpan.textContent, ego:colorOf(egoSpan),
      noMk:!/[\uE000-\uE003]/.test(host.textContent),
      wide:{doc:document.scrollingElement.scrollWidth, pre:pres.map(p=>p.scrollWidth-p.clientWidth).filter(x=>x>1).length}};
  });
  ok("the label says Readable", /Readable/.test(R.label), R.label);
  ok("the legend line", R.legend.trim()==="white: fixed wording · green: live data · red: chosen by the decision model", R.legend);
  ok("one bold badge per message: system, user, assistant, user", R.badges.length===4&&R.badges.every(x=>x.bold)
     &&R.badges.map(x=>x.t).join("|")==="message 1 — system|message 2 — user|message 3 — assistant|message 4 — user", JSON.stringify(R.badges));
  ok("a heading is bold, and fixed wording is white (# TASK)", R.task===true);
  ok("fixed wording of a main body is white", R.fixed===R.WHITE, R.fixed+" vs "+R.WHITE);
  ok("a {{value}} filled in (the character's name) is green", R.name===R.GREEN, R.name+" vs "+R.GREEN);
  ok("a conversation turn is green", R.hist===R.GREEN&&R.histText==='"Hi."', R.hist+" "+R.histText);
  ok("an option chosen by the emotion (a decision-made flag) is red, its heading bold", R.emoHead===true);
  ok("an option chosen by the ego pick is red", R.ego===R.RED, R.ego);
  ok("an option whose ask the decision model answered is red", R.ask===R.RED, R.ask+" vs "+R.RED);
  ok("no marker is ever shown", R.noMk===true);
  ok("412px: no sideways scroll on the page or in a block", R.wide.doc<=412&&R.wide.pre===0, JSON.stringify(R.wide));

  ok("data inside a red option stays green; a marked heading takes its '# ' along", await pg.evaluate(()=>{
      const h=pvTextHtml("# "+PV_R0+"HEAD"+PV_R1+"\n"+PV_R0+"say "+PV_D0+"Ayla"+PV_D1+" now"+PV_R1,"");
      return (/<b class="pvH"><span class="pvr"># <\/span><span class="pvr">HEAD<\/span><\/b>/.test(h)&&/<span class="pvr">say <\/span><span class="pvd">Ayla<\/span><span class="pvr"> now<\/span>/.test(h))?true:h; }));

  console.log("\n[copy, the stored choice, other payloads]");
  const C=await pg.evaluate(async()=>{
    const card=[...document.querySelectorAll('#screen-debug .card')].find(c=>/Roleplay reply/.test(c.textContent));
    const btn=card.querySelector('[data-copy]'); const label=btn.textContent;
    window.__clip=null; btn.click(); await new Promise(r=>setTimeout(r,50));
    return {label,clip:window.__clip||""};
  });
  ok("the copy button says text in Readable", /Copy text \+ response/.test(C.label), C.label);
  ok("copy gives the readable plain text: each message under its badge, no HTML, no marker", /^=== message 1 — system ===\nYou are Ayla\./.test(C.clip.split("\n").slice(1).join("\n"))||/=== message 1 — system ===\nYou are Ayla\./.test(C.clip), C.clip.slice(0,200));
  ok("…with no markup or marker, all four messages, then the response", !/<span|<b|<pre|[\uE000-\uE003]/.test(C.clip)&&(C.clip.match(/^=== message \d — /gm)||[]).length===4
     &&/\n\n=== RESPONSE \(ok\) ===\n"Fine\. Sit down\."$/.test(C.clip), C.clip.slice(-200));
  const A=await pg.evaluate(async()=>{
    setDbgView('sent');
    const card=[...document.querySelectorAll('#screen-debug .card')].find(c=>/Roleplay reply/.test(c.textContent));
    window.__clip=null; card.querySelector('[data-copy]').click(); await new Promise(r=>setTimeout(r,50));
    let j=null; try{ j=JSON.parse(window.__clip); }catch(e){}
    return {label:card.querySelector('[data-copy]').textContent, ok:!!(j&&Array.isArray(j.messages)&&j.response==='"Fine. Sit down."')};
  });
  ok("As sent still copies the JSON with the response inside", A.ok===true&&/Copy JSON \+ response/.test(A.label), A.label);

  const Q=await pg.evaluate(()=>{
    store.setRaw(K.dbgView,"capsules");   // a choice stored before Readable existed
    renderDebug();
    const card=[...document.querySelectorAll('#screen-debug .card')].find(c=>/Roleplay reply/.test(c.textContent));
    const on=[...card.querySelectorAll('[data-dbgview]')].filter(x=>x.className.indexOf('on')>-1).map(x=>x.dataset.dbgview);
    return {mode:dbgViewMode(),label:card.querySelector('label').textContent,on,view:!!card.querySelector('[data-payload] .pvView'),
            caps:[...card.querySelectorAll('[data-dbgview]')].some(x=>/capsule/i.test(x.textContent))};
  });
  ok("a stored 'capsules' choice shows Readable", Q.mode==="readable"&&/Readable/.test(Q.label)&&Q.on.join()==="readable"&&Q.view===true&&Q.caps===false, JSON.stringify(Q));

  const D=await pg.evaluate(()=>{
    const e=dbg("Reply decisions · Ayla","OpenRouter Decisions","https://x/decisions",
      {model:"dm",state:{character:{name:"Ayla",personality:"Proud"},scene:"A café at noon.\nTwo tables taken."},
       questions:{emotion:{type:"choice",instructions:"Which feeling is Ayla in?",criteria:{anger:"Anger: hot and quick"}}}});
    dbgDone(e,"ok",{emotion:"anger"});
    const f=dbg("Hand-built","OpenRouter","https://x/chat",{model:"x",messages:[{role:"system",content:"# RULES\nBe brief."},{role:"user",content:"Hello there."}]});
    dbgDone(f,"ok","Hi.");
    renderDebug();
    const open=lbl=>{ const c=[...document.querySelectorAll('#screen-debug .card')].find(x=>x.textContent.indexOf(lbl)>-1); c.querySelector('[data-arrow]').click(); return c.querySelector('[data-payload]'); };
    const d=open("Reply decisions"), h=open("Hand-built");
    const col=v=>{ const s=document.createElement('span'); s.style.color=v; document.body.appendChild(s); const c=getComputedStyle(s).color; s.remove(); return c; };
    const heads=[...d.querySelectorAll('.pvH')].map(x=>x.textContent);
    const ayla=[...d.querySelectorAll('span')].find(s=>s.textContent==="Ayla");
    const hs=[...h.querySelectorAll('pre')];
    return {text:d.textContent, heads, aylaGreen:!!ayla&&getComputedStyle(ayla).color===col("var(--good)"),
      sysWhite:!!hs[0]&&[...hs[0].querySelectorAll('span')].every(s=>getComputedStyle(s).color===col("var(--text)")),
      sysBold:!!hs[0]&&!!hs[0].querySelector('.pvH'),
      userGreen:!!hs[1]&&getComputedStyle(hs[1].querySelector('span')).color===col("var(--good)")};
  });
  ok("a Decisions request: the state as indented key: value lines, values green", /character:\n {4}name: Ayla\n {4}personality: Proud/.test(D.text)&&D.aylaGreen===true, D.text.slice(0,300));
  ok("…and each question with its instructions and criteria, headings bold", D.heads.join("|")==="# STATE|# QUESTIONS|## emotion — choice"&&/Which feeling is Ayla in\?/.test(D.text)&&/criteria:\n {2}anger: Anger: hot and quick/.test(D.text), JSON.stringify(D.heads));
  ok("a payload with no annotation: system white with its heading bold, the conversation green", D.sysWhite===true&&D.sysBold===true&&D.userGreen===true, JSON.stringify(D));

  const X=await pg.evaluate(async()=>{
    let blob=null; const cu=URL.createObjectURL, ck=HTMLAnchorElement.prototype.click;
    URL.createObjectURL=b=>{ blob=b; return "blob:x"; }; HTMLAnchorElement.prototype.click=function(){};
    try{ exportDebug(); } finally{ URL.createObjectURL=cu; HTMLAnchorElement.prototype.click=ck; }
    const t=blob?await blob.text():"";
    return {has:!!t, annot:/"annot"/.test(t), mk:/[\uE000-\uE003]|\\ue00[0-3]/i.test(t)};
  });
  ok("the debug export stays the clean payload (no annotation, no marker)", X.has&&!X.annot&&!X.mk, JSON.stringify(X));

  console.log("\n[the Payloads preview reads the same]");
  const P=await pg.evaluate(()=>{
    __setup();
    /* v150.66 — the Payloads preview is the Reply fragments card's "Preview the payload" (fragPreview) */
    let box=document.getElementById('fragPvHost'), made=false;
    if(!box){ box=document.createElement('div'); box.id="fragPvHost"; document.body.appendChild(box); made=true; }
    curChat().messages.forEach(m=>{ m.present=["p_a","p_b"]; });   // heard by both, so the preview's real history has the lines
    _fragDraft=null; renderFragPreviewBox(); fragPreview("solo");
    const host=document.getElementById('fragPvOut');
    const r={view:!!host.querySelector('.pvView'),legend:!!host.querySelector('.pvLegend'),red:host.querySelectorAll('pre .pvr').length,
      green:host.querySelectorAll('pre .pvd').length,bold:host.querySelectorAll('.pvBadge b').length,mk:/[\uE000-\uE003]/.test(host.textContent)};
    if(made)box.remove(); else host.innerHTML=""; return r;
  });
  ok("the fragment preview uses the same renderer, with colours", P.view&&P.legend&&P.red>0&&P.green>0&&P.bold>=3&&!P.mk, JSON.stringify(P));
  ok("engine preview too", await pg.evaluate(()=>{ const k=Object.keys(ENGINE_PARTS)[0]; let host=document.getElementById("epPrev_"+k), made=false;
      if(!host){ host=document.createElement('div'); host.id="epPrev_"+k; document.body.appendChild(host); made=true; }
      state.payloadTplOn=false; epPreview(k); const r=!!host.querySelector('.pvView .pvLegend')&&!/[\uE000-\uE003]/.test(host.textContent), html=host.innerHTML.slice(0,300);
      if(made)host.remove(); else host.innerHTML=""; return r?true:html; }));

  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close(); process.exit(fail?1:0);
})();
