# StoryMind QC report #3: v147.0

**Build audited:** v147.0 (`d667390`, `main`), a frozen copy.

**Date:** 2026-09-29.

**Previous reports:** `QC-REPORT.md` (v144) and `QC-REPORT-v145.md` (v145; its §8 lists what v147 fixed).

**How it was done:**
- **Six subsystem audits** covered roleplay core, living world, calendar/promises/texts, quests/Gamemaster/hidden characters, memory/relationships, and infrastructure/security/reset. Each one:
  - checked the v147 fixes;
  - looked for regressions in the v147 changes (about 2,100 lines added, 770 removed);
  - looked for what both earlier audits missed.
- **An end-to-end play test** ran six full sessions of 56–58 turns each, in two universes with name near-collisions.
  - Three runs were clean. Three had 10% failures, 5% malformed JSON and random latency injected.
  - In total there were about 6,500 stubbed model calls, with invariants checked after every phase.
- **Test suite:** 115/115 pass on v147.0.

✔ = re-checked by hand. **[fixed]** = already hot-fixed on `ccr-ee7705a9-15lcea` in v147.1 (commit `8f84a35`). The hot-fixes are listed in §2.

---

## 1. Executive summary

### What v147 got right

v147 fixed its targets. **Every one of the nine High items from report #2 checks out as fixed or largely fixed.** The end-to-end runs confirmed a long list of things now behave:

- **Robustness:** zero page errors across roughly 6,500 calls, including 229–312 injected failures per failure run.
- **Locks:** always released.
- **End Day:**
  - moves the day exactly once, including double taps, two End Days back to back, and a reload with two days pending;
  - the resume is idempotent for diaries and relationships.
- **Retry and Stop:**
  - Retry rolls back the discarded reply's memories and records the new one;
  - Stop ends a chain and doesn't leak into the next turn.
- **Heat:** no longer silences the GM.
- **Universe scoping:** the Scene Writer is scoped to its universe, and the player's own whispers never reach the wrong character.
- **Hidden characters:** stay out of every picker.
- **The calendar and promise ledgers** stayed sane in every run.
- **The reset** is a real fresh start that leaves the other universe untouched.
- **Memory:** the history-window rule now matches what characters really see. That cut unremembered lines from 3–8 to 0–1 per character.
- **Retrieval:** unaffected or better (16/16 and 12/12 on-topic hits, and 6→10 hits when the query names the player).

### What went wrong

**The v147 changes also introduced four data-loss and security regressions.** All four are already hot-fixed:

1. **Name splitting broke Turkish names.** `splitNames` cut "Ümit", "Çile" and "Güve" apart at the "mit/ile/ve" inside the name. Meetings with them were dropped, and the binder minted a character called "Ü". Worse, the load-time clean-up ran on every load and could delete legitimate characters. **[fixed]**
2. **Retry wiped memories.** A Retry after a travel or a time-of-day change deleted the whole stretch's reconciled memory for good. **[fixed]**
3. **"Save a copy first" didn't protect anything.** The export swallowed its errors, so the reset went ahead even when no copy was saved. **[fixed]**
4. **A stored-XSS path remained** through a location's `travelPeriods` field. **[fixed]**

### Still open: High

| # | Sev | Problem | Where | Kind |
|---|---|---|---|---|
| 1 | High ✔ | **A character's private whisper reply reaches everyone in the room.** The reply is split with `whisperSplit`, which is the player's `/whisper` syntax, so only its first `*action*` counts as private. The spoken reply and the character's `_thought_` reach other characters: their replies, drives, fast read, text replies, memories, the bystander's gist and public location gossip. The play test saw this in every run. | `memHeardText`, `castHistory` whisper branch, `memHeardLine` | Pre-existing (v50.1), missed by earlier audits |
| 2 | High ✔ | **The per-period future reconcile judges the wrong lines.** A "stretch" runs from `ftStretch.start` to the *live* end of the transcript. So in a merged period run, the first call reads every line and later calls get one line. The prompt tells it to drop anything "never agreed", so real meetings, promises and tasks can be dropped. v147's queue merging and day-end reservation make this happen after every End Day followed by play, and on every fast travel. | `runFutureReconcile`, `_runPeriodEnginesNow` | Pre-existing mechanism, worsened by v147 |
| 3 | High | **Switching universe mid-turn is still not fully isolated** (report #2 High #7 is incomplete). The post-turn engines run after an `await` and outside `inChatWorld`, and they still read the *open* story's player and places. Affected: the memory builder (`commitMemoryArc`: "witnessed (with Mert)"), future tracker, calendar/task/promise writers, GM judge/event (the other universe's places), turn router, overture judge, short-term read, `settleRumors`, heat bursts and `memHeardLine`. The play test reproduced this in every run. | many; see §3.1 | Incomplete fix |

---

## 2. Already fixed in v147.1 (hot-fixes, commit `8f84a35`)

| Found as | Fix |
|---|---|
| Quests N3 (High): `splitNames` breaks Turkish names; the binder mints "Ü"; the clean-up deletes real characters; "Emre Yıldız" is taken for the player "Emre" | Joining words must stand alone (Unicode lookarounds) and only join *between* names. `isPlayerName` accepts an exact name, or a bare first name that no character shares. The clean-up runs **once**, only on untouched stubs, and only when every name in the stub is the player or a real person. Test: `names-retry-safety.browser.js`. |
| Memory N1 (High): Retry after a travel or period change wipes a stretch's memory | Reconciled and condensed memories only lose the retried line from their sources. Retry is refused once a travel beat or day marker follows the reply (this also covers Roleplay N2 for travel and End Day). |
| Infra N1 (High): "Save a copy first" resets even when the save fails | `exportRoleplay(uid,{forReset})` returns a real result. The reset stops if no file was produced, and a snapshot is taken either way. |
| Infra N2 (High): stored XSS through `travelPeriods` | `numOr` at the sink, and the field is coerced on import. |
| Infra N3 (Medium): a reply or day end finishing after a reset writes into the fresh universe | The reset is refused while any turn, day-end, period-engine or memory-build lock is held, and in a read-only tab. |
| Infra N4 (Medium): Save in the universe editor after a reset restores places and residents | The editor closes after a reset. |
| Infra N5 (Medium): the saved copy lacks rumours; the global open universe was swapped around an await | The copy includes the universe's rumour ledger and Import restores it. The export takes the universe as a parameter, and its `curChat` belongs to that universe. |
| Infra N10 (Low): the clean-up deleted "Kemal, the lifeguard" | Covered by the every-part-is-a-real-person rule. |

---

## 3. Open findings by area

Severity is H / M / L. **R** = regression in v147; **P** = pre-existing.

### 3.1 Roleplay core
- **H/R (incomplete #7): post-turn engines read the open story after an await.** Affected: `_maybeBuildMemoryLocked` / `commitMemoryArc`, `runCalendarEngine`, `runTaskExtract` (its `isMe` misfiles the player's own task), `runShortTermRel`, `settleRumors`, `maybeGamemaster`, `runSceneWriter`, `runHeatBursts`, and `directorContext` (`curLocations`). *Fix:* wrap post-turn and director work in `inChatWorld(chat,…)` wherever it is synchronous, or pass `chatUserName`/`chatLocations`/`up(key,uid)`.
- **M/R: `inChatWorld` does not scope `curChat()`.**
  - `memoryBlocks` / `_memLead` take "today" from the open chat, so yesterday reads as "last week".
  - `epMessages` builds engine template variables from `curChat()`, so with engine payload templates on, every templated engine gets the *open* chat's scene.
- **M/R: an arriving character's own line is left out of their history and memory.** Arrivals are placed at the entrance sub-area but stamped with the player's earshot, so they tend to greet again. *Fix:* always include the speaker in `present`.
- **M/R: Retry can answer twice, or silently lose the reply.** The rollback waits on the memBuild lock without holding the turn lock. A send, Autopilot or a second click lands in that gap.
- **M/R: Retry races the discarded reply's analysis** (short-term read, future tracker). Moves made after Retry was pressed stay, and an entry from the *new* reply can be stamped with the *old* id.
- **M/P: with Heat on in group scenes, Retry is never offered and heat bursts never run.** Beat 1 is tagged `heatBeat`.
- **M-L/R:**
  - Narrator beats (GM, Scene Writer, tracker, calendar, watch cue) are still stamped location-wide.
  - Stop during a single-character Retry loses the line with no notice.
- **L-M: refusal false positives on the "strong" verbs.** Examples: "I can't comply with your request, commander.", "I can't depict what happened that night."
- **L:**
  - `dropThoughtSpans` eats `^_^`, `__bold__` and trailing `name_`.
  - A reply dropped by the place check leaves no notice.
  - The heat headers still read "WHAT IS HAPPENING TO YOU".
  - Retry of a stopped router-2 line re-pins it to the player.

### 3.2 Living world and intents
- **H ✔ per-period future reconcile window** (see §1). *Fix:* record message-index bounds for each stretch (`ftBounds[day|period]`) when the clock moves, and slice exactly that range.
- **M/R: the future reconcile and calendar/promise engines use `state.user`** (part of the High #3 class). Observed: every player line labelled with the other universe's player.
- **M/R: the executor's catch treats every exception as a transient transport error.** That includes a 403 from moderation, other 4xx errors, a non-JSON 200 and our own bugs. A plan that always fails is paid for on every check and never gives up, and the first three stuck plans block every due plan behind them. *Fix:* only timeouts, network errors and 5xx are free; everything else counts toward `CALEXEC_TRIES`.
- **M/R: a latent holder's plan is still staged for the GM** (`armedStagingSummary`). The undiscovered character's name leaks to the GM, and the plan fires the moment they are revealed.
- **L-M/R: the day-end reservation starves the new day's period runs.** Those runs exist only in memory, so a tab kill loses them.
- **L-M/R: `_foldWhereabouts` merges separate events and back-dates them.** A morning breakfast and an evening talk with Canan become one "Morning" memory. It should fold only for the same companions and a similar line.
- **L:**
  - Some day-end passes still mix in other chats' same-day memories: char-quest reconcile, goal-pursuit "recent", `_pulseKnows`, the chronicler.
  - Seeded first-visit NPCs join with no presence note.
  - Three End Days back to back followed by a reload silently drop the oldest.
  - The saved stage lags one behind (a debounced save), so a finished stage can re-run.
  - `runCharQuestPursuit`'s memory is filed under the new day's Morning.

### 3.3 Calendar, promises and texts
- **M/P-R: the meeting dedupe drops a meeting with a different person.**
  - "Meet Aria at the cafe" drops "Meet Mara at the cafe".
  - v147's exact-title rule even drops "Coffee" with Mara in the Evening because of "Coffee" with Aria in the Morning, and "Training session" for other people.
  - *Fix:* when both sides resolve to distinct non-player people, they are never duplicates.
- **M/R: a no-period meeting with the same person on the same day is always treated as a duplicate.** `_ownPeriod` meets `pDiff`, which returns 0 for a missing period.
- **M/P: `_prSame` false merges lose a real second promise.**
  - Different objects with a shared name: "…about the money" vs "…about the baby".
  - Negations it misses: `cannot` / `wont` / `dont`, Turkish `-mAmAlI` and bare imperatives.
  - Possessives: "kardeşimi" vs "kardeşini".
  - Numbers: "pay 100 gold" vs "pay 500 gold".
  - It never compares the promise's recipient (`toId`).
- **M/R-P: text payloads.**
  - The memory query uses the in-person scene the texter never heard, and leaves out their own texts.
  - `targetName:state.user`, and the payload is built outside `inChatWorld`.
  - The proactive-text writer gets other characters' thoughts (`recentSceneMsgsFor`).
- **M/P: a live Scene Writer event blocks meeting resolution, so the player is logged as a no-show** even while sitting with the person. *Fix:* check "already together" first and exempt environment events.
- **L-M/R:** `arrangement` and `change` promises ("we are exclusive", "I quit drinking") still lapse at 21 days.
- **L:**
  - `_calFreshSlot` fires on unchanged values, undoing a "Later" and letting a meeting roll forever.
  - `_calRollsAtDayEnd` can resurrect an old missed meeting (DND, last-stretch edits).
  - Character-to-character meetings roll with a player notice.
  - Parser gaps: counts before "or"/"and" (e.g. "about 10 or 12 guards" read as a time), number words, dawn/sunset, "in 2 weeks".
  - `state.user` is still used in the calendar/promise/tracker prompt fills.
  - A Retry during the tracker can stamp the wrong id (suspected).

### 3.4 Quests, Gamemaster, hidden characters
- **M/R: the intimacy detector is overfit to its test fixture.**
  - On a fresh held-out set it catches 20/48 explicit lines.
  - Its idiom blanker erases real sentence-final lines ("Fuck me.", "He kept fucking her.").
  - Medical and fight scenes count as private (5/12 medical lines; a 4-line fist fight on a bed; a grief hug).
  - *Fix:* keep a held-out fixture, add medical and violence vetoes, and consider a small model judge.
- **M/P-R: an ask the player ignores never lapses.** `awaitingUser && nudges>=3` is unreachable because follow-ups need a reply, so the ask holds one of the holder's two slots forever. *Fix:* lapse on days since delivery.
- **M/R: "End this arc" loses to a quest generation already in flight.** The new quest is pushed into the ended arc. Arc-less "Quests" can't be ended.
- **M/R: undiscovered characters still leak:**
  - the character page offers **Text** for latent and removed characters, and `sendTextMessage` has no guard;
  - the GM staging line names an undiscovered gate character;
  - Story State shows trackers owned by an undiscovered character.
- **L:**
  - The calendar edit dialog re-points a task tied to an undiscovered figure.
  - The inbox badge counts hidden threads.
  - Lapse wording still reaches the holder's prompts.
  - `_heatSeq` and `_heatNoImg` are still global.
  - The orphaned-array race remains in `charQuestDeleteUI` and the tracker drop.
  - `_nameCapInText` rejects appositives ("Mira the smith…").
  - `editingPersona` survives a delete.
  - Duplicate character quests are spawned (no title dedupe) and step with identical memories (play test).

### 3.5 Memory and relationships
- **M/P (exposed by the earshot stamps): a silent listener in the same area gets a "did NOT hear this" gist** instead of a memory of what they heard. *Fix:* build a real memory for silent listeners within earshot.
- **M/P: the `relDeltasFrom` echo rule misfires on coincidences and misses two-axis level answers.**
  - After day 1 the levels equal the deltas, so a second betrayal comes out as *no change*.
  - The fast read's `{desire 30, comfort 42}` answer as levels still pins.
  - *Fix:* an axis signals "levels" only when its current value is beyond one step's cap.
- **M/P: retrieval returns nothing once another universe is opened mid-turn.** `visibleMemories` reads `curCast()` and `state.curUniverse`.
- **M/P: the day-end relationship-sheet rewrite** uses the open story's player and bio. It is flagged `foreground:true`, which bypasses the breaker, and reads opinions from `chatForUniverse`.
- **M/P: a message sent while a phone call's memory is being committed is lost.** `commitCallMemory` swaps `chat.messages`.
- **L:**
  - `memImpNorm` never rescales an answer of exactly "1" within a detected scale.
  - The player's name in the generated query still costs about 3 on-topic hits.
  - The `c>=0.9` rupture shortcut ignores whether the judge has run.
  - `relPeek` is used at only 1 of about 14 read-only sites.
  - Location gossip ignores area privacy.
  - `doneTo` positions shift after a message deletion.

### 3.6 Infrastructure, security, reset
- **M/P: after Import roleplay and a reload, the open universe and the open chat disagree.** `K.curUniverse` isn't persisted after it is set, so Settings → Reset universe would reset the wrong universe.
- **L-M/R: the reset doesn't fully restore the start:**
  - a revealed authored hidden character stays revealed;
  - a first-visit character the player gave an image to is deleted;
  - per-message media blobs are never pruned when chats are deleted;
  - the character list is stale after a reset.
- **L-M/P: after a reset, the fresh story starts nowhere, with nobody present.** It should place the player at their home.
- **L/R:**
  - Cancelled or wrong-file imports each take a forced snapshot, which can push real snapshots out of the 6 kept.
  - Reloading the writer tab reloads every read-only tab.
  - Several player-started generators are still background calls (quest arc, "write what follows", /seek, travel and day narration, suggestions, playground edit).
  - Two live-call streaming fetches have no ceiling.
- **Security:** apart from `travelPeriods` **[fixed]**, a whole-file template scan found no remaining unescaped string or number sinks. The new dialogs, the Undiscovered group, retry notices, the calendar/promise sections and the Video Book are all escaped.

---

## 4. Scorecard (v145 → v147)

| System | v145 | v147 | Why |
|---|---|---|---|
| Roleplay core | B | **B** | Locks, Stop and Retry are solid under stress. The universe-switch leak moved into the post-turn engines, and there are new Retry races. |
| Living world | B- | **B** | End Day is fully idempotent across reloads. The reconcile window and executor error handling are new weak spots. |
| Intentions | B- | **B** | Privacy lock and filters verified. The staging summary still leaks latent holders. |
| Calendar | C+ | **B-** | High #4 is fixed and the ledger stayed clean in every play run. Dedupe regressions remain. |
| Promises | C+ | **B-** | Secrets never lapse and old saves are seeded. `_prSame` still has false merges. |
| Quests | B- | **B** | Caps, retry limit and End this arc work. An ignored ask never lapses, and there is the in-flight race. |
| Gamemaster / privacy | C+ | **C+** | Heat no longer blocks the GM, but the intimacy regex is overfit and the whisper-reply leak (High) was found. |
| Memory | B | **B+** | The window rule is exact, the condenser is safe, and per-character retry is exact. Silent-listener gists remain. |
| Relationships | C+ | **B-** | The betrayal math is correct. Echo coincidences and the sheet rewrite's world scope remain. |
| Text messaging | B | **B-** | The queue is correct, but the payload leaks the other story and the wrong scene. |
| Persistence / infra | B | **B+** | The writer lock always ends with one writer, and read-only tabs are safe. Import/curUniverse drift remains. |
| Security | C | **B** | The only sink left (`travelPeriods`) is fixed. |
| Universe reset | — | **B-** | A real fresh start; its save and busy guards are now hot-fixed. Small gaps remain. |
| Tests | B+ | **A-** | 115 scripts plus the new hot-fix suites. The E2E harness catches cross-system bugs. |

---

## 5. Recommended next batch (v147.2 / v148)

1. **Privacy.** Whisper replies are private to the player. Everyone else gets nothing, or only explicitly public text. Also route `recentSceneMsgsFor` and every engine view through the per-listener text.
2. **The "whose world" pass, round 3.** Put the post-turn engines, director context and text payloads inside `inChatWorld` or on chat-scoped readers. `inChatWorld` also scopes `curChat()`, and `visibleMemories(chat)`.
3. **Future-reconcile stretch bounds** (`ftBounds`). Also: executor error classes, and persist waiting period runs.
4. **Retry hardening.** Hold the turn lock during the rollback, wait for or cancel the in-flight analysis, handle heat in group scenes, and refuse Retry after scene-writer beats.
5. **Calendar and promise dedupe.** Distinct people are never duplicates; handle no-period candidates; `_prSame` negation, numbers, possessives and recipient. Exempt `arrangement`/`change` from lapse. Resolve meetings before the event gate.
6. **Heuristics with held-out fixtures.** The intimacy detector (medical/violence vetoes, sentence-final forms), the echo rule, and lapse on days since delivery.
7. **Hidden characters and reset polish.** No Text button for latent characters; staging lines skip them; place the player at home on Day 1; refresh the character list after a reset; prune orphaned media.

---

## 6. Test status

- **v147.0:** 115/115.
- **v147.1 branch** (UI + hot-fixes): the new `scene-image-close` (12), `names-retry-safety` (10) and `universe-reset` (25) pass, together with the affected area suites.
- **Harnesses** are in `/tmp/claude-0/qc3-*` (not committed). The E2E harness is `/tmp/claude-0/qc3-e2e/harness.js`, with reproductions Q1–Q10 in `repro.js`.
