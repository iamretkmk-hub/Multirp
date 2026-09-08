# Tests

Plain Node scripts — no framework, no install for the first two.

| File | Run with | Checks |
|---|---|---|
| `payload-parity.test.js` | `node tests/payload-parity.test.js` | **The safety net.** An unedited payload template assembles byte-identically to the classic `buildPayload`. If this fails, turning templates on would silently change what every character receives. |
| `payload-templates.test.js` | `node tests/payload-templates.test.js` | Auto-drop of empty sections, role markers, value substitution, unknown-name reporting, the disabled path. |
| `engine-parity.test.js` | `npm i playwright` then `node tests/engine-parity.test.js` | **The engine safety net.** For every engine in `ENGINE_PARTS`, the unedited default template assembles the same user message the hand-written concatenation used to. Runs three value shapes per engine (all present, all empty, alternating). |
| `payload-templates.browser.js` | `npm i playwright` then `node tests/payload-templates.browser.js` | Loads `index.html` in Chromium: boot without errors, the editor renders, validation warns on unknown names, the toggle persists, parity holds in the real app. |

The first two extract the relevant functions out of `index.html` at run time, so they cannot
drift from the shipped code.
