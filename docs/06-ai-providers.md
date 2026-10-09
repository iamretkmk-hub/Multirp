# 06 · AI Providers & Model Plumbing

## `chatCompletion(messages, model, opts)` — every text call goes through here

**Which API** (v107.1): each agent's `fnCfg` bucket names its provider — OpenRouter (default) or
**NanoGPT** (`PROVIDERS`, key `sm_nanokey`); `opts.rp` reads the "rp" bucket, `opts.prov` forces
one. Both speak the OpenAI chat shape; OpenRouter-only fields (`reasoning` object, `provider`
routing, Gemini `safety_settings`) are sent only to OpenRouter.

**A borrowed model travels with its own provider** (v150.28). An agent whose model field is blank and
that falls back to another card's model must also use THAT card's provider — otherwise, e.g., a blank
Book model on a Narration card set to NanoGPT sent the OpenRouter roleplay id to NanoGPT. Pick the model
with `agentModel([bucket, model], …)` (first model that is set wins; `prov` is that bucket's provider)
and pass `{fn:<own bucket>, prov:r.prov}`: `fn` still owns creativity, tokens and thinking. Helpers:
`authoringAgent()` (author → bio → roleplay), `mcAgent()` (router → roleplay). A call with no bucket
that uses the roleplay model passes `prov:provId("rp")` (day transition, travel narration).

Anatomy of the request body (OpenRouter `/chat/completions`):

- `model`, `messages`, `temperature` (`opts.temp` ?? `state.temp`), `max_tokens`
  (`opts.max` ?? `state.tokens`).
- **Reasoning control**: reasoning is **disabled by default**
  (`reasoning:{enabled:false, exclude:true}`) — the pipeline is JSON/judgment work that must
  not think out loud, and hybrid models (deepseek-v4-pro) otherwise leak/waste. Three ways back
  in, most specific first:
  0. **(!) v150.15 — a model that only works with reasoning.** Its endpoint answers "reasoning off" with a
     4xx ("Reasoning is mandatory for this endpoint and cannot be disabled"); every engine on it failed.
     On such a refusal (`_reasonRequiredMsg`) the same request is sent again once with reasoning on
     (OpenRouter `reasoning:{enabled:true}`; elsewhere `reasoning_effort:"medium"`) and room for the
     thinking. The model is remembered per provider (`sm_reasononly`, `_reasonOnly`) and gets reasoning
     on from then on, whatever the switches say.
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
| **Every Decisions-API request** (v150.64) | `decModel` (`decisionsModel()`) | → `openai/gpt-6-luna-decisions` |
| Memory relevance judge (Decisions API, v150.29) | `memJudgeModel` (override) | → `decModel` |
| Reply check (Decisions API, v150.30) | `replyCheckModel` (override) | → `decModel` |
| Trackers in one request (Decisions API, v150.31) | `trackDecModel` (override) | → `decModel` |
| Strict gates: promise / task / meeting / quest / motive (Decisions API, v150.33) | `gateModel` (override) | → `decModel` |
| Emotion pick and the reply's questions (Decisions API, v150.34) | `emoModel` (override) | → `decModel` |
| Gamemaster / Scene Writer / judges | `gmModel` | — |
| Character generator & background tasks | `bioModel` | — |
| Authoring model (universe gen, director notes, genre packs, prompt tuner) | `authorModel` | — |
| Image/video router | `routerModel` | — |
| Voice calls | `callModel` | — |
| STT fixer | `sttFixModel` | → `callModel` |
| Tracker with its own model | `tracker.model` | → `memModel` |

**The Decisions API** (v150.29) is the one kind of text-model call that does not go through
`chatCompletion`: it is not a chat completion. `decisionsCall(breaker, body, dbgEntry, timeoutMs)` posts
`{model, state, questions}` to `https://openrouter.ai/api/alpha/decisions` (`DECISIONS_URL`) with the
OpenRouter key and returns `answers` (or null on any failure); `_decYes` reads a noul answer's
probability. Output is free; input is billed. Each feature has its own pause (`_decBreaker`): a 401/402
pauses it 2 minutes, a 400/404/405 30 minutes, three failures in a row 10 minutes, one toast each, lifted
by a key change — so a reply check refused on one scene's content never stops memory recall. Users: the
memory relevance judge (doc 07), the reply check (doc 04), trackers in one request (doc 09) and the strict
gates (doc 08). The path
is `alpha`, so all parsing lives in `decisionsCall` / `_decYes` and each feature's own reader.

**v150.64 — one Decisions model, and refusals.** Every Decisions request takes its model from
`decisionsModel()` (`state.decModel`, `sm_decmodel`; blank = `DECISIONS_DEFAULT_MODEL`): image decisions, the turn
router, the Gamemaster judge, movement, status checks, the proactive text gate, and — through their optional overrides
(`emotionModel`, `replyCheckModel`, `trackDecModel`, `gateModel`, `memJudgeModel`, each blank = the Decisions model) —
the emotion pick and the reply's questions, the reply check, trackers, strict gates and the relevance judge. No request
names `DECISIONS_DEFAULT_MODEL` itself. The six boxes are their own card, **2 · LLM Selection → Decision models**
(`#decModelsCard`), apart from the embeddings box, which says they take Decisions-API models only.
When the API answers with an error naming a refused question (`502 'OpenAI refused to answer question "emotion"'`,
`_decRefusedQ`), `decisionsCall` sends the request once more without that question and with the scene as dialogue only
(`_decDialogueOnly`: each "Name: line" keeps its quoted words; narration, `*actions*` and `_thoughts_` go; on
`state.scene` / `state.scene_before_the_reply`, or a string state), so the rest of the bundle arrives. A refusal never
counts toward the pause (first try or retry). The Debug row carries `e.retry` {refused, firstError, sceneDialogueOnly,
questionsLeft, result, note}, shown on the card and exported. Pinned by `tests/decision-models.browser.js`.

**v150.64 — the reasoning on the Debug row.** `chatCompletion` keeps a reasoning model's own reasoning on its Debug
entry (`_dbgReasoning`: `message.reasoning` / `reasoning_content`, else the text and summaries of `reasoning_details`;
an encrypted block only is counted; at most 20000 characters). The expanded card shows it under "The model's reasoning",
folded by default; the export carries it. `exportDebug` exports every entry in the log (up to `DBG_MAX`, 200). Pinned by
`tests/debug-reasoning.browser.js`.

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
row (the payload itself is rendered when the row is opened). A segmented switch picks the view
(`K.dbgView`, `dbgViewMode`/`setDbgView`): **As sent** is the request body verbatim (JSON for a
chat payload), **Readable** (v150.63, replaced the old "Capsules" view; a stored `"capsules"`
reads as Readable) is `pvReadable` — one block per message with a bold badge
("message N — role (name)"), `#` heading lines bold, and the text coloured by where it came from:
white = fixed wording (fragment main bodies, options chosen by a code fact, anything of unknown
source), green = live data (every `{{call//…}}` value except the layout headings and an engine's
own `{{call//prompt}}`, every `{{value}}`, the conversation turns), red = chosen by the decision
model (a choose-when option whose ask passed, or whose condition reads a flag in
`PV_DECISION_FLAGS`: emotion, intensity, tone, ego, broke_character, spoke_for_player, repeated,
lost_track). A Decisions request reads as `# STATE` (indented `key: value`, values green) and
`# QUESTIONS` (each with its instructions and criteria); any other payload as headings and
`key: value` lines. Copy gives the readable plain text (or the JSON in As sent), then the response.

**How the colours are known without touching what is sent.** `ptBuildMessages` and `epMessages`
build twice: the first pass is the payload that is sent, unchanged; the second passes `ann` to
`ptExpand` (and `annotate` to `fragCompile`), which marks data and red options with private-use
characters (`PV_D0/PV_D1`, `PV_R0/PV_R1`). Red marks are taken off each paragraph before
`ptExpand`'s logic reads it and put back on its output line by line; data marks are placed
inside each line (after the indent and a heading's `# `), so the annotated build, stripped, is
the sent build — `pvRemember` keeps it only when that holds, in a bounded map keyed by the clean
message text. `dbg()` looks each logged message up (`pvAnnotList`) and stores `entry.annot`, used
only by the Readable view: `exportDebug` writes the clean payload, and a payload with no
annotation (hand-built, or a rebuilt list) reads with system white and conversation turns green.
Markers never leave the app: both builders run `pvCleanMessages` on their output, and
`chatCompletion` does it again before the request body is made. The Payloads screen's previews
(`ptPreview` "Preview with my story", `epPreview`) use the same renderer.
`payloadCapsules`/`splitSystemSections` remain as helpers but no longer drive a view. `scrubSecrets`
redacts keys; `exportDebug` downloads the latest payloads as JSON ("send for diagnosis").
Local, no-network entries are also logged (memory-retrieval ranking trace per turn).

**Rule: any new network call must be wrapped in `dbg`/`dbgDone`.** If it isn't in the Debug
log, it doesn't exist for troubleshooting purposes.

## v150.80 — a heat model and a fallback model

Settings → LLM Selection → Roleplay has two new optional fields:

- **Heat of the moment model** (`state.heatModel`, `sm_heatmodel`). While Heat of the moment is on (`state.heatOn`), or a
  reply is a heat beat (`chat._heatBeat`), `generateCharacterReply` sends the reply to this model instead of `rpModel()`.
  Blank: the roleplay model, as before. A heat turn does not advance the model rotation.
- **Fallback model** (`state.fallbackModel`, `sm_fallbackmodel` — a key that existed without a field since v21). When a
  roleplay reply (`generateCharacterReply`) or a text reply (`_replyToText`) is refused (`looksLikeRefusal`), comes back
  empty or as instruction talk, or the request fails, that one reply is asked again ONCE with the fallback model
  (`_rpFallbackCall`; Debug row "… · fallback model") and its answer is used. Never after a Stop, never the model that just
  answered, never more than once. Blank (the default) keeps v148.7: no automatic second call. A refused text is no longer
  posted as the character's text; the player gets a toast.

## v150.82 — the player's turn is read aloud too

While replies are voiced (`state.autoSpeak` or `state.narrMode`), the auto-RP player narrator (`narratePlayerTurn`) gets the
standard spoken delivery appended to its system prompt (`_standardSpokenDelivery`): the "Voice delivery" fragment's
`voiced` option as the player has it (filled with the player as speaker), else the `voice_delivery` block template. Heat on
or off, it is always the standard wording — never `voiced_heat` / `heat_delivery`. Voicing off: nothing is added.

## v150.85 — spoken in the order it is written

With the narration voice on, `narrSplit` gathered all of a reply's *narration* into one clip and all its "quoted"
lines into another, so the narrator read everything first and the character spoke afterwards. `autoSpeakMsg` and
`speakPlayerTurn` now go through `_enqueueSpokenInOrder`:

- `speechSegments(text)` cuts the text where it changes between narration and speech. A quoted span (`"…"`, `“…”`,
  `«…»`) is dialogue wherever it stands, inside an *action* too; everything else is narration with its asterisks
  dropped (`ttsCleanText`). Adjacent pieces of one kind are joined; a piece with no letters is skipped.
- Every piece starts synthesizing at once and the dub queue plays them in order, so there is no gap between pieces
  beyond the clip boundaries.
- `_speechFastStart` cuts an opening piece over ~220 characters after its first sentence: synthesis returns a clip
  only when the whole clip is made, so the first sentence comes back (and plays) while the rest is still being made.
  The dialogue-only path (narration voice off) uses it too; otherwise that path is unchanged (one clip of the quotes).
- A player's turn typed without any marks is still all speech.

**Characters narrate in their own voice** (`narrSelf`, Settings → Dubbing, off by default): narration is read by the
speaking character (the player's turns: the player's voice) through `_narrSelfFxInto` — a narrower dry path
(high-pass 220 Hz, low-pass 4.2 kHz), a little quieter, with a short soft tail — so it reads apart from the same
voice's dialogue. Off, the narrator voice reads narration through the existing `_narrFxInto` chain.

What already made voicing faster: every piece is synthesized in parallel the moment the reply lands, and the queue
only sequences playback. Voicing still starts only when the whole reply has been written (replies are not streamed).
Test: `tests/speech-order.browser.js`.

## v150.86 — a piece plays as it arrives

The relay streams each line as small NDJSON chunks of PCM (each a standalone WAV). The dub queue used to collect the
whole stream before playing a sample. Now the queue's pieces (narration, dialogue, a text read aloud, the player's
turn) go through `_inworldStream(text, voiceId)`, which starts the request when the piece is queued and keeps chunks
as they land (WAV header stripped per chunk; an odd trailing byte carried to the next chunk), and the queue plays them
with `_playStreamAwait(stream, fx, alive)`:

- the first chunk is scheduled at once; later chunks are gathered to at least 0.1 s and scheduled back to back on the
  shared context, through the narrator / own-voice effect for narration;
- a chunk that arrives after the scheduled audio ran out starts 50 ms ahead (`stream.underrun` in the voice log);
- `_dubActive` holds from the first sample to the last, so the open mic stays gated through a slow chunk;
- a `_dubKill` (generation bump) or any `_stopDub` (`_dubStopN`) ends a piece still streaming in, and a 250 ms poll
  catches one waiting on a stalled relay; a failed relay resolves as "no-audio" with its reason, never a wedge;
- the wall-clock failsafe of `_playBufAwait` (a suspended context never ends a source) applies once the stream is done.

`_inworldFetchPcm` (whole clip) is unchanged for the paths that need the full clip: the storyteller, diary read-aloud,
lip-sync audio, the voice-sample track and the relay re-voice fallback. Test: `tests/stream-playback.browser.js`.

## v150.87 — the reply's decisions, one request per topic

Before a reply, `emotionEnsure` asked the Decisions API about five topics in one request: the emotion pick (emotion,
intensity, id/superego), the fragment options that ask the decision model, the character's spoken limits, who of the
absent people is being talked about, and which goals are already done. The state was the union of every topic's material,
and nothing told the model which part belonged to which question.

With **One request per topic** on (Settings → Decisions, `decSplit`, on by default) each topic is its own request, sent
together with `Promise.all`:

| topic | questions | state |
|---|---|---|
| Emotion | `emotion`, `intensity`, `ego` | character, scene, earlier feeling, feelings toward the one answered, stakes, memories that weigh |
| Reply asks | `q_*` | the emotion state plus the asks' own material (memories deduplicated as before) |
| Spoken limits | `limit_*` | character, scene, the new lines, limits on record |
| Who is talked about | `rel_*` | character, scene, the absent people with their ties |
| Goals done | `goal_done_*` | character, scene, the goals, memories bearing on them, the player's lines — and only when another topic goes |

- The wait is the slowest request, not the sum. Each topic has its own pause (`_emoBreak`, `_askDecBreak`,
  `_limDecBreak`, `_relDecBreak`, `_goalDecBreak`): a failure or a paused topic loses that topic only, and a refused
  question is retried inside its own topic (the v150.64 retry).
- The answers are merged and applied exactly as before, so the same answers give the same result in either mode.
- Debug: a "Reply decisions · {name} · N requests at once" row with the applied result, and one row per topic request.
- Cost: the scene goes with every topic, so input tokens for this step rise (output is free on these models).

Off, the one request carries everything as before. Test: `tests/decision-split.browser.js`; the bundle's own tests pin
the switch off.
