import { assetUrl } from "../assetUrl.js";
import { CREATURES } from "../data/manual.js";

// Encounter actions use the manual's visible tells and finite authored outcomes.
// The catalog supplies identity and printed stats; these profiles supply 2D AI.
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const TAU = Math.PI * 2;
const PROFILES = Object.fromEntries(CREATURES.map((c) => [c.id, c]));
const HARD_CONTROL = new Set(["root", "stun", "feared", "calmed", "silence"]);

const CONFIG = {
  "luminous-cherublings": {
    behavior: "charger",
    pattern: "dart",
    sprite: "angel",
    windup: 1,
    recovery: 2,
    range: 120,
    radius: 38,
    multiplier: 1,
    status: "slow",
  },
  "radiant-seraphic-guardians": {
    behavior: "defender",
    pattern: "beam",
    sprite: "sentinel",
    windup: 1,
    recovery: 2.3,
    range: 230,
    radius: 24,
    ward: 0.5,
  },
  "ethereal-virtue-keepers": {
    behavior: "support",
    pattern: "heal",
    sprite: "angel",
    windup: 1.5,
    recovery: 2,
    range: 170,
    radius: 45,
    support: "heal",
  },
  "astral-celestial-beasts": {
    behavior: "charger",
    pattern: "dive",
    sprite: "serpent",
    windup: 1.5,
    recovery: 2,
    range: 240,
    radius: 90,
    multiplier: 1.5,
    status: "slow",
  },
  "celestial-arbiters": {
    behavior: "control",
    pattern: "restraint",
    sprite: "angel",
    windup: 2,
    recovery: 2.2,
    range: 190,
    radius: 55,
    status: "root",
  },
  "harmony-envoys": {
    behavior: "support",
    pattern: "pulse",
    sprite: "angel",
    windup: 2,
    recovery: 2.3,
    range: 140,
    radius: 150,
    support: "potency",
  },
  "empyreal-avatars": {
    behavior: "summoner",
    pattern: "projection",
    sprite: "spirit",
    windup: 1.75,
    recovery: 2.5,
    range: 220,
    radius: 150,
    teleport: 15,
  },
  "celestial-sages": {
    behavior: "ranged",
    pattern: "counter",
    sprite: "spirit",
    windup: 2,
    recovery: 2.5,
    range: 230,
    radius: 55,
    adaptive: true,
  },
  "ethereal-celestial-wardens": {
    behavior: "guardian",
    pattern: "form",
    sprite: "sentinel",
    windup: 2,
    recovery: 2.5,
    range: 220,
    radius: 65,
    ward: 0.25,
    multiplier: 1.5,
  },
  "ascended-celestial-hierarchs": {
    behavior: "guardian",
    pattern: "anchors",
    sprite: "angel",
    windup: 2.5,
    recovery: 3,
    range: 300,
    radius: 105,
    multiplier: 2,
    world: true,
  },
  "nature-sprites": {
    behavior: "support",
    pattern: "dart",
    sprite: "firefly",
    windup: 1,
    recovery: 2,
    range: 140,
    radius: 36,
    support: "growth",
  },
  "elemental-guardians": {
    behavior: "guardian",
    pattern: "element",
    sprite: "guardian",
    windup: 1.45,
    recovery: 2.5,
    range: 95,
    radius: 75,
    adaptive: true,
  },
  "celestial-familiars": {
    behavior: "support",
    pattern: "assist",
    sprite: "fox",
    windup: 1,
    recovery: 2.5,
    range: 100,
    radius: 40,
    support: "barrier",
  },
  "ancestral-spirits": {
    behavior: "ranged",
    pattern: "echo",
    sprite: "spirit",
    windup: 1.5,
    recovery: 2.5,
    range: 180,
    radius: 60,
    teleport: 15,
  },
  "celestial-stewards": {
    behavior: "defender",
    pattern: "repair",
    sprite: "golem",
    windup: 1.5,
    recovery: 2.5,
    range: 75,
    radius: 48,
    support: "repair",
  },
  "celestial-wardens": {
    behavior: "defender",
    pattern: "gate",
    sprite: "sentinel",
    windup: 2,
    recovery: 2.6,
    range: 190,
    radius: 30,
    ward: 0.25,
    push: true,
  },
  "ethereal-shamans": {
    behavior: "support",
    pattern: "channel",
    sprite: "spirit",
    windup: 2,
    recovery: 3,
    range: 160,
    radius: 55,
    support: "heal",
    cleanse: true,
  },
  "luminous-elemental-sages": {
    behavior: "ranged",
    pattern: "combination",
    sprite: "guardian",
    windup: 1.6,
    recovery: 2.6,
    range: 210,
    radius: 65,
    adaptive: true,
    status: "slow",
  },
  "celestial-bards": {
    behavior: "support",
    pattern: "rhythm",
    sprite: "angel",
    windup: 2,
    recovery: 2.5,
    range: 170,
    radius: 75,
    support: "morale",
  },
  "ethereal-earth-keepers": {
    behavior: "guardian",
    pattern: "anchors",
    sprite: "golem",
    windup: 2.5,
    recovery: 3,
    range: 300,
    radius: 110,
    multiplier: 2,
    world: true,
  },
  "infernal-imps": {
    behavior: "ranged",
    pattern: "spark",
    sprite: "imp",
    windup: 1,
    recovery: 2,
    range: 190,
    radius: 32,
    retreat: true,
  },
  "dark-shadow-stalkers": {
    behavior: "ambusher",
    pattern: "lunge",
    sprite: "shadow",
    windup: 1,
    recovery: 2,
    range: 180,
    radius: 32,
    multiplier: 1.5,
    teleport: 12,
  },
  "tormented-souls": {
    behavior: "ranged",
    pattern: "affliction",
    sprite: "wisp",
    windup: 1.5,
    recovery: 2.7,
    range: 180,
    radius: 95,
    affliction: true,
  },
  "hellish-demonic-hounds": {
    behavior: "charger",
    pattern: "rush",
    sprite: "wolf",
    windup: 1.25,
    recovery: 2,
    range: 240,
    radius: 28,
    multiplier: 1.5,
  },
  "malevolent-succubi-incubi": {
    behavior: "drain",
    pattern: "influence",
    sprite: "demon",
    windup: 1.5,
    recovery: 2.5,
    range: 180,
    radius: 60,
    status: "slow",
    drain: true,
  },
  "infernal-executioners": {
    behavior: "melee",
    pattern: "heavy",
    sprite: "demon",
    windup: 2,
    recovery: 3,
    range: 90,
    radius: 95,
    multiplier: 2,
    status: "root",
  },
  "maleficent-soul-harvesters": {
    behavior: "drain",
    pattern: "tether",
    sprite: "shadow",
    windup: 1.5,
    recovery: 3,
    range: 210,
    radius: 30,
    drain: true,
    tether: true,
  },
  "diabolic-demonic-wardens": {
    behavior: "guardian",
    pattern: "quadrant",
    sprite: "sentinel",
    windup: 2,
    recovery: 2.5,
    range: 150,
    radius: 105,
    multiplier: 1.5,
    ward: 0.25,
  },
  "malevolent-archdemon-lords": {
    behavior: "summoner",
    pattern: "command",
    sprite: "demon",
    windup: 2,
    recovery: 3,
    range: 250,
    radius: 120,
    multiplier: 2,
    support: "potency",
  },
  "apocalyptic-hellfire-titans": {
    behavior: "guardian",
    pattern: "anchors",
    sprite: "golem",
    windup: 2.75,
    recovery: 3,
    range: 300,
    radius: 115,
    multiplier: 2,
    world: true,
    affliction: true,
  },
};

export const CREATURE_BEHAVIORS = Object.fromEntries(
  CREATURES.map((c) => [
    c.id,
    { ...CONFIG[c.id], creatureId: c.id, manualPage: c.manualPage },
  ]),
);
function seeded(seed) {
  let n = Number(seed) >>> 0;
  return () => (n = (n * 1664525 + 1013904223) >>> 0) / 4294967296;
}
function hash(s) {
  return [...String(s)].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 17);
}
function catalogPool(zone) {
  const text = String(zone.encounters || "").toLowerCase();
  return CREATURES.filter(
    (c) =>
      text.includes(c.name.toLowerCase()) ||
      text.includes(c.name.replace(/^Ethereal /, "").toLowerCase()),
  );
}
function journal(game) {
  game.player.encounters ||= {
    solved: {},
    assisted: {},
    discovered: [],
    sequence: {},
    rewards: [],
  };
  const s = game.player.encounters;
  s.solved ||= {};
  s.assisted ||= {};
  s.discovered ||= [];
  s.sequence ||= {};
  s.rewards ||= [];
  return s;
}
function zoneKey(game, suffix = "") {
  return `${game.zone.id}:${suffix}`;
}
// Offering receipts belong to the player and a stable authored contact, not to
// a regenerated render entity or a shared NPC's global assisted flag.
function offeringKey(game, creature) {
  return zoneKey(
    game,
    creature.offeringIdentity || creature.baseEntityId || creature.id,
  );
}
function offeringRequirements(creature, inventory = {}) {
  const offer = creature?.offer;
  const materials =
    offer?.materials || (offer?.item ? { [offer.item]: offer.quantity } : null);
  if (!materials || typeof materials !== "object" || Array.isArray(materials))
    return [];
  const entries = Object.entries(materials);
  if (
    !entries.length ||
    entries.length > 8 ||
    entries.some(
      ([item, quantity]) =>
        !/^[a-zA-Z][a-zA-Z0-9-]{0,47}$/.test(item) ||
        !Number.isSafeInteger(quantity) ||
        quantity < 1 ||
        quantity > 9999,
    )
  )
    return [];
  return entries.map(([item, quantity]) => {
    const available = Math.max(0, Math.floor(Number(inventory[item]) || 0));
    return {
      item,
      quantity,
      available,
      missing: Math.max(0, quantity - available),
    };
  });
}
function creatureInteraction(game, creature) {
  const requirements = offeringRequirements(creature, game.player.inventory);
  const assisted = !!journal(game).assisted[offeringKey(game, creature)];
  const d = distance(creature, game.player),
    inRange = Number.isFinite(d) && d <= 130;
  const alive =
    !creature.dead &&
    !creature.collected &&
    (creature.health == null || creature.health > 0);
  let reason = "";
  if (creature.role !== "encounter-contact" || !requirements.length)
    reason = "This creature has no posted material request.";
  else if (!alive)
    reason = "This creature is no longer available for an offering.";
  else if (game.downed) reason = "Recover before offering materials.";
  else if (assisted) reason = "Your offering has already been received.";
  else if (!inRange)
    reason = "Approach the creature to give its requested materials.";
  else if (requirements.some((r) => r.missing))
    reason = "Gather the missing materials before giving this offering.";
  const foreign = creature.ownerId && creature.ownerId !== game.player.id;
  const companion =
    !!game.player.companion &&
    game.player.companion.creatureId === creature.creatureId &&
    !foreign;
  return {
    distance: Number.isFinite(d) ? Math.round(d) : null,
    range: 130,
    inRange,
    requirements,
    assisted,
    canOffer: !reason,
    reason,
    canBond:
      !!creature.canBond &&
      assisted &&
      inRange &&
      alive &&
      !game.downed &&
      !game.inCombat?.(),
    bondReason: !creature.canBond
      ? ""
      : !assisted
        ? "Complete this familiar’s offering first."
        : !inRange
          ? "Approach the familiar to form a bond."
          : game.inCombat?.()
            ? "Leave conflict before forming a bond."
            : "",
    companion,
    point: { x: creature.x, y: creature.y, zoneId: game.zone.id },
  };
}

function notice(game, type, text, details) {
  game.event?.(type, text, details);
}
function effect(game, at, kind, color, radius, duration) {
  game.effect?.(at, kind, color, radius, duration);
}
function setStatus(game, type, duration, fields = {}) {
  const current = game.player.statuses.find((s) => s.type === type);
  if (current)
    Object.assign(current, fields, {
      until: Math.max(current.until, game.time + duration),
    });
  else
    game.player.statuses.push({ type, until: game.time + duration, ...fields });
}

function hostileEntity(profile, id, position, boss = false) {
  const config = CONFIG[profile.id];
  return {
    id,
    ...position,
    name: profile.name,
    kind: "enemy",
    creatureId: profile.id,
    profiledEncounter: true,
    sprite: config.sprite,
    spritePath: assetUrl(`/assets/creature-${profile.id}-sheet.png`),
    behavior: config.behavior,
    realm: profile.realm,
    rank: profile.rank,
    encounterRank: profile.rank,
    health: profile.hp,
    maxHealth: profile.hp,
    damage: profile.attack,
    speed:
      config.behavior === "charger"
        ? 95
        : config.behavior === "ambusher"
          ? 98
          : config.behavior === "guardian"
            ? 48
            : 65,
    boss,
    worldBoss: !!config.world,
    phase: 1,
    state: "idle",
    cooldown: 1,
    morale: 50,
    home: { ...position },
    description: `${profile.description} ${profile.noncombat}`,
    counterplay: profile.counterplay,
    resistance: profile.resistance,
    resistantTag: profile.resistantTag,
    vulnerableTag: profile.vulnerableTag,
    attackRadius: config.radius,
    attackShape: ["beam", "spark", "rush", "lunge", "gate", "tether"].includes(
      config.pattern,
    )
      ? "line"
      : ["heavy", "echo", "rhythm"].includes(config.pattern)
        ? "cone"
        : "circle",
    activeElement:
      profile.id === "elemental-guardians" ||
      profile.id === "luminous-elemental-sages"
        ? "fire"
        : null,
    controlProtection: {},
    supportCooldown: 5,
    specialCooldown: 5,
    manualPage: profile.manualPage,
  };
}

export function createRegionalEncounters(zone, playerRank = 1, seed = 17) {
  const rng = seeded(seed + hash(zone.id)),
    realm = CREATURES.filter((c) => c.realm === (zone.realm || "earth"));
  const tier = clamp(Math.max(zone.minRank || 1, playerRank), 1, 10);
  const pool = catalogPool(zone),
    fit = realm.filter(
      (c) => c.rank <= tier + 1 && c.rank >= Math.max(1, tier - 2),
    );
  const preferred = pool.filter((c) => c.rank <= tier + 1);
  const candidates = preferred.length ? preferred : fit.length ? fit : realm;
  const picks = [0, 1, 2].map(
    (_, i) =>
      candidates[
        (i + Math.floor(rng() * candidates.length)) % candidates.length
      ],
  );
  const guardianRank = clamp(tier + 1, 2, 10);
  const guardian =
    realm.find((c) => c.rank === guardianRank) || realm[realm.length - 1];
  const points = [
    { x: 1620, y: 970 },
    { x: 1760, y: 760 },
    { x: 1820, y: 1150 },
  ];
  const result = picks.map((profile, i) =>
    hostileEntity(profile, `blight-${i + 1}`, points[i]),
  );
  result.push(hostileEntity(guardian, "guardian", { x: 2040, y: 580 }, true));
  const contactPool = pool.length ? pool : realm;
  const contacts = [
    contactPool[Math.floor(rng() * contactPool.length)],
    zone.realm === "earth" ? PROFILES["celestial-familiars"] : realm[0],
  ];
  contacts.forEach((profile, i) =>
    result.push({
      id: `encounter-contact-${i + 1}`,
      x: i ? 600 : 1200,
      y: i ? 650 : 1340,
      name: profile.name,
      creatureId: profile.id,
      sprite: CONFIG[profile.id].sprite,
      spritePath: assetUrl(`/assets/creature-${profile.id}-sheet.png`),
      kind: "npc",
      role: "encounter-contact",
      neutral: true,
      health: profile.hp,
      maxHealth: profile.hp,
      rank: profile.rank,
      description: profile.noncombat,
      counterplay: profile.counterplay,
      manualPage: profile.manualPage,
      offer: { item: i ? "herb" : "crystal", quantity: 1 },
      canBond: profile.id === "celestial-familiars",
      objective: "assist",
      home: { x: i ? 600 : 1200, y: i ? 650 : 1340 },
    }),
  );
  const nodeType =
    /library|libraries|knowledge|palace|city|cities|observator|monument/.test(
      zone.id,
    )
      ? "evidence"
      : /grove|forest|garden|waterfall|lake/.test(zone.id)
        ? "source"
        : "elemental";
  const elements = ["Water", "Earth", "Air"],
    sequence = Math.floor(rng() * 3);
  [
    { x: 1830, y: 460 },
    { x: 2050, y: 340 },
    { x: 2220, y: 730 },
  ].forEach((point, i) =>
    result.push({
      id: `encounter-node-${i + 1}`,
      ...point,
      kind: "encounter-node",
      role: "encounter-node",
      nodeType,
      name: `${nodeType === "evidence" ? "Evidence" : nodeType === "source" ? "Habitat" : "Elemental"} Anchor ${i + 1}`,
      element: elements[(i + sequence) % 3],
      sequenceIndex: i,
      glyph: ["I", "II", "III"][i],
      sprite: nodeType === "source" ? "shrine" : "ruin",
      description: `Visible sequence ${["I", "II", "III"][i]} of III. Inspect the glyphs, then activate anchors I → II → III to ${nodeType === "evidence" ? "verify the observation" : nodeType === "source" ? "rebalance the habitat" : "stabilize the elemental field"}. This is a finite peaceful alternative to fighting the guardian.`,
      activated: false,
      protected: true,
    }),
  );
  return result;
}

export function initializeRegionalEncounters(game) {
  const s = journal(game),
    key = game.zone.id;
  for (const n of game.entities) {
    if (n.kind === "encounter-node")
      n.activated = !!s.solved[key] || (s.sequence[key] || 0) > n.sequenceIndex;
    if (n.role === "encounter-contact")
      n.assisted = !!s.assisted[offeringKey(game, n)];
  }
  updateCompanion(game, 0);
}

export function getEncounterQuestDefs(game) {
  const rank = Math.max(1, game.zone.minRank || 1);
  return [
    {
      id: `${game.zone.id}:visible-anchors`,
      title: /library|knowledge|city|observator/.test(game.zone.id)
        ? "A Pattern in Plain Sight"
        : "The Threefold Balance",
      description:
        "Read the marked anchors near the northern ruins. Activate I, II, then III to resolve the regional guardian peacefully.",
      total: 3,
      reward: 25 * rank,
      currency: "good",
      icon: "map",
      type: "encounter-puzzle",
    },
    {
      id: `${game.zone.id}:finite-offering`,
      title: "An Offered Hand",
      description:
        "Inspect a neutral creature’s posted need, then supply exactly the requested herb or crystal through its inspect card.",
      total: 1,
      reward: 25 * rank,
      currency: "good",
      icon: "leaf",
      type: "encounter-assist",
    },
  ];
}

export function interactEncounter(game, target) {
  if (!target) return false;
  if (target.kind === "encounter-node") {
    const state = journal(game),
      key = game.zone.id;
    if (state.solved[key]) {
      notice(
        game,
        "info",
        "This region’s anchor sequence is already settled. No duplicate reward is available.",
      );
      return true;
    }
    const expected = state.sequence[key] || 0;
    if (target.sequenceIndex !== expected) {
      state.sequence[key] = 0;
      for (const n of game.entities.filter((n) => n.kind === "encounter-node"))
        n.activated = false;
      notice(
        game,
        "info",
        "The visible sequence resets. Follow the marked order: I → II → III. No resources were spent.",
      );
    } else {
      target.activated = true;
      state.sequence[key] = expected + 1;
      effect(game, target, "heal", "#a9dfba", 60, 1.2);
      notice(
        game,
        "success",
        `Anchor ${target.glyph} aligned · ${expected + 1}/3.`,
      );
      if (expected === 2) {
        state.solved[key] = true;
        game.progress?.("encounter-puzzle", 3);
        const guardian = game.entities.find(
          (n) => n.id === "guardian" && !n.dead,
        );
        if (guardian) game.resolveEnemy?.(guardian, true);
        notice(
          game,
          "success",
          "The visible anchors are balanced. The guardian accepts the peaceful resolution.",
        );
      }
    }
    game.save?.(false);
    game.publish?.();
    return true;
  }
  if (target.role === "encounter-contact") {
    const state = journal(game),
      key = offeringKey(game, target);
    if (!state.discovered.includes(target.creatureId))
      state.discovered.push(target.creatureId);
    const requirements = offeringRequirements(target, game.player.inventory);
    const need = requirements.map((r) => `${r.quantity} ${r.item}`).join(" + ");
    const text = state.assisted[key]
      ? `${target.name}: your assistance is remembered.${target.canBond ? " Your familiar bond is available here." : ""}`
      : `${target.name}: ${target.description} Posted need: ${need || "no material request"}.${target.canBond ? " Complete the offering to form an optional familiar bond." : ""}`;
    game.targetId = target.id;
    game.destination = null;
    game.keys?.clear?.();
    notice(game, "open-creature", text, {
      targetId: target.id,
      creatureId: target.creatureId,
    });
    game.publish?.();
    return true;
  }
  return false;
}

function support(game, n, config) {
  const allies = game.entities
    .filter((a) => a.kind === "enemy" && !a.dead && distance(a, n) <= 180)
    .sort((a, b) => a.health / a.maxHealth - b.health / b.maxHealth)
    .slice(0, 2);
  if (config.support === "heal") {
    const ally = allies[0] || n;
    const reduction = ally.healReductionUntil > game.time ? 0.7 : 1;
    ally.health = Math.min(
      ally.maxHealth,
      ally.health + Math.floor(n.damage * 2 * reduction),
    );
    if (config.cleanse) {
      ally.dot = null;
      ally.statusUntil = 0;
    }
    effect(game, ally, "heal", "#b7e1a5", 55, 0.8);
  } else if (config.support === "barrier") {
    const ally = allies[0] || n;
    ally.encounterBarrier = Math.max(ally.encounterBarrier || 0, 10);
    ally.encounterBarrierUntil = game.time + 6;
  } else if (config.support === "growth" || config.support === "repair") {
    // A supporting enemy may restore an unsettled source, never minting a new harvest or reward identity.
    const patch = game.entities.find(
      (a) =>
        a.kind === "patch" &&
        !a.rewardedOutcome &&
        !a.eroded &&
        distance(a, n) <= 240,
    );
    if (patch) {
      patch.health = Math.min(
        patch.maxHealth - 1,
        patch.health + (config.support === "growth" ? 20 : n.damage * 2),
      );
      effect(game, patch, "heal", "#a8d79b", 38, 0.7);
    }
  } else {
    for (const ally of allies) {
      ally.potencyUntil = game.time + 6;
      ally.potencyMultiplier = config.support === "morale" ? 1.1 : 1.15;
      if (config.support === "morale")
        ally.morale = Math.min(100, ally.morale + 30);
      effect(game, ally, "spell", "#e5d09e", 38, 0.8);
    }
  }
}

function startAttack(game, n, config) {
  n.state = "windup";
  n.windup = config.windup;
  n.windupTotal = config.windup;
  n.attackFrom = { x: n.x, y: n.y };
  n.attackTarget = { x: game.player.x, y: game.player.y };
  n.attackRadius = config.radius;
  n.attackShape = ["beam", "spark", "rush", "lunge", "gate", "tether"].includes(
    config.pattern,
  )
    ? "line"
    : ["heavy", "echo", "rhythm"].includes(config.pattern)
      ? "cone"
      : "circle";
  n.activeTell = `${config.pattern} · ${config.windup}s warning`;
  if (config.world) {
    n.safeSector = (n.phase + (n.attackCount || 0)) % 4;
    n.attackRadius += 15;
  }
  if (config.pattern === "quadrant") {
    n.safeSector = (n.attackCount || 0) % 4;
  }
  if (config.pattern === "restraint")
    n.safeLane = ((n.attackCount || 0) % 3) - 1;
  if (config.pattern === "projection")
    n.decoys = [
      { x: n.home.x - 80, y: n.home.y - 45 },
      { x: n.home.x + 85, y: n.home.y + 40 },
    ];
}

function hitTest(n, player, config) {
  if (
    n.safeSector != null &&
    ["anchors", "quadrant"].includes(config.pattern)
  ) {
    const angle =
      (Math.atan2(player.y - n.attackTarget.y, player.x - n.attackTarget.x) +
        TAU) %
      TAU;
    if (Math.floor(angle / (Math.PI / 2)) === n.safeSector) return false;
  }
  if (n.attackShape === "line") {
    const a = n.attackFrom,
      b = n.attackTarget,
      dx = b.x - a.x,
      dy = b.y - a.y,
      len = Math.hypot(dx, dy) || 1;
    const t = ((player.x - a.x) * dx + (player.y - a.y) * dy) / (len * len);
    return (
      t >= -0.1 &&
      t <= 1.15 &&
      Math.abs((player.x - a.x) * dy - (player.y - a.y) * dx) / len <
        config.radius
    );
  }
  if (n.attackShape === "cone") {
    const a = n.attackFrom,
      angle = Math.atan2(n.attackTarget.y - a.y, n.attackTarget.x - a.x),
      playerAngle = Math.atan2(player.y - a.y, player.x - a.x);
    const delta = Math.atan2(
      Math.sin(playerAngle - angle),
      Math.cos(playerAngle - angle),
    );
    return (
      distance(player, a) < config.radius + 45 && Math.abs(delta) < Math.PI / 3
    );
  }
  return distance(player, n.attackTarget) < n.attackRadius;
}

function resolveAttack(game, n, config, safe) {
  const p = game.player,
    hit = !safe && game.time >= (p.dodgeUntil || 0) && hitTest(n, p, config);
  let amount =
    n.damage *
    (config.multiplier || 1) *
    (n.potencyUntil > game.time ? n.potencyMultiplier || 1.15 : 1) *
    (n.weakenedUntil > game.time ? 1 - (n.weakenedAmount || 0.2) : 1);
  if (hit) {
    if (config.affliction)
      setStatus(game, "afflicted", 6.1, {
        damage: amount / 6,
        nextTick: game.time + 1,
        ticks: 6,
        source: n.name,
      });
    else {
      const before = p.health;
      game.damagePlayer?.(amount, n.name);
      const actual = Math.max(0, before - p.health);
      if (config.drain)
        n.health = Math.min(n.maxHealth, n.health + Math.floor(actual / 2));
    }
    if (config.status)
      setStatus(game, config.status, config.status === "root" ? 3 : 6);
    if (config.push) {
      const d = Math.max(1, distance(p, n));
      game.movePlayer?.(((p.x - n.x) / d) * 90, ((p.y - n.y) / d) * 90);
    }
    if (config.tether) n.tether = { until: game.time + 4, next: game.time + 1 };
  }
  if (config.behavior === "charger" || config.behavior === "ambusher") {
    const landing = {
      x: clamp(n.attackTarget.x, 40, (game.world.width || 2400) - 40),
      y: clamp(n.attackTarget.y, 40, (game.world.height || 1800) - 40),
    };
    if (!game.isPositionBlocked?.(landing.x, landing.y)) {
      n.x = landing.x;
      n.y = landing.y;
    }
  }
  if (config.retreat) {
    const d = Math.max(1, distance(n, p));
    n.x += ((n.x - p.x) / d) * 60;
    n.y += ((n.y - p.y) / d) * 60;
  }
  effect(
    game,
    n.attackTarget,
    "impact",
    n.realm === "hell" ? "#ed9879" : "#c8c6a2",
    n.attackRadius,
    0.5,
  );
  n.attackCount = (n.attackCount || 0) + 1;
  n.state = "recover";
  n.cooldown = config.recovery;
  n.activeTell = "Recovery window";
}

export function updateEncounter(game, n, dt) {
  if (!n.creatureId || n.kind !== "enemy") return false;
  const config = CONFIG[n.creatureId];
  if (!config) return false;
  if (n.dead) return true;
  n.cooldown = Math.max(0, (n.cooldown || 0) - dt);
  n.supportCooldown = Math.max(0, (n.supportCooldown || 0) - dt);
  n.specialCooldown = Math.max(0, (n.specialCooldown || 0) - dt);
  if (n.dot && game.time >= n.dot.next) {
    n.dot.next += 1;
    n.dot.ticks--;
    game.damageEnemy?.(n, n.dot.amount, "affliction");
    if (n.dot.ticks <= 0) n.dot = null;
    if (n.dead) return true;
  }
  if (n.tether) {
    if (distance(n, game.player) > 210 || n.tether.until <= game.time)
      n.tether = null;
    else if (game.time >= n.tether.next) {
      n.tether.next += 1;
      const before = game.player.health;
      game.damagePlayer?.(n.damage / 4, `${n.name} tether`);
      n.health = Math.min(
        n.maxHealth,
        n.health + (before - game.player.health) / 2,
      );
    }
  }
  if (
    (n.statusUntil || 0) > game.time &&
    HARD_CONTROL.has(n.status) &&
    !["silence", "root"].includes(n.status)
  ) {
    if (n.status === "feared") {
      const d = Math.max(1, distance(n, game.player));
      n.x += ((n.x - game.player.x) / d) * 45 * dt;
      n.y += ((n.y - game.player.y) / d) * 45 * dt;
    }
    return true;
  }
  const safe =
    game.isProtectedAt?.(game.player) ??
    distance(game.player, game.world.spawn) < 300;
  const d = distance(n, game.player),
    aggro = n.boss ? 330 : 245;
  const active =
    !safe && (d < aggro || n.state === "windup") && !game.player.veil;
  if (n.boss) {
    const nextPhase =
      n.health <= n.maxHealth / 3
        ? 3
        : n.health <= (n.maxHealth * 2) / 3
          ? 2
          : 1;
    if (nextPhase > (n.phase || 1)) {
      n.phase = nextPhase;
      n.state = "phase";
      n.phaseUntil = game.time + 2;
      n.activeTell = `Phase ${nextPhase} · transition warning`;
      n.cooldown = 2;
      effect(game, n, "ritual", "#e3c389", 110, 2);
    }
  }
  if (n.state === "phase") {
    if (game.time >= n.phaseUntil) n.state = "idle";
    return true;
  }
  if (n.state === "windup") {
    n.windup -= dt;
    if (n.windup <= 0) resolveAttack(game, n, config, safe);
    return true;
  }
  if (n.state === "recover") {
    if (n.cooldown <= 0) {
      n.state = "idle";
      n.activeTell = "";
    }
    return true;
  }
  if (!active) {
    n.state = "idle";
    n.activeTell = "";
    if (distance(n, n.home) > 6) {
      const r = distance(n, n.home);
      n.x += ((n.home.x - n.x) / r) * n.speed * 0.4 * dt;
      n.y += ((n.home.y - n.y) / r) * n.speed * 0.4 * dt;
    }
    return true;
  }
  if (
    config.support &&
    n.supportCooldown <= 0 &&
    !(n.silencedUntil > game.time)
  ) {
    support(game, n, config);
    n.supportCooldown = config.support === "repair" ? 12 : 10;
  }
  if (config.ward && n.specialCooldown <= 0 && !(n.silencedUntil > game.time)) {
    n.encounterBarrier = Math.max(
      n.encounterBarrier || 0,
      Math.floor(n.maxHealth * config.ward),
    );
    n.encounterBarrierUntil = game.time + 6;
    n.specialCooldown = 15;
    effect(game, n, "spell", "#d0d6b1", 48, 0.9);
  }
  if (config.teleport && n.specialCooldown <= 0 && d > 100) {
    const offset = (n.attackCount || 0) % 2 ? -80 : 80;
    n.x = n.home.x + offset;
    n.y = n.home.y + offset * 0.45;
    n.revealedUntil = game.time + 1;
    n.specialCooldown = config.teleport;
    effect(game, n, "spell", "#baa6d1", 38, 0.7);
  }
  if (config.adaptive && n.cooldown <= 0 && n.activeElement) {
    const tags = ["fire", "water", "earth", "air"];
    n.activeElement = tags[(n.attackCount || 0) % tags.length];
    n.resistantTag = n.activeElement;
    n.vulnerableTag = {
      fire: "water",
      water: "fire",
      earth: "air",
      air: "earth",
    }[n.activeElement];
  }
  n.state = "chase";
  if (d > config.range && !(n.status === "root" && n.statusUntil > game.time)) {
    const speed =
      n.speed * (n.status === "slow" && n.statusUntil > game.time ? 0.7 : 1);
    n.x += ((game.player.x - n.x) / d) * speed * dt;
    n.y += ((game.player.y - n.y) / d) * speed * dt;
  } else if (
    d <= config.range &&
    n.cooldown <= 0 &&
    !(n.revealedUntil > game.time)
  )
    startAttack(game, n, config);
  return true;
}

export function damageEncounter(game, n, amount, tag = "physical") {
  if (!n.creatureId || !CONFIG[n.creatureId]) return Math.max(0, amount);
  const config = CONFIG[n.creatureId];
  tag = String(tag).toLowerCase();
  const resist =
    (n.resistantTag === tag ? 0.2 : 0) +
    (config.adaptive && n.adaptiveTag === tag && n.adaptiveUntil > game.time
      ? 0.2
      : 0) -
    (n.vulnerableTag === tag ? 0.2 : 0);
  amount *= 1 - clamp(resist, -0.5, 0.5);
  if (config.adaptive && !["physical", "affliction"].includes(tag)) {
    n.adaptiveTag = tag;
    n.adaptiveUntil = game.time + 6;
  }
  if (n.encounterBarrierUntil > game.time && n.encounterBarrier > 0) {
    const absorbed = Math.min(n.encounterBarrier, amount);
    n.encounterBarrier -= absorbed;
    amount -= absorbed;
  }
  if (config.world) {
    const s = journal(game),
      active = s.solved[game.zone.id] ? 3 : s.sequence[game.zone.id] || 0;
    const floor =
      active === 0
        ? Math.ceil((n.maxHealth * 2) / 3)
        : active === 1
          ? Math.ceil(n.maxHealth / 3)
          : 0;
    if (n.health - amount < floor) {
      amount = Math.max(0, n.health - floor);
      if ((n.lockNoticeUntil || 0) < game.time) {
        notice(
          game,
          "info",
          "The world guardian’s next phase is held by the visible anchors. Align the next marked node.",
        );
        n.lockNoticeUntil = game.time + 5;
      }
    }
  }
  return Math.max(0, amount);
}

export function applyEncounterControl(game, n, type, duration) {
  if (!n?.creatureId) return false;
  if (n.dead) return true;
  if (n.boss && HARD_CONTROL.has(type)) {
    if (n.state === "phase") return true;
    n.staggerMarks =
      ((n.staggerUntil || 0) > game.time ? n.staggerMarks || 0 : 0) + 1;
    n.staggerUntil = game.time + 10;
    if (n.staggerMarks >= 3) {
      n.state = "recover";
      n.cooldown = 2;
      n.staggerMarks = 0;
      n.activeTell = "Staggered · recovery window";
      effect(game, n, "spell", "#edcf95", 45, 1);
    }
    return true;
  }
  n.controlProtection ||= {};
  if ((n.controlProtection[type] || 0) > game.time) return true;
  n.status = type;
  n.statusUntil = game.time + duration;
  if (HARD_CONTROL.has(type))
    n.controlProtection[type] = game.time + duration + 6;
  return true;
}

function companionEntityId(game) {
  return game.player.id
    ? `active-familiar:owner:${game.player.id}`
    : "active-familiar";
}

function removeCompanionEntity(game) {
  const id = companionEntityId(game);
  // Keep the array shared with the authoritative room and its other members.
  for (let i = game.entities.length - 1; i >= 0; i--)
    if (game.entities[i].id === id) game.entities.splice(i, 1);
}

function updateCompanion(game, dt) {
  const companion = game.player.companion;
  if (!companion) return;
  const profile =
    PROFILES[companion.creatureId] || PROFILES["celestial-familiars"];
  const id = companionEntityId(game);
  let n = game.entities.find((e) => e.id === id);
  if (!n) {
    n = {
      id,
      ownerId: game.player.id || null,
      ownerName: game.player.name || null,
      name: profile.name,
      kind: "npc",
      role: "companion",
      creatureId: profile.id,
      sprite: CONFIG[profile.id].sprite,
      x: game.player.x - 35,
      y: game.player.y + 20,
      health: profile.hp,
      maxHealth: profile.hp,
      description:
        "Your bonded familiar. One support action every ten seconds.",
      protected: true,
    };
    game.entities.push(n);
  }
  const target = { x: game.player.x - 35, y: game.player.y + 20 },
    d = distance(n, target);
  if (d > 180) {
    n.x = target.x;
    n.y = target.y;
  } else if (d > 5) {
    const travel = Math.min(d, 160 * dt);
    n.x += ((target.x - n.x) / d) * travel;
    n.y += ((target.y - n.y) / d) * travel;
  }
  if (game.inCombat?.() && (companion.nextSupport || 0) <= game.time) {
    if (companion.mode === "barrier") game.grantBarrier?.(10, 6);
    else game.heal?.(game.player, 10);
    companion.nextSupport = game.time + 10;
    effect(game, game.player, "heal", "#bfdda7", 35, 0.6);
  }
}

export function updateRegionalEncounters(game, dt) {
  for (const s of game.player.statuses.filter((s) => s.type === "afflicted"))
    if (
      (s.nextTick || 0) <= game.time &&
      (s.ticks ?? 6) > 0 &&
      s.until > game.time
    ) {
      s.nextTick += 1;
      s.ticks = (s.ticks ?? 6) - 1;
      game.damagePlayer?.(s.damage || 0, s.source || "Affliction", {
        ongoing: true,
      });
    }
  updateCompanion(game, dt);
  const state = journal(game);
  for (const n of game.entities)
    if (
      n.creatureId &&
      distance(n, game.player) < 250 &&
      !state.discovered.includes(n.creatureId)
    )
      state.discovered.push(n.creatureId);
}

export function installEncounterMethods(GameEngine) {
  Object.assign(GameEngine.prototype, {
    inspectCreature(id = this.targetId) {
      const n = this.entities.find((e) => e.id === id),
        p = PROFILES[n?.creatureId];
      if (!p) return null;
      const interaction = creatureInteraction(this, n);
      return {
        ...p,
        entityId: n.id,
        role: n.role,
        kind: n.kind,
        health: n.health,
        maxHealth: n.maxHealth,
        dead: !!n.dead,
        spritePath:
          n.spritePath || assetUrl(`/assets/creature-${p.id}-sheet.png`),
        behavior: CONFIG[p.id].behavior,
        currentTell: n.activeTell || "Idle",
        phase: n.phase || 1,
        barrier:
          n.encounterBarrierUntil > this.time ? n.encounterBarrier || 0 : 0,
        discovered: journal(this).discovered.includes(p.id),
        offer: n.offer || null,
        assisted: interaction.assisted,
        canBond: !!n.canBond,
        companion: interaction.companion,
        interaction,
        ownerId: n.ownerId || null,
        ownerName: n.ownerName || null,
      };
    },
    assistCreature(id = this.targetId) {
      const n = this.entities.find(
        (e) => e.id === id && e.role === "encounter-contact",
      );
      if (!n) {
        notice(
          this,
          "info",
          "Choose a neutral creature with a posted material request.",
        );
        return false;
      }
      const interaction = creatureInteraction(this, n);
      if (!interaction.canOffer) {
        notice(this, "info", interaction.reason + " No materials were spent.");
        return false;
      }
      // Validate the whole request before changing any inventory slot. Shared
      // rooms still settle against this character's receipt and inventory only.
      const state = journal(this),
        key = offeringKey(this, n);
      for (const requirement of interaction.requirements)
        this.player.inventory[requirement.item] -= requirement.quantity;
      state.assisted[key] = true;
      n.assisted = true;
      this.progress?.("encounter-assist", 1);
      notice(
        this,
        "success",
        `${n.name}: offering received.${n.canBond ? " Your familiar bond is now available." : ""}`,
      );
      this.save?.(false);
      this.publish?.();
      return true;
    },
    bondCompanion(id = this.targetId) {
      if (this.inCombat?.()) {
        notice(this, "info", "Familiar bonds are selected outside conflict.");
        return false;
      }
      const n = this.entities.find((e) => e.id === id && e.canBond);
      if (!n || !creatureInteraction(this, n).canBond) {
        notice(
          this,
          "info",
          "First complete this familiar’s finite bond task, then meet it outside conflict.",
        );
        return false;
      }
      this.player.companion = {
        creatureId: n.creatureId,
        name: n.name,
        mode: this.player.companion?.mode || "heal",
        nextSupport: this.time + 10,
      };
      removeCompanionEntity(this);
      updateCompanion(this, 0);
      notice(
        this,
        "success",
        `${n.name} bonded. One active familiar supports you every ten seconds.`,
      );
      this.save?.(false);
      this.publish?.();
      return true;
    },
    setCompanionSupport(mode) {
      if (
        !this.player.companion ||
        !["heal", "barrier"].includes(mode) ||
        this.inCombat?.()
      ) {
        notice(
          this,
          "info",
          "Choose one familiar support action outside conflict: heal or barrier.",
        );
        return false;
      }
      this.player.companion.mode = mode;
      this.save?.(false);
      this.publish?.();
      return true;
    },
    dismissCompanion() {
      this.player.companion = null;
      removeCompanionEntity(this);
      this.save?.(false);
      this.publish?.();
      return true;
    },
  });
}

export { PROFILES as ENCOUNTER_PROFILES };
