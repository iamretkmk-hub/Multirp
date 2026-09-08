# 08 · Prompt Composition

Layer 3. The most coupling-dense part of the system in the current build, and the part where the
rebuild's principles do the most work.

Composition is **pure** (R-ARCH-17): a state snapshot and a request go in, an assembled payload
comes out. No I/O, no mutation, fully reproducible — which is what makes the payload inspectable,
diffable against what was actually sent, and testable without a network.

## The model

A **payload** is the complete instruction package one model call receives. Two kinds.

### Reply payloads

What a model gets when a character speaks. Five variants, and the critical property is that they
are **one thing with parameters**, not five things:

| Variant | Occurs when | Differs by |
|---|---|---|
| `solo` | Exactly one character present | — |
| `multi` | Per responder in a routed turn | — |
| `director` | Reacting to a hidden director beat | — |
| `text` | A phone message | Format contract; room-describing blocks suppressed |
| `heat` | An extended continuation | Format, guidance, and guardrail fragments swapped |

**R-PAY-1** — All reply variants MUST share **one block set** and **one default order**. Only the
per-variant ordering a user has customised is stored separately.

> **Redesign — was:** before a restructure, each reply path had its own block map and its own
> order array, and the asymmetry silently hid trackers and calendar entries from the director
> path entirely. The current build fixed it by unifying, with the warning "don't reintroduce
> separate block maps." **Now:** R-PAY-1 makes the unified set the mechanism rather than a
> convention, and adding a block reaches all five variants by construction.

**R-PAY-2** — The transcript's position within the block order is itself a block. Blocks before
it form the pre-transcript instruction; blocks after it form the post-transcript instruction —
which sits closest to generation and therefore carries the most weight.

**R-PAY-3** — A block that renders empty MUST keep its ordinal position and render nothing.
Emptiness is not reordering ([principle 10](00-principles.md#10--position-is-meaning)).

### Engine payloads

Every background job. **R-PAY-4** — Engine prompts MUST be editable in place, but engine part
**order is fixed in code**, because engine outputs feed parsers and reordering changes what is
being asked for. This asymmetry with reply payloads is deliberate and MUST NOT be "corrected".

## Block kinds

**R-PAY-5** — Every block MUST declare which kind of instruction it may carry. A rule of the
wrong kind in a block is a defect.

| Kind | Governs | Example |
|---|---|---|
| **Identity** | Who the speaker is | The character's sheet |
| **Context** | What is true right now | Scene, presence, privacy, trackers |
| **Recall** | What is remembered | Retrieved memories |
| **Form: shape** | The structure and position of the output | The formatting contract |
| **Form: volume** | How much output | Length rails |
| **Guidance** | What this turn must accomplish | Response guidance |
| **Guardrail** | What must not happen | Consistency and fabrication rails |

**R-PAY-6** — A **position** rule MUST NOT be placed in a volume block, and a volume rule MUST
NOT be placed in a shape block.

> **Redesign — was:** a position rule ("do not open with scene-setting") was placed in the final
> length rail. Being the last line of the payload, it outweighed everything — and it directly
> contradicted any formatting contract the user had legitimately edited to *require* an opening
> narration. **Now:** R-PAY-5 and R-PAY-6. Volume is governed by the rails; shape and position are
> governed by the formatting contract; the kinds are declared and checkable at boot (R-ARCH-7).

## Rule ownership

**R-PAY-7** — Every behavioural rule stated to a model MUST have exactly one owning block. A rule
appearing in two blocks is a defect, not emphasis
([principle 1](00-principles.md#1--one-owner-per-fact)).

| Rule | Sole owner |
|---|---|
| Who can hear this | The privacy block |
| Do not invent a shared past | The guardrail block |
| The language the story is written in | The language directive |
| The shape and position of output | The formatting contract |
| Output volume | The volume rails |
| Do not repeat your own last lines | The already-said block |
| Speak only as yourself | The guardrail block |

> **Redesign — was:** the de-duplicator strips only *verbatim* repeats of a complete section, so
> a paraphrase of a rule stated in a second block survives and lands twice — costing tokens and
> muddying both statements. The current mitigation is the ownership discipline above, held in
> documentation. **Now:** ownership is declared in the block registry and validated at boot
> (R-ARCH-7, check 6), so a second claimant is a startup error rather than a slow leak.

## Default order

The default order for reply payloads, with the rationale for each grouping. **R-PAY-8 — This
order MUST be specified with reasons and MUST NOT be treated as an accident of authorship.**

```
── PRE-TRANSCRIPT ─────────────────────────────────────────────
  universal        task · world · format+language
  who you are      identity sheet · relationships · scenario · who else is here
  who you answer   response target · the player (only when not the target) · settled feelings
  what you recall  distant memories · recent memories · situation
  voice + gap      speaking style · latest memory arcs
── THE TRANSCRIPT ─────────────────────────────────────────────
── POST-TRANSCRIPT ────────────────────────────────────────────
  what just happened   what is playing · the last line · your own last lines
  what is live         rumours · scene · privacy · trackers · promises · calendar ·
                       quests · private intent · momentary feelings
  what to do           response guidance · guardrails · delivery coaching
```

The reasoning, which is not obvious:

- **Who you are and what you remember first**, because they are stable and long.
- **Speaking style and the newest memory arcs immediately before the transcript**, because voice
  should be the last thing read going in, and the newest arcs close the gap between where the
  transcript window starts and what retrieval happened to match.
- **The line being answered, the live situation, then guidance and guardrails after the
  transcript**, because proximity to generation is influence, and these are the things that must
  win.
- **Momentary feelings sit last among the context blocks**, immediately above the guidance,
  because they are true for exactly one turn.

## Block inventory

Reply-payload blocks, with the non-obvious constraint on each. Blocks marked ⚠ are
coupling-sensitive.

### Pre-transcript

| Block | Carries | Constraint |
|---|---|---|
| `task` | Core directive + the user-editable global base instruction | Editing the shipped default reaches **new installs only**; anyone who has ever touched it keeps their copy forever |
| `world` | The universe's setting | |
| `format` | The three-part markup contract + the story language | Swapped per variant. Owns shape and position (R-PAY-7) |
| `identity` ⚠ | The speaking character's sheet: identity, backstory, personality, behaviour, the **maintained** want-list, live pursuit status, appearance, wardrobe, home | See below |
| `relationships` ⚠ | Ties in three labelled groups: authored note, facts play has revealed, structured ties | Full prose **only** for the player and whoever is present; everyone else collapses to a one-line tie |
| `scenario` | The character's scenario, when set | |
| `others_present` | Who else is within earshot, and that only these people exist | |
| `response_target` ⚠ | Who this turn is aimed at, with their backstory and appearance | Player *or* another character |
| `player` | Who the human is | Rendered **only** when the target is someone else, so the player never drops out |
| `feelings` | The **settled** view of the target — the considered opinion that governs behaviour | Or a first-encounter notice |
| `distant_memories` | Long-term recollections | Diaries are background, never recited |
| `recent_memories` | Fresh experiential memories | |
| `latest_arcs` | The newest memory arcs, injected **every turn regardless of retrieval** | Closes the transcript/retrieval gap |
| `situation` | Only when this character is arriving or leaving this turn | |
| `speaking_style` ⚠ | The character's voice, delivered where the line gets written | |

**R-PAY-9** — The identity block writes both the speaker's own sheet **and** the sheets other
characters read about them. Every fixed sentence in it MUST therefore exist in a self form and an
other form.

> **Parity — keep:** one producer writes both, and a single wording is wrong for one of the two
> readers. Worse, third person inside a character's *own* sheet nudges the model toward writing
> *about* the character instead of *as* them — a subtle, pervasive quality loss.

**R-PAY-10** — The relationships block MUST keep **every** tie and MUST collapse the prose for
anyone not present.

> **Parity — keep:** you do not forget your daughter because she is not in the room, so the tie
> survives; but a live two-person scene was spending roughly 1,300 tokens on nine people, about
> 700 of it paragraphs about seven who could not be spoken to. The tie is what stops a bond being
> played as a stranger; the paragraph only earns its place for someone in front of you.

### Post-transcript

| Block | Carries | Constraint |
|---|---|---|
| `watching_now` | What the video that just played showed, as happening now | Present only on a turn a cue fired |
| `last_line` ⚠ | The last real **dialogue** line, pulled out | Not a day marker, presence note, travel beat, or narration |
| `already_said` ⚠ | The speaker's own last lines, verbatim, with the rule not to repeat them | Strengthens when the exchange has visibly stalled |
| `rumors` | Live rumours, **split by standing** | The one the speaker has a stake in (raisable **once**) versus what they merely overheard (not raisable at all) |
| `scene_now` | How to read the situation; day, place, whose ground it is, sub-areas, what changed | Sub-area **names only**; privacy labels belong to the next block |
| `privacy` | Who can hear this: alone, in front of an audience, apart; who is elsewhere; how exposed; where to move | Sole owner of earshot (R-PAY-7) |
| `trackers` | The speaker's own trackers, story-wide ones, and anything of theirs that has become public | Owner tags are dropped inside the reader's own group and load-bearing outside it |
| `promises` | Standing commitments: what they swore, what was sworn to them, what recently broke or was kept | |
| `calendar` | Plans due now or soon for this character | |
| `quests` | Active quests naming this character | |
| `private_intent` | One-turn colouring from a live scheme or warmth toward someone **present** | Ranked as a side-current when its target is not the turn's target |
| `feelings_now` ⚠ | The **live** charge carried into this reply, written as a state the character is in | True for one turn; sits last |
| `response_guidance` | Who you are, who you are answering, what this turn must do | |
| `guardrails` | Voice only yourself · single turn · pacing · consistency · no fabricated past · no echo · volume rails | |
| `delivery` | Voice-delivery coaching while voicing | |

**R-PAY-11** — Blocks that describe **a room** MUST be suppressed in the `text` variant; blocks
that describe **a person** MUST ride along unchanged.

> **Parity — keep:** texting shares the spoken payload block for block, because texting someone
> and standing next to them are one continuous relationship. But location, earshot, and who else
> is present are wrong when the character is on their phone somewhere else. Trackers, promises,
> calendar, and feelings are correct in both.

**R-PAY-12** — Every block that branches on "the speaker is continuing their own last line rather
than answering someone" MUST derive that from **one** computed property.

> **Redesign — was:** four blocks each branched on this independently. A fifth was added that
> disagreed — it said "answer them" while the others said "carry on" — and it won, because
> guidance sits closest to generation. **Now:** the property is computed once in the request and
> every block reads it (R-PRIN-1). Disagreement becomes impossible rather than merely warned
> against.

**R-PAY-13** — A guardrail describing a **situation** MUST be gated on that situation actually
occurring.

> **Parity — keep:** rails are not a flat list. "If they refuse again…" and "don't quote them
> back…" are gated on whether that is happening, and one rail is off by default because the
> guidance block already says it one block earlier. An always-on prohibition against something
> that is not happening dilutes the ones that are.

**R-PAY-14** — Each block MUST carry its own heading. A block holding several subjects renders as
one wall in the inspector and cannot be independently reordered or removed.

**R-PAY-15** — Prose written *about* the world and injected into a reader who is named in it MUST
NOT be rewritten to change person. Instead the block MUST state plainly that the name in the text
is the reader.

> **Parity — keep:** a quest is written about the world, so it speaks of the reader in the third
> person, and that lands inside the reader's own payload. Deciding which pronoun is the reader
> guesses wrong eventually, silently, and wrecks every other person named in the same text. Say
> it instead.

## Fragments

**R-PAY-16 — No literal prose may appear in an assembler.** Every fixed sentence is a fragment
with (1) a registered default, (2) a consumer that requests it by key, (3) a listing against its
owning block. All three MUST be mechanically validated.

> **Redesign — was:** the boot guard checks legs 1 and 3 and structurally cannot detect a
> producer that stopped calling for its fragment. Inline prose in an assembler therefore makes
> the settings editor silently diverge from what is actually sent — the editor is confidently
> wrong, which is worse than having no editor. **Now:** consumption is declared rather than
> incidental, so all three legs are checkable (R-ARCH-7, check 2).

**R-PAY-17** — Fragment variables MUST be declared as data and reconciled against the values a
consumer supplies. **An unfilled placeholder MUST NOT reach a model.**

**R-PAY-18** — A fragment referring to the person a turn is aimed at MUST use the **target**
variable, never the player variable. The target is only sometimes the player.

> **Redesign — was:** two fragments hardcoded the player variable, so in a multi-character scene
> they named the player while the block underneath printed a different character's card.

**R-PAY-19** — User-customised fragments are never auto-upgraded. Changing a consumer's variable
set MUST therefore be treated as a breaking change to every saved override of that fragment, and
R-PAY-17 MUST catch it rather than letting literal tokens through.

## The block registry

**R-PAY-20** — Every block declares: stable id, human label, kind (R-PAY-5), description, the
variants it applies to, the rules it owns (R-PAY-7), and its default ordinal.

**R-PAY-21** — **Block ids are permanent** (R-PRIN-3). Saved layouts reference them by string; a
rename silently loses the user's placement.

**R-PAY-22** — Adding a block MUST require declaring it in the registry and producing it. Nothing
else.

> **Redesign — was:** three places, and a fourth if the block wraps fixed text — with a
> documented checklist. Before an earlier restructure it was four places across five payloads.
> **Now:** two, and the second is checked by boot validation.

**R-PAY-23** — Layout self-healing MUST be automatic: an unknown id in a saved order is dropped;
a known id missing from a saved order is re-inserted at its default ordinal. No migration
(R-STATE-35).

**R-PAY-24** — A block the user has explicitly removed MUST be recorded as removed, so
self-healing does not resurrect it, and MUST be restorable.

## The prompt registry

**R-PAY-25** — Every editable prompt MUST be registered with: key, label, default text, declared
placeholder set, declared output schema (where parsed), and a hint documenting both.

**R-PAY-26** — Prompt resolution has exactly three layers, read in order: per-universe override →
global override → registered default. **There MUST be exactly one read path**, and reading a
prompt directly from state bypasses per-universe overrides — which is a silent correctness bug,
not a shortcut.

**R-PAY-27** — Every registered prompt MUST have a live consumer, and every prompt a consumer
names MUST be registered. Both directions are validated at boot (R-ARCH-7, check 1).

> **Redesign — was:** retired engines left their prompts in the registry, so the settings screen
> offered editable prompts that did nothing — worse than not offering them. At least two shipped
> this way.

**R-PAY-28** — Every prompt whose output is parsed MUST declare its schema, and the response MUST
be validated against it (R-ARCH-10).

> **Redesign — was:** the output contract lives in the prompt's prose and the parser lives in
> code, with no link. Changing one without the other fails silently — an engine went single-item
> while its prompt still asked for an array, every field read back undefined, and a whole feature
> quietly stopped moving. **Now:** one declaration, mechanically enforced, and a parser MAY be
> tolerant of an older shape for users who have that shape saved in an override.

**R-PAY-29** — A prompt asking a model for a delta on a value MUST be supplied every value it is
asked about.

> **Redesign — was:** a prompt asked for nine deltas; the call site listed five values. The other
> four accumulated from the model's guesses and fed a baseline nothing could audit. If a prompt
> says "given the current values", it gets all of them — and R-PAY-17's reconciliation is what
> detects the mismatch.

## Language policy

**R-PAY-30** — Every model call MUST select exactly one language directive. There is **no
default**; a call with none inherits whatever its prompt happens to hardcode.

| Directive | For | Examples |
|---|---|---|
| **Story language** | Text the player reads as story | Replies, travel and day narration, texts, diaries, the recap, the authored player turn |
| **Engine language** (always English) | The engine's own **record** | Memories, gists, condensation, relationship evaluation, gossip, intents, goal pursuit, calendar and quest reasoning, the chronicle, the hidden director note |
| **Mixed** | Engines answering with both, naming which fields are which | World events, calendar execution, quest steps, scene setup |

**The rule in one line:** only what the player reads as story is in the story language;
everything else is English.

> **Parity — keep, and understand why:** records are read back by a dozen other engines and end
> up quoted verbatim inside a reply payload. A payload once came back half English and half
> Turkish exactly this way. There is a second-order version of the same trap: when memories moved
> to English, the query generator kept asking for search queries in the story language, so the
> lexical retrieval facet stopped overlapping on anything but proper nouns — a silent quality
> regression with no error anywhere. **R-PAY-31 — Changing what language an engine writes in MUST
> be accompanied by an audit of everything that reads it back.** The registry's declared
> subscriber list (R-ARCH-5) is what makes that audit possible instead of a grep.

**R-PAY-32** — A language directive MUST NOT be appended to a pure-JSON parser prompt whose
enumerated values must stay stable.

## Genre packs

**R-PAY-33** — Per-universe genre sections — voice, drama, stakes, relationship interpretation,
diary voice, pacing — MUST be appendable to genre-sensitive engines through one mechanism, so a
world can colour its own simulation without forking prompts.

## Per-universe prompt tuning

**R-PAY-34** — Automatic rewriting of engine prompts into a world's flavour MUST validate every
result before saving: placeholders preserved, output schema intact, code-evaluated enumerated
values unchanged. A rewrite that would break any of these is discarded, not saved.

**R-PAY-35** — Hand edits receive the same validation at save time. The tuner is not the only way
to break a contract, and today it is the only path that checks.

## Inspection

**R-PAY-36** — The assembled payload MUST be recoverable per call, rendered block by block with
its labels, at full fidelity (R-VIS-26).

**R-PAY-37** — The inspector MUST show the instruction/transcript token split and flag it below
threshold (R-PROD-7).

**R-PAY-38** — Because composition is pure (R-ARCH-17), the app MUST be able to **re-assemble**
the payload for a past turn from stored state and diff it against what was sent. This is the only
reliable way to answer "did my change do what I think it did".
