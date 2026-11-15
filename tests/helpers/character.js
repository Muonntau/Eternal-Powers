import { expect } from "@playwright/test";
import { BRANCHES } from "../../src/data/manual.js";
import {
  CHARACTER_PALETTES,
  BODY_TYPES,
  HAIR_STYLES,
} from "../../src/game/character.js";

/** Complete fresh onboarding through its visible controls, never by bypassing
 * the character gate or injecting a saved/created avatar. Existing saves pass. */
export async function ensureCharacter(
  page,
  {
    name = "Wayfarer",
    lineage = "angel",
    starterBranch = "water-grow",
    appearance,
  } = {},
) {
  await page.waitForFunction(() => window.__eternal?.player);
  if (await page.evaluate(() => !!window.__eternal.player.characterCreated))
    return page.evaluate(() => structuredClone(window.__eternal.player));
  const creator = page.getByRole("dialog", {
    name: "Create your character",
    exact: true,
  });
  await expect(creator).toBeVisible();
  await creator.getByLabel("Character name", { exact: true }).fill(name);
  await creator
    .getByRole("button", {
      name: `Choose ${lineage === "demon" ? "Demon" : "Angel"}`,
      exact: true,
    })
    .click();
  await creator.getByRole("button", { name: "Continue", exact: true }).click();
  if (appearance) await chooseAppearance(creator, appearance);
  await creator.getByRole("button", { name: "Continue", exact: true }).click();
  const branch = BRANCHES.find((b) => b.id === starterBranch);
  if (!branch) throw Error(`Unknown starting branch: ${starterBranch}`);
  await creator
    .getByRole("button", {
      name: `Choose ${branch.domain} ${branch.aspect}`,
      exact: true,
    })
    .click();
  await creator.getByRole("button", { name: "Continue", exact: true }).click();
  await creator
    .getByRole("button", { name: "Begin your journey", exact: true })
    .click();
  await expect(creator).toHaveCount(0);
  await page.waitForFunction(
    () => window.__eternal?.player.characterCreated && !window.__eternal.paused,
  );
  return page.evaluate(() => structuredClone(window.__eternal.player));
}

export async function chooseAppearance(creator, appearance) {
  if (appearance.bodyType) {
    const body = BODY_TYPES.find((b) => b.id === appearance.bodyType);
    if (!body) throw Error(`Unknown body type: ${appearance.bodyType}`);
    await creator.getByRole("button", { name: body.name, exact: true }).click();
  }
  if (appearance.hairStyle != null) {
    const hair = HAIR_STYLES.find((h) => h.id === appearance.hairStyle);
    if (!hair) throw Error(`Unknown hair style: ${appearance.hairStyle}`);
    await creator.getByRole("button", { name: hair.name, exact: true }).click();
  }
  for (const [field, label] of Object.entries({
    skinTone: "Skin tone",
    hairColor: "Hair color",
    armorColor: "Attire",
    auraColor: "Aura",
  })) {
    if (!appearance[field]) continue;
    const color = CHARACTER_PALETTES[field].find(
      (p) => p.id === appearance[field],
    );
    if (!color) throw Error(`Unknown ${field}: ${appearance[field]}`);
    await creator
      .getByRole("button", { name: `${label}: ${color.name}`, exact: true })
      .click();
  }
}
