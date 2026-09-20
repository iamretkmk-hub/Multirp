# How the prompts connect

The ten grouped files describe each prompt alone. This file describes the chains: whose output becomes
whose input, and what breaks downstream when one of them is wrong.

Four clocks drive everything.

| Clock | Fires | What runs |
|---|---|---|
| **The turn** | every player message | routing → retrieval → the reply → the post-turn pass |
| **The period** | when the time of day advances | close the open memory arc, reconcile it, re-settle relationships |
| **The day** | End Day | diaries, daily relationships, the living world, the chronicle |
| **The scene** | an event being live | the Gamemaster and Scene Writer loop |

---

## 1 · The turn

```
player types
   │
   ├─ routerPlayer ─────────► who answers? (multi-character scenes only)
   │
   ├─ queryGen ──► embeddings ──► ranker ──────► the memories this turn gets
   │
   ├─ psychePrompt (async, not awaited) ───────► drives/brakes, used NEXT turn
   │
   ▼
THE REPLY PAYLOAD  ← baseInstruction, formatRules, narrationRules / heatRules,
   │                  the retrieved memories, the relationship blocks, drives,
   │                  private intent, after-heat, the response guidance
   ▼
the character speaks
   │
   ├─ voiceCheckPrompt ──────► does this sound like them? (flag only)
   ├─ visualDirector + routerPrompt + rewritePrompt ──► the picture
   ├─ memEval ───────────────► is the current arc finished?
   │      └─ if finished ──► memBuild ──► a memory in the bank
   ├─ calPrompt ─────────────► did they just agree to meet?
   ├─ promisePrompt ─────────► did anyone give their word?
   ├─ trackerPrompt ─────────► did any tracked value move?
   ├─ presencePrompt ────────► did anyone arrive or leave?
   └─ gmJudge ───────────────► is the scene going stale? → gmAuthor
```

**The dependency that matters:** `memEval` decides *when* an arc closes and `memBuild` writes what
it becomes. If `memEval` closes too rarely you get one over-compressed memory of a whole scene; too
often and you get a bank of fragments. Everything else in the app reasons from that bank.

`psychePrompt` is deliberately **not awaited** — a slow answer must not delay the reply. So its
output is always one turn behind, and it must read as a standing state rather than a reaction to
the line that just landed.

---

## 2 · The Gamemaster and a live scene

```
gmJudge  ─ "the scene has gone quiet" ─►  gmAuthor  ─ writes the arrival narration
                                               │
                                               ▼
                                          sceneSetup   ← classifies THAT narration
                                               │         (character | environment | offstage)
                                               │         and gives the event its SPINE:
                                               │         want / stake / escalation, and done-when
                                               ▼
                       ┌──────────────► sceneWriter ◄──────────────┐   once per player turn
                       │                     │                      │   until resolved
        confrontJudge ─┤                     ├─ charMovePrompt      │
        overtureJudge ─┘                     └─ sceneLangRetry ─────┘   (only on a foreign word)
```

- `sceneSetup` runs **once**; `sceneWriter` runs **every turn** of the event.
- The spine (`want` / `stake` / `escalation`) is set by the classifier and read by the writer on
  every subsequent turn. A vague `want` produces an event that drifts, and no amount of good
  writing in `sceneWriter` recovers it — **the classifier is the higher-leverage prompt of the two.**
- For a `confrontation` or an `overture`, the writer does **not** decide the ending: a judge scores
  the player's turn, conviction moves within bounds, and the threshold decides. The writer is told
  where conviction landed and must match its tone to it.
- `resolved: true` from the writer closes the event immediately, at any turn index.

---

## 3 · The emotional loop

This is the part with the most cross-talk, and the place where a contradiction is most visible to
the player.

```
what happens in a scene
        │
        ▼
    MEMORIES  ──────────────────────────────────┐
        │                                       │
        ├─ relShortPrompt  (every few exchanges)│  fast axes: desire, comfort,
        │      └─► moves the FAST axes          │  fear, agitation
        │                                       │
        └─ relPrompt  (end of day)              │  slow axes: trust, affection,
               └─► moves the SLOW axes  ◄───────┘  respect, familiarity, jealousy
                         │
                         ▼
                  the SETTLED VIEW  (relDescription / settledViewOf)
                         │
        ┌────────────────┼────────────────┬──────────────────┐
        ▼                ▼                ▼                  ▼
   feelings        feelings_now      psychePrompt       afterHeatPrompt
   (considered)    (the body now)    (drives/brakes)    (what she decided)
```

The governing rule, and the one worth preserving in any rewrite:

> **Everything that should change how a character sees someone goes through MEMORY**, because
> memory is what the daily evaluation reasons from. Nothing gets a second, direct writer on the
> slow axes.

So gossip plants a memory; an unkept meeting plants a memory; a post-intimacy decision plants a
memory. The axes move once, from one place, and every derived block agrees because they all read
the same settled view.

The blocks are ordered by **ascending authority** — the last thing read before the character speaks
is the state they are in *this second*, not their biography.

---

## 4 · End of day

```
End Day                                   (the day has ALREADY advanced in the foreground;
  │                                        every pass below is handed the day that ENDED)
  ├─ 1  flushMemoryArc ──────────► memBuild        close the still-open arc, stamped
  ├─ 2  reconcilePeriodFor ──────► memReconcile    collapse each period's fragments
  ├─ 3  runNeglectDrift            (code, no prompt — absence moves the axes)
  ├─ 4  reconcileCalendarDay ────► calReconcile    which planned meetings happened
  ├─ 5  plantUnkeptMeetingMemories (code — the ones that did NOT)
  ├─ 6  reconcileQuestsForDay ───► x_quest_reconcile
  ├─ 7  runDailyRelationships ───► relPrompt       the slow axes  (kicked here, awaited at 10)
  ├─ 8  writeDayDiaries ─────────► daySummaryPrompt
  ├─ 9  condenseDiaries ─────────► condensePrompt
  ├─ 10 reEvaluateRelationships ─► relGenPrompt    the factual sheet, for whoever MOVED
  ├─ 11 runGossipPropagation ────► gossipPrompt / poiGossip
  ├─ 12 maybeWorldPulse ─────────► offstageEvent / calExec / goalPursuit / contemplate
  ├─ 13 runCharQuestPursuit ─────► charQuestStep
  ├─ 14 runCharQuestSpawn ───────► charQuestGen
  ├─ 15 runIntentEngine ─────────► intentForm / intentTick
  ├─ 16 runGoalsCurator ─────────► goalsCurator
  └─ 17 runUniverseChronicler ───► chronicler      the world's own record of the day
```

**Order is load-bearing, and each of these constraints was a bug once:**

- **1 and 2 before everything.** The diaries, the relationship pass and the chronicle all read the
  day's memories; if the open arc has not been flushed and the periods not reconciled, they are
  written from an incomplete and un-collapsed day.
- **4 before 5.** The calendar reconcile marks what actually happened; planting the unkept-meeting
  memories first would record a meeting that *did* happen as missed.
- **13/14 before 16.** `goalsCurator` drops a goal when a settled event matches it, and a quest
  closing at 13 is what produces that settled event.
- **17 last.** The chronicle is the record of everything above, and it filters strictly on the day
  it was handed — a memory written after it runs does not reach it.

Everything from 11 down is the living world: it runs after the day is closed and its results are
what the player finds waiting the next morning.

---

## 5 · The quest loop, closed

```
charQuestGen  ── designs a pursuit ──►  done_when: an observable condition
      │                                       │
      │  (sees open_quests, so it does not    │
      │   start a second chase of one thing)  │
      ▼                                       ▼
charQuestStep  ── checks its narration against done_when ──► outcome: done
      │                                                            │
      │  or charQuestText, when the target is the player           ▼
      │                                              the quest closes
      │                                                            │
      └────────────────────────────────────────────────────────────┤
                                                                   ▼
                                                        a SETTLED EVENT
                                                                   │
                                                                   ▼
                                                    goalsCurator drops the goal
```

Quest → event → goal. The link that was missing for a long time was the *first* one: without a
checkable `done_when` the step engine judged "is it finished?" freehand, so the chain never started.

---

## 6 · Images

Five layers, concatenated in this order, and the later ones defer to the earlier:

```
rewritePrompt          the universal layer — what an image prompt is
  + imgFoundation      only when the routed rule has no OUTPUT STRUCTURE of its own
  + the rule's style   the scene-type block (Image Settings) — governs the frame
  + imgFrameGuide      this request: the continuity reference, the decided outfit
  + imgPovGuide        only for a POV rule: the lens is the player's own eyes
```

Before this: `visualDirector` decides whether a picture is wanted at all, and `routerPrompt` picks
which rule. After it: the location, the time-of-day lighting and the render style are **appended in
code**. A prompt that writes a place, a light or a style duplicates and contradicts what is already
coming.

---

## 7 · What to change first

Ranked by blast radius — how far a bad answer travels before anyone sees it.

| Rank | Prompt | Why |
|---|---|---|
| 1 | `memEval` + `memBuild` | every other engine reasons from the bank they fill |
| 2 | `relPrompt` / `relShortPrompt` | they move the numbers every emotional block derives from |
| 3 | `sceneSetup` | its spine shapes every later turn of the event |
| 4 | `memReconcile` | decides what survives of a whole stretch of the day |
| 5 | `goalsCurator` | rewrites what characters want; the GM and quest designer read it |

And separately, the ones whose quality the player feels **immediately**, where the bar is prose
rather than correctness: the reply fragments, `sceneWriter`'s narration, `charQuestText`,
`textProactivePrompt`, `daySummaryPrompt`.
