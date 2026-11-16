import test from "node:test";
import assert from "node:assert/strict";
import { RebornEngine, REBORN_SAVE_KEY } from "./engine.js";
import { POWER_CATALOG } from "./catalog.js";
const memory = () => {
  const m = new Map();
  return {
    getItem: (k) => m.get(k) || null,
    setItem: (k, v) => m.set(k, v),
    removeItem: (k) => m.delete(k),
  };
};
function game(kit = "emberborn") {
  const storage = memory(),
    g = new RebornEngine(null, { storage });
  assert.equal(
    g.createCharacter({ name: "Aster", lineage: "angel", kit }),
    true,
  );
  return g;
}
const tick = (g, seconds) => {
  for (let i = 0; i < Math.ceil(seconds / 0.05); i++) g.update(0.05);
};
function arena(g) {
  g.world.obstacles = [];
  g.world.props = [];
  g.world.features = [];
  g.enemies = [];
  g.player.x = 1100;
  g.player.y = 1100;
  return g;
}
function creature(g, values = {}) {
  const e = {
    id: "test-creature",
    kind: "enemy",
    name: "Test Stalker",
    x: 1300,
    y: 1100,
    home: { x: 1300, y: 1100 },
    health: 80,
    maxHealth: 80,
    damage: 12,
    speed: 0,
    aggroRange: 450,
    attackRange: 50,
    attackCooldown: 2,
    archetype: "melee",
    radius: 20,
    state: "idle",
    stateTime: 0,
    attackAt: 0,
    statuses: [],
    generation: 0,
    dead: false,
    ...values,
  };
  g.enemies.push(e);
  return e;
}

test("fresh character begins with sixteen affinities, six usable slots and a charged free ultimate", () => {
  const g = game();
  assert.equal(g.unlocked.size, 17);
  assert.equal(g.slots.length, 6);
  for (const p of POWER_CATALOG.filter((p) => p.level === 1))
    assert.ok(g.unlocked.has(p.id));
  assert.ok(g.power(g.slots[5]).ultimate);
  assert.equal(g.player.ultimate, 100);
  assert.equal(g.createCharacter({ name: "New", kit: "tidecaller" }), false);
  const h = new RebornEngine(null, { storage: memory() });
  assert.equal(h.castSlot(0), false);
  h.keys.add("d");
  h.update(0.1);
  assert.equal(h.player.characterCreated, false);
});
test("aimed instant spells actually hit and kill creatures, grant loot, level and unlock powers affordably", () => {
  const g = arena(game()),
    e = creature(g, { maxHealth: 50, health: 50 });
  assert.equal(g.castSlot(0, e.x, e.y), true);
  assert.equal(g.castSlot(0, e.x, e.y), false);
  assert.equal(e.health, 50);
  tick(g, 0.45);
  assert.ok(e.health < 50);
  assert.equal(g.castSlot(0, e.x, e.y), true);
  tick(g, 0.8);
  assert.equal(e.dead, true);
  assert.equal(g.stats.kills, 1);
  assert.ok(g.stats.damage >= 48);
  tick(g, 2);
  assert.ok(g.player.xp > 0);
  assert.ok(g.player.shards >= 4);
  const p = POWER_CATALOG.find((p) => p.level === 2),
    before = g.player.shards;
  assert.equal(g.unlockPower(p.id), true);
  assert.equal(g.player.shards, before - p.unlockCost);
  assert.equal(g.unlockPower(p.id), false);
  assert.equal(g.equipPower(2, p.id), true);
  assert.equal(g.unlockPower("invalid"), false);
  assert.equal(g.equipPower(7, p.id), false);
});
test("generous Essence recharges basic spells while locked powers and ultimate require the real prerequisites", () => {
  const g = arena(game());
  g.player.essence = 0;
  assert.equal(g.castSlot(0, 1300, 1100), false);
  tick(g, 1);
  assert.ok(g.player.essence >= 18);
  assert.equal(g.castSlot(0, 1300, 1100), true);
  assert.equal(g.castSlot(5, 1300, 1100), true);
  assert.equal(g.player.ultimate, 0);
  tick(g, 10);
  assert.equal(g.castSlot(5, 1300, 1100), false);
  g.slots[0] = "water-grow-7";
  assert.equal(g.castSlot(0, 1300, 1100), false);
});
test("fire and water produce an actual thermal combo, status damage and vulnerability follow-up", () => {
  const g = arena(game()),
    e = creature(g, { health: 1000, maxHealth: 1000 });
  const water = g.power("water-grow-1"),
    fire = g.power("fire-create-1");
  g.damageEnemy(e, 20, { element: "water", status: water.status });
  const before = e.health;
  g.damageEnemy(e, 20, { element: "fire", status: fire.status });
  assert.equal(before - e.health, 36);
  assert.ok(g.floatingTexts.some((t) => t.text === "THERMAL SHOCK"));
  const burnBefore = e.health;
  tick(g, 0.7);
  assert.ok(e.health < burnBefore);
  g.damageEnemy(e, 10, { element: "hate", status: "vulnerable" });
  const darkBefore = e.health;
  g.damageEnemy(e, 20, { element: "dark", status: "drain" });
  assert.equal(darkBefore - e.health, 36);
  assert.ok(g.floatingTexts.some((t) => t.text === "SOUL RUPTURE"));
});
test("enemy windup fixes a visible target and movement avoids its attack; dash has cooldown and invulnerability", () => {
  const g = arena(game()),
    e = creature(g, { x: 1140, home: { x: 1140, y: 1100 } });
  g.update(0.05);
  assert.equal(e.state, "windup");
  assert.ok(e.telegraph);
  const health = g.player.health;
  assert.equal(g.dash(1100, 850), true);
  assert.equal(g.dash(1100, 850), false);
  assert.ok(g.player.y < 950);
  assert.equal(g.damagePlayer(20, e), false);
  tick(g, 0.75);
  assert.equal(g.player.health, health);
  assert.equal(e.state, "recover");
  tick(g, 0.8);
  assert.equal(g.dash(1100, 1300), true);
});
test("explosives, crystals, lifebloom springs and totems create distinct world interactions", () => {
  const g = arena(game()),
    e = creature(g, { x: 1280 });
  const prop = (kind, x) => ({
    id: kind,
    kind,
    x,
    y: 1100,
    radius: 18,
    health: 25,
    maxHealth: 25,
    destructible: true,
  });
  const barrel = prop("explosive", 1250);
  g.world.props.push(barrel);
  g.damageProp(barrel, 24, { element: "fire" });
  assert.equal(barrel.destroyed, true);
  assert.ok(e.health < 80);
  const crystal = prop("crystal", 1500);
  g.player.essence = 1;
  g.player.ultimate = 0;
  g.damageProp(crystal, 30, { element: "air" });
  assert.equal(g.player.essence, 100);
  assert.equal(g.player.ultimate, 20);
  assert.equal(g.loot.find((l) => l.x === 1500).amount, 3);
  const spring = prop("spring", 1500);
  g.player.health = 40;
  g.damageProp(spring, 30, { element: "water" });
  assert.equal(g.player.health, 80);
  const totem = prop("totem", 1280);
  g.damageProp(totem, 30, { element: "earth" });
  assert.ok(g.effects.some((e) => e.type === "nova"));
});
test("renewable populations wait until the player leaves an anchor and a death retains progression", () => {
  const g = arena(game()),
    e = creature(g);
  g.killEnemy(e);
  g.player.x = e.home.x;
  g.player.y = e.home.y;
  tick(g, 31);
  assert.equal(e.dead, true);
  g.player.x = 800;
  tick(g, 0.1);
  assert.equal(e.dead, false);
  assert.equal(e.generation, 1);
  assert.equal(e.health, e.maxHealth);
  g.player.shards = 13;
  g.player.invulnerableUntil = 0;
  g.damagePlayer(999);
  assert.ok(g.deathUntil > g.time);
  tick(g, 2.3);
  assert.equal(g.deathUntil, 0);
  assert.equal(g.player.health, g.player.maxHealth);
  assert.equal(g.player.shards, 13);
  assert.ok(g.player.potions >= 2);
});
test("chests settle exactly once and new action saves preserve powers, claims and cooldowns across reload", () => {
  const g = game(),
    chest = g.world.chests[0];
  Object.assign(g.player, { x: chest.x, y: chest.y });
  const before = g.player.shards;
  assert.equal(g.claimChest(chest.id), true);
  assert.ok(g.player.shards > before);
  assert.equal(g.claimChest(chest.id), false);
  g.castSlot(0, chest.x + 100, chest.y);
  g.save();
  const saved = JSON.parse(g.storage.getItem(REBORN_SAVE_KEY));
  assert.equal(saved.player.characterCreated, true);
  const loaded = new RebornEngine(null, { storage: g.storage });
  assert.equal(loaded.player.name, "Aster");
  assert.deepEqual(loaded.slots, g.slots);
  assert.equal(loaded.world.chests.find((c) => c.id === chest.id).opened, true);
  assert.equal(loaded.claimChest(chest.id), false);
  assert.ok(loaded.cooldowns[g.slots[0]] > loaded.time);
  const shards = loaded.player.shards;
  assert.equal(loaded.setZone("city-of-stars"), true);
  assert.equal(loaded.zoneId, "city-of-stars");
  assert.equal(loaded.player.shards, shards);
  assert.equal(loaded.setZone("not-a-zone"), false);
});
test("three-wave rifts spawn physical creatures and settle only after every wave is defeated", () => {
  const g = game(),
    site = g.world.challenges[0];
  g.player.x = site.x;
  g.player.y = site.y;
  assert.equal(g.startRift(site.id), true);
  assert.equal(g.startRift(site.id), false);
  const before = g.player.shards;
  for (let wave = 1; wave <= 3; wave++) {
    tick(g, 2);
    assert.equal(g.rift.wave, wave);
    const foes = g.enemies.filter((e) => e.riftSpawn && !e.dead);
    assert.equal(foes.length, 3 + wave);
    for (const e of foes) g.damageEnemy(e, 10000, { element: "fire" });
  }
  assert.equal(g.rift.status, "complete");
  assert.equal(g.stats.rifts, 1);
  assert.ok(g.player.shards >= before + 8);
  assert.equal(g.player.ultimate, 100);
  const rewards = g.player.shards;
  g.checkRift();
  assert.equal(g.player.shards, rewards);
});
test("pause blocks gameplay, finite coordinates are validated and feature resonance requires separate casts", () => {
  const g = arena(game());
  g.pause(true);
  const before = g.time;
  g.keys.add("d");
  g.update(0.1);
  assert.equal(g.time, before);
  assert.equal(g.castSlot(0, 1300, 1100), false);
  g.pause(false);
  assert.equal(g.castSlot(0, NaN, 0), false);
  assert.equal(g.dash(100000, 100000), true);
  assert.equal(g.blocked(g.player.x, g.player.y), false);
  g.world.features = [
    { id: "conduit", kind: "ruins", x: 1000, y: 1000, radius: 30, charge: 0 },
  ];
  const f = g.world.features[0];
  g.activateFeatures(f, { activationId: 1, color: "#fff" });
  g.activateFeatures(f, { activationId: 1, color: "#fff" });
  assert.equal(f.charge, 1);
  g.activateFeatures(f, { activationId: 2, color: "#fff" });
  assert.ok(g.progressFor().discoveries.includes(f.id));
  const shards = g.player.shards;
  g.activateFeatures(f, { activationId: 3, color: "#fff" });
  assert.equal(g.player.shards, shards);
});

test("all 160 preserved named powers execute through their new physical action profiles", () => {
  const g = arena(game());
  for (const p of POWER_CATALOG) {
    g.player.x = 1100;
    g.player.y = 1100;
    g.player.essence = 100;
    g.player.ultimate = 100;
    g.cooldowns = {};
    g.unlocked.add(p.id);
    g.slots[0] = p.id;
    g.projectiles = [];
    g.effects = [];
    g.summons = [];
    assert.equal(g.castSlot(0, 1400, 1100), true, p.id);
    assert.ok(
      g.projectiles.length || g.effects.length || g.summons.length,
      p.id,
    );
    assert.ok(
      Number.isFinite(g.player.x) && Number.isFinite(g.player.essence),
      p.id,
    );
  }
  assert.equal(POWER_CATALOG.length, 160);
});

test("guardian relic caches require a real guardian defeat, pay epic rewards and stay claimed after travel", () => {
  const g = game(),
    chest = g.world.chests.find((c) => c.bossLocked);
  Object.assign(g.player, shapeFor(chest));
  const before = g.player.shards;
  assert.equal(g.claimChest(chest.id), false);
  assert.equal(g.player.shards, before);
  assert.equal(chest.opened, false);
  const guardian = g.enemies.find((enemy) => enemy.boss);
  g.damageEnemy(guardian, guardian.maxHealth + 1, { element: "fire" });
  assert.equal(g.progressFor().bosses, 1);
  assert.equal(g.claimChest(chest.id), true);
  assert.equal(g.player.shards, before + 8);
  g.setZone("city-of-stars");
  g.setZone("sacred-groves");
  Object.assign(g.player, shapeFor(chest));
  assert.equal(g.claimChest(chest.id), false);
});
const shapeFor = (p) => ({ x: p.x, y: p.y });

test("restarting completed or failed rifts replaces old wave actors instead of accumulating them", () => {
  const g = game(),
    site = g.world.challenges[0],
    ordinary = g.enemies.length;
  Object.assign(g.player, shapeFor(site));
  assert.equal(g.startRift(site.id), true);
  tick(g, 1);
  assert.equal(g.enemies.filter((e) => e.riftSpawn).length, 4);
  g.failRift();
  assert.equal(g.startRift(site.id), true);
  assert.equal(g.enemies.length, ordinary);
  tick(g, 1);
  assert.equal(g.enemies.filter((e) => e.riftSpawn).length, 4);
  g.failRift();
  g.rift.status = "complete";
  assert.equal(g.startRift(site.id), true);
  assert.equal(g.enemies.length, ordinary);
});

test("defeat stops lingering offensive powers and a saved fallen character reforms safely on reload", () => {
  const g = arena(game()),
    e = creature(g, { health: 1000, maxHealth: 1000 });
  g.effects = [
    {
      type: "orbit",
      x: g.player.x,
      y: g.player.y,
      age: 0,
      duration: 4,
      nextTick: 0,
      damage: 100,
      radius: 300,
    },
  ];
  g.summons = [
    {
      id: "spirit",
      life: 5,
      nextShot: 0,
      angle: 0,
      damage: 10,
      element: "fire",
    },
  ];
  g.projectiles = [{ id: "bolt", owner: "player", life: 1 }];
  g.player.shards = 17;
  g.damagePlayer(999);
  assert.equal(g.projectiles.length, 0);
  assert.equal(g.summons.length, 0);
  assert.ok(g.effects.every((effect) => effect.type !== "orbit"));
  tick(g, 0.2);
  assert.equal(e.health, 1000);
  g.save();
  const restored = new RebornEngine(null, { storage: g.storage });
  assert.equal(restored.player.health, restored.player.maxHealth);
  assert.deepEqual(shapeFor(restored.player), shapeFor(restored.world.spawn));
  assert.equal(restored.player.shards, 17);
  assert.equal(restored.player.essence, restored.player.maxEssence);
  assert.ok(restored.player.invulnerableUntil > restored.time);
});

test("starting a new journey clears the previous death and dash timers and transient effects", () => {
  const g = game();
  g.time = 1000;
  g.lastDash = 1000;
  g.deathUntil = 1002;
  g.notices = [{ text: "Old run", until: 1005 }];
  g.floatingTexts = [{ text: "old", life: 1 }];
  g.reset();
  assert.equal(g.deathUntil, 0);
  assert.equal(g.floatingTexts.length, 0);
  assert.equal(g.notices.length, 0);
  assert.equal(
    g.createCharacter({ name: "New Aster", kit: "tidecaller" }),
    true,
  );
  assert.equal(g.dash(850, 1050), true);
  assert.equal(g.castSlot(0, 1000, 1050), true);
});

test("tracking a distant rift gives a transient physical waypoint without starting or moving the player", () => {
  const g = game(),
    site = g.world.challenges[0],
    position = shapeFor(g.player),
    shards = g.player.shards;
  assert.equal(g.startRift(), false);
  assert.equal(g.trackRift(), true);
  assert.deepEqual(shapeFor(g.player), position);
  assert.equal(g.player.shards, shards);
  assert.equal(g.rift, null);
  assert.deepEqual(g.snapshot().waypoint, {
    id: site.id,
    x: site.x,
    y: site.y,
    name: site.name,
    kind: "rift",
  });
  const snapshot = g.snapshot();
  snapshot.waypoint.x = 0;
  assert.equal(g.waypoint.x, site.x);
  Object.assign(g.player, { x: site.x + 120, y: site.y });
  tick(g, 0.05);
  assert.equal(g.snapshot().waypoint, null);
  g.trackRift();
  assert.equal(g.startRift(), true);
  assert.equal(g.waypoint, null);
  g.trackRift();
  g.setZone("city-of-stars");
  assert.equal(g.snapshot().waypoint, null);
});
