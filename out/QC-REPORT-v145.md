# StoryMind QC report #2: v145.0

**Build audited:** v145.0 (`995aaf8`, `main`). `index.html` is 50,741 lines.
**Date:** 2026-09-29.
**Previous report:** `out/QC-REPORT.md`, the v144.0 audit. Its §8 lists what v145 fixed.

**Method:**
- Six subsystem audits in parallel. Each did three things:
  - checked that every first-audit fix is real;
  - searched the v145 changes (≈3,950 lines added, ≈1,670 removed) for regressions;
  - looked for what the first audit missed.
- An end-to-end play test with a stubbed model:
  - 51 player turns over 3 in-game days, in two universes, about 1,000 model calls per run;
  - one clean run, then runs with 10% failures, 5% malformed JSON and random latency;
  - invariants checked after every phase.
- The full test suite: **106/106 pass**.

Findings I re-checked myself against the source (and, where marked, by running the code) carry a ✔.

---

## 1. Executive summary

**v145 largely did what it said.** Of about 95 first-audit items across the six areas, about 80 verify as fixed.

What now holds up under test:
- End Day runs once per day, and it resumes after a reload.
- The turn lock never stuck in a 12-turn stress run with failures and Stop.
- The prompt-pack import cannot touch your API keys or endpoints.
- Backup restore is truly atomic.
- Retrieval quality measurably improved: on-topic hits went 4 vs 2 and 3 vs 1 on the same bank.
- Players and characters no longer learn about quests from engine notes.
- No page errors in about 3,000 simulated model calls.

**But the fixes introduced or exposed new problems.** Of 9 High issues, 4 are regressions or incomplete fixes from v145, and the other 5 are older bugs found this time:

| # | Sev | Problem | Kind |
|---|---|---|---|
| 1 | High ✔ | **The relationship-delta guard misreads large changes.** One value past ±60 makes the whole answer count as absolute levels. A betrayal (trust −70) drops all six axes by 25, including ones the model left at 0. A trust change of −65 against a current −80 comes out as **+15**. (`relDeltasFrom`) | Regression |
| 2 | High ✔ | **Media saves still bypass the load gate.** `_gmPersistSoon` calls `putAll` directly, so one new picture after a failed gallery load (or from a read-only second tab) erases the stored gallery. That is the original #14 bug through a second path. | Incomplete fix |
| 3 | High | **Stored XSS through fields that are normally numbers.** These are inserted into HTML raw: message status day, map marker positions, tracker min/max (and suspected: story-state values, stage thresholds, calendar probability). An imported roleplay or universe file runs script, which can read every API key. | Incomplete fix |
| 4 | High ✔ | **End Day blames the player for tonight's meeting.** The confirm dialog says a meeting "moves to tomorrow", but a meeting in the *current* part of the day (Evening dinner, day ended at Evening or Night) is recorded as unkept. Every participant gets "they never came". The summary and the roll-forward use `>=` vs `>`. | Regression |
| 5 | High ✔ | **In-person quest asks still need confrontations on.** `checkCharQuestApproach` no longer checks the toggle, but it fires through `startOverture`, which exits when `confrontOn===false`. The GM keeps being told a character is "poised to come". | Incomplete fix |
| 6 | High | **With Heat on, every one-on-one scene counts as "private" for good.** Heat writes `heatBeat` lines on every turn (heatN=5), and `_heatLive` treats those tags as a live heat scene. So GM arrivals never happen, which was the original complaint. | Incomplete fix |
| 7 | High | **Switching universe mid-turn still leaks into the old chat's turn:**<br>- the world setting comes from `curUniverseObj()`;<br>- places are resolved through `curLocations()`, so a character in another area became hearable;<br>- **the other story's player name** (`state.user` changes on universe entry) gets stamped as the reply's `toName` and written into the old chat's day ledger. | Incomplete fix (#9) |
| 8 | High | **The Scene Writer pulls a same-named character from another universe into an event.** Its participant lookup isn't universe-scoped. The end-to-end run found "Ayla" from universe 2 as the event participant, the speaker, and in `presentIds` of a universe-1 chat. | Pre-existing, found this time |
| 9 | High | **A whisper's secret leaks into a non-recipient's "drives & brakes" prompt**, unmarked. `_writePsyche` reads `recentExchangeMsgs`, not the new per-listener `recentExchangeFor`. | Pre-existing, missed by the v145 privacy pass |

**Recurring themes:**
1. **Reads of the open chat, universe or player remain** in background code: `curUniverseObj`, `curLocations`, `curWorldSetting`, `state.user`, `curCast()` with no argument. This is now the largest single source of wrong-world bugs.
2. **The per-listener perception filter is not applied everywhere.** Missed: the psyche writer, location gossip, unclosed `_thought_` spans, and different areas of the same place (a character in the back room still "hears" the counter).
3. **Newly added features are half-connected.**
   - **Stop** doesn't end a multi-character chain, and can abort your *next* send.
   - **Retry** can answer twice, leaves the discarded reply's memory, promises and relationship moves in place, and never commits the new one.
   - **Resume** re-runs the stage it was interrupted in, so diaries and relationship moves happen twice.
4. **Heuristics were overcorrected.** The intimacy regex got worse at detecting explicit scenes: it now misses 38 of 49, up from 29. The promise dedupe now lets true restatements pile up. Lapse rules close things the player is actively pursuing.

### Scorecard (v144 → v145)

| System | v144 | v145 | Why |
|---|---|---|---|
| Roleplay core | B- | **B** | Lock, shared generator, Scene Writer and presence cost all verified. Universe leak, Stop and Retry gaps remain. |
| Memory | B- | **B** | Perception, locks, clamps and retrieval verified. Partial-retry and condenser-slot issues remain. |
| Relationships | C+ | **C+** | Sheet merge and neglect fixed, but the new delta guard is a High regression. |
| Living world | C+ | **B-** | End Day, stamps, stale snapshots and placement verified. Resume duplication and period-engine ordering are new. |
| Intentions | C+ | **B-** | Privacy lock, filtering and spend-on-fire verified. `prep_done` and latent-plan blocking are left. |
| Calendar | C | **C+** | Outcome vocabulary, parser and scoping verified. End Day current-period regression, dedupe regressions, silent lapse. |
| Promises | C | **C+** | The Berk/Nil bug is fixed. New dedupe regressions and the 21-day lapse on secrets. |
| Quests | C+ | **B-** | Cost caps, recovery and universe fixes verified. Lapse starvation and unlimited arc retry remain. |
| Gamemaster / privacy | B- | **C+** | Cadence and supersede fixed, but private-moment detection is worse in both directions. |
| Text messaging | C+ | **B** | Queue, arrival and proactive tick verified in end-to-end play. |
| Persistence / infra | B- | **B** | Checked writes, atomic restore, semaphore and breaker verified. `_gmPersistSoon` gap and the three-tab lock issue. |
| Security | D | **C** | String escaping is solid and the key-takeover path is closed. Numeric-field XSS remains. |
| Tests | B | **B+** | 106 scripts, CI wired, 295 new checks. Still no concurrency or real-network Stop tests. |

---

## 2. Fix verification (first-audit items)

| Area | Verified | Incomplete / regressed |
|---|---|---|
| Roleplay core | #1 Gamemaster reaction crash, reply-builder drift, Scene Writer JSON, solo vs multi routing, typewriter wait, presence cues, `_exitedIds`, rescue timeout, POV rail, asterisk parsing, language directives, router names | **#9 chat/universe switch** (bubbles and presence are safe; the universe-level reads above are not). **Retry** and **Stop** (see §4.1). **#5 send lock**: two gaps (`runWatchTurn`, Stop leak). |
| Living world + intents | #6 End Day double run, ended-day stamps, `memsOfPeriod`, name lookup, stale snapshots, goal-pursuit cost, per-period placement, gossip scoping/pruning/wording, privacy lock on armed plans, latent/removed filtering, spend-on-fire, rumour text, 2 motives, hand-made drives, calendar-executor retry | **Reload resume** (re-runs the interrupted stage). **`prep_done`** (still opens on the next turn). |
| Calendar + promises + texts | #10 outcomes, #11 `_textArc`, #12 Berk/Nil, next-morning prompts, DND blame, counterpart-present, date parser, offset clamps, universe scoping, roster checks, 3-day cutoff, Set time/place, FURTHER OFF line, `attendPlan`, `_textArrive`, Turkish strings, promise cap, purge flag, text queue, proactive tick | **End Day with a meeting in the current period** (High). **Unkept memories before the future reconcile** (order unchanged, patched by a heuristic). |
| Quests + GM | #15 cost ceiling, #9 `questMarkDone({uni})`, hidden-cast judging, 12 memories + wider evidence, failed outcome, arc retry, edit/delete chain, `questNamesChar`, quest notes hidden, NPC duplication, arc names, history cap, gate edit, language contract, booleans, GM supersede, cadence, banners, rule warnings, director notes, `questTravel` rollback | **In-person asks need `confrontOn`** (High). **Heat locks one-on-one scenes** (High). **Intimacy detector** recall worse. |
| Memory + relationships | #8 private leaks (memory, gist, fast read, query), build races, chat day/cast, diaries in latest, importance/type clamps, retrieval scoring, debounced saves, batched embeddings, sheet merge, per-chat daily read, neglect from presence, settle-call removal, outcomes from conviction, judge gating, banner | **#13 condenser** (glimpses fill protected slots). **Arc lost on failure** (flush path still loses it; partial retry drops lines). **History-window rule** (reconciled memories lose `srcMids`; window ≠ castHistory). **Delta caps** (the guard misfires: High). |
| Infrastructure + security | #4 prompt-pack allowlist, embedding key origin, `pollVideo` bearer, checked writes, save signature, validated atomic restore, keys in export, snapshot skipping, `chatCompletion` hardening, semaphore release on timeout/abort, breaker lifts, boot fatal screen, `sw.js`, dead code, CI | **#3 XSS** (numeric fields). **#14 media gating** (`_gmPersistSoon`). **Tab lock** can leave every tab read-only. **fetchWithTimeout** coverage (4 raw fetches left). |

---

## 3. End-to-end play test

A harness played 51 turns across 3 in-game days with 5 characters (including the "Can"/"Canan" pair), 3 places and 2 universes. It covered:
- meetings and promises;
- a whisper, travel, text threads;
- the GM, Retry, Stop and double Enter;
- a chat switch mid-turn, a reload mid-End-Day and a reload mid-turn;
- two End Days.

The harness is at `/tmp/claude-0/qc2-e2e/harness.js`, with reproductions in `repro.js`.

| Invariant | Result |
|---|---|
| No page errors or unhandled rejections | **Held**: 0 across all runs, including 266 injected failures and 38 malformed answers. |
| Send lock released after every turn; double Enter refused, text kept in the box | **Held** |
| Chat switch mid-turn: no bubble drawn into the other chat; old chat's presence intact | **Held** |
| Old chat's turn uses its own universe and player | **Violated** (R3): the reply's `toName` and the day ledger carry the other universe's player name. |
| No character from another universe on stage | **Violated** (R1): the Scene Writer pulled `p2_ayla` from universe 2 into a universe-1 event. |
| Whispers never reach a non-recipient's prompts | **Violated** (R2): the psyche writer prompt for Can contained a whisper sent to Canan. |
| A reply lands where its speaker is | **Violated** (R4): a reply still generating when the player travelled landed in the new place, from a speaker who isn't there. |
| Exactly one day advance per End Day, and resume after a reload | **Held** (the beforeunload warning shows during End Day). |
| No duplicate memories | **Violated**: the world pulse writes near-identical "I spent time at home" memories every part of the day, 3–12 per run. A new cost of per-period placement. Also R5: Retry leaves the discarded reply's memory. |
| Retry commits the new reply to memory | **Violated** (R5): `memDoneIdx` is already past it, so it is never remembered. |
| Calendar entries sane | **Mostly held.** World-engine plans are filed without a period (they skip `_calSaneSlot`), and missed meetings stay open for good. |

**Cost per turn**, clean run with the stub:
- about 13 model calls per turn on average, 29 at most;
- End Day: 35–47 calls;
- about 5 s per turn with stub latency.

---

## 4. New findings by area

Severity: **H** high, **M** medium, **L** low. **R** marks a regression from v145, **P** an older bug. Function names are given, not line numbers.

### 4.1 Roleplay core
- **H/P (incomplete #9) Universe switch mid-turn.**
  - `buildCharPromptBlocks` reads the world setting from `curUniverseObj()`.
  - `inSceneIds`, `runPresenceTracker` and `syncPlayerSubArea` resolve places via `curLocations()`.
  - `state.user` changes on universe entry, so the turn stamps the wrong player (end-to-end R3).
  - Fix: `universeById(chat.universeId)` and a chat-scoped `locById`; freeze the player name when the turn starts.
- **M/R Stop doesn't end a multi-character chain.**
  - `playCharacterTurn` swallows the stopped error, so the chain continues.
  - Router 2 and the drives call keep running, you get three "Stopped." toasts, and `postTurn` runs.
- **M/R Stop leaks into the next turn.**
  - When the send button is already enabled (Autopilot, heat, GM reactions), `stopReply` refuses all roleplay calls for 1.5 s, so your next send is aborted.
  - The old 20 s timer is never cleared.
- **M/P Other areas of the same place hear the scene.**
  - `present` is stamped with everyone at the location, and `witnessedBy` ignores the area.
  - A character in the back room learns the "rob the bank" secret said at the counter.
- **M/R Retry can answer twice.** `_retryTarget` takes any last line: Autopilot, a GM reaction or a heat beat.
- **M/R Retry leaves side effects.**
  - The discarded reply's plans, promises and relationship moves stay.
  - The new reply is never analysed or remembered (R5).
- **M/R Retry isn't offered** after Stop, a refusal, an empty reply, or a failed multi-character reply.
- **M/P ✔ Unclosed `_thought_` leaks.** `spokenOnly`, `perceivedOnly` and `stripNarration` use `/_[^_]*_/`, which only removes closed spans.
- **M/P A reply generated during travel lands in the new place** (R4). Drop it, or tag it with the location where the turn started.
- **M-L/P `runWatchTurn` (video cues) bypasses the turn lock**, so two replies can run at once.
- **L:**
  - typing indicators out of order in chains;
  - refusal false positives on unquoted in-character lines ("I will not continue this conversation. Get out.");
  - Stop misread inside the repeat retry / refusal fallback;
  - the heat rails ("what is being done to you") contradict the new POV rail.

### 4.2 Living world and intents
- **M/R Resume re-runs the interrupted stage.**
  - In the diaries stage that means a second diary, every daily relationship evaluation again, and neglect drift again.
  - Fix: a per-owner/day idempotency check, or sub-stage progress.
- **M/R A second End Day while the first is still running files the next day's arc under the older day.**
  - The background lock (`dayEndBg`) queues the whole pipeline, including its stage-0 flush.
  - `pendingDayEnd` has one slot, which the second day end overwrites.
- **M/R Period engines run out of order.**
  - The day end reaches `runPeriodEngines` only at stage 8, after the new day's period runs have taken the lock.
  - The late tick hits motives born the next day: one was matured and armed on its birth day, and its `lastTick` was set backwards.
  - There is no coalescing: 7 fast travels queued 7 runs.
- **M/P Day-end passes still read the open chat or universe:**
  - `runNeglectDrift` and `runDailyRelationships` call `curCast()` with no argument;
  - `condenseDiaries` uses `state.curUniverse`;
  - `curWorldSetting`/`curLocations` are used by goal pursuit, the round, the executor and offstage interactions.
  - With another universe open, the relationship pass made 0 calls, and neglect created records for the wrong cast.
- **M/P `_memOfChat` scoping is incomplete.** `memsOfPeriod`/`reconcilePeriodFor`, `memoriesForDay` and `_ownerDayMemories` still mix in other chats' same-day memories. The reconciler can merge and delete another chat's fragments.
- **M/P ✔ The first-visit NPC seeder seeds the place being left.** `travelTo` calls it before `chat.locationId` changes. This bug dates from v19.91.
- **M/R The world pulse writes duplicate "I spent time at X" memories every part of the day.** This is new with per-period placement (see §3).
- **L-M:**
  - `prep_done` still opens on the first turn after the planting day;
  - a latent-holder armed plan blocks other plans for 3 turns, then is spent.
- **L:**
  - executor transport errors close plans as missed for good;
  - proactive text and neglect use the new day at day end;
  - "real ties first" in the round is a no-op;
  - resume edge cases (stale threshold, stage-0 flush skipped);
  - `_planIncludesUser` matches the player's name as a substring.

### 4.3 Calendar, promises and texts
- **H/R ✔ End Day and meetings in the current period** (summary above). The End Day summary also lists the player as a participant ("with Aria, Emre").
- **M/R The meeting dedupe files real duplicates.**
  - It runs after `_calSaneSlot` has filled a missing period, so a re-sent meeting with no period lands 2+ parts away.
  - The names branch requires the same period ("Have dinner together" Night vs "Dinner with Aria" Evening).
- **M/R Moved meetings keep `_rolledFrom`.** A meeting rescheduled in play, or one held back by DND two days running, lapses silently. Only the first roll posts a notice.
- **M/R "UNKEPT … it stung" reaches characters during the day-end window**, before planting rolls the meeting forward.
- **M/R Open promises lapse after 21 days even while kept.**
  - A kept secret or prohibition is never mentioned, so it lapses, and the character stops seeing "WHAT YOU SWORE".
  - Old saves have no `seenDay`, so every old promise lapses at once after the upgrade.
- **M/R-P `_prSame` problems:**
  - capitalised non-person words break matches ("the Ring" vs "the ring");
  - reordered phrasings don't match;
  - pronoun restatements don't match;
  - Turkish negative suffixes aren't detected, so "söyleyeceksin" (you will tell) and "söylemeyeceksin" (you won't tell) still merge.
- **M/P A certain "character comes to you" meeting marks the player a no-show instantly** when they're elsewhere, with no Go / Later / Skip. It is common, because home is the default place.
- **L:**
  - the parser reads counts as clock times ("about 20 guards" → Evening);
  - Turkish suffixes are still missed (akşama, sabaha, kahvaltıda, yarınki);
  - `ftAt` is stamped from the live clock;
  - `runPromiseEngine` uses `curCast()`;
  - unkept meetings stay open forever;
  - a cancelled task's note says "Quest failed";
  - world-engine plans are filed without a period.

### 4.4 Quests and Gamemaster
- **H/Incomplete ✔ In-person asks need `confrontOn`** (summary above).
- **H/Incomplete Heat on makes one-on-one scenes permanently private** (summary above). Also, the global `_heatBusy` leaks across chats.
- **M/R Private-moment detector ✔:**
  - Recall is worse: 38 of 49 explicit lines are missed ("They had sex", "Beni sikti", "Soyun.").
  - False positives remain: 20 of 36 ordinary lines, e.g. bayram hand-kissing, "chicken breasts", and Turkish swearing, which blocks confrontations during a shouting match.
  - The text is lowercased with `toLocaleLowerCase("tr")`, which turns English "I" into "ı", so "In bed…" / "Into bed…" and ALL-CAPS lines can never match.
- **M/R Lapse closes pursuits the player accepted.**
  - Asks with `awaitingUser:false` lapse 8 days after the last nudge, despite progress, and the holder gets a frustrated "went unanswered" memory.
  - Spawns (2 per run) outpace steps (2 per run). In a 24-day simulation, all 30 closed pursuits lapsed, and 9 had zero attempts.
- **M/R `_retryStalledArcs` has no limit**: one call per day for ever. There's no "End this arc" action, deleting the live quest re-designs a new one, and legacy arcs revive.
- **M/R A retry-created quest is judged the same day**, against evidence about the previous quest.
- **L:**
  - a spawn during a prune is lost (the array is replaced);
  - a false "couldn't write the next quest" toast;
  - a dropped GM beat burns the cadence window, and deleting messages fires the GM;
  - `findByName`'s 3-letter prefix rule still maps "Can"→"Canan" for spawn targets, and "Can you…" matches a character named Can;
  - quest editor edge cases.

### 4.5 Memory and relationships
- **H/R ✔ `relDeltasFrom` misfires** (summary above). Fix: only when the *echo* test agrees, convert every key; otherwise clamp just the out-of-range keys and apply the rest as deltas.
- **M/R The retry after a partly failed arc drops new lines.** A character whose memory already landed gets the grown span flagged as a duplicate (≥50% shared source mids), so they never remember what came after. Fix: retry only the characters who failed.
- **M/Incomplete The condenser counts glimpses it can never merge.** Observer-only, gossip, manual and superseded memories fill the protected newest-30 slots. In a probe, all 20 real experiences were merged into one LONGTERM. Glimpses also grow without bound.
- **M/Incomplete Reconciled memories drop `srcMids`.** After a period change the memory falls back to the period rule and is injected while the transcript still shows the same lines.
- **M/P Location gossip builds its prompt from raw content.** `runLocationGossipLeak` sends whispers and thoughts, plants them as OBSERVATIONs in every regular, and stores importance unclamped.
- **L-M:**
  - `memTranscriptMids` ≠ what `castHistory` keeps (scene cut, 2-day window, dropped lines), giving both gaps and double injection;
  - the people-facet fix is probably neutralised by the generated query naming the player;
  - day-end relationship passes read the open chat's cast (same as §4.2).
- **L:**
  - a queued build stamps its period when it starts, not when it was queued;
  - `memImpNorm` misreads 0–5 scales;
  - `MEM_ARC_MAX_FAILS` is off by one;
  - an accuser leaving before any judged turn records "rupture".

### 4.6 Infrastructure and security
- **H/Incomplete Numeric-field XSS** (summary above). Fix: coerce numbers at render (`+x||0`) or `esc(String(x))`, and normalise numeric fields on import.
- **H/Incomplete ✔ `_gmPersistSoon` bypasses the media gate** (summary above). Fix: route it through `persistImages`/`persistVideos`, or check `_canPersistMedia`.
- **M/R The tab lock can make every tab read-only.**
  - A read-only tab queues a lock request and keeps the lock after the writer closes, while staying read-only.
  - "Reload" never recovers once 3 tabs are involved.
  - Read-only tabs still write settings, prompts and keys.
- **M/R The breaker trips on 403** (OpenRouter moderation) with a "key invalid" toast, and pauses *user-started* calls too. Only the connection tests are marked foreground.
- **M-L/R `_vidThumbHTML` double-escapes URLs** (`escUrl(esc(url))`), which breaks signed thumbnails containing `&`.
- **L-M/R Write-failure counters are global.** Any successful write resets them, so the toast repeats every save and the stronger "export now" warning never fires.
- **L-M/R The import "safety snapshot" can be a no-op right after boot.** `_snapRev` is set at load, and the pagehide snapshot is gone.
- **L:**
  - raw message ids in `id="vid_${mid}"`; a hostile id throws at boot or sends `renderChat` into infinite recursion;
  - `sw.js` caches every `index.html?_b=` update check (3.8 MB each);
  - 4 raw `fetch` calls with no timeout (Atlas upload, TTS relay and audio, model list);
  - Playwright unpinned in CI;
  - docs still say v144 / `storymind-v404`.

---

## 5. What is now good (evidence-backed)

- **Robustness.** Zero page errors across three long end-to-end runs with injected failures. The send lock is sound. End Day is idempotent against double taps and against travelling past Night.
- **Privacy where the fix landed.** Memory build, bystander gist, fast read and query use per-listener text consistent with `castHistory`. Quest notes are player-only. Armed plans, confrontations and quest approaches respect the privacy lock.
- **Cost.** Goal pursuit is one call per character per day. Character quests take at most 2 steps and 2 spawns per stretch. Presence runs once per chain. Embeddings are batched with backoff.
- **Data safety.** Every write is checked. The chat "saved" signature is set only on success. Backup restore is atomic with a real settings rollback. The semaphore releases on timeout and abort.
- **Security.** String escaping is consistent (no double-escaped text for O'Neil, "Ace" or Şükrü). The prompt-pack allowlist and the key-origin rule hold. CI is correctly wired.
- **Retrieval.** In an A/B test on a 45-memory bank, on-topic top-4 hits rose (4 vs 2, 3 vs 1) and unembedded memories no longer take the top slot.

---

## 6. Recommended next batch (v146)

1. **Quick fixes (small, High value):**
   - `relDeltasFrom` rule;
   - `_gmPersistSoon` gate;
   - numeric-field escaping;
   - End Day `>=` predicate (and drop the player from the summary);
   - `startOverture` toggle bypass for quest asks;
   - `_heatLive` based on content, not tags;
   - `toLocaleLowerCase("tr")` only for the Turkish patterns;
   - `_writePsyche` → `recentExchangeFor`;
   - Scene Writer participant lookup universe-scoped;
   - underscore spans parsed like asterisks;
   - seeder after the location change;
   - `_vidThumbHTML` double escape.
2. **The "whose world is this" pass.** Thread `chat`/`universeId` through every remaining `curUniverseObj`, `curLocations`, `curWorldSetting`, `curCast()` and `state.user` read reachable from turns or day-end stages. Freeze the player name when the turn starts. Stamp `present` by earshot (`inSceneIds`), not by location.
3. **Finish the new features.**
   - Stop: end the chain, and scope the refusal to calls in flight.
   - Retry: target only replies to the player, roll back side effects, re-run the trackers and memory.
   - Resume: idempotent diaries and relationship moves.
   - Period engines: day-end engines first, and coalesce the queue.
4. **Retune the heuristics with fixture tables:**
   - intimacy (EN/TR, explicit + ordinary, all-caps);
   - `_prSame` (cast-based names, Turkish negation);
   - lapse rules (players' accepted asks; spawn vs step balance; secrets exempt; seed `seenDay` for old saves);
   - the meeting dedupe (the model's own period; exact-title same-day).
5. **Memory cleanup:**
   - partial-failure retry per character;
   - condenser counts only condensable memories;
   - reconcile keeps `srcMids`;
   - world-pulse whereabouts deduped per day.
6. **Infrastructure:**
   - tab-lock waiter reloads automatically;
   - breaker only on 401/402, with user calls marked foreground;
   - per-key write counters;
   - forced snapshot before an import;
   - `CSS.escape` for message-id selectors;
   - `sw.js` query stripping.
7. **Tests to add alongside each fix:** each audit's "test gaps" list, plus the end-to-end harness turned into a nightly CI job.

---

## 7. Test status

- **Full suite on v145.0:** 106/106 pass (698 s).
- **Audit runs:** every area's own suites pass (qc-*, calendar, future-tracker, world-round, memory-*, storage-safety, …).
- **Why the suite didn't catch these:** the tests were written with the fixes, so they pin the intended behaviour and miss the edges. Uncovered:
  - Stop through the real transport;
  - Retry after non-player lines;
  - End Day with a current-period meeting;
  - `relDeltasFrom` with a zero-filled answer;
  - `_gmPersistSoon` timing;
  - numeric-field XSS;
  - 3-tab locking;
  - universe switch mid-chain;
  - resume landing mid-stage.
- **Harness and probes:** in `/tmp/claude-0/qc2-*` (not committed).

---

## 8. Fix status (v147.0)

Everything in this report was addressed in the v146.1 batch, released as **v147.0**. The work was a groundwork commit, a universe-reset fix, and six area branches merged into `ccr-ee7705a9-15lcea`.

**Groundwork and user-reported issues:**
- **The hidden "Emre and Özlem Özüçak" character.**
  - *Cause:* the calendar binder passed a meeting's free-text `who` field (you plus Özlem) to `_createBoundEntity` as one name. It minted a latent stub, which the character list hid and every picker showed.
  - *Fix:* `splitNames` / `isPlayerName`. Meetings bind only to existing people, and a group or the player never becomes one person.
  - *Migration:* a load-time clean-up removes such stubs and re-points their plans at the real characters.
  - *Visibility:* undiscovered characters are now out of every picker, and appear in the character list as a greyed "Undiscovered" group that can be revealed or deleted.
- **"Reset universe" did not zero promises and other living-world state.**
  - *Cause:* the reset cleared a hand-kept list of fields and kept the transcript, so everything added since survived it.
  - *Fix:* the reset now deletes the universe's chats, taking every per-chat field with it, and clears its memories, rumours, play-made characters, generated relationships, quests and chronicle. It keeps authored content and offers "Save a copy first".
  - "Restart scene" now explains what carries over and offers the full reset.
  - Covered by `tests/universe-reset.browser.js`.
- **Shared helpers:**
  - `chatUni` / `chatLocations` / `chatLocById` / `chatUserName` / `chatWorldSetting` let background code read its own chat's world.
  - `findByName` needs a 4+ letter prefix covering 70% of the name, so "Can" no longer resolves to "Canan".

| Area | Status | Main changes |
|---|---|---|
| High #1 relationship deltas | Fixed | Only an "echo" answer is treated as levels. A big number is a big change, clamped, and 0 means unchanged. Betrayal gives trust −25; −65 against −80 gives −25. |
| High #2 media gate | Fixed | `_gmPersistSoon` goes through `persistImages`/`persistVideos`. A read-only tab refuses every storage write. |
| High #3 numeric XSS | Fixed | `numOr` at every numeric sink. Imports coerce numbers. Also fixed the diary reader's raw inline handler. |
| High #4 End Day meetings | Fixed | One rule (`_calRollsAtDayEnd`): a meeting in the current part of the day moves to tomorrow. The summary is honest and leaves out the player. |
| High #5 quest asks | Fixed | `startOverture({questAsk})` bypasses the confrontation toggle, and the staging summary is truthful. |
| High #6 heat locks scenes | Fixed | Heat is live only while a clip plays or the heat lines actually read as intimate. The busy flag is per chat. |
| High #7 universe switch | Fixed | The player is frozen when the turn starts. `inChatWorld` builds payloads in the chat's own world. Places and the setting are chat-scoped throughout the turn and day-end paths. |
| High #8 cross-universe participant | Fixed | The Scene Writer resolves only within the chat's cast. |
| High #9 whisper in psyche prompt | Fixed | `_writePsyche`, the memory query and text replies use per-listener text. Unclosed `_thoughts_` are parsed per line. `present` is stamped by earshot. |
| Roleplay: Stop, Retry, travel, watch turns | Fixed | Stop ends the chain and no longer leaks into the next turn. Retry targets only replies to the player, rolls back memories, plans, promises and the fast relationship read, and re-analyses the new reply. A reply is dropped if the place changed while it was written. The watch turn takes the lock. |
| Living world | Fixed (2 partial) | Idempotent resume. A per-day pending record, and the next day's arc is never filed under the old day. Ordered and coalesced period engines, with the tick never touching future motives. Day-end code is chat-scoped. Memories scoped per chat. The seeder targets the destination. One whereabouts memory per day and place. `prep_done` timing. Latent plans don't block. *Partial:* the day-end engine pass stays at stage 8, because motives need that day's gossip; `runFutureReconcile`'s late window is not bounded. |
| Calendar, promises, texts | Fixed | Dedupe on the model's own period. `_calFreshSlot`, and lapses are announced. UNKEPT held during the day-end window. Secrets never lapse, and old saves are seeded. `_prSame` rewritten (cast names, word order, pronouns, Turkish negation). "Go home now / Later / Skip". Parser fixes (128 phrasings). Group `who` split. |
| Quests, Gamemaster | Fixed | Intimacy detector: 71/72 explicit caught, 0/61 ordinary flagged. Lapse only while an ask is awaiting the player, with no blame. Spawns throttled. Arc retry limit and an "End this arc" button. No same-day judging. |
| Memory | Fixed (1 partial) | Per-character retry of a partly failed arc. The condenser counts only condensable memories, and glimpses have a cap. Reconcile keeps `srcMids`. Location gossip is built from public text. The history window matches `castHistory`. People facet fixed. *Partial:* a lone bare "4" still reads as 0.4. |
| Infrastructure | Fixed | The tab lock always ends with one writer. The breaker trips only on 401/402, and 29 player-started calls are marked foreground. Per-key write counters. A forced snapshot before imports. Escaped message ids and selectors. `sw.js` never caches query URLs. Every fetch is bounded. Playwright pinned in CI. Docs are current. |

**Tests:** six new suites (`qc2-*`, 276 checks) plus `universe-reset` (23 checks). Full suite on the merged build: **115/115 pass**.
