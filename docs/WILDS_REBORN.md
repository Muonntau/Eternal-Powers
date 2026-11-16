# Eternal Powers v4 — Wilds Reborn

Wilds Reborn is the default game. It rebuilds the moment-to-moment experience
around aimed powers, creature hunting, dodge timing, elemental combinations,
quick rewards and open travel. It is a new solo action mode with its own save.
The earlier character, campaigns, economy, sanctuary and 64-player co-op client
remain available through **Open your earlier journey**, or `?legacy=1`.

## Start with the interesting part

Choose a name, lineage and one of four starting forms: Emberbound, Tidecaller,
Stormweaver or Earthshaper. These are starting loadouts rather than permanent
classes. Both lineages can mix every affinity. All sixteen level-one powers
and your starting branch’s level-eight ultimate are available from the start.
Your six slots contain five basic powers and that ultimate.

Open the power library with **B**, choose a slot, then equip any unlocked power.
Every one of the manual’s 160 named levels is represented. Higher powers cost
only one to five power shards; the action mode does not require the earlier
sequential training, opposing-affinity certification or celestial rank gates.
Creature victories, treasure and combat challenges supply the shards. Try a
new loadout whenever you want to change how a fight feels.

Casting uses your aim immediately. Basic powers have short cooldowns and low
Essence costs; Essence returns quickly. Ultimate powers use a separate charge
meter that fills over time and through casting, hits and victories. The goal is to spend time combining powers in the world rather than
waiting through preparation bars or paying for repeated experiments.

## Fight, combine and explore

The action catalog uses seven attack forms: bolts, piercing beams, area bursts,
dashes, orbiting fields, temporary summons and chaining attacks. Eight affinity
identities shape their effects:

| Affinity | Action identity | Try it with |
| --- | --- | --- |
| Love | Charm and temporary creature support | Turn a crowded fight against itself |
| Light | Arcing energy | Chilled creatures for a conducting burst |
| Water | Chill and crowd control | Fire for thermal shock; Air or Light for conduction |
| Air | Forced movement and mobility | Chilled creatures, explosive objects and lingering fields |
| Hate | Exposure and amplified follow-up | Dark for soul rupture or a wide burst |
| Dark | Vitality drain | Exposed targets for soul rupture |
| Fire | Burning and detonation | Chilled creatures and volatile objects |
| Earth | Stagger and force | Burning targets for molten impact |

Creatures have visible preparation and recovery windows. Aim while moving,
watch the warning, dash out of the strike and punish the opening. Loot arrives
as useful combat resources, experience and shards. Regional elites and a
larger boss offer stronger encounters; a three-wave rift provides a compact
combat challenge with a larger reward. Defeated enemies and reactive props
can return, so a region remains a playground after its first clear.

The world also gives powers targets beyond health bars: volatile seedpods,
prism crystals, lifebloom springs and aether totems. Look for a chain reaction,
recovery opportunity or useful position before committing your next cast.
Treasure caches create reasons to leave the main path. Regional conduits also
answer two actual casts and grant a once-only shard reward.

The five combination reactions are thermal shock (Fire on chilled targets), shatter (Earth on chilled targets),
conduction (Air or Light on chilled targets), molten impact (Earth on burning
targets), and soul rupture (Dark on exposed targets). They amplify the follow-up
attack. A three-wave rift adds 4, then 5, then 6 creatures; clear it within its
100-second window for shards, experience, recovery and a full ultimate meter.

Experience raises your level, maximum health and shard balance. Falling reforms
you at the refuge after a short delay with health and Essence restored; earned
powers, shards, discoveries and loot stay with you. The action mode avoids
losing progress to a failed experiment.

## Thirty-nine open regions

All 39 manual-derived region names are available through the world map, across
Earth, Heaven and Hell. Wilds Reborn uses new 2800 × 2000 layouts with a refuge,
connected routes, regional scenery, crystalline structures, four treasure
caches, a rift and a boss arena. Each region contains 35 ordinary creatures,
three elites and one boss, with the manual’s thirty creature identities
represented across the three realms.

Seven biome palettes distinguish groves, waterways, deserts, cities, celestial
terraces, infernal land and mountains. Generated landscape art, animated
characters and creatures, hand-built scene geometry, layered spell effects and
an original reactive score form the new presentation. Arrival areas and major
routes are kept clear so the view remains useful during combat.

Travel is open rather than locked behind the earlier rank-and-contract route.
The map and current goal help you choose a direction; they do not force you to
finish a faction campaign before trying another realm.

## Controls

| Input | Action |
| --- | --- |
| WASD / arrow keys | Move |
| Mouse / pointer | Aim |
| Left click / right click | Cast slot 1 / slot 2; hold to keep casting |
| 1–6 | Cast the corresponding equipped power |
| Q | Cast the equipped ultimate |
| Space | Dash through danger with a brief invulnerability window |
| E | Interact with a nearby cache, gate or challenge |
| R | Use a healing draught |
| B | Open the power library and change the six-slot loadout |
| M | Open the world map |
| Escape | Pause or close a window |

The interface also exposes touch controls and clickable power slots. The guide
in the pause menu explains power combinations, hunting, rifts and free travel.
Audio starts after a player gesture and can be muted from the interface.

## Saves and the earlier journey

Wilds Reborn saves under `eternal-powers-reborn-v1`; Classic Journey uses
`eternal-powers-v1`. Starting the new mode does not reset or convert that earlier
character.
Returning to `?legacy=1` opens that earlier client and its own stored progress.
Browser origins have separate local data, so localhost and the published Pages
site do not share a save automatically.

Wilds Reborn currently runs locally as a solo simulation. The existing
server-authoritative rooms, player trading, shared market and 64-player capacity
belong to Classic Journey. They still require a separately running HTTPS Node
server when accessed from GitHub Pages. See [multiplayer hosting](MULTIPLAYER_HOSTING.md).
The new action mode does not silently join or alter a Classic server character.

## Relationship to the manual

The supplied manual is a provisional reference for a proposed game. Wilds
Reborn preserves its named power levels, affinities, creature identities and
regions, while deliberately changing execution rules to prioritize direct,
fast action. Its cooldowns, damage, costs, unlock economy, ultimate charge,
world layouts and encounter structure are authored adaptations. A large
manual ritual is represented by a combat-scale interpretation of that named
power; it does not run the earlier ritual-project simulation in this mode.

Classic Journey retains the deeper reference-oriented local powers, ritual
projects, contracts, certification, construction and economy. Neither mode
claims to reproduce an unavailable finished commercial game or implement a
full-dive interface. See [manual coverage](MANUAL_COVERAGE.md) for the wider
reference catalog and its simulation boundaries.
