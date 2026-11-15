import { test, expect } from "@playwright/test";
import { ensureCharacter } from "./helpers/character.js";

async function boot(page) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.waitForFunction(() => window.__eternal?.getSnapshot().sanctuary);
  await ensureCharacter(page);
  return errors;
}

async function closePanel(page) {
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
}

async function openCrafting(page) {
  await page.getByRole("button", { name: "Inventory", exact: true }).click();
  await page.getByRole("button", { name: "Craft items", exact: true }).click();
}

test("construction placement, undo, and sanctuary storage conserve materials", async ({
  page,
}) => {
  const errors = await boot(page);
  await page.evaluate(() => {
    const g = window.__eternal;
    g.player.inventory.stone = 12;
    g.publish();
  });
  await page.getByRole("button", { name: "Sanctuary", exact: true }).click();
  await page
    .getByRole("button", { name: "Place Stone floor", exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(() => window.__eternal.sanctuary.components.length),
    )
    .toBe(1);
  expect(
    await page.evaluate(() => window.__eternal.player.inventory.stone),
  ).toBe(10);

  await page
    .getByRole("button", { name: "Undo last edit", exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(() => window.__eternal.sanctuary.components.length),
    )
    .toBe(0);
  expect(
    await page.evaluate(() => window.__eternal.player.inventory.stone),
  ).toBe(12);
  await page
    .getByRole("button", { name: "Undo last edit", exact: true })
    .click();
  expect(
    await page.evaluate(() => window.__eternal.player.inventory.stone),
  ).toBe(12);

  await page.getByRole("button", { name: "Storage", exact: true }).click();
  const stone = page.locator(".storage-row").filter({ hasText: "Runestone" });
  await stone.getByTitle("Deposit one").click();
  await expect
    .poll(() => page.evaluate(() => window.__eternal.sanctuary.bank.stone))
    .toBe(1);
  expect(
    await page.evaluate(() => window.__eternal.player.inventory.stone),
  ).toBe(11);
  await stone.getByTitle("Withdraw one").click();
  await expect
    .poll(() => page.evaluate(() => window.__eternal.sanctuary.bank.stone))
    .toBe(0);
  expect(
    await page.evaluate(() => window.__eternal.player.inventory.stone),
  ).toBe(12);
  expect(errors).toEqual([]);
});

test("a committed craft pauses away from its station and resumes without charging twice", async ({
  page,
}) => {
  const errors = await boot(page);
  await page.evaluate(() => {
    const g = window.__eternal;
    g.player.inventory.herb = 10;
    g.player.inventory.residue = 2;
    g.sanctuary.recipePlans.draught = true;
    g.publish();
  });
  const before = await page.evaluate(
    () => window.__eternal.player.inventory.draught,
  );
  await openCrafting(page);
  const recipe = page.locator(".shop-item").filter({
    has: page.getByRole("heading", {
      name: /Restorative draught/i,
      exact: true,
    }),
  });
  await recipe.getByRole("button", { name: "Craft", exact: true }).click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => window.__eternal.shop.pendingCraft?.status))
    .toBe("preparing");
  expect(
    await page.evaluate(() => window.__eternal.player.inventory.herb),
  ).toBe(8);

  // Actual movement leaves and returns to the station; only starting supplies are fixtures.
  await closePanel(page);
  await page.keyboard.down("Shift");
  await page.keyboard.down("a");
  await expect
    .poll(() => page.evaluate(() => window.__eternal.player.x), {
      timeout: 8000,
    })
    .toBeLessThan(730);
  await page.keyboard.up("a");
  await page.keyboard.up("Shift");
  await expect
    .poll(() => page.evaluate(() => window.__eternal.shop.pendingCraft?.status))
    .toBe("paused");
  await openCrafting(page);
  await expect(
    page.getByRole("button", { name: "Resume at station", exact: true }),
  ).toBeVisible();
  await closePanel(page);
  await page.keyboard.down("Shift");
  await page.keyboard.down("d");
  await expect
    .poll(() => page.evaluate(() => window.__eternal.player.x), {
      timeout: 8000,
    })
    .toBeGreaterThan(900);
  await page.keyboard.up("d");
  await page.keyboard.up("Shift");
  await openCrafting(page);
  await page
    .getByRole("button", { name: "Resume at station", exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => !!window.__eternal.shop.pendingCraft), {
      timeout: 10000,
    })
    .toBe(false);
  expect(
    await page.evaluate(() => window.__eternal.player.inventory.herb),
  ).toBe(8);
  expect(
    await page.evaluate(() => window.__eternal.player.inventory.draught),
  ).toBe(before + 1);
  expect(errors).toEqual([]);
});

test("ritual preview reserves resources, commits a stage, and supports paid owner reversal", async ({
  page,
}) => {
  const errors = await boot(page);
  await page.evaluate(() => {
    const g = window.__eternal;
    g.player.rank = 10;
    g.player.learned["water-grow"] = 10;
    g.player.goodKarma = 100000;
    g.player.essence = 100;
    g.trialRanks = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    g.publish();
  });
  await page.getByRole("button", { name: "World model", exact: true }).click();
  await page
    .getByRole("button", { name: "Ritual projects", exact: true })
    .click();
  await page.locator(".ritual-select select").selectOption("water-grow-5");
  await page
    .getByRole("button", { name: "Preview world project", exact: true })
    .click();
  await expect(page.getByText("ELIGIBLE", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.__eternal.player.goodKarma)).toBe(
    100000,
  );

  await page
    .getByRole("button", { name: "Reserve & prepare", exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(() => window.__eternal.worldSystems.active()?.status),
    )
    .toBe("preparing");
  expect(await page.evaluate(() => window.__eternal.player.goodKarma)).toBe(
    97500,
  );
  // Advance the preparation fixture rather than spending 35 real seconds in this UI regression.
  await page.evaluate(() => {
    window.__eternal.worldSystems.active().preparationRemaining = 0.01;
  });
  await expect
    .poll(() =>
      page.evaluate(() => window.__eternal.worldSystems.active()?.status),
    )
    .toBe("ready");
  await page
    .getByRole("button", { name: "Commit world project", exact: true })
    .click();
  await expect
    .poll(
      () =>
        page.evaluate(() => window.__eternal.worldSystems.conditions.length),
      { timeout: 10000 },
    )
    .toBe(1);
  expect(
    await page.evaluate(
      () => window.__eternal.worldSystems.conditions[0].stageHistory.length,
    ),
  ).toBe(1);
  expect(
    await page.evaluate(
      () => window.__eternal.worldSystems.regions["sacred-groves"].vitality,
    ),
  ).toBe(83);

  await page
    .getByRole("button", { name: "World conditions", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Owner reversal", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm reversal", exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(() => window.__eternal.worldSystems.conditions[0].active),
    )
    .toBe(false);
  expect(await page.evaluate(() => window.__eternal.player.goodKarma)).toBe(
    96875,
  );
  expect(errors).toEqual([]);
});

test("a posted creature offering creates one optional familiar and lets its owner select support", async ({
  page,
}) => {
  const errors = await boot(page);
  // Start beside the neutral contact; choosing, offering, bonding, and support all use UI.
  await page.evaluate(() => {
    const g = window.__eternal,
      familiar = g.entities.find((e) => e.canBond);
    g.player.inventory.herb = 3;
    g.player.x = familiar.x + 35;
    g.player.y = familiar.y + 35;
    g.publish();
  });
  await page.waitForTimeout(700);
  const point = await page.evaluate(() => {
    const g = window.__eternal,
      familiar = g.entities.find((e) => e.canBond),
      rect = document.querySelector("canvas").getBoundingClientRect();
    return {
      x: familiar.x - g.camera.x + rect.left,
      y: familiar.y - g.camera.y + rect.top,
    };
  });
  await page.mouse.click(point.x, point.y);
  await page
    .getByRole("button", { name: "Inspect target", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Give requested materials", exact: true })
    .click();
  expect(
    await page.evaluate(() => window.__eternal.player.inventory.herb),
  ).toBe(2);
  await expect(
    page.getByRole("button", { name: "Give requested materials", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Materials received", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => window.__eternal.player.inventory.herb),
  ).toBe(2);
  await page
    .getByRole("button", { name: "Bond familiar", exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(() => window.__eternal.player.companion?.creatureId),
    )
    .toBe("celestial-familiars");
  expect(
    await page.evaluate(
      () =>
        window.__eternal.entities.filter((e) => e.id === "active-familiar")
          .length,
    ),
  ).toBe(1);
  await closePanel(page);
  await page.locator(".system-companion").click();
  await page
    .getByRole("button", { name: "Grant a barrier", exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => window.__eternal.player.companion.mode))
    .toBe("barrier");
  expect(errors).toEqual([]);
});

test("sanctuary respecialization previews a recorded purchase and settles once", async ({
  page,
}) => {
  const errors = await boot(page);
  await page.evaluate(() => {
    const game = window.__eternal;
    game.player.rank = 2;
    game.player.goodKarma = 1000;
    game.publish();
  });
  const lifetime = await page.evaluate(
    () => window.__eternal.player.lifetimeGood,
  );
  await page.getByRole("button", { name: "Powers", exact: true }).click();
  await page
    .getByRole("button", { name: "Train next level", exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(() => window.__eternal.player.learned["water-grow"]),
    )
    .toBe(2);
  expect(await page.evaluate(() => window.__eternal.player.goodKarma)).toBe(
    600,
  );
  await page.getByText("Respecialize this branch", { exact: true }).click();
  await page.getByLabel("Retain through level").selectOption("1");
  await page
    .getByRole("button", { name: "Preview refund", exact: true })
    .click();
  const quote = await page.evaluate(
    () => window.__eternal.respecialization.preview,
  );
  expect(quote.refund).toBe(400);
  expect(await page.evaluate(() => window.__eternal.player.goodKarma)).toBe(
    600,
  );
  await page
    .getByRole("button", { name: "Confirm respecialization", exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(() => window.__eternal.player.learned["water-grow"]),
    )
    .toBe(1);
  expect(await page.evaluate(() => window.__eternal.player.goodKarma)).toBe(
    1000,
  );
  expect(
    await page.evaluate(
      (id) => window.__eternal.commitRespecialization(id),
      quote.id,
    ),
  ).toBe(false);
  expect(await page.evaluate(() => window.__eternal.player.goodKarma)).toBe(
    1000,
  );
  expect(await page.evaluate(() => window.__eternal.player.lifetimeGood)).toBe(
    lifetime,
  );
  await page.reload();
  await page.waitForFunction(() => window.__eternal?.respecialization);
  expect(
    await page.evaluate(
      () => window.__eternal.respecialization.receipts.length,
    ),
  ).toBe(1);
  expect(
    await page.evaluate(() => window.__eternal.player.learned["water-grow"]),
  ).toBe(1);
  expect(errors).toEqual([]);
});
