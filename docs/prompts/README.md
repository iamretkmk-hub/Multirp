# How StoryMind's prompts work

This folder is written for someone — or something — about to rewrite these prompts. It has three
parts:

| File | What it is |
|---|---|
| `README.md` (this file) | the machinery. The rules that decide whether a prompt works at all. |
| `catalogue.md` | every prompt: purpose, when it fires, what it is handed, what it must return. |
| `flows.md` | how they chain. Which prompt's output becomes which prompt's input. |

Read this file first. Most ways to break a prompt here are ways of breaking one of the mechanisms
below, and none of them is visible from the prompt text on its own.

---

## 1 · What a prompt is, in this app

Every prompt is **data**, not code. It lives in one of two tables — `PROMPT_REGISTRY` (the named
engines) or `X_ENGINE_PROMPTS` (the same thing, a second table for historical reasons) — and it is
editable by the user in **Settings → Payloads**. A test (`tests/no-code-prompts.test.js`) fails the
build if prompt text appears anywhere else in the source.

Resolution order when the app asks for a prompt, via `up("key")`:

1. the **per-universe** override, if this world has one;
2. the **global** stored copy, if the user has edited it;
3. the **shipped default** (`DEFAULT_…`).

So a user's edit is sticky and survives updates. Which creates the single most important rule here:

> ⚠️ **Changing a shipped default does not change anything for a user who has already edited that
> prompt.** Their stored copy wins. Updates reach them only through a *refresh pipe* — see §7.

---

## 2 · The two shapes of a request

**A reply payload** — the character speaking. Assembled from dozens of small blocks in a
user-editable order (`REPLY_ORDER` / the layout editor), including several of the prompts in the
catalogue. Nothing in it is a standalone request; it is one long system message plus the
transcript. `baseInstruction`, `formatRules`, `narrationRules`, `heatRules` and `textReplyPrompt`
are fragments of this, never sent alone.

**An engine call** — everything else. One prompt, one job, one answer, usually JSON. Built by
`epSend(key, systemText, sections, values)`:

```
system:  the prompt text, with {{placeholders}} filled
user:    each SECTION under its own label, in a fixed order
```

A section whose value is empty is **dropped together with its label**. This matters when you write:
a prompt must read correctly when any subset of its sections is missing. Do not write "the list
below" if the list can be absent.

---

## 3 · Placeholders (`{{name}}`)

Two different vocabularies, and confusing them is a classic failure.

**Global values** — available to *every* prompt, filled from the world state:
`{{user}}`, `{{day}}` / `{{current_day}}`, `{{period}}`, `{{location}}`, `{{sub_area}}`,
`{{universe}}`, `{{story_language}}`.

**Reply-scope values** — `{{char}}`, `{{self}}`, `{{npc.name}}`, `{{target}}`, `{{response.target}}`.
These are filled **only in a reply payload**, because an engine in general has no single character
writing the turn. An engine that *does* have one — `psychePrompt` is about exactly one person — must
have its call site pass the value explicitly, and the catalogue's **supplied** row shows whether it
does.

> ⚠️ An unfilled placeholder is **left visible on purpose**. `{{self}}` reaches the model as those
> eight characters. This is deliberate: a bug you can see beats an empty string where a name should
> be. If you add a `{{placeholder}}` to a prompt, something has to supply it — check the
> **supplied** row in the catalogue, and `tests/engine-values.test.js` enforces it.

---

## 4 · Output contracts

Engines marked `json:true` are parsed. **The engine reads the keys named under "Returns" and
ignores everything else.** Renaming a key does not produce an error — it silently disables whatever
that key drove. Adding a key is free but nothing will read it.

Several prompts have deliberately lenient parsers (`memReconcile` accepts either `{"memories":[…]}`
or a bare `{"content":…}`), because they are user-editable and a reasonable edit should not throw
the answer away. Do not rely on that; match the documented shape.

---

## 5 · Language

Three regimes, applied by the app *after* your prompt text and stated to override it:

- **`engineLangDirective()`** — everything in **English**. Used for engine records: memories, notes,
  summaries, reasons. The memory bank is one language on purpose; lexical retrieval and the
  condenser both compare across it.
- **`mixedLangDirective([fields])`** — the named fields in the **story language** (what the player
  reads); every other field in English. Used where one answer contains both, e.g. a world event
  with a `headline` the player sees and `memories` that go into the bank.
- **`langDirective()`** — story language throughout. Used for text the player reads directly.

> ⚠️ Do not write a language instruction into a prompt body that contradicts the directive it will
> receive. Several prompts said "write a Turkish memory" while the directive forced English; the
> directive won, but the request contained both instructions at once. State the language once, in
> the directive, and let the body describe the *content*.

---

## 6 · Model buckets

Each call names an `fn` bucket, and that bucket is a card in **Settings → LLM Selection** carrying a
creativity slider, a token cap and a thinking (reasoning) switch:

| Bucket | Card |
|---|---|
| `rp` | Roleplay |
| `mem` | Memory & Daily Engines |
| `gm` | Gamemaster, Scene Writer & Judges |
| `mc` | Multi-Character Director |
| `rewriter` | Prompt Rewriter |
| `unigen` | Authoring model |
| `bio` | Character Generator & Background Tasks |
| `router` | Image/Video Router |
| `call` | Voice Calls — read directly by the live-call request, which streams and never passes through `chatCompletion` |
| `narrate` | Auto-RP Player Narrator |

**The bucket always matches the card that supplies the model** — enforced by
`tests/agent-reasoning.browser.js`. If you move a call onto a different model, move its bucket too.

Thinking is **off** by default on every background engine. That is deliberate: these are
structured-JSON jobs, a dozen run per turn, and chain-of-thought both spends the token budget and
makes JSON likelier to arrive wrapped in prose.

---

## 7 · Refresh pipes — how a rewritten default reaches existing users

`_refreshPipe(key, fingerprint, newMarker, newDefault)`:

> If a user's stored copy **contains the fingerprint** (so it is a shipped default, not their own
> writing) **and does not contain the newMarker** (so it is an old one), replace it.

So when you rewrite a shipped default you must also add a pipe:

- **fingerprint** — a phrase present in the *old* defaults, ideally the opening line. Keep that
  phrase in the new text too, or earlier lineages stop matching.
- **newMarker** — a phrase present only in the *new* text.

A guard (`window.__stalePipes`) catches a pipe whose marker is absent from the new default — that
pipe would fire forever and overwrite the user's prompt on every load. Any test asserting
`__stalePipes` is empty will catch it.

A prompt the user wrote themselves lacks the fingerprint and is **never** touched. That is the
point.

---

## 8 · House style in these prompts

Observed conventions, worth keeping:

- **Name the failure, not just the rule.** "Never write what {{user}} says" is followed by *why*:
  they were sitting there waiting to say it themselves. The prompts that hold up under pressure are
  the ones that explain the cost.
- **Rules are ordered by authority, and the last word is the loudest.** Guardrails come last.
- **Forbid the abstraction, demand the concrete.** "An emotion word is not an expression. 'Sad',
  'angry' and 'sensual' render as nothing at all."
- **Say what happens when there is nothing to say.** Every prompt that can return empty should state
  that empty is a correct answer, or it will invent something to fill the shape.
- **One rule, one place.** If two layers state the same rule they will eventually disagree; the
  ones that have caused real bugs here were always duplicated first.

---

## 9 · Where the risk is

If you are prioritising, these are the prompts whose output feeds *other* prompts, so an error
compounds rather than showing up once:

1. `memBuild` / `memEval` — everything downstream reasons from the memory bank.
2. `relPrompt` / `relShortPrompt` — they move the numbers every emotional block is derived from.
3. `sceneSetup` → `sceneWriter` — the classifier's answer shapes every turn of the event.
4. `goalsCurator` — rewrites what characters want, which the Gamemaster and quest designer read.
5. `memReconcile` — collapses a whole stretch of the day into what is kept.

And the ones the player reads **directly**, where quality is visible immediately: the reply
fragments, `sceneWriter`'s narration, `charQuestText`, `textProactivePrompt`, `daySummaryPrompt`.
