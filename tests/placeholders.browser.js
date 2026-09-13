const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage({viewport:{width:412,height:915}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file:///home/user/Multirp/index.html'); await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(900);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x||c).slice(0,300));} };

  await pg.evaluate(()=>{
    const uni=state.universes[0];
    if(!state.personas.some(p=>p.id==="p_ph"))
      state.personas.push({id:"p_ph",name:"Hakan Akbaba",universeId:uni.id,instructions:"x",
        personality:"x",backstory:"x",style:"x",goals:"x",look:{}});
    const chat=curChat(); chat.presentIds=["p_ph"]; state.user="Kemal";
  });
  const taskOf = (txt)=>pg.evaluate(t=>{
    const p=state.personas.find(x=>x.id==="p_ph"); const chat=curChat();
    const was=state.baseInstruction; state.baseInstruction=t;
    let out="";
    try{ out=String(buildCharPromptBlocks(p,[],{recent:[],diary:[],longterm:[]},state.user,
          {chat,targetName:state.user,targetId:"__user__"}).task||""); }
    finally{ state.baseInstruction=was; }
    return out;
  },txt);

  console.log("\n[the base instruction now fills its placeholders]");
  ok("{{char}} becomes the character's name",
     (await taskOf("You are {{char}}. Stay {{char}}.")).indexOf("You are Hakan Akbaba. Stay Hakan Akbaba.")>-1);
  ok("{{self}} is the same name",
     (await taskOf("Be {{self}}.")).indexOf("Be Hakan Akbaba.")>-1);
  ok("{{user}} becomes the player's name",
     (await taskOf("Answer {{user}}.")).indexOf("Answer Kemal.")>-1);
  ok("{{target}} resolves too",
     (await taskOf("Toward {{target}}.")).indexOf("Toward Kemal.")>-1);
  ok("the built-in task line still fills",
     (await taskOf("")).indexOf("You are Hakan Akbaba.")>-1);
  ok("an unsupported token is still passed through, not blanked",
     (await taskOf("You are {{npc.name}}.")).indexOf("{{npc.name}}")>-1);

  console.log("\n[the format rules fill too]");
  ok("{{char}} in formatRules", await pg.evaluate(()=>{
      const p=state.personas.find(x=>x.id==="p_ph"); const chat=curChat();
      const was=state.formatRules; state.formatRules="Write as {{char}} for {{user}}.";
      let out="";
      try{ out=String(buildCharPromptBlocks(p,[],{recent:[],diary:[],longterm:[]},state.user,
            {chat,targetName:state.user,targetId:"__user__"}).format||""); }
      finally{ state.formatRules=was; }
      return out.indexOf("Write as Hakan Akbaba for Kemal.")>-1; }));

  console.log("\n[the editor says so before you find out the hard way]");
  ok("a dotted token is reported (fillTpl cannot even see it)", await pg.evaluate(()=>
      _phUnknown("You are {{npc.name}} now.",["char","user"]).join()==="npc.name"));
  ok("spaces inside the braces are tolerated", await pg.evaluate(()=>
      _phUnknown("{{ npc.name }}",["char"]).join()==="npc.name"));
  ok("a supported token is not reported", await pg.evaluate(()=>
      _phUnknown("You are {{char}}.",["char","user"]).length===0));
  ok("the warning names the token and what IS supported", await pg.evaluate(()=>{
      const h=_phWarnHtml("You are {{npc.name}}.",["char","user"]);
      return h.indexOf("npc.name")>-1 && h.indexOf("{{char}}")>-1 && h.indexOf("literal text")>-1; }));
  ok("no warning when everything resolves", await pg.evaluate(()=>
      _phWarnHtml("You are {{char}}.",["char"])===""));
  ok("a prompt that fills nothing says so", await pg.evaluate(()=>
      _phWarnHtml("{{char}}",[]).indexOf("takes no placeholders at all")>-1));

  console.log("\n[the picker lists what the box really supports]");
  ok("baseInstruction offers char/self/user/target", await pg.evaluate(()=>{
      const t=promptPlaceholders("baseInstruction");
      return ["char","self","user","target"].every(x=>t.indexOf(x)>-1); }));
  ok("formatRules offers them too", await pg.evaluate(()=>{
      const t=promptPlaceholders("formatRules");
      return ["char","self","user","target"].every(x=>t.indexOf(x)>-1); }));
  ok("the delivery fragments declare the cast they are handed", await pg.evaluate(()=>{
      const t=tplPlaceholders("heat_delivery");
      return ["user","self","target"].every(x=>t.indexOf(x)>-1); }));

  console.log("\n[it shows up in the real editor]");
  ok("the warning renders under the base-instruction box", await pg.evaluate(async()=>{
      state.baseInstruction="You are {{npc.name}}.";
      show('settings'); renderPayloadList();
      // the block bodies only exist once a payload accordion is opened
      Object.keys(PAYLOAD_DEFS).forEach(k=>{ try{ renderPayloadEditor(k); }catch(e){} });
      const ta=[...document.querySelectorAll('textarea[data-pkey="baseInstruction"]')][0];
      if(!ta) return "no textarea rendered";
      const host=ta.nextElementSibling;
      const has=!!(host&&host.classList.contains("plqWarnHost")&&host.innerHTML.indexOf("npc.name")>-1);
      state.baseInstruction=DEFAULT_BASE_INSTRUCTION;
      return has; }));
  ok("and clears the moment it is corrected", await pg.evaluate(()=>{
      const ta=[...document.querySelectorAll('textarea[data-pkey="baseInstruction"]')][0];
      if(!ta) return "no textarea";
      ta.value="You are {{npc.name}}."; plqInput(ta);
      const dirty=ta.nextElementSibling.innerHTML.indexOf("npc.name")>-1;
      ta.value="You are {{char}}."; plqInput(ta);
      const clean=ta.nextElementSibling.innerHTML==="";
      ta.value=DEFAULT_BASE_INSTRUCTION; plqInput(ta);
      return dirty && clean; }));

  /* v41.2 — A CONVERTED BOX'S OWN GRAMMAR IS NOT A FAILED PLACEHOLDER. FINAL GUARDRAILS opened
     with a red warning saying its seven {{if}} conditions and the {{call}} inside its {{comment}}
     "reach the model as literal text", and offering {{comment}}, {{endcomment}} and {{endif}} as
     placeholders you could insert. Every one of those is read and removed by ptRenderBox before
     anything is sent. The scanner has to know the difference — without silencing the real warning
     for an ORDINARY fragment, which never sees ptRenderBox at all. */
  console.log("\n[box grammar vs. a failed placeholder]");
  await pg.evaluate(()=>{ show('settings'); try{renderPayloadList();renderPayloadTemplates();}catch(e){} });
  ok("a converted block's box opens with no warning", await pg.evaluate(()=>{
      ptEditPiece("final_guardrails");
      const ta=document.querySelector('textarea[data-btpl="rails_header"]');
      const atRender=ta?ta.nextElementSibling.innerHTML:"(box did not open)";
      if(ta) _phWarnPaint(ta);                       // the path that fires as you type
      const live=ta?ta.nextElementSibling.innerHTML:"(box did not open)";
      ptEditPiece("final_guardrails");
      if(atRender!=="") return "on open: "+atRender.replace(/<[^>]+>/g,"").slice(0,200);
      if(live!=="") return "on edit: "+live.replace(/<[^>]+>/g,"").slice(0,200);
      return true; }));
  ok("and offers only real placeholders, not {{comment}} or {{endif}}", await pg.evaluate(()=>{
      const f=tplPlaceholders("rails_header");
      const junk=f.filter(t=>/^(if\s|else$|endif$|comment$|endcomment$)/i.test(t));
      return junk.length?("still offered: "+junk.join(", ")):(f.indexOf("narr_short")>=0?true:"lost narr_short"); }));
  /* (!) The exemption is for boxes ONLY. An ordinary fragment is filled by fillTpl and never
     rendered by ptRenderBox, so an {{if}} written into one really does ship as literal text. */
  ok("the same text in an ordinary fragment is still flagged", await pg.evaluate(()=>
      /render_mode/.test(_phWarnHtml("Say {{if render_mode = heat}} hi",["user"],false))));
  ok("and is quiet inside a box", await pg.evaluate(()=>
      _phWarnHtml("Say {{if render_mode = heat}} hi",["user"],true)===""));
  ok("a genuinely unknown token is still caught inside a box", await pg.evaluate(()=>
      /nosuchtoken/.test(_phWarnHtml("Hi {{nosuchtoken}}",["user"],true))));
  ok("a bare call in a box is still flagged; one in a comment is not", await pg.evaluate(()=>{
      const bare=_phWarnHtml("Rules: {{call//rail_voice}}",["user"],true);
      const noted=_phWarnHtml("{{comment}} use {{call//rail_voice}} {{endcomment}} Rules.",["user"],true);
      return /call/.test(bare) && noted===""; }));

  console.log("\n[nothing else moved]");
  ok("saveSettings does not throw", await pg.evaluate(()=>{
      show('settings'); try{ saveSettings(false); return true; }catch(e){ return "threw: "+e.message; } }));
  ok("no page errors", errs.length===0?true:errs.join(" | "));
  console.log("\n"+pass+" passed, "+fail+" failed");
  await b.close(); process.exit(fail?1:0);
})();
