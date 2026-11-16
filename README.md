# Eternal Powers v4 — Wilds Reborn

**[Play Wilds Reborn](https://muonntau.github.io/Eternal-Powers/)** · **[Open your earlier journey](https://muonntau.github.io/Eternal-Powers/?legacy=1)**

A rebuilt solo 2D action adventure about using spectacular powers in an open world. Create an angelic or demonic character, aim while moving, hunt creatures, combine affinities, collect power shards and explore the three realms. The default experience is now **Wilds Reborn**. The earlier **Classic Journey** remains available without replacing its save.

All sixteen basic affinity powers and a starting ultimate are yours immediately. Build a six-power loadout, unlock higher powers for one to five shards, dash through readable creature attacks, detonate reactive objects and take on regional bosses and rifts. All 160 named power levels, 39 regions and 30 creature identities from the supplied manual inform this faster action adaptation. See [Wilds Reborn gameplay and controls](docs/WILDS_REBORN.md).

The new mode has rebuilt environments, spell effects, generated art, menus and an original reactive score. Classic Journey retains its faction campaigns, contracts, sanctuary, deeper manual-oriented systems and separately hosted 64-player co-op.

## Public GitHub edition

The source is published at **https://github.com/Muonntau/Eternal-Powers**. The **Publish playable game** workflow builds the game for **https://muonntau.github.io/Eternal-Powers/** whenever `main` changes. GitHub Pages serves the browser client; it does not create a multiplayer server. Wilds Reborn is solo. Classic Journey's co-op gateway connects to a separately hosted HTTPS server.

For a repository's first deployment, enable **Settings → Pages → Build and deployment → Source: GitHub Actions**. To reproduce the Pages build locally:

```sh
VITE_BASE_PATH=/Eternal-Powers/ VITE_STATIC_HOST=true npm run build
```

## Run the game

Requires **Node.js 22.13 or newer**; Node 24 is recommended. The Classic server uses Node's built-in SQLite implementation.

```sh
npm install
npm run build
npm start
```

Open **http://localhost:5176**. The server serves the new default client and the Classic client from the same origin. For development:

```sh
npm run dev
```

Open **http://localhost:5173**. Wilds Reborn solo play works without a separate game server. To develop Classic co-op, also run `npm run server` in another terminal; Vite forwards its API and WebSocket traffic to port 5176.

## What you can play in Wilds Reborn

- **Powers immediately:** all sixteen starting affinities, a free starting ultimate and a six-slot loadout that can mix branches freely. Higher levels cost one to five shards rather than sequential Karma training.
- **All 160 named power levels:** fast action interpretations using bolts, beams, area bursts, movement, orbiting fields, summons and chaining effects. New numerical balance prioritizes frequent casting and generous Essence recovery.
- **Creature combat:** moving aim, dodges, visible attack warnings, elemental effects, combinations, experience, automatic loot and stronger elite/boss encounters.
- **An open world:** all 39 region names across Earth, Heaven and Hell, rebuilt 2800 × 2000 layouts, connected exploration routes, distinct biome palettes, scenery, structures and treasure.
- **World interactions:** explosive seedpods, crystals, springs and totems give powers reactive targets. Three-wave rifts and regional bosses provide focused challenges.
- **A new presentation:** generated environments and art, animated creatures and characters, layered spell graphics, a modern responsive HUD and power library, and original reactive music and sound.
- **Separate progress:** a dedicated Wilds save preserves the earlier Classic character. The pause menu links back to `?legacy=1`.

## Begin in the wilds

Choose your name, lineage and starting form. These are starting loadouts, not permanent classes. Aim at the first creature pack, move through its attacks and cast directly. Collect shards, open **B** to choose a slot and equip another affinity, then explore a treasure site, boss arena or rift. Open **M** whenever you want another region.

| Input | Action |
| --- | --- |
| WASD / arrow keys | Move |
| Mouse / pointer | Aim |
| Left click / right click | Cast slot 1 / slot 2; hold to repeat |
| 1–6 | Cast the corresponding power |
| Q | Cast the equipped ultimate |
| Space | Dash |
| E | Interact |
| R | Healing draught |
| B | Power library |
| M | World map |
| Escape | Pause / close window |

Touch controls and clickable power slots support phone play. The pause-menu guide explains the main combat and exploration opportunities.

## Classic Journey — v3 systems

These systems belong to the earlier client at `?legacy=1`; they are not additional requirements for Wilds Reborn.

- **Two faction campaigns:** twelve missions each for the Concord of Dawn and Ashbound Covenant, recorded choices, persistent endings, a current-objective tracker and six reactive power challenges in each region. See [Concord & Covenant](docs/CONCORD_AND_COVENANT.md).
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
- **Classic graphics:** a newly generated portal/realm backdrop, 39 original region illustrations, custom animated avatars, region-specific architecture, depth/lighting and layered elemental effects. Individual power/enhancement/technique icons, creatures, music, foley and CC0 scenery remain available offline.

### Begin a journey in Classic Journey

In Classic Journey (`?legacy=1`), choose a name and lineage, customize your form, select a native starting branch, then review and enter the world. Appearance can be changed at a sanctuary through your character profile. Select the training effigy and press **Q** to practice. Gather Moonleaf, restore damaged gardens, and open Regional contracts for the Sacred Groves route.

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

### Training and respecialization in Classic Journey

Train powers in order using their own affinity wallet. At a sanctuary hub or your owned plot, open a learned branch's **Respecialize this branch** option. Choose the level to retain, inspect the removed powers and any dependent techniques, then confirm the itemized refund. An unused upgrade bought in the same session returns its exact recorded price when no dependent unlock was learned or used; used or earlier-session purchases return 80%. Freely granted powers and legacy unlocks without a purchase record cannot create a refund. Training receipts persist in saves, while rank, lifetime earnings, certification, and inventory remain intact.

### Crafting and sanctuary in Classic Journey

Open Sanctuary to visit your owned plot. Templates show exact material costs and protected navigation lanes. Undo and layout restoration reconcile resources once. Dismantled storage routes its contents to recovery.

The six printed recipes retain their material and access requirements. Recipe plans can be learned at the artisan; focus/ward fabrication also needs the named Fire–Create shaping operation. A committed craft takes five seconds at the appropriate station. Leaving pauses it without charging its inputs again. The portal-anchor plan requires the explicit Infernal Gates access trial.

### Private worlds and saves in Classic Journey

In Classic Journey, open **Private co-op** to create or join a server room with up to 64 travelers. On the public Pages client, enter your server operator's HTTPS address first. See [multiplayer hosting](docs/MULTIPLAYER_HOSTING.md) for Docker, persistence, TLS and origin settings. Joining switches to a separate server character for that room; leaving restores your original solo journey. Travelers change regions independently; a room owner grants construction roles. Offers and trades show their contents before either side locks or confirms. Transfers and market proceeds never count as new lifetime karma.

Solo saves live in browser storage under `eternal-powers-v1`. Settings can export or restore a portable JSON backup. Browser origins have separate saves.

Private-world persistence is stored in **`data/private-worlds.sqlite`** by default. Set `ETERNAL_DB` to choose another file, and `PORT` to choose the server port. Back up the database while the server is stopped. Reconnection identities are stored in the browser; keep that browser data to recover the same server account.

This is a private co-op server, not a hosted global account service. An optional solo-checkpoint import is an explicit trust decision when creating an identity. Live room commands, balances, movement, stock, escrow, and receipts are validated by the server.

## Offline play

The production build registers an offline game shell. The full-library download is available through **Settings → Download for offline play** in Classic Journey. Solo browser saves remain local to the device. Classic private rooms, player trading and the shared market require the server; API responses and private-world traffic are excluded from offline caches.

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

The manual describes a proposed game and marks its numerical rules as provisional. **Wilds Reborn** preserves the reference names and affinities while deliberately adapting costs, cooldowns, damage, unlocks, layouts and encounters for fast solo action. It represents large rituals as combat-scale attacks. **Classic Journey** retains the local-power/ritual distinction, explicit regional state, contracts, social systems, construction and economy. Its realm-scale effects use authored sites and hazards rather than simulating every inhabitant or continent. Neither mode establishes exact fidelity to an unavailable finished commercial game or implements full-dive hardware.

See [manual coverage](docs/MANUAL_COVERAGE.md) and [asset provenance](docs/ASSET_PROVENANCE.md). Imported Superpowers assets by **Pixel-boy / Sparklin Labs** retain the **CC0 1.0** license, source revision, and file manifest under `public/assets/vendor/superpowers/`.

Original repository references: [Game](https://x.com/VaniaSazonov/status/2115653886736498895) · [Studio](https://x.com/VaniaSazonov/status/2115965475129594002) · [Manual](https://x.com/VaniaSazonov/status/2116694828352253998).
