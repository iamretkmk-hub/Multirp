# StoryMind (Multirp) — Architecture Documentation

This folder is the complete developer map of the app. The entire application lives in **one
file** — `index.html` (~27,600 lines: CSS → HTML → one `<script>`), plus a tiny optional
service worker (`sw.js`). These documents explain how every subsystem works, how it shows up
in the UI, what data each AI payload carries, how the pieces couple to each other, and what
breaks when you change something in the wrong place.

> **Read this first:** `index.html` carries its own in-source table of contents — the
> "STORYMIND — SCRIPT MAP" banner comment right after `<script>` (~line 2050). Every section
> of the script is delimited by a `===== NAME =====` banner. Navigate the file by searching
> those banner strings, not by line number (line numbers drift with every release).

## Reading order

| # | File | What it covers |
|---|------|----------------|
| 01 | [01-overview.md](01-overview.md) | What the app is, the single-file design, boot sequence, versioning, script map |
| 02 | [02-data-model-and-storage.md](02-data-model-and-storage.md) | Every entity (chat, message, persona, universe, tracker, memory…), localStorage vs IndexedDB, persistence rules |
| 03 | [03-ui-structure.md](03-ui-structure.md) | Screens, nav, modals, the chat menu & modes menu, icon system, theming, UI ↔ function mapping |
| 04 | [04-chat-engine.md](04-chat-engine.md) | `sendMessage`, Auto-RP, OOC commands, turn routers, multi-character chains, heat mode, presence, witness-scoped history |
| 05 | [05-payload-system.md](05-payload-system.md) | **The heart of the app.** Reply payloads, blocks, templates, engine payloads, the prompt registry, placeholders, coupling guards |
| 06 | [06-ai-providers.md](06-ai-providers.md) | OpenRouter call anatomy, model selection/fallback chains, rotation, refusal handling, ModelsLab/AtlasCloud/fal.ai, smart routing, the Debug log |
| 07 | [07-memory-system.md](07-memory-system.md) | Arc-bounded memory, bystander gists, diaries, condensation, weighted retrieval, embeddings |
| 08 | [08-living-universe.md](08-living-universe.md) | Gossip, intents, confrontations/overtures, world pulse, goal pursuit, quests, calendar, texts, the End Day pipeline |
| 09 | [09-world-systems.md](09-world-systems.md) | Universes, characters, locations & sub-areas, travel, schedules, world rules, trackers, relationships |
| 10 | [10-media-pipeline.md](10-media-pipeline.md) | Image generation flow, image/video rules, Animate/Extend, gallery/scenes/playground, TTS, voice calls |
| 11 | [11-settings-and-backup.md](11-settings-and-backup.md) | Settings ↔ state wiring, export/import sets, automatic snapshots, danger zone, PWA |
| 12 | [12-module-guide.md](12-module-guide.md) | **How to add a new module and how to remove one** — full checklists, incl. UI creation/removal and payload wiring |
| 13 | [13-cross-effects-and-warnings.md](13-cross-effects-and-warnings.md) | The coupling matrix: "change X here → Y breaks there", plus every known footgun from the app's own history |

## The 60-second architecture summary

- **One HTML file, no build step, no framework.** Vanilla JS, `onclick=` handlers, DOM built
  with template strings. Works from `file://` and installs as a PWA.
- **State** is one global `state` object hydrated by `loadState()`. Scalars/prompts persist in
  `localStorage` (keys in the `K` map, all `sm_`-prefixed); the growing collections (chats,
  memory, universes, personas, scenes) and media bytes persist in **IndexedDB**
  (`storymind_media`).
- **All AI traffic goes through a few provider functions**: `chatCompletion()` (OpenRouter,
  text), `modelslabImage/Video`, `atlasGenerate/atlasImage/atlasVideo` (AtlasCloud),
  `falImage`, `atlasTTS`/`inworldSpeak` (speech), Deepgram (STT, voice calls). Every request
  is logged to the Debug screen via `dbg()/dbgDone()`.
- **A turn** = player input → (optional Auto-RP rewrite) → solo reply or router-driven
  multi-character chain → per-message image pipeline → `postTurn()` background engines
  (trackers, feelings, calendar, scene writer, gamemaster…).
- **A day** = many turns → **End Day** → a long, strictly-ordered background pipeline
  (memories → calendar/quests reconcile → diaries → relationships → gossip → world pulse →
  goal pursuit → character quests → texts → confrontations → intents → chronicle).
- **Payloads are user-visible objects.** The three reply payloads (Solo / Multi / GM reaction)
  are ordered block lists the user can reorder in Settings → Payloads; every fixed sentence is
  an editable template fragment; every background engine's prompt is editable in place. The
  code that assembles them is guarded by explicit "(!) COUPLING GUARDS" comments — **read
  [05-payload-system.md](05-payload-system.md) and [13-cross-effects-and-warnings.md](13-cross-effects-and-warnings.md)
  before touching anything payload-related.**

## House rules for editing this codebase

1. **Search by banner, edit in place.** No modules, no imports — everything is global. A
   function referenced from generated HTML (`onclick="foo()"`) must exist at the global scope;
   `node --check` cannot catch a missing one (this shipped as a real bug in v19.1/v19.21).
2. **Never rename storage keys, block ids, or prompt keys.** Users' saved data references them
   by string. Renames orphan data silently (see doc 13).
3. **Migrations are additive and idempotent.** Old saves must keep working byte-identically —
   the app self-heals (e.g. `payloadOrder()` re-inserts unknown blocks); follow that pattern.
4. **Every new network call gets `dbg()`/`dbgDone()`.** The Debug screen is the app's only
   diagnostic surface on a phone.
5. **Bump both version stamps on release:** the `#buildStamp` text in Settings' header
   (`v25.8` at time of writing) *and* `CACHE_VERSION` in `sw.js` (`storymind-v102`) — without
   the sw bump, installed clients keep serving the old cached build.
