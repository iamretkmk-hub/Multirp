/* v150.82 — asked: "Add spoken delivery to the character's auto-RP path, but only the spoken delivery, not the heat spoken
   delivery. Heat or not, the player only gets the standard spoken delivery prompt."
   Covered: with voicing on (autoSpeak or narration mode) the auto-RP narrator's system prompt carries the standard spoken
   delivery (the "Voice delivery" fragment's "voiced" option, as the player has it); never the heat one, heat on or off;
   nothing when voicing is off; an edited "voiced" text is the one sent; an empty/templated one falls back to the block.
   Run: NODE_PATH=/path/to/node_modules node tests/autorp-voice.browser.js */
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:process.env.SM_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage({viewport:{width:412,height:915}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file://'+require('path').resolve(__dirname,'..','index.html')); await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(800);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x===undefined?c:x).slice(0,700));} };
  await pg.evaluate(()=>{
    window.__run=async(o)=>{
      Object.assign(state,{key:"k",user:"Emre",autoSpeak:!!o.autoSpeak,narrMode:!!o.narrMode,heatOn:!!o.heat});
      const c=curChat(); c.messages=[{mid:"a1",role:"assistant",speaker:"Ayse",content:"\"Hi.\""}];
      if(o.heat)c._heatBeat={total:"2",n:"1"};
      let sys=""; window.chatCompletion=async(msgs)=>{ sys=String((msgs.find(m=>m.role==="system")||{}).content||""); return "*waves* \"Hi there.\""; };
      await narratePlayerTurn("hi",c,{});
      c._heatBeat=null;
      return sys;
    };
  });
  const off=await pg.evaluate(()=>__run({}));
  ok("voicing off: no spoken delivery", !/SPOKEN DELIVERY/.test(off), off.slice(-300));
  const on=await pg.evaluate(()=>__run({autoSpeak:true}));
  ok("voicing on: the standard spoken delivery is in the narrator's prompt", /SPOKEN DELIVERY — THIS REPLY IS READ ALOUD/.test(on)&&!/HEAT OF THE MOMENT, READ ALOUD/.test(on), on.slice(-400));
  const heat=await pg.evaluate(()=>__run({autoSpeak:true,heat:true}));
  ok("heat on: still the standard one, never the heat one", /SPOKEN DELIVERY — THIS REPLY IS READ ALOUD/.test(heat)&&!/HEAT OF THE MOMENT, READ ALOUD/.test(heat), heat.slice(-400));
  const narr=await pg.evaluate(()=>__run({narrMode:true}));
  ok("narration mode counts as voicing", /SPOKEN DELIVERY — THIS REPLY IS READ ALOUD/.test(narr));
  const edited=await pg.evaluate(async()=>{
    const list=JSON.parse(JSON.stringify(fragList())); const f=list.find(x=>x.id==="delivery"); const o=f.options.find(x=>x.id==="voiced");
    o.text="## MY OWN DELIVERY RULES for {{user}}"; state.fragments=list;
    const a=await __run({autoSpeak:true});
    o.text=""; state.fragments=list;
    const b=await __run({autoSpeak:true});
    state.fragments=null;
    return {a,b};
  });
  ok("an edited 'voiced' text is the one sent, filled for the player", /MY OWN DELIVERY RULES for Emre/.test(edited.a)&&!/THIS REPLY IS READ ALOUD/.test(edited.a), edited.a.slice(-300));
  ok("an empty one falls back to the standard block", /SPOKEN DELIVERY — THIS REPLY IS READ ALOUD/.test(edited.b), edited.b.slice(-300));
  ok("no page errors", errs.length===0?true:errs.join(" | "));
  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close(); process.exit(fail?1:0);
})();
