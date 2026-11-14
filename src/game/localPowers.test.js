import test from "node:test";
import assert from "node:assert/strict";
import { GameEngine } from "./engine.js";
import { BRANCHES, ENHANCEMENTS } from "../data/manual.js";

function memory() {
  const data = new Map();
  return {
    getItem: (k) => data.get(k) || null,
    setItem: (k, v) => data.set(k, v),
    removeItem: (k) => data.delete(k),
  };
}
function fresh({ isolated = true } = {}) {
  const g = new GameEngine(null, { headless: true, storage: memory() });
  g.player.rank = 10;
  g.player.health = 20;
  g.player.maxHealth = 100;
  g.player.essence = 100;
  g.player.certified = true;
  g.player.x = 500;
  g.player.y = 500;
  if (isolated) {
    g.entities = [];
    g.hasLineOfEffect = () => true;
    g.hasLineOfSight = () => true;
    g.isPositionBlocked = () => false;
  }
  return g;
}
function actors(g) {
  const foe = {
    id: "test-foe",
    name: "Test hostile",
    kind: "enemy",
    x: 540,
    y: 500,
    health: 500,
    maxHealth: 500,
    morale: 80,
    damage: 12,
    speed: 50,
    home: { x: 540, y: 500 },
    state: "idle",
    cooldown: 0,
  };
  const other = {
    ...foe,
    id: "other-foe",
    name: "Second hostile",
    x: 570,
    home: { x: 570, y: 500 },
  };
  const friend = {
    id: "test-friend",
    name: "Willing ally",
    kind: "ally",
    x: 520,
    y: 520,
    health: 20,
    maxHealth: 100,
    morale: 50,
    consent: true,
    statuses: [],
    injury: "nonfatal",
  };
  const npc = { ...friend, id: "test-npc", kind: "npc", statuses: [] };
  const patch = {
    id: "test-patch",
    name: "Garden bed",
    kind: "patch",
    x: 530,
    y: 520,
    health: 20,
    maxHealth: 100,
    durability: 200,
    maxDurability: 200,
    growthStage: 1,
    planted: true,
    damagedSoil: true,
    drought: true,
  };
  const object = {
    id: "test-object",
    kind: "object",
    name: "Permitted structure",
    x: 550,
    y: 520,
    durability: 200,
    maxDurability: 200,
    movable: true,
    mass: 10,
  };
  const torch = {
    id: "test-torch",
    kind: "torch",
    name: "Camp torch",
    x: 530,
    y: 500,
  };
  const merchant = {
    id: "merchant",
    kind: "npc",
    role: "merchant",
    name: "Public station",
    x: 520,
    y: 500,
  };
  g.entities = [foe, other, friend, npc, patch, object, torch, merchant];
  return { foe, other, friend, npc, patch, object, torch, merchant };
}
function settle(g) {
  const pending = g.castState;
  assert.ok(pending, "cast entered preparation");
  g.time = pending.resolveAt;
  g.castState = null;
  return g.resolveCast(pending);
}

test("all 87 named local powers prepare and settle once against their permitted target category", () => {
  let count = 0;
  for (const branch of BRANCHES)
    for (const power of branch.powers.filter((p) => p.kind === "local")) {
      const g = fresh(),
        a = actors(g);
      g.player.learned[branch.id] = 10;
      g.setPower(branch.id, power.level);
      let target = a.foe;
      if (["love-laugh", "light-pleasure"].includes(branch.id))
        target =
          [2, 3, 5].includes(power.level) && branch.id === "light-pleasure"
            ? a.friend
            : a.npc;
      if (branch.id === "water-grow") target = a.patch;
      if (branch.id === "hate-clean") {
        target = power.level === 4 ? a.foe : a.friend;
        if (power.level === 4) a.foe.attachedSpirit = true;
        else a.friend.statuses = [{ type: "fear", until: 30 }];
      }
      if (branch.id === "dark-heal")
        target = power.level === 4 ? a.patch : a.friend;
      if (branch.id === "fire-create") {
        target = power.level === 1 ? a.torch : null;
        g.setPowerPoint(410, 500);
        g.player.inventory.wood = 10;
      }
      if (branch.id === "earth-give") {
        target = power.level === 4 ? a.patch : a.friend;
        if (power.level === 4) a.patch.growthStage = 3;
      }
      if (branch.id === "air-move") {
        target =
          power.level === 1 ? a.object : power.level === 4 ? a.foe : null;
        if (power.routeTravel) {
          g.discoveredZones.push("zen-gardens");
          g.chooseTravelRoute("zen-gardens");
        }
      }
      if (branch.id === "water-decay") target = a.object;
      if (branch.id === "love-dirty" && [2, 5].includes(power.level))
        g.selectSecondaryTarget(a.other.id);
      if (
        (branch.id === "dark-heal" && power.level === 7) ||
        (branch.id === "earth-take" && power.level === 5)
      ) {
        target = a.foe;
        target.dead = true;
        target.health = 0;
        target.resolved = "defeated";
        target.recoverable = true;
        target.deathKey = g.recordNPCDeath(target);
      }
      g.targetId = target?.id || null;
      const before = g.player.essence;
      assert.equal(g.cast(), true, `${power.id}: ${g.log[0]?.text}`);
      assert.equal(
        g.player.essence,
        before,
        `${power.id} spends nothing during free preparation`,
      );
      settle(g);
      assert.equal(
        g.player.essence,
        before - power.essenceCost,
        `${power.id} settles its catalog cost once`,
      );
      assert.equal(
        g.cooldowns[power.id],
        g.time + power.cooldown,
        `${power.id} sets its own cooldown`,
      );
      assert.ok(
        Number.isFinite(g.player.health),
        `${power.id} preserves numeric health`,
      );
      assert.doesNotThrow(
        () => JSON.stringify(g.exportCheckpoint()),
        `${power.id} saves as plain data`,
      );
      count++;
    }
  assert.equal(count, 87);
});

test("stale range and newly placed solid cover reject a prepared cast without Essence or cooldown", () => {
  const g = fresh({ isolated: false });
  g.player.x = 920;
  g.player.y = 900;
  g.entities = [
    {
      id: "foe",
      kind: "enemy",
      name: "Hostile",
      x: 1050,
      y: 900,
      health: 100,
      maxHealth: 100,
      home: { x: 1050, y: 900 },
    },
  ];
  g.player.learned["light-harm"] = 1;
  g.setPower("light-harm", 1);
  g.targetId = "foe";
  assert.equal(g.cast(), true);
  g.entities[0].x = 2000;
  settle(g);
  assert.equal(g.player.essence, 100);
  assert.equal(g.cooldowns["light-harm-1"], undefined);
  g.entities[0].x = 1050;
  assert.equal(g.cast(), true);
  g.sanctuary.components.push({
    id: "wall",
    templateId: "wall",
    zoneId: g.zone.id,
    x: 990,
    y: 900,
    width: 20,
    height: 100,
    blocking: true,
  });
  settle(g);
  assert.equal(g.player.essence, 100);
  assert.equal(g.cooldowns["light-harm-1"], undefined);
});

test("an accepted secondary donor is revalidated even if selection changes during preparation", () => {
  const g = fresh(),
    a = actors(g);
  g.player.learned["dark-heal"] = 2;
  g.player.enhancements["dark-empowerment"] = 4;
  g.player.enhancementSelection["dark-empowerment"] = 4;
  g.setPower("dark-heal", 2);
  g.targetId = a.friend.id;
  g.selectSecondaryTarget(a.foe.id);
  assert.equal(g.cast(), true);
  a.foe.x = 2300;
  g.selectSecondaryTarget(a.other.id);
  settle(g);
  assert.equal(g.player.essence, 100);
  assert.equal(a.friend.health, 20);
  assert.equal(a.other.health, 500);
});

test("all forty enhancement ranks produce distinct profiles or bounded selected effects without stacking lower ranks", () => {
  let count = 0;
  for (const track of ENHANCEMENTS)
    for (const rank of track.ranks) {
      const g = fresh();
      g.player.enhancements[track.id] = 5;
      g.player.learned[track.branchId] = 10;
      g.equipEnhancement(track.id, rank.rank);
      g.setPower(track.branchId, 1);
      const profile = g.getPower().power;
      assert.equal(profile.enhancementRank, rank.rank);
      assert.equal(profile.enhancementId, track.id);
      assert.equal(g.player.enhancementSelection[track.id], rank.rank);
      assert.ok(Number.isFinite(profile.magnitude));
      count++;
    }
  assert.equal(count, 40);
  const g = fresh(),
    a = actors(g);
  g.player.learned["love-laugh"] = 2;
  g.player.enhancementSelection["love-enhancement"] = 2;
  g.player.equipment.focus = "focus";
  g.setPower("love-laugh", 1);
  g.targetId = a.npc.id;
  g.cast();
  settle(g);
  assert.equal(
    a.npc.morale,
    66,
    "15% strongest outgoing modifier replaces the focus instead of multiplying both",
  );
});

test("Empathic Aura shields the caster and at most three consenting nearby allies", () => {
  const g = fresh(),
    a = actors(g);
  g.player.learned["love-laugh"] = 1;
  g.player.enhancementSelection["love-enhancement"] = 4;
  g.entities.push(
    ...Array.from({ length: 5 }, (_, i) => ({
      ...a.friend,
      id: "willing-" + i,
      x: 510 + i,
      y: 510,
      statuses: [],
    })),
  );
  g.setPower("love-laugh", 1);
  g.targetId = a.npc.id;
  g.cast();
  settle(g);
  assert.equal(g.player.statuses.find((s) => s.type === "ward").barrier, 15);
  assert.equal(
    g.entities.filter((n) => n.statuses?.some((s) => s.type === "ward")).length,
    3,
  );
});

test("Divine Aether ignores one ordinary route slowdown while an ordinary travel cast retains it", () => {
  const g = fresh();
  g.worldModel.weather = { id: "rain", routeSlowdown: 0.3 };
  g.player.learned["air-move"] = 6;
  g.setPower("air-move", 5);
  assert.ok(Math.abs(g.getPower().power.castTime - 3.9) < 1e-9);
  g.player.enhancementSelection["air-augmentation"] = 5;
  assert.equal(g.getPower().power.castTime, 3);
  assert.equal(g.getPower().power.ignoredWeatherSlowdown, true);
});

test("lingering spell fields and affliction identities cannot affect a different region with matching entity IDs", () => {
  const g = fresh(),
    a = actors(g);
  g.player.learned["dark-pain"] = 2;
  g.setPower("dark-pain", 2);
  g.targetId = a.foe.id;
  g.cast();
  settle(g);
  g.localMagic.fields.push({
    id: "source",
    zoneId: g.zone.id,
    kind: "morale",
    x: 540,
    y: 500,
    radius: 100,
    amount: 50,
    targetCap: 3,
    seen: [],
    until: g.time + 10,
  });
  g.zone = { ...g.zone, id: "zen-gardens" };
  g.time += 2;
  g.update(0);
  assert.equal(a.foe.health, 500);
  assert.equal(a.npc.morale, 50);
});

test("a captured fallen identity becomes resurrectable only after its capture ends", () => {
  const g = fresh(),
    a = actors(g);
  g.player.learned["earth-take"] = 5;
  g.player.learned["dark-heal"] = 7;
  a.foe.dead = true;
  a.foe.health = 0;
  a.foe.resolved = "defeated";
  a.foe.deathKey = g.recordNPCDeath(a.foe);
  g.setPower("earth-take", 5);
  g.targetId = a.foe.id;
  g.cast();
  settle(g);
  assert.equal(g.canResurrect(a.foe.id).valid, false);
  g.time += 11;
  assert.equal(g.canResurrect(a.foe.id).valid, true);
});

test("Destructive Flood follows its previewed path instead of striking unrelated side structures", () => {
  const g = fresh(),
    a = actors(g);
  g.player.learned["water-decay"] = 4;
  a.object.x = 700;
  a.object.y = 500;
  g.entities.push({
    ...a.object,
    id: "side-structure",
    x: 680,
    y: 600,
    durability: 200,
  });
  g.setPower("water-decay", 4);
  g.targetId = a.object.id;
  g.cast();
  settle(g);
  assert.equal(a.object.durability, 168);
  assert.equal(
    g.entities.find((n) => n.id === "side-structure").durability,
    200,
  );
});
