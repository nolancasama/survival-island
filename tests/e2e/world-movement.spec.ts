import { expect, test } from "@playwright/test";
import { boot, hook, state, waitFor } from "./helpers";
import { BRIDGE } from "../../src/game/world/island";
import { BRIDGE_DECK_Y } from "../../src/game/world/surface";

for (const running of [false, true]) {
  test(`${running ? "running" : "walking"}: bridge feet follow both banks and the deck at both edges`, async ({ page }) => {
    const errors = await boot(page);
    await hook(page, "showWorld");
    await hook(page, "setGates", { pathCleared: true, bridgeBuilt: true });
    await hook(page, "setCameraFollow", 0);
    for (const [start, key, edge] of [
      [BRIDGE.x + 3.25, "KeyA", -0.38],
      [BRIDGE.x - 3.25, "KeyD", 0.38]
    ] as const) {
      await hook(page, "goto", start, BRIDGE.z + edge, BRIDGE.x, BRIDGE.z);
      await hook(page, "setCameraFollow", 0);
      if (running) await page.keyboard.down("ShiftLeft");
      await page.keyboard.down(key);
      await waitFor(page, (s, x) => Math.abs(s.player.x - x) < 1.3, 20_000, BRIDGE.x);
      const onDeck = await hook<{ player: { x: number; y: number; z: number } }>(page, "state");
      expect(onDeck.player.y).toBeCloseTo(BRIDGE_DECK_Y, 3);
      expect(onDeck.player.z).toBeCloseTo(BRIDGE.z + edge, 2);
      await waitFor(page, (s, target) => target.key === "KeyA" ? s.player.x < target.x : s.player.x > target.x, 20_000, {
        key, x: BRIDGE.x + (key === "KeyA" ? -3.15 : 3.15)
      });
      await page.keyboard.up(key);
      if (running) await page.keyboard.up("ShiftLeft");
    }
    // An unbuilt crossing and the river beside the planks remain closed.
    await hook(page, "setGates", { bridgeBuilt: false });
    await hook(page, "goto", BRIDGE.x + 3.25, BRIDGE.z, BRIDGE.x, BRIDGE.z);
    await page.keyboard.down("KeyA");
    const t = (await state(page)).time;
    await waitFor(page, (s, time) => s.time > time + 1.5, 20_000, t);
    await page.keyboard.up("KeyA");
    expect((await state(page)).player.x).toBeGreaterThan(-27.7);
    expect(errors).toEqual([]);
  });
}

for (const route of [
  { yaw: 0, lane: 995.4, west: "KeyA", south: "KeyS" },
  { yaw: Math.PI / 2, lane: 997.1, west: "KeyW", south: "KeyA" }
]) test(`cave exits by walking from chamber through entrance lane ${route.lane} with camera yaw ${route.yaw}`, async ({ page }) => {
  const errors = await boot(page);
  await hook(page, "showWorld");
  await hook(page, "setGates", { pathCleared: true });
  await hook(page, "setInCave", true);
  const arrival = (await state(page)).time;
  await waitFor(page, (s, t) => s.time > t + 0.7, 20_000, arrival);
  expect((await state(page)).inCave).toBe(true);
  // Setup is in the chamber. Every metre from here to the exit uses actual keyboard movement.
  await hook(page, "goto", 1000, 984, 1000, 980);
  await hook(page, "setCameraFollow", route.yaw);
  await page.keyboard.down(route.west);
  await waitFor(page, (s, lane) => s.player.x <= lane + 0.3, 20_000, route.lane);
  await page.keyboard.up(route.west);
  expect((await state(page)).inCave).toBe(true);
  await page.keyboard.down(route.south);
  await waitFor(page, (s) => s.inCave && s.player.z >= 992);
  expect((await state(page)).mode).toBe("explore");
  await waitFor(page, (s) => !s.inCave, 30_000);
  await page.keyboard.up(route.south);
  await waitFor(page, (s) => s.mode === "explore" && s.fade === 0);
  const outside = await state(page);
  expect(outside.player.x).toBeCloseTo(22, 1);
  expect(outside.player.z).toBeCloseTo(-41.7, 1);
  expect(outside.prompt).toBeNull();
  expect(errors).toEqual([]);
});
