import { BRANCHES, CREATURES, ZONES } from "../data/manual.js";

/** Fast action interpretations of the manual's preserved names and affinities.
 * These timings and attacks belong to Reborn, not the provisional manual rules. */
const DOMAIN = {
  Love: {
    status: "charm",
    verb: "Charm",
    combo:
      "Turn hostile creatures into temporary allies. Charmed enemies carry your next burst into the pack.",
    styles: ["bolt", "chain", "orbit", "nova", "summon", "beam", "chain"],
  },
  Light: {
    status: "shock",
    verb: "Arc",
    combo: "Arc light through wet creatures for a chaining discharge.",
    styles: ["beam", "chain", "nova", "orbit", "beam", "chain", "nova"],
  },
  Water: {
    status: "chill",
    verb: "Freeze",
    combo:
      "Chill creatures to slow them; follow with Fire for a steam burst or Earth to shatter.",
    styles: ["bolt", "nova", "beam", "orbit", "chain", "summon", "nova"],
  },
  Air: {
    status: "push",
    verb: "Launch",
    combo:
      "Push enemies into explosive growths, hazards and your lingering fields.",
    styles: ["bolt", "dash", "nova", "orbit", "beam", "summon", "chain"],
  },
  Hate: {
    status: "vulnerable",
    verb: "Fracture",
    combo:
      "Expose the pack to amplify your next affinity. Follow with a wide blast.",
    styles: ["bolt", "chain", "nova", "beam", "orbit", "summon", "chain"],
  },
  Dark: {
    status: "drain",
    verb: "Drain",
    combo:
      "Drain vitality while controlling the field; vulnerable enemies feed a stronger recovery.",
    styles: ["bolt", "beam", "orbit", "nova", "summon", "chain", "beam"],
  },
  Fire: {
    status: "burn",
    verb: "Ignite",
    combo:
      "Ignite creatures and explosive seedpods. Burning chilled targets creates a steam burst.",
    styles: ["bolt", "nova", "beam", "orbit", "summon", "chain", "nova"],
  },
  Earth: {
    status: "stagger",
    verb: "Shatter",
    combo:
      "Stagger a creature, then shatter a chilled target or release a ring through the crowd.",
    styles: ["bolt", "nova", "orbit", "beam", "summon", "chain", "nova"],
  },
};
const STYLE_TEXT = {
  bolt: "Launch a fast aimed projectile",
  beam: "Release a piercing beam along your aim",
  nova: "Detonate a wide burst at your aim point",
  dash: "Surge through creatures and strike along your route",
  orbit: "Create a moving ring of affinity around you",
  summon: "Call a temporary affinity companion",
  chain: "Jump between nearby creatures",
};
export const AFFINITIES = Object.entries(DOMAIN).map(([id, data]) => ({
  id,
  element: id.toLowerCase(),
  color: BRANCHES.find((b) => b.domain === id)?.color || "#9ae9e1",
  ...data,
}));
export const POWER_BRANCHES = BRANCHES.map((branch, branchIndex) => ({
  id: branch.id,
  name: branch.name,
  domain: branch.domain,
  aspect: branch.aspect,
  currency: branch.currency,
  color: branch.color,
  icon: branch.icon,
  branchIndex,
  description: DOMAIN[branch.domain].combo,
}));
export const POWER_CATALOG = BRANCHES.flatMap((branch, branchIndex) =>
  branch.powers.map((p) => {
    const d = DOMAIN[branch.domain],
      ultimate = p.level >= 8;
    const style = ultimate
      ? ["nova", "summon", "beam"][(p.level - 8 + branchIndex) % 3]
      : d.styles[(p.level - 1) % d.styles.length];
    const cost = ultimate ? 0 : 3 + Math.ceil(p.level * 1.15);
    const cooldown = ultimate
      ? 6 + (p.level - 8)
      : p.level === 1
        ? style === "beam"
          ? 0.7
          : 0.38
        : +Math.min(4, 0.65 + p.level * 0.32).toFixed(2);
    const actionDescription = `${STYLE_TEXT[style]}. ${d.verb} creatures${ultimate ? " across a huge area" : " and combine with another affinity"}.`;
    return {
      ...p,
      manualKind: p.kind,
      manualDescription: p.description,
      manualCastTime: p.castTime,
      manualEssenceCost: p.essenceCost,
      branchIndex,
      branchName: branch.name,
      domain: branch.domain,
      affinity: branch.domain,
      element: branch.domain.toLowerCase(),
      aspect: branch.aspect,
      color: branch.color,
      icon: branch.icon,
      kind: "action",
      style,
      archetype: style,
      arc: style,
      status: d.status,
      ultimate,
      cost,
      essenceCost: cost,
      castTime: 0,
      castSpeed: 0,
      cooldown,
      damage: ultimate ? 100 + (p.level - 8) * 28 : 24 + (p.level - 1) * 8,
      range: ultimate ? 950 : 650 + p.level * 24,
      radius: ultimate
        ? 230 + (p.level - 8) * 35
        : style === "nova"
          ? 85 + p.level * 12
          : 38 + p.level * 5,
      speed: 780 + p.level * 18,
      duration: style === "summon" ? 12 : style === "orbit" ? 5 : 2.5,
      targetCap: ultimate ? 24 : 4 + p.level,
      unlockCost: p.level === 1 ? 0 : Math.ceil(p.level / 2),
      description: actionDescription,
      actionDescription,
      comboHint: d.combo,
    };
  }),
);
export const POWER_BY_ID = Object.fromEntries(
  POWER_CATALOG.map((p) => [p.id, p]),
);
export const REGION_CATALOG = ZONES;
export const CREATURE_CATALOG = CREATURES;
export function starterLoadout(
  starterBranch = "fire-create",
  lineage = "angel",
) {
  if (starterBranch === "angel" || starterBranch === "demon") {
    lineage = starterBranch;
    starterBranch = lineage === "demon" ? "fire-destroy" : "fire-create";
  }
  const candidate = [
    `${starterBranch}-1`,
    "fire-create-1",
    "water-grow-1",
    "air-move-1",
    "dark-heal-1",
    "light-harm-1",
    "earth-give-1",
    "love-laugh-1",
  ];
  return [...new Set(candidate)]
    .filter((id) => POWER_BY_ID[id])
    .slice(0, 5)
    .concat(
      `${POWER_BY_ID[`${starterBranch}-8`] ? starterBranch : "fire-create"}-8`,
    );
}
export function starterUnlocked(starterBranch = "fire-create") {
  return [
    ...POWER_CATALOG.filter((p) => p.level === 1).map((p) => p.id),
    `${POWER_BY_ID[`${starterBranch}-8`] ? starterBranch : "fire-create"}-8`,
  ];
}
export const getPower = (id) => POWER_BY_ID[id] || null;
