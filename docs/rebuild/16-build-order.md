# 16 · Build Order

Dependency order and exit criteria. Not a schedule — no dates, no estimates. Each phase ends when
its criteria are demonstrably met, and the criteria are stated as things you can check rather than
things you can feel.

## The sequencing rule

**R-BUILD-1** — Build **downward-facing infrastructure before the feature that needs it**, and
build the *validation* for a contract in the same phase as the contract.

This is the one sequencing decision that matters, and it is counter-intuitive: it means the
registry validators (R-ARCH-7) exist before there is much to validate, and the debug surface
exists before there is much to debug. Both feel premature. Both are what stop this rebuild from
becoming the thing it is replacing — every defect in
[`15-redesign-register.md`](15-redesign-register.md) is a contract that existed before the check
for it, and several of them shipped in the *first version* of their subsystem.

**R-BUILD-2** — A phase MUST NOT begin before the previous phase's exit criteria are met. The
phases are dependency-ordered, not priority-ordered.

---

## Phase 0 — Decisions

No code. Close the open decisions in
[`15-redesign-register.md`](15-redesign-register.md#open-decisions).

**Exit criteria**

- [ ] Source layout chosen, with reasons recorded (R-ARCH-20), and the five properties in
      R-ARCH-19 shown to be satisfiable by it
- [ ] Legacy import scope decided (R-SET-17)
- [ ] The token set from [`03-visual-design-system.md`](03-visual-design-system.md) defined
      concretely, with contrast ratios checked (R-VIS-2)

---

## Phase 1 — Foundation

The bottom layer, plus the machinery that keeps every later phase honest.

**Build:** the storage abstraction over two tiers · id generation · schema declaration and
validation · the durable/transient split · automatic change detection and debounced persistence ·
the migration mechanism including self-invalidation · the registry mechanism and its validators ·
the event bus · the debug log.

**Exit criteria**

- [ ] R-STATE-1..17: ids opaque, references by id, storage abstracted, tiers respected,
      transience declared, unknown fields preserved
- [ ] R-STATE-13: a record can be mutated with no additional call and the change persists
- [ ] R-STATE-14: a write in flight survives page-hide
- [ ] R-STATE-36: a migration whose criterion no longer discriminates stands down and reports
- [ ] R-ARCH-7: registry validation runs at startup and reports **in the app** (R-ARCH-8)
- [ ] R-OBS-5, R-OBS-12: the debug surface renders entries and startup validation results
- [ ] A deliberately broken registry entry of each validated kind is caught, named, and told how
      to be fixed (R-OBS-13)

---

## Phase 2 — Provider gateway

**Build:** the single text call path with call classes · reasoning policy · the four recovery
paths · normalisation · model selection with fallback chains · the observability tap.

**Exit criteria**

- [ ] R-PROV-4: exactly one text call path exists; no component reaches a provider directly
- [ ] R-PROV-5, R-PROV-6: sampling applies to roleplay calls and never to engine calls
- [ ] R-PROV-9: a thinking-only response yields empty content, never the trace, and triggers the
      empty-content path
- [ ] R-PROV-10: each of the four failure classes is separately reproducible and separately
      handled, with distinct user-facing messages
- [ ] R-PROV-11: a refusal never renders and is never reported as a token-limit problem
- [ ] R-PROV-12: recovery attempts appear inside the originating debug entry
- [ ] R-PROV-29, R-PROV-31: every call is logged; credentials are redacted
- [ ] R-PROV-34: every known provider condition has a plain-language mapping

---

## Phase 3 — Composition

The layer where the app's identity lives. Purity is the whole point of doing it this early.

**Build:** the block registry with kinds and rule ownership · fragments with declared variables ·
the prompt registry with schemas · three-layer prompt resolution · the language policy · payload
assembly · layout persistence and self-healing · the payload inspector.

**Exit criteria**

- [ ] R-ARCH-17: composition performs no I/O and mutates nothing; the same input yields the same
      payload
- [ ] R-PAY-1: all reply variants derive from one block set and one default order
- [ ] R-PAY-16, R-PAY-17: no literal prose in an assembler; an unfilled placeholder cannot reach a
      model, demonstrated by a deliberate omission being caught
- [ ] R-PAY-23, R-PAY-24: a saved layout containing an unknown id self-heals; a removed block stays
      removed
- [ ] R-PAY-26, R-PAY-27: one prompt read path; both directions of referential integrity validated
- [ ] R-PAY-30: every call selects a language directive; a call with none fails validation
- [ ] R-PAY-36, R-PAY-38: a payload is inspectable per call and re-assemblable from stored state
- [ ] R-OBS-15: composition is exercisable from a state snapshot with no network

---

## Phase 4 — First playable

The smallest thing that is recognisably this product: one universe, a cast, a scene, and replies
that remember nothing yet.

**Build:** universes and characters · locations with sub-areas and earshot · game time · the turn
pipeline through generation and presentation · witness scoping and history assembly · the Story
screen · the settings surface generated from the registry.

**Exit criteria**

- [ ] R-TURN-15, R-TURN-16, R-TURN-17, R-TURN-18: the four history transformations apply in order;
      untagged lines are excluded; the perception filter strips thoughts and retains action;
      compaction exempts narrator lines and the speaker's own
- [ ] R-TURN-8: routing casts from the sub-area, not the location
- [ ] R-TURN-14: target resolution happens once and reaches every block
- [ ] R-TURN-24: all three repetition measurements implemented, each with its own retry note
- [ ] R-STATE-22: entrance uniqueness holds through every path that can create a sub-area
- [ ] R-SET-7: adding a tunable requires only a registry entry
- [ ] R-PROD-1, R-PROD-2: nothing blocks the reply; enrichment runs after it is visible
- [ ] R-PROD-7, R-OBS-9: the instruction/transcript ratio is displayed and flagged
- [ ] R-UX-4, R-UX-5: error bubbles are unmistakable; the three-part markup renders distinctly

**This phase is the honest checkpoint.** If the turn does not feel right here, no amount of
simulation on top will fix it.

---

## Phase 5 — Memory

**Build:** arc tracking and commit paths · per-participant scoping · bystander gists · the
importance floor with its enforced bound · diaries · retrieval with weighted facets and balance ·
the retrieval trace · the memory browser.

**Exit criteria**

- [ ] R-MEM-1..5: arcs bounded by scene and committed boundaries; one memory per participant,
      witness-scoped
- [ ] R-MEM-4: a day-end flush is stamped with the ending day, verified by a day-filtered consumer
      seeing it
- [ ] R-MEM-6, R-MEM-7: bystanders get charged gists, exempt from the floor
- [ ] R-MEM-9: the importance floor **cannot be set** above the threshold that would starve its
      consumers
- [ ] R-MEM-21: query language derives from the bank's language and cannot drift from it
- [ ] R-MEM-24: the intimate-share and per-type caps demonstrably alter a ranking
- [ ] R-MEM-27: every retrieval writes a local trace with per-facet scores
- [ ] R-MEM-28: the browser warns that memories are inputs to other systems

---

## Phase 6 — Simulation, part one

Relationships, trackers, and the two directors. The point at which the world starts acting.

**Build:** the scheduler with declared budgets and the priority ladder · the day pipeline with
declared dependencies · relationships on three cadences · trackers · the Gamemaster · the Scene
Writer · the calendar · promises.

**Exit criteria**

- [ ] R-ARCH-11, R-ARCH-12: engines are never invoked from a call site; a cap cannot be exceeded by
      adding a caller
- [ ] R-ARCH-13, R-TURN-32: exactly one turn-consuming behaviour wins; a candidate without declared
      precedence fails boot
- [ ] R-SIM-6, R-SIM-7: pipeline order is declared and validated; the day is snapshotted before the
      marker is pushed, verified by diaries seeing a non-empty day
- [ ] R-SIM-8: a pipeline interrupted mid-run does not lose the day
- [ ] R-SIM-4, R-OBS-3: every run records ran-or-skipped with one of six reasons
- [ ] R-SIM-39: commitments are published once; the subscriber list is enumerable in the debug
      surface
- [ ] R-WORLD-27: the tracker dice roll is code
- [ ] R-WORLD-32, R-WORLD-33: three relationship layers, fast axes decay
- [ ] R-SIM-52: engine cost is visible in settings before a cadence is changed

---

## Phase 7 — Media

**Build:** the image pipeline with per-character continuity · appearance injection and reference
sheets · rules and routing · one video request builder with job recovery · gallery.

**Exit criteria**

- [ ] R-MEDIA-1, R-MEDIA-4, R-MEDIA-5: one image per turn; continuity per character; presence
      change invalidates it
- [ ] R-MEDIA-13: one video request builder, parameterised
- [ ] R-PROV-21, R-MEDIA-14: a deliberately failed asset upload fails the request loudly
- [ ] R-PROV-20, R-MEDIA-18: a generation job survives navigation and is recoverable
- [ ] R-MEDIA-16: a toggle affecting a request commits on change, verified in the request body
- [ ] R-STATE-16, R-MEDIA-35: eviction never strips a remote reference; restore-on-reload holds
- [ ] R-MEDIA-3: every generated asset exposes the prompt that made it

---

## Phase 8 — Simulation, part two

The depth layer. Everything here is optional to a shipping product and is what makes it *this*
product.

**Build:** the gossip ledger · offstage intents and armed plans · confrontations and overtures ·
world pulse and goal pursuit · the goals curator · character quests and quest arcs · proactive
texts · universe memory and the chronicle.

**Exit criteria**

- [ ] R-STATE-30, R-SIM-19: all three ledgers have owners, terminal states, decay, and caps
- [ ] R-SIM-20: only the stakeholder raises, once, and raising spends the move
- [ ] R-SIM-21: a paraphrase of a live rumour folds in rather than duplicating
- [ ] R-SIM-24: every gate is code-evaluated
- [ ] R-SIM-28: every event resolves into recorded consequences
- [ ] R-SIM-29: the two judges share one schema declaration
- [ ] R-SIM-32: due plans still execute with the world pulse disabled
- [ ] R-SIM-40, R-SIM-41, R-SIM-43: the want-list is rewritten not appended, bounded, and never
      contradicts the authored foundation
- [ ] R-SIM-44: editing authored goals resets the maintained list, explicitly
- [ ] R-PAY-11: the text variant suppresses room blocks and keeps person blocks

---

## Phase 9 — Voice

**Build:** dubbing with ordered queue and per-character voices · narration mode · open mic ·
real-time calls with barge-in.

**Exit criteria**

- [ ] R-PROV-24: lines are spoken in generation order under induced latency
- [ ] R-PROV-28, R-MEDIA-29: a reload never reopens the microphone
- [ ] R-PROV-27, R-MEDIA-31: call context is bounded by a rolling summary
- [ ] R-MEDIA-32: a call is committed to memory through the normal path
- [ ] R-MEDIA-33: calls have their own exportable diagnostic trail

---

## Phase 10 — Operations

**Build:** the four export granularities · rolling snapshots · import with validation and safety
snapshot · legacy import (per the Phase 0 decision) · the danger zone · versioning and the offline
cache · onboarding.

**Exit criteria**

- [ ] R-SET-11..15: four export sets; the full export labelled a secret; the debug export scrubbed
      and visually distinct; import validates and snapshots first
- [ ] R-SET-16: an export from an older schema imports through the migration path
- [ ] R-SET-19: resetting a world clears play and keeps the world, cast, locations, and transcripts
- [ ] R-SET-21: one version source; a release cannot ship a stale cache identifier
- [ ] R-SET-24: persistent storage requested; usage shown against budget
- [ ] R-UX-20: first run reaches a playable turn with no irreversible choice
- [ ] R-PROD-3, R-PROD-4: a kill while backgrounded loses nothing beyond the turn in flight; the
      app is usable offline

---

## The standing acceptance test

**R-BUILD-3** — Before any release, the diagnostic walkthrough at the end of
[`14-observability-and-failure.md`](14-observability-and-failure.md) MUST be performable end to
end, without leaving the app.

A user notices a character has stopped remembering. They reach the reply's debug entry from the
message, see the empty memory blocks, open the retrieval trace, find that nothing cleared the
floor, find the floor's coupling warning beside the control, lower it, and export a scrubbed
bundle if they still need help.

Every step of that is a requirement in this spec set. If the walkthrough breaks, something in the
observability chain has regressed — and that chain is the only support this product has.
