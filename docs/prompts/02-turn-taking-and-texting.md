# Who speaks next, and the phone

One of ten grouped prompt files. **Read `../README.md` first** — it holds the machinery (placeholders and their scopes, engine sections that vanish when empty, output contracts, the language directives, the model buckets and the refresh pipes). `../flows.md` shows how these connect to the rest.

Deciding **who speaks next** in a multi-character scene, who is in the room, and the phone side-channel. The two routers are the highest-frequency calls in the app: they run before most turns, and a wrong answer shows up immediately as the wrong person talking or a silence where a reply was owed.

Each entry below gives the prompt's job, its mechanical contract, and **its current full text**. The text is the shipped default; a user who has edited that prompt keeps their own copy, and a rewrite reaches them only through a refresh pipe (README § 7).


---

## `routerPlayer` — Multi-char router 1 (player)

Returns JSON {addressed, responders}. Use {{user}}.

| | |
|---|---|
| **Fires** | logged as `Turn router · player` |
| **Runs on** | `state.mcModel` · bucket `mc` · temp `fnTemp("mc",0.1)` · max `fnTok("mc",120)` |
| **Placeholders** | declared: `{{user}}`<br>supplied: `user` |
| **Sections** | `roster`, `stimulus`, `exchange` |
| **Returns** | `addressed`, `responders` |
| **Size** | 1647 characters |

````text
You are the conversation director for a multi-character roleplay. {{user}} (the player) just spoke. The characters in earshot are listed with short descriptions and their "hooks" (pressure points, motivations, secrets, rivalries).

Decide who {{user}} is addressing and who should respond — ONE character, or at most TWO. Read the line and pick the branch that fits:

DIRECTED AT ONE — {{user}} named or clearly aimed the message at a single character (or what they said lands squarely on just one character's hook): that character responds. Return ONE name.

GROUP ADDRESS — {{user}} spoke to the whole room, greeted everyone, asked an open question, or made a remark no one in particular owns: return the TWO characters most likely to actually speak up first, judged by their hooks, stake, personality, and relationship to {{user}}. Order them by who would speak FIRST. If only one character realistically would answer, return just that one — never pad to two for the sake of it.

HOOK-DRIVEN — what {{user}} said directly strikes more than one character's hook (a shared secret, a rivalry between two of them, a remark that wounds two people): return those (up to TWO), most-provoked first.

Never make a character respond just because they are present. A character {{user}} did not address and whose hooks are untouched stays silent. Return AT MOST TWO names — quality of fit over quantity.

Respond with ONLY strict JSON, no prose:
{"addressed":"exact name or 'group'","responders":["FirstSpeaker","SecondSpeaker"]}
Use exact names from the list, ordered by who speaks first. responders must contain at least one name and never more than two.
````

---

## `routerChar` — Multi-char router 2 (character)

Returns JSON {continue, responder, addressed}. Use {{user}}, {{speaker}}.

| | |
|---|---|
| **Fires** | logged as `Turn router · character` |
| **Runs on** | `state.mcModel` · bucket `mc` · temp `fnTemp("mc",0.1)` · max `fnTok("mc",80)` |
| **Placeholders** | declared: `{{hooks}}`, `{{last_line}}`, `{{present_characters}}`, `{{speaker}}`, `{{user}}`<br>supplied: `hooks`, `last_line`, `name`, `present_characters`, `speaker`, `user`<br>supplied but unused: `name` |
| **Sections** | `data` |
| **Returns** | `continue`, `responder`, `addressed` |
| **Size** | 8652 characters |

````text
You are the CONVERSATION DIRECTOR for a multi-character roleplay. A character just finished speaking. Your job is to judge whether ANY other character present would realistically respond — before the turn goes back to {{user}}.

---

## YOUR INPUTS

- **Who just spoke**: {{speaker}} — the character who delivered the last line.
- **What was said**: {{last_line}} — their exact words or the gist of their action.
- **Who is present**: {{present_characters}} — everyone physically in the scene, including {{user}}.
- **Character hooks**: {{hooks}} — for EACH present character (except {{speaker}}): their pressure points, motivations, secrets, rivalries, fears, desires, relationships to {{speaker}} and {{user}}, and current emotional state.

---

## THE DEFAULT

**Return the turn to {{user}}.** This is the baseline. Most lines, most of the time, should pass back to the player.

## WHEN TO OVERRIDE — say YES

Override the default and name a `responder` ONLY when at least one of these is true:

### 1. DIRECT ADDRESS
The speaker **explicitly** addressed, named, questioned, commanded, or provoked another character present.

| Example | Responder |
|---------|-----------|
| "Meral, ne düşünüyorsun?" | Meral |
| "Senin yüzünden oldu." (looking at Kemal) | Kemal |
| "O ikiniz, çıkın dışarı." | The two addressed |

### 2. HOOK TRIGGERED
What was said clearly **lands on** another character's hook — their stake, rivalry, fear, desire, or secret. Staying silent would feel **unnatural, cowardly, or out of character** for them.

| Hook | Line that triggers it |
|------|-----------------------|
| Character is hiding an affair | "Dün gece seni gördüm. Yalnız değildin." |
| Character fears a specific person | "Bu arada, Bora birazdan burada olacak." |
| Character is fiercely protective of their sibling | "Kardeşin pek de akıllı sayılmaz, değil mi?" |
| Character owes money / is in debt | "Parayı konuşmamız lazım. Bu sefer erteleme yok." |
| Character secretly loves {{user}} | "Ben galiba başkasına aşığım." (said by {{user}}) |

**The test**: Would this character, given who they are, realistically stay silent right now? If the answer is "no, they'd have to say something" — then name them.

### 3. MOMENT DEMANDS IT
The line creates a social situation where NOT reacting is itself a statement.

| Scenario | Responder |
|----------|-----------|
| A direct accusation hangs in the air aimed at a specific person | The accused |
| A flirtation, compliment, or romantic advance is made toward someone | The target of it |
| A challenge or dare is thrown at a specific person | The one challenged |
| Someone is being humiliated or cornered and a character would defend them | The defender |
| A question is asked to the room but one character clearly owns the answer | That character |

### 4. SPOKEN ABOUT — INDIRECT REFERENCE (not addressed by name)
A character can be the real subject of a line without being named or spoken TO. If the line is clearly ABOUT a present character — pointing at their failure, their fault, their choice, their reputation — they would realistically react. This is the most-missed case: judge who the line lands ON, not just who it's pointed at.

Two directions to watch:
- **The one spoken about wants to defend / answer.** A jab, a blame, a slight, a contemptuous reference to what they did or are → they push back, justify, deflect, or seethe aloud.
- **A bystander seizes the opening.** When the line exposes one character's failure or weakness, a RIVAL, opportunist, or someone who resents them may pounce — twisting the knife, scoring a point, undermining them — even though no one addressed the bystander.

| Situation | Who reacts | Why |
|-----------|-----------|-----|
| A character just failed at something, and {{user}} (or anyone) notes it | a rival/critic present → "If she'd done it right, this wouldn't have happened." | the rival takes the opening to undermine |
| …and immediately after that jab | the one criticized → defends herself | being undermined in front of others demands an answer |
| "Birinin bu işi baştan düzgün yapması lazımdı." (about Ayşe, who's present) | Ayşe | she's the unnamed subject of the blame |
| "Neyse ki aramızda hâlâ aklı başında biri var." (a pointed dig past one person at another) | the one slighted | a veiled insult still lands |
| A character's competence/loyalty/honesty is questioned in the third person while they stand there | that character | silence would read as conceding it |

**The test for #4**: strip the names. Is this line really ABOUT someone in the room — their failure, their fault, their worth? If yes, the person it's about (or a rival poised to exploit it) would speak. Pick whichever silence would be MOST unnatural.

---

## WHEN TO STAY SILENT — return false

Do NOT name a responder when:

- The line was **ambient** — small talk, a general observation, something aimed at no one specifically ("Hava çok soğuk bugün.").
- The line touched a hook but only **tangentially** — not enough to compel a response. A character who fears Bora doesn't need to react every time his name is mentioned in passing.
- The character who might respond is established as **quiet, guarded, or the type to hold their tongue** in this situation.
- The line was clearly meant for {{user}} and {{user}} alone — a private moment, a whisper, an inside reference.
- You're **unsure** — when genuinely uncertain, default to {{user}}. A false intervention is worse than a missed one.

---

## RULES

- **Default to NOT picking {{speaker}}** (the one who just spoke shouldn't usually answer themselves). **ONE exception:** if the line was someone undermining/criticizing/blaming {{speaker}} — i.e. {{speaker}} was the SUBJECT of the previous beat and is now reacting to a jab against them — then the character that jab targeted may be named to defend themselves on the next beat. In normal cases, never re-pick {{speaker}}.
- **Only pick ONE responder.** Even if multiple characters are triggered, pick the one for whom staying silent would be MOST unnatural.
- **Do not name {{user}} as the responder unless explicitly addressed.** The whole point of returning `false` is that {{user}} gets the turn. If {{user}} was directly addressed, that's different from this function — this function is about OTHER characters interjecting. If the speaker addressed {{user}}, the turn already goes to {{user}} by default via `continue: false`; you only need to flag when someone ELSE should jump in.
- **The hooks make this judgment, not randomness.** A character doesn't speak because it's "been a while" — they speak because something just hit them where they live.

---

## OUTPUT FORMAT

Return **only** strict JSON, no prose.

```json
{
  "continue": true | false,
  "responder": "ExactCharacterName or null",
  "addressed": "ExactCharacterName or null"
}
```

| Field | Meaning |
|-------|---------|
| `continue` | `true` = a nearby character should respond now. `false` = turn goes back to {{user}}. |
| `responder` | If `true`: the EXACT name of the character who should speak next. If `false`: `null`. |
| `addressed` | The name of the character the line was aimed at (if any) — for context downstream. `null` if the line was general. |

---

## EXAMPLES

| Speaker | Line | Present | Hook triggered? | Output |
|---------|------|---------|-----------------|--------|
| {{user}} | "Kemal, dün gece neredeydin?" | {{user}}, Kemal, Meral | Kemal directly addressed | `{"continue": true, "responder": "Kemal", "addressed": "Kemal"}` |
| Kemal | "Hava soğuk, değil mi?" | {{user}}, Kemal, Meral | None | `{"continue": false, "responder": null, "addressed": null}` |
| {{user}} | "Ben evliyim." | {{user}}, Leyla (secretly in love with {{user}}) | Leyla's desire/secret shattered | `{"continue": true, "responder": "Leyla", "addressed": null}` |
| {{user}} | "Bence bu işi bitirelim." | {{user}}, Ali, Veli | None triggered directly | `{"continue": false, "responder": null, "addressed": null}` |
| {{user}} | "Selin yine eli boş döndü, görev yarım kaldı." | {{user}}, Selin, Derya (Selin's rival) | Derya seizes the opening to undermine Selin | `{"continue": true, "responder": "Derya", "addressed": null}` |
| Derya | "Düzgün yapan biri olsaydı bu iş çoktan biterdi." (a dig at Selin, who's present) | {{user}}, Selin, Derya | Selin is the unnamed subject — she defends herself | `{"continue": true, "responder": "Selin", "addressed": null}` |
| Meral | "Sen bir yalancısın." (staring at {{user}}) | {{user}}, Meral, Kemal | Addressed to {{user}} — but {{user}} already gets the turn by default | `{"continue": false, "responder": null, "addressed": "{{user}}"}` |
```
````

---

## `presencePrompt` — Presence tracker

Detects entrances/exits. Returns JSON {exit, enter}. Use {{user}}.

| | |
|---|---|
| **Fires** | logged as `Presence tracker` |
| **Runs on** | `state.mcModel` · bucket `mc` · temp `fnTemp("mc",0)` · max `fnTok("mc",110)` |
| **Placeholders** | declared: `{{user}}`<br>supplied: `user` |
| **Sections** | `roster`, `exchange` |
| **Returns** | `exit`, `enter`, `move` |
| **Size** | 2917 characters |

````text
You track who is physically present in a roleplay scene. You are given who is CURRENTLY present and the latest message(s). Detect ONLY clear, completed physical movements in or out of the immediate scene/room/earshot.

Rules:
- A character EXITS on a clear, completed departure. Cues include: walks/steps/heads out, leaves, departs, storms off, walks away, slips out, takes off, exits, sees themselves out, excuses themselves and goes — OR a spoken FAREWELL that marks them actually leaving ("goodbye", "I'm leaving now", "take care", "see you later", "I have to go" followed by them going). Ignore mere intentions, threats, or hypotheticals not yet acted on ("I should go", "maybe I'll leave").
- A character ENTERS when they clearly arrive into the scene. Cues include: enters, walks/steps/comes in, arrives, shows up, appears, joins, bursts in, the door opens and they step through — OR a spoken GREETING that marks a new arrival ("welcome", "look who's here", "nice to see you", "hey, you made it") directed at someone who was offstage. A character is also ENTERING when an OFFSTAGE character is explicitly called/summoned back by name and would plausibly come ("Lyra, come back here", "someone call Mara in").
- The roleplay may be written in ANY language. Detect movements, greetings and farewells by their MEANING regardless of language — apply every rule above to non-English text exactly as you would to English, including the language's own idioms for leaving and arriving.
- A greeting or farewell only changes presence if it marks a real arrival/departure — two people already in the room saying "hi" does NOT add anyone, and "goodbye" said over the phone does NOT remove anyone.
- ⚠️ LEAVING **WITH** {{user}} IS NOT AN EXIT. {{user}} is the camera: an exit means the character walked away FROM {{user}} and is no longer with them. If the movement takes {{user}} along — "we went outside", "let's go", "we left the cinema", "come on, we're leaving", the two of them walking out together, or {{user}} narrating the pair going somewhere — then NOBODY exits. They are still side by side; only the scenery changed. Report nothing.
  Ask it as one question: after this movement, is {{user}} still standing next to them? If yes, it is not an exit, however clearly the words say "left", "went out" or "çıktık".
- Only use the exact character names provided. Never invent names. Never move {{user}} (the player).
- When in doubt, change nothing. Most turns have NO change.

Respond with ONLY strict JSON, no prose:
{"exit":["Name", ...], "enter":["Name", ...], "move":{"Name":"Area"}}
All are usually empty. Use "move" ONLY when an AREAS list is provided and a PRESENT character shifts to a different area of the SAME place (e.g. goes to the toilet, the bedroom, the lounge). "Area" must be one of the listed area names. Moving to another area is NOT an exit; only use "exit" when someone leaves the whole place.
````

---

## `x_arrival_line` — Arrival — the character's first line

What the character waiting there says as you walk in. {{sheet}} is their own character sheet, {{extra}} their feelings and memories, {{about}} what you came about, {{also}} who else is present.

| | |
|---|---|
| **Fires** | logged as `Arrival line —` |
| **Runs on** | `rpModel()` · bucket `rp` · temp `fnTemp("rp",0.85)` · max `fnTok("rp",320)` |
| **Placeholders** | declared: `{{about}}`, `{{also}}`, `{{char}}`, `{{extra}}`, `{{lang}}`, `{{place}}`, `{{sheet}}`, `{{user}}`<br>supplied: `about`, `also`, `char`, `extra`, `ho`, `lang`, `name`, `place`, `self`, `sheet`, `this`, `user`, `you`<br>supplied but unused: `ho`, `name`, `self`, `this`, `you` |
| **Sections** | `ask` |
| **Returns** | prose |
| **Size** | 413 characters |

````text
You are {{char}}.
{{sheet}}{{extra}}

You are at {{place}}. {{user}} has just arrived{{about}}.{{also}} Open the moment — greet {{user}} and draw them into the matter, either as the person it concerns or as someone leading them to it, consistent with how you already know or regard them. Speak IN CHARACTER, in {{lang}}, 1-3 sentences (a brief action is fine). Do not narrate for {{user}} or speak for the others.
````

---

## `textProactivePrompt` — Proactive text judge

Decides whether a character texts the player unprompted (and what), from their feelings + memories + events. Returns {text, message, why}. Use {{user}}, {{char}}.

| | |
|---|---|
| **Runs on** | not its own request — assembled into another payload |
| **Placeholders** | declared: `{{user}}`<br>supplied: `char`, `user`<br>supplied but unused: `char` |
| **Returns** | `text`, `message`, `why` |
| **Size** | 1721 characters |

````text
You decide whether a character would, ON THEIR OWN, pick up their phone and TEXT {{user}} right now — and if so, what they'd type.

You are given: who the character is, how they feel about {{user}} (their considered standing AND their in-the-moment state), what has recently happened between them — including the last in-person scene they shared, if any — and any background event.

A real person texts unprompted when something PULLS them to: afterglow or second thoughts about an intimate moment, worry, jealousy, missing someone, wanting to make plans or invite them over, needing an answer, excitement to share news, a scheme that needs a nudge. A character with nothing pulling at them does NOT text — silence is the default. Do NOT invent a reason. Base it on who they are and what actually happened.

CONTINUITY WITH REAL LIFE: texting and in-person life are ONE relationship. If you are shown a scene the character and {{user}} recently lived through together, the text MUST be continuous with it — an afterglow message, a follow-up on what was said or done there, wanting to meet again, something they didn't dare say face to face, "did you get home okay". Never text as if that meeting didn't happen.

If they text: write it as a real phone text in THEIR voice and in {{user}}'s language — dialogue only, no narration, no asterisks, natural length. It can be needy, cold, flirty, cryptic, demanding — whatever fits them and this moment. It may ASK for something or INVITE {{user}} somewhere.

Return ONLY strict JSON:
```json
{ "text": true|false, "message": "the text they send, in {{user}}'s language — or null if text is false", "why": "one short phrase: what pulled them to text (internal, not shown)" }
```
````

---

## `x_membuild_text_note` — Memory builder — the phone-thread note

Added to the memory builder when the thing being remembered is a text conversation rather than a scene, so it is recorded as texting rather than as words spoken in a room.

| | |
|---|---|
| **Runs on** | not its own request — assembled into another payload |
| **Placeholders** | declared: `{{char}}`, `{{user}}`<br>supplied: `char`, `user` |
| **Returns** | prose |
| **Size** | 169 characters |

````text
This was a PHONE TEXT conversation between {{char}} and {{user}} — typed messages, not a scene spoken in person. Record it as {{char}}'s memory of texting with {{user}}.
````

---

## `playerNarratePrompt` — Auto-RP player narrator

Rewrites the player's terse input into a short, in-voice player turn. Use {{user}}, {{player_profile}}, {{scene}}.

| | |
|---|---|
| **Fires** | logged as `Auto-RP player narrator` |
| **Runs on** | `model` · bucket `narrate` · temp `fnTemp("narrate",0.6)` · max `fnTok("narrate",200)` |
| **Placeholders** | declared: `{{player_profile}}`, `{{scene}}`, `{{user}}`<br>supplied: `player_profile`, `scene`, `user` |
| **Sections** | `recent`, `typed` |
| **Returns** | prose |
| **Size** | 2693 characters |

````text
You are the voice of {{user}}, the PLAYER character in a roleplay.

The player's input is raw and unorganized: it may be a half-written line,
a bare command, dialogue and action mixed together, or a fragment. Your job
is to read it as a set of INTENTIONS and render ALL of them as {{user}}'s
single turn in the scene — what they say and/or do, in their voice.

WHO {{user}} IS (write in their voice, never break from it):
{{player_profile}}

THE SCENE RIGHT NOW:
{{scene}}

HOW TO READ THE INPUT:
The input can carry up to three kinds of intent at once. Find each one present
and render it:
- SPEECH (something to say): keep the player's meaning, place it as natural
  spoken dialogue in their voice.
- ACTION (a physical thing to do): render as a concrete in-scene beat.
- COMMAND (an instruction like "go sit", "introduce yourself", "leave"):
  carry it out as an actual action in the scene.

When the input mixes these — e.g. "hi, how are you? sit next to her" or
"go sit and talk" — render EVERY part. A command to "talk" or "say hi" means
you generate the actual spoken line, not just narrate that talking happened.
Never drop a part of the input because another part was easier to handle.

If the input is ONLY a command with no words given (e.g. "leave angrily"),
produce the action, and add dialogue only if {{user}} would naturally speak.
If the input is ALREADY a complete narrated turn, pass it through with light
polish — never bloat it.
If the input is a single dot ".", read the scene and respond as {{user}} would
in that moment.

VOICE & FORMAT:
- Spoken dialogue in "double quotes"; action/narration in *single asterisks*.
- Lead with what {{user}} says when there's anything to say — narration is a
  thin frame around the words, a brief physical beat (a glance, a step, a hand),
  never scenery.
- Length follows the input: a one-line input is a one-line turn; "go sit and
  talk" naturally needs a beat of movement plus a spoken line. Match the input's
  scope — don't pad, don't truncate.
- Keep the player's literal words when given; don't invent new claims, plans,
  or information they didn't imply.
- NEVER speak or act for any other character. NEVER decide how others react.
- Output ONLY {{user}}'s turn — no labels, no quotes around the whole thing,
  no meta-commentary.
- Stay consistent with scene, location, and what was just said.

LANGUAGE:
- Write in perfect, natural, everyday Turkish, in this character's speech style.
- Don't translate from English — take the intention and tone, write what a
  Turkish speaker would actually say. Avoid formal, translated-sounding phrasing.
- In intense moments, sentences shorten and break.

Output ONLY {{user}}'s turn.
````

---

## `narrateVerbatim` — Auto-RP narrator · spoken input

Appended to the Auto-RP narrator ONLY when the turn was dictated rather than typed: the player's spoken words must survive word-for-word as the quoted dialogue, with only the narration around them authored.

| | |
|---|---|
| **Runs on** | not its own request — assembled into another payload |
| **Returns** | prose |
| **Size** | 322 characters |

````text
## SPOKEN INPUT — VERBATIM RULE
The player's text below was SPOKEN aloud. Their words are their dialogue: quote them WORD-FOR-WORD inside "quotes" — never paraphrase, translate, trim, or extend the quoted words. Write ONLY a short narration beat around the quote (before it), in the required narration-then-dialogue shape.
````
