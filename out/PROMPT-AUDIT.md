# Prompt audit — your export of 20 Sep, against the app as it actually runs

**What came back:** `storymind_prompts_audited_20260920.json`. Import it whole, from
Settings → Import → Prompts. Your 54 model and toggle settings are byte-identical to what you
sent; 21 of 104 prompts changed and the other 83 were not touched.

I did not rewrite prompts for taste. Almost everything below is a place where an edit
disconnected a prompt from the engine that reads it — where the prompt still reads well and the
feature behind it had silently stopped working. That is what "not providing good outputs" turns
out to be here, and it is mostly not about the writing.

---

## The pattern

Of the 34 prompts you had edited, most of the damage is one thing happening over and over: the
edits removed the **reasons**, and the rules followed them out.

This codebase's prompts state the cost of breaking a rule — "never write what `{{user}}` says"
is followed by *why*, "this line is read back to each participant on their own card" explains
who is hurt. Those parentheticals read like clutter to anything optimising for leanness, so they
went first. Once the reason was gone, nothing was defending the rule, and on the next pass the
rule went too. Six prompts lost the same rule that way — that character sheets are written in
the second person — and only `bioPrompt` still carried the explanation, which is how I know the
other five were accidents rather than decisions.

A second, purely mechanical pattern: **a round-trip through some editor unescaped the quotes**
inside JSON examples. `\"You are…\"` became `"You are…"`, which ends the string early and makes
the example object the model is told to copy invalid JSON. Four prompts, including the two that
generate your characters.

---

## P0 — things that were not working at all

### 1 · `x_membuild_text_note` — no phone thread has been remembered since this edit

This is a *note*, appended after the whole of `memBuild`. It had grown into a full prompt with
its own output contract:

```
Return ONLY this JSON:
{"memories":[{"content":"…","importance":0.5, …}]}
```

`_commitTextArc` reads `j.content` and `j.importance_score` off the **top level**:

```js
const j=parseJSON(out);
if(!j||!j.content)return;          // ← every time
```

The note is the last instruction in the request, so it wins. `j.content` is `undefined`, the
function returns, and nothing is written — no error, no log, no memory. This is your "I always
lose the last memory", for texting.

**Fixed:** the note is a note again. Every texting-specific observation you wrote is kept — reply
gaps, who left the thread hanging, a tone that went cold then warm then gone — and the shape is
left to `memBuild`, where it belongs.

### 2 · `gossipPrompt` — the gossip ledger has been filing everything to the wrong person

`stakeholder` and `about` were deleted from the output schema. Both are read:

```js
const stakeId=(g.stakeholder?idByName(g.stakeholder):null)||rid;   // ← falls back to the RECIPIENT
```

So every bystander who merely hears a rumour is recorded as the one person whose life it changes.
`maybeSpawnConfrontation` only lets a **stakeholder** come and put it to you — which means
everyone who heard anything now has standing to turn up about it. That is the "she is scared her
husband would say she couldn't manage" register of wrongness, arriving from a different door.
And without `about`, `aboutNames` falls back to `["__user__"]`: every rumour in the world is
filed as being about you, and the guard that stops a character being handed a rumour about
themselves can never fire.

**Fixed:** both fields restored, with the stakeholder rule that explains the distinction.

### 3 · `baseInstruction` — blanking a prompt does not blank it

You cleared it. `up()` treats an empty stored value as *no override* and falls through to the
shipped default:

```js
const g=state[key];
if(typeof g==="string"&&g.trim()!=="") return g;
return reg?reg.def():"";           // ← the shipped text has been running all along
```

So the shipped "HOW A REAL PERSON BEHAVES" has been in every reply payload this whole time,
beside the copy of itself you moved into `formatRules`. I diffed them: **twelve near-verbatim
duplications**, several word for word —

```
base : - you answer what was actually said
fmt  : - you answer what was actually said
base : - you are specific and inconsistent — a particular humour, things you care about…
fmt  : - you are specific and inconsistent — a particular humour, things you care about…
base : small talk gets small answers
fmt  : small talk gets small answers
```

If one thing on this list is making replies read stiff and checklist-like, it is this. A model
told the same seven things twice, in two voices, in one system message, spends its attention
reconciling them instead of playing anyone.

**Fixed:** `baseInstruction` now carries the shipped text **minus** the section `formatRules`
owns. The behaviour bullets live once, where you put them. What stays is what `formatRules` does
not carry: emotion in proportion, warmth being earned, not folding and not shattering, and what
happens when something genuinely serious lands.

### 4 · Four JSON templates that no longer parse

`bioPrompt`, `univPrompt`, `batchBioPrompt`, `charQuestGen` — all lost their backslashes, so the
example object teaches the model to emit invalid JSON. `parseJSON` gives up and the caller gets
`null`: a character sheet, a quest, or a whole universe that fails silently. `charQuestGen`
proved it directly — before the fix, its second `{"quest": …}` template failed at column 611;
after, both parse.

`x_appearance_generator` had the same class of fault in a different shape: the `wardrobe` value
ran across a literal newline, which is not legal inside a JSON string.

**Fixed:** re-escaped, and the wardrobe slots folded into a single well-formed value.

### 5 · `visualDirector` — asking for a feature the app removed

The edit added a third answer: the name of a video scene. The consumer accepts two:

```js
if(/^0$/.test(raw)){ … return; }
if(/^1$/.test(raw)){ illustrate(mid,replyText); return; }
// Anything else is a malformed answer, and a missing picture is worse than a spare one.
illustrate(mid,replyText);
```

So a scene name meant *draw anyway* — more pictures, never a video. Automatic scene routing was
deliberately removed in v39.8; a scene is started by hand now. Three further problems: the
promised "VIDEO SCENES available" list is never supplied, so the prompt referred to something
that never arrives; and the app appends "Answer 0 or 1." to the user turn, contradicting the
system prompt from the more recent position.

**Fixed:** back to the 0/1 contract. If you want automatic scene playback back, that is an app
change and I can do it — it cannot be done from the prompt.

### 6 · `playerNarratePrompt` — a malformed placeholder in the guardrail line

`GUARDRAIL: You are NOT reaponding to {user}}.` — `{user}}` is not a token the filler
recognises, so those eight characters reached the model verbatim, in the one line meant to stop
the narrator answering you instead of speaking as you. Fixed, with the typo.

---

## P1 — load-bearing rules that went out with their reasons

### The card voice — five prompts

Character cards are injected under a heading that opens `You are <name>.` A third-person sheet
landing there teaches the actor to write *about* itself from the outside, which is the single
thing the card exists to prevent. `bioPrompt` still carried the rule in full. These had lost it:

| Prompt | What it writes | Now |
|---|---|---|
| `relPrompt` | the settled **description** | second person restored, with the reason |
| `calReconcile` | the meeting **result** | the note about who reads it restored |
| `goalPursuit` | the plan's **detail** | one phrase, their own terms — your "why now" kept |
| `x_reveal_npc` | a revealed NPC's sheet | card voice restored |
| `latentNpc` | a location's inhabitants | card voice restored |
| `univPrompt` | the whole generated cast | card voice restored across every field |

`relPrompt` is the worst of these: its description is rendered as *"LASTING / CONSIDERED VIEW
(your settled, filtered opinion — this is the real foundation and should govern your
behaviour)"*. A sentence about "she" arriving under *your settled opinion* is copied straight
into the reply. It is the second-highest blast-radius prompt in the app.

`goalPursuit` is the subtlest: `detail` is printed into the character's own calendar as
`for: …`, and two sentences of third-person narration in that slot reads as a note somebody else
wrote about them.

### `memReconcile` — supersession, and three length rules at once

The **WHAT THIS STRETCH REVERSED** section was deleted, but the app still injects
`EARLIER STILL-LIVE DECISIONS … return its id in "supersedes"` into the user turn and still reads
`j.supersedes`. So the data arrives with no explanation of what to do with it, and characters go
on carrying two opposite standing decisions at once — decided on Tuesday not to go back, went
back on Wednesday, both read back as current. Restored, strictness clause included.

Separately, within four lines the prompt said "no more than 10 sentences", "a quiet hour is a
sentence … a short paragraph", and "if actions requires length give them the legth they deserve".
Three ceilings means the model splits the difference and length stops tracking what happened.
Collapsed into the one that scales, with the ceiling folded in. Typos fixed.

### `memBuild` — two rules worth more than they look

**Witnessed only.** The builder is handed a transcript containing other people's lines and
offstage narration. Without the rule it records them as this character's own memory, and every
engine downstream treats the bank as what that character *knows*. This is the cheapest possible
way to give someone knowledge they never earned, and it is invisible until they use it.

**Significance, not intensity.** The importance bands the edit introduced describe what a memory
*is*, but say nothing about what inflates the judgment. Without the anti-inflation clause the
heat of a scene drives the score, high-importance memories crowd out everything else in
retrieval, and the tenth time is as memorable as the first. Restored in your own band format.

Your rewrite of this prompt is otherwise the best thing in the export — the worked ❌/✅ examples
teach the register far better than the rules they replaced, and you fixed a real defect in the
shipped version, which showed Turkish example values under a prompt that demands English. I kept
them and added one line: the examples are built from your actual cast doing actual plot (the
kitchen counter, the cologne in Nil's hair, telling Burak), and a model short of material reaches
for the nearest concrete thing it has been shown. The line marks them as format, not fact.

### `rewritePrompt` — four rules the image layer depends on

Not style preferences; the contract with the rest of the pipeline.

- **No names, `Man`/`Woman`/`Girl`.** A name makes the generator draw whoever it thinks that name
  looks like, fighting the reference face the app attaches.
- **Every garment carries a colour.** This is what makes a wardrobe visible at all — bare garment
  words are why outfits render as generic clothing. Given your outfit complaints, restore this
  one first.
- **1–2 expression tags.** Past two, the generator honours none of them.
- **Ignore the auto-appended tail.** This one matters most. Style, quality, appearance, location
  and lighting are appended *after* your prompt, and the previous image prompt shown to the model
  as continuity already carries them. Without the rule the model copies them back in — and then
  they are appended a second time.

### `trackPrompt` — branching on mode names the app never sends

`trackerMethod()` only ever emits `"llm"` or `"trigger_then_day"`. Your version branches on
`"llm" or "both"` and on `"trigger"`. Neither matches, so **the leave-delta-at-0 rule can never
fire**: the model judges a delta for trackers the app is already moving by dice and per-day
count, and the value is driven from two sources at once. (This is the family your pregnancy
tracker belongs to.)

It also asked for an array keyed by a tracker `id` the model is never given — the app sends one
tracker per call and the ask names that one. The engine only reads the first element anyway.
Back to singular, with the real method names, keeping your leaner prose where it did not conflict.

### `daySummaryPrompt` — tags

Tagged only `["diary"]`, every entry looks identical to the ranker and none comes back for the
person or subject it was about. The tag guidance is restored; your longer, more expansive diary —
a deliberate register change — is untouched.

---

## P2 — one conflict worth resolving

### `x_outfits_generator`

"For Woman all clothes are sexy… For man all clothes are casual" is applied to every `byLoc` key,
so the same woman is dressed identically for a nightclub and a funeral, and it fights the app's
own area cues (`_outfitAreaActivity` maps gyms, pools and beds to the activity slots and expects
location outfits to suit their venue). The edit also removed the rule that made the place decide.

I kept your preference and put the room back under it: the taste is hers and constant, what she
can get away with changes with where she is. That is also what makes it read as a person rather
than a costume.

---

## Two app-side fixes, so this cannot happen silently again

Both are in `index.html`, tested, and on the branch.

**`_commitTextArc` now reads whatever sane shape comes back**, through the same
`_memReconcileList` helper the reconciler uses, and takes `importance` beside `importance_score`.
This is exactly the trap v56.1 fixed in the reconciler; the engine one door over still had it.
A future edit to that note can no longer kill text memories in silence.

**A Gamemaster that declines the turn is now heard.** Your `gmAuthor` rewrite adds a SKIP
path — and it is the right instinct: a monitor notices a stall but cannot tell a stall from a
silence that is doing work. The engine had no way to hear it, so `SKIP` was being **posted to
your story as a Narrator line**, and the Scene Writer then built an event out of it. A bare
refusal now ends the window quietly. Anything with real prose in it still plays, so
"Skip the rest of the evening; a car door closes below" is unaffected.

---

## What I deliberately left alone

- **`gmJudge`'s tension-trigger section, `gmAuthor`'s SKIP path, the longer diary, the explicit
  memory language, `vidPrompt`.** Coherent authorial decisions, several of them improvements.
  `vidPrompt` is now far more specific about what you want; it dropped the `{{seconds}}`/
  `{{blocks}}` time-block contract, which was one of the app's declared-but-never-supplied
  placeholders anyway, so nothing was lost mechanically.
- **`afterHeatPrompt` third person → second person.** This is a *correction*, not a regression —
  the decision is injected as `B.after_heat` into that character's own card. It now matches.
- **`trackerGen`'s public thresholds** (`publicAt` / `publicText` / `publicScope`). Removing them
  means new trackers never become known to anyone. Given what you said about the pregnancy
  tracker, I read this as deliberate and left it. Say the word and it comes back.
- **`x_appearance_generator`'s "leave blank" for `face_map`, `hair`, `face`, `body`.** Also
  deliberate-looking, but worth being sure: with all four blank, a generated character carries no
  appearance at all into the image layer. If your portraits have looked generic, this is why.
- **`queryGen`'s "Always in English Language".** Correct, and worth keeping — the memory bank is
  English on purpose and the query has to match it.
- **The 70 prompts identical to the shipped defaults.** Clean; nothing to say about them. (Four
  of those are prompts I restored fully, because the shipped text was already the right answer.)
- **`imgFrameGuide` and `imgPovGuide` are still stored empty**, which — as with `baseInstruction`
  — means the shipped defaults are what run. They are not blank in practice and there was nothing
  duplicating them, so I left them. If you actually want either one gone, it has to be a single
  space or a line of your own, not an empty box.

## Still open from before

- `charQuestStep` declares Turkish for `note`/`result` while `mixedLangDirective(["headline","event"])`
  forces English, and both show in the Quests modal. One of the two has to give.
- `gistBuild` / `poiGossip` keep their own seven-token observer emotion palette.
- The identical-`ms` timing symptom I could not reproduce.

## After you import

Three things will tell you within a session whether this landed:

1. **Text a character, let the thread end, open the Memory tab.** A memory should appear for it.
   Before the fix, none ever did.
2. **Play a day with gossip on.** Rumours should reach people who have a stake, and the
   uninvolved should stop turning up to confront you.
3. **Generate one character.** The sheet should come back in the second person and parse on the
   first attempt.
