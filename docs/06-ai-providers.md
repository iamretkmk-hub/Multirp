# 06 · AI Providers & Model Plumbing

## `chatCompletion(messages, model, opts)` — every text call goes through here

Anatomy of the request body (OpenRouter `/chat/completions`):

- `model`, `messages`, `temperature` (`opts.temp` ?? `state.temp`), `max_tokens`
  (`opts.max` ?? `state.tokens`).
- **Reasoning control**: reasoning is **disabled by default**
  (`reasoning:{enabled:false, exclude:true}`) — the pipeline is JSON/judgment work that must
  not think out loud, and hybrid models (deepseek-v4-pro) otherwise leak/waste. Opt back in
  per call (`opts.reasoning:true`) or globally (`state.reasoningOn`). Reasoning *effort* is
  forwarded only for roleplay replies (`opts.rp`).
- **Sampling controls apply to roleplay replies ONLY** (`opts.rp===true`): top_p, top_k,
  frequency/presence penalties from Settings; "" (Auto) omits the field. Background engines
  always run provider defaults so their JSON stays parseable. Explicit `opts.top_p` etc.
  override either way.
- **Provider deny-list**: `state.provDeny` → `provider:{ignore:[...], allow_fallbacks:true}`.
  Default skips Baidu/Alibaba/StreamLake/SiliconFlow (hosts that wrap models in their own
  filter and emit canned "无法…" refusals). `allow_fallbacks` keeps it non-breaking.
- **Gemini safety**: for `google/gemini-*` models (unless toggled off), all four
  `safety_settings` categories are sent as `BLOCK_NONE`.
- **Retries**: network errors and 429/5xx retried up to `opts.retries ?? 2` with backoff;
  4xx fail fast with a friendly message (`httpMsg`).
- **Empty-response rescue**: if content comes back empty (reasoning burn), one automatic
  retry with `max_tokens = max(1600, 3×)`. Logged into the same debug entry.
- **Debug**: every call opens a `dbg()` entry (label, provider, url, body) and closes with
  `dbgDone(entry, ok|error, result)`.

`extractCompletionText` normalizes provider quirks; `stripInlineReasoning` removes leaked
`<think>`-style blocks; `looksLikeRefusal` is described in doc 04.

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
| AtlasCloud (`ATLAS` base) | `atlasGenerate` (submit→poll→url), `atlasImage`, `atlasVideo`, `atlasUpload`, `wanAnimateVideo` (wan-2.2 turbo-spicy i2v LoRA), `wanExtendVideo` (wan-2.5 video-extend), `atlasTTS` (xAI voices), `atlasLipsync` (Kling) | The workhorse. `civitaiLoraUrl` appends the CivitAI token to gated LoRA links; `atlasLoras` maps rule LoRAs into high/low-noise channels. |
| fal.ai | `falImage` | z-image turbo LoRA; NSFW checker toggle (`falSafety`). |
| OpenRouter image | `imageCompletion` | Multimodal chat models (`modalities:["image"]`). |

Media helpers: `httpsMedia`/`toPlayableVideo` (protocol fixups), `blobToDataURL`,
`_isUrl/atlasOut` (result extraction).

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
