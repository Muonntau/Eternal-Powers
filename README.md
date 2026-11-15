# Eternal Powers v2 — Eternity Reborn

**[Play Eternal Powers in your browser](https://muonntau.github.io/Eternal-Powers/)**

A character-driven 2D fantasy campaign based on the supplied **Eternal Powers Game Manual**, provisional ruleset 0.1. Create an angelic or demonic avatar, explore three expanded realms, complete authored contracts, build a sanctuary, and change the world through reversible rituals.

Version 2 introduces a mandatory four-step character creator, matching customizable world avatars, a modern navy/cyan interface, redesigned interaction windows, nearby/region maps, larger environments, richer spell effects, and renewable wilderness populations. The included authoritative server supports rooms of up to 64 travelers. Original art, music and effects, plus licensed CC0 imports, ship with the repository.

## Public GitHub edition

The source is published at **https://github.com/Muonntau/Eternal-Powers**. The **Publish playable game** GitHub Actions workflow builds the solo game for **https://muonntau.github.io/Eternal-Powers/** whenever `main` changes.

For a repository's first deployment, an owner must enable **Settings → Pages → Build and deployment → Source: GitHub Actions**. If the first deployment already ran before this setting was enabled, rerun its failed deployment job from the Actions tab. The validated `github-pages` build artifact remains available even when initial Pages setup requires owner permission. GitHub Pages serves solo and offline play. Its multiplayer gateway can connect to a separately hosted HTTPS game server for up to 64 travelers, player trading, and the shared market. A running multiplayer host is required; the static Pages deployment does not create one.

To reproduce the Pages build locally:

```sh
VITE_BASE_PATH=/Eternal-Powers/ VITE_STATIC_HOST=true npm run build
```

## Run the game

Requires **Node.js 22.13 or newer**; Node 24 is recommended. The server uses Node's built-in SQLite implementation.

```sh
npm install
npm run build
npm start
```

Open **http://localhost:5176**. This serves the built game and its private-world server from one origin.

For development, run these in separate terminals:

```sh
npm run server
npm run dev
```

Open **http://localhost:5173**. Vite forwards the API and WebSocket connection to the server on port 5176. Solo development play works without a server; co-op needs it.

## What you can play

- **Your own character:** four-step creation before play, both lineages, sixteen native starting paths, three body silhouettes, four hairstyles, and skin/hair/attire/aura palettes. Your chosen appearance is shared by the creator, profile, inventory, world sprite and other players. Existing journeys migrate without losing progress.
- **39 larger authored regions:** each is 4800 × 3600 pixels, four times its original area, with six districts, twelve architectural features, additional enterable halls, waterways and reachable wilderness habitats. Core campaign and recovery anchors retain their positions.
- **Rebuilt navigation and interface:** full-world viewport, compact status HUD, modern dialogs and inventory, clean radar with nearby/region modes, marker legend, detailed region atlas and collision-aware walking waypoints.
- **117 campaign contracts:** investigation, delivery, escort, fair or coercive allocation, negotiation, restoration, and visible mechanism puzzles. Realm accords lead to a rank-ten campaign conclusion; exploration continues afterward.
- **All 160 named powers:** 87 local abilities have typed targeting and effect handlers; 73 rituals use scope previews, resource reservation, preparation, staged settlement, interruption/resume, expiry, reversal, and counter-projects.
- **Progression and combat:** separate karma wallets and lifetime standing, ten celestial ranks and trials, sequential training, all forty enhancement ranks, all forty cross-affinity techniques, real certification prerequisites, guard, dodge, barriers, timed conditions, line of effect, and moving-target revalidation.
- **Thirty creature profiles:** realm-aware placement, varied attack patterns, readable warnings, resistances and peaceful solutions. Pressing E at a neutral creature opens the same material-offering card as Inspect, with inventory counts, missing requirements, approach navigation, exact settlement, bonding and familiar support.
- **Relationships and recovery:** Veil transitions, observer detection, witnesses, faction and NPC standing, one-time restitution, twenty-second downed states, four-second ally revives at 25% vitality, and identity-preserving Tenebrous Rebirth.
- **Construction and economy:** nine templates, an owned plot, placement/exit checks, rotation, 500-component capacity, twenty-edit undo, layout snapshots, storage/recovery chests, individual gear wear, repair, salvage, finite stock, locked purchases, NPC barter, and timed station crafting.
- **Living world:** the manual's sixty-minute day, weather, sheltered routes, hazards and persistent conditions. Each expanded region has 96 renewable resource anchors and 18 additional roaming creatures. Wilderness respawns wait for nearby players to leave; generation receipts allow new loot without duplicating prior claims or story rewards.
- **64-player server rooms:** server-controlled characters, independent region travel, nearby entity interest filtering, incremental snapshots, visible customized travelers, personal rewards, building roles, chat, escrow trading, market and SQLite persistence. Connections use a per-server identity and an explicit origin allowlist.
- **V2 graphics:** a newly generated portal/realm backdrop, 39 original region illustrations, custom animated avatars, region-specific architecture, depth/lighting and layered elemental effects. Individual power/enhancement/technique icons, creatures, music, foley and CC0 scenery remain available offline.

## Begin a journey

On a new journey, choose a name and lineage, customize your form, select a native starting branch, then review and enter the world. Appearance can be changed at a sanctuary through your character profile. Select the training effigy and press **Q** to practice. Gather Moonleaf, restore damaged gardens, and open Campaign & contracts for the Sacred Groves route.

Angels initially earn Good Karma; demons initially earn Bad Karma. The journal exposes destructive and coercive routes separately from restorative routes. Opposing outcomes do not pay an inaccessible wallet before certification. At rank three, complete a cooperative objective and isolated opposing-domain practice before paying the certification fee.

| Input | Action |
| --- | --- |
| WASD / arrow keys | Move |
| Click ground / entity | Move toward a point / select a target |
| Shift | Sprint |
| E | Interact or gather |
| F | Ordinary strike |
| 1–8 | Select a quick-access named power |
| Q / right-click a target | Cast the selected power |
| Space | Dodge |
| G | Guard |
| R | Restorative draught |
| V | Enter or leave the Veil |
| I / M / J / P | Inventory / map / journal / powers |
| Escape | Close a panel |

Phone layouts include touch movement, dodge, interaction, attack, and casting. Quick-access slots retain each named level, so lower powers remain useful. Inspect previews expose eligibility, secondary targets, and discovered travel destinations.

## Training and respecialization

Train powers in order using their own affinity wallet. At a sanctuary hub or your owned plot, open a learned branch's **Respecialize this branch** option. Choose the level to retain, inspect the removed powers and any dependent techniques, then confirm the itemized refund. An unused upgrade bought in the same session returns its exact recorded price when no dependent unlock was learned or used; used or earlier-session purchases return 80%. Freely granted powers and legacy unlocks without a purchase record cannot create a refund. Training receipts persist in saves, while rank, lifetime earnings, certification, and inventory remain intact.

## Crafting and sanctuary

Open Sanctuary to visit your owned plot. Templates show exact material costs and protected navigation lanes. Undo and layout restoration reconcile resources once. Dismantled storage routes its contents to recovery.

The six printed recipes retain their material and access requirements. Recipe plans can be learned at the artisan; focus/ward fabrication also needs the named Fire–Create shaping operation. A committed craft takes five seconds at the appropriate station. Leaving pauses it without charging its inputs again. The portal-anchor plan requires the explicit Infernal Gates access trial.

## Private worlds and saves

Open **Private co-op** to create or join a server room with up to 64 travelers. On the public Pages client, enter your server operator's HTTPS address first. See [multiplayer hosting](docs/MULTIPLAYER_HOSTING.md) for Docker, persistence, TLS and origin settings. Joining switches to a separate server character for that room; leaving restores your original solo journey. Travelers change regions independently; a room owner grants construction roles. Offers and trades show their contents before either side locks or confirms. Transfers and market proceeds never count as new lifetime karma.

Solo saves live in browser storage under `eternal-powers-v1`. Settings can export or restore a portable JSON backup. Browser origins have separate saves.

Private-world persistence is stored in **`data/private-worlds.sqlite`** by default. Set `ETERNAL_DB` to choose another file, and `PORT` to choose the server port. Back up the database while the server is stopped. Reconnection identities are stored in the browser; keep that browser data to recover the same server account.

This is a private co-op server, not a hosted global account service. An optional solo-checkpoint import is an explicit trust decision when creating an identity. Live room commands, balances, movement, stock, escrow, and receipts are validated by the server.

## Offline play

The production build registers an offline game shell. In Settings, choose **Download for offline play** to cache the full asset library. Solo play and browser saves then work without a connection. Private rooms, player trading, and the shared market require the server. API responses and private-world traffic are excluded from offline caches.

## Verify

```sh
npm test
npm run test:network
npm run test:offline
npm run test:browser
npm run build
```

`npm run check` runs the simulation, network, offline, and production-build checks. See [validation details](docs/VALIDATION.md) for the current coverage, including the real 64-client load fixture. Browser tests use Playwright; run `npx playwright install chromium` when no compatible browser is installed.

## Fidelity and sources

The manual describes a proposed game and marks its numerical rules as provisional. This edition implements its systems through conventional 2D simulation. Realm-scale effects use explicit regional state, authored sites, and hazards rather than a full physical simulation of every inhabitant or continent. Creature and social behaviors share reusable primitives. This repository does not establish fidelity to an unavailable finished commercial game or implement full-dive hardware.

See [manual coverage](docs/MANUAL_COVERAGE.md) and [asset provenance](docs/ASSET_PROVENANCE.md). Imported Superpowers assets by **Pixel-boy / Sparklin Labs** retain the **CC0 1.0** license, source revision, and file manifest under `public/assets/vendor/superpowers/`.

Original repository references: [Game](https://x.com/VaniaSazonov/status/2115653886736498895) · [Studio](https://x.com/VaniaSazonov/status/2115965475129594002) · [Manual](https://x.com/VaniaSazonov/status/2116694828352253998).
