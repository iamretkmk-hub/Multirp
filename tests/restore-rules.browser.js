/* v125.2 — PUT THE BUILT-IN SCENE TYPES BACK.
   Reported: "I have deleted all image scene types, re-install them." Deleting a rule was permanent
   and there was no way back short of a data reset. Settings › Image now has "Restore built-in scene
   types" (and Video "Restore built-in positions"): every shipped rule that is missing comes back in
   its shipped place, and what is there — edited or your own — is left alone.
   Run: node tests/restore-rules.browser.js */
const {chromium}=require('playwright');
const path=require('path');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage({viewport:{width:412,height:915}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file://'+path.resolve(__dirname,'..','index.html')); await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(800);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x||c).slice(0,500));} };

  console.log("\n[everything deleted]");
  ok("an empty list points at the restore button, which sits right under it", await pg.evaluate(()=>{
      state.imgRules=[]; store.set(K.imgRules,[]); show('settings');
      document.querySelectorAll('#screen-settings details.sgroup').forEach(d=>d.open=true);
      renderRules('img');
      const near=document.getElementById('imgRuleList').parentElement;
      const btn=[...near.querySelectorAll('button')].find(b=>/Restore built-in scene types/.test(b.textContent));
      const said=/Restore built-in scene types/.test(document.getElementById('imgRuleList').textContent);
      return btn&&said ? true : "button="+!!btn+" hint="+said; }));
  ok("pressing it brings back every shipped scene type, in the shipped order", await pg.evaluate(()=>{
      [...document.getElementById('imgRuleList').parentElement.querySelectorAll('button')].find(b=>/Restore built-in/.test(b.textContent)).click();
      const got=state.imgRules.map(r=>r.id).join(","), want=DEFAULT_IMG_RULES.map(r=>r.id).join(",");
      return got===want ? true : got+"  vs  "+want; }));
  ok("they are saved at once, without pressing Save settings", await pg.evaluate(()=>
      (store.get(K.imgRules,[])||[]).length===DEFAULT_IMG_RULES.length));
  ok("and the list shows them", await pg.evaluate(()=>
      document.querySelectorAll('#imgRuleList .ruleName').length===DEFAULT_IMG_RULES.length
        ? true : document.querySelectorAll('#imgRuleList .ruleName').length+" rows"));
  ok("a restored rule is a copy, not the shipped object itself", await pg.evaluate(()=>
      state.imgRules[0]!==DEFAULT_IMG_RULES[0]));

  console.log("\n[some deleted, some edited, one of your own]");
  ok("only the missing ones come back; edits and your own rules are kept", await pg.evaluate(()=>{
      const keep=DEFAULT_IMG_RULES.slice(2).map(r=>JSON.parse(JSON.stringify(r)));
      keep[0].promptStyle="MY EDITED STYLE";
      keep.push({id:"r_mine",label:"My own",when:"x",cast:"solo",promptStyle:"mine",enabled:true});
      state.imgRules=keep;
      const n=restoreDefaultRules('img');
      const ids=state.imgRules.map(r=>r.id);
      const edited=state.imgRules.find(r=>r.id===DEFAULT_IMG_RULES[2].id);
      if(n!==2)return "restored "+n;
      if(ids.slice(0,DEFAULT_IMG_RULES.length).join(",")!==DEFAULT_IMG_RULES.map(r=>r.id).join(","))return "order "+ids.join(",");
      if(ids[ids.length-1]!=="r_mine")return "own rule not kept at the end";
      return edited.promptStyle==="MY EDITED STYLE" ? true : "the edit was overwritten"; }));
  ok("with nothing missing it changes nothing", await pg.evaluate(()=>{
      const before=JSON.stringify(state.imgRules); const n=restoreDefaultRules('img');
      return n===0 && JSON.stringify(state.imgRules)===before ? true : "n="+n; }));

  console.log("\n[video positions too]");
  ok("the same restore exists for video positions", await pg.evaluate(()=>{
      state.vidRules=[]; const n=restoreDefaultRules('vid');
      return n===DEFAULT_VID_RULES.length && state.vidRules.length===DEFAULT_VID_RULES.length ? true : n; }));

  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close(); process.exit(fail?1:0);
})();
