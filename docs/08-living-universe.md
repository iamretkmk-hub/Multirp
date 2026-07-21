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
  `gossipMaxPerDay`), planted as **vague open-suspicion GOSSIP memories** (a question, not a
  verdict — deliberately winnable later). These fuel confrontations and color scenes.

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

## Calendar & meetings

`runCalendarEngine` (`calPrompt`) extracts only **concrete dated meetings** (day, executor,
certainty, purpose) from conversation/texts into `chat.calendar`. Uncertain meetings get an
attendance % (`estimateAttendance`), which the player can move by addressing it
(`adjustAttendance`/`attendancePersuade`). Due handling (`resolveDueMeetings`): executor
arrives at the entrance (`_fireArrival`), the player is prompted to travel, or a no-show
plants the right memory (`_plantNoShowMemory`). End Day: `reconcileCalendarDay`
(`calReconcile`) marks done what actually happened. UI: calendar modal (badged in the chat
menu), manual add/edit (`addCalManual`), world-map section.

## Texts (phone side-channel)

Full-payload character replies adapted to texting (`buildTextReplySystem` + `textReplyPrompt`;
dialogue only), real time+game-day stamps so silence is *felt*; proactive texts
(`maybeProactiveText`/`textProactivePrompt`, ≤1 per period, forced pass at End Day);
left-on-read consequences (`reconcileTextsDay`, mood nudge + memory; `_judgeTextVisit` may
send the character to find you in person). Text exchanges get their own memories
(`rememberTextExchange`). UI: per-character text windows, inbox with unread badges.

## End Day pipeline (`endDayBackground` — full order, after the day visibly advances)

1. `flushMemoryArc` (day-stamped — **must be first**; everything below reads today's memories)
2. `reconcileCalendarDay` → 3. `reconcileQuestsForDay`
4. `writeDayDiaries` (∥ `runDailyRelationships` — slow axes over the day snapshot)
5. `reEvaluateRelationshipsForDay` (regenerate factual sheets for pairs whose axes moved)
6. `runGossipPropagation` → 7. `maybeWorldPulse({dayEnd:true})` (settle still-due plans)
8. `runGoalPursuit` → 9. char quests: reconcile → pursue → spawn → text
10. `reconcileTextsDay` → `maybeProactiveText({force:true})`
11. `maybeSpawnConfrontation` → 12. `bindPendingTasks`/`runBackgroundTasks` →
13. `runIntentEngine` → 14. `runUniverseChronicler` (**must be last** — the day's record)

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
