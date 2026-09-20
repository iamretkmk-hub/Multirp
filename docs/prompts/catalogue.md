# The prompt catalogue

Every prompt StoryMind sends: what it is for, when it fires, what it is handed, and what it must
return. Generated from the source, so it is complete rather than remembered.

**Read `README.md` in this folder first.** It explains the machinery these entries refer to — the
registry, placeholders and their scopes, engine sections, the model buckets, the language
directives and the refresh pipes. Most ways of breaking a prompt here are ways of breaking one of
those, and they are not visible from the prompt text alone.

Each entry gives:

- **Fires** — the label this call carries in the in-app Debug log, which is how you find it in a
  trace.
- **Runs on** — the model expression and the *bucket* whose creativity/token/thinking settings it
  reads (README § Model buckets). `fnTemp("gm",0.7)` reads the Gamemaster card, defaulting to 0.7.
- **Placeholders** — `{{name}}` slots. **declared** is what the shipped default uses; **supplied**
  is what the call site fills. A name declared but not supplied reaches the model as the literal
  text `{{name}}`; a name supplied but not declared is simply unused. The two lists should match,
  and an entry flags it when they do not.
- **Sections** — the labelled blocks of the user message. The app fills each one; a section that
  comes back empty is dropped together with its label, so a prompt must read correctly with any
  subset of them missing.
- **Returns** — the top-level keys of the JSON contract, or *prose*.

⚠️ **A prompt is data, not code.** Everything here is editable in Settings → Payloads. The engine
reads the keys named under **Returns** and ignores the rest, so renaming one silently disables the
feature it drives. The **Sections** and **Placeholders** are the contract with the app; the prose
around them is yours.


---

## Reply fragments — assembled into the character's payload, never sent alone

### `baseInstruction` — Global Base Instruction

Applied to every character before their individual details. Supports {{char}}, {{self}}, {{user}} and {{target}}.

| | |
|---|---|
| **Runs on** | not its own call — this text is assembled into another payload |
| **Returns** | prose |
| **Size** | 3577 characters |

### `formatRules` — Response Format Rules

How replies are written: *narration*, _thoughts_, "dialogue". Supports {{char}}, {{self}}, {{user}} and {{target}}.

| | |
|---|---|
| **Runs on** | not its own call — this text is assembled into another payload |
| **Returns** | prose |
| **Size** | 1508 characters |


---

## Speaking — a character producing words

### `x_arrival_line` — Arrival — the character's first line

What the character waiting there says as you walk in. {{sheet}} is their own character sheet, {{extra}} their feelings and memories, {{about}} what you came about, {{also}} who else is present.

| | |
|---|---|
| **Fires** | logged as `Arrival line —` |
| **Runs on** | `rpModel()` · bucket `rp` · temp `fnTemp("rp",0.85)` · max `fnTok("rp",320)` |
| **Placeholders** | declared: `{{about}}`, `{{also}}`, `{{char}}`, `{{extra}}`, `{{lang}}`, `{{place}}`, `{{sheet}}`, `{{user}}`<br>supplied: `about`, `also`, `char`, `extra`, `ho`, `lang`, `name`, `place`, `self`, `sheet`, `this`, `user`, `you`<br>supplied but unused by the default: `ho`, `name`, `self`, `this`, `you` |
| **Sections** | `ask` |
| **Returns** | prose |
| **Size** | 413 characters |

### `textProactivePrompt` — Proactive text judge

Decides whether a character texts the player unprompted (and what), from their feelings + memories + events. Returns {text, message, why}. Use {{user}}, {{char}}.

| | |
|---|---|
| **Runs on** | not its own call — this text is assembled into another payload |
| **Placeholders** | declared: `{{user}}`<br>supplied: `char`, `user`<br>supplied but unused by the default: `char` |
| **Returns** | `text`, `message`, `why` |
| **Size** | 1727 characters |

### `playerNarratePrompt` — Auto-RP player narrator

Rewrites the player's terse input into a short, in-voice player turn. Use {{user}}, {{player_profile}}, {{scene}}.

| | |
|---|---|
| **Fires** | logged as `Auto-RP player narrator` |
| **Runs on** | `model` · bucket `narrate` · temp `fnTemp("narrate",0.6)` · max `fnTok("narrate",200)` |
| **Placeholders** | declared: `{{player_profile}}`, `{{scene}}`, `{{user}}`<br>supplied: `player_profile`, `scene`, `user` |
| **Sections** | `recent`, `typed` |
| **Returns** | prose |
| **Size** | 2693 characters |

### `narrateVerbatim` — Auto-RP narrator · spoken input

Appended to the Auto-RP narrator ONLY when the turn was dictated rather than typed: the player's spoken words must survive word-for-word as the quoted dialogue, with only the narration around them authored.

| | |
|---|---|
| **Runs on** | not its own call — this text is assembled into another payload |
| **Returns** | prose |
| **Size** | 322 characters |

### `voiceCheckPrompt` — Voice consistency

Flags out-of-character replies. Returns {ok, note}.

| | |
|---|---|
| **Fires** | logged as `Voice check ·` |
| **Runs on** | `state.mcModel` · bucket `mc` · temp `fnTemp("mc",0)` · max `fnTok("mc",60)` |
| **Sections** | `profile`, `line` |
| **Returns** | `ok`, `note` |
| **Size** | 825 characters |

### `x_call_fallback` — Voice call — fallback persona

Used only when a call starts without a character's own prompt built yet.

| | |
|---|---|
| **Runs on** | not its own call — this text is assembled into another payload |
| **Returns** | prose |
| **Size** | 72 characters |


---

## Memory — writing it, judging it, condensing it, retrieving it

### `memEval` — Memory arc tracker

Runs after each turn (background, on the character-router model) to decide when a memorable arc starts/continues/pauses/ends. Boundary detection only — importance is judged by the builder. Use {{open_event}}, {{exchange}}.

| | |
|---|---|
| **Fires** | logged as `Memory arc tracker (text) ·` |
| **Runs on** | `state.mcModel||state.model` · bucket `mc` · temp `fnTemp("mc",0.1)` · max `fnTok("mc",120)` |
| **Placeholders** | declared: `{{exchange}}`, `{{open_event}}`<br>supplied: `open_event`<br>⚠️ declared but never supplied: `{{exchange}}` |
| **Sections** | `ask` |
| **Returns** | `progress`, `topic`, `summary` |
| **Size** | 4702 characters |

### `memBuild` — Memory builder

Produces a structured JSON memory from a complete arc (content, people, emotion, feelings, details). Scores importance on the whole arc. Use {{char}} and {{user}}.

| | |
|---|---|
| **Fires** | logged as `Memory (text) ·` |
| **Runs on** | `state.memModel` · bucket `mem` · temp `fnTemp("mem",0.3)` · max `fnTok("mem",480)` |
| **Placeholders** | declared: `{{char}}`, `{{user}}`<br>supplied: `char`, `user` |
| **Sections** | `convo`, `data` |
| **Returns** | `content`, `location`, `people`, `emotion`, `feelings`, `importance_score`, `tags`, `type` |
| **Size** | 5225 characters |

### `gistBuild` — Bystander gist (perception)

A bystander's fuzzy outside impression when present but not in the conversation. Use {{char}}, {{user}}.

| | |
|---|---|
| **Runs on** | not its own call — this text is assembled into another payload |
| **Placeholders** | declared: `{{char}}`, `{{user}}`<br>supplied: `char`, `user` |
| **Returns** | `content`, `location`, `emotion`, `gist`, `charge`, `importance_score`, `tags` |
| **Size** | 2789 characters |

### `memReconcile` — Memory reconciler (end of each part of the day)

When a part of the day ends (morning to midday, and so on), the several memories written during it are read together and rewritten as the one thing the character would actually keep — or a few, if they cover unrelated topics. Runs per character, in the background, and never on a day roll (the diary covers that).

| | |
|---|---|
| **Fires** | logged as `Memory reconcile ·` |
| **Runs on** | `state.memModel` · bucket `mem` · temp `fnTemp("mem",0.3)` · max `fnTok("mem",700)` |
| **Sections** | `data` |
| **Returns** | `memories`, `content`, `importance_score`, `emotion`, `feelings`, `type`, `people`, `tags`, `location`, `supersedes` |
| **Size** | 4830 characters |

### `condensePrompt` — Memory condenser

Merges old low-importance memories. Use {{char}} and {{user}}.

| | |
|---|---|
| **Fires** | logged as `Long-term condense ·` |
| **Runs on** | `state.memModel` · bucket `mem` · temp `fnTemp("mem",0.3)` · max `fnTok("mem",500)` |
| **Placeholders** | declared: `{{char}}`<br>supplied: `char`, `user`<br>supplied but unused by the default: `user` |
| **Sections** | `ask`, `list` |
| **Returns** | `content`, `location`, `emotion`, `importance_score`, `tags`, `type` |
| **Size** | 1054 characters |

### `queryGen` — Memory query generator

Turns the current moment into a search query.

| | |
|---|---|
| **Fires** | logged as `Memory query generator` |
| **Runs on** | `state.mcModel||state.memModel||state.model` · bucket `mc` · temp `fnTemp("mc",0.3)` · max `fnTok("mc",120)` |
| **Returns** | prose |
| **Size** | 450 characters |

### `daySummaryPrompt` — End-of-day diary

Each character writes a private diary entry at day's end. Use {{char}}, {{user}}.

| | |
|---|---|
| **Fires** | logged as `Diary ·` |
| **Runs on** | `state.memModel` · bucket `mem` · temp `fnTemp("mem",0.5)` · max `Math.max(fnTok("mem",500),900)` |
| **Placeholders** | declared: `{{char}}`<br>supplied: `char`, `user`<br>supplied but unused by the default: `user` |
| **Sections** | `ask`, `memories` |
| **Returns** | prose |
| **Size** | 2052 characters |

### `x_membuild_text_note` — Memory builder — the phone-thread note

Added to the memory builder when the thing being remembered is a text conversation rather than a scene, so it is recorded as texting rather than as words spoken in a room.

| | |
|---|---|
| **Runs on** | not its own call — this text is assembled into another payload |
| **Placeholders** | declared: `{{char}}`, `{{user}}`<br>supplied: `char`, `user` |
| **Returns** | prose |
| **Size** | 169 characters |

### `x_scene_recap` — Scene recap (“Previously…”)

The one-line banner shown when you come back to a chat after a while.

| | |
|---|---|
| **Fires** | logged as `Scene recap` |
| **Runs on** | `state.memModel` · bucket `mem` · temp `fnTemp("mem",0.5)` · max `fnTok("mem",80)` |
| **Sections** | `convo`, `ask` |
| **Returns** | prose |
| **Size** | 201 characters |


---

## Relationships and the emotional loop

### `relShortPrompt` — Short-term feelings

Frequent: reads fast in-the-moment axes (desire, comfort, fear, agitation). Returns JSON deltas.

| | |
|---|---|
| **Runs on** | not its own call — this text is assembled into another payload |
| **Returns** | `desire`, `comfort`, `fear`, `agitation`, `note` |
| **Size** | 5282 characters |

### `relPrompt` — Relationship tracker (long-term)

End-of-day: evaluates the slow axes (trust, affection, respect) over the whole day. Returns JSON deltas.

| | |
|---|---|
| **Fires** | logged as `Daily relationship ·` |
| **Runs on** | `state.memModel` · bucket `mem` · temp `fnTemp("mem",0.2)` · max `fnTok("mem",340)` |
| **Sections** | `data` |
| **Returns** | `trust`, `affection`, `respect`, `familiarity`, `jealousy`, `desire`, `comfort`, `fear`, `agitation`, `description` |
| **Size** | 12402 characters |

### `relGenPrompt` — Relationship generator

Writes a character's factual ties (kinship, address, cohabitation, standing) to everyone. Use {{char}}, {{user}}.

| | |
|---|---|
| **Fires** | logged as `Relationship generator ·` |
| **Runs on** | `authoringModel()` · bucket `unigen` · temp `fnTemp("unigen",0.5)` · max `fnTok("unigen",1100)` |
| **Placeholders** | declared: `{{char}}`, `{{user}}`<br>supplied: `char`, `user` |
| **Sections** | `data` |
| **Returns** | prose |
| **Size** | 3571 characters |

### `socialGraphPrompt` — Social graph (the summary line)

Writes the ONE paragraph at the top of a character's relationships block \u2014 their map of the people in their life, in the second person. Compressed from what already exists: their structured ties first, then what play has discovered, then the world and who lives where. Only `batchBioPrompt` ever wrote this field, so characters made singly or by the universe generator had none \u2014 and without it the relationships block cannot run at `present` scope. Use {{char}}, {{user}}.

| | |
|---|---|
| **Fires** | logged as `Social graph ·` |
| **Runs on** | `authoringModel()` · bucket `unigen` · temp `fnTemp("unigen",0.4)` · max `fnTok("unigen",420)` |
| **Placeholders** | declared: `{{char}}`, `{{user}}`<br>supplied: `char`, `user` |
| **Returns** | prose |
| **Size** | 1840 characters |

### `psychePrompt` — Drives & brakes (id / superego writer)

Reads the private relationship numbers, the character's ties, their vows, the trackers and where they are, and writes TWO prose passages for the reply payload: what pushes them toward what they want, and what holds them back. Use {{self}} for whose drives these are and {{target}} for who they are with — naming the subject is what keeps the two passages from drifting onto the other person. Written in neutral third person about {{self}}. The numbers never reach the story payload — only the prose does. It never decides the outcome; the character does.

| | |
|---|---|
| **Fires** | logged as `Drives & brakes (id / superego)` |
| **Runs on** | `state.gmModel||state.rewriter` · bucket `gm` · temp `fnTemp("gm",0.7)` · max `fnTok("gm",400)` |
| **Placeholders** | declared: `{{self}}`, `{{target}}`<br>supplied: `self`, `target`, `user`<br>supplied but unused by the default: `user` |
| **Sections** | `character`, `personality`, `goals`, `backstory`, `with`, `ties`, `settled`, `promises`, `trackers`, `done`, `scene`, `exchange`, `axes` |
| **Returns** | `toward`, `against` |
| **Size** | 5243 characters |

### `afterHeatPrompt` — After it is over

Runs once when heat goes off: what the character DECIDES afterwards, and what she will do differently. Use {{char}}, {{other}}, {{user}}.

| | |
|---|---|
| **Fires** | logged as `After it is over ·` |
| **Runs on** | `state.memModel` · bucket `mem` · temp `fnTemp("mem",0.6)` · max `Math.max(fnTok("mem",300),420)` |
| **Placeholders** | declared: `{{char}}`, `{{other}}`<br>supplied: `char`, `other`, `user`<br>supplied but unused by the default: `user` |
| **Sections** | `ask`, `your_bio`, `scenario`, `relationships`, `feelings`, `feelings_now`, `distant_memories`, `recent_memories`, `scene_now`, `trackers`, `promises`, `private_intent`, `drives`, `scene` |
| **Returns** | prose |
| **Size** | 1830 characters |


---

## The Gamemaster and live scenes

### `gmJudge` — Gamemaster staleness judge

Returns JSON {stale, reason, energy}. Use {{user}}, {{sensitivity}}.

| | |
|---|---|
| **Fires** | logged as `Gamemaster: judge` |
| **Runs on** | `state.gmModel` · bucket `gm` · temp `fnTemp("gm",0.2)` · max `fnTok("gm",120)` |
| **Placeholders** | declared: `{{sensitivity}}`, `{{user}}`<br>supplied: `sensitivity`, `user` |
| **Sections** | `scene`, `memories`, `director_log`, `exchange`, `staging`, `world` |
| **Returns** | `stale`, `trigger`, `reason`, `energy`, `trigger_context` |
| **Size** | 5110 characters |

### `gmAuthor` — Gamemaster event author

Writes the hidden nudge. Use {{user}} and {{reason}}.

| | |
|---|---|
| **Fires** | logged as `Gamemaster: event` |
| **Runs on** | `state.gmModel` · bucket `gm` · temp `fnTemp("gm",0.9)` · max `fnTok("gm",160)` |
| **Placeholders** | declared: `{{energy}}`, `{{reason}}`, `{{trigger_context}}`, `{{user}}`<br>supplied: `energy`, `trigger_context`, `user`<br>⚠️ declared but never supplied: `{{reason}}` |
| **Sections** | `scene`, `cast`, `memories`, `director_log`, `world`, `exchange`, `staging` |
| **Returns** | prose |
| **Size** | 5344 characters |

### `sceneSetup` — Scene Writer setup

Classifies a new event. Returns JSON.

| | |
|---|---|
| **Fires** | logged as `Scene writer: setup` |
| **Runs on** | `state.gmModel` · bucket `gm` · temp `fnTemp("gm",0.4)` · max `fnTok("gm",200)` |
| **Sections** | `scene`, `memories`, `cast`, `event` |
| **Returns** | `type`, `summary`, `want`, `stake`, `escalation`, `participant`, `name`, `known`, `approaching`, `persona`, `look` |
| **Size** | 3787 characters |

### `sceneWriter` — Scene Writer advance

Returns JSON. Use {{user}}, {{summary}}, {{turn}}, {{min}}, {{max}}, {{type}} (the classifier's event type: character / environment / offstage).

| | |
|---|---|
| **Fires** | logged as `Scene writer: advance` |
| **Runs on** | `state.gmModel` · bucket `gm` · temp `fnTemp("gm",0.7)` · max `fnTok("gm",200)` |
| **Placeholders** | declared: `{{max}}`, `{{min}}`, `{{summary}}`, `{{turn}}`, `{{type}}`, `{{user}}`<br>supplied: `max`, `min`, `summary`, `turn`, `type`, `user` |
| **Returns** | `narration`, `bring_in`, `resolved`, `resolution` |
| **Size** | 9505 characters |

### `sceneLangRetry` — Scene writer · language retry

Sent back to the Scene Writer when its narration came out carrying an English word inside the story language. Fires at most once per beat. Use {{words}} — the words that were caught.

| | |
|---|---|
| **Fires** | logged as `Scene writer: advance (language retry)` |
| **Runs on** | `state.gmModel` · bucket `gm` · temp `fnTemp("gm",0.7)` · max `fnTok("gm",200)` |
| **Placeholders** | declared: `{{words}}`<br>supplied: `words` |
| **Returns** | prose |
| **Size** | 236 characters |

### `confrontJudge` — Confrontation judge (referee)

Unbiased referee: scores the player's last turn in a confrontation → conviction delta. Use {{user}}, {{accuser}}, {{intent}}, {{evidence}}, {{accuser_nature}}, {{conviction}}, {{floor}}, {{ceiling}}, {{player_turn}}.

| | |
|---|---|
| **Fires** | logged as `Confrontation judge` |
| **Runs on** | `state.gmModel` · bucket `gm` · temp `fnTemp("gm",0.1)` · max `fnTok("gm",120)` |
| **Placeholders** | declared: `{{accuser}}`, `{{accuser_nature}}`, `{{ceiling}}`, `{{conviction}}`, `{{evidence}}`, `{{floor}}`, `{{intent}}`, `{{player_turn}}`, `{{user}}`<br>supplied: `accuser_nature`, `ceiling`, `conviction`, `evidence`, `floor`, `intent`, `player_turn`, `user`<br>⚠️ declared but never supplied: `{{accuser}}` |
| **Sections** | `ask` |
| **Returns** | `delta`, `reason`, `player_lied_or_evaded` |
| **Size** | 2262 characters |

### `overtureJudge` — Overture judge (warm referee)

Warm mirror of the confrontation judge: scores whether the player was receptive to or rebuffed a warm overture (courtship, reconciliation, loyalty, alliance, protection). Same fields as the confrontation judge.

| | |
|---|---|
| **Fires** | logged as `Overture judge` |
| **Runs on** | `state.gmModel` · bucket `gm` · temp `fnTemp("gm",0.1)` · max `fnTok("gm",120)` |
| **Placeholders** | declared: `{{accuser}}`, `{{accuser_nature}}`, `{{ceiling}}`, `{{conviction}}`, `{{evidence}}`, `{{floor}}`, `{{intent}}`, `{{player_turn}}`, `{{user}}`<br>supplied: `accuser`, `accuser_nature`, `ceiling`, `conviction`, `evidence`, `floor`, `intent`, `player_turn`, `user` |
| **Sections** | `ask` |
| **Returns** | `delta`, `reason`, `player_warm_or_cold` |
| **Size** | 2461 characters |

### `charMovePrompt` — Character move narration

Short beat when a CHARACTER enters, leaves, or crosses to another area — where from, where to, and why. Shorter than the player's travel narration. Use {{user}}.

| | |
|---|---|
| **Fires** | logged as `Character move ·` |
| **Runs on** | `state.gmModel` · bucket `gm` · temp `fnTemp("gm",0.7)` · max `fnTok("gm",120)` |
| **Placeholders** | declared: `{{user}}`<br>supplied: `user` |
| **Sections** | `data`, `ask` |
| **Returns** | prose |
| **Size** | 2450 characters |

### `presencePrompt` — Presence tracker

Detects entrances/exits. Returns JSON {exit, enter}. Use {{user}}.

| | |
|---|---|
| **Fires** | logged as `Presence tracker` |
| **Runs on** | `state.mcModel` · bucket `mc` · temp `fnTemp("mc",0)` · max `fnTok("mc",110)` |
| **Placeholders** | declared: `{{user}}`<br>supplied: `user` |
| **Sections** | `roster`, `exchange` |
| **Returns** | `exit`, `enter`, `move` |
| **Size** | 2917 characters |

### `routerPlayer` — Multi-char router 1 (player)

Returns JSON {addressed, responders}. Use {{user}}.

| | |
|---|---|
| **Fires** | logged as `Turn router · player` |
| **Runs on** | `state.mcModel` · bucket `mc` · temp `fnTemp("mc",0.1)` · max `fnTok("mc",120)` |
| **Placeholders** | declared: `{{user}}`<br>supplied: `user` |
| **Sections** | `roster`, `stimulus`, `exchange` |
| **Returns** | `addressed`, `responders` |
| **Size** | 1647 characters |

### `routerChar` — Multi-char router 2 (character)

Returns JSON {continue, responder, addressed}. Use {{user}}, {{speaker}}.

| | |
|---|---|
| **Fires** | logged as `Turn router · character` |
| **Runs on** | `state.mcModel` · bucket `mc` · temp `fnTemp("mc",0.1)` · max `fnTok("mc",80)` |
| **Placeholders** | declared: `{{hooks}}`, `{{last_line}}`, `{{present_characters}}`, `{{speaker}}`, `{{user}}`<br>supplied: `hooks`, `last_line`, `name`, `present_characters`, `speaker`, `user`<br>supplied but unused by the default: `name` |
| **Sections** | `data` |
| **Returns** | `continue`, `responder`, `addressed` |
| **Size** | 8699 characters |


---

## The living world — what happens while the player is elsewhere

### `offstageEvent` — Offstage interaction (world pulse)

Judges whether two co-located OFFSTAGE characters interact right now (charged or casual) and, if so, writes the event — optionally moving both to a chosen venue, where the engine physically places them. Placeholders: a, b, a_sheet, b_sheet, a_to_b, b_to_a, a_wants, b_wants, a_knows, b_knows, place, places, day, period, user, world. Returns JSON {happened, kind, headline, event, venue, memories[], rel[], severity}.

| | |
|---|---|
| **Fires** | logged as `World pulse (offstage interaction)` |
| **Runs on** | `state.memModel` · bucket `mem` · temp `fnTemp("mem",0.7)` · max `fnTok("mem",900)` |
| **Placeholders** | declared: `{{a}}`, `{{a_knows}}`, `{{a_sheet}}`, `{{a_to_b}}`, `{{a_wants}}`, `{{b}}`, `{{b_knows}}`, `{{b_sheet}}`, `{{b_to_a}}`, `{{b_wants}}`, `{{day}}`, `{{period}}`, `{{place}}`, `{{places}}`, `{{user}}`, `{{world}}`<br>supplied: `a`, `a_knows`, `a_sheet`, `a_to_b`, `a_wants`, `b`, `b_knows`, `b_sheet`, `b_to_a`, `b_wants`, `day`, `period`, `places`, `user`, `world`<br>⚠️ declared but never supplied: `{{place}}` |
| **Sections** | `promises`, `ask` |
| **Returns** | `happened`, `kind`, `headline`, `event`, `venue`, `memories`, `name`, `content`, `emotion`, `importance`, `rel`, `from`, `to`, `trust` |
| **Size** | 3869 characters |

### `calExec` — Calendar executor (user-less plans)

Resolves a due calendar plan that does NOT include the player — a char↔char meeting or a solo errand: what happened, how it ended. Receives the plan's ORIGIN (why/by whom it was made) as the premise, so the event continues the story that created it. Placeholders: title, who, origin, place, day, period, sheets, ties, knows, user, world. Returns JSON {headline, event, memories[], rel[], followup|null}.

| | |
|---|---|
| **Fires** | logged as `World pulse (calendar executor)` |
| **Runs on** | `state.memModel` · bucket `mem` · temp `fnTemp("mem",0.7)` · max `fnTok("mem",1000)` |
| **Placeholders** | declared: `{{day}}`, `{{knows}}`, `{{origin}}`, `{{period}}`, `{{place}}`, `{{sheets}}`, `{{ties}}`, `{{title}}`, `{{user}}`, `{{who}}`, `{{world}}`<br>supplied: `day`, `period`, `place`, `sheets`, `ties`, `title`, `user`, `who`, `world`<br>⚠️ declared but never supplied: `{{knows}}`, `{{origin}}` |
| **Sections** | `promises`, `ask` |
| **Returns** | `headline`, `event`, `memories`, `name`, `content`, `emotion`, `importance`, `rel`, `from`, `to`, `trust`, `affection`, `respect`, `fear` |
| **Size** | 2487 characters |

### `goalPursuit` — Goal pursuit (offstage ambition)

Decides a character's NEXT MOVE from personality + goals + brewing motives + memories + current standings, and returns it as a PLAN (solo or with one other character) that lands on the calendar and is executed offstage when due. Placeholders: char, personality, goals, intents, recent, cast, ties, planned, place, places, day, period, user, world. Returns JSON {acted, plan{title, detail, with, where, day, period}}.

| | |
|---|---|
| **Fires** | logged as `World pulse (goal pursuit) ·` |
| **Runs on** | `state.memModel` · bucket `mem` · temp `fnTemp("mem",0.7)` · max `fnTok("mem",900)` |
| **Placeholders** | declared: `{{cast}}`, `{{char}}`, `{{day}}`, `{{goals}}`, `{{intents}}`, `{{period}}`, `{{personality}}`, `{{place}}`, `{{places}}`, `{{planned}}`, `{{recent}}`, `{{ties}}`, `{{user}}`, `{{world}}`<br>supplied: `cast`, `char`, `day`, `goals`, `intents`, `period`, `personality`, `place`, `places`, `planned`, `ties`, `user`, `world`<br>⚠️ declared but never supplied: `{{recent}}` |
| **Sections** | `promises`, `ask` |
| **Returns** | `acted`, `plan`, `title`, `detail`, `with`, `where`, `day`, `period` |
| **Size** | 2978 characters |

### `intentForm` — Intent formation (offstage agency)

At End Day, decides if a character now privately wants something — warm (courtship/loyalty/protection) or hostile (grievance/rivalry/scheme) — reasoning from how the relationship moved. Returns valence. Use {{char}}, {{nature}}, {{goals}}, {{day_memories}}, {{relationships}}, {{roster}}, {{open_intents}} (what this character already carries, live and already acted on), {{user}}.

| | |
|---|---|
| **Fires** | logged as `Intent form ·` |
| **Runs on** | `model` · bucket `mem` · temp `fnTemp("mem",0.5)` · max `fnTok("mem",250)` |
| **Placeholders** | declared: `{{char}}`, `{{day_memories}}`, `{{goals}}`, `{{nature}}`, `{{relationships}}`, `{{roster}}`, `{{user}}`<br>supplied: `char`, `day_memories`, `goals`, `nature`, `open_intents`, `relationships`, `roster`, `user`<br>supplied but unused by the default: `open_intents` |
| **Sections** | `data` |
| **Returns** | `intents`, `kind`, `valence`, `target`, `trigger`, `aim`, `strength` |
| **Size** | 4472 characters |

### `intentTick` — Intent tick (fester & recruit)

Each End Day, develops a live intent: hardens/fades, recruits allies, signals readiness. Use {{holder}}, {{nature}}, {{kind}}, {{target}}, {{aim}}, {{trigger}}, {{strength}}, {{allies}}, {{candidates}}.

| | |
|---|---|
| **Fires** | logged as `Intent tick ·` |
| **Runs on** | `model` · bucket `mem` · temp `fnTemp("mem",0.5)` · max `fnTok("mem",200)` |
| **Placeholders** | declared: `{{aim}}`, `{{allies}}`, `{{candidates}}`, `{{holder}}`, `{{kind}}`, `{{nature}}`, `{{strength}}`, `{{target}}`, `{{trigger}}`<br>supplied: `aim`, `allies`, `candidates`, `holder`, `kind`, `nature`, `strength`, `target`, `trigger` |
| **Sections** | `data` |
| **Returns** | `strength_delta`, `recruit`, `ready`, `note` |
| **Size** | 1231 characters |

### `contemplate` — Contemplation (strategy planner)

When a motive is ready to act on, the holder chooses HOW (direct, public spectacle, proxy, undermine first, ambush, leverage) — genre-blind, warm or hostile. Returns a method + approach + gate. Use {{holder}}, {{nature}}, {{kind}}, {{valence}}, {{target}}, {{aim}}, {{trigger}}, {{strength}}, {{allies}}, {{leverage}}, {{world}}.

| | |
|---|---|
| **Fires** | logged as `Contemplate ·` |
| **Runs on** | `model` · bucket `mem` · temp `fnTemp("mem",0.6)` · max `fnTok("mem",300)` |
| **Placeholders** | declared: `{{aim}}`, `{{allies}}`, `{{holder}}`, `{{kind}}`, `{{leverage}}`, `{{nature}}`, `{{strength}}`, `{{target}}`, `{{trigger}}`, `{{valence}}`, `{{world}}`<br>supplied: `aim`, `by`, `holder`, `kind`, `nature`, `strength`, `target`, `trigger`, `valence`<br>⚠️ declared but never supplied: `{{allies}}`, `{{leverage}}`, `{{world}}`<br>supplied but unused by the default: `by` |
| **Sections** | `data` |
| **Returns** | `method`, `approach`, `gate`, `patience`, `params`, `proxy`, `leverage`, `venue` |
| **Size** | 3424 characters |

### `gossipPrompt` — Gossip propagation (Living Universe)

At End Day, decides who tells whom about charged things bystanders saw. Use {{user}}, {{witness}}, {{impression}}, {{charge}}, {{location}}, {{witness_ties}}, {{candidates}}.

| | |
|---|---|
| **Fires** | logged as `Gossip ·` |
| **Runs on** | `model` · bucket `mem` · temp `fnTemp("mem",0.6)` · max `fnTok("mem",400)` |
| **Placeholders** | declared: `{{candidates}}`, `{{charge}}`, `{{impression}}`, `{{location}}`, `{{user}}`, `{{witness}}`, `{{witness_ties}}`<br>supplied: `candidates`, `charge`, `impression`, `location`, `user`, `witness`, `witness_ties` |
| **Sections** | `ask` |
| **Returns** | `spread`, `teller`, `recipient`, `motive`, `rumor`, `stakeholder`, `about`, `suspicion_strength` |
| **Size** | 2815 characters |

### `poiGossip` — Location gossip (on exit)

When the player LEAVES a public location and its gossip-chance rolls a hit, the place produces a vague 'people are saying…' rumor about the visit, planted (as an OBSERVATION) in every character ticked at that location — including the person it's about, so they can hear they're being talked about. Feeds the gossip/intent pipeline. Use {{user}}, {{place}}, {{place_desc}}, {{others}}, {{visit}}.

| | |
|---|---|
| **Fires** | logged as `Location gossip ·` |
| **Runs on** | `model` · bucket `mem` · temp `fnTemp("mem",0.5)` · max `fnTok("mem",260)` |
| **Placeholders** | declared: `{{others}}`, `{{place}}`, `{{place_desc}}`, `{{user}}`, `{{visit}}`<br>supplied: `place`, `place_desc`, `user`<br>⚠️ declared but never supplied: `{{others}}`, `{{visit}}` |
| **Sections** | `ask` |
| **Returns** | `content`, `location`, `emotion`, `gist`, `charge`, `importance_score`, `tags` |
| **Size** | 2391 characters |

### `chronicler` — Universe memory — day chronicler

At End Day, distills the day's memories (all characters, incl. offstage events) and quest movements into 2-6 neutral chronicle entries — the universe's own memory of the day. Facts as facts, beliefs as beliefs. Placeholders: {{user}} {{day}}

| | |
|---|---|
| **Fires** | logged as `Universe chronicle · day` |
| **Runs on** | `state.memModel` · bucket `mem` · temp `fnTemp("mem",0.3)` · max `fnTok("mem",500)` |
| **Placeholders** | declared: `{{day}}`, `{{user}}`<br>supplied: `day`, `user` |
| **Sections** | `data` |
| **Returns** | `entries` |
| **Size** | 1305 characters |

### `x_bg_task` — Offstage task outcome

What happened while a character worked on something away from you. {{outcome}} is SUCCEEDED or FAILED; {{fail_note}} is added only on a failure.

| | |
|---|---|
| **Fires** | logged as `BG task —` |
| **Runs on** | `state.bioModel` · bucket `bio` · temp `fnTemp("bio",0.85)` · max `fnTok("bio",260)` |
| **Placeholders** | declared: `{{char}}`, `{{fail_note}}`, `{{lang}}`, `{{outcome}}`, `{{task}}`, `{{user}}`<br>supplied: `char`, `fail_note`, `lang`, `outcome`, `task`, `user` |
| **Sections** | `ask` |
| **Returns** | `headline`, `event` |
| **Size** | 314 characters |

### `x_chronicle_condense` — Chronicle condenser

Compresses a world's older day-by-day chronicle entries into one era paragraph.

| | |
|---|---|
| **Fires** | logged as ``Chronicle condense · days ${from` |
| **Runs on** | `state.memModel` · bucket `mem` · temp `fnTemp("mem",0.3)` · max `fnTok("mem",420)` |
| **Returns** | prose |
| **Size** | 475 characters |


---

## Quests

### `questGen` — Quest arc opener

Designs a new arc: its GM-only premise + ONE opening quest (the rest of the arc is written during play). Grounded in the universe memory (state zero + chronicle), live undercurrents and the hottest relationships; reuses existing places and prefers existing characters. Placeholders: {{setting}} {{directing}} {{user}} {{user_bio}} {{world_memory}} {{cast}} {{locations}} {{undercurrents}} {{hotpairs}} {{previous}} {{brief}}

| | |
|---|---|
| **Fires** | logged as `Quest arc —` |
| **Runs on** | `authoringModel()` · bucket `unigen` · temp `fnTemp("unigen",0.9)` · max `fnTok("unigen",3200)` |
| **Placeholders** | declared: `{{brief}}`, `{{cast}}`, `{{directing}}`, `{{hotpairs}}`, `{{locations}}`, `{{previous}}`, `{{setting}}`, `{{undercurrents}}`, `{{user}}`, `{{user_bio}}`, `{{world_memory}}`<br>supplied: `brief`, `directing`, `hotpairs`, `locations`, `setting`, `undercurrents`, `user`, `user_bio`, `world_memory`<br>⚠️ declared but never supplied: `{{cast}}`, `{{previous}}` |
| **Sections** | `ask` |
| **Returns** | `arc`, `premise`, `quest`, `name`, `desc`, `location`, `npc`, `cast` |
| **Size** | 3117 characters |

### `questNext` — Quest continuation designer

After a quest completes, designs the NEXT quest of its arc from the quest memory, universe memory, cast goals, live schemes and world events — or concludes the arc. Reuses existing places and prefers existing characters. Placeholders: {{setting}} {{directing}} {{user}} {{user_bio}} {{world_memory}} {{arc}} {{brief}} {{premise}} {{history}} {{cast}} {{locations}} {{undercurrents}} {{hotpairs}} {{events}} {{day}}

| | |
|---|---|
| **Fires** | logged as `Quest next —` |
| **Runs on** | `authoringModel()` · bucket `unigen` · temp `fnTemp("unigen",0.9)` · max `fnTok("unigen",1400)` |
| **Placeholders** | declared: `{{arc}}`, `{{brief}}`, `{{cast}}`, `{{day}}`, `{{directing}}`, `{{events}}`, `{{history}}`, `{{hotpairs}}`, `{{locations}}`, `{{premise}}`, `{{setting}}`, `{{undercurrents}}`, `{{user}}`, `{{user_bio}}`, `{{world_memory}}`<br>supplied: `brief`, `day`, `directing`, `events`, `history`, `hotpairs`, `locations`, `premise`, `setting`, `undercurrents`, `user`, `user_bio`, `world_memory`<br>⚠️ declared but never supplied: `{{arc}}`, `{{cast}}` |
| **Sections** | `ask` |
| **Returns** | `quest`, `name`, `desc`, `location`, `npc`, `cast`, `epilogue` |
| **Size** | 3776 characters |

### `x_quest_reconcile` — Quest reconciler (world quests)

At day's end, reads the day's memories and decides what moved on each active quest. Note the output language is named in the text — change it there if your story is not in Turkish.

| | |
|---|---|
| **Fires** | logged as `Quest reconcile` |
| **Runs on** | `state.memModel` · bucket `mem` · temp `fnTemp("mem",0.2)` · max `fnTok("mem",520)` |
| **Sections** | `data` |
| **Returns** | `id`, `done`, `result`, `progress` |
| **Size** | 1499 characters |

### `charQuestGen` — Character quest designer

At day end, judges whether ONE character commits to a personal quest of their own (grown from their goals + undercurrents) and designs it — targeting another character, or the player (with an ask, a text/in-person approach, and a scene gate that CODE evaluates each turn). Placeholders: char, personality, goals, intents, recent, ties, cast, locations, user, world, day, period. Returns {quest:false} or the quest JSON. Placeholders include {{open_quests}} (what is already being chased, so a second pursuit of the same thing is not started) and it returns done_when, the observable condition that ends the quest.

| | |
|---|---|
| **Fires** | logged as `Char quest (spawn) ·` |
| **Runs on** | `state.memModel` · bucket `mem` · temp `fnTemp("mem",0.7)` · max `fnTok("mem",700)` |
| **Placeholders** | declared: `{{cast}}`, `{{char}}`, `{{day}}`, `{{goals}}`, `{{intents}}`, `{{locations}}`, `{{open_quests}}`, `{{period}}`, `{{personality}}`, `{{recent}}`, `{{ties}}`, `{{user}}`, `{{world}}`<br>supplied: `cast`, `char`, `day`, `goals`, `intents`, `locations`, `open_quests`, `period`, `personality`, `ties`, `user`, `world`<br>⚠️ declared but never supplied: `{{recent}}` |
| **Sections** | `ask` |
| **Returns** | `quest`, `title`, `desc`, `motive`, `target`, `ask`, `approach`, `gate`, `type`, `done_when` |
| **Size** | 3075 characters |

### `charQuestStep` — Character quest step (offstage)

Advances a char→char quest offstage at day end: one concrete move, narrated to the player as a world event; may conclude the quest (done/failed) with a result. Placeholders: char, personality, title, desc, motive, target, target_sheet, tie, progress, recent, place, day, period, user, world. Returns {moved, headline, event, note, outcome, result, memories[], rel[]}. Also gets {{target_place}} — where the target actually is, so a move cannot put two people in a room the world has in different places — and {{done_when}}, the observable condition its "done" outcome is checked against.

| | |
|---|---|
| **Fires** | logged as `Char quest (step) ·` |
| **Runs on** | `state.memModel` · bucket `mem` · temp `fnTemp("mem",0.7)` · max `fnTok("mem",900)` |
| **Placeholders** | declared: `{{char}}`, `{{day}}`, `{{desc}}`, `{{done_when}}`, `{{motive}}`, `{{period}}`, `{{personality}}`, `{{place}}`, `{{progress}}`, `{{recent}}`, `{{target}}`, `{{target_place}}`, `{{target_sheet}}`, `{{tie}}`, `{{title}}`, `{{user}}`, `{{world}}`<br>supplied: `char`, `day`, `desc`, `done_when`, `it`, `motive`, `period`, `personality`, `place`, `target`, `target_place`, `target_sheet`, `tie`, `title`, `user`, `world`<br>⚠️ declared but never supplied: `{{progress}}`, `{{recent}}`<br>supplied but unused by the default: `it` |
| **Sections** | `promises`, `ask` |
| **Returns** | `moved`, `headline`, `event`, `note`, `outcome`, `result`, `memories`, `name`, `content`, `emotion`, `importance`, `rel`, `from`, `to` |
| **Size** | 2773 characters |

### `charQuestText` — Character quest text (ask over phone)

Composes the text message a quest-holder sends the player about their ask — a first raise or a considered follow-up, never a 'you haven't answered' nag. Use {{user}}, {{char}}. Returns {message, why}.

| | |
|---|---|
| **Fires** | logged as `Char quest (text) ·` |
| **Runs on** | `state.gmModel` · bucket `gm` · temp `fnTemp("gm",0.8)` · max `fnTok("gm",220)` |
| **Placeholders** | declared: `{{char}}`, `{{user}}`<br>supplied: `char`, `user` |
| **Sections** | `data` |
| **Returns** | `message`, `why` |
| **Size** | 889 characters |


---

## Calendar, promises, trackers

### `calPrompt` — Meetings detector

Extracts ONLY concrete dated meetings (exact day + executor + certainty + WHY it was arranged) from conversation and texts as JSON {new:[...]}. The why lands on the entry as its recorded purpose and anchors the meeting's later resolution.

| | |
|---|---|
| **Fires** | logged as `Meetings tracker` |
| **Runs on** | `state.memModel` · bucket `mem` · temp `fnTemp("mem",0.2)` · max `fnTok("mem",360)` |
| **Placeholders** | declared: `{{user}}`<br>supplied: `user` |
| **Returns** | `title`, `who`, `assignee`, `about`, `period`, `where`, `new`, `tasks` |
| **Size** | 7069 characters |

### `calReconcile` — End-of-day meetings reconciler

At day's end, reads the day's memories and marks meetings that actually happened done. Returns JSON [{id,status:"done",result}].

| | |
|---|---|
| **Fires** | logged as `Calendar reconcile` |
| **Runs on** | `state.memModel` · bucket `mem` · temp `fnTemp("mem",0.2)` · max `fnTok("mem",360)` |
| **Returns** | `id`, `status`, `result`, `period` |
| **Size** | 2557 characters |

### `promisePrompt` — Promises & commitments

Reads the recent exchange against the open commitment ledger and returns BOTH new commitments (a promise, a demand accepted, a rule someone agreed to live by — anything with no fixed date, which is what separates it from a meeting) and status changes to the ones already tracked (kept, broken, released). Placeholders: {{user}}, {{day}} (the cast and the open ledger are appended as live data). Returns {new:[...], updates:[...]}.

| | |
|---|---|
| **Fires** | logged as `Promises & commitments` |
| **Runs on** | `state.memModel` · bucket `mem` · temp `fnTemp("mem",0.2)` · max `fnTok("mem",420)` |
| **Placeholders** | declared: `{{user}}`<br>supplied: `day`, `user`<br>supplied but unused by the default: `day` |
| **Returns** | `new`, `holder`, `to`, `ask`, `promise`, `kind`, `weight`, `shows_as`, `updates`, `id`, `status`, `note` |
| **Size** | 6076 characters |

### `promisePurge` — Promises — purge pass

Runs ONCE per chat over the commitments ALREADY on the ledger — the ones recorded before the extractor was tightened. Re-reads each open entry against the same two tests (is somebody BOUND, and can the moment it shows be named), deletes what fails, and rewrites the survivors in the second person. No placeholders; the open ledger is appended as live data. Returns {keep:[{id,promise,shows_as}], delete:[id]}.

| | |
|---|---|
| **Fires** | logged as `Promises · purge pass` |
| **Runs on** | `state.memModel` · bucket `mem` · temp `fnTemp("mem",0.1)` · max `fnTok("mem",900)` |
| **Returns** | `keep`, `id`, `promise`, `shows_as`, `delete` |
| **Size** | 1935 characters |

### `trackerGen` — Tracker generator

Builds a full tracker (name, method, range, stage texts) from a free-form description + segment count. Placeholders: world, brief, segments, owner. Returns one tracker JSON object.

| | |
|---|---|
| **Fires** | logged as `Tracker generator` |
| **Runs on** | `state.bioModel` · bucket `bio` · temp `fnTemp("bio",0.8)` · max `fnTok("bio",1400)` |
| **Placeholders** | declared: `{{brief}}`, `{{name}}`, `{{owner}}`, `{{segments}}`, `{{world}}`<br>supplied: `brief`, `owner`, `segments`, `world`<br>⚠️ declared but never supplied: `{{name}}` |
| **Sections** | `ask` |
| **Returns** | `at`, `text`, `name`, `method`, `min`, `max`, `start`, `prompt`, `dice`, `stages` |
| **Size** | 2392 characters |

### `x_wearing_tracker` — Wearing tracker

After a turn whose text mentions clothes, records what anybody present is now wearing \u2014 so the payload and the image writer follow the scene rather than the table. Only runs when the text actually hints at it.

| | |
|---|---|
| **Fires** | logged as `Wearing tracker` |
| **Runs on** | `state.mcModel` · bucket `mc` · temp `fnTemp("mc",0.1)` · max `fnTok("mc",220)` |
| **Sections** | `data` |
| **Returns** | `changed`, `name`, `wearing` |
| **Size** | 991 characters |


---

## Goals and standing aims

### `goalsCurator` — Goals & ambitions curator

At day's end, REWRITES a character's goals & ambitions section from what actually happened — keeping, rewording, merging and DROPPING lines rather than appending. Absorbs their live pursuit and their private aim so the payload carries one maintained want-list instead of three stacked ones. Placeholders: {{char}}, {{user}}, {{max}}, {{personality}}, {{authored}}, {{current}}, {{pursuits}}, {{intents}}, {{promises}}, {{memories}}, {{standings}}, {{day}}. Returns {goals:[...], changed}.

| | |
|---|---|
| **Fires** | logged as `Goals curator ·` |
| **Runs on** | `state.memModel` · bucket `mem` · temp `fnTemp("mem",0.4)` · max `fnTok("mem",420)` |
| **Placeholders** | declared: `{{char}}`, `{{max}}`<br>supplied: `char`, `max`, `user`<br>supplied but unused by the default: `user` |
| **Sections** | `data` |
| **Returns** | `goals`, `changed` |
| **Size** | 3198 characters |


---

## Authoring — building the world and the people in it

### `univPrompt` — Universe generator

Turns a brief into a full universe as JSON.

| | |
|---|---|
| **Fires** | logged as `Universe generator` |
| **Runs on** | `authoringModel()` · bucket `unigen` · temp `fnTemp("unigen",0.9)` · max `fnTok("unigen",3800)` |
| **Sections** | `data` |
| **Returns** | `name`, `avatar`, `setting`, `characters`, `personality`, `traits`, `goals`, `backstory`, `style`, `look`, `face_map`, `hair`, `face`, `body` |
| **Size** | 3540 characters |

### `bioPrompt` — Character bio generator

Turns a brief into a full character card as JSON.

| | |
|---|---|
| **Fires** | logged as `Character bio generator` |
| **Runs on** | `authoringModel()` · bucket `unigen` · temp `fnTemp("unigen",0.9)` · max `fnTok("unigen",800)` |
| **Sections** | `data` |
| **Returns** | `name`, `avatar`, `personality`, `traits`, `goals`, `backstory`, `style`, `look`, `face_map`, `hair`, `face`, `body`, `instructions`, `interject` |
| **Size** | 7893 characters |

### `batchBioPrompt` — Batch character generator (related set)

Turns a brief + count into a SET of mutually-related character cards in one call. Placeholder: {{count}}. Returns JSON {characters:[...]} where each card adds a socialGraph naming its ties to the others.

| | |
|---|---|
| **Fires** | logged as `Batch character generator ×` |
| **Runs on** | `authoringModel()` · bucket `unigen` · temp `fnTemp("unigen",0.9)` · max `batchTok` |
| **Placeholders** | declared: `{{count}}`<br>supplied: none (only the global values)<br>⚠️ declared but never supplied: `{{count}}` |
| **Sections** | `data` |
| **Returns** | `characters`, `name`, `avatar`, `personality`, `traits`, `goals`, `backstory`, `style`, `look`, `face_map`, `hair`, `face`, `body`, `instructions` |
| **Size** | 6222 characters |

### `latentNpc` — Latent NPCs (first visit)

Mints up to 2 inhabitants for a location on the player's FIRST visit (owner, bouncer, dungeon boss). Placeholders: world, loc, desc, type, cast, quests. Returns a JSON array of 0-2 compact character cards.

| | |
|---|---|
| **Fires** | logged as `Latent NPCs —` |
| **Runs on** | `state.bioModel` · bucket `bio` · temp `fnTemp("bio",0.85)` · max `fnTok("bio",900)` |
| **Placeholders** | declared: `{{cast}}`, `{{desc}}`, `{{loc}}`, `{{quests}}`, `{{type}}`, `{{world}}`<br>supplied: `cast`, `desc`, `loc`, `quests`, `type`, `world` |
| **Sections** | `ask` |
| **Returns** | `name`, `role`, `personality`, `look`, `style`, `interject`, `goals` |
| **Size** | 1228 characters |

### `x_reveal_npc` — Latent character reveal

Fleshes out a sketched-in background character the first time they actually appear.

| | |
|---|---|
| **Fires** | logged as `Reveal NPC —` |
| **Runs on** | `state.bioModel` · bucket `bio` · temp `fnTemp("bio",0.8)` · max `fnTok("bio",700)` |
| **Sections** | `data` |
| **Returns** | `personality`, `look`, `backstory`, `style`, `goals` |
| **Size** | 438 characters |

### `x_schedule_generator` — Daily schedule generator

Decides where a character tends to be through the day. {{home_note}} names their home when they have one.

| | |
|---|---|
| **Fires** | logged as `Schedule generator ·` |
| **Runs on** | `state.bioModel` · bucket `bio` · temp `fnTemp("bio",0.4)` · max `fnTok("bio",500)` |
| **Placeholders** | declared: `{{home_note}}`<br>supplied: `home_note` |
| **Sections** | `card`, `locations` |
| **Returns** | JSON |
| **Size** | 788 characters |

### `x_look_split` — Appearance splitter

One-off migration: turns an old freeform appearance string into the structured fields.

| | |
|---|---|
| **Fires** | logged as `Look split ·` |
| **Runs on** | `authoringModel()` · bucket `unigen` · temp `fnTemp("unigen",0.2)` · max `fnTok("unigen",300)` |
| **Sections** | `look` |
| **Returns** | `face_map`, `hair`, `face`, `body` |
| **Size** | 354 characters |

### `x_appearance_generator` — Appearance generator

Turns a character card + world into the structured appearance JSON the image generator uses. Runs from the character editor's “Generate appearance”.

| | |
|---|---|
| **Fires** | logged as `Appearance generator` |
| **Runs on** | `authoringModel()` · bucket `unigen` · temp `fnTemp("unigen",0.8)` · max `fnTok("unigen",650)` |
| **Sections** | `data` |
| **Returns** | `subject`, `face_map`, `hair`, `face`, `body`, `wardrobe` |
| **Size** | 1428 characters |

### `x_outfits_generator` — Outfit generator

Writes one outfit per place the character can be — every location, their own home and the player's house at each time of day, plus swim/sport/sleep/intimate. The payload then sends the ONE that fits instead of a wardrobe to choose from. Runs from the character editor's “Generate outfits”.

| | |
|---|---|
| **Fires** | logged as `Outfit generator` |
| **Runs on** | `authoringModel()` · bucket `unigen` · temp `fnTemp("unigen",0.8)` · max `fnTok("unigen",1800)` |
| **Sections** | `data` |
| **Returns** | `home`, `activity`, `swim`, `sport`, `sleep`, `intimate` |
| **Size** | 2264 characters |

### `directorAuthor` — Director-notes author (per-universe)

Writes the world's 'how drama works here' notes from its setting + cast, fed to the GM & Scene Writer. Use {{setting}}, {{cast}}, {{user}}, {{user_bio}}.

| | |
|---|---|
| **Fires** | logged as `Director notes ·` |
| **Runs on** | `authoringModel()` · bucket `unigen` · temp `fnTemp("unigen",0.7)` · max `fnTok("unigen",500)` |
| **Placeholders** | declared: `{{cast}}`, `{{setting}}`, `{{user}}`, `{{user_bio}}`<br>supplied: `setting`, `user`, `user_bio`<br>⚠️ declared but never supplied: `{{cast}}` |
| **Sections** | `ask`, `request` |
| **Returns** | prose |
| **Size** | 1474 characters |

### `genrePackAuthor` — Genre-pack author (per-universe)

Writes a universe's GENRE PACK (voice/drama/stakes/relInterpretation/diaryVoice/pacing, injected as blocks into every genre-sensitive engine) plus the player-facing universe guide, in ONE call so they stay aligned. Placeholders: {{setting}}, {{directing}}, {{cast}}, {{user}}, {{trackers}}, {{systems}}. JSON out.

| | |
|---|---|
| **Fires** | logged as `Genre pack ·` |
| **Runs on** | `authoringModel()` · bucket `unigen` · temp `fnTemp("unigen",0.8)` · max `fnTok("unigen",3800)` |
| **Placeholders** | declared: `{{cast}}`, `{{directing}}`, `{{setting}}`, `{{systems}}`, `{{trackers}}`, `{{user}}`<br>supplied: `directing`, `setting`, `user`<br>⚠️ declared but never supplied: `{{cast}}`, `{{systems}}`, `{{trackers}}` |
| **Sections** | `ask`, `request` |
| **Returns** | `voice`, `drama`, `stakes`, `pacing`, `guide` |
| **Size** | 2216 characters |

### `ruleCompiler` — World-rule compiler

Turns a free-text boundary ('my enemies cannot enter my castle') into ONE structured access rule the engine enforces in code. Placeholders: {{rule_text}}, {{locations}}, {{characters}}, {{tags}}. JSON out (or {error}).

| | |
|---|---|
| **Fires** | logged as `World-rule compiler` |
| **Runs on** | `authoringModel()` · bucket `unigen` · temp `fnTemp("unigen",0.2)` · max `fnTok("unigen",300)` |
| **Placeholders** | declared: `{{characters}}`, `{{locations}}`, `{{rule_text}}`, `{{tags}}`<br>supplied: `characters`, `locations`, `rule_text`, `tags` |
| **Sections** | `ask` |
| **Returns** | `kind`, `who`, `mode`, `value`, `where`, `exceptions`, `note`, `error` |
| **Size** | 1337 characters |

### `promptTuner` — Per-universe prompt tuner

Lightly adjusts a working director prompt to fit a world (preserves structure & placeholders). Use {{setting}}, {{directing}}, {{base}}.

| | |
|---|---|
| **Fires** | logged as `Prompt tuner ·` |
| **Runs on** | `authoringModel()` · bucket `unigen` · temp `fnTemp("unigen",0.4)` · max `Math.max(fnTok("mem",1400),Math.min(3000` |
| **Placeholders** | declared: `{{base}}`, `{{directing}}`, `{{placeholder}}`, `{{setting}}`<br>supplied: none (only the global values)<br>⚠️ declared but never supplied: `{{base}}`, `{{directing}}`, `{{placeholder}}`, `{{setting}}` |
| **Sections** | `ask` |
| **Returns** | prose |
| **Size** | 1309 characters |


---

## Images and video

### `rewritePrompt` — Image-prompt rewriter

Turns each roleplay reply into a vivid image-generation prompt. This is the FIRST of the layers an image request is built from; the three below follow it.

| | |
|---|---|
| **Fires** | logged as `Image prompt writer` |
| **Runs on** | `state.rewriter` · bucket `rewriter` · temp `fnTemp("rewriter",0.6)` · max `fnTok("rewriter",220)` |
| **Sections** | `data` |
| **Returns** | prose |
| **Size** | 2484 characters |

### `imgFoundation` — Image writer · foundation (old-style rules only)

Base rules, added ONLY when the routed image rule has no "# OUTPUT STRUCTURE" section of its own. A rule written in the new structure supplies its own and this layer is skipped entirely.

| | |
|---|---|
| **Runs on** | not its own call — this text is assembled into another payload |
| **Returns** | prose |
| **Size** | 700 characters |

### `imgFrameGuide` — Image writer · this request

The last layer before the exchange, on every image. Says what the continuity reference and the decided outfit in the message below are for, and that the scene-type rule above outranks it.

| | |
|---|---|
| **Runs on** | not its own call — this text is assembled into another payload |
| **Returns** | prose |
| **Size** | 1251 characters |

### `imgPovGuide` — Image writer · POV frames

Added after the frame note when the routed rule is a POV rule: the lens is the player's own eyes, he is never a body in the picture, and she may look straight into it.

| | |
|---|---|
| **Runs on** | not its own call — this text is assembled into another payload |
| **Returns** | prose |
| **Size** | 1291 characters |

### `routerPrompt` — Image/Video router

Picks which image/video model rule fits the scene, and which docked video scene each beat routes to.

| | |
|---|---|
| **Fires** | logged as `Scene selector (model router)` |
| **Runs on** | `state.routerModel` · bucket `router` · temp `fnTemp("router",0)` · max `fnTok("router",5)` |
| **Returns** | prose |
| **Size** | 3977 characters |

### `visualDirector` — Visual director (new picture / video scene)

Runs once per reply in \u201cLet the story decide\u201d mode: returns 0 (keep the picture already on screen) or 1 (draw a new one), and nothing else. Gets what the current picture shows and the latest exchange. Scene videos are started by hand and are never chosen for you.

| | |
|---|---|
| **Fires** | logged as `Visual director` |
| **Runs on** | `state.routerModel` · bucket `router` · temp `fnTemp("router",0)` · max `fnTok("router",12)` |
| **Returns** | prose |
| **Size** | 2195 characters |

### `vidPrompt` — Video-prompt rewriter

Turns a still scene into ONE motion prompt for the video model. Gets the configured clip length ({{seconds}}) and how many time blocks to write ({{blocks}}), plus the shared video ruleset and the routed position's own template.

| | |
|---|---|
| **Runs on** | not its own call — this text is assembled into another payload |
| **Placeholders** | declared: `{{blocks}}`, `{{seconds}}`<br>supplied: none (only the global values)<br>⚠️ declared but never supplied: `{{blocks}}`, `{{seconds}}` |
| **Returns** | prose |
| **Size** | 2787 characters |

### `moanPrompt` — Voice-sample writer

Writes the tagged vocal track (moans, no words) that the “Create sample” button in Generate video renders in the actor's own TTS voice. Gets the clip length ({{seconds}}), how many tagged segments to write ({{beats}}), and the actor's bio.

| | |
|---|---|
| **Runs on** | not its own call — this text is assembled into another payload |
| **Placeholders** | declared: `{{beats}}`, `{{seconds}}`<br>supplied: none (only the global values)<br>⚠️ declared but never supplied: `{{beats}}`, `{{seconds}}` |
| **Returns** | prose |
| **Size** | 2215 characters |


---

## Everything else

### `attendanceEstimate` — Attendance estimate (likely meeting)

For a loosely-agreed meeting, estimates the chance the character shows up from bio + relationship + mood. Returns {probability:0-100}. Use {{user}}.

| | |
|---|---|
| **Fires** | logged as `Attendance estimate ·` |
| **Runs on** | `state.memModel` · bucket `mem` · temp `fnTemp("mem",0.2)` · max `fnTok("mem",60)` |
| **Placeholders** | declared: `{{user}}`<br>supplied: `user` |
| **Sections** | `data` |
| **Returns** | `probability` |
| **Size** | 453 characters |

### `attendancePersuade` — Attendance persuasion

After the player addresses an uncertain meeting, re-scores the chance the character attends. Returns {probability:0-100}. Use {{user}}, {{char}}, {{probability}}.

| | |
|---|---|
| **Fires** | logged as `Attendance persuasion ·` |
| **Runs on** | `state.memModel` · bucket `mem` · temp `fnTemp("mem",0.2)` · max `fnTok("mem",60)` |
| **Placeholders** | declared: `{{char}}`, `{{probability}}`, `{{user}}`<br>supplied: `char`, `probability`, `user` |
| **Sections** | `meeting`, `exchange`, `ask` |
| **Returns** | `probability` |
| **Size** | 572 characters |

### `originGen` — Universe memory — state zero

Writes the universe's STATE-ZERO briefing (who is who, what they want, their history, ties and haunts) from the world + FULL cast cards. Stored on the universe and fed to the quest designers as durable grounding. Placeholders: {{setting}} {{directing}} {{user}} {{user_bio}} {{cast_full}} {{locations}}

| | |
|---|---|
| **Fires** | logged as `Universe memory (state zero) —` |
| **Runs on** | `authoringModel()` · bucket `unigen` · temp `fnTemp("unigen",0.7)` · max `fnTok("unigen",2400)` |
| **Placeholders** | declared: `{{cast_full}}`, `{{directing}}`, `{{locations}}`, `{{setting}}`, `{{user}}`, `{{user_bio}}`<br>supplied: `cast_full`, `directing`, `locations`, `setting`, `user`, `user_bio` |
| **Sections** | `ask`, `request` |
| **Returns** | prose |
| **Size** | 1417 characters |

### `rumorJudge` — Rumor judge (raise / answer)

Decides two things about a live rumor: whether the character actually put it to you this turn (which spends their one raise), and \u2014 after you answer \u2014 whether the matter is now settled, believed, or still open. This is what lets a rumor end.

| | |
|---|---|
| **Fires** | logged as `Rumor judge (raise) ·` |
| **Runs on** | `state.gmModel` · bucket `gm` · temp `fnTemp("gm",0)` · max `fnTok("gm",60)` |
| **Placeholders** | declared: `{{mode}}`, `{{rumor}}`, `{{text}}`, `{{user}}`<br>supplied: `answers`, `mode`, `rumor`, `says`, `text`, `user`<br>supplied but unused by the default: `answers`, `says` |
| **Sections** | `data` |
| **Returns** | `raised`, `verdict`, `why` |
| **Size** | 1375 characters |

### `trackPrompt` — Freeform tracker

Judges soft deltas and detects trigger phrases.

| | |
|---|---|
| **Runs on** | not its own call — this text is assembled into another payload |
| **Returns** | `delta`, `triggered` |
| **Size** | 1534 characters |

### `travelPrompt` — Travel narration

Narrates a journey between places. Use {{user}}.

| | |
|---|---|
| **Fires** | logged as `Travel narration` |
| **Runs on** | `state.model` · bucket `—` · temp `—` · max `—` |
| **Placeholders** | declared: `{{user}}`<br>supplied: `user` |
| **Sections** | `data`, `ask` |
| **Returns** | prose |
| **Size** | 2524 characters |

### `x_call_delivery` — Voice call — how you speak

The spoken-delivery contract for a live call: sentence length, the story language, and the [bracketed] cues the voice actor performs.

| | |
|---|---|
| **Runs on** | not its own call — this text is assembled into another payload |
| **Placeholders** | declared: `{{lang}}`<br>supplied: `lang` |
| **Returns** | prose |
| **Size** | 1305 characters |

### `x_call_role` — Voice call — who you are in it

Opens the live voice-call payload: that this is a real spoken conversation in person, not a phone call or a text.

| | |
|---|---|
| **Runs on** | not its own call — this text is assembled into another payload |
| **Placeholders** | declared: `{{char}}`, `{{user}}`<br>supplied: `char`, `user` |
| **Returns** | prose |
| **Size** | 395 characters |

### `x_char_quest_reconcile` — Quest reconciler (asks made of you)

At day's end, decides what happened to the personal favours characters asked of {{user}}.

| | |
|---|---|
| **Fires** | logged as `Char quest reconcile` |
| **Runs on** | `state.memModel` · bucket `mem` · temp `fnTemp("mem",0.2)` · max `fnTok("mem",480)` |
| **Placeholders** | declared: `{{user}}`<br>supplied: `user` |
| **Sections** | `data` |
| **Returns** | `id`, `done`, `failed`, `answered`, `result`, `progress` |
| **Size** | 1016 characters |

### `x_day_transition_narration` — Day transition narration

Closes out a day and eases into the next one.

| | |
|---|---|
| **Fires** | logged as `Day transition narration` |
| **Runs on** | `state.model` · bucket `—` · temp `0.8` · max `160` |
| **Sections** | `scene`, `ask` |
| **Returns** | prose |
| **Size** | 276 characters |

### `x_location_homes` — Place builder · homes

Houses the cast, grouping anyone who would logically live together. {{cast}} is the characters and their ties, {{world}} the setting plus the places that already exist, {{count}} how many characters are being housed.

| | |
|---|---|
| **Runs on** | not its own call — this text is assembled into another payload |
| **Placeholders** | declared: `{{cast}}`, `{{count}}`, `{{world}}`<br>supplied: `cast`, `count`, `world` |
| **Returns** | JSON |
| **Size** | 1246 characters |

### `x_location_pois` — Place builder · public places

Invents five public places the cast can gather in, once everyone is housed.

| | |
|---|---|
| **Runs on** | not its own call — this text is assembled into another payload |
| **Placeholders** | declared: `{{world}}`<br>supplied: `world` |
| **Returns** | JSON |
| **Size** | 576 characters |

### `x_location_quest` — Place builder · the places a quest needs

Builds the specific places the story's quests happen in. {{places}} is the list of required names and sub-areas.

| | |
|---|---|
| **Runs on** | not its own call — this text is assembled into another payload |
| **Placeholders** | declared: `{{count}}`, `{{places}}`, `{{world}}`<br>supplied: `areas`, `count`, `places`, `world`<br>supplied but unused by the default: `areas` |
| **Returns** | JSON |
| **Size** | 611 characters |

### `x_location_request` — Place builder · your steering request

Appended to whichever place-builder job is running when you type something into the popup.

| | |
|---|---|
| **Runs on** | not its own call — this text is assembled into another payload |
| **Placeholders** | declared: `{{request}}`<br>supplied: `request` |
| **Returns** | prose |
| **Size** | 165 characters |

### `x_meeting_no_show_beat` — Meeting no-show beat

The narrator sentence when someone never turned up to a meeting you waited for.

| | |
|---|---|
| **Fires** | logged as `Meeting no-show beat` |
| **Runs on** | `state.memModel` · bucket `mem` · temp `fnTemp("mem",0.5)` · max `fnTok("mem",90)` |
| **Sections** | `data` |
| **Returns** | prose |
| **Size** | 85 characters |

### `x_neglect` — Being left alone

Planted at day's end in a character the player has not shared a scene with for several days. {{who}} is the player, {{days}} is how many days it has been. Fires at a few crossings only, never every day.

| | |
|---|---|
| **Runs on** | not its own call — this text is assembled into another payload |
| **Placeholders** | declared: `{{days}}`, `{{who}}`<br>supplied: `days`, `who` |
| **Returns** | prose |
| **Size** | 103 characters |

### `x_prompt_reviser` — Prompt reviser (image / video)

Behind the “revise this prompt” box in the playground and in image→video.

| | |
|---|---|
| **Fires** | logged as `dbg||` |
| **Runs on** | `state.rewriter` · bucket `rewriter` · temp `fnTemp("rewriter",0.5)` · max `fnTok("rewriter",260)` |
| **Returns** | prose |
| **Size** | 267 characters |

### `x_rolling_recap` — Rolling recap

The running summary a long chat carries so a character stays consistent about what was said.

| | |
|---|---|
| **Fires** | logged as `Rolling recap` |
| **Runs on** | `state.recapModel||state.memModel||state.callMo` · bucket `—` · temp `0.3` · max `fnTok("mem",260)` |
| **Returns** | prose |
| **Size** | 629 characters |

### `x_rumor_about_you` — A rumour about an evening you were part of

Planted in a character who was THERE, instead of the circulating “people are saying…” line that goes to everyone else at that place. {{place}} is where, {{gist}} is the shape the talk is giving it.

| | |
|---|---|
| **Runs on** | not its own call — this text is assembled into another payload |
| **Placeholders** | declared: `{{gist}}`, `{{place}}`<br>supplied: `gist`, `place` |
| **Returns** | prose |
| **Size** | 155 characters |

### `x_stt_repair` — Voice call — transcript repair

Repairs what the speech-to-text engine mis-heard during a live call, using the known names of your world.

| | |
|---|---|
| **Fires** | logged as `Call STT fix` |
| **Runs on** | `state.sttFixModel||state.callModel||"deepseek/` · bucket `—` · temp `0.1` · max `120` |
| **Returns** | prose |
| **Size** | 962 characters |

### `x_text_notice` — “They are on their phone” beat

The narrator line the people in the room see when {{user}} texts somebody. Never says who, never says what. The person being texted does not see it.

| | |
|---|---|
| **Runs on** | not its own call — this text is assembled into another payload |
| **Placeholders** | declared: `{{user}}`<br>supplied: `user` |
| **Returns** | prose |
| **Size** | 53 characters |

### `x_tracker_ask` — Tracker judge — the question

The instruction sent with every tracker evaluation. {{tracker}} is the tracker's own definition, {{name}} its name and {{owner}} whose it is. The system prompt above it is the editable “Tracker prompt”.

| | |
|---|---|
| **Fires** | logged as ``Tracker · ${t.name` |
| **Runs on** | `model` · bucket `mem` · temp `fnTemp("mem",0.2)` · max `fnTok("mem",120)` |
| **Placeholders** | declared: `{{name}}`, `{{owner}}`, `{{tracker}}`<br>supplied: `name`, `owner`, `tracker` |
| **Returns** | `delta`, `triggered` |
| **Size** | 263 characters |

### `x_unkept_meeting` — A meeting that never happened

Planted once, at day's end, in every CHARACTER who was party to a meeting whose day has passed without it happening. {{title}} is what was arranged, {{who}} is whoever did not come. Never planted in {{user}} \u2014 they know what they did.

| | |
|---|---|
| **Runs on** | not its own call — this text is assembled into another payload |
| **Placeholders** | declared: `{{title}}`, `{{who}}`<br>supplied: `title`, `who` |
| **Returns** | prose |
| **Size** | 83 characters |

### `x_write_prompt_with_ai` — Write-with-AI (the prompt writer)

The meta-prompt behind every “Write with AI” button — it writes your other prompts. {{json_rule}} and {{ph_rule}} are added by the app when the prompt being written returns JSON or carries placeholders.

| | |
|---|---|
| **Fires** | logged as `Write prompt with AI ·` |
| **Runs on** | `state.bioModel||state.model` · bucket `—` · temp `0.6` · max `1500` |
| **Placeholders** | declared: `{{json_rule}}`, `{{ph_rule}}`<br>supplied: `json_rule`, `ph_rule` |
| **Sections** | `data` |
| **Returns** | prose |
| **Size** | 300 characters |
