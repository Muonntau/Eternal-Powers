import test from 'node:test';
import assert from 'node:assert/strict';
import { installProgression, initProgression, updateProgression, snapshotProgression, reputationTier, PROGRESSION_RULES } from './progression.js';

class Harness {
  constructor(saved) {
    this.player = { x: 920, y: 900, maxHealth: 100, health: 100, essence: 100, goodKarma: 750, badKarma: 0, lifetimeGood: 2000, lifetimeBad: 0, rank: 3, lineage: 'angel', inventory: { herb: 3, stone: 4, crystal: 2 }, learned: { 'water-grow': 1 }, equipment: { ward: 'ward' }, statuses: [], reputation: 0, veil: false };
    this.zone = { id: 'sacred-groves' }; this.world = { spawn: { x: 920, y: 900 }, props: [] }; this.time = 0; this.cooldowns = {}; this.targetId = null; this.selectedPower = { branchId: 'water-grow', level: 1 }; this.keys = new Set(); this.events = []; this.conflict = false; this.wear = 100;
    this.entities = [{ id: 'helper', kind: 'npc', name: 'Helpful Pilgrim', x: 940, y: 900, health: 100, maxHealth: 100, factionId: 'pilgrims' }, { id: 'training', kind: 'dummy', name: 'Effigy', x: 990, y: 900, health: 100, maxHealth: 100 }];
    initProgression(this, saved);
  }
  inCombat() { return this.conflict; }
  event(type, text) { this.events.push({ type, text }); }
  save() {} publish() {} effect() {}
  damageEquipment(n) { this.wear -= n; }
  damagePlayer(n) { this.player.health -= n; }
}
installProgression(Harness);
const tick = (g, seconds) => { g.time += seconds; updateProgression(g, seconds); };
const fallen = (g, properties = {}) => { const e = { id: 'fallen-spirit', name: 'Fallen Spirit', kind: 'ally', x: 960, y: 900, dead: true, health: 0, maxHealth: 180, inventory: { crystal: 3 }, ...properties }; g.entities.push(e); g.recordNPCDeath(e); return e; };

test('manual recovery uses 20 seconds downed, four seconds to revive at 25%, and recall at 50%', () => {
  assert.equal(PROGRESSION_RULES.downedSeconds, 20); assert.equal(PROGRESSION_RULES.reviveSeconds, 4); assert.equal(PROGRESSION_RULES.reviveVitality, .25); assert.equal(PROGRESSION_RULES.recallVitality, .5);
});

test('defeat wears equipment once and recalls after 20 seconds while retaining inventory and progression', () => {
  const g = new Harness(), inventory = structuredClone(g.player.inventory), learned = structuredClone(g.player.learned), coins = g.player.goodKarma, lifetime = g.player.lifetimeGood;
  g.player.x = 1700; g.player.y = 1200; assert.equal(g.defeat(), true); assert.equal(g.defeat(), false); assert.equal(g.wear, 90); assert.equal(g.player.health, 0);
  assert.equal(g.useRecoveryRecall(), false); tick(g, 19); assert.equal(g.downed, true); tick(g, 1); assert.equal(g.downed, false); assert.equal(g.player.health, 50); assert.equal(g.player.x, 920); assert.equal(g.player.y, 900);
  assert.deepEqual(g.player.inventory, inventory); assert.deepEqual(g.player.learned, learned); assert.equal(g.player.goodKarma, coins); assert.equal(g.player.lifetimeGood, lifetime);
});

test('downed timer persists as JSON, pauses, and loses two seconds at most once per second when hit', () => {
  const g = new Harness(); g.defeat(); assert.equal(g.recordDownedHit(), true); assert.equal(g.progression.recovery.remaining, 18); assert.equal(g.recordDownedHit(), false); tick(g, .5); assert.equal(g.recordDownedHit(), false); tick(g, .5); assert.equal(g.recordDownedHit(), true); assert.equal(g.progression.recovery.remaining, 15);
  const reloaded = new Harness(JSON.parse(JSON.stringify(g.progression))); assert.equal(reloaded.downed, true); assert.equal(reloaded.player.health, 0); reloaded.paused = true; tick(reloaded, 20); assert.equal(reloaded.progression.recovery.remaining, 15); reloaded.paused = false; tick(reloaded, 15); assert.equal(reloaded.player.health, 50);
});

test('nearby NPC revives a downed player in four seconds at 25% vitality without Essence costs', () => {
  const g = new Harness(); g.defeat(); assert.equal(g.beginRevive(), true); tick(g, 3.9); assert.equal(g.downed, true); tick(g, .1); assert.equal(g.downed, false); assert.equal(g.player.health, 25); assert.equal(g.player.essence, 100); assert.equal(g.wear, 90);
});

test('ordinary revive cancels when an ally moves away and cannot replace resurrection for a dead NPC', () => {
  const g = new Harness(); g.defeat(); g.beginRevive(); g.entities[0].x += 50; tick(g, 1); assert.equal(g.progression.recovery.revive, null); assert.equal(g.downed, true);
  const live = new Harness(); const corpse = fallen(live); assert.equal(live.beginRevive(corpse.id), false);
});

test('Tenebrous Rebirth uses five seconds, 40 Essence and a 60-second cooldown while preserving identity and receipts', () => {
  const g = new Harness(); g.player.learned['dark-heal'] = 7; const entity = fallen(g); entity.extracted = true; entity.resolved = true; const inv = entity.inventory;
  assert.equal(g.canResurrect(entity.id).valid, true); assert.equal(g.resurrectNPC(entity.id), true); tick(g, 4); assert.equal(entity.dead, true); assert.equal(g.player.essence, 100); tick(g, 1);
  assert.equal(entity.dead, false); assert.equal(entity.health, 90); assert.equal(entity.id, 'fallen-spirit'); assert.equal(entity.inventory, inv); assert.equal(entity.extracted, true); assert.equal(entity.resolved, true); assert.equal(g.player.essence, 60); assert.equal(g.cooldowns['dark-heal-7'], 65); assert.equal(g.canResurrect(entity.id).valid, false); assert.equal(g.resurrectNPC(entity.id), false);
});

test('settled resurrection does not charge twice and a stale pending body fails without cost', () => {
  const g = new Harness(); g.player.learned['dark-heal'] = 7; const entity = fallen(g); g.player.essence = 60; g.cooldowns['dark-heal-7'] = 60; assert.equal(g.resurrectNPC(entity.id, { settled: true }), true); assert.equal(g.player.essence, 60);
  const h = new Harness(); h.player.learned['dark-heal'] = 7; const body = fallen(h); h.resurrectNPC(body.id); tick(h, 2); body.dead = false; body.health = 25; tick(h, 1); assert.equal(h.progression.recovery.resurrection, null); assert.equal(h.player.essence, 100); assert.equal(h.cooldowns['dark-heal-7'], undefined);
});

test('resurrection rejects expired, protected, closed, distant and unlearned targets', () => {
  const g = new Harness(); let entity = fallen(g); assert.match(g.canResurrect(entity.id).reason, /Learn/); g.player.learned['dark-heal'] = 7; tick(g, 30); assert.match(g.canResurrect(entity.id).reason, /window/);
  const h = new Harness(); h.player.learned['dark-heal'] = 7; entity = fallen(h, { protected: true }); assert.match(h.canResurrect(entity.id).reason, /protected/); entity.protected = false; h.progression.fallen['sacred-groves:fallen-spirit'].protected = false; entity.unrecoverable = true; assert.match(h.canResurrect(entity.id).reason, /permanently/); entity.unrecoverable = false; entity.x = 2400; assert.match(h.canResurrect(entity.id).reason, /range/);
});

test('cross-affinity certification requires rank 3, cooperation, isolated opposing practice and 500 native Karma', () => {
  const g = new Harness(); assert.equal(g.certifyCrossAffinity(), false); assert.equal(g.recordCooperativeObjective('repair-public-bridge', { type: 'construction' }), true); assert.equal(g.recordCooperativeObjective('repair-public-bridge'), false); const learned = structuredClone(g.player.learned);
  assert.equal(g.beginOpposingPractice('hate-clean'), true); const dummy = g.entities.find(e => e.kind === 'dummy'); assert.equal(g.canUsePractice('hate-clean', dummy), true); assert.equal(g.canUsePractice('hate-clean', g.entities[0]), false); g.selectedPower.level = 2; assert.equal(g.canUsePractice('hate-clean', dummy), false); g.selectedPower.level = 1;
  assert.equal(g.recordPowerPractice('hate-clean', dummy.id), true); assert.deepEqual(g.player.learned, learned); assert.equal(g.progression.certification.practiceTrial, null); assert.equal(g.selectedPower.branchId, 'water-grow'); assert.equal(g.certifyCrossAffinity(), true); assert.equal(g.player.goodKarma, 250); assert.equal(g.player.lifetimeGood, 2000); assert.equal(g.player.certified, true); assert.equal(g.certifyCrossAffinity(), true); assert.equal(g.player.goodKarma, 250);
});

test('isolated practice expires or ends on travel without granting a free opposing branch', () => {
  const g = new Harness(); assert.equal(g.beginOpposingPractice('love-laugh'), false); g.beginOpposingPractice('hate-clean'); tick(g, 120); assert.equal(g.progression.certification.practiceTrial, null); assert.equal(g.player.learned['hate-clean'], undefined); assert.equal(g.progression.certification.practice.length, 0);
  g.beginOpposingPractice('hate-clean'); g.zone.id = 'another'; tick(g, .1); assert.equal(g.progression.certification.practiceTrial, null); assert.equal(g.selectedPower.branchId, 'water-grow');
});

test('Veil requires a two-second transition outside conflict and hostile actions break it immediately', () => {
  const g = new Harness(); g.conflict = true; assert.equal(g.toggleVeil(), false); g.conflict = false; assert.equal(g.toggleVeil(), true); assert.equal(g.player.veil, false); tick(g, 1); assert.equal(g.player.veil, false); tick(g, 1); assert.equal(g.player.veil, true); g.recordWitnessAction({ type: 'attack', hostile: true, incidentId: 'attack-a' }); assert.equal(g.player.veil, false); assert.equal(g.progression.veil.state, 'revealed'); assert.equal(g.progression.veil.witnesses.length, 1); assert.equal(g.getReputation('npc:helper').value, -10);
});

test('suspicious exposure needs three seconds and breaking sight clears an incomplete meter after five seconds', () => {
  const g = new Harness(); g.recordWitnessAction({ type: 'trespass', duration: 30, radius: 500 }); tick(g, 2); assert.equal(g.progression.veil.witnesses.length, 0); assert(Math.abs(snapshotProgression(g).veil.detection - 2 / 3) < .001); g.entities[0].x = 1400; tick(g, 4.9); assert(g.progression.veil.observers['sacred-groves:helper'].meter > 0); tick(g, .1); assert.equal(g.progression.veil.observers['sacred-groves:helper'].meter, 0); assert.equal(g.progression.veil.witnesses.length, 0);
  g.entities[0].x = 940; tick(g, 3); assert.equal(g.progression.veil.witnesses.length, 1); assert.equal(g.progression.veil.observers['sacred-groves:helper'].awareness, 'celestial-aware');
});

test('walls block witnesses and multiple witnesses share one faction penalty per incident', () => {
  const g = new Harness(); g.player.x = 900; g.entities[0].x = 1000; g.world.props.push({ kind: 'wall', blocking: true, x: 950, y: 900, width: 15, height: 120 }); g.recordWitnessAction({ type: 'attack', hostile: true, incidentId: 'concealed' }); assert.equal(g.progression.veil.witnesses.length, 0); assert.equal(g.getReputation('faction:pilgrims').value, 0);
  g.world.props = []; g.entities.push({ id: 'helper2', kind: 'npc', x: 960, y: 930, factionId: 'pilgrims' }); g.recordWitnessAction({ type: 'attack', hostile: true, incidentId: 'seen' }); assert.equal(g.progression.veil.witnesses.length, 2); assert.equal(g.getReputation('faction:pilgrims').value, -10); assert.equal(g.getReputation('npc:helper').value, -10); assert.equal(g.getReputation('npc:helper2').value, -10); g.recordWitnessAction({ type: 'attack', hostile: true, incidentId: 'seen' }); assert.equal(g.getReputation('faction:pilgrims').value, -10);
});

test('standing respects thresholds and one-time restitution costs 25 native Karma without erasing evidence', () => {
  assert.deepEqual([-51, -50, -1, 0, 24, 25, 59, 60].map(reputationTier), ['hostile', 'wary', 'wary', 'neutral', 'neutral', 'trusted', 'trusted', 'allied']); const g = new Harness(); g.setReputation('faction:test', 1000); assert.equal(g.getReputation('faction:test').value, 100); g.setReputation('faction:test', -1000); assert.equal(g.getReputation('faction:test').value, -100);
  g.recordWitnessAction({ type: 'attack', hostile: true, incidentId: 'repair-me', receiptId: 'receipt-kept' }); const life = g.player.lifetimeGood; assert.equal(g.previewRestitution('repair-me').karma, 25); assert.equal(g.negotiate('helper'), true); assert.equal(g.player.goodKarma, 725); assert.equal(g.player.lifetimeGood, life); assert.equal(g.getReputation('npc:helper').value, -5); assert.equal(g.makeRestitution('repair-me'), false); assert.equal(g.negotiate('helper'), false); assert.equal(g.player.goodKarma, 725); assert.equal(g.progression.veil.witnesses[0].receiptId, 'receipt-kept'); assert.equal(g.progression.veil.incidents[0].repaired, true);
});

test('posted material restitution is atomic and rejects invalid quantities', () => {
  const g = new Harness(); g.recordWitnessAction({ type: 'attack', hostile: true, incidentId: 'material', restitution: { materials: { stone: 2, crystal: 1 } } }); assert.equal(g.makeRestitution('material'), true); assert.equal(g.player.inventory.stone, 2); assert.equal(g.player.inventory.crystal, 1); assert.equal(g.player.goodKarma, 750);
  g.recordWitnessAction({ type: 'attack', hostile: true, incidentId: 'invalid', restitution: { materials: { stone: -5 } } }); assert.equal(g.makeRestitution('invalid'), false); assert.equal(g.player.inventory.stone, 2);
});

test('progression snapshot and reload retain fallen identities, evidence and certification requirements as JSON', () => {
  const g = new Harness(); g.recordCooperativeObjective('aid-pilgrim'); g.recordWitnessAction({ type: 'attack', hostile: true, incidentId: 'kept' }); fallen(g); const snapshot = snapshotProgression(g); assert.doesNotThrow(() => JSON.stringify(snapshot)); const reloaded = new Harness(JSON.parse(JSON.stringify(g.progression))); assert.equal(snapshotProgression(reloaded).certification.cooperativeMet, true); assert.equal(reloaded.progression.veil.witnesses.length, 1); assert.equal(Object.keys(reloaded.progression.fallen).length, 1); assert.equal(reloaded.getReputation('npc:helper').value, -10);
});
