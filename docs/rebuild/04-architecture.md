# 04 · Architecture

This document specifies **boundaries and contracts**, not file layout. It ends with the
file-layout question treated as a decision to be made once, with reasons, rather than inherited.

## The layer model

Six layers. Dependencies point **downward only**.

```
┌──────────────────────────────────────────────────────────┐
│  6 · SURFACE      screens · components · rendering        │
├──────────────────────────────────────────────────────────┤
│  5 · ORCHESTRATION  turn pipeline · day pipeline ·        │
│                     the scheduler and its budgets         │
├──────────────────────────────────────────────────────────┤
│  4 · DOMAIN       memory · simulation · world · media     │
│                   (each a peer; none calls another        │
│                    directly — see the bus, below)         │
├──────────────────────────────────────────────────────────┤
│  3 · COMPOSITION  payload assembly · blocks · fragments · │
│                   the prompt registry · language policy   │
├──────────────────────────────────────────────────────────┤
│  2 · PROVIDER     the AI gateway · media providers ·      │
│                   speech · the observability tap          │
├──────────────────────────────────────────────────────────┤
│  1 · FOUNDATION   state · storage · schemas · registries ·│
│                   ids · migrations · the event bus        │
└──────────────────────────────────────────────────────────┘
```

**R-ARCH-1** — A layer MUST NOT depend on a layer above it. In particular, no domain engine may
render, and no composition code may perform I/O.

**R-ARCH-2** — Layer 4 modules MUST NOT call each other directly. Memory does not call gossip;
gossip does not call relationships. They communicate through published facts and the event bus
(below). This is [principle 1](00-principles.md#1--one-owner-per-fact) made structural.

**R-ARCH-3** — Every model call in the system MUST pass through the layer-2 gateway. There is no
second path to a provider, no "just this once" fetch.

### Why layer 4 modules are peers

The current app's cross-effects table is, read closely, mostly a list of layer-4 modules
reaching into each other: memory content is an input to five other systems; touching a message's
witness list breaks three at once; a commitment must be read by four separate consumers that
"must stay in step".

None of those couplings is wrong as a *requirement* — gossip genuinely does need charged
observations, and the world genuinely must not write through a promise. What is wrong is that
each is an ad-hoc direct reach, so the set of readers is discoverable only by grep, and adding
the fifth reader is invisible to the other four.

The fix is not to sever the couplings. It is to invert them.

## The event bus

**R-ARCH-4** — Layer 4 modules publish **facts** and subscribe to facts. A publisher does not
know its subscribers and MUST NOT change when one is added.

Facts are past-tense, immutable records of something that happened, carrying ids (never names —
[principle 3](00-principles.md#3--identity-is-permanent-presentation-is-not)) and a game-time
stamp. The essential set:

| Fact | Published by | Subscribed by |
|---|---|---|
| `turn.committed` | Orchestration | Memory, trackers, relationships, promises, calendar |
| `memory.created` | Memory | Gossip (charged observations), intents, diaries |
| `scene.boundary` | World (travel, day end) | Memory (arc close), history assembly |
| `presence.changed` | World | Memory, media continuity, history assembly |
| `promise.given` / `promise.settled` | Promises | Memory, payload composition, directors, offstage engines |
| `rumor.planted` / `rumor.raised` / `rumor.settled` | Gossip | Payload composition, confrontations |
| `relationship.moved` | Relationships | Goals curator, tie regeneration, memory recall weighting |
| `plan.due` / `plan.resolved` | Calendar | Orchestration, memory, world pulse |
| `day.ended` | Orchestration | Every day-cycle engine, in declared order |

**R-ARCH-5** — Subscription MUST be declared in the module's registry entry, not wired at a call
site. The full subscriber list for any fact MUST be enumerable at runtime and MUST be visible in
the debug surface.

> **Redesign — was:** "a commitment is injected in four places that must stay in step … a fifth
> is fine; a missing one means the world writes straight through a standing promise." The fifth
> place being *fine* is exactly the problem: correctness depends on an author knowing about four
> other files. **Now:** commitments are published once. Any context assembler that needs them
> subscribes, and the set of subscribers is inspectable. Missing one becomes a visible gap
> rather than an invisible one.

## Registries

**R-ARCH-6** — Everything the system has many of MUST live in a declarative registry: a
data structure listing every member with its metadata, validated at startup.

The registries:

| Registry | Members | Declares |
|---|---|---|
| **Prompts** | Every editable prompt | Key, label, default text, placeholder set, output schema, hint |
| **Blocks** | Every payload block | Id, label, kind, description, scope, ownership of rules |
| **Fragments** | Every fixed sentence | Key, default text, owning block, variable set |
| **Engines** | Every background job | Id, clock, cadence, cap, cost class, toggle, prompts used, facts published and subscribed |
| **Settings** | Every tunable | Key, type, default, bounds, surface location, owning engine |
| **Storage keys** | Every persisted key | Key, tier, shape, migration history |
| **Icons** | Every interface icon | Id, label |
| **Media rules** | Image and video rule sets | |

### What registries buy

They turn [principle 2](00-principles.md#2--contracts-are-declared-not-remembered) from advice
into a check. **R-ARCH-7 — Startup MUST validate every registry and MUST report every violation
in the debug surface.** Minimum validations:

1. **Referential integrity, both directions.** Every prompt in the registry is used by some
   engine; every prompt an engine names exists. A prompt with no consumer is dead and MUST be
   reported — the current app shipped at least two editable prompts that did nothing, which is
   worse than not offering them.
2. **Fragment three-leg.** Every fragment has a default, an owning block, and a live consumer.
   The current boot guard checks two of the three and structurally cannot see a producer that
   stopped calling for its fragment — which is the exact leak that makes the editor show
   something different from what is sent.
3. **Placeholder reconciliation.** The tokens present in a prompt's text and the tokens its call
   site supplies MUST match. An unfilled placeholder MUST NOT reach a model.
4. **Schema presence.** Every prompt whose output is parsed declares a schema.
5. **Settings coverage.** Every tunable an engine reads has a settings entry
   ([principle 6](00-principles.md#6--nothing-hidden)).
6. **Rule ownership.** No behavioural rule is claimed by two blocks
   ([principle 1](00-principles.md#1--one-owner-per-fact)).

**R-ARCH-8** — Registry validation failures MUST be visible to the *user*, not only to a
console. There is no console on a phone, and the person running this build is the person who
will file the bug.

## Contract enforcement points

Three, in order of preference. **R-ARCH-9 — A contract MUST be enforced at the earliest point
that can enforce it.**

| Point | Catches | Available when |
|---|---|---|
| **Build / lint** | Type mismatches, unreachable handlers, missing exports | Only if the implementation has a build step (see below) |
| **Boot validation** | Every registry check above | Always |
| **Call-time validation** | Model output against its declared schema; clamping; unfilled placeholders | Always |

**R-ARCH-10** — Model output MUST be validated against the declaring prompt's schema before any
consumer sees it. A shape mismatch is a *reported* engine failure, never a silent field of
`undefined`.

> **Redesign — was:** an engine was refactored from batch to per-item while its prompt kept
> asking for an array; the type guard passed because an array is an object, every field read
> back undefined, and the feature quietly stopped working for an unknown number of releases.
> **Now:** the prompt declares its schema, the response is validated against it, and a mismatch
> is an engine failure with a debug entry naming the engine, the expected shape, and the shape
> received (R-ARCH-10, [principle 5](00-principles.md#5--fail-soft-never-fail-silent)).

## The scheduler

Orchestration owns one scheduler, and it is the only thing that runs an engine.

**R-ARCH-11** — An engine MUST NOT be invoked from a call site. Engines declare their clock
(`turn` or `day`), cadence, cap, and gate in the registry; the scheduler runs them.

**R-ARCH-12** — The scheduler MUST enforce declared budgets. An engine cannot exceed its cap by
being reachable from a new place.

**R-ARCH-13** — Turn-consuming behaviours — anything that takes the scene from the player — MUST
be resolved through a single explicit **priority ladder** with declared precedence. Exactly one
may win a turn.

> **Redesign — was:** the priority ladder exists, but as a sequence of early returns inside one
> function, with the warning "new turn-consuming features must join that ladder" living in a
> documentation table rather than at the point of the mistake. **Now:** precedence is a declared
> property of the engine registry entry. A new turn-consuming engine that omits its precedence
> fails boot validation instead of silently stacking on top of the Gamemaster.

**R-ARCH-14** — Every scheduler decision MUST be recorded: engine, ran or skipped, and *why*
(gated off, cadence not due, no eligible subjects, cap reached, lost the ladder, failed).

## Domain module contract

**R-ARCH-15** — Every layer-4 module MUST expose exactly four things and nothing else:

1. **Queries** — read-only, synchronous, side-effect free. Everything the surface and the
   composition layer use to display or describe this domain.
2. **Facts published** — declared in the registry.
3. **Engines** — registered jobs the scheduler may run.
4. **Migrations** — for the data the module owns.

**R-ARCH-16** — A module MUST own its data exclusively. No other module writes to it. Cross-
module change happens by publishing a fact the owner subscribes to.

> **Redesign — was:** an engine writing to a character's authored goals field silently cleared
> the maintained live list on the next save, because two systems wrote one field with different
> meanings. **Now:** authored content and maintained content are separately owned fields with
> separate writers, and the module that owns the maintained list is the only writer to it
> (R-ARCH-16).

## The composition boundary

Layer 3 is the sharpest boundary in the system and deserves its own rule.

**R-ARCH-17** — Composition MUST be pure: given a state snapshot and a request, it returns an
assembled payload. It performs no I/O, mutates nothing, and is fully reproducible.

That purity is what makes the payload inspectable, diffable, and testable — you can assemble the
exact payload for a past turn from the stored state and compare it to what was sent. It is also
what makes [principle 9](00-principles.md#9--the-payload-is-a-user-visible-object) enforceable
rather than aspirational.

**R-ARCH-18** — Every domain fact composition needs MUST arrive through a query (R-ARCH-15).
Composition MUST NOT reach into a module's storage.

## The file-layout decision

This spec set is architecture-neutral by design, and everything above holds under any layout.
This section exists so the choice is made deliberately and once.

### What the current app chose, and why it was not wrong

One HTML file. No build step, no framework, no imports; all state global; discipline enforced by
banner comments and naming conventions. The stated reasons: it installs as a PWA, it can be
copied around as a single artifact, and it runs from `file://`.

Those reasons are real. A user who can email themselves their whole application, keep it on a
phone, and have it work with no network and no toolchain has something most web apps cannot
offer. For a sovereignty-pillar product (`01-product-spec.md`), that is close to a feature.

### What it cost

The costs are visible throughout `docs/13`, and they are all one cost wearing different hats:

- **No mechanical reachability.** A function named in a generated `onclick` string is invisible
  to a syntax check; a rewrite dropped four handlers and shipped, because the only reference to
  them was inside an HTML string.
- **No enforceable boundaries.** Every layer rule above is, in that layout, a convention.
- **No test surface.** Nothing is importable, so nothing is testable in isolation. For a system
  whose correctness lives in prompt-to-parser contracts and pipeline ordering, that is the
  expensive one.
- **No dependency direction.** With all state global, the dependency graph is whatever the code
  happens to do today.

### The decision framework

**R-ARCH-19** — Whichever layout is chosen, the following MUST be true:

1. Every registry validation in R-ARCH-7 runs at startup and reports to the user.
2. Every handler reachable from the UI is mechanically verifiable — no reference exists only
   inside a string.
3. Composition (layer 3) is exercisable in isolation, with a state snapshot in and an assembled
   payload out.
4. Layer 2 is replaceable without touching layers 3–6.
5. The shipped artifact remains installable and fully functional offline.

Requirements 1 and 5 are satisfiable in any layout. Requirements 2, 3, and 4 are satisfiable in
a single-file layout only with real effort — 2 requires abandoning handler-name-in-string
binding, and 3 requires composition to be genuinely pure and separately invocable, which is a
discipline rather than a mechanism.

**Recommendation.** Modular sources with a build step that emits a single self-contained
artifact. This keeps every property the single-file choice was made for — one file to copy,
`file://`-capable, installable, no runtime dependency on a toolchain — while making requirements
2, 3, and 4 mechanical instead of aspirational. The cost is a build step between editing and
running, which is a real loss for a project whose author edits it on the device it runs on, and
should be weighed honestly rather than dismissed.

**R-ARCH-20** — Whatever is chosen, record it, with its reasons, in
[`15-redesign-register.md`](15-redesign-register.md). A layout decision that is not written down
becomes an assumption, and assumptions in this codebase have historically become warnings.
