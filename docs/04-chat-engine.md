# 04 · Chat Engine — from keypress to reply


## Heat of the moment — the reply IS beat 1 (v39.9)

`state.heatN` is the number of messages a turn produces, not the number of EXTRA ones. Heat used to
run entirely after a normal reply, so a turn was one standard-format reply plus `heatN` heat beats —
with `heatN=1`, two messages, the first of them not in heat form at all.

`heatBeginTurn(chat)` now stamps `chat._heatBeat={total,n:"1",narrN}` on the player-facing reply
before it is generated, and `heatEndTurn` clears it in the `finally` of every path that generates
one: the solo branch of `sendMessage`, the single-responder branch of `runMultiCharTurn`, and the
FIRST responder of a genuine multi-character turn (`_mcOpened`). `runHeatBursts` then writes beats
`2..N`.

`chat._heatOpened` records that beat 1 was claimed. Heat switched on *mid-turn* leaves it unset, and
the run correctly owns every beat from 1 — otherwise that turn would be one beat short.

Note the reply keeps its normal "⚠️ THIS IS WHO YOU ARE RESPONDING TO" headers: the heat
self-continuation wording (`heat_target_header` / `heat_target_self`, "nobody is waiting on an answer
from you") is gated on `selfContinueLine`, which is false when the player has just spoken.


## Turn lifecycle (typed input)

```
sendMessage()
 ├─ "/whisper Name msg"  → sendWhisper()          (private aside; only that character hears)
 ├─ "/…" OOC command     → handleOOC()            (never narrated, never enters payloads)
 ├─ _heatSeq++                                     (any player turn cancels a pending heat burst)
 ├─ Auto-RP on? → narratePlayerTurn(text)          (rewrite terse input into an in-voice turn;
 │                                                  input locked with "writing your turn…";
 │                                                  falls back to raw text on any failure)
 ├─ push user message {mid, role:user, content, present: presentIds(chat)}
 ├─ nobody present?      → postTurn(chat) only     (directors may bring someone; no reply)
 ├─ >1 present           → runMultiCharTurn(chat, text)
 └─ exactly 1 present    → solo flow:
      retrieveMemories() → buildPayload("solo", head, tail) → castHistory() (witness-scoped)
      → tagLastForTarget() → [head system] + history + [tail system] (+ GM director note)
      → chatCompletion(rp:true) → refusal check (not posted) → push assistant msg
      → autoVisualize (image) + autoSpeakMsg (TTS) + runVoiceCheck + runReplyCheck   (all background)
      → enqueuePresent (typewriter) → runPresenceTracker → maybeBuildMemory → postTurn → maybeHeatBursts
```

The final request for any reply path is always:
**`[system: payload head]` + `mapped chat history` + `[system: payload tail]`** (+ an optional
one-shot `[system: Director's note …]` when `chat.pendingGmNudge` is set — consumed and
cleared). Either system message is skipped when the user's payload layout emptied that side.

## OOC commands (`handleOOC`, never sent to any model)

| Command | Effect |
|---|---|
| `/bring Name` (`/call`, `/add`) | Narrated arrival; character becomes present |
| `/leave Name` (`/send`) | Narrated send-off; removed from scene & world position |
| `/remove Name` | **Soft-delete**: marks `removed` (dead). Card/memories/relationships kept, but the character is inert everywhere (no replies, routing, GM summons, gossip, intents). |
| `/revive Name` | Undo `/remove` |
| `/text Name: msg` / `/text Name` | Send a phone text / open the text window |
| `/who` | List who is nearby |
| `/whisper Name msg` | Private aside — only that character's payload sees the content |
| `/go`, `/messages`, `/close` + voice synonyms | Hands-free operator layer (`handsFreeCommand`) |

## Autopilot & suggested replies (v116.0)

Every director hangs off `postTurn`, which only runs after the player sends — so a quiet player used
to mean a frozen scene. Two additions keep it moving:

**Autopilot** — per chat (`chat.autoPlay`, toggled from Roleplay options like Do Not Disturb).
`apTick()` runs once a second. When the player has been quiet for `state.apDelay` seconds
(default 30, doubled when the last line put a spoken question to the player) and nothing is busy,
`apBeat()` plays one character turn through the ordinary `playCharacterTurn`, then
`runPresenceTracker` → `maybeBuildMemory` → `postTurn`, exactly like a player turn — so the
Gamemaster, due meetings and the world pulse get their chance too.

- **Who speaks** (`apPickNext`, code, no model): never the last speaker when anyone else is in
  earshot; among the rest, whoever has been quiet longest (the heat rule).
- **The note**: the turn gets `x_autopilot_beat` as its last system line ("take the beat yourself,
  never speak for {{user}}"), or `x_autopilot_silence` when the chosen speaker is the one whose
  question was left hanging. Both are registry prompts on the *Autopilot & suggested replies* card.
- **Holds** (`_apBlocked`): text in the input, a turn/heat/GM beat in flight, the typewriter
  queue, a voice still speaking, an open modal, a hidden tab, or another screen. The countdown only
  starts once everything is idle.
- **Cap**: `state.apCap` beats in a row (default 6), then it waits; the player sending anything
  (`apPlayerActed`) resets it. A failed beat also stops the run. A beat in flight when the player
  sends is dropped through `_dirSeq`, the same guard Gamemaster reactions use.
- Tapping the pill (or **Keep going**) plays one beat now, Autopilot on or off (`apContinueNow`).
- **The world comes to you (v117.1)** — `apWorldMove(chat, kind)`, a move that is not a line:
  - *Alone* (nobody in earshot), after twice the wait: `resolveDueMeetings` first (someone walks in,
    or the player is called away); else `maybeProactiveTextTick`; else, per `state.apAlone`,
    `runSceneCut` ("cut", the default — dropped into a conversation already running) or
    `maybeGamemaster(chat, true)` ("arrive" — somebody comes here; also the fallback when nobody is
    free for a cut). "off" leaves the player be, and so does Do Not Disturb.
  - *Stale*: after `AP_DIRECTOR_AFTER` (3) beats with no word from the player, the next move is the
    Gamemaster, forced once per quiet stretch (`chat._apDirected`), or `forceGamemaster` advancing
    an event that is already live. Kept out by Do Not Disturb, and by `gmOn` off unless an event is
    live. Otherwise the director keeps its own cadence through `postTurn`.
  - World moves spend the same `apCap` budget; a move that finds nothing to do ends the run.

**Suggested replies** — global (`state.suggestOn`, default on). When the scene settles on a line
that is not the player's, `fetchSuggestions` makes one call (`x_reply_suggest`: player profile,
scene line, last ten lines → `{options:[3]}`) on the player-narrator model, falling back to the
router model. The chips render in `#autoBar` above the composer and hide while the player types.
Tapping one sets `_apForceRp` and calls `sendMessage`, so the short intention always goes through
`narratePlayerTurn`, even with Auto-RP off.

**Suggested replies by mode (v149.2)** — the writer reads the moment, not the player's past.
- *The three styles* come from one mode prompt appended to `x_reply_suggest`, picked in code by
  `suggestMode(chat)` from who is in earshot. Gender is the card's tag (`woman`/`man`, also
  female/male, kadın/erkek…; `personSex`), else the look's subject line.
  | Who is in earshot | Prompt | Styles |
  |---|---|---|
  | one woman | `x_reply_suggest_woman` | FUNNY (no flirting) · FLIRT (reads her last response) · SINCERE (about her, no flirting) |
  | one man | `x_reply_suggest_man` | FRIENDLY (slang) · GOSSIP (drawing him out) · SEED (manipulative) |
  | two or more | `x_reply_suggest_group` | FUNNY · FLIRT (deniable, with a jab at her husband when he is here) · SWITCH (the target) |
  | one woman, intimate moment | `x_reply_suggest_heat` | SOFT · DOMINANT · DIRTY |
  | a minor here, or no tag | `x_reply_suggest_neutral` | FUNNY · CURIOUS · SINCERE; nothing flirtatious |
  The intimate moment is a live heat run (`_heatLive`) or the last four lines reading as intimate
  (`intimacyReads`), never with a minor in the scene. Only the picked prompt is sent. The group
  prompt is told who the women, the men and the couples are (`_couplesAmong`, from the cards' tie
  words; a private tie never counts).
- *The payload* (`x_reply_suggest`): the player's bio; the scene (`_sugSceneBlock`: day, part of the
  day, place, the player's area and its description, how private it is, who is in and out of
  earshot); each person here in full (`_sugPeopleBlock`: their tie to the player, public facts, the
  card's personality and background — never the card's private view of the player); who is who; at
  most three of the player's memories that involve somebody here, without open threads; the options
  offered recently (`chat._sugPrev`, transient); the last `SUG_LINES` (30) lines as the player lived
  them; and the player's own last line when it is among the last ten. No calendar, promises, quests
  or day ledger — Story mode still gets those through `_playerKnows`.
- *Directions, not lines (v149.3)*: each option is a 3–10 word direction ("Joke that she is running
  away from him"), never the words themselves, and each keeps strictly to its style — only FLIRT may
  flirt. Options come back as `{tone, text}`, `tone` being the style's NAME from the mode prompt
  (`_sugStylesOf` reads "1. FLIRT: …" lines); the chip shows it (`.sugTag`). An option that names no
  style gets none (plain strings still work). `sendSuggestion` hands `NAME: description` to
  `narratePlayerTurn` (`_apForceTone`), which adds `Tone: …` to the intention; the narrator prompt
  (DIRECTION, NOT THE WORDS) writes the actual line in that style, and MOVE IT FORWARD keeps it from
  repeating the player. The narrator reads up to 20 lines and three memories about the people here —
  no longer the words given.
- *An idea is spent (v149.4)*: a joke, reassurance, confession or compliment already used in this
  scene, or already offered, may not come back in other words — in the writer, in SINCERE (which asks
  about her instead of repeating the player's own confession) and in the narrator. The offered list
  (`chat._sugPrev`, the last nine) now comes last in the message, right before the ask, as
  ALREADY OFFERED, so a small model still has it in view after thirty long lines.
- *Short turns (v150.4)*: the narrator prompt's KEEP IT SHORT caps a turn at one short action beat and
  one or two spoken sentences, under 40 words, one paragraph — never a speech — and tells it not to copy
  the length of the player's earlier long turns in the recent lines. Only a longer turn the player typed
  may be longer, and never longer than what they typed.
- *This scene only (v149.3)*: both read `_playerSceneLines(…,{scene:true})`, which starts at the last
  travel beat or scene cut (`sceneCut`, now set on `runSceneCut`'s narration), or after the last day
  marker — the lines of the scene before a walk somewhere are not sent.

## Story mode (v118.1, experimental)

A separate per-chat switch (`chat.storyMode`, Roleplay options), exclusive with Autopilot. Where
Autopilot keeps the *other* characters moving, Story mode also plays the player's character and
stops only at turning points. It shares Autopilot's once-a-second tick and holds (`apTick` hands off
to `smTick`), and uses its own pace (`state.smDelay`, default 8 s) and pause limit (`state.smCap`,
default 20 moves without a word from the player).

- **Whose move** (`smNextKind`, code): a pending choice waits; a leave or an empty scene moves on;
  a line said to the player, a one-on-one line with no addressee, a narrator beat, or two character
  beats in a row → the player's move; otherwise a character answers through `playCharacterTurn`.
- **The player's move** (`smPlayerMove`): `x_story_player` returns `{intent}`, `{intent, leave}` or
  `{choice, question, options}`. An intent goes through `_smSend` → `sendMessage` with `_apForceRp`,
  so the Auto-RP narrator writes it and the ordinary reply pipeline answers it (`_smSending` keeps
  `apPlayerActed` from treating it as the player's own word). A choice is refused for
  `SM_CHOICE_GAP` (4) moves after the last one (`x_story_no_choice` tells the model; if it asks
  anyway its first option is played). After `SM_SCENE_WRAP` (24) lines in a scene,
  `x_story_wrap_up` tells it to close.
- **A choice** shows its question and options in `#autoBar`; tapping one (or *You decide*) sends it
  the same way. Typing your own turn answers it too.
- **Moving on** (`smMoveOn`): after a leave, the scene's people stay put, `advanceTime(chat,1)`, and
  `runSceneCut` drops the player into the next scene (Gamemaster arrival as the fallback). Alone
  without a leave, it only finds a scene. At Night it stops and offers End Day.
- All three prompts are on the *Story mode (experimental)* card.
- **What the player knows (v118.2)** — `_playerKnows(chat)` feeds both the move decider and the
  suggestion writer, so the player's character stays on track: where they were earlier today (read
  off companions' day-ledger rows, since the ledger keeps none for the player), their tie to each
  person in earshot (that person's card), memories of scenes the player was in (by `people`; no
  diaries, decisions or after-heat reckonings, nothing from another chat, one line per scene), their
  calendar, words given to or by them, and their quests. Private motives, offstage events, rumours
  and anyone's feelings are deliberately left out.
- **The player's own knowledge (v148.1)** — the player's character now has a memory and a picture
  of their people of their own, kept apart from the characters' (no character payload reads them):
  - `chat.playerMem` — written by `buildPlayerMemory` inside `commitMemoryArc`, one extra
    `x_player_memory` call per closed arc, from what the player saw and heard (`_playerHeardText`:
    the transcript minus characters' thoughts and app notices). First person, with `people`,
    `importance` and `open` threads; capped at 150; a re-committed span is not stored twice; a Retry
    takes back the memory cut from the discarded reply. `state.playerMemOn=false` turns it off.
  - `u.userTies {charId:{tie,view,day}}` and `u.userSocialGraphAuto` — the player's side of each
    tie and who is who, written by `updatePlayerSheet` (`x_player_sheet`, public facts plus shared
    history, never a character's secrets): once when someone first shares a scene with the player
    (`maybeSeedPlayerTies`, background) and at every day end for the people in that day's player
    memories (DAYEND stage `playerSheet`, last). `u.userSocialGraph` is the player's own text
    (universe editor) and is never overwritten. A universe reset clears the story's entries only.
  - `_playerKnows` now gives `people` from the player's entry (else only the card's tie WORD — the
    card's text is the character's private view of the player, in their voice), `social` (who is
    who: the player's words, the story's paragraph, else the cards' public tie words among the
    people here) and `memories` from `chat.playerMem` (the characters' memories only while a chat
    has none of the player's yet). The Auto-RP narrator gets one "Who they are to you" line.
  - The universe editor shows both lists (entries and memories can be forgotten one by one) and an
    *Update from the story* button.


## Auto-RP (player narrator)

`narratePlayerTurn` wraps the player's terse input using the `playerNarratePrompt` engine
prompt filled with `{{user}}`, `{{player_profile}}` (name/personality/style/bio/look — per-
universe overrides apply), `{{scene}}` (day/period/place/present), plus the genre-pack voice
tail and `langDirective()`. In narration-mic mode the player's spoken words are quoted
**verbatim** (`opts.verbatim`) — only narration is authored around them. Model:
`playerNarrateModel` → falls back to the roleplay model.

## Multi-character turns (`runMultiCharTurn`)

1. `runPresenceTracker` first (the player may have narrated arrivals/exits).
2. Cast = `inSceneCast(chat)` — only characters in the player's **sub-area (earshot)**.
   Empty ⇒ a narrator `presenceNote` explains who is elsewhere ("use Move to area").
3. **Router 1** (`routerPlayer` prompt, `mcModel`): given the roster (+ per-character hooks)
   and the player line → JSON `{addressed, responders[]}`. De-duped, capped at **2**
   responders; fallback = first present. Each responder plays a turn (`playCharacterTurn`).
4. **Router 2 chain** (`routerChar` prompt): after each line, asks whether another present
   character was clearly addressed/provoked → JSON `{continue, responder}`. Bounded by
   `mcChainCap`; each character speaks at most once per chain (`spokenThisChain`), with one
   optional self-defense rebound (`defendedThisChain`). Deliberately rare — most turns return
   to the player.
5. `maybeBuildMemory` → `postTurn` → `maybeHeatBursts`.

`playCharacterTurn(chat, p, addressed)` builds the **multi** payload for that one character:
memory retrieval scoped to them, target resolution from the *freshest real line in the
transcript* (not the router's stale `addressed`), witness-scoped history, refusal fallback,
`Name:` prefix stripping, and awaits the on-screen reveal so chains pace correctly.

## The emotion pick (v150.34)

Before each character reply (solo, multi, Gamemaster reaction, text), `emotionEnsure(chat, p, line)` asks the
Decisions API two typed questions in one request, started beside the memory search and awaited with it:
which **base emotion** the speaker is feeling (a choice over the editable list in Settings → Emotions — each
entry a name, a description the model reads, and three tones mild / clear / intense) and **how strongly**.
The state is the speaker's name and personality, this scene as they heard it (`_memJudgeScene`) and their
previous pick in this scene. The result is stored on `chat.emo[id]` `{emotion, intensity, tone}` (Anger +
intense → "furious") and exposed as the `emotion` / `intensity` / `tone` flags of the reply payload's
`{{if}}` conditions. The same moment is never asked twice; a failure keeps the last pick. Shipped list
(`EMOTIONS_DEFAULT`): Calm, Joy, Affection, Desire, Sadness, Anger, Fear, Disgust, Surprise, Shame, Guilt,
Jealousy, Pride. Prompts `x_emotion_pick`, `x_emotion_intensity` (Payloads → Emotion pick); model
`emoModel`. Pinned by `tests/emotion-pick.browser.js`. Since v150.37 the speaking style has a part
per emotion and the fragment model's choose-when conditions read it (docs/05, the fragment model).

**v150.35 — id or superego, in the same request.** A third question (`x_ego_pick`, a choice) asks who is
winning in this moment with the one they answer: `no_conflict`, `superego_firm`, `superego_ahead`, `torn`,
`id_ahead`, `id_winning`. So it does not default to conscience, the state carries the feelings toward that
person (`_emoFeelState`): the fast axes read as words (feelings right now), the slow axes (lasting
feelings), the tie from the relationship sheet and the settled view; and the prompt says not to lean on
conscience by default and that most moments have no conflict at all. The answer is `chat.emo[id].ego` and
the `ego` flag. **Layouts can use the flags now:** a payload template's own `{{if}} … {{else}} … {{endif}}`
is resolved with this reply's flags (render mode, emotion, intensity, tone, ego), e.g.
`{{if ego = id_winning or ego = id_ahead}}Your desire is winning over your conscience.{{endif}}`. A layout
with no `{{if}}` is unchanged (payload parity holds).

**v150.36 — what the feeling and the choice are made of.** The state also carries `earlier_today` (the
speaker's own latest memories of today, so a fight this morning colours the emotion now),
`people_they_answer_to` (spouse, partner, lover, family, read off their own ties whether or not those people
are here) and `who_else_can_see_or_hear` (or "nobody — they are alone with …"). The id/superego prompt weighs
the feelings against those stakes. (v150.42: `who_else_can_see_or_hear` also names the public at a place that is not
someone's home — "strangers and staff at <place> (<exposure>)" — instead of "alone with" on a beach club boardwalk.)

## v150.38 — the drives writer is gone; spoken limits are read in the reply's request

The drives writer (`psycheEnsure` → `_writePsyche`, prompt `psychePrompt`) wrote two passages per line
answered, "what pulls you toward it" and "what holds you back". It ran on the gamemaster model, about
fifteen seconds per reply, and made characters fixate on things that did not matter. It is removed, along
with its prompt, its migrations, and the `drive_header` / `drive_toward` / `drive_against` / `drive_ego` /
`drive_empty` fragments. The weighing now comes from the id / superego pick (v150.35) and, with the fragment
model, from the compass options chosen by it.

**Spoken limits** ("to that bench, no further") used to be extracted by that writer. They are now read
in the reply's own Decisions request (`emotionEnsure` → `limitAskQuestions` / `limitApplyAnswers`), before
the character's next reply. Questions:
- **Each of their own lines since the last read** (at most three, this scene, today) is one `choice`
  (`x_limit_read`). The options are: none, a limit, or a commitment, each for this scene, for today, or
  until they say otherwise.
- **Each limit on record** is one yes/no (`x_limit_release`): did they take it back themselves? This is
  asked only when they have said something new.

The state carries their new lines and the limits already on record, and the prompt counts a repeated one
as none. Both questions pass only at the strict gates' certainty (`gateAt`, 0.8). What is kept is the
line's spoken part (`_limitSpoken`). The read pointer moves only when the request answers; a failure files
nothing and the lines are read again next time. The request now also runs for a character with new lines
when the emotion pick is off.

Switch: Settings → Features → **Spoken limits** (`limitsOn`, on by default). Questions: Payloads → Strict
gates. Limits are stored, expire, and reach the reply and the analysers exactly as before (`limitsBlock`,
`limitsJudgeNote`). The `drives` payload piece is now just the limits, so a template that calls
`{{call//drives//full}}` still gets them. Pinned by `tests/spoken-limits.browser.js`, which replaces
`drives-brakes` and `drives-limits`.

## Refusal & empty-reply handling (both reply paths)

- `looksLikeRefusal()` catches canned refusals (CJK "无法…" patterns, English "I can't…", or a
  reply that is overwhelmingly CJK when the story language isn't).
- On refusal: **no automatic retry** (v148.7, at the player's request — a second call behind their
  back was sometimes worse than the first). The refusal text is never rendered; the turn leaves a
  notice with the Retry button, and asking again is the player's choice.
- **The reply check** (v150.30, `runReplyCheck`, on by default): after a character reply is posted
  (solo, multi-character and Gamemaster reactions), one Decisions-API request (doc 06/07) asks three
  yes/no questions about it — `refusal` (the AI declining in a way the regex missed), `player` (it
  writes the player's words, actions, thoughts or decisions) and `character` (out of character for
  the sheet). The state is the character's name, personality and speaking style, the player, the six
  lines before the reply as the character heard them (this scene only, v150.32), and the reply. Each question is one editable
  prompt (`x_reply_check_*`, Payloads → Reply check): the question, a `YES:` line and a `NO:` line,
  split into the noul question's instructions and criteria (`_decQuestionFrom`; no YES/NO lines →
  "Yes."/"No."). A probability at or above `replyCheckAt` (default 0.7) is stored on the message
  (`replyCheck`, `replyFlags`) and drawn as a pill on the bubble ("refusal?", "speaks for you", "out
  of character", with the percentage in its title). It only marks: the reply is never held back,
  changed or regenerated — Retry is the remedy. Failures leave the reply unmarked; a rejected key,
  refused model or three failures in a row pause it (`_replyCheckBreak`) without pausing the memory
  judge. Model: `replyCheckModel` → `openai/gpt-6-luna-decisions`. The older `runVoiceCheck` (a chat
  call with a written note, off by default) is unchanged. Pinned by `tests/reply-check.browser.js`.
- Separately, `chatCompletion` itself rescues *empty* responses (reasoning models burning the
  budget) with one automatic retry at ≥1600 tokens.

## Heat of the moment (`maybeHeatBursts` → `runHeatBursts`)

When `heatOn`: after the player's turn resolves, ONE extended continuation is generated —
worth ~`heatN` normal replies — voiced by the present character who has spoken longest ago.
Implementation: `chat._heatBeat` (transient) switches `playCharacterTurn` to the dedicated
**`heat` payload layout** — same blocks, but the heat format rules, heat response guidance and
heat guardrails fragments are swapped in, and when the speaker continues their *own* last line
the "responding to" blocks say so instead of naming a stale target (doc 05). Max-tokens gets a
headroom bump. Guards: single flight per chat (`chat._heatBusy`), once per tail message (`_heatRanMid`),
cancelled by any new player input (`_heatSeq`).

## Presence & witness scoping (why characters don't "hear" everything)

- Every message stores `present:[ids]` at creation — the witness list.
- `runPresenceTracker` runs only when `hasPresenceCue()` finds movement/greeting language
  (a large EN+TR cue list — a cheap pre-filter to avoid an LLM call per turn), then the
  `presencePrompt` engine returns `{exit, enter}`; `applyPresence` moves characters, writes a
  `presenceNote` (with `enteredIds`/`exitedIds`), and clears per-character image continuity.
- `castHistory(chat, p)` builds the transcript **as character p experienced it**:
  - Scene boundary: cut at the last `travelBeat` (a location change starts a fresh scene),
    with bridging so companions keep shared context.
  - Day window: only the last **2 game-days** of dialogue (older facts are memory's job).
  - Witness filter: a line with `present[]` not containing p is dropped (legacy name matching
    tolerated); untagged dialogue defaults to **excluded** (leak-safe).
  - **Private narration** (`narrPrivacy`, default on) — **rewritten in v30.5.** It used to strip
    other characters' `*narration*` via `spokenOnly()`, which removes actions AND thoughts, leaving
    only quoted dialogue. That is the wrong cut: the format contract defines `*asterisks*` as
    "Action / physical beats — a glance, a step, a touch", which is exactly what someone standing in
    the same room sees. Two characters in one kitchen each got a transcript in which the other one
    never moved, and a purely-narrated turn (she puts the glass down and walks out) vanished
    entirely. `perceivedOnly()` now strips only `_inner thoughts_`, which nobody can perceive.
    **You see what they did; you never hear what they thought.** `lastDialogueLine` uses the same
    rule, so a wordless exit is something the character can actually react to.
- `mapMsgToApi` converts messages to API form (assistant lines carry `name:`; narrator
  events/presence notes/day markers become Narrator lines).
- `compactHistory` then applies the cost controls: hard cap `histTurns` (default 20 **messages** —
  in a two-character scene that is six or seven exchanges), and optional narration-stripping of all
  but the last `stripKeepFull` messages. Narrator lines are exempt (they carry scene state) and,
  **since v30.5, so are the speaking character's own lines.**
  **(!) Why:** this pass runs AFTER `narrPrivacy`, which has already removed every other character's
  narration. The only narration still standing when it runs is (a) the character's own and (b) the
  player's — so the cost control was spending its entire budget on the two things nothing else in the
  payload can reconstruct. Losing your own physical beats is the worst case of the two: the model
  cannot see that it already gripped the counter or already looked away, so it does it again. That
  repetition is what the `already_said` block exists to paper over.

### Catching a repeat: three different measurements, because it fails three different ways

`repeatKind(a,b)` runs after every reply and returns which kind of repeat it is; each has its own
retry note, because a model told only "you repeated yourself" rewrites the half it got right.

| kind | test | trigger |
|---|---|---|
| `line` | `replySimilarity` — content-word overlap of the **spoken** halves (narration stripped) | ≥ 0.72 |
| `narration` | `narrationSimilarity` — the same, over the `*…*` spans only | ≥ 0.70 |
| `opening` | `openingEcho` — the first **five** content words of the first narration span, stemmed and matched **positionally** | ≥ 0.8 (4 of 5) |

**(!) The opening needed its own test.** Three turns of one live scene each began
`*Sırtım koltuğa iyice gömülürken…*` and then went somewhere different — and
`narrationSimilarity` scored those pairs at **0.37**, nowhere near its trigger, because it weighs
the whole span and the spans diverge after the shared run-up. A repeated opening is the most
*visible* repetition there is: it is the first thing on screen every time. Matching is positional
because a formula is a fixed order, not a bag of words — four of five in the same places is a
formula, three is a coincidence.

### The ratio worth watching

On a reference 35-message scene with two characters present, default settings: **instructions
~6,200 tokens, transcript ~1,260 tokens — the story is 17% of what the model reads.** A reply that
comes out mechanical is very often this number being low; the character is being briefed rather than
played. The Debug view prints the split under each payload (`_dbgMixLine`) and flags anything under
20%. The knobs are `histTurns` / `stripKeepFull` (more scene) and Settings → Payloads (less
instruction).

## Rendering pipeline

`renderChat()` full-renders the window; `appendNewBubbles()` appends deltas;
`refreshBubble(mid)` re-renders one bubble in place (used by image/video state changes —
remember `markChatDirty`). New assistant text flows through the presentation queue
(`enqueuePresent` → `typewriterReveal`), which is *display-only*: generation, persistence,
image and voice all fired before the reveal starts.

## Cross-effects to keep in mind

- Editing/deleting messages (`saveEditMessage`, `deleteMessage`) changes history that memory
  arcs may span — `memDoneIdx` is clamped defensively, but bulk deletions mid-arc can still
  shift arc boundaries.
- `present[]` is load-bearing for **three** systems: history scoping, memory building
  (`witnessedBy`), and bystander gists. Never fabricate or rewrite it.
- The solo path and multi path must stay **symmetric in block content** (payload coupling
  guard #2) — fix producers in both, or a solo-only fix will desync the multi payload.
- Phone texts (`textMsg`) deliberately carry `present:[]` so they never leak into scene
  history or scene memory; they have their own memory path (`rememberTextExchange`). Since
  v28.6 they are generated from the **same reply payload** as spoken turns (`text` layout
  key) — only the format rules differ.
- The solo and gm call sites go through `buildSystemPromptBlocks`, which is now just a wrapper
  that picks the single present character and delegates to `buildCharPromptBlocks` — every
  reply path shares one producer (doc 05).
