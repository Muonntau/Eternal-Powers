import React, { useState } from "react";
import {
  Eye,
  Shield,
  Heart,
  Users,
  Check,
  Lock,
  Sparkles,
  ArrowRight,
  MapPin,
  RotateCcw,
  Feather,
  Sun,
  Moon,
  ScrollText,
} from "lucide-react";
import { BRANCHES, ZONES } from "../data/manual.js";

export function RecoveryOverlay({ state, call }) {
  const recovery = state.recovery || {};
  if (!state.downed && !recovery.downed) return null;
  return (
    <div className="recovery-overlay">
      <div className="recovery-sigil">
        <Heart size={35} />
      </div>
      <span className="eyebrow">YOUR JOURNEY CONTINUES</span>
      <h2>A moment between worlds.</h2>
      <p>
        Your belongings, learned powers, and earned standing remain yours.
        <br />A nearby ally may revive you, or the sanctuary will receive you.
      </p>
      <div className="recovery-countdown">
        <strong>{Math.ceil(recovery.remaining || 0)}</strong>
        <span>SECONDS UNTIL RECALL</span>
      </div>
      <div className="recovery-timer">
        <i
          style={{
            width: `${Math.min(100, ((recovery.remaining || 0) / 20) * 100)}%`,
          }}
        />
      </div>
      {recovery.revive && (
        <p className="revive-progress">
          Ally revival · {Math.ceil(recovery.revive.remaining)}s remaining
        </p>
      )}
      <div className="recovery-actions">
        <button
          className="outline-button"
          onClick={() => call("beginRevive", "@player")}
        >
          <Users size={13} /> Request nearby ally revive
        </button>
        <button
          className="primary-button"
          disabled={!recovery.canRecall}
          onClick={() => call("useRecoveryRecall")}
        >
          <Feather size={13} /> Recall to sanctuary
        </button>
      </div>
    </div>
  );
}

export default function SocialPanel({
  state,
  call,
  close,
  open,
  initialTab = "standing",
}) {
  const [tab, setTab] = useState(initialTab),
    [restitution, setRestitution] = useState(null),
    [practice, setPractice] = useState(
      state.player.lineage === "demon" ? "water-grow" : "hate-clean",
    );
  const rep = state.reputation || { factions: [], npcs: [], history: [] },
    veil = state.veil || {},
    cert = state.certification || {},
    recovery = state.recovery || {};
  return (
    <div className="social-content">
      <div className="social-banner">
        <Eye size={40} />
        <div>
          <span className="eyebrow">IDENTITY, EVIDENCE, AND CONSEQUENCE</span>
          <h3>The world remembers what it sees.</h3>
          <p>
            Your appearance can change. Witnesses, promises, and settled
            exchanges keep their own history.
          </p>
        </div>
      </div>
      <div className="realm-tabs social-tabs">
        {[
          { id: "standing", label: "Standing", icon: Users },
          { id: "veil", label: "The veil", icon: Eye },
          { id: "certification", label: "Affinity trials", icon: Sparkles },
          { id: "recovery", label: "Recovery & rebirth", icon: Heart },
        ].map((t) => (
          <button
            key={t.id}
            className={tab === t.id ? "active" : ""}
            onClick={() => setTab(t.id)}
          >
            <t.icon size={13} />
            {t.label}
          </button>
        ))}
      </div>
      {tab === "standing" && (
        <>
          <div className="systems-section-intro">
            <Users size={27} />
            <div>
              <h3>Earned trust has a memory.</h3>
              <p>
                Standing ranges from −100 to +100. Honoring a posted obligation
                improves a relationship; witnessed wrongdoing creates a specific
                incident.
              </p>
            </div>
          </div>
          <div className="reputation-grid">
            {[
              ...(rep.factions || []).map((r) => ({ ...r, type: "faction" })),
              ...(rep.npcs || []).map((r) => ({ ...r, type: "person" })),
            ].map((r) => (
              <article key={r.type + r.id}>
                <span className="eyebrow">{r.type}</span>
                <h3>{r.name || r.id.replaceAll("-", " ")}</h3>
                <div>
                  <strong>
                    {r.value > 0 ? "+" : ""}
                    {r.value}
                  </strong>
                  <span>{r.tier}</span>
                </div>
                <div className="standing-track">
                  <i style={{ width: `${(r.value + 100) / 2}%` }} />
                </div>
              </article>
            ))}
          </div>
          <div className="journey-ledger">
            <div className="section-caption">RECORDED CONSEQUENCES</div>
            {(rep.history || []).slice(0, 12).map((h) => (
              <div key={h.id}>
                <span className="tiny-diamond" />
                <p>
                  {h.reason} · {h.target}
                </p>
                <small>
                  {h.delta > 0 ? "+" : ""}
                  {h.delta}
                </small>
              </div>
            ))}
          </div>
        </>
      )}
      {tab === "veil" && (
        <>
          <div className="veil-status">
            <div className={`veil-orb ${veil.state}`}>
              <Eye size={32} />
            </div>
            <div>
              <span className="eyebrow">CURRENT PRESENTATION</span>
              <h3>
                {veil.state === "veiled"
                  ? "A mundane traveler"
                  : veil.state === "transition"
                    ? "Settling into the veil"
                    : "Celestial form revealed"}
              </h3>
              <p>
                {veil.state === "transition"
                  ? `${Math.ceil(veil.remaining)} seconds remaining.`
                  : "Disguise changes what ordinary observers see. Overt hostility reveals you to its witnesses."}
              </p>
            </div>
            <button
              className="outline-button"
              onClick={() => call("toggleVeil")}
            >
              {veil.state === "veiled"
                ? "Reveal celestial form"
                : "Enter the veil"}{" "}
              <Eye size={12} />
            </button>
          </div>
          <div className="detection-readout">
            <span>OBSERVER AWARENESS</span>
            <div>
              <i style={{ width: `${(veil.detection || 0) * 100}%` }} />
            </div>
            <strong>{Math.round((veil.detection || 0) * 100)}%</strong>
          </div>
          <div className="witness-grid">
            {(veil.observers || [])
              .filter((o) => o.zoneId === state.zone.id && o.visible)
              .map((o) => (
                <article key={o.id}>
                  <h3>{o.name}</h3>
                  <span>{o.awareness}</span>
                  <div className="standing-track">
                    <i style={{ width: `${o.meter * 100}%` }} />
                  </div>
                </article>
              ))}
          </div>
          <div className="incident-list">
            <div className="section-caption">WITNESSED INCIDENTS</div>
            {(veil.incidents || []).map((i) => (
              <article key={i.id}>
                <div>
                  <h3>{i.type}</h3>
                  <p>
                    {ZONES.find((z) => z.id === i.zoneId)?.name || i.zoneId} ·{" "}
                    {i.witnesses?.length || 0} witnesses ·{" "}
                    {i.repaired ? "Restitution recorded" : "Unresolved"}
                  </p>
                </div>
                {!i.repaired && (
                  <button
                    className="outline-button"
                    onClick={() =>
                      setRestitution(call("previewRestitution", i.id))
                    }
                  >
                    Discuss restitution <ScrollText size={12} />
                  </button>
                )}
              </article>
            ))}
          </div>
          {restitution && (
            <div className="transaction-preview">
              <h3>Restitution preview</h3>
              <p>
                {restitution.reason ||
                  `${restitution.karma || 0} native Karma. Standing improves by five once; witnesses and receipts remain recorded.`}
              </p>
              <div>
                <button
                  className="subtle-button"
                  onClick={() => setRestitution(null)}
                >
                  Cancel
                </button>
                <button
                  className="primary-button"
                  disabled={!restitution.valid}
                  onClick={() => {
                    call("makeRestitution", restitution.incidentId);
                    setRestitution(null);
                  }}
                >
                  Accept restitution <Check size={12} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
      {tab === "certification" && (
        <>
          <div className="systems-section-intro">
            <Sparkles size={28} />
            <div>
              <h3>Cross the boundary deliberately.</h3>
              <p>
                Certification opens the opposing wallet and domains. It grants
                no branch for free, and earlier opposing outcomes are not paid
                retroactively.
              </p>
            </div>
          </div>
          <div className="certification-checklist">
            {[
              {
                met: cert.rankMet,
                label: "Reach celestial rank 3",
                desc: "Earn lifetime Karma and complete the required trial.",
              },
              {
                met: cert.cooperativeMet,
                label: "Complete a cooperative objective",
                desc: "Work with a neutral ally or honor a shared contract.",
              },
              {
                met: cert.practiceMet,
                label: "Practice an opposing-domain power",
                desc: "Use the isolated level-one trial on the sanctuary effigy.",
              },
              {
                met: cert.fundsMet,
                label: "Reserve 500 native Karma",
                desc: "The certification fee is charged once.",
              },
            ].map((r, i) => (
              <article className={r.met ? "met" : ""} key={i}>
                <span>{r.met ? <Check size={16} /> : <Lock size={15} />}</span>
                <div>
                  <h3>{r.label}</h3>
                  <p>{r.desc}</p>
                </div>
              </article>
            ))}
          </div>
          <div className="opposing-practice">
            <div>
              <h3>An isolated practice trial</h3>
              <p>
                Stand near the training effigy. The temporary spell can affect
                only that target and expires after two minutes.
              </p>
            </div>
            <select
              aria-label="Opposing practice branch"
              value={practice}
              onChange={(e) => setPractice(e.target.value)}
            >
              {BRANCHES.filter(
                (b) =>
                  (b.currency === "good") ===
                  (state.player.lineage === "demon"),
              ).map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <button
              className="outline-button"
              onClick={() => {
                if (call("beginOpposingPractice", practice)) close();
              }}
            >
              Begin practice <Sparkles size={12} />
            </button>
          </div>
          {cert.practiceTrial && (
            <div className="practice-trial-status">
              <Sparkles size={18} />
              <span>
                Trial active · {Math.ceil(cert.practiceTrial.remaining)} seconds
                · select the effigy and press Q
              </span>
              <button onClick={close}>
                Return to practice <ArrowRight size={12} />
              </button>
            </div>
          )}
          <div className="certification-final">
            <button
              className="outline-button"
              onClick={() => open("contracts")}
            >
              <Users size={13} /> Find a cooperative contract
            </button>
            <button
              className="primary-button"
              disabled={!cert.eligible || cert.certified}
              onClick={() => call("certifyCrossAffinity")}
            >
              {cert.certified
                ? "Certification complete"
                : "Complete certification · 500 Karma"}{" "}
              <Check size={13} />
            </button>
          </div>
        </>
      )}
      {tab === "recovery" && (
        <>
          <div className="systems-section-intro">
            <Heart size={29} />
            <div>
              <h3>A fallen identity can be recovered.</h3>
              <p>
                Ordinary ally revival takes four seconds and returns 25%
                vitality. Defeat recall returns 50%. Tenebrous Rebirth is a
                distinct learned power with a five-second preparation, 40
                Essence cost, and 60-second cooldown.
              </p>
            </div>
          </div>
          <div className="fallen-identities">
            {(recovery.fallen || []).map((f) => (
              <article key={f.deathKey}>
                <div>
                  <span className="eyebrow">
                    {f.revived ? "RECOVERED" : "FALLEN IDENTITY"}
                  </span>
                  <h3>{f.name}</h3>
                  <p>
                    {f.eligibility?.reason ||
                      `${Math.ceil(f.remaining)} seconds of local eligibility remain.`}
                  </p>
                </div>
                <button
                  className="outline-button"
                  disabled={!f.eligibility?.valid}
                  onClick={() => {
                    if (call("resurrectNPC", f.entityId)) close();
                  }}
                >
                  Prepare Tenebrous Rebirth <Heart size={12} />
                </button>
              </article>
            ))}
          </div>
          {!(recovery.fallen || []).length && (
            <div className="empty-system">
              <Heart size={30} />
              <h3>No fallen identity is waiting here.</h3>
              <p>
                Recovery preserves identity and settled rewards. Resurrecting a
                creature does not create another loot or Karma claim.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
