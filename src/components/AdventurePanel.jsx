import React, { useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Compass,
  MapPin,
  Sparkles,
  ScrollText,
  Navigation,
  Package,
  X,
} from "lucide-react";
import { assetUrl } from "../assetUrl.js";
import CreatureInteraction from "./CreatureInteraction.jsx";
import "../adventure.css";

export function ObjectiveTracker({ state, call, open }) {
  const [expanded, setExpanded] = useState(true);
  const story = state.adventure,
    o = story?.objective;
  if (!o) return null;
  return (
    <aside
      className="objective-tracker"
      style={{ "--faction-accent": story.color }}
      aria-label="Current campaign objective"
    >
      <button
        className="objective-heading"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <span className="objective-faction">{story.faction}</span>
        <ChevronDown size={13} className={expanded ? "expanded" : ""} />
      </button>
      <button className="objective-title" onClick={() => open("adventure")}>
        <ScrollText size={14} />
        <strong>{o.title}</strong>
        {o.ready && <Check size={13} />}
      </button>
      {expanded && (
        <div className="objective-detail">
          <p>{o.text}</p>
          {!o.complete && (
            <>
              <small>
                <MapPin size={10} />
                {o.zoneName} · Act {o.act} ·{" "}
                {o.ready
                  ? "RETURN TO ENVOY"
                  : `STEP ${Math.min(o.stage + 1, o.stages)} / ${o.stages}`}
              </small>
              <button
                className="objective-route"
                onClick={() => call("navigateAdventureObjective")}
              >
                <Navigation size={12} />{" "}
                {state.zone?.id === o.zoneId
                  ? "Track & walk"
                  : "Travel & track"}{" "}
                <ArrowRight size={12} />
              </button>
            </>
          )}
        </div>
      )}
    </aside>
  );
}
export function AdventurePanel({ state, call, close, initialTab = "story" }) {
  const [tab, setTab] = useState(initialTab),
    [message, setMessage] = useState("");
  const story = state.adventure;
  if (!story) return <p>Connecting your story…</p>;
  const current = story.missions[story.missionIndex];
  return (
    <div
      className="adventure-panel"
      style={{ "--faction-accent": story.color }}
    >
      <div className={`campaign-hero campaign-hero-${state.player.lineage}`}>
        <div
          className="campaign-hero-image"
          style={{
            backgroundImage: `url("${assetUrl("/assets/v3/" + (state.player.lineage === "demon" ? "cosmic-atlas.png" : "earth-atlas.png"))}")`,
            backgroundPosition:
              state.player.lineage === "demon" ? "0% 100%" : "0% 0%",
          }}
        />
        <div>
          <span className="eyebrow">{story.faction} · FACTION CAMPAIGN</span>
          <h3>{story.name}</h3>
          <p>
            {state.player.name}, your choices shape the route between the three
            realms.
          </p>
        </div>
        <span className="campaign-completion">
          {story.completed.length}
          <small>/ 12 MISSIONS</small>
        </span>
      </div>
      <div className="adventure-tabs">
        <button
          className={tab === "story" ? "active" : ""}
          onClick={() => setTab("story")}
        >
          Your campaign
        </button>
        <button
          className={tab === "activities" ? "active" : ""}
          onClick={() => setTab("activities")}
        >
          Regional power challenges
        </button>
      </div>
      {tab === "story" ? (
        <>
          {story.ending ? (
            <div className="campaign-ending">
              <Sparkles size={26} />
              <h3>{story.ending.title}</h3>
              <p>{story.ending.text}</p>
              <p>
                Your campaign is settled. The regions, contracts, rituals and
                other travelers remain.
              </p>
            </div>
          ) : (
            <section className="campaign-current">
              <div>
                <span className="eyebrow">
                  ACT {current?.act} · MISSION {story.missionIndex + 1}
                </span>
                <h3>{current?.title}</h3>
                <p>{current?.description}</p>
                <ol>
                  {current?.stages.map((s, i) => (
                    <li
                      key={i}
                      className={
                        i < story.stageIndex
                          ? "done"
                          : i === story.stageIndex
                            ? "current"
                            : ""
                      }
                    >
                      <span>
                        {i < story.stageIndex ? <Check size={12} /> : i + 1}
                      </span>
                      <p>{s.prompt}</p>
                    </li>
                  ))}
                </ol>
                <div className="campaign-reward">
                  <Sparkles size={14} />
                  {current?.reward}{" "}
                  {state.player.lineage === "demon" ? "Bad" : "Good"} Karma ·
                  settles once at your envoy
                </div>
              </div>
              <aside>
                <span className="eyebrow">CURRENT OBJECTIVE</span>
                <p>{story.objective.text}</p>
                <small>{story.objective.zoneName}</small>
                <button
                  className="primary-button"
                  onClick={async () => {
                    const result = await call("navigateAdventureObjective");
                    if (result !== false) close();
                    else setMessage("Leave conflict and try the route again.");
                  }}
                >
                  <Navigation size={14} /> Track objective
                </button>
              </aside>
            </section>
          )}
          <div className="campaign-missions">
            {[1, 2, 3].map((act) => (
              <section key={act}>
                <h4>
                  ACT {act}{" "}
                  <span>
                    {
                      [
                        "A presence in the world",
                        "Across the veiled horizon",
                        "The future of the lattice",
                      ][act - 1]
                    }
                  </span>
                </h4>
                {story.missions
                  .filter((m) => m.act === act)
                  .map((m) => (
                    <article key={m.id} className={m.status}>
                      <span>
                        {m.status === "complete" ? (
                          <Check size={14} />
                        ) : (
                          String(m.index + 1).padStart(2, "0")
                        )}
                      </span>
                      <div>
                        <strong>{m.title}</strong>
                        <p>{m.description}</p>
                      </div>
                      <small>
                        {m.status === "active"
                          ? "CURRENT"
                          : m.status === "complete"
                            ? "SETTLED"
                            : "UPCOMING"}
                      </small>
                    </article>
                  ))}
              </section>
            ))}
          </div>
        </>
      ) : (
        <div className="activity-cards">
          {story.activities.map((a) => (
            <article key={a.id}>
              <span className={`activity-glyph glyph-${a.type}`}>
                <Sparkles size={24} />
              </span>
              <span className="eyebrow">
                {a.cooldown > 0
                  ? `REPLENISHING · ${Math.ceil(a.cooldown)}s`
                  : a.ready
                    ? "READY TO COLLECT"
                    : "REACTIVE WORLD SITE"}
              </span>
              <h3>{a.name}</h3>
              <p>{a.description}</p>
              <small>
                {Object.entries(a.reward)
                  .map(([id, q]) => `${q} ${id}`)
                  .join(" · ")}
              </small>
              <button
                className="outline-button"
                onClick={async () => {
                  const result = await call("navigateInteraction", a.id);
                  if (result !== false) close();
                }}
              >
                <Compass size={13} /> Find this site
              </button>
            </article>
          ))}
        </div>
      )}
      {message && (
        <p className="interaction-feedback" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
export function InteractionPanel({ state, call, close, open }) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const p = state.interaction;
  if (!p)
    return (
      <div className="interaction-empty">
        <Compass size={30} />
        <h3>Select something in the world</h3>
        <p>
          NPCs provide services and story choices. Reactive sites answer your
          powers. Resources can be gathered directly with E.
        </p>
        <button className="outline-button" onClick={close}>
          Return to the world
        </button>
      </div>
    );
  async function perform(action) {
    setBusy(true);
    setMessage("");
    try {
      const result = await call("performInteraction", p.targetId, action);
      if (result === false)
        setMessage(
          "The action is unavailable. Check your range, materials, power and current objective.",
        );
    } catch (e) {
      setMessage(e.message || "The action could not complete.");
    } finally {
      setBusy(false);
    }
  }
  if (p.type === "creature")
    return (
      <div className="purpose-creature">
        <div className="interaction-purpose">
          <span className="eyebrow">{p.purpose}</span>
          <h3>{p.name}</h3>
        </div>
        <CreatureInteraction
          state={state}
          profile={p.creature}
          call={call}
          close={close}
          items={state.items}
        />
      </div>
    );
  const a = p.activity;
  return (
    <div className={`interaction-panel interaction-${p.type}`}>
      <div className="interaction-identity">
        <div className={`interaction-avatar avatar-${p.type}`}>
          <Sparkles size={35} />
        </div>
        <div>
          <span className="eyebrow">{p.purpose}</span>
          <h3>{p.name}</h3>
          <p>{p.dialogue || p.description}</p>
        </div>
      </div>
      {a && (
        <section className="activity-console">
          <div className="activity-console-head">
            <span>
              {a.ready
                ? "CHALLENGE COMPLETE"
                : a.cooldown > 0
                  ? "SITE REPLENISHING"
                  : "POWER INTERACTION"}
            </span>
            <strong>
              {a.step} / {a.total}
            </strong>
          </div>
          <div className="activity-progress">
            {Array.from({ length: a.total }, (_, i) => (
              <i key={i} className={i < a.step ? "complete" : ""} />
            ))}
          </div>
          <p>{a.hint}</p>
          {a.type === "runegate" && (
            <div className="rune-sequence">
              {a.sequence.map((note, i) => (
                <span
                  key={i}
                  className={
                    i < a.step ? "done" : i === a.step ? "current" : ""
                  }
                >
                  {note}
                  {i < a.step && <Check size={10} />}
                </span>
              ))}
            </div>
          )}
          {a.type === "pulsewell" && a.step === 1 && (
            <div className="echo-timer">
              Response window · {Math.ceil(a.remaining)} seconds
            </div>
          )}
          {a.challenge && (
            <div className="echo-timer">
              Carry the spark to its ring · {Math.ceil(a.challenge.remaining)}{" "}
              seconds
            </div>
          )}
          <div className="activity-rewards">
            <Package size={14} />
            {Object.entries(a.reward)
              .map(([id, q]) => `${q} ${id}`)
              .join(" · ")}
          </div>
        </section>
      )}
      {p.type === "training" && (
        <div className="training-note">
          <Sparkles size={18} />
          <p>
            Use any learned local power. Preparation, Essence, cooldown and
            target validation are the same as in the world.
          </p>
        </div>
      )}
      <div className="interaction-actions">
        {p.actions.map((action) => (
          <button
            key={action.id}
            className={
              action.primary
                ? "primary-button"
                : `outline-button ${action.selected ? "active" : ""}`
            }
            disabled={
              busy ||
              !!p.reason ||
              action.disabled ||
              (action.id === "cast" &&
                (!state.castPreview?.valid || !!state.castState))
            }
            onClick={() => perform(action.id)}
          >
            {action.label}
            {action.primary && <ArrowRight size={14} />}
          </button>
        ))}
      </div>
      {p.reason && (
        <div className="interaction-range">
          <p>
            {p.reason}
            {!p.inRange && ` ${Math.ceil((p.distance || 0) / 10)} m away.`}
          </p>
          {!p.inRange && (
            <button
              className="outline-button"
              disabled={busy}
              onClick={async () => {
                const result = await call("navigateInteraction", p.targetId);
                if (result !== false) close();
              }}
            >
              <Navigation size={13} /> Approach target
            </button>
          )}
        </div>
      )}
      {a && (
        <div className="selected-power-note">
          <img
            src={assetUrl(
              `/assets/power-icons/${state.selectedPower?.branchId}-${state.selectedPower?.level}.png`,
            )}
            alt=""
          />
          <div>
            <small>YOUR SELECTED POWER</small>
            <strong>{state.selectedPower?.name}</strong>
            <span>
              {state.selectedPower?.essenceCost} Essence ·{" "}
              {state.selectedPower?.castTime}s preparation
            </span>
          </div>
          <button className="outline-button" onClick={() => open("powers")}>
            Change power
          </button>
        </div>
      )}
      {p.actions.some((action) => action.id === "cast") &&
        !state.castPreview?.valid && (
          <p className="interaction-feedback" role="status">
            {state.castPreview?.reason}
            {state.selectedPower?.remaining > 0 &&
              ` Ready in ${Math.ceil(state.selectedPower.remaining)}s.`}
          </p>
        )}
      {message && (
        <p className="interaction-feedback" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
