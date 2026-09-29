# Payload-quality review — shared brief

StoryMind (single-file PWA roleplay app, source: /home/user/Multirp/index.html, v148.3, READ-ONLY for you) was played
through a realistic 2-day Turkish session in the user's real universe (Isdemir Lojmanları; player "Emre"; characters
Sami Özüçak, Berker Özüçak, Burcu Atan, Buket, Özlem, Burak, Duygu…) with a stubbed model. Every request the app sent
to the model was captured:
  /tmp/claude-0/payload-review/out/INDEX.md            — labels, counts, samples, what did not fire
  /tmp/claude-0/payload-review/out/STATE.md            — end state
  /tmp/claude-0/payload-review/out/payloads/<label>/<nnnn>.md — each call, full messages + the stub's response
  /tmp/claude-0/payload-review/out/calls.jsonl         — the same as JSON lines (grep/python friendly)
  /tmp/claude-0/payload-review/out/images.jsonl        — final image requests (prompt + refs) sent to the image API
  /tmp/claude-0/payload-review/out/run.json            — per-turn log
NOTE: the RESPONSES are stubs (written by a harness), so do not judge response quality — judge the REQUESTS: what the
app puts in front of the model. (Earlier outputs do flow into later payloads; that is fine to follow.)

## Why this review exists
The user found, by playing, problems that three code audits missed because nobody read the payloads as the model sees
them: the suggestion writer was given each character's PRIVATE view of the player written in the character's voice
("you" = the character, "he" = the player) and presented as the player's tie; image payloads uploaded one reference
picture for a two-person prompt; everyone in a frame wore the same clothes; dialogue was sent to the image writer that
cannot draw it. Your job: find everything of that kind in your engines.

## Read each payload AS THE MODEL. For each engine (read several samples, prefer multi-character scenes), ask:
1. Point of view: is every block written from the right perspective and labelled so the model knows who "you"/"I"/"he" is?
   Is anything written in one character's voice presented as another's, or as fact?
2. Leaks: does the model receive something the acting character/engine must not know — another character's inner thoughts
   (_underscored_), private whispers, private motives/intents, secret observations, another universe's people, hidden
   (latent/undiscovered) characters, rumours they never heard?
3. Missing: what does this engine obviously need to do its job well that is absent (who is present, who is who, where/
   when, what was just agreed, what each person is wearing/doing, the player's name, language)? Would a human given this
   payload be able to do the task well?
4. Wrong/stale/contradictory: facts that disagree between blocks, stale state (yesterday's place, an old outfit, someone
   who left), instructions that contradict each other or the JSON contract, unfilled placeholders ({{user}}, {{char}}),
   mixed languages that confuse, wrong names (the player called by another name), wrong day/period.
5. Waste: duplicated blocks, giant irrelevant sections, dialogue where only action matters, repeated boilerplate that
   crowds out what matters; token cost vs value (say roughly how many chars).
6. Retry/ordering artefacts visible in payloads (same work sent twice, a discarded line still quoted).

## Deliverable
Write /tmp/claude-0/payload-review/review/<YOUR-AREA>.md with findings ranked by impact on the story/output quality:
  ### <n>. [High|Medium|Low] <one-line title>
  - Engine(s): label(s)
  - Evidence: payload path(s) + a SHORT quoted excerpt (≤ 4 lines) showing it
  - Why it hurts: what the model will do wrong because of it
  - Root cause: function name(s) in index.html (grep for them; cite the function, not line numbers) and what it does
  - Fix: concrete, minimal proposal (what to add/remove/relabel)
Only report things you verified in the payloads AND traced to code. No speculation, no style nits about prompt wording
unless it causes wrong behaviour. Aim for quality over quantity; 5–15 solid findings is ideal. At the top, one paragraph:
overall, how well does this engine family serve the model?
Do NOT modify /home/user/Multirp. Scratch work in /tmp/claude-0/payload-review/review/scratch-<area>/.
Reply to me with a short summary: counts by severity and the top 3 findings in one line each.
