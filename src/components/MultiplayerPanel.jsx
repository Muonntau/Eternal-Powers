import { assetUrl } from "../assetUrl.js";
import React, { useEffect, useState } from "react";
import {
  Users,
  Link2,
  ArrowRight,
  Check,
  X,
  Shield,
  Lock,
  Send,
  Handshake,
  ShoppingBag,
  Coins,
  Copy,
  Unplug,
  RefreshCw,
  Package,
  Eye,
} from "lucide-react";

const number = (value) => Math.max(0, Math.floor(Number(value) || 0));
const displayOffer = (offer, items = {}) =>
  [
    ...Object.entries(offer?.items || {}).map(
      ([id, n]) => `${n} ${items[id]?.name || id}`,
    ),
    ...["goodKarma", "badKarma"]
      .filter((key) => offer?.[key])
      .map(
        (key) => `${offer[key]} ${key === "goodKarma" ? "Good" : "Bad"} Karma`,
      ),
  ].join(" + ") || "No assets offered";
export default function MultiplayerPanel({ client, state: provided }) {
  const [live, setLive] = useState(client?.getState?.() || provided || {}),
    [tab, setTab] = useState("party"),
    [name, setName] = useState("Wayfarer"),
    [roomName, setRoomName] = useState("A Shared Eternity"),
    [roomCode, setRoomCode] = useState(""),
    [importCheckpoint, setImportCheckpoint] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [chat, setChat] = useState(""),
    [tradeId, setTradeId] = useState(null),
    [offerItem, setOfferItem] = useState("draught"),
    [offerCount, setOfferCount] = useState(1),
    [offerGood, setOfferGood] = useState(0),
    [offerBad, setOfferBad] = useState(0),
    [listingItem, setListingItem] = useState("draught"),
    [listingQuantity, setListingQuantity] = useState(1),
    [listingPrice, setListingPrice] = useState(25),
    [listingCurrency, setListingCurrency] = useState("goodKarma");
  useEffect(() => client?.subscribe?.(setLive), [client]);
  if (import.meta.env?.VITE_STATIC_HOST === "true") {
    return (
      <div className="multiplayer-content">
        <div className="network-banner">
          <div>
            <span className="eyebrow">THE PUBLIC SOLO EDITION</span>
            <h3>Your own eternity, anywhere.</h3>
            <p>
              Explore the full solo campaign, keep your journey in this browser,
              and download the game for offline play in Settings.
            </p>
          </div>
          <div className="network-status">
            <i />
            <span>SOLO WORLD</span>
          </div>
        </div>
        <div className="network-intro">
          <Users size={30} />
          <h3>Bring friends to a private world.</h3>
          <p>
            Private co-op, player trading, and the shared market need a running
            game server. They are included in the repository version.
          </p>
          <a
            className="outline-button"
            href="https://github.com/Muonntau/Eternal-Powers#private-worlds-and-saves"
            target="_blank"
            rel="noreferrer"
          >
            Set up private co-op <ArrowRight size={13} />
          </a>
        </div>
      </div>
    );
  }
  const net = provided?.room ? provided : live,
    connected = net.status === "connected" && !!net.room,
    player = client?.engine?.player || {},
    items =
      client?.latest?.game?.shop?.items || client?.latest?.game?.items || {},
    inventory = player.inventory || {},
    self = net.selfId;
  const trade =
      (net.trades || []).find((t) => t.id === tradeId && t.status === "open") ||
      (net.trades || []).find((t) => t.status === "open"),
    otherId = trade?.players?.find((id) => id !== self),
    peerName = (id) =>
      (net.players || []).find((p) => p.id === id)?.name || "Traveler";
  const ownOffer = trade?.offers?.[self] || {
    items: {},
    goodKarma: 0,
    badKarma: 0,
  };
  async function perform(fn) {
    setBusy(true);
    setError("");
    try {
      return await fn();
    } catch (e) {
      setError(e.message || "That action could not be completed.");
      return false;
    } finally {
      setBusy(false);
    }
  }
  function rpc(action, payload) {
    return perform(() => client.request(action, payload));
  }
  async function connect(mode) {
    await perform(async () => {
      await client.connectSession({ name, importCheckpoint });
      if (mode === "create") await client.createRoom(roomName);
      else await client.joinRoom(roomCode);
    });
  }
  function setTrade(t) {
    setTradeId(t.id);
    setTab("trade");
    setOfferGood(t.offers?.[self]?.goodKarma || 0);
    setOfferBad(t.offers?.[self]?.badKarma || 0);
  }
  const owned = Object.keys(inventory).filter((id) => inventory[id] > 0);
  return (
    <div className="multiplayer-content">
      <div className="network-banner">
        <div>
          <span className="eyebrow">PRIVATE CO-OP · UP TO FOUR TRAVELERS</span>
          <h3>{connected ? net.room.name : "Make a shared eternity."}</h3>
          <p>
            {connected
              ? "The server records your shared world, character, exchanges, and building permissions. The owner leads travel for the whole party."
              : "Invite people you choose with a private world code. Your solo journey stays separate and returns when you leave."}
          </p>
        </div>
        <div className={`network-status ${connected ? "connected" : ""}`}>
          <i />
          <span>
            {connected
              ? "CONNECTED"
              : net.status === "connecting"
                ? "CONNECTING"
                : "SOLO WORLD"}
          </span>
          {connected && <strong>{net.room.code}</strong>}
        </div>
      </div>
      {(error || net.error) && (
        <div className="network-error">
          <Eye size={14} />
          <span>{error || net.error}</span>
          <button
            aria-label="Dismiss network message"
            onClick={() => {
              setError("");
              client?.emit?.({ error: null });
            }}
          >
            <X size={13} />
          </button>
        </div>
      )}
      {!connected ? (
        <div className="network-connect">
          <div className="network-intro">
            <Users size={30} />
            <h3>A real party. A persistent private world.</h3>
            <p>
              Movement and resource changes are accepted by the world server.
              Each participant retains personal progression; shared outcomes and
              exchanges settle once.
            </p>
            <div className="network-server-note">
              <Shield size={15} />
              <span>
                Run <code>npm run server</code> alongside the development
                server, or use <code>npm start</code> after a production build.
                Default world-server port: 5176.
              </span>
            </div>
          </div>
          <div className="network-connect-grid">
            <section>
              <span className="eyebrow">YOUR SHARED-WORLD IDENTITY</span>
              <label>
                Display name
                <input
                  maxLength={24}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Wayfarer"
                />
              </label>
              {!client?.account && (
                <label className="network-checkbox">
                  <input
                    type="checkbox"
                    checked={importCheckpoint}
                    onChange={(e) => setImportCheckpoint(e.target.checked)}
                  />
                  <span>
                    Import this solo character once into a new shared identity.
                    Ongoing wallet and inventory changes are server-owned.
                  </span>
                </label>
              )}
              {client?.account && (
                <div className="saved-network-identity">
                  <Check size={13} /> Saved identity: {client.account.name}. Its
                  server character is restored on reconnect.
                </div>
              )}
              <h3>Host a private world</h3>
              <label>
                World name
                <input
                  maxLength={40}
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                />
              </label>
              <button
                className="primary-button full"
                disabled={busy || !client}
                onClick={() => connect("create")}
              >
                Create private world <Users size={13} />
              </button>
            </section>
            <section>
              <span className="eyebrow">INVITATION ONLY</span>
              <h3>Join a fellow traveler</h3>
              <p>
                Enter their six-character world code. Joining grants visitor
                rights; the owner decides who may build.
              </p>
              <label>
                World code
                <input
                  className="world-code-input"
                  value={roomCode}
                  maxLength={6}
                  onChange={(e) =>
                    setRoomCode(
                      e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""),
                    )
                  }
                  placeholder="ABC123"
                />
              </label>
              <button
                className="outline-button full"
                disabled={busy || roomCode.length !== 6 || !client}
                onClick={() => connect("join")}
              >
                Join private world <Link2 size={13} />
              </button>
              <div className="network-privacy">
                <Lock size={18} />
                <p>
                  The code is a private invitation, not a public listing. Keep
                  your browser’s session token and save backups private.
                </p>
              </div>
            </section>
          </div>
        </div>
      ) : (
        <>
          <div className="network-room-bar">
            <div>
              <span className="eyebrow">YOUR INVITATION CODE</span>
              <strong>{net.room.code}</strong>
              <button
                className="icon-button"
                title="Copy private world code"
                onClick={() =>
                  perform(async () => {
                    await navigator.clipboard.writeText(net.room.code);
                    return true;
                  })
                }
              >
                <Copy size={13} />
              </button>
            </div>
            <div>
              <span>
                {(net.players || []).filter((p) => p.connected).length} /{" "}
                {net.room.capacity || 4} travelers
              </span>
              <button
                className="outline-button"
                onClick={() => perform(() => client.disconnect())}
              >
                <Unplug size={12} /> Return to solo journey
              </button>
            </div>
          </div>
          <div className="realm-tabs network-tabs">
            {[
              { id: "party", label: "Party & permissions", icon: Users },
              { id: "trade", label: "Locked exchange", icon: Handshake },
              { id: "market", label: "Private marketplace", icon: ShoppingBag },
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
          {tab === "party" && (
            <div className="network-party-layout">
              <div className="network-roster">
                {(net.players || []).map((p) => (
                  <article key={p.id} className={!p.connected ? "offline" : ""}>
                    <div className="network-player-avatar">
                      <img
                        src={
                          p.lineage === "demon"
                            ? assetUrl("/assets/hero-demon-down-0.png")
                            : assetUrl("/assets/hero-down-0.png")
                        }
                        alt=""
                      />
                    </div>
                    <div>
                      <h3>
                        {p.name}
                        {p.id === self && <small>YOU</small>}
                      </h3>
                      <p>
                        Rank {p.rank} · {p.role} ·{" "}
                        {p.connected ? "Present" : "Away"}
                      </p>
                      <span>
                        {Math.ceil(p.health)} / {p.maxHealth} vitality
                      </span>
                    </div>
                    <div>
                      {net.role === "owner" && p.id !== self && (
                        <select
                          aria-label={`Permission for ${p.name}`}
                          value={p.role}
                          onChange={(e) =>
                            rpc("role", {
                              targetId: p.id,
                              role: e.target.value,
                            })
                          }
                        >
                          {[
                            "visitor",
                            "user",
                            "contributor",
                            "builder",
                            "steward",
                          ].map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                      )}
                      {p.id !== self && p.connected && (
                        <button
                          className="outline-button"
                          onClick={() =>
                            perform(async () => {
                              const t = await client.request("trade.invite", {
                                targetId: p.id,
                              });
                              setTrade(t);
                            })
                          }
                        >
                          Trade <Handshake size={12} />
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
              <section className="party-chat">
                <div className="section-caption">
                  PARTY CHAT <span>EXPLICIT MESSAGES ONLY</span>
                </div>
                <div className="party-chat-messages">
                  {(net.chat || []).map((m) => (
                    <div
                      key={m.id}
                      className={m.playerId === self ? "own" : ""}
                    >
                      <strong>{m.name}</strong>
                      <p>{m.text}</p>
                    </div>
                  ))}
                  {!net.chat?.length && (
                    <p className="network-empty-note">
                      Messages appear here only after you choose Send.
                    </p>
                  )}
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!chat.trim()) return;
                    perform(async () => {
                      await client.request("chat", { text: chat });
                      setChat("");
                    });
                  }}
                >
                  <input
                    value={chat}
                    maxLength={240}
                    onChange={(e) => setChat(e.target.value)}
                    aria-label="Party message"
                    placeholder="Write to your party…"
                  />
                  <button
                    type="submit"
                    className="outline-button"
                    disabled={!chat.trim() || busy}
                  >
                    <Send size={12} /> Send
                  </button>
                </form>
              </section>
            </div>
          )}
          {tab === "trade" && (
            <div className="network-trade">
              <div className="systems-section-intro">
                <Handshake size={28} />
                <div>
                  <h3>Two offers. Two locks. Two confirmations.</h3>
                  <p>
                    Changing an offer releases both reservations. Disconnecting
                    or waiting too long cancels an open exchange and returns its
                    escrow.
                  </p>
                </div>
              </div>
              {trade ? (
                <>
                  <div className="player-trade-sides">
                    <section>
                      <span className="eyebrow">
                        YOUR OFFER · {peerName(self)}
                      </span>
                      <h3>{displayOffer(ownOffer, items)}</h3>
                      <div className="network-offer-items">
                        {Object.entries(ownOffer.items).map(([id, n]) => (
                          <div key={id}>
                            <span>
                              {n} {items[id]?.name || id}
                            </span>
                            <button
                              aria-label={`Remove ${id} from offer`}
                              onClick={() => {
                                const next = { ...ownOffer.items };
                                delete next[id];
                                rpc("trade.offer", {
                                  id: trade.id,
                                  offer: { ...ownOffer, items: next },
                                });
                              }}
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                      <div className="network-offer-builder">
                        <select
                          aria-label="Offered item"
                          value={offerItem}
                          onChange={(e) => setOfferItem(e.target.value)}
                        >
                          {[...new Set([offerItem, ...owned])].map((id) => (
                            <option key={id} value={id}>
                              {items[id]?.name || id} ({inventory[id] || 0})
                            </option>
                          ))}
                        </select>
                        <input
                          aria-label="Offered item quantity"
                          type="number"
                          min="1"
                          max="999"
                          value={offerCount}
                          onChange={(e) =>
                            setOfferCount(number(e.target.value))
                          }
                        />
                        <button
                          className="outline-button"
                          onClick={() =>
                            rpc("trade.offer", {
                              id: trade.id,
                              offer: {
                                ...ownOffer,
                                items: {
                                  ...ownOffer.items,
                                  [offerItem]: offerCount,
                                },
                              },
                            })
                          }
                        >
                          <Package size={12} /> Add
                        </button>
                      </div>
                      <div className="network-karma-offer">
                        <label>
                          Good Karma
                          <input
                            type="number"
                            min="0"
                            value={offerGood}
                            onChange={(e) =>
                              setOfferGood(number(e.target.value))
                            }
                          />
                        </label>
                        <label>
                          Bad Karma
                          <input
                            type="number"
                            min="0"
                            value={offerBad}
                            onChange={(e) =>
                              setOfferBad(number(e.target.value))
                            }
                          />
                        </label>
                        <button
                          className="outline-button"
                          onClick={() =>
                            rpc("trade.offer", {
                              id: trade.id,
                              offer: {
                                ...ownOffer,
                                goodKarma: offerGood,
                                badKarma: offerBad,
                              },
                            })
                          }
                        >
                          Update offer <RefreshCw size={12} />
                        </button>
                      </div>
                      <div className="trade-lock-state">
                        {trade.locks[self] ? (
                          <>
                            <Lock size={13} /> Your offer is locked in escrow
                          </>
                        ) : (
                          <>
                            <Eye size={13} /> Your offer is open for review
                          </>
                        )}
                      </div>
                    </section>
                    <section>
                      <span className="eyebrow">
                        THEIR OFFER · {peerName(otherId)}
                      </span>
                      <h3>{displayOffer(trade.offers[otherId], items)}</h3>
                      <div className="trade-lock-state">
                        {trade.locks[otherId] ? (
                          <>
                            <Lock size={13} /> Their offer is locked
                          </>
                        ) : (
                          <>
                            <Eye size={13} /> Waiting for their lock
                          </>
                        )}
                      </div>
                      {trade.confirmations[otherId] && (
                        <div className="network-confirmed">
                          <Check size={13} /> Their final confirmation is
                          recorded
                        </div>
                      )}
                    </section>
                  </div>
                  <div className="network-trade-actions">
                    <button
                      className="subtle-button"
                      onClick={() => rpc("trade.cancel", { id: trade.id })}
                    >
                      Cancel exchange <X size={12} />
                    </button>
                    {!trade.locks[self] ? (
                      <button
                        className="primary-button"
                        onClick={() => rpc("trade.lock", { id: trade.id })}
                      >
                        Lock my offer <Lock size={13} />
                      </button>
                    ) : (
                      <button
                        className="primary-button"
                        disabled={
                          !trade.players.every((id) => trade.locks[id]) ||
                          trade.confirmations[self]
                        }
                        onClick={() => rpc("trade.confirm", { id: trade.id })}
                      >
                        {trade.confirmations[self]
                          ? "Confirmation recorded"
                          : "Confirm final exchange"}{" "}
                        <Check size={13} />
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <div className="empty-system">
                  <Handshake size={30} />
                  <h3>No exchange is open.</h3>
                  <p>
                    Choose Trade beside a connected traveler in the party
                    roster.
                  </p>
                </div>
              )}
              <div className="network-settlements">
                {(net.trades || [])
                  .filter((t) => t.status !== "open")
                  .slice()
                  .reverse()
                  .map((t) => (
                    <article key={t.id}>
                      <strong>
                        {t.status === "complete"
                          ? "Exchange completed"
                          : "Exchange cancelled"}
                      </strong>
                      <span>
                        {t.reason ||
                          "Both offers settled once. Lifetime earned Karma is unchanged."}
                      </span>
                    </article>
                  ))}
              </div>
            </div>
          )}
          {tab === "market" && (
            <div className="private-market">
              <div className="systems-section-intro">
                <ShoppingBag size={27} />
                <div>
                  <h3>A posted offer can wait for a buyer.</h3>
                  <p>
                    Items leave your pack when listed. A completed sale settles
                    once and pays the seller after a 5% fee; resale never raises
                    lifetime earnings.
                  </p>
                </div>
              </div>
              <div className="market-list-form">
                <label>
                  Item
                  <select
                    value={listingItem}
                    onChange={(e) => setListingItem(e.target.value)}
                  >
                    {[...new Set([listingItem, ...owned])].map((id) => (
                      <option key={id} value={id}>
                        {items[id]?.name || id} ({inventory[id] || 0})
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Quantity
                  <input
                    type="number"
                    min="1"
                    max="99"
                    value={listingQuantity}
                    onChange={(e) => setListingQuantity(number(e.target.value))}
                  />
                </label>
                <label>
                  Total price
                  <input
                    type="number"
                    min="1"
                    value={listingPrice}
                    onChange={(e) => setListingPrice(number(e.target.value))}
                  />
                </label>
                <label>
                  Currency
                  <select
                    value={listingCurrency}
                    onChange={(e) => setListingCurrency(e.target.value)}
                  >
                    <option value="goodKarma">Good Karma</option>
                    <option value="badKarma">Bad Karma</option>
                  </select>
                </label>
                <button
                  className="primary-button"
                  onClick={() =>
                    rpc("market.list", {
                      itemId: listingItem,
                      quantity: listingQuantity,
                      price: listingPrice,
                      currency: listingCurrency,
                    })
                  }
                >
                  Post listing <ShoppingBag size={12} />
                </button>
              </div>
              <div className="market-listings">
                {(net.market || []).map((l) => (
                  <article key={l.id}>
                    <div>
                      <span className="eyebrow">
                        {l.sellerId === self
                          ? "YOUR LISTING"
                          : peerName(l.sellerId)}
                      </span>
                      <h3>
                        {l.quantity} × {items[l.itemId]?.name || l.itemId}
                      </h3>
                      <p>
                        {l.price} {l.currency === "badKarma" ? "Bad" : "Good"}{" "}
                        Karma
                      </p>
                    </div>
                    <button
                      className="outline-button"
                      onClick={() =>
                        rpc(
                          l.sellerId === self ? "market.cancel" : "market.buy",
                          { id: l.id },
                        )
                      }
                    >
                      {l.sellerId === self
                        ? "Cancel listing"
                        : "Buy posted offer"}{" "}
                      <ArrowRight size={12} />
                    </button>
                  </article>
                ))}
                {!net.market?.length && (
                  <p className="network-empty-note">
                    No open listings in this private world.
                  </p>
                )}
              </div>
            </div>
          )}
          <details className="network-receipts">
            <summary>Server receipts · {(net.receipts || []).length}</summary>
            {(net.receipts || []).slice(0, 15).map((r) => (
              <div key={r.id}>
                <span>{r.type}</span>
                <small>{r.id}</small>
              </div>
            ))}
          </details>
        </>
      )}
    </div>
  );
}
