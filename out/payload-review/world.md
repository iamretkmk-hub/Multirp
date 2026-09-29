# World engines: payload review

Engines covered: Future tracker / reconcile / update, Task writer, Meetings tracker, Promises & commitments, Wearing tracker, Tracker (Pregnancy), Gamemaster judge / event, Scene writer setup / advance, Overture judge, World pulse (goal pursuit / offstage / calendar executor), The day around you, Intent form / tick, Contemplate, Goals curator, Char quest spawn / reconcile, Travel narration, Character move, Latent NPCs.

**Overall.** The prompts themselves are careful. The contracts are clear, the language rules are explicit, and "the answer decides" is applied consistently. Most of the damage comes from what the code puts under those prompts, in four ways:

1. **State that should have been taken back or closed is still there.**
   - A Retry keeps the task and the status changes made from the discarded reply.
   - Character quests never close, because the reconciler cannot see who did what.
   - The goals curator mixes up days.
2. **Text written for one reader is shown to another.**
   - Records written in the second person ("You will bring Sami the money") are shown to engines where "you" means someone else.
   - Emre's promises are labelled as words *Sami* is bound by.
   - Two memory templates splice a stage direction or a rumour-question into a first-person memory. That broken memory then travels to about 8 engines.
3. **Facts are missing from the line windows.**
   - Whispers are not labelled.
   - Windows run across day and place boundaries without a marker.
   - Speaker names are ASCII slugs ("Sami_Ozucak") while the same prompts demand EXACT names.
4. **The director is told to "aim tension" at fertility trackers for five women.** One of them is a 14-year-old.

On cost:
- The per-turn Future tracker (~4.5k chars) is acceptable.
- The Wearing tracker is well gated.
- The Pregnancy trackers are not: 41 calls, about 127k chars, for an event that cannot happen in this session.
- The GM judge is the heaviest per-turn engine: 17 calls, about 463k chars.

---

### 1. [High] Retry does not take back a TASK, or a status change, made from the discarded reply, and the new reply is briefed with the discarded content
- **Engine(s):** Future tracker, Task writer, Roleplay reply (retry), Promises & commitments
- **Evidence:**
  - `payloads/future-tracker/0136.md` shows the original Berker line: *"Pazartesiye yetiştiririm. Ama bu sefer listeyi ben çıkarıyorsam, toplantıda da benim adım geçsin"*. `payloads/task-writer/0139.md` files it with the desc *"…you said yes on one condition: this time your name goes on it in the meeting, not Sami's."*
  - After Retry, the new Berker line has no condition (*"Redüktör yedekleri, pazartesi sabah masanda…"*, #145). Yet `payloads/future-tracker/0149.md` still lists `[cq_mun6jny25qo] TASK: Berker Özüçak → Emre: Redüktör yedek parça listesi`.
  - The regenerated reply itself (`payloads/roleplay-reply/0145.md`) is told in `<pursuit_status>`: *"…and you said yes on one condition: this time your name goes on it in the meeting, not Sami's."*
  - The same wording is then fed to 16 later Berker replies, the goals curator (#644), Future update (#992, #1034) and Future reconcile (#269, #1001).
  - F-mangal Retry: #892 ends the money promise and #898 marks it "kept", both from the discarded Sami line. The retried reply #903 is briefed `kept: … (Emre handed Sami the money early…)`. Nothing is re-judged.
- **Why it hurts:**
  - Retry is how the player rejects a reply. Its agreements and conditions should go with it.
  - Here the rejected content is written into the character's own card, and into every later payload, as a fact the character "said".
  - If the retried reply had refused, the task or the "kept" status would still stand.
- **Root cause:**
  - `_ftStampChanges` stamps `ftMid`/`ftNew` only when `v.kind!=="task"`.
  - `_retryRollbackPlans` removes only *new* calendar entries and promises carrying `ftMid`.
  - Status changes (a promise set to kept, broken, ended or updated, a meeting moved) keep no undo record at all.
  - So `retryLastReply` → `_retryRollback` cannot restore them.
- **Fix:**
  - Stamp tasks too (`charQuests` and `gameData.quests` with `source:"task"`), and remove them in `_retryRollbackPlans`.
  - In `_ftStampChanges`, save the pre-change snapshot (`before.get(id).obj`) under `ftUndo:{mid, prev}` when a changed entry already existed. `_retryRollbackPlans` then restores it when `mid` matches.
  - This covers `runPromiseEngine` status updates and `runFutureUpdate`.
- **On the harness observation** ("each Retry resent the Future tracker call and re-reported an agreement already on record"):
  - **The resend is confirmed, and expected.** #149 re-reads the same 6-line window with the new line #6, and #909 does the same. That is about 4.3k chars per Retry, and it is justified because the line changed.
  - **I could not confirm a re-report in these payloads.** Both retry passes returned `{"items":[]}`.
  - **The real defect is the reverse of a re-report.** The entry created from the discarded line is still on record: it is the first line of `ALREADY ON RECORD` in #149. So the retried line is judged against its predecessor's agreement, and the model is told "Never report one of those as new". Any difference in the new line (a changed condition, or a refusal) can only arrive as an "update" or "ended" that the model has little reason to emit.

### 2. [High] The director is told to "aim tension" at fertility-mechanic trackers of five women, one of them 14, as if they were secrets
- **Engine(s):** Gamemaster: judge (17), Gamemaster: event, Scene writer: setup / advance (7)
- **Evidence:** `payloads/gamemaster-judge/0711.md` (and every GM/scene-writer payload):
  ```
  [ Pregnancy (Nil Akbaba): 0/280 — ⚠️  YOU ARE A FERTILE WOMAN. IF EMRE COMES INSIDE YOU IT MAY LEAD TO A CHILD ⚠️ ] [private — only Nil Akbaba knows this]
  …
  Anything marked [private] is a secret its owner is keeping. Aim tension at it — …
  ```
  The same payload's roster describes Nil as *"a sparkling, effervescent fourteen-year-old"*.
- **Why it hurts:**
  - A game mechanic at value 0 is presented to the director as each woman's personal secret, and the director is told to steer drama toward it.
  - That pushes the GM toward sexual storylines with every woman on the estate, including a minor.
  - Separately, it spends about 1k chars on every director call.
- **Root cause:**
  - `trackerContext(chat, null)` (the director branch) pushes every character-owned tracker, with its owner-voiced stage text and `[private — only X knows this]`.
  - It then appends the fixed "Aim tension at it" line, whatever the tracker is, whatever its value, and whether or not it has reached a stage.
- **Fix:**
  - In the director view, skip trackers still at their baseline value, or with method `trigger_then_day` that have not triggered.
  - Show a neutral third-person description instead of the owner's second-person stage text.
  - Say "private" without "a secret … aim tension at it".
  - Refuse, or warn in the editor, when a sexual or pregnancy tracker is owned by a character whose card gives an age under 18.
  - Separately, the user's universe data contains a Pregnancy tracker owned by Nil Akbaba (14). It should be removed.

### 3. [High] Overture and confrontation aftermath memories splice a stage direction or a rumour-question into a first-person memory, and it spreads to about 8 engines
- **Engine(s):** stored by the Overture / Scene writer path; read by GM judge, World pulse (goal pursuit, offstage), Char quest spawn, Goals curator, Character move, The day around you
- **Evidence:**
  - `payloads/world-pulse-goal-pursuit/0663.md` (Sami's memory): *"I reached out to Emre about Sami Özüçak comes to Emre about their OWN pursuit "Buket'ten önce kartı kapat": You need Emre's money in cash…"*
  - `payloads/the-day-around-you-whole-cast-round/1059.md` (Burak): *"I confronted Emre about Did Emre lean in a bit too close to Burcu Atan at Vanadium Cafe? At the Site Market…"*
  - The same text appears in #711, #594, #730, #830 and #1074.
- **Why it hurts:**
  - The character's memory of the key moment is unreadable. It mixes a third-person stage direction ("Emre is free to agree, bargain, or refuse"), a "you" addressed to Sami, and a question pasted as the object of "about".
  - Every engine that reasons from memories receives the character's own stage directions as something he lived.
- **Root cause:**
  - `recordOvertureAftermath` and `recordConfrontationAftermath` build `I reached out to ${state.user} about ${ev.intent}` and `I confronted ${state.user} about ${ev.intent}`.
  - For a quest approach, `ev.intent` is the long instruction built in the character-quest approach code (`"${holder.name} comes to ${U} about their OWN pursuit …"`).
  - For a rumour confrontation, `ev.intent` is the rumour phrased as a question.
  - Both functions also use `state.user` rather than `chatUserName(chat)`.
- **Fix:**
  - Carry a separate short `ev.gist` on the event, for example `asked ${U} to ${q.ask}` for a quest approach and `the talk that ${rumour-as-statement}` for a confrontation.
  - Build the memory from the gist.
  - Use `chatUserName(chat)`.

### 4. [Medium-High] Whispers reach the engines unlabelled, so the director and the trackers read private asides as said to the whole table
- **Engine(s):** Gamemaster: judge / event, Scene writer, Future tracker, Promises & commitments, Tracker
- **Evidence:**
  - `payloads/gamemaster-judge/0893.md`: `Emre: *Ona bir zarf gösterip avucuna sıkıştırıyorum.* "Cuma'yı bekleme, şimdi al. Ama bu son."`. This line was `/whisper Sami` (run.json T29), and Berker was at the table.
  - `payloads/gamemaster-judge/0075.md`: `Emre: *Masanın altından dizine hafifçe dokunuyorum.* "Bu akşam Burak nöbette mi?"`. This was a whisper to Burcu, with Sami and Berker present.
  - The same unlabelled lines appear in `future-tracker/0074.md` and `promises-commitments/0898.md`.
- **Why it hurts:**
  - The GM prompt's first trigger case is "a character is hiding something from another person nearby".
  - Without the label, it cannot know that Berker did *not* see the envelope. It will stage beats that assume everyone heard, and miss the obvious dramatic irony.
  - The secret-keeping promise engine likewise cannot tell a secret said aloud from one whispered.
- **Root cause:** `recentExchangeMsgs` and `_exchangeMsgMap` map only `role/name/content` and drop `m.whisperTo`. `recentSceneMsgsFor` knows the field, but the global windows ignore it.
- **Fix:** In both mappers, prefix whispered lines with `(whispered to <name> — nobody else heard)`, and do the same for a character's whisper back.

### 5. [Medium] Second-person records are shown to the wrong reader: Emre's promises become "words Sami is bound by"
- **Engine(s):** World pulse (goal pursuit, offstage), The day around you, GM judge, Scene writer, Character move
- **Evidence:**
  - `payloads/world-pulse-goal-pursuit/0663.md`:
    ```
    WORDS Sami Özüçak IS BOUND BY (… never choose a move that breaks one …):
    - Emre to Sami Özüçak: You will bring Sami the money on Friday, and Buket will not hear of it from you.
    ```
  - `world-pulse-offstage-interaction/0730.md` shows the same under "WORDS THESE TWO ARE BOUND BY" for Burcu and Sami, although Burcu has no part in the promise.
  - `gamemaster-judge/0989.md`: `HOW THE PRESENT CHARACTERS FEEL: Sami Özüçak → Emre: You feel lucky to have him…`
  - `character-move/0830.md` (a third-person narrator prompt): `HOW SAMI ÖZÜÇAK FEELS ABOUT EMRE RIGHT NOW: You feel lucky… What is actually running in you as you open your mouth…`
- **Why it hurts:**
  - The goal-pursuit model is told Sami must not break a promise that is Emre's.
  - The text "You will bring Sami the money", placed in Sami's slot, reads as Sami bringing himself money.
  - The director and narrator read "you" as themselves.
- **Root cause:**
  - `promiseContextForNames` matches `holderName` **or** `toName` and prints `pr.promise`. The promise purge (`runPromisePurge`) rewrites every promise into the second person addressed to the holder.
  - The goal-pursuit, offstage and whole-cast callers label the result "bound by".
  - `relOverview` prints `relDescription` (written to the "from" character) in the director payload.
- **Fix:**
  - Have `promiseContextForNames` return two groups: "given BY X" and "given TO X (X expects it kept)".
  - Render each entry with a third-person lead-in: `Emre promised Sami: "<text>" (written to Emre as 'you')`.
  - In `relOverview` and the character-move feelings line, prefix `(in X's own words, "you" = X)`, or convert to the third person.

### 6. [Medium] The character-quest reconciler cannot tell who did what, so Sami's cash ask never closes and the goals curator says "no real answer yet" after the money was handed over
- **Engine(s):** Char quest reconcile (7 calls, all returning `[]`), Goals curator
- **Evidence:**
  - `payloads/char-quest-reconcile/1002.md`: `MEMORIES FORMED IN THAT PART OF THE DAY (all characters …): - I played tennis with Özlem … - At Emre's barbecue I took the tongs … - We arrived at Emre's barbecue …`. There is no owner on any line, no player memory, and no transcript.
  - `payloads/goals-curator/1074.md` (end of day 2): `ACTIVE, involving Emre: You need Emre's money in cash … They have already asked and have no real answer yet.` Yet the same day the promise ledger recorded "kept — Emre handed Sami the money early, in cash".
  - STATE.md still lists `Sami Özüçak — Buket'ten önce kartı kapat — active`.
- **Why it hurts:**
  - Each "I" could be any of several people.
  - The player's side, which is where a delivered ask is answered, is absent.
  - The fulfilled pursuit stays open, so Sami keeps pursuing money he already has, and the curator keeps "Clear the credit card…" as a live goal.
- **Root cause:**
  - `reconcileCharQuestsForDay` pushes `memInjectText(m)` with no `m.character` prefix, reads only `state.memory` (not `chat.playerMem`), and does not consult the promise ledger.
  - `_curateGoalsFor` renders `awaitingUser` as "no real answer yet".
- **Fix:**
  - Prefix each line with `<owner>:`.
  - Add the stretch's `chat.playerMem` lines as `Emre:`.
  - Include any promise between the quest's holder and target with its status.
  - Optionally pass the stretch transcript, as `runFutureReconcile` does.

### 7. [Medium] The goals curator at the end of day 2 is shown day-1 memories as "today", and today's barbecue as "yesterday"
- **Engine(s):** Goals curator (12 calls)
- **Evidence:** `payloads/goals-curator/1074.md`:
  ```
  Character: Sami Özüçak. End of day 2.
  WHAT THEY ALREADY DID … - Barbecue at Emre's place — with Berker Özüçak (yesterday, Evening, Emre's House)
  WHAT THEY LIVED TODAY:  - Emre walked onto the patio of Vanadium Cafe …   (day 1)
  ```
- **Why it hurts:**
  - The curator is told to close wants that today settled. It sees yesterday's asks as today's and today's barbecue as older.
  - So it keeps stale wants (and would drop fresh ones) on the wrong basis.
- **Root cause:**
  - `_curateGoalsFor` calls `_ownerDayMemories(p, day, uid, {lookback:1})` and prints the result under "TODAY" without day labels.
  - `settledEventLines` computes relative days from `c.gameDay`, which is already day 3 when the day-end pass runs.
- **Fix:**
  - Label the lookback lines with their day ("Yesterday:" and "Today:"), or drop `lookback`.
  - Pass `day` into `settledEventLines` and use it instead of `c.gameDay`.

### 8. [Medium] Director windows run across day and place changes with no marker, so the scene writer advances a new event on yesterday's lines
- **Engine(s):** Scene writer: advance, Gamemaster: judge / event
- **Evidence:**
  - `payloads/scene-writer-advance/0641.md`: the context says `CURRENT SCENE: Day 2, Morning, at Emre's House … Emre is in the Garden Gate Entrance` and `Event character: Burak Atan (approaching, NOT yet in the room)`. The "exchange above" is 12 lines from the Day-1 Isdemir canteen (Sami and Berker joking, "Tamam beyler, benim için gün bitti") plus the travel line and "Uzun bir gündü."
  - The captured (stub) narration then continued the canteen scene. Its output and Burak's "Tamam Emre." were posted into the Day-2 home chat and show up in `gamemaster-judge/0711.md`'s exchange.
  - `gamemaster-judge/0711.md`: the market exchange opens with Berker's goodbye at the plant, the drive home and the terrace, with no separators.
- **Why it hurts:**
  - The writer is told to "advance the event based on the exchange above". That exchange is a different day and place, with people who are no longer present.
  - Continuity breaks follow: characters who left speak, and scenes get the wrong room.
  - The staleness judge scores a mixed stretch.
- **Root cause:** `recentExchangeMsgs(chat, DIRECTOR_RECENT_TURNS)` filters out `dayMarker` and `worldEvent` and takes the last 12 lines, whatever the day or location.
- **Fix:**
  - Cut the director window at the last `dayMarker` or location change.
  - Or insert a one-line separator in place of the filtered marker (`— later: Day 2 Morning, Emre's House —`).

### 9. [Medium] Speaker labels are ASCII slugs while the same prompts demand EXACT names, and a slug holder silently drops a task
- **Engine(s):** Future tracker, Task writer, Meetings tracker, Promises, Tracker, GM, Scene writer, Future reconcile / update
- **Evidence:**
  - `payloads/task-writer/0139.md`: `THE PEOPLE: … Berker Özüçak …`, but `THE LINES: Berker_Ozucak: *Derin bir nefes alıp…*`. The prompt demands `"holder": the EXACT name`.
  - `future-reconcile/0821.md` has `Ozlem_Ozucak:` and `Buket_Ozucak:`.
- **Why it hurts:**
  - A model that echoes the speaker label returns `"Berker_Ozucak"`. In `runTaskExtract`, `byName` compares the full name, then the first whitespace token (`"berker_ozucak"` vs `"berker"`), so the match fails and the agreed task is dropped with no trace.
  - Every other engine sees two spellings of each person.
- **Root cause:**
  - `_exchangeMsgMap` and `recentExchangeMsgs` apply `sanitizeName`, which exists for the API `name` field, and the text builders (`_ftConvoText`, `recentExchangeText`, the tracker line numbering) reuse that value in content.
  - `sanitizeName` ASCII-folds the name and replaces spaces with `_`.
- **Fix:**
  - Keep a `display` name (the raw `m.speaker` or the player name) alongside the sanitized one, and use it in every text rendering.
  - Also make `byName` in `runTaskExtract` normalise `_` to a space and fold diacritics.

### 10. [Medium] Sliding windows re-show lines that were already judged, without marking them, causing repeated updates and dice re-rolls
- **Engine(s):** Future tracker → Future update; Tracker
- **Evidence:**
  - `payloads/future-tracker/0988.md` (T32) reports `update cq_mun6jny25qo … line 5`. `future-tracker/1027.md` (T33) reports the same update from the same Berker line (now #2).
  - Future update runs twice with the same change (`future-update/0992.md` and `future-update/1034.md`, identical output).
  - `tracker/0032.md` (T2) still contains T1's lines, so each tracker sees each line in 2–3 consecutive calls.
- **Why it hurts:**
  - It causes duplicate writer calls and risks re-applying edits.
  - It is worse for `trigger_then_day` trackers. After a missed dice roll the value is unchanged, so `alreadyActive` is false. While the triggering lines stay in the 6-line window, the model says `triggered:true` again and the app rolls again. The author's odds are roughly tripled, and a second "didn't take" narrator beat is posted.
  - This is latent in this run, since nothing triggered, but the window overlap is visible.
- **Root cause:**
  - `runFutureTracker` numbers the last `ENGINE_RECENT_TURNS` lines with no indication of which lines were already read.
  - `runTrackerEngine` sends `recentExchangeMsgs(chat,6)` every turn and keeps no memory of the lines it has already evaluated.
- **Fix:**
  - Store the last evaluated `mid` per chat (per tracker for trackers).
  - Label older lines "(already read — context only)", or send only new lines plus two lines of context.
  - For triggers, ignore a `triggered` whose settling line is at or before the stored `mid`.

### 11. [Medium] Pregnancy trackers: 41 calls and about 127k chars with no way to fire, run in triplicate and for people in another area
- **Engine(s):** Tracker · Pregnancy · (Özlem 20, Burcu 8, Duygu 7, Buket 6)
- **Evidence:**
  - Each call is about 3.1k chars: a 1.5k system prompt, a 6-line window, and the trigger phrase ("…ejaculated inside vagina…").
  - At the market, #685, #686 and #687 are byte-identical apart from the owner, sent in the same turn.
  - Duygu is evaluated there although the GM payload places her `ELSEWHERE IN Site Market (out of earshot) — Fountain Corner` (`gamemaster-judge/0711.md`).
  - Heat mode was off all session.
- **Why it hurts:** About 32k tokens are spent on a question whose answer is structurally "no" in a café or a canteen. It also crowds rate limits, since each call is foreground-independent but in the same burst.
- **Root cause:**
  - `runTrackerEngine` runs every non-endday tracker every turn for each owner in `presentCast`, which spans all sub-areas.
  - Unlike `runWearingTracker` (`hasClothingCue`) and the presence tracker, it has no cheap gate.
- **Fix:**
  - For `trigger_then_day` trackers, gate on a cue list (the Wearing tracker's pattern) or on Heat mode.
  - Evaluate only owners in the player's earshot area (`inSceneIds`).
  - Batch all trackers that share an exchange into one call returning an array.

### 12. [Medium] Offstage engines cap "ties" at 6 in roster order, dropping the closest relatives
- **Engine(s):** World pulse (goal pursuit), Char quest (spawn)
- **Evidence:**
  - `payloads/world-pulse-goal-pursuit/0663.md` (Sami): ties are Burak, Berker, Burcu, Hakan, Nil, Aslan. **Buket, his wife, is missing**, although his first goal is "Clear the credit card before Buket opens Tuesday's statement".
  - `char-quest-spawn/0594.md` (Sami): `Hakan, Duygu, Nil, Burak, Burcu, Aslan`. Neither his brother Berker nor Buket is listed.
- **Why it hurts:** The designer plans Sami's next move without his relationship to the person the plan is about. It will under-use or misjudge her.
- **Root cause:** The ties loops in the goal-pursuit pass (just before the `goalPursuit` epSend) and in the char-quest spawn pass (before `charQuestGen`) `break` at `ties.length>=6`, iterating `pool` / roster order.
- **Fix:**
  - Rank candidates before capping: family ties first, then people named in the character's goals or intents, then non-neutral rel rows.
  - Or raise the cap to the cast size. It is only about 80 chars per line.

### 13. [Low-Medium] Contemplate's "leverage" is filled with author notes, including the holder's own weak spots, and no memories
- **Engine(s):** Contemplate
- **Evidence:** `payloads/contemplate/1067.md`:
  ```
  WHAT THEY KNOW / HOLD over or about the target: Berker Özüçak's own pressure points: … wound him by calling his care control; threaten to expose that he may never stop saving Sami …
  ```
  The payload contains no memory of what Berker actually witnessed.
- **Why it hurts:**
  - The planner is told Berker "holds" his own vulnerabilities as leverage.
  - The real leverage (he overheard Sami ask Emre for money and hide it from Buket) is absent, so the model must invent or guess it.
- **Root cause:** `contemplatePlan` builds `leverageBits` only from `holder.interject` and `targetPersona.interject`.
- **Fix:**
  - Replace the holder's own `interject` with his recent memories that mention the target (reuse the `recent` builder from the goal pursuit).
  - Keep the target's pressure points, labelled "what is known of <target>'s weak spots".

### 14. [Low-Medium] The Wearing tracker (and other "mc" classifiers) runs at temperature 0.8 and 1000 tokens by default
- **Engine(s):** Wearing tracker. The same applies to Presence tracker, Turn router and Memory query generator, outside my area.
- **Evidence:** `payloads/wearing-tracker/0025.md` header: `fn mc · temp 0.8 · max_tokens 1000`. The code asks for `fnTemp("mc",0.1)` and `fnTok("mc",220)`.
- **Why it hurts:** A state tracker whose normal answer is `{"changed":[]}` is sampled hot. That makes spurious outfit changes likelier, and those persist until the next place or hour.
- **Root cause:**
  - The shipping default `fnCfg: {… "mc": {"temp": 0.8, "tok": 1000} …}` in the state initialiser overrides every `mc` call's own fallback in `fnTemp`/`fnTok`.
  - The roleplay reply does not use `mc` (it has fn `null`), so the 0.8 serves no engine that wants it.
- **Fix:** Set the default `mc` to `{temp:null, tok:null}`, so each call's own fallback (0.1, 0, 220) applies.

### 15. [Low] Smaller contract, cost and state issues
- **Task writer: language contradiction.** The prompt says `"title": … in the story language`, then the appended `engineLangDirective` says "ALL of your output … English (this OVERRIDES every other language instruction)". Titles land in Turkish inside English records (`[cq_…] TASK: … Redüktör yedek parça listesi`). *Fix:* use `mixedLangDirective(["title"])` in `runTaskExtract`, as the goal pursuit does.
- **Meetings tracker: discarded TASKS section.** About 2.3k chars of the prompt (#211) ask for TASKS, but `runCalendarEngine` discards `parsed.tasks` when `fromTracker`, which is the only caller path now. *Fix:* strip that section when `fromTracker`.
- **GM judge cost.** The judge costs about 27k chars every other turn (463k in total). Its three largest blocks are:
  - WHO PEOPLE ARE TO EACH OTHER (3.5k): all 10 people in both directions.
  - WHO IS WHERE (3.1–3.5k): full offstage bios.
  - Cast memories (3–5k).

  The judge's output is `stale/trigger`. *Fix:* in `directorContext(chat,"gm")` for the judge, send the social graph only for the present cast plus the offstage people with a non-neutral tie, one direction per pair. Leave the full sheet to the Gamemaster event call.
- **NPCs left behind all day.** Burak shows `at Emre's House` during Day 2 Midday, while Emre is at the market (#711), after the morning event at the house. He then shows `at Site Market` through the whole evening (#852–#989). *Root cause:* `resolveWorldPositions` re-applies `chat.leftBehind` for every period of the day. *Fix:* expire `leftBehind` after one period, and never leave a non-resident in the player's home.
- **Calendar executor duplicates "why".** The "why" is printed twice (`world-pulse-calendar-executor/0631.md`: "You mean to see the card statement… · You mean to see the card statement…"), because `origin` already embeds `detail`.

---

**Not reported (stub artefacts):** duplicate lines in the windows (the same Sami line twice, #357 and #541); repeated offstage headlines ("Hakan took Nil to the Aqua Park" ×4); and memories like "I was there when Under the table Emre…". These all come from canned stub responses, not from how the requests are built.
