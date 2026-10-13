import { expect, test, type Page } from "@playwright/test";
import { boot, firstNode, goTo, hook, promptClosed, promptOpen, setSpeech, speak, startGame, state, tap, waitFor } from "./helpers";

/** Gather up to `n` of a kind. Returns how many pickups needed English (only the first should). */
async function gather(page: Page, kind: string, n: number, answer: (page: Page) => Promise<void>): Promise<number> {
  let prompts = 0;
  for (let guard = 0; guard < 8; guard++) {
    if (((await state(page)).bag[kind] ?? 0) >= n) return prompts;
    await goTo(page, await firstNode(page, kind));
    const before = (await state(page)).bag[kind] ?? 0;
    await page.keyboard.press("KeyE");
    await page.waitForTimeout(150);
    if ((await state(page)).prompt) {
      prompts++;
      await answer(page);
    }
    await waitFor(page, (s) => s.mode === "explore");
    expect((await state(page)).bag[kind] ?? 0).toBe(before + 1);
  }
  return prompts;
}

test("speech: the whole Day 1 loop, from waking up to the campfire", async ({ page }) => {
  const errors = await boot(page);
  await startGame(page, "speak");
  let s = await state(page);
  expect(s.beacons.length).toBeGreaterThan(0); // "I'm hungry." lights up coconuts
  expect(s.step).toBe("eat");

  await goTo(page, await firstNode(page, "coconut"));
  await page.keyboard.press("KeyE");
  await speak(page, "get the coconut");
  await page.keyboard.press("KeyF");
  await speak(page, "eat the coconut");
  s = await state(page);
  expect(s.quest.done).toContain("eat");
  expect(s.stats.food).toBeGreaterThan(60);

  // Kai: "What do you need?" -> wood; "Can you make a fire?" -> yes.
  await goTo(page, "kai");
  await page.keyboard.press("KeyE");
  await waitFor(page, (st) => st.prompt?.question === "What do you need?");
  await speak(page, "I need wood");
  await waitFor(page, (st) => st.prompt?.question === "Can you make a fire?");
  await speak(page, "yes I can");
  await waitFor(page, (st) => st.mode === "explore");
  s = await state(page);
  expect(s.metKai).toBe(true);
  expect(s.kai).toEqual({ need: "wood", canFire: true });
  expect(s.unlocked).toContain("campfire");
  expect(s.bag.wood).toBe(1); // Kai's gift for "I need wood."

  // Kai gave one wood, so two more to find; two stones. Only the first of each kind is spoken.
  expect(await gather(page, "wood", 3, (p) => speak(p, "get the wood"))).toBe(1);
  expect(await gather(page, "stone", 2, (p) => speak(p, "get the stone"))).toBe(1);
  s = await state(page);
  expect(s.quest.done).toEqual(expect.arrayContaining(["wood", "stone"]));

  await hook(page, "teleport", 1, 6, Math.PI);
  await page.keyboard.press("KeyC");
  await expect(page.getByTestId("craft")).toBeVisible();
  await page.getByTestId("make-campfire").click();
  await waitFor(page, (st) => st.prompt?.question === "What do you want to make?");
  await speak(page, "I want to make a campfire");
  await waitFor(page, (st) => st.mode === "place");
  s = await state(page);
  expect(s.bag.wood ?? 0).toBe(0);
  expect(s.bag.stone ?? 0).toBe(0);
  expect(s.bag.campfire).toBe(1);

  await waitFor(page, (st) => st.placing !== null && st.placing.problem === null);
  await page.keyboard.press("KeyE");
  await waitFor(page, (st) => st.buildings.length === 1);
  const fire = (await state(page)).buildings[0];
  await goTo(page, fire.id);
  await page.keyboard.press("KeyE");
  await speak(page, "make a fire");
  await waitFor(page, (st) => st.screen === "dayEnd", 30_000);
  s = await state(page);
  expect(s.quest.complete).toBe(true);
  expect(s.buildings[0].lit).toBe(true);
  await expect(page.getByTestId("said")).toContainText("Make a fire.");
  await page.getByTestId("keep-playing").click();
  await waitFor(page, (st) => st.mode === "explore" && st.screen === "game");
  expect(errors).toEqual([]);
});

test("mic-free: tapping the sentences gives the same progress; a wrong tap costs nothing", async ({ page }) => {
  const errors = await boot(page);
  await startGame(page, "tap");
  await goTo(page, await firstNode(page, "coconut"));
  await page.keyboard.press("KeyE");
  await waitFor(page, (s) => s.prompt !== null && s.prompt.buttons);
  const p = (await state(page)).prompt!;
  expect(p.choices).toHaveLength(3);
  expect(p.choices).toContain("getCoconut");
  const wrong = p.choices.find((c) => c !== "getCoconut")!;
  await page.locator(`[data-testid=choice][data-id=${wrong}]`).click();
  await waitFor(page, (s) => s.prompt?.status === "wrong");
  expect((await state(page)).bag.coconut ?? 0).toBe(0);
  await tap(page, "getCoconut");
  expect((await state(page)).bag.coconut).toBe(1);

  await goTo(page, "kai");
  await page.keyboard.press("KeyE");
  await waitFor(page, (s) => s.prompt?.question === "What do you need?");
  await tap(page, "needWater");
  await waitFor(page, (s) => s.prompt?.question === "Can you make a fire?");
  await tap(page, "noICant");
  await waitFor(page, (s) => s.mode === "explore");
  const s = await state(page);
  expect(s.kai).toEqual({ need: "water", canFire: false });
  expect(s.bag.stone).toBe(1); // "No, I can't." -> Kai helps with a stone
  expect(s.bag.coconut).toBe(2); // "I need water." -> Kai's coconut
  expect(errors).toEqual([]);
});

test("speech help ladder: try again, the sentence is read again, then the choices open", async ({ page }) => {
  await boot(page);
  await startGame(page, "speak");
  await goTo(page, await firstNode(page, "wood"));
  await page.keyboard.press("KeyE");
  await waitFor(page, promptOpen);
  for (let i = 1; i <= 3; i++) {
    await setSpeech(page, { say: "banana" });
    await page.keyboard.press("Space");
    await expect.poll(async () => (await state(page)).prompt?.misses, { timeout: 10_000 }).toBe(i);
    const p = (await state(page)).prompt!;
    expect(p.status).toBe("miss");
    expect(p.buttons).toBe(i >= 3);
    expect((await state(page)).bag.wood ?? 0).toBe(0);
  }
  await tap(page, "getWood");
  expect((await state(page)).bag.wood).toBe(1);
});

test("a blocked microphone switches to tapping at once", async ({ page }) => {
  await boot(page);
  await page.getByTestId("start").click();
  await waitFor(page, promptOpen);
  await setSpeech(page, { error: "not-allowed" });
  await page.keyboard.press("Space");
  await waitFor(page, (s) => s.prompt !== null && s.prompt.buttons);
  expect((await state(page)).micState).toBe("blocked");
  await tap(page, "hungry");
  await waitFor(page, (s) => s.mode === "explore");
});

test("a valid interim result is accepted at once, and one success is one action", async ({ page }) => {
  await boot(page);
  await startGame(page, "speak");
  await goTo(page, await firstNode(page, "stone"));
  await page.keyboard.press("KeyE");
  await waitFor(page, promptOpen);
  // The stub sends "get the stone" as an interim result, then "get the stone please" as final.
  await setSpeech(page, { say: "get the stone please" });
  await page.keyboard.press("Space");
  await waitFor(page, promptClosed);
  await page.waitForTimeout(600);
  expect((await state(page)).bag.stone).toBe(1);
});

test("save and resume keeps the bag, the story and the camp", async ({ page }) => {
  await boot(page);
  await startGame(page, "tap");
  await goTo(page, await firstNode(page, "wood"));
  await page.keyboard.press("KeyE");
  await tap(page, "getWood");
  await goTo(page, "crate");
  await page.keyboard.press("KeyE");
  await tap(page, "openBox");
  const before = await state(page);
  await page.getByTestId("btn-settings").click();
  await page.getByTestId("settings-title").click();
  await expect(page.getByTestId("continue")).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("continue")).toBeVisible();
  await page.getByTestId("continue").click();
  await waitFor(page, (s) => s.screen === "game" && s.mode === "explore");
  const after = await state(page);
  expect(after.bag).toEqual(before.bag);
  expect(after.crateOpened).toBe(true);
  expect(after.known).toEqual(expect.arrayContaining(["getWood", "openBox"]));
  expect(after.taken).toEqual(expect.arrayContaining(before.taken));
  expect(Math.hypot(after.player.x - before.player.x, after.player.z - before.player.z)).toBeLessThan(0.5);
  // Known actions stay quick after resuming.
  await goTo(page, await firstNode(page, "wood"));
  await page.keyboard.press("KeyE");
  await waitFor(page, (s) => (s.bag.wood ?? 0) === 2);
  expect((await state(page)).prompt).toBeNull();
});

test("“I need…” lights the way to what you asked for", async ({ page }) => {
  await boot(page);
  await startGame(page, "speak");
  await page.waitForTimeout(100);
  await page.keyboard.press("KeyQ");
  await waitFor(page, (s) => s.prompt?.question === "What do you need?");
  await speak(page, "I need stones");
  const s = await state(page);
  expect(s.beacons.length).toBeGreaterThan(0);
  expect(s.beacons.every((id) => id.startsWith("stone"))).toBe(true);
});

test("fainting: you wake up with full health and keep everything", async ({ page }) => {
  await boot(page);
  await startGame(page, "tap");
  await goTo(page, await firstNode(page, "wood"));
  await page.keyboard.press("KeyE");
  await tap(page, "getWood");
  await hook(page, "setStats", { hp: 0.4, food: 0 });
  await waitFor(page, (s) => s.mode === "busy");
  await waitFor(page, (s) => s.mode === "explore", 30_000);
  const s = await state(page);
  expect(s.stats.hp).toBe(100);
  expect(s.bag.wood).toBe(1);
});

test("a building cannot be put in the sea", async ({ page }) => {
  await boot(page);
  await startGame(page, "tap");
  // Skip ahead: Kai taught the campfire, the materials are in the bag.
  await goTo(page, "kai");
  await page.keyboard.press("KeyE");
  await tap(page, "needWood");
  await tap(page, "yesICan");
  await waitFor(page, (s) => s.mode === "explore");
  await gather(page, "wood", 3, (p) => tap(p, "getWood"));
  await gather(page, "stone", 2, (p) => tap(p, "getStone"));
  await page.keyboard.press("KeyC");
  await page.getByTestId("make-campfire").click();
  await tap(page, "craftCampfire");
  await waitFor(page, (s) => s.mode === "place");
  // Stand at the waterline with the camera looking out to sea.
  await hook(page, "teleport", 0, 16.5, 0);
  await hook(page, "setCameraYaw", Math.PI);
  await waitFor(page, (s) => s.placing?.problem === "water");
  await page.keyboard.press("KeyE");
  await page.waitForTimeout(300);
  expect((await state(page)).buildings).toHaveLength(0);
  await expect(page.getByTestId("place-ok")).toBeDisabled();
  // Turn round to the beach: now it fits.
  await hook(page, "setCameraYaw", 0);
  await waitFor(page, (s) => s.placing?.problem === null);
  await page.getByTestId("place-ok").click();
  await waitFor(page, (s) => s.buildings.length === 1);
});
