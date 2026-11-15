/** A single projection for map rendering and pointer-to-world navigation. */
export function createMapProjection(
  world,
  width,
  height,
  player,
  local = false,
) {
  const ww = Math.max(1, world.width || 2400),
    wh = Math.max(1, world.height || 1800);
  const span = local ? Math.min(1500, ww) : ww;
  const viewWidth = local ? span : ww,
    viewHeight = local ? Math.min(wh, (span * height) / width) : wh;
  const scale = Math.min(width / viewWidth, height / viewHeight);
  const left = local
    ? Math.max(0, Math.min(ww - viewWidth, (player?.x || 0) - viewWidth / 2))
    : 0;
  const top = local
    ? Math.max(0, Math.min(wh - viewHeight, (player?.y || 0) - viewHeight / 2))
    : 0;
  const ox = (width - viewWidth * scale) / 2,
    oy = (height - viewHeight * scale) / 2;
  return {
    scale,
    left,
    top,
    viewWidth,
    viewHeight,
    point: (x, y) => ({
      x: ox + (x - left) * scale,
      y: oy + (y - top) * scale,
    }),
    unproject: (x, y) => ({
      x: Math.max(30, Math.min(ww - 30, (x - ox) / scale + left)),
      y: Math.max(30, Math.min(wh - 30, (y - oy) / scale + top)),
    }),
    contains: (x, y) =>
      x >= left && y >= top && x <= left + viewWidth && y <= top + viewHeight,
  };
}

export function drawNavigationMap(
  canvas,
  engine,
  state,
  {
    local = false,
    detailed = false,
    showLabels = false,
    route = null,
    selected = null,
  } = {},
) {
  if (!canvas || !engine?.world) return null;
  const rect = canvas.getBoundingClientRect(),
    width = rect.width || 200,
    height = rect.height || 160;
  const dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
  if (
    canvas.width !== Math.round(width * dpr) ||
    canvas.height !== Math.round(height * dpr)
  ) {
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
  }
  const c = canvas.getContext("2d");
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  const world = engine.world,
    player = state.player || engine.player;
  const t = createMapProjection(world, width, height, player, local);
  c.clearRect(0, 0, width, height);
  c.fillStyle = "#080f20";
  c.fillRect(0, 0, width, height);
  const bounds = t.point(0, 0),
    far = t.point(world.width, world.height);
  const infernal = state.zone?.realm === "hell",
    heaven = state.zone?.realm === "heaven";
  c.fillStyle = infernal ? "#262033" : heaven ? "#17273b" : "#142b32";
  c.fillRect(bounds.x, bounds.y, far.x - bounds.x, far.y - bounds.y);
  c.save();
  c.beginPath();
  c.rect(
    Math.max(0, bounds.x),
    Math.max(0, bounds.y),
    Math.min(width, far.x) - Math.max(0, bounds.x),
    Math.min(height, far.y) - Math.max(0, bounds.y),
  );
  c.clip();
  const poly = (points) => {
    c.beginPath();
    (points || []).forEach((p, i) => {
      const a = t.point(p.x ?? p[0], p.y ?? p[1]);
      i ? c.lineTo(a.x, a.y) : c.moveTo(a.x, a.y);
    });
    c.closePath();
  };
  c.strokeStyle = "#a4c5db0c";
  c.lineWidth = 0.7;
  const grid = detailed ? 300 : 500;
  for (let x = 0; x <= world.width; x += grid) {
    const a = t.point(x, 0),
      b = t.point(x, world.height);
    c.beginPath();
    c.moveTo(a.x, a.y);
    c.lineTo(b.x, b.y);
    c.stroke();
  }
  for (let y = 0; y <= world.height; y += grid) {
    const a = t.point(0, y),
      b = t.point(world.width, y);
    c.beginPath();
    c.moveTo(a.x, a.y);
    c.lineTo(b.x, b.y);
    c.stroke();
  }
  for (const water of world.terrain?.water || []) {
    poly(water.points);
    c.fillStyle =
      water.kind === "lava"
        ? "#ae5267"
        : water.kind === "void"
          ? "#090d27"
          : "#23596d";
    c.fill();
    c.strokeStyle = water.kind === "lava" ? "#f7959250" : "#78d5ed35";
    c.lineWidth = 1;
    c.stroke();
  }
  for (const wall of [
    ...(world.terrain?.cliffs || []),
    ...(world.terrain?.walls || []),
  ]) {
    const p = t.point(wall.x, wall.y);
    c.fillStyle = "#b8c3dc28";
    c.fillRect(
      p.x,
      p.y,
      Math.max(1, wall.width * t.scale),
      Math.max(1, wall.height * t.scale),
    );
  }
  for (const path of world.paths || []) {
    if (path.hidden || !path.points?.length) continue;
    c.beginPath();
    path.points.forEach((v, i) => {
      const p = t.point(v.x ?? v[0], v.y ?? v[1]);
      i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y);
    });
    c.lineCap = "round";
    c.lineJoin = "round";
    c.lineWidth = Math.max(1.3, (path.width || 70) * t.scale);
    c.strokeStyle = infernal ? "#bea2a04d" : "#a9d5d452";
    c.stroke();
    c.lineWidth = 0.7;
    c.strokeStyle = "#d3f9ff48";
    c.stroke();
  }
  for (const room of world.interiors || []) {
    const p = t.point(room.x, room.y);
    c.fillStyle = "#aabbf02b";
    c.strokeStyle = "#bcc5ff4a";
    c.lineWidth = 0.8;
    c.fillRect(p.x, p.y, room.width * t.scale, room.height * t.scale);
    c.strokeRect(p.x, p.y, room.width * t.scale, room.height * t.scale);
  }
  const sanctuary = world.spawn || { x: 920, y: 900 },
    hub = t.point(sanctuary.x, sanctuary.y);
  c.beginPath();
  c.arc(hub.x, hub.y, 300 * t.scale, 0, Math.PI * 2);
  c.fillStyle = "#72f0d50b";
  c.fill();
  c.strokeStyle = "#72f0d534";
  c.lineWidth = 1;
  c.stroke();
  if (engine.travelWaypoints?.length || engine.destination || route) {
    const start = t.point(player.x, player.y);
    c.beginPath();
    c.moveTo(start.x, start.y);
    for (const wp of engine.travelWaypoints || []) {
      const p = t.point(wp.x, wp.y);
      c.lineTo(p.x, p.y);
    }
    const end = engine.destination || route;
    if (end) {
      const p = t.point(end.x, end.y);
      c.lineTo(p.x, p.y);
    }
    c.setLineDash([3, 3]);
    c.lineWidth = 1.2;
    c.strokeStyle = "#b9a0ff";
    c.stroke();
    c.setLineDash([]);
  }
  if (detailed && engine.canvas) {
    const a = t.point(engine.camera?.x || 0, engine.camera?.y || 0);
    c.strokeStyle = "#d8edff3b";
    c.lineWidth = 1;
    c.strokeRect(
      a.x,
      a.y,
      engine.canvas.clientWidth * t.scale,
      engine.canvas.clientHeight * t.scale,
    );
  }
  const markers = [];
  for (const l of world.landmarks || [])
    if (t.contains(l.x, l.y))
      markers.push({
        ...l,
        type: "landmark",
        color: "#c3a7ff",
        priority: selected?.id === l.id ? 1 : 4,
      });
  for (const n of engine.entities || []) {
    if (
      n.dead ||
      n.collected ||
      n.kind === "dummy" ||
      !t.contains(n.x, n.y) ||
      ((n.contractSimulation || n.adventureActor) &&
        n.ownerId &&
        n.ownerId !== player.id)
    )
      continue;
    const dist = Math.hypot(n.x - player.x, n.y - player.y);
    if (!detailed && !local && dist > 900 && !["portal"].includes(n.kind))
      continue;
    if (n.kind === "resource" && !detailed && !local) continue;
    const type =
      n.kind === "enemy"
        ? "enemy"
        : n.kind === "resource"
          ? "resource"
          : n.kind === "portal"
            ? "portal"
            : n.contractSimulation ||
                ["available", "objective", "turnin", "reward"].includes(
                  n.markerState,
                )
              ? "objective"
              : "friendly";
    markers.push({
      ...n,
      type,
      priority:
        n.id === state.target?.id
          ? 0
          : type === "objective" || type === "portal"
            ? 2
            : type === "enemy"
              ? 3
              : 6,
      color: {
        enemy: "#ff839c",
        resource: "#63d4a1",
        portal: "#ac91ff",
        objective: "#ffd689",
        friendly: "#79ccf3",
      }[type],
    });
  }
  const occupied = [];
  for (const m of markers.sort((a, b) => a.priority - b.priority)) {
    const p = t.point(m.x, m.y),
      radius =
        m.type === "landmark" || m.type === "portal"
          ? 3
          : m.type === "resource"
            ? 1.8
            : 2.5;
    if (
      occupied.some(
        (v) => Math.hypot(v.x - p.x, v.y - p.y) < (detailed ? 8 : 6),
      )
    )
      continue;
    occupied.push(p);
    c.fillStyle = m.color;
    c.strokeStyle = "#081020";
    c.lineWidth = 1.5;
    c.beginPath();
    if (["landmark", "portal", "objective"].includes(m.type)) {
      c.moveTo(p.x, p.y - radius - 1);
      c.lineTo(p.x + radius + 1, p.y);
      c.lineTo(p.x, p.y + radius + 1);
      c.lineTo(p.x - radius - 1, p.y);
      c.closePath();
    } else c.arc(p.x, p.y, radius, 0, Math.PI * 2);
    c.stroke();
    c.fill();
    if (showLabels && m.type === "landmark") {
      c.font = `${detailed ? 10 : 8}px Inter, sans-serif`;
      c.textAlign = "center";
      const label = (m.name || "").slice(0, detailed ? 29 : 18);
      const tw = c.measureText(label).width;
      const lx = Math.max(tw / 2 + 4, Math.min(width - tw / 2 - 4, p.x));
      c.fillStyle = "#071021e8";
      c.fillRect(lx - tw / 2 - 4, p.y + 6, tw + 8, 14);
      c.fillStyle = "#c9c1e7";
      c.fillText(label, lx, p.y + 16);
    }
  }
  for (const peer of state.network?.players || engine.network?.players || []) {
    if (
      peer.id === player.id ||
      peer.id === engine.network?.selfId ||
      peer.connected === false ||
      (peer.zoneId && peer.zoneId !== state.zone?.id) ||
      !t.contains(peer.x, peer.y)
    )
      continue;
    const p = t.point(peer.x, peer.y);
    c.fillStyle = "#78b7ff";
    c.beginPath();
    c.arc(p.x, p.y, 3.2, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = "#091528";
    c.lineWidth = 1;
    c.stroke();
  }
  const p = t.point(player.x, player.y);
  c.save();
  c.translate(p.x, p.y);
  c.rotate(
    { 0: Math.PI, 1: -Math.PI / 2, 2: Math.PI / 2, 3: 0 }[player.facing] || 0,
  );
  c.shadowColor = "#77f6ed";
  c.shadowBlur = 7;
  c.fillStyle = "#e2ffff";
  c.strokeStyle = "#14394b";
  c.lineWidth = 1.5;
  c.beginPath();
  c.moveTo(0, -6);
  c.lineTo(4.5, 4.5);
  c.lineTo(0, 2.5);
  c.lineTo(-4.5, 4.5);
  c.closePath();
  c.fill();
  c.stroke();
  c.restore();
  if (route) {
    const p = t.point(route.x, route.y);
    c.strokeStyle = "#d3c0ff";
    c.lineWidth = 1.2;
    c.beginPath();
    c.arc(p.x, p.y, 5, 0, Math.PI * 2);
    c.stroke();
    c.beginPath();
    c.moveTo(p.x - 8, p.y);
    c.lineTo(p.x + 8, p.y);
    c.moveTo(p.x, p.y - 8);
    c.lineTo(p.x, p.y + 8);
    c.stroke();
  }
  c.restore();
  return t;
}
