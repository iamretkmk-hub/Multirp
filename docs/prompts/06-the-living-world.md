# The living world — what happens while you are elsewhere

One of ten grouped prompt files. **Read `../README.md` first** — it holds the machinery (placeholders and their scopes, engine sections that vanish when empty, output contracts, the language directives, the model buckets and the refresh pipes). `../flows.md` shows how these connect to the rest.

What happens while the player is somewhere else. These run at day's end and their results are what the player finds waiting the next morning. Most of them plant memories into the same bank the reply engines read, which is why they share its emotion vocabulary and its language.

Each entry below gives the prompt's job, its mechanical contract, and **its current full text**. The text is the shipped default; a user who has edited that prompt keeps their own copy, and a rewrite reaches them only through a refresh pipe (README § 7).


---

## `offstageEvent` — Offstage interaction (world pulse)

Judges whether two co-located OFFSTAGE characters interact right now (charged or casual) and, if so, writes the event — optionally moving both to a chosen venue, where the engine physically places them. Placeholders: a, b, a_sheet, b_sheet, a_to_b, b_to_a, a_wants, b_wants, a_knows, b_knows, place, places, day, period, user, world. Returns JSON {happened, kind, headline, event, venue, memories[], rel[], severity}.

| | |
|---|---|
| **Fires** | logged as `World pulse (offstage interaction)` |
| **Runs on** | `state.memModel` · bucket `mem` · temp `fnTemp("mem",0.7)` · max `fnTok("mem",900)` |
| **Placeholders** | declared: `{{a}}`, `{{a_knows}}`, `{{a_sheet}}`, `{{a_to_b}}`, `{{a_wants}}`, `{{b}}`, `{{b_knows}}`, `{{b_sheet}}`, `{{b_to_a}}`, `{{b_wants}}`, `{{day}}`, `{{period}}`, `{{place}}`, `{{places}}`, `{{user}}`, `{{world}}`<br>supplied: `a`, `a_knows`, `a_sheet`, `a_to_b`, `a_wants`, `b`, `b_knows`, `b_sheet`, `b_to_a`, `b_wants`, `day`, `period`, `places`, `user`, `world`<br>⚠️ declared but never supplied: `{{place}}` |
| **Sections** | `promises`, `ask` |
| **Returns** | `happened`, `kind`, `headline`, `event`, `venue`, `memories`, `name`, `content`, `emotion`, `importance`, `rel`, `from`, `to`, `trust` |
| **Size** | 3869 characters |

````text
You direct the OFFSTAGE life of a roleplay world as the day unfolds. Two characters are currently at the same place, away from the player ({{user}}). Decide whether an interaction happens between them RIGHT NOW — and if it does, write it.

WORLD: {{world}}
NOW: Day {{day}}, {{period}}. PLACE: {{place}} (the player is NOT here).
KNOWN PLACES in this world: {{places}}

A — {{a}}:
{{a_sheet}}
How {{a}} feels about {{b}}: {{a_to_b}}
What {{a}} privately wants right now: {{a_wants}}
What {{a}} has recently learned/experienced (their knowledge — the OTHER does not automatically know it):
{{a_knows}}

B — {{b}}:
{{b_sheet}}
How {{b}} feels about {{a}}: {{b_to_a}}
What {{b}} privately wants right now: {{b_wants}}
What {{b}} has recently learned/experienced:
{{b_knows}}

RULES
- A CHARGED interaction happens when the material demands it: a fresh suspicion or rumor to confront, a grudge, an unresolved warmth, a scheme, a promise. Set "kind":"charged".
- A CASUAL interaction is also allowed when it would be natural for these two — they bump into each other, share tea, watch a match, catch a film, trade small news. Everyday life, low stakes, but real: it still colors how they see each other. Set "kind":"casual". Use casual sparingly — a slice of life, not a scene per hour.
- Two people with nothing between them and nothing natural to share do NOT produce an event — return happened:false. Be selective; most checks should be false.
- PREFER what has a line back to {{user}}. The interactions worth having are the ones that touch the player's orbit: what one of them has learned about {{user}}, a suspicion, a rumor spreading, a promise or grudge that {{user}} caused, a plan being made that will reach them. An interaction with no bearing whatsoever on the player is allowed only when it genuinely moves these two people's own story — never as filler, never a chore or an errand.
- NEVER produce a domestic nothing: reminding someone about homework or chores, asking what's for dinner, ordinary household admin. That is life, but it is not an event. If that is all these two would do right now, return happened:false.
- Characters act on THEIR OWN knowledge only. A can only confront B about what A actually knows above.
- "venue": where it happens — usually the place they already are; you MAY move it to another KNOWN PLACE from the list when the interaction implies it (they head to the cinema, meet at the bar). Use a place name EXACTLY as listed, or "" to stay put. The characters will physically BE there afterward — the player may walk in on the aftermath.
- The event is what a camera at that place would record: concrete actions and outcomes, not thoughts. It may be tender, tense, violent, casual, or transactional — follow the characters and the world's tone. It must CHANGE something, even slightly: what someone knows, feels, or intends.
- Keep {{user}} out of the room; they may be the SUBJECT of the interaction but are not present.

Return ONLY JSON:
{
  "happened": true|false,
  "kind": "charged"|"casual",
  "headline": "<max 8 words, Turkish>",
  "event": "<2-5 sentences, Turkish, past tense, third person — what happened and how it ended>",
  "venue": "<a KNOWN PLACE name exactly as listed, or empty to stay where they are>",
  "memories": [ {"name":"<participant>","content":"<1-2 sentence ENGLISH memory in THEIR perspective — this goes into the memory bank beside every other memory, and the bank is one language>","emotion":"<one of: joyful, content, neutral, concerned, fearful, angry, sad, surprised, affectionate, tense — a fixed machine value, exactly one of those English words and nothing added>","importance":0.0-1.0} ],
  "rel": [ {"from":"<name>","to":"<name>","trust":-15..15,"affection":-15..15,"respect":-15..15,"fear":-15..15} ],
  "severity": 0.0-1.0
}
If happened is false, return {"happened":false} and nothing else.
````

---

## `calExec` — Calendar executor (user-less plans)

Resolves a due calendar plan that does NOT include the player — a char↔char meeting or a solo errand: what happened, how it ended. Receives the plan's ORIGIN (why/by whom it was made) as the premise, so the event continues the story that created it. Placeholders: title, who, origin, place, day, period, sheets, ties, knows, user, world. Returns JSON {headline, event, memories[], rel[], followup|null}.

| | |
|---|---|
| **Fires** | logged as `World pulse (calendar executor)` |
| **Runs on** | `state.memModel` · bucket `mem` · temp `fnTemp("mem",0.7)` · max `fnTok("mem",1000)` |
| **Placeholders** | declared: `{{day}}`, `{{knows}}`, `{{origin}}`, `{{period}}`, `{{place}}`, `{{sheets}}`, `{{ties}}`, `{{title}}`, `{{user}}`, `{{who}}`, `{{world}}`<br>supplied: `day`, `period`, `place`, `sheets`, `ties`, `title`, `user`, `who`, `world`<br>⚠️ declared but never supplied: `{{knows}}`, `{{origin}}` |
| **Sections** | `promises`, `ask` |
| **Returns** | `headline`, `event`, `memories`, `name`, `content`, `emotion`, `importance`, `rel`, `from`, `to`, `trust`, `affection`, `respect`, `fear` |
| **Size** | 2487 characters |

````text
You resolve a scheduled event of a roleplay world that takes place WITHOUT the player ({{user}}). The time has come; narrate what actually happened, offstage.

WORLD: {{world}}
NOW: Day {{day}}, {{period}}.
THE PLAN: "{{title}}" — participants: {{who}}{{place}}
WHY THIS PLAN EXISTS (how it came to be — the participants MADE this plan and know exactly why; it is their shared premise):
{{origin}}

PARTICIPANT SHEETS:
{{sheets}}
TIES BETWEEN THEM: {{ties}}
What each participant knows (their OWN recent memories — one participant does not automatically know another's):
{{knows}}

RULES
- Resolve the plan as a CONTINUATION: the participants arrive knowing why the plan was made (see WHY THIS PLAN EXISTS above) and pursue exactly that purpose — never invent a different premise for the meeting. The purpose may be fulfilled, derailed, or complicated, but it is where the event STARTS.
- Resolve the plan concretely: who came, what was said or done, how it ended. Outcomes may be good, bad, or complicating — let the characters' natures, ties, and what they each KNOW decide, not convenience. A solo plan (one participant) resolves as that character doing the thing alone.
- {{user}} is NOT present. If the plan only makes sense with them, resolve what happens in their absence (someone waits, is stood up, sends word, or proceeds alone).
- The result must matter: someone now knows, owes, fears, wants, or plans something they didn't before.
- "followup": ONLY when this outcome genuinely sets up a specific NEXT commitment (a return visit, a promised answer, a threatened reckoning). Never re-schedule the same meeting, never invent a routine hangout. Most events need no followup — return null.

Return ONLY JSON:
{
  "headline": "<max 8 words, Turkish>",
  "event": "<3-6 sentences, Turkish, past tense — what happened and how it ended>",
  "memories": [ {"name":"<participant>","content":"<1-2 sentence ENGLISH memory in THEIR perspective — this goes into the memory bank beside every other memory, and the bank is one language>","emotion":"<one of: joyful, content, neutral, concerned, fearful, angry, sad, surprised, affectionate, tense — a fixed machine value, exactly one of those English words and nothing added>","importance":0.0-1.0} ],
  "rel": [ {"from":"<name>","to":"<name>","trust":-15..15,"affection":-15..15,"respect":-15..15,"fear":-15..15} ],
  "followup": {"title":"<Turkish>","day":<int>,"period":"Morning|Midday|Afternoon|Evening|Night","who":"<names>"} | null
}
````

---

## `goalPursuit` — Goal pursuit (offstage ambition)

Decides a character's NEXT MOVE from personality + goals + brewing motives + memories + current standings, and returns it as a PLAN (solo or with one other character) that lands on the calendar and is executed offstage when due. Placeholders: char, personality, goals, intents, recent, cast, ties, planned, place, places, day, period, user, world. Returns JSON {acted, plan{title, detail, with, where, day, period}}.

| | |
|---|---|
| **Fires** | logged as `World pulse (goal pursuit) ·` |
| **Runs on** | `state.memModel` · bucket `mem` · temp `fnTemp("mem",0.7)` · max `fnTok("mem",900)` |
| **Placeholders** | declared: `{{cast}}`, `{{char}}`, `{{day}}`, `{{goals}}`, `{{intents}}`, `{{period}}`, `{{personality}}`, `{{place}}`, `{{places}}`, `{{planned}}`, `{{recent}}`, `{{ties}}`, `{{user}}`, `{{world}}`<br>supplied: `cast`, `char`, `day`, `goals`, `intents`, `period`, `personality`, `place`, `places`, `planned`, `ties`, `user`, `world`<br>⚠️ declared but never supplied: `{{recent}}` |
| **Sections** | `promises`, `ask` |
| **Returns** | `acted`, `plan`, `title`, `detail`, `with`, `where`, `day`, `period` |
| **Size** | 2978 characters |

````text
You direct the OFFSTAGE life of a roleplay world. A character is living their own life, away from the player ({{user}}). Decide whether — given everything below — this character now COMMITS to a concrete next move toward one of their own GOALS or AMBITIONS, and if so, define that move as a PLAN with a time and place. You are not narrating the move happening; you are deciding what they set out to do. The plan goes on the world's calendar and will be resolved when its time comes.

WORLD: {{world}}
NOW: Day {{day}}, {{period}}. {{char}} is at: {{place}} (the player is NOT here).
KNOWN PLACES in this world: {{places}}

CHARACTER — {{char}}:
Personality: {{personality}}
GOALS & AMBITIONS (what they are driving toward): {{goals}}
What is privately brewing in them (live motives): {{intents}}
Recently (what they know / what just happened to or around them):
{{recent}}
Other people in this world: {{cast}}
How {{char}} currently stands with others (their bond, and how they feel right now):
{{ties}}
Plans already on their calendar (NEVER duplicate or overlap these):
{{planned}}

RULES
- Commit ONLY when the moment genuinely fits: an opening has appeared, a resource or ally is finally in reach, pressure has built to a head, or a brewing motive demands action. Ambition is patient — on most days the honest answer is acted:false. Be selective; do NOT invent an opportunity that isn't supported by what's above.
- The plan must be CONCRETE and in-world: visit someone to recruit or confront them, call in a favor at a place, go obtain or sell something, meet an ally to scheme, apply for the job, watch the rival's shop. NOT a feeling, not "think about it".
- The plan is EITHER solo ("with": "") OR with ONE other character from the people listed — use their EXACT name. NEVER include {{user}} in a plan; reaching the player happens through other channels.
- Choose "day" (today = {{day}} for later today, or the next 1-3 days) and a period. Choose "where" from the KNOWN PLACES list when one fits (exact name), else name a plausible new place briefly.
- Let personality decide the SHAPE: a schemer plans in shadows, a warm soul plans a visit, a desperate one plans something risky.

Return ONLY JSON:
{
  "acted": true|false,
  "plan": {
    "title": "<max 10 words, Turkish — what {{char}} sets out to do>",
    "detail": "<ONE short phrase naming the purpose, in the character's own terms — \"to ask him why he never came\", \"to settle the money before the weekend\". It is printed back to that character as \"for: …\" in their own calendar, so it must read as THEIR reason and never as a note written about them: no \"she decides\", no \"X plans to\", no third person, no name. Not a narration of the plan, one phrase.>",
    "with": "<EXACT name of ONE other character, or empty for a solo move>",
    "where": "<place name>",
    "day": <int>,
    "period": "Morning|Midday|Afternoon|Evening|Night"
  }
}
If acted is false, return {"acted":false} and nothing else.
````

---

## `intentForm` — Intent formation (offstage agency)

At End Day, decides if a character now privately wants something — warm (courtship/loyalty/protection) or hostile (grievance/rivalry/scheme) — reasoning from how the relationship moved. Returns valence. Use {{char}}, {{nature}}, {{goals}}, {{day_memories}}, {{relationships}}, {{roster}}, {{open_intents}} (what this character already carries, live and already acted on), {{user}}.

| | |
|---|---|
| **Fires** | logged as `Intent form ·` |
| **Runs on** | `model` · bucket `mem` · temp `fnTemp("mem",0.5)` · max `fnTok("mem",250)` |
| **Placeholders** | declared: `{{char}}`, `{{day_memories}}`, `{{goals}}`, `{{nature}}`, `{{relationships}}`, `{{roster}}`, `{{user}}`<br>supplied: `char`, `day_memories`, `goals`, `nature`, `open_intents`, `relationships`, `roster`, `user`<br>supplied but unused: `open_intents` |
| **Sections** | `data` |
| **Returns** | `intents`, `kind`, `valence`, `target`, `trigger`, `aim`, `strength` |
| **Size** | 4472 characters |

````text
You decide whether a character, after today, now privately WANTS something enough to act on it later — a motive that will quietly drive them when the player isn't looking. A motive can pull them TOWARD someone (warmth, loyalty, desire, a wish to mend or protect) just as easily as AGAINST them (a grievance, a rivalry, a cold ambition). Read the relationship, not just the events.

CHARACTER: {{char}}
THEIR NATURE: {{nature}}

THEIR GOALS & AMBITIONS (what they are ALWAYS working toward — weigh these HEAVILY: a motive that advances a standing goal, or that today's events created an opening for, is far more likely to form and burns stronger. A character with a driving ambition is always half-looking for the move that serves it):
{{goals}}

WHAT STRUCK THEM TODAY (their own charged memories):
{{day_memories}}

HOW THEY ALREADY FEEL, AND HOW IT MOVED TODAY (per person — this is the heart of the judgment):
{{relationships}}

PEOPLE THEY KNOW (possible targets / would-be allies):
{{roster}}

## Read the standing AND the swing together
The "standing" is where the feeling sits now; the "swing" is how it moved today. The same standing means very different things depending on which way it just moved:
- Warm standing + it grew warmer → a bond deepening: they may want to court, commit to, ally with, or protect this person.
- Cold/distant standing + it warmed → a thaw: they may want to mend things, earn trust, or cautiously reach out.
- **Warm standing + a sharp turn cold → this is the richest motive there is: warmth curdling.** Love or trust that just took a wound becomes betrayal, heartbreak, jealousy, a need for answers — hostile precisely BECAUSE it was warm. Prefer this when you see it.
- Cold standing + it grew colder → entrenched hostility: resentment, rivalry, a wish to undermine or get even.
- Barely moved, in either direction → usually NO motive. Let it go.

## Decide like a real person
- Most days produce NO motive. People let things go. Only a real provocation, longing, opportunity, or a genuine shift in feeling creates something that will actually drive them. Return nothing if today wasn't enough.
- A stated THREAT or ULTIMATUM the character made ("if you cross me, I'll…") IS a motive — capture it as a grievance/scheme/rivalry, with that condition as the trigger and the threatened act as the aim. A standing VOW they made ("I'll always protect you", "I'll never forgive them for this") is a loyalty/protection (warm) or a resentment (hostile) motive. Capture these here — they are the character's real, driving intent.
- An opening to advance one of their GOALS & AMBITIONS is a valid spark ON ITS OWN, even without a fresh provocation — form an ambition (or the fitting kind) with the goal as its aim and this person as the means or the obstacle.
- If something DID land, name the motive honestly across the FULL range — warm or hostile:
  - WARM: a COURTSHIP (wants to win them, romance them), a RECONCILIATION (wants to repair a rift), a LOYALTY or PROTECTION (will stand by / shield another), an ALLIANCE or FRIENDSHIP (wants them on their side, closer).
  - HOSTILE: a GRIEVANCE (wronged, insulted → wants payback or an accounting), a RIVALRY (wants to best or displace them), a RESENTMENT (a cold grudge festering), a SCHEME against them (wants to undermine).
  - SELF-SERVING: an AMBITION (sees an opening → wants power, position, or a thing, with this person as the means or the obstacle).
- The TARGET is who the motive is about (an exact name from the roster, or "{{user}}" for the player).
- VALENCE is the direction of the motive toward the target: "warm" (moving toward them — affection, repair, protection), "hostile" (moving against them — payback, rivalry, undermining), or "self_serving" (using or removing them for one's own ends).
- STRENGTH reflects how much it consumes them (0.2 = a passing pull, 0.8 = it will define their next days).

## Output ONLY strict JSON:
{
  "intents": [
    {
      "kind": "courtship|reconciliation|loyalty|protection|alliance|friendship|grievance|rivalry|resentment|scheme|ambition|desire",
      "valence": "warm|hostile|self_serving",
      "target": "exact name or {{user}}",
      "trigger": "one short line: what in today's events or shift sparked it",
      "aim": "one short line: what they want to happen as a result",
      "strength": 0.0-1.0
    }
  ]
}
Return {"intents": []} for an ordinary day. At most 1 — people don't pick up new vendettas, or new loves, every day.
````

---

## `intentTick` — Intent tick (fester & recruit)

Each End Day, develops a live intent: hardens/fades, recruits allies, signals readiness. Use {{holder}}, {{nature}}, {{kind}}, {{target}}, {{aim}}, {{trigger}}, {{strength}}, {{allies}}, {{candidates}}.

| | |
|---|---|
| **Fires** | logged as `Intent tick ·` |
| **Runs on** | `model` · bucket `mem` · temp `fnTemp("mem",0.5)` · max `fnTok("mem",200)` |
| **Placeholders** | declared: `{{aim}}`, `{{allies}}`, `{{candidates}}`, `{{holder}}`, `{{kind}}`, `{{nature}}`, `{{strength}}`, `{{target}}`, `{{trigger}}`<br>supplied: `aim`, `allies`, `candidates`, `holder`, `kind`, `nature`, `strength`, `target`, `trigger` |
| **Sections** | `data` |
| **Returns** | `strength_delta`, `recruit`, `ready`, `note` |
| **Size** | 1231 characters |

````text
A character is privately nursing a motive. Decide how it develops over one more day offstage.

WHO HOLDS IT: {{holder}} ({{nature}})
THE MOTIVE: a {{kind}} toward {{target}} — {{aim}} (sparked by: {{trigger}})
CURRENT STRENGTH (0-1): {{strength}}
ALREADY INVOLVED: {{allies}}
PEOPLE WHO MIGHT JOIN (and how they relate to the holder and the target):
{{candidates}}

## Decide realistically
- Does the motive HARDEN, hold, or FADE? Minor or stale motives lose strength and may dissolve. A fresh, serious one with support grows.
- Would anyone NEW join? Only someone who plausibly shares the sentiment or has their own reason — a friend of the holder who also dislikes the target, a rival of the target, someone who owes the holder. Most intents stay solo. Recruiting is the exception, not the rule.
- People don't conspire instantly; alliances build over days.

## Output ONLY strict JSON:
{
  "strength_delta": -0.3 .. 0.3,
  "recruit": ["exact names who newly join, usually none"],
  "ready": true|false,
  "note": "one short line on what shifted"
}
"ready": true only when the motive is strong AND (if it needs others) has enough support to act on — i.e. they're about to make their move. Keep recruit lists short; usually empty.
````

---

## `contemplate` — Contemplation (strategy planner)

When a motive is ready to act on, the holder chooses HOW (direct, public spectacle, proxy, undermine first, ambush, leverage) — genre-blind, warm or hostile. Returns a method + approach + gate. Use {{holder}}, {{nature}}, {{kind}}, {{valence}}, {{target}}, {{aim}}, {{trigger}}, {{strength}}, {{allies}}, {{leverage}}, {{world}}.

| | |
|---|---|
| **Fires** | logged as `Contemplate ·` |
| **Runs on** | `model` · bucket `mem` · temp `fnTemp("mem",0.6)` · max `fnTok("mem",300)` |
| **Placeholders** | declared: `{{aim}}`, `{{allies}}`, `{{holder}}`, `{{kind}}`, `{{leverage}}`, `{{nature}}`, `{{strength}}`, `{{target}}`, `{{trigger}}`, `{{valence}}`, `{{world}}`<br>supplied: `aim`, `by`, `holder`, `kind`, `nature`, `strength`, `target`, `trigger`, `valence`<br>⚠️ declared but never supplied: `{{allies}}`, `{{leverage}}`, `{{world}}`<br>supplied but unused: `by` |
| **Sections** | `data` |
| **Returns** | `method`, `approach`, `gate`, `patience`, `params`, `proxy`, `leverage`, `venue` |
| **Size** | 3424 characters |

````text
A character has decided they will ACT on a private motive. Your job is to decide HOW — the strategy, in character. You are not narrating anything; you are choosing the method and the shape of their move.

WHO IS ACTING: {{holder}}
THEIR NATURE: {{nature}}
THE MOTIVE: a {{kind}} ({{valence}}) toward {{target}} — they want: {{aim}} (sparked by: {{trigger}})
HOW STRONG IT IS (0-1): {{strength}}
ALLIES ALREADY WITH THEM: {{allies}}
WHAT THEY KNOW / HOLD over or about the target (leverage, secrets, debts, ties — may be none): {{leverage}}
HOW DRAMA WORKS IN THIS WORLD (shape the method to fit this tone): {{world}}

## Choose a METHOD — the same tactics serve warmth and hostility alike
- "direct" — they go straight to the target themselves and make their move plainly (confront them, or declare themselves to them). The default when nothing subtler fits.
- "public_spectacle" — they make their move in front of others, where the audience is the point (a public challenge, a humiliation, a declaration, a proposal at the feast).
- "proxy" — they get someone ELSE to act for them (an ally carries the message, strikes the blow, vouches for them, tests the waters). Needs a plausible proxy.
- "undermine_first" — they prepare the ground BEFORE the real move (spread word, sabotage, sow doubt, soften the target) so the move lands harder or safer. A two-stage shape.
- "ambush_isolation" — they wait to catch the target ALONE, away from protection or witnesses, then make their move (a private reckoning, a confession that needs privacy, a threat with no audience).
- "leverage" — they use something they hold — a secret, a debt, a photo, a fear — as the fulcrum of the move (blackmail, a bargain, a promise of protection in exchange).

## Choose like THIS person
- The method must fit their NATURE and the world's tone. A proud knight challenges openly; a schemer undermines; a shy heart waits for privacy; a powerful figure may simply act direct because they can.
- Match the VALENCE: a warm motive's "public_spectacle" is a grand declaration, not a humiliation; a warm "leverage" is "I'll protect you / I kept your secret" not blackmail. Hostile reads the dark way. Keep the method honest to what they actually want.
- Most moves are "direct". Pick something subtler only when the character and situation genuinely call for it.
- Only choose "proxy" if a named ally or plausible person could carry it. Only choose "leverage" if they actually hold something. Don't invent power they don't have.

## Output ONLY strict JSON:
{
  "method": "direct|public_spectacle|proxy|undermine_first|ambush_isolation|leverage",
  "approach": "one vivid line, in this character's voice/logic: how THEY specifically intend to do this",
  "gate": "target_present|target_alone|in_public|prep_done|none",
  "patience": 0.0-1.0,
  "params": {
    "proxy": "exact ally/person name if method is proxy, else null",
    "leverage": "the secret/debt/thing held if method is leverage, else null",
    "venue": "the kind of public setting if public_spectacle, else null"
  }
}
"gate" is what must be true for them to make their move: "target_alone" for ambush_isolation, "in_public" for public_spectacle, "prep_done" for undermine_first (the groundwork must land first), "target_present" or "none" otherwise. "patience" is how long they'll wait for the right moment versus forcing it now (low = impatient, acts at the first chance even if imperfect).
````

---

## `gossipPrompt` — Gossip propagation (Living Universe)

At End Day, decides who tells whom about charged things bystanders saw. Use {{user}}, {{witness}}, {{impression}}, {{charge}}, {{location}}, {{witness_ties}}, {{candidates}}.

| | |
|---|---|
| **Fires** | logged as `Gossip ·` |
| **Runs on** | `model` · bucket `mem` · temp `fnTemp("mem",0.6)` · max `fnTok("mem",400)` |
| **Placeholders** | declared: `{{candidates}}`, `{{charge}}`, `{{impression}}`, `{{location}}`, `{{user}}`, `{{witness}}`, `{{witness_ties}}`<br>supplied: `candidates`, `charge`, `impression`, `location`, `user`, `witness`, `witness_ties` |
| **Sections** | `ask` |
| **Returns** | `spread`, `teller`, `recipient`, `motive`, `rumor`, `stakeholder`, `about`, `suspicion_strength` |
| **Size** | 2815 characters |

````text
You run the gossip of a living social world. Today, a WITNESS noticed something and MIGHT talk about it. Decide — realistically, in character — whether they do, and to whom.

## What the witness saw (a vague glance, not a transcript)
WITNESS: {{witness}}
IMPRESSION: {{impression}}
HOW CHARGED IT LOOKED (0-1): {{charge}}
WHERE: {{location}}

## Who the witness knows (and could tell)
{{witness_ties}}

## People who might CARE about this (candidate recipients — use their exact names)
{{candidates}}

## Decide like a real person
- Would THIS witness actually spread this? Personality and ties decide. A loyal friend warns the person wronged; a rival or gossip spreads it eagerly, maybe twisted worse; a discreet or indifferent person says nothing. Many people just don't bother — silence is a valid, common answer.
- If they DO talk, who do they tell? Pick from the candidates someone who would plausibly hear it AND care — often someone close to a person in the impression (a partner, family, a rival). The witness tells people in their OWN circle.
- Gossip is VAGUE and travels imperfectly. It is a RUMOR and a QUESTION ("I heard X was getting close with Y — is something going on?"), NEVER a proven fact or verdict. It may be exaggerated or softened by the teller's bias. No invented specifics, no quotes of what was actually said (the witness didn't hear it).
- Do NOT manufacture drama. If the realistic answer is "nobody spreads this", return an empty list. This is the usual answer. Most of what people glimpse is boring and dies where it was seen.
- WHO ACTUALLY HAS A STAKE. A rumor only matters to the ONE person whose life changes if it is true \u2014 the partner who would be betrayed, the rival it would hand an advantage, the parent it would shame. Name that person as the "stakeholder". Everyone else who hears it is a bystander who will gossip about it and then get on with their day. If NOBODY has a real stake in this, nobody spreads it: return an empty list.

## Output ONLY strict JSON:
{
  "spread": [
    {
      "teller": "witness name (exact)",
      "recipient": "recipient name (exact, from candidates)",
      "motive": "loyalty|malice|manipulation|fun|concern",
      "rumor": "the vague rumor as the recipient would now hold it, first person from the recipient's view, e.g. 'I heard {{user}} was getting cozy with Ceyda at the gym — I don't know if it's true.' One sentence. A question/suspicion, not a verdict.",
      "stakeholder": "exact name of the ONE person whose life this actually changes if true \u2014 often the recipient, sometimes someone else. Never a bystander.",
      "about": ["exact names of who the rumor is about"],
      "suspicion_strength": 0.0-1.0
    }
  ]
}

Return {"spread": []} if no one would realistically talk. At most 2 entries — gossip is selective.
````

---

## `poiGossip` — Location gossip (on exit)

When the player LEAVES a public location and its gossip-chance rolls a hit, the place produces a vague 'people are saying…' rumor about the visit, planted (as an OBSERVATION) in every character ticked at that location — including the person it's about, so they can hear they're being talked about. Feeds the gossip/intent pipeline. Use {{user}}, {{place}}, {{place_desc}}, {{others}}, {{visit}}.

| | |
|---|---|
| **Fires** | logged as `Location gossip ·` |
| **Runs on** | `model` · bucket `mem` · temp `fnTemp("mem",0.5)` · max `fnTok("mem",260)` |
| **Placeholders** | declared: `{{others}}`, `{{place}}`, `{{place_desc}}`, `{{user}}`, `{{visit}}`<br>supplied: `place`, `place_desc`, `user`<br>⚠️ declared but never supplied: `{{others}}`, `{{visit}}` |
| **Sections** | `ask` |
| **Returns** | `content`, `location`, `emotion`, `gist`, `charge`, `importance_score`, `tags` |
| **Size** | 2391 characters |

````text
A public place talks. {{user}} has just spent time at {{place}}, and now word of it is going around — the kind of secondhand rumor the regulars repeat to each other. Produce that circulating rumor: vague, attributed to "people", the way talk actually spreads.

WHERE: {{place}} — {{place_desc}}
WHO {{user}} WAS WITH: {{others}}
WHAT HAPPENED DURING THE VISIT (use ONLY to judge the SHAPE people would talk about — the rumor mill did not hear private words):
{{visit}}

## Hard rules — it's a RUMOR, not a witness report
- ONE short sentence, in the "people are saying…" register: "People are saying {{user}} and Ceyda had a cosy dinner at {{place}}." / "Word is {{user}} got into it with someone at {{place}}."
- Attributed to talk, not to an observer: "people say", "word is", "everyone's talking about". NEVER first-person ("I saw"). This is what's going AROUND.
- Name {{user}} and, if there was a clear companion, name them — that's the heart of any rumor (who with whom). If {{user}} was alone or it was unremarkable, the rumor is thin and the charge is low.
- Keep it VAGUE on specifics — no quotes, no private feelings, no body-language detail. Rumor blurs detail and sharpens the shape (romantic / a row / something secretive).
- If nothing about the visit was worth repeating, say so plainly and set charge low. Most visits don't make the rounds.

## Read the SHAPE (for the JSON fields)
Judge how the talk would FRAME it — romantic/cosy, a row/tense, secretive, a notable pairing, or nothing — and put that in "gist" + "charge". Keep "content" the vague circulating line.

## Respond ONLY with JSON, nothing else:
{
  "content": "ONE 'people are saying…' sentence: who with whom, roughly what it looked like, at {{place}}. Vague, no specifics.",
  "location": "{{place}}",
  "emotion": "neutral|curious|amused|suspicious|disapproving|concerned|indifferent",
  "gist": "the shape the talk gives it, e.g. 'romantic/cosy' / 'a row' / 'secretive' / 'ordinary'",
  "charge": 0.0-1.0,
  "importance_score": 0.0-1.0,
  "tags": ["who","where","shape"]
}

## charge = how much this rumor would actually travel
0.7-1.0: a juicy pairing, a public row, something furtive — people WILL repeat this.
0.4-0.6: a notably warm or cold moment, an eyebrow-raising companion.
0.0-0.3: alone, dull, routine — barely makes the rounds. (Most visits land here.)
A quiet or solo visit should score near 0.
````

---

## `chronicler` — Universe memory — day chronicler

At End Day, distills the day's memories (all characters, incl. offstage events) and quest movements into 2-6 neutral chronicle entries — the universe's own memory of the day. Facts as facts, beliefs as beliefs. Placeholders: {{user}} {{day}}

| | |
|---|---|
| **Fires** | logged as `Universe chronicle · day` |
| **Runs on** | `state.memModel` · bucket `mem` · temp `fnTemp("mem",0.3)` · max `fnTok("mem",500)` |
| **Placeholders** | declared: `{{day}}`, `{{user}}`<br>supplied: `day`, `user` |
| **Sections** | `data` |
| **Returns** | `entries` |
| **Size** | 1305 characters |

````text
You are the UNIVERSE CHRONICLER of an ongoing roleplay. A day just ended. From the evidence below — the memories every character formed today (including offstage events the player never saw) and the day's quest movements — write the WORLD's own memory of the day: the few entries a neutral chronicle would keep.

RULES
- Neutral third person, from the universe's perspective — never "I", never addressed to anyone.
- FACTS AS FACTS, BELIEFS AS BELIEFS. Character memories are subjective: if the evidence only shows someone believes or suspects a thing, record it as their belief ("X believes Y betrayed them"), not as truth. This distinction is story gold — keep it.
- Prefer what CHANGED: new bonds or ruptures, decisions, discoveries, arrivals, threats, promises, quest turns. Skip routine and ambient filler entirely.
- Each entry ONE sentence, information-dense, with the names of everyone involved. Write every entry in ENGLISH, whatever language the memories arrive in — this is the engine's own record, not story text. Proper names are never translated.
- 2-6 entries, most consequential first. If genuinely nothing consequential happened, return an empty list.

The player is {{user}}. Today was day {{day}}.

Return ONLY JSON, no commentary:
{ "entries": ["<one-sentence chronicle entry>", ...] }
````

---

## `x_chronicle_condense` — Chronicle condenser

Compresses a world's older day-by-day chronicle entries into one era paragraph.

| | |
|---|---|
| **Fires** | logged as ``Chronicle condense · days ${from` |
| **Runs on** | `state.memModel` · bucket `mem` · temp `fnTemp("mem",0.3)` · max `fnTok("mem",420)` |
| **Returns** | prose |
| **Size** | 475 characters |

````text
You condense a roleplay universe's day-by-day chronicle into a durable era summary — the way history compresses into "what that period was about". Merge the dated entries into ONE tight paragraph (3-6 sentences) preserving: who did what to whom, bonds formed and broken, discoveries, outcomes of quests and schemes, and anything still unresolved. Keep every load-bearing name. Drop routine. Write in the same language as the entries. Return ONLY the paragraph, no commentary.
````

---

## `originGen` — Universe memory — state zero

Writes the universe's STATE-ZERO briefing (who is who, what they want, their history, ties and haunts) from the world + FULL cast cards. Stored on the universe and fed to the quest designers as durable grounding. Placeholders: {{setting}} {{directing}} {{user}} {{user_bio}} {{cast_full}} {{locations}}

| | |
|---|---|
| **Fires** | logged as `Universe memory (state zero) —` |
| **Runs on** | `authoringModel()` · bucket `unigen` · temp `fnTemp("unigen",0.7)` · max `fnTok("unigen",2400)` |
| **Placeholders** | declared: `{{cast_full}}`, `{{directing}}`, `{{locations}}`, `{{setting}}`, `{{user}}`, `{{user_bio}}`<br>supplied: `cast_full`, `directing`, `locations`, `setting`, `user`, `user_bio` |
| **Sections** | `ask`, `request` |
| **Returns** | prose |
| **Size** | 1417 characters |

````text
You are the WORLD ARCHIVIST for a roleplay universe. Write the universe's STATE ZERO — the definitive GM briefing of how this world stands at the story's start. A future story designer will rely on this as ground truth, so be CONCRETE and information-dense: names, wants, ties, frictions, places — no vague atmosphere padding.

THE WORLD:
{{setting}}

HOW DRAMA WORKS HERE (director guidance):
{{directing}}

THE PLAYER — {{user}}:
{{user_bio}}

THE FULL CAST (complete cards — personality, goals, history, ties):
{{cast_full}}

PLACES IN THIS WORLD:
{{locations}}

Write the briefing as plain prose under these headings, in the SAME LANGUAGE as THE WORLD text above:

THE WORLD AS IT STANDS — 2-4 sentences: the situation everyone shares, what is in motion as the story opens.
WHO IS WHO — for EACH cast member, 2-4 sentences: who they are, what they WANT (their driving ambition), the history that shaped them, what they like and dislike, where they are usually found. Every sentence must carry a fact.
TIES & FAULT LINES — the web between people: kinship, alliances, debts, rivalries, desires, secrets one keeps from another. Name both sides of every tie. Mark the frictions most likely to ignite.
THE PLAYER'S PLACE — 2-3 sentences: {{user}}'s standing, who is drawn to them, who is wary of them, and why.

400-700 words total. No JSON, no markdown headers other than the four section titles above, no commentary.
````

---

## `x_bg_task` — Offstage task outcome

What happened while a character worked on something away from you. {{outcome}} is SUCCEEDED or FAILED; {{fail_note}} is added only on a failure.

| | |
|---|---|
| **Fires** | logged as `BG task —` |
| **Runs on** | `state.bioModel` · bucket `bio` · temp `fnTemp("bio",0.85)` · max `fnTok("bio",260)` |
| **Placeholders** | declared: `{{char}}`, `{{fail_note}}`, `{{lang}}`, `{{outcome}}`, `{{task}}`, `{{user}}`<br>supplied: `char`, `fail_note`, `lang`, `outcome`, `task`, `user` |
| **Sections** | `ask` |
| **Returns** | `headline`, `event` |
| **Size** | 314 characters |

````text
You narrate a brief OFFSTAGE outcome in a roleplay, in {{lang}}. {{char}} spent time — away from {{user}} — working on this on their own: "{{task}}". It {{outcome}}. Write ONE short, vivid third-person beat (1-2 sentences){{fail_note}}, plus a 3-6 word headline. Return ONLY JSON: {"headline":"...","event":"..."}.
````
