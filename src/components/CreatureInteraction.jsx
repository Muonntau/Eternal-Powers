import React, { useEffect, useState } from "react";
import {
  Check,
  Heart,
  Leaf,
  Navigation,
  Package,
  Shield,
  Sparkles,
  Swords,
} from "lucide-react";
import { assetUrl } from "../assetUrl.js";
import "../creature-interaction.css";

const displayName = (id, items) =>
  items?.[id]?.name ||
  {
    herb: "Moonleaf",
    crystal: "Crystal",
    wood: "Sacred Timber",
    stone: "Runestone",
    residue: "Essence residue",
  }[id] ||
  id.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());
const materialArt = (item) =>
  assetUrl(`/assets/item-${item === "wood" ? "timber" : item}.png`);

/** The same card handles E interaction and creature inspection. Its commit
 * always uses the authoritative offer; it never removes materials locally. */
export default function CreatureInteraction({
  state,
  profile,
  call,
  close,
  items = {},
}) {
  const [view, setView] = useState(profile);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [confirmedOffering, setConfirmedOffering] = useState(null);
  const id = profile?.entityId;
  useEffect(() => {
    setView(profile);
    setFeedback("");
    setConfirmedOffering(null);
  }, [id]);
  useEffect(() => {
    if (!id) return;
    const snapshot = call?.("inspectCreature", id);
    if (snapshot && typeof snapshot.then !== "function") setView(snapshot);
    else if (profile) setView(profile);
  }, [
    id,
    profile,
    state.player?.inventory,
    state.player?.encounters,
    state.player?.companion,
    state.player?.x,
    state.player?.y,
    state.inCombat,
  ]);
  if (!profile || !view) return null;
  const creature = view.entityId === id ? view : profile;
  const interaction = creature.interaction || {};
  const target = state.target?.id === id ? state.target : null;
  const point = interaction.point || target;
  const distance = point
    ? Math.hypot(
        (state.player?.x || 0) - point.x,
        (state.player?.y || 0) - point.y,
      )
    : Infinity;
  const inRange = Number.isFinite(distance)
    ? distance <= (interaction.range || 130)
    : !!interaction.inRange;
  const requirements = (interaction.requirements || []).map((r) => ({
    ...r,
    available: Math.max(0, state.player?.inventory?.[r.item] || 0),
  }));
  const assisted = creature.assisted || confirmedOffering === id;
  const missing = requirements.some((r) => r.available < r.quantity);
  const unavailable = creature.dead || state.downed || state.recovery?.downed;
  const canGive =
    !!creature.offer &&
    requirements.length > 0 &&
    !assisted &&
    inRange &&
    !missing &&
    !unavailable;
  const companion =
    creature.companion || state.player?.companion?.creatureId === creature.id;
  async function perform(method, ...args) {
    setBusy(true);
    setFeedback("");
    try {
      const result = await call(method, ...args);
      const refreshed = await call("inspectCreature", id);
      if (refreshed) setView(refreshed);
      if (result === false || result == null) {
        setFeedback(
          refreshed?.interaction?.reason ||
            "The interaction changed. Check your range and materials, then try again.",
        );
        return;
      }
      if (method === "assistCreature") {
        setConfirmedOffering(id);
        setFeedback(
          creature.canBond
            ? "Offering received. You can now form a familiar bond."
            : "Offering received. This creature remembers your help.",
        );
      } else if (method === "bondCompanion")
        setFeedback("A familiar bond formed. Choose its support below.");
      else setFeedback("Your familiar’s support is updated.");
    } catch (error) {
      setFeedback(
        error?.message ||
          "The interaction could not complete. Your inventory is unchanged.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function approach() {
    if (!point) return;
    const dx = (state.player?.x || point.x + 1) - point.x,
      dy = (state.player?.y || point.y) - point.y;
    const d = Math.max(1, Math.hypot(dx, dy));
    const result = await call(
      "navigateTo",
      point.x + (dx / d) * 85,
      point.y + (dy / d) * 85,
      point.zoneId || state.zone?.id,
    );
    if (result !== false) close?.();
    else
      setFeedback(
        "A route could not be found. Move closer to the creature on foot.",
      );
  }
  return (
    <section
      className="creature-interaction"
      aria-label={`${creature.name} interaction`}
    >
      <div className="creature-portrait-panel">
        <div className={`creature-realm-badge realm-${creature.realm}`}>
          <Sparkles size={12} /> {creature.realm} realm · rank {creature.rank}
        </div>
        <div
          className="creature-portrait"
          role="img"
          aria-label={creature.name}
          style={{
            backgroundImage: `url("${assetUrl(creature.spritePath || `/assets/creature-${creature.id}-sheet.png`)}")`,
          }}
        />
        <span className="creature-attitude">
          {creature.offer
            ? "NEUTRAL CONTACT"
            : creature.role === "companion"
              ? "BONDED COMPANION"
              : "FIELD ENCOUNTER"}
        </span>
        <h3>{creature.name}</h3>
        <p>{creature.description}</p>
        {Number.isFinite(distance) && (
          <div className={`creature-proximity ${inRange ? "in-range" : ""}`}>
            <Navigation size={13} />{" "}
            {inRange ? "Within reach" : `${Math.ceil(distance / 10)} m away`}
          </div>
        )}
      </div>
      <div className="creature-interaction-body">
        <div className="creature-relationship-heading">
          <span className="eyebrow">A CONNECTION WITH THE WORLD</span>
          <h4>
            {creature.offer
              ? assisted
                ? "An offering remembered"
                : "A small gesture. A lasting bond."
              : "Know the creature before you act."}
          </h4>
        </div>
        <p className="creature-peaceful-route">
          {creature.noncombat ||
            creature.peacefulRoute ||
            "Study the local anchors to discover a peaceful route."}
        </p>
        {creature.offer && (
          <div
            className={`creature-material-request ${assisted ? "received" : ""}`}
          >
            <div className="creature-request-title">
              <Package size={17} />
              <strong>
                {assisted ? "Materials received" : "Requested offering"}
              </strong>
              {assisted && <Check size={16} />}
            </div>
            <div className="creature-material-list">
              {requirements.map((r) => (
                <div className="creature-material-row" key={r.item}>
                  <img
                    src={materialArt(r.item)}
                    alt=""
                    onError={(e) => {
                      e.currentTarget.style.visibility = "hidden";
                    }}
                  />
                  <div>
                    <strong>{displayName(r.item, items)}</strong>
                    <span>
                      {assisted
                        ? "Offering completed"
                        : r.available >= r.quantity
                          ? "Ready to give"
                          : `${r.quantity - r.available} more needed`}
                    </span>
                  </div>
                  <span
                    className={
                      r.available >= r.quantity || assisted
                        ? "ready"
                        : "missing"
                    }
                  >
                    {assisted ? (
                      <Check size={18} />
                    ) : (
                      <>
                        <b>{r.available}</b> / {r.quantity}
                      </>
                    )}
                  </span>
                </div>
              ))}
            </div>
            {!assisted && (
              <p className="creature-offer-note">
                You give the exact requested materials. Your first assistance
                reward is recorded once.
              </p>
            )}
            {!assisted && (
              <button
                className="primary-button creature-give-button"
                disabled={!canGive || busy}
                onClick={() => perform("assistCreature", id)}
              >
                <Leaf size={15} />
                {busy
                  ? "Giving offering…"
                  : missing
                    ? "Gather the missing materials"
                    : !inRange
                      ? "Move closer to give"
                      : "Give requested materials"}
              </button>
            )}
            {!inRange && point && (
              <button
                className="outline-button creature-approach-button"
                disabled={busy}
                onClick={approach}
              >
                <Navigation size={14} /> Approach creature
              </button>
            )}
          </div>
        )}
        {creature.canBond && (
          <div className="creature-bond-card">
            <Heart size={20} />
            <div>
              <h4>{companion ? "Your companion" : "A familiar awaits"}</h4>
              <p>
                {companion
                  ? "This familiar follows your character. Its support can restore vitality or grant a barrier."
                  : assisted
                    ? "Form a bond outside combat while standing close to the familiar."
                    : "Complete the offering above to earn this familiar’s trust."}
              </p>
            </div>
            {!companion && (
              <button
                className="outline-button"
                disabled={
                  busy ||
                  !assisted ||
                  !inRange ||
                  !!state.inCombat ||
                  unavailable
                }
                onClick={() => perform("bondCompanion", id)}
              >
                Bond familiar
              </button>
            )}
          </div>
        )}
        {companion && (
          <div className="creature-support-actions">
            <button
              className={`outline-button ${state.player?.companion?.mode === "heal" ? "selected" : ""}`}
              disabled={busy || !!state.inCombat}
              onClick={() => perform("setCompanionSupport", "heal")}
            >
              <Heart size={14} /> Restore vitality
            </button>
            <button
              className={`outline-button ${state.player?.companion?.mode === "barrier" ? "selected" : ""}`}
              disabled={busy || !!state.inCombat}
              onClick={() => perform("setCompanionSupport", "barrier")}
            >
              <Shield size={14} /> Protective barrier
            </button>
          </div>
        )}
        {!creature.offer && (
          <div className="creature-combat-facts">
            <span>
              <Swords size={14} />{" "}
              {creature.currentTell || creature.tell || "Observe its next move"}
            </span>
            <p>{creature.counterplay}</p>
            {creature.resistance && (
              <small>Resistance · {creature.resistance}</small>
            )}
          </div>
        )}
        {(feedback || (!canGive && !assisted && interaction.reason)) && (
          <p className="creature-interaction-feedback" role="status">
            {feedback || interaction.reason}
          </p>
        )}
      </div>
    </section>
  );
}
