import { assetUrl } from "../assetUrl.js";
import React from "react";
import {
  Sparkles,
  Lock,
  Check,
  ArrowRight,
  Sun,
  Moon,
  Feather,
  Plus,
  Flame,
  Shield,
  Play,
} from "lucide-react";
import { BRANCHES, ENHANCEMENTS, TECHNIQUES } from "../data/manual.js";

export default function AdvancedPowers({
  tab,
  player,
  state,
  call,
  close,
  onTrials,
}) {
  const certified = !!player.certified;
  return (
    <div className="advanced-powers">
      {tab === "enhancements" ? (
        <>
          <div className="advanced-intro">
            <Sparkles size={24} />
            <div>
              <h3>A little more extraordinary.</h3>
              <p>
                Train five ranks in each enhancement path. Equip one learned
                modifier per branch; its effects replace other modifiers from
                that track.
              </p>
            </div>
          </div>
          <div className="enhancement-grid">
            {ENHANCEMENTS.map((track) => {
              const learned = player.enhancements?.[track.id] || 0;
              const branch = BRANCHES.find((b) => b.id === track.branchId);
              const next = track.ranks[learned];
              return (
                <article className="enhancement-card" key={track.id}>
                  <div className="enhancement-heading">
                    <img src={assetUrl(`/assets/power-${track.branchId}.png`)} alt="" />
                    <div>
                      <span className="eyebrow">{branch?.name}</span>
                      <h3>{track.name}</h3>
                    </div>
                    <span className="track-count">{learned}/5</span>
                  </div>
                  <div className="enhancement-ranks">
                    {track.ranks.map((r) => {
                      const isLearned = learned >= r.rank;
                      const equipped =
                        player.enhancementSelection?.[track.id] === r.rank;
                      return (
                        <div key={r.id} className={isLearned ? "learned" : ""}>
                          <img
                            className="rank-art"
                            src={assetUrl(`/assets/enhancement-icons/${r.id}.png`)}
                            alt=""
                          />
                          <span className="enhancement-rank">
                            {isLearned ? <Check size={11} /> : r.rank}
                          </span>
                          <div>
                            <h4>{r.name}</h4>
                            <p>{r.effect}</p>
                            <small>
                              CELESTIAL RANK {r.requiredRank} · {r.trainingCost}{" "}
                              {track.currency} karma
                            </small>
                          </div>
                          {isLearned && (
                            <button
                              className={equipped ? "equipped" : ""}
                              onClick={() =>
                                call("equipEnhancement", track.id, r.rank)
                              }
                            >
                              {equipped ? "Equipped" : "Equip"}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {next ? (
                    <button
                      className="outline-button full"
                      onClick={() => call("trainEnhancement", track.id)}
                    >
                      <Plus size={13} /> Train {next.name}{" "}
                      <span>· {next.trainingCost} karma</span>
                    </button>
                  ) : (
                    <div className="mastered">
                      <Check size={13} /> Enhancement path mastered
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </>
      ) : (
        <>
          <div className="certification-card">
            <div className="certification-symbol">
              <Feather size={25} />
              <Flame size={25} />
            </div>
            <div>
              <span className="eyebrow">BEYOND YOUR NATIVE AFFINITY</span>
              <h3>
                {certified
                  ? "A world of new possibilities"
                  : "Cross-affinity certification"}
              </h3>
              <p>
                {certified
                  ? "Both wallets and opposing-domain training are open to you. Train techniques in order within each domain."
                  : "At celestial rank 3, complete the opposing practice and cooperation trials, then invest 500 native karma to unlock both affinities."}
              </p>
            </div>
            {certified ? (
              <span className="certified-tag">
                <Check size={12} /> CERTIFIED
              </span>
            ) : (
              <button className="outline-button" onClick={() => onTrials?.()}>
                <Shield size={13} /> Review affinity trials
              </button>
            )}
          </div>
          <div className="technique-intro">
            <h3>
              {player.lineage === "angel" ? "Angelic" : "Demonic"}{" "}
              cross-affinity techniques
            </h3>
            <span>20 ESSENCE · 1 SECOND PREPARATION · 20 SECOND COOLDOWN</span>
          </div>
          <div className="technique-grid">
            {TECHNIQUES.filter((t) => t.lineage === player.lineage).map((t) => {
              const learned = player.techniques?.includes(t.id);
              return (
                <article
                  className={`technique-card ${learned ? "learned" : ""}`}
                  key={t.id}
                >
                  <div className="technique-heading">
                    <span>
                      {String(t.order).padStart(2, "0")} / {t.domain}
                    </span>
                    {learned ? <Check size={12} /> : <Lock size={12} />}
                  </div>
                  <img
                    className="technique-card-icon"
                    src={assetUrl(`/assets/technique-icons/${t.id}.png`)}
                    alt=""
                  />
                  <h3>{t.name}</h3>
                  <p>{t.effect}</p>
                  <small>{t.target}</small>
                  <button
                    className="outline-button full"
                    onClick={() => {
                      if (learned) {
                        call("setPaused", false);
                        close();
                        call("useTechnique", t.id);
                      } else call("trainTechnique", t.id);
                    }}
                  >
                    {learned ? (
                      <>
                        <Play size={12} /> Activate technique
                      </>
                    ) : (
                      <>
                        <Plus size={12} /> Train · {t.trainingCost} {t.currency}{" "}
                        karma
                      </>
                    )}
                  </button>
                </article>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
