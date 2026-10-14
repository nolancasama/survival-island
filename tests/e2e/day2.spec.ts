import { expect, test, type Page } from "@playwright/test";
import { boot, firstNode, goTo, hook, promptOpen, speak, state, waitFor } from "./helpers";

/** Start at the morning of a day and get through Kai's morning question. */
async function startDay(page: Page, n: number, axeAnswer: string) {
  await hook(page, "startDay", n);
  await waitFor(page, (s, want) => s.day === want && s.screen === "game", 20_000, n);
  await waitFor(page, (s) => s.prompt?.question === "Can you make a stone axe?", 30_000);
  await speak(page, axeAnswer);
  await waitFor(page, (s) => s.mode === "explore" && s.line === null, 30_000);
}

/** Use the thing in focus (E) and say the sentence if a prompt opens; wait until play resumes. */
async function use(page: Page, sentence: string | null) {
  await page.keyboard.press("KeyE");
  if (sentence) await speak(page, sentence);
  await waitFor(page, (s) => s.mode === "explore" && s.line === null, 30_000);
}

/** Collect from nodes of a kind (already known: no English) until the bag holds n. */
async function collect(page: Page, kind: string, item: string, n: number) {
  for (let guard = 0; guard < 8; guard++) {
    if (((await state(page)).bag[item] ?? 0) >= n) return;
    await goTo(page, await firstNode(page, kind));
    const before = (await state(page)).bag[item] ?? 0;
    await page.keyboard.press("KeyE");
    await waitFor(page, (s, a) => (s.bag[a.item] ?? 0) > a.before, 10_000, { item, before });
    expect((await state(page)).prompt).toBeNull();
  }
}

/** Open Make, pick a recipe and say it. */
async function make(page: Page, id: string, sentence: string) {
  await page.keyboard.press("KeyC");
  await expect(page.getByTestId("craft")).toBeVisible();
  await page.getByTestId(`make-${id}`).click();
  await waitFor(page, (s) => s.prompt?.question === "What do you want to make?");
  await speak(page, sentence);
}

test("speech: Day 2 from the morning to sleeping in the shelter", async ({ page }) => {
  const errors = await boot(page);
  await startDay(page, 2, "no I can't");
  let s = await state(page);
  expect(s.kai.canAxe).toBe(false);
  expect(s.bag.stone).toBe(1); // "No, I can't." -> Kai gives a stone
  expect(s.unlocked).toContain("axe");
  expect(s.step).toBe("axe");
  expect(s.isNight).toBe(false);

  // Stone axe: two driftwood (already known, so quick) and Kai's stone.
  await collect(page, "wood", "wood", 2);
  await make(page, "axe", "I want to make a stone axe");
  await waitFor(page, (st) => (st.bag.axe ?? 0) === 1 && st.mode === "explore");
  expect((await state(page)).quest.done).toContain("axe");

  // The big tree in the forest gap: "Cut the tree." opens the forest.
  expect(await hook<boolean>(page, "reachable", "leaves-1")).toBe(false);
  await goTo(page, "fallenTree");
  await use(page, "cut the tree");
  s = await state(page);
  expect(s.pathCleared).toBe(true);
  expect(s.bag.wood).toBe(2);
  expect(s.quest.done).toContain("path");
  expect(await hook<boolean>(page, "reachable", "leaves-1")).toBe(true);

  // Leaves: the first are spoken and teach the shelter recipe; +2 per bush.
  await goTo(page, await firstNode(page, "leaves"));
  await use(page, "get the leaves");
  s = await state(page);
  expect(s.bag.leaves).toBe(2);
  expect(s.unlocked).toContain("shelter");
  await collect(page, "leaves", "leaves", 4);
  expect((await state(page)).bag.leaves).toBe(4);

  // A standing tree: the axe cuts it (+2 wood). "Cut the tree." is known now, so it is quick.
  await goTo(page, await firstNode(page, "tree"));
  await page.keyboard.press("KeyE");
  await waitFor(page, (st) => (st.bag.wood ?? 0) === 4);
  s = await state(page);
  expect(s.prompt).toBeNull();
  expect(s.quest.done).toEqual(expect.arrayContaining(["leaves", "wood"]));

  // Make the shelter, put it on the beach, and build it.
  await hook(page, "teleport", 9, 9.5, Math.PI);
  await hook(page, "setCameraYaw", 0);
  await make(page, "shelter", "I want to make a shelter");
  await waitFor(page, (st) => st.mode === "place");
  await waitFor(page, (st) => st.placeOk);
  await page.keyboard.press("KeyE");
  await waitFor(page, (st) => st.buildings.some((b) => b.type === "shelter"));
  const shelter = (await state(page)).buildings.find((b) => b.type === "shelter")!;
  expect(shelter.built).toBeFalsy();
  await goTo(page, shelter.id);
  await use(page, "build a shelter");
  s = await state(page);
  expect(s.buildings.find((b) => b.id === shelter.id)?.built).toBe(true);
  expect(s.step).toBe("sleep");

  // Evening: Kai's line lights the shelter.
  await waitFor(page, (st, id) => st.beacons.includes(id) && st.mode === "explore" && st.line === null, 20_000, shelter.id);

  // By day the shelter refuses: "It's not night yet!"
  await hook(page, "setClock", 0.3);
  await goTo(page, shelter.id);
  await page.keyboard.press("KeyE");
  await waitFor(page, (st) => st.toasts.includes("It's not night yet!"));
  expect((await state(page)).prompt).toBeNull();

  // At night: "I want to sleep." ends the day.
  await hook(page, "setClock", 0.85);
  await waitFor(page, (st) => st.isNight);
  await page.keyboard.press("KeyE");
  await waitFor(page, promptOpen);
  expect((await state(page)).prompt!.sentences).toEqual(["I want to sleep."]);
  await speak(page, "I want to sleep");
  await waitFor(page, (st) => st.screen === "dayEnd", 30_000);
  s = await state(page);
  expect(s.sleptDay).toBe(2);
  expect(s.quest.complete).toBe(true);
  expect(s.daySaid).toEqual(expect.arrayContaining(["noICant", "craftAxe", "cutTree", "getLeaves", "craftShelter", "buildShelter", "sleep"]));
  expect(s.dayNew).toContain("cutTree");
  expect(s.dayNew).not.toContain("sleep"); // said on Day 1 already
  await expect(page.getByTestId("dayend")).toContainText("Day 2 complete!");
  await expect(page.getByTestId("next-day")).toContainText("Day 3");
  expect(errors).toEqual([]);
});

test("Day 2 gates: the forest is closed, the big tree needs an axe, and “I need leaves.” points at it", async ({ page }) => {
  const errors = await boot(page);
  await startDay(page, 2, "yes I can");
  expect((await state(page)).bag.stone ?? 0).toBe(0);
  expect(await hook<string[]>(page, "nodes", "leaves")).toEqual([]);
  expect(await hook<string[]>(page, "nodes", "tree")).toEqual([]);

  // Without an axe the big tree only says so: no English prompt.
  await goTo(page, "fallenTree");
  await page.keyboard.press("KeyE");
  await waitFor(page, (s) => s.toasts.includes("You need a stone axe."));
  let s = await state(page);
  expect(s.prompt).toBeNull();
  expect(s.pathCleared).toBe(false);

  // Walking into the gap is blocked while the tree lies there.
  await hook(page, "goto", -9, -6, -9, -10);
  expect((await state(page)).player.z).toBeGreaterThan(-2.6);

  // "I need leaves." lights the fallen tree while the forest is closed.
  await page.keyboard.press("KeyQ");
  await waitFor(page, (st) => st.prompt?.question === "What do you need?");
  expect((await state(page)).prompt!.choices).toContain("needLeaves");
  await speak(page, "I need leaves");
  s = await state(page);
  expect(s.beacons).toEqual(["fallenTree"]);
  expect(errors).toEqual([]);
});

test("save and resume in the Day 2 evening keeps the night and the shelter", async ({ page }) => {
  await boot(page);
  await startDay(page, 2, "yes I can");
  // Played ahead: a stone axe, the open forest and a built shelter beside the fire.
  await collect(page, "wood", "wood", 2);
  await collect(page, "stone", "stone", 1);
  await make(page, "axe", "I want to make a stone axe");
  await waitFor(page, (s) => (s.bag.axe ?? 0) === 1 && s.mode === "explore");
  await hook(page, "setGates", { pathCleared: true });
  await hook(page, "setBuildings", [
    { id: "bE2eFire", type: "campfire", x: 2, z: 5, rot: 0, lit: true },
    { id: "bShelter", type: "shelter", x: 9, z: 6, rot: 0, built: true }
  ]);
  await hook(page, "setClock", 0.9);
  await waitFor(page, (s) => s.isNight);
  const before = await state(page);

  await page.getByTestId("btn-settings").click();
  await page.getByTestId("settings-title").click();
  await page.reload();
  await expect(page.getByTestId("continue")).toBeVisible();
  await page.getByTestId("continue").click();
  await waitFor(page, (s) => s.screen === "game" && s.mode === "explore");
  const after = await state(page);
  expect(after.day).toBe(2);
  expect(after.isNight).toBe(true);
  expect(Math.abs(after.clock - before.clock)).toBeLessThan(0.02);
  expect(after.pathCleared).toBe(true);
  expect(after.buildings.find((b) => b.type === "shelter")?.built).toBe(true);
  expect(after.kai.canAxe).toBe(true);
  expect(after.unlocked).toEqual(expect.arrayContaining(["campfire", "axe"]));
  expect(after.bag).toEqual(before.bag);
});
