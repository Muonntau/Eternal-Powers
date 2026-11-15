import React, { useEffect, useRef, useState } from "react";
import { Compass, MapPin, Navigation, Layers, Crosshair } from "lucide-react";
import { drawNavigationMap } from "./mapGeometry.js";

export default function RegionAtlas({ engine, state, call, close }) {
  const canvas = useRef(null),
    projection = useRef(null);
  const [labels, setLabels] = useState(true),
    [selected, setSelected] = useState(null),
    [size, setSize] = useState(0),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  useEffect(() => {
    const el = canvas.current;
    if (!el || !globalThis.ResizeObserver) return;
    const observer = new ResizeObserver(() => setSize((v) => v + 1));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    setSelected(null);
    setMessage("");
  }, [state.zone?.id]);
  useEffect(() => {
    projection.current = drawNavigationMap(canvas.current, engine, state, {
      detailed: true,
      showLabels: labels,
      route: selected,
      selected,
    });
  }, [
    engine,
    state.time,
    state.zone?.id,
    state.player?.x,
    state.player?.y,
    selected,
    labels,
    size,
  ]);
  const world = engine?.world;
  async function navigate() {
    if (!selected) return;
    setBusy(true);
    try {
      const result = await (call
        ? call("navigateTo", selected.x, selected.y)
        : engine?.navigateTo(selected.x, selected.y));
      if (result !== false) {
        setMessage("Route set. Return to the world to begin walking.");
        close?.();
      } else
        setMessage(
          "No safe route is available right now. Leave conflict and choose an accessible point.",
        );
    } finally {
      setBusy(false);
    }
  }
  function mark(event) {
    const r = canvas.current.getBoundingClientRect();
    if (projection.current)
      setSelected({
        ...projection.current.unproject(
          event.clientX - r.left,
          event.clientY - r.top,
        ),
        name: "Custom waypoint",
      });
  }
  return (
    <div className="region-atlas">
      <div className="atlas-toolbar">
        <div>
          <span className="eyebrow">REGION NAVIGATION</span>
          <h3>{state.zone?.name}</h3>
          <p>
            {Math.round((world?.width || 0) / 10)} ×{" "}
            {Math.round((world?.height || 0) / 10)} m · Select a landmark or
            place a waypoint
          </p>
        </div>
        <button
          className={`outline-button ${labels ? "active" : ""}`}
          onClick={() => setLabels((v) => !v)}
          aria-pressed={labels}
        >
          <Layers size={14} /> Labels
        </button>
      </div>
      <div className="atlas-layout">
        <div className="atlas-canvas-wrap">
          <canvas
            ref={canvas}
            onClick={mark}
            aria-label={`Detailed map of ${state.zone?.name}. Click to choose a waypoint.`}
          />
          <span className="atlas-compass">
            <Compass size={22} /> N
          </span>
          <div className="atlas-scale">
            <i /> 100 m
          </div>
        </div>
        <aside className="atlas-points">
          <span className="section-caption">PLACES TO DISCOVER</span>
          {(world?.landmarks || []).map((l) => (
            <button
              key={l.id}
              className={selected?.id === l.id ? "selected" : ""}
              onClick={() => setSelected(l)}
            >
              <MapPin size={16} />
              <span>
                <strong>{l.name}</strong>
                <small>
                  {Math.round(
                    Math.hypot(
                      l.x - (state.player?.x || 0),
                      l.y - (state.player?.y || 0),
                    ) / 10,
                  )}{" "}
                  m away
                </small>
              </span>
            </button>
          ))}
          {!world?.landmarks?.length && (
            <p>Landmarks appear as you explore this region.</p>
          )}
        </aside>
      </div>
      <div className="atlas-route">
        <div>
          <Crosshair size={18} />
          <span>
            <strong>{selected?.name || "Choose a destination"}</strong>
            <small>
              {selected
                ? `${Math.round(selected.x / 10)} · ${Math.round(selected.y / 10)} m`
                : "Routes respect roads, terrain and solid architecture."}
            </small>
          </span>
        </div>
        <button
          className="primary-button"
          disabled={!selected || busy || state.inCombat}
          onClick={navigate}
        >
          <Navigation size={14} /> Walk to waypoint
        </button>
      </div>
      {message && (
        <p className="atlas-message" role="status">
          {message}
        </p>
      )}
      <div className="atlas-map-legend">
        <span className="self">You</span>
        <span className="friendly">Travelers</span>
        <span className="enemy">Threats</span>
        <span className="resource">Resources</span>
        <span className="landmark">Landmarks</span>
      </div>
    </div>
  );
}
