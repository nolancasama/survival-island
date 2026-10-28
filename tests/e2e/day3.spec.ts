import { expect, test, type Page } from "@playwright/test";
import { boot, firstNode, goTo, hook, speak, state, tap, waitFor, type SiState } from "./helpers";

/** Setup failures are harness preconditions, never evidence that an assertion passed. */
async function precondition<T>(label: string, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    throw new Error(`HARNESS_PRECONDITION_FAILED: ${label}`, { cause: error });
  }
}

async function until<A = undefined>(page: Page, label: string, pred: (s: SiState, arg: A) => boolean, arg?: A) {
  await precondition(label, () => waitFor(page, pred, 30_000, arg));
}

const idle = (s: SiState) => s.screen === "game" && s.mode === "explore" && s.line === null && s.prompt === null;

async function at(page: Page, id: string) {
  await until(page, "exploration before moving", idle);
  await precondition(`focus ${id}`, () => goTo(page, id));
}

async function answer(page: Page, phrase: string, how: "tap" | "speak" = "tap") {
  await until(page, `prompt offers ${phrase}`, (s, id) => s.prompt !== null && s.prompt.status !== "correct" && s.prompt.choices.includes(id), phrase);
  await precondition(`answer ${phrase}`, () => how === "tap" ? tap(page, phrase) : speak(page, "I want to catch a fish"));
}

async function morning(page: Page, how: "tap" | "speak" = "tap") {
  if (how === "tap") await hook(page, "setMic", false);
  await hook(page, "startDay", 3);
  await until(page, "Day 3 morning question", (s) => s.day === 3 && s.prompt?.question === "What do you want to do?");
  await answer(page, how === "tap" ? "wantWater" : "wantFish", how);
  await until(page, "Day 3 morning finished", idle);
}

async function collect(page: Page, kind: string, item: string, target: number) {
  for (let i = 0; i < 8; i++) {
    const before = (await state(page)).bag[item] ?? 0;
    if (before >= target) return;
    const id = await precondition(`reachable ${kind} node`, () => firstNode(page, kind));
    await at(page, id);
    await page.keyboard.press("KeyE");
    await until(page, `${item} collected`, (s, a) => (s.bag[a.item] ?? 0) > a.before && s.mode === "explore", { item, before });
    expect((await state(page)).prompt).toBeNull(); // familiar collection is quick
  }
  throw new Error(`HARNESS_PRECONDITION_FAILED: could not collect ${target} ${item}`);
}

async function make(page: Page, item: string, phrase: string) {
  await until(page, `exploration before making ${item}`, idle);
  await page.keyboard.press("KeyC");
  await precondition(`craft menu for ${item}`, () => expect(page.getByTestId(`make-${item}`)).toBeVisible());
  await page.getByTestId(`make-${item}`).click();
  await answer(page, phrase);
  await until(page, `${item} crafted`, (s, id) => (s.bag[id] ?? 0) > 0 && s.mode === "explore", item);
  expect((await state(page)).quest.done).toContain(item);
}

async function bridge(page: Page) {
  await collect(page, "tree", "wood", 4);
  const wood = (await state(page)).bag.wood;
  await at(page, "bridge");
  await page.keyboard.press("KeyE");
  await answer(page, "buildBridge");
  await until(page, "bridge built and play resumed", (s) => s.bridgeBuilt && s.mode === "explore");
  const s = await state(page);
  expect(s.bag.wood ?? 0).toBe(wood - 4);
  expect(s.quest.done).toContain("bridge");
  expect(s.step).toBe("container");
  expect(await hook<boolean>(page, "reachable", "water-1")).toBe(true);
}

/** Establish the pond, both tools and the water/drink steps through the real UI. */
async function readyToFish(page: Page) {
  await bridge(page);
  await collect(page, "leaves", "leaves", 2);
  await make(page, "container", "craftContainer");
  expect((await state(page)).step).toBe("water");
  await at(page, "water-1");
  await page.keyboard.press("KeyE");
  await answer(page, "getWater");
  await until(page, "first water collected", (s) => s.counters.gotWater === 1 && s.mode === "explore");
  let s = await state(page);
  expect(s.bag.water).toBe(1);
  expect(s.quest.done).toContain("water");
  expect(s.step).toBe("drink");
  await page.getByTestId("slot-water").click();
  await answer(page, "drinkWater");
  await until(page, "first water drunk", (st) => st.counters.drank === 1 && st.mode === "explore");
  s = await state(page);
  expect(s.bag.water ?? 0).toBe(0);
  expect(s.quest.done).toContain("drink");
  expect(s.step).toBe("rod");
  await collect(page, "tree", "wood", 2);
  await at(page, "crate");
  await page.keyboard.press("KeyE");
  await answer(page, "openBox");
  await until(page, "crate rope available", (st) => st.crateOpened && (st.bag.rope ?? 0) > 0 && st.mode === "explore");
  await make(page, "rod", "craftRod");
  expect((await state(page)).step).toBe("fish");
}

async function catchOne(page: Page, spot: string, first: boolean) {
  const before = (await state(page)).counters.caught;
  await at(page, spot);
  await page.keyboard.press("KeyE");
  if (first) await answer(page, "catchFish");
  await until(page, "automatic cast in progress", (s, id) => s.fishing?.spotId === id, spot);
  expect((await state(page)).mode).toBe("busy");
  await until(page, "fish caught without further input", (s, n) => s.counters.caught === n + 1 && s.mode === "explore" && s.fishing === null, before);
  const s = await state(page);
  expect(s.quest.done).toContain("fish");
  expect(s.fishRests[spot]).toBeGreaterThan(0);
}

async function cookOne(page: Page) {
  const before = (await state(page)).counters.cooked;
  const fire = (await state(page)).buildings.find((b) => b.type === "campfire" && b.lit);
  if (!fire) throw new Error("HARNESS_PRECONDITION_FAILED: lit campfire missing");
  await at(page, fire.id);
  await page.keyboard.press("KeyE");
  await answer(page, "cookFish");
  await until(page, "fish cooked", (s, n) => s.counters.cooked === n + 1 && (s.bag.grilledFish ?? 0) > 0, before);
  await until(page, "Day 3 evening cue finished", (s) => s.screen === "game" && s.mode === "explore" && s.line === null && s.prompt === null && s.beacons.includes("bE2eShelter"));
  expect((await state(page)).quest.done).toContain("cook");
}

async function resume(page: Page) {
  await until(page, "exploration before saving", idle);
  await page.getByTestId("btn-settings").click();
  await page.getByTestId("settings-title").click();
  await page.reload();
  await precondition("saved game Continue button", () => expect(page.getByTestId("continue")).toBeVisible());
  // Continue starts with speaking each time: simulate missing hardware and let
  // the teacher intentionally restore tapping for this classroom session.
  await page.evaluate(() => { (window as unknown as { __micUnavailable: boolean }).__micUnavailable = true; });
  await page.getByTestId("continue").click();
  await expect(page.getByTestId("mic-startup-overlay")).toBeVisible();
  await page.getByTestId("teacher-options").click();
  await page.getByTestId("teacher-tap").click();
  await until(page, "save restored into exploration", idle);
}

test("tapping: Day 3 Explore through the card, then the Day 4 morning", async ({ page }) => {
  const errors = await precondition("game boot", () => boot(page));
  await morning(page);
  let s = await state(page);
  expect(s.kai.want).toBe("water");
  expect(s.bag.coconut).toBe(2);
  expect(s.unlocked).toEqual(expect.arrayContaining(["container", "rod"]));
  expect(s.step).toBe("bridge");
  expect(s.beacons).toContain("bridge");
  await readyToFish(page);
  await catchOne(page, "fish-2", true);
  expect((await state(page)).bag.fish).toBe(1);
  expect((await state(page)).step).toBe("cook");
  await page.getByTestId("slot-fish").click();
  await until(page, "raw fish refusal shown", (st) => st.toasts.includes("Cook it first!"));
  expect((await state(page)).bag.fish).toBe(1);
  expect((await state(page)).prompt).toBeNull();
  await cookOne(page);
  s = await state(page);
  expect(s.bag.fish ?? 0).toBe(0);
  expect(s.bag.grilledFish).toBe(1);
  expect(s.step).toBe("sleep");
  const ate = s.ate;
  await page.getByTestId("slot-grilledFish").click();
  await answer(page, "eatFish");
  await until(page, "grilled fish eaten", (st, n) => st.ate === n + 1 && st.mode === "explore", ate);
  expect((await state(page)).bag.grilledFish ?? 0).toBe(0);
  await hook(page, "setClock", 0.9);
  await until(page, "Day 3 night", (st) => st.isNight);
  await at(page, "bE2eShelter");
  await page.keyboard.press("KeyE");
  await answer(page, "sleep");
  await until(page, "Day 3 card after sleeping", (st) => st.screen === "dayEnd" && st.sleptDay === 3);
  s = await state(page);
  expect(s.quest.complete).toBe(true);
  expect(s.quest.done).toEqual(expect.arrayContaining(["bridge", "container", "water", "drink", "rod", "fish", "cook", "sleep"]));
  expect(s.counters).toEqual({ gotWater: 1, drank: 1, caught: 1, cooked: 1 });
  expect(s.daySaid).toEqual(expect.arrayContaining(["wantWater", "buildBridge", "craftContainer", "getWater", "drinkWater", "craftRod", "catchFish", "cookFish", "eatFish", "sleep"]));
  await expect(page.getByTestId("dayend")).toContainText("Next: Day 4: Discover");
  await expect(page.getByTestId("dayend")).not.toContainText("To be continued");
  await expect(page.getByTestId("next-day")).toHaveText(/Day 4/);
  await expect(page.getByTestId("dayend").getByRole("button")).toHaveCount(1);
  await expect(page.getByTestId("to-title")).toHaveCount(0);
  await expect(page.getByTestId("said")).toContainText("I want to make a cup.");
  await page.getByTestId("next-day").click();
  await until(page, "Day 4 torch question", (st) => st.day === 4 && st.prompt?.question === "Can you make a torch?");
  await answer(page, "yesICan");
  await until(page, "Day 4 morning finished", idle);
  s = await state(page);
  expect(s.screen).toBe("game");
  expect(s.freePlay).toBe(false);
  expect(s.sleptDay).toBe(3);
  expect(s.isNight).toBe(false);
  expect(s.step).toBe("torch");
  expect(s.kai.canTorch).toBe(true);
  expect(s.unlocked).toContain("torch");
  expect(s.beacons).toContain("caveMouth");
  await expect(page.getByTestId("dayend")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("speech: the fish choice keeps the unopened rope crate lit with the bridge", async ({ page }) => {
  const errors = await precondition("game boot", () => boot(page));
  await morning(page, "speak");
  const s = await state(page);
  expect(s.kai.want).toBe("fish");
  expect(s.crateOpened).toBe(false);
  expect(s.bag.coconut).toBe(1); // water choice alone gives a coconut
  expect(s.unlocked).toEqual(expect.arrayContaining(["rod", "container"]));
  expect(s.unlocked.indexOf("rod")).toBeLessThan(s.unlocked.indexOf("container"));
  expect(s.beacons).toEqual(expect.arrayContaining(["crate", "bridge"]));
  expect(s.daySaid).toContain("wantFish");
  expect(errors).toEqual([]);
});

test("Day 3 gates and refusals: bridge wood, container, rod and water beacons", async ({ page }) => {
  await precondition("game boot", () => boot(page));
  await morning(page);
  await until(page, "broken bridge and insufficient wood", (s) => !s.bridgeBuilt && (s.bag.wood ?? 0) < 4);
  expect(await hook<boolean>(page, "reachable", "water-1")).toBe(false);
  expect(await hook<boolean>(page, "reachable", "fish-2")).toBe(false);
  await at(page, "bridge");
  await page.keyboard.press("KeyE");
  await until(page, "bridge wood refusal", (s) => s.toasts.includes("You need four wood."));
  expect((await state(page)).bridgeBuilt).toBe(false);
  expect((await state(page)).prompt).toBeNull();
  // Water is relevant to open Day 3 tasks, even while the bridge comes first.
  await page.keyboard.press("KeyQ");
  await answer(page, "needWater");
  await until(page, "water need answered", idle);
  expect((await state(page)).beacons).toEqual(["bridge"]);
  await bridge(page);
  await until(page, "missing pond tools", (s) => !s.bag.container && !s.bag.rod);
  await at(page, "water-1");
  await page.keyboard.press("KeyE");
  await until(page, "container refusal", (s) => s.toasts.includes("You need a cup."));
  expect((await state(page)).prompt).toBeNull();
  expect((await state(page)).counters.gotWater).toBe(0);
  await at(page, "fish-2");
  await page.keyboard.press("KeyE");
  await until(page, "rod refusal", (s) => s.toasts.includes("You need a fishing rod."));
  expect((await state(page)).prompt).toBeNull();
  expect((await state(page)).counters.caught).toBe(0);
  await page.keyboard.press("KeyQ");
  await answer(page, "needWater");
  await until(page, "reachable water beacons", idle);
  expect((await state(page)).beacons).toEqual(["water-1", "water-2", "water-3"]);
});

test("save/resume: Day 3 night restores bridge, raw and grilled fish, and resting spots", async ({ page }) => {
  await precondition("game boot", () => boot(page));
  await morning(page);
  await readyToFish(page);
  await catchOne(page, "fish-2", true);
  // A 15 s rest can run out during a slow reload; a long one shows the saved timer itself comes back.
  await hook(page, "setTaken", "fish-2", true);
  await hook(page, "setClock", 0.9);
  await until(page, "night with raw fish and resting spot before save", (s) => s.isNight && s.bridgeBuilt && s.bag.fish === 1 && s.fishRests["fish-2"] > 0);
  await resume(page);
  let s = await state(page);
  expect(s.day).toBe(3);
  expect(s.isNight).toBe(true);
  expect(s.bridgeBuilt).toBe(true);
  expect(s.bag.fish).toBe(1);
  expect(s.fishRests["fish-2"]).toBeGreaterThan(9000);
  expect(s.counters).toEqual({ gotWater: 1, drank: 1, caught: 1, cooked: 0 });
  expect(s.kai.want).toBe("water");
  await cookOne(page);
  await catchOne(page, "fish-1", false);
  await hook(page, "setTaken", "fish-1", true);
  await until(page, "raw and cooked fish with resting spot before save", (st) => st.isNight && st.bag.fish === 1 && st.bag.grilledFish === 1 && st.fishRests["fish-1"] > 0);
  await resume(page);
  s = await state(page);
  expect(s.day).toBe(3);
  expect(s.isNight).toBe(true);
  expect(s.bridgeBuilt).toBe(true);
  expect(s.bag.fish).toBe(1);
  expect(s.bag.grilledFish).toBe(1);
  expect(s.fishRests["fish-1"]).toBeGreaterThan(9000);
  expect(s.counters).toEqual({ gotWater: 1, drank: 1, caught: 2, cooked: 1 });
  expect(s.step).toBe("sleep");
});
