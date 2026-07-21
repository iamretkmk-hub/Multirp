# 03 · UI Structure

The UI is hand-rolled DOM: static screens/modals in the HTML body, dynamic content injected as
template strings, `onclick="fn(...)"` inline handlers. There is no router — `show(name)`
toggles `.screen.active` and the bottom `<nav>` highlights `data-s`.

## Screens

| Screen | id | Rendered by | Purpose |
|---|---|---|---|
| Story (chat) | `#screen-chat` | `renderChat`, `appendNewBubbles`, `bubble()` | The main roleplay transcript + input bar |
| Universes | `#screen-personas` | `renderUniverses` / `renderPersonas` | Universe grid → character grid inside a universe |
| Gallery | `#screen-gallery` | `renderGallery` (+ `_renderGalImages/_renderGalVideos`) | Per-character image/video folders, scenes, playground |
| Memory | `#screen-memory` | `renderMemory` | Browse/edit/condense all memories |
| Diary | `#screen-diary` | `renderDiary`, `openDiaryReader` | Per-character diaries as books with covers |
| Settings | `#screen-settings` | static HTML + `syncSettingsUI` + several render fns | 8 collapsible `details.sgroup` sections |
| Debug | `#screen-debug` | `renderDebug` | Every AI request/response, newest first, keys redacted |

Navigation also happens from the chat menu's "Go to" block and various buttons; always via
`show(name)`.

## The chat screen (the app's core surface)

- **Header**: character/scene name (`#chatName`), tappable scene line (`#chatScene` → Set
  time/place), Menu button → `#chatMenu`.
- **`#chatMenu`** (dropdown; `toggleChatMenu`): Scene group (World map, Move to area, Nearby
  characters, Set time/place, Calendar & tasks + badge, Clear chat window, Restart scene),
  Story group (Call a character, Messages + unread badge, "Bored" → `forceGamemaster()`,
  Story State, Universe guide), and Go-to navigation.
- **`#chatBody`**: `#chatList` (bubbles) + `#imageRail` (landscape-only right column showing
  scene images; see doc 10) + `#sceneDock` (resizable video-scene overlay).
- **Input bar**: menu button (landscape), **modes button** → `#modesMenu` with six toggles —
  `mic` (open-mic narration), `tts` (speak replies), `noimg` (pause images), `heat`,
  `autorp`, `dnd` (pause Gamemaster, per-chat) — reflected by `reflectModes()`/`toggleMode()`;
  **language button** → `#langMenu` (story language en/de/tr → `setStoryLang`, feeds
  `langDirective()` into every content payload); the auto-growing `#chatInput`; send button.
- **Bubbles** (`bubble(m)`): avatar + name meta, content rendered by `md()` (markdown-ish:
  `*narration*`, `_thoughts_`, quotes), a status strip (`statusStripHTML`: day/period/location
  stamp), media block (image with per-image menu: Animate/Movie/Scene, frame picker, retry,
  view prompt), and per-message actions (edit, delete, dub, video loop).
- **Typewriter reveal**: new assistant lines enter via a strict presentation queue
  (`enqueuePresent` → `appendOneBubble` → `typewriterReveal` at `revealCps`). The queue paces
  multi-character chains so lines land in order; `_reveal` is transient.
- **Render window**: only the last `RENDER_WINDOW` messages are in the DOM (front-trimmed);
  scrolling up loads more. Scroll pinning: `pinChatBottomSoon`, `isNearBottom`, the
  new-message pill (`showNewMsgPill`), and `_followAfterSend`.

## Modals

All modals are `div.modal` + `div.card.editCard`, opened/closed with
`openModal(id)/closeModal(id)`, closable with the ✕ button. The important ones:

| Modal | Opened by | Notes |
|---|---|---|
| `#universeModal` | `editUniverse` | The universe editor: setting, director notes, "Update engine prompts for this world" (per-universe tuner), universe memory (state zero + chronicle), genre pack (6 sections + guide), world rules compiler, per-universe player identity, trackers, locations, per-universe prompt list, reset/delete. |
| `#universeGenModal` | `openUniverseGenerator` | "Generate Universe" from a brief (authoring model). |
| `#personaModal` | `editPersona`/`useP` | Character editor: Create-with-AI (single/batch), all card fields, structured appearance + wardrobe, voices, tags, interject, social graph, generated relationships, visit locations, whereabouts, live relationship view. |
| `#trackerEditModal` | `editTracker`/`addTracker` | Tracker editor (see doc 09): owner type, behavior, method cards, dice trigger, breaking points, public-knowledge block. |
| `#locEditModal` | `editLocation` | Location editor: type, travel time, gossip chance, residents, sub-areas, picture. |
| `#sceneStateModal` | `setSceneState` | Set day / period / location manually. |
| `#castModal` | `openCast` | "Who's nearby?" — toggle presence; explains `/bring`, `/leave`, `/who`. |
| `#promptEditModal` + `#writeAiModal` | `openPromptEdit`, `openWriteAi` | Edit any prompt (global or per-universe scope) + "Write with AI" generator. |
| `#memEditModal` | `openMemEditor`/`addMemoryManual` | Memory add/edit with all fields. |
| `#callPickerModal`, `#callOverlay`, `#callDbgModal` | voice calls | Pick callee, in-call UI, call debug trail. |
| `#imgModal` | `viewSceneImage`/`viewGalleryImage` | Image viewer with swipe/arrow navigation. |
| `#sceneEditModal`, `#scenePickModal`, `#scenePlayModal` | v27 scenes | Video-scene curation and playback. |
| `#playgroundModal`, `#img2vidModal` | v28 playground | Compose an image (actor·location·pose·AI prompt); image→video. |
| Quest modals | `openQuestsModal`, `questEditUI`, `openQuestDebugModal` | Quest arcs (built dynamically). |
| World map | `openWorldMap` (builds its own overlay) | Travel, character states, calendar, End Day, map image editor, intent editing. |

## Settings screen anatomy

Eight `details.sgroup` sections — every user-tunable value in the app lives here, nothing is
hidden (a repeated design point: "previously hidden — now selectable"):

1. **API Keys** — all provider keys + voice keys.
2. **LLM Selection** — one model picker per function (roleplay + rotation, refusal fallback,
   Auto-RP narrator, rewriter, multi-character director, memory engines, GM/judges, character
   generator, authoring model, image/video router, voice calls) with per-function temp/token
   overrides (`fnCfg` via `renderOvrFields`). Sampling sliders apply to roleplay replies only.
3. **Payloads** — the payload editor (doc 05): placeholder guide, reply payloads (reorderable),
   engine payloads (in-place prompt editing).
4. **Image Settings** — provider segment, image model rules list (`renderRules`), smart routing
   toggle, fal.ai card, auto-illustration + style + aspect, special-purpose models.
5. **Video Settings** — Animate/Extend model cards, video rules, length/resolution/sound.
6. **TTS Settings** — dub engine/voice/language/speed, narration voice, mic patience, lip-sync
   model, live-call tuning (STT/TTS models, endpointing, barge-in, pronunciation respellings).
7. **Game Preferences** — identity (global you), roleplay flow (chain cap, presence, heat,
   relationship/tracker/voice-check/recap toggles), Memory (all thresholds/weights), Living
   Universe (gossip/confrontation/intent), Gamemaster & scenes (+ world pulse, proactive texts,
   goal pursuit, character quests, latent NPCs, Scene Writer), Characters (auto-create),
   World & time (travel, calendar), Appearance (theme, font, reveal, UI scale).
8. **Data & Backup** — storage meter, install button, full/granular export-import, automatic
   snapshots, danger zone (see doc 11).

`saveSettings(true)` reads every input back into `state` + localStorage; `syncSettingsUI()`
does the reverse. **Any input you add/remove must be wired in both**, or saving will crash on
a missing element / silently drop the value.

## Visual language & conventions (for new UI)

- **Cards**: `div.card` inside `div.sgbody`; titles `h3` with a leading icon; explanatory copy
  in `div.desc`.
- **Icons**: inline SVG sprites — `<svg class="ic"><use href="#i-name"/></svg>`. Add new
  symbols to the `<defs>` block at the top of `<body>`. `icon()`/`ICONMAP`/`deEmoji` convert
  *system* emoji to line icons; **avatar emojis are user data and are never converted**.
- **Buttons**: `.btn` (primary), `.btn.sec` (secondary), `.btn.danger`, size modifier
  `.small`; icon buttons in the chat bar are `.iconBtn`.
- **Toggles**: `<label class="switchLbl"><input type="checkbox"><span class="sl"></span></label>`.
- **Segmented pickers**: `div.seg` with `button[data-*]`, `.on` marks selection (`seg()` helper).
- **Feedback**: `toast(msg)` for transient notices; inline `sysError` bubbles for in-chat errors.
- **Escaping**: all user data interpolated into HTML goes through `esc()` — no exceptions.
- **Theming**: CSS variables (`--bg --surface --card --border --text --muted --accent
  --danger`), switched by `body[data-theme=dark|light]`, `applyTheme()` handles `system`.
- **Layout**: portrait = single column + bottom nav; landscape = two-column reading layout
  (text left, image rail right) driven purely by CSS media queries; `applyUiScale()` zooms the
  whole body.
- **Accessibility of handlers**: every function named in generated `onclick`/`oninput` HTML
  must exist globally — a renamed/deleted handler fails only at click-time (shipped bug
  v19.21; see doc 13).
