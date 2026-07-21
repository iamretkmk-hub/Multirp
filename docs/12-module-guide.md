# 12 · Adding & Removing a Module

A "module" here means a self-contained feature: usually a toggle + settings, one or more
engine prompts, an engine function hooked into `postTurn` and/or End Day, some payload
surface, and UI. This doc is the end-to-end checklist for both directions. The examples to
imitate are recent well-built modules: **character quests (v23.2)**, **world pulse (v19.8)**,
**proactive texts**, **the tracker engine**.

---

## Adding a module

Work through the checklist top to bottom; every step names the exact place to touch.

### 1. State & persistence
- [ ] Add a key to the `K` map (`sm_yourfeature…`) for every persistent value (toggle,
      threshold, prompt, model override). **Never reuse or rename existing keys.**
- [ ] Add defaults in `loadState()` (follow the defensive parse patterns there — clamp
      numbers, boolean via `store.get(k, default)`).
- [ ] If the module owns a *growing collection*, do NOT put it in localStorage — store it on
      the chat (`chat.yourList`, persisted automatically by the chat pipeline) or the
      universe (`universe.gameData.*`, persisted by `persistUniverses`), or add an IDB kv key
      (follow `scenes`).
- [ ] Transient runtime flags go in `_`-prefixed properties (auto-stripped on persist).

### 2. Prompt(s)
- [ ] Define `DEFAULT_YOURPROMPT` near the related section banner, written like the existing
      ones: role, inputs, hard output contract ("Return ONLY JSON {…}"), tone guidance.
- [ ] Register it in `PROMPT_REGISTRY` (`{key, label, def, json, hint}`) — the hint must list
      the supported `{{placeholders}}` and the return shape; the placeholder picker and the
      "Write with AI" JSON-requirement detection read this.
- [ ] Map it into `ENGINE_PAYLOAD_DEFS` under a fitting payload card (prompt block +
      `{kind:"dyn"}` blocks describing the live data your engine assembles). If you forget,
      `_enginePayloadCoverage` dumps it into "Other prompts" with a console warning — map it
      properly. ⚠️ The array property must be named `blocks`.
- [ ] Add the `store.setRaw(K.yourPrompt, state.yourPrompt)` persist line in `saveSettings`.
- [ ] Per-universe overrides come **for free** once it's in the registry (the `up(key)` chain
      + the universe editor prompt list + the prompt tuner). Always read prompts via
      `up("yourPrompt")`, never `state.yourPrompt` directly.

### 3. The engine function
Follow this template (it is the house style — every engine looks like this):

```js
async function runYourEngine(chat /*, day, uni…*/){
  if(!state.yourFeatureOn || !state.key) return;          // gates first: toggle + key
  // …rate limits / caps / cadence checks…
  const sys = fillTpl(up("yourPrompt"), {user:state.user, /* …placeholders… */})
            + _gpTail("drama", chat)                       // genre pack, if content-flavored
            + "\n\n" + langDirective();                    // ONLY for player-visible prose
  const out = await chatCompletion(
    [{role:"system",content:sys},{role:"user",content:liveData}],
    state.memModel /* or its own model with a fallback chain */,
    {temp:fnTemp("mem",0.3), max:fnTok("mem",400), dbg:"Your engine · label"});
  const j = parseJSON(out); if(!j) return;                 // fail soft, never throw upward
  // …apply effects; persist what changed; markChatDirty where needed…
}
```
Rules: background engines never set `rp:true` (sampling must stay default), never enable
reasoning, always carry a `dbg` label, and are called inside `try{}catch(e){}` from their
hook site (a module failure must never kill the turn).

### 4. Hook it into the clocks
- [ ] Per-turn: add the call in `postTurn(chat)` — position matters (before/after the
      scene-consuming checks; read the order table in doc 08). Background (`.catch(()=>{})`)
      unless it decides who speaks next.
- [ ] Per-day: add it in `endDayBackground` at the right pipeline position (after the data it
      reads is written, before whatever reads its output). Pass `uid` vs `uniObj` correctly.
- [ ] If it can *consume the turn* (arrivals, events), return truthy and follow the
      `if(await …){return;}` pattern so the Gamemaster doesn't double-fire.

### 5. Payload surface (only if replies must know about it)
Follow the **four-place rule** (doc 05) exactly:
- [ ] produce the block in `buildTailBlocks` (or the head builders — both solo+multi paths),
- [ ] add the id to `order` of `solo`, `multi`, **and** `gm`,
- [ ] add the `blocks{}` metadata entry,
- [ ] route all fixed prose through a new `BLOCK_TPL_DEFAULTS` fragment + list it in
      `_attachBlockTpls` (the 3-leg).
Self-healing means no migration is needed; users' saved layouts pick the block up at its
default position.

### 6. UI (a modern module surface)
- [ ] **Settings card** in the fitting `details.sgroup` (usually 7 · Game Preferences):
      `div.card` → `h3` with icon → `kvline` toggle rows (`switchLbl`), numeric inputs with
      `label` + `div.desc` explaining behavior *and cost*. Model pickers go in
      2 · LLM Selection with a documented fallback ("blank = memory model").
- [ ] Wire every new input into `syncSettingsUI` **and** `saveSettings`.
- [ ] Chat-facing controls: a `#chatMenu` button, a mode row in `#modesMenu` (+
      `_modeState`/`toggleMode`/`reflectModes`), or a badge (follow `calBadge`).
- [ ] Modals: `div.modal` + `card editCard` + ✕ close; open/close via
      `openModal/closeModal`; all dynamic HTML through `esc()`; icons from the sprite defs
      (add a `<symbol id="i-…">` if needed).
- [ ] In-chat output: reuse the message-flag system — a `narratorEvent` for world events, a
      `presenceNote` for movement, `sysError` for inline notices. Don't invent new bubble
      types unless the renderer needs to treat them differently.
- [ ] **Sweep every `onclick`/`oninput` name in your generated HTML and confirm the function
      exists globally** — the v19.21 lesson; `node --check` can't catch it.

### 7. Debug, backup, docs
- [ ] All network calls through `dbg()/dbgDone()`.
- [ ] New localStorage keys are automatically in the full backup (it snapshots all of
      localStorage); if you added an IDB kv collection, add it to `buildBackup`/
      `applyBackupBundle` and the relevant granular export set.
- [ ] Add the section banner comment (`/* ===== YOUR MODULE ===== … */`) and a line in the
      SCRIPT MAP if it's a top-level system. Update these docs.
- [ ] Bump `#buildStamp` + `sw.js` `CACHE_VERSION` on release.

---

## Removing a module

Removal is the mirror image, and the ordering matters: **UI first, then hooks, then state** —
at every step the app must still boot. Non-destructive discipline applies: user *data* your
module created should stay readable or be migrated, never silently dropped.

### 1. Find every tendril
```
grep for: the K keys · the state property names · every function name ·
the prompt key(s) · the block id(s) · element ids · "yourFeature" in onclick strings
```
(Generated-HTML call sites don't show up as JS references — grep the whole file as text.)

### 2. UI removal (the part people forget)
- [ ] Delete the Settings card(s) — and the matching reads in `saveSettings` +
      writes in `syncSettingsUI`. ⚠️ A leftover `getElementById` read of a removed element
      **breaks saving settings entirely**.
- [ ] Delete chat menu buttons, modes-menu rows (+ their `_modeState` entries), badges,
      modals, nav entries, gallery tabs — and their handler functions.
- [ ] Delete per-bubble affordances the module added (buttons in `bubble()`/`sceneHTML`).
- [ ] Remove the icon symbols only if nothing else uses them.

### 3. Engine & hook removal
- [ ] Remove the calls from `postTurn` and `endDayBackground` (don't leave a dangling
      `await runGone()`).
- [ ] Remove the engine functions, the `DEFAULT_*` prompt, the `PROMPT_REGISTRY` entry, the
      `ENGINE_PAYLOAD_DEFS` mapping, and the `saveSettings` persist line.
- [ ] Payload blocks: remove the producer output, the id from all three `order` arrays, the
      `blocks{}` entry, and the fragments (all three legs). Saved user layouts self-heal
      (unknown ids are dropped by `payloadOrder`), so no migration is needed.

### 4. State & data
- [ ] Remove the `K` keys and `loadState` defaults. Leftover `sm_*` values in users' storage
      are harmless (ignored) — optionally add a one-shot cleanup like the existing
      `sm_queststandalone_v1` pattern, but **never** wipe data the user may want (follow the
      quests-standalone migration: it *preserved* orphaned data and marked it reachable).
- [ ] If chats/universes carry module fields (`chat.yourList`), leave the reads tolerant or
      migrate; old backups will re-import those fields.
- [ ] Check the granular export/import sets for references.

### 5. Verify
- [ ] Boot with a fresh profile AND with an old export imported — no console errors, the
      boot-time coverage guards are quiet.
- [ ] Open every Settings section, hit Save, reload — values stick.
- [ ] Click through the chat menu, modes menu, a full turn, End Day.
- [ ] Grep once more for the removed names — including inside template strings.

---

## Design values to preserve (why the checklists look like this)

1. **Nothing hidden**: every model, prompt, threshold and toggle a module uses must be
   visible in Settings — the codebase repeatedly calls out "was hidden — now selectable" as
   fixes. Don't hardcode a model id or a magic prompt.
2. **Fail soft**: an engine that errors skips its beat; the story never blocks on a module.
3. **Rate-limit by design**: everything that can fire on its own (texts, approaches, pulses,
   gossip) has caps and cadences in Settings. New autonomous behavior needs the same.
4. **Code decides, LLMs judge**: gates, dice, caps, placement, due-matching are evaluated in
   code; LLMs only produce judgments/content (see char-quest gates, tracker dice, calendar
   due-matching). Keep that split.
5. **Old saves behave identically**: additive migrations, self-healing layouts, byte-stable
   defaults.
