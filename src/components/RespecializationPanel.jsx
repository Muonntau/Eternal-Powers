import React, { useEffect, useRef, useState } from "react";
import { RotateCcw, Check, X } from "lucide-react";

export default function RespecializationPanel({ branch, player, state, call }) {
  const current = player.learned?.[branch.id] || 0;
  const [retained, setRetained] = useState(Math.max(0, current - 1));
  const [quote, setQuote] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const generation = useRef(0);
  useEffect(() => {
    generation.current++;
    setBusy(false);
    setRetained(Math.max(0, current - 1));
    setQuote(null);
    setMessage("");
    return () => {
      generation.current++;
    };
  }, [branch.id, current]);
  const blocked = state.respecialization?.contextReason;
  async function preview() {
    const requestGeneration = generation.current;
    setBusy(true);
    try {
      const result = await call("previewRespecialization", branch.id, retained);
      if (requestGeneration !== generation.current) return;
      setQuote(result || null);
      setMessage(
        result?.reason || (result ? "" : "The preview could not be prepared."),
      );
    } finally {
      if (requestGeneration === generation.current) setBusy(false);
    }
  }
  async function confirm() {
    setBusy(true);
    try {
      const receipt = await call("commitRespecialization", quote.id);
      if (receipt) {
        setQuote(null);
        setMessage(
          `${receipt.refund.toLocaleString()} ${receipt.currency} Karma returned.`,
        );
      } else {
        setQuote(null);
        setMessage(
          "The preview changed. Review a fresh preview before continuing.",
        );
      }
    } finally {
      setBusy(false);
    }
  }
  if (!current) return null;
  return (
    <details className="respecialization-panel">
      <summary>
        <RotateCcw size={13} /> Respecialize this branch
      </summary>
      <p>
        Retain a lower level and review every removed power before confirming.
        Unused purchases in this session return their recorded price; used or
        earlier purchases return 80%. Rank and lifetime earnings stay with you.
      </p>
      <div className="respecialization-controls">
        <label>
          Retain through level
          <select
            value={retained}
            disabled={busy}
            onChange={(e) => {
              setRetained(Number(e.target.value));
              setQuote(null);
              setMessage("");
            }}
          >
            {Array.from({ length: current }, (_, level) => (
              <option key={level} value={level}>
                {level === 0 ? "0 · Remove branch" : level}
              </option>
            ))}
          </select>
        </label>
        <button
          className="outline-button"
          disabled={busy || !!blocked}
          onClick={preview}
        >
          Preview refund
        </button>
      </div>
      {blocked && <p className="respecialization-status">{blocked}</p>}
      {quote?.valid && (
        <div className="respecialization-quote">
          <h4>
            Remove {quote.removed.length} unlocks · retain level{" "}
            {quote.targetLevel}
          </h4>
          <ul>
            {quote.removed.map((row) => (
              <li key={row.id}>
                <span>
                  {row.name}
                  <small>{row.reason}</small>
                </span>
                <strong>
                  {row.refund.toLocaleString()}
                  <small>{quote.currency} Karma</small>
                </strong>
              </li>
            ))}
          </ul>
          {quote.unequipEnhancement && (
            <p>
              {quote.unequipEnhancement.name} will be unequipped. Its training
              remains learned.
            </p>
          )}
          <div className="respecialization-total">
            Total refund{" "}
            <strong>
              {quote.refund.toLocaleString()} {quote.currency} Karma
            </strong>
          </div>
          <div className="respecialization-actions">
            <button
              className="outline-button"
              disabled={busy}
              onClick={async () => {
                await call("cancelRespecialization", quote.id);
                setQuote(null);
              }}
            >
              <X size={12} /> Cancel
            </button>
            <button
              className="primary-button"
              disabled={busy}
              onClick={confirm}
            >
              <Check size={12} /> Confirm respecialization
            </button>
          </div>
        </div>
      )}
      {message && (
        <p role="status" className="respecialization-status">
          {message}
        </p>
      )}
    </details>
  );
}
