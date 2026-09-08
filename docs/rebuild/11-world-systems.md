# 11 · World Systems

Universes, the cast, places, time, trackers, and relationships — the substrate the simulation
runs on.

## Universes

A universe is a world: a setting, a cast, a map, its rules, and **the player's identity within
it**.

**R-WORLD-1** — Each universe holds exactly one ongoing story. Entering a universe resolves the
active player identity from the universe's overrides, falling back to global settings.

**R-WORLD-2** — The player's identity — name, appearance, personality, style, biography — MUST be
overridable per universe. The same human is a different person in a noir city and a village
drama, and forcing one identity across worlds is the most-requested thing a global-only design
gets wrong.

**R-WORLD-3** — Universe generation from a brief MUST produce the world and its cast together,
followed by authoring passes for directing notes, genre pack, and guide. A world whose characters
were generated independently has no ties.

## Characters

Card fields and their consumers — this table is the contract between the editor and the rest of
the system.

| Field | Read by |
|---|---|
| Identity, personality, backstory, traits, style | The identity block of every reply payload |
| Goals (authored) + maintained list | The identity block; every engine, through one accessor |
| Pressure points | **Directors only** — never shown to another character |
| Authored social note + maintained facts + generated ties | The relationships block |
| Tags | World-rule group matching |
| Appearance + wardrobe | The image pipeline |
| Voices | Dubbing and calls |
| Home, visit locations, schedule | Daily placement |

**R-WORLD-4** — Pressure points MUST reach the directors and nothing else. They are authorial
notes about how to make a character interesting, and putting them in another character's payload
tells that character things they have no way of knowing.

**R-WORLD-5** — Generators MUST take the existing card as context so they **update** rather than
reinvent. A user who fills in three fields and presses generate expects the other seven, not a
different character.

**R-WORLD-6** — Batch generation MUST produce a **mutually related** set. Characters generated
one at a time have no reason to know each other.

**R-WORLD-7** — Characters may be created automatically mid-story when a scene needs someone, and
MUST be marked provisional until their card is filled. Filling MUST be deferrable until they have
actually mattered.

**R-WORLD-8** — Soft removal is the default retirement (R-STATE-21, R-TURN-4).

**R-WORLD-9** — Each character MUST have a hub gathering everything bound to them: card, media,
memories, diaries, relationships, quests, intents.

## Places and earshot

The geometry that decides who hears what. **This is the least obvious system in the app and the
one most often mis-modelled.**

```
Universe
└── Location            "Cafe Derya"        ← travel unit; has residents, a leak chance
    └── Sub-area        "Entrance"          ← EARSHOT unit; who can hear you
                        "Back room"
```

**R-WORLD-10** — The **sub-area is the unit of earshot.** Three distinct casts follow and MUST
NOT be conflated:

| Cast | Is | Used for |
|---|---|---|
| **In-scene** | Same sub-area | Routing, who replies, who witnesses |
| **At location** | Same location, any sub-area | Who can be called over, who is nearby |
| **Off-earshot** | Same location, different sub-area | Who is around but cannot hear |

**R-WORLD-11** — Arriving anywhere places you at the entrance (R-STATE-22).

**R-WORLD-12** — Each sub-area carries a privacy characterisation that feeds the privacy block —
how exposed it is, and which sub-area is worth moving to if something must not carry.

**R-WORLD-13** — Locations carry: kind (home or public), a description that drives both scene text
and imagery, a travel cost in periods, a leak chance, residents, and an image used as the chat
background.

**R-WORLD-14** — Residents are present when the player arrives, are never auto-placed elsewhere,
and receive that place's leaks.

**R-WORLD-15** — Home locations MUST default to a zero leak chance and the UI MUST make raising it
a deliberate act (R-STATE-23).

### Travel

**R-WORLD-16** — Travel costs periods, may take companions, is narrated, and **pushes the scene
boundary** (R-STATE-28).

**R-WORLD-17** — Arrival MUST trigger its hooks in a declared order: seeding inhabitants on a
first visit, leaking gossip from the place being left, and firing any bound arrivals or meetings.

### Daily placement

**R-WORLD-18** — At day's end each character's location for the coming day MUST be rolled **in
code** from home, visit locations, and schedule, with weights (R-PRIN-4). The result feeds
director context and the world pulse.

### World rules

**R-WORLD-19** — World rules are authored in plain language, compiled once into a structured form,
and **enforced in code** — placement, arrivals, director summons, confrontation timing, travel
companions. Group rules match character tags.

**R-WORLD-20** — Compilation MUST be a distinct, reviewable step. The user sees what their
sentence became before it governs the world.

## Time

**R-WORLD-21** — Game time is a day number plus a named period. Travel consumes periods; the day
advances only by the explicit End Day action (R-UX-21).

**R-WORLD-22** — Day and period MUST be directly settable by the player. Requiring someone to
roleplay their way to morning is a bad interaction.

**R-WORLD-23** — Every scene transition — time, place, or both — MUST inject an explicit statement
of what changed. A model that is not told the scene moved will write as though it did not.

**R-WORLD-24** — Ending the day resets the player to their home entrance, clears sub-area
positions and companion locks, and re-places the cast.

## Trackers

Freeform numeric story state: attraction, suspicion, a pregnancy, a debt, a countdown.

**R-WORLD-25** — Definitions belong to the universe; **values belong to the chat** (R-STATE-18).

**R-WORLD-26** — A tracker declares an owner scope — a character, the player, or the story —
a behaviour, a movement method, optional breaking points, and optional public knowledge.

| Behaviour | Movement |
|---|---|
| Free | Any direction |
| Up-only / Down-only | Clamped to one direction |
| Counter | Increments |

| Method | Moves by |
|---|---|
| **Judged** | An engine reads the scene each turn — the expensive one |
| **Daily** | A fixed delta at day's end, optionally above an activation floor |
| **Triggered, then daily** | An engine watches for a trigger phrase; on detection a **dice roll in code** decides the hit; the value jumps and the daily count takes over |

**R-WORLD-27** — The dice roll MUST be code (R-PRIN-4). A model asked to roll dice does not roll
dice.

**R-WORLD-28** — Breaking points map thresholds to text. The active stage's text is injected into
the owner's payload, and crossing one MAY post a narrator beat.

**R-WORLD-29** — Public knowledge: past a threshold, a vague statement becomes durable knowledge
for those who would perceive it — scoped to witnesses or the whole world. **The owner still sees
their own exact stage; everyone else reads the vague version through their own relationship to the
owner.**

**R-WORLD-30** — Judged trackers cost one model call per turn each. The settings surface MUST show
the running cost of the active set (R-SIM-52) and SHOULD steer toward the cheaper methods.

**R-WORLD-31** — Owner tagging in the payload is contextual: the owner's name is load-bearing where
several people's trackers share a list, and noise inside the reader's own group. Sub-headings that
merely restate the block heading MUST be suppressed when there is nothing to separate from.

## Relationships

**Three layers with three different cadences.** Collapsing them is the most tempting and most
damaging simplification available here.

| Layer | Axes | Cadence | Governs |
|---|---|---|---|
| **Slow** | Trust, affection, respect | Re-judged once per day from the day's exchanges | Behaviour — the settled, considered view |
| **Fast** | Desire, comfort, fear, agitation | Scored every few exchanges, and **decayed** | Delivery right now; biases memory recall |
| **Factual** | Kinship, address forms, cohabitation, standing | Regenerated only when slow axes move | Who people *are* to each other |

**R-WORLD-32** — The three layers MUST remain distinct and MUST NOT be merged into one score.

> **Parity — keep:** the reason is playable, not architectural. Someone can want you badly and
> not trust you at all; the fast axes carry the first and the slow axes carry the second, and the
> tension between them is a *feature* — the system detects impulse-versus-settled conflicts and
> flags them, because desire without affection is how a character does something they will regret.
> One merged number cannot represent that, and the regret is where the drama is.

**R-WORLD-33** — Fast axes MUST decay. Without decay, a momentary charge becomes a permanent trait.

**R-WORLD-34** — Relationships are stored as **directed** pairs. What she feels about him is not
what he feels about her, and the player is a participant like any other.

**R-WORLD-35** — The payload distinguishes the **settled** view (which governs behaviour) from the
**momentary** charge (true for one turn), and renders the momentary one as a state the character
is in rather than a list of axis labels.

> **Parity — keep:** axis labels in a payload produce a model narrating its own parameters —
> "she feels agitation 0.7". Prose describing the state produces behaviour.

**R-WORLD-36** — A pair with no history MUST render a **first-encounter** notice, not an empty
block or a neutral score. "You do not know this person" is information; a zero is not.

**R-WORLD-37** — Factual ties MUST be regenerated only for pairs whose slow axes actually moved.
Regenerating the whole graph daily is unaffordable and mostly rewrites unchanged text.

**R-WORLD-38** — The player MUST have an inspection surface showing every pair's axes, every
tracker, every intent, and every meeting, with manual controls to nudge values.

> **Parity — keep:** this is the only window into a simulation that is otherwise entirely
> inferential. Without it, a character behaving oddly is unexplainable, and the user's only
> recourse is to assume the app is broken.
