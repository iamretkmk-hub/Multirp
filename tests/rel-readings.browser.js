/* v149.1 — THE PRIVATE READINGS AS BEHAVIOUR. Reported: "trust: 30, desire: 0, fear: 0…" is terrible for a model —
   it ignores the numbers or overplays them. Asked for: a few bands per axis, each saying what the reading CHANGES in
   how the character acts (not a feeling); one-sided scales for familiarity, jealousy, fear and agitation; empty and
   faint readings left out; and the readings placed right before the risk in the drives writer — everywhere they are
   used.
   Run: NODE_PATH=/path/to/node_modules node tests/rel-readings.browser.js */
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:process.env.SM_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage();
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file://'+require('path').resolve(__dirname,'..','index.html'));
  await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(600);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x===undefined?c:x).slice(0,900));} };
  const rec=`(v)=>{ const o=blankRel(); Object.keys(v).forEach(k=>{ if(REL_FAST.indexOf(k)>=0){ o.st[k]=v[k]; o[k]=v[k]; } else o[k]=v[k]; }); return o; }`;

  console.log("\n[the table]");
  const T=await pg.evaluate(()=>{
    const bad=[], count={};
    Object.keys(REL_READINGS).forEach(k=>{ const t=REL_READINGS[k];
      count[k]=(t.pos||[]).length+(t.neg||[]).length;
      [].concat(t.pos||[],t.neg||[]).forEach(line=>{
        [{},{self:"Ayla",target:"Emre"},{target:"Emre"}].forEach(o=>{ const s=_relReadFill(line,o);
          if(/[{}\[\]|]/.test(s))bad.push(k+": "+s);
          if(/\b(feel|feels|trust them|love|hate|fond|afraid|angry|jealous)\b/i.test(s))bad.push("feeling word — "+k+": "+s); }); }); });
    return {bad,count,axes:Object.keys(REL_READINGS).sort().join(",")};
  });
  ok("all nine axes, a few bands each (6 for two-sided, 3 for one-sided), not a step per ten points",
     T.axes==="affection,agitation,comfort,desire,familiarity,fear,jealousy,respect,trust"&&["trust","affection","respect","comfort","desire"].every(k=>T.count[k]===6)&&["familiarity","jealousy","fear","agitation"].every(k=>T.count[k]===3), JSON.stringify(T.count));
  ok("every line renders cleanly for \"you\" and for a named character, and names no feeling", T.bad.length===0, T.bad.join("\n        "));

  console.log("\n[rendering — the example from the report]");
  const R=await pg.evaluate(new Function("return ("+`()=>{ const mk=${rec};
    const o=mk({trust:30,familiarity:60,respect:15,comfort:5});
    return {you:relReadings(o,{target:"Emre"}), her:relReadings(o,{self:"Ayla",target:"Emre"}),
      oneSided:relReadings(mk({familiarity:-60,jealousy:-50,fear:-40,agitation:-80}),{target:"Emre"}),
      distrust:relReadings(mk({trust:-50}),{target:"Emre"}), empty:relReadings(mk({}),{target:"Emre"}),
      nerve:relReadings(mk({comfort:-50,fear:30}),{target:"Emre"}) }; }`+")")());
  ok("two lines: trust, then familiarity; respect 15 and comfort 5 are faint and left out",
     R.you.length===2&&/take Emre at face value on ordinary things/.test(R.you[0])&&/know Emre's habits and history/.test(R.you[1]), JSON.stringify(R.you));
  ok("third person reads as her", /^Ayla takes Emre at face value .* keeps private matters to themselves\.$/.test(R.her[0])&&/^Ayla knows Emre's habits/.test(R.her[1]), JSON.stringify(R.her));
  ok("familiarity, jealousy, fear and agitation have no negative side: nothing is written for them", R.oneSided.length===0, JSON.stringify(R.oneSided));
  ok("trust does: -50 is keeping it short and giving nothing personal", R.distrust.length===1&&/keep conversations with Emre short and give nothing personal away/.test(R.distrust[0]), JSON.stringify(R.distrust));
  ok("a pair with nothing in it sends nothing", R.empty.length===0);
  ok("unease and fear are one nerve: only the stronger is written", R.nerve.length===1&&/physical distance/.test(R.nerve[0]), JSON.stringify(R.nerve));

  console.log("\n[the drives writer]");
  const D=await pg.evaluate(new Function("return ("+`async()=>{ const mk=${rec};
    let sent=null; window.chatCompletion=async(m,mo,o)=>{ if(/Drives/.test((o&&o.dbg)||""))sent=m; return '{"toward":"x","against":"y"}'; };
    const uni=state.universes[0]; state.curUniverse=uni.id;
    state.personas=[{id:"p_a",name:"Ayla",universeId:uni.id,personality:"x",instructions:"x",look:{},relationships:{}}];
    state.user="Emre"; state.key="k"; state.relOn=true;
    const c=curChat(); c.universeId=uni.id; c.presentIds=["p_a"]; c.messages=[{mid:"z1",role:"user",content:"Hi.",present:["p_a"]}];
    c.rel={}; c.rel[relDirKey("p_a","__user__")]=mk({trust:35,familiarity:55,desire:0,fear:0,comfort:10});
    await _writePsyche(c,state.personas[0],"__user__","Emre","sig",{line:{name:"Emre",text:"Hi."}});
    return sent?sent.map(x=>x.content).join("\\n\\n"):""; }`+")")());
  ok("no numbers, no \"desire: 0\"", !!D&&!/\b(trust|desire|fear|comfort|familiarity):\s*-?\d/.test(D)&&!/PRIVATE READINGS/.test(D), D.slice(-900));
  ok("the readings as behaviour, under HOW Ayla STANDS WITH Emre", /HOW Ayla STANDS WITH Emre — private, never stated/.test(D)&&/Ayla takes Emre at face value/.test(D)&&/Ayla knows Emre's habits/.test(D), D.slice(-900));
  ok("placed right before the risk", D.indexOf("STANDS WITH")>0&&D.indexOf("WHAT IS AT RISK RIGHT NOW")>D.indexOf("STANDS WITH")&&!/STANDS WITH[\s\S]*WHAT HAS JUST BEEN HAPPENING[\s\S]*WHAT IS AT RISK/.test(D), D.slice(D.indexOf("WHERE THEY ARE"),D.indexOf("WHERE THEY ARE")+1500));
  ok("the prompt's TRUST line points at it", /- TRUST — HOW \{\{self\}\} STANDS WITH \{\{target\}\} \(just above the risk\)/.test(await pg.evaluate(()=>DEFAULT_PSYCHE)));

  console.log("\n[everywhere else a model reads a reading]");
  const E=await pg.evaluate(new Function("return ("+`()=>{ const mk=${rec};
    const o=mk({trust:50,affection:-30,familiarity:40,jealousy:-60,desire:45,agitation:5});
    const nameById=id=>id==="__user__"?"Emre":"X";
    const c=curChat(); c.rel={}; c.rel[relDirKey("p_a","__user__")]=o;
    const holder=holderRelationshipBlock(c,{id:"p_a",name:"Ayla"},c.gameDay||1,nameById);
    return {desc:relDescription(o,{self:"Ayla",target:"Emre"}), ui:relDescription(o),
      mom:relMomentaryProse(o,{self:"Ayla",target:"Emre"}), con:relConsideredProse(o,{self:"Ayla",target:"Emre"}), holder,
      narr:relConsideredNarrative(mk({familiarity:-60,trust:12,affection:40})), narrFast:relMomentaryNarrative(mk({fear:-60,desire:15})) }; }`+")")());
  ok("the fallback description a director or a bio reads is behaviour, not \"trust +50\"", /^Roughly: Ayla tells Emre things/.test(E.desc)&&!/[+-]\d/.test(E.desc), E.desc);
  ok("(the relationship screen, which has the bars beside it, keeps its numbers)", /trust \+50/.test(E.ui), E.ui);
  ok("the live and settled readings the world engines read are behaviour, not \"strongly intense attraction\"",
     /Ayla looks for reasons to be close to Emre/.test(E.mom)&&/Ayla tells Emre things/.test(E.con)&&/Ayla is cool with Emre/.test(E.con)&&!/strongly|clearly|overwhelmingly|faintly/.test(E.mom+E.con), JSON.stringify({mom:E.mom,con:E.con}));
  ok("the intent former's line carries them", /Ayla → Emre: standing: Ayla tells Emre things/.test(E.holder)&&!/secure & generous|clearly|strongly/.test(E.holder), E.holder);
  ok("the feelings narrative: nothing under the faint line, and no \"stranger\" for negative familiarity", /you are glad enough|fond of them/.test(E.narr)&&!/stranger|salt/.test(E.narr), E.narr);
  ok("…and no \"steady around them\" for negative fear, nor a faint want", E.narrFast==="", E.narrFast);

  console.log("\n[the fast read's context]");
  const F=await pg.evaluate(()=>{ const src=String(runShortTermRel); return {nums:/REL_SLOW\.map\(k=>`\$\{k\} \$\{o\[k\]\|\|0\}`\)/.test(src), readings:/relReadings\(o,\{self:fromP\.name,target:_u,which:"slow"\}\)/.test(src)}; });
  ok("its settled context is readings (its own four scored axes stay numbers)", !F.nums&&F.readings, JSON.stringify(F));

  console.log("\n[a stored drives prompt is updated in place]");
  await pg.evaluate(()=>{ const B=(DEFAULT_PSYCHE.match(/- TRUST — HOW \{\{self\}\} STANDS WITH[^\n]*/)||[""])[0];
    store.setRaw(K.psychePrompt,DEFAULT_PSYCHE.replace(B,"- TRUST — the PRIVATE READINGS and the settled view of {{target}}: a risk with someone trusted weighs less than the same risk with someone they are wary of.")+"\nMY PSYCHE EDIT"); });
  await pg.reload(); await pg.waitForTimeout(2400);
  const M=await pg.evaluate(()=>({moved:/- TRUST — HOW \{\{self\}\} STANDS WITH/.test(state.psychePrompt)&&!/PRIVATE READINGS/.test(state.psychePrompt), kept:/MY PSYCHE EDIT/.test(state.psychePrompt)}));
  ok("the TRUST line is swapped, the player's edit kept", M.moved&&M.kept, JSON.stringify(M));

  ok("no page errors", errs.length===0?true:errs.join(" | "));
  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close(); process.exit(fail?1:0);
})();
