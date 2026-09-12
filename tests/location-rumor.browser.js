/* v38.9 — YOU DO NOT LEARN FROM GOSSIP THAT YOU WERE THERE.
   When you leave a public place it may start talking, and the circulating line is planted in every
   regular of that place — including, by design, the people the talk is ABOUT. They got the identical
   "People are saying Emre was at Sahil with Berker and Hakan" as something they had heard, about an
   evening they had lived through. The aboutSelf flag had been written since the feature shipped and
   read nowhere, so the wording never changed. Two more things were wrong with the same memory: who
   counts as having been there was decided by who SPOKE, and the `people` field was never set at all.
   Run: node tests/location-rumor.browser.js */
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage({viewport:{width:412,height:915}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file://'+require('path').resolve(__dirname,'..','index.html'));
  await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(800);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x||c).slice(0,700));} };

  /* The engine needs a model, so the network call is stubbed with the JSON it would have returned.
     Everything downstream of that — who is a participant, what each of them ends up remembering — is
     the app's own code, which is the part under test. */
  await pg.evaluate(()=>{
    const uni=state.universes[0];
    const mk=(id,name)=>({id,name,universeId:uni.id,instructions:"x",personality:"x",
      backstory:"x",style:"x",goals:"x",look:{subject:"Man"}});
    ["r_hakan|Hakan","r_berker|Berker","r_regular|Sema"].forEach(t=>{
      const [id,name]=t.split("|");
      if(!state.personas.some(p=>p.id===id)) state.personas.push(mk(id,name));
    });
    state.user="Emre"; state.mem=true; state.key="test-key";
    uni.locations=uni.locations||[];
    let loc=(uni.locations||[]).find(l=>l.id==="loc_sahil");
    if(!loc){ loc={id:"loc_sahil",name:"Sahil",type:"poi",description:"A sea-side tea garden",
      gossipChance:1, sublocations:[{id:"s1",name:"Terrace"}], residents:[]}; uni.locations.push(loc); }
    // everyone who could hear the talk: the two who were there, plus a regular who was not
    loc.residents=["r_hakan","r_berker","r_regular"];
    const chat=curChat();
    chat.gameDay=1; chat.period="Midday"; chat.universeId=uni.id;
    chat.messages=[
      {mid:"tb",role:"assistant",speaker:"Narrator",travelBeat:true,content:"They walk down to the sea.",present:[]},
      {mid:"v1",role:"user",content:"I sat down with them.",present:["r_hakan","r_berker"]},
      // Hakan says nothing all visit — presence, not dialogue, is what makes him a participant
      {mid:"v2",role:"assistant",speaker:"Berker",speakerId:"r_berker",content:"Cayi soyledim.",present:["r_hakan","r_berker"]},
      {mid:"v3",role:"user",content:"Iyi olur.",present:["r_hakan","r_berker"]}
    ];
    state.memory=[];
    window.__gossipJSON=JSON.stringify({
      content:"People are saying Emre was at Sahil with Berker and Hakan, and it seemed like a heavy conversation.",
      location:"Sahil", emotion:"curious", gist:"a heavy conversation", charge:0.8,
      importance_score:0.5, tags:["emre","berker","hakan"]});
    window.__realChat=window.chatCompletion;
    window.chatCompletion=async()=>window.__gossipJSON;
    markChatDirty(chat);
  });

  await pg.evaluate(async()=>{
    const uni=state.universes[0];
    const loc=(uni.locations||[]).find(l=>l.id==="loc_sahil");
    await runLocationGossipLeak(curChat(), loc, "s1");
  });
  await pg.waitForTimeout(300);

  console.log("\n[who was there]");
  ok("the rumour was planted in all three regulars", await pg.evaluate(()=>{
      const owners=(state.memory||[]).filter(m=>m.source==="location_rumor").map(m=>m.ownerId).sort();
      return owners.join(",")==="r_berker,r_hakan,r_regular" ? true : "planted in: "+owners.join(","); }));
  ok("the one who never spoke still counts as having been there", await pg.evaluate(()=>{
      const m=(state.memory||[]).find(x=>x.source==="location_rumor"&&x.ownerId==="r_hakan");
      return m && m.aboutSelf===true ? true : "aboutSelf="+(m&&m.aboutSelf); }));
  ok("and the regular who was not there is not marked as a participant", await pg.evaluate(()=>{
      const m=(state.memory||[]).find(x=>x.source==="location_rumor"&&x.ownerId==="r_regular");
      return m && m.aboutSelf===false ? true : "aboutSelf="+(m&&m.aboutSelf); }));

  console.log("\n[what each of them remembers]");
  ok("the outsider hears the circulating line", await pg.evaluate(()=>{
      const m=(state.memory||[]).find(x=>x.source==="location_rumor"&&x.ownerId==="r_regular");
      return /^People are saying Emre was at Sahil/.test(m.content) ? true : m.content; }));
  ok("a participant is NOT told, as hearsay, that they were there", await pg.evaluate(()=>{
      const bad=(state.memory||[]).filter(x=>x.source==="location_rumor"&&x.aboutSelf)
        .filter(x=>/People are saying/.test(x.content));
      return bad.length===0 ? true : "still hearsay: "+bad.map(x=>x.ownerId).join(","); }));
  ok("they remember the TALK instead, and that they were there", await pg.evaluate(()=>{
      const m=(state.memory||[]).find(x=>x.source==="location_rumor"&&x.ownerId==="r_hakan");
      return (/Word is going round at Sahil/.test(m.content)
           && /a heavy conversation/.test(m.content)
           && /I was there/.test(m.content)) ? true : m.content; }));
  ok("and that wording is an editable prompt, not a string in the code", await pg.evaluate(()=>{
      if(!PROMPT_BY_KEY.x_rumor_about_you) return "not in the registry";
      const t=fillTpl(up("x_rumor_about_you"),{place:"Sahil",gist:"a row"});
      return (t.indexOf("{{")<0 && /Sahil/.test(t) && /a row/.test(t)) ? true : t; }));

  console.log("\n[who the talk is about]");
  ok("every copy records the people involved", await pg.evaluate(()=>{
      const bad=(state.memory||[]).filter(x=>x.source==="location_rumor")
        .filter(x=>!Array.isArray(x.people)||!x.people.length);
      return bad.length===0 ? true : bad.length+" with no people list"; }));
  ok("the player and both companions are named", await pg.evaluate(()=>{
      const m=(state.memory||[]).find(x=>x.source==="location_rumor");
      const p=(m.people||[]).join(",");
      return (/Emre/.test(p)&&/Hakan/.test(p)&&/Berker/.test(p)) ? true : p; }));
  ok("and the Memory screen shows them", await pg.evaluate(()=>{
      memFilterOwner="r_regular"; show('memory'); renderMemory();
      const h=document.getElementById('memoryList').innerHTML;
      return /Emre/.test(h)&&/Berker/.test(h) ? true : "the people row is empty"; }));
  ok("the editor loads them into the field", await pg.evaluate(()=>{
      const m=(state.memory||[]).find(x=>x.source==="location_rumor"&&x.ownerId==="r_regular");
      openMemEditor(m.id);
      const v=document.getElementById('memEditPeople').value;
      closeModal('memEditModal');
      return v.trim()!=="" ? true : "still blank"; }));

  /* The other gossip channel — the end-of-day spread — had the same hole: it excluded the WITNESS
     from the recipients and not the SUBJECT, so a character could be handed, as a suspicion to
     carry, a rumour about themselves. */
  console.log("\n[the end-of-day spread has the same rule]");
  ok("a rumour is never planted in someone it is about", await pg.evaluate(()=>{
      const src=String(runGossipPropagation);
      return /about\.indexOf\(rid\)>=0\)continue/.test(src)
        ? true : "no subject guard in runGossipPropagation"; }));
  ok("and it records who it is about", await pg.evaluate(()=>{
      const src=String(runGossipPropagation);
      return /people:aboutNames/.test(src) ? true : "no people list on a spread rumour"; }));

  await pg.evaluate(()=>{ if(window.__realChat)window.chatCompletion=window.__realChat; });
  ok("no page errors", errs.length===0?true:errs.join(" | "));
  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close(); process.exit(fail?1:0);
})();
