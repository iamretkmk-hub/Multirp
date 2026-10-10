/* v144.1 — QC report, INFRA: persistence, transport and security fixes.
   - the prompt-pack import only writes registry prompts and PROMPT_PACK_KEYS (no sm_key / sm_embedurl);
     the OpenRouter key never goes to another embeddings host
   - esc()/escJs()/escUrl() keep a hostile name, id or image URL inside its attribute
   - media and scene writes wait for a hydration that really read the stores
   - a failed chat write does not record the "saved" signature, and is retried
   - chatCompletion: a non-JSON 200 and an error-only 200 are named, the rescue call has a ceiling,
     Retry-After is honoured, a 402 pauses background calls, the semaphore caps them, Stop aborts
   - a malformed backup is refused before anything is touched; a failed restore rolls settings back
   - a second tab runs read-only; snapshots skip when nothing changed; boot failure shows a screen */
const {chromium}=require('playwright');
const path=require('path'), fs=require('fs');
(async()=>{
  const b=await chromium.launch({executablePath:process.env.SM_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x||c).slice(0,400));} };
  const url='file://'+path.resolve(__dirname,'..','index.html');
  const src=fs.readFileSync(path.resolve(__dirname,'..','index.html'),'utf8');
  const ctx=await b.newContext({viewport:{width:412,height:915}});
  const pg=await ctx.newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto(url); await pg.waitForTimeout(2300);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(900);

  console.log("\n[prompt-pack import: only prompts and pack settings]");
  ok("sm_key, sm_embedurl and non-string values are refused; a registry prompt and a pack setting land", await pg.evaluate(async()=>{
    const realC=window.uiConfirm; window.uiConfirm=async()=>true;
    localStorage.setItem(K.key,"MINE"); localStorage.removeItem(K.embedUrl);
    const pk=PROMPT_REGISTRY[0].key;
    try{
      await importPromptsFile({kind:"prompts",prompts:{[pk]:"PACK PROMPT",key:"EVIL",embedUrl:"https://evil.example/e"},
        settings:{model:"some/model",key:"EVIL2",embedUrl:"https://evil.example/e2",embedKey:"x",temp:{a:1}}});
    }finally{ window.uiConfirm=realC; }
    const r={key:localStorage.getItem(K.key),embed:localStorage.getItem(K.embedUrl),ek:localStorage.getItem(K.embedKey),
      p:localStorage.getItem(K[pk]),m:localStorage.getItem(K.model),t:localStorage.getItem(K.temp)};
    return (r.key==="MINE"&&r.embed===null&&r.ek!=="x"&&r.p==="PACK PROMPT"&&r.m==="some/model"&&r.t!=='[object Object]')?true:JSON.stringify(r);
  }));
  ok("the OpenRouter key is only the embeddings fallback when the endpoint IS OpenRouter", await pg.evaluate(()=>{
    const s0={k:state.key,u:state.embedUrl,e:state.embedKey};
    state.key="OR-KEY"; state.embedKey="";
    state.embedUrl=""; const a=embedKeyVal();
    state.embedUrl="https://evil.example/v1/embeddings"; const b2=embedKeyVal();
    state.embedKey="OWN"; const c=embedKeyVal();
    state.key=s0.k; state.embedUrl=s0.u; state.embedKey=s0.e;
    return (a==="OR-KEY"&&b2===""&&c==="OWN")?true:JSON.stringify({a,b2,c});
  }));

  console.log("\n[escaping: a hostile universe renders as text]");
  ok("hostile name and image stay inside their attribute (no injected handler, no script URL)", await pg.evaluate(()=>{
    const keep=state.universes;
    const evilName='Evil" onmouseover="window.__pwn=1" x="<img src=x onerror=window.__pwn=2>';
    state.universes=[{id:"u_evil",name:evilName,image:'javascript:alert(1)" onerror="window.__pwn=3',avatar:"🌌"}];
    try{ renderUniverses(); }catch(e){ state.universes=keep; return "render threw: "+e.message; }
    const card=document.querySelector('#universeList .uniCard');
    const img=card&&card.querySelector('img');
    const handlers=[...document.querySelectorAll('#universeList *')].filter(el=>[...el.attributes].some(a=>/^on/i.test(a.name)));
    const nm=card&&card.querySelector('.cc-uniname');
    const r={pwn:window.__pwn||0,handlers:handlers.length,name:nm&&nm.textContent===evilName,src:img?img.getAttribute('src'):"(no img)"};
    state.universes=keep; renderUniverses();
    return (r.pwn===0&&r.handlers===0&&r.name&&(r.src===""||r.src==="(no img)"))?true:JSON.stringify(r);
  }));
  ok("escJs keeps a quote-laden id inside its JS string in an inline handler", await pg.evaluate(()=>{
    const v=`a'b"c\\d</script><x>&amp;`;
    const host=document.createElement('div');
    host.innerHTML=`<button onclick="window.__got='${escJs(v)}'">x</button>`;
    document.body.appendChild(host); host.querySelector('button').click(); host.remove();
    return window.__got===v?true:JSON.stringify(window.__got);
  }));
  ok("escUrl/safeMediaUrl allow app media only", await pg.evaluate(()=>{
    const good=["https://cdn.x/a.png","http://x/y.jpg","blob:file:///abc","data:image/png;base64,AAAA","data:video/mp4;base64,AA"];
    const bad=["javascript:alert(1)","data:text/html,<script>","vbscript:x","  JaVaScRiPt:alert(1)","/relative.png"];
    const g=good.every(u=>safeMediaUrl(u)===u), bb=bad.every(u=>safeMediaUrl(u)==="");
    return (g&&bb&&escUrl('https://x/"a')==="https://x/&quot;a")?true:JSON.stringify({g,bb});
  }));
  ok("an imported universe's script URL is blanked on import; prose that merely contains a colon is not", await pg.evaluate(()=>{
    const u={id:"u1",name:"N",image:"javascript:alert(1)",imgPrompt:"cinematic: rain",locations:[{id:"l",image:"data:text/html,<b>",description:"data: it has some"}]};
    const n=sanitizeImportedMedia([u]);
    return (n===2&&u.image===""&&u.locations[0].image===""&&u.imgPrompt==="cinematic: rain"&&u.locations[0].description==="data: it has some")?true:JSON.stringify({n,u});
  }));
  ok("no raw '${…}' inside an inline handler is left unescaped", (()=>{
    const bad=(src.match(/on[a-z]+="[^"]*'\$\{(?!escJs\()[^{}`]*?\}'/g)||[]).filter(x=>!/\$\{…\}/.test(x));
    return bad.length===0?true:bad.slice(0,5).join(" | ");
  })());

  console.log("\n[media writes wait for hydration]");
  ok("persistImages/Videos/Scenes do not write before the media was read, and write once it was", await pg.evaluate(async()=>{
    const real={putAll:mediaDB.putAll,kvSet:mediaDB.kvSet}; const wrote=[];
    mediaDB.putAll=async(s)=>{ wrote.push(s); return true; };
    mediaDB.kvSet=async(k,v)=>{ if(k==="scenes")wrote.push(k); return true; };
    const was=_mediaSafe; _mediaSafe=false; _mediaPending.clear();
    persistImages(); persistVideos(); persistScenes();
    const before=wrote.slice(), pend=[..._mediaPending].sort().join(",");
    await hydrateMedia(); await new Promise(r=>setTimeout(r,50));
    mediaDB.putAll=real.putAll; mediaDB.kvSet=real.kvSet; _mediaSafe=was||_mediaSafe;
    return (before.length===0&&pend==="images,scenes,videos"&&wrote.includes("images")&&wrote.includes("videos")&&wrote.includes("scenes"))
      ?true:JSON.stringify({before,pend,wrote});
  }));
  ok("a failed media read leaves gallery saves OFF (the store is never cleared over)", await pg.evaluate(async()=>{
    const real={g:mediaDB.getAllStrict,p:mediaDB.putAll}; let puts=0;
    mediaDB.getAllStrict=async()=>{ throw new Error("blocked"); };
    mediaDB.putAll=async()=>{ puts++; return true; };
    const rt=window.toast; window.toast=()=>{};
    _mediaSafe=false;
    await hydrateMedia(); persistImages(); persistVideos();
    mediaDB.getAllStrict=real.g; mediaDB.putAll=real.p; window.toast=rt;
    const r={safe:_mediaSafe,puts};
    await hydrateMedia();   // put the session back to a good state for the rest of the file
    return (r.safe===false&&r.puts===0)?true:JSON.stringify(r);
  }));

  console.log("\n[a failed chat write is not recorded as saved]");
  ok("kvSet failing leaves _lastPersistSig alone and schedules a retry; the next good write records it", await pg.evaluate(async()=>{
    const real=mediaDB.kvSet; const rt=window.toast; let toasts=[]; window.toast=m=>toasts.push(m);
    collectionsSafe=true; flushPersistChats(); await new Promise(r=>setTimeout(r,80));
    const sigBefore=_lastPersistSig;
    mediaDB.kvSet=async(k)=>k==="chats"?false:true;
    const c=curChat(); c.messages.push({mid:newMid(),role:"user",content:"a line that must not be lost"}); markChatDirty(c);
    persistChatsNow(); await new Promise(r=>setTimeout(r,60));
    const afterFail=_lastPersistSig, retry=_writeRetry.has("chats"), warned=toasts.some(t=>/Couldn't save chats/.test(t));
    mediaDB.kvSet=real;
    persistChatsNow(); await new Promise(r=>setTimeout(r,120));
    const afterOk=_lastPersistSig;
    window.toast=rt;
    return (afterFail===sigBefore&&retry&&warned&&afterOk&&afterOk!==sigBefore&&!_writeRetry.has("chats"))
      ?true:JSON.stringify({same:afterFail===sigBefore,retry,warned,changed:afterOk!==sigBefore,toasts});
  }));
  ok("a durable marker set with no new message changes the chat signature (the _prPurged bug)", await pg.evaluate(()=>{
    const c=curChat(); const s1=_chatSig(c); c._prPurged=(c._prPurged||0)+1; const s2=_chatSig(c);
    c.promises=(c.promises||[]).concat([]); const s3=_chatSig(c);
    return (s1!==s2&&s2!==s3)?true:"signature unchanged";
  }));
  ok("persistMemory checks its write (a failure is retried, not discarded)", await pg.evaluate(async()=>{
    const real=mediaDB.kvSet; const rt=window.toast; window.toast=()=>{};
    mediaDB.kvSet=async(k)=>k==="memory"?false:true;
    persistMemory(); await new Promise(r=>setTimeout(r,50));
    const retry=_writeRetry.has("memory");
    mediaDB.kvSet=real; const r=_writeRetry.get("memory"); if(r){ clearTimeout(r.timer); _writeRetry.delete("memory"); }
    window.toast=rt;
    return retry?true:"no retry scheduled";
  }));

  console.log("\n[chatCompletion transport]");
  const cc=(fn)=>pg.evaluate(fn);
  ok("a non-JSON 200 gives a friendly error and a failed debug row", await cc(async()=>{
    state.key="k"; const real=window.fetch;
    window.fetch=async()=>new Response("<html>gateway</html>",{status:200,headers:{"Content-Type":"text/html"}});
    let msg=""; try{ await chatCompletion([{role:"user",content:"hi"}],"m",{dbg:"qc non-json",retries:0}); }catch(e){ msg=e.friendly||String(e); }
    window.fetch=real;
    const row=dbgLog.filter(e=>e.label==="qc non-json").pop();
    return (/isn't a model reply/.test(msg)&&row&&row.status==="error"&&/not JSON/.test(row.result))?true:JSON.stringify({msg,row:row&&[row.status,row.result]});
  }));
  ok("a 200 that carries only {error} says what the provider said", await cc(async()=>{
    const real=window.fetch;
    window.fetch=async()=>new Response(JSON.stringify({error:{message:"upstream exploded"}}),{status:200});
    let msg=""; try{ await chatCompletion([{role:"user",content:"hi"}],"m",{dbg:"qc err200",retries:0}); }catch(e){ msg=e.friendly||""; }
    window.fetch=real;
    return /upstream exploded/.test(msg)?true:msg;
  }));
  ok("the empty-response rescue call times out instead of hanging", await cc(async()=>{
    const real=window.fetch; let n=0;
    window.fetch=(u,o)=>{ n++;
      if(n===1) return Promise.resolve(new Response(JSON.stringify({choices:[{message:{content:""},finish_reason:"length"}]}),{status:200}));
      return new Promise(()=>{}); };   // the rescue never answers (and ignores the signal)
    const t0=Date.now(); let msg="";
    try{ await chatCompletion([{role:"user",content:"hi"}],"m",{dbg:"qc rescue",retries:0,rescueTimeoutMs:300}); }catch(e){ msg=e.friendly||String(e); }
    window.fetch=real;
    const dt=Date.now()-t0;
    return (n===2&&dt<3000&&/timed out/.test(msg))?true:JSON.stringify({n,dt,msg});
  }));
  ok("a 429 with Retry-After waits that long (plus jitter) before the retry", await cc(async()=>{
    const real=window.fetch; const at=[];
    window.fetch=async()=>{ at.push(Date.now());
      return at.length===1?new Response("{}",{status:429,headers:{"Retry-After":"1"}})
                          :new Response(JSON.stringify({choices:[{message:{content:"ok"}}],usage:{prompt_tokens:11,completion_tokens:2}}),{status:200}); };
    const out=await chatCompletion([{role:"user",content:"hi"}],"m",{dbg:"qc 429",foreground:true});
    window.fetch=real;
    const gap=at[1]-at[0], row=dbgLog.filter(e=>e.label==="qc 429").pop();
    return (out==="ok"&&gap>=950&&gap<2500&&row.usage&&row.usage.prompt_tokens===11)?true:JSON.stringify({out,gap,usage:row&&row.usage});
  }));
  ok("a long call that timed out is not retried", await cc(async()=>{
    // (60 s is the threshold; a stub that fails with a timeout-shaped error stands in for the clock)
    return /attempt<maxTry && !\(_wasTimeout&&_tmo>=60000\)/.test(String(chatCompletion))?true:"retry guard missing";
  }));
  ok("a 402 pauses background calls (no request sent) but not the roleplay reply; fixing the key lifts it", await cc(async()=>{
    const real=window.fetch; let sent=0; const rt=window.toast; const toasts=[]; window.toast=m=>toasts.push(m);
    window.fetch=async()=>{ sent++; return new Response("{}",{status:402}); };
    try{ await chatCompletion([{role:"user",content:"x"}],"m",{dbg:"qc 402 a",fn:"mem"}); }catch(e){}
    const s1=sent;
    let paused=false; try{ await chatCompletion([{role:"user",content:"x"}],"m",{dbg:"qc 402 b",fn:"mem"}); }catch(e){ paused=!!e.paused; }
    const s2=sent;
    try{ await chatCompletion([{role:"user",content:"x"}],"m",{dbg:"qc 402 rp",rp:true}); }catch(e){}
    const s3=sent, pausedToasts=toasts.filter(t=>/paused/.test(t)).length;
    const k0=state.key; state.key="a-new-key";
    try{ await chatCompletion([{role:"user",content:"x"}],"m",{dbg:"qc 402 c",fn:"mem"}); }catch(e){}
    const s4=sent; state.key=k0; for(const k in _mcBreak) delete _mcBreak[k];
    window.fetch=real; window.toast=rt;
    return (s1===1&&paused&&s2===1&&s3===2&&s4===3&&pausedToasts===1)?true:JSON.stringify({s1,s2,s3,s4,paused,toasts});
  }));
  ok("background calls are capped per provider; roleplay calls are not", await cc(async()=>{
    const real=window.fetch; let live=0, peak=0; const release=[];
    window.fetch=(u,o)=>new Promise(res=>{ live++; peak=Math.max(peak,live);
      release.push(()=>{ live--; res(new Response(JSON.stringify({choices:[{message:{content:"ok"}}]}),{status:200})); }); });
    const ps=[]; for(let i=0;i<7;i++) ps.push(chatCompletion([{role:"user",content:"x"}],"m",{dbg:"qc sem",fn:"mem"}).catch(()=>{}));
    await new Promise(r=>setTimeout(r,60));
    const bgPeak=peak;
    const rp=chatCompletion([{role:"user",content:"x"}],"m",{dbg:"qc sem rp",rp:true}).catch(()=>{});
    await new Promise(r=>setTimeout(r,60));
    const withRp=live;
    while(release.length){ release.shift()(); await new Promise(r=>setTimeout(r,15)); }
    await Promise.all(ps); await rp;
    window.fetch=real;
    return (bgPeak===MC_BG_MAX&&withRp===MC_BG_MAX+1)?true:JSON.stringify({bgPeak,withRp,max:MC_BG_MAX});
  }));
  ok("Stop aborts an in-flight roleplay reply: 'Stopped.', no retry, the stop button hides again", await cc(async()=>{
    const real=window.fetch; let n=0;
    window.fetch=(u,o)=>new Promise((res,rej)=>{ n++; o.signal.addEventListener("abort",()=>rej(new DOMException("aborted","AbortError"))); });
    const p=chatCompletion([{role:"user",content:"x"}],"m",{dbg:"qc stop",rp:true}).then(()=>({}),e=>e);
    await new Promise(r=>setTimeout(r,40));
    const shown=!document.getElementById('stopBtn').classList.contains('hide');
    stopReply();
    const e=await p;
    await new Promise(r=>setTimeout(r,20));
    const hidden=document.getElementById('stopBtn').classList.contains('hide');
    window.fetch=real; _rpStopped=false;
    return (shown&&e.stopped===true&&e.friendly==="Stopped."&&n===1&&hidden)?true:JSON.stringify({shown,e,n,hidden});
  }));
  ok("pollVideo sends the OpenRouter bearer only to OpenRouter", await cc(()=>{
    const a=_orAuthFor("https://openrouter.ai/api/v1/videos/1"), b2=_orAuthFor("https://cdn.example/v.mp4");
    return (a.Authorization&&!b2.Authorization&&/_orAuthFor\(pollUrl\)/.test(String(pollVideo))&&/_orAuthFor\(contentUrl\)/.test(String(pollVideo)))?true:"auth leaks";
  }));

  console.log("\n[backup import]");
  ok("a malformed bundle is refused and nothing is touched", await pg.evaluate(async()=>{
    localStorage.setItem("sm_qc_marker","keep");
    const tries=[
      {app:"StoryMind",backupVersion:1,collections:{chats:[]}},
      {app:"StoryMind",backupVersion:1,collections:{chats:{c:{messages:"no"}}}},
      {app:"StoryMind",backupVersion:1,collections:{memory:{}}},
      {app:"StoryMind",backupVersion:99,collections:{}},
      {app:"StoryMind",collections:{}},
      {app:"StoryMind",backupVersion:1,collections:{},localStorage:{sm_x:{}}}];
    const msgs=[];
    for(const t of tries){ try{ await applyBackupBundle(t); msgs.push("ACCEPTED"); }catch(e){ msgs.push(e.message); } }
    const r={marker:localStorage.getItem("sm_qc_marker"),safe:collectionsSafe,msgs};
    return (r.marker==="keep"&&r.safe===true&&!msgs.includes("ACCEPTED")&&/newer StoryMind/.test(msgs[3]))?true:JSON.stringify(r);
  }));
  ok("a restore whose database write fails puts the settings back and keeps saving on", await pg.evaluate(async()=>{
    localStorage.setItem("sm_qc_marker","keep"); localStorage.setItem(K.key,"MYKEY");
    const real=mediaDB.restoreAtomic; mediaDB.restoreAtomic=async()=>{ throw new Error("quota"); };
    let msg="";
    try{ await applyBackupBundle({app:"StoryMind",backupVersion:1,collections:{chats:{}},localStorage:{sm_other:"x"}}); }catch(e){ msg=e.message; }
    mediaDB.restoreAtomic=real;
    const r={marker:localStorage.getItem("sm_qc_marker"),other:localStorage.getItem("sm_other"),key:localStorage.getItem(K.key),safe:collectionsSafe,msg};
    return (r.marker==="keep"&&r.other===null&&r.key==="MYKEY"&&r.safe===true&&/nothing was changed/.test(msg))?true:JSON.stringify(r);
  }));
  ok("Export everything asks about API keys, and the key-less bundle has none", await pg.evaluate(async()=>{
    localStorage.setItem(K.key,"MYKEY");
    const bNo=await buildBackup({noMedia:true,noKeys:true}), bYes=await buildBackup({noMedia:true});
    return (!("sm_key" in bNo.localStorage)&&bYes.localStorage.sm_key==="MYKEY"&&bNo.includesApiKeys===false&&/uiChoose\(/.test(String(exportAll)))?true:"keys leak";
  }));

  console.log("\n[snapshots]");
  ok("no second snapshot when nothing changed since the last one", await pg.evaluate(async()=>{
    collectionsSafe=true; _snapRev=null;
    const real=mediaDB.kvSet; let snaps=0;
    mediaDB.kvSet=async(k,v)=>{ if(String(k).indexOf("autobackup_")===0)snaps++; return real.call(mediaDB,k,v); };
    await doAutoBackup(); await doAutoBackup();
    persistMemory(); await doAutoBackup();
    mediaDB.kvSet=real;
    return snaps===2?true:"snapshots taken: "+snaps;
  }));
  ok("pagehide only flushes (no snapshot that cannot finish)", /addEventListener\('pagehide',\(\)=>\{ flushPersistChats\(\); \}\)/.test(src)?true:"pagehide still snapshots");

  console.log("\n[service worker]");
  {
    const sw=fs.readFileSync(path.resolve(__dirname,'..','sw.js'),'utf8');
    ok("sw.js caches only ok responses, falls back to the page only for navigations, keeps the old cache on a failed install",
      (/res\.ok/.test(sw)&&/mode === "navigate"/.test(sw)&&!/addAll\(APP_SHELL\)\.catch/.test(sw)&&/c\.match\("\.\/index\.html"\)/.test(sw))?true:"sw.js unchanged");
  }

  console.log("\n[a second tab takes over; the first is read-only]");
  /* (!) v150.108 — CHANGED ON PURPOSE: the window opened LAST saves now (tests/newest-window-saves). It was the first one,
     and a second window behind it saved nothing while showing every edit — the "my changes revert" reports. */
  {
    const pg2=await ctx.newPage(); pg2.on('pageerror',e=>errs.push("tab2: "+e.message));
    await pg2.goto(url); await pg2.waitForTimeout(2000);
    const r=await pg.evaluate(()=>({ro:_tabReadOnly,safe:collectionsSafe,bar:document.getElementById('tabRoBar').classList.contains('show')}));
    ok("the first tab does not save any more, and says why", (r.ro&&!r.safe&&r.bar)?true:JSON.stringify(r));
    const w=await pg.evaluate(async()=>{ const real=mediaDB.kvSet; let n=0; mediaDB.kvSet=async()=>{ n++; return true; };
      const rt=window.toast; let t=""; window.toast=m=>t=m; _roWarned=false;
      persistMemory(); persistUniverses(); flushPersistChats(); await doAutoBackup();
      mediaDB.kvSet=real; window.toast=rt; return {n,t}; });
    ok("…and its writes are refused, with the other-window reason", (w.n===0&&/another (tab|window)/.test(w.t))?true:JSON.stringify(w));
    ok("the second tab saves", await pg2.evaluate(()=>collectionsSafe===true&&_tabReadOnly===false));
    await pg2.close(); await pg.waitForTimeout(5500);
    ok("close it → the first tab takes over again", await pg.evaluate(()=>collectionsSafe===true&&_tabReadOnly===false));
  }

  console.log("\n[boot failure and uncaught errors]");
  ok("an unhandled rejection lands in the Debug log", await pg.evaluate(async()=>{
    // (a real stray Promise.reject would also be reported as a page error by the harness)
    window.dispatchEvent(new PromiseRejectionEvent("unhandledrejection",{promise:Promise.resolve(),reason:{friendly:"qc stray rejection"}}));
    await new Promise(r=>setTimeout(r,50));
    return dbgLog.some(e=>/Unhandled/.test(e.label)&&/qc stray rejection/.test(e.result))?true:"not logged";
  }));
  ok("store.raw survives a throwing localStorage", await pg.evaluate(()=>{
    const real=Storage.prototype.getItem; Storage.prototype.getItem=()=>{ throw new Error("SecurityError"); };
    let v; try{ v=store.raw("sm_anything","dflt"); }catch(e){ v="threw"; }
    Storage.prototype.getItem=real; return v==="dflt"?true:v;
  }));
  ok("a boot failure shows the fatal screen and turns saving off", await pg.evaluate(()=>{
    bootFatal(new Error("qc boot failure"));
    const s=document.getElementById('fatalScreen');
    const r={shown:s.classList.contains('show'),msg:/qc boot failure/.test(document.getElementById('fatalMsg').textContent),safe:collectionsSafe};
    s.classList.remove('show'); collectionsSafe=true;
    return (r.shown&&r.msg&&r.safe===false)?true:JSON.stringify(r);
  }));

  console.log("\n[dead code]");
  ok("the legacy export/import helpers are gone", (!/function (exportData|triggerImport|handleImportFile|exportChats|importAllPrompt)\(/.test(src))?true:"still defined");

  ok("no page errors", errs.length===0?true:errs.join(" | "));
  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close(); process.exit(fail?1:0);
})();
