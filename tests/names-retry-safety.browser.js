// v147.1 hot-fixes found by the third QC audit:
//  · splitNames never breaks a name at a joining word inside it (Ümit, Çile, Güve, Mit Patel)
//  · isPlayerName: exact name, or a bare first name no character shares — "Emre Yıldız" is not the player "Emre"
//  · the binder clean-up runs once, keeps anything the player touched or that isn't made of real people
//  · Retry never deletes a merged (reconciled) memory, and is refused once the scene moved on
const {chromium}=require('playwright');
const path=require('path');
(async()=>{
  const b=await chromium.launch({executablePath:process.env.SM_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await (await b.newContext()).newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  const url='file://'+path.resolve(__dirname,'..','index.html');
  await pg.goto(url); await pg.waitForTimeout(2300);
  let pass=0,fail=0; const ok=(n,c,x)=>{ if(c){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+(x?"  — "+x:""));} };

  const S=await pg.evaluate(()=>Object.fromEntries(["Ümit","Ümit Yılmaz","Çile","Güve","Mit Patel","Anderson","Veli","Sandy","Emre and Özlem Özüçak","Burcu ile Sami","Ayla, Berk & Cem","Mara with Emre"].map(n=>[n,splitNames(n)])));
  ok("names with a joining word inside stay whole",["Ümit","Ümit Yılmaz","Çile","Güve","Mit Patel","Anderson","Veli","Sandy"].every(n=>S[n].length===1&&S[n][0]===n),JSON.stringify(S));
  ok("real groups still split",S["Emre and Özlem Özüçak"].length===2&&S["Burcu ile Sami"].length===2&&S["Ayla, Berk & Cem"].length===3&&S["Mara with Emre"].length===2,JSON.stringify(S));

  // clean-up: seed stubs, arm it, reload
  await pg.evaluate(async()=>{
    const stub=(id,name,x)=>Object.assign({id,universeId:"uA",name,personality:"A figure connected to: X.",backstory:"",goals:"",look:{},image:null,latent:true,questIds:[]},x||{});
    state.universes=[{id:"uA",name:"A",userName:"Emre",locations:[{id:"l1",name:"Park",residents:["s1","s2","s3","s4","s5"]}],gameData:{}}];
    state.personas=[{id:"pOz",universeId:"uA",name:"Özlem Özüçak",personality:"x"},{id:"pEY",universeId:"uA",name:"Emre Yıldız",personality:"x"},
      stub("s1","Emre and Özlem Özüçak"),stub("s2","Ümit Yılmaz"),stub("s3","Salt and Pepper"),stub("s4","Tom & Jerry",{image:"data:image/png;base64,AA"}),stub("s5","Çile Demir")];
    state.chats={c1:{id:"c1",universeId:"uA",messages:[],calendar:[{id:"k",who:"Emre and Özlem Özüçak",charId:"s1",charIds:["s1"],day:3}]}}; state.curChat="c1"; state.curUniverse="uA";
    store.set("sm_binderclean_v2",false);
    await persistUniverses(); await persistPersonas(); await persistChatsNow(); await new Promise(r=>setTimeout(r,400));
  });
  await pg.reload(); await pg.waitForTimeout(2600);
  const M=await pg.evaluate(()=>({left:state.personas.map(p=>p.id),plan:state.chats.c1.calendar[0].charId,flag:store.get("sm_binderclean_v2",false),
    p:[isPlayerName(state.chats.c1,"Emre"),isPlayerName(state.chats.c1,"Emre Yıldız"),isPlayerName(state.chats.c1,"Ümit")]}));
  ok("the clean-up removes the group stub and re-points its plan",!M.left.includes("s1")&&M.plan==="pOz",JSON.stringify(M));
  ok("…and keeps Ümit Yılmaz, Salt and Pepper, Tom & Jerry (has a picture), Çile Demir and the real Emre Yıldız",["s2","s3","s4","s5","pEY"].every(id=>M.left.includes(id)),JSON.stringify(M.left));
  ok("the clean-up is marked done (it runs once)",M.flag===true);
  ok("'Emre' is the player, 'Emre Yıldız' is not",M.p[0]===true&&M.p[1]===false&&M.p[2]===false,JSON.stringify(M.p));

  // Retry: a reconciled memory survives; a settled scene can't be retried
  const R=await pg.evaluate(async()=>{
    const c=state.chats.c1;
    c.messages=[{mid:"u1",role:"user",content:"hi"},{mid:"r1",role:"assistant",speaker:"Özlem Özüçak",speakerId:"pOz",toId:"__user__",content:"\"hey\""}];
    state.memory=[{id:"mRec",ownerId:"pOz",universeId:"uA",chatId:"c1",content:"the whole afternoon",source:"reconciled",reconciledFrom:3,srcMids:["x1","x2","u1","r1"]},
                  {id:"mArc",ownerId:"pOz",universeId:"uA",chatId:"c1",content:"arc cut",srcMids:["u1","r1"]}];
    c.memDoneIdx=1;
    await _retryRollback(c,"r1",1);
    const rec=state.memory.find(m=>m.id==="mRec"), arc=state.memory.find(m=>m.id==="mArc");
    const t1=!!_retryTarget(c);
    c.messages.push({mid:"tb",role:"assistant",speaker:"Narrator",narratorEvent:true,travelBeat:true,content:"You walk to the park."});
    const t2=!!_retryTarget(c);
    return {rec:!!rec,recMids:rec&&rec.srcMids,arc:!!arc,t1,t2};
  });
  ok("Retry keeps a reconciled memory (only the retried line leaves its sources)",R.rec&&!R.recMids.includes("r1")&&R.recMids.includes("x1"),JSON.stringify(R));
  ok("…and still takes back the arc cut made from the discarded reply",!R.arc,JSON.stringify(R));
  ok("Retry is offered on the latest reply, and refused once the scene has moved on (travel)",R.t1===true&&R.t2===false,JSON.stringify(R));

  ok("no page errors",errs.length===0,errs.join(" | "));
  console.log(`\n  ${pass} passed, ${fail} failed`);
  await b.close(); process.exit(fail?1:0);
})();
