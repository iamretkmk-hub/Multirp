/* v150.86 — a spoken piece plays as it arrives. The relay streams a line as small PCM chunks; the dub queue
   used to collect all of them before a sample played. Now _inworldStream keeps the chunks as they land and
   _playStreamAwait schedules them back to back, so a piece starts with its first chunk. Checks: playback
   starts before the stream ends; every sample is played (odd-byte chunks carried); the queue still plays pieces
   in order; a kill or a stop ends a piece that is still streaming in; a failed relay is "no audio", not a wedge.
   Run: NODE_PATH=/path/to/node_modules node tests/stream-playback.browser.js */
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:process.env.SM_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--autoplay-policy=no-user-gesture-required']});
  const pg=await b.newPage({viewport:{width:412,height:915}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file://'+require('path').resolve(__dirname,'..','index.html')); await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(900);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x===undefined?c:x).slice(0,900));} };

  await pg.evaluate(()=>{
    state.ttsRelay="https://relay.test/tts";
    /* a fake relay: each request answers with `n` WAV chunks of `ms` milliseconds of audio, `gap` ms apart */
    window.__relay={n:3,ms:200,gap:250,odd:false,fail:false,stall:false};
    window.__reqs=[];
    const wavChunk=(samples,odd)=>{ const bytes=samples*2+(odd?1:0); const u=new Uint8Array(44+bytes);
      u.set([0x52,0x49,0x46,0x46],0); for(let i=44;i<u.length;i++)u[i]=(i*7)&0xff; let bin=""; for(let i=0;i<u.length;i++)bin+=String.fromCharCode(u[i]); return btoa(bin); };
    window.fetchWithTimeout=async(url,init)=>{
      const body=JSON.parse(init.body); const cfg=Object.assign({},__relay); __reqs.push({text:body.text,voice:body.voiceId,at:performance.now()});
      if(cfg.fail)return {ok:false,status:502};
      const enc=new TextEncoder();
      const rs=new ReadableStream({async start(c){
        for(let i=0;i<cfg.n;i++){
          if(i)await new Promise(r=>setTimeout(r,cfg.gap));
          if(cfg.stall&&i===1){ await new Promise(()=>{}); }
          const odd=cfg.odd&&(i%2===0);   // odd, then the carried byte completes the next one
          c.enqueue(enc.encode(JSON.stringify({result:{audioContent:wavChunk(Math.round(24*cfg.ms),odd)}})+"\n"));
        }
        if(cfg.odd&&cfg.n%2===1)c.enqueue(enc.encode(JSON.stringify({result:{audioContent:btoa(String.fromCharCode(0))}})+"\n"));
        c.close(); }});
      return {ok:true,status:200,body:rs};
    };
  });

  // 1. plays before the stream has ended
  const A=await pg.evaluate(async()=>{
    _audLogArr.length=0;
    const st=_inworldStream("hello there","Olivia");
    let doneAt=0; (async()=>{ while(!st.done)await st.wait(st.chunks.length); doneAt=performance.now(); })();
    const t0=performance.now();
    const why=await _playStreamAwait(st,false,()=>true);
    const startLog=_audLogArr.find(x=>x.tag==="stream.start"), doneLog=_audLogArr.find(x=>x.tag==="stream.done");
    const samples=st.chunks.reduce((n,c)=>n+c.length,0);
    return {why,startAfter:startLog?startLog.t-Date.now()+(performance.now()-t0):null,firstStart:startLog&&startLog.t,doneLog:doneLog&&doneLog.detail,
            streamDoneRel:doneAt-t0,samples,chunks:st.chunks.length,ctx:_dubCtx.state,active:_dubActive};
  });
  ok("playback starts with the first chunk, before the stream has ended", A.why==="ended"&&A.ctx==="running", JSON.stringify(A));
  const A2=await pg.evaluate(async()=>{
    _audLogArr.length=0; const st=_inworldStream("x","Olivia"); const t0=Date.now();
    let streamEnd=0; (async()=>{ while(!st.done)await st.wait(st.chunks.length); streamEnd=Date.now(); })();
    await _playStreamAwait(st,false,()=>true);
    const s=_audLogArr.find(x=>x.tag==="stream.start"); return {start:s?s.t-t0:-1,end:streamEnd-t0};
  });
  ok("…the first sound is out well before the last chunk arrives", A2.start>=0&&A2.start<A2.end-300, JSON.stringify(A2));
  ok("every sample is played: 3 × 200 ms", A.samples===3*4800&&/0\.6s/.test(A.doneLog||""), JSON.stringify(A));

  // 2. odd-length chunks: a carried byte, no sample lost or split
  const B=await pg.evaluate(async()=>{ Object.assign(__relay,{n:3,ms:100,gap:20,odd:true});
    const st=_inworldStream("odd","Olivia"); while(!st.done)await st.wait(st.chunks.length);
    Object.assign(__relay,{odd:false}); return st.chunks.reduce((n,c)=>n+c.length,0); });
  ok("an odd trailing byte is carried to the next chunk (no sample split)", B===3*2400+1, B);

  // 3. the queue: pieces in order, each streaming
  const C=await pg.evaluate(async()=>{
    Object.assign(__relay,{n:2,ms:150,gap:150}); _audLogArr.length=0; __reqs.length=0;
    Object.assign(state,{autoSpeak:true,narrOn:true,narrMode:false,narrVoice:"Narr",narrSelf:false});
    autoSpeakMsg({mid:"q1",role:"assistant",speakerId:"so_a",content:'*She looks up.* "You came." *She stands.*'},{id:"so_a",name:"Ayla",voiceId:"Olivia"});
    const t0=Date.now(); while((_dubQ.length||_dubQBusy)&&Date.now()-t0<8000)await new Promise(r=>setTimeout(r,50));
    const reqs=__reqs.map(r=>r.voice+":"+r.text), spread=__reqs.length?__reqs[__reqs.length-1].at-__reqs[0].at:-1;
    const jobs=_audLogArr.filter(x=>x.tag==="pump.job").map(x=>x.detail);
    const done=_audLogArr.filter(x=>x.tag==="stream.done").map(x=>x.detail.split(" ")[0]);
    state.autoSpeak=false; state.narrOn=false;
    return {reqs,spread,jobs,done};
  });
  ok("every piece is requested at once (synthesis in parallel)", C.reqs.join("|")==="Narr:She looks up.|Olivia:You came.|Narr:She stands."&&C.spread<100, JSON.stringify(C));
  ok("…and played in order, each to its end", C.jobs.join(",")==="narr,dial,narr"&&C.done.join(",")==="ended,ended,ended", JSON.stringify(C));

  // 4. a kill mid-stream ends the piece; so does a stop
  const D=await pg.evaluate(async()=>{
    Object.assign(__relay,{n:6,ms:200,gap:300});
    const st=_inworldStream("long","Olivia"); const gen=_dubGen;
    const p=_playStreamAwait(st,false,()=>gen===_dubGen);
    await new Promise(r=>setTimeout(r,500)); _dubKill("test");
    const t0=Date.now(); const why=await p; const k={why,ms:Date.now()-t0};
    const st2=_inworldStream("long","Olivia"); const p2=_playStreamAwait(st2,false,()=>true);
    await new Promise(r=>setTimeout(r,500)); _stopDub("test-stop"); const t1=Date.now(); const why2=await p2;
    return {kill:k,stop:{why:why2,ms:Date.now()-t1},sources:_dubSources.length};
  });
  ok("a kill while the piece is still streaming in ends it at once", D.kill.why==="killed"&&D.kill.ms<400, JSON.stringify(D));
  ok("a stop (the speak button, a new clip) ends it too — no tail carrying on", D.stop.why==="killed"&&D.stop.ms<400&&D.sources===0, JSON.stringify(D));

  // 5. a relay that fails, or stalls before a byte, is "no audio" — the queue moves on
  const E=await pg.evaluate(async()=>{
    Object.assign(__relay,{fail:true}); const st=_inworldStream("x","Olivia"); const w=await _playStreamAwait(st,false,()=>true);
    Object.assign(__relay,{fail:false});
    state.ttsRelay=""; const st2=_inworldStream("x","Olivia"); const w2=await _playStreamAwait(st2,false,()=>true); state.ttsRelay="https://relay.test/tts";
    return {w,err:st.err&&st.err.friendly,w2,err2:st2.err&&st2.err.friendly};
  });
  ok("a failed relay is no audio with its reason, not a wedge", E.w==="no-audio"&&/HTTP 502/.test(E.err)&&E.w2==="no-audio"&&/No Inworld relay/.test(E.err2), JSON.stringify(E));

  // 6. the narrator effect still applies to a streamed narration piece
  const F=await pg.evaluate(async()=>{
    Object.assign(__relay,{n:1,ms:100,gap:0});
    const ctx=_dubCtx; const seen=[]; const real=AudioNode.prototype.connect;
    AudioNode.prototype.connect=function(dst){ if(this instanceof AudioBufferSourceNode)seen.push(dst===ctx._narrFxIn?"narr":dst===ctx._narrSelfFxIn?"self":dst===ctx.destination?"dry":"?"); return real.apply(this,arguments); };
    try{ await _playStreamAwait(_inworldStream("a","N"),true,()=>true); await _playStreamAwait(_inworldStream("b","N"),"self",()=>true); await _playStreamAwait(_inworldStream("c","N"),false,()=>true); }
    finally{ AudioNode.prototype.connect=real; }
    return seen.join(",");
  });
  ok("narration streams through the narrator / own-voice effect, dialogue dry", F==="narr,self,dry", F);

  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close(); process.exit(fail?1:0);
})();
