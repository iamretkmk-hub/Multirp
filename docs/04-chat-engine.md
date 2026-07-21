# 04 · Chat Engine — from keypress to reply

## Turn lifecycle (typed input)

```
sendMessage()
 ├─ "/whisper Name msg"  → sendWhisper()          (private aside; only that character hears)
 ├─ "/…" OOC command     → handleOOC()            (never narrated, never enters payloads)
 ├─ _heatSeq++                                     (any player turn cancels a pending heat burst)
 ├─ Auto-RP on? → narratePlayerTurn(text)          (rewrite terse input into an in-voice turn;
 │                                                  input locked with "writing your turn…";
 │                                                  falls back to raw text on any failure)
 ├─ push user message {mid, role:user, content, present: presentIds(chat)}
 ├─ nobody present?      → postTurn(chat) only     (directors may bring someone; no reply)
 ├─ >1 present           → runMultiCharTurn(chat, text)
 └─ exactly 1 present    → solo flow:
      retrieveMemories() → buildPayload("solo", head, tail) → castHistory() (witness-scoped)
      → tagLastForTarget() → [head system] + history + [tail system] (+ GM director note)
      → chatCompletion(rp:true) → refusal fallback → push assistant msg
      → autoVisualize (image) + autoSpeakMsg (TTS) + runVoiceCheck   (all background)
      → enqueuePresent (typewriter) → runPresenceTracker → maybeBuildMemory → postTurn → maybeHeatBursts
```

The final request for any reply path is always:
**`[system: payload head]` + `mapped chat history` + `[system: payload tail]`** (+ an optional
one-shot `[system: Director's note …]` when `chat.pendingGmNudge` is set — consumed and
cleared). Either system message is skipped when the user's payload layout emptied that side.

## OOC commands (`handleOOC`, never sent to any model)

| Command | Effect |
|---|---|
| `/bring Name` (`/call`, `/add`) | Narrated arrival; character becomes present |
| `/leave Name` (`/send`) | Narrated send-off; removed from scene & world position |
| `/remove Name` | **Soft-delete**: marks `removed` (dead). Card/memories/relationships kept, but the character is inert everywhere (no replies, routing, GM summons, gossip, intents). |
| `/revive Name` | Undo `/remove` |
| `/text Name: msg` / `/text Name` | Send a phone text / open the text window |
| `/who` | List who is nearby |
| `/whisper Name msg` | Private aside — only that character's payload sees the content |
| `/go`, `/messages`, `/close` + voice synonyms | Hands-free operator layer (`handsFreeCommand`) |

## Auto-RP (player narrator)

`narratePlayerTurn` wraps the player's terse input using the `playerNarratePrompt` engine
prompt filled with `{{user}}`, `{{player_profile}}` (name/personality/style/bio/look — per-
universe overrides apply), `{{scene}}` (day/period/place/present), plus the genre-pack voice
tail and `langDirective()`. In narration-mic mode the player's spoken words are quoted
**verbatim** (`opts.verbatim`) — only narration is authored around them. Model:
`playerNarrateModel` → falls back to the roleplay model.

## Multi-character turns (`runMultiCharTurn`)

1. `runPresenceTracker` first (the player may have narrated arrivals/exits).
2. Cast = `inSceneCast(chat)` — only characters in the player's **sub-area (earshot)**.
   Empty ⇒ a narrator `presenceNote` explains who is elsewhere ("use Move to area").
3. **Router 1** (`routerPlayer` prompt, `mcModel`): given the roster (+ per-character hooks)
   and the player line → JSON `{addressed, responders[]}`. De-duped, capped at **2**
   responders; fallback = first present. Each responder plays a turn (`playCharacterTurn`).
4. **Router 2 chain** (`routerChar` prompt): after each line, asks whether another present
   character was clearly addressed/provoked → JSON `{continue, responder}`. Bounded by
   `mcChainCap`; each character speaks at most once per chain (`spokenThisChain`), with one
   optional self-defense rebound (`defendedThisChain`). Deliberately rare — most turns return
   to the player.
5. `maybeBuildMemory` → `postTurn` → `maybeHeatBursts`.

`playCharacterTurn(chat, p, addressed)` builds the **multi** payload for that one character:
memory retrieval scoped to them, target resolution from the *freshest real line in the
transcript* (not the router's stale `addressed`), witness-scoped history, refusal fallback,
`Name:` prefix stripping, and awaits the on-screen reveal so chains pace correctly.

## Refusal & empty-reply handling (both reply paths)

- `looksLikeRefusal()` catches canned refusals (CJK "无法…" patterns, English "I can't…", or a
  reply that is overwhelmingly CJK when the story language isn't).
- On refusal: retry **once** on `fallbackModel` → else `mcModel` → else give up with an honest
  toast ("model declined — try a different model"), never rendering the refusal text and never
  blaming max-tokens.
- Separately, `chatCompletion` itself rescues *empty* responses (reasoning models burning the
  budget) with one automatic retry at ≥1600 tokens.

## Heat of the moment (`maybeHeatBursts` → `runHeatBursts`)

When `heatOn`: after the player's turn resolves, ONE extended continuation is generated —
worth ~`heatN` normal replies — voiced by the present character who has spoken longest ago.
Implementation: `chat._heatBeat={total}` (transient) makes `buildTailBlocks` append the
`heat_advance` guardrail fragment; max-tokens gets a `450×N` headroom bump. Guards: single
flight (`_heatBusy`), once per tail message (`_heatRanMid`), cancelled by any new player input
(`_heatSeq`).

## Presence & witness scoping (why characters don't "hear" everything)

- Every message stores `present:[ids]` at creation — the witness list.
- `runPresenceTracker` runs only when `hasPresenceCue()` finds movement/greeting language
  (a large EN+TR cue list — a cheap pre-filter to avoid an LLM call per turn), then the
  `presencePrompt` engine returns `{exit, enter}`; `applyPresence` moves characters, writes a
  `presenceNote` (with `enteredIds`/`exitedIds`), and clears per-character image continuity.
- `castHistory(chat, p)` builds the transcript **as character p experienced it**:
  - Scene boundary: cut at the last `travelBeat` (a location change starts a fresh scene),
    with bridging so companions keep shared context.
  - Day window: only the last **2 game-days** of dialogue (older facts are memory's job).
  - Witness filter: a line with `present[]` not containing p is dropped (legacy name matching
    tolerated); untagged dialogue defaults to **excluded** (leak-safe).
  - **Private narration** (`narrPrivacy`, default on): other characters' `*narration*` is
    stripped via `spokenOnly()` — a character only witnesses their own and the player's
    narration, but hears all spoken dialogue.
- `mapMsgToApi` converts messages to API form (assistant lines carry `name:`; narrator
  events/presence notes/day markers become Narrator lines).
- `compactHistory` then applies the cost controls: hard cap `histTurns` (default 20), and
  optional narration-stripping of all but the last `stripKeepFull` messages (Narrator lines
  exempt — they carry scene state).

## Rendering pipeline

`renderChat()` full-renders the window; `appendNewBubbles()` appends deltas;
`refreshBubble(mid)` re-renders one bubble in place (used by image/video state changes —
remember `markChatDirty`). New assistant text flows through the presentation queue
(`enqueuePresent` → `typewriterReveal`), which is *display-only*: generation, persistence,
image and voice all fired before the reveal starts.

## Cross-effects to keep in mind

- Editing/deleting messages (`saveEditMessage`, `deleteMessage`) changes history that memory
  arcs may span — `memDoneIdx` is clamped defensively, but bulk deletions mid-arc can still
  shift arc boundaries.
- `present[]` is load-bearing for **three** systems: history scoping, memory building
  (`witnessedBy`), and bystander gists. Never fabricate or rewrite it.
- The solo path and multi path must stay **symmetric in block content** (payload coupling
  guard #2) — fix producers in both, or a solo-only fix will desync the multi payload.
- Phone texts (`textMsg`) deliberately carry `present:[]` so they never leak into scene
  history or scene memory; they have their own memory path (`rememberTextExchange`).
