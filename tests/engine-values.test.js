/* v70.1 — EVERY NAME AN ENGINE SEPARATOR USES MUST ACTUALLY RESOLVE.
   An engine's separators and fixed text may carry {{value}} names, and they are filled from two
   places: the global engine vocabulary (PT_VALUES entries with scope:"any") and the `vars` object
   the call site passes as epSend's fourth argument. A name in neither is not an error anywhere —
   it is left VISIBLE on purpose, so it reaches the model as the literal "{{self}}" and shows up in
   the template editor as a name that does not resolve.

   That is how psychePrompt shipped: its `settled` separator reads "HOW {{self}} HAS COME TO FEEL
   ABOUT {{target}}", `target` was supplied by the call site and `self` was not, and `self` is
   scope:"reply" — the reply payload's vocabulary, not the engine one. It was invisible for as long
   as that part came back empty; the moment the part was fixed and started carrying content, the
   unresolved name went out with it.

   Run: node tests/engine-values.test.js */
const {chromium}=require('playwright');
const BIN=process.env.CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const fs=require('fs'), path=require('path');

function argsAt(src,i){            // the text inside a call whose "(" has just been consumed
  let d=1,j=i;
  while(j<src.length&&d>0){ const c=src[j]; if(c==='(')d++; else if(c===')')d--; j++; }
  return src.slice(i,j-1);
}
function topLevelParts(body){
  const out=[]; let d=0,last=0;
  for(let i=0;i<body.length;i++){ const c=body[i];
    if('(['.includes(c)||c==='{')d++;
    else if(')]'.includes(c)||c==='}')d--;
    else if(c===','&&d===0){ out.push(body.slice(last,i)); last=i+1; } }
  out.push(body.slice(last)); return out;
}

(async()=>{
  const src=fs.readFileSync(path.resolve(__dirname,'..','index.html'),'utf8');
  let pass=0,fail=0;
  const ok=(n,c)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+c);} };

  // the vocabulary an engine template can actually see
  const b=await chromium.launch({executablePath:BIN});
  const pg=await b.newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file://'+path.resolve(__dirname,'..','index.html'));
  await pg.waitForTimeout(2200);
  const globalNames=await pg.evaluate(()=>Object.keys(ptVars({},"any")));
  await b.close();
  ok("the engine vocabulary is non-empty", globalNames.length>0?true:"ptVars(_,'any') returned nothing");

  // what each engine's separators and fixed text ask for
  const need={};
  for(const m of src.matchAll(/epDefine\("([A-Za-z_0-9]+)"/g)){
    const names=[...new Set([...argsAt(src,m.index+m[0].length).matchAll(/\{\{([a-z_]+)\}\}/g)].map(x=>x[1]))];
    if(names.length) need[m[1]]=names;
  }
  ok("some engines declare values at all", Object.keys(need).length>0?true:"no epDefine placeholders found");

  // what each call site supplies
  const supply={};
  for(const m of src.matchAll(/epSend\("([A-Za-z_0-9]+)"/g)){
    const parts=topLevelParts(argsAt(src,m.index+m[0].length));
    const va=(parts[3]||"").trim();
    const keys=va.startsWith("{") ? [...va.matchAll(/([a-z_]+)\s*:/g)].map(x=>x[1]) : [];
    (supply[m[1]]=supply[m[1]]||[]).push(new Set(keys));
  }

  const misses=[];
  for(const key of Object.keys(need)){
    const wanted=need[key].filter(n=>!globalNames.includes(n));
    if(!wanted.length) continue;
    const sites=supply[key];
    if(!sites){ misses.push(key+": declares "+JSON.stringify(wanted)+" but has no epSend call site"); continue; }
    sites.forEach((keys,i)=>{
      const m=wanted.filter(n=>!keys.has(n));
      if(m.length) misses.push(key+" (call site "+(i+1)+"/"+sites.length+"): "+JSON.stringify(m)+" is neither in the engine vocabulary nor supplied");
    });
  }
  ok("every engine separator name resolves at every call site", misses.length===0?true:misses.join("\n        "));

  // the two this test was written for
  ok('psychePrompt supplies "self" beside "target"',
     /epSend\("psychePrompt",sys,bits,\{target:targetName\|\|state\.user,self:p\.name\}\)/.test(src)
       ? true : "the drives writer still sends target alone");
  ok('both memBuild call sites supply "who"',
     [...src.matchAll(/epSend\("memBuild"/g)].length===2
       && [...src.matchAll(/epSend\("memBuild"[\s\S]{0,220}?who:p\.name/g)].length===2
       ? true : "one of memBuild's call sites still omits who");
  ok('"self" is still reply-scoped, so the fix is the call site and not the vocabulary',
     /\{name:"self",\s*scope:"reply"/.test(src)
       ? true : "self was promoted to the global vocabulary instead");

  if(errs.length) console.log("page errors: "+errs.join(" | "));
  console.log("\n"+pass+" passed, "+fail+" failed");
  process.exit(fail||errs.length?1:0);
})();
