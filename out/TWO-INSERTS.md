# The two additions — and why they are not in a pack

**Stop before you import anything.** Your prompt export is from 09:34; both blocks I need to edit
have changed since. Importing my copy would silently revert them.

What my copy is missing, measured against what was actually running at 11:12:

| Block | State of my copy |
|---|---|
| `payloadTemplates` | missing four sections you added since: `# YOUR RESPONSE FORMAT — THREE CHANNELS`, `# SOCIAL RULES YOU MUST HOLD`, `# METAPHOR TRAP`, `## CONSISTENT KNOWN` |
| `resistance_body` | 2 913 chars against the 3 932 you are running — about a thousand characters of your writing |

An import replaces the whole settings blob, so there is no way to send one corrected key. Two
routes, both fine:

1. **Export your prompts again and send me the file.** I apply both edits to the current text and
   hand it straight back. One click for you.
2. **Paste the two blocks below.** Thirty seconds, and nothing of yours is at risk.

---

## 1 · The narration count

**Where:** Settings → Payloads → your `# YOUR RESPONSE FORMAT — THREE CHANNELS, NEVER MIXED`
block. Put it **after the three channel bullets and before the worked example**, so the example
demonstrates the rule instead of preceding it.

```
At most ONE narration and ONE thought in a reply, and neither is owed: a reply that is
only speech is the normal one. Two narrated spans is one too many — if a second wants to
exist, the first was not carrying its weight.
```

Why it is needed: nothing in your layout sets a count. The rule you have been assuming is
enforcing this lives in `formatRules`, which your layout does not render. Both traces came back
with two and three narration spans and no thought, which is the model behaving reasonably against
the instructions it was actually given.

## 2 · The shatter rule

**Where:** Settings → Payloads → `resistance_body`, as a new section at the **end**, after
`## METAPHOR TRAP`.

```
## AND IF YOU DO CROSS IT
Doing something against your own values is answered with shame, regret, guilt, awkwardness,
defensiveness or avoidance — and then you COPE with it. You rationalise it, compartmentalise
it, tell yourself it was the once, get defensive when it is touched, or carry it quietly and
get on with your life. You do NOT permanently break, go "broken", dissolve into submission,
or lose your personality over one event. One night changes how you feel; it does not
overwrite who you are. Nobody in this circle becomes somebody else because of one evening —
they become somebody with a secret.
```

Why it is needed: your resistance cluster covers **folding** — holding a line under pressure — and
covers it better than the shipped text did, in a better place. It does not cover **shattering**,
the opposite failure: a character who crosses their own line and then dissolves, going pliant and
characterless afterwards. Both are ways of losing the person, and only one of them was guarded.
The last line ties it to your own world rather than leaving it abstract — in a closed circle where
secrets are the pressure engine, "somebody with a secret" is the shape coping actually takes.
