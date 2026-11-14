import test from "node:test";
import assert from "node:assert/strict";
import { ZONES } from "../data/manual.js";
import {
  installContracts,
  initContracts,
  updateContracts,
  getContractsSnapshot,
  getContractEntities,
  getContractDefinitions,
  serializeContracts,
  isBoundItem,
} from "./contracts.js";
const zoneId = "sacred-groves";
function campaignProvider(zone) {
  const prefix = `test:${zone.id}:`;
  return {
    id: prefix + "campaign",
    title: zone.name,
    chapter: 1,
    objectives: [
      {
        id: prefix + "investigate",
        title: "Read the physical evidence",
        type: "investigation",
        reward: { amount: 25, currency: "good" },
        steps: [
          {
            id: prefix + "evidence",
            type: "inspect",
            name: "Source inscription",
            x: 100,
            y: 100,
          },
        ],
      },
      {
        id: prefix + "deliver",
        title: "Carry the posted parcel",
        type: "delivery",
        reward: { amount: 30, currency: "good" },
        steps: [
          {
            id: prefix + "pickup",
            type: "pickup",
            name: "Parcel source",
            x: 100,
            y: 100,
            cargo: { id: "sealed-parcel", name: "Sealed parcel", quantity: 1 },
          },
          {
            id: prefix + "drop",
            type: "deliver",
            name: "Parcel destination",
            x: 400,
            y: 100,
            cargo: { id: "sealed-parcel" },
          },
        ],
      },
      {
        id: prefix + "allocate",
        title: "Allocate the finite harvest fairly",
        type: "allocation",
        reward: { amount: 40, currency: "good" },
        steps: [
          {
            id: prefix + "allocation",
            type: "allocate",
            x: 100,
            y: 100,
            choices: [
              {
                id: "fair",
                label: "Share fairly",
                items: { herb: 2 },
                effect: "fair",
                reputationDelta: 5,
                currency: "good",
              },
              {
                id: "coerce",
                label: "Impose your claim",
                items: {},
                effect: "coerce",
                reputationDelta: -10,
                currency: "bad",
              },
            ],
          },
        ],
      },
      {
        id: prefix + "negotiate",
        title: "Negotiate with evidence",
        type: "negotiation",
        reward: { amount: 40, currency: "good" },
        steps: [
          {
            id: prefix + "negotiation",
            type: "negotiate",
            x: 100,
            y: 100,
            choices: [
              {
                id: "evidence",
                label: "Present verified evidence",
                items: { stone: 1 },
                requiresEvidence: [prefix + "evidence"],
                reputationDelta: 5,
                effect: "verify",
              },
              {
                id: "leave",
                label: "Leave",
                effect: "leave",
                reputationDelta: 0,
              },
            ],
          },
        ],
      },
      {
        id: prefix + "escort",
        title: "Guide a traveler",
        type: "escort",
        reward: { amount: 50, currency: "good" },
        steps: [
          {
            id: prefix + "escort-step",
            type: "escort",
            x: 100,
            y: 100,
            waypoints: [
              { x: 175, y: 100 },
              { x: 250, y: 100 },
            ],
          },
        ],
      },
      {
        id: prefix + "restore",
        title: "Restore a tagged source",
        type: "restoration",
        reward: { amount: 25, currency: "good" },
        steps: [
          {
            id: prefix + "restoration",
            type: "restore",
            x: 100,
            y: 100,
            power: { branchId: "water-grow", level: 1 },
            items: { stone: 1 },
          },
        ],
      },
      {
        id: prefix + "mechanism",
        title: "Read the visible mechanism",
        type: "mechanism",
        reward: { amount: 25, currency: "good" },
        steps: [
          {
            id: prefix + "mechanism-step",
            type: "mechanism",
            x: 100,
            y: 100,
            sequence: [1, 2, 3],
          },
        ],
      },
      {
        id: prefix + "ending",
        title: "Settle the concordance",
        type: "trial",
        requiredRank: 10,
        prerequisites: [prefix + "investigate", prefix + "deliver"],
        ending: true,
        reward: { amount: 100, currency: "good" },
        steps: [{ id: prefix + "ending-step", type: "trial", x: 100, y: 100 }],
      },
    ],
  };
}
class Harness {
  constructor() {
    this.player = {
      x: 100,
      y: 100,
      rank: 1,
      lineage: "angel",
      certified: false,
      inventory: { herb: 10, wood: 10, stone: 10, crystal: 10, draught: 3 },
      goodKarma: 1000,
      badKarma: 0,
      lifetimeGood: 0,
      lifetimeBad: 0,
      reputation: 0,
      health: 80,
      maxHealth: 100,
      essence: 100,
      statuses: [],
      learned: { "water-grow": 1 },
    };
    this.zone = { id: zoneId };
    this.sanctuary = { recovery: {} };
    this.worldModel = { dayLength: 3600 };
    this.worldSystems = {
      regions: { [zoneId]: { vitality: 40, stability: 50 } },
    };
    this.time = 0;
    this.cooldowns = {};
    this.events = [];
    this.conflict = false;
    initContracts(this);
  }
  inCombat() {
    return this.conflict;
  }
  save() {}
  publish() {}
  event(type, text) {
    this.events.push({ type, text });
  }
  effect() {}
  tryRankUp() {}
  grantBarrier(n) {
    this.barrier = n;
  }
}
installContracts(Harness, { campaignProvider });
const id = (name) => `test:${zoneId}:${name}`;
const create = () => new Harness();
const move = (game, x, y) => Object.assign(game.player, { x, y });
const step = (game, contract) => game.previewContract(id(contract)).steps[0];

test("all 39 campaign definitions retain unique identities and expose physical markers", () => {
  const all = getContractDefinitions();
  assert.equal(all.length, ZONES.length * 8);
  assert.equal(new Set(all.map((d) => d.id)).size, all.length);
  const g = create(),
    snapshot = getContractsSnapshot(g);
  assert.equal(snapshot.contracts.offers.length, 8);
  assert.equal(
    getContractEntities(g).filter((e) => e.kind === "contract-node").length,
    9,
  );
  assert(
    snapshot.contracts.offers.every((d) =>
      d.steps.every((s) => Number.isFinite(s.x) && Number.isFinite(s.y)),
    ),
  );
});

test("physical investigation can precede acceptance but pays once only after deliberate settlement", () => {
  const g = create(),
    s = step(g, "investigate");
  move(g, 500, 500);
  assert.equal(g.advanceContractStep(id("investigate"), s.id), false);
  move(g, 100, 100);
  assert.equal(g.advanceContractStep(id("investigate"), s.id), true);
  assert.equal(g.player.lifetimeGood, 0);
  assert.equal(g.acceptContract(id("investigate")), true);
  assert.equal(g.previewContract(id("investigate")).progress, 1);
  assert.equal(g.settleContract(id("investigate")), true);
  assert.equal(g.player.lifetimeGood, 25);
  assert.equal(g.settleContract(id("investigate")), false);
  assert.equal(g.acceptContract(id("investigate")), false);
  assert.equal(g.player.lifetimeGood, 25);
});

test("delivery uses one bound cargo identity, validates its destination, and never enters tradable inventory", () => {
  const g = create();
  g.acceptContract(id("deliver"));
  const def = g.previewContract(id("deliver"));
  assert.equal(g.advanceContractStep(def.id, def.steps[1].id), false);
  assert.equal(g.advanceContractStep(def.id, def.steps[0].id), true);
  const cargo = Object.values(g.contracts.pouch)[0];
  assert.equal(cargo.bound, true);
  assert.equal(isBoundItem(g, cargo.itemId), true);
  assert.equal(g.player.inventory[cargo.itemId], undefined);
  assert.equal(g.advanceContractStep(def.id, def.steps[0].id), false);
  assert.equal(g.advanceContractStep(def.id, def.steps[1].id), false);
  move(g, 400, 100);
  assert.equal(g.advanceContractStep(def.id, def.steps[1].id), true);
  assert.deepEqual(g.contracts.pouch, {});
  assert.equal(g.settleContract(def.id), true);
  assert.equal(g.player.lifetimeGood, 30);
});

test("expired cargo returns to its source, incurs the posted reputation result, and can be retried safely", () => {
  const g = create();
  g.acceptContract(id("deliver"));
  let def = g.previewContract(id("deliver"));
  g.advanceContractStep(def.id, def.steps[0].id);
  updateContracts(g, 3601);
  assert.equal(g.contracts.stateMap[def.id].status, "expired");
  assert.equal(g.player.reputation, -10);
  assert.deepEqual(g.contracts.pouch, {});
  assert.equal(g.player.lifetimeGood, 0);
  assert.equal(g.acceptContract(def.id), true);
  def = g.previewContract(def.id);
  assert.equal(def.progress, 0);
  assert.equal(g.advanceContractStep(def.id, def.steps[0].id), true);
  assert.equal(Object.values(g.contracts.pouch).length, 1);
});

test("allocation presents explicit consequences and spends the chosen material amount once", () => {
  const g = create();
  g.acceptContract(id("allocate"));
  const s = step(g, "allocate");
  const dialogue = g.advanceContractStep(id("allocate"), s.id);
  assert.equal(dialogue.choices.length, 2);
  assert.equal(g.player.inventory.herb, 10);
  assert.equal(g.chooseDialogue(dialogue.npcId, "fair"), true);
  assert.equal(g.player.inventory.herb, 8);
  assert.equal(g.player.reputation, 5);
  assert.equal(g.chooseDialogue(dialogue.npcId, "fair"), false);
  assert.equal(g.player.inventory.herb, 8);
  g.settleContract(id("allocate"));
  assert.equal(g.player.lifetimeGood, 40);
  assert.equal(g.contracts.milestones[zoneId + ":fair-allocation"], true);
});

test("coercive outcomes choose Bad Karma while inaccessible opposite wallets never gain credit", () => {
  const g = create();
  g.player.lineage = "demon";
  g.player.badKarma = 1000;
  g.acceptContract(id("allocate"));
  const s = step(g, "allocate");
  assert.equal(g.advanceContractStep(id("allocate"), s.id, "coerce"), true);
  g.settleContract(id("allocate"));
  assert.equal(g.player.lifetimeBad, 40);
  assert.equal(g.player.reputation, -5);
  g.acceptContract(id("investigate"));
  g.advanceContractStep(id("investigate"), step(g, "investigate").id);
  g.settleContract(id("investigate"));
  assert.equal(g.player.lifetimeGood, 0);
  g.player.certified = true;
  assert.equal(g.settleContract(id("investigate")), false);
  assert.equal(g.player.lifetimeGood, 0);
});

test("evidence-based negotiation refuses an unsupported claim and never consumes payment on failure", () => {
  const g = create();
  g.acceptContract(id("negotiate"));
  const s = step(g, "negotiate");
  g.openContractDialogue(id("negotiate"), s.id);
  const npc = g.contracts.dialogue.npcId;
  assert.equal(g.chooseDialogue(npc, "evidence"), false);
  assert.equal(g.player.inventory.stone, 10);
  g.advanceContractStep(id("investigate"), step(g, "investigate").id);
  assert.equal(g.chooseDialogue(npc, "evidence"), true);
  assert.equal(g.player.inventory.stone, 9);
  assert.equal(g.previewContract(id("negotiate")).progress, 1);
});

test("escort progress requires actual nearby movement through the route and supports cooperative completion", () => {
  const g = create();
  g.hireAlly("guardian");
  g.acceptContract(id("escort"));
  const s = step(g, "escort");
  g.advanceContractStep(id("escort"), s.id);
  move(g, 1000, 1000);
  updateContracts(g, 5);
  assert.equal(g.contracts.stateMap[id("escort")].escort.x, 100);
  assert.equal(g.previewContract(id("escort")).progress, 0);
  move(g, 175, 100);
  for (let i = 0; i < 6; i++) updateContracts(g, 0.5);
  assert.equal(g.previewContract(id("escort")).progress, 1);
  assert.equal(g.player.cooperativeTrial, true);
  assert.equal(g.settleContract(id("escort")), true);
  assert.equal(g.player.lifetimeGood, 50);
});

test("restoration uses real named-power preparation, movement cancellation, Essence cost and one recorded effect", () => {
  const g = create();
  g.acceptContract(id("restore"));
  const s = step(g, "restore");
  assert.equal(g.advanceContractStep(id("restore"), s.id), true);
  assert(g.contracts.castState);
  assert.equal(g.player.essence, 100);
  move(g, 104, 100);
  updateContracts(g, 0.8);
  assert.equal(g.contracts.castState, null);
  assert.equal(g.player.essence, 100);
  assert.equal(g.player.inventory.stone, 10);
  move(g, 100, 100);
  g.advanceContractStep(id("restore"), s.id);
  updateContracts(g, 0.75);
  assert.equal(g.player.essence, 90);
  assert.equal(g.player.inventory.stone, 9);
  assert.equal(g.worldSystems.regions[zoneId].vitality, 50);
  assert.equal(g.previewContract(id("restore")).progress, 1);
  assert.equal(g.advanceContractStep(id("restore"), s.id), false);
  assert.equal(g.player.essence, 90);
});

test("NPC barter previews are free, lock both sides in escrow, and settle exactly once without lifetime earnings", () => {
  const g = create();
  move(g, 1080, 870);
  const trader = getContractsSnapshot(g).contracts.trader;
  const q = g.previewBarter(trader.id, "crystal-timber");
  assert.equal(q.status, "preview");
  assert.equal(g.player.inventory.crystal, 10);
  assert.equal(g.lockBarter(q.id).status, "locked");
  assert.equal(g.player.inventory.crystal, 9);
  assert.equal(g.contracts.traders[zoneId].items.wood, 18);
  assert.equal(g.player.inventory.wood, 10);
  assert.equal(g.commitBarter(q.id), true);
  assert.equal(g.player.inventory.wood, 12);
  assert.equal(g.player.inventory.stone, 11);
  assert.equal(g.player.lifetimeGood, 0);
  assert.equal(g.commitBarter(q.id), false);
  assert.equal(g.player.inventory.wood, 12);
});

test("NPC stock revalidation and quote cancellation cannot lose or duplicate either side", () => {
  const g = create();
  move(g, 1080, 870);
  const trader = getContractsSnapshot(g).contracts.trader;
  const q = g.previewBarter(trader.id, "crystal-timber");
  g.contracts.traders[zoneId].revision++;
  assert.equal(g.lockBarter(q.id), false);
  assert.equal(g.player.inventory.crystal, 10);
  const next = g.previewBarter(trader.id, "crystal-timber");
  g.lockBarter(next.id);
  assert.equal(g.cancelBarter(next.id), true);
  assert.equal(g.player.inventory.crystal, 10);
  assert.equal(g.contracts.traders[zoneId].items.wood, 20);
  assert.equal(g.cancelBarter(next.id), false);
  assert.equal(g.player.inventory.crystal, 10);
});

test("pending barter survives reload and expiry releases player and NPC escrow once", () => {
  const g = create();
  move(g, 1080, 870);
  const q = g.previewBarter(
    getContractsSnapshot(g).contracts.trader.id,
    "crystal-timber",
  );
  g.lockBarter(q.id);
  const saved = JSON.parse(JSON.stringify(serializeContracts(g)));
  const h = create();
  h.player.inventory = structuredClone(g.player.inventory);
  initContracts(h, saved);
  updateContracts(h, 31);
  assert.equal(h.player.inventory.crystal, 10);
  assert.equal(h.contracts.traders[zoneId].items.wood, 20);
  assert.equal(h.contracts.barterQuote.status, "expired");
  updateContracts(h, 40);
  assert.equal(h.player.inventory.crystal, 10);
  assert.equal(h.commitBarter(q.id), false);
});

test("barter currency transfers spend the posted wallet and cannot activate an inaccessible one", () => {
  const g = create();
  move(g, 1080, 870);
  const trader = getContractsSnapshot(g).contracts.trader;
  assert.equal(g.previewBarter(trader.id, "infernal-charm").valid, false);
  const q = g.previewBarter(trader.id, "relief-commission");
  g.lockBarter(q.id);
  assert.equal(g.player.goodKarma, 995);
  assert.equal(g.player.inventory.herb, 7);
  g.commitBarter(q.id);
  assert.equal(g.player.inventory.draught, 4);
  assert.equal(g.player.lifetimeGood, 0);
});

test("an owned offline ally performs real support, follows travel, and never creates progression", () => {
  const g = create(),
    ally = g.hireAlly("medic");
  assert.equal(g.player.goodKarma, 925);
  assert.equal(g.hireAlly("guardian"), false);
  updateContracts(g, 10);
  assert.equal(g.player.health, 90);
  assert.equal(g.player.lifetimeGood, 0);
  g.zone = { id: "divine-cities" };
  move(g, 900, 900);
  updateContracts(g, 0.1);
  assert.equal(g.contracts.party[0].zoneId, "divine-cities");
  assert(distance(g.contracts.party[0], g.player) < 100);
  assert.equal(g.commandAlly(ally.id, "return"), true);
  assert.equal(g.contracts.party[0].active, false);
  assert(g.hireAlly("scout"));
});
function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

test("campaign ending requires rank ten and global completed prerequisites, then records one persistent ending", () => {
  const g = create();
  assert.equal(g.acceptContract(id("ending")), false);
  for (const name of ["investigate", "deliver"]) {
    g.contracts.completed.push(id(name));
    g.contracts.stateMap[id(name)].status = "complete";
  }
  g.player.rank = 10;
  assert.equal(g.acceptContract(id("ending")), true);
  g.advanceContractStep(id("ending"), step(g, "ending").id);
  assert.equal(g.settleContract(id("ending")), true);
  assert.equal(g.contracts.ending.id, id("ending"));
  const h = create();
  initContracts(h, JSON.parse(JSON.stringify(serializeContracts(g))));
  assert.equal(h.contracts.ending.id, id("ending"));
  assert.equal(h.settleContract(id("ending")), false);
});

test("a mechanism exposes explicit glyph choices, resets wrong input free, and settles only its full sequence", () => {
  const g = create();
  g.acceptContract(id("mechanism"));
  const s = step(g, "mechanism"),
    dialogue = g.advanceContractStep(id("mechanism"), s.id);
  assert.equal(dialogue.kind, "mechanism");
  assert.equal(g.chooseDialogue(dialogue.npcId, "2"), false);
  assert.equal(g.previewContract(id("mechanism")).steps[0].sequenceIndex, 0);
  assert.equal(g.chooseDialogue(dialogue.npcId, "1"), true);
  assert.equal(g.chooseDialogue(dialogue.npcId, "2"), true);
  assert.equal(g.previewContract(id("mechanism")).progress, 0);
  assert.equal(g.chooseDialogue(dialogue.npcId, "3"), true);
  assert.equal(g.previewContract(id("mechanism")).progress, 1);
  assert.equal(g.player.essence, 100);
  assert.equal(g.player.lifetimeGood, 0);
  assert.equal(g.settleContract(id("mechanism")), true);
});

test("an abandoned dialogue cannot commit stale choices or consume materials", () => {
  const g = create();
  g.acceptContract(id("allocate"));
  const d = g.openContractDialogue(id("allocate"), step(g, "allocate").id);
  g.abandonContract(id("allocate"));
  const herbs = g.player.inventory.herb;
  assert.equal(g.chooseDialogue(d.npcId, "fair"), false);
  assert.equal(g.player.inventory.herb, herbs);
  assert.equal(g.previewContract(id("allocate")).progress, 0);
});
