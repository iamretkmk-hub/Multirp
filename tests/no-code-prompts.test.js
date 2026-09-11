/* v38.5 — NO PROMPT MAY GO BACK INTO THE CODE.
   tests/prompt-registry.browser.js proves every prompt the app KNOWS ABOUT is editable. It cannot
   see a prompt that was never registered — which is exactly how eighteen of them hid. This one
   reads the source instead, and fails on the shape they all had: a long instruction string handed
   straight to a model. Add a prompt, and it has to go through PROMPT_REGISTRY like the rest.
   Run: node tests/no-code-prompts.test.js */
const fs=require('fs'), path=require('path');
const src=fs.readFileSync(path.resolve(__dirname,'..','index.html'),'utf8');
let pass=0,fail=0;
const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x||c).slice(0,900));} };

/* Where prompt text is ALLOWED to be: the X_ENGINE_PROMPTS table, the DEFAULT_* constants beside
   it, and BLOCK_TPL_DEFAULTS — the three places whose entire job is holding prompt text. A match
   anywhere else is a prompt that went back into the code. */
const tableStart=src.indexOf("const X_ENGINE_PROMPTS={");
const fragEnd=src.indexOf("function blkTpl(");
ok("the prompt tables are where this test thinks they are",
   tableStart>0&&fragEnd>tableStart, "table="+tableStart+" fragments end="+fragEnd);

/* A prompt, as this test recognises one: a string literal of 150+ characters that opens by telling
   a model what it is or what to do — the exact shape of all twenty-four that were found in code.
   The body may not contain its own delimiter, so a short toast cannot run on into a later quote. */
const PATTERNS=[
  /`(You (?:are|write|design|judge|build|assign|repair|revise|condense|flesh|narrate|split|decide|maintain|run|score|track)\b[^`]{150,})`/g,
  /"(You (?:are|write|design|judge|build|assign|repair|revise|condense|flesh|narrate|split|decide|maintain|run|score|track)\b[^"]{150,})"/g
];
const strays=[];
PATTERNS.forEach(re=>{
  let m;
  while((m=re.exec(src))){
    if(m.index>=tableStart&&m.index<=fragEnd) continue;   // the prompt tables themselves
    const line=src.slice(0,m.index).split("\n").length;
    strays.push("line "+line+": "+m[1].replace(/\s+/g," ").slice(0,90)+"…");
  }
});
ok("no prompt-shaped string outside the prompt tables", strays.length===0,
   strays.length+" found:\n        "+strays.join("\n        "));

/* And the sentence the editor used to show for them is gone with them. */
ok("the editor no longer has a \"written in code\" answer for an engine",
   src.indexOf("This engine's prompt is written in code")<0 ? true
   : "the toast is still in the source — some engine can still reach it");

console.log("\n"+pass+" passed, "+fail+" failed");
process.exit(fail?1:0);
