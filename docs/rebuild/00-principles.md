# 00 · Design Principles

Ten rules. Every later document in this set is an application of one or more of them, and
every one of them was paid for — each traces to a defect the current app shipped, usually more
than once, usually silently.

They are ordered by how much damage violating them does.

---

## 1 · One owner per fact

**R-PRIN-1 — Every rule, value, and piece of prose in the system MUST have exactly one
definition site. Everything else that needs it MUST derive it, not restate it.**

### Why

This is the single largest source of defects in the app's history, and it recurs in every
subsystem:

- A standing commitment must be visible to the speaking character, to the Gamemaster and
  Scene Writer, to the four offstage engines, and to the goals curator. Today those are four
  independent read paths that "must stay in step". When one was added and the others were not,
  the world wrote straight through a promise a character had given.
- Four separate prompt blocks branch on whether the speaker is continuing their own last line.
  When a fifth was added that disagreed, it won — because it sat closest to generation — and
  the character answered a question nobody had asked.
- A rule restated "for emphasis" in a second block lands twice, because the de-duplicator only
  strips *verbatim* repeats of a whole section and a paraphrase survives.

Each of these was fixed as a case. None was fixed as a class. A rebuild that keeps N read
paths for one fact will reintroduce all of them, because the failure is not carelessness — it
is that nothing in the design makes the Nth reader discoverable from the first.

### What it obliges

- A fact that more than one consumer needs is **published once** by the system that owns it,
  and consumers subscribe to that publication. Adding a consumer requires no edit to the
  producer and no edit to the other consumers.
- Where derivation is genuinely impossible and a value must be duplicated, the duplication
  MUST be generated from the source, and the generator MUST fail loudly when the source
  changes shape.
- Prose rules follow the same law. Each behavioural rule stated to a model has exactly one
  owning block. [`08-prompt-composition.md`](08-prompt-composition.md) carries the ownership
  table; a rule appearing in two blocks is a defect, not emphasis.

---

## 2 · Contracts are declared, not remembered

**R-PRIN-2 — Any agreement between two parts of the system MUST be expressed as data that both
parts read. A contract that exists only in a comment, a checklist, or a person's memory is not
a contract.**

### Why

The app's most expensive failures are all *shape* failures that no error surfaced:

- An engine was refactored from batch to per-item; its prompt kept asking for an array.
  `typeof [] === "object"`, so the guard passed, every field read back `undefined`, and the
  tracker silently stopped moving. No exception, no log line, no user-visible error — the
  feature just went quiet for an unknown number of releases.
- A prompt containing `{{tokens}}` was read without being filled, so the literal characters
  `{{user}}` reached the model. This ran for months.
- A prompt asked for nine deltas; the call site supplied five values. The other four
  accumulated from the model's guesses and fed a baseline nothing could audit.
- The registry array property had to be called `blocks`; a different name crashed boot.

Every one of these is two declarations of one contract, drifting. The current mitigation is a
documentation table listing where to look. That mitigation has failed repeatedly and will keep
failing, because it depends on the editor already knowing what they don't know.

### What it obliges

- **Prompts declare their output schema as data.** The parser is derived from that declaration
  or validates against it. Changing the schema and not the prompt (or vice versa) MUST be a
  detectable error, at boot or at build time.
- **Prompts declare their placeholders as data.** The set of tokens a prompt contains and the
  set a call site supplies MUST be reconcilable mechanically. An unfilled placeholder MUST NOT
  reach a model.
- **Registries validate their own entries** at startup — required fields, referential
  integrity to other registries, no orphans in either direction.
- A contract violation SHOULD be caught before the feature runs. Where that is impossible, it
  MUST be caught the first time the feature runs, and it MUST be visible
  ([principle 5](#5--fail-soft-never-fail-silent)).

---

## 3 · Identity is permanent, presentation is not

**R-PRIN-3 — Anything users' stored data references by string — entity ids, block ids, prompt
keys, storage keys, tracker keys — is permanent. It MUST be assignable once and never
rewritten. Everything a human reads MUST be a separate, freely editable label.**

### Why

The current codebase states this as four separate prohibitions ("never rename a block id",
"never rename a storage key", "never rename a prompt key", "prefer never renaming a
character") because in each case a rename orphans saved data silently: defaults kick in, the
old value is ignored forever, and nothing reports it.

Character names are the worst case, and instructive: memories match people by **name**,
relationship prose embeds names, presence notes are parsed by name, and legacy witness lists
are names. A rename mid-campaign therefore fractures history in five systems at once, and the
documented advice is to not do it — advice, for something a user will reasonably want to do.

The problem is not that renaming is hard. It is that identity and display were never
separated, so every rename is a data migration.

### What it obliges

- Ids are opaque, generated, and never derived from user input. No id encodes a name, a type
  prefix that could change, or an ordinal.
- Nothing durable stores a **name** where it means an **entity**. Memories, witness lists,
  relationship records, calendar entries, and quest references store ids. Names are resolved
  for display and for prompt text at render time.
- Renaming any user-facing thing — character, location, universe, tracker, style — MUST be a
  pure label edit with no migration and no data loss, and MUST be supported in the UI.
- Where a legacy import supplies names instead of ids, resolution happens **once at import**,
  and unresolvable references are recorded as unresolved rather than guessed.

---

## 4 · Code decides, models judge

**R-PRIN-4 — Gates, thresholds, caps, dice, due-matching, placement, scheduling, and every
other decision with a determinate answer MUST be evaluated in code. Models produce judgments
and content only.**

### Why

This one the current app got right, deliberately and consistently, and it is why the
simulation is debuggable at all: quest approach gates are code-checked, tracker dice are
rolled in code, calendar due-matching is code, character placement is a code-side weighted
roll. The model is asked *"is this scene stale?"* and *"write the nudge"*; it is never asked
*"has three days passed?"*

The value is not just correctness. It is that a code decision is inspectable, testable,
reproducible, and free. A model decision is none of those and costs a call.

### What it obliges

- Every autonomous behaviour separates its **trigger** (code) from its **content** (model).
- No engine may be given authority over a number the code can compute.
- A model's structured output is treated as a *proposal* that code validates, clamps, and may
  reject — never as a command. Bounded values are clamped at the boundary, not trusted.

> **Parity — keep:** this is preserved wholesale from the current design, which states it as
> design value 4 in `docs/12`. It is the reason the living-universe layer can be reasoned about.

---

## 5 · Fail soft, never fail silent

**R-PRIN-5 — A subsystem that fails MUST NOT block the story, and MUST leave a trace that
names the subsystem, the failure, and the consequence. "Fail soft" alone is a defect.**

### Why

The app's fail-soft policy is correct and load-bearing: an engine that errors skips its beat
and the player keeps playing. But the current implementation stops there, and the result is
documented plainly in `docs/13`: *"engines fail soft = feature goes quiet, no error"*.

That is how a tracker stopped moving for releases. That is how a retrieval facet stopped
overlapping when the memory language changed underneath it. The user cannot report a feature
that stopped, because from outside a feature that never fires looks exactly like a feature
that had nothing to say. The developer cannot find it, because nothing was written down.

Silence is the worst possible failure mode for a system built almost entirely out of
best-effort background jobs.

### What it obliges

- Every engine run — success, skip, or failure — records an outcome: which engine, why it
  ran or didn't, what it produced, how long it took, what it cost.
- **A skip is an outcome, not an absence.** "Gated off by setting", "cadence not due", "no
  eligible characters", and "the call threw" are four different entries and MUST be
  distinguishable.
- The trace is available on the device the app runs on, without a console, without a cable —
  the debug surface is the only diagnostic tool a phone user has
  ([`14-observability-and-failure.md`](14-observability-and-failure.md)).
- A subsystem that has produced nothing for an unusually long time SHOULD be able to say so.

---

## 6 · Nothing hidden

**R-PRIN-6 — Every model id, prompt, threshold, cadence, cap, and toggle the system uses MUST
be visible and editable by the user. No behaviour may depend on a value that exists only in
source.**

### Why

The current app converged on this the hard way — `docs/03` records that "previously hidden —
now selectable" appears repeatedly in its history as a *fix*. Hidden values are hidden bugs:
the refusal-fallback model, the STT fixer, the portrait model, and the map-image model were
all hardcoded until someone needed a different one and could not have it.

There is a second reason, specific to this product. The entire behaviour of the app is prompt
behaviour. A user whose characters feel wrong has exactly one lever that matters — the text
sent to the model — and hiding any part of it makes the app unfixable by the person
experiencing the problem.

### What it obliges

- Adding a tunable value to an engine and adding it to the settings surface are **one change**,
  not two, and the second half MUST NOT be optional.
- Defaults are visible as defaults, and every override can be reset to its default
  individually.
- The assembled prompt itself is inspectable in full, per call, after the fact
  ([principle 9](#9--the-payload-is-a-user-visible-object)).

---

## 7 · Old saves keep working

**R-PRIN-7 — Migrations MUST be additive, idempotent, and non-destructive. Data that cannot be
upgraded MUST be left reachable, never dropped. A migration that can overwrite user-authored
content MUST verify, at run time, that it can still distinguish our content from theirs — and
MUST stand down when it cannot.**

### Why

The first half of this the current app does well; every migration in `loadState()` repairs or
re-parents rather than deleting, and unknown payload blocks self-heal back into place.

The second half is the sharpest lesson in the entire codebase. `_refreshPipe` exists to
refresh a stored prompt that is recognisably one of *our* old defaults, identified by a
fingerprint plus the absence of a revision marker. It works — until a later rewrite drops that
marker from the current default. At that moment the default itself satisfies the reset
condition, the pipe can no longer tell a stale copy from the text the user edited this morning,
and it overwrites their work **on every single load, forever, with no error**.

The fix that shipped is the right shape and generalises: the migration tests its own target
first and disables itself when it can no longer tell the difference. That is a rule about all
destructive-capable migrations, not about prompts.

### What it obliges

- No migration deletes. Repair, re-parent, mark, or ignore.
- A migration that rewrites user-editable content MUST be self-invalidating: it checks whether
  its own detection criterion still discriminates, and stands down (loudly) when it does not.
- Self-healing beats migration where possible — a saved ordering that references an unknown id
  drops it; a saved ordering missing a new id re-inserts it at the default position. Neither
  needs a version bump.
- Unknown fields in stored records are preserved on write-back, not stripped.

---

## 8 · Autonomy is budgeted

**R-PRIN-8 — Anything that can act without the player MUST declare a cadence, a per-period cap,
a cost, and an off switch, and MUST be prevented in code from exceeding them.**

### Why

This app's distinguishing feature is a world that moves on its own: characters gossip, form
intents, pursue goals, text first, arrive to confront you. Every one of those is a model call
someone pays for, and several fire per turn.

The current design already takes this seriously — the goals curator is capped at six characters
a day and skips anyone the day did not move; the promise engine runs every second turn;
proactive texts are at most one per in-game period; the End Day pipeline is explicitly
described as turning into "a queue" if the caps are lifted. That discipline is why the app is
usable on a phone at all.

It is also *fragile*, because the caps are per-engine conventions rather than a shared
mechanism. A new engine gets caps only if its author remembers.

### What it obliges

- Autonomy budgets are a property of the engine registry, declared alongside the engine, not
  written into each engine's body.
- The scheduler enforces the budget. An engine cannot exceed its own cap by being called from
  a new place.
- Turn-consuming behaviours (anything that takes the scene away from the player) participate in
  a single explicit priority ladder — exactly one may win a turn. Today this is enforced by a
  sequence of early returns whose ordering is load-bearing and undocumented at the call site.
- Every budget is visible and adjustable ([principle 6](#6--nothing-hidden)), and every
  autonomous engine has an off switch that leaves the rest of the world running.

---

## 9 · The payload is a user-visible object

**R-PRIN-9 — The assembled instruction package sent to a model is a first-class artifact: an
ordered list of labelled, individually removable blocks, inspectable after the fact, with every
fixed sentence in it editable in place.**

### Why

This is the current app's best idea and the rebuild keeps it without dilution. The reply
payload is not a string built by concatenation somewhere in the send function — it is an
ordered list the user can reorder, remove blocks from, and read back in the debug view as
labelled capsules.

That design is why a class of problem that is otherwise undebuggable becomes tractable. The
app can state, of a real scene, that *instructions are ~6,200 tokens and the transcript is
~1,260 — the story is 17% of what the model reads*, and can flag that ratio in the debug view.
A reply that feels mechanical stops being a mystery and becomes a number with two knobs
attached.

The corollary is where the current build leaks: fixed prose written inline inside a producer,
rather than routed through an editable fragment, is invisible to the editor. The editor then
shows something different from what is actually sent — which is worse than not offering an
editor, because it is confidently wrong.

### What it obliges

- Blocks are declared with a stable id, a human label, and a description. Order is data.
- **No literal prose in an assembler.** Every fixed sentence is a fragment with a default, a
  consumer, and a listing. All three legs MUST be mechanically checkable — the current boot
  guard checks two of the three and cannot see a producer that stopped calling for its
  fragment, which is precisely the leak described above.
- Removing a block is a user action that persists explicitly, so self-healing does not
  resurrect it.
- Every model call records the exact assembled input, block by block, retrievable on-device.

---

## 10 · Position is meaning

**R-PRIN-10 — In an instruction payload, *where* a rule sits is part of what it says. Ordering
MUST be treated as designed behaviour with stated rationale, never as an implementation detail.**

### Why

The subtlest failure in the app's history, and the one least likely to be re-derived:

The formatting contract is block 3 of 30. By the time the model generates, roughly twenty
thousand characters have gone by, and **five** later blocks have each asked the character for
physical behaviour — what your hands are doing, your body has moved on, do something, end on
something you DO. Nothing since block 3 capped it. A live reply came back as four paragraphs
of narration wrapped around three lines of speech, and *every content rule had been obeyed
while every form rule was ignored.*

The lesson is stated in the source as: form is a position problem, not a wording problem.
Rewriting block 3 to be more emphatic would not have worked. The related rule — that a
position instruction placed in the final line of the payload outweighs everything and will
contradict a format the user has legitimately edited — is the same insight from the other side.

### What it obliges

- The default order of every payload is specified with reasons, block by block, in
  [`08-prompt-composition.md`](08-prompt-composition.md). It is not an accident of when blocks
  were written.
- Each block declares what kind of instruction it may carry — **volume**, **shape and
  position**, **content**, **guardrail** — and a rule of the wrong kind in a block is a defect.
- A rule that describes a *situation* MUST be gated on that situation actually occurring. An
  always-on prohibition against something that is not happening dilutes the ones that are.
- Blocks that render empty keep their slot next to their logical neighbours; emptiness is not
  reordering.

---

## Applying these

When two principles appear to conflict, the lower-numbered one wins, with one exception:
principle 4 (code decides) is never traded away for principle 8 (budget) — an engine that is
too expensive gets a tighter cadence, never a model call replacing a code decision.

If a proposed design cannot satisfy a principle, that is a finding worth recording in
[`15-redesign-register.md`](15-redesign-register.md) with its reason, not a rule to quietly
skip. The current app's warning list exists because several such decisions were made without
being written down, and every one of them was rediscovered later as a bug report.
