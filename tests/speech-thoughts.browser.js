/* v150.101 — AN INNER THOUGHT IS NEVER SPOKEN. "_Bu özgüven beni delirtiyor…_" lost its underscores in the speech
   clean-up and was read aloud with the narration. Only narration and dialogue are voiced: thought spans are dropped
   before a reply is split into spoken pieces, and by the shared clean-up every speaking path uses.
   Run: node tests/speech-thoughts.browser.js */
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:process.env.SM_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage({viewport:{width:412,height:915}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file://'+require('path').resolve(__dirname,'..','index.html')); await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(900);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x===undefined?c:x).slice(0,900));} };

  const R=await pg.evaluate(()=>{
    const jobs=[], calls=[];
    window._inworldFetchPcm=async(t,v)=>{ calls.push({t,v}); return new Float32Array(4); };
    window._inworldStream=(t,v)=>{ calls.push({t,v}); return {chunks:[],done:true,wait:()=>Promise.resolve()}; };
    window._enqueueDub=j=>{ jobs.push({kind:j.kind}); };
    const burcu={id:"st_b",name:"Burcu",voiceId:"Olivia"};
    const REPLY='_Bu özgüven beni delirtiyor ama elim kolum bağlı._\n\n"Görcez bakalım o senedin vadesini."\n\n*Güneş gözlüğümü takıp çıkışa dönüyorum.* _Hiç değişmeyecek._';
    const run=(content,opts)=>{ jobs.length=0; calls.length=0;
      Object.assign(state,{autoSpeak:true,narrOn:true,narrMode:false,narrVoice:"Narr",narrSelf:false},opts||{});
      autoSpeakMsg({mid:"x"+Math.random(),role:"assistant",speakerId:"st_b",content},burcu);
      return calls.map((c,i)=>(jobs[i]||{}).kind+":"+c.t); };
    const r={};
    r.segs=speechSegments(REPLY).map(x=>x.kind+":"+x.text);
    r.narr=run(REPLY);
    r.dialOnly=run(REPLY,{narrOn:false});
    r.clean=ttsCleanText('_I hate this._ *She smiles.* "Of course."');
    r.quoteKept=speechSegments('"Say _that_ again." _He means it._').map(x=>x.kind+":"+x.text);
    jobs.length=0; calls.length=0; Object.assign(state,{autoSpeak:true,narrOn:true,narrMode:false,userVoice:"Dennis"});
    speakPlayerTurn({mid:"p1",role:"user",content:'*I sit.* _She is lying._ "Thanks."'}); r.player=calls.map((c,i)=>(jobs[i]||{}).kind+":"+c.t);
    state.autoSpeak=false; state.narrOn=false;
    return r; });
  ok("the reply's pieces: the narration and the dialogue, no thought", JSON.stringify(R.segs)==='["dial:Görcez bakalım o senedin vadesini.","narr:Güneş gözlüğümü takıp çıkışa dönüyorum."]', JSON.stringify(R.segs));
  ok("spoken with the narration voice on: the line and the narration only", R.narr.join(" | ")==="dial:Görcez bakalım o senedin vadesini. | narr:Güneş gözlüğümü takıp çıkışa dönüyorum.", R.narr.join(" | "));
  ok("spoken with it off: the dialogue only", R.dialOnly.join(" | ")==="dial:Görcez bakalım o senedin vadesini.", R.dialOnly.join(" | "));
  ok("the shared speech clean-up drops a thought too (manual dub, books, clips)", R.clean==='"Of course."', R.clean);
  ok("underscores inside a quote are speech, not a thought", /^dial:Say/.test(R.quoteKept[0]||"")&&R.quoteKept.length===1, JSON.stringify(R.quoteKept));
  ok("the player's own thought is not spoken either", R.player.join(" | ")==="narr:I sit. | dial:Thanks.", R.player.join(" | "));
  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close(); process.exit(fail?1:0);
})();
