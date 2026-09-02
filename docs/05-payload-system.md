# 05 · The Payload System

**This is the most coupling-dense part of the codebase.** The in-source "(!) COUPLING GUARDS"
comment above `REPLY_ORDER` is mandatory reading before any change; this doc expands it.

> **Restructured in v26, re-ordered in v28.7, split again in v30.3.** v30.3 broke four blocks out
> of two that had grown into walls (`privacy`, `trackers` and `promises` out of `scene_now`;
> `feelings_now` out of `feelings`) and folded three want-blocks into one maintained section inside
> `your_bio`. Read the "v30.3" section below before touching any of them.

> **Restructured in v26, re-ordered in v28.7.** Before v26 each reply path had its own block
> map and its own order array. Now **all reply payloads share ONE block map (`REPLY_BLOCKS`)
> and one default order (`REPLY_ORDER`)** — only the per-payload `order` arrays are separate
> so users can still tune each path. If you find older notes describing `solo`/`multi`/`gm`
> asymmetry or a `buildSystemPromptBlocks` producer distinct from the per-character one,
> they are obsolete.

## Concepts

A **payload** is the complete instruction package one AI call receives. Two kinds:

1. **Reply payloads** — what a roleplay model gets when a character speaks. **Five** of them,
   all sharing the same blocks and differing only in order + a few swapped fragments:

   | Key | Built at | What differs |
   |---|---|---|
   | `solo` | `sendMessage` (exactly one character present) | — |
   | `multi` | `playCharacterTurn` (once **per responding character**) | — |
   | `gm` | `playSingleReaction` (reacting to a hidden Gamemaster beat) | — |
   | `text` | `sendTextMessage` (v28.6) | FORMATTING RULES carries the **text format** (typed words only, no narration/asterisks/inner thoughts); the spoken-delivery block is never sent. Otherwise **block for block identical** to the spoken reply — same bio, ties, memories, scene, feelings, plans, guardrails and transcript window, because texting and being in the room are one continuous relationship. |
   | `heat` | `playCharacterTurn` when `chat._heatBeat` is set | FORMATTING RULES carries the **heat format** (minimal narration, extended dialogue, one message per beat); RESPONSE GUIDANCE and FINAL GUARDRAILS carry heat versions; when the speaker continues their **own** last line the two "responding to" blocks say so instead of naming a stale target. |

2. **Engine payloads** (`ENGINE_PAYLOAD_DEFS`) — every background job. Prompts editable in
   place; **part order fixed in code** (outputs feed JSON parsers).

The special `__history__` block marks where the transcript sits: blocks before it join into
the pre-dialogue system message (**head**), blocks after it into the post-dialogue message
(**tail** — closest to generation, strongest influence).

## The v26 shape (default order)

```
universal        task · world setting · formatting + story language
who you are      your_bio · relationships · scenario · others_present
who you answer   response_target · player (only when the target isn't them) · feelings
what you recall  distant_memories · recent_memories · situation
voice + gap      speaking_style · latest_arcs        ← last thing read going in (v28.7)
                 ───────── [ THE DIALOGUE ] ─────────
after            last_line · already_said · rumors · scene_now · privacy · trackers ·
                 promises · calendar · quests · private_intent · feelings_now ·
                 response_guidance · final_guardrails · spoken_delivery
```

`REPLY_ORDER` verbatim:
`task, world, format, your_bio, relationships, scenario, others_present, response_target,
player, feelings, distant_memories, recent_memories, situation, speaking_style, latest_arcs,
__history__, last_line, already_said, rumors, scene_now, privacy, trackers, promises, calendar,
quests, private_intent, feelings_now, response_guidance, final_guardrails, spoken_delivery`

v28.7's rationale (from the source): the order that plays best is *who you are and what you
remember*, then **how you speak** and the out-of-window summaries immediately before the
transcript, then the line being answered, the scene, guidance and guardrails after it. Blocks
that render empty keep their slot beside their logical neighbours rather than being dropped —
an empty block renders nothing.

## Block inventory (what data is actually in a reply payload)

| Block | Content |
|---|---|
| `task` | Core directive + the editable **Global Base Instruction**. Universal. |
| `world` | The universe's `setting` text. Universal. |
| `format` | Formatting contract (`*narration*`, `_thoughts_`, `"dialogue"`) **+ the player's story language**. Swapped for the text/heat format in those payloads. |
| `your_bio` ⚠️ | The identity sheet of the ONE character speaking: identity, backstory, personality, behavior, the **maintained** goals & ambitions list, the live `<pursuit_status>`, appearance, wardrobe, where they live. See "v30.3 — one maintained want-list" below. |
| `relationships` | Full relationship sheet; `[here now]` marks who is present. |
| `scenario` | The character's scenario, when set. |
| `others_present` | Who else is within earshot + the "only these people exist" footer. |
| `response_target` ⚠️ | **The person this turn is aimed at** — player *or* another character — with their backstory and appearance. |
| `player` | Who the human player is — rendered **only when the response target is someone else**, so the player never drops out of the payload. |
| `feelings` | The **settled** view of the target — the filtered opinion that governs behaviour — or the `stranger` notice on a first encounter. The live charge moved out in v30.3. |
| `distant_memories` | Long-term condensed recollections, numbered. **Diaries are never injected** (changed from earlier builds). |
| `recent_memories` | Fresh experiential memories, numbered — what came before the transcript. |
| `latest_arcs` | The newest few memory arcs for this character, injected **every turn regardless of what semantic retrieval matched** — closes the gap between the transcript window and retrieved memories. |
| `situation` | Only when this character is arriving/leaving this turn. |
| `speaking_style` ⚠️ | The character's voice, delivered where the line actually gets written (just before the transcript). |
| `__history__` | The witness-scoped, compacted transcript (doc 04). |
| `last_line` ⚠️ | The last real **dialogue** line — not a day marker, presence note, travel beat or narration — pulled out and highlighted. |
| `already_said` ⚠️ | This character's own last one or two lines quoted verbatim, with the rule that this turn may not repeat or rephrase them, plus a stronger directive when the exchange has visibly stalled on the same request. |
| `rumors` 🗣️ | Live rumors from the **gossip ledger**, split by standing: the one rumor this character has a **stake** in (may be put to the player **once**, then they must live with the answer), and separately talk they merely overheard and may **not** raise at all. |
| `scene_now` | How to read the situation, then current day · location (and whose ground it is) · the sub-areas of this place and which one you stand in · what changed since you last spoke. Sub-area **names only** since v30.3 — their privacy labels moved to `privacy`. |
| `privacy` 🆕 | Everything about who can hear this: alone with someone / in front of an audience / apart from everyone, who is elsewhere in the building, how exposed the place is, and the one sub-area worth moving to if something must not carry. |
| `trackers` 🆕 | The character's own trackers, the story-wide ones, and anything of theirs that has crossed a public threshold. Split back out of `scene_now` (it had been folded in since v26). |
| `promises` 🆕 | Open-ended commitments with no date: what this character swore and is bound by, what was sworn to them, and anything broken/kept/released in the last couple of days. From the promises ledger (doc 08). |
| `calendar` | Plans due now/soon for this character, under their own `# MEETINGS` heading (`calendar_header`). `calendarContextLine(..., {bare:true})` returns the entries without the inline lead-in the directors still use. |
| `quests` | Active quests this character is named in. |
| `private_intent` | One-turn coloring from a live scheme/warmth toward someone **present**. |
| `feelings_now` ⚠️🆕 | The **live** emotional charge carried into THIS reply, written as a state the character is in (`relMomentaryNarrative`) rather than a list of axis labels, plus the fast read's playable note. True for one turn, so it sits last — immediately above the guidance. |
| `response_guidance` | Who you are, who you're replying to, what the turn has to do. |
| `final_guardrails` | Voice-only-yourself, single turn, pacing, consistency, **no-fabricated-past** rules (`rail_nofabricate`, `rail_unknown_past`), no-echo/no-repeat, plus text/heat length rails. |
| `spoken_delivery` | xAI TTS delivery-tag coaching while voicing; otherwise the `voice_format_reset` while stale markup lingers. |

## v30.3 — one maintained want-list, and the two blocks that were walls

**`your_bio` used to carry three want-blocks that only ever grew.** `<your_quests>` re-stated every
pursuit and its progress log on every turn, `<goals_ambitions>` was frozen at character creation,
and `<what_you_quietly_want>` carried the live intent aim. Nothing removed anything.

Now: **one `<goals_and_ambitions>`**, rewritten at day's end by the goals curator (doc 08), plus a
compact **`<pursuit_status>`** holding only the code-tracked half of a live pursuit (have you asked
yet, is it still hanging, what moved last) — that part is fact, not opinion, and it is what stops a
character asking the same thing four times.

- Source: `persona.goalsLive = {lines[], day, at, changed}`; `liveGoalsLines/liveGoalsText` read it.
- **`persona.goals` is never written to.** It is the foundation the curator is handed and told not to
  contradict. No `goalsLive` (curator off, never run, reset by the author) ⇒ the old three-block
  shape renders exactly as before, `<what_you_quietly_want>` included, and `<pursuit_status>` carries
  the full pursuit description instead of just its state.
- Everything is **self only** — nobody else's view of this character carries it.
- Engines read `engineGoals(p, cap)`, not `persona.goals`: maintained list when there is one, else
  the authored field. Consumers: `castGoalsSheet`, the GM's offstage roster, `_pulseSheet`,
  `goalPursuit`, `charQuestGen`, `intentForm`.

**`scene_now` was one block containing five subjects.** A real capsule showed a single wall labelled
"YOU ARE AT Emre's HOME" holding the room, five sub-areas each with its own privacy clause, who was
present, a pregnancy tracker and tonight's meeting. It is four blocks now (`scene_now`, `privacy`,
`trackers`, `promises`), each with its own `#` heading — which is also what makes them show as
separate capsules in the debug inspector, and separately movable in the payload editor.

**`feelings` was one block read in the wrong place.** The settled view of a person belongs with their
card, before the transcript; the live charge is how *this* turn comes out and decays within a few
exchanges, and it was being read thousands of tokens before the line got written. `feelingsBlock`
returns `{text, nowText, knowsTarget}` — `text` to the head, `nowText` to the tail.
`relMomentaryNarrative` replaces the semicolon-joined axis labels ("strongly intense attraction;
overwhelmingly fear/tension; overwhelmingly terror") with a written state, and suppresses the
comfort/fear pair that used to name the same nerve twice. The fast read's `stNote` is the most
directly playable line in the payload, so its call got room to finish its sentences (120 → 320
tokens out, 300 → 560 chars stored).

**`already_said`** still quotes two lines: the last one verbatim (that is the one that must not be
repeated) and the one before it trimmed on a word boundary — the older line is there to show a
shape, not to be re-read.

## Producers & assembly

One content producer per half — **do not reintroduce a per-path producer** (guard #2):

- `buildCharPromptBlocks(p, others, injectedMemories, addressed, opts)` — head blocks.
- `buildSystemPromptBlocks(injected, opts)` — a thin **wrapper** used by the solo and gm call
  sites: it picks the single present character and delegates to `buildCharPromptBlocks`. The
  old "one model voices the whole cast with `Name:` prefixes" branch is **gone** (the turn
  router made it unreachable).
- `buildTailBlocks({chat, selfId, selfName, targetName, targetId, …})` — tail blocks.

`buildPayload(layoutKey, headBlocks, tailBlocks)` walks `payloadOrder(key)`, splits at
`__history__`, joins with blank lines, skips empty blocks, returns `{head, tail}` — either may
be `""`, and **every call site must skip an empty system message**. The four call sites:
`solo` (sendMessage), `text` (sendTextMessage), `chat._heatBeat?"heat":"multi"`
(playCharacterTurn), `gm` (playSingleReaction).

**(!) Every call site must pass the response target through BOTH halves** — `{chat,
targetName, targetId}` to the head builder and the same to `buildTailBlocks` — or the
`response_target`/`player`/`feelings` blocks disagree with the guidance.

## Editable fixed text: block template fragments

Every fixed sentence lives in `BLOCK_TPL_DEFAULTS` as a **fragment**, consumed by producers
via `fillTpl(blkTpl("key"), {vars})`, overridable in `state.blockTpls` (blank ⇒ default), and
listed per block in `_attachBlockTpls`'s `T` map so the Settings editor exposes it.

**(!) The fragment 3-leg rule** — healthy only when all three exist: (1) a default, (2) a
producer calling `blkTpl()`, (3) a listing in `T`. The boot drift guard checks (1)↔(3) only —
it **cannot** detect a producer that stopped calling `blkTpl`. Inline fixed text in a producer
makes the Settings editor silently diverge from what is actually sent.

**(!) Unfilled `{{placeholders}}` render literally** into the model input. Changing a
producer's variable map means updating the fragment default; users' customized fragments are
never auto-upgraded.

## The 3-place rule for adding/removing a reply block

(Guard #1 — simpler than pre-v26, which needed four.)
1. Produce it in `buildCharPromptBlocks` or `buildTailBlocks` under the block id.
2. Add the id to **`REPLY_ORDER`** (one array — all five payloads derive from it).
3. Add the `REPLY_BLOCKS{}` entry (label/kind/desc, optional `scope`).
4. If it wraps fixed text, wire the fragment 3-leg.

Self-healing: `payloadOrder()` drops ids it no longer knows and re-inserts unknown-to-the-save
blocks at their default position — **no migration needed**. But **never rename a block id**:
saved layouts reference ids by string. `state.payloadRemoved[key]` holds blocks the user
✕-removed (kept explicit so self-heal doesn't resurrect them; "＋ Placeholder" un-removes).

## Engine payloads & the prompt registry

`PROMPT_REGISTRY` is the single source of truth for every editable engine prompt
(`{key, label, def, json, hint}` — the hint documents placeholders and the return shape).
`up(key, uid?)` is the **only** read path: per-universe override → global `state[key]` →
hard-coded `DEFAULT_*`.

Engine payload cards (`ENGINE_PAYLOAD_DEFS`), current set:
`familiarity`, `turn_router`, `player_narrator`, `presence`, `memory_builder`,
`memory_retrieval`, `tracker_gen`, `latent_npcs`, `world_pulse`, `memory_condenser`,
`relationships`, `trackers`, `gossip`, `goals`, `promises`, `intent`, `judges`, `scene_events`,
`gamemaster_engine`, `diaries`, `calendar`, `calendar_reconcile`, `travel`, `char_move`,
`text_reply`, `text_proactive`, `voice_check`, `image_writer`, `video_writer`,
`char_generator`, `world_authoring`, `universe_memory`.

Each card lists its prompt blocks plus `{kind:"dyn"}` descriptions of the live data the job
assembles — those dyn descriptions are the documentation of each engine's user message.
`_enginePayloadCoverage()` surfaces any unmapped registry prompt under "Other prompts" with a
console warning. ⚠️ The array property **must** be named `blocks` (a wrong name crashed boot
in v19.81), and `promptKey` strings must match registry keys exactly.

## Placeholders

Placeholders are **not universal** — each token is filled only by the engine that sends that
prompt; a token pasted into a prompt whose engine doesn't fill it reaches the model as literal
`{{text}}`. Each box's picker (`promptPlaceholders`/`phMenuForPrompt`) offers only that
prompt's supported tokens; an empty picker means no substitutions at all. `{{user}}` is the
most widely supported, and player-authored story text is always name-substituted (`subUser`).

## Working language: story vs. engine (v30.3)

Three directives, and every LLM call picks exactly one. A call with none inherits whatever its prompt
happens to hardcode — which is how a payload ended up half English and half Turkish.

| Directive | For | Examples |
|---|---|---|
| `langDirective()` | text the **player reads as story** | replies, travel and day-transition narration, the character-move beat, the auto-RP player turn, texts, diaries, the scene recap |
| `engineLangDirective()` | the engine's **own record**, always English | memories and gists, the condenser, relationship evaluation and social facts, gossip and location leaks, intents and contemplation, goal pursuit, the meetings detector and reconciler, quest design/step/reconcile, the chronicle and state zero, the GM's hidden nudge, scene setup, the goals curator, the promises engine |
| `mixedLangDirective([fields])` | engines answering with **both** | world-pulse event, calendar executor, character-quest step, Scene Writer (`headline`/`event`/`narration` in the story language, memories/notes/results in English), quest continuation (`epilogue` only) |

The rule in one line: **only the dialogue and the prose the player reads in the story is written in
the story language; everything else is English.** Records are read by a dozen other engines and end
up quoted verbatim inside a reply payload, so they stay in one language.
Code-written player-facing strings (a world-event fallback headline, the arc-complete bubble) go
through `sLine({en,tr,de})`.

## Genre packs & language

`_gpTail(section, chat)` appends the universe's genre-pack section (voice/drama/stakes/
relInterpretation/diaryVoice/pacing) to genre-sensitive engines. `langDirective()` (story
language) rides in the `format` block for replies and is appended to every other
content-producing payload — never to pure-JSON parsers whose enums must stay stable.
