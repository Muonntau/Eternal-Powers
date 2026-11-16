import test from "node:test";
import assert from "node:assert/strict";
import { ZONES, CREATURES, BRANCHES } from "../data/manual.js";
import {
  POWER_CATALOG,
  POWER_BY_ID,
  starterLoadout,
  starterUnlocked,
  POWER_BRANCHES,
} from "./catalog.js";
import {
  createRegion,
  isBlocked,
  hash,
  seededRandom,
  biomeFor,
} from "./world.js";

function flood(world, start) {
  const cell = 40,
    cols = Math.ceil(world.width / cell),
    rows = Math.ceil(world.height / cell),
    toGrid = (p) => [Math.floor(p.x / cell), Math.floor(p.y / cell)];
  const point = (x, y) => ({ x: x * cell + cell / 2, y: y * cell + cell / 2 }),
    seen = new Set(),
    pending = [toGrid(start)],
    key = (x, y) => y * cols + x;
  seen.add(key(...pending[0]));
  for (let i = 0; i < pending.length; i++) {
    const [x, y] = pending[i];
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const xx = x + dx,
        yy = y + dy,
        k = key(xx, yy),
        p = point(xx, yy);
      if (
        xx < 0 ||
        yy < 0 ||
        xx >= cols ||
        yy >= rows ||
        seen.has(k) ||
        isBlocked(world, p.x, p.y, 16)
      )
        continue;
      seen.add(k);
      pending.push([xx, yy]);
    }
  }
  return (p) => {
    const [x, y] = toGrid(p);
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        if (seen.has(key(x + dx, y + dy))) return true;
    return false;
  };
}
test("the action catalog preserves all 160 manual identities while replacing friction with fast affordable casts", () => {
  assert.equal(POWER_CATALOG.length, 160);
  assert.equal(new Set(POWER_CATALOG.map((p) => p.id)).size, 160);
  assert.equal(POWER_BRANCHES.length, 16);
  for (const b of BRANCHES)
    for (const source of b.powers) {
      const p = POWER_BY_ID[source.id];
      assert.equal(p.name, source.name);
      assert.equal(p.domain, b.domain);
      assert.equal(p.manualKind, source.kind);
      assert.equal(p.manualEssenceCost, source.essenceCost);
      assert.equal(p.castTime, 0);
      assert.ok(p.cooldown <= 8);
      assert.ok(p.essenceCost <= 12);
      assert.ok(p.unlockCost <= 5);
      assert.ok(p.damage >= 24);
      assert.ok(p.range >= 600);
      assert.ok(p.actionDescription);
      assert.ok(p.comboHint);
      assert.ok(
        ["bolt", "beam", "nova", "dash", "orbit", "summon", "chain"].includes(
          p.style,
        ),
      );
    }
  assert.equal(new Set(POWER_CATALOG.map((p) => p.style)).size, 7);
});
test("all lineages start with every basic affinity and a usable ultimate in a six-power loadout", () => {
  for (const b of BRANCHES) {
    const slots = starterLoadout(
        b.id,
        b.currency === "bad" ? "demon" : "angel",
      ),
      unlocked = starterUnlocked(b.id);
    assert.equal(slots.length, 6);
    assert.equal(new Set(slots).size, 6);
    assert.equal(slots[0], `${b.id}-1`);
    assert.equal(slots[5], `${b.id}-8`);
    assert.equal(POWER_BY_ID[slots[5]].ultimate, true);
    assert.equal(unlocked.length, 17);
    assert.ok(slots.every((id) => unlocked.includes(id)));
    assert.equal(
      unlocked.filter((id) => POWER_BY_ID[id].level === 1).length,
      16,
    );
  }
});
test("each of the 39 regions has a connected combat loop, walkable loot, safe arrival, boss and 38 ordinary encounters", () => {
  const represented = new Set(),
    varied = new Set();
  for (const zone of ZONES) {
    const w = createRegion(zone.id),
      reachable = flood(w, w.spawn);
    assert.equal(w.id, zone.id);
    assert.equal(w.realm, zone.realm);
    assert.equal(w.width, 2800);
    assert.equal(w.height, 2000);
    assert.equal(isBlocked(w, w.spawn.x, w.spawn.y, 24), false);
    assert.ok(w.paths.length >= 3);
    assert.ok(w.features.length >= 7);
    assert.equal(w.enemies.length, 39);
    assert.equal(w.enemies.filter((e) => e.boss).length, 1);
    assert.equal(w.enemies.filter((e) => e.elite).length, 3);
    assert.equal(w.enemies.filter((e) => !e.boss && !e.elite).length, 35);
    assert.equal(w.chests.length, 4);
    assert.equal(w.portals.length, 1);
    assert.equal(w.challenges[0].waves, 3);
    assert.ok(w.props.filter((p) => p.destructible).length >= 15);
    for (const p of [
      ...w.enemies,
      ...w.chests,
      ...w.portals,
      ...w.challenges,
      ...w.features,
    ]) {
      assert.equal(
        isBlocked(w, p.x, p.y, 16),
        false,
        `${zone.id}: ${p.id} is open`,
      );
      assert.ok(reachable(p), `${zone.id}: ${p.id} reachable from refuge`);
    }
    for (const e of w.enemies) {
      assert.ok(CREATURES.some((c) => c.id === e.creatureId));
      represented.add(e.creatureId);
      assert.ok(Math.hypot(e.x - w.spawn.x, e.y - w.spawn.y) > 290);
      assert.ok(e.windup >= 0.6);
      assert.ok(e.health > 0 && e.damage > 0);
      assert.ok(e.tell);
      assert.ok(e.drops.shards >= 1);
      assert.ok(e.xp >= 10);
    }
    varied.add(JSON.stringify(w.obstacles));
  }
  assert.equal(represented.size, 30);
  assert.equal(varied.size, 39);
});
test("deterministic worlds, fresh runtime objects and local collision bounds cannot corrupt the manual or another visit", () => {
  const a = createRegion("sacred-groves"),
    b = createRegion("sacred-groves");
  assert.deepEqual(a, b);
  const c = createRegion("sacred-groves", { seed: 5 });
  assert.notDeepEqual(c.obstacles, a.obstacles);
  a.enemies[0].health = 0;
  a.chests[0].opened = true;
  a.props[0].destroyed = true;
  a.palette.ground = "red";
  assert.ok(b.enemies[0].health > 0);
  assert.equal(b.chests[0].opened, false);
  assert.equal(b.props[0].destroyed, undefined);
  assert.notEqual(b.palette.ground, "red");
  assert.equal(isBlocked(b, 0, 0), true);
  assert.equal(isBlocked(b, b.width, b.height), true);
  const o = b.obstacles[0];
  assert.equal(isBlocked(b, o.x + o.width / 2, o.y + o.height / 2, 1), true);
  o.destroyed = true;
  assert.equal(isBlocked(b, o.x + o.width / 2, o.y + o.height / 2, 1), false);
  assert.equal(hash("stable"), hash("stable"));
  const r1 = seededRandom(42),
    r2 = seededRandom(42);
  assert.deepEqual(
    Array.from({ length: 10 }, r1),
    Array.from({ length: 10 }, r2),
  );
  assert.equal(biomeFor({ id: "infernal-gates", realm: "hell" }), "hell");
  assert.equal(biomeFor({ id: "cosmic-deserts", realm: "earth" }), "desert");
  assert.equal(
    biomeFor({ id: "prismatic-waterfalls", realm: "earth" }),
    "water",
  );
});
