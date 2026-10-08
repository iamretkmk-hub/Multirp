/* v150.39 — DYNAMIC RELATIONSHIPS. The relationships block carries the people who matter to THIS line: the player,
   whoever is in the scene, the ties the card pins ("Always include" — a husband or wife by default), and anyone
   who is not here but is being talked about: named in the latest lines (code) or meant ("your husband"), as the
   reply's Decisions request judges (x_rel_about, one yes/no per absent tie, with the emotion pick). The social
   graph (the author's one-paragraph summary) is gone from the payload, the editor and the prompt registry.
   (v37.4's question — five paragraphs about people who are not in the room — is answered by the same block.)
   Run: node tests/rel-scope.browser.js */
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:process.env.SM_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x||c).slice(0,600));} };
  const ctx=await b.newContext({viewport:{width:412,height:915},hasTouch:true,isMobile:true});
  const pg=await ctx.newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file://'+require('path').resolve(__dirname,'..','index.html')); await pg.waitForTimeout(2300);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(800);

  // Hakan: a friend in the room, an absent wife, daughter and old friend.
  await pg.evaluate(()=>{
    window.__reqs=[]; window.__dec=null;
    const realF=window.fetch;
    window.fetch=async(u,o)=>{ if(String(u).indexOf("/api/alpha/decisions")>-1){ const body=JSON.parse(o.body); __reqs.push(body);
        const answers={}; Object.keys(body.questions).forEach(k=>{ const q=body.questions[k];
          answers[k]=q.type==="choice"?{type:"choice",choice:Object.keys(q.criteria)[0]}:{type:"noul",noul:0.05}; });
        if(__dec)Object.assign(answers,__dec(body)||{});
        return new Response(JSON.stringify({answers}),{status:200}); } return realF(u,o); };
    window.__setup=()=>{
      const uni=state.universes[0];
      const mk=(id,name)=>{ let p=state.personas.find(x=>x.id===id);
        if(!p){ p={id,name,universeId:uni.id,instructions:"x",personality:"x",backstory:"x",style:"x",goals:"x",look:{}}; state.personas.push(p); }
        return p; };
      const hakan=mk("p_h","Hakan");
      mk("p_e","Emre2"); mk("p_d","Duygu"); mk("p_n","Nil"); mk("p_b","Berker");
      Object.assign(state,{user:"Emre",key:"sk-test",relScope:"dynamic",emoOn:true,limitsOn:false,
        fragments:JSON.parse(JSON.stringify(FRAG_DEFAULTS)).map(f=>Object.assign(f,{options:(f.options||[]).map(o=>Object.assign(o,{ask:""}))}))});   // v150.66 — no asked fragment option (the fragments can no longer be switched off), so only what this test asks goes
      store.setRaw(K.fragAdds,FRAG_SHIPPED_ADDS.map(a=>a.key).join(","));
      try{ _emoBreak.until=0; _emoBreak.fails=0; }catch(e){}
      hakan.socialGraph="Duygu is my wife. Nil is my daughter. Emre is my oldest friend. Berker is my brother in exhaustion.";
      hakan.relationships={
        "__user__":{tie:"oldest friend",relationship:"Emre is my oldest friend and his couch is the one place I can breathe."},
        "p_e":{tie:"neighbour",relationship:"We nod in the stairwell and nothing more."},
        "p_d":{tie:"wife",relationship:"Duygu is my wife. I cannot bear the disappointment in her eyes, so I avoid her."},
        "p_n":{tie:"daughter",relationship:"Nil is my daughter. I do not know how to talk to a teenage girl."},
        "p_b":{tie:"childhood friend",relationship:"Berker balanced the ledgers. We sit and say nothing important."}};
      /* v150.65 — what play learned is written into the entry itself (learnedDay); an old socialFacts note is never sent */
      hakan.relationships.p_n.relationship+=" She has stopped answering his calls."; hakan.relationships.p_n.learnedDay=1;
      hakan.relationships.p_b.relationship+=" You heard he was let go from the mill."; hakan.relationships.p_b.learnedDay=1;
      hakan.socialFacts={p_d:{text:"old note: sleeps at her sister's",day:1},p_n:{text:"old note: skipped school twice",day:1}};
      const chat=curChat(); chat.presentIds=["p_h","p_e"]; chat.emo={};
      chat.messages=[{mid:"h1",role:"user",content:'"Long day?"',present:["p_h","p_e"]}]; markChatDirty(chat);
      return {chat,hakan};
    };
    window.__blk=()=>{ const {chat}= {chat:curChat()}; const p=state.personas.find(x=>x.id==="p_h");
      const B=buildCharPromptBlocks(p,[state.personas.find(x=>x.id==="p_e")],{},state.user,{chat,targetName:state.user,targetId:"__user__"});
      return {rel:String(B.relationships||""),inc:B._relInclude}; };
  });

  console.log("\n[who the block carries]");
  const D=await pg.evaluate(()=>{ __setup(); return __blk(); });
  ok("the player gets their paragraph", /couch is the one place I can breathe/.test(D.rel), D.rel);
  ok("someone in the room gets theirs", /nod in the stairwell/.test(D.rel)&&/\[here now\]/.test(D.rel), D.rel);
  ok("the wife is pinned by default, so she goes though she is not here", /cannot bear the disappointment/.test(D.rel)&&/Duygu — wife\] \[not here right now\]/.test(D.rel), D.rel);
  ok("an absent daughter and old friend nobody is talking about stay out", !/teenage girl/.test(D.rel)&&!/Berker/.test(D.rel), D.rel);
  ok("the social graph never reaches the block", !/Nil is my daughter\. Emre is my oldest friend/.test(D.rel)&&!/brother in exhaustion/.test(D.rel), D.rel);
  ok("what play learned rides only with the people carried (in their entries); an old social-fact note never, even for the wife carried", !/stopped answering/.test(D.rel)&&!/let go from the mill/.test(D.rel)&&!/old note/.test(D.rel)&&/cannot bear the disappointment/.test(D.rel), D.rel);
  ok("why each one is there is recorded", JSON.stringify(D.inc)===JSON.stringify([["__user__","player"],["p_e","here"],["p_d","pinned"]]), JSON.stringify(D.inc));

  console.log("\n[pinning]");
  const P=await pg.evaluate(()=>{ const {hakan}=__setup();
    hakan.relationships.p_d.pinned=false; const off=__blk().rel;
    hakan.relationships.p_n.pinned=true; const on=__blk().rel;
    return {off,on}; });
  ok("unpinning the wife leaves her out", !/cannot bear the disappointment/.test(P.off), P.off);
  ok("pinning the daughter brings her in, with what play learned about her (in her entry, not an old note)", /teenage girl/.test(P.on)&&/stopped answering his calls/.test(P.on)&&!/old note/.test(P.on), P.on);

  console.log("\n[being talked about]");
  const M=await pg.evaluate(()=>{ const {chat}=__setup();
    chat.messages.push({mid:"h2",role:"user",content:'"Did Berker ever find work?"',present:["p_h","p_e"]});
    const named=__blk();
    __setup(); const c=curChat();
    c.messages.push({mid:"h3",role:"user",content:'"How is your girl doing at school?"',present:["p_h","p_e"]});
    const plain=__blk().rel;
    c.emo={p_h:{relAbout:{p_n:0.91,p_b:0.2},scene:_placeSig(c)}};
    const asked=__blk();
    c.emo={p_h:{relAbout:{p_n:0.91},scene:"elsewhere"}};
    const stale=__blk().rel;
    return {named,plain,asked,stale}; });
  ok("named out loud in the latest lines (code): carried, marked as talked about", /ledgers/.test(M.named.rel)&&/Berker — childhood friend\] \[not here — being talked about\]/.test(M.named.rel)&&/let go from the mill/.test(M.named.rel), M.named.rel);
  ok("meant but not named: nothing until the decision says so", !/teenage girl/.test(M.plain), M.plain);
  ok("the decision's yes (0.91) brings the daughter in; its no (0.2) leaves Berker out", /teenage girl/.test(M.asked.rel)&&!/ledgers/.test(M.asked.rel)&&JSON.stringify(M.asked.inc).indexOf('["p_n","mentioned"]')>=0, M.asked.rel);
  ok("an answer from another place is not used", !/teenage girl/.test(M.stale), M.stale);
  ok("at most four absent people are added as talked about", await pg.evaluate(()=>{ const {hakan}=__setup(); const c=curChat();
      ["a","b","c","d","e","f"].forEach(x=>{ const id="p_x"+x; if(!state.personas.find(p=>p.id===id))state.personas.push({id,name:"Xname"+x,universeId:state.universes[0].id,look:{}});
        hakan.relationships[id]={tie:"cousin",relationship:"cousin "+x}; });
      const ab={}; ["a","b","c","d","e","f"].forEach(x=>{ ab["p_x"+x]=0.9; });
      c.emo={p_h:{relAbout:ab,scene:_placeSig(c)}};
      const n=(__blk().inc||[]).filter(x=>x[1]==="mentioned").length; return n===4?true:"added "+n; }));

  console.log("\n[the question, in the reply's Decisions request]");
  const Q=await pg.evaluate(async()=>{ const {chat}=__setup(); window.__reqs=[];
    __dec=b=>{ const out={}; Object.keys(b.questions).forEach(k=>{ if(/^rel_/.test(k)&&/Nil/.test(b.questions[k].instructions))out[k]={type:"noul",noul:0.88}; }); return out; };
    chat.messages.push({mid:"h4",role:"user",content:'"How is your girl doing at school?"',present:["p_h","p_e"]});
    const out=await emotionEnsure(chat,state.personas.find(x=>x.id==="p_h"),"How is your girl doing at school?",{targetId:"__user__",kind:"solo"});
    __dec=null;
    const r=__reqs[0]||{questions:{},state:{}};
    return {keys:Object.keys(r.questions),st:r.state.people_they_know_who_are_not_here,nilQ:(Object.entries(r.questions).find(([k,q])=>/Nil/.test(q.instructions))||[])[1],
      rel:out&&out.relAbout,blk:__blk().rel}; });
  ok("one yes/no per absent tie that is not pinned (Nil, Berker), beside the emotion questions",
     Q.keys.indexOf("emotion")>=0&&Q.keys.filter(k=>/^rel_/.test(k)).sort().join(",")==="rel_p_b,rel_p_n", JSON.stringify(Q.keys));
  ok("the state lists the people they know who are not here, with their ties", JSON.stringify(Q.st)==='["Berker — childhood friend","Nil — daughter"]'||JSON.stringify(Q.st)==='["Nil — daughter","Berker — childhood friend"]', JSON.stringify(Q.st));
  ok("the question names the person and the tie", !!Q.nilQ&&Q.nilQ.type==="noul"&&/Nil \(daughter\), who is not here/.test(Q.nilQ.instructions), JSON.stringify(Q.nilQ));
  ok("the answer is kept, and the reply's block carries her", Q.rel&&Q.rel.p_n===0.88&&/teenage girl/.test(Q.blk), JSON.stringify(Q.rel)+" "+Q.blk.slice(0,200));
  ok("with the emotion pick off and nobody absent unpinned: no request at all", await pg.evaluate(async()=>{ const {chat,hakan}=__setup(); state.emoOn=false;
      hakan.relationships.p_n.pinned=true; hakan.relationships.p_b.pinned=true; window.__reqs=[];
      chat.messages.push({mid:"h5",role:"user",content:"!",present:["p_h","p_e"]});
      await emotionEnsure(chat,hakan,"!",{kind:"solo"}); state.emoOn=true; return __reqs.length===0?true:__reqs.length+" sent"; }));

  console.log("\n[every tie, when asked for]");
  ok("\"everyone\" still sends every paragraph and asks nothing", await pg.evaluate(async()=>{ const {chat,hakan}=__setup(); state.relScope="everyone"; state.emoOn=false; window.__reqs=[];
      const v=__blk().rel; chat.messages.push({mid:"h6",role:"user",content:"!",present:["p_h","p_e"]});
      await emotionEnsure(chat,hakan,"!",{kind:"solo"}); state.relScope="dynamic"; state.emoOn=true;
      return (/teenage girl/.test(v)&&/ledgers/.test(v)&&/cannot bear/.test(v)&&!/brother in exhaustion/.test(v)&&__reqs.length===0)?true:v.slice(0,300)+" reqs="+__reqs.length; }));

  console.log("\n[the editor]");
  ok("the social-graph box is gone; who they know is listed, the player always, the wife ticked", await pg.evaluate(()=>{ const {hakan}=__setup();
      editPersona("p_h");
      if(document.getElementById('peSocialGraph'))return "social graph box still there";
      const rows=[...document.querySelectorAll('#peRelPins input.relPin')];
      const by=id=>rows.find(r=>r.dataset.id===id);
      return (rows.length===5&&by("__user__").checked&&by("__user__").disabled&&by("p_d").checked&&!by("p_n").checked)?true:JSON.stringify(rows.map(r=>[r.dataset.id,r.checked])); }));
  ok("ticks are saved on the ties", await pg.evaluate(()=>{
      const by=id=>document.querySelector(`#peRelPins input.relPin[data-id="${id}"]`);
      by("p_d").checked=false; by("p_n").checked=true;
      savePersona();
      const h=state.personas.find(x=>x.id==="p_h");
      return (h.relationships.p_d.pinned===false&&h.relationships.p_n.pinned===true&&!("pinned" in h.relationships.__user__))?true:JSON.stringify(h.relationships); }));
  ok("the social-graph prompt and generator are gone", await pg.evaluate(()=>
      typeof generateSocialGraphFor==="undefined"&&typeof DEFAULT_SOCIAL_GRAPH==="undefined"&&!PROMPT_BY_KEY.socialGraphPrompt&&!!PROMPT_BY_KEY.x_rel_about));

  console.log("\n[cards whose ties were only the social graph]");
  ok("their first reply generates real ties from it, once, in the background", await pg.evaluate(async()=>{
      __setup(); const uni=state.universes[0];
      let p=state.personas.find(x=>x.id==="p_seed"); if(!p){ p={id:"p_seed",name:"Seda",universeId:uni.id,look:{}}; state.personas.push(p); }
      p.relationships={}; p.socialGraph="Hakan is my brother."; delete p._relSeeded;
      const real=window.generateRelationshipsFor; let n=0;
      window.generateRelationshipsFor=async(per)=>{ n++; per.relationships={p_h:{tie:"brother",relationship:"Hakan is my brother."}}; return "x"; };
      relSeedMigrate(curChat(),p); relSeedMigrate(curChat(),p); await new Promise(r=>setTimeout(r,50)); relSeedMigrate(curChat(),p);
      window.generateRelationshipsFor=real;
      return (n===1&&p._relSeeded===true&&p.relationships.p_h)?true:JSON.stringify({n,seeded:p._relSeeded}); }));
  ok("a regeneration keeps the player's ticks", await pg.evaluate(()=>/pinned:prev\[id\]\.pinned/.test(String(generateRelationshipsFor))));

  console.log("\n[what kind of tie it is: the tie decides, not the paragraph]");
  ok("the live export's case: a husband's friend and an acquaintance are not people she answers to, and are not pinned", await pg.evaluate(()=>{
      const uni=state.universes[0];
      const mk=(id,name)=>{ let p=state.personas.find(x=>x.id===id); if(!p){ p={id,name,universeId:uni.id,look:{}}; state.personas.push(p); } return p; };
      const bu=mk("p_bu","Burcu"); mk("p_ha","Hakan A"); mk("p_bk","Berker O"); mk("p_ba","Burak"); mk("p_ay","Ayca");
      bu.relationships={p_ha:{tie:"husband's oldest friend",relationship:"Hakan is Burak's oldest friend, a gentle dreamer."},
        p_bk:{tie:"acquaintance from the same circle",relationship:"Berker is married to Özlem; his family's money troubles are known."},
        p_ba:{tie:"husband",relationship:"Burak is your husband."},
        p_ay:{tie:"Emre's wife",relationship:"Ayça is away in Istanbul."}};
      const st=_emoStakeState(curChat(),bu,"__user__");
      const who=JSON.stringify(st.people_they_answer_to);
      const pins=["p_ha","p_bk","p_ba","p_ay"].map(id=>relPinned(bu,id));
      // v150.64 — each line says how they stand (the tie's paragraph follows "|"): still only Burak
      const L=st.people_they_answer_to||[];
      return (L.length===1&&/^Burak — husband( \||$)/.test(L[0])&&!/Hakan|Berker|Ayça/.test(who)&&JSON.stringify(pins)==="[false,false,true,false]")?true:who+" "+JSON.stringify(pins); }));

  ok("(v150.48) 'son of my best friend' is known through the friend, not one's own son; 'friend of the family' is still a friend", await pg.evaluate(()=>{
      const r=["son of my best friend","Son of best friend","daughter of the Brandts","friend of the family","son","best friend"].map(t=>relTieKind(t,""));
      return JSON.stringify(r)===JSON.stringify(["via","via","via",relTieKind("friend",""),relTieKind("son",""),relTieKind("best friend","")])&&r[4]!=="via"&&r[3]!=="via"?true:JSON.stringify(r); }));

  console.log("\n[the setting]");
  ok("a fresh install, and an old \"present\" or \"brief\", read as dynamic", await pg.evaluate(()=>{
      const r=[]; [null,"present","brief","everyone"].forEach(v=>{ if(v==null)localStorage.removeItem(K.relScope); else localStorage.setItem(K.relScope,v); loadState(); r.push(state.relScope); });
      localStorage.removeItem(K.relScope); loadState();
      return r.join(",")==="dynamic,dynamic,dynamic,everyone"?true:r.join(","); }));
  ok("Settings shows it and saves it back", await pg.evaluate(()=>{
      const el=document.getElementById('setRelScope'); if(!el)return "no selector";
      const opts=[...el.options].map(o=>o.value).join(",");
      state.relScope="everyone"; syncSettingsUI(); const shown=el.value==="everyone";
      el.value="dynamic"; saveSettings(); const back=state.relScope==="dynamic"&&store.raw(K.relScope,"")==="dynamic";
      return (opts==="dynamic,everyone"&&shown&&back)?true:JSON.stringify({opts,shown,back}); }));

  ok("no page errors", errs.length===0?true:errs.join(" | "));
  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close(); process.exit(fail?1:0);
})();
