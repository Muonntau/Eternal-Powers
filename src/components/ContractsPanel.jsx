import React, { useState } from "react";
import {
  ScrollText,
  Compass,
  ArrowRight,
  Check,
  Lock,
  MapPin,
  Handshake,
  Package,
  Shield,
  Heart,
  Users,
  Coins,
  X,
  Play,
  Award,
} from "lucide-react";

export default function ContractsPanel({ state, call, close }) {
  const [tab, setTab] = useState("campaign"),
    [selectedId, setSelectedId] = useState(null),
    [preview, setPreview] = useState(null),
    [quote, setQuote] = useState(null),
    [dialogue, setDialogue] = useState(null);
  const data = state.contracts || {},
    offers = data.offers || [],
    active = data.active || [],
    completed = data.completed || [],
    party = data.party || [],
    campaign = data.campaign || {},
    items = state.shop?.items || state.items || {};
  const selected =
    offers.find((c) => c.id === selectedId) ||
    active.find((c) => c.id === selectedId) ||
    offers.find((c) => c.status === "active") ||
    offers.find((c) => c.status !== "complete") ||
    offers[0];
  const barterQuote =
    data.barterQuote && ["preview", "locked"].includes(data.barterQuote.status)
      ? data.barterQuote
      : quote && ["preview", "locked"].includes(quote.status)
        ? quote
        : null;
  const itemName = (id) => items[id]?.name || id;
  const offerDescription = (offer) =>
    [
      ...Object.entries(offer?.items || {}).map(
        ([id, n]) => `${n} ${itemName(id)}`,
      ),
      ...Object.entries(offer?.currencies || {}).map(
        ([id, n]) => `${n} ${/bad/i.test(id) ? "Bad" : "Good"} Karma`,
      ),
    ].join(" + ") || "No payment";
  function inspect(c) {
    setSelectedId(c.id);
    setPreview(call("previewContract", c.id) || c);
  }
  function findStep(c, s) {
    if (s.zoneId && s.zoneId !== state.zone.id) call("setZone", s.zoneId);
    const p = s.position || s;
    if (p.x != null) call("navigateTo", p.x, p.y, s.zoneId);
    else call("navigateToContract", c.id, s.id);
    close();
  }
  return (
    <div className="contracts-content">
      <div className="contracts-banner">
        <div>
          <span className="eyebrow">
            {campaign.chapter || "THE THREE REALMS"} · A WORLD IN BALANCE
          </span>
          <h3>{campaign.title || "A journey with an ending."}</h3>
          <p>
            {campaign.description ||
              "Meet the world’s inhabitants, understand their needs, and leave each place changed by your choices."}
          </p>
        </div>
        <div className="campaign-count">
          <Award size={27} />
          <strong>{completed.length}</strong>
          <span>CONTRACTS SETTLED</span>
        </div>
      </div>
      <div className="realm-tabs contracts-tabs">
        {[
          { id: "campaign", name: "Campaign & contracts", icon: ScrollText },
          { id: "barter", name: "Secure barter", icon: Handshake },
          { id: "party", name: "Companions & party", icon: Users },
        ].map((t) => (
          <button
            key={t.id}
            className={tab === t.id ? "active" : ""}
            onClick={() => setTab(t.id)}
          >
            <t.icon size={13} />
            {t.name}
          </button>
        ))}
      </div>
      {tab === "campaign" && (
        <div className="contracts-layout">
          <aside className="contract-list">
            <div className="section-caption">
              LOCAL CONTRACTS <span>{offers.length}</span>
            </div>
            {offers.map((c) => (
              <button
                className={`${selected?.id === c.id ? "active" : ""} ${c.status === "complete" ? "complete" : ""}`}
                key={c.id}
                onClick={() => inspect(c)}
              >
                <span className="contract-kind">{c.type || "OBJECTIVE"}</span>
                <h3>{c.title}</h3>
                <div>
                  <span>
                    {c.progress || 0} / {c.total || c.steps?.length || 1}
                  </span>
                  {c.status === "complete" ? (
                    <Check size={11} />
                  ) : (
                    <ArrowRight size={11} />
                  )}
                </div>
              </button>
            ))}
            {active.filter((c) => !offers.some((o) => o.id === c.id)).length >
              0 && (
              <div className="remote-contracts">
                <div className="section-caption">ACCEPTED ELSEWHERE</div>
                {active
                  .filter((c) => !offers.some((o) => o.id === c.id))
                  .map((c) => (
                    <button
                      key={c.id}
                      onClick={() => {
                        setSelectedId(c.id);
                        setPreview(c);
                      }}
                    >
                      <span>{c.title}</span>
                      <MapPin size={11} />
                    </button>
                  ))}
              </div>
            )}
          </aside>
          <div className="contract-detail">
            {selected ? (
              <>
                <span className="eyebrow">
                  {selected.type || "LOCAL OBJECTIVE"} ·{" "}
                  {selected.status || "AVAILABLE"}
                </span>
                <h3>{selected.title}</h3>
                <p>{selected.description}</p>
                <div className="contract-reward">
                  <Coins size={14} />
                  <span>
                    {typeof selected.reward === "object"
                      ? selected.reward.amount
                      : selected.reward || 25}{" "}
                    {selected.reward?.currency || selected.currency || "good"}{" "}
                    Karma
                  </span>
                  <small>
                    {selected.rewardEligible === false
                      ? "Certification required for this currency"
                      : "Personal reward · settles once"}
                  </small>
                </div>
                {(selected.requirements || preview?.requirements || []).length >
                  0 && (
                  <div className="contract-requirements">
                    {(preview?.requirements || selected.requirements).map(
                      (r, i) => (
                        <span className={r.met ? "met" : ""} key={r.id || i}>
                          {r.met ? <Check size={11} /> : <Lock size={11} />}{" "}
                          {r.label || r}
                        </span>
                      ),
                    )}
                  </div>
                )}
                <div className="contract-steps">
                  {(selected.steps || []).map((s, i) => (
                    <article
                      className={s.complete ? "complete" : ""}
                      key={s.id}
                    >
                      <span className="contract-step-number">
                        {s.complete ? (
                          <Check size={13} />
                        ) : (
                          String(i + 1).padStart(2, "0")
                        )}
                      </span>
                      <div>
                        <h4>{s.title || s.name || s.label}</h4>
                        <p>{s.description || s.instruction}</p>
                        {s.sequence?.length > 0 && (
                          <div className="mechanism-sequence">
                            <span>VISIBLE GLYPH SEQUENCE</span>
                            <strong>{s.sequence.join(" → ")}</strong>
                            <small>
                              {s.sequenceIndex || 0} / {s.sequence.length}{" "}
                              activated in order
                            </small>
                          </div>
                        )}
                        {s.materials && (
                          <small>
                            {Object.entries(s.materials)
                              .map(([id, n]) => `${n} ${itemName(id)}`)
                              .join(" · ")}
                          </small>
                        )}
                        {!s.complete && (
                          <div className="contract-step-actions">
                            <button
                              className="outline-button"
                              onClick={() => findStep(selected, s)}
                            >
                              Find objective <MapPin size={11} />
                            </button>
                            {s.choices?.length ||
                            /dialogue|negot|allocat/i.test(s.type || "") ? (
                              <button
                                className="outline-button"
                                onClick={() => {
                                  const d = call(
                                    "openContractDialogue",
                                    selected.id,
                                    s.id,
                                  );
                                  setDialogue(d || data.dialogue);
                                }}
                              >
                                Consider choices <Handshake size={11} />
                              </button>
                            ) : (
                              <button
                                className="outline-button"
                                onClick={() =>
                                  call("advanceContractStep", selected.id, s.id)
                                }
                              >
                                Perform step <Check size={11} />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
                <div className="contract-main-actions">
                  {selected.status !== "active" &&
                    selected.status !== "complete" && (
                      <button
                        className="primary-button"
                        onClick={() => call("acceptContract", selected.id)}
                      >
                        Accept contract <ScrollText size={13} />
                      </button>
                    )}
                  {selected.status === "active" && (
                    <>
                      <button
                        className="primary-button"
                        onClick={() => call("settleContract", selected.id)}
                      >
                        Settle completed contract <Check size={13} />
                      </button>
                      <button
                        className="subtle-button"
                        onClick={() => call("abandonContract", selected.id)}
                      >
                        Abandon <X size={11} />
                      </button>
                    </>
                  )}
                </div>
              </>
            ) : (
              <div className="empty-system">
                <Compass size={30} />
                <h3>Every place has a purpose.</h3>
                <p>
                  Explore a named region to discover its authored contracts.
                </p>
              </div>
            )}
            {(data.dialogue || dialogue) && (
              <div className="contract-dialogue">
                <span className="eyebrow">REVIEW THE CONSEQUENCES</span>
                <h3>
                  {(data.dialogue || dialogue).title || "Choose your approach"}
                </h3>
                <p>{(data.dialogue || dialogue).text}</p>
                <div>
                  {((data.dialogue || dialogue).choices || []).map((choice) => (
                    <button
                      key={choice.id}
                      onClick={() => {
                        call(
                          "chooseDialogue",
                          (data.dialogue || dialogue).npcId,
                          choice.id,
                        );
                        setDialogue(null);
                      }}
                    >
                      <strong>{choice.label}</strong>
                      <span>{choice.consequence || choice.description}</span>
                      <ArrowRight size={13} />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {tab === "barter" && (
        <div className="barter-content">
          <div className="systems-section-intro">
            <Handshake size={28} />
            <div>
              <h3>Both sides know what changes hands.</h3>
              <p>
                Inspect an offer, lock both sides, and commit the exchange once.
                If funds, quantities, or ownership change, the trade rejects
                without settling.
              </p>
            </div>
          </div>
          <div className="barter-trader">
            <span className="eyebrow">
              {data.trader?.name || "THE SANCTUARY FACTOR"}
            </span>
            <button
              className="outline-button"
              onClick={() => {
                if (data.trader)
                  call("navigateTo", data.trader.x, data.trader.y);
                close();
              }}
            >
              Meet the trader <MapPin size={12} />
            </button>
          </div>
          <div className="barter-offers">
            {(data.barterOffers || []).map((o) => (
              <article key={o.id}>
                <h3>{o.name}</h3>
                <div className="barter-sides">
                  <div>
                    <span>YOU OFFER</span>
                    <p>{offerDescription(o.playerOffer)}</p>
                  </div>
                  <ArrowRight size={18} />
                  <div>
                    <span>YOU RECEIVE</span>
                    <p>{offerDescription(o.npcOffer)}</p>
                  </div>
                </div>
                <button
                  className="outline-button full"
                  onClick={async () =>
                    setQuote(await call("previewBarter", data.trader?.id, o.id))
                  }
                >
                  Inspect exchange <Compass size={12} />
                </button>
              </article>
            ))}
          </div>
          {barterQuote && (
            <div className="transaction-preview">
              <h3>Locked exchange preview</h3>
              <p>
                {barterQuote.reason ||
                  "The posted quantities and currencies are reserved only when both sides lock."}
              </p>
              <div className="barter-sides">
                <div>
                  <span>YOU OFFER</span>
                  <p>{offerDescription(barterQuote.playerOffer)}</p>
                </div>
                <ArrowRight size={18} />
                <div>
                  <span>YOU RECEIVE</span>
                  <p>{offerDescription(barterQuote.npcOffer)}</p>
                </div>
              </div>
              <div>
                <button
                  className="subtle-button"
                  onClick={() => {
                    call("cancelBarter", barterQuote.id);
                    setQuote(null);
                  }}
                >
                  Cancel
                </button>
                {barterQuote.status === "locked" ? (
                  <button
                    className="primary-button"
                    onClick={() => {
                      call("commitBarter", barterQuote.id);
                      setQuote(null);
                    }}
                  >
                    Commit exchange <Check size={13} />
                  </button>
                ) : (
                  <button
                    className="primary-button"
                    disabled={barterQuote.valid === false}
                    onClick={async () =>
                      setQuote(await call("lockBarter", barterQuote.id))
                    }
                  >
                    Lock offer <Lock size={13} />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
      {tab === "party" && (
        <div className="contract-party">
          <div className="systems-section-intro">
            <Users size={28} />
            <div>
              <h3>Take the road together.</h3>
              <p>
                Invite a local ally to follow, wait, assist, or defend. Their
                support complements your own powers and your bonded familiar.
              </p>
            </div>
          </div>
          <div className="hire-ally-grid">
            {[
              {
                id: "guardian",
                title: "Guardian",
                icon: Shield,
                desc: "Protects the party and holds a defensive position.",
              },
              {
                id: "medic",
                title: "Medic",
                icon: Heart,
                desc: "Supports injured allies during encounters.",
              },
              {
                id: "scout",
                title: "Scout",
                icon: Compass,
                desc: "Assists with exploration and target awareness.",
              },
            ].map((a) => (
              <article key={a.id}>
                <a.icon size={30} />
                <h3>{a.title}</h3>
                <p>{a.desc}</p>
                <button
                  className="outline-button full"
                  onClick={() => call("hireAlly", a.id)}
                >
                  Invite ally ·{" "}
                  {data.hireOffers?.find((o) => o.role === a.id)?.price || 75}{" "}
                  karma <Users size={12} />
                </button>
              </article>
            ))}
          </div>
          <div className="allied-party">
            {party.map((a) => (
              <article key={a.id}>
                <div>
                  <span className="eyebrow">{a.role}</span>
                  <h3>{a.name}</h3>
                  <p>
                    {a.command || a.state || "Following"} ·{" "}
                    {Math.ceil(a.health || 100)} vitality
                  </p>
                </div>
                <div>
                  {["follow", "wait", "assist", "defend", "return"].map(
                    (command) => (
                      <button
                        key={command}
                        className={a.command === command ? "active" : ""}
                        onClick={() => call("commandAlly", a.id, command)}
                      >
                        {command}
                      </button>
                    ),
                  )}
                </div>
              </article>
            ))}
          </div>
          {!party.length && (
            <p className="party-note">
              Meet allies near a sanctuary hub. Invitations and commands never
              remove your own ability to leave.
            </p>
          )}
        </div>
      )}
      {data.ending && (
        <div className="campaign-ending">
          <Award size={35} />
          <span className="eyebrow">THE THREE REALMS · CAMPAIGN COMPLETE</span>
          <h3>{data.ending.title || "An eternal world, shaped by you."}</h3>
          <p>
            {data.ending.description ||
              "Your contracts and celestial trials are recorded. Your world remains open for exploration, restoration, and new creations."}
          </p>
        </div>
      )}
    </div>
  );
}
