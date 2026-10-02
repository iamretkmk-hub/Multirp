# The Prompt Editor (`prompt-editor.html`)

A separate page, next to `index.html`, for rewriting StoryMind's prompts away from the phone UI.

## The loop

1. In StoryMind: **Settings › Backup › Export prompts**. That gives `storymind_prompts_….json`.
2. Open `prompt-editor.html` and use **Open prompt export** to load that file. A full backup works too:
   the prompts are lifted out of its `localStorage` copy.
3. Edit. Every registry prompt, every reply piece (`BLOCK_TPL_DEFAULTS`), every payload layout (the five
   reply kinds and every `eng:` engine layout) and the model/switch settings are in the list on the left.
   The dot beside each item tells you its state: violet means your version differs from the shipped
   default, and pink means you edited it in this session.
4. **Download for StoryMind** writes a file of the same shape. In StoryMind: **Settings › Backup › Import
   prompts**. The app takes a safety snapshot first.

Edits are kept in the browser as a draft until another file is opened.

**The starting prompts.** `prompt-editor-start.json`, beside the page, is the latest prompt export (a
plain `kind:"prompts"` file). It opens automatically when there is no draft, or when it is newer than the
file the draft came from. A draft that has edits is never replaced silently: the page offers the newer
file and says to download the edits first. **⋯ › Open the bundled latest prompts** opens it at any time.
To update it, replace the file with a newer export.

## The full payload is the app's own

The editor does not reimplement payload assembly. It fetches `index.html`, boots the whole app in a
`sandbox="allow-scripts"` iframe (an opaque origin, so it **cannot** reach the real app's
localStorage or IndexedDB), and gives it:

- an in-memory `localStorage`/`sessionStorage` and a small in-memory IndexedDB (the shim in `#shimSrc`);
- no network (`fetch`, XHR and WebSocket throw), `chatCompletion` answering `"{}"`, `psycheEnsure` a no-op;
- a bridge (`#bridgeSrc`) that applies the editor's working pack to `state` live and builds payloads
  through the same calls the reply paths make: `buildSystemPromptBlocks` / `buildCharPromptBlocks`,
  `buildTailBlocks`, `castHistory` + `tagLastForTarget`, `ptBuildMessages`; `buildTextPayload` for the
  text kind; `epMessages` for engines.

So a new block, fragment or layout in `index.html` shows up in the editor with no change to the editor.
The defaults it compares against are read from the running engine (`PROMPT_REGISTRY[].def()`,
`BLOCK_TPL_DEFAULTS`, `ptDefaultTemplate`, `epDefaultTemplate`).

Memory retrieval is replaced by the speaker's own memories (newest six fresh, newest four condensed),
because the real retrieval costs a model call. Drives (`psycheEnsure`) are not written for the same
reason, so the drives block is empty unless the story data carries `_psyche`.

**Story data: your story.** **Use my own story…** reads a full backup (best), a roleplay export or a
universe export (`slimWorld`). It prefers the universe that has Buket in it, and slims it: no pictures,
no embeddings, no book, the universe's own prompt overrides cleared, and the last 40 messages kept.
The slimmed copy, about half a megabyte for the Isdemir backup, is kept in the browser (IndexedDB
`pe-story`) and loads at every start. **Forget it** in the same dialog drops it. Nothing is uploaded.
A `prompt-editor-world.json` beside the page is used when the browser holds none. The private copy
of the editor inside Claude ships one; the public site does not, because the repository is public.

- **The scenes' names.** Buket, Sami, Berker and Özlem, Buket's home (`l_sami`, with `s_liv`, `s_kit`,
  `s_bed`, `s_door`), the player's home (`l_emre`, with `s_eliv`, `s_ebed`, `s_egate`…) and the plant
  with its canteen (`l_can`/`s_tab`) are renamed to the short ids the scenes use. Every other id stays
  as it is.
- **Under 18.** Characters whose card says they are under 18 ("fourteen-year-old", "on the cusp of
  adolescence") are left out of the copy. So is every record that mentions them: memories, chronicle,
  ties, motives, relationship readings, plans, goals lines and their profile paragraphs in the origin
  document. They are never test material.
- **Gaps filled from the story's own facts** (`fillGaps`, every entry marked `source:"editor"`):
  - a rumour when the story has none;
  - a scenario line on Buket's and Sami's cards;
  - a condensed "first days" memory for anyone without long-term memory. It covers only the first day
    or two and is stamped with the last day it covers;
  - the commitments the promises engine had not written;
  - the characters' own quests, shown as story quests;
  - a motive of Buket's toward Sami, so the private-intent piece has a case;
  - a chat stamp on any after-heat decision that lacks one.

**Rewinding (`asOf`).** A scene can be set earlier than the story's present. Everything stamped later is
taken out before it is built:

- memories;
- promises, motives, world and event logs, and the player's memories;
- spoken limits and the chronicle;
- after-heat decisions and social facts;
- plans made later (read from the plan's "planned this on day N"), with any completion after that date
  undone.

The drives notes are cleared, and "where you have been today" is rebuilt from that day's memories. The
holding-the-line, daily-talk and flirting scenes are set at the end of day 5, before Buket's afternoon
with Emre on day 6. The after-intimacy scenes are set on days 7 and 11 and use the story's own memory
and her own after-heat decision.

**The sample.** Before a backup is loaded, a short stand-in is built in the sandbox at boot: the same
people, places and facts at the end of day 5. Buket is a dentist with a petition for evening shifts. Sami
owes Emre the field reports. Ayça, Emre's wife, is in Istanbul. The Özüçaks live in Big Özüçak's House.
It carries data for every piece of a reply.

**The scenes' own setups.** Each scene can bring:

- drives passages (`psyche`, always fresh);
- a spoken limit (`limits`);
- where she has been today (`dayLog`);
- relationship readings.

The sample's after-heat memory and decision are applied only when the story has none
(`ifNoAfterHeat`).

Some pieces stay empty by design:

- the player's card and others present, when the reply goes to the player alone;
- `situation`, unless someone is arriving or leaving;
- `watching_now`, `already_said` and `spoken_delivery`, the video and voice pieces.

**This turn** switches bring in the blocks that depend on the moment: *arriving* (`situation`), *video
playing* (`watching_now`), *voiced aloud* (`spoken_delivery`) and *after heat* (`after_heat`). The preview
lists every block of the layout that came back empty, with the condition that brings it in. Alternative
wordings that only one of a set can fill (heat or not, text or spoken) are counted separately.

Engine payloads show their own call-site data as `‹labels›`, because only the call site can produce it.
The shared library pieces (`scene`, `exchange`, `memories`…) are filled from the story.

## (!) Export rules

- `importPromptsFile` only writes the keys a file carries. A key left out keeps whatever the phone already
  has. So every prompt that was in the opened file, or that was touched, is written out **in full**,
  including one reset to the default. Otherwise "reset" would silently not reach the phone.
- An empty prompt means "the default" (that is how `up()` reads it), and the editor treats it the same way.
- `blockTpls` and `payloadTemplates` are written whole, as JSON strings. A piece equal to its default is
  dropped from the object, the same "keep lean" rule the app's own editor uses. The exception is a layout
  heading (`LY_ORDER`), whose blank value means "remove this heading".
- Only `PROMPT_PACK_KEYS` settings are written, and every value is a string. That is the import allowlist.

## Your model, and Claude as the analyst

Two roles, kept apart:

- **Model under test**: the player's own roleplay model on OpenRouter. The key and the model are typed into
  the page. The model defaults to `model` from the prompts file, and the list comes from OpenRouter's model
  index plus every model the file names. On the StoryMind site itself (same origin), **Use StoryMind's key**
  copies the key StoryMind keeps on this device. The reply is written by **StoryMind's own
  `chatCompletion`** inside the sandbox with `rp:true`, so the request carries the roleplay bucket's
  temperature, token limit and thinking setting exactly as the phone sends it. The sandbox's `fetch` is
  relayed to the editor, which sends it only to `https://openrouter.ai/api/` and only while a test is
  sending (`relayAllowed`). Everything else is refused.
- **Analyst**: Claude, **only in the editor inside the Claude app** (the `sample` capability, the viewer's
  own Claude). OpenRouter never analyses. On the site, `aiAsk` refuses (`no_claude`) and the box says
  "only in the editor inside Claude". The tests play there and the results are exported. Ask Claude and
  Test & review also work only inside Claude.

(!) **Inside the Claude app the page cannot reach OpenRouter.** Artifact pages may not connect to other
sites. The model box says so there. The way through: run the tests from `prompt-editor.html` on the
StoryMind site, **Export results**, and open the file in the editor inside Claude with **Import results**,
where **Analyse all** has Claude read them. The exported file carries every turn and the last payload of
each scene, so it can also be handed to Claude in a conversation.

- **Ask Claude** sends the open item (its text, its purpose and the shipped default) and optionally the
  full payload. A reply with a ```` ```prompt ```` block gets **See the change** / **Use this version**.
- **Test & review this payload**: your model answers the built payload, then Claude reviews the reply
  against it and returns find/replace edits on named items (`frag:` / `prompt:` / `tpl:`). Each edit
  applies only if its `find` text is still present.

**NanoGPT.** Model under test can be your model on OpenRouter, your model on **NanoGPT**, or Claude standing
in. NanoGPT has its own key, model and model list (from `nano-gpt.com/api/v1/models`). The reply is sent
by StoryMind's own request code with `opts.prov="nano"`, so it is built exactly as the phone builds it for
a NanoGPT agent: no OpenRouter-only fields. Engine tests can send the background engines to NanoGPT too,
with the prompts file's models (on by default); off sends them to OpenRouter. In the LLM evaluation, a
candidate names its API: `nano:<id>` or `openrouter:<id>`. A plain id is on Model under test's API.

**Thinking.** A switch turns reasoning on for the model under test's replies. A model that only works with
reasoning needs no switch: StoryMind itself (v150.15) sends the request again with reasoning on when the
model refuses "reasoning off", and remembers that model (`sm_reasononly`).

**Claude never runs on a paid API.** Every request the sandbox makes passes `relayFetch`. A request naming
an Anthropic or Claude model is refused there before anything is sent, whatever started it. Such models
are also left out of the model lists. Claude runs only through the Claude app.

## How Claude fixes things

Every analysis (Ask Claude, Test & review, the drift tests, the engine tests) carries one method, in
`CONTEXT`: **find the cause, then remove or change it; never fix by piling on rules.**
1. Trace each problem to the exact words that produced it, and quote them as the cause.
2. Fix it there, in this order: delete, rewrite or shorten, merge duplicates, move.
3. Add an instruction only when nothing covers the gap, saying why cutting or rewriting could not fix it.
   No new rule on top of one that failed, and no emphasis to make an old rule louder.
4. The text should come out the same length or shorter.

Applied edits are remembered per browser (`APPLIED`, keyed on item + find + replace). A card that is rebuilt,
which every analysis does to its list, still reads **Applied** and cannot be applied twice. An edit whose old
words are gone and whose new words are present counts as applied even without that record. **Undo** puts
the old words back.

Each proposed edit returns `kind` (`remove` / `rewrite` / `add`) and `cause` with its find/replace. The card
shows the kind, the net change in characters and the cause. An `add` is marked in amber with a note to
apply it only if nothing could be cut or rewritten instead.

## One Tests tab, every payload kind

Reply scenes and engine scenes live in one **Tests** tab. **Run everything selected** plays every ticked
scene in one go, has Claude analyse each, and finishes with **the combined analysis**. Reply scenes are all
ticked by default; engine scenes only the first, since each makes about a hundred calls. The estimate line
counts what is ticked.

Reply scenes are grouped by theme, and a theme is played in the payload kinds that suit it:

| Theme | solo | several characters | gamemaster | text messages | heat |
|---|---|---|---|---|---|
| Flirting | alone at Emre's | in front of Sami | at Emre's, Sami calls / footsteps outside | at night, apart | in the middle of it |
| After intimacy | the next day; some days on | dinner with Sami the next day | — | the morning after | — |
| Daily talk | her living room | dinner with Sami | power cut, neighbours shouting | about the day | — |
| Holding the line | the ten drift scenes | (environment) | — | — | — |

A line in a scene is the player's, texted in a text scene (`textMsg`), or a gamemaster beat (`{gm:"…"}`),
which goes into the transcript as a narrator event that the character reacts to.

**The analyst team** (`runTeam`). After **Run everything** has played every ticked scene, or when you
press **Analyse all**, every unanalysed reply scene and every engine group gets its own analyst. Each
analyst is one Claude call, and several run at the same time. **Analysts at once** sets how many, 1 to 8,
default 3. An analyst Claude tells to slow down (`rate_limited`) waits 15, 30 and then 45 seconds before
trying again. The status line shows how many are reading, done, failed and waiting. Each proposed edit
gets an id: `R:<scene>#n` for a reply scene, `E:<scene>:<engine>#n` for an engine.

**The overseer** (`analyseTogether`) reads the whole run at once:

- every scene's exchange and verdict;
- every engine's verdict and problems;
- one real payload per kind;
- the editable items, and the engine prompts that had issues;
- **every analyst's proposed edits**, by id.

It looks for patterns across scenes and tensions between them, for example resistance that holds after
intimacy but goes stiff in daily talk. It then decides on every proposed edit: **keep**, **merge** (the
same cause as others, folded into one) or **drop** (helps one scene and hurts another, adds where a cut
would do, duplicates or conflicts). Last, it writes at most 8 final edits for the run, each naming the
scenes it helps and what it risks.

Its decisions are listed under its verdict, and each analyst's edit card carries the overseer's call on
it.

## LLM evaluation (a separate test: models, not prompts)

The **LLM evaluation** tab compares models with the prompts held fixed. Nothing in it proposes a prompt
edit, and its results carry no Apply buttons.

- **Settings**: one entry per text-model setting in StoryMind's Settings, with the same names (Roleplay, Auto-RP
  Player Narrator, Prompt Rewriter, Multi-Character Director, Memory & Daily Engines, Gossip &
  offstage-intent, Rolling recap, Gamemaster, Character Generator, Authoring, Image/Video Router, Voice calls,
  Speech-to-text fixer, Fallback). Each starts from the prompts file's model; a blank one follows its
  fallback the way the app does. Add any number of candidates per setting.
- **Roleplay**: every candidate plays the chosen reply scenes in full, each building its own conversation,
  through the real payload and StoryMind's own roleplay request.
- **Engines**: one engine scene is recorded once with the file's models. In the sandbox every text-model
  setting is set to a tag naming itself (`pe-field:memModel`, `fieldModels`), so each recorded call knows
  which setting chose its model, and the tag is swapped for the real model before sending. Each setting's
  calls (a spread of different engines, up to *calls per setting*) are then replayed with every candidate
  (`replay`): the same messages and the same request options.
- **Comparison**: Claude compares the models per setting **blind** (Model A, B, C) and is told not to
  suggest prompt changes. Roleplay is scored on character, realism, instructions and language; engines on
  contract, faithfulness, judgement and economy. Then an overall score, what each model is good and weak
  at, the best model and a one-line recommendation; names are put back afterwards.

**Compare again** and each setting's own **Compare** button retry a comparison that failed. That
includes one carried in an imported file: results saved before this fix kept the failure where Compare
again skipped it, and `llmMigrate` moves it out. A failed engine analysis is likewise not a verdict
(`judgeFailed`): it keeps an **Analyse again** button and is analysed again by **Analyse all**.

**Response time.** Every candidate's reply and replayed call is timed, from sending to the full answer.
The results show each model's average and median, and the time per reply. Claude is given the measured
times, scores **speed**, and weighs quality against speed in its recommendation.

**Candidates run on** (automatic, Claude here, OpenRouter) picks where the candidates run. Automatic uses
OpenRouter only when OpenRouter has answered from this page and a key is saved. Otherwise it uses
Claude's tiers, so a key saved earlier never pulls the evaluation off Claude inside the Claude app. If
Claude has not answered yet, the run connects to it first.

**Inside Claude** (no OpenRouter), it runs there too. The candidates are Claude's own tiers (`claude:quick`,
`claude:default`, `claude:complex`), played through the viewer's Claude account (`sample` with
`modelTier`). Claude stands in for the model, exactly as in the Tests tab. Roleplay compares the three
tiers by default, and **Add Claude's tiers to every setting** adds them everywhere. The engine scene is
recorded with the strongest tier (with the `pe-field` tags, so every call still knows its setting) and
replayed with each tier. Claude's tiers can also be added as candidates beside OpenRouter models on the
site.

To compare your OpenRouter models themselves, run the tab on the StoryMind site, use **Export
results**, then **Import results** inside Claude and press **Compare again**.

## Drift tests

The **Drift tests** tab runs ten scripted scenes against the current prompts. Every scene is played by
Buket, the woman of the sample cast, and is written against facts the sample fixes (`DRIFT_SCENES` in
`prompt-editor.html`):

| Scene | Pushes toward |
|---|---|
| Invented past | confirming and embroidering a wedding in Antakya that never happened |
| Personality consistency | a gushing, confessional voice instead of her dry, guarded one |
| Risk evaluation | forging Sami's signature at the bank to get the statement early |
| Resilience | lying for Sami against the limit she drew ("Bu evde yalan istemiyorum") |
| Environmental awareness | talking about her suspicion with Sami three steps away |
| Knowledge boundaries | stating facts she was never told (the call, the debt, Berker's lunch) |
| Time & place | breakfast, the school bell, the canteen, a statement that already came |
| Emotional proportion | drama out of small talk |
| Staying in character | OOC requests, "you are an AI", an English poem |
| Agency | confessing, handing over a PIN, flattering on command, agreeing with everything |

**Quality scenes** (`quality:true`) sit beside the drift scenes. They measure pacing and realism, not refusal:

| Scene | What good looks like |
|---|---|
| Daily talk | jokes, teasing, a bit of building gossip offered as gossip, a question back; short and lively |
| Flirting, alone at Emre's | a believable sway: she can be drawn in and may say yes, but step by step |
| After intimacy: the next day | the pull shows, but her decision holds; not suddenly a lover, not erased |
| After intimacy: some days on | visibly less resistance than the day after, still with terms and risk; not available on demand, not reset |

The last two carry a `setup`: what already happened before the scene opens (her memory of the night or
nights, the after-heat decision on her card in `afterHeatBy`, and the relationship readings). It is applied
in the sandbox by `applySetup` for that build only. Comparing their scores is the measure of whether
resistance fades slowly.

Each line is one turn, answered by **your model**. The editor builds the real payload for that turn (the bridge's `build` takes a
`scene`: its place and cast, an opening line, and the exchange so far, including the model's own earlier
replies), gets the model's reply, and feeds it into the next turn. Claude then judges the transcript against
the scene's ground truth and pass line: each reply **held**, **bent** or **broke**, the turn it first
drifted, a score out of 10, and find/replace edits on named items that can be applied in place. A full run
is 45 replies from your model and 10 analyses by Claude. Results are kept in the browser and can be
exported and imported (see above).

## Engine tests

The background engines cannot be tested from a hand-made payload: what each one is handed is assembled
from live state, and most of them read what an earlier engine wrote. So **Engine tests** has the app play
for real in the sandbox (`liveBegin` / `liveTurn` / `liveEndDay` / `liveEnd` in the bridge):

1. Every engine switch is turned on and `chatCompletion` is wrapped. Each call is recorded with its debug
   label, the prompt key(s) it read (`up()` calls since the last call whose text is in the messages), the
   exact messages and the model.
2. A scripted scene (`ENGINE_SCENES`, picked and editable in the tab) is typed into the real chat input. The
   scenes are:
   - **Emre flirts with Buket in front of Sami (intense)**, the default. A compliment and a dig at Sami, a
     knee against hers on the sofa, a jab about the four thousand lira, her hand held and an invitation to
     leave with him, a squared-up "Vur hadi", and an invitation from the door.
   - **Everyday**: a meeting at eight, a promise, a rumour, a touch, the balcony, a goodbye.
   - **The card comes out**: Emre tells Buket about Sami's secret card in front of him.
   - **Quarrel at the canteen**: Sami and Berker over the foreman list, in public (its own place and cast).
   - **Comings and goings**: Sami arrives mid-scene, Emre steps onto the balcony, then leaves (presence,
     earshot, turn-taking).
   - **The day after**: Buket alone with Emre after their night (the after-intimacy setup), seen from the
     engines' side.

   The picker sits at the top of the tab and shows each scene's purpose. A scene may carry its own place,
   cast, opening line and setup (`scene`), applied by `liveBegin`.

   Each scene carries a `focus`, what it was built to test, and the analysis judges every engine's part in
   it. For the intense scene that means who the turn routers pick to answer (Sami cannot sit passive,
   Buket must not be skipped), proportion under pressure, nobody folding on the spot, presence when
   someone storms out, and which way the relationship readings move. The characters' own replies are
   judged for realism, with no edits proposed against them. Each line goes through `sendMessage`, one line at a
   time, and the run waits for the app to go quiet after each one. Then `endDay` (optional).
3. Each call is answered by the **model under test**, and the answer flows on into the app exactly as on
   the phone:
   - **Your model on OpenRouter**: StoryMind's own `chatCompletion`, so every engine goes to the model the
     app assigns it (`mcModel`, `memModel`, `gmModel`…), with its own settings.
   - **Claude stands in**: the call is handed to the editor and answered by Claude (two at a time). This is
     the only choice inside the Claude app.
4. Claude then analyses each engine: the answer against its contract (format and JSON fields, nothing
   invented, its own rules and scope, usable by the parser and the next engine), and the prompt for wording
   that let it go wrong. Its find/replace edits on `prompt:<key>` apply in place.

The tab groups calls by prompt key. A typical run (six lines plus End Day) makes about 95 calls across 24
engines. Results export and import like the drift tests.

The same **Claude stands in** switch works for Test & review and the drift tests, so the whole editor runs
inside the Claude app. Your own model can only be tested where OpenRouter is reachable.

## Making a pack the shipped defaults

The editor produces a prompt pack. That changes what one phone uses, not what `index.html` ships. To
make a pack the defaults, give the file to Claude in this repository: the registry `def()`s and
`BLOCK_TPL_DEFAULTS` are rewritten from it, and the `vNNN.N refresh` migrations follow the usual rules
for upgrading stored copies.

Test: `tests/prompt-editor.browser.js`.
