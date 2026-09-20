# Debug trace, 20 Sep 08:17 — 19 calls, one turn

Özlem Özüçak, Day 5 / Evening, in Emre Tokmak's entrance foyer. Everything below is from this
trace; where I could not tell from it, I say so.

---

## 1 · Timing

| | |
|---|---|
| You waited for the reply | **16.2 s** (11.0 s of preamble, then 5.2 s of generation) |
| Background work carried on until | **83.4 s** |
| Total model time for one turn | **196.5 s** |

Three calls account for 152 s of that 196 s:

```
Drives & brakes · Özlem      37.9s    reasoning: high
Drives & brakes · Duygu      61.9s    reasoning: high   → returned nothing
Promises · purge pass        52.8s    reasoning: medium → deleted nothing
```

The purge is once per chat (`chat._prPurged`), so that 52.8 s is a one-off, not a per-turn cost.
The two drives calls are per present character, every time the situation moves.

**The cause is configuration, not code.** Your Memory & Daily Engines card has thinking on at
medium, and the Gamemaster card at high. Every engine in those buckets now thinks before it
answers, and these are structured-JSON jobs where that buys very little:

```
Tracker · Pregnancy   6.9s of thinking → {"delta": 0, "triggered": false}
Meetings tracker      1.4s             → {"new":[],"tasks":[]}
```

The routers you left alone show what the same work costs without it — presence tracker 1.2 s,
visual director 0.9 s. My honest recommendation: thinking **off** for Memory & Daily Engines,
and **low or off** for the Gamemaster. The one place it might genuinely pay is the drives writer,
and that one has a separate problem — see below.

---

## 2 · Three technical faults, all fixed on the branch

### The drives writer spent 62 seconds producing nothing, then cached the nothing

```
#16  Drives & brakes · Duygu Akbaba   61881 ms
     {"toward": "", "against": ""}
     [recovered after a thinking-only response — retried with thinking disabled
      and max_tokens=10500, first finish_reason=length]
```

It thought its way through the entire 3500-token cap, returned no text, the recovery call fired,
and that came back with two empty strings. Then `_writePsyche` stored them — and the record is
keyed by the **situation signature**:

```js
if(rec && rec.sig===sig) return;   // psycheRefreshIfStale
```

So the empty pair both wiped whatever was there before and stamped this situation as already
answered. Duygu carries no drives and no brakes, and nothing retries until the situation itself
moves. **Fixed:** an empty pair is no longer written; the previous record and its older signature
stay, so the next turn tries again, and it logs why.

**Also fixed:** the headroom thinking gets was a flat `+1200` regardless of effort, which is
about right for `low` and nowhere near enough for `high` — which is how a 3500-token call spent
all of it on thought. It now scales: 1200 / 2400 / 4800.

### Your own turn is stored with unbalanced quotes

The Auto-RP narrator returned this:

```
"Ne zaman baktım ben sonrasına?" *Bir adım atıyorum…* "Şu an önümüzde bir problem var…"
```

and what reached the transcript — message [20] of the reply payload — was the same line with its
**first and last quote marks stripped**. Every call site that handles story text ended with
`.replace(/^["']|["']$/g,"")`, meant to undo a model that wrapped its whole answer in quotes.
Right instinct, wrong test: in this app a turn very often *begins and ends* on dialogue, and
those quotes are the format. The player's turn then sits in the history with unbalanced quotes
and every character reads it that way on every later turn — and models imitate the punctuation
they are shown.

**Fixed** with a shared `unquoteWrap()`: a wrapping pair is only a wrapper when nothing inside it
uses the same mark. Applied to the narrator, the Gamemaster, the Scene Writer, the character-move
beats, the day-transition narration and the scene recap.

### The promise purge keeps arrangements that were over in the next minute

It ran, rewrote all seven entries, and deleted none:

```
you will apply sunscreen on Emre's back after he finishes with yours
you will keep your hand on the bar when spotting Duygu
you will call out to Emre when you need help with your form
```

The next minute, this set, this session. They survived because the KEEP test only asked whether
you could *name* the later moment — and "after he finishes with yours" names one perfectly well.
**Fixed:** a third test. The moment has to be able to arrive on another day, in a scene that has
not started, with the other person not there. Those three examples are named in the prompt as
DELETE, so the rule has a shape to match against. A refresh pipe carries it to your stored copy.

---

## 3 · The reply payload

Roughly 35 000 characters — a 19 k system message, ten turns of transcript, then your line and a
12.9 k trailing user block. Structurally it is doing what it should: the standing material up top,
the live material last, where recency gives it force.

The reply itself is good. It answers the actual line, stays inside the moment, and carries a real
position. Two small format drifts against your own `formatRules`: two narration spans where the
rule says one, and no `_thought_` at all in a turn where the rule says include one whenever what
she is saying is not what she means — which is exactly this turn.

### The payload speaks in three voices at once

You rewrote several block headings into the first person. The data under them did not follow:

| Heading | Body |
|---|---|
| `# WHO YOU ARE` — "what follows is you, remembered from the inside" | **third person**: "Özlem grew up… She works as an engineer… Özlem is sunny, warm" |
| `# MY PEOPLE` — "these are my established ties" | **second person**: "Berker is **your** husband… **your** sister-in-law" |
| `# THINGS I LEARNED ABOUT THESE PEOPLE` — "I know these things" | **second person**: "**you** have now twice crossed…" |
| `# LASTING / CONSIDERED VIEW (my settled opinion…)` | **third person**: "**She** has cut Emre off… bruises **her**" |
| `## MY GOALS` | first person ✓ — the one that matches |

Across the payload: 31 `YOU/YOUR` tokens against 78 `I/MY/ME`. Four consecutive headings switch
to "I" and then switch back. A model reading "what follows is you" immediately above "Özlem grew
up in a lively household" is being asked to hold three referents for one person.

This is fixable and it is worth fixing, but **pick one voice and make everything serve it.**
Second person is the cheaper choice because the app already generates its data that way — the ties
and the learned facts are already "you", and the audit I just shipped puts the settled view back
into "you" as well. If you prefer first person, three things have to move with the headings: the
character card's `personality` and `backstory` (this one is third person — it predates the fixed
card prompts, so regenerating or hand-editing that card would clear it), the relationship
description writer, and the ties block.

### The commitments block contradicts itself

```
# WHAT YOU SWORE — you are bound by this.
- to Emre Tokmak — you will not deceive Berker about the child's paternity

# JUST ENDED — a word broken in the last day or two is the loudest thing in any room:
- BROKEN: you — You will talk to Berker, sleep with him, and let him believe the child is his.
  (Özlem refused the plan, saying she will not pass off the child as Berker's.)
- BROKEN: you — You will return to Berker.
  (Özlem says she will not return to Berker and will stay with Emre.)
```

She is bound not to deceive Berker, and in the same block she is an oath-breaker for refusing to
deceive Berker. The same refusal is filed twice, once as her word kept and once as her word
broken. What happened is that Emre's **demand** was recorded as her promise, and then her refusal
was recorded as her breaking it — the exact case `promisePrompt` calls "a demand that was NOT
accepted". I have added a DELETE rule for it to the purge: when an entry's wording is the opposite
of what its `asked` line wanted, it is a decline filed as a word given, and it never stands beside
an entry saying the same thing the other way round.

The two rows already on your ledger are data, not prompt — they will clear when the purge next
runs against them, or you can delete them by hand.

### The standing blocks describe a position the scene has already broken

Her goals say *get Emre to stay away*; the settled view says *she has cut Emre off, washed his
traces from the bed*; the decision block says *you will go home to Berker*. She is standing in
Emre's entrance hall. None of the standing material acknowledges that, and the BROKEN row above
says the opposite again (*will stay with Emre*).

This is not a bug in any one engine — it is lag. The settled view is rewritten daily, the decision
when a reckoning fires, the goals at day's end, and the scene moved faster than all three. It is
worth knowing about because it is the main source of a character arguing from a position she no
longer holds, and the model is left to reconcile it unaided. If you want, the cheapest fix is to
let the drives writer see the decision and the settled view together and flag when the scene has
already overtaken one — it is the only per-turn engine that reads both.

---

## 4 · What is working

- **Reasoning scope.** The Auto-RP narrator runs with `{"enabled":false,"exclude":true}`, and so
  does the roleplay reply. That fix held.
- **The proactive-text gate.** Duygu's check returned `text:false` — *"they are in the same place
  and just parted; there is no pull and no natural reason"*. That is the same-place / just-left
  rule doing precisely its job.
- **The visual director** answered `0` on a talking beat, which is right, and on the 0/1 contract.
- **The memory arc** closed cleanly and the memory it wrote is good: first person, English,
  concrete, correctly located, with a real `feelings` line.
- **The query generator, presence tracker and meetings tracker** all answered correctly and fast.

## 5 · Worth a look, not fixed

- **`env.gmModel` reads `~deepseek/deepseek-v4-flash-latest`** — a leading tilde. The drives calls
  in this trace went to `deepseek-v4-pro-0813` instead, which means the GM model was changed
  between the turn (08:17) and the export (08:19). The memory calls did go out with the tilde and
  came back fine, so it is evidently accepted; I am flagging it only because it is not a shape the
  app puts there and a typo would be easy to miss.
- **The `why` field on the proactive text came back in Turkish.** It is an internal note and never
  reaches the player or the memory bank, so nothing is broken — but that prompt runs under the
  story-language directive, and a field that is purely an engine note is on the wrong side of it.
- **Three gym-session commitments are still on the ledger** (the spotting, the sunscreen, the
  form). These will clear on their own: the purge's once-per-chat marker was a bare `1`, so a chat
  audited under the old rules would have kept them forever — tightening the rules would have
  reached new chats and nothing else, which is the same trap the purge exists to escape. The
  marker carries a rule version now, so every existing chat gets exactly one more pass.
