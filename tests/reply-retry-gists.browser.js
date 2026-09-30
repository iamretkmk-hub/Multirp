/* v148.6 — three regressions from a player's real debug log (gemma-4-31b replies, their own payload template):
     1. the repeat retry sent the rejected reply as the model's own turn plus a trailing [system] note; the model
        answered with the note itself ("Do not re-narrate the same body…") and that REPLACED a good reply. The
        retry is now a director's note in the last user message, and its output is checked: meta, empty, refusal
        or off-language output is discarded and the first reply kept (with an echoed stage direction dropped).
        A single recurring prop ("I sip my tea") no longer counts as a narration loop.
     2. YOU ALREADY SAID THESE printed each line cut at 140 characters mid-quote under a "gist" label; the line
        now goes in whole, labelled word for word, and stored copies of the old label are refreshed in place.
     3. the player's relationship paragraph vanished from YOUR PEOPLE when the template did not call
        `feelings` (the v62.1 "stated once, in feelings" drop); the player's entry is always printed whole, and
        the "everyone" scope keeps the author's summary note.
   Each is checked through the player's own template (template mode) AND the default block layout.
   Run: NODE_PATH=/path/to/node_modules node tests/reply-retry-gists.browser.js */
const {chromium}=require('playwright');
const USER_TEMPLATE=`[system]
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

{{call//head_speak}}
{{call//speaking_style//full}}

{{call//head_past}}
{{call//recent_memories//full}}

{{call//head_history}}
[system end]

{{call//dialogue_history}}

[user]
{{call//head_where_now}}
{{call//scene_now//full}}
{{call//situation//full}}
{{call//privacy//full}}

{{call//last_line//full}}

{{call//already_said//full}}

{{call//response_guidance//full}}

{{call//final_guardrails//full}}

{{call//head_respond_as}}
[user end]`;
(async()=>{
  const b=await chromium.launch({executablePath:process.env.SM_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage({viewport:{width:412,height:915}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file://'+require('path').resolve(__dirname,'..','index.html'));
  await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(800);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x===undefined?c:x).slice(0,900));} };

  // The lines from the report (Turkish story). EARLIER is Duygu's line before the reply that tripped the retry.
  const EARLIER='"İyi bari, çocuk mutluysa gerisi kolay." *Çayımdan bir yudum daha alıyorum, gözüm yolda.* "Sen yalnız başının çaresine bakıyorsun demek. Alıştın mı bari sessiz eve, yoksa hâlâ kapıyı açınca bir ses bekliyor musun?"';
  const OLDER='"İdare ediyor işte. Nil büyüyor, Hakan her zamanki gibi." *Bankta hafifçe geriye yaslanıyorum.* "Asran nasıl peki, İstanbul\'a alışabildi mi? Okulu, arkadaşları, o kalabalık… Çocuklar için kolay değil bence."';
  const FIRST='"Yolunda işte. Nil büyüyor, Hakan her zamanki gibi." *Çayımdan bir yudum alıyorum, gözüm yolda.* "Dün iki kez söyledim çamaşırları kaldır diye, kalkmadı yerinden. Ben de bıraktım."';
  const ECHO1='Do not re-narrate the same body. Do not mention the word "yudum" again. Do not mention the phrase "gözüm yolda" again.';
  const ECHO2='Do not narrate the same movement twice. Do not say the same thing twice.\n\nMake your reply one turn, as Duygu Akbaba, and stop.';
  const GOOD='"Yolunda işte." *Bardağı bankın kenarına bırakıp dizlerimi kendime çekiyorum.* "Sen asıl kendini anlat, sessiz ev nasıl gidiyor?"';

  await pg.evaluate(({USER_TEMPLATE,EARLIER,OLDER})=>{
    window.__fetches=[]; window.__sleep=ms=>new Promise(r=>setTimeout(r,ms));
    window.__stub={replies:[]};
    window.fetch=async(url,init)=>{
      const body=JSON.parse(init.body); window.__fetches.push(body);
      const q=__stub.replies; const txt=q.length>1?q.shift():(q[0]||"");
      return new Response(JSON.stringify({choices:[{message:{content:txt},finish_reason:"stop"}]}),{status:200,headers:{'content-type':'application/json'}});
    };
    const real=chatCompletion;
    window.chatCompletion=async(messages,model,opts)=>{
      if(opts&&opts.rp===true) return real(messages,model,opts);
      const dbg=(opts&&opts.dbg)||"";
      if(/^Turn router · player/.test(dbg)) return '{"addressed":"group","responders":[]}';
      return "{}";
    };
    window.__USER_TEMPLATE=USER_TEMPLATE;
    window.__setup=(mode)=>{
      const base=state.universes[0];
      const U=Object.assign(JSON.parse(JSON.stringify(base)),{id:"u1",name:"u1",userName:"Emre",setting:"a lakeside estate",
        locations:[{id:"l_tr",name:"Lakeside Running Trail",description:"trail",residents:[],sublocations:[{id:"s_bench",name:"Shaded Rest Stop with bench"}]}],
        gameData:{},rules:[],trackers:[],prompts:{}});
      state.universes=[U];
      const mk=(id,n,extra)=>Object.assign({id,name:n,universeId:"u1",personality:"x",instructions:"x",backstory:"x",style:"x",goals:"x",look:{},relationships:{}},extra||{});
      state.personas=[
        mk("p_d","Duygu Akbaba",{socialGraph:"Hakan is my husband. Emre is Hakan's old school friend.",
          relationships:{
            "__user__":{tie:"friend",relationship:"PLAYER_PARA — Hakan's school friend who grew into the man everyone at the mill answers to; you trust his steadiness and watch his charm."},
            "p_h":{tie:"husband",relationship:"HAKAN_PARA — you hired him to fix a summer house and he became the one person who never asked you to be anything else."}}}),
        mk("p_h","Hakan Akbaba")];
      Object.assign(state,{key:"k",mem:false,sceneOn:false,gmOn:false,autoRpOn:false,heatOn:false,suggestOn:false,autoSpeak:false,narrMode:false,
        relOn:true,trackOn:false,calOn:false,promiseOn:false,gossipOn:false,intentOn:false,pulseOn:false,roundOn:false,charQuestsOn:false,
        goalPursuitOn:false,textsOn:false,autoImg:false,imgMode:"off",streamReveal:false,fallbackModel:"",storyLang:"tr",travelTime:0,
        relScope:"everyone",narrRetryOn:false});
      state.payloadTplOn=(mode==="template");
      state.payloadTemplates=(mode==="template")?{solo:__USER_TEMPLATE,multi:__USER_TEMPLATE}:{};
      state.chats={c1:{id:"c1",universeId:"u1",castIds:[],presentIds:["p_d"],memCounts:{},tempChars:[],activeEvent:null,gameDay:2,period:"Midday",
        locationId:"l_tr",location:"Lakeside Running Trail",subId:"s_bench",subPos:{p_d:"s_bench"},calendar:[],promises:[],rel:{},
        messages:[
          {mid:newMid(),role:"user",content:'"Ee, anlat bakalım, nasıl gidiyor hayat?"',present:["p_d"]},
          {mid:newMid(),role:"assistant",speaker:"Duygu Akbaba",speakerId:"p_d",content:OLDER,present:["p_d"],toId:"__user__",toName:"Emre"},
          {mid:newMid(),role:"user",content:'"Asran iyi, alıştı sayılır. Seninkiler nasıl?"',present:["p_d"]},
          {mid:newMid(),role:"assistant",speaker:"Duygu Akbaba",speakerId:"p_d",content:EARLIER,present:["p_d"],toId:"__user__",toName:"Emre"}]}};
      state.curUniverse="u1"; state.curChat="c1"; applyUniverseProfile("u1"); state.memory=[];
      // a settled stance toward the player, so the v62.1 drop would fire (the report's situation)
      window.feelingsBlock=(chat,selfId,targetId,targetName)=>({text:"# HOW YOU FEEL TOWARD "+String(targetName||"").toUpperCase()+"\nSETTLED_STANCE warm, careful.",nowText:"",knowsTarget:true,feel:{},feelNow:{}});
      __fetches=[]; __stub.replies=[];
      show('chat'); try{ renderChat(); }catch(e){}
      return state.chats.c1;
    };
    window.__settle=async()=>{ const t=Date.now(); while(Date.now()-t<15000){ await __sleep(50);
      if(!_presentPlaying&&!_presentQueue.length&&!chatBusy(state.chats.c1,"turn")) return true; } return false; };
    window.__turn=async(mode,replies)=>{
      const c=__setup(mode); __stub.replies=replies.slice();
      await sendMessage({chat:c,text:'"Hakan nasıl, Nil nasıl?"'}); await __settle();
      const last=c.messages[c.messages.length-1];
      const rp=__fetches.filter(f=>Array.isArray(f.messages));
      return {posted:String(last&&last.content||""), speaker:last&&last.speaker, sys:!!(last&&last.sysError), n:rp.length,
              first:rp[0]?rp[0].messages:null, retry:rp[1]?rp[1].messages:null};
    };
  },{USER_TEMPLATE,EARLIER,OLDER});

  console.log("\n[1a — what a retry may replace: the two outputs from the log lose, a real turn wins]");
  const u=await pg.evaluate(({FIRST,ECHO1,ECHO2,GOOD})=>({
    e1:retryOutputUsable(ECHO1,FIRST), e2:retryOutputUsable(ECHO2,FIRST), good:retryOutputUsable(GOOD,FIRST),
    empty:retryOutputUsable("",FIRST), stub:retryOutputUsable('"Evet."',FIRST),
    english:retryOutputUsable('"Fine, it is going well." *I put the cup down and look at the path.* "And you, how is the quiet house?"',FIRST),
    enStory:retryOutputUsable('"Fine, it is going well." *I put the cup down and look at the path.* "And you?"','"It is all right." *I sip my tea and watch the road.* "The kids are fine, and so is he."'),
    quotedDont:retryOutputUsable('"Don\'t start with me." *I set the cup down on the bench between us.* "Not today."','"It is all right." *I sip my tea and watch the road.* "The kids are fine, and so is he."')
  }),{FIRST,ECHO1,ECHO2,GOOD});
  ok("the first instruction echo is not a turn", u.e1===false, JSON.stringify(u));
  ok("nor the second (\"Make your reply one turn, as …, and stop\")", u.e2===false, JSON.stringify(u));
  ok("empty and stub answers lose to a real reply", u.empty===false&&u.stub===false, JSON.stringify(u));
  ok("English where the story is Turkish loses", u.english===false, JSON.stringify(u));
  ok("a real Turkish rewrite wins", u.good===true, JSON.stringify(u));
  ok("an English rewrite in an English story wins, and a spoken \"Don't…\" is story, not an instruction", u.enStory===true&&u.quotedDont===true, JSON.stringify(u));

  console.log("\n[1c — the detector: a recurring prop is not a loop, a reproduced stage direction is]");
  const d=await pg.evaluate(({EARLIER,FIRST})=>({
    prop:repeatKind('"İyiler, iyiler. Nil bütün gün havuzda, Hakan da işte." *Çayımdan bir yudum alıyorum.* _Yine aynı soru._',EARLIER),
    loop:repeatKind(FIRST,EARLIER),
    line:repeatKind('"Gec kaldin yine, hep ayni sey oluyor bu."','"Gec kaldin yine, hep ayni sey oluyor bu."')}),{EARLIER,FIRST});
  ok("\"*Çayımdan bir yudum alıyorum.*\" against an earlier tea sip does not trip the retry", d.prop==="", JSON.stringify(d));
  ok("\"…yudum alıyorum, gözüm yolda\" against \"…yudum daha alıyorum, gözüm yolda\" still does", d.loop==="narration", JSON.stringify(d));
  ok("and a repeated spoken line is still a line repeat", d.line==="line", JSON.stringify(d));

  for(const mode of ["template","layout"]){
    console.log(`\n[1 — the repeat retry, ${mode==="template"?"through the player's own template":"through the default block layout"}]`);
    const r1=await pg.evaluate(({mode,FIRST,ECHO1})=>__turn(mode,[FIRST,ECHO1]),{mode,FIRST,ECHO1});
    ok("the first reply tripped the retry (two roleplay calls)", r1.n===2, JSON.stringify({n:r1.n,posted:r1.posted}));
    const rm=r1.retry||[]; const lastM=rm[rm.length-1]||{};
    ok("the retry ends on a USER director's note, not an [assistant] draft plus a trailing [system]",
       lastM.role==="user"&&/\[Director's note — not part of the story/.test(lastM.content||"")
       &&!rm.some(m=>m.role==="assistant"&&String(m.content).trim()===FIRST.trim()), JSON.stringify(rm.slice(-2)).slice(0,600));
    ok("the draft is quoted inside the note, and the note asks for the turn again as the story",
       (lastM.content||"").indexOf("«"+FIRST+"»")>=0&&/write Duygu Akbaba's turn again/.test(lastM.content||"")&&/that draft/.test(lastM.content||""), (lastM.content||"").slice(-700));
    if(mode==="template") ok("in template mode it is folded into the template's own closing [user] block (no two user blocks in a row)",
       rm.length===(r1.first||[]).length&&/RESPOND|Respond|respond/.test(lastM.content||"")===/RESPOND|Respond|respond/.test(((r1.first||[])[r1.first.length-1]||{}).content||""),
       JSON.stringify({retry:rm.length,first:(r1.first||[]).length}));
    else ok("in the layout the note is one new user message after the payload", rm.length===(r1.first||[]).length+1, JSON.stringify({retry:rm.length,first:(r1.first||[]).length}));
    ok("the instruction echo is discarded and the first reply is posted", r1.speaker==="Duygu Akbaba"&&!/Do not/.test(r1.posted)&&/Yolunda işte/.test(r1.posted)&&/çamaşırları/.test(r1.posted), r1.posted);
    ok("with the echoed stage direction taken out (the one fix the app can make)", r1.posted.indexOf("yudum")<0&&r1.posted.indexOf("gözüm yolda")<0, r1.posted);

    const r2=await pg.evaluate(({mode,FIRST,GOOD})=>__turn(mode,[FIRST,GOOD]),{mode,FIRST,GOOD});
    ok("a good rewrite is used", r2.n===2&&r2.posted===GOOD, JSON.stringify(r2.posted));

    const r3=await pg.evaluate(({mode,FIRST,ECHO2})=>__turn(mode,[FIRST,"",ECHO2]),{mode,FIRST,ECHO2});
    ok("an empty retry whose rescue comes back as an echo keeps the first reply", /Yolunda işte/.test(r3.posted)&&!/Make your reply/.test(r3.posted), JSON.stringify(r3));

    const r4=await pg.evaluate(({mode,ECHO2})=>__turn(mode,[ECHO2]),{mode,ECHO2});
    ok("a first answer that is an instruction echo is never posted as a line (a Retry notice instead)", r4.sys===true&&!/Make your reply/.test(r4.posted), JSON.stringify(r4.posted));

    console.log(`\n[2 — YOU ALREADY SAID THESE, ${mode}]`);
    const sent=JSON.stringify(r2.first||[]);
    const E=JSON.stringify(EARLIER).slice(1,-1), O=JSON.stringify(OLDER).slice(1,-1);
    ok("the last line goes in whole — past the old 140-character cut, to its closing quote", sent.indexOf(E)>=0, sent.slice(sent.indexOf("ALREADY SAID"),sent.indexOf("ALREADY SAID")+900));
    ok("and the line before it too", sent.indexOf(O)>=0);
    ok("labelled word for word, not \"in gist\"", /your last line, word for word — said and spent/.test(sent)&&!/in gist/.test(sent), sent.slice(sent.indexOf("ALREADY SAID"),sent.indexOf("ALREADY SAID")+600));

    console.log(`\n[3 — the player's relationship paragraph, ${mode}]`);
    const people=sent.slice(sent.indexOf("PLAYER_PARA")-200,sent.indexOf("PLAYER_PARA")+50);
    ok("the player's entry carries its paragraph from the card's relationships.__user__", /\[Emre — friend\]/.test(sent)&&sent.indexOf("PLAYER_PARA")>=0, people);
    ok("everyone else keeps theirs", sent.indexOf("HAKAN_PARA")>=0);
    ok("the \"everyone\" scope keeps the author's summary note whole", sent.indexOf("Hakan is my husband. Emre is Hakan's old school friend.")>=0, sent.slice(sent.indexOf("ties"),sent.indexOf("ties")+600));
  }

  console.log("\n[3 — only a payload that sends feelings may drop a character target's paragraph]");
  const f=await pg.evaluate(()=>{
    __setup("template");
    const a=_feelingsReachPayload(state.chats.c1,{payloadKind:"solo"});
    state.payloadTemplates={}; const b2=_feelingsReachPayload(state.chats.c1,{payloadKind:"solo"});
    state.payloadTplOn=false; const c=_feelingsReachPayload(state.chats.c1,{payloadKind:"solo"});
    return {a,b:b2,c};
  });
  ok("the player's template (no {{call//feelings}}) does not; the default template and the block layout do", f.a===false&&f.b===true&&f.c===true, JSON.stringify(f));
  const dl=await pg.evaluate(()=>{
    __setup("layout"); const c=state.chats.c1; state.relScope="present";
    const B=buildCharPromptBlocks(state.personas.find(x=>x.id==="p_d"),[],{recent:[],diary:[],longterm:[]},null,{chat:c,targetName:"Emre",targetId:"__user__",payloadKind:"solo"});
    return String(B.relationships||"");
  }).catch(e=>"ERR "+e.message);
  ok("with feelings in the layout the player's paragraph still prints (the \"present\" scope too)", dl.indexOf("PLAYER_PARA")>=0, dl);

  console.log("\n[4 — YOU ALREADY SAID THESE and the repeat check stay inside this scene and this day]");
  const YESTERDAY='*Omuzlarım gevşiyor.* "Tamam, tamam. Sağ ol, yarın akşam sekizde buradayım, söz."';
  for(const mode of ["template","layout"]){
    const n3=await pg.evaluate(async({mode,YESTERDAY})=>{
      const c=__setup(mode); const D=state.personas.find(x=>x.id==="p_d");
      c.messages=[
        {mid:"y0",role:"user",content:'"Yarın gel o zaman."',present:["p_d"]},
        {mid:"y1",role:"assistant",speaker:"Duygu Akbaba",speakerId:"p_d",content:YESTERDAY,present:["p_d"],toId:"__user__",toName:"Emre"},
        {mid:"dm",role:"assistant",speaker:"Narrator",dayMarker:true,dayFrom:1,dayTo:2,content:"— Day 2 —"}];
      const mine=ownRecentLines(c,D,3);
      __stub.replies=[YESTERDAY,'"Günaydın." *Bardağı uzatıyorum.* "Çay?"'];
      await sendMessage({chat:c,text:'"Günaydın, Duygu."'}); await __settle();
      const rp=__fetches.filter(f=>Array.isArray(f.messages));
      return {mine, n:rp.length, sent:JSON.stringify(rp[0]?rp[0].messages:[]), posted:String(c.messages[c.messages.length-1].content||"")};
    },{mode,YESTERDAY});
    ok(`${mode}: yesterday's line is not one of "your last lines" today`, n3.mine.length===0&&(n3.sent.indexOf("ALREADY SAID")<0||n3.sent.slice(n3.sent.indexOf("ALREADY SAID"),n3.sent.indexOf("ALREADY SAID")+1500).indexOf("sekizde")<0), JSON.stringify(n3.mine));
    ok(`${mode}: and a reply that happens to echo it is not sent back for a retry`, n3.n===1, JSON.stringify({n:n3.n,posted:n3.posted}));
  }

  console.log("\n[5 — an arrival: where they stand, what they hear and whom they answer agree]");
  const ar=await pg.evaluate(async()=>{
    const out={};
    out.calls={v1:_callsByName('*Hemen araya giriyor.* "Burak! Gel otur, çay söyleyelim."',"Burak Atan"),
               v2:_callsByName('"Gel otur, Burak."',"Burak Atan"),
               mention:_callsByName('"Burak\'ın hanımı bizi bugün epey eğlendirdi."',"Burak Atan"),
               narr:_callsByName('*Burak\'a bakıyor.* "Otur."',"Burak Atan")};
    // the canteen: Emre and Sami at the tables, Burak at the gate until the event brings him in
    const base=state.universes[0];
    state.universes=[Object.assign(JSON.parse(JSON.stringify(base)),{id:"u2",name:"u2",userName:"Emre",setting:"a steel plant",gameData:{},rules:[],trackers:[],prompts:{},
      locations:[{id:"l_is",name:"Isdemir",description:"plant",residents:[],sublocations:[{id:"s_gate",name:"Main Security Gate"},{id:"s_can",name:"Worker Canteen"}]}]})];
    const mk=(id,n)=>({id,name:n,universeId:"u2",personality:"x",instructions:"x",backstory:"x",style:"x",goals:"x",look:{},relationships:{}});
    state.personas=[mk("p_s","Sami Özüçak"),mk("p_b","Burak Atan")];
    state.payloadTplOn=true; state.payloadTemplates={solo:__USER_TEMPLATE,multi:__USER_TEMPLATE};
    state.chats={c1:{id:"c1",universeId:"u2",castIds:[],presentIds:["p_s"],memCounts:{},tempChars:[],activeEvent:null,gameDay:1,period:"Afternoon",
      locationId:"l_is",location:"Isdemir",subId:"s_can",subPos:{p_s:"s_can"},calendar:[],promises:[],rel:{},messages:[]}};
    state.curUniverse="u2"; state.curChat="c1"; applyUniverseProfile("u2");
    const c=state.chats.c1;
    c.messages.push({mid:"a0",role:"assistant",speaker:"Sami Özüçak",speakerId:"p_s",present:["p_s"],content:'"Çay söyleyelim mi?"',toId:"__user__",toName:"Emre"});
    const ev={kind:"confrontation",accuserId:"p_b",_startMsg:1,resolved:false,participant:{name:"Burak Atan",charId:"p_b",approaching:true}};
    c.activeEvent=ev;
    c.messages.push({mid:"a1",role:"assistant",speaker:"Narrator",narratorEvent:true,sceneBeat:true,present:["p_s"],content:"*Yemekhanenin kapısında Burak Atan beliriyor.*"});
    c.messages.push({mid:"a2",role:"user",present:["p_s"],content:'*Gözlüğümü düzeltip* "Burak! Hayırdır, nöbetten önce mi geldin?"'});
    c.messages.push({mid:"a3",role:"assistant",speaker:"Sami Özüçak",speakerId:"p_s",present:["p_s"],toId:"__user__",toName:"Emre",
      content:'*Hemen araya giriyor.* "Burak! Gel otur, çay söyleyelim. Senin hanım bizi bugün epey eğlendirdi."'});
    // the scene writer brings him in
    window.chatCompletion=(function(prev){ return async(messages,model,opts)=>{
      if(opts&&/^Scene writer/.test(opts.dbg||"")) return JSON.stringify({narration:"*Burak masalara doğru yürüyor.*",bring_in:"Burak Atan",resolved:false});
      return prev(messages,model,opts); }; })(window.chatCompletion);
    state.sceneOn=true;
    let brought=null; try{ brought=await runSceneWriter(c); }catch(e){ out.swErr=String(e&&e.message||e); }
    out.brought=brought&&brought.id; out.sub=c.subPos.p_b; out.playerSub=c.subId;
    __fetches=[]; __stub.replies=['"Selam Emre. Vardiya planına baktım, erken geldim."'];
    await playCharacterTurn(c,state.personas.find(x=>x.id==="p_b"),"arriving");
    const rp=__fetches.filter(f=>Array.isArray(f.messages));
    out.sent=JSON.stringify(rp[0]?rp[0].messages:[]);
    out.toId=(c.messages[c.messages.length-1]||{}).toId;
    // Sami's vocative alone (the player said nothing to Burak): he answers Sami, and no "not yours" note
    const c2={...c};
    const Bu=state.personas.find(x=>x.id==="p_b");
    c.messages=c.messages.filter(m=>m.speakerId!=="p_b");
    c.messages.find(m=>m.mid==="a2").content='"Sami, çayı sen söyle."';   // the player no longer speaks to Burak
    const T=buildTailBlocks({chat:c,selfP:Bu,selfId:"p_b",selfName:"Burak Atan",targetName:"Sami Özüçak",targetId:"p_s",multi:true,injected:{recent:[],diary:[],longterm:[]}});
    out.g2=String(T.response_guidance||""); out.ll2=String(T.last_line||"");
    return out;
  });
  ok("a line that calls someone by name is told apart from one that only mentions them", ar.calls.v1&&ar.calls.v2&&!ar.calls.mention&&!ar.calls.narr, JSON.stringify(ar.calls));
  ok("the event brings the arrival into the player's area, not the gate", ar.brought==="p_b"&&ar.sub===ar.playerSub&&ar.sub==="s_can", JSON.stringify({b:ar.brought,sub:ar.sub,p:ar.playerSub,err:ar.swErr}));
  const S=ar.sent||"";
  ok("so PRIVACY no longer says he cannot hear the room he is answering", S.indexOf("you are at Main Security Gate, apart from everyone else")<0&&/Worker Canteen/.test(S), S.slice(S.indexOf("PRIVACY"),S.indexOf("PRIVACY")+300));
  ok("he answers the player's greeting to him, not Sami's line after it", /THIS IS THE LINE YOU ARE RESPONDING TO[^#]*nöbetten önce mi geldin/.test(S)&&ar.toId==="__user__", S.slice(S.indexOf("RESPONDING TO ⚠️"),S.indexOf("RESPONDING TO ⚠️")+300));
  ok("and is never told a line that calls him by name was not for him", !/ADDRESSEE NOTE/.test(S), S.slice(S.indexOf("ADDRESSEE"),S.indexOf("ADDRESSEE")+200));
  ok("with only Sami's \"Burak! Gel otur\" to answer, he answers Sami and gets no ADDRESSEE NOTE", /Gel otur/.test(ar.ll2)&&!/ADDRESSEE NOTE/.test(ar.g2), ar.g2);

  console.log("\n[2 — a stored copy of the old label is refreshed in place, the player's own edits kept]");
  await pg.evaluate(()=>{
    state.blockTpls=Object.assign({},state.blockTpls||{},{
      already_said_shortened:"MY OWN EDIT ({{which}}, in gist — what it DID, so you do not do it again. Not how it was written) {{line}}",
      already_said_instr:"● These are your OWN last lines in this scene, in gist. MY RULE."});
    store.set(K.blockTpls,state.blockTpls);
  });
  await pg.reload(); await pg.waitForTimeout(2400);
  const rf=await pg.evaluate(()=>({s:blkTpl("already_said_shortened"),i:blkTpl("already_said_instr")}));
  ok("the label is swapped and the edit around it survives", /^MY OWN EDIT \(\{\{which\}\}, word for word — said and spent/.test(rf.s)&&!/in gist/.test(rf.s), rf.s);
  ok("and the block's opening sentence says word for word", /word for word\. MY RULE\./.test(rf.i), rf.i);

  console.log("\n[nothing else moved]");
  ok("no page errors", errs.length===0?true:errs.join(" | "));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close(); process.exit(fail?1:0);
})();
