# Seventh trace, 20 Sep 13:06 — why three reloads changed nothing

## The card repair ran the old prompt for the third time. It was never a reload.

```
sharpened ask section live: False
possessive rule live      : False
```

**Saving settings was freezing the entire prompt catalogue.** In `saveSettings`:

```js
PROMPT_REGISTRY.forEach(r=>{ if(typeof state[r.key]==="string"&&K[r.key]) store.setRaw(K[r.key],state[r.key]); });
```

`state[key]` is loaded as `store.raw(key, <the shipped default>)`. So a prompt you had never
touched came back as the default, was written to storage **as though it were an edit**, and from
that moment `up()` returned that copy. The shipped text was shadowed for good, and every later
improvement to it stopped arriving.

That is why the last three rounds went the way they did. You pressed Save at some point on v82.0 —
changing a model, flipping the narration retry, anything — and `x_card_voice` froze at the v82.0
text. Reloading could not help: the stored copy always wins.

The proof is sitting in this same trace. `memBuild` **did** update, because when I shipped it in
v84.1 I also wrote two refresh pipes, and a pipe replaces a stored copy by matching a fingerprint
inside it. `x_card_voice` had no pipe, so it stayed frozen. Same build, same reload, opposite
outcomes — the difference is entirely whether someone remembered to write a pipe.

Your export told me this a week of messages ago and I read it wrong. 70 of your 104 stored prompts
were byte-identical to the shipped defaults; I called that "clean, nothing to say about them". They
were not clean, they were shadowing.

### The fix

A prompt identical to its shipped default is not an override, so it stops pretending to be one.
The stored key is removed, `up()` falls through to the default again, and future improvements
arrive on their own. An edited prompt is written back exactly as before.

It self-heals: your next **Save settings** clears every frozen copy in one pass. Measured on a real
page — 105 stored prompts before, 1 after, and that 1 was the deliberate edit.

The sweep had to move to the end of `saveSettings`, because the hand-written `store.setRaw` lines
below it write every prompt unconditionally and would have put back exactly what it removes. There
is a test for that ordering, because it is the kind of thing that gets undone by a later edit.

## The memory rule is live, and the shape moved

```
new memBuild live: True
```

> "I turned my phone face-down on the bag when Emre noticed it, and when he asked what I was hiding
> I said I hadn't looked. He caught the rest of it too… I told him not to ask me that, because if I
> said it out loud I wouldn't be able to look at his face on the way out of the door."
>
> feelings: "I stopped one sentence short of admitting it, and now the unsaid thing is standing in
> that foyer between us."

Better, not finished. Three sentences, each carrying a decision rather than a line of dialogue, and
it lands on what it cost. But the spine is still he-asked / I-said. I would give it a few more
turns before touching it again — the rule only reached the builder on this run, and one sample is
not a verdict.

## The narration retry

```
#6  Roleplay reply                   2 spans
#7  Roleplay reply (narration retry) 1 span
#16 Roleplay reply                   1 span   ← first try
```

\#16 is the first reply in seven traces to come back at one span without being asked twice.

## Timing

159 s of model time, 74 s wall, for two turns. Every memory engine is 2–5 s. Two things stand out:

- **Drives & brakes, 55.9 s** — the longest yet, and the only thing on the Gamemaster bucket in
  this trace. It runs per character per situation change.
- **Memory (arc), 21.2 s**, up from 4–9 s. That is my doing: the new builder is 1 600 characters
  longer. Worth it if the memories hold their shape; worth trimming the examples if not.
