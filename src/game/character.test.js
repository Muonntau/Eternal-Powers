import test from "node:test";
import assert from "node:assert/strict";
import {
  CHARACTER_PALETTES,
  defaultAppearance,
  normalizeAppearance,
  resolveAppearanceColors,
  nativeBranches,
  validateCharacterDraft,
  installCharacterMethods,
} from "./character.js";

class CharacterHarness {
  constructor() {
    this.player = {
      id: "kept-identity",
      name: "Wayfarer",
      lineage: "angel",
      x: 920,
      y: 900,
      health: 100,
      rank: 1,
      goodKarma: 125,
      badKarma: 0,
      lifetimeGood: 0,
      lifetimeBad: 0,
      learned: { "water-grow": 1 },
      starterBranch: "water-grow",
      starterLocked: false,
      inventory: { draught: 3 },
    };
    this.world = { spawn: { x: 920, y: 900 } };
    this.zone = { id: "sacred-groves" };
    this.sanctuary = {
      plot: { x: 350, y: 450, width: 300, height: 300, zoneId: this.zone.id },
    };
    this.completedQuests = [];
    this.keys = new Set(["w"]);
    this.selectedPower = { branchId: "water-grow", level: 1 };
    this.events = [];
    this.saves = 0;
    this.publishes = 0;
  }
  event(type, text) {
    this.events.push({ type, text });
  }
  save() {
    this.saves++;
  }
  publish() {
    this.publishes++;
  }
  inCombat() {
    return !!this.conflict;
  }
}
installCharacterMethods(CharacterHarness);
const draft = (lineage = "angel") => ({
  name: "Aster Vale",
  lineage,
  starterBranch: lineage === "demon" ? "fire-create" : "water-grow",
  appearance: {
    ...defaultAppearance(lineage),
    hairStyle: 3,
    skinTone: "umber",
    armorColor: "glacier",
    auraColor: "mint",
  },
});

test("appearance normalizes unsafe values to finite palette choices without mutating input", () => {
  const source = {
    bodyType: "<script>",
    skinTone: "url(secret)",
    hairStyle: 17,
    hairColor: "silver",
    armorColor: "ember",
    auraColor: "violet",
    injected: "ignored",
  };
  const copy = structuredClone(source),
    value = normalizeAppearance(source, "demon");
  assert.deepEqual(source, copy);
  assert.equal(value.bodyType, "wanderer");
  assert.equal(value.skinTone, defaultAppearance("demon").skinTone);
  assert.equal(value.hairStyle, 1);
  assert.equal(value.hairColor, "silver");
  assert.equal(value.injected, undefined);
  for (const key of Object.keys(CHARACTER_PALETTES))
    assert.ok(CHARACTER_PALETTES[key].some((item) => item.id === value[key]));
  const resolved = resolveAppearanceColors(value, "demon");
  for (const key of [
    "skin",
    "hair",
    "armor",
    "aura",
    "armorLight",
    "armorDark",
  ])
    assert.match(resolved[key], /^#[a-f0-9]{6}$/i);
});

test("each lineage offers exactly eight native starter paths and rejects opposing affinity", () => {
  assert.equal(nativeBranches("angel").length, 8);
  assert.equal(nativeBranches("demon").length, 8);
  for (const lineage of ["angel", "demon"]) {
    for (const branch of nativeBranches(lineage))
      assert.equal(
        validateCharacterDraft({ ...draft(lineage), starterBranch: branch.id })
          .valid,
        true,
      );
  }
  assert.equal(
    validateCharacterDraft({ ...draft(), starterBranch: "fire-create" }).valid,
    false,
  );
  assert.equal(
    validateCharacterDraft({ ...draft("demon"), starterBranch: "water-grow" })
      .valid,
    false,
  );
  assert.equal(
    validateCharacterDraft({ ...draft(), lineage: "human" }).valid,
    false,
  );
});

test("creation validates the name atomically and cannot spend or grant training", () => {
  const game = new CharacterHarness(),
    before = structuredClone(game.player);
  assert.equal(game.createCharacter({ ...draft(), name: " " }), false);
  assert.deepEqual(game.player, before);
  assert.equal(game.saves, 0);
  assert.equal(
    game.createCharacter({ ...draft(), name: "A".repeat(25) }),
    false,
  );
  assert.deepEqual(game.player, before);
  const result = validateCharacterDraft({
    ...draft(),
    name: "  Étoile\u0000   Vale  ",
  });
  assert.equal(result.value.name, "Étoile Vale");
});

test("new character commits one free native power and moves starter funds without lifetime credit", () => {
  const game = new CharacterHarness(),
    inventory = structuredClone(game.player.inventory);
  assert.equal(game.createCharacter(draft("demon")), true);
  assert.equal(game.player.id, "kept-identity");
  assert.equal(game.player.name, "Aster Vale");
  assert.equal(game.player.lineage, "demon");
  assert.equal(game.player.characterCreated, true);
  assert.equal(game.player.characterVersion, 2);
  assert.equal(game.player.starterLocked, true);
  assert.deepEqual(game.player.learned, { "fire-create": 1 });
  assert.equal(game.player.goodKarma, 0);
  assert.equal(game.player.badKarma, 125);
  assert.equal(game.player.lifetimeGood, 0);
  assert.equal(game.player.lifetimeBad, 0);
  assert.deepEqual(game.player.inventory, inventory);
  assert.deepEqual(game.selectedPower, { branchId: "fire-create", level: 1 });
  assert.deepEqual(game.player.appearance, draft("demon").appearance);
  assert.equal(game.keys.size, 0);
  assert.equal(game.saves, 1);
});

test("existing characters and established legacy journeys cannot recreate wallets or unlocks", () => {
  for (const establish of [
    (game) => {
      game.player.characterCreated = true;
    },
    (game) => {
      game.player.starterLocked = true;
    },
    (game) => {
      game.player.rank = 2;
    },
    (game) => {
      game.player.lifetimeGood = 25;
    },
    (game) => {
      game.player.learned["water-grow"] = 2;
    },
    (game) => {
      game.player.learned["air-move"] = 1;
    },
    (game) => {
      game.completedQuests.push("first-light");
    },
    (game) => {
      game.respecialization = { ledger: [{ status: "refunded" }] };
    },
  ]) {
    const game = new CharacterHarness();
    establish(game);
    const before = structuredClone(game.player);
    assert.equal(game.createCharacter(draft("demon")), false);
    assert.deepEqual(game.player, before);
    assert.equal(game.saves, 0);
  }
});

test("sanctuary appearance edits preserve lineage, affinity, possessions and progression", () => {
  const game = new CharacterHarness();
  game.createCharacter(draft());
  game.player.rank = 6;
  game.player.goodKarma = 500;
  game.player.lifetimeGood = 7000;
  const before = structuredClone(game.player);
  assert.equal(
    game.updateAppearance({
      name: "Nova",
      lineage: "demon",
      starterBranch: "fire-create",
      appearance: {
        ...game.player.appearance,
        bodyType: "mystic",
        auraColor: "gold",
      },
    }),
    true,
  );
  assert.equal(game.player.name, "Nova");
  assert.equal(game.player.appearance.bodyType, "mystic");
  assert.equal(game.player.appearance.auraColor, "gold");
  for (const key of [
    "id",
    "lineage",
    "starterBranch",
    "learned",
    "inventory",
    "rank",
    "goodKarma",
    "badKarma",
    "lifetimeGood",
    "lifetimeBad",
  ])
    assert.deepEqual(game.player[key], before[key], key);
});

test("appearance editing requires creation and safe sanctuary context, including owned plots", () => {
  const game = new CharacterHarness();
  assert.equal(game.updateAppearance({ name: "Nova" }), false);
  game.createCharacter(draft());
  for (const [key, value] of [
    ["conflict", true],
    ["downed", true],
    ["castState", {}],
    ["techniqueState", {}],
  ]) {
    game[key] = value;
    const before = structuredClone(game.player);
    assert.equal(game.updateAppearance({ name: "Nova" }), false);
    assert.deepEqual(game.player, before);
    delete game[key];
  }
  game.player.x = 2100;
  game.player.y = 1300;
  assert.equal(game.updateAppearance({ name: "Nova" }), false);
  game.player.x = 400;
  game.player.y = 500;
  assert.equal(game.updateAppearance({ name: "Nova" }), true);
  game.zone.id = "city-of-stars";
  assert.equal(
    game.updateAppearance({ name: "Orion" }),
    false,
    "A plot in another zone does not permit editing",
  );
});

const memoryStorage = () => {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
};

test("real engine creation and sanctuary appearance survive checkpoint reload with one free power", async () => {
  const { GameEngine } = await import("./engine.js");
  const storage = memoryStorage(),
    game = new GameEngine(null, { headless: true, storage });
  assert.equal(game.player.characterCreated, false);
  assert.equal(game.createCharacter(draft("demon")), true);
  assert.equal(
    game.updateAppearance({
      name: "Nova Vale",
      appearance: { ...game.player.appearance, bodyType: "mystic" },
    }),
    true,
  );
  const checkpoint = game.exportCheckpoint();
  assert.equal(checkpoint.player.characterCreated, true);
  const restored = new GameEngine(null, { headless: true, storage });
  assert.equal(restored.player.name, "Nova Vale");
  assert.equal(restored.player.lineage, "demon");
  assert.equal(restored.player.appearance.bodyType, "mystic");
  assert.equal(restored.player.appearance.auraColor, "mint");
  assert.deepEqual(restored.player.learned, { "fire-create": 1 });
  assert.equal(restored.player.badKarma, 125);
  assert.equal(restored.player.lifetimeBad, 0);
  assert.equal(restored.createCharacter(draft()), false);
});

test("a saved unfinished creator remains unfinished instead of becoming a legacy character", async () => {
  const { GameEngine } = await import("./engine.js");
  const storage = memoryStorage(),
    game = new GameEngine(null, { headless: true, storage });
  assert.equal(game.player.characterCreated, false);
  game.save(false);
  const restored = new GameEngine(null, { headless: true, storage });
  assert.equal(restored.player.characterCreated, false);
  assert.equal(restored.createCharacter(draft()), true);
});

test("legacy checkpoint migration keeps the established identity and progression", async () => {
  const { GameEngine, SAVE_KEY } = await import("./engine.js");
  const storage = memoryStorage(),
    game = new GameEngine(null, { headless: true, storage });
  const old = game.exportCheckpoint();
  delete old.player.characterCreated;
  delete old.player.appearance;
  delete old.player.characterVersion;
  old.player.name = "Legacy Keeper";
  old.player.rank = 4;
  old.player.lifetimeGood = 5000;
  old.player.goodKarma = 800;
  old.player.learned["water-grow"] = 3;
  storage.setItem(SAVE_KEY, JSON.stringify(old));
  const migrated = new GameEngine(null, { headless: true, storage });
  assert.equal(migrated.player.characterCreated, true);
  assert.equal(migrated.player.name, "Legacy Keeper");
  assert.equal(migrated.player.rank, 4);
  assert.equal(migrated.player.goodKarma, 800);
  assert.equal(migrated.player.lifetimeGood, 5000);
  assert.equal(migrated.player.learned["water-grow"], 3);
  assert.deepEqual(migrated.player.appearance, defaultAppearance("angel"));
  assert.equal(migrated.createCharacter(draft("demon")), false);
});
