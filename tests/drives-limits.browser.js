/* v148.6 — DRIVES & BRAKES FOR THE LINE BEING ANSWERED, AND WHAT A CHARACTER HAS SAID ABOUT HOW FAR THIS GOES.
   A user playing with their own reply template ({{call//drives//full}} in the tail) reported:
     · "Call drives is not rendering. Sometimes it does sometimes not." — their real log had two whole
       replies and no "Drives & brakes" call at all: the refresh was fire-and-forget behind a one-at-a-time
       guard, and the v148.4 scene check held the old record back whenever the place/area/cast/earshot moved;
     · "When it runs, generate it from the current line, not the previous one";
     · "feed it the risk factors (stakes, exposure, trust, current state), not just logistics";
     · "Store limits the character states ('bench, no further', 'I'm going home soon') so they can be
       surfaced in later payloads and checked by the analyzer."
   Pinned here through the user's own template, the real send path, and a stubbed model.
   Run: node tests/drives-limits.browser.js   (needs playwright; see tests/README.md) */
const {chromium}=require('playwright');
const BIN=process.env.SM_CHROME||process.env.CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
/* The user's reply template, verbatim (tail part is what matters: drives//full, resistance//full). */
const USER_TPL=`[system]
{{call//rp_task}}

{{call//rp_language}}

{{call//rp_format}}

{{call//head_universe}}
{{call//world}}

{{call//your_bio//full}}

{{call//relationships//full}}

{{call//head_standing//full}}
{{call//scenario//full}}
{{call//others_present//full}}
{{call//response_target//full}}
{{call//player//full}}
{{call//after_heat//full}}

{{call//head_speak}}
{{call//speaking_style//full}}

{{call//head_history}}
[system end]

{{call//dialogue_history}}

[user]
{{call//head_where_now}}
{{call//scene_now//full}}
{{call//situation//full}}
{{call//privacy//full}}
{{call//drives//full}}

{{call//watching_now//full}}

{{call//last_line//full}}

{{call//already_said//full}}

{{call//response_guidance//full}}

{{call//resistance//full}}

{{call//spoken_delivery//full}}

{{call//final_guardrails//full}}

{{call//rp_last_before}}

{{call//head_respond_as}}
[user end]`;
(async()=>{
  const b=await chromium.launch({executablePath:BIN});
  const pg=await b.newPage({viewport:{width:412,height:915}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file://'+require('path').resolve(__dirname,'..','index.html')); await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(900);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x===undefined?c:x).slice(0,900));} };

  await pg.evaluate((TPL)=>{
    window.__calls=[];
    window.__stub={reply:'"Tamam."', psyN:0, psy:null};
    window.chatCompletion=async(messages,model,opts)=>{
      const dbg=(opts&&opts.dbg)||"";
      const t=JSON.stringify(messages);
      window.__calls.push({dbg,t,messages,opts:Object.assign({},opts||{}),at:window.__calls.length});
      if(opts&&opts.rp===true) return typeof __stub.reply==="function"?__stub.reply(messages):__stub.reply;
      if(dbg.indexOf("Drives & brakes")===0){
        __stub.psyN++;
        const r=__stub.psy?__stub.psy(messages,__stub.psyN):{toward:"TOWARD_"+__stub.psyN,against:"AGAINST_"+__stub.psyN};
        return typeof r==="string"?r:JSON.stringify(r);
      }
      return "{}";
    };
    window.__setup=()=>{
      const uni=state.universes[0];
      uni.locations=[
        {id:"l_lake",name:"Lakeside Trail",type:"public",description:"A running trail by a lake.",residents:[],gossipChance:0.4,
         sublocations:[{id:"s_kiosk",name:"Trailhead Kiosk"},{id:"s_bench",name:"Shaded Rest Stop with bench"},{id:"s_bung",name:"Hidden Bungalow",gossipMult:0.2}]},
        {id:"l_park",name:"City Park",type:"public",description:"A park.",residents:[],sublocations:[]}];
      const mk=(id,name,extra)=>Object.assign({id,name,universeId:uni.id,instructions:"",personality:"You are "+name+".",
        backstory:"",style:"s",goals:"",interject:"",look:{raw:name+" looks tall"},relationships:{}},extra||{});
      state.personas=[
        mk("p_d","Duygu",{relationships:{p_h:{tie:"husband",relationship:"You married Hakan twelve years ago."},
                                        p_n:{tie:"daughter",relationship:"Nil is ten."},
                                        p_a:{tie:"Emre's wife",relationship:"You know Ayca from school runs."},
                                        __user__:{tie:"friend",relationship:"Emre is an old friend."}}}),
        mk("p_h","Hakan"), mk("p_n","Nil"), mk("p_a","Ayca"), mk("p_s","Sedat")];
      Object.assign(state,{key:"k",user:"Emre",userBio:"Emre is an engineer.",userLook:"",mem:false,sceneOn:true,confrontOn:false,
        gmOn:false,autoRpOn:false,heatOn:false,suggestOn:false,autoSpeak:false,narrMode:false,relOn:false,trackOn:false,calOn:false,
        promiseOn:false,gossipOn:false,intentOn:false,pulseOn:false,roundOn:false,charQuestsOn:false,goalPursuitOn:false,textsOn:false,
        autoImg:false,imgMode:"off",streamReveal:false,storyLang:"en",voiceCheckOn:false,psycheOn:true,presenceOff:true});
      ["solo","multi","gm"].forEach(k=>ptSetTemplate(k,TPL)); state.payloadTplOn=true;
      state.memory=[]; state.gossip=[]; uni.gameData={};
      const c=curChat();
      Object.assign(c,{universeId:uni.id,presentIds:["p_d"],subPos:{p_d:"s_bench"},subId:"s_bench",
        locationId:"l_lake",location:"Lakeside Trail",gameDay:2,period:"Midday",activeEvent:null,dnd:false,messages:[],
        calendar:[],promises:[],rel:{},_psyche:{},spokenLimits:{},spokenLimitsRead:{}});
      window.__calls=[]; __stub.reply='"Tamam."'; __stub.psyN=0; __stub.psy=null;
      show('chat'); try{ renderChat(); }catch(e){}
      return c;
    };
    window.__settle=async(ms)=>{ const t=Date.now(); while(Date.now()-t<(ms||8000)){ await new Promise(r=>setTimeout(r,60));
      if(!_presentPlaying&&!_presentQueue.length) { await new Promise(r=>setTimeout(r,120)); if(!_presentPlaying&&!_presentQueue.length) return true; } } return false; };
    window.__turn=async(text)=>{ const n0=__calls.length; await sendMessage({text}); await __settle(); return __calls.slice(n0); };
    window.__drv=cs=>cs.filter(c=>c.dbg.indexOf("Drives & brakes")===0);
    window.__rep=cs=>cs.filter(c=>/^Roleplay reply( · |$)/.test(c.dbg));   // solo "Roleplay reply", multi "Roleplay reply · Name"
    window.__user=c=>{ const m=c.messages; return String((m[m.length-1]||{}).content||""); };
  },USER_TPL);

  /* ------------------------------------------------------------------------------------------ */
  console.log("\n[1 — the block renders through the user's template, every turn, written for that turn]");
  const r1=await pg.evaluate(async()=>{
    const c=__setup();
    const t1=await __turn('"Hey Duygu, how is life?"');
    const t2=await __turn('"And how are Hakan and Nil?"');
    const d1=__drv(t1), d2=__drv(t2), p1=__rep(t1), p2=__rep(t2);
    return {nd1:d1.length,nd2:d2.length,
      order1:d1.length&&p1.length?d1[0].at<p1[0].at:false,
      rep1:p1.length?p1[0].t:"", rep2:p2.length?p2[0].t:"",
      in1:d1.length?__user(d1[0]):"", in2:d2.length?__user(d2[0]):"",
      mids:c.messages.filter(m=>m.role==="user").map(m=>m.mid), sig:(c._psyche.p_d||{}).sig||""};
  });
  ok("one drives call on each turn", r1.nd1===1&&r1.nd2===1, JSON.stringify({nd1:r1.nd1,nd2:r1.nd2}));
  ok("the writer runs before the reply is assembled (the reply waits for it)", r1.order1===true);
  ok("turn 1's reply carries the block, with turn 1's passages", /WHAT YOU ARE CAUGHT BETWEEN/.test(r1.rep1)&&/TOWARD_1/.test(r1.rep1)&&/AGAINST_1/.test(r1.rep1), r1.rep1.slice(-1500));
  ok("turn 2's reply carries turn 2's passages, not turn 1's", /TOWARD_2/.test(r1.rep2)&&!/TOWARD_1/.test(r1.rep2), r1.rep2.slice(-1500));
  ok("the writer is given THE line being answered, turn 1", /Emre: "Hey Duygu, how is life\?"/.test((r1.in1.split("THE LINE Duygu IS ANSWERING NOW")[1]||"").split("\n\n")[0]), r1.in1.slice(-900));
  ok("…and on turn 2, the new line (not the old one) is the line", (()=>{ const tail=(r1.in2.split("THE LINE Duygu IS ANSWERING NOW")[1]||"").split("\n\n")[0];
      return /how are Hakan and Nil/.test(tail)&&!/how is life/.test(tail); })(), r1.in2.slice(-900));
  ok("the record is keyed by the mid of the line it was written for", r1.sig.endsWith("|m:"+r1.mids[1]), r1.sig+" vs "+JSON.stringify(r1.mids));

  const r2=await pg.evaluate(async()=>{
    const c=curChat(); const n0=__calls.length;
    const D=state.personas.find(p=>p.id==="p_d");
    // same line, same scene: reused, no call. (After her reply the line she would answer next is her own —
    // a continuation — so the first ensure here writes for that; the second one must not call again.)
    await psycheEnsure(c,D,"__user__","Emre",{foreground:true});
    const n1=__calls.length;
    await psycheEnsure(c,D,"__user__","Emre",{foreground:true});
    const reuse=__calls.length-n1;
    // Sedat walks up to the bench: the cast and the earshot change
    c.presentIds.push("p_s"); c.subPos.p_s="s_bench";
    const t3=await __turn('"Sedat! Join us."');
    const d3=__drv(t3), p3=__rep(t3);
    return {reuse,nd3:d3.length,rep3:p3.length?p3[0].t:"",in3:d3.length?__user(d3[0]):"",fg:d3.length?!!d3[0].opts.foreground:false,dbgs:t3.map(x=>x.dbg),n:__stub.psyN};
  });
  ok("the same line in the same scene reuses the record (no second call)", r2.reuse===0, "calls="+r2.reuse);
  ok("after a cast/earshot change the next turn still gets its block", r2.nd3===1&&/WHAT YOU ARE CAUGHT BETWEEN/.test(r2.rep3)&&r2.rep3.indexOf("TOWARD_"+r2.n)>=0, r2.rep3.slice(-1200)+" "+JSON.stringify(r2.dbgs));
  ok("the writer runs in the foreground (the player is waiting on it)", r2.fg===true);
  ok("and it is told who is within earshot now", /Within earshot besides[^\n]*Sedat/.test(r2.in3), r2.in3.slice(0,1500));

  /* ------------------------------------------------------------------------------------------ */
  console.log("\n[2 — risk factors, not logistics]");
  const r3=await pg.evaluate(async()=>{
    const c=__setup();
    const o=relObj(c,"p_d","__user__"); o.trust=35; o.affection=20; o.st.desire=40; o.st.fear=10;
    const t=await __turn('*sits down close to her on the bench* "You look good today."');
    const d=__drv(t); return {inp:d.length?__user(d[0]):"",sys:d.length?String(d[0].messages[0].content||""):""};
  });
  ok("exposure: who could see or hear, and how exposed the area is", /WHO COULD SEE OR HEAR/.test(r3.inp)&&/A public place/.test(r3.inp)&&/semi-public|gossipy|very public/.test(r3.inp), r3.inp.slice(0,1800));
  ok("stakes: her own marriage and family are named", /your husband, Hakan[^\n]*a marriage is on the line/.test(r3.inp)&&/your daughter, Nil[^\n]*family/.test(r3.inp), r3.inp);
  ok("stakes: the other person's spouse is named as someone who would be hurt", /Ayca \(Emre's wife\)[^\n]*someone who would be hurt/.test(r3.inp), r3.inp);
  ok("trust: the private readings are sent", /PRIVATE READINGS[\s\S]*trust: 35/.test(r3.inp), r3.inp.slice(-600));
  ok("the prompt weighs stakes, exposure, trust and the current state, and demotes logistics",
     /WHAT IS AT STAKE — WEIGH IT, DO NOT LIST IT/.test(r3.sys)&&/STAKES/.test(r3.sys)&&/EXPOSURE/.test(r3.sys)&&/TRUST/.test(r3.sys)&&/THE CURRENT STATE/.test(r3.sys)
     &&/Logistics — being sweaty, being late/.test(r3.sys), r3.sys.slice(0,400));
  ok("the prompt says both sides are about the line being answered", /this moment, not the turn before it/.test(r3.sys));

  /* ------------------------------------------------------------------------------------------ */
  console.log("\n[3 — an empty side no longer takes the block with it]");
  const r4=await pg.evaluate(async()=>{
    __setup(); __stub.psy=()=>({toward:"You want the talk to stay easy.",against:""});
    const t=await __turn('"Nice weather."'); const p=__rep(t); return p.length?p[0].messages.map(m=>String(m.content||"")).join("\n"):"";
  });
  ok("a civil turn (empty brake) still ships the two headings, the empty one saying so",
     /WHAT PULLS YOU TOWARD IT\s*You want the talk to stay easy\.\s*## WHAT HOLDS YOU BACK\s*Nothing real, in this moment\./.test(r4), r4.slice(-1500));

  /* ------------------------------------------------------------------------------------------ */
  console.log("\n[4 — a limit she states is extracted, stored, surfaced, and checked]");
  const r5=await pg.evaluate(async()=>{
    const c=__setup();
    __stub.reply='"Bari şuradaki banka kadar gidelim, daha fazla değil." *Çayımı iki elimle tutuyorum.*';
    await __turn('"Shall we walk a bit?"');
    const said=c.messages.filter(m=>m.speakerId==="p_d"||m.speaker==="Duygu").pop();
    __stub.reply='"Tamam."';
    __stub.psy=(msgs,n)=>{ const u=String(msgs[msgs.length-1].content||"");
      return /\[L1\][^\n]*banka kadar/.test(u)
        ? {toward:"You want the walk.",against:"You said the bench and no further.",limits:[{line:"L1",text:"şuradaki banka kadar, daha fazla değil",kind:"limit",about:"how far they walk together",expires:"scene"}],released:[]}
        : {toward:"T"+n,against:"A"+n}; };
    const t=await __turn('*walks past the bench* "Come on, a little further."');
    const d=__drv(t), p=__rep(t);
    const lim=(c.spokenLimits.p_d||[])[0]||null;
    // template call on its own
    const D=state.personas.find(x=>x.id==="p_d");
    const B=buildTailBlocks({chat:c,selfP:D,selfId:"p_d",selfName:"Duygu",targetName:"Emre",targetId:"__user__",multi:false,injected:{recent:[],diary:[],longterm:[]}});
    ptSetTemplate("solo","[user]\n{{call//limits//full}}\n[user end]");
    const pm=ptBuildMessages("solo",B,[],{chat:c,npc:D,targetName:"Emre"},()=>B)||[];
    // the generated piece (default layout) renders exactly what the block carries — with passages, and with only the limits
    const piece=t=>{ ptSetTemplate("solo","[user]\n"+ptPieceTemplate("drives","solo")+"\n[user end]");
      return ((ptBuildMessages("solo",t,[],{chat:c,npc:D,targetName:"Emre"},()=>t)||[])[0]||{}).content||""; };
    const parFull=piece(B)===String(B.drives||"").trim();
    const keep=c._psyche; c._psyche={};
    const B2=buildTailBlocks({chat:c,selfP:D,selfId:"p_d",selfName:"Duygu",targetName:"Emre",targetId:"__user__",multi:false,injected:{recent:[],diary:[],longterm:[]}});
    const parLim=piece(B2)===String(B2.drives||"").trim()&&/HOW FAR THIS GOES/.test(String(B2.drives||""));
    window.__par=[piece(B2),String(B2.drives||"")];
    c._psyche=keep;
    ptSetTemplate("solo",window.__TPL_KEEP||ptTemplate("multi"));
    return {inp:d.length?__user(d[0]):"",rep:p.length?p[0].t:"",lim,saidMid:said&&said.mid,
      read:(c.spokenLimitsRead||{}).p_d||null, limitsBlk:String(B.limits||""), drives:String(B.drives||""),
      resist:String(B.resistance||""), tplCall:pm.map(m=>m.content).join("\n"),parFull,parLim,par:window.__par};
  });
  ok("the writer is shown her own new line, numbered", /OWN LINES SINCE YOU LAST READ[\s\S]*\[L1\][^\n]*banka kadar/.test(r5.inp), r5.inp.slice(-900));
  ok("the limit is stored per chat per character, tied to the line that said it",
     !!r5.lim&&r5.lim.kind==="limit"&&r5.lim.saidMid===r5.saidMid&&r5.lim.expires==="scene"&&r5.lim.day===2&&/Midday/i.test(r5.lim.period)&&/Lakeside Trail/.test(r5.lim.place)&&/how far they walk/.test(r5.lim.about),
     JSON.stringify(r5.lim));
  ok("the read pointer moves past that line", r5.read===r5.saidMid, r5.read+" vs "+r5.saidMid);
  ok("the SAME turn's reply shows it inside the drives block (the user's template, unedited)",
     /WHAT YOU HAVE SAID ABOUT HOW FAR THIS GOES[\s\S]*banka kadar/.test(r5.rep), r5.rep.slice(-2500));
  ok("the resistance block quotes the line she drew", /YOU HAVE ALREADY SAID WHERE YOUR LINE IS[\s\S]*banka kadar/.test(r5.resist)&&/YOU HAVE ALREADY SAID WHERE YOUR LINE IS/.test(r5.rep), r5.resist);
  ok("{{call//limits//full}} works in a template of its own", /WHAT YOU HAVE SAID ABOUT HOW FAR THIS GOES[\s\S]*banka kadar/.test(r5.tplCall), r5.tplCall);
  ok("the drives block and the limits block agree", r5.drives.indexOf(r5.limitsBlk)>=0&&r5.limitsBlk.length>0);
  ok("the generated drives piece renders exactly the block (passages + limits)", r5.parFull===true);
  ok("…and with only the limits (no passages), still one paragraph, still identical", r5.parLim===true, JSON.stringify(r5.par));

  const r6=await pg.evaluate(async()=>{
    const c=curChat(); const D=state.personas.find(x=>x.id==="p_d");
    __stub.psy=(msgs,n)=>({toward:"T"+n,against:"A"+n});
    const t=await __turn('"Just to the lake then?"');
    const d=__drv(t);
    // the analysers
    state.relOn=true; state.stInterval=1; c._stCount=0; const n0=__calls.length;
    try{ await runShortTermRel(c); }catch(e){}
    const st=__calls.slice(n0).filter(x=>/^Short-term/.test(x.dbg)).map(x=>x.t).join("\n");
    state.relOn=false;
    const n1=__calls.length;
    try{ await runOvertureJudge(c,{kind:"overture",accuserId:"p_d",accuserName:"Duygu",intent:"a walk",conviction:0.5},"*takes her hand*"); }catch(e){}
    const ov=__calls.slice(n1).filter(x=>x.dbg==="Overture judge").map(x=>x.t).join("\n");
    const n2=__calls.length;
    try{ await runConfrontJudge(c,{kind:"confrontation",accuserId:"p_d",accuserName:"Duygu",intent:"x",conviction:0.5},"no"); }catch(e){}
    const cf=__calls.slice(n2).filter(x=>x.dbg==="Confrontation judge").map(x=>x.t).join("\n");
    return {inp:d.length?__user(d[0]):"",st,ov,cf};
  });
  ok("the next drives call weighs it as her own stated limit, with an id to release it by", /ALREADY SAID ABOUT HOW FAR THIS GOES[\s\S]*\[K1\] limit: "şuradaki banka kadar/.test(r6.inp), r6.inp.slice(-900));
  ok("the intimacy read (short-term) is told the line she drew", /HAS SAID OUT LOUD ABOUT HOW FAR THIS GOES[\s\S]*banka kadar/.test(r6.st), r6.st.slice(-700));
  ok("the overture judge is told it", /HAS SAID OUT LOUD ABOUT HOW FAR THIS GOES[\s\S]*banka kadar/.test(r6.ov), r6.ov.slice(-500));
  ok("the confrontation judge is told it", /HAS SAID OUT LOUD ABOUT HOW FAR THIS GOES[\s\S]*banka kadar/.test(r6.cf), r6.cf.slice(-500));

  /* ------------------------------------------------------------------------------------------ */
  console.log("\n[5 — released and expired]");
  const r7=await pg.evaluate(async()=>{
    const c=curChat();
    __stub.reply='"Tamam, biraz daha yürüyelim, göle kadar."';
    await __turn('"Please?"');
    __stub.reply='"Tamam."';
    __stub.psy=(msgs,n)=>{ const u=String(msgs[msgs.length-1].content||"");
      return /\[L1\][^\n]*göle kadar/.test(u)&&/\[K1\]/.test(u)?{toward:"T",against:"A",limits:[],released:["K1"]}:{toward:"T"+n,against:"A"+n}; };
    await __turn('"Great."');
    const released=activeLimits(c,"p_d").length===0 && (c.spokenLimits.p_d||[]).some(l=>l.released);
    // expiry, on fresh records
    const base={text:"x",kind:"limit",about:"",day:c.gameDay,period:"Midday",place:"Lakeside Trail",placeId:"l_lake",at:1};
    const mid=c.messages[c.messages.length-1].mid;
    c.spokenLimits.p_d=[Object.assign({},base,{id:"a",expires:"scene",saidMid:mid}),Object.assign({},base,{id:"b",expires:"day",saidMid:mid}),
                        Object.assign({},base,{id:"c",expires:"until_changed",saidMid:mid}),Object.assign({},base,{id:"d",expires:"scene",saidMid:"gone_mid"})];
    const ids=()=>activeLimits(c,"p_d").map(l=>l.id).join(",");
    const now=ids();
    c.locationId="l_park"; c.location="City Park"; const travelled=ids();
    c.gameDay=3; const nextDay=ids();
    c.gameDay=12; const muchLater=ids();
    c.gameDay=2; c.locationId="l_lake";
    return {released,now,travelled,nextDay,muchLater};
  });
  ok("she revises it herself → it is released", r7.released===true);
  ok("a limit whose line was taken back (Retry/delete) no longer holds", r7.now==="a,b,c", r7.now);
  ok("travel ends a scene-scoped limit; a day or standing one survives it", r7.travelled==="b,c", r7.travelled);
  ok("the day's end ends a day-scoped limit; a standing one survives it", r7.nextDay==="c", r7.nextDay);
  ok("even a standing one is not carried past a week", r7.muchLater==="", r7.muchLater);

  /* ------------------------------------------------------------------------------------------ */
  console.log("\n[6 — the shipped prompt, and a stored copy of the old one]");
  const oldDef=await pg.evaluate(()=>{
    let t=DEFAULT_PSYCHE;
    t=t.replace(/\n# WHAT IS AT STAKE — WEIGH IT, DO NOT LIST IT[\s\S]*?(?=\n# HOW HARD EACH ONE PRESSES)/,"\n");
    t=t.replace('{"toward":"…","against":"…","limits":[],"released":[]}','{"toward":"…","against":"…"}');
    return t; });
  ok("the reconstruction of the old default really lacks the new marker", !/WHAT IS AT STAKE/.test(oldDef)&&/\{"toward":"…","against":"…"\}/.test(oldDef));
  const rt=async(v)=>{ await pg.evaluate(a=>store.setRaw(K.psychePrompt,a),v); await pg.reload(); await pg.waitForTimeout(2400);
    return pg.evaluate(()=>state.psychePrompt); };
  ok("a stored copy of the v148.5 default is refreshed", (await rt(oldDef))===await pg.evaluate(()=>DEFAULT_PSYCHE));
  ok("one the user wrote themselves is left alone", (await rt("My own drives writer."))==="My own drives writer.");
  await pg.evaluate(()=>store.setRaw(K.psychePrompt,DEFAULT_PSYCHE));
  ok("no refresh pipe stood down", await pg.evaluate(()=>{ const sp=window.__stalePipes||[]; return sp.length===0?true:"stale: "+sp.join(", "); }));

  ok("no page errors", errs.length===0?true:errs.join(" | "));
  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close(); process.exit(fail?1:0);
})();
