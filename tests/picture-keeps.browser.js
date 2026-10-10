/* v150.106 — A CHANGED PICTURE STAYS CHANGED AFTER A RELAUNCH. Character pictures are stored as bytes ("simg:" in
   IndexedDB) and every boot points the character at those bytes. Two faults put the old picture back:
   - a new picture was taken as "already stored" because only its first 200 characters were compared, and every
     picture the app resizes starts with the same 200 characters (same JPEG encoder, same header);
   - the boot always preferred the stored bytes over the picture on the character, even when the character's
     picture was newer (a data: picture set since, or a hosted link whose download failed).
   Also: removing an extra reference view moves the next one into its place, and its slot now stores the right bytes.
   Run: node tests/picture-keeps.browser.js */
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:process.env.SM_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage({viewport:{width:412,height:915}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  const boot=async()=>{ await pg.waitForTimeout(2400);
    await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
    await pg.waitForTimeout(800); };
  await pg.goto('file://'+require('path').resolve(__dirname,'..','index.html')); await boot();
  const relaunch=async()=>{ await pg.waitForTimeout(1500); await pg.reload(); await boot(); await pg.waitForTimeout(800); };
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x===undefined?c:x).slice(0,800));} };

  // A picture the way the app makes one (canvas → JPEG 0.86, as fitRefImage does), and the colour a picture shows.
  await pg.addInitScript(()=>{
    window.__jpeg=(col)=>{ const c=document.createElement('canvas'); c.width=96; c.height=96; const g=c.getContext('2d');
      g.fillStyle=col; g.fillRect(0,0,96,96); return c.toDataURL("image/jpeg",0.86); };
    window.__colour=(url)=>new Promise(res=>{ if(!url){res("none");return;} const im=new Image();
      im.onload=()=>{ const c=document.createElement('canvas'); c.width=8; c.height=8; const g=c.getContext('2d'); g.drawImage(im,0,0,8,8);
        const d=g.getImageData(4,4,1,1).data; res(d[0]>150&&d[1]<90&&d[2]<90?"red":d[2]>150&&d[0]<90&&d[1]<90?"blue":d[1]>150&&d[0]<90&&d[2]<90?"green":d[0]>150&&d[1]>150&&d[2]<90?"yellow":"rgb("+d[0]+","+d[1]+","+d[2]+")"); };
      im.onerror=()=>res("broken"); im.src=url; });
  });
  await pg.reload(); await boot();
  const shows=(expr)=>pg.evaluate(async(expr)=>{ const p=state.personas.find(x=>x.id==="pk_1"); if(!p)return "no character";
      const v=expr==="image"?p.image:(p.refImages||[])[+expr]; return await window.__colour(v); },expr);

  console.log("\n[a new picture after a relaunch]");
  await pg.evaluate(()=>{ const uni=state.universes[0]; state.curUniverse=uni.id;
    state.personas=state.personas.filter(p=>p.id!=="pk_1");
    state.personas.push({id:"pk_1",name:"Pia",universeId:uni.id,personality:"x",look:{},image:window.__jpeg("#e01010")});
    persistPersonas(); });
  await relaunch();
  ok("the first picture comes back after a relaunch", await shows("image")==="red", await shows("image"));
  const same=await pg.evaluate(()=>window.__jpeg("#e01010").slice(0,200)===window.__jpeg("#1010e0").slice(0,200));
  ok("(two different pictures from the encoder start with the same 200 characters)", same===true, same);
  await pg.evaluate(()=>{ const p=state.personas.find(x=>x.id==="pk_1"); p.image=window.__jpeg("#1010e0"); persistPersonas(); });
  ok("the new picture shows at once", await shows("image")==="blue", await shows("image"));
  await relaunch();
  ok("the new picture is still there after a relaunch", await shows("image")==="blue", await shows("image"));
  await relaunch();
  ok("…and after another", await shows("image")==="blue", await shows("image"));

  console.log("\n[the picture on the character wins over older stored bytes]");
  await pg.evaluate(async()=>{ const p=state.personas.find(x=>x.id==="pk_1"); const g=window.__jpeg("#10c010");
    p.image=g; _simgCaptured.set("simg:char:pk_1",g);   // as if its capture had been skipped
    _kvPersist("personas",()=>state.personas); });
  await relaunch();
  ok("a picture set since the last capture is kept, not swapped for the stored one", await shows("image")==="green", await shows("image"));
  ok("…and its bytes are stored now", await pg.evaluate(async()=>{ const d=await mediaDB.kvGet("simg:char:pk_1"); return await window.__colour(d); })==="green");
  const link=await pg.evaluate(async()=>{ const p=state.personas.find(x=>x.id==="pk_1");
    await mediaDB.kvSet("simgsrc:simg:char:pk_1","pending:https://img.invalid/new.jpg");
    p.image="https://img.invalid/new.jpg"; await rehydrateStaticImages(); return p.image; });
  ok("a hosted link whose download didn't finish is kept (the stored bytes are an older picture)", link==="https://img.invalid/new.jpg", link);
  const linkOld=await pg.evaluate(async()=>{ const p=state.personas.find(x=>x.id==="pk_1");
    await mediaDB.kvSet("simgsrc:simg:char:pk_1","https://img.invalid/old.jpg");
    p.image="https://img.invalid/new2.jpg"; await rehydrateStaticImages(); return p.image; });
  ok("…and so is one whose stored bytes came from a different link", linkOld==="https://img.invalid/new2.jpg", linkOld);
  const linkSame=await pg.evaluate(async()=>{ const p=state.personas.find(x=>x.id==="pk_1");
    await mediaDB.kvSet("simgsrc:simg:char:pk_1","https://img.invalid/new2.jpg");
    await rehydrateStaticImages(); return /^blob:/.test(p.image)?await window.__colour(p.image):p.image; });
  ok("a link whose bytes ARE stored is pointed at the stored bytes (it outlives the link)", linkSame==="green", linkSame);
  const legacy=await pg.evaluate(async()=>{ const p=state.personas.find(x=>x.id==="pk_1");
    await mediaDB.kvDelete("simgsrc:simg:char:pk_1");
    p.image="https://img.invalid/expired.jpg"; await rehydrateStaticImages(); return /^blob:/.test(p.image)?await window.__colour(p.image):p.image; });
  ok("bytes stored before the source was recorded still stand in for an expired link", legacy==="green", legacy);

  console.log("\n[removing a reference view]");
  await pg.evaluate(()=>{ const p=state.personas.find(x=>x.id==="pk_1"); p.refImages=[window.__jpeg("#e01010"),window.__jpeg("#e0e010")]; persistPersonas(); });
  await relaunch();
  ok("both views come back", (await shows("0"))==="red"&&(await shows("1"))==="yellow", (await shows("0"))+" / "+(await shows("1")));
  await pg.evaluate(()=>{ const p=state.personas.find(x=>x.id==="pk_1"); p.refImages.splice(0,1); persistPersonas(); });
  await relaunch();
  const after=await pg.evaluate(()=>(state.personas.find(x=>x.id==="pk_1").refImages||[]).length);
  ok("the removed view stays removed; the other moves up", after===1&&(await shows("0"))==="yellow", after+" view(s), first is "+(await shows("0")));

  ok("deleting the character's pictures drops their source records too", await pg.evaluate(async()=>{
    await mediaDB.kvSet("simgsrc:simg:char:pk_1","data"); await deleteStaticImagesFor(["char:pk_1"]); const a=await mediaDB.kvGet("simg:char:pk_1"), s=await mediaDB.kvGet("simgsrc:simg:char:pk_1");
    return (!a&&!s)?true:JSON.stringify({a:!!a,s}); }));

  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close(); process.exit(fail?1:0);
})();
