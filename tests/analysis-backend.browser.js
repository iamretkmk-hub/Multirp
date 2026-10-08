/* v150.23 — FIXES THE PROMPT ANALYSIS POINTED AT, CHECKED AGAINST THE CODE.
   The prompt editor's analysis lists causes it cannot fix with wording. Each was checked here before it
   was changed:
     · two memory blocks each counted from 1, so one payload carried "Memory 1" twice;
     · generated memories were cut at a bare character count, mid-word ("…I could bid f");
     · two private wants were joined with a space inside one field;
     · someone at the place whose area was never recorded was put in the player's room;
     · the host/guest line ("their kitchen, their kettle") reached the middle of a sex scene;
     · a text reply's own lines all opened "(text message) …", and the model copied the label.
   Run: node tests/analysis-backend.browser.js */
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

  console.log("\n[memory labels are unique across the two blocks]");
  const ml=await pg.evaluate(()=>{
    const uni=state.universes[0];
    const her={id:"p_o",name:"Ozlem",universeId:uni.id,instructions:"x",personality:"x",backstory:"x",style:"x",goals:"x",look:{}};
    state.personas=[her]; state.mem=true;
    const chat=curChat(); chat.gameDay=6;
    const mk=(id,d,txt,type)=>({id,ownerId:her.id,gameDay:d,gamePeriod:"Night",content:txt,location:"",importance:0.5,type});
    const inj={recent:[mk("a",2,"Recent one.")],longterm:[mk("b",1,"Old one.","LONGTERM")]};
    const r={}, l={};
    const wr=memoryBlocks(inj,"recent",r).join("\n"), wl=memoryBlocks(inj,"longterm",l).join("\n");
    return {r:r.mem_recent_entries,l:l.mem_distant_entries,wr,wl};
  });
  /* v150.70 — the entries a reply sends carry no number at all (one line each: "[when | importance] what happened."), so no two
     can share a label; the worded blocks the proactive texter and the call still read keep their unique numbering. */
  ok("the reply's entries carry no label to collide: each opens with its own when and importance", /^\[four days ago \| 3\] Recent one\.$/.test(ml.r)&&/^\[five days ago \| 3\] Old one\.$/.test(ml.l)&&!/Memory \d/.test(ml.r+ml.l), JSON.stringify(ml));
  ok("the worded blocks: recent memories are 'Memory N', the older tier 'Earlier memory N'", /\nMemory 1: /.test(ml.wr)&&/\nEarlier memory 1: /.test(ml.wl)&&!/\nMemory 1/.test(ml.wl), JSON.stringify({wr:ml.wr.slice(-120),wl:ml.wl.slice(-120)}));

  console.log("\n[a generated memory is never cut mid-word]");
  const cl=await pg.evaluate(()=>{
    const long="I went to the market. "+"She asked about the joinery and I told her the old way of doing it. ".repeat(14)+"Then I could bid for the contract";
    return {short:clipAtSentence("Short and sweet.",600),sent:clipAtSentence(long,600),word:clipAtSentence("word ".repeat(200),300),
      quote:clipAtSentence('She said "go." Then more words follow here and keep on going past the limit',20)};
  });
  ok("text under the limit is kept as it is", cl.short==="Short and sweet.", cl.short);
  ok("text over the limit ends at the last whole sentence that fits", cl.sent.length<=600&&/\.$/.test(cl.sent)&&!/bid f/.test(cl.sent), cl.sent.slice(-80));
  ok("with no sentence end inside the limit, it ends at a whole word with an ellipsis", /word…$/.test(cl.word)&&cl.word.length<=301, cl.word.slice(-30));
  ok("a closing quote stays with its sentence", cl.quote==='She said "go."', cl.quote);
  const pm=await pg.evaluate(()=>{
    const uni=state.universes[0], chat=curChat(), p=state.personas[0];
    const txt="I spent the afternoon at the hamam with him. "+"He told me about the debts and I listened without saying much. ".repeat(16)+"If he tells me it was";
    const before=(state.memory||[]).length;
    const rec=_plantWorldMemory(chat,uni,p,{content:txt,emotion:"calm",importance:0.6},6,"Hamam",[],"Afternoon");
    const m=rec||(state.memory||[])[(state.memory||[]).length-1];
    return {len:String(m&&m.content||"").length,end:String(m&&m.content||"").slice(-40),added:(state.memory||[]).length-before};
  });
  ok("the world pulse stores a long memory whole up to its last full sentence", pm.added>=1&&/\.$/.test(pm.end)&&!/it was$/.test(pm.end)&&pm.len<=900, JSON.stringify(pm));

  console.log("\n[two private wants are two lines]");
  const qw=await pg.evaluate(()=>{
    const uni=state.universes[0], chat=curChat(), me=state.personas[0];
    state.intentOn=true; state.intentPerChar=3;
    chat.intents=[{id:"i1",holderId:me.id,targetId:"p_x",targetName:"Someone",status:"brewing",aim:"get the shifts approved",kind:"ambition",valence:"warm",prio:"high"},
                  {id:"i2",holderId:me.id,targetId:"p_y",targetName:"Another",status:"brewing",aim:"keep the petition quiet",kind:"secrecy",valence:"self_serving",prio:"high"}];
    const r=intentParts(chat,me.id,"__user__",state.user);
    return r.quietWant;
  });
  ok("each want is on its own line, not run into the one before", qw.split("\n").length===2&&/shifts approved/.test(qw)&&/petition quiet/.test(qw), qw);

  console.log("\n[who is in the room]");
  const ear=await pg.evaluate(()=>{
    const chat=curChat(), uni=state.universes[0];
    const loc={id:"L_T",name:"Test House",type:"home",residents:[],sublocations:[{id:"S_E",name:"Entrance"},{id:"S_L",name:"Living Room"},{id:"S_B",name:"Bedroom"}]};
    (uni.locations=uni.locations||[]).push(loc);
    const mk=(id,name)=>({id,name,universeId:uni.id,instructions:"x",personality:"x",backstory:"x",style:"x",goals:"x",look:{}});
    state.personas=[mk("p_a","Alya"),mk("p_q","Quiet"),mk("p_t","Talker")];
    chat.universeId=uni.id; chat.locationId="L_T"; chat.location="Test House"; chat.presentIds=["p_a","p_q","p_t"];
    chat.subId="S_B"; chat.subPos={p_a:"S_B"};
    chat.messages=[{role:"user",content:"Merhaba"},{role:"assistant",speaker:"Talker",speakerId:"p_t",content:"Selam."}];
    const s=earshotSplit(chat,"p_a");
    return {here:s.here,apart:s.apart};
  });
  ok("someone whose area was never recorded and who is not taking part is not put in the player's room", ear.apart.indexOf("p_q")>=0&&ear.here.indexOf("p_q")<0, JSON.stringify(ear));
  ok("someone taking part (spoke in the last lines) still counts as here", ear.here.indexOf("p_t")>=0, JSON.stringify(ear));

  console.log("\n[no host/guest framing in the middle of sex]");
  const hg=await pg.evaluate(()=>{
    const chat=curChat(), uni=state.universes[0];
    const loc=uni.locations.find(l=>l.id==="L_T"); loc.residents=["p_t"];
    const me=state.personas.find(p=>p.id==="p_a");
    const run=()=>{ const B=buildTailBlocks({chat,selfP:me,selfId:me.id,selfName:me.name,targetName:state.user,targetId:"__user__",multi:false,injected:{}}); return JSON.stringify(B); };
    delete chat._heatBeat; const normal=run();
    chat._heatBeat={total:"3",n:"1",narrN:"1"}; const heat=run(); delete chat._heatBeat;
    return {normal:/GUEST/.test(normal)||/Talker's home/.test(normal),heat:/GUEST/.test(heat)||/Talker's home/.test(heat)};
  });
  ok("a visit to someone's home is framed as a visit", hg.normal===true, JSON.stringify(hg));
  ok("but not during a heat beat", hg.heat===false, JSON.stringify(hg));

  console.log("\n[the text channel label]");
  const tl=await pg.evaluate(()=>{
    const chat=curChat(), me=state.personas.find(p=>p.id==="p_a");
    chat.presentIds=[]; chat.messages=[{role:"user",content:"Uyudun mu?",textMsg:true,textWith:"p_a"},{role:"assistant",speaker:"Alya",speakerId:"p_a",content:"Yok, uyumadım.",textMsg:true,textWith:"p_a"}];
    const own=(castHistory(chat,me,{textReply:true})||[]).find(m=>m.role==="assistant");
    const scene=(castHistory(chat,me)||[]).find(m=>m.role==="assistant");
    return {own:own&&own.content,scene:scene&&scene.content,strip:[stripChannelLabel("Merhaba (sent as a text)"),stripChannelLabel("(text message) Merhaba"),stripChannelLabel("Merhaba")]};
  });
  ok("in a text reply the character's own texts carry the label at the end", tl.own==="Yok, uyumadım. (sent as a text)", JSON.stringify(tl));
  ok("elsewhere the label still opens a text", tl.scene==="(text message) Yok, uyumadım.", JSON.stringify(tl));
  ok("a reply that copies the label, at either end, is stripped of it", tl.strip.every(x=>x==="Merhaba"), JSON.stringify(tl.strip));

  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close(); process.exit(fail?1:0);
})();
