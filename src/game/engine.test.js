import test from "node:test";
import assert from "node:assert/strict";
import { GameEngine } from "./engine.js";
import { BRANCHES, TECHNIQUES } from "../data/manual.js";

const storage = new Map();
globalThis.localStorage = {
  getItem: (k) => storage.get(k) || null,
  setItem: (k, v) => storage.set(k, v),
  removeItem: (k) => storage.delete(k),
};
globalThis.window = {
  devicePixelRatio: 1,
  addEventListener() {},
  removeEventListener() {},
};
const canvas = () => ({
  getContext: () => ({}),
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000, height: 650 }),
  addEventListener() {},
  removeEventListener() {},
  focus() {},
});
function fresh() {
  storage.clear();
  return new GameEngine(null, { headless: true });
}
function commit(g) {
  const c = g.castState;
  assert.ok(c, "cast was accepted");
  g.time = c.resolveAt;
  g.castState = null;
  g.resolveCast(c);
}

test("preview cancellation is free; training settles its reward exactly once", () => {
  const g = fresh();
  g.selectTarget("training");
  assert.equal(g.cast(), true);
  assert.equal(g.player.essence, 100);
  g.cancelCast();
  assert.equal(g.player.essence, 100);
  assert.equal(g.player.goodKarma, 125);
  g.cast();
  commit(g);
  assert.equal(g.player.essence, 90);
  assert.equal(g.player.goodKarma, 150);
  assert.equal(g.player.lifetimeGood, 25);
  g.time += 6;
  g.cast();
  commit(g);
  assert.equal(g.player.goodKarma, 150);
  assert.equal(g.player.lifetimeGood, 25);
});

test("protected NPC hostile casts and out-of-range casts spend no Essence", () => {
  const g = fresh();
  g.player.learned["light-harm"] = 1;
  g.setPower("light-harm", 1);
  g.selectTarget("keeper");
  assert.equal(g.cast(), false);
  assert.equal(g.player.essence, 100);
  g.selectTarget("guardian");
  assert.equal(g.cast(), false);
  assert.equal(g.player.essence, 100);
});

test("harvesting, public restoration, and purchases preserve settlement rules", () => {
  const g = fresh();
  const herb = g.entities.find((n) => n.item === "herb");
  g.player.x = herb.x;
  g.player.y = herb.y;
  g.selectTarget(herb.id);
  g.interact();
  assert.equal(g.player.inventory.herb, 1);
  g.interact();
  assert.equal(g.player.inventory.herb, 1);
  g.player.inventory.herb = 2;
  g.player.inventory.residue = 1;
  g.sanctuary.recipePlans.draught = true;
  g.player.x = 1080;
  g.player.y = 870;
  assert.equal(g.craftItem("draught"), true);
  assert.equal(g.player.inventory.herb, 0);
  assert.equal(g.player.inventory.draught, 3);
  g.update(5);
  assert.equal(g.player.inventory.draught, 4);
  const lifetime = g.player.lifetimeGood;
  assert.equal(g.buyItem("draught"), true);
  assert.equal(g.player.lifetimeGood, lifetime);
  assert.equal(g.player.goodKarma, 100);
});

test("restoring all habitat opens a peaceful guardian resolution and rank trial", () => {
  const g = fresh();
  for (const n of g.entities.filter((n) => n.kind === "patch")) {
    g.player.x = n.x;
    g.player.y = n.y;
    g.targetId = n.id;
    g.time += 7;
    g.player.essence = 100;
    assert.equal(g.cast(), true);
    commit(g);
    assert.equal(n.restored, true);
  }
  const boss = g.entities.find((n) => n.id === "guardian");
  g.player.x = boss.x - 100;
  g.player.y = boss.y;
  g.selectTarget(boss.id);
  g.time += 7;
  g.player.essence = 100;
  assert.equal(g.cast(), true);
  commit(g);
  assert.equal(boss.dead, true);
  assert.equal(boss.resolved, "restored");
  assert.ok(g.trialRanks.includes(2));
  g.player.lifetimeGood = 500;
  g.tryRankUp();
  assert.equal(g.player.rank, 2);
  assert.equal(g.player.maxHealth, 110);
});

test("save/load retains resolved encounters and resources without duplicating rewards", () => {
  const g = fresh();
  const enemy = g.entities.find((n) => n.id === "blight-1");
  g.resolveEnemy(enemy, false);
  const resource = g.entities.find((n) => n.item === "crystal");
  g.player.x = resource.x;
  g.player.y = resource.y;
  g.targetId = resource.id;
  g.interact();
  g.save(false);
  const rewards = [...g.rewardedEncounters];
  const h = new GameEngine(null, { headless: true });
  assert.equal(h.entities.find((n) => n.id === "blight-1").dead, true);
  assert.equal(h.entities.find((n) => n.id === resource.id).collected, true);
  assert.deepEqual(h.rewardedEncounters, rewards);
});

test("guard, equipped wards, and dodge reduce direct damage", () => {
  const g = fresh();
  g.player.guard = true;
  g.player.equipment.ward = "ward";
  g.damagePlayer(20, "test");
  assert.equal(g.player.health, 89.2);
  g.player.dodgeUntil = g.time + 0.5;
  g.damagePlayer(20, "test");
  assert.equal(g.player.health, 89.2);
});

test("unused starter replacement grants one branch and progression locks the choice", () => {
  const g = fresh();
  assert.equal(g.setLineage("angel", "love-laugh"), true);
  assert.deepEqual(g.player.learned, { "love-laugh": 1 });
  assert.equal(g.setLineage("angel", "air-move"), true);
  assert.deepEqual(g.player.learned, { "air-move": 1 });
  g.selectTarget("training");
  g.cast();
  commit(g);
  assert.equal(g.setLineage("demon", "fire-create"), false);
  assert.equal(g.player.lineage, "angel");
  assert.deepEqual(g.player.learned, { "air-move": 1 });
});

test("demon has authored native progression; opposite outcomes do not mint a wallet", () => {
  const g = fresh();
  g.setLineage("demon", "hate-cry");
  assert.equal(g.player.badKarma, 125);
  assert.equal(g.player.goodKarma, 0);
  g.progress("practice");
  assert.equal(g.player.lifetimeGood, 0);
  assert.equal(g.player.goodKarma, 0);
  for (const patch of g.entities.filter((n) => n.kind === "patch"))
    g.erodePatch(patch, 42);
  assert.equal(g.player.badKarma, 225);
  assert.equal(g.player.lifetimeBad, 100);
  for (const patch of g.entities.filter((n) => n.kind === "patch"))
    g.restorePatch(patch, 100);
  assert.equal(
    g.questProgress["restore-grove"] || 0,
    0,
    "repairing self-created damage is ineligible",
  );
});

test("regional trial gates support celestial ranks eight through ten", () => {
  const g = fresh();
  g.player.rank = 7;
  g.player.lifetimeGood = 40500;
  g.player.certified = true;
  for (const [id, expected] of [
    ["astral-observatory", 8],
    ["celestial-observatories", 9],
    ["city-of-stars", 10],
  ]) {
    g.setZone(id);
    const guardian = g.entities.find((n) => n.id === "guardian");
    g.resolveEnemy(guardian, true);
    assert.equal(g.player.rank, expected);
    assert.ok(g.trialRanks.includes(expected));
  }
});

test("full vitality healing rejects a selected full NPC without spending", () => {
  const g = fresh();
  g.player.learned["dark-heal"] = 1;
  g.setPower("dark-heal", 1);
  const keeper = g.entities.find((n) => n.id === "keeper");
  g.player.x = keeper.x;
  g.player.y = keeper.y;
  g.selectTarget("keeper");
  assert.equal(g.cast(), false);
  assert.equal(g.player.essence, 100);
  assert.equal(g.cooldowns["dark-heal-1"], undefined);
});

test("one enhancement modifier is equipped; its actual spell result changes", () => {
  const g = fresh();
  g.setLineage("angel", "love-laugh");
  g.player.goodKarma = 1000;
  assert.equal(g.trainEnhancement("love-enhancement"), true);
  assert.equal(g.player.enhancementSelection["love-enhancement"], 1);
  assert.equal(g.getPower().power.magnitude, 19);
  g.player.rank = 3;
  assert.equal(g.trainEnhancement("love-enhancement"), true);
  assert.equal(g.getPower().power.magnitude, 16);
  assert.equal(g.equipEnhancement("love-enhancement", 1), true);
  assert.equal(g.getPower().power.magnitude, 19);
});

test("trained techniques spend once on resolution, establish barriers, and reject repeats", () => {
  const g = fresh();
  g.player.certified = true;
  g.player.rank = 3;
  g.player.badKarma = 10000;
  g.player.learned["dark-heal"] = 1;
  for (const id of [
    "divine-renewal",
    "purifying-reprieve",
    "benevolent-empowerment",
  ])
    assert.equal(g.trainTechnique(id), true);
  assert.equal(g.trainTechnique("tenebrous-blessing"), true);
  assert.equal(g.player.badKarma, 7500);
  assert.equal(g.useTechnique("tenebrous-blessing"), true);
  assert.equal(g.player.essence, 100);
  const c = g.techniqueState;
  g.time = c.resolveAt;
  g.techniqueState = null;
  g.resolveTechnique(c);
  assert.equal(g.player.essence, 80);
  assert.equal(g.player.statuses.find((s) => s.type === "ward").barrier, 25);
  g.damagePlayer(20, "test");
  assert.equal(g.player.health, 100);
  assert.equal(g.player.statuses.find((s) => s.type === "ward").barrier, 5);
  assert.equal(g.useTechnique("tenebrous-blessing"), false);
});

test("ritual cast opens a reviewable preview and cannot silently commit resources", () => {
  const g = fresh();
  g.player.rank = 10;
  g.player.learned["water-grow"] = 10;
  g.setPower("water-grow", 10);
  const preview = g.cast();
  assert.equal(preview.valid, false);
  assert.equal(g.player.essence, 100);
  assert.equal(g.rituals.length, 0);
});

test("reload retains remaining cooldowns and restores high-rank encounter bounds", () => {
  const g = fresh();
  g.player.rank = 8;
  g.setZone("city-of-stars");
  const guardian = g.entities.find((n) => n.id === "guardian");
  guardian.health = guardian.maxHealth - 20;
  const max = guardian.maxHealth;
  g.time = 42;
  g.cooldowns["water-grow-1"] = 51;
  g.player.essence = 70;
  g.save(false);
  const h = new GameEngine(null, { headless: true });
  assert.equal(h.cooldowns["water-grow-1"] - h.time, 9);
  assert.equal(h.player.essence, 70);
  const restored = h.entities.find((n) => n.id === "guardian");
  assert.equal(restored.maxHealth, max);
  assert.equal(restored.health, max - 20);
  assert.ok(restored.health <= restored.maxHealth);
});

function ritualist(branch = "water-grow", level = 10) {
  const g = fresh();
  g.player.rank = 10;
  g.trialRanks = [2, 3, 4, 5, 6, 7, 8, 9, 10];
  g.player.learned[branch] = level;
  g.player.goodKarma = 30000;
  g.player.badKarma = 30000;
  g.player.essence = 100;
  g.player.certified = true;
  g.player.x = 915;
  g.player.y = 800;
  return g;
}

test("ritual preview covers all sites and pre-commit escrow cancels without loss", () => {
  const g = ritualist(),
    p = g.previewRitual("water-grow", 10);
  assert.equal(p.valid, true);
  assert.equal(p.stageCount, 5);
  assert.equal(p.costs.essence, 80);
  assert.equal(p.costs.karma, 10000);
  assert.equal(p.affectedSites.length, 13);
  assert.equal(g.player.goodKarma, 30000);
  const begun = g.beginRitual("water-grow", 10);
  assert.ok(begun);
  assert.equal(g.player.goodKarma, 20000);
  assert.equal(g.player.essence, 20);
  g.cancelRitual();
  assert.equal(g.player.goodKarma, 30000);
  assert.equal(g.player.essence, 100);
  assert.equal(g.worldSystems.conditions.length, 0);
});

test("post-commit interruption retains staged costs, releases remainder, and resumes without duplicate Essence", () => {
  const g = ritualist();
  const p = g.beginRitual("water-grow", 10);
  g.worldSystems.update(60);
  assert.equal(g.worldSystems.active().status, "ready");
  assert.equal(g.commitRitual(), true);
  g.worldSystems.update(4);
  assert.equal(g.worldSystems.active().stage, 1);
  g.cancelRitual();
  assert.equal(g.player.goodKarma, 28000);
  assert.equal(g.player.essence, 20);
  assert.equal(g.resumeRitual(p.id), true);
  assert.equal(g.player.goodKarma, 20000);
  assert.equal(g.player.essence, 20);
  g.worldSystems.update(60);
  g.commitRitual();
  g.worldSystems.update(16);
  const completed = g.worldSystems.projects.find((x) => x.id === p.id);
  assert.equal(completed.status, "complete");
  assert.equal(completed.stageHistory.length, 5);
  assert.equal(completed.spentKarma, 10000);
  assert.equal(g.player.goodKarma, 20000);
  assert.equal(g.worldSystems.conditions[0].siteIds.length, 13);
  assert.equal(
    g.previewRitual("water-grow", 10).valid,
    false,
    "same named power at same sites is daily-limited",
  );
});

test("before-first-stage half-Essence refund cannot be repeated through a free same-day resume", () => {
  const g = ritualist();
  const p = g.beginRitual("water-grow", 10);
  g.worldSystems.update(60);
  g.commitRitual();
  g.cancelRitual();
  assert.equal(g.player.essence, 60);
  assert.equal(g.player.goodKarma, 30000);
  g.resumeRitual(p.id);
  g.worldSystems.update(60);
  g.commitRitual();
  g.cancelRitual();
  assert.equal(g.player.essence, 60);
  assert.equal(g.player.goodKarma, 30000);
});

test("province stages allocate remainder to the final stage and survive a reload", () => {
  const g = ritualist("water-grow", 8);
  g.beginRitual("water-grow", 8);
  g.worldSystems.update(50);
  g.commitRitual();
  g.worldSystems.update(4);
  const p = g.worldSystems.active();
  assert.deepEqual(
    p.stages.map((s) => s.cost),
    [2133, 2133, 2134],
  );
  g.save(false);
  const h = new GameEngine(null, { headless: true });
  assert.equal(h.worldSystems.active().stage, 1);
  assert.equal(h.worldSystems.active().spentKarma, 2133);
  assert.equal(h.player.goodKarma, 23600);
  h.worldSystems.update(8);
  assert.equal(h.worldSystems.projects.at(-1).spentKarma, 6400);
  assert.equal(h.worldSystems.projects.at(-1).status, "complete");
});

test("owner reversal spends 25 percent and never restores spent or exported assets", () => {
  const g = ritualist();
  g.beginRitual("water-grow", 10);
  g.worldSystems.update(60);
  g.commitRitual();
  g.worldSystems.update(20);
  const c = g.worldSystems.conditions[0];
  assert.equal(g.reverseCondition(c.id), true);
  assert.equal(g.player.goodKarma, 17500);
  assert.equal(c.active, false);
  assert.ok(g.worldSystems.regions["sacred-groves"].vitality >= 75);
  assert.equal(g.reverseCondition(c.id), false);
  assert.equal(g.player.goodKarma, 17500);
});

test("counter-project requires three distinct physical anchors and half settled cost", () => {
  const g = ritualist();
  g.player.learned["water-decay"] = 10;
  g.player.inventory.herb = 2;
  g.player.inventory.stone = 2;
  g.player.inventory.crystal = 1;
  g.beginRitual("water-grow", 10);
  g.worldSystems.update(60);
  g.commitRitual();
  g.worldSystems.update(20);
  const c = g.worldSystems.conditions[0];
  assert.equal(g.previewCounterProject(c.id).valid, false);
  for (const a of c.anchors) {
    g.setZone(a.siteId);
    g.player.x = a.x;
    g.player.y = a.y;
    assert.equal(g.completeCounterAnchor(c.id, a.id), true);
    assert.equal(g.completeCounterAnchor(c.id, a.id), false);
  }
  assert.equal(g.previewCounterProject(c.id).valid, true);
  const walletBeforeCounter = g.player.goodKarma;
  assert.equal(g.counterCondition(c.id), true);
  assert.equal(g.player.goodKarma, walletBeforeCounter - 5000);
  assert.equal(c.active, false);
});

test("finite ritual supply lots cannot be minted again by reversal or alternate casts", () => {
  const g = ritualist("earth-give", 10);
  g.beginRitual("earth-give", 10);
  g.worldSystems.update(60);
  g.commitRitual();
  g.worldSystems.update(20);
  const before = Object.values(g.player.inventory).reduce((a, b) => a + b, 0);
  assert.equal(g.claimWorldSupply(), true);
  assert.equal(
    Object.values(g.player.inventory).reduce((a, b) => a + b, 0) - before,
    20,
  );
  assert.equal(g.claimWorldSupply(), false);
  g.reverseCondition(g.worldSystems.conditions[0].id);
  assert.equal(g.claimWorldSupply(), false);
  g.save(false);
  const h = new GameEngine(null, { headless: true });
  assert.equal(h.claimWorldSupply(), false);
});

test("world field work has no idle reward and investigation settles exactly once across reload", () => {
  const g = fresh();
  g.worldSystems.update(0.1);
  const originalWallet = g.player.goodKarma;
  g.worldSystems.update(30);
  assert.equal(g.player.goodKarma, originalWallet);
  let event = g
    .getSnapshot()
    .worldModel.events.find((e) => e.type === "investigation");
  assert.ok(event);
  assert.equal(g.completeWorldEvent(event.id), false);
  for (let i = 0; i < 3; i++) {
    event = g.inspectWorldEvent(event.id);
    g.player.x = event.position.x;
    g.player.y = event.position.y;
    assert.equal(g.advanceWorldEvent(event.id, "inspect"), true);
  }
  assert.equal(g.player.goodKarma, originalWallet + 25);
  const id = event.id;
  g.save(false);
  const h = new GameEngine(null, { headless: true });
  h.worldSystems.update(0.1);
  assert.equal(h.completeWorldEvent(id), false);
  assert.equal(h.player.goodKarma, originalWallet + 25);
});

test("world terrain warns before damage and shelter remains exempt from guard- and dodge-proof ticks", () => {
  const g = fresh();
  g.player.x = 1655;
  g.player.y = 1155;
  g.player.guard = true;
  g.player.dodgeUntil = 1000;
  g.worldSystems.update(0.1);
  assert.equal(g.player.health, 100);
  assert.ok(
    g.getSnapshot().worldModel.hazards.find((h) => h.name === "Unquiet Spring")
      .warning > 0,
  );
  g.worldSystems.update(1);
  assert.equal(g.player.health, 100);
  g.worldSystems.update(1.1);
  assert.equal(g.player.health, 90);
  g.player.x = 920;
  g.player.y = 900;
  g.worldSystems.update(3);
  assert.equal(g.player.health, 90);
});

test("every one of the seventy-three named rituals has a usable staged world-model preview", async () => {
  const { BRANCHES } = await import("../data/manual.js");
  const g = ritualist();
  for (const b of BRANCHES) g.player.learned[b.id] = 10;
  let count = 0;
  for (const b of BRANCHES)
    for (const p of b.powers.filter((p) => p.kind === "ritual")) {
      const preview = g.previewRitual(b.id, p.level);
      assert.equal(preview.valid, true, p.name + ": " + preview.reason);
      assert.equal(
        preview.stages.reduce((n, s) => n + s.cost, 0),
        100 * p.level * p.level,
      );
      assert.equal(
        preview.stages.flatMap((s) => s.siteIds).length,
        preview.affectedSites.length,
      );
      assert.ok(preview.beforeAfter.length > 0);
      count++;
    }
  assert.equal(count, 73);
});

test("a new journey clears world identities, construction, escrow, and starting locks together", () => {
  const g = ritualist();
  g.resolveEnemy(
    g.entities.find((n) => n.id === "blight-1"),
    false,
  );
  g.sanctuary.bank.wood = 20;
  g.sanctuary.components.push({ id: "old-component", templateId: "wall" });
  g.beginRitual("water-grow", 10);
  g.reset();
  assert.equal(g.worldSystems.projects.length, 0);
  assert.equal(g.worldSystems.conditions.length, 0);
  assert.equal(g.sanctuary.components.length, 0);
  assert.deepEqual(g.sanctuary.bank, {});
  assert.equal(!!g.entities.find((n) => n.id === "blight-1").dead, false);
  assert.equal(g.player.starterLocked, false);
  assert.equal(g.player.goodKarma, 125);
  assert.equal(g.player.essence, 100);
});

test("all forty cross-affinity techniques enforce certification, domain practice, ordered training, and one-time prices", () => {
  assert.equal(TECHNIQUES.length, 40);
  for (const lineage of ["angel", "demon"])
    for (const domain of new Set(
      TECHNIQUES.filter((t) => t.lineage === lineage).map((t) => t.domain),
    )) {
      const g = fresh(),
        techniques = TECHNIQUES.filter(
          (t) => t.lineage === lineage && t.domain === domain,
        ).sort((a, b) => a.order - b.order),
        first = techniques[0];
      g.player.lineage = lineage;
      g.player.learned = {};
      g.player.goodKarma = 100000;
      g.player.badKarma = 100000;
      g.player.rank = 3;
      const before = [g.player.goodKarma, g.player.badKarma];
      assert.equal(
        g.trainTechnique(first.id),
        false,
        `${first.id}: uncertified`,
      );
      g.player.certified = true;
      assert.equal(
        g.trainTechnique(first.id),
        false,
        `${first.id}: domain not learned`,
      );
      const branch = BRANCHES.find((b) => b.domain === domain);
      g.player.learned[branch.id] = 1;
      g.player.rank = 2;
      assert.equal(
        g.trainTechnique(first.id),
        false,
        `${first.id}: celestial rank`,
      );
      g.player.rank = 3;
      assert.equal(
        g.trainTechnique(techniques[1].id),
        false,
        `${domain}: ordered prerequisite`,
      );
      assert.deepEqual(
        [g.player.goodKarma, g.player.badKarma],
        before,
        `${domain}: rejected previews cost nothing`,
      );
      for (const technique of techniques) {
        const key = technique.currency === "bad" ? "badKarma" : "goodKarma",
          balance = g.player[key],
          lifetime = [g.player.lifetimeGood, g.player.lifetimeBad];
        assert.equal(g.trainTechnique(technique.id), true, technique.id);
        assert.equal(
          g.player[key],
          balance - technique.trainingCost,
          technique.id,
        );
        assert.equal(
          g.trainTechnique(technique.id),
          false,
          `${technique.id}: duplicate`,
        );
        assert.equal(
          g.player[key],
          balance - technique.trainingCost,
          `${technique.id}: charged once`,
        );
        assert.deepEqual(
          [g.player.lifetimeGood, g.player.lifetimeBad],
          lifetime,
          `${technique.id}: training does not mint standing`,
        );
      }
    }
});

test("all forty named techniques have executable target profiles and settle one cost and cooldown", () => {
  const allies = new Set([
    "divine-renewal",
    "purifying-reprieve",
    "benevolent-empowerment",
    "tenebrous-blessing",
    "celestial-offering",
  ]);
  const self = new Set([
    "divine-retaliation",
    "benevolent-manipulation",
    "twisted-affection",
    "cursed-radiance",
  ]);
  const areas = new Set([
    "benevolent-forge",
    "harmonious-creation",
    "purifying-ignition",
    "benevolent-deception",
    "nurturing-shelter",
  ]);
  const patches = new Set([
    "benevolent-yield",
    "harmonious-growth",
    "malignant-putrefaction",
  ]);
  for (const technique of TECHNIQUES) {
    const g = fresh();
    g.player.lineage = technique.lineage;
    g.player.certified = true;
    g.player.rank = 3;
    g.player.learned[BRANCHES.find((b) => b.domain === technique.domain).id] =
      1;
    g.player.techniques = TECHNIQUES.filter(
      (t) =>
        t.lineage === technique.lineage &&
        t.domain === technique.domain &&
        t.order <= technique.order,
    ).map((t) => t.id);
    g.player.x = 1800;
    g.player.y = 1300;
    g.player.health = 50;
    g.world.props = [];
    g.pointer = { x: 2050, y: 1450 };
    g.player.statuses = [
      { type: "curse", until: 100 },
      { type: "fear", until: 100 },
    ];
    g.player.healReductionUntil = 100;
    const friend = {
      id: "technique-ally",
      name: "Consenting ally",
      kind: "ally",
      x: 1810,
      y: 1300,
      health: 50,
      maxHealth: 100,
      morale: 50,
      statuses: [
        { type: "fear", until: 100 },
        { type: "curse", until: 100 },
      ],
      healReductionUntil: 100,
      consent: true,
    };
    const foe = {
      id: "technique-foe",
      name: "Eligible hostile",
      kind: "enemy",
      lineage: technique.lineage === "angel" ? "demon" : "angel",
      x: 1810,
      y: 1300,
      health: 200,
      maxHealth: 200,
      morale: 50,
      statuses: [{ type: "curse", until: 100 }],
      corrupted: true,
      state: "windup",
      windup: 1,
      home: { x: 1810, y: 1300 },
      controlProtection: {},
    };
    const patch = {
      id: "technique-patch",
      name: "Permitted crop and water bed",
      kind: "water-patch",
      x: 1810,
      y: 1300,
      health: 50,
      maxHealth: 100,
      durability: 100,
      permission: true,
      planted: true,
      growthStage: 1,
      waterPatch: true,
    };
    const food = {
      id: "technique-food",
      name: "One spoiled food unit",
      kind: "food",
      x: 1810,
      y: 1300,
      spoiled: true,
      permission: true,
      bound: false,
    };
    const object = {
      id: "technique-object",
      name: "Permitted structure",
      kind: "object",
      x: 1810,
      y: 1300,
      durability: 70,
      maxDurability: 100,
      permission: true,
    };
    g.entities = [friend, foe, patch, food, object];
    g.localMagic.fields = [
      {
        id: "corrupt-field",
        zoneId: g.zone.id,
        kind: "corruption",
        x: 2050,
        y: 1450,
        radius: 150,
        until: 100,
        removable: true,
      },
    ];
    g.targetId =
      self.has(technique.id) || areas.has(technique.id)
        ? null
        : allies.has(technique.id)
          ? friend.id
          : patches.has(technique.id)
            ? patch.id
            : technique.id === "purifying-nourishment"
              ? food.id
              : technique.id === "malefic-erosion" ||
                  technique.id === "benevolent-catalyst"
                ? object.id
                : technique.id === "redemptive-embrace"
                  ? friend.id
                  : foe.id;
    const before = JSON.stringify({
      player: {
        health: g.player.health,
        statuses: g.player.statuses,
        veil: g.player.veil,
      },
      entities: g.entities,
      magic: g.localMagic,
    });
    assert.equal(
      g.useTechnique(technique.id),
      true,
      `${technique.id}: ${g.log[0]?.text}`,
    );
    assert.equal(
      g.player.essence,
      100,
      `${technique.id}: preparation does not charge`,
    );
    const cast = g.techniqueState;
    g.time = cast.resolveAt;
    g.techniqueState = null;
    assert.equal(g.resolveTechnique(cast), true, `${technique.id}: resolve`);
    assert.equal(g.player.essence, 80, technique.id);
    assert.equal(g.cooldowns[technique.id], g.time + 20, technique.id);
    assert.notEqual(
      JSON.stringify({
        player: {
          health: g.player.health,
          statuses: g.player.statuses,
          veil: g.player.veil,
        },
        entities: g.entities,
        magic: g.localMagic,
      }),
      before,
      `${technique.id}: actual gameplay state changes`,
    );
    assert.equal(
      g.useTechnique(technique.id),
      false,
      `${technique.id}: recovering`,
    );
    assert.equal(
      g.player.essence,
      80,
      `${technique.id}: rejected repeat is free`,
    );
  }
});

test("a paused ritual revalidates learned scope after respecialization without undoing settled stages", () => {
  const g = ritualist();
  const p = g.beginRitual("water-grow", 10);
  g.worldSystems.update(60);
  g.commitRitual();
  g.worldSystems.update(4);
  g.cancelRitual();
  const quote = g.previewRespecialization("water-grow", 9);
  assert.equal(quote.valid, true);
  assert.ok(g.commitRespecialization(quote.id));
  const balances = [g.player.goodKarma, g.player.essence];
  assert.equal(g.resumeRitual(p.id), false);
  assert.deepEqual([g.player.goodKarma, g.player.essence], balances);
  assert.equal(g.worldSystems.conditions[0].active, true);
  assert.equal(g.worldSystems.conditions[0].stageHistory.length, 1);
  assert.equal(g.worldSystems.projects[0].status, "paused");
  g.player.learned["water-grow"] = 10;
  assert.equal(g.resumeRitual(p.id), true);
});
