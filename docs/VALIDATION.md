# Validation of the current 2D edition

The current production build passes 162 automated tests:

| Suite | Tests | Command |
| --- | ---: | --- |
| Game simulation | 123 | `npm test` |
| Private-world server and WebSocket transport | 18 | `npm run test:network` |
| Offline cache boundaries and project-base hosting | 7 | `npm run test:offline` |
| Browser gameplay and responsive interface | 14 | `npm run test:browser` |

`npm run build` also passes. Its offline manifest contains 981 asset files totaling 27.6 MiB and 21 production shell files. Asset licenses and source revisions are documented in `ASSET_PROVENANCE.md`.

The browser checks exercise contract evidence and settlement, opposing-affinity certification, ally revival and recovery, recipe plans and crafting inputs, NPC barter, construction and storage, interrupted crafting, staged rituals and paid reversal, familiar offerings, itemized respecialization, movement, named power casting, save restoration, audio startup, region travel, and phone layouts.

Additional two-browser testing verifies room creation and joining, visible authoritative movement, locked player escrow settlement, persistence on reconnect, and restoration of each player's original solo save. Additional production testing downloads the full offline library through Settings, disconnects the browser, reloads the page, restores saved inventory, casts a power, and changes region. Both runs report no page errors or failed asset requests.

Focused regressions cover separate ownership of familiars, hired allies, contract actors, escorts and cargo; imported character ownership migration; SQLite restart; actual-cost training receipts; refund cancellation, stale previews and replay protection; unchanged lifetime earnings; and ritual scope validation after respecialization.

These checks establish the behavior of the included 2D simulation. The manual's wider physical, social, population and hosting scope is documented in `MANUAL_COVERAGE.md`.

GitHub Pages project hosting is also checked on a strict static server mounted only at `/Eternal-Powers/`: images and audio stay within the project path, the service worker has the exact project scope, the full library caches within that path, and offline reload, casting and travel retain their behavior.
