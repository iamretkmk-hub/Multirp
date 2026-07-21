# 02 · Data Model & Storage

## Two storage tiers

| Tier | What lives there | Why |
|---|---|---|
| **localStorage** (~5 MB quota) | Every setting, prompt override, API key, toggle — all the scalar keys in the `K` map (all prefixed `sm_`). | Synchronous, tiny values. |
| **IndexedDB** `storymind_media` (hundreds of MB–GB) | Object stores `images` and `videos` (full-res base64 / URL records, keyPath `id`), plus a `kv` store holding the *growing collections*: `chats`, `memory`, `universes`, `personas`, `scenes`, static image bytes (`simg:*`, `mimg:<mid>`), and rolling `autobackup_*` bundles. | Collections grow without bound; localStorage would overflow. |

Access goes through two wrappers — never call `localStorage`/`indexedDB` directly:

- `store.get/set` (JSON) and `store.raw/setRaw` (strings) — fail-soft, returns default on error.
- `mediaDB.getAll/putAll/put/delete` (media stores) and `mediaDB.kvGet/kvSet/kvKeys/kvDelete`.

**Boot order matters:** `preloadCollections()` runs *before* `loadState()` and stashes the
IDB collections in `_idbColl`; `loadState()` prefers those over any legacy localStorage copy
(one-time migration).

## The `state` object

`loadState()` builds one global `state` with ~250 properties. Groups:

- **Keys & providers**: `key`, `segkey`, `atlasKey`, `falKey`, `civitaiKey`, `dgKey`, `ttsRelay`,
  `imgProvider`/`vidProvider` (+ per-purpose model ids: `model`, `rewriter`, `mcModel`,
  `memModel`, `gmModel`, `bioModel`, `authorModel`, `routerModel`, `callModel`, and the
  formerly-hidden overrides `fallbackModel`, `sttFixModel`, `recapModel`, `portraitModel`,
  `mapImgModel`, `uniPicModel`…).
- **Sampling / generation**: `tokens`, `temp`, `reasoningOn`, `reasoningEffort`, `topP`, `topK`,
  `freqPenalty`, `presPenalty`, `provDeny`, `geminiUnsafe`, `fnCfg` (per-function temp/token
  overrides used by `fnTemp(fn,default)` / `fnTok(fn,default)`).
- **Prompts**: one property per `PROMPT_REGISTRY` key (`baseInstruction`, `formatRules`,
  `memBuild`, `gmJudge`, …) — the *global* layer of the prompt resolution chain.
- **Feature toggles & thresholds**: `mem`, `autoImg`, `gmOn/gmEvery/gmSensitivity`, `sceneOn`,
  `relOn`, `trackOn`, `calOn`, `textsOn`, `gossipOn/gossipThreshold/gossipMaxPerDay`,
  `intentOn/intentMax`, `pulseOn/pulseMax/pulseEvery`, `charQuestsOn`, `goalPursuitOn`,
  `condenseOn`, `embedOn`, `heatOn/heatN`, `autoRpOn`, `recapOn`, `histTurns`,
  `stripNarr/stripKeepFull`, `narrPrivacy`, memory-retrieval weights `memW*`, tier counts
  `memRecentCount/memDistantCount/memLongtermCount`, `memIntimateFrac`, `memPerTypeCap`, …
- **Payload customization**: `payloadLayouts` (per-payload block order), `payloadRemoved`
  (blocks the user ✕-removed), `blockTpls` (fragment overrides), `styles` (image style list).
- **UI**: `theme`, `font`, `streamReveal`, `revealCps`, `uiScale`, `storyLang` (en/de/tr).
- **Collections**: `chats` (object keyed by chat id), `personas` (array), `universes` (array),
  `memory` (flat array of all memories), `images`, `videos`, `scenes` (hydrated async),
  `curChat`, `curPersona`, `curUniverse`.

Adding any new persistent value means touching **four places**: `K` (key), `loadState()`
(default), `saveSettings()` (persist), `syncSettingsUI()` (reflect into the UI) — see doc 12.

## Entity shapes

### Chat (one story per universe; `state.chats[id]`)

```js
{
  id, universeId,
  messages: [ …see Message below… ],
  gameDay: 3, period: "Evening", timeOfDay: "Evening",
  location: "Cafe Derya", locationId: "loc_…", subId: "sub_…",   // authoritative place
  subPos: { [personaId]: subId },        // which sub-area each present character stands in
  presentIds: ["p_…"],                   // who is in the scene (cast "nearby")
  worldPositions: { [personaId]: locId|null },   // offstage placements for the day
  companionLock: { [personaId]: true },  // travel companions pinned to the player today
  calendar: [ …plan entries… ],          // meetings/tasks (see doc 08)
  intents: [ …offstage motives… ],       // living-universe layer 4 (see doc 08)
  activeEvent: {...}|null,               // live Scene-Writer event (confrontation/overture/GM event)
  pendingGmNudge: string|null,           // hidden director note consumed by the next reply
  memEvent: {startIdx,open,paused,summary}|null,  memDoneIdx,   // memory arc tracker (doc 07)
  gmLastCheck, dnd,                      // gamemaster cadence + Do-Not-Disturb
  imgPromptBy: { [charKey]: prompt },    // per-character image continuity (doc 10)
  lastImgRuleBy: { [charKey]: label },   // per-character sticky scene type (doc 10)
  lastActive, _rev,                      // persistence bookkeeping
  // transient (never persisted — any key starting with "_"): _heatBeat, _gmBusy, _heatRanMid…
}
```

### Message (an entry in `chat.messages`)

```js
{
  mid,                       // unique id — the DOM/render/persist handle
  role: "user"|"assistant",  // (system-ish lines are assistant + a flag below)
  content,                   // the text; *narration*, _thoughts_, "dialogue" markup
  speaker, speakerId,        // which character spoke (assistant lines)
  present: [personaId…],     // WITNESS LIST: who was in the scene when this line happened.
                             // Drives witness-scoped history and memory building. Never rewrite.
  // media:
  img, imgSrc, imgState:"idle|loading|done|error", imgPrompt, imgRule, ratio, imgStored, hadImg,
  video, videoSrc, vidState, hadVideo,
  // line-type flags (mutually exclusive):
  sysError,        // red inline error/notice — excluded from all payloads & engines
  presenceNote,    // "— X has arrived —" (carries enteredIds/exitedIds)
  dayMarker,       // End-Day divider (dayFrom, dayTo, narration)
  narratorEvent,   // world-event / narrator beat (world pulse, quests…)
  travelBeat,      // journey narration — also the SCENE BOUNDARY marker
  textMsg, textWith, gday, gperiod, ts,  // phone texts (never in scene history; present:[])
  // transient: _reveal (typewriter), anything "_"-prefixed is stripped on persist
}
```

### Persona (character card; `state.personas[]`)

```js
{
  id, name, universeId, avatar /*emoji*/, image /*portrait*/,
  instructions, personality, backstory,
  traits,        // five-axis behavior profile (one rule per line)
  goals,         // drives GM / intent engine / quests
  style,         // speaking style
  voiceId,       // Inworld voice (calls), ttsVoice (xAI dub voice)
  look: { faceMap, hair, face, body },  // structured appearance (doc 10)
  wardrobe, tags: "a, b",               // tags feed World Rules group matching
  interject,     // pressure points / hooks — read by GM & Scene Writer only
  socialGraph,   // hand-written ties (never overwritten; engines may append)
  relGen,        // AI-generated factual tie sheet (re-run at End Day when bonds shift)
  visitLocs, schedule/whereabouts,      // daily placement inputs
  temp,          // true = auto-created mid-story, card pending
  removed,       // soft-delete via /remove (dead — kept for history, inert everywhere)
  pendingBio,    // auto-character: fill bio after N witnessed messages
}
```

### Universe (`state.universes[]`)

```js
{
  id, name, avatar, setting,           // world prompt injected into every reply payload
  directingNotes,                      // "how drama works here" — GM/Scene-Writer fuel
  genrePack: { voice, drama, stakes, relInterpretation, diaryVoice, pacing },  // _gpTail() blocks
  guide,                               // player-facing universe guide (chat menu)
  originDoc,                           // universe memory layer 1: state-zero briefing
  chronicle: [ {day, text}… ],         // universe memory layer 2: End-Day chronicler output
  rules: [ …compiled world rules… ],   // enforced in CODE (placement/arrival/travel gates)
  trackers: [ …tracker defs… ],        // values live per-chat, defs live here
  locations: [ { id, name, description, type:"poi"|"home", travelTime, gossipChance,
                 residents:[personaId], sublocations:[{id,name,privacy,image}], image } ],
  prompts: { [promptKey]: override },  // per-universe prompt overrides (up() layer 1)
  userName, userLook, userPersonality, userStyle, userBio, playerHomeLocId,  // per-universe player
  gameData: { quests: [...] }, questsEnabled,   // standalone quest arcs (doc 08)
  image, imgPrompt,
}
```

### Memory (`state.memory[]` — one flat array, owner-scoped by `ownerId`)

```js
{
  id, ownerId, character,             // whose memory this is
  content,                            // first-person record of what happened
  type: "EXPERIENCE"|"OBSERVATION"|"RELATIONSHIP"|"KNOWLEDGE"|"DECISION"|"CONFLICT"|
        "INTIMACY"|"DIARY"|"GOSSIP"|"CONSOLIDATED"|"LONGTERM",
  people: [names], location, emotion, feelings, tags: [lowercase],
  importance: 0..1,                   // storable floor: state.memMinImp
  gameDay, date, source: "auto"|"manual"|"longterm_condenser"|…,
  universeId, chatId,
  // bystander gists only:
  gist, charge: 0..1, observerOnly: true,   // charge ≥ threshold feeds gossip
  // embeddings (when semantic memory is on): vector cache keyed to the embed model
}
```

## Persistence rules (critical)

1. **Chats**: `persistChats()` is debounced (400 ms) and coalesced; `persistChatsNow()` builds a
   **slim** copy per chat (`_slimChat`): base64 `img`/`video` stripped (kept in the media
   stores; remote URLs kept as `imgSrc`/`videoSrc`), all `_`-prefixed transients dropped, then
   writes to IDB kv (`chats`) with a per-chat signature cache so unchanged chats aren't
   re-serialized. Falls back to localStorage with oldest-message trimming if IDB fails.
2. **After mutating a message in place you MUST call `markChatDirty(chat)`** (bumps `_rev`,
   invalidating the signature) or the change will silently never persist.
3. **Anything you store on a chat/message with a leading underscore is intentionally
   transient** — stripped on persist so an interrupted animation/busy flag can't dead-lock a
   reload. Don't put durable data in `_` keys; don't put transient flags in normal keys.
4. `persistPersonas`/`persistUniverses` also run `captureStaticImages()` — portrait/cover/map
   bytes are copied into IDB (`simg:*`) so blob URLs survive reload (`rehydrateStaticImages`).
5. **Media caps**: in-memory heavy (base64) images are capped at 24 (older ones get
   `evicted:true` + empty url); persisted base64 images cap at 60; videos keep the newest 20
   *plus every clip referenced by a scene*. Remote-URL records are never evicted.
6. `flushPersistChats()` is bound to `pagehide`/`visibilitychange:hidden` — required on mobile.

## Migrations & seeding

`loadState()` ends with a series of idempotent migrations — follow this pattern for any schema
change: fresh-install seeding of the bundled default universe (only when personas AND universes
are empty), a guaranteed default universe, orphan personas re-parented to the first universe,
`migrateSublocations()` (every location gets an Entrance), `migratePresenceNoteIds()`
(back-fill structured ids on old text-only presence notes), a one-shot quests-standalone flag
(`sm_queststandalone_v1`), Seedance→wan model id mapping, and style NAME→ID migration.
**Never write a destructive migration** — the codebase's rule is visible in every one of these:
old data is repaired or left reachable, never dropped.
