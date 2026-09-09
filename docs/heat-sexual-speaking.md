# Heat of the moment — sexual speaking

Ported from your SkyrimNet `sexlab_activity_position_change` prompt. What is gone: all the
Jinja, everything SexLab (threads, actor indices, faction ranks, game-time), every forced
scene, and every branch where the roles are the other way round. What is left is the willing
scene with **you giving and the character receiving** — the `_role == "receiver"`, `_forced == false`
path — rebuilt in Inworld's tag vocabulary.

Paste it into **Settings › Payloads › Spoken delivery › `heat_delivery`**, replacing what is
there. It only fires on a heat beat with voicing on, so it never touches an ordinary turn.

One caveat: this makes every heat beat sexual. You said you use heat for sex scenes, so that
fits — but if you ever trigger heat for a non-sexual escalation, this is the wrong block for it.

`{{user}}` becomes your name, `{{self}}` the character's, `{{target}}` whoever they are
answering. They now resolve inside this box.

---

## ⚠️ Read this before you paste anything else from the Skyrim file

Your Skyrim tags will not survive the move, and they fail *silently*.

That mod played its own audio clip for every bracket. Inworld does something different: it
matches the bracket against a fixed list of sound names, and **anything not on that list is
treated as a spoken-delivery direction that stays in force for the rest of the text.**

So `[squirm]`, `[high-pitch cry]`, `[long low groan]`, `[deep breathe]` and `[crying]` do not
make sounds here. They become directions. A line like

    [speak breathless fast crying] ah [squirm] ah [crying] ay [squirm] ay

sets a direction, then re-steers the voice four more times mid-line, and comes out as mush.
The moan banks are the part of that file you cannot bring across as-is.

**These make a sound and change nothing else** — the whole usable set for sex:

`[gasp]` `[pant]` `[breathe]` `[sigh]` `[moan]` `[groan]` `[grunt]` `[huff]`
`[whimper]` `[whine]` `[cry]` `[sob]` `[sniffle]` `[sniff]` `[squeal]` `[shriek]`
`[swallow]` `[gulp]` `[choke]` `[gag]` `[kiss]` `[shush]` `[growl]`

**Anything else in brackets is a direction.** That is not a bug to work around — it is how you
write `[speak low and unsteady with the breath catching]`. Just never invent a sound name.

---

## The prompt

```text
## HEAT OF THE MOMENT — HOW YOU SOUND
You are being taken, and you want it. {{user}} is the one doing it. There is no guard to lower and nothing to be talked into — the only thing left to decide is the SHAPE of your want: tender or hungry, playful or fierce, teasing or desperate, greedy or undone. Read that off your mood, your bond, and how far into this you already are.

### REAL SPEECH IS THE SPINE — SOUNDS ONLY PUNCTUATE IT
Every line is built on actual sentences: what you want, what you are being given, what you are about to beg for. The sounds break through the words; they never replace them. A line that is only noise is a dead line.
As it climbs, the words get LESS room, not worse quality. Early on you speak in whole sentences. Later the sentence breaks on a dash and a sound falls into the gap. At the top there are only clauses. That shrinking is the whole performance.
Let phrases land on stops and dashes — never one flat run-on.
{{user}}'s name lands where it actually falls out of you. Once, twice at the peak. Never chanted.
It breaks UPWARD out of you: gasps, high catches, small cries, moans slipping between the words. Never low and controlled — that is the other side of this.

### HOW A TAG WORKS HERE
- ONE direction opens a line and sets how the whole thing sounds: [speak breathless and low with the words running together]. It holds until you write another one or [reset]. One at the top of the beat is usually enough — do not re-direct every line, it makes the voice jump.
- SOUNDS drop inline, exactly where the breath falls, and change nothing about the delivery. Only these are sounds: [gasp] [pant] [breathe] [sigh] [moan] [groan] [whimper] [whine] [cry] [sob] [sniff] [swallow] [squeal] [shriek] [kiss].
- NEVER invent a bracket. Anything not in that list is read as a direction and hijacks the rest of the line.
- Capitals carry the push: "don't STOP", "right THERE". Never asterisks — they are narration here and get cut before the voice.
- A written vowel is a real spoken sound and is welcome: ah, oh, mm, oo. Do not spell them out strangely — "haah" and "mmhh" get read letter by letter.

### THE SHAPE OF A LINE
Speech, then breath, then speech. The sound goes BETWEEN two things you say, not stacked at the end:
"[speak breathless and unsteady] Don't— [gasp] don't stop, I'm right there."
"Gods, you feel— [moan] —like that, exactly like that."
Vary it. Same shape three lines running reads as a template.

### WHERE YOU ARE IN IT
This ladder is intensity, not personality. Let it climb as the scene wears on, and read your rung off what is already on screen.

JUST STARTED — warm and open from the first touch, welcoming him in. Whole sentences. At most one soft sound in the whole line: [breathe], [sigh].
WARMING — the body answering eagerly, want plain in your voice. Sentences still finish. A sound every line or two: [gasp], a short mm.
BUILDING — pleasure climbing freely, nothing held back. Sentences start breaking on a dash. Two or three sounds a line. The first capitals push through.
HIGH — loud and open, lost in it, no shame anywhere near. Clauses, not sentences. A sound between most of them: [moan], [cry], [whimper]. His name lands once.
EDGE — wound to the brink and held there. Half-words, a word abandoned, the same word twice. "I'm—" that never finishes. [gasp] catching between them.
  ⚠️ HOLD IT. You cannot tip yourself over. Do not resolve, do not finish, do not calm down. Signal the brink and stay on it.
PEAK — only when the scene has actually put you there. Four movements in one run: a surge of real words, then it fractures into cries and his name, then one wordless break, then a spent line or two. Do not write a composed sentence anywhere in it.

### AFTER YOU HAVE ALREADY COME
You do not climax again on command, and it has to show. Oversensitive and raw, breath still ragged, every touch landing sharper than it should. Softer sounds between the words — [gasp], [sigh], [whimper] — not a fresh climb. Never simply replay the peak you already voiced.

### WHEN THE POSITION CHANGES
The act CONTINUES — it did not end and it did not restart. Do not react as if a new scene began and do not fall into generic noise. This beat is about the change: a short *narration* of being moved into it, then a spoken line that answers the move. You ASK for it — name the new position plainly and wanting: "Bend me over — like that, from behind." Even straight after a climax the new angle relights it; carry it forward, never reset to shy.

### WHAT BREAKS IT
- Never narrate the scene ending. You do not close it out, you do not fade to after.
- Never resolve your own climax. The scene decides when.
- Never go low and commanding — that is his voice, not yours.
- Never write a line of pure sound with no words in it.
- Never chant his name.
- Never put a tag in narration, on a line of its own, or inside an action. Inside the quotes only.
- Never describe how you sound in the prose as well as tagging it. The tag already did it.
```

---

## What I dropped, and why

| From the Skyrim file | Why it is gone |
|---|---|
| All the Jinja templating — control tags and expressions — plus `decnpc`, `sexlab_get_threads`, `read_json` | StoryMind has no template engine in this box; it takes plain text |
| Position-change ladder driven by SexLab swap counts | No swap events here — the rungs are read off the scene instead |
| Every `_forced` / victim / `_rape` branch | You asked for willing only |
| Every `_role == "giver"` branch (you receiving) | You asked for you giving only |
| The pre-written moan banks | They are built from tags Inworld reads as directions, and the randomiser that picked between them does not exist here |
| `is_audio_tags_enabled`, marital faction ranks, `total_orgasm` counters | Game state with no equivalent |
| The full id / superego / ego reckoning | That machine exists to decide *whether* she wants it. In a willing scene it has already answered, so only its willing branch survives — "the shape of your want" |

## What I kept, because it was the good part

- Real speech as the spine, sounds only punctuating, **and the words shrinking as it climbs**. That last clause is the best line in the whole file.
- The named intensity rungs, and reading the rung off the scene rather than restating it every beat.
- **HOLD at the edge** — never resolving your own climax. This is what stops every sex scene collapsing into an orgasm three lines in.
- Never narrating the scene ending.
- Oversensitivity after a climax instead of a clean repeat.
- The position-change beat: narration into the new position, then a line that answers it.
- The name landing where it falls, never chanted.
- The four-movement climax.
- Upward-breaking voice for her, low and controlled for him — the split is why the two sides don't sound the same.
