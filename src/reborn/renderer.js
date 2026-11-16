import { assetUrl } from "../assetUrl.js";
import { seededRandom, PALETTES, hash } from "./world.js";
const TAU = Math.PI * 2,
  clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ELEMENTS = {
  fire: "#ffb278",
  water: "#91e7ff",
  air: "#c5b5ff",
  earth: "#c3dfa5",
  dark: "#c6a0ff",
  light: "#fff0a5",
  love: "#ffb4de",
  hate: "#ff8e9f",
};
const colorFor = (n) =>
  n?.color ||
  ELEMENTS[String(n?.element || n?.domain || "").toLowerCase()] ||
  "#a7eced";
function strokeLine(c, points) {
  if (!points?.length) return;
  c.beginPath();
  c.moveTo(points[0].x, points[0].y);
  for (const p of points.slice(1)) c.lineTo(p.x, p.y);
}
/** Painted atlases, depth-sorted scenery, luminous spell trails and readable tells.
 * World coordinates are CSS pixels; DPR affects only backing-store resolution. */
export class RebornRenderer {
  constructor(canvas, game) {
    this.canvas = canvas;
    this.game = game;
    this.ctx = canvas.getContext("2d", { alpha: false });
    this.camera = { x: 0, y: 0, zoom: 1 };
    this.images = new Map();
    this.floor = null;
    this.floorKey = null;
    this.width = 1;
    this.height = 1;
    this.reducedMotion =
      matchMedia?.("(prefers-reduced-motion: reduce)").matches || false;
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();
    for (const key of ["creature-sheet", "environment-sheet", "hero-sheet"])
      this.image(`/assets/v4/${key}.png`);
  }
  image(path) {
    const src = assetUrl(path);
    if (this.images.has(src))
      return this.images.get(src).complete && this.images.get(src).naturalWidth
        ? this.images.get(src)
        : null;
    const im = new Image();
    if (path.includes("ground-sheet"))
      im.onload = () => {
        this.floorKey = null;
      };
    im.src = src;
    this.images.set(src, im);
    return null;
  }
  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.width = Math.max(1, rect.width || innerWidth);
    this.height = Math.max(1, rect.height || innerHeight);
    this.dpr = Math.min(devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
  }
  destroy() {
    this.resizeObserver?.disconnect();
    this.images.clear();
    this.floor = null;
  }
  screenToWorld(clientX, clientY) {
    const r = this.canvas.getBoundingClientRect();
    return {
      x: (clientX - r.left) / this.camera.zoom + this.camera.x,
      y: (clientY - r.top) / this.camera.zoom + this.camera.y,
    };
  }
  worldToScreen(x, y) {
    if (typeof x === "object") ({ x, y } = x);
    return {
      x: (x - this.camera.x) * this.camera.zoom,
      y: (y - this.camera.y) * this.camera.zoom,
    };
  }
  visible(o, pad = 120) {
    return (
      o.x > this.camera.x - pad &&
      o.y > this.camera.y - pad &&
      o.x < this.camera.x + this.width / this.camera.zoom + pad &&
      o.y < this.camera.y + this.height / this.camera.zoom + pad
    );
  }
  glow(c, x, y, r, color, alpha = 0.2) {
    if (r <= 0) return;
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, "transparent");
    c.save();
    c.globalAlpha *= alpha;
    c.fillStyle = g;
    c.fillRect(x - r, y - r, r * 2, r * 2);
    c.restore();
  }
  shadow(c, x, y, r = 22) {
    c.fillStyle = "#071b2390";
    c.beginPath();
    c.ellipse(x, y, r, r * 0.32, 0, 0, TAU);
    c.fill();
  }
  atlas(c, sheet, index, x, y, w, h) {
    const im = this.image(`/assets/v4/${sheet}.png`);
    if (!im) return false;
    const cw = im.width / 4,
      ch = im.height / 4,
      i = ((index % 16) + 16) % 16;
    c.drawImage(
      im,
      (i % 4) * cw + 2,
      Math.floor(i / 4) * ch + 2,
      cw - 4,
      ch - 4,
      x - w / 2,
      y - h,
      w,
      h,
    );
    return true;
  }
  groundPattern(c, index, size = 180) {
    const im = this.image("/assets/v4/ground-sheet.png");
    if (!im) return null;
    const tile = document.createElement("canvas");
    tile.width = tile.height = size * 2;
    const tc = tile.getContext("2d"),
      cw = im.width / 4,
      ch = im.height / 4,
      inset = 6;
    // Mirror a padded atlas cell into a repeating tile so every shared edge
    // meets the same source pixels and neighboring materials cannot bleed in.
    for (let y = 0; y < 2; y++)
      for (let x = 0; x < 2; x++) {
        tc.save();
        tc.translate(x ? size * 2 : 0, y ? size * 2 : 0);
        tc.scale(x ? -1 : 1, y ? -1 : 1);
        tc.drawImage(
          im,
          (index % 4) * cw + inset,
          Math.floor(index / 4) * ch + inset,
          cw - inset * 2,
          ch - inset * 2,
          0,
          0,
          size,
          size,
        );
        tc.restore();
      }
    return c.createPattern(tile, "repeat");
  }
  buildFloor(w) {
    const el = document.createElement("canvas");
    el.width = w.width;
    el.height = w.height;
    const c = el.getContext("2d"),
      p = w.palette || PALETTES.grove,
      rng = seededRandom(w.seed || hash(w.id));
    c.fillStyle = p.ground;
    c.fillRect(0, 0, w.width, w.height);
    const groundIndex =
      {
        grove: 0,
        water: 1,
        desert: 5,
        city: 6,
        heaven: 2,
        hell: 3,
        mountain: 14,
      }[w.biome] ?? 0;
    const ground = this.groundPattern(c, groundIndex, 210),
      road = this.groundPattern(
        c,
        {
          grove: 9,
          water: 9,
          desert: 12,
          city: 6,
          heaven: 10,
          hell: 11,
          mountain: 8,
        }[w.biome] ?? 9,
        160,
      );
    if (ground) {
      c.globalAlpha = 0.78;
      c.fillStyle = ground;
      c.fillRect(0, 0, w.width, w.height);
      c.globalAlpha = 1;
    }
    for (let i = 0; i < 110; i++) {
      const x = rng() * w.width,
        y = rng() * w.height,
        r = 55 + rng() * 180;
      this.glow(c, x, y, r, i % 3 ? p.groundLight : p.groundDark, 0.4);
    }
    for (let i = 0; i < 12000; i++) {
      const x = rng() * w.width,
        y = rng() * w.height;
      c.globalAlpha = 0.1 + rng() * 0.12;
      c.fillStyle = i % 3 ? p.grass : p.groundLight;
      c.beginPath();
      c.ellipse(x, y, 1 + rng() * 3, 1 + rng() * 2, rng() * TAU, 0, TAU);
      c.fill();
    }
    c.globalAlpha = 1;
    for (const path of w.paths || []) {
      c.lineCap = "round";
      c.lineJoin = "round";
      strokeLine(c, path.points);
      c.strokeStyle = p.groundDark;
      c.lineWidth = path.width + 14;
      c.globalAlpha = 0.28;
      c.stroke();
      c.globalAlpha = 1;
      c.strokeStyle = p.path;
      c.lineWidth = path.width;
      c.stroke();
      if (road) {
        c.strokeStyle = road;
        c.lineWidth = path.width - 5;
        c.globalAlpha = 0.85;
        c.stroke();
        c.globalAlpha = 1;
      }
      c.strokeStyle = p.pathLight;
      c.lineWidth = 2;
      c.globalAlpha = 0.24;
      c.setLineDash([6, 14]);
      c.stroke();
      c.setLineDash([]);
      c.globalAlpha = 1;
    }
    const water = w.water;
    if (water) {
      c.lineCap = "round";
      strokeLine(c, water.points);
      c.strokeStyle = p.groundDark;
      c.lineWidth = water.width + 22;
      c.stroke();
      c.strokeStyle = p.waterLight;
      c.lineWidth = water.width + 7;
      c.globalAlpha = 0.65;
      c.stroke();
      c.globalAlpha = 1;
      c.strokeStyle = p.water;
      c.lineWidth = water.width;
      c.stroke();
      const surface = this.groundPattern(c, 4, 170);
      if (surface && water.kind !== "lava") {
        c.strokeStyle = surface;
        c.lineWidth = water.width - 7;
        c.globalAlpha = 0.35;
        c.stroke();
        c.globalAlpha = 1;
      }
      for (let i = 0; i < 150; i++) {
        const a = water.points[Math.floor(rng() * water.points.length)];
        if (!a) continue;
        c.strokeStyle = p.waterLight;
        c.globalAlpha = 0.1 + rng() * 0.2;
        c.lineWidth = 1;
        c.beginPath();
        c.ellipse(
          a.x + (rng() - 0.5) * water.width * 0.75,
          a.y + (rng() - 0.5) * 75,
          8 + rng() * 20,
          1.4,
          0,
          0,
          Math.PI,
        );
        c.stroke();
      }
      c.globalAlpha = 1;
    }
    for (const f of w.features || []) this.drawFeatureFloor(c, f, w);
    // Ground flowers and leaf litter keep the open fighting lanes textured.
    for (let i = 0; i < 1100; i++) {
      const x = rng() * w.width,
        y = rng() * w.height;
      if (
        (w.features || []).some((f) => Math.hypot(f.x - x, f.y - y) < f.radius)
      )
        continue;
      c.globalAlpha = 0.2 + rng() * 0.2;
      c.fillStyle = i % 5 ? p.leaf : p.accent;
      c.fillRect(x, y, 1.2, 2.5);
      if (i % 8 === 0) {
        c.fillStyle = "#e1c4ec";
        c.fillRect(x - 1, y - 3, 3, 2);
      }
    }
    c.globalAlpha = 1;
    this.floor = el;
    this.floorKey = w.id + ":" + w.seed;
  }
  drawFeatureFloor(c, f, w) {
    const p = w.palette || PALETTES.grove,
      x = f.x,
      y = f.y,
      r = f.radius || 85;
    c.save();
    c.translate(x, y);
    if (f.kind === "bridge") {
      c.rotate(-0.08);
      c.fillStyle = p.groundDark;
      c.fillRect(-120, -44, 240, 94);
      c.fillStyle = p.path;
      c.fillRect(-120, -48, 240, 85);
      for (let i = -115; i < 120; i += 24) {
        c.strokeStyle = p.pathLight;
        c.globalAlpha = 0.45;
        c.strokeRect(i, -43, 20, 74);
      }
      c.globalAlpha = 1;
      c.fillStyle = p.stone;
      c.fillRect(-127, -53, 254, 8);
      c.fillRect(-127, 32, 254, 8);
      c.restore();
      return;
    }
    c.fillStyle = p.groundDark;
    c.globalAlpha = 0.3;
    c.beginPath();
    c.ellipse(0, 0, r * 1.05, r * 0.63, 0, 0, TAU);
    c.fill();
    c.globalAlpha = 1;
    c.fillStyle = f.kind === "hub" ? p.path : p.groundLight;
    c.beginPath();
    c.ellipse(0, -5, r, r * 0.6, 0, 0, TAU);
    c.fill();
    const paving = this.groundPattern(
      c,
      w.realm === "hell" ? 11 : w.realm === "heaven" ? 10 : 9,
      160,
    );
    if (paving) {
      c.globalAlpha = 0.62;
      c.fillStyle = paving;
      c.fill();
      c.globalAlpha = 1;
    }
    c.strokeStyle = p.pathLight;
    c.lineWidth = 2;
    c.globalAlpha = 0.5;
    for (const k of [1, 0.84, 0.62]) {
      c.beginPath();
      c.ellipse(0, -5, r * k, r * k * 0.6, 0, 0, TAU);
      c.stroke();
    }
    for (let i = 0; i < 12; i++) {
      const a = (i * TAU) / 12;
      c.beginPath();
      c.moveTo(Math.cos(a) * r * 0.84, Math.sin(a) * r * 0.5 - 5);
      c.lineTo(Math.cos(a) * r, Math.sin(a) * r * 0.6 - 5);
      c.stroke();
    }
    c.globalAlpha = 0.45;
    c.strokeStyle = p.accent;
    c.lineWidth = 1;
    if (f.kind === "rift" || f.kind === "dais") {
      c.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i * TAU) / 6;
        if (!i) c.moveTo(Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.3 - 5);
        else c.lineTo(Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.3 - 5);
      }
      c.closePath();
      c.stroke();
    }
    c.restore();
  }
  drawScenery(c, o, w, t) {
    const p = w.palette || PALETTES.grove,
      k = o.kind,
      x = o.x,
      y = o.y,
      s = o.scale || 1;
    const near = Math.hypot(x - this.game.player.x, y - this.game.player.y);
    c.save();
    if (k === "tree" || k === "thorn") {
      if (
        this.game.player.y < y &&
        Math.abs(this.game.player.x - x) < 65 &&
        y - this.game.player.y < 140
      )
        c.globalAlpha = 0.32;
      this.shadow(c, x, y, 48 * s);
      this.atlas(
        c,
        "environment-sheet",
        w.biome === "hell"
          ? 3
          : w.biome === "heaven"
            ? 2
            : (o.seed || 0) > 0.6
              ? 1
              : 0,
        x,
        y + 10,
        150 * s,
        180 * s,
      );
    } else if (
      k === "rock" ||
      k === "obsidian" ||
      k === "monolith" ||
      k === "dune"
    ) {
      this.shadow(c, x, y, 28 * s);
      this.atlas(
        c,
        "environment-sheet",
        k === "obsidian" ? 7 : 4,
        x,
        y + 8,
        80 * s,
        78 * s,
      );
    } else if (k === "pillar") {
      this.shadow(c, x, y, 23);
      this.atlas(c, "environment-sheet", 9, x, y + 8, 68, 100);
    } else if (k === "crystal") {
      this.shadow(c, x, y, 19);
      this.glow(c, x, y - 24, 45, p.accent, 0.1);
      this.atlas(
        c,
        "environment-sheet",
        w.realm === "hell" ? 6 : 5,
        x,
        y + 8,
        (o.destructible ? 62 : 44) * s,
        (o.destructible ? 76 : 54) * s,
      );
    } else if (k === "explosive") {
      this.shadow(c, x, y, 19);
      this.glow(c, x, y - 17, 33, "#ffc27c", 0.1 + Math.sin(t * 2) * 0.04);
      c.fillStyle = "#733747";
      c.beginPath();
      c.ellipse(x, y - 18, 21, 22, 0, 0, TAU);
      c.fill();
      for (let i = 0; i < 5; i++) {
        c.fillStyle = i % 2 ? "#ed9966" : "#a85a68";
        c.beginPath();
        c.ellipse(
          x + Math.cos(i * 1.26) * 14,
          y - 23 + Math.sin(i * 1.26) * 9,
          7,
          14,
          i * 1.26,
          0,
          TAU,
        );
        c.fill();
      }
      c.fillStyle = "#ffe9a2";
      c.beginPath();
      c.arc(x, y - 22, 6, 0, TAU);
      c.fill();
    } else if (k === "spring") {
      this.glow(c, x, y - 5, 40, "#84e7df", 0.16);
      c.strokeStyle = "#83d8d8";
      c.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        c.beginPath();
        c.ellipse(x, y - i * 5, 24 - i * 5, 9 - i * 2, 0, 0, TAU);
        c.stroke();
      }
    } else if (k === "totem") {
      this.shadow(c, x, y, 22);
      this.atlas(
        c,
        "environment-sheet",
        w.realm === "hell" ? 15 : 14,
        x,
        y + 5,
        55,
        85,
      );
    } else {
      this.atlas(
        c,
        "environment-sheet",
        13,
        x,
        y + 5,
        k === "flower" ? 50 : 42,
        k === "flower" ? 47 : 38,
      );
    }
    if (o.destructible && o.health != null && o.health < o.maxHealth) {
      c.fillStyle = "#152532";
      c.fillRect(x - 20, y - 68, 40, 4);
      c.fillStyle = p.accent;
      c.fillRect(x - 20, y - 68, (40 * o.health) / o.maxHealth, 3);
    }
    if (near < 110 && o.destructible) {
      c.font = "9px Inter,sans-serif";
      c.textAlign = "center";
      c.fillStyle = "#d9e8dc";
      c.fillText(
        k === "explosive"
          ? "EXPLOSIVE SEED"
          : k === "spring"
            ? "LIVING SPRING"
            : k === "totem"
              ? "RESONANCE TOTEM"
              : "POWER CRYSTAL",
        x,
        y + 20,
      );
    }
    c.restore();
  }
  drawArchitecture(c, f, w, t) {
    const p = w.palette || PALETTES.grove;
    if (f.kind === "bridge") return;
    if (!this.visible(f, 220)) return;
    const x = f.x,
      y = f.y,
      r = f.radius || 100;
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2 + 0.5,
        px = x + Math.cos(a) * r * 0.85,
        py = y + Math.sin(a) * r * 0.5;
      this.atlas(
        c,
        "environment-sheet",
        f.kind === "garden" ? 13 : 9,
        px,
        py,
        40,
        64,
      );
    }
    if (f.kind === "ruins") {
      this.atlas(c, "environment-sheet", 8, x, y - 20, 190, 190);
      this.glow(c, x, y - 68, 90, p.accent, 0.06);
    }
    if (f.kind === "hub") {
      this.atlas(c, "environment-sheet", 14, x - 120, y + 40, 66, 98);
      this.atlas(c, "environment-sheet", 8, x + 90, y - 55, 135, 142);
    }
    if (f.kind === "dais" || f.kind === "pyramid") {
      this.atlas(c, "environment-sheet", 12, x, y, 150, 123);
      this.glow(c, x, y - 30, 80, p.accent, 0.06);
    }
    if (f.kind === "garden") {
      for (let i = 0; i < 5; i++) {
        const a = (i * TAU) / 5;
        this.atlas(
          c,
          "environment-sheet",
          13,
          x + Math.cos(a) * 70,
          y + Math.sin(a) * 40,
          65,
          60,
        );
      }
    }
  }
  creatureIndex(n) {
    const s = String(n.creatureId || n.name || "");
    if (n.boss)
      return /hell|infernal|demon|titan|apocalyptic/.test(s)
        ? 13
        : /astral|empyreal|avatar/.test(s)
          ? 14
          : 12;
    if (/imp/.test(s)) return 2;
    if (/hound/.test(s)) return 7;
    if (/shadow|stalker/.test(s)) return 1;
    if (/soul|spirit|torment/.test(s)) return 8;
    if (/warden|guardian|arbiter/.test(s)) return n.elite ? 10 : 9;
    if (/beast/.test(s)) return 0;
    if (/elemental|sage/.test(s)) return 5;
    if (/bard|harmony|familiar|cherub/.test(s)) return 11;
    if (/earth|steward/.test(s)) return 3;
    if (/archdemon|execution/.test(s)) return 10;
    return (n.spriteIndex || hash(s)) % 16;
  }
  drawTelegraph(c, n, t) {
    if (n.dead || !n.telegraph) return;
    const tele = n.telegraph,
      target = tele.target || n;
    const progress = clamp(
      ((this.game.time || 0) - tele.start) /
        Math.max(0.1, tele.until - tele.start),
      0,
      1,
    );
    const radius = tele.radius || 60;
    c.save();
    c.strokeStyle = "#ffbd9f";
    c.fillStyle = "#f975642c";
    c.lineWidth = 1.8;
    if (tele.type === "charge" || tele.type === "line") {
      const dx = target.x - tele.x,
        dy = target.y - tele.y,
        length = Math.hypot(dx, dy) || 1,
        angle = Math.atan2(dy, dx),
        width = tele.type === "charge" ? radius * 2 : 15;
      c.translate(tele.x, tele.y);
      c.rotate(angle);
      c.beginPath();
      c.roundRect(0, -width / 2, length, width, width / 2);
      c.fill();
      c.stroke();
      c.fillStyle = "#ffcba1";
      c.globalAlpha = 0.18 + progress * 0.4;
      c.fillRect(0, -width / 2, length * progress, width);
      c.globalAlpha = 0.9;
      c.beginPath();
      c.moveTo(length - 16, -7);
      c.lineTo(length, -0);
      c.lineTo(length - 16, 7);
      c.stroke();
    } else {
      c.beginPath();
      c.arc(target.x, target.y, radius, 0, TAU);
      c.fill();
      c.stroke();
      c.fillStyle = "#ffb396";
      c.globalAlpha = 0.12 + progress * 0.22;
      c.beginPath();
      c.arc(target.x, target.y, radius * progress, 0, TAU);
      c.fill();
      c.globalAlpha = 0.9;
      c.strokeStyle = "#ffe1b0";
      c.beginPath();
      c.arc(
        target.x,
        target.y,
        radius,
        -Math.PI / 2,
        -Math.PI / 2 + TAU * progress,
      );
      c.stroke();
    }
    c.restore();
  }
  drawEnemy(c, n, t) {
    if (n.dead || !this.visible(n, 140)) return;
    const size = n.boss ? 150 : n.elite ? 104 : 78,
      swing =
        Math.sin(t * (n.state === "chase" ? 12 : 2) + (n.seed || n.x)) *
        (n.state === "chase" ? 3 : 1),
      x = n.x,
      y = n.y;
    this.shadow(c, x, y, size * 0.3);
    c.save();
    if (n.hitUntil > this.game.time) c.globalAlpha = 0.7;
    const slow =
      n.statuses?.some?.(
        (s) => s.type === "chill" && s.until > this.game.time,
      ) || n.chillUntil > this.game.time;
    if (slow) this.glow(c, x, y - 25, 50, "#8bddff", 0.16);
    if (
      n.statuses?.some?.(
        (s) => s.type === "burn" && s.until > this.game.time,
      ) ||
      n.burnUntil > this.game.time
    )
      this.glow(c, x, y - 25, 55, "#ffa161", 0.16);
    const flip = Math.cos(n.facing || 0) < 0 || n.vx < 0;
    c.translate(x, y + swing);
    if (flip) c.scale(-1, 1);
    this.atlas(c, "creature-sheet", this.creatureIndex(n), 0, 8, size, size);
    c.restore();
    const damaged =
      n.health < n.maxHealth ||
      n.state === "chase" ||
      n.state === "windup" ||
      n.elite ||
      n.boss;
    if (damaged) {
      const width = n.boss ? 110 : n.elite ? 70 : 46,
        by = y - size + 7;
      c.fillStyle = "#0c1e2edb";
      c.fillRect(x - width / 2 - 1, by - 1, width + 2, 6);
      c.fillStyle = n.boss ? "#ffc09e" : n.elite ? "#d0b4ff" : "#fb9fa0";
      c.fillRect(
        x - width / 2,
        by,
        width * clamp(n.health / n.maxHealth, 0, 1),
        4,
      );
      if (n.elite || n.boss) {
        c.font = `${n.boss ? "600 11px" : "9px"} Inter,sans-serif`;
        c.fillStyle = n.boss ? "#ffe4c5" : "#e4d5ff";
        c.textAlign = "center";
        c.fillText(n.boss ? n.name : `ELITE · ${n.name}`, x, by - 9);
      }
    }
  }
  drawPlayer(c, p, t) {
    const moving = p.walking || this.game.keys?.size > 0;
    const bob = this.reducedMotion
        ? 0
        : Math.sin(t * (moving ? 13 : 2.5)) * (moving ? 2.5 : 0.7),
      a = p.appearance || {},
      color =
        ELEMENTS[String(p.element || "").toLowerCase()] ||
        {
          cyan: "#8ce9ed",
          violet: "#c6a5ff",
          gold: "#ffe2a6",
          mint: "#b2f3c7",
          rose: "#f3a9d3",
        }[a.auraColor] ||
        "#9de8ed";
    this.shadow(c, p.x, p.y, 23);
    this.glow(c, p.x, p.y - 10, 56, color, 0.08);
    c.save();
    if (p.invulnerableUntil > this.game.time || p.dodgeUntil > this.game.time) {
      c.globalAlpha = 0.72;
      this.glow(c, p.x, p.y - 18, 68, color, 0.3);
    }
    const aim = this.game.aim || { x: p.x + 50, y: p.y },
      angle = Math.atan2(aim.y - p.y, aim.x - p.x);
    const dir =
      Math.abs(Math.cos(angle)) > 0.65
        ? Math.cos(angle) > 0
          ? 3
          : 1
        : Math.sin(angle) > 0
          ? 0
          : 2;
    let row =
      p.lineage === "demon"
        ? 1
        : a.bodyType === "vanguard"
          ? 3
          : a.bodyType === "wanderer"
            ? 2
            : 0;
    if (
      !this.atlas(c, "hero-sheet", row * 4 + dir, p.x, p.y + 10 + bob, 88, 100)
    )
      this.atlas(
        c,
        "creature-sheet",
        p.lineage === "demon" ? 10 : 9,
        p.x,
        p.y + 10 + bob,
        80,
        90,
      );
    c.restore();
    if (p.shield > 0 || p.shieldUntil > this.game.time) {
      c.save();
      c.strokeStyle = color;
      c.lineWidth = 2;
      c.globalAlpha = 0.65;
      c.beginPath();
      c.ellipse(p.x, p.y - 25, 34, 43, 0, 0, TAU);
      c.stroke();
      c.restore();
    }
    if (!this.game.paused) {
      c.save();
      c.strokeStyle = color;
      c.lineWidth = 1.5;
      c.globalAlpha = 0.7;
      const rx = p.x + Math.cos(angle) * 36,
        ry = p.y + Math.sin(angle) * 24;
      c.beginPath();
      c.arc(rx, ry, 5, angle - 0.9, angle + 0.9);
      c.stroke();
      c.restore();
    }
  }
  drawProjectile(c, n, t) {
    const col = colorFor(n),
      r = n.radius || 7;
    c.save();
    const dx = n.vx || Math.cos(n.angle || 0) * 20,
      dy = n.vy || Math.sin(n.angle || 0) * 20,
      a = Math.atan2(dy, dx);
    this.glow(c, n.x, n.y, r * 4, col, 0.18);
    c.translate(n.x, n.y);
    c.rotate(a);
    const trail = c.createLinearGradient(-35, 0, 5, 0);
    trail.addColorStop(0, "transparent");
    trail.addColorStop(0.8, col);
    trail.addColorStop(1, "#ffffff");
    c.fillStyle = trail;
    c.beginPath();
    c.ellipse(-10, 0, 25, r * 0.6, 0, 0, TAU);
    c.fill();
    c.fillStyle = "#fff6dc";
    c.beginPath();
    c.ellipse(0, 0, r * 1.1, r * 0.65, 0, 0, TAU);
    c.fill();
    c.restore();
  }
  drawEffect(c, e, t) {
    const g = this.game,
      time = g.time || 0,
      elapsed = e.age ?? time - (e.start ?? e.createdAt ?? time),
      duration = e.duration || e.life || 0.65,
      k = clamp(elapsed / duration, 0, 1),
      r = e.radius || 60,
      col = colorFor(e);
    if (k >= 1) return;
    c.save();
    c.globalAlpha = (1 - k) * 0.8;
    c.strokeStyle = col;
    c.fillStyle = col;
    c.lineWidth = Math.max(1, 4 * (1 - k));
    const type = e.type || e.kind;
    if (type === "orbit") {
      c.globalAlpha = 0.5 + (1 - k) * 0.3;
      c.lineWidth = 1.5;
      c.beginPath();
      c.arc(e.x, e.y, r, 0, TAU);
      c.stroke();
      for (let i = 0; i < 6; i++) {
        const a = t * 2 + (i * TAU) / 6,
          x = e.x + Math.cos(a) * r,
          y = e.y + Math.sin(a) * r;
        this.glow(c, x, y, 20, col, 0.4);
        c.save();
        c.translate(x, y);
        c.rotate(a + Math.PI / 4);
        c.fillStyle = col;
        c.fillRect(-4, -4, 8, 8);
        c.restore();
      }
    } else if (
      ["beam", "chain", "lightning", "line"].includes(type) ||
      e.from ||
      e.x2 != null
    ) {
      const a = e.from || { x: e.x, y: e.y },
        b = e.to || {
          x: e.x2 ?? e.targetX ?? e.x,
          y: e.y2 ?? e.targetY ?? e.y,
        };
      c.shadowColor = col;
      c.shadowBlur = 14;
      c.beginPath();
      c.moveTo(a.x, a.y);
      if (type === "chain" || type === "lightning") {
        for (let i = 1; i < 7; i++) {
          const q = i / 7;
          c.lineTo(
            a.x + (b.x - a.x) * q + Math.sin(i * 22 + t * 4) * 8,
            a.y + (b.y - a.y) * q + Math.cos(i * 15) * 8,
          );
        }
      }
      c.lineTo(b.x, b.y);
      c.stroke();
      c.shadowBlur = 0;
      c.strokeStyle = "#f8ffff";
      c.lineWidth = 1;
      c.stroke();
    } else if (type === "dash" || type === "trail") {
      this.glow(c, e.x, e.y, r, col, 0.4);
      c.beginPath();
      c.ellipse(e.x, e.y, r * (1 - k), r * 0.45 * (1 - k), 0, 0, TAU);
      c.stroke();
    } else {
      const wave = r * (0.2 + k * 0.8);
      this.glow(c, e.x, e.y, wave, col, 0.12);
      c.beginPath();
      c.ellipse(e.x, e.y, wave, wave * 0.65, 0, 0, TAU);
      c.stroke();
      c.lineWidth = 1;
      c.globalAlpha *= 1 - k;
      c.beginPath();
      c.ellipse(e.x, e.y, wave * 0.7, wave * 0.45, 0, 0, TAU);
      c.stroke();
      for (let i = 0; i < 12; i++) {
        const a = (i * TAU) / 12 + (e.seed || 0);
        c.fillStyle = i % 3 ? col : "#fff6d0";
        const x = e.x + Math.cos(a) * wave,
          y = e.y + Math.sin(a) * wave * 0.65;
        c.fillRect(x - 1, y - 1, 2.5 + 2 * (1 - k), 2.5 + 2 * (1 - k));
      }
    }
    c.restore();
  }
  render(input = this.game, now = performance.now()) {
    if (typeof input === "number") {
      now = input;
      input = this.game;
    }
    if (input?.player) this.game = input;
    const g = this.game,
      w = g.world || g.region;
    if (!w || !g.player) return;
    const c = this.ctx,
      p = g.player,
      t = g.time || 0,
      zoom = this.width < 650 ? 0.9 : 1.1;
    this.camera.zoom = zoom;
    const tx = clamp(
        p.x - this.width / (2 * zoom),
        0,
        Math.max(0, w.width - this.width / zoom),
      ),
      ty = clamp(
        p.y - this.height / (2 * zoom),
        0,
        Math.max(0, w.height - this.height / zoom),
      );
    const initial = !this._cameraReady;
    this.camera.x = initial ? tx : this.camera.x + (tx - this.camera.x) * 0.16;
    this.camera.y = initial ? ty : this.camera.y + (ty - this.camera.y) * 0.16;
    this._cameraReady = true;
    g.camera = { ...this.camera };
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.fillStyle = "#102c35";
    c.fillRect(0, 0, this.width, this.height);
    c.save();
    c.scale(zoom, zoom);
    c.translate(-this.camera.x, -this.camera.y);
    if (this.floorKey !== w.id + ":" + w.seed) this.buildFloor(w);
    c.drawImage(this.floor, 0, 0);
    // A soft, moving sheen makes water and atmosphere feel alive without hiding tells.
    for (const q of w.river || []) {
      if (!this.visible(q, 150)) continue;
      c.save();
      c.strokeStyle = w.palette.waterLight;
      c.globalAlpha = 0.18;
      c.lineWidth = 1;
      c.beginPath();
      c.ellipse(
        q.x + Math.sin(t * 0.4 + q.y) * 12,
        q.y + Math.sin(t + q.y) * 3,
        13,
        2,
        0,
        0,
        Math.PI,
      );
      c.stroke();
      c.restore();
    }
    for (const f of w.features || []) this.drawArchitecture(c, f, w, t);
    const enemies =
      g.enemies ||
      g.entities?.filter((n) => n.kind === "enemy") ||
      w.enemies ||
      [];
    for (const n of enemies)
      if (this.visible(n, 170)) this.drawTelegraph(c, n, t);
    for (const zone of g.fields || g.zones || []) {
      if (!zone.x || !this.visible(zone, 250)) continue;
      this.drawEffect(
        c,
        {
          ...zone,
          duration: zone.duration || 6,
          start: zone.start || t - 0.2,
          type: "field",
        },
        t,
      );
    }
    const props = (g.props || w.props || []).filter(
      (o) =>
        !o.dead &&
        !o.destroyed &&
        !(o.destructible && o.health <= 0) &&
        this.visible(o, 160),
    );
    const chests = g.chests || w.chests || [];
    const drawables = [
      ...props.map((o) => ({
        y: o.y,
        draw: () => this.drawScenery(c, o, w, t),
      })),
      ...enemies
        .filter((n) => !n.dead && n.health > 0 && this.visible(n, 160))
        .map((n) => ({ y: n.y, draw: () => this.drawEnemy(c, n, t) })),
      { y: p.y, draw: () => this.drawPlayer(c, p, t) },
    ];
    for (const chest of chests) {
      if (!this.visible(chest, 100)) continue;
      drawables.push({
        y: chest.y,
        draw: () => {
          this.shadow(c, chest.x, chest.y, 24);
          if (!chest.opened) {
            this.glow(
              c,
              chest.x,
              chest.y - 20,
              44,
              chest.rarity === "epic" ? "#cbb2ff" : "#ffe1a0",
              0.13,
            );
            this.atlas(
              c,
              "environment-sheet",
              10,
              chest.x,
              chest.y + 5,
              60,
              60,
            );
            if (Math.hypot(p.x - chest.x, p.y - chest.y) < 115)
              this.label(
                c,
                chest.bossLocked && !g.progressFor?.().bosses
                  ? "GUARDIAN-SEALED CACHE"
                  : "E · OPEN TREASURE",
                chest.x,
                chest.y - 72,
                "#ffe8be",
              );
          } else {
            c.save();
            c.globalAlpha = 0.35;
            this.atlas(
              c,
              "environment-sheet",
              10,
              chest.x,
              chest.y + 5,
              55,
              50,
            );
            c.restore();
          }
        },
      });
    }
    for (const portal of w.portals || []) {
      if (!this.visible(portal, 140)) continue;
      drawables.push({
        y: portal.y,
        draw: () => {
          this.glow(c, portal.x, portal.y - 40, 80, "#89ebe5", 0.1);
          this.atlas(
            c,
            "environment-sheet",
            11,
            portal.x,
            portal.y + 10,
            100,
            128,
          );
          if (Math.hypot(p.x - portal.x, p.y - portal.y) < 150)
            this.label(
              c,
              "E · REALM GATE",
              portal.x,
              portal.y - 132,
              "#b8f7ed",
            );
        },
      });
    }
    for (const challenge of w.challenges || []) {
      if (!this.visible(challenge, 200)) continue;
      const active = g.rift?.active || g.rift?.state === "active";
      this.glow(c, challenge.x, challenge.y - 8, 90, "#bd9bff", 0.14);
      c.save();
      c.strokeStyle = "#c5abff";
      c.lineWidth = 2;
      c.beginPath();
      c.ellipse(
        challenge.x,
        challenge.y - 6,
        54 + Math.sin(t) * 4,
        32,
        0,
        0,
        TAU,
      );
      c.stroke();
      c.restore();
      if (Math.hypot(p.x - challenge.x, p.y - challenge.y) < 150)
        this.label(
          c,
          active ? "RIFT IN PROGRESS" : "E · OPEN THE RIFT",
          challenge.x,
          challenge.y - 62,
          "#decfff",
        );
    }
    drawables.sort((a, b) => a.y - b.y).forEach((o) => o.draw());
    for (const item of g.loot || []) {
      if (!this.visible(item)) continue;
      const col =
        item.kind === "health"
          ? "#ffb1ba"
          : item.kind === "essence"
            ? "#9ee8ff"
            : "#efcf91";
      this.glow(c, item.x, item.y - 5, 23, col, 0.18);
      c.save();
      c.translate(item.x, item.y - 8 + Math.sin(t * 4 + item.x) * 3);
      c.rotate(Math.PI / 4);
      c.fillStyle = col;
      c.fillRect(-4, -4, 8, 8);
      c.restore();
    }
    for (const s of g.summons || []) {
      if (this.visible(s))
        this.atlas(
          c,
          "creature-sheet",
          s.element === "fire" ? 2 : 11,
          s.x,
          s.y + 7,
          53,
          56,
        );
    }
    for (const o of g.projectiles || [])
      if (this.visible(o)) this.drawProjectile(c, o, t);
    for (const e of g.effects || [])
      if (this.visible(e, 300) || e.from) this.drawEffect(c, e, t);
    for (const text of g.floatingTexts || []) {
      if (!this.visible(text, 100)) continue;
      const life = text.duration || text.life || 1,
        elapsed = text.age ?? (text.maxLife || 1) - text.life;
      c.save();
      c.globalAlpha = clamp(1 - elapsed / life, 0, 1);
      c.font = `${text.critical ? "700 21px" : "600 15px"} Inter,sans-serif`;
      c.textAlign = "center";
      c.lineWidth = 3;
      c.strokeStyle = "#102032";
      const value = String(text.text ?? text.value ?? "");
      c.strokeText(value, text.x, text.y - elapsed * 26 - 35);
      c.fillStyle = text.color || "#fff0ce";
      c.fillText(value, text.x, text.y - elapsed * 26 - 35);
      c.restore();
    }
    // Sparse motes and drifting leaves add depth while preserving battlefield contrast.
    c.save();
    for (let i = 0; i < 32; i++) {
      const x = (i * 113.7 + t * (3 + (i % 3))) % w.width,
        y = (i * 311.9 + Math.sin(t * 0.35 + i) * 17) % w.height;
      if (!this.visible({ x, y }, 5)) continue;
      c.globalAlpha = 0.2 + Math.sin(t + i) * 0.13;
      c.fillStyle = i % 3 ? "#fff3b6" : w.palette.accent;
      c.beginPath();
      c.arc(x, y, 1.2, 0, TAU);
      c.fill();
    }
    c.restore();
    c.restore();
    if (g.waypoint) {
      const q = this.worldToScreen(g.waypoint.x, g.waypoint.y),
        off =
          q.x < 45 ||
          q.x > this.width - 45 ||
          q.y < 130 ||
          q.y > this.height - 190;
      const x = clamp(q.x, 50, this.width - 50),
        y = clamp(q.y, 145, this.height - 205),
        at = this.worldToScreen(p.x, p.y),
        a = Math.atan2(q.y - at.y, q.x - at.x);
      c.save();
      c.translate(x, y);
      c.fillStyle = "#192637ee";
      c.strokeStyle = "#d4b4ff";
      c.lineWidth = 1.6;
      c.beginPath();
      c.arc(0, 0, 17, 0, TAU);
      c.fill();
      c.stroke();
      c.rotate(off ? a : 0);
      c.fillStyle = "#e7d2ff";
      c.beginPath();
      c.moveTo(9, 0);
      c.lineTo(-5, -6);
      c.lineTo(-2, 0);
      c.lineTo(-5, 6);
      c.closePath();
      c.fill();
      c.restore();
      this.label(
        c,
        `${g.waypoint.name || "Rift"} · ${Math.round(Math.hypot(g.waypoint.x - p.x, g.waypoint.y - p.y) / 10)} m`,
        x,
        y - 25,
        "#e6d0ff",
      );
    }
    // Gentle edge falloff and a clean aim reticle finish the scene.
    const vig = c.createRadialGradient(
      this.width * 0.5,
      this.height * 0.44,
      this.height * 0.3,
      this.width * 0.5,
      this.height * 0.5,
      Math.max(this.width, this.height) * 0.72,
    );
    vig.addColorStop(0, "transparent");
    vig.addColorStop(1, "#07151f77");
    c.fillStyle = vig;
    c.fillRect(0, 0, this.width, this.height);
    if (g.aim && !g.paused && !g.downed) {
      const q = this.worldToScreen(g.aim.x, g.aim.y);
      c.save();
      c.strokeStyle = "#e9f5e8";
      c.lineWidth = 1;
      c.globalAlpha = 0.55;
      c.beginPath();
      c.arc(q.x, q.y, 8, 0, TAU);
      c.stroke();
      for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
        c.beginPath();
        c.moveTo(q.x + Math.cos(a) * 11, q.y + Math.sin(a) * 11);
        c.lineTo(q.x + Math.cos(a) * 15, q.y + Math.sin(a) * 15);
        c.stroke();
      }
      c.restore();
    }
  }
  label(c, text, x, y, color = "#d9eef0") {
    c.save();
    c.font = "600 9px Inter,sans-serif";
    c.textAlign = "center";
    const width = c.measureText(text).width + 18;
    c.fillStyle = "#0a1b2cde";
    c.beginPath();
    c.roundRect(x - width / 2, y - 14, width, 23, 6);
    c.fill();
    c.strokeStyle = "#bddaf22b";
    c.stroke();
    c.fillStyle = color;
    c.fillText(text, x, y + 1);
    c.restore();
  }
}
