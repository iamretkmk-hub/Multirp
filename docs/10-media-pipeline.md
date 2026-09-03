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
5b. **Reference roster (edit models only)** — `buildRefPack` gathers the pictures, and
   `editPrompt` prepends a roster tying each one to a person in the frame.
   **(!) The roster and the scene text must share a vocabulary.** `rewritePrompt` orders the
   writer to *"Refer to people as Man and Woman (or Girl if she reads as under ~20). NEVER use
   character names in the prompt"* — so a roster that said *"Images 1-2 are Nil Akbaba"* handed
   the model a name it would never see again and then asked it to draw a `Woman`, with nothing
   connecting the two halves; which face landed on which body was chance. The roster now uses
   **`look.subject`** (Man/Woman/Girl/Boy — the same four words, on the character card; the
   player's is `state.userSubject`, Settings › You and per-universe) and counts in **Figure
   1..N**, the unit these editors actually index by. A person's FIRST picture is their profile
   one (`splitPersonRefs`), so it is named as the face anchor and the rest as further views for
   build and colouring. No subject word ⇒ **"Person 2"**, numbered by place in the roster and
   never guessed: a confident "the Man" over a woman is worse than a number, and the grouping
   (which figures are one person) is the part that must never be wrong. `_refSubject` falls back
   to reading the look text so cards written before the field still resolve.
   Identity only — face, build, colouring. **Not** rendering style: `styleTail()` owns the
   aesthetic, and matching a photo's rendering would fight the style the player picked.
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

## Video (rewritten v27 — one path, one request builder)

> Replaces the older three-path design (wan-2.2 Animate + wan-2.5 Extend/Movie). The
> `seedance*`, `movie*` and `extend*` settings keys, `wanAnimateVideo`/`wanExtendVideo`,
> `movieScene` and the `extendPrompt` registry entry are all **gone**; v27.8 removed the Wan
> option and all LoRA plumbing with it.

- **One video path.** `generateVideo(prompt, imageUrl, opts)` is the single request builder
  (`===== VIDEO OPTIONS + THE ONE REQUEST BUILDER (v27) =====`). Default model
  `VIDEO_MODEL_DEFAULT = "bytedance/seedance-2.0-mini/image-to-video"`.
- **Options are opt-in per field**: every option the model family exposes lives in Settings
  (`vidAspect`, `vidFps`, `vidBitrate`, `vidSteps`, `vidShift`, `vidSeed`, `vidGuidance`,
  `vidNegative`, `vidExpand`, `vidLastFrame`, `vidRefs`, `vidWatermark`, `vidRes`…), and a
  field is put in the body **only when actually set** — so pointing the model id at a
  different model never sends it a field it doesn't know.
- **Two shipped models** (`VIDEO_MODELS`), matched by *family* on the id so siblings
  (seedance-2.0-fast, -2.5) route correctly without being listed:
  - `…/image-to-video` — the scene image is the first frame; 4–15 s; renders its own synced
    sound; accepts reference images/video/sound alongside the frame.
  - `…/reference-to-video` — **no first-frame slot**: the scene image is sent as `@image1` and
    the library follows (up to 9 images, 3 videos, 3 sounds). Items must be *named in the
    prompt* or they're ignored (`vidIsRefOnly` also shifts the prompt sheet's slots down one).
- **Resolution ladder is model-specific**: `SEEDANCE_RES = 480p · 720p · 720p-SR · 1080p-SR ·
  1440p-SR` — plain `1080p` is **not** an option and is a hard 400. `vidResolutionFor(model)`
  maps whatever is configured onto the accepted ladder.
- **Animate** (`animateScene(mid)`) is still the per-scene entry point; the motion prompt is
  written by the `vidPrompt` writer (`===== VIDEO PROMPT WRITER (v27) =====`). Voice-guided
  animate (`animVoice`) sends the line's TTS as the clip's audio where the model supports it.
- Async submit→poll via `atlasGenerate`.

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
## Edit models: per-field opt-in, not a shared body

`ATLAS_EDIT_MODELS` declares only what differs between the four, and the request builder adds a
field **only when that model's spec names it** — pointing the id at a sibling must never ship a
field it would reject with a 400.

| | refs | prompt | notes |
|---|---|---|---|
| `alibaba/qwen-image/edit-plus-20251215` | 3 | 800 | `num_images`, `prompt_extend`, `negative_prompt`, `seed` |
| `alibaba/wan-2.6/image-edit` | 4 | 1200 | as above, fixed `sizes` enum |
| `alibaba/wan-2.7/image-edit` | 9 | 5000 | `n` not `num_images`; boolean `thinking_mode`; `sizeTier` — frame follows the first reference |
| `bytedance/seedream-v5.0-pro/edit` | **10** | 3600 | **no count field at all**, no `prompt_extend`, no `negative_prompt`, no `seed`; `thinking` is the **string** `"enabled"/"disabled"`, not wan 2.7's boolean; plus `prompt_optimization_mode`, `output_format`, `background` |

Seedream's four extra fields are surfaced in Settings and shown **only** when the entered model id
declares them (`syncAtlasImgOpts` reads the same `opts` list the builder does, so the panel and the
request cannot disagree). `background: transparent` is silently downgraded to `opaque` unless the
output is PNG *and* exactly one reference is sent — the API also requires that reference to carry an
alpha channel, which is not knowable here, so the impossible combination is never sent rather than
returning a 400 the user cannot read. `promptMax` is 3600 chars for the model's stated "under 600
English words".

## The sticky scene picture

An edit model of this class takes a long time per frame, and the reply lands long before the
picture: the scene area under a fresh line was a spinner, and under a line the "illustrate every N
replies" setting skipped, nothing at all. So a reply with **no picture of its own** shows the most
recent one from earlier in the scene (`_stickyImg` → `_stickyHTML`), covering all three empty
states — generating, failed, and never-illustrated.

It is **carried over, never regenerated** (no request, no cost), and display-only: pin, frame,
animate and dub all act on the message that *owns* an image, so they are not offered on a borrowed
one; clicking opens the owner's full-size view. Phone-text pictures are never borrowed — they live
in their own window. Chronological by design: each line shows the newest picture *at or before it*,
so nothing behind needs re-rendering when a new one lands, and the newest bubble is always showing
the newest picture. The backward scan is bounded at 60 messages — an unbounded walk from every
bubble in a long chat is quadratic, and at 1–12 replies per picture 60 always finds one. Toggle:
`state.imgSticky` (Settings → Image, on by default).

## Video cues — what is playing becomes something the cast answers

A gallery video carries **`cues: [{t, text}]`** — the player's own description of what the clip
shows at *t* seconds, edited from the gallery cell's cue button (`openVidCues`). Cues live on the
**video record, not the scene**, so a clip reused in five scenes is described once. While a scene
plays over the story (dock or fullscreen modal), crossing a mark hands that description to the cast
through `fireVidCue` → `runWatchTurn` → **`runMultiCharTurn`** — the same dispatch a typed message
uses, so nobody-present / one-present / many-present all behave as they already do. The description
is pushed first as a `watchCue` narrator beat (it is in the transcript and in history before anyone
answers it), and `chat.watchingNow` renders the **`watching_now`** payload block for that one turn.

**(!) This spends money and attention with nobody pressing send.** A 60 s clip marked every 15 s is
four full reply turns — payload, reply, and the whole `postTurn` tail — and a five-clip scene is
twenty. The feature ships **off** (`state.vidCueOn`), and every rule below exists to bound it:

| Rule | Why |
|---|---|
| One in flight, never a queue (`_vidCueBusy`) | A queued reaction arrives 40 s after the moment left the screen, and pushes the next later still. A mark that lands mid-generation is **dropped**. |
| Cooldown gates **every** fire, not just clip starts (`state.vidCueCool`, default 15 s), stored on `chat.vidCueAt` | This is the requested "skipping clips fires nothing", and it costs nothing to apply uniformly. On the chat rather than in memory so a reload cannot step around it. |
| Cap per play-through (`state.vidCueMax`, default 6; `resetVidCueRun` on open/re-dock) | A long playlist must not react all night unattended. |
| **Only the latest crossed mark fires** | A backgrounded tab stops `timeupdate`, so playback jumps 5 s → 40 s in one event; firing every mark between would dump three reactions at once on moments already gone. |
| A looping clip does not re-fire (`loopedOnce`) | `smCreatePlayer` loops a single clip forever; the same four descriptions on repeat is a stutter, not a scene. |
| Scrubbing back ≥1.5 s resets that clip's fired set | Otherwise re-watching a moment is silent. |
| `document.hidden` blocks | Nothing fires at a screen nobody is looking at. |

`watching_now` is a **one-turn** block: `runWatchTurn` clears it in a `finally`, and the producer
additionally checks the message index it was stamped at (`w.at`), so a stale clip can never be
narrated into the next typed message.

The editor warns rather than blocks, on the things the user cannot see for themselves: a mark past
the clip's real duration (probed via `loadedmetadata`), two marks on the same second, marks packed
closer than the cooldown, and cues being switched off globally.

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
- Video LoRA plumbing was **removed in v27.8** — don't reintroduce per-rule LoRA channels for
  video; the option set in Settings is the whole surface.
- Sending an option a model doesn't accept is a hard 400 (the `1080p` case). Add new options
  behind the same "only when set" rule that `generateVideo` uses.
