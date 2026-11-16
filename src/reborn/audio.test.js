import test from "node:test";
import assert from "node:assert/strict";
import { RebornAudio, resolveBiome, resolveCue } from "./audio.js";
class Param {
  value = 0;
  setValueAtTime(value) {
    this.value = value;
  }
  setTargetAtTime(value) {
    this.value = value;
  }
  exponentialRampToValueAtTime(value) {
    this.value = value;
  }
}
class Node {
  gain = new Param();
  frequency = new Param();
  detune = new Param();
  Q = new Param();
  pan = new Param();
  threshold = new Param();
  knee = new Param();
  ratio = new Param();
  attack = new Param();
  release = new Param();
  connect() {}
  disconnect() {
    this.disconnected = true;
  }
  start() {
    this.started = true;
  }
  stop() {
    this.stopped = true;
  }
}
class Context {
  static created = 0;
  currentTime = 0;
  sampleRate = 44100;
  state = "suspended";
  destination = new Node();
  nodes = [];
  constructor() {
    Context.created++;
  }
  resume() {
    this.state = "running";
    return Promise.resolve();
  }
  close() {
    this.state = "closed";
    return Promise.resolve();
  }
  node() {
    const node = new Node();
    this.nodes.push(node);
    return node;
  }
  createGain() {
    return this.node();
  }
  createDynamicsCompressor() {
    return this.node();
  }
  createOscillator() {
    return this.node();
  }
  createBufferSource() {
    return this.node();
  }
  createBiquadFilter() {
    return this.node();
  }
  createStereoPanner() {
    return this.node();
  }
  createBuffer(channels, length) {
    return { getChannelData: () => new Float32Array(length) };
  }
}
test("sound starts only after unlock and disabled audio never creates a context", async () => {
  const before = Context.created,
    audio = new RebornAudio({ contextFactory: Context, enabled: false });
  assert.equal(audio.play("cast", { domain: "Fire" }), false);
  assert.equal(audio.context, null);
  assert.equal(await audio.unlock(), false);
  assert.equal(Context.created, before);
  audio.setEnabled(true);
  await audio.unlock();
  assert.equal(audio.context.state, "running");
  assert.equal(Context.created, before + 1);
  assert.ok(audio.activeVoiceCount > 0);
  audio.setEnabled(false);
  assert.equal(audio.activeVoiceCount, 0);
  assert.equal(audio.timer, null);
  assert.equal(audio.play("cast"), false);
  audio.destroy();
});
test("eight elemental sounds and every gameplay cue remain within a strict voice budget", async () => {
  const audio = new RebornAudio({ contextFactory: Context, maxVoices: 16 });
  await audio.unlock();
  for (const domain of [
    "Love",
    "Light",
    "Water",
    "Air",
    "Hate",
    "Dark",
    "Fire",
    "Earth",
  ]) {
    audio.context.currentTime += 0.2;
    assert.equal(audio.play("cast", { domain, level: 9 }), true);
    assert.ok(audio.activeVoiceCount <= 16);
    audio.context.currentTime += 0.2;
    assert.equal(audio.play("impact", { domain }), true);
    assert.ok(audio.activeVoiceCount <= 16);
  }
  for (const type of [
    "pickup",
    "levelup",
    "dash",
    "enemyTelegraph",
    "bossDefeated",
    "chest",
    "defeat",
    "rift",
    "combo",
    "unlock",
    "travel",
    "create",
  ]) {
    audio.context.currentTime += 0.2;
    assert.equal(audio.play(type), true, type);
    assert.ok(audio.activeVoiceCount <= 16);
  }
  audio.stop();
  assert.equal(audio.activeVoiceCount, 0);
  assert.equal(audio.timer, null);
  audio.destroy();
  assert.equal(audio.context, null);
});
test("routing distinguishes elemental identity, biome moods and hit-frequency limits", async () => {
  assert.deepEqual(resolveCue("cast", { branchId: "water-decay" }), {
    cue: "cast",
    domain: "water",
  });
  assert.deepEqual(resolveCue("enemyTelegraph"), {
    cue: "telegraph",
    domain: "light",
  });
  assert.equal(resolveBiome("infernal-gates"), "hell");
  assert.equal(resolveBiome("prismatic-waterfalls"), "water");
  assert.equal(resolveBiome("city-of-stars"), "cosmic");
  assert.equal(resolveBiome("celestial-observatories"), "heaven");
  const audio = new RebornAudio({ contextFactory: Context });
  await audio.unlock();
  assert.equal(audio.play("impact"), true);
  assert.equal(audio.play("impact"), false);
  audio.context.currentTime += 0.05;
  assert.equal(audio.play("impact"), true);
  audio.setPaused(true);
  assert.equal(audio.play("cast"), false);
  assert.equal(audio.activeVoiceCount, 0);
  audio.setPaused(false);
  assert.ok(audio.timer);
  audio.destroy();
});
