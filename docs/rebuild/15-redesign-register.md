# 15 · Redesign Register

Every place this specification departs from the current build, in one table, with the defect each
departure closes.

**How to read it.** The "Today" column describes the shipping app, usually accurately quoting its
own documentation — most of these are already known and already warned about in `docs/13`. The
point of this register is that a warning is not a fix. A rule that says *"a fifth read path is
fine; a missing one means the world writes straight through a promise"* has correctly identified a
defect and then left it in place, guarded by the next author's attention.

Everything here is therefore the same move: **turn a discipline into a mechanism.**

Entries are grouped by the principle they serve.

---

## Principle 1 — One owner per fact

| # | Today | The defect it produced | The rebuild | Req |
|---|---|---|---|---|
| RD-1 | Standing commitments are read from four independent places that "must stay in step" | A missing consumer means the world writes straight through a character's given word — silently | Commitments are published once; consumers subscribe, and the subscriber set is enumerable | R-ARCH-4, R-SIM-39 |
| RD-2 | Four payload blocks each decide independently whether the speaker is continuing their own line | A fifth block was added that disagreed and won, because guidance sits closest to generation — the character answered a question nobody asked | The property is computed once per request; every block reads it | R-PAY-12 |
| RD-3 | Rule ownership between blocks is a documentation convention; the de-duplicator strips only verbatim whole-section repeats | A paraphrase of a rule stated twice survives, costs tokens, and muddies both statements | Ownership is declared in the block registry and validated at boot | R-PAY-7, R-ARCH-7 |
| RD-4 | Layer-4 systems reach into each other directly — memory feeds five consumers, the witness list feeds three | Adding the Nth consumer is invisible to the other N−1; the coupling table is the only map | Domain modules are peers communicating through published facts | R-ARCH-2, R-ARCH-4 |
| RD-5 | An engine wrote to a character's authored goals field | Writing there silently cleared the maintained live list on the next save — two writers, one field, two meanings | Authored and maintained content are separately owned fields with separate writers | R-STATE-19, R-ARCH-16 |

## Principle 2 — Contracts are declared, not remembered

| # | Today | The defect it produced | The rebuild | Req |
|---|---|---|---|---|
| RD-6 | A prompt's output contract lives in its prose; the parser lives in code; nothing links them | An engine went single-item while its prompt still asked for an array. An array is an object, so the guard passed, every field read back undefined, and the feature quietly stopped working | Prompts declare their output schema; responses are validated against it; a mismatch is a reported engine failure | R-PAY-28, R-ARCH-10 |
| RD-7 | Placeholders in a prompt and the values a call site supplies are reconciled by hand | A prompt was read without being filled and the literal characters `{{user}}` reached the model — for months | Placeholder sets are declared and reconciled mechanically; an unfilled placeholder cannot reach a model | R-PAY-17, R-ARCH-7 |
| RD-8 | A prompt asked for nine deltas; the call site supplied five values | Four axes accumulated from the model's guesses and fed a baseline nothing could audit | A prompt asking for a delta is supplied every value it asks about; R-PAY-17 detects the mismatch | R-PAY-29 |
| RD-9 | The fragment three-leg guard checks the default and the listing, but structurally cannot see a producer that stopped calling for its fragment | Inline prose in an assembler makes the settings editor show something different from what is sent — confidently wrong | Consumption is declared rather than incidental; all three legs are checkable | R-PAY-16, R-ARCH-7 |
| RD-10 | Retired engines left their prompts in the registry | The settings screen offered editable prompts that did nothing. At least two shipped this way | Referential integrity is validated in both directions at boot | R-PAY-27 |
| RD-11 | Adding a persistent value means touching four hand-maintained places; the settings round trip is two functions that must agree | An input added but not read is never saved; an input removed but still read makes the read throw and **settings stop saving for everyone** | The settings surface is generated from the settings registry; persistence is per-setting | R-SET-7, R-SET-8 |
| RD-12 | Turn-consuming behaviours are ordered by a sequence of early returns, with the ordering rule in a documentation table | A new turn-consuming feature stacks on top of the Gamemaster unless its author knew | Precedence is a declared registry property; omitting it fails boot validation | R-ARCH-13, R-TURN-32 |
| RD-13 | Ordering-dependent pipelines are correct by construction and documented with "MUST be first" comments | Correct and undefended. Reordering the day pipeline, or inserting a pass into the history chain, breaks it silently | Pipeline dependencies are declared as data and validated | R-SIM-6, R-OBS-18 |

## Principle 3 — Identity is permanent, presentation is not

| # | Today | The defect it produced | The rebuild | Req |
|---|---|---|---|---|
| RD-14 | Memories, witness lists, relationship prose, presence notes, and calendar places reference people and places **by name** | Renaming a character fractures five systems at once; the documented advice is *don't rename* — for something users reasonably want to do | Every durable reference is by id; names are resolved for display and for prompt text | R-STATE-2, R-STATE-3 |
| RD-15 | The display-name resolver returns the literal string `"(unknown)"` for a deleted id | Correct on a badge, poison in a prompt — it hands the model a nameless person to invent — and truthy, so every `if (!who)` guard sails past it. Fixed by a second resolver plus the discipline to know which one you are in | Resolution returns absence; the UI renders absence at the point of display. One resolver, no sentinel | R-STATE-4 |
| RD-16 | A sub-area can be created by flag or by name, and name-created ones do not set the flag | Duplicate entrances: two people who both "walked into the Entrance" land in different earshot zones and stop hearing each other. Repaired by remapping four separate stores of sub-area ids, with a warning that a fifth store belongs there too | Sub-areas are created through one interface that enforces entrance uniqueness; id remapping is a storage-layer operation over declared reference sites | R-STATE-22 |
| RD-17 | Two version stamps in two files, bumped by hand | Forgetting the cache bump leaves installed clients serving the old build offline — indefinitely, invisibly, indistinguishably from "the fix didn't work" | One version source, derived everywhere | R-SET-21 |

## Principle 5 — Fail soft, never fail silent

| # | Today | The defect it produced | The rebuild | Req |
|---|---|---|---|---|
| RD-18 | Background engines fail soft with no trace | A feature that has stopped working is indistinguishable from a feature with nothing to say | Every engine run records an outcome; a skip is an outcome with a reason | R-OBS-2, R-OBS-3, R-SIM-4 |
| RD-19 | A frame upload that failed produced a request without it | The request succeeded and returned a plausible video that had ignored its conditioning — a quality regression with no error anywhere | A missing required input fails the request loudly | R-PROV-21, R-MEDIA-14 |
| RD-20 | The reasoning trace was returned as content when content was empty | The model's monologue rendered as a character's line, *and* the gateway believed the call succeeded — so the recovery retry never ran | A reasoning trace is never answer text; the empty-content path is the only handler | R-PROV-9 |
| RD-21 | A settings toggle was read only at save time | The switch said on and the request said nothing | Controls that affect an outbound request commit on change | R-MEDIA-16 |
| RD-22 | The debug surface is reachable only from the nav | The distance from "that's wrong" to "here's why" is a manual search | Every surface that can show a surprising result links to the entry that produced it | R-OBS-8 |

## Principle 7 — Old saves keep working

| # | Today | The defect it produced | The rebuild | Req |
|---|---|---|---|---|
| RD-23 | Underscore-prefixed properties are stripped on persist, by convention | Durable data in an underscore property is lost by design; a transient flag in a normal property dead-locks after a mid-flight reload. Both directions are documented warnings | Transience is a declared schema property; writing an undeclared field is a validation error | R-STATE-10, R-STATE-11 |
| RD-24 | Mutating a record in place requires calling a dirty-marker afterwards | Forget it and the edit never persists and vanishes on reload — silent data loss guarding a performance optimisation | Change detection is the storage layer's job; the optimisation stays, the footgun does not | R-STATE-13 |
| RD-25 | The prompt-refresh migration identifies a stale default by fingerprint plus a missing marker | When a later rewrite drops the marker, the default satisfies its own reset condition and the migration overwrites the user's edits **on every load, forever, with no error** | Destructive-capable migrations are self-invalidating: they verify their criterion still discriminates and stand down loudly | R-STATE-36 |
| RD-26 | Seven mutually-exclusive line types are seven independent boolean flags, and every engine filters on the set | *"A new flag must be added to those filters or it leaks into payloads and memories"* — a change to every filter in the app, discoverable only by grep | One enum with declared properties; filters read the property | R-STATE-26 |

## Principle 9 and 10 — Payload as artifact, position as meaning

| # | Today | The defect it produced | The rebuild | Req |
|---|---|---|---|---|
| RD-27 | Historically, each reply path had its own block map and order array | The asymmetry silently hid trackers and calendar entries from the director path entirely. Fixed by unifying, with a warning not to reintroduce it | One block set and one default order by construction | R-PAY-1 |
| RD-28 | A position rule was placed in the final length rail | Being the last line of the payload, it outweighed everything — and contradicted any formatting contract a user had edited to require an opening narration | Blocks declare which kind of instruction they may carry; kinds are validated | R-PAY-5, R-PAY-6 |
| RD-29 | Two fragments hardcoded the player variable where the response target belonged | In a multi-character scene they named the player while the block underneath printed another character's card | Target-referring fragments use the target variable; reconciliation catches the rest | R-PAY-18 |
| RD-30 | Adding a reply block touches three places, four if it wraps fixed text | A checklist, held in documentation, in the most coupling-dense area of the app | Declare it and produce it. Boot validation checks the rest | R-PAY-22 |
| RD-31 | The response target is passed separately to two assembly halves | A call site that passes it to only one makes three blocks disagree with the guidance | Target is resolved once in the request; composition is a pure function of the request | R-TURN-14, R-ARCH-17 |
| RD-32 | Adding a reply path means replicating witness scoping, refusal handling, empty-reply handling, ordering, and dirty marking — *"copy the existing one, don't improvise"* | Copying is how five paths drift | One generation path, parameterised | R-TURN-35 |

## Quality regressions with no error surface

Three entries that deserve separating, because none of them produced a bug report — they produced
*worse output*, which users attribute to the model.

| # | Today | The defect | The rebuild | Req |
|---|---|---|---|---|
| RD-33 | The perception filter stripped other characters' entire narration span | Narration is physical action — exactly what someone in the room sees. Two characters in one kitchen each got a transcript in which the other never moved, and a wordless turn vanished entirely. *(Fixed in the current build; stated here as the rule so it is not re-derived wrongly.)* | Strip inner thoughts only. You see what they did; you never hear what they thought | R-TURN-17 |
| RD-34 | Compaction stripped narration indiscriminately, running after the perception filter | The only narration still standing at that point is the speaker's own and the player's — so the cost control spent its whole budget on the two things nothing else can reconstruct. A model that cannot see it already gripped the counter grips it again | Compaction exempts narrator lines and the speaker's own lines; the ordering dependency is stated at the rule | R-TURN-18 |
| RD-35 | Memories moved to English; the retrieval query generator kept writing queries in the story language | The lexical facet stopped overlapping on anything but proper nouns. Silent, gradual, and indistinguishable from the memory system simply not being very good | Query language is derived from the bank's declared language; changing an engine's output language requires auditing its declared subscribers | R-MEM-21, R-PAY-31 |

---

## Deliberately not changed

Things that look like defects and are not. Recorded so a future reader does not "fix" them.

| Behaviour | Why it stays |
|---|---|
| Background engines run provider sampling defaults | Repetition penalties and unusual sampling derail structured output — the model starts avoiding the field names it must repeat |
| Extended reasoning off by default | The pipeline is judgement and parsed output that must not think out loud; hybrid models leak or burn the budget |
| Engine part order fixed in code while reply block order is user-editable | Engine outputs feed parsers; reordering changes what is being asked for |
| Chains are rare; most turns return to the player | A world where every line triggers three replies is not a conversation the player is in |
| Diaries are never condensed | Condensation destroys interpretation, which is the entire content of a diary |
| Three relationship layers, not one score | Wanting someone you do not trust is the drama; one number cannot hold it |
| Fixed-order day pipeline with a hard first and last step | Genuine data dependencies, now declared rather than commented (RD-13) |
| Soft removal as the default retirement | Hard deletion dangles memory owners, resident lists, relationship pairs, promises, and intents |
| The gossip stakeholder/carrier split | Without it every character who overheard anything raises it, forever |
| The intimate-share cap on recall | One intense night otherwise dominates recall for a week — it scores high on emotion, importance, and people at once |
| One automatic image per turn, anchored to a character | Director beats self-illustrating produces images of nobody |

---

## Open decisions

To be resolved and recorded here, per R-ARCH-20.

| Decision | Options | Status |
|---|---|---|
| **Source layout** | Single-file, no build · modular with a build step emitting one artifact · something else | **Open.** [`04-architecture.md`](04-architecture.md) recommends the second and states the five properties any answer must satisfy (R-ARCH-19). Record the choice and its reasons here |
| **Legacy import fidelity** | Full import of current backups · settings and worlds only · none | **Open.** R-SET-17 specifies full import as a SHOULD. The cost is name-to-id resolution for every historical reference |
| **Embedding provision** | Keep as an opt-in single provider · support alternatives · drop | **Open.** Currently opt-in with silent lexical fallback, which is the right default regardless |
