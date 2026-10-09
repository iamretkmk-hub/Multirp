/* v150.52 — FIXES FROM A LIVE EXPORT (15:52).
   · A stray closing brace in a quest step ({"event":"…"},"note":…) made parseJSON keep only "event".
   · The memory judge's state carried the player's last line twice (the raw text kept its line breaks).
   · The period engines stepped a character who had spent that stretch beside the player (the player had just travelled
     on, so nobody was "present"): one step per holder per run, and not one the player left behind in that stretch.
   · The period reconcile was cut off at a flat token cap with 34 fragments in; its room grows with what goes in.
   · The debug export held 30 entries and 4000 characters of each answer: 120 and 12000, from a log of 200.
   Run: node tests/export-fixes-1552.browser.js */
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:process.env.SM_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage({viewport:{width:412,height:915}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file://'+require('path').resolve(__dirname,'..','index.html')); await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(800);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x===undefined?c:x).slice(0,700));} };

  console.log("\n[parseJSON]");
  const J=await pg.evaluate(()=>[parseJSON('{"event":"Duygu takvime işaretledi."},"note":"She set Thursday.","outcome":"progress"}'),
    parseJSON('{"a":"x}"} and then {not json}'),parseJSON('[{"a":1},{"b":2}]'),parseJSON('{"a":1,"b":{"c":2}}')]);
  ok("a stray closing brace followed by another key is dropped, and the rest is read", JSON.stringify(J[0])==='{"event":"Duygu takvime işaretledi.","note":"She set Thursday.","outcome":"progress"}', JSON.stringify(J[0]));
  ok("ordinary answers read as before", JSON.stringify(J.slice(1))==='[{"a":"x}"},[{"a":1},{"b":2}],{"a":1,"b":{"c":2}}]', JSON.stringify(J.slice(1)));

  console.log("\n[the memory judge's scene]");
  ok("the player's last line, with its line breaks, is in the scene once", await pg.evaluate(()=>{
      const c=curChat(); const keep=c.messages; const u='*Kumun üzerinde duruyoruz.*\n\n"Gidelim, güneş kaçmadan."';
      c.messages=[{mid:"a1",role:"assistant",speaker:"Duygu",content:'"Tamam."'},{mid:"u1",role:"user",content:u}];
      const sc=_memJudgeScene(c,null,u); c.messages=keep; const n=(sc.match(/güneş kaçmadan/g)||[]).length; return n===1?true:sc; }));

  console.log("\n[the period engines]");
  ok("someone the player left behind in that stretch was with them; another stretch, or another day, they were not", await pg.evaluate(()=>{
      const c=curChat(); const keepP=c.presentIds, keepLb=c.leftBehind; c.presentIds=[]; c.leftBehind={_day:c.gameDay||1,p_d:{period:"Midday",locId:null}};
      const r=[_withPlayerIn(c,"p_d","Midday"),_withPlayerIn(c,"p_d","Afternoon"),_withPlayerIn(c,"p_x","Midday")];
      c.leftBehind={_day:(c.gameDay||1)-1,p_d:{period:"Midday"}}; r.push(_withPlayerIn(c,"p_d","Midday"));
      c.presentIds=keepP; c.leftBehind=keepLb; return JSON.stringify(r)==="[true,false,false,false]"?true:JSON.stringify(r); }));
  ok("the quest step skips them and steps each holder once; the goal pursuit skips them", await pg.evaluate(()=>{
      const q=String(runCharQuestPursuit), g=String(runGoalPursuit);
      return (/_stepped\.has\(q\.holderId\)\|\|_withPlayerIn\(chat,q\.holderId/.test(q)&&/_stepped\.add\(q\.holderId\)/.test(q)&&/!_withPlayerIn\(chat,p\.id,nowPer\)/.test(g))?true:"not wired"; }));
  ok("a step with no memory of its own plants the English note, never the narrated event", await pg.evaluate(()=>{
      const q=String(runCharQuestPursuit); return (/if\(j\.note&&!mems\.some/.test(q)&&!/clipAtSentence\(j\.event/.test(q))?true:"still the event"; }));
  ok("the reconcile's room grows with the fragments (34 → over 4000 tokens, capped at 6000)", await pg.evaluate(()=>/max:Math\.min\(6000,Math\.max\(fnTok\("mem",700\),300\+110\*(?:frag|input)\.length\)\)/.test(String(reconcilePeriodFor))?true:"flat cap"));

  console.log("\n[a confrontation about someone else]");
  ok("its memory says where they went and what the player did, not 'I confronted', and stays moderate", await pg.evaluate(()=>{
      const uni=state.universes[0]; const keep=state.personas; state.personas=[{id:"p_be",name:"Berker",universeId:uni.id,look:{}}]; const c=curChat();
      recordConfrontationAftermath(c,{kind:"confrontation",accuserId:"p_be",conviction:0.95,c2c:true,gist:"Sami — my resentment, wanting to make Sami sit down with us",_outcome:"rupture"});
      const m=(state.memory||[]).filter(x=>x.ownerId==="p_be").pop()||{}; state.personas=keep;
      return (/^I went to .+ about Sami — my resentment, wanting to make Sami sit down with us\. They would not stand with me on it\.$/.test(m.content)&&m.importance<=0.65&&m.emotion==="concerned")?true:JSON.stringify(m); }));
  ok("it opens below near-certainty, and the aim is cut at a sentence, never mid-word", await pg.evaluate(()=>{ const f=String(surfaceIntent);
      return (/conviction:Math\.max\(0\.5,Math\.min\(0\.75,it\.strength\)\),\s*accuserNature:actorNature, c2c:true/.test(f)&&/clipAtSentence\(_aim,180\)/.test(f)&&!/briefDesc\(_aim,120\)/.test(f))?true:"not wired"; }));
  ok("the world pulse drops a companion already booked for that day and part of the day", await pg.evaluate(()=>/sameName\(n,comp\.name\)[\s\S]{0,20}if\(busy\)comp=null/.test(String(runGoalPursuit))?true:"not wired"));

  console.log("\n[the debug export]");
  // v150.64 — every entry in the log (up to its 200 cap), not the last 120 (tests/debug-reasoning.browser.js exports one)
  ok("every entry of a log of 200, answers up to 12000 characters", await pg.evaluate(()=>{ const f=String(exportDebug);
      return (/function exportDebug\(limit=DBG_MAX\)/.test(f)&&/slice\(0,12000\)/.test(f)&&DBG_MAX===200)?true:"sizes"; }));

  ok("no page errors", errs.length===0?true:errs.join(" | "));
  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close(); process.exit(fail?1:0);
})();
