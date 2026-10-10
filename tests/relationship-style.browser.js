/* v150.103 — A RELATIONSHIP ENTRY IS THE STANDING STATE BETWEEN TWO PEOPLE, NOT A MEMORY. The daily read was told to "add
   what was learned" (its example a remembered line), so updates read like a badly written memory: "At a window table he
   named İskender … asked only for 'ben de' back; you refused it and went to your daughter … He is easier to be near than he
   has any right to be." One rule (REL_ENTRY_STYLE) now reaches every writer of an entry: who they are to each other, the
   history summed up, what now stands between them — never a quotation, a scene, the day retold or a mood; the new folded
   into the sentence it belongs to; an entry already written as a story rewritten into this form. The tie is a role only.
   Run: node tests/relationship-style.browser.js */
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

  const R=await pg.evaluate(async()=>{
    const r={style:REL_ENTRY_STYLE, rel:DEFAULT_REL, gen:DEFAULT_RELGEN};
    // the two inline requests: the pair read and the batched read
    const src=document.documentElement.innerHTML;
    r.pairMsg=/today changed something DURABLE between \$\{fromP\.name\} and \$\{tName\}[^`]*never a scene, never anyone's exact words \(no quotation marks\), never the day retold, never a mood; fold the new into the sentence it belongs to/.test(src);
    r.batchMsg=/today changed something DURABLE between \$\{fromP\.name\} and them[^`]*never a scene, never anyone's exact words \(no quotation marks\), never the day retold, never a mood/.test(src);
    r.noAdd=!/, add what was learned, and leave out/.test(src);
    return r; });
  ok("the rule: the standing state as settled fact — who they are, the history summed up, what now stands between them",
     /standing state between the two of them, as settled fact, never a record of what happened/.test(R.style)&&/the history that made it, summed up in a clause/.test(R.style)&&/what now stands between them because of what happened/.test(R.style), R.style);
  ok("never a quotation, a scene, the day retold, or a mood", /no quotation marks at all/.test(R.style)&&/a scene: where it happened, who sat where/.test(R.style)&&/the day retold in order/.test(R.style)&&/a feeling or a mood/.test(R.style), R.style);
  ok("the new is folded in, not appended; a bad and a good example", /fold it into the sentence it belongs to/.test(R.style)&&/does not grow by a sentence a day/.test(R.style)&&/BAD:/.test(R.style)&&/GOOD:/.test(R.style));
  ok("the tracker carries the rule, with the old remembered-line example gone", R.rel.indexOf(R.style)>-1&&!/told you her sister only ever says/.test(R.rel), R.rel.slice(-2500));
  ok("an entry already written as a story is rewritten into this form", /If the FOUNDATION itself is written as a story \(quotations, a scene, the day retold, a mood\), rewrite it in this form even when nothing new was learned/.test(R.rel));
  ok("both requests the daily read sends carry it too (the pair and the batched read)", R.pairMsg===true&&R.batchMsg===true&&R.noAdd===true, JSON.stringify(R));
  ok("the generator carries it, and its tie is a role only, never a feeling or stance", R.gen.indexOf(R.style)>-1&&/naming the role or kinship only: never a feeling, a stance or a mood/.test(R.gen), R.gen.slice(0,1500));
  ok("a stored copy of the old tracker and generator prompts is upgraded once", await pg.evaluate(()=>{
      const oldRel=DEFAULT_REL.replace(REL_ENTRY_STYLE,"Add what was learned.").replace("HOW A RELATIONSHIP ENTRY IS WRITTEN","x");
      const oldGen=DEFAULT_RELGEN.replace(REL_ENTRY_STYLE,"");
      store.setRaw(K.relPrompt,oldRel); store.setRaw(K.relGenPrompt,oldGen); state.relPrompt=oldRel; state.relGenPrompt=oldGen;
      localStorage.removeItem("sm_pipesdone"); loadState();
      const r=state.relPrompt===DEFAULT_REL&&state.relGenPrompt===DEFAULT_RELGEN;
      store.del(K.relPrompt); store.del(K.relGenPrompt); localStorage.removeItem("sm_pipesdone"); loadState();
      return r?true:JSON.stringify({rel:state.relPrompt===DEFAULT_REL,gen:state.relGenPrompt===DEFAULT_RELGEN}); }));
  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close(); process.exit(fail?1:0);
})();
