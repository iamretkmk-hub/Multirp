# 09 · World Systems — Universes, Characters, Places, Trackers, Relationships

## Universes & the profile switch

A universe groups characters into a shared world (entity shape in doc 02). Opening one
(`openUniverse`/`enterUniverseChat`) calls **`applyUniverseProfile(uid)`** — resolves the
active player identity (name/look/personality/style/bio) from the universe's overrides with
global Settings as fallback. Each universe has exactly one story chat
(`chatForUniverse`/`startSceneFor`).

Universe generation: `runUniverseGenerator` (brief + character count → `univPrompt` on the
authoring model → world + cast JSON) followed by authoring post-passes: director notes
(`generateDirectingNotes`), genre pack + guide (`generateGenrePack`), and optionally the
**per-universe prompt tuner** (`tuneUniversePrompts` — rewrites the living-engine prompts in
the world's flavor; every result is validity-checked by `_tunedPromptIsSafe` (placeholders,
JSON contract, code-evaluated enums) and skipped if it would break anything; saved as
per-universe overrides, manual-only).

## Characters

Card fields and their consumers (see doc 02 for the shape):

| Field | Consumed by |
|---|---|
| instructions/personality/backstory/traits/style | reply payload bio block |
| goals | GM, intent engine, goal pursuit, char-quest designer, the character's own turns |
| interject (pressure points) | GM & Scene Writer only (never shown to other characters) |
| socialGraph (hand-written) + relGen (generated) | relationships payload block; engines may *append*, never overwrite your text |
| tags | World Rules group matching |
| look + wardrobe | image pipeline (deterministic appearance injection) |
| voiceId / ttsVoice | calls / dubbing |
| visitLocs + schedule/whereabouts | daily placement dice |

Generators: single (`generateBioIntoEditor`, `bioPrompt` — world block + existing card as
context so the model *updates* rather than reinvents), batch (`generateBatchCharacters`,
`batchBioPrompt` — mutually-related set), appearance (`generateAppearance`), portrait
(`generateProfilePic`), schedule (`generateSchedule`), relationships
(`generateRelationshipsFor`). Auto-characters: the GM/events can mint `temp` cards
(`ensureTempChar`); with `autoCharOn` they're added immediately and `fillPendingBios` writes
the bio after `autoCharDelay` witnessed messages. `/remove` = soft-delete (`removed`;
`isActiveChar` false everywhere); hard `deletePersona` exists in the editor but the soft path
is the safe one mid-campaign.

The **character page** (`openCharacterPage`) is a per-character hub: profile + everything
bound to them (media, diaries, memories, relationships, quests).

## Locations, sub-areas, presence geometry

- `universe.locations[]`: type `home`/`poi`, description (drives scene & image), travel time
  override, **gossipChance** (leak-on-exit, doc 08), residents (present when you arrive;
  never auto-placed elsewhere; receive that place's leaks), picture (chat background via
  `applyLocationBackground`).
- **Sub-areas** (`sublocations`): every location has an immutable Entrance
  (`migrateSublocations`); each sub-area is its own **earshot** — `inSceneCast` (same
  sub-area) vs `presentCast` (same location) vs `offEarshotCast`. `chat.subPos` maps each
  character to a sub-area; "Move to area" (`openSubMove`/`moveToSub`) and `callToArea` move
  people; arriving anywhere puts you at the Entrance.
- **Travel** (`travelTo` → `openTravel` UI): costs periods (`travelTime`), optional
  companions (`chooseCompanions` → `companionLock`), narrated (`travelPrompt`), pushes a
  `travelBeat` (the scene boundary for history & memory), triggers arrival hooks: latent-NPC
  seeding (`maybeSeedLocationNpcs`, ≤2 minted inhabitants on first visit), location gossip
  leak on exit, bound task/meeting arrivals (`maybeTriggerTaskArrival`).
- **Daily placement**: `resolveWorldPositions` rolls each character's location for the day
  from home + `visitLocs` + schedules (`placementWeights`/`rollPlacement`), stored in
  `chat.worldPositions`; `charLocationLine`/`offstageRoster` feed director context.
- **World Rules** (`universe.rules`, compiled by `ruleCompiler` from plain language):
  enforced **in code** — placement (`allowedLocs`), arrivals/GM summons (`ruleBlocksChar`,
  `charBarredHere`), confrontation timing, travel companions. Group rules match character
  tags.
- **World map** (`openWorldMap`): canvas hub — locations (drag-editable positions), character
  states (`_mapCharState`: place, feelings, intents, quests; bring/call/go), travel, calendar
  section, End Day button, map background image editor.

## Time

`chat.gameDay` + `chat.period` (period list via `chatPeriodIndex`/`chatPeriod`;
`advanceTime` steps periods, travel consumes them). Manual control: Set time/place modal
(`setSceneState`/`saveSceneState`). Scene transitions inject the "WHAT JUST CHANGED" call-outs
(doc 05 fragments) via `sceneChangeNotice`. End Day resets to Morning at the player's home.

## Trackers (freeform numeric story state)

Defined per universe (`universe.trackers`, editor in doc 03); **values are per-chat** and
reset per story (`trackerVal`/`setTrackerValOwner`, keyed by owner: `__story__`, `__user__`,
or a character id).

- Behavior: `free` / `up` / `down` / `counter` (`applyBehavior` clamps direction).
- Method: **llm** (the tracker engine judges the scene each turn — `runTrackerEngine` with
  `trackPrompt`, or the tracker's own `model`), **endday** (fixed `perDay` delta at End Day —
  `tickTrackersForDay`, optional `activateAt` floor), **trigger_then_day** (the engine
  watches for `triggerPhrase`; on detection a dice roll `dice`/`diceHit` decides the hit —
  `rollDice` in code, never the LLM — then `onHitSet` jumps the value and the daily count
  takes over; e.g. pregnancy).
- **Breaking points** (`stages`: threshold → text): the active stage's text is injected into
  the owner's payload (`activeStage`/`trackerContext`); crossing one can post a narrator
  beat.
- **Public knowledge** (`publicAt`/`publicScope`/`publicText`): past the threshold,
  `checkTrackerPublicity` plants a vague `{{name}}`-substituted line as durable knowledge for
  those who'd perceive it (`seen`) or the whole world (`universe`) — each character reads it
  through their own relationship to the owner. The owner still sees their exact stage.
- Generator: "Generate with AI" (`genTrackerAI` → `trackerGen`) builds a complete tracker
  from a description.

## Relationships (three layers)

1. **Slow axes** (trust, affection, respect; −100…+100): re-judged **per day** at End Day
   from the day's exchanges (`runDailyRelationships` → `relPrompt`). The settled, considered
   view — governs behavior (`relConsideredProse`, `relDescription`).
2. **Fast axes** (desire, comfort, fear, agitation): scored every few exchanges during play
   (`runShortTermRel` → `relShortPrompt`, adaptive `stInterval` cadence) and **decayed**
   (`decayFast`). The right-now charge — shapes delivery, feeds mood-congruent memory recall,
   and `relImpulseTension` flags impulse-vs-settled conflicts (desire without affection ⇒
   likely regret, etc.).
3. **Factual ties** (`relGen` + `socialGraph`): who people *are* to each other — kinship,
   address forms, cohabitation, standing. Generated per character
   (`genRelationshipsForCharacter`), re-run at End Day only for pairs whose slow axes moved
   (`reEvaluateRelationshipsForDay`, `relMovedToday`).

Storage: direction-keyed pair objects on the chat (`relObj(chat, fromId, toId)` — includes
`__user__`). Payload rendering: `feelings` block (doc 05) picks lasting + momentary prose, or
the `stranger` block when the pair has no history (`relHasContent`). The Story State modal
(`openStoryState`) is the inspection UI: every pair's axes, trackers, intents, meetings —
with manual nudge controls (`nudgeTracker`, `setTrackerVal`).

## Cross-effects

- Renaming a **location** breaks lexical matches used by memory location facets and calendar
  place resolution (`_resolvePlanLoc` matches by name); prefer editing descriptions.
- Renaming a **character** is worse: memories (`people[]` by name), relationship prose,
  presence notes and legacy witness lists all match names. The codebase tolerates legacy
  name-based `present[]`, but a rename mid-campaign fractures history — avoid, or accept the
  seam.
- Deleting a location that is someone's home/visit target leaves dangling ids —
  `resolveWorldPositions` falls back safely, but clean up residents/visitLocs when editing.
- Trackers with `method:llm` cost one engine call per turn each — many active trackers =
  latency + spend. Prefer endday/trigger methods where possible.
