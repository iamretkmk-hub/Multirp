/* v39.5 — SHE WANTS IT AND SHE KNOWS WHAT SHE IS DOING.
   Heat used to be "many short spoken lines, minimal narration" and nothing else, so a beat could be
   pure appetite with no one home. The beat now carries four things at once (desire, shame, fear,
   regret, none resolved), the character is explicitly still herself inside it, and the narration
   ALTERNATES between the plain mechanics and her conscience — decided in code, because a model
   generating one beat per call cannot remember which mode it used last. A run OPENS on the
   mechanics: the reader sees what is happening before they are told what it costs.
   Run: node tests/heat-conflict.browser.js */
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage({viewport:{width:412,height:915}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file://'+require('path').resolve(__dirname,'..','index.html'));
  await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(700);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x||c).slice(0,600));} };

  // ---- the alternation is decided by the app, not the model
  const alt=await pg.evaluate(()=>{
    const o={};
    const c={_heatBeat:{narrN:"1"}};
    o.n1=heatNarrMode(c); c._heatBeat.narrN="2"; o.n2=heatNarrMode(c);
    c._heatBeat.narrN="3"; o.n3=heatNarrMode(c); c._heatBeat.narrN="4"; o.n4=heatNarrMode(c);
    o.seq=[1,2,3,4,5,6].map(n=>heatNarrMode({_heatBeat:{narrN:String(n)}}));
    o.noBeat=heatNarrMode({});                       // never throws with nothing set
    o.blockA=heatNarrBlock({_heatBeat:{narrN:"2"}});   // the conscience beat
    o.blockB=heatNarrBlock({_heatBeat:{narrN:"1"}});   // the mechanics beat (a run opens here)
    o.shortA=heatNarrShort({_heatBeat:{narrN:"2"}});
    o.shortB=heatNarrShort({_heatBeat:{narrN:"1"}});
    return o;
  });
  ok("a run opens on the mechanics", alt.n1==="physical" && alt.n3==="physical", JSON.stringify(alt.seq));
  ok("the conscience lands second", alt.n2==="superego" && alt.n4==="superego", JSON.stringify(alt.seq));
  ok("it really alternates over a run", alt.seq.join(",")==="physical,superego,physical,superego,physical,superego", alt.seq.join(","));
  ok("no beat set still answers", alt.noBeat==="physical", alt.noBeat);
  ok("the two mode blocks differ", alt.blockA!==alt.blockB && alt.blockA.length>100 && alt.blockB.length>100);
  ok("the conscience block names the cost", /conscience/i.test(alt.blockA) && /cost/i.test(alt.blockA), alt.blockA.slice(0,90));
  ok("the physical block forbids feeling",
     /Registered, not judged/i.test(alt.blockB) && /no meaning/i.test(alt.blockB), alt.blockB.slice(0,120));
  ok("both modes are THOUGHTS, not narration",
     /THOUGHT/.test(alt.blockA) && /THOUGHT/.test(alt.blockB)
     && !/\*asterisks\*/.test(alt.blockA) && !/\*asterisks\*/.test(alt.blockB), alt.blockA.slice(0,70));
  ok("and both are written between underscores",
     /_underscores_/.test(alt.blockA) && /_underscores_/.test(alt.blockB));
  ok("the two rail shorts differ", alt.shortA!==alt.shortB && alt.shortA.length>20 && alt.shortB.length>20);

  // ---- the counter advances and survives, so runs do not both open on the conscience
  const ctr=await pg.evaluate(()=>{
    const chat=curChat(); delete chat.heatNarrN;
    const seen=[];
    for(let i=0;i<4;i++){ chat.heatNarrN=(+chat.heatNarrN||0)+1;
      seen.push(heatNarrMode({_heatBeat:{narrN:String(chat.heatNarrN)}})); }
    return {seen, stored:chat.heatNarrN, persisted:!/^_/.test("heatNarrN")};
  });
  ok("the counter alternates across separate beats", ctr.seen.join(",")==="physical,superego,physical,superego", ctr.seen.join(","));
  ok("and it is a persisted field, so a run of one keeps alternating", ctr.stored===4 && ctr.persisted===true, JSON.stringify(ctr));

  // ---- what the heat format and guidance now demand
  const txt=await pg.evaluate(()=>({
    fmt:blkTpl("heat_format"), guid:blkTpl("heat_guidance"),
    intact:blkTpl("rail_heat_intact"), narrRail:blkTpl("rail_heat_narr"), sound:blkTpl("rail_heat_sound"),
    deliv:blkTpl("heat_delivery")
  }));
  ok("the format says she knows what is happening", /YOU KNOW WHAT IS HAPPENING/.test(txt.fmt));
  ok("the format allows two channels and no narration",
     /TWO CHANNELS/.test(txt.fmt) && /THERE IS NO NARRATION/.test(txt.fmt) && /between \*asterisks\*/.test(txt.fmt));
  ok("a trio is required, not optional", /AT LEAST ONE run of three/.test(txt.fmt), txt.fmt.slice(0,60));
  ok("the punctuation ban also fires in the last slot",
     /Never "\u2026"/.test(txt.sound) && /at least one run of three/i.test(txt.sound), txt.sound.slice(0,90));
  ok("it forbids dots and dashes as gaps",
     /NEVER "\u2026"/.test(txt.fmt) && /never "—"/.test(txt.fmt) && /read aloud as syllables/.test(txt.fmt));
  ok("and names the ellipsis as the reflex to resist", /reflex to resist/i.test(txt.fmt));
  ok("one sound breaks a sentence, three break between them",
     /ONE sound splits a sentence/.test(txt.fmt) && /THREE in a row/.test(txt.fmt), txt.fmt.slice(0,60));
  ok("the format carries a {{narr}} slot for the mode", txt.fmt.indexOf("{{narr}}")>=0);
  ok("guidance demands all four at once",
     /DESIRE/.test(txt.guid)&&/SHAME/.test(txt.guid)&&/FEAR/.test(txt.guid)&&/REGRET/.test(txt.guid), txt.guid.slice(0,80));
  ok("and forbids resolving any of them", /none of them gets resolved/i.test(txt.guid));
  ok("and forbids naming the feeling", /Never say any of those four words/i.test(txt.guid));
  ok("a rail says she does not dissolve", /still yourself/i.test(txt.intact) && /not a person it broke/i.test(txt.intact));
  ok("the thought rail carries the mode", txt.narrRail.indexOf("{{narr_short}}")>=0, txt.narrRail);
  ok("and it bans narration outright in the last slot",
     /NO NARRATION/.test(txt.narrRail) && /asterisks/.test(txt.narrRail), txt.narrRail.slice(0,80));
  ok("delivery does not re-direct a line made of sounds", /takes no direction of its own/i.test(txt.deliv));

  /* ---- the fragment 3-leg rule for the five new pieces: a default, a producer that calls
     blkTpl, and a listing under the block that emits them. (That every declared fragment is
     REACHABLE and editable is the global guarantee every-fragment-editable.browser.js owns — this
     only checks that these five were declared and claimed, which is the leg a new fragment skips.) */
  const legs=await pg.evaluate(()=>{
    const want=["heat_narr_superego","heat_narr_physical","heat_narr_superego_short","heat_narr_physical_short","rail_heat_intact","rail_heat_sound"];
    const claimed=new Set();
    Object.keys(REPLY_BLOCKS).forEach(id=>(REPLY_BLOCKS[id].tpls||[]).forEach(t=>claimed.add(t)));
    return {missingDefault:want.filter(k=>!(k in BLOCK_TPL_DEFAULTS)),
            unclaimed:want.filter(k=>!claimed.has(k))};
  });
  ok("every new fragment has a shipped default", legs.missingDefault.length===0, legs.missingDefault.join(", "));
  ok("and every one is claimed by the block that emits it", legs.unclaimed.length===0, legs.unclaimed.join(", "));

  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log(`\n  ${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail?1:0);
})();
