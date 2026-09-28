# StoryMind QC report: roleplay, background engines and the living world

**Build audited:** v144.0 (`ac5e0c9`) · `index.html` is 48,457 lines, 1,686 functions, one script  
**Date:** 2026-09-28  
**Method:**
- Read the code: six reviews in parallel, one per area.
- Loaded the app in headless Chromium: no page errors, about 10 MB heap, about 0.6 s to load.
- Ran all 100 test scripts: **100/100 pass, about 2,850 checks.**
- Re-checked the most serious findings by hand against the source, and ran the regex, parser and dedupe findings in node. These are marked ✔ below.

Line numbers refer to `index.html` at this commit.

---

## 1. Executive summary

StoryMind is ambitious and, in several places, very well built:
- Scene-aware history that tracks who witnessed what.
- Memory built one closed story arc at a time.
- World rules enforced in code.
- A boot path that refuses to save over data it failed to read.
- A test suite written from real bugs.

The comments are detailed, and most engines fail softly.

The weaknesses cluster into a few repeated patterns rather than one-off bugs:

1. **No turn or engine locks.** A second message, a second End Day, overlapping time-of-day engines, overlapping memory builds and overlapping texts can all run at the same time.
2. **Background jobs read the *currently open* chat or universe** instead of the one they started for. If you switch chats mid-turn, data lands in the wrong place.
3. **"Mark it done, then call the model, never undo."** A plan, intent or memory arc disappears whenever a model call fails.
4. **Things leak into places they shouldn't:**
   - whispers and private thoughts into other characters' memories;
   - hidden or removed characters into intent prompts;
   - quest announcements into character history;
   - confrontations into private scenes.
5. **Loose text matching:**
   - name lookups match on substrings ("Can" matches "Canan");
   - `\b` regexes miss Turkish words starting with ö, ç or ş;
   - the refusal detector flags ordinary dialogue;
   - `parseJSON` breaks valid JSON that contains curly quotes.
6. **Some ledgers and quest lists grow without limit**, and background model-call costs grow with them.
7. **Two real security holes:** the HTML-escape helper does not escape quotes (XSS risk via imported content), and prompt-pack import can rewrite API keys and endpoints.

Everything passing in the tests shows the regressions they cover stay fixed. The tests don't cover concurrency, failure paths, or whole subsystems (Gamemaster reactions, the armed-plan path, the quest chain). That is where most of the problems below are.

### Scorecard

| System | Grade | One-line verdict |
|---|---|---|
| Roleplay core (turn pipeline, multi-character, payload) | **B-** | Good scene and witness modelling. Undermined by a broken Gamemaster reaction, no send lock, and chat-switch corruption. |
| Memory | **B-** | Good arc design and failure-safe merging. Private content leaks in, and the condenser cascades. |
| Relationships | **C+** | Good axis model and saturation. No caps on deltas, ties get wiped, and neglect is triggered by mistake. |
| Living world (End Day, world round, gossip) | **C+** | Rich, with guards set before calls. End Day can run twice, and wrong day/period stamps break the gossip→motive link. |
| Intentions / motives | **C+** | Good lifecycle and cooling. Hidden and dead characters leak in, motives are lost on a failed surface, confrontations interrupt private scenes. |
| Calendar and meetings | **C** | Clever tracker. Cancelled meetings are shown as attended, false "stood up" memories, a weak date parser. |
| Promises | **C** | Good scoping. The dedupe drops different promises, and the ledger never expires. |
| Quests (story arcs and character quests) | **C+** | Conservative completion judge and good tooling. Quests can get stuck, character-quest cost has no ceiling, completion can be lost on a universe switch. |
| Gamemaster / world rules | **B-** | World rules really are enforced in code. The private-moment regex misfires and the reaction path is broken. |
| Text messaging | **C+** | Arrivals by text work. No send lock, and threads are re-remembered after every reload. |
| Persistence and infrastructure | **B-** | Excellent boot safety. Write failures ignored, media not gated, no multi-tab protection. |
| Security | **D** | XSS through attribute escaping, and prompt-pack import can take over keys. |
| Tests | **B** | 100 regression scripts, all green. No CI, no concurrency or failure-path tests. |

---

## 2. What is good

### Roleplay core
- **Scene- and witness-aware history** (`castHistory` 31645). It handles:
  - scene cuts and per-character arrival cuts;
  - a two-day window;
  - witness checks on narrator lines;
  - splitting whispers per listener.

  Other characters' lines are sent on the user side, which stops one character's voice bleeding into another.
- **Pinning who a line answers** (`answerTo` / `msg.toId`). The second speaker no longer answers a question meant for the player; `addressee.browser.js` covers this.
- **Cancellation tokens** (`_dirSeq` / `_heatSeq`). These drop stale Gamemaster reactions, heat beats and autopilot beats. Heat runs one at a time per tail message.
- **A hardened model-call layer** (`chatCompletion` 10208), used from 117 call sites:
  - a timeout on each attempt;
  - retries on 429 and 5xx;
  - a clear 402 message naming the provider;
  - recovery of replies that contain only thinking;
  - OpenRouter-only fields gated off for other providers.
- **Cost awareness.** The over-narration retry is off by default, repeated payload sections are removed, and retries are logged.

### Memory and relationships
- **Memory built per closed arc**, with the cast read from each message's own `present[]`. A character who arrives late gets only the part they were there for (43260–43281).
- **Failure-safe merging.** The reconciler swaps only after the new memories exist. The condenser deletes sources only when its output is usable.
- **Retrieval with an embedding fallback**, re-embedding of outdated vectors, and a detailed debug trace for every lookup.
- **Relationship model:** slow and fast axes, fast axes resist repeated pushes, and conviction for confrontations and overtures is bounded by evidence.

### Living world and intentions
- **Guards set before the model call** (`_roundAt`, `e.done`, `pulseTried`, `npcSeeded`), so overlapping pulses don't duplicate work.
- **The world round's partition is enforced in code.** An entry that places someone twice is dropped.
- **Intent lifecycle:** brewing → ready → armed → spent. Motives cool in code even when the tick call fails, and armed motives are never crowded out.
- **Offstage events are posted with nobody present.** Knowledge only spreads through planted memories, which is the right design for "who knows what".
- **Rumours have heat, cooldown and a stakeholder**, and paraphrases are folded together.

### Calendar, promises and texts
- **A two-stage future tracker.** It separates "planning" from "agreed" and folds turns that arrive mid-pass into one extra pass.
- **Relative day wording is computed in code** (`relWhen`), so the model never does date arithmetic.
- **The due-meeting check retries after a failure**, because its flag is released in `finally`.
- **Places are never invented** (`_matchKnownPlace`).

### Quests, Gamemaster and world rules
- **World rules are enforced in code** at nearly every movement point: placement, Gamemaster summons, travel companions, quest moves, confrontations.
- **The quest completion judge is conservative**: it reads only the quest cast's memories and only says "done" when it is clearly shown. The chain has a busy guard, and a quest can't be completed twice.
- **Character-quest rate limits are real code**: one approach and one text per day, at most 3 nudges, at least 2 days apart.
- **Good tooling**: a quest debugger with a trail, "force next" and JSON export, and editors for both quest kinds.

### Infrastructure
- **Boot safety** (`kvKeysStrict`, `collectionsSafe`, `canPersistCollections`). A failed IndexedDB read leaves the session read-only instead of saving over real data. Covered by `storage-safety.browser.js`.
- **No duplicate function definitions** among 1,686 names.
- **Chat bubble markdown escapes first, then adds tags.** The debug log escapes everything and redacts keys.
- **The chat renders a window of 120 messages** and appends new bubbles incrementally. Saves are debounced and skipped when nothing changed.

---

## 3. Top 15 problems to fix first

Ordered by impact relative to effort. ✔ means re-checked by hand.

| # | Sev | Problem | Where | Fix size |
|---|---|---|---|---|
| 1 | **High** ✔ | **Every Gamemaster reaction in a one-on-one scene crashes.** `const reply` is reassigned, so it throws a TypeError. The call is paid for, a "reaction failed" toast appears, and nothing is posted. | 43060 / 43065 | 1 line (`let`) |
| 2 | **High** ✔ | **`parseJSON` breaks valid JSON containing curly quotes.** It replaces “ ” with `"` *before* parsing. Memory, tracker, judge, suggestion and Scene Writer output that contains quoted speech is silently dropped. The Scene Writer then shows raw `{"narration":…}` to the player. Two reviews found this independently. | 37437 | Small: parse first, normalise only as a fallback |
| 3 | **High** ✔ | **XSS: `esc()` does not escape `"` or `'`**, yet it is used in 55 attributes and 16 inline `onclick` strings. An imported universe with `image:'x" onerror="…'` runs script that can read every API key. It also truncates plan titles like `Meet "Aria"` in the edit dialog. | 9610, 13841, 39794, 29597, 16895 | Small: add an `escAttr` |
| 4 | **High** ✔ | **Prompt-pack import writes *any* setting key**, including `key`, `embedUrl` and `ttsRelay`. Because the embedding call falls back to the OpenRouter key, a malicious pack can send your memories *and your OpenRouter key* to any URL. | 47473–47474, 44097–44109 | Small: allowlist |
| 5 | **High** ✔ | **Nothing stops a second send.** Enter calls `sendMessage()` even while a reply is generating, and there is no busy flag. Two solo turns run at once and answer from histories that each lack the other's reply. | 47654, 30160 | Small: per-chat `_turnBusy` |
| 6 | **High** ✔ | **End Day can run twice for the same day.** The confirm is followed by an awaited narration call, and only then does the day advance, with no in-flight guard. Result: duplicate diaries, double tracker ticks (a pregnancy counter gains 2), gossip decaying twice, and the intent tick running twice. | 37467–37541 | Small: `_endDayBusy` plus a done-for-day marker |
| 7 | **High** ✔ | **Ordinary dialogue is treated as a refusal.** "I'm sorry, but I can't stay tonight." matches, and so do "I can't help it" and "I'm not able to sleep". The reply is regenerated on the fallback model, or dropped when no fallback is set. | 10428–10441 | Small: anchor the check, ignore quoted speech |
| 8 | **High** ✔ | **Whispers and private thoughts leak into memory.** The arc builder's `convo` uses raw `m.content` for everyone in `present[]`. The fast read and bystander gist do the same. A whisper to Burcu becomes Ayla's memory or "play exactly this" note. | 43288, 18154–18166, 18477 | Medium: reuse `castHistory`'s per-listener view |
| 9 | **High** | **Switching chat or universe mid-turn corrupts the old chat.** `presentIds(chat)` filters against the *current* universe's cast and saves the result. The reply bubble is appended into the other chat's view. `questMarkDone`, `commitMemoryArc`, `rememberMemory` and Story mode also read the current chat or universe. | 28572, 33305, 40277, 43239, 43199, 32644 | Medium: pass the chat or universe through |
| 10 | **High** ✔ | **Cancelled or failed meetings are shown to characters as attended.** `_ftEntry.end` writes `e.cancelled` / `e.missed`, fields nothing ever reads. Every reader checks `e.outcome`, so a called-off dinner shows up under "These are done. You lived them" with a ✓. | 16420, 15875 | Small |
| 11 | **High** ✔ | **Text threads are re-remembered after every reload.** `chat._textArc` is not in `DURABLE_CHAT_KEYS`, so saving strips it and the whole thread is committed again as a new memory. | 30656–30689, 8752, 8800 | 1 line |
| 12 | **High** ✔ | **The promise dedupe drops different promises.** It needs only 60% word overlap and counts filler words, so "You will not talk to Berk" and "…to Nil" count as the same promise. | 15953 | Small: ignore stop words, compare names |
| 13 | **High** | **The memory condenser cascades.** Diary and long-term entries count toward the threshold and take the "newest 30" protected slots. After that, every arc commit starts a condense that pulls current-period and rumour memories into long-term, where the current-scene exclusion no longer applies. | 43691–43699 | Medium |
| 14 | **High** | **Media and scene saves are not gated by boot safety.** A blocked IndexedDB at boot gives an empty `state.images`. The next image then runs `putAll`, which **clears and rewrites** the store, erasing the gallery index and scenes. This is the same kind of bug the v109.1 fix closed for chats. | 9139–9168, 2966 | Small |
| 15 | **High** | **Character quests have no cost ceiling and never expire.** Each stalled pursuit costs one model call per time-of-day change, forever. Spawn is explicitly "NO CAP". | 41700–41853, 43533 | Small to medium |

---

## 4. Findings by system

### 4.1 Roleplay core
- **Broken Gamemaster reaction** (#1) and **no send lock** (#5), both above.
- **Chat switch mid-turn** (#9). The reply bubble is drawn into the wrong chat and the old chat's present list is pruned against the wrong cast.
- **Refusal false positives** (#7). The curly apostrophe `’` is not matched, so the behaviour also varies with the model's typography.
- **The three reply builders have drifted apart:** solo (30246), `playCharacterTurn` (33013) and `playSingleReaction` (43028).
  - The solo path does not strip a leading "Name:", so the model learns to prefix its lines.
  - The solo path drops the heat flag in `normalizeChannels`, so inner thoughts become narration during heat.
  - The multi-character fallback compares against `state.model` instead of the rotated model.
  - **Recommendation:** one shared `generateCharacterReply()`.
- **The Scene Writer shows raw model output** when `narration` is `""` or the JSON fails to parse (42784–42792).
- **Solo vs multi is chosen by who is at the location, not who is in earshot** (30214). A character in another sub-area can answer.
- **The multi-character chain waits for each typewriter reveal** before generating the next line (33173). At 28 characters per second that adds about 20 s per long line. The comment at 9910 claims the opposite.
- **Cost:**
  - `hasPresenceCue` matches substrings: "gir" matches "girl", "enter" matches "center", and "gel" or "git" appear in most Turkish sentences. So the presence model call runs on almost every line.
  - `out/DEBUG-TRACE-REVIEW.md` records 19 calls and 196 s of model time for one turn.
- **`_exitedIds` is never reset for normal turns** (31145), so a participant who leaves can never be brought back by the Scene Writer until reload.
- **UX:**
  - There is no regenerate or retry button. Resending after a failure duplicates the player's line.
  - The worst case for one reply is 3 × 180 s, with no Stop button.
  - The empty-response recovery `fetch` has no timeout (10402), which brings back the v99.1 "hangs forever" bug.
- **Point of view:** nothing forbids narrating the player's actions or feelings ("*You lean closer*"). `docs/response-format.md` uses a third-person example that contradicts the first-person rule the app ships with.
- **Low:**
  - `stripNarration` and `spokenOnly` break on unbalanced asterisks and can pass private narration to other characters (31480, 31496).
  - `mixedLangDirective` still hard-codes "Turkish" (6679).
  - `foreignWordHits` flags German "warm" and "still".
  - Router 1 only accepts exact full names and otherwise falls back to `cast[0]`.

### 4.2 Living world (End Day, world round, gossip)
- **End Day double run** (#6).
- **Reloading during End Day permanently loses that day's background work** (diaries, gossip, intent tick, goals curator). There is no progress marker and no `beforeunload` warning.
- **Wrong day and period stamps at day end:**
  - The day advances *before* `endDayBackground` runs, so `rememberMemory` stamps gossip as (day N, Morning). The day-end motive-former filters on the period that ended, so **rumours never produce motives**, even though the docs promise they can (43199, 38961).
  - Goal pursuit and the character-quest prompts are told "day N, Morning" (38738–38782).
- **The period reconciler can absorb planted rumours.** `memsOfPeriod` does not exclude GOSSIP, so `openSuspicion` and `gossipId` are lost and the ledger points at deleted memories (43406).
- **Name lookup matches on substrings** (`_pulsePersonasByName` 37964): "Can" resolves to "Canan" or "Ercan". Memories and relationship changes then go to the wrong character in the world round, offstage interactions, the calendar executor and goal pursuit.
- **Stale snapshots.** `runWorldRound` and `runOffstageInteraction` build their pool of offstage characters, then wait on a long call. If one of them joins the player meanwhile, they are still moved elsewhere and given "I was at the gym with Hakan" while standing in the player's scene.
- **Cost:**
  - Characters who answer `acted:false` are asked again at every period change, up to about 40 goal-pursuit calls a day.
  - Diaries pass the motive-former's filter, so every diarist gets a former call every End Day.
  - The rough total is **30–60 calls per End Day for a cast of 6**.
- **Placement is one dice roll per day.** The per-period schedule points are summed, so characters don't move through the day on their own. The comment at 14642 wrongly says "deterministic".
- **Low:**
  - The gossip ledger never prunes, and `decayGossip` decays every universe's rumours whenever any chat ends a day.
  - A rumour that simply cools is rewritten as "turned out to be nothing".
  - A failed world round is not retried for that period.

### 4.3 Intentions and motives (v143.1 multi-motive system)
- **Armed plans ignore the privacy lock** (39292). The turn after End Day, a confrontation can arrive in the middle of an intimate scene. `maybeSpawnConfrontation` and `checkCharQuestApproach` also skip the check.
- **Hidden (latent) and removed characters appear in the motive-former and recruit rosters.** A motive can point at an NPC the player hasn't found yet ("X comes to you about Nil"), and rumours can be planted in removed characters. Intents aimed at a removed character keep firing.
- ✔ **An armed intent is spent before it surfaces** (39330). If `startConfrontation` or `startOverture` returns false, the motive is lost.
- **A planted rumour carries the schemer's plan** ("I heard something about X — wait until he's alone, then…") into someone else's memory (37866).
- **Only one motive reaches the reply** (23460). If the goals list already contains it, nothing is shown, so v143.1's extra motives mostly show up offstage.
- **Low:**
  - Hand-made intents with free-text targets aim at the player.
  - An intent set to "armed" by hand without a plan never fires or cools.
  - The `prep_done` gate always returns true (39200).

### 4.4 Calendar and meetings
- **Cancelled or failed meetings shown as attended** (#10). `end()` also sets no `completedDay`, so an early meeting is dated wrong.
- **End Day with a meeting still ahead today:**
  - Unkept "stood up" memories are planted *before* the future reconcile runs.
  - Then the next morning the player is asked "It's time for 'Dinner'…" for yesterday's plan.
  - `chat.dnd` blocks resolution, but day end still blames the player.
- **"Do you go now?" is asked when the character is already in the room** (user and both modes, 15610 / 15651). "Not now" then plants "I waited but you never came" for someone who is present. "Not now" also cancels the meeting for good; it is not a snooze.
- **Date fallback parser** (`_calInferDayPeriod` 14946, `statedHour` 14923), checked in node:
  - "3 days from now" resolves to **today**;
  - "tomorrow at 5" resolves to **Night** (5 am);
  - "dinner at 7" resolves to **Morning**;
  - "at 12 am" resolves to **Midday**;
  - "at 1 tonight" resolves to **Midday**;
  - "öğlen" / "öğleden sonra" never match, because of `\b` without the Unicode flag;
  - "9pm" with no "at" is not found;
  - the clock has no weekdays, yet the tracker prompt offers "on Friday" as an example.
- **Meeting day and period are not sanity-checked** (15150). Negative, fractional or years-away offsets are accepted. A missing period defaults to *now*, so the meeting is due immediately.
- **Unkept-meeting memories reach every universe.** There is no universe filter, and a plan with an empty `who` matches every character (15336, 37934).
- **The meeting dedupe drops real meetings.** "Meet Aria at the cafe" and "…at the park" count as the same (checked in node). Lunch and dinner on the same day with the same person can't both be filed.
- **Tracker updates change `who` without updating `charIds`**, and `where` skips the place resolver.
- **Meetings are filed for characters who don't exist.** There is no roster check, unlike tasks.
- **The 3-day cutoff hides open meetings that the badge still counts.** The player can't edit or delete them.
- **A failed calendar-executor call drops a character-to-character plan**, which is then reported as lived (38616, 38648).
- **Setting the day in "Set time/place" writes `gameDay` before reading the old value** (29190). This is the trap the comment in `advanceTime` warns about.
- **Low:**
  - Characters see only plans up to today+2.
  - `attendPlan` skips the attendance roll and turns the counterpart into a travel companion.
  - `_textArrive` closes every open meeting with that person.
  - "— Yeni plan —" and "gün sona erdi" are hard-coded Turkish.

### 4.5 Promises
- **The dedupe drops different promises** (#12).
- **The ledger never expires.** `_prPrune` caps it with `slice(-60)`, which drops the *oldest* entries even if they are still open.
- **No tests for pruning, the cap, or kept/broken consequences.**

### 4.6 Quests (story arcs and character quests)
- **Story arcs can get stuck with no recovery:**
  - The judge reads only memories owned by the quest's cast. A quest whose NPC is hidden or deleted, or that has no NPC, is never judged.
  - Only the last 8 memories of the day are read.
  - There is no "failed" outcome.
  - If `generateNextQuest` fails, the arc is left with no live quest and nothing retries.
  - Setting a quest to "done" in the editor, or deleting it, does not continue the chain.
- ✔ **Completion is lost on a universe switch.** `questMarkDone` looks up `_questsUni()` (the current universe), not the universe it was given (40277).
- **Quest-to-character matching is a raw substring** (`questNamesChar` 41392). "Can" or "Ali" matches ordinary words, so characters receive quest knowledge they shouldn't have.
- **Quest announcements, epilogues and completion lines are posted with `present:[everyone]`.** Characters read GM meta text, contrary to the rule that quests are calendar-only.
- **Quest NPCs can duplicate or resurrect characters.** Two different name normalisers mean "Sule" vs "Şule" creates a duplicate, and a removed name is minted again.
- **Arc names collide.** `generateQuestArc` overwrites `arcMeta[arc]`, so a repeated name reopens a concluded arc. The arc history sent to `questNext` has no cap (about 75 KB for a 30-quest arc).
- **Editing a character quest's gate keeps stale ids.** Changing it from "with Ali" to "with Veli" keeps waiting for Ali.
- **Language:**
  - Hard-coded Turkish strings in player-facing text.
  - `x_quest_reconcile` demands TURKISH output but is sent with an English engine directive.
- **Low:**
  - Model booleans like `"false"` are treated as true (`j.stale`, `j.trigger`, `j.moved`).
  - An empty character-quest target becomes the player.
  - In-person quest asks silently depend on confrontations being on.
  - Generated universes can get duplicate location ids (19861).

### 4.7 Gamemaster and world rules
- ✔ **The private-moment detector** (`INTIMACY_CUES` 42192), tested in node:
  - **False positives:** "Amcam geldi" ("my uncle came"), "götürdüm" ("I took"), "zevkli" ("enjoyable"), "cocktail", "grinding coffee", "stripped of his rank", "climax".
  - **False negatives:** "öpücük" (a kiss) and "çıplak" (naked), because `\b` doesn't see ö or ç as letters.
  - **The Heat setting, not a live heat scene, triggers the lock** (`state.heatOn && presentCast===1`). With Heat left on, a one-on-one scene never gets a GM arrival.
- **Background GM calls finish after the player's next message.** There is no `_dirSeq` check in `maybeGamemaster`, so a beat judged on old context lands after newer lines.
- **The GM cadence counts its own lines**, day markers and presence notes, so the real interval is shorter than `gmEvery`.
- **Game systems were removed in v20.5**, but the "GAME SYSTEMS" banner and the SCRIPT MAP still describe them.
- **The rule compiler drops unmatched names without saying so.** A rule can then block more people than intended while the toast says "enforced in code".

### 4.8 Memory
- **Private leaks** (#8), **text thread re-commit** (#11) and **condenser cascade** (#13), all above.
- **Races in memory building:**
  - `maybeBuildMemory` runs fire-and-forget with no lock, and twice per turn during events.
  - A period-change flush in between commits the same span again under the new period, and the near-duplicate check is per period, so the copy survives.
  - A chat switch mid-build stamps the wrong day or cast.
- **An arc is lost on any parse or network failure.** `memDoneIdx` moves forward before the commit.
- **Memory gap in long periods.** Everything from the current period is excluded from retrieval, but history is capped at 20 messages. Earlier arcs of a long afternoon are in neither, so the character forgets them.
- **Diaries leak into the payload** as "Latest 1" every morning (23040–23056), despite the "never injected" rule.
- **Model output is not clamped.** Importance on a 0–10 scale is stored raw, and `type` is unchecked, so a model saying "LONGTERM" moves the memory into another tier.
- **Retrieval quality:**
  - A memory without a vector yet can score a perfect semantic 1.
  - Min-max rescaling makes the best of an irrelevant pool score 1.
  - The people facet is nearly constant.
  - The live near-duplicate demotion is in `prefilter()`, which nothing calls.
- **Storage:**
  - The whole memory array, with 1536-number plain-array vectors, is written on every change without debouncing.
  - Quota errors only go to the console.

### 4.9 Relationships
- **No per-evaluation cap on slow or fast deltas** (18641, 18484). A model that returns absolute values instead of changes pushes a pair to ±100 in two days.
- **`generateRelationshipsFor` replaces the whole sheet** (21048). It drops ties to hidden or removed characters (which `relTieHidden` promises are "never deleted") and the authored player tie. It re-runs automatically every End Day for almost every character.
- **`evalRelationship` writes each chat's daily mood into the universe-wide sheet**, overwriting the authored foundation and leaking across chats.
- **Neglect is triggered by mistake.** `lastSeenDay` is only stamped by the fast read (every 5 turns, speakers only), so short scenes still produce trust decay and "absence" memories.
- **"Relationships settle at every time change" does nothing.** It needs `movedDay===prevDay`, which is only written at End Day (43563).
- **Overture and confrontation outcomes are mislabelled.** Any departure is recorded as "rebuffed", while the memory text says "It landed…". The first judge turn scores the player's line from before the event.
- **The duplicate "RELATIONSHIP GENERATOR" banner is not duplicated code.** One is the prompt, one is the engine; rename one.

### 4.10 Text messaging
- **No send lock** (30604): two quick texts start two overlapping replies that each miss the other.
- **Thread re-remembered on reload** (#11).
- **The proactive-text tick is keyed on period only, not day.** End Day's force also bypasses Do Not Disturb.
- **Stale settings text** still promises "anger at being left on read", which v38.7 removed.

### 4.11 Persistence, performance and security
- **Security:** XSS (#3) and prompt-pack takeover (#4). Also:
  - `pollVideo` sends the OpenRouter key to third-party URLs (10487);
  - "Export everything" silently includes every API key;
  - API keys sit in plaintext localStorage (expected for a client-only app, but it makes the XSS worse).
- **Write failures are ignored:**
  - `persistMemory`, `persistUniverses`, `persistPersonas` and `persistGossip` discard the `kvSet` result.
  - `persistChatsNow` records its "saved" signature before the write resolves, so a failed save never retries.
  - The localStorage rescue copy is never read at boot.
- **Media and scene saves are not gated** (#14).
- **No multi-tab coordination.** Whole collections are last-writer-wins, so an idle second tab can overwrite 20 turns.
- **Backup import is not atomic.** It clears localStorage first, validates nothing, and takes no pre-import snapshot.
- **The chat dirty signature misses fields.** Example: `_prPurged` is set without marking the chat dirty, so the paid promise purge runs again after reload.
- **Whole collections are serialised on every save**, and a full auto-snapshot is taken about once a minute and whenever the tab is hidden. This causes main-thread stalls on long playthroughs.
- **No concurrency cap on model calls.** Tracker evaluation runs one call per tracker × owner through `Promise.all`. 429 handling has no jitter and ignores `Retry-After`. There is no pause after a 402.
- **No global error handler.** If localStorage throws, the app is blank. There are 714 empty `catch` blocks.
- **`sw.js`** caches responses without checking `res.ok` and falls back to the HTML page for any failed request.

---

## 5. Cross-cutting patterns (fix the pattern, not just the instance)

| Pattern | Instances | Suggested fix |
|---|---|---|
| **No lock on async engines** | `sendMessage`, `endDay`, `runPeriodEngines`, `maybeBuildMemory`, `sendTextMessage`, `maybeGamemaster` | One per-chat `runExclusive(chat, key, fn)` helper, a promise queue keyed by chat and engine. |
| **Background work reads `curChat()` / `curCast()` / `_questsUni()` / `curGameDay()`** | `presentIds`, `runPresenceTracker`, `questMarkDone`, `commitMemoryArc`, `rememberMemory`, Story mode `_smSend`, `appendOneBubble` | Pass the chat or universe explicitly. After each `await`, check whether the chat is still the same and whether the cast or period changed. |
| **Mark done → call the model → never undo** | calendar executor `e.done`, `_spendIntent`, `memDoneIdx`, `_roundAt`, `_lastPersistSig` | Commit the marker only on success, or keep an attempt counter with a limit. |
| **Substring name matching** | `_pulsePersonasByName`, `_pulseHasDuePlan`, `questNamesChar`, `hasPresenceCue`, the people facet in retrieval | One `matchName(text, name)` helper: exact first, then whole-word with Unicode boundaries. |
| **`\b` without the Unicode flag in Turkish-aware regexes** | `INTIMACY_CUES`, `_MEM_INTIMATE_RE`, the date parser | Use `(?<!\p{L})…(?!\p{L})` with `/u`. The `_B` helper already exists. |
| **Scope and privacy leaks** | whispers and thoughts in memory and the fast read, hidden and removed characters in intent rosters and director notes, quest lines with `present:[all]`, armed plans ignoring the privacy lock | One `perceivedBy(msg, charId)` filter used by every engine that builds text from the transcript. |
| **Unbounded growth** | character quests, promise ledger (drops oldest open ones), gossip ledger, diaries and long-term memories, quest arc history | Prune settled entries first, expire stale ones, cap prompt inputs. |
| **Hard-coded Turkish in player-facing and engine text** | "Yeni görev", "— Yeni plan —", "gün sona erdi", no-show memories, background-task fallbacks, `x_quest_reconcile` | Route through `sLine()` / `blkTpl`, with English engine records. |
| **Model output trusted without clamping** | memory importance and type, relationship deltas, `"false"` booleans | Validate and clamp at the parse boundary. |

---

## 6. Test results and coverage

**Run:** all 100 scripts in `tests/` against v144.0 with Playwright and the bundled Chromium. **100 pass, 0 fail, about 2,850 checks.** The app also boots with no page errors.

**What the suite does well:** it locks the byte-for-byte payload match, storage boot safety, addressee pinning, day wording, arc tiling, the world round and period engines, and many past incidents.

**Gaps.** Nothing tests:
- `playSingleReaction` / `gamemasterReactions` (one call would have caught #1);
- `chatCompletion` with a mocked network: timeout, retry count, a non-JSON body, the recovery-call timeout;
- `parseJSON` with curly quotes; `looksLikeRefusal` against in-character English;
- **any concurrency:** two sends, a double End Day, overlapping period engines, overlapping memory builds, a chat switch mid-turn;
- the armed-plan path (`checkArmedPlans`, `evaluateGate`, `surfaceIntent`), `plantDirectedRumor`, `decayGossip`;
- the quest chain: `generateQuestArc`, `reconcileQuestsForDay`, `questMarkDone` across universes, `questNamesChar`;
- the three branches of `_resolveDueMeeting`, End Day with a meeting pending today, the date parser's edge cases, the dedupe collisions;
- the condenser threshold and cascade, whisper exclusion in `commitMemoryArc`, `_textArc` surviving a reload;
- `evalRelationship` delta caps, the sheet overwrite, and the confrontation and overture judges;
- XSS and escaping, prompt-pack import, backup import validation, multi-tab.

**Infrastructure:**
- There is no CI (no `.github/`).
- `package.json` is gitignored, so the Playwright version is not pinned.
- 97 scripts hard-code `/opt/pw-browsers/chromium-1194/...` and 47 hard-code `file:///home/user/Multirp`.
- There is no aggregate runner.

**Recommendation:** add a `tests/run-all.js`, relative paths, a pinned `package.json`, and a GitHub Actions job. Add tests for each High item above as it is fixed.

---

## 7. Suggested order of work

1. **Quick fixes (about a day, big payoff):**
   - #1 `const`→`let`;
   - #11 `_textArc` into `DURABLE_CHAT_KEYS`;
   - #2 `parseJSON` order;
   - #3 `escAttr`;
   - #4 the import allowlist;
   - #10 calendar outcome fields;
   - #7 refusal anchoring;
   - #12 promise stop words;
   - the `"false"` boolean checks;
   - intent spent only when it fires.
2. **Concurrency pass:** the per-chat engine lock, the send lock, the End Day guard, and passing the chat and universe explicitly through background work (#5, #6, #9 and the living-world and memory races).
3. **Privacy pass:** one "perceived by" filter for memory, fast read and gist; `isActiveChar` on every roster; `present:[]` for quest meta lines; the privacy lock on armed plans and quest approaches; a Unicode-aware intimacy regex that uses the live heat state.
4. **Data safety:** check every `kvSet`, gate media saves on hydration, a multi-tab leader lock, atomic and validated import.
5. **Cost and growth:** character-quest attempt caps and expiry, condenser counting only raw memories, goal-pursuit memo for `acted:false`, a concurrency semaphore, recording `usage`.
6. **Calendar correctness:** End Day with a meeting pending, the counterpart-present check, date parser fixes, bounds on the day offset, the dedupe using place and period, a universe filter on unkept memories.
7. **Refactor:** one shared character-reply generator for the solo, multi and reaction paths.
8. **Docs:** they say v29.1 and about 30k lines; the app is v144 and 48k lines. The SCRIPT MAP and banners still describe removed game systems, and the settings text says "last 3 snapshots" where the code keeps 6.
