import test from "node:test";
import assert from "node:assert/strict";
import { BRANCHES, ENHANCEMENTS, TECHNIQUES } from "../data/manual.js";
import { GameEngine } from "./engine.js";
import {
  initRespecialization,
  installRespecialization,
  recordTrainingPurchase,
  serializeRespecialization,
  snapshotRespecialization,
} from "./respecialization.js";

const getBranch = (id) => BRANCHES.find((b) => b.id === id);
const wallet = (currency) => (currency === "bad" ? "badKarma" : "goodKarma");
class Harness {
  constructor(saved) {
    this.player = {
      x: 920,
      y: 900,
      health: 100,
      essence: 100,
      goodKarma: 10000,
      badKarma: 10000,
      lifetimeGood: 20000,
      lifetimeBad: 20000,
      rank: 10,
      certified: true,
      lineage: "angel",
      starterBranch: "water-grow",
      learned: { "water-grow": 1 },
      techniques: [],
      enhancements: {},
      enhancementSelection: {},
      inventory: { crystal: 8 },
      equipment: { ward: "shield" },
    };
    this.world = { spawn: { x: 920, y: 900 } };
    this.zone = { id: "sacred-groves" };
    this.sanctuary = {
      plot: { x: 350, y: 450, width: 300, height: 300, zoneId: this.zone.id },
    };
    this.time = 0;
    this.trialRanks = [2, 3, 4];
    this.contracts = { receipts: [{ id: "kept" }] };
    this.progression = { certification: { receipts: ["certified"] } };
    this.events = [];
    this.selectedPower = { branchId: "water-grow", level: 1 };
    this.worldSystems = { active: () => this.ritual || null };
    this.shop = {};
    initRespecialization(this, saved);
  }
  inCombat() {
    return !!this.conflict;
  }
  event(type, text) {
    this.events.push({ type, text });
  }
  save() {}
  publish() {}
  trainPower(id) {
    const b = getBranch(id);
    if (!b || this.conflict) return false;
    const level = (this.player.learned[id] || 0) + 1,
      price = this.priceOverride ?? 100 * level * level;
    if (level > 10 || this.player[wallet(b.currency)] < price) return false;
    this.player[wallet(b.currency)] -= price;
    this.player.learned[id] = level;
    return true;
  }
  trainTechnique(id) {
    const t = TECHNIQUES.find((t) => t.id === id);
    if (
      !t ||
      this.player.techniques.includes(id) ||
      this.player[wallet(t.currency)] < t.trainingCost
    )
      return false;
    this.player[wallet(t.currency)] -= t.trainingCost;
    this.player.techniques.push(id);
    return true;
  }
  trainEnhancement(id) {
    const e = ENHANCEMENTS.find((e) => e.id === id);
    if (!e) return false;
    this.player[wallet(e.currency)] -= 75;
    this.player.enhancements[id] = 1;
    this.player.enhancementSelection[id] = 1;
    return true;
  }
  resolveCast(cast) {
    if (cast.reject) return false;
    this.player.essence -= 10;
    return true;
  }
  useTechnique() {
    return true;
  }
  resolveTechnique(cast) {
    if (cast.reject) return false;
    this.player.essence -= 20;
    return true;
  }
  beginRitual(branchId, level) {
    this.ritual = { branchId, level, status: "preparing" };
    return this.ritual;
  }
  commitRitual() {
    if (!this.ritual || this.ritual.status !== "ready") return false;
    this.ritual.status = "committed";
    return true;
  }
}
installRespecialization(Harness);
const quote = (game, branch = "water-grow", target = 1) =>
  game.previewRespecialization(branch, target);
const cast = (game, branchId = "water-grow", level = 2, extra = {}) =>
  game.resolveCast({
    branch: getBranch(branchId),
    power: getBranch(branchId).powers[level - 1],
    ...extra,
  });

test("unused same-session purchase refunds its actual price without changing lifetime progression or possessions", () => {
  const g = new Harness(),
    kept = structuredClone({
      inventory: g.player.inventory,
      equipment: g.player.equipment,
      contracts: g.contracts,
      progression: g.progression,
      trials: g.trialRanks,
    });
  g.priceOverride = 317;
  assert.equal(g.trainPower("water-grow"), true);
  const q = quote(g);
  assert.equal(q.refund, 317);
  assert.equal(q.removed[0].cost, 317);
  assert.equal(q.requiresConfirmation, true);
  assert.equal(g.commitRespecialization(q.id).refund, 317);
  assert.equal(g.player.goodKarma, 10000);
  assert.equal(g.player.lifetimeGood, 20000);
  assert.equal(g.player.rank, 10);
  assert.equal(g.player.certified, true);
  assert.deepEqual(
    {
      inventory: g.player.inventory,
      equipment: g.player.equipment,
      contracts: g.contracts,
      progression: g.progression,
      trials: g.trialRanks,
    },
    kept,
  );
});

test("free chosen starter and legacy unrecorded powers never create a purchase refund", () => {
  const g = new Harness();
  g.player.learned["water-grow"] = 3;
  const q = quote(g, "water-grow", 0);
  assert.equal(q.refund, 0);
  assert.deepEqual(
    q.removed.map((r) => r.level),
    [3, 2, 1],
  );
  assert.equal(q.removed[2].freeStarter, true);
  assert.equal(
    q.removed.every((r) => r.cost === 0),
    true,
  );
  assert.equal(q.warnings.length, 1);
  assert.ok(g.commitRespecialization(q.id));
  assert.equal(g.player.goodKarma, 10000);
  assert.equal(g.player.learned["water-grow"], undefined);
});

test("actual resolved use returns 80% rounded down, while rejected casts do not consume exact-refund eligibility", () => {
  const g = new Harness();
  g.priceOverride = 317;
  g.trainPower("water-grow");
  cast(g, "water-grow", 2, { reject: true });
  assert.equal(quote(g).refund, 317);
  cast(g);
  const q = quote(g);
  assert.equal(q.refund, 253);
  assert.equal(q.removed[0].rate, 0.8);
  assert.equal(g.commitRespecialization(q.id).refund, 253);
  assert.equal(g.player.goodKarma, 9936);
});

test("dependent branch upgrades are removed highest-first and invalidate the earlier full refund", () => {
  const g = new Harness();
  g.trainPower("water-grow");
  g.trainPower("water-grow");
  g.selectedPower.level = 3;
  const q = quote(g);
  assert.deepEqual(
    q.removed.map((r) => r.level),
    [3, 2],
  );
  assert.deepEqual(
    q.removed.map((r) => r.refund),
    [900, 320],
  );
  assert.equal(q.refund, 1220);
  g.commitRespecialization(q.id);
  assert.deepEqual(g.selectedPower, { branchId: "water-grow", level: 1 });
  assert.equal(g.player.learned["water-grow"], 1);
});

test("stale previews cannot mutate wallets or progression after wallet, training, or actual use changes", () => {
  const g = new Harness();
  g.trainPower("water-grow");
  const first = quote(g);
  g.player.goodKarma -= 1;
  const balance = g.player.goodKarma;
  assert.equal(g.commitRespecialization(first.id), false);
  assert.equal(g.player.goodKarma, balance);
  assert.equal(g.player.learned["water-grow"], 2);
  const second = quote(g);
  cast(g);
  assert.equal(g.commitRespecialization(second.id), false);
  const third = quote(g);
  g.trainPower("water-grow");
  assert.equal(g.commitRespecialization(third.id), false);
  assert.equal(g.player.learned["water-grow"], 3);
});

test("settled, replaced, and cancelled preview IDs cannot refund twice", () => {
  const g = new Harness();
  g.trainPower("water-grow");
  const old = quote(g),
    current = quote(g);
  assert.equal(g.commitRespecialization(old.id), false);
  assert.equal(g.cancelRespecialization(current.id), true);
  assert.equal(g.commitRespecialization(current.id), false);
  const q = quote(g);
  assert.ok(g.commitRespecialization(q.id));
  const balance = g.player.goodKarma;
  assert.equal(g.commitRespecialization(q.id), false);
  assert.equal(g.player.goodKarma, balance);
  assert.equal(g.respecialization.receipts.length, 1);
  assert.equal(g.respecialization.ledger[0].status, "refunded");
});

test("restoring a recorded training ledger starts a new session and retains only the 80% service refund", () => {
  const g = new Harness();
  g.trainPower("water-grow");
  quote(g);
  const saved = JSON.parse(JSON.stringify(serializeRespecialization(g)));
  assert.equal(saved.preview, null);
  const restored = new Harness(saved);
  restored.player = structuredClone(g.player);
  assert.notEqual(
    restored.respecialization.sessionId,
    g.respecialization.sessionId,
  );
  const q = quote(restored);
  assert.equal(q.refund, 320);
  assert.ok(restored.commitRespecialization(q.id));
  const restoredAgain = new Harness(serializeRespecialization(restored));
  restoredAgain.player = structuredClone(restored.player);
  assert.equal(quote(restoredAgain).valid, false);
  assert.equal(restoredAgain.respecialization.receipts.length, 1);
});

test("respecialization requires a sanctuary, no conflict, no preparation, no ritual reservation, and no committed craft", () => {
  const g = new Harness();
  g.trainPower("water-grow");
  for (const [key, value] of [
    ["conflict", true],
    ["downed", true],
    ["castState", {}],
    ["techniqueState", {}],
    ["ritual", { status: "preparing" }],
  ]) {
    g[key] = value;
    assert.equal(quote(g).valid, false, key);
    g[key] = null;
  }
  g.shop.pendingCraft = {};
  assert.equal(quote(g).valid, false);
  g.shop.pendingCraft = null;
  g.player.x = 3000;
  assert.equal(quote(g).valid, false);
  g.player.x = 400;
  g.player.y = 500;
  assert.equal(quote(g).valid, true);
  g.zone.id = "another-zone";
  assert.equal(quote(g).valid, false);
});

test("commit rechecks sanctuary and reservations after preview before making any mutation", () => {
  const g = new Harness();
  g.trainPower("water-grow");
  const q = quote(g);
  const before = g.player.goodKarma;
  g.shop.pendingCraft = { id: "craft-1" };
  assert.equal(g.commitRespecialization(q.id), false);
  assert.equal(g.player.goodKarma, before);
  assert.equal(g.player.learned["water-grow"], 2);
});

test("base-branch removal unequips its modifier but retains trained enhancement ranks and never refunds them", () => {
  const g = new Harness();
  g.trainPower("love-laugh");
  g.trainEnhancement("love-enhancement");
  const q = quote(g, "love-laugh", 0);
  assert.equal(q.refund, 80);
  assert.equal(q.unequipEnhancement.id, "love-enhancement");
  const balance = g.player.goodKarma;
  assert.ok(g.commitRespecialization(q.id));
  assert.equal(g.player.goodKarma, balance + 80);
  assert.equal(g.player.enhancements["love-enhancement"], 1);
  assert.equal(g.player.enhancementSelection["love-enhancement"], undefined);
  assert.equal(q.removed.length, 1);
});

test("last-domain branch removal previews and refunds recorded dependent techniques before their prerequisite", () => {
  const g = new Harness();
  g.trainPower("hate-clean");
  g.trainTechnique("purging-redemption");
  g.trainTechnique("divine-retaliation");
  g.selectedTechnique = "divine-retaliation";
  const q = quote(g, "hate-clean", 0);
  assert.deepEqual(
    q.removed.map((r) => r.id),
    [
      "divine-retaliation",
      "purging-redemption",
      getBranch("hate-clean").powers[0].id,
    ],
  );
  assert.deepEqual(
    q.removed.map((r) => r.refund),
    [500, 200, 80],
  );
  assert.equal(q.refund, 780);
  const lifetime = g.player.lifetimeBad;
  assert.ok(g.commitRespecialization(q.id));
  assert.deepEqual(g.player.techniques, []);
  assert.equal(g.selectedTechnique, null);
  assert.equal(g.player.lifetimeBad, lifetime);
  assert.equal(g.player.certified, true);
});

test("another learned branch in the domain preserves its trained techniques", () => {
  const g = new Harness();
  g.trainPower("hate-clean");
  g.trainPower("hate-cry");
  g.trainTechnique("purging-redemption");
  const q = quote(g, "hate-clean", 0);
  assert.deepEqual(q.dependentTechniques, []);
  g.commitRespecialization(q.id);
  assert.deepEqual(g.player.techniques, ["purging-redemption"]);
});

test("technique preparation is unused until actual resolved effect, then dependency receipts record use", () => {
  const g = new Harness();
  g.trainPower("hate-clean");
  g.trainTechnique("purging-redemption");
  g.useTechnique("purging-redemption");
  assert.equal(quote(g, "hate-clean", 0).dependentTechniques[0].refund, 250);
  g.resolveTechnique({
    technique: TECHNIQUES.find((t) => t.id === "purging-redemption"),
  });
  assert.equal(quote(g, "hate-clean", 0).dependentTechniques[0].refund, 200);
});

test("ritual reservation alone is not use, while committed ritual records dependent branch use", () => {
  const g = new Harness();
  g.trainPower("water-grow");
  g.beginRitual("water-grow", 2);
  g.ritual = null;
  assert.equal(quote(g).refund, 400);
  g.beginRitual("water-grow", 2);
  g.ritual.status = "ready";
  assert.equal(g.commitRitual(), true);
  g.ritual = null;
  assert.equal(quote(g).refund, 320);
});

test("record helpers reject unverifiable prices and mismatched currencies; snapshots do not expose mutable state", () => {
  const g = new Harness();
  assert.equal(
    recordTrainingPurchase(g, {
      branchId: "water-grow",
      level: 2,
      cost: -1,
      currency: "good",
    }),
    false,
  );
  assert.equal(
    recordTrainingPurchase(g, {
      branchId: "water-grow",
      level: 2,
      cost: 400,
      currency: "bad",
    }),
    false,
  );
  assert.equal(
    recordTrainingPurchase(g, {
      branchId: "water-grow",
      level: 2,
      cost: NaN,
      currency: "good",
    }),
    false,
  );
  g.trainPower("water-grow");
  const snap = snapshotRespecialization(g);
  snap.respecialization.ledger[0].cost = 999999;
  assert.equal(quote(g).refund, 400);
  assert.doesNotThrow(() => JSON.stringify(snap));
  g.player.goodKarma = NaN;
  assert.equal(quote(g).valid, false);
  g.player.goodKarma = 10000;
  g.player.learned["water-grow"] = 11;
  assert.equal(quote(g).valid, false);
});

const engineStorage = () => {
  const entries = new Map();
  return {
    getItem: (key) => entries.get(key) || null,
    setItem: (key, value) => entries.set(key, value),
    removeItem: (key) => entries.delete(key),
  };
};
test("real GameEngine training, actual cast use, snapshot, constructor load, and checkpoint restore retain the recorded ledger", () => {
  const storage = engineStorage(),
    g = new GameEngine(null, { headless: true, storage });
  g.player.rank = 2;
  g.player.goodKarma = 1000;
  assert.equal(g.trainPower("water-grow"), true);
  assert.equal(g.respecialization.ledger[0].cost, 400);
  assert.equal(g.getSnapshot().respecialization.ledger[0].used, false);
  g.setPower("water-grow", 2);
  g.selectTarget("training");
  assert.equal(g.cast(), true);
  const action = g.castState;
  g.time = action.resolveAt;
  g.castState = null;
  g.resolveCast(action);
  assert.equal(g.respecialization.ledger[0].used, true);
  const checkpoint = g.exportCheckpoint(),
    loaded = new GameEngine(null, { headless: true, storage });
  assert.equal(loaded.respecialization.ledger[0].used, true);
  assert.equal(loaded.respecialization.ledger[0].cost, 400);
  assert.notEqual(
    loaded.respecialization.sessionId,
    g.respecialization.sessionId,
  );
  const restored = new GameEngine(null, {
    headless: true,
    storage: engineStorage(),
  });
  assert.equal(restored.restoreCheckpoint(checkpoint), true);
  assert.equal(restored.player.learned["water-grow"], 2);
  assert.equal(restored.previewRespecialization("water-grow", 1).refund, 320);
});

test("real authority commands preview and settle one refund while preserving trial and lifetime receipts", () => {
  const g = new GameEngine(null, {
    headless: true,
    storage: engineStorage(),
    authorityPeer: true,
  });
  g.player.rank = 2;
  g.player.goodKarma = 1000;
  g.player.lifetimeGood = 1200;
  g.trialRanks = [2];
  assert.equal(
    g.handleCommand({ type: "trainPower", args: ["water-grow"] }).ok,
    true,
  );
  const response = g.handleCommand({
    type: "previewRespecialization",
    args: ["water-grow", 1],
  });
  assert.equal(response.ok, true);
  assert.equal(response.result.refund, 400);
  const commit = g.handleCommand({
    type: "commitRespecialization",
    args: [response.result.id],
  });
  assert.equal(commit.ok, true);
  assert.equal(commit.result.refund, 400);
  assert.equal(g.player.goodKarma, 1000);
  assert.equal(g.player.lifetimeGood, 1200);
  assert.deepEqual(g.trialRanks, [2]);
  assert.equal(g.player.learned["water-grow"], 1);
  assert.equal(
    g.handleCommand({
      type: "commitRespecialization",
      args: [response.result.id],
    }).ok,
    false,
  );
  assert.equal(g.player.goodKarma, 1000);
});

test("real GameEngine reset clears recorded purchases and cannot make its new free starter refundable", () => {
  const g = new GameEngine(null, { headless: true, storage: engineStorage() });
  g.player.rank = 2;
  g.player.goodKarma = 1000;
  g.trainPower("water-grow");
  const oldQuote = g.previewRespecialization("water-grow", 1);
  g.reset();
  assert.equal(g.respecialization.ledger.length, 0);
  assert.equal(g.respecialization.receipts.length, 0);
  assert.equal(g.commitRespecialization(oldQuote.id), false);
  const q = g.previewRespecialization("water-grow", 0);
  assert.equal(q.refund, 0);
  assert.equal(q.removed[0].freeStarter, true);
});
