/* v36.8 — the chat menu after the re-arrangement.
   Everything that answers "where am I / who is here / what time is it" lives on the World map.
   Everything that happens between scenes is one Story group. The globe is off the input bar and
   the language picker opens from the modes menu instead. "Bored" is gone from both places. */
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x||c).slice(0,400));} };

  const LAND=process.argv.indexOf("--landscape")>-1;
  const ctx=await b.newContext({viewport:LAND?{width:915,height:412}:{width:412,height:915},hasTouch:true,isMobile:true});
  const pg=await ctx.newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file:///home/user/Multirp/index.html'); await pg.waitForTimeout(2300);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(800);
  await pg.evaluate(()=>{
    // the map refuses to open for a universe with no places, so give this one somewhere to be
    const chat=curChat(), u=universeById(chat.universeId);
    if(!(u.locations||[]).length) u.locations=[{id:"loc_t",name:"Kadikoy",desc:"a street"}];
    chat.locationId=u.locations[0].id;
    show('chat'); renderChat(); });

  const menuText=()=>pg.evaluate(()=>document.getElementById('chatMenu').textContent.replace(/\s+/g," "));

  console.log("\n[the menu says less]");
  ok("Bored is gone", (await menuText()).indexOf("Bored")===-1);
  ok("Move to area is gone", (await menuText()).indexOf("Move to area")===-1);
  ok("Nearby characters is gone", (await menuText()).indexOf("Nearby characters")===-1);
  ok("Set time / place is gone", (await menuText()).indexOf("Set time / place")===-1);

  console.log("\n[what stayed, and in which group]");
  const groups=async()=>pg.evaluate(()=>{
    const out={},m=document.getElementById('chatMenu'); let cur=null;
    for(const el of m.children){
      if(el.classList.contains('chatMenuSep')){ cur=el.textContent.trim(); out[cur]=[]; continue; }
      if(el.classList.contains('chatMenuNav')){
        cur="Go to"; out[cur]=[];
        for(const c of el.children) if(c.tagName==="BUTTON") out[cur].push(c.textContent.trim());
        continue;
      }
      if(cur&&el.tagName==="BUTTON") out[cur].push(el.textContent.trim());
    }
    return out; });
  const g=await groups();
  ok("Scene is the map plus the two chat resets", JSON.stringify(g.Scene||[])===JSON.stringify(
      ["World map travel · areas · who is here · time · calendar · end day","Clear chat window","Restart scene"])
      ? true : JSON.stringify(g.Scene));
  ok("Calendar & tasks moved into Story, at the top", (g.Story||[])[0]==="Calendar & tasks"
      ? true : JSON.stringify(g.Story));
  ok("Story holds the rest of the between-scenes business", JSON.stringify(g.Story||[])===JSON.stringify(
      ["Calendar & tasks","Call a character","Messages","Story State","Universe guide"])
      ? true : JSON.stringify(g.Story));
  ok("the six screens are still reachable", JSON.stringify(g["Go to"]||[])===JSON.stringify(
      ["Characters","Gallery","Memory","Diary","Settings","Debug"]) ? true : JSON.stringify(g["Go to"]));

  console.log("\n[the map picked up what the menu dropped]");
  await pg.evaluate(()=>openWorldMap());
  await pg.waitForTimeout(200);
  const bar=await pg.evaluate(()=>{
    const el=document.querySelector('.mapHubBar');
    return el?[...el.querySelectorAll('button')].map(b=>b.textContent.trim()):null; });
  ok("the map opened at all", Array.isArray(bar)?true:"no .mapHubBar — universe has no locations?");
  ok("Areas, Who is here and Time & place are on the map",
      JSON.stringify(bar)===JSON.stringify(["Areas","Who is here","Time & place","Calendar","End Day"])
      ? true : JSON.stringify(bar));
  ok("Bored is gone from the map too", (bar||[]).indexOf("Bored")===-1);
  ok("each map button is wired to a function that exists", await pg.evaluate(()=>{
      for(const f of ["openSubMove","openCast","setSceneState","openCalendar","endDay"])
        if(typeof window[f]!=="function") return f+" is not a function";
      return true; }));
  await pg.evaluate(()=>{ if(typeof _mapClose==="function")_mapClose(); });

  console.log("\n[the globe left the input bar]");
  ok("there is no globe button beside the text field", await pg.evaluate(()=>
      !document.getElementById('langBtn')));
  ok("the language picker is a row in the modes menu", await pg.evaluate(()=>
      !!document.querySelector('#modesMenu #langRow')));
  ok("the row shows the language currently set", await pg.evaluate(()=>{
      setStoryLang('tr'); reflectModes();
      const v=document.getElementById('langRowSub').textContent;
      return v===STORY_LANGS.tr.native ? true : "row reads "+v; }));
  ok("picking a language still writes it through", await pg.evaluate(()=>{
      setStoryLang('de');
      return storyLang()==="de" && store.raw(K.storyLang,"")==="de"
        ? true : "storyLang is "+storyLang(); }));
  ok("opening the picker closes the modes menu behind it", await pg.evaluate(()=>{
      toggleModesMenu(); const wasOpen=document.getElementById('modesMenu').classList.contains('open');
      document.getElementById('langRow').click();
      return (wasOpen && !document.getElementById('modesMenu').classList.contains('open')
              && document.getElementById('langMenu').classList.contains('open'))
        ? true : "modes open "+document.getElementById('modesMenu').classList.contains('open'); }));
  ok("the language row never lights up as if it were a toggle", await pg.evaluate(()=>{
      const r=document.getElementById('langRow');
      for(let i=0;i<4;i++){ reflectModes(); if(r.classList.contains('on')) return "lit on pass "+i; }
      return true; }));

  console.log("\n[the taller menu still fits a landscape phone]");
  ok("every playback row is reachable at 915x412", await pg.evaluate(async()=>{
      // the menu grows upward from the input bar; one more row than the screen is tall used to
      // push the top row off the viewport where nothing could tap it.
      const m=document.getElementById('modesMenu');
      m.classList.add('open'); await new Promise(r=>setTimeout(r,60));
      const b=m.getBoundingClientRect();
      const inside=b.top>=-1 && b.bottom<=innerHeight+1;
      const scrolls=m.scrollHeight>m.clientHeight ? getComputedStyle(m).overflowY==="auto" : true;
      m.classList.remove('open');
      return (inside&&scrolls) ? true : "menu "+Math.round(b.top)+".."+Math.round(b.bottom)+" of "+innerHeight; }));

  ok("no page errors", errs.length===0?true:errs.join(" | "));
  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close(); process.exit(fail?1:0);
})();
