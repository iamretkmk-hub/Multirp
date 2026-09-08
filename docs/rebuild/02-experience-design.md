# 02 · Experience Design

This document specifies what the player sees, touches, and waits for. It is the last document
before the specs become technical, and it is deliberately written from outside the code: an
implementer should be able to build the entire surface from here plus
[`03-visual-design-system.md`](03-visual-design-system.md), without knowing how a payload is
assembled.

## The experience thesis

**The story is the interface.** Everything else is an inspector.

One screen — the transcript — is where the player spends 95% of their time. It must be
uncluttered enough to read like a book and dense enough to expose scene state at a glance.
Every other screen exists to answer a question the transcript raised: *what does she actually
remember? why did he do that? where is everyone? what did the model actually get?*

That thesis has a sharp consequence the current build lives by and the rebuild keeps: **the app
never makes the player wait for something that isn't the reply.** Illustration, voicing, memory
building, relationship scoring, and the whole background simulation happen behind a reply that
is already on screen. The player's felt latency is the model's latency and nothing else.

## Information architecture

Seven top-level destinations, flat, always reachable from a persistent bar. No hierarchy, no
router, no back stack — the player is never lost because there is nowhere to be lost.

| Destination | Answers | Contains |
|---|---|---|
| **Story** | *What is happening?* | The transcript, the input bar, the scene header |
| **Universes** | *Who exists?* | Worlds → the cast inside a world → a character's hub |
| **Gallery** | *What has it looked like?* | Per-character image and video folders, scenes, playground |
| **Memory** | *What do they actually remember?* | The whole memory bank, filterable, editable |
| **Diary** | *What did they make of it?* | Per-character diaries as books |
| **Settings** | *How do I change it?* | Everything tunable in the system |
| **Debug** | *What really happened?* | Every call, with its assembled input |

**R-UX-1** — All seven destinations MUST be reachable in one action from any of the others.

**R-UX-2** — Navigation MUST NOT lose transcript position, scroll state, or a partially typed
input. Leaving the Story screen and returning is a free action.

> **Redesign — was:** Debug is a top-level destination in the current build, which is right, but
> it is *only* reachable from the nav. **Now:** every surface that can show a stale or
> surprising result — a reply, a generated image, a tracker that moved, an engine that ran —
> MUST offer a direct link into the debug entry that produced it. The distance between "that's
> wrong" and "here's why" is the app's most important measurement.

## The Story screen

The core surface. Three regions and an input bar.

### Scene header

Persistent, one line, tappable. Carries: who the scene is with, and the **scene stamp** — game
day, period, location, and sub-area. Tapping the stamp opens direct control of day, period, and
place; the player is never forced to roleplay their way into a time change.

**R-UX-3** — The scene stamp MUST always be visible while reading the transcript. Where the
scene is and when it is are the two facts every other system keys off, and a player who has
lost track of them cannot interpret anything else on screen.

### Transcript

A scrolling column of bubbles. Bubble kinds, all visually distinguishable at a glance without
reading:

| Kind | Is | Reads as |
|---|---|---|
| Player turn | The player's own line | The player's voice |
| Character reply | One character speaking | Their avatar, their name |
| Narrator beat | A world event, a quest step, an offstage encounter | Impersonal, set apart |
| Presence note | Someone arrived or left | A stage direction |
| Travel beat | A journey | A stage direction, and *the scene boundary* |
| Day marker | The day ended | A chapter break |
| Text message | A phone exchange | Explicitly not in the room |
| System error | Something failed | Plainly an app message, never a character |

**R-UX-4** — A system error MUST NOT be mistakable for a character's line, and MUST NOT be
mistakable for narration. Every failure the player sees names what failed and what to do.

**R-UX-5** — Reply text MUST render its three-part story markup — action, inner thought,
dialogue — as three visually distinct treatments. This is the format contract the model is held
to; if the reader cannot see the difference, neither the player nor the author can tell whether
the model obeyed it.

**R-UX-6** — The transcript MUST hold a bounded number of rendered turns, trimming from the top,
with older turns loaded on scroll. A months-long campaign cannot be a DOM.

#### The reveal

New character text arrives through a paced reveal rather than appearing at once, at a
user-configurable speed, and this is **display only**: the text has already been generated,
persisted, queued for illustration and voicing before the first character appears.

**R-UX-7** — The reveal MUST be a presentation queue that preserves order. In a multi-character
chain, lines land in the order they were generated, one finishing before the next begins.

**R-UX-8** — The reveal MUST be interruptible and skippable, and MUST NOT be a precondition for
anything. Nothing downstream may wait on it.

> **Parity — keep:** it is worth being explicit about why the reveal exists, because it looks
> like decoration. A multi-character chain generates two or three replies in quick succession;
> dumping them simultaneously destroys the sense that people are taking turns. The queue is
> pacing, not animation.

### Scene media

In portrait, images sit inline with the message that produced them. In landscape, the layout
becomes two columns — transcript left, a scene-image rail right — so a tablet or a turned phone
reads like an illustrated book rather than a wide chat.

**R-UX-9** — The landscape reading layout MUST be a pure presentation change driven by viewport,
with no separate mode, no toggle, and no state.

Each image carries its own actions: view full, animate, retry, view the prompt that made it,
change frame. **R-UX-10** — "View the prompt that made it" MUST be available on every generated
image and video. An image the player dislikes is a prompt they can fix.

### Input bar

Four controls and a field:

- **Modes** — a compact menu of six per-session toggles: open mic, speak replies, pause images,
  heat, auto-RP, do-not-disturb. These are *modes*, not settings: they change how the next few
  turns behave and the player flips them mid-scene.
- **Language** — the story language, changeable per turn.
- **The field** — auto-growing, multi-line.
- **Send.**

**R-UX-11** — Mode state MUST be visible without opening the menu. A player who has left the mic
on or images paused and cannot tell will file it as a bug in a different feature.

**R-UX-12** — Do-not-disturb MUST be per-chat and persistent; the other five modes are session
state. DND is a statement about this story ("stop directing me"), the rest are about right now.

### Chat menu

Everything scene-adjacent that isn't a mode, grouped by what it does:

- **Scene** — world map, move to area, who's nearby, set time and place, calendar (badged when
  something is due), clear the window, restart the scene.
- **Story** — call a character, messages (badged when unread), *nudge the story*, story state,
  the universe guide.
- **Go to** — the other destinations.

**R-UX-13** — "Nudge the story" MUST exist as an explicit player action. The Gamemaster is
otherwise invisible and cadence-gated; a bored player needs a lever, and giving them one is what
lets the automatic cadence stay conservative.

## The turn, as felt

The single most important sequence in the product. Specified here as experience; the mechanics
are in [`07-turn-pipeline.md`](07-turn-pipeline.md).

| Phase | The player sees | Constraint |
|---|---|---|
| Submit | Their line appears immediately | **R-UX-14** The player's own turn is never delayed by anything, including auto-RP |
| Rewriting *(auto-RP only)* | Input locked, an honest label | **R-UX-15** Any lock MUST say what it is waiting for and MUST time out to the raw input rather than trapping the player |
| Thinking | A per-character indicator in the transcript, in position | **R-UX-16** Waiting is shown where the reply will appear, never as a global spinner |
| Reveal | Text pacing in | Order preserved (R-UX-7) |
| Illustrating | A placeholder in the message's media slot, resolving to an image or an inline error | **R-UX-17** A failed image MUST leave a retry affordance in place, never vanish |
| Chain | The next character's indicator, after the previous line completes | |
| Settled | Scene stamp updated; badges updated | **R-UX-18** Background engines MUST NOT produce visible motion in the transcript unless they produced a *story event*, which is a bubble |

**R-UX-19** — At no point may the player be blocked from typing the next turn, except during the
auto-RP rewrite of the turn they just submitted.

## Cross-cutting flows

### First run

One panel, not a wizard. It asks for the minimum to play: a name, one API key, and it offers a
bundled starter universe. Everything else has a working default.

**R-UX-20** — First run MUST reach a playable first turn without the player making a single
irreversible choice. Every decision offered at onboarding MUST be changeable later in Settings.

### Ending the day

An explicit, confirmed player action — never automatic. It costs real money (a dozen or more
model calls), advances time irreversibly, and is the moment the world does most of its thinking.

**R-UX-21** — End Day MUST be confirmed, MUST state what it will do, and MUST show progress
while the pipeline runs.

**R-UX-22** — The pipeline MUST run in the background with the app usable. A player who closes
the app mid-pipeline MUST NOT lose the day: the visible day advance and its background work are
separately durable.

**R-UX-23** — When the pipeline finishes, anything it produced that the player should know about
— a new rumour, a text waiting, a plan for tomorrow, a diary written — MUST be discoverable
without hunting. Work the player cannot find did not happen.

### Managing the cast

Universes → a world → its cast → a character. A character's hub gathers everything bound to
them in one place: card, appearance, media, memories, diaries, relationships, quests, intents.

**R-UX-24** — Deleting a character MUST default to a soft removal that keeps their history
intact and makes them inert everywhere. Hard deletion MUST remain available, MUST be clearly
marked as destructive, and MUST state what it dangles.

### Diagnosing

**R-UX-25** — The debug surface MUST show, for every model call: what it was for, which model
and provider, the full assembled input broken into labelled blocks, the raw output, duration,
and an estimated token split between instructions and transcript.

**R-UX-26** — Local decisions that spend no network — memory retrieval ranking above all — MUST
be logged the same way. "Are my retrieval weights doing what I set?" is otherwise unanswerable.

**R-UX-27** — Debug export MUST redact credentials. Full backups MUST NOT be assumed redacted
and MUST be labelled as secrets wherever they are offered.

## Feedback and error surfaces

Three surfaces, and the choice between them is not stylistic:

| Surface | For | Rule |
|---|---|---|
| **Toast** | Transient, non-blocking, no action needed | **R-UX-28** MUST NOT be the only report of anything that changed stored data |
| **Inline in transcript** | A failure that affected *this turn* | Rendered as an error bubble (R-UX-4), never as story |
| **Debug entry** | Everything, always | **R-UX-29** Every model call and every engine outcome, including skips |

**R-UX-30** — Error text MUST say what failed, in the user's terms, and what they can do. A raw
status code or provider payload is a debug detail, not a message. Known provider conditions —
rate limits, credit exhaustion, a model declining, a browser-blocked endpoint — MUST each have
their own plain-language mapping.

> **Redesign — was:** a background engine that fails leaves no trace the user can find, so a
> feature that has stopped working looks identical to a feature with nothing to say. **Now:**
> every engine run records an outcome and its reason (R-UX-29), and the settings entry for a
> feature that has not produced anything in a long time SHOULD say so where the player will see
> it — next to its own toggle.

## Accessibility and comfort

**R-UX-31** — Global UI scale MUST be adjustable independently of the device setting. This app
is read for hours.

**R-UX-32** — Light and dark MUST both be complete, with a system-following default.

**R-UX-33** — Reading font and reveal speed MUST be user-controlled, and reveal MUST be
disableable entirely.

**R-UX-34** — Colour MUST NOT be the sole carrier of meaning. Bubble kinds are distinguished by
structure and typography as well as hue.

**R-UX-35** — Every interactive element MUST have an accessible name, and every icon-only
control MUST carry a label for assistive technology.

**R-UX-36** — Text input MUST NOT be zoom-trapped or scroll-trapped on mobile, and the composer
MUST remain visible above the keyboard.
