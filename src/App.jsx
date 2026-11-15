import { assetUrl } from "./assetUrl.js";
import React, { useEffect, useRef, useState } from "react";
import {
  Compass,
  Users,
  Wifi,
  BookOpen,
  Backpack,
  Map,
  Sparkles,
  Settings,
  Volume2,
  VolumeX,
  Maximize,
  ChevronRight,
  ChevronDown,
  X,
  Sun,
  Moon,
  Leaf,
  Wind,
  Flame,
  Mountain,
  Heart,
  Eye,
  Skull,
  Droplets,
  Shield,
  Swords,
  Home,
  CircleHelp,
  ArrowUpRight,
  Check,
  Plus,
  Lock,
  ScrollText,
  Gem,
  Crosshair,
  Save,
  RotateCcw,
  Play,
  Pause,
  Hammer,
  ShoppingBag,
  Search,
  ArrowRight,
  Feather,
  Circle,
  WandSparkles,
} from "lucide-react";
import { GameEngine, ITEMS, RECIPES, SAVE_KEY } from "./game/engine.js";
import AdvancedPowers from "./components/AdvancedPowers.jsx";
import CharacterCreator, {
  CharacterPortrait,
} from "./components/CharacterCreator.jsx";
import CreatureInteraction from "./components/CreatureInteraction.jsx";
import RegionAtlas from "./components/RegionAtlas.jsx";
import {
  AdventurePanel,
  ObjectiveTracker,
  InteractionPanel,
} from "./components/AdventurePanel.jsx";

import RespecializationPanel from "./components/RespecializationPanel.jsx";
import SanctuaryPanel from "./components/SanctuaryPanel.jsx";
import WorldPanel from "./components/WorldPanel.jsx";
import "./systems.css";
import "./expansion.css";
import ContractsPanel from "./components/ContractsPanel.jsx";
import SocialPanel, { RecoveryOverlay } from "./components/SocialPanel.jsx";
import { zoneArt } from "./zoneArt.js";
import WorldMinimap from "./components/WorldMinimap.jsx";
import NetworkClient from "./network/NetworkClient.js";
import MultiplayerPanel from "./components/MultiplayerPanel.jsx";
import "./network.css";
import {
  offlineAvailable,
  getOfflineStatus,
  cacheForOffline,
  offlineConnectionNotice,
} from "./offline.js";
import {
  BRANCHES,
  ZONES,
  CREATURES,
  ENHANCEMENTS,
  TECHNIQUES,
  RANKS,
  RULES,
} from "./data/manual.js";
import { audio } from "./audio.js";

const DOMAIN_ICONS = {
  Love: Heart,
  Light: Sun,
  Water: Droplets,
  Air: Wind,
  Hate: Skull,
  Dark: Moon,
  Fire: Flame,
  Earth: Mountain,
};
const NAV = [
  { id: "play", label: "Explore", icon: Compass },
  { id: "powers", label: "Powers", icon: Sparkles },
  { id: "inventory", label: "Inventory", icon: Backpack },
  { id: "map", label: "World map", icon: Map },
  { id: "sanctuary", label: "Sanctuary", icon: Home },
  { id: "world", label: "World model", icon: Sun },
  { id: "adventure", label: "Faction campaign", icon: ScrollText },
  { id: "contracts", label: "Regional contracts", icon: ScrollText },
  { id: "social", label: "Standing & recovery", icon: Eye },
  { id: "multiplayer", label: "Private co-op", icon: Users },
  { id: "journal", label: "Journal", icon: ScrollText },
  { id: "codex", label: "Codex", icon: BookOpen },
];
const START_SLOTS = [
  "love-laugh",
  "light-pleasure",
  "water-grow",
  "air-move",
  "hate-clean",
  "dark-heal",
  "fire-create",
  "earth-give",
];
const INITIAL = {
  player: {
    name: "Wanderer",
    lineage: "angel",
    health: 100,
    maxHealth: 100,
    essence: 100,
    maxEssence: 100,
    rank: 1,
    goodKarma: 0,
    badKarma: 0,
    lifetimeGood: 0,
    lifetimeBad: 0,
    inventory: { draught: 2, herb: 0, crystal: 0, wood: 0, stone: 0 },
  },
  zone: { id: "sacred-groves", name: "Sacred Groves", subtitle: "Earth realm" },
  quests: [],
  discoveredZones: [],
  selectedPower: {
    branchId: "love-laugh",
    level: 1,
    name: "Gentle Chuckle",
    cost: 10,
    remaining: 0,
  },
  inCombat: false,
};
function DomainIcon({ domain, ...props }) {
  const Icon = DOMAIN_ICONS[domain] || Sparkles;
  return <Icon {...props} />;
}
function initialLoadout() {
  try {
    const slots = JSON.parse(
      localStorage.getItem("eternal-powers-loadout") || "null",
    );
    if (
      Array.isArray(slots) &&
      slots.length === 8 &&
      slots.every(
        (s) =>
          BRANCHES.some((b) => b.id === s.branchId) &&
          Number.isInteger(s.level) &&
          s.level >= 1 &&
          s.level <= 10,
      )
    )
      return slots;
  } catch {}
  return START_SLOTS.map((branchId) => ({ branchId, level: 1 }));
}
function itemArtwork(id, rank = 1) {
  if (["focus", "ward", "utility"].includes(id))
    return assetUrl(
      `/assets/equipment-icons/${id}-${Math.max(1, Math.min(10, rank))}.png`,
    );
  if (["wallComponent", "gardenBed", "portalAnchor"].includes(id))
    return assetUrl(
      `/assets/build-${{ wallComponent: "wall", gardenBed: "garden", portalAnchor: "portal" }[id]}.png`,
    );
  return assetUrl(
    `/assets/item-${{ draught: "health", essenceDraught: "essence-tonic", wood: "timber", cleansingCharm: "seed", protectiveCharm: "crystal" }[id] || id}.png`,
  );
}
function Key({ children }) {
  return <kbd>{children}</kbd>;
}
function Emblem({ small = false }) {
  return (
    <div className={`emblem ${small ? "small" : ""}`}>
      <span>E</span>
      <i />
    </div>
  );
}
function App() {
  const canvas = useRef(null),
    game = useRef(null),
    network = useRef(null),
    restoreInput = useRef(null);
  const [state, setState] = useState(INITIAL);
  const [engineReady, setEngineReady] = useState(false);
  const [creatorBusy, setCreatorBusy] = useState(false);
  const [creatorError, setCreatorError] = useState("");
  const [mapView, setMapView] = useState("realm");
  const [networkState, setNetworkState] = useState({
    status: "offline",
    players: [],
  });
  const [offlineStatus, setOfflineStatus] = useState(null),
    [offlineProgress, setOfflineProgress] = useState(null),
    [offlineBusy, setOfflineBusy] = useState(false),
    [offlineNotice, setOfflineNotice] = useState(offlineConnectionNotice),
    [installPrompt, setInstallPrompt] = useState(null);
  const [panel, setPanel] = useState(null);
  const [notices, setNotices] = useState([]);
  const [sound, setSound] = useState(false);
  const [paused, setPaused] = useState(false);
  const [branchId, setBranchId] = useState("water-grow");
  const [codexTab, setCodexTab] = useState("creatures");
  const [search, setSearch] = useState("");
  const [slots, setSlots] = useState(initialLoadout);
  const [welcome, setWelcome] = useState(false);
  const [lineage, setLineage] = useState("angel");
  const [starter, setStarter] = useState("love-laugh");
  const [reduced, setReduced] = useState(false);
  const [volume, setVolume] = useState(45);
  const [confirmed, setConfirmed] = useState(null);
  const [powerTab, setPowerTab] = useState("branches");
  const [dialogue, setDialogue] = useState("");
  const [worldTab, setWorldTab] = useState("overview");
  const [shopMode, setShopMode] = useState("buy");
  const [resetConfirm, setResetConfirm] = useState(false);
  const [creatureProfile, setCreatureProfile] = useState(null);
  const [pendingEquip, setPendingEquip] = useState(null);
  const [scoreMode, setScoreMode] = useState("original");
  const [natureAmbience, setNatureAmbience] = useState(true);
  const [socialTab, setSocialTab] = useState("standing");
  const [adventureTab, setAdventureTab] = useState("story");
  const notify = (text, type = "info") => {
    const id = Date.now() + Math.random();
    setNotices((p) => [...p.slice(-2), { id, text, type }]);
    setTimeout(() => setNotices((p) => p.filter((n) => n.id !== id)), 5000);
  };
  useEffect(() => {
    const g = new GameEngine(canvas.current, {
      onUpdate: (s) => setState(s),
      onEvent: (e) => {
        if (e.quiet || e.type === "sound") {
          if (e.sound) audio.play(e.sound, e.audioOptions || {});
          return;
        }
        if (e.type === "open-shop" || e.type === "shop") setPanel("shop");
        else if (e.type === "open-map") setPanel("map");
        else if (e.type === "open-adventure") {
          setAdventureTab(
            e.audioOptions?.tab === "activities" ? "activities" : "story",
          );
          setPanel("adventure");
        } else if (e.type === "open-interaction") setPanel("interact");
        else if (e.type === "close-interaction") setPanel(null);
        else if (e.type === "open-craft") setPanel("craft");
        else if (e.type === "open-powers") setPanel("powers");
        else if (e.type === "open-world" || e.type === "open-ritual") {
          setWorldTab(e.type === "open-ritual" ? "rituals" : "overview");
          setPanel("world");
        } else if (e.type === "open-sanctuary") setPanel("sanctuary");
        else if (e.type === "open-contracts" || e.type === "contract-dialogue")
          setPanel("contracts");
        else if (e.type === "open-social") setPanel("social");
        else if (e.type === "open-creature") {
          setPanel("interact");
        } else if (e.type === "dialogue") {
          setDialogue(e.text);
          setPanel("dialogue");
        } else notify(e.text || e.message || "The world has changed.", e.type);
        if (e.sound) audio.play(e.sound, e.audioOptions || {});
      },
    });
    game.current = g;
    network.current = new NetworkClient(g, { onUpdate: setNetworkState });
    window.__eternalNetwork = network.current;
    g.inputBlocked = !g.player.characterCreated;
    g.setPaused(!g.player.characterCreated);
    g.start();
    window.__eternal = g;
    setEngineReady(true);
    return () => {
      network.current?.detach();
      network.current?.destroy();
      network.current = null;
      delete window.__eternalNetwork;
      g.destroy();
      game.current = null;
      delete window.__eternal;
    };
  }, []);
  useEffect(() => {
    if (game.current) {
      const needsCharacter = !game.current.player.characterCreated;
      game.current.inputBlocked = !!panel || needsCharacter;
      game.current.setPaused(
        needsCharacter ||
          paused ||
          !!(
            panel &&
            ![
              "world",
              "adventure",
              "interact",
              "sanctuary",
              "craft",
              "shop",
              "contracts",
              "social",
              "multiplayer",
            ].includes(panel)
          ) ||
          welcome,
      );
    }
  }, [paused, panel, welcome, engineReady, state.player?.characterCreated]);
  useEffect(() => {
    try {
      localStorage.setItem("eternal-powers-loadout", JSON.stringify(slots));
    } catch {}
  }, [slots]);
  useEffect(() => {
    setConfirmed(null);
    setPendingEquip(null);
    if (panel === "character") {
      const p = game.current?.getSnapshot().player;
      if (p) {
        setLineage(p.lineage);
        setStarter(
          p.starterBranch || Object.keys(p.learned || {})[0] || "water-grow",
        );
      }
    }
  }, [panel]);
  useEffect(() => {
    if (panel === "inspect" && state.target?.creatureId)
      setCreatureProfile(game.current?.inspectCreature(state.target.id));
    else setCreatureProfile(null);
  }, [
    panel,
    state.target?.id,
    state.player?.companion?.creatureId,
    state.time,
  ]);
  useEffect(() => {
    if (state.zone?.id) audio.setBiome(state.zone.id);
  }, [state.zone?.id]);
  useEffect(() => {
    const handle = (e) => {
      if (e.target.matches("input,textarea,select")) return;
      if (!game.current?.player.characterCreated) return;
      if (e.key === "Escape") {
        setPanel(null);
        setWelcome(false);
        setPaused(false);
        return;
      }
      if (panel || welcome) return;
      if (/^[1-8]$/.test(e.key)) {
        selectSlot(Number(e.key) - 1);
        e.preventDefault();
      }
      if (e.code === "KeyQ") {
        game.current?.cast();
        e.preventDefault();
      }
      if (e.code === "KeyR") game.current?.usePotion();
      if (e.code === "KeyI") setPanel("inventory");
      if (e.code === "KeyM") setPanel("map");
      if (e.code === "KeyJ") setPanel("journal");
      if (e.code === "KeyP") setPanel("powers");
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [panel, welcome, slots]);
  useEffect(() => {
    audio.updateWorld?.({
      biome: state.zone?.id,
      weather: state.worldModel?.weather,
      phase: state.worldModel?.phase,
      moving: state.player?.walking,
      terrain: state.zone?.name,
      sprinting: state.player?.sprinting,
      flying: state.player?.statuses?.some((s) => s.type === "flight"),
    });
  }, [state.time]);
  useEffect(() => {
    const connection = () => setOfflineNotice(offlineConnectionNotice());
    const install = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener("online", connection);
    window.addEventListener("offline", connection);
    window.addEventListener("beforeinstallprompt", install);
    return () => {
      window.removeEventListener("online", connection);
      window.removeEventListener("offline", connection);
      window.removeEventListener("beforeinstallprompt", install);
    };
  }, []);
  useEffect(() => {
    if (panel === "settings" && offlineAvailable())
      getOfflineStatus()
        .then(setOfflineStatus)
        .catch(() => {});
  }, [panel]);
  async function downloadOffline() {
    setOfflineBusy(true);
    setOfflineProgress(null);
    try {
      const result = await cacheForOffline(setOfflineProgress);
      setOfflineStatus(result);
      notify(
        "Offline solo game downloaded. Your save remains in this browser.",
        "success",
      );
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setOfflineBusy(false);
    }
  }
  function selectSlot(i) {
    const slot = slots[i];
    if (!slot) return;
    setBranchId(slot.branchId);
    game.current?.setPower(slot.branchId, slot.level);
  }
  function toggleSound() {
    const enabled = !sound;
    setSound(enabled);
    audio.unlock();
    audio.setEnabled(enabled);
    if (enabled) audio.play("click");
  }
  function call(method, ...args) {
    audio.unlock();
    return game.current?.[method]?.(...args);
  }
  function open(id) {
    if (!game.current?.player.characterCreated) return;
    if (id === "map") setMapView("realm");
    if (id === "social") setSocialTab("standing");
    if (id === "adventure") setAdventureTab("story");
    if (id === "play") setPanel(null);
    else {
      setPanel(id);
      setSearch("");
      if (id === "codex") setCodexTab("creatures");
      if (id === "map") setCodexTab("Earth");
    }
    audio.play("click");
  }
  const items = state.shop?.items || state.items || ITEMS;
  const recipes = state.shop?.recipes || state.recipes || RECIPES;
  const player = state.player || INITIAL.player;
  const selected = state.selectedPower || INITIAL.selectedPower;
  const branch = BRANCHES.find((b) => b.id === branchId) || BRANCHES[0];
  const completed = (state.quests || []).filter((q) => q.complete).length;
  const activeQuest =
    (state.objective?.rewardEligible !== false ? state.objective : null) ||
    (state.quests || []).find((q) => !q.complete && q.rewardEligible !== false);
  const life = player.certified
    ? (player.lifetimeGood || 0) + (player.lifetimeBad || 0)
    : player.lineage === "demon"
      ? player.lifetimeBad || 0
      : player.lifetimeGood || 0;
  const nextRank = 500 * player.rank ** 2;
  const learnedLevel = (id) =>
    player.learned?.[id] ??
    player.learnedPowers?.[id] ??
    state.learnedPowers?.[id] ??
    0;
  const sceneArt = assetUrl(
    `/assets/v2/regions/${state.zone?.id || "sacred-groves"}.svg`,
  );
  const currentRank = (Array.isArray(RANKS) ? RANKS : []).find(
    (r) => r.rank === player.rank,
  );
  const rankName =
    player.lineage === "demon"
      ? currentRank?.demon || "Infernal Initiate"
      : currentRank?.angel || "Celestial Initiate";
  function equip(id, level = 1) {
    if (state.inCombat) {
      notify("Leave conflict for five seconds before changing your loadout.");
      return;
    }
    if (learnedLevel(id) >= level) setPendingEquip({ branchId: id, level });
  }
  function assignSlot(i) {
    setSlots((prev) => prev.map((s, j) => (j === i ? pendingEquip : s)));
    call("setPower", pendingEquip.branchId, pendingEquip.level);
    setPendingEquip(null);
    setPanel(null);
  }
  function exportJourney() {
    call("save", false);
    try {
      const save = JSON.parse(localStorage.getItem(SAVE_KEY) || "null");
      const blob = new Blob(
        [
          JSON.stringify(
            {
              format: "eternal-powers-backup",
              version: 1,
              save,
              loadout: slots,
              preferences: { volume, reduced },
            },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "eternal-powers-journey.json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      notify("Journey backup downloaded.", "success");
    } catch {
      notify("This journey could not be exported.", "error");
    }
  }
  async function restoreJourney(file) {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const save =
        parsed.format === "eternal-powers-backup" ? parsed.save : parsed;
      if (
        save?.version !== 1 ||
        !save.player ||
        !["angel", "demon"].includes(save.player.lineage) ||
        !Number.isFinite(save.player.rank) ||
        save.player.rank < 1 ||
        save.player.rank > 10 ||
        !ZONES.some((z) => z.id === save.zoneId) ||
        !save.player.inventory ||
        typeof save.player.inventory !== "object"
      )
        throw Error("Invalid save");
      localStorage.setItem(SAVE_KEY, JSON.stringify(save));
      if (Array.isArray(parsed.loadout) && parsed.loadout.length === 8)
        localStorage.setItem(
          "eternal-powers-loadout",
          JSON.stringify(parsed.loadout),
        );
      location.reload();
    } catch {
      notify(
        "Choose a valid Eternal Powers journey JSON file. Your current journey is unchanged.",
        "error",
      );
      if (restoreInput.current) restoreInput.current.value = "";
    }
  }
  function touchMove(e, key, down) {
    e.preventDefault();
    if (down) {
      e.currentTarget.setPointerCapture(e.pointerId);
      game.current?.keys.add(key);
    } else game.current?.keys.delete(key);
  }
  function fullScreen() {
    const el = document.querySelector(".game-viewport");
    if (!document.fullscreenElement) el?.requestFullscreen?.();
    else document.exitFullscreen?.();
  }
  return (
    <div className={`app v2 ${reduced ? "reduced-motion" : ""}`}>
      {offlineNotice && (
        <div className="offline-notice">
          <Wifi size={12} />
          {offlineNotice}
        </div>
      )}
      <header className="topbar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setPanel(null);
          }}
        >
          <Emblem />
          <div>
            <span>ETERNAL POWERS</span>
            <small>V3 · CONCORD & COVENANT</small>
          </div>
        </a>
        <div className="top-navigation">
          <button
            className={!panel ? "active" : ""}
            onClick={() => open("play")}
          >
            World
          </button>
          <button
            className={panel === "powers" ? "active" : ""}
            onClick={() => open("powers")}
          >
            Abilities
          </button>
          <button
            className={panel === "codex" ? "active" : ""}
            onClick={() => open("codex")}
          >
            Codex <ArrowUpRight size={12} />
          </button>
        </div>
        <div className="top-actions">
          <div className="world-status">
            <i />{" "}
            {networkState.room
              ? `${networkState.players?.length || 1} TRAVELERS`
              : "SINGLE PLAYER"}{" "}
            <span>·</span> {networkState.room ? "CONNECTED" : "WORLD SAVED"}
          </div>
          <button
            className="icon-button sound-button"
            onClick={toggleSound}
            title={sound ? "Mute music and sounds" : "Enable music and sounds"}
            aria-label={sound ? "Mute audio" : "Enable audio"}
          >
            {sound ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
          <button
            className="profile-button"
            onClick={() => open("character")}
            aria-label="Character profile"
          >
            <CharacterPortrait
              compact
              appearance={player.appearance}
              lineage={player.lineage}
              className="v2-profile-portrait"
              title={`${player.name}'s character`}
            />
            <Feather size={20} />
          </button>
        </div>
      </header>
      <div className="app-body">
        <aside className="navigation-rail">
          <div className="rail-main">
            {NAV.map((n) => (
              <button
                key={n.id}
                className={
                  panel === n.id || (!panel && n.id === "play")
                    ? "selected"
                    : ""
                }
                title={n.label}
                aria-label={n.label}
                onClick={() => open(n.id)}
              >
                <n.icon size={21} />
                <span>{n.label}</span>
              </button>
            ))}
          </div>
          <div className="rail-bottom">
            <button
              onClick={() => open("help")}
              title="How to play"
              aria-label="How to play"
            >
              <CircleHelp size={20} />
            </button>
            <button
              onClick={() => open("settings")}
              title="Settings"
              aria-label="Settings"
            >
              <Settings size={20} />
            </button>
            <div className="rail-ornament">✧</div>
          </div>
        </aside>
        <main className="main">
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                <span className="tiny-diamond" /> THE{" "}
                {(state.zone?.realm || "earth").toUpperCase()} REALM{" "}
                <ChevronRight size={12} /> EXPLORATION
              </div>
              <h1>
                {state.zone?.name || "Sacred Groves"}
                <span className="zone-tag">RANK {player.rank}</span>
              </h1>
            </div>
            <div className="heading-wallet">
              <div>
                <Sun size={17} />
                <span>
                  <strong>
                    {Math.floor(player.goodKarma || 0).toLocaleString()}
                  </strong>
                  <small>Good karma</small>
                </span>
              </div>
              <span className="wallet-divider" />
              <div>
                <Moon size={17} />
                <span>
                  <strong>
                    {Math.floor(player.badKarma || 0).toLocaleString()}
                  </strong>
                  <small>Bad karma</small>
                </span>
              </div>
              <button className="subtle-button" onClick={() => open("map")}>
                World map <ArrowUpRight size={14} />
              </button>
            </div>
          </div>
          <div className="play-layout">
            <section className="game-section">
              <div className="game-viewport">
                <canvas
                  ref={canvas}
                  aria-label="Eternal Powers playable world. Use WASD to move, E to interact, F to attack, Q to cast."
                  tabIndex={0}
                />
                <div className="game-vignette" />
                <div className="game-hud-top">
                  <div className="character-hud">
                    <div className="avatar-gem">
                      <CharacterPortrait
                        compact
                        appearance={player.appearance}
                        lineage={player.lineage}
                        className="v2-hud-portrait"
                        title={player.name}
                      />
                      <span>{player.rank}</span>
                    </div>
                    <div className="vitals">
                      <div className="character-name">
                        {player.name || "Wanderer"}{" "}
                        <span>
                          {player.lineage === "demon" ? "DEMON" : "ANGEL"}
                        </span>
                      </div>
                      <div className="vital-bar health">
                        <div
                          style={{
                            width: `${(player.health / player.maxHealth) * 100}%`,
                          }}
                        />
                        <span>
                          <Heart size={9} /> {Math.ceil(player.health)}{" "}
                          <i>/ {player.maxHealth}</i>
                        </span>
                      </div>
                      <div className="vital-bar essence">
                        <div
                          style={{
                            width: `${(player.essence / player.maxEssence) * 100}%`,
                          }}
                        />
                        <span>
                          <Sparkles size={9} /> {Math.floor(player.essence)}{" "}
                          <i>/ {player.maxEssence}</i>
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="location-hud">
                    <span>✦</span>
                    <small>
                      {state.inCombat ? "IN CONFLICT" : "A MOMENT OF PEACE"}
                    </small>
                    <p>
                      {state.inCombat
                        ? "Stand your ground."
                        : "Every journey begins with a choice."}
                    </p>
                  </div>
                  <div className="game-tools">
                    <button
                      onClick={() => {
                        setPaused(!paused);
                      }}
                      title={paused ? "Resume" : "Pause"}
                      aria-label={paused ? "Resume game" : "Pause game"}
                    >
                      {paused ? <Play size={15} /> : <Pause size={15} />}
                    </button>
                    <button
                      onClick={fullScreen}
                      title="Fullscreen"
                      aria-label="Fullscreen"
                    >
                      <Maximize size={15} />
                    </button>
                  </div>
                </div>
                <div className="minimap">
                  <WorldMinimap
                    engine={game.current}
                    state={state}
                    onOpenAtlas={() => {
                      setMapView("region");
                      setPanel("map");
                    }}
                  />
                  <ObjectiveTracker state={state} call={call} open={open} />
                </div>
                {state.target && (
                  <div className="target-info">
                    <Crosshair size={13} />
                    <span>{state.target.name}</span>
                    {state.target.maxHealth && (
                      <small>
                        {Math.ceil(state.target.health)} /{" "}
                        {state.target.maxHealth}
                      </small>
                    )}
                    <button
                      onClick={() => call("openInteraction", state.target.id)}
                      title="Inspect target"
                      aria-label="Inspect target"
                    >
                      <Eye size={13} />
                    </button>
                    <button onClick={() => call("interact")}>
                      <Key>E</Key>
                    </button>
                  </div>
                )}
                {player.companion && (
                  <button
                    className="system-companion"
                    onClick={() => setPanel("companion")}
                  >
                    <Heart size={12} />
                    {player.companion.name} · {player.companion.mode}
                  </button>
                )}
                <div className="world-label">
                  <i />
                  {state.inCombat ? "CONFLICT ZONE" : "SANCTUARY NEARBY"}
                </div>
                <div className="game-toast-stack">
                  {notices.map((n) => (
                    <div key={n.id} className={`game-toast ${n.type}`}>
                      <Sparkles size={15} />
                      {n.text}
                    </div>
                  ))}
                </div>
                <RecoveryOverlay state={state} call={call} />
                {paused && !panel && (
                  <div className="pause-shade">
                    <Emblem />
                    <h2>
                      {networkState.room
                        ? "Take a moment."
                        : "The world can wait."}
                    </h2>
                    {networkState.room && (
                      <p className="shared-pause-note">
                        Your party’s world continues while your controls are
                        paused.
                      </p>
                    )}
                    <button
                      className="primary-button"
                      onClick={() => setPaused(false)}
                    >
                      <Play size={14} /> Continue exploring
                    </button>
                  </div>
                )}
                {state.castState && (
                  <div className="cast-progress">
                    <span>{state.castState.name}</span>
                    <div>
                      <i
                        style={{ width: `${state.castState.progress * 100}%` }}
                      />
                    </div>
                  </div>
                )}
                {state.recalling > 0 && (
                  <div className="cast-progress">
                    <span>Recalling · {Math.ceil(state.recalling)}s</span>
                    <div>
                      <i
                        style={{ width: `${(1 - state.recalling / 5) * 100}%` }}
                      />
                    </div>
                  </div>
                )}
                <div className="context-action">
                  <button onClick={() => call("interact")}>
                    <Key>E</Key>
                    <span>
                      {state.interactionHint?.replace("[E] ", "") ||
                        "Interact with the world"}
                    </span>
                  </button>
                </div>
                <div className="mobile-pad" aria-label="Touch movement">
                  {[
                    ["w", "↑"],
                    ["a", "←"],
                    ["s", "↓"],
                    ["d", "→"],
                  ].map(([key, label]) => (
                    <button
                      className={`move-${key}`}
                      key={key}
                      aria-label={`Move ${key === "w" ? "up" : key === "s" ? "down" : key === "a" ? "left" : "right"}`}
                      onPointerDown={(e) => touchMove(e, key, true)}
                      onPointerUp={(e) => touchMove(e, key, false)}
                      onPointerCancel={(e) => touchMove(e, key, false)}
                    >
                      {label}
                    </button>
                  ))}
                  <button
                    className="touch-dodge"
                    aria-label="Dodge"
                    onClick={() => call("dodge")}
                  >
                    <Wind size={17} />
                  </button>
                </div>
                <div className="quickbar-wrap">
                  <div className="quickbar-label">
                    <span /> YOUR POWERS <span />
                  </div>
                  <div className="quickbar">
                    <button
                      className="attack-slot"
                      title="Basic strike · F"
                      onClick={() => call("attack")}
                    >
                      <Swords size={25} />
                      <Key>F</Key>
                    </button>
                    <div className="slot-divider" />
                    {slots.map((slot, i) => {
                      const id = slot.branchId,
                        level = slot.level;
                      const b = BRANCHES.find((x) => x.id === id);
                      return (
                        <button
                          key={i}
                          className={`power-slot ${selected.branchId === id && selected.level === level ? "active" : ""} ${learnedLevel(id) >= level ? "" : "unlearned"}`}
                          style={{ "--power-color": b?.color || "#b9bc85" }}
                          onClick={() => selectSlot(i)}
                          onDoubleClick={() => {
                            setBranchId(id);
                            open("powers");
                          }}
                          title={`${b?.name} · ${b?.powers?.[level - 1]?.name} · Level ${level} ${learnedLevel(id) >= level ? "" : "(learn in Powers)"}`}
                        >
                          <div className="slot-aura" />
                          <img
                            className="power-sprite"
                            src={assetUrl(
                              `/assets/power-icons/${id}-${level}.png`,
                            )}
                            alt=""
                          />
                          <span className="slot-level">{level}</span>
                          <Key>{i + 1}</Key>
                          {learnedLevel(id) < level && (
                            <Lock className="slot-lock" size={9} />
                          )}
                        </button>
                      );
                    })}
                    <div className="slot-divider" />
                    <button
                      className="potion-slot"
                      title="Restorative draught · R"
                      onClick={() => call("usePotion")}
                    >
                      <img
                        src={assetUrl("/assets/item-health.png")}
                        onError={(e) =>
                          (e.currentTarget.style.display = "none")
                        }
                        alt=""
                      />
                      <Heart size={23} />
                      <Key>R</Key>
                      <span className="potion-count">
                        {player.inventory?.draught || 0}
                      </span>
                    </button>
                  </div>
                  <button
                    className="cast-selected"
                    onClick={() => call("cast")}
                  >
                    <Key>Q</Key> Cast {selected.name || "selected power"}{" "}
                    <span>
                      {!selected.learned
                        ? "Unlearned"
                        : selected.remaining > 0
                          ? `${Math.ceil(selected.remaining)}s`
                          : `${selected.essenceCost || 10} Essence`}
                    </span>
                  </button>
                </div>
              </div>
              <div className="game-bottom-strip">
                <div>
                  <span className="live-dot" />
                  <button
                    className="world-time-link"
                    onClick={() => {
                      setWorldTab("overview");
                      setPanel("world");
                    }}
                  >
                    {state.worldModel
                      ? `Day ${state.worldModel.day || 1} · ${state.worldModel.phase || "Morning"} · ${typeof state.worldModel.weather === "object" ? state.worldModel.weather.label || state.worldModel.weather.name || state.worldModel.weather.id || state.worldModel.weather.type : state.worldModel.weather || "Clear"}`
                      : "A living, changing world"}
                  </button>{" "}
                  <span className="strip-separator">·</span> Concord & Covenant
                  · v3.0
                </div>
                <button
                  onClick={() => {
                    call("save");
                    notify("Your journey has been saved.", "success");
                  }}
                >
                  <Save size={12} /> Save journey
                </button>
              </div>
              <div className="controls-strip">
                <span>
                  <Key>W</Key>
                  <Key>A</Key>
                  <Key>S</Key>
                  <Key>D</Key> Move
                </span>
                <span>
                  <Key>SHIFT</Key> Sprint
                </span>
                <span>
                  <Key>SPACE</Key> Dodge
                </span>
                <span>
                  <Key>E</Key> Interact
                </span>
                <span>
                  <Key>Q</Key> Cast
                </span>
                <button onClick={() => open("help")}>
                  All controls <ArrowUpRight size={12} />
                </button>
              </div>
            </section>
            <aside className="journey-sidebar">
              <div className="journey-header">
                <span className="eyebrow">YOUR JOURNEY</span>
                <button
                  onClick={() => open("journal")}
                  title="Open journal"
                  aria-label="Open journal"
                >
                  <ScrollText size={16} />
                </button>
              </div>
              <div className="journey-art">
                <img src={sceneArt} alt="A celestial sanctuary in this realm" />
                <div className="journey-art-shade" />
                <span className="chapter-tag">CHAPTER I</span>
                <h2>
                  A spark of
                  <br />
                  something eternal.
                </h2>
              </div>
              <div className="quest-panel">
                <div className="section-caption">
                  <span>THE FIRST STEPS</span>
                  <small>
                    {completed}/{state.quests?.length || 5}
                  </small>
                </div>
                <h3>{activeQuest?.title || "Awaken your potential"}</h3>
                <p>
                  {activeQuest?.description ||
                    "Meet the keeper, discover your first power, and find your place in a world shaped by choice."}
                </p>
                <div className="quest-list">
                  {(state.quests || [])
                    .filter((q) => q.rewardEligible !== false)
                    .slice(0, 4)
                    .map((q, i) => (
                      <button
                        key={q.id}
                        className={
                          q.complete
                            ? "done"
                            : activeQuest?.id === q.id
                              ? "current"
                              : ""
                        }
                        onClick={() => open("journal")}
                      >
                        <span className="quest-check">
                          {q.complete ? <Check size={10} /> : i + 1}
                        </span>
                        <span>{q.title}</span>
                        {!q.complete && activeQuest?.id === q.id && (
                          <span className="quest-active-dot" />
                        )}
                      </button>
                    ))}
                </div>
                <div className="quest-reward">
                  <span>QUEST REWARD</span>
                  <strong>
                    {activeQuest?.currency === "bad" ? (
                      <Moon size={12} />
                    ) : (
                      <Sun size={12} />
                    )}{" "}
                    {activeQuest?.reward || 25} <small>karma</small>
                  </strong>
                </div>
                <button
                  className="outline-button full"
                  onClick={() => open("journal")}
                >
                  Open journal <ArrowRight size={14} />
                </button>
              </div>
              <div className="sidebar-divider" />
              <div className="rank-panel">
                <div className="rank-symbol">
                  <Feather size={22} />
                </div>
                <div>
                  <span className="eyebrow">CELESTIAL RANK {player.rank}</span>
                  <h3>
                    {typeof rankName === "string"
                      ? rankName
                      : "Celestial Initiate"}
                  </h3>
                </div>
                <div className="rank-track">
                  <i
                    style={{
                      width: `${Math.min(100, (life / nextRank) * 100)}%`,
                    }}
                  />
                </div>
                <div className="rank-description">
                  <span>
                    {life.toLocaleString()} / {nextRank.toLocaleString()} karma
                  </span>
                  <span>RANK {Math.min(10, player.rank + 1)}</span>
                </div>
              </div>
              <div className="world-tip">
                <Sparkles size={15} />
                <p>
                  Power is possibility.
                  <br />
                  <span>What you make of it is up to you.</span>
                </p>
              </div>
              <button className="recall-button" onClick={() => call("recall")}>
                <Home size={14} /> Recall to sanctuary{" "}
                <ArrowUpRight size={12} />
              </button>
            </aside>
          </div>
          <footer className="page-footer">
            <span>EXPLORE. CREATE. BECOME.</span>
            <span>
              <span className="tiny-diamond" /> ETERNAL POWERS <small>·</small>{" "}
              THE 2D CHRONICLES
            </span>
            <button onClick={() => open("settings")}>
              Private world <Shield size={11} />
            </button>
          </footer>
        </main>
      </div>
      {panel && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setPanel(null);
          }}
        >
          <section
            className={`modal modal-${panel}`}
            role="dialog"
            aria-modal="true"
            aria-label={panel}
          >
            <header className="modal-header">
              <div>
                <div className="eyebrow">
                  ETERNAL POWERS <span> / </span> YOUR JOURNEY
                </div>
                <h2>
                  {
                    {
                      powers: "Abilities",
                      inventory: "Inventory & equipment",
                      map: "World atlas",
                      journal: "Quest journal",
                      codex: "Discovery codex",
                      settings: "Settings",
                      character: "Your character",
                      help: "Field guide",
                      shop: "Sanctuary exchange",
                      craft: "Crafting",
                      sanctuary: "Sanctuary",
                      world: "World & rituals",
                      companion: "Your familiar",
                      adventure: "Your faction campaign",
                      interact: "World interaction",
                      contracts: "Regional contracts",
                      social: "Standing & recovery",
                      multiplayer: "Realms & servers",
                      credits: "Credits",
                      dialogue: "Conversation",
                      inspect: "Interaction",
                    }[panel]
                  }
                </h2>
              </div>
              <button
                className="close-button"
                onClick={() => setPanel(null)}
                aria-label="Close dialog"
              >
                <X size={20} />
              </button>
            </header>
            {panel === "powers" && (
              <>
                <div className="power-tabs realm-tabs">
                  {["branches", "enhancements", "techniques"].map((t) => (
                    <button
                      key={t}
                      className={powerTab === t ? "active" : ""}
                      onClick={() => setPowerTab(t)}
                    >
                      {t === "branches"
                        ? "Power branches"
                        : t === "enhancements"
                          ? "Enhancements"
                          : "Cross-affinity"}
                    </button>
                  ))}
                </div>
                {powerTab !== "branches" ? (
                  <AdvancedPowers
                    tab={powerTab}
                    player={player}
                    state={state}
                    call={call}
                    close={() => setPanel(null)}
                    onTrials={() => {
                      setSocialTab("certification");
                      setPanel("social");
                    }}
                  />
                ) : (
                  <div className="powers-layout">
                    <div className="branch-list">
                      <div className="section-caption">
                        SIXTEEN PATHS. YOUR CHOICE.
                      </div>
                      {BRANCHES.map((b) => (
                        <button
                          key={b.id}
                          onClick={() => setBranchId(b.id)}
                          className={branchId === b.id ? "active" : ""}
                          style={{ "--power-color": b.color }}
                        >
                          <DomainIcon domain={b.domain} size={18} />
                          <span>
                            {b.domain}
                            <small>{b.aspect}</small>
                          </span>
                          <em>{learnedLevel(b.id)}/10</em>
                          <ChevronRight size={13} />
                        </button>
                      ))}
                    </div>
                    <div className="branch-detail">
                      <div
                        className="branch-title"
                        style={{ "--power-color": branch.color }}
                      >
                        <div className="branch-emblem">
                          <DomainIcon domain={branch.domain} size={32} />
                        </div>
                        <div>
                          <span className="eyebrow">
                            {branch.currency === "good" ? "GOOD" : "BAD"} KARMA
                            AFFINITY
                          </span>
                          <h3>{branch.name}</h3>
                        </div>
                        <button
                          className="outline-button"
                          onClick={() => call("trainPower", branch.id)}
                        >
                          <Plus size={13} /> Train next level
                        </button>
                      </div>
                      <p className="branch-description">
                        {branch.description || branch.boundary}
                      </p>
                      <RespecializationPanel
                        branch={branch}
                        player={player}
                        state={state}
                        call={call}
                      />
                      <div className="power-level-list">
                        {branch.powers?.map((p) => (
                          <div
                            className={`power-level ${learnedLevel(branch.id) >= p.level ? "learned" : ""}`}
                            key={p.id || p.level}
                          >
                            <img
                              className="power-level-icon"
                              src={assetUrl(`/assets/power-icons/${p.id}.png`)}
                              alt=""
                            />
                            <span className="level-badge">
                              {p.level < 10 ? "0" : ""}
                              {p.level}
                            </span>
                            <div>
                              <h4>
                                {p.name}{" "}
                                {p.kind === "ritual" && <em>RITUAL</em>}
                              </h4>
                              <p>{p.effect || p.interpretation}</p>
                              <div className="power-facts">
                                <span>
                                  <Sparkles size={10} /> {p.essenceCost} Essence
                                </span>
                                <span>{p.cooldown}s cooldown</span>
                                <span>{p.range}m range</span>
                              </div>
                            </div>
                            {learnedLevel(branch.id) >= p.level ? (
                              <button
                                className="equip-button"
                                onClick={() => {
                                  if (p.kind === "ritual") {
                                    call("setPower", branch.id, p.level);
                                    setWorldTab("rituals");
                                    setPanel("world");
                                  } else equip(branch.id, p.level);
                                }}
                              >
                                {p.kind === "ritual" ? "Plan ritual" : "Equip"}{" "}
                                <ArrowRight size={13} />
                              </button>
                            ) : (
                              <div className="locked-level">
                                <Lock size={12} />
                                <small>RANK {p.requiredRank || p.level}</small>
                                <span>
                                  {p.trainingCost?.toLocaleString()} karma
                                </span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
            {panel === "companion" && (
              <div className="keeper-content">
                <Heart size={34} />
                <h3>{player.companion?.name || "A familiar awaits"}</h3>
                <p>
                  One bonded companion follows your journey and supports you
                  every ten seconds in conflict. Meet neutral creatures and
                  complete their posted offering to form a bond.
                </p>
                <div className="keeper-actions">
                  <button
                    className="outline-button"
                    onClick={() => call("setCompanionSupport", "heal")}
                  >
                    <Heart size={13} /> Restore vitality
                  </button>
                  <button
                    className="outline-button"
                    onClick={() => call("setCompanionSupport", "barrier")}
                  >
                    <Shield size={13} /> Grant a barrier
                  </button>
                  <button
                    className="outline-button"
                    onClick={() => {
                      call("dismissCompanion");
                      setPanel(null);
                    }}
                  >
                    Release companion
                  </button>
                </div>
              </div>
            )}
            {panel === "adventure" && (
              <AdventurePanel
                initialTab={adventureTab}
                state={state}
                call={call}
                close={() => setPanel(null)}
              />
            )}
            {panel === "interact" && (
              <InteractionPanel
                key={state.target?.id || "none"}
                state={state}
                call={call}
                close={() => setPanel(null)}
                open={open}
              />
            )}
            {panel === "multiplayer" && (
              <MultiplayerPanel client={network.current} state={networkState} />
            )}
            {panel === "contracts" && (
              <ContractsPanel
                state={state}
                call={call}
                close={() => setPanel(null)}
              />
            )}
            {panel === "social" && (
              <SocialPanel
                initialTab={socialTab}
                state={state}
                call={call}
                close={() => setPanel(null)}
                open={open}
              />
            )}
            {panel === "credits" && (
              <div className="credits-content">
                <h3>A world made to be explored.</h3>
                <p>
                  Original pixel art, generated environment illustrations,
                  synthesized music and sound design, and the supplied Eternal
                  Powers manual form this 2D adaptation.
                </p>
                <article>
                  <h4>Pixel-boy / Sparklin Labs</h4>
                  <p>
                    Superpowers Medieval Fantasy Asset Pack · Creative Commons
                    Zero 1.0. Imported scenery, items, wildlife, effects, music,
                    and recordings are included with their original license and
                    source manifest.
                  </p>
                  <a
                    href="https://github.com/sparklinlabs/superpowers-asset-packs"
                    target="_blank"
                    rel="noreferrer"
                  >
                    View asset source ↗
                  </a>
                </article>
                <article>
                  <h4>Original art & sound</h4>
                  <p>
                    Power, enhancement, technique, equipment, creature,
                    architecture, and spell assets are generated by the included
                    scripts. The original regional soundscape and
                    family-specific spell cues are shipped locally.
                  </p>
                </article>
                <article>
                  <h4>Interface</h4>
                  <p>
                    Inter and Cormorant Garamond · Fontsource. Lucide icons ·
                    ISC. React and Vite · their original package licenses.
                  </p>
                </article>
                <p className="credits-note">
                  Source details and SHA-256 file records are included in the
                  repository’s asset provenance documentation.
                </p>
              </div>
            )}
            {panel === "sanctuary" && (
              <SanctuaryPanel
                state={state}
                call={call}
                close={() => setPanel(null)}
                open={open}
              />
            )}
            {panel === "world" && (
              <WorldPanel
                state={state}
                call={call}
                close={() => setPanel(null)}
                initialTab={worldTab}
              />
            )}
            {pendingEquip && panel === "powers" && (
              <div className="assign-loadout">
                <div>
                  <h3>Choose a quick-access slot</h3>
                  <button
                    className="close-button"
                    aria-label="Cancel assignment"
                    onClick={() => setPendingEquip(null)}
                  >
                    <X size={15} />
                  </button>
                </div>
                <p>
                  {
                    BRANCHES.find(
                      (b) => b.id === pendingEquip.branchId,
                    )?.powers.find((p) => p.level === pendingEquip.level)?.name
                  }{" "}
                  · Level {pendingEquip.level}
                </p>
                <div className="loadout-slot-options">
                  {slots.map((slot, i) => (
                    <button key={i} onClick={() => assignSlot(i)}>
                      <Key>{i + 1}</Key>
                      <img
                        src={assetUrl(
                          `/assets/power-icons/${slot.branchId}-${slot.level}.png`,
                        )}
                        alt=""
                      />
                      <span>
                        {
                          BRANCHES.find(
                            (b) => b.id === slot.branchId,
                          )?.powers.find((p) => p.level === slot.level)?.name
                        }
                      </span>
                      <small>LV {slot.level}</small>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {panel === "inventory" && (
              <div className="inventory-layout">
                <div className="inventory-character">
                  <div className="character-art">
                    <CharacterPortrait
                      appearance={player.appearance}
                      lineage={player.lineage}
                      className="v2-inventory-portrait"
                      title={`${player.name}, ${player.lineage}`}
                    />
                    <div className="character-art-ring" />
                  </div>
                  <h3>{player.name}</h3>
                  <span className="eyebrow">
                    {player.lineage} · RANK {player.rank}
                  </span>
                  <div className="equipment-slots">
                    {["focus", "ward", "utility"].map((s) => (
                      <div key={s}>
                        <Shield size={16} />
                        <span>
                          {s}
                          <small>{player.equipment?.[s] || "Unequipped"}</small>
                        </span>
                      </div>
                    ))}
                  </div>
                  <button
                    className="outline-button full"
                    onClick={() => setPanel("character")}
                  >
                    Change appearance
                  </button>
                </div>
                <div className="inventory-items">
                  <div className="section-caption">
                    PACK & MATERIALS{" "}
                    <span>
                      {Object.values(player.inventory || {}).reduce(
                        (a, b) => a + (Number(b) || 0),
                        0,
                      )}{" "}
                      ITEMS
                    </span>
                  </div>
                  <div className="item-grid">
                    {Object.entries(player.inventory || {}).map(
                      ([id, count]) => (
                        <button
                          key={id}
                          className="inventory-item"
                          onClick={() =>
                            id === "draught"
                              ? call("usePotion")
                              : id === "essenceDraught"
                                ? call("useEssencePotion")
                                : [
                                      "cleansingCharm",
                                      "protectiveCharm",
                                    ].includes(id)
                                  ? call("useItem", id)
                                  : ["focus", "ward", "utility"].includes(id)
                                    ? call("equipItem", id)
                                    : notify(
                                        `${id[0].toUpperCase() + id.slice(1)} — a material for sanctuary crafting.`,
                                      )
                          }
                        >
                          <div className="item-image">
                            <img
                              src={itemArtwork(id, player.rank)}
                              onError={(e) =>
                                (e.currentTarget.style.display = "none")
                              }
                              alt=""
                            />
                            {id === "draught" ? (
                              <Heart size={27} />
                            ) : id === "herb" ? (
                              <Leaf size={27} />
                            ) : id === "crystal" ? (
                              <Gem size={27} />
                            ) : id === "wood" ? (
                              <Hammer size={27} />
                            ) : (
                              <Mountain size={27} />
                            )}
                          </div>
                          <h4>{items[id]?.name || id}</h4>
                          <span>
                            {items[id]?.description || "Crafting material"}
                          </span>
                          <strong>× {count}</strong>
                        </button>
                      ),
                    )}
                  </div>
                  {Object.keys(state.contracts?.pouch || {}).length > 0 && (
                    <div className="bound-cargo">
                      <span className="section-caption">
                        BOUND CONTRACT CARGO
                      </span>
                      {Object.entries(state.contracts.pouch).map(([id, c]) => (
                        <div key={id}>
                          <ScrollText size={18} />
                          <span>
                            {c.name || id}
                            <small>
                              {c.quantity || 1} items · bound to its posted
                              contract
                            </small>
                          </span>
                          <Lock size={12} />
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="inventory-actions">
                    <button
                      className="outline-button"
                      onClick={() => setPanel("craft")}
                    >
                      <Hammer size={14} /> Craft items
                    </button>
                    <button
                      className="outline-button"
                      onClick={() => setPanel("sanctuary")}
                    >
                      <Home size={14} /> Storage & workshop
                    </button>
                    <button
                      className="outline-button"
                      onClick={() => setPanel("shop")}
                    >
                      <ShoppingBag size={14} /> Sanctuary exchange
                    </button>
                  </div>
                </div>
              </div>
            )}
            {panel === "map" && (
              <div className="world-map-content">
                <div className="map-intro">
                  <button
                    className="map-world-button outline-button"
                    onClick={() => {
                      setWorldTab("overview");
                      setPanel("world");
                    }}
                  >
                    <Sun size={13} /> World state & rituals{" "}
                    <ArrowRight size={12} />
                  </button>
                  <p>Beyond every horizon, another possibility.</p>
                  <span>
                    Travel is available outside conflict. Every destination is a
                    new discovery.
                  </span>
                </div>
                <div className="v2-map-tabs">
                  <button
                    className={mapView === "region" ? "active" : ""}
                    onClick={() => setMapView("region")}
                  >
                    Region atlas
                  </button>
                  <button
                    className={mapView === "realm" ? "active" : ""}
                    onClick={() => setMapView("realm")}
                  >
                    Realm travel
                  </button>
                </div>
                {mapView === "region" ? (
                  <RegionAtlas
                    engine={game.current}
                    state={state}
                    call={call}
                    close={() => setPanel(null)}
                  />
                ) : (
                  <>
                    <div className="realm-tabs">
                      {["Earth", "Heaven", "Hell"].map((r) => (
                        <button
                          key={r}
                          className={
                            codexTab === r ||
                            (!["Heaven", "Hell"].includes(codexTab) &&
                              r === "Earth")
                              ? "active"
                              : ""
                          }
                          onClick={() => setCodexTab(r)}
                        >
                          {r === "Earth" ? (
                            <Leaf size={14} />
                          ) : r === "Heaven" ? (
                            <Sun size={14} />
                          ) : (
                            <Flame size={14} />
                          )}{" "}
                          {r} realm
                        </button>
                      ))}
                    </div>
                    <div className="zone-grid">
                      {ZONES.filter(
                        (z) =>
                          (z.realm || "Earth").toLowerCase() ===
                          (["Heaven", "Hell"].includes(codexTab)
                            ? codexTab
                            : "Earth"
                          ).toLowerCase(),
                      ).map((z, i) => (
                        <button
                          key={z.id}
                          className={`zone-card ${state.zone?.id === z.id ? "current" : ""}`}
                          onClick={() => {
                            if (state.inCombat) {
                              notify("Leave conflict before travelling.");
                              return;
                            }
                            call("setZone", z.id);
                            setPanel(null);
                          }}
                        >
                          <div
                            className={`zone-landscape biome-${z.biome || i % 5}`}
                            style={{ "--hue": `${i * 32}deg` }}
                          >
                            <div
                              className="zone-atlas-art"
                              style={zoneArt(z)}
                              role="img"
                              aria-label={`${z.name} environment illustration`}
                            />
                            <span>
                              {state.zone?.id === z.id
                                ? "YOU ARE HERE"
                                : (state.discoveredZones || []).includes(z.id)
                                  ? "DISCOVERED"
                                  : "UNDISCOVERED"}
                            </span>
                          </div>
                          <div className="zone-card-body">
                            <h3>
                              {z.name}
                              <ArrowUpRight size={14} />
                            </h3>
                            <p>
                              {z.description ||
                                z.subtitle ||
                                "A new horizon awaits your arrival."}
                            </p>
                            <small>
                              {z.realm} REALM <span>EXPLORE →</span>
                            </small>
                          </div>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
            {panel === "journal" && (
              <div className="journal-content">
                <div className="journal-banner">
                  <img src={sceneArt} alt="A celestial sanctuary" />
                  <div>
                    <span className="eyebrow">CHAPTER I · EARTH</span>
                    <h3>The first steps toward eternity</h3>
                    <p>
                      Every choice leaves something behind. Make yours count.
                    </p>
                  </div>
                  <span className="journal-completion">
                    {completed}
                    <small>
                      / {state.quests?.length || 0}
                      <br />
                      COMPLETE
                    </small>
                  </span>
                </div>
                <div className="journal-quests">
                  {(state.quests || []).map((q, i) => (
                    <div
                      className={`journal-quest ${q.complete ? "complete" : ""}`}
                      key={q.id}
                    >
                      <div className="journal-number">
                        {q.complete ? (
                          <Check size={18} />
                        ) : (
                          String(i + 1).padStart(2, "0")
                        )}
                      </div>
                      <div>
                        <h3>{q.title}</h3>
                        <p>{q.description}</p>
                        {!q.complete && (
                          <button
                            className="track-quest"
                            onClick={() => {
                              call("pinQuest", q.id);
                              setPanel(null);
                            }}
                          >
                            {state.objective?.id === q.id
                              ? "Tracking objective"
                              : "Track this objective"}{" "}
                            <Crosshair size={10} />
                          </button>
                        )}
                        <div className="quest-progress">
                          <i
                            style={{
                              width: `${Math.min(100, (q.progress / q.total) * 100)}%`,
                            }}
                          />
                        </div>
                        <small>
                          {q.complete
                            ? "COMPLETED"
                            : `${q.progress || 0} / ${q.total} · IN PROGRESS`}
                        </small>
                      </div>
                      <span
                        className={`journal-reward ${q.rewardEligible === false ? "ineligible" : ""}`}
                      >
                        {q.currency === "bad" ? (
                          <Moon size={14} />
                        ) : (
                          <Sun size={14} />
                        )}{" "}
                        {q.reward}
                        <small>{q.currency || "good"} karma</small>
                        {q.rewardEligible === false && (
                          <em>Certification required</em>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="journey-ledger">
                  <div className="section-caption">
                    THE WORLD REMEMBERS <span>RECENT ACTIONS</span>
                  </div>
                  {(state.log || []).slice(0, 10).map((e, i) => (
                    <div key={i}>
                      <span className="tiny-diamond" />
                      <p>{e.text}</p>
                      <small>
                        {Math.floor(e.time / 60)}:
                        {String(Math.floor(e.time % 60)).padStart(2, "0")}
                      </small>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {panel === "codex" && (
              <div className="codex-content">
                <div className="codex-toolbar">
                  <div className="realm-tabs">
                    {["creatures", "enhancements", "techniques", "rules"].map(
                      (t) => (
                        <button
                          key={t}
                          onClick={() => setCodexTab(t)}
                          className={codexTab === t ? "active" : ""}
                        >
                          {t}
                        </button>
                      ),
                    )}
                  </div>
                  <label className="search">
                    <Search size={14} />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search the codex…"
                    />
                  </label>
                </div>
                <div className="codex-grid">
                  {(codexTab === "enhancements"
                    ? ENHANCEMENTS
                    : codexTab === "techniques"
                      ? TECHNIQUES
                      : codexTab === "rules"
                        ? []
                        : CREATURES
                  )
                    .filter((x) =>
                      JSON.stringify(x)
                        .toLowerCase()
                        .includes(search.toLowerCase()),
                    )
                    .map((x, i) => (
                      <div className="codex-card" key={x.id || i}>
                        <span className="codex-number">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        {codexTab === "creatures" && (
                          <img
                            className="bestiary-sprite"
                            src={assetUrl(`/assets/creature-${x.id}.png`)}
                            alt=""
                            onError={(e) =>
                              (e.currentTarget.style.display = "none")
                            }
                          />
                        )}
                        {codexTab === "creatures" ? (
                          <Skull size={23} />
                        ) : (
                          <Sparkles size={23} />
                        )}
                        <h3>{x.name || x.title || x.track}</h3>
                        <p>
                          {x.description ||
                            x.effect ||
                            x.profile ||
                            x.tactics ||
                            x.boundary ||
                            `${BRANCHES.find((b) => b.id === x.branchId)?.name || x.domain || ""} enhancement path`}
                        </p>
                        <small>
                          {x.rank
                            ? `ENCOUNTER RANK ${x.rank}`
                            : x.lineage || x.branch || "REFERENCE"}
                        </small>
                        {x.ranks && (
                          <div className="codex-sublist">
                            {x.ranks.map((r, j) => (
                              <p key={j}>
                                {r.rank || j + 1}. {r.name}{" "}
                                <span>{r.effect || r.description}</span>
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                </div>
                {codexTab === "rules" && (
                  <div className="rules-content">
                    <h3>The foundations of play</h3>
                    <p>
                      Inspect your target. Choose a learned power. Preview its
                      cost, range, and effect. Commit once. The world remembers
                      the result.
                    </p>
                    <div className="rules-grid">
                      {[
                        [
                          "Vitality & recovery",
                          "Begin with 100 vitality. Outside conflict, recover 10 vitality each second after five seconds of rest. Defeat recalls you to the sanctuary with your belongings.",
                        ],
                        [
                          "Essence & casting",
                          "Begin with 100 Essence. Level L tactical casts cost 5 + 5L Essence and cool down for 3 + 2L seconds. Essence recovers during rest.",
                        ],
                        [
                          "Karma & training",
                          "Good and Bad Karma are separate wallets. Training costs 100 × level². Spending never reduces your lifetime earned progression.",
                        ],
                        [
                          "Celestial progression",
                          "Rank R needs 500 × (R − 1)² lifetime karma and a rank trial. Unlock the opposing affinity with certification at rank 3.",
                        ],
                        [
                          "Defense & movement",
                          "Guard reduces direct damage by 40%. Dodge gives half a second of evasion with a three-second cooldown. Sprint costs no stamina.",
                        ],
                        [
                          "A provisional world",
                          "This 2D adaptation follows manual ruleset 0.1. Local powers, selected enhancements, and opposing techniques support tactical play. Rituals reserve resources and settle world changes in recorded stages.",
                        ],
                      ].map(([t, d]) => (
                        <article key={t}>
                          <h4>{t}</h4>
                          <p>{d}</p>
                        </article>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            {(panel === "settings" || panel === "help") && (
              <div className="settings-content">
                {panel === "settings" ? (
                  <>
                    <div className="setting-row">
                      <div>
                        <h3>Music & ambient sound</h3>
                        <p>An original soundscape for your journey.</p>
                      </div>
                      <button
                        className={`toggle ${sound ? "on" : ""}`}
                        onClick={toggleSound}
                        aria-label="Toggle audio"
                      >
                        <i />
                      </button>
                    </div>
                    <div className="setting-row">
                      <div>
                        <h3>Score selection</h3>
                        <p>
                          Choose the original regional score or imported CC0
                          adventure themes.
                        </p>
                      </div>
                      <select
                        className="settings-select"
                        aria-label="Music score"
                        value={scoreMode}
                        onChange={(e) => {
                          setScoreMode(e.target.value);
                          audio.setScoreMode?.(e.target.value);
                        }}
                      >
                        <option value="original">
                          Original regional score
                        </option>
                        <option value="imported">
                          Pixel-boy adventure themes · CC0
                        </option>
                      </select>
                    </div>
                    <div className="setting-row">
                      <div>
                        <h3>Nature & environmental ambience</h3>
                        <p>
                          Layer wind, water, wildlife, and imported forest
                          recordings.
                        </p>
                      </div>
                      <button
                        className={`toggle ${natureAmbience ? "on" : ""}`}
                        aria-label="Toggle nature ambience"
                        onClick={() => {
                          setNatureAmbience(!natureAmbience);
                          audio.setNatureAmbience?.(!natureAmbience);
                        }}
                      >
                        <i />
                      </button>
                    </div>
                    <div className="setting-row">
                      <div>
                        <h3>Listening level</h3>
                        <p>Set the volume of music and effects.</p>
                      </div>
                      <input
                        className="settings-volume"
                        type="range"
                        min="0"
                        max="100"
                        value={volume}
                        aria-label="Audio volume"
                        onChange={(e) => {
                          setVolume(Number(e.target.value));
                          audio.setVolume(Number(e.target.value) / 100);
                        }}
                      />
                    </div>
                    <div className="setting-row">
                      <div>
                        <h3>Reduced motion</h3>
                        <p>Keep menus and interface transitions still.</p>
                      </div>
                      <button
                        className={`toggle ${reduced ? "on" : ""}`}
                        onClick={() => setReduced(!reduced)}
                        aria-label="Toggle reduced motion"
                      >
                        <i />
                      </button>
                    </div>
                    <div className="setting-row">
                      <div>
                        <h3>Your journey is yours</h3>
                        <p>Progress saves automatically in this browser.</p>
                      </div>
                      <button
                        className="outline-button"
                        onClick={() => {
                          call("save");
                          notify("Journey saved.");
                        }}
                      >
                        <Save size={13} /> Save now
                      </button>
                    </div>
                    <div className="setting-row">
                      <div>
                        <h3>A copy of your journey</h3>
                        <p>
                          Export a portable backup or restore a saved journey
                          file.
                        </p>
                      </div>
                      <div className="save-backup-buttons">
                        <button
                          className="outline-button"
                          onClick={exportJourney}
                        >
                          <Save size={12} /> Export save
                        </button>
                        <button
                          className="outline-button"
                          onClick={() => restoreInput.current?.click()}
                        >
                          <RotateCcw size={12} /> Restore
                        </button>
                        <input
                          type="file"
                          accept="application/json,.json"
                          ref={restoreInput}
                          hidden
                          onChange={(e) => restoreJourney(e.target.files?.[0])}
                        />
                      </div>
                    </div>
                    <div className="setting-row">
                      <div>
                        <h3>Take your world offline</h3>
                        <p>
                          Download the art, music, and solo game for play
                          without a connection. Shared rooms and player trades
                          need the game server.
                        </p>
                        {offlineProgress && (
                          <small className="offline-download-progress">
                            {offlineProgress.cached ??
                              offlineProgress.completed ??
                              offlineProgress.loaded ??
                              0}{" "}
                            / {offlineProgress.total || 0} assets
                          </small>
                        )}
                        {offlineStatus?.complete && (
                          <small className="offline-ready">
                            Offline library ready
                          </small>
                        )}
                      </div>
                      <div className="offline-actions">
                        <button
                          className="outline-button"
                          disabled={!offlineAvailable() || offlineBusy}
                          onClick={downloadOffline}
                        >
                          <Save size={12} />
                          {offlineBusy
                            ? "Downloading…"
                            : offlineStatus?.complete
                              ? "Refresh offline library"
                              : "Download for offline play"}
                        </button>
                        {installPrompt && (
                          <button
                            className="outline-button"
                            onClick={async () => {
                              await installPrompt.prompt();
                              await installPrompt.userChoice;
                              setInstallPrompt(null);
                            }}
                          >
                            Install game <ArrowUpRight size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="setting-row">
                      <div>
                        <h3>Start another journey</h3>
                        <p>
                          Begin again with a new lineage and affinity. Export
                          your current save first.
                        </p>
                      </div>
                      <button
                        className="outline-button"
                        onClick={() => setResetConfirm(true)}
                      >
                        New journey <Plus size={12} />
                      </button>
                    </div>
                    {resetConfirm && (
                      <div className="transaction-preview">
                        <h3>Begin a new journey?</h3>
                        <p>
                          This replaces the current world and character in this
                          browser. Export a backup to keep this journey.
                        </p>
                        <div>
                          <button
                            className="subtle-button"
                            onClick={() => setResetConfirm(false)}
                          >
                            Keep exploring
                          </button>
                          <button
                            className="primary-button"
                            onClick={() => {
                              call("reset");
                              setSlots(
                                START_SLOTS.map((branchId) => ({
                                  branchId,
                                  level: 1,
                                })),
                              );
                              setResetConfirm(false);
                              setPanel(null);
                            }}
                          >
                            Begin anew <ArrowRight size={12} />
                          </button>
                        </div>
                      </div>
                    )}
                    <div className="setting-row">
                      <div>
                        <h3>Art, music & credits</h3>
                        <p>
                          Original assets and licensed imports, with their
                          sources.
                        </p>
                      </div>
                      <button
                        className="outline-button"
                        onClick={() => setPanel("credits")}
                      >
                        View credits <ArrowRight size={12} />
                      </button>
                    </div>
                    <div className="setting-row">
                      <div>
                        <h3>Character & starting affinity</h3>
                        <p>Choose an angelic or demonic form.</p>
                      </div>
                      <button
                        className="outline-button"
                        onClick={() => setPanel("character")}
                      >
                        Your character <ArrowRight size={13} />
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="help-intro">
                      <Compass size={28} />
                      <h3>There is no single way to become eternal.</h3>
                      <p>
                        Explore the grove, meet its keeper, and practice your
                        first power. Follow your journal, gather materials, and
                        discover new places.
                      </p>
                    </div>
                    <div className="controls-grid">
                      {[
                        ["W A S D / ARROWS", "Move through the world"],
                        ["CLICK", "Select a target or move"],
                        ["SHIFT", "Sprint"],
                        ["SPACE", "Dodge incoming attacks"],
                        ["E", "Interact or harvest nearby"],
                        ["F", "Strike a nearby threat"],
                        ["1 – 8", "Select a power"],
                        ["Q", "Cast the selected power"],
                        ["R", "Drink a restorative draught"],
                        ["G", "Guard against direct attacks"],
                        ["I / M / J / P", "Inventory / map / journal / powers"],
                        ["ESC", "Close a panel"],
                      ].map(([k, d]) => (
                        <div key={k}>
                          <Key>{k}</Key>
                          <span>{d}</span>
                        </div>
                      ))}
                    </div>
                    <button
                      className="primary-button"
                      onClick={() => setPanel(null)}
                    >
                      The world awaits <ArrowRight size={15} />
                    </button>
                  </>
                )}
              </div>
            )}
            {panel === "character" && (
              <CharacterCreator
                mode="edit"
                player={player}
                busy={creatorBusy}
                error={creatorError}
                onCancel={() => {
                  setPanel(null);
                  setCreatorError("");
                }}
                onComplete={async (draft) => {
                  setCreatorBusy(true);
                  setCreatorError("");
                  try {
                    const result = await call("updateAppearance", draft);
                    if (result) setPanel(null);
                    else
                      setCreatorError(
                        "Return to a sanctuary outside conflict to update your character.",
                      );
                  } finally {
                    setCreatorBusy(false);
                  }
                }}
              />
            )}
            {(panel === "shop" || panel === "craft") && (
              <div className="shop-content">
                <p>
                  {panel === "shop"
                    ? "Posted prices. Clear exchanges. A little preparation goes a long way."
                    : "Gather from the world, then give your discoveries a new purpose."}
                </p>
                {state.shop?.pendingCraft && (
                  <div className="craft-job">
                    <Hammer size={18} />
                    <div>
                      <h3>{state.shop.pendingCraft.name}</h3>
                      {state.shop.pendingCraft.status === "paused" && (
                        <button
                          className="outline-button"
                          onClick={() => call("resumeCraft")}
                        >
                          Resume at station <Play size={12} />
                        </button>
                      )}
                      <p>
                        {Math.ceil(state.shop.pendingCraft.remaining || 0)}s
                        remaining · materials reserved once
                      </p>
                      <div className="craft-job-track">
                        <i
                          style={{
                            width: `${(1 - (state.shop.pendingCraft.remaining || 0) / (state.shop.pendingCraft.duration || 5)) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}
                {panel === "shop" && (
                  <div className="realm-tabs shop-sell-tabs">
                    <button
                      className={shopMode === "buy" ? "active" : ""}
                      onClick={() => {
                        setShopMode("buy");
                        setConfirmed(null);
                      }}
                    >
                      Buy supplies
                    </button>
                    <button
                      className={shopMode === "sell" ? "active" : ""}
                      onClick={() => {
                        setShopMode("sell");
                        setConfirmed(null);
                      }}
                    >
                      Sell belongings
                    </button>
                  </div>
                )}
                <div className="shop-items">
                  {(panel === "shop"
                    ? Object.values(items)
                        .filter(
                          (item) =>
                            shopMode !== "sell" ||
                            (player.inventory[item.id] || 0) > 0,
                        )
                        .map((item) => ({
                          ...item,
                          desc: item.description,
                          icon:
                            {
                              draught: Heart,
                              essenceDraught: Sparkles,
                              focus: WandSparkles,
                              ward: Shield,
                              utility: Feather,
                              herb: Leaf,
                              crystal: Gem,
                              wood: Hammer,
                              stone: Mountain,
                            }[item.id] || Gem,
                        }))
                    : recipes.map((r) => ({
                        ...r,
                        name: items[r.id]?.name || r.name,
                        desc:
                          Object.entries(r.ingredients)
                            .map(([id, n]) => `${n} ${items[id]?.name || id}`)
                            .join(" + ") + ` → ${r.count} ${r.name}`,
                        icon:
                          {
                            draught: Heart,
                            essenceDraught: Sparkles,
                            focus: WandSparkles,
                            ward: Shield,
                            utility: Feather,
                          }[r.id] || Hammer,
                      }))
                  ).map((item) => (
                    <div className="shop-item" key={item.id}>
                      <div className="shop-item-icon">
                        <item.icon size={26} />
                      </div>
                      <div>
                        <h3>{item.name}</h3>
                        <p>{item.desc}</p>
                        {panel === "craft" && (
                          <div className="recipe-requirements">
                            <span>
                              {item.station || "Alchemy"} station ·{" "}
                              {item.duration || 5}s craft
                            </span>
                            {item.requiredLevel && (
                              <span>
                                {item.branchId} level {item.requiredLevel}
                              </span>
                            )}
                            {item.requiresHeat && (
                              <span>
                                Apply the named heat or shaping power at this
                                station first.
                              </span>
                            )}
                            {item.requiresPlan && !item.planLearned && (
                              <button
                                onClick={() => call("learnRecipe", item.id)}
                              >
                                Learn recipe plan · 50 Karma{" "}
                                <BookOpen size={11} />
                              </button>
                            )}
                            {item.requiresPortalTrial && (
                              <span>Portal access trial required.</span>
                            )}
                          </div>
                        )}
                        {panel === "shop" &&
                          shopMode === "buy" &&
                          state.shop?.stock && (
                            <small className="shop-stock">
                              {state.shop.stock[item.id] ?? 0} IN STOCK ·
                              RESTOCKS AT DAWN
                            </small>
                          )}
                      </div>
                      <button
                        className="outline-button"
                        disabled={
                          panel === "craft" &&
                          item.requiresPlan &&
                          !item.planLearned
                        }
                        onClick={async () => {
                          if (panel === "shop") {
                            const quote = await call(
                              "previewTrade",
                              item.id,
                              1,
                              shopMode,
                            );
                            setConfirmed({ ...item, quote });
                          } else setConfirmed(item);
                        }}
                      >
                        {panel === "shop" ? (
                          <>
                            {player.lineage === "demon" ? (
                              <Moon size={12} />
                            ) : (
                              <Sun size={12} />
                            )}{" "}
                            {shopMode === "sell"
                              ? Math.floor(
                                  (item.price *
                                    0.4 *
                                    (state.sanctuary?.itemDurability?.[
                                      item.id
                                    ] ?? 100)) /
                                    100,
                                )
                              : item.price}{" "}
                            · {shopMode === "sell" ? "Sell" : "Buy"}
                          </>
                        ) : (
                          <>
                            {item.requiresPlan && !item.planLearned
                              ? "Plan required"
                              : "Craft"}{" "}
                            <Hammer size={12} />
                          </>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
                {panel === "shop" && state.shop?.receipts?.length > 0 && (
                  <details className="trade-receipts">
                    <summary>
                      Recent receipts · {state.shop.receipts.length}
                    </summary>
                    {state.shop.receipts.slice(0, 12).map((r) => (
                      <div key={r.id}>
                        <span>
                          {r.type || r.mode || "Exchange"} ·{" "}
                          {items[r.itemId]?.name || r.itemId || r.name}
                        </span>
                        <strong>{r.total || 0} karma</strong>
                        <small>DAY {r.worldDay || 1}</small>
                      </div>
                    ))}
                  </details>
                )}
                {confirmed && (
                  <div className="transaction-preview">
                    <h3>
                      {panel === "shop" ? "Confirm exchange" : "Confirm recipe"}
                    </h3>
                    <p>
                      {confirmed.name} ·{" "}
                      {panel === "shop"
                        ? `${confirmed.quote?.total ?? confirmed.price} ${player.lineage === "demon" ? "Bad" : "Good"} Karma${confirmed.quote?.valid === false ? " · " + confirmed.quote.reason : ""}`
                        : confirmed.desc}
                    </p>
                    <div>
                      <button
                        className="subtle-button"
                        onClick={() => {
                          if (confirmed.quote?.id)
                            call("cancelTrade", confirmed.quote.id);
                          setConfirmed(null);
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        className="primary-button"
                        disabled={confirmed.quote?.valid === false}
                        onClick={() => {
                          if (panel === "shop" && confirmed.quote?.id)
                            call("commitTrade", confirmed.quote.id);
                          else
                            call(
                              panel === "shop" ? "buyItem" : "craftItem",
                              confirmed.id,
                            );
                          setConfirmed(null);
                        }}
                      >
                        Confirm <Check size={13} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
            {panel === "inspect" && (
              <div className="inspect-content">
                <div className="inspect-target">
                  <Crosshair size={27} />
                  <span className="eyebrow">
                    {state.target?.kind || "THE WORLD"}
                  </span>
                  <h3>{state.target?.name || "Choose a target"}</h3>
                  <p>
                    {state.target?.description ||
                      "Click a creature, character, resource, or object to inspect its state and interactions."}
                  </p>
                  {state.target?.maxHealth && (
                    <div className="inspect-health">
                      <Heart size={13} />
                      {Math.ceil(state.target.health)} /{" "}
                      {state.target.maxHealth} vitality
                    </div>
                  )}
                </div>
                {creatureProfile && (
                  <CreatureInteraction
                    state={state}
                    profile={creatureProfile}
                    call={call}
                    close={() => setPanel(null)}
                    items={items}
                  />
                )}
                <div className="cast-preview">
                  <span className="section-caption">SELECTED POWER</span>
                  <h3>{selected.name}</h3>
                  <p>{selected.interpretation || selected.effect}</p>
                  <div className="preview-facts">
                    <span>
                      <Sparkles size={14} /> {selected.essenceCost} Essence
                    </span>
                    <span>{selected.castTime}s cast time</span>
                    <span>{selected.cooldown}s cooldown</span>
                    <span>{selected.range}m range</span>
                  </div>
                  <details
                    className="extra-cast-targeting"
                    open={
                      !!state.castPreview?.reason?.match(
                        /secondary|donor|route|ally/i,
                      )
                    }
                  >
                    <summary>Additional targeting & travel</summary>
                    <label>
                      Secondary target
                      <select
                        aria-label="Secondary spell target"
                        value={state.castPreview?.secondaryTargetId || ""}
                        onChange={(e) =>
                          call("selectSecondaryTarget", e.target.value || null)
                        }
                      >
                        <option value="">No secondary target</option>
                        {(game.current?.entities || [])
                          .filter(
                            (n) =>
                              !n.dead &&
                              !n.collected &&
                              n.id !== state.target?.id &&
                              ["npc", "enemy", "ally"].includes(n.kind) &&
                              Math.hypot(n.x - player.x, n.y - player.y) < 1000,
                          )
                          .map((n) => (
                            <option value={n.id} key={n.id}>
                              {n.name}
                            </option>
                          ))}
                      </select>
                    </label>
                    {selected.branchId === "air-move" &&
                      selected.level >= 5 && (
                        <label>
                          Discovered arrival route
                          <select
                            aria-label="Travel power destination"
                            defaultValue=""
                            onChange={(e) =>
                              call("chooseTravelRoute", e.target.value)
                            }
                          >
                            <option value="" disabled>
                              Choose a discovered sanctuary
                            </option>
                            {(state.discoveredZones || [])
                              .filter((id) => id !== state.zone.id)
                              .map((id) => (
                                <option key={id} value={id}>
                                  {ZONES.find((z) => z.id === id)?.name || id}
                                </option>
                              ))}
                          </select>
                        </label>
                      )}
                    {(state.powerObjects || []).length > 0 && (
                      <button
                        className="outline-button"
                        onClick={() => call("dismissPowerObjects")}
                      >
                        Dismiss owned temporary constructions <X size={11} />
                      </button>
                    )}
                  </details>
                  <div
                    className={`cast-eligibility ${state.castPreview?.valid ? "valid" : "invalid"}`}
                  >
                    {state.castPreview?.valid ? (
                      <>
                        <Check size={12} />
                        Target and scope are eligible.
                      </>
                    ) : (
                      <>
                        <Lock size={12} />
                        {state.castPreview?.reason ||
                          "Choose an eligible target before commitment."}
                      </>
                    )}
                  </div>
                  <p className="preview-note">
                    Inspecting and cancelling are free. Invalid targets reject
                    your cast without spending Essence.
                  </p>
                  <div className="inspect-actions">
                    <button
                      className="outline-button"
                      onClick={() => setPanel(null)}
                    >
                      Cancel
                    </button>
                    <button
                      className="primary-button"
                      onClick={() => {
                        call("setPaused", false);
                        setPanel(null);
                        call("cast");
                      }}
                    >
                      Commit cast <Key>Q</Key>
                    </button>
                  </div>
                </div>
              </div>
            )}
            {panel === "dialogue" && (
              <div className="keeper-content">
                <div className="keeper-portrait">
                  <img
                    src={
                      state.target?.creatureId
                        ? assetUrl(
                            `/assets/creature-${state.target.creatureId}.png`,
                          )
                        : assetUrl("/assets/angel.png")
                    }
                    alt={state.target?.name || "The celestial keeper"}
                  />
                </div>
                <span className="eyebrow">
                  {state.target?.role === "encounter-contact"
                    ? state.target.name
                    : "ETHEREAL VIRTUE KEEPER"}
                </span>
                <h3>
                  {state.target?.role === "encounter-contact"
                    ? "An encounter by choice."
                    : "Welcome, Wayfarer."}
                </h3>
                <p>{dialogue}</p>
                <div className="keeper-actions">
                  <button
                    className="outline-button"
                    onClick={() => setPanel("journal")}
                  >
                    <ScrollText size={14} /> My journal
                  </button>
                  <button
                    className="outline-button"
                    onClick={() => {
                      setPowerTab("branches");
                      setPanel("powers");
                    }}
                  >
                    <Sparkles size={14} /> Train my powers
                  </button>
                  <button
                    className="primary-button"
                    onClick={() => setPanel(null)}
                  >
                    Continue exploring <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      )}
      {engineReady && !player.characterCreated && (
        <CharacterCreator
          mode="create"
          player={player}
          busy={creatorBusy}
          error={creatorError}
          onComplete={async (draft) => {
            setCreatorBusy(true);
            setCreatorError("");
            try {
              const result = await call("createCharacter", draft);
              if (!result) {
                setCreatorError(
                  "Choose a valid name, lineage, and native starting path.",
                );
                return;
              }
              const native = BRANCHES.filter(
                (b) =>
                  b.currency === (draft.lineage === "demon" ? "bad" : "good"),
              );
              setSlots(
                [
                  { branchId: draft.starterBranch, level: 1 },
                  ...native
                    .filter((b) => b.id !== draft.starterBranch)
                    .map((b) => ({ branchId: b.id, level: 1 })),
                ].slice(0, 8),
              );
              setBranchId(draft.starterBranch);
              setPanel(null);
              setPaused(false);
              setWelcome(false);
              audio.unlock();
            } finally {
              setCreatorBusy(false);
            }
          }}
        />
      )}
      {panel && notices.length > 0 && (
        <div className="global-notices">
          {notices.map((n) => (
            <div key={n.id} className={`game-toast ${n.type}`}>
              <Sparkles size={15} />
              {n.text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
export default App;
