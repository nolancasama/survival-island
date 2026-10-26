import { expect, test, type Page } from "@playwright/test";
import { boot, firstNode, goTo, hook, state, tap, waitFor, type SiState } from "./helpers";

/** Missing setup is a harness error, never a product pass or failure. */
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

const idle = (s: SiState) => s.screen === "game" && s.mode === "explore" && !s.line && !s.prompt;

interface EscapeWorld {
  cliffPath: Array<{ x: number; z: number }>;
  kaiRoutes: { toRockfall: Array<{ x: number; z: number }>; toClifftop: Array<{ x: number; z: number }> };
}

async function fast(page: Page, on: boolean) {
  await page.evaluate((enabled) => {
    const url = new URL(location.href);
    url.searchParams.set("fast", enabled ? "1" : "0");
    history.replaceState(null, "", url);
  }, on);
}

async function at(page: Page, id: string) {
  await until(page, `exploring before ${id}`, idle);
  await precondition(`focus ${id}`, () => goTo(page, id));
}

async function answer(page: Page, phrase: string) {
  await until(page, `tappable prompt offers ${phrase}`, (s, id) => Boolean(s.prompt?.buttons && s.prompt.status !== "correct" && s.prompt.choices.includes(id)), phrase);
  await precondition(`tap ${phrase}`, () => tap(page, phrase));
}

async function line(page: Page, en: string) {
  await until(page, `line: ${en}`, (s, text) => s.line?.en === text, en);
  expect((await state(page)).line?.ja).toBeTruthy();
  await page.keyboard.press("KeyE");
}

async function morning(page: Page, classroom = false) {
  await page.getByTestId("mode-tap").click();
  await fast(page, false);
  await hook(page, "startDay", 5, classroom);
  await until(page, "Day 5 title", (s) => s.day === 5 && s.dayTitle === 5);
  await line(page, "Today we go home!");
  await line(page, "Let's go to the clifftop. But rocks are on the path.");
  await line(page, "I'll meet you there.");
  await until(page, "Kai leaves camp on the rockfall route", (s) => s.mode === "explore" && !s.line && !s.prompt && !s.kaiRouteEmpty && s.kaiStage === "camp");
  const s = await state(page);
  expect(s.enteredCave && s.caveBoxOpened && s.pathCleared && s.bridgeBuilt).toBe(true);
  expect(s.kai.have).toBe("radio");
  expect(s.bag.radio).toBe(1);
  expect(s.bag.metal).toBe(2);
  expect(s.unlocked).toContain("signalFire");
  expect(s.beacons).toContain("rockfall");
  expect(s.cliffOpen || s.signalLit || s.rescued).toBe(false);
  expect(s.step).toBe("cliff");
}

async function rockfall(page: Page, checkWait = false) {
  await at(page, "rockfall");
  if (checkWait) {
    await until(page, "Kai has not reached the rockfall", (s) => !s.kaiRouteEmpty && s.kaiStage === "camp");
    await page.keyboard.press("KeyE");
    await until(page, "Kai is coming toast", (s) => s.toasts.includes("Kai is coming!"));
    expect((await state(page)).prompt).toBeNull();
    expect((await state(page)).cliffOpen).toBe(false);
  }
  await until(page, "Kai arrives at rockfall", (s) => s.kaiStage === "rockfall" && s.kaiRouteEmpty);
}

async function clearPath(page: Page) {
  await at(page, "rockfall");
  await page.keyboard.press("KeyE");
  await until(page, "help command with three sentences", (s) => s.prompt?.kind === "command" && s.prompt.sentences[0] === "Can you help me?");
  expect((await state(page)).prompt?.choices).toHaveLength(3);
  await answer(page, "canHelp");
  await line(page, "Yes, I can! One, two, three!");
  await until(page, "rocks cleared and Kai walking to clifftop", (s) => s.cliffOpen && s.worldAnimation.cliffOpenT0 >= 0 && !s.kaiRouteEmpty && s.mode === "explore");
  expect((await state(page)).quest.done).toContain("cliff");
}

async function climb(page: Page, refuse = false) {
  const world = await hook<EscapeWorld>(page, "world");
  await until(page, "cliff path open before climb", (s) => s.cliffOpen && s.mode === "explore");
  for (const point of world.cliffPath.slice(1)) {
    await hook(page, "teleport", point.x, point.z);
    await until(page, "player stands on next path waypoint", (s, p) => Math.hypot(s.player.x - p.x, s.player.z - p.z) < 0.5, point);
  }
  await line(page, "Wow! I can see the whole island!");
  await until(page, "clifftop reached and play resumed", (s) => s.reachedClifftop && s.mode === "explore");
  expect((await state(page)).quest.done).toContain("clifftop");
  if (refuse) {
    await at(page, "signalPad");
    await page.keyboard.press("KeyE");
    await line(page, "We need a signal fire.");
    await until(page, "pad refusal keeps fire unlit", idle);
    expect((await state(page)).signalLit).toBe(false);
    expect((await state(page)).prompt).toBeNull();
  }
}

async function gather(page: Page, kind: "wood" | "leaves", goal: number) {
  for (let guard = 0; guard < goal + 1; guard++) {
    const before = (await state(page)).bag[kind] ?? 0;
    if (before >= goal) return;
    await at(page, await precondition(`reachable ${kind} source`, () => firstNode(page, kind)));
    await page.keyboard.press("KeyE");
    await until(page, `${kind} inventory increased`, (s, a) => (s.bag[a.kind] ?? 0) > a.before && s.mode === "explore", { kind, before });
  }
  throw new Error(`HARNESS_PRECONDITION_FAILED: gathered ${goal} ${kind}`);
}

async function signalFire(page: Page, classroom = false) {
  await until(page, "explore before signal fire collection", idle);
  await page.keyboard.press("KeyQ");
  await until(page, "needs offers wood and leaves", (s) => Boolean(s.prompt?.choices.includes("needWood") && s.prompt.choices.includes("needLeaves")));
  await answer(page, "needLeaves");
  await until(page, "needs help points at reachable leaves", (s) => s.mode === "explore" && !s.prompt && s.beacons.length > 0);
  for (const id of (await state(page)).beacons) expect(await hook<boolean>(page, "reachable", id)).toBe(true);
  await fast(page, true);
  await gather(page, "wood", classroom ? 2 : 4);
  await gather(page, "leaves", classroom ? 2 : 3);
  await until(page, "wood and leaves counted goals done", (s) => s.quest.done.includes("wood") && s.quest.done.includes("leaves"));
  const before = (await state(page)).bag;
  await page.keyboard.press("KeyC"); // The pulsing Make button is never stable to click.
  await until(page, "signal fire craft menu", (s) => s.craftOpen);
  await precondition("signal fire recipe enabled", () => expect(page.getByTestId("make-signalFire")).toBeEnabled());
  await page.getByTestId("make-signalFire").click();
  await answer(page, "craftSignalFire");
  await until(page, "signal fire stays in bag without placement", (s) => s.bag.signalFire === 1 && s.mode === "explore");
  const s = await state(page);
  expect(s.placing).toBeNull();
  expect(s.bag.wood ?? 0).toBe((before.wood ?? 0) - (classroom ? 2 : 4));
  expect(s.bag.leaves ?? 0).toBe((before.leaves ?? 0) - (classroom ? 2 : 3));
  expect(s.bag.metal ?? 0).toBe((before.metal ?? 0) - (classroom ? 1 : 2));
  await expect(page.getByTestId("slot-signalFire")).toBeDisabled();
  await until(page, "bag item does not start placement", idle);
  expect((await state(page)).placing).toBeNull();
  await expect(page.getByText("Put down", { exact: true })).toHaveCount(0);
  await fast(page, false);
}

async function lightPad(page: Page) {
  await at(page, "signalPad");
  await until(page, "Day 1 make fire sentence already familiar", (s) => s.known.includes("makeFire"));
  await page.keyboard.press("KeyE");
  await until(page, "climax asks familiar Make a fire again", (s) => s.prompt?.sentences[0] === "Make a fire.");
  expect((await state(page)).prompt?.choices).toHaveLength(3);
  await answer(page, "makeFire");
  await line(page, "Look at the smoke!");
  await until(page, "radio help question", (s) => s.prompt?.question === "Hello? Hello? What do you need?");
  const s = await state(page);
  expect(s.signalLit).toBe(true);
  expect(s.bag.signalFire ?? 0).toBe(0);
  expect(s.worldAnimation.signalLitT0).toBeGreaterThanOrEqual(0);
  expect(s.prompt?.questionBy).toBe("radio");
  expect(s.prompt?.questionJa).toBeNull();
  expect(s.prompt?.choices).toEqual(["needHelp", "needWater", "sleep"]);
}

async function rescue(page: Page, choice: "needHelp" | "needWater") {
  await answer(page, choice);
  await line(page, choice === "needHelp" ? "We see your smoke! We're coming!" : "Water? OK! We see your smoke. We're coming!");
  await until(page, "rescue flight starts with input held", (s) => s.rescued && s.rescue.phase === "flight" && s.mode === "busy");
  const flight = await state(page);
  expect(flight.prompt).toBeNull();
  expect(flight.line).toBeNull();
  expect(flight.worldAnimation.rescueT0).toBeGreaterThanOrEqual(0);
  await until(page, "helicopter landed before Kai cheer", (s) => s.rescue.phase === "landed" && s.line?.en === "We did it! We're going home!");
  expect((await state(page)).rescue.elapsed).toBeGreaterThanOrEqual(flight.rescue.duration);
  await line(page, "We did it! We're going home!");
  await until(page, "Rescue card displayed", (s) => s.screen === "dayEnd" && s.rescued && s.quest.complete);
  await expect(page.getByRole("heading", { name: "Rescued!" })).toBeVisible();
  await expect(page.getByTestId("keep-exploring")).toBeVisible();
  await expect(page.getByTestId("dayend").getByRole("button")).toHaveCount(1);
  await expect(page.getByTestId("to-title")).toHaveCount(0);
  await expect(page.getByTestId("said")).toContainText("I'm hungry.");
  await expect(page.getByTestId("said")).toContainText("Go in the cave.");
  await expect(page.getByTestId("said")).toContainText("Can you help me?");
  await expect(page.getByTestId("said")).toContainText(choice === "needHelp" ? "I need help." : "I need water.");
  await expect(page.getByTestId("said").locator("li").filter({ hasText: "Can you help me?" })).toContainText("NEW");
  await expect(page.getByTestId("said").locator("li").filter({ hasText: "Make a fire." })).not.toContainText("NEW");
  if (choice === "needHelp") {
    await expect(page.getByTestId("said").locator("li").filter({ hasText: "I need help." })).toContainText("NEW");
  }
  const s = await state(page);
  await expect(page.getByTestId("said").locator("li")).toHaveCount(s.said.length);
  expect(s.quest.done).toEqual(expect.arrayContaining(["cliff", "wood", "leaves", "signalFire", "clifftop", "signal", "help"]));
  expect(s.quest.done).not.toContain("sleep");
  expect(s.sleptDay).toBe(4);
  expect(s.isNight).toBe(false);
}

async function freePlay(page: Page) {
  await fast(page, true);
  await until(page, "Day 6 free play", (s) => s.day === 6 && s.freePlay && s.kaiStage === "camp" && s.mode === "explore" && s.dayTitle === null);
  const s = await state(page);
  expect(s.worldAnimation.rescueT0).toBe(-1);
  expect(s.kaiRouteEmpty).toBe(true);
  expect(s.signalLit).toBe(true);
  expect(s.step).toBeNull();
  await expect(page.getByTestId("objective")).toContainText("Free time: explore the island!");
  await expect(page.locator('[data-testid^="step-"]')).toHaveCount(0);
}

test("tapping: Day 5 escape, radio help, Rescue card and Day 6 free play", async ({ page }) => {
  const errors = await precondition("game boot", () => boot(page));
  await morning(page);
  await rockfall(page, true);
  await clearPath(page);
  await climb(page, true);
  await signalFire(page);
  await lightPad(page);
  await rescue(page, "needHelp");
  await fast(page, true);
  await page.getByTestId("keep-exploring").click();
  await freePlay(page);
  expect(errors).toEqual([]);
});

async function reloadContinue(page: Page) {
  await page.reload();
  await precondition("saved Continue button available", () => expect(page.getByTestId("continue")).toBeVisible());
  await page.getByTestId("continue").click();
}

async function savedStage(page: Page, label: string, pred: (s: SiState) => boolean) {
  await until(page, label, pred);
  await page.getByTestId("btn-settings").click();
  await page.getByTestId("settings-title").click();
  await until(page, `${label} saved to title`, (s) => s.screen === "title");
  await reloadContinue(page);
}

test("Day 5 save stages resume Kai routes, lit fire radio and rescued Day 6; water radio answer also rescues", async ({ page }) => {
  const errors = await precondition("game boot", () => boot(page));
  await morning(page);
  // A save from the in-progress walk settles Kai at the end of that route.
  await savedStage(page, "Kai walking before rockfall save", (s) => s.mode === "explore" && !s.kaiRouteEmpty && !s.cliffOpen);
  await until(page, "interrupted Kai walk resumes at rockfall", (s) => s.mode === "explore" && s.kaiStage === "rockfall" && s.kaiRouteEmpty);
  const world = await hook<EscapeWorld>(page, "world");
  const end = world.kaiRoutes.toRockfall.at(-1)!;
  expect((await state(page)).kaiAt.x).toBeCloseTo(end.x, 1);
  expect((await state(page)).kaiAt.z).toBeCloseTo(end.z, 1);
  await savedStage(page, "Kai arrived at rockfall save", (s) => s.mode === "explore" && s.kaiStage === "rockfall" && !s.cliffOpen);
  await until(page, "rockfall stage restored", (s) => s.mode === "explore" && s.kaiStage === "rockfall" && !s.cliffOpen && s.kaiRouteEmpty);
  await clearPath(page);
  await savedStage(page, "opened path with Kai climbing save", (s) => s.mode === "explore" && s.cliffOpen && !s.kaiRouteEmpty);
  await until(page, "opened path resumes Kai at clifftop", (s) => s.mode === "explore" && s.cliffOpen && s.kaiStage === "clifftop" && s.kaiRouteEmpty);
  const top = world.kaiRoutes.toClifftop.at(-1)!;
  expect((await state(page)).kaiAt.x).toBeCloseTo(top.x, 1);
  expect((await state(page)).kaiAt.z).toBeCloseTo(top.z, 1);
  await climb(page);
  await signalFire(page);
  await lightPad(page);
  // Lighting saves before the radio prompt; reloading here must not replay the fire command.
  await reloadContinue(page);
  await until(page, "lit-fire save reopens radio question", (s) => s.signalLit && !s.rescued && s.prompt?.question === "Hello? Hello? What do you need?");
  expect((await state(page)).bag.signalFire ?? 0).toBe(0);
  expect((await state(page)).cliffOpen && (await state(page)).reachedClifftop).toBe(true);
  await rescue(page, "needWater");
  await fast(page, true);
  await reloadContinue(page);
  await freePlay(page);
  expect((await state(page)).rescued).toBe(true);
  expect(errors).toEqual([]);
});

test("classroom Day 5 goals are 2 wood / 2 leaves and signal fire consumes 1 metal", async ({ page }) => {
  const errors = await precondition("game boot", () => boot(page));
  await morning(page, true);
  await until(page, "classroom Day 5 started", (s) => s.classroom && s.mode === "explore" && !s.line && !s.prompt);
  await expect(page.getByTestId("step-wood")).toContainText("1/2");
  await expect(page.getByTestId("step-leaves")).toContainText("0/2");
  await page.keyboard.press("KeyC");
  await until(page, "classroom signal fire recipe open", (s) => s.craftOpen);
  const recipe = page.getByTestId("recipe-signalFire");
  await expect(recipe.locator('[title="wood: 1/2"]')).toBeVisible();
  await expect(recipe.locator('[title="leaves: 0/2"]')).toBeVisible();
  await expect(recipe.locator('[title="metal: 2/1"]')).toBeVisible();
  await page.getByTestId("craft-close").click();
  await signalFire(page, true);
  expect((await state(page)).bag.metal).toBe(1);
  expect((await state(page)).bag.signalFire).toBe(1);
  expect(errors).toEqual([]);
});
