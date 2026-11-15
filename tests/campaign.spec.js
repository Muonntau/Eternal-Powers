import { test, expect } from "@playwright/test";
import { ensureCharacter } from "./helpers/character.js";

async function boot(page) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 400)
      errors.push(`${response.status()} ${response.url()}`);
  });
  await page.goto("/");
  await page.waitForFunction(
    () => window.__eternal?.getSnapshot().contracts?.offers?.length === 3,
  );
  await ensureCharacter(page);
  return errors;
}

async function closePanel(page) {
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
}

test("the authored Grove evidence contract needs physical proof, offers a choice, and settles once", async ({
  page,
}) => {
  const errors = await boot(page);
  // Enter the actual two-second disguise so the isolated proof test can inspect
  // the Old Ruins without its guardian starting an unrelated combat encounter.
  await page.keyboard.press("v");
  await expect
    .poll(() => page.evaluate(() => window.__eternal.player.veil))
    .toBe(true);
  await page
    .getByRole("button", { name: "Campaign & contracts", exact: true })
    .click();
  await page.locator(".contract-list > button").first().click();
  await page
    .getByRole("button", { name: "Accept contract", exact: true })
    .click();
  const contract = await page.evaluate(
    () => window.__eternal.getSnapshot().contracts.offers[0],
  );
  expect(contract.title).toBe("The Grove’s Evidence");
  expect(contract.steps).toHaveLength(3);
  const before = await page.evaluate(
    () => window.__eternal.player.lifetimeGood,
  );

  // Merely clicking Perform from the sanctuary is not evidence for the distant ruin.
  await page
    .locator(".contract-steps > article")
    .nth(1)
    .getByRole("button", { name: "Perform step", exact: true })
    .click();
  expect(
    await page.evaluate(
      () => window.__eternal.getSnapshot().contracts.offers[0].progress,
    ),
  ).toBe(0);

  for (let index = 0; index < contract.steps.length; index++) {
    const step = contract.steps[index];
    // Fixture travel changes only the avatar's location; the real UI and
    // contract validator still enforce step order, evidence, and dialogue.
    await page.evaluate(({ x, y }) => {
      const g = window.__eternal;
      g.player.x = x;
      g.player.y = y;
      g.destination = null;
      g.travelWaypoints = [];
      g.publish();
    }, step);
    const row = page.locator(".contract-steps > article").nth(index);
    if (step.choices?.length) {
      await row
        .getByRole("button", { name: "Consider choices", exact: true })
        .click();
      await page
        .locator(".contract-dialogue")
        .getByRole("button", { name: /Present the two inspected records/ })
        .click();
    } else {
      await row
        .getByRole("button", { name: "Perform step", exact: true })
        .click();
    }
    await expect
      .poll(() =>
        page.evaluate(
          () => window.__eternal.getSnapshot().contracts.offers[0].progress,
        ),
      )
      .toBe(index + 1);
  }

  await page
    .getByRole("button", { name: "Settle completed contract", exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(
        () => window.__eternal.getSnapshot().contracts.offers[0].status,
      ),
    )
    .toBe("complete");
  expect(await page.evaluate(() => window.__eternal.player.lifetimeGood)).toBe(
    before + contract.reward.amount,
  );
  expect(
    await page.evaluate(
      (id) =>
        window.__eternal.contracts.receipts.filter(
          (r) => r.type === "contract-settled" && r.contractId === id,
        ).length,
      contract.id,
    ),
  ).toBe(1);
  await page.reload();
  await page.waitForFunction(() => window.__eternal?.getSnapshot().contracts);
  expect(
    await page.evaluate(
      () => window.__eternal.getSnapshot().contracts.offers[0].status,
    ),
  ).toBe("complete");
  expect(await page.evaluate(() => window.__eternal.player.lifetimeGood)).toBe(
    before + contract.reward.amount,
  );
  expect(errors).toEqual([]);
});

test("opposing practice and all certification gates are actionable through the Social panel", async ({
  page,
}) => {
  const errors = await boot(page);
  await page.evaluate(() => {
    const g = window.__eternal;
    g.player.rank = 3;
    g.player.goodKarma = 750;
    g.player.lifetimeGood = 2000;
    g.recordCooperativeObjective("qa:shared-route", {
      type: "cooperative",
      partnerId: "keeper",
    });
    g.publish();
  });
  await page
    .getByRole("button", { name: "Standing & recovery", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Affinity trials", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Complete certification · 500 Karma",
      exact: true,
    }),
  ).toBeDisabled();
  await page
    .getByRole("combobox", { name: "Opposing practice branch" })
    .selectOption("hate-clean");
  await page
    .getByRole("button", { name: "Begin practice", exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.__eternal.getSnapshot().certification.practiceTrial?.branchId,
      ),
    )
    .toBe("hate-clean");
  await page.keyboard.press("q");
  await expect
    .poll(() =>
      page.evaluate(
        () => window.__eternal.getSnapshot().certification.practiceMet,
      ),
    )
    .toBe(true);
  expect(
    await page.evaluate(() => window.__eternal.player.learned["hate-clean"]),
  ).toBeUndefined();
  await page
    .getByRole("button", { name: "Standing & recovery", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Affinity trials", exact: true })
    .click();
  const beforeCertification = await page.evaluate(() => ({
    coins: window.__eternal.player.goodKarma,
    lifetime: window.__eternal.player.lifetimeGood,
  }));
  await page
    .getByRole("button", {
      name: "Complete certification · 500 Karma",
      exact: true,
    })
    .click();
  await expect
    .poll(() => page.evaluate(() => window.__eternal.player.certified))
    .toBe(true);
  expect(await page.evaluate(() => window.__eternal.player.goodKarma)).toBe(
    beforeCertification.coins - 500,
  );
  expect(await page.evaluate(() => window.__eternal.player.lifetimeGood)).toBe(
    beforeCertification.lifetime,
  );
  await expect(
    page.getByRole("button", { name: "Certification complete", exact: true }),
  ).toBeDisabled();
  expect(errors).toEqual([]);
});

test("the recovery overlay revives through a nearby ally and retains possessions on timed recall", async ({
  page,
}) => {
  const errors = await boot(page);
  const before = await page.evaluate(() => ({
    inventory: structuredClone(window.__eternal.player.inventory),
    learned: structuredClone(window.__eternal.player.learned),
    karma: window.__eternal.player.goodKarma,
  }));
  await page.evaluate(() => {
    const g = window.__eternal,
      keeper = g.entities.find((n) => n.id === "keeper");
    keeper.x = g.player.x + 35;
    keeper.y = g.player.y;
    g.damagePlayer(1000, "Recovery fixture");
  });
  await expect
    .poll(() => page.evaluate(() => window.__eternal?.downed))
    .toBe(true);
  const remaining = await page.evaluate(
    () => window.__eternal.getSnapshot().recovery.remaining,
  );
  expect(remaining).toBeGreaterThan(18);
  expect(remaining).toBeLessThanOrEqual(20);
  await expect(
    page
      .locator(".recovery-overlay")
      .getByRole("button", { name: "Recall to sanctuary", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Request nearby ally revive", exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(
        () => window.__eternal.getSnapshot().recovery.revive?.remaining,
      ),
    )
    .toBeGreaterThan(0);
  await expect
    .poll(() => page.evaluate(() => window.__eternal?.downed), {
      timeout: 8000,
    })
    .toBe(false);
  const revived = await page.evaluate(() => window.__eternal.player.health);
  expect(revived).toBeGreaterThanOrEqual(25);
  expect(revived).toBeLessThan(30);

  await page.evaluate(() => {
    const g = window.__eternal;
    g.damagePlayer(1000, "Second recovery fixture");
  });
  await expect
    .poll(() => page.evaluate(() => window.__eternal?.downed))
    .toBe(true);
  // The countdown is the only timer fixture; recall itself executes the real rule.
  await page.evaluate(() => {
    window.__eternal.progression.recovery.remaining = 0.01;
  });
  await expect
    .poll(() => page.evaluate(() => window.__eternal?.downed))
    .toBe(false);
  const after = await page.evaluate(() => ({
    inventory: window.__eternal.player.inventory,
    learned: window.__eternal.player.learned,
    karma: window.__eternal.player.goodKarma,
    health: window.__eternal.player.health,
  }));
  expect(after.inventory).toEqual(before.inventory);
  expect(after.learned).toEqual(before.learned);
  expect(after.karma).toBe(before.karma);
  expect(after.health).toBeGreaterThanOrEqual(50);
  expect(after.health).toBeLessThan(55);
  expect(errors).toEqual([]);
});

test("a manual alchemy recipe exposes its plan price and consumes its printed inputs once", async ({
  page,
}) => {
  const errors = await boot(page);
  await page.evaluate(() => {
    const g = window.__eternal;
    g.player.inventory.herb = 4;
    g.player.inventory.residue = 2;
    delete g.sanctuary.recipePlans.draught;
    g.publish();
  });
  const before = await page.evaluate(() => ({
    coins: window.__eternal.player.goodKarma,
    lifetime: window.__eternal.player.lifetimeGood,
    draught: window.__eternal.player.inventory.draught,
  }));
  await page.getByRole("button", { name: "Inventory", exact: true }).click();
  await page.getByRole("button", { name: "Craft items", exact: true }).click();
  const recipe = page.locator(".shop-item").filter({
    has: page.getByRole("heading", {
      name: /Restorative [Dd]raught/,
      exact: true,
    }),
  });
  await expect(
    recipe.getByRole("button", { name: "Plan required", exact: true }),
  ).toBeDisabled();
  await recipe
    .getByRole("button", { name: "Learn recipe plan · 50 Karma", exact: true })
    .click();
  expect(await page.evaluate(() => window.__eternal.player.goodKarma)).toBe(
    before.coins - 50,
  );
  expect(await page.evaluate(() => window.__eternal.player.lifetimeGood)).toBe(
    before.lifetime,
  );
  await recipe.getByRole("button", { name: "Craft", exact: true }).click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => !!window.__eternal.shop.pendingCraft), {
      timeout: 10000,
    })
    .toBe(false);
  expect(
    await page.evaluate(() => window.__eternal.player.inventory.herb),
  ).toBe(2);
  expect(
    await page.evaluate(() => window.__eternal.player.inventory.residue),
  ).toBe(1);
  expect(
    await page.evaluate(() => window.__eternal.player.inventory.draught),
  ).toBe(before.draught + 1);
  expect(errors).toEqual([]);
});

test("new campaign and standing panels fit a phone without losing their actions", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = await boot(page);
  await page
    .getByRole("button", { name: "Campaign & contracts", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Accept contract", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await closePanel(page);
  await page
    .getByRole("button", { name: "Standing & recovery", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Affinity trials", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Begin practice", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  expect(errors).toEqual([]);
});

test("NPC barter previews freely, releases cancelled escrow, and settles both sides once", async ({
  page,
}) => {
  const errors = await boot(page);
  await page.evaluate(() => {
    const g = window.__eternal;
    g.player.inventory.crystal = 1;
    g.player.inventory.wood = 0;
    g.player.inventory.stone = 0;
    g.publish();
  });
  const lifetime = await page.evaluate(
    () => window.__eternal.player.lifetimeGood,
  );
  await page
    .getByRole("button", { name: "Campaign & contracts", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Secure barter", exact: true })
    .click();
  const offer = page.locator(".barter-offers > article").filter({
    has: page.getByRole("heading", {
      name: "Crystal for building supplies",
      exact: true,
    }),
  });
  await offer
    .getByRole("button", { name: "Inspect exchange", exact: true })
    .click();
  expect(
    await page.evaluate(() => window.__eternal.player.inventory.crystal),
  ).toBe(1);
  await page.getByRole("button", { name: "Lock offer", exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(() => window.__eternal.contracts.barterQuote?.status),
    )
    .toBe("locked");
  expect(
    await page.evaluate(() => window.__eternal.player.inventory.crystal),
  ).toBe(0);
  expect(
    await page.evaluate(() => window.__eternal.player.inventory.wood),
  ).toBe(0);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(
    await page.evaluate(() => window.__eternal.player.inventory.crystal),
  ).toBe(1);
  await offer
    .getByRole("button", { name: "Inspect exchange", exact: true })
    .click();
  await page.getByRole("button", { name: "Lock offer", exact: true }).click();
  await page
    .getByRole("button", { name: "Commit exchange", exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(() => window.__eternal.contracts.barterQuote?.status),
    )
    .toBe("settled");
  const after = await page.evaluate(() => ({
    crystal: window.__eternal.player.inventory.crystal,
    wood: window.__eternal.player.inventory.wood,
    stone: window.__eternal.player.inventory.stone,
    lifetime: window.__eternal.player.lifetimeGood,
    receipts: window.__eternal.contracts.receipts.filter(
      (r) => r.type === "barter-settled",
    ).length,
  }));
  expect(after).toEqual({
    crystal: 0,
    wood: 2,
    stone: 1,
    lifetime,
    receipts: 1,
  });
  await expect(
    page.getByRole("button", { name: "Commit exchange", exact: true }),
  ).toHaveCount(0);
  expect(errors).toEqual([]);
});
