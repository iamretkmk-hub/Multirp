# Image engines: payload review (Visual director, Scene selector, Image prompt writer, final image requests)

**Overall.** The v148.2/v148.3 rework does what it set out to do at the request level. In all 23 frames sent to the reference-picture model (`bytedance/seedream-v4.5/edit`), the pictures sent match the cast list one to one, in the same order. The IMAGE/Figure labels agree with the picture order, the player is never sent in a POV frame, and a person who leaves (Burcu at T9, Burak at T18) drops out of the next frame. Each person gets their own WHAT EACH PERSON IS DOING and WHAT EACH PERSON IS WEARING line. `_imgVisualOnly` removes dialogue and `_thoughts_`: a scan of all 46 image-writer payloads found no quoted speech or thought. Several things still point the model the wrong way:
- The fixed scene-type templates still forbid what the request now asks for (the location, describing people in words) and are written for a single "she".
- The continuity reference is stored per speaker, but the IMAGE numbers are reassigned every frame, so it attributes poses and clothes to the wrong person.
- The outfit table is re-read from (place, period) on every frame. That is how Sami ends up in "low-slung black boxer briefs" while seeing guests out after a barbecue, and how everyone changes clothes when they walk from the café to the factory.
- The words-only path (23 of 46 frames) sends no identity at all.
- The visual director and the router still get raw lines, with thoughts, and without the place, the time of day or who is present.

Stub responses are ignored throughout. Only the requests are judged. Every frame was routed to "Standard / daily — your POV", so the third-person and intimate paths were not exercised.

Frame ↔ call mapping used below: image-prompt-writer call #N produced the image request with the same index in `out/images.jsonl` (46 ↔ 46, same order).

---

### 1. [High] The scene-type block contradicts the request, and the app tells the writer that the block wins
- **Engine(s):** Image prompt writer (all 46 calls; system prompt 17,087 chars)
- **Evidence:** `out/payloads/image-prompt-writer/0009.md` (same in every call)
  - rewritePrompt: `# WHERE IT HAPPENS — YOURS TO WRITE … The LOCATION is no longer among them — that one is yours.` and the user block `WHERE THIS FRAME HAPPENS — render this as part of the picture`
  - POV block guardrail: `Never a location, room, background, landscape, furniture-as-setting … All of it is appended after you.`
  - Frame guide: `The scene-type block above governs the frame. Where this note and that block disagree, the block wins`
  - Also in the same prompt: `She is IMAGE 1 and the frame is hers.` while the cast says `the man in IMAGE 1 = Sami Özüçak`. `Draw everyone the latest exchange puts in this moment and nobody else` against `Everyone listed is in the picture` (Berker and Duygu are listed with "no action of their own"). rewritePrompt `NAME THE FEELING. ONE plain word … Do NOT assemble a face out of parts` against POV §4 `build the rest from parts … An emotion word is not an expression`.
- **Why it hurts:** A model that follows the stated order of authority leaves the setting out. Since v100.1 nothing appends the location any more (only lighting is on the tail), so the frame ends up with no place at all. In multi-person frames where IMAGE 1 is a man (Sami or Berker in 17 of the 23 reference-model frames), the whole template talks about "her face / her hands / her dress". It may also drop the listed people who have no line in the exchange ("never add one").
- **Root cause:** The `IMG_STYLE_POV` and `IMG_STYLE_INTIMATE` constants (and the older base style near them) still carry the pre-v100.1 guardrail and the single-woman wording. `illustrate()` builds `sys = rewritePrompt + _classStyle + imgFrameGuide (+ imgPovGuide)`. imgFrameGuide ("the block wins") was written before the location, the cast and the per-person blocks moved into the user message.
- **Fix:** Remove "location / room / background / furniture-as-setting" from the guardrails of every built-in style and say "the setting comes from WHERE THIS FRAME HAPPENS". Make the templates gender- and count-neutral ("the person in IMAGE 1, whose line this is"; "anyone else listed is IMAGE 2 onward"). Replace "Only the people the latest exchange puts in this moment" with "exactly the people in the PEOPLE IN THIS FRAME list". In imgFrameGuide, give the user-message blocks (PEOPLE, DOING, WEARING, WHERE) precedence over the template on who, what they wear and where. Pick one rule for faces and delete the other.

### 2. [High] The continuity reference comes from this speaker's last frame, with IMAGE numbers from a different ordering: poses and clothes are pinned on the wrong person
- **Engine(s):** Image prompt writer
- **Evidence:**
  - `out/payloads/image-prompt-writer/0417.md` (T17, cast: IMAGE 1 Berker, **IMAGE 2 Burak**, IMAGE 3 Sami). The continuity reference is Berker's previous frame: `the man in IMAGE 2 leans in close by the canteen window, speaking low, one hand on the viewer's arm, wearing standard-issue navy coveralls` (that was Sami).
  - `.../0113.md` (cast: IMAGE 2 = Berker, IMAGE 3 = Burcu, three people). Continuity: `the woman in IMAGE 2 holds a small coffee cup … coral-pink cashmere cardigan; the man in IMAGE 3 … bottle-green …; the woman in IMAGE 4 stands at the espresso counter` (IMAGE 4 is Duygu, who is no longer in the frame, although the cast says "there is no IMAGE number beyond the last one listed").
  - `.../0061.md`: the same swap (IMAGE 2 is "the woman" in the cast and "the man" in the continuity text).
  - `.../0571.md`: after the switch to the words-only model, the continuity still says `the man in IMAGE 1 …`, but that path has no IMAGE labels.
- **Why it hurts:** The block exists to carry over "an unchanged outfit, a hairstyle, a position". It now hands Burak Sami's coveralls and his hand-on-arm pose, and gives Berker Burcu's coffee cup and her position. Two consecutive frames of the same table also never share a seating plan: Burcu's frame (#16) was written with "No previous image" right after Sami's frame of the same three people.
- **Root cause:** `illustrate()` reads `prevPrompt = chat.imgPromptBy[_spkKey]` (per-character since v19.3, when frames were single-person). `buildRefPack()` pushes the speaker first and then `inSceneCast` order, so the IMAGE numbers rotate with whoever is speaking.
- **Fix:** Keep one continuity entry per scene (the last frame on screen) and store with it the label→person map it was written with. Before sending, rewrite each old label to the person's current label, and drop sentences about people who are not in the cast (or send the continuity as per-person lines under the current labels). A simpler, complementary fix: give people a stable IMAGE order for the whole scene (order of arrival), mark the speaker with "whose line this picture is for" rather than always making them IMAGE 1, and store the words-only continuity with names rather than IMAGE labels.

### 3. [High] Outfits are re-resolved from (place, period) on every frame: "boxer briefs" at a barbecue goodbye, and a change of clothes on every walk. The selection is correct for the data; the rule itself is the bug
- **Engine(s):** Image prompt writer (WHAT EACH PERSON IS WEARING), also the Wearing tracker and roleplay payloads through the same function
- **Evidence:**
  - `out/payloads/image-prompt-writer/1019.md` and `1024.md` (Day 2 **Night**, Emre's house, T33 `Misafirleri bahçe kapısına kadar geçiriyorum`; Berker `Ceketini giyip`):
    `- Sami Özüçak — already decided, draw exactly this: You wear a pair of low-slung black boxer briefs and a lazy, knowing grin, the rest of your clothes left in a trail from the front door.`
    `- Berker Özüçak — already decided …: … grey flannel trousers, and bare feet, a glass of water on the side table.`
  - One turn earlier, at the same table (`.../0986.md`, Evening), they wore a dark green silk shirt and a black polo. `out/payloads/wearing-tracker/1022.md` shows the player at that moment as `You sleep in nothing but a pair of thin, heather-grey cotton boxer briefs`.
  - Day 1: they walk together from the café (T12 `Birlikte yürüyelim`) and on arrival Berker goes from `bottle-green v-neck cashmere sweater … charcoal chinos` (`.../0256.md`) to `steel-grey bespoke suit … navy silk tie` (`.../0298.md`). Sami goes from cream cashmere and navy shorts to coveralls.
- **Is it a selection bug?** No, `_imgClothesFor` picks what `currentOutfit()` says. The universe export has Sami `outfits.userHome.Night` = that exact boxer-briefs line (and `activity.intimate`/`sleep` are separate), and `currentOutfit()` rule 4 returns `userHome[period]` for anyone standing in the player's house. The design is what is wrong:
  - (a) The generator filled `userHome.Night` as a sleepover or after-sex outfit, and the resolver serves it to any guest who is still there when the clock reaches Night, whatever the occasion.
  - (b) Nothing persists: the outfit is recomputed from `chat.locationId` and `chatPeriod()` for every frame, so a continuous scene changes clothes when the period ticks and on every arrival.
  - (c) `wearingOverride()`'s key (`_wearKey` = loc|sub|period|day) makes a tracked change (Emre's jacket off at T8) expire at the same moments.
  - (d) The slot text contains props, actions and backstory ("holding a bottle of good rakı", "a glass of water on the side table", "a lazy, knowing grin", "clothes left in a trail from the front door"), and the writer is told to "draw exactly this". The first mangal frame (`.../0836.md`) has Sami "making yourself at home with a glass of rakı" while his line has him taking the tongs at the grill.
- **Why it hurts:** A guest is drawn in his underwear at the garden gate, everyone changes clothes between two consecutive beats, and props in the outfit text override what the exchange says the hands are doing.
- **Root cause:** `currentOutfit()` (rules 3–5), `_wearKey()`/`wearingOverride()`, and the Outfit generator's slot definitions. `_imgClothesFor()` then presents the result as final.
- **Fix:**
  - Freeze the resolved outfit per character when they enter a scene (store it in `chat.wearing` under a key that ignores period, e.g. loc|day). Re-resolve only on travel, a new day, or a real re-entrance after being offscreen. Arriving together from a walk keeps the clothes.
  - Serve `userHome.Night`/`home.Night`/`activity.sleep` only when the character is staying or sleeping (bedroom sub-area, or an explicit sleepover). Otherwise carry the Evening outfit forward.
  - In `_imgClothesFor`, strip trailing non-garment clauses before "draw exactly this", or have the generator write garments only.

### 4. [High] Words-only path: nobody has an identity; the look is empty and the templates forbid inventing one
- **Engine(s):** Image prompt writer (23 frames with `bytedance/seedream-v4`, from D-evening on), final image requests 23–45
- **Evidence:** `out/payloads/image-prompt-writer/0691.md`, `.../0762.md`, `.../1019.md`:
  `- Sami Özüçak, whose line this picture is for: Man` · `- Buket Özüçak: Average height` · `- Özlem Özüçak: (no description given — keep them plain)`
  The cast block then says `Describe each person SEPARATELY … man or woman, age, build, hair, face details`, while the POV template in the same prompt says `Never … a face, hair, build, skin tone or age for anyone`, and rewritePrompt says `character appearances … are Auto injected … NEVER include those`. Final prompts (images.jsonl 25–45) carry no appearance on the tail.
- **Why it hurts:** Nothing in the request identifies anyone. The writer either follows the template and describes nobody, or invents a new face, age and build on every frame. Buket and Özlem are not even marked as women. The request only works if the model invents a look and then keeps it.
- **Root cause:**
  - In the export, the Isdemir personas' `look` is empty apart from `subject` (the user relies on photos). `_look()` in `illustrate()` → `lookProse()` + `_refSubject()` returns "Man" / "" / "Average height".
  - With a cast, `_appC` is blanked (`_textCast ? ""`), so the tail adds nothing either.
  - The system-prompt layers were written for the reference path and are not switched for words-only.
- **Fix:**
  - When `!usesRefImage()` and a person has pictures but no look, fall back to a stored text description (`imagePrompt`/`mediaRef`, or run the existing Appearance generator once from their photo and cache it). Surface "these characters have no written look" when a words-only model is chosen.
  - In words-only mode, drop the "never a face/hair/build" guardrail and the "appearance is auto-injected" sentence, and say "you are the only source of each person's look — reuse the same words every frame".
  - Default `subject` from pronouns or gender in the card when it is empty.

### 5. [Medium] WHERE THIS FRAME HAPPENS gives the venue's outside description as the description of the room the people are in; the router sees no area at all
- **Engine(s):** Image prompt writer (all frames), Scene selector (all 46)
- **Evidence:**
  - `.../0298.md`: `Isdemir's Worker Canteen, A sprawling steel mill complex with tall smokestacks, conveyor belts, and a guarded main gate.`
  - `.../0009.md`: `Vanadium Cafe's Outdoor Patio, A sleek coffee bar with chrome stools, exposed concrete walls, and a neon sign above the counter.`
  - `.../0691.md`: `Site Market's Supermarket, A small tiled plaza with a central fountain…`
  - `.../0855.md`–`1024.md`: the whole barbecue is placed at `Emre's House's Garden Gate Entrance, A sleek modern flat with floor-to-ceiling windows…`
  - Router `scene-selector-model-router/0295.md`: `LOCATION: Isdemir — A sprawling steel mill complex…` (no area).
- **Why it hurts:** The writer is told "Only what the block gives you … do not invent", so it puts smokestacks in a canteen, a fountain inside a supermarket and a neon counter on an open patio. None of these areas has a description in the data, so the parent's text is the only setting it has. The barbecue never leaves the arrival area, so every dinner-table frame is labelled as the garden gate.
- **Root cause:** `_imgLocationClause()` joins `"<loc>'s <sub>"` and the loc description as though they described the same space. The router's `locLine` in `illustrate()` uses `loc` only. The sub-area stuck at the entrance comes from presence/subPos (outside this area), but the image builder does not notice it.
- **Fix:** Label the parts: `AREA: Worker Canteen (inside Isdemir) — no description of this area; infer it from its name` and `THE WIDER PLACE (probably not visible from here): …`. Pass the same area line to the router. Optionally drop the parent description when the area name implies an interior and the parent text is exterior.

### 6. [Medium] Clothing that the narration states never reaches the frame (Burak's coveralls): the outfit table wins "already decided"
- **Engine(s):** Image prompt writer
- **Evidence:**
  - `.../0366.md` LATEST EXCHANGE: `Narrator: Yemekhanenin kapısında Burak Atan beliriyor; gece vardiyasına daha saatler varken tulumunu giymiş` (he came in his coveralls).
  - Burak's own frame two calls later (`.../0395.md`): `- the man in IMAGE 1 = Burak Atan — already decided, draw exactly this: You wear a light blue oxford shirt, a navy blue tie slightly loosened, … carrying a well-organized briefcase.` Its WHAT HAS HAPPENED SINCE block contains only Emre's lines.
- **Why it hurts:** The picture contradicts what the story just told the reader, and the writer is explicitly told not to substitute anything.
- **Root cause:** In `illustrate()`, the `sceneSoFar` window keeps only the player's and the speaker's own lines (`if(!isPlayer&&!isThem)continue`), so a Narrator line about the person is dropped. `_round` starts at the player's last line, so the narration fell into the previous round. The Wearing tracker did not run for Burak on that beat (no call between #366 and #395; he was not yet "present"), so `wearingOverride()` was empty and `_imgClothesFor()` returned the table outfit.
- **Fix:** Add to the window (and to that person's DOING line) any Narrator or other line since the last frame that names the person. Run the wearing tracker on arrival and GM narration for the arriving character. Soften "draw exactly this" to "unless any line above says otherwise".

### 7. [Medium] The visual director cannot see what it is asked to judge
- **Engine(s):** Visual director (72 calls)
- **Evidence:**
  - `out/payloads/visual-director/0010.md`, `0249.md`, `0849.md`, `1020.md`: `WHAT THE PICTURE ON SCREEN ALREADY SHOWS:` is a raw roleplay line, e.g. `*Kapıda Emre'ye sarılıyor, biraz sallanarak.* "Harika akşamdı kardeşim!…"`. That happens whenever the previous frame is still generating, which is every second speaker in a round.
  - None of the 72 calls says where the picture was drawn, when, or who is in it. `1013.md` judges the Evening→Night change at T33 with no period anywhere in the request.
  - `_thoughts_` are included (`0704.md`: `_Yalan söylerse anlarım._`; `0010.md`).
- **Why it hurts:** Four of its six "new picture" criteria are place changed, who is in frame changed, time or light changed, and clothing changed. It has to infer all four from four raw lines. When "shows" is dialogue, it is comparing text with text.
- **Root cause:** `decideVisual()`: `shows = x.imgPrompt || x.content` (the fallback is taken while `imgState==="loading"`). `recent` holds the last 4 raw `content` strings. No metadata is stored with a frame.
- **Fix:** Store `{loc, sub, period, castIds}` on the message when `illustrate()` starts (not when it finishes). Send `PICTURE: <place/area>, <period>, showing <names>` and `NOW: <place/area>, <period>, present <names>`, and short-circuit to 1 in code when any of these differ. While a frame is loading, send its known cast and place instead of the raw line. Strip thoughts from `recent` (`dropThoughtSpans`).

### 8. [Low] The router routes on raw lines that include inner thoughts
- **Engine(s):** Scene selector (model router)
- **Evidence:** `out/payloads/scene-selector-model-router/0005.md`: `Sami Özüçak: … "Oo, Başmühendis Bey teşrif etti! …" _Emre geldi, Berker artık para lafını açamaz._`
- **Why it hurts:** The router is told to "route on the action actually happening". A thought that names a kiss or a touch ("_I want to…_") is text the rule list will match. The talk-vs-contact fork needs the dialogue, but it never needs the thoughts.
- **Root cause:** `illustrate()` builds `latestExchange` from raw `m.content` and `replyText` and passes it to `pickRule()` unfiltered.
- **Fix:** Run `dropThoughtSpans()` over both lines before `_routeText` (and over the visual director's `recent`, see #7).

### 9. [Low] Outfit lines are sent in the character's second person under another person's label, in a POV frame where the lens is the player
- **Engine(s):** Image prompt writer
- **Evidence:** `.../0009.md`: `- the man in IMAGE 2 = Berker Özüçak — already decided, draw exactly this: You wear a soft bottle-green v-neck …`. The (stub) output for `.../0860.md` passes `making yourself at home with a glass of rakı` into the final prompt (images.jsonl 33).
- **Why it hurts:** In a POV frame, "you" is the viewer, so "You wear…" invites dressing the player or copying "your/yourself" into an English prompt. The image model reads that as the viewer.
- **Root cause:** `_imgClothesFor()` returns the card's CARD_VOICE_RULE second-person text with only `subUser()` applied.
- **Fix:** Convert the text to third person before sending ("You wear" → "wears", "your" → "his/her/their", using `_refSubject`), or prefix it with `(written to them: "you" = this person)`.

### 10. [Low] The WHAT HAS HAPPENED SINCE block repeats the LATEST EXCHANGE, claims a previous picture that does not exist, and passes on half-sentences as actions
- **Engine(s):** Image prompt writer
- **Evidence:**
  - `.../0016.md`: `(No previous image — describe the scene fresh.)`, then `WHAT HAS HAPPENED SINCE THAT PICTURE …: Emre: Kafenin terasına çıkıp…`, and the same line again in LATEST EXCHANGE. The same pattern appears in 0313, 0395, 0762 and 0774.
  - Fragments: `Emre: Sandalyeme yaslanıp` / `Kısa bir an gülümseyip` / `Etrafa bir göz atıp`, and a manner of speech presented as an action: `Buket Özüçak: (earlier in the scene) Sakin ama dikkatli bir sesle.` (`.../0797.md`).
- **Why it hurts:** Small, but it tells the writer that a picture existed when none did, doubles the lines the writer is told to treat as "the state, never what the frame shows", and passes "in a calm voice" as a pose.
- **Root cause:** In `illustrate()`, the window loop skips only `i===_triggerIdx`, but since v148.3 the LATEST EXCHANGE carries the whole `_round`. The window header is not tied to whether `prevPrompt` exists. `_imgVisualOnly()` keeps narration that only describes the voice, and dangling gerunds left by removing the speech after them.
- **Fix:** Skip every index already in `_round`. Use the header "WHAT HAS HAPPENED IN THIS SCENE SO FAR" when there is no `prevPrompt`. In `_imgVisualOnly()`, drop clauses that only describe the voice (`ses*`, `fısıl*`, "voice", "whisper") and trailing `-ip/-ıp/-up/-üp` fragments with no main verb.

### 11. [Low] Waste: the 17k-char system prompt repeats the POV rules three times
- **Engine(s):** Image prompt writer
- **Evidence:** `.../0009.md`: "the player is never a body … his hands only" appears in IMG_STYLE_POV §0/§2, in its GUARDRAILS, and again in `## THIS IS A POV FRAME` (imgPovGuide). "She may look into the lens" appears three times. There are six example frames, all single-woman. That is 17,087 chars × 46 calls ≈ 790k chars, against a user message of 3–5.6k.
- **Why it hurts:** Cost. It also buries the few lines that matter for multi-person frames (the cast, doing and wearing blocks) under repeated single-subject instruction.
- **Root cause:** `illustrate()` concatenates `rewritePrompt + IMG_STYLE_POV + imgFrameGuide + imgPovGuide`. Each layer restates the POV contract.
- **Fix:** Keep the POV contract in one place (imgPovGuide), cut the template's guardrails down to what is specific to the shot, and trim the examples to two.

---

**Checked and found correct:**
- Reference order equals label order in every reference-model frame.
- Picture counts equal person counts, and the player is never sent in POV.
- Özlem's absence from the Isdemir frames is correct for the image engines: the reply's PRIVACY block puts her in another sub-area.
- The earlier "one picture for two people" bug is gone.
- No dialogue or thoughts reach the image writer.
- The final prompts are 1.2–1.8k chars on the edit model (limit 3,600) and 0.3–1.0k on words-only, so nothing was truncated. The only defect in the tail is cosmetic: ".," appears where the tail is joined.
