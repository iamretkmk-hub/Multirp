# 05 · The Payload System

**This is the most coupling-dense part of the codebase.** The in-source "(!) COUPLING GUARDS"
comment above `PAYLOAD_DEFS` is mandatory reading before any change; this doc expands it.

## Concepts

A **payload** is the complete instruction package one AI call receives. The app has two kinds:

1. **Reply payloads** — what a roleplay model gets when a character speaks. Three of them:
   - `solo` — one model voices the scene (single character present; also whole-scene solo mode),
   - `multi` — built **once per character** in a multi-character chain,
   - `gm` — a character reacting to a hidden Gamemaster beat.
   These are **ordered block lists** the user can reorder/remove/re-add in
   Settings → Payloads. The special `__history__` block marks where the chat transcript sits:
   blocks before it join into the pre-dialogue system message (**head**), blocks after it into
   the post-dialogue system message (**tail** — closest to generation, strongest influence).
2. **Engine payloads** (`ENGINE_PAYLOAD_DEFS`) — every background job (routers, memory
   builder/retrieval, tracker engine, gossip, intents, judges, scene writer, gamemaster,
   diaries, calendar, travel, texts, voice check, image/video writers, character/world
   generators, universe memory). Their prompts are editable in place, but their **part order
   is fixed in code** — outputs feed JSON parsers.

## Reply payload block inventory

Block **content** is produced by three producers; block **order** comes from
`state.payloadLayouts[key]` via `payloadOrder(key)`:

- `buildSystemPromptBlocks(injected)` — head blocks for `solo`/`gm`
- `buildCharPromptBlocks(p, others, injected, addressed)` — head blocks for `multi`
- `buildTailBlocks({chat, selfId, selfName, targetName, targetId, multi, injected})` — tail
  blocks shared by all three paths

Default `solo`/`gm` order:
`task → world → format → genre_voice → characters → player → ooc → distant_memories →
multi_format → __history__ → scene_now → trackers → calendar → quests → private_intent →
recent_memories → response_guidance → feelings → final_guardrails → spoken_delivery`

`multi` replaces `characters`/`multi_format` with per-character blocks:
`your_bio → relationships → scenario → others_present` (+ `situation` when arriving/leaving).

What each block carries (the "what data is in the payload" answer for replies):

| Block | Content |
|---|---|
| `task` | Core directive + the editable **Global Base Instruction** (universal roleplay principles) |
| `world` | The universe's `setting` text |
| `format` | **Response Format Rules** (`*narration*`, `_thoughts_`, `"dialogue"` contract); narration-mode shape appended when the mic session is live |
| `genre_voice` | Genre-pack `voice` section (per-universe tone) |
| `characters` / `your_bio` | Character card(s): instructions, personality, backstory, five-axis traits, goals, style, appearance (via `charBioBlock`) |
| `relationships` | Factual tie sheet (`relGen` + hand-written `socialGraph`; `[here now]` marks presence) |
| `scenario` | The character's scenario when set |
| `others_present` | Who else is within earshot + the "only these people exist right now" footer |
| `player` | Player identity: name, background, appearance (per-universe overrides) |
| `ooc` | The OOC command contract |
| `distant_memories` | Diary-tier + long-term/consolidated memories (headers `mem_distant_header` / `mem_longterm_header`) |
| `multi_format` | Name-prefix format for solo-mode multi-presence scenes |
| `__history__` | The witness-scoped, compacted transcript (doc 04) |
| `scene_now` | Day/time, **authoritative location**, home/host dynamics, sub-areas & privacy, who is present/alone/apart, plus the "⚠️ WHAT JUST CHANGED" transition call-outs (moved, day jump, arrivals, departures) |
| `trackers` | Visible/shared tracker lines `[ … ]` incl. breaking-point stage texts |
| `calendar` | Plans due now/soon for this character |
| `quests` | Active quests this character is named in |
| `private_intent` | One-turn coloring from a live intent (warm/hostile; aim-aware when the target is absent) |
| `recent_memories` | Fresh experiential memories (header `mem_recent_header`) |
| `response_guidance` | "You are X, replying to Y's last line" |
| `feelings` | Considered (slow axes) + right-now (fast axes) relationship prose, impulse-vs-settled tension lines, or the `stranger` block on a first encounter |
| `final_guardrails` | Voice-only-yourself, single turn, dialogue-first, no reflexive questions, consistency; `heat_advance` is prepended during a heat continuation |
| `spoken_delivery` | While voicing with the xAI engine: TTS delivery-tag coaching; otherwise, just after a voice session: the `voice_format_reset` |

`buildPayload(layoutKey, headBlocks, tailBlocks)` walks the order, splits at `__history__`,
joins with blank lines, skips empty blocks, returns `{head, tail}` — either may be `""` and
call sites must skip empty system messages.

## Editable fixed text: block template fragments

Every fixed sentence in the three reply payloads lives in `BLOCK_TPL_DEFAULTS` as a
**fragment** (e.g. `scene_present`, `feel_header`, `rail_question`, `spoken_delivery`).
Producers consume them via `fillTpl(blkTpl("key"), {vars})`; user overrides live in
`state.blockTpls` (blank override ⇒ default). The Settings editor lists each fragment under
its block ("Fixed text").

**(!) The fragment 3-leg rule** — a fragment is healthy only when all three exist:
1. a default in `BLOCK_TPL_DEFAULTS`,
2. a producer consuming it via `blkTpl()`,
3. a listing in `_attachBlockTpls`'s `T` map (making it editable).
The boot-time drift guard checks (1)↔(3) only; it **cannot** detect a producer that stopped
calling `blkTpl` — if you inline fixed text in a producer, the Settings editor silently
diverges from reality.

**(!) Placeholders render literally when unfilled.** `fillTpl` only substitutes keys the
producer provides. Changing a producer's variable map means updating the fragment default and
accepting that users' customized fragments are kept as-is across upgrades (there is no
migration pipe for fragments).

## The four-place rule for adding/removing a reply block

Adding or removing a block touches **four places** (guard #1):
1. Produce the content in `buildSystemPromptBlocks` **and/or** `buildCharPromptBlocks` and/or
   `buildTailBlocks` under the block id.
2. Add the id to the `order` array of **every** payload that should carry it — `solo`, `multi`,
   **and `gm`**. ⚠️ `gm` *shares* solo's `blocks` map but has its **own** `order` array — this
   exact asymmetry shipped a bug in v19.2 (trackers/calendar missing from gm.order).
3. Add the `blocks{}` metadata entry (label/kind/desc).
4. If it wraps fixed text, wire the fragment 3-leg above.

Self-healing: `payloadOrder()` re-inserts blocks a saved user layout doesn't know at their
default position — **adding a block needs no migration**. But **never rename a block id**:
saved layouts reference ids by string; a rename loses the user's placement.
`state.payloadRemoved[key]` lists blocks the user ✕-removed (kept explicit so self-heal
doesn't resurrect them; "＋ Placeholder" un-removes).

## Engine payloads & the prompt registry

`PROMPT_REGISTRY` is the **single source of truth** for every editable engine prompt: key,
label, default (`DEFAULT_*` constant), `json` flag, and a hint documenting its placeholders
and output contract. ~60 prompts: memory (memEval/memBuild/gistBuild/queryGen/ranker/
condensePrompt), living universe (gossipPrompt/poiGossip/intentForm/intentTick/contemplate/
offstageEvent/calExec/goalPursuit/charQuest*), directors (gmJudge/gmAuthor/sceneSetup/
sceneWriter/confrontJudge/overtureJudge/presencePrompt/routerPlayer/routerChar), world
authoring (univPrompt/bioPrompt/batchBioPrompt/directorAuthor/genrePackAuthor/ruleCompiler/
questGen/questNext/originGen/chronicler/promptTuner), relationships (relPrompt/relShortPrompt/
relGenPrompt), calendar (calPrompt/attendanceEstimate/attendancePersuade/calReconcile), texts
(textReplyPrompt/textProactivePrompt/textVisitPrompt), media (rewritePrompt/vidPrompt/
extendPrompt/routerPrompt), misc (travelPrompt/charMovePrompt/trackPrompt/voiceCheckPrompt/
daySummaryPrompt/playerNarratePrompt/trackerGen/latentNpc).

**Prompt resolution — `up(key, uid?)`** (the ONLY read path):
per-universe override (`universe.prompts[key]`, set in the Universe editor or by the
per-universe prompt tuner) → global `state[key]` (Settings) → hard-coded `DEFAULT_*`.

`ENGINE_PAYLOAD_DEFS` maps registry prompts into labeled payload cards for the Settings UI,
each also listing its **dynamic blocks** (descriptions of the live data the job assembles —
these dyn descriptions are the documentation of each engine's user-message content).
Safety net: `_enginePayloadCoverage()` surfaces any unmapped registry prompt in an auto
"Other prompts" card so nothing is ever uneditable. ⚠️ Each def's array property **must** be
named `blocks` — a wrong name crashes boot (shipped v19.81).

## Placeholders (`{{token}}`)

- Placeholders are **not universal**: each token is filled only by the engine that sends that
  prompt. A token pasted into a prompt whose engine doesn't fill it goes to the model as
  literal `{{text}}`. The per-prompt picker (`promptPlaceholders`, `phMenuForPrompt`) offers
  only that prompt's supported tokens; an empty picker means no substitutions at all.
- `{{user}}` is the most widely supported; story text the player authors (universe setting,
  character cards, plan titles) is always name-substituted via `subUser`.
- The placeholder dictionary UI (`renderPlaceholderGuide`) is generated from `_phDoc`.

## Genre packs & language

- `_gpTail(section, chat)` appends the universe's genre-pack section (voice/drama/stakes/
  relInterpretation/diaryVoice/pacing) to the relevant engine calls, so every system plays the
  same genre.
- `langDirective()` (story language en/de/tr) is appended to **every content-producing**
  payload (replies, narration, memories, diaries, events, texts) — never to pure-JSON parsers
  whose enums must stay stable.

## Byte-equivalence discipline

The default layout + default fragments reproduce the pre-v19 hardcoded payload
**byte-for-byte** (Node-harness verified). Preserve that for untouched installs: change fixed
text via fragment defaults, not inline literals; after restructuring, diff an old-vs-new
payload dump (the Debug screen's export is the tool for this).
