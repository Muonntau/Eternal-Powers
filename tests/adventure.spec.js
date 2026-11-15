import { test, expect } from "@playwright/test";
import { ensureCharacter } from "./helpers/character.js";
async function boot(page, lineage = "angel") {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => {
    if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
  });
  await page.goto("/");
  await ensureCharacter(page, {
    name: lineage === "angel" ? "Lyra Concord" : "Kael Unbound",
    lineage,
    starterBranch: lineage === "angel" ? "water-grow" : "fire-create",
  });
  return errors;
}
async function inspect(page, role) {
  const point = await page.evaluate((role) => {
    const g = window.__eternal,
      n = g.entities.find(
        (n) => n.role === role || n.kind === role || n.activityType === role,
      );
    g.player.x = n.x - 30;
    g.player.y = n.y;
    g.destination = null;
    g.travelWaypoints = [];
    g.publish();
    return n.id;
  }, role);
  await page.waitForTimeout(200);
  await page.evaluate((id) => window.__eternal.openInteraction(id), point);
  await expect(page.locator(".interaction-panel")).toBeVisible();
}
for (const lineage of ["angel", "demon"])
  test(`${lineage} receives a clear campaign, real story choices and reactive power interactions`, async ({
    page,
  }) => {
    test.setTimeout(60000);
    const errors = await boot(page, lineage);
    const tracker = page.getByRole("complementary", {
      name: "Current campaign objective",
    });
    await expect(tracker).toBeVisible();
    const map = await page.locator(".navigation-radar").boundingBox(),
      box = await tracker.boundingBox();
    expect(box.y).toBeGreaterThanOrEqual(map.y + map.height);
    expect(Math.abs(box.x - map.x)).toBeLessThan(3);
    await inspect(page, "campaign-mentor");
    await expect(page.locator(".interaction-purpose")).toHaveCount(0);
    await expect(page.locator(".interaction-identity")).toContainText("envoy");
    await page.locator(".interaction-actions .primary-button").first().click();
    await expect(page.locator(".interaction-actions")).toContainText(
      "Claim 50",
    );
    await page.getByRole("button", { name: /Claim 50/ }).click();
    await expect(tracker).toContainText(
      lineage === "angel" ? "A Power with Purpose" : "An Ember of Your Own",
    );
    await page
      .getByRole("button", { name: "Close dialog", exact: true })
      .click();
    await inspect(page, "dummy");
    await page
      .getByRole("button", { name: "Practice selected power", exact: true })
      .click();
    await expect(page.locator(".modal-interact")).toHaveCount(0);
    await expect(tracker).toContainText("Return to your envoy");
    await inspect(page, "campaign-mentor");
    await page.getByRole("button", { name: /Claim 65/ }).click();
    await page
      .getByRole("button", { name: "Close dialog", exact: true })
      .click();
    await inspect(page, "resonator");
    await expect(page.locator(".activity-console")).toContainText("0 / 2");
    await page
      .getByRole("button", { name: "Cast selected power", exact: true })
      .click();
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            window.__eternal.adventure.activities["sacred-groves:resonator"]
              .step,
        ),
      )
      .toBe(1);
    await inspect(page, "resonator");
    await page
      .getByRole("button", { name: "Cast selected power", exact: true })
      .click();
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            window.__eternal.adventure.activities["sacred-groves:resonator"]
              .ready,
        ),
      )
      .toBe(true);
    await inspect(page, "resonator");
    await page
      .getByRole("button", { name: "Collect materials", exact: true })
      .click();
    await expect(tracker).toContainText("Return to your envoy");
    await page.screenshot({
      path: `work/v3-${lineage}-interaction.png`,
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Close dialog", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Faction campaign", exact: true })
      .click();
    await expect(page.locator(".campaign-missions article")).toHaveCount(12);
    await page.screenshot({
      path: `work/v3-${lineage}-campaign.png`,
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Regional power challenges", exact: true })
      .click();
    await expect(page.locator(".activity-cards article")).toHaveCount(6);
    await page
      .getByRole("button", { name: "Close dialog", exact: true })
      .click();
    await page.reload();
    await page.waitForFunction(() => window.__eternal?.player.characterCreated);
    await expect(tracker).toContainText("Return to your envoy");
    expect(errors).toEqual([]);
  });
test("campaign and purpose windows fit a phone with the objective directly below the minimap", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = await boot(page);
  await expect(page.locator(".objective-tracker")).toBeVisible();
  await page.screenshot({ path: "work/v3-phone-world.png", fullPage: true });
  await inspect(page, "runegate");
  await expect(page.locator(".rune-sequence")).toContainText("132");
  await page.getByRole("button", { name: "Align note 1", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Align note 1", exact: true }),
  ).toHaveClass(/active/);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.screenshot({ path: "work/v3-phone-rune.png", fullPage: true });
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await inspect(page, "world-landmark");
  await page
    .getByRole("button", { name: "Find nearby power challenges", exact: true })
    .click();
  await expect(page.locator(".activity-cards article")).toHaveCount(6);
  await page.screenshot({
    path: "work/v3-phone-activities.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
