# Payload review: player engines

Scope: Suggested replies (45), Auto-RP player narrator (37), Story mode (4), Memory (arc) · player (38), Your ties (7), Text reply (2), Text arrival (2), Proactive text (6), Scene recap (1). Paths below are relative to `/tmp/claude-0/payload-review/out/payloads/`.

**Overall.** The v148.1 rebuild of `_playerKnows` is a real improvement where it works. THE PEOPLE HERE now reads from the player's own tie sheet, in the second person, where "you" = Emre. WHO IS WHO is the player's own paragraph. WORDS GIVEN and EARLIER TODAY are correct and from the player's side. A writer given the late-day suggestion payloads has a fair picture of Emre's relationships. The problems come from three places.

1. **The transcript.** Every player-side engine reads it raw. Suggestions, Story mode, the Auto-RP narrator and the recap build THE LAST LINES from `m.content`. So the model gets the characters' `_inner thoughts_`, offstage world events, and whispers with no marking at all. The app already has the right filter, `_playerHeardLine`, but only the player's memory uses it.
2. **The inputs to the knowledge blocks.**
   - THE PLAYER'S PLANS is never filled in.
   - The fallback tie shows the character's own tie word, seen from their side ("husband's childhood friend").
   - The Your-ties writer gets each character's private card, written in that character's "you".
   - The player's "still open" threads never close.
3. **The text engines.** They hand a texting character the room of a scene they are not in.

The Auto-RP narrator knows the voice (profile, speech style, tie words) but not the situation (4 raw lines, no memories or promises). It also has no whisper channel, even though the player's own speech style tells it to use `/whisper`.

---

### 1. [High] Characters' inner thoughts and offstage world events reach the suggestion writer, Story mode and the narrator as scene lines
- Engine(s): Suggested replies, Story mode, Auto-RP player narrator (also Scene recap)
- Evidence:
  - `suggested-replies/0717.md`, THE LAST LINES: `Buket Özüçak: … "Sen bir şey biliyor musun Emre?" _Yalan söylerse anlarım._`
  - `suggested-replies/0082.md` and `auto-rp-player-narrator/0083.md`: `Burcu Atan: … "Gece vardiyasında. Ama burada olmaz Emre, herkes bakıyor." _Kalbim neden bu kadar hızlı atıyor?_`
  - `story-mode/0489.md`: `Burak Atan: … _Neden bana kendisi anlatmadı da ben sordum?_`
  - `suggested-replies/0671.md` (also 0654, 0693, `auto-rp-player-narrator/0672.md`, `scene-recap/0655.md`): `Narrator: **Buket bankaya uğradı** / Buket sabah bankaya uğrayıp kart ekstresinin bir kopyasını istedi…`
  - 45 of the 45 suggestion payloads contain at least one `_thought_`.
- Why it hurts: Suggestions and Story mode play Emre as if he could read minds. Knowing Buket thinks "I'll know if he lies" and that she went to the bank for the card statement, the model will offer "admit it to Buket" or "warn Sami about the statement". Emre has seen neither. The system prompts say "never suggest anything Emre could not know", and the payload undercuts that. This is the same failure the user found with the ties, arriving through a different block.
- Root cause:
  - `fetchSuggestions`, `smPlayerMove`, `narratePlayerTurn` and `maybeShowRecap` each build the lines as `` `${speaker}: ${m.content}` ``. They do not strip thoughts or drop `worldEvent`/`questNote` beats.
  - `_playerHeardText`/`_playerHeardLine` already do exactly this (via `perceivedOnly`, and they skip worldEvent/questNote/calNote/uiNote). But only `buildPlayerMemory` calls them.
  - The `_playerKnows` header even says "Deliberately NOT here: … offstage events".
- Fix: Build every player-side convo with `_playerHeardLine(m, chatUserName(chat))` and drop empty lines. That is one line in each of the four functions.

### 2. [High] Whispers reach the player-side engines unmarked, so a private act reads as public
- Engine(s): Suggested replies, Auto-RP player narrator, Story mode
- Evidence:
  - `suggested-replies/0082.md` (the `/whisper Burcu Atan` turn): `Emre: *Masanın altından dizine hafifçe dokunuyorum.* "Bu akşam Burak nöbette mi?"`. There is no marker that this was a whisper.
  - `auto-rp-player-narrator/0913.md` (right after `/whisper Sami Özüçak`): `Emre: *Ona bir zarf gösterip avucuna sıkıştırıyorum.* "Cuma'yı bekleme, şimdi al. Ama bu son."`. The next line is Sami's reply, also unmarked. `suggested-replies/0912.md` is the same.
  - By contrast, the player-memory payload (`memory-arc-player/0102.md`) frames the same line as `(whispered to Burcu Atan alone)`.
- Why it hurts:
  - The suggestion writer thinks Emre touched Burcu's knee and handed Sami cash in full view of Berker. It will offer options that treat Berker as a witness ("explain the envelope to Berker") or that expose the secret.
  - The narrator will write the next turn as if the whole table saw it.
  - The player's speech style, which both engines receive, says "Never speak too openly if you are not alone". The engines cannot follow that if they cannot tell what was private.
- Root cause: The same raw `m.content` builders as in #1. `m.whisperTo` is ignored there. `_playerHeardText` handles it.
- Fix: Same as #1 (`_playerHeardLine`). Also apply the correction in #9 so a whisper-back is labelled private as a whole.

### 3. [High] A suggestion or Story-mode move can never be a whisper, and the narrator is told to write `/whisper` syntax that would be posted publicly
- Engine(s): Suggested replies → Auto-RP player narrator; Story mode → Auto-RP player narrator
- Evidence:
  - `suggested-replies/0837.md`, `0884.md`, `0953.md` offer `"Sami'ye zarfı ver"`, a hand-over that must be hidden from Berker.
  - Every narrator payload (e.g. `auto-rp-player-narrator/0913.md`) carries, inside WHO {{user}} IS, the player's rule: `If you are narrating something to someone that others should now see you this format: /whisper <character's full name> * hidden narration…*`
- Why it hurts: Tapping the suggestion sends the intention through the narrator, and the result goes out as an ordinary public turn. The secret hand-over then happens in front of Berker, and the Buket promise breaks. If the narrator obeys the player's style and starts its output with `/whisper Sami Özüçak …`, that literal text is posted as a public line that everyone hears.
- Root cause:
  - `sendMessage` checks `^\/whisper\s` against the raw input only, before the Auto-RP step.
  - After `narratePlayerTurn` returns, the text is pushed as `{role:"user",content:text}` with no second check.
  - `sendSuggestion` and `_smSend` both go through this path with `forceRp`.
  - `x_reply_suggest` and `x_story_player` have no way to say "privately, to X".
- Fix:
  - After `narratePlayerTurn`, if the output matches `^\/whisper\s+(.+)`, route it to `sendWhisper(chat, match[1])`.
  - Tell the narrator in `DEFAULT_PLAYER_NARRATE` that this is how it marks an aside, and give it the names present.
  - Let the suggestion and Story-mode JSON carry an optional `"whisper_to"`, and prefix `/whisper <name>` when it is set.

### 4. [High] The Your-ties writer is handed each character's private card, in that character's "you", labelled "public facts only"
- Engine(s): Your ties
- Evidence:
  - `your-ties/1079.md`, under `## Berker Özüçak`: `Their card (their side — public facts only): … you have begun to want something that belongs to you and Buket alone.`
  - `your-ties/0065.md`, Duygu: `after Nil's birth, the weight returned, and though exercise and medication have helped you lose it again, the battle continues daily.`
  - `your-ties/0653.md`, Burcu: `you resent how thoroughly your marriage has taught you to manage rather than be cherished.`
  - Each person costs about 1,200 characters (card plus social graph). The 5-person call is about 9k characters.
- Why it hurts:
  - Berker's secret interest in his brother's wife, Duygu's weight and medication, and Burcu's private resentment are sent to the one engine whose output becomes Emre's knowledge. That output feeds THE PEOPLE HERE in every suggestion and Story-mode payload, and the narrator's "Who they are to you".
  - A single slip ("Berker is close to Buket", "Burcu feels uncherished") becomes something Emre "knows".
  - The payload also mixes three POVs: card "you" = the character, entry "you" = Emre, memories "I" = Emre. That makes it easy to write "You met Sami at a wedding" into Buket's entry.
  - "take only public facts … never repeat a private thought" is a request, not a filter.
- Root cause: `updatePlayerSheet` puts `p.backstory + p.personality` (up to 700 characters) and `p.socialGraph` (up to 500) into every person's block. It also adds `relSheetEntry(p,"__user__").tie` ("What you are to them").
- Fix: Send only what an acquaintance could know: name, job or role, household (spouse and children from the social-graph tie words), where they live, the public `look`, the player's existing entry, and the memories. Drop `backstory`, `personality` and the prose `socialGraph`. If more is needed, add a short authored "known about them" field to the card.

### 5. [Medium] THE PLAYER'S PLANS is never filled in: the player's own calendar is filtered out
- Engine(s): Suggested replies, Story mode
- Evidence:
  - No PLANS block appears in any of the 45 suggestion or 4 Story-mode payloads (the block list per call is in `scratch-player`; e.g. `suggested-replies/0717.md` goes straight from WHAT THE PLAYER REMEMBERS to WORDS GIVEN).
  - The entry did exist from Day 1 on: `future-tracker/0450.md` shows `MEETING: Barbecue at Emre's place (with Sami Özüçak, Berker Özüçak) — day 2 Evening at Emre's House`.
- Why it hurts: The Story-mode prompt says "a plan made for this evening is something they remember this evening", but it never sees one. The suggestion writer is told to "pick up … an unkept plan", but only sees it if a memory happens to carry it as an open thread.
- Root cause:
  - `_playerKnows` calls `calendarContextLine(chat,_un,"__user__",{bare:true})`, which filters with `planHasChar(e,selfId,selfName)`.
  - For an id-tagged plan, `planHasChar` returns false as soon as `selfId` is not among `planCharIds(e)`.
  - Those ids are the characters' ids, never `"__user__"`. So every meeting the player has with someone is dropped for the player.
- Fix: In `_playerKnows`, select the player's entries with `_planIncludesUser(e,chat)`. That could be a `forUser` option in `calendarContextLine` that swaps the participant test, and then renders the other names as "with Sami, Berker".

### 6. [Medium] Before a tie entry exists, the character's own tie word is shown as what they are to the player
- Engine(s): Suggested replies, Story mode, Auto-RP player narrator
- Evidence:
  - `suggested-replies/0018.md`: `- Burcu Atan (husband's childhood friend)`
  - `auto-rp-player-narrator/0000.md`: `Who they are to you: … Burcu Atan (husband's childhood friend).`
  - `suggested-replies/0285.md`: `- Özlem Özüçak (husband's childhood friend)`
  - `suggested-replies/0693.md`: `- Buket Özüçak (friend)`, where Buket's card calls the player "friend".
- Why it hurts: This is the directional-POV bug again, in a smaller form. "Husband's childhood friend" is what Emre is to Burcu. Presented as what Burcu is to Emre, it tells the model Emre has a husband, or scrambles the relationship. It happens on the first turn of every new encounter (the tie seeding runs in the background after that payload is built).
- Root cause: The fallback branches of `playerTieLine` and `_playerPeopleShort` use `relSheetEntry(p,"__user__").tie`, which is the character's tie *to the player*. `_PRIVATE_TIE_RE` removes secret ties but not directional ones.
- Fix: Drop that fallback. Use the player's side from `u.userSocialGraph` when it names the person; otherwise print "no entry yet — someone from the estate". Alternatively, run `maybeSeedPlayerTies` and wait for it (foreground) on the first turn with a new person.

### 7. [Medium] The player's "still open" threads never close and contradict WORDS GIVEN
- Engine(s): Suggested replies, Story mode (via `playerMemoryLines`)
- Evidence: `suggested-replies/1037.md`, Day 2 Night, after the money was handed over at T29 and the promise was marked kept:
  ```
  - yesterday … (still open: bring Sami the money on Friday — Buket must not know)
  - yesterday … (still open: bring Sami the money in cash on Friday)   [×2]
  WORDS GIVEN:
  - Emre to Sami Özüçak: You will keep Sami's credit-card trouble from Buket.
  ```
- Why it hurts: The prompt tells the writer that an open thread "is often the best option to offer". It will offer to hand over money that was already handed over (the stub's "Sami'ye zarfı ver" is exactly that), and Story mode will have Emre do it again. Two blocks in the same payload disagree.
- Root cause: `buildPlayerMemory` stores `open[]`, `playerMemoryLines` prints it, and nothing ever updates or clears it. There is also no near-duplicate check beyond a 50% `srcMids` overlap.
- Fix: Give `x_player_memory` the current open threads for the people in the span and ask for `"closed":[…]`, then clear those. At minimum, hide an open item when a promise with the same undertaking is kept or broken (`_prSameUndertaking`), or when a newer memory about the same people exists.

### 8. [Medium] The key beat of Day 2 (the secret cash hand-over) never reached the player's memory, or anyone's (a retry artefact)
- Engine(s): Memory (arc) · player (and Memory (arc)); the effect shows in Suggested replies and Your ties
- Evidence:
  - No `memory-arc-player/*` or `memory-arc/*` payload contains "zarf".
  - It does appear in `memory-arc-tracker/0894.md`, `0910.md` and `0928.md`, and each answered `"topic":"different"`.
  - The player memory goes from 0900 (the toast, before the whisper) to 0952 (starting at "Kadehimi kaldırıyorum").
  - In STATE.md, Emre's memories have no hand-over, and the Day-2 ties call (`your-ties/1079.md`) never hears of it.
- Why it hurts: Emre forgets he already paid Sami, which also feeds #7, and his tie with Sami stays "you have agreed to lend him money".
- Root cause:
  - In `_maybeBuildMemoryLocked`, a `different` verdict closes `oldStart .. newStart-1`, where `newStart` is the last user line after `oldStart`.
  - After the Retry of Sami's whisper-back, the arc began *at* the whisper and held no later user line. So `newStart = arcEnd`, and `close()` committed a 1-line span (the whisper alone).
  - On the next turn it committed another 1-line span (Sami's reply alone).
  - `commitMemoryArc` skips people with fewer than 2 heard lines, and `buildPlayerMemory` returns early when `lines.length < 2`. Yet `close()` still sets `memDoneIdx`, so both lines were marked done and lost.
- Fix: In the `different` branch, when no user line lies after `oldStart`, do not split (treat it as `same`/ongoing). And do not advance `memDoneIdx` for a span that produced no memory for anyone: leave it in the next arc. (This overlaps with the memory reviewer's area.)

### 9. [Medium] The player-memory writer is told a whispered reply was said aloud
- Engine(s): Memory (arc) · player
- Evidence: `memory-arc-player/0102.md`
  ```
  Emre: (whispered to Burcu Atan alone) Masanın altından dizine hafifçe dokunuyorum.
  (aloud) "Bu akşam Burak nöbette mi?"
  Burcu Atan: (whispered to me alone) Dizini çekmiyor … sesini yalnızca Emre'nin duyacağı kadar alçaltıyor.
  (aloud) "Gece vardiyasında. Ama burada olmaz Emre, herkes bakıyor."
  ```
- Why it hurts: Emre's memory records that Burcu said "not here, everyone is watching" out loud in front of Sami and Berker. Later suggestions can then treat that as common knowledge. For the character side, v147.2 already rules that a whisper-back is private as a whole.
- Root cause: `_playerHeardText` uses `whisperSplit` for an assistant `whisperTo` message too, so only the first `*span*` is private and the spoken reply becomes "(aloud)". (Separately, `whisperSplit` also marks the player's own quoted words as aloud. The player's speech style defines `"whisper speech in double quotes"` as part of the whisper, and the room engines heard it: `roleplay-reply/0087.md` shows Berker got `"Bu akşam Burak nöbette mi?"`. That belongs to the roleplay/whisper reviewer, but the player engines inherit the mismatch.)
- Fix: For `m.role==='assistant' && m.whisperTo`, return `(whispered to me alone) ${perceivedOnly(c)}` with no split. Then decide once whether a player whisper's quoted speech is private, and make `whisperSplit` match the documented `/whisper` convention.

### 10. [Medium] A texting character receives the room transcript of a scene they are not in
- Engine(s): Text reply (and Proactive text through the same head/tail)
- Evidence: `text-reply/0447.md` (Burcu, at home, texting Emre, who is at Isdemir). The history contains the canteen's beats:
  ```
  [NARRATION — not spoken by anyone] Emre moves to the Worker Canteen, with Sami Özüçak, Berker Özüçak
  [NARRATION — not spoken by anyone] Emre agreed to bring the money in cash; Sami's ask was granted.
  [NARRATION — not spoken by anyone] Burak Atan geldi (Isdemir, öğleden sonra)
  ```
  In the same payload the tail says `Just LEFT the scene: Burak Atan`, and her ties mark `[Sami Özüçak …] [here now]`. `proactive-text/0858.md` (Burak, at the market) marks Sami and Berker `[here now]` too.
- Why it hurts: Burcu learns of Emre's private cash deal with Sami, and that her husband came to the canteen. The payload also tells her the people at Emre's table are "here now" with her. Her text can then refer to things she cannot know, or treat Sami as being beside her.
- Root cause:
  - `castHistory(chat,forP)`: for a character with no arrival in the current scene, `arrivalCut` is the scene's travel beat. Presence notes and travel-beat prose pass on position alone (`idx>=arrivalCut`), with no witness check.
  - The event-resolution note from `resolveActiveEvent` is a `presenceNote` with no `present`, so it passes too.
  - `relSheetBlockFull` marks "[here now]" from `presentCast()` (the player's scene).
  - `sceneChangeNotice` is not gated for `textMode`.
- Fix:
  - In `castHistory`, when `forP` is not in the scene, keep only their own text thread plus lines they witnessed. Require `witnessedBy` for presence notes and travel beats.
  - Stamp `present` on the `resolveActiveEvent` note.
  - In text mode, compute "[here now]" from the texter's own location, or omit it, and skip `sceneChangeNotice`.

### 11. [Medium] Proactive text: a stale, unwitnessed "background event" is handed over as a reason to text, inside a 34k-character reply prompt with contradictory format rules
- Engine(s): Proactive text
- Evidence:
  - `proactive-text/0858.md` (Day 2 Evening) and `1032.md` (Day 2 Night), both for Burak: `# A background event just happened / Buket sabah bankaya uğrayıp kart ekstresinin bir kopyasını istedi…`. That is Buket's Day-2 *morning* errand; Burak was not there.
  - Same payload: `- OUTPUT ONLY THE WORDS YOU TYPE. Nothing else …` (l.42), `React to the highlighted line above` (l.163; there is no such line), and then `Return ONLY strict JSON` (l.215).
  - Each call is about 34–38k characters, and most of that is reply-turn rules (WHAT IT TAKES TO GET A YES, a pregnancy block, echo rules).
- Why it hurts: Burak is given Buket's private bank errand as something that "just happened", which invites a text about Sami's card that he could not know about. The contradictory format rules raise the chance of prose instead of JSON, and they crowd out the few lines that matter (the last scene, the thread, where each person is). The payload also says `You are at Site Market` at Night, which is a stale position.
- Root cause:
  - `maybeProactiveTextTick` takes `[...chat.messages].reverse().find(m=>m.worldEvent)`, the last world event of any age, with no participant check.
  - `maybeProactiveText` puts the whole `buildTextPayload` head and tail in front of the decision prompt.
- Fix:
  - Pass a world event only when it is from the current day and period and its participants include the chosen character (or choose the texter from the event's participants).
  - Build the context without the reply-only fragments (RESPONSE GUIDANCE, FORMAT — YOU ARE TEXTING, "THIS IS THE LINE YOU ARE RESPONDING TO", GET-A-YES, FINAL GUARDRAILS), or use `buildCharPromptBlocks` plus memories only.

### 12. [Low] The Auto-RP narrator expands intents with only four raw lines and no knowledge
- Engine(s): Auto-RP player narrator
- Evidence:
  - `auto-rp-player-narrator/0471.md`: `Emre just typed (rewrite this as their turn): Sami'ye mangalda Burak hikâyesini anlatmamasını söyler`. That is a Story-mode intent in the third person, labelled as typed words.
  - The context is `Recent lines` (4 lines) and `Who they are to you: … (tie words)`, with no memories or promises.
  - The average payload is about 6k characters, most of it the fixed prompt.
- Why it hurts: For an intent such as "Sami'ye zarfı ver" or "Buket'e Sami'yi sor", the narrator does not know what envelope, what is secret from whom, or what was agreed. It writes a generic line, or invents a claim the prompt forbids. The "keep the player's literal words" rule also misfires on a third-person intent.
- Root cause: `narratePlayerTurn` passes only `recent` (last 4, raw) plus `_autoRpSceneLine` and `_playerPeopleShort`.
- Fix: Add a compact `_playerKnows` subset (WORDS GIVEN plus the top 3 memories about the people present), built with `_playerHeardLine`. When the source is a suggestion or Story mode (`forceRp`), label the input "the intention to play" rather than "just typed".

### 13. [Low] The scene line lists out-of-earshot people as "Present", while THE PEOPLE HERE leaves them out
- Engine(s): Suggested replies, Story mode, Auto-RP player narrator
- Evidence:
  - `suggested-replies/0717.md`: `Present: Duygu Akbaba, Buket Özüçak, Özlem Özüçak.`, but THE PEOPLE HERE lists only Buket and Özlem.
  - `story-mode/0489.md`: `Present: Sami Özüçak, Berker Özüçak, Özlem Özüçak.` with no Özlem entry.
- Why it hurts: The model cannot tell whether Duygu (the estate gossip) can hear. It may offer to talk to her with no tie info, or treat a risky line as safe in front of her.
- Root cause: `_autoRpSceneLine` uses `presentCast(chat)`. `_playerKnows` and `_playerPeopleShort` use `_apCast` (`inSceneCast`, i.e. in earshot).
- Fix: In `_autoRpSceneLine`, split the list: "Present (within earshot): … · Also here, out of earshot: Duygu Akbaba" (`offEarshotCast`).

### 14. [Low] The player-memory writer is called on narration-only spans, and the player's own texts are unlabelled
- Engine(s): Memory (arc) · player
- Evidence:
  - `memory-arc-player/0310.md`: the whole span is the travel prose plus `Narrator: — Emre moves to the Worker Canteen … —`. No character memory was written for that span (calls 300–312).
  - `memory-arc-player/0469.md`: `Emre: Belki bir gün yine kahve içeriz, bu sefer daha sakin bir yerde.` sits inside the canteen span, while Burcu's reply is marked `(text message)`.
- Why it hurts: With nothing that happened, the model has to invent a memory. Emre's typed flirt reads as if it was said aloud in the canteen with Burak and Berker there.
- Root cause:
  - `buildPlayerMemory` counts narrator and travel lines toward its 2-line minimum. The character path in `commitMemoryArc` filters `narratorEvent` and `presenceNote` out.
  - `_playerHeardText` returns a user `textMsg` without a prefix.
- Fix: Require at least one non-narrator line. Prefix the player's texts with `(my text message to <textWithName>)`.

### 15. [Low] Scene recap: raw lines with no where or when
- Engine(s): Scene recap
- Evidence: `scene-recap/0655.md`, whose last 16 lines contain the Day-1 canteen, `— 1. gün sona erdi. 2. gün başladı. —`, Buket's bank errand, and then `Burak Atan: "Tamam Emre."`. There is no line saying where Emre is now (Day 2 Morning, at home, alone).
- Why it hurts: The recap is meant to orient the player on resume, but it cannot say "you are home, Day 2 morning". It will recap yesterday's canteen or an offstage errand as the current situation.
- Root cause: `maybeShowRecap` sends `msgs.slice(-16)` raw (texts unlabelled) with no scene line.
- Fix: Add `_autoRpSceneLine(chat)` as "WHERE THINGS STAND NOW". Build the lines with `_playerHeardLine`, which drops world events and labels texts and whispers.
