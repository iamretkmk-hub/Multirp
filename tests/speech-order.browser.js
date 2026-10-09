/* v150.85 — a reply is spoken in the order it is written. With the narration voice on, narrSplit read all of a
   reply's narration and then all of its dialogue; now the reply is cut where it changes between narration and
   speech and each piece is queued in order (all synthesizing at once). Also: a long opening piece is cut after
   its first sentence so the voice starts sooner, and "Characters narrate in their own voice" reads narration in
   the speaker's voice through its own light effect.
   Run: NODE_PATH=/path/to/node_modules node tests/speech-order.browser.js */
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
    window._enqueueDub=j=>{ jobs.push({kind:j.kind,fx:j.fx}); };
    const ayla={id:"so_a",name:"Ayla",voiceId:"Olivia"};
    const run=(content,opts)=>{ jobs.length=0; calls.length=0;
      Object.assign(state,{autoSpeak:true,narrOn:true,narrMode:false,narrVoice:"Narr",narrSelf:false},opts||{});
      autoSpeakMsg({mid:"x"+Math.random(),role:"assistant",speakerId:"so_a",content},ayla);
      return {jobs:jobs.slice(),calls:calls.slice()}; };
    const r={};
    r.inter=run('*She looks up.* "You came." *She stands.* "Sit down."');
    r.inside=run('*She whispers "hi" and leaves.*');
    r.adj=run('"Hi." "Come in."');
    r.said=run('"Hi," she says, "come in."');
    r.off=run('*She looks up.* "You came." *She stands.* "Sit down."',{narrOn:false});
    r.self=run('*She looks up.* "You came."',{narrSelf:true});
    const long='*'+'She walks slowly across the long room and stops by the window. '+'The rain has not let up all evening and the street below is empty, the lamps reflected in the puddles one by one, and somewhere a dog barks twice and goes quiet again.*'+' "Hello."';
    r.fast=run(long);
    // the player
    jobs.length=0; calls.length=0; Object.assign(state,{autoSpeak:true,narrOn:true,narrMode:false,narrSelf:false,userVoice:"Dennis"});
    speakPlayerTurn({mid:"p1",role:"user",content:'*I sit.* "Thanks." *I look away.*'}); r.player={jobs:jobs.slice(),calls:calls.slice()};
    jobs.length=0; calls.length=0; speakPlayerTurn({mid:"p2",role:"user",content:'merhaba nasılsın'}); r.plain={jobs:jobs.slice(),calls:calls.slice()};
    jobs.length=0; calls.length=0; state.narrSelf=true; speakPlayerTurn({mid:"p3",role:"user",content:'*I sit.* "Thanks."'}); r.pself={jobs:jobs.slice(),calls:calls.slice()};
    state.narrSelf=false; state.autoSpeak=false; state.narrOn=false;
    // effect chains
    const ctx=new (window.AudioContext||window.webkitAudioContext)();
    r.fx={self:_fxNode(ctx,"self")!==_fxNode(ctx,true), narr:_fxNode(ctx,true)!==ctx.destination, none:_fxNode(ctx,false)===ctx.destination, same:_fxNode(ctx,"self")===_fxNode(ctx,"self")};
    r.ui=!!document.getElementById('setNarrSelf');
    return r;
  });
  const seq=x=>x.calls.map((c,i)=>x.jobs[i].kind+":"+c.v+":"+c.t).join(" | ");
  ok("narration and dialogue are spoken in the order written", seq(R.inter)==="narr:Narr:She looks up. | dial:Olivia:You came. | narr:Narr:She stands. | dial:Olivia:Sit down.", seq(R.inter));
  ok("a quote inside an *action* is dialogue where it stands", seq(R.inside)==="narr:Narr:She whispers | dial:Olivia:hi | narr:Narr:and leaves.", seq(R.inside));
  ok("two quotes side by side are one piece", seq(R.adj)==="dial:Olivia:Hi. Come in.", seq(R.adj));
  ok("a tag between two quotes is read where it stands", seq(R.said)==="dial:Olivia:Hi, | narr:Narr:she says, | dial:Olivia:come in.", seq(R.said));
  ok("with the narration voice off, only the dialogue is spoken (one clip, as before)", R.off.jobs.length===1&&R.off.jobs[0].kind==="dial"&&/You came.*Sit down/.test(R.off.calls[0].t), JSON.stringify(R.off));
  ok("the narrator's pieces carry the narrator effect", R.inter.jobs.filter(j=>j.kind==="narr").every(j=>j.fx===true), JSON.stringify(R.inter.jobs));
  ok("own-voice narration: the speaker's voice, through the own-voice effect", seq(R.self)==="narr:Olivia:She looks up. | dial:Olivia:You came."&&R.self.jobs[0].fx==="self", seq(R.self)+" "+JSON.stringify(R.self.jobs));
  ok("a long opening piece is cut after its first sentence so the voice starts sooner",
     R.fast.jobs.length===3&&R.fast.jobs[0].kind==="narr"&&R.fast.jobs[1].kind==="narr"&&/window\.$/.test(R.fast.calls[0].t)&&/^The rain/.test(R.fast.calls[1].t)&&R.fast.calls[2].t==="Hello.", seq(R.fast));
  ok("the player's turn is spoken in order too (narrator for narration, their voice for words)", seq(R.player)==="narr:Narr:I sit. | dial:Dennis:Thanks. | narr:Narr:I look away.", seq(R.player));
  ok("a player's turn typed without marks is all speech", seq(R.plain)==="dial:Dennis:merhaba nasılsın", seq(R.plain));
  ok("own-voice narration on the player's turn uses the player's voice", seq(R.pself)==="narr:Dennis:I sit. | dial:Dennis:Thanks.", seq(R.pself));
  ok("the own-voice effect is its own chain, built once", R.fx.self&&R.fx.narr&&R.fx.none&&R.fx.same, JSON.stringify(R.fx));
  ok("the setting is in Settings → Dubbing", R.ui===true);
  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close(); process.exit(fail?1:0);
})();
