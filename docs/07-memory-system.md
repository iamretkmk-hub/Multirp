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
the diary owns that.

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

Per character, when the raw bank reaches `memMaxBeforeCondense` (default 50): the newest
`memCondenseStart` (30) stay verbatim; older ones (excluding DIARY/LONGTERM) are **clustered
by similarity** — embedding cosine ≥ 0.82 when semantic memory is on, else word-set Jaccard
≥ 0.5 — and each cluster of ≥2 is merged by the `condensePrompt` model into ONE `LONGTERM`
memory (originals deleted, merged one stamped with the earliest day, `condensedFrom` count).
Bounded to 4 clusters per pass; fully best-effort. Manual trigger: Memory screen → Condense
(`condenseAllNow`).

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

## Embeddings (semantic memory)

Opt-in (`embedOn`). `embedText` calls the OpenRouter embeddings endpoint (model
`embedModel` → `openai/text-embedding-3-small`) using the main OpenRouter key; vectors are
cached per memory keyed to the model (`memVec`); `ensureMemEmbeddings(ownerId, batch)`
back-fills in the background after each retrieval. Any failure ⇒ silent lexical fallback
(`_embLastErr` surfaces in the retrieval trace).

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
