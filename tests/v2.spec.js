import { test, expect } from "@playwright/test";
import { ensureCharacter, chooseAppearance } from "./helpers/character.js";

async function boot(page) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 400)
      errors.push(`${response.status()} ${response.url()}`);
  });
  await page.goto("/");
  await page.waitForFunction(() => window.__eternal?.player);
  return errors;
}
async function closePanel(page) {
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
}
async function clickEntity(page, id) {
  const point = await page.evaluate((id) => {
    const g = window.__eternal,
      entity = g.entities.find((e) => e.id === id);
    return { x: entity.x - g.camera.x, y: entity.y - g.camera.y };
  }, id);
  await page.locator(".game-viewport > canvas").click({ position: point });
}

test("v2 requires character creation before movement and retains the chosen character after reload", async ({
  page,
}) => {
  const errors = await boot(page);
  const creator = page.getByRole("dialog", {
    name: "Create your character",
    exact: true,
  });
  await expect(creator).toBeVisible();
  await page.screenshot({
    path: "work/v2-creator-desktop.png",
    fullPage: true,
  });
  const before = await page.evaluate(() => ({
    x: window.__eternal.player.x,
    y: window.__eternal.player.y,
  }));
  await page.keyboard.down("d");
  await page.waitForTimeout(250);
  await page.keyboard.up("d");
  expect(
    await page.evaluate(() => ({
      x: window.__eternal.player.x,
      y: window.__eternal.player.y,
    })),
  ).toEqual(before);
  expect(
    await page.evaluate(
      () => window.__eternal.inputBlocked && window.__eternal.paused,
    ),
  ).toBe(true);
  await expect(
    creator.getByRole("button", { name: "Continue", exact: true }),
  ).toBeDisabled();
  const appearance = {
    bodyType: "mystic",
    hairStyle: 2,
    skinTone: "moon",
    hairColor: "plum",
    armorColor: "glacier",
    auraColor: "violet",
  };
  const player = await ensureCharacter(page, {
    name: "Nyra V2",
    lineage: "demon",
    starterBranch: "fire-create",
    appearance,
  });
  expect(player.name).toBe("Nyra V2");
  expect(player.lineage).toBe("demon");
  expect(player.starterBranch).toBe("fire-create");
  expect(player.learned["fire-create"]).toBe(1);
  expect(player.appearance).toEqual(appearance);
  expect(player.characterCreated).toBe(true);
  await page.screenshot({ path: "work/v2-game-desktop.png", fullPage: true });
  const x = await page.evaluate(() => window.__eternal.player.x);
  await page.keyboard.down("d");
  await expect
    .poll(() => page.evaluate(() => window.__eternal.player.x))
    .toBeGreaterThan(x + 5);
  await page.keyboard.up("d");
  await page.reload();
  await page.waitForFunction(() => window.__eternal?.player.characterCreated);
  await expect(
    page.getByRole("dialog", { name: "Create your character", exact: true }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(() => ({
      name: window.__eternal.player.name,
      lineage: window.__eternal.player.lineage,
      appearance: window.__eternal.player.appearance,
    })),
  ).toEqual({ name: "Nyra V2", lineage: "demon", appearance });
  expect(errors).toEqual([]);
});

test("v2 sanctuary appearance editing preserves the character's progression and possessions", async ({
  page,
}) => {
  const errors = await boot(page);
  await ensureCharacter(page, { name: "Aster" });
  const before = await page.evaluate(() => {
    const p = window.__eternal.player;
    return {
      learned: p.learned,
      inventory: p.inventory,
      rank: p.rank,
      good: p.goodKarma,
      bad: p.badKarma,
      lifetimeGood: p.lifetimeGood,
      lifetimeBad: p.lifetimeBad,
    };
  });
  await page
    .getByRole("button", { name: "Character profile", exact: true })
    .click();
  const editor = page.getByRole("dialog", {
    name: "Customize your character",
    exact: true,
  });
  await expect(editor).toBeVisible();
  await editor.getByLabel("Character name", { exact: true }).fill("Aster Nova");
  await chooseAppearance(editor, {
    bodyType: "vanguard",
    hairStyle: 3,
    armorColor: "ember",
    auraColor: "gold",
  });
  await editor.getByRole("button", { name: "Continue", exact: true }).click();
  await editor
    .getByRole("button", { name: "Save your form", exact: true })
    .click();
  await expect(editor).toHaveCount(0);
  expect(
    await page.evaluate(() => {
      const p = window.__eternal.player;
      return {
        learned: p.learned,
        inventory: p.inventory,
        rank: p.rank,
        good: p.goodKarma,
        bad: p.badKarma,
        lifetimeGood: p.lifetimeGood,
        lifetimeBad: p.lifetimeBad,
      };
    }),
  ).toEqual(before);
  await page.reload();
  await page.waitForFunction(() => window.__eternal?.player.characterCreated);
  expect(
    await page.evaluate(() => ({
      name: window.__eternal.player.name,
      body: window.__eternal.player.appearance.bodyType,
      armor: window.__eternal.player.appearance.armorColor,
      aura: window.__eternal.player.appearance.auraColor,
    })),
  ).toEqual({
    name: "Aster Nova",
    body: "vanguard",
    armor: "ember",
    aura: "gold",
  });
  expect(errors).toEqual([]);
});

test("v2 minimap modes and the detailed atlas set a real waypoint in the expanded region", async ({
  page,
}) => {
  const errors = await boot(page);
  await ensureCharacter(page);
  expect(
    await page.evaluate(() => ({
      width: window.__eternal.world.width,
      height: window.__eternal.world.height,
    })),
  ).toEqual(
    expect.objectContaining({
      width: expect.any(Number),
      height: expect.any(Number),
    }),
  );
  expect(
    await page.evaluate(() => window.__eternal.world.width),
  ).toBeGreaterThanOrEqual(4800);
  expect(
    await page.evaluate(() => window.__eternal.world.height),
  ).toBeGreaterThanOrEqual(3600);
  await page
    .getByRole("button", { name: "Show whole region", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Show nearby area", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Toggle minimap legend", exact: true })
    .click();
  await expect(page.locator(".radar-legend")).toContainText("Landmarks");
  await page
    .getByRole("button", { name: "Open detailed region map", exact: true })
    .click();
  await expect(page.locator(".region-atlas")).toBeVisible();
  await expect(page.locator(".atlas-points > button").first()).toBeVisible();
  await page.locator(".atlas-points > button").first().click();
  const origin = await page.evaluate(() => ({
    x: window.__eternal.player.x,
    y: window.__eternal.player.y,
  }));
  await page
    .getByRole("button", { name: "Walk to waypoint", exact: true })
    .click();
  await expect(page.locator(".region-atlas")).toHaveCount(0);
  await expect
    .poll(
      () =>
        page.evaluate(
          ({ x, y }) =>
            Math.hypot(
              window.__eternal.player.x - x,
              window.__eternal.player.y - y,
            ),
          origin,
        ),
      { timeout: 8000 },
    )
    .toBeGreaterThan(10);
  expect(errors).toEqual([]);
});

test("E opens the creature offering card, explains missing materials, then gives and bonds exactly once", async ({
  page,
}) => {
  const errors = await boot(page);
  await ensureCharacter(page);
  const id = await page.evaluate(() => {
    const g = window.__eternal,
      contact = g.entities.find(
        (e) => e.canBond && e.role === "encounter-contact",
      );
    g.player.x = contact.x + 30;
    g.player.y = contact.y;
    g.player.inventory.herb = 0;
    g.destination = null;
    g.travelWaypoints = [];
    g.publish();
    return contact.id;
  });
  // Only starting location and supplies are fixtures. Selection, E, giving,
  // bonding and the second visit use the actual interface and validators.
  await page.waitForTimeout(350);
  await clickEntity(page, id);
  await page.keyboard.press("e");
  await expect(page.locator(".creature-interaction")).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Gather the missing materials",
      exact: true,
    }),
  ).toBeDisabled();
  await expect(page.locator(".creature-material-list")).toContainText(
    "1 more needed",
  );
  await page.evaluate(() => {
    window.__eternal.player.inventory.herb = 3;
    window.__eternal.publish();
  });
  await page
    .getByRole("button", { name: "Give requested materials", exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => window.__eternal.player.inventory.herb))
    .toBe(2);
  await expect(
    page.getByText("Materials received", { exact: true }),
  ).toBeVisible();
  const lifetime = await page.evaluate(
    () => window.__eternal.player.lifetimeGood,
  );
  await page
    .getByRole("button", { name: "Bond familiar", exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => !!window.__eternal.player.companion))
    .toBe(true);
  await closePanel(page);
  await page.keyboard.press("e");
  await expect(page.locator(".creature-interaction")).toBeVisible();
  await expect(
    page.getByText("Materials received", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Give requested materials", exact: true }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(() => window.__eternal.player.inventory.herb),
  ).toBe(2);
  expect(await page.evaluate(() => window.__eternal.player.lifetimeGood)).toBe(
    lifetime,
  );
  expect(errors).toEqual([]);
});

test("the v2 creator, radar and character windows fit a phone", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = await boot(page);
  await expect(
    page.getByRole("dialog", { name: "Create your character", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.screenshot({ path: "work/v2-creator-phone.png", fullPage: true });
  await ensureCharacter(page, { name: "Sera Mobile" });
  await page.screenshot({ path: "work/v2-game-phone.png", fullPage: true });
  await expect(page.locator(".actual-world-minimap")).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page
    .getByRole("button", { name: "Character profile", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Customize your character", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "work/v2-character-phone.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  expect(errors).toEqual([]);
});
