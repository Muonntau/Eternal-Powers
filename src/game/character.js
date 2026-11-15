import { BRANCHES } from "../data/manual.js";

export const BODY_TYPES = Object.freeze([
  {
    id: "wanderer",
    name: "Wanderer",
    description: "A balanced silhouette, ready for the road.",
  },
  {
    id: "vanguard",
    name: "Vanguard",
    description: "Broad armor and a grounded presence.",
  },
  {
    id: "mystic",
    name: "Mystic",
    description: "Flowing robes and an arcane silhouette.",
  },
]);
export const HAIR_STYLES = Object.freeze([
  { id: 0, name: "Cropped" },
  { id: 1, name: "Swept" },
  { id: 2, name: "Long" },
  { id: 3, name: "Crest" },
]);
const palette = (entries) =>
  Object.freeze(
    entries.map(([id, name, color]) => Object.freeze({ id, name, color })),
  );
export const CHARACTER_PALETTES = Object.freeze({
  skinTone: palette([
    ["ivory", "Porcelain", "#f3d6bd"],
    ["rose", "Rose", "#dba58e"],
    ["amber", "Amber", "#c88b5c"],
    ["umber", "Umber", "#865740"],
    ["onyx", "Deep", "#50382f"],
    ["moon", "Moonlit", "#a5b5cc"],
  ]),
  hairColor: palette([
    ["night", "Midnight", "#25263d"],
    ["silver", "Silver", "#d9e2f1"],
    ["copper", "Copper", "#b85b3b"],
    ["gold", "Sunlit", "#e8bf6d"],
    ["plum", "Orchid", "#8e6dbc"],
    ["ocean", "Ocean", "#4ea5b5"],
  ]),
  armorColor: palette([
    ["astral", "Astral", "#7964d9"],
    ["glacier", "Glacier", "#4dabc3"],
    ["ember", "Ember", "#c66655"],
    ["verdant", "Verdant", "#539b85"],
    ["ivory", "Pearl", "#c9c9d7"],
    ["onyx", "Obsidian", "#46516b"],
  ]),
  auraColor: palette([
    ["cyan", "Aether", "#70e5ef"],
    ["violet", "Nebula", "#b49aff"],
    ["gold", "Solar", "#ffcf78"],
    ["rose", "Rosefire", "#f5a2cf"],
    ["ember", "Inferno", "#ff9d76"],
    ["mint", "Verdure", "#95e4b8"],
  ]),
});

export function defaultAppearance(lineage = "angel") {
  return {
    bodyType: "wanderer",
    skinTone: "amber",
    hairStyle: 1,
    hairColor: "night",
    armorColor: lineage === "demon" ? "onyx" : "astral",
    auraColor: lineage === "demon" ? "violet" : "cyan",
  };
}
export function normalizeAppearance(value, lineage = "angel") {
  const source = value && typeof value === "object" ? value : {},
    fallback = defaultAppearance(lineage);
  const result = {
    bodyType: BODY_TYPES.some((item) => item.id === source.bodyType)
      ? source.bodyType
      : fallback.bodyType,
    hairStyle: HAIR_STYLES.some((item) => item.id === source.hairStyle)
      ? source.hairStyle
      : fallback.hairStyle,
  };
  for (const key of Object.keys(CHARACTER_PALETTES))
    result[key] = CHARACTER_PALETTES[key].some(
      (item) => item.id === source[key],
    )
      ? source[key]
      : fallback[key];
  return result;
}
function blend(color, factor) {
  const rgb = color
    .slice(1)
    .match(/../g)
    .map((channel) => parseInt(channel, 16));
  return (
    "#" +
    rgb
      .map((channel) =>
        Math.round(
          factor < 0
            ? channel * (1 + factor)
            : channel + (255 - channel) * factor,
        )
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}
export function resolveAppearanceColors(value, lineage = "angel") {
  const appearance = normalizeAppearance(value, lineage),
    colors = {};
  for (const [key, short] of [
    ["skinTone", "skin"],
    ["hairColor", "hair"],
    ["armorColor", "armor"],
    ["auraColor", "aura"],
  ])
    colors[short] = CHARACTER_PALETTES[key].find(
      (item) => item.id === appearance[key],
    ).color;
  return {
    ...appearance,
    ...colors,
    armorLight: blend(colors.armor, 0.32),
    armorDark: blend(colors.armor, -0.34),
  };
}
export function nativeBranches(lineage = "angel") {
  return BRANCHES.filter(
    (branch) => branch.currency === (lineage === "demon" ? "bad" : "good"),
  );
}
export function validateCharacterDraft(
  draft = {},
  player = null,
  mode = "create",
) {
  if (!draft || typeof draft !== "object")
    return {
      valid: false,
      reason: "Choose your character before entering the world.",
    };
  const name = String(draft.name ?? player?.name ?? "")
    .normalize("NFC")
    .replace(
      /[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g,
      "",
    )
    .trim()
    .replace(/\s+/g, " ");
  if (Array.from(name).length < 2 || Array.from(name).length > 24)
    return { valid: false, reason: "Choose a name with 2–24 characters." };
  const lineage = mode === "edit" ? player?.lineage : draft.lineage;
  if (!["angel", "demon"].includes(lineage))
    return { valid: false, reason: "Choose an angelic or demonic lineage." };
  const starterBranch =
    mode === "edit" ? player?.starterBranch : draft.starterBranch;
  if (!nativeBranches(lineage).some((branch) => branch.id === starterBranch))
    return {
      valid: false,
      reason: "Choose a starting path from your native affinity.",
    };
  return {
    valid: true,
    reason: "",
    value: {
      name,
      lineage,
      starterBranch,
      appearance: normalizeAppearance(
        draft.appearance ?? player?.appearance,
        lineage,
      ),
    },
  };
}
const progressed = (game) =>
  game.player.characterCreated ||
  game.player.starterLocked ||
  game.player.rank > 1 ||
  (game.player.lifetimeGood || 0) > 0 ||
  (game.player.lifetimeBad || 0) > 0 ||
  (game.completedQuests?.length || 0) > 0 ||
  Object.entries(game.player.learned || {}).some(([, level]) => level > 1) ||
  Object.keys(game.player.learned || {}).length > 1 ||
  (game.respecialization?.ledger?.length || 0) > 0;
function atSanctuary(game) {
  const player = game.player,
    hub = game.world?.spawn || { x: 920, y: 900 },
    plot = game.sanctuary?.plot;
  return (
    Math.hypot(player.x - hub.x, player.y - hub.y) <= 300 ||
    !!(
      plot &&
      (!plot.zoneId || plot.zoneId === game.zone?.id) &&
      player.x >= plot.x &&
      player.x <= plot.x + plot.width &&
      player.y >= plot.y &&
      player.y <= plot.y + plot.height
    )
  );
}
const reject = (game, reason) => {
  game.event?.("info", reason);
  return false;
};
const persist = (game) => {
  game.save?.(false);
  game.publish?.();
};
export function installCharacterMethods(GameEngine) {
  Object.assign(GameEngine.prototype, {
    createCharacter(draft) {
      if (progressed(this))
        return reject(
          this,
          "This journey already has a character. Change your appearance at a sanctuary instead.",
        );
      const result = validateCharacterDraft(draft);
      if (!result.valid) return reject(this, result.reason);
      const character = result.value,
        player = this.player;
      const balance =
        Math.max(0, Number(player.goodKarma) || 0) +
        Math.max(0, Number(player.badKarma) || 0);
      Object.assign(player, character, {
        characterCreated: true,
        characterVersion: 2,
        starterLocked: true,
        learned: { [character.starterBranch]: 1 },
        goodKarma: character.lineage === "angel" ? balance : 0,
        badKarma: character.lineage === "demon" ? balance : 0,
      });
      this.selectedPower = { branchId: character.starterBranch, level: 1 };
      this.destination = null;
      this.travelWaypoints = [];
      this.keys?.clear?.();
      this.event?.("success", `${character.name}, your eternity begins.`);
      persist(this);
      return true;
    },
    updateAppearance(draft) {
      if (!this.player.characterCreated)
        return reject(
          this,
          "Create your character before changing their appearance.",
        );
      if (
        this.downed ||
        this.player.health <= 0 ||
        this.inCombat?.() ||
        this.castState ||
        this.techniqueState ||
        !atSanctuary(this)
      )
        return reject(
          this,
          "Return to a sanctuary outside conflict to change your appearance.",
        );
      const result = validateCharacterDraft(draft, this.player, "edit");
      if (!result.valid) return reject(this, result.reason);
      this.player.name = result.value.name;
      this.player.appearance = result.value.appearance;
      this.player.characterVersion = 2;
      this.player.characterCreated = true;
      this.event?.("success", "Your celestial form has been renewed.");
      persist(this);
      return true;
    },
  });
}
