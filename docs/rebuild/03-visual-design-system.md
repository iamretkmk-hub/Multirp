# 03 · Visual Design System

The app is read for hours at a time, in the dark, on a phone, by one person. That single fact
sets every decision below. This is a **reading** interface with an inspector attached, not a
dashboard with a chat in it.

## Design stance

**Recede, then be precise.** Chrome is quiet to the point of near-invisibility on the Story
screen so the prose carries; everywhere else — Settings, Debug, editors — density and labelling
matter more than calm, because those screens exist to answer questions, not to be dwelt in.

Three rules follow, and they resolve most arguments:

1. **The transcript owns the contrast budget.** Story text is the highest-contrast element on
   the Story screen. Nothing competes with it — not the header, not the nav, not a button.
2. **Structure before colour.** Every meaningful distinction is carried by layout, weight, and
   shape first, with colour as reinforcement. This is an accessibility requirement (R-UX-34) and
   also survives the OLED-dark, low-brightness, outdoors-at-noon range this app actually gets
   read in.
3. **One accent.** A single accent hue marks *the thing you act on*. A second accent for
   emphasis is how a UI becomes a carnival; danger is the one exception, and it is a state, not
   a flavour.

## Tokens

Everything visual is a token. **R-VIS-1 — No literal colour, size, radius, or duration may
appear outside the token definitions.** A component that needs a value the tokens do not have
either uses the nearest one or the token set gains a member — it never inlines.

### Colour roles

Roles, not values. Each is defined once per theme.

| Token | Role | Notes |
|---|---|---|
| `bg` | The page ground | Deepest surface; the ground the app sits on |
| `surface` | Raised regions — header, nav, sheets | |
| `card` | Discrete objects — bubbles, cards, rows | |
| `border` | Separation | Low contrast; separation is mostly spacing |
| `text` | Primary reading text | Carries the contrast budget |
| `muted` | Secondary text — metadata, stamps, hints | MUST remain ≥ 4.5:1 on its own ground |
| `accent` | Interactive and identifying | Exactly one hue |
| `accent-contrast` | Text on accent | |
| `danger` | Destructive actions and error states | |
| `success` | Confirmed / completed | Used sparingly; mostly for state, never decoration |
| `overlay` | Scrim behind modals | |

> **Parity — keep:** the current app's identity is a near-black ground with a warm violet cast
> and a single pink accent. That is a good, distinctive choice for a night-reading app and the
> rebuild keeps the *shape* of it: a deep, slightly chromatic dark ground rather than neutral
> grey, and one saturated accent. Exact values are an implementation choice; the constraints on
> them are below.

**R-VIS-2** — Body text MUST meet 7:1 against its ground in the default theme and 4.5:1 in
every theme. Metadata and muted text MUST meet 4.5:1. These are checked, not eyeballed.

**R-VIS-3** — The dark theme's ground MUST NOT be pure black and the light theme's MUST NOT be
pure white. Both cause halation against long-form text at the brightness this app is read at.

**R-VIS-4** — The accent hue MUST NOT be used for non-interactive decoration. If it appears, it
can be pressed or it identifies the currently active thing.

### Type

Two families and a third for one specific place:

| Role | Family | Use |
|---|---|---|
| Interface | System UI stack | All chrome, settings, labels, metadata |
| Reading | User-selectable serif or sans | Transcript body only |
| Hand | Handwriting faces | Diary reader only |

**R-VIS-5** — The reading family MUST be user-selectable independently of the interface family,
and the choice MUST apply to the transcript and diary body only. A user who wants a serif to
read in does not want a serif on a settings row.

**R-VIS-6** — The handwriting faces MUST degrade to a system cursive without layout shift. They
are loaded from a network font service; the diary MUST be fully readable offline.

**R-VIS-7** — A type scale MUST be defined as tokens and MUST scale as a unit with the global UI
scale (R-UX-31). Scaling MUST NOT be implemented by zooming a raster or by transforming a
container in a way that blurs text.

Size roles: `display` (screen titles), `title` (card and section headings), `body` (reading),
`meta` (stamps, timestamps, counts), `mono` (debug payloads, ids, prompt text).

**R-VIS-8** — Debug payload text, prompt editors, and any place a user reads or edits model
input MUST use the monospace role. Whitespace in a prompt is semantic.

### Space, radius, motion

**R-VIS-9** — Spacing MUST come from a fixed scale. Vertical rhythm in the transcript is the
scale's primary consumer; bubbles are separated by space, not by rules or borders.

**R-VIS-10** — Radius tokens: one for small controls, one for cards and bubbles, one for
sheets. No element invents its own.

**R-VIS-11** — Motion tokens define duration and easing for exactly three things: state change
on a control, a sheet or modal entering and leaving, and the transcript reveal. Nothing else
animates.

**R-VIS-12** — All motion MUST respect the platform's reduced-motion preference. Under reduced
motion, sheets appear without transition and the transcript reveal is disabled — the text
appears complete.

## Iconography

**R-VIS-13 — Interface icons MUST be drawn from one inline vector sprite set with a shared
stroke weight, size, and optical grid. Interface chrome MUST NOT use emoji.**

**R-VIS-14 — Emoji entered by the user as a character or universe avatar are *data* and MUST be
rendered as the user typed them, never substituted, normalised, or converted to an icon.**

> **Parity — keep:** this pair of rules is stated emphatically in the current source, and the
> reason is worth preserving. The app has a helper that converts stray emoji in *system* strings
> into line icons, so that a hastily written label doesn't break the visual language. Applying
> that helper to an avatar would silently rewrite the user's character. The two are different
> categories that happen to be the same characters, and only intent separates them — so intent
> is encoded at the container: avatar emoji live in a dedicated presentation container and never
> pass through the conversion path.

**R-VIS-15** — Every icon MUST have a stable id and an accessible label. An icon-only control
without a label is incomplete (R-UX-35).

## Component inventory

The complete set. **R-VIS-16 — A new UI need is met by an existing component or by adding one
here. Ad-hoc styling at a call site is a defect.**

### Structural

- **Screen** — a top-level destination. One is active at a time.
- **Nav bar** — persistent, seven destinations, marks the active one.
- **Header** — screen title or scene stamp, plus at most two actions.
- **Section group** — a collapsible titled region. The unit Settings is built from.
- **Card** — a titled, bordered object with optional description text. The unit of everything
  inside a section group.
- **Sheet / modal** — a focused editor or picker over a scrim, dismissible, with an explicit
  close.

### Story-specific

- **Bubble** — one transcript entry. Variants per the kind table in
  [`02-experience-design.md`](02-experience-design.md).
- **Status strip** — the day · period · location stamp attached to a bubble.
- **Media block** — an image or video inside a bubble, with its own action menu and its own
  loading, error, and retry states.
- **Image rail** — the landscape-only scene column.
- **Presence / day / travel markers** — the three stage-direction treatments.

### Controls

- **Button** — primary, secondary, danger; one size modifier; an icon-button form for the input
  bar.
- **Toggle** — a switch with a label.
- **Segmented picker** — 2–5 mutually exclusive options, one visibly selected.
- **Field** — text, number, and the auto-growing multi-line composer.
- **Slider** — bounded numeric with its value always displayed as a number.
- **Menu** — an anchored list of actions, used by the chat menu, the modes menu, and per-item
  overflow.
- **Badge** — a count or state marker on a nav item or menu row.
- **Chip** — a compact avatar-and-name element.

### Feedback

- **Toast** — transient, bottom, non-blocking.
- **Inline error** — inside the surface that failed, with a retry where retrying is meaningful.
- **Empty state** — every list that can be empty has one, and it says what would fill it.
- **Progress** — determinate where a count is known (the End Day pipeline), indeterminate
  otherwise, always labelled with what is running.

**R-VIS-17** — Every list, gallery, and browser MUST have a designed empty state. "No memories
yet" with a sentence about what creates memories is a feature; a blank region is a bug report.

**R-VIS-18** — Every destructive control MUST use the danger role and MUST require a confirmation
that names what will be lost.

## Theming

**R-VIS-19** — Themes are complete token sets: light, dark, and follow-system. A theme MUST NOT
be a filter, an inversion, or a partial override.

**R-VIS-20** — Theme, reading font, reveal speed, and UI scale MUST apply immediately on change,
with no reload and no flash of the previous theme on startup.

**R-VIS-21** — User-supplied imagery — location backgrounds, universe covers, generated scene
images — MUST NOT be assumed to suit either theme. Anything overlaid on user imagery carries its
own ground; text is never placed directly on an arbitrary image.

## Layout

**R-VIS-22** — Two layouts, chosen by viewport, not by setting: a single column with a bottom
nav, and a two-column reading layout with the transcript left and the scene rail right. The
switch is CSS-level and stateless (R-UX-9).

**R-VIS-23** — The reading column MUST have a maximum measure. On a wide screen the transcript
does not stretch to fill; it centres and the rail takes the remainder.

**R-VIS-24** — The composer MUST remain visible and reachable above the on-screen keyboard, and
the transcript MUST remain scrolled to the point of interest when the keyboard opens and closes.

**R-VIS-25** — Scroll position MUST be pinned to the bottom while the player is at the bottom,
and MUST NOT be yanked there when they have scrolled up to read. New content arriving while the
player is reading history is announced with a control that returns them to the present — never
by moving them.

## The debug aesthetic

An explicit exception, worth stating because it will otherwise be "cleaned up".

The Debug screen is a **document viewer**, not a styled surface. It shows the assembled model
input broken into labelled capsules, monospaced, with whitespace preserved, in reading order,
newest first. It is dense on purpose.

**R-VIS-26** — Debug content MUST be presented at full fidelity: no truncation without an
expand, no reflowing of prompt whitespace, no prettifying that changes what was sent. What the
model got is what the screen shows.

**R-VIS-27** — Credentials MUST be redacted in the debug view and in its export, and the
redaction MUST be visible as a redaction rather than as absence.
