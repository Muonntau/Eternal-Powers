/** Faction stories and reactive Nanogram sites. All advancement is physical and receipt-backed. */
import { ZONES } from "../data/manual.js";
const copy = (v) => structuredClone(v),
  dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y),
  native = (g) => (g.player.lineage === "demon" ? "bad" : "good");
const zoneName = (id) => ZONES.find((z) => z.id === id)?.name || id;
const own = (g, id) => (g.player.id ? `${id}:owner:${g.player.id}` : id);
const key = (g, type) => `${g.zone.id}:${type}`;
const fresh = () => ({
  version: 1,
  revision: 0,
  lineage: null,
  mission: 0,
  stage: 0,
  count: 0,
  ready: false,
  completed: [],
  choices: {},
  receipts: [],
  proof: {},
  activities: {},
  surveys: {},
  ending: null,
});
const task = (type, prompt, extra = {}) => ({ type, prompt, ...extra });
const TALK = (prompt, choices) => task("talk", prompt, { choices });
const ACT = (activity, prompt) => task("activity", prompt, { activity });
const TRAVEL = (zoneId, prompt) => task("travel", prompt, { zoneId });
const CHOICES = {
  angel: [
    { id: "listen", label: "Listen first. We rebuild together." },
    { id: "promise", label: "I will protect the path for everyone." },
  ],
  demon: [
    { id: "defy", label: "No throne will decide my purpose." },
    { id: "bargain", label: "Power should be earned through a pact." },
  ],
};
const specs = {
  angel: [
    [
      "The First Accord",
      "sacred-groves",
      "Meet Seraphine and decide what your new power will protect.",
      [TALK("Speak with Seraphine, the Concord envoy.", CHOICES.angel)],
    ],
    [
      "A Power with Purpose",
      "sacred-groves",
      "Learn how your first affinity changes the world.",
      [
        task(
          "practice",
          "Select the Training Effigy and resolve your starting power.",
          { required: 1 },
        ),
      ],
    ],
    [
      "The Sleeping Conduit",
      "sacred-groves",
      "A damaged conduit can translate any native affinity into light.",
      [ACT("resonator", "Cast twice on the Lattice Resonator.")],
    ],
    [
      "A Stranger at the Crossing",
      "sacred-groves",
      "A courier fears both sides. Give them a reason to trust yours.",
      [
        TALK("Meet the stranded courier and choose a promise.", [
          {
            id: "shelter",
            label: "Offer sanctuary without demanding allegiance.",
          },
          { id: "escort", label: "Promise a protected route to the crossing." },
        ]),
      ],
    ],
    [
      "Three Notes of Dawn",
      "sacred-groves",
      "Repair the old gate by following its visible harmonic sequence.",
      [
        ACT(
          "runegate",
          "Align and cast the three posted rune notes, then collect the result.",
        ),
      ],
    ],
    [
      "Where the River Remembers",
      "prismatic-waterfalls",
      "The falls carry fractured echoes. Restore a steady rhythm.",
      [
        TRAVEL("prismatic-waterfalls", "Travel to Prismatic Waterfalls."),
        ACT("pulsewell", "Cast two measured pulses into the Echo Well."),
      ],
    ],
    [
      "The Garden of Second Chances",
      "ethereal-gardens",
      "Recovery is a craft, not a gift that appears from nowhere.",
      [
        TRAVEL("ethereal-gardens", "Reach the Ethereal Gardens."),
        ACT(
          "bloom",
          "Awaken an Echo Bloom with your power, then harvest its seed.",
        ),
      ],
    ],
    [
      "A Bridge Made of Will",
      "celestial-observatories",
      "Carry a living spark between the observatory platforms.",
      [
        TRAVEL("celestial-observatories", "Reach the Celestial Observatories."),
        ACT(
          "skybridge",
          "Charge the relay and reach its marked destination before the spark fades.",
        ),
      ],
    ],
    [
      "Mercy Beyond the Gate",
      "infernal-gates",
      "The people beyond Heaven need an open recovery route too.",
      [
        TRAVEL("infernal-gates", "Travel to the Infernal Gates."),
        ACT("ward", "Stabilize all three facets of the Shelter Prism."),
      ],
    ],
    [
      "The Labyrinth Gives an Answer",
      "suffering-labyrinths",
      "Read the labyrinth as a system that can be changed.",
      [
        TRAVEL("suffering-labyrinths", "Enter the Suffering Labyrinths."),
        ACT("runegate", "Resolve the labyrinth Rune Gate in the posted order."),
      ],
    ],
    [
      "A Constellation for Everyone",
      "city-of-stars",
      "Reconnect the final star-lattice without claiming it as a weapon.",
      [
        TRAVEL("city-of-stars", "Reach the City of Stars."),
        ACT("resonator", "Restore the city’s Lattice Resonator."),
        ACT("ward", "Complete the Shelter Prism before the final accord."),
      ],
    ],
    [
      "The Living Concord",
      "city-of-stars",
      "Choose how the new accord will outlive its founders.",
      [
        TALK("Return to Seraphine and ratify your ending.", [
          {
            id: "open",
            label: "Open the sanctuaries to every willing traveler.",
          },
          {
            id: "steward",
            label: "Entrust the lattice to independent local stewards.",
          },
        ]),
      ],
    ],
  ],
  demon: [
    [
      "The Unwritten Pact",
      "sacred-groves",
      "Meet Vael and choose what freedom means to your new form.",
      [TALK("Speak with Vael, the Ashbound envoy.", CHOICES.demon)],
    ],
    [
      "An Ember of Your Own",
      "sacred-groves",
      "Master your first affinity before accepting anyone’s orders.",
      [
        task(
          "practice",
          "Select the Training Effigy and resolve your starting power.",
          { required: 1 },
        ),
      ],
    ],
    [
      "Power from the Ruins",
      "sacred-groves",
      "Take a dormant conduit out of the old hierarchy’s hands.",
      [
        ACT(
          "resonator",
          "Cast twice on the Lattice Resonator to claim its dormant current.",
        ),
      ],
    ],
    [
      "No One Is Collateral",
      "sacred-groves",
      "A courier is bound by an impossible debt. Decide how to release them.",
      [
        TALK("Find the stranded courier and choose their release.", [
          {
            id: "break",
            label: "Break the debt seal. Their future is their own.",
          },
          {
            id: "rewrite",
            label: "Rewrite it as a voluntary pact with an exit.",
          },
        ]),
      ],
    ],
    [
      "The Lock That Learned Fear",
      "sacred-groves",
      "A visible three-note lock guards the road east. Make it answer.",
      [
        ACT(
          "runegate",
          "Align and cast the posted rune sequence to unbind the gate.",
        ),
      ],
    ],
    [
      "A Current Without a Master",
      "prismatic-waterfalls",
      "Harness the waterfall echoes without returning them to their keepers.",
      [
        TRAVEL("prismatic-waterfalls", "Travel to Prismatic Waterfalls."),
        ACT("pulsewell", "Bind two measured pulses at the Echo Well."),
      ],
    ],
    [
      "Life from the Ashes",
      "ethereal-gardens",
      "Even Heaven’s cultivation can be freed from its old rules.",
      [
        TRAVEL("ethereal-gardens", "Reach the Ethereal Gardens."),
        ACT(
          "bloom",
          "Charge an Echo Bloom and harvest a self-sustaining seed.",
        ),
      ],
    ],
    [
      "Steal the Horizon",
      "celestial-observatories",
      "Carry a spark beyond the reach of a watchful observatory.",
      [
        TRAVEL("celestial-observatories", "Reach the Celestial Observatories."),
        ACT(
          "skybridge",
          "Charge the relay and cross to the marked destination in time.",
        ),
      ],
    ],
    [
      "The Gates Belong to No Throne",
      "infernal-gates",
      "Build a protected route that cannot become another prison.",
      [
        TRAVEL("infernal-gates", "Return to the Infernal Gates."),
        ACT("ward", "Stabilize three facets of the Shelter Prism."),
      ],
    ],
    [
      "Unmake the Labyrinth",
      "suffering-labyrinths",
      "Break the authority of the maze by understanding its controls.",
      [
        TRAVEL("suffering-labyrinths", "Enter the Suffering Labyrinths."),
        ACT(
          "runegate",
          "Resolve the posted Rune Gate sequence and release the route.",
        ),
      ],
    ],
    [
      "The Crown Is a Circuit",
      "city-of-stars",
      "Seize the star-lattice, then make your own decision about power.",
      [
        TRAVEL("city-of-stars", "Reach the City of Stars."),
        ACT("resonator", "Claim the city’s Lattice Resonator."),
        ACT(
          "ward",
          "Stabilize the Shelter Prism so the new order can survive.",
        ),
      ],
    ],
    [
      "The Sovereign Pact",
      "city-of-stars",
      "Freedom needs an answer beyond victory. Choose your ending.",
      [
        TALK("Return to Vael and settle the final pact.", [
          {
            id: "shatter",
            label: "Shatter the crown. No one inherits its command.",
          },
          {
            id: "covenant",
            label: "Bind its power to a covenant that anyone may leave.",
          },
        ]),
      ],
    ],
  ],
};
export const FACTION_CAMPAIGNS = Object.fromEntries(
  Object.entries(specs).map(([lineage, missions]) => [
    lineage,
    {
      id: lineage === "angel" ? "living-concord" : "unbound-pact",
      lineage,
      name: lineage === "angel" ? "The Living Concord" : "The Unbound Pact",
      faction: lineage === "angel" ? "Concord of Dawn" : "Ashbound Covenant",
      mentor:
        lineage === "angel"
          ? "Seraphine, Concord Envoy"
          : "Vael, Ashbound Envoy",
      color: lineage === "angel" ? "#82eee0" : "#c0a2ff",
      missions: missions.map(([title, zoneId, description, stages], i) => ({
        id: `${lineage}:story:${i + 1}`,
        index: i,
        act: Math.floor(i / 4) + 1,
        title,
        zoneId,
        description,
        stages,
        reward: 50 + i * 15,
      })),
    },
  ]),
);
export const ACTIVITY_TYPES = [
  {
    id: "resonator",
    name: "Lattice Resonator",
    verb: "Attune",
    description:
      "A crystalline conductor translates every affinity. Resolve two real casts to rebuild its current.",
    need: 2,
    reward: { crystal: 2 },
    position: { x: 1190, y: 1050 },
  },
  {
    id: "runegate",
    name: "Harmonic Rune Gate",
    verb: "Align",
    description:
      "Choose the next visible note, then seal it with a power. A wrong note slips one step; no reward is lost.",
    need: 3,
    reward: { stone: 2, crystal: 1 },
    position: { x: 1110, y: 620 },
  },
  {
    id: "pulsewell",
    name: "Echo Well",
    verb: "Synchronize",
    description:
      "Cast once, then answer its pulse after at least one second. The response window adapts to your selected power’s cooldown.",
    need: 2,
    reward: { residue: 2 },
    position: { x: 650, y: 1080 },
  },
  {
    id: "skybridge",
    name: "Aether Relay",
    verb: "Carry",
    description:
      "Charge the relay with any power, then carry the visible spark to its destination within thirty seconds.",
    need: 1,
    reward: { wood: 3 },
    position: { x: 1740, y: 940 },
  },
  {
    id: "ward",
    name: "Shelter Prism",
    verb: "Stabilize",
    description:
      "Select each cracked facet and resolve a power through it. All three facets must be stabilized.",
    need: 3,
    reward: { stone: 3 },
    position: { x: 650, y: 1370 },
  },
  {
    id: "bloom",
    name: "Echo Bloom",
    verb: "Cultivate",
    description:
      "The seed responds differently to every affinity. Resolve one power, then collect its finite crop before it rests.",
    need: 1,
    reward: { herb: 3 },
    position: { x: 1900, y: 1240 },
  },
];
const affinityFlavor = {
  Love: "A living bond steadies the lattice.",
  Light: "A precise beam reveals its hidden pattern.",
  Water: "A new current settles into its channels.",
  Air: "The currents align around your form.",
  Hate: "The old contamination breaks away.",
  Dark: "The damaged conductor remembers its shape.",
  Fire: "The old casing dissolves into a new circuit.",
  Earth: "Its mineral structure locks into place.",
};
const log = (g, text, type = "info") => g.event?.(type, text);
const changed = (g) => {
  g.adventure.revision++;
  g._adventureSignature = null;
};
const persist = (g) => {
  g.save?.(false);
  g.publish?.();
};
function state(g) {
  return g.adventure || initAdventure(g);
}
export function initAdventure(g, saved) {
  g.adventure = { ...fresh(), ...copy(saved || g.adventure || {}) };
  g.adventure.activities ||= {};
  g.adventure.proof ||= {};
  g.adventure.receipts ||= [];
  g.adventure.choices ||= {};
  g.adventure.surveys ||= {};
  g.adventure.lineage ||= g.player.lineage;
  g._adventureSignature = null;
  return g.adventure;
}
export const serializeAdventure = (g) => copy(state(g));
const campaign = (g) =>
  FACTION_CAMPAIGNS[g.player.lineage] || FACTION_CAMPAIGNS.angel;
const mission = (g) => campaign(g).missions[state(g).mission] || null;
const current = (g) => mission(g)?.stages[state(g).stage] || null;
const actorId = (g, role) => own(g, `adventure:${g.zone.id}:${role}`);
function point(g, desired) {
  if (!g.isPositionBlocked?.(desired.x, desired.y, { radius: 18 }))
    return desired;
  for (let radius = 30; radius <= 180; radius += 30)
    for (let i = 0; i < 16; i++) {
      const p = {
        x: desired.x + Math.cos((i * Math.PI) / 8) * radius,
        y: desired.y + Math.sin((i * Math.PI) / 8) * radius,
      };
      if (!g.isPositionBlocked(p.x, p.y, { radius: 18 })) return p;
    }
  return { x: g.world.spawn.x + 65, y: g.world.spawn.y + 45 };
}
function activityRecord(g, id) {
  return (state(g).activities[key(g, id)] ||= {
    step: 0,
    phase: null,
    lastCastAt: null,
    window: 9,
    ready: false,
    claimedAt: null,
    cycle: 0,
    facets: [],
  });
}
function resetActivity(r) {
  Object.assign(r, {
    step: 0,
    phase: null,
    lastCastAt: null,
    ready: false,
    facets: [],
    challenge: null,
  });
}
function activityEntity(g, type) {
  const p = point(g, type.position),
    r = activityRecord(g, type.id);
  return {
    id: actorId(g, type.id),
    baseEntityId: `adventure:${g.zone.id}:${type.id}`,
    name: type.name,
    kind: "world-activity",
    role: "world-activity",
    adventureActor: true,
    activityType: type.id,
    activityStep: r.step,
    activityNeed: type.need,
    activityReady: r.ready,
    activityPhase: r.phase,
    activityFacets: r.facets,
    ownerId: g.player.id || null,
    ownerName: g.player.name,
    zoneId: g.zone.id,
    ...p,
    health: 100,
    maxHealth: 100,
    protected: true,
    description: type.description,
    markerState: r.ready
      ? "reward"
      : current(g)?.activity === type.id && mission(g)?.zoneId === g.zone.id
        ? "objective"
        : "activity",
  };
}
function advance(g) {
  const a = state(g);
  a.stage++;
  a.count = 0;
  a.ready = a.stage >= mission(g).stages.length;
  changed(g);
  log(
    g,
    a.ready
      ? "Mission complete. Return to your envoy to settle the reward."
      : current(g).prompt,
    "quest",
  );
}
export function updateAdventure(g, dt = 0) {
  const a = state(g);
  if (!g.player.characterCreated) return;
  if (a.lineage !== g.player.lineage && a.completed.length === 0) {
    a.lineage = g.player.lineage;
    a.mission = 0;
    a.stage = 0;
    a.count = 0;
    a.ready = false;
    changed(g);
  }
  let stage = current(g);
  if (!a.ready && stage) {
    if (stage.type === "travel" && g.zone.id === stage.zoneId) advance(g);
    else if (
      stage.type === "activity" &&
      a.proof[`${mission(g).zoneId}:${stage.activity}`]
    )
      advance(g);
  }
  for (const [id, r] of Object.entries(a.activities)) {
    if (!id.startsWith(g.zone.id + ":")) continue;
    const type = ACTIVITY_TYPES.find((t) => t.id === id.split(":").at(-1));
    if (!type) continue;
    if (r.claimedAt != null && g.time - r.claimedAt >= 75) {
      r.claimedAt = null;
      resetActivity(r);
      changed(g);
    }
    if (r.challenge) {
      if (g.time > r.challenge.expiresAt) {
        resetActivity(r);
        changed(g);
        log(
          g,
          "The carried spark faded. Recharge the relay and try another route.",
        );
      } else if (dist(g.player, r.challenge.finish) < 65) {
        r.ready = true;
        r.step = type.need;
        r.challenge = null;
        changed(g);
        log(
          g,
          "Spark delivered. Return to the relay to collect your materials.",
          "success",
        );
      }
    }
  }
  syncAdventureEntities(g);
}
export function syncAdventureEntities(g) {
  if (!g.entities || !g.world) return;
  const a = state(g),
    signature = `${g.zone.id}:${g.player.id || "solo"}:${g.player.lineage}:${a.revision}:${g.player.characterCreated}`;
  if (
    g._adventureSignature === signature &&
    g.entities.some(
      (n) => n.adventureActor && (!n.ownerId || n.ownerId === g.player.id),
    )
  )
    return;
  for (let i = g.entities.length - 1; i >= 0; i--)
    if (
      g.entities[i].adventureActor &&
      (!g.entities[i].ownerId || g.entities[i].ownerId === g.player.id)
    )
      g.entities.splice(i, 1);
  if (!g.player.characterCreated) return;
  const m = mission(g),
    s = current(g),
    guide = {
      id: actorId(g, "mentor"),
      name: campaign(g).mentor,
      kind: "npc",
      role: "campaign-mentor",
      adventureActor: true,
      ownerId: g.player.id || null,
      ownerName: g.player.name,
      ...point(g, { x: 865, y: 975 }),
      description: `${campaign(g).faction} · campaign guidance and mission rewards`,
      protected: true,
      canWitness: false,
      markerState: m
        ? a.ready && m.zoneId === g.zone.id
          ? "turnin"
          : s?.type === "talk" && m.zoneId === g.zone.id
            ? "available"
            : "service"
        : "service",
    };
  g.entities.push(
    guide,
    ...ACTIVITY_TYPES.map((type) => activityEntity(g, type)),
  );
  if (s?.type === "talk" && a.mission === 3 && m.zoneId === g.zone.id) {
    const p = point(g, { x: 1230, y: 1120 });
    g.entities.push({
      ...guide,
      ...p,
      id: actorId(g, "courier"),
      role: "campaign-courier",
      name: "Iris, Stranded Courier",
      description:
        "A traveler caught between the factions. Your choice settles their future.",
      markerState: "objective",
    });
    guide.markerState = "service";
  }
  for (const type of ACTIVITY_TYPES) {
    const r = activityRecord(g, type.id);
    if (r.challenge)
      g.entities.push({
        id: actorId(g, `${type.id}-finish`),
        name: "Spark destination",
        kind: "world-activity",
        role: "relay-finish",
        adventureActor: true,
        activityType: type.id,
        ownerId: g.player.id || null,
        ...r.challenge.finish,
        protected: true,
        description: "Carry the charged spark inside this ring.",
        markerState: "objective",
        expiresAt: r.challenge.expiresAt,
      });
  }
  g._adventureSignature = signature;
}
function objective(g) {
  const a = state(g),
    m = mission(g),
    s = current(g);
  if (!m)
    return {
      id: "complete",
      title: a.ending?.title || "Campaign complete",
      text: "Your faction’s story is settled. Explore contracts, deepen your powers, or help other travelers.",
      complete: true,
      zoneId: g.zone.id,
    };
  let targetRole = a.ready
    ? "mentor"
    : s.type === "talk"
      ? a.mission === 3
        ? "courier"
        : "mentor"
      : s.type === "practice"
        ? "training"
        : s.activity;
  const zoneId = a.ready ? m.zoneId : s.zoneId || m.zoneId;
  const relay =
    targetRole === "skybridge" && zoneId === g.zone.id
      ? activityRecord(g, "skybridge").challenge
      : null;
  if (relay) targetRole = "skybridge-finish";
  let p =
    targetRole === "training"
      ? { x: 1030, y: 1005 }
      : targetRole === "mentor"
        ? { x: 865, y: 975 }
        : targetRole === "courier"
          ? { x: 1230, y: 1120 }
          : ACTIVITY_TYPES.find((t) => t.id === targetRole)?.position || {
              x: 920,
              y: 900,
            };
  if (zoneId === g.zone.id) {
    const entity = g.entities.find(
      (n) =>
        n.id === actorId(g, targetRole) ||
        (targetRole === "training" && n.id === "training"),
    );
    if (entity) p = { x: entity.x, y: entity.y };
  }
  return {
    id: `${m.id}:${a.stage}`,
    missionId: m.id,
    title: m.title,
    text: a.ready
      ? "Return to your envoy and claim the mission reward."
      : relay
        ? "Carry the charged spark into the marked destination ring before it fades."
        : s.prompt,
    ready: a.ready,
    zoneId,
    zoneName: zoneName(zoneId),
    targetId:
      zoneId === g.zone.id
        ? targetRole === "training"
          ? "training"
          : actorId(g, targetRole)
        : null,
    ...p,
    progress: a.count,
    total: s?.required || 1,
    stage: a.stage,
    stages: m.stages.length,
    act: m.act,
    reward: m.reward,
    currency: native(g),
    type: a.ready ? "turnin" : s?.type,
  };
}
function inspectActivity(g, n) {
  const type = ACTIVITY_TYPES.find((t) => t.id === n.activityType),
    r = activityRecord(g, type.id),
    cooldown =
      r.claimedAt == null ? 0 : Math.max(0, 75 - (g.time - r.claimedAt)),
    sequence = [1, 3, 2];
  return {
    type: type.id,
    name: type.name,
    description: type.description,
    step: r.step,
    total: type.need,
    phase: r.phase,
    ready: r.ready,
    facets: r.facets,
    cooldown,
    sequence,
    reward: type.reward,
    challenge: r.challenge
      ? {
          ...r.challenge,
          remaining: Math.max(0, r.challenge.expiresAt - g.time),
        }
      : null,
    window: r.window,
    remaining:
      r.lastCastAt == null
        ? 0
        : Math.max(0, r.window - (g.time - r.lastCastAt)),
    hint:
      type.id === "runegate"
        ? `Posted notes: ${sequence.join(" → ")}. Select note ${sequence[r.step] || "complete"}, then cast.`
        : type.id === "ward"
          ? "Select each of the three facets, then cast once through it."
          : type.description,
  };
}
export function inspectInteraction(g, id = g.targetId) {
  const n = g.entities?.find((n) => n.id === id && !n.dead && !n.collected);
  if (!n) return null;
  const foreign =
    (n.adventureActor || n.contractSimulation) &&
    n.ownerId &&
    n.ownerId !== g.player.id;
  if (foreign) return null;
  const range = 135,
    inRange = dist(g.player, n) <= range,
    blocked = g.downed
      ? "Recover before interacting."
      : g.inCombat?.() && n.kind !== "enemy"
        ? "Leave conflict before using this service."
        : !inRange
          ? "Move closer to this target."
          : null;
  let purpose = "Local guidance and regional discoveries",
    actions = [],
    type = "npc";
  if (n.kind === "world-activity") {
    purpose = "Reactive power challenge";
    type = "activity";
    const a = inspectActivity(g, n);
    if (n.role === "relay-finish")
      actions = [
        { id: "finish", label: "Carry the charged spark here", disabled: true },
      ];
    else if (a.cooldown > 0)
      actions = [
        {
          id: "wait",
          label: `Recharging · ${Math.ceil(a.cooldown)}s`,
          disabled: true,
        },
      ];
    else if (a.challenge)
      actions = [
        {
          id: "relay-route",
          label: "Follow the spark destination",
          primary: true,
        },
      ];
    else if (a.ready)
      actions = [{ id: "collect", label: "Collect materials", primary: true }];
    else {
      if (a.type === "runegate")
        actions.push(
          ...[1, 2, 3].map((i) => ({
            id: `phase:${i}`,
            label: `Align note ${i}`,
            selected: a.phase === i,
          })),
        );
      if (a.type === "ward")
        actions.push(
          ...[1, 2, 3].map((i) => ({
            id: `phase:${i}`,
            label: `Facet ${i}${a.facets.includes(i) ? " · stable" : ""}`,
            selected: a.phase === i,
            disabled: a.facets.includes(i),
          })),
        );
      actions.push({
        id: "cast",
        label: "Cast selected power",
        primary: true,
        disabled: !!g.castState,
      });
    }
    return {
      targetId: n.id,
      name: n.name,
      purpose,
      type,
      description: n.description,
      range,
      inRange,
      distance: dist(g.player, n),
      reason: blocked,
      actions,
      activity: a,
      point: { x: n.x, y: n.y },
      marker: n.markerState,
    };
  }
  if (n.creatureId && g.inspectCreature) {
    return {
      targetId: n.id,
      name: n.name,
      type: "creature",
      purpose:
        n.role === "companion"
          ? "Bonded familiar support"
          : n.offer
            ? "A creature with a posted material need"
            : "Creature encounter and counterplay",
      description: n.description,
      inRange,
      range,
      reason: blocked,
      point: { x: n.x, y: n.y },
      creature: g.inspectCreature(n.id),
      actions: [],
    };
  }
  if (n.role === "campaign-mentor" || n.role === "campaign-courier") {
    const a = state(g),
      m = mission(g),
      s = current(g),
      correct = m?.zoneId === g.zone.id;
    purpose =
      n.role === "campaign-courier"
        ? "Faction story · a choice with a lasting outcome"
        : `${campaign(g).faction} envoy · story, guidance and rewards`;
    if (m && correct && a.ready && n.role === "campaign-mentor")
      actions = [
        {
          id: "claim",
          label: `Claim ${m.reward} ${native(g)} Karma`,
          primary: true,
        },
      ];
    else if (
      m &&
      correct &&
      s?.type === "talk" &&
      (a.mission === 3
        ? n.role === "campaign-courier"
        : n.role === "campaign-mentor")
    )
      actions = s.choices.map((c) => ({
        id: `choice:${c.id}`,
        label: c.label,
        primary: true,
      }));
    else
      actions = [
        { id: "campaign", label: "Review the faction campaign", primary: true },
        { id: "route", label: "Guide me to the current objective" },
      ];
    return {
      targetId: n.id,
      name: n.name,
      type: "story",
      purpose,
      description:
        m?.description ||
        "Your decisions now belong to the history of this world.",
      dialogue: a.ready
        ? "You have done the work. Let us settle what comes next."
        : s?.prompt || a.ending?.text,
      range,
      inRange,
      reason: blocked,
      actions,
      point: { x: n.x, y: n.y },
    };
  }
  if (n.contractSimulation) {
    purpose =
      n.role === "contract-trader"
        ? "Quartermaster · finite barter, commissions and party support"
        : "Contract site · physical evidence and authored objectives";
    actions = [
      {
        id: "contract",
        label:
          n.role === "contract-trader"
            ? "Trade, commissions & hire allies"
            : "Continue this contract",
        primary: true,
      },
    ];
  } else if (n.role === "keeper") {
    purpose = "Sanctuary keeper · celestial trials, standing and recovery";
    actions = [
      { id: "standing", label: "Review standing & rank trials", primary: true },
      { id: "campaign", label: "Ask about my faction’s story" },
      { id: "sanctuary", label: "Visit my sanctuary" },
    ];
  } else if (n.role === "merchant" || /artisan|smith|merchant/i.test(n.name)) {
    purpose = "Artisan · supplies, equipment, plans and crafting";
    actions = [
      { id: "shop", label: "Browse supplies & equipment", primary: true },
      { id: "craft", label: "Open the crafting workshop" },
      { id: "sanctuary", label: "Equipment, storage & repairs" },
    ];
  } else if (n.kind === "dummy") {
    type = "training";
    purpose = "Training target · practice powers without harming anyone";
    actions = [
      { id: "cast", label: "Practice selected power", primary: true },
      { id: "powers", label: "Review learned powers" },
    ];
  } else if (n.kind === "resource") {
    type = "resource";
    purpose = n.renewable
      ? "Renewable wilderness material"
      : "Finite sanctuary supply";
    actions = [{ id: "gather", label: `Gather ${n.name}`, primary: true }];
  } else if (n.kind === "chest") {
    type = "cache";
    purpose = "One-time exploration cache";
    actions = [{ id: "gather", label: "Open the cache", primary: true }];
  } else if (n.kind === "patch") {
    type = "patch";
    purpose = n.restored
      ? "Restored habitat · your work is remembered"
      : "Damaged habitat · use a restorative or cleansing power";
    actions = [
      { id: "cast", label: "Use selected power", primary: true },
      { id: "powers", label: "Choose a different power" },
    ];
  } else if (n.kind === "portal") {
    type = "portal";
    purpose = "Travel anchor · safe passage between regions";
    actions = [
      {
        id: "travel",
        label: n.destination
          ? `Travel to ${zoneName(n.destination)}`
          : "Open realm travel",
        primary: true,
      },
    ];
  } else if (n.kind === "build") {
    type = "repair";
    purpose = "Public crossing · repair with posted materials";
    actions = [{ id: "gather", label: "Repair this crossing", primary: true }];
  } else if (n.kind === "world-landmark") {
    type = "landmark";
    purpose = "Discovery site · regional context and navigation";
    actions = [
      {
        id: "survey",
        label: state(g).surveys[n.id]
          ? "Site recorded"
          : "Survey this landmark",
        primary: true,
        disabled: !!state(g).surveys[n.id],
      },
      { id: "activities", label: "Find nearby power challenges" },
    ];
  } else if (n.kind === "enemy") {
    type = "enemy";
    purpose = "Hostile encounter · ordinary combat or its peaceful route";
    actions = [
      { id: "cast", label: "Cast selected power", primary: true },
      { id: "strike", label: "Ordinary strike" },
      { id: "powers", label: "Review counterplay & abilities" },
    ];
  } else if (n.kind === "ally" || n.role === "contract-escort") {
    purpose = "Companion · commands, support and cooperation";
    actions = [
      { id: "contract", label: "Manage party & orders", primary: true },
    ];
  } else
    actions = [
      { id: "activities", label: "Show local power challenges", primary: true },
      { id: "campaign", label: "Ask about my current objective" },
    ];
  return {
    targetId: n.id,
    name: n.name,
    purpose,
    type,
    description:
      n.description ||
      `${zoneName(g.zone.id)} holds new work for every affinity.`,
    range,
    inRange,
    distance: dist(g.player, n),
    reason: blocked,
    actions,
    point: { x: n.x, y: n.y },
    renewable: !!n.renewable,
  };
}
export function snapshotAdventure(g) {
  const a = state(g),
    c = campaign(g);
  return {
    adventure: {
      faction: c.faction,
      name: c.name,
      color: c.color,
      mentor: c.mentor,
      objective: objective(g),
      missionIndex: a.mission,
      stageIndex: a.stage,
      completed: [...a.completed],
      ending: a.ending,
      receipts: a.receipts.slice(0, 20),
      missions: c.missions.map((m) => ({
        ...m,
        status: a.completed.includes(m.id)
          ? "complete"
          : a.mission === m.index
            ? "active"
            : "locked",
      })),
      activities: ACTIVITY_TYPES.map((type) => ({
        id: actorId(g, type.id),
        ...type,
        ...inspectActivity(g, { activityType: type.id }),
      })),
    },
    interaction: inspectInteraction(g),
  };
}
export function installAdventure(GameEngine) {
  Object.assign(GameEngine.prototype, {
    syncAdventureEntities() {
      syncAdventureEntities(this);
    },
    inspectInteraction(id) {
      return inspectInteraction(this, id);
    },
    openInteraction(id = this.targetId) {
      const profile = inspectInteraction(this, id);
      if (!profile) return false;
      this.targetId = id;
      this.destination = null;
      this.travelWaypoints = [];
      this.keys.clear();
      this.event("open-interaction", profile.name, { targetId: id });
      this.publish();
      return true;
    },
    navigateAdventureObjective() {
      if (
        this.downed ||
        this.inCombat?.() ||
        this.castState ||
        this.techniqueState
      ) {
        log(
          this,
          "Leave conflict and finish preparing before following this route.",
        );
        return false;
      }
      const o = objective(this);
      if (o.complete) return false;
      if (this.zone.id !== o.zoneId) {
        if (!this.setZone(o.zoneId)) return false;
        updateAdventure(this, 0);
      }
      const next = objective(this);
      const result = this.navigateTo(next.x, next.y);
      if (result)
        this.event("close-interaction", "Following the current objective.");
      return result;
    },
    previewAdventurePower(b, p, n) {
      if (!n?.adventureActor || n.kind !== "world-activity")
        return { valid: false, reason: "Choose a reactive site." };
      if (n.ownerId && n.ownerId !== this.player.id)
        return {
          valid: false,
          reason: "This challenge belongs to another traveler.",
        };
      const r = activityRecord(this, n.activityType);
      if (n.role === "relay-finish")
        return {
          valid: false,
          reason: "Carry the charged spark into this destination ring.",
        };
      if (r.claimedAt != null)
        return {
          valid: false,
          reason: "This site is replenishing its materials.",
        };
      if (r.challenge)
        return {
          valid: false,
          reason: "Carry the charged spark to its ring before charging again.",
        };
      if (r.ready)
        return {
          valid: false,
          reason: "Collect the completed materials before casting again.",
        };
      if (["runegate", "ward"].includes(n.activityType) && !r.phase)
        return {
          valid: false,
          reason: "Interact and align a note or facet first.",
        };
      return { valid: true, adventure: true };
    },
    resolveAdventurePower(b, p, n) {
      const check = this.previewAdventurePower(b, p, n);
      if (!check.valid) return false;
      const r = activityRecord(this, n.activityType),
        type = ACTIVITY_TYPES.find((t) => t.id === n.activityType);
      if (type.id === "runegate") {
        const expected = [1, 3, 2][r.step];
        if (r.phase !== expected) {
          r.step = Math.max(0, r.step - 1);
          r.phase = null;
          changed(this);
          log(
            this,
            `That note slipped. The next posted note is ${[1, 3, 2][r.step]}.`,
          );
          return { adventure: true, correct: false };
        }
        r.step++;
        r.phase = null;
      } else if (type.id === "ward") {
        if (!r.facets.includes(r.phase)) r.facets.push(r.phase);
        r.step = r.facets.length;
        r.phase = null;
      } else if (type.id === "pulsewell") {
        const elapsed =
          r.lastCastAt == null ? Infinity : this.time - r.lastCastAt;
        r.window = Math.max(9, (p.cooldown || 5) + (p.castTime || 0) + 3);
        r.step = r.step && elapsed >= 1 && elapsed <= r.window ? 2 : 1;
        r.lastCastAt = this.time;
      } else if (type.id === "skybridge") {
        const start = { x: n.x, y: n.y };
        let finish = point(this, { x: n.x + 190, y: n.y + 80 });
        for (const offset of [
          { x: 190, y: 0 },
          { x: 0, y: 190 },
          { x: -190, y: 0 },
          { x: 0, y: -190 },
        ]) {
          const candidate = point(this, {
            x: n.x + offset.x,
            y: n.y + offset.y,
          });
          if (this.hasLineOfEffect(start, candidate)) {
            finish = candidate;
            break;
          }
        }
        r.challenge = { finish, expiresAt: this.time + 30 };
        r.step = 0;
        log(
          this,
          "Spark charged. Reach its new marked ring within thirty seconds.",
          "quest",
        );
      } else r.step++;
      if (type.id !== "skybridge" && r.step >= type.need) r.ready = true;
      changed(this);
      this.effect(n, "quest", b.color, 60, 1.2, {
        branchId: b.id,
        powerId: p.id,
        family: b.domain.toLowerCase(),
      });
      log(
        this,
        `${affinityFlavor[b.domain] || "The site answers your power."} ${r.ready ? "Challenge complete — collect your materials." : `${r.step}/${type.need}`}`,
        "success",
      );
      syncAdventureEntities(this);
      return {
        adventure: true,
        activity: type.id,
        progress: r.step,
        complete: r.ready,
      };
    },
    recordAdventureAction(type, amount = 1) {
      const s = current(this),
        a = state(this);
      if (
        !a.ready &&
        s?.type === type &&
        mission(this)?.zoneId === this.zone.id
      ) {
        a.count = Math.min(s.required || 1, a.count + amount);
        if (a.count >= (s.required || 1)) advance(this);
      }
    },
    performInteraction(id, action) {
      const profile = inspectInteraction(this, id),
        n = this.entities.find((n) => n.id === id);
      if (!profile || !n) return false;
      this.targetId = id;
      if (profile.reason) {
        log(this, profile.reason);
        return false;
      }
      const allowed = profile.actions.find(
        (a) => a.id === action && !a.disabled,
      );
      if (!allowed) {
        log(this, "This action is not currently available.");
        return false;
      }
      if (action === "cast") {
        const result = this.cast();
        if (result)
          this.event("close-interaction", "Preparing your selected power.");
        return result;
      }
      if (action === "strike") return this.attack();
      if (action === "claim") {
        const a = state(this),
          m = mission(this);
        if (
          !m ||
          !a.ready ||
          m.zoneId !== this.zone.id ||
          n.role !== "campaign-mentor" ||
          a.completed.includes(m.id)
        )
          return false;
        const c = native(this),
          wallet = c === "bad" ? "badKarma" : "goodKarma",
          life = c === "bad" ? "lifetimeBad" : "lifetimeGood";
        this.player[wallet] += m.reward;
        this.player[life] += m.reward;
        a.completed.push(m.id);
        a.receipts.unshift({ id: m.id, reward: m.reward, currency: c });
        if (a.mission === 11) {
          const choice = a.choices[m.id];
          a.ending = {
            title:
              this.player.lineage === "angel"
                ? "Keeper of the Living Concord"
                : "Architect of the Unbound Pact",
            choice,
            text:
              choice === "open"
                ? "The sanctuaries remain open to every willing traveler."
                : choice === "steward"
                  ? "The lattice belongs to its local stewards."
                  : choice === "shatter"
                    ? "The crown is broken; no new throne takes its place."
                    : "A voluntary covenant holds the star-lattice.",
          };
          this.player.campaignTitle = a.ending.title;
        }
        a.mission++;
        a.stage = 0;
        a.count = 0;
        a.ready = false;
        changed(this);
        this.tryRankUp?.();
        syncAdventureEntities(this);
        log(this, `${m.title} settled · +${m.reward} ${c} Karma`, "success");
        persist(this);
        return true;
      }
      if (action.startsWith("choice:")) {
        const a = state(this),
          s = current(this);
        if (s?.type !== "talk" || mission(this).zoneId !== this.zone.id)
          return false;
        const choice = action.slice(7);
        if (!s.choices.some((c) => c.id === choice)) return false;
        a.choices[mission(this).id] = choice;
        advance(this);
        syncAdventureEntities(this);
        persist(this);
        return true;
      }
      if (action.startsWith("phase:")) {
        const r = activityRecord(this, n.activityType),
          phase = Number(action.slice(6));
        if (![1, 2, 3].includes(phase)) return false;
        r.phase = phase;
        changed(this);
        syncAdventureEntities(this);
        persist(this);
        return true;
      }
      if (action === "collect") {
        const r = activityRecord(this, n.activityType),
          type = ACTIVITY_TYPES.find((t) => t.id === n.activityType);
        if (!r.ready || r.claimedAt != null) return false;
        const missing = Object.entries(type.reward).filter(
          ([item, q]) => (this.player.inventory[item] || 0) + q > 999,
        );
        if (missing.length) {
          log(this, "Make room in your pack before collecting.");
          return false;
        }
        for (const [item, q] of Object.entries(type.reward))
          this.player.inventory[item] = (this.player.inventory[item] || 0) + q;
        r.claimedAt = this.time;
        r.cycle++;
        r.ready = false;
        state(this).proof[key(this, type.id)] = true;
        changed(this);
        updateAdventure(this, 0);
        log(
          this,
          `${type.name} complete · ${Object.entries(type.reward)
            .map(([k, v]) => `${v} ${k}`)
            .join(", ")}.`,
          "loot",
        );
        persist(this);
        return true;
      }
      if (action === "survey") {
        if (state(this).surveys[n.id]) return false;
        state(this).surveys[n.id] = { at: this.time, zoneId: this.zone.id };
        log(this, `${n.name} recorded. ${n.description || ""}`, "quest");
        persist(this);
        return true;
      }
      if (action === "gather") {
        const old = this._adventureBypass;
        this._adventureBypass = true;
        try {
          return this.interact();
        } finally {
          this._adventureBypass = old;
        }
      }
      if (action === "contract") {
        const result = n.contractSimulation
          ? this.interactContractEntity(n.id)
          : true;
        this.event("open-contracts", "Commissions, barter and party orders.");
        return result;
      }
      if (action === "travel") {
        if (n.destination) return this.setZone(n.destination);
        this.event("open-map", "Choose your next region.");
        return true;
      }
      if (action === "relay-route") {
        const finish = activityRecord(this, "skybridge").challenge?.finish;
        if (!finish) return false;
        const result = this.navigateTo(finish.x, finish.y);
        if (result)
          this.event(
            "close-interaction",
            "Carrying the spark to its destination.",
          );
        return result;
      }
      if (action === "route") return this.navigateAdventureObjective();
      if (action === "activities") {
        this.event("open-adventure", "Explore local power challenges.", {
          tab: "activities",
        });
        return true;
      }
      const events = {
        campaign: "open-adventure",
        shop: "open-shop",
        craft: "open-craft",
        sanctuary: "open-sanctuary",
        standing: "open-social",
        powers: "open-powers",
      };
      if (events[action]) {
        this.event(events[action], profile.purpose);
        return true;
      }
      return false;
    },
    navigateInteraction(id = this.targetId) {
      const n = this.getTargetEntity(id);
      if (!n) return false;
      const result = this.navigateTo(n.x, n.y);
      if (result)
        this.event("close-interaction", "Approaching the selected target.");
      return result;
    },
  });
  const originalProgress = GameEngine.prototype.progress;
  GameEngine.prototype.progress = function (type, amount = 1) {
    const result = originalProgress.call(this, type, amount);
    if (this.adventure) this.recordAdventureAction(type, amount);
    return result;
  };
}
