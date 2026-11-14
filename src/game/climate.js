/**
 * Private-world calendar, weather fronts, environmental sources and finite field work.
 * Time advances only through update(dt), so pausing and reloading cannot skip costs
 * or reroll a daily objective. One complete calendar day takes 3,600 simulation seconds.
 */
const DAY_LENGTH = 3600;
const TIME_SCALE = 86400 / DAY_LENGTH;
const INITIAL_WORLD_SECONDS = 8 * 3600;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const distance = (a, b) => Math.hypot((a.x || 0) - (b.x || 0), (a.y || 0) - (b.y || 0));
const copy = value => JSON.parse(JSON.stringify(value));
const hash = value => { let h = 2166136261; for (const ch of String(value)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };
const WEATHER = {
  clear: { id: 'clear', label: 'Clear skies', intensity: 0, wind: .12, visibility: 1, description: 'Open ground and ordinary flight lanes are available.' },
  mist: { id: 'mist', label: 'Low mist', intensity: .45, wind: .08, visibility: .75, description: 'Mist softens distant scenery. Inspection and hazard outlines remain visible.' },
  rain: { id: 'rain', label: 'Gentle rain', intensity: .6, wind: .3, visibility: .88, description: 'Rain nourishes the region. Marked water sources may still be unstable.' },
  storm: { id: 'storm', label: 'Gathering storm', intensity: .9, wind: .9, visibility: .7, description: 'Exposed pressure fields are active. Ordinary long-distance flight lanes are closed; shelters remain safe.' },
  embers: { id: 'embers', label: 'Drifting embers', intensity: .65, wind: .42, visibility: .85, description: 'Ash drifts across the region. Only marked fissures cause damage.' },
};

function phaseAt(hour) {
  if (hour >= 5 && hour < 7) return 'dawn';
  if (hour >= 7 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 20) return 'dusk';
  return 'night';
}

export class ClimateSystem {
  constructor(saved = {}) {
    this.elapsed = Math.max(0, Number(saved.elapsed) || 0);
    this.records = copy(saved.records || {});
    this.weatherOverride = saved.weatherOverride ? copy(saved.weatherOverride) : null;
    this.zoneId = saved.zoneId || null;
    this.zone = saved.zone ? copy(saved.zone) : { id: 'sacred-groves', name: 'Sacred Groves', realm: 'Earth', minRank: 1 };
    this._engine = null;
    this._record = null;
    this._hazards = [];
    this._weather = this.weatherFor(this.zone);
    this._sheltered = true;
    this._previousWeather = null;
    this._lastMarker = -100;
  }

  get day() { return Math.floor((INITIAL_WORLD_SECONDS + this.elapsed * TIME_SCALE) / 86400) + 1; }
  get recordKey() { return `${this.day}:${this.zone.id || this.zoneId || 'sacred-groves'}`; }

  clock() {
    const worldSeconds = INITIAL_WORLD_SECONDS + this.elapsed * TIME_SCALE;
    const secondsInDay = worldSeconds % 86400;
    const hour = Math.floor(secondsInDay / 3600), minute = Math.floor(secondsInDay % 3600 / 60);
    return { hour, minute, label: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`, elapsed: this.elapsed, worldSeconds, dayLength: DAY_LENGTH, timeScale: TIME_SCALE };
  }

  weatherFor(zone = this.zone) {
    if (this.weatherOverride && this.weatherOverride.until > this.elapsed) return { ...WEATHER[this.weatherOverride.id], overridden: true };
    const realm = String(zone.realm || '').toLowerCase();
    const front = Math.floor(this.elapsed / 300);
    const types = realm === 'hell' ? ['embers', 'mist', 'embers', 'clear', 'storm'] : realm === 'heaven' ? ['clear', 'mist', 'clear', 'rain', 'clear'] : ['clear', 'rain', 'mist', 'clear', 'storm'];
    const type = this.elapsed < 180 && realm !== 'hell' ? 'clear' : types[hash(`${zone.id}:${this.day}:${front}`) % types.length];
    return { ...WEATHER[type], front, nextChangeIn: 300 - this.elapsed % 300 };
  }

  setWeather(id, duration = 120) {
    if (!WEATHER[id]) return false;
    this.weatherOverride = { id, until: this.elapsed + Math.max(1, Number(duration) || 120) };
    this._weather = this.weatherFor();
    return true;
  }

  ensureRecord(engine) {
    this.zone = { ...(engine?.zone || this.zone) };
    this.zoneId = this.zone.id;
    const key = this.recordKey;
    if (!this.records[key]) {
      const rank = clamp(Math.floor(Number(this.zone.minRank) || 1), 1, 10);
      const prefix = `climate:${key}`;
      this.records[key] = {
        day: this.day, zoneId: this.zone.id, disabledHazards: [], exposures: {}, damageTicks: {},
        events: [
          { id: `${prefix}:investigation`, type: 'investigation', title: 'The Weathered Waystones', description: 'Inspect the northern waystone, compare its eastern twin, then report the pattern to the sanctuary keeper.', actions: ['inspect'], actionLabels: { inspect: 'Inspect the next waystone' }, progress: 0, total: 3, reward: 25 * rank, rank, currency: 'good', position: { x: 1210, y: 620 }, stages: [{ x: 1210, y: 620 }, { x: 1690, y: 930 }, { x: 820, y: 820 }], complete: false, ready: false },
          { id: `${prefix}:gathering`, type: 'gathering', title: 'A Shelter Prepared', description: 'Deliver two Sacred Timber and one Runestone to the public shelter marker. The posted contribution is consumed once.', actions: ['contribute'], actionLabels: { contribute: 'Contribute 2 timber + 1 stone' }, progress: 0, total: 1, reward: 25 * rank, rank, currency: 'good', position: { x: 1180, y: 1080 }, ingredients: { wood: 2, stone: 1 }, complete: false, ready: false },
          { id: `${prefix}:restoration`, type: 'restore', title: 'The Unquiet Spring', description: 'Repair the marked spring using a learned restorative power and 10 Essence, or donate two Moonleaf. The extraction route instead consumes one crystal and exhausts this spring for Bad Karma.', actions: ['restore', 'donate', 'extract'], actionLabels: { restore: 'Restore spring · 10 Essence', donate: 'Donate 2 Moonleaf', extract: 'Exhaust source · 1 crystal · Bad Karma' }, progress: 0, total: 1, reward: 25 * rank, rank, currency: 'good', position: { x: 1620, y: 1210 }, hazardId: `${prefix}:spring-pressure`, complete: false, ready: false },
          { id: `${prefix}:defense`, type: 'defense', title: 'Watch at the Old Crossing', description: 'Inspect the public ward, then resolve its two approaching blights. Return to the ward to settle the posted reward. You may instead reinforce the ward with three Runestones and one crystal.', actions: ['begin', 'reinforce'], actionLabels: { begin: 'Begin the crossing defense', reinforce: 'Reinforce · 3 stone + 1 crystal' }, progress: 0, total: 2, reward: 25 * rank, rank, currency: 'good', position: { x: 1760, y: 1320 }, started: false, guards: [], complete: false, ready: false },
        ],
      };
    }
    this._record = this.records[key];
    if (this._record.shelterBuilt && engine?.entities) {
      const shelterEvent = this._record.events.find(e => e.type === 'gathering');
      if (shelterEvent && !engine.entities.some(e => e.id === `${shelterEvent.id}:shelter`)) engine.entities.push({ id: `${shelterEvent.id}:shelter`, kind: 'shelter', role: 'shelter', sprite: 'shelter', name: 'Prepared Public Shelter', x: shelterEvent.position.x, y: shelterEvent.position.y, shelterRadius: 110, description: 'Public weather shelter. Marked terrain cannot damage occupants.' });
    }
    return this._record;
  }

  isSheltered(engine) {
    const p = engine.player, spawn = engine.world?.spawn || { x: 920, y: 900 };
    if (distance(p, spawn) <= 300) return true;
    const plot = engine.sanctuary?.plot;
    if (plot && engine.zone?.id === plot.zoneId && p.x >= plot.x - 25 && p.x <= plot.x + plot.width + 25 && p.y >= plot.y - 25 && p.y <= plot.y + plot.height + 25) return true;
    if ((p.statuses || []).some(s => s.type === 'shelter' && s.until > engine.time && (!s.position || distance(p, s.position) <= (s.radius || 90)))) return true;
    const shelters = [...(engine.entities || []), ...(engine.world?.props || []), ...(engine.worldSystems?.construction?.structures || [])];
    return shelters.some(s => !s.dead && !s.destroyed && (s.kind === 'shelter' || s.type === 'shelter' || s.role === 'shelter' || s.shelter) && distance(p, s) <= (s.shelterRadius || s.radius || 95));
  }

  hazardDefinitions() {
    const prefix = `climate:${this.recordKey}`, hell = String(this.zone.realm).toLowerCase() === 'hell';
    return [
      { id: `${prefix}:spring-pressure`, name: hell ? 'Fissure Pressure' : 'Unquiet Spring', x: 1655, y: 1155, radius: 59, source: { x: 1620, y: 1210 }, sourceEventId: `${prefix}:restoration`, description: 'A removable environmental source. Gold warns for two seconds; red deals ten vitality each second. Restore or exhaust the marked spring to remove it.', period: 24, activeFor: 7, offset: 6, enabled: true },
      { id: `${prefix}:weather-field`, name: hell ? 'Ember Vent' : 'Storm Pressure', x: 1880, y: 470, radius: 68, source: { x: 1830, y: 530 }, description: 'A weather-driven pressure field. Leave the marked circle, use shelter, or stabilize its source.', period: 20, activeFor: 6, offset: 13, enabled: ['storm', 'embers'].includes(this._weather.id) },
    ];
  }

  update(dt, engine) {
    if (!engine?.player || !Number.isFinite(dt) || dt <= 0 || engine.paused) return;
    this._engine = engine;
    this.elapsed += Math.min(dt, 60);
    const record = this.ensureRecord(engine);
    this._weather = this.weatherFor(this.zone);
    if (this._previousWeather && this._previousWeather !== this._weather.id) engine.event?.('weather', `${this._weather.label} over ${this.zone.name}. ${this._weather.description}`);
    this._previousWeather = this._weather.id;
    this._sheltered = this.isSheltered(engine);
    this._hazards = this.hazardDefinitions().map(h => {
      const cycle = (this.elapsed + h.offset) % h.period;
      const disabled = record.disabledHazards.includes(h.id);
      const state = !h.enabled || disabled ? 'inactive' : cycle < 2 ? 'warning' : cycle < 2 + h.activeFor ? 'active' : 'dormant';
      const near = distance(engine.player, h) <= h.radius;
      // Every new exposure receives its own two-second warning, including entry
      // during the active half of a global hazard cycle. Dodging never resets it.
      if (!near || this._sheltered || disabled || !h.enabled || state === 'dormant') {
        delete record.exposures[h.id]; delete record.damageTicks[h.id];
      } else {
        if (record.exposures[h.id] == null) { record.exposures[h.id] = this.elapsed; record.damageTicks[h.id] = this.elapsed + 2; engine.event?.('warning', `${h.name}: marked terrain will become dangerous. Leave the circle or seek shelter.`); }
        if (state === 'active' && !engine.downed && this.elapsed - record.exposures[h.id] >= 2) {
          const nextTick = record.damageTicks[h.id] || this.elapsed;
          if (this.elapsed >= nextTick) {
            const ticks = Math.min(3, Math.floor(this.elapsed - nextTick) + 1);
            record.damageTicks[h.id] = nextTick + ticks;
            this.applyHazardDamage(10 * ticks, h, engine);
          }
        }
      }
      return { ...h, state, disabled, warning: near && record.exposures[h.id] != null ? Math.max(0, 2 - (this.elapsed - record.exposures[h.id])) : state === 'warning' ? 2 - cycle : 0, damagePerSecond: 10 };
    });
    if (this.elapsed - this._lastMarker >= 1) {
      this._lastMarker = this.elapsed;
      for (const hazard of this._hazards) if (['active', 'warning'].includes(hazard.state) && distance(engine.player, hazard) < 650) engine.effect?.(hazard, 'hazard', hazard.state === 'warning' ? '#e4c47e' : '#df927a', hazard.radius, 1.1);
    }
    this.updateDefense(record, engine);
  }

  applyHazardDamage(amount, hazard, engine) {
    const p = engine.player;
    const wardActive = typeof engine.gearActive === 'function' ? engine.gearActive('ward') : !!p.equipment?.ward;
    const resistance = clamp(Math.max(wardActive ? .1 : 0, ...(p.statuses || []).filter(s => s.type === 'resistance' && s.until > engine.time).map(s => Number(s.amount) || 0)), 0, .5);
    const damage = Math.floor(amount * (1 - resistance));
    // Environmental ticks intentionally ignore direct-hit guard and dodge.
    p.health = Math.max(0, p.health - damage);
    engine.lastDamage = engine.time;
    engine.effect?.(p, 'damage', '#e79b83', 25, .4);
    engine.event?.('damage', `${hazard.name}: −${damage} vitality from marked terrain. Shelter and source removal prevent further ticks.`);
  }

  updateDefense(record, engine) {
    for (const event of record.events) {
      if (event.type !== 'defense' || !event.started || event.complete || !event.guards.length) continue;
      for (const guard of event.guards) {
        let entity = (engine.entities || []).find(n => n.id === guard.id);
        if (!entity && !guard.dead && !guard.resolved) { entity = copy(guard); engine.entities.push(entity); }
        if (entity) Object.assign(guard, { x: entity.x, y: entity.y, health: entity.health, dead: !!entity.dead, resolved: !!entity.resolved || entity.morale >= 80 && entity.status === 'calmed' });
      }
      event.progress = event.guards.filter(g => g.dead || g.resolved).length;
      event.ready = event.progress >= event.total;
      if (event.ready) { event.actions = ['settle']; event.actionLabels = { settle: 'Settle crossing defense' }; }
    }
  }

  inspectEvent(id) {
    const event = this._record?.events.find(e => e.id === id);
    return event ? copy(event) : null;
  }

  advanceEvent(id, action, engine = this._engine) {
    if (!engine || engine.paused || engine.downed) return false;
    const record = this.ensureRecord(engine), event = record.events.find(e => e.id === id);
    if (!event || event.complete) { engine.event?.('info', 'This field objective has already settled or belongs to another day or region.'); return false; }
    if (distance(engine.player, event.position) > 120) { engine.event?.('info', 'Approach the marked field-work location before acting.'); return false; }
    action = String(action || event.actions[0]);
    if (action === 'settle') return this.resolveEvent(id, engine);
    const p = engine.player;
    const consume = ingredients => {
      if (Object.entries(ingredients).some(([item, count]) => (p.inventory?.[item] || 0) < count)) { engine.event?.('info', `Required contribution: ${Object.entries(ingredients).map(([item, count]) => `${count} ${item}`).join(', ')}.`); return false; }
      for (const [item, count] of Object.entries(ingredients)) p.inventory[item] -= count;
      return true;
    };
    if (event.type === 'investigation' && ['inspect', 'observe', 'investigate'].includes(action)) {
      event.progress++;
      if (event.progress < event.total) event.position = { ...event.stages[event.progress] };
      event.actionLabels.inspect = event.progress === 2 ? 'Report the pattern to the keeper' : 'Inspect the next waystone';
      engine.event?.('discovery', event.progress === 1 ? 'Northern inscription recorded. Compare the waystone east of the crossing.' : event.progress === 2 ? 'Both inscriptions match a safe weather interval. Report your evidence to the keeper.' : 'The keeper verifies the recorded weather pattern.');
    } else if (event.type === 'gathering' && ['contribute', 'gather', 'donate'].includes(action)) {
      if (!consume(event.ingredients)) return false;
      event.progress = event.total;
      if (!(engine.entities || []).some(e => e.id === `${event.id}:shelter`)) engine.entities.push({ id: `${event.id}:shelter`, kind: 'shelter', role: 'shelter', sprite: 'shelter', name: 'Prepared Public Shelter', x: event.position.x, y: event.position.y, shelterRadius: 110, description: 'Public weather shelter. Marked terrain cannot damage occupants.' });
      record.shelterBuilt = true;
      engine.event?.('success', 'The public shelter is prepared. Its protected radius is 110 world units.');
    } else if (event.type === 'restore' && ['restore', 'donate', 'extract', 'cleanse'].includes(action)) {
      if (action === 'extract') { if (!consume({ crystal: 1 })) return false; event.currency = 'bad'; event.outcome = 'source-exhausted'; }
      else if (action === 'donate') { if (!consume({ herb: 2 })) return false; event.outcome = 'spring-restored'; }
      else {
        const branch = engine.selectedPower?.branchId;
        if (!['water-grow', 'hate-clean', 'dark-heal', 'earth-give'].includes(branch) || !(p.learned?.[branch] >= (['dark-heal', 'earth-give'].includes(branch) ? 4 : 1))) { engine.event?.('info', 'Use learned Water–Grow or Hate–Clean, or level-4 Dark–Heal / Earth–Give. Two Moonleaf provide an ordinary donation route.'); return false; }
        if (p.essence < 10) { engine.event?.('info', 'Restoring this marked source requires 10 Essence.'); return false; }
        p.essence -= 10; engine.lastAction = engine.time; event.outcome = 'spring-restored';
      }
      if (!record.disabledHazards.includes(event.hazardId)) record.disabledHazards.push(event.hazardId);
      event.progress = event.total;
      engine.effect?.(event.position, 'restore', event.currency === 'bad' ? '#c792aa' : '#b4dab0', 75, 1.5);
      engine.event?.('success', event.currency === 'bad' ? 'The source is exhausted. Its pressure ends, and this destructive outcome is recorded once.' : 'The spring recovers. Its environmental pressure source is disabled for the day.');
    } else if (event.type === 'defense' && action === 'reinforce') {
      if (event.started) { engine.event?.('info', 'This defense is already in progress. Resolve its approaching creatures.'); return false; }
      if (!consume({ stone: 3, crystal: 1 })) return false;
      event.progress = event.total; event.outcome = 'ward-reinforced';
      engine.effect?.(event.position, 'ward', '#b7d6bd', 90, 2);
    } else if (event.type === 'defense' && ['begin', 'defend'].includes(action)) {
      if (event.started) { engine.event?.('info', 'Resolve the two marked blights, then return to settle this defense.'); return false; }
      event.started = true;
      event.guards = [0, 1].map(i => ({ id: `${event.id}:foe-${i}`, climateEventId: event.id, eventOnly: true, x: event.position.x + (i ? 110 : -90), y: event.position.y - 160 - i * 25, home: { x: event.position.x + (i ? 110 : -90), y: event.position.y - 160 - i * 25 }, kind: 'enemy', name: i ? 'Crossing Blight · Wisp' : 'Crossing Blight · Sprite', sprite: i ? 'wisp' : 'slime', health: 42 + event.rank * 14, maxHealth: 42 + event.rank * 14, damage: 8 + event.rank * 2, speed: 60 + i * 12, rank: event.rank, cooldown: 1, morale: 50, state: 'idle', description: 'A finite crossing-defense encounter. Its posted reward settles at the public ward.' }));
      engine.entities.push(...event.guards.map(copy));
      event.actions = ['settle']; event.actionLabels = { settle: 'Settle crossing defense' };
      engine.event?.('quest', 'Two blights approach the old crossing. Resolve them, then return to the ward.');
      this.persist(engine); return true;
    } else { engine.event?.('info', 'That action does not match this objective.'); return false; }
    event.ready = event.progress >= event.total;
    if (event.ready) return this.resolveEvent(id, engine);
    this.persist(engine);
    return true;
  }

  resolveEvent(id, engine = this._engine) {
    if (!engine || engine.paused || engine.downed) return false;
    const record = this.ensureRecord(engine), event = record.events.find(e => e.id === id);
    if (!event || event.complete) return false;
    this.updateDefense(record, engine);
    if (event.progress < event.total) { engine.event?.('info', 'Complete the posted steps before settling this field objective.'); return false; }
    if (distance(engine.player, event.position) > 120) { engine.event?.('info', 'Return to the marked objective location to settle its reward.'); return false; }
    // Receipt and progress are stored before the engine persists, preventing a
    // second claim through repeated clicks, returning to the zone or reloading.
    event.complete = true; event.ready = false; event.settledAt = this.elapsed; event.actions = [];
    const p = engine.player, bad = event.currency === 'bad';
    const eligible = !!p.certified || (bad === (p.lineage === 'demon'));
    if (eligible) { p[bad ? 'badKarma' : 'goodKarma'] = (p[bad ? 'badKarma' : 'goodKarma'] || 0) + event.reward; p[bad ? 'lifetimeBad' : 'lifetimeGood'] = (p[bad ? 'lifetimeBad' : 'lifetimeGood'] || 0) + event.reward; }
    p.xp = (p.xp || 0) + event.reward;
    p.reputation = clamp((p.reputation || 0) + (bad ? -5 : 5), -100, 100);
    event.receipt = { id: event.id, currency: event.currency, amount: eligible ? event.reward : 0, eligible, outcome: event.outcome || event.type, day: this.day, zoneId: this.zone.id };
    engine.event?.('quest', `${event.title} complete · ${eligible ? `+${event.reward} ${bad ? 'Bad' : 'Good'} Karma` : 'opposing outcome recorded; cross-affinity certification is required for its currency'}.`);
    engine.tryRankUp?.();
    this.persist(engine);
    return true;
  }

  disableHazard(id, engine = this._engine) {
    if (!engine || engine.paused || engine.downed) return false;
    const record = this.ensureRecord(engine), hazard = this.hazardDefinitions().find(h => h.id === id);
    if (!hazard || record.disabledHazards.includes(id)) return false;
    if (distance(engine.player, hazard.source) > 120) { engine.event?.('info', 'Approach the pressure source to stabilize it.'); return false; }
    if (hazard.sourceEventId) return this.advanceEvent(hazard.sourceEventId, 'restore', engine);
    if ((engine.player.inventory?.stone || 0) < 1) { engine.event?.('info', 'A Runestone is required to stabilize this weather source.'); return false; }
    engine.player.inventory.stone--;
    record.disabledHazards.push(id);
    engine.effect?.(hazard.source, 'ward', '#c3d8af', 65, 1.5);
    engine.event?.('success', `${hazard.name} stabilized. No progression reward is attached to this ordinary safety repair.`);
    this.persist(engine);
    return true;
  }

  persist(engine) { engine.save?.(false); engine.publish?.(); }

  snapshot() {
    const clock = this.clock(), events = this._record?.events || this.records[this.recordKey]?.events || [];
    return { clock, day: this.day, phase: phaseAt(clock.hour), weather: { ...this._weather }, sheltered: this._sheltered, travel: { flightLanesOpen: this._weather.id !== 'storm', groundRoutesOpen: true }, hazards: copy(this._hazards), events: copy(events), completedToday: events.filter(e => e.complete).length, dayLength: DAY_LENGTH, timeScale: TIME_SCALE };
  }

  serialize() {
    return { version: 1, elapsed: this.elapsed, zoneId: this.zoneId, zone: copy(this.zone), records: copy(this.records), weatherOverride: this.weatherOverride ? { ...this.weatherOverride } : null };
  }
}

export const CLIMATE_RULES = { dayLength: DAY_LENGTH, timeScale: TIME_SCALE, initialHour: 8, hazardWarning: 2, hazardDamagePerSecond: 10, sanctuaryRadius: 300, weatherFrontLength: 300 };
