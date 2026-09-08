# 13 · Settings, Backup & Migration

The operational surface: how a user changes the system, how they keep their data, and how a build
succeeds the one before it.

## The settings surface

Settings is not a preferences screen. It is **the control surface of an entire simulation**, and
in an app with no backend and no support channel it is also the repair tool
([principle 6](00-principles.md#6--nothing-hidden)).

**R-SET-1** — Every model selection, prompt, threshold, cadence, cap, weight, and toggle the
system uses MUST appear here. No behaviour may depend on a value that exists only in source.

**R-SET-2** — Settings MUST be organised by **what the user is trying to change**, not by
subsystem. The sections:

| Section | Holds |
|---|---|
| Credentials | Every provider key |
| Model selection | One selection per function, with fallback chains and per-function overrides |
| Payloads | The block editor, fragment editing, engine payload cards |
| Images | Provider, rules, routing, auto-illustration, styles, special-purpose models |
| Video | Model cards, rules, length, resolution, sound |
| Speech | Dub engine and voices, narration voice, mic behaviour, call tuning |
| World & play | Identity, flow, memory, living world, directors, characters, time, appearance |
| Data | Storage, install, export and import, snapshots, danger zone |

**R-SET-3** — Every setting MUST show its default and MUST be individually resettable to it.

**R-SET-4** — Every setting MUST state, in a sentence, what it changes — in play terms, not
implementation terms. "How often characters may text you first" beats "proactive text cadence".

**R-SET-5** — Settings that interact MUST say so at the point of the control. The memory
importance floor and the intent engine's reading threshold are the canonical example
(R-MEM-8) — and where the interaction can break a feature, it MUST be enforced, not merely
described (R-MEM-9).

**R-SET-6** — Cost-bearing settings MUST show their cost implication before the change is made
(R-SIM-52, R-WORLD-30).

### The round trip

**R-SET-7** — The settings surface MUST be **generated from the settings registry** (R-ARCH-6).
Adding a tunable adds a registry entry; the control, its persistence, its default, and its
validation follow from that entry.

> **Redesign — was:** two hand-maintained functions own the round trip — one writes state into
> the DOM, one reads the DOM back into state — and every input must be wired into both. The
> documented failure modes are exactly what you would predict: an input added but not read is
> silently never saved; an input removed but still read makes the read throw on a missing element
> and **settings stop saving for everyone**; a prompt registered without its persistence line
> shows edits that vanish on reload. Adding one persistent value currently means touching four
> places, and forgetting any of them fails differently. **Now:** R-SET-7. One declaration, and
> the failure modes above become structurally impossible rather than individually documented.

**R-SET-8** — A malformed or missing control MUST NOT be able to abort the persistence of
unrelated settings. Persistence is per-setting, not one all-or-nothing pass.

**R-SET-9** — Prompt and payload edits MUST save immediately on change, independently of any
global save action. They are edits to content, and a content editor that can lose work to a
forgotten button is broken.

**R-SET-10** — Changes MUST apply immediately where the effect is visible — theme, font, scale,
reveal speed — with no reload (R-VIS-20).

## Backup and portability

There is no server. **The user's export is the only copy of their world that survives a lost
device**, and the app must treat that with proportionate seriousness.

**R-SET-11** — Four export granularities MUST be supported, because they answer four different
questions:

| Set | Contains | For |
|---|---|---|
| **Everything** | All settings and credentials, all collections, all media | Device migration, disaster recovery |
| **Story** | One universe's chats, memories, cast, and world, self-contained | Sharing or archiving a campaign |
| **Worlds** | Universes and casts, no play history | Reusing a setting |
| **Prompts & settings** | Prompt overrides, payload layouts, fragments, related settings | Sharing a tuning; recovering from experimentation |

**R-SET-12** — The full export contains **credentials**. It MUST be labelled a secret at every
point it is offered, and the label MUST be as prominent as the button.

**R-SET-13** — The debug export MUST be credential-scrubbed and MUST be described as the safe one
to share (R-PROV-31). These two exports MUST be visually distinct; confusing them leaks keys.

**R-SET-14** — Import MUST validate before applying, MUST report what it will replace, and MUST
take a safety snapshot of current state first.

**R-SET-15** — Automatic rolling snapshots MUST be kept locally, bounded in number, taken after
changes and on backgrounding, and restorable — with the restore itself snapshotting first.

**R-SET-16** — Import of an export from an **older schema** MUST run the same migration path as
stored data (R-STATE-34). An export is a save file.

**R-SET-17** — The app SHOULD be able to import a backup produced by the **current pre-rebuild
build**, mapping its records into the new schemas — resolving names to ids once at import
(R-STATE-2), and recording what could not be resolved rather than guessing.

> This is the only concession the rebuild makes to the old data model, and it is deliberately an
> *import* problem rather than a schema constraint. Inheriting the old shapes to avoid writing an
> importer would trade a one-time cost for a permanent one.

### Danger zone

**R-SET-18** — Destructive operations MUST be grouped, marked with the danger role, and MUST each
name precisely what they remove and what they keep.

**R-SET-19** — A "reset this world" operation MUST be offered that clears **play** — memories,
diaries, relationships, feelings, intents, meetings, tracker values, quests, chronicle — while
keeping the **world**: the setting, the cast, the locations, and the transcripts.

> **Parity — keep:** this distinction is what makes a world reusable. Users build a universe over
> weeks and then want to start a fresh story in it. Without this they either keep a stale
> simulation or throw away the world.

## Versioning and release

**R-SET-20** — The build version MUST be visible in the app and MUST appear in every debug export.
A bug report without a version is unactionable.

**R-SET-21** — Every artifact that carries a version — the build stamp, the offline cache
identifier, any asset manifest — MUST derive from **one** source. Manual bumping of parallel
version stamps is a release-time failure that ships stale builds to installed users.

> **Redesign — was:** two version stamps, in two files, bumped by hand, with the standing warning
> that forgetting the cache bump leaves installed clients serving the old build offline —
> indefinitely, invisibly, and indistinguishably from "the fix didn't work". **Now:** R-SET-21.
> One source, derived everywhere.

**R-SET-22** — The offline cache MUST be network-first with cache fallback, MUST never cache
provider traffic, and MUST NOT be required for the app to function.

**R-SET-23** — Migrations MUST be listed with their outcomes in the debug surface (R-STATE-37), so
a user can see what a new build did to their data.

**R-SET-24** — The app MUST request persistent storage where the platform offers it, and MUST show
storage usage against the available budget. Eviction of a months-long campaign by a browser
reclaiming space is the worst failure this app has, and the user's only defence is knowing it is
coming.
