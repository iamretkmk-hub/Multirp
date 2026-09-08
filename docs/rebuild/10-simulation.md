# 10 · Simulation — The Living World

The systems that act when the player is not looking. This is the product's second pillar and its
main competitive claim: turn off the player's input and the world still moves.

## Two clocks

**R-SIM-1** — Every autonomous engine MUST be bound to exactly one of two clocks and MUST be run
by the scheduler (R-ARCH-11), never invoked from a call site.

| Clock | Fires | Character |
|---|---|---|
| **Turn** | After every player turn | Cheap, cadence-gated, mostly background |
| **Day** | When the player ends the day | Expensive, strictly ordered, the world's thinking |

## Engine declaration

**R-SIM-2** — Every engine MUST declare, in the engine registry: its clock, cadence, per-period
cap, cost class, gate condition, toggle key, the prompts it uses, the facts it publishes and
subscribes to, and — if it can consume a turn — its precedence in the priority ladder.

**R-SIM-3** — The scheduler enforces every declared bound. An engine cannot exceed its cap by
becoming reachable from somewhere new.

**R-SIM-4** — Every engine run MUST record an outcome: ran, or skipped with a reason — gated off,
cadence not due, no eligible subjects, cap reached, lost the ladder, failed
([principle 5](00-principles.md#5--fail-soft-never-fail-silent)).

## The turn clock

Engines that run after a player turn, in dependency order. All are background and none may delay
the reply (R-TURN-1).

| Engine | Does | Bound |
|---|---|---|
| **World pulse** | Two co-located offstage characters interact | Every N turns, capped per day |
| **Proactive text** | A character texts first | At most one per in-game period |
| **Quest text** | A quest-holder texts their ask | Heavily rate-limited |
| **Trackers** | Freeform numeric state moves; trigger phrases detected | Per active tracker |
| **Fast relationships** | The right-now emotional charge is re-scored | Adaptive cadence |
| **Promises** | Finds new commitments **and settles open ones**, in one call | Every second turn |
| **Calendar** | Extracts concrete dated meetings from the conversation | |
| **Attendance** | Re-scores an uncertain meeting after persuasion | On change |

**R-SIM-5** — The promise engine MUST do both jobs in one call. Detection without settlement
produces another append-only ledger.

Then the priority ladder (R-TURN-32) — at most one winner.

## The day clock

**R-SIM-6** — The day pipeline order is **dependency-ordered and load-bearing**. It MUST be
declared as data with each step's dependencies stated, so that ordering is enforced rather than
remembered.

```
 1  flush the memory arc, stamped with the ending day   ← MUST be first: everything reads today's memories
 2  reconcile the calendar against what happened
 3  reconcile quests against what happened
 4  write diaries        ║  re-judge slow relationship axes   ← the one intentionally parallel pair
 5  regenerate factual ties for pairs whose axes moved
 6  propagate gossip
 7  settle still-due plans offstage
 8  goal pursuit — each offstage character chooses a next move
 9  quests: reconcile → pursue → spawn → text
10  reconcile texts; a forced proactive text pass
11  spawn confrontations from hardened suspicion
12  bind and run pending background tasks
13  form and tick offstage intents
14  curate goals                                        ← after quests and intents; before the chronicle
15  write the chronicle                                 ← MUST be last: it records everything above
```

**R-SIM-7** — The visible day advance MUST happen **before** the background pipeline, and the
day's message window MUST be snapshotted **before** the day marker is pushed.

> **Parity — keep:** diaries and slow relationship axes both read "today's messages" by looking
> back to the last day marker. Push the marker first and they see an empty day. This is a
> one-line ordering constraint that silently empties two features.

**R-SIM-8** — The pipeline MUST be resumable. A user who closes the app mid-pipeline MUST NOT
lose the day (R-UX-22).

**R-SIM-9** — Every step MUST be individually toggleable and MUST fail soft without aborting the
steps after it.

## The engines

### Gamemaster — the invisible director

Two stages, and the separation matters: a **judge** decides whether to intervene, an **author**
writes the intervention.

**R-SIM-10** — The judge MUST return a structured verdict — is the scene stale, did something
trigger, how much energy, and why. Intervention occurs when either staleness or a trigger fires.

**R-SIM-11** — The nudge MUST be delivered as a **one-shot hidden note** consumed and cleared by
the next reply, or played immediately as a narrator beat, never both.

**R-SIM-12** — The director MUST be able to steer the scene toward a waiting armed plan or quest
gate **without firing or revealing it**. Staging is direction; the gate is code (R-PRIN-4).

**R-SIM-13** — The director MUST be silenced by do-not-disturb, cadence-gated otherwise, tightened
when the player is alone, and overridable by an explicit player nudge (R-UX-13, R-TURN-34).

### Scene Writer — events that own the scene

**R-SIM-14** — An active event MUST carry a summary, a kind, a turn counter, and minimum and
maximum lengths. It advances one beat per turn, escalating if ignored, until resolved.

**R-SIM-15** — While an event is active it **owns the scene** — no other director may fire
(R-TURN-32).

**R-SIM-16** — When an event brings a character in, **only the newly arrived character speaks that
turn.**

### Gossip

Three sources feed one ledger.

**R-SIM-17** — Sources: charged bystander gists (R-MEM-6); a **location leak** rolled on leaving a
public place against that place's leak chance, planting vague talk in its residents and regulars —
**including the person it is about**; and end-of-day propagation of charged observations through
the relationship graph to people who would care.

**R-SIM-18** — Propagated rumours MUST be planted as **open suspicions — a question, not a
verdict.** A rumour that arrives as a settled fact cannot be argued with, and the whole
confrontation layer depends on it being winnable.

**R-SIM-19** — The gossip ledger governs (R-STATE-30): a **stakeholder** who may act on it, a set
of **carriers** who merely know it, decaying heat, a lifecycle ending in settled, believed, or
dead, and a record of who raised it on which day.

**R-SIM-20** — Only the stakeholder may raise a rumour, at most once, subject to a cooldown.
**Raising it spends the move**; afterwards they must live with the answer.

**R-SIM-21** — Recording MUST fold a paraphrase of a live rumour about the same subject into that
rumour — adding a carrier and a little heat — rather than creating a duplicate, and MUST refuse
new rumours to a stakeholder already at their live cap.

### Offstage intents

Private motives characters form and pursue without the player.

**R-SIM-22** — An intent carries a holder, a valence (warm or hostile), a kind, a target, the
actual want, a trigger, a strength, allies, a status, and eventually a plan.

**R-SIM-23** — The lifecycle: **formed** at day's end from the day's memories, relationship
movement, and personality; **ticked** daily to harden, fade, or recruit allies; **contemplated**
into a concrete plan with a method and a gate; **armed**, its gate evaluated **in code** every
turn; and on satisfaction it becomes the active event.

**R-SIM-24** — Gates MUST be code-evaluated (R-PRIN-4). Target alone · target with a named person
· at a place · audience present. A model never decides whether a gate is satisfied.

**R-SIM-25** — Intents MUST be capped per chat, and MUST be visible and editable by the player.
The world's private motives are the least legible thing in the app; hiding them entirely makes
inexplicable behaviour indistinguishable from a bug.

### Confrontations and overtures

The judged, **winnable** social events — the payoff for everything above.

**R-SIM-26** — A confrontation is a character arriving to settle a hardened suspicion. During it,
every player turn is scored by an **unbiased referee** into a conviction delta, bounded by an
evidence floor and ceiling, with personality deciding how movable the accuser is.

**R-SIM-27** — An overture is the warm sibling — courtship, reconciliation, loyalty, alliance —
judged as receptive or rebuffed.

**R-SIM-28** — Both MUST end in a recorded aftermath: memories, relationship movement, and rumour
status updates. An event that resolves into nothing teaches the player that none of it mattered.

**R-SIM-29** — The two judges share one field set. **They MUST share one schema declaration**
(R-PAY-28) rather than two prompts that must be edited together.

### World pulse and goal pursuit

**R-SIM-30** — During the day, two co-located offstage characters may interact. The output is a
news-style world event, real memories for the participants, relationship movement, and **physical
placement at the venue** — so the player can walk in on the aftermath.

**R-SIM-31** — At day's end, each offstage character decides a next move from personality, goals,
motives, memories, and standings, and **lands it on the calendar as a plan** — solo or with one
other character, never with the player. The calendar executor then plays it out.

> **Parity — keep:** routing offstage ambition through the calendar rather than resolving it
> immediately is what makes the world feel scheduled rather than random. The player can see it
> coming.

**R-SIM-32** — When the world pulse is disabled, due character-to-character plans MUST still
execute. Any job hosted by the pulse needs the same fallback or it dies silently with the toggle.

### Calendar and promises — the two halves of obligation

**R-SIM-33** — The calendar holds only **concrete dated** commitments: a day, an executor, a
certainty, a purpose.

**R-SIM-34** — Uncertain meetings carry an attendance likelihood the player can move by addressing
it in play.

**R-SIM-35** — Due handling MUST cover all three outcomes: the executor arrives, the player is
prompted to travel, or a no-show plants the memory a no-show deserves.

**R-SIM-36** — Promises hold the **undated** half: "I'll never touch him again", "promise me
you'll always be on my side", a rule accepted under pressure. The meetings detector is right to
drop these; they need their own ledger, not a looser calendar.

**R-SIM-37** — A promise carries a holder, a recipient, **the ask that prompted it** — the reason,
which is what makes it make sense a week later — the word actually given as a standing rule, a
kind, a weight (binding or soft), and a status.

**R-SIM-38** — A **broken** word MUST plant a real memory for whoever it was given to, so feelings,
gossip, and intents pick it up through the normal path rather than through a special case.

**R-SIM-39** — Standing commitments MUST be published as a fact (R-ARCH-4) and consumed by
subscription. Every context assembler that describes a character's obligations subscribes.

> **Redesign — was:** four independent read paths that "must stay in step", with the note that a
> fifth is fine but a missing one means the world writes straight through a standing promise.
> **Now:** one publication, subscribed. See [`04-architecture.md`](04-architecture.md).

### Goals curator

**R-SIM-40** — A character's want-list MUST be **one maintained section, rewritten daily** — not
an accumulation.

> **Parity — keep, and understand the shape of the fix:** the payload once carried three want
> blocks that only ever grew — an authored list frozen at creation, a dump restating every
> pursuit with its whole progress log, and a line from the live intent. Nothing removed anything.
> The curator's entire job is deciding what to **drop**: keep, reword, merge, or drop each
> existing line, add at most one or two the day genuinely earned, and cap the total.

**R-SIM-41** — The **authored** goals field is the foundation: never written to by any engine,
never contradicted (R-STATE-19). Engines read through one accessor that resolves maintained over
authored.

**R-SIM-42** — The curator MUST run after the passes most likely to have changed what someone
wants — quests and intents — and before the chronicler.

**R-SIM-43** — The curator MUST be bounded: skip characters the day did not move, and cap how many
are curated per day. A quiet character's list is already correct.

**R-SIM-44** — Editing the authored goals MUST reset the maintained list, since the list was grown
from the old one. This MUST be explicit, not a side effect discovered later.

### Quests

**R-SIM-45** — Two distinct systems that MUST NOT be merged:

- **Character quests** — a character's own pursuit, born from their goals and undercurrents.
  Character-to-character quests advance offstage as narrated events and **always** reach a final
  result. Quests needing the player arrive as a text ask or an in-person approach through a
  code-checked scene gate, at most one per day.
- **Quest arcs** — the player-facing designed premise, where completing one generates the next
  from quest memory, universe memory, and live undercurrents. Arcs may materialise locations and
  characters.

**R-SIM-46** — Both MUST be reconciled daily against evidence of what actually happened, not
against what was planned.

### Texts

**R-SIM-47** — Texts MUST use the **same reply payload** as spoken turns, differing only in the
format contract and the suppression of room-describing blocks (R-PAY-11).

**R-SIM-48** — Texts MUST carry real-time and game-day stamps, so silence is *felt*.

**R-SIM-49** — Leaving a text unread MUST have consequences — a mood movement and a memory.

### Universe memory

**R-SIM-50** — Two layers: **state zero**, the briefing describing who is who and what the world
was before play began; and the **chronicle**, a few neutral dated entries per day, condensing into
eras as it grows. Both feed the quest designers and the authoring tools.

**R-SIM-51** — The chronicler MUST run last in the day pipeline. It is the day's record and reads
everything above it.

## Costs

**R-SIM-52** — The settings surface MUST make each engine's cost visible — roughly how many model
calls per turn and per day at current settings — and MUST show the effect of a cadence change
before it is made.

> **Parity — keep:** the caps in the current build exist because lifting them turns the day's end
> into a queue. That reasoning is invisible to a user who sees only a number to raise. Making cost
> legible is what lets the caps stay conservative without feeling arbitrary.
