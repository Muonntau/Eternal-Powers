/** Authored local campaigns, explicit NPC negotiations, finite escrow barter and NPC cooperation.
 * Manual operating rules: pp.20–22, 218–223. NPC contracts are local simulation, not online players.
 */
import { BRANCHES, ZONES } from "../data/manual.js";
import { getAuthoredCampaign } from "./worldContent.js";

let campaignProvider = getAuthoredCampaign;
let cachedDefinitions = null;
const clone = (value) => structuredClone(value);
const clamp = (n, min = 0, max = 100) => Math.max(min, Math.min(max, n));
const distance = (a, b) =>
  Math.hypot((a?.x || 0) - (b?.x || 0), (a?.y || 0) - (b?.y || 0));
const positive = (n) =>
  Number.isInteger(Number(n)) && Number(n) > 0 && Number(n) <= 9999;
const wallet = (currency) =>
  currency === "bad" || currency === "badKarma" ? "badKarma" : "goodKarma";
const inConflict = (game) => game.inCombat?.() || game.downed;
const inv = (game) => (game.player.inventory ||= {});
const nativeWallet = (game) =>
  game.player.lineage === "demon" ? "badKarma" : "goodKarma";
const eligible = (game, currency) =>
  game.player.certified || wallet(currency) === nativeWallet(game);
const now = (game) => game.contracts.elapsed;
const ownedEntityId = (game, id) =>
  game.player.id ? `${id}:owner:${game.player.id}` : id;
const entityOwner = (game) => ({
  ownerId: game.player.id || null,
  ownerName: game.player.name || null,
});
const fresh = () => ({
  version: 1,
  elapsed: 0,
  serial: 0,
  stateMap: {},
  evidence: {},
  pouch: {},
  completed: [],
  receipts: [],
  dialogue: null,
  barterQuote: null,
  traders: {},
  party: [],
  milestones: {},
  ending: null,
});
const say = (game, text, type = "info") => {
  game.event?.(type, text);
  return false;
};
const persist = (game) => {
  game.save?.(false);
  game.publish?.();
};
const note = (game, entry) => {
  const record = {
    id: `contract-receipt-${++game.contracts.serial}`,
    time: now(game),
    ...entry,
  };
  game.contracts.receipts.unshift(record);
  game.contracts.receipts = game.contracts.receipts.slice(0, 160);
  return record;
};
const normalizeType = (type) =>
  ({
    investigate: "inspect",
    investigation: "inspect",
    delivery: "deliver",
    allocation: "allocate",
    restoration: "restore",
    negotiation: "negotiate",
    mechanism: "mechanism",
  })[type] ||
  type ||
  "inspect";

export function getContractDefinitions(zoneId) {
  if (cachedDefinitions)
    return zoneId
      ? cachedDefinitions.filter((d) => d.zoneId === zoneId)
      : cachedDefinitions;
  const zones = ZONES;
  const definitions = zones.flatMap((zone) => {
    const campaign = campaignProvider(zone) || {};
    return (campaign.objectives || campaign.contracts || []).map(
      (raw, index) => {
        const id = raw.id || `${zone.id}:contract-${index + 1}`;
        const reward =
          typeof raw.reward === "number"
            ? { amount: raw.reward, currency: "good" }
            : {
                amount: 25 * (zone.minRank || 1),
                currency: "good",
                ...raw.reward,
              };
        const steps = (raw.steps || []).map((step, i) => ({
          radius: 85,
          ...step,
          id: step.id || `${id}:step-${i + 1}`,
          type: normalizeType(step.type || raw.type),
          targetId: step.targetId || `${id}:anchor-${i + 1}`,
          name:
            step.name ||
            step.title ||
            `${raw.title || campaign.title} · ${i + 1}`,
          x: Number(step.x ?? step.location?.x ?? raw.location?.x ?? 1080),
          y: Number(step.y ?? step.location?.y ?? raw.location?.y ?? 870),
        }));
        return {
          ...raw,
          id,
          zoneId: raw.zoneId || zone.id,
          zoneName: zone.name,
          title: raw.title || `Objective ${index + 1}`,
          description: raw.description || "",
          type: raw.type || "investigation",
          chapter: raw.chapter || campaign.chapter || 1,
          prerequisites: raw.prerequisites || [],
          requiredRank: raw.requiredRank || 1,
          reward,
          steps,
        };
      },
    );
  });
  if (definitions.length) cachedDefinitions = definitions;
  return zoneId ? definitions.filter((d) => d.zoneId === zoneId) : definitions;
}
function definition(id) {
  return getContractDefinitions().find((d) => d.id === id);
}
function stateFor(game, def) {
  return (game.contracts.stateMap[def.id] ||= {
    id: def.id,
    status: "available",
    steps: {},
    acceptedAt: null,
    deadline: null,
    outcomeCurrency: def.reward.currency,
    rewardClaimed: false,
  });
}
function requirementList(game, def) {
  return [
    {
      label: `Celestial rank ${def.requiredRank}`,
      met: game.player.rank >= def.requiredRank,
    },
    ...def.prerequisites.map((id) => ({
      label: `Complete ${definition(id)?.title || id}`,
      met:
        game.contracts.completed.includes(id) ||
        !!game.contracts.milestones[id],
    })),
  ];
}
function stepRecord(game, def, step) {
  return (stateFor(game, def).steps[step.id] ||= { complete: false });
}
function precedingComplete(game, def, step) {
  const i = def.steps.findIndex((s) => s.id === step.id);
  return def.steps.slice(0, i).every((s) => stepRecord(game, def, s).complete);
}
function physical(game, def, step) {
  return (
    game.zone?.id === def.zoneId && distance(game.player, step) <= step.radius
  );
}
function materialsAvailable(game, items = {}) {
  return Object.entries(items).every(
    ([id, n]) =>
      positive(n) && (inv(game)[id] || 0) >= n && !isBoundItem(game, id),
  );
}
function takeMaterials(game, items = {}) {
  for (const [id, n] of Object.entries(items)) inv(game)[id] -= Number(n);
}
function slots(items) {
  return Object.entries(items).reduce(
    (total, [id, n]) =>
      total +
      (["focus", "ward", "utility"].includes(id)
        ? Math.max(0, n)
        : Math.ceil(Math.max(0, n) / 99)),
    0,
  );
}
function deliverItems(game, items) {
  for (const [id, n] of Object.entries(items || {})) {
    const after = { ...inv(game), [id]: (inv(game)[id] || 0) + n };
    if (slots(after) <= 40) inv(game)[id] = after[id];
    else if (game.sanctuary) {
      game.sanctuary.recovery[id] = (game.sanctuary.recovery[id] || 0) + n;
    } else {
      game.player.recovery ||= {};
      game.player.recovery[id] = (game.player.recovery[id] || 0) + n;
    }
  }
}
function cargoKey(def, step) {
  return `${def.id}:${step.cargo?.id || "delivery-cargo"}`;
}
export function isBoundItem(game, id) {
  return (
    /^quest:|^cargo:/.test(id) ||
    !!game.player.itemBindings?.[id] ||
    Object.values(game.contracts?.pouch || {}).some(
      (p) => p.id === id || p.itemId === id,
    )
  );
}
function completeStep(game, def, step, record, choice) {
  record.complete = true;
  record.completedAt = now(game);
  if (choice) record.choice = choice.id;
  game.contracts.evidence[step.id] = true;
  game.contracts.evidence[step.targetId] = true;
  game.effect?.(step, "heal", "#bed69d", 42, 1);
  say(game, `${step.name} completed.`, "quest");
  persist(game);
  return true;
}
function applyChoice(game, def, step, record, choice) {
  if (!choice) return false;
  const requires = choice.requiresEvidence || step.requiresEvidence || [];
  if (
    !requires.every(
      (id) =>
        game.contracts.evidence[id] || stateFor(game, def).steps[id]?.complete,
    )
  )
    return say(game, "Inspect the listed evidence before making that claim.");
  const costs = choice.items || choice.cost?.items || step.items || {};
  if (!materialsAvailable(game, costs))
    return say(
      game,
      "This choice requires the posted materials. No items were spent.",
    );
  const payment = choice.payment || choice.cost?.currencies || {};
  if (
    !validAssets({ items: costs, currencies: payment }) ||
    !fundsAvailable(game, payment)
  )
    return say(game, "This choice requires its posted available currency.");
  takeMaterials(game, costs);
  for (const [key, n] of Object.entries(payment)) game.player[wallet(key)] -= n;
  const delta = Number(
    choice.reputationDelta ?? (choice.effect === "coerce" ? -10 : 5),
  );
  game.player.reputation = clamp(
    (game.player.reputation || 0) + delta,
    -100,
    100,
  );
  record.reputationDelta = delta;
  if (choice.currency) stateFor(game, def).outcomeCurrency = choice.currency;
  if (choice.grantsItems) deliverItems(game, choice.grantsItems);
  if (choice.grantsPortalAccess) game.player.portalAccess = true;
  if (choice.effect === "fair")
    game.contracts.milestones[`${def.zoneId}:fair-allocation`] = true;
  note(game, {
    type: "dialogue-choice",
    contractId: def.id,
    stepId: step.id,
    choiceId: choice.id,
    items: costs,
    payment,
    reputationDelta: delta,
  });
  return completeStep(game, def, step, record, choice);
}
function defaultChoices(step) {
  return step.choices?.length
    ? step.choices
    : [
        {
          id: "fair",
          label: "Supply the posted need fairly",
          effect: "fair",
          items: step.items || {},
          reputationDelta: 5,
          currency: "good",
        },
        {
          id: "refuse",
          label: "Leave the agreement unchanged",
          effect: "leave",
          reputationDelta: 0,
        },
      ];
}
function describeOffer(game, def) {
  const state = stateFor(game, def),
    requirements = requirementList(game, def);
  return {
    ...clone(def),
    valid: requirements.every((r) => r.met) && state.status !== "complete",
    reason: requirements.find((r) => !r.met)?.label || "",
    status: state.status,
    progress: def.steps.filter((s) => stepRecord(game, def, s).complete).length,
    total: def.steps.length,
    requirements,
    rewardEligible: eligible(
      game,
      state.outcomeCurrency || def.reward.currency,
    ),
    reward: {
      ...def.reward,
      currency: state.outcomeCurrency || def.reward.currency,
    },
    deadline: state.deadline,
    steps: def.steps.map((s) => ({
      ...clone(s),
      ...clone(stepRecord(game, def, s)),
      canInteract: physical(game, def, s),
      available: precedingComplete(game, def, s),
    })),
  };
}

export function initContracts(game, saved) {
  game.contracts = { ...fresh(), ...clone(saved || game.contracts || {}) };
  for (const def of getContractDefinitions()) stateFor(game, def);
  return game.contracts;
}
function ensure(game) {
  if (!game.contracts) initContracts(game);
  // Network identities are assigned after construction. Adopt saved solo
  // actors once, without changing the canonical objective/evidence identities.
  if (game.player.id && game.contracts.ownerId !== game.player.id) {
    for (const ally of game.contracts.party) {
      ally.baseEntityId ||= ally.id;
      ally.id = ownedEntityId(game, ally.baseEntityId);
      ally.owner = game.player.id;
      Object.assign(ally, entityOwner(game));
    }
    for (const state of Object.values(game.contracts.stateMap)) {
      if (!state.escort) continue;
      state.escort.contractTargetId ||= state.escort.id;
      state.escort.id = ownedEntityId(game, state.escort.contractTargetId);
      Object.assign(state.escort, entityOwner(game));
    }
    for (const cargo of Object.values(game.contracts.pouch)) {
      cargo.owner = game.player.id;
      Object.assign(cargo, entityOwner(game));
    }
    game.contracts.ownerId = game.player.id;
  }
  return game.contracts;
}
const TRADER_ITEMS = {
  wood: 20,
  stone: 20,
  metal: 20,
  residue: 20,
  herb: 20,
  crystal: 20,
  draught: 5,
  cleansingCharm: 5,
  protectiveCharm: 5,
};
function traderFor(game) {
  ensure(game);
  const zone = game.zone?.id || ZONES[0].id;
  const trader = (game.contracts.traders[zone] ||= {
    id: `contract-trader:${zone}`,
    name: "Quartermaster of the Exchange",
    zoneId: zone,
    x: 1080,
    y: 870,
    items: clone(TRADER_ITEMS),
    currencies: { goodKarma: 1000, badKarma: 1000 },
    revision: 0,
  });
  trader.id = ownedEntityId(game, `contract-trader:${zone}`);
  Object.assign(trader, entityOwner(game));
  return trader;
}
function barterOffers() {
  return [
    {
      id: "crystal-timber",
      name: "Crystal for building supplies",
      playerOffer: { items: { crystal: 1 }, currencies: {} },
      npcOffer: { items: { wood: 2, stone: 1 }, currencies: {} },
    },
    {
      id: "restoration-supplies",
      name: "Field materials for alchemy supplies",
      playerOffer: { items: { wood: 2, stone: 1 }, currencies: {} },
      npcOffer: { items: { herb: 2, residue: 1 }, currencies: {} },
    },
    {
      id: "relief-commission",
      name: "Quartermaster’s relief exchange",
      playerOffer: { items: { herb: 3 }, currencies: { goodKarma: 5 } },
      npcOffer: { items: { draught: 1 }, currencies: {} },
    },
    {
      id: "infernal-charm",
      name: "Crystal and Bad Karma for a protective charm",
      playerOffer: { items: { crystal: 2 }, currencies: { badKarma: 10 } },
      npcOffer: { items: { protectiveCharm: 1 }, currencies: {} },
    },
    {
      id: "supply-wages",
      name: "Deliver a draught for posted Good Karma",
      playerOffer: { items: { draught: 1 }, currencies: {} },
      npcOffer: { items: {}, currencies: { goodKarma: 10 } },
    },
  ];
}
function validAssets(assets) {
  return (
    assets &&
    Object.entries(assets.items || {}).every(
      ([id, n]) => typeof id === "string" && positive(n),
    ) &&
    Object.entries(assets.currencies || {}).every(
      ([key, n]) =>
        ["good", "bad", "goodKarma", "badKarma"].includes(key) && positive(n),
    )
  );
}
function fundsAvailable(game, currencies) {
  return Object.entries(currencies || {}).every(
    ([key, n]) => eligible(game, key) && (game.player[wallet(key)] || 0) >= n,
  );
}
function knownTrader(game, id) {
  const trader = traderFor(game);
  return trader.id === id ? trader : null;
}
function releaseQuote(game, quote, status) {
  if (quote.status === "locked" && quote.escrow?.active) {
    quote.escrow.active = false;
    deliverItems(game, quote.playerOffer.items);
    for (const [key, n] of Object.entries(quote.playerOffer.currencies))
      game.player[wallet(key)] += n;
    const trader = game.contracts.traders[quote.zoneId];
    for (const [id, n] of Object.entries(quote.npcOffer.items))
      trader.items[id] = (trader.items[id] || 0) + n;
    for (const [key, n] of Object.entries(quote.npcOffer.currencies))
      trader.currencies[wallet(key)] += n;
    trader.revision++;
  }
  quote.status = status;
  quote.valid = false;
}
const methods = {
  previewContract(id) {
    ensure(this);
    const def = definition(id);
    return def
      ? describeOffer(this, def)
      : { valid: false, reason: "Contract not found." };
  },
  acceptContract(id) {
    ensure(this);
    const def = definition(id);
    if (!def) return false;
    const state = stateFor(this, def);
    if (state.status === "complete" || state.status === "active") return false;
    const missing = requirementList(this, def).find((r) => !r.met);
    if (missing) return say(this, missing.label);
    if (this.zone?.id !== def.zoneId)
      return say(this, "Visit the contract’s posted region before accepting.");
    state.status = "active";
    state.acceptedAt = now(this);
    state.deadline =
      now(this) +
      (def.deadlineSeconds ||
        (this.worldModel?.dayLength || 3600) * (def.deadlineDays || 1));
    state.failureTerms =
      def.failureTerms ||
      "Unsettled cargo returns to its source. Previous rewards remain settled.";
    for (const step of def.steps)
      if (
        step.type === "inspect" &&
        (this.contracts.evidence[step.id] ||
          this.contracts.evidence[step.targetId])
      )
        stepRecord(this, def, step).complete = true;
    note(this, {
      type: "contract-accepted",
      contractId: id,
      deadline: state.deadline,
    });
    say(
      this,
      `${def.title} accepted. Inspect its physical steps and posted recovery terms.`,
      "quest",
    );
    persist(this);
    return true;
  },
  settleContract(id) {
    ensure(this);
    const def = definition(id);
    if (!def) return false;
    const state = stateFor(this, def);
    if (
      state.status !== "active" ||
      state.rewardClaimed ||
      !def.steps.every((s) => stepRecord(this, def, s).complete)
    )
      return say(this, "Complete the listed physical steps before settlement.");
    state.status = "complete";
    state.rewardClaimed = true;
    state.completedAt = now(this);
    this.contracts.completed.push(id);
    if (def.milestone) this.contracts.milestones[def.milestone] = true;
    const currency = state.outcomeCurrency || def.reward.currency,
      amount = Math.max(0, Math.floor(def.reward.amount));
    const paid = eligible(this, currency);
    if (paid) {
      this.player[wallet(currency)] += amount;
      this.player[
        wallet(currency) === "badKarma" ? "lifetimeBad" : "lifetimeGood"
      ] += amount;
    }
    this.player.reputation = clamp(
      (this.player.reputation || 0) + (def.reputationDelta ?? 5),
      -100,
      100,
    );
    for (const [key, cargo] of Object.entries(this.contracts.pouch))
      if (cargo.contractId === id) delete this.contracts.pouch[key];
    if (def.grantsPortalAccess) this.player.portalAccess = true;
    if (def.ending) {
      this.contracts.ending = {
        id: def.id,
        title: def.title,
        summary:
          def.endingSummary ||
          "The three realm agreements are settled. Your continuing world remains available.",
        completedAt: now(this),
      };
      this.contracts.milestones["campaign-complete"] = true;
    }
    note(this, {
      type: "contract-settled",
      contractId: id,
      amount: paid ? amount : 0,
      postedAmount: amount,
      currency,
      lifetimeCredit: paid,
      ending: !!def.ending,
    });
    this.tryRankUp?.();
    say(
      this,
      `${def.title} settled · ${paid ? `+${amount} ${currency} Karma` : "opposing outcome recorded; certification is required for payment"}.`,
      "quest",
    );
    persist(this);
    return true;
  },
  abandonContract(id, reason = "abandoned") {
    ensure(this);
    const def = definition(id);
    if (!def) return false;
    const state = stateFor(this, def);
    if (state.status !== "active") return false;
    state.status = reason === "expired" ? "expired" : "abandoned";
    state.escort = null;
    for (const [key, cargo] of Object.entries(this.contracts.pouch))
      if (cargo.contractId === id) delete this.contracts.pouch[key];
    for (const step of def.steps.filter((s) =>
      ["pickup", "deliver", "escort"].includes(s.type),
    ))
      state.steps[step.id] = { complete: false };
    this.player.reputation = clamp(
      (this.player.reputation || 0) - 10,
      -100,
      100,
    );
    note(this, {
      type: "contract-" + reason,
      contractId: id,
      reputationDelta: -10,
    });
    say(
      this,
      `${def.title}: ${reason}. Bound cargo returned to its source; no inventory or progression was deleted.`,
    );
    persist(this);
    return true;
  },
  openContractDialogue(id, stepId) {
    ensure(this);
    const def = definition(id),
      step = def?.steps.find((s) => s.id === stepId);
    if (!step || !physical(this, def, step))
      return say(this, "Approach the named contract contact.");
    const state = stateFor(this, def);
    if (
      state.status !== "active" ||
      !precedingComplete(this, def, step) ||
      stepRecord(this, def, step).complete
    )
      return false;
    this.contracts.dialogue = {
      npcId: step.targetId,
      contractId: id,
      stepId,
      text: step.dialogue || step.description || def.description,
      choices: defaultChoices(step).map((c) => ({
        ...clone(c),
        consequence:
          c.consequence ||
          `${c.reputationDelta ?? (c.effect === "coerce" ? -10 : c.effect === "leave" ? 0 : 5)} reputation; ${c.currency || state.outcomeCurrency || def.reward.currency} outcome`,
      })),
    };
    this.publish?.();
    return clone(this.contracts.dialogue);
  },
  chooseDialogue(npcId, choiceId) {
    ensure(this);
    const dialogue = this.contracts.dialogue;
    if (!dialogue || dialogue.npcId !== npcId) return false;
    const def = definition(dialogue.contractId),
      step = def?.steps.find((s) => s.id === dialogue.stepId),
      choice =
        step &&
        (dialogue.kind === "mechanism"
          ? dialogue.choices
          : defaultChoices(step)
        ).find((c) => c.id === choiceId);
    if (
      !def ||
      !step ||
      !choice ||
      stateFor(this, def).status !== "active" ||
      !precedingComplete(this, def, step) ||
      !physical(this, def, step) ||
      inConflict(this)
    )
      return say(
        this,
        "The dialogue contact is no longer eligible or nearby. No choice was committed.",
      );
    if (choice.effect === "leave" || choiceId === "refuse") {
      this.contracts.dialogue = null;
      this.publish?.();
      return true;
    }
    const record = stepRecord(this, def, step);
    if (record.complete) return false;
    if (dialogue.kind === "mechanism") {
      const done = this.advanceContractStep(def.id, step.id, choice.id);
      if (stepRecord(this, def, step).complete) this.contracts.dialogue = null;
      return done;
    }
    const result = applyChoice(this, def, step, record, choice);
    if (result) this.contracts.dialogue = null;
    return result;
  },
  advanceContractStep(id, stepId, choiceId) {
    ensure(this);
    const def = definition(id),
      step = def?.steps.find((s) => s.id === stepId);
    if (!step) return false;
    const state = stateFor(this, def),
      record = stepRecord(this, def, step);
    if (record.complete)
      return say(this, "That physical objective is already recorded.");
    if (!physical(this, def, step))
      return say(this, "Approach this objective’s marked physical location.");
    if (
      state.status === "active" &&
      state.deadline != null &&
      now(this) > state.deadline
    ) {
      this.abandonContract(id, "expired");
      return false;
    }
    if (step.type !== "inspect" && state.status !== "active")
      return say(
        this,
        "Accept the posted contract before committing this action.",
      );
    if (step.type !== "inspect" && !precedingComplete(this, def, step))
      return say(this, "Complete the preceding steps first.");
    if (step.type !== "inspect" && inConflict(this))
      return say(
        this,
        "Finish the encounter before committing this contract interaction.",
      );
    if (step.type === "inspect") {
      this.contracts.evidence[step.id] = true;
      this.contracts.evidence[step.targetId] = true;
      return completeStep(this, def, step, record);
    }
    if (["allocate", "negotiate"].includes(step.type)) {
      if (!choiceId) return this.openContractDialogue(id, stepId);
      const choice = defaultChoices(step).find((c) => c.id === choiceId);
      if (!choice) return false;
      if (choice.effect === "leave") return true;
      return applyChoice(this, def, step, record, choice);
    }
    if (step.type === "pickup") {
      const key = cargoKey(def, step);
      if (this.contracts.pouch[key]) return false;
      this.contracts.pouch[key] = {
        id: key,
        itemId: `quest:${key}`,
        contractId: id,
        name: step.cargo?.name || "Bound delivery parcel",
        quantity: step.cargo?.quantity || 1,
        bound: true,
        owner: this.player.id || "local-player",
        ...entityOwner(this),
      };
      return completeStep(this, def, step, record);
    }
    if (step.type === "deliver") {
      const key = cargoKey(def, step),
        cargo = this.contracts.pouch[key];
      if (!cargo || cargo.contractId !== id)
        return say(this, "Collect the bound parcel from its source first.");
      delete this.contracts.pouch[key];
      record.deliveredCargo = key;
      return completeStep(this, def, step, record);
    }
    if (step.type === "escort") {
      if (!state.escort) {
        const points = step.waypoints?.length
          ? step.waypoints
          : [{ x: step.destination?.x ?? 1080, y: step.destination?.y ?? 870 }];
        state.escort = {
          id: ownedEntityId(this, step.targetId),
          contractTargetId: step.targetId,
          ...entityOwner(this),
          name: step.escortName || "Contract traveler",
          contractId: id,
          stepId,
          kind: "npc",
          role: "escort",
          sprite: "npc",
          x: step.x,
          y: step.y,
          zoneId: def.zoneId,
          health: 100,
          maxHealth: 100,
          waypoints: clone(points),
          waypointIndex: 0,
          state: "following",
          speed: 75,
        };
        record.started = true;
        say(
          this,
          "Escort begun. Stay within 220 pixels and guide the traveler to each waypoint.",
          "quest",
        );
        persist(this);
        return true;
      }
      return say(
        this,
        "The traveler is following the marked route. Stay nearby to continue.",
      );
    }
    if (step.type === "mechanism" && step.sequence?.length) {
      if (choiceId === undefined) {
        this.contracts.dialogue = {
          kind: "mechanism",
          npcId: step.targetId,
          contractId: id,
          stepId,
          text:
            step.description ||
            "Read the visible sequence, then activate its glyphs in order.",
          choices: [...new Set(step.sequence)].map((n) => ({
            id: String(n),
            label: `Activate ${n}`,
            consequence:
              "An incorrect glyph resets this mechanism without spending resources.",
          })),
        };
        this.publish?.();
        return clone(this.contracts.dialogue);
      }
      const index = record.sequenceIndex || 0;
      if (String(choiceId) !== String(step.sequence[index])) {
        record.sequenceIndex = 0;
        persist(this);
        return say(
          this,
          "The mechanism reset. Read the visible sequence; no resources were spent.",
        );
      }
      record.sequenceIndex = index + 1;
      if (record.sequenceIndex < step.sequence.length) {
        persist(this);
        return true;
      }
    }
    const requiredEvidence = step.requiresEvidence || [];
    if (
      !requiredEvidence.every(
        (key) => this.contracts.evidence[key] || state.steps[key]?.complete,
      )
    )
      return say(this, "Gather the listed physical evidence first.");
    if (!materialsAvailable(this, step.items || {}))
      return say(this, "Bring the posted materials before committing.");
    if (step.power) {
      const branch = BRANCHES.find((b) => b.id === step.power.branchId),
        power = branch?.powers.find((p) => p.level === (step.power.level || 1));
      if (
        !power ||
        power.kind !== "local" ||
        (this.player.learned?.[branch.id] || 0) < power.level
      )
        return say(
          this,
          "Learn the named local power before this restoration.",
        );
      if (
        this.player.essence < power.essenceCost ||
        (this.cooldowns?.[power.id] || 0) > (this.time || 0)
      )
        return say(this, "The named power needs Essence or is recovering.");
      const prepared =
        this.contracts.castState?.contractId === id &&
        this.contracts.castState.stepId === step.id &&
        now(this) >= this.contracts.castState.resolveAt;
      if (!prepared) {
        if (this.contracts.castState || this.castState || this.techniqueState)
          return say(
            this,
            "Finish or cancel the current power preparation first.",
          );
        this.contracts.castState = {
          contractId: id,
          stepId: step.id,
          name: power.name,
          powerId: power.id,
          start: now(this),
          resolveAt: now(this) + power.castTime,
          duration: power.castTime,
          x: this.player.x,
          y: this.player.y,
          zoneId: this.zone?.id,
        };
        record.preparing = true;
        this.effect?.(this.player, "channel", branch.color, 40, power.castTime);
        persist(this);
        return true;
      }
      this.contracts.castState = null;
      record.preparing = false;
      this.player.essence -= power.essenceCost;
      this.cooldowns ||= {};
      this.cooldowns[power.id] = (this.time || 0) + power.cooldown;
      this.lastAction = this.time || 0;
      record.powerId = power.id;
      this.effect?.(step, "spell", branch.color, 55, 1);
    }
    takeMaterials(this, step.items || {});
    if (step.grantsPortalAccess) this.player.portalAccess = true;
    const region = this.worldSystems?.regions?.[def.zoneId];
    if (region && step.type === "restore") {
      region.vitality = clamp(region.vitality + 10);
      region.stability = clamp(region.stability + 5);
    }
    return completeStep(this, def, step, record);
  },
  interactContractEntity(entityId) {
    ensure(this);
    for (const def of getContractDefinitions(this.zone?.id)) {
      const step = def.steps.find(
        (s) => ownedEntityId(this, s.targetId) === entityId,
      );
      if (step) return this.advanceContractStep(def.id, step.id);
    }
    if (entityId === traderFor(this).id) {
      this.event?.(
        "open-contracts",
        "Inspect the quartermaster’s posted barter offers.",
      );
      return true;
    }
    return false;
  },
  previewBarter(npcId, offerId) {
    ensure(this);
    if (
      this.contracts.barterQuote &&
      ["preview", "locked"].includes(this.contracts.barterQuote.status)
    )
      releaseQuote(this, this.contracts.barterQuote, "cancelled");
    const trader = knownTrader(this, npcId),
      offer = barterOffers().find((o) => o.id === offerId);
    let reason =
      !trader || !offer
        ? "Unknown posted trader offer."
        : inConflict(this)
          ? "Leave conflict before bartering."
          : distance(this.player, trader) > 220
            ? "Approach the quartermaster before opening a barter."
            : null;
    if (
      !reason &&
      [
        ...Object.keys(offer.playerOffer.items),
        ...Object.keys(offer.npcOffer.items),
      ].some((id) => isBoundItem(this, id))
    )
      reason = "Quest-bound assets cannot enter a trade.";
    if (
      !reason &&
      [
        ...Object.keys(offer.playerOffer.currencies),
        ...Object.keys(offer.npcOffer.currencies),
      ].some((key) => !eligible(this, key))
    )
      reason =
        "This currency is inaccessible before cross-affinity certification.";
    const q = {
      id: `barter-${++this.contracts.serial}`,
      owner: "local-player",
      npcId,
      offerId,
      zoneId: this.zone?.id,
      name: offer?.name || offerId,
      playerOffer: clone(offer?.playerOffer || { items: {}, currencies: {} }),
      npcOffer: clone(offer?.npcOffer || { items: {}, currencies: {} }),
      expiresAt: now(this) + 30,
      status: reason ? "rejected" : "preview",
      valid: !reason,
      reason: reason || "",
      revision: trader?.revision || 0,
    };
    this.contracts.barterQuote = q;
    persist(this);
    return clone(q);
  },
  lockBarter(id) {
    ensure(this);
    const q = this.contracts.barterQuote,
      trader = q && this.contracts.traders[q.zoneId];
    if (
      !q ||
      q.id !== id ||
      q.status !== "preview" ||
      !q.valid ||
      now(this) > q.expiresAt
    )
      return false;
    if (
      this.zone?.id !== q.zoneId ||
      distance(this.player, trader) > 220 ||
      inConflict(this)
    )
      return say(
        this,
        "The trader is no longer nearby. No assets were reserved.",
      );
    if (
      !validAssets(q.playerOffer) ||
      !validAssets(q.npcOffer) ||
      !materialsAvailable(this, q.playerOffer.items) ||
      !fundsAvailable(this, q.playerOffer.currencies)
    )
      return say(this, "The offered player assets are no longer available.");
    if (
      trader.revision !== q.revision ||
      Object.entries(q.npcOffer.items).some(
        ([key, n]) => (trader.items[key] || 0) < n,
      ) ||
      Object.entries(q.npcOffer.currencies).some(
        ([key, n]) => (trader.currencies[wallet(key)] || 0) < n,
      )
    )
      return say(this, "The posted NPC stock changed. Request a fresh quote.");
    takeMaterials(this, q.playerOffer.items);
    for (const [key, n] of Object.entries(q.playerOffer.currencies))
      this.player[wallet(key)] -= n;
    for (const [key, n] of Object.entries(q.npcOffer.items))
      trader.items[key] -= n;
    for (const [key, n] of Object.entries(q.npcOffer.currencies))
      trader.currencies[wallet(key)] -= n;
    q.escrow = { active: true };
    q.status = "locked";
    trader.revision++;
    q.lockedRevision = trader.revision;
    note(this, { type: "barter-locked", quoteId: id });
    persist(this);
    return clone(q);
  },
  commitBarter(id) {
    ensure(this);
    const q = this.contracts.barterQuote,
      trader = q && this.contracts.traders[q.zoneId];
    if (!q || q.id !== id || q.status !== "locked" || !q.escrow?.active)
      return false;
    if (now(this) > q.expiresAt) {
      releaseQuote(this, q, "expired");
      persist(this);
      return false;
    }
    if (
      this.zone?.id !== q.zoneId ||
      distance(this.player, trader) > 220 ||
      inConflict(this) ||
      trader.revision !== q.lockedRevision
    )
      return say(
        this,
        "The locked exchange is not currently eligible. Cancel to release both sides.",
      );
    const after = { ...inv(this) };
    for (const [key, n] of Object.entries(q.npcOffer.items))
      after[key] = (after[key] || 0) + n;
    if (slots(after) > 40)
      return say(
        this,
        "The receiving pack is full. Both sides remain in escrow until cancellation or expiry.",
      );
    q.escrow.active = false;
    q.status = "settled";
    q.valid = false;
    deliverItems(this, q.npcOffer.items);
    for (const [key, n] of Object.entries(q.npcOffer.currencies))
      this.player[wallet(key)] += n;
    for (const [key, n] of Object.entries(q.playerOffer.items))
      trader.items[key] = (trader.items[key] || 0) + n;
    for (const [key, n] of Object.entries(q.playerOffer.currencies))
      trader.currencies[wallet(key)] += n;
    trader.revision++;
    note(this, {
      type: "barter-settled",
      quoteId: id,
      playerOffer: clone(q.playerOffer),
      npcOffer: clone(q.npcOffer),
      lifetimeCredit: false,
    });
    say(
      this,
      "Barter settled atomically. Transfers do not increase lifetime Karma.",
      "trade",
    );
    persist(this);
    return true;
  },
  cancelBarter(id) {
    ensure(this);
    const q = this.contracts.barterQuote;
    if (!q || q.id !== id || !["preview", "locked"].includes(q.status))
      return false;
    releaseQuote(this, q, "cancelled");
    note(this, { type: "barter-cancelled", quoteId: id });
    persist(this);
    return true;
  },
  hireAlly(role = "guardian") {
    ensure(this);
    const roles = {
        guardian: { name: "Sanctuary Guardian", sprite: "guardian", price: 75 },
        medic: { name: "Sanctuary Medic", sprite: "keeper", price: 75 },
        scout: { name: "Wayfarer Scout", sprite: "npc", price: 50 },
      },
      offer = roles[role];
    if (!offer || inConflict(this)) return false;
    if (this.contracts.party.some((a) => a.active))
      return say(
        this,
        "One hired ally may accompany you alongside your bonded familiar.",
      );
    const key = nativeWallet(this);
    if (this.player[key] < offer.price)
      return say(this, `The posted hire costs ${offer.price} native Karma.`);
    this.player[key] -= offer.price;
    const baseEntityId = `party-ally-${++this.contracts.serial}`;
    const ally = {
      id: ownedEntityId(this, baseEntityId),
      baseEntityId,
      role,
      name: offer.name,
      sprite: offer.sprite,
      kind: "ally",
      owner: this.player.id || "local-player",
      ...entityOwner(this),
      x: this.player.x - 45,
      y: this.player.y + 30,
      zoneId: this.zone?.id,
      health: 100,
      maxHealth: 100,
      command: "follow",
      active: true,
      lastSupport: now(this),
      walking: false,
      facing: 0,
    };
    this.contracts.party.push(ally);
    note(this, {
      type: "ally-hired",
      allyId: ally.id,
      role,
      cost: offer.price,
      currency: key,
      lifetimeCredit: false,
    });
    persist(this);
    return clone(ally);
  },
  commandAlly(id, command) {
    ensure(this);
    const ally = this.contracts.party.find((a) => a.id === id && a.active);
    if (
      !ally ||
      !["follow", "wait", "assist", "defend", "return"].includes(command)
    )
      return false;
    ally.command = command;
    if (command === "return") {
      ally.active = false;
      ally.walking = false;
    }
    persist(this);
    return true;
  },
};

export function updateContracts(game, dt) {
  ensure(game);
  const delta = Math.max(0, Number(dt) || 0);
  game.contracts.elapsed += delta;
  const pending = game.contracts.castState;
  if (pending) {
    const def = definition(pending.contractId),
      step = def?.steps.find((s) => s.id === pending.stepId);
    if (
      !step ||
      game.zone?.id !== pending.zoneId ||
      distance(game.player, pending) > 2 ||
      inConflict(game)
    ) {
      if (step) stepRecord(game, def, step).preparing = false;
      game.contracts.castState = null;
      say(
        game,
        "Movement or conflict cancelled the contract power preparation. No Essence spent.",
      );
    } else if (now(game) >= pending.resolveAt) {
      methods.advanceContractStep.call(
        game,
        pending.contractId,
        pending.stepId,
      );
      if (game.contracts.castState === pending) {
        game.contracts.castState = null;
        stepRecord(game, def, step).preparing = false;
      }
    }
  }
  const q = game.contracts.barterQuote;
  if (
    q &&
    ["preview", "locked"].includes(q.status) &&
    now(game) > q.expiresAt
  ) {
    releaseQuote(game, q, "expired");
    note(game, { type: "barter-expired", quoteId: q.id });
    persist(game);
  }
  for (const def of getContractDefinitions()) {
    const state = stateFor(game, def);
    if (state.status !== "active") continue;
    if (state.deadline != null && now(game) > state.deadline) {
      methods.abandonContract.call(game, def.id, "expired");
      continue;
    }
    const escort = state.escort;
    if (
      !escort ||
      escort.zoneId !== game.zone?.id ||
      escort.state === "arrived"
    )
      continue;
    const step = def.steps.find((s) => s.id === escort.stepId),
      record = step && stepRecord(game, def, step);
    if (!step || record.complete) continue;
    escort.walking = false;
    if (distance(game.player, escort) > 220 || game.downed) {
      escort.state = "waiting";
      continue;
    }
    escort.state = "following";
    const next = escort.waypoints[escort.waypointIndex];
    if (!next) continue;
    const d = distance(escort, next);
    if (d < 12) {
      escort.waypointIndex++;
      if (escort.waypointIndex >= escort.waypoints.length) {
        escort.state = "arrived";
        record.cooperative =
          game.contracts.party.some((a) => a.active) || !!game.player.companion;
        game.player.cooperativeTrial ||= record.cooperative;
        completeStep(game, def, step, record);
      }
      continue;
    }
    const travel = Math.min(d, escort.speed * delta);
    escort.x += ((next.x - escort.x) / d) * travel;
    escort.y += ((next.y - escort.y) / d) * travel;
    escort.walking = true;
    escort.facing =
      Math.abs(next.x - escort.x) > Math.abs(next.y - escort.y)
        ? next.x < escort.x
          ? 1
          : 2
        : next.y < escort.y
          ? 3
          : 0;
  }
  for (const ally of game.contracts.party.filter((a) => a.active)) {
    if (ally.zoneId !== game.zone?.id) {
      ally.zoneId = game.zone?.id;
      ally.x = game.player.x - 40;
      ally.y = game.player.y + 25;
    }
    ally.walking = false;
    if (ally.command !== "wait") {
      const target =
          ally.command === "defend"
            ? game.player
            : { x: game.player.x - 45, y: game.player.y + 30 },
        d = distance(ally, target);
      if (d > 30) {
        const n = Math.min(d, 105 * delta);
        ally.x += ((target.x - ally.x) / d) * n;
        ally.y += ((target.y - ally.y) / d) * n;
        ally.walking = true;
      }
    }
    if (
      now(game) - ally.lastSupport >= 10 &&
      ["follow", "assist", "defend"].includes(ally.command)
    ) {
      ally.lastSupport = now(game);
      if (ally.role === "medic" && game.player.health < game.player.maxHealth) {
        game.player.health = Math.min(
          game.player.maxHealth,
          game.player.health + 10,
        );
        game.effect?.(game.player, "heal", "#afd6a1", 40, 1);
      } else if (ally.role === "guardian" && inConflict(game)) {
        game.grantBarrier?.(10, 6);
      } else if (ally.role === "scout") {
        ally.hint = "Look for the next marked evidence or delivery anchor.";
      }
    }
  }
}
export function getContractEntities(game) {
  ensure(game);
  const list = [];
  for (const def of getContractDefinitions(game.zone?.id)) {
    const state = stateFor(game, def);
    for (const step of def.steps) {
      const escort = state.escort?.stepId === step.id ? state.escort : null;
      if (escort) {
        list.push({
          ...clone(escort),
          id: ownedEntityId(game, step.targetId),
          contractTargetId: step.targetId,
          ...entityOwner(game),
          kind: "npc",
          role: "contract-escort",
          contractId: def.id,
          stepId: step.id,
          description: "Stay nearby and follow the marked escort route.",
        });
        continue;
      }
      list.push({
        id: ownedEntityId(game, step.targetId),
        contractTargetId: step.targetId,
        ...entityOwner(game),
        name: step.name,
        x: step.x,
        y: step.y,
        zoneId: def.zoneId,
        kind: "contract-node",
        role: "contract-step",
        sprite: ["allocate", "negotiate", "escort", "service"].includes(
          step.type,
        )
          ? "npc"
          : ["pickup", "deliver"].includes(step.type)
            ? "chest"
            : "shrine",
        contractId: def.id,
        stepId: step.id,
        complete: !!stepRecord(game, def, step).complete,
        neutral: true,
        description: step.description || def.description,
        protected: true,
      });
    }
  }
  const trader = traderFor(game);
  list.push({
    ...clone(trader),
    kind: "npc",
    role: "contract-trader",
    sprite: "merchant",
    description: "Finite NPC barter with explicit offers and two-phase escrow.",
  });
  list.push(
    ...game.contracts.party
      .filter((a) => a.active && a.zoneId === game.zone?.id)
      .map((a) => ({ ...clone(a), neutral: true, protected: true })),
  );
  return list;
}
export function getContractsSnapshot(game) {
  ensure(game);
  const zone = ZONES.find((z) => z.id === game.zone?.id) || ZONES[0],
    campaign = campaignProvider(zone) || {};
  const all = getContractDefinitions();
  return {
    contracts: {
      ...clone(game.contracts),
      campaign: {
        id: campaign.id || zone.id,
        title: campaign.title || zone.name,
        chapter: campaign.chapter || 1,
        description: campaign.description || "",
      },
      offers: all
        .filter((d) => d.zoneId === game.zone?.id)
        .map((d) => describeOffer(game, d)),
      active: all
        .filter((d) => stateFor(game, d).status === "active")
        .map((d) => describeOffer(game, d)),
      trader: clone(traderFor(game)),
      barterOffers: barterOffers(),
      hireOffers: [
        { role: "guardian", name: "Sanctuary Guardian", price: 75 },
        { role: "medic", name: "Sanctuary Medic", price: 75 },
        { role: "scout", name: "Wayfarer Scout", price: 50 },
      ],
    },
  };
}
export const serializeContracts = (game) => clone(ensure(game));
export function installContracts(
  GameEngine,
  { campaignProvider: provider = getAuthoredCampaign } = {},
) {
  campaignProvider = provider;
  cachedDefinitions = null;
  Object.assign(GameEngine.prototype, methods);
  return GameEngine;
}
