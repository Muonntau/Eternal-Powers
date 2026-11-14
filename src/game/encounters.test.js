import test from 'node:test';
import assert from 'node:assert/strict';
import { CREATURES, ZONES } from '../data/manual.js';
import { CREATURE_BEHAVIORS, createRegionalEncounters, initializeRegionalEncounters, getEncounterQuestDefs, interactEncounter, updateEncounter, damageEncounter, applyEncounterControl, updateRegionalEncounters, installEncounterMethods } from './encounters.js';

class EncounterHarness {
 constructor(zoneId = 'sacred-groves', rank = 1) {
  this.zone = ZONES.find(z => z.id === zoneId); this.time = 0; this.world = { spawn: { x: 920, y: 900 } };
  this.player = { x: 920, y: 900, rank, health: 100, maxHealth: 100, statuses: [], inventory: { herb: 3, crystal: 3 }, goodKarma: 0, badKarma: 0, lifetimeGood: 0, lineage: 'angel' };
  this.entities = createRegionalEncounters(this.zone, rank, 17); this.messages = []; this.effects = []; this.progressRecords = {}; this.settled = []; this.inConflict = false;
  initializeRegionalEncounters(this);
 }
 event(type, text) { this.messages.push({ type, text }); }
 effect(at, kind, color, radius, duration) { this.effects.push({ ...at, kind, color, radius, duration }); }
 publish() {} save() {} inCombat() { return this.inConflict; }
 damagePlayer(n) { this.player.health = Math.max(0, this.player.health - n); }
 damageEnemy(n, amount, tag) { n.health = Math.max(0, n.health - damageEncounter(this, n, amount, tag)); if (n.health <= 0) n.dead = true; }
 grantBarrier(amount, duration) { this.player.statuses.push({ type: 'ward', barrier: amount, until: this.time + duration }); }
 heal(target, amount) { const before = target.health; target.health = Math.min(target.maxHealth, target.health + amount); return target.health - before; }
 progress(type, amount = 1) {
  for (const q of getEncounterQuestDefs(this).filter(q => q.type === type)) {
   if (this.settled.includes(q.id)) continue;
   this.progressRecords[q.id] = Math.min(q.total, (this.progressRecords[q.id] || 0) + amount);
   if (this.progressRecords[q.id] === q.total) { this.settled.push(q.id); this.player.goodKarma += q.reward; this.player.lifetimeGood += q.reward; }
  }
 }
 resolveEnemy(n, peaceful) { if (n.dead) return; n.dead = true; n.resolved = peaceful ? 'restored' : 'defeated'; this.resolutionCount = (this.resolutionCount || 0) + 1; }
}
installEncounterMethods(EncounterHarness);

test('all thirty manual creatures have behavior profiles and occur in regional encounter generation', () => {
 assert.equal(Object.keys(CREATURE_BEHAVIORS).length, 30);
 const encountered = new Set();
 for (const zone of ZONES) for (let rank = 1; rank <= 10; rank++) for (const entity of createRegionalEncounters(zone, rank, 17)) if (entity.creatureId) encountered.add(entity.creatureId);
 assert.equal(encountered.size, 30);
 for (const c of CREATURES) assert.ok(CREATURE_BEHAVIORS[c.id].behavior, c.name);
});

test('regional placement is deterministic, preserves critical encounter IDs, and has explicit neutral contacts', () => {
 const zone = ZONES.find(z => z.id === 'sacred-groves');
 const a = createRegionalEncounters(zone, 1, 17), b = createRegionalEncounters(zone, 1, 17);
 assert.deepEqual(a, b);
 assert.deepEqual(a.filter(n => n.kind === 'enemy').map(n => n.id), ['blight-1', 'blight-2', 'blight-3', 'guardian']);
 assert.equal(a.find(n => n.id === 'guardian').creatureId, 'elemental-guardians');
 assert.equal(a.find(n => n.id === 'guardian').maxHealth, 210);
 assert.equal(a.filter(n => n.role === 'encounter-contact').length, 2);
 assert.ok(a.filter(n => n.role === 'encounter-contact').every(n => n.neutral));
});

test('visible anchor order resets freely, resolves a guardian once, and survives regional recreation', () => {
 const g = new EncounterHarness(), nodes = g.entities.filter(n => n.kind === 'encounter-node');
 interactEncounter(g, nodes[1]); assert.equal(g.player.encounters.sequence[g.zone.id], 0); assert.equal(g.player.goodKarma, 0);
 for (const n of nodes) interactEncounter(g, n);
 assert.equal(g.player.goodKarma, 25); assert.equal(g.resolutionCount, 1); assert.equal(g.entities.find(n => n.id === 'guardian').resolved, 'restored');
 for (const n of nodes) interactEncounter(g, n);
 assert.equal(g.player.goodKarma, 25); assert.equal(g.resolutionCount, 1);
 g.entities = createRegionalEncounters(g.zone, 1, 17); initializeRegionalEncounters(g);
 assert.ok(g.entities.filter(n => n.kind === 'encounter-node').every(n => n.activated));
});

test('neutral offerings spend exactly the posted resource once and do not mint repeated lifetime credit', () => {
 const g = new EncounterHarness(), n = g.entities.find(n => n.role === 'encounter-contact');
 g.player.x = n.x; g.player.y = n.y; const before = g.player.inventory[n.offer.item];
 assert.equal(g.assistCreature(n.id), true); assert.equal(g.player.inventory[n.offer.item], before - 1); assert.equal(g.player.lifetimeGood, 25);
 assert.equal(g.assistCreature(n.id), false); assert.equal(g.player.inventory[n.offer.item], before - 1); assert.equal(g.player.lifetimeGood, 25);
});

test('enemy telegraph gives a real escape interval and attack misses after leaving the marked location', () => {
 const g = new EncounterHarness(), n = g.entities.find(n => n.id === 'guardian');
 g.player.x = n.x - 70; g.player.y = n.y; g.time = 2;
 updateEncounter(g, n, 2); assert.equal(n.state, 'windup'); assert.equal(g.player.health, 100); assert.ok(n.attackTarget); assert.ok(n.windup > 1);
 g.player.x -= 180; g.time += 2; updateEncounter(g, n, 2);
 assert.equal(n.state, 'recover'); assert.equal(g.player.health, 100);
});

test('resistance tags and finite wards affect actual incoming magnitude', () => {
 const g = new EncounterHarness(), n = g.entities.find(n => n.id === 'guardian');
 n.resistantTag = 'fire'; n.vulnerableTag = 'water';
 assert.equal(damageEncounter(g, n, 100, 'fire'), 80);
 assert.equal(damageEncounter(g, n, 100, 'water'), 120);
 n.encounterBarrier = 30; n.encounterBarrierUntil = 10;
 assert.equal(damageEncounter(g, n, 50, 'physical'), 20); assert.equal(n.encounterBarrier, 0);
 assert.equal(damageEncounter(g, n, 50, 'physical'), 50);
});

test('hard control protects repeated families and three stagger marks interrupt a nonfinal boss action', () => {
 const g = new EncounterHarness(), boss = g.entities.find(n => n.boss), foe = g.entities.find(n => !n.boss && n.kind === 'enemy');
 boss.state = 'windup'; for (let i = 0; i < 3; i++) applyEncounterControl(g, boss, 'stun', 2);
 assert.equal(boss.state, 'recover'); assert.equal(boss.staggerMarks, 0); assert.equal(boss.status, undefined);
 applyEncounterControl(g, foe, 'root', 3); assert.equal(foe.statusUntil, 3);
 g.time = 4; applyEncounterControl(g, foe, 'root', 3); assert.equal(foe.statusUntil, 3);
 g.time = 10; applyEncounterControl(g, foe, 'root', 3); assert.equal(foe.statusUntil, 13);
});

test('world encounter health phases require visible anchor progress rather than skipping transitions with damage', () => {
 const g = new EncounterHarness('realm-of-eternal-conflict', 9), n = g.entities.find(n => n.boss);
 assert.equal(n.creatureId, 'apocalyptic-hellfire-titans');
 n.health -= damageEncounter(g, n, 10000, 'physical'); assert.equal(n.health, Math.ceil(n.maxHealth * 2 / 3));
 assert.equal(damageEncounter(g, n, 10000, 'physical'), 0);
 g.player.encounters.sequence[g.zone.id] = 1;
 n.health -= damageEncounter(g, n, 10000, 'physical'); assert.equal(n.health, Math.ceil(n.maxHealth / 3));
 g.player.encounters.sequence[g.zone.id] = 2;
 n.health -= damageEncounter(g, n, 10000, 'physical'); assert.ok(n.health <= 0);
});

test('one bonded familiar follows and supplies one support pulse per ten seconds', () => {
 const g = new EncounterHarness(), n = g.entities.find(n => n.canBond);
 g.player.x = n.x; g.player.y = n.y;
 assert.equal(g.bondCompanion(n.id), false); assert.equal(g.assistCreature(n.id), true); assert.equal(g.bondCompanion(n.id), true);
 assert.equal(g.entities.filter(n => n.id === 'active-familiar').length, 1);
 g.inConflict = true; g.player.health = 60; g.time = 10; updateRegionalEncounters(g, .1); assert.equal(g.player.health, 70);
 g.time = 11; updateRegionalEncounters(g, .1); assert.equal(g.player.health, 70);
 g.time = 20; updateRegionalEncounters(g, .1); assert.equal(g.player.health, 80);
 g.inConflict = false; assert.equal(g.setCompanionSupport('barrier'), true); g.inConflict = true; g.time = 30; updateRegionalEncounters(g, .1);
 assert.equal(g.player.statuses.find(s => s.type === 'ward').barrier, 10);
});

test('inspection exposes the manual tell, counters, resistance and posted offering without spending', () => {
 const g = new EncounterHarness(), n = g.entities.find(n => n.role === 'encounter-contact'), before = structuredClone(g.player.inventory);
 const card = g.inspectCreature(n.id); assert.equal(card.name, n.name); assert.ok(card.description); assert.ok(card.counterplay); assert.ok(card.noncombat); assert.deepEqual(card.offer, n.offer); assert.deepEqual(g.player.inventory, before);
});
