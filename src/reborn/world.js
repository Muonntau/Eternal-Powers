import { CREATURES, ZONES } from "../data/manual.js";

export const WORLD_WIDTH = 2800;
export const WORLD_HEIGHT = 2000;
export const bounds = {
  x: 28,
  y: 28,
  width: WORLD_WIDTH - 56,
  height: WORLD_HEIGHT - 56,
};
export const PALETTES = {
  grove: {
    ground: "#193a38",
    groundLight: "#2b5343",
    groundDark: "#102b30",
    grass: "#39755e",
    path: "#56685c",
    pathLight: "#87927b",
    water: "#286478",
    waterLight: "#65ccd1",
    stone: "#6b8390",
    accent: "#7bf3d8",
    foliage: "#387b62",
    leaf: "#6ea781",
    sky: "#122c3b",
    fog: "#163849",
  },
  water: {
    ground: "#183b49",
    groundLight: "#2d5961",
    groundDark: "#102d3c",
    grass: "#3b786d",
    path: "#526e78",
    pathLight: "#99b5b7",
    water: "#26678b",
    waterLight: "#8ae5ec",
    stone: "#7b98b1",
    accent: "#9deeff",
    foliage: "#468f93",
    leaf: "#78b8ae",
    sky: "#153b55",
    fog: "#17485d",
  },
  desert: {
    ground: "#655252",
    groundLight: "#9c8070",
    groundDark: "#44374c",
    grass: "#9a8377",
    path: "#ad947b",
    pathLight: "#d9cbb2",
    water: "#425884",
    waterLight: "#b9b3f8",
    stone: "#a59ba3",
    accent: "#c2b1ff",
    foliage: "#8c83a5",
    leaf: "#c2a6b2",
    sky: "#46345a",
    fog: "#5d465e",
  },
  city: {
    ground: "#293b54",
    groundLight: "#41546b",
    groundDark: "#19283f",
    grass: "#365263",
    path: "#697a94",
    pathLight: "#a3adc3",
    water: "#2a5c82",
    waterLight: "#86c9ec",
    stone: "#bbc0d3",
    accent: "#c2b1ff",
    foliage: "#5867a0",
    leaf: "#8b9ad2",
    sky: "#17293e",
    fog: "#203655",
  },
  heaven: {
    ground: "#35495e",
    groundLight: "#66768a",
    groundDark: "#233448",
    grass: "#657f94",
    path: "#b0b2bd",
    pathLight: "#e9e3d5",
    water: "#488cb2",
    waterLight: "#b5f0f3",
    stone: "#d7d9e7",
    accent: "#b9d9ff",
    foliage: "#867bc0",
    leaf: "#c9b4ea",
    sky: "#334a75",
    fog: "#4b5881",
  },
  hell: {
    ground: "#3e2939",
    groundLight: "#6b3d4b",
    groundDark: "#241d2d",
    grass: "#754551",
    path: "#75566b",
    pathLight: "#b0889a",
    water: "#a94456",
    waterLight: "#ffb48d",
    stone: "#5c546f",
    accent: "#ff9dca",
    foliage: "#7b3f62",
    leaf: "#ac637b",
    sky: "#291b35",
    fog: "#442338",
  },
  mountain: {
    ground: "#303e4d",
    groundLight: "#566676",
    groundDark: "#1d2c3e",
    grass: "#536c78",
    path: "#728698",
    pathLight: "#b0c7d3",
    water: "#345c7a",
    waterLight: "#9fd4e6",
    stone: "#8099b1",
    accent: "#a4dff2",
    foliage: "#47747c",
    leaf: "#82a7ab",
    sky: "#263e5d",
    fog: "#3b536d",
  },
};
export function hash(value) {
  let result = 2166136261;
  for (const c of String(value))
    result = Math.imul(result ^ c.charCodeAt(0), 16777619);
  return result >>> 0;
}
export function seededRandom(seed) {
  let a = typeof seed === "number" ? seed >>> 0 : hash(seed);
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const getRegionInfo = (id) =>
  ZONES.find((z) => z.id === id) || ZONES.find((z) => z.id === "sacred-groves");
export function biomeFor(zone) {
  if (zone.realm === "hell") return "hell";
  if (/water|lake|bridge/.test(zone.id)) return "water";
  if (/mountain/.test(zone.id)) return "mountain";
  if (/desert|pyramid/.test(zone.id)) return "desert";
  if (
    /city|cities|settlement|hall|cathedral|temple|monument|palace|observator|librar/.test(
      zone.id,
    )
  )
    return zone.realm === "heaven" ? "heaven" : "city";
  if (zone.realm === "heaven") return "heaven";
  return "grove";
}
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const distanceToSegment = (p, a, b) => {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    length = dx * dx + dy * dy,
    t = length
      ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / length))
      : 0;
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
};
export function isBlocked(world, x, y, radius = 16) {
  if (typeof x === "object") {
    radius = typeof y === "number" ? y : x.radius || radius;
    y = x.y;
    x = x.x;
  }
  if (typeof radius === "object") radius = radius.radius || 16;
  if (
    x < 28 + radius ||
    y < 28 + radius ||
    x > world.width - 28 - radius ||
    y > world.height - 28 - radius
  )
    return true;
  return (world.obstacles || []).some(
    (o) =>
      !o.destroyed &&
      x + radius > o.x &&
      x - radius < o.x + o.width &&
      y + radius > o.y &&
      y - radius < o.y + o.height,
  );
}
export const collision = isBlocked;
export function isOnPath(world, x, y, extra = 0) {
  return world.paths.some((p) =>
    p.points.some(
      (point, index) =>
        index &&
        distanceToSegment({ x, y }, p.points[index - 1], point) <
          p.width / 2 + extra,
    ),
  );
}
function enemyFrom(creature, index, position, zone, kind = "normal") {
  const elite = kind === "elite",
    boss = kind === "boss",
    realm = zone.realm;
  const archetype = boss
    ? "boss"
    : /Mobile|Skirmisher|Pursuer/i.test(creature.role)
      ? "charger"
      : /Support|Control|Coordinator|Caster/i.test(creature.role)
        ? "caster"
        : /Defender|Tank|Brute|Juggernaut/i.test(creature.role)
          ? "brute"
          : index % 4 === 2
            ? "ranged"
            : "melee";
  const health = boss
    ? 700 + (zone.minRank || 1) * 20
    : elite
      ? 170 + (creature.rank || 1) * 8
      : 46 + (creature.rank || 1) * 4;
  return {
    id: `${zone.id}:enemy:${index}`,
    kind: "enemy",
    creatureId: creature.id,
    name: boss
      ? `${creature.name} · Rift Sovereign`
      : elite
        ? `Empowered ${creature.name}`
        : creature.name,
    ...position,
    home: { ...position },
    health,
    maxHealth: health,
    damage: boss
      ? 18
      : elite
        ? 12
        : 6 + Math.min(6, Math.floor((creature.rank || 1) / 2)),
    speed: boss
      ? 72
      : archetype === "charger"
        ? 132
        : archetype === "brute"
          ? 65
          : 90,
    aggroRange: boss ? 440 : elite ? 360 : 300,
    attackRange:
      archetype === "ranged" || archetype === "caster" ? 310 : boss ? 125 : 52,
    attackCooldown: boss ? 2.3 : archetype === "charger" ? 2.4 : 1.7,
    windup: boss ? 1.05 : 0.62,
    tell: boss
      ? "Leave the expanding ring before it detonates."
      : archetype === "charger"
        ? "Sidestep the line, then punish the landing."
        : archetype === "ranged"
          ? "Dodge the glowing projectile."
          : archetype === "caster"
            ? "Move out of the bright circle."
            : "Step out of the marked strike, then counter.",
    counterplay: creature.counterplay,
    description: creature.description,
    drops: boss
      ? { shards: 8, essence: 35, health: 30 }
      : elite
        ? { shards: 3, essence: 12, health: 10 }
        : { shards: 1, essence: 8, health: 4 },
    xp: boss ? 160 : elite ? 45 : 10 + Math.floor((creature.rank || 1) * 1.5),
    elite,
    boss,
    archetype,
    color:
      realm === "hell" ? "#e58dac" : realm === "heaven" ? "#c7d9ff" : "#9bd2be",
    radius: boss ? 42 : elite ? 27 : 19,
    resistantTag: creature.resistantTag,
    vulnerableTag: creature.vulnerableTag,
    spriteIndex: CREATURES.findIndex((c) => c.id === creature.id),
    state: "idle",
    phase: 0,
    dead: false,
    spawnGeneration: 0,
    respawnDelay: boss ? 100 : elite ? 65 : 40,
  };
}
export function createRegion(zoneId = "sacred-groves", { seed = 0 } = {}) {
  const zone = getRegionInfo(zoneId),
    rng = seededRandom(hash(zone.id) + seed),
    biome = biomeFor(zone),
    palette = { ...PALETTES[biome] },
    index = ZONES.findIndex((z) => z.id === zone.id);
  const shift = ((index % 5) - 2) * 23;
  const world = {
    ...zone,
    id: zone.id,
    name: zone.name,
    realm: zone.realm,
    biome,
    palette,
    width: WORLD_WIDTH,
    height: WORLD_HEIGHT,
    seed: hash(zone.id) + seed,
    spawn: { x: 620, y: 1050 },
    safeRadius: 190,
    paths: [],
    river: [],
    obstacles: [],
    props: [],
    features: [],
    enemies: [],
    chests: [],
    portals: [],
    challenges: [],
  };
  const destinations = [
    { x: 620, y: 1050 },
    { x: 1240 + shift, y: 600 },
    { x: 2160, y: 540 + shift },
    { x: 2200, y: 1460 - shift },
    { x: 1150 - shift, y: 1550 },
  ];
  const poiNames =
    biome === "hell"
      ? [
          "Ember Refuge",
          "The Broken Furnace",
          "The Sovereign's Dais",
          "The Ashen Crucible",
          "Lost Pact Gardens",
        ]
      : biome === "heaven"
        ? [
            "Dawn Refuge",
            "The Prism Archive",
            "The Astral Dais",
            "The Luminous Crucible",
            "The Sky Gardens",
          ]
        : biome === "desert"
          ? [
              "Dune Refuge",
              "The Sunken Orrery",
              "The Star Pyramid",
              "The Glass Crucible",
              "The Singing Oasis",
            ]
          : [
              "Wayfarer's Refuge",
              "The Resonant Ruins",
              "The Sovereign's Dais",
              "The Wild Crucible",
              "The Moonlit Garden",
            ];
  const kinds = [
    "hub",
    "ruins",
    biome === "desert" ? "pyramid" : "dais",
    "rift",
    "garden",
  ];
  world.features = destinations.map((p, i) => ({
    id: `${zone.id}:feature:${i}`,
    kind: kinds[i],
    type: kinds[i],
    name: poiNames[i],
    ...p,
    radius: i === 0 ? 165 : i === 2 ? 160 : 125,
    accent: palette.accent,
    seed: Math.floor(rng() * 10000),
  }));
  const loop = [
    destinations[0],
    destinations[1],
    destinations[2],
    destinations[3],
    destinations[4],
    destinations[0],
  ];
  world.paths = [
    {
      id: "grand-loop",
      points: loop,
      width: 68,
      material: biome === "grove" ? "earth" : "stone",
    },
    {
      id: "crossing",
      points: [destinations[1], { x: 1450, y: 1040 }, destinations[3]],
      width: 46,
      material: "stone",
    },
    {
      id: "western-approach",
      points: [
        { x: 220, y: 1050 },
        destinations[0],
        { x: 1040, y: 1060 },
        { x: 1450, y: 1040 },
      ],
      width: 54,
      material: "stone",
    },
  ];
  const riverX = biome === "desert" ? 2460 : 1540 + shift;
  world.river = Array.from({ length: 23 }, (_, i) => ({
    x: riverX + Math.sin(i * 0.55 + index) * 90,
    y: i * 100 - 100,
  }));
  world.water = {
    points: world.river,
    width: biome === "water" ? 155 : biome === "hell" ? 58 : 72,
    kind: biome === "hell" ? "lava" : "river",
  };
  // Bridges and gates are visible landmarks, while their deck stays traversable.
  for (const y of [650, 1350])
    world.features.push({
      id: `${zone.id}:bridge:${y}`,
      kind: "bridge",
      type: "bridge",
      name: biome === "hell" ? "Obsidian Crossing" : "Prism Crossing",
      x: riverX + Math.sin(y / 190 + index) * 60,
      y,
      radius: 70,
      width: 220,
      height: 90,
      accent: palette.accent,
    });
  world.portals.push({
    id: `${zone.id}:portal`,
    kind: "portal",
    x: 465,
    y: 980,
    radius: 42,
    name: "Realm Gate",
    destination: null,
  });
  world.challenges.push({
    id: `${zone.id}:rift`,
    kind: "rift",
    x: destinations[3].x,
    y: destinations[3].y,
    radius: 110,
    name: "Prism Rift",
    waves: 3,
    reward: 8,
  });
  world.chests = [
    {
      id: `${zone.id}:chest:0`,
      x: 850,
      y: 830,
      opened: false,
      rarity: "common",
    },
    {
      id: `${zone.id}:chest:1`,
      x: destinations[1].x + 75,
      y: destinations[1].y + 65,
      opened: false,
      rarity: "rare",
    },
    {
      id: `${zone.id}:chest:2`,
      x: destinations[4].x + 90,
      y: destinations[4].y - 30,
      opened: false,
      rarity: "rare",
    },
    {
      id: `${zone.id}:chest:3`,
      x: destinations[2].x + 85,
      y: destinations[2].y + 85,
      opened: false,
      rarity: "epic",
      bossLocked: true,
    },
  ];
  const clear = (p) =>
    distance(p, world.spawn) < 235 ||
    world.features.some((f) => distance(p, f) < f.radius + 42) ||
    isOnPath(world, p.x, p.y, 36) ||
    world.chests.some((c) => distance(p, c) < 110);
  const obstaclesTarget = biome === "city" || biome === "heaven" ? 22 : 17;
  for (
    let i = 0;
    i < obstaclesTarget * 7 && world.obstacles.length < obstaclesTarget;
    i++
  ) {
    const p = { x: 180 + rng() * 2440, y: 160 + rng() * 1680 };
    if (clear(p)) continue;
    const width =
        biome === "city" || biome === "heaven"
          ? 54 + rng() * 54
          : 36 + rng() * 43,
      height = 34 + rng() * 42;
    if (
      world.obstacles.some(
        (o) => Math.hypot(p.x - o.x - width / 2, p.y - o.y - height / 2) < 120,
      )
    )
      continue;
    const kind =
      biome === "desert"
        ? "monolith"
        : biome === "city" || biome === "heaven"
          ? "pillar"
          : biome === "hell"
            ? "obsidian"
            : "rock";
    const id = `${zone.id}:obstacle:${world.obstacles.length}`;
    world.obstacles.push({
      id,
      x: p.x - width / 2,
      y: p.y - height / 2,
      width,
      height,
      kind,
    });
    world.props.push({
      id,
      kind,
      ...p,
      width,
      height,
      radius: width / 2,
      blocking: true,
      destructible: false,
      color: palette.stone,
      seed: rng(),
    });
  }
  // Rich perimeter detail with clear combat lanes and generous empty silhouettes.
  for (let i = 0; i < 180; i++) {
    const p = { x: 100 + rng() * 2600, y: 100 + rng() * 1800 };
    if (clear(p) || isBlocked(world, p.x, p.y, 38)) continue;
    const kind =
      biome === "desert"
        ? i % 3
          ? "crystal"
          : "dune"
        : biome === "city" || biome === "heaven"
          ? i % 3
            ? "crystal"
            : "planter"
          : biome === "hell"
            ? i % 3
              ? "thorn"
              : "ember"
            : i % 4 === 0
              ? "flower"
              : "tree";
    world.props.push({
      id: `${zone.id}:scenery:${i}`,
      kind,
      ...p,
      radius: kind === "tree" ? 20 : 12,
      height: kind === "tree" ? 65 + rng() * 50 : 22,
      scale: 0.7 + rng() * 0.8,
      color: kind === "flower" ? "#d4b3ee" : palette.foliage,
      seed: rng(),
      destructible: false,
      blocking: false,
    });
  }
  // Affinity toys are deliberately on encounter approaches, not hidden in menus.
  for (let i = 0; i < 17; i++) {
    const anchor =
      i < 3
        ? { x: 1010 + i * 96, y: 1000 + (i % 2) * 120 }
        : destinations[1 + (i % 4)];
    const p = {
      x: anchor.x + (rng() - 0.5) * 240,
      y: anchor.y + (rng() - 0.5) * 210,
    };
    if (isBlocked(world, p.x, p.y, 32) || distance(p, world.spawn) < 240)
      continue;
    const kind = ["explosive", "crystal", "spring", "totem"][i % 4];
    world.props.push({
      id: `${zone.id}:toy:${i}`,
      kind,
      name: {
        explosive: "Volatile Seedpod",
        crystal: "Prism Crystal",
        spring: "Lifebloom Spring",
        totem: "Aether Totem",
      }[kind],
      ...p,
      radius: kind === "totem" ? 24 : 17,
      health: kind === "totem" ? 75 : 25,
      maxHealth: kind === "totem" ? 75 : 25,
      destructible: true,
      blocking: false,
      color: kind === "explosive" ? "#ffb277" : palette.accent,
      respawnDelay: 45,
    });
  }
  let creaturePool = CREATURES.filter((c) => c.realm === zone.realm),
    named = creaturePool.filter((c) =>
      (zone.encounters || "").includes(c.name),
    );
  creaturePool = [...named, ...creaturePool.filter((c) => !named.includes(c))];
  const placeEnemy = (n, position, kind = "normal") => {
    let p = { ...position };
    for (
      let attempt = 0;
      attempt < 35 &&
      (isBlocked(world, p.x, p.y, 27) ||
        distance(p, world.spawn) < 300 ||
        world.enemies.some((e) => distance(e, p) < 50));
      attempt++
    )
      p = {
        x: Math.max(340, Math.min(2570, position.x + (rng() - 0.5) * 290)),
        y: Math.max(230, Math.min(1800, position.y + (rng() - 0.5) * 290)),
      };
    if (isBlocked(world, p.x, p.y, 27) || distance(p, world.spawn) < 290)
      return;
    const creature =
      creaturePool[(n + Math.floor(index / 3)) % creaturePool.length];
    world.enemies.push(enemyFrom(creature, n, p, zone, kind));
  };
  for (let i = 0; i < 35; i++) {
    const p =
      i < 5
        ? { x: 1000 + (i % 3) * 86, y: 1010 + Math.floor(i / 3) * 110 }
        : i < 15
          ? {
              x: destinations[1].x + (rng() - 0.5) * 400,
              y: destinations[1].y + (rng() - 0.5) * 390,
            }
          : i < 25
            ? {
                x: destinations[4].x + (rng() - 0.5) * 450,
                y: destinations[4].y + (rng() - 0.5) * 350,
              }
            : {
                x: destinations[3].x + (rng() - 0.5) * 440,
                y: destinations[3].y + (rng() - 0.5) * 350,
              };
    placeEnemy(i, p);
  }
  [destinations[1], destinations[3], destinations[4]].forEach((p, i) =>
    placeEnemy(35 + i, { x: p.x + 105, y: p.y - 120 }, "elite"),
  );
  placeEnemy(38, destinations[2], "boss");
  world.landmarks = world.features;
  return world;
}
