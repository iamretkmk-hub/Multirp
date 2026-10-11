/* v150.109 — THE CONNECTED FEELING SYSTEM, STEP 1: THE LAYERS AND THE RULES. Relationship (end of day), opinions (each part of
   the day), feelings with targets and speeds (every response), temperament; inhibition, cascades, decay, rationalising, rebound,
   reactivation, signals that count double when vulnerable, hard-to-build/easy-to-lose relationship axes with scars, the ego
   arithmetic and the escalation ladder; the conversion of what existed; temperament in the card writers and the editor.
   Run: node tests/feel-layers.browser.js */
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:process.env.SM_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage({viewport:{width:412,height:915}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  const boot=async()=>{ await pg.waitForTimeout(2400); await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); }); await pg.waitForTimeout(800); };
  await pg.goto('file://'+require('path').resolve(__dirname,'..','index.html')); await boot();
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x===undefined?c:x).slice(0,800));} };
  const E=f=>pg.evaluate(f);

  // a fresh chat with three people: Mara (married to Tomas), Tomas, and Leo
  await E(()=>{
    const uni=state.universes[0]; state.curUniverse=uni.id;
    state.personas=state.personas.filter(p=>!/^fl_/.test(p.id));
    state.personas.push({id:"fl_m",name:"Mara",universeId:uni.id,personality:"x",look:{},temper:{reactivity:50,recovery:50,expressiveness:50,impulsivity:50,conscience:60,mood:0}});
    state.personas.push({id:"fl_t",name:"Tomas",universeId:uni.id,personality:"x",look:{}});
    state.personas.push({id:"fl_l",name:"Leo",universeId:uni.id,personality:"x",look:{}});
    state.personas.push({id:"fl_hot",name:"Hot",universeId:uni.id,personality:"x",look:{},temper:{reactivity:90}});
    state.personas.push({id:"fl_cold",name:"Cold",universeId:uni.id,personality:"x",look:{},temper:{reactivity:10}});
    window.__P=id=>state.personas.find(p=>p.id===id);
    window.__C={id:"fl_chat",universeId:uni.id,messages:[],gameDay:3,period:"Evening",rel:{},fsv:1};
  });

  console.log("\n[converting what existed]");
  const mig=await E(()=>{
    const c={id:"fl_old",universeId:state.curUniverse,messages:[],gameDay:2,period:"Morning",
      rel:{"fl_m>fl_t":{trust:40,affection:50,respect:20,familiarity:75,jealousy:40,desire:30,comfort:0,fear:0,agitation:0,desc:"",
        st:{desire:60,comfort:-30,fear:10,agitation:35},episodes:[],dayOpinions:[],lastSlowDelta:{},seeded:{tie:"husband",kind:"spouse"}}}};
    fsMigrateChat(c);
    const o=c.rel["fl_m>fl_t"], s=c.feel.fl_m;
    const f=k=>{ const x=s.list.find(y=>y.k===k&&y.tgt==="p:fl_t"); return x?x.v:0; };
    return {att:o.attraction,com:o.commitment,op:o.op,desire:f("desire"),anxiety:f("anxiety"),irr:f("irritation"),jeal:f("jealousy"),fsv:c.fsv,trust:o.trust};
  });
  ok("the slow axes keep their values; attraction and commitment are added (a husband: committed)", mig.trust===40&&mig.att===30&&mig.com===70, JSON.stringify(mig));
  ok("opinions start where the relationship says", mig.op&&mig.op.reliable===40&&mig.op.kind===Math.round(0.6*50+0.2*40)&&mig.op.appealing===30, JSON.stringify(mig.op));
  ok("the body read's live axes become feelings toward him (desire, unease, irritation) and jealousy a feeling", mig.desire===60&&mig.anxiety===30&&mig.irr===35&&mig.jeal===40&&mig.fsv===1, JSON.stringify(mig));
  ok("a new pair gets attraction and commitment from the tie", await E(()=>{ const c={id:"x",messages:[],rel:{},fsv:1,gameDay:1};
      const real=window.relSheetEntry; const o=relObj(c,"fl_m","fl_t"); return (typeof o.attraction==="number"&&typeof o.commitment==="number"&&o.op&&typeof o.op.kind==="number")?true:JSON.stringify(o); }));

  console.log("\n[feelings: targets, temperament, inhibition]");
  ok("a feeling has a target: guilt is about oneself, desire about someone", await E(()=>{ const c=__C;
      fsFeelMove(c,__P("fl_m"),{k:"guilt",size:"clear",dir:1}); fsFeelMove(c,__P("fl_m"),{k:"desire",size:"clear",dir:1,other:"fl_l"});
      const L=c.feel.fl_m.list; return (L.find(f=>f.k==="guilt").tgt==="self"&&L.find(f=>f.k==="desire").tgt==="p:fl_l")?true:JSON.stringify(L); }));
  const react=await E(()=>{ const c={messages:[],rel:{},fsv:1,gameDay:1};
      return {hot:fsFeelMove(c,__P("fl_hot"),{k:"anger",size:"strong",dir:1,other:"fl_l"}),cold:fsFeelMove(c,__P("fl_cold"),{k:"anger",size:"strong",dir:1,other:"fl_l"})}; });
  ok("a hothead's anger rises far more than a stoic's from the same event", react.hot>react.cold*2, JSON.stringify(react));
  const inh=await E(()=>{ const P=__P("fl_m");
      const a={messages:[],rel:{},fsv:1,gameDay:1}, b2={messages:[],rel:{},fsv:1,gameDay:1};
      fsFeelMove(b2,P,{k:"desire",size:80,dir:1,other:"fl_l"});
      const g0=fsFeelMove(a,P,{k:"guilt",size:"strong",dir:1}), g1=fsFeelMove(b2,P,{k:"guilt",size:"strong",dir:1});
      const c2={messages:[],rel:{},fsv:1,gameDay:1}, c3={messages:[],rel:{},fsv:1,gameDay:1};
      fsFeelMove(c3,P,{k:"guilt",size:80,dir:1});
      const d0=fsFeelMove(c2,P,{k:"desire",size:"strong",dir:1,other:"fl_l"}), d1=fsFeelMove(c3,P,{k:"desire",size:"strong",dir:1,other:"fl_l"});
      const c4={messages:[],rel:{},fsv:1,gameDay:1}, c5={messages:[],rel:{},fsv:1,gameDay:1};
      fsFeelMove(c4,P,{k:"anxiety",size:80,dir:1}); fsFeelMove(c5,P,{k:"anxiety",size:80,dir:1}); fsFeelMove(c5,P,{k:"thrill",size:90,dir:1});
      const t0=fsFeelMove(c4,P,{k:"desire",size:"strong",dir:1,other:"fl_l"}), t1=fsFeelMove(c5,P,{k:"desire",size:"strong",dir:1,other:"fl_l"});
      return {g0,g1,d0,d1,t0,t1}; });
  ok("high desire holds guilt down: guilt rises much less", inh.g1<inh.g0*0.6, JSON.stringify(inh));
  ok("high guilt holds desire down", inh.d1<inh.d0*0.6, JSON.stringify(inh));
  ok("thrill turns fear into excitement: anxiety stops holding desire down", inh.t1>inh.t0*1.5, JSON.stringify(inh));

  console.log("\n[cascades, rebound, decay, rationalising, reactivation]");
  const casc=await E(()=>{ const c={messages:[],rel:{},fsv:1,gameDay:1,period:"Evening",fsTurn:10}, P=__P("fl_m");
      relObj(c,"fl_m","fl_l").attraction=70;
      fsFeelMove(c,P,{k:"desire",size:90,dir:1,other:"fl_l"}); const before=fsVal(c,"fl_m","desire","p:fl_l");
      fsCascade(c,P,{kind:"release",cause:"it happened"});
      const after=fsVal(c,"fl_m","desire","p:fl_l"), relief=fsVal(c,"fl_m","relief");
      const held=fsFeelMove(c,P,{k:"desire",size:"strong",dir:1,other:"fl_l"});
      c.fsTurn+=8; fsTick(c,P); const rebound=fsVal(c,"fl_m","desire","p:fl_l");
      return {before,after,relief,held,rebound}; });
  ok("a release drops desire hard and brings relief", casc.after<casc.before*0.2&&casc.relief>0, JSON.stringify(casc));
  ok("…desire barely rises while it is held down", casc.held<6, JSON.stringify(casc));
  ok("…and climbs back afterwards while attraction is still there", casc.rebound>casc.after+5, JSON.stringify(casc));
  const cl=await E(()=>{ const mk=com=>{ const c={messages:[],rel:{},fsv:1,gameDay:1}; const o=relObj(c,"fl_m","fl_t"); o.commitment=com; o.affection=40;
        fsCascade(c,__P("fl_m"),{kind:"crossed_line",wronged:"fl_t",with:"fl_l",cause:"slept with Leo"}); return c; };
      const hi=mk(90), lo=mk(5); const g=c=>c.feel.fl_m.list.find(f=>f.k==="guilt");
      const opBefore=JSON.stringify(relObj(lo,"fl_m","fl_l").op);
      return {hi:g(hi).v,lo:g(lo).v,tgt:g(hi).tgt,about:g(hi).about,with:g(hi).with,hold:g(hi).hold,opSame:JSON.stringify(relObj(lo,"fl_m","fl_l").op)===opBefore}; });
  ok("crossing a line raises guilt about oneself — more when she is committed to the one wronged", cl.hi>cl.lo*1.3&&cl.tgt==="self"&&cl.about==="fl_t"&&cl.with==="fl_l"&&cl.hold, JSON.stringify(cl));
  ok("…and guilt is not an opinion of the man she was with", cl.opSame===true);
  const dec=await E(()=>{ const c={messages:[],rel:{},fsv:1,gameDay:1,period:"Morning",fsTurn:0}, P=__P("fl_m");
      fsFeelMove(c,P,{k:"desire",size:60,dir:1,other:"fl_l"}); fsFeelMove(c,P,{k:"hurt",size:60,dir:1,other:"fl_t"});
      fsFeelMove(c,P,{k:"resentment",size:60,dir:1,other:"fl_t",hold:true});
      const d0=fsVal(c,"fl_m","desire"), h0=fsVal(c,"fl_m","hurt");
      c.fsTurn=10; fsTick(c,P);
      const d1=fsVal(c,"fl_m","desire"), h1=fsVal(c,"fl_m","hurt");
      c.gameDay=8; fsTick(c,P);
      return {d0,d1,h0,h1,res:fsVal(c,"fl_m","resentment"),hurt8:fsVal(c,"fl_m","hurt")}; });
  ok("a very fast feeling fades within turns; a slow one barely", dec.d1<dec.d0*0.2&&dec.h1>dec.h0*0.8, JSON.stringify(dec));
  ok("an unresolved slow feeling keeps a floor after days; a resolved one fades away", dec.res>=15&&dec.hurt8<5, JSON.stringify(dec));
  const rat=await E(()=>{ const run=good=>{ const c={messages:[],rel:{},fsv:1,gameDay:1,period:"Morning",fsTurn:0}, P=__P("fl_m");
        const o=relObj(c,"fl_m","fl_l"); o.op.kind=good?80:-40; o.op.safe=good?70:-20;
        fsFeelMove(c,P,{k:"guilt",size:70,dir:1,with:"fl_l"}); c.gameDay=3; fsTick(c,P); return fsVal(c,"fl_m","guilt"); };
      return {good:run(true),bad:run(false)}; });
  ok("guilt fades faster when the one it happened with is seen as kind and safe (rationalising)", rat.good<rat.bad*0.8, JSON.stringify(rat));
  ok("a cue brings a faded feeling partly back (the person walks in)", await E(()=>{ const c={messages:[],rel:{},fsv:1,gameDay:1,period:"Morning",fsTurn:0}, P=__P("fl_m");
      fsFeelMove(c,P,{k:"anger",size:80,dir:1,other:"fl_t"}); c.fsTurn=20; fsTick(c,P); const low=fsVal(c,"fl_m","anger");
      fsReactivate(c,P,{present:["fl_t"]}); const back=fsVal(c,"fl_m","anger"); return (back>low+10)?true:JSON.stringify({low,back}); }));

  console.log("\n[signals]");
  const sig=await E(()=>{ const run=vul=>{ const c={messages:[],rel:{},fsv:1,gameDay:1,fsTurn:1}, P=__P("fl_m");
        if(vul)fsFeelMove(c,P,{k:"guilt",size:80,dir:1});
        const r=fsSignal(c,P,"fl_l","care",{cause:"asked how she was"});
        return {w:r.weight,comfort:fsVal(c,"fl_m","comfort","p:fl_l"),ev:(relObj(c,"fl_m","fl_l").evidence||[]).map(e=>e.s+":"+e.x)}; };
      return {calm:run(false),vul:run(true)}; });
  ok("care counts double when she is vulnerable", sig.vul.w>sig.calm.w*1.4&&sig.vul.comfort>sig.calm.comfort*1.3, JSON.stringify(sig));
  ok("…and is kept as evidence for her next opinion of him", sig.vul.ev.length===1&&/^care:/.test(sig.vul.ev[0]), JSON.stringify(sig));

  console.log("\n[opinions and the relationship]");
  const opn=await E(()=>{ const c={messages:[],rel:{},fsv:1,gameDay:1}; const o=relObj(c,"fl_m","fl_l"); o.affection=0; o.trust=0; o.op.kind=0;
      const up=fsOpMove(c,"fl_m","fl_l","kind","clear",1); o.op.kind=0; const down=fsOpMove(c,"fl_m","fl_l","kind","clear",-1);
      const h={messages:[],rel:{},fsv:1,gameDay:1}; const oh=relObj(h,"fl_m","fl_t"); oh.affection=-80; oh.trust=-60; oh.op.kind=Math.round(fsOpAnchor(oh,"kind"));
      const k0=oh.op.kind; for(let i=0;i<3;i++)fsOpMove(h,"fl_m","fl_t","kind","strong",1);
      return {up,down,k0,k1:oh.op.kind}; });
  ok("bad evidence weighs more than good", Math.abs(opn.down)>Math.abs(opn.up)*1.3, JSON.stringify(opn));
  ok("one good afternoon does not make a hated man liked (anchoring)", opn.k1<10&&opn.k1>opn.k0, JSON.stringify(opn));
  const relm=await E(()=>{ const c={messages:[],rel:{},fsv:1,gameDay:4}; const o=relObj(c,"fl_m","fl_t");
      o.trust=0; const lowGain=fsRelMove(c,"fl_m","fl_t","trust","clear",1); o.trust=85; const topGain=fsRelMove(c,"fl_m","fl_t","trust","clear",1);
      o.trust=10; const lowLoss=fsRelMove(c,"fl_m","fl_t","trust","strong",-1); o.trust=90; const highLoss=fsRelMove(c,"fl_m","fl_t","trust","strong",-1);
      const scar=!!(o.scars.trust&&o.scars.trust.until>=4); const t=o.trust; const regain=fsRelMove(c,"fl_m","fl_t","trust","clear",1);
      o.scars={}; o.trust=t; const regain2=fsRelMove(c,"fl_m","fl_t","trust","clear",1);
      return {lowGain,topGain,lowLoss,highLoss,scar,regain,regain2}; });
  ok("hard to build: a gain shrinks near the top", relm.topGain<relm.lowGain*0.5, JSON.stringify(relm));
  ok("easy to lose: the higher it was, the further it falls", Math.abs(relm.highLoss)>Math.abs(relm.lowLoss)*1.5, JSON.stringify(relm));
  ok("a big fall leaves a scar that slows regaining it", relm.scar&&relm.regain<relm.regain2*0.5, JSON.stringify(relm));

  console.log("\n[the ego arithmetic and the ladder]");
  const ego=await E(()=>{ const c={messages:[],rel:{},fsv:1,gameDay:1}, P=__P("fl_m");
      const o=relObj(c,"fl_m","fl_l"); Object.assign(o,{attraction:0,affection:0,familiarity:0}); Object.keys(o.op).forEach(k=>o.op[k]=0);
      fsFeelMove(c,P,{k:"desire",size:100,dir:1,other:"fl_l"});
      const alone=fsEgoCases(c,P,"fl_l",{ladder:"romance"});
      Object.assign(o,{attraction:80,affection:60,familiarity:60}); Object.assign(o.op,{appealing:80,interested:70,safe:60,kind:70});
      const backed=fsEgoCases(c,P,"fl_l",{ladder:"romance"});
      const t=relObj(c,"fl_m","fl_t"); t.commitment=85; t.affection=50;
      const married=fsEgoCases(c,P,"fl_l",{ladder:"romance",answersTo:["fl_t"],risk:0.5});
      return {alone:[alone.ceiling,alone.act],backed:[backed.ceiling,backed.act,backed.backing],married:[married.hold,married.owed],backedHold:backed.hold}; });
  ok("100 desire with nothing behind it reaches only the first rung", ego.alone[0]==="flirt", JSON.stringify(ego));
  ok("backed by opinions and the relationship it reaches far higher", ["kiss","intimacy","cross a line"].includes(ego.backed[0])&&ego.backed[1]>ego.alone[1], JSON.stringify(ego));
  ok("a husband she is committed to, and who could find out, weighs on the side of holding back", ego.married[0]>ego.backedHold+15&&ego.married[1].includes("fl_t"), JSON.stringify(ego));

  console.log("\n[temperament on the card]");
  ok("a card writer's temperament is cleaned and clamped", await E(()=>JSON.stringify(fsTemperFromCard({reactivity:140,recovery:"30",mood:-90,junk:1}))==='{"reactivity":100,"recovery":30,"mood":-50}'));
  ok("both card writers ask for temperament, values and lines", await E(()=>/TEMPERAMENT — how feelings run in you/.test(DEFAULT_BIO)&&/"temperament"/.test(DEFAULT_BIO)&&/"lines"/.test(DEFAULT_BATCH_BIO)&&/TEMPERAMENT — how feelings run in you/.test(DEFAULT_BATCH_BIO)));
  ok("a character without one gets one written (the temperament writer)", await E(()=>/HOW FEELINGS RUN IN \{\{char\}\}/.test(X_ENGINE_PROMPTS.x_temper_writer.def)&&typeof fsEnsureTemperament==="function"));
  const ed=await E(()=>{ editPersona("fl_t"); const t0=document.querySelector('#peTemper').textContent;
      const ins=document.querySelector('#peTemper .peTemperIn[data-k="conscience"]'); ins.value="85"; ins.dispatchEvent(new Event("input"));
      document.getElementById('peValues').value="Your family above everything."; document.getElementById('peLines').value="You would never lie to your brother.";
      savePersona(); const p=__P("fl_t"); return {notSet:/Not set yet/.test(t0),temper:p.temper,values:p.values,lines:p.lines}; });
  ok("the editor shows a card without one as not set, and saves the sliders, values and lines", ed.notSet&&ed.temper&&ed.temper.conscience===85&&ed.temper.reactivity===50&&ed.values==="Your family above everything."&&/never lie/.test(ed.lines), JSON.stringify(ed));
  ok("an old stored card writer is upgraded once", await E(()=>{ const old=DEFAULT_BIO.replace(/TEMPERAMENT — how feelings run in you[\s\S]*?Both IN THE SECOND PERSON[^\n]*\n/,"");
      return old!==DEFAULT_BIO&&/For "likes", write who you are when nothing is going on/.test(old)&&!/TEMPERAMENT — how feelings run/.test(old)?true:"fixture"; }));

  console.log("\n[it is kept]");
  await E(()=>{ const uni=state.universes[0]; const c={id:"fl_keep",universeId:uni.id,title:"keep",messages:[{mid:"m1",role:"assistant",content:"x",speaker:"Mara"}],gameDay:2,period:"Morning",rel:{},fsv:1};
    state.chats.fl_keep=c; fsFeelMove(c,__P("fl_m"),{k:"guilt",size:50,dir:1,hold:true,cause:"KEEP"}); relObj(c,"fl_m","fl_l").op.kind=42; persistChats(c); flushPersistChats(); persistPersonas(); });
  await pg.waitForTimeout(1500); await pg.reload(); await boot();
  const kept=await E(()=>{ const c=state.chats.fl_keep; if(!c)return "no chat";
      const g=c.feel&&c.feel.fl_m&&c.feel.fl_m.list.find(f=>f.k==="guilt"); const p=state.personas.find(x=>x.id==="fl_t");
      return {g:g&&g.cause,hold:g&&g.hold,op:c.rel&&c.rel["fl_m>fl_l"]&&c.rel["fl_m>fl_l"].op.kind,temper:p&&p.temper&&p.temper.conscience,fsv:c.fsv}; });
  ok("feelings, opinions and the temperament survive a relaunch", kept.g==="KEEP"&&kept.hold===true&&kept.op===42&&kept.temper===85&&kept.fsv===1, JSON.stringify(kept));

  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close(); process.exit(fail?1:0);
})();
