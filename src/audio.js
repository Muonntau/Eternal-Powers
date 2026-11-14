/** Original audio: five regional scores and tactile synthesized effects.
 * The context is created only after a player gesture. No autoplay permissions
 * or network services are required; every recording is shipped in /assets.
 */
export const MUSIC_TRACKS = Object.freeze(['sanctuary', 'heaven', 'hell', 'desert', 'water']);
export const AMBIENT_TRACKS = Object.freeze(['ambient-forest', 'ambient-forest-night', 'ambient-water', 'ambient-wind', 'ambient-infernal', 'ambient-rain']);
export const SPELL_FAMILIES = Object.freeze(['love-laugh', 'light-pleasure', 'water-grow', 'air-move', 'hate-clean', 'dark-heal', 'fire-create', 'earth-give', 'hate-cry', 'dark-pain', 'fire-destroy', 'earth-take', 'love-dirty', 'light-harm', 'water-decay', 'air-stop']);
const BASE_SOUNDS = ['cast', 'heal', 'hit', 'loot', 'quest', 'levelup', 'dash', 'click', 'error', 'craft', 'portal', 'death', 'step'];
const SURFACES = ['grass', 'stone', 'sand', 'water'];
const CREATURE_VOICES = ['deer', 'chirp', 'wisp', 'growl', 'demon', 'golem'];
// Imported alternatives are Pixel-boy/Sparklin Labs CC0 assets; their source
// and license travel with the recordings in public/assets/vendor/superpowers.
const VENDOR_ROOT = '/assets/vendor/superpowers';
const IMPORTED_URLS = Object.fromEntries([
  ...['theme-1', 'theme-3', 'theme-6'].map(name => [`imported-${name}`, `${VENDOR_ROOT}/music/${name}.ogg`]),
  ...['forest-ambience', 'monster-1', 'monster-2', 'woosh-1', 'woosh-2', 'victory-2'].map(name => [`imported-${name}`, `${VENDOR_ROOT}/sounds/${name}.wav`]),
]);
const IMPORTED_REGIONAL_SCORES = { sanctuary: 'imported-theme-1', heaven: 'imported-theme-3', hell: 'imported-theme-6', desert: 'imported-theme-3', water: 'imported-theme-1' };
const SOUND_FILES = new Set([...BASE_SOUNDS, ...Object.keys(IMPORTED_URLS).filter(name => !/theme|forest-ambience/.test(name)), ...SURFACES.map(x => `footstep-${x}`), ...CREATURE_VOICES.map(x => `creature-${x}`), ...SPELL_FAMILIES.flatMap(x => ['cast', 'release', 'hit'].map(stage => `spell-${x}-${stage}`))]);
const DOMAIN_FAMILIES = { love: 'love-laugh', light: 'light-pleasure', water: 'water-grow', air: 'air-move', hate: 'hate-clean', dark: 'dark-heal', fire: 'fire-create', earth: 'earth-give', laugh: 'love-laugh', pleasure: 'light-pleasure', grow: 'water-grow', move: 'air-move', clean: 'hate-clean', heal: 'dark-heal', create: 'fire-create', give: 'earth-give', cry: 'hate-cry', pain: 'dark-pain', destroy: 'fire-destroy', take: 'earth-take', dirty: 'love-dirty', harm: 'light-harm', decay: 'water-decay', stop: 'air-stop' };
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const slug = value => String(value?.id || value?.name || value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const HEAVEN_ZONES = new Set(['ethereal-sanctuary', 'divine-cities', 'halls-of-knowledge',
  'ethereal-libraries', 'ethereal-gardens', 'palatial-halls', 'celestial-palaces',
  'astral-observatory', 'celestial-observatories', 'eternal-light-fields',
  'iridescent-temples', 'translucent-bridges']);
const HELL_ZONES = new Set(['infernal-abyss', 'malevolent-citadels', 'realm-of-eternal-conflict',
  'pits-of-suffering', 'forsaken-wastelands', 'chaos-chasms', 'malevolence-forest',
  'pits-of-despair', 'infernal-strongholds', 'infernal-gates', 'dark-spire-towers',
  'tormented-ruins', 'suffering-labyrinths']);

/** Accept zone IDs, names, renderer biome names, or a zone descriptor. */
export function resolveMusicTrack(value = 'sanctuary') {
  const descriptor = typeof value === 'object' && value ? value : { id: value };
  const id = String(descriptor.id || descriptor.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const hints = `${descriptor.realm || ''} ${descriptor.biome || ''} ${descriptor.variant || ''}`.toLowerCase();
  if (HELL_ZONES.has(id) || /hell|infernal|lava|obsidian|corrupt|abyss|chaos/.test(`${id} ${hints}`)) return 'hell';
  if (/waterfall|prismatic|lakes|water|coast|ocean/.test(id)) return 'water';
  if (/desert|pyramid|dune|sand/.test(`${id} ${hints}`)) return 'desert';
  if (HEAVEN_ZONES.has(id) || /heaven|ethereal|iridescent|floating/.test(`${id} ${hints}`)) return 'heaven';
  if (/waterfall|water|coast|ocean/.test(hints)) return 'water';
  return 'sanctuary';
}

export function resolveSpellFamily(value) {
  const key = slug(value).replace(/-\d+$/, '');
  return SPELL_FAMILIES.includes(key) ? key : DOMAIN_FAMILIES[key] || null;
}

export function resolveFootstepMaterial(value) {
  const key = slug(value);
  if (/water|river|lake|mud|wet|swamp|pool|stream/.test(key)) return 'water';
  if (/sand|desert|dune|snow|ash/.test(key)) return 'sand';
  if (/stone|path|marble|obsidian|brick|tile|city|courtyard|wood|bridge/.test(key)) return 'stone';
  return 'grass';
}

export function resolveCreatureVoice(value) {
  const key = slug(value);
  if (/deer|fox|rabbit|stag/.test(key)) return 'deer';
  if (/bird|moth|firefly|cherubling|familiar|chirp/.test(key)) return 'chirp';
  if (/hound|wolf|beast|stalker|growl/.test(key)) return 'growl';
  if (/golem|guardian|earth-keeper|warden|titan|executioner/.test(key)) return 'golem';
  if (/imp|demon|infernal|hell|succub|incub|harvest|diabolic/.test(key)) return 'demon';
  return 'wisp';
}

/** Pure routing is also usable by encounter code when it needs to preview a cue. */
export function resolveSound(name = 'click', options = {}, world = {}) {
  const aliases = { attack: 'cast', spell: 'cast', fire: 'cast', water: 'heal', collect: 'loot', gather: 'loot', pickup: 'loot', coin: 'loot', level: 'levelup', rank: 'levelup', levelUp: 'levelup', success: 'quest', purchase: 'craft', buy: 'craft', trade: 'loot', select: 'click', ui: 'click', move: 'step', footstep: 'step', damage: 'hit', impact: 'hit', defeat: 'death', fail: 'error', teleport: 'portal', interact: 'click', build: 'craft', prepare: 'cast', 'spell-cast': 'cast', 'spell-hit': 'hit', 'spell-release': 'release' };
  const normalized = aliases[name] || name;
  const family = resolveSpellFamily(options.branchId || options.family || options.powerId);
  let sound = normalized;
  if (family && ['cast', 'hit', 'release'].includes(normalized)) sound = `spell-${family}-${normalized}`;
  else if (['step', 'splash'].includes(normalized)) sound = `footstep-${resolveFootstepMaterial(normalized === 'splash' ? 'water' : options.material || options.terrain || world.terrain)}`;
  else if (['creature', 'vocal', 'roar', 'chirp', 'growl'].includes(normalized)) sound = `creature-${resolveCreatureVoice(options.creatureType || options.sprite || options.family || normalized)}`;
  else if (normalized === 'release') sound = 'cast';
  if (options.imported || options.palette === 'imported') {
    if (sound.startsWith('creature-')) sound = /demon|golem/.test(sound) ? 'imported-monster-2' : 'imported-monster-1';
    else if (sound.startsWith('spell-')) sound = normalized === 'cast' ? 'imported-woosh-1' : 'imported-woosh-2';
    else if (['quest', 'levelup'].includes(sound)) sound = 'imported-victory-2';
  }
  if (!SOUND_FILES.has(sound)) sound = 'click';
  const level = clamp(Number(options.level) || 1, 1, 10);
  const isSpell = sound.startsWith('spell-');
  const isStep = sound.startsWith('footstep-');
  const isCreature = sound.startsWith('creature-');
  return { sound, family, level, pitch: clamp(Number(options.pitch) || (isSpell ? 1 + (level - 1) * .023 : isStep ? .94 + Math.random() * .12 : 1), .3, 3), volume: clamp(Number(options.volume ?? (isStep ? .42 : isCreature ? .54 : isSpell ? .72 + (level - 1) * .018 : .8)), 0, 1.4), throttle: isStep ? .12 : isCreature ? 1.5 : .028 };
}

export class AudioEngine {
  constructor() {
    this.enabled = false;
    this.musicEnabled = false;
    this.context = null;
    this.buffers = new Map();
    this.pending = new Map();
    this.biome = 'sanctuary';
    this.scoreMode = 'original';
    this.natureAmbience = true;
    this.musicSource = null;
    this.currentTrack = null;
    this.musicVoices = new Set();
    this.musicRequest = 0;
    this.contextGeneration = 0;
    this.worldState = { biome: 'sanctuary', weather: 'clear', phase: 'day', moving: false, terrain: 'grass' };
    this.ambientVoices = new Set();
    this.ambientRequest = 0;
    this.ambientSignature = null;
    this.effectVoices = new Set();
    this.lastPlay = new Map();
    this.lastFootstep = -Infinity;
    this.volume = 0.55;
  }

  async unlock() {
    if (typeof window === 'undefined') return;
    try {
      if (!this.context) {
        const Context = window.AudioContext || window.webkitAudioContext;
        if (!Context) return;
        this.context = new Context();
        this.contextGeneration += 1;
        this.master = this.context.createGain();
        this.master.gain.value = this.enabled ? this.volume : 0;
        this.master.connect(this.context.destination);
        this.musicGain = this.context.createGain();
        this.musicGain.gain.value = 0.42;
        this.musicGain.connect(this.master);
        this.sfxGain = this.context.createGain();
        this.sfxGain.gain.value = 0.68;
        this.sfxGain.connect(this.master);
        this.ambientGain = this.context.createGain();
        this.ambientGain.gain.value = .34;
        this.ambientGain.connect(this.master);
      }
      if (this.context.state === 'suspended') await this.context.resume();
      if (this.enabled && this.musicEnabled && !this.musicSource) await this.startMusic();
      if (this.enabled) await this.startAmbience();
    } catch { /* Audio support is optional; gameplay remains available. */ }
  }

  async load(name) {
    if (this.buffers.has(name)) return this.buffers.get(name);
    if (this.pending.has(name)) return this.pending.get(name);
    const context = this.context;
    const generation = this.contextGeneration;
    if (!context) return null;
    const promise = (async () => {
      const response = await fetch(IMPORTED_URLS[name] || `/assets/audio/${name}.${MUSIC_TRACKS.includes(name) || AMBIENT_TRACKS.includes(name) ? 'ogg' : 'wav'}`);
      if (!response.ok || this.context !== context) return null;
      const result = await context.decodeAudioData(await response.arrayBuffer());
      if (this.contextGeneration !== generation || this.context !== context) return null;
      this.buffers.set(name, result);
      return result;
    })().catch(() => null).finally(() => {
      if (this.pending.get(name) === promise) this.pending.delete(name);
    });
    this.pending.set(name, promise);
    return promise;
  }

  async setEnabled(value) {
    this.enabled = Boolean(value);
    this.musicEnabled = this.enabled;
    // An in-flight regional decode must never restart music after muting.
    if (!this.enabled) { this.musicRequest += 1; this.ambientRequest += 1; this.ambientSignature = null; }
    await this.unlock();
    if (this.master && this.context) {
      this.master.gain.setTargetAtTime(this.enabled ? this.volume : 0, this.context.currentTime, 0.15);
    }
    if (this.enabled) await Promise.all([this.startMusic(), this.startAmbience()]);
    return this.enabled;
  }

  toggle() { return this.setEnabled(!this.enabled); }
  setMuted(muted) { return this.setEnabled(!muted); }
  enable() { return this.setEnabled(true); }
  disable() { return this.setEnabled(false); }
  setVolume(value) {
    this.volume = Math.max(0, Math.min(1, value));
    if (this.master && this.enabled) this.master.gain.setTargetAtTime(this.volume, this.context.currentTime, 0.1);
  }
  setScoreMode(mode = 'original') {
    this.scoreMode = mode === 'imported' ? 'imported' : 'original';
    if (this.musicGain && this.context) this.musicGain.gain.setTargetAtTime(this.scoreMode === 'imported' ? .23 : resolveMusicTrack(this.biome) === 'hell' ? .34 : .42, this.context.currentTime, 1);
    return this.enabled && this.context ? this.startMusic() : Promise.resolve();
  }
  setNatureAmbience(enabled = true) {
    this.natureAmbience = Boolean(enabled);
    return this.enabled && this.context ? this.startAmbience() : Promise.resolve();
  }
  setBiome(id) {
    this.biome = id;
    this.worldState.biome = id;
    if (this.musicGain && this.context) {
      this.musicGain.gain.setTargetAtTime(this.scoreMode === 'imported' ? .23 : resolveMusicTrack(id) === 'hell' ? 0.34 : 0.42, this.context.currentTime, 2);
    }
    if (this.enabled && this.context) return Promise.all([this.musicEnabled ? this.startMusic() : null, this.startAmbience()]);
    return Promise.resolve();
  }

  /** Called with game snapshots. Cadence comes from simulation updates, never a timer. */
  updateWorld(update = {}) {
    const previousBiome = this.biome;
    this.worldState = { ...this.worldState, ...update };
    if (update.biome !== undefined) this.biome = update.biome;
    if (!this.enabled || !this.context) return Promise.resolve();
    if (this.musicGain) this.musicGain.gain.setTargetAtTime(this.scoreMode === 'imported' ? .23 : resolveMusicTrack(this.biome) === 'hell' ? .34 : .42, this.context.currentTime, 2);
    const cadence = this.worldState.sprinting ? .23 : .34;
    if (this.worldState.moving && !this.worldState.flying && this.context.currentTime - this.lastFootstep >= cadence) {
      this.lastFootstep = this.context.currentTime;
      void this.play('step', { material: this.worldState.terrain, volume: this.worldState.sprinting ? .48 : .38 });
    }
    return Promise.all([previousBiome !== this.biome && this.musicEnabled ? this.startMusic() : null, this.startAmbience()]);
  }

  ambientLayers() {
    if (!this.natureAmbience) return new Map();
    const track = resolveMusicTrack(this.biome);
    const phase = slug(this.worldState.phase);
    const night = /night|midnight|dusk/.test(phase) || (typeof this.worldState.phase === 'number' && (this.worldState.phase < .18 || this.worldState.phase > .78));
    const weather = slug(this.worldState.weather);
    let primary = track === 'hell' ? 'ambient-infernal' : track === 'water' ? 'ambient-water' : ['desert', 'heaven'].includes(track) ? 'ambient-wind' : night ? 'ambient-forest-night' : 'ambient-forest';
    const layers = new Map([[primary, track === 'hell' ? .74 : night ? .62 : .8]]);
    if (primary.startsWith('ambient-forest')) layers.set('imported-forest-ambience', night ? .035 : .10);
    if (/rain|storm|drizzle|downpour/.test(weather)) layers.set('ambient-rain', /storm|downpour/.test(weather) ? 1 : .62);
    if (/wind|storm|gale|blizzard/.test(weather)) layers.set('ambient-wind', /storm|gale|blizzard/.test(weather) ? .95 : .65);
    return layers;
  }

  async startAmbience() {
    const context = this.context;
    if (!context || !this.enabled) return;
    const layers = this.ambientLayers();
    const signature = [...layers].sort().map(([name, volume]) => `${name}:${volume}`).join('|');
    if (signature === this.ambientSignature) return;
    this.ambientSignature = signature;
    const request = ++this.ambientRequest;
    const decoded = await Promise.all([...layers.keys()].map(async name => [name, await this.load(name)]));
    if (request !== this.ambientRequest || context !== this.context || !this.enabled) return;
    const now = context.currentTime;
    for (const voice of this.ambientVoices) {
      if (voice.stopping) continue;
      if (layers.has(voice.name)) voice.gain.gain.setTargetAtTime(layers.get(voice.name), now, .65);
      else {
        voice.stopping = true;
        if (voice.gain.gain.cancelAndHoldAtTime) voice.gain.gain.cancelAndHoldAtTime(now);
        else { voice.gain.gain.cancelScheduledValues(now); voice.gain.gain.setValueAtTime(voice.gain.gain.value, now); }
        voice.gain.gain.linearRampToValueAtTime(0, now + 1.4);
        voice.source.stop(now + 1.45);
      }
    }
    for (const [name, buffer] of decoded) {
      if (!buffer || [...this.ambientVoices].some(v => v.name === name && !v.stopping)) continue;
      const source = context.createBufferSource(), gain = context.createGain();
      source.buffer = buffer; source.loop = true; source.connect(gain); gain.connect(this.ambientGain);
      gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(layers.get(name), now + 1.4);
      const voice = { name, source, gain, stopping: false }; this.ambientVoices.add(voice);
      source.onended = () => { this.ambientVoices.delete(voice); source.disconnect(); gain.disconnect(); };
      source.start(now);
    }
    if (decoded.some(([, buffer]) => !buffer)) this.ambientSignature = null;
  }

  async startMusic() {
    const request = ++this.musicRequest;
    const context = this.context;
    const region = resolveMusicTrack(this.biome);
    const track = this.scoreMode === 'imported' ? IMPORTED_REGIONAL_SCORES[region] : region;
    if (!context || !this.enabled || !this.musicEnabled) return;
    if (this.currentTrack === track && this.musicSource) return;
    const buffer = await this.load(track);
    if (!buffer || request !== this.musicRequest || context !== this.context || !this.enabled || !this.musicEnabled) return;
    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = buffer;
    source.loop = true;
    source.connect(gain);
    gain.connect(this.musicGain);
    const now = context.currentTime;
    const fade = this.musicSource ? 1.8 : .6;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(1, now + fade);
    // Per-voice envelopes allow smooth transitions without changing effect volume.
    for (const voice of this.musicVoices) {
      if (voice.stopping) continue;
      voice.stopping = true;
      if (typeof voice.gain.gain.cancelAndHoldAtTime === 'function') voice.gain.gain.cancelAndHoldAtTime(now);
      else {
        voice.gain.gain.cancelScheduledValues(now);
        voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
      }
      voice.gain.gain.linearRampToValueAtTime(0, now + fade);
      voice.source.stop(now + fade + .05);
    }
    const voice = { source, gain, track, stopping: false };
    this.musicVoices.add(voice);
    source.onended = () => {
      this.musicVoices.delete(voice);
      source.disconnect();
      gain.disconnect();
      if (this.musicSource === source) {
        this.musicSource = null;
        this.currentTrack = null;
      }
    };
    source.start(now);
    this.musicSource = source;
    this.currentTrack = track;
  }

  async play(name = 'click', options = {}) {
    if (!this.enabled) return;
    await this.unlock();
    if (!this.context) return;
    const cue = resolveSound(name, options, this.worldState);
    const { sound } = cue;
    const key = `${sound}:${options.entityId || options.powerId || ''}`;
    if (this.context.currentTime - (this.lastPlay.get(key) ?? -Infinity) < cue.throttle) return;
    this.lastPlay.set(key, this.context.currentTime);
    const buffer = await this.load(sound);
    if (!buffer || !this.enabled || !this.context) return;
    if (this.effectVoices.size >= 24) {
      const oldest = this.effectVoices.values().next().value;
      this.effectVoices.delete(oldest);
      try { oldest.source.stop(); } catch { /* An effect can finish between updates. */ }
    }
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = cue.pitch;
    const gain = this.context.createGain();
    gain.gain.value = cue.volume;
    source.connect(gain);
    let panner = null;
    if (Number.isFinite(options.pan) && this.context.createStereoPanner) {
      panner = this.context.createStereoPanner(); panner.pan.value = clamp(options.pan, -1, 1); gain.connect(panner); panner.connect(this.sfxGain);
    } else gain.connect(this.sfxGain);
    const voice = { source, gain, panner }; this.effectVoices.add(voice);
    source.start();
    source.onended = () => { this.effectVoices.delete(voice); source.disconnect(); gain.disconnect(); panner?.disconnect(); };
    this.lastSound = { sound, family: cue.family, level: cue.level, pitch: cue.pitch, at: this.context.currentTime };
    return sound;
  }

  destroy() {
    this.musicRequest += 1;
    this.ambientRequest += 1;
    this.ambientSignature = null;
    this.contextGeneration += 1;
    for (const voice of this.musicVoices) {
      voice.source.onended = null;
      try { voice.source.stop(); } catch { /* A fading source may already have ended. */ }
      voice.source.disconnect();
      voice.gain.disconnect();
    }
    this.musicVoices.clear();
    for (const voice of [...this.ambientVoices, ...this.effectVoices]) {
      voice.source.onended = null;
      try { voice.source.stop(); } catch { /* Already completed voices are harmless. */ }
      voice.source.disconnect(); voice.gain.disconnect(); voice.panner?.disconnect();
    }
    this.ambientVoices.clear(); this.effectVoices.clear(); this.lastPlay.clear(); this.lastFootstep = -Infinity;
    this.musicSource = null;
    this.currentTrack = null;
    this.context?.close();
    this.context = null;
    this.buffers.clear();
    this.pending.clear();
  }
}

export const audio = new AudioEngine();
export default audio;
