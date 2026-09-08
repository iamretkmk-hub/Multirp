# 07 · Turn Pipeline

From keypress to settled state. This is the app's hot path and its most-executed code; every
other subsystem hangs off it.

## The pipeline

```
 1  INTAKE        command? whisper? → handled, never sent to a model
 2  AUTHORING     optional rewrite of terse input into an in-voice turn
 3  COMMIT        player message persisted with its witness list — irrevocably on screen
 4  ROUTE         who answers: nobody · one · a routed set
 5  GENERATE      per responder: recall → compose → call → validate → commit
 6  PRESENT       reveal queue, in order
 7  ENRICH        illustrate · voice — background, never blocking
 8  OBSERVE       presence tracking · memory arc
 9  REACT         scheduled turn-clock engines, budgeted
10  DIRECT        at most one turn-consuming behaviour may win
```

**R-TURN-1** — Phases 1–6 are the foreground path. Phases 7–10 MUST run after the reply is
visible and MUST NOT delay it (R-PROD-2).

**R-TURN-2** — The player MUST be able to type the next turn from the moment phase 3 completes.
Only phase 2, on the turn being submitted, may lock input (R-UX-19).

## 1 · Intake

Three inputs share the composer and are separated before anything else happens.

| Input | Handling |
|---|---|
| An out-of-character command | Executed locally. **Never sent to any model, never entered into any payload, never remembered** |
| A private aside to one character | Committed as a turn whose content is visible **only** in that character's payload |
| An ordinary turn | Continues to phase 2 |

**R-TURN-3** — Commands MUST be a closed, registered set with declared effects. Every command
MUST have an equivalent UI affordance; the command syntax is an accelerator, not the only door.

The command set: bring a character into the scene · send one away · soft-remove · revive · send
or open a text conversation · list who is nearby · whisper · the hands-free operator verbs.

**R-TURN-4** — Soft removal MUST be the default way to retire a character (R-STATE-21). A
soft-removed character is inert everywhere at once — no replies, no routing, no summons, no
gossip, no intents — and this MUST be enforced by a single predicate every consumer uses, not by
each consumer remembering to check.

## 2 · Authoring (auto-RP)

When enabled, terse input is rewritten into a turn written in the player's own voice, using the
player's identity, the scene, and the universe's genre voice.

**R-TURN-5** — The rewrite MUST be optional, MUST fall back to the raw input on any failure or
timeout, and MUST never discard what the player typed.

**R-TURN-6** — For **spoken** input, the player's words MUST be reproduced verbatim; only
narration may be authored around them. A voice-driven turn that paraphrases what the player said
is a defect.

## 3 · Commit

The player's message is written with its witness list — everyone present at that moment — and
rendered immediately.

**R-TURN-7** — The witness list is written once and never rewritten (R-STATE-25).

## 4 · Routing

| Situation | Behaviour |
|---|---|
| Nobody present | No reply. Phases 9–10 still run; a director may bring someone |
| Exactly one present | That character answers |
| More than one present | The router decides |

**R-TURN-8** — The routing cast is everyone in the player's **sub-area** — the earshot zone — not
everyone at the location. Characters elsewhere in the building are not in the conversation.

**R-TURN-9** — When the location holds characters but the player's sub-area holds none, the app
MUST say so as a stage direction naming who is where and how to reach them. Silence is
indistinguishable from a bug.

### Two routers

**Router 1 — who answers.** Given the roster and the player's line, returns who was addressed and
who should respond.

**R-TURN-10** — Router 1's responder set MUST be de-duplicated and capped, and MUST fall back to
a deterministic choice when it returns nothing usable. A turn always gets an answer if anyone is
present.

**Router 2 — does it continue.** After each line, asks whether another present character was
clearly addressed or provoked.

**R-TURN-11** — Chains MUST be bounded by a configured cap, each character MUST speak at most
once per chain, and at most one self-defence rebound is permitted.

> **Parity — keep:** chains are deliberately rare. The default behaviour is that the turn comes
> back to the player. A world where every line triggers three replies stops being a conversation
> the player is in.

## 5 · Generation

Per responder, in order.

### Recall

**R-TURN-12** — Memory retrieval MUST be scoped to the responding character and MUST NOT block
the request beyond its own bounded cost ([`09-memory.md`](09-memory.md)).

### Target resolution

**R-TURN-13** — The response target MUST be resolved from **the freshest real line in the
transcript**, not from the router's earlier decision. By the time the third character in a chain
speaks, the router's answer is stale.

**R-TURN-14** — The resolved target MUST be passed to *every* part of payload assembly. The
blocks describing who is being answered, who the player is, and how the speaker feels about the
target MUST agree with the guidance block, because they are derived from one resolution.

> **Redesign — was:** the target is passed separately to two assembly halves, and the standing
> warning is that a call site failing to pass it to both makes those blocks disagree with the
> guidance. **Now:** target resolution happens once, in the request, and composition is a pure
> function of that request (R-ARCH-17). There is no second half to forget.

### History assembly

The transcript the model sees is not the transcript on screen. Four transformations, in a fixed
order, and **the order is load-bearing**.

**R-TURN-15** — History assembly MUST apply, in this order:

**(a) Scene window.** Cut at the last scene boundary — the travel beat (R-STATE-28) — with
bridging so that companions who travelled together keep shared context.

**(b) Day window.** Only the last N game-days of dialogue. Older facts are memory's job, not the
transcript's.

**(c) Witness filter.** Drop any line the responder was not present for. **R-TURN-16 — Untagged
lines MUST default to excluded.** The failure mode is leaking a private scene into someone else's
head, and that is unrecoverable; the opposite failure is a character not knowing something, which
the story survives.

**(d) Perception filter.** Strip what the responder could not perceive — **inner thoughts only**.

**R-TURN-17** — The perception filter MUST remove inner thoughts and MUST retain physical action.
**You see what they did; you never hear what they thought.**

> **Redesign — was:** the filter stripped other characters' entire narration span, which removes
> actions *and* thoughts. The format contract defines the narration span as physical beats — a
> glance, a step, a touch — which is exactly what someone standing in the same room sees. Two
> characters in one kitchen each received a transcript in which the other never moved, and a
> purely physical turn (she puts the glass down and walks out) vanished entirely. **Now:**
> R-TURN-17. The current build fixed this; the rebuild states it as the rule so it cannot be
> re-derived wrongly, and applies the same rule to "what was the last line" — a wordless exit is
> something a character can react to.

### Compaction

After the four filters, cost control: a hard cap on retained messages, and optional stripping of
narration from all but the most recent few.

**R-TURN-18** — Compaction MUST exempt narrator lines (they carry scene state) **and the
responding character's own lines**.

> **Redesign — was:** compaction stripped narration indiscriminately. Because it runs *after*
> the perception filter has already removed every other character's narration, the only narration
> still standing is the responder's own and the player's — so the cost control spent its entire
> budget on the two things nothing else in the payload can reconstruct. Losing your own physical
> beats is the worse half: a model that cannot see it already gripped the counter grips it again,
> and that repetition is what a whole downstream block exists to paper over. **Now:** R-TURN-18,
> and the ordering dependency is stated at the rule rather than in a warnings table.

**R-TURN-19** — The assembled history MUST report its own token weight against the instruction
weight, and the pipeline MUST surface that ratio per call (R-PROD-7, R-PROV-33).

### Call and validation

**R-TURN-20** — The reply request is exactly: an optional pre-transcript instruction message, the
mapped transcript, and an optional post-transcript instruction message — plus, at most, one
one-shot director note consumed and cleared by this turn.

**R-TURN-21** — An empty instruction half MUST be omitted entirely, not sent as an empty message.

**R-TURN-22** — Refusals, empty content, and thinking-only responses are handled by the gateway
(R-PROV-10) and MUST NOT be rendered.

**R-TURN-23** — A speaker-name prefix the model emits despite instruction MUST be stripped before
commit.

### Repetition control

**R-TURN-24** — Every reply MUST be tested for repetition against the speaker's own recent lines,
by **three independent measurements**, each with its own retry instruction:

| Kind | Measures | Why it needs its own test |
|---|---|---|
| **Line** | Content-word overlap of the *spoken* halves, narration excluded | The plain case |
| **Narration** | The same, over narration spans only | A character can repeat their physical business while saying something new |
| **Opening** | The first few content words of the first narration span, stemmed, matched **positionally** | See below |

> **Parity — keep:** the opening test looks redundant and is not. Three consecutive turns of a
> real scene each opened with the same clause and then went somewhere different; the whole-span
> narration measure scored those pairs at less than half its trigger, because it weighs the entire
> span and the spans diverge after the shared run-up. A repeated opening is the *most visible*
> repetition there is — it is the first thing on screen every time. Matching is positional
> because a formula is a fixed order, not a bag of words.

**R-TURN-25** — A retry note MUST name which kind of repetition occurred. A model told only "you
repeated yourself" rewrites the half it got right.

## 6 · Presentation

**R-TURN-26** — Generation, persistence, illustration, and voicing MUST all be dispatched before
the reveal begins. The reveal is display only (R-UX-7, R-UX-8).

## 7 · Enrichment

**R-TURN-27** — At most one automatic illustration per turn, anchored to a character. Director
beats and scene narration do not self-illustrate.

**R-TURN-28** — Illustration and voicing failures are per-message and MUST leave a retry
affordance (R-UX-17), never a vanished element and never a blocked turn.

## 8 · Observation

**Presence tracking.** The player may narrate an arrival or departure. A cheap textual pre-filter
decides whether movement language is present at all; only then is a model asked what changed.

**R-TURN-29** — Presence changes MUST be applied through one path that moves the character,
writes a presence note carrying **ids** (R-STATE-2), and invalidates that character's image
continuity.

**R-TURN-30** — Memory arc evaluation runs here, per
[`09-memory.md`](09-memory.md), and never blocks.

## 9 · Reaction

Turn-clock engines, run by the scheduler under declared budgets (R-ARCH-11, R-ARCH-12): tracker
movement, fast relationship axes, promise detection and settlement, calendar extraction,
attendance re-scoring, offstage world pulse, proactive texts.

**R-TURN-31** — Every one of these MUST be individually toggleable and MUST fail soft with a
recorded outcome (R-PRIN-5).

## 10 · Direction

**R-TURN-32** — At most one turn-consuming behaviour may win a turn, resolved by the declared
priority ladder (R-ARCH-13). Candidates, in precedence order:

1. A due meeting involving the player
2. An active event advancing (a live directed scene owns the turn until resolved)
3. An armed plan whose gate just became satisfied
4. A quest approach whose scene gate is satisfied
5. The Gamemaster's nudge

**R-TURN-33** — Do-not-disturb silences the director and resolves any live event, while
deliberately leaving memory, trackers, and relationships running. It is a statement about
direction, not about simulation.

**R-TURN-34** — A manual nudge (R-UX-13) MUST override both cadence and do-not-disturb. The
player asked.

## Adding a reply path

**R-TURN-35** — There MUST be exactly one generation path, parameterised. A new kind of reply —
a text message, an extended continuation, a reaction to a director beat — is a **parameter set**,
not a new pipeline.

> **Redesign — was:** the warning reads *"adding a reply path must replicate: witness-scoped
> history, refusal fallback, empty-reply handling, presentation ordering, dirty marking — copy
> the existing one, don't improvise."* Copying is how five paths drift. **Now:** R-TURN-35. The
> current build already converged on this for payload assembly, where all five reply payloads
> share one block set and one producer after an earlier design gave each its own and silently
> hid whole blocks from one of them. The rebuild starts there and extends it to the pipeline.

The parameters that distinguish a reply path: which payload layout, which format contract, which
guidance and guardrail fragments, whether the speaker is continuing their own line, whether the
exchange is in the room or on a phone.
