/* v150.114 — THE CONNECTED FEELING SYSTEM, STEP 6: SEEING AND TUNING IT. The character card shows the feelings and bonds in the open
   story — the mood, what is running (strength, cause, unresolved; delete, add), and toward each person the relationship, today's
   opinions, the read and the resolution, with scars — every change saved at once. Settings → Emotions has a tuning table of the
   code's numbers (saved as the difference from the shipped values, one value of a group never wiping the rest; reset).
   Run: node tests/feel-panel.browser.js */
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:process.env.SM_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage({viewport:{width:412,height:915}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file://'+require('path').resolve(__dirname,'..','index.html')); await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(800);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x===undefined?c:x).slice(0,900));} };
  const E=(f,a)=>pg.evaluate(f,a);

  await E(()=>{
    const uni=state.universes[0]; state.curUniverse=uni.id;
    state.personas=state.personas.filter(p=>!/^fp_/.test(p.id));
    state.personas.push({id:"fp_m",name:"Mara",universeId:uni.id,personality:"x",look:{}}); state.personas.push({id:"fp_l",name:"Leo",universeId:uni.id,personality:"x",look:{}});
    state.user="Emre"; state.emoOn=true;
    const c=curChat(); Object.assign(c,{universeId:uni.id,feel:{},rel:{},fsv:1,fsTurn:2,gameDay:3,period:"Evening",messages:[]});
    const m=state.personas.find(p=>p.id==="fp_m");
    fsFeelMove(c,m,{k:"guilt",tgt:"self",size:60,dir:1,cause:"slept with Leo",hold:true});
    fsFeelMove(c,m,{k:"desire",size:40,dir:1,other:"fp_l"});
    const o=relObj(c,"fp_m","fp_l"); Object.assign(o,{trust:70,affection:40}); fsRelMove(c,"fp_m","fp_l","trust","huge",-1);
    o.opRead="He was gentle."; o.res={kind:"keep_distance",text:"It cannot happen again.",strength:"passing",day:3};
    editPersona("fp_m");
  });

  console.log("\n[the panel]");
  const v=await E(()=>{ const h=document.getElementById('peFeel'); return {t:h.textContent,rows:h.querySelectorAll('.peFeelRow').length,
      sliders:h.querySelectorAll('details input[type=range]').length,scar:/✂/.test(h.innerHTML),html:h.innerHTML}; });
  ok("it shows what is running: guilt about themselves (unresolved, with its cause) and desire toward Leo", v.rows===2&&/Guilt/.test(v.t)&&/themselves/.test(v.t)&&/slept with Leo/.test(v.t)&&/Desire/.test(v.t)&&/Leo/.test(v.t), v.t.slice(0,400));
  ok("toward Leo: the six relationship axes and six opinions, the read, the resolution, the scar", v.sliders===12&&/He was gentle|keep distance|It cannot happen again/.test(v.t+v.html)&&v.scar, JSON.stringify({...v,html:undefined}));

  console.log("\n[changing it]");
  const ch=await E(()=>{ const h=document.getElementById('peFeel'), c=curChat();
    const g=[...h.querySelectorAll('.peFeelRow')].find(r=>/Guilt/.test(r.textContent)); const rng=g.querySelector('input[type=range]'); rng.value="15"; rng.dispatchEvent(new Event("input"));
    const cb=g.querySelector('input[type=checkbox]'); cb.checked=false; cb.dispatchEvent(new Event("change"));
    const gf=c.feel.fp_m.list.find(f=>f.k==="guilt");
    const det=h.querySelector('details'); const trust=[...det.querySelectorAll('input[type=range]')][1]; trust.value="-30"; trust.dispatchEvent(new Event("input"));
    const kind=[...det.querySelectorAll('input[type=range]')][6]; kind.value="55"; kind.dispatchEvent(new Event("input"));
    const read=det.querySelector('input.fld:not([type=range])'); read.value="You are not sure about him."; read.dispatchEvent(new Event("change"));
    const sel=det.querySelector('select'); sel.value="end_it"; sel.dispatchEvent(new Event("change"));
    const o=c.rel["fp_m>fp_l"]; return {gv:gf.v,hold:gf.hold,trust:o.trust,kind:o.op.kind,read:o.opRead,res:o.res.kind}; });
  ok("a feeling's strength and its unresolved mark change in place", ch.gv===15&&ch.hold===false, JSON.stringify(ch));
  ok("the relationship, an opinion, the read and the resolution change in place", ch.trust===-30&&ch.kind===55&&/not sure/.test(ch.read)&&ch.res==="end_it", JSON.stringify(ch));
  ok("a feeling is removed, and one is added by hand", await E(()=>{ const h=document.getElementById('peFeel'), c=curChat();
      const d=[...h.querySelectorAll('.peFeelRow')].find(r=>/Desire/.test(r.textContent)); d.querySelector('button').click();
      document.getElementById('peFeelAddK').value="jealousy"; document.getElementById('peFeelAddT').value="p:fp_l"; peFeelAdd();
      const L=c.feel.fp_m.list.map(f=>f.k+":"+f.tgt); return (!L.some(x=>/^desire/.test(x))&&L.includes("jealousy:p:fp_l"))?true:JSON.stringify(L); }));
  ok("the changes are saved with the story", await E(async()=>{ flushPersistChats(); await new Promise(r=>setTimeout(r,500));
      const st=await mediaDB.kvGet("chats"); const c=st&&st[curChat().id]; return (c&&c.rel["fp_m>fp_l"].trust===-30&&c.feel.fp_m.list.some(f=>f.k==="jealousy"))?true:"not saved"; }));
  ok("a character not saved yet is asked to be saved first", await E(()=>{ editPersona(null); return /Save the character first/.test(document.getElementById('peFeel').textContent)?true:document.getElementById('peFeel').textContent; }));

  console.log("\n[the tuning table]");
  const tn=await E(()=>{ show('settings'); syncSettingsUI(); const box=document.getElementById('fsTuneBox'); const ins=[...box.querySelectorAll('.fsTuneIn')];
    const vt=ins.find(i=>i.dataset.k==="hl.vfast.turns"); vt.value="5"; const w=ins.find(i=>i.dataset.k==="weights.rel"); w.value="4";
    saveSettings(false); const T=fsTune(); return {n:ins.length,stored:store.get(K.fsTune,null),vt:T.hl.vfast.turns,vp:T.hl.vfast.periods,wr:T.weights.rel,wf:T.weights.feel}; });
  ok("every tunable number is listed", tn.n===25, tn.n);
  ok("a change is saved as the difference from the shipped values", JSON.stringify(tn.stored)==='{"hl":{"vfast":{"turns":5}},"weights":{"rel":4}}', JSON.stringify(tn.stored));
  ok("…and one value of a group never wipes the rest", tn.vt===5&&tn.vp===0.5&&tn.wr===4&&tn.wf===1, JSON.stringify(tn));
  ok("reset puts the shipped values back", await E(()=>{ fsTuneReset(); const T=fsTune(); return (state.fsTune===null&&store.get(K.fsTune,"x")===null&&T.hl.vfast.turns===3&&T.weights.rel===3)?true:JSON.stringify(state.fsTune); }));

  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close(); process.exit(fail?1:0);
})();
