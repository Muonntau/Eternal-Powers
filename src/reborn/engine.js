import { ZONES } from "../data/manual.js";
import { createRegion, isBlocked } from "./world.js";
import { POWER_CATALOG, starterLoadout, starterUnlocked } from "./catalog.js";

export const REBORN_SAVE_KEY = "eternal-powers-reborn-v1";
const TAU = Math.PI * 2,
  clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const clone = (v) => structuredClone(v);
const circleLine = (p, a, b, r) => {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    l = dx * dx + dy * dy,
    t = l ? clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / l, 0, 1) : 0;
  return Math.hypot(p.x - a.x - dx * t, p.y - a.y - dy * t) <= r;
};
const powers = Array.isArray(POWER_CATALOG)
  ? POWER_CATALOG
  : Object.values(POWER_CATALOG);
const powerMap = new Map(powers.map((p) => [p.id, p]));
const KITS = {
  stormweaver: "air-move",
  emberborn: "fire-destroy",
  tidecaller: "water-grow",
  stoneguard: "earth-give",
};
const freshPlayer = () => ({
  name: "Wayfarer",
  lineage: "angel",
  appearance: {},
  characterCreated: false,
  x: 620,
  y: 1050,
  health: 120,
  maxHealth: 120,
  essence: 100,
  maxEssence: 100,
  shield: 0,
  level: 1,
  xp: 0,
  xpToNext: 90,
  shards: 3,
  potions: 4,
  ultimate: 65,
  facing: 0,
  walking: false,
  invulnerableUntil: 0,
});
const freshStats = () => ({
  kills: 0,
  elites: 0,
  bosses: 0,
  chests: 0,
  combo: 0,
  bestCombo: 0,
  damage: 0,
  casts: 0,
  rifts: 0,
  discoveries: 0,
});
const shape = (p) => ({ x: p.x, y: p.y });

/** A new action-mode simulation. All manual powers are adapted into immediate,
 * physical action profiles. This save and its economy are separate from Classic. */
export class RebornEngine {
  constructor(
    canvas = null,
    {
      onUpdate = () => {},
      onEvent = () => {},
      storage = globalThis.localStorage,
      renderer = null,
      headless = !canvas,
    } = {},
  ) {
    this.canvas = canvas;
    this.onUpdate = onUpdate;
    this.onEvent = onEvent;
    this.storage = storage;
    this.renderer = renderer;
    this.headless = headless;
    this.player = freshPlayer();
    this.stats = freshStats();
    this.keys = new Set();
    this.aim = { x: 1000, y: 1050 };
    this.pointer = this.aim;
    this.camera = { x: 0, y: 0 };
    this.time = 0;
    this.serial = 0;
    this.cooldowns = {};
    this.slots = [];
    this.unlocked = new Set();
    this.visited = new Set(["sacred-groves"]);
    this.regionProgress = {};
    this.chestClaims = {};
    this.zoneId = "sacred-groves";
    this.projectiles = [];
    this.effects = [];
    this.particles = [];
    this.loot = [];
    this.floatingTexts = [];
    this.summons = [];
    this.notices = [];
    this.rift = null;
    this.waypoint = null;
    this.paused = false;
    this.inputBlocked = false;
    this.running = false;
    this.selectedSlot = 0;
    this.mouseButtons = new Set();
    this.lastDash = -100;
    this.lastCombo = -100;
    this.lastImpact = -100;
    this.lastPickup = -100;
    this._saveElapsed = 0;
    this._publishElapsed = 0;
    this.shake = 0;
    this.flash = 0;
    this.deathUntil = 0;
    this.load();
    this.installRegion(this.zoneId, false);
    if (this._recoverOnLoad) {
      Object.assign(this.player, shape(this.world.spawn), {
        health: this.player.maxHealth,
        essence: this.player.maxEssence,
        shield: 0,
        invulnerableUntil: this.time + 2,
      });
      this.player.potions = Math.max(2, this.player.potions);
      this._recoverOnLoad = false;
    }
    this.bindEvents();
    this.publish();
  }
  setRenderer(renderer) {
    this.renderer = renderer;
    return this;
  }
  get entities() {
    return [
      ...this.enemies,
      ...this.world.props,
      ...this.world.chests,
      ...this.world.portals,
      ...(this.world.features || []),
    ];
  }
  get unlockedPowers() {
    return [...this.unlocked];
  }
  get discoveredZones() {
    return [...this.visited];
  }
  progressFor(id = this.zoneId) {
    return (this.regionProgress[id] ||= {
      kills: 0,
      bosses: 0,
      chests: 0,
      rifts: 0,
      discoveries: [],
      completed: false,
    });
  }
  installRegion(id, arrival = true) {
    const region = createRegion(id, { seed: 0 });
    this.world = region;
    this.region = region;
    this.zone = region;
    this.zoneId = region.id || id;
    region.props ||= [];
    region.chests ||= [];
    region.portals ||= [];
    region.features ||= [];
    region.challenges ||= [];
    region.obstacles ||= [];
    this.enemies = (region.enemies || []).map((e, i) => ({
      ...e,
      id: e.id || `${id}:enemy:${i}`,
      kind: "enemy",
      health: e.health || e.maxHealth || 90,
      maxHealth: e.maxHealth || e.health || 90,
      home: e.home || shape(e),
      damage: e.damage || 10,
      speed: e.speed || 85,
      aggroRange: e.aggroRange || 450,
      attackRange: e.attackRange || 65,
      attackCooldown: e.attackCooldown || 2,
      archetype: e.archetype || e.behavior || "melee",
      radius: e.radius || 20,
      state: "idle",
      stateTime: 0,
      attackAt: 0,
      statuses: [],
      generation: 0,
      dead: false,
    }));
    region.enemies = this.enemies;
    for (const p of region.props) {
      if (p.destructible) {
        p.health ??= p.maxHealth || 36;
        p.maxHealth ??= p.health;
      }
      p.charge = 0;
    }
    for (const chest of region.chests)
      chest.opened = !!this.chestClaims[chest.id];
    const spawn = region.spawn || { x: 620, y: 1050 };
    if (
      arrival ||
      !Number.isFinite(this.player.x) ||
      this.blocked(this.player.x, this.player.y, 16)
    ) {
      this.player.x = spawn.x;
      this.player.y = spawn.y;
    }
    this.aim = { x: this.player.x + 200, y: this.player.y };
    this.pointer = this.aim;
    this.camera = { x: 0, y: 0 };
    this.projectiles = [];
    this.effects = [];
    this.loot = [];
    this.summons = [];
    this.rift = null;
    this.waypoint = null;
    this.mouseButtons.clear();
    this.keys.clear();
    this.destination = null;
    this.progressFor();
    this.visited.add(this.zoneId);
  }
  createCharacter(draft = {}) {
    if (this.player.characterCreated) return false;
    const name = String(draft.name || "Wayfarer")
      .trim()
      .slice(0, 24);
    if (name.length < 2) {
      this.notice("Choose a name with at least two characters.");
      return false;
    }
    const lineage = draft.lineage === "demon" ? "demon" : "angel",
      kit = String(draft.kit || "")
        .toLowerCase()
        .replace(/[^a-z]/g, "");
    const branch =
      draft.starterBranch ||
      KITS[kit] ||
      (lineage === "demon" ? "fire-destroy" : "air-move");
    const starter = powerMap.get(`${branch}-1`);
    if (!starter) return false;
    Object.assign(this.player, {
      name,
      lineage,
      appearance: clone(draft.appearance || {}),
      characterCreated: true,
      starterBranch: branch,
      kit: kit || branch,
    });
    this.unlocked = new Set(starterUnlocked(branch));
    for (const p of powers) if (p.level === 1) this.unlocked.add(p.id);
    this.unlocked.add(`${branch}-8`);
    this.slots = starterLoadout(branch, lineage).slice(0, 6);
    while (this.slots.length < 6)
      this.slots.push(
        powers.filter((p) => p.level === 1)[this.slots.length].id,
      );
    this.slots[5] = `${branch}-8`;
    this.player.ultimate = 100;
    this.paused = false;
    this.emit("create", { text: `${name}, your powers are ready.` });
    this.save();
    this.publish();
    return true;
  }
  blocked(x, y, radius = 16) {
    return (
      !Number.isFinite(x) ||
      !Number.isFinite(y) ||
      x < radius + 8 ||
      y < radius + 8 ||
      x > (this.world?.width || 2800) - radius - 8 ||
      y > (this.world?.height || 2000) - radius - 8 ||
      isBlocked(this.world, x, y, radius)
    );
  }
  move(actor, dx, dy, radius = actor.radius || 16) {
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 12));
    let moved = false;
    for (let i = 0; i < steps; i++) {
      if (!this.blocked(actor.x + dx / steps, actor.y, radius)) {
        actor.x += dx / steps;
        moved = true;
      }
      if (!this.blocked(actor.x, actor.y + dy / steps, radius)) {
        actor.y += dy / steps;
        moved = true;
      }
    }
    return moved;
  }
  setZone(id) {
    if (
      !ZONES.some((z) => z.id === id) ||
      !this.player.characterCreated ||
      this.deathUntil > this.time
    )
      return false;
    this.installRegion(id);
    this.player.invulnerableUntil = this.time + 2;
    this.player.health = Math.max(
      this.player.health,
      this.player.maxHealth * 0.65,
    );
    this.player.essence = this.player.maxEssence;
    this.notice(
      `${this.world.name} · new creatures, relics and a rift await.`,
      "travel",
    );
    this.emit("travel", { text: this.world.name });
    this.save();
    this.publish();
    return true;
  }
  pause(value = true) {
    this.paused = !!value;
    this.keys.clear();
    this.mouseButtons.clear();
    this.publish();
    return this.paused;
  }
  setPaused(value) {
    return this.pause(value);
  }
  power(id) {
    return powerMap.get(id) || null;
  }
  equipPower(slot, id) {
    if (
      !Number.isInteger(slot) ||
      slot < 0 ||
      slot > 5 ||
      !this.unlocked.has(id) ||
      !powerMap.has(id)
    )
      return false;
    this.slots[slot] = id;
    this.selectedSlot = slot;
    this.save();
    this.publish();
    this.emit("equip", { text: `${powerMap.get(id).name} equipped.` });
    return true;
  }
  unlockPower(id) {
    const p = powerMap.get(id);
    if (!p || this.unlocked.has(id)) return false;
    const price = clamp(Number(p.unlockCost) || Math.ceil(p.level / 2), 1, 5);
    if (this.player.shards < price) {
      this.notice(`Find ${price - this.player.shards} more power shards.`);
      return false;
    }
    this.player.shards -= price;
    this.unlocked.add(id);
    this.notice(`${p.name} unlocked. Equip it in any slot.`, "unlock");
    this.emit("unlock", { domain: p.domain, text: p.name });
    this.save();
    this.publish();
    return true;
  }
  castSlot(index = 0, aimX = this.aim.x, aimY = this.aim.y) {
    if (
      this.paused ||
      this.inputBlocked ||
      !this.player.characterCreated ||
      this.deathUntil > this.time ||
      !Number.isInteger(index) ||
      index < 0 ||
      index > 5
    )
      return false;
    const p = this.power(this.slots[index]);
    if (
      !p ||
      !this.unlocked.has(p.id) ||
      (this.cooldowns[p.id] || 0) > this.time
    )
      return false;
    const ultimate = p.ultimate || p.level >= 8,
      cost = Number(p.cost ?? p.essenceCost ?? 6);
    if (ultimate && this.player.ultimate < 100) {
      this.notice("Build your ultimate by fighting and using powers.");
      return false;
    }
    if (!ultimate && this.player.essence < cost) {
      if (this.time - (this._emptyAt || -100) > 1) {
        this.notice("Essence is recharging — keep moving.");
        this._emptyAt = this.time;
      }
      return false;
    }
    if (!Number.isFinite(aimX) || !Number.isFinite(aimY)) return false;
    const range = Number(p.range) || 750,
      dx = aimX - this.player.x,
      dy = aimY - this.player.y,
      d = Math.hypot(dx, dy) || 1,
      angle = Math.atan2(dy, dx),
      at = {
        x: this.player.x + (dx / d) * Math.min(d, range),
        y: this.player.y + (dy / d) * Math.min(d, range),
      };
    const style = p.style || p.archetype || "bolt",
      element = String(
        p.element || p.affinity || p.domain || "light",
      ).toLowerCase(),
      damage =
        (Number(p.damage) || 24 + p.level * 5) *
        (1 + (this.player.level - 1) * 0.045);
    this.selectedSlot = index;
    this.player.facing = angle;
    this.aim = { x: aimX, y: aimY };
    this.pointer = this.aim;
    if (ultimate) this.player.ultimate = 0;
    else {
      this.player.essence -= cost;
      this.player.ultimate = clamp(this.player.ultimate + 2.5, 0, 100);
    }
    this.cooldowns[p.id] =
      this.time + Math.max(0.2, Number(p.cooldown) || 0.45);
    this.stats.casts++;
    const color = p.color || "#85e4ff",
      profile = {
        activationId: ++this.serial,
        powerId: p.id,
        element,
        color,
        damage,
        level: p.level,
        status: p.status,
        ultimate,
        owner: "player",
      };
    this.fx("cast", this.player, {
      color,
      radius: 32,
      angle,
      element,
      duration: 0.25,
    });
    if (style === "dash") {
      const start = shape(this.player),
        length = Math.min(d, ultimate ? 380 : 250);
      this.move(
        this.player,
        Math.cos(angle) * length,
        Math.sin(angle) * length,
      );
      this.player.invulnerableUntil = this.time + 0.36;
      this.fx("dash", start, {
        ...profile,
        radius: 35,
        duration: 0.45,
        targetX: this.player.x,
        targetY: this.player.y,
        angle,
      });
      for (const e of this.enemies)
        if (!e.dead && circleLine(e, start, this.player, e.radius + 42))
          this.damageEnemy(e, damage, profile);
      this.hitProps(at, damage, 95, profile);
    } else if (style === "beam") {
      const end = {
        x: this.player.x + Math.cos(angle) * range,
        y: this.player.y + Math.sin(angle) * range,
      };
      let last = shape(this.player);
      for (let i = 1; i <= Math.ceil(range / 15); i++) {
        const t = i / Math.ceil(range / 15),
          candidate = {
            x: this.player.x + (end.x - this.player.x) * t,
            y: this.player.y + (end.y - this.player.y) * t,
          };
        if (this.blocked(candidate.x, candidate.y, 2)) break;
        last = candidate;
      }
      this.fx("beam", this.player, {
        ...profile,
        radius: ultimate ? 26 : 13,
        duration: 0.32,
        targetX: last.x,
        targetY: last.y,
        angle,
      });
      for (const e of this.enemies)
        if (
          !e.dead &&
          circleLine(e, this.player, last, e.radius + (ultimate ? 35 : 20))
        )
          this.damageEnemy(e, damage, profile);
      for (const prop of this.world.props)
        if (
          !prop.destroyed &&
          prop.destructible &&
          circleLine(prop, this.player, last, (prop.radius || 20) + 15)
        )
          this.damageProp(prop, damage, profile);
      this.activateFeatures(last, profile);
    } else if (style === "nova") {
      const radius =
        Math.max(85, Number(p.radius) || 130) * (ultimate ? 1.65 : 1);
      this.areaDamage(at, radius, damage, profile);
      this.fx("nova", at, { ...profile, radius, duration: 0.65 });
    } else if (style === "chain") {
      const nearest = this.enemies
        .filter(
          (e) => !e.dead && dist(e, at) < 240 && dist(e, this.player) < range,
        )
        .sort((a, b) => dist(a, at) - dist(b, at))[0];
      let from = shape(this.player);
      const struck = new Set();
      for (let i = 0; i < (ultimate ? 8 : 3 + Math.floor(p.level / 3)); i++) {
        const target =
          i === 0
            ? nearest
            : this.enemies
                .filter(
                  (e) => !e.dead && !struck.has(e.id) && dist(e, from) < 270,
                )
                .sort((a, b) => dist(a, from) - dist(b, from))[0];
        if (!target) break;
        this.fx("chain", from, {
          ...profile,
          targetX: target.x,
          targetY: target.y,
          radius: 8,
          duration: 0.4,
        });
        this.damageEnemy(target, damage * (1 - i * 0.06), profile);
        struck.add(target.id);
        from = shape(target);
      }
      if (!nearest)
        this.fx("chain", this.player, {
          ...profile,
          targetX: at.x,
          targetY: at.y,
          radius: 8,
          duration: 0.25,
        });
      this.hitProps(at, damage, 90, profile);
      this.activateFeatures(at, profile);
    } else if (style === "orbit") {
      this.player.shield = clamp(this.player.shield + 25 + p.level * 5, 0, 100);
      this.effects.push({
        id: ++this.serial,
        type: "orbit",
        kind: "orbit",
        x: this.player.x,
        y: this.player.y,
        ...profile,
        radius: Math.max(95, Number(p.radius) || 110),
        age: 0,
        duration: ultimate ? 7 : 4,
        nextTick: 0,
      });
      this.areaDamage(this.player, 110, damage * 0.65, profile);
    } else if (style === "summon") {
      const count = ultimate ? 3 : 1;
      for (let i = 0; i < count; i++)
        this.summons.push({
          id: ++this.serial,
          ...profile,
          x: this.player.x + Math.cos((i * TAU) / count) * 45,
          y: this.player.y + Math.sin((i * TAU) / count) * 45,
          angle: (i * TAU) / count,
          life: ultimate ? 12 : 8,
          nextShot: this.time + 0.2,
          damage: damage * 0.6,
        });
      this.fx("summon", at, { ...profile, radius: 80, duration: 0.7 });
      this.areaDamage(at, 85, damage * 0.5, profile);
    } else {
      const count = ultimate ? 7 : p.level >= 5 ? 3 : 1;
      for (let i = 0; i < count; i++) {
        const spread = (i - (count - 1) / 2) * (ultimate ? 0.13 : 0.12),
          a = angle + spread,
          speed = Number(p.speed) || 780;
        this.projectiles.push({
          id: ++this.serial,
          ...profile,
          x: this.player.x + Math.cos(a) * 22,
          y: this.player.y + Math.sin(a) * 22,
          vx: Math.cos(a) * speed,
          vy: Math.sin(a) * speed,
          radius: ultimate ? 13 : 8,
          life: range / speed + 0.1,
          trail: [],
          pierce: ultimate ? 3 : p.level >= 5 ? 1 : 0,
          hitIds: [],
        });
      }
    }
    if (element === "water" || /dark-heal|love-laugh/.test(p.branchId || p.id))
      this.player.health = Math.min(
        this.player.maxHealth,
        this.player.health + 5 + p.level,
      );
    if (ultimate) {
      this.shake = Math.max(this.shake, 0.55);
      this.flash = 0.16;
      this.notice(`${p.name} · unleash your ultimate!`, "ultimate");
    }
    this.emit("cast", {
      domain: p.domain || p.affinity,
      element,
      color,
      powerId: p.id,
      ultimate,
      text: p.name,
    });
    this.publish();
    return true;
  }
  dash(aimX, aimY) {
    if (
      this.paused ||
      this.inputBlocked ||
      !this.player.characterCreated ||
      this.deathUntil > this.time ||
      this.time - this.lastDash < 1.35
    )
      return false;
    let dx = 0,
      dy = 0;
    if (Number.isFinite(aimX) && Number.isFinite(aimY)) {
      dx = aimX - this.player.x;
      dy = aimY - this.player.y;
    } else {
      dx =
        Number(this.keys.has("d") || this.keys.has("arrowright")) -
        Number(this.keys.has("a") || this.keys.has("arrowleft"));
      dy =
        Number(this.keys.has("s") || this.keys.has("arrowdown")) -
        Number(this.keys.has("w") || this.keys.has("arrowup"));
      if (!dx && !dy) {
        dx = this.aim.x - this.player.x;
        dy = this.aim.y - this.player.y;
      }
    }
    const d = Math.hypot(dx, dy) || 1,
      start = shape(this.player);
    this.move(this.player, (dx / d) * 210, (dy / d) * 210);
    this.player.invulnerableUntil = this.time + 0.32;
    this.player.dashUntil = this.time + 0.22;
    this.lastDash = this.time;
    this.fx("dash", start, {
      targetX: this.player.x,
      targetY: this.player.y,
      angle: Math.atan2(dy, dx),
      color: "#b5f4ff",
      radius: 24,
      duration: 0.38,
    });
    this.shake = Math.max(this.shake, 0.12);
    this.emit("dash");
    this.publish();
    return true;
  }
  fx(type, at, values = {}) {
    this.effects.push({
      id: ++this.serial,
      type,
      kind: type,
      x: at.x,
      y: at.y,
      age: 0,
      duration: 0.45,
      radius: 45,
      color: "#a8eeff",
      ...values,
    });
  }
  text(at, text, color = "#fff") {
    this.floatingTexts.push({
      id: ++this.serial,
      x: at.x,
      y: at.y - 25,
      text: String(text),
      color,
      life: 1,
      maxLife: 1,
    });
  }
  areaDamage(at, radius, amount, profile) {
    for (const e of this.enemies)
      if (!e.dead && dist(e, at) < radius + e.radius)
        this.damageEnemy(e, amount, profile);
    this.hitProps(at, amount, radius, profile);
    this.activateFeatures(at, profile, radius);
  }
  hitProps(at, damage, radius, profile) {
    for (const p of this.world.props)
      if (
        p.destructible &&
        !p.destroyed &&
        dist(p, at) < radius + (p.radius || 20)
      )
        this.damageProp(p, damage, profile);
  }
  damageProp(prop, amount, profile = {}) {
    if (prop.destroyed || !prop.destructible) return false;
    prop.health -=
      amount *
      (prop.kind === "explosive" && profile.element === "fire" ? 2 : 1);
    this.fx("impact", prop, {
      color: profile.color || "#d6d2b5",
      radius: 30,
      element: profile.element,
    });
    if (prop.health <= 0) {
      prop.destroyed = true;
      prop.respawnAt = this.time + 45;
      this.drop(prop, {
        kind: "shard",
        amount: prop.kind === "crystal" ? 3 : 1,
      });
      if (prop.kind === "crystal") {
        this.player.essence = this.player.maxEssence;
        this.player.ultimate = clamp(this.player.ultimate + 20, 0, 100);
        this.text({ ...prop, y: prop.y - 25 }, "ESSENCE SURGE", "#c8b0ff");
      }
      if (prop.kind === "spring") {
        this.player.health = Math.min(
          this.player.maxHealth,
          this.player.health + 40,
        );
        this.fx("heal", prop, { radius: 130, color: "#99f4be", duration: 0.9 });
        this.text({ ...prop, y: prop.y - 25 }, "+40 VITALITY", "#b0ffd0");
      }
      if (prop.kind === "totem") {
        this.fx("nova", prop, {
          radius: 180,
          color: "#b2f0ff",
          duration: 0.75,
        });
        for (const e of this.enemies)
          if (!e.dead && dist(e, prop) < 180)
            this.damageEnemy(e, 45, {
              ...profile,
              element: "light",
              status: "shock",
            });
      }
      this.text(prop, "BREAK", "#d4efff");
      if (/barrel|explosive|volatile/.test(prop.kind || prop.type || "")) {
        this.fx("explosion", prop, {
          color: "#ffad6e",
          radius: 155,
          duration: 0.65,
        });
        this.shake = 0.35;
        for (const e of this.enemies)
          if (!e.dead && dist(e, prop) < 165)
            this.damageEnemy(e, 65, {
              ...profile,
              element: "fire",
              explosion: true,
            });
      }
    }
    return true;
  }
  damageEnemy(enemy, amount, profile = {}) {
    if (enemy.dead || !Number.isFinite(amount)) return false;
    const element = profile.element || "light",
      status =
        profile.status ||
        {
          fire: "burn",
          water: "chill",
          air: "shock",
          love: "charm",
          hate: "vulnerable",
          dark: "drain",
          earth: "stagger",
          light: "shock",
        }[element];
    let damage = amount,
      combo = null;
    const prior = (enemy.statuses ||= []);
    const has = (s) => prior.some((x) => x.type === s && x.until > this.time);
    if (!profile.dot) {
      if (element === "fire" && has("chill")) {
        damage *= 1.8;
        combo = "THERMAL SHOCK";
        enemy.statuses = prior.filter((x) => x.type !== "chill");
      } else if ((element === "air" || element === "light") && has("chill")) {
        damage *= 1.5;
        combo = "CONDUCT";
      } else if (element === "earth" && has("chill")) {
        damage *= 1.75;
        combo = "SHATTER";
        enemy.statuses = prior.filter((x) => x.type !== "chill");
      } else if (element === "earth" && has("burn")) {
        damage *= 1.6;
        combo = "MOLTEN IMPACT";
      } else if (element === "dark" && has("vulnerable")) {
        damage *= 1.5;
        combo = "SOUL RUPTURE";
      }
      if (has("vulnerable")) damage *= 1.2;
      if (status && !["drain"].includes(status)) {
        const existing = enemy.statuses.find((s) => s.type === status);
        if (existing)
          existing.until =
            this.time +
            (status === "burn" ? 3 : status === "stagger" ? 0.6 : 2.5);
        else
          enemy.statuses.push({
            type: status,
            until:
              this.time +
              (status === "burn" ? 3 : status === "stagger" ? 0.6 : 2.5),
            nextTick: this.time + 0.6,
            damage: Math.max(2, amount * 0.12),
          });
      }
      if (element === "air" || element === "earth") {
        const dx = enemy.x - this.player.x,
          dy = enemy.y - this.player.y,
          d = Math.hypot(dx, dy) || 1;
        this.move(
          enemy,
          (dx / d) * (enemy.boss ? 9 : 28),
          (dy / d) * (enemy.boss ? 9 : 28),
          enemy.radius,
        );
      }
      if (element === "dark")
        this.player.health = Math.min(
          this.player.maxHealth,
          this.player.health + Math.max(2, damage * 0.06),
        );
      if (combo) {
        this.text({ ...enemy, y: enemy.y - 26 }, combo, "#ffe0a6");
        this.player.ultimate = clamp(this.player.ultimate + 8, 0, 100);
        this.shake = Math.max(this.shake, 0.18);
        this.emit("combo", { text: combo, element });
      }
    }
    damage = Math.max(1, Math.round(damage));
    enemy.health = Math.max(0, enemy.health - damage);
    enemy.hitUntil = this.time + 0.16;
    enemy.state = enemy.state === "idle" ? "chase" : enemy.state;
    this.stats.damage += damage;
    this.text(
      enemy,
      damage,
      profile.dot ? "#fbb476" : enemy.boss ? "#ffe9bc" : "#ecf7ff",
    );
    this.fx("impact", enemy, {
      radius: profile.ultimate ? 55 : 25,
      color: profile.color || "#fff",
      element,
      duration: 0.24,
    });
    if (!profile.dot) {
      this.player.ultimate = clamp(this.player.ultimate + 1.5, 0, 100);
      this.shake = Math.max(this.shake, profile.ultimate ? 0.28 : 0.07);
      if (this.time - this.lastImpact > 0.07) {
        this.emit("impact", {
          element,
          domain: element[0].toUpperCase() + element.slice(1),
          color: profile.color,
        });
        this.lastImpact = this.time;
      }
    }
    if (enemy.health <= 0) this.killEnemy(enemy);
    return damage;
  }
  killEnemy(enemy) {
    if (enemy.dead) return false;
    enemy.dead = true;
    enemy.state = "dead";
    enemy.diedAt = this.time;
    enemy.respawnAt =
      this.time +
      (enemy.riftSpawn ? 99999 : enemy.boss ? 100 : enemy.elite ? 55 : 30);
    enemy.telegraph = null;
    this.stats.kills++;
    this.stats.elites += enemy.elite ? 1 : 0;
    this.stats.bosses += enemy.boss ? 1 : 0;
    this.stats.combo =
      this.time - this.lastCombo < 6 ? this.stats.combo + 1 : 1;
    this.lastCombo = this.time;
    this.stats.bestCombo = Math.max(this.stats.bestCombo, this.stats.combo);
    const progress = this.progressFor();
    progress.kills++;
    if (enemy.boss) progress.bosses++;
    const xp = Number(enemy.xp) || (enemy.boss ? 180 : enemy.elite ? 65 : 28),
      shards = enemy.boss ? 8 : enemy.elite ? 3 : 1;
    this.drop(enemy, { kind: "xp", amount: xp });
    this.drop({ ...enemy, x: enemy.x + 14 }, { kind: "shard", amount: shards });
    if (this.stats.kills % 5 === 0)
      this.drop({ ...enemy, x: enemy.x - 12 }, { kind: "health", amount: 25 });
    this.player.ultimate = clamp(
      this.player.ultimate + (enemy.boss ? 35 : enemy.elite ? 15 : 8),
      0,
      100,
    );
    this.fx("defeat", enemy, {
      color: enemy.color || "#bceaff",
      radius: enemy.boss ? 100 : 45,
      duration: 0.7,
    });
    if (this.stats.combo >= 3)
      this.text(
        { ...enemy, y: enemy.y - 45 },
        `${this.stats.combo} CHAIN`,
        "#8ef8e3",
      );
    if (enemy.boss) {
      this.notice(
        `${enemy.name} defeated · guardian rewards released.`,
        "boss",
      );
      this.emit("bossDefeated", { text: enemy.name });
      this.shake = 0.5;
    }
    if (enemy.riftSpawn && this.rift?.status === "active") {
      this.rift.kills++;
      this.rift.waveKills++;
    }
    this.checkRift();
    this.publish();
    return true;
  }
  drop(at, { kind, amount }) {
    this.loot.push({
      id: ++this.serial,
      kind,
      x: at.x,
      y: at.y,
      amount,
      age: 0,
      life: 45,
      color:
        kind === "xp" ? "#8edbf7" : kind === "health" ? "#f5a0ad" : "#d2b0ff",
    });
  }
  gainXP(amount) {
    this.player.xp += Math.max(0, amount);
    let levels = 0;
    while (this.player.xp >= this.player.xpToNext) {
      this.player.xp -= this.player.xpToNext;
      this.player.level++;
      this.player.xpToNext = 70 + this.player.level * 35;
      this.player.maxHealth += 8;
      this.player.health = Math.min(
        this.player.maxHealth,
        this.player.health + 40,
      );
      this.player.essence = this.player.maxEssence;
      this.player.shards += 3;
      this.player.ultimate = clamp(this.player.ultimate + 20, 0, 100);
      levels++;
    }
    if (levels) {
      this.notice(
        `Level ${this.player.level} · +3 power shards, vitality restored.`,
        "levelup",
      );
      this.fx("levelup", this.player, {
        radius: 130,
        color: "#ffe5a8",
        duration: 1.1,
      });
      this.emit("levelup", { level: this.player.level });
      this.save();
    }
  }
  damagePlayer(amount, source) {
    if (
      this.player.invulnerableUntil > this.time ||
      this.deathUntil > this.time
    )
      return false;
    let damage = Math.max(0, amount);
    const absorbed = Math.min(this.player.shield, damage);
    this.player.shield -= absorbed;
    damage -= absorbed;
    this.player.health = Math.max(0, this.player.health - damage);
    this.player.invulnerableUntil = this.time + 0.35;
    this.flash = 0.16;
    this.shake = 0.18;
    this.text(
      this.player,
      damage ? `−${Math.round(damage)}` : "GUARD",
      damage ? "#ff9fae" : "#9eeaf1",
    );
    this.emit("hurt", { damage });
    if (this.player.health <= 0) {
      this.deathUntil = this.time + 2.2;
      this.player.walking = false;
      this.keys.clear();
      this.mouseButtons.clear();
      this.stats.combo = 0;
      // A fallen form cannot keep dealing damage while its replacement reforms.
      this.projectiles = [];
      this.summons = [];
      this.effects = this.effects.filter((effect) => effect.type !== "orbit");
      this.notice(
        "Your form is reforming at the sanctuary. Your powers and loot are safe.",
        "defeat",
      );
      this.emit("defeat");
      if (this.rift?.status === "active") this.failRift();
    }
    this.publish();
    return true;
  }
  usePotion() {
    if (
      this.paused ||
      this.deathUntil > this.time ||
      this.player.potions <= 0 ||
      this.player.health >= this.player.maxHealth
    )
      return false;
    this.player.potions--;
    this.player.health = Math.min(
      this.player.maxHealth,
      this.player.health + 65,
    );
    this.fx("heal", this.player, {
      color: "#99f4bb",
      radius: 70,
      duration: 0.8,
    });
    this.notice("Vitality restored.");
    this.emit("pickup", { kind: "health" });
    this.save();
    this.publish();
    return true;
  }
  activateFeatures(at, profile, radius = 110) {
    for (const f of this.world.features) {
      if (
        ["hub", "bridge"].includes(f.kind) ||
        f.kind === "landmark" ||
        dist(f, at) > radius + (f.radius || 40) ||
        (profile.activationId && f.lastActivationId === profile.activationId)
      )
        continue;
      f.lastActivationId = profile.activationId;
      const progress = this.progressFor();
      if (progress.discoveries.includes(f.id)) continue;
      f.charge = (f.charge || 0) + 1;
      this.fx("resonance", f, {
        color: profile.color,
        radius: 70,
        duration: 0.7,
      });
      if (f.charge >= 2) {
        progress.discoveries.push(f.id);
        this.stats.discoveries++;
        this.player.shards += 2;
        this.player.ultimate = clamp(this.player.ultimate + 20, 0, 100);
        this.player.essence = this.player.maxEssence;
        this.text(f, "+2 SHARDS · RESONANCE", "#d8c2ff");
        this.notice(
          `${f.name || "Ancient conduit"} awakened. +2 power shards.`,
          "discovery",
        );
        this.emit("chest", { text: f.name });
        this.save();
      }
    }
  }
  nearestInteractable() {
    const list = [
      ...this.world.chests
        .filter((c) => !c.opened)
        .map((c) => ({
          ...c,
          kind: "chest",
          prompt:
            c.bossLocked && !this.progressFor().bosses
              ? "Defeat the guardian to unseal this cache"
              : "Open relic cache",
        })),
      ...this.world.portals.map((p) => ({
        ...p,
        kind: "portal",
        prompt: "Travel between regions",
      })),
      ...this.world.challenges.map((c) => ({
        ...c,
        kind: "rift",
        prompt:
          this.rift?.status === "active"
            ? "Rift in progress"
            : "Open creature rift",
      })),
      ...this.world.features
        .filter((f) => /hub|shrine|spring|sanctuary/.test(f.kind || ""))
        .map((f) => ({
          ...f,
          kind: "shrine",
          prompt: "Restore vitality and Essence",
        })),
    ];
    return (
      list
        .filter((n) => dist(n, this.player) < 105 + (n.radius || 0))
        .sort((a, b) => dist(a, this.player) - dist(b, this.player))[0] || null
    );
  }
  interact() {
    if (this.paused || this.inputBlocked || this.deathUntil > this.time)
      return false;
    const n = this.nearestInteractable();
    if (!n) {
      this.notice("Explore for relic caches, glowing conduits and rifts.");
      return false;
    }
    if (n.kind === "chest") return this.claimChest(n.id);
    if (n.kind === "rift") return this.startRift(n.id);
    if (n.kind === "portal") {
      if (n.destination) return this.setZone(n.destination);
      this.emit("open-travel", { text: "Choose a region." });
      return true;
    }
    if (n.kind === "shrine") {
      this.player.health = this.player.maxHealth;
      this.player.essence = this.player.maxEssence;
      this.player.potions = Math.max(4, this.player.potions);
      this.fx("heal", this.player, {
        radius: 100,
        color: "#c8fff1",
        duration: 0.8,
      });
      this.notice("Sanctuary restored your vitality, Essence and draughts.");
      this.save();
      this.publish();
      return true;
    }
    return false;
  }
  claimChest(id) {
    const chest = this.world.chests.find((c) => c.id === id);
    if (
      !chest ||
      chest.opened ||
      this.chestClaims[id] ||
      dist(chest, this.player) > 125 ||
      this.deathUntil > this.time
    )
      return false;
    if (chest.bossLocked && !this.progressFor().bosses) {
      this.notice("Defeat this region's guardian to unseal its relic cache.");
      return false;
    }
    chest.opened = true;
    this.chestClaims[id] = true;
    const reward = ["legendary", "epic"].includes(chest.rarity)
      ? 8
      : chest.rarity === "rare"
        ? 5
        : 3;
    this.player.shards += reward;
    this.player.potions = Math.min(9, this.player.potions + 1);
    this.player.ultimate = clamp(this.player.ultimate + 25, 0, 100);
    this.gainXP(30);
    this.stats.chests++;
    this.progressFor().chests++;
    this.fx("chest", chest, { radius: 110, color: "#ffe0a2", duration: 1 });
    this.text(chest, `+${reward} POWER SHARDS`, "#e5c6ff");
    this.notice(
      `Relic cache · ${reward} power shards and a vitality draught.`,
      "chest",
    );
    this.emit("chest", { text: "Relic cache" });
    this.save();
    this.publish();
    return true;
  }
  trackRift() {
    if (!this.player.characterCreated || this.deathUntil > this.time)
      return false;
    const site = this.world.challenges[0];
    if (!site) return false;
    this.waypoint = {
      id: site.id,
      x: site.x,
      y: site.y,
      name: site.name || "Creature Rift",
      kind: "rift",
    };
    this.notice("Follow the rift marker, then open it when you arrive.");
    this.publish();
    return true;
  }
  startRift(id) {
    if (
      this.paused ||
      this.deathUntil > this.time ||
      this.rift?.status === "active"
    )
      return false;
    const site =
      this.world.challenges.find((c) => !id || c.id === id) ||
      this.world.challenges[0];
    if (!site) {
      this.notice("Find a creature rift in this region.");
      return false;
    }
    if (dist(site, this.player) > 160 + (site.radius || 0)) {
      this.notice("Approach the rift to open it.");
      return false;
    }
    this.waypoint = null;
    // Completed rift creatures never renew. Discard their runtime bodies before
    // another challenge, keeping repeated attempts bounded during long sessions.
    this.enemies = this.enemies.filter((enemy) => !enemy.riftSpawn);
    this.world.enemies = this.enemies;
    this.projectiles = this.projectiles.filter(
      (projectile) => projectile.owner !== "enemy",
    );
    this.rift = {
      id: site.id,
      x: site.x,
      y: site.y,
      wave: 0,
      waves: 3,
      kills: 0,
      waveKills: 0,
      total: 15,
      status: "active",
      endsAt: this.time + 100,
      nextWaveAt: this.time + 0.8,
      reward: 8,
    };
    this.notice(
      "Rift opened · three waves. Keep moving and combine your powers.",
      "rift",
    );
    this.emit("rift", { wave: 0 });
    this.fx("rift", site, { radius: 150, color: "#c5a0ff", duration: 1.2 });
    this.publish();
    return true;
  }
  spawnRiftWave() {
    const r = this.rift;
    if (!r || r.status !== "active") return;
    r.wave++;
    r.waveKills = 0;
    r.nextWaveAt = null;
    const count = 3 + r.wave;
    const templates = this.enemies.filter((e) => !e.boss && !e.riftSpawn);
    for (let i = 0; i < count; i++) {
      const template = templates[i % templates.length] || {
        name: "Rift Stalker",
        creatureId: "celestial-familiars",
        maxHealth: 70,
        damage: 9,
        speed: 95,
        archetype: "melee",
        radius: 18,
        color: "#c7a3ff",
      };
      const angle = (i * TAU) / count + 0.3 * r.wave;
      let point = {
        x: r.x + Math.cos(angle) * 190,
        y: r.y + Math.sin(angle) * 190,
      };
      if (this.blocked(point.x, point.y, template.radius || 18))
        point = {
          x: r.x + Math.cos(angle) * 110,
          y: r.y + Math.sin(angle) * 110,
        };
      if (this.blocked(point.x, point.y, 18)) point = shape(this.world.spawn);
      this.enemies.push({
        ...template,
        ...point,
        id: `rift:${++this.serial}`,
        home: shape(point),
        health: template.maxHealth || 80,
        maxHealth: template.maxHealth || 80,
        state: "chase",
        stateTime: 0,
        statuses: [],
        dead: false,
        elite: r.wave === 3 && i === 0,
        boss: false,
        riftSpawn: true,
        attackAt: this.time + 1,
        telegraph: null,
        xp: 20,
      });
      this.fx("spawn", point, { radius: 45, color: "#c6a2ff", duration: 0.8 });
    }
    this.notice(`Rift wave ${r.wave} / 3 · ${count} creatures.`, "rift");
    this.emit("rift", { wave: r.wave });
  }
  checkRift() {
    const r = this.rift;
    if (!r || r.status !== "active") return;
    const living = this.enemies.some((e) => e.riftSpawn && !e.dead);
    if (r.wave > 0 && !living && !r.nextWaveAt) {
      if (r.wave >= r.waves) {
        r.status = "complete";
        this.player.shards += r.reward;
        this.player.ultimate = 100;
        this.player.health = this.player.maxHealth;
        this.stats.rifts++;
        this.progressFor().rifts++;
        this.gainXP(120);
        this.notice(
          `Rift cleared · +${r.reward} power shards. Ultimate charged.`,
          "rift",
        );
        this.fx("rift-complete", r, {
          radius: 220,
          color: "#b7fff2",
          duration: 1.5,
        });
        this.emit("levelup", { text: "Rift cleared" });
        this.save();
      } else {
        r.nextWaveAt = this.time + 1.8;
        this.player.essence = this.player.maxEssence;
        this.player.health = Math.min(
          this.player.maxHealth,
          this.player.health + 25,
        );
      }
    }
  }
  failRift() {
    if (!this.rift) return;
    this.rift.status = "failed";
    for (const e of this.enemies)
      if (e.riftSpawn && !e.dead) {
        e.dead = true;
        e.respawnAt = Infinity;
      }
    this.notice("Rift dispersed. Recharge at the sanctuary and try again.");
  }
  updateEnemy(e, dt) {
    if (e.dead) {
      if (
        !e.riftSpawn &&
        this.time >= e.respawnAt &&
        dist(this.player, e.home) > 190 &&
        !this.blocked(e.home.x, e.home.y, e.radius)
      ) {
        e.dead = false;
        e.health = e.maxHealth;
        e.x = e.home.x;
        e.y = e.home.y;
        e.state = "idle";
        e.statuses = [];
        e.generation++;
        e.telegraph = null;
        this.fx("spawn", e, { radius: 42, color: e.color, duration: 0.7 });
      }
      return;
    }
    e.statuses = e.statuses.filter((s) => s.until > this.time);
    for (const status of e.statuses)
      if (status.type === "burn" && this.time >= status.nextTick) {
        status.nextTick = this.time + 0.6;
        this.damageEnemy(e, status.damage, {
          element: "fire",
          color: "#ffab75",
          dot: true,
        });
        if (e.dead) return;
      }
    if (e.statuses.some((s) => s.type === "stagger")) return;
    const charm = e.statuses.some((s) => s.type === "charm"),
      slow = e.statuses.some((s) => s.type === "chill") ? 0.55 : 1;
    const d = dist(e, this.player),
      safe = dist(this.player, this.world.spawn) < 150;
    if (this.deathUntil > this.time || (safe && !e.riftSpawn)) {
      if (e.state !== "idle") {
        e.state = "idle";
        e.telegraph = null;
      }
      const homeDist = dist(e, e.home);
      if (homeDist > 5)
        this.move(
          e,
          ((e.home.x - e.x) / homeDist) * e.speed * 0.5 * dt,
          ((e.home.y - e.y) / homeDist) * e.speed * 0.5 * dt,
          e.radius,
        );
      return;
    }
    if (charm) {
      const other = this.enemies.find(
        (n) => n !== e && !n.dead && dist(n, e) < 150,
      );
      if (other && this.time > e.attackAt) {
        e.attackAt = this.time + 1;
        this.damageEnemy(other, e.damage * 0.7, {
          element: "love",
          color: "#ffb9e3",
          dot: true,
        });
        this.fx("chain", e, {
          targetX: other.x,
          targetY: other.y,
          color: "#ffb9e3",
          radius: 5,
          duration: 0.3,
        });
      }
      return;
    }
    const ranged = /ranged|caster|spitter|mage|support/.test(e.archetype),
      charger = /charg|dash|beast/.test(e.archetype),
      boss = !!e.boss;
    if (e.state === "windup") {
      if (this.time < e.attackAt) return;
      const target = e.telegraph?.target || shape(this.player),
        range = e.telegraph?.radius || 65;
      e.telegraph = null;
      e.state = "recover";
      e.recoverAt = this.time + (boss ? 1.1 : 0.65);
      e.nextAttack = this.time + (e.attackCooldown || 2);
      if (charger) {
        e.chargeTarget = target;
        e.state = "charging";
        e.chargeUntil = this.time + 0.45;
        e.chargeHit = false;
      } else if (ranged) {
        const angle = Math.atan2(target.y - e.y, target.x - e.x),
          count = boss ? 8 : 1;
        for (let i = 0; i < count; i++) {
          const a = boss ? angle + (i * TAU) / count : angle;
          this.projectiles.push({
            id: ++this.serial,
            x: e.x,
            y: e.y,
            vx: Math.cos(a) * (boss ? 210 : 240),
            vy: Math.sin(a) * (boss ? 210 : 240),
            owner: "enemy",
            damage: e.damage,
            radius: boss ? 11 : 8,
            life: 3.5,
            color: e.color || "#ff8caf",
            element: "hostile",
            trail: [],
            hitIds: [],
          });
        }
      } else {
        this.fx("enemy-attack", target, {
          radius: range,
          color: "#fb849c",
          duration: 0.4,
        });
        if (dist(this.player, target) < range + 14)
          this.damagePlayer(e.damage, e);
        if (boss) {
          for (let i = 0; i < 8; i++) {
            const a = (i * TAU) / 8;
            this.projectiles.push({
              id: ++this.serial,
              x: e.x,
              y: e.y,
              vx: Math.cos(a) * 190,
              vy: Math.sin(a) * 190,
              owner: "enemy",
              damage: e.damage * 0.55,
              radius: 8,
              life: 2.5,
              color: "#ed9cc6",
              trail: [],
              hitIds: [],
            });
          }
        }
      }
      return;
    }
    if (e.state === "charging") {
      const target = e.chargeTarget,
        dx = target.x - e.x,
        dy = target.y - e.y,
        length = Math.hypot(dx, dy) || 1;
      this.move(
        e,
        (dx / length) * 750 * dt,
        (dy / length) * 750 * dt,
        e.radius,
      );
      if (!e.chargeHit && dist(e, this.player) < e.radius + 22) {
        this.damagePlayer(e.damage * 1.2, e);
        e.chargeHit = true;
      }
      if (this.time > e.chargeUntil || length < 20) {
        e.state = "recover";
        e.recoverAt = this.time + 0.75;
      }
      return;
    }
    if (e.state === "recover") {
      if (this.time >= e.recoverAt) e.state = "chase";
      else return;
    }
    if (d > (e.aggroRange || 450) && e.state === "idle") return;
    if (d > 850 && !e.riftSpawn) {
      e.state = "idle";
      e.x = e.home.x;
      e.y = e.home.y;
      return;
    }
    const reach = boss
      ? 120
      : ranged
        ? 320
        : charger
          ? 230
          : e.attackRange || 65;
    if (d < reach && this.time >= (e.nextAttack || 0)) {
      e.state = "windup";
      e.attackAt =
        this.time + (boss ? 0.95 : charger ? 0.85 : ranged ? 0.9 : 0.65);
      const target = shape(this.player),
        radius = boss ? 105 : charger ? 36 : 55;
      if (charger) {
        const dx = this.player.x - e.x,
          dy = this.player.y - e.y,
          l = Math.hypot(dx, dy) || 1;
        target.x = e.x + (dx / l) * Math.min(320, l + 100);
        target.y = e.y + (dy / l) * Math.min(320, l + 100);
      }
      e.telegraph = {
        type: charger ? "charge" : ranged ? "line" : "circle",
        x: e.x,
        y: e.y,
        target,
        radius,
        start: this.time,
        until: e.attackAt,
      };
      if (d < 400) this.emit("enemyTelegraph", { boss, kind: e.archetype });
      return;
    }
    e.state = "chase";
    if (d > (ranged ? 210 : 45)) {
      const dx = this.player.x - e.x,
        dy = this.player.y - e.y;
      this.move(
        e,
        (dx / d) *
          e.speed *
          slow *
          (boss && e.health < e.maxHealth * 0.5 ? 1.2 : 1) *
          dt,
        (dy / d) *
          e.speed *
          slow *
          (boss && e.health < e.maxHealth * 0.5 ? 1.2 : 1) *
          dt,
        e.radius,
      );
    }
  }
  updateProjectiles(dt) {
    for (const p of this.projectiles) {
      if (p.life <= 0) continue;
      p.trail.push({ x: p.x, y: p.y });
      if (p.trail.length > 7) p.trail.shift();
      const old = shape(p),
        dx = p.vx * dt,
        dy = p.vy * dt,
        steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 12));
      for (let step = 0; step < steps && p.life > 0; step++) {
        p.x += dx / steps;
        p.y += dy / steps;
        if (this.blocked(p.x, p.y, p.radius * 0.4)) {
          p.life = 0;
          this.fx("impact", p, { color: p.color, radius: 22, duration: 0.2 });
          break;
        }
        if (p.owner === "enemy") {
          if (dist(p, this.player) < p.radius + 14) {
            this.damagePlayer(p.damage, p);
            p.life = 0;
          }
        } else {
          for (const e of this.enemies)
            if (
              !e.dead &&
              !p.hitIds.includes(e.id) &&
              dist(p, e) < p.radius + e.radius
            ) {
              this.damageEnemy(e, p.damage, p);
              p.hitIds.push(e.id);
              if (p.pierce > 0) p.pierce--;
              else p.life = 0;
              break;
            }
          if (p.life > 0)
            for (const prop of this.world.props)
              if (
                prop.destructible &&
                !prop.destroyed &&
                dist(p, prop) < p.radius + (prop.radius || 20)
              ) {
                this.damageProp(prop, p.damage, p);
                p.life = 0;
                break;
              }
          this.activateFeatures(p, p, 28);
        }
      }
      p.life -= dt;
    }
    this.projectiles = this.projectiles.filter((p) => p.life > 0);
  }
  update(dt) {
    dt = clamp(Number(dt) || 0, 0, 0.1);
    if (this.paused || !this.player.characterCreated) return;
    this.time += dt;
    if (this.waypoint && dist(this.player, this.waypoint) <= 130)
      this.waypoint = null;
    this._publishElapsed += dt;
    this._saveElapsed += dt;
    this.shake = Math.max(0, this.shake - dt * 2);
    this.flash = Math.max(0, this.flash - dt);
    if (this.deathUntil && this.time >= this.deathUntil) {
      this.deathUntil = 0;
      Object.assign(this.player, shape(this.world.spawn), {
        health: this.player.maxHealth,
        essence: this.player.maxEssence,
        shield: 0,
        invulnerableUntil: this.time + 2,
      });
      this.player.potions = Math.max(2, this.player.potions);
      for (const e of this.enemies)
        if (!e.dead) {
          e.state = "idle";
          e.x = e.home.x;
          e.y = e.home.y;
          e.telegraph = null;
        }
      this.save();
    }
    if (!this.deathUntil) {
      this.player.essence = Math.min(
        this.player.maxEssence,
        this.player.essence + 19 * dt,
      );
      this.player.ultimate = Math.min(100, this.player.ultimate + 1.8 * dt);
      this.player.shield = Math.max(0, this.player.shield - dt * 1.2);
      let dx =
          Number(this.keys.has("d") || this.keys.has("arrowright")) -
          Number(this.keys.has("a") || this.keys.has("arrowleft")),
        dy =
          Number(this.keys.has("s") || this.keys.has("arrowdown")) -
          Number(this.keys.has("w") || this.keys.has("arrowup"));
      if (this.inputBlocked) {
        dx = 0;
        dy = 0;
      }
      const length = Math.hypot(dx, dy);
      this.player.walking = length > 0;
      if (length) {
        this.move(
          this.player,
          (dx / length) * 265 * dt,
          (dy / length) * 265 * dt,
        );
        this.player.facing = Math.atan2(dy, dx);
      }
      if (!this.inputBlocked) {
        if (this.mouseButtons.has(0)) this.castSlot(0);
        if (this.mouseButtons.has(2)) this.castSlot(1);
      }
      for (const e of this.enemies) this.updateEnemy(e, dt);
      this.updateProjectiles(dt);
    }
    for (const e of this.effects) {
      e.age += dt;
      if (e.type === "orbit") {
        e.x = this.player.x;
        e.y = this.player.y;
        if (e.age >= e.nextTick) {
          e.nextTick = e.age + 0.65;
          this.areaDamage(this.player, e.radius, e.damage * 0.35, {
            ...e,
            dot: false,
          });
        }
      }
    }
    this.effects = this.effects.filter((e) => e.age < e.duration);
    for (const s of this.summons) {
      s.life -= dt;
      s.angle += dt * 1.7;
      s.x = this.player.x + Math.cos(s.angle) * 58;
      s.y = this.player.y + Math.sin(s.angle) * 36 - 18;
      if (this.time >= s.nextShot) {
        s.nextShot = this.time + 0.7;
        const target = this.enemies
          .filter((e) => !e.dead && dist(s, e) < 550)
          .sort((a, b) => dist(a, s) - dist(b, s))[0];
        if (target) {
          const a = Math.atan2(target.y - s.y, target.x - s.x);
          this.projectiles.push({
            ...s,
            id: ++this.serial,
            owner: "player",
            x: s.x,
            y: s.y,
            vx: Math.cos(a) * 670,
            vy: Math.sin(a) * 670,
            life: 1,
            radius: 6,
            pierce: 0,
            trail: [],
            hitIds: [],
          });
        }
      }
    }
    this.summons = this.summons.filter((s) => s.life > 0);
    for (const drop of this.loot) {
      drop.age += dt;
      drop.life -= dt;
      const d = dist(drop, this.player);
      if (d < 235 && drop.age > 0.12) {
        const speed = clamp(650 - d, 230, 650);
        drop.x += ((this.player.x - drop.x) / (d || 1)) * speed * dt;
        drop.y += ((this.player.y - drop.y) / (d || 1)) * speed * dt;
      }
      if (d < 27) {
        drop.life = 0;
        if (drop.kind === "xp") this.gainXP(drop.amount);
        else if (drop.kind === "health")
          this.player.health = Math.min(
            this.player.maxHealth,
            this.player.health + drop.amount,
          );
        else this.player.shards += drop.amount;
        if (this.time - this.lastPickup > 0.15) {
          this.emit("pickup", { kind: drop.kind });
          this.lastPickup = this.time;
        }
      }
    }
    this.loot = this.loot.filter((d) => d.life > 0);
    for (const t of this.floatingTexts) {
      t.life -= dt;
      t.y -= 28 * dt;
    }
    this.floatingTexts = this.floatingTexts.filter((t) => t.life > 0);
    this.notices = this.notices.filter((n) => n.until > this.time);
    if (this.time - this.lastCombo > 6) this.stats.combo = 0;
    for (const prop of this.world.props)
      if (
        prop.destroyed &&
        prop.respawnAt <= this.time &&
        dist(this.player, prop) > 100
      ) {
        prop.destroyed = false;
        prop.health = prop.maxHealth;
      }
    if (this.rift?.status === "active") {
      if (this.time >= this.rift.endsAt) this.failRift();
      else if (this.rift.nextWaveAt && this.time >= this.rift.nextWaveAt)
        this.spawnRiftWave();
      this.checkRift();
    }
    if (this._saveElapsed >= 4) {
      this._saveElapsed = 0;
      this.save(false);
    }
    if (this._publishElapsed >= 0.08) {
      this._publishElapsed = 0;
      this.publish();
    }
  }
  objective() {
    const p = this.progressFor();
    if (p.kills < 8)
      return {
        title: "Your power. Your playground.",
        text: "Hunt creatures, mix elements, and collect power shards.",
        progress: p.kills,
        total: 8,
        kind: "hunt",
      };
    if (p.rifts < 1)
      return {
        title: "Break open a creature rift",
        text: "Find a violet rift and survive its three waves for a shower of power shards.",
        progress: 0,
        total: 1,
        kind: "rift",
      };
    if (p.bosses < 1)
      return {
        title: "Challenge the region guardian",
        text: "Watch its red tells, dodge, and unleash a charged ultimate.",
        progress: 0,
        total: 1,
        kind: "boss",
      };
    return {
      title: "A whole realm is waiting",
      text: "Travel freely, find relic caches and try a completely different power build.",
      progress: 1,
      total: 1,
      kind: "explore",
    };
  }
  snapshot() {
    const world = {
      id: this.world.id,
      name: this.world.name,
      realm: this.world.realm,
      width: this.world.width,
      height: this.world.height,
      palette: this.world.palette,
      biome: this.world.biome,
      description: this.world.description,
      paths: this.world.paths,
      river: this.world.river,
      water: this.world.water,
      spawn: this.world.spawn,
    };
    const mapMarkers = [
      ...this.world.portals.map((p) => ({
        id: p.id,
        x: p.x,
        y: p.y,
        kind: "portal",
        name: p.name,
        priority: 0,
      })),
      ...this.world.challenges.map((p) => ({
        id: p.id,
        x: p.x,
        y: p.y,
        kind: "rift",
        name: p.name,
        priority: 0,
      })),
      ...this.world.chests
        .filter((p) => !p.opened)
        .map((p) => ({ id: p.id, x: p.x, y: p.y, kind: "chest", priority: 1 })),
      ...this.world.features
        .filter((p) => p.kind !== "bridge")
        .map((p) => ({
          id: p.id,
          x: p.x,
          y: p.y,
          kind: p.kind === "hub" ? "hub" : "landmark",
          name: p.name,
          priority: 2,
        })),
      ...this.enemies
        .filter((e) => !e.dead)
        .map((e) => ({
          id: e.id,
          x: e.x,
          y: e.y,
          kind: "enemy",
          boss: !!e.boss,
          elite: !!e.elite,
          priority: e.boss ? 1 : e.elite ? 2 : 3,
        })),
    ]
      .sort(
        (a, b) =>
          a.priority - b.priority ||
          dist(a, this.player) - dist(b, this.player),
      )
      .slice(0, 42);
    return {
      player: clone(this.player),
      world,
      region: world,
      zone: world,
      time: this.time,
      stats: { ...this.stats },
      slots: [...this.slots],
      slotPowers: this.slots.map((id) => {
        const p = this.power(id);
        return p
          ? {
              ...p,
              remaining: Math.max(0, (this.cooldowns[id] || 0) - this.time),
              unlocked: this.unlocked.has(id),
            }
          : null;
      }),
      unlocked: [...this.unlocked],
      unlockedPowers: [...this.unlocked],
      cooldowns: Object.fromEntries(
        Object.entries(this.cooldowns).map(([id, t]) => [
          id,
          Math.max(0, t - this.time),
        ]),
      ),
      selectedSlot: this.selectedSlot,
      waypoint: this.waypoint ? { ...this.waypoint } : null,
      mapMarkers,
      markers: mapMarkers,
      objective: this.objective(),
      rift: this.rift
        ? { ...this.rift, remaining: Math.max(0, this.rift.endsAt - this.time) }
        : null,
      nearby: this.nearestInteractable(),
      paused: this.paused,
      notices: this.notices.map((n) => ({ ...n })),
      discoveredZones: [...this.visited],
      visited: [...this.visited],
      dashRemaining: Math.max(0, 1.35 - (this.time - this.lastDash)),
      downed: this.deathUntil > this.time,
      respawnIn: Math.max(0, this.deathUntil - this.time),
      enemiesAlive: this.enemies.filter((e) => !e.dead).length,
      inCombat:
        this.rift?.status === "active" ||
        this.enemies.some(
          (e) =>
            !e.dead &&
            ["chase", "windup", "charging"].includes(e.state) &&
            dist(e, this.player) < 600,
        ),
      regionProgress: clone(this.progressFor()),
      savedAt: this.savedAt || null,
    };
  }
  publish() {
    const state = this.snapshot();
    this.onUpdate(state);
    return state;
  }
  notice(text, type = "info") {
    this.notices.unshift({
      id: ++this.serial,
      text,
      type,
      until: this.time + 4,
    });
    this.notices = this.notices.slice(0, 4);
    this.emit("notice", { text, kind: type });
  }
  emit(type, data = {}) {
    this.onEvent({ type, ...data });
  }
  save(notify = false) {
    if (!this.player.characterCreated) return false;
    try {
      this.savedAt = new Date().toISOString();
      this.storage?.setItem(
        REBORN_SAVE_KEY,
        JSON.stringify({
          version: 1,
          player: this.player,
          stats: this.stats,
          zoneId: this.zoneId,
          time: this.time,
          slots: this.slots,
          unlocked: [...this.unlocked],
          visited: [...this.visited],
          regionProgress: this.regionProgress,
          chestClaims: this.chestClaims,
          savedAt: this.savedAt,
          cooldowns: Object.fromEntries(
            Object.entries(this.cooldowns).map(([id, end]) => [
              id,
              Math.max(0, end - this.time),
            ]),
          ),
        }),
      );
      if (notify) this.notice("Journey saved.");
      return true;
    } catch {
      if (notify) this.notice("This browser could not save.");
      return false;
    }
  }
  load() {
    try {
      const saved = JSON.parse(
        this.storage?.getItem(REBORN_SAVE_KEY) || "null",
      );
      if (!saved || saved.version !== 1 || !saved.player?.characterCreated)
        return false;
      Object.assign(this.player, saved.player);
      this._recoverOnLoad = this.player.health <= 0;
      this.player.health = Math.max(1, this.player.health);
      this.player.invulnerableUntil = 0;
      this.stats = { ...freshStats(), ...saved.stats };
      this.zoneId = ZONES.some((z) => z.id === saved.zoneId)
        ? saved.zoneId
        : "sacred-groves";
      this.time = Number(saved.time) || 0;
      this.slots = (saved.slots || [])
        .filter((id) => powerMap.has(id))
        .slice(0, 6);
      this.unlocked = new Set(
        (saved.unlocked || []).filter((id) => powerMap.has(id)),
      );
      this.visited = new Set(saved.visited || [this.zoneId]);
      this.regionProgress = saved.regionProgress || {};
      this.chestClaims = saved.chestClaims || {};
      this.savedAt = saved.savedAt;
      this.cooldowns = Object.fromEntries(
        Object.entries(saved.cooldowns || {}).map(([id, t]) => [
          id,
          this.time + Math.max(0, Number(t) || 0),
        ]),
      );
      return true;
    } catch {
      return false;
    }
  }
  reset() {
    this.storage?.removeItem(REBORN_SAVE_KEY);
    this.player = freshPlayer();
    this.stats = freshStats();
    this.regionProgress = {};
    this.chestClaims = {};
    this.unlocked.clear();
    this.slots = [];
    this.cooldowns = {};
    this.time = 0;
    this.deathUntil = 0;
    this.lastDash = -100;
    this.lastCombo = -100;
    this.lastImpact = -100;
    this.lastPickup = -100;
    this._emptyAt = -100;
    this._saveElapsed = 0;
    this._publishElapsed = 0;
    this.selectedSlot = 0;
    this.shake = 0;
    this.flash = 0;
    this.floatingTexts = [];
    this.notices = [];
    this.visited = new Set(["sacred-groves"]);
    this.installRegion("sacred-groves");
    this.publish();
  }
  bindEvents() {
    if (!this.canvas || !globalThis.window) return;
    this._handlers = {};
    const listen = (target, type, handler, opts) => {
      target.addEventListener(type, handler, opts);
      (this._listeners ||= []).push([target, type, handler, opts]);
    };
    listen(window, "keydown", (e) => {
      if (e.target?.closest?.("input,textarea,select,[contenteditable=true]"))
        return;
      const key = e.key.toLowerCase();
      if (
        [" ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)
      )
        e.preventDefault();
      if (this.paused || this.inputBlocked || !this.player.characterCreated)
        return;
      this.keys.add(key);
      if (e.repeat) return;
      if (key === " ") this.dash();
      else if (key === "e") this.interact();
      else if (key === "r") this.usePotion();
      else if (key === "q") this.castSlot(5);
      else if (/^[1-6]$/.test(key)) this.castSlot(Number(key) - 1);
    });
    listen(window, "keyup", (e) => this.keys.delete(e.key.toLowerCase()));
    listen(window, "blur", () => {
      this.keys.clear();
      this.mouseButtons.clear();
    });
    const updateAim = (e) => {
      if (this.renderer?.screenToWorld) {
        const p = this.renderer.screenToWorld(e.clientX, e.clientY, this);
        if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) {
          this.aim = p;
          this.pointer = p;
          return;
        }
      }
      const rect = this.canvas.getBoundingClientRect();
      this.aim = {
        x: e.clientX - rect.left + this.camera.x,
        y: e.clientY - rect.top + this.camera.y,
      };
      this.pointer = this.aim;
    };
    listen(this.canvas, "pointermove", updateAim);
    listen(this.canvas, "pointerdown", (e) => {
      if (this.paused || this.inputBlocked) return;
      updateAim(e);
      this.canvas.focus?.();
      this.mouseButtons.add(e.button);
      if (e.button === 0 || e.button === 2) {
        e.preventDefault();
        this.castSlot(e.button === 0 ? 0 : 1);
      }
    });
    listen(window, "pointerup", (e) => this.mouseButtons.delete(e.button));
    listen(this.canvas, "contextmenu", (e) => e.preventDefault());
  }
  start() {
    if (this.running) return;
    this.running = true;
    let last = globalThis.performance?.now() || Date.now();
    const frame = (now) => {
      if (!this.running) return;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      this.update(dt);
      this.renderer?.render?.(this, now);
      this._raf = requestAnimationFrame(frame);
    };
    if (globalThis.requestAnimationFrame)
      this._raf = requestAnimationFrame(frame);
  }
  destroy() {
    this.running = false;
    if (this._raf) globalThis.cancelAnimationFrame?.(this._raf);
    for (const [target, type, handler, opts] of this._listeners || [])
      target.removeEventListener(type, handler, opts);
    this._listeners = [];
    this.keys.clear();
    this.mouseButtons.clear();
    this.save();
    this.renderer?.destroy?.();
  }
}
export default RebornEngine;
