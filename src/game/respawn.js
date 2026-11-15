/** Renewable wilderness populations. Story identities, offerings and chests stay finite. */
const clone = (value) => structuredClone(value);
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const fresh = () => ({ version: 1, zones: {} });
const restoreEntity = (entity, saved) => {
  // A fresh generation intentionally omits old death/collection flags. Merging
  // would retain those flags from the canonical entity's earlier zone history.
  const value = clone(saved);
  for (const key of Object.keys(entity)) delete entity[key];
  Object.assign(entity, value);
  return entity;
};
export function initRespawns(game, saved) {
  const source = saved || game.respawns;
  game.respawns = source?.version === 1 ? clone(source) : fresh();
  game.respawns.zones ||= {};
  const entries = game.respawns.zones[game.zone?.id] || {};
  for (const n of game.entities || []) {
    const r = entries[n.baseEntityId || n.id];
    if (r?.current) restoreEntity(n, r.current);
    if (r) r.current = n;
  }
  return game.respawns;
}
export function serializeRespawns(game) {
  const state = game.respawns || fresh(),
    entries = state.zones[game.zone?.id] || {};
  for (const n of game.entities || []) {
    const r = entries[n.baseEntityId || n.id];
    if (r) r.current = n;
  }
  return clone(state);
}
const eligible = (n) =>
  n &&
  !n.boss &&
  !n.protected &&
  !n.contractSimulation &&
  !n.training &&
  !n.questItem &&
  !n.story &&
  (n.renewable === true || (n.kind === "enemy" && n.id !== "guardian")) &&
  ["enemy", "resource"].includes(n.kind);
const pristine = (n) => {
  const value = clone(n);
  for (const key of [
    "dead",
    "collected",
    "resolved",
    "rewardedOutcome",
    "deathKey",
    "resurrected",
    "recoverable",
    "harvestConsumed",
    "harvestAuthorized",
    "harvestRemaining",
    "growthStage",
    "attackTarget",
    "activeTell",
    "status",
    "statusUntil",
    "coercedUntil",
    "weakenedUntil",
    "tauntedUntil",
    "redirectUntil",
    "redirectTargetId",
  ])
    delete value[key];
  value.health = value.maxHealth || value.health || 1;
  value.state = "idle";
  value.cooldown = 1;
  return value;
};
export function updateRespawns(game, dt, { players = [game.player] } = {}) {
  const state = game.respawns || initRespawns(game),
    zoneId = game.zone?.id;
  if (!zoneId || !Array.isArray(game.entities)) return;
  const entries = (state.zones[zoneId] ||= {});
  for (const n of game.entities) {
    if (!eligible(n)) continue;
    const base = n.baseEntityId || n.id,
      home = n.home || { x: n.x, y: n.y };
    // Sanctuary supplies are finite; renewable populations belong to wilderness.
    if (game.world?.spawn && distance(home, game.world.spawn) < 330) continue;
    let record = entries[base];
    if (!record)
      record = entries[base] = {
        baseEntityId: base,
        generation: Number(n.spawnGeneration) || 0,
        template: pristine(n),
        home: clone(home),
        remaining: null,
        current: n,
      };
    record.template.renewable = true;
    if (record.current && !n.baseEntityId && record.generation > 0)
      restoreEntity(n, record.current);
    // Keep the live identity connected between ticks and saves. A collection
    // immediately followed by travel must not restore an earlier living copy.
    record.current = n;
    const missing = n.dead || n.collected;
    if (!missing) {
      record.remaining = null;
      continue;
    }
    if (record.remaining == null)
      record.remaining = Math.max(
        5,
        Number(n.respawnSeconds) || (n.kind === "resource" ? 90 : 120),
      );
    record.remaining = Math.max(0, record.remaining - Math.max(0, dt || 0));
    if (
      record.remaining > 0 ||
      players.some((p) => p && distance(p, record.home) < 180) ||
      game.isPositionBlocked?.(record.home.x, record.home.y, {
        radius: n.kind === "enemy" ? 14 : 9,
      })
    )
      continue;
    const next = pristine(record.template);
    record.generation++;
    for (const key of Object.keys(n)) delete n[key];
    Object.assign(n, next, clone(record.home), {
      id: `${base}:spawn:${record.generation}`,
      baseEntityId: base,
      spawnGeneration: record.generation,
      home: clone(record.home),
      renewable: true,
    });
    record.remaining = null;
    record.current = n;
    game.effect?.(
      n,
      "heal",
      n.kind === "resource" ? "#5ee3bd" : "#ad9afa",
      26,
      1,
    );
  }
}
