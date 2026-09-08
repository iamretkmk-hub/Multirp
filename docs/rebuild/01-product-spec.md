# 01 · Product Specification

## What StoryMind is

StoryMind is a **single-user, client-side AI roleplay engine with a simulated world behind it.**

The player writes turns in a story. AI characters answer in character. That much is common.
What distinguishes this product is everything that happens *between* the player's turns and
*between* their sessions: the characters remember what happened, form and revise opinions of
each other and of the player, talk about the player when the player is not there, decide what
they want, pursue it offstage, make plans with dates, hold each other to promises without
dates, text first, and eventually arrive to settle something. Replies can be illustrated,
animated, and voiced; a character can be phoned and spoken to in real time.

There is no server. The app runs entirely in the browser, on the user's own device, against
the user's own provider API keys. Nothing about the user's stories leaves the device except
the model calls they pay for themselves.

**In one sentence:** a private, offline-capable world that keeps running when you close it.

## Who it is for

One kind of person, specified narrowly on purpose:

**A solo writer-player running a long campaign.** They have been in the same universe with the
same cast for weeks or months. They care much more about *continuity* — that a character
remembers a promise, that a grudge from three days ago colours a greeting today — than about
the polish of any individual reply. They are technically comfortable enough to hold provider
API keys and to tune a prompt when a character sounds wrong. They play mostly on a phone,
often offline-ish, often in short sessions.

Three consequences follow from that person, and they decide most of the design:

1. **Continuity outranks eloquence.** Every subsystem that costs a model call exists to make
   the world remember. Given a choice between a better-written reply and a reply that knows
   what happened yesterday, the app chooses the second.
2. **The device is a phone.** Storage is bounded, the network is unreliable, the process is
   killed without warning when backgrounded, and there is no developer console. Persistence,
   cost, and on-device diagnostics are product requirements, not engineering details.
3. **The user is the last line of support.** No backend means no telemetry, no server-side fix,
   no ability to inspect a user's state. Everything they might need to diagnose must be in
   front of them ([principle 5](00-principles.md#5--fail-soft-never-fail-silent) and
   [6](00-principles.md#6--nothing-hidden)).

## The core loop

There are three nested loops, at three timescales. Each is a real product surface and each is
specified in detail later in this set.

### The turn (seconds)

```
player writes  →  [optional] rewritten into an in-voice turn
               →  who should answer?  (one character, or a routed chain of up to N)
               →  each responder: recall memories, assemble payload, generate, render
               →  illustrate · voice · reveal
               →  background: trackers, feelings, promises, plans, presence
               →  at most one director may take the scene
```

Specified in [`07-turn-pipeline.md`](07-turn-pipeline.md).

### The day (a session)

Many turns, then the player ends the day. Ending the day runs a long, strictly-ordered
background pipeline: today's memories are committed, plans and quests are reconciled against
what actually happened, each character writes a diary entry, relationships are re-judged,
rumours propagate through the social graph, offstage characters act, wants are re-curated, and
the world's chronicle records the day.

Specified in [`10-simulation.md`](10-simulation.md).

### The campaign (weeks)

Memories accumulate and are periodically condensed into long-term recollections. Quest arcs
generate their successors. Intents harden into confrontations. The universe's chronicle
condenses into eras. The player's relationships with the cast move on slow axes that only
change day to day.

## Product pillars

Five. Every feature belongs to one; a feature belonging to none is a candidate for cutting.

| Pillar | The promise | Fails when |
|---|---|---|
| **Continuity** | The world remembers, and shows you that it remembers | A character re-asks something answered yesterday; a promise is written straight through |
| **Autonomy** | The world acts when you are not looking | Turning off the player's input changes nothing; the cast is a set of vending machines |
| **Authorship** | Every word the model reads is yours to see and change | A behaviour you dislike has no visible cause and no lever |
| **Embodiment** | Scenes have a place, a look, a voice | Text-only exchange in an unspecified void |
| **Sovereignty** | Your stories are yours; nothing leaves the device | Any server-side component, any telemetry, any account |

## Feature inventory

Full parity with the current build. The **Level** column drives
[`16-build-order.md`](16-build-order.md): **Core** is the minimum shippable product, **Standard**
is what makes it *this* product, **Extended** is depth that can arrive later without redesign.

### Chat & turn engine — `Core`

| Feature | Level | Notes |
|---|---|---|
| Solo reply (one character present) | Core | |
| Multi-character turns with routing | Core | Router picks responders; a bounded chain may follow |
| Witness-scoped history | Core | A character's transcript is only what they were present for |
| Out-of-character commands | Core | Bring, leave, remove/revive, who, whisper, text |
| Auto-RP (rewrite terse input into an in-voice turn) | Standard | Verbatim rule for spoken input |
| Whisper (private aside to one character) | Standard | |
| Refusal & empty-reply recovery | Core | Never render a refusal or a thinking trace as a character's line |
| Repetition detection and retry | Standard | Three distinct measurements — line, narration, opening |
| Heat of the moment (one extended continuation) | Extended | |
| Message edit / delete / regenerate | Core | |
| Scene recap on return after a break | Extended | |

### Prompt composition — `Core`

| Feature | Level | Notes |
|---|---|---|
| Block-structured reply payloads | Core | One block set, per-payload ordering |
| User reordering and removal of blocks | Standard | Persisted explicitly; self-healing |
| Editable fixed-text fragments | Standard | Every fixed sentence, no inline prose |
| Prompt registry with per-universe overrides | Standard | Three-layer resolution |
| Engine payload cards | Standard | Every background job's prompt, editable in place |
| Story-language vs engine-language policy | Core | Exactly one directive per call, no defaults |

### Memory — `Standard`

| Feature | Level | Notes |
|---|---|---|
| Arc-bounded memory building | Standard | Scene and commit boundaries, not fixed windows |
| Per-participant scoping | Standard | One memory per witness, scoped to what they saw |
| Bystander gists | Standard | Outside impressions with a charge; feed gossip |
| Diaries | Standard | One per character per day, never condensed |
| Long-term condensation | Extended | Clustered merge into long-term recollections |
| Weighted multi-facet retrieval | Standard | Semantic · people · location · recency · emotion · importance |
| Embeddings (opt-in semantic memory) | Extended | Silent lexical fallback |
| Memory browser and manual editing | Standard | |

### Living world — `Standard`

| Feature | Level | Notes |
|---|---|---|
| Relationships: slow axes, fast axes, factual ties | Standard | Three layers, different cadences |
| Trackers (freeform numeric story state) | Standard | Four behaviours, three methods, breaking points, public knowledge |
| Gamemaster (invisible director) | Standard | Staleness judge → hidden nudge |
| Scene Writer & active events | Standard | An event owns the scene until resolved |
| Gossip ledger | Standard | Owned rumours with heat, status, carriers, and an ending |
| Offstage intents & armed plans | Extended | Private motives with code-checked gates |
| Confrontations & overtures | Extended | Judged, winnable social events |
| World pulse (offstage encounters) | Extended | |
| Calendar & meetings | Standard | Dated plans, attendance, due handling |
| Promises & standing commitments | Standard | The undated half of what people hold each other to |
| Goals curator | Extended | One maintained want-list, rewritten not appended |
| Character quests & quest arcs | Extended | |
| Proactive texts | Standard | Phone side-channel with its own memory path |
| Universe chronicle & state zero | Extended | |

### World systems — `Core`

| Feature | Level | Notes |
|---|---|---|
| Universes (worlds with a cast and a player identity) | Core | |
| Character cards | Core | |
| Locations, sub-areas, earshot geometry | Standard | Sub-area is the unit of who can hear you |
| Travel with time cost and companions | Standard | Travel is the scene boundary |
| Game time (day + period) | Core | |
| Daily character placement | Standard | Weighted roll from home, visit locations, schedules |
| World rules compiled from plain language | Extended | Enforced in code |
| AI generation: universe, cast, appearance, schedule, ties | Extended | |
| World map hub | Extended | |

### Media & voice — `Standard`

| Feature | Level | Notes |
|---|---|---|
| Auto-illustration of replies | Standard | One per turn, anchored to a character |
| Per-character visual continuity | Standard | Continuity keyed per character, never global |
| Image rules & smart routing | Extended | |
| Video: animate, extend, shot setups | Extended | |
| Scenes (curated video sequences) | Extended | |
| Playground (compose an image from parts) | Extended | |
| Gallery | Standard | |
| Text-to-speech dubbing | Extended | Character voices; narration voice mode |
| Real-time voice calls | Extended | Mic → STT → reply → TTS with barge-in |

### Application shell — `Core`

| Feature | Level | Notes |
|---|---|---|
| Local persistence across two storage tiers | Core | |
| Settings surface covering every tunable | Core | |
| Export / import (four granularities) | Core | |
| Automatic rolling snapshots | Standard | |
| On-device debug log of every call | Core | Not optional — it is the only support channel |
| Theming, font, scale, reading layout | Standard | |
| Installable, offline-capable | Standard | |
| Onboarding | Standard | |
| Story language selection | Standard | |

## Non-goals

Stated so they are not re-litigated:

- **No multi-user anything.** No sharing, no accounts, no sync, no collaborative worlds. One
  person, one device, their own keys. Sovereignty is a pillar; every one of these breaks it.
- **No server-side component of any kind**, including for key proxying. If a provider blocks
  browser calls, that is a provider limitation to surface honestly, not a reason to route a
  user's key through a third party.
- **No telemetry, analytics, or crash reporting.** The diagnostic surface is local and
  user-readable, and the user chooses whether to export and send it.
- **Not a general chat client.** Every design tension resolves toward the long campaign. A
  feature that helps a one-off conversation and costs continuity loses.
- **Not a writing tool.** No document export, no manuscript view, no editorial features beyond
  what play needs.
- **No content moderation layer.** The app is a private client to providers that have their own
  policies. It does not add a second one, and it does not attempt to evade the first — it
  surfaces provider refusals honestly rather than disguising them
  ([`06-provider-layer.md`](06-provider-layer.md)).

## Quality bars

These are product requirements and appear as acceptance criteria in
[`16-build-order.md`](16-build-order.md).

**R-PROD-1** — A reply MUST begin appearing to the player within the time of the model call
plus the app's own overhead; app-side assembly MUST NOT be a perceptible share of that. No
foreground work — memory retrieval included — may block the request.

**R-PROD-2** — Illustration, voicing, memory building, and every background engine MUST run
after the reply is visible and MUST NOT delay it.

**R-PROD-3** — The app MUST survive being killed while backgrounded with no loss beyond the
turn in flight. Every persistence path is bound to page-hide, not to unload.

**R-PROD-4** — The app MUST remain usable with no network: existing stories readable, media
viewable, settings editable. Only generation requires connectivity.

**R-PROD-5** — Every failure a user can encounter MUST produce either a visible, plain-language
message or a debug-log entry — and for anything that changes what the story does, both.

**R-PROD-6** — No feature may make a model call the user did not either request or configure.
Every autonomous call is governed by a visible cadence and cap
([principle 8](00-principles.md#8--autonomy-is-budgeted)).

**R-PROD-7** — In a representative two-character scene at default settings, the transcript MUST
be at least 20% of the tokens the model reads, and the app MUST display that ratio per call.
Below that the character is being briefed rather than played — a measured, repeatable cause of
mechanical replies.
