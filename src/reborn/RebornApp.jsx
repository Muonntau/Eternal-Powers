import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  Compass,
  Crown,
  Droplets,
  Flame,
  Heart,
  HelpCircle,
  Layers,
  Leaf,
  Map,
  MapPin,
  Moon,
  Mountain,
  Pause,
  Play,
  Search,
  Shield,
  Skull,
  Sparkles,
  Sun,
  Swords,
  Volume2,
  VolumeX,
  WandSparkles,
  Wind,
  X,
  Zap,
} from "lucide-react";
import { RebornEngine } from "./engine.js";
import { RebornRenderer } from "./renderer.js";
import { POWER_CATALOG } from "./catalog.js";
import { BRANCHES, ZONES } from "../data/manual.js";
import { assetUrl } from "../assetUrl.js";
import { zoneArt } from "../zoneArt.js";
import audio from "./audio.js";
import { cacheForOffline, offlineAvailable } from "../offline.js";
import "./reborn.css";

const DOMAINS = {
  Love: Heart,
  Light: Sun,
  Water: Droplets,
  Air: Wind,
  Hate: Skull,
  Dark: Moon,
  Fire: Flame,
  Earth: Mountain,
};
const KITS = [
  {
    id: "ember",
    name: "Emberbound",
    branch: "fire-destroy",
    color: "#ffa779",
    icon: Flame,
    tag: "BURN · DETONATE · OVERWHELM",
    description: "Turn the wilds into a spectacular chain reaction.",
    armorColor: "ember",
    auraColor: "gold",
    bodyType: "vanguard",
  },
  {
    id: "tide",
    name: "Tidecaller",
    branch: "water-grow",
    color: "#90e7f4",
    icon: Droplets,
    tag: "FREEZE · SHATTER · RESTORE",
    description: "Control a living current. Leave no opening unanswered.",
    armorColor: "glacier",
    auraColor: "cyan",
    bodyType: "mystic",
  },
  {
    id: "storm",
    name: "Stormweaver",
    branch: "air-move",
    color: "#c5b5ff",
    icon: Wind,
    tag: "DASH · GATHER · UNLEASH",
    description: "Become the storm. Never stop moving.",
    armorColor: "astral",
    auraColor: "violet",
    bodyType: "wanderer",
  },
  {
    id: "earth",
    name: "Earthshaper",
    branch: "earth-give",
    color: "#badca1",
    icon: Mountain,
    tag: "GUARD · CRUSH · CREATE",
    description: "Raise a defense, then break through everything.",
    armorColor: "moss",
    auraColor: "mint",
    bodyType: "vanguard",
  },
];
const SKINS = [
  { id: "ivory", color: "#f3d6bd" },
  { id: "amber", color: "#c88b5c" },
  { id: "umber", color: "#865740" },
  { id: "onyx", color: "#50382f" },
  { id: "moon", color: "#a5b5cc" },
];
const IDLE_PLAYER = {
  name: "Aster",
  lineage: "angel",
  characterCreated: false,
  health: 100,
  maxHealth: 100,
  essence: 100,
  maxEssence: 100,
  level: 1,
  xp: 0,
  xpToNext: 100,
  shards: 0,
  potions: 3,
  ultimate: 0,
};
const powers = Array.isArray(POWER_CATALOG)
  ? POWER_CATALOG
  : Object.values(POWER_CATALOG || {});
const byId = new globalThis.Map(powers.map((p) => [p.id, p]));
function initials(name = "") {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("");
}
function powerColor(p) {
  return (
    p?.color || BRANCHES.find((b) => b.id === p?.branchId)?.color || "#9de7dc"
  );
}
function PowerGlyph({ power, size = 25, className = "" }) {
  const Icon =
    DOMAINS[
      power?.domain || BRANCHES.find((b) => b.id === power?.branchId)?.domain
    ] || Sparkles;
  return (
    <span
      className={`wild-power-glyph ${className}`}
      style={{ "--power-color": powerColor(power) }}
    >
      <Icon size={size} strokeWidth={1.45} />
    </span>
  );
}
function Avatar({ lineage = "angel", kit = KITS[0], compact = false }) {
  const row =
    lineage === "demon"
      ? 1
      : kit.bodyType === "vanguard"
        ? 3
        : kit.bodyType === "wanderer"
          ? 2
          : 0;
  return (
    <div
      role="img"
      aria-label={`${lineage} ${kit.name}`}
      className={`wild-avatar wild-painted-avatar ${compact ? "compact" : ""}`}
      style={{
        backgroundImage: `url("${assetUrl("/assets/v4/hero-sheet.png")}")`,
        backgroundSize: "400% 400%",
        backgroundPosition: `0% ${(row / 3) * 100}%`,
      }}
    />
  );
}
function MiniMap({ snapshot, onOpen }) {
  const region = snapshot.world || snapshot.region || {},
    player = snapshot.player || IDLE_PLAYER;
  const points = snapshot.mapMarkers || snapshot.markers || [];
  return (
    <button
      className="wild-minimap"
      onClick={onOpen}
      aria-label="Open region map"
    >
      <div className="wild-map-heading">
        <Compass size={13} />
        <span>THE WILDS</span>
        <span>N</span>
      </div>
      <svg
        viewBox="0 0 216 142"
        role="img"
        aria-label="Your position in this region"
      >
        <defs>
          <radialGradient id="mini-fade">
            <stop stopColor="#284447" />
            <stop offset="1" stopColor="#101d25" />
          </radialGradient>
        </defs>
        <rect width="216" height="142" fill="url(#mini-fade)" />
        {(region.paths || []).map((path, i) => (
          <polyline
            key={path.id || i}
            points={path.points
              .map(
                (p) =>
                  `${(p.x / (region.width || 2800)) * 204 + 6},${(p.y / (region.height || 2000)) * 130 + 6}`,
              )
              .join(" ")}
            fill="none"
            stroke={region.palette?.pathLight || "#91b3a5"}
            strokeOpacity=".35"
            strokeWidth={Math.max(
              2,
              (path.width / (region.width || 2800)) * 204,
            )}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}
        {region.water?.points && (
          <polyline
            points={region.water.points
              .map(
                (p) =>
                  `${(p.x / (region.width || 2800)) * 204 + 6},${(p.y / (region.height || 2000)) * 130 + 6}`,
              )
              .join(" ")}
            fill="none"
            stroke={region.palette?.waterLight || "#72bed2"}
            strokeOpacity=".45"
            strokeWidth={Math.max(
              3,
              (region.water.width / (region.width || 2800)) * 204,
            )}
          />
        )}
        <path
          d="M54 0v142M108 0v142M162 0v142M0 35h216M0 71h216M0 107h216"
          stroke="#d7e5d3"
          strokeOpacity=".04"
        />
        {points.slice(0, 35).map((p, i) => (
          <circle
            key={p.id || i}
            cx={((p.x || 0) / (region.width || 2800)) * 204 + 6}
            cy={((p.y || 0) / (region.height || 2000)) * 130 + 6}
            r={p.boss ? 3 : 1.7}
            fill={
              p.boss ? "#f3bc7c" : p.kind === "enemy" ? "#e78882" : "#b8dab5"
            }
          />
        ))}
        {snapshot.waypoint && (
          <circle
            cx={(snapshot.waypoint.x / (region.width || 2800)) * 204 + 6}
            cy={(snapshot.waypoint.y / (region.height || 2000)) * 130 + 6}
            r="5"
            fill="none"
            stroke="#e5c1ff"
            strokeWidth="1.6"
          />
        )}
        <circle
          cx={(player.x / (region.width || 2800)) * 204 + 6 || 108}
          cy={(player.y / (region.height || 2000)) * 130 + 6 || 71}
          r="9"
          fill="#b0f4e1"
          opacity=".1"
        />
        <path
          transform={`translate(${(player.x / (region.width || 2800)) * 204 + 6 || 108} ${(player.y / (region.height || 2000)) * 130 + 6 || 71})`}
          d="m0-5 4 9-4-2-4 2Z"
          fill="#e0f7ea"
        />
      </svg>
      <div className="wild-map-footer">
        <span>
          <i />
          OPEN EXPLORATION
        </span>
        <Map size={12} />
      </div>
    </button>
  );
}
function Modal({
  title,
  kicker = "YOUR JOURNEY",
  kind = "",
  children,
  onClose,
  extra,
}) {
  return (
    <div
      className="wild-modal-shade"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className={`wild-modal ${kind}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="wild-modal-head">
          <div>
            <span className="wild-eyebrow">{kicker}</span>
            <h2>{title}</h2>
          </div>
          <div className="wild-modal-head-actions">
            {extra}
            <button
              className="wild-icon-button"
              aria-label="Close dialog"
              onClick={onClose}
            >
              <X size={19} />
            </button>
          </div>
        </header>
        {children}
      </section>
    </div>
  );
}

export default function RebornApp() {
  const canvas = useRef(null),
    engine = useRef(null),
    joystick = useRef(null);
  const [snapshot, setSnapshot] = useState(null),
    [panel, setPanel] = useState(null),
    [sound, setSound] = useState(true),
    [notifications, setNotifications] = useState([]),
    [selectedSlot, setSelectedSlot] = useState(0),
    [filter, setFilter] = useState("All"),
    [search, setSearch] = useState(""),
    [realm, setRealm] = useState("earth"),
    [feedback, setFeedback] = useState("");
  const [offlineProgress, setOfflineProgress] = useState(null),
    [offlineBusy, setOfflineBusy] = useState(false),
    [offlineReady, setOfflineReady] = useState(false);
  const [name, setName] = useState("Aster"),
    [lineage, setLineage] = useState("angel"),
    [kitId, setKitId] = useState("ember"),
    [skin, setSkin] = useState("ivory");
  const kit = KITS.find((k) => k.id === kitId) || KITS[0];
  const player = snapshot?.player || IDLE_PLAYER,
    created = !!player.characterCreated;
  const unlocked = useMemo(
    () => new Set(snapshot?.unlocked || []),
    [snapshot?.unlocked],
  );
  const equipped =
    snapshot?.slotPowers || (snapshot?.slots || []).map((id) => byId.get(id));
  function notify(text, type = "info") {
    if (!text) return;
    const id = Date.now() + Math.random();
    setNotifications((prev) => [...prev.slice(-2), { id, text, type }]);
    setTimeout(
      () => setNotifications((prev) => prev.filter((n) => n.id !== id)),
      4200,
    );
  }
  function call(method, ...args) {
    audio.unlock();
    const result = engine.current?.[method]?.(...args);
    if (result === false && !["castSlot", "interact"].includes(method))
      setFeedback("That action is not available yet. Try again in a moment.");
    return result;
  }
  function open(next) {
    setFeedback("");
    audio.unlock();
    audio.play("click");
    setPanel(next);
  }
  function close() {
    setPanel(null);
    setFeedback("");
  }
  useEffect(() => {
    const game = new RebornEngine(canvas.current, {
      onUpdate: setSnapshot,
      onEvent: (event) => {
        if (event.type === "open-travel") setPanel("map");
        audio.play(event.sound || event.type, event);
        if (
          event.text &&
          !["cast", "hit", "damage", "pickup", "footstep", "step"].includes(
            event.type,
          )
        )
          notify(event.text, event.type);
      },
    });
    engine.current = game;
    game.renderer = new RebornRenderer(canvas.current, game);
    window.__reborn = game;
    window.__eternalReborn = game;
    game.start();
    setSnapshot(game.snapshot());
    return () => {
      game.destroy();
      audio.stop();
      delete window.__reborn;
      delete window.__eternalReborn;
      engine.current = null;
    };
  }, []);
  useEffect(() => {
    if (engine.current) {
      engine.current.inputBlocked = !!panel || !created;
      engine.current.pause(!!panel || !created);
      audio.setPaused(!!panel || !created);
    }
  }, [panel, created]);
  useEffect(() => {
    audio.setBiome(
      snapshot?.world?.biome || snapshot?.region?.biome || "forest",
    );
    audio.setCombat(!!snapshot?.inCombat);
  }, [snapshot?.world?.id, snapshot?.inCombat]);
  useEffect(() => {
    audio.setEnabled(sound);
  }, [sound]);
  useEffect(() => {
    function keyboard(event) {
      if (
        event.target instanceof HTMLElement &&
        /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)
      )
        return;
      if (!created) return;
      if (event.key === "Escape") {
        setPanel((p) => (p ? null : "pause"));
        event.preventDefault();
      } else if (event.code === "KeyB") {
        setPanel((p) => (p === "powers" ? null : "powers"));
        event.preventDefault();
      } else if (event.code === "KeyM") {
        setPanel((p) => (p === "map" ? null : "map"));
        event.preventDefault();
      }
    }
    window.addEventListener("keydown", keyboard);
    return () => window.removeEventListener("keydown", keyboard);
  }, [created]);
  function begin(event) {
    event.preventDefault();
    audio.unlock();
    audio.setEnabled(sound);
    const result = call("createCharacter", {
      name: name.trim() || "Aster",
      lineage,
      kit: kit.id,
      starterBranch: kit.branch,
      appearance: {
        bodyType: kit.bodyType,
        skinTone: skin,
        hairStyle: 1,
        hairColor: lineage === "demon" ? "plum" : "silver",
        armorColor: kit.armorColor,
        auraColor: kit.auraColor,
      },
    });
    if (result !== false) {
      setPanel(null);
      notify(
        "All sixteen starting powers are yours. Make something spectacular.",
        "success",
      );
    }
  }
  function cast(index) {
    if (!engine.current) return;
    audio.unlock();
    const g = engine.current;
    let aim = g.aim || g.pointer;
    if (window.matchMedia("(pointer: coarse)").matches) {
      const foes = (g.enemies || []).filter((e) => !e.dead && e.health > 0);
      const enemy = foes.sort(
        (a, b) =>
          Math.hypot(a.x - g.player.x, a.y - g.player.y) -
          Math.hypot(b.x - g.player.x, b.y - g.player.y),
      )[0];
      if (enemy) aim = enemy;
    }
    call("castSlot", index, aim?.x, aim?.y);
  }
  function moveThumb(event, starting = false) {
    const el = joystick.current;
    if (!el || (!starting && !el.hasPointerCapture(event.pointerId))) return;
    if (starting) el.setPointerCapture(event.pointerId);
    const r = el.getBoundingClientRect(),
      x = (event.clientX - r.left - r.width / 2) / (r.width / 2),
      y = (event.clientY - r.top - r.height / 2) / (r.height / 2),
      g = engine.current;
    if (!g) return;
    ["w", "a", "s", "d"].forEach((k) => g.keys.delete(k));
    if (x < -0.22) g.keys.add("a");
    if (x > 0.22) g.keys.add("d");
    if (y < -0.22) g.keys.add("w");
    if (y > 0.22) g.keys.add("s");
    el.style.setProperty(
      "--stick-x",
      `${Math.max(-27, Math.min(27, x * 27))}px`,
    );
    el.style.setProperty(
      "--stick-y",
      `${Math.max(-27, Math.min(27, y * 27))}px`,
    );
  }
  function releaseThumb() {
    ["w", "a", "s", "d"].forEach((k) => engine.current?.keys.delete(k));
    joystick.current?.style.setProperty("--stick-x", "0px");
    joystick.current?.style.setProperty("--stick-y", "0px");
  }
  const region = snapshot?.world || snapshot?.region || {},
    objective = snapshot?.objective,
    r = snapshot?.rift,
    riftMarker = snapshot?.mapMarkers?.find((point) => point.kind === "rift"),
    nearRift =
      riftMarker &&
      Math.hypot(riftMarker.x - player.x, riftMarker.y - player.y) <= 270;
  const shownPowers = powers.filter(
    (p) =>
      (filter === "All" ||
        p.domain === filter ||
        (filter === "Learned" && unlocked.has(p.id))) &&
      (!search ||
        `${p.name} ${p.domain} ${p.aspect} ${p.description || ""}`
          .toLowerCase()
          .includes(search.toLowerCase())),
  );
  const health = Math.max(
      0,
      Math.min(100, (player.health / (player.maxHealth || 100)) * 100),
    ),
    mana = Math.max(
      0,
      Math.min(100, (player.essence / (player.maxEssence || 100)) * 100),
    );
  const activeKit =
    KITS.find(
      (k) => k.id === player.kit || k.branch === player.starterBranch,
    ) ||
    KITS.find((k) => k.armorColor === player.appearance?.armorColor) ||
    KITS[0];
  return (
    <main className="reborn-root" data-mode="wilds-reborn">
      <canvas
        ref={canvas}
        className="reborn-canvas"
        aria-label="Eternal Powers open world. Move with WASD, aim with the mouse, cast with 1 to 6, dash with Space, interact with E."
        tabIndex={0}
      />
      <div className="wild-vignette" />
      {created && (
        <>
          <header className="wild-topbar">
            <a className="wild-brand" href="#" aria-label="Eternal Powers">
              <span className="wild-brand-mark">✦</span>
              <div>
                ETERNAL POWERS<small>WILDS REBORN</small>
              </div>
            </a>
            <div className="wild-region-heading">
              <span>{region.realm || "Earth"} REALM</span>
              <h1>{region.name || "Sacred Groves"}</h1>
              <p>
                <i />A world of possibilities
              </p>
            </div>
            <nav className="wild-top-actions" aria-label="Game menu">
              <button onClick={() => open("powers")} aria-label="Power library">
                <WandSparkles size={18} />
                <span>Powers</span>
                <kbd>B</kbd>
              </button>
              <button onClick={() => open("map")} aria-label="World map">
                <Map size={18} />
                <span>World</span>
                <kbd>M</kbd>
              </button>
              <button
                className="wild-icon-button"
                onClick={() => {
                  audio.unlock();
                  setSound((s) => !s);
                }}
                aria-label={sound ? "Mute audio" : "Enable audio"}
              >
                {sound ? <Volume2 size={18} /> : <VolumeX size={18} />}
              </button>
              <button
                className="wild-icon-button"
                onClick={() => open("pause")}
                aria-label="Pause game"
              >
                <Pause size={18} />
              </button>
            </nav>
          </header>
          <section className="wild-player-hud" aria-label="Character status">
            <div
              className="wild-player-portrait"
              style={{ "--kit-color": activeKit.color }}
            >
              <Avatar
                lineage={player.lineage}
                kit={activeKit}
                skin={player.appearance?.skinTone}
                compact
              />
              <span>{player.level}</span>
            </div>
            <div className="wild-player-vitals">
              <div>
                <strong>{player.name}</strong>
                <small>{player.lineage === "demon" ? "DEMON" : "ANGEL"}</small>
              </div>
              <div className="wild-vital health">
                <i style={{ width: `${health}%` }} />
                <span>
                  {Math.ceil(player.health)} / {player.maxHealth}
                </span>
                <Heart size={10} />
              </div>
              <div className="wild-vital essence">
                <i style={{ width: `${mana}%` }} />
                <span>
                  {Math.floor(player.essence)} / {player.maxEssence}
                </span>
                <Sparkles size={10} />
              </div>
              <div className="wild-xp-bar">
                <i
                  style={{
                    width: `${Math.min(100, (player.xp / (player.xpToNext || 100)) * 100)}%`,
                  }}
                />
              </div>
            </div>
          </section>
          <div className="wild-loot-summary">
            <span>
              <Sparkles size={13} />
              <b>{player.shards || 0}</b> power shards
            </span>
            <span>
              <Swords size={13} />
              <b>{snapshot?.stats?.kills || 0}</b>{" "}
              <span className="wild-kill-label">creatures defeated</span>
            </span>
          </div>
          <aside className="wild-navigation">
            <MiniMap snapshot={snapshot || {}} onOpen={() => open("map")} />
            <section className="wild-objective" aria-label="Current objective">
              <span className="wild-eyebrow">
                <span className="wild-tiny-diamond" />{" "}
                {r ? "RIFT CHALLENGE" : "YOUR NEXT ADVENTURE"}
              </span>
              <h2>
                {r?.status === "active"
                  ? `Survive wave ${r.wave} / ${r.waves}`
                  : objective?.title || "Make the wilds your own"}
              </h2>
              <p>
                {r?.status === "active"
                  ? `${r.kills || 0} / ${r.total || 0} creatures · ${Math.ceil(r.remaining || 0)}s remaining`
                  : objective?.text ||
                    "Hunt creatures, try a new power, and follow whatever catches your eye."}
              </p>
              {objective?.total > 0 && (
                <div className="wild-objective-progress">
                  <i
                    style={{
                      width: `${Math.min(100, ((objective.progress || 0) / objective.total) * 100)}%`,
                    }}
                  />
                  <span>
                    {objective.progress || 0} / {objective.total}
                  </span>
                </div>
              )}
              <button
                onClick={() =>
                  r?.status === "active" ? call("startRift") : open("guide")
                }
              >
                <Compass size={13} />
                {r?.status === "active"
                  ? "Rift in progress"
                  : "Find your next adventure"}
                <ArrowRight size={13} />
              </button>
            </section>
          </aside>
          {(snapshot?.stats?.combo || 0) > 1 && (
            <div className="wild-combo">
              <span>
                {snapshot.stats.combo}
                <small>×</small>
              </span>
              <strong>POWER CHAIN</strong>
              <i />
            </div>
          )}
          {snapshot?.nearby && (
            <button
              className="wild-interact-prompt"
              onClick={() => call("interact")}
            >
              <kbd>E</kbd>
              <span>
                {snapshot.nearby.prompt || snapshot.nearby.name || "Interact"}
              </span>
              <ArrowRight size={14} />
            </button>
          )}
          <div className="wild-bottom-left">
            <button
              onClick={() => call(nearRift ? "startRift" : "trackRift")}
              aria-label="Start a rift challenge"
              className="wild-rift-button"
            >
              <span>
                <Zap size={17} />
              </span>
              <div>
                <strong>
                  {r?.status === "active"
                    ? "RIFT ACTIVE"
                    : nearRift
                      ? "OPEN A RIFT"
                      : "FIND A RIFT"}
                </strong>
                <small>
                  {r?.status === "active"
                    ? `Wave ${r.wave} of ${r.waves}`
                    : nearRift
                      ? "Waves. Creatures. Big rewards."
                      : "Track a three-wave creature challenge."}
                </small>
              </div>
              <ArrowUpRight size={15} />
            </button>
            <div className="wild-input-hints">
              <span>
                <kbd>WASD</kbd> Move
              </span>
              <span>
                <kbd>SPACE</kbd> Dash
              </span>
              <span>
                <kbd>R</kbd> Heal
              </span>
            </div>
          </div>
          <section className="wild-action-deck" aria-label="Equipped powers">
            <div className="wild-action-caption">
              <span>
                <i />
                YOUR POWER. YOUR RULES.
              </span>
              <button onClick={() => open("powers")}>
                Change loadout <Layers size={11} />
              </button>
            </div>
            <div className="wild-action-row">
              {Array.from({ length: 6 }, (_, index) => {
                const p = equipped[index],
                  remaining = snapshot?.cooldowns?.[p?.id] ?? p?.remaining ?? 0;
                return (
                  <button
                    key={index}
                    className={`wild-action-slot ${remaining > 0 ? "recovering" : ""} ${snapshot?.selectedSlot === index ? "selected" : ""}`}
                    style={{ "--power-color": powerColor(p) }}
                    aria-label={`Cast ${p?.name || `power ${index + 1}`}`}
                    title={`${index + 1} · ${p?.name || "Empty slot"}`}
                    data-testid={`power-slot-${index + 1}`}
                    onClick={() => cast(index)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setSelectedSlot(index);
                      open("powers");
                    }}
                  >
                    <kbd>{index + 1}</kbd>
                    <PowerGlyph power={p} size={31} />
                    {p?.ultimate && (
                      <>
                        <span className="wild-ultimate-crown">
                          <Crown size={10} />
                        </span>
                        <span
                          className="wild-ultimate-meter"
                          aria-label={`Ultimate charge ${Math.floor(player.ultimate)} percent`}
                        >
                          <i style={{ width: `${player.ultimate}%` }} />
                        </span>
                        {player.ultimate < 100 && (
                          <span className="wild-charge-number">
                            {Math.floor(player.ultimate)}%
                          </span>
                        )}
                      </>
                    )}
                    <small>
                      {p?.name?.split(" ").slice(-2).join(" ") || "POWER"}
                    </small>
                    {remaining > 0 && (
                      <span className="wild-cooldown">
                        {remaining.toFixed(remaining < 1 ? 1 : 0)}
                      </span>
                    )}
                    <i className="wild-slot-rim" />
                  </button>
                );
              })}
              <button
                className="wild-potion-slot"
                onClick={() => call("usePotion")}
                aria-label="Drink healing potion"
                title="R · Drink healing potion"
              >
                <kbd>R</kbd>
                <Heart size={23} />
                <span>{player.potions || 0}</span>
              </button>
            </div>
            <div className="wild-mana-note">
              <span>Aim with the mouse · click for your first power</span>
              <span>
                <Sparkles size={9} />
                {equipped.some((p) => p?.ultimate)
                  ? `Ultimate ${player.ultimate >= 100 ? "ready" : `${Math.floor(player.ultimate)}% charged`}`
                  : "Essence regenerates quickly"}
              </span>
            </div>
          </section>
          <div className="wild-mobile-controls">
            <div
              ref={joystick}
              className="wild-thumbstick"
              role="application"
              aria-label="Movement joystick"
              onPointerDown={(e) => moveThumb(e, true)}
              onPointerMove={moveThumb}
              onPointerUp={releaseThumb}
              onPointerCancel={releaseThumb}
            >
              <span />
              <Wind size={20} />
            </div>
            <button
              className="wild-dash-touch"
              onClick={() => call("dash")}
              aria-label="Dash"
            >
              <Wind size={22} />
              <span>DASH</span>
            </button>
            <button
              className="wild-interact-touch"
              onClick={() => call("interact")}
              aria-label="Interact"
            >
              <Sparkles size={18} />
            </button>
          </div>
          {player.health <= 0 && (
            <div className="wild-defeat-overlay">
              <div>
                <span className="wild-eyebrow">ETERNITY IS NOT OVER</span>
                <h2>Rise. Try something new.</h2>
                <p>Your powers and progress are safe.</p>
                <button
                  className="wild-primary"
                  onClick={() => call("respawn")}
                >
                  <Sparkles size={17} /> Return to sanctuary
                </button>
              </div>
            </div>
          )}
        </>
      )}
      {!created && (
        <div className="wild-creator-shade">
          <section
            className="wild-creator"
            role="dialog"
            aria-modal="true"
            aria-label="Create your legend"
          >
            <div className="wild-creator-scene">
              <div className="wild-creator-scene-art" />
              <a className="wild-brand" href="#">
                <span className="wild-brand-mark">✦</span>
                <div>
                  ETERNAL POWERS<small>WILDS REBORN</small>
                </div>
              </a>
              <div className="wild-creator-art-title">
                <span className="wild-eyebrow">A NEW WAY TO PLAY</span>
                <h1>
                  The world is yours
                  <br />
                  to change.
                </h1>
                <p>
                  Unleash your powers. Hunt extraordinary creatures.
                  <br />
                  Follow your curiosity into the wilds.
                </p>
              </div>
              <div className="wild-creator-scene-bottom">
                <span>
                  <WandSparkles size={16} />
                  16 powers from the very beginning
                </span>
                <span>
                  <Compass size={16} />
                  39 regions. No prescribed path.
                </span>
              </div>
            </div>
            <form className="wild-creator-form" onSubmit={begin}>
              <div className="wild-creator-form-head">
                <span className="wild-eyebrow">YOUR ETERNITY STARTS HERE</span>
                <h2>Create your legend.</h2>
                <p>A starting style, never a limit. Mix every power freely.</p>
              </div>
              <label className="wild-name-field">
                Character name
                <input
                  aria-label="Character name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={24}
                  autoComplete="off"
                  placeholder="Your name"
                  required
                  minLength={2}
                />
                <span>{name.length} / 24</span>
              </label>
              <div className="wild-creator-lineage">
                <span className="wild-field-label">YOUR FORM</span>
                <div>
                  {["angel", "demon"].map((value) => (
                    <button
                      key={value}
                      type="button"
                      className={lineage === value ? "selected" : ""}
                      onClick={() => setLineage(value)}
                      aria-label={`Choose ${value === "angel" ? "Angel" : "Demon"}`}
                      aria-pressed={lineage === value}
                    >
                      {value === "angel" ? (
                        <Sun size={19} />
                      ) : (
                        <Moon size={19} />
                      )}
                      <span>
                        {value === "angel" ? "Angel" : "Demon"}
                        <small>
                          {value === "angel"
                            ? "Luminous. Unbound."
                            : "Defiant. Unstoppable."}
                        </small>
                      </span>
                      {lineage === value && <Check size={14} />}
                    </button>
                  ))}
                </div>
              </div>
              <div className="wild-creator-kit-head">
                <span className="wild-field-label">YOUR FIRST INSTINCT</span>
                <small>You can change this anytime</small>
              </div>
              <div className="wild-kit-grid">
                {KITS.map((k) => (
                  <button
                    type="button"
                    key={k.id}
                    className={kit.id === k.id ? "selected" : ""}
                    style={{ "--kit-color": k.color }}
                    onClick={() => setKitId(k.id)}
                    aria-label={`Choose ${k.name}`}
                    aria-pressed={kit.id === k.id}
                  >
                    <k.icon size={22} />
                    <strong>{k.name}</strong>
                    {kit.id === k.id && <Check size={12} />}
                  </button>
                ))}
              </div>
              <div
                className="wild-creator-preview"
                style={{ "--kit-color": kit.color }}
              >
                <Avatar lineage={lineage} kit={kit} skin={skin} />
                <div>
                  <span>{kit.tag}</span>
                  <h3>{kit.name}</h3>
                  <p>{kit.description}</p>
                  <small className="wild-form-note">
                    Your form follows your lineage and first instinct.
                  </small>
                </div>
              </div>
              {feedback && (
                <p className="wild-feedback" role="status">
                  {feedback}
                </p>
              )}
              <button
                type="submit"
                className="wild-primary wild-enter"
                disabled={!snapshot || name.trim().length < 2}
              >
                Enter the wilds <ArrowRight size={17} />
              </button>
              <p className="wild-creator-footnote">
                Move with WASD. Aim with your mouse. Make something spectacular.
              </p>
            </form>
          </section>
        </div>
      )}
      {created && panel === "powers" && (
        <Modal
          title="Your power. Your rules."
          kicker="THE POWER COLLECTION"
          kind="wild-power-modal"
          onClose={close}
          extra={
            <span className="wild-shard-wallet">
              <Sparkles size={16} />
              {player.shards || 0}
              <small>SHARDS</small>
            </span>
          }
        >
          <div className="wild-power-intro">
            <p>Six slots. Every affinity. One spectacular combination.</p>
            <span>
              <Check size={12} />
              {unlocked.size} / 160 powers learned
            </span>
          </div>
          <div className="wild-loadout-picker" aria-label="Choose loadout slot">
            {Array.from({ length: 6 }, (_, i) => {
              const p = equipped[i];
              return (
                <button
                  key={i}
                  className={selectedSlot === i ? "selected" : ""}
                  onClick={() => setSelectedSlot(i)}
                  aria-label={`Equip to slot ${i + 1}`}
                  aria-pressed={selectedSlot === i}
                >
                  <kbd>{i + 1}</kbd>
                  <PowerGlyph power={p} size={20} />
                  <span>{p?.name || "Empty slot"}</span>
                  {selectedSlot === i && <Check size={12} />}
                </button>
              );
            })}
          </div>
          <div className="wild-power-controls">
            <div className="wild-power-filters">
              {["All", "Learned", ...Object.keys(DOMAINS)].map((domain) => (
                <button
                  key={domain}
                  onClick={() => setFilter(domain)}
                  className={filter === domain ? "active" : ""}
                >
                  {domain}
                </button>
              ))}
            </div>
            <label className="wild-search">
              <Search size={16} />
              <input
                aria-label="Search powers"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Find your next favorite"
              />
            </label>
          </div>
          <div className="wild-power-grid">
            {shownPowers.map((p) => {
              const learned = unlocked.has(p.id),
                isEquipped = snapshot?.slots?.[selectedSlot] === p.id,
                cost =
                  p.unlockCost ??
                  Math.min(5, Math.max(1, Math.ceil(p.level / 2)));
              return (
                <article
                  key={p.id}
                  className={`wild-power-card ${learned ? "learned" : "locked"}`}
                  style={{ "--power-color": powerColor(p) }}
                >
                  <div className="wild-power-card-top">
                    <PowerGlyph power={p} size={29} />
                    <span>
                      {p.domain ||
                        BRANCHES.find((b) => b.id === p.branchId)?.domain}
                      <small>LEVEL {p.level}</small>
                    </span>
                    <span className="wild-power-kind">
                      {p.archetype ||
                        p.combatType ||
                        (p.level >= 8 ? "ULTIMATE" : "POWER")}
                    </span>
                  </div>
                  <h3>{p.name}</h3>
                  <p>{p.combatDescription || p.description || p.effect}</p>
                  <div className="wild-power-specs">
                    <span>
                      <Zap size={11} />
                      {p.manaCost ?? p.essenceCost ?? 10} Essence
                    </span>
                    <span>{Number(p.cooldown || 1).toFixed(1)}s cooldown</span>
                  </div>
                  <button
                    className={isEquipped ? "equipped" : ""}
                    disabled={isEquipped || (!learned && player.shards < cost)}
                    aria-label={`${learned ? "Equip" : "Unlock"} ${p.name}`}
                    onClick={() => {
                      setFeedback("");
                      if (learned) {
                        if (call("equipPower", selectedSlot, p.id) !== false)
                          audio.play("click");
                      } else if (call("unlockPower", p.id) !== false) {
                        notify(
                          `${p.name} is yours. Equip it in any slot.`,
                          "unlock",
                        );
                        audio.play("unlock");
                      }
                    }}
                  >
                    {isEquipped ? (
                      <>
                        <Check size={13} />
                        Equipped · slot {selectedSlot + 1}
                      </>
                    ) : learned ? (
                      <>
                        Equip to slot {selectedSlot + 1}
                        <ArrowRight size={12} />
                      </>
                    ) : (
                      <>
                        <Sparkles size={13} />
                        {cost} shards to unlock
                        <ArrowRight size={12} />
                      </>
                    )}
                  </button>
                </article>
              );
            })}
            {shownPowers.length === 0 && (
              <div className="wild-empty">
                <Search size={30} />
                <h3>No powers found</h3>
                <p>Try a different name or affinity.</p>
              </div>
            )}
          </div>
          {feedback && (
            <p className="wild-feedback" role="status">
              {feedback}
            </p>
          )}
          <div className="wild-modal-bottom">
            <span>
              <Sparkles size={13} />
              Hunt creatures and open caches to discover more power shards.
            </span>
            <button onClick={close}>
              Back to the wilds <ArrowRight size={14} />
            </button>
          </div>
        </Modal>
      )}
      {created && panel === "map" && (
        <Modal
          title="Go where curiosity takes you."
          kicker="THE THREE REALMS"
          kind="wild-world-modal"
          onClose={close}
        >
          <div className="wild-world-intro">
            <p>Every region is open. Every journey is yours.</p>
            <div>
              {["earth", "heaven", "hell"].map((value) => (
                <button
                  key={value}
                  className={realm === value ? "active" : ""}
                  onClick={() => setRealm(value)}
                >
                  {value === "earth" ? (
                    <Leaf size={16} />
                  ) : value === "heaven" ? (
                    <Sun size={16} />
                  ) : (
                    <Flame size={16} />
                  )}{" "}
                  {value}
                </button>
              ))}
            </div>
          </div>
          <div className="wild-region-grid">
            {ZONES.filter(
              (z) => (z.realm || "earth").toLowerCase() === realm,
            ).map((z, i) => (
              <button
                className={`wild-region-card ${region.id === z.id ? "current" : ""}`}
                key={z.id}
                onClick={() => {
                  const result = call("setZone", z.id);
                  if (result !== false) {
                    close();
                    audio.play("travel");
                  }
                }}
                aria-label={`Travel to ${z.name}`}
              >
                <span className="wild-region-card-art" style={zoneArt(z)} />
                <span className="wild-region-card-shade" />
                <span className="wild-region-card-top">
                  <span>
                    {String(i + 1).padStart(2, "0")} / {realm.toUpperCase()}
                  </span>
                  {region.id === z.id ? (
                    <small>
                      <MapPin size={10} />
                      YOU ARE HERE
                    </small>
                  ) : snapshot?.discoveredZones?.includes(z.id) ? (
                    <small>DISCOVERED</small>
                  ) : (
                    <small>READY TO EXPLORE</small>
                  )}
                </span>
                <span className="wild-region-card-info">
                  <strong>{z.name}</strong>
                  <span>
                    {/desert/.test(z.id)
                      ? "Ancient sands & buried wonders"
                      : realm === "hell"
                        ? "Obsidian kingdoms & untamed power"
                        : realm === "heaven"
                          ? "Celestial terraces & luminous horizons"
                          : "Living wilds & forgotten sanctuaries"}
                  </span>
                  <i>
                    Travel freely <ArrowUpRight size={17} />
                  </i>
                </span>
              </button>
            ))}
          </div>
        </Modal>
      )}
      {created && panel === "pause" && (
        <Modal
          title="Take a breath."
          kicker="ETERNITY CAN WAIT"
          kind="wild-pause-modal"
          onClose={close}
        >
          <div className="wild-pause-art" />
          <div className="wild-pause-body">
            <span className="wild-eyebrow">
              {player.name} · LEVEL {player.level}
            </span>
            <p>{region.name || "The wilds"} will be here when you return.</p>
            <button className="wild-primary" onClick={close}>
              <Play size={17} />
              Resume adventure
            </button>
            <button className="wild-secondary" onClick={() => open("powers")}>
              <WandSparkles size={17} />
              Change your powers
              <ArrowRight size={15} />
            </button>
            <button className="wild-secondary" onClick={() => open("map")}>
              <Compass size={17} />
              Find a new horizon
              <ArrowRight size={15} />
            </button>
            <button
              className="wild-secondary"
              onClick={() => {
                call("save");
                notify("Your journey is saved.", "save");
              }}
            >
              <Shield size={17} />
              Save your journey
              <Check size={15} />
            </button>
            <button className="wild-secondary" onClick={() => open("guide")}>
              <HelpCircle size={17} />
              How to make spectacular things
              <ArrowRight size={15} />
            </button>
            {offlineAvailable() && (
              <>
                <button
                  className="wild-secondary"
                  disabled={offlineBusy}
                  onClick={async () => {
                    setOfflineBusy(true);
                    setFeedback("");
                    try {
                      await cacheForOffline(setOfflineProgress);
                      setOfflineReady(true);
                    } catch (error) {
                      setFeedback(error.message);
                    } finally {
                      setOfflineBusy(false);
                    }
                  }}
                >
                  <Layers size={17} />
                  {offlineBusy
                    ? "Downloading the wilds…"
                    : "Download for offline play"}
                  <ArrowRight size={15} />
                </button>
                {offlineProgress && (
                  <small className="offline-download-progress">
                    {offlineProgress.cached || 0} / {offlineProgress.total || 0}{" "}
                    assets
                  </small>
                )}
                {offlineReady && (
                  <p className="wild-offline-ready" role="status">
                    Offline library ready
                  </p>
                )}
              </>
            )}
            {feedback && (
              <p className="wild-feedback" role="status">
                {feedback}
              </p>
            )}
            <a className="wild-existing-journey" href="?legacy=1">
              Open your earlier journey <ArrowUpRight size={12} />
            </a>
            <small className="wild-pause-note">
              Your wilds character saves automatically on this device.
            </small>
          </div>
        </Modal>
      )}
      {created && panel === "guide" && (
        <Modal
          title="Make something spectacular."
          kicker="THE WILDS ARE YOUR PLAYGROUND"
          kind="wild-guide-modal"
          onClose={close}
        >
          <div className="wild-guide-grid">
            {[
              {
                icon: WandSparkles,
                title: "Powers first. Always.",
                text: "Your sixteen starting powers are already yours. Open the power library with B, choose a slot, and build a loadout from any affinity.",
              },
              {
                icon: Swords,
                title: "Hunt with style.",
                text: "Aim at a creature and cast. Watch its tell, dash out of danger, and keep the pressure on. Victories bring experience, healing, and power shards.",
              },
              {
                icon: Flame,
                title: "Think in combinations.",
                text: "Pull a group together, freeze it, then unleash a burst. Ignite an explosive object. Break crystals. Try a new element when the world gives you an opening.",
              },
              {
                icon: Compass,
                title: "Pick your own horizon.",
                text: "Open the world map with M and travel freely through the three realms. Look for treasure, powerful creatures, reactive objects and a new view.",
              },
              {
                icon: Zap,
                title: "Open a rift.",
                text: "Ready for a challenge? Open a rift and survive its waves for a bigger reward. Change your powers before you begin.",
              },
              {
                icon: Heart,
                title: "Keep the adventure moving.",
                text: "Use R to heal and Space to dash. Essence returns quickly. If you fall, your earned powers and discoveries stay with you.",
              },
            ].map((t) => (
              <article key={t.title}>
                <t.icon size={26} />
                <h3>{t.title}</h3>
                <p>{t.text}</p>
              </article>
            ))}
          </div>
          <div className="wild-guide-controls">
            {[
              ["W A S D", "Move"],
              ["MOUSE", "Aim"],
              ["CLICK", "Cast slot 1"],
              ["1 — 6", "Cast powers"],
              ["SPACE", "Dash"],
              ["E", "Interact"],
              ["R", "Heal"],
              ["B", "Power library"],
              ["M", "World map"],
            ].map(([key, label]) => (
              <span key={key}>
                <kbd>{key}</kbd>
                {label}
              </span>
            ))}
          </div>
          <div className="wild-modal-bottom">
            <span>Your best combination is the one you discover yourself.</span>
            <button onClick={close}>
              Let's find out <ArrowRight size={14} />
            </button>
          </div>
        </Modal>
      )}
      <div className="wild-notices" aria-live="polite">
        {notifications.map((n) => (
          <div className={`wild-notice notice-${n.type}`} key={n.id}>
            <Sparkles size={14} />
            <span>{n.text}</span>
          </div>
        ))}
      </div>
    </main>
  );
}
