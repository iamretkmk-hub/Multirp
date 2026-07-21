# 10 · Media Pipeline — Images, Video, Scenes, Speech

## Auto-illustration flow (`illustrate(mid, replyText, force)`)

Fires per assistant reply when auto-images are active (`autoImgActive` — toggle + the
"pause images" mode + heat suppression), or manually per bubble. Steps:

1. **Idempotency guard** — several paths can call it for the same message; the first in-flight
   call owns the frame (`msg.img || imgState==="loading"` short-circuits unless `force`).
2. **Per-character continuity** — `chat.imgPromptBy[charKey]` holds only *that character's*
   previous frame prompt (a newcomer starts blank so they're never drawn into the previous
   speaker's picture). Cleared on exit/travel.
3. **Route first** (`pickRule(state.imgRules, routeText)`): the router LLM (`routerPrompt`,
   `routerModel`) sees the location line, the character's own **sticky previous scene type**
   (`chat.lastImgRuleBy[charKey]` — "keep the same type unless the roleplay changed"), and
   the latest exchange; returns a rule index. Routing off / one rule ⇒ first enabled rule.
4. **Write the prompt** — system prompt layering:
   `rewritePrompt` (universal extraction rules) → shared FOUNDATION (for legacy rules) →
   the routed rule's own `promptStyle` (camera/pose/shot detail) → the frame guide. The
   user message = continuity reference (previous frame; exchange overrides it) + latest
   exchange. **No character sheet is sent** — the writer refers to people generically.
5. **Deterministic tail (code, not LLM)**: the focal speaker's real appearance
   (`_imgSpeakerAppearance` from structured `look` + wardrobe), the location clause, the
   time-of-day lighting clause — then the user's selected **style tail** last
   (`styleTail()`, idempotent append).
6. **Generate** via the rule's provider (`genImageForRule` → AtlasCloud / fal / ModelsLab /
   OpenRouter). Frame resolution: per-image `msg.ratio` → rule `ratio` → global
   (`_frameOverride` transient during the call).
7. **Bookkeeping**: `msg.img/imgSrc/imgPrompt/imgRule/ratio`, `saveMsgImage` (bytes → IDB so
   the scene survives reload), continuity + gallery record push, base64 eviction caps,
   `persistImages`/`persistChats`/`refreshBubble`.

Image/video **rules** (Settings → Image/Video): ordered list, each
`{label, when (router description), provider, model_id, loraPath, loraScale, keyword (LoRA
trigger, auto-prepended by injectLoraKeyword), negative, promptStyle, ratio, enabled}`.
Smart routing toggle is shared between images and video.

The **image rail** (landscape) mirrors scene images beside the text (`renderImageRail`,
pinning via `togglePin`); `sceneHTML`/`refreshBubble` render the in-bubble media block with
the per-image menu (frame picker `pickFrame`, retry, view prompt, Animate/Movie/Scene).

## Video

- **Animate** (`animateScene` → `wanAnimateVideo`): first clip from a scene image on
  wan-2.2 turbo-spicy i2v LoRA (the routed video rule's LoRAs + trigger keyword apply; output
  follows the image's aspect). The motion prompt is written by `vidPrompt`. With
  **voice-guided animate** (`animVoice`, wan-2.5 ids only) the line's TTS audio rides along.
- **Extend / Movie** (`movieScene` → `wanExtendVideo`): wan-2.5 video-extend appends
  `extendDur` seconds onto the chat's latest clip; the `extendPrompt` writer produces a
  "scene continues…" prompt from the picked still. Each press grows the same video.
- Async submit→poll: `submitVideo`/`pollVideo` (ModelsLab) and `atlasGenerate` (Atlas).

## Gallery, scenes, playground

- **Gallery** (`renderGallery`): Images/Videos tabs, per-character folders (`openGalFolder`),
  scoped by universe (`_galScope`), viewer with swipe (`openImgViewer`/`_galViewerStep`),
  delete, download.
- **Scenes (v27)**: user-curated ordered playlists of gallery clips per character
  (`createScene`, `addSelectedToScene`, editor `renderSceneEditor`, picker
  `openScenePicker`). Playback: seamless multi-clip player (`smCreatePlayer` — double-buffered
  `<video>` swap), fullscreen modal (`playSceneModal`) or the in-chat **scene dock**
  (`playSceneInChat`, resizable overlay; landscape uses the right rail). **Scene mode**: while
  the video window is open, `autoVisualize` routes new beats to scene selection instead of
  images (`routeSceneForBeat`).
- **Playground (v28)**: compose an image from actor · location · pose · AI-written prompt
  (`openPlayground`, `pgWritePrompt`, `pgGenerate`), and image→video for any gallery image
  (`openImg2Video`, `i2vWritePrompt`, `i2vGenerate`).

## Speech (summary — details in doc 06)

Dub button / auto-speak (`autoSpeakMsg`) → xAI TTS (delivery tags) or Inworld; narration
voice mode reads `*narration*` with a narrator voice + FX before the character speaks
dialogue; `dubAsVideo` = TTS + Kling lip-sync talking video; diary read-aloud (`dubDiary`).
Auto-speak OFF also flushes anything queued (`_dubKill`).

## Static art (v25.3)

Portraits, universe pictures, diary covers, map backgrounds and location images are "static
images": generated via special-purpose models (`portraitModel`, `uniPicModel`+`uniPicLora`,
`mapImgModel`, `locModel` — all optional overrides), stored as bytes in IDB
(`captureStaticImages`/`rehydrateStaticImages`, keys `simg:*`) so blob URLs survive reload,
and inlined into exports (`inlineStaticImages`).

## Warnings

- Anything that mutates a message's media fields **must** call `markChatDirty(chat)` +
  `refreshBubble(mid)` — otherwise the change neither persists nor renders.
- Base64 media is aggressively evicted (caps in doc 02). Remote provider URLs are the durable
  form — never strip `imgSrc`/`videoSrc`.
- The `illustrate` guard means a *failed* generation leaves `imgState:"error"` with a retry
  button; forcing regeneration is `reIllustrate` (passes `force:true`).
- Per-character continuity keys (`imgPromptBy`, `lastImgRuleBy`) are the fix for two shipped
  bugs (newcomers inheriting poses/frames). If you add a new generation path, key it per
  character the same way.
- Video rules are **LoRA selectors** — the base model is fixed (`state.vidModel`); a rule's
  `model_id` is ignored for video (`videoRuleToAtlas`).
