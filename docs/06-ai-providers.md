# 06 · AI Providers & Model Plumbing

## `chatCompletion(messages, model, opts)` — every text call goes through here

**Which API** (v107.1): each agent's `fnCfg` bucket names its provider — OpenRouter (default) or
**NanoGPT** (`PROVIDERS`, key `sm_nanokey`); `opts.rp` reads the "rp" bucket, `opts.prov` forces
one. Both speak the OpenAI chat shape; OpenRouter-only fields (`reasoning` object, `provider`
routing, Gemini `safety_settings`) are sent only to OpenRouter.

Anatomy of the request body (OpenRouter `/chat/completions`):

- `model`, `messages`, `temperature` (`opts.temp` ?? `state.temp`), `max_tokens`
  (`opts.max` ?? `state.tokens`).
- **Reasoning control**: reasoning is **disabled by default**
  (`reasoning:{enabled:false, exclude:true}`) — the pipeline is JSON/judgment work that must
  not think out loud, and hybrid models (deepseek-v4-pro) otherwise leak/waste. Three ways back
  in, most specific first:
  1. `opts.reasoning:true` / `false` — one call, wins over everything.
  2. **The agent's own card** (v66.1). `opts.fn` names an `fnCfg` bucket, and that bucket's
     `reason` (`true`/`false`/`null`=Auto) and `effort` decide. ⚠️ The bucket must belong to the
     card that supplies the call's MODEL. v66.1 shipped with four groups crossed — every authoring
     job read Memory, the character generator read Memory and Authoring at once, the arrival
     narration ran the roleplay model through Memory, and the Auto-RP narrator (also the roleplay
     model) read Memory — so turning thinking on for Memory made the Auto-RP narrator think.
     Harmless while a bucket held only a temperature; a visible bug once it held a thinking switch.
     Fixed and pinned in v67.1. This is how a *background* engine
     thinks: turn it on for the gamemaster or the daily engines, leave the routers and trackers
     off. Every bucket ships as Auto, so this changes nothing until you set it.
  3. `state.reasoningOn` + `state.reasoningEffort` — the **roleplay reply only** (`opts.rp`),
     unchanged since v37.6.
  Effort resolves the same way: `opts.reasoning_effort` ?? the bucket's `effort` ?? the roleplay
  setting. `""` (Auto) omits the field at every level.
  ⚠️ The **live voice call** streams straight to OpenRouter and never passes through
  `chatCompletion`, so it reads its bucket itself via `vcReasoning()`. Anything else that builds
  its own request body has to do the same, or its card is a switch wired to nothing.
- **Sampling controls apply to roleplay replies ONLY** (`opts.rp===true`): top_p, top_k,
  frequency/presence penalties from Settings; "" (Auto) omits the field. Background engines
  always run provider defaults so their JSON stays parseable. Explicit `opts.top_p` etc.
  override either way.
- **Provider deny-list**: `state.provDeny` → `provider:{ignore:[...], allow_fallbacks:true}`.
  Default skips Baidu/Alibaba/StreamLake/SiliconFlow (hosts that wrap models in their own
  filter and emit canned "无法…" refusals). `allow_fallbacks` keeps it non-breaking.
- **Gemini safety**: for `google/gemini-*` models (unless toggled off), all four
  `safety_settings` categories are sent as `BLOCK_NONE`.
- **Timeouts** (v99.1, v144.1): every attempt has a ceiling, `opts.timeoutMs ?? 180000`, enforced
  by `fetchWithTimeout`, which also covers reading the body. A timed-out attempt is **not
  retried** when the ceiling is ≥ 60 s (a stall, not a blip). The empty-response rescue has the
  same ceiling (`opts.rescueTimeoutMs`).
- **Retries**: network errors and 429/5xx retried up to `opts.retries ?? 2` with jittered
  backoff; a 429's `Retry-After` is honoured (over 30 s → fail with the wait named). 4xx fail
  fast with a friendly message (`httpMsg`).
- **A 200 that is not a reply** (v144.1): a non-JSON body, or a body carrying only `{error}`,
  fails with a named message and a failed debug row — it no longer throws a raw `SyntaxError` or
  triggers the paid rescue.
- **Background limits** (v144.1): calls without `opts.rp`/`opts.foreground` share a semaphore of
  `MC_BG_MAX` = 4 in flight per provider. A 401/402 trips a 2-minute circuit breaker
  (`_mcBreak`, one toast) during which background calls to that provider are skipped; it lifts
  at once when the key changes, or (v146.1) when a player-started call succeeds. v146.1: a 403
  does **not** trip it (OpenRouter's moderation answers 403 for one flagged input) — it is that
  call's error and names what the provider said. Roleplay replies, calls passing
  `opts.foreground` (generators, Story mode, "Drop me into a scene", a re-illustrate, …) are
  never paused.
- **Stop** (v144.1): roleplay calls register an `AbortController`; the stop button next to Send
  (`#stopBtn`, `stopReply()`) aborts them → `{friendly:"Stopped.", stopped:true}`, no retry, and
  later roleplay calls in the same turn are refused until the send button is re-enabled.
- **Usage**: `d.usage` (prompt/completion tokens) is recorded on the debug row and shown there.
- **Empty-response rescue**: if content comes back empty, one automatic retry with
  `max_tokens = max(1600, 3×)`. When the first response was **thinking-only** (empty content
  but a reasoning trace present), the retry *also* forces `reasoning:{enabled:false,
  exclude:true}` — more headroom alone can just buy the model a longer think. Logged into the
  same debug entry.
- **Debug**: every call opens a `dbg()` entry (label, provider, url, body) and closes with
  `dbgDone(entry, ok|error, result)`.

`extractCompletionText` normalizes provider quirks (string content · content-part arrays ·
`choices[0].text`); `stripInlineReasoning` removes leaked `<think>`/`<reasoning>`/`◁think▷`
blocks and "Final answer:" channel markers from the content field; `looksLikeRefusal` is
described in doc 04.

⚠️ **`message.reasoning` / `reasoning_content` is a thinking trace, not an answer.** A
reasoning model that spends its whole budget thinking returns empty content plus a full
trace. `extractCompletionText` returns `""` for that, so the rescue above fires — it salvages
from the reasoning field **only** when `finalAnswerFrom()` finds an explicitly delimited final
answer (some providers dump the whole channel there). Returning the bare trace instead — which
is what the code did before v29.1 — rendered the model's monologue as the character's line
*and* made the caller believe the call had succeeded, so the recovery retry never ran.

## Which model runs what (fallback chains)

| Function (Settings card) | State key | Fallback |
|---|---|---|
| Roleplay replies | `model` (+ `rpRotation` list) | — |
| Refusal fallback | `fallbackModel` | → `mcModel` → primary |
| Auto-RP narrator | `playerNarrateModel` | → `model` |
| Prompt rewriter (image/video prompts) | `rewriter` | — |
| Multi-character director (routers, presence, arc tracker) | `mcModel` | — |
| Memory & daily engines (builder/query/ranker/condenser, diaries, relationships, calendar, quests, recaps) | `memModel` | — |
| Rolling recap (calls) | `recapModel` | → `memModel` |
| Gossip & offstage intent | `gossipModel` | → `memModel` |
| Embeddings | `embedModel` | → `openai/text-embedding-3-small` |
| Gamemaster / Scene Writer / judges | `gmModel` | — |
| Character generator & background tasks | `bioModel` | — |
| Authoring model (universe gen, director notes, genre packs, prompt tuner) | `authorModel` | — |
| Image/video router | `routerModel` | — |
| Voice calls | `callModel` | — |
| STT fixer | `sttFixModel` | → `callModel` |
| Tracker with its own model | `tracker.model` | → `memModel` |

**Model rotation** (`rpRotation`, comma-separated): each roleplay reply uses the next model in
the list, cycling; index persists (`sm_rprotidx`). Rotation picks only the *primary* model —
refusal fallback logic is unchanged.

**Per-function overrides**: `fnTemp(fn, default)` / `fnTok(fn, default)` read
`state.fnCfg[fn]` (edited via the small temp/tok fields under each LLM Selection card:
`gm`, `mc`, `rewriter`, `mem`, `unigen`, `router`, `call`).

## Image / video providers

Per-rule dispatch (see doc 10 for the pipeline): `effImgProvider(rule)` /
`effVidProvider(rule)` — a rule's own `provider` wins, else the global default.

| Provider | Functions | Notes |
|---|---|---|
| ModelsLab (`ML` base) | `modelslabCall/mlResolve/modelslabImage/modelslabVideo` | v6 API; async polling via `fetch_result`; CORS may block browser calls (friendly `mlCorsMsg`). Smart routing rules carry model_id + LoRA. |
| AtlasCloud (`ATLAS` base) | `atlasGenerate` (submit→poll→url), `atlasImage`, `atlasUpload`, `generateVideo` (the one video request builder, v27 — doc 10), `atlasTTS` (xAI voices), `atlasLipsync` (Kling) | The workhorse. `civitaiLoraUrl` appends the CivitAI token to gated LoRA links; `atlasLoras` maps image-rule LoRAs into high/low-noise channels (video LoRA plumbing was removed in v27.8). |
| fal.ai | `falImage` | z-image turbo LoRA; NSFW checker toggle (`falSafety`). |
| OpenRouter image | `imageCompletion` | Multimodal chat models (`modalities:["image"]`). |

Media helpers: `httpsMedia`/`toPlayableVideo` (protocol fixups), `blobToDataURL`,
`_isUrl/atlasOut` (result extraction).

v144.1 transport rules for these: submits and polls go through `fetchWithTimeout` (submit
120–180 s, poll 30 s); the OpenRouter bearer is sent only to OpenRouter's own origin
(`_orAuthFor` — `pollVideo`'s `polling_url`/`unsigned_urls` can name a CDN); the ModelsLab key
is posted only to ModelsLab hosts (`_mlHostOk`). Embeddings (`embedText`) have a 30 s ceiling,
and fall back to the OpenRouter key only when the endpoint is OpenRouter (`embedKeyVal`).
Any stored URL rendered into `src=`/`href=`/`url()` passes `escUrl`/`cssUrl` (data:image|video|
audio, blob:, http(s) only).

## Speech

- **Dubbing (spoken replies)**: `speakText`/`dubMessage` → engine `xai`
  (`atlasTTS`, expressive delivery tags kept — see the `spoken_delivery` payload block) or
  `inworld` (streamed via the user's relay). Per-character voice overrides
  (`ttsVoiceFor`); narration voice mode splits `*narration*` (Inworld narrator w/ echo FX,
  `_narrFxInto`) from dialogue (character voice); a strict dub queue
  (`_enqueueDub/_pumpDub`) keeps lines in order; `ttsCleanText` strips tags per engine.
- **Talking video**: `dubAsVideo` = TTS audio + Kling lip-sync over the scene image.
- **Narration mode (open mic)**: `nmStart/nmStop/nmCommit` — continuous Deepgram mic in chat;
  commits after `nmPatience` ms of silence; spoken input flows through Auto-RP with the
  verbatim rule; wake-lock held.
- **Voice calls** (Stage 2, ~line 26980–27570): `startVoiceCall` wires mic → Deepgram live WS
  (`vcStartDeepgram`, endpointing/utterance-end tunables) → optional STT fixer → `callModel`
  reply (streamed through a sentence chunker `vcMakeChunker`) → Inworld TTS relay
  (`vcSynth`/`vcPumpTts`) → PCM playback queue with barge-in (`vcBargeIn`). A rolling
  conversation summary (`summBuildChapter`, thresholds `summThreshold/summEvery/summKeep`)
  bounds the call context; `buildCallInstructions` builds the call payload (bio,
  relationships, memories, scene); `commitCallMemory` writes the call into memory afterwards.
  Full trail in `#callDbgModal` (`vcDbgEvent`, `voiceDebugExport`).

## The Debug screen (`#screen-debug`)

`dbg(label, provider, url, body)` pushes an entry (newest first, bounded), `dbgDone` completes
it with status/result/duration/token estimate. `renderDebug` renders each as an expandable
row; `payloadCapsules`/`splitSystemSections` pretty-print system messages into labeled
capsules — this is how you *see* the assembled payload blocks in practice. `scrubSecrets`
redacts keys; `exportDebug` downloads the latest payloads as JSON ("send for diagnosis").
Local, no-network entries are also logged (memory-retrieval ranking trace per turn).

**Rule: any new network call must be wrapped in `dbg`/`dbgDone`.** If it isn't in the Debug
log, it doesn't exist for troubleshooting purposes.
