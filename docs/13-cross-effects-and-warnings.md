# 13 · Cross-Effects & Warnings

The coupling matrix: what changing X quietly does to Y. Most entries trace to a real shipped
bug (version noted) or an explicit `(!)` guard comment in the source. **Check this list
before any non-trivial change.**

## Payload system (highest density of coupling)

| If you change… | …it affects | Warning |
|---|---|---|
| A reply-payload block (add/remove) | all three reply payloads | **Four places**: producer, `order` of solo+multi+**gm**, `blocks{}`, fragment 3-leg. `gm` shares solo's blocks map but has its **own order** — trackers/calendar were missing from gm in v19.2. |
| A block id (rename) | users' saved layouts | Layouts reference ids by string — a rename silently loses the user's placement (block re-inserts at default). **Never rename.** |
| Fixed prose inside a producer | Settings → Payloads editor | Route it through `blkTpl()` or the editor silently diverges from what's actually sent (3-leg, leg 2 is unguarded). |
| A producer's `fillTpl` variable map | users' customized fragments | Unknown `{{tokens}}` render **literally** into the model input; customized fragments are never auto-upgraded. |
| The payload settings UI | prompt saving / reordering | v19.1's rewrite dropped four handlers (`plqInput`/`plqReset`/`movePayloadBlock`/`resetPayloadOrder`) — call sites live in HTML strings, so `node --check` passes. After any UI rewrite, sweep every generated `onclick` name. |
| One reply path's block content | the other reply path | Solo and multi must stay **symmetric in content** — fix producers in both. |
| `ENGINE_PAYLOAD_DEFS` entries | boot | The array property must be `blocks` — a different name crashed boot in v19.81. `promptKey` strings must match `PROMPT_REGISTRY` exactly. |
| Engine part order | JSON parsing | Engine payload assembly is code-defined *because* outputs feed parsers — reordering needs a per-engine refactor, don't expose it. |

## Prompts & models

| Change | Effect elsewhere |
|---|---|
| Editing an engine prompt's output contract (JSON fields/enums) | The code-side parser breaks silently (engines fail soft = feature goes quiet, no error). The quest-gate enum, router schemas, judge fields are all code-read. The per-universe prompt tuner validates exactly this (`_tunedPromptIsSafe`) — hand edits get no such check. |
| Reading a prompt via `state.key` instead of `up(key)` | Per-universe overrides and the tuner stop applying to that engine. |
| Setting a background engine to `rp:true` or enabling reasoning | Sampling penalties / leaked thinking derail its JSON. Engines run provider defaults **by design**. |
| Raising `memMinImp` above ~0.5 | The **intent engine starves** (it reads day memories at ≥0.55 importance to form grudges) — the living universe goes passive. UI warns; keep well below 0.55. |
| `provDeny` slugs not matching OpenRouter's provider names | Deny-list is silently ignored — check a Debug response's `provider` field for exact slugs. |
| Turning reasoning on globally with low `tokens` | Empty replies (budget burned on hidden thinking). The empty-rescue retries once at ≥1600, but engines with tight `fnTok` caps still suffer. |

## Persistence

| Change | Effect |
|---|---|
| Mutating a message/chat in place without `markChatDirty(chat)` | The signature cache (`_chatSig`) sees no change — **the edit never persists** and vanishes on reload. |
| Storing durable data in `_`-prefixed props | Stripped by `_slimChat` on every persist — data loss by design. Conversely, storing busy-flags in normal props dead-locks after a mid-flight reload. |
| Renaming any `sm_*` key / IDB kv key | Users' data orphans silently (defaults kick in; old value ignored forever). Additive migration only. |
| Removing a Settings input without removing its `saveSettings` read | `getElementById` → null → **saveSettings throws → nothing saves for anyone**. |
| Writing big blobs to localStorage | ~5 MB ceiling; collections/media belong in IndexedDB (`mediaDB`). |
| Skipping `flushPersistChats` semantics (e.g. new exit paths) | Mobile backgrounding loses the last debounced write — bind to `pagehide`/`visibilitychange`. |

## Chat, presence & history

| Change | Effect |
|---|---|
| Touching `message.present[]` | Breaks three systems at once: witness-scoped history (`castHistory`), memory building (`witnessedBy`), bystander gists. Texts rely on `present:[]` to stay out of all of them. |
| Renaming a character mid-campaign | Memories (`people[]`), legacy witness lists, relationship prose, presence-note parsing all match by name. Prefer never; `/remove` + new card is cleaner. |
| Hard-deleting a persona | Dangles `ownerId` memories, residents lists, relationship pairs, intents. Use `/remove` (soft, keeps history) — it exists precisely for this. |
| Deleting/editing old messages | Can shift open memory-arc boundaries (`memEvent.startIdx`/`memDoneIdx` are message indexes; clamped, but bulk surgery mid-arc still skews the next commit). |
| Adding a reply path | Must replicate: witness-scoped history, refusal fallback, empty-reply handling, `enqueuePresent` ordering, `markChatDirty` — copy `playCharacterTurn`, don't improvise. |
| New "system-ish" bubble types | Every engine filters on the flag set (`sysError`, `narratorEvent`, `dayMarker`, `presenceNote`, `textMsg`, `travelBeat`). A new flag must be added to those filters or it leaks into payloads/memories. |
| `travelBeat` semantics | It is **the scene boundary** for history and memory arcs — anything that moves the player must push one. |

## Living universe & End Day

| Change | Effect |
|---|---|
| Reordering `endDayBackground` | The pipeline is dependency-ordered: memory flush FIRST (everything reads today's memories), chronicler LAST (reads everything). Diaries⇄relationships are the only intentionally-parallel pair. |
| Passing `uid` (string) where `uniObj` is expected (or vice versa) | The pass silently no-ops (`uni.gameData` undefined) — this killed the whole char-quest pipeline in v24.4. `endDayBackground` resolves both shapes; keep doing that. |
| Snapshotting the day *after* pushing the dayMarker | Diaries + slow-axis relationships read "today's messages" via the last marker → they'd see an empty day. `endDay` snapshots **before** advancing; preserve that. |
| Letting two scene-owners fire in one turn | `postTurn`'s early `return`s exist so Scene Writer / armed plans / quest approaches / due meetings and the Gamemaster can't stack. New turn-consuming features must join that ladder. |
| Location `gossipChance` on homes | Anything >0 leaks home scenes to residents as rumors. Homes should stay 0 (UI says so; nothing enforces it). |
| Turning World Pulse off | Due char↔char calendar plans still must run — `postTurn` explicitly falls back to `runCalendarExecutor` when `pulseOn` is false. Any new pulse-hosted job needs the same fallback or it dies with the toggle. |
| DND (`chat.dnd`) | Silences the Gamemaster AND quietly resolves the active event — but deliberately leaves memory/trackers/relationships running. A manual force overrides DND on purpose. |

## Media

| Change | Effect |
|---|---|
| New auto-image call sites | `illustrate` is guarded per message, but the *policy* is one auto-image per turn anchored to a character (GM/scene beats deliberately don't self-illustrate). |
| Global (non-per-character) continuity | Re-introduces the shipped bugs where newcomers inherited the previous speaker's pose/frame — continuity and sticky scene-type are keyed per character (`imgPromptBy`, `lastImgRuleBy`). |
| Evicting remote-URL media records | Remote URLs are the durable cheap form; only base64 is capped. Stripping `imgSrc` breaks reload-restore. |
| Video rule `model_id` | Ignored — video rules are LoRA selectors over the fixed `state.vidModel` (`videoRuleToAtlas`). |

## Release / environment

- **Bump `sw.js` `CACHE_VERSION` with every upload** or installed clients keep the old build
  offline.
- ModelsLab may CORS-block direct browser calls — errors surface via `mlCorsMsg`; works from
  the packaged app or a proxy. Don't "fix" this by proxying keys through third parties.
- **Full backups contain all of localStorage, including API keys.** Debug exports are
  scrubbed (`scrubSecrets`); backups are not — treat them as secrets.
- The mic session (`state.narrMode`) is deliberately **never persisted** — a reload must
  never auto-open the microphone. Keep any new capture feature on the same rule.
- All calls run client-side on user keys: any new provider integration must keep keys in
  `K`-mapped storage, never in code, and add friendly error mapping (`httpMsg`/`mlMsg`
  patterns).

## Boot-time self-checks (listen to them)

Console warnings that mean a coupling rule was broken:
- `[blockTpls] drift — referenced without default / default never listed` (fragment legs 1↔3)
- `[payloads] prompts not mapped to a payload — surfacing in 'Other prompts'` (registry ↔
  engine-payload mapping)
Keep these guards intact; add equivalents when you introduce new registries.
