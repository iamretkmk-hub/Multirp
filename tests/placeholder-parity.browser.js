/* v37.9 — step 1 of moving the payload's prose into the template.
   A token has to mean the same thing wherever the text that uses it lives. It did not: the
   builders filled {{char}}/{{self}}/{{user}}/{{target}} from one map, the template engine from
   another, and {{self}} was only in the first. So the moment a fragment's wording moved into a
   template — the whole direction this editor is going — {{self}} stopped resolving and reached
   the model empty. A known token that resolves to nothing is now reported, because a sentence
   with a hole in it still reads like a sentence: "You are . Write 's next turn in this scene." */
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x||c).slice(0,400));} };
  const pg=await (await b.newContext()).newPage();
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file:///home/user/Multirp/index.html'); await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(900);
  await pg.evaluate(()=>{
    const uni=state.universes[0];
    if(!state.personas.some(p=>p.id==="p_z"))
      state.personas.push({id:"p_z",name:"Ayse",universeId:uni.id,instructions:"x",personality:"x",
        backstory:"x",style:"x",goals:"x",look:{}});
    state.user="Kemal";
    const chat=curChat(); chat.presentIds=["p_z"]; chat.messages=[];
  });

  console.log("\n[one map, both sides]");
  ok("the builders and the template engine read the same function", await pg.evaluate(()=>
      /replyNamePh/.test(String(_replyPh)) && /replyNamePh/.test(String(ptVars))));
  ok("every name the builders fill, a template can fill too", await pg.evaluate(()=>{
      const p=(state.personas||[]).find(x=>x.id==="p_z");
      const built=replyNamePh(p,"Emre");
      const tpl=ptVars({chat:curChat(),npc:p,targetName:"Emre"});
      const bad=Object.keys(built).filter(k=>tpl[k]!==built[k]);
      return bad.length===0 ? true : "disagree on: "+bad.map(k=>k+" ("+built[k]+" vs "+tpl[k]+")").join(", "); }));
  ok("{{self}} resolves, not just {{char}}", await pg.evaluate(()=>{
      const p=(state.personas||[]).find(x=>x.id==="p_z");
      const v=ptVars({chat:curChat(),npc:p,targetName:"Emre"});
      return (v.self==="Ayse"&&v.char==="Ayse") ? true : "self="+v.self+" char="+v.char; }));
  ok("the editor lists it, so it is discoverable", await pg.evaluate(()=>
      PT_VALUES.some(v=>v.name==="self")));
  ok("a fragment's own spelling works verbatim in a template", await pg.evaluate(()=>{
      // rail_voice is shipped wording that uses {{self}} — paste it in a template and it must fill
      const p=(state.personas||[]).find(x=>x.id==="p_z");
      const src=BLOCK_TPL_DEFAULTS.rail_voice||"{{self}} speaks.";
      const rep={unknownCall:[],unknownVar:[],emptyVar:[]};
      const out=ptExpand(src,{},ptVars({chat:curChat(),npc:p,targetName:"Emre"}),rep);
      return (out.indexOf("{{self}}")<0 && out.indexOf("Ayse")>=0)
        ? true : out.slice(0,160); }));

  console.log("\n[a name that resolves to nothing is reported]");
  ok("a known token with no value is flagged", await pg.evaluate(()=>{
      const rep={unknownCall:[],unknownVar:[],emptyVar:[]};
      ptExpand("You are {{char}}. Write {{char}}'s next turn.",{},ptVars({}),rep);
      return rep.emptyVar.indexOf("char")>=0 ? true : JSON.stringify(rep); }));
  ok("and it is separated from a name that does not exist", await pg.evaluate(()=>{
      const rep={unknownCall:[],unknownVar:[],emptyVar:[]};
      ptExpand("{{char}} and {{nonsense}}",{},ptVars({}),rep);
      return (rep.emptyVar.indexOf("char")>=0 && rep.unknownVar.indexOf("nonsense")>=0
              && rep.emptyVar.indexOf("nonsense")<0) ? true : JSON.stringify(rep); }));
  ok("a filled name is not flagged", await pg.evaluate(()=>{
      const p=(state.personas||[]).find(x=>x.id==="p_z");
      const rep={unknownCall:[],unknownVar:[],emptyVar:[]};
      ptExpand("You are {{char}}.",{},ptVars({chat:curChat(),npc:p,targetName:"Emre"}),rep);
      return rep.emptyVar.length===0 ? true : JSON.stringify(rep.emptyVar); }));
  ok("only NAME tokens are held to this — an empty location is normal", await pg.evaluate(()=>{
      const rep={unknownCall:[],unknownVar:[],emptyVar:[]};
      ptExpand("At {{location}}.",{},ptVars({chat:{}}),rep);
      return rep.emptyVar.indexOf("location")<0 ? true : "location was flagged"; }));
  ok("both the reply and the engine reporter carry the field", await pg.evaluate(()=>
      /emptyVar/.test(String(ptBuildMessages)) && /emptyVar/.test(String(epMessages))));

  console.log("\n[nothing about the live payload changed]");
  ok("the default template is still byte-identical to the classic build", await pg.evaluate(()=>{
      // the parity suite proves this properly; this is the guard that step 1 stayed invisible
      return typeof ptDefaultTemplate==="function" && !/PT_INLINE_HEAD/.test(String(ptDefaultTemplate)); }));
  ok("no page errors", errs.length===0?true:errs.join(" | "));
  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close(); process.exit(fail?1:0);
})();
