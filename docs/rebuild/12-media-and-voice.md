# 12 · Media & Voice

Embodiment — the fourth pillar. Scenes have a look, a place, and a voice.

Everything here is **enrichment**: it happens after the reply is on screen, it never blocks, and
every part of it can fail without costing the player the turn (R-TURN-1, R-TURN-28).

## Images

### Auto-illustration

**R-MEDIA-1** — At most **one** automatic image per turn, anchored to a character. Director beats
and scene narration deliberately do not self-illustrate.

**R-MEDIA-2** — Illustration MUST run in the background, MUST render a placeholder in the message's
media slot, and MUST resolve to an image or an inline error with a retry (R-UX-17).

**R-MEDIA-3** — The prompt that produced any image MUST be viewable from the image (R-UX-10). An
image the player dislikes is a prompt they can fix.

### Continuity

**R-MEDIA-4** — Visual continuity and sticky scene type MUST be keyed **per character**
(R-STATE-24).

> **Parity — keep:** global continuity was a shipped bug in which a newly arrived character
> inherited the previous speaker's pose and framing. It looks like a small mistake and reads, in
> play, as the app not knowing who anyone is.

**R-MEDIA-5** — A presence change MUST invalidate the affected character's continuity
(R-TURN-29). Someone who just walked in has no previous frame.

### Appearance injection

**R-MEDIA-6** — A character's appearance MUST be injected deterministically from their structured
appearance record, not re-described by a model each time.

**R-MEDIA-7** — Structured appearance MUST separate a coarse **subject** term from descriptive
prose, and the subject term MUST be used **only** for the image reference roster.

> **Parity — keep:** the subject term is what ties a picture to the person the scene text calls
> "the woman". It is deliberately kept out of the descriptive prose, because a scene description
> that opens by restating a category rather than a person produces generic imagery.

**R-MEDIA-8** — Reference imagery MUST be **one sheet per person**, and the scene prompt MUST
refer to people in the same terms the reference sheet uses. A roster the prompt does not speak the
language of is not used.

### Rules and routing

**R-MEDIA-9** — Image rules select a model, a style, and optional adapters for a kind of scene, and
MUST support per-rule provider selection (R-PROV-19).

**R-MEDIA-10** — Smart routing — choosing a rule for a scene by judgement — MUST be optional, and
its decision MUST be visible in the debug entry for the resulting image.

**R-MEDIA-11** — The style list MUST be user-editable, and styles MUST be referenced by **stable
id**, never by name (R-PRIN-3).

**R-MEDIA-12** — Edit-capable models MUST take their inputs by explicit per-field opt-in, not by
sending a shared request body and hoping the ignored fields are ignored.

## Video

**R-MEDIA-13** — There MUST be exactly **one** video request builder. Animate, extend, and scene
generation are parameter sets over it, not separate paths (the same rule as R-TURN-35, for the
same reason).

**R-MEDIA-14** — Every asset a video request references — a source frame, a reference image, a last
frame — MUST be hosted and resolvable **before** the request is sent, and a hosting failure MUST
fail the request loudly (R-PROV-21).

> **Redesign — was:** a frame upload that failed silently produced a request without it. The
> request succeeded and returned a plausible video that had simply ignored the conditioning — a
> quality regression with no error anywhere, which is the hardest kind of bug to notice and the
> easiest to blame on the model.

**R-MEDIA-15** — Extending a clip requires its last frame. Result extraction MUST tolerate the
documented shape variation in where a provider returns that frame, and MUST report clearly when it
cannot be found rather than silently starting from nothing.

**R-MEDIA-16** — Any setting that changes the request body MUST be committed **when it is toggled**,
not read at request time from a control that may not have been read back yet.

> **Redesign — was:** a settings toggle looked on and the request said nothing, because the value
> was only read into state by a save action the user had no reason to take. **Now:** R-MEDIA-16
> generalises to every control that affects an outbound request — this is a specific instance of
> the settings round-trip problem in [`13-settings-backup-migration.md`](13-settings-backup-migration.md).

**R-MEDIA-17** — Video rules are **shot setups** — framing, motion, and adapter selection over the
configured video model — not model selectors. A rule field the pipeline ignores MUST NOT be offered.

**R-MEDIA-18** — Video generation is long-running and MUST be modelled as a recoverable job
(R-PROV-20).

### Video cues

**R-MEDIA-19** — When a clip plays in the scene, what it showed MAY be injected into the next
turn's payload as something happening in front of the character, and MUST be rate-limited and
capped.

> **Parity — keep:** this closes the loop between media and story — the cast can answer what is
> playing. Without the cap it becomes the only thing anyone talks about.

## Scenes, gallery, playground

**R-MEDIA-20** — The gallery MUST organise media per character, and MUST keep clips referenced by a
curated scene exempt from eviction (R-STATE-16).

**R-MEDIA-21** — Scenes are curated sequences with their own playback surface.

**R-MEDIA-22** — The playground composes an image from parts — an actor, a location, a pose, a free
prompt — and is the app's authoring surface for imagery that is not tied to a message.

## Speech

### Dubbing

**R-MEDIA-23** — Spoken replies MUST be queued and strictly ordered (R-PROV-24).

**R-MEDIA-24** — Per-character voices MUST be supported, with a separate narration voice.

**R-MEDIA-25** — Narration-voice mode splits a reply: narration spans in the narrator's voice,
dialogue in the character's.

**R-MEDIA-26** — Delivery markup that one synthesis engine understands MUST be stripped for engines
that do not, and MUST never appear as visible text in the transcript (R-PROV-26).

**R-MEDIA-27** — Where delivery coaching is sent to a synthesis engine, it MUST be a payload block
like any other (R-PAY-1) — visible, reorderable, and editable.

### Open mic

**R-MEDIA-28** — Continuous microphone input MUST commit after a configurable silence, MUST flow
through the authoring path with the **verbatim rule** (R-TURN-6), and MUST hold a wake lock while
active.

**R-MEDIA-29** — The microphone session MUST NEVER be persisted or auto-resumed (R-PROV-28).

### Calls

**R-MEDIA-30** — A real-time call is: microphone → speech recognition → optional correction pass →
a reply from the call model, chunked by sentence → synthesis → playback with **barge-in**.

**R-MEDIA-31** — Call context MUST be bounded by a rolling summary rather than an unbounded
transcript (R-PROV-27).

**R-MEDIA-32** — A call MUST be committed to memory afterwards through the normal memory path. A
conversation the character does not remember having is worse than no call feature.

**R-MEDIA-33** — Calls MUST have their own diagnostic trail, exportable, because the failure modes
— endpointing, barge-in sensitivity, recognition errors, latency — are invisible in a text log.

## Storage and cost

**R-MEDIA-34** — Generated bytes MUST live in the media store, separate from the records that
reference them (R-STATE-15).

**R-MEDIA-35** — Eviction MUST be bounded, MUST prefer evicting large local bytes, and MUST NEVER
strip a remote reference — the remote reference is the durable, cheap form and removing it breaks
restore-on-reload (R-STATE-16).

**R-MEDIA-36** — Media generation is the app's largest per-action cost. Every automatic media
action MUST be individually disableable, and pausing images MUST be reachable as a **mode** from
the input bar without opening settings (R-UX-11).
