/* v150.24 — THE SECOND BACKEND LIST FROM THE PROMPT ANALYSIS, CHECKED AGAINST THE CODE.
     · a reply that reprinted earlier turns was posted with the copies in it, and one cut by the token
       limit ended mid-word;
     · two tellings of one event filled two memory slots;
     · in a room of three the line you respond to was only the newest, so what came before it was lost;
     · a heading written as text in a layout printed over an empty section;
     · long memories went into the recall block whole;
     · the wearing tracker was not told where and when the scene is.
   Run: node tests/analysis-backend-2.browser.js */
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

  console.log("\n[a reply that copies the transcript, or stops mid-word]");
  const rp=await pg.evaluate(()=>{
    const old="Sami masaya döndü, bardağını aldı ve kimseye bakmadan bir yudum içti. Sonra Emre'ye döndü.";
    const chat={messages:[{role:"assistant",speaker:"Sami",speakerId:"p_s",content:old},{role:"user",content:"Karını kaçırırsam ne yaparsın?"}]};
    const fresh="*Buket kaşlarını kaldırdı.* \"Bunu bir daha söyleme.\"";
    return {
      copied:_dropReprintedTurns(chat,old+"\n\n"+fresh),
      labelled:_dropReprintedTurns(chat,"Sami: "+old+"\n\n"+fresh),
      allCopy:_dropReprintedTurns(chat,old),
      own:_dropReprintedTurns(chat,fresh),
      cut:_trimCutReply("*Buket gülümsedi ve kapıyı biraz daha açtı.* \"Olur, gir bakalım.\" Sonra herkes"),
      whole:_trimCutReply("*Buket gülümsedi.* \"Olur, gel.\""),
      beat:_trimCutReply("\"Olur.\" *kapıyı kapattı*"),
      tooMuch:_trimCutReply("Kısa. Sonra çok uzun bir cümle geldi ve hiç bitmeden token sınırına takıldı, herkes")
    };
  });
  ok("a paragraph that is an earlier turn again is dropped, the new part is kept", rp.copied===rp.own&&/Bunu bir daha/.test(rp.copied), JSON.stringify(rp.copied));
  ok("also with the speaker's name in front of the copy", rp.labelled===rp.own, JSON.stringify(rp.labelled));
  ok("a reply that is nothing but a copy comes back empty (the Retry notice)", rp.allCopy.trim()==="", JSON.stringify(rp.allCopy));
  ok("a reply that copies nothing is untouched", rp.own==="*Buket kaşlarını kaldırdı.* \"Bunu bir daha söyleme.\"", rp.own);
  ok("a reply cut by the token limit ends at its last finished sentence", rp.cut==="*Buket gülümsedi ve kapıyı biraz daha açtı.* \"Olur, gir bakalım.\"", rp.cut);
  ok("a reply that ends on a quote or a beat is left whole", rp.whole==="*Buket gülümsedi.* \"Olur, gel.\""&&rp.beat==="\"Olur.\" *kapıyı kapattı*", JSON.stringify([rp.whole,rp.beat]));
  ok("a cut that would lose most of the reply is not made", /herkes$/.test(rp.tooMuch), rp.tooMuch);

  console.log("\n[the turns since your last line]");
  const ll=await pg.evaluate(()=>{
    const uni=state.universes[0], chat=curChat();
    const mk=(id,name)=>({id,name,universeId:uni.id,instructions:"x",personality:"x",backstory:"x",style:"x",goals:"x",look:{}});
    state.personas=[mk("p_s","Sami"),mk("p_b","Buket")];
    chat.universeId=uni.id; chat.presentIds=["p_s","p_b"]; chat.subPos={}; delete chat._heatBeat;
    chat.messages=[
      {mid:"m1",role:"assistant",speaker:"Sami",speakerId:"p_s",content:"\"Çay taze, alın.\""},
      {mid:"m2",role:"user",content:"\"Karını kaçırırsam ne yaparsın Sami?\""},
      {mid:"m3",role:"assistant",speaker:"Buket",speakerId:"p_b",content:"\"Emre, saçmalama.\""}];
    const sami=state.personas[0];
    const B=buildTailBlocks({chat,selfP:sami,selfId:sami.id,selfName:sami.name,targetName:"Buket",targetId:"p_b",multi:true,injected:{}});
    const pin=buildTailBlocks({chat,selfP:sami,selfId:sami.id,selfName:sami.name,targetName:state.user,targetId:"__user__",multi:true,injected:{},answerTo:"__user__"});
    chat.messages=[{mid:"n1",role:"assistant",speaker:"Sami",speakerId:"p_s",content:"\"Çay taze.\""},{mid:"n2",role:"assistant",speaker:"Buket",speakerId:"p_b",content:"\"Sağ ol.\""}];
    const one=buildTailBlocks({chat,selfP:sami,selfId:sami.id,selfName:sami.name,targetName:"Buket",targetId:"p_b",multi:true,injected:{}});
    return {body:B._ll&&B._ll.last_line_body,pin:pin._ll&&pin._ll.last_line_body,one:one._ll&&one._ll.last_line_body,user:state.user};
  });
  ok("the provocation said to Sami before Buket answered is in his block, with its speaker", ll.body&&ll.body.indexOf(ll.user+": \"Karını kaçırırsam")>=0, ll.body);
  ok("oldest first, ending on the line itself", ll.body&&ll.body.indexOf("Karını")<ll.body.indexOf("Buket: \"Emre, saçmalama.\"")&&/Buket: "Emre, saçmalama\."\s*$/.test(ll.body), ll.body);
  ok("his own earlier line ends the window", ll.body&&ll.body.indexOf("Çay taze")<0, ll.body);
  ok("with one line since, the block is that line alone", ll.one==="Buket: \"Sağ ol.\"", ll.one);
  ok("a turn pinned to the player's line quotes the player's line alone", ll.pin===ll.user+": \"Karını kaçırırsam ne yaparsın Sami?\"", ll.pin);

  console.log("\n[a heading typed into a layout]");
  const hd=await pg.evaluate(()=>{
    const src={full:"FILLED", none:""};
    const ex=t=>ptExpand(t,src,{},{unknownCall:[],unknownVar:[],emptyVar:[]});
    return {
      inPara:ex("# WHAT YOU DECIDED\n● The conclusion you came to.\n{{call//none}}\n# SCENE RIGHT NOW\n{{call//full}}"),
      kept:ex("# WHAT YOU DECIDED\n● The conclusion you came to.\n{{call//full}}\n# SCENE RIGHT NOW\n{{call//full}}"),
      ownPara:ex("# WHAT YOU DECIDED\n\n{{call//none}}\n\n# SCENE RIGHT NOW\n\n{{call//full}}"),
      ownKept:ex("# PLACES\n\n{{call//none}}\n\n{{call//full}}"),
      atEnd:ex("{{call//full}}\n\n# THE STORY SO FAR"),
      prose:ex("# NOTES\nPlain prose that stands on its own.\n\n# NEXT\n{{call//full}}")
    };
  });
  ok("a heading over an empty call, inside a filled paragraph, goes with its prose", !/WHAT YOU DECIDED|conclusion/.test(hd.inPara)&&/# SCENE RIGHT NOW\nFILLED/.test(hd.inPara), hd.inPara);
  ok("the same heading over a filled call stays", /WHAT YOU DECIDED/.test(hd.kept)&&/conclusion/.test(hd.kept), hd.kept);
  ok("a heading in its own paragraph, followed only by another heading, is dropped", !/WHAT YOU DECIDED/.test(hd.ownPara)&&/SCENE RIGHT NOW/.test(hd.ownPara), hd.ownPara);
  ok("a heading whose section fills later, after an empty block, stays", /# PLACES\n\nFILLED/.test(hd.ownKept), hd.ownKept);
  ok("a heading that ends its segment stays (the history comes after it)", /THE STORY SO FAR$/.test(hd.atEnd), hd.atEnd);
  ok("a heading over prose with no calls stays", /# NOTES\nPlain prose/.test(hd.prose), hd.prose);

  console.log("\n[the recall block caps a long memory]");
  const mc=await pg.evaluate(()=>{
    const her=state.personas[0]; const chat=curChat(); chat.gameDay=6;
    const long="I gave Sami his list at the door and told him to check it twice. "+"He read it slowly and asked about every line of it, one after another. ".repeat(20)+"Then he";
    const inj={recent:[{id:"r1",ownerId:her.id,gameDay:5,gamePeriod:"Evening",content:long,importance:0.5}],longterm:[]};
    const r={}; memoryBlocks(inj,"recent",r);
    const stored=long.length;
    return {line:r.mem_recent_entries||"",stored};
  });
  ok("a long stored memory reaches the payload cut at a sentence end", mc.line.length<900&&/\.$/.test(mc.line.trim())&&!/Then he$/.test(mc.line), mc.line.slice(-80));

  console.log("\n[one event told twice fills one slot]");
  const dd=await pg.evaluate(async()=>{
    const uni=state.universes[0], chat=curChat(), her=state.personas[0];
    state.embedOn=false; chat.gameDay=6;
    const base={ownerId:her.id,universeId:uni.id,chatId:chat.id,type:"EXPERIENCE",importance:0.6,emotion:"neutral",location:"Kitchen",people:["Sami"]};
    state.memory=[
      Object.assign({id:"d1",gameDay:5,gamePeriod:"Evening",content:"I handed Sami his own list of the field reports in the kitchen and told him to finish them before the weekend."},base),
      Object.assign({id:"d2",gameDay:6,gamePeriod:"Morning",content:"In the kitchen I handed Sami his own list of the field reports and told him to finish them before the weekend."},base),
      Object.assign({id:"d3",gameDay:4,gamePeriod:"Night",content:"Ayça called late about the petition and I promised to read it before the meeting on Friday."},base)];
    const r=await retrieveMemories("Sami list field reports kitchen",chat,her.id);
    return (r.recent||[]).map(m=>m.id);
  }).catch(e=>["ERR "+e.message]);
  ok("two near-identical tellings of one hand-over: only one is recalled", dd.filter(x=>x==="d1"||x==="d2").length===1&&dd.indexOf("d3")>=0, JSON.stringify(dd));

  console.log("\n[the wearing tracker knows where and when]");
  const ww=await pg.evaluate(()=>{
    const chat=curChat(); const uni=state.universes[0];
    const loc=(uni.locations||[])[0];
    if(loc){ chat.locationId=loc.id; chat.location=loc.name; }
    chat.gameDay=7; chat.period="Afternoon";
    return {s:_wearWhere(chat),loc:loc&&loc.name};
  });
  ok("the place and the day go ahead of what everybody had on", /^WHERE AND WHEN: /.test(ww.s)&&(!ww.loc||ww.s.indexOf(ww.loc)>=0)&&/Day 7/.test(ww.s), JSON.stringify(ww));

  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close(); process.exit(fail?1:0);
})();
