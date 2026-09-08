/* Engine payload parity — the safety net for the engine-template conversion.
   For EVERY engine registered in ENGINE_PARTS, the unedited default template must assemble the
   same user message the hand-written concatenation used to build. If this fails, turning
   templates on would silently change what a background engine receives.
   Run: node tests/engine-parity.test.js   (needs playwright; see tests/README.md) */
const {chromium}=require('playwright');
const BIN=process.env.CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
(async()=>{
  const b=await chromium.launch({executablePath:BIN});
  const pg=await b.newPage();
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file://'+require('path').resolve(__dirname,'..','index.html'));
  await pg.waitForTimeout(2200);

  const res=await pg.evaluate(()=>{
    const out=[];
    const keys=Object.keys(ENGINE_PARTS);
    // Value shapes worth testing: everything present, and every part empty but the `always` ones.
    const shapes=[
      {name:"all parts present", fill:(p,i)=>"PART_"+p.name.toUpperCase()+"_"+i+"\nsecond line"},
      {name:"every optional part empty", fill:()=>""},
      {name:"alternating empty", fill:(p,i)=>i%2?"":("VALUE_"+p.name)}
    ];
    keys.forEach(k=>{
      const d=ENGINE_PARTS[k];
      shapes.forEach(sh=>{
        const parts={};
        d.parts.forEach((p,i)=>parts[p.name]=sh.fill(p,i));
        const classicUser=epClassicUser(k,parts);
        const was=state.payloadTplOn; state.payloadTplOn=true;
        let tpl=null;
        try{ tpl=epMessages(k,"SYSTEM_PROMPT_TEXT",parts); }finally{ state.payloadTplOn=was; }
        const tplUser=tpl?tpl.filter(m=>m.role==="user").map(m=>m.content).join("\n\n"):null;
        const tplSys=tpl?(tpl.find(m=>m.role==="system")||{}).content:null;
        out.push({engine:k,label:d.label,shape:sh.name,
          sysOk: tpl?(tplSys==="SYSTEM_PROMPT_TEXT"):(classicUser.trim()===""),
          userOk: tpl?(tplUser===classicUser.trim()):(classicUser.trim()===""),
          classic:classicUser, got:tplUser});
      });
    });
    return {out,count:keys.length};
  });

  let pass=0,fail=0;
  res.out.forEach(r=>{
    const good=r.sysOk&&r.userOk;
    if(good){pass++;}
    else{ fail++;
      console.log("  FAIL  "+r.engine+" ["+r.shape+"]");
      console.log("        classic: "+JSON.stringify(r.classic));
      console.log("        template:"+JSON.stringify(r.got));
    }
  });
  console.log("\n"+res.count+" engines registered, "+(pass+fail)+" checks: "+pass+" passed, "+fail+" failed");
  if(errs.length) console.log("page errors: "+errs.join(" | "));
  await b.close();
  process.exit(fail||errs.length?1:0);
})();
