# Payload templates — the hand-written set

All five reply payload templates, written by hand in
**Settings › Payloads › Write my own payload structure**. Kept here so they survive a
device wipe, a storage reset, or a mis-tapped "Reset fragments" — `state.payloadTemplates`
lives only in that browser's localStorage, and an export is the only other copy.

The templates themselves are the five files in `docs/payload-templates/`:
`solo.txt`, `multi.txt`, `gm.txt`, `text.txt`, `heat.txt`. Paste each into the matching
box in the editor.

Validated on build v39.3 — per template: 0 unknown calls, 0 duplicate calls, 0 `{{gap}}`,
2 role markers, 1 history line, and every hand-written section survives an expansion in
which every call resolves empty.

## (!) Why there are no `{{gap}}` lines

`ptExpand` drops a whole **paragraph** — everything between two blank lines — when that
paragraph contains calls and *all* of them come back empty:

```js
if(anyCall && !anyFilled) return;   // AUTO-DROP the whole paragraph
```

`{{gap}}` is a blank line that deliberately does **not** break the paragraph. That is right
for a block's own heading (it should vanish with its content) and **wrong for hand-written
prose**, which then dies with whatever call it was sitting next to.

The first revision of these templates used `{{gap}}` throughout. Measured against `ptExpand`
with `world` empty, that cost it `You are {{char}}`, the whole `# TASK`, and the entire
behaviour section — every turn. Rule: **blank line between independent sections, `{{gap}}`
only inside one conditional piece.**

## (!) Why `text` and `heat` must NOT carry the three-channels format

`buildPayload` resolves the `format` block differently per kind:

| kind | what `format` becomes |
|---|---|
| text | the `text_format` fragment, *wholesale* — typed words only, no narration, no asterisks, no thoughts |
| heat | the `heat_format` fragment, *wholesale* — the standard rules are deliberately not sent |
| everything else | the `formatRules` prompt, plus `narr_shape` when narration mode is on |

A template that hand-writes "THE THREE CHANNELS" replaces `formatRules`, which is correct
for solo/multi/gm. Pasting that same section into **text** would ask for `*narration*` inside
an SMS; pasting it into **heat** re-creates exactly the bug v27.1 fixed — *"sending both is
what made the model repeat the narration→speech→thoughts template N times instead of writing
one long dialogue-driven continuation."*

So `text.txt` and `heat.txt` call `{{call//format//full}}` instead, and the app supplies the
right one. To own that wording, edit the `text_format` / `heat_format` fragments rather than
the template.

## What each template adds over `solo`

| template | difference |
|---|---|
| `solo` | the baseline. No `others_present` (one character is present by definition). |
| `multi` | `+ others_present`, and a section saying you are one voice in a room — write only your own line, a short line is a complete turn. |
| `gm` | `+ others_present`, and a section saying you are reacting to a turn of the world, not to a line of dialogue: you do not know it was arranged and you do not treat it as a cue. |
| `text` | `{{call//format//full}}` instead of the channels; a typing-specific speaking guide (length, punctuation, what you leave out) instead of the spoken one; no `others_present`; no `spoken_delivery`. |
| `heat` | `{{call//format//full}}` instead of the channels; a section saying this is one beat in a run already moving — do not re-establish, do not recap, carry it one step further. |

## What changed from the original hand-written solo template

- **Every `{{gap}}` became a blank line** (see above).
- **The doctrine moved to the second system block.** `WARMTH IS EARNED`, `YOU DO NOT FOLD`,
  `YOU DO NOT SHATTER` and the serious-events rule used to sit ~600 words into the first
  message, above the bio, the memories and the whole transcript. They now sit after
  `feelings_now`/`drives` and before `response_guidance` — the position the codebase already
  identified as the one that governs the line (the v28.3 note on moving play notes into
  `speaking_style`).
- **`drives` is now called.** The id/superego block — "THE TWO THINGS PULLING AT YOU RIGHT
  NOW" — is the machinery that produces the friction the FOLD/SHATTER prose asks for. The
  original described the behaviour without sending it.
- **`others_present` and `calendar_done` added** where they apply.
- **New section: "You are not your wound."** A character's damage is a pattern across months,
  not a mood they are in during every conversation. The prose half of the Default rule added
  to the character generators in v39.1.
- **Speaking guidance moved down** beside `{{call//speaking_style//full}}` and extended from
  four emotions to seven — shame, jealousy and rejection added, matching the ten-state trait
  profile.
- **The THOUGHT section folded into its channel bullet.** Sixty words arguing for something
  labelled "rare" reads as an important section; length is a signal.
- **Trimmed, not cut:** the generic half of the behaviour list compressed (a model does small
  talk and ordinary moments unprompted); the counter-default half — not a mirror, warmth is
  earned, resistance may never soften — kept and sharpened.

## Check `style_header` and `rail_beat`

The shipped `style_header` is a short handover ("Everything else told you what you know. This
tells you how it comes out of your mouth…"), which does not collide with anything here. But the
copy in the 2026-09-11 export was a 1042-character rewrite carrying the same anger / fear /
grief / guilt list these templates carry under `# EMOTION SHOWS IN THE SPEAKING`. If that
override is still in `state.blockTpls`, the list reaches the model twice per turn.

Same check for `rail_beat` in `final_guardrails`: it carries the one-body-beat rule that
`## LIMITS` also states.
