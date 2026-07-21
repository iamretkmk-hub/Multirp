# 11 · Settings Wiring, Backup & PWA

## The settings round-trip

Two functions own the Settings screen; **every** input must be wired in both:

- `syncSettingsUI()` — state → DOM. Populates every input/toggle/segment, renders the dynamic
  lists (rules via `renderRules`, payload editors via `renderPayloadList`/
  `renderEnginePayloads`, style manager, override fields via `renderOvrFields`, toggle
  segments via `renderToggleSegs`).
- `saveSettings(showToast)` — DOM → state → storage. Reads every element by id, writes
  `state.*`, persists via `store.set/setRaw` under the `K` keys, then re-applies side effects
  (theme, font, provider visibility…).

⚠️ Failure modes when you forget one side:
- added input, missing in `saveSettings` → value silently never saved;
- removed input, still read in `saveSettings` → `getElementById(...)` is null →
  **saving settings crashes for everyone** (nothing after the throw persists);
- prompt registry entry without its `store.setRaw` persist line in `saveSettings` → the
  engine-payload editor shows edits that vanish on reload.

Prompts edited in Settings → Payloads save **instantly** through their own handlers
(`plqInput`/`plqReset`, `plqTplInput`/`plqTplReset`, `movePayloadBlock`,
`resetPayloadOrder`, `plqRemoveBlock`/`plqAddBlock`) — independent of the Save bar.

## Export / import (Settings → Data & Backup)

| Set | Functions | Contents |
|---|---|---|
| **Everything** | `exportAll` / `importAllFile` → `buildBackup`/`applyBackupBundle` | ALL of localStorage (⚠️ **including API keys** — treat backup files as secrets), the IDB collections (chats, memory, universes, personas, scenes), gallery media, static image bytes. Import replaces wholesale + reloads. |
| **Automatic snapshots** | `scheduleAutoBackup`/`doAutoBackup`/`renderAutoBackups`/`restoreAutoBackup` | The same full bundle, kept **inside IndexedDB** (last 3, ~once/min after changes + on background). Restore takes a safety snapshot of current state first. |
| **Roleplay** | `exportRoleplay`/`importRoleplayFile` | Current universe's chats + its memories + the universe & cast (self-contained; static images inlined). |
| **Universes** | `exportUniverses`/`importUniversesFile` | Worlds + characters, no chats. |
| **Prompts & settings** | `exportPrompts`/`importPromptsFile` | The prompt pack: prompt overrides + payload layouts/fragments + related settings. |

Dispatch: one hidden `<input type=file>` + `importPick(kind)`/`importDispatch(file)`.

**Danger zone**: `confirmClear('chats'|'memory'|'images')`, and
`wipeUniverseMemory`/`wipeUniverseState` — "reset universe (fresh start)" clears memories,
diaries, relationships, feelings, schemes/intents, meetings, tracker values, quests and the
chronicle but **keeps** the world, cast cards, locations and transcripts.

The Debug screen has its own export (`exportDebug`) with `scrubSecrets` — that one is safe to
share; full backups are not.

## Storage meter & PWA

`updateStorage` fills the "Storage used" pill. The PWA IIFE (end of the script): inline
blob-URL manifest, `sw.js` registration (https only — the app still works fully without it),
`navigator.storage.persist()` request, `beforeinstallprompt` capture → `installApp()`.

`sw.js`: cache-shell (`./`, `./index.html`), **network-first** with cache fallback, never
touches cross-origin (API) requests. Bump `CACHE_VERSION` every upload.

## Other quality-of-life systems

- **Onboarding**: single landing panel → `finishOnboard()` sets `sm_onboarded` and runs
  `init2()`.
- **Scene recap** (`maybeShowRecap`, `recapOn`): "Previously…" banner when reopening a chat
  after a break (recap model → memory model fallback).
- **Perf**: `__SM_PERF=true` in the console enables timing logs; `perfDump()` aggregates.
- **Story language**: `storyLang` (en/de/tr) + `langDirective()` — applies to all generated
  story text and system lines; pickable from the chat input bar.
