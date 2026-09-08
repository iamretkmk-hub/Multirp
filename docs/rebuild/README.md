# StoryMind — Rebuild Specification

This folder is **the instruction set for building StoryMind again from nothing.**

It is not a description of the code that exists. `docs/01`–`docs/13` are that: an as-built map
of the current `index.html`, accurate and detailed, written by reading the thing that runs.
This folder is the opposite direction. It starts at *what the product is supposed to be* and
descends, document by document, to the level of individual contracts — the shape of a stored
record, the order of blocks in a prompt, the states a media job may be in — so that an
implementer who has never seen `index.html` can build a system that behaves the same and
breaks in fewer places.

## The two things this spec set is deliberately doing

**1. It is architecture-neutral.** No document here tells you to write one HTML file, or to
write ES modules, or to use a framework. Every requirement is expressed as behaviour, data
shape, or contract between parts. [`04-architecture.md`](04-architecture.md) states the
boundaries the implementation must honour and then weighs the file-layout question openly, as
a decision to be made *once, with reasons*, rather than inherited. Everything else in the set
holds regardless of how you answer it.

**2. It is parity plus a redesign pass.** The rebuild covers everything the app does today —
nothing is quietly dropped. But this is not a transcription. The current app has a long, well
documented history of the *same class of bug* recurring: a contract held in two places that
drifted apart, a string key that could never be renamed, a prompt whose output shape stopped
matching the parser that read it. Those are recorded in `docs/13` as warnings to be careful
around. Here they are treated as design defects with fixes. Where the rebuild departs from
today's behaviour, the document says so in a callout:

> **Redesign — was:** what the current app does, and the bug it produced.
> **Now:** what the rebuild does instead, and why that removes the class rather than the case.

Where the rebuild deliberately keeps today's behaviour — including behaviour that looks odd
until you know why — it says that too:

> **Parity — keep:** the behaviour, and the reason it is not a mistake.

Both callouts are load-bearing. A reader who skips them will re-derive the old design.

## Reading order

The set descends from least to most specific. Read it in order the first time; after that,
enter at the layer you are working in.

| # | Document | Layer | What it fixes in place |
|---|---|---|---|
| 00 | [Design principles](00-principles.md) | Foundation | The nine rules every later document is an application of, each traced to a real failure |
| 01 | [Product specification](01-product-spec.md) | Foundation | What the app is, who it is for, the core loop, the full feature inventory with parity levels, explicit non-goals |
| 02 | [Experience design](02-experience-design.md) | Design | Screens, flows, the felt shape of a turn, the latency and feedback contract, where errors surface |
| 03 | [Visual design system](03-visual-design-system.md) | Design | Tokens, colour, type, icons, the component inventory, theming, layout, motion, accessibility |
| 04 | [Architecture](04-architecture.md) | Platform | Layers and dependency rules, the registry pattern, what must be checkable at boot, the file-layout decision |
| 05 | [State & data model](05-state-and-data-model.md) | Platform | Every entity schema, id policy, storage tiers, the persistence contract, migration policy |
| 06 | [Provider layer](06-provider-layer.md) | Platform | The single AI gateway: request shape, retries, refusal, reasoning, the observability requirement |
| 07 | [Turn pipeline](07-turn-pipeline.md) | Engine | Keypress to reply: routing, presence, witness scoping, history assembly, repetition control |
| 08 | [Prompt composition](08-prompt-composition.md) | Engine | The payload system: blocks, ordering, fragments, the prompt registry, language policy |
| 09 | [Memory](09-memory.md) | Domain | Arc-bounded building, gists, diaries, condensation, weighted retrieval |
| 10 | [Simulation](10-simulation.md) | Domain | The two clocks, the ledgers, every autonomous engine, the ordering contract |
| 11 | [World systems](11-world-systems.md) | Domain | Universes, characters, places and earshot, time, trackers, relationships |
| 12 | [Media & voice](12-media-and-voice.md) | Domain | Images, video, scenes, dubbing, calls |
| 13 | [Settings, backup & migration](13-settings-backup-migration.md) | Operations | The settings surface, export/import sets, versioning and release |
| 14 | [Observability & failure](14-observability-and-failure.md) | Operations | The debug surface, the fail-soft policy and its limits, boot self-checks |
| 15 | [Redesign register](15-redesign-register.md) | Operations | Every departure from today's design in one table, with the bug each one closes |
| 16 | [Build order](16-build-order.md) | Operations | The phase plan: what to build first, and the acceptance criteria that end each phase |
| 17 | [Port & verification](17-port-and-verification.md) | Operations | Getting there from the app that exists: corpus extraction, the differential payload harness, the parity checklist |

## How requirements are written

Every normative statement uses **MUST / MUST NOT / SHOULD / MAY** in the RFC 2119 sense.
"MUST" means an implementation that does otherwise is wrong, not merely different.

Numbered requirements carry stable ids of the form `R-<AREA>-<n>` — `R-STATE-7`,
`R-PAY-3`. These ids are referenced by [`16-build-order.md`](16-build-order.md) as
acceptance criteria and by [`15-redesign-register.md`](15-redesign-register.md) as the fix for
a recorded defect. **Ids are append-only.** Retiring a requirement means marking it withdrawn,
never renumbering the ones after it — the same rule this spec set applies to the product's own
string keys, for the same reason.

Anything not marked with a requirement id is rationale. Rationale is there because a rule
whose reason is lost gets deleted by the next person who finds it inconvenient; several of the
bugs this spec set exists to prevent were introduced exactly that way.

## What this set does not contain

- **Code.** No function signatures, no snippets to paste. The specs name behaviours and
  contracts; naming is the implementer's. The one exception is
  [`17-port-and-verification.md`](17-port-and-verification.md), which is operational rather than
  normative and carries harness sketches.
- **A schedule.** [`16-build-order.md`](16-build-order.md) gives dependency order and exit
  criteria, not dates.
- **Provider API documentation.** [`06-provider-layer.md`](06-provider-layer.md) specifies the
  gateway's contract with the rest of the app; the wire format of any given vendor is
  external, changes without notice, and is deliberately confined to one replaceable layer.
- **The old data model as a constraint.** The existing app's data is treated in
  [`13-settings-backup-migration.md`](13-settings-backup-migration.md) as an import problem —
  reading old backups — not as a shape the rebuild must inherit. How to carry the old build's
  *prompt corpus and tuning* across, and how to prove you did, is
  [`17-port-and-verification.md`](17-port-and-verification.md).
