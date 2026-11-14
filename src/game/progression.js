/** Manual pp.13–17: recovery, witnessed actions, standing and cross-affinity trials. */
export const PROGRESSION_RULES = Object.freeze({
  downedSeconds: 20,
  reviveSeconds: 4,
  reviveVitality: 0.25,
  recallVitality: 0.5,
  resurrectionSeconds: 5,
  resurrectionEssence: 40,
  resurrectionCooldown: 60,
  fallenWindow: 30,
  veilSeconds: 2,
  detectionSeconds: 3,
  detectionResetSeconds: 5,
  restitutionKarma: 25,
});
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const distance = (a, b) =>
  Math.hypot((a?.x || 0) - (b?.x || 0), (a?.y || 0) - (b?.y || 0));
const copy = (value) => JSON.parse(JSON.stringify(value));
const angelDomains = ["love", "light", "water", "air"];
const demonDomains = ["hate", "dark", "fire", "earth"];
const nativeWallet = (g) =>
  g.player.lineage === "demon" ? "badKarma" : "goodKarma";
const zoneId = (g) => g.zone?.id || "sacred-groves";
const entityById = (g, id) => (g.entities || []).find((e) => e.id === id);
const emit = (g, type, text) => g.event?.(type, text);
const commit = (g) => {
  g.save?.(false);
  g.publish?.();
};
const busy = (g) => !!g.paused || !!g.downed;
const isConflict = (g) => !!g.inCombat?.();
const factionOf = (e) =>
  e.factionId ||
  e.faction ||
  (e.role === "merchant" ? "wayfarers" : "grove-keepers");
const fresh = () => ({
  version: 1,
  elapsed: 0,
  serial: 0,
  recovery: {
    downed: false,
    remaining: 0,
    revive: null,
    resurrection: null,
    lastHitAt: -1000,
    deaths: 0,
  },
  certification: {
    cooperative: [],
    practice: [],
    practiceTrial: null,
    certifiedAt: null,
  },
  veil: {
    state: "revealed",
    remaining: 0,
    exposure: null,
    observers: {},
    witnesses: [],
    incidents: [],
  },
  reputation: { factions: {}, npcs: {}, history: [] },
  fallen: {},
  resurrectedKeys: [],
});

export function reputationTier(value) {
  return value < -50
    ? "hostile"
    : value < 0
      ? "wary"
      : value < 25
        ? "neutral"
        : value < 60
          ? "trusted"
          : "allied";
}

export function initProgression(game, saved) {
  const source = saved || game.progression || {};
  const initial = fresh();
  game.progression = {
    ...initial,
    ...copy(source),
    recovery: { ...initial.recovery, ...(source.recovery || {}) },
    certification: {
      ...initial.certification,
      ...(source.certification || {}),
    },
    veil: { ...initial.veil, ...(source.veil || {}) },
    reputation: { ...initial.reputation, ...(source.reputation || {}) },
  };
  const p = game.progression;
  p.reputation.factions ||= {};
  p.reputation.npcs ||= {};
  p.reputation.history ||= [];
  p.veil.observers ||= {};
  p.veil.witnesses ||= [];
  p.veil.incidents ||= [];
  p.certification.cooperative ||= [];
  p.certification.practice ||= [];
  p.fallen ||= {};
  p.resurrectedKeys ||= [];
  if (p.reputation.factions["grove-keepers"] == null)
    p.reputation.factions["grove-keepers"] = clamp(
      Number(game.player?.reputation) || 0,
      -100,
      100,
    );
  if (game.player?.certified && !p.certification.certifiedAt)
    p.certification.certifiedAt = p.elapsed;
  game.downed = !!p.recovery.downed;
  if (game.downed && game.player) game.player.health = 0;
  if (game.player) game.player.veil = p.veil.state === "veiled";
  return p;
}
function state(g) {
  return g.progression || initProgression(g);
}

function lineOfSight(g, a, b) {
  if (typeof g.hasLineOfSight === "function") return g.hasLineOfSight(a, b);
  const dx = b.x - a.x,
    dy = b.y - a.y,
    length = Math.hypot(dx, dy);
  if (!length) return true;
  const blockers = [
    ...(g.world?.props || []),
    ...(g.sanctuary?.components || []),
  ].filter((o) => o.blocking || ["wall", "closed-gate"].includes(o.kind));
  return !blockers.some((o) => {
    if (o.zoneId && o.zoneId !== zoneId(g)) return false;
    const halfW = (o.width || (o.radius || 12) * 2) / 2,
      halfH = (o.height || (o.radius || 12) * 2) / 2;
    let lo = 0,
      hi = 1;
    for (const [origin, delta, min, max] of [
      [a.x, dx, o.x - halfW, o.x + halfW],
      [a.y, dy, o.y - halfH, o.y + halfH],
    ]) {
      if (Math.abs(delta) < 0.0001) {
        if (origin < min || origin > max) return false;
      } else {
        const t1 = (min - origin) / delta,
          t2 = (max - origin) / delta;
        lo = Math.max(lo, Math.min(t1, t2));
        hi = Math.min(hi, Math.max(t1, t2));
        if (lo > hi) return false;
      }
    }
    return hi > 0.02 && lo < 0.98;
  });
}
function observers(g) {
  return (g.entities || []).filter(
    (e) =>
      ["npc", "enemy", "ally", "companion"].includes(e.kind) &&
      !e.dead &&
      !e.collected &&
      e.canWitness !== false,
  );
}
function observerSees(g, npc) {
  return (
    distance(npc, g.player) <= (npc.sightRange || 300) &&
    lineOfSight(g, npc, g.player)
  );
}
function ensureObserver(g, npc) {
  const p = state(g),
    key = `${zoneId(g)}:${npc.id}`;
  return (p.veil.observers[key] ||= {
    id: npc.id,
    zoneId: zoneId(g),
    name: npc.name || npc.id,
    factionId: factionOf(npc),
    awareness:
      npc.awareness || (npc.celestialAware ? "celestial-aware" : "mundane"),
    meter: 0,
    unseenFor: 0,
    revealed: false,
    visible: false,
  });
}
function applyStanding(g, key, delta, reason) {
  const p = state(g),
    npc = key.startsWith("npc:"),
    id = key.replace(/^(npc|faction):/, ""),
    map = npc ? p.reputation.npcs : p.reputation.factions;
  map[id] = clamp((Number(map[id]) || 0) + delta, -100, 100);
  if (!npc && id === "grove-keepers") g.player.reputation = map[id];
  p.reputation.history.unshift({
    id: `standing:${++p.serial}`,
    target: key,
    delta,
    value: map[id],
    reason,
    at: p.elapsed,
  });
  p.reputation.history = p.reputation.history.slice(0, 100);
  return { id, value: map[id], tier: reputationTier(map[id]) };
}
function witness(g, npc, incident) {
  const p = state(g),
    o = ensureObserver(g, npc);
  o.meter = 1;
  o.revealed = true;
  o.awareness = "celestial-aware";
  npc.awareness = "celestial-aware";
  const id = `${incident.id}:${zoneId(g)}:${npc.id}`;
  if (p.veil.witnesses.some((w) => w.id === id)) return;
  p.veil.witnesses.push({
    id,
    observerId: npc.id,
    observerName: npc.name || npc.id,
    factionId: factionOf(npc),
    zoneId: zoneId(g),
    incidentId: incident.id,
    type: incident.type,
    at: p.elapsed,
    receiptId: incident.receiptId || null,
  });
  incident.witnesses ||= [];
  incident.witnesses.push(npc.id);
  incident.reputationApplied ||= [];
  for (const key of [`npc:${npc.id}`, `faction:${factionOf(npc)}`])
    if (!incident.reputationApplied.includes(key)) {
      applyStanding(g, key, -10, `Witnessed ${incident.type}`);
      incident.reputationApplied.push(key);
    }
  emit(
    g,
    "witness",
    `${npc.name || npc.id} witnessed ${incident.type}. This observer remembers the incident.`,
  );
}

function recall(g) {
  const p = state(g),
    recovery = p.recovery,
    avatar = g.player;
  if (!recovery.downed || recovery.remaining > 0) return false;
  const spawn = g.world?.spawn || { x: 920, y: 900 };
  avatar.x = spawn.x;
  avatar.y = spawn.y;
  avatar.health = Math.max(
    1,
    Math.floor(avatar.maxHealth * PROGRESSION_RULES.recallVitality),
  );
  avatar.statuses = [];
  avatar.veil = false;
  p.veil.state = "revealed";
  p.veil.remaining = 0;
  recovery.downed = false;
  recovery.revive = null;
  recovery.resurrection = null;
  recovery.remaining = 0;
  g.downed = false;
  g.targetId = null;
  g.destination = null;
  g.castState = null;
  g.techniqueState = null;
  g.lastDamage = (g.time || 0) - 10;
  for (const enemy of g.entities || [])
    if (enemy.kind === "enemy" && !enemy.dead && enemy.home) {
      enemy.x = enemy.home.x;
      enemy.y = enemy.home.y;
      enemy.health = enemy.maxHealth;
      enemy.state = "idle";
      enemy.cooldown = 1;
    }
  emit(
    g,
    "recovery",
    "Recalled to sanctuary at 50% vitality. Inventory, wallets, learned powers and lifetime Karma were retained.",
  );
  commit(g);
  return true;
}
function resurrectionValidation(g, id, options = {}) {
  const p = state(g),
    entity = entityById(g, id),
    fallen = p.fallen[`${zoneId(g)}:${id}`];
  const invalid = (reason) => ({
    valid: false,
    reason,
    entityId: id,
    deathKey: fallen?.deathKey || null,
  });
  if (!entity || !fallen)
    return invalid("Inspect a recorded, recently fallen ally or creature.");
  if (fallen.zoneId !== zoneId(g))
    return invalid("The fallen identity belongs to another region.");
  if (entity.capturedUntil > (g.time || 0))
    return invalid(
      "This identity is temporarily captured; wait until the capture ends before resurrection.",
    );
  if (
    entity.protected ||
    entity.role === "keeper" ||
    entity.role === "merchant" ||
    fallen.protected
  )
    return invalid("This protected identity cannot be resurrected.");
  if (
    entity.unrecoverable ||
    entity.permanentlyClosed ||
    entity.recoverable === false ||
    fallen.closed
  )
    return invalid("This authored NPC outcome is permanently closed.");
  if (
    fallen.revived ||
    p.resurrectedKeys.includes(fallen.deathKey) ||
    (!entity.dead && entity.health > 0)
  )
    return invalid(
      "This identity has already recovered. No second body or reward can be created.",
    );
  if (p.elapsed - fallen.fallenAt >= PROGRESSION_RULES.fallenWindow)
    return invalid("The recoverable fallen-identity window has closed.");
  if ((g.player.learned?.["dark-heal"] || 0) < 7)
    return invalid("Learn Tenebrous Rebirth, Dark–Heal level 7, first.");
  if (distance(entity, g.player) > 36 * 30)
    return invalid("The fallen target is beyond the 36-metre spell range.");
  if (!options.ignoreResources) {
    if (g.player.essence < PROGRESSION_RULES.resurrectionEssence)
      return invalid("Tenebrous Rebirth requires 40 Essence.");
    if ((g.cooldowns?.["dark-heal-7"] || 0) > (g.time || 0))
      return invalid("Tenebrous Rebirth is still recovering.");
  }
  return {
    valid: true,
    reason: "",
    entityId: id,
    deathKey: fallen.deathKey,
    remaining: PROGRESSION_RULES.fallenWindow - (p.elapsed - fallen.fallenAt),
    range: 36,
    cost: 40,
    castTime: 5,
    cooldown: 60,
  };
}
function settleResurrection(g, id, expectedDeathKey, costPaid = false) {
  const check = resurrectionValidation(g, id, { ignoreResources: costPaid });
  if (
    !check.valid ||
    (expectedDeathKey && check.deathKey !== expectedDeathKey)
  ) {
    emit(
      g,
      "info",
      check.reason ||
        "The fallen identity changed before resurrection settled.",
    );
    return false;
  }
  const p = state(g),
    entity = entityById(g, id),
    fallen = p.fallen[`${zoneId(g)}:${id}`];
  if (!costPaid) {
    g.player.essence -= 40;
    g.cooldowns ||= {};
    g.cooldowns["dark-heal-7"] = (g.time || 0) + 60;
    g.lastAction = g.time || 0;
  }
  fallen.revived = true;
  fallen.revivedAt = p.elapsed;
  p.resurrectedKeys.push(fallen.deathKey);
  entity.dead = false;
  entity.downed = false;
  entity.health = Math.max(
    1,
    Math.floor((entity.maxHealth || fallen.maxHealth || 100) * 0.5),
  );
  entity.state = "idle";
  entity.cooldown = 2;
  entity.rewardClaimed = true;
  entity.resurrected = true;
  // Deliberately retain the entity ID, inventory, resolution, extraction and quest
  // receipts. A restored body never creates another entitlement.
  g.effect?.(entity, "resurrect", "#bca6d8", 72, 1.5);
  emit(
    g,
    "recovery",
    `${entity.name || id} returns at 50% vitality. The same identity and reward records are retained.`,
  );
  commit(g);
  return true;
}

export function updateProgression(game, dt) {
  const p = state(game);
  if (game.paused || !Number.isFinite(dt) || dt <= 0) return;
  p.elapsed += dt;
  const recovery = p.recovery;
  if (recovery.downed) {
    recovery.remaining = Math.max(0, recovery.remaining - dt);
    if (recovery.remaining <= 1e-9) {
      recovery.remaining = 0;
      recall(game);
      return;
    }
  }
  if (recovery.revive) {
    const channel = recovery.revive,
      selfTarget = channel.targetId === "@player",
      target = selfTarget ? game.player : entityById(game, channel.targetId),
      reviver =
        channel.reviverId === "@player"
          ? game.player
          : entityById(game, channel.reviverId);
    const invalid =
      channel.zoneId !== zoneId(game) ||
      !target ||
      !reviver ||
      reviver.dead ||
      (channel.reviverId !== "@player" && reviver.health <= 0) ||
      distance(target, reviver) > 90 ||
      distance(reviver, channel.startPosition) > 5 ||
      (!selfTarget && !target.dead && !target.downed && target.health > 0);
    if (invalid) game.cancelRevive?.("The revive interaction was interrupted.");
    else {
      channel.remaining = Math.max(0, channel.remaining - dt);
      if (channel.remaining <= 1e-9) {
        target.health = Math.max(
          1,
          Math.floor(
            (target.maxHealth || 100) * PROGRESSION_RULES.reviveVitality,
          ),
        );
        target.dead = false;
        target.downed = false;
        if (selfTarget) {
          game.downed = false;
          recovery.downed = false;
          recovery.remaining = 0;
        } else {
          const fallen = p.fallen[`${zoneId(game)}:${target.id}`];
          if (fallen) fallen.revived = true;
        }
        recovery.revive = null;
        emit(
          game,
          "recovery",
          `${selfTarget ? "You return" : `${target.name || target.id} returns`} at 25% vitality after a four-second ally revive.`,
        );
        commit(game);
      }
    }
  }
  if (recovery.resurrection) {
    const channel = recovery.resurrection;
    const check = resurrectionValidation(game, channel.targetId);
    if (
      !check.valid ||
      check.deathKey !== channel.deathKey ||
      channel.zoneId !== zoneId(game) ||
      distance(game.player, channel.startPosition) > 5 ||
      game.downed
    ) {
      recovery.resurrection = null;
      emit(
        game,
        "info",
        check.reason ||
          "Resurrection preparation was interrupted. No Essence was spent.",
      );
    } else {
      channel.remaining = Math.max(0, channel.remaining - dt);
      if (channel.remaining <= 1e-9) {
        recovery.resurrection = null;
        settleResurrection(game, channel.targetId, channel.deathKey, false);
      }
    }
  }
  const trial = p.certification.practiceTrial;
  if (
    trial &&
    (trial.expiresAt <= p.elapsed || trial.zoneId !== zoneId(game))
  ) {
    p.certification.practiceTrial = null;
    if (trial.originalSelection)
      game.selectedPower = copy(trial.originalSelection);
    emit(
      game,
      "info",
      "The isolated opposing-domain practice session ended. No branch unlock was retained.",
    );
  }
  const veil = p.veil;
  if (veil.state === "transition") {
    if (isConflict(game) || game.downed)
      game.breakVeil?.(
        "Conflict interrupted the two-second disguise transition.",
      );
    else {
      veil.remaining = Math.max(0, veil.remaining - dt);
      if (veil.remaining <= 1e-9) {
        veil.remaining = 0;
        veil.state = "veiled";
        game.player.veil = true;
        emit(
          game,
          "info",
          "Veil active. Mundane observers see your chosen traveler disguise.",
        );
      }
    }
  } else if (veil.state === "veiled" && !game.player.veil) {
    veil.state = "revealed";
    veil.remaining = 0;
  } else if (veil.state === "revealed" && game.player.veil)
    veil.state = "veiled";
  const exposure = veil.exposure;
  const exposed =
    exposure &&
    exposure.zoneId === zoneId(game) &&
    exposure.until > p.elapsed &&
    distance(game.player, exposure.position) <= exposure.radius;
  for (const npc of observers(game)) {
    const o = ensureObserver(game, npc),
      visible = observerSees(game, npc);
    o.visible = visible;
    if (visible && exposed) {
      o.unseenFor = 0;
      o.meter = clamp(o.meter + dt / PROGRESSION_RULES.detectionSeconds, 0, 1);
      if (o.meter > 0 && !o.revealed) o.awareness = "suspicious";
      if (o.meter >= 1 - 1e-9) {
        const incident = veil.incidents.find(
          (i) => i.id === exposure.incidentId,
        );
        if (incident) witness(game, npc, incident);
      }
    } else {
      o.unseenFor += dt;
      if (o.unseenFor >= PROGRESSION_RULES.detectionResetSeconds) {
        o.meter = 0;
        if (!o.revealed) o.awareness = "mundane";
      }
    }
  }
  if (exposure && !exposed) veil.exposure = null;
}

export function snapshotProgression(game) {
  const p = state(game),
    trial = p.certification.practiceTrial,
    wallet = nativeWallet(game);
  const reputation = {
    factions: Object.entries(p.reputation.factions).map(([id, value]) => ({
      id,
      value,
      tier: reputationTier(value),
    })),
    npcs: Object.entries(p.reputation.npcs).map(([id, value]) => ({
      id,
      name: entityById(game, id)?.name || id,
      value,
      tier: reputationTier(value),
    })),
    history: copy(p.reputation.history),
  };
  return {
    recovery: {
      ...copy(p.recovery),
      canRecall: p.recovery.downed && p.recovery.remaining <= 0,
      fallen: Object.values(p.fallen)
        .filter((f) => f.zoneId === zoneId(game))
        .map((f) => ({
          ...copy(f),
          remaining: Math.max(0, 30 - (p.elapsed - f.fallenAt)),
          eligibility: resurrectionValidation(game, f.entityId),
        })),
    },
    certification: {
      certified: !!game.player.certified,
      requiredRank: 3,
      cost: 500,
      wallet,
      rankMet: game.player.rank >= 3,
      fundsMet: game.player[wallet] >= 500,
      cooperativeMet: p.certification.cooperative.length > 0,
      practiceMet: p.certification.practice.length > 0,
      cooperative: copy(p.certification.cooperative),
      practice: copy(p.certification.practice),
      practiceTrial: trial
        ? {
            ...copy(trial),
            remaining: Math.max(0, trial.expiresAt - p.elapsed),
          }
        : null,
      eligible:
        !game.player.certified &&
        game.player.rank >= 3 &&
        game.player[wallet] >= 500 &&
        p.certification.cooperative.length > 0 &&
        p.certification.practice.length > 0,
    },
    veil: {
      state: p.veil.state,
      remaining: p.veil.remaining,
      detection: Math.max(
        0,
        ...Object.values(p.veil.observers)
          .filter((o) => o.zoneId === zoneId(game) && o.visible)
          .map((o) => o.meter),
      ),
      observers: copy(Object.values(p.veil.observers)),
      incidents: copy(p.veil.incidents),
      exposure: p.veil.exposure ? copy(p.veil.exposure) : null,
    },
    reputation,
    witnesses: copy(p.veil.witnesses),
    rules: { ...PROGRESSION_RULES },
    elapsed: p.elapsed,
  };
}

export function installProgression(GameEngine) {
  if (GameEngine.prototype.__progressionInstalled) return;
  Object.defineProperty(GameEngine.prototype, "__progressionInstalled", {
    value: true,
  });
  const originalDamage = GameEngine.prototype.damagePlayer;
  if (originalDamage)
    GameEngine.prototype.damagePlayer = function (...args) {
      if (this.downed) {
        this.recordDownedHit();
        return;
      }
      return originalDamage.apply(this, args);
    };
  Object.assign(GameEngine.prototype, {
    defeat() {
      const p = state(this),
        recovery = p.recovery;
      if (recovery.downed) return false;
      this.downed = true;
      this.player.health = 0;
      this.player.veil = false;
      p.veil.state = "revealed";
      p.veil.remaining = 0;
      Object.assign(recovery, {
        downed: true,
        remaining: 20,
        revive: null,
        resurrection: null,
        lastHitAt: -1000,
        deaths: recovery.deaths + 1,
      });
      this.destination = null;
      this.castState = null;
      this.techniqueState = null;
      this.recallState = null;
      this.keys?.clear?.();
      this.damageEquipment?.(10);
      emit(
        this,
        "defeat",
        "Downed for twenty seconds. A nearby ally can revive you in four seconds; otherwise recall returns you at 50% vitality.",
      );
      commit(this);
      return true;
    },
    recordDownedHit() {
      const p = state(this);
      if (!p.recovery.downed || p.elapsed - p.recovery.lastHitAt < 1)
        return false;
      p.recovery.lastHitAt = p.elapsed;
      p.recovery.remaining = Math.max(0, p.recovery.remaining - 2);
      this.publish?.();
      return true;
    },
    beginRevive(targetId) {
      const p = state(this);
      if (this.paused || p.recovery.revive || p.recovery.resurrection)
        return false;
      const selfTarget = this.downed && (!targetId || targetId === "@player"),
        target = selfTarget ? this.player : entityById(this, targetId);
      const reviver = selfTarget
        ? (this.entities || [])
            .filter(
              (e) =>
                ["npc", "ally", "companion"].includes(e.kind) &&
                !e.dead &&
                e.canRevive !== false &&
                (e.health == null || e.health > 0) &&
                distance(e, this.player) <= 90,
            )
            .sort(
              (a, b) => distance(a, this.player) - distance(b, this.player),
            )[0]
        : this.player;
      if (
        !target ||
        !reviver ||
        (!selfTarget &&
          (this.downed ||
            !["npc", "ally", "companion"].includes(target.kind) ||
            !target.downed ||
            target.unrecoverable ||
            target.permanentlyClosed)) ||
        distance(target, reviver) > 90
      ) {
        emit(
          this,
          "info",
          "A downed friendly target and a living ally must be within three metres for an ordinary revive.",
        );
        return false;
      }
      p.recovery.revive = {
        targetId: selfTarget ? "@player" : target.id,
        reviverId: selfTarget ? reviver.id : "@player",
        zoneId: zoneId(this),
        remaining: 4,
        startPosition: { x: reviver.x, y: reviver.y },
      };
      emit(
        this,
        "recovery",
        "Four-second revive started. Stay nearby until it completes.",
      );
      this.publish?.();
      return true;
    },
    cancelRevive(reason = "Revive cancelled.") {
      const p = state(this);
      if (!p.recovery.revive && !p.recovery.resurrection) return false;
      p.recovery.revive = null;
      p.recovery.resurrection = null;
      emit(this, "info", reason);
      this.publish?.();
      return true;
    },
    useRecoveryRecall() {
      const p = state(this);
      if (!p.recovery.downed) return false;
      if (p.recovery.remaining > 0) {
        emit(
          this,
          "info",
          `Defeat recall becomes available when the downed timer ends (${Math.ceil(p.recovery.remaining)}s). Local exit remains available immediately.`,
        );
        return false;
      }
      return recall(this);
    },
    recordNPCDeath(entityOrId) {
      const p = state(this),
        entity =
          typeof entityOrId === "string"
            ? entityById(this, entityOrId)
            : entityOrId;
      if (
        !entity ||
        !["npc", "enemy", "ally", "companion"].includes(entity.kind) ||
        entity.training ||
        entity.kind === "dummy"
      )
        return false;
      const key = `${zoneId(this)}:${entity.id}`,
        previous = p.fallen[key];
      if (previous && !previous.revived && (entity.dead || entity.health <= 0))
        return previous.deathKey;
      const deathKey = `${key}:death-${++p.serial}`;
      p.fallen[key] = {
        entityId: entity.id,
        name: entity.name || entity.id,
        zoneId: zoneId(this),
        deathKey,
        fallenAt: p.elapsed,
        maxHealth: entity.maxHealth || 100,
        revived: false,
        protected:
          !!entity.protected || ["keeper", "merchant"].includes(entity.role),
        closed:
          !!entity.unrecoverable ||
          !!entity.permanentlyClosed ||
          entity.recoverable === false,
      };
      return deathKey;
    },
    canResurrect(id, options) {
      return resurrectionValidation(this, id, options);
    },
    resurrectNPC(id, options = {}) {
      const p = state(this),
        check = resurrectionValidation(this, id, {
          ignoreResources: !!options.settled,
        });
      if (!check.valid || busy(this)) {
        emit(
          this,
          "info",
          check.reason ||
            "Recovery actions are unavailable while downed or paused.",
        );
        return false;
      }
      if (options.settled)
        return settleResurrection(
          this,
          id,
          options.deathKey || check.deathKey,
          true,
        );
      if (
        p.recovery.resurrection ||
        p.recovery.revive ||
        this.castState ||
        this.techniqueState
      )
        return false;
      p.recovery.resurrection = {
        targetId: id,
        deathKey: check.deathKey,
        zoneId: zoneId(this),
        remaining: 5,
        startPosition: { x: this.player.x, y: this.player.y },
      };
      emit(
        this,
        "cast",
        "Preparing Tenebrous Rebirth for five seconds. Resources settle only if the fallen identity is still eligible.",
      );
      this.publish?.();
      return true;
    },
    beginOpposingPractice(branchId) {
      const p = state(this);
      if (
        busy(this) ||
        isConflict(this) ||
        this.player.rank < 3 ||
        this.player.certified
      ) {
        emit(
          this,
          "info",
          "An isolated opposing-domain trial requires rank 3, an uncertified character, and no active conflict.",
        );
        return false;
      }
      branchId ||=
        this.player.lineage === "demon" ? "water-grow" : "hate-clean";
      const opposing =
        this.player.lineage === "demon" ? angelDomains : demonDomains;
      if (!opposing.includes(String(branchId).split("-")[0])) {
        emit(
          this,
          "info",
          "Choose a level-one branch from your opposing domains.",
        );
        return false;
      }
      const target = (this.entities || [])
        .filter(
          (e) =>
            e.kind === "dummy" && !e.dead && distance(e, this.player) <= 360,
        )
        .sort((a, b) => distance(a, this.player) - distance(b, this.player))[0];
      if (!target) {
        emit(
          this,
          "info",
          "Approach a sanctuary training effigy to begin isolated practice.",
        );
        return false;
      }
      if (p.certification.practiceTrial) {
        emit(
          this,
          "info",
          "Finish or leave the existing opposing-domain practice trial first.",
        );
        return false;
      }
      p.certification.practiceTrial = {
        branchId,
        level: 1,
        targetId: target.id,
        zoneId: zoneId(this),
        startedAt: p.elapsed,
        expiresAt: p.elapsed + 120,
        originalSelection: copy(this.selectedPower || {}),
      };
      this.selectedPower = { branchId, level: 1 };
      this.targetId = target.id;
      emit(
        this,
        "info",
        "Isolated trial active for two minutes: this temporary level-one power can affect only the named training effigy. It does not unlock the branch.",
      );
      commit(this);
      return true;
    },
    canUsePractice(branchId, target) {
      const p = state(this),
        trial = p.certification.practiceTrial;
      const entity =
        typeof target === "string" ? entityById(this, target) : target;
      return (
        !!trial &&
        !this.player.certified &&
        this.player.rank >= 3 &&
        trial.expiresAt > p.elapsed &&
        trial.zoneId === zoneId(this) &&
        trial.branchId === branchId &&
        entity?.id === trial.targetId &&
        entity.kind === "dummy" &&
        !entity.dead &&
        distance(entity, this.player) <= 360 &&
        (this.selectedPower?.level || 1) === 1
      );
    },
    recordPowerPractice(branchId, targetId = this.targetId) {
      const p = state(this),
        trial = p.certification.practiceTrial;
      if (!this.canUsePractice(branchId, entityById(this, targetId)))
        return false;
      const id = `${trial.zoneId}:${trial.targetId}:${branchId}`;
      if (!p.certification.practice.some((e) => e.id === id))
        p.certification.practice.push({ id, branchId, at: p.elapsed });
      p.certification.practiceTrial = null;
      if (trial.originalSelection)
        this.selectedPower = copy(trial.originalSelection);
      emit(
        this,
        "success",
        "Opposing-domain practice certified. The temporary trial power has been removed.",
      );
      commit(this);
      return true;
    },
    recordCooperativeObjective(id, details = {}) {
      const p = state(this);
      if (
        !id ||
        details.createdProblem ||
        details.training ||
        details.repeated ||
        p.certification.cooperative.some((e) => e.id === id)
      )
        return false;
      p.certification.cooperative.push({
        id: String(id),
        type: details.type || "cooperative",
        partnerId: details.partnerId || null,
        zoneId: zoneId(this),
        at: p.elapsed,
      });
      emit(
        this,
        "success",
        "A distinct cooperative objective was recorded for cross-affinity certification.",
      );
      commit(this);
      return true;
    },
    certifyCrossAffinity() {
      const p = state(this),
        wallet = nativeWallet(this);
      if (this.player.certified) return true;
      if (busy(this) || isConflict(this)) return false;
      if (
        this.player.rank < 3 ||
        !p.certification.cooperative.length ||
        !p.certification.practice.length ||
        this.player[wallet] < 500
      ) {
        emit(
          this,
          "info",
          "Certification requires rank 3, one cooperative objective, one opposing-domain practice trial, and 500 native Karma.",
        );
        return false;
      }
      this.player[wallet] -= 500;
      this.player.certified = true;
      p.certification.certifiedAt = p.elapsed;
      p.certification.practiceTrial = null;
      emit(
        this,
        "success",
        "Cross-affinity certified. Both wallets and opposing-domain training are now available; no power is granted automatically.",
      );
      commit(this);
      return true;
    },
    toggleVeil() {
      const p = state(this);
      if (busy(this)) return false;
      if (p.veil.state !== "revealed" || this.player.veil)
        return this.breakVeil("Celestial form revealed.");
      if (isConflict(this)) {
        emit(this, "info", "Enter Veil only outside conflict.");
        return false;
      }
      p.veil.state = "transition";
      p.veil.remaining = 2;
      this.player.veil = false;
      emit(this, "info", "Entering disguise: two-second transition.");
      this.publish?.();
      return true;
    },
    breakVeil(reason = "Overt hostile action broke the Veil.") {
      const p = state(this),
        changed = p.veil.state !== "revealed" || this.player.veil;
      p.veil.state = "revealed";
      p.veil.remaining = 0;
      this.player.veil = false;
      if (changed) emit(this, "info", reason);
      return true;
    },
    recordWitnessAction(action = {}) {
      const p = state(this),
        type = action.type || (action.hostile ? "attack" : "suspicious action");
      if (type === "clear") {
        p.veil.exposure = null;
        return true;
      }
      const id = action.incidentId || `incident:${zoneId(this)}:${++p.serial}`;
      let incident = p.veil.incidents.find((i) => i.id === id);
      if (!incident) {
        incident = {
          id,
          type,
          targetId: action.targetId || null,
          zoneId: zoneId(this),
          at: p.elapsed,
          witnesses: [],
          reputationApplied: [],
          repaired: false,
          receiptId: action.receiptId || null,
          restitution: copy(action.restitution || { karma: 25 }),
        };
        p.veil.incidents.push(incident);
      }
      const hostile =
        !!action.hostile || ["attack", "harmful cast"].includes(type);
      if (hostile) {
        this.breakVeil();
        for (const npc of observers(this))
          if (observerSees(this, npc)) witness(this, npc, incident);
      } else
        p.veil.exposure = {
          incidentId: id,
          type,
          zoneId: zoneId(this),
          position: copy(
            action.position || { x: this.player.x, y: this.player.y },
          ),
          radius: Number(action.radius) || 160,
          until: p.elapsed + (Number(action.duration) || 6),
        };
      this.publish?.();
      return id;
    },
    clearSuspiciousAction() {
      state(this).veil.exposure = null;
      return true;
    },
    getReputation(target = "faction:grove-keepers") {
      const p = state(this),
        npc = String(target).startsWith("npc:"),
        id = String(target).replace(/^(npc|faction):/, ""),
        value = (npc ? p.reputation.npcs : p.reputation.factions)[id] || 0;
      return { id, value, tier: reputationTier(value) };
    },
    setReputation(target, delta, reason = "Authored relationship outcome") {
      if (!Number.isFinite(delta)) return false;
      const result = applyStanding(
        this,
        String(target || "faction:grove-keepers"),
        delta,
        reason,
      );
      this.publish?.();
      return result;
    },
    previewRestitution(incidentId) {
      const p = state(this),
        incident = p.veil.incidents.find((i) => i.id === incidentId);
      const invalid = (reason) => ({ valid: false, reason, incidentId });
      if (!incident || incident.repaired)
        return invalid(
          "This incident is absent or has already received its one restitution benefit.",
        );
      if (incident.zoneId !== zoneId(this))
        return invalid(
          "Return to the region where this incident was recorded.",
        );
      const npc = (this.entities || []).find(
        (e) =>
          incident.witnesses.includes(e.id) &&
          !e.dead &&
          distance(e, this.player) <= 120,
      );
      if (!npc)
        return invalid(
          "Approach a living witness to discuss the posted restitution.",
        );
      const wallet = nativeWallet(this),
        materials = incident.restitution.materials || {},
        karma = incident.restitution.materials
          ? 0
          : Math.max(0, Number(incident.restitution.karma) || 25);
      if (
        Object.values(materials).some(
          (count) => !Number.isInteger(count) || count <= 0,
        )
      )
        return invalid("The posted material restitution is invalid.");
      if (
        (this.player[wallet] || 0) < karma ||
        Object.entries(materials).some(
          ([item, count]) => (this.player.inventory?.[item] || 0) < count,
        )
      )
        return invalid(
          "The posted restitution requires more currency or materials.",
        );
      return {
        valid: true,
        reason: "",
        incidentId,
        npcId: npc.id,
        wallet,
        karma,
        materials: copy(materials),
        reputation: 5,
      };
    },
    makeRestitution(incidentId) {
      if (busy(this)) return false;
      const preview = this.previewRestitution(incidentId);
      if (!preview.valid) {
        emit(this, "info", preview.reason);
        return false;
      }
      const p = state(this),
        incident = p.veil.incidents.find((i) => i.id === incidentId);
      this.player[preview.wallet] -= preview.karma;
      for (const [item, count] of Object.entries(preview.materials))
        this.player.inventory[item] -= count;
      incident.repaired = true;
      incident.repairedAt = p.elapsed;
      incident.restitutionReceipt = {
        wallet: preview.wallet,
        karma: preview.karma,
        materials: copy(preview.materials),
      };
      for (const key of incident.reputationApplied)
        applyStanding(this, key, 5, `Restitution for ${incident.type}`);
      emit(
        this,
        "dialogue",
        "Restitution accepted. Reputation improves by five once; witnesses and transaction evidence remain in the journal.",
      );
      commit(this);
      return true;
    },
    negotiate(targetId, incidentId) {
      const p = state(this),
        npc = entityById(this, targetId);
      if (!npc || npc.dead || distance(npc, this.player) > 120 || busy(this))
        return false;
      const incident = p.veil.incidents.find(
        (i) =>
          (!incidentId || i.id === incidentId) &&
          i.witnesses.includes(targetId) &&
          !i.repaired &&
          i.zoneId === zoneId(this),
      );
      if (!incident) {
        emit(
          this,
          "dialogue",
          "There is no unresolved witnessed incident to negotiate. Ordinary conversation does not grant repeatable reputation.",
        );
        return false;
      }
      return this.makeRestitution(incident.id);
    },
  });
}
