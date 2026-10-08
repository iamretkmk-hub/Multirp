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
| **Everything** | `exportAll` / `importAllFile` → `buildBackup`/`applyBackupBundle` | localStorage (v144.1: export **asks** whether to include the API keys and TTS relay URL — `SECRET_LS_KEYS`; "without" is the first choice), the IDB collections (chats, memory, gossip, universes, personas, scenes), gallery media, static image bytes, and (v150.3) every **kept book** with its pictures and clips (`books`: `bookBackupEntries`). Import (v144.1) **validates first** (`validateBackupBundle`: shapes, `backupVersion` ≤ `BACKUP_VERSION`) and touches nothing on a bad file; takes a safety snapshot (v146.1: always a real one, `doAutoBackup({force:true})` — the roleplay/universes/prompts imports take one too); turns persistence off; writes settings with a rollback copy (API keys the file lacks are kept); commits collections + media in **one** IndexedDB transaction (`mediaDB.restoreAtomic`); on failure rolls settings back and reports "nothing was changed"; then reloads. Kept books are restored in the same transaction through `bookRestoreEntries`, which writes only `book:` and `bookmedia:` keys, a picture only as an image data URL and a clip only as a video data URL (turned back into a Blob). Media fields with script schemes are blanked on import (`sanitizeImportedMedia`), which (v146.1) also turns numeric fields (`day`, `min`/`max`, `mapPos`, tracker values…) back into numbers and replaces message ids that are not plain tokens. |
| **Automatic snapshots** | `scheduleAutoBackup`/`doAutoBackup`/`renderAutoBackups`/`restoreAutoBackup` | A **text-only** bundle (no gallery media, v110.1; v150.3: the kept books' text, not their pictures), kept **inside IndexedDB** — the last `AUTO_KEEP` = **6**, ~once/min after changes and when the app goes to the background. v144.1: skipped when nothing changed since the last one (`_dataRev`/`_lsRev`), never started on `pagehide`. Restore goes through `applyBackupBundle`, which snapshots the current state first. |
| **Roleplay** | `exportRoleplay`/`importRoleplayFile` | Current universe's chats + its memories + the universe & cast (self-contained; static images inlined), and (v150.3) that story's kept book with its pictures, restored on import. |
| **Universes** | `exportUniverses`/`importUniversesFile` | Worlds + characters, no chats. |
| **Prompts & settings** | `exportPrompts`/`importPromptsFile` | The prompt pack: prompt overrides + payload layouts/fragments + related settings (v150.74: also the emotion list, the Decisions model and its overrides, every Decisions switch and the certainty each acts at). Import (v144.1) writes **only** `PROMPT_REGISTRY` keys and `PROMPT_PACK_KEYS`, string values only — a pack cannot set API keys or the embeddings endpoint. |

Dispatch: one hidden `<input type=file>` + `importPick(kind)`/`importDispatch(file)`.

**Danger zone**: `confirmClear('chats'|'memory'|'images')`, and
`wipeUniverseMemory`/`wipeUniverseState` — "reset universe (fresh start)" clears memories,
diaries, relationships, feelings, schemes/intents, meetings, tracker values, quests and the
chronicle but **keeps** the world, cast cards, locations and transcripts.

The Debug screen has its own export (`exportDebug`) with `scrubSecrets` — that one is safe to
share; a full backup is only safe to share when exported "without API keys".

## Storage safety (v109.1 → v146.1)

- **Read-only sessions.** `collectionsSafe` is false until the boot read is known good, while a
  second tab is open (`acquireWriterLock`, Web Locks / BroadcastChannel; `#tabRoBar` explains),
  after a boot failure, and during a restore. The collection `persist*` functions ask
  `canPersistCollections()`; the media ones ask `_canPersistMedia()` (which asks it too). Not
  every write is a `persist*`: settings go straight through `store.*`, and some paths call the
  `mediaDB` helpers directly (gallery bytes, snapshots, static art). In a read-only **tab**
  (v146.1) `_storageRO` makes those refuse as well, and Save Settings says it did not save. When
  the writer tab closes, the read-only tab that is granted the lock reloads itself and becomes the
  writer (a flagged reload waits briefly for the lock), so exactly one tab ends up writing.
- **Checked writes.** Collection writes go through `_kvPersist`: the `kvSet` result is checked,
  a failure toasts once, a run of failures warns once more, and the write is retried with backoff
  (`_retryWriteLater`, reading the current value). v146.1: the counters are **per key**, so a
  write that succeeds on another key no longer hides a key that keeps failing. The chat save
  signature (`_lastPersistSig`) is recorded only after a successful write.
- **Media after hydration.** `persistImages`/`persistVideos` (`putAll` clears the store) and
  `persistScenes` wait for `hydrateMedia()` to have read the stores (`_mediaSafe`); a write asked
  for earlier is made once hydration succeeds, and never if it failed. v146.1: the delayed
  re-write after a byte capture (`_gmPersistSoon`) goes through the same gate.

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
