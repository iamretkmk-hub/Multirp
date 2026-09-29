// Scene pictures can be closed and opened again, and the message action buttons are visible (v147.1).
//  · portrait: a picture's own ✕ collapses it to "Show image" (saved with the message); a carried-over
//    ("sticky") picture's ✕ stops it being carried forward, with one "Show picture" chip under the latest reply
//  · landscape: the image panel closes (chat takes the full width, an "Images" tab reopens it; remembered)
//  · the per-message actions are light grey at full strength (mid grey in the light theme)
const {chromium}=require('playwright');
const path=require('path');
(async()=>{
  const b=await chromium.launch({executablePath:process.env.SM_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const url='file://'+path.resolve(__dirname,'..','index.html');
  let pass=0,fail=0; const ok=(n,c,x)=>{ if(c){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+(x?"  — "+x:""));} };
  const IMG="data:image/svg+xml;utf8,"+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400"><rect width="640" height="400" fill="#3a6"/></svg>');
  const seed=pg=>pg.evaluate((IMG)=>{
    if(!store.get(K.onboarded,false)){ try{finishOnboard();}catch(e){} }
    const o=document.getElementById('onboard'); if(o)o.classList.remove('show');
    const c=curChat(); state.imgSticky=true; state.autoImg=true; c.stickyOffMid=null;
    c.messages=[{mid:"u1",role:"user",content:"Let's go to the beach."},
      {mid:"a1",role:"assistant",speaker:"Ayla",content:"\"The sea is calm today.\"",img:IMG,imgState:"done"},
      {mid:"u2",role:"user",content:"It's beautiful."},
      {mid:"a2",role:"assistant",speaker:"Ayla",content:"\"It is.\"",imgState:"idle"}];
    show('chat'); renderChat(); try{renderImageRail();}catch(e){}
  },IMG);
  const errs=[];

  // ---- portrait
  let pg=await (await b.newContext({viewport:{width:412,height:860}})).newPage(); pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto(url); await pg.waitForTimeout(2400); await seed(pg); await pg.waitForTimeout(400);
  const P0=await pg.evaluate(()=>{ const a=document.querySelector('.msgAct'), cs=getComputedStyle(a), row=getComputedStyle(document.querySelector('.msgActions'));
    return {color:cs.color,op:+cs.opacity,row:+row.opacity,close:document.querySelectorAll('#chatList .sceneClose').length,sticky:!!document.querySelector('#chatList .scene.sticky')}; });
  ok("action buttons are light grey at full strength",P0.color==="rgb(210, 213, 220)"&&P0.op===1&&P0.row>=0.9,JSON.stringify(P0));
  ok("the picture and the carried-over picture each have a close button",P0.close===2&&P0.sticky,JSON.stringify(P0));
  await pg.click('#chatList .scene.sticky .sceneClose'); await pg.waitForTimeout(250);
  const P1=await pg.evaluate(()=>({sticky:!!document.querySelector('#chatList .scene.sticky'),chips:[...document.querySelectorAll('#chatList .sceneChip')].map(x=>x.textContent.trim()),own:!!document.querySelector('#chatList .bubble[data-mid="a1"] .scene')}));
  ok("closing the carried-over picture stops it being carried, leaving one 'Show picture' chip",!P1.sticky&&JSON.stringify(P1.chips)==='["Show picture"]'&&P1.own,JSON.stringify(P1));
  await pg.click('#chatList .scene .sceneClose'); await pg.waitForTimeout(250);
  const P2=await pg.evaluate(()=>({scenes:document.querySelectorAll('#chatList .scene').length,chips:[...document.querySelectorAll('#chatList .sceneChip')].map(x=>x.textContent.trim()),hidden:curChat().messages[1].imgHidden}));
  ok("closing the picture itself leaves a 'Show image' chip",P2.scenes===0&&P2.chips.includes("Show image")&&P2.hidden===true,JSON.stringify(P2));
  await pg.click('#chatList .sceneChip'); await pg.waitForTimeout(250);
  const P3=await pg.evaluate(()=>({scenes:document.querySelectorAll('#chatList .scene').length,sticky:!!document.querySelector('#chatList .scene.sticky'),off:curChat().stickyOffMid}));
  ok("opening it brings the picture (and its carried copy) back",P3.scenes===2&&P3.sticky&&P3.off===null,JSON.stringify(P3));
  await pg.evaluate(()=>{ toggleSceneImage("a1"); flushPersistChats(); }); await pg.waitForTimeout(900);
  await pg.reload(); await pg.waitForTimeout(2600);
  ok("a closed picture stays closed after a reload",await pg.evaluate(()=>(curChat().messages.find(m=>m.mid==="a1")||{}).imgHidden===true));

  // ---- landscape
  pg=await (await b.newContext({viewport:{width:1280,height:720}})).newPage(); pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto(url); await pg.waitForTimeout(2400); await seed(pg); await pg.waitForTimeout(400);
  ok("the landscape image panel has a Close button",await pg.evaluate(()=>!!document.querySelector('#imageRail .railClose')));
  await pg.click('#imageRail .railClose'); await pg.waitForTimeout(250);
  const L1=await pg.evaluate(()=>({rail:getComputedStyle(document.getElementById('imageRail')).display,tab:getComputedStyle(document.getElementById('railShowBtn')).display,bar:document.querySelector('.inputBar').getBoundingClientRect().width}));
  ok("closing it hides the panel, widens the chat and shows the Images tab",L1.rail==="none"&&L1.tab!=="none"&&L1.bar>1000,JSON.stringify(L1));
  await pg.reload(); await pg.waitForTimeout(2400); await pg.evaluate(()=>show('chat'));
  ok("the closed panel is remembered after a reload",await pg.evaluate(()=>document.body.classList.contains('railHidden')));
  await pg.click('#railShowBtn'); await pg.waitForTimeout(250);
  ok("the Images tab opens the panel again",await pg.evaluate(()=>!document.body.classList.contains('railHidden')&&getComputedStyle(document.getElementById('imageRail')).display==="block"));

  // ---- light theme
  ok("light theme uses a mid grey for the action buttons",await pg.evaluate(()=>{ document.documentElement.setAttribute('data-theme','light'); return getComputedStyle(document.documentElement).getPropertyValue('--actIcon').trim()==="#6E7380"; }));
  ok("no page errors",errs.length===0,errs.join(" | "));
  console.log(`\n  ${pass} passed, ${fail} failed`);
  await b.close(); process.exit(fail?1:0);
})();
