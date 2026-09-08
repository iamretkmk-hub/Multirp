let state={user:"Kemal",payloadTplOn:true,payloadTemplates:{},payloadLayouts:{},payloadRemoved:{}};
const K={payloadTemplates:"x",payloadTplOn:"y"};
const store={set(){},get(k,d){return d;}};
function curUniverseObj(){return {name:"Istanbul"};}
function dbg(){return {};} function dbgDone(){} function toast(){}
const PAYLOAD_DEFS={solo:{order:["task","world","your_bio","rumors","scenario","__history__",
                                 "scene_now","privacy","trackers","response_guidance"]}};
function payloadRemovedSet(){return new Set();}
function payloadOrder(key){return ((PAYLOAD_DEFS[key]||{}).order||[]).slice();}
const ctx={chat:{gameDay:3,period:"Evening",location:"Cafe Derya"},npc:{name:"Ayse",id:"p1"},targetName:"Kemal"};
function buildPayload(layoutKey, headBlocks, tailBlocks){
  const all=Object.assign({},headBlocks,tailBlocks);
  const head=[],tail=[]; let afterHist=false;
  payloadOrder(layoutKey).forEach(id=>{
    if(id==="__history__"){afterHist=true;return;}
    const c=all[id]; if(!c)return;
    (afterHist?tail:head).push(c);
  });
  const h=_dedupePayloadSections(head.join("\n\n"));
  // The tail is deduped against the head too — a block repeated across the split is still a repeat.
  const t=_dedupePayloadSections(tail.join("\n\n"));
  const hKeys=new Set(h.split(/\n(?=#{1,2} )/).map(s=>s.replace(/\s+/g," ").trim()).filter(s=>s.length>40));
  const t2=t.split(/\n(?=#{1,2} )/).filter(s=>!hKeys.has(s.replace(/\s+/g," ").trim())).join("\n");
  return {head:h, tail:t2};
}
function _dedupePayloadSections(text){
  const t=String(text||"");
  if(!t.trim())return t;
  const parts=t.split(/\n(?=#{1,2} )/);
  if(parts.length<2)return t;
  const seen=new Set(), out=[];
  parts.forEach(sec=>{
    const key=sec.replace(/\s+/g," ").trim();
    if(key.length>40){ if(seen.has(key))return; seen.add(key); }
    out.push(sec);
  });
  return out.join("\n");
}
const PT_KINDS=["solo","multi","gm","text","heat"];
const PT_ROLE_OPEN=/^\s*\[(system|user|assistant)\]\s*$/i;
const PT_ROLE_CLOSE=/^\s*\[(?:(?:system|user|assistant)\s+end|end\s+(?:system|user|assistant))\]\s*$/i;
const PT_HISTORY_LINE=/^\s*\{\{\s*call\s*\/\/\s*dialogue_history\s*\}\}\s*$/i;
const PT_CALL=/\{\{\s*call\s*\/\/\s*([a-zA-Z0-9_]+)\s*(?:\/\/\s*([a-zA-Z0-9_]+)\s*)?\}\}/g;
const PT_VAR=/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;

/* The values a template may interpolate. Anything not here stays visible as literal text. */
function ptVars(ctx){
  ctx=ctx||{};
  const chat=ctx.chat||null, npc=ctx.npc||null;
  let uni=""; try{ uni=(curUniverseObj()||{}).name||""; }catch(e){}
  const v={
    "user": state.user||"You",
    "npc.name": npc?(npc.name||""):"",
    "npc.id": npc?(npc.id||""):"",
    "response.target": ctx.targetName||"",
    "current_day": chat?String(chat.gameDay||1):"",
    "period": chat?(chat.period||chat.timeOfDay||""):"",
    "location": chat?(chat.location||""):"",
    "universe": uni
  };
  v["char"]=v["npc.name"]; v["target"]=v["response.target"]; v["day"]=v["current_day"];
  return v;
}
/* The call names a template may use — the same block map buildPayload receives. */
function ptSources(blocks){
  const s=Object.assign({},blocks||{});
  delete s.__history__;                 // history is structural, handled by ptParse
  return s;
}
function ptResolve(srcs,name,sub,report){
  const key=sub?(name+"//"+sub):name;
  if(Object.prototype.hasOwnProperty.call(srcs,key)) return srcs[key]||"";
  if(report&&report.unknownCall.indexOf(key)===-1) report.unknownCall.push(key);
  return "";
}

/* Expand one segment's text. Returns "" when everything in it dropped out. */
function ptExpand(text,srcs,vars,report){
  const paras=String(text==null?"":text).split(/\n[ \t]*\n/);
  const keep=[];
  paras.forEach(p=>{
    /* pass 1 — resolve every call in this paragraph up front, so pass 2 can tell an empty call
       from a filled one without re-running the lookup. */
    const vals={}; let anyCall=false, anyFilled=false, m;
    PT_CALL.lastIndex=0;
    while((m=PT_CALL.exec(p))){
      const key=m[2]?(m[1]+"//"+m[2]):m[1];
      anyCall=true;
      if(!Object.prototype.hasOwnProperty.call(vals,key)){
        const v=ptResolve(srcs,m[1],m[2],report);
        vals[key]=(v&&String(v).trim())?String(v):"";
      }
      if(vals[key]) anyFilled=true;
    }
    if(anyCall&&!anyFilled) return;                    // AUTO-DROP the whole paragraph
    /* pass 2 — drop lines that hold nothing but empty calls, so a filled paragraph does not keep
       a stray blank where an empty call sat. Done on the TEMPLATE, before substitution, so the
       internal blank lines of a filled block are never touched. */
    const lines=p.split("\n").filter(ln=>{
      let has=false,filled=false,mm; PT_CALL.lastIndex=0;
      while((mm=PT_CALL.exec(ln))){ has=true; const k=mm[2]?(mm[1]+"//"+mm[2]):mm[1]; if(vals[k])filled=true; }
      if(!has||filled) return true;
      return ln.replace(PT_CALL,"").trim()!=="";       // keep if the line says something itself
    });
    let out=lines.join("\n").replace(PT_CALL,(mm,n,s)=>vals[s?(n+"//"+s):n]||"");
    out=out.replace(PT_VAR,(mm,k)=>{
      if(k==="call") return mm;
      if(Object.prototype.hasOwnProperty.call(vars,k)) return String(vars[k]==null?"":vars[k]);
      if(report&&report.unknownVar.indexOf(k)===-1) report.unknownVar.push(k);
      return mm;                                       // left visible on purpose
    });
    out=out.replace(/[ \t]+$/gm,"").replace(/\n{3,}/g,"\n\n");
    if(out.trim()) keep.push(out.trim());
  });
  return keep.join("\n\n");
}

/* Split a template into ordered messages and history insertion points. */
function ptParse(tpl){
  const lines=String(tpl==null?"":tpl).split(/\r?\n/);
  const out=[]; let cur=null, loose=[];
  const closeCur=()=>{ if(cur){ out.push({type:"msg",role:cur.role,text:cur.buf.join("\n")}); cur=null; } };
  const flushLoose=()=>{ const t=loose.join("\n"); loose=[]; if(t.trim()) out.push({type:"msg",role:"system",text:t}); };
  lines.forEach(ln=>{
    const m=ln.match(PT_ROLE_OPEN);
    if(m){ closeCur(); flushLoose(); cur={role:m[1].toLowerCase(),buf:[]}; return; }
    if(PT_ROLE_CLOSE.test(ln)){ closeCur(); return; }
    if(PT_HISTORY_LINE.test(ln)){ closeCur(); flushLoose(); out.push({type:"history"}); return; }
    if(cur) cur.buf.push(ln); else loose.push(ln);
  });
  closeCur(); flushLoose();
  return out;
}

/* Which names a template uses, and which of those do not exist. `known` is a block map (live) or
   the id set (editor). Drives the red warnings in the editor. */
function ptScan(tpl,known){
  const body=String(tpl==null?"":tpl);
  const used=[],unknownCall=[],unknownVar=[];
  known=known||{};
  let m; PT_CALL.lastIndex=0;
  while((m=PT_CALL.exec(body))){
    const key=m[2]?(m[1]+"//"+m[2]):m[1];
    if(used.indexOf(key)===-1) used.push(key);
    if(key!=="dialogue_history"&&!Object.prototype.hasOwnProperty.call(known,key)&&unknownCall.indexOf(key)===-1)
      unknownCall.push(key);
  }
  const vars=ptVars({});
  PT_VAR.lastIndex=0;
  while((m=PT_VAR.exec(body))){
    const k=m[1];
    if(k==="call") continue;
    if(!Object.prototype.hasOwnProperty.call(vars,k)&&unknownVar.indexOf(k)===-1) unknownVar.push(k);
  }
  return {used,unknownCall,unknownVar,hasHistory:/\{\{\s*call\s*\/\/\s*dialogue_history\s*\}\}/i.test(body)};
}

/* The default template for a payload kind, generated from that kind's CURRENT block order, so
   an unedited template reproduces buildPayload exactly. */
function ptDefaultTemplate(kind){
  const order=payloadOrder(kind)||[];
  const head=[],tail=[]; let after=false;
  order.forEach(id=>{
    if(id==="__history__"){ after=true; return; }
    (after?tail:head).push("{{call//"+id+"}}");
  });
  let out="";
  if(head.length) out+="[system]\n"+head.join("\n\n")+"\n[system end]\n\n";
  out+="{{call//dialogue_history}}\n";
  if(tail.length) out+="\n[system]\n"+tail.join("\n\n")+"\n[system end]\n";
  return out;
}

function ptTemplates(){ return state.payloadTemplates||{}; }
function ptTemplate(kind){
  const t=ptTemplates()[kind];
  return (typeof t==="string"&&t.trim())?t:ptDefaultTemplate(kind);
}
function ptIsCustom(kind){
  const t=ptTemplates()[kind];
  return !!(typeof t==="string"&&t.trim()&&t.trim()!==ptDefaultTemplate(kind).trim());
}
function ptSetTemplate(kind,text){
  const all=Object.assign({},ptTemplates());
  if(text==null||!String(text).trim()) delete all[kind]; else all[kind]=String(text);
  state.payloadTemplates=all; store.set(K.payloadTemplates,all);
}

/* MAIN ENTRY — returns the full messages[] for a reply, or null to use the classic path.
   `history` is the already-built transcript message array. */
function ptBuildMessages(kind,blocks,history,ctx){
  if(!state.payloadTplOn) return null;
  let msgs=[];
  try{
    const report={unknownCall:[],unknownVar:[]};
    const srcs=ptSources(blocks), vars=ptVars(ctx||{});
    const headSecs=new Set();
    let seenInstruction=false;
    ptParse(ptTemplate(kind)).forEach(pt=>{
      if(pt.type==="history"){ if(Array.isArray(history)) msgs.push.apply(msgs,history); return; }
      let body=ptExpand(pt.text,srcs,vars,report);
      if(!body.trim()) return;
      body=_dedupePayloadSections(body);
      /* Same cross-message de-duplication buildPayload does between head and tail: a section
         repeated after the transcript is still a repeat. */
      if(!seenInstruction){
        body.split(/\n(?=#{1,2} )/).forEach(s=>{ const k=s.replace(/\s+/g," ").trim(); if(k.length>40) headSecs.add(k); });
        seenInstruction=true;
      }else{
        body=body.split(/\n(?=#{1,2} )/).filter(s=>!headSecs.has(s.replace(/\s+/g," ").trim())).join("\n");
      }
      if(body.trim()) msgs.push({role:pt.role,content:body.trim()});
    });
    if(report.unknownCall.length||report.unknownVar.length){
      const e=dbg("Payload template — names that do not exist ("+kind+")","In-app",
        "(template check — no network request)",
        {unknown_calls:report.unknownCall,unknown_values:report.unknownVar,
         note:"Typed in Settings → Payloads but not recognised. Calls sent nothing; values were left as literal text."});
      dbgDone(e,"error",{fix:"Open Settings → Payloads → Payload templates. Unknown names are marked in red."});
    }
  }catch(err){
    /* A broken template must never cost the player their turn — fall back to the classic path
       and say so loudly. */
    try{ const e=dbg("Payload template FAILED ("+kind+") — used the standard payload instead","In-app",
      "(template error — no network request)",{error:String(err&&err.message||err)});
      dbgDone(e,"error",{fix:"Settings → Payloads → Reset this template to default."}); }catch(e2){}
    try{ toast("Payload template error — sent the standard payload instead"); }catch(e2){}
    return null;
  }
  return msgs.length?msgs:null;
}

const head={
 task:"# TASK\nYou are playing one character.\nStay in voice.",
 world:"# WORLD SETTING\nA rainy port city.\n\nOld money, new grudges.",
 your_bio:"# WHO YOU ARE\nAyse, 34.\n\nBACKSTORY:\nShe left and came back.",
 rumors:"", scenario:""};
const tail={
 scene_now:"# SCENE RIGHT NOW\nDay 3, Evening.\nCafe Derya.",
 privacy:"# WHO CAN HEAR YOU\nYou are alone with Kemal.",
 response_guidance:"# RESPONSE GUIDANCE\nAnswer Kemal.",
 trackers:""};
const hist=[{role:"user",content:"hello"},{role:"assistant",content:"hi"}];

const classic=buildPayload("solo",head,tail);
const classicMsgs=[];
if(classic.head)classicMsgs.push({role:"system",content:classic.head});
classicMsgs.push(...hist);
if(classic.tail)classicMsgs.push({role:"system",content:classic.tail});

const tpl=ptBuildMessages("solo",Object.assign({},head,tail),hist,ctx);
const a=JSON.stringify(classicMsgs,null,1), b=JSON.stringify(tpl,null,1);
if(a===b){ console.log("BYTE-IDENTICAL  default template === classic buildPayload"); process.exit(0); }
console.log("MISMATCH\n\n--- classic ---\n"+a+"\n\n--- template ---\n"+b); process.exit(1);
