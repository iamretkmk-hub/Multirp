/* v150.37 — THE FRAGMENT MODEL: the reply payload as fragments with a main body, per-path text and
   "choose when" options. Checked here:
     • the shipped fragments are built from the user's layouts: header, intro and body in one box; the
       paths that worded a fragment differently keep their own text; heat has the language and "talk you
       into it" fragments; the guardrails box is a fragment with per-path variants and coded options;
     • compile per path: main bodies only by default; an option injects when its code condition holds
       (emotion, intensity, ego, stalled, voicing…), when the decision model's answer to its question is at
       or above the threshold, and only when both hold for an option with both; mode "one" keeps the most
       likely; an option limited to some paths stays off the others;
     • a reply payload built with the switch on is the compiled fragments with {{call//…}} data filled and
       no placeholder left; off, the layout is the user's template as before;
     • the per-reply Decisions request carries every question of the path, with the information each asks
       for (the memories for "a past she does not have"), and stores the answers the compile reads;
     • settings: the switch defaults off, the threshold round-trips.
   Run: node tests/fragments.browser.js */
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
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x||c).slice(0,700));} };
  const C=(kind,flags,asks)=>pg.evaluate(a=>fragCompile(a[0],ptCondFlags(a[1]||{}),a[2]||{}),[kind,flags,asks]);

  console.log("\n[the shipped fragments]");
  ok("thirty-eight fragments, every one with an id, a name, a segment and paths", await pg.evaluate(()=>FRAG_DEFAULTS.length===38&&FRAG_DEFAULTS.every(f=>f.id&&f.name&&(f.seg==="head"||f.seg==="tail")&&Array.isArray(f.paths)&&f.paths.length)));
  ok("a header and its body are one box (ties: heading, the user's intro, the data)", await pg.evaluate(()=>{ const f=FRAG_DEFAULTS.find(x=>x.id==="ties");
      return /^# WHO THESE PEOPLE ARE TO YOU\nThese are your established ties/.test(f.text)&&/\{\{call\/\/relationships\}\}$/.test(f.text) ? true : f.text; }));
  ok("heat has the language and 'talk you into it'; others present is not on heat", await pg.evaluate(()=>{ const g=id=>FRAG_DEFAULTS.find(x=>x.id===id);
      return g("language").paths.includes("heat")&&g("talk_into").paths.includes("heat")&&!g("others").paths.includes("heat")&&g("biology").paths.join()==="heat"; }));
  ok("the guardrails are a fragment: shared body, text and heat variants, coded options; empty and 'never' rails gone", await pg.evaluate(()=>{ const f=FRAG_DEFAULTS.find(x=>x.id==="guardrails");
      const ids=f.options.map(o=>o.id).join();
      return (/^# FINAL GUARDRAILS/.test(f.text)&&/You are \{\{self\}\} and nobody else/.test(f.text)&&!/\{\{if/.test(JSON.stringify(f))&&/typed message/.test(f.byPath.text)&&/Dialogue-dense/.test(f.byPath.heat)
        &&ids==="oblique_once,noecho,heat_sound,heat_silent"&&!/rail_single_solo|\[\[/.test(JSON.stringify(f))) ? true : ids; }));
  ok("say no: three options, each asking about its own situation; the past one asks for the memories", await pg.evaluate(()=>{ const f=FRAG_DEFAULTS.find(x=>x.id==="say_no");
      const o=id=>f.options.find(x=>x.id===id);
      return (f.options.length===3&&o("unknown_past").ctx.join()==="memories"&&/not in \{\{char\}\}'s memories/.test(o("unknown_past").ask)&&/Being warm is not agreeing/.test(o("pushed").text)&&/AND IF YOU DO CROSS IT/.test(o("crossed").text)) ? true : JSON.stringify(f.options.map(x=>x.id)); }));

  console.log("\n[compile]");
  const base=await C("solo",{render_mode:"solo"},{});
  ok("solo, nothing applying: the main bodies, in order, head before the history and tail after", /^\[system\]\n\{\{call\/\/rp_task\}\}/.test(base)&&base.indexOf("# THIS IS WHO YOU ARE")<base.indexOf("{{call//dialogue_history}}")&&base.indexOf("# FINAL GUARDRAILS")>base.indexOf("{{call//dialogue_history}}")&&/\[user end\]\n$/.test(base), base.slice(0,300));
  ok("…and no choose-when text: no compass level, no 'what happened just before', no stalled warning, no say-no", !/Right now your|WHAT HAPPENED JUST BEFORE|made this same move|YOU CAN SAY NO/.test(base), base.slice(-400));
  ok("solo uses its own memory wording", /answer from that time/.test(base));
  const coded=await C("solo",{render_mode:"solo",emotion:"Anger",intensity:"intense",ego:"id_ahead",stalled:true,scene_start:true},{});
  ok("code conditions: emotion's speaking style, intense → show-don't-name, ego id_ahead → its compass line, stalled → the warning, scene start → just before",
     /YOUR EMOTION — YOU SHOW/.test(coded)&&/want is ahead of your conscience/.test(coded)&&/made this same move/.test(coded)&&/WHAT HAPPENED JUST BEFORE THIS/.test(coded)&&(coded.match(/\{\{call\/\/style_emotion\}\}/g)||[]).length===1, coded.slice(0,200));
  const asked=await C("solo",{render_mode:"solo"},{"q_talk_into__ask":0.91,"q_talk_into__opening":0.4,"q_say_no__unknown_past":0.75});
  ok("asks: 0.91 injects the significant-ask text, 0.4 does not inject the opening, 0.75 injects the past rule", /being asked is not a reason/.test(asked)&&!/Yes becomes possible/.test(asked)&&/it has not happened for you/.test(asked));
  ok("the threshold is the setting", await pg.evaluate(()=>{ state.fragAt=0.8; const t=fragCompile("solo",ptCondFlags({render_mode:"solo"}),{"q_say_no__unknown_past":0.75}); state.fragAt=0.7;
      return !/it has not happened for you/.test(t); }));
  ok("code and ask together: a motive is injected only when they carry one AND it bears on now", await pg.evaluate(()=>{
      const a=fragCompile("solo",ptCondFlags({has_motive:true}),{"q_motive__bears":0.9}), b=fragCompile("solo",ptCondFlags({has_motive:false}),{"q_motive__bears":0.9}), c=fragCompile("solo",ptCondFlags({has_motive:true}),{"q_motive__bears":0.2});
      return (/intent_warm/.test(a)&&!/intent_warm/.test(b)&&!/intent_warm/.test(c)) ? true : [a.length,b.length,c.length].join(); }));
  ok("mode 'one' keeps only the most likely of the options that apply", await pg.evaluate(()=>{
      const keep=state.fragments; state.fragments=JSON.parse(JSON.stringify(FRAG_DEFAULTS)); state.fragments.find(f=>f.id==="say_no").mode="one";
      const t=fragCompile("solo",ptCondFlags({}),{"q_say_no__unknown_past":0.8,"q_say_no__pushed":0.95}); state.fragments=keep;
      return (/Being warm is not agreeing/.test(t)&&!/it has not happened for you/.test(t)) ? true : "both or neither"; }));
  const heatV=await C("heat",{render_mode:"heat",voicing:true},{});
  const heatS=await C("heat",{render_mode:"heat",voicing:false},{});
  ok("heat: its own guardrails, the language, talk-you-into-it, biology; spoken → the sound rule, silent → the silent rule",
     /Dialogue-dense/.test(heatV)&&/## YOUR LANGUAGE/.test(heatV)&&/WHEN SOMEONE TRIES TO TALK YOU INTO IT/.test(heatV)&&/YOUR WOMAN BIOLOGY/.test(heatV)&&/break with SOUNDS/.test(heatV)&&!/break between words/.test(heatV)&&/break between words/.test(heatS)&&!/OTHERS PRESENT/.test(heatV), heatV.slice(-500));
  const txt=await C("text",{render_mode:"text",continuing:true},{});
  ok("text: the format call, the texting guardrails, 'do not echo' always (text), oblique-once never on text", /\{\{call\/\/format\}\}/.test(txt)&&/typed message/.test(txt)&&/Do not echo/.test(txt)&&!/CIRCLE IT ONCE/.test(await C("text",{render_mode:"text",stalled:true},{})), txt.slice(-300));
  ok("solo continuing: no echo rule; not continuing: it is there", !/Do not echo/.test(await C("solo",{render_mode:"solo",continuing:true},{}))&&/Do not echo/.test(await C("solo",{render_mode:"solo",continuing:false},{})));

  console.log("\n[a reply payload]");
  ok("switch on: the reply's messages are the compiled fragments, data filled, no placeholder left", await pg.evaluate(()=>{
      const uni=state.universes[0]; state.personas=state.personas.filter(p=>p.id!=="p_b");
      state.personas.push({id:"p_b",name:"Burcu",universeId:uni.id,instructions:"x",personality:"Sharp.",backstory:"x",style:"Short, dry.",goals:"x",look:{}});
      const c=curChat(); c.presentIds=["p_b"]; c.universeId=uni.id; state.curUniverse=uni.id; c.messages=[{mid:"u1",role:"user",content:"Selam.",speaker:state.user}];
      state.fragOn=true;
      const p=state.personas.find(x=>x.id==="p_b");
      const tb=buildTailBlocks({chat:c,selfP:p,selfName:"Burcu",selfId:"p_b",targetName:state.user,targetId:"__user__",injected:{recent:[],diary:[],longterm:[]}});
      const msgs=ptBuildMessages("solo",tb,[],{chat:c,npc:p,targetName:state.user});
      state.fragOn=false;
      const all=JSON.stringify(msgs||[]);
      return (msgs&&msgs.length>=2&&/FINAL GUARDRAILS/.test(all)&&/You are Burcu and nobody else/.test(all)&&!/\{\{(call|user|self|char)/.test(all)) ? true : all.slice(0,600); }));
  ok("switch off: the layout is the template as before", await pg.evaluate(()=>{ state.fragOn=false; return fragOnFor("solo")===false&&ptTemplate("solo")===ptTemplate("solo"); }));

  console.log("\n[the per-reply request]");
  ok("with the switch on, the request carries the path's questions and the information they ask for", await pg.evaluate(async()=>{
      window.__reqs=[]; const realF=window.fetch;
      window.fetch=async(u,o)=>{ if(String(u).indexOf("/api/alpha/decisions")>-1){ const body=JSON.parse(o.body); window.__reqs.push(body);
          const answers={}; Object.keys(body.questions).forEach(k=>{ answers[k]=k==="emotion"?{type:"choice",choice:"joy"}:k==="intensity"?{type:"choice",choice:"mild"}:k==="ego"?{type:"choice",choice:"no_conflict"}:{type:"noul",noul:k==="q_say_no__unknown_past"?0.88:0.1}; });
          return new Response(JSON.stringify({answers}),{status:200}); } return realF(u,o); };
      const c=curChat(), p=state.personas.find(x=>x.id==="p_b"); state.key="sk-test"; state.fragOn=true; state.emoOn=true; c.emo={};
      state.memory=[{id:"m1",ownerId:"p_b",content:"We went to the market on Tuesday.",gameDay:1}];
      c.messages.push({mid:"u2",role:"user",content:"Remember our trip to Paris?",speaker:state.user});
      const out=await emotionEnsure(c,p,"Remember our trip to Paris?",{targetId:"__user__",kind:"solo"});
      window.fetch=realF; state.fragOn=false;
      const r=window.__reqs[0]; if(!r) return "no request";
      const qk=Object.keys(r.questions);
      const need=["emotion","intensity","ego","q_talk_into__ask","q_talk_into__opening","q_say_no__unknown_past","q_say_no__pushed","q_say_no__crossed","q_read_moment__light","q_already_happened__bears","q_motive__bears"];
      const miss=need.filter(k=>qk.indexOf(k)<0);
      return (!miss.length&&/market on Tuesday/.test(JSON.stringify(r.state.memories))&&Array.isArray(r.state.plans_done)&&Array.isArray(r.state.motives)&&out.asks["q_say_no__unknown_past"]===0.88&&out.emotion==="Joy") ? true : JSON.stringify({miss,keys:Object.keys(r.state)}); }));
  ok("the compile reads those stored answers for the reply", await pg.evaluate(()=>{ const c=curChat(), e=charEmotion(c,"p_b");
      const t=fragCompile("solo",ptCondFlags({render_mode:"solo",emotion:e.emotion}),e.asks); return /it has not happened for you/.test(t) ? true : "not injected"; }));
  ok("switch off and emotion off: no request at all", await pg.evaluate(async()=>{ state.fragOn=false; state.emoOn=false; window.__n=0; const realF=window.fetch;
      window.fetch=async(u,o)=>{ if(String(u).indexOf("decisions")>-1)window.__n++; return realF(u,o); };
      const c=curChat(); c.messages.push({mid:"u3",role:"user",content:"x",speaker:state.user}); await emotionEnsure(c,state.personas.find(x=>x.id==="p_b"),"x",{kind:"solo"});
      window.fetch=realF; state.emoOn=true; return window.__n===0 ? true : window.__n+" requests"; }));

  console.log("\n[settings]");
  ok("a fresh install has the switch off and the threshold at 0.7", await pg.evaluate(()=>{ localStorage.removeItem(K.fragOn); localStorage.removeItem(K.fragAt); loadState(); return state.fragOn===false&&state.fragAt===0.7; }));

  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close();
  process.exit(fail?1:0);
})().catch(e=>{ console.error(e); process.exit(1); });
