import React, { useEffect, useRef, useState } from "react";
import { Compass, Expand, Layers, MapPin, Minus, Plus } from "lucide-react";
import { drawNavigationMap } from "./mapGeometry.js";

export default function WorldMinimap({ engine, state, onOpenAtlas }) {
  const canvas = useRef(null),
    projection = useRef(null);
  const [local, setLocal] = useState(true),
    [legend, setLegend] = useState(false),
    [route, setRoute] = useState(null),
    [size, setSize] = useState(0);
  useEffect(() => {
    const el = canvas.current;
    if (!el || !globalThis.ResizeObserver) return;
    const observer = new ResizeObserver(() => setSize((v) => v + 1));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    setRoute(null);
  }, [state.zone?.id]);
  useEffect(() => {
    projection.current = drawNavigationMap(canvas.current, engine, state, {
      local,
      route,
    });
  }, [
    engine,
    state.time,
    state.zone?.id,
    state.player?.x,
    state.player?.y,
    local,
    route,
    size,
  ]);
  async function navigate(event) {
    event.stopPropagation();
    if (!projection.current || !engine) return;
    const r = canvas.current.getBoundingClientRect(),
      destination = projection.current.unproject(
        event.clientX - r.left,
        event.clientY - r.top,
      );
    const accepted = await engine.navigateTo(destination.x, destination.y);
    if (accepted !== false) setRoute(destination);
  }
  const x = Math.floor((state.player?.x || 0) / 10),
    y = Math.floor((state.player?.y || 0) / 10);
  return (
    <div
      className="navigation-radar"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <div className="radar-topline">
        <span>
          <Compass size={12} /> {local ? "NEARBY" : "REGION"}
        </span>
        <button
          onClick={() => onOpenAtlas?.()}
          aria-label="Open detailed region map"
          title="Open detailed region map"
        >
          <Expand size={12} />
        </button>
      </div>
      <div className="radar-map">
        <canvas
          ref={canvas}
          className="actual-world-minimap"
          aria-label={`Map of ${state.zone?.name || "region"}. Click to set a walking route.`}
          onClick={navigate}
        />
        <span className="radar-north">N</span>
        <span className="radar-east">E</span>
      </div>
      <div className="radar-bottomline">
        <span>
          <MapPin size={10} /> {x} · {y}
        </span>
        <div>
          <button
            onClick={() => setLegend((v) => !v)}
            aria-expanded={legend}
            title="Map legend"
            aria-label="Toggle minimap legend"
          >
            <Layers size={12} />
          </button>
          <button
            onClick={() => setLocal((v) => !v)}
            title={local ? "Show whole region" : "Show nearby area"}
            aria-label={local ? "Show whole region" : "Show nearby area"}
          >
            {local ? <Minus size={12} /> : <Plus size={12} />}
          </button>
        </div>
      </div>
      {legend && (
        <div className="radar-legend">
          <span className="self">You</span>
          <span className="friendly">Travelers</span>
          <span className="enemy">Threats</span>
          <span className="resource">Resources</span>
          <span className="landmark">Landmarks</span>
          <small>Click the map to walk a safe route.</small>
        </div>
      )}
    </div>
  );
}
