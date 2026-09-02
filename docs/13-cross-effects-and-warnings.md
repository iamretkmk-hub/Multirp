# 13 · Cross-Effects & Warnings

The coupling matrix: what changing X quietly does to Y. Most entries trace to a real shipped
bug (version noted) or an explicit `(!)` guard comment in the source. **Check this list
before any non-trivial change.**

## Payload system (highest density of coupling)

| If you change… | …it affects | Warning |
|---|---|---|
| A reply-payload block (add/remove) | **all five** reply payloads (solo · multi · gm · text · heat) | **Three places**: producer, `REPLY_ORDER`, `REPLY_BLOCKS{}` (+ fragment 3-leg if it wraps fixed text). Since v26 there is ONE shared block map and one default order, so the old per-payload asymmetry (which hid trackers/calendar from `gm` in v19.2) can no longer happen — don't reintroduce separate block maps. |
| A block id (rename) | users' saved layouts | Layouts reference ids by string — a rename silently loses the user's placement (block re-inserts at default). **Never rename.** |
| Adding a `buildPayload` call site | that payload's correctness | Must skip empty `head`/`tail`, gate on the right layout key, **and pass the response target through BOTH halves** (`{chat,targetName,targetId}` to the head builder *and* `buildTailBlocks`) or `response_target`/`player`/`feelings` disagree with the guidance. |
| Fixed prose inside a producer | Settings → Payloads editor | Route it through `blkTpl()` or the editor silently diverges from what's actually sent (3-leg, leg 2 is unguarded). |
| A producer's `fillTpl` variable map | users' customized fragments | Unknown `{{tokens}}` render **literally** into the model input; customized fragments are never auto-upgraded. |
| The payload settings UI | prompt saving / reordering | v19.1's rewrite dropped four handlers (`plqInput`/`plqReset`/`movePayloadBlock`/`resetPayloadOrder`) — call sites live in HTML strings, so `node --check` passes. After any UI rewrite, sweep every generated `onclick` name. |
| Reintroducing a per-path content producer | every reply path | Guard #2: every reply is one character speaking for themselves. `buildSystemPromptBlocks` is only a thin wrapper that delegates to `buildCharPromptBlocks`; the whole-cast `Name:` branch was deleted as unreachable. |
| `ENGINE_PAYLOAD_DEFS` entries | boot | The array property must be `blocks` — a different name crashed boot in v19.81. `promptKey` strings must match `PROMPT_REGISTRY` exactly. |
| Engine part order | JSON parsing | Engine payload assembly is code-defined *because* outputs feed parsers — reordering needs a per-engine refactor, don't expose it. |
| Adding an LLM call with **no language directive** (v30.3) | the payload's language | It inherits whatever the prompt hardcodes, and its output ends up quoted verbatim inside a reply payload. Pick exactly one: `langDirective()` (the player reads it as story), `engineLangDirective()` (English — it is a record), `mixedLangDirective([fields])` (both in one answer; name the player-facing fields). This is the bug that made the ties block half English and half Turkish. |
| Writing to `persona.goals` from an engine (v30.3) | the goals curator | `goals` is the untouchable FOUNDATION the curator is handed and told not to contradict; the maintained list lives in `persona.goalsLive`. Writing to `goals` also silently clears `goalsLive` on the next character save. Engines READ via `engineGoals()`. |
| Adding a consumer of the promise ledger, or forgetting one (v30.3) | characters contradicting their own word | A commitment is injected in four places that must stay in step — the speaking character's payload, `directorContext` (GM + Scene Writer), the offstage engines via `promiseContextForNames`, and the goals curator. A fifth is fine; a missing one means the world writes straight through a standing promise. |
| Adding a block that reads the "this character spoke last" state (v30.4) | the other four | `response_target`, `last_line`, `already_said` and `response_guidance` all branch on `selfContinueLine()`. They must agree: a fifth that says "answer them" while the others say "carry on" wins, because the guidance sits closest to generation — that was the bug. |
| Adding a rail to `final_guardrails` (v30.4) | every turn's tail | Rails are no longer a flat list: `rail_oblique_once` and `rail_noecho` are gated on whether their situation is actually happening, and `rail_single_solo` is off by default because RESPONSE GUIDANCE says it one block earlier. A rail that describes a situation ("if they refuse again…", "don't quote them back…") should be gated the same way — an always-on prohibition against something that is not happening dilutes the ones that are. |
| Editing `DEFAULT_BASE_INSTRUCTION` (v30.4) | only fresh installs | A user who has ever touched the Global Base Instruction has `state.baseInstruction` and keeps their own copy forever — `up()` reads it first. Rewriting the default does NOT reach them; say so rather than assuming the payload shrank for everyone. |
| Adding a field to `charBioBlock` (v30.5) | the speaker's sheet AND every bystander sheet | One producer writes both. Any fixed sentence you add needs a `_self` and an `_other` form (see `bio_behave_*` / `bio_wardrobe_*`) — a single wording is wrong for one of the two readers, and third person inside the speaker's own sheet nudges the model toward writing about the character instead of as them. It also has to be a `blkTpl()` fragment: inline prose there is invisible to Settings → Payloads. |
| Adding a reply block that describes a ROOM (v30.5) | the `text` payload | Texting shares the spoken payload block for block, so a block about location, earshot or who is present is wrong there — the character is on their phone somewhere else. `buildTailBlocks` exposes `_textMode`; `scene_now` and `privacy` both branch on it. Blocks about the PERSON (trackers, promises, calendar, feelings) correctly ride along unchanged. |
| A fragment that introduces the response target (v30.5) | multi-character scenes | Use `{{target}}`, never `{{user}}`. The target is only the player some of the time; `cont_target_self` and `heat_target_self` hardcoded `{{user}}` and so named the player while printing another character's card underneath. |
| Restating a rule "for emphasis" in a second block | the model's behaviour, and your token bill | `_dedupePayloadSections` only strips **verbatim** repeats of a whole `# HEADING` section, so a paraphrase survives and lands twice. Each rule has ONE owner: earshot → `privacy`; the no-fabricated-past contract → the rails; story language → `langDirective()` (which `_stripLangSection` enforces by removing rival `# LANGUAGE` sections from the format rules at build time). |
| Folding `privacy` / `trackers` / `promises` back into `scene_now` (v30.3) | the debug inspector and the payload editor | They were split out because one block holding five subjects renders as one wall in the capsule view and cannot be reordered or removed independently. Each carries its own `#` heading; that heading is what makes it a capsule. |

## Prompts & models

| Change | Effect elsewhere |
|---|---|
| Editing an engine prompt's output contract (JSON fields/enums) | The code-side parser breaks silently (engines fail soft = feature goes quiet, no error). The quest-gate enum, router schemas, judge fields are all code-read. The per-universe prompt tuner validates exactly this (`_tunedPromptIsSafe`) — hand edits get no such check. |
| Reading a prompt via `state.key` instead of `up(key)` | Per-universe overrides and the tuner stop applying to that engine. |
| Calling `up("key")` bare when the prompt has `{{tokens}}` (v30.5) | The tokens reach the model as the literal characters `{{user}}`. This is how the meetings detector ran for months. Sweep: for each registry prompt, compare its `{{tokens}}` against the keys its `fillTpl` call passes — remembering ES6 shorthand, explicit `.replace()`, and that `trackerGen`'s `{{name}}` is a RUNTIME template filled by `trackerPublicText`, not a build-time token. |
| Refactoring an engine from batch to per-item (or back) without rewriting its prompt (v30.6) | silent no-ops | The tracker engine went single-item and its prompt kept asking for an array. `typeof [] === "object"`, so the guard passed and every field read back `undefined` — no error, the tracker just stopped moving. When you change an engine's call shape, rewrite the prompt's OUTPUT FORMAT in the same commit, and make the parser tolerant of the old shape for anyone who has it saved in state. |
| Asking a prompt for a delta on a value you don't show it (v30.6) | slow drift you cannot see | `DEFAULT_REL` asks for nine deltas; the call site listed five. The other four accumulated from guesses and fed `_fastBaseline`. If a prompt says "given the current values", give it all of them. |
| Retiring an engine but leaving its prompt in `PROMPT_REGISTRY` (v30.5) | The prompt stays editable in Settings and does nothing, which is worse than not offering it. Sweep: every registry key must have a matching `up("key")` somewhere. `ranker` and `textReplyPrompt` were dead this way. |
| Changing what language an engine WRITES (v30.3 → v30.5) | Anything that later matches against that text. Memories moved to English and `genQuery` kept telling the model to write the search query in the story language, so the lexical retrieval facet stopped overlapping on anything but proper nouns. When you change an engine's output language, grep for what reads it back. |
| Setting a background engine to `rp:true` or enabling reasoning | Sampling penalties / leaked thinking derail its JSON. Engines run provider defaults **by design**. |
| Raising `memMinImp` above ~0.5 | The **intent engine starves** (it reads day memories at ≥0.55 importance to form grudges) — the living universe goes passive. UI warns; keep well below 0.55. |
| `provDeny` slugs not matching OpenRouter's provider names | Deny-list is silently ignored — check a Debug response's `provider` field for exact slugs. |
| Turning reasoning on globally with low `tokens` | Empty replies (budget burned on hidden thinking). The rescue retries once at ≥1600 with thinking forced off, but engines with tight `fnTok` caps still suffer. |
| Treating `message.reasoning` as answer text | Renders the model's thinking as a character's line **and** hides the failure: a non-empty return makes `chatCompletion` think the call succeeded, so the recovery retry never runs. Only `finalAnswerFrom()`-delimited answers may be salvaged from that field (fixed v29.1). |

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
| Reordering `endDayBackground` | The pipeline is dependency-ordered: memory flush FIRST (everything reads today's memories), chronicler LAST (reads everything). Diaries⇄relationships are the only intentionally-parallel pair. The goals curator (v30.3) sits after the quest passes and the intent engine — the two things most likely to have changed what a character wants — and before the chronicler. |
| Removing the cap in `runGoalsCurator` / `runPromiseEngine` (v30.3) | cost per day / per turn | The curator is deliberately bounded to six characters a day and skips anyone the day did not move (`_goalsMoveScore`); the promise engine runs every second turn. Both are one model call each; lifting the caps turns End Day into a queue. |
| Passing `uid` (string) where `uniObj` is expected (or vice versa) | The pass silently no-ops (`uni.gameData` undefined) — this killed the whole char-quest pipeline in v24.4. `endDayBackground` resolves both shapes; keep doing that. |
| Snapshotting the day *after* pushing the dayMarker | Diaries + slow-axis relationships read "today's messages" via the last marker → they'd see an empty day. `endDay` snapshots **before** advancing; preserve that. |
| Letting two scene-owners fire in one turn | `postTurn`'s early `return`s exist so Scene Writer / armed plans / quest approaches / due meetings and the Gamemaster can't stack. New turn-consuming features must join that ladder. |
| Location `gossipChance` on homes | Anything >0 leaks home scenes to residents as rumors. Homes should stay 0 (UI says so; nothing enforces it). |
| Turning World Pulse off | Due char↔char calendar plans still must run — `postTurn` explicitly falls back to `runCalendarExecutor` when `pulseOn` is false. Any new pulse-hosted job needs the same fallback or it dies with the toggle. |
| DND (`chat.dnd`) | Silences the Gamemaster AND quietly resolves the active event — but deliberately leaves memory/trackers/relationships running. A manual force overrides DND on purpose. |

| Adding a pass that trims the transcript (v30.5) | the character's physical continuity | Order matters: `narrPrivacy` runs FIRST and has already removed every other character's narration, so anything trimming "narration" afterwards is only ever cutting the speaking character's own and the player's. `compactHistory` exempts the character's own lines for exactly this reason — a model that cannot see it already gripped the counter grips it again. |
| Using `spokenOnly()` for "what a character perceived" | co-present characters | It strips actions AND thoughts, so the other person appears never to move and a wordless turn disappears. `perceivedOnly()` is the one you want: thoughts hidden, visible action kept. `spokenOnly` remains for anywhere a genuinely dialogue-only view is wanted. |

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
