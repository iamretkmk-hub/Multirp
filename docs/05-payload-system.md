# 05 · The Payload System

**This is the most coupling-dense part of the codebase.** The in-source "(!) COUPLING GUARDS"
comment above `REPLY_ORDER` is mandatory reading before any change; this doc expands it.

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
after            last_line · already_said · rumors · scene_now · calendar · quests ·
                 private_intent · response_guidance · final_guardrails · spoken_delivery
```

`REPLY_ORDER` verbatim:
`task, world, format, your_bio, relationships, scenario, others_present, response_target,
player, feelings, distant_memories, recent_memories, situation, speaking_style, latest_arcs,
__history__, last_line, already_said, rumors, scene_now, calendar, quests, private_intent,
response_guidance, final_guardrails, spoken_delivery`

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
| `your_bio` ⚠️ | The identity sheet of the ONE character speaking: identity, backstory, personality, behavior, quests, goals & ambitions, **what they quietly want** (a standing aim toward someone absent rides here), appearance, wardrobe, where they live. |
| `relationships` | Full relationship sheet; `[here now]` marks who is present. |
| `scenario` | The character's scenario, when set. |
| `others_present` | Who else is within earshot + the "only these people exist" footer. |
| `response_target` ⚠️ | **The person this turn is aimed at** — player *or* another character — with their backstory and appearance. |
| `player` | Who the human player is — rendered **only when the response target is someone else**, so the player never drops out of the payload. |
| `feelings` | Considered + momentary relationship prose toward the target, or the `stranger` notice on a first encounter. |
| `distant_memories` | Long-term condensed recollections, numbered. **Diaries are never injected** (changed from earlier builds). |
| `recent_memories` | Fresh experiential memories, numbered — what came before the transcript. |
| `latest_arcs` | The newest few memory arcs for this character, injected **every turn regardless of what semantic retrieval matched** — closes the gap between the transcript window and retrieved memories. |
| `situation` | Only when this character is arriving/leaving this turn. |
| `speaking_style` ⚠️ | The character's voice, delivered where the line actually gets written (just before the transcript). |
| `__history__` | The witness-scoped, compacted transcript (doc 04). |
| `last_line` ⚠️ | The last real **dialogue** line — not a day marker, presence note, travel beat or narration — pulled out and highlighted. |
| `already_said` ⚠️ | This character's own last one or two lines quoted verbatim, with the rule that this turn may not repeat or rephrase them, plus a stronger directive when the exchange has visibly stalled on the same request. |
| `rumors` 🗣️ | Live rumors from the **gossip ledger**, split by standing: the one rumor this character has a **stake** in (may be put to the player **once**, then they must live with the answer), and separately talk they merely overheard and may **not** raise at all. |
| `scene_now` | How to read the situation, then current day · location · sub-areas · privacy (who can hear you, who is one door away) · **the character's trackers** (folded in — no separate `trackers` block since v26). |
| `calendar` | Plans due now/soon for this character. |
| `quests` | Active quests this character is named in. |
| `private_intent` | One-turn coloring from a live scheme/warmth toward someone **present**. |
| `response_guidance` | Who you are, who you're replying to, what the turn has to do. |
| `final_guardrails` | Voice-only-yourself, single turn, pacing, consistency, **no-fabricated-past** rules (`rail_nofabricate`, `rail_unknown_past`), no-echo/no-repeat, plus text/heat length rails. |
| `spoken_delivery` | xAI TTS delivery-tag coaching while voicing; otherwise the `voice_format_reset` while stale markup lingers. |

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
`relationships`, `trackers`, `gossip`, `intent`, `judges`, `scene_events`,
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

## Genre packs & language

`_gpTail(section, chat)` appends the universe's genre-pack section (voice/drama/stakes/
relInterpretation/diaryVoice/pacing) to genre-sensitive engines. `langDirective()` (story
language) rides in the `format` block for replies and is appended to every other
content-producing payload — never to pure-JSON parsers whose enums must stay stable.
