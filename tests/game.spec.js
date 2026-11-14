import { test, expect } from "@playwright/test";

test("keyboard movement, click targeting, casting and save persist a settled objective", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.waitForFunction(() => window.__eternal?.getSnapshot().player);
  const initial = await page.evaluate(
    () => window.__eternal.getSnapshot().player,
  );
  await page.keyboard.down("d");
  await expect
    .poll(() => page.evaluate(() => window.__eternal.getSnapshot().player.x))
    .toBeGreaterThan(initial.x + 10);
  await page.keyboard.up("d");
  const target = await page.evaluate(() => {
    const g = window.__eternal,
      n = g.entities.find((n) => n.id === "training"),
      r = document.querySelector("canvas").getBoundingClientRect();
    return { x: n.x - g.camera.x + r.left, y: n.y - g.camera.y + r.top };
  });
  await page.mouse.click(target.x, target.y);
  await expect
    .poll(() => page.evaluate(() => window.__eternal.getSnapshot().target?.id))
    .toBe("training");
  await page.keyboard.press("q");
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.__eternal
            .getSnapshot()
            .quests.find((q) => q.id === "first-light").complete,
      ),
    )
    .toBe(true);
  expect(
    await page.evaluate(
      () => window.__eternal.getSnapshot().player.lifetimeGood,
    ),
  ).toBe(25);
  await page.getByRole("button", { name: "Save journey" }).click();
  await page.reload();
  await page.waitForFunction(() => window.__eternal);
  expect(
    await page.evaluate(
      () => window.__eternal.getSnapshot().player.lifetimeGood,
    ),
  ).toBe(25);
  expect(
    await page.evaluate(
      () =>
        window.__eternal
          .getSnapshot()
          .quests.find((q) => q.id === "first-light").complete,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

test("all primary panels, advanced catalogs and transaction preview work", async ({
  page,
}) => {
  const failures = [];
  page.on("pageerror", (error) => failures.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 400)
      failures.push(`${response.status()} ${response.url()}`);
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Powers", exact: true }).click();
  await expect(
    page.getByText("Refreshing Mist", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Enhancements", exact: true }).click();
  await expect(page.getByText("Gentle Soul", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Cross-affinity", exact: true })
    .click();
  await expect(
    page.getByText("Purging Redemption", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "Inventory", exact: true }).click();
  await page
    .getByRole("button", { name: "Sanctuary exchange", exact: true })
    .click();
  await page.getByRole("button", { name: "25 · Buy", exact: true }).click();
  await expect(
    page.getByText("Confirm exchange", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () => window.__eternal.getSnapshot().player.inventory.draught,
      ),
    )
    .toBe(4);
  await expect
    .poll(() =>
      page.evaluate(() => window.__eternal.getSnapshot().player.goodKarma),
    )
    .toBe(100);
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page
    .getByRole("button", { name: "World map", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("button", { name: /Prismatic Waterfalls/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Prismatic Waterfalls/ }).click();
  await expect(
    page.getByRole("heading", { name: /Prismatic Waterfalls/, level: 1 }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Codex", exact: true }).click();
  await expect(page.locator(".codex-card")).toHaveCount(30);
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "Enable audio" }).click();
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const a = await import("/src/audio.js");
        return a.audio.context?.state;
      }),
    )
    .toBe("running");
  expect(failures).toEqual([]);
});

test("phone layout keeps world and controls within the screen", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator(".game-viewport > canvas")).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.getByRole("button", { name: "Powers", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.getByRole("button", { name: "Enhancements", exact: true }).click();
  await expect(page.getByText("Gentle Soul", { exact: true })).toBeVisible();
});
