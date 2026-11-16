import { test, expect } from "@playwright/test";
import { BRANCHES, ZONES } from "../src/data/manual.js";

async function boot(
  page,
  { name = "Nyra Wilds", lineage = "Demon", kit = "Emberbound" } = {},
) {
  const failures = [];
  page.on("pageerror", (error) => failures.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 400)
      failures.push(`${response.status()} ${response.url()}`);
  });
  await page.goto("/");
  const creator = page.getByRole("dialog", {
    name: "Create your legend",
    exact: true,
  });
  await expect(creator).toBeVisible();
  await page.screenshot({
    path: `work/v4-creator-${page.viewportSize().width < 600 ? "phone" : "desktop"}.png`,
    fullPage: true,
  });
  await creator.getByLabel("Character name", { exact: true }).fill(name);
  await creator
    .getByRole("button", { name: `Choose ${lineage}`, exact: true })
    .click();
  await creator
    .getByRole("button", { name: `Choose ${kit}`, exact: true })
    .click();
  await creator
    .getByRole("button", { name: "Enter the wilds", exact: true })
    .click();
  await expect(creator).toHaveCount(0);
  await page.waitForFunction(
    () => window.__eternalReborn?.player?.characterCreated,
  );
  return failures;
}
async function close(page) {
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
}
async function noOverflow(page, width) {
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(width);
}
async function aimAtTestEnemy(page) {
  const point = await page.evaluate(() => {
    const g = window.__eternalReborn,
      n = [...g.enemies, ...g.world.props].find((e) => e.id === g.__qaTargetId);
    const r = document.querySelector(".reborn-canvas").getBoundingClientRect();
    const p = g.renderer?.worldToScreen?.(n.x, n.y) || {
      x: n.x - (g.camera?.x || 0),
      y: n.y - (g.camera?.y || 0),
    };
    return { x: r.left + p.x, y: r.top + p.y };
  });
  await page.mouse.move(point.x, point.y);
}

test("new action onboarding opens every affinity immediately and keeps a chosen legend after travel and reload", async ({
  page,
}) => {
  test.setTimeout(60000);
  const failures = await boot(page, {
    name: "Lyra of the Wilds",
    lineage: "Angel",
    kit: "Tidecaller",
  });
  const starterIds = BRANCHES.map((branch) => branch.powers[0].id);
  const unlocked = await page.evaluate(() => {
    const g = window.__eternalReborn;
    return Array.from(
      g.unlocked instanceof Set || Array.isArray(g.unlocked)
        ? g.unlocked
        : Object.keys(g.unlocked || {}).filter((id) => g.unlocked[id]),
    );
  });
  for (const id of starterIds) expect(unlocked).toContain(id);
  await expect(page.getByTestId("power-slot-1")).toBeVisible();
  await expect(page.locator('[data-testid^="power-slot-"]')).toHaveCount(6);
  const frameTiming = await page.evaluate(async () => {
    const samples = [];
    let previous = performance.now();
    for (let i = 0; i < 45; i++) {
      const now = await new Promise(requestAnimationFrame);
      samples.push(now - previous);
      previous = now;
    }
    const warm = samples.slice(5).sort((a, b) => a - b);
    return {
      meanMs: warm.reduce((a, b) => a + b, 0) / warm.length,
      p95Ms: warm[Math.floor(warm.length * 0.95)],
    };
  });
  await test.info().attach("World frame timing", {
    body: JSON.stringify(frameTiming),
    contentType: "application/json",
  });
  expect(frameTiming.meanMs).toBeLessThan(100);
  await page.screenshot({ path: "work/v4-world-desktop.png", fullPage: true });
  const before = await page.evaluate(() => ({
    x: window.__eternalReborn.player.x,
    y: window.__eternalReborn.player.y,
  }));
  await page.keyboard.down("d");
  await expect
    .poll(() => page.evaluate(() => window.__eternalReborn.player.x))
    .toBeGreaterThan(before.x + 12);
  await page.keyboard.press("Space");
  await expect
    .poll(() => page.evaluate(() => window.__eternalReborn.player.x))
    .toBeGreaterThan(before.x + 85);
  await page.keyboard.up("d");
  await page
    .getByRole("button", { name: "Power library", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your power. Your rules.", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /^(Equip|Unlock) (?!to slot)/ }),
  ).toHaveCount(160);
  await page.screenshot({ path: "work/v4-powers-desktop.png", fullPage: true });
  await close(page);
  await page.getByRole("button", { name: "World map", exact: true }).click();
  let availableRegions = 0;
  for (const realm of ["earth", "heaven", "hell"]) {
    await page
      .locator(".wild-world-intro")
      .getByRole("button", { name: realm, exact: true })
      .click();
    const expectedCount = ZONES.filter(
      (z) => z.realm.toLowerCase() === realm,
    ).length;
    await expect(page.getByRole("button", { name: /^Travel to / })).toHaveCount(
      expectedCount,
    );
    availableRegions += expectedCount;
  }
  expect(availableRegions).toBe(39);
  await page
    .locator(".wild-world-intro")
    .getByRole("button", { name: "earth", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Travel to Prismatic Waterfalls",
      exact: true,
    })
    .click();
  await expect
    .poll(() => page.evaluate(() => window.__eternalReborn.world.id))
    .toBe("prismatic-waterfalls");
  await page.reload();
  await page.waitForFunction(
    () => window.__eternalReborn?.player?.characterCreated,
  );
  expect(
    await page.evaluate(() => ({
      name: window.__eternalReborn.player.name,
      lineage: window.__eternalReborn.player.lineage,
      zone: window.__eternalReborn.world.id,
    })),
  ).toEqual({
    name: "Lyra of the Wilds",
    lineage: "angel",
    zone: "prismatic-waterfalls",
  });
  expect(failures).toEqual([]);
});

test("aimed powers defeat a real creature, award progression, and unlock and equip another named power", async ({
  page,
}) => {
  test.setTimeout(60000);
  const failures = await boot(page);
  const baseline = await page.evaluate(() => {
    const g = window.__eternalReborn,
      n = g.enemies.find((e) => !e.boss && !e.elite);
    // Starting positions are the fixture. Damage, health, cooldowns, rewards,
    // unlocked powers and all combat progression retain their actual rules.
    g.player.x = g.world.spawn.x;
    g.player.y = g.world.spawn.y;
    n.x = g.player.x + 190;
    n.y = g.player.y;
    n.home = { x: n.x, y: n.y };
    g.__qaTargetId = n.id;
    return { kills: g.stats.kills, shards: g.player.shards, xp: g.player.xp };
  });
  await page.waitForTimeout(300);
  for (let i = 0; i < 8; i++) {
    const dead = await page.evaluate(
      () =>
        window.__eternalReborn.enemies.find(
          (e) => e.id === window.__eternalReborn.__qaTargetId,
        )?.dead,
    );
    if (dead) break;
    await aimAtTestEnemy(page);
    await page.keyboard.press("1");
    await page.waitForTimeout(550);
  }
  await expect
    .poll(() => page.evaluate(() => window.__eternalReborn.stats.kills))
    .toBeGreaterThan(baseline.kills);
  await page.keyboard.down("d");
  await expect
    .poll(() => page.evaluate(() => window.__eternalReborn.player.shards))
    .toBeGreaterThan(baseline.shards);
  await page.keyboard.up("d");
  expect(
    await page.evaluate(() => window.__eternalReborn.player.xp),
  ).toBeGreaterThan(baseline.xp);
  await page.screenshot({ path: "work/v4-combat-reward.png", fullPage: true });
  await page
    .getByRole("button", { name: "Power library", exact: true })
    .click();
  const powerName = BRANCHES.find((b) => b.id === "fire-destroy").powers[1]
    .name;
  await page
    .getByRole("button", { name: `Unlock ${powerName}`, exact: true })
    .click();
  await page
    .getByRole("button", { name: "Equip to slot 2", exact: true })
    .click();
  await page
    .getByRole("button", { name: `Equip ${powerName}`, exact: true })
    .click();
  await close(page);
  await expect(page.getByTestId("power-slot-2")).toHaveAttribute(
    "aria-label",
    `Cast ${powerName}`,
  );
  await page.evaluate(() => {
    const g = window.__eternalReborn,
      prop = g.world.props.find(
        (p) => p.destructible && !p.destroyed && p.health <= 32,
      );
    prop.x = g.player.x + 120;
    prop.y = g.player.y;
    g.__qaTargetId = prop.id;
  });
  await aimAtTestEnemy(page);
  await page.keyboard.press("2");
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.__eternalReborn.world.props.find(
            (p) => p.id === window.__eternalReborn.__qaTargetId,
          ).destroyed,
      ),
    )
    .toBe(true);
  await page.screenshot({
    path: "work/v4-power-world-interaction.png",
    fullPage: true,
  });
  await page.reload();
  await page.waitForFunction(
    () => window.__eternalReborn?.player?.characterCreated,
  );
  await expect(page.getByTestId("power-slot-2")).toHaveAttribute(
    "aria-label",
    `Cast ${powerName}`,
  );
  expect(failures).toEqual([]);
});

test("the new world, power library, region travel and pause controls fit a phone", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const failures = await boot(page, {
    name: "Aster Mobile",
    lineage: "Angel",
    kit: "Stormweaver",
  });
  await noOverflow(page, 390);
  await expect(page.locator(".reborn-canvas")).toBeVisible();
  await page.screenshot({ path: "work/v4-world-phone.png", fullPage: true });
  await page
    .getByRole("button", { name: "Power library", exact: true })
    .click();
  await noOverflow(page, 390);
  await expect(
    page.getByRole("button", { name: "Equip to slot 6", exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "work/v4-powers-phone.png", fullPage: true });
  await close(page);
  await page.getByRole("button", { name: "World map", exact: true }).click();
  await noOverflow(page, 390);
  await page.screenshot({ path: "work/v4-map-phone.png", fullPage: true });
  await close(page);
  await page.getByRole("button", { name: "Pause game", exact: true }).click();
  await noOverflow(page, 390);
  await page.screenshot({ path: "work/v4-pause-phone.png", fullPage: true });
  expect(failures).toEqual([]);
});
