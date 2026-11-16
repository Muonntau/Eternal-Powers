/** Wilds Reborn's original, asset-free Web Audio score and elemental sound design.
 * No audio context, timer, or voice exists until unlock() follows a player gesture.
 * One shared compressor and a strict voice budget keep dense spell fights bounded.
 */
const clamp = (v, min, max) => Math.max(min, Math.min(max, Number(v) || 0));
const midi = (note) => 440 * 2 ** ((note - 69) / 12);
const DOMAIN = [
  "love",
  "light",
  "water",
  "air",
  "hate",
  "dark",
  "fire",
  "earth",
];
const SCALES = {
  forest: { root: 50, scale: [0, 2, 5, 7, 9], tempo: 82, bright: 1700 },
  water: { root: 53, scale: [0, 2, 4, 7, 9], tempo: 78, bright: 2300 },
  heaven: { root: 57, scale: [0, 2, 4, 7, 11], tempo: 84, bright: 2900 },
  hell: { root: 45, scale: [0, 3, 5, 7, 10], tempo: 94, bright: 1200 },
  desert: { root: 48, scale: [0, 1, 5, 7, 8], tempo: 86, bright: 1800 },
  cosmic: { root: 54, scale: [0, 3, 5, 7, 10], tempo: 80, bright: 2400 },
};
const aliases = {
  spell: "cast",
  "spell-cast": "cast",
  "spell-release": "cast",
  fire: "cast",
  "spell-hit": "impact",
  hit: "impact",
  enemyHit: "impact",
  enemyhit: "impact",
  collect: "pickup",
  loot: "pickup",
  shard: "pickup",
  xp: "pickup",
  coin: "pickup",
  level: "levelup",
  levelUp: "levelup",
  "level-up": "levelup",
  rank: "levelup",
  dodge: "dash",
  blink: "dash",
  enemyTelegraph: "telegraph",
  enemytelegraph: "telegraph",
  windup: "telegraph",
  bossDefeated: "victory",
  bossdefeated: "victory",
  "boss-defeated": "victory",
  bossdeath: "victory",
  bosskill: "victory",
  riftComplete: "victory",
  riftcomplete: "victory",
  kill: "kill",
  enemyDefeated: "kill",
  enemydefeated: "kill",
  enemydeath: "kill",
  chest: "chest",
  openChest: "chest",
  chestOpened: "chest",
  chestopened: "chest",
  travel: "portal",
  teleport: "portal",
  heal: "heal",
  potion: "heal",
  defeat: "death",
  interact: "click",
  equip: "equip",
  unlock: "unlock",
  powerUnlocked: "unlock",
  create: "unlock",
  combo: "combo",
  rift: "rift",
  error: "error",
};
export function resolveBiome(value = "forest") {
  const key = String(
    value?.biome || value?.realm || value?.id || value,
  ).toLowerCase();
  if (
    /hell|infernal|lava|fire|ash|suffering|abyss|blood|damnation|torment/.test(
      key,
    )
  )
    return "hell";
  if (/heaven|celestial|divine|ethereal|sanctuary|seraph|paradise/.test(key))
    return "heaven";
  if (/star|cosmic|astral|nexus|void/.test(key)) return "cosmic";
  if (/desert|dune|sand|arid/.test(key)) return "desert";
  if (/water|coast|river|lake|sea|ocean|falls|marsh|ice|frost/.test(key))
    return "water";
  return "forest";
}
export function resolveCue(type, options = {}) {
  const raw = String(type || "click");
  const cue = aliases[raw] || aliases[raw.toLowerCase()] || raw.toLowerCase();
  const source = String(
    options.domain ||
      options.element ||
      options.power?.domain ||
      options.branchId ||
      options.powerId ||
      options.family ||
      "light",
  ).toLowerCase();
  return {
    cue,
    domain: DOMAIN.find((domain) => source.includes(domain)) || "light",
  };
}

export class RebornAudio {
  constructor({
    enabled = true,
    volume = 0.7,
    musicVolume = 0.45,
    maxVoices = 32,
    contextFactory = null,
  } = {}) {
    this.enabled = enabled;
    this.volume = clamp(volume, 0, 1);
    this.musicVolume = clamp(musicVolume, 0, 1);
    this.maxVoices = clamp(maxVoices, 8, 32);
    this.contextFactory = contextFactory;
    this.context = null;
    this.voices = [];
    this.biome = "forest";
    this.combat = false;
    this.paused = false;
    this.unlocked = false;
    this.timer = null;
    this.step = 0;
    this.nextStep = 0;
    this.lastCue = new Map();
    this.destroyed = false;
    this.visibility = () => {
      if (globalThis.document?.hidden) this.silence();
      else if (this.enabled && !this.paused) this.startMusic();
    };
  }
  async unlock() {
    if (this.destroyed) return false;
    this.unlocked = true;
    if (!this.enabled) return false;
    if (!this.context) {
      const Factory =
        this.contextFactory ||
        globalThis.AudioContext ||
        globalThis.webkitAudioContext;
      if (!Factory) return false;
      try {
        this.context = new Factory();
        const ctx = this.context;
        this.master = ctx.createGain();
        this.master.gain.value = this.volume * 0.55;
        this.music = ctx.createGain();
        this.music.gain.value = this.musicVolume;
        this.sfx = ctx.createGain();
        this.sfx.gain.value = 0.85;
        this.compressor = ctx.createDynamicsCompressor();
        this.compressor.threshold.value = -20;
        this.compressor.knee.value = 22;
        this.compressor.ratio.value = 5;
        this.compressor.attack.value = 0.003;
        this.compressor.release.value = 0.2;
        this.music.connect(this.master);
        this.sfx.connect(this.master);
        this.master.connect(this.compressor);
        this.compressor.connect(ctx.destination);
        this.noiseBuffer = ctx.createBuffer(
          1,
          Math.ceil(ctx.sampleRate * 0.5),
          ctx.sampleRate,
        );
        const samples = this.noiseBuffer.getChannelData(0);
        let brown = 0;
        for (let i = 0; i < samples.length; i++) {
          brown = (brown + (Math.random() * 2 - 1) * 0.12) / 1.02;
          samples[i] = brown * 3;
        }
        globalThis.document?.addEventListener?.(
          "visibilitychange",
          this.visibility,
        );
      } catch {
        this.context = null;
        return false;
      }
    }
    try {
      if (this.context.state === "suspended") await this.context.resume();
      this.startMusic();
      return true;
    } catch {
      return false;
    }
  }
  setEnabled(value) {
    this.enabled = !!value;
    if (!this.enabled) this.silence();
    else if (this.unlocked) this.unlock();
  }
  setVolume(value) {
    this.volume = clamp(value, 0, 1);
    if (this.master && this.context)
      this.master.gain.setTargetAtTime(
        this.volume * 0.55,
        this.context.currentTime,
        0.03,
      );
  }
  setMusicVolume(value) {
    this.musicVolume = clamp(value, 0, 1);
    if (this.music && this.context)
      this.music.gain.setTargetAtTime(
        this.musicVolume,
        this.context.currentTime,
        0.05,
      );
  }
  setBiome(value) {
    this.biome = resolveBiome(value);
  }
  setCombat(value) {
    this.combat = !!value;
  }
  setPaused(value) {
    this.paused = !!value;
    if (this.paused) this.silence();
    else this.startMusic();
  }
  get activeVoiceCount() {
    return this.voices.length;
  }
  get available() {
    return !!this.context && this.enabled && !this.paused && !this.destroyed;
  }
  startMusic() {
    if (!this.available || this.timer || globalThis.document?.hidden) return;
    this.nextStep = this.context.currentTime + 0.08;
    this.schedule();
    this.timer = setInterval(() => this.schedule(), 90);
    this.timer.unref?.();
  }
  schedule() {
    if (!this.available) return;
    const ctx = this.context;
    if (this.nextStep < ctx.currentTime - 0.2)
      this.nextStep = ctx.currentTime + 0.04;
    while (this.nextStep < ctx.currentTime + 0.16) {
      this.musicStep(this.step++, this.nextStep);
      const scene = SCALES[this.biome] || SCALES.forest;
      this.nextStep += 30 / (scene.tempo + (this.combat ? 23 : 0));
    }
  }
  musicStep(step, when) {
    const scene = SCALES[this.biome] || SCALES.forest;
    const beat = 60 / (scene.tempo + (this.combat ? 23 : 0));
    const phrase = Math.floor(step / 16) % 4;
    const root = scene.root + [0, 5, -2, 3][phrase];
    if (step % 8 === 0) {
      for (const interval of [0, 7, 14])
        this.tone(midi(root + interval), when, beat * 4.5, "sine", 0.065, {
          music: true,
          attack: 0.3,
          release: 0.8,
          filter: scene.bright,
        });
      this.tone(midi(root - 12), when, beat * 3.7, "triangle", 0.08, {
        music: true,
        attack: 0.08,
        release: 0.5,
        filter: 500,
      });
    }
    const motif = [0, 2, 4, 2, 1, 3, 4, 1, 0, 4, 3, 2, 1, 2, 4, 3];
    if (step % 2 === 0 || this.combat) {
      const note = root + 12 + scene.scale[motif[step % 16]];
      this.tone(
        midi(note),
        when,
        beat * 0.7,
        "triangle",
        this.combat ? 0.07 : 0.045,
        {
          music: true,
          attack: 0.008,
          release: 0.3,
          pan: Math.sin(step * 1.7) * 0.4,
          filter: scene.bright,
        },
      );
      if (step % 8 === 6)
        this.tone(
          midi(note + 12),
          when + beat * 0.23,
          beat * 0.8,
          "sine",
          0.028,
          { music: true, release: 0.3, pan: -0.3 },
        );
    }
    if (this.combat && step % 4 === 0)
      this.tone(80, when, 0.16, "sine", 0.18, {
        music: true,
        endFrequency: 34,
        attack: 0.003,
        release: 0.08,
      });
    if (this.combat && step % 4 === 2)
      this.noise(when, 0.065, 0.035, 2500, { music: true, highpass: true });
    if (!this.combat && step % 16 === 12)
      this.noise(when, beat * 1.7, 0.012, 1800, { music: true, attack: 0.25 });
  }
  reserve(nodes, source, stopAt) {
    const ctx = this.context;
    while (this.voices.length >= this.maxVoices)
      this.releaseVoice(this.voices[0]);
    const voice = { nodes, source, stopAt };
    this.voices.push(voice);
    source.onended = () => this.releaseVoice(voice, false);
    return voice;
  }
  releaseVoice(voice, stop = true) {
    if (!voice) return;
    const index = this.voices.indexOf(voice);
    if (index >= 0) this.voices.splice(index, 1);
    if (stop)
      try {
        voice.source.stop();
      } catch {}
    voice.source.onended = null;
    for (const node of voice.nodes)
      try {
        node.disconnect();
      } catch {}
  }
  tone(frequency, when, duration, type = "sine", gain = 0.1, options = {}) {
    if (!this.available) return;
    const ctx = this.context,
      start = Math.max(ctx.currentTime, when),
      length = Math.max(0.04, duration);
    const oscillator = ctx.createOscillator(),
      envelope = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(Math.max(20, frequency), start);
    if (options.endFrequency)
      oscillator.frequency.exponentialRampToValueAtTime(
        Math.max(20, options.endFrequency),
        start + length * 0.8,
      );
    if (options.detune) oscillator.detune.value = options.detune;
    const attack = Math.min(length / 3, options.attack || 0.006),
      release = options.release || 0.06;
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(
      Math.max(0.0002, gain),
      start + attack,
    );
    envelope.gain.exponentialRampToValueAtTime(
      0.0001,
      start + length + release,
    );
    const nodes = [oscillator, envelope];
    oscillator.connect(envelope);
    let output = envelope;
    if (options.filter) {
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = options.filter;
      filter.Q.value = 0.5;
      output.connect(filter);
      output = filter;
      nodes.push(filter);
    }
    if (ctx.createStereoPanner && options.pan) {
      const pan = ctx.createStereoPanner();
      pan.pan.value = clamp(options.pan, -1, 1);
      output.connect(pan);
      output = pan;
      nodes.push(pan);
    }
    output.connect(options.music ? this.music : this.sfx);
    this.reserve(nodes, oscillator, start + length + release + 0.02);
    oscillator.start(start);
    oscillator.stop(start + length + release + 0.02);
  }
  noise(when, duration, gain, frequency = 1000, options = {}) {
    if (!this.available) return;
    const ctx = this.context,
      start = Math.max(ctx.currentTime, when),
      length = Math.max(0.025, duration);
    const source = ctx.createBufferSource(),
      filter = ctx.createBiquadFilter(),
      envelope = ctx.createGain();
    source.buffer = this.noiseBuffer;
    source.loop = length > 0.45;
    filter.type = options.highpass ? "highpass" : "bandpass";
    filter.frequency.value = frequency;
    filter.Q.value = 0.7;
    const attack = Math.min(length / 3, options.attack || 0.005);
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(
      Math.max(gain, 0.0002),
      start + attack,
    );
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + length);
    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(options.music ? this.music : this.sfx);
    this.reserve([source, filter, envelope], source, start + length + 0.02);
    source.start(start);
    source.stop(start + length + 0.02);
  }
  play(type = "click", options = {}) {
    if (!this.available || globalThis.document?.hidden) return false;
    const { cue, domain } = resolveCue(type, options),
      now = this.context.currentTime;
    const throttle =
      cue === "impact"
        ? 0.04
        : cue === "pickup"
          ? 0.055
          : cue === "telegraph"
            ? 0.15
            : 0.025;
    if (now - (this.lastCue.get(cue) ?? -Infinity) < throttle) return false;
    this.lastCue.set(cue, now);
    const play = (
      offset,
      duration,
      frequency,
      shape = "sine",
      gain = 0.2,
      extra = {},
    ) => this.tone(frequency, now + offset, duration, shape, gain, extra);
    if (cue === "cast") {
      const strength =
        options.ultimate || (options.level || options.power?.level || 1) >= 8
          ? 1.35
          : 1;
      if (domain === "fire") {
        this.noise(now, 0.21, 0.42 * strength, 800);
        play(0, 0.18, 120, "sawtooth", 0.15, {
          endFrequency: 270,
          filter: 1100,
        });
        play(0.035, 0.13, 530, "triangle", 0.12, { endFrequency: 170 });
      } else if (domain === "water") {
        play(0, 0.2, 620, "sine", 0.3, { endFrequency: 190 });
        play(0.04, 0.16, 960, "sine", 0.16, { endFrequency: 400, pan: 0.2 });
        this.noise(now, 0.14, 0.14, 2000);
      } else if (domain === "air") {
        this.noise(now, 0.32, 0.22, 2900);
        play(0.01, 0.22, 440, "sine", 0.12, { endFrequency: 1100 });
      } else if (domain === "earth") {
        play(0, 0.18, 92, "triangle", 0.4, { endFrequency: 35 });
        this.noise(now + 0.025, 0.17, 0.3, 450);
        play(0.06, 0.12, 140, "sine", 0.14, { endFrequency: 55 });
      } else if (domain === "dark") {
        play(0, 0.28, 164, "triangle", 0.26, {
          endFrequency: 62,
          filter: 1000,
        });
        play(0.03, 0.24, 247, "sine", 0.18, { endFrequency: 98, detune: -11 });
        this.noise(now, 0.12, 0.1, 500);
      } else if (domain === "hate") {
        play(0, 0.16, 330, "sawtooth", 0.14, {
          endFrequency: 110,
          filter: 1500,
        });
        play(0.025, 0.2, 466, "triangle", 0.17, { endFrequency: 155 });
        this.noise(now, 0.1, 0.17, 1300);
      } else if (domain === "love") {
        [0, 4, 7].forEach((n, i) =>
          play(i * 0.035, 0.22, midi(69 + n), "sine", 0.16, {
            release: 0.13,
            pan: (i - 1) * 0.2,
          }),
        );
      } else {
        [0, 7, 12].forEach((n, i) =>
          play(i * 0.018, 0.18, midi(74 + n), "triangle", 0.15, {
            release: 0.1,
            filter: 3300,
          }),
        );
        this.noise(now, 0.05, 0.07, 4800, { highpass: true });
      }
      if (strength > 1) {
        play(0, 0.45, 82, "sine", 0.3, { endFrequency: 42 });
        [0, 7, 12].forEach((n, i) =>
          play(0.08 + i * 0.05, 0.35, midi(62 + n), "triangle", 0.12),
        );
      }
    } else if (cue === "impact") {
      const index = DOMAIN.indexOf(domain),
        base = [480, 880, 420, 660, 190, 140, 110, 75][index];
      play(0, 0.09, base, "triangle", 0.19, {
        endFrequency: base * 0.43,
        filter: 1800,
      });
      this.noise(now, 0.07, 0.16, 600 + index * 200);
    } else if (cue === "pickup") {
      const note = 76 + (Math.floor(now * 5) % 5) * 2;
      play(0, 0.095, midi(note), "sine", 0.13);
      play(0.055, 0.09, midi(note + 7), "triangle", 0.08);
    } else if (cue === "dash") {
      this.noise(now, 0.18, 0.23, 1800);
      play(0, 0.12, 240, "sine", 0.1, { endFrequency: 640 });
    } else if (cue === "damage") {
      play(0, 0.13, 120, "triangle", 0.27, { endFrequency: 52 });
      this.noise(now, 0.1, 0.2, 900);
    } else if (cue === "telegraph") {
      play(0, 0.1, 220, "sine", 0.14);
      play(0.13, 0.07, 330, "triangle", 0.12);
    } else if (cue === "kill") {
      play(0, 0.12, 164, "triangle", 0.23, { endFrequency: 52 });
      this.noise(now, 0.16, 0.14, 560);
      play(0.055, 0.11, 660, "sine", 0.09);
    } else if (["levelup", "victory", "chest", "unlock"].includes(cue)) {
      const notes =
        cue === "victory"
          ? [0, 4, 7, 12, 16, 19, 24]
          : cue === "levelup"
            ? [0, 4, 7, 12, 19]
            : [0, 7, 12];
      notes.forEach((n, i) =>
        play(
          i * 0.075,
          cue === "victory" ? 0.45 : 0.25,
          midi(64 + n),
          "triangle",
          0.13,
          { release: 0.15, filter: 3000 },
        ),
      );
      if (cue === "victory")
        play(0, 0.8, midi(40), "sine", 0.18, { attack: 0.02, release: 0.4 });
    } else if (cue === "combo") {
      [0, 7, 12].forEach((n, i) =>
        play(i * 0.028, 0.16, midi(76 + n), "sine", 0.12, { release: 0.08 }),
      );
      this.noise(now, 0.11, 0.12, 1700);
    } else if (cue === "rift") {
      play(0, 0.7, 98, "sawtooth", 0.12, {
        endFrequency: 49,
        filter: 1000,
        attack: 0.08,
      });
      [0, 3, 7].forEach((n, i) =>
        play(i * 0.12, 0.3, midi(50 + n), "triangle", 0.1),
      );
      this.noise(now, 0.5, 0.13, 850, { attack: 0.08 });
    } else if (cue === "portal") {
      [0, 7, 12, 19].forEach((n, i) =>
        play(i * 0.055, 0.3, midi(55 + n), "sine", 0.14, { release: 0.2 }),
      );
      this.noise(now, 0.45, 0.13, 2000, { attack: 0.08 });
    } else if (cue === "heal") {
      [0, 4, 7].forEach((n, i) =>
        play(i * 0.07, 0.27, midi(67 + n), "sine", 0.15, { release: 0.14 }),
      );
    } else if (cue === "death") {
      [0, -3, -7, -12].forEach((n, i) =>
        play(i * 0.12, 0.25, midi(55 + n), "triangle", 0.15, { filter: 950 }),
      );
    } else if (cue === "error") {
      play(0, 0.08, 160, "triangle", 0.1);
      play(0.1, 0.1, 135, "triangle", 0.08);
    } else if (cue === "equip") {
      play(0, 0.08, 660, "sine", 0.1);
      play(0.05, 0.1, 990, "sine", 0.09);
    } else if (cue === "click")
      play(0, 0.045, 860, "sine", 0.065, { endFrequency: 610 });
    else return false;
    return true;
  }
  silence() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    for (const voice of [...this.voices]) this.releaseVoice(voice);
    this.lastCue.clear();
  }
  stop() {
    this.silence();
  }
  destroy() {
    this.silence();
    this.destroyed = true;
    globalThis.document?.removeEventListener?.(
      "visibilitychange",
      this.visibility,
    );
    if (this.context) {
      try {
        this.context.close();
      } catch {}
    }
    this.context = null;
  }
}
export const audio = new RebornAudio();
export default audio;
