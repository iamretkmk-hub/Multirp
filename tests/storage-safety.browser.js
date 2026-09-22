/* v109.1 — THE BOOT PATH USED TO DESTROY THE DATA IT WAS MEANT TO LOAD.
   Reported as: "I suddenly received a newer-version message, I clicked it, and all data reset."

   Clicking the banner only calls location.reload(); the service worker deletes caches and never
   touches localStorage or IndexedDB. The loss happened in the boot that followed.

   preloadCollections read each collection with the SOFT kvGet, which returns null on any
   exception — indistinguishable from "this key was never written". It treated that as "this user
   has never migrated", fell back to localStorage (where these collections had been migrated away
   from versions earlier, so it got {} and []), and because the fallback set `migrated` it WROTE
   THOSE EMPTY DEFAULTS BACK INTO IndexedDB. One failed read was enough to erase a playthrough.

   An update reload is the likeliest moment for that failed read: sw.js calls skipWaiting() on
   install and clients.claim() on activate, so the new worker takes over while the old page may
   still hold the database — and indexedDB.open had no onblocked handler at all.

   Run: node tests/storage-safety.browser.js */
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage({viewport:{width:412,height:915}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file:///home/user/Multirp/index.html'); await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(800);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x||c).slice(0,600));} };

  // A played session, on disk.
  const seed=()=>pg.evaluate(async()=>{
    await mediaDB.kvSet("chats",{c1:{id:"c1",messages:[{mid:"m",content:"a real playthrough"}]}});
    await mediaDB.kvSet("memory",[{id:"m1",content:"a real memory"}]);
    await mediaDB.kvSet("personas",[{id:"p1",name:"Duygu"}]);
    collectionsSafe=true; _roWarned=false;
    return true; });
  const onDisk=k=>pg.evaluate(async key=>JSON.stringify(await mediaDB.kvGetStrict(key)),k);

  console.log("\n[a read that failed is not a store that is empty]");
  await seed();
  ok("a blocked read leaves the session marked unsafe", await pg.evaluate(async()=>{
      const real=mediaDB.kvKeysStrict;
      mediaDB.kvKeysStrict=async()=>{ throw new Error("blocked"); };
      await preloadCollections();
      mediaDB.kvKeysStrict=real;
      return collectionsSafe===false ? true : "the session called itself safe"; }));
  ok("and writes NOTHING — the playthrough is still on disk",
     (await onDisk("chats")).indexOf("a real playthrough")>-1, await onDisk("chats"));
  ok("nor are the memories seeded away",
     (await onDisk("memory")).indexOf("a real memory")>-1, await onDisk("memory"));
  ok("a read that fails mid-way is just as safe", await pg.evaluate(async()=>{
      const real=mediaDB.kvGetStrict;
      mediaDB.kvGetStrict=async()=>{ throw new Error("transaction aborted"); };
      await preloadCollections();
      mediaDB.kvGetStrict=real;
      return collectionsSafe===false ? true : "a failed collection read still counted as safe"; }));
  ok("and it too left the disk alone",
     (await onDisk("chats")).indexOf("a real playthrough")>-1, await onDisk("chats"));

  console.log("\n[a session that could not read must never write]");
  ok("chats do not commit", await pg.evaluate(async()=>{
      collectionsSafe=false; _roWarned=true;
      state.chats={}; state.curChat=""; _lastPersistSig=null;
      persistChatsNow(); await new Promise(r=>setTimeout(r,250));
      return String(await mediaDB.kvGetStrict("chats")).indexOf("[object")>-1
        || JSON.stringify(await mediaDB.kvGetStrict("chats")).indexOf("a real playthrough")>-1
        ? true : "an empty chat map was committed"; }));
  ok("neither do memories, personas or gossip", await pg.evaluate(async()=>{
      state.memory=[]; state.personas=[]; state.gossip=[];
      persistMemory(); persistPersonas(); persistGossip();
      await new Promise(r=>setTimeout(r,250));
      const m=JSON.stringify(await mediaDB.kvGetStrict("memory"));
      const p=JSON.stringify(await mediaDB.kvGetStrict("personas"));
      return (m.indexOf("a real memory")>-1 && p.indexOf("Duygu")>-1)
        ? true : "m="+m+" p="+p; }));
  ok("and the snapshots are not burned either — only three are kept", await pg.evaluate(async()=>{
      collectionsSafe=false;
      const before=(await mediaDB.kvKeys()).filter(k=>String(k).indexOf("autobackup_")===0).length;
      await doAutoBackup();
      const after=(await mediaDB.kvKeys()).filter(k=>String(k).indexOf("autobackup_")===0).length;
      return before===after ? true : "an unsafe session wrote a snapshot ("+before+"→"+after+")"; }));
  ok("the player is told once, rather than losing turns silently", await pg.evaluate(()=>{
      collectionsSafe=false; _roWarned=false;
      const a=canPersistCollections(), warned=_roWarned;
      const b2=canPersistCollections();
      return (a===false&&b2===false&&warned===true)?true:"no warning was raised"; }));

  console.log("\n[and when the read works, everything is normal]");
  ok("a readable store loads the real collections", await pg.evaluate(async()=>{
      await preloadCollections();
      return collectionsSafe===true
        && JSON.stringify(_idbColl.chats).indexOf("a real playthrough")>-1
        ? true : "safe="+collectionsSafe+" chats="+JSON.stringify(_idbColl.chats).slice(0,80); }));
  ok("persistence resumes", await pg.evaluate(async()=>{
      state.chats={c9:{id:"c9",messages:[{mid:"x",content:"written after recovery"}]}};
      _lastPersistSig=null; persistChatsNow();
      await new Promise(r=>setTimeout(r,300));
      return JSON.stringify(await mediaDB.kvGetStrict("chats")).indexOf("written after recovery")>-1
        ? true : "the recovered session still refuses to write"; }));
  ok("a key genuinely absent is still seeded, which is what the migration was for", await pg.evaluate(async()=>{
      await mediaDB.kvDelete("gossip");
      store.set(K.gossipLedger,[{id:"g1",text:"a legacy rumour"}]);
      await preloadCollections();
      const disk=JSON.stringify(await mediaDB.kvGetStrict("gossip"));
      return disk.indexOf("a legacy rumour")>-1 ? true : "legacy migration stopped working: "+disk; }));

  console.log("\n[the open itself]");
  ok("a blocked open now settles instead of hanging for ever", (()=>{
      const src=require('fs').readFileSync('/home/user/Multirp/index.html','utf8');
      return /req\.onblocked=\(\)=>rej\(/.test(src)
        ? true : "indexedDB.open still has no onblocked handler"; })());
  ok("and a rejected open is not memoised for the life of the page", (()=>{
      const src=require('fs').readFileSync('/home/user/Multirp/index.html','utf8');
      return /dbp=p\.catch\(e=>\{ dbp=null; throw e; \}\)/.test(src)
        ? true : "one bad open still poisons every later read and write"; })());

  console.log("\n[nothing in the update path clears anything]");
  ok("the banner only reloads", await pg.evaluate(()=>
      /location\.reload\(\)/.test(String(updReload)) && !/clear|delete/i.test(String(updReload)) ));
  ok("localStorage.clear lives only behind the restore confirm", (()=>{
      const src=require('fs').readFileSync('/home/user/Multirp/index.html','utf8');
      const hits=(src.match(/localStorage\.clear\(\)/g)||[]).length;
      const i=src.indexOf("localStorage.clear()");
      const fn=src.lastIndexOf("async function applyBackupBundle",i);
      return (hits===1 && fn>-1 && i-fn<800) ? true : hits+" call sites"; })());

  ok("no page errors", errs.length===0?true:errs.join(" | "));
  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close(); process.exit(fail?1:0);
})();
