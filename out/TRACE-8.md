# Eighth trace, 20 Sep 13:57 — one agent fix, and a clean bill otherwise

Read for how the agents work and how they build their requests. Nothing here about legacy cards or
old memories.

## The health check first

Every payload in this trace was scanned for unfilled `{{placeholders}}` reaching the model: **none,
in any of the 24 requests.** Timings are where they should be — 137.8 s of model time, 51.5 s wall,
for two turns plus an image. Every memory engine is under 2 s except the arc builder. The narration
retry fired once and did its job.

## The one real finding: the drives writer was reading the Gamemaster's ledger

Its payload carried this, under a section labelled *"WHAT THEY HAVE GIVEN THEIR WORD TO"*:

```
WHAT THEY HAVE GIVEN THEIR WORD TO:
STANDING COMMITMENTS (open-ended words people are bound by — never write a beat that
contradicts one, and never quietly dissolve one …):
- Duygu Akbaba to Emre Tokmak: you will do what Emre tells you when he explains it verbally
- Duygu Akbaba to Emre Tokmak: you will not act aggressively when Emre gives you feedback
- Emre Tokmak to Özlem Özüçak: you will not say that Berker cannot have children
- Emre Tokmak to Özlem Özüçak: you will wait for her call
- Özlem Özüçak to Emre Tokmak: you will be there for him whenever he wants
```

`_writePsyche` was calling `promiseDirectorBlock(chat)` — which is the **Gamemaster's** view: every
open commitment in the world, unscoped. Three things wrong with it in this seat.

**It contradicted its own label.** The section says what *this character* has given her word to, and
two of the five entries are Duygu's private undertakings to Emre about accepting his gym feedback.
Özlem has no way to know those. This is the engine that writes her conscience, and a brake can be
built out of anything in front of it.

**It carried the director's voice into a character's payload.** *"never write a beat that
contradicts one"* is an instruction to a Gamemaster. The drives prompt's own VOICE section says
address the character as "you" and never mention the instructions — and the block arrived with two
stacked headings, the part separator and the director's own.

**It was the second-largest block in the payload** for a two-paragraph answer.

### Fixed

Scoped to this character and nobody else — what she has given, and what was given to her, both
directions. The section separator now says that, so the label and the contents agree.

One trap worth recording, because I walked into it: scoping to *both* names — the character and the
person she is with — does not work. `promiseContextForNames` matches either party, so passing Emre
would have let Duygu's promise to Emre straight back in through Emre. Both directions of **one**
name is what a conscience is. There is a test with exactly that case in it.

## Two costs, both understood, neither a bug

- **Drives & brakes, 44.2 s.** It is the only engine left with thinking on, and the payload is not
  why — 17 k characters in is about 4 k tokens, which is nothing. The time is reasoning plus the
  headroom the effort level buys. It runs off the critical path and its answer is used next turn,
  so it delays nothing you can see.
- **Memory arc tracker, 9.3 s** on the second call against 1.6 s on the first, with a near-identical
  payload. Provider variance; not worth chasing on one sample.

## Something I checked and it was fine

The arc tracker sends a 6.3 k system message and a 35-character user message, which looks broken
until you read it: the exchange is interpolated into the system text and the user turn is just
*"Judge the arc now. Return the JSON."* Working as designed. Worth noting because the prompt
reference lists `{{exchange}}` for this engine as declared-but-never-supplied, and that is now
wrong — it is supplied.
