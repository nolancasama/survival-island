import { expect, test, type Page } from "@playwright/test";
import { boot, firstNode, goTo, hook, startGame, state, tap, waitFor, type SiState } from "./helpers";

/** Distinguish missing setup from a product assertion. */
async function precondition<T>(label: string, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    throw new Error(`HARNESS_PRECONDITION_FAILED: ${label}`, { cause: error });
  }
}

async function until<A = undefined>(page: Page, label: string, pred: (s: SiState, arg: A) => boolean, arg?: A) {
  await precondition(label, () => waitFor(page, pred, 45_000, arg));
}

async function campfireLesson(page: Page) {
  await precondition("tapping intro", () => startGame(page, "tap"));
  await precondition("coconut focus", async () => goTo(page, await firstNode(page, "coconut")));
  await page.keyboard.press("KeyE");
  await precondition("collect first coconut", () => tap(page, "getCoconut"));
  await until(page, "exploration after coconut", (s) => s.mode === "explore");
  await page.getByTestId("slot-coconut").click();
  await precondition("eat coconut", () => tap(page, "eatCoconut"));
  await until(page, "food step ticked", (s) => s.quest.done.includes("eat") && s.mode === "explore");
  await precondition("Kai focus", () => goTo(page, "kai"));
  await page.keyboard.press("KeyE");
  await until(page, "Kai need question", (s) => s.prompt?.question === "What do you need?");
  await tap(page, "needWood");
  await until(page, "Kai fire question", (s) => s.prompt?.question === "Can you make a fire?");
  await tap(page, "yesICan");
  await until(page, "campfire lesson completed", (s) => s.mode === "explore" && s.unlocked.includes("campfire") && s.quest.done.includes("kai"));
}

async function collect(page: Page, kind: "wood" | "stone", target: number) {
  for (let guard = 0; guard < target + 1; guard++) {
    const before = (await state(page)).bag[kind] ?? 0;
    if (before >= target) return;
    const id = await precondition(`available ${kind} node`, () => firstNode(page, kind));
    await precondition(`${kind} focus`, () => goTo(page, id));
    const known = (await state(page)).known.includes(kind === "wood" ? "getWood" : "getStone");
    await page.keyboard.press("KeyE");
    if (!known) await precondition(`${kind} command`, () => tap(page, kind === "wood" ? "getWood" : "getStone"));
    await until(page, `${kind} collected`, (s, a) => (s.bag[a.kind] ?? 0) > a.before && s.mode === "explore", { kind, before });
  }
  throw new Error(`HARNESS_PRECONDITION_FAILED: ${target} ${kind} gathered`);
}

test("classroom Day 1 uses 2 wood / 1 stone in goals and craft, switchable in Settings", async ({ page }) => {
  const errors = await precondition("game boot", () => boot(page));
  await page.getByTestId("mode-classroom").click();
  await until(page, "classroom teacher setting enabled", (s) => s.classroom);
  await campfireLesson(page);
  await expect(page.getByTestId("step-wood")).toContainText("1/2");
  await expect(page.getByTestId("step-stone")).toContainText("0/1");
  // The Make button pulses while something can be made, so it is never "stable" to click.
  await page.keyboard.press("KeyC");
  await expect(page.getByTestId("recipe-campfire").locator('[title="wood: 1/2"]')).toBeVisible();
  await expect(page.getByTestId("recipe-campfire").locator('[title="stone: 0/1"]')).toBeVisible();
  await page.getByTestId("craft-close").click();
  await page.getByTestId("btn-settings").click();
  await page.getByTestId("toggle-classroom").click();
  await until(page, "normal pace selected during play", (s) => !s.classroom);
  await page.getByTestId("settings-close").click();
  await expect(page.getByTestId("step-wood")).toContainText("1/3");
  await expect(page.getByTestId("step-stone")).toContainText("0/2");
  await page.getByTestId("btn-settings").click();
  await page.getByTestId("toggle-classroom").click();
  await page.getByTestId("settings-close").click();
  await until(page, "classroom pace restored", (s) => s.classroom && !s.settingsOpen);
  await collect(page, "wood", 2);
  await collect(page, "stone", 1);
  await until(page, "classroom counted goals ticked", (s) => s.quest.done.includes("wood") && s.quest.done.includes("stone"));
  await hook(page, "teleport", 1, 6, Math.PI);
  // The Make button pulses while something can be made, so it is never "stable" to click.
  await page.keyboard.press("KeyC");
  await precondition("campfire enabled with exactly classroom ingredients", () => expect(page.getByTestId("make-campfire")).toBeEnabled());
  await page.getByTestId("make-campfire").click();
  await precondition("craft campfire command", () => tap(page, "craftCampfire"));
  await until(page, "campfire crafted into placement", (s) => s.mode === "place" && s.bag.campfire === 1);
  expect((await state(page)).bag.wood ?? 0).toBe(0);
  expect((await state(page)).bag.stone ?? 0).toBe(0);
  expect(errors).toEqual([]);
});

test("classroom automatic hint waits for live idle play, lights current target and respects open menus", async ({ page }) => {
  await precondition("game boot", () => boot(page));
  await page.getByTestId("mode-classroom").click();
  await campfireLesson(page);
  // The lesson ticks Kai and clears the opening food hint from the idle interval.
  await until(page, "wood is the unfinished step", (s) => s.classroom && s.step === "wood" && s.mode === "explore" && !s.prompt && !s.line);
  const count = (await state(page)).automaticHintCount;
  await until(page, "live idle time approaches automatic hint delay", (s) => s.stepIdleSeconds >= 17 && s.stepIdleSeconds < 20);
  // The Make button pulses while something can be made, so it is never "stable" to click.
  await page.keyboard.press("KeyC");
  await until(page, "craft menu open before hint delay", (s) => s.craftOpen && s.stepIdleSeconds < 20);
  const menu = await state(page);
  await until(page, "open menu spans the remaining delay", (s, t) => s.craftOpen && s.time >= t + 4, menu.time);
  expect((await state(page)).automaticHintCount).toBe(count);
  expect((await state(page)).stepIdleSeconds).toBe(menu.stepIdleSeconds);
  await page.getByTestId("craft-close").click();
  await until(page, "automatic wood hint fired", (s, n) => !s.craftOpen && s.mode === "explore" && s.automaticHintCount > n && s.beacons.length > 0, count);
  const hinted = await state(page);
  expect(hinted.beacons.every((id) => id.startsWith("wood-"))).toBe(true);
  expect(hinted.automaticHintCount).toBe(count + 1);
  for (const id of hinted.beacons) expect(await hook<boolean>(page, "reachable", id)).toBe(true);
  const firedAt = hinted.time;
  await until(page, "a further live second elapsed", (s, t) => s.time >= t + 1, firedAt);
  expect((await state(page)).automaticHintCount).toBe(count + 1);
});

test("normal pace never fires an automatic hint after the classroom delay", async ({ page }) => {
  await precondition("game boot", () => boot(page));
  await campfireLesson(page);
  await until(page, "normal wood step idle with nothing open", (s) => !s.classroom && s.step === "wood" && s.mode === "explore" && !s.prompt && !s.line && !s.craftOpen && !s.settingsOpen);
  const before = (await state(page)).automaticHintCount;
  await until(page, "normal live idle delay elapsed", (s) => s.stepIdleSeconds >= 21 && s.mode === "explore");
  expect((await state(page)).automaticHintCount).toBe(before);
  expect((await state(page)).beacons).toEqual([]);
});
