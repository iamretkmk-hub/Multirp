# 05 · State & Data Model

The durable shape of everything the app remembers. Schemas here are **contracts**, in the sense
of [principle 2](00-principles.md#2--contracts-are-declared-not-remembered): declared as data,
validated on read and write, and versioned.

## Identity

**R-STATE-1** — Every entity MUST carry an opaque, generated, permanent id. Ids MUST NOT encode
a name, a type that could change, an ordinal, or a timestamp that anything reads.

**R-STATE-2** — Every reference between durable records MUST be by id. **No durable record may
store a name where it means an entity.** This applies without exception to memories, witness
lists, relationship records, calendar entries, promises, quests, intents, gossip, and world
positions.

**R-STATE-3** — Every entity MUST carry a display label that is freely editable with no
migration and no data loss.

> **Redesign — was:** memories match people by name, relationship prose embeds names, presence
> notes are parsed from text, and legacy witness lists are names — so renaming a character
> fractures five systems and the documented advice is *don't*. **Now:** R-STATE-2. Renaming is a
> label edit. Names are resolved at render and at prompt-assembly time, never stored as
> references.

**R-STATE-4** — An unresolvable reference MUST resolve to **absence**, not to a placeholder
string. A resolver MUST NOT return a human-readable token like `"(unknown)"` to a caller that
may embed it in text.

> **Redesign — was:** the display-name resolver answers the literal string `"(unknown)"` for a
> deleted id. That is correct on a settings badge and poison in a prompt — it hands the model a
> nameless person to invent — and because it is truthy, every `if (!who)` guard sails past it.
> The current fix is a second resolver that returns empty for payload-facing code, plus the
> discipline to remember which one you are in. **Now:** resolution returns absence, and the *UI*
> is responsible for rendering absence as "(unknown)" at the point of display. There is one
> resolver and no way to leak a sentinel into text.

## Storage tiers

Two tiers, chosen by size and access pattern, and neither is addressed directly.

| Tier | Holds | Why |
|---|---|---|
| **Small synchronous store** | Settings, prompt overrides, credentials, toggles, thresholds, UI preferences | Small scalars read at boot; a few megabytes at most |
| **Large asynchronous store** | Chats, memories, universes, characters, ledgers, media bytes, snapshots | Unbounded growth; hundreds of megabytes to gigabytes |

**R-STATE-5** — All access MUST go through a storage abstraction. No component addresses a
storage API directly.

**R-STATE-6** — Every storage key MUST be declared in the storage-key registry with its tier,
shape, and migration history. **Keys are permanent** — a rename orphans user data silently
(R-PRIN-3).

**R-STATE-7** — Storage failures MUST be soft: a failed read returns the declared default, a
failed write is reported and retried, and neither takes the app down. The large store may be
blocked entirely by the browser; the app MUST still run.

**R-STATE-8** — Growing collections MUST NOT be written to the small store. The size ceiling is
low and silent, and overflow is data loss.

**R-STATE-9** — Boot MUST hydrate the large store's collections *before* building application
state, so that a legacy copy in the small store is never preferred over the authoritative one.

## The durable / transient split

**R-STATE-10** — Every field in a persisted record MUST be declared as **durable** or
**transient** in its schema. Transient fields are stripped on write.

**R-STATE-11** — Transience MUST be a schema property, not a naming convention.

> **Redesign — was:** any property whose name begins with an underscore is stripped on persist.
> This works, and the reason for it is sound — an in-flight busy flag that survived a reload
> would dead-lock the feature forever. But it makes a data-loss rule invisible at the point of
> use: `docs/13` has to warn, in both directions, that storing durable data in an underscore
> property loses it *by design* and storing a busy flag in a normal property dead-locks after a
> mid-flight reload. **Now:** the schema says which is which, and writing an undeclared field is
> a validation error rather than a coin flip.

**R-STATE-12** — Unknown fields present in a stored record MUST be preserved on write-back. A
record written by a newer build and read by an older one MUST NOT lose data.

## Persistence contract

**R-STATE-13** — Persistence MUST be automatic. A mutation to a durable record MUST be persisted
without the mutator taking any additional action.

> **Redesign — was:** mutating a message in place requires calling a dirty-marker afterwards,
> because persistence is signature-cached; forget it and *the edit never persists and vanishes on
> reload*. This is a silent data-loss footgun guarding a performance optimisation. **Now:** the
> optimisation stays — re-serialising unchanged chats every few hundred milliseconds is real
> waste — but change detection is the storage layer's job, not the caller's. Records are written
> through an interface that observes mutation; there is no way to mutate and forget.

**R-STATE-14** — Writes MUST be debounced and coalesced, and MUST be flushed on page hide and
visibility change. Binding only to unload loses the last write on mobile.

**R-STATE-15** — Media bytes MUST be stored separately from the records that reference them.
A persisted chat holds references; the bytes live in the media store.

**R-STATE-16** — Media eviction MUST be bounded and MUST prefer evicting large local bytes over
remote references. A remote reference is the durable, cheap form and MUST NOT be stripped —
doing so breaks restore-on-reload.

**R-STATE-17** — Persistence MUST degrade rather than fail: if the large store is unavailable,
the app falls back to the small store with oldest-first trimming and tells the user.

## Entity schemas

Field-level detail; types and constraints are normative, names are illustrative.

### Universe

A world: its setting, its cast, its places, its rules, and the player's identity within it.

| Field | Type | Notes |
|---|---|---|
| `id`, `label`, `avatar` | id · string · emoji | |
| `setting` | prose | Injected into every reply payload |
| `directingNotes` | prose | How drama works here; fuel for the directors |
| `genrePack` | record of 6 prose sections | Voice · drama · stakes · relationship interpretation · diary voice · pacing |
| `guide` | prose | Player-facing |
| `originDoc` | prose | Universe memory layer 1: the state-zero briefing |
| `chronicle` | list of `{day, text}` | Universe memory layer 2; condenses into eras |
| `rules` | list of compiled rules | Enforced **in code** (R-PRIN-4) |
| `trackerDefs` | list of tracker definitions | Definitions live here; **values live per-chat** |
| `locations` | list of Location | |
| `promptOverrides` | map of prompt key → text | Layer 1 of prompt resolution |
| `playerIdentity` | record | Per-universe override of the global player identity |
| `quests`, `questsEnabled` | list · bool | |
| `image`, `imagePrompt` | media ref · string | |

**R-STATE-18** — Tracker *definitions* belong to the universe and tracker *values* belong to the
chat. A new story in the same world starts with the same trackers at their initial values.

### Character

| Field | Type | Notes |
|---|---|---|
| `id`, `universeId`, `label`, `avatar`, `portrait` | | |
| `instructions`, `personality`, `backstory`, `traits`, `style` | prose | The identity sheet |
| `goals` | prose | **Authored foundation. No engine may write here** (R-ARCH-16) |
| `goalsLive` | `{lines[], day, changedAt}` | The **maintained** want-list, rewritten daily by the curator; absent means fall back to `goals` |
| `appearance` | structured record | `subject` · face map · hair · face · body |
| `wardrobe` | prose | |
| `tags` | list | Feeds world-rule group matching |
| `pressurePoints` | prose | Read by directors **only**; never shown to other characters |
| `socialGraph` | prose | Author's hand-written ties. **Never overwritten by any engine** |
| `socialFacts` | map of characterId → `{text, day}` | **One durable fact per person, rewritten in place** |
| `generatedTies` | prose | Factual tie sheet, regenerated when bonds move |
| `voice` | record | Call voice and dub voice |
| `homeLocationId`, `visitLocationIds`, `schedule` | | Daily placement inputs |
| `removed` | bool | **Soft delete**: kept for history, inert everywhere |
| `provisional` | bool | Auto-created mid-story, card pending |

**R-STATE-19** — Authored fields and engine-maintained fields MUST be separate. `goals` is
authored; `goalsLive` is maintained; `socialGraph` is authored; `socialFacts` and
`generatedTies` are maintained. No field is both.

**R-STATE-20** — `socialFacts` MUST be one entry per person, rewritten in place, never appended.

> **Parity — keep:** this replaced an append-only blob that grew a line a day. Append-only
> per-relationship state is a token bill with no ceiling and no editorial judgement; the daily
> pass must *decide*, not accumulate. The same principle governs the goals curator
> ([`10-simulation.md`](10-simulation.md)).

**R-STATE-21** — Character deletion MUST default to soft removal (R-UX-24). Hard deletion
dangles memory owners, resident lists, relationship pairs, promises, and intents; where offered,
it MUST enumerate what it will orphan.

### Location

| Field | Type | Notes |
|---|---|---|
| `id`, `label`, `description` | | Description drives scene text and imagery |
| `kind` | `home` \| `public` | |
| `travelTime` | periods | |
| `gossipChance` | 0…1 | Leak-on-exit probability |
| `residentIds` | list | Present on arrival; receive this place's leaks |
| `subAreas` | list of `{id, label, privacy, entrance: bool, image}` | **The unit of earshot** |
| `image` | media ref | Chat background |

**R-STATE-22** — Every location MUST have exactly one entrance sub-area, identified by its
`entrance` flag and **guaranteed unique by construction**.

> **Redesign — was:** the entrance is identified by a flag, but a sub-area can also be created
> *by name* — an author typing "Entrance", or a quest line generating one — and neither sets the
> flag. The payload then reads `SUB-AREAS: Entrance; Entrance; Bedroom`, and two people who both
> "walked into the Entrance" land in different earshot zones and stop hearing each other. The
> current fix promotes a name-matching area and repairs stored duplicates by remapping four
> separate stores of sub-area ids — with the standing warning that *a new store of sub-area ids
> belongs in that remap too*. **Now:** sub-areas are created only through an interface that
> enforces entrance uniqueness (R-STATE-22), and id remapping is a storage-layer operation over
> declared reference sites (R-STATE-6), not a hand-maintained list.

**R-STATE-23** — `gossipChance` on a home location MUST default to zero and the UI MUST make
raising it a deliberate act. Any non-zero value leaks private home scenes to residents as
rumours.

### Chat

One ongoing story inside one universe.

| Field | Type | Notes |
|---|---|---|
| `id`, `universeId` | | |
| `messages` | list of Message | |
| `gameDay`, `period` | int · enum | |
| `locationId`, `subAreaId` | id | **Authoritative place** |
| `presentIds` | list | Who is in the scene |
| `subPositions` | map of characterId → subAreaId | Which earshot zone each present character is in |
| `worldPositions` | map of characterId → locationId | Offstage placement for the day |
| `companionLock` | set of characterId | Travel companions pinned to the player today |
| `trackerValues` | map of `ownerKey` → value | Owner is a character id, or the story, or the player |
| `relationships` | map of directed pair → axes | Includes pairs involving the player |
| `calendar` | list of Plan | Things with a **date** |
| `promises` | list of Promise | Standing commitments with **no date** |
| `intents` | list of Intent | Private offstage motives |
| `activeEvent` | Event \| absent | A live directed scene |
| `pendingDirectorNote` | prose \| absent | One-shot, consumed by the next reply |
| `memoryArc` | `{startIndex, open, summary}` | Open arc tracker |
| `memoryCommittedThrough` | index | Prevents re-covering committed messages |
| `dnd` | bool | Per-chat; silences the director |
| `imageContinuity` | map of characterId → record | **Per character, never global** |

**R-STATE-24** — Image continuity and sticky scene type MUST be keyed per character. Global
continuity re-introduces a shipped bug in which a newly arrived character inherited the previous
speaker's pose and framing.

### Message

| Field | Type | Notes |
|---|---|---|
| `id` | id | The render and persistence handle |
| `role` | `player` \| `character` \| `system` | |
| `speakerId` | id \| absent | |
| `content` | prose | Three-part markup: action · inner thought · dialogue |
| `witnessIds` | list of characterId | **Who was present when this happened** |
| `kind` | enum | `turn` · `narratorEvent` · `presenceNote` · `dayMarker` · `travelBeat` · `text` · `error` |
| `media` | list of media refs with state | `idle` · `loading` · `done` · `error` |
| `gameDay`, `period`, `timestamp` | | |

**R-STATE-25** — `witnessIds` is written once at creation and MUST NOT be rewritten. It is
load-bearing for witness-scoped history, memory construction, and bystander gists
simultaneously; a rewrite corrupts all three at once and cannot be detected afterwards.

**R-STATE-26** — Message kind MUST be a single enumerated value, not a set of independent boolean
flags.

> **Redesign — was:** seven mutually-exclusive line types are stored as seven independent flags,
> and every engine filters on the flag set. The documented consequence: *"a new flag must be
> added to those filters or it leaks into payloads and memories."* Adding a kind is therefore a
> change to every filter in the app, discoverable only by grep. **Now:** kind is one enum with
> declared properties — is it story text, does it enter payloads, does it enter memory, is it in
> the room — and filters read the property rather than enumerating kinds. A new kind declares its
> properties and every filter is correct immediately.

**R-STATE-27** — A text message MUST carry an empty witness list. It did not happen in the room,
must not enter scene history or scene memory, and has its own memory path.

**R-STATE-28** — A travel beat is **the scene boundary** for history windowing and memory arcs.
Anything that moves the player MUST push one.

### Memory

| Field | Type | Notes |
|---|---|---|
| `id`, `ownerId` | id | Whose memory this is |
| `content` | prose | First-person record |
| `type` | enum | Experience · observation · relationship · knowledge · decision · conflict · intimacy · diary · gossip · consolidated · longterm |
| `peopleIds`, `locationId` | ids | **Ids, not names** (R-STATE-2) |
| `emotion`, `feelings`, `tags` | | |
| `importance` | 0…1 | |
| `gameDay`, `universeId`, `chatId`, `source` | | |
| `gist`, `charge`, `observerOnly` | prose · 0…1 · bool | Bystander observations only |
| `embedding` | vector + model id | Cached, keyed to the model that produced it |
| `gossipId` | id \| absent | Links a gossip memory to its ledger entry |

**R-STATE-29** — Memory records are inputs to at least five other systems. Deleting one from the
UI can change offstage behaviour, not merely recall, and the UI MUST say so.

### Ledgers

Three, sharing one discipline: **owned, bounded, and endable.**

**R-STATE-30** — A ledger entry MUST have an owner (the one party who may act on it), a lifecycle
with terminal states, a decay or pruning rule, and a cap.

| Ledger | Owner field | Lifecycle | Bound |
|---|---|---|---|
| **Gossip** | `stakeholderId` — the one person who would act on it, distinct from everyone who has merely heard it (`carrierIds`) | `open → raised → settled \| believed \| dead` | `heat` decays daily; a stakeholder holds at most N live rumours |
| **Promises** | `holderId` bound, `toId` given to | `open → kept \| broken \| released` | Resolved entries pruned after N days; list capped |
| **Intents** | `holderId`, toward `targetId` | `forming → ready → armed → resolved` | Capped per chat; ticked daily, may fade |

> **Parity — keep:** the separation of *stakeholder* from *carriers* is the idea that makes
> gossip playable rather than noise. Everyone who heard it knows it; **it is not theirs to
> raise.** One person has standing, they may put it to the player **once**, and then they must
> live with the answer. Without that distinction every character who overheard anything raises
> it, forever.

**R-STATE-31** — Recording into a ledger MUST fold paraphrases of an existing live entry into
that entry rather than creating a near-duplicate.

**R-STATE-32** — The ledger, not any derived copy, is the authority on whether an entry still
speaks.

## Schema versioning and migration

**R-STATE-33** — Every persisted record carries a schema version.

**R-STATE-34** — Migrations MUST be additive, idempotent, and non-destructive
([principle 7](00-principles.md#7--old-saves-keep-working)). Data that cannot be upgraded is left
reachable and marked, never dropped.

**R-STATE-35** — Prefer self-healing to migration. An ordering referencing an unknown id drops
it; an ordering missing a known id re-inserts it at its default position. Neither needs a
version bump or a migration.

**R-STATE-36** — A migration that can overwrite **user-authored** content MUST be
self-invalidating: before running, it verifies that its own detection criterion still
distinguishes our content from theirs, and it stands down loudly when it cannot.

> **Redesign — was:** the prompt-refresh mechanism identifies one of our stale defaults by a
> fingerprint plus a missing revision marker. When a later rewrite drops that marker from the
> current default, the default itself satisfies the reset condition — and the migration
> overwrites the user's edited prompt *on every load, forever, with no error*. The shipped fix
> is exactly right and is generalised here: the migration tests its own target first and
> disables itself when it can no longer discriminate. **Now:** R-STATE-36 makes that a property
> of the migration mechanism rather than of one hand-written guard, and a stood-down migration
> is reported as dead code to delete, not as a runtime condition to tolerate.

**R-STATE-37** — Migrations MUST run in a declared order, MUST be individually named, and each
MUST record whether it ran, what it changed, and how many records it touched.
