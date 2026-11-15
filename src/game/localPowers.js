import { BRANCHES, ENHANCEMENTS } from "../data/manual.js";

const clamp = (n, a = 0, b = 100) => Math.max(a, Math.min(b, n));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const hostile = (n) => n?.kind === "enemy" && !n.dead && !n.protected;
const ally = (n) =>
  n &&
  !n.dead &&
  (["npc", "ally", "companion"].includes(n.kind) || n.id === "player");
const ids = (n) => n?.id || "player";
const negative = new Set([
  "slow",
  "root",
  "stun",
  "silence",
  "fear",
  "feared",
  "afflicted",
  "weakened",
  "exposed",
  "healingReduction",
  "injury",
  "panic",
  "discord",
  "hostility",
]);
const safeCopy = (v) => structuredClone(v);
export function initLocalPowers(game, saved) {
  game.localMagic = {
    serial: 0,
    fields: [],
    objects: [],
    dots: [],
    captures: [],
    safeguardUsed: {},
    ...(saved || {}),
  };
  game.localMagic.fields ||= [];
  game.localMagic.objects ||= [];
  game.localMagic.dots ||= [];
}
function state(g) {
  if (!g.localMagic) initLocalPowers(g);
  return g.localMagic;
}
function eligiblePatches(g, at, radius, cap = 99) {
  return g.entities
    .filter(
      (n) =>
        n.kind === "patch" &&
        !n.protected &&
        distance(n, at) <= radius &&
        g.hasLineOfEffect(g.player, n),
    )
    .slice(0, cap);
}
function magnitude(g, p) {
  return Math.floor(
    (p.baseMagnitude ?? p.magnitude) *
      (p.potencyMultiplier || 1) *
      Math.max(
        p.outgoingModifier || 1,
        g.gearActive?.("focus") ? 1.1 : 1,
        ...g.player.statuses
          .filter((s) => s.type === "potency" && s.until > g.time)
          .map((s) => s.multiplier || 1.1),
      ),
  );
}
function statuses(n) {
  return n.statuses || (n.statuses = []);
}
function clean(g, n, count = 1, allowed = negative) {
  const list = statuses(n),
    removed = [];
  n.statuses = list.filter((s) => {
    if (removed.length < count && allowed.has(s.type)) {
      removed.push(s.type);
      return false;
    }
    return true;
  });
  if (removed.length < count && n.status && allowed.has(n.status)) {
    n.status = null;
    n.statusUntil = 0;
    removed.push("control");
  }
  if (removed.length < count && n.dot) {
    n.dot = null;
    removed.push("afflicted");
  }
  if (removed.length < count && n.healReductionUntil > g.time) {
    n.healReductionUntil = 0;
    removed.push("healingReduction");
  }
  return removed.length;
}
function barrier(g, n, amount, duration = 6) {
  if (n === g.player) {
    g.grantBarrier(amount, duration);
    return;
  }
  const current = statuses(n).find(
    (s) => s.type === "ward" && s.until > g.time,
  );
  if (current) {
    current.barrier = Math.max(current.barrier || 0, amount);
    current.until = g.time + duration;
  } else
    n.statuses.push({
      type: "ward",
      barrier: amount,
      until: g.time + duration,
    });
  n.encounterBarrier = Math.max(n.encounterBarrier || 0, amount);
  n.encounterBarrierUntil = g.time + duration;
}
function weaken(g, n, amount, duration) {
  if (n.weakenedUntil <= g.time || !n.weakenedUntil) n.weakenedAmount = amount;
  else n.weakenedAmount = Math.max(n.weakenedAmount || 0, amount);
  n.weakenedUntil = g.time + duration;
}
function field(g, kind, at, p, options = {}) {
  const s = state(g),
    f = {
      id: `local-field-${++s.serial}`,
      kind,
      x: at.x,
      y: at.y,
      radius: p.radius * 30,
      powerId: p.id,
      branchId: p.branchId,
      zoneId: g.zone.id,
      until: g.time + (options.duration || 6),
      amount: options.amount || 0,
      targetCap: p.targetCap,
      seen: [],
      ...options,
    };
  s.fields.push(f);
  return f;
}
function targetList(g, p, t, predicate) {
  const at = t || g.player,
    all = g.entities.filter(
      (n) =>
        predicate(n) &&
        distance(n, at) <= p.radius * 30 &&
        distance(n, g.player) <= p.range * 30 &&
        g.hasLineOfEffect(g.player, n),
    );
  return p.area ? all.slice(0, p.targetCap) : t && predicate(t) ? [t] : [];
}
function allies(g, p, t) {
  if (!p.area) return [t && ally(t) ? t : g.player];
  return [
    ...(distance(g.player, t || g.player) <= p.radius * 30 ? [g.player] : []),
    ...g.entities.filter(
      (n) =>
        ally(n) &&
        distance(n, t || g.player) < p.radius * 30 &&
        g.hasLineOfEffect(g.player, n),
    ),
  ].slice(0, p.targetCap);
}
function validObject(n) {
  return (
    n &&
    !n.protected &&
    [
      "patch",
      "build",
      "chest",
      "resource",
      "object",
      "barrier",
      "landmark",
      "destructible",
    ].includes(n.kind) &&
    !n.collected &&
    n.indestructible !== true
  );
}
function objectResistance(n, tag, ignore = 0) {
  return clamp(
    (n.resistances?.[tag] || n.resistance?.[tag] || 0) - ignore,
    -0.5,
    0.5,
  );
}
function damageObject(g, n, amount, p) {
  amount = Math.max(
    0,
    Math.floor(
      amount *
        (1 -
          objectResistance(
            n,
            p.branchId === "fire-destroy" ? "fire" : "water",
            p.enhancementRank === 5 && p.branchId === "fire-destroy" ? 0.1 : 0,
          )),
    ),
  );
  if (n.kind === "patch") {
    g.erodePatch(n, amount);
    return amount;
  }
  if (n.temporaryDurability?.until > g.time) {
    const absorbed = Math.min(amount, n.temporaryDurability.amount);
    n.temporaryDurability.amount -= absorbed;
    amount -= absorbed;
  }
  const before = n.durability ?? n.maxDurability ?? 100;
  n.durability = Math.max(0, before - amount);
  if (n.durability === 0) n.destroyed = true;
  g.effect(n, "damage", "#e1a28c", 30, 0.6, {
    powerId: p.id,
    branchId: p.branchId,
    level: p.level,
  });
  return before - n.durability;
}
function dividedTicks(total, weights = [1, 1, 1, 1, 1, 1]) {
  const sum = weights.reduce((a, b) => a + b, 0),
    ticks = weights.map((w) => Math.floor((total * w) / sum));
  ticks[ticks.length - 1] += total - ticks.reduce((a, b) => a + b, 0);
  return ticks;
}
function dot(g, n, total, p, kind = "damage", weights) {
  const s = state(g);
  s.dots = s.dots.filter((d) => !(d.entityId === n.id && d.powerId === p.id));
  s.dots.push({
    entityId: n.id,
    zoneId: g.zone.id,
    powerId: p.id,
    branchId: p.branchId,
    tag:
      kind === "durability"
        ? "water"
        : p.branchId?.startsWith("light-")
          ? "light"
          : "dark",
    kind,
    ticks: dividedTicks(total, weights),
    next: g.time + 1,
    index: 0,
  });
}
function push(g, n, amount = 90) {
  if (n.boss || n.protected) return 0;
  const d = Math.max(1, distance(n, g.player)),
    dx = (n.x - g.player.x) / d,
    dy = (n.y - g.player.y) / d;
  let moved = 0;
  for (let i = 0; i < amount; i += 6) {
    const x = n.x + dx * 6,
      y = n.y + dy * 6;
    if (g.isPositionBlocked?.(x, y, { radius: 12 })) break;
    n.x = x;
    n.y = y;
    moved += 6;
  }
  return moved;
}
function ownPlot(g, point) {
  const p = g.sanctuary?.plot;
  return (
    !!p &&
    g.zone.id === p.zoneId &&
    point.x >= p.x &&
    point.y >= p.y &&
    point.x <= p.x + p.width &&
    point.y <= p.y + p.height
  );
}
function station(g) {
  return (
    g.entities.find(
      (n) => n.role === "merchant" && distance(n, g.player) <= 220,
    ) ||
    g.sanctuary?.components.find(
      (n) =>
        n.templateId === "forge" &&
        n.zoneId === g.zone.id &&
        distance(n, g.player) <= 220,
    )
  );
}
function castPoint(g, p, t) {
  if (t) return { x: t.x, y: t.y };
  const point = g.pendingPowerPoint || g.pointer;
  return point &&
    distance(point, g.player) <= p.range * 30 &&
    point.x > 20 &&
    point.y > 20
    ? { ...point }
    : { x: g.player.x, y: g.player.y - 55 };
}

export function computePowerProfile(game, b, original) {
  const p = { ...original },
    track = ENHANCEMENTS.find((e) => e.branchId === b.id),
    r = track ? game.player.enhancementSelection?.[track.id] || 0 : 0;
  p.enhancementRank = r;
  p.enhancementId = track?.id;
  if (p.routeTravel) {
    const weather = game.worldModel?.weather || {};
    const ordinarySlowdown = Math.max(
      0,
      Number(
        weather.routeSlowdown ??
          weather.slowdown ??
          (weather.id === "rain" ? 0.1 : weather.id === "mist" ? 0.05 : 0),
      ) || 0,
    );
    p.ignoredWeatherSlowdown = r === 5 && ordinarySlowdown > 0;
    p.castTime = 3 * (r === 5 ? 1 : 1 + ordinarySlowdown);
  }
  if (p.kind !== "local" || !r) return p;
  if (
    r === 1 &&
    [
      "love-laugh",
      "water-grow",
      "hate-cry",
      "fire-destroy",
      "earth-take",
    ].includes(b.id)
  )
    p.magnitude += 5;
  if (r === 1 && b.id === "light-pleasure" && [1, 4].includes(p.level))
    p.magnitude += 5;
  if (
    r === 2 &&
    ["love-laugh", "hate-cry", "fire-destroy", "earth-take"].includes(b.id)
  ) {
    p.baseMagnitude = p.magnitude;
    p.outgoingModifier = 1.15;
    p.magnitude = Math.floor(p.magnitude * 1.15);
  }
  if (r === 2 && b.id === "light-pleasure") p.recoveryMultiplier = 1.15;
  if (
    r === 3 &&
    ["love-laugh", "light-pleasure", "fire-destroy"].includes(b.id)
  )
    p.radius += 2;
  if (r === 1 && b.id === "air-move") p.moveSpeed = (p.moveSpeed || 6) * 1.1;
  if (r === 2 && b.id === "air-move")
    p.castTime = Math.max(0.5, p.castTime * 0.8);
  if (r === 3 && b.id === "air-move") p.duration = (p.duration || 20) + 10;
  if (b.id === "air-move" && p.routeTravel && r === 2)
    p.castTime = Math.max(0.5, p.castTime * 0.8);
  return p;
}

export function validateLocalAction(g, b, p, t) {
  const fail = (reason) => ({ valid: false, reason });
  if (p.kind !== "local")
    return fail("This named power requires the world-project preview.");
  const deadPower =
    (b.id === "dark-heal" && p.level === 7) ||
    (b.id === "earth-take" && p.level === 5);
  if (t?.dead && !deadPower)
    return fail(
      "A fallen identity requires an eligible resurrection or capture action.",
    );
  if (t?.collected || t?.destroyed)
    return fail("This target is no longer available.");
  if (t && distance(g.player, t) > p.range * 30)
    return fail("Target is out of range.");
  if (t && !g.hasLineOfEffect(g.player, t))
    return fail("A solid wall or closed gate blocks line of effect.");
  if (t?.adventureActor && t.kind === "world-activity")
    return g.previewAdventurePower(b, p, t);
  if (t?.kind === "dummy") return { valid: true, practice: true };
  if (b.id === "dark-heal" && p.level === 7)
    return (
      g.canResurrect?.(t?.id, { ignoreResources: true }) ||
      fail("No recoverable fallen identity is selected.")
    );
  if (b.id === "earth-take" && p.level === 5) {
    const corpse = t?.dead && t.resolved === "defeated";
    return corpse &&
      t.recoverable !== false &&
      !t.permanentlyClosed &&
      !t.capturedUntil
      ? { valid: true }
      : fail(
          "Soul Devour requires one defeated, recoverable identity that is not already captured.",
        );
  }
  const positive = [
    "love-laugh",
    "light-pleasure",
    "water-grow",
    "hate-clean",
    "dark-heal",
    "earth-give",
  ].includes(b.id);
  if (t?.protected && !positive) return fail("This target is protected.");
  if (
    t?.kind === "npc" &&
    !positive &&
    !(b.id === "air-move" && t.consent === true)
  )
    return fail("This NPC is protected from hostile or unconsented actions.");
  if (b.id === "water-grow") {
    if (t?.kind === "enemy")
      return g.entities.filter((n) => n.kind === "patch" && n.restored)
        .length === 3
        ? { valid: true }
        : fail(
            "Restore the authored habitat first to open this creature’s peaceful route.",
          );
    if (t?.kind !== "patch")
      return fail("Select an eligible plant or habitat patch.");
    if (t.barren && !(p.enhancementRank === 5 && t.recoveryUnlocked))
      return fail(
        "This barren patch needs its authored recovery project before growth.",
      );
    if (p.level === 1 && t.health >= t.maxHealth)
      return fail("This plant patch is already healthy.");
    if (
      [2, 4].includes(p.level) &&
      (t.growthStage || 0) >= 3 &&
      t.health >= t.maxHealth &&
      !t.drought
    )
      return fail(
        "This bed is mature and healthy; no new harvest lot can be created.",
      );
  } else if (b.id === "dark-heal") {
    if (p.level === 4) {
      if (t?.kind !== "patch")
        return fail("Night’s Rejuvenation targets ecological soil.");
      if (t.health >= t.maxHealth && !t.damagedSoil)
        return fail("The soil is already restored.");
    } else {
      if (t && !ally(t))
        return fail(
          "Select an eligible injured ally or clear the target to heal yourself.",
        );
      const list = allies(g, p, t);
      if (
        !list.some(
          (n) => n.health < (n.maxHealth || 100) || (p.level === 5 && n.injury),
        )
      )
        return fail(
          "No eligible recipient has missing vitality or an authored injury.",
        );
    }
  } else if (
    b.id === "love-laugh" ||
    (b.id === "light-pleasure" && [1, 4].includes(p.level))
  ) {
    if (!t || !["npc", "enemy"].includes(t.kind))
      return fail("Select an eligible NPC with a morale need.");
    if ((t.morale ?? 50) >= 100 && !(p.level === 3 && t.status === "feared"))
      return fail("This NPC’s morale is already full.");
  } else if (b.id === "light-pleasure" && [2, 3].includes(p.level)) {
    if (!allies(g, p, t).some((n) => n.health < (n.maxHealth || 100)))
      return fail("No eligible respite recipient is injured.");
  } else if (b.id === "hate-clean") {
    if (p.level === 4 && t?.kind !== "enemy")
      return fail("Exorcise Malevolence requires an attached hostile spirit.");
    if (
      p.level === 4 &&
      !/spirit|wraith|shade|shadow/i.test(
        t.name + " " + t.sprite + " " + t.creatureId,
      ) &&
      !t.attachedSpirit
    )
      return fail("The selected creature has no eligible spirit attachment.");
  } else if (b.id === "air-move") {
    if (p.routeTravel) {
      if (
        !g.selectedTravelRoute ||
        !g.discoveredZones.includes(g.selectedTravelRoute)
      )
        return fail(
          "Choose a discovered safe route before starting this travel power.",
        );
      const destination = g.zoneCatalog?.find?.(
        (z) => z.id === g.selectedTravelRoute,
      );
      if (destination && destination.realm !== g.zone.realm)
        return fail("Tempest Rider cannot cross realms.");
    }
    if (
      [2, 3].includes(p.level) &&
      g.worldModel?.weather?.id === "storm" &&
      !g.worldState?.swiftTravel
    )
      return fail("This weather front closes ordinary flight lanes.");
    if (p.level === 1 && (!t || t.boss || t.protected || t.mass > 20))
      return fail(
        "Gentle Gust needs an eligible light object or nonboss creature.",
      );
  } else if (b.id === "fire-create") {
    if ([3, 4].includes(p.level) && !station(g))
      return fail("Approach a valid forge or the public artisan’s station.");
    if ([5, 7].includes(p.level) && !ownPlot(g, castPoint(g, p, t)))
      return fail("Place this fire form on your owned sanctuary plot.");
    if (p.level === 5) {
      const q = castPoint(g, p, t),
        plot = g.sanctuary.plot;
      if (
        plot.protectedExits.some(
          (r) =>
            q.x + 40 > r.x &&
            q.x - 40 < r.x + r.width &&
            q.y + 8 > r.y &&
            q.y - 8 < r.y + r.height,
        )
      )
        return fail(
          "The fire barrier would block a protected arrival or exit lane.",
        );
    }
    if (p.level === 5 && (g.player.inventory.wood || 0) < 2)
      return fail("The recipe-backed fire barrier requires two timber.");
    if (p.level === 1 && !t)
      return fail("Select an eligible torch, brazier, or campfire.");
    if (
      p.level === 1 &&
      t &&
      !["lantern", "torch", "campfire", "brazier", "object"].includes(t.kind) &&
      !t.canIgnite
    )
      return fail(
        "Ember Spark only lights an eligible controlled fire source.",
      );
  } else if (b.id === "earth-give" && p.level === 4) {
    if (t?.kind !== "patch" || (t.growthStage || 0) < 3)
      return fail("Bountiful Harvest requires a mature crop bed.");
    if (t.harvestConsumed)
      return fail("This bed’s finite harvest lot has already been taken.");
  } else if (b.id === "water-decay") {
    if (!validObject(t))
      return fail(
        "Water–Decay affects permitted object durability or terrain, never creature vitality.",
      );
  } else if (
    [
      "hate-cry",
      "dark-pain",
      "fire-destroy",
      "earth-take",
      "love-dirty",
      "light-harm",
      "air-stop",
    ].includes(b.id)
  ) {
    if (!hostile(t) && !(b.id === "fire-destroy" && validObject(t)))
      return fail(
        "Select an eligible hostile or permitted destructible target.",
      );
  }
  const secondary = g.entities.find(
    (n) => n.id === g.secondaryTargetId && !n.dead,
  );
  if (
    b.id === "love-dirty" &&
    [2, 5].includes(p.level) &&
    (!hostile(secondary) ||
      secondary.id === t?.id ||
      distance(secondary, g.player) > p.range * 30 ||
      !g.hasLineOfEffect(g.player, secondary))
  )
    return fail(
      "Select a distinct susceptible hostile in the secondary-target preview.",
    );

  if (
    p.enhancementId === "dark-empowerment" &&
    p.enhancementRank === 4 &&
    (!hostile(secondary) ||
      distance(secondary, g.player) > p.range * 30 ||
      !g.hasLineOfEffect(g.player, secondary))
  )
    return fail(
      "Select an eligible hostile donor in the secondary-target preview.",
    );
  if (
    p.enhancementId === "water-reinforcement" &&
    p.enhancementRank === 2 &&
    secondary &&
    !ally(secondary)
  )
    return fail("The enhancement preview requires a nonhostile creature.");
  return {
    valid: true,
    point: castPoint(g, p, t),
    secondaryTargetId: secondary?.id,
  };
}

function enrich(g, b, p, t, context) {
  const r = p.enhancementRank;
  if (!r) return;
  const targets = context.targets || [],
    at = t || g.player;
  if (b.id === "love-laugh") {
    if (r === 4 && targets.length) {
      barrier(g, g.player, 15, 6);
      for (const n of g.entities
        .filter(
          (n) =>
            ally(n) &&
            n.consent === true &&
            distance(n, g.player) <= p.radius * 30 &&
            g.hasLineOfEffect(g.player, n),
        )
        .slice(0, 3))
        barrier(g, n, 15, 6);
    }
    if (r === 5) {
      const foe = targets.find(hostile);
      if (foe) g.applyControl(foe, "calmed", 3);
    }
  }
  if (b.id === "light-pleasure") {
    if (r === 4)
      for (const n of context.recipients || allies(g, p, t))
        barrier(g, n, 15, 6);
    if (r === 5) field(g, "hostileWeaken", at, p, { amount: 0.1, duration: 6 });
  }
  if (b.id === "water-grow") {
    if (r === 2) {
      const n = g.entities.find((n) => n.id === g.secondaryTargetId && ally(n));
      if (n && distance(n, at) <= p.radius * 30) g.heal(n, 15);
    }
    if (r === 3) field(g, "restore", at, p, { amount: 5, duration: 10 });
    if (r === 4) for (const n of context.targets || []) n.polluted = false;
    if (r === 5 && t?.barren && t.recoveryUnlocked) t.barren = false;
  }
  if (b.id === "air-move" && r === 4 && p.level === 4)
    for (const n of context.targets || [])
      if (hostile(n)) g.applyControl(n, "slow", 3);
  if (b.id === "hate-cry") {
    if (r === 3) for (const n of targets) weaken(g, n, 0.1, 6);
    if (r === 4 && context.moraleReduced) g.heal(g.player, 10);
    if (r === 5)
      for (const n of targets)
        if (!n.boss && n.morale <= 0) g.applyControl(n, "feared", 2);
  }
  if (b.id === "dark-heal") {
    const recipients = context.recipients || [];
    if (r === 1) for (const n of recipients) barrier(g, n, 10, 6);
    if (r === 2) {
      const donor = g.entities.find(
        (n) => n.id === g.secondaryTargetId && hostile(n),
      );
      if (donor && distance(donor, at) <= p.radius * 30)
        g.damageEnemy(donor, 10, "dark");
    }
    if (r === 3 && p.level === 7 && t) barrier(g, t, 20, 10);
    if (r === 5) {
      const encounter =
        g.currentEncounterKey?.() ||
        g.zone.id + ":" + g.rewardedEncounters.length;
      for (const n of recipients) {
        const key = encounter + ":" + ids(n);
        if (
          !state(g).safeguardUsed[key] &&
          !statuses(n).some(
            (s) => s.type === "safeguard" && s.encounterKey === key,
          )
        )
          statuses(n).push({
            type: "safeguard",
            until: g.time + 10,
            encounterKey: key,
          });
      }
    }
  }
  if (b.id === "fire-destroy" && r === 4 && context.damageDealt)
    field(g, "slow", at, p, { amount: 0.1, duration: 6 });
  if (b.id === "earth-take") {
    if (r === 3 && context.actualDrain > 0) {
      const patch = eligiblePatches(g, at, p.radius * 30, 1)[0];
      if (patch) patch.health = Math.max(0, patch.health - 5);
    }
    if (r === 4 && context.actualDrain > 0) {
      const movable = g.entities.find(
        (n) =>
          n.id === g.secondaryTargetId &&
          !n.protected &&
          (n.movable || n.kind === "resource"),
      );
      if (movable) push(g, movable, 60);
    }
    if (r === 5) barrier(g, g.player, 15, 6);
  }
}

export function resolveLocalPower(g, b, p, t) {
  const s = state(g),
    mag = magnitude(g, p),
    at = t || g.player,
    context = {
      targets: [],
      recipients: [],
      damageDealt: 0,
      actualDrain: 0,
      moraleReduced: 0,
    };
  const meta = {
    powerId: p.id,
    branchId: b.id,
    level: p.level,
    family: b.domain.toLowerCase(),
  };
  g.effect(at, "spell", b.color, 40 + p.level * 9, 1.1, meta);
  g.effect(g.player, "cast", b.color, 28, 0.65, meta);
  if (t?.adventureActor && t.kind === "world-activity")
    return g.resolveAdventurePower(b, p, t);
  if (t?.kind === "dummy") {
    t.health = Math.max(1, t.health - mag);
    t.resetAt = g.time + 2;
    g.recordPowerPractice?.(b.id);
    g.progress("practice");
    g.event("success", `${p.name} practiced. ${p.essenceCost} Essence spent.`);
    return { practice: true };
  }
  if (b.id === "love-laugh") {
    const list = targetList(
      g,
      p,
      t,
      (n) => ["npc", "enemy"].includes(n.kind) && !n.dead,
    );
    for (const n of list) {
      const before = n.morale ?? 50;
      n.morale = clamp(before + mag);
      if (p.level >= 3 && ["panic", "feared"].includes(n.status)) {
        n.status = null;
        n.statusUntil = 0;
      }
      context.targets.push(n);
    }
    if (p.level === 4)
      field(g, "morale", at, p, {
        amount: mag,
        duration: 6,
        seen: list.map(ids),
      });
    g.event("success", `${p.name}: eligible morale increased by ${mag}.`);
  } else if (b.id === "light-pleasure") {
    if ([1, 4].includes(p.level)) {
      for (const n of targetList(
        g,
        p,
        t,
        (n) => ["npc", "enemy"].includes(n.kind) && !n.dead,
      )) {
        n.morale = clamp((n.morale ?? 50) + mag);
        if (p.level === 4) clean(g, n, 1, new Set(["fear", "feared"]));
        context.targets.push(n);
      }
    } else {
      const recipients = allies(g, p, t);
      context.recipients = recipients;
      if (p.level === 5) {
        for (const n of recipients) barrier(g, n, mag, 6);
        field(g, "barrier", at, p, {
          amount: mag,
          duration: 6,
          seen: recipients.map(ids),
        });
      } else {
        const heal = Math.floor(
          (p.level === 2 ? 10 : mag) * (p.recoveryMultiplier || 1),
        );
        for (const n of recipients) g.heal(n, heal);
        field(g, "heal", at, p, {
          amount: heal,
          duration: 6,
          seen: recipients.map(ids),
        });
      }
    }
  } else if (b.id === "water-grow") {
    if (hostile(t)) {
      g.resolveEnemy(t, true);
    } else {
      const list = p.area
        ? eligiblePatches(g, at, p.radius * 30, p.targetCap)
        : [t];
      for (const n of list) {
        if (p.enhancementRank === 4) n.polluted = false;
        if (n.barren && p.enhancementRank === 5 && n.recoveryUnlocked)
          n.barren = false;
        g.restorePatch(n, mag);
        if ([2, 4].includes(p.level))
          n.growthStage = Math.min(3, (n.growthStage || 0) + 1);
        if (p.level === 4) n.drought = false;
        context.targets.push(n);
      }
    }
  } else if (b.id === "hate-clean") {
    const limit = p.level <= 2 ? 1 : p.level <= 4 ? 2 : 3;
    if (p.level === 4) {
      t.x = t.home.x;
      t.y = t.home.y;
      t.state = "idle";
      t.attachedSpirit = false;
      clean(g, t, limit);
    } else {
      const list = p.area
        ? allies(g, p, t)
        : [t?.kind === "npc" ? t : g.player];
      for (const n of list)
        clean(
          g,
          n,
          limit,
          p.level === 2 ? new Set(["fear", "feared", "hostility"]) : negative,
        );
      if (t?.kind === "patch") {
        t.corrupted = false;
        t.polluted = false;
        g.restorePatch(t, mag);
      }
      if (p.level === 3) {
        for (const f of s.fields.filter(
          (f) => f.kind === "hatred" && distance(f, at) < p.radius * 30,
        ))
          f.until = g.time;
      }
      if (p.level === 5) {
        for (const n of g.entities
          .filter(
            (n) =>
              ["npc", "enemy"].includes(n.kind) &&
              distance(n, at) < p.radius * 30,
          )
          .slice(0, p.targetCap)) {
          n.discord = false;
          clean(g, n, 1, new Set(["discord"]));
        }
      }
    }
  } else if (b.id === "dark-heal") {
    if (p.level === 7) {
      if (!g.resurrectNPC(t.id, { settled: true })) return { failed: true };
      context.recipients = [t];
    } else if (p.level === 4) {
      t.damagedSoil = false;
      g.restorePatch(t, mag);
      context.targets = [t];
    } else {
      const list = allies(g, p, t);
      let donation = 0;
      if (p.enhancementRank === 4) {
        const donor = g.entities.find(
          (n) => n.id === g.secondaryTargetId && hostile(n),
        );
        if (donor) {
          const before = donor.health;
          g.damageEnemy(donor, 10, "dark");
          donation = Math.floor((before - donor.health) / 2);
        }
      }
      for (const n of list) {
        g.heal(n, mag + donation);
        if (p.level === 5) {
          n.injury = null;
          clean(g, n, 1, new Set(["injury"]));
        }
        context.recipients.push(n);
      }
    }
  } else if (b.id === "air-move") {
    if (p.routeTravel) {
      const id = g.selectedTravelRoute;
      g.setZone(id);
      g.selectedTravelRoute = null;
      g.event(
        "travel",
        `${p.name}: arrived at the reserved discovered anchor.`,
      );
    } else if ([2, 3].includes(p.level)) {
      g.player.statuses.push({
        type: "flight",
        until: g.time + (p.duration || 20),
        speed: (p.moveSpeed || 6) * 30,
      });
      if (p.level === 3)
        for (const n of g.entities
          .filter(
            (n) =>
              n.consent && ally(n) && distance(n, g.player) < p.radius * 30,
          )
          .slice(0, 5))
          n.flightUntil = g.time + (p.duration || 20);
    } else {
      const list =
        p.level === 4
          ? g.entities
              .filter(
                (n) =>
                  !n.dead &&
                  distance(n, at) < p.radius * 30 &&
                  ((hostile(n) && !n.boss) || (ally(n) && n.consent)),
              )
              .slice(0, p.targetCap)
          : [t];
      for (const n of list) {
        if (hostile(n) || n.kind === "resource" || n.movable) push(g, n, 90);
        else n.flightUntil = g.time + 3;
        context.targets.push(n);
      }
      if (p.level === 4)
        g.player.statuses.push({ type: "lift", until: g.time + 3 });
    }
  } else if (b.id === "fire-create") {
    const point = castPoint(g, p, t),
      duration = [2, 6].includes(p.level) ? 60 : p.level === 7 ? null : 60;
    if (p.level === 1 && t) {
      t.lit = true;
      t.lightUntil = g.time + 60;
    } else if ([3, 4].includes(p.level)) {
      const forge = station(g);
      g.player.forgeControl = {
        level: p.level,
        until: g.time + 60,
        stationId: forge.id,
        zoneId: g.zone.id,
        uses: 1,
      };
      g.event(
        "craft",
        "Forge heat and shaping are ready for one recipe using its normal materials.",
      );
    } else {
      if (p.level === 5) g.player.inventory.wood -= 2;
      const count = p.level === 6 ? 8 : 1;
      for (let i = 0; i < count; i++) {
        const a = (i * Math.PI * 2) / count;
        const object = {
          id: `power-object-${++s.serial}`,
          powerId: p.id,
          branchId: b.id,
          kind: p.level === 5 ? "barrier" : "decoration",
          name: p.name,
          x: point.x + (count > 1 ? Math.cos(a) * 65 : 0),
          y: point.y + (count > 1 ? Math.sin(a) * 50 : 0),
          width: p.level === 5 ? 80 : 18,
          height: p.level === 5 ? 16 : 25,
          blocking: p.level === 5,
          durability: p.level === 5 ? mag : 1,
          owner: g.player.name,
          zoneId: g.zone.id,
          until: duration ? g.time + duration : null,
          persistent: p.level === 7,
          groupId: `fire-${g.time}`,
          noResale: true,
        };
        s.objects.push(object);
        g.effect(object, "spell", "#edb56c", 22, duration || 60, meta);
      }
    }
  } else if (b.id === "earth-give") {
    if (p.level === 1) {
      const gift = {
        id: `gift-${++s.serial}`,
        kind: "decoration",
        name: "Earthen Offering",
        x: at.x + 15,
        y: at.y + 10,
        width: 12,
        height: 12,
        owner: g.player.name,
        zoneId: g.zone.id,
        until: g.time + 60,
        noResale: true,
        message: String(g.offeringMessage || "").slice(0, 120),
      };
      s.objects.push(gift);
    } else if (p.level === 2) {
      for (const n of allies(g, p, t))
        statuses(n).push({
          type: "potency",
          multiplier: 1.1,
          until: g.time + 6,
        });
    } else if (p.level === 3) {
      for (const n of allies(g, p, t)) barrier(g, n, mag, 6);
    } else if (p.level === 4) {
      g.restorePatch(t, mag);
      t.harvestAuthorized = true;
      t.harvestRemaining = t.harvestRemaining ?? 3;
      t.harvestLotId = t.harvestLotId || `${g.zone.id}:${t.id}:original-lot`;
    }
  } else if (b.id === "water-decay") {
    const lineDistance = (n) => {
      const dx = at.x - g.player.x,
        dy = at.y - g.player.y,
        len2 = dx * dx + dy * dy;
      const u = len2
        ? Math.max(
            0,
            Math.min(
              1,
              ((n.x - g.player.x) * dx + (n.y - g.player.y) * dy) / len2,
            ),
          )
        : 0;
      return Math.hypot(
        n.x - (g.player.x + u * dx),
        n.y - (g.player.y + u * dy),
      );
    };
    const list =
      p.level === 4
        ? g.entities
            .filter(
              (n) =>
                validObject(n) &&
                distance(n, g.player) <= p.range * 30 &&
                lineDistance(n) <= 30 &&
                g.hasLineOfEffect(g.player, n),
            )
            .slice(0, p.targetCap)
        : p.area
          ? g.entities
              .filter(
                (n) =>
                  validObject(n) &&
                  distance(n, at) < p.radius * 30 &&
                  g.hasLineOfEffect(g.player, n),
              )
              .slice(0, p.targetCap)
          : [t];
    if (p.level === 3 || p.level === 6) {
      const region = g.worldSystems?.regions[g.zone.id];
      if (region)
        region.stability = clamp(region.stability - (p.level === 6 ? 25 : mag));
      t.weakRouteRevealed = true;
    }
    for (const n of list) {
      if (p.level === 2) dot(g, n, mag, p, "durability");
      else damageObject(g, n, mag, p);
      context.targets.push(n);
    }
  } else {
    let list = targetList(g, p, t, hostile);
    if (b.id === "earth-take" && [2, 3, 4, 6].includes(p.level))
      list = g.entities
        .filter(
          (n) =>
            hostile(n) &&
            distance(n, g.player) < (p.level === 2 ? 60 : p.range * 30) &&
            (!p.area || distance(n, at) < p.radius * 30) &&
            g.hasLineOfEffect(g.player, n),
        )
        .slice(0, p.targetCap);
    if (b.id === "fire-destroy" && p.level === 5) {
      const dx = at.x - g.player.x,
        dy = at.y - g.player.y,
        a = Math.atan2(dy, dx);
      list = g.entities
        .filter(
          (n) =>
            hostile(n) &&
            distance(n, g.player) < p.range * 30 &&
            Math.abs(
              Math.atan2(
                Math.sin(Math.atan2(n.y - g.player.y, n.x - g.player.x) - a),
                Math.cos(Math.atan2(n.y - g.player.y, n.x - g.player.x) - a),
              ),
            ) <=
              Math.PI / 6 &&
            g.hasLineOfEffect(g.player, n),
        )
        .slice(0, p.targetCap);
    }
    if (b.id === "fire-destroy" && validObject(t)) {
      damageObject(g, t, mag, p);
      list = [];
    }
    if (b.id === "earth-take" && p.level === 5) {
      t.capturedUntil = g.time + 10;
      s.captures.push({
        entityId: t.id,
        zoneId: g.zone.id,
        deathKey: t.deathKey,
        until: g.time + 10,
      });
      g.player.statuses.push({
        type: "potency",
        multiplier: 1.2,
        until: g.time + 10,
      });
      list = [];
    }
    for (let i = 0; i < list.length; i++) {
      const n = list[i];
      let amount = p.dividedMagnitude
        ? Math.floor(mag / list.length) +
          (i === list.length - 1 ? mag % list.length : 0)
        : mag;
      context.targets.push(n);
      if (b.id === "hate-cry") {
        if ([1, 2, 3, 6].includes(p.level)) {
          const before = n.morale ?? 50;
          n.morale = clamp(before - amount);
          context.moraleReduced += before - n.morale;
        }
        if (p.level === 3) weaken(g, n, 0.2, 6);
        if (p.level === 4) g.applyControl(n, "feared", 2);
        if (p.level === 5) {
          if (
            ["windup", "telegraph", "preparing"].includes(n.state) &&
            n.state !== "phase"
          ) {
            n.state = "recover";
            n.cooldown = 2;
          }
        }
        if (p.level === 6) g.applyControl(n, "stun", 2);
        if (n.morale <= 0) g.resolveEnemy(n, "coerced");
      } else if (b.id === "dark-pain") {
        if ([2, 3, 4, 6].includes(p.level)) {
          dot(
            g,
            n,
            amount,
            p,
            "damage",
            p.level === 4 ? [1, 1, 2, 2, 3, 3] : undefined,
          );
          if ([3, 6].includes(p.level)) weaken(g, n, 0.2, 6);
        } else {
          const before = n.health;
          g.damageEnemy(n, amount, "dark");
          context.damageDealt += before - n.health;
          if (p.level === 5) g.applyControl(n, "slow", 3);
        }
      } else if (b.id === "earth-take") {
        const before = n.health;
        g.damageEnemy(n, amount, "earth");
        const loss = Math.max(0, before - n.health);
        context.actualDrain += loss;
        if (p.level === 4) weaken(g, n, 0.2, 6);
      } else if (b.id === "love-dirty") {
        if (p.level <= 3) g.applyControl(n, "calmed", 6);
        if (p.level === 2) {
          const other = g.entities.find(
            (o) => o.id === g.secondaryTargetId && hostile(o),
          );
          if (other) {
            n.perceptionMismatch = other.id;
            other.perceptionMismatch = n.id;
            other.mismatchUntil = g.time + 6;
            g.applyControl(other, "calmed", 6);
          }
        }
        if (p.level === 4) {
          n.supportBlockedUntil = g.time + 6;
          n.discord = true;
          n.silencedUntil = g.time + 6;
        }
        if (p.level === 5) {
          n.priorityUntil = g.time + 6;
          n.priority = "redirect";
          n.redirectTargetId = g.secondaryTargetId;
          n.redirectUntil = g.time + 6;
          n.state = "idle";
          n.cooldown = 0;
        }
      } else if (b.id === "air-stop") {
        if (p.level === 5) g.applyControl(n, "root", 3);
        else g.applyControl(n, "slow", 6);
        if (p.level === 3) n.silencedUntil = g.time + 3;
        if (
          p.level === 6 &&
          ["windup", "telegraph", "preparing"].includes(n.state)
        ) {
          n.state = "recover";
          n.cooldown = 2;
        }
      } else if (b.id === "light-harm" && p.level === 4)
        g.applyControl(n, "stun", 2);
      else if (b.id === "light-harm" && p.level === 6) {
        dot(g, n, amount, { ...p, id: p.id + ":pulses" }, "damage", [1, 1, 1]);
      } else {
        const before = n.health;
        g.damageEnemy(n, amount, b.domain.toLowerCase());
        context.damageDealt += before - n.health;
        if (b.id === "light-harm" && p.level === 2)
          g.applyControl(n, "slow", 3);
      }
    }
    if (b.id === "earth-take" && p.level !== 5 && context.actualDrain > 0) {
      const recovered = g.heal(g.player, Math.floor(context.actualDrain / 2));
      if (p.level === 6) barrier(g, g.player, recovered, 6);
    }
    if (b.id === "fire-destroy" && p.level === 2)
      field(g, "burningMark", at, p, { duration: 6, amount: 0 });
    if (b.id === "fire-destroy" && p.level === 4)
      for (const n of g.entities.filter(
        (n) => validObject(n) && distance(n, at) < p.radius * 30,
      ))
        damageObject(g, n, mag, p);
    if (b.id === "air-stop" && p.level === 2)
      field(g, "slow", at, p, { amount: 0.3, duration: 6 });
    if (b.id === "air-stop" && p.level === 4)
      field(g, "projectileWard", at, p, {
        blocks: 4,
        duration: 3,
        amount: 0.3,
      });
  }
  enrich(g, b, p, t, context);
  return context;
}

export function updateLocalPowers(g, dt) {
  const s = state(g);
  for (const n of g.entities) {
    if (n.resetAt && g.time >= n.resetAt) {
      n.health = n.maxHealth;
      n.resetAt = null;
    }
    if (n.capturedUntil && g.time >= n.capturedUntil) n.capturedUntil = null;
  }
  for (const d of s.dots) {
    if (d.zoneId && d.zoneId !== g.zone.id) {
      while (d.index < d.ticks.length && g.time >= d.next) {
        d.index++;
        d.next += 1;
      }
      continue;
    }
    const n = g.entities.find((n) => n.id === d.entityId);
    if (!n || n.dead || n.destroyed) {
      d.index = d.ticks.length;
      continue;
    }
    while (d.index < d.ticks.length && g.time >= d.next) {
      const amount = d.ticks[d.index++];
      d.next += 1;
      if (d.kind === "durability") {
        const b = BRANCHES.find((b) => b.id === d.branchId),
          p = b.powers.find((p) => p.id === d.powerId);
        damageObject(g, n, amount, p);
      } else g.damageEnemy(n, amount, d.tag);
      if (n.dead) break;
    }
  }
  s.dots = s.dots.filter((d) => d.index < d.ticks.length);
  for (const f of s.fields.filter(
    (f) => f.until > g.time && (!f.zoneId || f.zoneId === g.zone.id),
  )) {
    const npcs = g.entities.filter(
        (n) => !n.dead && distance(n, f) <= f.radius && g.hasLineOfEffect(f, n),
      ),
      players = distance(g.player, f) <= f.radius ? [g.player] : [];
    if (["morale", "heal", "barrier", "restore"].includes(f.kind)) {
      const candidates =
        f.kind === "restore"
          ? npcs.filter((n) => n.kind === "patch")
          : f.kind === "morale"
            ? npcs.filter((n) => ["npc", "enemy"].includes(n.kind))
            : [...players, ...npcs.filter(ally)];
      for (const n of candidates) {
        if (f.seen.includes(ids(n)) || f.seen.length >= f.targetCap) continue;
        f.seen.push(ids(n));
        if (f.kind === "morale") n.morale = clamp((n.morale ?? 50) + f.amount);
        if (f.kind === "heal") g.heal(n, f.amount);
        if (f.kind === "barrier")
          barrier(g, n, f.amount, Math.max(0.1, f.until - g.time));
        if (f.kind === "restore") g.restorePatch(n, f.amount);
      }
    }
    if (f.kind === "slow" || f.kind === "projectileWard")
      for (const n of npcs.filter(hostile)) {
        n.slowAmount = f.amount || 0.3;
        g.applyControl(n, "slow", 0.3);
      }
    if (f.kind === "shelter") {
      const recipients = [...players, ...npcs.filter(ally)].slice(
        0,
        f.targetCap,
      );
      for (const n of recipients) {
        n.statuses = statuses(n).filter(
          (st) => !(st.type === "resistance" && st.fieldId === f.id),
        );
        n.statuses.push({
          type: "resistance",
          amount: f.amount,
          fieldId: f.id,
          until: Math.min(f.until, g.time + 0.3),
        });
      }
    }
    if (f.kind === "putrefaction")
      for (const n of npcs.filter(hostile)) {
        if (f.seen.includes(n.id)) continue;
        f.seen.push(n.id);
        dot(g, n, f.amount, {
          id: f.powerId + ":entry",
          branchId: "dark-pain",
        });
      }
    if (f.kind === "hostileWeaken")
      for (const n of npcs.filter(hostile)) weaken(g, n, f.amount, 0.3);
  }
  s.fields = s.fields.filter((f) => f.until > g.time);
  s.objects = s.objects.filter((o) => o.until == null || o.until > g.time);
  s.captures = s.captures.filter((c) => c.until > g.time);
  g.powerObjects = s.objects.filter((o) => o.zoneId === g.zone.id);
}

export function installLocalPowerMethods(GameEngine) {
  Object.assign(GameEngine.prototype, {
    selectSecondaryTarget(id) {
      this.secondaryTargetId = id || null;
      this.publish();
      return true;
    },
    chooseTravelRoute(id) {
      if (!this.discoveredZones.includes(id)) {
        this.event(
          "info",
          "Discover a safe arrival anchor before route travel.",
        );
        return false;
      }
      this.selectedTravelRoute = id;
      this.publish();
      return true;
    },
    dismissPowerObjects(groupId) {
      const s = state(this),
        before = s.objects.length;
      s.objects = s.objects.filter(
        (o) =>
          o.owner !== this.player.name || (groupId && o.groupId !== groupId),
      );
      this.powerObjects = s.objects.filter((o) => o.zoneId === this.zone.id);
      this.save(false);
      this.publish();
      return before - s.objects.length;
    },
    setPowerPoint(x, y) {
      this.pendingPowerPoint = { x: Number(x), y: Number(y) };
      return this.pendingPowerPoint;
    },
    setOfferingMessage(message) {
      this.offeringMessage = String(message).slice(0, 120);
      return true;
    },
    currentEncounterKey() {
      const active = this.entities
        .filter(
          (n) =>
            hostile(n) &&
            ["chase", "windup", "recover", "telegraph"].includes(n.state),
        )
        .map((n) => n.id)
        .sort()
        .join(",");
      return `${this.zone.id}:${active || "outside"}:${this.rewardedEncounters.length}`;
    },
  });
}

const TECHNIQUE_SELF = new Set([
  "divine-retaliation",
  "benevolent-manipulation",
  "twisted-affection",
  "cursed-radiance",
]);
const TECHNIQUE_ALLY = new Set([
  "divine-renewal",
  "purifying-reprieve",
  "benevolent-empowerment",
  "tenebrous-blessing",
  "celestial-offering",
]);
const TECHNIQUE_PATCH = new Set([
  "benevolent-yield",
  "harmonious-growth",
  "malignant-putrefaction",
]);
const TECHNIQUE_AREA = new Set([
  "benevolent-forge",
  "harmonious-creation",
  "purifying-ignition",
  "benevolent-deception",
  "nurturing-shelter",
]);
const TECHNIQUE_HOSTILE = new Set([
  "purging-redemption",
  "harmony-disruption",
  "ethereal-retribution",
  "ethereal-incandescence",
  "malevolent-manipulation",
  "tainted-embrace",
  "seductive-malevolence",
  "malevolent-retribution",
  "tenebrous-agony",
  "maleficent-affliction",
  "purifying-torment",
  "malevolent-rot",
  "demonic-desiccation",
  "tainted-regeneration",
  "malevolent-stasis",
  "demonic-paralysis",
  "temporal-disruption",
  "maleficent-wind-gust",
  "corrupted-interdiction",
]);
export function validateTechniqueAction(g, t, target) {
  const fail = (reason) => ({ valid: false, reason });
  if (!t) return fail("Choose a learned technique.");
  if (
    g.downed ||
    g.player.statuses.some(
      (s) => ["stun", "silence"].includes(s.type) && s.until > g.time,
    )
  )
    return fail("A current condition prevents technique casting.");
  if (target?.adventureActor && target.kind === "world-activity") {
    if (
      distance(g.player, target) > 600 ||
      !g.hasLineOfEffect(g.player, target)
    )
      return fail("Choose a visible reactive site within twenty metres.");
    return g.previewAdventurePower(
      { domain: t.domain || "Light", id: "cross-affinity" },
      t,
      target,
    );
  }
  if (TECHNIQUE_SELF.has(t.id)) return { valid: true, recipientId: "player" };
  if (target && (target.dead || target.collected || target.destroyed))
    return fail("The selected identity is no longer eligible.");
  const range = t.id === "purifying-nourishment" ? 60 : 600;
  if (target && distance(g.player, target) > range)
    return fail("The technique target is out of range.");
  if (target && !g.hasLineOfEffect(g.player, target))
    return fail("Solid cover blocks this technique.");
  if (TECHNIQUE_ALLY.has(t.id)) {
    if (target && !ally(target))
      return fail(
        "Select an eligible ally or clear the selection to affect yourself.",
      );
    const n = target || g.player;
    if (t.id === "divine-renewal" && n.health >= (n.maxHealth || 100))
      return fail("The healing recipient is already at full vitality.");
    if (
      t.id === "purifying-reprieve" &&
      !n.healReductionUntil &&
      !statuses(n).some(
        (s) =>
          ["curse", "healingReduction"].includes(s.type) && s.until > g.time,
      )
    )
      return fail(
        "No eligible curse or healing-reduction condition needs removal.",
      );
    if (t.id === "celestial-offering" && target && target.consent === false)
      return fail("This recipient has not consented to the boon.");
    return { valid: true, recipientId: target?.id || "player" };
  }
  if (TECHNIQUE_PATCH.has(t.id)) {
    if (
      !target ||
      !["patch", "water-patch"].includes(target.kind) ||
      target.protected
    )
      return fail("Select an eligible permitted crop or water patch.");
    if (
      t.id === "benevolent-yield" &&
      (!target.planted ||
        (target.growthStage || 0) >= 3 ||
        target.harvestConsumed)
    )
      return fail("The bed needs a planted, unfinished growth cycle.");
    if (
      t.id === "harmonious-growth" &&
      target.health >= target.maxHealth &&
      !target.drought
    )
      return fail("This habitat is already healthy and irrigated.");
    if (
      t.id === "malignant-putrefaction" &&
      target.kind !== "water-patch" &&
      !target.waterPatch
    )
      return fail("Putrefaction needs an eligible tagged water patch.");
    return { valid: true };
  }
  if (TECHNIQUE_AREA.has(t.id)) {
    const p = { range: 20 },
      point = castPoint(g, p, null);
    if (distance(g.player, point) > 600 || !g.hasLineOfEffect(g.player, point))
      return fail("Choose a visible point within twenty metres.");
    if (t.id === "benevolent-forge") {
      if (g.isProtectedAt?.(point) || g.isPositionBlocked(point.x, point.y))
        return fail(
          "A barrier cannot block a protected hub, exit, or occupied point.",
        );
      if (g.entities.some((n) => !n.dead && distance(n, point) < 40))
        return fail("The barrier placement is occupied.");
    }
    if (
      t.id === "purifying-ignition" &&
      !state(g).fields.some(
        (f) =>
          (!f.zoneId || f.zoneId === g.zone.id) &&
          ["corruption", "hatred"].includes(f.kind) &&
          f.removable !== false &&
          distance(f, point) <= 150,
      ) &&
      !g.entities.some(
        (n) =>
          n.corrupted &&
          n.removableCorruption !== false &&
          distance(n, point) <= 150,
      )
    )
      return fail(
        "No removable local corruption field is present at this point.",
      );
    return { valid: true, point };
  }
  if (t.id === "benevolent-catalyst")
    return !target || ally(target) || validObject(target)
      ? { valid: true }
      : fail("Select an ally or a permitted object.");
  if (t.id === "redemptive-embrace")
    return !target ||
      ["npc", "ally", "companion", "enemy"].includes(target.kind)
      ? { valid: true }
      : fail("Select an eligible identity with fear or a morale need.");
  if (t.id === "purifying-nourishment")
    return target &&
      ["item", "food", "water-item"].includes(target.kind) &&
      target.spoiled &&
      !target.bound &&
      target.permission !== false
      ? { valid: true }
      : fail("Select one permitted spoiled item unit within two metres.");
  if (t.id === "malefic-erosion")
    return validObject(target) || target?.restorationSource
      ? { valid: true }
      : fail(
          "Select a permitted structure or a temporary water-restoration source.",
        );
  if (TECHNIQUE_HOSTILE.has(t.id)) {
    if (!hostile(target)) return fail("Select an eligible nearby hostile.");
    if (
      t.id === "purging-redemption" &&
      !target.corrupted &&
      !statuses(target).some((s) => s.type === "curse" && s.until > g.time)
    )
      return fail("The hostile has no removable corruption tag.");
    if (t.id === "ethereal-retribution" && target.lineage === "angel")
      return fail(
        "Ethereal Retribution affects eligible hostile demon identities.",
      );
    if (t.id === "malevolent-retribution" && target.lineage === "demon")
      return fail(
        "Malevolent Retribution affects eligible hostile angel identities.",
      );
    return { valid: true };
  }
  return fail("No permitted execution profile is defined for this technique.");
}

export function resolveTechniqueAction(g, t, target, point) {
  if (target?.adventureActor && target.kind === "world-activity")
    return g.resolveAdventurePower(
      { domain: t.domain || "Light", id: "cross-affinity", color: "#a7dfff" },
      t,
      target,
    );
  const s = state(g),
    self = g.player,
    recipient = target && ally(target) ? target : self,
    at = point || target || self;
  const profile = {
    id: t.id,
    branchId: "cross-affinity",
    level: 3,
    radius: 5,
    targetCap: 3,
    range: 20,
  };
  const near = (
    target
      ? g.entities.filter(
          (n) =>
            hostile(n) &&
            distance(n, target) <= 150 &&
            distance(n, g.player) <= 600 &&
            g.hasLineOfEffect(g.player, n),
        )
      : []
  ).slice(0, 3);
  const temporaryObject = (kind, position, values = {}) => {
    const object = {
      id: `technique-object-${++s.serial}`,
      kind,
      x: position.x,
      y: position.y,
      zoneId: g.zone.id,
      powerId: t.id,
      owner: self.name,
      until: g.time + 6,
      noResale: true,
      ...values,
    };
    s.objects.push(object);
    return object;
  };
  switch (t.id) {
    case "purging-redemption":
      target.corrupted = false;
      clean(g, target, 1, new Set(["curse"]));
      weaken(g, target, 0.1, 6);
      break;
    case "divine-retaliation":
    case "cursed-radiance":
      statuses(self).push({
        type: "nextHit",
        multiplier: t.id === "divine-retaliation" ? 1.2 : 1.15,
        tag: t.id === "cursed-radiance" ? "light" : null,
        until: g.time + 6,
      });
      break;
    case "harmony-disruption":
      near.forEach((n) => {
        n.supportBlockedUntil = g.time + 6;
        n.silencedUntil = g.time + 6;
        if (["preparing", "windup"].includes(n.state)) {
          n.state = "recover";
          n.cooldown = 1;
        }
      });
      break;
    case "benevolent-manipulation":
    case "twisted-affection":
      g.beginConcealment?.(10);
      statuses(self).push({
        type: "concealment",
        until: g.time + 10,
        suppressSuspicion: t.id === "twisted-affection",
      });
      break;
    case "ethereal-retribution":
      near
        .filter((n) => n.lineage !== "angel")
        .forEach((n) => g.applyControl(n, "feared", 2));
      break;
    case "divine-renewal":
      g.heal(recipient, 30);
      break;
    case "purifying-reprieve": {
      const family =
        recipient.healReductionUntil > g.time ? "healingReduction" : "curse";
      clean(g, recipient, 1, new Set([family]));
      recipient.healReductionUntil = 0;
      statuses(recipient).push({
        type: "cleanseProtection",
        family,
        until: g.time + 6,
      });
      break;
    }
    case "benevolent-empowerment":
    case "celestial-offering":
      statuses(recipient).push({
        type: "potency",
        multiplier: t.id === "benevolent-empowerment" ? 1.15 : 1.1,
        until: g.time + 6,
      });
      if (t.id === "celestial-offering" && g.offeringMessage)
        temporaryObject("decoration", recipient, {
          name: "Chosen decorative gift",
          message: g.offeringMessage,
        });
      break;
    case "tenebrous-blessing":
      barrier(g, recipient, 25, 6);
      break;
    case "redemptive-embrace": {
      const n = target || self;
      clean(g, n, 1, new Set(["fear", "feared"]));
      if (n !== self) n.morale = clamp((n.morale ?? 50) + 20);
      break;
    }
    case "benevolent-forge":
      temporaryObject("barrier", at, {
        name: "Benevolent Forge",
        width: 80,
        height: 16,
        blocking: true,
        durability: 30,
        maxDurability: 30,
      });
      break;
    case "harmonious-creation": {
      const candidates = g.entities
        .filter(
          (n) =>
            ["npc", "ally", "enemy"].includes(n.kind) &&
            !n.dead &&
            distance(n, at) <= 150 &&
            g.hasLineOfEffect(at, n),
        )
        .slice(0, 3);
      candidates.forEach((n) => (n.morale = clamp((n.morale ?? 50) + 20)));
      field(g, "morale", at, profile, {
        amount: 20,
        duration: 6,
        seen: candidates.map(ids),
      });
      temporaryObject("decoration", at, {
        name: "Calm fire display",
        width: 24,
        height: 30,
      });
      break;
    }
    case "purifying-ignition": {
      const f = s.fields.find(
        (f) =>
          (!f.zoneId || f.zoneId === g.zone.id) &&
          ["corruption", "hatred"].includes(f.kind) &&
          f.removable !== false &&
          distance(f, at) <= 150,
      );
      if (f) f.until = g.time;
      else {
        const source = g.entities.find(
          (n) =>
            n.corrupted &&
            n.removableCorruption !== false &&
            distance(n, at) <= 150,
        );
        if (source) source.corrupted = false;
      }
      break;
    }
    case "benevolent-catalyst":
      if (target && validObject(target))
        target.temporaryDurability = {
          amount: Math.max(
            target.temporaryDurability?.until > g.time
              ? target.temporaryDurability.amount
              : 0,
            25,
          ),
          until: g.time + 6,
        };
      else barrier(g, recipient, 25, 6);
      break;
    case "ethereal-incandescence":
      g.applyControl(target, "slow", 3);
      if (["preparing", "windup"].includes(target.state)) {
        target.state = "recover";
        target.cooldown = 2;
      }
      break;
    case "benevolent-yield":
      target.growthStage = Math.min(3, (target.growthStage || 0) + 1);
      break;
    case "nurturing-shelter":
      field(g, "shelter", at, profile, { amount: 0.2, duration: 6, seen: [] });
      break;
    case "purifying-nourishment":
      target.spoiled = false;
      target.purifiedUnit = true;
      break;
    case "harmonious-growth":
      g.restorePatch(target, 30);
      target.drought = false;
      break;
    case "malevolent-manipulation":
    case "seductive-malevolence":
      g.applyControl(target, "calmed", 6);
      target.priority = "inspect";
      target.priorityPoint = castPoint(g, { range: 20 }, null);
      target.priorityUntil = g.time + 6;
      break;
    case "benevolent-deception": {
      temporaryObject("decoy", at, {
        name: "Visible harmless decoy",
        width: 25,
        height: 40,
        blocking: false,
      });
      const n = g.entities.find(
        (n) => hostile(n) && !n.boss && distance(n, at) <= 150,
      );
      if (n) {
        g.applyControl(n, "calmed", 6);
        n.priority = "inspect";
        n.priorityPoint = { x: at.x, y: at.y };
        n.priorityUntil = g.time + 6;
      }
      break;
    }
    case "tainted-embrace":
      target.exposedUntil = g.time + 6;
      break;
    case "malevolent-retribution":
      g.damageEnemy(target, 30, "light");
      break;
    case "tenebrous-agony":
      dot(g, target, 30, { ...profile, branchId: "dark-pain" }, "damage");
      g.applyControl(target, "slow", 3);
      break;
    case "maleficent-affliction":
      g.applyControl(target, "silence", 3);
      target.silencedUntil = g.time + 3;
      break;
    case "purifying-torment":
      target.healBacklash = { until: g.time + 6, damage: 10, used: false };
      target.healReductionUntil = g.time + 6;
      break;
    case "malevolent-rot":
      target.healReductionUntil = g.time + 6;
      break;
    case "demonic-desiccation": {
      const before = target.health;
      g.damageEnemy(target, 30, "water");
      g.heal(self, Math.floor(Math.max(0, before - target.health) / 2));
      break;
    }
    case "malignant-putrefaction":
      target.corrupted = true;
      target.corruptedUntil = g.time + 6;
      field(g, "putrefaction", target, profile, {
        amount: 20,
        duration: 6,
        seen: [],
      });
      break;
    case "tainted-regeneration":
      target.healReductionUntil = g.time + 6;
      weaken(g, target, 0.1, 6);
      break;
    case "malefic-erosion":
      if (target.restorationSource) {
        target.until = g.time;
        target.restorationSource = false;
      } else
        damageObject(g, target, 30, { ...profile, branchId: "water-decay" });
      break;
    case "malevolent-stasis":
      g.applyControl(target, "root", 3);
      break;
    case "demonic-paralysis":
      near.forEach((n) => g.applyControl(n, "root", 3));
      break;
    case "temporal-disruption":
      g.applyControl(target, "slow", 3);
      if (["preparing", "windup"].includes(target.state))
        target.windup = Math.max(0, target.windup || 0) + 1;
      break;
    case "maleficent-wind-gust":
      push(g, target, 90);
      g.applyControl(target, "slow", 6);
      break;
    case "corrupted-interdiction":
      target.supportBlockedUntil = g.time + 3;
      target.silencedUntil = g.time + 3;
      if (["windup", "preparing"].includes(target.state)) {
        target.state = "recover";
        target.cooldown = 3;
      }
      break;
    default:
      return false;
  }
  g.effect(at, "spell", "#c5a7de", 70, 1, {
    powerId: t.id,
    family: "cross-affinity",
    level: 3,
  });
  g.powerObjects = s.objects.filter((o) => o.zoneId === g.zone.id);
  return true;
}
