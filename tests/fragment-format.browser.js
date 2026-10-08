/* v150.57 — THE FRAGMENTS IN THE FRAGMENT FORMAT. About ten shipped fragments were still chains of the old header /
   intro / body / footer pieces ({{call//target_header}}\n{{call//target_player}}…) picked inside code, so in the
   editor they looked like the old format. Each is one main box plus "choose when" options now, holding its own
   wording, with the live data called by its data-only name (*_raw). Checked here: no converted fragment calls an
   old piece; on every path and in every case (player or character target, continuing or not, heat, text, voiced,
   arriving, leaving, an event brief, promises, rumors, threads, the absence and not-yours guards) the payload
   carries the same sentences, line for line, as the v150.56 fragments did; no heading goes out with nothing under
   it; and a saved list is rewritten only where it is still the old default.
   Run: node tests/fragment-format.browser.js   (needs playwright; see tests/README.md) */
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:process.env.SM_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage({viewport:{width:412,height:915}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file://'+require('path').resolve(__dirname,'..','index.html')); await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(800);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x===undefined?c:x).slice(0,900));} };

  await pg.evaluate(()=>{
    const uni=state.universes[0];
    window.__CONV=["target","target_sheet","last_line","guidance","rumors","situation","brief","delivery","promises","threads","others","style","respond_as","memories"];
    // the v150.56 shipped list: today's defaults with the frozen old copies swapped back in, and no target_sheet
    // (v150.59: the v150.58 copies first, then the v150.56 ones; their path texts replaced the main body, so for building a
    // payload they are converted to today's "adds under the main body", exactly as a saved list is)
    window.__oldRaw=()=>FRAG_DEFAULTS.filter(f=>f.id!=="target_sheet").map(f=>JSON.parse(JSON.stringify(FRAG_DEFAULTS_V150_56[f.id]||FRAG_DEFAULTS_V150_58[f.id]||FRAG_DEFAULTS_V150_60_OLD[f.id]||f)));   // v150.60: the v150.59 wording of what it rewrote
    window.__oldList=()=>__oldRaw().map(f=>{ _fragByPathToAdd(f,f.paths||FRAG_PATHS); (f.options||[]).forEach(o=>_fragByPathToAdd(o,(o.paths&&o.paths.length)?o.paths:(f.paths||FRAG_PATHS))); return f; });
    window.__base=(frags)=>{
      state.personas=[
        {id:"p_a",name:"Ayla",universeId:uni.id,personality:"Ayla is sharp.",look:{},style:"Short, dry sentences.",instructions:"Hold the pause before answering.",relationships:{p_b:{tie:"my older brother"}}},
        {id:"p_b",name:"Berk",universeId:uni.id,personality:"Berk is loud.",look:{hair:"black hair"},style:"Loud."},
        {id:"p_c",name:"Cem",universeId:uni.id,personality:"Cem is away.",look:{},style:"x"}];
      state.user="Emre"; state.userBio="Emre is a carpenter."; state.userLook="Tall, grey eyes.";
      state.payloadTplOn=false; state.fragments=frags||null; state.autoSpeak=false; state.narrMode=false; state.gossip=[];
      state.pursuitRelevantOn=false;   // v150.79 — the wording of every piece, with every pursuit present (scene scoping: tests/pursuit-weight)
      store.setRaw(K.fragAdds,FRAG_SHIPPED_ADDS.map(a=>a.key).join(","));   // these lists are what the test means: no migration
      const c=curChat(); ["_heatBeat","activeEvent","watchingNow"].forEach(k=>{ delete c[k]; });
      Object.assign(c,{universeId:uni.id,presentIds:["p_a","p_b"],emo:{},promises:[],wearing:{},
        messages:[{mid:"u1",role:"user",content:'"Hi there."'},{mid:"a1",role:"assistant",speaker:"Ayla",speakerId:"p_a",content:'"Hello."'},
          {mid:"b1",role:"assistant",speaker:"Berk",speakerId:"p_b",content:'"Hey."'},{mid:"u2",role:"user",content:'"So, what now?"'}]});
      uni.gameData=uni.gameData||{}; uni.gameData.quests=[]; uni.userWardrobe="jeans and a sweater";
      setWearingOverride(c,"p_b","a red coat"); setWearingOverride(c,"__user__","a grey sweater");
      return c; };
    const S={
      cont:c=>c.messages.push({mid:"a2",role:"assistant",speaker:"Ayla",speakerId:"p_a",content:'"I said what I said."'}),
      heat:c=>{ c._heatBeat={n:2,total:5}; },
      lastbeat:c=>{ c._heatBeat={n:5,total:5}; },
      rich:c=>{
        c.promises=[{id:"pr1",holderId:"p_a",holderName:"Ayla",toId:"__user__",toName:"Emre",promise:"never tell Berk",status:"open",day:1},
                    {id:"pr2",holderId:"__user__",holderName:"Emre",toId:"p_a",toName:"Ayla",promise:"come back tomorrow",status:"open",day:1},
                    {id:"pr3",holderId:"p_a",holderName:"Ayla",toId:"__user__",toName:"Emre",promise:"keep the key",status:"broken",statusDay:1,day:1}];
        state.gossip=[{id:"g1",universeId:uni.id,text:"Emre was seen with someone at night",stakeholderId:"p_a",heat:0.8,status:"open",raisedBy:{}},
                      {id:"g2",universeId:uni.id,text:"Berk owes money",stakeholderId:"p_b",heat:0.7,status:"open",carriers:[{charId:"p_a"}]}];
        uni.gameData.quests=[{id:"q1",title:"The missing ledger",desc:"Someone took the ledger.",npcId:"p_a",startActive:true,progress:[]}];
        c.watchingNow={text:"A man drops a glass at the bar.",at:c.messages.length}; },
      spent:c=>{ S.rich(c); state.gossip[0].raisedBy={p_a:(c.gameDay||1)}; state.gossipCooldown=5;
        uni.gameData.quests.push({id:"q2",title:"The second debt",desc:"A debt comes due.",npcId:"p_a",startActive:true,progress:[]}); },
      markup:c=>{ c.messages.splice(1,1,{mid:"a1",role:"assistant",speaker:"Ayla",speakerId:"p_a",content:'"[say quietly] Hello."'}); },
      voiced:()=>{ state.autoSpeak=true; },
      absent:c=>{ c.messages.push({mid:"u3",role:"user",content:'Cem, gel buraya!'}); },
      notyours:c=>{ c.messages.push({mid:"b2",role:"assistant",speaker:"Berk",speakerId:"p_b",content:'"Emre, are you coming?"',toId:"__user__",toName:"Emre"}); },
      since:c=>{ c.messages=[{mid:"a0",role:"assistant",speaker:"Ayla",speakerId:"p_a",content:'"First."'},{mid:"u1",role:"user",content:'"Hm."'},{mid:"b1",role:"assistant",speaker:"Berk",speakerId:"p_b",content:'"Yes?"'}]; },
      event:c=>{ c.activeEvent={kind:"confrontation",trigger:"Berk slammed the door",summary:"Old debt between them",intent:"Demand the money back",_startMsg:0};
        c.messages.push({mid:"sb",role:"assistant",sceneBeat:true,speaker:"Narrator",content:"The door bangs open."}); },
      opener:c=>{ S.event(c); c.activeEvent.accuserId="p_a"; c.activeEvent.participant={approaching:false}; c.messages=c.messages.filter(m=>m.speakerId!=="p_a"); }
    };
    // one reply payload, as the real send path builds it (head + tail blocks, rebuild for the bare names)
    window.__build=(kind,o,frags)=>{
      o=o||{}; const c=__base(frags);
      if(kind==="heat")S.heat(c); (o.s||[]).forEach(k=>S[k](c));
      if(kind==="text")c.messages.forEach(m=>{ if(!m.sceneBeat){ m.textMsg=true; m.textWith="p_a"; } });
      const p=state.personas[0], others=presentCast(c).filter(x=>x.id!==p.id);
      const tId=("targetId" in o)?o.targetId:"__user__", tName=o.targetName||"Emre";
      const hopts={chat:c,targetName:tName,targetId:tId,textMode:kind==="text",payloadKind:kind};
      const topts={chat:c,selfP:p,selfId:p.id,selfName:p.name,targetName:("tail" in o)?o.tail:tName,targetId:tId,multi:kind==="multi",
        injected:{recent:[],diary:[],longterm:[]},textMode:kind==="text",payloadKind:kind};
      const mk=()=>Object.assign({},buildCharPromptBlocks(p,others,{recent:[],diary:[],longterm:[]},o.addressed||null,hopts),buildTailBlocks(topts));
      const B=mk();
      const m=ptBuildMessages(kind,B,[{role:"user",content:"(history)"}],{chat:c,npc:p,targetName:tName},mk)||[];
      return m.map(x=>x.content).join("\n\n");
    };
    window.__cases=[];
    ["solo","multi","gm","text","heat"].forEach(k=>{
      [["player",{}],["cont",{s:["cont"]}],["char",{targetId:"p_b",targetName:"Berk"}],["char_cont",{targetId:"p_b",targetName:"Berk",s:["cont"]}],
       ["rich",{s:["rich"]}],["spent",{s:["spent"]}],["markup",{s:["markup"]}],["markup_voiced",{s:["markup","voiced"]}],["voiced",{s:["voiced"]}],
       ["absent",{s:["absent"]}],["notyours",{s:["notyours"]}],["since",{s:["since"]}],["notarget",{tail:""}],
       ["arriving",{addressed:"arriving",s:["event"]}],["leaving",{addressed:"leaving"}],["opener",{s:["opener"]}],
       ["gone",{targetId:null,targetName:"Cem"}]].forEach(([n,o])=>__cases.push([k,n,o]));
    });
    __cases.push(["heat","lastbeat",{s:["lastbeat"]}],["heat","lastbeat_cont",{s:["lastbeat","cont"]}]);
  });

  console.log("\n[the format]");
  const OLD_PIECES=["target_header","cont_target_header","heat_target_header","target_player","target_char","cont_target_self","heat_target_self",
    "target_bg","target_known","target_look","target_wearing","last_line_header","last_line_footer","heat_self_header","heat_self_footer","last_line_body",
    "guidance_open","guidance_target","guidance_close","guidance_continue","guidance_reply","guidance_absence","guidance_not_yours","heat_guidance",
    "rumor_stake_header","rumor_stake_instr","rumor_stake_spent","rumor_stake_text","rumor_carrier_header","rumor_carrier_instr",
    "situation_leaving","situation_arriving","situation_brief","watching_now","voice_delivery","heat_delivery","voice_format_reset",
    "promise_yours","promise_owed","promise_ended","quest_intro","others_footer","style_notes","head_respond_as",
    "player_intro","player_bg","player_look","player_wearing","response_target","player","last_line"];
  const scan=await pg.evaluate((OLD)=>{
    const bad=[], texts=f=>{ const t=[f.text]; Object.values(f.byPath||{}).forEach(x=>t.push(x));
      (f.options||[]).forEach(o=>{ t.push(o.text); Object.values(o.byPath||{}).forEach(x=>t.push(x)); }); return t.join("\n"); };
    __CONV.forEach(id=>{ const f=FRAG_DEFAULTS.find(x=>x.id===id); if(!f){ bad.push(id+": missing"); return; }
      const t=texts(f); OLD.forEach(k=>{ if(new RegExp("\\{\\{\\s*call\\s*//\\s*"+k+"\\s*(//[^}]*)?\\}\\}").test(t))bad.push(id+" calls "+k); }); });
    return {bad,n:FRAG_DEFAULTS.length,order:FRAG_DEFAULTS.map(f=>f.id).join(",")};
  },OLD_PIECES);
  ok("no converted fragment calls an old header / intro / body / footer piece", scan.bad.length===0, scan.bad.join("; "));
  ok("45 shipped fragments (v150.58: + what you already said; v150.64: + the two feelings; v150.66: + how long the text sat; v150.74: + a photo you were asked for), with \"What you know of them\" right after \"Who you are answering\"", scan.n===45&&/,target,target_sheet,/.test(scan.order), scan.n+" "+scan.order);
  ok("every *_raw name a converted fragment calls is a known data name, and none is in an ORDER list the classic template prints",
    await pg.evaluate(()=>{ const used=new Set(); FRAG_DEFAULTS.forEach(f=>{ JSON.stringify(f).replace(/\{\{call\/\/([a-z_]+_raw)\}\}/g,(m,k)=>used.add(k)); });
      const miss=[...used].filter(k=>RAW_DATA_KEYS.indexOf(k)<0), printed=RAW_DATA_KEYS.filter(k=>RT_ORDER.concat(PL_ORDER,SI_ORDER,LL_ORDER,RG_ORDER,RU_ORDER,SS_ORDER,WN_ORDER,PR_ORDER,PRE_ORDER).indexOf(k)>=0);
      const known=ptKnownNames(); const unk=RAW_DATA_KEYS.filter(k=>!known[k]);
      return (used.size>=20&&!miss.length&&!printed.length&&!unk.length)?true:JSON.stringify({n:used.size,miss,printed,unk}); }));

  console.log("\n[the same sentences as the v150.56 fragments, on every path and in every case]");
  const cmp=await pg.evaluate(()=>{
    // (v150.59 fixed one line: the v150.58 "already said" box sent a literal "\u2014" where it meant a dash)
    /* v150.59 — the final guardrails hold the shared rules once and text / heat add theirs under them, so on those two paths
       the same rules arrive in another order: compared as a set from the heading on */
    const norm=t=>{ const L=t.split("\\u2014").join("\u2014").split("\n").map(l=>l.trim()).filter(Boolean);
      const g=L.indexOf("# FINAL GUARDRAILS"); if(g<0)return L.join("\n");
      let e=g+1; while(e<L.length&&!/^# /.test(L[e]))e++;
      return L.slice(0,g+1).concat(L.slice(g+1,e).sort(),L.slice(e)).join("\n"); };
    const out={diff:[],n:0,raw:0,left:[]};
    /* v150.60 — last_before, language and privacy have their own text-path wording on purpose; this check holds the rest
       of the payload to v150.56, so those three are compared at their v150.59 wording */
    /* v150.65 — and the ties and "What you know of them" at their v150.64 wording: the one answered moving into their own
       section (with their whole entry) is on purpose, and is checked in tests/relationship-sheet.browser.js */
    /* v150.67 — the base instruction, the format rules and the narration shape are options again: they bring in the
       user's own Settings text, which no fragment sent since v150.57, so this comparison leaves them out */
    const _no67=f=>{ if(f.id==="task"||f.id==="format")f.options=(f.options||[]).filter(o=>["base","format_rules","narration_shape"].indexOf(o.id)<0); return f; };
    const at59=FRAG_DEFAULTS.map(f=>_no67(JSON.parse(JSON.stringify(FRAG_DEFAULTS_V150_64_OLD[f.id]||FRAG_DEFAULTS_V150_60_OLD[f.id]||f))));
    __cases.forEach(([k,n,o])=>{ const a=__build(k,o,__oldList()), b=__build(k,o,at59); out.n++;
      if(a!==b)out.raw++;
      if(norm(a)!==norm(b)){ const A=norm(a).split("\n"), B=norm(b).split("\n"); let i=0; while(i<A.length&&A[i]===B[i])i++;
        out.diff.push(k+"_"+n+" @"+i+": OLD «"+(A[i]||"").slice(0,120)+"» NEW «"+(B[i]||"").slice(0,120)+"»"); }
      if(/\{\{|\[\[/.test(b))out.left.push(k+"_"+n); });
    return out; });
  ok("the payload is line-for-line the v150.56 one in all "+cmp.n+" cases (only blank lines move)", cmp.n>=80&&cmp.diff.length===0&&cmp.raw>0, cmp.diff.slice(0,6).join("\n        "));
  ok("no placeholder or marker is left in any of them", cmp.left.length===0, cmp.left.join(", "));

  console.log("\n[the sentences, case by case]");
  const P=await pg.evaluate(()=>{
    const g=(k,o)=>__build(k,o,null);
    return {player:g("solo",{}),char:g("multi",{targetId:"p_b",targetName:"Berk"}),cont:g("solo",{s:["cont"]}),heatCont:g("heat",{s:["cont"]}),
      heat:g("heat",{}),last:g("heat",{s:["lastbeat"]}),absent:g("solo",{s:["absent"]}),voiced:g("solo",{s:["voiced"]}),heatVoiced:g("heat",{s:["voiced"]}),
      rich:g("gm",{s:["rich"]}),spent:g("solo",{s:["spent"]}),notyours:g("multi",{s:["notyours"]}),arriving:g("multi",{addressed:"arriving",s:["event"]}),
      heatArr:g("heat",{addressed:"arriving",s:["event"]}),leaving:g("solo",{addressed:"leaving"}),gone:g("solo",{targetId:null,targetName:"Cem"}),
      markupText:g("text",{s:["markup","voiced"]}),markup:g("solo",{s:["markup"]}),textCont:g("text",{s:["cont"]})};
  });
  ok("reply to the player: the heading, \"Emre is the human player\", and their backstory, looks and clothes",
    /# ⚠️ THIS IS WHO YOU ARE RESPONDING TO ⚠️\nEmre is the human player in this roleplay\./.test(P.player)&&/<their_backstory>[\s\S]*Emre is a carpenter\.<\/their_backstory>/.test(P.player)
    &&/<their_appearance>How Emre looks:\nTall, grey eyes\.<\/their_appearance>/.test(P.player)&&/<their_clothes>[\s\S]*a grey sweater<\/their_clothes>/.test(P.player)
    &&!/PLAYER CHARACTER/.test(P.player), P.player.slice(0,600));
  ok("reply to a character: \"another character\", your tie, their looks and clothes, then the player card",
    /Berk is another character, here in the scene with you\./.test(P.char)&&/What Berk is to you, in your own words: my older brother\./.test(P.char)
    &&/How Berk looks:\nblack hair/.test(P.char)&&/a red coat<\/their_clothes>/.test(P.char)
    &&/# PLAYER CHARACTER\nEmre is the human player in this roleplay — in the story with you/.test(P.char)&&/Background: Emre is a carpenter\./.test(P.char)
    &&/Appearance: Tall, grey eyes\./.test(P.char)&&/Wearing right now \(written to Emre[^)]*\): a grey sweater/.test(P.char)&&!/<their_backstory>/.test(P.char), P.char.slice(0,900));
  ok("a named target with no id is a character (the head builder decides), with the player card",
    /Cem is another character/.test(P.gone)&&/# PLAYER CHARACTER/.test(P.gone)&&!/Cem is the human player/.test(P.gone));
  ok("continuing: \"YOU SPOKE LAST\", your own line under CONTINUE STRAIGHT ON, and the carry-on guidance",
    /YOU SPOKE LAST — THIS TURN CARRIES ON/.test(P.cont)&&/Emre's last line is already answered/.test(P.cont)
    &&/THIS WAS YOUR LAST LINE — CONTINUE STRAIGHT ON FROM IT ⚠️\nAyla: "I said what I said\."/.test(P.cont)&&/Pick it up mid-breath/.test(P.cont)
    &&/Nothing new has been said to you: the highlighted line above is your OWN/.test(P.cont)&&!/THIS IS WHO YOU ARE RESPONDING TO/.test(P.cont)&&!/React to the highlighted line/.test(P.cont));
  ok("heat, continuing: \"NOBODY IS WAITING\", Emre has gone quiet", /NOBODY IS WAITING ON AN ANSWER FROM YOU/.test(P.heatCont)&&/Emre has gone quiet\. They have said nothing new/.test(P.heatCont)&&!/YOU SPOKE LAST/.test(P.heatCont));
  ok("the line you answer is quoted under its heading, with the turns since and the reply guidance",
    /# ⚠️ THIS IS THE LINE YOU ARE RESPONDING TO ⚠️\n\nSaid since your last line, oldest first:\nBerk: "Hey\."\n\nAnd the newest, the line you are responding to:\n\nEmre: "So, what now\?"\n\nEverything above this is context\./.test(P.player)
    &&/React to the highlighted line above: that is what Emre just said or did/.test(P.player), (P.player.match(/# ⚠️ THIS IS THE LINE[\s\S]{0,400}/)||[""])[0]);
  ok("guidance aimed at the target: one line, \"It is aimed at Emre\", room for Emre to answer",
    /# RESPONSE GUIDANCE\nWrite one turn, as Ayla, and stop\. It is aimed at Emre\. Move the moment forward — do something, change something, let something land — and leave Emre room to answer\./.test(P.player));
  ok("heat guidance: beat 2 of 5, still going; the last beat says so", /This is beat 2 of 5, in a run that is still going — the next beat/.test(P.heat)
    &&/This is beat 5 of 5, and it is the LAST beat of this run — after it the turn goes back to Emre\./.test(P.last)&&!/still going/.test(P.last));
  ok("the absence guard names who was called", /ABSENCE NOTE: Emre's last line mentions Cem, who is NOT in the room\. Cem cannot see, hear, or answer — do NOT speak, act, narrate, or reply AS Cem/.test(P.absent)&&!/ABSENCE NOTE/.test(P.player));
  ok("the not-yours guard names the speaker and the addressee", /ADDRESSEE NOTE: Berk said that to Emre, not to you\./.test(P.notyours)&&/Do NOT answer it in Emre's place/.test(P.notyours)&&!/ADDRESSEE NOTE/.test(P.player));
  ok("voiced: the spoken-delivery block (and heat's own on heat); a stale voice session gets the reset, voiced or on a text",
    /## SPOKEN DELIVERY — THIS REPLY IS READ ALOUD/.test(P.voiced)&&/## SPOKEN DELIVERY — HEAT OF THE MOMENT, READ ALOUD/.test(P.heatVoiced)&&!/THIS REPLY IS READ ALOUD/.test(P.heatVoiced)
    &&/## FORMAT RESET — THE VOICE SESSION IS OVER/.test(P.markup)&&/## FORMAT RESET/.test(P.markupText)&&!/SPOKEN DELIVERY/.test(P.markupText)&&!/SPOKEN DELIVERY|FORMAT RESET/.test(P.player));
  ok("promises: the heading, what you swore, what was sworn to you and what just ended, each with its list",
    /## PROMISES YOU HAVE GIVEN AND GIVEN TO YOU\n\nWHAT YOU SWORE — you are bound by this\.[^\n]*\n- to Emre — never tell Berk/.test(P.rich)
    &&/WHAT WAS SWORN TO YOU — Ayla was given this word[^\n]*\n- Emre — come back tomorrow/.test(P.rich)&&/JUST ENDED —[^\n]*\n- BROKEN: you — keep the key/.test(P.rich)
    &&!/PROMISES YOU HAVE GIVEN/.test(P.player), (P.rich.match(/## PROMISES[\s\S]{0,700}/)||[""])[0]);
  ok("rumors: what you have heard, then the one that is not yours under its heading with its list; spent says the day",
    /What you have heard: Emre was seen with someone at night/.test(P.rich)&&/# WHAT YOU HAVE HEARD \(NOT YOURS\)\nYou have heard the talk below\.[\s\S]*?\n\n- Berk owes money/.test(P.rich)
    &&/You already put this to Emre on day 1, and they answered\./.test(P.spent)&&!/You already put this/.test(P.rich));
  ok("story threads: one thread, or threads, and you are told the name in them is you",
    /You are named in the current story thread below[\s\S]*Where you read "Ayla", that is you\.[\s\S]*- The missing ledger/.test(P.rich)&&/current story threads below/.test(P.spent));
  ok("what is in front of you right now, with what it is", /THIS IS WHAT IS HAPPENING IN FRONT OF YOU RIGHT NOW ⚠️\nYou are seeing this as it happens\.[^\n]*\nA man drops a glass at the bar\.\nThis is what your turn answers\./.test(P.rich));
  ok("arriving, with the event's why and how (in the head on the spoken paths, in the situation on heat); leaving",
    /# SITUATION\nYou have just walked in\./.test(P.arriving)&&/# WHY & HOW YOU'RE HERE — scene context[\s\S]*What just happened that pulls you in: Berk slammed the door\n\nThe unresolved tension drawing you here: Old debt between them\n\nWhat you have come to do: Demand the money back\n\nHow your arrival is unfolding:\n- The door bangs open\./.test(P.arriving)
    &&/WHY & HOW YOU'RE HERE/.test(P.heatArr)&&/# SITUATION\nYou are leaving the scene right now\./.test(P.leaving)&&!/WHY & HOW|# SITUATION/.test(P.player));
  ok("others present, how you speak and how you play it, and respond as",
    /# OTHERS PRESENT \(within earshot\)\n- Berk\nAddress Emre or any of them by name\./.test(P.player)&&/Short, dry sentences\.\n\nHow you play it: Hold the pause before answering\./.test(P.player)&&/- Respond as Ayla\./.test(P.player));
  ok("a text reply continuing its own message carries on, on the text channel", /YOU SPOKE LAST/.test(P.textCont)&&/THIS WAS YOUR LAST LINE/.test(P.textCont));
  const heads=await pg.evaluate(()=>{
    const bad=[];
    /* v150.67 — the user's own Settings format rules may stack their headings ("# FORMATTING RULES …" then "# STRUCTURE"):
       their text is theirs, so its lines are not judged here */
    const own=new Set((_stripLangSection(up("formatRules")||"")+"\n"+(up("baseInstruction")||"")).split("\n").map(l=>l.trim()).filter(Boolean));
    __cases.forEach(([k,n,o])=>{ const t=__build(k,o,null);
      const L=t.split("\n").filter(l=>l.trim()&&l.trim()!=="(history)"&&!own.has(l.trim()));
      L.forEach((l,i)=>{ const m=l.match(/^(#{1,3}) /); if(!m)return; const nx=L[i+1];
        const nm=nx&&nx.match(/^(#{1,3}) /);
        if(!nx||(nm&&nm[1].length<=m[1].length))bad.push(k+"_"+n+": «"+l.slice(0,70)+"» then «"+String(nx||"(end)").slice(0,50)+"»"); }); });
    return bad; });
  ok("no heading goes out with nothing under it, in any case", heads.length===0, heads.slice(0,8).join("\n        "));

  console.log("\n[a saved list]");
  const M=await pg.evaluate(()=>{
    const old=__oldRaw(); const ed=old.find(f=>f.id==="others"); ed.text=ed.text+"\nNobody else is here.";
    state.fragments=old; store.setRaw(K.fragAdds,"limits,guardrails.consistency"); _fragMigratedFor=null;
    const L=fragList(), ids=L.map(f=>f.id);
    const same=id=>_fragCanon(L.find(f=>f.id===id))===_fragCanon(FRAG_DEFAULTS.find(f=>f.id===id));
    const r={sheetAfter:ids.indexOf("target_sheet")===ids.indexOf("target")+1, target:same("target"), guidance:same("guidance"), last:same("last_line"), memories:same("memories"),
      othersKept:/Nobody else is here\./.test(L.find(f=>f.id==="others").text)&&/\{\{call\/\/others_footer\}\}/.test(L.find(f=>f.id==="others").text),
      untouched:same("task")&&same("guardrails"), done:String(store.raw(K.fragAdds,"")).split(",").indexOf("v150.57.format")>=0,
      saved:/target_sheet/.test(String(store.raw(K.fragments,""))) };
    // once: a second load does not rewrite again, and a user's deleted target_sheet stays deleted
    const L2=L.filter(f=>f.id!=="target_sheet"); state.fragments=L2; _fragMigratedFor=null; fragList();
    r.once=!state.fragments.some(f=>f.id==="target_sheet");
    // an edited "Who you are answering" is left alone and gets no sheet
    const old2=__oldRaw(); old2.find(f=>f.id==="target").text+="\n(mine)"; state.fragments=old2; store.setRaw(K.fragAdds,"limits,guardrails.consistency"); _fragMigratedFor=null;
    // (v150.59: kept as the user wrote it, its path text converted to "adds under the main body" — see fragment-wording)
    const L3=fragList(); r.editedTarget=/\(mine\)/.test(JSON.stringify(L3.find(f=>f.id==="target")))&&!L3.some(f=>f.id==="target_sheet")&&_fragCanon(L3.find(f=>f.id==="guidance"))===_fragCanon(FRAG_DEFAULTS.find(f=>f.id==="guidance"));
    state.fragments=null; _fragMigratedFor=null; store.setRaw(K.fragments,"");
    return r; });
  ok("an untouched old default is replaced by the new one, with \"What you know of them\" inserted after it, and saved",
    M.sheetAfter&&M.target&&M.guidance&&M.last&&M.memories&&M.untouched&&M.done&&M.saved, JSON.stringify(M));
  ok("an edited fragment is the user's and stays as it is", M.othersKept&&M.editedTarget, JSON.stringify(M));
  ok("the rewrite runs once: a sheet deleted afterwards is not put back", M.once, JSON.stringify(M));
  ok("saving from the editor marks the rewrite as done", await pg.evaluate(()=>FRAG_SHIPPED_ADDS.some(a=>a.key==="v150.57.format")));

  // v150.58 — "YOU ALREADY SAID THESE" as a fragment of its own
  console.log("\n[what you already said]");
  const AS=await pg.evaluate(()=>{
    const f=FRAG_DEFAULTS.find(x=>x.id==="already_said"), ids=FRAG_DEFAULTS.map(x=>x.id);
    const plain=__build("solo",{}), cont=__build("solo",{s:["cont"]}), heat=__build("heat",{s:["cont"]});
    const c=__base(null); c.messages=[{mid:"u1",role:"user",content:'"Hi there."'}];
    const p=state.personas[0]; const B=Object.assign({},buildCharPromptBlocks(p,[],{recent:[],diary:[],longterm:[]},null,{chat:c,targetName:"Emre",targetId:"__user__"}),
      buildTailBlocks({chat:c,selfP:p,selfId:p.id,selfName:p.name,targetName:"Emre",targetId:"__user__",injected:{recent:[],diary:[],longterm:[]}}));
    const none=(ptBuildMessages("solo",B,[],{chat:c,npc:p,targetName:"Emre"},()=>B)||[]).map(x=>x.content).join("\n");
    return {f,at:ids.indexOf("already_said")===ids.indexOf("last_line")+1&&ids.indexOf("stuck")===ids.indexOf("already_said")+1,plain,cont,heat,none}; });
  ok("a fragment of its own on every path, between the last line and 'when it goes in circles', with its data as a call",
     AS.f&&AS.f.paths.length===5&&AS.at&&/\{\{call\/\/said_line1_raw\}\}/.test(AS.f.text)&&/YOU ALREADY SAID THIS/.test(AS.f.text), JSON.stringify(AS.f).slice(0,300));   // v150.59 — the lines as data, the labels in the box
  ok("a reply after their own earlier line quotes it under the heading", /YOU ALREADY SAID THIS — DO NOT SAY IT AGAIN[\s\S]*your last line, word for word[\s\S]*Hello\./.test(AS.plain), AS.plain.slice(-1500));
  ok("carrying on: the 'continues' sentence, and the window slides past the newest line", /Your newest line is the one quoted above[\s\S]*the line before the one quoted above[\s\S]*Hello\./.test(AS.cont)&&!/\{\{(if|endif|gap)/.test(AS.cont), AS.cont.slice(-1500));
  ok("on heat too", /YOU ALREADY SAID THIS/.test(AS.heat), "");
  ok("nothing said yet: no heading standing alone", !/YOU ALREADY SAID THIS/.test(AS.none), "");
  ok("(v150.58) an {{endif}} written right before another token is resolved, not left as text", await pg.evaluate(()=>{
      const t="A {{if continuing}}C {{endif}}{{call//x}}"; return (ptResolveConds(t,ptCondFlags({continuing:true}))==="A C {{call//x}}"&&ptResolveConds(t,ptCondFlags({continuing:false}))==="A {{call//x}}")?true:"resolver"; }));
  ok("a saved list gets it once, before 'stuck'", await pg.evaluate(()=>{
      const old=JSON.parse(JSON.stringify(FRAG_DEFAULTS)).filter(f=>f.id!=="already_said"); store.setRaw(K.fragAdds,"limits,guardrails.consistency,v150.57.format"); state.fragments=old; _fragMigratedFor=null;
      const L=fragList(), ids=L.map(f=>f.id), ok1=ids.indexOf("already_said")===ids.indexOf("stuck")-1;
      state.fragments=null; _fragMigratedFor=null; store.setRaw(K.fragments,""); return ok1?true:ids.join(","); }));

  ok("no page errors", errs.length===0?true:errs.join(" | "));
  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close(); process.exit(fail?1:0);
})();
