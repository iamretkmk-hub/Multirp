# Fifth trace, 20 Sep 12:24 — the settings change landed

**No code changes this round.** Two of the three things I was watching are fixed, the third was
never tested, and the remedy I promised for the fourth turns out to be wrong. Details below.

## What the settings change bought

Thinking is off for Memory & Daily Engines, and the tilde is gone from the model ids.

| | Before | Now |
|---|---|---|
| Promises & commitments | 141 773 ms | **15 681 ms** |
| Memory arc tracker | 12 067 ms | 2 174 ms |
| Meetings tracker | 14 783 ms | 1 085 ms |
| Memory (arc) | 15 203 ms | 9 128 ms |
| Total model time | 380 s | **192 s**, including 27 s of image generation |

**The purge did not run at all.** The durable marker is holding across reloads, and the in-flight
guard has not been needed since nothing double-fired.

The drives writer is now the single biggest cost — 40.1 s and 26.3 s, two calls, still on the
Gamemaster bucket at medium. That is the only bucket left with thinking on, and it is the one
where it plausibly earns its keep, so I am not pressing it further.

## The card repair ran the OLD prompt

The `ask` came back byte-for-byte unchanged again, and `desc` kept "carry their night to the
grave". **This is not the fix failing — you had not reloaded.** I checked the system message that
was actually sent:

```
read this twice                                 ABSENT
STATEMENT OF WHAT YOU WANT                      ABSENT
byte-for-byte as you received it is a failure   ABSENT
A POSSESSIVE THAT COVERED TWO PEOPLE            ABSENT
```

That is the pre-v82.1 text. The sharpened section, and the toast that flags a skipped ask, both
shipped after this run. Reload onto v83.0 and press **Fix the voice** once more — and this time
the button will tell you if the ask still comes back untouched, instead of reporting a clean
success.

Everything else the repair did in the earlier run is holding: the card is second person, the ten
trait lines kept their labels and order, and Berker is still in the third person.

## The narration cap — I was wrong about the remedy

Three replies this trace: **2, 2 and 3** narrated spans, no thoughts, with the cap plainly in the
payload. I said that if it stayed at two I would stop asking and strip the second span in code.
That was wrong on two counts.

**First, the machinery already exists.** `overNarrated()` measures spans and the narration/speech
word balance, and `overNarratedNote()` sends the reply back with its own numbers quoted and an
instruction to keep the spoken lines. It is gated behind two settings:

```js
function narrRetryOn(){ return state.narrRetryOn===true; }   // OFF unless you switch it on
const cap=Math.max(1,+state.narrMaxSpans||3);                // default 3
```

Both defaults are why nothing fired — including on the three-span reply, which would have
tripped the cap had the retry been on. **Switch on the narration retry and set max spans to 2.**
It costs one extra call on an offending turn, which is why it is opt-in.

**Second, stripping would have made the replies worse.** Look at what the second span actually is:

> *Sırtım hâlâ kapıda, kollarım çözülüp iki yanıma düşüyor…* "Gitmek istemiyoruz, evet."
> *Bir an duraksıyorum, bakışlarım yere kayıyor, sonra tekrar ona dönüyor.* "Ama kalmak da
> istemiyoruz…" *Hafifçe gülümsüyorum, yorgun.* "Kimse açmıyor."

The extra spans are short connective beats between spoken lines — a pause, a glance, a tired
smile — not scene-setting. Deleting the last one to satisfy a count would cut the best thing in
the turn. A mechanical strip has no way to tell those from padding; the retry, which quotes the
numbers back and asks the model to choose, does.

One inconsistency worth knowing about either way: shipped `rp_format` now says "at most ONE
narration", while `narrMaxSpans` defaults to 3. The prompt asks for one and the enforcement
tolerates three. Say the word and I will align them.

## Not a bug: the repeat retry

```
#6  Roleplay reply                 3 685 ms
#7  Roleplay reply (repeat retry)  4 807 ms
```

The retry kept the dialogue word for word and rewrote the narration, which looks wrong until you
see which half was flagged. `repeatKind` fired on **narration** similarity, and
`repeatRetryNote("narration", …)` says: *"Same body, same gesture… Write the turn again with
COMPLETELY different action. Keep whatever the turn was going to SAY."* That is exactly what came
back. Working as designed.

## Quality

- **Drives**: *"You want to stay in the doorway a little longer, to let him keep looking at you the
  way he is and postpone opening the door, because being seen like this is the thing you have been
  going without."* Second person, specific, naming the want rather than the feeling.
- **Image prompt**: `Woman facing the viewer` — no names, colour on every garment, nothing copied
  from the auto tail.
- **The memory** is again close to a reconstruction of the exchange rather than what it left her.
  Within your 2–4 sentence rule and accurate, but it is the third trace running where the memory
  reads as the conversation rather than its residue. Worth a look at `memBuild` if you want the
  bank to hold consequences rather than minutes.
