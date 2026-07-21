# 01 · Overview & Boot

## What StoryMind is

StoryMind is a single-file, offline-capable **AI roleplay engine**. The player chats with AI
characters that live inside "universes" (shared worlds). Around the basic chat loop the app
layers a *living world simulation*: characters remember (a real memory system with retrieval),
form feelings and grudges, gossip about what they saw, pursue their own goals offstage, make
and keep (or miss) calendar plans, text the player, run quests, and confront the player when a
suspicion hardens. Every reply can be illustrated (image), animated (video), and voiced (TTS);
real-time voice calls are supported.

Everything runs **client-side in the browser**. There is no backend: the app talks directly to
AI providers with the user's own API keys.

| Provider | Used for | Key stored in |
|---|---|---|
| OpenRouter | all text LLM calls + embeddings + (optional) image models | `sm_key` |
| ModelsLab | images / video | `sm_segkey` |
| AtlasCloud | images / video / xAI TTS / Kling lip-sync | `sm_atlaskey` |
| fal.ai | z-image LoRA images | `sm_falkey` |
| CivitAI | authenticated LoRA download links | `sm_civitaikey` |
| Deepgram | speech-to-text (voice calls, open mic) | `sm_dgkey` |
| Inworld (via a user-deployed Cloudflare Worker relay) | streamed call/narration TTS | relay URL in `sm_ttsrelay` |

## File layout

```
index.html   — the entire app: ~650 lines CSS, ~1400 lines HTML, ~25,500 lines JS
sw.js        — optional service worker: caches the app shell, network-first; never caches API calls
docs/        — this documentation
```

The single-file design is deliberate (see the SCRIPT MAP comment): it makes the app a PWA that
can be copied around as one file and even run from `file://`. The price is that **all state is
global** and discipline comes from banner comments + naming conventions, not module boundaries.

## index.html anatomy

| Region | Lines (v25.8) | Content |
|---|---|---|
| `<style>` | ~25–649 | All CSS. Theming via CSS variables on `body[data-theme]`. Landscape two-column layout, video gallery, playground styles at the end. |
| SVG symbol defs | ~652–734 | The line-icon system: `<symbol id="i-*">` sprites referenced by `<use href="#i-…">`. |
| Screens & modals | ~736–2047 | 7 screens (`#screen-chat`, `-personas`, `-gallery`, `-memory`, `-diary`, `-settings`, `-debug`), onboarding, ~25 modals, bottom `<nav>`. |
| `<script>` | 2049–27571 | Everything else. Starts with the SCRIPT MAP table of contents, then 18 numbered sections (config/state → media store → prompts → living universe → directors → … → settings UI). |

### The 18 script sections (from the in-source SCRIPT MAP)

1. **CONFIG & STATE** — `K` storage-key map, `store` wrapper, `loadState()`, PERF instrumentation
2. **MEDIA STORE** — the IndexedDB layer (`mediaDB`), export/import
3. **PROMPTS (defaults)** — `DEFAULT_*` prompt constants (base instruction, format rules, memory prompts…)
4. **LIVING UNIVERSE** — gossip, offstage intents, confrontation/overture judges, relationship generator
5. **DIRECTORS** — Gamemaster, Scene Writer, Auto-RP narrator, multi-character turn routing prompts
6. **STYLES & FRAMES** — user-editable image style list, aspect-ratio catalog
7. **DEBUG LOG** — `dbg()/dbgDone()`, payload capsule rendering, secret scrubbing
8. **UI HELPERS** — `toast`, `openModal/closeModal`, `esc`, `icon()`, typewriter reveal queue
9. **PROVIDERS** — `chatCompletion`, ModelsLab, AtlasCloud, fal.ai, TTS, lip-sync, smart router, per-rule dispatch
10. **VOICE / NARRATION** — open-mic narration mode, dubbing pipeline
11. **WORLD SYSTEMS** — per-universe prompts (`up()`), game systems, locations/travel, schedules, world rules, calendar, trackers & relationships
12. **EDITORS** — universe editor, character bio generator, world-rule plumbing, structured appearance, genre pack
13. **PAYLOAD SYSTEM** — `PAYLOAD_DEFS`, `buildPayload`, block templates, post-dialogue tail *(read the coupling guards!)*
14. **CHAT RENDER & SEND** — image rail, modes dropdown, `renderChat`/`sendMessage`, heat mode
15. **MEDIA UI** — gallery, frame picker, animate/movie buttons
16. **WORLD PULSE & MAP** — offstage life engine, world map hub, quests, character quests
17. **MEMORY / DIARY UI** — memory browser, diary reader & covers
18. **SETTINGS UI** — style manager, payload editor UI, export/import screens

## Boot sequence

```
window load
 └─ init()                          (async)
     ├─ preloadCollections()        hydrate chats/memory/universes/personas from IndexedDB kv
     │                              (with a one-time migration from legacy localStorage)
     ├─ loadState()                 build the global `state` from localStorage + defaults;
     │                              fresh-install seeding (bundled default universe);
     │                              data migrations (sub-areas, presence ids, quests…)
     ├─ applyTheme(); applyUiScale()
     └─ onboarding gate:            sm_onboarded !== "1" → show #onboard, finishOnboard() → init2()
                                    else → init2()
init2()
 ├─ syncSettingsUI()                push state into every Settings input
 ├─ loadModels(false)               OpenRouter model list → <datalist> (24h cache)
 ├─ _wireAudioUnlock()              prime audio on first user gesture (mobile autoplay)
 ├─ applyUniverseProfile(...)       resolve per-universe player identity (name/look/bio)
 ├─ hydrateMedia()                  async: images/videos/scenes from IndexedDB → state
 ├─ startSceneFor(...)              if no current chat, open the current universe's story
 └─ renderChat(); updateChatHeader(); autoIllustrateLast() if the greeting isn't illustrated
```

After `init2()`, a block of top-level listeners wires: input auto-grow + Enter-to-send, live
slider labels, theme/provider segments, orientation-change scroll anchoring, and
`pagehide`/`visibilitychange` → `flushPersistChats()` (never lose a turn on mobile).

A final IIFE sets up the **PWA**: an inline blob-URL web manifest, `sw.js` registration (https
only), `navigator.storage.persist()`, and a custom "Install app" button.

## Versioning & release checklist

- `#buildStamp` in the Settings header shows the app version (e.g. `v25.8`). The codebase's
  banner comments reference feature versions constantly (`v19.4 — NARRATION MODE`), which is
  how history is tracked in a single file.
- `sw.js` `CACHE_VERSION` (`storymind-v102`) **must be bumped with every upload**, otherwise
  installed clients keep the previous cached `index.html` (network-first mitigates this online,
  but offline clients pin to cache).
- There is no test suite. The de-facto regression harness is: (a) the dev-time drift guards
  that `console.warn` at boot (`[blockTpls] drift`, `[payloads] prompts not mapped`), and
  (b) the byte-equivalence discipline documented in the payload section (default layout +
  default fragments must reproduce the legacy payload exactly).

## Global runtime objects worth knowing

| Name | What it is |
|---|---|
| `state` | the whole app state (see doc 02) |
| `K` | logical-name → localStorage-key map |
| `store` | tiny JSON/raw localStorage wrapper (fail-soft) |
| `mediaDB` | IndexedDB wrapper: `images`/`videos` object stores + `kv` store |
| `PAYLOAD_DEFS`, `ENGINE_PAYLOAD_DEFS`, `BLOCK_TPL_DEFAULTS` | the payload system (doc 05) |
| `PROMPT_REGISTRY`, `PROMPT_BY_KEY`, `up(key)` | every editable engine prompt + its resolution chain |
| `RATIOS`, `STYLE_SEED` | aspect-ratio catalog, seed image styles |
| `_perfAgg` / `__SM_PERF` / `perfDump()` | opt-in console perf instrumentation |
