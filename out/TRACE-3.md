# Third trace, 20 Sep 11:12 — two turns, 22 calls

Nine minutes after the last one, with a reload in between. That reload is what made the real find.

## The purge fix worked — and exposed a bigger bug

Your ledger went from **7 entries to 3**. Gone: the sunscreen, the bar-spotting and the
call-out-if-your-form-breaks arrangements — exactly the three the tightened rule names as DELETE —
plus the paternity pair. What survives is three genuine standing commitments, and this run
correctly deleted nothing more.

But it **ran at all**, twice in nine minutes, at 34.9 s and (last trace) 52.8 s. It is gated by
`chat._prPurged` and is supposed to run once per chat per rule version. Here is why it did not:

```js
// _slimChat, the function that decides what a chat keeps when it is saved
Object.keys(sc).forEach(k=>{if(k[0]==="_")delete sc[k];});
```

The underscore prefix meant two different things and only one was being served. A busy flag like
`_gmBusy` **must** die on reload — that strip is what stops a reload mid-beat dead-locking the
Gamemaster, and the comment says so. But the same prefix had quietly accumulated a second kind of
field: the durable *"this has already been done"* marker. Those were being thrown away with it.

Eleven of them, all re-firing on every single page load:

| Field | What it forgets |
|---|---|
| `_prPurged` | the ledger has been audited → **35–53 s of model time per reload**, and the survivors' wording is rewritten slightly differently each pass |
| `_cqTextDay`, `_cqApproachDay` | a character already raised their ask today → **they can raise it again after a reload** |
| `_afterHeatMid` | the last heat beat already reckoned with → the reckoning re-reads beats it has read |
| `_psyche` | the drives/brakes passages → every character's are recomputed from scratch |
| `_heatRanMid`, `_cqTextPeriod`, `_textTickPeriod`, `_presenceLastRun`, `_lastPlacementDay`, `_wpKey` | the rest of the once-per-day / once-per-period gates |

Fixed with an explicit list. The default for a new underscore field stays *transient*, so promoting
one is a decision somebody makes on purpose, and the busy flags are untouched. The purge also now
saves its marker even on a pass that rewrote nothing — otherwise a no-op pass left the gate open.
Five assertions pin both halves.

## Timing

| | |
|---|---|
| Two turns | **170.4 s** of model time, 47.2 s wall |
| Reply | 4.4 s |
| Drives & brakes | **51.1 s** |
| Promises & commitments | **35.1 s**, to return `{"new":[],"updates":[]}` |
| Promises purge | 34.9 s |

Those three are 121 of the 170 seconds, and all three have thinking on. The extractor spending
35 seconds of reasoning to conclude that nothing was promised is the clearest argument I can make
for turning thinking **off** on Memory & Daily Engines. The drives writer at 51 s is the other
one — it runs per character, per situation change, and it is now the most expensive thing in a turn.
It is also the call where thinking plausibly earns its keep, so that one is a real trade rather
than an obvious win.

Worth knowing: the headroom fix from v77.1 scales the token budget with the effort level, so
"medium" now gets more room than it used to. Better answers, longer calls. Turning the level down
is what shortens them.

## The two voice items are unchanged, because both are data

- **The card** is still `<backstory>I grew up in a lively, crowded household…` — first person under
  second-person labels.
- **The pursuit block** is still *"Özlem must get Emre to…"* beside *"never contact me again"*. My
  `charQuestGen` fix applies to quests generated from now on; this quest's `desc` and `ask` are
  already stored on the record, so it keeps them until the quest ends or you edit it.

Neither is reachable from a prompt pack. The offer stands: a one-pass repair that rewrites a
character's own fields — and, if you want, an existing quest's `desc`/`ask` — into the card voice,
leaving everything else alone. Say the word.

## Quality, unchanged and good

- **Drives**: *"The heat in your chest that did not want his hand to leave, the part of you that
  came here hoping to be seen again…"* Second person, specific, and it names the cost rather than
  the emotion.
- **The memory** is a `DECISION` at 0.6 with one short kept quote — better than the four-quote
  transcript last time, and the `feelings` line is doing real work: *"I've put the next move in my
  own hands, and I'm not sure I'll have the nerve to make it."*
- **The Gamemaster declined again**, correctly: *"A vulnerable emotional beat is landing — Özlem
  sets a boundary and exits; interrupting would break it."*
- **The reply had two narration spans and no thought**, which is the same missing-limit gap as
  last trace. Still in your layout's hands, not the pack's.
