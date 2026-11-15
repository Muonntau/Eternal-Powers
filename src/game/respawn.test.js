import test from "node:test";
import assert from "node:assert/strict";
import { initRespawns, updateRespawns, serializeRespawns } from "./respawn.js";
const fixture = () => ({
  zone: { id: "forest" },
  world: { spawn: { x: 100, y: 100 } },
  player: { x: 100, y: 100 },
  entities: [
    {
      id: "wild-one",
      kind: "enemy",
      x: 1000,
      y: 900,
      home: { x: 1000, y: 900 },
      health: 50,
      maxHealth: 50,
      respawnSeconds: 5,
    },
    {
      id: "ore-one",
      kind: "resource",
      item: "stone",
      x: 1200,
      y: 900,
      renewable: true,
      respawnSeconds: 5,
    },
    {
      id: "story-chest",
      kind: "chest",
      x: 1400,
      y: 900,
      renewable: true,
      collected: true,
    },
    {
      id: "guardian",
      kind: "enemy",
      boss: true,
      x: 1800,
      y: 900,
      dead: true,
      health: 0,
      maxHealth: 500,
    },
  ],
});
test("wilderness enemies and materials respawn with new claim identities while story objects remain settled", () => {
  const g = fixture();
  initRespawns(g);
  updateRespawns(g, 0);
  g.entities[0].dead = true;
  g.entities[0].health = 0;
  g.entities[1].collected = true;
  updateRespawns(g, 4);
  assert.equal(g.entities[0].dead, true);
  updateRespawns(g, 1);
  assert.equal(g.entities[0].health, 50);
  assert.equal(g.entities[0].id, "wild-one:spawn:1");
  assert.equal(g.entities[1].id, "ore-one:spawn:1");
  assert.equal(g.entities[1].collected, undefined);
  assert.equal(g.entities[2].collected, true);
  assert.equal(g.entities[3].dead, true);
});
test("respawn waits for every nearby player to leave and retains its timer across save/load", () => {
  const g = fixture();
  initRespawns(g);
  updateRespawns(g, 0);
  g.entities[0].dead = true;
  updateRespawns(g, 3);
  const saved = serializeRespawns(g);
  initRespawns(g, saved);
  updateRespawns(g, 2, { players: [{ x: 1000, y: 900 }] });
  assert.equal(g.entities[0].dead, true);
  updateRespawns(g, 0.1, { players: [{ x: 50, y: 50 }] });
  assert.equal(g.entities[0].id, "wild-one:spawn:1");
});
test("living damaged entities retain health and sanctuary resources remain finite", () => {
  const g = fixture();
  g.entities[0].health = 12;
  g.entities.push({
    id: "safe",
    kind: "resource",
    renewable: true,
    x: 110,
    y: 110,
    collected: true,
    respawnSeconds: 5,
  });
  updateRespawns(g, 200);
  assert.equal(g.entities[0].health, 12);
  assert.equal(g.entities.at(-1).collected, true);
});

test("restoring a renewed generation clears stale canonical collection and death flags", () => {
  const g = fixture();
  initRespawns(g);
  updateRespawns(g, 0);
  g.entities[0].dead = true;
  g.entities[0].health = 0;
  g.entities[1].collected = true;
  updateRespawns(g, 5);
  const saved = serializeRespawns(g);
  const restored = fixture();
  restored.entities[0].dead = true;
  restored.entities[0].health = 0;
  restored.entities[1].collected = true;
  initRespawns(restored, saved);
  assert.equal(restored.entities[0].id, "wild-one:spawn:1");
  assert.equal(restored.entities[0].dead, undefined);
  assert.equal(restored.entities[0].health, 50);
  assert.equal(restored.entities[1].id, "ore-one:spawn:1");
  assert.equal(restored.entities[1].collected, undefined);
});

test("an immediate collection after save remains settled when another zone becomes active", () => {
  const g = fixture();
  initRespawns(g);
  updateRespawns(g, 0);
  g.entities[1].collected = true;
  updateRespawns(g, 5);
  serializeRespawns(g);
  g.entities[1].collected = true;
  const oldEntities = g.entities;
  g.zone = { id: "mountains" };
  g.entities = [];
  initRespawns(g);
  g.zone = { id: "forest" };
  g.entities = fixture().entities;
  initRespawns(g);
  assert.equal(g.entities[1].id, "ore-one:spawn:1");
  assert.equal(g.entities[1].collected, true);
  assert.notEqual(g.entities[1], oldEntities[1]);
  updateRespawns(g, 4);
  assert.equal(g.entities[1].collected, true);
  updateRespawns(g, 1);
  assert.equal(g.entities[1].id, "ore-one:spawn:2");
  assert.equal(g.entities[1].collected, undefined);
});

test("renewal waits for a power-created obstacle at the spawn anchor to clear", () => {
  const g = fixture();
  let blocked = true;
  g.isPositionBlocked = (x, y) => blocked && x === 1000 && y === 900;
  updateRespawns(g, 0);
  g.entities[0].dead = true;
  updateRespawns(g, 5);
  assert.equal(g.entities[0].dead, true);
  assert.equal(g.respawns.zones.forest["wild-one"].remaining, 0);
  blocked = false;
  updateRespawns(g, 0);
  assert.equal(g.entities[0].dead, undefined);
  assert.equal(g.entities[0].id, "wild-one:spawn:1");
});

test("finite offerings and protected story identities never gain a renewable receipt", () => {
  const g = fixture();
  g.entities = [
    {
      id: "contact",
      kind: "npc",
      role: "encounter-contact",
      renewable: true,
      collected: true,
      x: 900,
      y: 900,
    },
    {
      id: "story",
      kind: "enemy",
      story: true,
      renewable: true,
      dead: true,
      x: 900,
      y: 900,
    },
    {
      id: "cargo",
      kind: "resource",
      questItem: true,
      renewable: true,
      collected: true,
      x: 900,
      y: 900,
    },
    {
      id: "protected",
      kind: "enemy",
      protected: true,
      renewable: true,
      dead: true,
      x: 900,
      y: 900,
    },
  ];
  updateRespawns(g, 1000);
  assert.deepEqual(Object.keys(g.respawns.zones.forest), []);
  assert.ok(g.entities.every((n) => n.dead || n.collected));
});
