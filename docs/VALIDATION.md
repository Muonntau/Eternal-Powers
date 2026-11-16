# Eternal Powers v4 validation

Wilds Reborn and the retained Classic Journey are checked by 243 automated tests:

| Suite | Tests | Command |
| --- | ---: | --- |
| New action combat, audio, catalog, regions and retained Classic simulation | 183 | `npm test` |
| Classic authoritative server, transport, origins and 64-client capacity | 28 | `npm run test:network` |
| Offline boundaries and project-base hosting | 7 | `npm run test:offline` |
| New action gameplay plus Classic onboarding and responsive interface | 25 | `npm run test:browser` |

The production build passes with both root hosting and GitHub Pages project hosting. The offline manifest contains 1,028 asset files totaling 50.6 MiB and 28 production shell files. Art licenses and source revisions are documented in `ASSET_PROVENANCE.md`.

## Wilds Reborn action checks

The new default is a separate action game and save namespace. Sixteen starting affinities and one ultimate are available immediately; all 160 preserved names use seven action forms with short cooldowns and inexpensive unlocks. New engine tests run actual aimed casts, projectiles, kills, loot, XP, unlocking, all 160 execution profiles, five elemental reactions, fixed enemy warnings, dodge immunity, renewable creatures and reactive props. Tests verify once-only chest rewards, guardian-sealed treasure, three physical rift waves, bounded retry actors, safe defeated-save recovery, stopped offensive fields while downed, and physical rift tracking without teleporting or starting a fight.

World tests check all 39 layouts for collision-safe, connected arrivals, scenery, encounters, treasure, rift and guardian positions. All 30 manual creature identities are represented. Audio tests verify gesture-only startup, all elemental sound families, bounded voices, pause/mute and cleanup.

New browser flows create a character through the visible controls, move and dash, defeat a real creature with aimed powers, earn and collect rewards, unlock/equip a higher named power, use it on a reactive prop, travel and reload. All 160 library entries and 39 travel choices are checked. Creator, world, library, map and pause layouts are inspected at desktop and 390-pixel phone widths. A short frame sample checks for severe rendering stalls; it is not a fixed frame-rate guarantee.

A strict production fixture serves only `/Eternal-Powers/`. It checks the new client, five generated runtime atlases/illustrations, proper worker scope, complete full-library caching, absence of private requests in caches, and offline hard reload with saved character, power loadout, unlocks and region intact. Actual casting and travel must continue offline. The Classic save namespace is preserved separately.

The painted characters, creatures, scenery and terrain are used in the actual Canvas world. The renderer depth-sorts actors, fades occluding scenery, shows the actual attack warning area, animates spells and statuses, and renders a tracked rift direction. The minimap draws the current world's path and river geometry.

## Retained Classic character and interface checks

Browser checks use the real four-step creator instead of injecting an already-created save. Fresh characters cannot move before creation; the chosen name, lineage, first power and full appearance persist after reload. Sanctuary appearance edits preserve identity, possessions and progression. The creator, customized portraits, HUD, radar, inventory and character windows are checked at desktop and 390-pixel phone widths.

In Classic, the same E interaction opens a neutral creature's material card. Tests verify missing-material explanations, exact inventory deduction, one-time offering settlement, familiar bonding and support. Region-map tests switch radar modes and legends, select the actual sanctuary landmark, set a collision-safe approach and observe the avatar walking after the atlas closes.

The prior campaign, certification, recovery, crafting, barter, construction, rituals, respecialization, ordinary movement, named casts, saves, audio startup and region-travel checks remain covered.

## Expanded world and renewable identities

All 39 regions are checked for four times their original area, distinct architecture/districts and reachable outer habitats. All 117 contracts and 265 campaign/critical anchors retain valid ground routes. Long assisted routes are sampled along their full length to reject paths through solid geometry; blocked landmarks use reachable approach points.

Real engine regressions cover restored renewable resources, repeated collection followed immediately by travel/reload, living damage retention and multiple hostile generations. New generations can pay their own loot once; earlier claims, story rewards, chests and creature offerings cannot be replayed. Respawning waits for occupied or blocked anchors to clear.

## Multiplayer checks

The capacity fixture opens 65 real WebSocket transports. It verifies 64 simultaneous room admissions, rejection of the 65th, authoritative movement, independent regions, reconnect identity and capacity recovery. The current fixture includes all 64 created characters and their 448 personal campaign actors and power sites. Its timing and idle-wire diagnostics describe the controlled fixture, not a production hosting guarantee.

Two independent browser contexts also connect from a different client origin to the actual server through the game's gateway. Customized appearances, movement, separate region travel and exact restoration of each solo journey are verified without page errors or failed requests. Other regressions cover escrow, persistent market receipts, origin checks, personal actor/cargo ownership, nested/entity snapshot deltas, slow-client backpressure, common server clocks and migration of older small world layouts.

## Public build and offline checks

A strict static fixture serves the production build only from `/Eternal-Powers/`. It verifies the complete asset library, exact worker scope, no requests outside the project path, no private API traffic in caches, full-library download through Settings, and an offline hard reload retaining the customized character and inventory. Casting and region travel must still work offline. Images, fonts, menu layouts and inventory portrait bounds are inspected in this production build.

GitHub Pages hosts the public client. A 64-player session requires a separately running HTTPS Node server; the gateway, Docker/Compose definitions and operator settings are documented in `MULTIPLAYER_HOSTING.md`.

These checks establish the included 2D simulation. The manual's wider physical, social and population scope remains documented in `MANUAL_COVERAGE.md`.

## Faction campaign and reactive site checks

Both 12-mission campaigns are completed through actual preparation/resolution, physical site actions, dialogue decisions and once-only settlements. Reload preserves each ending. All 87 local named powers and all 40 cross-affinity techniques drive a site through the real cost and validation path. Tests cover wrong notes, cancellation, range and ownership denial, renewable materials without repeat lifetime Karma, saved cooldowns, and six walkable sites plus a viable relay finish in every one of the 39 regions.

New browser flows choose both factions, settle the first story mission, practice, charge and collect a resonator, review all 12 missions and six regional sites, then reload the resulting objective. A phone check aligns a rune through the actual window and verifies no horizontal overflow. Existing creature offering/bonding, contract, crafting and sanctuary checks remain in the browser suite. The production project-base fixture additionally verifies all generated landscape assets are cached and available on offline reload.
