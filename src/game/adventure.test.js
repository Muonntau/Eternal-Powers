import test from "node:test";
import assert from "node:assert/strict";
import { GameEngine } from "./engine.js";
import {
  ACTIVITY_TYPES,
  FACTION_CAMPAIGNS,
  updateAdventure,
} from "./adventure.js";
import { BRANCHES, ZONES } from "../data/manual.js";
const memory = () => {
  const data = new Map();
  return {
    getItem: (k) => data.get(k) || null,
    setItem: (k, v) => data.set(k, v),
    removeItem: (k) => data.delete(k),
  };
};
function fresh(
  lineage = "angel",
  starterBranch = lineage === "angel" ? "water-grow" : "fire-create",
) {
  const storage = memory(),
    g = new GameEngine(null, { headless: true, storage });
  assert.equal(
    g.createCharacter({
      name: "Aster",
      lineage,
      starterBranch,
      appearance: {},
    }),
    true,
  );
  updateAdventure(g);
  return g;
}
function actor(g, role) {
  return g.entities.find(
    (n) =>
      n.adventureActor &&
      (n.role === role || n.activityType === role) &&
      n.role !== "relay-finish",
  );
}
function approach(g, n) {
  g.player.x = n.x - 25;
  g.player.y = n.y;
  g.lastDamage = -1000;
  g.lastAction = -1000;
  g.entities.forEach((e) => {
    if (e.kind === "enemy") e.dead = true;
  });
}
function cast(g, n, { delay = 5 } = {}) {
  approach(g, n);
  g.time += delay;
  g.player.essence = 100;
  g.cooldowns = {};
  g.selectTarget(n.id);
  assert.equal(
    g.cast(),
    true,
    `cast on ${n.name}: ${g.getSnapshot().powerPreview?.reason}`,
  );
  const c = g.castState;
  assert.ok(c);
  g.time = c.resolveAt;
  g.castState = null;
  assert.notEqual(g.resolveCast(c), false);
}
function completeActivity(g, type) {
  let n = actor(g, type);
  approach(g, n);
  if (type === "runegate" || type === "ward")
    for (const phase of type === "runegate" ? [1, 3, 2] : [1, 2, 3]) {
      n = actor(g, type);
      approach(g, n);
      assert.equal(g.performInteraction(n.id, `phase:${phase}`), true);
      cast(g, actor(g, type));
    }
  else if (type === "skybridge") {
    cast(g, n);
    const r = g.adventure.activities[`${g.zone.id}:${type}`];
    assert.ok(r.challenge);
    Object.assign(g.player, r.challenge.finish);
    updateAdventure(g);
  } else {
    for (let i = 0; i < ACTIVITY_TYPES.find((t) => t.id === type).need; i++)
      cast(g, actor(g, type));
  }
  n = actor(g, type);
  approach(g, n);
  assert.equal(g.inspectInteraction(n.id).activity.ready, true);
  assert.equal(g.performInteraction(n.id, "collect"), true);
}
for (const lineage of ["angel", "demon"])
  test(`${lineage} campaign completes every physical objective, settles rewards once and retains its ending`, () => {
    const g = fresh(lineage),
      campaign = FACTION_CAMPAIGNS[lineage];
    for (const m of campaign.missions) {
      assert.equal(g.adventure.mission, m.index);
      assert.equal(g.setZone(m.zoneId), true);
      updateAdventure(g);
      while (!g.adventure.ready) {
        const s = m.stages[g.adventure.stage];
        assert.ok(s, `stage for ${m.title}`);
        if (s.type === "travel") {
          assert.equal(g.setZone(s.zoneId), true);
          updateAdventure(g);
        } else if (s.type === "talk") {
          const n = actor(
            g,
            m.index === 3 ? "campaign-courier" : "campaign-mentor",
          );
          approach(g, n);
          assert.equal(
            g.performInteraction(n.id, `choice:${s.choices[0].id}`),
            true,
          );
        } else if (s.type === "practice")
          cast(
            g,
            g.entities.find((n) => n.id === "training"),
          );
        else completeActivity(g, s.activity);
      }
      const n = actor(g, "campaign-mentor");
      approach(g, n);
      const before = g.player[lineage === "demon" ? "badKarma" : "goodKarma"];
      assert.equal(g.performInteraction(n.id, "claim"), true);
      assert.equal(
        g.player[lineage === "demon" ? "badKarma" : "goodKarma"],
        before + m.reward,
      );
      assert.equal(g.performInteraction(n.id, "claim"), false);
    }
    assert.equal(g.adventure.completed.length, 12);
    assert.equal(g.adventure.receipts.length, 12);
    assert.ok(g.adventure.ending);
    assert.equal(g.getSnapshot().adventure.objective.complete, true);
    g.save(false);
    const loaded = new GameEngine(null, { headless: true, storage: g.storage });
    assert.deepEqual(loaded.adventure.completed, g.adventure.completed);
    assert.deepEqual(loaded.adventure.ending, g.adventure.ending);
  });
test("every starting affinity can charge a reactive site through actual cast preparation", () => {
  for (const b of BRANCHES) {
    const g = fresh(b.currency === "bad" ? "demon" : "angel", b.id);
    const n = actor(g, "resonator");
    cast(g, n);
    assert.equal(
      g.adventure.activities["sacred-groves:resonator"].step,
      1,
      b.id,
    );
  }
});
test("rune alignment, cancellation, ownership and range revalidate before spending", () => {
  const g = fresh(),
    n = actor(g, "runegate");
  approach(g, n);
  g.selectTarget(n.id);
  assert.equal(g.cast(), false);
  assert.equal(g.player.essence, 100);
  assert.equal(g.performInteraction(n.id, "phase:2"), true);
  cast(g, actor(g, "runegate"));
  assert.equal(g.adventure.activities["sacred-groves:runegate"].step, 0);
  g.performInteraction(n.id, "phase:1");
  g.time += 10;
  g.cooldowns = {};
  assert.equal(g.cast(), true);
  g.cancelCast();
  assert.equal(g.adventure.activities["sacred-groves:runegate"].step, 0);
  const foreign = { ...n, id: "foreign", ownerId: "another" };
  g.entities.push(foreign);
  assert.equal(g.inspectInteraction(foreign.id), null);
  assert.equal(g.performInteraction(foreign.id, "phase:1"), false);
  g.player.x = 4000;
  g.player.y = 3000;
  assert.equal(g.performInteraction(n.id, "phase:1"), false);
});
test("site materials replenish without duplicate rewards or lifetime Karma and timers survive reload", () => {
  const g = fresh();
  completeActivity(g, "bloom");
  const karma = g.player.lifetimeGood,
    herbs = g.player.inventory.herb,
    n = actor(g, "bloom");
  assert.equal(g.performInteraction(n.id, "collect"), false);
  g.save(false);
  const loaded = new GameEngine(null, { headless: true, storage: g.storage });
  assert.ok(
    loaded.inspectInteraction(actor(loaded, "bloom").id).activity.cooldown > 0,
  );
  loaded.time += 76;
  updateAdventure(loaded);
  completeActivity(loaded, "bloom");
  assert.equal(loaded.player.inventory.herb, herbs + 3);
  assert.equal(loaded.player.lifetimeGood, karma);
});
test("all 39 regions have six walkable sites, an envoy, actionable NPCs and a viable relay destination", () => {
  const g = fresh();
  for (const z of ZONES) {
    assert.equal(g.setZone(z.id), true);
    updateAdventure(g);
    for (const type of ACTIVITY_TYPES) {
      const n = actor(g, type.id);
      assert.ok(n);
      assert.equal(
        g.isPositionBlocked(n.x, n.y, { radius: 18 }),
        false,
        `${z.id}:${type.id}`,
      );
      assert.ok(g.inspectInteraction(n.id).actions.length);
    }
    const mentor = actor(g, "campaign-mentor");
    assert.ok(g.inspectInteraction(mentor.id).purpose.includes("envoy"));
    cast(g, actor(g, "skybridge"));
    const r = g.adventure.activities[`${z.id}:skybridge`];
    assert.ok(r.challenge);
    assert.equal(
      g.isPositionBlocked(r.challenge.finish.x, r.challenge.finish.y),
      false,
    );
    assert.ok(
      Math.hypot(
        r.challenge.finish.x - g.player.x,
        r.challenge.finish.y - g.player.y,
      ) > 100,
    );
  }
});

test("all 87 local named powers prepare, revalidate and charge an actual site", () => {
  let count = 0;
  for (const b of BRANCHES)
    for (const p of b.powers.filter((p) => p.kind === "local")) {
      const g = fresh(b.currency === "bad" ? "demon" : "angel", b.id);
      g.player.learned[b.id] = 10;
      g.player.goodKarma = g.player.badKarma = 100000;
      g.setPower(b.id, p.level);
      cast(g, actor(g, "resonator"));
      assert.equal(
        g.adventure.activities["sacred-groves:resonator"].step,
        1,
        p.id,
      );
      count++;
    }
  assert.equal(count, 87);
});
test("all 40 learned cross-affinity techniques charge sites through their real preparation and costs", async () => {
  const { TECHNIQUES } = await import("../data/manual.js");
  for (const t of TECHNIQUES) {
    const g = fresh(),
      n = actor(g, "resonator");
    g.player.techniques = [t.id];
    approach(g, n);
    g.selectTarget(n.id);
    assert.equal(g.useTechnique(t.id), true, t.id);
    const pending = g.techniqueState;
    assert.ok(pending);
    g.time = pending.resolveAt;
    g.techniqueState = null;
    assert.notEqual(g.resolveTechnique(pending), false, t.id);
    assert.equal(
      g.adventure.activities["sacred-groves:resonator"].step,
      1,
      t.id,
    );
    assert.equal(g.player.essence, 100 - t.essenceCost, t.id);
  }
});
