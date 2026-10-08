/* v150.74 — THE THIRD BACKEND LIST FROM THE PROMPT ANALYSIS, CHECKED AGAINST THE CODE.
     · the recall block never cuts a memory inside a sentence (v150.24's cap did: "…rather than so…");
     · a plan memory leaves recall once its calendar entry is closed;
     · a text payload carries no outfit (it was the player's scene's, and nobody in a thread can see it);
     · two trackers with one stage text print it once;
     · rumours about somebody in the room come after the ones about people elsewhere;
     · engine inputs (participant sheets, quest text, plan origins) are cut at a sentence, never mid-word.
   Run: node tests/analysis-backend-3.browser.js */
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
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x===undefined?c:x).slice(0,700));} };

  console.log("\n[the recall block never cuts inside a sentence]");
  const rc=await pg.evaluate(()=>{
    const longOne="I went to the door. "+"She wanted me to say it out loud in front of Emre rather than so quietly that nobody would ever hear it and I kept thinking about that for a very long time afterwards while the kettle boiled ".repeat(8)+"and then I left.";
    const noEnd="word ".repeat(300).trim();
    const fits="One. Two sentences here. "+"Three is long ".repeat(80)+"end.";
    return {a:_memRecallClip(longOne,700),b:_memRecallClip(noEnd,700),c:_memRecallClip("Short memory.",700),d:_memRecallClip(fits,700)};
  });
  ok("the whole sentences that fit, never a half one", rc.a==="I went to the door.", rc.a.slice(-80));
  ok("a memory with no sentence end is kept whole, not word-cut", rc.b.length>1400&&!/…$/.test(rc.b), rc.b.length);
  ok("a short memory is untouched", rc.c==="Short memory.", rc.c);
  ok("the sentences before an over-long one are kept", rc.d==="One. Two sentences here.", rc.d);

  await pg.evaluate(()=>{ const uni=state.universes[0];
    state.personas=[{id:"p_h",name:"Hira",universeId:uni.id,instructions:"x",personality:"x",backstory:"x",style:"x",goals:"x",look:{}}]; });
  console.log("\n[a plan that has happened leaves recall]");
  const pl=await pg.evaluate(async()=>{
    const uni=state.universes[0], chat=curChat(), her=state.personas[0];
    state.embedOn=false; chat.gameDay=6; chat.calendar=[{id:"cal_x",title:"Give Sami his list",day:5,period:"Evening",done:true,outcome:"met",completedDay:5,completedPeriod:"Evening",who:her.name}];
    const base={ownerId:her.id,universeId:uni.id,chatId:chat.id,type:"EXPERIENCE",importance:0.6,emotion:"neutral",location:"Kitchen",gameDay:5,gamePeriod:"Morning"};
    state.memory=[
      Object.assign({id:"p1",planCalId:"cal_x",content:"I settled on something I mean to do: give Sami his own list and see whether he finishes it."},base),
      Object.assign({id:"o1",content:"I gave Sami his own list in the kitchen; he promised to finish it by Friday."},base,{gamePeriod:"Evening"})];
    const a=(await retrieveMemories("Sami list kitchen",chat,her.id)).recent.map(m=>m.id);
    chat.calendar[0].done=false;
    const b2=(await retrieveMemories("Sami list kitchen",chat,her.id)).recent.map(m=>m.id);
    return {closed:a,open:b2};
  }).catch(e=>({err:e.message}));
  ok("closed entry: the plan memory is not recalled, the outcome is", pl.closed&&pl.closed.indexOf("p1")<0&&pl.closed.indexOf("o1")>=0, JSON.stringify(pl));
  ok("open entry: the plan memory is still recalled", pl.open&&pl.open.indexOf("p1")>=0, JSON.stringify(pl));

  console.log("\n[no outfit in a text payload]");
  const tw=await pg.evaluate(()=>{
    const p={id:"p_w",name:"Wren",universeId:state.universes[0].id,instructions:"x",personality:"x",backstory:"x",style:"x",goals:"x",look:{},wardrobe:"A red minidress and stockings for nights out."};
    return {scene:charBioBlock(p,{self:true,noWho:true}),text:charBioBlock(p,{self:true,noWho:true,noWear:true})};
  });
  ok("the spoken payload still dresses her", /minidress/.test(tw.scene), tw.scene.slice(0,300));
  ok("the text payload does not", !/minidress|<wardrobe>|<wearing>/.test(tw.text), tw.text.slice(0,300));

  console.log("\n[one fact once in the trackers block]");
  const tk=await pg.evaluate(()=>{
    const uni=state.universes[0], chat=curChat(), her=state.personas[0];
    state.trackOn=true; chat.universeId=uni.id; state.curUniverse=uni.id;
    const stage={at:0,text:"you are a fertile woman. internal vaginal ejaculation may lead to a child."};
    uni.trackers=[{id:"t1",name:"Pregnancy",owner:her.id,min:0,max:100,start:0,stages:[stage]},
                  {id:"t2",name:"Fertility",owner:her.id,min:0,max:100,start:0,stages:[Object.assign({},stage)]},
                  {id:"t3",name:"Plug",owner:her.id,min:0,max:100,start:0,stages:[{at:0,text:"something entirely different is going on with you today."}]}];
    chat.trackerVals={};
    return trackerContext(chat,her.id);
  });
  ok("the same stage text from two trackers is printed once", (tk.match(/fertile woman/g)||[]).length===1, tk);
  ok("a different tracker still prints", /entirely different/.test(tk), tk);

  console.log("\n[engine inputs end at a sentence]");
  const ei=await pg.evaluate(()=>{
    const p={name:"Ayla",personality:"You grew up under your mother's rules. "+"Every choice you make is checked against them before you let yourself want it. ".repeat(5),goals:""};
    return _pulseSheet(p);
  });
  ok("a participant sheet ends at a sentence, not 'rules cha'", /\.$/.test(ei.replace(/ Goals:.*$/,""))&&ei.length<400, ei);

  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close(); process.exit(fail?1:0);
})();
