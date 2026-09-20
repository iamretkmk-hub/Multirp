# Reply payload review — Özlem Özüçak, Day 5 / Evening

Scope as instructed: **how each agent works and how it prompts the service.** Nothing here
is a repair of an old card or an old memory.

The payload is 21.5 KB of system + 20 turns of history + a 14.7 KB tail. Structurally it is
sound: one voice, second person throughout, every section labelled, the language rule first,
the format rule second, the hard stops last. Four things were wrong.

---

## 1 · Two agents were writing English into a Turkish story — FIXED

**`gmAuthor`** was sent `engineLangDirective()`. That is the all-English rule, and it is
correct for engine *records* — memories, notes, reasons, the things fed back into a later
prompt. `gmAuthor`'s output is none of those. `playGamemasterBeat` posts it **verbatim as a
Narrator line in the story**. So the beat arrived in English:

> `[NARRATION — not spoken by anyone] A phone in Özlem's bag rang twice, then stopped.`

and then it *stayed in the transcript*. Message 4 of this payload is that line. From then on
every reply payload carries English narration among Turkish dialogue while its own first rule
says everything on the page is Turkish — the app contradicting itself with its own output.
Now `langDirective()`.

**`sceneWriter`'s `resolution` field** sat outside `mixedLangDirective(["narration"])`, so it
came back English too, and `resolveActiveEvent` prints it to the player as `— …—`. That is
message 7:

> `[NARRATION — not spoken by anyone] The phone rang twice and stopped, breaking the intimate tension…`

Now `mixedLangDirective(["narration","resolution"])`. The director log, the only other reader
of `resolution`, is consumed by the Gamemaster pair, which reads the story language fine.

The SKIP guard was widened with it: the beat is written in the story language now, so a model
declining may answer in that language. It still catches the English sentinels the prompt asks
for, plus any bare one-word answer — a Gamemaster *beat* is always a sentence.

## 2 · Three adjacent blocks, one pronoun, three different people — FIXED

The promises engine is told to write `promise` in the **second person addressed to the
holder** ("you will wait for her call"), and the purge pass rewrites anything else into that
form. That is right for `WHAT YOU SWORE`, where the reader *is* the holder.

The ledger then replays the same string verbatim into two blocks where the reader is not:

```
# WHAT WAS SWORN TO YOU — Özlem Özüçak was given this word…
- Emre Tokmak — you will wait for her call. (why: Özlem said she would call you…)

# JUST ENDED …
- BROKEN: you — You will return to Berker.
```

Read them in order. In `WHAT YOU SWORE`, "you" is Özlem. In `WHAT WAS SWORN TO YOU`, "you" is
Emre and Özlem is "her". In `JUST ENDED`, "you" is Özlem again. Three blocks, ~10 lines apart,
the pronoun pointing at the reader, then away, then back — in a payload whose whole design is
one second-person voice.

Re-pointing arbitrary prose is not something code can do reliably, and the holder's own block
is the one that matters most, so the engine's contract is unchanged. What changed: the two
blocks with a different reader now state, once, directly above the lines, whose voice they are
in. `promiseDirectorBlock` has the same defect for an omniscient reader and is **not** fixed —
its heading is prose living in code, and turning it into a fragment is a larger change than
this warrants. Flagging it.

## 3 · The tail granted the thought a shape and then banned it — FIXED

`# THE TWO PULLS` closed with:

> …Where it IS allowed to happen is your thought — **under the rules the guardrails give it.**

Those rules, in `rail_thought` and again in `rp_last_before` — the very last block before
generation — say:

> A thought that ends where it began — "I should go, but I won't" — … is forbidden.

The weighing *is* a thought that ends where it began. So the tail opened by sending the
id/superego into the thought and closed, 100 lines later and closest to generation, by
forbidding the only shape it could take there. Barred from speech, barred from the body, and
the thought shape forbidden: the psyche engine's output had nowhere to land.

`drive_ego` now names what the thought may carry — **one side, already chosen** — which is the
same thing `rail_thought` asks for ("the deciding, caught in motion; a line you draw with the
terms attached").

---

## Not fixed — yours to change, in your own boxes

**The stray `-` in FINAL GUARDRAILS.** Between "One reply, only in your own voice…" and
`## CONSISTENT KNOWN` there is a bare `-` on its own line. It is not in the shipped fragment —
your `FINAL GUARDRAILS` block is an override (the shipped one is the 25-section `rails_header`,
and `## CONSISTENT KNOWN` does not exist in this codebase). A lone bullet in the last block
before generation reads as an instruction whose text went missing. Delete the line.

**Placement — `JUST ENDED` is in the wrong half of the payload.** It calls itself "the loudest
thing in any room" and it sits at the **end of the system message**, ~15 KB before generation.
`# WHAT YOU DECIDED, AND ARE STILL STANDING BY` calls itself "not up for debate" and sits in
the **tail**, near the end. Position decides which one wins, and it is not the one claiming to
be live. In this payload they say opposite things (`JUST ENDED`: she refused to go back to
Berker · `WHAT YOU DECIDED`: "You will go home to Berker"), and the character will play the
stale one. Move `{{call//promise_ended}}` out of the system layout and into the tail, directly
above the decision block. That is a layout edit in your `payloadTemplates`, so I have not made
it for you.

**`WHAT WAS SWORN TO YOU` — your override dropped a clause.** The shipped default carries
*"Nothing here is a claim somebody made ABOUT you — if a line reads that way, it is not a word
you are owed and you owe it nothing."* Your version drops it. That clause is what stops a
declaration over a person being read as a promise owed. The new pronoun note is appended to
the shipped default, so it will not reach you either until you reset that fragment or paste the
sentence in.

---

## What is working

- Language rule first, format second, worked example inline, narration count stated — no
  ambiguity about shape.
- `YOU ALREADY SAID THESE` carries the last two turns in gist, not verbatim. Right call: gist
  cannot be copied back.
- `YOUR IMMEDIATE FEELINGS` names the axes and then the tension note, and the tension note
  earns itself ("this heat isn't backed by deeper feeling").
- `WHEN YOU RESIST` opens with its own gate, and the gate is written about the *line*, with
  `AN ASK IS NOT ONLY A SENTENCE` behind it. That pair is doing real work here.
- The trackers block renders one live condition and says "never name a number". Clean.
