# Payload review: memory family

Covers: Memory (arc) · <character> / · Emre (you), Memory arc tracker (+ text), Memory reconcile, Memory (text), Short-term, Daily relationship, Diary, Gossip, Rumor judge (answer), Universe chronicle, Day transition narration.

**Overall.** The per-character memory pipeline is well built in most respects. WHEN and WHERE are stamped from the app's clock and are right in every sample I checked, including flushes after travel (0261: Vanadium Cafe, stamped after the walk to Isdemir) and period changes (0586, 0813, 0996). Whispers addressed to someone else are removed. Other characters' `_thoughts_` never reach a memory writer. Each character's arc is cut to the lines they were present for. Chronicle and gossip stay inside the universe and inside this chat. The failures are in the edges of that scoping, and they cost exactly the beats this story is about:
- The player's whispered question to Burcu, and the envelope line to Sami, reach the bystanders' fast reads as if spoken aloud (whisperSplit reads the natural `*action* "speech"` form backwards).
- A quiet character is told he "heard every line" of an aside held at the window.
- Two ways of cutting arcs silently drop a character's memory of a scene: a mid-turn arrival note, and a "different" split that leaves one-line spans. Burak loses his own coffee question, and Sami loses the cash request and the envelope handover.
- The rumour answer judge grades the wrong line, then spends the question.
- The shipped memory-builder examples are written with this user's actual cast (Burcu/Emre sex, 14-year-old Nil smelling of Emre's cologne).

Relationship reads get the right pair and the right memories. But every bond starts at 0 on every axis, including familiarity for childhood friends, which contradicts the FOUNDATION paragraph sitting next to the numbers.

About the three harness observations:
- **(b)** Confirmed. The cause is different from what the INDEX says (see #6).
- **(c)** Confirmed, and it is a general mechanism: Sami lost his T13 memory the same way (see #3).
- **(a)** The code path is confirmed: a listener's charged OBSERVATION is not protected from the part-of-day reconcile, and the reconcile drops `charge`, `listener` and the OBSERVATION type. But **in this run Duygu had only one fragment, so she was not reconciled, and Gossip 0630 did fire from her memory.** What did get merged was Burcu's listener fragment (see #7).

---

### 1. [High] A /whisper written as `*action* "speech"` leaks the spoken words to everyone, and the target's memory records them as "(aloud)"
- Engine(s): Short-term, Memory (arc) · <character> (and every castHistory consumer)
- Evidence:
  - `short-term/0096.md` (Sami) and `0099.md` (Berker), T5, contain the player's whispered question to Burcu as an ordinary line: `### [user] (Emre)` / `"Bu akşam Burak nöbette mi?"`
  - `short-term/0896.md` and `0911.md` (Berker), barbecue: `"Cuma'yı bekleme, şimdi al. Ama bu son."`. This is the envelope handed to Sami under /whisper.
  - `memory-arc/0101.md` (Burcu): `Emre: (whispered to Burcu Atan alone) Masanın altından dizine hafifçe dokunuyorum.` / `(aloud) "Bu akşam Burak nöbette mi?"`. Burcu's own whispered reply is labelled the same way: `(aloud) "Gece vardiyasında. Ama burada olmaz Emre, herkes bakıyor."`
- Why it hurts: Sami and Berker's fast reads react to Emre asking another man's wife whether her husband is away tonight, and to "take it now, but this is the last time". This is exactly the secret the whisper was meant to keep, and it shapes the "What you feel right now" note that goes to the actor. Burcu's memory builder is told the question and her answer were said out loud in front of the table, so she will remember a public exchange, not a private one.
- Root cause: `whisperSplit` treats the FIRST `*asterisk span*` as the aside and everything else as public (the v50.1 design). The player, the auto-RP narrator and the model all write whispers the standard way: action in asterisks, then speech in quotes. `whisperOpenPart`, `memHeardText` and `recentExchangeFor` then hand the "open" part (the speech) to everyone in earshot.
- Fix: in `whisperSplit`, if the public remainder is only quoted speech (with or without trailing punctuation), fold it into the aside. Only a remainder that contains its own narration (e.g. `*…* Sonra herkese dönüp gülümsüyorum.`) should be public. Apply the same rule to a character's whisper reply before `memHeardText` labels it "(aloud)".

### 2. [High] The shipped memory-builder examples use this universe's real people, including a sexual scene and a 14-year-old
- Engine(s): Memory (arc) · <character> (83 calls), Memory (text), Memory reconcile
- Evidence: `memory-arc/0037.md` (Burcu's own memory payload), the EXAMPLES block:
  `❌ content: "Burcu and Emre had sexual relations in his kitchen and she chose to stay…"`
  `✅ content: "Nil's hair and clothes smelled of Emre's cologne and his house… My hands wouldn't stop shaking."`
  `✅ content: "Told Burak everything this morning. He didn't shout, just asked 'Neden?'…"`
  The examples also cast Duygu, Ayça, Hakan and "Emre Tokmak" (gym flirting). `memory-reconcile/0264.md`'s worked example is a debt quarrel with `"people":["Emre"]`.
- Why it hurts: the block claims these are "format demonstrations from other households", but in this universe they are the actual cast: Burcu is Burak's wife, and Nil is Duygu's 14-year-old daughter (per Duygu's sheet in `gossip/0630.md`). When the model writes Burcu's memory it is shown "Burcu and Emre had sex in his kitchen" and "I told Burak everything". When it writes Duygu's, it is shown her daughter coming home smelling of Emre. These are invented events about the people it is writing for, and they can bleed into what gets stored. The reconcile example hands a money quarrel with "Emre" to a story whose main thread is Emre lending Sami money. This costs about 3k characters per call.
- Root cause: `DEFAULT_MEMBUILD` hard-codes these names (it is kept current for every user by `_refreshPipe("memBuild",…)`). The `memReconcile` default's worked example hard-codes `"people":["Emre"]`.
- Fix: rewrite the examples with neutral invented names and places that appear in no shipped or imported universe, and make the child example about an adult. Better still, add a guard that swaps any example name that collides with the current cast or the player's name. Use a placeholder in the reconcile example instead of "Emre".

### 3. [High] A mid-turn arrival note plus the "fewer than 2 lines" rule silently deletes a character's memory of the scene (harness observation c)
- Engine(s): Memory (arc) · <character>
- Evidence:
  - Order of T16 (run.json): `user "Burak! Hayırdır…"`, then `Sami "Burak! Gel otur…"`, then `Narrator`, then `— Burak Atan geldi —`, then `Burak Atan "…Burcu söyledi, öğlen Vanadium'da oturmuşsunuz. Kahve ısmarlamışsın Emre"`.
  - The commit for that arc is `memory-arc/0416.md` (Sami) and `0418.md` (Berker), which both contain Burak's coffee line. There is no Burak call. His next memories (`0435`, `0466`) start at T17/T18, so his own raising of the coffee is gone.
  - Same thing at T13. The order is `Sami`, `Berker`, `Narrator`, `— Sami Özüçak geldi —`, `Sami "Bak, Cuma getireceğin parayı nakit getir…"`: Sami was re-"arrived" by his character-quest overture even though he had walked in with Emre. The T13 commit at T14 has only `memory-arc/0334.md` (Berker) and no Sami call, so his first private request for cash is not in his memory.
- Why it hurts: the character who drove the beat is the one who does not remember it. Burak's diary, daily reads and later scenes know only that Emre "explained"; they do not know that he asked. Meanwhile `memDoneIdx` moves past these lines, so they are never offered again.
- Root cause: in `commitMemoryArc`, `aStart` is the last presence note that `noteMarksArrival` finds in the span, and lines before it are dropped for that character. `if(heard.length<2) continue;` then skips them without a record. The note lands after the lines that addressed (or were spoken by) the arriving character because `runSceneWriter` ("bring_in":"Burak Atan", 0388) and the overture `playCharacterTurn(...,"arriving")` add presence only after the first reply of the turn. The Gamemaster event (0357) had already narrated Burak at the door, but `R.gm.present` shows he was not added.
- Fix:
  - In `commitMemoryArc`, ignore an arrival note for a character who already spoke earlier in the span. For a real mid-turn arrival, start their cut at that turn's player line.
  - When `heard` has exactly one line and it is the character's own, prepend the line it answered instead of skipping.
  - Separately, a "character" GM event should put the participant into presence when its narration puts them in the room.

### 4. [High] The envelope handover (T29 whisper, then a retry) was cut into two one-line arcs, and no character remembers it
- Engine(s): Memory arc tracker, Memory (arc) · <character>, and downstream Memory reconcile / Daily relationship / Chronicle
- Evidence:
  - `memory-arc-tracker/0894.md` returns `"finished","different","Emre hands Sami the envelope"`, and a new arc starts at the whisper line.
  - After the Retry, `0910.md` sees the same arc and says `"different"` again. There are no Memory (arc) calls in F-mangal-retry or T30 (`0928.md`).
  - Sami's day-2 memories (`memory-reconcile/0999.md`: köfte, toast, list) and `daily-relationship/1045.md` contain no envelope. Neither does `universe-chronicle/1078.md`'s evidence (the stub's own output does mention it). Only the player's memory has it.
- Why it hurts: the central secret of day 2 (Emre paid early, in cash, behind Berker's back) is absent from Sami's memory, diary and daily read. Tomorrow Sami will still act as if Friday's money is owed.
- Root cause: in `_maybeBuildMemoryLocked`, when the tracker answers "different", `newStart` is the last user line after `oldStart`. If there is none (the arc began at the player line), it falls back to `arcEnd`, which splits the player's line from its reply. The retried reply then forms a span of its own. Both spans have one line per character and are dropped by `heard.length<2` in `commitMemoryArc`, while `memDoneIdx` advances.
- Fix: when no user line exists after `oldStart`, handle "different" as "finished" and commit through `arcEnd`. Never close a span that ends between a player line and the reply to it. Don't advance `memDoneIdx` past lines that produced no memory for anyone except the player.

### 5. [High] A silent listener is told he "heard every line", including an aside held out of his earshot. The spoken-only filter removes the cue that says so
- Engine(s): Memory (arc) · <character> (listener variant)
- Evidence:
  - `memory-arc/0354.md` (Berker, listener view of T14): `Sami Özüçak: "Bak, Cuma getireceğin parayı nakit getir, olur mu? Havale olmasın. Buket bu ay hesap dökümüne bakıyor…"` Sami's own version (`0352`) carries `*Berker tepsiyi bırakmaya gidince Emre'yi pencerenin önüne çekip sesini alçaltıyor.*`, which Berker's copy loses.
  - `0371.md`: `Berker Özüçak did not take part: … was within earshot, heard every line above and said nothing.` It is followed by the window promise.
- Why it hurts: the builder is told as fact that Berker overheard the cash-behind-Buket deal. A real model will store "Sami asked Emre for cash so Buket won't see it" in Berker's memory (the stub happened to write "something was agreed without me"). That memory then feeds his diary, his daily read of Sami and his future replies.
- Root cause: `memHeardText` gives another character's line through `spokenOnly` (narrPrivacy "spoken"), so the stage direction that marks the aside is stripped. `present[]` is area-level earshot. The listener suffix in `commitMemoryArc` then asserts "heard every line above".
- Fix: for memory views use `perceivedOnly` (keep `*narration*`, still drop `_thoughts_`), so the model can see who stepped away or lowered their voice. Word the listener line as "was nearby and caught what a person there could plausibly catch; anything visibly said aside or under the breath they only saw, not heard".

### 6. [High] The rumour answer judge graded Emre's greeting to Buket and Özlem, spent the pending answer, and the real exchange with Burak was never judged (harness observation b)
- Engine(s): Rumor judge (answer), with Rumor judge (raise) never firing
- Evidence: `rumor-judge-answer/0673.md` (T21, Burak absent):
  `## The text to judge` / `Emre answers:` / `*Sepeti alıp reyonlar arasında Buket'le Özlem'i görünce yanlarına gidiyorum.* "Günaydın hanımlar!"`
  At T24 (`memory-arc/0783.md`) Burak asks outright (`"Emre, Duygu Hanım bir şey demiş Hakan'a: … bir şey fısıldamışsın"`) and at T25 Emre answers. Neither a raise call nor an answer call follows.
- Why it hurts: the matter is settled on the page (Burak apologises) but the ledger stays "raised" and unresolved. The verdict could as easily have been "believed" (an evasion) for a line that has nothing to do with the rumour. The judge is never told what was asked, by whom, or whether the asker is present.
- Root cause:
  - `maybeSpawnConfrontation` (End Day 1, `stage("confront")`) sets `g.raisedBy[stakeholder]=day` and `g._awaitAnswer=true` the moment it spawns the event, before Burak has said anything. 0645 shows the confrontation payload; the scene writer then resolved it without a player answer.
  - `settleRumors` (called on every player line from the send path) judges any pending rumour against the next player line, in any scene. It does not check who is present, and it clears `_awaitAnswer` whatever happens.
  - At T24, `noteRumorRaise` is blocked by `gossipCanRaise` (the cooldown of 2 days started at spawn). The INDEX blames the similarity gate, but I computed Burak's T24 line at 0.29 against the rumour, which is above the 0.12 gate.
- Fix:
  - Set `_awaitAnswer` only when the stakeholder's line actually raises it (in `noteRumorRaise`, or when the confrontation's opening line is posted), not at spawn.
  - In `settleRumors`, require the stakeholder to be in `inSceneIds(chat)` and to have spoken since the previous player line, and put their question in the judge's text.
  - Clear `_awaitAnswer` when the event resolves or is abandoned without an answer.

### 7. [Medium] The part-of-day reconcile swallows listener OBSERVATIONs and strips their charge. It also never sees `feelings` or which fragment was overheard (harness observation a)
- Engine(s): Memory reconcile, and Gossip downstream
- Evidence: `memory-reconcile/0264.md` (Burcu) merges `FRAGMENT 2 … The men argued about who keeps the plant running.` (her listener memory from `memory-arc/0060.md`) and `FRAGMENT 6` (listener, `0122`) into one first-person account ("I said…"). The FRAGMENT lines carry content only. The whisper fragment's `feelings` and the listener's charge are not shown. Duygu's 0.75-charged OBSERVATION (`0077`) survived only because it was her single fragment, which is why `gossip/0630.md` fired.
- Why it hurts: any listener who overhears two things in one part of the day loses the charge on both. The rebuilt record is typed EXPERIENCE by default with no `charge`, and `runGossipPropagation` keeps only `type==="OBSERVATION"` with `charge>=0.6`, so End-Day gossip has nothing to spread. Overheard lines come back as things the character said. The reconciler is asked for "feelings" but is shown none, so it invents them, or the code falls back to the first fragment's feelings.
- Root cause: `memsOfPeriod` excludes `observerOnly` (bystander gists) but not `m.listener`. `reconcilePeriodFor` builds FRAGMENT lines from `memText(m)` only, and the rebuilt object has no `charge`, `listener` or OBSERVATION handling.
- Fix: exclude `m.listener` in `memsOfPeriod`, as is already done for `observerOnly`. Alternatively, if they are kept, carry the maximum `charge` and force OBSERVATION when the merged fragments are all listener fragments. Add `(overheard)` and `— left with: <feelings>` to each FRAGMENT line.

### 8. [Medium] Code-written aftermath memories paste raw director text into a first-person memory, with the wrong place and even when nothing was said
- Engine(s): Daily relationship, Diary, Universe chronicle, and every memory consumer
- Evidence:
  - `daily-relationship/0622.md` and `diary/0618.md` (Sami): `I reached out to Emre about Sami Özüçak comes to Emre about their OWN pursuit "Buket'ten önce kartı kapat": You need Emre's money in cash… What they want from Emre: … Emre is free to agree, bargain, or refuse.` (the full text is in `gamemaster-event/0357.md`)
  - `the-day-around-you…/0690.md` and `universe-chronicle/1078.md` (Burak): `I confronted Emre about Did Emre lean in a bit too close to Burcu Atan at Vanadium Cafe? She did not move away.. It's still unsettled in my mind. [Site Market]`. The confrontation was spawned at Emre's House on the morning of day 2, the player never answered it, and Burak had not yet reached the market.
- Why it hurts: characters are handed a "memory" that is an actor instruction in the third and second person ("You need…", "Emre is free to agree"). Burak "remembers" a confrontation that did not happen, at a place he had not been, and the chronicler is invited to record it as fact.
- Root cause: `recordOvertureAftermath` and `recordConfrontationAftermath` interpolate `ev.intent` verbatim. For a character-quest overture that is the director brief built in the char-quest path ("`${holder.name} comes to ${U} about their OWN pursuit…`"); for a confrontation it is the rumour question. The record uses `chat.location` at resolution time, uses `state.user`, and sets no `gamePeriod`. `_evOutcome` already yields "unresolved" when no turn was judged, but a memory is still written.
- Fix: store a short first-person-ready gist on the event when it is created (for example `q.title` plus the ask; for a rumour, "what Duygu told Hakan about Emre and Burcu"). Stamp the event's own location, day and period. When `!ev._lastJudge`, write "I meant to raise … with Emre but it never came up", or nothing at all.

### 9. [Medium] Every relationship starts at 0 on all nine axes, so the daily and fast reads see "familiarity 0" for childhood friends and spouses
- Engine(s): Daily relationship, Short-term
- Evidence: `daily-relationship/0613.md` (Burak → Emre) opens with `FOUNDATION … childhood friend — You grew up on the same streets…`, followed by `- trust: 0 … - familiarity: 0`. `short-term/0760.md` (day 2) shows `Standing long-term sentiment … trust -1, affection 0, respect 0, familiarity 1`.
- Why it hurts: the system prompt says "Familiarity gates depth… if familiarity is low, cap how far the slow bonds move — strong feeling toward a near-stranger is projection". So a decades-old friendship or a marriage is told to move like an acquaintance's, and every later reader (hotPairsBlock, feelings blocks) sees near-zero bonds. The daily prompt also claims "You are given the ENTIRE day's interaction", but only memories are sent.
- Root cause: `blankRel` / `relObj` create every pair at 0. Nothing seeds the axes from `relSheetEntry(...).tie`. `evalRelationship` prints the raw numbers next to the FOUNDATION paragraph.
- Fix: on first creation, seed the slow axes from the tie (for example spouse or family: familiarity 70, affection 40; childhood friend: familiarity 60; neighbour: 25). At minimum, add "these numbers began at 0 when tracking started; take familiarity and baseline warmth from the FOUNDATION", and fix the "ENTIRE day's interaction" line in `DEFAULT_REL`.

### 10. [Medium] A text thread's closing exchange is never remembered (the "somewhere quieter" invitation)
- Engine(s): Memory arc tracker (text), Memory (text)
- Evidence: `memory-arc-tracker-text/0449.md` judges both exchanges (`(nothing tracked yet)`, `Emre: Belki bir gün yine kahve içeriz, bu sefer daha sakin bir yerde.` / `Burcu Atan: Belki… Ama dikkatli olalım`) and answers "different". `memory-text/0451.md` is built from the first exchange only (`Kahve için ben teşekkür ederim… / Aldım, teşekkürler 🙂`).
- Why it hurts: the one charged part of the thread (the proposal and Burcu's careful "maybe") is not in her memory, diary or daily read. The stub filled it in; a real model given 0451 cannot.
- Root cause: in `rememberTextExchange`, "different" commits `th.slice(arc.start,newStart)` and parks the rest as a new open arc, even when nothing was tracked before. `chat._textArc` is a transient key, and nothing flushes an open text arc at a period change or End Day.
- Fix: when `arc.summary` is empty, treat "different" as "finished" and commit everything. Flush open text arcs in the period and day-end flush alongside `flushMemoryArc`.

### 11. [Low] The fast read's "recent moment" crosses a day and two places with no marker
- Engine(s): Short-term
- Evidence: `short-term/0760.md` (Burak, market, day 2) shows, back to back, `*Kapıya doğru yürüyüp yemekhaneden çıkıyor.*` (canteen, day 1), then `"Tamam Emre."` (day-2 morning), then `"Burak! Günaydın, nöbetten mi çıktın?"`. It ends with "Based ONLY on the recent moment above".
- Why it hurts: yesterday's exit and a different scene are read as part of this moment, which blurs the body note the actor receives.
- Root cause: `recentExchangeFor` filters out `dayMarker` and has no scene cut (unlike `_maybeBuildMemoryLocked`, which stops at `travelBeat`).
- Fix: start the window after the last `travelBeat` or `dayMarker` that the character witnessed, or keep day markers as narration lines.

### 12. [Low] The gossip payload mixes a second-person tie sheet into a neutral referee prompt, and calls an overheard exchange "a glance"
- Engine(s): Gossip
- Evidence: `gossip/0630.md` opens with `You run the gossip…`, then under "Who the witness knows" it has `Emre (friend): … You have known him since you married into this circle…` and `Aslan… you notice the way he looks at your daughter`. It also says `What the witness saw (a vague glance, not a transcript)` and `no quotes … (the witness didn't hear it)`, while Duygu's memory (`0077`) says she "heard every line".
- Why it hurts: "you" switches from the referee to Duygu within one block. A listener who did hear the words is told to act as if she didn't, so the rumour is vaguer than what she actually knows.
- Root cause: `runGossipPropagation` passes `relSheetBlock(witness)`, which is written to the character, and the glance wording in the gossip template is fixed. The user's custom gossip prompt also carries a malformed contract (`]` followed by `[` and then `}`). That is the user's edit, not the default.
- Fix: introduce the ties block as "(written to Duygu as 'you')" or rewrite it in the third person. When `obs.listener` is set, replace the glance lines with "the witness heard this exchange; she may repeat what was said, slanted by her bias".

### 13. [Low] Diary input is thin: no time of day, no "left with" feelings, no who's who
- Engine(s): Diary
- Evidence: `diary/0615.md`: `- Emre texted to ask if I picked Aslan up… (felt: affectionate)`. Only the emotion token is passed, with no period and no feelings line. The voice block asks the writer to "record slights precisely: who didn't greet…" but it is never told that Burak is her husband or Aslan her son.
- Root cause: in `writeDayDiaries`, `memList` uses `memText`, location and `m.emotion` only.
- Fix: add `gamePeriod`, `memInjectText`'s feelings clause, and a one-line tie for each person named, taken from the character's own sheet.

### 14. [Low] Cost: static doctrine dominates the per-pair calls
- Engine(s): Daily relationship, Memory (arc)
- Evidence: `daily-relationship/0613.md` has 14.0k characters of system prompt against 4.3k of user content, repeated for all 28 pairs (about 390k characters of identical rules). `memory-arc/0037.md` has 8.4k of system prompt against 0.7k of content, over 83 calls, and about 3k of that is the example block from #2.
- Fix: batch a character's daily targets into one call (the rules once, one block per target). Trim the memory-builder examples once they are rewritten.

---
Checked and found sound:
- WHEN/WHERE stamps on arc, player, text and reconcile memories.
- Whispers addressed to others are dropped.
- Other characters' `_thoughts_` are stripped in every memory view.
- Daily-relationship pairs follow who witnessed whom (Burak → Burcu is correctly absent: they never shared a scene).
- The chronicle is universe- and chat-scoped and read only by director and quest engines.
- Day transition narration: 6 lines, adequate, though it lacks the place.

Stub responses (canned contents, `people` lists, repeated "left with" lines) were not judged.
