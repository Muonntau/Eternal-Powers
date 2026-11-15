import {
  BRANCHES,
  CREATURES,
  ZONES,
  ENHANCEMENTS,
  TECHNIQUES,
  RANKS,
  RULES,
} from "../data/manual.js";
import { WorldRenderer, createWorld } from "./renderer.js";
import {
  createRegionalEncounters,
  initializeRegionalEncounters,
  getEncounterQuestDefs,
  interactEncounter,
  updateEncounter,
  damageEncounter,
  applyEncounterControl,
  updateRegionalEncounters,
  installEncounterMethods,
} from "./encounters.js";
import {
  decorateZoneWorld,
  getZoneEntityLayout,
  createWorldEntities,
  isWorldBlocked,
  hasWorldLineOfEffect,
} from "./worldContent.js";
import {
  initLocalPowers,
  computePowerProfile,
  validateLocalAction,
  resolveLocalPower,
  updateLocalPowers,
  installLocalPowerMethods,
  validateTechniqueAction,
  resolveTechniqueAction,
} from "./localPowers.js";
import {
  initProgression,
  updateProgression,
  snapshotProgression,
  installProgression,
} from "./progression.js";
import { WorldSystems } from "./worldSystems.js";
import {
  installContracts,
  initContracts,
  updateContracts,
  getContractsSnapshot,
  getContractEntities,
  getContractDefinitions,
  serializeContracts,
} from "./contracts.js";
import {
  installSanctuary,
  initSanctuary,
  updateSanctuary,
  getSanctuarySnapshot,
} from "./sanctuary.js";

import {
  initRespecialization,
  installRespecialization,
  snapshotRespecialization,
  serializeRespecialization,
} from "./respecialization.js";

import {
  defaultAppearance,
  normalizeAppearance,
  installCharacterMethods,
} from "./character.js";

import { initRespawns, updateRespawns, serializeRespawns } from "./respawn.js";

const SAVE_KEY = "eternal-powers-v1";
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const slug = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-$/, "");
const START_ZONE = "sacred-groves";
const ITEMS = {
  draught: {
    id: "draught",
    name: "Restorative Draught",
    description: "Restores 30 vitality.",
    price: 25,
    icon: "potion",
  },
  essenceDraught: {
    id: "essenceDraught",
    name: "Essence Draught",
    description: "Restores 25 Essence.",
    price: 30,
    icon: "essence",
  },
  herb: {
    id: "herb",
    name: "Moonleaf",
    description: "A restorative herb gathered from the grove.",
    price: 8,
    icon: "herb",
  },
  crystal: {
    id: "crystal",
    name: "Essence Crystal",
    description: "A focused shard used for crafting.",
    price: 15,
    icon: "crystal",
  },
  wood: {
    id: "wood",
    name: "Sacred Timber",
    description: "Fallen wood for repairs and construction.",
    price: 6,
    icon: "wood",
  },
  stone: {
    id: "stone",
    name: "Runestone",
    description: "Material for wards and public projects.",
    price: 6,
    icon: "stone",
  },
  focus: {
    id: "focus",
    name: "Prismatic Focus",
    description: "Focus equipment: +10% power magnitude.",
    price: 200,
    icon: "staff",
  },
  ward: {
    id: "ward",
    name: "Groveward Pendant",
    description: "Ward equipment: reduces incoming damage by 10%.",
    price: 200,
    icon: "amulet",
  },
  utility: {
    id: "utility",
    name: "Wayfarer Boots",
    description: "Utility equipment: +12% movement speed.",
    price: 150,
    icon: "boots",
  },
};
const RECIPES = [
  {
    id: "draught",
    name: "Restorative Draught",
    ingredients: { herb: 2 },
    count: 1,
  },
  {
    id: "essenceDraught",
    name: "Essence Draught",
    ingredients: { herb: 1, crystal: 1 },
    count: 1,
  },
  {
    id: "focus",
    name: "Prismatic Focus",
    ingredients: { crystal: 4, wood: 2 },
    count: 1,
  },
  {
    id: "ward",
    name: "Groveward Pendant",
    ingredients: { stone: 4, crystal: 2 },
    count: 1,
  },
  {
    id: "utility",
    name: "Wayfarer Boots",
    ingredients: { herb: 4, wood: 3 },
    count: 1,
  },
];
const QUEST_DEFS = [
  {
    id: "first-light",
    title: "A Spark of Eternity",
    description: "Practice a power on the sanctuary training target.",
    total: 1,
    reward: 25,
    currency: "good",
    icon: "spark",
    type: "practice",
  },
  {
    id: "moonleaf",
    title: "Gifts of the Grove",
    description: "Gather three Moonleaf plants for the sanctuary.",
    total: 3,
    reward: 75,
    currency: "good",
    icon: "leaf",
    type: "gather",
  },
  {
    id: "restore-grove",
    title: "Where Life Returns",
    description: "Restore three withered patches with a restorative power.",
    total: 3,
    reward: 100,
    currency: "good",
    icon: "water",
    type: "restore",
  },
  {
    id: "lost-crystals",
    title: "Fragments of the Eternal",
    description: "Collect three Essence Crystals around the grove.",
    total: 3,
    reward: 75,
    currency: "good",
    icon: "gem",
    type: "crystal",
  },
  {
    id: "grove-trial",
    title: "The Grove’s Balance",
    description: "Resolve three blighted creatures beyond the eastern bridge.",
    total: 3,
    reward: 150,
    currency: "good",
    icon: "shield",
    type: "resolve",
  },
  {
    id: "crossing",
    title: "A Path for Everyone",
    description: "Repair the bridge marker using 3 timber and 2 runestones.",
    total: 1,
    reward: 100,
    currency: "good",
    icon: "bridge",
    type: "build",
  },
  {
    id: "guardian",
    title: "The Silent Guardian",
    description: "Defeat or restore the Elemental Guardian at the old ruins.",
    total: 1,
    reward: 250,
    currency: "good",
    icon: "crown",
    type: "boss",
  },
  {
    id: "pilgrim",
    title: "Beyond the Familiar",
    description: "Discover three different regions through the grove portal.",
    total: 3,
    reward: 150,
    currency: "good",
    icon: "map",
    type: "discover",
  },
];

function regionQuests(zone) {
  if (zone.id === START_ZONE) return [];
  const r = zone.minRank || 1,
    currency = "good";
  return [
    {
      id: zone.id + ":restore",
      title: "Renewal · " + zone.name,
      description:
        "Restore the three damaged ecological patches in this region.",
      total: 3,
      reward: 100 * r,
      currency,
      icon: "water",
      type: "restore",
    },
    {
      id: zone.id + ":resolve",
      title: "Balance · " + zone.name,
      description:
        "Resolve three local creature encounters by force or restoration.",
      total: 3,
      reward: 100 * r,
      currency,
      icon: "shield",
      type: "resolve",
    },
    {
      id: zone.id + ":build",
      title: "Common Ground · " + zone.name,
      description:
        "Contribute 3 timber and 2 runestones to the public crossing.",
      total: 1,
      reward: 100 * r,
      currency,
      icon: "bridge",
      type: "build",
    },
    {
      id: zone.id + ":boss",
      title: "Regional Trial · " + zone.name,
      description: "Resolve the guardian encounter at the northern ruins.",
      total: 1,
      reward: 100 * r,
      currency,
      icon: "crown",
      type: "boss",
    },
  ];
}

function conflictQuests(zone) {
  const r = zone.minRank || 1;
  return [
    {
      id: zone.id + ":erode",
      title: "Ashes of the Grove",
      description:
        "Destructive route: destroy three original withered gardens with Fire–Destroy or ordinary strikes. Repaired gardens grant no destruction credit.",
      total: 3,
      reward: 100 * r,
      currency: "bad",
      icon: "flame",
      type: "erode",
    },
    {
      id: zone.id + ":coerce",
      title: "A Will Imposed",
      description:
        "Coercive route: reduce three original hostile creatures to zero morale with Hate–Cry. Restored or defeated creatures cannot also yield this reward.",
      total: 3,
      reward: 100 * r,
      currency: "bad",
      icon: "skull",
      type: "coerce",
    },
    {
      id: zone.id + ":dominate",
      title: "Dominion at the Ruins",
      description:
        "Coercive trial: subdue the original guardian by reducing its morale to zero with Hate–Cry.",
      total: 1,
      reward: 100 * r,
      currency: "bad",
      icon: "crown",
      type: "dominate",
    },
  ];
}
function zoneInfo(id) {
  const entry =
    ZONES.find((z) => z.id === id || slug(z.name) === id) ||
    ZONES.find((z) => /Sacred Groves/.test(z.name)) ||
    ZONES[0] ||
    {};
  return {
    ...entry,
    id: entry.id || id,
    name: entry.name || "Sacred Groves",
    subtitle:
      String(entry.realm).toLowerCase() === "hell"
        ? "A realm of embers and shadow"
        : "An ancient sanctuary, alive with possibility",
    realm: entry.realm || "earth",
  };
}
function worldSeed(zone) {
  return 17 + Math.abs([...zone.id].reduce((n, c) => n + c.charCodeAt(0), 0));
}
function variantFor(zone) {
  const n = (zone.name + " " + zone.realm).toLowerCase();
  return /mountain/.test(n)
    ? "mountain"
    : /city|cities|settlement|halls|libraries|palace/.test(n)
      ? "city"
      : /zen|gardens/.test(n)
        ? "garden"
        : /hell|abyss|malevolen|infernal|wasteland|chaos|obsidian|magma/.test(n)
          ? "infernal"
          : /desert/.test(n)
            ? "desert"
            : /waterfall|lake|ocean/.test(n)
              ? "water"
              : /heaven|ethereal sanctuary|divine/.test(n)
                ? "heaven"
                : "forest";
}
function makeWorld(zone) {
  return decorateZoneWorld(
    createWorld(worldSeed(zone), variantFor(zone)),
    zone,
  );
}
function defaultPlayer() {
  return {
    name: "Wayfarer",
    characterCreated: false,
    characterVersion: 2,
    appearance: defaultAppearance("angel"),
    lineage: "angel",
    x: 920,
    y: 900,
    facing: 0,
    walking: false,
    health: 100,
    maxHealth: 100,
    essence: 100,
    maxEssence: 100,
    goodKarma: 125,
    badKarma: 0,
    lifetimeGood: 0,
    lifetimeBad: 0,
    rank: 1,
    xp: 0,
    level: 1,
    inventory: {
      draught: 3,
      essenceDraught: 1,
      herb: 0,
      crystal: 0,
      wood: 0,
      stone: 0,
    },
    equipment: { focus: null, ward: null, utility: null },
    learned: { "water-grow": 1 },
    enhancements: {},
    enhancementSelection: {},
    techniques: [],
    starterBranch: "water-grow",
    starterLocked: false,
    reputation: 0,
    statuses: [],
    dodgeUntil: 0,
    guard: false,
    veil: false,
  };
}
function createEntities(zoneId, variant, playerRank = 1) {
  const hell = variant === "infernal";
  const list = [
    {
      id: "keeper",
      x: 820,
      y: 820,
      name: "Ethereal Virtue Keeper",
      kind: "npc",
      sprite: "keeper",
      description: "Sanctuary keeper · restoration, guidance, and rank trials",
      role: "keeper",
    },
    {
      id: "merchant",
      x: 1080,
      y: 870,
      name: "The Wandering Artisan",
      kind: "npc",
      sprite: "merchant",
      description: "Trade restorative draughts, equipment, and materials.",
      role: "merchant",
    },
    {
      id: "training",
      x: 1030,
      y: 1005,
      name: "Training Effigy",
      kind: "dummy",
      sprite: "dummy",
      health: 100,
      maxHealth: 100,
      description:
        "A renewable practice target. Training grants no repeatable karma.",
    },
    {
      id: "portal",
      x: 713,
      y: 955,
      name: "Wayfarer’s Gate",
      kind: "portal",
      sprite: "portal",
      description:
        "A stable portal to discovered regions. Interact to open the world map.",
    },
    {
      id: "bridge",
      x: 1382,
      y: 930,
      name: "Crossing Restoration",
      kind: "build",
      sprite: "sign",
      description: "Repair the crossing marker: 3 timber + 2 runestones.",
    },
    {
      id: "chest-1",
      x: 750,
      y: 685,
      name: "Forgotten Cache",
      kind: "chest",
      sprite: "chest",
      description: "A sealed cache of useful supplies.",
    },
    {
      id: "chest-2",
      x: 1930,
      y: 1330,
      name: "Pilgrim’s Cache",
      kind: "chest",
      sprite: "chest",
      description: "A sealed cache among the old stones.",
    },
    {
      id: "patch-1",
      x: 1145,
      y: 755,
      name: "Withered Garden",
      kind: "patch",
      sprite: "withered",
      health: 86,
      maxHealth: 100,
      durability: 42,
      maxDurability: 42,
      morale: 50,
      description:
        "Restore with Water–Grow, Hate–Clean, Dark–Heal level 4, or Earth–Give level 4. Destructive route: strike or use Fire–Destroy.",
    },
    {
      id: "patch-2",
      x: 790,
      y: 1090,
      name: "Withered Garden",
      kind: "patch",
      sprite: "withered",
      health: 86,
      maxHealth: 100,
      durability: 42,
      maxDurability: 42,
      morale: 50,
      description: "Restore the damaged habitat with a restorative power.",
    },
    {
      id: "patch-3",
      x: 1100,
      y: 1160,
      name: "Withered Garden",
      kind: "patch",
      sprite: "withered",
      health: 86,
      maxHealth: 100,
      durability: 42,
      maxDurability: 42,
      morale: 50,
      description: "Restore the damaged habitat with a restorative power.",
    },
  ];
  const resources = [
    ["herb", 650, 835],
    ["herb", 1220, 1050],
    ["herb", 885, 1270],
    ["herb", 1210, 620],
    ["herb", 1740, 1280],
    ["herb", 1560, 600],
    ["crystal", 570, 1050],
    ["crystal", 1180, 500],
    ["crystal", 1730, 1170],
    ["crystal", 1940, 680],
    ["crystal", 530, 610],
    ["wood", 625, 1220],
    ["wood", 1010, 1320],
    ["wood", 1160, 1280],
    ["wood", 1570, 1100],
    ["stone", 510, 910],
    ["stone", 1200, 1200],
    ["stone", 1620, 780],
    ["stone", 1900, 980],
  ];
  resources.forEach(([item, x, y], i) =>
    list.push({
      id: `resource-${i}`,
      x,
      y,
      name: ITEMS[item].name,
      kind: "resource",
      sprite: item,
      item,
      description:
        "Press E to gather. Each resource can be collected once per region.",
    }),
  );
  list.push(
    ...createRegionalEncounters(
      zoneInfo(zoneId),
      playerRank,
      worldSeed(zoneInfo(zoneId)),
    ),
    ...createWorldEntities(zoneInfo(zoneId)),
  );
  const layout = getZoneEntityLayout(zoneInfo(zoneId));
  for (const entity of list) {
    if (layout[entity.id]) {
      Object.assign(entity, layout[entity.id]);
      if (entity.home) entity.home = { x: entity.x, y: entity.y };
    }
  }
  return list;
}

export class GameEngine {
  constructor(
    canvas,
    {
      onUpdate = () => {},
      onEvent = () => {},
      headless = false,
      renderer = null,
      storage = null,
      authorityPeer = false,
    } = {},
  ) {
    this.canvas = canvas;
    this.headless = headless;
    this.authorityPeer = authorityPeer;
    this.storage = storage ?? globalThis.localStorage;
    this.onUpdate = onUpdate;
    this.onEvent = onEvent;
    this.renderer =
      renderer ||
      (headless
        ? {
            render() {},
            screenToWorld(x, y) {
              return { x, y };
            },
          }
        : new WorldRenderer(canvas));
    this.player = defaultPlayer();
    this.time = 0;
    this.lastAction = -100;
    this.lastDamage = -100;
    this.lastAttack = -100;
    this.lastDodge = -100;
    this.cooldowns = {};
    this.keys = new Set();
    this.effects = [];
    this.particles = [];
    this.questProgress = {};
    this.completedQuests = [];
    this.rewardedEncounters = [];
    this.collected = {};
    this.savedAt = null;
    this.zone = zoneInfo(START_ZONE);
    this.discoveredZones = [this.zone.id];
    this.world = makeWorld(this.zone);
    this.entities = createEntities(
      this.zone.id,
      variantFor(this.zone),
      this.player.rank,
    );
    this.camera = { x: 0, y: 0 };
    this.targetId = null;
    this.pointer = { x: 0, y: 0 };
    this.selectedPower = { branchId: "water-grow", level: 1 };
    this.paused = false;
    this.running = false;
    this.destination = null;
    this.castState = null;
    this.downed = false;
    this.log = [];
    this.zoneStates = {};
    this.pinnedQuest = "first-light";
    this.rituals = [];
    this.trialRanks = [];
    this.load();
    initRespecialization(this, this.savedRespecialization);
    initProgression(this, this.savedProgression);
    initLocalPowers(this, this.savedLocalMagic);
    this.zoneCatalog = ZONES;
    initializeRegionalEncounters(this);
    this.worldSystems = new WorldSystems(this, this.savedWorldSystems || {});
    this.worldModel = this.worldSystems.snapshot();
    initSanctuary(this, this.savedSanctuary, this.savedShop);
    initContracts(this, this.savedContracts);
    this.syncContractEntities();
    initRespawns(this, this.savedRespawns);
    this.inputBlocked = false;
    this.bindEvents();
    this.publish();
  }
  bindEvents() {
    if (this.headless) return;
    this.keydown = (e) => {
      if (this.inputBlocked) return;
      if (/INPUT|TEXTAREA|SELECT/.test(e.target?.tagName)) return;
      const k = e.key.toLowerCase();
      if ([" ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k))
        e.preventDefault();
      this.keys.add(k);
      if (e.repeat) return;
      if (k === "e") this.interact();
      if (k === "f") this.attack();
      if (k === " ") this.dodge();
      if (k === "v") this.toggleVeil();
    };
    this.keyup = (e) => this.keys.delete(e.key.toLowerCase());
    this.blur = () => this.keys.clear();
    this.mousemove = (e) => {
      this.pointer = this.renderer.screenToWorld(e.clientX, e.clientY);
    };
    this.click = (e) => {
      if (this.paused || this.inputBlocked) return;
      this.canvas.focus();
      const p = this.renderer.screenToWorld(e.clientX, e.clientY);
      this.pointer = p;
      this.travelWaypoints = [];
      const choices = [
        ...this.entities,
        ...this.world.props.filter((p) =>
          ["lantern", "torch", "brazier", "campfire"].includes(p.kind),
        ),
      ]
        .filter(
          (n) =>
            !n.dead &&
            !n.collected &&
            dist(n, p) < Math.max(25, n.boss ? 40 : 28),
        )
        .sort((a, b) => dist(a, p) - dist(b, p));
      if (choices.length) {
        this.targetId = choices[0].id;
        this.destination = null;
        this.publish();
      } else {
        this.targetId = null;
        this.destination = p;
      }
    };
    this.context = (e) => {
      e.preventDefault();
      if (this.paused || this.inputBlocked) return;
      const p = this.renderer.screenToWorld(e.clientX, e.clientY);
      const t = this.entities.find((n) => !n.dead && dist(n, p) < 40);
      if (t) this.targetId = t.id;
      this.cast();
    };
    window.addEventListener("keydown", this.keydown);
    window.addEventListener("keyup", this.keyup);
    window.addEventListener("blur", this.blur);
    canvasListen(this.canvas, "mousemove", this.mousemove);
    canvasListen(this.canvas, "click", this.click);
    canvasListen(this.canvas, "contextmenu", this.context);
  }
  start() {
    if (this.headless) return;
    if (this.running) return;
    this.running = true;
    let last = performance.now();
    let pub = 0,
      save = 0;
    const frame = (now) => {
      if (!this.running) return;
      const dt = Math.min(0.04, (now - last) / 1000);
      last = now;
      if (!this.paused) this.update(dt);
      this.renderer.render(this, now);
      pub += dt;
      save += dt;
      if (pub > 0.18) {
        this.publish();
        pub = 0;
      }
      if (save > 10) {
        this.save(false);
        save = 0;
      }
      this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
  }
  destroy() {
    if (this.headless) {
      this.save(false);
      return;
    }
    this.running = false;
    cancelAnimationFrame(this.raf);
    window.removeEventListener("keydown", this.keydown);
    window.removeEventListener("keyup", this.keyup);
    window.removeEventListener("blur", this.blur);
    this.canvas.removeEventListener("mousemove", this.mousemove);
    this.canvas.removeEventListener("click", this.click);
    this.canvas.removeEventListener("contextmenu", this.context);
    this.save(false);
  }
  update(dt) {
    this.time += dt;
    updateProgression(this, dt);
    updateLocalPowers(this, dt);
    if (!this.authorityPeer) this.worldSystems?.update(dt);
    updateSanctuary(this, dt);
    updateContracts(this, dt);
    this.syncContractEntities();
    if (!this.authorityPeer) {
      updateRegionalEncounters(this, dt);
      updateRespawns(this, dt);
    }
    const p = this.player;
    if (this.downed) return;
    let dx =
        (this.keys.has("d") || this.keys.has("arrowright") ? 1 : 0) -
        (this.keys.has("a") || this.keys.has("arrowleft") ? 1 : 0),
      dy =
        (this.keys.has("s") || this.keys.has("arrowdown") ? 1 : 0) -
        (this.keys.has("w") || this.keys.has("arrowup") ? 1 : 0);
    p.guard =
      (this.keys.has("g") || this.keys.has("control")) &&
      !this.keys.has("shift");
    if (
      this.inputBlocked ||
      p.statuses.some((s) => s.type === "root" && s.until > this.time)
    ) {
      dx = 0;
      dy = 0;
      if (!this.travelWaypoints?.length) this.destination = null;
    }
    if (dx || dy) {
      this.destination = null;
      this.travelWaypoints = [];
    }
    if (
      this.destination &&
      !this.inputBlocked &&
      !p.statuses.some((s) => s.type === "root" && s.until > this.time) &&
      !(dx || dy)
    ) {
      const d = dist(p, this.destination);
      if (d < 6) this.destination = this.travelWaypoints?.shift() || null;
      else {
        dx = (this.destination.x - p.x) / d;
        dy = (this.destination.y - p.y) / d;
      }
    }
    p.walking = !!(dx || dy);
    if (p.walking) {
      if (this.castState || this.techniqueState) {
        this.event("info", "Movement cancelled the cast before commitment.");
        this.castState = null;
        this.techniqueState = null;
      }
      const len = Math.hypot(dx, dy);
      dx /= len;
      dy /= len;
      const speed =
        (p.statuses.find((s) => s.type === "flight" && s.until > this.time)
          ?.speed || (this.keys.has("shift") ? 180 : 120)) *
        (p.guard ? 0.5 : 1) *
        (this.gearActive("utility") ? 1.2 : 1) *
        (p.statuses.some((s) => s.type === "slow" && s.until > this.time)
          ? 0.7
          : 1) *
        (this.time < p.dodgeUntil ? 3.2 : 1);
      this.movePlayer(dx * speed * dt, dy * speed * dt);
      p.facing =
        Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 1 : 2) : dy < 0 ? 3 : 0;
    }
    if (this.castState && this.time >= this.castState.resolveAt) {
      const c = this.castState;
      this.castState = null;
      this.resolveCast(c);
    }
    if (this.techniqueState && this.time >= this.techniqueState.resolveAt) {
      const c = this.techniqueState;
      this.techniqueState = null;
      this.resolveTechnique(c);
    }
    if (this.recallState && this.time >= this.recallState) {
      this.recallState = null;
      p.x = this.world.spawn.x;
      p.y = this.world.spawn.y;
      p.health = Math.min(p.maxHealth, p.health + 30);
      this.targetId = null;
      this.destination = null;
      this.effect(p, "recall", "#ade7fa", 90, 1.2);
      this.event(
        "success",
        "Recalled to the sanctuary. Progress and inventory retained.",
      );
    }
    const inCombat = this.inCombat();
    if (this.time - this.lastAction > 5 && this.time - this.lastDamage > 5) {
      p.essence = clamp(
        p.essence + 10 * dt,
        0,
        100 - (this.worldSystems?.active()?.escrowEssence || 0),
      );
      if (!inCombat) p.health = clamp(p.health + 10 * dt, 0, p.maxHealth);
    } else if (inCombat && !this.castState)
      p.essence = clamp(
        p.essence + 2 * dt,
        0,
        100 - (this.worldSystems?.active()?.escrowEssence || 0),
      );
    p.statuses = p.statuses.filter((s) => s.until > this.time);
    this.effects = this.effects.filter((e) => this.time - e.start < e.duration);
    if (!this.authorityPeer && !this.skipEncounterAI)
      for (const n of this.entities) {
        if (n.dead || n.kind !== "enemy") continue;
        this.updateEnemy(n, dt);
      }
    if (this.player.health <= 0) this.defeat();
  }
  movePlayer(dx, dy) {
    const p = this.player,
      flying = p.statuses.some(
        (s) => s.type === "flight" && s.until > this.time,
      ),
      nx = clamp(p.x + dx, 40, this.world.width - 40),
      ny = clamp(p.y + dy, 40, this.world.height - 40);
    if (!this.isPositionBlocked(nx, p.y, { flying })) p.x = nx;
    if (!this.isPositionBlocked(p.x, ny, { flying })) p.y = ny;
  }
  updateEnemy(n, dt) {
    if (n.redirectUntil > this.time && !n.boss) {
      const target = this.entities.find(
        (o) =>
          o.id === n.redirectTargetId &&
          o.kind === "enemy" &&
          !o.dead &&
          !o.protected,
      );
      if (target) {
        if (
          n.statusUntil > this.time &&
          ["stun", "feared", "root"].includes(n.status)
        )
          return;
        n.cooldown = Math.max(0, (n.cooldown || 0) - dt);
        const d = dist(n, target);
        if (n.state === "windup") {
          n.windup -= dt;
          if (n.windup <= 0) {
            if (dist(target, n.attackTarget) < 45)
              this.damageEnemy(target, n.damage, "physical");
            n.state = "recover";
            n.cooldown = 2;
          }
        } else if (d > 70) {
          const dx = ((target.x - n.x) / d) * n.speed * dt,
            dy = ((target.y - n.y) / d) * n.speed * dt;
          if (!this.isPositionBlocked(n.x + dx, n.y + dy)) {
            n.x += dx;
            n.y += dy;
          }
          n.state = "chase";
        } else if (n.cooldown <= 0) {
          n.state = "windup";
          n.windup = 0.9;
          n.attackTarget = { x: target.x, y: target.y };
          n.activeTell = "Redirected hostile strike";
        }
        return;
      }
      n.redirectUntil = 0;
      n.redirectTargetId = null;
    }
    if (updateEncounter(this, n, dt)) return;
    n.cooldown = Math.max(0, (n.cooldown || 0) - dt);
    if (n.dot && this.time >= n.dot.next) {
      const ticks = n.dot.ticks;
      this.damageEnemy(n, n.dot.amount);
      n.dot.next += 1;
      n.dot.ticks--;
      if (!n.dot.ticks) n.dot = null;
      if (n.dead) return;
    }
    if (
      n.statusUntil > this.time &&
      (n.status === "root" ||
        n.status === "stun" ||
        n.status === "calmed" ||
        n.status === "feared")
    )
      return;
    const d = dist(n, this.player),
      safe = this.isProtectedAt(this.player);
    if (n.state === "windup") {
      n.windup -= dt;
      if (n.windup <= 0) {
        if (
          dist(this.player, n.attackTarget) < (n.boss ? 75 : 42) &&
          this.time > this.player.dodgeUntil &&
          !safe
        ) {
          this.damagePlayer(
            n.damage *
              (n.weakenedUntil > this.time ? 1 - (n.weakenedAmount || 0.2) : 1),
            n.name,
          );
        }
        this.effect(
          n.attackTarget,
          "impact",
          n.boss ? "#fa916d" : "#ec9c8b",
          n.boss ? 80 : 45,
          0.45,
        );
        n.state = "recover";
        n.cooldown = n.boss ? 2.5 : 1.7;
      }
      return;
    }
    if (n.state === "recover") {
      if (n.cooldown <= 0.9) n.state = "idle";
      return;
    }
    if (d < (n.boss ? 310 : 225) && !safe && !this.player.veil) {
      n.state = "chase";
      if (d > (n.boss ? 92 : 37)) {
        const speed =
          n.speed *
          (n.statusUntil > this.time && n.status === "slow" ? 0.7 : 1);
        n.x += ((this.player.x - n.x) / d) * speed * dt;
        n.y += ((this.player.y - n.y) / d) * speed * dt;
      } else if (n.cooldown <= 0) {
        n.state = "windup";
        n.windup = n.boss ? 1.45 : 0.9;
        n.attackTarget = { x: this.player.x, y: this.player.y };
      }
    } else {
      n.state = "idle";
      if (dist(n, n.home) > 6) {
        const a = dist(n, n.home);
        n.x += ((n.home.x - n.x) / a) * n.speed * 0.5 * dt;
        n.y += ((n.home.y - n.y) / a) * n.speed * 0.5 * dt;
      }
    }
  }
  damagePlayer(amount, source, options = {}) {
    if (this.downed) {
      this.recordDownedHit?.();
      return;
    }
    if (options.projectile) {
      const ward = this.localMagic?.fields.find(
        (f) =>
          f.kind === "projectileWard" &&
          f.until > this.time &&
          f.blocks > 0 &&
          dist(f, this.player) <= f.radius,
      );
      if (ward) {
        ward.blocks--;
        this.event(
          "info",
          "A local Air–Stop field blocked one eligible projectile.",
        );
        return;
      }
    }
    if (!options.ongoing && this.time < this.player.dodgeUntil) return;
    let damage =
      amount *
      (!options.ongoing && this.player.guard ? 0.6 : 1) *
      (1 -
        Math.max(
          this.gearActive("ward") ? 0.1 : 0,
          ...this.player.statuses
            .filter((s) => s.type === "resistance" && s.until > this.time)
            .map((s) => s.amount || 0),
        ));
    const barrier = this.player.statuses.find(
      (s) => s.type === "ward" && s.until > this.time && s.barrier > 0,
    );
    if (barrier) {
      const absorbed = Math.min(damage, barrier.barrier);
      barrier.barrier -= absorbed;
      damage -= absorbed;
    }
    this.player.health = Math.max(0, this.player.health - damage);
    if (this.player.health <= 0) {
      const safeguard = this.player.statuses.find(
        (s) => s.type === "safeguard" && s.until > this.time,
      );
      if (safeguard) {
        this.player.health = 1;
        safeguard.until = 0;
        if (safeguard.encounterKey && this.localMagic)
          this.localMagic.safeguardUsed[safeguard.encounterKey] = true;
        this.event(
          "success",
          "Eternal safeguard consumed. Returned to one vitality.",
        );
      }
    }
    this.lastDamage = this.time;
    this.player.veil = false;
    this.effect(this.player, "damage", "#ee8c83", 25, 0.3);
    this.event("damage", `${source}: −${Math.round(damage)} vitality.`);
  }
  isProtectedAt(point = this.player) {
    const p = this.sanctuary?.plot;
    return (
      dist(point, this.world.spawn) < 300 ||
      !!(
        p &&
        this.zone.id === p.zoneId &&
        point.x >= p.x - 25 &&
        point.x <= p.x + p.width + 25 &&
        point.y >= p.y - 25 &&
        point.y <= p.y + p.height + 25
      )
    );
  }
  inCombat() {
    return (
      this.time - this.lastDamage < 5 ||
      this.entities.some(
        (n) =>
          n.kind === "enemy" &&
          !n.dead &&
          ["chase", "windup", "recover"].includes(n.state),
      )
    );
  }
  gearActive(id) {
    return (
      !!this.player.equipment[id] &&
      (this.sanctuary?.itemDurability?.[id] ?? 100) > 0
    );
  }
  getPower() {
    const branch =
        BRANCHES.find((b) => b.id === this.selectedPower.branchId) ||
        BRANCHES[0],
      original =
        branch?.powers.find((p) => p.level === this.selectedPower.level) ||
        branch?.powers[0];
    return {
      branch,
      power: original ? computePowerProfile(this, branch, original) : null,
    };
  }
  syncContractEntities() {
    if (!this.contracts) return;
    // A co-op room shares this array. Replace only this character's actors;
    // unowned rows are legacy solo markers created before identity assignment.
    for (let i = this.entities.length - 1; i >= 0; i--) {
      const n = this.entities[i];
      if (n.contractSimulation && (!n.ownerId || n.ownerId === this.player.id))
        this.entities.splice(i, 1);
    }
    this.entities.push(
      ...getContractEntities(this).map((n) => ({
        ...n,
        contractSimulation: true,
      })),
    );
  }
  navigateToContract(id, stepId) {
    const contract = getContractDefinitions().find((c) => c.id === id);
    const step =
      contract?.steps.find((s) => s.id === stepId) ||
      contract?.steps.find(
        (s) => !this.contracts?.stateMap?.[id]?.steps?.[s.id]?.complete,
      );
    if (!contract || !step) return false;
    return this.navigateTo(step.x, step.y, contract.zoneId);
  }
  getTargetEntity(id = this.targetId) {
    return (
      this.entities.find((n) => n.id === id) ||
      this.world.props?.find((n) => n.id === id) ||
      this.localMagic?.objects.find((n) => n.id === id) ||
      this.sanctuary?.components.find((n) => n.id === id)
    );
  }
  hasLineOfEffect(a, b) {
    if (!a || !b || !hasWorldLineOfEffect(this.world, a, b)) return false;
    const rects = [
      ...(this.world.terrain?.walls || []),
      ...(this.world.terrain?.cliffs || []),
      ...(this.world.terrain?.gates || []).filter((o) => o.closed !== false),
    ].map((o) => ({ x: o.x, y: o.y, width: o.width, height: o.height }));
    for (const o of [
      ...(this.sanctuary?.components || []),
      ...(this.localMagic?.objects || []),
    ])
      if (
        o.blocking &&
        (!o.zoneId || o.zoneId === this.zone.id) &&
        o.id !== b.id
      )
        rects.push({
          x: o.x - o.width / 2,
          y: o.y - o.height / 2,
          width: o.width,
          height: o.height,
        });
    const dx = b.x - a.x,
      dy = b.y - a.y;
    return !rects.some((o) => {
      let lo = 0,
        hi = 1;
      for (const [origin, delta, min, max] of [
        [a.x, dx, o.x, o.x + o.width],
        [a.y, dy, o.y, o.y + o.height],
      ]) {
        if (Math.abs(delta) < 0.00001) {
          if (origin < min || origin > max) return false;
        } else {
          const t1 = (min - origin) / delta,
            t2 = (max - origin) / delta;
          lo = Math.max(lo, Math.min(t1, t2));
          hi = Math.min(hi, Math.max(t1, t2));
          if (lo > hi) return false;
        }
      }
      return hi > 0.025 && lo < 0.975;
    });
  }
  hasLineOfSight(a, b) {
    return this.hasLineOfEffect(a, b);
  }
  isPositionBlocked(x, y, { radius = 9, flying = false } = {}) {
    if (isWorldBlocked(this.world, x, y, { radius, flying })) return true;
    return [
      ...(this.sanctuary?.components || []),
      ...(this.localMagic?.objects || []),
    ].some(
      (o) =>
        o.blocking &&
        (!o.zoneId || o.zoneId === this.zone.id) &&
        x > o.x - o.width / 2 - radius &&
        x < o.x + o.width / 2 + radius &&
        y > o.y - o.height / 2 - radius &&
        y < o.y + o.height / 2 + radius,
    );
  }
  previewCast() {
    const { branch, power } = this.getPower(),
      target = this.getTargetEntity();
    if (!power) return { valid: false, reason: "No named power selected." };
    if (power.kind === "ritual")
      return this.previewRitual(branch.id, power.level);
    let validation = validateLocalAction(this, branch, power, target);
    if (
      (this.player.learned[branch.id] || 0) < power.level &&
      !this.canUsePractice?.(branch.id, target)
    )
      validation = {
        valid: false,
        reason: `Learn ${power.name} before casting.`,
      };
    else if (this.downed)
      validation = { valid: false, reason: "Recover before casting." };
    else if ((this.cooldowns[power.id] || 0) > this.time)
      validation = { valid: false, reason: `${power.name} is recovering.` };
    else if (this.player.essence < power.essenceCost)
      validation = {
        valid: false,
        reason: `Requires ${power.essenceCost} Essence.`,
      };
    return {
      ...validation,
      powerId: power.id,
      name: power.name,
      targetId: target?.id,
      essenceCost: power.essenceCost,
      castTime: power.castTime,
      cooldown: power.cooldown,
      range: power.range,
      lineOfEffect: !target || this.hasLineOfEffect(this.player, target),
      secondaryTargetId: this.secondaryTargetId || null,
    };
  }

  setPower(branchId, level = 1) {
    const b = BRANCHES.find((b) => b.id === branchId);
    if (
      !b ||
      !Number.isInteger(Number(level)) ||
      !b.powers.some((p) => p.level === Number(level))
    )
      return false;
    this.selectedPower = { branchId, level: Number(level) };
    this.publish();
    return true;
  }
  selectTarget(id) {
    if (this.getTargetEntity(id)) this.targetId = id;
    this.publish();
  }
  cycleTarget() {
    const ns = this.entities.filter(
      (n) => !n.dead && !n.collected && dist(n, this.player) < 450,
    );
    const i = ns.findIndex((n) => n.id === this.targetId);
    if (ns.length) this.targetId = ns[(i + 1) % ns.length].id;
    this.publish();
  }
  cast() {
    if (
      this.paused ||
      this.downed ||
      this.castState ||
      this.techniqueState ||
      this.contracts?.castState
    )
      return false;
    if (
      this.player.statuses.some(
        (s) => ["silence", "stun"].includes(s.type) && s.until > this.time,
      )
    ) {
      this.event(
        "info",
        "A current condition prevents power casting. Movement, consumables, and retreat remain accessible.",
      );
      return false;
    }
    const { branch: b, power: p } = this.getPower();
    if (!p) return false;
    const t = this.getTargetEntity();
    const trial = this.canUsePractice?.(b.id, t) && p.level === 1;
    if ((this.player.learned[b.id] || 0) < p.level && !trial) {
      this.event("info", `Learn ${p.name} in the Powers codex before casting.`);
      return false;
    }
    if ((this.cooldowns[p.id] || 0) > this.time) {
      this.event("info", `${p.name} is recovering.`);
      return false;
    }
    if (this.player.essence < p.essenceCost) {
      this.event("info", `Need ${p.essenceCost} Essence.`);
      return false;
    }
    if (p.kind === "ritual") return this.ritual(b, p, t);
    const preview = validateLocalAction(this, b, p, t);
    if (!preview.valid) {
      this.event("info", preview.reason);
      return false;
    }
    this.player.starterLocked = true;
    this.castState = {
      branch: b,
      power: p,
      targetId: t?.id,
      secondaryTargetId: this.secondaryTargetId,
      point: preview.point,
      deathKey: preview.deathKey,
      trial,
      resolveAt: this.time + p.castTime,
      start: this.time,
    };
    this.destination = null;
    this.travelWaypoints = [];
    this.effect(this.player, "channel", b.color, 38, p.castTime, {
      powerId: p.id,
      branchId: b.id,
      level: p.level,
      family: b.domain.toLowerCase(),
    });
    this.event("cast", `Preparing ${p.name}…`, {
      powerId: p.id,
      branchId: b.id,
      level: p.level,
      family: b.domain.toLowerCase(),
    });
    this.publish();
    return true;
  }

  cancelCast() {
    if (this.castState || this.techniqueState || this.contracts?.castState) {
      if (this.contracts?.castState) {
        const pending = this.contracts.castState;
        const record =
          this.contracts.stateMap?.[pending.contractId]?.steps?.[
            pending.stepId
          ];
        if (record) record.preparing = false;
        this.contracts.castState = null;
      }
      this.castState = null;
      this.techniqueState = null;
      this.event("info", "Cast cancelled. No Essence spent.");
      this.publish();
    }
  }
  resolveCast({
    branch: b,
    power: p,
    targetId,
    secondaryTargetId,
    point,
    deathKey,
    trial,
  }) {
    const t = this.getTargetEntity(targetId);
    if (targetId && !t) {
      this.event("info", "Target is no longer valid. No Essence spent.");
      return false;
    }
    if (
      this.downed ||
      this.player.statuses.some(
        (s) => ["silence", "stun"].includes(s.type) && s.until > this.time,
      )
    ) {
      this.event(
        "info",
        "The caster became invalid before commitment. No resources spent.",
      );
      return false;
    }
    const previousSecondary = this.secondaryTargetId,
      previousPoint = this.pendingPowerPoint;
    this.secondaryTargetId = secondaryTargetId;
    this.pendingPowerPoint = point;
    const check = validateLocalAction(this, b, p, t);
    this.secondaryTargetId = previousSecondary;
    this.pendingPowerPoint = previousPoint;
    if (!check.valid || (deathKey && check.deathKey !== deathKey)) {
      this.event(
        "info",
        (check.reason || "The fallen identity changed before commitment.") +
          " No resources spent.",
      );
      return false;
    }
    if (trial && !this.canUsePractice?.(b.id, t)) {
      this.event(
        "info",
        "The isolated practice trial expired. No resources spent.",
      );
      return false;
    }
    if (this.player.essence < p.essenceCost) return false;
    this.player.essence -= p.essenceCost;
    this.lastAction = this.time;
    this.cooldowns[p.id] = this.time + p.cooldown;
    this.secondaryTargetId = secondaryTargetId;
    this.pendingPowerPoint = point;
    const result = resolveLocalPower(this, b, p, t);
    this.pendingPowerPoint = previousPoint;
    const harmful =
      [
        "hate-cry",
        "dark-pain",
        "fire-destroy",
        "earth-take",
        "love-dirty",
        "light-harm",
        "water-decay",
        "air-stop",
      ].includes(b.id) && t?.kind !== "dummy";
    if (harmful)
      this.recordWitnessAction?.({
        type: "harmful cast",
        targetId: t?.id,
        hostile: true,
      });
    this.onEvent({
      type: "sound",
      quiet: true,
      text: "",
      sound: "release",
      audioOptions: {
        powerId: p.id,
        branchId: b.id,
        level: p.level,
        family: b.domain.toLowerCase(),
      },
    });
    this.save(false);
    this.publish();
    return result;
  }

  restorePatch(t, amount) {
    t.health = clamp(t.health + amount, 0, t.maxHealth);
    if (t.health >= t.maxHealth && !t.restored) {
      t.restored = true;
      t.name = "Restored Garden";
      t.sprite = "flowers";
      if (!t.rewardedOutcome) {
        t.rewardedOutcome = "restored";
        this.worldSystems?.impact("restore", t.id);
        this.progress("restore");
        this.player.inventory.herb++;
      }
    }
  }
  erodePatch(t, amount) {
    t.durability = Math.max(0, (t.durability ?? 42) - amount);
    this.effect(t, "damage", "#e7a376", 35, 0.6);
    if (t.durability <= 0 && !t.eroded) {
      t.eroded = true;
      t.health = 0;
      t.restored = false;
      t.name = "Scorched Garden";
      t.sprite = "withered";
      if (!t.rewardedOutcome) {
        t.rewardedOutcome = "eroded";
        this.worldSystems?.impact("erode", t.id);
        this.progress("erode");
      }
      this.event(
        "success",
        "Original garden destroyed. This outcome cannot also yield restoration credit.",
      );
    } else this.event("hit", `${t.name}: −${amount} durability.`);
  }

  damageEnemy(t, amount, tag = "physical") {
    if (t.dead) return;
    amount = damageEncounter(this, t, amount, tag);
    if (amount <= 0) return;
    if (t.exposedUntil > this.time) amount *= 1.2;
    t.health = Math.max(0, t.health - amount);
    t.state = "chase";
    if (t.status === "calmed") {
      t.statusUntil = 0;
      t.status = null;
    }
    this.effect(t, "damage", "#ffd49a", 24, 0.4);
    if (t.health <= 0) this.resolveEnemy(t, false);
    else this.event("hit", `${t.name}: −${Math.round(amount)} vitality.`);
  }
  resolveEnemy(t, peaceful) {
    if (t.dead) return;
    if (t.eventOnly) {
      t.dead = true;
      if (!peaceful) t.deathKey = this.recordNPCDeath?.(t) || t.deathKey;
      t.resolved =
        peaceful === "coerced" ? "coerced" : peaceful ? "restored" : "defeated";
      this.effect(t, "loot", "#c5d9ac", 35, 0.7);
      this.event(
        "success",
        `${t.name} resolved. Inspect its posted world-event objective for settlement.`,
      );
      this.save(false);
      return;
    }
    t.dead = true;
    if (!peaceful) t.deathKey = this.recordNPCDeath?.(t) || t.deathKey;
    t.resolved =
      peaceful === "coerced" ? "coerced" : peaceful ? "restored" : "defeated";
    this.worldSystems?.impact(t.resolved, t.id);
    this.effect(
      t,
      peaceful ? "heal" : "loot",
      peaceful ? "#a9df95" : "#eec781",
      45,
      1.2,
    );
    const key = this.zone.id + ":" + t.id;
    if (!this.rewardedEncounters.includes(key)) {
      this.rewardedEncounters.push(key);
      this.player.inventory.crystal++;
      this.player.inventory.herb++;
      this.player.xp += t.boss ? 100 : 20;
      if (t.boss) {
        const trial = Math.min(10, this.player.rank + 1);
        if (
          (this.zone.maxRank || 10) >= trial &&
          !this.trialRanks.includes(trial)
        )
          this.trialRanks.push(trial);
      }
      this.progress(
        t.resolved === "coerced"
          ? t.boss
            ? "dominate"
            : "coerce"
          : t.boss
            ? "boss"
            : "resolve",
      );
    }
    this.event(
      "success",
      `${t.name} ${t.resolved}. Essence Crystal collected.`,
    );
    this.save(false);
  }
  attack() {
    if (this.paused || this.downed || this.time - this.lastAttack < 1.5)
      return false;
    let t = this.entities.find(
      (n) =>
        n.id === this.targetId &&
        !n.dead &&
        (n.kind === "enemy" || n.kind === "dummy" || n.kind === "patch"),
    );
    if (!t || dist(t, this.player) > 85) {
      t = this.entities
        .filter(
          (n) =>
            !n.dead &&
            (n.kind === "enemy" || n.kind === "dummy" || n.kind === "patch") &&
            dist(n, this.player) < 85,
        )
        .sort((a, b) => dist(a, this.player) - dist(b, this.player))[0];
    }
    if (!t) {
      this.effect(this.player, "slash", "#f1e3ba", 38, 0.25);
      this.event("info", "Move within reach of a target to strike.");
      return false;
    }
    this.targetId = t.id;
    this.lastAttack = this.time;
    this.lastAction = this.time;
    this.breakVeil?.();
    this.recordWitnessAction?.({
      type: "attack",
      hostile: t.kind !== "dummy",
      targetId: t.id,
    });
    this.effect(t, "slash", "#f1e3ba", 36, 0.25);
    this.player.starterLocked = true;
    if (t.kind === "patch") {
      this.erodePatch(t, 12);
    } else if (t.kind === "dummy") {
      t.health = Math.max(1, t.health - 12);
      this.event("hit", "Training strike: 12 vitality.");
    } else {
      const bonus = this.player.statuses.find(
        (s) => s.type === "nextHit" && s.until > this.time,
      );
      this.damageEnemy(
        t,
        12 * (bonus?.multiplier || 1),
        bonus?.tag || "physical",
      );
      if (bonus) bonus.until = 0;
    }
    this.publish();
    return true;
  }
  dodge() {
    if (this.paused || this.time - this.lastDodge < 3) return false;
    this.lastDodge = this.time;
    this.player.dodgeUntil = this.time + 0.5;
    const dirs = [
        [0, 1],
        [-1, 0],
        [1, 0],
        [0, -1],
      ],
      d = dirs[this.player.facing] || dirs[0];
    this.movePlayer(d[0] * 65, d[1] * 65);
    this.effect(this.player, "dodge", "#d2e6da", 25, 0.5);
    this.publish();
    return true;
  }
  interact() {
    if (this.paused || this.downed) return false;
    const selected = this.entities.find((n) => n.id === this.targetId);
    if (
      selected?.contractSimulation &&
      selected.ownerId &&
      selected.ownerId !== this.player.id
    ) {
      this.event(
        "info",
        "This contract objective belongs to another traveler.",
      );
      return false;
    }
    let t = this.entities.find(
      (n) =>
        n.id === this.targetId &&
        !n.dead &&
        !n.collected &&
        dist(n, this.player) < 110,
    );
    if (!t)
      t = this.entities
        .filter(
          (n) =>
            !n.dead &&
            !n.collected &&
            (!n.contractSimulation ||
              !n.ownerId ||
              n.ownerId === this.player.id) &&
            n.kind !== "enemy" &&
            dist(n, this.player) < 95,
        )
        .sort((a, b) => dist(a, this.player) - dist(b, this.player))[0];
    if (!t) {
      this.event(
        "info",
        "Approach a glowing object or character, then press E.",
      );
      return false;
    }
    this.targetId = t.id;
    if (t.contractSimulation) {
      const result = this.interactContractEntity(t.id);
      this.syncContractEntities();
      this.publish();
      return result;
    }
    if (interactEncounter(this, t)) {
      this.publish();
      return true;
    }
    if (t.kind === "resource") {
      this.player.starterLocked = true;
      t.collected = true;
      this.player.inventory[t.item] = (this.player.inventory[t.item] || 0) + 1;
      this.recordCollected(t.id);
      if (t.item === "herb") this.progress("gather");
      if (t.item === "crystal") this.progress("crystal");
      this.effect(t, "loot", "#dceba0", 25, 0.8);
      this.event("loot", `Gathered ${t.name}.`);
    } else if (t.kind === "chest") {
      this.player.starterLocked = true;
      t.collected = true;
      this.recordCollected(t.id);
      this.player.inventory.draught++;
      this.player.inventory.crystal += 2;
      this.player.inventory.wood += 2;
      this.player.inventory.stone += 2;
      this.event(
        "loot",
        "Cache opened: draught, 2 crystals, 2 timber, and 2 runestones.",
      );
      this.effect(t, "loot", "#e4bd6f", 38, 1);
    } else if (
      t.kind === "patch" &&
      t.harvestAuthorized &&
      t.harvestRemaining > 0
    ) {
      const amount = t.harvestRemaining;
      t.harvestRemaining = 0;
      t.harvestConsumed = true;
      this.player.inventory.herb += amount;
      this.event(
        "loot",
        `Finite harvest collected: ${amount} Moonleaf. This crop lot cannot yield twice.`,
      );
      this.save(false);
    } else if (t.kind === "patch") {
      this.event(
        "info",
        t.restored
          ? "The restored garden is thriving."
          : "Select a restorative power, then press Q to restore this patch.",
      );
    } else if (t.role === "route-portal" && t.destination) {
      this.setZone(t.destination);
    } else if (t.kind === "world-landmark") {
      this.event("dialogue", t.description);
    } else if (t.kind === "portal") {
      this.event("open-map", "Choose a destination in the world atlas.");
    } else if (t.kind === "build") {
      this.build("bridge");
    } else if (t.role === "merchant") {
      this.event("open-shop", "The artisan offers supplies and equipment.");
    } else if (t.role === "keeper") {
      this.event(
        "dialogue",
        this.player.lineage === "demon"
          ? "You can shape a harsher path. Learn Hate–Cry to coerce creatures, or destroy the original withered gardens for the posted Bad Karma contract. A repaired problem cannot reward its destruction."
          : this.completedQuests.includes("guardian")
            ? "You have restored the balance. Continue through the gate; every realm holds another trial."
            : "Welcome, Wayfarer. Practice on the effigy, gather Moonleaf, and restore the three withered gardens. Beyond the bridge, the grove needs your help.",
      );
      this.tryRankUp();
      this.save(false);
    } else if (t.kind === "dummy") {
      this.event(
        "info",
        "Training Effigy selected. Choose a power and press Q to practice.",
      );
    }
    this.publish();
    return true;
  }
  recordCollected(id) {
    if (!this.collected[this.zone.id]) this.collected[this.zone.id] = [];
    if (!this.collected[this.zone.id].includes(id))
      this.collected[this.zone.id].push(id);
  }
  questDefs() {
    return [
      ...QUEST_DEFS,
      ...regionQuests(this.zone),
      ...conflictQuests(this.zone),
      ...getEncounterQuestDefs(this),
    ];
  }
  progress(type, amount = 1) {
    for (const q of this.questDefs()) {
      if (q.type !== type || this.completedQuests.includes(q.id)) continue;
      this.questProgress[q.id] = clamp(
        (this.questProgress[q.id] || 0) + amount,
        0,
        q.total,
      );
      if (this.questProgress[q.id] >= q.total) {
        this.completedQuests.push(q.id);
        const bad = q.currency === "bad";
        const eligible =
          this.player.certified || bad === (this.player.lineage === "demon");
        if (eligible) {
          this.player[bad ? "badKarma" : "goodKarma"] += q.reward;
          this.player[bad ? "lifetimeBad" : "lifetimeGood"] += q.reward;
        }
        this.player.xp += q.reward;
        this.player.reputation = clamp(this.player.reputation + 5, -100, 100);
        this.setReputation?.(
          "faction:grove-keepers",
          5,
          "Posted objective completed",
        );
        if (["encounter-assist", "build"].includes(type))
          this.recordCooperativeObjective?.(q.id, {
            type,
            partnerId: "keeper",
          });
        this.event(
          "quest",
          `${q.title} complete · ${eligible ? "+" + q.reward + " " + (bad ? "Bad" : "Good") + " Karma" : "opposing outcome recorded; certification required for its currency"}`,
        );
        this.tryRankUp();
      }
    }
    this.publish();
  }
  tryRankUp() {
    const eligible = this.player.certified
      ? this.player.lifetimeGood + this.player.lifetimeBad
      : this.player.lineage === "demon"
        ? this.player.lifetimeBad
        : this.player.lifetimeGood;
    let next = this.player.rank + 1;
    let changed = false;
    while (
      next <= 10 &&
      eligible >= 500 * (next - 1) ** 2 &&
      this.trialRanks.includes(next)
    ) {
      this.player.rank = next;
      this.player.level = next;
      this.player.maxHealth = 100 + 10 * (next - 1);
      this.player.health = this.player.maxHealth;
      next++;
      changed = true;
    }
    if (changed)
      this.event(
        "rank",
        `Celestial rank ${this.player.rank} attained. New power levels and trials unlocked.`,
      );
    return changed;
  }
  build(id = "bridge") {
    if (id === "bridge") {
      const buildQuest =
        this.zone.id === START_ZONE ? "crossing" : this.zone.id + ":build";
      if (this.completedQuests.includes(buildQuest)) {
        this.event("info", "The crossing restoration is complete.");
        return false;
      }
      const inv = this.player.inventory;
      if (inv.wood < 3 || inv.stone < 2) {
        this.event(
          "info",
          "Crossing repair requires 3 Sacred Timber and 2 Runestones.",
        );
        return false;
      }
      inv.wood -= 3;
      inv.stone -= 2;
      this.worldSystems?.impact("build", "crossing");
      this.progress("build");
      this.event(
        "success",
        "The public crossing is restored. A safer route now connects the grove.",
      );
      this.save(false);
      return true;
    }
    return false;
  }
  buyItem(id, quantity = 1) {
    const item = ITEMS[id];
    if (!item) return false;
    quantity = clamp(Math.floor(quantity), 1, 20);
    const currency = this.player.lineage === "demon" ? "badKarma" : "goodKarma";
    const cost = item.price * quantity;
    if (this.player[currency] < cost) {
      this.event(
        "info",
        `Need ${cost} ${currency === "goodKarma" ? "Good" : "Bad"} Karma.`,
      );
      return false;
    }
    this.player[currency] -= cost;
    this.player.inventory[id] = (this.player.inventory[id] || 0) + quantity;
    if (["focus", "ward", "utility"].includes(id))
      this.player.equipment[id] = id;
    this.event(
      "trade",
      `Purchased ${quantity} × ${item.name} for ${cost} Karma. Lifetime earnings unchanged.`,
    );
    this.save(false);
    this.publish();
    return true;
  }
  sellItem(id, quantity = 1) {
    if (!ITEMS[id] || this.player.inventory[id] < quantity) return false;
    const price = Math.floor(ITEMS[id].price * 0.5) * quantity;
    this.player.inventory[id] -= quantity;
    this.player[this.player.lineage === "demon" ? "badKarma" : "goodKarma"] +=
      price;
    this.event(
      "trade",
      `Sold ${quantity} × ${ITEMS[id].name} for ${price} Karma. Resale does not increase lifetime earnings.`,
    );
    this.save(false);
    this.publish();
    return true;
  }
  craftItem(id) {
    const r = RECIPES.find((r) => r.id === id);
    if (!r) return false;
    const inv = this.player.inventory;
    if (Object.entries(r.ingredients).some(([k, v]) => (inv[k] || 0) < v)) {
      this.event("info", "Gather the required ingredients before crafting.");
      return false;
    }
    Object.entries(r.ingredients).forEach(([k, v]) => (inv[k] -= v));
    inv[id] = (inv[id] || 0) + r.count;
    if (["focus", "ward", "utility"].includes(id))
      this.player.equipment[id] = id;
    this.event(
      "craft",
      `${r.name} crafted${["focus", "ward", "utility"].includes(id) ? " and equipped" : ""}.`,
    );
    this.save(false);
    this.publish();
    return true;
  }
  usePotion(id = "draught") {
    if (!["draught", "essenceDraught"].includes(id)) return false;
    if (!this.player.inventory[id]) {
      this.event(
        "info",
        "No draughts remaining. Craft or purchase more at the sanctuary.",
      );
      return false;
    }
    const essence = id === "essenceDraught",
      key = essence ? "essence" : "health",
      max = essence ? 100 : this.player.maxHealth;
    if (this.player[key] >= max) {
      this.event(
        "info",
        `${essence ? "Essence" : "Vitality"} is already full.`,
      );
      return false;
    }
    this.player.inventory[id]--;
    if (essence) this.player[key] = Math.min(max, this.player[key] + 25);
    else this.heal(this.player, 30);
    this.effect(this.player, "heal", essence ? "#92bce8" : "#b8e6a6", 40, 0.9);
    this.event(
      "success",
      `${essence ? "Essence" : "Restorative"} Draught used.`,
    );
    this.publish();
    return true;
  }
  equipItem(id) {
    const slot = ["focus", "ward", "utility"].find((s) => s === id);
    if (!slot || !this.player.inventory[id]) return false;
    this.player.equipment[slot] = this.player.equipment[slot] ? null : id;
    this.publish();
    return true;
  }
  trainPower(branchId) {
    if (this.inCombat()) {
      this.event(
        "info",
        "Leave conflict for five seconds before changing your loadout.",
      );
      return false;
    }
    const b = BRANCHES.find((b) => b.id === branchId);
    if (!b) return false;
    const lv = (this.player.learned[branchId] || 0) + 1;
    if (lv > 10) return false;
    const native =
      this.player.lineage === "angel"
        ? ["Love", "Light", "Water", "Air"]
        : ["Hate", "Dark", "Fire", "Earth"];
    if (!native.includes(b.domain) && !this.player.certified) {
      this.event(
        "info",
        "Opposing-domain training requires rank 3 cross-affinity certification.",
      );
      return false;
    }
    if (this.player.rank < lv) {
      this.event(
        "info",
        `Celestial rank ${lv} is required for branch level ${lv}.`,
      );
      return false;
    }
    const price = 100 * lv * lv,
      key = b.currency === "bad" ? "badKarma" : "goodKarma";
    if (this.player[key] < price) {
      this.event(
        "info",
        `Training requires ${price} ${b.currency === "bad" ? "Bad" : "Good"} Karma.`,
      );
      return false;
    }
    this.player.starterLocked = true;
    this.player[key] -= price;
    this.player.learned[branchId] = lv;
    this.event(
      "success",
      `${b.powers[lv - 1]?.name || b.name} learned. Lower powers remain available.`,
    );
    this.save(false);
    this.publish();
    return true;
  }
  trainEnhancement(id) {
    const e = ENHANCEMENTS.find((e) => e.id === id);
    if (!e) return false;
    const r = (this.player.enhancements[id] || 0) + 1,
      cost = 75 * r * r;
    if (r > 5 || this.player.rank < 2 * r - 1) {
      this.event(
        "info",
        `Enhancement rank ${r} requires celestial rank ${2 * r - 1}.`,
      );
      return false;
    }
    const currency = e.currency === "bad" ? "badKarma" : "goodKarma";
    if (this.player[currency] < cost) {
      this.event(
        "info",
        `Requires ${cost} ${e.currency === "bad" ? "Bad" : "Good"} Karma.`,
      );
      return false;
    }
    this.player[currency] -= cost;
    this.player.enhancements[id] = r;
    this.player.enhancementSelection ||= {};
    this.player.enhancementSelection[id] = r;
    this.save(false);
    this.event("success", "Enhancement rank trained.");
    this.publish();
    return true;
  }
  certifyCrossAffinity() {
    if (this.player.rank < 3) {
      this.event(
        "info",
        "Cross-affinity certification unlocks at celestial rank 3.",
      );
      return false;
    }
    const key = this.player.lineage === "demon" ? "badKarma" : "goodKarma";
    if (this.player[key] < 500) {
      this.event("info", "Certification requires 500 native Karma.");
      return false;
    }
    if (this.player.certified) return true;
    this.player[key] -= 500;
    this.player.certified = true;
    this.event(
      "success",
      "Cross-affinity certified. Both currency wallets and opposing branches are available.",
    );
    this.publish();
    return true;
  }
  equipEnhancement(id, rank) {
    if (this.inCombat()) return false;
    const track = ENHANCEMENTS.find((e) => e.id === id);
    rank = Number(rank);
    if (!track || rank < 0 || rank > (this.player.enhancements[id] || 0))
      return false;
    this.player.enhancementSelection ||= {};
    this.player.enhancementSelection[id] = rank;
    this.save(false);
    this.publish();
    return true;
  }
  grantBarrier(amount, duration = 6) {
    const current = this.player.statuses.find(
      (s) => s.type === "ward" && s.until > this.time,
    );
    if (current) {
      current.barrier = Math.max(current.barrier || 0, amount);
      current.until = this.time + duration;
    } else
      this.player.statuses.push({
        type: "ward",
        barrier: amount,
        until: this.time + duration,
      });
  }
  heal(target, amount) {
    const reduction = target.healReductionUntil > this.time ? 0.7 : 1;
    const before = target.health ?? 100;
    target.health = clamp(
      before + Math.floor(amount * reduction),
      0,
      target.maxHealth ?? 100,
    );
    return target.health - before;
  }
  applyControl(target, type, duration) {
    if (!target || target.dead) return;
    if (applyEncounterControl(this, target, type, duration)) return;
    if (
      target.boss &&
      ["root", "stun", "feared", "calmed", "silence"].includes(type)
    ) {
      target.staggerMarks =
        (target.staggerUntil > this.time ? target.staggerMarks || 0 : 0) + 1;
      target.staggerUntil = this.time + 10;
      if (target.staggerMarks >= 3) {
        target.state = "recover";
        target.cooldown = 2;
        target.staggerMarks = 0;
      }
      return;
    }
    target.controlProtection ||= {};
    if ((target.controlProtection[type] || 0) > this.time) return;
    target.status = type;
    target.statusUntil = this.time + duration;
    if (["root", "stun", "feared", "calmed"].includes(type))
      target.controlProtection[type] = this.time + duration + 6;
  }
  trainTechnique(id) {
    const t = TECHNIQUES.find((t) => t.id === id);
    if (!t) return false;
    if (
      !this.player.certified ||
      this.player.rank < t.requiredRank ||
      t.lineage !== this.player.lineage
    ) {
      this.event(
        "info",
        "This technique requires cross-affinity certification, its posted rank, and the matching lineage.",
      );
      return false;
    }
    if (this.player.techniques.includes(id)) return false;
    if (
      !BRANCHES.some(
        (b) => b.domain === t.domain && (this.player.learned[b.id] || 0) >= 1,
      )
    ) {
      this.event(
        "info",
        `Learn level one in ${t.domain} before training its opposing technique.`,
      );
      return false;
    }
    if (t.order > 1) {
      const prior = TECHNIQUES.find(
        (p) =>
          p.lineage === t.lineage &&
          p.domain === t.domain &&
          p.order === t.order - 1,
      );
      if (prior && !this.player.techniques.includes(prior.id)) {
        this.event("info", `Train ${prior.name} first.`);
        return false;
      }
    }
    const wallet = t.currency === "bad" ? "badKarma" : "goodKarma";
    if (this.player[wallet] < t.trainingCost) {
      this.event("info", `Requires ${t.trainingCost} ${t.currency} Karma.`);
      return false;
    }
    this.player[wallet] -= t.trainingCost;
    this.player.techniques.push(id);
    this.event("success", `${t.name} learned.`);
    this.save(false);
    this.publish();
    return true;
  }
  getTechniquePreview(id) {
    const technique = TECHNIQUES.find((t) => t.id === id);
    return technique
      ? {
          ...validateTechniqueAction(this, technique, this.getTargetEntity()),
          technique,
        }
      : { valid: false, reason: "Unknown technique." };
  }
  useTechnique(id) {
    const t = TECHNIQUES.find((t) => t.id === id);
    if (
      this.paused ||
      this.downed ||
      this.castState ||
      this.techniqueState ||
      this.contracts?.castState ||
      !t ||
      !this.player.techniques.includes(id)
    )
      return false;
    if (
      this.player.essence < t.essenceCost ||
      (this.cooldowns[id] || 0) > this.time
    ) {
      this.event(
        "info",
        "This technique needs more Essence or is still recovering.",
      );
      return false;
    }
    const target = this.getTargetEntity(),
      check = validateTechniqueAction(this, t, target);
    if (!check.valid) {
      this.event("info", check.reason);
      return false;
    }
    this.techniqueState = {
      technique: t,
      targetId: target?.id,
      point: check.point,
      start: this.time,
      resolveAt: this.time + t.castTime,
    };
    this.effect(this.player, "channel", "#c7b0e4", 40, t.castTime);
    this.event("cast", `Preparing ${t.name}…`);
    this.publish();
    return true;
  }
  resolveTechnique({ technique: t, targetId, point }) {
    const target = this.getTargetEntity(targetId);
    if (targetId && !target) {
      this.event(
        "info",
        "The technique target became invalid. No Essence spent.",
      );
      return false;
    }
    const previous = this.pendingPowerPoint;
    this.pendingPowerPoint = point;
    const check = validateTechniqueAction(this, t, target);
    if (!check.valid || this.player.essence < t.essenceCost) {
      this.pendingPowerPoint = previous;
      this.event(
        "info",
        check.reason || "Insufficient Essence. No resources spent.",
      );
      return false;
    }
    this.player.essence -= t.essenceCost;
    this.lastAction = this.time;
    this.cooldowns[t.id] = this.time + t.cooldown;
    const result = resolveTechniqueAction(
      this,
      t,
      target,
      point || check.point,
    );
    this.pendingPowerPoint = previous;
    this.event("success", `${t.name} resolved.`);
    this.save(false);
    this.publish();
    return result;
  }
  useEssencePotion() {
    return this.usePotion("essenceDraught");
  }
  ritual(branch, power, target) {
    this.event(
      "open-ritual",
      "Preview the ritual, its world-state consequences, costs, and protected exclusions before beginning.",
    );
    return this.previewRitual(branch.id, power.level);
  }
  previewRitual(branchId, level, scope) {
    return this.worldSystems.previewRitual(branchId, level, scope);
  }
  beginRitual(branchId, level, scope) {
    return this.worldSystems.beginRitual(branchId, level, scope);
  }
  commitRitual() {
    return this.worldSystems.commitRitual();
  }
  cancelRitual() {
    return this.worldSystems.cancelRitual();
  }
  resumeRitual(id) {
    return this.worldSystems.resumeRitual(id);
  }
  reverseCondition(id) {
    return this.worldSystems.reverseCondition(id);
  }
  previewCounterProject(id) {
    return this.worldSystems.previewCounterProject(id);
  }
  completeCounterAnchor(id, anchorId) {
    return this.worldSystems.completeCounterAnchor(id, anchorId);
  }
  counterCondition(id) {
    return this.worldSystems.counterCondition(id);
  }
  claimWorldSupply(siteId, kind) {
    return this.worldSystems.claimSupply(siteId, kind);
  }
  inspectWorldEvent(id) {
    return this.worldSystems.climate.inspectEvent(id);
  }
  advanceWorldEvent(id, action) {
    const result = this.worldSystems.climate.advanceEvent(id, action, this);
    this.save(false);
    this.publish();
    return result;
  }
  completeWorldEvent(id) {
    const result = this.worldSystems.climate.resolveEvent(id, this);
    this.save(false);
    this.publish();
    return result;
  }
  disableWorldHazard(id) {
    return String(id).startsWith("condition-pressure:")
      ? this.worldSystems.disablePressureHazard(id)
      : this.worldSystems.climate.disableHazard(id, this);
  }
  navigateTo(x, y, zoneId) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
    if (this.inCombat() || this.downed) {
      this.event("info", "Leave conflict before using route assistance.");
      return false;
    }
    if (zoneId && zoneId !== this.zone.id) this.setZone(zoneId);
    x = clamp(x, 40, this.world.width - 40);
    y = clamp(y, 40, this.world.height - 40);
    const step = 30,
      cols = Math.floor(this.world.width / step),
      rows = Math.floor(this.world.height / step),
      index = (x, y) => y * cols + x;
    const start = {
        x: clamp(Math.floor(this.player.x / step), 1, cols - 2),
        y: clamp(Math.floor(this.player.y / step), 1, rows - 2),
      },
      goal = {
        x: clamp(Math.floor(x / step), 1, cols - 2),
        y: clamp(Math.floor(y / step), 1, rows - 2),
      };
    const collision = new Map();
    const blocked = (gx, gy) => {
      const key = index(gx, gy);
      if (!collision.has(key))
        collision.set(
          key,
          this.isPositionBlocked(gx * step + step / 2, gy * step + step / 2, {
            radius: 15,
          }),
        );
      return collision.get(key);
    };
    const heuristic = (gx, gy) => {
      const dx = Math.abs(goal.x - gx),
        dy = Math.abs(goal.y - gy);
      return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
    };
    const open = [],
      best = new Map([[index(start.x, start.y), 0]]),
      parents = new Map();
    const before = (a, b) => a.f < b.f || (a.f === b.f && a.g > b.g);
    const pushOpen = (node) => {
      open.push(node);
      let i = open.length - 1;
      while (i > 0) {
        const parent = (i - 1) >> 1;
        if (!before(node, open[parent])) break;
        open[i] = open[parent];
        i = parent;
      }
      open[i] = node;
    };
    const popOpen = () => {
      const top = open[0],
        last = open.pop();
      if (open.length) {
        let i = 0;
        while (i * 2 + 1 < open.length) {
          let child = i * 2 + 1;
          if (child + 1 < open.length && before(open[child + 1], open[child]))
            child++;
          if (!before(open[child], last)) break;
          open[i] = open[child];
          i = child;
        }
        open[i] = last;
      }
      return top;
    };
    // Landmarks and creatures can occupy solid geometry. Find a walkable
    // approach on the player's side rather than routing into their collider.
    if (blocked(goal.x, goal.y)) {
      const candidates = [];
      for (let dy = -4; dy <= 4; dy++)
        for (let dx = -4; dx <= 4; dx++) {
          const gx = goal.x + dx,
            gy = goal.y + dy;
          if (
            gx < 1 ||
            gy < 1 ||
            gx >= cols - 1 ||
            gy >= rows - 1 ||
            blocked(gx, gy)
          )
            continue;
          const proximity = Math.hypot(
            gx * step + step / 2 - x,
            gy * step + step / 2 - y,
          );
          if (proximity <= 130)
            candidates.push({
              x: gx,
              y: gy,
              score: proximity + Math.hypot(gx - start.x, gy - start.y) * 0.1,
            });
        }
      candidates.sort((a, b) => a.score - b.score);
      if (!candidates.length) {
        this.event("info", "Choose an accessible approach near this landmark.");
        return false;
      }
      goal.x = candidates[0].x;
      goal.y = candidates[0].y;
    }
    pushOpen({ ...start, g: 0, f: heuristic(start.x, start.y) });
    let end = null;
    for (
      let count = 0;
      open.length && count < Math.min(cols * rows, 20000);
      count++
    ) {
      const n = popOpen();
      if (n.g > (best.get(index(n.x, n.y)) ?? Infinity)) continue;
      if (n.x === goal.x && n.y === goal.y) {
        end = n;
        break;
      }
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ]) {
        const nx = n.x + dx,
          ny = n.y + dy;
        if (
          nx < 1 ||
          ny < 1 ||
          nx >= cols - 1 ||
          ny >= rows - 1 ||
          blocked(nx, ny) ||
          (dx && dy && (blocked(n.x + dx, n.y) || blocked(n.x, n.y + dy)))
        )
          continue;
        const cost = n.g + Math.hypot(dx, dy),
          key = index(nx, ny);
        if ((best.get(key) ?? Infinity) <= cost) continue;
        best.set(key, cost);
        parents.set(key, index(n.x, n.y));
        pushOpen({ x: nx, y: ny, g: cost, f: cost + heuristic(nx, ny) });
      }
    }
    if (!end) {
      this.event(
        "info",
        "No known safe assisted route. Use ordinary movement or another discovered anchor.",
      );
      return false;
    }
    const route = [];
    let key = index(end.x, end.y),
      initial = index(start.x, start.y);
    while (key !== initial) {
      route.push({
        x: (key % cols) * step + step / 2,
        y: Math.floor(key / cols) * step + step / 2,
      });
      key = parents.get(key);
      if (key == null) break;
    }
    route.reverse();
    if (!this.isPositionBlocked(x, y, { radius: 15 })) route.push({ x, y });
    if (!route.length)
      route.push({ x: goal.x * step + step / 2, y: goal.y * step + step / 2 });
    this.travelWaypoints = route;
    this.destination = this.travelWaypoints.shift() || null;
    this.targetId = null;
    this.event(
      "info",
      "Safe route assistance active. Ordinary movement cancels it.",
    );
    this.publish();
    return true;
  }
  navigateToEvent(id) {
    const event = this.worldSystems.climate.inspectEvent(id);
    return event ? this.navigateTo(event.position.x, event.position.y) : false;
  }
  navigateToRitualAnchor() {
    return this.navigateTo(915, 800);
  }
  navigateToCounterAnchor(conditionId, anchorId) {
    const c = this.worldSystems.conditions.find((c) => c.id === conditionId),
      a = c?.anchors.find((a) => a.id === anchorId);
    return a ? this.navigateTo(a.x, a.y, a.siteId) : false;
  }
  navigateToHazard(id) {
    const h = this.getSnapshot().worldModel.hazards.find((h) => h.id === id);
    return h ? this.navigateTo((h.source || h).x, (h.source || h).y) : false;
  }
  setBuildPreview(preview) {
    this.buildPreview = preview;
    this.publish();
    return preview;
  }

  toggleVeil() {
    if (this.inCombat()) {
      this.event("info", "Veil can be entered only outside conflict.");
      return false;
    }
    this.player.veil = !this.player.veil;
    this.event(
      "info",
      this.player.veil
        ? "Veil active. Ordinary observers see a mundane traveler."
        : "Celestial form revealed.",
    );
    this.publish();
    return true;
  }
  recall() {
    if (this.paused) return false;
    this.recallState = this.time + (this.inCombat() ? 10 : 5);
    this.event(
      "info",
      `Recalling to sanctuary in ${this.inCombat() ? 10 : 5} seconds…`,
    );
    this.publish();
    return true;
  }
  defeat() {
    if (this.downed) return;
    this.downed = true;
    this.damageEquipment?.(10);
    this.event(
      "defeat",
      "Downed. Recalling to sanctuary; progression and inventory are retained.",
    );
    setTimeout(() => {
      this.player.x = this.world.spawn.x;
      this.player.y = this.world.spawn.y;
      this.player.health = this.player.maxHealth;
      this.player.essence = 100;
      this.player.statuses = [];
      this.downed = false;
      this.targetId = null;
      this.entities
        .filter((n) => n.kind === "enemy" && !n.dead)
        .forEach((n) => {
          n.x = n.home.x;
          n.y = n.home.y;
          n.state = "idle";
        });
      this.lastDamage = this.time - 10;
      this.publish();
    }, 2200);
  }
  scaleEncounters() {
    const tier = Math.max(this.zone.minRank || 1, this.player.rank);
    for (const n of this.entities.filter(
      (n) => n.kind === "enemy" && !n.profiledEncounter,
    )) {
      n.encounterRank = tier;
      n.damage = Math.round(n.damage * (1 + (tier - 1) * 0.08));
      n.maxHealth = Math.round(n.maxHealth * (1 + (tier - 1) * 0.14));
      n.health = n.maxHealth;
    }
  }
  setZone(id) {
    const zone = zoneInfo(id);
    if (!zone) return false;
    this.zoneStates[this.zone.id] = {
      entities: this.entities.map((n) => ({
        id: n.id,
        dead: n.dead,
        collected: n.collected,
        restored: n.restored,
        health: n.health,
        durability: n.durability,
        eroded: n.eroded,
        rewardedOutcome: n.rewardedOutcome,
        resolved: n.resolved,
        growthStage: n.growthStage,
        harvestConsumed: n.harvestConsumed,
        harvestAuthorized: n.harvestAuthorized,
        harvestRemaining: n.harvestRemaining,
        deathKey: n.deathKey,
        resurrected: n.resurrected,
        recoverable: n.recoverable,
      })),
    };
    this.zone = zone;
    const variant = variantFor(zone);
    this.player.starterLocked = true;
    this.world = makeWorld(zone);
    this.entities = createEntities(zone.id, variant, this.player.rank);
    this.scaleEncounters();
    const state = this.zoneStates[zone.id]?.entities;
    this.entities.forEach((n) => {
      const s = state?.find((s) => s.id === n.id);
      if (s) Object.assign(n, s);
      if (this.collected[zone.id]?.includes(n.id)) n.collected = true;
    });
    this.player.x = this.world.spawn.x;
    this.player.y = this.world.spawn.y;
    this.destination = null;
    this.targetId = null;
    this.castState = null;
    initializeRegionalEncounters(this);
    if (!this.authorityPeer) initRespawns(this);
    this.lastDamage = this.time - 10;
    this.worldSystems?.climate.update(0, this);
    this.worldSystems?.applyCurrentRegion();
    if (this.contracts) {
      updateContracts(this, 0);
      this.syncContractEntities();
    }
    if (!this.discoveredZones.includes(zone.id)) {
      this.discoveredZones.push(zone.id);
      this.progress("discover");
    }
    this.event(
      "travel",
      `Arrived at ${zone.name}. Sanctuary anchor discovered.`,
    );
    this.save(false);
    this.publish();
    return true;
  }
  setLineage(lineage, starterOrName) {
    if (!["angel", "demon"].includes(lineage)) return false;
    const starter =
      BRANCHES.find((b) => b.id === starterOrName) ||
      BRANCHES.find(
        (b) => b.id === (lineage === "demon" ? "fire-create" : "water-grow"),
      );
    if (starter.currency !== (lineage === "angel" ? "good" : "bad"))
      return false;
    if (
      this.player.starterLocked ||
      this.completedQuests.length ||
      Object.keys(this.player.learned).length > 1
    ) {
      this.event(
        "info",
        "Your starting lineage and branch are established. Learn additional branches through training.",
      );
      return false;
    }
    const former =
      this.player.starterBranch || Object.keys(this.player.learned)[0];
    delete this.player.learned[former];
    this.player.learned[starter.id] = 1;
    this.player.starterBranch = starter.id;
    this.player.lineage = lineage;
    this.selectedPower = { branchId: starter.id, level: 1 };
    const starterBalance = this.player.goodKarma + this.player.badKarma;
    this.player.goodKarma = lineage === "angel" ? starterBalance : 0;
    this.player.badKarma = lineage === "demon" ? starterBalance : 0;
    this.publish();
    this.save(false);
    return true;
  }

  pinQuest(id) {
    if (this.questDefs().some((q) => q.id === id)) this.pinnedQuest = id;
    this.publish();
  }
  setPaused(value) {
    this.paused = !!value;
    this.keys.clear();
    this.publish();
  }
  effect(at, kind, color, radius = 35, duration = 0.8, metadata = {}) {
    this.effects.push({
      x: at.x,
      y: at.y,
      kind,
      color: color || "#b7dfb0",
      radius,
      duration,
      start: this.time,
      ...metadata,
    });
  }
  event(type, text, audioOptions = {}) {
    this.log.unshift({ type, text, time: this.time });
    this.log = this.log.slice(0, 30);
    const sound = {
      cast: "cast",
      hit: "hit",
      damage: "hit",
      loot: "loot",
      quest: "quest",
      rank: "levelup",
      trade: "loot",
      craft: "craft",
      travel: "portal",
      defeat: "death",
    }[type];
    this.onEvent({ type, text, sound, audioOptions });
  }

  handleCommand(command = {}) {
    if (!command || typeof command !== "object" || Array.isArray(command))
      return { ok: false, reason: "Invalid command." };
    const type = String(command.type || command.action || "");
    if (type === "move") {
      const permitted = new Set([
        "w",
        "a",
        "s",
        "d",
        "arrowup",
        "arrowdown",
        "arrowleft",
        "arrowright",
        "shift",
        "g",
        "control",
      ]);
      this.keys = new Set(
        (Array.isArray(command.keys) ? command.keys : [])
          .map((k) => String(k).toLowerCase())
          .filter((k) => permitted.has(k)),
      );
      return { ok: true };
    }
    if (type === "aim") {
      if (!Number.isFinite(command.x) || !Number.isFinite(command.y))
        return { ok: false, reason: "Invalid aim coordinates." };
      this.pointer = {
        x: clamp(command.x, 0, this.world.width),
        y: clamp(command.y, 0, this.world.height),
      };
      return { ok: true };
    }
    if (type === "target") {
      const id = command.targetId ?? command.id;
      if (id == null) {
        this.targetId = null;
        return { ok: true };
      }
      if (!this.getTargetEntity(String(id)))
        return { ok: false, reason: "Unknown target identity." };
      this.selectTarget(String(id));
      return { ok: true };
    }
    const allowed = new Set([
      "setPower",
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
      "toggleVeil",
      "negotiate",
      "makeRestitution",
      "chooseTravelRoute",
      "selectSecondaryTarget",
      "setPowerPoint",
      "setOfferingMessage",
      "dismissPowerObjects",
      "setCompanionSupport",
      "dismissCompanion",
      "learnRecipe",
      "craftItem",
      "useRecoveryRecall",
      "resurrectNPC",
      "acceptContract",
      "settleContract",
      "abandonContract",
      "advanceContractStep",
      "openContractDialogue",
      "chooseDialogue",
      "previewBarter",
      "lockBarter",
      "commitBarter",
      "cancelBarter",
      "hireAlly",
      "commandAlly",
      "navigateToContract",
      "navigateToEvent",
      "navigateToRitualAnchor",
      "navigateToCounterAnchor",
      "navigateToHazard",
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
      "setCompanionMode",
      "previewTrade",
      "commitTrade",
      "cancelTrade",
      "startCraft",
      "resumeCraft",
      "cancelCraft",
      "placeBuild",
      "removeBuild",
      "undoBuild",
      "depositItem",
      "withdrawItem",
      "repairItem",
      "salvageItem",
    ]);
    if (!allowed.has(type) || typeof this[type] !== "function")
      return { ok: false, reason: "This command is not permitted." };
    const args = Array.isArray(command.args) ? command.args.slice(0, 6) : [];
    if (JSON.stringify(args).length > 4096)
      return { ok: false, reason: "Command arguments are too large." };
    try {
      const result = this[type](...args);
      return { ok: result !== false, result: result ?? null };
    } catch (error) {
      return {
        ok: false,
        reason: String(error?.message || "Command rejected."),
      };
    }
  }
  exportCheckpoint() {
    this.save(false);
    try {
      return JSON.parse(this.storage?.getItem(SAVE_KEY) || "null");
    } catch {
      return null;
    }
  }
  restoreCheckpoint(checkpoint) {
    if (!checkpoint || checkpoint.version !== 1 || !this.storage) return false;
    try {
      this.storage.setItem(SAVE_KEY, JSON.stringify(checkpoint));
      if (!this.load()) return false;
      initRespecialization(this, this.savedRespecialization);
      initProgression(this, this.savedProgression);
      initLocalPowers(this, this.savedLocalMagic);
      this.worldSystems = new WorldSystems(this, this.savedWorldSystems || {});
      this.worldModel = this.worldSystems.snapshot();
      initSanctuary(this, this.savedSanctuary, this.savedShop);
      initContracts(this, this.savedContracts);
      this.syncContractEntities();
      initRespawns(this, this.savedRespawns);
      this.publish();
      return true;
    } catch {
      return false;
    }
  }

  getSnapshot() {
    const { branch, power } = this.getPower();
    const target = this.getTargetEntity();
    const nearby = this.entities
      .filter(
        (n) =>
          !n.dead &&
          !n.collected &&
          (!n.contractSimulation ||
            !n.ownerId ||
            n.ownerId === this.player.id) &&
          n.kind !== "enemy" &&
          dist(n, this.player) < 95,
      )
      .sort((a, b) => dist(a, this.player) - dist(b, this.player))[0];
    const quests = this.questDefs().map((q) => ({
      ...q,
      rewardEligible:
        this.player.certified ||
        (q.currency === "bad") === (this.player.lineage === "demon"),
      progress: this.questProgress[q.id] || 0,
      complete: this.completedQuests.includes(q.id),
    }));
    const selectedPower = power
      ? {
          ...power,
          branchId: branch.id,
          color: branch.color,
          remaining: Math.max(0, (this.cooldowns[power.id] || 0) - this.time),
          learned: (this.player.learned[branch.id] || 0) >= power.level,
        }
      : null;
    return {
      player: structuredClone(this.player),
      zone: { ...this.zone },
      selectedPower,
      target: target ? { ...target } : null,
      quests,
      inCombat: this.inCombat(),
      paused: this.paused,
      savedAt: this.savedAt,
      discoveredZones: [...this.discoveredZones],
      objective:
        quests.find(
          (q) => q.id === this.pinnedQuest && !q.complete && q.rewardEligible,
        ) ||
        quests.find((q) => !q.complete && q.rewardEligible) ||
        null,
      interactionHint: nearby
        ? `[E] ${nearby.kind === "resource" ? "Gather" : nearby.kind === "chest" ? "Open" : nearby.role === "merchant" ? "Trade with" : "Inspect"} ${nearby.name}`
        : "",
      time: this.time,
      worldModel: this.worldSystems?.snapshot() || null,
      ...snapshotProgression(this),
      ...snapshotRespecialization(this),
      ...getContractsSnapshot(this),
      localMagic: this.localMagic,
      powerObjects: this.powerObjects || [],
      castPreview: this.previewCast(),
      ...getSanctuarySnapshot(this),
      buildPreview: this.buildPreview || null,
      castState: this.castState
        ? {
            name: this.castState.power.name,
            progress: clamp(
              (this.time - this.castState.start) /
                this.castState.power.castTime,
              0,
              1,
            ),
          }
        : this.techniqueState
          ? {
              name: this.techniqueState.technique.name,
              progress: clamp(
                (this.time - this.techniqueState.start) /
                  this.techniqueState.technique.castTime,
                0,
                1,
              ),
            }
          : this.contracts?.castState
            ? {
                name:
                  this.contracts.castState.name ||
                  "Restoring a contract source",
                progress: clamp(
                  (this.contracts.elapsed - this.contracts.castState.start) /
                    Math.max(
                      0.01,
                      this.contracts.castState.resolveAt -
                        this.contracts.castState.start,
                    ),
                  0,
                  1,
                ),
              }
            : null,
      recalling: this.recallState
        ? Math.max(0, this.recallState - this.time)
        : 0,
      downed: this.downed,
      log: [...this.log],
      items: ITEMS,
      recipes: RECIPES,
      rituals: [...this.rituals],
      cooldowns: { ...this.cooldowns },
      learnedPowers: { ...this.player.learned },
      enemyCount: this.entities.filter((n) => n.kind === "enemy" && !n.dead)
        .length,
      dodgeCooldown: Math.max(0, 3 - (this.time - this.lastDodge)),
    };
  }
  publish() {
    this.onUpdate(this.getSnapshot());
  }
  save(notify = true) {
    if (!this.storage) return false;
    try {
      this.zoneStates[this.zone.id] = {
        entities: this.entities.map((n) => ({
          id: n.id,
          dead: n.dead,
          collected: n.collected,
          restored: n.restored,
          health: n.health,
          durability: n.durability,
          eroded: n.eroded,
          rewardedOutcome: n.rewardedOutcome,
          resolved: n.resolved,
          growthStage: n.growthStage,
          harvestConsumed: n.harvestConsumed,
          harvestAuthorized: n.harvestAuthorized,
          harvestRemaining: n.harvestRemaining,
          deathKey: n.deathKey,
          resurrected: n.resurrected,
          recoverable: n.recoverable,
        })),
      };
      this.savedAt = new Date().toISOString();
      this.storage?.setItem(
        SAVE_KEY,
        JSON.stringify({
          version: 1,
          progression: this.progression,
          respecialization: serializeRespecialization(this),
          respawns: serializeRespawns(this),
          contracts: this.contracts ? serializeContracts(this) : undefined,
          localMagic: this.localMagic,
          gameTime: this.time,
          worldSystems: this.worldSystems?.serialize(),
          sanctuary: this.sanctuary,
          shop: this.shop,
          player: this.player,
          zoneId: this.zone.id,
          questProgress: this.questProgress,
          completedQuests: this.completedQuests,
          rewardedEncounters: this.rewardedEncounters,
          collected: this.collected,
          zoneStates: this.zoneStates,
          discoveredZones: this.discoveredZones,
          selectedPower: this.selectedPower,
          savedAt: this.savedAt,
          rituals: this.rituals,
          trialRanks: this.trialRanks,
          cooldownRemaining: Object.fromEntries(
            Object.entries(this.cooldowns).map(([id, end]) => [
              id,
              Math.max(0, end - this.time),
            ]),
          ),
        }),
      );
      if (notify) this.event("success", "World saved. Your journey is safe.");
      return true;
    } catch {
      if (notify) this.event("info", "This browser could not save locally.");
      return false;
    }
  }
  load() {
    try {
      const s = JSON.parse(this.storage?.getItem(SAVE_KEY) || "null");
      if (!s || s.version !== 1) return false;
      this.time = Math.max(0, Number(s.gameTime) || 0);
      this.savedProgression = s.progression;
      this.savedRespecialization = s.respecialization;
      this.savedRespawns = s.respawns;
      this.savedContracts = s.contracts;
      this.savedLocalMagic = s.localMagic;
      this.savedWorldSystems = s.worldSystems;
      this.savedSanctuary = s.sanctuary;
      this.savedShop = s.shop;
      this.player = {
        ...defaultPlayer(),
        ...s.player,
        statuses: [],
        dodgeUntil: 0,
      };
      this.player.characterCreated =
        typeof s.player?.characterCreated === "boolean"
          ? s.player.characterCreated
          : true;
      this.player.characterVersion = s.player?.characterVersion || 1;
      this.player.appearance = normalizeAppearance(
        s.player?.appearance,
        this.player.lineage,
      );
      this.questProgress = s.questProgress || {};
      this.completedQuests = s.completedQuests || [];
      this.rewardedEncounters = s.rewardedEncounters || [];
      this.collected = s.collected || {};
      this.zoneStates = s.zoneStates || {};
      this.discoveredZones = s.discoveredZones || [START_ZONE];
      this.selectedPower = s.selectedPower || this.selectedPower;
      this.savedAt = s.savedAt;
      this.cooldowns = Object.fromEntries(
        Object.entries(s.cooldownRemaining || {}).map(([id, remaining]) => [
          id,
          this.time + Math.max(0, Number(remaining) || 0),
        ]),
      );
      this.rituals = s.rituals || [];
      this.trialRanks =
        s.trialRanks || (this.completedQuests.includes("guardian") ? [2] : []);
      this.zone = zoneInfo(s.zoneId || START_ZONE);
      this.world = makeWorld(this.zone);
      this.entities = createEntities(
        this.zone.id,
        variantFor(this.zone),
        this.player.rank,
      );
      this.scaleEncounters();
      const state = this.zoneStates[this.zone.id]?.entities;
      this.entities.forEach((n) => {
        const v = state?.find((v) => v.id === n.id);
        if (v) Object.assign(n, v);
        if (this.collected[this.zone.id]?.includes(n.id)) n.collected = true;
      });
      initializeRegionalEncounters(this);
      this.player.health = Math.max(1, this.player.health);
      return true;
    } catch {
      return false;
    }
  }
  reset() {
    this.storage?.removeItem(SAVE_KEY);
    this.player = defaultPlayer();
    delete this.respawns;
    this.savedRespawns = undefined;
    initRespawns(this);
    delete this.respecialization;
    this.savedRespecialization = undefined;
    initRespecialization(this);
    this.questProgress = {};
    this.completedQuests = [];
    this.rewardedEncounters = [];
    this.collected = {};
    this.zoneStates = {};
    this.discoveredZones = [START_ZONE];
    this.trialRanks = [];
    this.rituals = [];
    delete this.progression;
    delete this.contracts;
    this.savedContracts = undefined;
    initContracts(this);
    initProgression(this);
    initLocalPowers(this);
    this.worldSystems = new WorldSystems(this);
    delete this.sanctuary;
    delete this.shop;
    initSanctuary(this);
    this.entities = [];
    this.zone = zoneInfo(START_ZONE);
    this.selectedPower = { branchId: "water-grow", level: 1 };
    this.setZone(START_ZONE);
    this.player.starterLocked = false;
    this.time = 0;
    this.lastAction = -100;
    this.lastDamage = -100;
    this.lastAttack = -100;
    this.lastDodge = -100;
    this.cooldowns = {};
    this.effects = [];
    this.techniqueState = null;
    this.castState = null;
    this.recallState = null;
    this.save(false);
    this.publish();
    this.event("info", "A new journey begins.");
  }
}
installSanctuary(GameEngine, { items: ITEMS, recipes: RECIPES });
installEncounterMethods(GameEngine);
installLocalPowerMethods(GameEngine);
installProgression(GameEngine);
installContracts(GameEngine);
installRespecialization(GameEngine);
installCharacterMethods(GameEngine);
function canvasListen(canvas, type, fn) {
  canvas.addEventListener(type, fn);
}
export { ITEMS, RECIPES, QUEST_DEFS, SAVE_KEY };
