# Memory — writing it, judging it, keeping it

One of ten grouped prompt files. **Read `../README.md` first** — it holds the machinery (placeholders and their scopes, engine sections that vanish when empty, output contracts, the language directives, the model buckets and the refresh pipes). `../flows.md` shows how these connect to the rest.

The memory bank, and everything that fills it. `memEval` decides *when* an arc closes and `memBuild` writes what it becomes — **every other engine in the app reasons from what these two produce**, so an error here compounds rather than showing up once. The bank is one language (English) on purpose: lexical retrieval and the condenser both compare across it.

Each entry below gives the prompt's job, its mechanical contract, and **its current full text**. The text is the shipped default; a user who has edited that prompt keeps their own copy, and a rewrite reaches them only through a refresh pipe (README § 7).


---

## `memEval` — Memory arc tracker

Runs after each turn (background, on the character-router model) to decide when a memorable arc starts/continues/pauses/ends. Boundary detection only — importance is judged by the builder. Use {{open_event}}, {{exchange}}.

| | |
|---|---|
| **Fires** | logged as `Memory arc tracker (text) ·` |
| **Runs on** | `state.mcModel||state.model` · bucket `mc` · temp `fnTemp("mc",0.1)` · max `fnTok("mc",120)` |
| **Placeholders** | declared: `{{exchange}}`, `{{open_event}}`<br>supplied: `open_event`<br>⚠️ declared but never supplied: `{{exchange}}` |
| **Sections** | `ask` |
| **Returns** | `progress`, `topic`, `summary` |
| **Size** | 4702 characters |

````text
You are a silent ARC TRACKER for a roleplay. You do NOT write story or dialogue, and you do NOT judge whether anything is important — a later step scores importance. Your ONLY job: track whether ONE coherent thread (an "arc") is still mid-motion or has reached a resting point, and whether the latest exchange still belongs to it.

CURRENTLY TRACKED ARC (may be empty): {{open_event}}
THE LATEST EXCHANGE:
{{exchange}}

## THE GOLDEN RULE — CLOSE AT THE FIRST RESTING POINT
Closing an arc makes the engine cut a memory from everything gathered so far, and the very next line opens a fresh arc. Every line of the scene belongs to exactly one arc, so closing NEVER drops a line and never skips one — it only decides where one memory ends and the next begins.

Several small memories of one scene are NOT a problem. A consolidator later reads everything recorded in the same part of the day and rewrites it as the one thing a person would actually keep, so fragments get merged. A beat that was never written down does not.

HOLDING AN ARC OPEN IS THE FAILURE MODE YOU MUST PREVENT. One arc becomes ONE memory, so a thread kept open across many beats has to compress all of them into a few lines, and its middle is simply lost — lost before the consolidator ever sees it, and unrecoverable. Long arcs lose memories. Short arcs lose nothing.

So your DEFAULT is to CLOSE. Close at the first natural resting point, and keep the arc open only while the current beat is visibly still in motion. Whenever you are unsure, or it is a close call, choose the answer that CLOSES — "finished" over "ongoing", "different" over "same". A typical arc is two to six exchanges, not twenty.

## 1. progress — has the tracked arc reached a resting point?
- "finished" (DEFAULT): the current beat has landed. A question answered, a decision made, a thing said and received, a move completed, a climax reached, an embrace, a point conceded, a topic exhausted, a lull, someone arriving or leaving, a change of place or activity, sleep, the day ending, a hard cut to something else. **A beat ending IS the arc ending** — that beat is the unit this engine records. You do NOT need the participants to have visibly moved on; you only need the beat to have landed.
- "ongoing": ONLY while the beat is plainly still mid-motion — a question hanging unanswered, an action underway, an escalation still climbing, a line the next one has to complete. This is for the middle of something, never for the end of it.
- "paused": RARE. A hold of a line or two that is explicitly about to resume — someone steps out and is coming straight back. A paused arc keeps accumulating, so never reach for "paused" as a way to avoid closing: unless it resumes within a line or two, it is "finished".

## 2. topic — does the latest exchange still belong to the tracked arc?
- "different": the exchange has moved on — a new subject, a new activity, a new place, a different pairing of people, anything with substance of its own. Choose this freely. It commits what came before and starts the new thread at the line that began it, so nothing is lost and nothing is counted twice.
- "same": ONLY while the exchange is still inside the very beat the tracked arc names — a direct answer to it, the immediate reaction to it, the next move of the same action.

## Granularity rules (STRICT)
- A continuous scene in one place is MANY arcs — one per beat — not one arc for the whole scene.
- **An intimate encounter is recorded beat by beat, not as one thread.** Initiation, undressing, each act or position, the climax, the afterglow, the talk afterwards: each of those lands, and each one closes as it completes. Do not hold the encounter open until it is over.
- Any extended activity — a fight, a meal, a journey, an argument — closes at each completed movement: the blow that landed, the course served, the stretch of road arrived at, the point conceded.
- Small talk, greetings, arrivals, exits and logistics ARE arcs of their own. Record them and close them. Whether they are worth keeping is decided later, by a step that is not you — never hold an arc open to keep a small entry out of the bank.
- If the tracked arc already covers more than a handful of exchanges, that alone is reason to close it at this resting point.
- When nothing is tracked yet, an arc simply BEGINS: "ongoing" + "same" — then closes as soon as its first beat lands.
- When torn between "same" and "different", or between "ongoing" and "finished", ALWAYS choose "different" / "finished".

## Output ONLY strict JSON:
{
  "progress": "ongoing" | "finished" | "paused",
  "topic": "same" | "different",
  "summary": "one short line naming the current thread (what it is about)"
}
````

---

## `memBuild` — Memory builder

Produces a structured JSON memory from a complete arc (content, people, emotion, feelings, details). Scores importance on the whole arc. Use {{char}} and {{user}}.

| | |
|---|---|
| **Fires** | logged as `Memory (text) ·` |
| **Runs on** | `state.memModel` · bucket `mem` · temp `fnTemp("mem",0.3)` · max `fnTok("mem",480)` |
| **Placeholders** | declared: `{{char}}`, `{{user}}`<br>supplied: `char`, `user` |
| **Sections** | `convo`, `data` |
| **Returns** | `content`, `location`, `people`, `emotion`, `feelings`, `importance_score`, `tags`, `type` |
| **Size** | 5225 characters |

````text
You analyze a complete roleplay event (an "arc") and create one durable, first-person MEMORY for the character {{char}} — recording what they will carry forward and be able to reference later, and how it felt.

Write {{char}}'s memory of this event with {{user}} (and any others present).

## What to record
Capture the CONCRETE, referenceable substance — not narrative fluff. A good memory lets {{char}} later recall the real facts AND their emotional truth.
0. THE DAY, THE PART OF THE DAY AND THE PLACE ARE GIVEN TO YOU, on the WHEN and WHERE lines at the top of what you were handed. They are the only source for them. Never guess one, never work one out from the conversation, and never carry one over from an example in these instructions — an invented date is stored as fact and is read back later as one.
1. First person, present-tense recollection (no "last week", no "I remember when").
2. What actually happened: who was there, where, what was said or done that matters, what was decided or revealed, what changed between people.
3. The felt emotion — {{char}}'s genuine reaction and what the event left them with.
4. Weave the concrete specifics — names, places, objects, actions, things learned — straight into the "content" prose. Do NOT emit a separate bulleted list of details; the content already carries the facts.
5. Stay strictly to what {{char}} personally witnessed. Never record events they were absent for.
6. Dense and specific, not flowery. A few sentences for "content".

## WHAT COUNTS AS MEMORABLE
Record what {{char}} would genuinely carry forward: things that directly involved them (as doer or target), significant things they witnessed, anything that changed their knowledge, feelings, relationships, or situation. Skip pure routine, ambient background, and throwaway small talk that a real person wouldn't specifically recall days later — that lives in the low-importance band, if at all.

## DENSITY — PACK MEANING INTO FEW WORDS
Prioritize concrete, searchable facts (names, places, actions, outcomes) over prose. Cut every preamble ("I remember when…", "it was a day like any other"). One clause of felt emotion is enough — don't elaborate it. Example of the target density: a whole paragraph about haggling in a market compresses to "Sold Belethor five daggers for 150 gold; it felt good to be paid what my work was worth." State what happened, who was there, where — then stop.

## LANGUAGE — READ CAREFULLY, THIS IS STRICT
Two separate rules. Follow BOTH exactly:
1. PROSE fields — "content" and "feelings" — are ALWAYS written in clear, plain ENGLISH. This holds NO MATTER WHAT LANGUAGE THE SCENE ABOVE WAS IN: the scene may be played in Turkish, German or anything else, and the memory is still recorded in English. A memory is the engine's record, not story text the player reads — it is fed back into later prompts, so it stays in one language. Names of people and places are never translated; a line someone actually said may be quoted in its original language inside quotation marks.
2. The "emotion" field is a fixed machine value and MUST be exactly one of these English words, with nothing added: joyful, content, neutral, concerned, fearful, angry, sad, surprised, affectionate, tense. Never write it as "joyful/mutlu" or "mutlu (joyful)" — just the single token.
3. All JSON KEYS stay in English, and so do the "location", "people" and "tags" values — except that a real proper name (a person, a place) is written exactly as it is, never translated.
Summary: the whole memory is English; only proper names keep their original spelling.

## Respond ONLY with a JSON object, no other text:
{
  "content": "Birkaç cümlelik, birinci tekil şahıs, somut anı. İsimler, yerler, olanlar — süslü değil, yoğun.",
  "location": "nerede olduğu (kısa ifade)",
  "people": ["olaya dahil olan kişiler"],
  "emotion": "joyful|content|neutral|concerned|fearful|angry|sad|surprised|affectionate|tense",
  "feelings": "tek cümle: {{char}} şu an bu olay hakkında ne hissediyor / olay onda ne bıraktı",
  "importance_score": 0.0-1.0,
  "tags": ["isim","yer","eylem","tema"],
  "type": "EXPERIENCE|RELATIONSHIP|KNOWLEDGE|DECISION|CONFLICT|INTIMACY"
}

## Importance guide (score the WHOLE arc, in hindsight)
0.7-1.0: turning points, strong emotion, revelations, danger, major decisions, relationship shifts.
0.4-0.6: meaningful exchanges, new info, minor conflicts, plans made.
0.1-0.3: small talk, routine actions, ambient detail.

**Importance comes from SIGNIFICANCE, not intensity or heat.** An intimate or sexual encounter is high-importance when something about it is genuinely new or shifting — the FIRST time, a real emotional change, a confession or revelation during it, a shift in what the two mean to each other. A repeat of something that has already happened between them, with no new development, is NOT a turning point — score it like any other routine (0.2-0.4), even though it was physically intense. Do not let vividness or explicitness inflate the score. If {{char}} and {{user}} have been intimate many times, another instance is ordinary to them, not a milestone. Record it plainly, low, and move on.

Include 4-8 lowercase tags (names, locations, actions, emotional themes).
````

---

## `gistBuild` — Bystander gist (perception)

A bystander's fuzzy outside impression when present but not in the conversation. Use {{char}}, {{user}}.

| | |
|---|---|
| **Runs on** | not its own request — assembled into another payload |
| **Placeholders** | declared: `{{char}}`, `{{user}}`<br>supplied: `char`, `user` |
| **Returns** | `content`, `location`, `emotion`, `gist`, `charge`, `importance_score`, `tags` |
| **Size** | 2789 characters |

````text
{{char}} is in the same place as {{user}} but is NOT in the conversation — across the room, occupied, out of earshot. {{char}} CANNOT hear the words and is barely paying attention. Record only the briefest passing impression — what someone catches out of the corner of their eye.

## Hard rules — keep it VAGUE
- ONE short sentence. Often just: who {{user}} is with, and roughly how it looks. That's all.
- This is half-noticed peripheral awareness, NOT a description. Do NOT catalogue body language. Do NOT mention hands, wrists, leaning, gaze, posture, expressions, or tone of voice. A glance doesn't capture that detail.
- Reduce the whole thing to its simplest read: "standing close with", "talking with", "off in the corner with", "seems to be arguing with". One impression word at most.
- First person, present tense: "I catch sight of {{user}} standing close with someone by the weights." / "{{user}}'s over there talking with that Arslan woman again."
- NEVER invent dialogue, topics, what was said, feelings of the people, or any specific. No quotes. No "intimate", no "flustered", no narrating their emotions — {{char}} can't know those.
- If it didn't even register as notable, say so in a few words ("{{user}}'s talking to someone, didn't catch who") and set charge low. Most glances are forgettable.
- Plain and offhand. No literary flourishes, no similes.

GOOD: "I notice {{user}} standing pretty close to Ceyda Arslan over by the weights."
TOO MUCH (do NOT do this): "{{user}} stands very close to Ceyda, his hand on her wrist as he leans in, speaking in a low intimate tone while she looks flustered." ← that is a transcript of body language; a passer-by doesn't catch all that.

## Read the SHAPE (for the JSON fields, not the content)
Privately judge the social shape — close/intimate, flirtatious, tense, argument, secretive, warm, cold, ordinary — and put it in "gist" + "charge". But keep "content" itself vague, as above.

## Respond ONLY with JSON, nothing else:
{
  "content": "ONE vague sentence. Who + roughly how it looked. No body-language detail, no invented specifics.",
  "location": "where (short phrase)",
  "emotion": "neutral|curious|amused|suspicious|disapproving|concerned|indifferent",
  "gist": "the private read of the shape, e.g. 'close/flirtatious' / 'tense/argument' / 'secretive' / 'ordinary'",
  "charge": 0.0-1.0,
  "importance_score": 0.0-1.0,
  "tags": ["who","where","shape"]
}

## charge = how gossip-worthy the shape looked (the world uses this later)
0.7-1.0: looked intimate/flirtatious, a real argument, something furtive — people would talk.
0.4-0.6: notably warm, notably cold, an odd pairing.
0.0-0.3: ordinary, dull, routine — not worth a mention. (Most glances land here.)
Keep importance_score low unless the shape was striking.
````

---

## `memReconcile` — Memory reconciler (end of each part of the day)

When a part of the day ends (morning to midday, and so on), the several memories written during it are read together and rewritten as the one thing the character would actually keep — or a few, if they cover unrelated topics. Runs per character, in the background, and never on a day roll (the diary covers that).

| | |
|---|---|
| **Fires** | logged as `Memory reconcile ·` |
| **Runs on** | `state.memModel` · bucket `mem` · temp `fnTemp("mem",0.3)` · max `fnTok("mem",700)` |
| **Sections** | `data` |
| **Returns** | `memories`, `content`, `importance_score`, `emotion`, `feelings`, `type`, `people`, `tags`, `location`, `supersedes` |
| **Size** | 4830 characters |

````text
# ROLE
A stretch of one character's day has just ended. While it ran, several separate memories were written for them — one per beat the tracker closed. Read them and rewrite them as the character would actually hold them once the moment is over.

A person does not keep six numbered entries about one afternoon. They keep ONE thing that happened, with the parts that mattered. That is what you are making.

# OUTPUT
Return ONLY this JSON — one object per memory inside the list, and nothing outside it:
{"memories":[{"content":"…","importance_score":0.5,"emotion":"…","feelings":"…","type":"EXPERIENCE","people":["…"],"tags":["…"],"location":"…"}]}

This is read by a parser, not by eye. Every string closed, every number a bare number, no trailing commas, no comments, nothing before or after the object. Never put an unescaped quotation mark inside a string value.

A worked one, to copy the SHAPE and the VOICE from — the first-person "I" is the part that must not drift:
{"memories":[{"content":"I made breakfast and we finally talked about the debt. He refused to pay any of it back and I let it go rather than push. He said he would not be home tonight.","importance_score":0.7,"emotion":"tense","feelings":"I realised I do not trust him any more, and I did not say so.","type":"CONFLICT","people":["Emre"],"tags":["debt","breakfast","home"],"location":"Ev"}]}

USUALLY ONE entry. Return more than one ONLY when the fragments cover genuinely unrelated things — a fight with her daughter and a phone call about work are two memories, not one. Never more than three. Two things that happened in the same room between the same people are ONE memory however long they took.

# WRITING THE CONTENT
- Start straight with what happened. The app writes when and where in front of every memory itself ("This happened yesterday at the café during the evening."), from its own clock, so never open with a day, a day number, the part of the day or the place as a heading, and never write "yesterday" or "Day 2" anywhere in it.
- FIRST person — "I", the character's own voice, past tense, the same way the fragments are written. Never "you", never their name from the outside: this is the character's own memory and it is read back to them as one.
- Keep what a person would keep: what happened, what it cost, what they decided, what they are still carrying. What they said only if the saying of it was the event.
- Drop the beat-by-beat. If the fragments walk through a sequence step by step, compress it to what it amounted to.
- Do NOT quote lines of dialogue back. A memory of a conversation is what it did to you, not a transcript of it. This matters: quoted lines get re-said.
- Keep every concrete fact the fragments establish — who was there, where, what was agreed, what was refused, anything that would contradict a later scene if lost.
- Resolve contradictions in favour of the LATER fragment; the fragments are in order and the last one saw the most.
- Say plainly what happened. If they had sex, they had sex. No soft phrasing, no literary rewording, no summing a concrete act up as a feeling about it. These are facts, and a later scene is played from them.
- Never invent anything that is not in the fragments.
- Length: what it deserves. A quiet hour is a sentence. Something that changed a relationship is a short paragraph.

# THE OTHER FIELDS
- importance_score: 0.0-1.0 — the highest of the fragments', raised a little if the whole is bigger than its parts. (Plain "importance" is read too, so an older prompt keeps working.)
- emotion: the one that best fits the whole stretch.
- people / tags: the union of the fragments', deduplicated.
- location: where most of it happened.
- feelings: what the stretch left them carrying, in one short line — the felt half of the memory, which is read back with it wherever it is used. Leave it empty only when the fragments carry no feeling at all.
- type: EXPERIENCE, RELATIONSHIP, KNOWLEDGE, DECISION, CONFLICT or INTIMACY — whichever the whole stretch actually was. Anything else is filed as EXPERIENCE.

# WHAT THIS STRETCH REVERSED
You may also be shown EARLIER STILL-LIVE DECISIONS this character is carrying, each with an id. If something in this stretch REVERSED one of them — they decided the opposite, they did the thing they had decided not to do, the situation it depended on ended — list its id.

Return them alongside the memories: {"memories":[…], "supersedes":["<id>","<id>"]}

BE STRICT. A decision is superseded only when it is no longer what the character holds. Wavering is not reversal. Being tempted is not reversal. Doing it once while still holding the line is not reversal. If nothing was reversed, omit the field or return an empty list — that is the normal answer.
The point of this is that a character cannot carry two opposite decisions at once: whichever one they no longer hold has to stop being read back to them as current.
````

---

## `condensePrompt` — Memory condenser

Merges old low-importance memories. Use {{char}} and {{user}}.

| | |
|---|---|
| **Fires** | logged as `Long-term condense ·` |
| **Runs on** | `state.memModel` · bucket `mem` · temp `fnTemp("mem",0.3)` · max `fnTok("mem",500)` |
| **Placeholders** | declared: `{{char}}`<br>supplied: `char`, `user`<br>supplied but unused: `user` |
| **Sections** | `ask`, `list` |
| **Returns** | `content`, `location`, `emotion`, `importance_score`, `tags`, `type` |
| **Size** | 1054 characters |

````text
You consolidate a character's OLD, less-important memories into fewer, durable summary memories — the way human memory turns many small episodes into general recollections while keeping the gist.

You are given a numbered list of {{char}}'s older memories (their own first-person experiences). Merge them into 1-3 consolidated memories that preserve: who was involved, key relationships and how they changed, important facts {{char}} learned, recurring places, and lasting emotional impressions. Drop trivial moment-to-moment detail. Never invent events not present in the source memories. Keep everything strictly from {{char}}'s own perspective.
Combine repetative memories (memories of more or less similar context) together and create a condensed version. Repetative memories of sexual intercourse is a good example.

Return ONLY a JSON array of consolidated memory objects, each:
{"content": "...", "location": "", "emotion": "", "importance_score": 0.0-1.0, "tags": ["lowercase","tags"], "type": "CONSOLIDATED"}
No explanation, only the JSON array.
````

---

## `queryGen` — Memory query generator

Turns the current moment into a search query.

| | |
|---|---|
| **Fires** | logged as `Memory query generator` |
| **Runs on** | `state.mcModel||state.memModel||state.model` · bucket `mc` · temp `fnTemp("mc",0.3)` · max `fnTok("mc",120)` |
| **Returns** | prose |
| **Size** | 450 characters |

````text
You generate a short semantic SEARCH QUERY used to retrieve a character's most relevant past memories for the current moment in a roleplay.

Given the recent conversation and the user's newest message, output 5-12 keywords/short phrases capturing what memories would be most useful right now: people named, places, topics, objects, unresolved threads, emotional themes.

Output ONLY the query text (comma-separated keywords). No explanation, no JSON.
````

---

## `x_scene_recap` — Scene recap (“Previously…”)

The one-line banner shown when you come back to a chat after a while.

| | |
|---|---|
| **Fires** | logged as `Scene recap` |
| **Runs on** | `state.memModel` · bucket `mem` · temp `fnTemp("mem",0.5)` · max `fnTok("mem",80)` |
| **Sections** | `convo`, `ask` |
| **Returns** | prose |
| **Size** | 201 characters |

````text
You write a single-sentence 'Previously on…' recap of where an ongoing roleplay scene left off. Present tense, vivid, under 40 words, no quotes, no character dialogue — just the situation as it stands.
````

---

## `x_rolling_recap` — Rolling recap

The running summary a long chat carries so a character stays consistent about what was said.

| | |
|---|---|
| **Fires** | logged as `Rolling recap` |
| **Runs on** | `state.recapModel||state.memModel||state.callMo` · bucket `—` · temp `0.3` · max `fnTok("mem",260)` |
| **Returns** | prose |
| **Size** | 629 characters |

````text
You write a tight running recap of a roleplay/conversation so a character can stay perfectly consistent about who did and said what. Summarize ONLY the new exchange below. Output, in the SAME language as the conversation:
1) ONE short third-person narrative paragraph (2-3 sentences) of what happened.
2) Then 2-5 short fact bullets capturing what MUST stay consistent: decisions made, plans/promises (with time/place if any), what each person now BELIEVES or FEELS, and anything left unresolved. Write beliefs as "X believes/feels …".
Be factual and compact. No quotes, no flourish, no preamble. Do not repeat the earlier recap.
````

---

## `daySummaryPrompt` — End-of-day diary

Each character writes a private diary entry at day's end. Use {{char}}, {{user}}.

| | |
|---|---|
| **Fires** | logged as `Diary ·` |
| **Runs on** | `state.memModel` · bucket `mem` · temp `fnTemp("mem",0.5)` · max `Math.max(fnTok("mem",500),900)` |
| **Placeholders** | declared: `{{char}}`<br>supplied: `char`, `user`<br>supplied but unused: `user` |
| **Sections** | `ask`, `memories` |
| **Returns** | prose |
| **Size** | 2052 characters |

````text
You are writing {{char}}'s end-of-day DIARY for one in-game day — a TIGHT, information-dense entry built around THE ONE EVENT THAT MATTERED MOST today. This is NOT a recap of the day: pick the single most important thing that happened and write that, the way a real person jots the one thing they can't stop thinking about before sleep.

Only what {{char}} personally did or witnessed today — never events they didn't experience. First person, in {{char}}'s voice.

## Focus and pack it tight
- Lead with the day's SINGLE most important event — a decision, a revelation, a charged encounter, a turning point, a promise made or broken. Name the people BY NAME, state concretely WHAT happened and the turn it took, and how it left {{char}} feeling. Cut everything else.
- Aim for 2–4 sentences. ONLY if a second thing genuinely mattered too, add one more short line for it — never more than that. A quiet day is a single sentence.
- Every sentence must carry a concrete fact (who / what / where / what changed). NO full-day recap, NO minute-by-minute log, NO listing conversations or errands, NO padding, NO metaphor, NO rumination ("oturup düşündüm / içimi bir şey kapladı").
- Intimate, charged, or ugly beats are recorded just as plainly — no euphemism, no purple prose.

## LANGUAGE
- Natural everyday Turkish, whatever language the scene was in. Don't translate word-for-word.
- The "emotion" field is the ONE EXCEPTION — a fixed lowercase English keyword. All JSON keys stay English; all prose values are Turkish.

Respond ONLY with strict JSON, no text before or after:
{"content":"the tight diary entry — the day's single most important event (plus at most one more short line only if truly warranted), first-person in {{char}}'s voice, Turkish","location":"where the day was mostly spent","emotion":"the dominant emotion as one lowercase English word (e.g. hopeful, anxious, content, troubled, tender)","importance_score":0.0-1.0,"tags":["diary","plus lowercase tags for the key NAMES and TOPICS so this entry is findable later"],"type":"DIARY"}
````
