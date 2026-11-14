/** Recorded-cost sanctuary respecialization. Manual p.7; no lifetime credit. */
import { BRANCHES, ENHANCEMENTS, TECHNIQUES } from "../data/manual.js";

const clone = (value) => structuredClone(value);
const wallet = (currency) => (currency === "bad" ? "badKarma" : "goodKarma");
const serial = (state, prefix) => `${prefix}-${++state.serial}`;
const validCost = (cost) => Number.isSafeInteger(cost) && cost >= 0;
const branch = (id) => BRANCHES.find((b) => b.id === id);
const native = (game, b) =>
  (game.player.lineage === "demon") === (b.currency === "bad");
const fresh = () => ({
  version: 1,
  serial: 0,
  ledger: [],
  receipts: [],
  preview: null,
});
let sessionSerial = 0;
const newSession = () =>
  globalThis.crypto?.randomUUID?.() ||
  `session-${Date.now()}-${++sessionSerial}`;

export function initRespecialization(game, saved) {
  const source = saved || game.respecialization || {};
  game.respecialization = {
    ...fresh(),
    ...clone(source),
    sessionId: newSession(),
    preview: null,
    ledger: Array.isArray(source.ledger) ? clone(source.ledger) : [],
    receipts: Array.isArray(source.receipts) ? clone(source.receipts) : [],
  };
  return game.respecialization;
}
const state = (game) => game.respecialization || initRespecialization(game);
const activeRecord = (game, kind, id, level) =>
  state(game).ledger.findLast(
    (r) =>
      r.status === "active" &&
      r.kind === kind &&
      (kind === "branch"
        ? r.branchId === id && r.level === level
        : r.techniqueId === id),
  );
const notice = (game, text) => {
  game.event?.("info", text);
  return false;
};
const persist = (game) => {
  game.save?.(false);
  game.publish?.();
};

function contextReason(game) {
  if (game.downed || game.player.health <= 0)
    return "Recover before respecializing.";
  if (game.inCombat?.())
    return "Leave conflict for five seconds before respecializing.";
  if (
    game.castState ||
    game.techniqueState ||
    game.contracts?.castState ||
    game.progression?.recovery?.resurrection ||
    game.progression?.recovery?.revive
  )
    return "Finish or cancel the current preparation before respecializing.";
  if (game.worldSystems?.active?.())
    return "Finish or cancel the active ritual reservation first.";
  if (game.shop?.pendingCraft)
    return "Finish the committed craft before respecializing.";
  const p = game.player,
    hub = game.world?.spawn || { x: 920, y: 900 },
    plot = game.sanctuary?.plot;
  const atHub = Math.hypot(p.x - hub.x, p.y - hub.y) <= 300;
  const atPlot =
    plot &&
    (!plot.zoneId || plot.zoneId === game.zone?.id) &&
    p.x >= plot.x &&
    p.x <= plot.x + plot.width &&
    p.y >= plot.y &&
    p.y <= plot.y + plot.height;
  return atHub || atPlot
    ? ""
    : "Return to a sanctuary hub or your owned plot to respecialize.";
}

function rowFor(game, record, values) {
  const verified =
    !!record && validCost(record.cost) && record.currency === values.currency;
  const exact =
    verified &&
    record.sessionId === state(game).sessionId &&
    !record.used &&
    !record.hadDependents;
  const cost = verified ? record.cost : 0;
  return {
    ...values,
    recordId: record?.id || null,
    cost,
    verified,
    refund: exact ? cost : Math.floor(cost * 0.8),
    rate: exact ? 1 : verified ? 0.8 : 0,
    reason: exact
      ? "Unused purchase in this session; no dependent unlock was learned or used."
      : verified
        ? "Used, dependent, or earlier-session training: 80% of its recorded price."
        : values.freeStarter
          ? "This starting power was granted freely."
          : "No recorded purchase price; no refund is created.",
  };
}

function calculate(game, branchId, targetLevel) {
  const b = branch(branchId),
    current = Number(game.player.learned?.[branchId] || 0);
  let reason = contextReason(game);
  if (
    !b ||
    !Number.isInteger(current) ||
    current < 1 ||
    current > b.powers.length ||
    !Number.isInteger(targetLevel) ||
    targetLevel < 0 ||
    targetLevel >= current
  )
    reason = "Choose a learned branch and a lower retained level.";
  if (reason)
    return {
      valid: false,
      reason,
      branchId,
      targetLevel,
      removed: [],
      dependentTechniques: [],
      refund: 0,
      currency: b?.currency || "good",
      requiresConfirmation: true,
    };
  const removed = [];
  for (let level = current; level > targetLevel; level--) {
    const p = b.powers.find((p) => p.level === level);
    const record = activeRecord(game, "branch", branchId, level);
    removed.push(
      rowFor(game, record, {
        kind: "branch",
        id: p.id,
        branchId,
        name: p.name,
        level,
        currency: b.currency,
        freeStarter:
          !record && level === 1 && game.player.starterBranch === branchId,
      }),
    );
  }
  const hasDomain = Object.entries(game.player.learned || {}).some(
    ([id, level]) =>
      id !== branchId && level > 0 && branch(id)?.domain === b.domain,
  );
  const dependentTechniques =
    targetLevel === 0 && !hasDomain
      ? TECHNIQUES.filter(
          (t) =>
            t.domain === b.domain && game.player.techniques?.includes(t.id),
        )
          .sort((a, b) => b.order - a.order)
          .map((t) =>
            rowFor(game, activeRecord(game, "technique", t.id), {
              kind: "technique",
              id: t.id,
              name: t.name,
              order: t.order,
              level: t.requiredRank,
              currency: t.currency,
            }),
          )
      : [];
  const enhancement =
    targetLevel === 0
      ? ENHANCEMENTS.find((e) => e.branchId === branchId)
      : null;
  const unequipEnhancement =
    enhancement && game.player.enhancementSelection?.[enhancement.id]
      ? {
          id: enhancement.id,
          name: enhancement.name,
          rank: game.player.enhancementSelection[enhancement.id],
        }
      : null;
  const refund = [...removed, ...dependentTechniques].reduce(
    (total, r) => total + r.refund,
    0,
  );
  if (
    !validCost(refund) ||
    !validCost(game.player[wallet(b.currency)]) ||
    !Number.isSafeInteger(game.player[wallet(b.currency)] + refund)
  )
    return {
      valid: false,
      reason: "The recorded refund cannot be represented safely.",
      branchId,
      targetLevel,
      removed: [],
      dependentTechniques: [],
      refund: 0,
      currency: b.currency,
      requiresConfirmation: true,
    };
  return {
    valid: true,
    reason: "",
    branchId,
    branchName: b.name,
    currentLevel: current,
    targetLevel,
    currency: b.currency,
    removed: [...dependentTechniques, ...removed],
    dependentTechniques,
    unequipEnhancement,
    refund,
    requiresConfirmation: true,
    warnings: [...removed, ...dependentTechniques].some(
      (r) => !r.verified && !r.freeStarter,
    )
      ? [
          "Unrecorded legacy unlocks have no verifiable refund; inspect every removed entry.",
        ]
      : [],
  };
}

function fingerprint(game, quote) {
  return JSON.stringify({
    branchId: quote.branchId,
    currentLevel: quote.currentLevel,
    targetLevel: quote.targetLevel,
    learned: game.player.learned,
    techniques: game.player.techniques || [],
    selection: game.player.enhancementSelection || {},
    removed: quote.removed.map((r) => [
      r.id,
      r.recordId,
      r.cost,
      r.refund,
      r.rate,
    ]),
    currency: quote.currency,
    balance: game.player[wallet(quote.currency)] || 0,
    sessionId: state(game).sessionId,
  });
}

export function recordTrainingPurchase(
  game,
  { branchId, level, techniqueId, cost, currency },
) {
  if (!validCost(cost) || !["good", "bad"].includes(currency)) return false;
  const s = state(game),
    kind = techniqueId ? "technique" : "branch";
  if (
    kind === "branch" &&
    (!branch(branchId) ||
      currency !== branch(branchId).currency ||
      !Number.isInteger(level) ||
      level < 1 ||
      level > 10)
  )
    return false;
  const technique = techniqueId && TECHNIQUES.find((t) => t.id === techniqueId);
  if (kind === "technique" && (!technique || currency !== technique.currency))
    return false;
  for (const r of s.ledger) {
    if (r.status !== "active") continue;
    if (
      kind === "branch" &&
      r.kind === "branch" &&
      r.branchId === branchId &&
      r.level < level
    )
      r.hadDependents = true;
    if (
      kind === "technique" &&
      r.kind === "branch" &&
      r.level === 1 &&
      branch(r.branchId)?.domain === technique.domain
    )
      r.hadDependents = true;
    if (kind === "technique" && r.kind === "technique") {
      const prior = TECHNIQUES.find((t) => t.id === r.techniqueId);
      if (
        prior?.domain === technique.domain &&
        prior.lineage === technique.lineage &&
        prior.order < technique.order
      )
        r.hadDependents = true;
    }
  }
  s.ledger.push({
    id: serial(s, "training"),
    kind,
    branchId: branchId || null,
    level: level || null,
    techniqueId: techniqueId || null,
    cost,
    currency,
    sessionId: s.sessionId,
    used: false,
    hadDependents: false,
    status: "active",
    purchasedAt: game.time || 0,
  });
  s.preview = null;
  return true;
}

export function recordPowerUse(game, branchId, level) {
  const s = state(game);
  for (const r of s.ledger)
    if (
      r.status === "active" &&
      r.kind === "branch" &&
      r.branchId === branchId &&
      r.level <= level
    )
      r.used = true;
  s.preview = null;
}
export function recordTechniqueUse(game, id) {
  const t = TECHNIQUES.find((t) => t.id === id),
    s = state(game);
  if (!t) return;
  for (const r of s.ledger)
    if (r.status === "active" && r.kind === "technique") {
      const prior = TECHNIQUES.find((p) => p.id === r.techniqueId);
      if (
        prior?.domain === t.domain &&
        prior.lineage === t.lineage &&
        prior.order <= t.order
      )
        r.used = true;
    }
  for (const b of BRANCHES.filter(
    (b) => b.domain === t.domain && game.player.learned?.[b.id],
  ))
    recordPowerUse(game, b.id, 1);
  s.preview = null;
}

export function snapshotRespecialization(game) {
  const s = state(game);
  return {
    respecialization: clone({ ...s, contextReason: contextReason(game) }),
  };
}
export function serializeRespecialization(game) {
  const s = state(game);
  return clone({ ...s, preview: null });
}

export function installRespecialization(GameEngine) {
  if (GameEngine.prototype.__respecializationInstalled) return;
  Object.defineProperty(GameEngine.prototype, "__respecializationInstalled", {
    value: true,
  });
  const wrap = (name, make) => {
    const original = GameEngine.prototype[name];
    if (typeof original === "function")
      GameEngine.prototype[name] = make(original);
  };
  wrap(
    "trainPower",
    (original) =>
      function (id, ...args) {
        const b = branch(id);
        if (!b) return original.call(this, id, ...args);
        const beforeLevel = this.player.learned[id] || 0,
          before = this.player[wallet(b.currency)];
        state(this);
        const result = original.call(this, id, ...args),
          afterLevel = this.player.learned[id] || 0;
        if (result && afterLevel === beforeLevel + 1) {
          recordTrainingPurchase(this, {
            branchId: id,
            level: afterLevel,
            cost: before - this.player[wallet(b.currency)],
            currency: b.currency,
          });
          persist(this);
        }
        return result;
      },
  );
  wrap(
    "trainTechnique",
    (original) =>
      function (id, ...args) {
        const t = TECHNIQUES.find((t) => t.id === id);
        if (!t) return original.call(this, id, ...args);
        const known = this.player.techniques?.includes(id),
          before = this.player[wallet(t.currency)];
        state(this);
        const result = original.call(this, id, ...args);
        if (result && !known && this.player.techniques?.includes(id)) {
          recordTrainingPurchase(this, {
            techniqueId: id,
            cost: before - this.player[wallet(t.currency)],
            currency: t.currency,
          });
          persist(this);
        }
        return result;
      },
  );
  wrap(
    "trainEnhancement",
    (original) =>
      function (id, ...args) {
        const enhancement = ENHANCEMENTS.find((e) => e.id === id),
          before = this.player.enhancements?.[id] || 0;
        const result = original.call(this, id, ...args);
        if (result && enhancement && this.player.enhancements?.[id] > before) {
          for (const r of state(this).ledger)
            if (
              r.status === "active" &&
              r.kind === "branch" &&
              r.branchId === enhancement.branchId &&
              r.level === 1
            )
              r.hadDependents = true;
          state(this).preview = null;
          persist(this);
        }
        return result;
      },
  );
  wrap(
    "resolveCast",
    (original) =>
      function (cast, ...args) {
        const before = this.player.essence,
          result = original.call(this, cast, ...args),
          b = cast?.branch,
          p = cast?.power;
        if (b?.id && p?.level && this.player.essence < before) {
          recordPowerUse(this, b.id, p.level);
          persist(this);
        }
        return result;
      },
  );
  wrap(
    "resolveTechnique",
    (original) =>
      function (cast, ...args) {
        const before = this.player.essence,
          result = original.call(this, cast, ...args),
          id = cast?.technique?.id;
        if (id && this.player.essence < before) {
          recordTechniqueUse(this, id);
          persist(this);
        }
        return result;
      },
  );
  wrap(
    "useTechnique",
    (original) =>
      function (id, ...args) {
        const before = this.player.essence,
          result = original.call(this, id, ...args);
        if (result && this.player.essence < before) {
          recordTechniqueUse(this, id);
          persist(this);
        }
        return result;
      },
  );
  wrap(
    "beginRitual",
    (original) =>
      function (...args) {
        state(this);
        return original.apply(this, args);
      },
  );
  wrap(
    "commitRitual",
    (original) =>
      function (...args) {
        const project = this.worldSystems?.active?.(),
          result = original.apply(this, args);
        if (result && project?.branchId && project.level) {
          recordPowerUse(this, project.branchId, project.level);
          persist(this);
        }
        return result;
      },
  );
  Object.assign(GameEngine.prototype, {
    previewRespecialization(branchId, targetLevel = 0) {
      const s = state(this),
        preview = calculate(this, branchId, Number(targetLevel));
      if (!preview.valid) {
        s.preview = null;
        this.publish?.();
        return preview;
      }
      const quote = { ...preview, id: serial(s, "respec"), status: "pending" };
      quote.fingerprint = fingerprint(this, quote);
      s.preview = clone(quote);
      this.publish?.();
      return clone(quote);
    },
    commitRespecialization(id) {
      const s = state(this),
        quote = s.preview;
      if (!quote || quote.id !== id || quote.status !== "pending")
        return notice(
          this,
          "This respecialization preview is absent or already settled.",
        );
      const current = calculate(this, quote.branchId, quote.targetLevel);
      if (!current.valid || fingerprint(this, current) !== quote.fingerprint)
        return notice(
          this,
          current.reason ||
            "Training, use, equipment, or available resources changed. Inspect a fresh preview.",
        );
      const removed = current.removed;
      // All checks precede mutation; the exact receipt is recorded before persistence.
      if (current.targetLevel)
        this.player.learned[current.branchId] = current.targetLevel;
      else delete this.player.learned[current.branchId];
      const techniqueIds = new Set(
        current.dependentTechniques.map((r) => r.id),
      );
      this.player.techniques = (this.player.techniques || []).filter(
        (id) => !techniqueIds.has(id),
      );
      if (current.unequipEnhancement)
        delete this.player.enhancementSelection[current.unequipEnhancement.id];
      for (const row of removed)
        if (row.recordId) {
          const record = s.ledger.find((r) => r.id === row.recordId);
          record.status = "refunded";
          record.refund = row.refund;
          record.refundedAt = this.time || 0;
        }
      this.player[wallet(current.currency)] += current.refund;
      if (
        this.selectedPower?.branchId === current.branchId &&
        this.selectedPower.level > current.targetLevel
      ) {
        const first =
          BRANCHES.find(
            (b) =>
              b.id === this.player.starterBranch && this.player.learned[b.id],
          ) ||
          BRANCHES.find((b) => native(this, b) && this.player.learned[b.id]) ||
          BRANCHES.find((b) => this.player.learned[b.id]);
        this.selectedPower = current.targetLevel
          ? { branchId: current.branchId, level: current.targetLevel }
          : { branchId: first?.id || current.branchId, level: 1 };
      }
      if (techniqueIds.has(this.selectedTechnique))
        this.selectedTechnique = null;
      quote.status = "settled";
      quote.valid = false;
      const receipt = {
        id: serial(s, "respec-receipt"),
        quoteId: quote.id,
        branchId: current.branchId,
        targetLevel: current.targetLevel,
        currency: current.currency,
        refund: current.refund,
        removed: clone(removed),
        time: this.time || 0,
        lifetimeCredit: false,
      };
      s.receipts.unshift(receipt);
      s.receipts = s.receipts.slice(0, 100);
      this.event?.(
        "success",
        `${current.branchName} respecialized. ${current.refund} ${current.currency} Karma returned; lifetime earnings and rank are unchanged.`,
      );
      persist(this);
      return clone(receipt);
    },
    cancelRespecialization(id) {
      const s = state(this);
      if (!s.preview || s.preview.id !== id || s.preview.status !== "pending")
        return false;
      s.preview.status = "cancelled";
      s.preview.valid = false;
      this.publish?.();
      return true;
    },
  });
}
