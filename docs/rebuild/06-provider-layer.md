# 06 · Provider Layer

Layer 2. The only place in the system that talks to the network.

Its job is to make every AI capability the app needs look identical to the layers above,
regardless of which vendor is behind it, and to be replaceable when a vendor changes or
disappears — which they do, without notice.

## Capabilities

The layer exposes exactly six capabilities. **R-PROV-1 — Layers above MUST address capabilities,
never vendors.** A domain engine asks for *text completion*; it does not know which service
answered.

| Capability | Used by |
|---|---|
| **Text completion** | Every reply, every judge, every background engine |
| **Embedding** | Semantic memory |
| **Image generation** | Illustration, portraits, covers, maps, playground |
| **Video generation** | Animate, extend, scenes |
| **Speech synthesis** | Dubbing, narration, calls |
| **Speech recognition** | Open mic, calls |

**R-PROV-2** — A capability MUST be usable with more than one vendor behind it, selected by
configuration. No capability may be hardwired to one service.

**R-PROV-3** — Credentials MUST be held only in declared storage keys, never in source, and MUST
NOT be transmitted anywhere except the vendor they belong to. **The app MUST NOT proxy a user's
credentials through any third party**, including to work around a vendor's browser restrictions
([`01-product-spec.md`](01-product-spec.md), non-goals).

## Text completion — the gateway

Every text call in the app goes through one function. **R-PROV-4 — There is exactly one text
call path. No component may reach a provider directly.**

### Request contract

The caller supplies: the assembled messages, a model selection, and a **call class**. Everything
else is derived.

**R-PROV-5** — Every call MUST declare its class. The class determines sampling policy, and the
distinction is not cosmetic:

| Class | Is | Sampling policy |
|---|---|---|
| `roleplay` | A character speaking; the output is read as prose | User sampling controls apply — temperature, nucleus, top-k, repetition penalties |
| `engine` | A background job whose output is **parsed** | **Provider defaults only.** No user sampling, ever |
| `content` | Generated prose that is not a character's line — narration, a diary, a recap | User temperature only |

**R-PROV-6** — Sampling controls MUST NOT be applied to `engine` calls under any circumstance.

> **Parity — keep:** this looks like an oversight until you understand it. Repetition penalties
> and unusual sampling derail structured output — the model starts avoiding the very field names
> it is required to repeat. Background engines run provider defaults *by design* so their output
> stays parseable. The same reasoning governs reasoning: see below.

### Reasoning control

**R-PROV-7** — Extended reasoning MUST be **off by default**, with the trace excluded.

**R-PROV-8** — Reasoning MAY be enabled per call, and reasoning *effort* is forwarded only for
`roleplay` calls.

The pipeline is overwhelmingly judgement and structured output that must not think out loud;
hybrid models otherwise leak thinking into the answer or burn the whole budget on it.

**R-PROV-9** — A reasoning trace MUST NEVER be treated as answer text.

> **Redesign — was:** the reasoning field was returned as content when content was empty. That
> did two bad things at once: it rendered the model's private monologue as a character's spoken
> line, *and* it made the gateway believe the call had succeeded — so the recovery retry never
> ran and the real failure was masked. The current build fixed it by returning empty for a
> thinking-only response and salvaging from the trace only when an explicitly delimited final
> answer is present. **Now:** R-PROV-9 states it as an invariant, and the empty-content path
> (below) is the only handler for a thinking-only response.

### Recovery

Four distinct failure modes, four distinct handlers. **R-PROV-10 — They MUST NOT be conflated;
each has a different correct response and a different message to the user.**

| Failure | Detection | Response |
|---|---|---|
| **Transport** | Network error, 429, 5xx | Retry with backoff, bounded |
| **Client** | 4xx | Fail fast with a mapped, plain-language message. No retry |
| **Empty content** | Content empty, call otherwise fine | One retry with a raised token budget. If the first response was **thinking-only**, the retry MUST also force reasoning off — more headroom alone just buys a longer think |
| **Refusal** | Recognised canned refusal, or output overwhelmingly in a language the story is not in | Retry once on the configured fallback model, then a second alternate, then give up |

**R-PROV-11** — A refusal MUST NEVER be rendered as a character's line, and MUST NOT be reported
to the user as a token-limit problem. The honest message is that the model declined and a
different model may not.

**R-PROV-12** — Recovery attempts MUST be recorded in the same debug entry as the original call,
not as separate calls. One logical request is one entry with its history.

### Normalisation

**R-PROV-13** — Provider response quirks MUST be normalised inside layer 2 and MUST NOT leak
upward: string content versus content-part arrays versus legacy completion shapes; leaked
`<think>` blocks and channel markers stripped from content.

**R-PROV-14** — Provider-specific request adjustments — safety-category settings for vendors that
require them, provider deny-lists, model-family quirks — MUST be table-driven configuration, not
conditionals scattered through the call path.

**R-PROV-15** — A provider deny-list MUST be non-breaking: excluding a host falls back to another
rather than failing the call. Where the vendor's identifiers must match exactly, the debug entry
MUST show the identifier actually used so the user can correct their list.

> **Parity — keep:** the default deny-list exists because some hosts wrap models in their own
> filter and return canned refusals in another language. That is a real, reproducible failure
> mode that looks like the *model* refusing, and users cannot diagnose it without this.

## Model selection

**R-PROV-16** — Every distinct function MUST have its own model selection with a declared
fallback chain, and every one of them MUST be visible in settings
([principle 6](00-principles.md#6--nothing-hidden)).

The functions: roleplay replies · refusal fallback · player-turn narrator · prompt rewriter ·
turn director · memory and daily engines · rolling recap · gossip and intent · embeddings ·
gamemaster and judges · character generator · authoring · media router · voice call · speech
correction · per-tracker override.

> **Parity — keep:** that list looks excessive and is not. These jobs have genuinely different
> requirements — a cheap fast model is right for routing and wrong for a reply; a model that
> refuses freely is fine for a chronicler and useless for the story. The current app's history
> shows several of these being *added* as fixes when a hidden hardcoded choice turned out to be
> wrong for someone.

**R-PROV-17** — Per-function temperature and token overrides MUST be available, defaulting to
the global value.

**R-PROV-18** — Roleplay model **rotation** MUST be supported: a list cycled per reply, with the
index persisted. Rotation selects the primary model only and MUST NOT alter refusal-fallback
behaviour.

## Media providers

**R-PROV-19** — Image and video generation MUST support per-rule provider selection: a rule's own
provider wins, otherwise the configured default.

**R-PROV-20** — Asynchronous generation (submit → poll → retrieve) MUST be modelled as a job with
explicit states — `queued` · `running` · `done` · `failed` — surfaced to the UI. A job MUST
survive the user navigating away and MUST be recoverable on return.

**R-PROV-21** — Every input a media request references — a source frame, a reference image, a
mask — MUST be resolvable by the provider at request time. Where the provider requires a URL, the
asset MUST be hosted **before** the request is sent, and a hosting failure MUST fail the request
loudly rather than silently producing an unconditioned result.

> **Redesign — was:** a frame upload that failed produced a request without it, which succeeded
> and returned a plausible-looking video that had simply ignored the conditioning. A silent
> quality regression is the hardest possible bug to notice. **Now:** R-PROV-21 makes a missing
> input a failed request.

**R-PROV-22** — Result extraction MUST be tolerant of documented shape variation, and a result
that cannot be located MUST be reported with the raw response retained in the debug entry.

**R-PROV-23** — Where a provider's browser restrictions can block requests (cross-origin policy,
referrer policy, bucket policy), the layer MUST detect the condition and explain it in the user's
terms. **It MUST NOT be worked around by routing through a third party** (R-PROV-3).

## Speech

**R-PROV-24** — Synthesis MUST be queued and ordered. Lines are spoken in the order they were
generated; a slow line does not let a later one overtake it.

**R-PROV-25** — Per-character voice selection MUST be supported, with a separate narration voice.

**R-PROV-26** — Voice-delivery markup that a synthesis engine understands MUST be stripped for
engines that do not, and MUST NOT reach the transcript as visible text.

**R-PROV-27** — Real-time calls MUST support barge-in — the player interrupting mid-utterance —
and MUST bound their own context with a rolling summary rather than an unbounded transcript.

**R-PROV-28** — A microphone session MUST NEVER be persisted or auto-resumed. A reload must never
reopen the mic. This rule extends to any future capture capability.

## Observability

**R-PROV-29** — Every network call MUST open a debug entry before the request and close it with
outcome, duration, and result. **A call that is not in the debug log does not exist for
troubleshooting purposes**, and on a phone there is no other diagnostic surface.

**R-PROV-30** — The debug entry MUST carry the full assembled request, the model and provider
actually used, the raw response, and the recovery history (R-PROV-12).

**R-PROV-31** — Credentials MUST be redacted in the debug view and in its export
([`03-visual-design-system.md`](03-visual-design-system.md), R-VIS-27).

**R-PROV-32** — Local decisions that spend no network — memory retrieval ranking in particular —
MUST be logged in the same surface, marked as local.

## Cost and honesty

**R-PROV-33** — Every debug entry MUST carry a token estimate split between instruction content
and transcript content, and the UI MUST flag when the transcript share falls below the threshold
in R-PROD-7. This single number is the app's best diagnostic for "the replies feel mechanical".

**R-PROV-34** — Provider errors MUST be mapped to plain language per condition — rate limited,
out of credit, model unavailable, model declined, request too large, blocked by the browser —
and MUST NOT be shown as raw status codes (R-UX-30).
