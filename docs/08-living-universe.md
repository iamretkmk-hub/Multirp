# 08 · Living Universe & Directors

The systems that make the world act without the player. Two clocks drive everything:
**`postTurn(chat)`** after every player turn, and **End Day** (`endDay` →
`endDayBackground`). Order within each is deliberate and load-bearing.

## postTurn order (per turn — mostly background)

```
maybeWorldPulse            offstage char↔char encounter on the pulseEvery cadence (bg)
maybeProactiveTextTick     a character may text first (≤1 per in-game period) (bg)
maybeCharQuestTextTick     a quest-holder may text their ask (heavily rate-limited) (bg)
runTrackerEngine           freeform tracker deltas + trigger phrases (bg, if trackOn)
runShortTermRel            fast feeling axes (adaptive cadence) (bg, if relOn)
runPromiseEngine           open-ended commitments: find new ones AND settle open ones (bg, every 2nd turn)
runCalendarEngine          extract new concrete meetings from conversation (bg, if calOn)
adjustAttendance           persuasion re-scoring of an uncertain meeting (bg)
runCalendarExecutor        due char↔char plans (only here when pulse is OFF)
resolveDueMeetings         due meetings involving the player — may CONSUME the turn (return)
runSceneWriter             if an event is active, it owns the scene — may bring a character in (return)
checkArmedPlans            a waiting scheme's gate just satisfied → becomes the active event (return)
checkCharQuestApproach     code-evaluated scene gate for an in-person quest approach (return)
maybeGamemaster            staleness judge → hidden nudge (cadence-gated)
```

The `return`s matter: once something owns the scene this turn, the Gamemaster must not also
fire.

## The Gamemaster (invisible director)

- Gates: `gmOn`, cadence `gmEvery` (shortened to 2 when the player is alone), never during an
  active event, fully silenced by per-chat **DND** (which also quietly resolves a live event).
  Manual override: chat menu "Bored (nudge the story)" → `forceGamemaster()`.
- **Stage 1 — judge** (`gmJudge`, genre-pack pacing tail): returns
  `{stale, trigger, trigger_context, energy, reason}`. Intervenes if *either* stale or
  trigger fires.
- **Stage 2 — author** (`gmAuthor`): writes the hidden nudge, grounded in
  `directorContext(chat,"gm")` (tie-only roster, scene/privacy lines, trackers, calendar,
  offstage positions), the shared recent-exchange window (`recentExchangeText` — texts
  excluded), and any **staging summaries** from armed plans / char-quest approaches (the GM
  may steer the scene toward a waiting gate but never fires or reveals the plan itself).
- Delivery: `chat.pendingGmNudge` → consumed as a one-shot `[Director's note …]` system line
  by the next reply, or played immediately via `playGamemasterBeat` → narrator event +
  `setupActiveEvent` (Scene Writer takes over) + `gamemasterReactions`.

## Scene Writer & events

`setupActiveEvent` (`sceneSetup`) classifies a new event (`chat.activeEvent`: summary, kind,
turn counter, min/max from `sceneMin/sceneMax`). Each turn `runSceneWriter` (`sceneWriter`
prompt) advances it beat-by-beat — escalating if ignored, bringing an approaching character in
at the right moment (`bring_in`; only the *newly arrived* character speaks that turn) — until
`resolveActiveEvent`. Temp characters created by events can be saved (`offerSaveTemp`).

## Confrontations & overtures (layer 3)

Judged, *winnable* social events:

- **Confrontation**: a character with a strong unresolved suspicion arrives to settle it.
  Spawned at End Day (`maybeSpawnConfrontation`) or by a ripe intent. During the event, every
  player turn is scored by the **confrontation judge** (`confrontJudge`, unbiased referee) →
  a conviction delta bounded by an evidence **floor/ceiling**; personality decides how movable
  the accuser is. Ends in `recordConfrontationAftermath` (memories, feelings, rumor updates).
- **Overture** (warm sibling): courtship/reconciliation/loyalty/alliance approaches, judged by
  `overtureJudge` (receptive vs rebuffed), `startOverture`/`recordOvertureAftermath`.
  ⚠️ The two judges share one field set — edit one prompt, edit both.
- Manual trigger: Story State → `manualConfront`.

## Offstage intents & agency (layer 4)

`chat.intents[]` — private motives: `{holderId, valence: warm|hostile, kind (grievance/
ambition/scheme/courtship/...), targetId, aim, trigger, strength, allies[], status, plan}`.

- **Formation** (End Day, `runIntentEngine` → `intentForm`): from the day's memories
  (importance ≥ ~0.55), relationship movement, personality. Capped at `intentMax`.
- **Ticking** (`intentTick`): each End Day a live intent hardens/fades/recruits allies.
- **Contemplation** (`contemplate`): a ready motive picks a concrete **plan** — method
  (direct / public spectacle / proxy / undermine-first / ambush / leverage) + a **gate**
  (target alone / with someone / at a place / audience present).
- **Arming**: `checkArmedPlans` evaluates gates **in code** every turn; when satisfied the
  plan becomes the active event (confrontation or overture). `armedStagingSummary` feeds the
  GM stage directions meanwhile. Intents are editable/deletable from the world map's
  character panel (`editIntent`/`deleteIntent`).

## Gossip (layer 2) & perception (layer 1)

- **Bystander gists** (doc 07) give non-participants a charged outside impression.
- **Location leaks**: leaving a public place rolls its `gossipChance` →
  `runLocationGossipLeak` (`poiGossip`) plants a vague "people are saying…" OBSERVATION in
  every **resident/regular** of that place — including the person it's about.
- **End-Day propagation** (`runGossipPropagation`, `gossipPrompt`): charged observations
  (≥ `gossipThreshold`) travel through the relationship graph to people who'd care (capped
  `gossipMaxPerDay`), planted as **vague open-suspicion rumors** (a question, not a verdict —
  deliberately winnable later). These fuel confrontations and color scenes.

### The gossip ledger (v28.9 — "give gossip an owner and an ending")

Rumors are no longer just loose GOSSIP memories: they are entries in a **ledger**
(`state.gossip`, its own IndexedDB collection, key `sm_gossipledger`). GOSSIP memories link
back by `gossipId`, and **the ledger is the authority on whether a rumor still speaks**.

| Field | Meaning |
|---|---|
| `stakeholderId` | Whose rumor it actually is — the one person who would act on it (distinct from a memory's `ownerId`, which is merely whoever holds a copy). |
| `carriers[]` | Everyone who has heard it. They know it; **it is not theirs to raise.** |
| `heat` | 0–1, decaying daily (`gossipDecay`). At zero the rumor dies of boredom, like a real one. |
| `status` | `open → raised → settled | believed | dead` (`GOSSIP_STATUS`). |
| `raisedBy` | charId → game day it was last put to the player, enforcing `gossipCooldown` — **asking spends the move** instead of repeating it. |

Helpers: `liveGossip(uid)` (not settled/believed/dead, heat > 0.05), `gossipStakeOf(charId)`
vs `gossipCarriedBy(charId)`, `gossipCanRaise(g, day)`. `recordGossip()` plants **or folds
into** an existing rumor with two throttles the old code lacked: a paraphrase of a live rumor
about the same subject just adds a carrier and a little heat rather than becoming a duplicate,
and a stakeholder already carrying `gossipMaxLive` live rumors takes no more. A one-time
migration turns every pre-ledger GOSSIP memory into a ledger entry.

New prompt: **`rumorJudge`**. In the payload this surfaces as the `rumors` block, split by
standing — the stakeholder's one raisable rumor vs. talk merely overheard (doc 05).

## World pulse & goal pursuit

- **During the day** (`maybeWorldPulse`, every `pulseEvery` player turns, cap `pulseMax`):
  two co-located offstage characters may interact (`runOffstageInteraction` →
  `offstageEvent` prompt): charged or casual; output is a news-style **world event message**
  (`narratorEvent`), real memories for participants (`_plantWorldMemory`), relationship
  deltas (`_applyWorldRel`), and physical placement at the venue — you can walk in on the
  aftermath.
- **Calendar executor** (`runCalendarExecutor`, `calExec`): due plans that don't include the
  player execute offstage the same way, honoring the plan's recorded origin/purpose.
- **Goal pursuit** (End Day, `runGoalPursuit`, `goalPursuit`): each offstage character decides
  a NEXT MOVE from personality/goals/motives/memories/standings → lands on the **calendar**
  as a plan (solo or with one other character, never the player) for the executor.

## Character quests (v23.2) & quest arcs

- **Character quests** (`universe`-scoped, per holder): born at End Day
  (`runCharQuestSpawn` → `charQuestGen`) from goals + undercurrents. Char→char quests advance
  offstage (`runCharQuestPursuit` → `charQuestStep`, narrated world events, always a final
  result). Quests needing the **player** arrive as a text ask (`maybeCharQuestText` →
  `charQuestText`) or an in-person approach through a **code-checked scene gate**
  (`checkCharQuestApproach` — alone / with named character / at place; ≤1 approach per day).
  Evidence-based reconciliation at End Day (`reconcileCharQuestsForDay`). Awareness lines are
  injected into the holder's reply payload (`quests` block, `charQuestNote`).
- **Quest arcs** (player-facing, Universe → Quests): `generateQuestArc` (`questGen`) designs a
  GM-only premise + one opening quest; completing a quest generates the next
  (`generateNextQuest`/`questNext`) from quest memory + universe memory + live undercurrents;
  quests can materialize locations/NPCs (`questCreateLocations`, `questCreateNpcs`,
  `_materializeQuest`, latent key figures). UI: quests modal, editor, debugger
  (`openQuestDebugModal`), travel shortcut (`questTravel`). Reconciled daily
  (`reconcileQuestsForDay`).

## Goals & ambitions: the curator (v30.3)

`persona.goalsLive = {lines[], day, at, changed}` — the ONE want-list that reaches a character's
payload as `<goals_and_ambitions>` (doc 05). It replaced three payload sections that only ever grew:
the authored goals field frozen at creation, a `<your_quests>` dump re-stating every pursuit and its
whole progress log, and a `<what_you_quietly_want>` line from the live intent.

`runGoalsCurator(chat, day, uni)` runs at **End Day, after the quest passes and the intent engine**
(the two things most likely to have changed what somebody wants) and **before the chronicler**.
It is a REWRITE, not an append — the `goalsCurator` prompt's whole job is deciding what to DROP:
keep / reword / merge / drop each existing line, add at most one or two the day genuinely earned,
cap at `state.goalsMax` (default 5).

Inputs per character: the authored goals (the **foundation**, never written to and never
contradicted), the section as it currently stands, their active and just-resolved character quests,
their live private intents, the commitments they are bound by, the memories they formed today, and
which of their bonds moved today.

Bounded on purpose: `_goalsMoveScore` skips characters the day did not move (a quiet character's list
is already correct), and at most six characters are curated per day. Off via `state.goalsCuratorOn`,
and "Reset to the foundation" in the character editor clears `goalsLive` — which also happens
automatically when the author edits the goals field, since the list was grown from the old one.

`engineGoals(p, cap)` is the read path for every engine that used to read `persona.goals` directly.

## Promises & standing commitments (v30.3)

The calendar tracks things with a DATE. The other half of what people hold each other to has none —
"I'll never touch him again", "promise me you'll always be on my side", a rule accepted under
pressure. The meetings detector was right to drop those, and there was nowhere else for them to go.

`chat.promises[]` is a ledger with the same discipline as the gossip ledger:

| Field | Meaning |
|---|---|
| `holderId`/`holderName` | who is bound by it |
| `toId`/`toName` | who it was given to (may be empty) |
| `ask` | what was asked, or what prompted it — the reason, which is what makes it make sense a week later |
| `promise` | the word actually given, as a standing rule |
| `kind` | `promise` · `prohibition` · `arrangement` · `change` · `secret` |
| `weight` | `binding` or `soft` (given lightly / under pressure) |
| `status` | `open → kept | broken | released`, with `statusDay` and a `note` |

`runPromiseEngine(chat)` fires from `postTurn` on every second turn and does BOTH jobs in one call:
finds new commitments and settles the open ones (`kept`/`broken`/`released`/`reaffirmed`), which is
what keeps the ledger from becoming another append-only dump. `recordPromise` swallows paraphrases of
a word already given (`_prSame`, 60% content-word overlap); `_prPrune` drops resolved entries after
7 days and caps the list at 60. A **broken** word plants a real memory for whoever it was given to,
so feelings, gossip and intents pick it up through the normal path.

**(!) Four read paths, and they must stay in step** — a commitment nobody but its holder knows about
is worse than none at all:
1. the speaking character's payload — `promiseContextFor` → the `promises` block,
2. the Gamemaster and Scene Writer — `promiseDirectorBlock` inside `directorContext`,
3. the offstage engines — `promiseContextForNames` on the world pulse, calendar executor, goal
   pursuit and character-quest step,
4. the goals curator, as context for what a character can want.

UI: a read-only section in the Meetings modal (`_calPromiseSection`) with release and delete.
Off via `state.promiseOn`.

## Calendar & meetings

`runCalendarEngine` (`calPrompt`) extracts only **concrete dated meetings** (day, executor,
certainty, purpose) from conversation/texts into `chat.calendar`. Uncertain meetings get an
attendance % (`estimateAttendance`), which the player can move by addressing it
(`adjustAttendance`/`attendancePersuade`). Due handling (`resolveDueMeetings`): executor
arrives at the entrance (`_fireArrival`), the player is prompted to travel, or a no-show
plants the right memory (`_plantNoShowMemory`). End Day: `reconcileCalendarDay`
(`calReconcile`) marks done what actually happened. UI: calendar modal (badged in the chat
menu), manual add/edit (`addCalManual`), world-map section.

### Three shapes of a meeting (v54.1) — `meetMode(e)`

`executor` carries the shape, and **every** reader goes through `meetMode`/`meetIsBoth` rather
than testing `executor!=="user"` (which silently answered "the character is coming"):

| value | meaning | where |
|---|---|---|
| a character's name | they travel to `{{user}}` | `{{user}}`'s home, or the named place |
| `"user"` (or empty) | `{{user}}` travels to them | their home, or the named place |
| `"both"` | **nobody hosts** — each travels, arriving separately | the named place, and it is **required** |

`"both"` is the ordinary out-in-the-world case the calendar could not express: the two home
modes are somebody's front door, so a café was stored as one of the houses and then narrated as
a visit. Consequences: `_resolvePlanLoc` never falls back to a home for it; `resolveDueMeetings`
gets its own branch (the player is asked to set out, travels alone, then the counterpart arrives
in their own beat — the only mode where both arrivals are narrated); the payload line says
"NEITHER of you hosts … arriving separately" instead of naming an actor; `reconcileCalendarDay`
treats it as the player's own (no offstage result beat); the dedupe guard stops reading the
sentinel as a participant's name. `calPrompt` knows the third value, when to use it (whose door
is being knocked on) and that writing it obliges a real `where`; the tracker normalises a
capitalised "Both" and refuses it on a char↔char plan, where it would mean nothing.

### A plan that claimed the player was coming (v60.1)

From a live payload: an entry reading *"She plans to go to Emre's house and ask directly why he never
came"* reached her with the line **"Emre Tokmak is the one coming; you are expected to be there"** —
while she was standing in his kitchen, having already asked. Three faults stacked:

1. `runGoalPursuit` wrote **no `executor` at all**. A pursuit plan has exactly one actor and it is
   never ambiguous — the character pursuing it — so it now records `executor`/`executorId`.
2. The boot back-fill then **invented one**: the v22 step that carries a legacy `doer` over to
   `executor` fell through to `"user"` when there was no doer either, so any writer that forgot the
   field produced a plan asserting the player was coming. With no doer, nothing is stamped now, and
   `actorOf` already prints nothing for an unset executor — which is the honest reading of "nobody
   wrote down who acts".
3. `_hereNow` returned false whenever the reader was the **only** name on the entry — the exact
   shape of a plan a character made for herself — so a plan being kept still read as pending. Being
   at its location at its hour is now enough; a second name is what makes it happening *with*
   someone, and the wording splits accordingly.

Also: `planDueNow` stays true for the rest of the day once a period arrives, so an Afternoon plan
still announced **HAPPENING NOW** at Evening. An entry whose hour has passed and which is not
visibly being kept moves to its own `ITS HOUR HAS PASSED TODAY` line. And the purpose is cut with
`briefDesc`, not `slice(0,120)`, which had left her reading *"…ask directly why he never came to t"*;
`goalPursuit`'s `detail` field is now specified as one short purpose phrase **in the character's own
terms**, because it is printed back to that character as "for: …" and was arriving as a note written
about her in the third person.

### The proactive-text memory carried the engine's reasoning (v60.1)

`deliverProactiveText` built its memory as ``I texted X first (${why}): "…"`` — where `why` is the
proactive-text judge's own reason for deciding to send, written **about** the character in the third
person, in whatever language that engine answered in. The bank filled with
*"I texted Emre first (Akşamki planın belirsizliği Burcu'yu rahatsız ediyor…)"* and
*"(The loosely floated meeting needs a nudge, and she wants to…)"* — two languages, third person,
ellipsis-clipped, inside a first-person record read back to her as her own memory.
`engineLangDirective` exists to prevent exactly this wherever a **model** writes a memory; this line
built one in code and went around it. The parenthetical is gone — the message she sent carries the
motive, and she can read what she wrote. The one caller that hard-coded a Turkish `why` passes
nothing now.

### A journey made to keep a meeting (v54.1)

`travelTo(locId, companions, {meeting, counterpart})` and `narrateCharMove` both receive
`meetingBackstory(chat, e, p)`: what was arranged, why, whether it was firmly agreed or only
floated, up to three of the traveller's **own** memories bearing on it (`_meetMemLines` — scored
deterministically on the plan's own words and meeting-ish tags, so nothing is hallucinated and no
retrieval call is spent), and how they currently feel about the other party (`relFeelSummary`).
Both prompts now say the journey is where the meeting comes back to mind — **one brief clause** of
why they are going and how it sits with them, never a recap.
**NOBODY TRAVELS TOGETHER (v55.1).** The alone rule is universal, not a meeting's privilege: no
journey in this app is shared. With an empty companion list the writer had nothing to say about who
else was travelling, so prose filled the gap and the counterpart turned up walking beside the
player — on the way to a meeting they were supposed to arrive at separately. And a companion ticked
in the travel UI was labelled `Travelling: <name>`, which is an invitation to write the two of them
in a car talking, and that is what came back.
So the context now names them as **also going, each by their own way**, and the prompt writes them
at the destination rather than on the road; with nobody ticked it says so outright. The travel UI's
own line says the same, so ticking somebody no longer promises a shared ride.
`DEFAULT_CHAR_MOVE` matches: nobody accompanies a mover, two people heading for the same place do
not head there together, a meeting arrival is "ONE HALF of an appointment", and a batch from
`narrateCharMoveGroup` is **several separate journeys reported in one breath, not a party** — which
also settles a contradiction v54.1 introduced, where the prompt said "only the character named is
moving" while that function hands it a list and asks for all of them in one beat.

## Texts (phone side-channel)

Full-payload character replies adapted to texting (`buildTextReplySystem` + `textReplyPrompt`;
dialogue only), real time+game-day stamps so silence is *felt*; proactive texts
(`maybeProactiveText`/`textProactivePrompt`, ≤1 per period, forced pass at End Day);
left-on-read consequences (`reconcileTextsDay`, mood nudge + memory). Text exchanges get their
own memories (`rememberTextExchange`). UI: per-character text windows, inbox with unread
badges. Since v28.6 a text reply uses the **shared reply payload** (`text` layout key) — same
blocks as a spoken turn, only the format rules differ (doc 05).

## End Day pipeline (`endDayBackground` — full order, after the day visibly advances)

1. `flushMemoryArc` (day-stamped — **must be first**; everything below reads today's memories)
2. `reconcileCalendarDay` → 3. `reconcileQuestsForDay`
4. `writeDayDiaries` (∥ `runDailyRelationships` — slow axes over the day snapshot)
5. `reEvaluateRelationshipsForDay` (regenerate factual sheets for pairs whose axes moved)
6. `runGossipPropagation` → 7. `maybeWorldPulse({dayEnd:true})` (settle still-due plans)
8. `runGoalPursuit` → 9. char quests: reconcile → pursue → spawn → text
10. `reconcileTextsDay` → `maybeProactiveText({force:true})`
11. `maybeSpawnConfrontation` → 12. `bindPendingTasks`/`runBackgroundTasks` →
13. `runIntentEngine` → 14. `runGoalsCurator` (rewrites each moved character's want-list) →
15. `runUniverseChronicler` (**must be last** — the day's record)

The foreground `endDay()` (before all this): confirm dialog → snapshot the day's messages
(**before** pushing the new `dayMarker` — the marker would blank the "today" window) →
transition narration → advance `gameDay`/period → `tickTrackersForDay` → reset player to
home/entrance, clear `subPos`/`companionLock` → re-place the cast (`resolveWorldPositions`).

⚠️ `endDayBackground` resolves the universe as **both** id string and object (`uid`/`uniObj`)
because half the passes expect each — passing the wrong shape silently no-ops a pass (this
killed the char-quest pipeline once, v24.4).

## Universe memory

Layer 1 **state zero** (`originDoc`, `originGen` prompt — who is who, wants, history, ties;
written in the editor or lazily on first quest need) + layer 2 **chronicle**
(`runUniverseChronicler`/`chronicler` — 2–6 neutral dated entries per day; old entries
condense into eras via `condenseChronicle`). Fed to the quest designers
(`universeMemoryBlock`) alongside live undercurrents and `hotPairsBlock`.

## v69.1 — the Scene Writer is told what kind of event it is

The classifier (`sceneSetup`) has always returned a `type`, and the event record has always carried
it as `ev.type`. It stopped there. `runSceneWriter` filled the prompt with `{{user}}`, `{{summary}}`,
`{{turn}}`, `{{min}}` and `{{max}}` — and nothing else — so the writer had to infer from the summary
prose whether this was a person arriving, a sound that reached the room, or something that moved
elsewhere entirely. The turn budget and the arrival rules then applied identically to all of them:
an environment beat drew a character event's minimum turns with nothing to spend them on, and the
writer closed the gap the only way a writer can, by inventing somebody to carry the sound.

`{{type}}` is a placeholder now, filled from `ev.type` and normalised to one of `character`,
`environment` or `offstage` (anything else reads as `environment` — one or two turns, nobody
enters; an event with no type at all reads as `character`, which is how an untyped event has always
behaved). The shipped default branches on it under **WHAT KIND OF EVENT THIS IS — READ FIRST**:
`offstage` is one line stating a fact of the world, resolved on the turn it fires with the minimum
not applying; `environment` is the signal itself, resolved within two turns, with the person behind
it staying offstage and unnamed; `character` keeps Rule Zero, the spine and the full budget.

The setup path also stops flattening the classifier's answer. The shipped classifier prompt offers
`character | environment` only, so `offstage` does not occur today — but that prompt is
user-editable, and an edited one that adds the third value now reaches a writer that knows what to
do with it. Until then an offstage-ish event arrives as `environment` and is written as a short beat
nobody reacts to, which is the acceptable degradation.

## v70.2 — two engines that could not see what they were reasoning about

**`intentForm` had no `{{open_intents}}`.** A prompt naming it shipped the literal placeholder to
the model. The engine's question is whether a *new* motive has formed tonight, and it was answering
that with no knowledge of which motives this character already carries — so the same grievance
could re-form from the same charged memories every night it stayed hot, and a motive they had
already acted on could be invented again from scratch.

`holderIntentRecord(chat, holderId, nameById, day)` fills it with that character's **own** record:
live ones first (kind, target, aim, strength, age), then the last few spent ones marked
`ALREADY ACTED ON` with an instruction not to re-form them. Their own only — an intent is a secret,
and one aimed *at* them is not theirs to know; a test pins that another holder's motive never
appears. The registry hint now lists every name the call site actually fills, `{{goals}}` included,
which it had been omitting.

**The proactive text composer could not see time or place.** Two gaps, both of data that already
existed:

- `_stampText` has always written `gday` and `gperiod` onto every text message, and the thread
  rendered neither. Three unanswered messages an hour apart and three spread over three days read
  identically, so "how long have I been left on read" — the single thing that most decides whether
  a person writes again, and what they write — was not in the payload at all. Each line carries its
  day and period now, and the window is the last four rather than six: with a stamp on each, the
  recent ones say more than a longer unstamped list did.
- Neither party's location was sent. The composer could not tell texting someone across town from
  texting someone standing in the same room. Both are stated in the `# Now` block, and the
  same-place case is said out loud rather than left to be inferred.

## v70.3 — two engines reasoning from a tally instead of a record

**`charQuestText` could see how often it had asked, not what it had said.** The follow-up rule — *a
considered follow-up that moves the matter forward, NOT a nag* — was being asked of a model given a
count (`they have raised it before (2x)`) and not one word of those two messages, nor whether the
player had answered them. There is no way to avoid repeating yourself when you cannot see what you
said, so the second ask paraphrased the first. Each sent ask is now recorded on the quest
(`q.texts`, day/period/text, capped at three) and reaches the prompt under an instruction not to
repeat any of it; the recent text thread goes in beside it, stamped, because that is where the
player's answer — or their silence — actually is. Day and period were already being sent.

**`afterHeatPrompt`'s previous decision had nowhere to live.** It was already scoped to the right
person, but it was read from a single `p.afterHeat` that every reckoning overwrote. A night with
somebody else in between wiped the chain, and the next reckoning about the *first* person read as
though it were the first ever. That chain is the whole mechanism — the decision getting shorter, the
condition getting cheaper, until there isn't one — and with one slot it silently reset whenever the
story went anywhere else. The same slot fed the `after_heat` payload block, so her decision about
one person disappeared from their payload too.

The record is kept per person now (`p.afterHeatBy[name]`), with the single slot still written so an
older save and the existing readers keep working; both the engine and the payload block read the
per-person record first and fall back. A decision is still never shown to anyone it was not about.

The reckoning is also told **which moment it is being taken in** — still in the room with them, just
after they have gone, or later with the day moved on. Same night, three different decisions.

## v70.4 — the character-quest loop closes

**The designer could not see what was already being chased.** `charQuestGen` was asked whether this
character now commits to a concrete pursuit, with no sight of the pursuits already running — so two
characters could set off after the same thing, and a holder whose quest had just closed could be
handed the same one again, the goal still reading as unmet because the finished quest was nowhere in
view. `{{open_quests}}` now lists the open ones (title, target, in progress since day N) and the
ones closed in the last week (title, target, how it ended), with the instruction that a quest
already chasing this is a reason to return `{"quest": false}`.

**`done_when` now exists and has a consumer.** The designer states one observable, checkable
sentence — *a state of the world someone could point at, not a feeling* — it is stored on the quest
as `doneWhen`, and the stepper is given it with the rule that `outcome: "done"` is returned only
when what it just narrated makes that sentence true. The rest of the loop was already built and is
what makes the condition worth having: a closed quest becomes a settled event (`settledEventLines`),
and `liveGoalsLines` already drops any live goal matching one. Quest → event → goal was never the
broken link; the freehand "is it finished?" judgement at the front of it was. Pinned end to end.

**The stepper could not see where the target was.** Only the holder's place was sent, so *"they
cannot simply walk up to them"* had nothing behind it: a move could put two people in a room the
world has in different towns, and a pursuit of somebody who is not there could repeat the same
approach every night without ever failing to reach them. `{{target_place}}` is resolved from world
positions, with the rule that a move across a distance is a journey, a message, a wait, or something
done through someone else.

**One emotion vocabulary, one memory language.** `memBuild` has always declared a fixed ten-token
English list and called it a machine value. The three world-pulse writers that plant into the *same*
bank — `charQuestStep`, `offstageEvent`, `calExec` — asked only for `"<one word>"`, inside prompts
written in the story's language, and for the memory itself asked for *"a 1-2 sentence Turkish
memory"* while the runtime `mixedLangDirective` overrode them to English. The bank therefore filled
with English tokens from one writer and whatever the model chose, in whichever language, from the
others, and nothing downstream could compare them. All three now state the same token list and ask
for the memory in the bank's one language, so the prompt body agrees with the directive instead of
contradicting it inside the same request. `normalizeEmotion()` is the backstop at both write paths
(`_plantWorldMemory` and the arc builder): a recognised synonym maps to its canonical token, and
anything else becomes `neutral`.

`gistBuild` and `poiGossip` keep their own seven-token palette on purpose — those are an observer's
attitude to something witnessed, not a felt emotion, and they are not what the four writers above
share.

**Non-USER quests and the offstage director:** they do not reach it, and they do not need to.
`charQuestStagingSummary` filters to `targetId === "__user__"`, so only quests aimed at the player
feed the Gamemaster's staging; char→char quests have their own day-end stepper
(`runCharQuestPursuit`). The `ask` field is already stored only for user quests
(`ask: targetId==="__user__" ? … : ""`), so nothing is being carried that nothing reads.

## v73.1 — the same beat, resolved twice and remembered twice

Traced from one debug export, these turned out to be one failure with several exits.

**A satisfied ask could not end its event.** `runSceneWriter` resolved on
`resolved && ev.turn>=ev.minTurns`. The player granted the want on his first opportunity; the writer
returned `resolved: true` on turn 2 of 3; the engine discarded it because the floor had not been
reached; turn 3 fired forty-three seconds later and resolved the same tension again with a
near-duplicate narration. The minimum is a floor on *premature* resolution, and it belongs in the
prompt — which now says outright that a granted want ends the event on that turn and that
re-confirming something already agreed is not a beat. The engine honours an explicit `resolved` at
any turn index. The judged kinds (confrontation, overture) are untouched: they decide from where
conviction landed and keep their own `minTurns` thresholds. A turn requested for an event already
flagged resolved is refused and logged.

**The same beat was written to the bank twice.** The arc tracker answered `finished` three times
inside one scene, all three summaries describing the same agreement, and the guard at the end of
`commitMemoryArc` only caught a *literal* repeat. `memNearDuplicate` compares word overlap against
what this character already holds from the same day and part of the day, with an overlapping-people
check; the first telling stands and the second is dropped and logged.

**A period came from a word, not a clock.** `_calInferDayPeriod` matched "akşam" inside "akşamüstü"
and never read the stated hour. `periodForHour` declares the boundaries once (Morning 06–11, Midday
11–14, Afternoon 14–17, Evening 17–21, Night 21–06) and `statedHour` reads the forms a line actually
uses — `17.00`, `17:00`, `saat 5`, `at 5pm`, `saat beşte` — with the surrounding words deciding
which half of the day a bare hour belongs to. A stated clock beats the word wherever both appear.

**A meeting kept an unregistered place name.** One agreement was filed at three different places
because each consumer resolved the free text "salon" for itself. `_matchKnownPlace` is the
read-only half of `_ensureLocationByName` — the same Turkish-aware near-match, but it never creates
a location — and only a match is stored as the place. An unmatched name is kept as `whereRaw` for
the binder, never as a location. A place equal to the room the characters are standing in, for a
meeting on a *later* day, is dropped to unresolved rather than asserted: that is almost always the
model repeating the scene heading instead of reading the dialogue.

**A decision was stored in the second person.** The reckoning is written *at* the character because
that is what her payload block needs; the memory bank is first person. `toFirstPerson()` converts on
the way in, so one list no longer holds two grammatical persons.

**A foreign word reached the player.** "Duygu slow bir nefes verdi." Detecting this by "ASCII-only
token" does not work for Turkish, where most of the language is ASCII; `foreignWordHits` uses a
curated set of English words of four letters or more with no Turkish homograph, lowercase only so
proper nouns are exempt. A hit buys exactly one retry, through the editable `sceneLangRetry` prompt,
and every hit is logged.

**Per-call timing.** `dbg()` stamps its log timestamp before walking the payload to estimate tokens,
and a caller can await between logging and dispatching. `dbgDispatched()` re-stamps at the fetch,
per attempt, and `dbgDone` measures from there.

**The chronicle day boundary is correct** — checked, not changed. `runUniverseChronicler` is called
from `endDayBackground` with the just-ended day, captured in `endDay` before `gameDay` advances, and
it filters its evidence strictly (`m.gameDay!==day` → skip, `p.day===day`). Seeing it run for day 3
while the scene shows day 4 is the end-of-day rollup firing after the boundary, as designed; a day-4
memory cannot enter the day-3 record.
