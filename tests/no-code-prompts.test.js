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
  /"(You (?:are|write|design|judge|build|assign|repair|revise|condense|flesh|narrate|split|decide|maintain|run|score|track)\b[^"]{150,})"/g,
  /* v71.1 — AND THE ONES THAT OPEN WITH A HEADING INSTEAD OF "You are". Three layers of the image
     writer hid here for their whole lives: IMG_WRITER_FOUNDATION, IMG_WRITER_FRAME_GUIDE and
     IMG_WRITER_POV_GUIDE opened "# FOUNDATION", "## THIS FRAME" and "## THIS IS A POV FRAME", so
     the patterns above never saw them — and the one part of the image stack nobody could edit was
     also the part that had gone stale, still explaining how to fill a [bracket] template that the
     rule templates had stopped having. A markdown heading followed by an instruction is a prompt. */
  /`(#{1,3} [A-Z][^`\n]{4,80}\n[^`]{150,})`/g,
  /`(\\n\\n#{1,3} [A-Z][^`]{150,})`/g
];
/* A prompt is also allowed to be the value of a `const DEFAULT_… =` — that IS the registry's
   store, and every entry in PROMPT_REGISTRY points at one. What is never allowed is a prompt-shaped
   string anywhere else: assigned to some other constant, or built inline at the call site. */
const declBefore=i=>{
  const head=src.lastIndexOf("const ",i);
  if(head<0||i-head>60) return false;
  return /^const DEFAULT_[A-Z_0-9]+\s*=\s*$/.test(src.slice(head,i).replace(/`$/,"").trim());
};
/* And a constant whose text only ever EXPANDS INSIDE an allowed prompt — `${CARD_VOICE_RULE}`
   written into five DEFAULT_… literals — is a source-level way of not repeating yourself, not a
   prompt hidden in code: what the user edits in the registry is the expanded text. Exempt, but
   only while that stays true. The moment such a constant is concatenated at a call site instead,
   it is reachable prompt text nobody can edit, and it is reported like anything else. */
const codeOnly=src.replace(/\/\*[\s\S]*?\*\//g," ")            // block comments
                  .replace(/^[ \t]*\/\/.*$/gm," ");               // whole-line // comments
const sharedOK=new Set();
for(const m of src.matchAll(/^const ([A-Z][A-Z_0-9]*)=`/gm)){
  const name=m[1];
  const all=[...codeOnly.matchAll(new RegExp("\\b"+name+"\\b","g"))];
  const interp=[...codeOnly.matchAll(new RegExp("\\$\\{"+name+"\\}","g"))].length;
  // one mention is the declaration itself; the rest must all be ${NAME} expansions
  if(interp>0 && all.length===interp+1) sharedOK.add(m.index);
}
const strays=[];
PATTERNS.forEach(re=>{
  let m;
  while((m=re.exec(src))){
    if(m.index>=tableStart&&m.index<=fragEnd) continue;   // the prompt tables themselves
    if(declBefore(m.index)) continue;                     // a registered default's own constant
    if(sharedOK.has(src.lastIndexOf("const ",m.index))) continue;   // expands only inside one
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
