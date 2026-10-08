/* v150.37 — THE FRAGMENT MODEL: the reply payload as fragments with a main body, per-path text and
   "choose when" options. Checked here:
     • the shipped fragments are built from the user's layouts: header, intro and body in one box; the
       paths that worded a fragment differently keep their own text; heat has the language and "talk you
       into it" fragments; the guardrails box is a fragment with per-path variants and coded options;
     • compile per path: main bodies only by default; an option injects when its code condition holds
       (emotion, intensity, ego, stalled, voicing…), when the decision model's answer to its question is at
       or above the threshold, and only when both hold for an option with both; mode "one" keeps the most
       likely; an option limited to some paths stays off the others;
     • a reply payload is the compiled fragments with {{call//…}} data filled and no placeholder left (v150.66: always —
       the on/off switch and the templates it fell back to are gone);
     • the per-reply Decisions request carries every question of the path, with the information each asks
       for (the memories for "a past she does not have"), and stores the answers the compile reads;
     • settings: the threshold round-trips; an old stored switch-off ("0") switches nothing off.
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
  ok("forty-four fragments (v150.48: + the spoken limits; v150.57: + what you know of them; v150.58: + what you already said; v150.64: + how you feel about them, + what your body is doing; v150.66: + how long the text sat), every one with an id, a name, a segment and paths", await pg.evaluate(()=>FRAG_DEFAULTS.length===44&&FRAG_DEFAULTS.every(f=>f.id&&f.name&&(f.seg==="head"||f.seg==="tail")&&Array.isArray(f.paths)&&f.paths.length)));
  // v150.59 — the heading, the intro and the data in one box: the "Your ties" option, injected when there are ties (has_ties)
  ok("a header and its body are one box (ties: heading, the user's intro, the data)", await pg.evaluate(()=>{ const f=FRAG_DEFAULTS.find(x=>x.id==="ties"), o=(f.options||[]).find(x=>x.id==="ties");
      return (o&&o.code==="has_ties"&&/^# WHO THESE PEOPLE ARE TO YOU\nThese are your established ties/.test(o.text)&&/\{\{call\/\/rel_sheet_raw\}\}/.test(o.text)) ? true : JSON.stringify(f); }));
  ok("heat has the language and 'talk you into it'; others present is not on heat", await pg.evaluate(()=>{ const g=id=>FRAG_DEFAULTS.find(x=>x.id===id);
      return g("language").paths.includes("heat")&&g("talk_into").paths.includes("heat")&&!g("others").paths.includes("heat")&&g("biology").paths.join()==="heat"; }));
  ok("the guardrails are a fragment: shared body, text and heat variants, coded options; empty and 'never' rails gone", await pg.evaluate(()=>{ const f=FRAG_DEFAULTS.find(x=>x.id==="guardrails");
      const ids=f.options.map(o=>o.id).join();
      // v150.59 — the main body is the heading and the rules every path shares; text and heat add only their own rules under it
      return (/^# FINAL GUARDRAILS\n\nNothing you were given/.test(f.text)&&/You are \{\{self\}\} and nobody else/.test(f.text)&&!f.byPath.solo&&!f.byPath.multi&&!f.byPath.gm&&!/\{\{if/.test(JSON.stringify(f))&&/^This is a typed message/.test(f.byPath.text)&&/^Dialogue-dense/.test(f.byPath.heat)&&!/You are \{\{self\}\} and nobody else/.test(f.byPath.text+f.byPath.heat)
        &&ids==="oblique_once,noecho,noecho_text,heat_sound,heat_silent,consistency_character,consistency_player,consistency_repeat,consistency_continuity"
        // v150.69 — "do not echo" is two options, chosen by their ticks: spoken when not continuing, text and heat always
        &&(o=>o.code==="not continuing"&&o.paths.join()==="solo,multi,gm")(f.options[1])&&(o=>o.code===""&&o.paths.join()==="text,heat"&&o.text===f.options[1].text)(f.options[2])&&!/rail_single_solo|\[\[/.test(JSON.stringify(f))) ? true : ids; })); // v150.45 — consistency: the note after a reply the check flagged
  ok("say no: three options, each asking about its own situation; the past one asks for the memories", await pg.evaluate(()=>{ const f=FRAG_DEFAULTS.find(x=>x.id==="say_no");
      const o=id=>f.options.find(x=>x.id===id);
      return (f.options.length===3&&o("unknown_past").ctx.join()==="memories"&&/not in \{\{char\}\}'s memories/.test(o("unknown_past").ask)&&/Being warm is not agreeing/.test(o("pushed").text)&&/AND IF YOU DO CROSS IT/.test(o("crossed").text)) ? true : JSON.stringify(f.options.map(x=>x.id)); }));

  /* v150.48 — the spoken limits were judged on every reply and never reached it under the fragment model. */
  ok("the spoken limits are a shipped fragment, before the guidance, on every path", await pg.evaluate(()=>{ const ids=FRAG_DEFAULTS.map(f=>f.id), f=FRAG_DEFAULTS.find(x=>x.id==="limits");
      return (f&&/^# WHAT YOU HAVE SAID ABOUT HOW FAR THIS GOES\n[\s\S]*\n\{\{call\/\/limits_lines_raw\}\}$/.test(f.text)&&f.seg==="tail"&&f.paths.length===5&&ids.indexOf("limits")===ids.indexOf("guidance")-1)?true:JSON.stringify(f); }));
  ok("a list saved before them gets the limits and the consistency option once; deleting them afterwards sticks", await pg.evaluate(()=>{
      // (v150.59: a list from before v150.45 holds the v150.58 guardrails without the note; it gets the note option, and the
      // v150.59 rewrite then turns that still-untouched fragment into today's, with one option per flag)
      const old=JSON.parse(JSON.stringify(FRAG_DEFAULTS)).filter(f=>f.id!=="limits"); const gi=old.findIndex(f=>f.id==="guardrails");
      old[gi]=JSON.parse(JSON.stringify(FRAG_DEFAULTS_V150_58.guardrails)); old[gi].options=old[gi].options.filter(o=>o.id!=="consistency");
      store.setRaw(K.fragAdds,""); state.fragments=old; _fragMigratedFor=null;
      const L=fragList(), ids=L.map(f=>f.id), got=ids.indexOf("limits")===ids.indexOf("guidance")-1&&L.find(f=>f.id==="guardrails").options.some(o=>o.id==="consistency_repeat")
        &&!L.find(f=>f.id==="guardrails").options.some(o=>o.id==="consistency");
      const stored=JSON.parse(store.raw(K.fragments,"[]")).some(f=>f.id==="limits");
      const mine=JSON.parse(JSON.stringify(L)).filter(f=>f.id!=="limits"); state.fragments=mine; const again=fragList().some(f=>f.id==="limits");
      state.fragments=null; store.setRaw(K.fragments,"");
      return (got&&stored&&!again&&/limits/.test(store.raw(K.fragAdds,"")))?true:JSON.stringify({got,stored,again}); }));
  ok("the compiled layout calls the limits", await pg.evaluate(()=>/\{\{call\/\/limits_lines_raw\}\}/.test(fragCompile("solo",ptCondFlags({}),{}))?true:"missing"));

  console.log("\n[compile]");
  const base=await C("solo",{render_mode:"solo"},{});
  ok("solo, nothing applying: the main bodies, in order, head before the history and tail after", /^\[system\]\nYou are \{\{char\}\}\.\n\n# TASK/.test(base)&&base.indexOf("# THIS IS WHO YOU ARE")<base.indexOf("{{call//dialogue_history}}")&&base.indexOf("# FINAL GUARDRAILS")>base.indexOf("{{call//dialogue_history}}")&&/\[user end\]\n$/.test(base), base.slice(0,300));
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
      return (/QUIETLY AFTER WITH/.test(a)&&!/QUIETLY AFTER WITH/.test(b)&&!/QUIETLY AFTER WITH/.test(c)) ? true : [a.length,b.length,c.length].join(); }));   // v150.59 — the wording is in the box
  ok("mode 'one' keeps only the most likely of the options that apply", await pg.evaluate(()=>{
      const keep=state.fragments; state.fragments=JSON.parse(JSON.stringify(FRAG_DEFAULTS)); state.fragments.find(f=>f.id==="say_no").mode="one";
      const t=fragCompile("solo",ptCondFlags({}),{"q_say_no__unknown_past":0.8,"q_say_no__pushed":0.95}); state.fragments=keep;
      return (/Being warm is not agreeing/.test(t)&&!/it has not happened for you/.test(t)) ? true : "both or neither"; }));
  const heatV=await C("heat",{render_mode:"heat",voicing:true,has_trackers:true},{});
  const heatS=await C("heat",{render_mode:"heat",voicing:false,has_trackers:true},{});
  ok("heat: its own guardrails, the language, talk-you-into-it, biology; spoken → the sound rule, silent → the silent rule",
     /Dialogue-dense/.test(heatV)&&/## YOUR LANGUAGE/.test(heatV)&&/WHEN SOMEONE TRIES TO TALK YOU INTO IT/.test(heatV)&&/YOUR WOMAN BIOLOGY/.test(heatV)&&/break with SOUNDS/.test(heatV)&&!/break between words/.test(heatV)&&/break between words/.test(heatS)&&!/OTHERS PRESENT/.test(heatV), heatV.slice(-500));
  const txt=await C("text",{render_mode:"text",continuing:true},{});
  ok("text: the texting format, the texting guardrails, 'do not echo' always (text), oblique-once never on text", /# FORMAT — YOU ARE TEXTING/.test(txt)&&/typed message/.test(txt)&&/Do not echo/.test(txt)&&!/CIRCLE IT ONCE/.test(await C("text",{render_mode:"text",stalled:true},{})), txt.slice(-300));
  ok("solo continuing: no echo rule; not continuing: it is there", !/Do not echo/.test(await C("solo",{render_mode:"solo",continuing:true},{}))&&/Do not echo/.test(await C("solo",{render_mode:"solo",continuing:false},{})));

  console.log("\n[a reply payload]");
  ok("the reply's messages are the compiled fragments, data filled, no placeholder left", await pg.evaluate(()=>{
      const uni=state.universes[0]; state.personas=state.personas.filter(p=>p.id!=="p_b");
      state.personas.push({id:"p_b",name:"Burcu",universeId:uni.id,instructions:"x",personality:"Sharp.",backstory:"x",style:"Short, dry.",goals:"x",look:{}});
      const c=curChat(); c.presentIds=["p_b"]; c.universeId=uni.id; state.curUniverse=uni.id; c.messages=[{mid:"u1",role:"user",content:"Selam.",speaker:state.user}];
      const p=state.personas.find(x=>x.id==="p_b");
      const tb=buildTailBlocks({chat:c,selfP:p,selfName:"Burcu",selfId:"p_b",targetName:state.user,targetId:"__user__",injected:{recent:[],diary:[],longterm:[]}});
      const msgs=ptBuildMessages("solo",tb,[],{chat:c,npc:p,targetName:state.user});
      const all=JSON.stringify(msgs||[]);
      return (msgs&&msgs.length>=2&&/FINAL GUARDRAILS/.test(all)&&/You are Burcu and nobody else/.test(all)&&!/\{\{(call|user|self|char)/.test(all)) ? true : all.slice(0,600); }));
  ok("there is no switch: every reply path is a fragment path, and a stored reply layout is not read", await pg.evaluate(()=>{
      const keep=state.payloadTemplates; state.payloadTemplates={solo:"[system]\nOLD-LAYOUT\n[system end]\n{{call//dialogue_history}}"}; state.payloadTplOn=true;
      const c=curChat(), p=state.personas.find(x=>x.id==="p_b");
      const tb=buildTailBlocks({chat:c,selfP:p,selfName:"Burcu",selfId:"p_b",targetName:state.user,targetId:"__user__",injected:{recent:[],diary:[],longterm:[]}});
      const all=JSON.stringify(ptBuildMessages("solo",tb,[],{chat:c,npc:p,targetName:state.user}));
      state.payloadTemplates=keep;
      return (["solo","multi","gm","text","heat"].every(k=>fragOnFor(k))&&typeof fragToggle==="undefined"&&/FINAL GUARDRAILS/.test(all)&&!/OLD-LAYOUT/.test(all)) ? true : all.slice(0,300); }));

  console.log("\n[the per-reply request]");
  ok("the request carries the path's questions and the information they ask for", await pg.evaluate(async()=>{
      window.__reqs=[]; const realF=window.fetch;
      window.fetch=async(u,o)=>{ if(String(u).indexOf("/api/alpha/decisions")>-1){ const body=JSON.parse(o.body); window.__reqs.push(body);
          const answers={}; Object.keys(body.questions).forEach(k=>{ answers[k]=k==="emotion"?{type:"choice",choice:"joy"}:k==="intensity"?{type:"choice",choice:"mild"}:k==="ego"?{type:"choice",choice:"no_conflict"}:{type:"noul",noul:k==="q_say_no__unknown_past"?0.88:0.1}; });
          return new Response(JSON.stringify({answers}),{status:200}); } return realF(u,o); };
      const c=curChat(), p=state.personas.find(x=>x.id==="p_b"); state.key="sk-test"; state.emoOn=true; c.emo={};
      // v150.64 — the motive question is asked only when a motive toward the one answered can be injected: Burcu carries one
      c.intents=[{id:"i_m",holderId:"p_b",holderName:"Burcu",targetId:"__user__",targetName:state.user,valence:"warm",kind:"crush",aim:"to be asked out",status:"brewing",strength:0.6}];
      state.memory=[{id:"m1",ownerId:"p_b",content:"We went to the market on Tuesday.",gameDay:1}];
      c.messages.push({mid:"u2",role:"user",content:"Remember our trip to Paris?",speaker:state.user});
      const out=await emotionEnsure(c,p,"Remember our trip to Paris?",{targetId:"__user__",kind:"solo"});
      window.fetch=realF;
      const r=window.__reqs[0]; if(!r) return "no request";
      const qk=Object.keys(r.questions);
      const need=["emotion","intensity","ego","q_talk_into__ask","q_talk_into__opening","q_say_no__unknown_past","q_say_no__pushed","q_say_no__crossed","q_read_moment__light","q_already_happened__bears","q_motive__bears"];
      const miss=need.filter(k=>qk.indexOf(k)<0);
      return (!miss.length&&/market on Tuesday/.test(JSON.stringify(r.state.memories))&&Array.isArray(r.state.plans_done)&&Array.isArray(r.state.motives)&&out.asks["q_say_no__unknown_past"]===0.88&&out.emotion==="Joy") ? true : JSON.stringify({miss,keys:Object.keys(r.state)}); }));
  ok("the compile reads those stored answers for the reply", await pg.evaluate(()=>{ const c=curChat(), e=charEmotion(c,"p_b");
      const t=fragCompile("solo",ptCondFlags({render_mode:"solo",emotion:e.emotion}),e.asks); return /it has not happened for you/.test(t) ? true : "not injected"; }));
  /* v150.66 — the switch is gone: with the emotion pick off, only an asked option on the path makes a request */
  ok("emotion off and no asked option on the path: no request at all", await pg.evaluate(async()=>{ state.emoOn=false; window.__n=0; const realF=window.fetch;
      const keep=state.fragments; state.fragments=JSON.parse(JSON.stringify(FRAG_DEFAULTS)).map(f=>Object.assign(f,{options:(f.options||[]).map(o=>Object.assign(o,{ask:""}))}));
      window.fetch=async(u,o)=>{ if(String(u).indexOf("decisions")>-1)window.__n++; return realF(u,o); };
      const c=curChat(); c.messages.push({mid:"u3",role:"user",content:"x",speaker:state.user});
      try{ await emotionEnsure(c,state.personas.find(x=>x.id==="p_b"),"x",{kind:"solo"}); } finally{ window.fetch=realF; state.emoOn=true; state.fragments=keep; }
      return window.__n===0 ? true : window.__n+" requests"; }));

  console.log("\n[speech & behaviour: spoken, text, heat (v150.61)]");
  ok("the path's group gives the main style; the picked emotion's box is offered; a blank box sends nothing", await pg.evaluate(()=>{
      const c=curChat(), p=state.personas.find(x=>x.id==="p_b");
      p.speech={spoken:{main:"Short, dry.",emo:{Anger:"Clipped, cold."}},text:{main:"",emo:{}},heat:{main:"Breathless, broken.",emo:{Desire:"Slow, low."}}}; p._speechMigrated="v150.61";
      c.emo={p_b:{emotion:"Anger",intensity:"clear"}};
      const base={chat:c,selfP:p,selfName:"Burcu",selfId:"p_b",targetName:state.user,targetId:"__user__",injected:{recent:[],diary:[],longterm:[]}};
      const solo=buildTailBlocks(base)._ss;
      c._heatBeat={n:1,total:3}; c.emo.p_b.emotion="Desire"; const heat=buildTailBlocks(base)._ss; delete c._heatBeat;
      c.emo.p_b.emotion="Joy"; const none=buildTailBlocks(base)._ss;
      return (solo.style_body==="Short, dry."&&solo.style_emotion==="Clipped, cold."&&heat.style_body==="Breathless, broken."&&heat.style_emotion==="Slow, low."&&!none.style_emotion) ? true : JSON.stringify({solo,heat,none}); }));
  ok("the style fragment injects the emotion's style only for the emotion picked", await pg.evaluate(()=>{
      const a=fragCompile("solo",ptCondFlags({emotion:"Anger"}),{}), b=fragCompile("solo",ptCondFlags({emotion:""}),{});
      return ((a.match(/\{\{call\/\/style_emotion\}\}/g)||[]).length===1&&!/style_emotion/.test(b)) ? true : "a/b wrong"; }));
  ok("the character editor shows one group at a time, keeps what was typed across groups, and saves it", await pg.evaluate(()=>{
      editPersona("p_b");
      const box=()=>document.getElementById('peSpeechBoxes');
      const anger=()=>box().querySelector('.psEmo[data-emo="Anger"]');
      if(!anger()||anger().value!=="Clipped, cold.") return "spoken Anger not loaded: "+(anger()&&anger().value);
      peSpeechSwitch("text"); box().querySelector('.psMain').value="Lowercase, no full stops."; anger().value="One word replies.";
      peSpeechSwitch("spoken"); if(anger().value!=="Clipped, cold.") return "switching lost the spoken text";
      peSpeechSwitch("text"); if(box().querySelector('.psMain').value!=="Lowercase, no full stops.") return "text main lost";
      const r=peSpeechRead();
      return (r.text.main==="Lowercase, no full stops."&&r.heat.main==="Breathless, broken."&&r.text.emo.Anger==="One word replies."&&r.spoken.emo.Anger==="Clipped, cold.") ? true : JSON.stringify(r); }));

  console.log("\n[the fragment editor]");
  ok("the editor lists every fragment and opens one for editing", await pg.evaluate(()=>{
      window.uiConfirm=async()=>true; _fragDraft=null; _fragOpen=null; state.fragments=null;
      const d=document.getElementById('fragCard'); if(!d) return "no #fragCard";   // v150.57 — its own card at the top of Payloads
      renderFragEditor(); const host=document.getElementById('fragHost');
      const n=host.querySelectorAll('button[onclick^="fragEdOpen"]').length;
      if(n!==FRAG_DEFAULTS.length) return n+" rows, want "+FRAG_DEFAULTS.length;
      const i=FRAG_DEFAULTS.findIndex(f=>f.id==="say_no"); fragEdOpen(i);
      const ta=host.querySelector(`textarea[data-fp="${i}.text"]`); if(!ta) return "no main body box";
      const opts=host.querySelectorAll(`button[onclick^="fragEdOptDel(${i},"]`).length;
      return opts===(FRAG_DEFAULTS[i].options||[]).length ? true : opts+" option forms"; }));
  ok("typing, adding and deleting a condition, ticking a path and saving land in the saved list", await pg.evaluate(async()=>{
      const host=document.getElementById('fragHost'), i=FRAG_DEFAULTS.findIndex(f=>f.id==="say_no");
      const ta=host.querySelector(`textarea[data-fp="${i}.text"]`); ta.value="EDITED MAIN"; fragEdInput(ta);
      const before=_fragDraft[i].options.length;
      fragEdOptAdd(i); const j=_fragDraft[i].options.length-1;
      const code=host.querySelector(`input[data-fp="${i}.o.${j}.code"]`); code.value="emotion = anger"; fragEdInput(code);
      const txt=host.querySelector(`textarea[data-fp="${i}.o.${j}.text"]`); txt.value="ANGRY NO"; fragEdInput(txt);
      await fragEdOptDel(i,0);
      fragEdByPath(String(i),"heat",true); const hb=host.querySelector(`textarea[data-fp="${i}.byPath.heat"]`); const emptyBox=hb.value===""; hb.value="HEAT MAIN"; fragEdInput(hb);
      fragEdSave();
      const f=state.fragments&&state.fragments[i], st=JSON.parse(localStorage.getItem(K.fragments)||"null");
      const solo=fragCompile("solo",ptCondFlags({emotion:"Anger"}),{}), heat=fragCompile("heat",ptCondFlags({emotion:"Anger",render_mode:"heat"}),{});
      return (f&&f.text==="EDITED MAIN"&&f.options.length===before&&f.options[f.options.length-1].text==="ANGRY NO"&&Array.isArray(st)&&st[i].byPath.heat==="HEAT MAIN"
        &&/EDITED MAIN/.test(solo)&&/ANGRY NO/.test(solo)&&!/HEAT MAIN/.test(solo)&&/EDITED MAIN\n\nHEAT MAIN/.test(heat)&&emptyBox) ? true : JSON.stringify({emptyBox,f:f&&{text:f.text,n:f.options.length},solo:solo.slice(0,200)}); }));   // v150.59 — the heat box starts empty and adds under the main body
  ok("adding a fragment, moving it up and limiting it to one path", await pg.evaluate(()=>{
      fragEdAdd(); const L=_fragDraft, k=L.length-1; L[k].text="NEW ONE"; fragEdMove(k,-1);
      if(L[k-1].text!=="NEW ONE") return "move failed";
      ["solo","multi","gm","heat"].forEach(p=>fragEdPath(String(k-1),p,false)); fragEdSave();
      return (/NEW ONE/.test(fragCompile("text",{},{}))&&!/NEW ONE/.test(fragCompile("solo",{},{}))) ? true : JSON.stringify(L[k-1].paths); }));
  ok("reset puts the shipped fragments back, and saving that clears the stored copy", await pg.evaluate(async()=>{
      await fragEdReset(); fragEdSave();
      return (state.fragments===null&&(localStorage.getItem(K.fragments)||"")===""&&fragList()===FRAG_DEFAULTS) ? true : "stored: "+String(localStorage.getItem(K.fragments)).slice(0,60); }));
  ok("the threshold is saved, and there is no on/off switch in the card", await pg.evaluate(()=>{
      const sw=!document.getElementById('fragOnSw');
      fragAtSet("0.85"); const at=state.fragAt===0.85&&localStorage.getItem(K.fragAt)==="0.85";
      fragAtSet("3"); const cl=state.fragAt===0.99;
      fragAtSet("0.7"); return (sw&&at&&cl) ? true : JSON.stringify({sw,at,cl}); }));

  console.log("\n[settings]");
  // v150.66 — the fragment model is the only way replies are built: an old stored switch-off ("0") is not read
  ok("a fresh install has the threshold at 0.7; an old stored switch-off switches nothing off", await pg.evaluate(()=>{ localStorage.removeItem(K.fragAt); loadState();
      const fresh=state.fragAt===0.7; localStorage.setItem(K.fragOn,"0"); loadState(); const still=!("fragOn" in state)&&fragOnFor("solo")===true;
      localStorage.removeItem(K.fragOn); loadState(); return (fresh&&still)?true:JSON.stringify({fresh,still}); }));

  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close();
  process.exit(fail?1:0);
})().catch(e=>{ console.error(e); process.exit(1); });
