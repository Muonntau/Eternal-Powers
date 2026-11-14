import { assetUrl } from "../assetUrl.js";
import React, { useEffect, useState } from "react";
import {
  Hammer,
  Home,
  RotateCcw,
  RotateCw,
  ArrowRight,
  Plus,
  Save,
  Package,
  Shield,
  Leaf,
  Gem,
  Check,
  X,
  Trash2,
  MapPin,
  ArrowDown,
  ArrowUp,
  Wrench,
} from "lucide-react";

const itemAsset = (id) =>
  assetUrl(`/assets/item-${{ wood: "timber", draught: "health", essenceDraught: "essence-tonic", focus: "scroll", ward: "crystal", utility: "seed" }[id] || id}.png`);
const materialName = (id) =>
  ({
    wood: "Timber",
    stone: "Runestone",
    herb: "Moonleaf",
    crystal: "Crystal",
  })[id] || id;
export default function SanctuaryPanel({ state, call, close, open }) {
  const [tab, setTab] = useState("build"),
    [template, setTemplate] = useState("floor"),
    [point, setPoint] = useState(null),
    [rotation, setRotation] = useState(0),
    [preview, setPreview] = useState(null),
    [layoutName, setLayoutName] = useState("My sanctuary"),
    [selection, setSelection] = useState(null),
    [restore, setRestore] = useState(null);
  const sanctuary = state.sanctuary || {},
    plot = sanctuary.plot || {
      x: 350,
      y: 450,
      width: 300,
      height: 300,
      grid: 15,
      zoneId: "sacred-groves",
    },
    templates = sanctuary.templates || [],
    components = sanctuary.components || [],
    layouts = sanctuary.layouts || [],
    items = state.shop?.items || state.items || {},
    inventory = state.player.inventory || {};
  const current = templates.find((t) => t.id === template) || templates[0];
  useEffect(() => {
    if (current && !point)
      setPoint({ x: plot.x + plot.width / 2, y: plot.y + plot.height / 2 });
  }, [current?.id]);
  useEffect(() => {
    if (current && point) {
      const p = call("previewBuild", current.id, point.x, point.y, rotation);
      setPreview(p || null);
      call("setBuildPreview", p);
    }
    return () => call("setBuildPreview", null);
  }, [current?.id, point?.x, point?.y, rotation, sanctuary.revision]);
  function choosePoint(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x =
        plot.x +
        Math.round(
          (((e.clientX - rect.left) / rect.width) * plot.width) / plot.grid,
        ) *
          plot.grid,
      y =
        plot.y +
        Math.round(
          (((e.clientY - rect.top) / rect.height) * plot.height) / plot.grid,
        ) *
          plot.grid;
    setPoint({ x, y });
    setSelection(null);
  }
  function place() {
    if (!current || !point) return;
    if (call("placeBuild", current.id, point.x, point.y, rotation)) {
      setSelection(null);
      setPreview(call("previewBuild", current.id, point.x, point.y, rotation));
    }
  }
  return (
    <div className="sanctuary-content">
      <div className="sanctuary-banner">
        <div>
          <span className="eyebrow">A PLACE TO CALL YOUR OWN</span>
          <h3>Build something that lasts.</h3>
          <p>
            A protected arrival, a garden, a light in the dark. Shape your
            sanctuary one piece at a time.
          </p>
        </div>
        <Home size={52} />
      </div>
      <div className="realm-tabs sanctuary-tabs">
        {[
          { id: "build", label: "Build & arrange", icon: Hammer },
          { id: "storage", label: "Storage", icon: Package },
          { id: "layouts", label: "Saved layouts", icon: Save },
          { id: "workshop", label: "Workshop", icon: Wrench },
        ].map((t) => (
          <button
            className={tab === t.id ? "active" : ""}
            onClick={() => setTab(t.id)}
            key={t.id}
          >
            <t.icon size={13} />
            {t.label}
          </button>
        ))}
      </div>
      {tab === "build" && (
        <div className="builder-layout">
          <div className="build-templates">
            <div className="section-caption">
              TEMPLATES <span>{components.length} / 500</span>
            </div>
            {templates.map((t) => (
              <button
                className={current?.id === t.id ? "active" : ""}
                key={t.id}
                onClick={() => {
                  setTemplate(t.id);
                  setSelection(null);
                }}
              >
                <img src={t.asset} alt="" />
                <span>
                  {t.name}
                  <small>
                    {Object.entries(t.cost || {})
                      .map(([id, n]) => `${n} ${materialName(id)}`)
                      .join(" · ") || "No materials"}
                  </small>
                </span>
              </button>
            ))}
          </div>
          <div className="plot-column">
            <div className="plot-heading">
              <div>
                <span className="eyebrow">YOUR SANCTUARY PLOT</span>
                <h3>The Sacred Groves</h3>
              </div>
              <button
                className="outline-button"
                onClick={() => {
                  if (call("visitSanctuary")) close();
                }}
              >
                <MapPin size={12} /> Visit plot
              </button>
            </div>
            <div
              className="plot-blueprint"
              onClick={choosePoint}
              role="button"
              tabIndex={0}
              aria-label="Sanctuary placement grid"
              onKeyDown={(e) => {
                if (e.key === "ArrowRight")
                  setPoint((p) => ({ ...p, x: p.x + plot.grid }));
                if (e.key === "ArrowLeft")
                  setPoint((p) => ({ ...p, x: p.x - plot.grid }));
                if (e.key === "ArrowUp")
                  setPoint((p) => ({ ...p, y: p.y - plot.grid }));
                if (e.key === "ArrowDown")
                  setPoint((p) => ({ ...p, y: p.y + plot.grid }));
                if (e.key === "Enter") place();
              }}
              style={{ "--grid-size": `${(plot.grid / plot.width) * 100}%` }}
            >
              <span className="plot-north">N ↑</span>
              <span className="plot-owner">OWNER · YOU</span>
              {(plot.protectedExits || []).map((r, i) => (
                <div
                  key={i}
                  className="protected-plot"
                  style={{
                    left: `${((r.x - plot.x) / plot.width) * 100}%`,
                    top: `${((r.y - plot.y) / plot.height) * 100}%`,
                    width: `${(r.width / plot.width) * 100}%`,
                    height: `${(r.height / plot.height) * 100}%`,
                  }}
                />
              ))}
              {components.map((c) => (
                <button
                  className={`placed-component ${selection === c.id ? "selected" : ""}`}
                  key={c.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelection(c.id);
                    setPoint({ x: c.x, y: c.y });
                  }}
                  title={
                    templates.find((t) => t.id === c.templateId)?.name ||
                    c.templateId
                  }
                  aria-label={`Select ${c.templateId}`}
                  style={{
                    left: `${((c.x - plot.x) / plot.width) * 100}%`,
                    top: `${((c.y - plot.y) / plot.height) * 100}%`,
                    width: `${(Math.max(18, c.width || 30) / plot.width) * 100}%`,
                    height: `${(Math.max(18, c.height || 30) / plot.height) * 100}%`,
                    transform: `translate(-50%,-50%) rotate(${c.rotation || 0}deg)`,
                  }}
                >
                  <img src={c.asset} alt="" />
                </button>
              ))}
              {point && current && !selection && (
                <div
                  className={`placement-ghost ${preview?.valid ? "valid" : "invalid"}`}
                  style={{
                    left: `${((point.x - plot.x) / plot.width) * 100}%`,
                    top: `${((point.y - plot.y) / plot.height) * 100}%`,
                    width: `${((current.width || 30) / plot.width) * 100}%`,
                    height: `${((current.height || 30) / plot.height) * 100}%`,
                    transform: `translate(-50%,-50%) rotate(${rotation}deg)`,
                  }}
                >
                  <img src={current.asset} alt="Placement preview" />
                </div>
              )}
            </div>
            <div className="plot-controls">
              <span>15 px snap · Select a grid point to place</span>
              <button onClick={() => setRotation((rotation + 90) % 360)}>
                <RotateCw size={12} /> Rotate {rotation}°
              </button>
            </div>
            <div
              className={`build-validation ${preview?.valid ? "valid" : "invalid"}`}
            >
              {selection ? (
                <>
                  <Check size={13} /> Component selected
                </>
              ) : preview?.valid ? (
                <>
                  <Check size={13} /> Placement clear. Exit and arrival routes
                  remain open.
                </>
              ) : (
                <>
                  <X size={13} />
                  {preview?.reason ||
                    "Choose a template and a point within your plot."}
                </>
              )}
            </div>
            <div className="build-materials">
              {Object.entries(current?.cost || {}).map(([id, n]) => (
                <span
                  className={(inventory[id] || 0) < n ? "short" : ""}
                  key={id}
                >
                  <img src={itemAsset(id)} alt="" />
                  {materialName(id)}{" "}
                  <strong>
                    {inventory[id] || 0} / {n}
                  </strong>
                </span>
              ))}
            </div>
            <div className="build-actions">
              <button
                className="outline-button"
                onClick={() => call("undoBuild")}
              >
                <RotateCcw size={13} /> Undo last edit
              </button>
              {selection ? (
                <button
                  className="outline-button danger"
                  onClick={() => {
                    call("removeBuild", selection);
                    setSelection(null);
                  }}
                >
                  <Trash2 size={12} /> Remove selected
                </button>
              ) : (
                <button
                  className="primary-button"
                  onClick={place}
                  disabled={!preview?.valid}
                >
                  <Plus size={13} /> Place {current?.name || "component"}
                </button>
              )}
            </div>
            <p className="construction-note">
              Up to 500 components. Undo retains the last 20 eligible edits.
              Resources settle once; storage moves to recovery when a container
              is removed.
            </p>
          </div>
        </div>
      )}
      {tab === "storage" && (
        <div className="storage-content">
          <div className="storage-title">
            <Package size={26} />
            <div>
              <h3>Keep your discoveries safe.</h3>
              <p>Move whole items between your pack and sanctuary storage.</p>
            </div>
          </div>
          <div className="storage-table">
            <div className="storage-table-head">
              <span>ITEM</span>
              <span>PACK</span>
              <span>STORAGE</span>
              <span>TRANSFER</span>
            </div>
            {Object.keys({ ...inventory, ...sanctuary.bank }).map((id) => (
              <div className="storage-row" key={id}>
                <div>
                  <img
                    src={itemAsset(id)}
                    onError={(e) =>
                      (e.currentTarget.style.visibility = "hidden")
                    }
                    alt=""
                  />
                  <span>{items[id]?.name || materialName(id)}</span>
                </div>
                <strong>{inventory[id] || 0}</strong>
                <strong>{sanctuary.bank?.[id] || 0}</strong>
                <div>
                  <button
                    onClick={() => call("depositItem", id, 1)}
                    disabled={!inventory[id]}
                    title="Deposit one"
                  >
                    <ArrowDown size={13} />
                    <span>Store</span>
                  </button>
                  <button
                    onClick={() => call("withdrawItem", id, 1)}
                    disabled={!sanctuary.bank?.[id]}
                    title="Withdraw one"
                  >
                    <ArrowUp size={13} />
                    <span>Take</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
          {Object.values(sanctuary.recovery || {}).some((n) => n > 0) && (
            <div className="recovery-storage">
              <h3>Recovery chest</h3>
              <p>Contents recovered from removed storage components.</p>
              {Object.entries(sanctuary.recovery)
                .filter(([, n]) => n > 0)
                .map(([id, n]) => (
                  <button
                    key={id}
                    className="outline-button"
                    onClick={() => call("withdrawItem", id, 1, "recovery")}
                  >
                    {items[id]?.name || id} × {n} <ArrowUp size={12} />
                  </button>
                ))}
            </div>
          )}
        </div>
      )}
      {tab === "layouts" && (
        <div className="layouts-content">
          <div className="layout-save">
            <div>
              <h3>Remember this place.</h3>
              <p>
                Save a layout before your next renovation. Restoring reconciles
                resources and preserves stored items.
              </p>
            </div>
            <div>
              <input
                aria-label="Layout name"
                maxLength={36}
                value={layoutName}
                onChange={(e) => setLayoutName(e.target.value)}
              />
              <button
                className="primary-button"
                onClick={() => call("saveLayout", layoutName)}
              >
                <Save size={13} /> Save layout
              </button>
            </div>
          </div>
          <div className="saved-layouts">
            {layouts.length ? (
              layouts.map((l) => (
                <article key={l.id}>
                  <div>
                    <Home size={25} />
                    <h3>{l.name}</h3>
                    <span>
                      {l.components?.length || 0} components ·{" "}
                      {l.createdAt
                        ? new Date(l.createdAt).toLocaleDateString()
                        : ""}
                    </span>
                  </div>
                  <button
                    className="outline-button"
                    onClick={() => {
                      const preview = call("previewRestoreLayout", l.id);
                      setRestore({ id: l.id, name: l.name, ...preview });
                    }}
                  >
                    Preview restore <ArrowRight size={12} />
                  </button>
                </article>
              ))
            ) : (
              <div className="empty-system">
                <Save size={30} />
                <h3>Your first home is waiting.</h3>
                <p>Place components, then save a named layout.</p>
              </div>
            )}
          </div>
          {restore && (
            <div className="transaction-preview">
              <h3>Restore {restore.name}</h3>
              <p>
                {restore.reason ||
                  "The saved layout replaces the current components. Material differences are reconciled once."}
              </p>
              <div className="restoration-costs">
                {Object.entries(restore.cost || restore.required || {}).map(
                  ([id, n]) => (
                    <span key={id}>
                      {materialName(id)} · {n}
                    </span>
                  ),
                )}
              </div>
              <div>
                <button
                  className="subtle-button"
                  onClick={() => setRestore(null)}
                >
                  Cancel
                </button>
                <button
                  className="primary-button"
                  disabled={restore.valid === false}
                  onClick={() => {
                    call("restoreLayout", restore.id);
                    setRestore(null);
                  }}
                >
                  Restore layout <Check size={13} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      {tab === "workshop" && (
        <div className="workshop-content">
          <div className="workshop-intro">
            <Wrench size={27} />
            <div>
              <h3>Care for what carries you.</h3>
              <p>
                Repair equipment for 20% of its base price, or salvage half its
                recipe materials. Equipment remains yours at zero durability.
              </p>
            </div>
          </div>
          {["focus", "ward", "utility"].map((id) => (
            <div className="workshop-item" key={id}>
              <div className="workshop-item-icon">
                <Shield size={24} />
              </div>
              <div>
                <h3>{items[id]?.name || id}</h3>
                <p>
                  {inventory[id]
                    ? state.player.equipment?.[id]
                      ? "Equipped"
                      : "In your pack"
                    : "Not owned"}
                </p>
                <div className="durability-track">
                  <i
                    style={{
                      width: `${sanctuary.itemDurability?.[id] ?? 100}%`,
                    }}
                  />
                </div>
                <span>
                  {sanctuary.itemDurability?.[id] ?? 100} / 100 durability
                </span>
              </div>
              <div>
                <button
                  className="outline-button"
                  disabled={!inventory[id]}
                  onClick={() => call("repairItem", id)}
                >
                  <Wrench size={12} /> Repair ·{" "}
                  {Math.ceil((items[id]?.price || 0) * 0.2)}
                </button>
                <button
                  className="subtle-button"
                  disabled={!inventory[id]}
                  onClick={() => call("salvageItem", id)}
                >
                  Salvage <Hammer size={12} />
                </button>
              </div>
            </div>
          ))}
          <div className="workshop-actions">
            <button className="outline-button" onClick={() => open("craft")}>
              <Hammer size={14} /> Craft from recipes
            </button>
            <button className="outline-button" onClick={() => open("shop")}>
              <Package size={14} /> Sanctuary exchange
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
