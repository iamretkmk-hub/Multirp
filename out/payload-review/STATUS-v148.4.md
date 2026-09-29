# Payload-quality review: fix status (v148.4)

**What was reviewed.** A realistic two-day Turkish session in the user's Isdemir Lojmanları universe was played through the real code of v148.3, with the model stubbed out. The harness is at `/tmp/claude-0/payload-review/harness.js`. It captured every request: 1,080 calls across 57 engines. Five reviewers then read those requests the way the model receives them, looking for:
- the wrong point of view;
- leaks of private material;
- missing information;
- stale information or contradictions;
- wasted space;
- side effects of Retry.

Their reports are in this folder:
- `reply.md` — the characters' turns
- `image.md` — the image pipeline
- `player.md` — the player's side
- `memory.md` — memory and relationships
- `world.md` — the world and planning engines

| Area | Findings | Fixed in v148.4 | Left open |
|---|---|---|---|
| Character replies | 14 (4 High) | all 14, plus when a rumour's answer is judged | trimming the repeated FINAL GUARDRAILS rules (kept on purpose, v61.1); outfits for everyone in OTHERS PRESENT; the gm-reaction router prompt promises data it is never sent |
| Images | 11 (4 High) | all 11, plus no intimate scene types when a minor is in the frame | writing a look from a photo for characters who only have pictures; the scene stuck at the entrance sub-area (presence code) |
| Player side | 15 (4 High) | 13 | the cash hand-over lost after Retry (fixed by the memory batch) and whispered speech (fixed by the reply batch) |
| Memory and relationships | 14 (6 High) | 12 (the other two belong to the reply and world batches) | trimming the memory-builder examples beyond the rewrite |
| World and planning | 15 (3 High) | 15 | batching trackers into one call (the cue gate and earshot filter do the job) |

## Safety

1. **Shipped prompt examples used one user's real cast.** They included a 14-year-old in an example that implied something sexual. Every shipped example is now written with invented adults at invented places, and stored copies are repaired without losing the user's own edits. The test `memory-payload-quality` checks that no shipped text names that cast.
2. **A hard minor guard, `isMinorChar`.** A character under 18, going by the card, never gets:
   - intimate tracker calls, dice or ticks;
   - intimate lines in the director or GM view;
   - heat mode;
   - intimate image scene types;
   - explicit shot setups for a clip animated from a still;
   - a scene video without an explicit hard limit.

   The tracker editor also refuses to put an intimate tracker on a minor.

## Behaviour changes to know about
- **Narration privacy defaults to "seen".** Other characters' visible actions now cross to a character; thoughts never do. A stored "spoken" value is moved to "seen" once, because the old Settings select saved its displayed default on every save.
- **Whispers.** The first `*span*` and any quoted speech touching it are private as a whole, matching the documented `/whisper <name> *narration* "speech"` form. Other text in the same message is marked aloud.
- **Outfits stay on.** They hold between frames until the day changes, the person arrives or goes home, or they move to an activity place.
- **Relationship baselines.** A new pair is seeded from its tie word (spouse, kin, old friend…) instead of starting at 0.
- **The daily relationship read** makes one call per character, with one block per person, instead of one call per pair.
- **Retry** takes back tasks and status changes as well as new entries.

**Tests:** new files `img-payload-quality`, `player-payload-quality`, `reply-payload-quality`, `memory-payload-quality` and `world-payload-quality`, plus new checks in `scene-video`. The full suite on the combined build passes 129/129.
