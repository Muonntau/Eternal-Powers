import React, { useId, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Feather,
  Flame,
  Sparkles,
  Shuffle,
  Shield,
  Heart,
  Sun,
  Droplets,
  Wind,
  Moon,
  Skull,
  Mountain,
  X,
} from "lucide-react";
import { BRANCHES } from "../data/manual.js";
import {
  BODY_TYPES,
  HAIR_STYLES,
  CHARACTER_PALETTES,
  defaultAppearance,
  normalizeAppearance,
  resolveAppearanceColors,
  nativeBranches,
  validateCharacterDraft,
} from "../game/character.js";
import { assetUrl } from "../assetUrl.js";
import "../character-creator.css";

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

/** The portrait and world avatar share the same palette and appearance schema. */
export function CharacterPortrait({
  appearance,
  lineage = "angel",
  compact = false,
  className = "",
  title = "Your celestial character",
}) {
  const colors = resolveAppearanceColors(appearance, lineage),
    id = useId().replace(/:/g, ""),
    demon = lineage === "demon";
  const wide = colors.bodyType === "vanguard",
    robe = colors.bodyType === "mystic";
  return (
    <svg
      className={`celestial-portrait ${className}`}
      viewBox={compact ? "33 25 94 100" : "0 0 160 190"}
      role="img"
      aria-label={title}
      style={{ "--avatar-aura": colors.aura }}
      shapeRendering="crispEdges"
    >
      <defs>
        <radialGradient id={`aura-${id}`}>
          <stop offset="0" stopColor={colors.aura} stopOpacity=".3" />
          <stop offset="1" stopColor={colors.aura} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`wing-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor={demon ? colors.armorLight : "#dfe9ff"} />
          <stop offset="1" stopColor={demon ? colors.armorDark : "#94a6cf"} />
        </linearGradient>
      </defs>
      {!compact && (
        <>
          <ellipse cx="80" cy="110" rx="77" ry="72" fill={`url(#aura-${id})`} />
          <ellipse
            cx="80"
            cy="168"
            rx="43"
            ry="10"
            fill="#020918"
            opacity=".55"
          />
          <ellipse
            className="avatar-orbit"
            cx="80"
            cy="166"
            rx="49"
            ry="13"
            fill="none"
            stroke={colors.aura}
            strokeOpacity=".48"
            strokeWidth="1"
          />
          <path
            d="M19 92h3v3h-3zM133 53h3v3h-3zM125 135h2v2h-2zM36 44h2v2h-2z"
            fill={colors.aura}
            opacity=".75"
          />
        </>
      )}
      <g className={compact ? "" : "avatar-living-form"}>
        {demon ? (
          <>
            <path
              d="M61 76L24 47l4 22-12 26 25-3 13 18 9-17M98 76l38-29-4 22 12 26-25-3-13 18-9-17"
              fill={`url(#wing-${id})`}
              stroke={colors.aura}
              strokeWidth="1"
            />
            <path
              d="M108 135q29 4 17-19l-4 4-1-13 11 5-4 2q18 30-20 29"
              fill={colors.armorDark}
            />
          </>
        ) : (
          <>
            <path
              d="M65 79L31 43l-5 15 7 11-13-1 7 17 12 4-11 4 15 16 23-4M95 79l34-36 5 15-7 11 13-1-7 17-12 4 11 4-15 16-23-4"
              fill={`url(#wing-${id})`}
            />
            <path
              d="M33 58l27 29M31 77l27 17M43 96l15 5M127 58l-27 29M129 77l-27 17M117 96l-15 5"
              stroke="#f6f6ff"
              strokeOpacity=".65"
              strokeWidth="2"
            />
          </>
        )}
        <path
          d={
            robe
              ? "M65 111h30l12 42H53z"
              : wide
                ? "M59 101h42l-4 38H63z"
                : "M64 103h32l4 34H60z"
          }
          fill={colors.armorDark}
        />
        <path d="M65 136h12v25H63v-9h2zM83 136h12l2 25H83z" fill="#273148" />
        <path
          d="M63 154h14v10H59v-6h4zM83 154h14l4 4v6H83z"
          fill={colors.armorDark}
        />
        {robe ? (
          <>
            <path d="M63 85h34l10 60-14 9H67l-14-9z" fill={colors.armor} />
            <path d="M74 90h12v60H74z" fill={colors.armorLight} />
            <path d="M59 135h42v5H59z" fill={colors.aura} opacity=".7" />
          </>
        ) : (
          <>
            <path
              d={wide ? "M56 84h48v44H56z" : "M63 84h34v46H63z"}
              fill={colors.armor}
            />
            <path
              d={
                wide
                  ? "M51 84h15v16H48V89h3zM94 84h15v5h3v11H94z"
                  : "M58 85h10v14H55v-9h3zM92 85h10v5h3v9H92z"
              }
              fill={colors.armorLight}
            />
            <path
              d="M75 91h10v28H75zM65 120h30v7H65z"
              fill={colors.armorDark}
            />
            <path d="M77 94h6v14h-6z" fill={colors.aura} />
          </>
        )}
        <path
          d={
            wide
              ? "M49 99h11v31H49zM100 99h11v31h-11z"
              : "M55 99h11v31H55zM94 99h11v31H94z"
          }
          fill={colors.armorDark}
        />
        <path
          d={
            wide
              ? "M49 127h11v12H49zM100 127h11v12h-11z"
              : "M55 127h11v12H55zM94 127h11v12H94z"
          }
          fill={colors.skin}
        />
        <path d="M66 49h28v7h6v24h-6v7H66v-7h-6V56h6z" fill={colors.skin} />
        <path d="M68 79h24v8H68z" fill={colors.skin} />
        <path d="M66 63h8v5h-8zM86 63h8v5h-8z" fill="#202b43" />
        <path d="M69 63h3v3h-3zM87 63h3v3h-3z" fill={colors.aura} />
        <path d="M76 75h9v2h-9z" fill="#5a3b44" opacity=".65" />
        {colors.hairStyle === 0 && (
          <path
            d="M63 48h34v12H60v-8h3zM60 58h5v11h-5zM95 58h5v11h-5z"
            fill={colors.hair}
          />
        )}
        {colors.hairStyle === 1 && (
          <path
            d="M66 44h27v4h8v14H86v-7H74v7H60V51h6zM60 59h5v12h-5zM95 59h5v9h-5z"
            fill={colors.hair}
          />
        )}
        {colors.hairStyle === 2 && (
          <>
            <path
              d="M62 47h36v10h6v35H94V63H66v29H56V57h6z"
              fill={colors.hair}
            />
            <path d="M63 47h31v12H63zM89 56h8v9h-8z" fill={colors.hair} />
          </>
        )}
        {colors.hairStyle === 3 && (
          <path
            d="M75 32h12v6h7v9h6v16H88V52H72v11H60V47h9v-9h6z"
            fill={colors.hair}
          />
        )}
        {demon ? (
          <>
            <path
              d="M62 51L55 37l3-12 8 22zM98 51l7-14-3-12-8 22z"
              fill={colors.aura}
            />
            <path
              d="M60 47l-4-10 2-5 5 15zM100 47l4-10-2-5-5 15z"
              fill="#e1e4fb"
              opacity=".7"
            />
          </>
        ) : (
          <>
            <ellipse
              cx="80"
              cy="28"
              rx="22"
              ry="6"
              fill="none"
              stroke={colors.aura}
              strokeWidth="3"
            />
            <ellipse
              cx="80"
              cy="28"
              rx="17"
              ry="3"
              fill="none"
              stroke="#f5f7ff"
              strokeOpacity=".6"
              strokeWidth="1"
            />
          </>
        )}
        <path d="M69 86h22l-5 7H74z" fill={colors.armorLight} />
        <path d="M77 87h6v6h-6z" fill={colors.aura} />
      </g>
    </svg>
  );
}

function PalettePicker({ label, field, value, onChange }) {
  return (
    <fieldset className="creator-palette">
      <legend>
        {label}
        <span>
          {CHARACTER_PALETTES[field].find((item) => item.id === value)?.name}
        </span>
      </legend>
      <div>
        {CHARACTER_PALETTES[field].map((item) => (
          <button
            type="button"
            key={item.id}
            aria-label={`${label}: ${item.name}`}
            aria-pressed={item.id === value}
            onClick={() => onChange(field, item.id)}
            style={{ "--swatch": item.color }}
            className={item.id === value ? "selected" : ""}
          >
            {item.id === value && <Check size={13} />}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export default function CharacterCreator({
  mode = "create",
  player = {},
  onComplete,
  onCancel,
  busy = false,
  error = "",
}) {
  const edit = mode === "edit",
    steps = edit
      ? ["Appearance", "Your character"]
      : ["Origin", "Appearance", "First affinity", "Your character"];
  const initialLineage = ["angel", "demon"].includes(player.lineage)
    ? player.lineage
    : "angel";
  const [step, setStep] = useState(0),
    [name, setName] = useState(edit ? player.name || "" : ""),
    [lineage, setLineage] = useState(initialLineage),
    [appearance, setAppearance] = useState(() =>
      normalizeAppearance(player.appearance, initialLineage),
    ),
    [starterBranch, setStarterBranch] = useState(
      player.starterBranch ||
        (initialLineage === "demon" ? "fire-create" : "water-grow"),
    ),
    [pending, setPending] = useState(false),
    [localError, setLocalError] = useState("");
  const colors = resolveAppearanceColors(appearance, lineage),
    branch =
      BRANCHES.find((item) => item.id === starterBranch) ||
      nativeBranches(lineage)[0],
    power = branch.powers[0],
    isBusy = busy || pending,
    current = steps[step],
    last = step === steps.length - 1;
  const draft = { name, lineage, starterBranch, appearance },
    validation = validateCharacterDraft(
      draft,
      player,
      edit ? "edit" : "create",
    );
  const selectedBody = BODY_TYPES.find(
    (item) => item.id === appearance.bodyType,
  );
  const setOption = (key, value) =>
    setAppearance((previous) => ({ ...previous, [key]: value }));
  function chooseLineage(value) {
    setLineage(value);
    setStarterBranch(value === "demon" ? "fire-create" : "water-grow");
    setAppearance(defaultAppearance(value));
    setLocalError("");
  }
  function shuffle() {
    const next = {
      bodyType: BODY_TYPES[Math.floor(Math.random() * BODY_TYPES.length)].id,
      hairStyle: Math.floor(Math.random() * HAIR_STYLES.length),
    };
    for (const field of Object.keys(CHARACTER_PALETTES))
      next[field] =
        CHARACTER_PALETTES[field][
          Math.floor(Math.random() * CHARACTER_PALETTES[field].length)
        ].id;
    setAppearance(next);
  }
  async function submit(event) {
    event.preventDefault();
    setLocalError("");
    if (!validation.valid) {
      setLocalError(validation.reason);
      return;
    }
    if (!last) {
      setStep((index) => index + 1);
      return;
    }
    setPending(true);
    try {
      const result = await onComplete?.(validation.value);
      if (result === false)
        setLocalError(
          "Your changes could not be saved. Review your choices and try again.",
        );
    } catch (cause) {
      setLocalError(
        cause?.message || "Your changes could not be saved. Please try again.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <section
      className="character-creator-screen"
      role="dialog"
      aria-modal="true"
      aria-label={edit ? "Customize your character" : "Create your character"}
      style={{
        "--creator-accent": colors.aura,
        "--creator-art": `url("${assetUrl("/assets/v2/creator-world.png")}")`,
      }}
    >
      <div className="creator-atmosphere" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      <header className="creator-topbar">
        <a
          href="#"
          onClick={(event) => event.preventDefault()}
          className="creator-brand"
        >
          <span>EP</span>
          <div>
            ETERNAL POWERS<small>THE SECOND CHRONICLE</small>
          </div>
        </a>
        <div className="creator-session">
          <i />
          {edit ? "YOUR CELESTIAL FORM" : "A NEW JOURNEY"}
        </div>
        {onCancel && (
          <button
            type="button"
            className="creator-close"
            onClick={onCancel}
            disabled={isBusy}
            aria-label="Close character creator"
          >
            <X size={20} />
          </button>
        )}
      </header>
      <div className="creator-workspace">
        <aside className="creator-story">
          <div className="creator-kicker">
            {edit ? "REIMAGINE YOURSELF" : "YOUR STORY STARTS HERE"}
          </div>
          <h1>
            {edit ? (
              <>
                Same soul.
                <br />
                <em>New expression.</em>
              </>
            ) : (
              <>
                An eternity.
                <br />
                <em>Entirely yours.</em>
              </>
            )}
          </h1>
          <p>
            {edit
              ? "Renew your name, colors, and silhouette. Every power, bond, and memory stays with you."
              : "Choose your origin. Shape your celestial form. Become the presence this world will remember."}
          </p>
          <nav aria-label="Character creation steps">
            {steps.map((label, index) => (
              <button
                type="button"
                key={label}
                disabled={isBusy || index > step}
                className={
                  step === index ? "active" : index < step ? "complete" : ""
                }
                aria-current={step === index ? "step" : undefined}
                onClick={() => {
                  setStep(index);
                  setLocalError("");
                }}
              >
                <span>
                  {index < step ? (
                    <Check size={13} />
                  ) : (
                    String(index + 1).padStart(2, "0")
                  )}
                </span>
                <div>
                  {label}
                  <small>
                    {
                      [
                        "Define your presence",
                        "Make it personal",
                        "Find your first power",
                        "Begin your chapter",
                      ][edit ? index + 1 : index]
                    }
                  </small>
                </div>
              </button>
            ))}
          </nav>
          <div className="creator-identity-note">
            <Shield size={16} />
            <span>
              {edit
                ? "Your progression is preserved."
                : "Appearance is yours. Your choices shape your role."}
            </span>
          </div>
        </aside>
        <div className="creator-stage">
          <div className="creator-stage-grid" aria-hidden="true" />
          <div className="creator-preview-title">
            <span>CELESTIAL FORM</span>
            <b>{lineage === "angel" ? "ANGELIC" : "DEMONIC"}</b>
          </div>
          <CharacterPortrait
            appearance={appearance}
            lineage={lineage}
            title={`${name || "Your character"}, ${lineage} ${selectedBody?.name.toLowerCase()}`}
          />
          <div className="creator-preview-name">
            <h2>{name.trim() || "Your name here"}</h2>
            <p>
              {lineage === "angel" ? "Angel" : "Demon"}
              <span />
              {selectedBody?.name}
            </p>
          </div>
          <div className="creator-preview-affinity">
            <span style={{ background: branch.color }} />
            <div>
              {branch.domain}
              <small>{branch.aspect} affinity</small>
            </div>
            <img src={assetUrl(`/assets/power-icons/${power.id}.png`)} alt="" />
          </div>
          <button
            type="button"
            className="creator-shuffle"
            onClick={shuffle}
            disabled={isBusy}
            aria-label="Randomize appearance"
          >
            <Shuffle size={14} /> Surprise me
          </button>
        </div>
        <form className="creator-form" onSubmit={submit}>
          <div className="creator-form-heading">
            <span>
              STEP {String(step + 1).padStart(2, "0")} /{" "}
              {String(steps.length).padStart(2, "0")}
            </span>
            <h2>
              {current === "Origin"
                ? "Where do you begin?"
                : current === "Appearance"
                  ? "Make your mark."
                  : current === "First affinity"
                    ? "Choose your first gift."
                    : "Meet your celestial."}
            </h2>
            <p>
              {current === "Origin"
                ? "Two lineages. Countless ways to live."
                : current === "Appearance"
                  ? "Your silhouette, your palette, your signature."
                  : current === "First affinity"
                    ? "Your first level is a gift. Other paths await in the world."
                    : "One character. A world of possibilities."}
            </p>
          </div>
          {current === "Origin" && (
            <div className="creator-form-body">
              <label className="creator-name-field">
                Character name
                <input
                  name="character-name"
                  aria-label="Character name"
                  value={name}
                  maxLength={24}
                  autoComplete="off"
                  placeholder="What will the world call you?"
                  onChange={(event) => setName(event.target.value)}
                  disabled={isBusy}
                />
                <small>2–24 characters. You can rename at a sanctuary.</small>
              </label>
              <div className="creator-field-label">Your lineage</div>
              <div className="creator-lineages">
                {[
                  [
                    "angel",
                    Feather,
                    "Angel",
                    "Grace, light, and boundless possibility.",
                    "GOOD KARMA",
                  ],
                  [
                    "demon",
                    Flame,
                    "Demon",
                    "Resolve, shadow, and untamed potential.",
                    "BAD KARMA",
                  ],
                ].map(([id, Icon, label, text, currency]) => (
                  <button
                    type="button"
                    key={id}
                    aria-label={`Choose ${label}`}
                    onClick={() => chooseLineage(id)}
                    disabled={isBusy}
                    aria-pressed={lineage === id}
                    className={`creator-lineage ${lineage === id ? "selected" : ""}`}
                  >
                    <span className="creator-lineage-symbol">
                      <Icon size={25} />
                    </span>
                    <div>
                      <h3>{label}</h3>
                      <p>{text}</p>
                      <small>{currency} AFFINITY</small>
                    </div>
                    <span className="creator-choice-check">
                      {lineage === id && <Check size={12} />}
                    </span>
                  </button>
                ))}
              </div>
              <div className="creator-soft-note">
                <Sparkles size={15} />
                <p>
                  Your lineage sets your native affinities. Your actions decide
                  the story.
                </p>
              </div>
            </div>
          )}
          {current === "Appearance" && (
            <div className="creator-form-body">
              {edit && (
                <label className="creator-name-field">
                  Character name
                  <input
                    name="character-name"
                    aria-label="Character name"
                    value={name}
                    maxLength={24}
                    autoComplete="off"
                    onChange={(event) => setName(event.target.value)}
                    disabled={isBusy}
                  />
                </label>
              )}
              <fieldset className="creator-body-types">
                <legend>Silhouette</legend>
                <div>
                  {BODY_TYPES.map((body) => (
                    <button
                      type="button"
                      key={body.id}
                      disabled={isBusy}
                      aria-pressed={appearance.bodyType === body.id}
                      className={
                        appearance.bodyType === body.id ? "selected" : ""
                      }
                      onClick={() => setOption("bodyType", body.id)}
                    >
                      <span className={`creator-body-icon ${body.id}`} />
                      {body.name}
                    </button>
                  ))}
                </div>
              </fieldset>
              <p className="creator-body-description">
                {selectedBody?.description}
              </p>
              <fieldset className="creator-hair-styles">
                <legend>Hair style</legend>
                <div>
                  {HAIR_STYLES.map((style) => (
                    <button
                      type="button"
                      key={style.id}
                      disabled={isBusy}
                      aria-pressed={appearance.hairStyle === style.id}
                      className={
                        appearance.hairStyle === style.id ? "selected" : ""
                      }
                      onClick={() => setOption("hairStyle", style.id)}
                    >
                      {style.name}
                    </button>
                  ))}
                </div>
              </fieldset>
              <PalettePicker
                label="Skin tone"
                field="skinTone"
                value={appearance.skinTone}
                onChange={setOption}
              />
              <PalettePicker
                label="Hair color"
                field="hairColor"
                value={appearance.hairColor}
                onChange={setOption}
              />
              <PalettePicker
                label="Attire"
                field="armorColor"
                value={appearance.armorColor}
                onChange={setOption}
              />
              <PalettePicker
                label="Aura"
                field="auraColor"
                value={appearance.auraColor}
                onChange={setOption}
              />
            </div>
          )}
          {current === "First affinity" && (
            <div className="creator-form-body">
              <div className="creator-affinity-grid">
                {nativeBranches(lineage).map((item) => {
                  const Icon = DOMAIN_ICONS[item.domain] || Sparkles;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      disabled={isBusy}
                      style={{ "--path-color": item.color }}
                      aria-label={`Choose ${item.domain} ${item.aspect}`}
                      className={starterBranch === item.id ? "selected" : ""}
                      aria-pressed={starterBranch === item.id}
                      onClick={() => setStarterBranch(item.id)}
                    >
                      <Icon size={19} />
                      <div>
                        <strong>{item.domain}</strong>
                        <small>{item.aspect}</small>
                      </div>
                      {starterBranch === item.id && <Check size={12} />}
                    </button>
                  );
                })}
              </div>
              <div className="creator-first-power">
                <img
                  src={assetUrl(`/assets/power-icons/${power.id}.png`)}
                  alt=""
                />
                <div>
                  <span>YOUR FIRST POWER</span>
                  <h3>{power.name}</h3>
                  <p>{power.effect || power.description}</p>
                  <small>
                    {power.essenceCost} Essence · {power.cooldown}s recovery
                  </small>
                </div>
              </div>
            </div>
          )}
          {current === "Your character" && (
            <div className="creator-form-body creator-review">
              <div className="creator-review-name">
                <CharacterPortrait
                  compact
                  appearance={appearance}
                  lineage={lineage}
                  title="Your finished character"
                />
                <div>
                  <span>YOUR CELESTIAL</span>
                  <h3>{name.trim()}</h3>
                  <p>
                    {lineage === "angel" ? "Angelic" : "Demonic"}{" "}
                    {selectedBody?.name}
                  </p>
                </div>
              </div>
              <dl>
                <div>
                  <dt>Origin</dt>
                  <dd>{lineage === "angel" ? "Angel" : "Demon"}</dd>
                </div>
                <div>
                  <dt>First affinity</dt>
                  <dd>
                    {branch.domain} · {branch.aspect}
                  </dd>
                </div>
                <div>
                  <dt>Signature</dt>
                  <dd>
                    {
                      CHARACTER_PALETTES.auraColor.find(
                        (item) => item.id === appearance.auraColor,
                      )?.name
                    }{" "}
                    aura
                  </dd>
                </div>
              </dl>
              <div className="creator-chapter">
                <span>CHAPTER ONE</span>
                <h3>A spark of something eternal.</h3>
                <p>
                  {edit
                    ? "Return to the world with a renewed celestial form. Your journey continues exactly where you left it."
                    : "The Sacred Groves await. Meet its keepers, discover your first power, and choose what you leave behind."}
                </p>
              </div>
              {!edit && (
                <div className="creator-control-hints">
                  <span>
                    <kbd>WASD</kbd> Move
                  </span>
                  <span>
                    <kbd>E</kbd> Interact
                  </span>
                  <span>
                    <kbd>Q</kbd> Cast
                  </span>
                </div>
              )}
            </div>
          )}
          {(localError || error) && (
            <p className="creator-error" role="alert">
              {error || localError}
            </p>
          )}
          <footer className="creator-form-footer">
            {step > 0 ? (
              <button
                type="button"
                className="creator-back"
                onClick={() => {
                  setStep((index) => index - 1);
                  setLocalError("");
                }}
                disabled={isBusy}
              >
                <ArrowLeft size={15} /> Back
              </button>
            ) : (
              <span className="creator-footer-note">
                {edit ? "Make yourself at home." : "A new story is waiting."}
              </span>
            )}
            <button
              type="submit"
              className="creator-continue"
              disabled={isBusy || !validation.valid}
            >
              {isBusy
                ? "Saving your character…"
                : last
                  ? edit
                    ? "Save your form"
                    : "Begin your journey"
                  : "Continue"}
              {!isBusy &&
                (last ? <Sparkles size={16} /> : <ArrowRight size={16} />)}
            </button>
          </footer>
        </form>
      </div>
      <footer className="creator-bottom">
        <span>EXPLORE. CREATE. BECOME.</span>
        <span>
          ETERNAL POWERS <i /> YOUR SECOND CHRONICLE
        </span>
      </footer>
    </section>
  );
}
