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
after            watching_now · last_line · already_said · rumors · scene_now · privacy · trackers ·
                 promises · calendar · quests · private_intent · feelings_now ·
                 response_guidance · final_guardrails · spoken_delivery
```

`REPLY_ORDER` verbatim:
`task, world, format, your_bio, relationships, scenario, others_present, response_target,
player, feelings, distant_memories, recent_memories, situation, speaking_style, latest_arcs,
__history__, watching_now, last_line, already_said, rumors, scene_now, privacy, trackers, promises, calendar,
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
| `relationships` | Full relationship sheet, in three labelled groups: the author's hand-written `socialGraph` note, the facts play has since revealed (`socialFacts`, one per person, headed by `rel_learned`), then the structured ties. Ordered player → whoever is `[here now]` → the rest by name. |
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
| `watching_now` | The description attached to the video mark that just played, framed as happening in front of the character right now. Present **only** on a turn a video cue fired (doc 10). |
| `last_line` ⚠️ | The last real **dialogue** line — not a day marker, presence note, travel beat or narration — pulled out and highlighted. |
| `already_said` ⚠️ | This character's own last one or two lines quoted verbatim, with the rule that this turn may not repeat or rephrase them, plus a stronger directive when the exchange has visibly stalled on the same request. |
| `rumors` 🗣️ | Live rumors from the **gossip ledger**, split by standing: the one rumor this character has a **stake** in (may be put to the player **once**, then they must live with the answer), and separately talk they merely overheard and may **not** raise at all. |
| `scene_now` | How to read the situation, then current day · location (and whose ground it is) · the sub-areas of this place and which one you stand in · what changed since you last spoke. Sub-area **names only** since v30.3 — their privacy labels moved to `privacy`. |
| `privacy` 🆕 | Everything about who can hear this: alone with someone / in front of an audience / apart from everyone, who is elsewhere in the building, how exposed the place is, and the one sub-area worth moving to if something must not carry. |
| `trackers` 🆕 | The character's own trackers, the story-wide ones, and anything of theirs that has crossed a public threshold. Split back out of `scene_now` (it had been folded in since v26). |
| `promises` 🆕 | Open-ended commitments with no date: what this character swore and is bound by, what was sworn to them, and anything broken/kept/released in the last couple of days. From the promises ledger (doc 08). **(!)** `_prRender` names only the party the group heading does *not* already establish — the groups are split by holder and recipient, so every line used to open by restating it ("- you to Duygu — …"). The `ask` is written by the extractor in the third person and is usually the promise said backwards, so it is dropped when `_prSameThing` finds it 60%+ contained in the promise, and labelled `(why: …)` when it genuinely adds the reason. |
| `calendar` | Plans due now/soon for this character, under their own `# MEETINGS` heading (`calendar_header`). `calendarContextLine(..., {bare:true})` returns the entries without the inline lead-in the directors still use. **(!)** The reader is stripped from `who` — scoping keeps an event *because* they are named in it, so rendering it whole said "with Duygu, Emre" to Emre. And a due meeting whose counterpart is already in the room is reported as **happening**, not pending: the old line told a character to wait for someone standing in front of them. Guarded on location, so a meeting pinned elsewhere stays a plan. |
| `quests` | Active quests this character is named in. |
| `private_intent` | One-turn coloring from a live scheme/warmth toward someone **present**. `{{kind}}` is the taxonomy label and `{{aim}}` the actual want, joined so one frames the other ("a courtship, and what you actually want out of it is this: …") rather than reading as two rival labels. When the intent's target is **not** the person the turn is aimed at, `intent_side` ranks it as a side-current so it can't take the turn over. |
| `feelings_now` ⚠️🆕 | The **live** emotional charge carried into THIS reply, written as a state the character is in (`relMomentaryNarrative`) rather than a list of axis labels, plus the fast read's playable note. True for one turn, so it sits last — immediately above the guidance. |
| `response_guidance` | Who you are, who you're replying to, what the turn has to do. |
| `final_guardrails` | Voice-only-yourself, single turn, pacing, consistency, **no-fabricated-past** rules (`rail_nofabricate`, `rail_unknown_past`), no-echo/no-repeat, plus text/heat length rails. Ends on **`rail_form`** — see below. |
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

## v30.4 — the payload arguing with itself

`_dedupePayloadSections` only strips a `# HEADING` section whose heading **and body** already
appeared **verbatim**. Everything below said the same thing in different words, so nothing caught it.

**The guidance contradicted three other blocks.** When a character spoke last and nothing new was
aimed at them, `response_target`, `last_line` and `already_said` all say "carry on" — and
RESPONSE GUIDANCE went on saying *"React to the highlighted line above: that is what {{target}} just
said or did"*. It is the last instruction before generation, so it was the one that won. There is a
`guidance_continue` fragment now, picked by the same `selfContinueLine()` the other blocks use. **If
you add a fourth block that reads the continue state, it must agree with these three.**

**The same line was quoted twice under opposite headings.** In that same continue case `last_line`
carried the character's newest line verbatim under "CONTINUE STRAIGHT ON FROM IT", and `already_said`
printed the identical text ten lines later under "YOU ALREADY SAID THIS — DO NOT SAY IT AGAIN". The
window now **slides**: continuing ⇒ `last_line` owns the newest line and `already_said` shows the
ones before it (`already_said_continues` says so). Same window size, no duplicate.

**The language rule was printed twice, back to back.** `DEFAULT_FORMAT_RULES` opened with a
`# LANGUAGE` section hardcoding Turkish, then `langDirective()` appended `# STORY LANGUAGE` saying
the same three things in the same order — and flatly contradicting it whenever the story language was
not Turkish. `_stripLangSection()` removes any `# LANGUAGE` section from the format rules **at build
time**, so users with a customized `formatRules` are covered too, and the "intense moments" style
line moved into `langDirective` so it isn't lost. `langDirective()` is the single authority on story
language; nothing else may claim to set it.

**Two other statements were made twice or three times**, each time by a block further from
generation than the one that owns it:
- "these are the ONLY people present / don't refer to anyone who isn't here" — `others_footer` **and**
  `scene_present`. `privacy` owns earshot now; `others_present` just names who is standing there.
- the no-fabricated-past contract — `mem_recent_instr`, `rail_nofabricate` **and**
  `rail_unknown_past`. The rails own it (a prohibition belongs closest to generation); the memory
  block says what the memories are and stops.

Measured on a populated reference payload: 27,475 → 25,903 characters of instruction, and two
outright contradictions removed.

### Density pass (same release)

**`# TASK` was a quarter of the payload, in its weakest position.** 6,287 characters at the very
top, six of whose rules FINAL GUARDRAILS said again at the very bottom in its strongest position.
`DEFAULT_BASE_INSTRUCTION` is rewritten: 6,287 → 3,685 rendered. Nothing was thrown away except the
six duplicates (now only in the rails, where they fire hardest) and the `EMBODY YOUR CHARACTER`
section, which said "use your character profile" directly above two thousand tokens of character
profile. Both halves of the pressure rule — don't fold, don't shatter — survive; they are the most
load-bearing paragraphs in the block and nothing else states them.
**(!) Customized copies (`state.baseInstruction`) keep the old text.** This is the shipped default;
a user gets the new one by resetting the prompt in Settings.

**Situational rails now fire when they apply.** Every rail used to ship on every turn, including
ones describing a situation that was not happening — and a wall of "never" in the last slot before
generation is what produces careful, rule-reciting output.

| Rail | Fires when |
|---|---|
| `rail_oblique_once` (split out of `rail_oblique`) | the exchange has stalled on the same ask, or this character carries a pursuit they have already put to someone. Without one of those there is no loop to break out of. |
| `rail_noecho` | somebody else actually spoke last. On a turn that continues the character's own line there is nothing of the player's to echo. |
| `rail_single_solo` | never, by default — RESPONSE GUIDANCE opens with the same sentence one block earlier. Still available in the payload editor. |

**`feelings_now`** kept the charge and the note and lost the lecture around them: 1,875 → 1,251.

**Memory lines** ended `(felt: tense) (Day 4) [Emre's House]`. The day stays (the scene brief tells
the character to reason in "yesterday"/"the other day"). The bare `emotion` enum goes — it is one of
ten fixed tokens, so a run of memories from one charged week ends every line identically
(`memInjectText(m,{noEnum:true})`, reply payload only; a *written* `feelings` phrase still shows, and
every other consumer gets the full string). The location is kept **only when it differs from the
current scene**, which is when it carries information.

Reference payload across the whole pass: **27,475 → 23,585 characters (−14%)**, with both
contradictions gone.

## v30.5 — the identity sheet: person, duplication, and machinery

**`charBioBlock` builds two different documents and had one wording.** The same producer writes the
speaking character's own sheet (`opts.self`) and the bystander sheets other characters see, so
whichever person it was written in was wrong for the other. Inside a block whose first line is "You
are Emre", it said *"Their usual clothing (dress **them** plausibly from this…)"* and the situation
block said *"Emre has just entered the scene. Give a brief entrance beat — how **you** arrive"*,
switching person mid-sentence. Third person about yourself, in your own identity sheet, is a small
push toward writing ABOUT the character rather than AS them — the exact failure the block exists to
prevent. Both fixed sentences are now `bio_behave_self`/`_other` and `bio_wardrobe_self`/`_other`,
and `situation_arriving`/`_leaving` are second person throughout.

**Two of those sentences were inline prose in the producer** — the leg-2 break the
`BLOCK_TPL_DEFAULTS` header warns about. They never appeared in Settings → Payloads, so the editor
silently disagreed with what was actually sent. They are fragments now.

**`play_notes` was printed twice, verbatim** — once in `your_bio` and once in `speaking_style`.
v28.3 did that deliberately ("repeat them beside the voice, where they can actually govern the
line") and the second copy is the one that works: `speaking_style` is the last block before the
transcript, `your_bio` is thousands of tokens earlier. So it ships once, in the tail copy. It is
still emitted in the bio when `styleTail` is NOT set — the bystander sheets and the voice-call
payload have no `speaking_style` block, and nothing else would carry it for them.

**`latest_arcs` talked to the character about context windows.** A scan of all 122 fragments for
machinery language ("payload", "prompt", "the model", "token", "context window", "summary") found
exactly one offender, and it was this block: *"your latest dialogue summaries that are now out of the
context window"* — handed to a character three blocks after being told never to mention being an AI.
It now says what it actually is: the last few things that happened, just before the transcript picks
up.

**`bio_intro` re-announced the name** `task` had just given and `rail_voice` gives again. It keeps
the two things only it carries — the *only*, and never breaking character.

Also fixed: the quest-approach opener (`charBioBlock(p)` with no opts) handed the bystander wording
to the very character it was asking to speak.

### Two people, one set of tag names

`target_bg` / `target_look` used `<backstory>` and `<appearance>` — **the same tags `charBioBlock`
uses for the speaking character's own sheet a few blocks earlier**. So one payload carried
`<backstory>` twice and `<appearance>` twice, for two different people, with nothing in the markup
saying which was whose. The identity sheet spends its whole length teaching the model that those
tags mean *me*; the second pair then quietly means *her*, which is a direct invitation to answer in
someone else's history. They are `<their_backstory>` / `<their_appearance>` now, and every tag in a
rendered payload is unique again.
**(!) Any new block that emits an XML tag must not reuse one `charBioBlock` already owns** — check a
rendered payload with `grep -o "<[a-z_]*>" | sort | uniq -c` before shipping it.

### Three rules that all began "one beat"

Genuinely different rules — how much *narration*, how much *story time*, how much *emotional
resolution* — worded so alike that only their position told them apart, and two of the three were in
the weakest position while the third was in the strongest:

| Was | Where | Now |
|---|---|---|
| "At most ONE narration beat per reply" | format · LIMITS | "HOW MUCH NARRATION: at most one *narrated span* per reply" |
| "One beat per turn. React to THIS moment; don't narrate a sequence or jump ahead in time." | format · LIMITS | "HOW MUCH TIME: stay inside this moment… the reply happens now and stops" |
| "One emotional beat lands harder than five." | `rail_beat` | "Leave things unsaid. Don't resolve everything in one reply…" |

## v30.5 — the conditional blocks (the ones you only see in one state)

**The continue-target block named one person and described another.** `cont_target_self` and
`heat_target_self` introduce the card that follows them — and that card is the RESPONSE TARGET's,
which is only the player some of the time. Both fragments hardcoded `{{user}}`. In a multi-character
scene the target is resolved from the freshest real line in the transcript, so whenever this
character had been talking to somebody else the block read *"Duygu's last line is already answered…
Duygu is still here with you, and this is who they are:"* and then printed **Burcu's** backstory and
appearance. They use `{{target}}` now (both tokens are still filled, so a customized copy keeps
working), and the producer defaults `target` to the player so an id passed without a name can't
render `"'s last line is already answered"`.

**A text is not a scene.** v28.6 gave texting the spoken payload block for block, which is right for
who you are, what you remember, how you feel and what you owe — and wrong for the two blocks that
describe a *room*. The text format says in its second line *"You are not in the room with {{user}} —
you are wherever you are, on your phone"*, and the payload then shipped:

- `scene_now`: "⚠️ YOUR CURRENT LOCATION: Emre's House — specifically the Kitchen ⚠️" — the
  **player's** scene, not the texter's, plus the sub-area earshot rule;
- `privacy`: "you are NOT alone with Duygu. Others are in the room, seeing and hearing everything you
  say and do: Burcu" — which governs how freely the character speaks, and **nobody overhears a text**.

In text mode now: the location resolves to the character's **own** world position
(`resolveWorldPositions`), sub-areas are dropped, `scene_intro_text` covers time without earshot, and
`privacy` carries `privacy_text` — a text is as private as talking gets, but it is *written down*,
which is a different kind of exposure and a more interesting one.
**(!) When adding a block to the reply set, ask whether it describes a ROOM.** If it does, it needs a
`textMode` branch; `buildTailBlocks` exposes `_textMode` for exactly this.

**Last hardcoded Turkish in any fragment.** A scan of all 122 found one: `spoken_delivery`'s tag
example, `"Buraya... [pause] <whisper>geleceğini hiç sanmıyordum.</whisper>"`. The tags are the same
in every language, so the example is English now like the instruction around it.

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
`relationships`, `trackers`, `gossip`, `char_quests`, `goals`, `promises`, `intent`, `judges`,
`scene_events`,
`gamemaster_engine`, `diaries`, `calendar`, `calendar_reconcile`, `travel`, `char_move`,
`text_reply`, `text_proactive`, `voice_check`, `image_writer`, `video_writer`,
`char_generator`, `world_authoring`, `universe_memory`.

Each card lists its prompt blocks plus `{kind:"dyn"}` descriptions of the live data the job
assembles — those dyn descriptions are the documentation of each engine's user message.
`_enginePayloadCoverage()` surfaces any unmapped registry prompt under "Other prompts" with a
console warning. ⚠️ The array property **must** be named `blocks` (a wrong name crashed boot
in v19.81), and `promptKey` strings must match registry keys exactly.

## v30.5 — the engine-prompt audit

Three checks over all 62 registry prompts. Two came back clean, which is worth recording so nobody
re-runs them: **every `{{placeholder}}` a live prompt declares is actually filled** (the apparent
misses were ES6 shorthand in the fill object, explicit `.replace()` substitution, prose *about*
placeholders in `promptTuner`, or — in `trackerGen` — `{{name}}`, which is deliberately a RUNTIME
template that `trackerPublicText` fills per owner, not a build-time token). And **no engine reads a
JSON field its prompt never asks for** (`questGen`'s `j.quests` is documented legacy tolerance;
`gistBuild`'s apparent misses belong to `memBuild`, which shares the parse).

The third check found three things.

**(!) A regression from v30.3, in memory retrieval.** `genQuery` appended *"Write the query in
{storyLanguage} — the story's selected language, which the memories are written in"*. That was true
until memories moved to the engine language, and then it was false and harmful: retrieval scores a
memory partly on token overlap between the query and the memory text (`memTokens`), so a Turkish
query against English memories overlaps on almost nothing and recall silently degrades to recency +
importance. The query is English now, via a `query_lang` fragment that states the coupling in words
so it cannot drift again. Proper nouns are what keep the other half of the query — the player's raw
text — still matching, since `engineLangDirective` never translates names.
**If the story language is not English, semantic embeddings are now worth more than they were:** the
lexical facet can only match on names and places.

**The meetings detector shipped 11 literal `{{user}}` tokens.** `runCalendarEngine` called
`up("calPrompt")` bare. `{{user}}` is the token the whole prompt turns on — *"EITHER {{user}} and a
character, OR two characters (not {{user}})"* — so every turn it ran, it had to guess which party the
rules meant. It goes through `fillTpl` now.

**Two prompts were editable and read by nothing.** A sweep for a matching `up("key")` found exactly
two of 62 with none — both loaded into state, persisted, listed on an engine card, fully editable,
and never consulted:

| Prompt | Why it was dead |
|---|---|
| `ranker` | Memory ranking is entirely code-side (the six-facet weighted scorer). There is no second LLM pass. |
| `textReplyPrompt` | Superseded in v28.6, when texting moved onto the shared reply payload and its rules became the `text_format` fragment. |

Both are removed from `PROMPT_REGISTRY` and their cards now describe what actually happens. The
constants and storage keys stay so old backups import. **Wiring either back up is a deliberate
change, not a bug fix** — the ranker would add an LLM call per turn, and `textReplyPrompt` would
duplicate `text_format`.

Also: the three character-quest prompts had no card, so they landed in the auto-generated "Other
prompts" bucket and warned on every boot. They have a `char_quests` card now, and the coverage check
is clean: **60 registry prompts, none dead, none unmapped.**

## v30.6 — engine prompt CONTENT

Structure was audited in v30.5; this pass read what the prompts actually say. Four findings, all of
the same family as the reply payload's: an instruction that contradicts another instruction, or asks
for a judgment the model has not been given what it needs to make.

**The tracker engine's prompt described a call it no longer makes — and failed silently when
obeyed.** `DEFAULT_TRACK` said *"For each tracker … Return ONLY a JSON **array**, one object per
tracker that changed, each `{id, delta, triggered}`"*. But the engine evaluates **one** (tracker,
owner) per call, with its own prompt and model, and its user message asks for a single
`{delta, triggered}`. Two contradictory contracts in one request — and the failure mode is invisible:
a model that believed the system prompt returned `[{…}]`, `typeof [] === "object"` passed the
parser's guard, and `rep.delta` / `rep.triggered` came back `undefined`, so the tracker never moved.
The prompt is rewritten for the single-tracker reality, **and the parser now unwraps an
array-of-one** — which is the half that reaches anyone with the old text already saved in
`state.trackPrompt`.
The engine also reported the tracker's **legacy `updateMode`** field rather than `trackerMethod(t)`,
so every tracker built in the current editor announced itself as `"llm"` whatever it really was. The
method vocabulary in the prompt was legacy too (`llm`/`both`/`trigger` vs the real
`llm`/`trigger_then_day`/`endday`).

**The daily relationship evaluator adjusted four axes it was never shown.** `DEFAULT_REL`'s output
contract opens *"Given the character's CURRENT axis values … decide a delta for each axis"* and asks
for nine deltas — but the user message listed only the five **slow** ones, so for desire, comfort,
fear and agitation the model guessed from zero every day. Those four are not discarded: they
accumulate in the slow slot and `_fastBaseline` reads them back (comfort's resting level subtracts
`o.fear*0.3`), so a number nobody could see was steering where the fast axes settle. All nine are
shown now, with the fast four labelled as the day-scale reading so they are not confused with the
moment-to-moment ones the short-term pass owns.

**The chain router sent four of its five inputs twice.** `routerChar` is the second-largest engine
prompt (8,699 chars) and fires after every character line in a multi-character chain, for an
80-token answer — and its user message repeated the speaker, the hooks sheet and the last line, all
of which the system prompt already carries as `{{speaker}}`, `{{hooks}}` and `{{last_line}}` under
its own "YOUR INPUTS" heading. The system prompt is the record; the user message is now just the
question.

**The presence tracker singled out Turkish and then said "any language".** Two adjacent bullets, the
first redundant with the second. One bullet now, language-neutral.

### Engine prompt sizes, for reference

`relPrompt` 11,971 · `routerChar` 8,699 · `sceneWriter` 7,308 · `gmAuthor` 5,344 · `gmJudge` 5,110 ·
`memBuild` 4,872 · `intentForm` 4,472 · `calPrompt` 4,236 (60 prompts, ~167k chars total). `relPrompt`
runs **per ordered pair per day** — with a cast of five that is up to twenty calls of ~3,000 tokens
each at End Day, which is the largest single cost in the app after the replies themselves.

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

## Form is a position problem, not a wording problem

`format` is block 3 of 30. By the time the model generates, ~20,000 characters have gone by and
**five** later blocks have asked it for physical behaviour — `feelings_now` ("what your hands are
doing"), the momentary-impact line, `already_said` ("your body has moved on"), RESPONSE GUIDANCE
("do something"), and `rail_question` ("End on something you DO"). Nothing since block 3 capped it.
A live reply came back as four narration paragraphs wrapped around three lines of speech, opening on
a four-sentence one — every content rule obeyed, every form rule ignored.

Two counterweights, because either alone is thin:

- **`rail_form`** is deliberately the LAST rail in the solo/multi set, so the one rule about what a
  turn is *made of* is the final thing read before generation. `rail_question` was also softened
  ("a few words of it, not a paragraph") — as written it invited exactly the closing stage-direction
  paragraph that came back.
- **`overNarrated()` / `overNarratedNote()`** measure the finished reply and retry once, on the same
  single-retry budget as the repeat guard (a repeat wins the budget; over-narration takes it
  otherwise). Heat and text replies are exempt — they carry their own form rails. The thresholds are
  conservative on purpose, since a false positive rewrites a reply that was fine: **3+ spans**, or
  **2 spans totalling 60+ words that outweigh the speech**. Like `repeatRetryNote`, the note names
  the offence with its own numbers and tells the model to KEEP the dialogue — told only "that was
  wrong", a model rewrites the half it got right.
