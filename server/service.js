import { randomUUID } from "node:crypto";
import { GameEngine, SAVE_KEY } from "../src/game/engine.js";
import { ZONES } from "../src/data/manual.js";
import { WorldSystems } from "../src/game/worldSystems.js";
import { updateRegionalEncounters } from "../src/game/encounters.js";
import { WorldStore } from "./store.js";
import {
  initRespawns,
  updateRespawns,
  serializeRespawns,
} from "../src/game/respawn.js";
export const MAX_PLAYERS = 64;

const copy = (value) => structuredClone(value);
const wallets = ["goodKarma", "badKarma"];
const integer = (n, min = 0, max = 9999) =>
  Number.isInteger(n) && n >= min && n <= max;
const cleanName = (value) =>
  String(value || "Wayfarer")
    .replace(/[\x00-\x1f]/g, "")
    .trim()
    .slice(0, 24) || "Wayfarer";
const memoryStorage = (checkpoint) => {
  let value = checkpoint ? JSON.stringify(checkpoint) : null;
  return {
    getItem: (key) => (key === SAVE_KEY ? value : null),
    setItem: (key, next) => {
      if (key === SAVE_KEY) value = next;
    },
    removeItem: () => {
      value = null;
    },
  };
};
const BUILD_METHODS = new Set([
  "placeBuild",
  "removeBuild",
  "undoBuild",
  "restoreLayout",
]);
const OWNER_METHODS = new Set([
  "beginRitual",
  "resumeRitual",
  "reverseCondition",
  "restoreLayout",
]);
const ACTIONS = new Set([
  "setPower",
  "setLineage",
  "createCharacter",
  "updateAppearance",
  "cast",
  "cancelCast",
  "interact",
  "attack",
  "dodge",
  "usePotion",
  "useEssencePotion",
  "useItem",
  "trainPower",
  "previewRespecialization",
  "commitRespecialization",
  "cancelRespecialization",
  "trainEnhancement",
  "equipEnhancement",
  "trainTechnique",
  "useTechnique",
  "certifyCrossAffinity",
  "beginOpposingPractice",
  "beginRevive",
  "cancelRevive",
  "useRecoveryRecall",
  "toggleVeil",
  "negotiate",
  "makeRestitution",
  "selectSecondaryTarget",
  "beginRitual",
  "commitRitual",
  "cancelRitual",
  "resumeRitual",
  "reverseCondition",
  "completeCounterAnchor",
  "counterCondition",
  "claimWorldSupply",
  "advanceWorldEvent",
  "completeWorldEvent",
  "disableWorldHazard",
  "assistCreature",
  "bondCompanion",
  "setCompanionSupport",
  "dismissCompanion",
  "craftItem",
  "resumeCraft",
  "cancelCraft",
  "placeBuild",
  "removeBuild",
  "undoBuild",
  "saveLayout",
  "restoreLayout",
  "depositItem",
  "withdrawItem",
  "repairItem",
  "salvageItem",
  "equipItem",
  "visitSanctuary",
  "resurrectNPC",
  "acceptContract",
  "advanceContractStep",
  "settleContract",
  "abandonContract",
  "openContractDialogue",
  "chooseDialogue",
  "hireAlly",
  "commandAlly",
  "pinQuest",
  "chooseTravelRoute",
  "dismissPowerObjects",
  "learnRecipe",
  "previewBarter",
  "lockBarter",
  "commitBarter",
  "cancelBarter",
  "completePortalTrial",
  "navigateToEvent",
  "navigateToRitualAnchor",
  "navigateToCounterAnchor",
  "navigateToHazard",
  "navigateToContract",
]);
const finitePlayer = (player) =>
  player &&
  ["angel", "demon"].includes(player.lineage) &&
  integer(player.rank, 1, 10) &&
  wallets.every((key) => integer(player[key] || 0, 0, 100000000)) &&
  player.inventory &&
  Object.keys(player.inventory).length <= 80 &&
  Object.values(player.inventory).every((n) => integer(n, 0, 9999));

// Shared enemies use one clock even when travelers join from checkpoints with
// different playtimes. Rebase personal deadlines by their remaining duration.
function alignClock(game, target) {
  const offset = target - game.time;
  if (!Number.isFinite(offset) || Math.abs(offset) < 1e-9) return;
  for (const key of [
    "lastAction",
    "lastDamage",
    "lastAttack",
    "lastDodge",
    "recallState",
  ])
    if (Number.isFinite(game[key])) game[key] += offset;
  for (const key of Object.keys(game.cooldowns)) game.cooldowns[key] += offset;
  const seen = new WeakSet();
  const rebase = (value) => {
    if (!value || typeof value !== "object" || seen.has(value)) return;
    seen.add(value);
    for (const [key, item] of Object.entries(value)) {
      if (
        Number.isFinite(item) &&
        item > 0 &&
        (/(?:Until|At)$/.test(key) ||
          ["until", "start", "next", "nextTick", "nextSupport"].includes(key))
      )
        value[key] = item + offset;
      else if (item && typeof item === "object") rebase(item);
    }
  };
  rebase(game.player.statuses);
  rebase(game.player.companion);
  rebase(game.localMagic);
  rebase(game.powerObjects);
  rebase(game.effects);
  rebase(game.castState);
  rebase(game.techniqueState);
  if (game.player.dodgeUntil > 0) game.player.dodgeUntil += offset;
  game.time = target;
}

function refreshLegacyZone(zone, game) {
  if (
    (zone.world?.layoutVersion || 0) >= 2 &&
    zone.world.width >= game.world.width &&
    zone.world.height >= game.world.height
  )
    return;
  const previous = new Map(
    (zone.entities || [])
      .filter(
        (entity) =>
          !entity.contractSimulation &&
          entity.role !== "companion" &&
          !entity.ownerId,
      )
      .map((entity) => [entity.baseEntityId || entity.id, entity]),
  );
  const entities = game.entities.filter(
    (entity) => !entity.contractSimulation && entity.role !== "companion",
  );
  for (const entity of entities) {
    const saved = previous.get(entity.baseEntityId || entity.id);
    if (saved) Object.assign(entity, saved);
  }
  const props = new Map(
    (zone.world?.props || []).map((prop) => [prop.id, prop]),
  );
  for (const prop of game.world.props || []) {
    const saved = props.get(prop.id);
    if (!saved) continue;
    for (const key of [
      "dead",
      "collected",
      "restored",
      "durability",
      "eroded",
      "resolved",
      "growthStage",
      "harvestConsumed",
      "harvestAuthorized",
      "harvestRemaining",
    ])
      if (saved[key] !== undefined) prop[key] = saved[key];
  }
  zone.world = game.world;
  zone.entities = entities;
}

export class CoopService {
  constructor({
    store = new WorldStore(),
    now = () => Date.now(),
    capacity = MAX_PLAYERS,
  } = {}) {
    this.store = store;
    this.now = now;
    this.capacity = Math.max(
      1,
      Math.min(MAX_PLAYERS, Math.floor(Number(capacity) || MAX_PLAYERS)),
    );
    this.rooms = new Map();
    this.connections = new Map();
    this.trades = new Map();
    this.notifier = () => {};
    this.tickCount = 0;
    this.recoverEscrow();
  }
  recoverEscrow() {
    for (const trade of this.store.openTrades()) {
      this.store.transaction(() => {
        for (const [id, offer] of Object.entries(trade.escrow || {})) {
          const checkpoint = this.store.character(trade.roomCode, id);
          if (!checkpoint?.player) continue;
          for (const [item, quantity] of Object.entries(offer.items || {}))
            checkpoint.player.inventory[item] =
              (checkpoint.player.inventory[item] || 0) + quantity;
          for (const key of wallets)
            checkpoint.player[key] =
              (checkpoint.player[key] || 0) + (offer[key] || 0);
          this.store.saveCharacter(trade.roomCode, id, checkpoint);
        }
        trade.status = "cancelled";
        trade.reason = "Server recovery released the uncompleted exchange.";
        trade.escrow = {};
        trade.locks = {};
        trade.confirmations = {};
        this.store.saveTrade(trade);
      });
    }
  }
  createSession(name, checkpoint = null, character = null) {
    const imported = !!checkpoint;
    if (
      checkpoint &&
      (!finitePlayer(checkpoint.player) ||
        checkpoint.version !== 1 ||
        !ZONES.some((zone) => zone.id === checkpoint.zoneId))
    )
      throw Error("This checkpoint cannot be imported.");
    if (!checkpoint) {
      const engine = new GameEngine(null, {
        headless: true,
        storage: memoryStorage(),
      });
      const draft = {
        name: cleanName(character?.name || name),
        lineage: character?.lineage || "angel",
        starterBranch: character?.starterBranch || "water-grow",
        appearance: character?.appearance,
      };
      if (
        typeof engine.createCharacter === "function" &&
        !engine.createCharacter(draft)
      )
        throw Error(
          "Choose a valid character before creating a server identity.",
        );
      engine.player.name = draft.name;
      engine.player.characterCreated = true;
      checkpoint = engine.exportCheckpoint();
    }
    const account = this.store.createAccount(cleanName(name), checkpoint);
    return {
      id: account.id,
      token: account.token,
      name: account.name,
      imported,
    };
  }
  authenticate(token) {
    const account = this.store.authenticate(token);
    if (!account) throw Error("Your session token is invalid.");
    return account;
  }
  roomFor(code) {
    code = String(code || "").toUpperCase();
    if (this.rooms.has(code)) return this.rooms.get(code);
    const saved = this.store.room(code);
    if (!saved) throw Error("No private world has that code.");
    const room = {
      ...saved,
      members: new Map(),
      zones: new Map(Object.entries(saved.state.zones || {})),
      chat: [],
      system: null,
      worldState: saved.state.worldSystems || null,
      sanctuary: saved.state.sanctuary || null,
      stock: saved.state.stock || null,
      ritualOwner: null,
      zoneId: saved.state.zoneId || "sacred-groves",
      respawns: saved.state.respawns || null,
      clockTime: Number.isFinite(saved.state.clockTime)
        ? saved.state.clockTime
        : null,
    };
    this.rooms.set(code, room);
    return room;
  }
  createRoom(token, name) {
    const account = this.authenticate(token),
      room = this.store.createRoom(account.id, name);
    return this.joinRoom(token, room.code);
  }
  joinRoom(token, code) {
    const account = this.authenticate(token),
      room = this.roomFor(code),
      other = this.connections.get(account.id);
    if (other && other.roomCode !== room.code)
      this.leaveRoom(account.id, other.roomCode);
    if (
      !room.members.get(account.id)?.connected &&
      [...room.members.values()].filter((member) => member.connected).length >=
        this.capacity
    )
      throw Error(`This server is full (${this.capacity} travelers).`);
    let member = room.members.get(account.id);
    if (!member) {
      const checkpoint =
        this.store.character(room.code, account.id) || account.checkpoint;
      const engine = new GameEngine(null, {
        headless: true,
        storage: memoryStorage(checkpoint),
        authorityPeer: true,
        onEvent: (event) => this.notifier(account.id, "event", event),
      });
      engine.player.name = cleanName(account.name);
      engine.player.id = account.id;
      // Construction may restore actors before the imported character receives
      // its account identity. This engine has not joined the shared entities yet.
      engine.entities = engine.entities.filter(
        (entity) => entity.role !== "companion" && !entity.contractSimulation,
      );
      member = {
        id: account.id,
        name: account.name,
        engine,
        connected: true,
        lastInput: this.now(),
        sequence: -1,
        role: this.store.role(room.code, account.id) || "visitor",
        contributedAt: -Infinity,
      };
      if (account.id === room.ownerId) member.role = "owner";
      this.store.setRole(room.code, account.id, member.role);
      room.members.set(account.id, member);
      if (!checkpoint && engine.zone.id !== room.zoneId)
        engine.setZone(room.zoneId);
      room.clockTime ??= engine.time;
      alignClock(engine, room.clockTime);
      if (!room.system)
        room.system = new WorldSystems(
          engine,
          room.worldState || engine.worldSystems.serialize(),
        );
      this.bindMember(room, member);
      this.linkMember(room, member);
    }
    alignClock(member.engine, room.clockTime ?? member.engine.time);
    member.connected = true;
    member.lastInput = this.now();
    this.connections.set(account.id, {
      accountId: account.id,
      roomCode: room.code,
    });
    this.persist(room);
    return this.snapshot(room, account.id);
  }
  bindMember(room, member) {
    const engine = member.engine,
      original = engine.resolveEnemy.bind(engine);
    const originalSync = engine.syncContractEntities.bind(engine);
    engine.syncContractEntities = () => {
      originalSync();
      for (const entity of engine.entities) {
        // These are personal interaction facades for a shared physical NPC,
        // not sixty-four extra witnesses standing on the same square.
        if (entity.role === "contract-trader") entity.canWitness = false;
      }
    };
    const originalSetZone = engine.setZone.bind(engine);
    engine.setZone = (...args) => {
      const previousWorld = engine.world,
        previousEntities = engine.entities;
      const result = originalSetZone(...args);
      if (result && engine.world !== previousWorld) {
        this.cancelPlayerTrades(member.id, "Travel released the exchange.");
        for (let i = previousEntities.length - 1; i >= 0; i--) {
          const entity = previousEntities[i];
          if (
            entity.ownerId === member.id &&
            (entity.role === "companion" || entity.contractSimulation)
          )
            previousEntities.splice(i, 1);
        }
        this.linkMember(room, member);
        room.system.climate.update(0, engine);
      }
      return result;
    };
    engine.resolveEnemy = (entity, outcome) => {
      const wasDead = entity.dead,
        result = original(entity, outcome);
      if (!wasDead && entity.dead) {
        const key = `${engine.zone.id}:${entity.id}`;
        for (const peer of room.members.values()) {
          if (
            peer.id === member.id ||
            !peer.connected ||
            peer.engine.zone.id !== engine.zone.id ||
            Math.hypot(
              peer.engine.player.x - entity.x,
              peer.engine.player.y - entity.y,
            ) > 650 ||
            this.now() - peer.contributedAt > 60000 ||
            peer.engine.rewardedEncounters.includes(key)
          )
            continue;
          const game = peer.engine;
          game.rewardedEncounters.push(key);
          game.player.inventory.crystal =
            (game.player.inventory.crystal || 0) + 1;
          game.player.inventory.herb = (game.player.inventory.herb || 0) + 1;
          const coerced = entity.resolved === "coerced";
          game.progress(
            coerced
              ? entity.boss
                ? "dominate"
                : "coerce"
              : entity.boss
                ? "boss"
                : "resolve",
          );
          game.recordCooperativeObjective?.(`coop:${room.code}:${key}`, {
            type: "shared encounter",
            partnerId: member.id,
          });
          engine.recordCooperativeObjective?.(`coop:${room.code}:${key}`, {
            type: "shared encounter",
            partnerId: peer.id,
          });
          this.notifier(peer.id, "event", {
            type: "quest",
            text: `Shared encounter settled once: ${entity.name}.`,
          });
        }
        this.persist(room);
      }
      return result;
    };
  }
  linkMember(room, member) {
    const game = member.engine;
    let zone = room.zones.get(game.zone.id);
    if (!zone?.world || !zone.entities) {
      zone = { world: game.world, entities: game.entities };
      room.zones.set(game.zone.id, zone);
    } else {
      refreshLegacyZone(zone, game);
      game.world = zone.world;
      game.entities = zone.entities;
    }
    game.worldSystems = room.system;
    if (!room.respawns) room.respawns = game.respawns || initRespawns(game);
    game.respawns = room.respawns;
    if (!room.sanctuary)
      room.sanctuary = {
        plot: game.sanctuary.plot,
        components: game.sanctuary.components,
      };
    game.sanctuary.plot = room.sanctuary.plot;
    game.sanctuary.components = room.sanctuary.components;
    if (!room.stock) room.stock = game.shop.stock;
    else game.shop.stock = room.stock;
    game.worldModel = room.system.snapshot();
    for (let i = game.entities.length - 1; i >= 0; i--) {
      const entity = game.entities[i];
      if (entity.role === "companion" && !entity.ownerId)
        game.entities.splice(i, 1);
    }
    game.syncContractEntities();
    updateRegionalEncounters(game, 0);
  }
  member(token) {
    const account = this.authenticate(token),
      connection = this.connections.get(account.id);
    if (!connection) throw Error("Join a private world first.");
    const room = this.roomFor(connection.roomCode),
      member = room.members.get(account.id);
    if (!member?.connected) throw Error("Your world membership expired.");
    room.system.engine = member.engine;
    return { room, member };
  }
  input(token, input = {}) {
    const { member } = this.member(token),
      game = member.engine;
    member.lastInput = this.now();
    if (
      input.sequence != null &&
      (!integer(input.sequence, 0, 2147483647) ||
        input.sequence <= member.sequence)
    )
      return false;
    member.sequence = input.sequence ?? member.sequence;
    game.handleCommand({ type: "move", keys: input.blocked ? [] : input.keys });
    game.inputBlocked = !!input.blocked;
    if (input.targetId !== undefined)
      game.handleCommand({ type: "target", targetId: input.targetId });
    if (
      input.pointer &&
      Number.isFinite(input.pointer.x) &&
      Number.isFinite(input.pointer.y)
    )
      game.handleCommand({
        type: "aim",
        x: input.pointer.x,
        y: input.pointer.y,
      });
    if (
      input.destination &&
      Number.isFinite(input.destination.x) &&
      Number.isFinite(input.destination.y)
    )
      game.destination = {
        x: Math.max(30, Math.min(game.world.width - 30, input.destination.x)),
        y: Math.max(30, Math.min(game.world.height - 30, input.destination.y)),
      };
    if (input.selectedPower)
      game.setPower(
        String(input.selectedPower.branchId),
        Number(input.selectedPower.level) || 1,
      );
    return true;
  }
  command(token, method, args = [], input = null) {
    const { room, member } = this.member(token),
      game = member.engine;
    if (input) this.input(token, input);
    game.paused = false;
    if (!Array.isArray(args) || JSON.stringify(args).length > 8192)
      throw Error("Invalid action arguments.");
    if (method === "setZone") {
      if (!ZONES.some((zone) => zone.id === args[0]))
        throw Error("Choose a known region.");
      if (game.inCombat() || game.downed)
        throw Error("Leave conflict before traveling.");
      this.cancelPlayerTrades(member.id, "Travel released the exchange.");
      for (let i = game.entities.length - 1; i >= 0; i--) {
        const entity = game.entities[i];
        if (
          entity.ownerId === member.id &&
          (entity.role === "companion" || entity.contractSimulation)
        )
          game.entities.splice(i, 1);
      }
      game.setZone(args[0]);
      this.linkMember(room, member);
      room.system.climate.update(0, game);
      this.persist(room);
      return true;
    }
    if (method === "navigateTo") {
      if (
        !args.every(
          (value) =>
            typeof value === "number" ||
            typeof value === "string" ||
            value == null,
        )
      )
        throw Error("Invalid route.");
      return game.navigateTo(...args);
    }
    if (method === "save") {
      this.persist(room);
      return true;
    }
    if (method === "exportCheckpoint") return game.exportCheckpoint();
    if (method === "purchase") {
      const [id, quantity, mode, expected] = args,
        quote = game.previewTrade(id, quantity, mode);
      if (!quote.valid || (expected && quote.total !== expected.total))
        throw Error(
          quote.reason || "The posted quote changed. Inspect it again.",
        );
      const result = game.commitTrade(quote.id);
      this.persist(room);
      return result;
    }
    if (!ACTIONS.has(method) || typeof game[method] !== "function")
      throw Error("This action is not available in a shared world.");
    if (
      BUILD_METHODS.has(method) &&
      !["owner", "builder", "steward"].includes(member.role)
    )
      throw Error(
        "The world owner must grant builder permission before this edit.",
      );
    if (method === "removeBuild") {
      const component = game.sanctuary.components.find(
        (item) => item.id === args[0],
      );
      if (component && member.role !== "owner" && component.owner !== member.id)
        throw Error(
          "Only the component owner or world owner may dismantle it.",
        );
    }
    if (OWNER_METHODS.has(method) && member.role !== "owner")
      throw Error(
        "World-scale changes and layout replacement require this world’s owner.",
      );
    if (
      method === "withdrawItem" &&
      args[2] &&
      !["bank", "recovery"].includes(args[2]) &&
      member.role !== "owner"
    )
      throw Error(
        "Withdrawal from shared containers requires owner permission.",
      );
    const result = game[method](...args);
    if (method === "placeBuild" && result?.id) {
      result.owner = member.id;
      const component = game.sanctuary.components.find(
        (c) => c.id === result.id,
      );
      if (component) component.owner = member.id;
    }
    if (BUILD_METHODS.has(method)) {
      room.sanctuary.components = game.sanctuary.components;
      for (const peer of room.members.values())
        peer.engine.sanctuary.components = room.sanctuary.components;
    }
    if (method === "beginRitual" && result) room.ritualOwner = member.id;
    if (
      [
        "cast",
        "attack",
        "interact",
        "useTechnique",
        "assistCreature",
        "advanceContractStep",
      ].includes(method) &&
      result !== false &&
      result != null
    )
      member.contributedAt = this.now();
    this.persist(room);
    return result;
  }
  setRole(token, targetId, role) {
    const { room, member } = this.member(token);
    if (
      member.id !== room.ownerId ||
      !["visitor", "user", "contributor", "builder", "steward"].includes(role)
    )
      throw Error("Only the owner can assign this role.");
    const target = room.members.get(targetId);
    if (!target || target.id === room.ownerId)
      throw Error("Choose a different world member.");
    target.role = role;
    this.store.setRole(room.code, targetId, role);
    return true;
  }
  chat(token, text) {
    const { room, member } = this.member(token);
    text = String(text || "")
      .replace(/[\x00-\x08\x0b-\x1f]/g, "")
      .trim()
      .slice(0, 240);
    if (!text) return false;
    const entry = {
      id: randomUUID(),
      name: member.engine.player.name,
      playerId: member.id,
      text,
      time: this.now(),
    };
    room.chat.push(entry);
    room.chat = room.chat.slice(-40);
    return entry;
  }
  validateOffer(game, offer = {}) {
    const clean = { items: {}, goodKarma: 0, badKarma: 0 };
    if (
      !offer ||
      typeof offer !== "object" ||
      Array.isArray(offer) ||
      Object.keys(offer.items || {}).length > 40
    )
      throw Error("Use an item and currency offer.");
    for (const [id, quantity] of Object.entries(offer.items || {})) {
      if (
        !/^[a-zA-Z][a-zA-Z0-9-]{0,50}$/.test(id) ||
        !integer(quantity, 1, 999)
      )
        throw Error("Offer positive whole item quantities.");
      if ((game.player.inventory[id] || 0) < quantity)
        throw Error("An offered item is no longer available.");
      if (Object.values(game.player.equipment || {}).includes(id))
        throw Error("Unequip offered equipment first.");
      clean.items[id] = quantity;
    }
    for (const key of wallets) {
      const value = Number(offer[key] || 0);
      if (!integer(value, 0, 10000000) || game.player[key] < value)
        throw Error("The offered Karma is unavailable.");
      if (
        !game.player.certified &&
        value &&
        (key === "badKarma") === (game.player.lineage === "angel")
      )
        throw Error(
          "Cross-affinity certification is required for this wallet.",
        );
      clean[key] = value;
    }
    return clean;
  }
  canReceive(game, offer) {
    const keys = new Set(
      Object.entries(game.player.inventory)
        .filter(([, count]) => count > 0)
        .map(([id]) => id),
    );
    for (const [id, quantity] of Object.entries(offer.items || {})) {
      keys.add(id);
      if ((game.player.inventory[id] || 0) + quantity > 9999) return false;
    }
    return (
      keys.size <= 40 &&
      wallets.every(
        (key) =>
          !offer[key] ||
          game.player.certified ||
          (key === "goodKarma") === (game.player.lineage === "angel"),
      )
    );
  }
  persistTrade(room, trade) {
    this.store.transaction(() => {
      for (const id of trade.players)
        this.store.saveCharacter(
          room.code,
          id,
          room.members.get(id).engine.exportCheckpoint(),
        );
      this.store.saveTrade(trade);
    });
  }
  tradeInvite(token, targetId) {
    const { room, member } = this.member(token),
      target = room.members.get(targetId);
    if (!target?.connected || target.id === member.id)
      throw Error("Choose a connected fellow traveler.");
    if (
      [...this.trades.values()].some(
        (trade) =>
          trade.status === "open" &&
          trade.players.some((id) => [member.id, targetId].includes(id)),
      )
    )
      throw Error("One participant already has an open exchange.");
    const trade = {
      id: randomUUID(),
      roomCode: room.code,
      players: [member.id, targetId],
      offers: Object.fromEntries(
        [member.id, targetId].map((id) => [
          id,
          { items: {}, goodKarma: 0, badKarma: 0 },
        ]),
      ),
      locks: {},
      confirmations: {},
      escrow: {},
      status: "open",
      expiresAt: this.now() + 120000,
      revision: 0,
    };
    this.trades.set(trade.id, trade);
    this.store.saveTrade(trade);
    return this.tradePublic(trade);
  }
  tradeFor(token, id) {
    const { room, member } = this.member(token),
      trade = this.trades.get(id);
    if (
      !trade ||
      trade.roomCode !== room.code ||
      !trade.players.includes(member.id) ||
      trade.status !== "open"
    )
      throw Error("That exchange is no longer open.");
    if (this.now() > trade.expiresAt) {
      this.cancelTradeInternal(trade, "Exchange timed out.");
      throw Error("The exchange expired and reservations were released.");
    }
    return { room, member, trade };
  }
  releaseEscrow(trade) {
    const room = this.rooms.get(trade.roomCode);
    for (const [id, offer] of Object.entries(trade.escrow)) {
      const game = room?.members.get(id)?.engine;
      if (!game) continue;
      for (const [item, quantity] of Object.entries(offer.items || {}))
        game.player.inventory[item] =
          (game.player.inventory[item] || 0) + quantity;
      for (const key of wallets) game.player[key] += offer[key] || 0;
    }
    trade.escrow = {};
    trade.locks = {};
    trade.confirmations = {};
  }
  tradeOffer(token, id, offer) {
    const { room, member, trade } = this.tradeFor(token, id),
      available = { player: copy(member.engine.player) },
      held = trade.escrow[member.id];
    if (held) {
      for (const [item, quantity] of Object.entries(held.items))
        available.player.inventory[item] =
          (available.player.inventory[item] || 0) + quantity;
      for (const key of wallets) available.player[key] += held[key];
    }
    const clean = this.validateOffer(available, offer);
    this.releaseEscrow(trade);
    trade.offers[member.id] = clean;
    trade.revision++;
    trade.expiresAt = this.now() + 120000;
    this.persistTrade(room, trade);
    return this.tradePublic(trade);
  }
  tradeLock(token, id) {
    const { room, member, trade } = this.tradeFor(token, id);
    if (trade.locks[member.id]) return this.tradePublic(trade);
    const offer = this.validateOffer(member.engine, trade.offers[member.id]);
    for (const [item, quantity] of Object.entries(offer.items))
      member.engine.player.inventory[item] -= quantity;
    for (const key of wallets) member.engine.player[key] -= offer[key];
    trade.escrow[member.id] = copy(offer);
    trade.locks[member.id] = true;
    this.persistTrade(room, trade);
    return this.tradePublic(trade);
  }
  tradeConfirm(token, id) {
    const { room, member, trade } = this.tradeFor(token, id);
    if (!trade.players.every((playerId) => trade.locks[playerId]))
      throw Error("Both travelers must lock the posted offers.");
    trade.confirmations[member.id] = true;
    if (!trade.players.every((playerId) => trade.confirmations[playerId])) {
      this.persistTrade(room, trade);
      return this.tradePublic(trade);
    }
    for (const receiverId of trade.players) {
      const offer =
        trade.escrow[trade.players.find((playerId) => playerId !== receiverId)];
      if (!this.canReceive(room.members.get(receiverId).engine, offer))
        throw Error(
          "The receiver cannot accept that capacity or affinity. Cancel or change the offer.",
        );
    }
    const before = Object.fromEntries(
      trade.players.map((playerId) => [
        playerId,
        copy(room.members.get(playerId).engine.player),
      ]),
    );
    try {
      this.store.transaction(() => {
        for (const receiverId of trade.players) {
          const receiver = room.members.get(receiverId).engine,
            offer =
              trade.escrow[
                trade.players.find((playerId) => playerId !== receiverId)
              ];
          for (const [item, quantity] of Object.entries(offer.items))
            receiver.player.inventory[item] =
              (receiver.player.inventory[item] || 0) + quantity;
          for (const key of wallets) receiver.player[key] += offer[key] || 0;
          this.store.saveCharacter(
            room.code,
            receiverId,
            receiver.exportCheckpoint(),
          );
        }
        this.store.receipt(
          room.code,
          "player-trade",
          {
            tradeId: trade.id,
            players: trade.players,
            offers: copy(trade.offers),
            revision: trade.revision,
          },
          trade.id,
        );
        this.store.saveTrade({
          ...trade,
          status: "complete",
          escrow: {},
          settledAt: this.now(),
        });
      });
      trade.status = "complete";
      trade.escrow = {};
      trade.settledAt = this.now();
      return this.tradePublic(trade);
    } catch (error) {
      for (const [playerId, player] of Object.entries(before))
        room.members.get(playerId).engine.player = player;
      trade.confirmations = {};
      throw error;
    }
  }
  cancelTradeInternal(trade, reason = "Exchange cancelled.") {
    if (trade.status !== "open") return false;
    this.releaseEscrow(trade);
    trade.status = "cancelled";
    trade.reason = reason;
    const room = this.rooms.get(trade.roomCode);
    if (room) this.persistTrade(room, trade);
    return true;
  }
  tradeCancel(token, id) {
    return this.cancelTradeInternal(this.tradeFor(token, id).trade);
  }
  cancelPlayerTrades(id, reason) {
    for (const trade of this.trades.values())
      if (trade.status === "open" && trade.players.includes(id))
        this.cancelTradeInternal(trade, reason);
  }
  tradePublic(trade) {
    return copy({
      id: trade.id,
      players: trade.players,
      offers: trade.offers,
      locks: trade.locks,
      confirmations: trade.confirmations,
      status: trade.status,
      expiresAt: trade.expiresAt,
      revision: trade.revision,
      reason: trade.reason,
    });
  }
  listMarket(token, itemId, quantity, price, currency = "goodKarma") {
    const { room, member } = this.member(token);
    if (
      !integer(quantity, 1, 99) ||
      !integer(price, 1, 1000000) ||
      !wallets.includes(currency)
    )
      throw Error("Use valid whole quantities and a posted price.");
    this.validateOffer(member.engine, { items: { [itemId]: quantity } });
    if (
      !member.engine.player.certified &&
      (currency === "goodKarma") !== (member.engine.player.lineage === "angel")
    )
      throw Error("Certification is required for the requested currency.");
    member.engine.player.inventory[itemId] -= quantity;
    let listing;
    try {
      this.store.transaction(() => {
        listing = this.store.createListing(
          room.code,
          member.id,
          itemId,
          quantity,
          price,
          currency,
        );
        this.store.saveCharacter(
          room.code,
          member.id,
          member.engine.exportCheckpoint(),
        );
        this.store.receipt(room.code, "market-list", {
          listingId: listing.id,
          sellerId: member.id,
          itemId,
          quantity,
          price,
          currency,
        });
      });
    } catch (error) {
      member.engine.player.inventory[itemId] += quantity;
      throw error;
    }
    return listing;
  }
  buyMarket(token, id) {
    const { room, member } = this.member(token),
      listing = this.store.market(id);
    if (
      !listing ||
      listing.roomCode !== room.code ||
      listing.status !== "open" ||
      listing.sellerId === member.id
    )
      throw Error("That posted listing is unavailable.");
    if (member.engine.player[listing.currency] < listing.price)
      throw Error("Insufficient Karma for this listing.");
    if (
      !this.canReceive(member.engine, {
        items: { [listing.itemId]: listing.quantity },
        [listing.currency]: 1,
      })
    )
      throw Error("This affinity or pack cannot accept the listing.");
    const seller = room.members.get(listing.sellerId),
      checkpoint = seller
        ? seller.engine.exportCheckpoint()
        : this.store.character(room.code, listing.sellerId);
    if (!checkpoint) throw Error("Seller recovery account unavailable.");
    const buyerBefore = copy(member.engine.player),
      sellerBefore = seller ? copy(seller.engine.player) : null;
    try {
      this.store.transaction(() => {
        member.engine.player[listing.currency] -= listing.price;
        member.engine.player.inventory[listing.itemId] =
          (member.engine.player.inventory[listing.itemId] || 0) +
          listing.quantity;
        checkpoint.player[listing.currency] =
          (checkpoint.player[listing.currency] || 0) +
          Math.floor(listing.price * 0.95);
        if (seller) seller.engine.player = checkpoint.player;
        this.store.saveCharacter(room.code, listing.sellerId, checkpoint);
        this.store.saveCharacter(
          room.code,
          member.id,
          member.engine.exportCheckpoint(),
        );
        this.store.closeListing(id, "sold");
        this.store.receipt(
          room.code,
          "market-sale",
          {
            listingId: id,
            buyerId: member.id,
            sellerId: listing.sellerId,
            itemId: listing.itemId,
            quantity: listing.quantity,
            price: listing.price,
            fee: listing.price - Math.floor(listing.price * 0.95),
            currency: listing.currency,
          },
          `sale:${id}`,
        );
      });
      return true;
    } catch (error) {
      member.engine.player = buyerBefore;
      if (seller) seller.engine.player = sellerBefore;
      throw error;
    }
  }
  cancelMarket(token, id) {
    const { room, member } = this.member(token),
      listing = this.store.market(id);
    if (
      !listing ||
      listing.sellerId !== member.id ||
      listing.roomCode !== room.code ||
      listing.status !== "open"
    )
      throw Error("Only the seller can cancel an open listing.");
    this.store.transaction(() => {
      member.engine.player.inventory[listing.itemId] =
        (member.engine.player.inventory[listing.itemId] || 0) +
        listing.quantity;
      this.store.closeListing(id, "cancelled");
      this.store.saveCharacter(
        room.code,
        member.id,
        member.engine.exportCheckpoint(),
      );
    });
    return true;
  }
  leaveRoom(accountId, code) {
    const room = this.rooms.get(code),
      member = room?.members.get(accountId);
    if (!member) return;
    this.cancelPlayerTrades(
      accountId,
      "A traveler disconnected; all reservations were released.",
    );
    member.connected = false;
    member.engine.keys.clear();
    member.engine.destination = null;
    this.persist(room);
    this.connections.delete(accountId);
  }
  persist(room) {
    for (const member of room.members.values())
      this.store.saveCharacter(
        room.code,
        member.id,
        member.engine.exportCheckpoint(),
      );
    const zones = Object.fromEntries(
      [...room.zones].map(([id, zone]) => [
        id,
        { world: zone.world, entities: zone.entities },
      ]),
    );
    room.worldState = room.system?.serialize() || room.worldState;
    this.store.saveRoom(room.code, {
      zones,
      worldSystems: room.worldState,
      sanctuary: room.sanctuary,
      stock: room.stock,
      zoneId: room.zoneId,
      respawns: room.respawns,
      clockTime: room.clockTime,
    });
  }
  tick(dt = 0.05) {
    this.tickCount++;
    for (const room of this.rooms.values()) {
      const members = [...room.members.values()].filter(
        (member) => member.connected,
      );
      if (!members.length) continue;
      room.clockTime = (room.clockTime ?? members[0].engine.time) + dt;
      const driver = room.members.get(room.ritualOwner)?.connected
        ? room.members.get(room.ritualOwner)
        : members.find((member) => member.id === room.ownerId) || members[0];
      room.system.engine = driver.engine;
      room.system.update(dt);
      if (!room.system.active()) room.ritualOwner = null;
      for (const member of members) {
        const game = member.engine;
        if (this.now() - member.lastInput > 800) game.keys.clear();
        game.worldModel = room.system.snapshot();
        game.update(dt);
        updateRegionalEncounters(game, dt);
      }
      for (const zone of room.zones.values()) {
        const peers = members.filter(
          (member) => member.engine.world === zone.world,
        );
        if (peers.length)
          updateRespawns(peers[0].engine, dt, {
            players: peers.map((peer) => peer.engine.player),
          });
        for (const enemy of zone.entities.filter(
          (entity) => entity.kind === "enemy" && !entity.dead,
        )) {
          let target = null,
            nearest = Infinity;
          for (const peer of peers) {
            if (peer.engine.downed) continue;
            const distance = Math.hypot(
              peer.engine.player.x - enemy.x,
              peer.engine.player.y - enemy.y,
            );
            if (distance < nearest) {
              target = peer;
              nearest = distance;
            }
          }
          if (target) target.engine.updateEnemy(enemy, dt);
        }
      }
      if (this.tickCount % 20 === 0) this.persist(room);
    }
    for (const trade of this.trades.values())
      if (trade.status === "open" && this.now() > trade.expiresAt)
        this.cancelTradeInternal(
          trade,
          "Exchange timed out; reservations released.",
        );
  }
  snapshot(room, viewerId, { compact = false, includeWorld = true } = {}) {
    const viewer = room.members.get(viewerId);
    if (!viewer) return null;
    const game = viewer.engine;
    room.system.engine = game;
    const gameSnapshot = game.getSnapshot();
    if (compact && gameSnapshot.veil?.observers) {
      gameSnapshot.veil.observers = gameSnapshot.veil.observers
        .filter(
          (observer) =>
            observer.zoneId === game.zone.id &&
            observer.visible &&
            game.entities.some(
              (entity) =>
                entity.id === observer.id && entity.role !== "contract-trader",
            ),
        )
        .map(({ unseenFor, ...observer }) => observer);
    }
    const visibleEffects = [...room.members.values()]
      .filter(
        (member) => member.connected && member.engine.zone.id === game.zone.id,
      )
      .flatMap((member) =>
        member.engine.effects
          .filter(
            (effect) =>
              member.engine.time - effect.start < effect.duration &&
              Math.hypot(effect.x - game.player.x, effect.y - game.player.y) <
                1600,
          )
          .map((effect) => ({
            ...effect,
            start: game.time - (member.engine.time - effect.start),
          })),
      )
      .slice(-256);
    return {
      status: "connected",
      room: {
        code: room.code,
        name: room.name,
        ownerId: room.ownerId,
        capacity: this.capacity,
        sharedTravel: false,
        tickRate: 20,
      },
      selfId: viewerId,
      role: viewer.role,
      players: [...room.members.values()]
        .filter((member) => member.connected || member.id === viewerId)
        .map((member) => ({
          id: member.id,
          name: member.engine.player.name,
          lineage: member.engine.player.lineage,
          appearance: member.engine.player.appearance,
          characterCreated: member.engine.player.characterCreated,
          rank: member.engine.player.rank,
          x: member.engine.player.x,
          y: member.engine.player.y,
          facing: member.engine.player.facing,
          walking: member.engine.player.walking,
          health: member.engine.player.health,
          maxHealth: member.engine.player.maxHealth,
          zoneId: member.engine.zone.id,
          role: member.role,
          connected: member.connected,
        })),
      game: gameSnapshot,
      entities: compact
        ? game.entities.filter((entity) => {
            if (
              entity.ownerId &&
              entity.ownerId !== viewerId &&
              ["contract-step", "contract-trader"].includes(entity.role)
            )
              return false;
            return (
              entity.id === game.targetId ||
              entity.ownerId === viewerId ||
              Math.hypot(entity.x - game.player.x, entity.y - game.player.y) <
                1400
            );
          })
        : game.entities,
      ...(includeWorld ? { world: game.world } : {}),
      effects: visibleEffects,
      ...(!compact ? { checkpoint: game.exportCheckpoint() } : {}),
      transport: { interestRadius: 1400, protocol: 3 },
      renderState: {
        progression: {
          elapsed: game.progression?.elapsed || 0,
          fallen: game.progression?.fallen || {},
        },
        party: game.contracts?.party || [],
      },
      destination: game.destination || null,
      targetId: game.targetId ?? null,
      worldRevision: room.sanctuary?.components?.length || 0,
      chat: room.chat,
      trades: [...this.trades.values()]
        .filter(
          (trade) =>
            trade.roomCode === room.code && trade.players.includes(viewerId),
        )
        .slice(-10)
        .map((trade) => this.tradePublic(trade)),
      market: this.store.listMarket(room.code),
      receipts: this.store.receipts(room.code),
      serverTime: this.now(),
    };
  }
  close() {
    for (const room of this.rooms.values()) {
      for (const trade of this.trades.values())
        if (trade.roomCode === room.code && trade.status === "open")
          this.cancelTradeInternal(trade, "Server stopped safely.");
      this.persist(room);
    }
    this.store.close();
  }
}
