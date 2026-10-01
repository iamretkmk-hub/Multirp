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

**Story data.** A sample world (Isdemir Lojmanları: Sami, Buket and Berker Özüçak, player Emre, an
evening scene about the money Sami owes; Buket speaks by default) is built in the sandbox at boot. **Use my own story…** loads a
roleplay export, a universe export or a full backup instead. Prompt overrides stored inside a universe
(`u.prompts`, `u.blockTpls`) are cleared in the sandbox, so the preview shows the editor's prompts.

The sample carries data for every piece of a reply: condensed and older memories, a rumour (Buket's stake,
Sami and Berker carrying it), trackers, a plan due tonight and one lived this afternoon, promises both ways,
a quest, where they have been today, relationship readings with a live charge, private motives, a limit
Buket drew, and drives passages for both. Its last line is an ask with a hand in it, and a short text
thread gives the text kind something to answer.

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

## Claude

Inside the Claude app the page uses the `sample` capability (the viewer's own Claude). Opened anywhere
else, it uses an OpenRouter key typed into the page. That key is kept in this page's localStorage
(`pe_v1_orkey`) and is never read from StoryMind.

- **Ask Claude** sends the open item (its text, its purpose and the shipped default) and optionally the
  full payload. A reply with a ```` ```prompt ```` block gets **See the change** / **Use this version**.
- **Test & review this payload**: Claude first answers the payload as the roleplay model would. Through
  OpenRouter the real message list is sent, and the "Test with" switch can use StoryMind's own roleplay
  model. Claude then reviews its own reply against the payload and returns find/replace edits on named
  items (`frag:` / `prompt:` / `tpl:`). Each edit applies only if its `find` text is still present.

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

Each line is one turn. The editor builds the real payload for that turn (the bridge's `build` takes a
`scene`: its place and cast, an opening line, and the exchange so far, including the model's own earlier
replies), gets the model's reply, and feeds it into the next turn. Claude then judges the transcript against
the scene's ground truth and pass line: each reply **held**, **bent** or **broke**, the turn it first
drifted, a score out of 10, and find/replace edits on named items that can be applied in place. A full run
is 45 replies and 10 judgements. Through OpenRouter, "Test with" can make StoryMind's own roleplay model
play the scenes, with Claude as the judge.

## Making a pack the shipped defaults

The editor produces a prompt pack. That changes what one phone uses, not what `index.html` ships. To
make a pack the defaults, give the file to Claude in this repository: the registry `def()`s and
`BLOCK_TPL_DEFAULTS` are rewritten from it, and the `vNNN.N refresh` migrations follow the usual rules
for upgrading stored copies.

Test: `tests/prompt-editor.browser.js`.
