/* v41.7 — A NAME IS FOLDED TO ASCII, NEVER STRIPPED OF IT.
   Two places have to reduce a name to plain letters: the chat API's `name` field, which takes only
   [A-Za-z0-9_-], and a download filename. Both did it by DELETING everything else, which does not
   reduce a Turkish name — it destroys it. "Özlem Özuçak" came out as "zlem_zu_ak": every Turkish
   letter dropped and an underscore left in the hole. That string is the speaker label on every
   line of the transcript the model reads, so the model was told the character is called
   zlem_zu_ak — and a saved picture of her was named storymind__<stamp>.
   The name itself must NOT be folded anywhere else: the prose the model reads has to say Özlem.
   Run: node tests/turkish-names.browser.js */
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage({viewport:{width:412,height:915}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file:///home/user/Multirp/index.html'); await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(900);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x||c).slice(0,400));} };

  console.log("\n[the fold itself]");
  const f=await pg.evaluate(()=>({
    ozlem:asciiFold("Özlem Özuçak"),
    cagri:asciiFold("Çağrı Şahin"),
    /* (!) The two Turkish letters that cannot be decomposed. ı is not an i with a removable mark
       on top, and ı/i, İ/I must not collapse into each other — which is why Turkish is listed
       explicitly rather than left to NFD. */
    dotless:asciiFold("ı"), dotted:asciiFold("İ"),
    every:asciiFold("çÇğĞıİöÖşŞüÜ"),
    /* everything else rides on NFD, so no other language needs a table */
    other:asciiFold("José Müller Ångström Ñoño"),
    ascii:asciiFold("Plain Name 42"),
    empty:asciiFold(""), nul:asciiFold(null)
  }));
  ok("Turkish folds to the nearest letter", f.ozlem==="Ozlem Ozucak" && f.cagri==="Cagri Sahin",
     JSON.stringify([f.ozlem,f.cagri]));
  ok("the dotless and dotted i keep their case", f.dotless==="i" && f.dotted==="I",
     JSON.stringify([f.dotless,f.dotted]));
  ok("every Turkish letter is covered", f.every==="cCgGiIoOsSuU", f.every);
  ok("other languages fold via NFD, unlisted", f.other==="Jose Muller Angstrom Nono", f.other);
  ok("plain ASCII is untouched", f.ascii==="Plain Name 42", f.ascii);
  ok("empty and null are safe", f.empty==="" && f.nul==="", JSON.stringify([f.empty,f.nul]));

  console.log("\n[what reaches the model]");
  const r=await pg.evaluate(()=>{
    const uni=state.universes[0];
    const NAME="Özlem Özuçak", USER="Çağrı Şahin";
    if(!state.personas.some(x=>x.id==="p_tr"))
      state.personas.push({id:"p_tr",name:NAME,universeId:uni.id,instructions:"x",personality:"x",
        backstory:"x",style:"x",goals:"x",look:{}});
    const p=state.personas.find(x=>x.id==="p_tr"); const chat=curChat();
    chat.presentIds=["p_tr"]; state.user=USER;
    chat.messages=[{mid:"t0",role:"user",content:"Selam.",present:["p_tr"]},
      {mid:"t1",role:"assistant",speaker:NAME,speakerId:"p_tr",content:'"Günaydın, nasılsın?"',present:["p_tr"]}];
    const hist=castHistory(chat,p);
    const inj={recent:[],diary:[],longterm:[]};
    const blocks=Object.assign({},
      buildCharPromptBlocks(p,[],inj,USER,{chat,targetName:USER,targetId:"__user__"}),
      buildTailBlocks({chat,selfP:p,selfId:p.id,selfName:p.name,targetName:USER,
        targetId:"__user__",multi:false,injected:inj}));
    const prose=Object.keys(blocks).filter(k=>k.charAt(0)!=="_").map(k=>String(blocks[k]||"")).join("\n");
    return {name:sanitizeName(NAME), user:sanitizeName(USER), file:mediaFilename("png",NAME),
            histNames:[...new Set(hist.map(m=>m.name))].sort(),
            prose, content:hist.map(m=>m.content).join(" ")};
  });
  ok("the API name field is readable, not gutted", r.name==="Ozlem_Ozucak", r.name);
  ok("and so is the player's", r.user==="Cagri_Sahin", r.user);
  ok("no name collapses to nothing", !/^_|_$|__/.test(r.name+r.user), r.name+" / "+r.user);
  ok("every speaker label in the transcript is folded, not stripped",
     r.histNames.join(",")==="Cagri_Sahin,Ozlem_Ozucak", r.histNames.join(","));
  /* (!) THE FOLD IS FOR THE API FIELD ONLY. The prose the model actually reads must still call her
     Özlem — folding it there would be the same bug wearing a nicer mask. */
  ok("the real name is intact in the prompt blocks", r.prose.indexOf("Özlem Özuçak")>=0);
  ok("so is the player's real name", r.prose.indexOf("Çağrı Şahin")>=0);
  ok("no folded form leaks into the prose", r.prose.indexOf("Ozlem_Ozucak")<0 && r.prose.indexOf("Ozlem Ozucak")<0);
  ok("Turkish in the dialogue itself is untouched", /Günaydın, nasılsın\?/.test(r.content), r.content.slice(0,80));

  console.log("\n[downloads]");
  ok("a saved file carries the name instead of a hole",
     /^storymind_ozlem-ozucak_/.test(r.file), r.file);

  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close(); process.exit(fail?1:0);
})();
