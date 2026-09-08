# 14 · Observability & Failure

There is no server, no telemetry, no crash reporting, and no way to inspect a user's state
([`01-product-spec.md`](01-product-spec.md), non-goals). The person running the app is the only
person who can see what happened, and the debug surface is the only instrument they have.

**Everything in this document follows from that.** Observability is not a developer convenience
here; it is the entire support infrastructure.

## The failure policy

**R-OBS-1** — Failure classes and their required responses:

| Class | Example | Blocks the turn? | User sees | Logged |
|---|---|---|---|---|
| **Fatal** | State cannot be loaded | Yes | A screen explaining the state and offering export and restore | Yes |
| **Turn** | The reply call failed after recovery | No — the turn ends without a reply | An inline error naming the cause with a retry | Yes |
| **Enrichment** | Illustration or voicing failed | No | An inline error in the media slot with a retry | Yes |
| **Engine** | A background job failed or produced invalid output | No | Nothing immediate | **Yes — mandatory** |
| **Persistence** | A write failed | No | A toast, and a warning if it repeats | Yes |
| **Validation** | A registry check failed at boot | No | A visible startup notice | Yes |

**R-OBS-2** — **Fail soft, never fail silent** ([principle 5](00-principles.md#5--fail-soft-never-fail-silent)).
An engine that fails skips its beat and records why. Silence is the worst failure mode available
to a system built almost entirely from best-effort background jobs.

**R-OBS-3** — A **skip is an outcome**, not an absence. Gated off · cadence not due · no eligible
subjects · cap reached · lost the priority ladder · failed — six different entries, and the
difference between them is the whole diagnosis.

> **Redesign — was:** background engines fail soft with no trace, so a feature that has stopped
> working is indistinguishable from a feature with nothing to say. A tracker engine stopped moving
> for an unknown number of releases; a retrieval facet degraded silently when the memory language
> changed. Neither was detectable by the user or, without a live payload dump, by the author.
> **Now:** R-OBS-2 and R-OBS-3.

**R-OBS-4** — A subsystem that has produced nothing for an unusually long time SHOULD surface that
where the user will see it — beside its own toggle in settings, not buried in a log.

## The debug surface

**R-OBS-5** — Every model call MUST appear as an entry recording: what it was for, the model and
provider actually used, the **full assembled input broken into labelled blocks**, the raw output,
the duration, the outcome, an estimated token count, and the recovery history if any (R-PROV-29,
R-PROV-30, R-PROV-12).

**R-OBS-6** — Entries MUST be newest-first, bounded in number, expandable, and MUST preserve
prompt whitespace exactly (R-VIS-26).

**R-OBS-7** — **Local decisions that spend no network MUST be logged in the same place**, marked
as local. Memory retrieval ranking above all: the query, which scoring path ran, the active
weights, and every candidate's per-facet scores with the injected ones marked (R-MEM-27).

> **Parity — keep:** this is the single best diagnostic in the current app. A user tuning
> retrieval weights with no visibility into their effect will conclude the feature does nothing,
> and they will be right, because they cannot steer it.

**R-OBS-8** — Every entry MUST be reachable **from the thing it produced** (the redesign note in
[`02-experience-design.md`](02-experience-design.md)): a reply, an image, a tracker movement, an
engine outcome. The distance between "that's wrong" and "here's why" is the most important
measurement in the app.

**R-OBS-9** — The token split between instruction content and transcript content MUST be shown per
call and flagged below threshold (R-PROD-7, R-PROV-33).

**R-OBS-10** — Every scheduler decision MUST be recorded: engine, ran or skipped, and why
(R-ARCH-14).

**R-OBS-11** — The debug export MUST be credential-scrubbed, and the redaction MUST be visible as
redaction (R-VIS-27, R-SET-13).

## Boot self-checks

**R-OBS-12** — Startup MUST run every registry validation in R-ARCH-7 and MUST report every
violation **in the app**, not only to a console. There is no console on a phone, and the person
running this build is the person who will file the bug (R-ARCH-8).

The minimum check set, restated here as the operational contract:

| Check | Catches |
|---|---|
| Prompt has a consumer | Dead editable prompts that do nothing |
| Consumer's prompt exists | A reference to a prompt that was removed |
| Fragment three-leg | Editor showing text different from what is sent |
| Placeholder reconciliation | Literal `{{tokens}}` reaching a model |
| Schema declared for parsed output | Prompt/parser drift |
| Settings coverage | A tunable with no control |
| Rule ownership uniqueness | The same rule stated in two blocks |
| Ladder precedence declared | A turn-consuming engine stacking on another |
| Migration self-validity | A migration that can no longer discriminate (R-STATE-36) |

**R-OBS-13** — A validation failure MUST name the offending member and the fix. "Prompt X has no
consumer — delete it or wire it" is actionable; "registry validation failed" is not.

**R-OBS-14** — A stood-down migration (R-STATE-36) MUST be reported as **dead code to delete**,
not as a runtime condition to tolerate.

## Verification

**R-OBS-15** — Composition MUST be exercisable in isolation: a state snapshot in, an assembled
payload out (R-ARCH-19, item 3). This is the only affordable way to test the app's most
coupling-dense layer.

**R-OBS-16** — The app MUST be able to **re-assemble** the payload for a past turn from stored
state and diff it against what was sent (R-PAY-38). Answering "did my change do what I think it
did" any other way is guesswork.

**R-OBS-17** — Every declared output schema MUST have at least one recorded real response
validated against it, so a schema that is wrong about the model's actual behaviour is caught
before it reaches a user.

**R-OBS-18** — Ordering-dependent pipelines — the day pipeline (R-SIM-6), the history assembly
chain (R-TURN-15), the priority ladder (R-TURN-32) — MUST declare their dependencies as data, and
those declarations MUST be validated.

> **Parity — keep, made mechanical:** every one of these orderings is currently correct, and
> every one is documented as load-bearing with a warning attached. The day pipeline's first and
> last steps are marked "MUST be first" and "MUST be last"; the history chain's compaction pass
> is correct only because it runs after the perception filter; the priority ladder is a sequence
> of early returns. Correct and undefended is a temporary state.

## Performance

**R-OBS-19** — Opt-in instrumentation MUST be available for the render path, the persistence
path, and the send loop, reporting timings, DOM size, and memory where the platform exposes it.

**R-OBS-20** — Instrumentation MUST have **zero cost when off**. A months-long campaign is the
performance case that matters, and it is exactly the case a developer never has.

## What good looks like

A user says a character has stopped remembering things. Without leaving the app, they:

1. Open the reply's debug entry from the message itself (R-OBS-8).
2. See the assembled payload, and that the memory blocks are empty (R-OBS-5).
3. Open the local retrieval entry for that turn (R-OBS-7) and see zero candidates cleared the
   floor.
4. Find, beside the importance-floor setting, the note that it is bounded against the intent
   engine's threshold (R-SET-5) and that it is set high.
5. Lower it, and export the scrubbed debug bundle if they still need help (R-OBS-11).

**Every step of that MUST be possible.** That sequence is the acceptance test for this document.
