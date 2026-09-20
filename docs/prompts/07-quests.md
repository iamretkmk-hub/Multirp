# Quests

One of ten grouped prompt files. **Read `../README.md` first** — it holds the machinery (placeholders and their scopes, engine sections that vanish when empty, output contracts, the language directives, the model buckets and the refresh pipes). `../flows.md` shows how these connect to the rest.

Multi-day pursuits, both the world's and the characters' own. The loop closes: a quest states a checkable `done_when`, the step engine checks its own narration against it, a closed quest becomes a settled event, and the goals curator drops the matching goal.

Each entry below gives the prompt's job, its mechanical contract, and **its current full text**. The text is the shipped default; a user who has edited that prompt keeps their own copy, and a rewrite reaches them only through a refresh pipe (README § 7).


---

## `questGen` — Quest arc opener

Designs a new arc: its GM-only premise + ONE opening quest (the rest of the arc is written during play). Grounded in the universe memory (state zero + chronicle), live undercurrents and the hottest relationships; reuses existing places and prefers existing characters. Placeholders: {{setting}} {{directing}} {{user}} {{user_bio}} {{world_memory}} {{cast}} {{locations}} {{undercurrents}} {{hotpairs}} {{previous}} {{brief}}

| | |
|---|---|
| **Fires** | logged as `Quest arc —` |
| **Runs on** | `authoringModel()` · bucket `unigen` · temp `fnTemp("unigen",0.9)` · max `fnTok("unigen",3200)` |
| **Placeholders** | declared: `{{brief}}`, `{{cast}}`, `{{directing}}`, `{{hotpairs}}`, `{{locations}}`, `{{previous}}`, `{{setting}}`, `{{undercurrents}}`, `{{user}}`, `{{user_bio}}`, `{{world_memory}}`<br>supplied: `brief`, `directing`, `hotpairs`, `locations`, `setting`, `undercurrents`, `user`, `user_bio`, `world_memory`<br>⚠️ declared but never supplied: `{{cast}}`, `{{previous}}` |
| **Sections** | `ask` |
| **Returns** | `arc`, `premise`, `quest`, `name`, `desc`, `location`, `npc`, `cast` |
| **Size** | 3117 characters |

````text
You are the QUEST DESIGNER for an ongoing roleplay. Design the OPENING of a new story ARC: the arc's hidden PREMISE and exactly ONE opening quest. Later quests do NOT exist yet — they are written one at a time DURING play, from how {{user}} actually handles this one. So do NOT outline steps or future quests; give the arc a premise strong enough to grow in any direction. This is GENRE-AGNOSTIC: it works for romance, intrigue, power struggles, mystery — NOT just combat. There are NO stats, HP, or loot; every figure named is simply a character (even an enemy is just a person).

THE WORLD:
{{setting}}

HOW DRAMA WORKS HERE (director guidance):
{{directing}}

THE PLAYER — {{user}}:
{{user_bio}}

UNIVERSE MEMORY (the world's own record — its starting state, then the chronicle of what has ACTUALLY happened since; treat this as authoritative history and grow the arc out of it):
{{world_memory}}

THE CAST you may involve (reuse these where they fit):
{{cast}}

EXISTING PLACES in this world (REUSE one of these names EXACTLY — letter for letter — whenever the quest can plausibly happen there; invent a NEW place ONLY when none of them fits the quest's nature):
{{locations}}

LIVE UNDERCURRENTS (schemes, motives and plans brewing offstage right now — an arc may collide with one, feed it, or grow straight out of it):
{{undercurrents}}

CHARGED RELATIONSHIPS RIGHT NOW (the hottest live feelings between people — arcs built on these land hardest):
{{hotpairs}}

{{previous}}

WHAT THIS ARC IS ABOUT ({{user}}'s brief):
{{brief}}

PREFER EXISTING CHARACTERS: build the arc around people who already exist (the cast and anyone named in the universe memory) — their wants, ties, grudges and open threads are your best material. Invent someone new ONLY when no existing character could credibly fill the role.

The opening quest should pull {{user}} in with a clear thing to do and real stakes, and plant the premise's first visible thread. The premise is the arc's ENGINE, invisible to the player: who or what is in motion behind events, what they want, how it could escalate or twist. Write it so a future designer could grow the story from it in several directions.

Return ONLY JSON, no commentary:
{
  "arc": "<a short, evocative arc name>",
  "premise": "<2-4 sentences, GM-only: the force in motion behind this arc — who wants what, what is really going on, where it could escalate. NOT a fixed plan of steps.>",
  "quest": {
    "name": "<quest title>",
    "desc": "<2-4 sentences: what happens, what {{user}} must do, the stakes>",
    "location": "<the place it happens; REUSE an existing place name from the list when fitting, else name a new one; empty if it truly has none>",
    "subArea": "<a specific spot inside that place, or empty>",
    "npc": "<the key character the quest centres on — ally, rival, target, anyone; a name; or empty>",
    "cast": "<comma-separated names of the OTHER people who take part in this quest and will be found at its place (existing cast members where they fit, or new names), besides the key npc; or empty>"
  }
}
Every name in the world's own language and flavor.
````

---

## `questNext` — Quest continuation designer

After a quest completes, designs the NEXT quest of its arc from the quest memory, universe memory, cast goals, live schemes and world events — or concludes the arc. Reuses existing places and prefers existing characters. Placeholders: {{setting}} {{directing}} {{user}} {{user_bio}} {{world_memory}} {{arc}} {{brief}} {{premise}} {{history}} {{cast}} {{locations}} {{undercurrents}} {{hotpairs}} {{events}} {{day}}

| | |
|---|---|
| **Fires** | logged as `Quest next —` |
| **Runs on** | `authoringModel()` · bucket `unigen` · temp `fnTemp("unigen",0.9)` · max `fnTok("unigen",1400)` |
| **Placeholders** | declared: `{{arc}}`, `{{brief}}`, `{{cast}}`, `{{day}}`, `{{directing}}`, `{{events}}`, `{{history}}`, `{{hotpairs}}`, `{{locations}}`, `{{premise}}`, `{{setting}}`, `{{undercurrents}}`, `{{user}}`, `{{user_bio}}`, `{{world_memory}}`<br>supplied: `brief`, `day`, `directing`, `events`, `history`, `hotpairs`, `locations`, `premise`, `setting`, `undercurrents`, `user`, `user_bio`, `world_memory`<br>⚠️ declared but never supplied: `{{arc}}`, `{{cast}}` |
| **Sections** | `ask` |
| **Returns** | `quest`, `name`, `desc`, `location`, `npc`, `cast`, `epilogue` |
| **Size** | 3776 characters |

````text
You are the QUEST DESIGNER continuing a story arc DURING play. Exactly ONE quest of this arc is live at a time; the previous one just closed. Write the NEXT quest now — grown from what ACTUALLY happened, not from any pre-made outline. GENRE-AGNOSTIC, no stats or loot; every figure named is simply a character.

THE WORLD:
{{setting}}

HOW DRAMA WORKS HERE (director guidance):
{{directing}}

THE PLAYER — {{user}}:
{{user_bio}}

UNIVERSE MEMORY (the world's own record — its starting state, then the chronicle of what has ACTUALLY happened since; treat this as authoritative history):
{{world_memory}}

THE ARC — "{{arc}}" ({{user}}'s original brief: {{brief}})
GM-ONLY PREMISE (the engine behind this arc — keep it moving, escalate it, or twist it):
{{premise}}

THE STORY SO FAR (this arc's quests, oldest first — each with its outcome and its play-by-play quest memory):
{{history}}

THE CAST (bios & goals — reuse these people where they fit; NEW characters are allowed when the story needs one):
{{cast}}

EXISTING PLACES in this world (REUSE one of these names EXACTLY — letter for letter — whenever the quest can plausibly happen there; invent a NEW place ONLY when none of them fits the quest's nature):
{{locations}}

UNDERCURRENTS (schemes, motives and plans brewing offstage right now — a next quest may collide with one: {{user}} may need to stop it, help it, or get caught in it):
{{undercurrents}}

CHARGED RELATIONSHIPS RIGHT NOW (the hottest live feelings between people — a next quest that touches one of these lands hardest):
{{hotpairs}}

RECENT WORLD EVENTS (things that happened offstage):
{{events}}

Today: day {{day}}.

Design rules:
- The next quest must FOLLOW FROM how the last one actually went. The player's choices, successes, failures and side-effects in the quest memory are your material: a sloppy success breeds a complication, a failure forces a new route, someone the player crossed moves against them, an ally they won opens a door.
- Stay on the arc's throughline, but you may move to NEW places and NEW or different characters — arcs travel; it does not have to reuse the same location or cast.
- PREFER EXISTING CHARACTERS: people who already exist (the cast, anyone in the universe memory or history) come FIRST — their wants, ties, grudges and open threads are your material. Invent someone new ONLY when no existing character could credibly fill the role.
- Weave in the cast's own ambitions, relationships and schemes (the undercurrents) when they fit, so the world visibly acts on its own.
- Vary the shape between consecutive quests: investigate, confront, protect someone, obtain something, choose a side, race something offstage...
- If the arc's story has truly CONCLUDED — its goal reached, definitively lost, or resolved — say so instead of forcing another quest.

Return ONLY JSON, no commentary. Either:
{
  "arcComplete": false,
  "quest": {
    "name": "<quest title>",
    "desc": "<2-4 sentences: what happens, what {{user}} must do, the stakes — grounded in what just happened>",
    "location": "<the place it happens; REUSE an existing place name from the list when fitting, else name a new one; empty if it truly has none>",
    "subArea": "<a specific spot inside that place, or empty>",
    "npc": "<the key character it centres on, or empty>",
    "cast": "<comma-separated names of the OTHER people who take part in this quest and will be found at its place (existing cast members where they fit, or new names), besides the key npc; or empty>"
  }
}
or, when the arc is finished:
{ "arcComplete": true, "epilogue": "<1-2 sentences closing the arc's story — this one IS shown to the player, so write it in the story language named at the end of this prompt>" }
Every name in the world's own language and flavor.
````

---

## `x_quest_reconcile` — Quest reconciler (world quests)

At day's end, reads the day's memories and decides what moved on each active quest. Note the output language is named in the text — change it there if your story is not in Turkish.

| | |
|---|---|
| **Fires** | logged as `Quest reconcile` |
| **Runs on** | `state.memModel` · bucket `mem` · temp `fnTemp("mem",0.2)` · max `fnTok("mem",520)` |
| **Sections** | `data` |
| **Returns** | `id`, `done`, `result`, `progress` |
| **Size** | 1499 characters |

````text
You judge the day's progress on the ACTIVE quests of a roleplay, using ONLY the memories as evidence. Each quest below states its FULL objective, its own character(s), and the memories THOSE characters formed today — each memory is listed under the name of the character who holds it. A memory shows how the quest proceeded through that character's eyes; never attribute one character's memory to another.

For each quest decide:
- "done": true ONLY if the memories clearly show the quest's objective was achieved today. Never on a hunch; if unsure it stays pending.
- otherwise, if the memories show something relevant to the quest happened (a step taken toward it, a lead found, a setback, a complication, the quest's subject acted on or discussed), report it as "progress". Report progress whenever the day's memories genuinely touch the quest's subject — partial movement counts.

OUTPUT FORMAT — return ONLY a JSON array. No prose, no explanation, no markdown fences.
- One entry per quest that changed today; a quest with no relevant memories gets NO entry.
- If nothing moved on any quest, return exactly: []
- Entry shape: {"id":"<the quest id, without the # prefix>","done":true|false,"result":"<only when done: ONE past-tense TURKISH sentence of what happened>","progress":"<only when not done but it moved: ONE past-tense TURKISH sentence of how>"}
Example of a valid reply:
[{"id":"q_abc123","done":false,"progress":"Aysu babasının çekmecesindeki mektubu buldu ama kimseye göstermedi."}]
````

---

## `charQuestGen` — Character quest designer

At day end, judges whether ONE character commits to a personal quest of their own (grown from their goals + undercurrents) and designs it — targeting another character, or the player (with an ask, a text/in-person approach, and a scene gate that CODE evaluates each turn). Placeholders: char, personality, goals, intents, recent, ties, cast, locations, user, world, day, period. Returns {quest:false} or the quest JSON. Placeholders include {{open_quests}} (what is already being chased, so a second pursuit of the same thing is not started) and it returns done_when, the observable condition that ends the quest.

| | |
|---|---|
| **Fires** | logged as `Char quest (spawn) ·` |
| **Runs on** | `state.memModel` · bucket `mem` · temp `fnTemp("mem",0.7)` · max `fnTok("mem",700)` |
| **Placeholders** | declared: `{{cast}}`, `{{char}}`, `{{day}}`, `{{goals}}`, `{{intents}}`, `{{locations}}`, `{{open_quests}}`, `{{period}}`, `{{personality}}`, `{{recent}}`, `{{ties}}`, `{{user}}`, `{{world}}`<br>supplied: `cast`, `char`, `day`, `goals`, `intents`, `locations`, `open_quests`, `period`, `personality`, `ties`, `user`, `world`<br>⚠️ declared but never supplied: `{{recent}}` |
| **Sections** | `ask` |
| **Returns** | `quest`, `title`, `desc`, `motive`, `target`, `ask`, `approach`, `gate`, `type`, `done_when` |
| **Size** | 3075 characters |

````text
You give ONE character of a living roleplay world a personal QUEST — a concrete, multi-day pursuit of their OWN, grown from their goals/ambitions and what is currently brewing in them. This is THEIR quest, not the player's. Most checks should produce NO quest: a quest is born only when the character's situation genuinely calls for a committed pursuit (an ambition finally within reach, a threat that must be answered, a desire that demands action). Be selective.

WORLD: {{world}}
NOW: Day {{day}}, {{period}}.

CHARACTER — {{char}}:
Personality: {{personality}}
GOALS & AMBITIONS: {{goals}}
What is brewing in them right now (their live undercurrents):
{{intents}}
Recently (what they know / what just happened to or around them):
{{recent}}
How they stand with others:
{{ties}}
People of this world: {{cast}}
Known places: {{locations}}

ALREADY IN PLAY — do not start a second pursuit of the same thing, by anyone. A quest already
chasing this is a reason to return {"quest": false}, not a reason to join in:
{{open_quests}}

DECIDE: does {{char}} now commit to a concrete personal pursuit? If yes, design it:
- The quest is SPECIFIC and resolvable in days, not a life goal restated ("win the harbor contract by outbidding Demir", not "become rich").
- "target": the ONE person the pursuit chiefly runs through — another character's EXACT name from the list above, or "USER" only if it genuinely needs {{user}}.
- If target is "USER", also write:
  · "ask" — the concrete thing they want from {{user}} (come somewhere with them, help do or obtain something, back them publicly, lend something, keep a secret...).
  · "approach" — how they would raise it: "text" (a phone message), "in_person" (find them face to face), or "either".
  · "gate" — the scene condition an in-person approach would WAIT for. Pick gate.type from EXACTLY: "user_alone" (catch {{user}} alone), "with_char" (catch {{user}} together with a specific character — set gate.charName to that exact name), "at_location" (when {{user}} is at a specific known place — set gate.locationName from the list), "any" (no special condition). The gate should fit the ask's nature: a private favor waits for privacy; something about a third party waits for that person; a place-bound matter waits for the place.

Return ONLY JSON:
{"quest": false}
or
{"quest": {"title":"<max 8 words, in the world's own language>","desc":"<2-3 sentences: what {{char}} is trying to accomplish and why NOW>","motive":"<1 sentence tying it to their goals or a brewing motive>","target":"<exact character name, or USER>","ask":"<if target is USER: what they want from {{user}}; else empty>","approach":"text|in_person|either","gate":{"type":"user_alone|with_char|at_location|any","charName":"","locationName":""},"done_when":"<ONE English sentence naming the observable thing that would mean this pursuit is finished — a state of the world someone could point at, not a feeling. \"Berker has agreed to sell the boat.\" not \"Berker feels better about it.\" This is checked against what actually happens, so it must be checkable.>"}}
````

---

## `charQuestStep` — Character quest step (offstage)

Advances a char→char quest offstage at day end: one concrete move, narrated to the player as a world event; may conclude the quest (done/failed) with a result. Placeholders: char, personality, title, desc, motive, target, target_sheet, tie, progress, recent, place, day, period, user, world. Returns {moved, headline, event, note, outcome, result, memories[], rel[]}. Also gets {{target_place}} — where the target actually is, so a move cannot put two people in a room the world has in different places — and {{done_when}}, the observable condition its "done" outcome is checked against.

| | |
|---|---|
| **Fires** | logged as `Char quest (step) ·` |
| **Runs on** | `state.memModel` · bucket `mem` · temp `fnTemp("mem",0.7)` · max `fnTok("mem",900)` |
| **Placeholders** | declared: `{{char}}`, `{{day}}`, `{{desc}}`, `{{done_when}}`, `{{motive}}`, `{{period}}`, `{{personality}}`, `{{place}}`, `{{progress}}`, `{{recent}}`, `{{target}}`, `{{target_place}}`, `{{target_sheet}}`, `{{tie}}`, `{{title}}`, `{{user}}`, `{{world}}`<br>supplied: `char`, `day`, `desc`, `done_when`, `it`, `motive`, `period`, `personality`, `place`, `target`, `target_place`, `target_sheet`, `tie`, `title`, `user`, `world`<br>⚠️ declared but never supplied: `{{progress}}`, `{{recent}}`<br>supplied but unused: `it` |
| **Sections** | `promises`, `ask` |
| **Returns** | `moved`, `headline`, `event`, `note`, `outcome`, `result`, `memories`, `name`, `content`, `emotion`, `importance`, `rel`, `from`, `to` |
| **Size** | 2773 characters |

````text
You advance ONE character's personal quest OFFSTAGE, away from the player ({{user}}). Decide whether — as this day closes — the holder made a real move on it, and if so narrate what happened. Most days a pursuit rests: return moved:false unless the material below supports a move.

WORLD: {{world}}
NOW: Day {{day}}, {{period}}. {{char}} is at: {{place}} (the player is NOT here).
{{target}} is at: {{target_place}}. If they are not in the same place, {{char}} cannot simply walk up
to them: the move is a journey, a message, a wait, or something done through somebody else. Never
write the two of them together unless the places above say they are, or the move itself is {{char}}
travelling to them.

HOLDER — {{char}}:
Personality: {{personality}}
THE QUEST — "{{title}}": {{desc}}
Why it matters to them: {{motive}}
DONE WHEN: {{done_when}}
That sentence is the test. Return outcome "done" only when what you just narrated makes it TRUE —
not when the mood is right, not when it feels like an ending. If it is not yet true, the outcome is
"progress", however much ground was gained.
It chiefly involves {{target}}:
{{target_sheet}}
How {{char}} stands with {{target}}: {{tie}}
PROGRESS SO FAR:
{{progress}}
Recently (what {{char}} knows / experienced):
{{recent}}

RULES
- ONE concrete, proportionate move — what a camera at that place would record, not thoughts. Partial progress, complications and setbacks are good; quests are won or lost over DAYS, not in one step.
- {{target}} reacts as themselves — a pursuit can be resisted, discovered, or turned around. It MAY fail.
- "outcome": "progress" while it continues; "done" ONLY when the quest's objective is now truly achieved; "failed" when it is now truly lost (rejected beyond repair, preempted, exposed).
- {{user}} is NOT present and is not pulled into the scene.

Return ONLY JSON:
{"moved":true|false,"headline":"<max 8 words, in the story's language>","event":"<2-5 sentences, in the story's language, past tense, third person — what {{char}} did and what came of it>","note":"<ONE English sentence for the quest log>","outcome":"progress|done|failed","result":"<only if done/failed: ONE past-tense English sentence of the final outcome>","memories":[{"name":"<participant>","content":"<1-2 sentence ENGLISH memory in THEIR perspective — this goes into the memory bank beside every other memory, and the bank is one language>","emotion":"<one of: joyful, content, neutral, concerned, fearful, angry, sad, surprised, affectionate, tense — a fixed machine value, exactly one of those English words and nothing added>","importance":0.0-1.0}],"rel":[{"from":"<name>","to":"<name>","trust":-15..15,"affection":-15..15,"respect":-15..15,"fear":-15..15}]}
If moved is false, return {"moved":false} and nothing else.
````

---

## `charQuestText` — Character quest text (ask over phone)

Composes the text message a quest-holder sends the player about their ask — a first raise or a considered follow-up, never a 'you haven't answered' nag. Use {{user}}, {{char}}. Returns {message, why}.

| | |
|---|---|
| **Fires** | logged as `Char quest (text) ·` |
| **Runs on** | `state.gmModel` · bucket `gm` · temp `fnTemp("gm",0.8)` · max `fnTok("gm",220)` |
| **Placeholders** | declared: `{{char}}`, `{{user}}`<br>supplied: `char`, `user` |
| **Sections** | `data` |
| **Returns** | `message`, `why` |
| **Size** | 889 characters |

````text
You write ONE phone text message {{char}} sends {{user}}, in {{char}}'s own texting voice, about {{char}}'s OWN pursuit — they need something from {{user}}. The quest, the ask, and whether this is a first raise or a follow-up arrive in the user turn.

RULES
- It reads like a real text: their voice and language, natural length (1-3 short sentences), typed words only — no narration, no asterisks.
- FIRST ask: raise it naturally — enough context to make sense, no essay; they can explain more when {{user}} replies.
- FOLLOW-UP (they asked before): a considered, in-character next move — NEVER a "why haven't you answered" nag. They move the matter forward: add a reason, sweeten the offer, adjust the plan, or gracefully give it one last try.
- If a time or place is part of the ask, name it.

Return ONLY JSON: {"message":"<the text message>","why":"<3-6 words: the impulse behind it>"}
````

---

## `x_char_quest_reconcile` — Quest reconciler (asks made of you)

At day's end, decides what happened to the personal favours characters asked of {{user}}.

| | |
|---|---|
| **Fires** | logged as `Char quest reconcile` |
| **Runs on** | `state.memModel` · bucket `mem` · temp `fnTemp("mem",0.2)` · max `fnTok("mem",480)` |
| **Placeholders** | declared: `{{user}}`<br>supplied: `user` |
| **Sections** | `data` |
| **Returns** | `id`, `done`, `failed`, `answered`, `result`, `progress` |
| **Size** | 1016 characters |

````text
You judge the day's progress on characters' PERSONAL quests that involve the player ({{user}}), using ONLY the memories as evidence. Each quest below has been ASKED of the player (in person or by text). For each quest decide:
- "done": true ONLY if the memories clearly show the ask was fulfilled / the pursuit succeeded today.
- "failed": true ONLY if the memories clearly show the player REFUSED definitively or the pursuit is now lost.
- "answered": true if the player meaningfully ENGAGED with the ask today (agreed, bargained, asked questions, said later) — even without finishing it.
- otherwise, if something relevant happened, report it as "progress".
Never on a hunch; if unsure it stays pending.
Return ONLY a JSON array — one entry PER QUEST THAT CHANGED today, or [] if none:
[{"id":"<the quest id>","done":true|false,"failed":true|false,"answered":true|false,"result":"<if done/failed: ONE past-tense ENGLISH sentence of the outcome>","progress":"<if it merely moved: ONE past-tense ENGLISH sentence>"}]
````
