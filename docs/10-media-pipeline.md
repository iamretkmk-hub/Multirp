# 10 · Media Pipeline — Images, Video, Scenes, Speech



## The Book — Story Book and Video Book as a novel (v150.0)

Asked: "like a book written by a third person with pictures … use image generation as a trigger … the LLM should
receive all the dialogue, narration and thoughts and write the gap between the images like a writer … no dialogue
bubbles — it is not a comic book anymore." This replaced the comic of v119.1–v145.1 (panels, captions, word-for-word
bubbles, the webtoon / comic-page layouts, Save page, the Video Book's speeches and gap narration). Chat menu › Go to ›
**Story Book** (`openStoryBook`) or **Video Book** (`openVideoBook`) — one modal, `_bookMode` "story" | "video".

### Shape (`bookPlan(chat, kind)`)
- **Chapters** are days, **scenes** are places (a journey's `travelBeat` starts one; `_bkStamp` stamps a journey with
  where it arrives, and a line typed after a day marker with the new day).
- The book's **anchors** are the pictures (Story Book: `m.img`/`imgSrc`/`imgStored`/`hadImg`) or the scene clips
  (Video Book: `m.sceneClip.src`). A still is not a Video Book anchor; the books are written separately.
- A **run** is the lines since the last passage up to: an anchor (`end:"anchor"`, a lead-in), the end of the scene
  (`"scene"`), the day's marker (`"day"`), `BOOK_RUN_MAX` (40) lines (`"cap"`), or a passage already written
  (`"before"`) — all *closed*, ready to write. `"open"` is the live edge (the story goes on); `"waiting"` stops at a
  picture or clip still being made, so the book is always written in story order.
- Lines (`_bkCounts`): every user/assistant line with text, presence notes (arrivals, departures) and day markers; no
  app notices (`sysError`, `uiNote`) and no text-message thread.

### The trigger
- `illustrate` → `bookOnMedia(chat,"story")` when a picture finishes — whatever the image mode (`always`, `smart`, or
  `off` with the Generate image button). `sceneVideo` → `bookOnMedia(chat,"video")` when a clip finishes.
- A journey (`travelBeat` pushed) → both books (the scene left behind can close). End Day and `_quietDayEnd` →
  `bookOnDayEnd(chat, day)`: the day that ended gets its closing passage (with the marker's narration).
- `bookOnMedia` is debounced (1.2 s) and writes only the **current day**, at most `BOOK_LIVE_MAX` (6) passages, and
  only in a chapter with a picture or a passage in it — never a day nobody illustrates, never history behind the
  player's back. It runs in the background (`foreground:false`), never delays a reply. `state.bookAuto` (Write as
  you play, default on) turns it off.
- Opening a chapter (`_bkOpenCatchUp`) writes what that chapter is missing, foreground, stopping when the book is
  closed or another day is chosen. One queue per chat and book (`_bkJob`), one passage at a time.

### The writer (`x_book_writer`, Settings › Prompts › Story Book & Video Book)
One call per run (`bookWriteRun`), on `state.bookModel` (blank → the story's model), `fn:"narrate"`. `{{media}}` is
"picture" or "video clip". The user message (`epDefine("x_book_writer")`):
- **THE BOOK SO FAR** (`_bkSoFar`, v150.1) — the passages before the run, whole and newest last, as many as fit
  `BOOK_PREV_CHARS` (6000); only the oldest that does not fit is cut, at a paragraph, behind a "…";
- **WHERE AND WHEN** — day, part of the day, place, and the place's description;
- **THE PEOPLE** (`_bkPeople`) — speakers first, then whoever was present (max 8), each with: *FIRST TIME IN THE BOOK*
  when they were in no earlier passage's lines and are not named in its prose; looks (`normalizeLook`); the card's
  personality and "how they talk" (`style`); the card's background, labelled *to understand them, never to reveal
  what the lines have not shown*; what they are to the player (`playerTieLine`); how they stand with the player and
  with each other person here — the tie word and the slow relationship readings as behaviour (`relReadings`);
- **THE PLAYER'S CHARACTER** (`_playerProfileBlock`);
- **THE LINES** — speech and `*actions*` as played, each `_thought_` marked `(unspoken thought: …)` (`_bkThoughtsMarked`,
  v150.1), the player marked "(the player)", events in brackets:
  `[Berk leaves.]`, `[Time passes — it is now Night.]`, `[A journey] …`, `[The day ends.] <narration>`;
- **WHERE THIS PASSAGE SITS** — opens the book / a new day / a new scene / carries on; ends on the picture (or, in the
  Video Book, "its last N lines: the clip that follows shows them in motion, without words") / closes the scene /
  closes the day / the story goes on;
- **LENGTH** — `BOOK_LEN[state.bookLen]` (short / medium / long): words per told line, clamped.
The prompt: tell every line in order, retell rather than copy, keep quoted words faithful (trim, never change the
meaning or add a promise or decision), improvise texture but not events, keep sheet secrets, introduce first
appearances, set the scene when opening, continue the book so far without retelling it or reusing its images and
phrases, end on the picture's moment, bring a closing to rest; plain prose, no markdown. `_bkCleanOut` strips fences,
a stray heading or JSON.

**Thoughts are material, not text (v150.1).** Reported: the characters' thoughts appeared in the book as they were
typed. A thought is the writer's private knowledge of that character, to write their inner world from — what they
want, fear, notice and hide, the gap between their words and their meaning — never quoted, italicised or paraphrased
line by line. In code, `_bkCopiedThoughts` looks for any five consecutive words of a thought in the draft; a draft that
has one goes back once with `x_book_writer_redo` naming the copied thoughts (the draft as the assistant turn before it),
and the second draft is kept. Passages written before v150.1 keep their text until rewritten (↻).

### Stored, and the failsafes
`chat.book[kind] = {passages:{<first mid>:{mids, sig, text, end, at, stale?}}, hidden:{<mid>:true}}`. A passage
stands while its messages stand unchanged (`_bkSig` hashes their ids and text), contiguous and in one scene, with no
anchor inside it but at its end.
- **Picture taken out of the book** (the × on it, `bookHidePic`; the chat keeps it) or **bytes gone**: the text stays —
  the passage is still a true telling of its lines and runs on into the next. *Put back* (`bookUnhideDay`) returns it.
- **A line deleted, edited, or a reply retried**: the passage no longer matches and becomes a *ghost* — shown faded
  ("The story changed here") until it is written again over what is left.
- **A picture added mid-passage** (Generate image on an old line): the passage is re-cut and written as two.
- **A picture regenerated on the same line**: nothing changes — the passage tells the moment, not the drawing.
- **No key, or the writer failed**: the run shows "Not written yet — as it was played" (`_bkRawHTML`) with *Write it*;
  a failure stops the queue until the next trigger.
- **After the day's last picture**: "The story goes on — N lines since the last picture" with *Write them now* and the
  lines folded away. **A day with no pictures**: "No picture was made on Day N" with *Write this day as text*.
- **Rewrite** (the ↻ under a passage, `bookRewrite`): marks it stale and writes it again; old text faded meanwhile.

### The page (`renderBook`)
Paper, Literata/serif, justified with hyphenation; *Chapter / Day N*, a small-caps place · time heading per scene
(⁂ between scenes, ▶ plays from there), a drop capital on the chapter's first passage, pictures (or clips with their
controls) sized to their own shape between passages. `_bkReconcile` replaces only the blocks whose HTML changed, so a
picture or a playing clip is never reloaded when a passage arrives. The **Writer** button opens the options: Write as
you play, passage length, writer model, *Write what this day is missing*, *Save the book* (see below) and *Save as video* (Story Book only).

### The kept book and Save (v150.2)
Reported: no visible save, and the pictures are erased after a while. Why they go: a hosted picture is only a link
until its bytes are copied (the copy can be refused by the host), and a chat's stored bytes are swept with the chat
(a universe reset, a restarted scene). So the book keeps itself, apart from the chat — always ONE book per story:
- `book:<uni>:<kind>` (IndexedDB) holds the kept book's sections in reading order — chat, day, place, text, and the
  picture/clip it leads to; `bookmedia:<uni>:<kind>:<mid>` holds the book's own copy of each picture (data URL) or
  clip (Blob). No prune sweep touches these keys.
- `bookKeep(chat, kind)` syncs it: `_bkArchive` copies every anchor the kept book lacks (sources: the message, its
  `mimg:` bytes, the gallery copy, a fetch), then this chat's sections are replaced in place by its written passages
  (a passage being rewritten keeps its old text); sections of an earlier chat of the same story stay, so a reset adds
  to the same book. A picture the chat lost keeps its kept copy; one taken out or whose message was deleted leaves it.
- It runs when a picture or clip is made (`bookOnMedia`, before the writer — so the bytes are taken while the link is
  alive, whether or not the writer is on), after every passage, when the book opens, and when a picture is taken out
  or put back. The page and the reader fall back to the kept copy (`bookKeptSrc`) when the chat's is gone.
- **Save** (the bar, always labelled; also in the Writer options) — `bookSaveBook` writes the whole kept book
  (`bookKeptHTML`: title, every chapter, place headings, prose, the pictures or clips inside) as one HTML file. With
  `showSaveFilePicker` (Chrome on a computer) the first Save picks the file and stores its handle
  (`bookfile:<uni>:<kind>`); every later Save rewrites that file, and `_bkAutoSave` rewrites it after each new passage
  while the tab holds write permission. Elsewhere Save hands over the whole book each time (share sheet or download).
  *Other file* forgets the chosen file.
- **In the backup (v150.3)**: Export everything carries every kept book with its pictures and clips, the rolling
  snapshots the books' text, and a roleplay export its story's book (see 11-settings-and-backup).

### The reader (`openBookPlayer`) and Save as video
`bookPlayItems` plays exactly what the book holds: a card per scene, each paragraph of each passage on a dark page,
read in the narrator voice through the narrator effect (`_mcPrep`, needs the Inworld relay and `state.bookVoice`;
silent otherwise, held for `_mcReadMs`), then the picture drifting (`mcShotLayout` frames it; its animation plays
instead when it has one) or, in the Video Book, the clip played through with its own sound. A part not yet written is
passed over; a picture or clip that is gone is skipped. Pause, back, next, close and the voice switch cancel through
`_mc.seq`, drawn from one counter (`_mcSeqN`) so a loop left from a closed session can never drive the next.
`bookRecordVideo` records the same list (cards, pages of prose, pictures) on a 1080×1920 canvas with the voice
(`_mcVidDraw` kinds `title`, `text`, `panel`, `end`) — MP4 or WebM, in real time, cancellable.

### The chat's own Comic view and the player's voice (v122.1, unchanged)
- **Comic view** (`state.chatComic`, Roleplay options) is a way of showing the *chat*, not the book: `comicBodyHTML`
  splits a bubble's text into caption boxes above the picture and speech below it.
- **The player's voice**: `state.userVoice`; `playerVoiceId()` falls back to the default call voice. With Speak replies
  on, `speakPlayerTurn` voices a typed turn.

## Video model (v39.7)

`VIDEO_MODELS` offers **one** entry — `bytedance/seedance-2.0-mini/reference-to-video`, which is
also `VIDEO_MODEL_DEFAULT`. `image-to-video` is no longer offered; it can still be typed into the
custom id field and routes correctly (`vidFamily` matches on the id, `vidIsRefOnly` distinguishes
the two endpoints).

**(!) The boot migration must never match a bare vendor or family name.** It used to test
`/…|seedance|…/` against the stored id, which fired on the app's OWN family: choosing the second
shipped model, or typing `seedance-2.5-pro`, was silently reverted to the default on the next
reload — the picker offered a choice that could not stick, and the comment promising a hand-typed
id is "left alone" was false for the only vendor shipped. It now lists only genuinely retired ids
plus the removed `seedance-2.0-mini/image-to-video`. Covered by `tests/video-model.browser.js`.


## Pictures during play — one choice, not a switch and a slider (v39.4)

`state.imgMode` (`sm_imgmode`) is the single authority, read through `imgMode()`:

| value | behaviour |
|---|---|
| `always` | every reply is illustrated |
| `smart` | `decideVisual()` asks the **visual director** once per reply |
| `off` | nothing is auto-drawn; each reply keeps its Generate button |

Migrated on load from the old pair so nobody's visible behaviour changes: `autoImg ? "always" : "off"`.
`state.autoImg` is kept in step in `saveSettings` because the debug env dump, the backup bundle and
`_imgGate()` still ask that question as a boolean. `imgTurnDue()` and the "illustrate every N replies"
slider are retired — "how often" was always a proxy for "is this beat worth a picture".

**The visual director** (`visualDirector` prompt, `sm_visualdirector`, editable like any other) is
given what the picture currently on screen shows, the last four lines, and the speaking character's
video scenes — `scenesFor(speakerId, speakerName)`, the same per-character filter `routeSceneForBeat`
uses, so one character's scenes can never play over another's. It answers:

- `0` → keep the picture already on screen (talk, gestures, glances and tone never earn a frame);
- `1` → `illustrate()` (a move, an arrival, clothing, a place, light, or a sexual act changing);
It answers nothing else. **Scene videos are started by hand** ("Play over story") and are never
chosen for you — `routeSceneForBeat`, which read each beat and switched which of a character's
scenes was docked, was removed in v39.8 along with the director's scene-name branch. While a scene
is docked, `sceneModeActive()` makes `autoVisualize` draw nothing at all: the video carries the
visuals until the player closes it.

**Heat follows the scene both ways.** Starting one raises Heat of the moment
(`_heatFollowScene(true)` inside `playSceneInChat`), so every path that STOPS the scene has to put
it back. Three do: `closeSceneDock`, `deleteScene` (only when the deleted scene was the one playing
in the *current* chat), and `syncSceneDock` when the scene has vanished from under the dock. The
last two used not to, and left heat raised with no video playing.

Every failure path draws rather than skips — a missing picture is worse than a spare one — and a
malformed answer is logged with what the model actually said. `routeSceneForBeat` now also runs when
`imgMode()==="smart"` even if the Smart-routing switch is off: that switch governs the model-RULE
router (`pickRule`/`routerPrompt`), and turning it off must not freeze a docked scene.


## Auto-illustration flow (`illustrate(mid, replyText, force)`)

Fires per assistant reply when auto-images are active (`autoImgActive` — toggle + the
"pause images" mode + heat suppression), or manually per bubble. Steps:

1. **Idempotency guard** — several paths can call it for the same message; the first in-flight
   call owns the frame (`msg.img || imgState==="loading"` short-circuits unless `force`).
2. **Per-character continuity** — `chat.imgPromptBy[charKey]` holds only *that character's*
   previous frame prompt (a newcomer starts blank so they're never drawn into the previous
   speaker's picture). Cleared on exit/travel.
2b. **The window since the last picture (v52.2)** — `chat.imgWindowBy[charKey]` holds the mid of
   the frame that character was last drawn in, and everything after it goes to the writer as
   analysis material. Pictures are not drawn every turn (the visual director skips beats it
   judges unchanged), so before this the turns in between reached the writer through nothing at
   all: a jacket came off three beats ago and the frame still showed it on. **Whose lines:** this
   character's and the player's only — the same isolation `imgPromptBy` has enforced since v19.3,
   so two characters in one room never draw from each other's dialogue. Bounded by
   `IMG_WINDOW_MAX_LINES`/`IMG_WINDOW_MAX_CHARS` (20 / 3000, trimmed from the old end), never
   reaches past the last `travelBeat`, skips the trigger line (it is already in the latest
   exchange), and is stamped only on a **successful** frame so a failure does not swallow the
   turns it failed on. Reset with the continuity prompts: `travelTo` wipes the map, an exiting
   character loses theirs (`applyPresence`).
3. **Route first** (`pickRule(state.imgRules, routeText)`): the router LLM (`routerPrompt`,
   `routerModel`) sees the location line, the character's own **sticky previous scene type**
   (`chat.lastImgRuleBy[charKey]` — "keep the same type unless the roleplay changed"), and
   the latest exchange; returns a rule index. Routing off / one rule ⇒ first enabled rule.
   **This is also the POV fork (v52.2).** A rule carries `pov`, so choosing the scene type
   chooses the path, and `routerPrompt` decides it by CONTACT, not by mood: nobody touching
   anybody (talking, eating, arriving, an argument in words) takes a POV type; the moment they
   are in contact — a hand on an arm, an embrace, a kiss, anything sexual — it takes a
   third-person type, because two bodies in contact cannot be read from inside one of their
   heads. Stickiness must not hold the shot on the wrong side of that fork.
4. **Write the prompt** — system prompt layering:
   `rewritePrompt` (universal extraction rules) → shared FOUNDATION (for legacy rules) →
   the routed rule's own `promptStyle` (camera/pose/shot detail) → the frame guide → and on the
   POV path only, `IMG_WRITER_POV_GUIDE`. The user message = continuity reference (previous
   frame; exchange overrides it) + the window since that frame (analysis only) + latest
   exchange. **No character sheet is sent** — the writer refers to people generically.
5. **Deterministic tail (code, not LLM)**: the focal speaker's real appearance
   (`_imgSpeakerAppearance` from structured `look` + wardrobe), the location clause, the
   time-of-day lighting clause — then the user's selected **style tail** last
   (`styleTail()`, idempotent append).
5a. **POV vs third person (v52.2)** — `rulePov(rule)` reads the rule editor's POV switch, which
   had been saved since v25 and read by **nothing**: every scene rendered third person whatever it
   said. It now selects the path in two places at once.
   · **The writer** gets `IMG_WRITER_POV_GUIDE`: the lens is the player's face, he is not a body in
     the frame (no head, no shoulders, no mirror, no over-the-shoulder onto himself, no IMAGE slot),
     his hands may enter the low frame when the exchange puts them there, and **the gaze rule is
     reversed** — she looks INTO the lens. That reversal is why this is a code block and not a line
     in a template: "characters never look at the camera" is a hard guardrail everywhere else in the
     writer, and an override has to be stated at the level of the rule it overrides.
   · **The reference pack**: `buildRefPack` does **not** send the player's photographs on a POV rule
     even when the cast is "and you". Handing an edit model a man it must place is exactly how a
     first-person shot comes back as an ordinary two-shot of a couple. Untick POV and the same rule
     is the two-shot again, his pictures included.
   **The two paths (v52.3)** are the first two entries of `DEFAULT_IMG_RULES`, each with its own
   full template held as a constant so the rules, the migration and the rule editor's
   Insert-template picker all read one copy:
   · `r_pov_talk` "Standard / daily — your POV" → `IMG_STYLE_POV`. The daily path, POV all the way
     down: the lens is his face, the emotional-register shot list is restricted to angles his own
     head could be at, he takes no IMAGE slot (the phrase "the man in IMAGE 2" appears in it only
     to forbid it), his hands may enter the low frame, and her gaze comes to the lens.
   · `r_intimate_std` "Intimate — contact & sex (third person)" → `IMG_STYLE_INTIMATE`. The contact
     path: the camera is back in the room, POV is banned outright ("a shot from inside one of their
     heads cannot show two bodies in contact"), the player is IMAGE 2 and a body with weight and an
     expression, the frame's job is to make the **join** readable (relative direction, weight and
     pressure rather than a gap, asymmetry, then the join named once), every one of the four hands
     is accounted for, nobody looks at the lens, and the over-the-clothes rule is kept — a hand on
     a body is a hand on what that body is wearing unless the roleplay took the garment off.
   Both arrive **additively** (`K.imgPovMigration`): unlike every earlier rule-set migration, which
   replaces the whole set and so reaches only an unedited one, these insert rules into a customised
   set and touch nothing else. v1 adds the POV type unless the set already has any rule with
   `pov:true`; v2 adds the intimate type unless the set already has that id, and refreshes a v52.2
   POV template to the full one **only on a byte-for-byte match with `IMG_STYLE_POV_V1`** — the
   standard the v9 step already holds itself to, because a scene template is the part of this app
   people most often rewrite and a matching heading is not evidence the words under it are ours.
5b. **Reference roster (edit models only)** — `buildRefPack` gathers the pictures, and
   `editPrompt` prepends a roster tying each one to a person in the frame.
   **(!) The roster and the scene text must share a vocabulary.** `rewritePrompt` orders the
   writer to *"Refer to people as Man and Woman (or Girl if she reads as under ~20). NEVER use
   character names in the prompt"* — so a roster that said *"Images 1-2 are Nil Akbaba"* handed
   the model a name it would never see again and then asked it to draw a `Woman`, with nothing
   connecting the two halves; which face landed on which body was chance. The roster now uses
   **`look.subject`** (Man/Woman/Girl/Boy — the same four words, on the character card; the
   player's is `state.userSubject`, Settings › You and per-universe) and counts in **Figure
   1..N**, the unit these editors actually index by. A person's FIRST picture is their profile
   one (`splitPersonRefs`), so it is named as the face anchor and the rest as further views for
   build and colouring. No subject word ⇒ **"Person 2"**, numbered by place in the roster and
   never guessed: a confident "the Man" over a woman is worse than a number, and the grouping
   (which figures are one person) is the part that must never be wrong. `_refSubject` falls back
   to reading the look text so cards written before the field still resolve.
   Identity only — face, build, colouring. **Not** rendering style: `styleTail()` owns the
   aesthetic, and matching a photo's rendering would fight the style the player picked.
5c. **Multi-character frames (v128.1)** — asked for: every character's pictures sent, the writer
   told which is whose *before* it writes, and the prompt written per person.
   · **The pack is built before the writer.** It used to be built after, so the writer never knew
     who was in the frame. `illustrate` now calls `buildRefPack` right after routing.
   · **Everyone the moment involves.** On a "the character and you" scene type (`cast:"player"`),
     anyone in earshot whose name appears in the latest exchange — the person being answered, or
     someone the line names — goes into the pack too (`opts.involved`), after the speaker and the
     player. Group/all still send everyone present; solo/none are unchanged.
   · **(v132.1) Everyone in the scene, always.** A POV shot of two characters uploaded one picture:
     only characters NAMED in the latest lines were added. Now every people scene type
     (`player`/`group`/`all`, one choice in the editor: "Everyone in the scene") sends the speaker,
     the player unless the rule is POV, the involved characters, then everyone else in earshot
     (`inSceneCast`, falling back to `presentCast`). `solo` stays one person; `none` sends nobody.
   · **(v132.2) No picture is not no person.** Someone in the frame without reference pictures used
     to drop out of the pack and shift everyone after them up a number (the speaker had none, so the
     man beside her became IMAGE 1 while the writer, following the template, called her IMAGE 1 and
     him IMAGE 2 — never sent). `buildRefPack` now returns `unpictured` with a label ("the woman with
     no picture") and their look, and the writer gets the cast block whenever there are 2+ people,
     anyone unpictured, or a lone picture that is not the speaker's. `x_img_cast` says its numbering
     wins over the template's and that NO PICTURE people are described in words.
   · **One label per person, in the templates' own numbering.** The scene templates number PEOPLE
     ("the woman in IMAGE 1" = speaker, "the man in IMAGE 2" = player, IMAGE 3+ anyone else; on POV
     the player takes no slot). The roster used to number PICTURES, so a speaker with two photos
     made the template's "man in IMAGE 2" point at her second photo. Now `buildRefPack` labels each
     person "the <subject> in IMAGE <n>", `refRuns`/`editPrompt` use the same label and add which
     Figures are that person ("IMAGE numbers the people; Figure numbers the pictures").
   · **The writer gets the cast** (`x_img_cast`, on the image writer's card) when two or more people
     are in the pack: each label, who it is (name, "the player", whose line this is) and their
     pictures, with the order to call everyone only by their label; anyone else in frame with a
     decided outfit gets it under their label. A one-person frame is written exactly as before.
6. **Generate** via the rule's provider (`genImageForRule` → AtlasCloud / fal / ModelsLab /
   OpenRouter). Frame resolution: per-image `msg.ratio` → rule `ratio` → global
   (`_frameOverride` transient during the call).
7. **Bookkeeping**: `msg.img/imgSrc/imgPrompt/imgRule/ratio`, `saveMsgImage` (bytes → IDB so
   the scene survives reload), continuity + gallery record push, base64 eviction caps,
   `persistImages`/`persistChats`/`refreshBubble`.

Image/video **rules** (Settings → Image/Video): ordered list, each
`{label, when (router description), provider, model_id, loraPath, loraScale, keyword (LoRA
trigger, auto-prepended by injectLoraKeyword), negative, promptStyle, ratio, enabled}`.
Smart routing toggle is shared between images and video.

The **image rail** (landscape) mirrors scene images beside the text (`renderImageRail`,
pinning via `togglePin`); `sceneHTML`/`refreshBubble` render the in-bubble media block with
the per-image menu (frame picker `pickFrame`, retry, view prompt, Animate/Movie/Scene).

## Video (rewritten v27 — one path, one request builder)

> Replaces the older three-path design (wan-2.2 Animate + wan-2.5 Extend/Movie). The
> `seedance*`, `movie*` and `extend*` settings keys, `wanAnimateVideo`/`wanExtendVideo`,
> `movieScene` and the `extendPrompt` registry entry are all **gone**; v27.8 removed the Wan
> option and all LoRA plumbing with it.

- **One video path.** `generateVideo(prompt, imageUrl, opts)` is the single request builder
  (`===== VIDEO OPTIONS + THE ONE REQUEST BUILDER (v27) =====`). Default model
  `VIDEO_MODEL_DEFAULT = "bytedance/seedance-2.0-mini/image-to-video"`.
- **Options are opt-in per field**: every option the model family exposes lives in Settings
  (`vidAspect`, `vidFps`, `vidBitrate`, `vidSteps`, `vidShift`, `vidSeed`, `vidGuidance`,
  `vidNegative`, `vidExpand`, `vidLastFrame`, `vidRefs`, `vidWatermark`, `vidRes`…), and a
  field is put in the body **only when actually set** — so pointing the model id at a
  different model never sends it a field it doesn't know.
- **Two shipped models** (`VIDEO_MODELS`), matched by *family* on the id so siblings
  (seedance-2.0-fast, -2.5) route correctly without being listed:
  - `…/image-to-video` — the scene image is the first frame; 4–15 s; renders its own synced
    sound; accepts reference images/video/sound alongside the frame.
  - `…/reference-to-video` — **no first-frame slot**: the scene image is sent as `@image1` and
    the library follows (up to 9 images, 3 videos, 3 sounds). Items must be *named in the
    prompt* or they're ignored (`vidIsRefOnly` also shifts the prompt sheet's slots down one).
- **Resolution ladder is model-specific**: `SEEDANCE_RES = 480p · 720p · 720p-SR · 1080p-SR ·
  1440p-SR` — plain `1080p` is **not** an option and is a hard 400. `vidResolutionFor(model)`
  maps whatever is configured onto the accepted ladder.
- **Animate** (`animateScene(mid)`) is still the per-scene entry point; the motion prompt is
  written by the `vidPrompt` writer (`===== VIDEO PROMPT WRITER (v27) =====`). Voice-guided
  animate (`animVoice`) sends the line's TTS as the clip's audio where the model supports it.
- Async submit→poll via `atlasGenerate`.

### Frames must be HOSTED before the request goes out (v32.0)

`generateVideo`'s `hostFrame` uploads the first frame (and a finishing frame) via `atlasUpload` and
**throws** when the result is not an `https` URL. It used to be
`try{ return await atlasUpload(u) }catch(e){ return u }`, and that fallback was the bug behind
"video always errors and nothing reaches AtlasCloud": any failed upload — a rejected key, a 5xx, a
blocked CORS preflight — handed the *original* source back, so `image` went out as a multi-megabyte
base64 `data:` URI (or a `blob:` URL meaningless off the device). The resulting request is megabytes
of JSON that the browser/network layer rejects **before delivery**, so the app reported
"Couldn't reach AtlasCloud (network/CORS)" for a request AtlasCloud never received and never logged.
The error now names the step and the real cause (usually the key).

`atlasGenerate` carries the backstop: `_atlasUnhosted(body)` refuses to send any body whose media
fields still hold a `data:`/`blob:` URI, and the CORS/network message now records the payload size
so an oversized body is visible in the debug log. **`images` is deliberately exempt** — the image
*edit* models take their references as inline base64 in that field by design. `atlasLipsync` hosts
its image and voice track the same strict way.

### The returned last frame is not always in `outputs` (v32.1)

`return_last_frame` was being sent correctly, but the frame was only ever looked for in
`dd.outputs` — and `atlasGenerate` forwarded *only* that array, discarding the rest of the
completed payload before anything could search it. Any result shape that carries the frame
elsewhere therefore came back as "video only":

| shape | before | after |
|---|---|---|
| `outputs: [clip, frame]` | found | found |
| `last_frame` / `last_frame_url` beside `outputs` | **null** | found |
| one output object holding `{video_url, last_frame_url}` | **null** | found |
| nested, e.g. `result.final_frame` | **null** | found |
| clip only (model returned no frame) | null | null |
| clip + an unrelated `callback_url` | null | null |

`_ret` now carries `raw` (the whole completed payload) alongside `outputs`, and `_pickLastFrame`
searches in confidence order: keys that explicitly name a last frame (`_LASTFRAME_KEY`, matched at
any depth), then an image-extension output, then any output that simply is not the clip
(extension-less OSS URLs), and only then a picture-sounding key (`_FRAMEISH_KEY`). It is
deliberately **not** "any URL in the response" — a callback or docs link would otherwise be saved
to the gallery as though it were a frame.

Diagnosis: the debug log's `ok` line for a generation now appends `(N outputs)` when more than one
result came back (`_dbgOutsNote`), so "did the model return a frame at all?" is answerable without
guessing, and the playground toast distinguishes *"the model returned no last frame"* from the
setting being off.

### Toggles that decide a request body commit on change (v32.2)

Settings are otherwise committed **only** by the "Save settings" button. For a switch that decides
what goes in a request body that is a trap, and it produced a real report: *"return last frame is
on but I only get the video"*. The pasted request body had no `return_last_frame` field at all
while `generate_audio: true` — its neighbour, one line away in the same builder — was present, so
`state.vidLastFrame` was genuinely `false` while the switch read ON. Flicking a switch and leaving
the screen without saving updates the DOM and nothing else.

`bindLiveToggles()` (called from `syncSettingsUI`, idempotent) makes `setVidSound`,
`setVidLastFrame`, `setVidWatermark` and `setAnimVoice` write themselves through on `change` —
state **and** their one storage key. Only that key is touched; it never re-reads the settings DOM,
so a half-populated screen cannot clobber anything the way a full `saveSettings()` could.

The Generate video panel now prints the flags the clip will actually be **requested** with
("…returning its last frame" / "…without a last frame"), plus an explicit line when it is off, so
the effective setting is visible where Generate is pressed rather than on another screen.

## Voice samples — the actor's own moaning track (v32.0)

The **Create sample** button in Generate video (`_i2vSampleSection` → `i2vCreateSample`) builds a
vocal track for the clip in two separable steps:

1. `writeMoanScript(actor, sec)` — an LLM writes a **tagged vocal script**: voiced sound only, no
   words. The prompt is the editable `moanPrompt` registry entry (`DEFAULT_MOANPROMPT`), which gets
   `{{seconds}}` (the configured clip length) and `{{beats}}` (`moanBeats` — one tagged segment per
   ~1.6s, so the track fills the clip rather than stopping a third of the way in). The tag
   vocabulary is fixed: `<build-intensity>`, `<fast>`, `<slow>`, `<breathy>`, `<whimper>`,
   `<shout>`, with `[breath]`/`[breathe]`/`[pause]` inside a segment and capitals carrying volume —
   e.g. `<build-intensity> Ah [breathe] AH [breath] AAAH! </build-intensity> <fast> Ah Ah Ah Oh </fast>`.
2. `speakMoanScript` → `atlasTTS` in the actor's **own** voice: `ttsVoiceFor(actor)`, i.e. the voice
   set on their bio, falling back to the global default. `atlasTTS` calls `ttsCleanText` with
   `stripTags` **false**, which is why the delivery markup survives to synthesis.

`_i2vActor()` resolves who the clip is of from the gallery record (`characterId`, then `character`
by name); `moanActorBrief` passes their temperament — not their whole bio — so the writer colours
the delivery without being tempted into words. `cleanMoanScript` strips nested preambles, code
fences and quotes (the engine would otherwise *pronounce* them), retrying until nothing more comes
off. The result is attached as a reference sound via `_i2vAttachSample`, which **replaces** the
sample a previous run attached so repeated takes cannot eat all three audio slots. The script stays
on screen and editable: **Re-speak** re-runs TTS only, no LLM call.

> The model only accepts `reference_audios` **alongside a reference image or video** (see
> `generateVideo`), so with an empty image tray the sample would be dropped from the request without
> a word. The panel says so instead of letting it happen silently.

## Gallery, scenes, playground

- **Gallery** (`renderGallery`): Images/Videos tabs, per-character folders (`openGalFolder`),
  scoped by universe (`_galScope`), viewer with swipe (`openImgViewer`/`_galViewerStep`),
  delete, download.
- **Scenes (v27)**: user-curated ordered playlists of gallery clips per character
  (`createScene`, `addSelectedToScene`, editor `renderSceneEditor`, picker
  `openScenePicker`). Playback: seamless multi-clip player (`smCreatePlayer` — double-buffered
  `<video>` swap), fullscreen modal (`playSceneModal`) or the in-chat **scene dock**
  (`playSceneInChat`, resizable overlay; landscape uses the right rail). **Scene mode**: while
  the video window is open, `autoVisualize` routes new beats to scene selection instead of
  images (`routeSceneForBeat`).
## Edit models: per-field opt-in, not a shared body

`ATLAS_EDIT_MODELS` declares only what differs between the five, and the request builder adds a
field **only when that model's spec names it** — pointing the id at a sibling must never ship a
field it would reject with a 400.

| | refs | prompt | notes |
|---|---|---|---|
| `alibaba/qwen-image/edit-plus-20251215` | 3 | 800 | `num_images`, `prompt_extend`, `negative_prompt`, `seed` |
| `alibaba/wan-2.6/image-edit` | 4 | 1200 | as above, fixed `sizes` enum |
| `alibaba/wan-2.7/image-edit` | 9 | 5000 | `n` not `num_images`; boolean `thinking_mode`; `sizeTier` — frame follows the first reference |
| `bytedance/seedream-v5.0-pro/edit` | **10** | 3600 | **no count field at all**, no `prompt_extend`, no `negative_prompt`, no `seed`; `thinking` is the **string** `"enabled"/"disabled"`, not wan 2.7's boolean; plus `prompt_optimization_mode`, `output_format`, `background` |
| `bytedance/seedream-v4.5/edit` | **10** | 3600 | same four silences as 5.0 Pro (no count, no `prompt_extend`, no `negative_prompt`, no `seed`) and **none of its four extras** — no `thinking`, no `prompt_optimization_mode`, no `output_format`, no `background`. Its own field is `enable_base64_output`, whose default `false` is the URL result the app wants, so it is never sent. 16-preset `sizes` enum in a 2K and a 4K tier, nothing below 2048 wide |

The model is **chosen from a dropdown** (`ATLAS_IMG_MODELS` → `setAtlasImgPreset`), one entry per
setup, with a deliberately blank last entry that reveals a free-text box for any AtlasCloud id at
all — including one this build has never heard of, which is sent as plain text-to-image unless
`ATLAS_EDIT_MODELS` knows it. `atlasImgSetupNote` prints what the chosen id will actually do
(reference slots, prompt cap, negative prompt, how the frame is resolved, seed) from the same spec
the builder reads. 5.0 Pro's four extra fields are surfaced in Settings and shown **only** when the
chosen or typed model id declares them (`syncAtlasImgOpts` reads the same `opts` list the builder
does, so the panel and the request cannot disagree) — v4.5 declares none, so the panel stays down. `background: transparent` is silently downgraded to `opaque` unless the
output is PNG *and* exactly one reference is sent — the API also requires that reference to carry an
alpha channel, which is not knowable here, so the impossible combination is never sent rather than
returning a 400 the user cannot read. `promptMax` is 3600 chars for the model's stated "under 600
English words".

## The sticky scene picture

An edit model of this class takes a long time per frame, and the reply lands long before the
picture: the scene area under a fresh line was a spinner, and under a line the "illustrate every N
replies" setting skipped, nothing at all. So a reply with **no picture of its own** shows the most
recent one from earlier in the scene (`_stickyImg` → `_stickyHTML`), covering all three empty
states — generating, failed, and never-illustrated.

It is **carried over, never regenerated** (no request, no cost), and display-only: pin, frame,
animate and dub all act on the message that *owns* an image, so they are not offered on a borrowed
one; clicking opens the owner's full-size view. Phone-text pictures are never borrowed — they live
in their own window. Chronological by design: each line shows the newest picture *at or before it*,
so nothing behind needs re-rendering when a new one lands, and the newest bubble is always showing
the newest picture. The backward scan is bounded at 60 messages — an unbounded walk from every
bubble in a long chat is quadratic, and at 1–12 replies per picture 60 always finds one. Toggle:
`state.imgSticky` (Settings → Image, on by default).

## Video rules are SHOT SETUPS (v31.9)

They used to be **positions** (missionary, doggy, blowjob…). They are now five **shot setups**,
chosen by what the clip has to work with, because that is what decides which reference goes in which
`@slot` and what has to be held steady:

| rule | `@image1` | `@image2` | `@image3` |
|---|---|---|---|
| `rv_first_pov` First Scene POV | woman's reference sheet | the location (empty room) | — |
| `rv_first` First Scene | woman's sheet | the location | man's sheet |
| `rv_last_pov` Last Frame POV | **the first frame** | woman's sheet | — |
| `rv_last` Last Frame | **the first frame** | woman's sheet | man's sheet |
| `rv_transition` Transition | **the first frame** | woman's sheet | — |

- **`keywords`** carries the consistency + sound block, identical in all five and prepended verbatim
  to the finished prompt by `injectRuleKeywords`. It says the reference video supplies *movement
  only*, locks identity/body/clothing/location/light/render style for the whole clip against
  mid-clip drift in the source, and specifies diegetic sound with **no music**.
- **`bare: true`** means the template IS the whole instruction: `videoWriterSystem` skips
  `DEFAULT_VIDRULES_BLOCK` and the separate SOUND section rather than stacking a second, longer
  ruleset written for the old axis on top of it. A rule without the flag behaves exactly as before.
- `applyRuleTemplate` copies `keywords`, `bare` and (only over the untouched placeholder) `when` —
  inserting just `motionStyle` gives a rule that reads right in the editor and generates the old thing.
- **Migration is additive.** `sm_vidshotaxis_v1` adds the five if absent and only *disables* the old
  position rules. A position ruleset can be hours of writing; an id that no longer ships is not
  permission to delete it.

**`msg.imgCore`** — the still prompt *before* the deterministic tail (appearance · location ·
lighting · style). The motion writer reads it instead of `msg.imgPrompt`, because everything in that
tail is furniture the reference images are supposed to be deciding, and the writer was re-describing
all of it: the location got named again, the light re-specified, the face re-described, and all three
then fought the references.

## One reference sheet per character (v31.9)

`persona.mediaRef` / `state.userMediaRef` (per-universe override `universe.userMediaRef`) is **the
one picture** an image or video model is given for that person — a sheet: full body plus several face
angles in a single frame. When it is set `personRefs()` returns *only* it; sending the avatar
alongside defeats the point, since two sources for one face is how a face drifts. `personRefs(o,
{avatars:true})` asks for the profile pictures instead, for the places that want the avatar strip.
Empty = the old behaviour, unchanged.

**Locations** carry `imgPrompt` (and each sub-location its own), edited in the `locImgModal` that the
generate button now opens. A location's `description` is written for the ROLEPLAY — what the room
means, who uses it — and none of that draws; it is now only the fallback for a place with no prompt
of its own.

**`autoFillVidRefs(ruleId, chat, speaker)`** fills the reference tray in the template's own order
(the "Auto-fill" button in the tray, or an empty tray). Order matters absolutely: the prompt says
"@image2 is the location" and the model believes it. It never writes over a hand-picked tray unless
asked with `{replace:true}`.

## Video cues — what is playing becomes something the cast answers

A gallery video carries **`cues: [{t, text}]`** — the player's own description of what the clip
shows at *t* seconds, edited from the gallery cell's cue button (`openVidCues`). Cues live on the
**video record, not the scene**, so a clip reused in five scenes is described once. While a scene
plays over the story (dock or fullscreen modal), crossing a mark hands that description to the cast
through `fireVidCue` → `runWatchTurn` → **`runMultiCharTurn`** — the same dispatch a typed message
uses, so nobody-present / one-present / many-present all behave as they already do. The description
is pushed first as a `watchCue` narrator beat (it is in the transcript and in history before anyone
answers it), and `chat.watchingNow` renders the **`watching_now`** payload block for that one turn.

**(!) This spends money and attention with nobody pressing send.** A 60 s clip marked every 15 s is
four full reply turns — payload, reply, and the whole `postTurn` tail — and a five-clip scene is
twenty. The feature ships **off** (`state.vidCueOn`), and every rule below exists to bound it:

| Rule | Why |
|---|---|
| One in flight, never a queue (`_vidCueBusy`) | A queued reaction arrives 40 s after the moment left the screen, and pushes the next later still. A mark that lands mid-generation is **dropped**. |
| Cooldown gates **every** fire, not just clip starts (`state.vidCueCool`, default 15 s), stored on `chat.vidCueAt` | This is the requested "skipping clips fires nothing", and it costs nothing to apply uniformly. On the chat rather than in memory so a reload cannot step around it. |
| Cap per play-through (`state.vidCueMax`, default 6; `resetVidCueRun` on open/re-dock) | A long playlist must not react all night unattended. |
| **Only the latest crossed mark fires** | A backgrounded tab stops `timeupdate`, so playback jumps 5 s → 40 s in one event; firing every mark between would dump three reactions at once on moments already gone. |
| A looping clip does not re-fire (`loopedOnce`) | `smCreatePlayer` loops a single clip forever; the same four descriptions on repeat is a stutter, not a scene. |
| Scrubbing back ≥1.5 s resets that clip's fired set | Otherwise re-watching a moment is silent. |
| `document.hidden` blocks | Nothing fires at a screen nobody is looking at. |

`watching_now` is a **one-turn** block: `runWatchTurn` clears it in a `finally`, and the producer
additionally checks the message index it was stamped at (`w.at`), so a stale clip can never be
narrated into the next typed message.

The editor warns rather than blocks, on the things the user cannot see for themselves: a mark past
the clip's real duration (probed via `loadedmetadata`), two marks on the same second, marks packed
closer than the cooldown, and cues being switched off globally.

- **Playground (v28)**: compose an image from actor · location · pose · AI-written prompt
  (`openPlayground`, `pgWritePrompt`, `pgGenerate`), and image→video for any gallery image
  (`openImg2Video`, `i2vWritePrompt`, `i2vGenerate`).

## Speech (summary — details in doc 06)

Dub button / auto-speak (`autoSpeakMsg`) → xAI TTS (delivery tags) or Inworld; narration
voice mode reads `*narration*` with a narrator voice + FX before the character speaks
dialogue; `dubAsVideo` = TTS + Kling lip-sync talking video; diary read-aloud (`dubDiary`).
Auto-speak OFF also flushes anything queued (`_dubKill`).

## Static art (v25.3)

Portraits, universe pictures, diary covers, map backgrounds and location images are "static
images": generated via special-purpose models (`portraitModel`, `uniPicModel`+`uniPicLora`,
`mapImgModel`, `locModel` — all optional overrides), stored as bytes in IDB
(`captureStaticImages`/`rehydrateStaticImages`, keys `simg:*`) so blob URLs survive reload,
and inlined into exports (`inlineStaticImages`).

## Warnings

- Anything that mutates a message's media fields **must** call `markChatDirty(chat)` +
  `refreshBubble(mid)` — otherwise the change neither persists nor renders.
- Base64 media is aggressively evicted (caps in doc 02). Remote provider URLs are the durable
  form — never strip `imgSrc`/`videoSrc`.
- The `illustrate` guard means a *failed* generation leaves `imgState:"error"` with a retry
  button; forcing regeneration is `reIllustrate` (passes `force:true`).
- Per-character continuity keys (`imgPromptBy`, `lastImgRuleBy`) are the fix for two shipped
  bugs (newcomers inheriting poses/frames). If you add a new generation path, key it per
  character the same way.
- Video LoRA plumbing was **removed in v27.8** — don't reintroduce per-rule LoRA channels for
  video; the option set in Settings is the whole surface.
- Sending an option a model doesn't accept is a hard 400 (the `1080p` case). Add new options
  behind the same "only when set" rule that `generateVideo` uses.

## v71.1 — the layers nobody could edit were the stale ones

An image request is assembled from five layers, in order:

1. `rewritePrompt` — the universal prompt (registry, editable)
2. `imgFoundation` — base rules, **only** when the routed rule has no `# OUTPUT STRUCTURE` of its own
3. the routed rule's `promptStyle` — the scene-type block (Image Settings, editable)
4. `imgFrameGuide` — the frame note, on every image
5. `imgPovGuide` — added when the rule is a POV rule

Layers 2, 4 and 5 lived in code as `IMG_WRITER_*` string constants. That made the one part of the
stack nobody could reach also the part that had gone stale, and it had gone stale in four specific
ways — all of them visible in a live payload:

- **Bracket-template instructions.** The frame note still said *"follow its template exactly: write
  the fixed wording as-is, and fill ONLY the dedicated [bracket] areas"* and *"CRITICAL — DROP THE
  BRACKETS"*, in a stack whose rule templates had stopped having brackets. The scene-type block
  directly above it now opens *"Nothing below is fixed wording to copy out"* — the two layers
  contradicted each other in the same request.
- **The wardrobe as a menu.** It described a three-step outfit authority ending in *"pick ONE outfit
  from the WARDROBE … the entry that suits the DRESSING CONTEXT"*, after v48.2 had made the outfit a
  decided fact and stopped sending the dressing context with it. The user message says *"already
  decided, not a list to choose from"* while this layer was still telling the model to choose.
- **A phantom rule.** The POV note overrode *"elsewhere in these instructions characters never look
  at the camera"* — an instruction that is in none of these layers. It was arguing with a rule that
  no longer exists.
- **A distance rule that fought the shot section.** *"The distance is conversational … her upper
  body and face carry the frame … nothing implies a tripod across the room"* contradicted the rule's
  own shot-selection section, which picks Close-up / Waist-up / Full-body / Wide from the actual
  distance. The POV layer owns **where the viewpoint is** (his head, its height, its angle); **how
  tight the frame is** belongs to the scene-type block, and it says so now.

The frame note also shipped with its newlines escaped (`\\n` in the template literal produced a
literal backslash-n), so the whole block arrived as one unbroken line with the characters `\n`
visible inside it.

All three are registry prompts now, editable in Settings → Payloads, and rewritten to say only what
is theirs to say: the frame note explains the continuity reference and the decided outfit — the two
blocks in the message that no rule template can know about — and defers to the scene-type block
where they disagree; the POV note owns the viewpoint and the reversed gaze and nothing else.

`tests/no-code-prompts.test.js` was widened to catch what let them hide: its patterns only matched
strings opening with *"You are…"*, and these opened with a markdown heading. It now also matches a
heading followed by an instruction, allows a prompt that is a registered `DEFAULT_*` constant, and
allows a shared constant **only while every one of its uses is a `${NAME}` expansion inside one**
(that is `CARD_VOICE_RULE`, whose text always ends up inside an editable default). The widened guard
immediately found one more: the Auto-RP narrator's spoken-input rule, built inline at the call site,
now the `narrateVerbatim` prompt.

## v140.1 — what the player wears

Characters have had an outfit table since v48.2 (`currentOutfit`: the scene's override, then the
activity the sub-area implies, their home by time of day, the player's house, the location, then the
free-text wardrobe). The player had an appearance line and nothing else, so a picture with the
player in it dressed them however the writer guessed, and the outfit changed from frame to frame.

- **Where it lives.** On the universe, beside the rest of the player's identity: `userOutfits`
  (`{byLoc, home, activity}`, the character's shape without `userHome`, since the player's house *is*
  their home) and `userWardrobe`, a free-text fallback. It is edited in the universe editor under
  *Your character in this universe › What you wear*. The table comes from the shared
  `_outfitTableHTML`, with its home rows following *Your home*. **Generate outfits / Rewrite all**
  run the character `x_outfits_generator` on the player's details, filling only the empty slots
  unless rewriting.
- **How it resolves.** `playerOutfitHolder(chat)` is a stand-in card (`id:"__user__"`,
  `isPlayer:true`), so `currentOutfit` works unchanged. The one difference is that for the player,
  "home" is `playerHomeLoc`.
- **The scene's say.** `runWearingTracker` includes the player once they have clothes on record, and
  a change is stored as `chat.wearing.__user__`. Like a character's override, it expires when the
  place or the hour changes.
- **The image writer.** `_imgPlayerWardrobeBlock` goes into the writer's request whenever the player
  is in the frame. That is the same test `buildRefPack` uses for the player's pictures: any cast but
  "just the speaker" or "nobody", and not a POV rule. With a labelled cast (edit models, two or more
  people) the block sits under the player's label (`FOR MAN 1 — Emre, the player:`). Otherwise it
  names them. A player with nothing on record adds nothing, so existing prompts are unchanged.

Test: `tests/player-outfits.browser.js`.

**v140.2 — and the character answering you is told.** The same current outfit now goes into the
reply payload. When the reply is aimed at the player, *Who you are responding to* carries
`target_wearing` after `target_look`. When it is aimed at someone else, the player's card carries
`player_wearing`. The outfit entries are written to the player ("You wear…"), so both fragments say
whose "you" it is. Texts never carry it, because nobody sees your clothes over a phone. Nothing on
record means neither fragment fires, and the block is exactly as before.
