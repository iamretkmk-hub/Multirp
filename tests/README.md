# Tests

Plain Node scripts — no framework, no install for the first two.

| File | Run with | Checks |
|---|---|---|
| `payload-parity.test.js` | `node tests/payload-parity.test.js` | **The safety net.** An unedited payload template assembles byte-identically to the classic `buildPayload`. If this fails, turning templates on would silently change what every character receives. |
| `payload-templates.test.js` | `node tests/payload-templates.test.js` | Auto-drop of empty sections, role markers, value substitution, unknown-name reporting, the disabled path. |
| `engine-parity.test.js` | `npm i playwright` then `node tests/engine-parity.test.js` | **The engine safety net.** For every engine in `ENGINE_PARTS`, the unedited default template assembles the same user message the hand-written concatenation used to. Runs three value shapes per engine (all present, all empty, alternating). |
| `bare-pieces.browser.js` | `node tests/bare-pieces.browser.js` | **The go-live check.** On a real scene with a real character: templates are active on a fresh install, the default template is byte-identical to the classic payload, and "Erase built-in headings" removes the app's wording while keeping every piece of story data. |
| `engine-ui.browser.js` | `node tests/engine-ui.browser.js` | The engine template UI on a 412px phone: the filter narrows 65 engines and reports an empty result, each engine's piece list renders lazily with plain names, and `edit` opens the prompt box for `prompt` while explaining itself for pieces the app builds. |
| `payload-ui.browser.js` | `node tests/payload-ui.browser.js` | The payload settings UI on a 412px phone: the switch keeps its 46×26 box with the label outside it, piece rows show plain names with no clipping or horizontal overflow, and every Edit button opens and highlights the right editor. |
| `video-cues.browser.js` | `node tests/video-cues.browser.js` | The video time-mark chain: marks stored and ordered, the gate's reasons, the mark reaching the character's payload with templates on, the auto-response wiring, and that an ordinary turn neither inherits the cue nor logs phantom warnings. |
| `payload-templates.browser.js` | `npm i playwright` then `node tests/payload-templates.browser.js` | Loads `index.html` in Chromium: boot without errors, the editor renders, validation warns on unknown names, the toggle persists, parity holds in the real app. |

The first two extract the relevant functions out of `index.html` at run time, so they cannot
drift from the shipped code.
