import { assetUrl } from "../assetUrl.js";
import React, { useEffect, useState } from "react";
import {
  Sun,
  Moon,
  CloudRain,
  Wind,
  Flame,
  Sparkles,
  Leaf,
  Shield,
  Heart,
  Compass,
  ArrowRight,
  Check,
  X,
  Lock,
  Play,
  Pause,
  RotateCcw,
  MapPin,
  CircleHelp,
  Gem,
} from "lucide-react";
import { BRANCHES, ZONES } from "../data/manual.js";

const METERS = [
  { id: "vitality", label: "Habitat vitality", icon: Leaf },
  { id: "morale", label: "Public morale", icon: Heart },
  { id: "stability", label: "Regional stability", icon: Shield },
  { id: "corruption", label: "Corruption", icon: Flame },
];
const formatTime = (n) => {
  if (n && typeof n === "object")
    return (
      n.label ||
      `${String(n.hour || 0).padStart(2, "0")}:${String(n.minute || 0).padStart(2, "0")}`
    );
  if (!Number.isFinite(Number(n))) return String(n || "08:00");
  const minutes = Math.floor(((Number(n) % 3600) / 3600) * 1440);
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
};
function Readout({ meter, value }) {
  return (
    <div className={`region-meter ${meter.id}`}>
      <div>
        <meter.icon size={13} />
        <span>{meter.label}</span>
        <strong>
          {Math.round(value ?? 50)}
          <small> / 100</small>
        </strong>
      </div>
      <div className="region-meter-track">
        <i style={{ width: `${Math.max(0, Math.min(100, value ?? 50))}%` }} />
      </div>
    </div>
  );
}

export default function WorldPanel({
  state,
  call,
  close,
  initialTab = "overview",
}) {
  const [tab, setTab] = useState(initialTab),
    [regionId, setRegionId] = useState(state.zone.id),
    [powerId, setPowerId] = useState(
      state.selectedPower?.kind === "ritual"
        ? state.selectedPower.id
        : "water-grow-5",
    ),
    [preview, setPreview] = useState(null),
    [eventInspection, setEventInspection] = useState(null),
    [reversal, setReversal] = useState(null);
  const model = state.worldModel || {},
    regions = Array.isArray(model.regions)
      ? model.regions
      : Object.values(model.regions || {}),
    region =
      regions.find((r) => (r.id || r.zoneId) === regionId) ||
      regions.find((r) => (r.id || r.zoneId) === state.zone.id) ||
      {},
    events = Array.isArray(model.events)
      ? model.events
      : Object.values(model.events || {}),
    conditions = Array.isArray(model.conditions)
      ? model.conditions
      : Object.values(model.conditions || {}),
    ritual = model.activeRitual;
  const rituals = BRANCHES.flatMap((b) =>
    b.powers
      .filter((p) => p.kind === "ritual")
      .map((p) => ({ ...p, branch: b })),
  );
  const power = rituals.find((p) => p.id === powerId) || rituals[0];
  useEffect(() => {
    if (initialTab) setTab(initialTab);
  }, [initialTab]);
  function inspectRitual() {
    setPreview(
      call("previewRitual", power.branch.id, power.level) || {
        valid: false,
        reason: "Choose a learned ritual and approach the sanctuary anchor.",
      },
    );
  }
  const currentWeather =
    typeof model.weather === "object"
      ? model.weather.label ||
        model.weather.name ||
        model.weather.id ||
        model.weather.type
      : model.weather;
  return (
    <div className="world-systems-content">
      <div className="world-model-banner">
        <div>
          <span className="eyebrow">THE WORLD BEYOND YOUR FOOTSTEPS</span>
          <h3>Every action has a horizon.</h3>
          <p>Observe the world, answer its needs, and shape what comes next.</p>
        </div>
        <div className="world-clock">
          <Sun size={22} />
          <strong>{formatTime(model.clock)}</strong>
          <span>
            DAY {model.day || 1} · {model.phase || "MORNING"}
          </span>
        </div>
      </div>
      <div className="realm-tabs world-model-tabs">
        {[
          { id: "overview", label: "World state", icon: Compass },
          { id: "events", label: "Living events", icon: Wind },
          { id: "rituals", label: "Ritual projects", icon: Sparkles },
          { id: "conditions", label: "World conditions", icon: Shield },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={tab === t.id ? "active" : ""}
          >
            <t.icon size={13} />
            {t.label}
          </button>
        ))}
      </div>
      {tab === "overview" && (
        <div className="world-overview">
          <div className="world-climate">
            <div className="weather-symbol">
              {/rain|storm/i.test(currentWeather || "") ? (
                <CloudRain size={32} />
              ) : model.phase === "night" ? (
                <Moon size={32} />
              ) : (
                <Sun size={32} />
              )}
            </div>
            <div>
              <span className="eyebrow">CURRENT CONDITIONS</span>
              <h3>{currentWeather || "Clear skies"}</h3>
              <p>
                {typeof model.weather === "object"
                  ? model.weather.description ||
                    "Weather reveals new routes and calls for different preparations."
                  : "The world moves in its own time. Keep a safe anchor within reach."}
              </p>
            </div>
            <button className="outline-button" onClick={() => setTab("events")}>
              What is happening? <ArrowRight size={12} />
            </button>
          </div>
          <div className="world-overview-grid">
            <aside className="region-selector">
              <div className="section-caption">
                ALL REGIONS <span>{regions.length || 39}</span>
              </div>
              {ZONES.map((z) => (
                <button
                  key={z.id}
                  className={regionId === z.id ? "active" : ""}
                  onClick={() => setRegionId(z.id)}
                >
                  <span>
                    {z.name}
                    <small>{z.realm} realm</small>
                  </span>
                  {state.zone.id === z.id ? (
                    <MapPin size={11} />
                  ) : (
                    <ArrowRight size={11} />
                  )}
                </button>
              ))}
            </aside>
            <div className="region-detail">
              <span className="eyebrow">
                {(
                  ZONES.find((z) => z.id === regionId)?.realm || "earth"
                ).toUpperCase()}{" "}
                REALM
              </span>
              <h3>
                {region.name ||
                  ZONES.find((z) => z.id === regionId)?.name ||
                  state.zone.name}
              </h3>
              <p>{ZONES.find((z) => z.id === regionId)?.description}</p>
              <div className="regional-meters">
                {METERS.map((m) => (
                  <Readout
                    key={m.id}
                    meter={m}
                    value={region[m.id] ?? region.meters?.[m.id]}
                  />
                ))}
              </div>
              <div className="region-condition-summary">
                <span className="section-caption">ACTIVE INFLUENCES</span>
                {(model.dailyLots || [])
                  .filter((l) => l.siteId === regionId && l.claimed < l.units)
                  .map((l) => (
                    <button
                      key={l.id}
                      className="outline-button"
                      onClick={() => call("claimWorldSupply", regionId, l.kind)}
                    >
                      {l.units - l.claimed} {l.kind} units · Collect{" "}
                      <Gem size={12} />
                    </button>
                  ))}
                {conditions.filter(
                  (c) =>
                    c.active !== false &&
                    (c.siteIds || c.affectedSites || c.sites || []).includes(
                      regionId,
                    ),
                ).length ? (
                  conditions
                    .filter(
                      (c) =>
                        c.active !== false &&
                        (
                          c.siteIds ||
                          c.affectedSites ||
                          c.sites ||
                          []
                        ).includes(regionId),
                    )
                    .map((c) => (
                      <div key={c.id}>
                        <Sparkles size={13} />
                        {c.name || c.powerName}
                        <span>{c.scope}</span>
                      </div>
                    ))
                ) : (
                  <p>No ongoing celestial condition controls this region.</p>
                )}
              </div>
              <button
                className="outline-button"
                onClick={() => {
                  if (!state.inCombat) {
                    call("setZone", regionId);
                    close();
                  }
                }}
              >
                Travel to this region <ArrowRight size={13} />
              </button>
            </div>
          </div>
        </div>
      )}
      {tab === "events" && (
        <div className="world-events">
          <div className="systems-section-intro">
            <Wind size={25} />
            <div>
              <h3>A world with something to ask.</h3>
              <p>
                Inspect a source, travel to its location, and complete its
                objective. Rewards settle once for each event.
              </p>
            </div>
          </div>
          <div className="world-event-grid">
            {events
              .filter((e) => e.status !== "expired")
              .map((e) => (
                <article
                  className={`world-event-card ${e.status === "complete" || e.complete || e.completed ? "complete" : ""}`}
                  key={e.id}
                >
                  <div className="event-card-tag">
                    <span>{e.kind || e.type || "WORLD EVENT"}</span>
                    <small>
                      {e.complete || e.completed || e.status === "complete"
                        ? "SETTLED"
                        : e.zoneName ||
                          ZONES.find((z) => z.id === (e.zoneId || e.regionId))
                            ?.name ||
                          state.zone.name}
                    </small>
                  </div>
                  <h3>{e.title || e.name}</h3>
                  <p>{e.description || e.objective}</p>
                  {e.requirement && (
                    <div className="event-requirement">{e.requirement}</div>
                  )}
                  <div className="event-reward">
                    <span>
                      <Gem size={11} />
                      {e.reward || 25} {e.currency || "good"} karma
                    </span>
                    {(e.x != null || e.position) && (
                      <small>
                        AT {Math.round((e.x ?? e.position?.x ?? 0) / 10)},{" "}
                        {Math.round((e.y ?? e.position?.y ?? 0) / 10)}
                      </small>
                    )}
                  </div>
                  <div className="event-card-actions">
                    <button
                      className="outline-button"
                      onClick={() =>
                        setEventInspection(
                          call("inspectWorldEvent", e.id) || { ...e },
                        )
                      }
                    >
                      Inspect <Compass size={12} />
                    </button>
                    <button
                      className="outline-button"
                      onClick={() => {
                        if (
                          (e.zoneId || e.regionId) &&
                          state.zone.id !== (e.zoneId || e.regionId)
                        )
                          call("setZone", e.zoneId || e.regionId);
                        call("navigateToEvent", e.id);
                        close();
                      }}
                    >
                      Find source <MapPin size={12} />
                    </button>
                  </div>
                  {!e.complete && !e.completed && e.status !== "complete" && (
                    <button
                      className="event-resolve"
                      onClick={() => call("completeWorldEvent", e.id)}
                    >
                      Resolve objective <Check size={11} />
                    </button>
                  )}
                </article>
              ))}
          </div>
          {!events.length && (
            <div className="empty-system">
              <Wind size={30} />
              <h3>The world is taking a breath.</h3>
              <p>Explore a region to discover its current events.</p>
            </div>
          )}
          {eventInspection && (
            <div className="transaction-preview event-inspection">
              <h3>
                {eventInspection.title ||
                  eventInspection.name ||
                  "Event inspection"}
              </h3>
              <p>
                {eventInspection.description ||
                  eventInspection.reason ||
                  eventInspection.objective}
              </p>
              {eventInspection.actions && (
                <div className="event-actions">
                  {eventInspection.actions.map((a) => (
                    <button
                      className="outline-button"
                      key={a.id || a}
                      onClick={() => {
                        call(
                          "advanceWorldEvent",
                          eventInspection.id,
                          a.id || a,
                        );
                        setEventInspection(
                          call("inspectWorldEvent", eventInspection.id),
                        );
                      }}
                    >
                      {a.label ||
                        a.name ||
                        eventInspection.actionLabels?.[a] ||
                        a}{" "}
                      <ArrowRight size={11} />
                    </button>
                  ))}
                </div>
              )}
              <div>
                <button
                  className="subtle-button"
                  onClick={() => setEventInspection(null)}
                >
                  Close inspection
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      {tab === "rituals" && (
        <div className="ritual-content">
          {ritual && (
            <div className={`active-ritual ${ritual.status}`}>
              <div className="active-ritual-heading">
                <Sparkles size={27} />
                <div>
                  <span className="eyebrow">
                    {ritual.status === "ready"
                      ? "AWAITING YOUR COMMITMENT"
                      : "ACTIVE WORLD PROJECT"}
                  </span>
                  <h3>
                    {ritual.name || ritual.powerName || ritual.power?.name}
                  </h3>
                </div>
                <span>{ritual.scope}</span>
              </div>
              <div className="ritual-progress">
                <i
                  style={{
                    width: `${ritual.progress != null ? ritual.progress * 100 : ritual.status === "ready" ? 100 : ritual.status === "committed" ? (ritual.stage / ritual.stageCount) * 100 : ritual.preparation ? Math.min(100, (1 - (ritual.preparationRemaining ?? ritual.remaining ?? 0) / ritual.preparation) * 100) : 0}%`,
                  }}
                />
              </div>
              <div className="ritual-status-row">
                <span>
                  {ritual.status === "ready"
                    ? "Preparation complete. Review the scope, then commit."
                    : ritual.status === "preparing"
                      ? `Preparing · ${Math.ceil(ritual.remaining ?? ritual.preparationRemaining ?? 0)} seconds remaining`
                      : ritual.status === "paused"
                        ? "Project interrupted. Settled stages remain in the world."
                        : `Stage ${ritual.stage || ritual.completedStages || 0} / ${ritual.stages?.length || ritual.stageCount || 1}`}
                </span>
                <strong>{ritual.status?.toUpperCase()}</strong>
              </div>
              <div className="active-ritual-actions">
                {ritual.status === "ready" && (
                  <button
                    className="primary-button"
                    onClick={() => call("commitRitual")}
                  >
                    Commit world project <Check size={13} />
                  </button>
                )}
                {ritual.status === "paused" && (
                  <button
                    className="primary-button"
                    onClick={() => call("resumeRitual", ritual.id)}
                  >
                    <Play size={12} /> Resume remaining stages
                  </button>
                )}
                <button
                  className="outline-button"
                  onClick={() => call("cancelRitual")}
                >
                  {ritual.status === "preparing" || ritual.status === "ready"
                    ? "Cancel preparation · no cost"
                    : "Interrupt project"}{" "}
                  <X size={12} />
                </button>
              </div>
            </div>
          )}
          {(model.projects || [])
            .filter((p) => p.status === "paused")
            .map((p) => (
              <div className="paused-project" key={p.id}>
                <Sparkles size={20} />
                <div>
                  <h3>{p.powerName}</h3>
                  <p>
                    {p.stage} / {p.stageCount} stages settled ·{" "}
                    {p.remainingCost} karma to resume
                  </p>
                </div>
                <button
                  className="outline-button"
                  onClick={() => call("resumeRitual", p.id)}
                >
                  Resume project <Play size={12} />
                </button>
              </div>
            ))}
          <div className="ritual-planner">
            <div className="systems-section-intro">
              <Sparkles size={26} />
              <div>
                <h3>Power on a different scale.</h3>
                <p>
                  Rituals change settlements, regions, worlds, or realms.
                  Training, access, and activation are separate commitments.
                </p>
              </div>
            </div>
            <label className="ritual-select">
              <span>CHOOSE A RITUAL</span>
              <select
                value={powerId}
                onChange={(e) => {
                  setPowerId(e.target.value);
                  setPreview(null);
                }}
              >
                {BRANCHES.map((b) => (
                  <optgroup key={b.id} label={b.name}>
                    {b.powers
                      .filter((p) => p.kind === "ritual")
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.level}. {p.name} ·{" "}
                          {(state.player.learned?.[b.id] || 0) >= p.level
                            ? "Learned"
                            : `Requires rank ${p.requiredRank}`}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </select>
            </label>
            <div className="ritual-spell-card">
              <img src={assetUrl(`/assets/power-${power.branch.id}.png`)} alt="" />
              <div>
                <span className="eyebrow">
                  {power.branch.name} · LEVEL {power.level}
                </span>
                <h3>{power.name}</h3>
                <p>{power.interpretation || power.effect}</p>
              </div>
            </div>
            <div className="ritual-facts">
              <div>
                <span>ACTIVATION</span>
                <strong>
                  {(power.karmaCost || 100 * power.level ** 2).toLocaleString()}
                  <small> {power.currency} karma</small>
                </strong>
              </div>
              <div>
                <span>ESSENCE</span>
                <strong>
                  {power.essenceCost}
                  <small> reserved</small>
                </strong>
              </div>
              <div>
                <span>PREPARATION</span>
                <strong>
                  {power.castTime}
                  <small> seconds</small>
                </strong>
              </div>
              <div>
                <span>SCOPE</span>
                <strong>{power.scope}</strong>
              </div>
            </div>
            <button
              className="subtle-button ritual-anchor-link"
              onClick={() => {
                call("navigateToRitualAnchor");
                close();
              }}
            >
              <MapPin size={12} /> Go to the sanctuary ritual anchor
            </button>
            <button className="outline-button full" onClick={inspectRitual}>
              <Compass size={13} /> Preview world project
            </button>
            {preview && (
              <div
                className={`ritual-preview ${preview.valid ? "valid" : "invalid"}`}
              >
                <div className="section-caption">
                  PROJECT PREVIEW{" "}
                  <span>
                    {preview.valid ? "ELIGIBLE" : "REQUIREMENTS NOT MET"}
                  </span>
                </div>
                {preview.requirements && (
                  <div className="ritual-requirements">
                    {preview.requirements.map((r) => (
                      <div key={r.id} className={r.met ? "met" : "unmet"}>
                        {r.met ? <Check size={11} /> : <Lock size={11} />}{" "}
                        {r.label}
                      </div>
                    ))}
                  </div>
                )}
                {preview.reason && (
                  <p className="preview-reason">{preview.reason}</p>
                )}
                <div className="ritual-preview-grid">
                  <div>
                    <h4>Affected sites</h4>
                    <p>
                      {(preview.affectedSites || [])
                        .map((s) =>
                          typeof s === "object"
                            ? s.name || s.id
                            : ZONES.find((z) => z.id === s)?.name || s,
                        )
                        .join(" · ") || "No eligible sites in this scope."}
                    </p>
                  </div>
                  <div>
                    <h4>Protected exclusions</h4>
                    <p>
                      {(
                        preview.exclusions || [
                          "Sanctuary exits",
                          "Arrival anchors",
                          "Protected storage",
                          "NPC identities",
                        ]
                      )
                        .map((x) => (typeof x === "string" ? x : x.name))
                        .join(" · ")}
                    </p>
                  </div>
                  <div>
                    <h4>World stages</h4>
                    <p>
                      {Array.isArray(preview.stages)
                        ? preview.stages.length
                        : preview.stages || 1}{" "}
                      stages. Settled changes persist after an interruption.
                    </p>
                  </div>
                  <div>
                    <h4>Recovery & reversal</h4>
                    <p>
                      Owner reversal costs 25% of settled karma. A
                      counter-project costs 50% and three distinct anchors.
                    </p>
                  </div>
                </div>
                <button
                  className="primary-button"
                  disabled={
                    !preview.valid ||
                    !!(
                      ritual &&
                      ["preparing", "ready", "committed", "settling"].includes(
                        ritual.status,
                      )
                    )
                  }
                  onClick={() => {
                    call("beginRitual", power.branch.id, power.level);
                    setPreview(null);
                  }}
                >
                  Reserve & prepare <Sparkles size={13} />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      {tab === "conditions" && (
        <div className="world-conditions">
          <div className="systems-section-intro">
            <Shield size={26} />
            <div>
              <h3>Eternal does not mean inescapable.</h3>
              <p>
                Inspect the source, preserve settled consequences, and reverse
                or counter a persistent influence.
              </p>
            </div>
          </div>
          {conditions.length ? (
            <div className="condition-grid">
              {conditions.map((c) => (
                <article
                  className={`condition-card ${c.active === false ? "inactive" : ""}`}
                  key={c.id}
                >
                  <div className="condition-tag">
                    <span>{c.scope || "REGIONAL"}</span>
                    <small>
                      {c.active === false
                        ? "REVERSED"
                        : c.expiresAt || c.expiresDay
                          ? "TEMPORARY"
                          : "PERSISTENT"}
                    </small>
                  </div>
                  <h3>{c.name || c.powerName}</h3>
                  <p>
                    {c.description ||
                      c.effect ||
                      "A celestial condition influences the eligible sites in its recorded scope."}
                  </p>
                  <div className="condition-sites">
                    {(c.siteIds || c.affectedSites || c.sites || []).length}{" "}
                    affected sites ·{" "}
                    {c.stageHistory?.length || c.settledStages || 1} settled
                    stages
                  </div>
                  {c.active !== false && (
                    <div className="condition-actions">
                      <button
                        className="outline-button"
                        onClick={() =>
                          setReversal({
                            id: c.id,
                            name: c.name || c.powerName,
                            cost: Math.ceil(
                              (c.settledCost ||
                                c.settledKarma ||
                                c.karmaCost ||
                                0) * 0.25,
                            ),
                          })
                        }
                      >
                        Owner reversal <RotateCcw size={12} />
                      </button>
                      <button
                        className="subtle-button"
                        onClick={() => {
                          setEventInspection(
                            call("previewCounterProject", c.id),
                          );
                          setReversal(null);
                        }}
                      >
                        Counter-project <ArrowRight size={12} />
                      </button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-system">
              <Shield size={30} />
              <h3>No celestial condition is binding this world.</h3>
              <p>
                Completed rituals record their scope, sites, stages, and
                reversal options here.
              </p>
            </div>
          )}
          {reversal && (
            <div className="transaction-preview">
              <h3>Reverse {reversal.name}</h3>
              <p>
                Owner reversal costs {reversal.cost.toLocaleString()} karma.
                This stops future effects and retains recorded outcomes.
              </p>
              <div>
                <button
                  className="subtle-button"
                  onClick={() => setReversal(null)}
                >
                  Cancel
                </button>
                <button
                  className="primary-button"
                  onClick={() => {
                    call("reverseCondition", reversal.id);
                    setReversal(null);
                  }}
                >
                  Confirm reversal <Check size={12} />
                </button>
              </div>
            </div>
          )}
          {eventInspection && (
            <div className="transaction-preview">
              <h3>Counter-project requirements</h3>
              <p>
                {eventInspection.reason ||
                  eventInspection.description ||
                  "Complete three distinct anchor objectives, then settle the counter-power cost."}
              </p>
              <div className="counter-anchors">
                {(eventInspection.anchors || []).map((a, i) => (
                  <div key={a.id || i}>
                    <h4>
                      {a.complete ? <Check size={11} /> : <MapPin size={11} />}{" "}
                      {a.title || a.name || `Anchor ${i + 1}`}
                    </h4>
                    <p>{a.description}</p>
                    <span>
                      {ZONES.find((z) => z.id === a.siteId)?.name} ·{" "}
                      {Math.round(a.x / 10)}, {Math.round(a.y / 10)}
                    </span>
                    <div>
                      <button
                        className="outline-button"
                        onClick={() => {
                          call(
                            "navigateToCounterAnchor",
                            eventInspection.conditionId || eventInspection.id,
                            a.id || i,
                          );
                          close();
                        }}
                      >
                        Find anchor <MapPin size={11} />
                      </button>
                      <button
                        className="outline-button"
                        onClick={() => {
                          call(
                            "completeCounterAnchor",
                            eventInspection.conditionId || eventInspection.id,
                            a.id || i,
                          );
                          setEventInspection(
                            call(
                              "previewCounterProject",
                              eventInspection.conditionId || eventInspection.id,
                            ),
                          );
                        }}
                      >
                        Complete <Check size={11} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div>
                <button
                  className="subtle-button"
                  onClick={() => setEventInspection(null)}
                >
                  Close
                </button>
                <button
                  className="primary-button"
                  onClick={() =>
                    call(
                      "counterCondition",
                      eventInspection.conditionId || eventInspection.id,
                    )
                  }
                >
                  Settle counter-project <ArrowRight size={12} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
