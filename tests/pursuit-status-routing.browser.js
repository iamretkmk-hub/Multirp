/* v150.25 — PURSUIT STATUS GOES TO THE ENGINES THAT DECIDE, NEVER TO A REPLY.
   The code-tracked state of a character's own pursuits and agreed tasks used to sit in their own
   identity sheet as <pursuit_status>, read by every reply route. It is now handed only to the
   background engines that decide what a character does or wants (Gamemaster, Scene Writer, the
   living-universe pulse, the intent engine), as a third-person PURSUIT STATUS block.
   Run: node tests/pursuit-status-routing.browser.js   (needs playwright; see tests/README.md) */
const {chromium}=require('playwright');
const BIN=process.env.SM_CHROME||process.env.CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
(async()=>{
  const b=await chromium.launch({executablePath:BIN});
  const pg=await b.newPage({viewport:{width:412,height:915}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file://'+require('path').resolve(__dirname,'..','index.html')); await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(900);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x===undefined?c:x).slice(0,700));} };

  await pg.evaluate(()=>{
    window.__calls=[];
    window.chatCompletion=async(messages,model,opts)=>{
      const dbg=(opts&&opts.dbg)||"";
      window.__calls.push({dbg,t:JSON.stringify(messages)});
      if(opts&&opts.rp===true) return '"Tamam."';
      return "{}";
    };
    window.__setup=()=>{
      const uni=state.universes[0];
      uni.locations=[{id:"l_can",name:"Canteen",type:"public",description:"c",residents:[],sublocations:[]},
                     {id:"l_gar",name:"Garden",type:"home",description:"g",residents:[],sublocations:[]}];
      const mk=(id,name,extra)=>Object.assign({id,name,universeId:uni.id,instructions:"",personality:"You are "+name+".",
        backstory:"",style:"s",goals:"",interject:"",look:{raw:name+" looks tall"},relationships:{}},extra||{});
      state.personas=[mk("p_sami","Sami",{goals:"Get his debts in order."}),mk("p_berk","Berker",{goals:"Buy the boat."})];
      Object.assign(state,{key:"k",user:"Emre",userBio:"",userLook:"",mem:false,sceneOn:true,confrontOn:true,
        gmOn:true,autoRpOn:false,heatOn:false,suggestOn:false,autoSpeak:false,narrMode:false,relOn:false,trackOn:false,calOn:false,
        promiseOn:false,gossipOn:false,intentOn:false,pulseOn:true,roundOn:false,charQuestsOn:true,goalPursuitOn:true,textsOn:false,
        autoImg:false,imgMode:"off",streamReveal:false,storyLang:"en",voiceCheckOn:false,psycheOn:false,presenceOff:true});
      state.memory=[]; state.gossip=[];
      uni.gameData={charQuests:[
        {id:"cq_1",holderId:"p_sami",holderName:"Sami",targetId:"__user__",status:"active",title:"The Friday cash",
         desc:"Sami needs the Friday money in cash before the landlord comes.",ask:"bring the Friday money in cash",
         approach:"in_person",createdDay:1,delivered:true,awaitingUser:true,progress:[{day:1,text:"Sami made the ask at the canteen."}]},
        {id:"cq_2",holderId:"p_sami",holderName:"Sami",targetId:"p_berk",targetName:"Berker",status:"active",source:"task",
         title:"Tell Berker about the van",desc:"Sami agreed to tell Berker the van is sold.",when:"tonight",assignedBy:"Emre",createdDay:1,progress:[]}]};
      const c=curChat();
      Object.assign(c,{universeId:uni.id,presentIds:["p_sami"],subPos:{},subId:null,locationId:"l_can",location:"Canteen",
        gameDay:2,period:"Afternoon",activeEvent:null,dnd:false,messages:[{mid:"u1",role:"user",content:"Selam Sami."}],
        calendar:[],promises:[],rel:{},_psyche:{},_cqApproachDay:null,intents:[]});
      window.__calls=[];
      show('chat'); try{ renderChat(); }catch(e){}
      return c;
    };
    window.__P=id=>state.personas.find(p=>p.id===id);
  });
  const LEAK=/Friday cash|Friday money|ALREADY asked|PURSUIT STATUS|pursuit_status|Tell Berker about the van|YOUR TASK|YOUR OWN PURSUIT/;

  console.log("\n[the character's own sheet and reply payload carry none of it]");
  const R=await pg.evaluate(async()=>{
    const c=__setup();
    const sheet=charBioBlock(__P("p_sami"),{self:true,noWho:true,styleTail:true});
    const call=charBioBlock(__P("p_sami"),{self:true});
    await playCharacterTurn(c,__P("p_sami"),"Emre",{noWait:true});
    const rp=__calls.filter(x=>/^Roleplay reply/.test(x.dbg)).map(x=>x.t).join("\n");
    return {sheet,call,rp,rpN:__calls.filter(x=>/^Roleplay reply/.test(x.dbg)).length};
  });
  ok("charBioBlock(self) has no pursuit or task", !/Friday|ALREADY asked|pursuit_status|van/.test(R.sheet+R.call), R.sheet);
  ok("a roleplay reply was built", R.rpN>=1, String(R.rpN));
  ok("the roleplay reply payload has no pursuit or task", R.rpN>=1 && !LEAK.test(R.rp), (R.rp.match(LEAK)||[""])[0]);
  /* v150.26 — and the pursuit ledger no longer switches a rail on: Sami's ask is pending, the exchange is not stalled */
  ok("a pending ask does not turn on 'circle it once'", R.rpN>=1 && !/CIRCLE IT ONCE/.test(R.rp), "rail present");

  console.log("\n[the block the engines read]");
  const B=await pg.evaluate(()=>{ const c=__setup();
    return {b:pursuitStatusBlock([__P("p_sami"),__P("p_berk"),__P("p_sami")],c),none:pursuitStatusBlock([__P("p_berk")],c),
            off:(state.charQuestsOn=false, pursuitStatusBlock([__P("p_sami")],c))}; });
  ok("it names the holder, the pursuit, and that the ask is already made", /^PURSUIT STATUS/.test(B.b) && /Sami:/.test(B.b)
     && /"The Friday cash"/.test(B.b) && /they have ALREADY asked; no real answer yet/.test(B.b) && /Latest: Sami made the ask/.test(B.b), B.b);
  ok("it carries the agreed task in the third person", /TASK they agreed to — "Tell Berker about the van"/.test(B.b) && /When: tonight/.test(B.b) && /Emre asked it of them/.test(B.b), B.b);
  ok("each person once; nobody with nothing live", (B.b.match(/^Sami:/mg)||[]).length===1 && !/Berker:/.test(B.b), B.b);
  ok("empty when nobody has anything, and when character quests are off", B.none==="" && B.off==="", JSON.stringify([B.none,B.off]));

  console.log("\n[every deciding engine receives it]");
  const E=await pg.evaluate(()=>{ __setup();
    const out={};
    ["gmJudge","gmAuthor","goalPursuit","worldRound","offstageEvent","calExec","intentForm","intentTick"].forEach(k=>{
      const d=ENGINE_PARTS[k]; out[k]={declared:!!(d&&d.parts.some(p=>p.name==="pursuits")),
        sent:JSON.stringify(epSend(k,"SYS",{pursuits:"PURSUIT STATUS — X"})).indexOf("PURSUIT STATUS — X")>=0};
    });
    out.lib=String(engineLibrary(curChat()).pursuits()||"");
    return out; });
  Object.keys(E).filter(k=>k!=="lib").forEach(k=>ok(k+": declares a pursuits part and sends it", E[k].declared&&E[k].sent, JSON.stringify(E[k])));
  ok("{{call//pursuits}} resolves to the present cast's status", /Sami:/.test(E.lib) && /Friday cash/.test(E.lib), E.lib);

  const G=await pg.evaluate(async()=>{ const c=__setup();
    await maybeGamemaster(c,true);
    return __calls.filter(x=>/^Gamemaster/.test(x.dbg)).map(x=>x.dbg+" :: "+x.t).join("\n"); });
  ok("the Gamemaster's beat is written with the present cast's pursuit status", /PURSUIT STATUS/.test(G) && /Friday cash/.test(G), G.slice(0,400));

  const P=await pg.evaluate(async()=>{ const c=__setup(); const uni=state.universes[0];
    c.presentIds=[]; c.locationId="l_gar"; c.worldPositions={p_sami:"l_can",p_berk:"l_can"};
    try{ await runGoalPursuit(c,2,uni,"Afternoon"); }catch(e){ return "ERR "+e.message; }
    return __calls.filter(x=>/^World pulse \(goal pursuit\) · Sami/.test(x.dbg)).map(x=>x.t).join("\n"); });
  ok("goal pursuit decides Sami's move with his pursuit status in hand", /PURSUIT STATUS/.test(P) && /ALREADY asked/.test(P), P.slice(0,400));

  if(errs.length){ fail++; console.log("  FAIL  page errors: "+errs.join(" | ")); }
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail?1:0);
})();
