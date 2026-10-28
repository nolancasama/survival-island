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
  await precondition(label, () => waitFor(page, pred, 30_000, arg));
}

const idle = (s: SiState) => s.screen === "game" && s.mode === "explore" && !s.line && !s.prompt;

async function at(page: Page, id: string) {
  await until(page, `exploring before ${id}`, idle);
  await precondition(`focus ${id}`, () => goTo(page, id));
}

async function answer(page: Page, phrase: string) {
  await until(page, `tappable prompt offers ${phrase}`, (s, id) => Boolean(s.prompt?.buttons && s.prompt.status !== "correct" && s.prompt.choices.includes(id)), phrase);
  await precondition(`tap ${phrase}`, () => tap(page, phrase));
}

/** Pause automatic dialogue advancement when a particular line needs inspection. */
async function fast(page: Page, on: boolean) {
  await page.evaluate((enabled) => {
    const url = new URL(location.href);
    url.searchParams.set("fast", enabled ? "1" : "0");
    history.replaceState(null, "", url);
  }, on);
}

async function morning(page: Page, yes: boolean) {
  await hook(page, "setMic", false);
  await hook(page, "startDay", 4);
  await until(page, "Day 4 morning torch question", (s) => s.day === 4 && s.prompt?.question === "Can you make a torch?");
  expect((await state(page)).prompt?.choices).toEqual(["yesICan", "noICant"]);
  await fast(page, false);
  await answer(page, yes ? "yesICan" : "noICant");
  await until(page, "morning answer reply", (s, affirmative) => s.line?.en === (affirmative ? "Show me!" : "Here are some leaves."), yes);
  await fast(page, true);
  await page.keyboard.press("KeyE");
  await until(page, "torch recipe unlocked after morning", (s) => s.mode === "explore" && s.unlocked.includes("torch"));
  const s = await state(page);
  expect(s.kai.canTorch).toBe(yes);
  expect(s.bag.leaves ?? 0).toBe(yes ? 0 : 1);
  expect(s.beacons).toContain("caveMouth");
  expect(s.bridgeBuilt).toBe(true);
  expect(s.step).toBe("torch");
}

async function torch(page: Page) {
  if (!(await state(page)).bag.leaves) {
    await at(page, await precondition("reachable leaves", () => firstNode(page, "leaves")));
    await page.keyboard.press("KeyE");
    await until(page, "familiar leaves collected", (s) => (s.bag.leaves ?? 0) >= 1 && s.mode === "explore");
  }
  // The Make button pulses while something can be made, so it is never "stable" to click.
  await page.keyboard.press("KeyC");
  await precondition("torch craft is enabled", () => expect(page.getByTestId("make-torch")).toBeEnabled());
  await page.getByTestId("make-torch").click();
  await answer(page, "craftTorch");
  await until(page, "torch crafted", (s) => s.bag.torch === 1 && s.mode === "explore");
  expect((await state(page)).quest.done).toContain("torch");
}

async function enter(page: Page, first = true) {
  await at(page, "caveMouth");
  await page.keyboard.press("KeyE");
  if (first) {
    await until(page, "go cave action has three sentences", (s) => s.prompt?.sentences[0] === "Go in the cave.");
    expect((await state(page)).prompt?.choices).toHaveLength(3);
    await answer(page, "goCave");
  }
  await until(page, "cave entered and fade complete", (s) => s.inCave && s.enteredCave && s.mode === "explore");
  expect((await state(page)).quest.done).toContain("cave");
  expect(await hook<boolean>(page, "reachable", "kai")).toBe(false);
  expect(await hook<boolean>(page, "reachable", "metal-1")).toBe(true);
}

async function metal(page: Page) {
  await page.getByTestId("btn-needs").click();
  await answer(page, "needMetal");
  await until(page, "metal need points inside cave", idle);
  expect((await state(page)).beacons).toEqual(expect.arrayContaining(["metal-1"]));
  for (let i = 0; i < 2; i++) {
    await at(page, await precondition("reachable untaken metal", () => firstNode(page, "metal")));
    const before = (await state(page)).bag.metal ?? 0;
    await page.keyboard.press("KeyE");
    if (i === 0) {
      await until(page, "first metal action has three sentences", (s) => s.prompt?.sentences[0] === "Get the metal.");
      expect((await state(page)).prompt?.choices).toHaveLength(3);
      await answer(page, "getMetal");
    }
    await until(page, "metal gathered and play resumed", (s, n) => s.bag.metal === n + 1 && s.mode === "explore", before);
    expect((await state(page)).prompt).toBeNull();
  }
  expect((await state(page)).quest.done).toContain("metal");
}

async function radio(page: Page) {
  await until(page, "earlier crate sentence already familiar", (s) => s.known.includes("openBox"));
  await at(page, "caveBox");
  await fast(page, false);
  await page.keyboard.press("KeyE");
  // Day 1's familiar sentence is deliberately required again for this new box.
  await answer(page, "openBox");
  await until(page, "radio discovery line", (s) => s.line?.en === "A radio! It's old, but it works!");
  const s = await state(page);
  expect(s.caveBoxOpened).toBe(true);
  expect(s.bag.radio).toBe(1);
  expect(s.worldAnimation.caveBoxOpenT0).toBeGreaterThanOrEqual(0);
  await fast(page, true);
  await page.keyboard.press("KeyE");
  await until(page, "radio found and exploration resumed", idle);
  expect((await state(page)).quest.done).toContain("radio");
  expect((await state(page)).focus?.id).not.toBe("caveBox");
}

async function leave(page: Page) {
  const world = await hook<{ caveExit: { x: number; z: number }; caveOutside: { x: number; z: number } }>(page, "world");
  await until(page, "exploring inside cave before exit", (s) => s.inCave && s.mode === "explore");
  await hook(page, "teleport", world.caveExit.x, world.caveExit.z);
  await until(page, "walk into exit returns outdoors", (s) => !s.inCave && s.mode === "explore");
  const s = await state(page);
  expect(s.prompt).toBeNull();
  expect(s.player.x).toBeCloseTo(world.caveOutside.x, 1);
  expect(s.player.z).toBeCloseTo(world.caveOutside.z, 1);
}

for (const branch of [{ yes: true, have: "radio" }, { yes: false, have: "metal" }] as const) {
  test(`tapping: Day 4 through card, morning ${branch.yes ? "yes" : "no"}, show Kai ${branch.have}`, async ({ page }) => {
    const errors = await precondition("game boot", () => boot(page));
    await morning(page, branch.yes);
    await at(page, "caveMouth");
    await fast(page, false);
    await page.keyboard.press("KeyE");
    await until(page, "dark cave refusal", (s) => s.line?.en === "It's dark! I need a torch.");
    expect((await state(page)).inCave).toBe(false);
    expect((await state(page)).enteredCave).toBe(false);
    await fast(page, true);
    await page.keyboard.press("KeyE");
    await until(page, "refusal finished", idle);
    await torch(page);
    await page.getByTestId("btn-needs").click();
    await answer(page, "needMetal");
    await until(page, "outside metal hint answered", idle);
    expect((await state(page)).beacons).toEqual(["caveMouth"]);
    await enter(page);
    const clock = (await state(page)).clock;
    const start = (await state(page)).time;
    await until(page, "live cave time elapsed", (s, t) => s.time >= t + 1, start);
    expect((await state(page)).clock).toBe(clock);
    await metal(page);
    await radio(page);
    await leave(page);
    await at(page, "kai");
    await fast(page, false);
    await page.keyboard.press("KeyE");
    await until(page, "Kai inventory question", (s) => s.prompt?.question === "What do you have?");
    expect((await state(page)).prompt?.choices).toEqual(["haveRadio", "haveMetal"]);
    await answer(page, branch.have === "radio" ? "haveRadio" : "haveMetal");
    await until(page, "Kai acknowledges inventory answer", (s, have) => s.line?.en === (have === "radio" ? "A radio! We can call for help!" : "Metal! Good for a signal fire."), branch.have);
    await page.keyboard.press("KeyE");
    if (branch.have === "metal") {
      await until(page, "Kai also notices the radio", (s) => s.line?.en === "And a radio? Wow!");
      await page.keyboard.press("KeyE");
    }
    await until(page, "Kai describes tomorrow's plan", (s) => s.line?.en === "Tomorrow, let's go to the clifftop. We can make a signal fire there.");
    await page.keyboard.press("KeyE");
    await until(page, "Kai's Day 4 evening promise", (s) => s.line?.en === "Tomorrow we go home!");
    expect((await state(page)).quest.done).toContain("showKai");
    await page.keyboard.press("KeyE");
    await until(page, "Kai's shelter reminder", (s) => s.line?.en === "It's getting dark. Let's sleep in the tent!");
    await fast(page, true);
    await page.keyboard.press("KeyE");
    await until(page, "show Kai completed and signal fire unlocked", (s, have) => s.kai.have === have && s.unlocked.includes("signalFire") && s.quest.done.includes("showKai") && s.mode === "explore", branch.have);
    expect((await state(page)).step).toBe("sleep");
    await hook(page, "setClock", 0.95);
    await until(page, "Day 4 night with shelter beacon", (s) => s.isNight && s.beacons.includes("bE2eShelter") && s.mode === "explore");
    await at(page, "bE2eShelter");
    await page.keyboard.press("KeyE");
    await answer(page, "sleep");
    await until(page, "Day 4 card after sleep", (s) => s.screen === "dayEnd" && s.sleptDay === 4);
    const s = await state(page);
    expect(s.quest.complete).toBe(true);
    expect(s.quest.done).toEqual(expect.arrayContaining(["torch", "cave", "metal", "radio", "showKai", "sleep"]));
    expect(s.dayNew).toEqual(expect.arrayContaining(["craftTorch", "goCave", "getMetal", branch.have === "radio" ? "haveRadio" : "haveMetal"]));
    await expect(page.getByTestId("said")).toContainText("NEW");
    await expect(page.getByTestId("said")).toContainText("Open the box.");
    await expect(page.getByTestId("next-day")).toContainText("Day 5");
    await page.getByTestId("next-day").click();
    await until(page, "Day 5 starts safely", (st) => st.day === 5 && st.screen === "game" && st.mode === "explore" && st.dayTitle === null);
    expect((await state(page)).freePlay).toBe(false);
    expect(errors).toEqual([]);
  });
}

test("save inside cave resumes at mouth with cave facts, metal and radio", async ({ page }) => {
  await precondition("game boot", () => boot(page));
  await morning(page, false);
  await torch(page);
  await enter(page);
  await metal(page);
  await radio(page);
  await until(page, "inside cave with discoveries before saving", (s) => s.inCave && s.enteredCave && s.caveBoxOpened && s.bag.radio === 1 && s.bag.metal === 2 && s.mode === "explore");
  await page.getByTestId("btn-settings").click();
  await page.getByTestId("settings-title").click();
  const outside = (await hook<{ caveOutside: { x: number; z: number } }>(page, "world")).caveOutside;
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("si.save.v3") ?? "null") as { player: { x: number; z: number }; enteredCave: boolean; caveBoxOpened: boolean } | null);
  if (!saved) throw new Error("HARNESS_PRECONDITION_FAILED: v3 cave save exists");
  expect(saved.player.x).toBe(outside.x);
  expect(saved.player.z).toBe(outside.z);
  await page.reload();
  await precondition("saved game Continue available", () => expect(page.getByTestId("continue")).toBeVisible());
  await page.getByTestId("continue").click();
  await until(page, "save restored outdoors", idle);
  const s = await state(page);
  expect(s.inCave).toBe(false);
  expect(s.enteredCave).toBe(true);
  expect(s.caveBoxOpened).toBe(true);
  expect(s.bag.radio).toBe(1);
  expect(s.bag.metal).toBe(2);
  expect(s.kai.canTorch).toBe(false);
  expect(s.player.x).toBeCloseTo(outside.x, 1);
  expect(s.player.z).toBeCloseTo(outside.z, 1);
  await enter(page, false);
  expect((await state(page)).prompt).toBeNull();
});

test("v2 free-play save migrates to Day 4 morning with prior inventory", async ({ page }) => {
  await precondition("game boot", () => boot(page));
  await morning(page, true);
  await page.getByTestId("btn-settings").click();
  await page.getByTestId("settings-title").click();
  await precondition("create valid legacy free-play fixture", () => page.evaluate(() => {
    const saved = localStorage.getItem("si.save.v3");
    if (!saved) throw new Error("v3 source save missing");
    const old = JSON.parse(saved);
    old.v = 2;
    old.quest = { day: 6, done: [], complete: false };
    old.sleptDay = 5;
    old.t = 0.8;
    old.kai = { need: "wood", canFire: true, canAxe: true, want: "water" };
    old.unlocked = old.unlocked.filter((id: string) => id !== "torch");
    for (const field of ["enteredCave", "caveBoxOpened", "cliffOpen", "reachedClifftop", "signalLit", "rescued", "kaiStage"]) delete old[field];
    localStorage.removeItem("si.save.v3");
    localStorage.setItem("si.save.v2", JSON.stringify(old));
  }));
  await page.reload();
  await precondition("legacy save Continue available", () => expect(page.getByTestId("continue")).toBeVisible());
  await page.evaluate(() => { (window as unknown as { __micUnavailable: boolean }).__micUnavailable = true; });
  await page.getByTestId("continue").click();
  await expect(page.getByTestId("mic-startup-overlay")).toBeVisible();
  await page.getByTestId("teacher-options").click();
  await page.getByTestId("teacher-tap").click();
  await until(page, "legacy save Day 4 morning question", (s) => s.day === 4 && s.prompt?.question === "Can you make a torch?");
  const s = await state(page);
  expect(s.freePlay).toBe(false);
  expect(s.bridgeBuilt).toBe(true);
  expect(s.bag).toEqual(expect.objectContaining({ axe: 1, container: 1, rod: 1, wood: 1 }));
  expect(s.enteredCave).toBe(false);
  expect(s.caveBoxOpened).toBe(false);
  await answer(page, "yesICan");
  await until(page, "legacy morning finished", idle);
  expect((await state(page)).step).toBe("torch");
});
