import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CoopService } from "../server/service.js";
import { WorldStore } from "../server/store.js";
import { getContractDefinitions } from "../src/game/contracts.js";

function roomFixture({ file = ":memory:", now = () => 1000 } = {}) {
  const service = new CoopService({ store: new WorldStore(file), now });
  const a = service.createSession("Ada"),
    b = service.createSession("Bryn");
  const room = service.createRoom(a.token, "A Shared Test");
  service.joinRoom(b.token, room.room.code);
  return {
    service,
    a,
    b,
    code: room.room.code,
    ga: service.member(a.token).member.engine,
    gb: service.member(b.token).member.engine,
  };
}

test("server validates intentions, owns movement and wallets, and isolates personal storage", () => {
  const { service, a, b, ga, gb } = roomFixture();
  assert.throws(
    () => service.command(a.token, "setPlayer", [{ goodKarma: 999999 }]),
    /not available/,
  );
  assert.equal(ga.player.goodKarma, 125);
  const initial = ga.player.x;
  service.input(a.token, { sequence: 1, keys: ["d", "__proto__"] });
  for (let i = 0; i < 10; i++) service.tick(0.05);
  assert.ok(ga.player.x > initial + 40);
  assert.equal(ga.player.goodKarma, 125);
  ga.sanctuary.bank.stone = 7;
  assert.equal(gb.sanctuary.bank.stone || 0, 0);
  assert.equal(service.command(b.token, "withdrawItem", ["stone", 1]), false);
  assert.equal(ga.sanctuary.bank.stone, 7);
  assert.throws(
    () => service.command(b.token, "placeBuild", ["floor", 500, 500, 0]),
    /builder permission/,
  );
  service.setRole(a.token, b.id, "builder");
  gb.player.inventory.stone = 2;
  const build = service.command(b.token, "placeBuild", ["floor", 500, 500, 0]);
  assert.ok(build.id);
  assert.equal(ga.sanctuary.components[0].owner, b.id);
  assert.throws(
    () => service.command(b.token, "restoreLayout", ["missing"]),
    /owner/,
  );
  service.close();
});

test("changing an offer invalidates both locks and two confirmations settle one atomic exchange", () => {
  const { service, a, b, ga, gb, code } = roomFixture();
  ga.player.inventory.herb = 3;
  gb.player.inventory.crystal = 3;
  const trade = service.tradeInvite(a.token, b.id);
  service.tradeOffer(a.token, trade.id, { items: { herb: 2 }, goodKarma: 10 });
  service.tradeOffer(b.token, trade.id, {
    items: { crystal: 1 },
    goodKarma: 5,
  });
  service.tradeLock(a.token, trade.id);
  service.tradeLock(b.token, trade.id);
  assert.equal(ga.player.inventory.herb, 1);
  assert.equal(ga.player.goodKarma, 115);
  const changed = service.tradeOffer(a.token, trade.id, { items: { herb: 1 } });
  assert.deepEqual(changed.locks, {});
  assert.equal(ga.player.inventory.herb, 3);
  assert.equal(gb.player.inventory.crystal, 3);
  service.tradeLock(a.token, trade.id);
  service.tradeLock(b.token, trade.id);
  service.tradeConfirm(a.token, trade.id);
  assert.equal(ga.player.inventory.crystal || 0, 0);
  const settled = service.tradeConfirm(b.token, trade.id);
  assert.equal(settled.status, "complete");
  assert.equal(ga.player.inventory.herb, 2);
  assert.equal(ga.player.inventory.crystal, 1);
  assert.equal(gb.player.inventory.crystal, 2);
  assert.equal(gb.player.inventory.herb, 1);
  assert.equal(ga.player.goodKarma, 130);
  assert.equal(gb.player.goodKarma, 120);
  assert.equal(ga.player.lifetimeGood, 0);
  assert.throws(
    () => service.tradeConfirm(a.token, trade.id),
    /no longer open/,
  );
  assert.equal(
    service.store.receipts(code).filter((r) => r.type === "player-trade")
      .length,
    1,
  );
  service.close();
});

test("disconnect releases escrow and stale input cannot spend or move twice", () => {
  const { service, a, b, ga, code } = roomFixture();
  ga.player.inventory.herb = 4;
  const trade = service.tradeInvite(a.token, b.id);
  service.tradeOffer(a.token, trade.id, { items: { herb: 3 }, goodKarma: 20 });
  service.tradeLock(a.token, trade.id);
  service.leaveRoom(a.id, code);
  assert.equal(ga.player.inventory.herb, 4);
  assert.equal(ga.player.goodKarma, 125);
  assert.equal(service.trades.get(trade.id).status, "cancelled");
  service.joinRoom(a.token, code);
  assert.equal(service.input(a.token, { sequence: 2, keys: ["d"] }), true);
  assert.equal(service.input(a.token, { sequence: 2, keys: ["a"] }), false);
  assert.ok(ga.keys.has("d"));
  service.close();
});

test("ungraceful process recovery refunds persistent escrow exactly once", () => {
  const directory = mkdtempSync(join(tmpdir(), "eternal-escrow-")),
    file = join(directory, "world.sqlite");
  try {
    const { service, a, b, ga, code } = roomFixture({ file });
    ga.player.inventory.herb = 5;
    const trade = service.tradeInvite(a.token, b.id);
    service.tradeOffer(a.token, trade.id, {
      items: { herb: 4 },
      goodKarma: 50,
    });
    service.tradeLock(a.token, trade.id);
    assert.equal(ga.player.inventory.herb, 1);
    service.store.close();
    const recovered = new CoopService({ store: new WorldStore(file) });
    recovered.joinRoom(a.token, code);
    const player = recovered.member(a.token).member.engine.player;
    assert.equal(player.inventory.herb, 5);
    assert.equal(player.goodKarma, 125);
    recovered.close();
    const again = new CoopService({ store: new WorldStore(file) });
    again.joinRoom(a.token, code);
    assert.equal(again.member(a.token).member.engine.player.inventory.herb, 5);
    again.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("market sale credits an offline seller once, charges the exact fee, and preserves lifetime totals", () => {
  const { service, a, b, ga, gb, code } = roomFixture();
  ga.player.inventory.herb = 4;
  gb.player.goodKarma = 1000;
  const listing = service.listMarket(a.token, "herb", 2, 201, "goodKarma");
  service.leaveRoom(a.id, code);
  assert.equal(ga.player.inventory.herb, 2);
  assert.equal(service.buyMarket(b.token, listing.id), true);
  assert.equal(gb.player.goodKarma, 799);
  assert.equal(gb.player.inventory.herb, 2);
  assert.equal(service.store.character(code, a.id).player.goodKarma, 315);
  assert.equal(gb.player.lifetimeGood, 0);
  assert.throws(() => service.buyMarket(b.token, listing.id), /unavailable/);
  assert.equal(
    service.store.receipts(code).find((r) => r.type === "market-sale").fee,
    11,
  );
  service.close();
});

test("shared travel is owner-led and character inventories are scoped to their private world", () => {
  const { service, a, b, ga, code } = roomFixture();
  ga.player.inventory.herb = 8;
  service.command(a.token, "save");
  assert.throws(
    () => service.command(b.token, "setZone", ["prismatic-waterfalls"]),
    /owner/,
  );
  service.command(a.token, "setZone", ["prismatic-waterfalls"]);
  assert.equal(
    service.member(b.token).member.engine.zone.id,
    "prismatic-waterfalls",
  );
  const other = service.createRoom(a.token, "A Separate World");
  assert.notEqual(other.room.code, code);
  assert.equal(service.member(a.token).member.engine.player.inventory.herb, 0);
  service.leaveRoom(a.id, other.room.code);
  service.joinRoom(a.token, code);
  assert.equal(service.member(a.token).member.engine.player.inventory.herb, 8);
  service.close();
});

test("only accepted nearby contributions share an encounter settlement, and each personal claim occurs once", () => {
  const { service, a, b, ga, gb } = roomFixture();
  // An invalid strike at the safe starting point cannot register participation.
  assert.equal(service.command(b.token, "attack"), false);
  const first = ga.entities.find((n) => n.id === "blight-1");
  gb.player.x = first.x - 40;
  gb.player.y = first.y;
  ga.resolveEnemy(first, false);
  const firstKey = `${ga.zone.id}:${first.id}`;
  assert.equal(gb.rewardedEncounters.includes(firstKey), false);
  assert.equal(gb.player.inventory.crystal, 0);
  // A real accepted strike then qualifies this nearby participant for the next foe.
  const next = ga.entities.find((n) => n.id === "blight-2");
  gb.player.x = next.x - 40;
  gb.player.y = next.y;
  gb.targetId = next.id;
  assert.equal(service.command(b.token, "attack"), true);
  ga.resolveEnemy(next, false);
  const key = `${ga.zone.id}:${next.id}`;
  assert.equal(gb.rewardedEncounters.includes(key), true);
  assert.equal(gb.player.inventory.crystal, 1);
  assert.equal(gb.progression.certification.cooperative.length, 1);
  ga.resolveEnemy(next, false);
  assert.equal(gb.player.inventory.crystal, 1);
  assert.equal(gb.rewardedEncounters.filter((id) => id === key).length, 1);
  service.close();
});

function finishPostedContract(service, account, game, contract) {
  assert.equal(
    service.command(account.token, "acceptContract", [contract.id]),
    true,
  );
  for (const step of contract.steps) {
    game.player.x = step.x;
    game.player.y = step.y;
    const choices = step.sequence || [
      step.choices?.find(
        (choice) => !["coerce", "leave"].includes(choice.effect),
      )?.id,
    ];
    for (const choice of choices)
      assert.equal(
        service.command(account.token, "advanceContractStep", [
          contract.id,
          step.id,
          choice,
        ]),
        true,
      );
  }
  assert.equal(
    service.command(account.token, "settleContract", [contract.id]),
    true,
  );
}

test("each traveler owns a distinct familiar and hired ally that follow and dismiss independently", () => {
  const { service, a, b, ga, gb, code } = roomFixture();
  const shared = ga.entities;
  assert.equal(gb.entities, shared);
  for (const [account, game] of [
    [a, ga],
    [b, gb],
  ]) {
    const contact = game.entities.find((entity) => entity.canBond);
    game.player.x = contact.x;
    game.player.y = contact.y;
    game.player.inventory[contact.offer.item] = contact.offer.quantity;
    assert.equal(
      service.command(account.token, "assistCreature", [contact.id]),
      true,
    );
    assert.equal(
      service.command(account.token, "bondCompanion", [contact.id]),
      true,
    );
    assert.ok(service.command(account.token, "hireAlly", ["medic"]).id);
  }
  service.tick(0.05);
  assert.equal(ga.entities, shared);
  assert.equal(gb.entities, shared);
  assert.equal(service.roomFor(code).zones.get(ga.zone.id).entities, shared);
  const familiars = shared.filter((entity) => entity.role === "companion");
  const allies = shared.filter((entity) => entity.kind === "ally");
  assert.equal(familiars.length, 2);
  assert.equal(allies.length, 2);
  assert.equal(
    new Set([...familiars, ...allies].map((entity) => entity.id)).size,
    4,
  );
  for (const [account, game, direction] of [
    [a, ga, -1],
    [b, gb, 1],
  ]) {
    const familiar = familiars.find((entity) => entity.ownerId === account.id);
    const ally = allies.find((entity) => entity.ownerId === account.id);
    assert.equal(familiar.ownerName, game.player.name);
    assert.equal(ally.owner, account.id);
    game.player.x += direction * 180;
  }
  for (let i = 0; i < 25; i++) service.tick(0.1);
  for (const [account, game, other] of [
    [a, ga, gb],
    [b, gb, ga],
  ]) {
    for (const entity of shared.filter(
      (entity) =>
        entity.ownerId === account.id &&
        (entity.role === "companion" || entity.kind === "ally"),
    )) {
      assert.ok(
        Math.hypot(entity.x - game.player.x, entity.y - game.player.y) < 90,
      );
      assert.ok(
        Math.hypot(entity.x - other.player.x, entity.y - other.player.y) > 200,
      );
    }
  }
  const brynFamiliar = shared.find(
    (entity) => entity.role === "companion" && entity.ownerId === b.id,
  ).id;
  const brynAlly = gb.contracts.party.find((ally) => ally.active).id;
  assert.equal(
    service.command(a.token, "commandAlly", [brynAlly, "return"]),
    false,
  );
  assert.equal(service.command(a.token, "dismissCompanion"), true);
  assert.equal(
    service.command(a.token, "commandAlly", [
      ga.contracts.party.find((ally) => ally.active).id,
      "return",
    ]),
    true,
  );
  service.tick(0.1);
  assert.equal(ga.entities, shared);
  assert.equal(gb.entities, shared);
  assert.equal(
    shared.some(
      (entity) => entity.role === "companion" && entity.ownerId === a.id,
    ),
    false,
  );
  assert.equal(
    shared.some((entity) => entity.kind === "ally" && entity.ownerId === a.id),
    false,
  );
  assert.ok(shared.find((entity) => entity.id === brynFamiliar));
  assert.ok(shared.find((entity) => entity.id === brynAlly));
  assert.equal(
    service
      .snapshot(service.roomFor(code), a.id)
      .entities.filter((entity) => entity.role === "companion").length,
    1,
  );
  service.close();
});

test("personal contract markers and bound delivery custody coexist without cross-player settlement", () => {
  const { service, a, b, ga, gb } = roomFixture();
  const [investigation, delivery] = getContractDefinitions(ga.zone.id);
  const first = investigation.steps[0];
  const own = ga.entities.find(
    (entity) => entity.stepId === first.id && entity.ownerId === a.id,
  );
  const foreign = ga.entities.find(
    (entity) => entity.stepId === first.id && entity.ownerId === b.id,
  );
  assert.ok(own);
  assert.ok(foreign);
  assert.notEqual(own.id, foreign.id);
  ga.player.x = first.x;
  ga.player.y = first.y;
  assert.equal(
    service.command(a.token, "interact", [], { targetId: foreign.id }),
    false,
  );
  assert.equal(
    ga.contracts.stateMap[investigation.id].steps[first.id].complete,
    false,
  );
  assert.equal(
    service.command(a.token, "interact", [], { targetId: own.id }),
    true,
  );
  assert.equal(
    ga.contracts.stateMap[investigation.id].steps[first.id].complete,
    true,
  );
  assert.equal(
    gb.contracts.stateMap[investigation.id].steps[first.id].complete,
    false,
  );
  // Finish the real prerequisite, retaining the evidence already inspected by Ada.
  assert.equal(
    service.command(a.token, "acceptContract", [investigation.id]),
    true,
  );
  for (const step of investigation.steps.slice(1)) {
    ga.player.x = step.x;
    ga.player.y = step.y;
    assert.equal(
      service.command(a.token, "advanceContractStep", [
        investigation.id,
        step.id,
        step.choices?.[0]?.id,
      ]),
      true,
    );
  }
  assert.equal(
    service.command(a.token, "settleContract", [investigation.id]),
    true,
  );
  finishPostedContract(service, b, gb, investigation);
  for (const [account, game] of [
    [a, ga],
    [b, gb],
  ]) {
    assert.equal(
      service.command(account.token, "acceptContract", [delivery.id]),
      true,
    );
    const pickup = delivery.steps[0];
    game.player.x = pickup.x;
    game.player.y = pickup.y;
    assert.equal(
      service.command(account.token, "advanceContractStep", [
        delivery.id,
        pickup.id,
      ]),
      true,
    );
  }
  const cargoA = Object.values(ga.contracts.pouch)[0],
    cargoB = Object.values(gb.contracts.pouch)[0];
  assert.equal(cargoA.owner, a.id);
  assert.equal(cargoB.owner, b.id);
  assert.notEqual(cargoA, cargoB);
  assert.equal(cargoA.bound, true);
  assert.equal(cargoB.bound, true);
  const beforeA = ga.player.goodKarma,
    beforeB = gb.player.goodKarma;
  const drop = delivery.steps[1];
  ga.player.x = drop.x;
  ga.player.y = drop.y;
  assert.equal(
    service.command(a.token, "advanceContractStep", [delivery.id, drop.id]),
    true,
  );
  assert.equal(service.command(a.token, "settleContract", [delivery.id]), true);
  assert.equal(Object.keys(ga.contracts.pouch).length, 0);
  assert.equal(Object.values(gb.contracts.pouch)[0].owner, b.id);
  assert.equal(ga.player.goodKarma, beforeA + delivery.reward.amount);
  assert.equal(gb.player.goodKarma, beforeB);
  assert.equal(
    service.command(a.token, "settleContract", [delivery.id]),
    false,
  );
  assert.equal(
    service.command(b.token, "settleContract", [delivery.id]),
    false,
  );
  gb.player.x = drop.x;
  gb.player.y = drop.y;
  assert.equal(
    service.command(b.token, "advanceContractStep", [delivery.id, drop.id]),
    true,
  );
  assert.equal(service.command(b.token, "settleContract", [delivery.id]), true);
  assert.equal(
    service.command(b.token, "settleContract", [delivery.id]),
    false,
  );
  assert.equal(ga.player.goodKarma, beforeA + delivery.reward.amount);
  assert.equal(gb.player.goodKarma, beforeB + delivery.reward.amount);
  service.tick(0.05);
  for (const owner of [a.id, b.id])
    assert.ok(
      ga.entities.some(
        (entity) =>
          entity.contractId === delivery.id && entity.ownerId === owner,
      ),
    );
  assert.equal(ga.entities, gb.entities);
  service.close();
});

test("two owned escorts remain visible while only the nearby owner advances and claims each route once", () => {
  const { service, a, b, ga, gb, code } = roomFixture();
  ga.player.rank = 3;
  gb.player.rank = 3;
  assert.equal(
    service.command(a.token, "setZone", ["celestial-waterfalls"]),
    true,
  );
  const [investigation, mechanism, escortContract] = getContractDefinitions(
    ga.zone.id,
  );
  for (const [account, game] of [
    [a, ga],
    [b, gb],
  ]) {
    finishPostedContract(service, account, game, investigation);
    finishPostedContract(service, account, game, mechanism);
    assert.equal(
      service.command(account.token, "acceptContract", [escortContract.id]),
      true,
    );
    const step = escortContract.steps[0];
    game.player.x = step.x;
    game.player.y = step.y;
    assert.equal(
      service.command(account.token, "advanceContractStep", [
        escortContract.id,
        step.id,
      ]),
      true,
    );
  }
  // Resolve the shared region's hostile fixtures so this test isolates escort movement.
  for (const enemy of ga.entities.filter(
    (entity) => entity.kind === "enemy" && !entity.dead,
  ))
    ga.resolveEnemy(enemy, false);
  const stateA = ga.contracts.stateMap[escortContract.id],
    stateB = gb.contracts.stateMap[escortContract.id];
  assert.notEqual(stateA.escort.id, stateB.escort.id);
  const bStart = { x: stateB.escort.x, y: stateB.escort.y };
  gb.player.x = 100;
  gb.player.y = 100;
  const beforeA = ga.player.goodKarma,
    beforeB = gb.player.goodKarma;
  for (let i = 0; i < 2000 && stateA.escort.state !== "arrived"; i++) {
    ga.player.x = stateA.escort.x;
    ga.player.y = stateA.escort.y;
    service.tick(0.25);
  }
  assert.equal(stateA.escort.state, "arrived");
  assert.equal(stateB.escort.state, "waiting");
  assert.deepEqual({ x: stateB.escort.x, y: stateB.escort.y }, bStart);
  const visible = service
    .snapshot(service.roomFor(code), a.id)
    .entities.filter(
      (entity) =>
        entity.role === "contract-escort" &&
        entity.contractId === escortContract.id,
    );
  assert.equal(visible.length, 2);
  assert.equal(new Set(visible.map((entity) => entity.ownerId)).size, 2);
  assert.equal(
    service.command(a.token, "settleContract", [escortContract.id]),
    true,
  );
  assert.equal(
    service.command(a.token, "settleContract", [escortContract.id]),
    false,
  );
  assert.equal(
    service.command(b.token, "settleContract", [escortContract.id]),
    false,
  );
  assert.equal(ga.player.goodKarma, beforeA + escortContract.reward.amount);
  assert.equal(gb.player.goodKarma, beforeB);
  for (let i = 0; i < 2000 && stateB.escort.state !== "arrived"; i++) {
    gb.player.x = stateB.escort.x;
    gb.player.y = stateB.escort.y;
    service.tick(0.25);
  }
  assert.equal(stateB.escort.state, "arrived");
  assert.equal(
    service.command(b.token, "settleContract", [escortContract.id]),
    true,
  );
  assert.equal(
    service.command(b.token, "settleContract", [escortContract.id]),
    false,
  );
  assert.equal(ga.player.goodKarma, beforeA + escortContract.reward.amount);
  assert.equal(gb.player.goodKarma, beforeB + escortContract.reward.amount);
  assert.equal(ga.entities, gb.entities);
  service.close();
});

test("imported and restarted characters retain their own actor identities and bound cargo custody", () => {
  const directory = mkdtempSync(join(tmpdir(), "eternal-companions-")),
    file = join(directory, "world.sqlite");
  let activeService;
  try {
    const source = roomFixture();
    const contact = source.ga.entities.find((entity) => entity.canBond);
    source.ga.player.x = contact.x;
    source.ga.player.y = contact.y;
    source.ga.player.inventory[contact.offer.item] = contact.offer.quantity;
    assert.equal(
      source.service.command(source.a.token, "assistCreature", [contact.id]),
      true,
    );
    assert.equal(
      source.service.command(source.a.token, "bondCompanion", [contact.id]),
      true,
    );
    assert.ok(source.service.command(source.a.token, "hireAlly", ["scout"]).id);
    const [investigation, delivery] = getContractDefinitions(source.ga.zone.id);
    finishPostedContract(source.service, source.a, source.ga, investigation);
    assert.equal(
      source.service.command(source.a.token, "acceptContract", [delivery.id]),
      true,
    );
    source.ga.player.x = delivery.steps[0].x;
    source.ga.player.y = delivery.steps[0].y;
    assert.equal(
      source.service.command(source.a.token, "advanceContractStep", [
        delivery.id,
        delivery.steps[0].id,
      ]),
      true,
    );
    const checkpoint = source.ga.exportCheckpoint(),
      oldOwner = source.a.id;
    source.service.close();
    activeService = new CoopService({ store: new WorldStore(file) });
    const a = activeService.createSession("Ada Imported", checkpoint),
      b = activeService.createSession("Bryn Imported", checkpoint);
    const joined = activeService.createRoom(a.token, "Imported companions"),
      code = joined.room.code;
    activeService.joinRoom(b.token, code);
    const verify = () => {
      const ga = activeService.member(a.token).member.engine,
        gb = activeService.member(b.token).member.engine;
      assert.equal(ga.entities, gb.entities);
      const actors = ga.entities.filter(
        (entity) => entity.role === "companion" || entity.kind === "ally",
      );
      assert.equal(actors.length, 4);
      assert.equal(new Set(actors.map((entity) => entity.id)).size, 4);
      assert.equal(
        ga.entities.some((entity) => entity.ownerId === oldOwner),
        false,
      );
      for (const [account, game] of [
        [a, ga],
        [b, gb],
      ]) {
        assert.equal(
          actors.filter((entity) => entity.ownerId === account.id).length,
          2,
        );
        assert.equal(
          game.contracts.party.find((ally) => ally.active).owner,
          account.id,
        );
        assert.equal(Object.values(game.contracts.pouch)[0].owner, account.id);
        const canonical = investigation.steps[0].targetId;
        assert.equal(
          ga.entities.filter(
            (entity) =>
              entity.contractTargetId === canonical &&
              entity.ownerId === account.id,
          ).length,
          1,
        );
      }
      return actors.map((entity) => entity.id).sort();
    };
    const identities = verify();
    activeService.close();
    activeService = new CoopService({ store: new WorldStore(file) });
    activeService.joinRoom(a.token, code);
    activeService.joinRoom(b.token, code);
    activeService.tick(0.05);
    assert.deepEqual(verify(), identities);
    activeService.close();
    activeService = null;
  } finally {
    activeService?.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("server respecialization previews and cancellations are free, and one recorded purchase refunds only its owner once", () => {
  const { service, a, b, ga, gb, code } = roomFixture();
  try {
    const initialBalance = ga.player.goodKarma;
    const lifetime = {
      good: ga.player.lifetimeGood,
      bad: ga.player.lifetimeBad,
      rank: ga.player.rank,
    };
    const peer = structuredClone({
      good: gb.player.goodKarma,
      bad: gb.player.badKarma,
      lifetimeGood: gb.player.lifetimeGood,
      lifetimeBad: gb.player.lifetimeBad,
      learned: gb.player.learned,
    });
    assert.equal(service.command(a.token, "trainPower", ["air-move"]), true);
    const paid = initialBalance - ga.player.goodKarma;
    assert.equal(paid, 100);
    const purchase = ga.respecialization.ledger.find(
      (record) => record.branchId === "air-move" && record.status === "active",
    );
    assert.ok(purchase);
    assert.equal(purchase.cost, paid);
    assert.equal(purchase.currency, "good");
    const cancelled = service.command(a.token, "previewRespecialization", [
      "air-move",
      0,
    ]);
    assert.equal(cancelled.valid, true);
    assert.equal(cancelled.refund, paid);
    assert.equal(cancelled.removed[0].recordId, purchase.id);
    assert.equal(ga.player.goodKarma, initialBalance - paid);
    assert.equal(
      service.command(a.token, "cancelRespecialization", [cancelled.id]),
      true,
    );
    assert.equal(
      service.command(a.token, "commitRespecialization", [cancelled.id]),
      false,
    );
    assert.equal(ga.player.goodKarma, initialBalance - paid);
    assert.equal(ga.player.learned["air-move"], 1);
    assert.equal(purchase.status, "active");
    const quote = service.command(a.token, "previewRespecialization", [
      "air-move",
      0,
    ]);
    assert.equal(
      service.command(b.token, "commitRespecialization", [quote.id]),
      false,
    );
    const receipt = service.command(a.token, "commitRespecialization", [
      quote.id,
    ]);
    assert.equal(receipt.refund, paid);
    assert.equal(receipt.lifetimeCredit, false);
    assert.equal(purchase.status, "refunded");
    assert.equal(ga.player.learned["air-move"], undefined);
    assert.equal(ga.player.goodKarma, initialBalance);
    assert.equal(
      service.command(a.token, "commitRespecialization", [quote.id]),
      false,
    );
    assert.equal(ga.player.goodKarma, initialBalance);
    assert.equal(ga.respecialization.receipts.length, 1);
    assert.equal(
      service.store.character(code, a.id).respecialization.receipts.length,
      1,
    );
    assert.deepEqual(
      {
        good: ga.player.lifetimeGood,
        bad: ga.player.lifetimeBad,
        rank: ga.player.rank,
      },
      lifetime,
    );
    assert.deepEqual(
      {
        good: gb.player.goodKarma,
        bad: gb.player.badKarma,
        lifetimeGood: gb.player.lifetimeGood,
        lifetimeBad: gb.player.lifetimeBad,
        learned: gb.player.learned,
      },
      peer,
    );
    assert.equal(gb.respecialization.ledger.length, 0);
    assert.equal(gb.respecialization.receipts.length, 0);
  } finally {
    service.close();
  }
});
