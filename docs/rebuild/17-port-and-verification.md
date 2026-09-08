# 17 · Port & Verification Plan

The other sixteen documents specify *what to build*. This one specifies *how to get there from the
app that exists* without losing what it knows.

It is the only operational document in the set. Where the others state requirements, this one
states a procedure.

## The stance

Two facts about this particular rewrite decide the entire approach.

**1. The corpus is the asset.** Measured against the current build: 33,688 total lines, of which
roughly **2,271 lines are prompt text** — 64 `DEFAULT_*` template literals plus the block-fragment
table — alongside a few dozen tuned numeric constants. That text and those numbers are what years
of play taught this app. Everything else is plumbing that can be written again.

The usual argument against rewriting is that the old code contains thousands of invisible fixes
you will re-learn the hard way. Here most of that knowledge is **not** smeared through control
flow. It is in string literals and initializers, and string literals port with zero re-derivation.

**2. The old app is an oracle.** It runs, it is deterministic in its assembly path, and — because
the rebuild makes composition pure (R-ARCH-17) — you can ask both implementations to assemble a
payload from the same state and compare the results **byte for byte**.

That converts the question that normally sinks a rewrite — *does it still behave the same?* — from
a feeling into an assertion.

**R-PORT-1** — The prompt corpus MUST be ported verbatim and frozen before feature work begins.

**R-PORT-2** — The current build MUST be preserved, runnable, as the reference oracle for the
duration of the port. It is test infrastructure, not legacy.

---

## Step 1 — Extract the corpus

**Do not parse the source.** The registry resolves prompt defaults through thunks
(`{key:"baseInstruction", def:()=>DEFAULT_BASE_INSTRUCTION, …}`), fragments live in a separate
table, and scalar defaults are materialized inside `loadState()`. A regex over template literals
will get escaping wrong and miss the resolution.

**Run the app and dump what it has.** Chromium and Playwright are available in this environment.

```js
// scripts/extract-corpus.mjs  (sketch)
// Load index.html on a clean profile, let it boot, serialize the registries.
const dump = await page.evaluate(() => ({
  promptRegistry : PROMPT_REGISTRY.map(p => ({
                     key: p.key, label: p.label, json: !!p.json, hint: p.hint || "",
                     def: p.def()            // resolves the DEFAULT_* thunk
                   })),
  blockFragments : BLOCK_TPL_DEFAULTS,       // ~332 lines of fixed sentences
  replyOrder     : REPLY_ORDER,
  replyBlocks    : REPLY_BLOCKS,
  enginePayloads : ENGINE_PAYLOAD_DEFS,
  storageKeys    : K,
  defaults       : JSON.parse(JSON.stringify(state))  // loadState() on an empty profile
}));
```

The last line is the one that earns its keep: on a clean profile, `state` after `loadState()` **is**
the complete default set — every scalar, every threshold, every cadence, and one property per
registry prompt. There is no second place to look.

### What comes out

| Artifact | Contains | Feeds |
|---|---|---|
| `corpus/prompts.json` | ~62 registry prompts with label, hint, JSON flag, default text | The prompt registry (R-PAY-25) |
| `corpus/fragments.json` | Every fixed sentence in a reply block | The fragment registry (R-PAY-16) |
| `corpus/blocks.json` | Block ids, labels, kinds, default order | The block registry (R-PAY-20) |
| `corpus/engines.json` | Engine payload cards and their prompt keys | The engine registry (R-ARCH-6) |
| `corpus/defaults.json` | Every default scalar, threshold, weight, cadence, cap | The settings registry (R-SET-7) |
| `corpus/keys.json` | The storage key map | The storage-key registry (R-STATE-6) |

**R-PORT-3** — Extraction MUST be a re-runnable script, not a one-time manual pass. You will run it
again when you find something you missed.

**R-PORT-4** — Extracted artifacts MUST be committed as data files and MUST NOT be edited during
the port. A change to the corpus invalidates every differential result taken before it.

> **This is the rule most likely to be broken, and breaking it is the most expensive thing you can
> do.** Porting is exactly when a prompt's flaws are most visible — you are reading all 2,271 lines
> for the first time in years. Improving one mid-port destroys your ability to diff, and the
> resulting behaviour change is silent. Keep a `corpus/PROPOSED.md` of every improvement you think
> of, and apply none of them until the port is verified.

### The constants inventory

Numbers that are not in `defaults.json` because they are hardcoded. These MUST be inventoried by
hand and carried across with their reasons attached — they are as load-bearing as the prompts and
much easier to lose.

| Constant | Where | Why it is what it is |
|---|---|---|
| Repetition triggers `0.72` / `0.70` / `0.8` | The three similarity measures | Three failure modes, three thresholds (R-TURN-24) |
| Importance floor vs intent threshold `0.55` | Memory storage and the intent engine | The "world went dead" coupling (R-MEM-8, R-MEM-9) |
| Memory arc cap | Arc safety valve | Arcs that never close (R-MEM-3) |
| Condensation cluster thresholds | Embedding cosine vs lexical | Different measures need different cuts (R-MEM-16) |
| Render window | Transcript DOM bound | R-UX-6 |
| Chain cap, responder cap | Turn routing | Chains stay rare (R-TURN-11) |
| Per-engine caps and cadences | Every autonomous engine | The day pipeline does not become a queue (R-SIM-52) |

**R-PORT-5** — Every hardcoded constant carried across MUST arrive as a registered, visible setting
(R-SET-1). The port is the moment to pay off
[principle 6](00-principles.md#6--nothing-hidden), because you are already touching every one.

---

## Step 2 — Build the oracle

**R-PORT-6** — A harness MUST be able to load the current build headlessly, install a known state,
and invoke its payload assembly directly.

Everything in the old build is at global scope, which is a liability for maintenance and a gift
here: `buildPayload`, `buildCharPromptBlocks`, and `buildTailBlocks` are all directly callable from
a headless page.

```js
// scripts/oracle.mjs  (sketch)
await page.evaluate(async (backup) => {
  await applyBackupBundle(backup);          // install a real exported universe
}, backup);

const payload = await page.evaluate(({chatId, speakerId, targetId}) => {
  const chat = state.chats[chatId];
  const p    = state.personas.find(x => x.id === speakerId);
  const head = buildCharPromptBlocks(p, othersFor(chat, p), [], targetId, {chat});
  const tail = buildTailBlocks({chat, selfId: p.id, selfName: p.name, targetId});
  return buildPayload("solo", head, tail);   // → {head, tail}
}, fixture);
```

**R-PORT-7** — Fixtures MUST be built from **real exported state**, not synthesized. A universe
with nine characters, live rumours, open promises, a due meeting, and two game-days of transcript
exercises paths a hand-built fixture never will.

**R-PORT-8** — The fixture set MUST cover every reply variant (solo · multi · director · text ·
heat) and every conditional block. A block that renders only in one state is exactly the block a
differ will otherwise never see.

---

## Step 3 — Differential payload testing

The core loop. Both implementations assemble from the same state; the results are compared.

```
exported state ──┬──► old build (headless) ──► payload A ──┐
                 │                                          ├──► normalize ──► diff ──► verdict
                 └──► new build (in process) ──► payload B ──┘
```

**R-PORT-9** — Every diff MUST be classified into exactly one of three verdicts. An unclassified
diff is a failing test.

| Verdict | Meaning | Action |
|---|---|---|
| **Incidental** | Whitespace, key ordering, equivalent formatting | Handle in the normalizer, once, for all fixtures |
| **Registered** | Differs because of a numbered entry in [`15-redesign-register.md`](15-redesign-register.md) | Assert the *specific* expected difference, citing the RD number |
| **Defect** | Anything else | Fix the new implementation |

**R-PORT-10** — The normalizer MUST be conservative. Normalizing away a real difference is the one
way this harness can lie to you, and it will do so silently. Normalize only: trailing whitespace,
blank-line runs between blocks, and object key order in serialized fixtures. **Never** normalize
block ordering, sentence wording, or numeric formatting.

**R-PORT-11** — A registered difference MUST be asserted positively, not merely allowed.

```js
// Not this — it hides regressions in the same block:
expect(diff.blocks.relationships).toBeAllowedToDiffer();

// This — it pins exactly what RD-14 changed and nothing else:
expect(diff.blocks.relationships).toDifferOnlyBy({
  rd: "RD-14",
  reason: "names resolved from ids; prose otherwise identical",
  matcher: identicalAfterNameResolution
});
```

### What the differ proves, and what it does not

**Proves** — the highest-value third of the system, and the part that is otherwise untestable:

- Block content, block order, and which blocks render in which state
- Fragment text reaching the model exactly as before
- History assembly: the scene window, the day window, the witness filter, the perception filter,
  and compaction — in that order (R-TURN-15)
- Memory injection: which memories were selected and how they are rendered
- The instruction/transcript token ratio (R-PROD-7)
- Language directive selection per call (R-PAY-30)

**Does not prove** — and each needs its own coverage:

| Not covered | Covered instead by |
|---|---|
| Model output quality | Nothing automated. Side-by-side play (Step 5) |
| Engine parse-and-apply behaviour | Schema validation against recorded real responses (R-OBS-17) |
| Pipeline ordering effects | Declared dependency validation (R-SIM-6, R-OBS-18) |
| Persistence and migration | Round-trip tests: export → import → export is stable |
| UI behaviour | Manual, against the parity checklist below |
| Timing, cadence, budgets | Scheduler decision log assertions (R-ARCH-14) |

---

## Step 4 — Golden fixtures from real play

The cheap version, available on day one with no harness at all.

The current build already exports its recent payloads as JSON, scrubbed of credentials
(`exportDebug`). **R-PORT-12** — Before the port begins, play a substantial session in the current
build across every reply variant and export the debug bundle. Those payloads are golden fixtures
for free, captured from genuine play rather than a constructed scenario.

They are not reproducible — each turn is unique — so they cannot be re-run against the oracle. Use
them as the first target while the headless harness is being built, and keep them afterwards as
evidence of what real payloads looked like.

---

## Step 5 — Dual running

**R-PORT-13** — Both builds MUST be installed side by side, on the same device, against copies of
the same exported state, for the entire port.

**R-PORT-14** — The new build MUST NOT become the primary story until it has carried a real
campaign for a sustained period without falling back.

> There is no staging environment for a single-user local app, and no telemetry to tell you
> something regressed. The only integration test that exists is you, playing, noticing that a
> character feels wrong. Protect the ability to switch back mid-session.

**R-PORT-15** — Migration of the live campaign MUST go through the documented import path
(R-SET-16, R-SET-17), never through a bespoke one-off script. If the importer cannot carry your
own campaign, it cannot carry anyone's.

---

## The parity checklist

Behaviours from `docs/13` that the differ **cannot** see, because they concern what happens after
assembly or across turns. Each is a defect that shipped at least once. Each needs a deliberate check.

| # | Verify | Cross-ref |
|---|---|---|
| P-1 | A mutated message persists with no explicit dirty call, and survives reload | R-STATE-13 |
| P-2 | A write in flight survives backgrounding, not just unload | R-STATE-14 |
| P-3 | Renaming a character leaves memories, ties, promises, and calendar entries intact | R-STATE-2 |
| P-4 | A deleted reference resolves to absence, and no `(unknown)` string reaches a prompt | R-STATE-4 |
| P-5 | Two arrivals at the same location land in the **same** earshot zone | R-STATE-22 |
| P-6 | A new message kind is excluded from payloads and memory without editing any filter | R-STATE-26 |
| P-7 | A thinking-only response yields no rendered text and triggers exactly one retry | R-PROV-9 |
| P-8 | A refusal is never rendered and never reported as a token-limit problem | R-PROV-11 |
| P-9 | A failed asset upload fails the media request instead of silently unconditioning it | R-PROV-21 |
| P-10 | Sampling controls are absent from every engine call body | R-PROV-6 |
| P-11 | An unfilled placeholder cannot leave composition | R-PAY-17 |
| P-12 | The five "continuing my own line" blocks agree in every state | R-PAY-12 |
| P-13 | The text variant suppresses room blocks and keeps person blocks | R-PAY-11 |
| P-14 | A saved layout with an unknown block id self-heals; a removed block stays removed | R-PAY-23, R-PAY-24 |
| P-15 | The importance floor cannot be set high enough to starve the intent engine | R-MEM-9 |
| P-16 | A day-end flush is stamped with the ending day — verified by diaries seeing a full day | R-MEM-4, R-SIM-7 |
| P-17 | The retrieval trace shows per-facet scores and reflects a weight change | R-MEM-27 |
| P-18 | Exactly one turn-consuming behaviour wins a contested turn | R-TURN-32 |
| P-19 | Compaction leaves narrator lines and the speaker's own narration standing | R-TURN-18 |
| P-20 | Only the gossip stakeholder may raise, once; carriers never raise | R-SIM-20 |
| P-21 | Due plans still execute with the world pulse disabled | R-SIM-32 |
| P-22 | A promise reaches every subscriber, and the subscriber list is enumerable | R-SIM-39 |
| P-23 | Removing a settings control cannot break the saving of unrelated settings | R-SET-8 |
| P-24 | One version source; a release cannot ship a stale cache identifier | R-SET-21 |
| P-25 | A reload never reopens the microphone | R-PROV-28 |

**R-PORT-16** — Each checklist item MUST be verified against the **new** build and recorded. Items
that can be automated SHOULD be; the rest are manual and are still cheaper than rediscovering them.

---

## Sequencing against the build order

The port work interleaves with [`16-build-order.md`](16-build-order.md) as follows:

| Build phase | Port work |
|---|---|
| **Phase 0** | Extract the corpus (Step 1). Capture golden fixtures from real play (Step 4). Freeze both |
| **Phase 1** | Corpus artifacts become the registries. Constants inventory becomes settings entries |
| **Phase 2** | — |
| **Phase 3** | **Build the oracle and the differ (Steps 2–3).** Composition is the first thing that can be differed and the thing most worth differing |
| **Phase 4** | Differ runs on every fixture, every commit. Dual running begins (Step 5) |
| **Phases 5–6** | Extend fixtures as memory and simulation come online. Parity checklist items P-15..P-22 |
| **Phases 7–9** | P-9, P-25. Fixture coverage for media and voice paths |
| **Phase 10** | Legacy import (R-SET-17) verified by carrying your own campaign (R-PORT-15) |

---

## Exit criteria

The port is complete when:

- [ ] The corpus is extracted, committed, and byte-identical to the current build's resolved
      defaults (R-PORT-1, R-PORT-4)
- [ ] Every constant in the inventory is a visible, registered setting (R-PORT-5)
- [ ] The differ runs the full fixture set with **zero unclassified diffs** (R-PORT-9)
- [ ] Every registered difference is asserted positively against its RD number (R-PORT-11)
- [ ] All 25 parity checklist items verified and recorded (R-PORT-16)
- [ ] A real campaign has been imported through the documented path and played for a sustained
      period on the new build without falling back (R-PORT-14, R-PORT-15)
- [ ] The standing acceptance test in [`16-build-order.md`](16-build-order.md) passes (R-BUILD-3)
- [ ] `corpus/PROPOSED.md` is triaged — the improvements deferred during the port are now a
      backlog to work through **with the differ in place** to measure each one

That last item is the payoff. Every prompt flaw you noticed while porting and refused to fix now
has, for the first time in this project's history, a way to be changed **and measured**.
