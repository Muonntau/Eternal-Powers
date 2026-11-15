import { assetUrl } from "../assetUrl.js";
import { resolveAppearanceColors } from "./character.js";
// Original canvas art. World generation is deterministic so exploration stays consistent.
const TAU = Math.PI * 2;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
function blend(a, b, t) {
  const A = a
      .slice(1)
      .match(/../g)
      .map((n) => parseInt(n, 16)),
    B = b
      .slice(1)
      .match(/../g)
      .map((n) => parseInt(n, 16));
  return (
    "#" +
    A.map((n, i) =>
      Math.round(n + (B[i] - n) * t)
        .toString(16)
        .padStart(2, "0"),
    ).join("")
  );
}
function random(seed) {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}
const PALETTES = {
  forest: {
    grass: "#25494a",
    dark: "#142b39",
    light: "#44766b",
    path: "#526879",
    pathLight: "#93adba",
    water: "#22566f",
    edge: "#123547",
    tree: "#2c5c5d",
    treetop: "#699681",
    sky: "#9aeadb",
  },
  heaven: {
    grass: "#607e89",
    dark: "#34455e",
    light: "#99bebf",
    path: "#8c9caf",
    pathLight: "#d7e3ef",
    water: "#47a5c0",
    edge: "#355471",
    tree: "#7dabad",
    treetop: "#cce7df",
    sky: "#e1e6ff",
  },
  hell: {
    grass: "#382a47",
    dark: "#171e34",
    light: "#684561",
    path: "#665168",
    pathLight: "#ac7e9f",
    water: "#aa4b65",
    edge: "#2c2441",
    tree: "#39394c",
    treetop: "#79717c",
    sky: "#ffb69b",
  },
  desert: {
    grass: "#867261",
    dark: "#434353",
    light: "#b69a80",
    path: "#a18c87",
    pathLight: "#debf9d",
    water: "#429daa",
    edge: "#3e6172",
    tree: "#617d72",
    treetop: "#9cb69a",
    sky: "#f5ceac",
  },
  water: {
    grass: "#28505a",
    dark: "#163447",
    light: "#4c847b",
    path: "#5c7d8d",
    pathLight: "#a5c5cb",
    water: "#247c9a",
    edge: "#193e5e",
    tree: "#386d72",
    treetop: "#77a594",
    sky: "#b4f2ed",
  },
  garden: {
    grass: "#345054",
    dark: "#203449",
    light: "#638b7e",
    path: "#778b99",
    pathLight: "#b9c5d0",
    water: "#478ba3",
    edge: "#27475d",
    tree: "#437d72",
    treetop: "#93b59c",
    sky: "#d8e8d6",
  },
  mountain: {
    grass: "#526b82",
    dark: "#253c58",
    light: "#82a7b5",
    path: "#7f96a8",
    pathLight: "#c8d9df",
    water: "#3c7fa2",
    edge: "#2a4b70",
    tree: "#517b8d",
    treetop: "#bfd8dc",
    sky: "#d4edff",
  },
  city: {
    grass: "#435969",
    dark: "#24394f",
    light: "#738f94",
    path: "#7e8ca2",
    pathLight: "#c4cadb",
    water: "#447f9f",
    edge: "#304b6b",
    tree: "#426b76",
    treetop: "#8aa79c",
    sky: "#cbdcf6",
  },
};

const biome = (world) =>
  world.variant === "infernal"
    ? "hell"
    : PALETTES[world.variant]
      ? world.variant
      : "forest";
const riverX = (y) => 1420 + Math.sin(y / 230) * 75;
const inPlot = (x, y, margin = 0) =>
  x >= 330 - margin &&
  x <= 670 + margin &&
  y >= 430 - margin &&
  y <= 770 + margin;
function roadDistance(point, road) {
  let best = Infinity;
  const pts = road.points || [];
  for (let i = 1; i < pts.length; i++) {
    const A = pts[i - 1],
      B = pts[i],
      ax = A.x ?? A[0],
      ay = A.y ?? A[1],
      bx = B.x ?? B[0],
      by = B.y ?? B[1],
      dx = bx - ax,
      dy = by - ay,
      t = clamp(
        ((point.x - ax) * dx + (point.y - ay) * dy) / (dx * dx + dy * dy || 1),
        0,
        1,
      );
    best = Math.min(
      best,
      Math.hypot(point.x - ax - dx * t, point.y - ay - dy * t),
    );
  }
  return best;
}

function isPath(x, y) {
  return (
    Math.hypot(x - 920, y - 900) < 205 ||
    Math.abs(y - (920 + Math.sin(x / 190) * 22)) < 53 ||
    Math.abs(x - (920 + Math.sin(y / 180) * 30)) < 40
  );
}
export function createWorld(seed = 17, variant = "forest", zone = null) {
  const rng = random(seed),
    props = [],
    decor = [],
    width = 2400,
    height = 1800;
  const b = variant === "infernal" ? "hell" : variant;
  const kits = {
    forest: ["tree-pine", "tree-oak", "tree-oak-gold", "tree-pine", "tree-oak"],
    garden: ["tree-oak", "tree-oak-gold", "tree-heaven", "tree-oak"],
    heaven: [
      "tree-heaven",
      "tree-heaven",
      "ruin-heaven",
      "floating-island",
      "tree-oak-gold",
    ],
    hell: [
      "dead-tree",
      "obsidian-spire",
      "rock-obsidian",
      "dead-tree",
      "brazier",
    ],
    desert: ["palm", "cactus", "cactus", "dune", "rock-sandstone"],
    mountain: ["tree-snow", "crag", "tree-pine-blue", "crag", "rock-0"],
    city: ["tree-oak-gold", "tree-oak", "fountain", "ruin", "tree-oak"],
    water: [
      "tree-pine-blue",
      "tree-oak",
      "cliff",
      "tree-oak",
      "tree-pine-blue",
    ],
  };
  const kit = kits[b] || kits.forest;
  const count =
    b === "desert" ? 125 : b === "city" ? 115 : b === "hell" ? 215 : 255;
  for (let i = 0; i < count; i++) {
    const x = 60 + rng() * (width - 120),
      y = 60 + rng() * (height - 120);
    const river = 1420 + Math.sin(y / 230) * 75;
    if (
      isPath(x, y) ||
      inPlot(x, y, 35) ||
      Math.abs(x - river) < 105 ||
      Math.hypot(x - 1000, y - 570) < 160 ||
      (b === "city" &&
        (Math.abs((x % 500) - 250) < 90 || Math.abs((y % 450) - 225) < 70))
    )
      continue;
    const asset = kit[Math.floor(rng() * kit.length)];
    props.push({
      id: `scenery-${i}`,
      kind: asset.includes("tree") || asset === "palm" ? "tree" : "rock",
      asset,
      x,
      y,
      radius: asset === "floating-island" || asset === "brazier" ? 0 : 14,
      scale: 0.8 + rng() * 0.55,
      tone: Math.floor(rng() * 3),
    });
  }
  for (let i = 0; i < 120; i++) {
    const x = 90 + rng() * (width - 180),
      y = 90 + rng() * (height - 180);
    if (isPath(x, y) || inPlot(x, y, 15) || Math.abs(x - riverX(y)) < 85)
      continue;
    const small =
      b === "hell"
        ? ["rock-obsidian", "crystal-ember", "crystal-void"]
        : b === "desert"
          ? ["rock-sandstone", "cactus", "ruin-desert"]
          : b === "mountain"
            ? ["rock-0", "crystal", "mushrooms-2"]
            : b === "heaven"
              ? ["flowers", "ruin-heaven", "crystal"]
              : ["bush", "bush-berries", "flowers", "flowers-blue"];
    props.push({
      id: `prop-${i}`,
      kind: "bush",
      asset: small[Math.floor(rng() * small.length)],
      x,
      y,
      radius: 0,
      scale: 0.7 + rng() * 0.4,
      tone: Math.floor(rng() * 3),
    });
  }
  for (let i = 0; i < 470; i++)
    decor.push({
      x: rng() * width,
      y: rng() * height,
      type: rng() < 0.5 ? "grass" : rng() < 0.5 ? "flower" : "mote",
      seed: rng(),
    });
  for (let i = 0; i < 65; i++) {
    const yy = 50 + rng() * (height - 100),
      side = rng() > 0.5 ? 1 : -1;
    const xx = 1420 + Math.sin(yy / 230) * 75 + side * (78 + rng() * 14);
    if (Math.abs(yy - 930) > 78)
      props.push({
        id: `reed-${i}`,
        kind: "reeds",
        asset:
          b === "hell" ? "crystal-ember" : b === "desert" ? "cactus" : "reeds",
        x: xx,
        y: yy,
        radius: 0,
        scale: 0.65 + rng() * 0.3,
      });
  }
  if (b !== "hell" && b !== "mountain")
    for (let i = 0; i < 28; i++) {
      const yy = 60 + rng() * (height - 120);
      if (Math.abs(yy - 930) > 78)
        props.push({
          id: `lily-${i}`,
          kind: "lily-pads",
          asset: "lily-pads",
          x: riverX(yy) + (rng() - 0.5) * 80,
          y: yy,
          radius: 0,
          scale: 0.65 + rng() * 0.4,
        });
    }
  if (["forest", "water", "garden"].includes(b))
    for (let i = 0; i < 32; i++) {
      const xx = 200 + rng() * 1900,
        yy = 300 + rng() * 1100;
      if (
        !isPath(xx, yy) &&
        !inPlot(xx, yy, 20) &&
        Math.abs(xx - riverX(yy)) > 100
      )
        props.push({
          id: `mushroom-${i}`,
          kind: "mushrooms",
          asset: `mushrooms-${i % 3}`,
          x: xx,
          y: yy,
          radius: 0,
          scale: 0.75 + rng() * 0.3,
        });
    }
  const temple =
    b === "hell"
      ? "infernal"
      : b === "desert"
        ? "desert"
        : b === "heaven"
          ? "heaven"
          : "forest";
  // Intentional landmarks keep the sanctuary legible rather than scattering every object randomly.
  props.push(
    {
      id: "ancient-arch",
      kind: "arch",
      asset: `temple-${temple}`,
      x: 1000,
      y: 645,
      radius: 0,
      scale: 1.15,
    },
    {
      id: "sanctuary-shrine",
      kind: "shrine",
      asset:
        b === "hell"
          ? "shrine-infernal"
          : b === "heaven"
            ? "shrine-heaven"
            : b === "desert"
              ? "shrine-desert"
              : "shrine",
      x: 915,
      y: 736,
      radius: 25,
      scale: 1.1,
    },
    {
      id: "west-obelisk",
      kind: "obelisk",
      x: 727,
      y: 818,
      radius: 15,
      scale: 1,
    },
    {
      id: "east-obelisk",
      kind: "obelisk",
      x: 1113,
      y: 815,
      radius: 15,
      scale: 1,
    },
    { id: "lantern-1", kind: "lantern", x: 765, y: 978, radius: 0, scale: 1 },
    { id: "lantern-2", kind: "lantern", x: 1072, y: 1000, radius: 0, scale: 1 },
    { id: "lantern-3", kind: "lantern", x: 1307, y: 889, radius: 0, scale: 1 },
    { id: "lantern-4", kind: "lantern", x: 1510, y: 963, radius: 0, scale: 1 },
    { id: "signpost-1", kind: "sign", x: 1188, y: 958, radius: 0, scale: 1 },
    {
      id: "fallen-column",
      kind: "column",
      x: 1104,
      y: 622,
      radius: 12,
      scale: 1,
    },
    { id: "ruin-column", kind: "column", x: 861, y: 596, radius: 12, scale: 1 },
    {
      id: "market-crate",
      kind: "vendor",
      asset: "vendor/superpowers/items/crate",
      x: 1225,
      y: 845,
      scale: 3,
      radius: 0,
    },
    {
      id: "market-barrel",
      kind: "vendor",
      asset: "vendor/superpowers/items/barrel",
      x: 1254,
      y: 849,
      scale: 3,
      radius: 0,
    },
    {
      id: "market-store",
      kind: "vendor",
      asset: "vendor/superpowers/background-elements/9",
      x: 1250,
      y: 805,
      scale: 3,
      radius: 0,
    },
  );
  if (b === "city")
    for (const [i, x, y] of [
      [0, 620, 750],
      [1, 1240, 750],
      [2, 580, 1190],
      [3, 1200, 1240],
      [4, 450, 330],
      [5, 1700, 380],
      [6, 2050, 610],
      [7, 1770, 1360],
      [8, 500, 1380],
      [9, 2100, 1450],
    ])
      props.push({
        id: `house-${i}`,
        kind: "house",
        asset: `house-${i % 3}`,
        x,
        y,
        scale: 1.35,
        radius: 42,
      });
  if (b === "city")
    props.push({
      id: "city-fountain",
      kind: "fountain",
      asset: "fountain",
      x: 1800,
      y: 1080,
      scale: 1.4,
      radius: 24,
    });
  if (b === "heaven")
    for (const [i, x, y] of [
      [0, 450, 350],
      [1, 1840, 430],
      [2, 1940, 1370],
    ])
      props.push(
        {
          id: `sky-island-${i}`,
          kind: "floating-island",
          asset: "floating-island",
          x,
          y,
          scale: 1.5,
          radius: 0,
        },
        {
          id: `sky-temple-${i}`,
          kind: "temple",
          asset: "temple-heaven",
          x,
          y,
          scale: 0.9,
          radius: 25,
        },
      );
  if (b === "water")
    for (const [i, x, y] of [
      [0, 1250, 430],
      [1, 1590, 450],
      [2, 1200, 520],
      [3, 1640, 520],
    ])
      props.push({
        id: `waterfall-cliff-${i}`,
        kind: "cliff",
        asset: "cliff",
        x,
        y,
        radius: 25,
        scale: 1.4,
      });
  if (b === "mountain")
    for (const [i, x, y] of [
      [0, 450, 350],
      [1, 1900, 400],
      [2, 1900, 1380],
      [3, 500, 1370],
    ])
      props.push({
        id: `summit-${i}`,
        kind: "crag",
        asset: "crag",
        x,
        y,
        radius: 40,
        scale: 1.8,
      });
  if (b === "desert")
    for (const [i, x, y] of [
      [0, 520, 330],
      [1, 1950, 470],
      [2, 1840, 1360],
    ])
      props.push({
        id: `desert-temple-${i}`,
        kind: "temple",
        asset: "temple-desert",
        x,
        y,
        radius: 30,
        scale: 1.05,
      });
  if (b === "hell")
    for (const [i, x, y] of [
      [0, 480, 320],
      [1, 1870, 440],
      [2, 1990, 1330],
    ])
      props.push({
        id: `infernal-citadel-${i}`,
        kind: "temple",
        asset: "temple-infernal",
        x,
        y,
        radius: 30,
        scale: 1.15,
      });
  const ambient = [];
  if (!["hell", "desert", "city"].includes(b))
    for (let i = 0; i < 16; i++) {
      let x = 170 + rng() * 2050,
        y = 200 + rng() * 1400;
      if (!isPath(x, y) && Math.abs(x - riverX(y)) > 100)
        ambient.push({
          id: i,
          x,
          y,
          homeX: x,
          homeY: y,
          sprite: [
            "deer",
            "wildlife/rabbit",
            "wildlife/songbird",
            "wildlife/butterfly",
            "moth",
            "firefly",
          ][i % 6],
          phase: rng() * TAU,
        });
    }
  for (let i = 0; i < 3; i++)
    ambient.push({
      id: `market-livestock-${i}`,
      x: 1300 + i * 27,
      y: 800 + i * 19,
      homeX: 1300 + i * 27,
      homeY: 800 + i * 19,
      sprite: `vendor/superpowers/animals/${i + 2}`,
      imported: true,
      phase: i * 1.3,
    });
  return {
    width,
    height,
    seed,
    variant,
    realm: zone?.realm,
    zoneId: zone?.id,
    props,
    decor,
    ambient,
    spawn: { x: 920, y: 900 },
    pathPoints: [
      { x: 400, y: 920 },
      { x: 920, y: 900 },
      { x: 1440, y: 930 },
      { x: 2100, y: 920 },
    ],
  };
}

export class WorldRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.width = 1000;
    this.height = 650;
    this.camera = { x: 420, y: 575 };
    this.images = {};
    this.manifest = null;
    this.remoteTracks = new Map();
    Promise.all([
      fetch(assetUrl("/assets/manifest.json")).then((r) => r.json()),
      fetch(assetUrl("/assets/expanded-manifest.json")).then((r) => r.json()),
    ])
      .then(([base, extra]) => {
        this.manifest = {
          ...base,
          props: { ...base.props, ...extra.props },
          characters: { ...base.characters, ...extra.characters },
          vfx: extra.vfx,
        };
        this.expanded = extra;
      })
      .catch(() => {});
    const tiles = new Image();
    tiles.src = assetUrl(
      "/assets/vendor/superpowers/background-elements/0-tileset.png",
    );
    tiles.onload = () => {
      this.groundWorld = null;
    };
    this.images[tiles.src] = tiles;
    this.importedTiles = tiles;
    this.resize();
  }
  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.width = Math.max(1, rect.width || 1000);
    this.height = Math.max(1, rect.height || 650);
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
    this.ctx.imageSmoothingEnabled = false;
  }
  screenToWorld(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: clientX - rect.left + this.camera.x,
      y: clientY - rect.top + this.camera.y,
    };
  }
  image(path) {
    if (!path) return null;
    path = assetUrl(path);
    if (!this.images[path]) {
      const im = new Image();
      im.src = path;
      this.images[path] = im;
    }
    const im = this.images[path];
    return im.complete && im.naturalWidth ? im : null;
  }
  sprite(path, x, y, w, h, sx, sy, sw, sh) {
    const im = this.image(path);
    if (!im) return false;
    const c = this.ctx;
    if (sx != null)
      c.drawImage(
        im,
        sx,
        sy,
        sw,
        sh,
        Math.round(x - w / 2),
        Math.round(y - h),
        w,
        h,
      );
    else c.drawImage(im, Math.round(x - w / 2), Math.round(y - h), w, h);
    return true;
  }
  makeGround(world) {
    if (world.authored) return this.makeAuthoredGround(world);
    this.groundWorld = world;
    const cv = document.createElement("canvas");
    cv.width = world.width;
    cv.height = world.height;
    const c = cv.getContext("2d");
    c.imageSmoothingEnabled = false;
    const p =
      PALETTES[
        world.realm === "heaven" && ["city", "garden"].includes(biome(world))
          ? "heaven"
          : biome(world)
      ] || PALETTES.forest;
    const rng = random(world.seed || 17);
    c.fillStyle = p.grass;
    c.fillRect(0, 0, cv.width, cv.height);
    this.scenicGround(c, world, p, rng);
    for (let i = 0; i < 22000; i++) {
      c.fillStyle = [p.dark, p.light, p.grass, p.dark, p.light][
        Math.floor(rng() * 5)
      ];
      c.globalAlpha = 0.1 + rng() * 0.23;
      c.fillRect(
        Math.floor((rng() * cv.width) / 3) * 3,
        Math.floor((rng() * cv.height) / 3) * 3,
        3 + Math.floor(rng() * 3) * 3,
        3,
      );
    }
    c.globalAlpha = 1;
    // Irregular raised stone path; fine pavers are clipped into its silhouette.
    const path = new Path2D();
    path.moveTo(0, 910);
    for (let x = 0; x <= world.width; x += 30)
      path.lineTo(x, 920 + Math.sin(x / 190) * 22 - 47 - Math.sin(x / 43) * 3);
    for (let x = world.width; x >= 0; x -= 30)
      path.lineTo(x, 920 + Math.sin(x / 190) * 22 + 47 + Math.sin(x / 33) * 3);
    path.closePath();
    path.moveTo(958, 0);
    for (let y = 0; y <= world.height; y += 30)
      path.lineTo(920 + Math.sin(y / 180) * 30 + 38, y);
    for (let y = world.height; y >= 0; y -= 30)
      path.lineTo(920 + Math.sin(y / 180) * 30 - 38, y);
    path.closePath();
    path.moveTo(1126, 900);
    path.ellipse(920, 900, 206, 174, 0, 0, TAU);
    c.save();
    c.fillStyle = p.dark;
    c.strokeStyle = p.dark;
    c.lineWidth = 13;
    c.stroke(path);
    c.fillStyle = p.path;
    c.fill(path);
    c.clip(path);
    for (let y = 0; y < world.height; y += 14)
      for (let x = -24; x < world.width; x += 30) {
        const ox = x + (y % 28 ? 15 : 0),
          r = rng();
        c.fillStyle =
          r < 0.35
            ? p.pathLight
            : r < 0.82
              ? p.path
              : blend(p.path, p.dark, 0.24);
        c.fillRect(ox + 1, y + 1, 27, 11);
        c.fillStyle = "rgba(234,223,169,.13)";
        c.fillRect(ox + 2, y + 1, 24, 2);
      }
    c.restore();
    // Shallow sanctuary ring and rune stones.
    c.strokeStyle = "#beb48b";
    c.globalAlpha = 0.65;
    c.lineWidth = 4;
    c.beginPath();
    c.ellipse(920, 900, 144, 113, 0, 0, TAU);
    c.stroke();
    c.strokeStyle = "#686b52";
    c.lineWidth = 2;
    c.beginPath();
    c.ellipse(920, 900, 132, 104, 0, 0, TAU);
    c.stroke();
    c.globalAlpha = 1;
    for (let i = 0; i < 12; i++) {
      const a = (i * TAU) / 12;
      c.save();
      c.translate(920 + Math.cos(a) * 140, 900 + Math.sin(a) * 111);
      c.rotate(a);
      c.fillStyle = "#d0c79e";
      c.fillRect(-3, -5, 6, 10);
      c.fillStyle = "#798265";
      c.fillRect(-1, -3, 2, 6);
      c.restore();
    }
    // A gently winding stream is a real visual boundary, with one generous crossing.
    const river = new Path2D();
    river.moveTo(1340, 0);
    for (let y = 0; y <= world.height; y += 20)
      river.lineTo(
        1420 + Math.sin(y / 230) * 75 - 63 - Math.sin(y / 45) * 5,
        y,
      );
    for (let y = world.height; y >= 0; y -= 20)
      river.lineTo(
        1420 + Math.sin(y / 230) * 75 + 66 + Math.sin(y / 67) * 7,
        y,
      );
    river.closePath();
    c.strokeStyle = p.light;
    c.lineWidth = 21;
    c.stroke(river);
    c.strokeStyle = p.edge;
    c.lineWidth = 9;
    c.stroke(river);
    c.fillStyle = p.water;
    c.fill(river);
    c.save();
    c.clip(river);
    for (let i = 0; i < 1800; i++) {
      c.fillStyle = rng() < 0.5 ? p.edge : p.water;
      c.globalAlpha = 0.4;
      c.fillRect(1320 + rng() * 260, rng() * world.height, 6 + rng() * 18, 2);
    }
    c.globalAlpha = 1;
    for (let i = 0; i < 250; i++) {
      c.fillStyle = biome(world) === "hell" ? "#f3b17c" : "#b6ded1";
      c.globalAlpha = 0.4;
      c.fillRect(1320 + rng() * 260, rng() * world.height, 5 + rng() * 8, 2);
    }
    c.restore();
    c.globalAlpha = 1;
    // Stone bridge: masonry, pale parapets, weathering, and a shadow cast into the river.
    const bx = 1420 + Math.sin(930 / 230) * 75;
    c.fillStyle = "rgba(11,27,31,.28)";
    c.fillRect(bx - 105, 910, 226, 96);
    c.fillStyle = blend(p.path, p.dark, 0.3);
    c.fillRect(bx - 101, 881, 211, 99);
    for (let y = 888; y < 974; y += 16)
      for (let x = bx - 101; x < bx + 107; x += 28) {
        c.fillStyle = rng() < 0.45 ? p.pathLight : p.path;
        c.fillRect(x + (y % 32 ? 0 : 12), y, 25, 13);
        c.fillStyle = blend(p.pathLight, "#fff5d4", 0.15);
        c.fillRect(x + 2, y + 1, 19, 2);
      }
    for (const yy of [878, 973]) {
      c.fillStyle = p.dark;
      c.fillRect(bx - 108, yy + 8, 225, 9);
      c.fillStyle = p.path;
      c.fillRect(bx - 108, yy, 225, 10);
      c.fillStyle = p.pathLight;
      c.fillRect(bx - 106, yy, 221, 3);
    }
    for (const xx of [bx - 111, bx + 105])
      for (const yy of [874, 969]) {
        c.fillStyle = p.path;
        c.fillRect(xx, yy, 18, 20);
        c.fillStyle = p.pathLight;
        c.fillRect(xx - 2, yy - 3, 22, 8);
      }
    // Grass blades and tiny wildflower patches soften the manmade edges.
    for (const d of world.decor) {
      if (
        isPath(d.x, d.y) ||
        Math.abs(d.x - (1420 + Math.sin(d.y / 230) * 75)) < 77
      )
        continue;
      if (d.type === "grass") {
        c.fillStyle = p.light;
        for (let j = 0; j < 3; j++) {
          c.fillRect(d.x + j * 4, d.y - (j % 2 ? 6 : 4), 2, j % 2 ? 6 : 4);
        }
      }
      if (
        d.type === "flower" &&
        !["hell", "desert", "mountain"].includes(biome(world))
      ) {
        c.fillStyle = p.light;
        c.fillRect(d.x, d.y, 2, 5);
        c.fillStyle =
          d.seed < 0.35 ? "#c3bd86" : d.seed < 0.7 ? "#bd9a9d" : "#92aeb1";
        c.fillRect(d.x - 2, d.y - 2, 5, 3);
        c.fillRect(d.x, d.y - 4, 2, 6);
      }
    }
    this.ground = cv;
  }
  makeAuthoredGround(world) {
    this.groundWorld = world;
    const cv = document.createElement("canvas");
    this.groundScale = Math.min(1, 4096 / world.width, 4096 / world.height);
    cv.width = Math.ceil(world.width * this.groundScale);
    cv.height = Math.ceil(world.height * this.groundScale);
    const c = cv.getContext("2d"),
      p =
        PALETTES[world.realm === "heaven" ? "heaven" : biome(world)] ||
        PALETTES.forest,
      rng = random(world.seed || 17);
    c.imageSmoothingEnabled = false;
    c.scale(this.groundScale, this.groundScale);
    c.fillStyle = p.grass;
    c.fillRect(0, 0, world.width, world.height);
    for (let i = 0; i < 60; i++) {
      const x = rng() * world.width,
        y = rng() * world.height;
      c.globalAlpha = 0.11;
      c.fillStyle = i % 2 ? p.dark : p.light;
      c.beginPath();
      c.ellipse(x, y, 70 + rng() * 170, 40 + rng() * 90, 0, 0, TAU);
      c.fill();
    }
    c.globalAlpha = 1;
    for (let i = 0; i < 21000; i++) {
      c.fillStyle = i % 3 ? p.light : p.dark;
      c.globalAlpha = 0.1 + rng() * 0.15;
      c.fillRect(
        Math.floor((rng() * world.width) / 3) * 3,
        Math.floor((rng() * world.height) / 3) * 3,
        3 + Math.floor(rng() * 3) * 3,
        2,
      );
    }
    c.globalAlpha = 1;
    const polygon = (points) => {
      const path = new Path2D();
      (points || []).forEach((v, i) =>
        i
          ? path.lineTo(v.x ?? v[0], v.y ?? v[1])
          : path.moveTo(v.x ?? v[0], v.y ?? v[1]),
      );
      path.closePath();
      return path;
    };
    for (const water of world.terrain?.water || []) {
      const path = polygon(water.points);
      c.strokeStyle = p.edge;
      c.lineWidth = 15;
      c.stroke(path);
      c.strokeStyle = p.light;
      c.lineWidth = 4;
      c.stroke(path);
      c.fillStyle =
        water.kind === "lava"
          ? "#a35e50"
          : water.kind === "void"
            ? "#2b334d"
            : p.water;
      c.fill(path);
      c.save();
      c.clip(path);
      for (let i = 0; i < 1000; i++) {
        c.fillStyle =
          water.kind === "lava"
            ? "#e6a675"
            : water.kind === "void"
              ? "#6a7294"
              : "#a9d0c5";
        c.globalAlpha = 0.25;
        c.fillRect(
          rng() * world.width,
          rng() * world.height,
          5 + rng() * 18,
          2,
        );
      }
      c.restore();
    }
    for (const room of world.interiors || []) {
      c.fillStyle =
        room.floor === "obsidian"
          ? "#302c49"
          : room.floor === "sandstone"
            ? "#9d8c83"
            : "#768da3";
      c.fillRect(room.x, room.y, room.width, room.height);
      c.strokeStyle = room.floor === "obsidian" ? "#9c84b9" : "#bfd3e7";
      c.lineWidth = 3;
      c.strokeRect(room.x + 9, room.y + 9, room.width - 18, room.height - 18);
      const tile = this.importedTiles;
      if (tile?.complete && tile.naturalWidth) {
        c.save();
        c.beginPath();
        c.rect(room.x + 15, room.y + 15, room.width - 30, room.height - 30);
        c.clip();
        c.globalAlpha = room.floor === "obsidian" ? 0.12 : 0.13;
        const crop =
          room.theme === "library" ? [68, 4, 42, 40] : [198, 7, 34, 34];
        for (let y = room.y + 15; y < room.y + room.height - 15; y += 68)
          for (let x = room.x + 15; x < room.x + room.width - 15; x += 68)
            c.drawImage(tile, ...crop, x, y, 68, 68);
        c.restore();
      }
      for (let y = room.y + 25; y < room.y + room.height - 20; y += 44)
        for (let x = room.x + 25; x < room.x + room.width - 20; x += 44) {
          c.strokeStyle =
            room.floor === "obsidian"
              ? "rgba(183,147,230,.17)"
              : "rgba(207,232,255,.2)";
          c.strokeRect(x, y, 32, 32);
        }
      c.fillStyle = room.floor === "obsidian" ? "#71598b" : "#a5c4d9";
      for (const [x, y] of [
        [room.x + 20, room.y + 20],
        [room.x + room.width - 20, room.y + 20],
        [room.x + 20, room.y + room.height - 20],
        [room.x + room.width - 20, room.y + room.height - 20],
      ]) {
        c.beginPath();
        c.ellipse(x, y, 10, 7, 0, 0, TAU);
        c.fill();
      }
    }
    for (const cliff of world.terrain?.cliffs || []) {
      c.fillStyle = p.dark;
      c.fillRect(cliff.x, cliff.y, cliff.width, cliff.height);
      c.fillStyle = blend(p.path, p.dark, 0.2);
      c.fillRect(cliff.x, cliff.y - 10, cliff.width, cliff.height - 5);
      c.fillStyle = p.light;
      c.fillRect(cliff.x + 2, cliff.y - 11, cliff.width - 4, 5);
      for (let x = cliff.x + 12; x < cliff.x + cliff.width; x += 22) {
        c.fillStyle = p.dark;
        c.fillRect(x, cliff.y + 10, 3, cliff.height - 15);
      }
    }
    // Raised wall tops share the exact collision rectangles. Roads paint their
    // permitted corridor openings afterwards, so a visible doorway is passable.
    for (const wall of world.terrain?.walls || []) {
      const horizontal = wall.width >= wall.height,
        length = horizontal ? wall.width : wall.height;
      for (let i = 0; i < length; i += 8) {
        const x = wall.x + (horizontal ? i : 0),
          y = wall.y + (horizontal ? 0 : i),
          w = horizontal ? Math.min(8, length - i) : wall.width,
          h = horizontal ? wall.height : Math.min(8, length - i),
          point = { x: x + w / 2, y: y + h / 2 };
        if (
          (world.paths || []).some(
            (road) => roadDistance(point, road) < (road.width || 80) / 2,
          )
        )
          continue;
        c.fillStyle = blend(p.dark, "#20303e", 0.3);
        c.fillRect(x, y, w, h);
        c.fillStyle = blend(p.path, p.dark, 0.15);
        c.fillRect(x, y - 14, w, h);
        c.fillStyle = p.pathLight;
        c.fillRect(x, y - 15, w, 4);
      }
    }
    for (const road of world.paths || []) {
      const points = road.points || [],
        width = road.width || 80;
      if (!points.length || road.hidden) continue;
      const draw = () => {
        c.beginPath();
        points.forEach((v, i) =>
          i
            ? c.lineTo(v.x ?? v[0], v.y ?? v[1])
            : c.moveTo(v.x ?? v[0], v.y ?? v[1]),
        );
      };
      const colors =
        road.style === "ash"
          ? ["#4f3f4d", "#7a6066"]
          : road.style === "marble"
            ? ["#98aec7", "#e1ebf7"]
            : road.style === "sand"
              ? ["#b7a074", "#d5bd89"]
              : [p.path, p.pathLight];
      c.lineJoin = "round";
      c.lineCap = "round";
      draw();
      c.strokeStyle = p.dark;
      c.lineWidth = width + 10;
      c.stroke();
      c.strokeStyle = colors[0];
      c.lineWidth = width;
      c.stroke();
      for (let i = 1; i < points.length; i++) {
        const a = points[i - 1],
          b = points[i],
          ax = a.x ?? a[0],
          ay = a.y ?? a[1],
          bx = b.x ?? b[0],
          by = b.y ?? b[1],
          length = Math.hypot(bx - ax, by - ay),
          angle = Math.atan2(by - ay, bx - ax);
        for (let s = 10; s < length; s += 25) {
          c.save();
          c.translate(ax + Math.cos(angle) * s, ay + Math.sin(angle) * s);
          c.rotate(angle);
          for (
            let row = -Math.floor(width / 32);
            row <= Math.floor(width / 32);
            row++
          ) {
            c.fillStyle =
              (s + row) % 3 ? colors[1] : blend(colors[0], p.dark, 0.14);
            c.globalAlpha = 0.46;
            c.fillRect(-10, row * 14 - 5, 20, 10);
          }
          c.restore();
        }
      }
      c.globalAlpha = 1;
    }
    for (const area of world.safeAreas || []) {
      const x = area.x,
        y = area.y,
        r = Math.min(area.radius || 150, 200);
      c.fillStyle = p.path;
      c.beginPath();
      c.ellipse(x, y, r, r * 0.72, 0, 0, TAU);
      c.fill();
      c.strokeStyle = p.pathLight;
      c.lineWidth = 3;
      c.beginPath();
      c.ellipse(x, y, r * 0.86, r * 0.62, 0, 0, TAU);
      c.stroke();
    }
    // Overlapping collision samples form one deck. Painting individual boxes
    // would produce stacked parapets and misleading internal obstacles.
    const bridges = world.terrain?.bridges || [];
    if (bridges.length) {
      const deck = new Path2D();
      for (const b of bridges) deck.rect(b.x, b.y, b.width, b.height);
      c.save();
      c.fillStyle = p.dark;
      c.shadowColor = "rgba(13,31,35,.32)";
      c.shadowBlur = 4;
      c.shadowOffsetY = 5;
      c.fill(deck);
      c.shadowBlur = 0;
      c.shadowOffsetY = 0;
      c.clip(deck);
      c.fillStyle = p.path;
      c.fillRect(0, 0, world.width, world.height);
      for (let y = 0; y < world.height; y += 15)
        for (let x = 0; x < world.width; x += 29) {
          c.fillStyle = (x + y) % 3 ? p.pathLight : blend(p.path, p.dark, 0.1);
          c.globalAlpha = 0.72;
          c.fillRect(x + (y % 30 ? 14 : 0) + 1, y + 1, 26, 12);
          c.fillStyle = "#eee4bc";
          c.globalAlpha = 0.21;
          c.fillRect(x + (y % 30 ? 14 : 0) + 2, y + 1, 24, 2);
        }
      c.restore();
      c.globalAlpha = 1;
    }

    this.ground = cv;
  }
  scenicGround(c, w, p, rng) {
    const b = biome(w);
    c.save();
    if (b === "forest" || b === "water" || b === "garden")
      for (let i = 0; i < 42; i++) {
        const x = rng() * w.width,
          y = rng() * w.height;
        c.globalAlpha = 0.14;
        c.fillStyle = i % 2 ? p.light : p.dark;
        c.beginPath();
        c.ellipse(x, y, 70 + rng() * 150, 35 + rng() * 90, 0, 0, TAU);
        c.fill();
      }
    c.globalAlpha = 1;
    if (b === "city") {
      const roads = new Path2D();
      for (const x of [440, 700, 1780, 2050]) {
        c.fillStyle = p.dark;
        c.fillRect(x - 47, 150, 94, 1500);
        c.fillStyle = p.path;
        c.fillRect(x - 42, 150, 84, 1500);
      }
      for (const y of [380, 620, 1260, 1490]) {
        c.fillStyle = p.dark;
        c.fillRect(120, y - 38, 2160, 76);
        c.fillStyle = p.path;
        c.fillRect(120, y - 33, 2160, 66);
      }
      for (const x of [440, 700, 1780, 2050]) roads.rect(x - 40, 150, 80, 1500);
      for (const y of [380, 620, 1260, 1490]) roads.rect(120, y - 31, 2160, 62);
      c.save();
      c.clip(roads);
      for (let yy = 150; yy < 1650; yy += 16)
        for (let xx = 120; xx < 2280; xx += 30) {
          c.fillStyle = (xx + yy) % 3 ? p.pathLight : p.path;
          c.globalAlpha = 0.4;
          c.fillRect(xx + (yy % 32 ? 14 : 0) + 1, yy + 1, 27, 13);
        }
      c.restore();
      for (const [x, y] of [
        [450, 330],
        [1700, 380],
        [1770, 1360],
        [500, 1380],
      ]) {
        c.fillStyle = p.path;
        c.beginPath();
        c.ellipse(x, y, 160, 115, 0, 0, TAU);
        c.fill();
        c.strokeStyle = p.pathLight;
        c.lineWidth = 3;
        c.stroke();
      }
    } else if (b === "heaven") {
      for (const [x, y] of [
        [450, 350],
        [1840, 430],
        [1940, 1370],
        [450, 1330],
      ]) {
        c.fillStyle = "#aac2b3";
        c.beginPath();
        c.ellipse(x, y, 230, 155, 0, 0, TAU);
        c.fill();
        c.fillStyle = "#d8ddbf";
        c.beginPath();
        c.ellipse(x, y - 5, 210, 140, 0, 0, TAU);
        c.fill();
        for (const r of [100, 140, 185]) {
          c.strokeStyle = r === 140 ? "#c4ad75" : "#efebcd";
          c.lineWidth = r === 140 ? 3 : 2;
          c.beginPath();
          c.ellipse(x, y - 6, r, r * 0.65, 0, 0, TAU);
          c.stroke();
        }
        for (let j = 0; j < 12; j++) {
          const a = (j * TAU) / 12;
          c.fillStyle = "#bba56e";
          c.fillRect(
            x + Math.cos(a) * 165 - 2,
            y + Math.sin(a) * 107 - 2,
            4,
            4,
          );
        }
      }
    } else if (b === "hell") {
      for (let j = 0; j < 20; j++) {
        const x = 90 + rng() * 2200,
          y = 100 + rng() * 1500;
        if (isPath(x, y) || inPlot(x, y, 45)) continue;
        c.beginPath();
        c.moveTo(x, y);
        for (let i = 1; i < 6; i++)
          c.lineTo(x + Math.sin(i * 1.7 + j) * 30 + i * 12, y + i * 18);
        c.strokeStyle = "#211f30";
        c.lineWidth = 17;
        c.stroke();
        c.strokeStyle = "#834c50";
        c.lineWidth = 7;
        c.stroke();
        c.strokeStyle = "#d8885d";
        c.lineWidth = 2;
        c.stroke();
      }
      for (const [x, y] of [
        [480, 320],
        [1870, 440],
        [1990, 1330],
      ]) {
        c.strokeStyle = "#94665e";
        c.lineWidth = 4;
        c.beginPath();
        c.ellipse(x, y, 130, 90, 0, 0, TAU);
        c.stroke();
        c.beginPath();
        c.ellipse(x, y, 112, 77, 0, 0, TAU);
        c.stroke();
      }
    } else if (b === "desert") {
      for (let i = 0; i < 30; i++) {
        const x = rng() * 2400,
          y = rng() * 1800,
          rr = 80 + rng() * 200;
        c.strokeStyle = i % 2 ? "#dbc18b" : "#a99065";
        c.lineWidth = i % 3 ? 3 : 7;
        c.beginPath();
        c.ellipse(x, y, rr, rr * 0.31, -0.2, Math.PI, TAU);
        c.stroke();
        c.strokeStyle = "#e8cf9b";
        c.lineWidth = 2;
        c.beginPath();
        c.ellipse(x, y - 6, rr, rr * 0.31, -0.2, Math.PI, TAU);
        c.stroke();
      }
      for (let i = 0; i < 130; i++) {
        const x = rng() * 2400,
          y = rng() * 1800;
        c.fillStyle = "#8f865e";
        c.fillRect(x, y, 2, 5);
        c.fillRect(x - 3, y + 2, 8, 1);
      }
    } else if (b === "mountain") {
      for (let i = 0; i < 55; i++) {
        const x = rng() * 2400,
          y = rng() * 1800;
        if (isPath(x, y)) continue;
        c.fillStyle = "#a1b7b1";
        c.beginPath();
        c.ellipse(x, y, 30 + rng() * 110, 20 + rng() * 45, 0, 0, TAU);
        c.fill();
        c.fillStyle = "#c1d0c4";
        c.beginPath();
        c.ellipse(x - 6, y - 4, 20 + rng() * 85, 12 + rng() * 29, 0, 0, TAU);
        c.fill();
      }
      for (const [x, y] of [
        [450, 350],
        [1900, 400],
        [1900, 1380],
        [500, 1370],
      ]) {
        c.strokeStyle = "#455e68";
        c.lineWidth = 12;
        c.beginPath();
        c.ellipse(x, y, 160, 100, 0, 0.1, Math.PI);
        c.stroke();
        c.strokeStyle = "#b4c5be";
        c.lineWidth = 4;
        c.stroke();
      }
    } else if (b === "water") {
      for (const [x, y] of [
        [1170, 440],
        [1650, 460],
      ]) {
        c.fillStyle = "#4b6668";
        c.beginPath();
        c.ellipse(x, y, 200, 92, 0, 0, TAU);
        c.fill();
        c.fillStyle = "#7c9990";
        c.beginPath();
        c.ellipse(x, y - 15, 190, 70, 0, 0, TAU);
        c.fill();
        c.strokeStyle = "#aec3aa";
        c.lineWidth = 5;
        c.stroke();
      }
    } else if (b === "garden") {
      for (const [x, y] of [
        [480, 350],
        [1850, 420],
        [1850, 1350],
      ]) {
        c.fillStyle = "#a6a58b";
        c.beginPath();
        c.ellipse(x, y, 170, 120, 0, 0, TAU);
        c.fill();
        for (let r = 24; r < 166; r += 12) {
          c.strokeStyle = "#c1bda1";
          c.lineWidth = 2;
          c.beginPath();
          c.ellipse(x, y, r, r * 0.7, 0, 0, TAU);
          c.stroke();
        }
      }
    }
    c.restore();
  }
  render(game, now = performance.now()) {
    const c = this.ctx,
      { world, player } = game;
    if (!world || !player) return;
    if (game.zone?.realm && world.realm !== game.zone.realm) {
      world.realm = game.zone.realm;
      this.groundWorld = null;
    }
    if (!world.zoneId && game.zone?.id) world.zoneId = game.zone.id;
    const rect = this.canvas.getBoundingClientRect();
    if (
      Math.abs(rect.width - this.width) > 1 ||
      Math.abs(rect.height - this.height) > 1
    )
      this.resize();
    if (this.groundWorld !== world) this.makeGround(world);
    const desiredX = clamp(
      player.x - this.width / 2,
      0,
      Math.max(0, world.width - this.width),
    );
    const desiredY = clamp(
      player.y - this.height / 2,
      0,
      Math.max(0, world.height - this.height),
    );
    this.camera.x += (desiredX - this.camera.x) * 0.12;
    this.camera.y += (desiredY - this.camera.y) * 0.12;
    game.camera = this.camera;
    const ox = Math.round(this.camera.x),
      oy = Math.round(this.camera.y);
    this.camera.x = ox;
    this.camera.y = oy;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.clearRect(0, 0, this.width, this.height);
    c.imageSmoothingEnabled = false;
    c.save();
    c.translate(-ox, -oy);
    c.drawImage(this.ground, 0, 0, world.width, world.height);
    const region = biome(world),
      model = game.worldModel || game.worldSystems?.snapshot?.() || {};
    // Surface motion follows the authored water polygons. The starter grove
    // retains its original stream; each later region has its own crossings.
    c.globalAlpha = 0.27;
    c.fillStyle = region === "hell" ? "#ffbd79" : "#c4e4d6";
    if (!world.authored)
      for (let i = 0; i < 55; i++) {
        const yy = (i * 43 + now * 0.018) % world.height,
          xx = 1420 + Math.sin(yy / 230) * 75 + Math.sin(i * 4.3) * 46;
        if (Math.abs(yy - 930) > 65) c.fillRect(xx, yy, 7 + (i % 9), 2);
      }
    else
      for (const water of world.terrain?.water || []) {
        const pts = water.points || [];
        if (!pts.length) continue;
        c.save();
        c.beginPath();
        pts.forEach((v, i) =>
          i
            ? c.lineTo(v.x ?? v[0], v.y ?? v[1])
            : c.moveTo(v.x ?? v[0], v.y ?? v[1]),
        );
        c.closePath();
        c.clip();
        const xs = pts.map((v) => v.x ?? v[0]),
          ys = pts.map((v) => v.y ?? v[1]),
          xmin = Math.min(...xs),
          ymin = Math.min(...ys),
          width = Math.max(...xs) - xmin,
          height = Math.max(...ys) - ymin;
        for (let i = 0; i < 35; i++)
          c.fillRect(
            xmin + ((i * 37.3) % width),
            ymin + ((i * 83.1 + now * 0.015) % height),
            5 + (i % 9),
            2,
          );
        c.restore();
      }
    c.globalAlpha = 1;
    if (game.destination) {
      const d = game.destination;
      c.strokeStyle = "#c7ddae";
      c.lineWidth = 1;
      c.globalAlpha = 0.7;
      c.beginPath();
      c.ellipse(d.x, d.y, 9, 4, 0, 0, TAU);
      c.stroke();
      c.fillStyle = "#e1edca";
      c.fillRect(d.x - 1, d.y - 1, 3, 3);
      c.globalAlpha = 1;
    }
    this.waterfall(world, now);
    this.architecturalDetails(world, player, now);
    for (const e of game.entities || [])
      if (e.state === "telegraph" || e.state === "windup" || e.telegraph > 0)
        this.telegraph(e, now);
    for (const h of model.hazards || [])
      if (!h.disabled && h.state !== "disabled")
        this.telegraph(
          {
            ...h,
            attackRadius: h.radius,
            attackShape: h.shape || "circle",
            attackTarget: h,
            active: h.state === "active",
          },
          now,
        );
    this.counterAnchors(model.conditions || [], game, now);
    const components = (game.sanctuary?.components || []).filter(
      (p) => !p.zoneId || p.zoneId === (game.zone?.id || world.zoneId),
    );
    for (const p of components.filter((p) => p.layer === "ground"))
      this.drawBuild(p, now, game);
    for (const field of game.localMagic?.fields || [])
      if (!field.zoneId || field.zoneId === game.zone?.id)
        this.drawMagicField(field, now, game);
    const ambient = (world.ambient || []).map((a) => ({
      ...a,
      x: (a.homeX ?? a.x) + Math.sin(now / 4200 + (a.phase || 0)) * 22,
      y: (a.homeY ?? a.y) + Math.cos(now / 5300 + (a.phase || 0)) * 12,
      kind: "wildlife",
      renderType: "ambient",
    }));
    const liveIds = new Set((game.entities || []).map((e) => e.id)),
      allies = (game.contracts?.party || []).filter(
        (e) => !liveIds.has(e.id) && (!e.zoneId || e.zoneId === game.zone?.id),
      );
    const networkPlayers = Array.isArray(game.network?.players)
        ? game.network.players
        : Object.values(game.network?.players || {}),
      selfId =
        game.network?.selfId ||
        game.network?.playerId ||
        game.network?.clientId;
    const remote = networkPlayers
      .filter(
        (e) =>
          e.id !== selfId &&
          e.playerId !== selfId &&
          (!e.zoneId || e.zoneId === game.zone?.id) &&
          Number.isFinite(e.x) &&
          Number.isFinite(e.y),
      )
      .map((e) => {
        const id = e.id || e.playerId,
          old = this.remoteTracks.get(id) || { x: e.x, y: e.y };
        old.x += (e.x - old.x) * 0.2;
        old.y += (e.y - old.y) * 0.2;
        this.remoteTracks.set(id, old);
        return { ...e, ...old, renderType: "remote" };
      });
    remote
      .sort(
        (a, b) =>
          Math.hypot(a.x - player.x, a.y - player.y) -
          Math.hypot(b.x - player.x, b.y - player.y),
      )
      .forEach((p, i) => {
        p.showName = i < 12;
      });
    const fallen = Object.values(game.progression?.fallen || {})
      .filter(
        (f) =>
          f.zoneId === game.zone?.id &&
          !f.revived &&
          (game.progression?.elapsed || 0) - f.fallenAt < 30,
      )
      .map((f) => {
        const e = (game.entities || []).find(
          (e) => e.id === f.entityId && e.dead,
        );
        return e ? { ...e, renderType: "fallen" } : null;
      })
      .filter(Boolean);
    const magicObjects = (game.powerObjects || game.localMagic?.objects || [])
      .filter((o) => !o.zoneId || o.zoneId === game.zone?.id)
      .map((o) => ({ ...o, renderType: "power-object" }));
    this.entityLabels = [];
    const visible = (d) =>
      d.x >= ox - 260 &&
      d.x <= ox + this.width + 260 &&
      d.y >= oy - 110 &&
      d.y <= oy + this.height + 260;
    const drawables = [
      ...world.props.filter(visible).map((p) => ({ ...p, renderType: "prop" })),
      ...fallen,
      ...magicObjects,
      ...components
        .filter((p) => p.layer !== "ground")
        .map((p) => ({ ...p, renderType: "construction" })),
      ...ambient.filter(visible),
      ...remote.filter(visible),
      ...[...(game.entities || []), ...allies]
        .filter((e) => !e.dead && !e.collected && visible(e))
        .map((e) => ({ ...e, renderType: "entity" })),
      { ...player, renderType: "player" },
    ];
    drawables.sort((a, b) => a.y - b.y);
    for (const d of drawables) {
      if (
        d.x < ox - 230 ||
        d.x > ox + this.width + 230 ||
        d.y < oy - 50 ||
        d.y > oy + this.height + 240
      )
        continue;
      if (d.renderType === "prop") this.drawProp(d, now, world);
      else if (d.renderType === "player") this.drawPlayer(d, now, game);
      else if (d.renderType === "remote") {
        this.drawPlayer(d, now, game);
        this.drawRemoteLabel(d, game);
      } else if (d.renderType === "fallen") this.drawFallen(d, now, game);
      else if (d.renderType === "power-object")
        this.drawPowerObject(d, now, game);
      else if (d.renderType === "construction") this.drawBuild(d, now, game);
      else if (d.renderType === "ambient") this.drawWildlife(d, now);
      else this.drawEntity(d, now, game);
    }
    this.drawEntityLabels(game);
    this.roomLabels(world, player);
    if (game.buildPreview) {
      c.save();
      c.strokeStyle = "#dfd69d";
      c.lineWidth = 1;
      c.setLineDash([5, 5]);
      c.strokeRect(350, 450, 300, 300);
      c.restore();
      const preview = game.buildPreview;
      this.drawBuild(preview.component, now, game, preview.valid);
    }
    if (
      model.activeRitual &&
      (!model.activeRitual.anchor?.siteId ||
        model.activeRitual.anchor.siteId === game.zone?.id)
    )
      this.ritualCircle(model.activeRitual, now);
    for (const e of game.effects || [])
      this.drawEffect(e, now, game.time || now / 1000, game);
    for (let i = 0; i < 34; i++) {
      const x = ox + ((i * 137.9 + Math.sin(now / 4000 + i) * 25) % this.width),
        y = oy + ((i * 83.3 - now * 0.007 + this.height * 100) % this.height);
      c.globalAlpha = 0.2 + Math.sin(now / 1000 + i * 3) * 0.15;
      c.fillStyle =
        region === "hell"
          ? i % 3
            ? "#df936a"
            : "#e7b483"
          : region === "desert"
            ? "#e7d3a3"
            : i % 3
              ? "#c4d4a0"
              : "#b3d9c9";
      c.fillRect(x, y, i % 4 ? 2 : 3, 2);
    }
    c.globalAlpha = 1;
    c.restore();
    this.atmosphere(game, model, now);
    const vignette = c.createRadialGradient(
      this.width / 2,
      this.height / 2,
      this.width * 0.25,
      this.width / 2,
      this.height / 2,
      this.width * 0.8,
    );
    vignette.addColorStop(0, "rgba(9,16,31,0)");
    vignette.addColorStop(1, "rgba(6,13,29,.36)");
    c.fillStyle = vignette;
    c.fillRect(0, 0, this.width, this.height);
  }
  architecturalDetails(world, player, now) {
    const c = this.ctx,
      p =
        PALETTES[world.realm === "heaven" ? "heaven" : biome(world)] ||
        PALETTES.forest,
      accent =
        world.realm === "hell"
          ? "#e987b9"
          : world.realm === "heaven"
            ? "#c8bdff"
            : "#74dfd3";
    const visible = (x, y, r = 300) =>
      x > this.camera.x - r &&
      x < this.camera.x + this.width + r &&
      y > this.camera.y - r &&
      y < this.camera.y + this.height + r;
    for (const room of world.interiors || []) {
      if (
        !visible(
          room.x + room.width / 2,
          room.y + room.height / 2,
          Math.max(room.width, room.height),
        )
      )
        continue;
      const inside =
        player.x > room.x - 30 &&
        player.x < room.x + room.width + 30 &&
        player.y > room.y - 30 &&
        player.y < room.y + room.height + 30;
      c.save();
      c.strokeStyle = blend(p.dark, "#0c1632", 0.4);
      c.lineWidth = 12;
      c.beginPath();
      c.moveTo(room.x, room.y + room.height);
      c.lineTo(room.x, room.y);
      c.lineTo(room.x + room.width, room.y);
      c.lineTo(room.x + room.width, room.y + room.height);
      c.stroke();
      c.strokeStyle = p.pathLight;
      c.lineWidth = 2;
      c.stroke();
      for (const [x, y] of [
        [room.x, room.y],
        [room.x + room.width, room.y],
        [room.x, room.y + room.height],
        [room.x + room.width, room.y + room.height],
      ]) {
        c.fillStyle = p.dark;
        c.fillRect(x - 10, y - 29, 20, 30);
        c.fillStyle = p.path;
        c.fillRect(x - 12, y - 33, 24, 6);
        c.fillStyle = p.pathLight;
        c.fillRect(x - 10, y - 33, 20, 2);
        c.fillStyle = accent;
        c.fillRect(x - 2, y - 24, 4, 14);
      }
      const cx = room.x + room.width / 2,
        cy = room.y + room.height / 2;
      c.globalAlpha = 0.25;
      c.strokeStyle = accent;
      c.lineWidth = 1;
      c.beginPath();
      c.ellipse(
        cx,
        cy,
        Math.min(room.width, room.height) * 0.23,
        Math.min(room.width, room.height) * 0.18,
        0,
        0,
        TAU,
      );
      c.stroke();
      c.globalAlpha = 1;
      if (!inside) {
        const beam = c.createLinearGradient(cx, room.y - 60, cx, room.y + 15);
        beam.addColorStop(0, "rgba(137,189,241,0)");
        beam.addColorStop(1, "rgba(137,189,241,.15)");
        c.fillStyle = beam;
        c.fillRect(room.x + 20, room.y - 60, room.width - 40, 74);
      }
      c.restore();
    }
    for (const feature of world.architecturalFeatures || []) {
      const { x, y } = feature;
      if (!visible(x, y, 260)) continue;
      this.drawArchitectureFeature(feature, now, world);
    }
    for (const district of world.districts || []) {
      if (!visible(district.x, district.y, 100)) continue;
      const d = Math.hypot(player.x - district.x, player.y - district.y);
      if (d < 430) {
        c.save();
        c.globalAlpha = clamp((430 - d) / 150, 0, 0.65);
        c.font = "600 12px Inter, sans-serif";
        c.textAlign = "center";
        c.fillStyle = accent;
        c.fillText(
          String(district.name || "").toUpperCase(),
          district.x,
          district.y - (district.radius || 200) * 0.6,
        );
        c.restore();
      }
    }
  }
  drawArchitectureFeature(f, now, world) {
    const c = this.ctx,
      p =
        PALETTES[world.realm === "heaven" ? "heaven" : biome(world)] ||
        PALETTES.forest,
      x = f.x,
      y = f.y,
      w = clamp(f.width || 100, 60, 240),
      h = clamp(f.height || 100, 60, 230),
      accent =
        f.accent ||
        (world.realm === "hell"
          ? "#f395b2"
          : world.realm === "heaven"
            ? "#b8bdff"
            : "#79dcd8");
    c.save();
    c.translate(x, y);
    c.fillStyle = "rgba(5,14,30,.27)";
    c.beginPath();
    c.ellipse(9, 10, w * 0.63, w * 0.23, 0, 0, TAU);
    c.fill();
    if (f.type === "garden") {
      for (let r = 2; r >= 0; r--) {
        c.strokeStyle = r === 1 ? accent : p.pathLight;
        c.lineWidth = r === 1 ? 2 : 5;
        c.beginPath();
        c.ellipse(0, 0, w * (0.2 + r * 0.16), h * (0.12 + r * 0.08), 0, 0, TAU);
        c.stroke();
      }
      for (let i = 0; i < 10; i++) {
        const a = (i * TAU) / 10;
        this.glow(
          Math.cos(a) * w * 0.45,
          Math.sin(a) * h * 0.2 - 7,
          18,
          accent,
          0.18,
        );
        c.fillStyle = i % 2 ? accent : "#d6c3ef";
        c.fillRect(
          Math.cos(a) * w * 0.45 - 3,
          Math.sin(a) * h * 0.2 - 14,
          6,
          8,
        );
      }
    } else if (f.type === "bridge") {
      c.fillStyle = p.dark;
      c.fillRect(-w / 2, -h * 0.25, w, h * 0.5);
      c.fillStyle = p.path;
      c.fillRect(-w / 2, -h * 0.25 - 9, w, h * 0.5);
      for (let i = -w / 2; i < w / 2; i += 18) {
        c.strokeStyle = p.pathLight;
        c.strokeRect(i, -h * 0.25 - 8, 16, h * 0.5 - 2);
      }
      for (const yy of [-h * 0.25, h * 0.25 - 10]) {
        c.fillStyle = accent;
        c.fillRect(-w / 2, yy - 10, w, 3);
      }
    } else if (f.type === "arch") {
      for (const side of [-1, 1]) {
        c.fillStyle = p.dark;
        c.fillRect(side * w * 0.35 - 9, -h, 18, h);
        c.fillStyle = p.pathLight;
        c.fillRect(side * w * 0.35 - 7, -h, 4, h);
        c.fillStyle = accent;
        c.fillRect(side * w * 0.35 - 2, -h * 0.75, 4, h * 0.32);
      }
      c.strokeStyle = p.path;
      c.lineWidth = 16;
      c.beginPath();
      c.ellipse(0, -h, w * 0.35, h * 0.27, 0, Math.PI, TAU);
      c.stroke();
      c.strokeStyle = accent;
      c.lineWidth = 2;
      c.stroke();
      this.glow(0, -h * 0.75, w * 0.65, accent, 0.08);
    } else if (f.type === "forge") {
      c.fillStyle = p.dark;
      c.fillRect(-w * 0.38, -h * 0.5, w * 0.76, h * 0.5);
      c.fillStyle = p.path;
      c.fillRect(-w * 0.42, -h * 0.55, w * 0.84, 8);
      const fire = c.createRadialGradient(
        0,
        -h * 0.3,
        2,
        0,
        -h * 0.3,
        w * 0.35,
      );
      fire.addColorStop(0, "#ffe5a5");
      fire.addColorStop(0.3, "#eb8f85");
      fire.addColorStop(1, "rgba(234,100,129,0)");
      c.fillStyle = fire;
      c.fillRect(-w * 0.35, -h * 0.7, w * 0.7, h * 0.7);
      for (let i = 0; i < 6; i++) {
        c.fillStyle = i % 2 ? "#ffc996" : "#eb9cff";
        c.fillRect(
          Math.sin(i * 3 + now / 600) * w * 0.17,
          -h * 0.25 - ((now / 25 + i * 17) % h) * 0.6,
          2,
          5,
        );
      }
    } else {
      const tower = f.type === "tower" || f.type === "observatory",
        span = tower ? w * 0.3 : w * 0.18;
      c.fillStyle = p.dark;
      c.fillRect(-span, -h, span * 2, h);
      c.fillStyle = p.path;
      c.fillRect(-span + 3, -h + 4, span * 2 - 6, h - 8);
      c.fillStyle = p.pathLight;
      c.fillRect(-span + 5, -h + 5, 5, h - 12);
      c.fillStyle = blend(p.path, p.dark, 0.35);
      c.fillRect(span - 12, -h + 5, 9, h - 10);
      for (const yy of [-h, -h * 0.6, -6]) {
        c.fillStyle = p.dark;
        c.fillRect(-span - 6, yy, span * 2 + 12, 6);
        c.fillStyle = p.pathLight;
        c.fillRect(-span - 6, yy, span * 2 + 12, 2);
      }
      c.fillStyle = accent;
      c.fillRect(-3, -h * 0.8, 6, h * 0.35);
      this.glow(0, -h * 0.65, 48, accent, 0.16);
      if (f.type === "observatory") {
        c.strokeStyle = accent;
        c.lineWidth = 2;
        for (const r of [span * 0.8, span * 1.1]) {
          c.beginPath();
          c.ellipse(0, -h - 9, r, r * 0.5, now / 10000, 0, TAU);
          c.stroke();
        }
        c.fillStyle = "#dceaff";
        c.beginPath();
        c.arc(0, -h - 9, 5, 0, TAU);
        c.fill();
      } else if (tower) {
        c.fillStyle = p.dark;
        c.beginPath();
        c.moveTo(-span - 9, -h);
        c.lineTo(0, -h - 38);
        c.lineTo(span + 9, -h);
        c.fill();
        c.strokeStyle = accent;
        c.lineWidth = 2;
        c.stroke();
      }
    }
    c.restore();
  }
  telegraph(e, now) {
    const c = this.ctx,
      tx = e.attackTarget?.x ?? e.x,
      ty = e.attackTarget?.y ?? e.y,
      r = e.attackRadius || e.radius || 48,
      from = e.attackFrom || e,
      shape = e.attackShape || "circle";
    c.save();
    c.fillStyle = e.active ? "rgba(230,114,76,.27)" : "rgba(220,151,91,.17)";
    c.strokeStyle = e.active ? "#f3b087" : "#ddb689";
    c.lineWidth = 2;
    c.beginPath();
    if (shape === "line") {
      const a = Math.atan2(ty - from.y, tx - from.x),
        dx = Math.cos(a + Math.PI / 2) * r * 0.3,
        dy = Math.sin(a + Math.PI / 2) * r * 0.3;
      c.moveTo(from.x + dx, from.y + dy);
      c.lineTo(tx + dx, ty + dy);
      c.lineTo(tx - dx, ty - dy);
      c.lineTo(from.x - dx, from.y - dy);
      c.closePath();
    } else if (shape === "cone") {
      const a = Math.atan2(ty - from.y, tx - from.x);
      c.moveTo(from.x, from.y);
      c.arc(from.x, from.y, r, a - 0.6, a + 0.6);
      c.closePath();
    } else c.ellipse(tx, ty, r, r * 0.65, 0, 0, TAU);
    c.fill();
    c.stroke();
    c.globalAlpha = 0.5 + Math.sin(now / 130) * 0.2;
    c.setLineDash([5, 5]);
    c.stroke();
    c.restore();
  }
  waterfall(world, now) {
    if (world.authored) {
      for (const fall of world.waterfalls || []) {
        const c = this.ctx,
          w = fall.width || 90,
          h = fall.height || 140;
        c.save();
        c.fillStyle = "#76b2b5";
        c.fillRect(fall.x - w / 2, fall.y - h, w, h);
        for (let i = 0; i < 15; i++) {
          c.fillStyle = i % 2 ? "#d2e8d8" : "#a3d4cc";
          c.globalAlpha = 0.45;
          c.fillRect(
            fall.x - w / 2 + (i * w) / 15,
            fall.y - h + ((i * 27 + now * 0.12) % h),
            3,
            Math.min(27, h / 3),
          );
        }
        c.globalAlpha = 0.4;
        c.fillStyle = "#d8eee0";
        c.beginPath();
        c.ellipse(fall.x, fall.y, w * 0.7, 17, 0, 0, TAU);
        c.fill();
        c.restore();
      }
      return;
    }
    if (biome(world) !== "water") return;
    const c = this.ctx,
      x = riverX(430);
    c.save();
    c.fillStyle = "#3b6876";
    c.fillRect(x - 58, 375, 116, 147);
    c.fillStyle = "#7fbdbe";
    c.fillRect(x - 53, 380, 106, 149);
    for (let i = 0; i < 16; i++) {
      const xx = x - 48 + i * 6,
        yy = 380 + ((i * 31 + now * 0.14) % 144);
      c.fillStyle = i % 3 ? "#bddcd2" : "#e5f0dc";
      c.globalAlpha = 0.35 + (i % 4) * 0.1;
      c.fillRect(xx, yy, 3, 22 + (i % 4) * 8);
    }
    c.globalAlpha = 0.6;
    c.fillStyle = "#c1e3d3";
    c.beginPath();
    c.ellipse(x, 529, 85, 22, 0, 0, TAU);
    c.fill();
    for (let i = 0; i < 24; i++) {
      const t = (now / 900 + i * 0.17) % 1,
        xx = x + Math.sin(i * 2.8) * 70 * t;
      c.globalAlpha = (1 - t) * 0.7;
      c.fillStyle = "#e0eee1";
      c.fillRect(
        xx,
        526 - Math.sin(t * Math.PI) * 22,
        2 + (i % 3),
        2 + (i % 2),
      );
    }
    c.restore();
    this.glow(x, 523, 95, "#c6e6dc", 0.1);
  }
  drawWildlife(e, now) {
    const imported = e.imported || e.sprite?.startsWith("vendor/"),
      im = this.image(
        assetUrl(`/assets/${e.sprite}${imported ? "" : "-sheet"}.png`),
      );
    if (!im) return;
    const bob = imported
      ? Math.sin(now / 500 + (e.phase || 0)) * 0.8
      : e.sprite === "deer"
        ? 0
        : Math.sin(now / 300 + (e.phase || 0)) * 2;
    this.ctx.save();
    this.ctx.globalAlpha = 0.92;
    if (imported)
      this.ctx.drawImage(
        im,
        Math.round(e.x - im.width * 1.5),
        Math.round(e.y - im.height * 3 + bob),
        im.width * 3,
        im.height * 3,
      );
    else
      this.ctx.drawImage(
        im,
        (Math.floor(now / 300 + (e.phase || 0)) % 4) * 40,
        0,
        40,
        40,
        Math.round(e.x - 16),
        Math.round(e.y - 29 + bob),
        32,
        32,
      );
    this.ctx.restore();
  }
  drawRemoteLabel(p, game) {
    const c = this.ctx,
      party = p.partyId && p.partyId === game.network?.partyId;
    c.save();
    c.strokeStyle = party ? "#7af2d3" : "#a8b8ff";
    c.globalAlpha = 0.6;
    c.lineWidth = 1;
    c.beginPath();
    c.ellipse(p.x, p.y + 2, 18, 7, 0, 0, TAU);
    c.stroke();
    c.restore();
    if (
      p.showName !== false &&
      Math.hypot(p.x - game.player.x, p.y - game.player.y) < 600
    )
      this.queueEntityLabel(
        { ...p, labelCaption: party ? "Party member" : null },
        game,
      );
  }

  roomLabels(world, player) {
    const c = this.ctx;
    for (const room of world.interiors || []) {
      const inside =
        player.x > room.x &&
        player.x < room.x + room.width &&
        player.y > room.y &&
        player.y < room.y + room.height;
      if (
        !inside &&
        Math.hypot(
          player.x - room.x - room.width / 2,
          player.y - room.y - room.height / 2,
        ) > 700
      )
        continue;
      c.save();
      c.font = "11px Georgia";
      c.textAlign = "center";
      const label = room.name || "Interior",
        x = room.x + room.width / 2,
        y = room.y + 20,
        w = c.measureText(label).width;
      c.fillStyle = "rgba(10,23,45,.82)";
      c.fillRect(x - w / 2 - 10, y - 11, w + 20, 20);
      c.fillStyle = "#cbd9f3";
      c.fillText(label, x, y + 3);
      c.restore();
    }
  }
  drawBuild(p, now, game, preview = null) {
    if (!p) return;
    const c = this.ctx,
      name = p.sprite || `build-${p.templateId}`,
      im = this.image(assetUrl(`/assets/${name}.png`)),
      meta = this.manifest?.props?.[name];
    c.save();
    c.translate(p.x, p.y);
    c.rotate(((p.rotation || 0) * Math.PI) / 180);
    const faded =
      p.layer === "canopy" &&
      Math.hypot(game.player.x - p.x, game.player.y - p.y) < 90;
    c.globalAlpha = preview !== null ? 0.55 : faded ? 0.38 : 1;
    if (im) {
      const a = meta?.anchor || [im.width / 2, im.height - 12];
      c.drawImage(im, -a[0], -a[1]);
    } else {
      c.fillStyle = "#9bae8b";
      c.fillRect(
        -(p.width || 30) / 2,
        -(p.height || 30) / 2,
        p.width || 30,
        p.height || 30,
      );
    }
    if (
      p.templateId === "light" ||
      p.templateId === "forge" ||
      p.templateId === "portal"
    )
      this.glow(
        0,
        -23,
        p.templateId === "portal" ? 58 : 40,
        p.templateId === "portal" ? "#b9dfbe" : "#efcd8e",
        0.18 + Math.sin(now / 250) * 0.02,
      );
    c.restore();
    if (preview !== null) {
      c.save();
      c.strokeStyle = preview ? "#c3e9bd" : "#e9a191";
      c.fillStyle = preview ? "rgba(157,217,175,.12)" : "rgba(221,133,120,.2)";
      c.setLineDash([4, 3]);
      c.lineWidth = 1.5;
      c.fillRect(p.x - p.width / 2, p.y - p.height / 2, p.width, p.height);
      c.strokeRect(p.x - p.width / 2, p.y - p.height / 2, p.width, p.height);
      c.restore();
    }
  }
  counterAnchors(conditions, game, now) {
    const c = this.ctx,
      zone = game.zone?.id || game.world.zoneId;
    for (const condition of conditions.filter((r) => r.active)) {
      for (const a of condition.anchors || []) {
        if (a.siteId && a.siteId !== zone) continue;
        const complete = (condition.counterProgress || []).includes(a.id);
        c.save();
        c.translate(a.x, a.y);
        c.strokeStyle = complete ? "#afcba0" : "#d6c58d";
        c.fillStyle = complete
          ? "rgba(171,209,163,.12)"
          : "rgba(222,196,137,.08)";
        c.lineWidth = 1.5;
        c.beginPath();
        c.ellipse(0, 0, 32, 20, 0, 0, TAU);
        c.fill();
        c.stroke();
        c.beginPath();
        c.moveTo(0, -18);
        c.lineTo(25, 0);
        c.lineTo(0, 18);
        c.lineTo(-25, 0);
        c.closePath();
        c.stroke();
        for (let i = 0; i < 4; i++) {
          const t = (i * TAU) / 4 + now / 9000;
          c.fillStyle = "#d9d7ac";
          c.fillRect(Math.cos(t) * 24 - 1, Math.sin(t) * 15 - 1, 3, 3);
        }
        c.font = "17px Georgia";
        c.textAlign = "center";
        c.fillStyle = complete ? "#c9e3b7" : "#e4d5a5";
        c.fillText(complete ? "✓" : "◇", 0, -17);
        if (Math.hypot(game.player.x - a.x, game.player.y - a.y) < 250) {
          c.font = "10px Georgia";
          const label = a.title || "Recovery anchor",
            width = c.measureText(label).width;
          c.fillStyle = "rgba(26,43,38,.8)";
          c.fillRect(-width / 2 - 7, -48, width + 14, 18);
          c.fillStyle = "#e8dfb9";
          c.fillText(label, 0, -35);
        }
        c.restore();
        this.glow(a.x, a.y - 17, 48, complete ? "#c0dfa8" : "#d9c58b", 0.13);
      }
    }
  }
  ritualCircle(r, now) {
    if (r.status === "complete" || r.status === "cancelled") return;
    const c = this.ctx,
      a = r.anchor || { x: 915, y: 736 },
      rr = 70 + (r.stage || 0) * 8;
    c.save();
    c.strokeStyle = r.status === "paused" ? "#c4a38f" : "#d7d5a4";
    c.lineWidth = 2;
    c.globalAlpha = 0.55 + Math.sin(now / 600) * 0.12;
    for (const radius of [rr, rr + 12]) {
      c.beginPath();
      c.ellipse(a.x, a.y, radius, radius * 0.65, 0, 0, TAU);
      c.stroke();
    }
    for (let i = 0; i < 8; i++) {
      const t = (i * TAU) / 8 + now / 13000,
        x = a.x + Math.cos(t) * rr,
        y = a.y + Math.sin(t) * rr * 0.65;
      c.fillStyle = "#e7e6b6";
      c.fillRect(x - 2, y - 6, 4, 12);
    }
    c.font = "10px Georgia";
    c.textAlign = "center";
    c.fillStyle = "#f0e5b5";
    c.fillText(r.powerName || "Ritual in progress", a.x, a.y - rr * 0.65 - 18);
    const beam = c.createLinearGradient(a.x, a.y - 260, a.x, a.y);
    beam.addColorStop(0, "rgba(218,235,187,0)");
    beam.addColorStop(1, "rgba(218,235,187,.21)");
    c.fillStyle = beam;
    c.beginPath();
    c.moveTo(a.x - 12, a.y);
    c.lineTo(a.x - 35, a.y - 260);
    c.lineTo(a.x + 35, a.y - 260);
    c.lineTo(a.x + 12, a.y);
    c.fill();
    c.restore();
    this.glow(a.x, a.y - 20, rr, "#d6dfa9", 0.12);
  }
  atmosphere(game, model, now) {
    const c = this.ctx,
      b = biome(game.world),
      phase = model.phase || "day",
      weather = model.weather || {},
      kind = (weather.id || "clear").toLowerCase(),
      intensity = clamp(weather.intensity ?? 0.6, 0, 1),
      w = this.width,
      h = this.height;
    c.save();
    if (phase === "night") {
      c.fillStyle = "rgba(23,34,62,.28)";
      c.fillRect(0, 0, w, h);
    } else if (phase === "dusk") {
      c.fillStyle = "rgba(103,64,74,.16)";
      c.fillRect(0, 0, w, h);
    } else if (phase === "dawn") {
      c.fillStyle = "rgba(213,161,116,.10)";
      c.fillRect(0, 0, w, h);
    } else if (!/rain|storm|fog/.test(kind) && b !== "hell") {
      const sun = c.createLinearGradient(0, 0, w * 0.7, h);
      sun.addColorStop(0, "rgba(175,211,255,.1)");
      sun.addColorStop(0.65, "rgba(175,211,255,0)");
      c.fillStyle = sun;
      c.fillRect(0, 0, w, h);
      if (b === "forest" || b === "water" || b === "garden") {
        c.fillStyle = "rgba(165,233,255,.035)";
        for (let i = 0; i < 4; i++) {
          const x = (i * 293 + now * 0.002) % w;
          c.beginPath();
          c.moveTo(x - 20, 0);
          c.lineTo(x + 25, 0);
          c.lineTo(x + 290, h);
          c.lineTo(x + 190, h);
          c.fill();
        }
      }
    }
    if (/rain|storm/.test(kind)) {
      c.strokeStyle = `rgba(172,204,211,${0.18 + intensity * 0.2})`;
      c.lineWidth = 1;
      for (let i = 0; i < 70 + intensity * 70; i++) {
        const x = (i * 83 + now * 0.19) % w,
          y = (i * 137 + now * 0.46) % h;
        c.beginPath();
        c.moveTo(x, y);
        c.lineTo(x - 4 - (weather.wind || 0) * 2, y + 14);
        c.stroke();
      }
      if (/storm/.test(kind)) {
        c.fillStyle = "rgba(32,46,61,.12)";
        c.fillRect(0, 0, w, h);
      }
    }
    if (/snow/.test(kind) || b === "mountain") {
      for (let i = 0; i < 45; i++) {
        const x = (i * 127 + Math.sin(now / 2000 + i) * 15 + now * 0.008) % w,
          y = (i * 71 + now * 0.023) % h;
        c.globalAlpha = 0.25 + (i % 3) * 0.15;
        c.fillStyle = "#deede1";
        c.fillRect(x, y, 2 + (i % 2), 2);
      }
      c.globalAlpha = 1;
    }
    if (/sand|dust/.test(kind) || b === "desert") {
      c.strokeStyle = "rgba(223,196,139,.12)";
      for (let i = 0; i < 22; i++) {
        const x = (i * 137 + now * 0.045) % w,
          y = (i * 69 + Math.sin(now / 1500 + i) * 15) % h;
        c.beginPath();
        c.moveTo(x, y);
        c.quadraticCurveTo(x + 40, y - 12, x + 85, y);
        c.stroke();
      }
    }
    if (/fog|mist/.test(kind) || b === "water") {
      for (let i = 0; i < 4; i++) {
        const x = ((i * 330 + now * 0.005) % (w + 350)) - 150,
          y = h * 0.35 + i * 71;
        const fog = c.createRadialGradient(x, y, 0, x, y, 180);
        fog.addColorStop(
          0,
          `rgba(202,223,210,${/fog/.test(kind) ? 0.11 : 0.04})`,
        );
        fog.addColorStop(1, "transparent");
        c.fillStyle = fog;
        c.fillRect(x - 180, y - 180, 360, 360);
      }
    }
    if (b === "heaven" || game.world.realm === "heaven") {
      for (let i = 0; i < 5; i++) {
        const im = this.image(assetUrl("/assets/cloud.png"));
        if (im) {
          c.globalAlpha = 0.12;
          c.drawImage(
            im,
            ((i * 289 + now * 0.006) % (w + 200)) - 150,
            40 + ((i * 137) % h),
            240,
            130,
          );
        }
      }
      c.globalAlpha = 1;
    }
    if (phase === "night" || phase === "dusk") {
      for (const p of game.world.props.filter(
        (p) => p.kind === "lantern" || p.asset === "brazier",
      )) {
        const x = p.x - this.camera.x,
          y = p.y - this.camera.y - 36;
        if (x > -80 && x < w + 80 && y > -80 && y < h + 80)
          this.glow(x, y, 65, "#edc78a", phase === "night" ? 0.16 : 0.09);
      }
    }
    c.restore();
  }
  drawProp(p, now, world) {
    const c = this.ctx,
      x = Math.round(p.x),
      y = Math.round(p.y),
      s = p.scale || 1;
    const palette =
      PALETTES[world.variant === "infernal" ? "hell" : world.variant] ||
      PALETTES.forest;
    const b = biome(world),
      ruin =
        b === "heaven"
          ? "ruin-heaven"
          : b === "desert"
            ? "ruin-desert"
            : b === "hell"
              ? "ruin-infernal"
              : "ruin";
    const pathMap = {
      tree: p.tone === 1 ? "tree-oak-gold" : "tree-oak",
      pine: p.tone === 1 ? "tree-pine-blue" : "tree-pine",
      bush: p.tone === 1 ? "bush-berries" : "bush",
      rock: "rock-" + (p.tone || 0),
      flowers: p.tone === 1 ? "flowers-blue" : "flowers",
      shrine: "shrine",
      lantern:
        b === "hell"
          ? "lantern-infernal"
          : b === "heaven"
            ? "lantern-heaven"
            : "lantern",
      chest: "chest",
      arch: "temple-forest",
      obelisk: ruin,
      column: ruin,
    };
    const sizes = {
      tree: [96, 120],
      pine: [80, 132],
      bush: [42, 30],
      rock: [44, 34],
      flowers: [38, 22],
      shrine: [92, 106],
      lantern: [32, 58],
      arch: [138, 156],
      obelisk: [40, 80],
      column: [40, 47],
      sign: [48, 51],
    };
    // Individual assets use consistent bottom-center anchoring.
    let asset = p.asset || pathMap[p.kind];
    if (world.realm === "heaven") {
      if (
        ["tree-oak", "tree-oak-gold", "tree-pine", "tree-pine-blue"].includes(
          asset,
        )
      )
        asset = "tree-heaven";
      if (/^house-[0-2]$/.test(asset || ""))
        asset = asset.replace("house-", "house-heaven-");
      if (asset === "temple-forest") asset = "temple-heaven";
      if (asset === "shrine") asset = "shrine-heaven";
      if (asset === "ruin") asset = "ruin-heaven";
    }
    const image = asset ? this.image(assetUrl(`/assets/${asset}.png`)) : null;
    if (image) {
      const data = this.manifest?.props?.[asset];
      const w = image.width,
        h = image.height;
      const anchor = data?.anchor || [w / 2, h - 8];
      c.drawImage(image, x - anchor[0] * s, y - anchor[1] * s, w * s, h * s);
      if (p.kind === "lantern" || asset === "brazier")
        this.glow(
          x,
          y - 38,
          45,
          "#efce87",
          0.2 + Math.sin(now / 200 + x) * 0.025,
        );
      if (asset.includes("crystal"))
        this.glow(x, y - 20, 32, b === "hell" ? "#edac7f" : "#a7e4d5", 0.12);
      return;
    }
    c.save();
    c.translate(x, y);
    c.scale(s, s);
    if (p.kind === "pine" || p.kind === "tree") {
      c.fillStyle = "rgba(20,37,30,.25)";
      c.beginPath();
      c.ellipse(10, 4, 42, 16, 0, 0, TAU);
      c.fill();
      c.fillStyle = "#514e38";
      c.fillRect(-6, -44, 12, 44);
      c.fillStyle = "#6c6545";
      c.fillRect(-3, -40, 4, 37);
      if (p.kind === "pine") {
        const layers = [
          [-50, -25, 100, 23],
          [-43, -42, 86, 28],
          [-34, -63, 68, 28],
          [-25, -82, 50, 25],
          [-15, -100, 30, 24],
          [-7, -111, 14, 17],
        ];
        for (let i = 0; i < layers.length; i++) {
          const [xx, yy, w, h] = layers[i];
          c.fillStyle = i % 2 ? "#315a47" : "#294e3e";
          c.fillRect(xx + 8, yy, w - 16, h);
          c.fillRect(xx, yy + 13, w, h - 13);
          c.fillStyle = i % 2 ? "#466e4f" : "#3e674b";
          c.fillRect(xx + 5, yy + 7, w / 2, 8);
          c.fillStyle = "#527855";
          c.fillRect(xx + 10, yy + 7, 9, 3);
          c.fillRect(xx + w / 2, yy + 3, 10, 4);
        }
      } else {
        const blocks = [
          [-44, -55, 84, 32],
          [-49, -79, 96, 34],
          [-37, -98, 75, 29],
          [-22, -111, 45, 23],
        ];
        for (const [xx, yy, w, h] of blocks) {
          c.fillStyle = "#2c4e3e";
          c.fillRect(xx + 4, yy + 7, w, h);
          c.fillStyle = palette.tree;
          c.fillRect(xx, yy, w, h - 4);
          c.fillStyle = palette.treetop;
          c.fillRect(xx + 6, yy + 4, Math.floor(w * 0.65), 10);
          c.fillStyle = "#6d8b5b";
          c.globalAlpha = 0.45;
          c.fillRect(xx + 12, yy + 3, 19, 4);
          c.fillRect(xx + 8, yy + 17, 9, 4);
          c.globalAlpha = 1;
        }
        c.fillStyle = "#3d6247";
        c.fillRect(-40, -40, 26, 8);
        c.fillRect(17, -47, 21, 10);
      }
    } else if (p.kind === "rock" || p.kind === "column") {
      c.fillStyle = "rgba(20,36,30,.3)";
      c.fillRect(-21, -4, 48, 10);
      c.fillStyle = "#606f65";
      c.fillRect(-22, -19, 44, 22);
      c.fillRect(-15, -30, 31, 16);
      c.fillStyle = "#8b9986";
      c.fillRect(-15, -29, 28, 8);
      c.fillRect(-20, -19, 13, 9);
      c.fillStyle = "#a6ad94";
      c.fillRect(-11, -27, 14, 3);
      c.fillStyle = "#3e5b42";
      c.fillRect(-17, -3, 10, 5);
      if (p.kind === "column") {
        c.fillStyle = "#c1bea2";
        c.fillRect(-13, -44, 25, 16);
        c.fillStyle = "#858e7c";
        c.fillRect(-10, -43, 3, 14);
        c.fillRect(3, -43, 3, 14);
      }
    } else if (p.kind === "bush" || p.kind === "flowers") {
      c.fillStyle = "#2e4b36";
      c.fillRect(-22, -13, 44, 15);
      c.fillStyle = "#547347";
      c.fillRect(-18, -24, 30, 19);
      c.fillRect(-25, -15, 47, 13);
      c.fillStyle = "#75905b";
      c.fillRect(-16, -22, 12, 5);
      c.fillRect(8, -13, 9, 4);
      if (p.kind === "flowers" || p.tone === 1)
        for (let i = 0; i < 7; i++) {
          c.fillStyle = i % 2 ? "#c4b3a7" : "#b2c4ab";
          c.fillRect(-19 + i * 6, -17 - (i % 3) * 4, 4, 4);
          c.fillStyle = "#d9d2ab";
          c.fillRect(-18 + i * 6, -16 - (i % 3) * 4, 2, 2);
        }
    } else if (p.kind === "shrine") {
      this.glow(0, -38, 64, "#9de1d0", 0.13);
      c.fillStyle = "#525e56";
      c.fillRect(-44, -7, 88, 11);
      c.fillStyle = "#9b9f87";
      c.fillRect(-39, -14, 78, 10);
      c.fillStyle = "#c2bea0";
      c.fillRect(-32, -23, 64, 10);
      c.fillStyle = "#858d79";
      c.fillRect(-25, -36, 50, 15);
      c.fillStyle = "#d8d5b1";
      c.fillRect(-27, -39, 54, 6);
      c.fillStyle = "#648679";
      c.fillRect(-10, -71, 20, 30);
      c.fillStyle = "#a3e2c8";
      c.fillRect(-6, -77, 12, 34);
      c.fillStyle = "#d3f7d5";
      c.fillRect(-3, -70, 6, 21);
      c.fillStyle = "#6f8a71";
      c.fillRect(-15, -61, 5, 15);
      c.fillRect(10, -61, 5, 15);
      c.fillStyle = "#c7c7a5";
      c.fillRect(-19, -44, 38, 5);
    } else if (p.kind === "obelisk") {
      c.fillStyle = "#5c6f61";
      c.fillRect(-19, -7, 38, 12);
      c.fillStyle = "#8f9d84";
      c.fillRect(-15, -63, 30, 56);
      c.fillStyle = "#bec3a0";
      c.fillRect(-12, -68, 24, 9);
      c.fillStyle = "#788b76";
      c.fillRect(4, -60, 10, 51);
      c.fillStyle = "#c8dbb4";
      c.fillRect(-6, -52, 5, 21);
      c.fillRect(-9, -44, 12, 3);
      c.fillRect(-3, -29, 5, 4);
      c.fillStyle = "#49684f";
      c.fillRect(-14, -14, 12, 7);
    } else if (p.kind === "lantern") {
      this.glow(0, -40, 44, "#efce87", 0.13);
      c.fillStyle = "#3c4b3e";
      c.fillRect(-3, -42, 6, 43);
      c.fillStyle = "#79806a";
      c.fillRect(-9, -4, 18, 6);
      c.fillRect(-10, -52, 20, 6);
      c.fillRect(-8, -58, 16, 6);
      c.fillStyle = "#c2a877";
      c.fillRect(-7, -46, 14, 18);
      c.fillStyle = "#f0d899";
      c.fillRect(-4, -43, 8, 12);
      c.fillStyle = "#4d5a46";
      c.fillRect(-9, -31, 18, 4);
      c.fillRect(-8, -48, 3, 17);
      c.fillRect(5, -48, 3, 17);
    } else if (p.kind === "arch") {
      c.fillStyle = "rgba(19,35,29,.23)";
      c.fillRect(-67, -2, 142, 16);
      for (const xx of [-55, 37]) {
        c.fillStyle = "#667769";
        c.fillRect(xx, -101, 23, 103);
        c.fillStyle = "#a6af94";
        c.fillRect(xx - 6, -12, 35, 14);
        c.fillRect(xx - 4, -104, 31, 10);
        c.fillStyle = "#899a83";
        c.fillRect(xx + 3, -99, 6, 80);
        c.fillStyle = "#c2c4a5";
        c.fillRect(xx - 5, -104, 32, 3);
      }
      c.fillStyle = "#788d79";
      c.fillRect(-50, -117, 102, 20);
      c.fillRect(-39, -129, 79, 17);
      c.fillStyle = "#aeb89a";
      c.fillRect(-43, -119, 86, 7);
      c.fillStyle = "#cee5bb";
      c.fillRect(-5, -127, 10, 18);
      c.fillStyle = "#3a694e";
      c.fillRect(-56, -103, 21, 7);
      c.fillRect(-53, -94, 14, 12);
      c.fillRect(36, -29, 16, 17);
    } else if (p.kind === "sign") {
      c.fillStyle = "#534f39";
      c.fillRect(-3, -40, 7, 40);
      c.fillStyle = "#88815a";
      c.fillRect(-23, -42, 43, 13);
      c.fillStyle = "#b2a779";
      c.fillRect(-22, -41, 39, 3);
      c.fillStyle = "#414d38";
      c.fillRect(-15, -36, 20, 2);
      c.fillRect(-8, -48, 28, 8);
      c.fillStyle = "#b2a779";
      c.fillRect(-7, -48, 24, 2);
    }
    c.restore();
  }
  glow(x, y, radius, color, alpha = 0.25) {
    const c = this.ctx;
    c.save();
    const g = c.createRadialGradient(x, y, 0, x, y, radius);
    g.addColorStop(0, color);
    g.addColorStop(1, "transparent");
    c.globalAlpha = alpha;
    c.fillStyle = g;
    c.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    c.restore();
  }
  drawPlayer(p, now, game) {
    const c = this.ctx,
      x = Math.round(p.x),
      groundY = Math.round(p.y),
      time = game.time || 0,
      statuses = (p.statuses || []).filter(
        (s) => s.until == null || s.until > time,
      );
    const has = (type) => statuses.some((s) => s.type === type),
      flight = p.flying || has("flight"),
      veil = p.veil || p.veiled || has("veil") || has("invisibility"),
      ward = has("ward") || p.barrier > 0,
      guard = p.guard || p.guarding || game.keys?.has?.("g"),
      demon = p.lineage === "demon";
    const custom = resolveAppearanceColors(p.appearance, p.lineage),
      a = custom.appearance || custom,
      colors = custom.colors || custom;
    const skin = colors.skin || "#c79676",
      hair = colors.hair || "#26334e",
      armor = colors.armor || "#5487d7",
      aura = colors.aura || "#6ce7df",
      light = colors.armorLight || blend(armor, "#e4edff", 0.35),
      dark = colors.armorDark || blend(armor, "#13243b", 0.5);
    const local = p.renderType !== "remote",
      moving = p.walking || p.moving,
      walk = moving ? Math.sin(now / 100) : 0,
      breathe = moving ? 0 : Math.sin(now / 650) * 0.6,
      lift = flight ? 13 + Math.sin(now / 350) * 2 : 0,
      y = groundY - lift;
    const dir =
        typeof p.facing === "number"
          ? p.facing
          : { down: 0, left: 1, right: 2, up: 3 }[p.facing] || 0,
      side = dir === 1 ? -1 : dir === 2 ? 1 : 0,
      back = dir === 3,
      vanguard = a.bodyType === "vanguard",
      mystic = a.bodyType === "mystic",
      body = vanguard ? 12 : mystic ? 10 : 9;
    c.save();
    c.fillStyle = "rgba(4,12,27,.5)";
    c.beginPath();
    c.ellipse(x, groundY + 3, flight ? 20 : 16, flight ? 7 : 5, 0, 0, TAU);
    c.fill();
    if (local && !veil) {
      c.strokeStyle = aura;
      c.globalAlpha = 0.35;
      c.lineWidth = 1;
      c.beginPath();
      c.ellipse(x, groundY + 2, 22, 8, 0, 0, TAU);
      c.stroke();
      c.globalAlpha = 1;
      this.glow(x, y - 20, 44, aura, 0.11);
    }
    c.globalAlpha = veil ? 0.38 : 1;
    c.translate(x, y + breathe);
    // Cloth, body silhouette, face and lineage details are drawn from the same
    // palette choices as the creator, rather than recoloring an unrelated hero.
    if (!veil) {
      for (const wingSide of [-1, 1]) {
        const flap = Math.sin(now / (flight ? 200 : 1000)) * 2,
          span = flight ? 31 : 23;
        c.fillStyle = demon
          ? blend(aura, "#24263d", 0.65)
          : blend(aura, "#e5efff", 0.7);
        c.beginPath();
        c.moveTo(wingSide * 6, -30);
        c.lineTo(wingSide * span, -42 - flap);
        c.lineTo(wingSide * (span - 2), -22);
        c.lineTo(wingSide * 12, -18);
        c.closePath();
        c.fill();
        c.strokeStyle = demon ? blend(aura, "#8c5688", 0.35) : "#d4f0ff";
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(wingSide * 9, -28);
        c.lineTo(wingSide * (span - 3), -36 - flap);
        c.lineTo(wingSide * 15, -23);
        c.stroke();
      }
    }
    c.fillStyle = dark;
    c.beginPath();
    c.moveTo(-body, -29);
    c.lineTo(-body - 3 - walk * 1.2, -5);
    c.lineTo(0, -1);
    c.lineTo(body + 3 + walk * 1.2, -5);
    c.lineTo(body, -29);
    c.fill();
    c.fillStyle = "#15263c";
    c.fillRect(-8, -11, 6, 11 + walk * 2);
    c.fillRect(3, -11, 6, 11 - walk * 2);
    c.fillStyle = "#334760";
    c.fillRect(-9, -3 + walk * 2, 8, 5);
    c.fillRect(2, -3 - walk * 2, 8, 5);
    c.fillStyle = armor;
    c.fillRect(-body, -31, body * 2, 24);
    c.fillStyle = light;
    c.fillRect(-body + 2, -29, 4, 17);
    c.fillRect(-body, -32, body * 2, 4);
    c.fillStyle = dark;
    c.fillRect(4, -27, body - 4, 18);
    if (mystic) {
      c.fillStyle = armor;
      c.beginPath();
      c.moveTo(-9, -16);
      c.lineTo(-14, -2);
      c.lineTo(14, -2);
      c.lineTo(9, -16);
      c.fill();
      c.strokeStyle = light;
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(0, -28);
      c.lineTo(0, -4);
      c.moveTo(-12, -3);
      c.lineTo(12, -3);
      c.stroke();
    }
    if (vanguard) {
      for (const armSide of [-1, 1]) {
        c.fillStyle = dark;
        c.fillRect(armSide < 0 ? -17 : 10, -31, 7, 10);
        c.fillStyle = light;
        c.fillRect(armSide < 0 ? -17 : 10, -33, 7, 5);
      }
      c.fillStyle = "#c9d8e9";
      c.fillRect(13, -25, 3, 23);
      c.fillStyle = aura;
      c.fillRect(12, -14, 5, 2);
    }
    c.fillStyle = skin;
    c.fillRect(-body - 5, -23 + walk, 5, 11);
    c.fillRect(body, -23 - walk, 5, 11);
    c.fillStyle = armor;
    c.fillRect(-body - 5, -28 + walk, 5, 8);
    c.fillRect(body, -28 - walk, 5, 8);
    c.fillStyle = dark;
    c.fillRect(-body, -12, body * 2, 4);
    c.fillStyle = aura;
    c.fillRect(-2, -12, 4, 4);
    c.fillStyle = blend(skin, "#503a53", 0.25);
    c.fillRect(-5 + side, -39, 10, 10);
    c.fillStyle = skin;
    c.fillRect(-8 + side, -47, 16, 15);
    c.fillRect(-6 + side, -32, 12, 3);
    c.fillStyle = blend(skin, "#ffe4cb", 0.28);
    c.fillRect(-6 + side, -45, 6, 9);
    if (!back) {
      c.fillStyle = "#16243b";
      if (side !== 1) c.fillRect(-4 + side, -39, 2, 2);
      if (side !== -1) c.fillRect(3 + side, -39, 2, 2);
      c.fillStyle = blend(skin, "#7d4a58", 0.4);
      c.fillRect(side - 1, -34, 3, 1);
    }
    const style = Number(a.hairStyle) || 0;
    c.fillStyle = hair;
    c.fillRect(-9 + side, -49, 18, 5);
    c.fillRect(-9 + side, -45, 3, 10);
    if (style === 0) c.fillRect(5 + side, -45, 4, 5);
    if (style === 1) {
      c.beginPath();
      c.moveTo(-10, -48);
      c.lineTo(10, -51);
      c.lineTo(7, -39);
      c.lineTo(-4, -44);
      c.fill();
    }
    if (style === 2) {
      c.fillRect(-11, -46, 4, 20);
      c.fillRect(7, -45, 4, 22);
      if (back) c.fillRect(-9, -44, 18, 16);
    }
    if (style === 3) {
      c.fillRect(-3, -57, 6, 10);
      c.fillRect(2, -54, 5, 7);
    }
    if (back) c.fillRect(-7, -45, 14, 12);
    c.fillStyle = blend(hair, "#d4e8ff", 0.28);
    c.fillRect(-6, -48, 8, 2);
    if (!veil && demon) {
      c.fillStyle = blend(aura, "#ede4ee", 0.5);
      for (const hornSide of [-1, 1]) {
        c.beginPath();
        c.moveTo(hornSide * 7, -46);
        c.lineTo(hornSide * 12, -58);
        c.lineTo(hornSide * 4, -50);
        c.fill();
      }
    } else if (!veil) {
      c.strokeStyle = aura;
      c.lineWidth = 1.8;
      c.beginPath();
      c.ellipse(0, -57 + Math.sin(now / 700), 10, 3, 0, 0, TAU);
      c.stroke();
    }
    if (!back) {
      c.fillStyle = aura;
      c.fillRect(-1, -27, 3, 4);
      this.glow(0, -25, 10, aura, 0.35);
    }
    c.restore();
    if (ward || guard) {
      c.save();
      c.strokeStyle = ward ? aura : "#add7ff";
      c.fillStyle = "rgba(104,190,244,.06)";
      c.lineWidth = ward ? 1.5 : 2.5;
      c.beginPath();
      c.ellipse(
        x,
        y - 25,
        ward ? 28 : 26,
        ward ? 38 : 32,
        0,
        guard ? Math.PI * 0.1 : 0,
        guard ? Math.PI * 0.95 : TAU,
      );
      c.fill();
      c.stroke();
      if (ward) {
        c.globalAlpha = 0.35;
        c.setLineDash([3, 8]);
        c.beginPath();
        c.ellipse(x, y - 25, 33, 42, now / 4000, 0, TAU);
        c.stroke();
      }
      c.restore();
    }
    if (veil) {
      c.save();
      c.strokeStyle = "#c0a1ff";
      c.globalAlpha = 0.45;
      c.setLineDash([3, 5]);
      c.beginPath();
      c.ellipse(x, y - 23, 28, 37, Math.sin(now / 1600) * 0.1, 0, TAU);
      c.stroke();
      c.restore();
    }
    if (p.dodgeUntil > time) {
      c.save();
      c.globalAlpha = 0.5;
      c.strokeStyle = aura;
      c.lineWidth = 2;
      c.beginPath();
      c.arc(x, y - 15, 28, Math.PI * 0.2, Math.PI * 1.1);
      c.stroke();
      c.restore();
    }
  }
  drawFallen(e, now, game) {
    const c = this.ctx,
      im = e.creatureId
        ? this.image(assetUrl(`/assets/creature-${e.creatureId}-sheet.png`))
        : this.image(assetUrl("/assets/npc-jobs/medic-sheet.png"));
    c.save();
    c.globalAlpha = 0.42;
    if (im) {
      const sw = e.creatureId ? 40 : 40,
        sh = e.creatureId ? 40 : 48;
      c.drawImage(im, 0, 0, sw, sh, e.x - 22, e.y - 21, 44, 25);
    }
    c.strokeStyle = "#b6bac7";
    c.setLineDash([3, 4]);
    c.lineWidth = 1;
    c.beginPath();
    c.ellipse(e.x, e.y, 25, 10, 0, 0, TAU);
    c.stroke();
    c.globalAlpha = 0.75;
    c.fillStyle = "#c3ced5";
    c.font = "16px Georgia";
    c.textAlign = "center";
    c.fillText("✧", e.x, e.y - 29);
    c.restore();
    if (game.targetId === e.id) {
      c.save();
      c.font = "10px Georgia";
      c.textAlign = "center";
      c.fillStyle = "#d8d5bf";
      c.fillText(`${e.name} · fallen`, e.x, e.y + 20);
      c.restore();
    }
  }
  drawPowerObject(o, now, game) {
    const c = this.ctx;
    c.save();
    if (o.kind === "barrier") {
      const w = o.width || 80,
        h = o.height || 16;
      c.fillStyle = "#684f50";
      c.fillRect(o.x - w / 2, o.y - h / 2, w, h);
      c.strokeStyle = "#e6bd83";
      c.lineWidth = 2;
      c.strokeRect(o.x - w / 2, o.y - h / 2, w, h);
      for (let i = 0; i < Math.max(3, w / 10); i++) {
        const x = o.x - w / 2 + 5 + i * 10,
          h = 14 + Math.sin(now / 120 + i * 1.4) * 6;
        c.fillStyle = i % 2 ? "#e7a56c" : "#f2cc8a";
        c.fillRect(x, o.y - h, 5, h);
        c.fillStyle = "#fff0b9";
        c.fillRect(x + 1, o.y - h + 4, 2, h - 6);
      }
      this.glow(o.x, o.y - 8, 65, "#efa96b", 0.12);
    } else if (o.branchId === "fire-create") {
      const im =
        this.image(assetUrl(`/assets/vfx/${o.powerId}.png`)) ||
        this.image(assetUrl("/assets/vfx/family-fire-create.png"));
      if (im)
        c.drawImage(
          im,
          (Math.floor(now / 100) % 8) * 96,
          0,
          96,
          96,
          o.x - 35,
          o.y - 45,
          70,
          70,
        );
      this.glow(o.x, o.y - 12, 30, "#e8b177", 0.15);
    } else
      this.drawProp(
        { kind: "flowers", asset: "flowers", x: o.x, y: o.y, scale: 0.8 },
        now,
        game.world,
      );
    c.restore();
  }
  drawMagicField(field, now, game) {
    const c = this.ctx,
      r = field.radius || 80;
    c.save();
    c.strokeStyle = field.color || "#a9c6b7";
    c.fillStyle =
      field.kind === "corruption"
        ? "rgba(155,116,145,.09)"
        : "rgba(166,198,147,.06)";
    c.lineWidth = 1.3;
    c.setLineDash([6, 8]);
    c.beginPath();
    c.ellipse(field.x, field.y, r, r * 0.65, 0, 0, TAU);
    c.fill();
    c.stroke();
    c.restore();
  }
  drawPurposeMarker(e, now, game) {
    const c = this.ctx,
      state = e.markerState;
    const quest = ["available", "objective", "turnin", "reward"].includes(
      state,
    );
    const near =
      game.targetId === e.id ||
      Math.hypot(e.x - game.player.x, e.y - game.player.y) < 190;
    if (!quest && !near) return;
    const symbol =
      state === "turnin" || state === "reward"
        ? "✓"
        : state === "available"
          ? "!"
          : state === "objective"
            ? "◆"
            : /merchant|trader/.test(e.role || "")
              ? "◇"
              : e.role === "keeper"
                ? "✦"
                : "·";
    const y =
      e.y -
      (e.kind === "world-activity" ? 69 : 66) +
      Math.sin(now / 700 + e.x) * 2;
    c.save();
    c.fillStyle = "#101d2d";
    c.strokeStyle = quest ? "#8de9ed" : "#73829e";
    c.lineWidth = 1.4;
    c.beginPath();
    c.arc(e.x, y - 5, quest ? 10 : 8, 0, TAU);
    c.fill();
    c.stroke();
    c.fillStyle =
      state === "turnin" || state === "reward" ? "#f4d99c" : "#a9f4ef";
    c.font = "bold 13px sans-serif";
    c.textAlign = "center";
    c.fillText(symbol, e.x, y);
    c.restore();
  }
  drawAdventureSite(e, now, game) {
    const c = this.ctx,
      x = e.x,
      y = e.y,
      t = now / 1000;
    const color = e.activityReady
      ? "#ffe09d"
      : e.activityPhase
        ? ["#82eee0", "#c6a8ff", "#f7b5db"][e.activityPhase - 1]
        : "#8ddcf0";
    c.save();
    this.glow(x, y - 22, 70, color, e.activityReady ? 0.18 : 0.08);
    c.strokeStyle = color;
    c.fillStyle = "#182b40";
    c.lineWidth = 1.6;
    c.beginPath();
    c.ellipse(x, y, 35, 15, 0, 0, TAU);
    c.fill();
    c.stroke();
    c.globalAlpha = 0.4;
    c.beginPath();
    c.ellipse(x, y, 45, 20, 0, 0, TAU);
    c.stroke();
    c.globalAlpha = 1;
    if (e.role === "relay-finish") {
      c.setLineDash([5, 5]);
      c.beginPath();
      c.ellipse(x, y - 9, 44, 23, 0, 0, TAU);
      c.stroke();
      c.setLineDash([]);
      for (let i = 0; i < 8; i++) {
        const a = t + (i * TAU) / 8;
        c.fillStyle = color;
        c.fillRect(x + Math.cos(a) * 32 - 1, y - 22 + Math.sin(a) * 13, 3, 3);
      }
    } else if (e.activityType === "runegate") {
      c.fillStyle = "#273950";
      c.fillRect(x - 29, y - 53, 10, 48);
      c.fillRect(x + 19, y - 53, 10, 48);
      c.strokeRect(x - 29, y - 53, 10, 48);
      c.strokeRect(x + 19, y - 53, 10, 48);
      c.beginPath();
      c.arc(x, y - 37, 24, Math.PI, TAU);
      c.stroke();
      c.font = "12px sans-serif";
      c.textAlign = "center";
      [1, 3, 2].forEach((n, i) => {
        c.fillStyle = i < (e.activityStep || 0) ? "#ffe09d" : "#a2d9ee";
        c.fillText(n, x - 18 + i * 18, y - 23);
      });
    } else if (e.activityType === "bloom") {
      for (let i = 0; i < 6; i++) {
        const a = (i * TAU) / 6 + t * 0.12;
        c.fillStyle = i % 2 ? "#ad9ee7" : "#86d4c2";
        c.beginPath();
        c.ellipse(
          x + Math.cos(a) * 14,
          y - 27 + Math.sin(a) * 9,
          10,
          5,
          a,
          0,
          TAU,
        );
        c.fill();
      }
      c.fillStyle = "#e8edcf";
      c.beginPath();
      c.arc(x, y - 27, 6, 0, TAU);
      c.fill();
    } else if (e.activityType === "pulsewell") {
      for (let i = 0; i < 3; i++) {
        c.globalAlpha = 0.3 + i * 0.2;
        c.beginPath();
        c.ellipse(x, y - 13 - i * 7, 24 - i * 4, 10 - i * 2, 0, 0, TAU);
        c.stroke();
      }
      c.globalAlpha = 1;
    } else {
      c.beginPath();
      c.moveTo(x, y - 57);
      c.lineTo(x + 17, y - 30);
      c.lineTo(x, y - 9);
      c.lineTo(x - 17, y - 30);
      c.closePath();
      c.fillStyle = "#244563";
      c.fill();
      c.stroke();
      c.beginPath();
      c.moveTo(x, y - 57);
      c.lineTo(x, y - 9);
      c.moveTo(x - 17, y - 30);
      c.lineTo(x + 17, y - 30);
      c.stroke();
      if (e.activityType === "ward")
        for (let i = 0; i < 3; i++) {
          c.fillStyle = e.activityFacets?.includes(i + 1)
            ? "#ffe09d"
            : "#556780";
          c.beginPath();
          c.arc(x - 16 + i * 16, y - 3, 3, 0, TAU);
          c.fill();
        }
      if (e.activityType === "skybridge") {
        c.beginPath();
        c.ellipse(x, y - 32, 30, 11, t * 0.3, 0, TAU);
        c.stroke();
      }
    }
    for (let i = 0; i < (e.activityStep || 0); i++) {
      c.fillStyle = "#ffe09d";
      c.fillRect(x - 12 + i * 8, y + 7, 4, 3);
    }
    c.restore();
    this.drawPurposeMarker(e, now, game);
    if (
      game.targetId === e.id ||
      Math.hypot(x - game.player.x, y - game.player.y) < 155
    )
      this.queueEntityLabel(e, game);
  }
  drawContractMarker(e, now, game) {
    const c = this.ctx,
      selected = game.targetId === e.id;
    if (e.sprite === "npc") this.drawJob(e, now);
    else if (e.sprite === "chest")
      this.sprite(
        assetUrl("/assets/vendor/superpowers/items/gold-chest-close.png"),
        e.x,
        e.y + 3,
        36,
        27,
      );
    else
      this.drawProp(
        { kind: "obelisk", asset: "ruin", x: e.x, y: e.y, scale: 0.65 },
        now,
        game.world,
      );
    this.glow(e.x, e.y - 18, 33, e.complete ? "#9ac58a" : "#d7c88a", 0.1);
    c.save();
    c.font = "17px Georgia";
    c.textAlign = "center";
    c.fillStyle = e.complete ? "#afd49b" : "#e4d29c";
    c.fillText(
      e.complete ? "✓" : "◇",
      e.x,
      e.y - (e.sprite === "npc" ? 57 : 48),
    );
    if (selected || Math.hypot(e.x - game.player.x, e.y - game.player.y) < 155)
      this.queueEntityLabel(e, game);
    c.restore();
  }
  drawJob(e, now) {
    const job = /medic|heal/.test(e.role || "")
      ? "medic"
      : /guard/.test(e.role || "")
        ? "guard"
        : /scout/.test(e.role || "")
          ? "scout"
          : /trader|merchant/.test(e.role || "")
            ? "trader"
            : /escort|courier/.test(e.role || "")
              ? "courier"
              : /garden|farm/.test(e.name?.toLowerCase() || "")
                ? "gardener"
                : /forge|smith/.test(e.name?.toLowerCase() || "")
                  ? "blacksmith"
                  : "scholar";
    const im = this.image(assetUrl(`/assets/npc-jobs/${job}-sheet.png`));
    if (!im) return false;
    this.ctx.drawImage(
      im,
      (Math.floor(now / (e.walking ? 140 : 330)) % 4) * 40,
      0,
      40,
      48,
      e.x - 22,
      e.y - 48,
      44,
      53,
    );
    return true;
  }
  queueEntityLabel(e, game) {
    const own = e.ownerId === game.player.id,
      role =
        e.role === "companion"
          ? "familiar"
          : e.role === "contract-escort"
            ? "escort"
            : e.command
              ? "hired ally"
              : null;
    const caption =
      e.labelCaption ||
      (e.ownerId && role
        ? own
          ? `Your ${role}`
          : `${e.ownerName || "Another player"} · ${role}`
        : null);
    (this.entityLabels ||= []).push({
      e,
      name: String(e.name || "Contract objective"),
      caption,
      own,
      selected: game.targetId === e.id,
      distance: Math.hypot(e.x - game.player.x, e.y - game.player.y),
    });
  }
  drawEntityLabels(game) {
    const c = this.ctx,
      placed = [],
      labels = (this.entityLabels || []).sort(
        (a, b) =>
          Number(b.selected) - Number(a.selected) || a.distance - b.distance,
      );
    c.save();
    c.textAlign = "center";
    for (const label of labels) {
      const { e, name, caption, own, selected } = label;
      c.font = '10px "Trebuchet MS",sans-serif';
      const width =
          Math.max(
            c.measureText(name).width,
            caption ? c.measureText(caption).width : 0,
          ) + 14,
        height = caption ? 32 : 19;
      let box = null;
      // Selected actors claim their nearest position first; other labels move
      // into free rows, so clustered hub NPCs remain individually readable.
      for (const offset of [10, 31, -65, 52, -86, 73]) {
        const candidate = {
          x: clamp(
            e.x - width / 2,
            this.camera.x + 4,
            this.camera.x + this.width - width - 4,
          ),
          y: e.y + offset,
          width,
          height,
        };
        if (
          candidate.x < this.camera.x + 4 ||
          candidate.x + width > this.camera.x + this.width - 4 ||
          candidate.y < this.camera.y + 4 ||
          candidate.y + height > this.camera.y + this.height - 4
        )
          continue;
        if (
          !placed.some(
            (p) =>
              candidate.x < p.x + p.width + 5 &&
              candidate.x + width + 5 > p.x &&
              candidate.y < p.y + p.height + 4 &&
              candidate.y + height + 4 > p.y,
          )
        ) {
          box = candidate;
          break;
        }
      }
      if (!box && !selected) continue;
      box ||= {
        x: clamp(
          e.x - width / 2,
          this.camera.x + 4,
          this.camera.x + this.width - width - 4,
        ),
        y: clamp(
          e.y + 10,
          this.camera.y + 4,
          this.camera.y + this.height - height - 4,
        ),
        width,
        height,
      };
      placed.push(box);
      c.fillStyle = selected ? "rgba(13,25,47,.96)" : "rgba(12,24,43,.89)";
      c.fillRect(box.x, box.y, width, height);
      if (selected) {
        c.strokeStyle = "#82eee0";
        c.lineWidth = 1;
        c.strokeRect(box.x, box.y, width, height);
      }
      c.font = '10px "Trebuchet MS",sans-serif';
      c.fillStyle = selected ? "#e5f7ff" : "#c4d7e5";
      c.fillText(name, box.x + width / 2, box.y + 13);
      if (caption) {
        c.font = '9px "Trebuchet MS",sans-serif';
        c.fillStyle = own ? "#75dfcb" : "#b3adff";
        c.fillText(caption, box.x + width / 2, box.y + 26);
      }
    }
    c.restore();
  }
  drawEntity(e, now, game) {
    // Contract evidence and barter contacts are personal. Rendering a peer's
    // duplicate marker would advertise an objective this player cannot use.
    if (
      e.ownerId &&
      e.ownerId !== game.player.id &&
      (e.adventureActor ||
        e.kind === "contract-node" ||
        e.role === "contract-trader")
    )
      return;
    const c = this.ctx,
      x = Math.round(e.x),
      y = Math.round(e.y),
      selected = game.targetId === e.id;
    if (selected) {
      c.strokeStyle = e.kind === "enemy" ? "#d39c83" : "#d4ce91";
      c.lineWidth = 1.5;
      c.beginPath();
      c.ellipse(x, y + 2, 21, 9, 0, 0, TAU);
      c.stroke();
    }
    c.fillStyle = "rgba(15,31,25,.3)";
    c.beginPath();
    c.ellipse(x, y + 2, e.kind === "portal" ? 30 : 15, 6, 0, 0, TAU);
    c.fill();
    if (e.kind === "world-activity") {
      this.drawAdventureSite(e, now, game);
      return;
    }
    if (e.kind === "contract-node") {
      this.drawContractMarker(e, now, game);
      return;
    }
    if (e.kind === "world-landmark") {
      this.drawProp(
        { asset: "ruin", kind: "obelisk", x, y, scale: 0.55 },
        now,
        game.world,
      );
      if (selected || Math.hypot(x - game.player.x, y - game.player.y) < 160) {
        c.save();
        c.font = "11px Georgia";
        c.fillStyle = "#d9d4aa";
        c.textAlign = "center";
        c.fillText(e.name, x, y + 18);
        c.restore();
      }
      return;
    }
    if (e.asset && e.kind === "portal") {
      const path = e.asset.startsWith("/")
          ? e.asset
          : assetUrl(`/assets/${e.asset}-sheet.png`),
        meta = this.expanded?.props?.[e.asset],
        im = this.image(meta?.animationSrc || path);
      if (im) {
        const frame = meta
          ? Math.floor((now / 1000) * (meta.fps || 7)) % (meta.frames || 6)
          : Math.floor(now / 140) % 6;
        const fw = meta?.frameWidth || 96,
          fh = meta?.frameHeight || 128;
        c.drawImage(
          im,
          frame * fw,
          0,
          fw,
          fh,
          x - fw * 0.42,
          y - fh * 0.8,
          fw * 0.84,
          fh * 0.84,
        );
        this.glow(x, y - 40, 55, "#afddc4", 0.13);
        if (selected) {
          c.font = "10px Georgia";
          c.fillStyle = "#e2dab4";
          c.textAlign = "center";
          c.fillText(e.name, x, y + 22);
        }
        return;
      }
    }
    if (e.creatureId) {
      const im = this.image(
          assetUrl(`/assets/creature-${e.creatureId}-sheet.png`),
        ),
        size = e.boss ? 68 : e.kind === "enemy" ? 48 : 44,
        bob = /spirit|soul|cherub|avatar|sprite/.test(e.creatureId)
          ? Math.sin(now / 400 + x) * 3
          : 0;
      if (im)
        c.drawImage(
          im,
          (Math.floor(now / (e.state === "chase" ? 140 : 260)) % 4) * 40,
          0,
          40,
          40,
          x - size / 2,
          y - size * 0.86 + bob,
          size,
          size,
        );
      if (e.boss) {
        const stage = e.phase || e.stage || 1;
        c.save();
        c.strokeStyle = stage > 1 ? "#edb180" : "#c6b586";
        c.lineWidth = 1.5;
        c.globalAlpha = 0.55;
        c.beginPath();
        c.ellipse(x, y + 2, 31 + stage * 3, 12 + stage, 0, 0, TAU);
        c.stroke();
        c.fillStyle = "#e2bc80";
        c.font = "11px Georgia";
        c.textAlign = "center";
        c.fillText("✦".repeat(Math.min(3, stage)), x, y - size - 8);
        c.restore();
      }
      if (e.kind === "npc") {
        c.fillStyle = "#dfcf91";
        c.font = "14px Georgia";
        c.textAlign = "center";
        c.fillText("◇", x, y - size - 6);
      }
    } else if (e.kind === "encounter-node") {
      const asset =
        e.sprite === "shrine"
          ? "shrine"
          : e.sprite === "ruin"
            ? "ruin"
            : "crystal";
      this.drawProp({ asset, kind: asset, x, y, scale: 0.9 }, now, game.world);
      this.glow(x, y - 20, 40, "#bfdbad", 0.14);
      c.fillStyle = "#e4d6a4";
      c.font = "16px Georgia";
      c.textAlign = "center";
      c.fillText(
        e.activated || e.completed || e.resolved ? "✓" : e.glyph || "◇",
        x,
        y - 55,
      );
    } else if (e.kind === "portal") {
      this.glow(x, y - 35, 62, "#a1cebb", 0.16);
      c.strokeStyle = "#779580";
      c.lineWidth = 7;
      c.beginPath();
      c.ellipse(x, y - 35, 24, 36, 0, 0, TAU);
      c.stroke();
      c.strokeStyle = "#a5d7bd";
      c.lineWidth = 2;
      c.stroke();
      const g = c.createRadialGradient(x, y - 35, 3, x, y - 35, 30);
      g.addColorStop(0, "rgba(155,224,197,.4)");
      g.addColorStop(1, "rgba(107,167,147,.05)");
      c.fillStyle = g;
      c.fill();
      c.fillStyle = "#b2ddbc";
      for (let i = 0; i < 5; i++) {
        const a = now / 1900 + (i * TAU) / 5;
        c.fillRect(x + Math.cos(a) * 18, y - 35 + Math.sin(a) * 29, 3, 3);
      }
    } else if (e.kind === "build") {
      this.drawProp({ kind: "sign", x, y, scale: 1 }, now, game.world);
      c.fillStyle = e.restored ? "#b5d9a2" : "#c4aa6e";
      c.font = "14px Georgia";
      c.textAlign = "center";
      c.fillText(e.restored ? "✓" : "◇", x, y - 59);
    } else if (e.kind === "patch") {
      c.fillStyle = e.restored ? "#59794c" : "#6b6349";
      c.beginPath();
      c.ellipse(x, y - 3, 30, 13, 0, 0, TAU);
      c.fill();
      for (let i = 0; i < 7; i++) {
        const xx = x - 24 + i * 8,
          yy = y - 4 - (i % 3) * 5;
        c.fillStyle = e.restored ? "#8aab68" : "#9d8d65";
        c.fillRect(xx, yy - 10, 2, 12);
        c.fillRect(xx - 3, yy - 7, 8, 3);
        c.fillStyle = e.restored ? "#c2c3a0" : "#b29a73";
        c.fillRect(xx - 1, yy - 14, 4, 5);
      }
      if (e.restored) this.glow(x, y - 12, 35, "#c4dfaa", 0.12);
    } else if (e.kind === "resource") {
      const crystal =
        e.item === "crystal" ||
        /crystal|essence/i.test(e.name || e.sprite || "");
      if (e.item === "wood")
        this.drawProp(
          { kind: "fallen-log", asset: "fallen-log", x, y, scale: 1 },
          now,
          game.world,
        );
      else if (e.item === "herb")
        this.drawProp(
          { kind: "magic-herb", asset: "magic-herb", x, y, scale: 1 },
          now,
          game.world,
        );
      else
        this.drawProp(
          { kind: crystal ? "rock" : "rock", x, y, scale: 0.9 },
          now,
          game.world,
        );
      if (crystal) {
        this.glow(x, y - 16, 28, "#9bd4c7", 0.14);
        c.fillStyle = "#72b0ae";
        c.fillRect(x - 6, y - 28, 9, 22);
        c.fillRect(x + 4, y - 20, 6, 14);
        c.fillStyle = "#b1dfcd";
        c.fillRect(x - 4, y - 26, 3, 15);
      }
    } else if (e.kind === "chest") {
      if (!this.sprite(assetUrl("/assets/chest.png"), x, y + 4, 42, 37)) {
        c.fillStyle = "#554e3a";
        c.fillRect(x - 19, y - 22, 38, 25);
        c.fillStyle = "#877747";
        c.fillRect(x - 19, y - 27, 38, 12);
        c.fillStyle = "#b9a16c";
        c.fillRect(x - 19, y - 23, 38, 4);
        c.fillRect(x - 14, y - 24, 4, 27);
        c.fillRect(x + 10, y - 24, 4, 27);
        c.fillRect(x - 3, y - 15, 7, 8);
      }
    } else if (e.kind === "dummy") {
      c.fillStyle = "#736449";
      c.fillRect(x - 3, y - 43, 6, 43);
      c.fillStyle = "#9a8a60";
      c.fillRect(x - 20, y - 33, 40, 6);
      c.fillStyle = "#b4a17a";
      c.fillRect(x - 11, y - 46, 22, 24);
      c.fillStyle = "#685e42";
      c.fillRect(x - 2, y - 40, 4, 12);
      c.fillRect(x - 8, y - 36, 16, 4);
      c.fillStyle = "#d4c39b";
      c.fillRect(x - 6, y - 53, 12, 10);
    } else if (e.kind === "enemy") {
      const nm = (e.sprite || e.name || "").toLowerCase();
      let path =
        e.sprite &&
        [
          "guardian",
          "sentinel",
          "golem",
          "imp",
          "demon",
          "shadow",
          "angel",
          "spirit",
          "firefly",
          "moth",
          "fox",
          "deer",
          "serpent",
        ].includes(e.sprite)
          ? assetUrl(`/assets/${e.sprite}-sheet.png`)
          : nm.includes("wolf") || nm.includes("beast")
            ? assetUrl("/assets/wolf-sheet.png")
            : nm.includes("wisp") ||
                nm.includes("spirit") ||
                nm.includes("shade")
              ? assetUrl("/assets/wisp-sheet.png")
              : assetUrl("/assets/slime-sheet.png");
      const im = this.image(path);
      if (im) {
        if (im.width > 64)
          c.drawImage(
            im,
            (Math.floor(now / 230) % 4) * 40,
            0,
            40,
            40,
            x - 24,
            y - 41,
            48,
            48,
          );
        else c.drawImage(im, x - 24, y - 43, 48, 48);
      } else if (
        nm.includes("wisp") ||
        nm.includes("shade") ||
        nm.includes("spirit")
      ) {
        const bob = Math.sin(now / 430 + x) * 3;
        this.glow(x, y - 19 + bob, 32, "#b5aac6", 0.2);
        c.fillStyle = "#697389";
        c.fillRect(x - 12, y - 28 + bob, 24, 20);
        c.fillRect(x - 7, y - 37 + bob, 14, 30);
        c.fillStyle = "#9ca9b6";
        c.fillRect(x - 8, y - 31 + bob, 15, 12);
        c.fillStyle = "#d5e8d7";
        c.fillRect(x - 5, y - 25 + bob, 3, 4);
        c.fillRect(x + 3, y - 25 + bob, 3, 4);
      } else if (nm.includes("wolf") || nm.includes("beast")) {
        c.fillStyle = "#6d756a";
        c.fillRect(x - 21, y - 26, 38, 22);
        c.fillRect(x - 26, y - 34, 20, 23);
        c.fillRect(x + 14, y - 27, 16, 8);
        c.fillStyle = "#8c9581";
        c.fillRect(x - 24, y - 33, 18, 10);
        c.fillRect(x - 16, y - 27, 26, 6);
        c.fillStyle = "#4c594f";
        c.fillRect(x - 17, y - 7, 6, 10);
        c.fillRect(x + 6, y - 7, 6, 10);
        c.fillRect(x - 25, y - 40, 6, 10);
        c.fillRect(x - 10, y - 40, 6, 10);
        c.fillStyle = "#d4bf89";
        c.fillRect(x - 24, y - 26, 3, 3);
      } else {
        const bob = Math.sin(now / 300 + x) * 1.5;
        c.fillStyle = "#5d7e69";
        c.fillRect(x - 16, y - 19 + bob, 32, 19);
        c.fillRect(x - 11, y - 27 + bob, 22, 27);
        c.fillStyle = "#88a784";
        c.fillRect(x - 12, y - 21 + bob, 21, 8);
        c.fillStyle = "#b0c49a";
        c.fillRect(x - 7, y - 23 + bob, 9, 4);
        c.fillStyle = "#2e4b3d";
        c.fillRect(x - 8, y - 12 + bob, 3, 4);
        c.fillRect(x + 6, y - 12 + bob, 3, 4);
      }
    } else {
      const drewJob = e.role !== "keeper" && this.drawJob(e, now);
      const sheet = drewJob
        ? null
        : this.image(
            e.role === "keeper"
              ? assetUrl("/assets/angel.png")
              : assetUrl("/assets/npc.png"),
          );
      if (sheet) {
        if (sheet.width > 64)
          c.drawImage(sheet, 0, 0, 32, 40, x - 20, y - 48, 40, 50);
        else c.drawImage(sheet, x - 20, y - 48, 40, 50);
      } else if (!drewJob) {
        const merchant = /merchant|artisan|trader/i.test(e.name || "");
        c.fillStyle = "#3c4741";
        c.fillRect(x - 7, y - 16, 6, 17);
        c.fillRect(x + 2, y - 16, 6, 17);
        c.fillStyle = merchant ? "#a68b5b" : "#899e8a";
        c.fillRect(x - 10, y - 32, 21, 25);
        c.fillStyle = merchant ? "#c5af7f" : "#c5c7aa";
        c.fillRect(x - 7, y - 31, 5, 22);
        c.fillStyle = "#cab291";
        c.fillRect(x - 8, y - 43, 16, 13);
        c.fillStyle = merchant ? "#6e7758" : "#d0d1b7";
        c.fillRect(x - 10, y - 47, 19, 9);
        c.fillRect(x - 13, y - 42, 25, 3);
        c.fillStyle = "#44584e";
        c.fillRect(x - 4, y - 36, 2, 2);
        c.fillRect(x + 3, y - 36, 2, 2);
      }
      this.drawPurposeMarker(e, now, game);
    }
    if (e.status && (!e.statusUntil || e.statusUntil > (game.time || 0))) {
      c.save();
      c.strokeStyle = /root|slow|stun/.test(e.status) ? "#b9b390" : "#acd3be";
      c.globalAlpha = 0.65;
      c.setLineDash([3, 3]);
      c.beginPath();
      c.ellipse(x, y + 2, 22, 9, 0, 0, TAU);
      c.stroke();
      c.restore();
    }
    if (
      e.health != null &&
      e.maxHealth &&
      (e.health < e.maxHealth || selected) &&
      e.kind !== "npc"
    ) {
      const w = e.boss ? 60 : e.kind === "enemy" ? 36 : 40,
        yy = e.boss ? y - 72 : y - 53;
      c.fillStyle = "#243e34";
      c.fillRect(x - w / 2 - 1, yy, w + 2, 6);
      c.fillStyle = e.kind === "enemy" ? "#b47c6e" : "#9ead84";
      c.fillRect(
        x - w / 2,
        yy + 1,
        Math.max(0, (w * e.health) / e.maxHealth),
        4,
      );
    }
    if (
      selected ||
      (e.kind === "npc" &&
        Math.hypot(e.x - game.player.x, e.y - game.player.y) < 140)
    )
      this.queueEntityLabel(e, game);
  }
  drawEffect(e, now, time) {
    const c = this.ctx;
    let elapsed =
        e.start != null
          ? e.start > 100000
            ? (now - e.start) / 1000
            : time - e.start
          : e.age || 0,
      duration = e.duration || 0.7;
    if (duration > 100) duration /= 1000;
    const p = clamp(elapsed / duration, 0, 1);
    if (p >= 1) return;
    const family = String(e.family || e.branchId || "").split("-")[0],
      familyColors = {
        love: "#ff8ec8",
        light: "#ffe8a8",
        water: "#72e8ff",
        air: "#b0e5ff",
        hate: "#ff709d",
        dark: "#b89aff",
        fire: "#ffae75",
        earth: "#a2e6aa",
      },
      color = familyColors[family] || e.color || "#8de8df",
      radius = e.radius || 38;
    c.save();
    c.globalAlpha = 1 - p;
    if (e.kind === "text" || e.text || e.amount != null) {
      c.font = `700 ${e.kind === "damage" ? 17 : 14}px Inter, sans-serif`;
      c.textAlign = "center";
      c.lineWidth = 3;
      c.strokeStyle = "rgba(5,14,31,.8)";
      c.strokeText(e.text || `−${e.amount || 0}`, e.x, e.y - 40 - p * 28);
      c.fillStyle = e.color || color;
      c.fillText(e.text || `−${e.amount || 0}`, e.x, e.y - 40 - p * 28);
      c.restore();
      return;
    }
    const entry =
      this.expanded?.vfx?.[`vfx/${e.powerId}`] ||
      this.expanded?.vfx?.[`vfx/family-${e.branchId}`];
    if (entry) {
      const strip = this.image(entry.src);
      if (strip) {
        const frames = entry.frames || 8,
          fw = entry.frameWidth || 96,
          fh = entry.frameHeight || 96,
          frame =
            duration > 3
              ? Math.floor(elapsed * (entry.fps || 12)) % frames
              : Math.min(frames - 1, Math.floor(p * frames)),
          size = clamp(radius * 2, 64, e.kind === "ritual" ? 320 : 210);
        c.globalAlpha = (duration > 3 ? 0.55 : 0.7) * (1 - p);
        c.globalCompositeOperation = "screen";
        c.drawImage(
          strip,
          frame * fw,
          0,
          fw,
          fh,
          e.x - size / 2,
          e.y - size * 0.7,
          size,
          size,
        );
        c.globalCompositeOperation = "source-over";
      }
    }
    const channel =
        e.kind === "channel" || e.kind === "cast" || e.kind === "ritual",
      rr =
        radius *
        (channel ? 0.7 + 0.05 * Math.sin(elapsed * 7) : 0.25 + p * 1.15),
      alpha = channel ? 0.6 : (1 - p) * 0.9;
    c.globalAlpha = alpha;
    c.strokeStyle = color;
    c.lineWidth = channel ? 1.4 : 2.5 * (1 - p) + 0.5;
    c.beginPath();
    c.ellipse(e.x, e.y, rr, rr * 0.52, 0, 0, TAU);
    c.stroke();
    c.globalAlpha = alpha * 0.45;
    c.lineWidth = 1;
    c.beginPath();
    c.ellipse(e.x, e.y, rr + 8, rr * 0.52 + 4, 0, 0, TAU);
    c.stroke();
    this.glow(e.x, e.y - 15, Math.max(28, rr), color, 0.19 * (1 - p));
    c.globalAlpha = alpha;
    const count = channel ? 10 : 16;
    for (let i = 0; i < count; i++) {
      const a =
          (i * TAU) / count +
          elapsed * (family === "air" ? 3.2 : family === "dark" ? -1.2 : 1),
        r = rr * (0.7 + (i % 3) * 0.1),
        xx = e.x + Math.cos(a) * r,
        yy =
          e.y +
          Math.sin(a) * r * 0.52 -
          (channel
            ? Math.sin(i * 1.8 + elapsed * 4) * 8
            : p * (15 + (i % 4) * 6));
      c.fillStyle = color;
      if (family === "fire" || family === "hate") {
        c.beginPath();
        c.moveTo(xx - 3, yy + 5);
        c.quadraticCurveTo(
          xx - 6,
          yy - 3,
          xx + Math.sin(elapsed * 13 + i) * 5,
          yy - 13 - (i % 3) * 3,
        );
        c.quadraticCurveTo(xx + 6, yy - 3, xx + 3, yy + 5);
        c.fill();
      } else if (family === "water") {
        c.beginPath();
        c.ellipse(xx, yy, 2.5, 5, -a, 0, TAU);
        c.fill();
        c.fillStyle = "#e6fcff";
        c.fillRect(xx - 1, yy - 3, 1, 2);
      } else if (family === "earth") {
        c.beginPath();
        c.moveTo(xx - 5, yy);
        c.lineTo(xx, yy - 8);
        c.lineTo(xx + 5, yy);
        c.lineTo(xx + 2, yy + 5);
        c.closePath();
        c.fill();
        c.strokeStyle = "#e2ffde";
        c.lineWidth = 1;
        c.stroke();
      } else if (family === "love") {
        c.save();
        c.translate(xx, yy);
        c.rotate(Math.sin(a) * 0.2);
        c.beginPath();
        c.moveTo(0, 4);
        c.bezierCurveTo(-9, -1, -4, -9, 0, -4);
        c.bezierCurveTo(4, -9, 9, -1, 0, 4);
        c.fill();
        c.restore();
      } else if (family === "dark") {
        c.strokeStyle = color;
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(xx, yy);
        c.quadraticCurveTo(
          xx + Math.cos(a + 1) * 12,
          yy - 15,
          e.x + Math.cos(a) * rr * 0.35,
          e.y - 26,
        );
        c.stroke();
      } else if (family === "air") {
        c.strokeStyle = color;
        c.lineWidth = 1.7;
        c.beginPath();
        c.ellipse(e.x, e.y - (i % 4) * 8, r, r * 0.35, a * 0.1, a, a + 0.7);
        c.stroke();
      } else {
        c.save();
        c.translate(xx, yy);
        c.rotate(a);
        c.fillRect(-1, -6, 2, 12);
        c.fillRect(-5, -1, 10, 2);
        c.restore();
      }
    }
    if (channel) {
      c.strokeStyle = color;
      c.lineWidth = 1;
      c.globalAlpha = 0.6;
      for (let i = 0; i < 8; i++) {
        const a = (i * TAU) / 8 + elapsed * 0.3,
          xx = e.x + Math.cos(a) * (rr + 5),
          yy = e.y + Math.sin(a) * (rr + 5) * 0.52;
        c.save();
        c.translate(xx, yy);
        c.rotate(a);
        c.strokeRect(-3, -4, 6, 8);
        c.restore();
      }
      const beam = c.createLinearGradient(e.x, e.y - 100, e.x, e.y);
      beam.addColorStop(0, "rgba(100,180,255,0)");
      beam.addColorStop(1, color);
      c.globalAlpha = 0.14;
      c.fillStyle = beam;
      c.fillRect(e.x - 12, e.y - 100, 24, 100);
    }
    c.restore();
  }
}
