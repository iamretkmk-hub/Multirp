# The prompts, in ten files

All 103 prompts StoryMind sends, grouped so each file can be worked on by itself. Every entry
carries its job, its mechanical contract, and **its current full text** — byte-exact from the
source, verified.

## Read these two first

| File | What it is |
|---|---|
| [`README.md`](README.md) | **The machinery.** Placeholders and their two scopes, sections that vanish when empty, output contracts, the three language directives, the ten model buckets, and refresh pipes — the only way a rewritten default reaches a user who has already edited it. Most ways to break a prompt here are ways of breaking one of these, and none is visible from the prompt text. |
| [`flows.md`](flows.md) | **How they connect.** The four clocks, the turn, the scene loop, the emotional loop, the seventeen-step end of day, the quest loop, the five image layers — and a ranking of what to change first by blast radius. |

## The ten

| File | Group | Prompts | Size | Why it matters |
|---|---|---|---|---|
| [`01-the-reply.md`](01-the-reply.md) | The reply itself — what the player reads | 9 | ~2k | the player reads this directly — prose quality matters more than correctness |
| [`02-turn-taking-and-texting.md`](02-turn-taking-and-texting.md) | Who speaks next, and the phone | 8 | ~5k | highest-frequency calls; a wrong answer is visible on the next line |
| [`03-memory.md`](03-memory.md) | Memory — writing it, judging it, keeping it | 9 | ~5k | **highest blast radius** — every other engine reasons from what these fill |
| [`04-relationships.md`](04-relationships.md) | Relationships and the emotional loop | 6 | ~8k | they move the numbers every emotional block is derived from |
| [`05-gamemaster-and-scenes.md`](05-gamemaster-and-scenes.md) | The Gamemaster and live scenes | 9 | ~8k | `sceneSetup`'s spine shapes every later turn of an event |
| [`06-the-living-world.md`](06-the-living-world.md) | The living world — what happens while you are elsewhere | 12 | ~7k | runs at day's end; the player meets the results next morning |
| [`07-quests.md`](07-quests.md) | Quests | 7 | ~4k | multi-day pursuits; the loop closes into the goals curator |
| [`08-calendar-promises-goals.md`](08-calendar-promises-goals.md) | Calendar, promises, trackers and goals | 11 | ~6k | detectors and reconcilers — honesty about what was kept |
| [`09-authoring-the-world.md`](09-authoring-the-world.md) | Authoring the world and the people in it | 18 | ~9k | runs a handful of times per universe and shapes all of it |
| [`10-images-video-and-voice.md`](10-images-video-and-voice.md) | Images, video and the voice call | 14 | ~5k | five layers in a fixed order; location and style are appended in code |

103 prompts, ~59k tokens of prompt text in total.

## Working through them

1. **Start with `README.md`.** A rewrite that ignores the placeholder scopes or the output
   contracts will look better and behave worse.
2. **Take one file at a time.** Each is self-contained; none needs another open.
3. **Order by blast radius, not by number.** `03-memory` and `04-relationships` feed every other
   engine — an error there compounds. `01-the-reply` is where quality is felt immediately.
4. **Keep the contract, change the prose.** The keys under **Returns**, the `{{placeholders}}` and
   the **Sections** are the app's interface with the prompt; the writing around them is free.
5. **Watch for the ⚠️ rows.** Where a prompt declares a placeholder nothing supplies, that is a live
   bug in the app, not something to fix in the prompt text.
