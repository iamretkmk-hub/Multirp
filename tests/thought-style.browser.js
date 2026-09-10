const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x||c).slice(0,300));} };

  for(const theme of ["dark","light"]){
    const pg=await b.newPage({viewport:{width:412,height:915}});
    const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
    await pg.goto('file:///home/user/Multirp/index.html'); await pg.waitForTimeout(2300);
    await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
    await pg.waitForTimeout(800);
    await pg.evaluate(t=>{
      state.theme=t; applyTheme();
      const uni=state.universes[0];
      if(!state.personas.some(p=>p.id==="p_t"))
        state.personas.push({id:"p_t",name:"Duygu",universeId:uni.id,instructions:"x",
          personality:"x",backstory:"x",style:"x",goals:"x",look:{}});
      const chat=curChat(); chat.presentIds=["p_t"]; state.user="Kemal";
      chat.messages=[{mid:"t2",role:"assistant",speaker:"Duygu",speakerId:"p_t",present:["p_t"],
        content:'*She sets the glass down.*\n\n"It was fine."\n\n_A week now, and still no call._\n\n"You?"'}];
      show('chat'); renderChat();
    },theme);
    await pg.waitForTimeout(500);

    console.log("\n["+theme+"]");
    ok("the thought carries its own class", await pg.evaluate(()=>
        !!document.querySelector('.bubble .thg')));
    ok("narration did not get it", await pg.evaluate(()=>{
        const n=[...document.querySelectorAll('.bubble strong')].some(e=>e.classList.contains('thg'));
        return !n; }));
    ok("the thought is dimmer than the speech around it", await pg.evaluate(()=>{
        const thg=document.querySelector('.bubble .thg');
        const body=document.querySelector('.bubble .body');
        const lum=c=>{const m=getComputedStyle(c).color.match(/[\d.]+/g).map(Number);
          return 0.2126*m[0]+0.7152*m[1]+0.0722*m[2];};
        const bg=getComputedStyle(document.querySelector('.bubble')).backgroundColor.match(/[\d.]+/g).map(Number);
        const bgl=0.2126*bg[0]+0.7152*bg[1]+0.0722*bg[2];
        // "dimmer" = closer to the bubble background than the ordinary text is
        const dt=Math.abs(lum(thg)-bgl), db=Math.abs(lum(body)-bgl);
        return dt<db ? true : "thought contrast "+Math.round(dt)+" vs body "+Math.round(db); }));
    ok("but still readable, not washed out", await pg.evaluate(()=>{
        const thg=document.querySelector('.bubble .thg');
        const m=getComputedStyle(thg).color.match(/[\d.]+/g).map(Number);
        const bg=getComputedStyle(document.querySelector('.bubble')).backgroundColor.match(/[\d.]+/g).map(Number);
        const L=c=>{const s=c.map(v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4);});
          return 0.2126*s[0]+0.7152*s[1]+0.0722*s[2];};
        const a=L(m), c=L(bg);
        const ratio=(Math.max(a,c)+0.05)/(Math.min(a,c)+0.05);
        return ratio>=3 ? true : "contrast ratio only "+ratio.toFixed(2); }));
    ok("it reads as an aside, not as prose", await pg.evaluate(()=>{
        const cs=getComputedStyle(document.querySelector('.bubble .thg'));
        return cs.fontStyle==="italic" && parseFloat(cs.borderLeftWidth)>0; }));
    ok("three visibly different weights on one reply", await pg.evaluate(()=>{
        const w=e=>getComputedStyle(e).fontWeight;
        const narr=w(document.querySelector('.bubble strong'));
        const thg=w(document.querySelector('.bubble .thg'));
        return narr!==thg; }));
    ok("no page errors", errs.length===0?true:errs.join(" | "));
    await pg.close();
  }

  console.log("\n[the markup itself]");
  const pg=await b.newPage({viewport:{width:412,height:915}});
  await pg.goto('file:///home/user/Multirp/index.html'); await pg.waitForTimeout(2300);
  ok("md tags a thought and leaves narration alone", await pg.evaluate(()=>{
      const h=md('*a step closer* "a line" _a thought_');
      return h.indexOf('<em class="thg">a thought</em>')>-1
          && h.indexOf('<strong>a step closer</strong>')>-1; }));
  ok("an ordinary underscore in a word is untouched", await pg.evaluate(()=>
      md("snake_case_name").indexOf("thg")===-1));
  await pg.close();

  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close(); process.exit(fail?1:0);
})();
