/* v150.96 — A CHARACTER WHO SAYS GOODBYE AND SETS OFF LEAVES. Burcu said "Ben kalkayım artık", stood, said her goodbye and
   turned for the boardwalk exit — and stayed in the scene: the movement request offered only the other areas of the place,
   and the presence tracker counts only a completed departure. The movement request now also asks, for everyone here,
   whether they leave the place (x_move_leave, yes/no); a yes at moveAt() narrates their exit and takes them out.
   Also: the wearing tracker writes its value in English and never records an accessory as an outfit.
   Run: node tests/move-leave.browser.js */
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:process.env.SM_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage({viewport:{width:412,height:915}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file://'+require('path').resolve(__dirname,'..','index.html')); await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(800);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x===undefined?c:x).slice(0,800));} };

  await pg.evaluate(()=>{
    window.__reqs=[]; window.__calls=[]; window.__leave={}; window.__move={};
    const realF=window.fetch;
    window.fetch=async(u,o)=>{ if(String(u).indexOf("/api/alpha/decisions")>-1){ const body=JSON.parse(o.body); __reqs.push(body);
        const out={}; Object.keys(body.questions).forEach(k=>{ const q=body.questions[k];
          const nm=["Burcu","Deniz"].find(n=>q.instructions.indexOf(n+" ")>=0);
          if(/^leave_/.test(k)){ const p=__leave[nm]||0; out[k]={type:"noul",probabilities:{true:p,false:1-p}}; }
          else if(/^move_/.test(k)){ const keys=Object.keys(q.criteria), pr={}; keys.forEach(x=>{ pr[x]=0; });
            const w=__move[nm], dest=w&&keys.find(x=>q.criteria[x].indexOf(w.to)===0);
            if(dest){ pr[dest]=w.p; pr.stay=1-w.p; } else pr.stay=1; out[k]={type:"choice",choice:dest||"stay",probabilities:pr}; }
          else if(/^why_/.test(k)) out[k]={type:"choice",choice:"done"};
          else if(k==="player_area") out[k]={type:"choice",choice:"stay",probabilities:{stay:1}}; });
        return new Response(JSON.stringify({answers:out}),{status:200}); } return realF(u,o); };
    window.chatCompletion=async(msgs,model,opts)=>{ const d=(opts&&opts.dbg)||""; __calls.push({d,msgs}); if(/^Character move/.test(d))return "Burcu güneş gözlüğünü takıp iskele boyunca uzaklaşıyor."; return "{}"; };
    window.__setup=()=>{
      const uni=state.universes[0];
      uni.locations=[{id:"l_k",name:"Kumsal Beach Club",type:"poi",description:"A modern beach club.",residents:[],
        sublocations:[{id:"s_gate",name:"Boardwalk Gate",entrance:true,description:"the boardwalk entrance"},{id:"s_bar",name:"Seaside Bar",description:"bamboo bar"}]}];
      const mk=(id,name)=>({id,name,universeId:uni.id,personality:"x",look:{},relationships:{__user__:{tie:"close friend",relationship:"x"}}});
      state.personas=[mk("p_b","Burcu"),mk("p_d","Deniz")];
      Object.assign(state,{key:"k",user:"Emre",moveDecOn:true,moveAt:0.75,presenceOff:false,gmOn:false});
      try{ _moveDecBreak.until=0; _moveDecBreak.fails=0; }catch(e){}
      const c=curChat(); Object.assign(c,{universeId:uni.id,locationId:"l_k",location:"Kumsal Beach Club",presentIds:["p_b","p_d"],
        subId:"s_gate",subPos:{p_b:"s_gate",p_d:"s_bar"},activeEvent:null,dnd:false,expected:[],_moveDecAt:{},_moveDecTurn:null,_exitedIds:[],
        messages:[{mid:"u1",role:"user",content:'"Benim sözüm senettir, bilirsin."'},
          {mid:"a1",role:"assistant",speaker:"Burcu",speakerId:"p_b",toId:"__user__",content:'"Görcez bakalım o senedin vadesini. Haber çıkar çıkmaz arıyorsun beni." *Güneş gözlüğümü takıyorum ve tahta iskele boyunca çıkışa doğru dönüyorum.*'}]});
      delete c._heatBeat; window.__reqs=[]; window.__calls=[]; window.__leave={}; window.__move={};
      return c; };
  });

  console.log("\n[the question]");
  const Q=await pg.evaluate(async()=>{ const c=__setup(); await maybeMoveDecision(c); const r=__reqs[0]||{questions:{}};
    const lv=Object.entries(r.questions).filter(([k])=>/^leave_/.test(k)).map(([k,q])=>q);
    return {n:__reqs.length,lv,keys:Object.keys(r.questions)}; });
  ok("the movement request asks each character here whether they leave the place (yes/no)", Q.n===1&&Q.lv.length===2&&Q.lv.every(q=>q.type==="noul"), JSON.stringify(Q.keys));
  ok("the question names the place and the player, and counts a goodbye followed by setting off",
     /^Burcu is at Kumsal Beach Club with Emre\./.test(Q.lv[0].instructions)&&/turned for the exit or the door/.test(Q.lv[0].criteria.true)&&/leave together with Emre/.test(Q.lv[0].criteria.false), JSON.stringify(Q.lv[0]));

  console.log("\n[Burcu leaves]");
  const L=await pg.evaluate(async()=>{ const c=__setup(); __leave={Burcu:0.92};
    const r=await maybeMoveDecision(c); const note=c.messages[c.messages.length-1];
    return {r,present:c.presentIds.slice(),note:note&&{content:note.content,pn:!!note.presenceNote},exited:c._exitedIds.slice(),
      calls:__calls.map(x=>x.d)}; });
  ok("a yes at 0.92 takes her out of the scene", L.r===true&&JSON.stringify(L.present)==='["p_d"]'&&L.exited.includes("p_b"), JSON.stringify(L));
  ok("her exit is narrated in a presence note", L.note&&L.note.pn&&/uzaklaşıyor/.test(L.note.content), JSON.stringify(L.note));
  ok("she does not speak again — her own line was the goodbye", L.calls.length>0&&L.calls.every(d=>/^Character move/.test(d)), JSON.stringify(L.calls));
  ok("below the bar (0.6) she stays", await pg.evaluate(async()=>{ const c=__setup(); __leave={Burcu:0.6}; await maybeMoveDecision(c);
      return c.presentIds.includes("p_b")?true:JSON.stringify(c.presentIds); }));
  ok("leaving wins over an area move for the same person", await pg.evaluate(async()=>{ const c=__setup(); __leave={Burcu:0.9}; __move={Burcu:{to:"Seaside Bar",p:0.95}};
      await maybeMoveDecision(c); return (!c.presentIds.includes("p_b")&&c.subPos.p_b!=="s_bar")?true:JSON.stringify({p:c.presentIds,s:c.subPos}); }));
  ok("someone expected to come back is not asked", await pg.evaluate(async()=>{ const c=__setup(); c.expected=[{id:"p_b",name:"Burcu",turn:1}];
      await maybeMoveDecision(c); return Object.values((__reqs[0]||{questions:{}}).questions).some(q=>/^Burcu /.test(q.instructions))?"asked":true; }));
  ok("a place with one area still asks it", await pg.evaluate(async()=>{ const c=__setup(); locById("l_k").sublocations=[{id:"s_gate",name:"Boardwalk Gate",entrance:true}]; c.subPos={p_b:"s_gate",p_d:"s_gate"};
      __leave={Burcu:0.9}; await maybeMoveDecision(c); return (!c.presentIds.includes("p_b"))?true:JSON.stringify(Object.keys((__reqs[0]||{questions:{}}).questions)); }));
  ok("the leave prompt is on the Gamemaster card, after the reason", await pg.evaluate(()=>JSON.stringify(ENGINE_PAYLOAD_DEFS).indexOf('"x_move_why"},{"kind":"prompt","promptKey":"x_move_leave"')>-1));

  console.log("\n[the wearing tracker]");
  const W=await pg.evaluate(()=>X_ENGINE_PROMPTS.x_wearing_tracker.def);
  ok("writes its value in plain English, whatever the scene's language", /Write the value in plain English, whatever language the scene is in/.test(W)&&!/same language the scene is in/.test(W), W.slice(-400));
  ok("sunglasses, jewellery, a bag are not clothes, and an accessory is never an outfit", /sunglasses/.test(W)&&/Never return a value that is only an accessory/.test(W));
  ok("someone with nothing recorded is reported only with the garments on the body", /"\(nothing recorded\)", report them only when the lines say which garments/.test(W));
  ok("a stored copy of the old default is refreshed once", await pg.evaluate(async()=>{
      const OLD=X_ENGINE_PROMPTS.x_wearing_tracker.def.replace(/- Glasses[^\n]*\n/,"").replace(/- Where what someone[^\n]*\n/,"").replace(/- Write the value in plain English[^`]*$/,"- Write the value in the same language the scene is in.");
      store.setRaw(K.x_wearing_tracker||"sm_x_wearing_tracker",OLD); state.x_wearing_tracker=OLD; localStorage.removeItem("sm_pipesdone"); loadState();
      const r=up("x_wearing_tracker")===X_ENGINE_PROMPTS.x_wearing_tracker.def;
      state.x_wearing_tracker=undefined; store.setRaw(K.x_wearing_tracker||"sm_x_wearing_tracker",""); localStorage.removeItem("sm_pipesdone"); loadState();
      return r?true:String(up("x_wearing_tracker")).slice(-200); }));

  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close(); process.exit(fail?1:0);
})();
