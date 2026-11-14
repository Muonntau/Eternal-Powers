import React, { useEffect, useRef } from "react";

export default function WorldMinimap({ engine, state }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current,
      g = engine;
    if (!canvas || !g?.world) return;
    const w = canvas.clientWidth || 112,
      h = canvas.clientHeight || 106,
      dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const c = canvas.getContext("2d");
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const world = g.world,
      sx = w / world.width,
      sy = h / world.height,
      infernal = state.zone.realm === "hell";
    c.fillStyle = infernal
      ? "#433541"
      : state.zone.realm === "heaven"
        ? "#647c63"
        : "#3a553b";
    c.fillRect(0, 0, w, h);
    const polygon = (pts, color) => {
      if (!pts?.length) return;
      c.fillStyle = color;
      c.beginPath();
      pts.forEach((p, i) =>
        i ? c.lineTo(p.x * sx, p.y * sy) : c.moveTo(p.x * sx, p.y * sy),
      );
      c.closePath();
      c.fill();
    };
    if (world.authored) {
      for (const water of world.terrain?.water || [])
        polygon(
          water.points,
          water.kind === "lava"
            ? "#a7614f"
            : water.kind === "void"
              ? "#303446"
              : "#68a79e",
        );
    } else {
      const pts = [];
      for (let y = 0; y <= world.height; y += 30)
        pts.push({ x: 1420 + Math.sin(y / 230) * 75 - 63, y });
      for (let y = world.height; y >= 0; y -= 30)
        pts.push({ x: 1420 + Math.sin(y / 230) * 75 + 66, y });
      polygon(pts, infernal ? "#aa6951" : "#6aa99c");
    }
    const paths = world.authored
      ? world.paths || []
      : [
          {
            width: 94,
            points: [
              { x: 0, y: 920 },
              { x: 2400, y: 930 },
            ],
          },
          {
            width: 75,
            points: [
              { x: 920, y: 0 },
              { x: 920, y: 1800 },
            ],
          },
        ];
    for (const path of paths) {
      if (!path.points?.length) continue;
      c.strokeStyle = infernal ? "#9b8768" : "#a4ad7a";
      c.lineWidth = Math.max(1, (path.width || 70) * sx);
      c.lineCap = "round";
      c.lineJoin = "round";
      c.beginPath();
      path.points.forEach((p, i) =>
        i ? c.lineTo(p.x * sx, p.y * sy) : c.moveTo(p.x * sx, p.y * sy),
      );
      c.stroke();
    }
    c.fillStyle = infernal ? "#2b2937" : "#244a35";
    for (let i = 0; i < world.props.length; i += 2) {
      const p = world.props[i];
      if (p.kind === "tree" || p.kind === "pine")
        c.fillRect(p.x * sx, p.y * sy, 1.5, 1.5);
    }
    for (const wall of [
      ...(world.terrain?.walls || []),
      ...(world.terrain?.cliffs || []),
    ]) {
      c.fillStyle = "#6a7765";
      c.fillRect(
        wall.x * sx,
        wall.y * sy,
        Math.max(1, wall.width * sx),
        Math.max(1, wall.height * sy),
      );
    }
    c.strokeStyle = "#d6ca87";
    c.lineWidth = 0.7;
    for (const p of world.landmarks || []) {
      const x = p.x * sx,
        y = p.y * sy;
      c.beginPath();
      c.moveTo(x, y - 2);
      c.lineTo(x + 2, y);
      c.lineTo(x, y + 2);
      c.lineTo(x - 2, y);
      c.closePath();
      c.stroke();
    }
    for (const n of g.entities || []) {
      if (
        n.dead ||
        n.collected ||
        Math.hypot(n.x - g.player.x, n.y - g.player.y) > 550
      )
        continue;
      c.fillStyle =
        n.kind === "enemy"
          ? "#d79979"
          : n.kind === "resource"
            ? "#a9cda0"
            : n.kind === "portal"
              ? "#9dd9ca"
              : "#d9cd95";
      c.beginPath();
      c.arc(n.x * sx, n.y * sy, n.kind === "enemy" ? 1.2 : 0.9, 0, Math.PI * 2);
      c.fill();
    }
    const p = state.player;
    c.save();
    c.translate(p.x * sx, p.y * sy);
    c.fillStyle = "#f4df9a";
    c.shadowColor = "#fff5bc";
    c.shadowBlur = 5;
    c.beginPath();
    c.arc(0, 0, 2, 0, Math.PI * 2);
    c.fill();
    c.shadowBlur = 0;
    c.strokeStyle = "#edd89b88";
    c.lineWidth = 0.6;
    c.beginPath();
    c.arc(0, 0, 4, 0, Math.PI * 2);
    c.stroke();
    c.restore();
    c.strokeStyle = "#ccbd8a44";
    c.lineWidth = 0.5;
    c.strokeRect(0.5, 0.5, w - 1, h - 1);
  }, [engine, state.time, state.zone.id, state.player.x, state.player.y]);
  return (
    <canvas
      className="actual-world-minimap"
      ref={ref}
      aria-label={`Map of ${state.zone.name}`}
    />
  );
}
