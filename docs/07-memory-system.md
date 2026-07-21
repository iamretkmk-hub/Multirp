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
3. Commit paths → `commitMemoryArc(chat, start, end, dayStamp?)`:
   - `finished` → commit the arc;
   - `topic:different` → commit the old arc, open a new one at the last user line;
   - safety valve at `MEM_ARC_CAP` (40 messages) for arcs that never close;
   - travel (characters left behind) and **End Day** → `flushMemoryArc` (stamps the
     *just-ended* day so day-filtered engines still see it).
4. `commitMemoryArc` builds **one memory per participant**, each scoped to what that character
   actually witnessed (their arrival cut within the arc + `witnessedBy(m,p)` on `present[]`):
   - **Participants** get `memBuild` → full structured memory (JSON: content, people, emotion,
     feelings, importance, tags, type).
   - **Bystanders** (present but not in the conversation) get `gistBuild` → a fuzzy outside
     impression (OBSERVATION with `gist`, `charge`, `observerOnly`) — they *see the shape*,
     never the words. Charged gists (≥0.5) are exempt from the importance floor because the
     gossip engine needs them.
   - **Storable floor**: importance < `state.memMinImp` is dropped.
     ⚠️ Keep the floor well below **0.55** — the offstage intent engine reads memories at that
     importance to form grudges/loyalties; a high floor starves the living universe.
5. Phone texts never enter arcs (excluded from the judged window); `rememberTextExchange`
   writes their memories separately.

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
