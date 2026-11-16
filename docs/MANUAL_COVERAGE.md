# Manual fidelity and coverage

The source is **Eternal Powers — The Complete Game Manual**, Nanograms Edition, provisional ruleset 0.1, 31 October 2026 (267 pages). The manual describes a proposed game and explicitly marks its numerical execution rules as provisional. This repository is a conventional 2D interpretation; it does not establish fidelity to an unavailable finished commercial game or full-dive interface.

## Complete reference catalog

`src/data/manual.js` transcribes the gameplay reference into explicit, inspectable records. Catalog presence is distinct from a fully simulated runtime feature.

| Reference | Entries | Source pages |
| --- | ---: | --- |
| Power branches | 16 | 23–198 |
| Named power levels, with preserved effect and operational interpretation | 160 | 24–198 |
| Local powers / world interventions | 87 / 73 | Individual power pages |
| Enhancement tracks / selectable ranks | 8 / 40 | 199–206 |
| Cross-affinity techniques | 40 | 207–214 |
| Named environments | 39 | 226–243 |
| Creature profiles, with vitality, attack, tells, counterplay, and peaceful alternatives | 30 | 244–258 |
| Celestial ranks / lineage titles | 10 / 20 | 263 |
| Baseline purchasable consumables and equipment | 7 | 217 |
| Explicit crafting recipes | 6 | 221 |

The atlas has 36 traversal profiles; three profiles name two separate environments. All 39 names are retained as separate records with `sharedProfile` where applicable. Every catalog record includes a `manualPage` when sourced from a specific page.

## Rules that matter for fidelity

- A branch level, enhancement rank, celestial rank, and creature rank are separate concepts.
- Good Karma and Bad Karma are separate wallets. Wallet spending does not reduce lifetime earnings.
- Love, Light, Water, and Air training uses Good Karma. Hate, Dark, Fire, and Earth training uses Bad Karma. Domain currency does not determine whether an action's outcome is restorative or destructive.
- The native starting branch grants one free level-1 power. Other levels cost `100 × level²`; unlocks are sequential and require celestial rank at least equal to the branch level.
- Rank thresholds are `500 × (rank − 1)²` lifetime eligible karma plus a rank trial. Rank does not automatically buy powers.
- Local casts normally cost `5 + 5L` Essence, prepare for `0.5 + 0.25L` seconds, and cool down for `3 + 2L` seconds. Their magnitude is `8 + 6L`. Entry-specific exceptions take precedence.
- Rituals remain rituals at their authored scope; a high-level regional intervention is not simply a stronger combat projectile. Ritual cost and scope are recorded per power, rather than inferred from a uniform level cutoff.
- Tenebrous Rebirth is a local level-7 exception: 40 Essence, five-second preparation, sixty-second cooldown, and one eligible recoverable identity at 50% vitality.
- Dark-Heal level 1 uses a two-metre touch range; level 4 restores soil. Water-Decay primarily affects objects and terrain. Light-Harm level 4 stuns without direct damage.
- Ordinary attacks, guard, dodge, recall, rest, defeat recovery, and inventory retention are independent of learning a power.
- First discoveries and authored objectives pay once. Repeated restoration, self-created damage, resale, gifts, or refreshes must not create duplicate lifetime credit.
- Persistent world conditions require a defined expiry or reversal and preserve safe recovery anchors.

## Scope of the 2D adaptation

The runtime is the source of truth for what is playable. Authored maps, pixel graphics, sound, input bindings, camera scale, and the introductory route are implementation choices for this 2D version. The data catalog exposes the full rules reference even where a particular authored encounter, terrain transformation, or technique does not yet have a dedicated simulation.

Private co-op now uses a Node/SQLite server for room characters, shared encounters, replay-safe commands, escrow, market settlement, and persistent ownership. Browser solo saves remain separate. Global account hosting, cross-server reconciliation, host migration, and the proposed Nanograms interface are outside this edition.

## Current runtime coverage

This table describes the current 2D edition. A catalog record does not imply its entire manual procedure is simulated.

| System | Playable implementation | Remaining manual scope |
| --- | --- | --- |
| World and traversal | Individually authored region layouts, shared collision/line-of-effect geometry, walk/sprint, assisted routes/flight, weather, portals and recall | Full continuous-world physics and arbitrary terrain topology |
| Environments | 39 distinct layouts, authored roads/interiors/landmarks and 117 physical contracts; generated and imported architecture | Every possible simulation implied by each atlas description |
| Encounters | All 30 creature profiles configured from shared AI families, realm-aware placement, resistance tags, varied tells/support actions, peaceful anchor sequences, neutral assistance and a familiar companion | Bespoke encounter arenas and every manual-specific social acceptance test; profile behaviors share common simulation primitives |
| Powers | 87 typed local handlers and 73 staged rituals; target/secondary target/range/line-of-effect revalidation, preparation, costs and cooldowns | Unbounded population and physics effects are represented by bounded 2D simulation |
| Rituals | Named scope previews, owner permission, rank/trial checks, anchor preparation, resource reservation, staged settlement, interruption/resume, persistent conditions, expiry, reversal and finite daily lots | Fully bespoke terrain transformation and population simulation for every preserved effect; the campaign represents these through explicit regional state and authored sites |
| Progression | Separate balances/lifetime totals, native wallet eligibility, sequential training, recorded-price respecialization with dependent unlock previews and atomic refunds, rank trials, cooperation/opposing-practice certification, Veil/witnesses, reputation and restitution | Unscripted natural-language negotiation and every possible social context |
| Enhancements | All 40 ranks train and select specialized modifiers, including bounded ally/donor/environmental interactions | Emergent interactions beyond authored target categories |
| Cross-affinity techniques | All 40 techniques have ordered domain/certification training gates, local effect handlers, costs, cast time, cooldown and target validation | Unauthored social interpretations remain outside target schemas |
| Inventory/economy | Manual baseline items/recipes, plans and named shaping gates; gear identities/wear, repair/salvage/resale, bank/recovery, finite stock/quotes, timed crafting, NPC barter and server player escrow/market | Broad economic simulation and cross-server transfer reconciliation |
| Construction | Owned plot, nine templates, grid/rotation/layer/exit checks, 500-component budget, 20-edit undo, resource-reconciled layouts/storage; co-op construction roles | Complex architectural engineering and arbitrary-scale geometry |
| Recovery | 20-second downed state, four-second ally revive at 25%, recall at 50%, five-second Tenebrous Rebirth with identity and reward-receipt checks | Full population-scale resurrection is represented by eligible recorded identities |
| Persistence | Separate local JSON saves/backups and SQLite private worlds, replay-safe transactions, escrow crash recovery, room characters and persistent shared state | Public account/cloud hosting, cross-server reconciliation and live host migration |

### Adaptation-specific balancing

The initial game grants starter supplies and a small spendable wallet without lifetime credit. Gathering families use local names such as Moonleaf, Sacred Timber, and Runestone, while the reference catalog retains the manual's generic material families. The six printed recipes and seven baseline purchasable items are retained alongside clearly marked adaptation recipes. Basic strikes now use the printed 12 damage and 1.5-second cooldown; tonic recovery and core equipment prices also use printed values. Recovery timing and resurrection identity rules are implemented; terrain and population-scale effects use bounded representations. The calendar uses the manual's sixty-minute world day; stock restocking and world conditions share that same calendar. The manual catalog retains printed values so these can be reconciled as the simulation expands.

### Save limits

A save belongs to one browser origin under `eternal-powers-v1`. Clearing local storage or changing the host/origin creates a separate local journey. Settings exports a portable local backup. Private co-op characters use separate server identities and SQLite persistence; they never overwrite the original solo save. The server validates live commands and records transaction receipts. Optional initial checkpoint import is a private-world trust choice, not a claim of global anti-cheat authority.

### Verification

Run `npm test` for simulation unit checks and `npm run test:browser` for Playwright checks of movement, selection/casting, save persistence, panels, transactions, travel, audio startup, and phone layout. `npm run build` validates the production bundle. The browser tests require an installed Playwright Chromium browser. Network tests use independent clients against an ephemeral real WebSocket/SQLite server.

### Local construction and economy guarantees

Construction commits only after a valid preview and uses the exact recorded input quantities. Placement undo requires the unchanged component; dismantle undo charges back its earlier salvage refund. Layout restore compares the current and requested material totals, preserves matching component identities and durability, and clears stale undo entries. Removed storage routes contents to recovery. Repeated restore and undo commands cannot refund the same component twice.

Vendor quotes lock item, quantity, currency, durability and price factors for thirty simulation seconds. Settlement checks current stock, funds, pack capacity and the exact offered equipment identity. Each quote settles once and never changes lifetime karma. Common stock returns to ten units and base materials to twenty at the next world-calendar dawn. Equipment resale pays 40% of base price scaled by wear; repair costs 20% of base price; salvage returns 50% of recipe inputs, rounded down.

Committed crafts reserve inputs once, take five seconds within 220 pixels of the sanctuary artisan or an owned forge, pause on leaving the station/region or entering conflict, and resume without another input charge. An output that cannot fit goes to recovery storage.

## V2 implementation changes

The character creator now precedes all play on a fresh save. Name, native lineage/branch, appearance, free starting power and initial wallet are committed together; recreating an established identity is rejected. A pre-v2 save is migrated as an established character, while an explicitly unfinished new save remains in the creator. Sanctuary appearance changes preserve all progression and inventory.

Every named region is now 4800 × 3600, with its original story and recovery anchors preserved. Each includes six outer districts, architectural features, new halls and reachable habitats. The region atlas and nearby radar use actual geometry, consistent aspect ratio, team ownership and real assisted routes.

Renewable non-story enemies and wilderness resources use separate generation identities. Spawn timers pause at occupied/blocked anchors, survive travel and saving, and do not reset living damage. Story bosses, chests, offerings and first-completion lifetime rewards remain finite.

The optional Node server admits up to 64 travelers with independent regions and incremental/interest-filtered snapshots. A controlled 64-client WebSocket fixture verifies admission, the 65th-player boundary, movement, region isolation and reconnection; it is not a production hosting guarantee. The public GitHub Pages client requires an operator-provided HTTPS multiplayer server.

## Version 3 faction stories and power challenges

The two 12-mission faction campaigns, Concord of Dawn / Ashbound Covenant lore, named envoys and endings, and six reactive site mechanics are authored adaptation content. They are not claimed to be text or plot transcribed from the manual. They provide a clear character-centered path through the existing manual-derived regions and power systems. All local named powers retain their normal costs, preparation, cooldown and range when driving a site. See `CONCORD_AND_COVENANT.md` for exact progression and reward rules.

## Wilds Reborn action adaptation

Version 4 makes a new default action game. It preserves all 160 named power identities, 16 branches, eight affinity names, 39 regions and 30 creature identities while deliberately replacing the manual's provisional operation timings, costs, preparation and progression gates. Named powers use seven physical action forms (projectile, beam, burst, dash, orbit, summon, chain) with affinity statuses and combinations. All level-one branches and one ultimate are available immediately, with other levels purchased for one to five hunting shards. This implements the user's request for faster, freer power-centered combat; it is not presented as exact numerical or per-power-effect fidelity to the manual. Original manual descriptions remain available as catalog metadata. The previous broader systems, campaigns, world rituals, trading, construction and hosted co-op remain in Classic Journey at `?legacy=1`, with separate save namespaces.
