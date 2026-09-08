# 09 · Memory

The system that makes continuity — the product's first pillar — real. Everything else in the
living world reads from it.

## Design stance

**Memory is event-bounded, per-character, and lossy on purpose.**

- **Event-bounded**, not window-based: a memory covers a *scene that finished*, not the last N
  messages. A conversation that runs forty turns is one memory, not eight overlapping ones.
- **Per-character**: each participant gets their own memory of the same event, scoped to what
  *they* witnessed. There is no omniscient record.
- **Lossy on purpose**: an importance floor, per-type caps, and long-term condensation exist
  because a bank that keeps everything retrieves nothing useful.

## Layer map

```
during play                      at day's end                   long term
───────────                      ────────────                   ─────────
arc tracker                      flush the open arc             condensation
  └─ on close ─┬─ participants → full structured memory
               └─ bystanders   → charged gist  ──────► gossip
text exchanges → their own path  one diary per character
place-leak on exit → vague talk  charged gists propagate
```

## Arc-bounded building

**R-MEM-1** — Memory building MUST be bounded by two markers: a **scene boundary** (the travel
beat, R-STATE-28) and a **committed boundary** — the message index through which memories have
already been cut.

**R-MEM-2** — The committed boundary MUST prevent re-covering messages already turned into
memories. Without it, overlapping arcs produce near-duplicate memories that then dominate
retrieval.

### The arc tracker

After each turn, a cheap judgement over the last few real lines returns whether the current arc
is ongoing, paused, or finished, and whether the topic has changed.

**R-MEM-3** — Commit paths, all of which produce the same result:

| Trigger | Action |
|---|---|
| Arc finished | Commit it |
| Topic changed | Commit the old arc, open a new one at the last player line |
| Arc exceeds a hard cap | Commit it — a safety valve for arcs that never close |
| Travel, or characters left behind | Flush |
| Day end | Flush, **stamped with the day that just ended** |

**R-MEM-4** — A day-end flush MUST be stamped with the ending day, not the new one. Every
day-filtered engine downstream reads "today's memories", and an off-by-one day stamp makes the
day's events invisible to all of them at once.

### Commit

**R-MEM-5** — Committing an arc MUST produce **one memory per participant**, each scoped to what
that character actually witnessed — their own arrival point within the arc, and the witness list
of each message in it.

**R-MEM-6** — Characters who were **present but not in the conversation** MUST get a different
artifact: a fuzzy outside impression carrying a **charge**, marked observer-only.

> **Parity — keep:** a bystander sees the shape of an argument, never the words. That distinction
> is what makes gossip work — what propagates through the world is an impression with an
> emotional charge, not a transcript. Merging the two would make every overheard scene as good as
> being in it.

**R-MEM-7** — An importance floor MUST drop trivia, and **charged bystander gists MUST be exempt
from it**, because the gossip engine needs them and they are rarely "important" on their own.

**R-MEM-8** — The importance floor MUST be bounded below the intent engine's own reading
threshold, and the UI MUST say so.

> **Parity — keep:** this is the single most common "the world went dead" misconfiguration. The
> offstage intent engine reads the day's memories above a fixed importance to form grudges and
> loyalties. Raise the storage floor above that and the intent engine starves — no grudges, no
> schemes, no confrontations — with nothing anywhere reporting a problem. **R-MEM-9 — This
> coupling MUST be enforced in code, not merely warned about**: the floor cannot be set above the
> threshold that would starve its consumers.

**R-MEM-10** — Phone texts MUST NOT enter arcs and MUST have their own memory path (R-STATE-27).

## Diaries

**R-MEM-11** — At day's end, each participating character writes one private diary entry from
that day's memories, in the story language, in the universe's diary voice.

**R-MEM-12** — Diaries MUST be short, standalone, and **never condensed**. They are the character's
own interpretation, which is exactly what condensation destroys.

**R-MEM-13** — Diary parsing MUST tolerate malformed structured output — unescaped newlines inside
strings are a real, recurring model failure and MUST be salvaged rather than dropped.

**R-MEM-14** — Diaries are **background** in a payload, never recited. A character does not quote
their own diary at you.

## Long-term condensation

**R-MEM-15** — When a character's raw bank exceeds a threshold, the newest N stay verbatim; older
ones — excluding diaries and existing long-term entries — are clustered by similarity, and each
cluster of two or more is merged into one long-term memory.

**R-MEM-16** — Clustering MUST use embedding similarity when semantic memory is on and a lexical
measure otherwise, with different thresholds per method.

**R-MEM-17** — The merged memory MUST be stamped with the **earliest** day of its cluster and
MUST record how many memories it absorbed. Originals are deleted; this is the one place memory is
destructive, and it MUST be bounded per pass and manually triggerable.

## Retrieval

Runs before every reply. **R-MEM-18 — Retrieval MUST be scoped to the responding character and
MUST NOT block the request beyond a bounded cost** (R-TURN-12).

### Tiers

**R-MEM-19** — Three tiers with independently configured counts, drawn from separate pools:

| Tier | Pool |
|---|---|
| Recent | Raw arc memories, searched over the whole bank |
| Diary | Diary entries |
| Long-term | Condensed and consolidated entries |

### Query

**R-MEM-20** — The query MUST combine a generated semantic query with the literal recent text, and
MUST fall back to lexical-only on any failure.

**R-MEM-21** — The query generator MUST write in the same language the memory bank is written in.

> **Redesign — was:** memories moved to English while the query generator kept asking for a query
> in the story language, so the lexical facet stopped overlapping on anything but proper nouns.
> No error, no report, just worse recall for an unknown period. **Now:** the query language is
> derived from the bank's declared language rather than configured independently — the two cannot
> drift (R-PAY-31).

### Scoring

**R-MEM-22** — Candidates MUST be scored across weighted, independently configurable facets:

| Facet | Measures |
|---|---|
| Semantic | Embedding cosine, or lexical overlap when embeddings are off or failed |
| People | The memory involves someone present |
| Location | The memory matches the current place |
| Recency | Decay over the game-day gap |
| Emotion | Mood-congruent recall — the owner's dominant current feeling toward the player biases toward congruent memories |
| Importance | The memory's own weight |

**R-MEM-23** — Facet weights MUST be user-adjustable, and their effect MUST be observable
(R-MEM-27).

### Balance

**R-MEM-24** — Post-ranking balance MUST be applied to the recent tier: a cap on the share of
intimate memories, refilled with other history, and a per-type cap.

> **Parity — keep:** without the intimate-share cap, one intense night dominates recall for a week
> — it scores highly on emotion, importance, and people simultaneously — and the character starts
> reading as though nothing else ever happened.

## Embeddings

**R-MEM-25** — Semantic memory MUST be opt-in, with vectors cached per memory **keyed to the model
that produced them**, back-filled in the background, and MUST fall back silently to lexical
scoring on any failure — with the failure recorded (R-PRIN-5).

## Injection

**R-MEM-26** — Retrieved memories are rendered into their payload blocks under their own headings,
and their placement in the payload is user-movable like any other block. Recent memories default
to the post-transcript half; long-term and diary default to the pre-transcript half.

## Observability

**R-MEM-27** — Every retrieval MUST write a **local** debug entry — no network — recording the
query, whether the semantic or lexical path was used, the active weights, and every candidate's
per-facet scores with the injected ones marked.

> **Parity — keep:** this is the app's best-designed diagnostic and it must survive the rebuild
> intact. "Are my retrieval weights doing what I set?" is otherwise unanswerable, and a user
> tuning weights blindly will conclude the feature is broken.

## Consequences of editing

**R-MEM-28** — The memory browser MUST allow filtering by owner, editing every field, manual
addition, and deletion — and MUST warn that memories are inputs to other systems.

> **Parity — keep:** raw memories feed retrieval, gossip, intents, diaries, the reconcilers, and
> the chronicler. Deleting one from the browser changes what the world *does*, not merely what a
> character recalls. A user who does not know that will delete an embarrassing memory and then
> report that a character's grudge vanished as a separate bug.

**R-MEM-29** — Bulk editing or deleting transcript messages MUST clamp open arc boundaries
defensively and MUST NOT corrupt the committed boundary.
