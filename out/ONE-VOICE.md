# One voice: the reply payload is second person throughout

**Import `storymind_prompts_one_voice_20260920.json`** (Settings → Import → Prompts). It is the
audited pack from before, plus this change. Model and toggle settings are untouched; 24 block
templates and 6 prompts moved.

The trace had 31 `YOU/YOUR` tokens against 78 `I/MY/ME`, and four consecutive headings that switched
to "I" and then switched back. Worse than the count: several headings announced one person and the
text underneath used another — `# MY PEOPLE` over "Berker is **your** husband", `# WHO YOU ARE` over
"**Özlem** grew up in a lively household", `# LASTING / CONSIDERED VIEW (my settled opinion)` over
"**She** has cut Emre off". Everything now says "you".

## What moved

### Your block templates — 19 of them

| `bio_intro` | kept, with 'remembered' dropped — it read as a memory heading above a bio |
| `goals_live_intro` | MY GOALS → YOUR GOALS |
| `pursuit_status_intro` | I ACTIVELY PURSUE → YOU ARE ACTIVELY PURSUING |
| `bio_behave_self` | How I act → How you act |
| `bio_behave_other` | was first person about someone else — now third person about {{char}}, with the sheet's own 'you' explained |
| `bio_wardrobe_self` | MY WARDROBE → YOUR WARDROBE; 'I dress yourself' fixed |
| `bio_wardrobe_other` | said YOUR WARDROBE for somebody else's clothes — now {{char}}'s |
| `rel_header` | MY PEOPLE → YOUR PEOPLE; the body was already second person |
| `rel_learned` | I know these things → You know these things; the body was already second person |
| `rel_elsewhere` | THE PEOPLE I KNOW → PEOPLE YOU KNOW |
| `others_footer` | I address / hear me → You address / hear you |
| `feel_header` | HOW I FEEL → HOW YOU FEEL |
| `feel_lasting` | my settled opinion → your settled opinion; this is the heading the relationship writer's text lands under |
| `feel_lasting_alt` | same, for the multi-target variant |
| `intent_aim_warm` | BACK OF MY MIND / I am working → YOUR MIND / you are working |
| `intent_aim_cool` | nine first-person pronouns → second person |
| `situation_arriving` | 'my first words' → 'your first words'; stray capital in 'You Give' fixed |
| `situation_leaving` | 'You give ve a brief parting beat' — the stray 've' removed |
| `mem_recent_instr` | sentence-medial 'You let it show' lowercased |
| `psychePrompt` | the drives writer now addresses the character as "you" — flat and clinical still, but addressed rather than narrated about |
| `goalsCurator` | the line rule forbade first person and then demonstrated it ("look at me the way he used to") — pronouns inside a goal are second person now |
| `intentForm` | the private motive's `aim` is printed under "Privately, you are working toward…" — it now states second person instead of leaving it to chance |
| `formatRules` | the narration example demonstrated the one form the app forbids — *she turns the glass* — where the beat has to be written as yourself, *I turn the glass* |
| `goalPursuit` | the calendar `detail` now names second person explicitly, matching the rest |

Five templates still contain "I" or "me" and are correct: `voice_delivery`, `heat_breaks_silent`,
`rails_header`, `last_line_footer` and `resistance_body`. In every case the pronoun sits inside
quoted speech — an example line the character says, or an example of what somebody asks them. Those
are the character's own words, not the payload talking about them.

### The writers that fill those blocks

A heading is only half of it. Six writers put text *into* the card, and three of them were
producing the wrong person regardless of what the heading said:

- **`psychePrompt`** — the drives block. It explicitly asked for "NEUTRAL, THIRD PERSON", and the
  trace shows what that produced: *"Özlem wants Emre to stop handing her instructions."* It is now
  second person and still flat and clinical — addressed to the character rather than narrated about
  them, which is what its own heading ("a cold note about you, deliberately not in your voice")
  always meant.
- **`goalsCurator`** — the goals lines. The rule said "first person is wrong and third person is
  wrong" and then demonstrated first person twice: *"Get Hakan to look at **me** the way he used
  to."* Which is why the trace carries *"Find out if **I'm** carrying Emre's child."* The subject
  stays implied; the pronouns inside are "you".
- **`afterHeatPrompt`** — the decision. The shipped default was third person throughout *and*
  assumed every character was a woman ("A woman who cleans when she is frightened cleans harder").
  Your own copy had already fixed the person; the shipped one is fixed now too, and ungendered.
- **`intentForm`**, **`goalPursuit`**, **`promisePrompt`** — all three feed a second-person card and
  none of them said so. They do now.
- **`formatRules`** — the narration example demonstrated the one form the app forbids:
  *she turns the glass a quarter turn*. The beat has to be written as yourself — *I turn the glass* —
  and the shipped rule says so in as many words. Fixed, with the reason kept: a subjectless example
  teaches the wrong possessive in a language that has to choose one.

## What stays in first person, deliberately

**Memory content.** A memory is recalled as "I" — *"Went to Emre's to cook and ended up over his
kitchen counter"* — and the entire bank has been written that way since it was built. Changing the
writer now would leave new memories in a different voice from every old one, under a heading
(`# THESE ARE YOUR RECENT MEMORIES`) that already frames them correctly as yours. Your own last
line, quoted back under `## YOU ALREADY SAID THESE`, is the same case.

## The one thing I could not reach

**Özlem's card itself.** `<backstory>` and `<personality>` are third person — *"Özlem grew up in a
lively, crowded household… She works as an engineer"* — sitting directly under "What follows is you,
seen from the inside". That text is persona data in your universe, not a prompt, so it is not in
this pack. The writers that generate cards are all correct now, so **regenerating that character's
bio produces a second-person sheet**; editing the two fields by hand works just as well and is
faster for one character. Any card made before the card-voice fixes will have the same problem.

## Also in this build

A test now pins the invariant: every writer that feeds a character card has to state its voice, and
no shipped block template may use first person outside a quoted example. Both would have caught all
of the above, and will catch the next one.
