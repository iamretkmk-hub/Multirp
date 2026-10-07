/* v150.28 — A BORROWED MODEL TRAVELS WITH ITS OWN PROVIDER.
   Found: roleplay on OpenRouter (google/gemini-…), Narration on NanoGPT, the Book model left blank. At the day's
   close the Story Book writer borrowed the roleplay model but kept the Narration card's API, so the OpenRouter id
   was asked of NanoGPT. Every agent that falls back to another card's model now sends it to THAT card's API
   (agentModel), and a call with no card of its own that uses the roleplay model goes where roleplay goes.
   Run: node tests/borrowed-model-provider.browser.js */
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:process.env.SM_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage({viewport:{width:412,height:915}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file://'+require('path').resolve(__dirname,'..','index.html'));
  await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(800);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x===undefined?c:x).slice(0,900));} };

  /* Roleplay on OpenRouter with an OpenRouter id; Narration, the generator and the router on NanoGPT. The spy
     resolves the provider exactly as chatCompletion does: opts.prov when given, else the bucket's. */
  await pg.evaluate(()=>{
    window.__real=window.chatCompletion;
    window.__calls=[];
    window.__spy=async(messages,model,opts)=>{
      opts=opts||{};
      const prov=(opts.prov&&PROVIDERS[opts.prov])?opts.prov:provId((typeof opts.fn==="string"&&opts.fn)?opts.fn:(opts.rp===true?"rp":""));
      __calls.push({dbg:opts.dbg||"",model,prov});
      if(/writer/.test(opts.dbg||"")) return "The harbour lay still.";
      return "{}";
    };
    window.chatCompletion=window.__spy;
    window.__cfg=()=>{
      state.key="or-key"; state.nanoKey="nano-key";
      state.model="google/gemini-3.7-flash"; state.rpRotation=""; state.bookModel=""; state.playerNarrateModel=""; state.gmModel="deepseek/gm-model";
      state.authorModel=""; state.bioModel="deepseek/deepseek-v4-pro"; state.mcModel="deepseek/deepseek-v4-flash";
      state.fnCfg={rp:{prov:"or"},narrate:{prov:"nano"},unigen:{prov:"nano"},bio:{prov:"or"},mc:{prov:"nano"},mem:{prov:"nano"},gm:{prov:"or"}};
    };
  });

  console.log("\n[agentModel: the first model that is set, on the API of the card it came from]");
  const A=await pg.evaluate(()=>{ __cfg();
    return {a:agentModel(["narrate",""],["rp",state.model]), b:agentModel(["narrate","nano/model"],["rp",state.model]),
            c:agentModel(["narrate","  "],["mc",""],["rp",""]), d:authoringAgent(), e:mcAgent()}; });
  ok("a blank own model borrows the roleplay model AND the roleplay API", A.a.model==="google/gemini-3.7-flash"&&A.a.prov==="or", JSON.stringify(A.a));
  ok("an own model keeps the own card's API", A.b.model==="nano/model"&&A.b.prov==="nano", JSON.stringify(A.b));
  ok("nothing set: empty model, OpenRouter", A.c.model===""&&A.c.prov==="or", JSON.stringify(A.c));
  ok("authoring with no author model uses the bio model on the bio card's API", A.d.model==="deepseek/deepseek-v4-pro"&&A.d.prov==="or", JSON.stringify(A.d));
  ok("the router's own model stays on the router card's API", A.e.model==="deepseek/deepseek-v4-flash"&&A.e.prov==="nano", JSON.stringify(A.e));

  console.log("\n[the Story Book writer at the day's close — the case that was reported]");
  const B=await pg.evaluate(async()=>{
    __cfg(); __calls=[];
    window.__pic=(col)=>{ const c=document.createElement('canvas'); c.width=64; c.height=48; const x=c.getContext('2d'); x.fillStyle=col; x.fillRect(0,0,64,48); return c.toDataURL('image/png'); };
    const uni=state.universes[0];
    state.personas=[{id:"p_a",name:"Ayla",universeId:uni.id,personality:"Warm.",look:{}},{id:"p_b",name:"Berk",universeId:uni.id,personality:"Loud.",look:{}}];
    state.user="Emre"; state.bookAuto=true; state.bookLen="medium";
    const st=(day,period,location)=>({day,period,location,trackers:[]});
    const M=(o)=>Object.assign({present:["p_a","p_b"]},o);
    const chat=curChat(); chat.book=null; chat.universeId=uni.id;
    /* the story-book test's own day (tests/story-book.browser.js) */
    chat.messages=[
      M({mid:"a1",role:"assistant",speaker:"Ayla",speakerId:"p_a",content:'"They closed the harbour today."',status:st(1,"Evening","Harbour Bar")}),
      M({mid:"u1",role:"user",content:'"Who closed it?"'}),
      M({mid:"b1",role:"assistant",speaker:"Berk",speakerId:"p_b",content:'"The governor did."',status:st(1,"Evening","Harbour Bar"),img:__pic("#a33"),imgState:"done"}),
      M({mid:"u3",role:"user",content:'"Good night."'}),
      M({mid:"d1",role:"assistant",speaker:"Narrator",dayMarker:true,dayFrom:1,dayTo:2,narration:"The night closes over the town.",content:"— Day 2 —"}),
      M({mid:"u4",role:"user",content:"good morning"}),
      M({mid:"a4",role:"assistant",speaker:"Ayla",speakerId:"p_a",content:'"Morning."',status:st(2,"Morning","Home")})];
    markChatDirty(chat);
    try{ await bookCatchUp(chat,"story",{day:1}); }catch(e){ return {err:String(e&&e.message||e)}; }
    const w=__calls.filter(x=>/Story Book writer/.test(x.dbg));
    state.bookModel="nano/book-model"; __calls=[]; chat.book=null;
    try{ await bookCatchUp(chat,"story",{day:1}); }catch(e){}
    const w2=__calls.filter(x=>/Story Book writer/.test(x.dbg));
    state.bookModel=""; state.gmModel=""; __calls=[]; chat.book=null;
    try{ await bookCatchUp(chat,"story",{day:1}); }catch(e){}
    const w3=__calls.filter(x=>/Story Book writer/.test(x.dbg));
    return {w,w2,w3};
  });
  ok("the day's chapter was written", !B.err && B.w.length>=1, JSON.stringify(B));
  // v150.39 — the books are written by the Gamemaster & Scene Writer model when the Book model is blank
  ok("blank Book model: the Gamemaster & Scene Writer model, on the gamemaster card's API (not Narration's NanoGPT)",
     B.w.length>=1 && B.w.every(x=>x.model==="deepseek/gm-model"&&x.prov==="or"), JSON.stringify(B.w));
  ok("blank Book model and blank gamemaster model: the roleplay model, on the roleplay API",
     B.w3.length>=1 && B.w3.every(x=>x.model==="google/gemini-3.7-flash"&&x.prov==="or"), JSON.stringify(B.w3));
  ok("a Book model of its own goes to the Narration card's API", B.w2.length>=1 && B.w2.every(x=>x.model==="nano/book-model"&&x.prov==="nano"), JSON.stringify(B.w2));

  console.log("\n[the other borrowers]");
  const C=await pg.evaluate(async()=>{
    __cfg(); __calls=[];
    const uni=state.universes[0];
    const p={id:"p_sg",name:"Selin",universeId:uni.id,personality:"x",relationships:{}};
    state.personas=[p];
    // v150.39 — the social-graph generator is gone; the relationship generator is the authoring call that replaced it
    try{ await generateRelationshipsFor(p,uni,""); }catch(e){}
    const sg=__calls.find(x=>/^Relationship generator/.test(x.dbg));
    state.authorModel="nano/author"; __calls=[];
    try{ await generateRelationshipsFor(p,uni,""); }catch(e){}
    const sg2=__calls.find(x=>/^Relationship generator/.test(x.dbg));
    return {sg,sg2};
  });
  ok("authoring with no author model: bio model on the bio card's API", C.sg&&C.sg.model==="deepseek/deepseek-v4-pro"&&C.sg.prov==="or", JSON.stringify(C.sg));
  ok("authoring with an author model: the generator card's API", C.sg2&&C.sg2.model==="nano/author"&&C.sg2.prov==="nano", JSON.stringify(C.sg2));

  const S=await pg.evaluate(()=>{
    const src=n=>String(window[n]||"");
    return {day:/state\.model,\{prov:provId\("rp"\),temp:0\.8,max:160,foreground:true,dbg:"Day transition narration"/.test(document.documentElement.innerHTML)
              || /prov:provId\("rp"\)[^}]*Day transition narration/.test(src("endDay")+src("runEndDay")),
            travel:/prov:provId\("rp"\),foreground:true,dbg:"Travel narration"/.test(document.documentElement.innerHTML),
            narr:/agentModel\(\["narrate",state\.playerNarrateModel\],\["rp",state\.model\]\)/.test(document.documentElement.innerHTML),
            sug:/agentModel\(\["narrate",state\.playerNarrateModel\],\["mc",state\.mcModel\],\["rp",state\.model\]\)/.test(document.documentElement.innerHTML)}; });
  ok("day-transition and travel narration use the roleplay model on the roleplay API", S.day&&S.travel, JSON.stringify(S));
  ok("player narration and suggestions borrow with the lender's API", S.narr&&S.sug, JSON.stringify(S));

  console.log("\n[end to end: opts.prov decides the host the request goes to]");
  const E=await pg.evaluate(async()=>{
    __cfg(); window.chatCompletion=__real;
    const seen=[]; const realFetch=window.fetch;
    window.fetch=async(url,init)=>{ let body={}; try{ body=JSON.parse(init&&init.body||"{}"); }catch(e){}
      seen.push({url:String(url),model:body.model,auth:(init&&init.headers&&(init.headers.Authorization||init.headers.authorization))||""});
      return new Response(JSON.stringify({choices:[{message:{content:"OK"},finish_reason:"stop"}]}),{status:200,headers:{"Content-Type":"application/json"}}); };
    const r=agentModel(["narrate",""],["rp",state.model]);
    let out1="",out2="";
    try{ out1=await chatCompletion([{role:"user",content:"hi"}],r.model,{fn:"narrate",prov:r.prov,max:5,foreground:true,dbg:"borrow test"}); }catch(e){ out1="ERR "+(e.friendly||e.message); }
    try{ out2=await chatCompletion([{role:"user",content:"hi"}],"nano/x",{fn:"narrate",max:5,foreground:true,dbg:"own test"}); }catch(e){ out2="ERR "+(e.friendly||e.message); }
    window.fetch=realFetch; window.chatCompletion=__spy;
    return {seen,out1,out2};
  });
  ok("the borrowed roleplay model reaches openrouter.ai with the OpenRouter key", E.seen[0]&&/openrouter\.ai/.test(E.seen[0].url)&&E.seen[0].model==="google/gemini-3.7-flash"&&/or-key/.test(E.seen[0].auth), JSON.stringify(E));
  ok("an agent's own model still reaches its own card's API (NanoGPT)", E.seen[1]&&/nano-gpt\.com/.test(E.seen[1].url)&&/nano-key/.test(E.seen[1].auth), JSON.stringify(E));

  if(errs.length){ fail++; console.log("  FAIL  page errors: "+errs.join(" | ")); }
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail?1:0);
})();
