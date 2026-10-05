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

**Model rotation.** This works as in StoryMind (Settings → Model rotation, `state.rpRotation`). The model
box takes an optional list of two or more model ids, comma-separated, on the Model under test's API.
- With a list, **each roleplay reply in the Roleplay tests uses the next model**, and the list cycles.
- Every scene starts again from the first model, so runs compare.
- The engines keep the models the app gives them. The engine tests, Test & review and Claude standing in
  never rotate.
- For OpenRouter the list starts from the prompts file's `rpRotation` until one is typed here.
- One model, or none, means no rotation.

Each reply records the model that wrote it and shows it as a chip:
- The judges see `[model: …]` on every reply. They also score **blend** (*Rotating models go together*):
  one character and one story across a switch, no jump in voice, register, length, Turkish or pacing of
  desire, each model picking up the other's threads.
- The complete analysis gets each model's reply count, average response time and length
  (`rotationText`). It is asked how the models go together, which criteria each pulls down, and whether
  to keep, reorder or drop one. Its edits must hold for every model in the rotation, and a gap that only
  one model has and no prompt can close is reported rather than bent around. Its verdict shows a **Model
  rotation** block, and the rubric table gets a blend row.

**Claude never runs on a paid API.** Every request the sandbox makes passes `relayFetch`. A request naming
an Anthropic or Claude model is refused there before anything is sent, whatever started it. Such models
are also left out of the model lists. Claude runs only through the Claude app.

## What the analysts know about edits already made

A judge reads the payload exactly as it was when its scene was played. If you applied edits after that,
the payload still shows the old wording. Two things keep that from producing stale fixes:

- **They are told.** Every applied edit is remembered with its item, the old words and the new ones
  (`APPLIED`). Each judge and each complete analysis gets the edits applied since its tests ran, as
  `{{applied}}`. The complete analyses read the **current** text of every piece, so their edits quote
  words that still exist.
- **A stale edit says so.** An edit card whose words were already replaced by an applied edit shows
  **Already changed** (`supersededBy`), not "Text not found". Run the scenes again to have the new
  wording judged.

**Order.** Scenes are played, judged and listed in the order the tab numbers them (`DRIFT_SCENES`, grouped
by theme: Daily life, Seduction, In the act, After intimacy, Memory, Integrity).

## Analyst prompts (what Claude is asked)

The **Analyst prompts** tab shows every prompt the editor sends to Claude. Each one can be edited
(`AP_DEFS`, filled by `apBuild`):

- **The method** (`context`) goes into the others as `{{context}}`. It covers what the author wants from
  every reply, how a model weighs a payload, and HOW TO FIX.
- **Ask Claude** (`ask`).
- **Test & review** (`review`).
- **1 · Scene judge** (`scene`): one roleplay scene on its own, with its dialogue and its payload. No fixes.
- **2 · Payload-kind analyst** (`kind`): re-evaluates the scene reports of one kind (solo, several
  characters, text or heat) with that kind's payload once. No fixes.
- **Engine judge** (`engine`): one background engine in one engine scene. It does not fix either.
- **The complete analysis** (`overseer`): every roleplay scene, then the fixes.
- **The complete engine analysis** (`engfinal`): every engine scene, then the fixes to the engine prompts.
- **Discuss the fixes** (`discuss`): the opening of the conversation under a complete analysis.
- **LLM evaluation** (`compare`).
- **Claude stands in** (`standin`).

**How a prompt is filled:**
- `{{name}}` is filled with live data, and each prompt lists its names.
- `{{#flag}}…{{/flag}}` is kept only when the flag is on; `{{^flag}}…{{/flag}}` only when it is off.
- Any other brace text, such as the app's own `{{call//…}}` or `{{…}}` wording, is left exactly as written.

**Editing and moving prompts:**
- An edited prompt is kept in this browser (`ap_<id>`) and used from the next analysis on.
- **Reset** brings the shipped prompt back.
- **Last sent** shows the exact text Claude got last time, with the data filled in.
- A warning appears when an edit drops a placeholder, or drops the "Reply with ONLY this JSON" shape the
  editor reads.
- **Export** and **Import** move the edited prompts between browsers (`kind: "analyst-prompts"`).

During a live run the model settings carry `pe-field:` tags. A pack applied mid-run, by an edit or the
preview, updates the value kept for afterwards rather than overwriting a tag.

## How Claude fixes things

Every analysis carries one method, in `CONTEXT`:

1. **Cause first.** Trace each failure to the words *or the structure* that produced it, quote them and
   name the piece.
2. **Then the best fix.** That means the one that removes the cause most reliably:
   - delete words that push the wrong way;
   - rewrite a muddled instruction;
   - merge duplicates;
   - **move** a piece to where it is weighed right (nearer the reply, or into the `[user]` message);
   - **add** an instruction when the payload never asks for the behaviour.

   Adding is allowed when it is the best fix, and the edit says why it beats a cut or a move. The method
   also tells Claude how a model reads a payload: the end weighs most, the buried middle least, a doubled
   rule weighs double, and examples get copied.
3. **General, never one scene.** A fix must hold in every situation the app meets. It never names a test,
   a character or a scripted line.
4. **Tight.** No emphasis inflation, no restated rules, every `{{…}}` and `[[…]]` kept intact.

**Edit kinds.** An edit is `remove`, `rewrite`, `move` or `add`, with its `cause`:
- A **move** (`find` = the whole line to move in a layout `tpl:<kind>`, `before` = the line it goes right
  before) takes that line out and puts it back in its new place (`moveResult`). The card reads
  "Moves … to just before …".
- An `add` is marked in amber.

**Applying edits.** Applied edits are remembered per browser (`APPLIED`, keyed on item + find + replace,
plus the anchor for a move). A rebuilt card still reads **Applied** and cannot be applied twice.
**Undo** puts the old text back. For a move, Undo restores the layout exactly.

## Roleplay tests: six sections, probes, a fixer per section and a reconciler

The **Roleplay tests** tab tests the reply payloads. Engine tests have their own tab (below).

**The rubric** (`CRITERIA`) is the same for every scene, and each scene marks the criteria it presses on
(★):

| Criterion | What it means |
|---|---|
| Natural Turkish | what a native of her age and mood would actually say there: word choice, register, idiom, sense in context, realism, spoken rhythm; then grammar and suffixes. Findings quote the wrong words and give the native alternative |
| Meaningful content | every sentence says something; topics move; no filler or repetition |
| Consistent character | the same person throughout, including during and after sex |
| Believable pacing of desire | real resistance a good approach can move, shaped by what already happened |
| Self-awareness | acts on her own state: body, trackers (fertility), marriage, reputation, her limits |
| Awareness of surroundings | who is present or in earshot, the place, the time, events in the scene |
| Others react | people present notice and respond in character, neither silent nor melodramatic |
| Memory | loyal to what happened, and uses a memory when a similar situation returns |
| Own agency | answers pressure, degradation or rough play as this person would, never automatic compliance or shutdown |
| Format and fiction | the payload's format; never writes the player; never leaves the fiction |

**The scenes** (`DRIFT_SCENES`) are fewer and harder. In each, the player is Emre and the woman is Buket.
In the multi-character scenes her husband Sami answers every line too, since in those payloads each
present character replies. Gamemaster beats (`{gm:"…"}`) go into the transcript as events, and the
characters react to them.

The scenes are grouped into six **sections**, each testing one thing through one payload kind (`KINDS`):

| Section | Payload | Scenes | What it tests |
|---|---|---|---|
| Solo · Everyday voice | solo | Talk at home | living, specific Turkish with something to say |
| Solo · Desire over time | solo | Alone at Emre's; the next day at her door; some days on | resistance that moves slowly, and the same woman before and after |
| Solo · Memory | solo | The beach again; loyal to what happened | memory used when the past repeats; no invented past |
| Several characters | multi | Dinner with Sami; flirting with Sami in the house; dinner the day after | the others react; she acts on who can hear |
| Text messages | text | Texting at night | texting voice; a phone can be seen |
| Heat of the moment | heat | In the middle of it | insults, hair pulling, a slap, "İçine boşalacağım" while she knows she is fertile, Sami's call: still a whole person |

The integrity scene (step out of the fiction, gush, agree with everything) was removed: format and
fiction are judged in every scene anyway.

**Probes.** Every scene names the turns it hinges on and what passing looks like there (`probes`). For
example: turn 5 of "Alone at Emre's" is the kiss, and passing means a reaction with weight, neither
melting nor a wall. The judge marks each probe *pass*, *partial* or *fail* with the quote that decides it.
The results show on the scene as chips and go up to the section's report. A probe is a sharper signal
than a score, because it says exactly where and what failed.

Each scene sets its own state for the build (`setup`, applied in the sandbox by `applySetup` for that
build only):
- **Trackers.** The heat scene adds a *Fertility* tracker in its fertile stage.
- **Missing memories** (`memoriesIfMissing`). They are added only when the story has none like them: the
  pill she stopped taking, or the first time on the beach. The memory stand-in pins them (`_pin`), so they
  reach the payload.
- **The afterwards.** The after-intimacy scenes carry the memory of the night, her decision
  (`afterHeatBy`) and the relationship readings.
- **Rewound days** (`asOf`). Scenes set before day 6 are played from the story as it was then.

The memory stand-in (`memFor`) gives the two newest memories. It adds up to three whose words match the
last lines and the place, the way retrieval would.

**Separate sections.** The tab shows each section with its scenes, a **Run these** button (the ticked
scenes of the section, or all of them) and an **Analyse these** button. Above its scenes it shows:
- the section's own analysis: score, summary, rubric, the patterns across its scenes and notes on its
  payload's structure;
- its fixer's proposals, which can be applied there directly.

Scenes are ordered by section and played in that order. Gamemaster beats inside solo and
several-character scenes are still answered through the gamemaster layout.

**The flow:**
1. **Run everything selected** plays every ticked scene. Each turn goes through the real payload and your
   model (or Claude standing in), and every speaker answers each line. The estimate counts replies as
   lines × speakers.
2. **The analysis is hierarchical**, per section (`analyseKind`), with up to *Analysts at once* kinds in
   parallel:
   - **Level 1: each scene on its own** (`scene`, `judgeScene`, two at a time within a kind). The judge
     gets that scene's dialogue and the payload it was played through. For every turn it gives a verdict,
     scores the rubric with a note and a quote, and lists findings with the evidence and the suspected
     cause. Its **reasoning** is written for readers who will never see the dialogue. A scene already
     judged is not judged again.
   - **Level 2: the kind re-evaluates its scene reports** (`kind`). It gets every scene report of the kind
     (`sceneReport`, no dialogues) and the kind's payload once. It checks each judge's cause against the
     payload (confirmed, corrected or rejected), names the patterns and the strengths the fixes must keep,
     reads the payload's structure, scores the kind and writes its reasoning.

   **Neither level proposes edits.** The kind's report is kept in `KA` (saved per browser, exported and
   imported with the results). Playing a scene on its own judges it and then re-evaluates its kind.
2b. **Before → after** (`effect`, `checkEffect`): when an earlier run is on record, one turn compares the
   two runs before the fixer writes anything. Every complete analysis keeps a snapshot of its run
   (`runsnaps`, the last 3): each kind's payload without the transcript, the kinds' scores, reports and
   reasoning, and each scene's scores. The turn gets:
   - the edits applied between the runs;
   - a line diff of each kind's payload (`payloadDiff`, `-` before, `+` after);
   - the scores before → after, per kind, per criterion and per scene;
   - both runs' kind reports.

   It judges each edit (helped, hurt, mixed, none, unclear) and why. It lists the regressions and what to
   keep, and proposes reverts for edits that hurt. Its verdict shows above the complete analysis as
   **Before → after**, with the reverts as edit cards, and the fixer reads it under "What the last changes
   did". The first run has nothing to compare with. A new test set, imported or played, clears the old
   verdict.
3. **One fixer per section** (`fixer`, `fixSection`), two at a time. **It gets no dialogues.** It gets:
   - the section's report, with every scene report under it (reasoning, probes, findings with quotes);
   - the section's payload once;
   - its layout;
   - the current text of the pieces that appear in that payload (`piecesIn`, found by their fixed
     wording), each marked **SHARED with** the other sections whose payloads contain it, or **this section
     only**;
   - the before → after verdict.

   It proposes at most 5 general edits for its section (`S:<section>#n`), says whether each holds
   everywhere or for this section only, and lists what must not be broken. Each request holds one
   section, so it stays small. A section whose fixer fails is reported, and the others go on.
4. **The reconciler** (`overseer`) gets every section's proposals, but no payloads. It also gets:
   - where each touched piece appears (`pieceUsage`);
   - the current text of only the pieces the proposals touch;
   - the scores against earlier runs and the before → after verdict;
   - the engine judgements.

   It decides **keep**, **merge** or **drop** on every proposal. Two proposals on a shared piece become one
   edit that serves every section. It then writes at most 10 final edits. If it fails, every section's
   proposals are still on screen to apply.
5. The result shows the rubric table, this run against the previous one, the structure notes, the patterns,
   the reconciler's decisions and the final edit cards.

**Fix this section** runs one section's fixer only. Its proposals show in its section with Apply; the
reconciler is not run.

**Analyse all** runs steps 2 to 4 on scenes already played. A section whose scenes are all analysed is not
analysed again.

**Write the fixes** runs only the before → after check, the section fixers and the reconciler, over the sections already analysed. If the complete analysis fails, its
reason stays on screen above any earlier result, with a **Write the fixes again** button. A toast alone
was easy to miss, and the run then looked as if it had stopped after the judges.

**Discussing the fixes.** Under each complete analysis (roleplay and engines) is a conversation with
Claude: **Discuss these fixes with Claude**. Use it to:
- question an edit, or ask why;
- ask for a smaller or different correction;
- point at a reply you did not like;
- request something new.

Every message rebuilds the opening (`discuss`). It holds the same input as the fixer, with no dialogues:
- the complete analysis, with each proposed edit's state (ready, applied, already changed, missing);
- every edit applied so far;
- each kind's report;
- each kind's full payload;
- the layouts;
- the current catalogue.

For the engines, it holds each engine scene's judgements and every engine prompt that ran. Claude
therefore never quotes words that are gone.

When you ask for a change, Claude puts the edits in an `edits` block. They show as ordinary edit cards
with **Apply** and **Undo**, and the block itself is hidden. The conversation is kept in this browser
(`disc_rp`, `disc_eng`), and the oldest exchanges are dropped when it would exceed one request. A new
complete analysis starts a new conversation; **Clear the conversation** starts one by hand.

**One request at a time.** Every analysis call to Claude goes through one queue (`claudeJson`, `CQ`):
- **One at a time.** Scenes, sections and engines are analysed one by one, so they no longer pile up into
  "too many requests".
- **Rate limits.** A rate-limited call waits and tries again, up to four times.
- **Cut-off answers.** An answer that was cut off or was not JSON is asked again once, with the
  instruction to answer much shorter.
- **Compact answers.** The judges are asked for one-line notes, at most six findings and short reasoning.
- **No transcript twice.** Judges and fixers get the payload without the transcript (`instrText`), since
  the dialogue is given separately.

**The fixer runs right after its section's analysis.** When a section has been analysed (scenes judged
one by one, then re-evaluated), its fixer runs straight away with that analysis, and its proposals
appear in the section. The complete analysis reuses those fresh proposals instead of running the
fixers again, and only the reconciler is left. When a scene cannot be judged, the section says which
one and why, and **Analyse again** retries it.

**Claude's input limit.** One request to Claude takes at most 256 KiB of text, counted in UTF-8 bytes
(a Turkish letter can take two), and a larger one is refused (`prompt_too_large`). A full run of twelve
scenes with the pieces, the layouts and the engine prompts used to go over that, so the judges finished
and the fixing step was refused.
- `apBuild` keeps every request under `AP_CAP` (225,000 bytes).
- When a request is too big, it shortens the data in the template's `fit` order, most expendable first:
  for the complete analysis that is the sample payload, then the engine prompts, engines, history,
  scenes, pieces and layouts.
- Each cut keeps the head and the tail of the text and marks the cut. The instructions and the reply
  format are never cut.
- Before cutting anything, the complete analysis first quotes each reply shorter.
- The engine prompts that had problems go first, so a cut falls on the healthy ones. **Import results** of a full test set replaces
every earlier result, and the old complete analysis goes with them. **Clear** removes it by hand.

**Your story as the data.** **Use my own story…** loads a StoryMind backup in place of the sample:
- It is slimmed (`slimWorld`). Pictures, embeddings, the book and the universe's own prompts are dropped,
  and characters under 18 are left out with every record that mentions them.
- It is kept in this browser (IndexedDB).
- Each scene rewinds it to the scene's day. Pieces the story never produced are filled from its facts.

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
`modelTier`). Claude stands in for the model, exactly as in the Roleplay tests. Roleplay compares the three
tiers by default, and **Add Claude's tiers to every setting** adds them everywhere. The engine scene is
recorded with the strongest tier (with the `pe-field` tags, so every call still knows its setting) and
replayed with each tier. Claude's tiers can also be added as candidates beside OpenRouter models on the
site.

To compare your OpenRouter models themselves, run the tab on the StoryMind site, use **Export
results**, then **Import results** inside Claude and press **Compare again**.

## Engine tests

The **Engine tests** tab is separate from the roleplay tests. The background engines cannot be tested from
a hand-made payload: what each one is handed is assembled from live state, and most of them read what an
earlier engine wrote. So the app plays for real in the sandbox (`liveBegin` / `liveScript` / `liveTurn` /
`liveEndDay` / `liveEnd` in the bridge). Every engine switch is on, `chatCompletion` is wrapped, and each
call is recorded with its debug label, the prompt key(s) it read, the exact messages and the model.

**Scripted scenes.** An engine scene is written for one purpose, and **most of its lines are scripted on
both sides**, so the right outcome is known. A line reads as a script:
- `Emre: …` is the player;
- `Sami: …` / `Buket: …` is a character's scripted reply;
- `GM: …` is a gamemaster beat.

The bridge's `liveScript` puts the player's line, the beat and the scripted replies in the transcript.
It then runs the engines that follow a turn and waits for the app to go quiet. Only an unscripted line
(usually the last) is answered by your model.

| Scene | Built to test |
|---|---|
| Plans that change their mind | a barbecue that goes *maybe* → *no* → *yes* after convincing; a Monday lift agreed, then cancelled; a promise to bring dessert. One meeting, recorded as agreed only from the yes, and the cancelled lift not left standing |
| A promise that slips | a word given earlier, renegotiated in public: the promise updated (not doubled), the slip visible in the readings |
| The gamemaster at the beach | the **quality** of every beat: from this story and giving the scene somewhere to go. "The wind blew" on a beach is a failed beat |
| Off-screen life | the world pulse and day end: are the others' events, diaries, goals and drifts specific, consequential and true to them? |
| Comings and goings | presence and the routers: who leaves and arrives exactly when, who answers |
| A secret comes out | a broken promise noticed, readings that move hard, memories that keep what was said without inventing |
| A rumour in a public place | the rumour recorded as said, by whom, who heard, credibility as gossip |
| Flirting in front of her husband | the routers and readings under pressure: Sami cannot sit out, Buket is not skipped |

Each scene carries a `focus` (its purpose and expected outcome) and `checks` (the engines it is aimed at).
A scene can set its own place, cast, opening line and story state, such as gamemaster cadence, the
off-screen pulse or End Day.

**The flow** follows the same hierarchy as the roleplay side:
1. **Run the selected engine scenes** plays every ticked scene.
2. **E1 · each engine judged on its own** (`engine`), per scene. The judge knows the scene's purpose and
   which lines were scripted, reads that engine's real calls, and reports its verdict, problems and
   reasoning. It proposes no fixes.
3. **E2 · each scene re-evaluates its engines' judgements** (`engscene`, `engSceneReport`). It gets the
   judgements, not the calls, and writes the scene's report:
   - the outcome against the known result (*right* / *partly* / *wrong*);
   - each judge's cause, confirmed, corrected or rejected;
   - the quality of generated content (gamemaster beats, off-screen events, diaries).

   The report shows in the scene list.
4. **Before → after for the engines** (`engeffect`, `checkEngEffect`): when an earlier engine run is on
   record (`engsnaps`), one turn checks what the last changes did. It gets the edits applied in between,
   a diff of each engine prompt that changed, and each scene's outcome and each engine's verdict before →
   after. Its verdict, with reverts, shows above the engine analysis.
5. **E3 · one fixer per engine prompt that had problems** (`engfixer`, `fixEnginePrompt`), two at a
   time. It gets the prompt's current text, every judgement of it across the scenes, the reports of the
   scenes it ran in, and one real call (what the app sent, what the model answered). It proposes up to 4
   edits (`P:<key>#n`) and never renames a field the app parses. Its proposals can be applied directly
   from **Each engine prompt's fixer**.
6. **E4 · the engine reconciler** (`engfinal`) gets every scene report and every prompt fixer's
   proposals, but no calls. It checks that the engines that feed each other still agree, keeps, merges or
   drops each proposal, and writes the final edits.

**Judge all, then analyse** runs steps 2 to 6. **Write the fixes** runs steps 3 to 6 over what is already
judged. A failure stays on screen with **Write the fixes again**. **Fix this prompt**, on a judged engine or
in the fixers list, runs that one prompt's fixer only.

**Export results** and **Import results** in the engine tab move a whole engine test set between browsers
(`kind: "engine-test-results"`): the calls and judgements of every scene, the scene reports, the prompt
fixers and the engine analysis. An import replaces the engine results that were there. The Roleplay
tests' Export also carries the engine runs, and the engine tab imports those too.

**Play only this scene** and **Analyse it** remain for one scene at a time. Its lines can be edited, and
**Reset the lines** restores the script. Results export and import with the roleplay results.

**Who answers the calls.**
- **Your model** (OpenRouter or NanoGPT): StoryMind's own `chatCompletion`, so every engine goes to the
  model the app assigns it (`mcModel`, `memModel`, `gmModel`…).
- **Claude stands in**: every call is answered by Claude through the viewer's account. This is the only
  choice inside the Claude app when no other provider is reachable.

## Making a pack the shipped defaults

The editor produces a prompt pack. That changes what one phone uses, not what `index.html` ships. To
make a pack the defaults, give the file to Claude in this repository: the registry `def()`s and
`BLOCK_TPL_DEFAULTS` are rewritten from it, and the `vNNN.N refresh` migrations follow the usual rules
for upgrading stored copies.

Test: `tests/prompt-editor.browser.js`.
