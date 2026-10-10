/* v146.1 — QC report #2, INFRA: persistence, transport and security fixes.
   - _gmPersistSoon (the delayed re-write after a byte capture) goes through the media gate: nothing is
     written after a failed gallery read or from a read-only tab
   - numbers that reach HTML (status day, map position, tracker min/max, stage thresholds, calendar
     day/probability) cannot carry markup, and an imported file's numeric fields are made numbers
   - the tab lock: the read-only tab that inherits the lock becomes the writer; 3 tabs end with one
     writer; a read-only tab writes no settings
   - the breaker: a 403 (moderation) is the call's own error; player-started calls are never paused and
     a success lifts the pause
   - _vidThumbHTML escapes once; write-failure counters are per key; an import always snapshots first
   - hostile message ids: escaped in markup, CSS-escaped in selectors, replaced on import and at boot
   - sw.js skips query-string copies; the remaining raw fetches have ceilings; CI pins Playwright */
const {chromium}=require('playwright');
const path=require('path'), fs=require('fs');
(async()=>{
  const b=await chromium.launch({executablePath:process.env.SM_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x||c).slice(0,500));} };
  const url='file://'+path.resolve(__dirname,'..','index.html');
  const src=fs.readFileSync(path.resolve(__dirname,'..','index.html'),'utf8');
  const PNG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const errs=[];
  const openIn=async(ctx,tag)=>{ const p=await ctx.newPage(); p.on('pageerror',e=>errs.push((tag||"")+e.message)); p.on('dialog',d=>d.dismiss());
    await p.goto(url); await p.waitForTimeout(2000); return p; };
  const onboard=async p=>{ await p.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); }); await p.waitForTimeout(700); };
  const ctx=await b.newContext({viewport:{width:412,height:915}});
  const pg=await openIn(ctx,"tab1: "); await onboard(pg);
  const storeIds=()=>pg.evaluate(async()=>(await mediaDB.getAll('images')).map(x=>x.id).sort().join(","));

  console.log("\n[the delayed gallery re-write goes through the gate]");
  await pg.evaluate(async P=>{ window.toast=()=>{}; for(let i=0;i<3;i++) state.images.push({id:'old'+i,url:P,date:i}); persistImages(); },PNG);
  await pg.waitForTimeout(2500);
  const seeded=await storeIds();
  ok("a good session's capture is re-written after the 1.5 s delay", /old0,old1,old2/.test(seeded)?true:seeded);
  ok("after a failed gallery read, a new picture's capture never rewrites the store", await pg.evaluate(async P=>{
    const g=mediaDB.getAllStrict; mediaDB.getAllStrict=async()=>{ throw new Error("blocked"); };
    const keep=state.images; state.images=[]; _mediaSafe=false; await hydrateMedia(); mediaDB.getAllStrict=g;
    const rec={id:'newAfterFail',url:P,date:99}; state.images.push(rec);
    const real=mediaDB.putAll; let puts=0; mediaDB.putAll=async(...a)=>{ puts++; return real.apply(mediaDB,a); };
    await captureGalleryMedia(rec);                 // succeeds (data: URL) → _gmPersistSoon
    await new Promise(r=>setTimeout(r,2000));       // past the 1.5 s timer
    mediaDB.putAll=real;
    const ids=(await mediaDB.getAll('images')).map(x=>x.id).sort().join(",");
    state.images=keep; await hydrateMedia();        // back to a good session
    return (puts===0&&!/newAfterFail/.test(ids)&&/old0,old1,old2/.test(ids))?true:JSON.stringify({puts,ids});
  },PNG));
  {
    const pg2=await openIn(ctx,"tab2: ");
    /* (!) v150.108 — CHANGED ON PURPOSE: the window opened last saves now (tests/newest-window-saves). Showing the first
       window again makes it take back over (it reloads), which leaves this one the read-only tab these checks need. */
    await pg.evaluate(()=>{ Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>"visible"}); document.dispatchEvent(new Event('visibilitychange')); });
    await pg.waitForTimeout(5000);
    const r=await pg2.evaluate(async P=>{
      window.toast=()=>{};
      const ro=_tabReadOnly, safe=collectionsSafe;
      const real={p:mediaDB.putAll,k:mediaDB.kvSet}; let puts=0, kv=0;
      // count what reaches the real helpers (they refuse anyway in a read-only tab)
      mediaDB.putAll=async(...a)=>{ puts++; return real.p.apply(mediaDB,a); };
      mediaDB.kvSet=async(...a)=>{ kv++; return real.k.apply(mediaDB,a); };
      state.images=[{id:'roTabPic',url:P,date:5}];   // a stale list, as a second tab would hold
      _gmCaptured.clear(); await rehydrateGalleryMedia(); _gmPersistSoon();
      await new Promise(r=>setTimeout(r,2000));
      const direct=await real.p.call(mediaDB,"images",[{id:'direct'}]);
      mediaDB.putAll=real.p; mediaDB.kvSet=real.k;
      return {ro,safe,puts,kv,direct};
    },PNG);
    const ids=await storeIds();
    ok("a read-only tab's rehydrate + delayed re-write writes nothing (and the store refuses it anyway)",
      (r.ro&&!r.safe&&r.puts===0&&r.kv===0&&r.direct===false&&/old0,old1,old2/.test(ids)&&!/roTabPic|direct/.test(ids))?true:JSON.stringify({r,ids}));
    const s=await pg2.evaluate(()=>{ const t=[]; const rt=window.toast; window.toast=m=>t.push(String(m));
      const before=localStorage.getItem(K.user);
      const r1=store.setRaw(K.user,"RO-TAB-NAME"), r2=store.set("sm_qc2_probe",{a:1});
      document.getElementById('setUser').value="RO-TAB-NAME2"; saveSettings(true);
      window.toast=rt;
      return {r1,r2,user:localStorage.getItem(K.user),before,probe:localStorage.getItem("sm_qc2_probe"),t}; });
    ok("a read-only tab writes no settings, and Save Settings says so",
      (s.r1===false&&s.r2===false&&s.user===s.before&&s.probe===null&&s.t.some(m=>/NOT saved/.test(m))&&!s.t.some(m=>/Settings saved/.test(m)))?true:JSON.stringify(s));
    await pg2.close();
  }

  console.log("\n[numbers that reach HTML cannot carry markup]");
  ok("an imported roleplay's status day, map position, tracker min and dates come back as numbers (or not at all)", await pg.evaluate(async()=>{
    window.__x=[]; const rc=window.uiConfirm; window.uiConfirm=async()=>true;
    const H=t=>`1"'><img src=x onerror=__x.push('${t}')>`;
    const u=JSON.parse(JSON.stringify(state.universes[0])); u.id="u_qc2rp"; u.name="Shared";
    u.locations=[{id:"l1",name:"Cafe",mapPos:{x:"12",y:H('mapy')},sublocations:[]}];
    u.trackers=[{id:"t1",name:"Trust",min:H('trmin'),max:"80",behavior:"free",stages:[{at:H('stage'),text:"x"}]}];
    const file={app:"StoryMind",kind:"roleplay",universe:u,personas:[],memory:[],curChat:"c_qc2rp",
      chats:{c_qc2rp:{id:"c_qc2rp",universeId:"u_qc2rp",title:"Shared story",locationId:"l1",gameDay:H('gameDay'),
        trackerVals:{t1:{__story__:H('trval')}},
        calendar:[{id:"k1",kind:"meeting",title:"Dinner",day:H('calday'),probability:H('prob'),withUser:true}],
        messages:[{mid:"a1",role:"assistant",content:"Welcome.",speaker:"Aria",status:{day:H('statusDay'),period:"Evening",location:"Cafe"}}]}}};
    await importRoleplayFile(file); window.uiConfirm=rc;
    const U=state.universes.find(x=>x.id==="u_qc2rp"), c=state.chats.c_qc2rp;
    const r={x:U.locations[0].mapPos.x,y:U.locations[0].mapPos.y,min:U.trackers[0].min,max:U.trackers[0].max,at:U.trackers[0].stages[0].at,
      gd:c.gameDay,tv:c.trackerVals.t1.__story__,cd:c.calendar[0].day,pb:c.calendar[0].probability,sd:c.messages[0].status.day};
    return (r.x===12&&r.y===undefined&&r.min===undefined&&r.max===80&&r.at===undefined&&r.gd===undefined&&r.tv===undefined&&r.cd===undefined&&r.pb===undefined&&r.sd===undefined)?true:JSON.stringify(r);
  }));
  ok("the same values set directly (as a model or an old save could) render as text: chat, calendar, story state, tracker editor, map", await pg.evaluate(async()=>{
    window.__x=[]; window.uiConfirm=async()=>true; window.uiChoose=async()=>null; window.toast=()=>{};
    const H=t=>`1"'><img src=x onerror=__x.push('${t}')>`;
    const uni=state.universes[0]; const U=uni.id;
    state.trackOn=true; state.relOn=true; state.calOn=true; state.promiseOn=true;
    uni.locations=[{id:"L1",name:"Cafe",type:"home",mapPos:{x:5,y:H('mapy')},sublocations:[]},{id:"L2",name:"Park",mapPos:{x:H('mapx2'),y:40}}];
    uni.trackers=[{id:"tr1",name:"Trust",owner:"__story__",min:H('trmin'),max:H('trmax'),behavior:"free",stages:[{at:H('stageat'),text:"x"}]}];
    const p1={id:"pQ2",name:"Aria",universeId:U,avatar:"A",homeId:"L1"}; state.personas.push(p1);
    const chat=curChat(); chat.universeId=U; chat.presentIds=[p1.id]; chat.locationId="L1"; chat.location="Cafe"; chat.gameDay=H('gameDay');
    chat.trackerVals={tr1:{__story__:H('trval')}};
    chat.messages=[{mid:"q1",role:"assistant",content:"hello",speaker:"Aria",speakerId:p1.id,status:{day:H('statusDay'),period:"Evening",location:"Cafe"}}];
    chat.calendar=[{id:"c1",kind:"meeting",title:"Dinner",who:"Aria",charIds:[p1.id],withUser:true,day:H('calday'),period:"Evening",done:false,probability:H('prob'),certainty:"likely"},
                   {id:"c2",kind:"meeting",title:"Lunch",who:"Aria",charIds:[p1.id],withUser:true,day:H('doneday'),period:"Morning",done:true,outcome:"kept"}];
    chat.promises=[{id:"pr1",promise:"x",status:"open",holderName:"Aria",day:H('prday'),kind:"promise"}];
    markChatDirty(chat);
    const run=async f=>{ try{ await f(); }catch(e){ window.__x.push("THREW "+e.message); } await new Promise(r=>setTimeout(r,120)); };
    await run(()=>renderChat()); await run(()=>openCalendar()); await run(()=>openStoryState());
    await run(()=>editUniverse(U)); await run(()=>renderTrackerEditor()); await run(()=>editTracker(0));
    await run(()=>openWorldMap()); await run(()=>addCalManual("c1"));
    await new Promise(r=>setTimeout(r,500));
    const inj=[...document.querySelectorAll('img')].filter(i=>i.getAttribute('src')==='x').length;
    const x=[...new Set(window.__x)];
    // a real number still renders as one
    const circ=[...document.querySelectorAll('#mapSvg circle')].map(c=>c.getAttribute('cx'));
    try{ _calClose(); }catch(e){} try{ _ssClose(); }catch(e){}
    return (x.length===0&&inj===0&&circ.every(v=>v!==null&&isFinite(+v)))?true:JSON.stringify({x,inj,circ});
  }));

  console.log("\n[the tab lock always ends with exactly one writer]");
  const role=async p=>{ try{ return await p.evaluate(()=>(!_tabReadOnly&&collectionsSafe)?"W":"RO"); }catch(e){ return "ERR"; } };
  /* (!) v150.108 — CHANGED ON PURPOSE: the window opened last is the writer now (tests/newest-window-saves); the same
     "exactly one writer" checks, with the writer being the newest window. */
  {
    const c2=await b.newContext();
    const A=await openIn(c2,"A: "), B=await openIn(c2,"B: "), C=await openIn(c2,"C: ");
    const r0=[await role(A),await role(B),await role(C)].join("");
    await C.close(); await B.waitForTimeout(6000);
    const r1=[await role(A),await role(B)];
    ok("3 tabs: the newest writes; close it → exactly one of the other two becomes the writer", (r0==="ROROW"&&r1.filter(x=>x==="W").length===1&&r1.filter(x=>x==="RO").length===1)?true:JSON.stringify({r0,r1}));
    const D=await openIn(c2,"D: ");
    const r1b=[await role(A),await role(B),await role(D)];
    ok("…and a tab opened after that is the writer, the others read-only", (r1b.join("")==="ROROW")?true:JSON.stringify(r1b));
    await D.close(); await A.waitForTimeout(6000);
    const r2=[await role(A),await role(B)];
    ok("close that writer too → again exactly one writer", r2.filter(x=>x==="W").length===1?true:JSON.stringify(r2));
    await c2.close();
  }
  {
    const c3=await b.newContext();
    const A=await openIn(c3,"A2: "), B=await openIn(c3,"B2: ");
    const r0=(await role(A))+(await role(B));
    await B.close(); const C=await c3.newPage(); C.on('pageerror',e=>errs.push("C2: "+e.message)); await C.goto(url);
    await A.waitForTimeout(7000);
    const r1=[await role(A),await role(C)];
    ok("close the writer and open C at once → exactly one writer between A and C", (r0==="ROW"&&r1.filter(x=>x==="W").length===1&&r1.filter(x=>x==="RO").length===1)?true:JSON.stringify({r0,r1}));
    await c3.close();
  }

  console.log("\n[the breaker]");
  await pg.evaluate(()=>{ state.key=state.key||"qc2-test-key"; });
  const cc=f=>pg.evaluate(f);
  ok("a 403 from moderation is that call's error: no pause, the next background call is sent", await cc(async()=>{
    const real=window.fetch, rt=window.toast; const toasts=[]; window.toast=m=>toasts.push(String(m)); let sent=0;
    for(const k in _mcBreak) delete _mcBreak[k];
    window.fetch=async()=>{ sent++; return new Response(JSON.stringify({error:{message:"Your input was flagged by moderation",code:403}}),{status:403,headers:{"Content-Type":"application/json"}}); };
    let first=""; try{ await chatCompletion([{role:"user",content:"x"}],"m",{retries:0,dbg:"qc2 403",fn:"mem"}); }catch(e){ first=e.friendly||""; }
    window.fetch=async()=>{ sent++; return new Response(JSON.stringify({choices:[{message:{content:"fine"}}]}),{status:200}); };
    let second=""; try{ second=await chatCompletion([{role:"user",content:"x"}],"m",{retries:0,dbg:"qc2 after 403",fn:"mem"}); }catch(e){ second="THREW "+e.friendly+" paused="+e.paused; }
    window.fetch=real; window.toast=rt;
    const tripped=Object.keys(_mcBreak).length;
    return (/moderation/.test(first)&&!/invalid/.test(first)&&second==="fine"&&sent===2&&tripped===0&&!toasts.some(t=>/paused/.test(t)))?true:JSON.stringify({first,second,sent,tripped,toasts});
  }));
  ok("after a 401, a foreground call is still sent, and its success lifts the pause for the background", await cc(async()=>{
    const real=window.fetch, rt=window.toast; window.toast=()=>{}; let sent=0;
    for(const k in _mcBreak) delete _mcBreak[k];
    window.fetch=async()=>{ sent++; return new Response("{}",{status:401}); };
    try{ await chatCompletion([{role:"user",content:"x"}],"m",{retries:0,dbg:"qc2 401",fn:"mem"}); }catch(e){}
    let paused=false; try{ await chatCompletion([{role:"user",content:"x"}],"m",{retries:0,dbg:"qc2 bg paused",fn:"mem"}); }catch(e){ paused=!!e.paused; }
    const s1=sent;
    window.fetch=async()=>{ sent++; return new Response(JSON.stringify({choices:[{message:{content:"gen"}}]}),{status:200}); };
    let fg=""; try{ fg=await chatCompletion([{role:"user",content:"x"}],"m",{retries:0,foreground:true,dbg:"qc2 generator"}); }catch(e){ fg="THREW "+e.friendly+" paused="+e.paused; }
    const cleared=Object.keys(_mcBreak).length===0;
    let bg=""; try{ bg=await chatCompletion([{role:"user",content:"x"}],"m",{retries:0,dbg:"qc2 bg after",fn:"mem"}); }catch(e){ bg="THREW "+e.friendly; }
    window.fetch=real; window.toast=rt; for(const k in _mcBreak) delete _mcBreak[k];
    return (paused&&s1===1&&fg==="gen"&&cleared&&bg==="gen"&&sent===3)?true:JSON.stringify({paused,s1,fg,cleared,bg,sent});
  }));
  ok("player-started calls are marked foreground (generators, Story mode, Drop me into a scene, bio/universe)",
    (['Universe generator','Character bio generator',"Story mode · the player's move",'Batch character generator ×','Location generator (','Tracker generator','Outfit generator']
      .every(l=>src.includes('foreground:true,dbg:"'+l))&&/foreground:true,timeoutMs:75000,retries:1,dbg:"Drop me into a scene/.test(src))?true:"a call site lost its foreground mark");

  console.log("\n[escaping details]");
  ok("a signed thumbnail URL with & is escaped once", await pg.evaluate(()=>{
    const u="https://cdn.example.com/v.mp4?X-Amz-Signature=abc&X-Amz-Expires=3600";
    const d=document.createElement('div'); d.innerHTML=_vidThumbHTML(u);
    return d.firstChild.getAttribute('src')===u+"#t=0.001"?true:d.firstChild.getAttribute('src');
  }));
  ok("a hostile message id: escaped in the video markup, no throw or injection in renderChat", await pg.evaluate(async()=>{
    window.__x=[];
    const bad='m9"><img src=x onerror=__x.push(1)>';
    const d=document.createElement('div'); d.innerHTML=sceneHTML({mid:bad,role:'assistant',content:'hi',speaker:'A',video:'https://ex.com/v.mp4'})+sceneHTML({mid:bad+'2',role:'assistant',content:'hi',speaker:'A',vidState:'loading'});
    document.body.appendChild(d);
    const vid=d.querySelector('video'), idOk=vid&&vid.id==='vid_'+bad;
    const chat=curChat(); chat.messages.push({mid:'z\\"]<b>',role:'assistant',content:'a line',speaker:'Narrator',video:'https://ex.com/c.mp4'});
    let threw=""; try{ renderChat(); appendNewBubbles(); refreshBubble('z\\"]<b>'); }catch(e){ threw=e.message; }
    await new Promise(r=>setTimeout(r,400)); d.remove();
    chat.messages.pop(); renderChat();
    return (!threw&&idOk&&window.__x.length===0)?true:JSON.stringify({threw,idOk,x:window.__x});
  }));
  {
    const c4=await b.newContext();
    const p=await openIn(c4,"mid: "); await onboard(p);
    await p.evaluate(async()=>{
      window.__x=[]; window.uiConfirm=async()=>true;
      const u=state.universes[0];
      await importRoleplayFile({app:"StoryMind",kind:"roleplay",universe:JSON.parse(JSON.stringify(u)),personas:[],memory:[],curChat:"c_evil",
        chats:{c_evil:{id:"c_evil",universeId:u.id,title:"Shared",messages:[{mid:"a1",role:"assistant",content:"Welcome.",speaker:"Narrator"},
          {mid:'z\\"><img src=x onerror=__x.push(1)>',role:"assistant",content:"A scene.",speaker:"Narrator",videoSrc:"https://example.com/clip.mp4"}]}}});
      // and one that reaches storage without an import (an older save)
      state.chats.c_evil.messages.push({mid:'y"]\\<i>',role:"assistant",content:"Old.",speaker:"Narrator"}); markChatDirty(state.chats.c_evil); flushPersistChats();
      await new Promise(r=>setTimeout(r,600));
    });
    const imported=await p.evaluate(()=>state.chats.c_evil.messages.map(m=>m.mid));
    await p.reload(); await p.waitForTimeout(2500);
    const r=await p.evaluate(async()=>{ let threw=""; try{ renderChat(); }catch(e){ threw=e.message; } await new Promise(r=>setTimeout(r,300));
      return {threw,cur:state.curChat,mids:(state.chats.c_evil&&state.chats.c_evil.messages||[]).map(m=>m.mid),bubbles:document.querySelectorAll('#chatList [data-mid]').length,x:window.__x||[]}; });
    ok("an imported hostile message id is replaced; after a reload every id is a plain token and the chat renders",
      (imported[0]==="a1"&&/^msg_/.test(imported[1])&&!r.threw&&r.mids.length===3&&r.mids.every(m=>/^[\w.:-]+$/.test(m))&&r.bubbles>=3&&r.x.length===0)?true:JSON.stringify({imported,r}));
    await c4.close();
  }

  console.log("\n[write failures are counted per key]");
  ok("chats failing while gossip saves: one 'retrying' toast, then the export warning", await pg.evaluate(async()=>{
    const toasts=[]; const rt=window.toast; window.toast=m=>toasts.push(String(m));
    const real=mediaDB.kvSet; mediaDB.kvSet=async(k,v)=>k==="chats"?false:real.call(mediaDB,k,v);
    for(let i=0;i<4;i++){
      const c=curChat(); c.messages.push({mid:newMid(),role:'user',content:'line '+i,present:[]}); markChatDirty(c); persistChatsNow();
      await new Promise(r=>setTimeout(r,120));
      persistGossip(); await new Promise(r=>setTimeout(r,80));   // a small write that succeeds
    }
    mediaDB.kvSet=real; const rr=_writeRetry.get("chats"); if(rr){ clearTimeout(rr.timer); _writeRetry.delete("chats"); }
    persistChatsNow(); await new Promise(r=>setTimeout(r,150));
    window.toast=rt;
    const retrying=toasts.filter(t=>/Couldn't save chats/.test(t)).length, exportWarn=toasts.filter(t=>/export a backup/.test(t)).length;
    return (retrying===1&&exportWarn===1&&!_writeFail.has("chats"))?true:JSON.stringify({retrying,exportWarn,toasts});
  }));

  console.log("\n[an import always snapshots first]");
  ok("right after boot (nothing changed since load) a restore still writes a real safety snapshot", await pg.evaluate(async()=>{
    collectionsSafe=true; _roWarned=false;
    _snapRev=_dataRev+"/"+_lsRev;                                // exactly what boot does
    const real={k:mediaDB.kvSet,r:mediaDB.restoreAtomic}; let snaps=0;
    mediaDB.kvSet=async(k,v)=>{ if(String(k).indexOf("autobackup_")===0)snaps++; return real.k.call(mediaDB,k,v); };
    mediaDB.restoreAtomic=async()=>{ throw new Error("qc2 stop before replacing"); };
    let msg=""; try{ await applyBackupBundle({app:"StoryMind",backupVersion:1,collections:{chats:{}}}); }catch(e){ msg=e.message; }
    mediaDB.kvSet=real.k; mediaDB.restoreAtomic=real.r;
    const safe=collectionsSafe;
    return (snaps===1&&/nothing was changed/.test(msg)&&safe)?true:JSON.stringify({snaps,msg,safe});
  }));
  ok("the roleplay / universes / prompts imports snapshot first too", /doAutoBackup\(\{force:true\}\)[^\n]*\n\s*if\(_importMode==="roleplay"\)/.test(src)?true:"importDispatch takes no snapshot");

  console.log("\n[transport ceilings]");
  ok("fetchWithTimeout reads a stalled media body under its timer", await pg.evaluate(async()=>{
    const real=window.fetch; window.fetch=async()=>({ok:true,status:200,blob:()=>new Promise(()=>{}),clone(){return this;}});
    const t0=Date.now(); let kind="";
    try{ await fetchWithTimeout("https://ex.com/v.mp4",{},{timeoutMs:200,read:"blob"}); }catch(e){ kind=e.kind; }
    window.fetch=real;
    return (kind==="timeout"&&Date.now()-t0<1500)?true:"kind="+kind;
  }));
  ok("a streamed body that stalls is cancelled at its deadline", await pg.evaluate(async()=>{
    let cancelled=false; const reader={read:()=>new Promise(()=>{}),cancel(){ cancelled=true; }};
    let kind=""; try{ await _readUntil(reader,Date.now()+150); }catch(e){ kind=e.kind; }
    return (kind==="timeout"&&cancelled)?true:JSON.stringify({kind,cancelled});
  }));
  ok("Atlas upload, the TTS relay, audio fetch, model list, video download and the update check use fetchWithTimeout",
    await pg.evaluate(()=>[atlasUpload,_inworldFetchPcm,_inworldStream,_fetchDecodeAudio,_fetchCatalogue,toPlayableVideo,serverBuild,fetchMediaBlob]
      .every(f=>{ const s=String(f).replace(/await fetch\((url|dataUri)\)/g,"");   // (a same-origin blob: read needs no ceiling)
        return /fetchWithTimeout\(/.test(s)&&!/[^.\w]fetch\(/.test(s); })?true:"a raw fetch is left"));

  console.log("\n[service worker, CI]");
  {
    const sw=fs.readFileSync(path.resolve(__dirname,'..','sw.js'),'utf8');
    ok("sw.js never caches a URL with a query string (the update check's ?_b= copies) and clears old ones",
      (/res\.ok && res\.type === "basic" && !url\.search/.test(sw)&&/dropQueryCopies/.test(sw))?true:"sw.js still caches ?_b=");
    const yml=fs.readFileSync(path.resolve(__dirname,'..','.github','workflows','tests.yml'),'utf8');
    let v=""; try{ v=require('playwright/package.json').version; }catch(e){}
    const m=/npm i --no-save playwright@(\d+\.\d+\.\d+)/.exec(yml);
    ok("CI pins Playwright to the version the suite runs with", (m&&(!v||m[1]===v))?true:"pinned="+(m&&m[1])+" installed="+v);
  }

  ok("no page errors", errs.length===0?true:errs.join(" | "));
  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close(); process.exit(fail?1:0);
})();
