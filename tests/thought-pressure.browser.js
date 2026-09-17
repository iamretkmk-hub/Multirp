/* v58.1 — A THOUGHT THAT CHANGES NOTHING, THREE TURNS RUNNING.
   Reported from a live scene: his hand goes waist → breast → gripping, and her thought says the
   same thing each turn — "his hand is there, but moving now would make it strange" — while her
   body does nothing. Four things in the payload were producing it, and three of them were ours:
     · the short-term feelings note is the only block issuing orders for THIS turn, and its own
       prompt asks it to "spell out how that feeling should COLOR your next line" — so it wrote
       "you keep your voice light and you don't pull away", and the model obeyed;
     · DRIVES & BRAKES is cached on psycheSig, which has no term for what the bodies are doing, so
       the id/superego block stayed frozen on the version written before anyone was touching;
     · the repetition detector measures whole LINES, and a line can look new every turn while the
       thought inside it repeats;
     · the resistance gate is written about the spoken line, so a compliment plus a closing hand
       switched the whole ladder off.
   Run: node tests/thought-pressure.browser.js */
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage({viewport:{width:412,height:915}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  const app='file://'+require('path').resolve(__dirname,'..','index.html');
  await pg.goto(app); await pg.waitForTimeout(2400);
  await pg.evaluate(()=>{ if(typeof finishOnboard==='function'&&!store.get(K.onboarded,false)) finishOnboard(); });
  await pg.waitForTimeout(600);
  let pass=0,fail=0;
  const ok=(n,c,x)=>{ if(c===true){pass++;console.log("  PASS  "+n);} else {fail++;console.log("  FAIL  "+n+"\n        "+String(x||c).slice(0,600));} };

  // ---------- A: the feelings note reports state, it does not order composure
  const relp=await pg.evaluate(()=>({d:DEFAULT_REL_SHORT,stale:(window.__stalePipes||[]).join(" | ")}));
  ok("the note is forbidden from deciding the turn",
     /YOU REPORT THE STATE\. YOU DO NOT DECIDE THE TURN/.test(relp.d)
     &&/never tell them to hold steady, keep their voice light, keep smiling, not pull away/.test(relp.d), "");
  ok("it asks for the impulse instead of the behaviour",
     /name the IMPULSE it is producing/.test(relp.d)
     &&!/spell out how that feeling should visibly COLOR your next line/.test(relp.d), "");
  ok("and it carries the real sentence that caused this as the worked wrong example",
     /you keep your voice light and you don't pull away/.test(relp.d)
     &&/Wrong \(do NOT do this — it is an order/.test(relp.d), "");
  ok("no refresh pipe was left pointing at a marker a default lost",
     !/relShortPrompt/.test(relp.stale), relp.stale);
  const rt=async(key,v)=>{ await pg.evaluate(a=>store.setRaw(K[a.k],a.v),{k:key,v});
    await pg.reload(); await pg.waitForTimeout(2400); return pg.evaluate(a=>state[a],key); };
  ok("an older stored feelings prompt picks up the rule",
     /YOU DO NOT DECIDE THE TURN/.test(await rt("relShortPrompt",
       "You read the IMMEDIATE emotional reaction of one character to a recent moment. Old body.")));
  ok("one the user wrote themselves is left alone",
     (await rt("relShortPrompt","My own feelings reader."))==="My own feelings reader.");
  await pg.evaluate(()=>store.setRaw(K.relShortPrompt,DEFAULT_REL_SHORT));
  await pg.reload(); await pg.waitForTimeout(2400);

  // ---------- F: the drives cache notices that the bodies moved
  const sig=await pg.evaluate(()=>{
    const uni=state.universes[0];
    const p={id:"p_d",name:"Duygu",universeId:uni.id,instructions:"x",personality:"x",
             backstory:"x",style:"x",goals:"x",look:{}};
    state.personas=[p];
    const chat=curChat(); chat.presentIds=[p.id]; chat.messages=[];
    const push=c=>chat.messages.push({mid:newMid(),role:"assistant",speaker:"Duygu",speakerId:p.id,content:c});
    push('"Tut bakalım." *Avuçları belime değiyor, kendimi bırakıyorum.*');
    const a=psycheSig(chat,p,"__user__");
    const again=psycheSig(chat,p,"__user__");
    push('"Böyle mi?" *Avuçları belimde duruyor, kendimi bırakıyorum.*');   // same action, said again
    const b=psycheSig(chat,p,"__user__");
    push('"Ders bayağı ilerledi." *Eli göğsümü kavrıyor, parmakları sıkışıyor.*');  // a NEW action
    const c=psycheSig(chat,p,"__user__");
    chat.messages=[]; push('"Nasılsın?"'); push('"İyiyim, sen?"');          // talk, no narration
    const d=psycheSig(chat,p,"__user__"); push('"Havalar da güzel."');
    const e=psycheSig(chat,p,"__user__");
    return {a,again,b,c,d,e,body:_psycheBodySig(chat)};
  });
  ok("the signature is stable when nothing changes", sig.a===sig.again, "");
  ok("a hand arriving somewhere new moves it", sig.b!==sig.c, "same sig across a new action");
  /* (!) sig.b re-words the same beat ("belime değiyor" → "belimde duruyor") and DOES move the
     signature, because the word set genuinely changed — Turkish agglutination alone guarantees
     that. That is deliberate and it is the cost of this fix: in a scene where bodies are moving,
     DRIVES & BRAKES is rewritten most turns instead of once. The old behaviour was one snapshot
     for the whole scene, which is the bug. Stability is only claimed for text that is actually
     identical (sig.a === sig.again, above) and for turns with no narration at all (below). */
  ok("a re-wording of the same beat also moves it, and that is the accepted cost",
     sig.a!==sig.b, "a re-wording left it frozen");
  ok("talk alone carries no body term at all", sig.body==="" && sig.d===sig.e, sig.body);

  // ---------- C: the thought that repeats
  const th=await pg.evaluate(()=>{
    const p=state.personas[0];
    const chat=curChat(); chat.messages=[];
    const push=c=>chat.messages.push({mid:newMid(),role:"assistant",speaker:"Duygu",speakerId:p.id,content:c});
    const out={};
    push('*Bacaklarımı çırpıyorum.* "Böyle mi?"\n\n_Eli orada. Farkındayım ama çekersem daha tuhaf olur._');
    out.one=thoughtIsStuck(chat,p);
    push('*Başımı kaldırıyorum.* "Ders ilerledi."\n\n_Eli orada. Farkındayım ama kalkarsam her şeyi büyütmüş olurum._');
    out.two=thoughtIsStuck(chat,p);
    out.read=ownRecentThoughts(chat,p,3);
    chat.messages=[];
    push('*Duruyorum.* "Peki."\n\n_Bu akşam yemeği kim yapacak._');
    push('*Bakıyorum.* "Olur."\n\n_Bir daha elini oraya koyarsa kalkıyorum._');
    out.different=thoughtIsStuck(chat,p);
    chat.messages=[];
    push('*Duruyorum.* "Peki."');
    push('*Bakıyorum.* "Olur."');
    out.none=thoughtIsStuck(chat,p);
    return out;
  });
  ok("one thought is not a pattern", th.one===false, "");
  ok("the same thought twice is", th.two===true, "");
  ok("it reads the thought out of the line, without the underscores",
     th.read.length===2&&!/_/.test(th.read[0])&&/kalkarsam/.test(th.read[0]), JSON.stringify(th.read));
  ok("two genuinely different thoughts are not stuck", th.different===false, "");
  ok("lines with no thought at all never fire it", th.none===false, "");

  const rail=await pg.evaluate(()=>({t:blkTpl("already_said_thought_stuck"),s:blkTpl("already_said_stalled")}));
  ok("the rail tells her the fourth repetition is the one move that is gone",
     /thinking it a fourth time is the one move that is no longer available/.test(rail.t), "");
  ok("it offers act-or-drop, and both cost something",
     /ACT ON IT/.test(rail.t)&&/OR DROP IT, and mean it/.test(rail.t)
     &&/a body doing something it was not doing last turn/.test(rail.t), "");
  ok("and the old stall menu finally has an option that is not speech",
     /DO something physical instead of saying anything/.test(rail.s)
     &&/five more ways to not move/.test(rail.s), "");

  // ---------- D: an ask can be made with a hand
  const res=await pg.evaluate(()=>blkTpl("resistance_actions"));
  ok("the resistance block reads actions as asks",
     /AN ASK IS NOT ONLY A SENTENCE/.test(res)&&/answer the hand, not the sentence/.test(res), "");
  ok("a repeated action is asked again, and a further one is a bigger ask",
     /An action REPEATED is asked again/.test(res)
     &&/is a NEW ask, larger than the one before it/.test(res), "");
  ok("and not objecting is named as the answer it is",
     /Not objecting IS an answer/.test(res)&&/it is not something you get to keep doing/.test(res), "");

  // ---------- the thought rule
  /* v61.1 — the contract moved OUT of `drive_ego` and into the guardrails box as `rail_thought`.
     `drive_ego` renders only once the psyche engine has written for the scene, so the rules
     governing a channel that exists on EVERY turn were absent from most of them; and a motivation
     block was defining output format. The rails box is the one place BOTH payload paths render
     (the authored layouts and the generated default), and it is the closest to generation. The ban
     on narrating the weighing stays in `drive_ego`, where it belongs. */
  const ego=await pg.evaluate(()=>blkTpl("drive_ego"));
  const thc=await pg.evaluate(()=>blkTpl("rails_header"));
  ok("the weighing is banned only where people can see it",
     /Do not narrate this weighing where anyone can see it/.test(ego)
     &&/in speech and in what your body does/.test(ego), "");
  ok("and drive_ego no longer carries the thought rules itself",
     !/AND IT DOES NOT EXPIRE WHEN THE TURN DOES/.test(ego)
     &&!/A THOUGHT POINTS SOMEWHERE/.test(ego), ego.slice(0,200));
  ok("the thought is given the job, with the condition that makes it matter",
     /\[\[rail_thought\]\]/.test(thc)
     &&/A THOUGHT POINTS SOMEWHERE/.test(thc)
     &&/it is the deciding, caught in motion/.test(thc), "");
  ok("the deadlock caption is named and refused",
     /"I should, but I won't" is not a thought/.test(thc)
     &&/a decision you are hiding from yourself/.test(thc), "");
  ok("and a thought is stated NOT to be spent the way a line is",
     /AND IT DOES NOT EXPIRE/.test(thc)
     &&/never spoken, so it was never spent/.test(thc), "");
  ok("a line you draw is one of the shapes it offers",
     /a line you draw with the terms attached/.test(thc), "");
  ok("it is a registered rail — listed, editable, and withheld from a typed text",
     await pg.evaluate(()=>RAIL_ORDER_SPOKEN.indexOf("rail_thought")>-1
       && RAIL_ORDER_HEAT.indexOf("rail_thought")>-1
       && RAIL_ORDER_TEXT.indexOf("rail_thought")===-1), "");

  ok("no page errors", errs.length===0, errs.join(" | "));
  console.log("\n  "+pass+" passed, "+fail+" failed");
  await b.close();
  process.exit(fail?1:0);
})();
