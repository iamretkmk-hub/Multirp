# Payload review — area "reply"

Engines: Roleplay reply · <name> (77 calls), Drives & brakes (79), Memory query generator (79), Turn router · player / character / gm reaction (36/23/2), Presence tracker (38).

**Overall.** The per-character reply payload is carefully built. Each character gets their own bio, own ties, own memories, a witness-filtered transcript, a correct sub-area PRIVACY block, and their own current outfit plus the player's. Their own _thoughts_ are never crossed to others, and whisper-backs are hidden from the room. The Drives writer is the best-scoped engine in the family: it gets a per-listener exchange and marks whispers "(whispered …) / (aloud)". The failures are at the edges, and several are serious:
- The addressed character's private identity sheet (secrets included) is handed to whoever answers them.
- Two "what am I answering / continuing" helpers ignore the scene and day boundary. One arrival answered yesterday's line, and the player was labelled "Berker Özüçak".
- The quest and confrontation engines mark a move as already made before the character makes it, so the one payload meant to carry the ask forbids it.
- /whisper tells the target the whole line was private while the room hears the spoken half. The user's own persona notes expect the spoken half to be private too.

The weight is also lopsided. Of an average 30.2k chars, 12.5k (41%) is fixed rule prose and 1.5k (5%) is the scene transcript. The consent rail ships on 77 of 77 turns because its gate can never close.

---

### 1. [High] The addressed character's private backstory is given to the character answering them
- Engine(s): Roleplay reply · <name> — 18 payloads (28, 52, 92, 115, 229, 311, 325, 407, 524, 536, 538, 702, 747, 775, 871, 941, 984, plus 832, see #2)
- Evidence: `payloads/roleplay-reply/0311.md` (Sami answering Berker):
  > # ⚠️ THIS IS WHO YOU ARE RESPONDING TO ⚠️ … `<their_backstory>`This is Berker Özüçak's own identity sheet, written TO Berker Özüçak… Your identity grew around being Sami's opposite, but **you have begun to want something that belongs to you and Buket alone.**

  Sami (Buket's husband) is handed his brother's secret attraction to his wife. Other cases: 0702 Buket gets Özlem's private sheet; 0747 and 0775 Özlem and Buket get Burak's ("knowing when not to make a private worry public"); 0052 Sami gets Burcu's ("you guard your family's reputation with a vigilance no one … suspects").
- Why it hurts: the model now "knows" the other person's secret motives, written in second person. It can hint at them, act on them, or start a confrontation nobody in the story could have triggered. This is exactly the card-lending bug v104.1 removed from OTHERS PRESENT.
- Root cause: `buildCharPromptBlocks`, in the "WHO YOU ARE RESPONDING TO" section. For a character target it sets `bio=subUser(String(t.backstory))` and emits `target_bg`.
- Fix: for a character target, emit no `target_bg`. The relationship sheet above already says who they are to this character. Put in its place the target's look and current outfit (worn by others, see #8). Keep `target_bg` only for the player.

### 2. [High] An arriving character answers or continues a line from another scene or another day; the player gets another character's name
- Engine(s): Roleplay reply · Sami (0832, the barbecue entrance) and · Burak (0645, the morning confrontation)
- Evidence: `0832.md`. It is Day 2 Evening at Emre's garden gate, and PRIVACY says "you are ALONE with Emre". The tail says:
  > # ⚠️ THIS IS THE LINE YOU ARE RESPONDING TO ⚠️
  > Berker Özüçak: "İyi akşamlar Emre. Liste pazartesi masanda, mangalda görüşürüz."   ← yesterday, Isdemir

  The head says: `Berker Özüçak is the human player in this roleplay.` It then prints Emre's bio, look and clothes under "Berker Özüçak's own identity sheet". RESPONDING GUIDANCE says "aimed at Berker Özüçak … You heard it — everyone here did".

  `0645.md`: Burak arrives at Emre's house on Day 2 morning ("SITUATION: You have just walked in") and is told:
  > # ⚠️ THIS WAS YOUR LAST LINE — CONTINUE STRAIGHT ON FROM IT ⚠️
  > Burak Atan: *Başını sallayıp Berker'in peşine takılıyor.* "Tamam, sağ ol Emre. Akşam nöbette görüşürüz belki." *Kapıya doğru yürüyüp yemekhaneden çıkıyor.*
- Why it hurts: the entrance line is written as a reply to someone who is not there, from a day that has passed. The player is called by another man's name in the one block that says who he is.
- Root cause:
  - `lastDialogueLine` and `selfContinueLine` walk the whole `chat.messages` and only apply `_lineReachable` (a witness check). They never apply `castHistory`'s scene cut (`arrivalCut`) or day window, so they return a line that is no longer in the transcript.
  - In `playCharacterTurn`, a speaker who is not present gets `targetName=ls; targetId=null`.
  - `buildCharPromptBlocks` then treats `!targetId` as the player (`isPlayer=(targetId==="__user__"||!targetId)`) while keeping `tName` = "Berker Özüçak".
- Fix: stop both walks at the same boundary `castHistory` uses: the current scene start or this character's arrival note. Skip them entirely when `addressed==="arriving"`. In `playCharacterTurn`, treat an unresolved target as no target (`targetName=null`), not as the player.

### 3. [High] The quest and confrontation engines mark the move as spent before the character makes it
- Engine(s): Roleplay reply · Sami (0311, the canteen quest ask) and · Burak (0645, the confrontation)
- Evidence: `0311.md`, in one payload:
  > `<pursuit_status>` … you have ALREADY asked; no real answer yet, so let it breathe and do not nag. Latest: Sami Özüçak went to Emre in person and made the ask.
  > WHY & HOW YOU'RE HERE … What you have come to do: … for Emre to bring the Friday money in cash …

  `0645.md`:
  > What you have come to do: Did Emre lean in a bit too close to Burcu Atan at Vanadium Cafe?
  > # ⚠️ WHAT YOU HAVE HEARD … You already put this to Emre on day 2, and they answered. That is done. You do not raise it again

  Burak's reply was "Tamam Emre." (stub, but the payload leaves no correct answer).
- Why it hurts: the payload whose only job is to make the ask also forbids the ask. A faithful model stalls, hints vaguely, or does nothing, and the pursuit or confrontation is then logged as delivered.
- Root cause: `checkCharQuestApproach` sets `q.awaitingUser=true`, `q.delivered` and the `charQuestNote` "…made the ask" before `startOverture` runs the scene. `charQuestSheetLines` then renders that as "ALREADY asked". `maybeSpawnConfrontation` stamps `g.raisedBy[stakeholder]=day` before `startConfrontation`, so `buildTailBlocks` picks `rumor_stake_spent`.
- Fix: stamp these after the holder's first posted line in the event (or on event resolution). Alternatively, suppress `pursuit_status` and `rumor_stake_spent` while `chat.activeEvent.accuserId===self` and the event is unresolved.

### 4. [High] /whisper: the target is told the whole line was private, but the room hears its spoken half
- Engine(s): Roleplay reply (target and bystanders), Memory query generator
- Evidence: target `0068.md` (Burcu):
  > (Emre does this close, for you alone — nobody else in the room hears it, sees it, or is told it happened. Whatever is said and whatever is done here is between the two of you): Masanın altından dizine hafifçe dokunuyorum.
  > "Bu akşam Burak nöbette mi?"

  The trailing THIS IS BETWEEN THE TWO OF YOU block adds "Nobody else in this room heard it". Yet in `0087`/`0092` and every later Sami and Berker payload of the scene (11 payloads) the transcript has `Emre: "Bu akşam Burak nöbette mi?"`. At the barbecue, Berker's payloads 0916, 0941, 0963, 0978 and 1017 carry `Emre: "Cuma'yı bekleme, şimdi al. Ama bu son."`, the secret money handover he is primed to object to. The Drives writer's input (`drives…/0069.md`) shows the true split correctly: `(whispered to Burcu Atan alone) … (aloud) "Bu akşam Burak nöbette mi?"`.
- Why it hurts: the target answers on the belief that the exchange is private, while the husband's friends heard the question. In the barbecue case Berker heard the handover in plain words. The user's own persona speech-style note documents `/whisper <name> *hidden narration* and/or "whisper speech in double quotes"`, so the player expects the quoted speech to be private too. The app honours only the first `*span*`.
- Root cause: `whisperSplit` treats only the first `*…*` as the aside. In `castHistory` the target's version prefixes `whisper_to_you` and appends `_sp.open` unmarked. `whisper_back_guidance` and `lastDialogueLine` (raw content) repeat the "nobody heard" claim.
- Fix: (a) Make a quoted span that directly follows the aside span (or a `"…"` given right after `/whisper Name`) part of the aside, matching the documented usage. (b) Whatever stays public, label it in the target's history and highlighted line, e.g. `(aloud, in front of everyone:) "…"`, and change `whisper_back_guidance` to "only the part marked private".

### 5. [Medium] "OTHERS PRESENT (within earshot)" and [here now] name people PRIVACY says cannot hear
- Engine(s): Roleplay reply — 36 of 77 payloads (every canteen turn with Özlem; market turns with Duygu)
- Evidence: `0311.md`:
  > # OTHERS PRESENT (within earshot)
  > - Berker Özüçak
  > - Özlem Özüçak

  Also `• [Özlem Özüçak — sister-in-law] [here now]`, and later in the same payload: `Not in this room, but elsewhere in Isdemir: Özlem Özüçak (in the Main Security Gate). They cannot hear what you say here`. `0775.md` has the same pattern for Duygu at the Fountain Corner.
- Why it hurts: two blocks disagree on who is listening. Characters address or guard against someone who is not there, which is exactly what the Sami money talk and the Buket card talk depend on.
- Root cause: `playCharacterTurn` builds `others` from `presentCast(chat)` (the whole location). That feeds `others_present` and the relationship sheet's `[here now]` marks in `buildCharPromptBlocks`, while PRIVACY uses `inSceneIds` (the sub-area).
- Fix: build `others` from `inSceneCast(chat)`. Mark off-earshot people "[nearby, out of earshot]" in the sheet rather than "[here now]".

### 6. [Medium] Drives & brakes always come from the previous moment, and after a scene change they describe the wrong room
- Engine(s): Roleplay reply (the WHAT YOU ARE CAUGHT BETWEEN block) and Drives & brakes
- Evidence: `0832.md` has Sami alone with Emre at the garden gate on Day 2 evening, but the block says:
  > WHAT HOLDS YOU BACK — Berker is sitting right there with the ledger in his head; one wrong joke and the debt comes out in front of everyone.

  That text was written at the Day 1 canteen; the fresh drives (0833) are generated after the reply. Burcu's reply to the knee touch (0068) carries drives written before it ("You want to be looked at…"). The drives that respond to it ("You want to answer him… It cannot be here", 0069) first reach her at T8 (0161).
- Why it hurts: the pull and brake the model is told to write from are about a previous situation. Here the brake names someone absent in a private scene, which pushes a guarded line where a private one fits.
- Root cause: `buildTailBlocks` calls `psycheRefreshIfStale` fire-and-forget, then `psycheFor(chat,p)`, which returns the stored record without comparing its `sig` to the current `psycheSig`.
- Fix: keep the non-blocking refresh, but when the stored sig differs in location, sub-area, day, period or present-set (the scene part of `psycheSig`), omit the block for this turn. Alternatively, await the refresh once on a scene change.

### 7. [Medium] An arriving character cannot hear the greeting addressed to them
- Engine(s): Roleplay reply · Burak (0391, the canteen entrance)
- Evidence: the player typed "Burak! Hayırdır, nöbetten önce mi geldin?" and Sami greeted Burak while he stood at the door (GM beat in 0362, msg [20]). `0391.md` contains only:
  > [NARRATION — not spoken by anyone] Burak Atan geldi (Isdemir, öğleden sonra)

  It has no "THIS IS THE LINE YOU ARE RESPONDING TO" block, yet RESPONSE GUIDANCE says "React to the highlighted line above: that is what Emre just said or did".
- Why it hurts: Burak's entrance ignores the question he was just asked, and the guidance points to a line that does not exist.
- Root cause: `castHistory` cuts at the character's arrival note (`arrivalCut`), and `_lineReachable`/`witnessedBy` exclude lines whose `present[]` lacks the approaching participant. Lines spoken while `activeEvent.participant.approaching` are said to them but never stamped as heard by them.
- Fix: while an event participant is approaching, include them in `present` for lines posted after `activeEvent._startMsg` (or start their `arrivalCut` at `_startMsg`). Drop the "highlighted line" sentence when no last-line block was built.

### 8. [Medium] Other characters' visible actions are deleted, so each character sees only words
- Engine(s): Roleplay reply (all multi-character scenes)
- Evidence: `0916.md` (Berker at the barbecue) shows `Sami Özüçak: "Eski günlere! Bir de… Cuma'ya."`. Sami's actual line (0922, own view) was `*Rakı bardağını kaldırıyor.* "Eski günlere! Bir de… Cuma'ya." *Emre'ye anlamlı bir bakış atıyor.*` The meaningful glance at Emre, the one thing Berker would react to, is gone. Every other-character line in 0087 and 0092 has lost its `*…*`. Others present are otherwise listed by name only, with no outfit and nothing about what they are doing. Across all replies the transcript averages 1.5k chars.
- Why it hurts: characters read as if they are in separate rooms (the code comment itself names this symptom). They cannot react to a glance, a pour, a hand on an arm, or someone standing up to leave.
- Root cause: `castHistory` calls `crossHeard`, and `narrPrivacyMode()` defaults to "spoken" (only quotes cross). `compactHistory` also strips the player's older actions (`stripNarr` default true, keep 6).
- Fix: default `narrPrivacy` to "seen". It still drops `_thoughts_` via `perceivedOnly`, and whisper asides are already filtered separately. Add each in-earshot person's current outfit (the same `currentOutfit` used for the player) to OTHERS PRESENT.

### 9. [Medium] The memory query for a character includes a private reply, a thought, and scenes they were not in
- Engine(s): Memory query generator (called from `playCharacterTurn` → `retrieveMemories`)
- Evidence: `memory-query-generator/0086.md` and `0091.md` (for Berker and Sami, T5), under "Emre's newest message:":
  > Burcu Atan: "Gece vardiyasında. Ama burada olmaz Emre, herkes bakıyor." _Kalbim neden bu kadar hızlı atıyor?_

  That is Burcu's whisper-back plus her private thought. `0831.md` (for Sami arriving at the barbecue) contains the Site Market conversation between Emre, Özlem and Buket, which Sami never attended. The "newest message" section also holds four lines from four speakers and repeats the "Recent conversation" section.
- Why it hurts: memories are retrieved using keywords from things this character never heard, such as "Burak night shift" or the market talk. The comment in `playCharacterTurn` ("the query is what THIS character heard") is not true.
- Root cause: `castConvoText(chat,4,p.id)` does not check `witnessedBy` and does not drop thoughts. It routes a character's whisper-back through `whisperOpenPart`, the player-aside splitter that v147.2 already rejected for `castHistory`, so everything after the first `*span*` goes out. `genQuery` then labels that text "Emre's newest message".
- Fix: in `castConvoText` with a viewer, apply `_lineReachable` (witness plus whisper), drop any whisper-back from someone else entirely, and pass text through `crossHeard`. Or just pass the last reachable line as `userText`, since `genQuery` already builds the filtered "Recent conversation".

### 10. [Medium] Arrival scaffolding for someone already in the room
- Engine(s): Roleplay reply · Sami (0311, the canteen quest ask; 0362 shows the resulting transcript)
- Evidence: Sami has spoken three canteen lines (msgs [17]–[19]). The transcript then gets `[NARRATION] Sami Özüçak geldi (Isdemir, öğleden sonra)` and the head gets `# SITUATION You have just walked in. Give a brief entrance beat`. The same payload also answers Berker's line with an ADDRESSEE NOTE.
- Why it hurts: three contradictory framings in one turn (entering, answering Berker, making a private ask), plus a false "arrived" beat that later payloads keep showing.
- Root cause: `checkCharQuestApproach` → `startOverture` sets `participant.approaching:true` and runs `runSceneWriter` → `playCharacterTurn(…,"arriving")` without checking `inSceneIds(chat).includes(holder.id)`.
- Fix: if the holder is already in earshot, skip the bring-in and presence note, and play the turn as a normal pinned turn to the player (`answerTo:"__user__"`) with the WHY & HOW block but no `situation_arriving`.

### 11. [Medium] Waste: fixed rules outweigh the scene about 8 to 1, and the consent rail can never switch off
- Engine(s): Roleplay reply
- Evidence (averages over 77 calls, 30.2k chars each):
  - fixed rule prose: 12.5k (41%)
  - own bio: 3.4k
  - ties: 2.6k
  - FINAL GUARDRAILS: about 4.2k
  - WHAT IT TAKES TO GET A YES: 2.3k, present in 77 of 77 payloads, including shift-plan chat. Every one also carries the "AN ASK IS NOT ONLY A SENTENCE" physical-ask section, and Sami and Burak both get "From your husband it is nothing."
  - transcript: 1.5k (5%)
- Why it hurts: the scene the model is supposed to answer is a small island between two large rule walls. The consent and escalation rail sits closest to generation on every ordinary line, which pushes resistance into small talk.
- Root cause: in `buildTailBlocks`, `_physical` is true if any of the last six messages contains `*…*`. Every character reply contains one, so `_asked` is always true. The code comment warns about this failure mode for `_psycheBodySig`, but the six-message window has the same flaw.
- Fix: base `_physical` on the answered line (`_answering.text`) and on the player's last line only. Ship `resistance_actions` only when that line contains an action aimed at this character. FINAL GUARDRAILS could also lose the paragraphs that repeat STRUCTURE and LIMITS (the one-narrated-beat rule appears in both).

### 12. [Low] An English engine verdict is posted as narration inside characters' transcripts
- Engine(s): Roleplay reply (0362 and later canteen payloads)
- Evidence: `0362.md` msg [19]:
  > [NARRATION — not spoken by anyone] Emre agreed to bring the money in cash; Sami's ask was granted.
- Why it hurts: an out-of-world English verdict ("ask was granted") sits in a Turkish scene as if it were narration. It tells every listener, Berker included, that the cash deal happened.
- Root cause: `resolveActiveEvent` pushes `{presenceNote:true, sysError:true, content:"— "+how+" —"}` with `how=j.resolution` (English engine text). `castHistory` keeps all presence notes.
- Fix: tag it `uiNote:true` (which `castHistory` drops) or `worldEvent`, so characters never receive it.

### 13. [Low] Ties are stated twice for everyone present
- Engine(s): Roleplay reply and Drives & brakes
- Evidence: `0311.md` has "Berker is your younger brother, meticulous and resentful, who has been cleaning up after you since childhood; you love him fiercely and lean on his stability shamelessly…". A few lines later, the bullet `[Berker Özüçak — younger brother] [here now]` says "…You love him fiercely and lean on his stability shamelessly, telling yourself it's just what brothers do." Özlem and Emre are covered the same way; ties average 2.6k.
- Root cause: `buildCharPromptBlocks` → `relSheetBlockFull(p,{scope:"present"})` prints the `socialGraph` summary and then the full sheet for each present person. The Drives engine already dropped the summary for this reason (v67.1, `sheetsOnly:true`).
- Fix: drop summary sentences about people who get a bullet, or print only the bullets plus a names-only line for absent kin.

### 14. [Low] The player turn router gets whispers unmarked, and its hooks are clipped exactly where the secret starts
- Engine(s): Turn router · player (character router and gm-reaction router share the hooks sheet)
- Evidence: `turn-router-player/0085.md`:
  > - Sami Özüçak: You are the older brother who never grew up: charming, impulsive, and allergic to…
  >     hooks: … wound him by calling him a bad brother or a child; threaten exposure of…

  "Recent exchange" lists `Emre: *Masanın altından dizine hafifçe dokunuyorum.* "Bu akşam Burak nöbette mi?"` and Burcu's whispered reply as ordinary lines. The gm-reaction router `0360.md` promises "relationships to the narrator and Emre, and current emotional state", none of which is sent.
- Why it hurts: the router can send Sami to react to a knee touch he never saw. It loses the "threaten exposure of X" part of each hook, which is what the router is supposed to decide on.
- Root cause: `runMultiCharTurn` uses `briefDesc(c.personality,90)` (a second-person card) and `briefDesc(c.interject,140)` for the roster, and `castConvoText(chat,8)` with no viewer and no whisper marking. `gamemasterReactions` and the character chain reuse the 140-char hooks.
- Fix: mark asides the way `recentExchangeFor` does for Drives. Raise the hook clip to about 300 characters. Use a third-person one-liner instead of the card's "You are…".

---

**Checked and fine:**
- Each character's own _thoughts_ never reach another character's reply transcript.
- Whisper-backs are fully hidden from the room (v147.2).
- Retried replies do not leave the discarded version in later payloads (0130/0145, 0886/0903).
- The player's outfit and location, sub-area and period are current in every reply sampled.
- The Presence tracker gets correct area-by-area positions.
- The Drives writer's input is per-listener and marks whispers correctly.

**Not counted as findings:** memory contents such as "I was there when … touched my knee" in Burak's memory, and "You are left with: …" residues. Those are artefacts of the stub (`stubs.js` line 421), not the app.
