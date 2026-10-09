# 07 · Memory System

SkyrimAI-inspired, event-bounded, per-character. Everything lives in the flat `state.memory`
array (shape in doc 02) and is scoped by `ownerId`; the Memory screen browses/edits it.

## Layer map

```
during play                        at End Day                       long-term
───────────                        ──────────                       ─────────
arc tracker (memEval)              flushMemoryArc (commit leftovers)
  └─ commit on close ─┐            writeDayDiaries (one DIARY/char)
     memBuild ────────┼─► EXPERIENCE/…                               maybeCondenseMemories
     gistBuild ───────┘   OBSERVATION (bystander, charge)              └─► LONGTERM (clustered
rememberTextExchange (texts)       runGossipPropagation reads charged      merges, embeddings/
runLocationGossipLeak (POI leak)   observations → GOSSIP rumors            Jaccard clustering)
```

## Arc-bounded building (`maybeBuildMemory` — runs after every turn)

1. A **scene boundary** is the last `travelBeat`; a **committed boundary** (`memDoneIdx`)
   prevents re-covering messages already cut into memories (fixes near-duplicate layering).
2. The **arc tracker** (`memEval` prompt, on the director model `mcModel`) judges the last ~6
   real lines: `{progress: ongoing|paused|finished, topic: same|different, summary}`.
   **Its bias is to CLOSE (v52.1).** One arc becomes one memory, so a thread held open across many
   beats is a few sentences covering all of them and the middle is gone — lost at write time, which
   is the one loss nothing downstream can repair. Fragments, by contrast, are repaired:
   `reconcilePeriodFor` rewrites a period's memories as the one thing a person would keep. So the
   prompt closes at each resting point (a beat landing is enough; an intimate encounter is recorded
   beat by beat, not as one thread) and reserves `paused` for a hold of a line or two. The earlier
   defaults said the opposite; boot refreshes any stored copy of them
   (`_refreshPipe("memEval", …, "CLOSE AT THE FIRST RESTING POINT")`).
3. Commit paths → `commitMemoryArc(chat, start, end, dayStamp?)`:
   - `finished` → commit the arc;
   - `topic:different` → commit the old arc, open a new one at the last user line;
   - closing skips nothing: a commit sets `memDoneIdx` to the arc's last message and the next arc
     opens after it, so the spans tile the transcript with no gap and no overlap however short
     the arcs are (`arc-tracker.browser.js` pins this);
   - backstop at `MEM_ARC_CAP` (**12** messages, was 40) for a tracker that never closes — under
     the current prompt an arc closes long before it, and since v52.1 a `paused` arc is no longer
     exempt (that exemption was the one path an arc could grow without any limit). The valve also
     used to reopen the next arc *on* the message it had just committed, so its spans overlapped by
     one line each time it fired; it now clears the tracker the way the `finished` path does;
   - travel (characters left behind) and **End Day** → `flushMemoryArc` (stamps the
     *just-ended* day so day-filtered engines still see it).
4. `commitMemoryArc` builds **one memory per participant**, each scoped to what that character
   actually witnessed (their arrival cut within the arc + `witnessedBy(m,p)` on `present[]`):
   - **Participants** get `memBuild` → full structured memory (JSON: content, people, emotion,
     feelings, importance, tags, type). When the builder omits `people`, the arc's own speakers
     fill it (`arcPeople`) — an empty `people` row costs the memory the presence boost in all
     three rankers, so no writer may leave it blank.
   - **Bystanders** (present but not in the conversation) get `gistBuild` → a fuzzy outside
     impression (OBSERVATION with `gist`, `charge`, `observerOnly`) — they *see the shape*,
     never the words. Charged gists (≥0.5) are exempt from the importance floor because the
     gossip engine needs them.
   - **Storable floor**: importance < `state.memMinImp` is dropped.
     ⚠️ Keep the floor well below **0.55** — the offstage intent engine reads memories at that
     importance to form grudges/loyalties; a high floor starves the living universe.
5. Phone texts never enter arcs (excluded from the judged window); `rememberTextExchange`
   writes their memories separately.

### WHEN and WHERE reach the writer (v59.1)

Every memory record is stamped with `gameDay`, `gamePeriod` and a location **in code**, from what
the app knows. None of it used to be put in front of the model that *writes* the memory — so a
prompt asking the memory to open with when it happened had nothing to open with, and one asking for
the place "from the given location list" was handed no list. Both got invented, confidently, and the
invention is what was stored and read back later as fact: a day-3 afternoon at the pool came back as
*"It is Day 1 Evening"* at a house nobody had named.

`memWhenWhereLine(chat, day, period, {noWhere})` prefixes the user message for all three writers —
the arc builder, the bystander gist and `_commitTextArc` (WHEN only: a phone thread has no scene
location, which is why its record stores `location:""`). It names the day, the part of the day, the
place down to the sub-area, and says outright that these are the only source for them and must never
be guessed or carried over from an example in the instructions. `DEFAULT_MEMBUILD` rule 0 says the
same from the prompt side.

The period reconciler was given this line in **v44.3** for exactly this reason; the three writers
that produce nearly every memory in the bank never were.

## Period reconciliation (`reconcilePeriodFor` — when a part of the day ends)

Every memory a character wrote in the part of the day that just ended (`memsOfPeriod`, ≥2 of them)
goes to `memReconcile`, which rewrites them as the one thing a person would actually keep; the
replacements are built first and swapped in only once they exist, so a failure anywhere cannot lose
a memory. Capped at three. `onPeriodChanged` runs it after `flushMemoryArc`, never on a day roll —
the diary owns that. The replacements keep the union of the fragments' `srcMids` (v146.1), so the
"still in the transcript" rule below keeps working after the period changes.

**Still on screen (v146.1).** A memory with `srcMids` counts as "now" (withheld from retrieval and
from Latest) only while at least 75% of those lines are in the character's actual history —
`memTranscriptMids` reads the ids `castHistory` kept (scene cut, 2-day window, privacy drops,
`histTurns` cap). An arc whose first half has scrolled out is recalled.

**Reading the answer (v56.1).** The reader used to accept exactly one shape, `{"memories":[…]}`, and
return early on anything else — silently, keeping the originals. Since this prompt is user-editable,
and since the arc BUILDER's contract is a bare `{"content": …}`, an edited reconciler prompt asking
for that shape produced a perfectly good memory that was dropped on the floor with nothing anywhere
saying why. `_memReconcileList` now accepts `{memories:[…]}`, a bare single object, a top-level
array, or one of the obvious wrapper words; anything with no usable `content` is still nothing, and
that case now warns instead of failing silently.
Two fields also stopped being discarded: `feelings` and `type` were hardcoded to `""` and
`"EXPERIENCE"` here while the arc builder had always honoured both — so a reconciled memory lost the
felt half that `memInjectText` appends wherever it is injected, and an INTIMACY came back filed as an
ordinary experience. `_memType` clamps to the real enum; `_memImp` reads **both** `importance_score`
(the arc builder's name) and `importance` (this prompt's), which is where an edited prompt gets the
other name from. The shipped contract asks for all of them.

**The shipped prompt's own example (v57.1).** It was a placeholder skeleton, and it named importance
the way this engine did rather than the way the arc builder does — the disagreement that sent an
edited prompt down the wrong field in the first place. It now shows `importance_score`, says plain
`importance` still works, and carries a **worked** example beside the skeleton so the two things
most likely to drift are visible in situ: the first-person "I" (and, until v133.1, the day-and-hour opening). The
voice rule is stated as FIRST person and bans the second outright — the fragments being rewritten
are first person, so a reconciled memory in another voice leaves the bank mixing voices mid-way. It
also warns, in the words of the failure a player actually hit, that an unescaped quotation mark
inside a string value breaks the parse. Both example lines are asserted to be valid JSON by the
test, so the prompt can never again ship an example that cannot parse.

**When and where open the memory (v133.1).** The reconciler used to be told to open every memory
with the day it was for ("Day 1, Midday. I spent the day…"), and the payload then added its own
stamp at the end ("(six days ago, Midday) [Palmera Beach Club]") — two copies of the same fact, one
frozen at the day it was written. Now the model writes only what happened, and the app puts a
sentence in front of every memory it hands a character, recomputed on every call:

    Memory 1: This happened six days ago at Palmera Beach Club during midday. I spent the day…

`_memLead` builds it from the memory's own `gameDay`, `location` and `gamePeriod`; the gap comes from
the same `relWhen` ladder as everything else, so it grows as the days pass. The sentence and its two
optional pieces are fragments (`mem_lead`, `mem_lead_place`, `mem_lead_period`, under "How long ago /
how far off"), and a piece the memory has no record of is left out whole. The place is always named
now — the old tail dropped it when it matched the current room. Memories already stored with a
model-written "Day N, Period." opening keep it on disk; `memStripDayLead` cuts it off wherever
`memInjectText` hands a memory to a model.

## Diaries (`writeDayDiaries`, End Day)

One private DIARY entry per participating character, written from the day's memories
(`daySummaryPrompt` + genre-pack diary voice + `langDirective`). `_parseDiaryOut` salvages
malformed JSON (raw newlines inside strings — a real recurring model failure). Diaries are
**short, standalone, and never condensed** (`condenseDiaries` is intentionally a no-op now).
The Diary screen renders per-character books with generated covers (`genDiaryCover`),
paper backgrounds (`genDiaryPaper`), fonts, and read-aloud (`dubDiary`).

## Long-term condensation (`maybeCondenseMemories`)

Per character, when the **mergeable** raw bank (`_memMergeKind`: not DIARY/LONGTERM/CONSOLIDATED,
and — v146.1 — not a glimpse, rumour, hand-written or superseded memory, which used to fill the count
and the protected slots) reaches `memMaxBeforeCondense` (default 50): the newest `memCondenseStart`
(30) of those by **story time** (day, then part of the day) stay verbatim; older ones are **clustered by similarity** — embedding
cosine ≥ 0.82 when semantic memory is on, else word-set Jaccard ≥ 0.5 — and each cluster of ≥2
is merged by the `condensePrompt` model into ONE `LONGTERM` memory (originals deleted; the merge
keeps the earliest day, `daySpan`/`periodSpan`, the people and the source message ids, and a
`condensedFrom` count). Never merged (v144.1): the current day+period, superseded decisions,
rumour-linked memories (`gossipId`/`openSuspicion`), bystander glimpses (`observerOnly`) and
memories the player wrote. Soft caps: past 60 LONGTERM entries the oldest (beyond 40) are offered
for a second merge; past 120 diaries a Debug note is written (diaries are not trimmed); past 60
bystander glimpses (`observerOnly`, v146.1 `_memTrimGlimpses`) the oldest are let go down to 40 —
never today's, never one tied to a rumour. Bounded to
4 clusters per pass; runs after the arc commit, outside the memory lock; fully best-effort.
Manual trigger: Memory screen → Condense (`condenseAllNow`).

## Retrieval (`retrieveMemories(userText, chat, ownerId)` — every reply)

Three tiers, all scoped to the responding character, sizes from Settings:

| Tier | Pool | Count |
|---|---|---|
| `recent` | raw arc memories (not DIARY/LONGTERM/CONSOLIDATED) — searched over the whole bank | `memRecentCount` |
| `diary` | DIARY entries | `memDistantCount` |
| `longterm` | LONGTERM + CONSOLIDATED | `memLongtermCount` |

Query: `genQuery` (LLM semantic query from the current moment) prepended to the inline text
(current line + last 2 lines); falls back to lexical-only on failure.

**Weighted facet scoring** (weights `memW*` from Settings):
`semantic` (query-embedding cosine, or lexical token overlap when embeddings are off/failed) ·
`people` (memory involves someone present) · `location` (matches current place) · `recency`
<!-- v39.0 — every writer fills `people` through the shared `memPeople(...)` resolver (ids,
     "__user__", or plain names in any mixture → de-duplicated display names). Twelve writers
     used to store it empty: no-show meetings, broken promises, trackers going public, proactive
     texts, planted rumours, closed quests, confrontation and overture aftermaths, world-pulse
     events, diaries, the long-term condenser, and arc memories the builder left unlabelled. -->
(day-gap decay `1/(1+gap*0.15)`) · `emotion` (mood-congruent recall — the owner's dominant
fast axis toward the player maps to congruent emotion enums) · `importance`.

Post-ranking balance on the `recent` tier (`balanceMems`): the **intimate share cap**
(`memIntimateFrac` — intimate scenes can't flood the payload; refills with non-sexual history)
and the **per-type cap** (`memPerTypeCap`).

Every retrieval writes a **local Debug entry** (no network): the query, neural-vs-lexical
path, the active weights, and each candidate's per-facet scores with the injected ones
flagged — the ground truth for "are my weights doing what I set".

**v134.1 — retrieval was returning the latest memories, not the relevant ones.** A tagged memory
the query named outright never reached the candidate list. Four causes, all fixed and pinned by
`tests/memory-retrieval.browser.js`:

- **The semantic facet was squeezed.** It was `(cosine+1)/2`, and real embedding cosines sit in a
  narrow band, so the best and worst match in a bank differed by about a quarter of a point on the
  highest-weighted facet, less than `people` (0.4 for anyone present) or recency. The raw match is
  now rescaled across the character's candidates each retrieval: best match 1, worst 0. The lexical
  score is rescaled the same way, and a memory with no vector yet competes lexically.
- **The lexical facet divided by the whole scene.** Hits were divided by every word of the keyword
  line plus the last two messages. It now counts the keyword line and the player's own line (the
  inline text only when there is no keyword line).
- **Edited memories kept their old vector.** Vectors now carry `vecSig`, a signature of the text
  they were made from (content + people + tags). A missing or different signature queues a
  re-embed (`memNeedsEmbed`), the old vector scoring until the new one lands; saving the memory
  editor re-embeds at once (`embedMemoryNow`).
- **A memory added by hand vanished until the clock moved.** The editor stamps a new memory with
  the current day and part of the day, which the "the now is not a memory" rule dropped. A
  `source:"manual"` memory is never treated as the current scene.

Also: the per-type/intimate cap refills from the pool in **rank** order (it walked storage order),
and the Debug trace shows every injected memory with its `rank` out of the pool size and the raw
semantic match, not only the top twelve.

### The relevance judge (v150.29) — relevance is asked, not guessed

Every fix above tuned a proxy. None of the facets can tell whether a memory *matters to this
moment*: the cosine compares a keyword line to a memory, and people-present, recency and importance
know nothing about the topic. So retrieval now asks.

`memRelevanceJudge(chat, ownerId, userText, cands)` sends ONE request to OpenRouter's **Decisions API**
(`POST https://openrouter.ai/api/alpha/decisions`, model `memJudgeModel` → `openai/gpt-6-luna-decisions`;
`typesafe/jev-1.13` takes the same request). A decision model answers typed questions with calibrated
probabilities instead of writing text. The request carries:

- `state` — the scene as the owner took it in (`_memJudgeScene`: the last 8 lines they witnessed, by
  `memHeardLine`, ending on the line being answered). v150.32: **this scene only** — from the last travel
  beat or scene cut, or after the last day marker (`_playerSceneStart`). The first live run sent a beach
  scene with someone else ahead of the door scene being judged: narrator lines carry no witness list;
- `questions` — one `noul` (yes/no) question per shortlisted memory, `m0…mN`. Its `instructions` are the
  `x_mem_relevance` prompt with `{{memory}}` filled (`_memJudgeText`: `memSearchText` + where it happened),
  its `criteria.true` / `criteria.false` are `x_mem_relevance_yes` / `_no`. All three are registry prompts
  (Payloads → Memory Retrieval) and fill `{{char}}`, `{{user}}`, `{{memory}}`.

**The shortlist.** Per tier, the top 20 (today) / 10 (long-term) by the weights, united with the top 20 /
10 by the semantic facet alone, so an old memory nobody present is in can still reach the judge when
the query points at it. At most `MEM_JUDGE_MAX_Q` = 60 questions (the API allows 200). Diary entries
are not asked about: `memoryBlocks` never injects them (v26).

**How the answer ranks.** With an answer, a memory's probability `rel` replaces the semantic facet and
scales the others: `total = wSem·rel + rest·(0.25 + 0.75·rel)`, where `rest` is the weighted people,
location, recency, emotion and importance facets. Among memories that are all irrelevant the old order
survives (each is scaled by the same 0.25), but those facets can no longer lift an unrelated memory over
one that answers the moment. A shortlisted memory the answer skipped, or one outside the shortlist,
counts as `rel = 0`.

**The floor.** `memJudgeMin` (Settings → Memory → Minimum relevance, default 0.15): a today or long-term
memory rated below it is not recalled at all, even if that leaves a slot empty. Injecting an unrelated
memory is not neutral; it is the material characters repeat and drift toward. 0 fills every slot.

**Failure never blocks a reply.** No key, the switch off (`memJudgeOn`, on by default), a timeout
(`MEM_JUDGE_TIMEOUT_MS` = 8 s), CORS or network error, a non-2xx status, or an answer with no
probabilities: `null`, and retrieval ranks by the weights alone, exactly as before. Failures that will
repeat pause the judge (`_memJudgeBreak`, one toast) rather than cost every reply a dead request: a
401/402 for 2 minutes, a 400/404/405 (model or endpoint refused) for 30 minutes, any three failures in a
row for 10 minutes. A pause is tied to the key; changing the key lifts it.

**Cost.** Billed on input only (the model writes nothing): about 20 KB of request for 24 questions in the
test bank, so roughly $0.0005–0.0015 per character reply at $0.10 per million input tokens.

**Debug.** The judge's own request is a row ("Memory relevance judge — N memories"), its result the
probability per question. The retrieval trace gains `relevanceJudge` (asked, answered, model, floor, which
ranking ran) and a `relevance` facet per candidate. Pinned by `tests/memory-relevance.browser.js`.

## Embeddings (semantic memory)

Opt-in (`embedOn`). `embedText` calls the OpenRouter embeddings endpoint (model
`embedModel` → `openai/text-embedding-3-small`) using the main OpenRouter key; vectors are
cached per memory keyed to the model (`memVec`) and to the text they were made from (`vecSig`);
`ensureMemEmbeddings(ownerId, batch)` back-fills missing and stale vectors in the background after
each retrieval — in ONE batched request (`embedTextBatch`, up to 32 inputs); after a failure the
backfill stands down for 5 minutes. Diaries are never embedded (they are never injected). Any
failure ⇒ silent lexical fallback (`_embLastErr` surfaces in the retrieval trace). A memory
without a vector yet scores its word overlap on a fixed scale capped at 0.6, so it cannot outrank
a strong semantic match; the cosine rescale is gated by the absolute match, so an irrelevant pool
scores low across the board.

**v150.64 — a rejected model is a setting to fix.** A Decisions model typed into the embeddings box ("typesafe/jev-1.13")
failed every request with HTTP 400 and the Debug row said only "HTTP 400 ": the body had been read as JSON, so the raw text
was empty. `_embErrText` puts the endpoint's own words on the row and in `_embLastErr` ("HTTP 400 — … is not an embeddings
model (…)"), for the query and the backfill. A 400 / 404 / 422 shows one notice per model per session naming the setting
(Settings → 2 · LLM Selection → Memory & Daily Engines → Semantic-memory embeddings model); recall stays lexical meanwhile.
Saving warns (once per value) when the box holds a Decisions model (the current one, or any `*-decisions` id) or a model the
user has set for chat (`embedModelLooksWrong`). The Decision models have their own card (doc 06). Pinned by
`tests/decision-models.browser.js`.

## Injection into payloads

`memoryBlocks(injected)` renders the tiers under their fragment headers:
`recent_memories` ("RELEVANT MEMORIES — stay consistent"), `distant_memories`
("YOUR DIARY" + "YOUR LONG-TERM MEMORY" — background, not to be recited). Placement is
user-movable per payload (doc 05); by default recent sits in the tail (post-dialogue,
strongest), diaries in the head.

## Memory UI

Memory screen: filter by owner, per-memory cards (type badge, importance, day, people,
location), edit/delete (`openMemEditor`/`saveMemEdit`/`delMemory`), manual add
(`addMemoryManual` — owner, type, content, people, location, emotion, feelings, tags,
importance slider). `visibleMemories()` scopes to the current universe.

## Cross-effects & warnings

- **Raw memories are inputs to five other systems**: retrieval (payloads), gossip (charged
  OBSERVATIONs), intents (day memories ≥0.55), diaries (day memories), calendar/quest
  reconcilers, and the universe chronicler. Deleting memories from the UI can therefore
  change offstage behavior, not just recall.
- `memDoneIdx`/`memEvent` live on the chat — clearing a chat window (`clearChatWindow`) or
  deleting messages interacts with open arcs; the code clamps defensively but avoid manual
  surgery on `chat.messages` indexes.
- The importance floor / intent threshold coupling (0.55) documented above is the most common
  "the world went dead" misconfiguration.
- Memory content is written in the **story language** (`langDirective`) — switching languages
  mid-campaign mixes languages in the bank; retrieval still works (embeddings are
  multilingual; lexical matching degrades).

## v68.1 — the memory of a visit was lost to the act of leaving

Three faults, found from one debug export in which the arc tracker answered `finished` twice in a
row and the memory tab stayed empty.

**`commitMemoryArc` gave the memory to whoever was still standing in the room.** The cast was
filtered by `presentIds(chat)` — presence as of the instant the commit runs — so a character who
had just walked out was not eligible for the memory of the scene they had spent the last ten
minutes in. That is not a rare edge: *"she says she has to get home and goes"* is exactly the beat
that makes the tracker answer `finished`, so the departure and the commit fire on the same turn
every time, and the departure always lands first. The tracker returned `finished`, the debug log
showed it, and nothing was ever written — which is why the memory bank always stopped one scene
short of the story. The cast is now read off the span itself (`m.present`, which every message
already carries), with presence-now folded in for arcs older than the stamps. `witnessedBy()` still
scopes each person to the lines they were actually there for, so someone who left halfway keeps the
half they lived, and a character who was never in the span still gets nothing.

**The last stretch of every day was never consolidated.** `reconcilePeriodFor` had exactly one
caller, `onPeriodChanged`, and that hook returns early on a day roll — *"the diary owns that, not
this"* — on the understanding that End Day made its own call. It never did. So a period that ended
by ending the day, rather than by the clock moving on, kept its raw fragments forever: the diary was
written from them, the payload injected them one at a time, and the stretch the player had just
finished was the one stretch that never became a memory of a stretch. End Day now sweeps every
owner and period of the just-ended day, which also catches a day run straight through without a
single period change.

**The closing arc was filed under the wrong stretch.** `endDayBackground` passed the just-ended
`day` but no period, so `commitMemoryArc` fell back to `chatPeriod(chat)` — already "Morning" of the
*new* day by the time the background pass runs. The one memory that closes a day was stamped Day N,
Morning: a stretch belonging to Day N+1, where the reconciler would never find it beside the
memories it belongs with. The period is captured before the roll and passed down.

`reconcilePeriodFor` also gained a guard: a stretch whose every fragment is already `source:
"reconciled"` is skipped, so the new day-end sweep cannot re-collapse what the period-change hook
already collapsed.

## v150.59 — a text exchange, as the one on the other end read it

From a texting export (Duygu Akbaba):

- **The player's texts are heard by the person they were sent to.** They are stored with `present:[]`, so the
  witness filter of the emotion pick, the relevance judge (`_memJudgeScene`), the goal check and the query writer
  (`genQuery`) dropped them; on the first text of a thread the scene was empty and the emotion pick never ran.
  `_heardByOwner(m,p)` (witnessed, their own line, or a text in the thread with them) and `_heardLineOwner` (a
  text labelled "(text message to …)", delivery tags stripped) replace the filter in those readers.
- **A texter reads none of the player's room.** A line with no witness list (narration, move notes) reached every
  per-character reader on position alone, so Burcu, at home and texting, had the player's house — Özlem carried to
  the bedroom — as her emotion pick's scene. `_untaggedReaches(chat,p)`: an untagged line reaches only someone in
  the player's scene (recentExchangeFor, the reply check, the judge, the query writer), and `castHistory` drops an
  unwitnessed narrator beat for a reader who is not there.
- **A text reply reads the thread.** `_textSceneLines` — a few in-person lines they heard, then the thread,
  newest last. `_memJudgeScene(...,{text:true})`, `genQuery(...,{text:true})` and `retrieveMemories(q,chat,id,
  {line,text})` use it; the line answered is the newest player text (`_newestPlayerText`), not "". `_textMemQuery`
  puts the thread last and cuts from the front (the judge used to read only the old spoken scene).
- **The goal check reads memories too.** `goalDoneQuestions` adds `memories_bearing_on_goals` (her memories sharing
  words with a goal, whole up to 500 characters, dated, oldest first) and `player_lines`; `x_goal_done` judges from
  the scene OR those memories, the newest winning (old default upgraded by `_refreshPipe`). The reply-decision
  `memories` context (`_fragCtxState`) is cut at 400 characters, not 160.
- **A text is not a room.** `_emoStakeState(...,"text")`: they are texting, not together; who is around the texter.
- **Left behind, but on their way** (`_saidLeavingTo`): someone the player walks away from who said in their own last
  lines that they are going is placed where they said, or home — not at the place they said they were leaving.
- **The text memory writer** (`_commitTextArc`) gets the tracker's topic, what it already remembers of the thread and
  the lines before the stretch, and two rules: the name in front of a line is who typed it; a condition is not a
  statement; `people` includes whoever the messages are about. The text arc tracker gets the who-typed-it rule.
- **World memories are English and first person** (`_memRecordProblem` in `_plantWorldMemory`): a quest step that
  copied its narrated event (Turkish, third person) into the holder's memory is not planted; the English note
  stands in, its owner's name turned to "I" (`_noteAsOwnMemory`).
- **The query is one clean line** (`_cleanMemQuery`): the first line with keywords, non-Latin runs dropped, each term
  once. The default temperature was already 0.3 (`fnTemp("mc",0.3)`); the export's 0.7 is an explicit "mc" override,
  which is respected.

Pinned by `tests/text-witness.browser.js`.

Two payload fixes from the same export, outside memory proper:
- **A motive toward the player** (`intentParts`): with the fragment model on and the player the one answered, the
  holder's live motive toward the player is offered as this beat's colouring (`intent_warm` / `intent_hostile` /
  `intent_self`), so a yes to `q_motive__bears` injects it; the standing aim stays in the bio as before.
- **A quotation mark opens on its first word** (`stripDeliveryTags`, `_dispText`, `_cleanTextReply`): the space a
  stripped `[say …]` tag left inside a quote is trimmed.

## v150.70 — memories in the reply and in the emotion pick

The player rewrote the "What you remember" fragment in their own list: how to read an entry, how a memory feels now, how it
fades, and what keeps it from fading. And: "the decision model should consider these the same way. A woman cheating her
husband should not feel calm the next day."

**One memory, one line.** The lists the fragments call — `mem_recent_entries`, `mem_distant_entries`, `mem_latest_entries` —
give each memory as

    [two days ago, at the market | 3] I bought bread and saw Berk. Felt: sad. Status: open.

- **when** (`memEntryWhen`), from now in game time: the part of the day for today and yesterday ("this morning", "tonight",
  "yesterday afternoon", "last night"; "earlier today" / "yesterday" when no part is recorded), then the `when_*` ladder ("four
  days ago", "last week"), then "two weeks ago" … "a month ago", "N months ago", "over a year ago". The place follows, ", at …".
- **importance** (`memImp5`), the stored 0–1 score on 1–5: ≤0.2 → 1, ≤0.4 → 2, ≤0.6 → 3, ≤0.8 → 4, else 5 (none on record → 3; a
  0–10 score is scaled).
- **what happened** (`memEntryWhat`): the memory's own text, with no frozen "Day N, Period." lead and no "(feeling)" tail, cut at a
  sentence end (700 characters, 1100 for the long-term tier).
- **Felt**: the feelings sentence, else the emotion word (not "neutral"); left out when there is neither.
- **Status**: open / secret / resolved; the whole "Status: …" is left out when the memory has none.

Oldest to newest (`memTimeCmp`: day, part of the day, when it was written), an exact repeat once across the lists of one payload
(`memEntryLines`, `opts.seen`). Every piece is an Other-wording template under "How long ago / how far off" (`mem_entry`,
`mem_entry_place`, `mem_entry_felt`, `mem_entry_status`, `when_today_*`, `when_yesterday_*`, `when_weeks_n`, `when_month`,
`when_months_n`, `when_year`). Only the entries the fragments call changed: the worded blocks (`recent_memories`, …) keep the
numbered "Memory 1: This happened …" form for the proactive texter's context and the call, and every engine, judge and writer
still reads `memInjectText`.

**The fragments.** "What you remember" ships the player's text word for word (`{{char}}` / `{{user}}` filled), as its option
`recall` with the code condition `has_memories` (a head flag: there are recent or long-term entries), so the explanation of an
entry never goes out over two empty lists. "What happened just before this" lists oldest first and says how an entry reads. A saved
list gets both once (`FRAG_SHIPPED_ADDS` `v150.68.memories`, against `FRAG_DEFAULTS_V150_67_OLD`) only while they are still the
v150.67 default; an edited one is the player's.

**Status: a memory that is not over.** `status` is `open` (an unresolved situation that still matters: a fight not made up, a
promise not kept, a betrayal not faced), `secret` (something they did or know and hide from someone it concerns: an affair kept
from a spouse), `resolved`, or none. Every writer with a JSON contract asks for it, and for `resolves`:

| Writer | Prompt | Shown the open / secret matters |
|---|---|---|
| arc builder (`commitMemoryArc`) and phone thread (`_commitTextArc`) | `memBuild` FIELDS: `status`, `resolves` | the owner's (`memOpenMatters`, newest 8, with ids) — engine part `matters` |
| period reconciler (`reconcilePeriodFor`) | `memReconcile`: `status` per memory, `# WHAT THIS STRETCH RESOLVED` | the owner's from before the stretch; each fragment shows its own status |
| day round, offstage interaction, calendar executor, character quest step (`_plantWorldMemory`) | `worldRound`, `offstageEvent`, `calExec`, `charQuestStep`: `status` and `resolves` in each memory, `_MEM_STATUS_WORLD_RULE` | each person's, under their name (`memMattersFor`) |

A returned id among those shown (`memResolve`) becomes `status: "resolved"` with `wasStatus`, `resolvedDay`, `resolvedPeriod`
and `resolvedBy` (the new memory). A reconciled memory with no status from the answer takes the strongest of its fragments'
(secret, open, resolved), and so does a long-term merge. An answer that carries the field marks the memory `_statusChecked`. The
memory editor has a Status box, and the card shows it. Parsers tolerate it missing. Stored prompts are upgraded **in place** (the
v150.5 way): each shipped passage is put in only where the stored copy still has the passage it follows word for word, so the
player's own edits elsewhere are kept; a copy without them is the player's.

**Older saves** (`memStatusBackfill`). Memories of the last 30 game days with importance 3 or more and no status are classified
once, in a background Decisions request after that character's emotion request (never ahead of it): one choice question per memory
(`x_mem_status`, open / secret / resolved / none), at most 12 per request, with the memory in the entry format, their later
memories that share people or words, and their ties as state. The answer is stored (none as no status) with `_statusChecked`, so it
is never asked again; the next pick asks what is left; a failed request leaves them to the next pick. Its own breaker
(`_memStatusBreak`), the Decisions model, a Debug row "Memory status · …".

**The emotion pick feels them too.** `_emoStakeState` adds `memories_that_weigh_now` (`memWeighNow`): by the fragment's own rules,
today's and yesterday's memories of importance 2 or more, the last 14 days' of 3 or more, any 4–5 within 90 days, and every open
or secret one at any age — not a diary, not superseded, this world and chat — in the entry format, oldest to newest, at most ten
(open and secret kept first, then the newest). `earlier_today` now holds only what of today did not make that list (left out when
nothing did), and an ask's latest memories (`memories` ctx) leave out what the list carries: no memory is sent twice.
`x_emotion_pick` and `x_ego_pick` carry the fading rules in short (raw for hours to a day, strong for days, background for weeks, a
mood after months; importance 1–2 fades in a day or two, 3 over days to weeks, 4–5 never fully, changing shape; an open or secret
matter does not fade until a later memory resolves it and sharpens around the people involved; feelings can be mixed; acting calm
is not being calm) and say outright that someone who cheated on their spouse yesterday and hides it is not Calm today, least of all
around the spouse. Calm reads "settled; nothing much is pulling at them — not when an open or secret memory is weighing on them";
Guilt "…even when nobody knows and they act as if nothing happened". A stored old default of either question is replaced
(`_refreshPipe`, marker "HOW A PAST FEELING LASTS"); a saved emotion list whose Calm or Guilt still has the v150.67 description gets
the new one.

Pinned by `tests/memory-format.browser.js`; `tests/payload-faithful.browser.js` checks that only the memory lines changed.

## v150.73 — the reconciler keeps what matters, not everything

Reported from a live afternoon (64 fragments: texts, the kitchen, the bedroom, the shower, the goodbye): the reconciled
memories retold almost every beat, and the shower never became a memory.

- **Nothing is dropped.** `reconcilePeriodFor` kept the first three answers (`made.slice(0,3)`) after every fragment had
  gone in and been deleted, so a fourth and fifth answer — the shower and the goodbye — were lost. Every answer is stored
  now, up to five; anything past five is folded into the fifth.
- **The reckoning stays its own record.** `memsOfPeriod` leaves out `source:"after_heat"` (the DECISION the "After it is
  over" prompt writes), like a rumour or a glimpse; folded in, it was retold or lost.
- **The shipped prompt** (`DEFAULT_MEMRECONCILE`) says what to KEEP (what they would still know a week later: turns,
  firsts, what was agreed, promised, refused or risked, a name that mattered), what to DROP (the road there, repeated
  beats, who moved which hand, the order of positions, repeated "left with" notes), one quoted line at most and only when
  the line was the event, intimacy told plainly and concretely but not stroke by stroke, a length ceiling (about 120
  words for the biggest thing of the week), up to five memories when one long stretch moved through clearly different
  scenes, and that only a decision's own subject can reverse it.
- **Stored copies:** upgraded only while exactly the v150.72 default (`MEMRECONCILE_V150_72_OLD`); an edited copy is the
  player's (Settings → the reconciler → Reset to default brings the new one).

## v150.79 — a spike, not a repeat

A ledger talked over at dinner on day one had dozens of memories by day six, each scored like the last, while the evening
Berker's wife sat in the player's lap left one ordinary memory. Importance now follows what happened, not how often:

- **The builder's rule** (`DEFAULT_MEMBUILD`, importance_score): repetition is not importance — the same everyday topic
  again (an object, an errand, a bill, a figure, a chore) scores no higher than the last time, however much of the scene it
  took; a spike does (a secret nearly exposed, a spouse or partner walking in on someone with another person, being seen
  with the wrong person, a betrayal, a threat, a close call). The passage is `MEMBUILD_RULE_V150_79`; a stored copy is
  upgraded only while it is exactly the v150.78 default (the new default without it), an edited one is left alone.
- **Repetition capped in code** (`memRepeatCap`, in `commitMemoryArc`): a new memory sharing at least three key words (and a
  quarter of the shorter memory's) with three or more of the owner's memories of the last seven days is capped at the
  highest importance among those (`repeatCapped` records how many). A memory that changes what kind of thing it is — secret
  or resolved where those were neither — is not capped.
- **A spouse in the room** (`memSpikeScene`, `memSpikeMark`): a stretch of the player's scene with a pair tied as spouses or
  partners on their sheets and somebody else besides them (the player counts), where the stretch or the six lines before it
  read as intimate (`intimacyReads`, one cue enough; or a heat beat) or one of the pair carries a secret memory from that
  day. Every memory of that stretch (and the owner's intimate or secret memories of the same part of the day) gets at least
  0.8 and, when it has none, a status: open for someone who walked in on it, secret for the others (`spike` records why).
  Not for a glimpse from another area.

These reach `memories_that_weigh_now` (importance 4–5 weighs for 90 days; open and secret ones until resolved), recall and
the pursuit weight check's `{{source}}` (doc 08, "v150.79 — a topic earns its weight"). Test: `tests/pursuit-weight.browser.js`.

## v150.83 — an edited line is remembered as it now reads

Every payload reads the live message list, so an edit (or a delete) reaches the next reply's transcript at once. A
delete has also taken back what was built from the line since v148.6 (`_retryRollback`). An edit did not: the memories
cut from it, the player's memory of it and the plans filed from it kept the old words, and the old version came back
as something that happened.

`saveEditMessage` now calls `_editRecut(chat,mid,at)` when the text actually changed:

- **Memories.** The arc memories (characters' and the player's) that cite the line in `srcMids` are removed, and the
  span they covered is cut again with `commitMemoryArc`, stamped with the day and part of the day it was first filed
  under. `memDoneIdx`, the open arc and the live scene's `memCarry` are untouched. A re-cut that writes nothing (the
  model fails) puts the old memories back. A line no memory was cut from yet is left to the open arc.
- **Merged memories** (reconciled, condensed, diaries) are summaries of a whole stretch and stay as written.
- **Plans and the relationship read** are rolled back only when the edited line is the last one their engines read
  (`_ftReadMid`, `trkRead`, `_stUndo`), so the next turn reads it again. An older line's plans stay: re-reading from it
  would re-file every plan after it.

Test: `tests/edit-recut.browser.js`.

## v150.89 — fewer arcs, and a merge that keeps the transcript is sent back

Reported: a night out came back as one "reconciled" memory of ~2,500 words — every fragment, back to back. Two causes: the
chat arc tracker is told to close at the first resting point ("an intimate encounter is recorded beat by beat"), so one
encounter became dozens of fragments; and the reconciler, handed dozens of them, glued them together instead of keeping
what mattered, past its own "at most about 120 words".

**The arc judge (Decisions API).** `memArcDecide` asks two yes/no questions about the stretch the tracker holds open:
`x_mem_arc_over` (has what was happening completely ended — people parted, the encounter or conversation is over, the scene
went elsewhere; a landed beat, a lull, a kiss, a climax or a change of room is not the end) and `x_mem_arc_new` (did the
latest lines begin something clearly separate). State: the stretch so far (its opening and its latest 26 lines when long)
and the latest lines. A yes needs `MEM_ARC_DEC_AT` (0.7): unsure is "still going". It maps onto the tracker's own answer
(over → finished, separate → different) and both the scene and the text paths use it. The chat tracker (`memEval`) is asked
only when the judge is off (Settings → Memory → Arc judge, `memArcDec`, on by default), paused, or has no answer. An arc the
judge holds open has the old backstop of `MEM_ARC_CAP_DEC` = 40 lines; an arc the chat tracker judged keeps 12.

**The reconciler's length guard.** After the answer is parsed, any memory over `MEM_RECON_MAX_WORDS` (160), or an answer as
long as most of what went in (≥ 60% of ≥ 250 input words), goes back once through the same prompt, with its length and the
limit named and the instruction to cut every step and keep every fact. The shorter answer replaces it; a failed or longer
retry leaves the first answer (the fragments are only dropped once a replacement exists, as before).

Test: `tests/mem-arc-judge.browser.js`.
