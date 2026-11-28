import { expect, test, type Page } from "@playwright/test";
import { boot, goTo, hook, state, tap, waitFor, type SiState } from "./helpers";

/** Missing setup is a harness error, never a product pass or failure. */
async function precondition<T>(label: string, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    throw new Error(`HARNESS_PRECONDITION_FAILED: ${label}`, { cause: error });
  }
}

async function until<A = undefined>(page: Page, label: string, pred: (s: SiState, arg: A) => boolean, arg?: A, timeout = 30_000) {
  await precondition(label, () => waitFor(page, pred, timeout, arg));
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

/** Press E for an action whose sentence is `phrase`; answer it when it is new (a known action is quick). */
async function use(page: Page, phrase: string, asks: boolean) {
  await page.keyboard.press("KeyE");
  if (asks) await answer(page, phrase);
}

/** Cut bamboo stalks until the bag holds `n` long poles. */
async function poles(page: Page, n: number) {
  for (let i = 0; i < 12 && ((await state(page)).bag.pole ?? 0) < n; i++) {
    const ids = await hook<string[]>(page, "nodes", "bamboo");
    if (!ids.length) throw new Error("HARNESS_PRECONDITION_FAILED: no bamboo left");
    const before = (await state(page)).bag.pole ?? 0;
    await at(page, ids[0]);
    await use(page, "cutBamboo", false);
    await until(page, "bamboo cut", (s, b) => (s.bag.pole ?? 0) > b && s.mode === "explore", before);
  }
  expect((await state(page)).bag.pole ?? 0).toBeGreaterThanOrEqual(n);
}

interface Built { id: string; type: string; x: number; z: number; parts?: string[]; heights?: number[]; water?: number; fish?: number[] }
const building = async (page: Page, type: string) => (await state(page)).buildings.find((b) => b.type === type) as Built | undefined;

/** Fill a frame's open sockets through the real E action until `done` holds. */
async function fill(page: Page, type: string, done: (parts: string[]) => boolean, label: string) {
  for (let i = 0; i < 16; i++) {
    const b = await building(page, type);
    if (!b) throw new Error(`HARNESS_PRECONDITION_FAILED: no ${type}`);
    if (done(b.parts ?? [])) return;
    await until(page, `exploring before a ${type} part`, idle);
    const open = await hook<string[]>(page, "openSockets", b.id);
    if (!open.length) throw new Error(`HARNESS_PRECONDITION_FAILED: ${type} has no open socket`);
    const id = `${b.id}:${open[0]}`;
    await precondition(`focus ${id}`, () => goTo(page, id));
    const before = (b.parts ?? []).length;
    await page.keyboard.press("KeyE");
    // First part ever: "Put it here."; a short bar with only long poles: "It's too long." (then it is cut).
    for (let k = 0; k < 40; k++) {
      const st = await state(page);
      const now = (st.buildings.find((x) => x.id === b.id) as Built | undefined)?.parts ?? [];
      if (now.length > before) break;
      const pick = st.prompt?.buttons && st.prompt.status !== "correct" ? st.prompt.choices.find((c) => c === "putHere" || c === "tooLong") : undefined;
      if (pick) await tap(page, pick);
      else await page.waitForTimeout(250);
    }
    await until(page, `${label} part ${i + 1}`, (s, a) => ((s.buildings.find((x) => x.id === a.id) as Built | undefined)?.parts ?? []).length > a.before, { id: b.id, before });
  }
  throw new Error(`HARNESS_PRECONDITION_FAILED: ${label} did not finish`);
}

/** Put a kit down with the real preview (E), from an open spot near camp. */
async function placeKit(page: Page, item: string, x: number, z: number) {
  await until(page, `exploring before placing ${item}`, idle);
  await hook(page, "teleport", x, z, Math.PI);
  await hook(page, "setCameraYaw", 0);
  await page.getByTestId(`slot-${item}`).click();
  await until(page, `${item} preview`, (s) => s.mode === "place");
  await until(page, `${item} fits`, (s) => s.placeOk);
  await page.keyboard.press("KeyE");
  await until(page, `${item} placed`, (s, t) => s.buildings.some((b) => b.type === t) && s.mode === "explore", item === "rack" ? "rack" : "catcher");
}

test("Chapter 2 title start and Day 6: cove, questions, the box, canvas and carrying the chest home", async ({ page }) => {
  const errors = await precondition("game boot", () => boot(page));
  await page.evaluate(() => { (window as unknown as { __micUnavailable: boolean }).__micUnavailable = true; });
  await page.getByTestId("chapter-two").click();
  await expect(page.getByTestId("mic-startup-overlay")).toBeVisible();
  await page.getByTestId("teacher-options").click();
  await page.getByTestId("teacher-tap").click();

  await until(page, "Day 6 morning, tide out", (s) => s.day === 6 && s.chapterTwo.coveOpen && s.step === "cove" && (s.screen === "game" && s.mode === "explore" && !s.line && !s.prompt));
  let s = await state(page);
  expect(s.radioTried).toBe(true);
  expect(s.rescued).toBe(false);
  expect(s.buildings.some((b) => b.type === "shelter" && b.built)).toBe(true);
  expect(s.beacons).toContain("covePassage");
  expect(s.chapterTwo.stackLimit).toBe(10);

  // Kai walks his route; the player walks the passage into the cove.
  await until(page, "Kai waiting in the cove", (st) => st.kaiStage === "cove" && st.kaiRouteEmpty, undefined, 60_000);
  const world = await hook<{ kaiCove: { x: number; z: number }; seaChest: { x: number; z: number } }>(page, "world");
  await hook(page, "goto", world.kaiCove.x - 2.5, world.kaiCove.z + 1, world.kaiCove.x, world.kaiCove.z);
  await until(page, "arrived in the cove", (st) => st.chapterTwo.reachedCove && st.step === "askKai");

  // "What is this?" at a torn sail: Kai names it.
  await at(page, "canvas-1");
  expect((await state(page)).focus?.kind).toBe("ask");
  await page.keyboard.press("KeyE");
  await answer(page, "askWhat");
  await until(page, "Kai named the canvas", (st) => st.chapterTwo.asked.includes("canvas") && st.step === "coveBox");

  // The half-buried crate: "Open the box." (+2 rope, +1 canvas).
  const rope = (await state(page)).bag.rope ?? 0;
  await at(page, "coveCrate");
  await page.keyboard.press("KeyE");
  await answer(page, "openBox");
  await until(page, "cove crate opened", (st) => st.chapterTwo.coveBoxOpened && st.mode === "explore");
  s = await state(page);
  expect(s.bag.rope).toBe(rope + 2);
  expect(s.bag.canvas).toBe(1);

  // Canvas from the sail Kai named: "Get the canvas."
  await at(page, "canvas-1");
  await use(page, "getCanvas", true);
  await until(page, "two canvas", (st) => (st.bag.canvas ?? 0) === 2 && st.step === "carryBox");

  // The sea chest: ask, then "Carry the box." → "It's too heavy." → "Can you help me?" → "Let's go back."
  await at(page, "seaChest");
  await page.keyboard.press("KeyE");
  await answer(page, "askWhat");
  await until(page, "Kai named the chest", (st) => st.chapterTwo.asked.includes("chest") && (st.screen === "game" && st.mode === "explore" && !st.line && !st.prompt));
  await at(page, "seaChest");
  expect((await state(page)).focus?.kind).toBe("carry");
  await page.keyboard.press("KeyE");
  await answer(page, "carryBox");
  await answer(page, "tooHeavy");
  await answer(page, "canHelp");
  await answer(page, "goBack");
  await until(page, "carrying the chest with Kai", (st) => st.chapterTwo.carry === "chest" && st.mode === "explore");
  // While carrying, putting it down is the only thing on offer.
  await until(page, "put-down focus while carrying", (st) => st.focus?.kind === "putDown");
  s = await state(page);

  // Home: walk to camp, Kai keeps hold of the other end.
  const tent = s.buildings.find((b) => b.type === "shelter")!;
  await hook(page, "goto", tent.x + 3.5, tent.z + 2.5, tent.x + 6, tent.z + 2.5);
  // Carrying is slow: even holding Shift, no faster than 0.6 × walking (4.2 m/s).
  await page.keyboard.down("ShiftLeft");
  await page.keyboard.down("KeyW");
  await until(page, "walking with the chest", (st) => st.player.speed > 1);
  await page.waitForTimeout(400);
  const moving = (await state(page)).player.speed;
  await page.keyboard.up("KeyW");
  await page.keyboard.up("ShiftLeft");
  expect(moving).toBeLessThanOrEqual(4.2 * 0.6 + 0.05);
  await until(page, "Kai at the far end", (st) => Math.hypot(st.kaiAt.x - st.player.x, st.kaiAt.z - st.player.z) < 2.6);
  await page.keyboard.press("KeyE");
  await answer(page, "putHere");
  await until(page, "storage box at camp", (st) => st.buildings.some((b) => b.type === "storage") && st.chapterTwo.carry === null);
  await until(page, "What did you find?", (st) => st.prompt?.question === "What did you find?");
  await tap(page, "foundRope");
  await until(page, "Day 6 chores done", (st) => st.chapterTwo.found === "rope" && st.step === "sleep" && (st.screen === "game" && st.mode === "explore" && !st.line && !st.prompt));
  s = await state(page);
  expect(s.chapterTwo.stackLimit).toBe(20);
  expect(s.quest.done).toEqual(expect.arrayContaining(["cove", "askKai", "coveBox", "canvas", "carryBox"]));
  expect(s.said).toEqual(expect.arrayContaining(["askWhat", "getCanvas", "carryBox", "tooHeavy", "canHelp", "goBack", "putHere", "foundRope"]));
  expect(errors).toEqual([]);
});

test("Day 7: the thicket, bamboo poles, the rack (too long, shaking, strong) and drying a fish", async ({ page }) => {
  const errors = await precondition("game boot", () => boot(page));
  await hook(page, "setMic", false);
  await hook(page, "startDay", 7);
  await until(page, "Day 7 morning done", (s) => s.day === 7 && s.step === "grove" && (s.screen === "game" && s.mode === "explore" && !s.line && !s.prompt));
  expect((await state(page)).beacons).toContain("groveGate");

  await at(page, "groveGate");
  await page.keyboard.press("KeyE");
  await answer(page, "cutBamboo");
  await until(page, "grove open", (s) => s.chapterTwo.groveOpen && (s.screen === "game" && s.mode === "explore" && !s.line && !s.prompt) && s.step === "poles");
  expect((await state(page)).bag.pole).toBe(2);
  await poles(page, 9);
  expect((await state(page)).step).toBe("rackSite");

  // Kai: "What do you want to make?" → "Let's build a rack."
  await at(page, "kai");
  await page.keyboard.press("KeyE");
  await answer(page, "buildRack");
  await until(page, "rack kit in the bag", (s) => (s.bag.rack ?? 0) === 1 && (s.screen === "game" && s.mode === "explore" && !s.line && !s.prompt));
  // Open sand south of the tent, clear of the fire, the palms and Kai.
  await placeKit(page, "rack", -1, 13);

  // Legs and bars; a short end bar with only long poles is "too long" and gets cut in two.
  await fill(page, "rack", (p) => ["leg1", "leg2", "leg3", "leg4", "barN", "barS", "barW", "barE"].every((id) => p.includes(id)), "rack frame");
  let s = await state(page);
  expect(s.said).toEqual(expect.arrayContaining(["putHere", "tooLong"]));
  expect(s.step).toBe("rackStrong");
  // Braces go in N, S, W order: two on the long faces alone still shake.
  const rack = (await building(page, "rack"))!;
  await fill(page, "rack", (p) => p.includes("braceS"), "long-face braces");
  let st = await state(page);
  expect(st.step).toBe("rackStrong");
  expect(st.quest.done).not.toContain("rackStrong");
  // One short-face brace makes it strong.
  await fill(page, "rack", (p) => p.includes("braceW"), "short-face brace");
  await until(page, "rack strong", (st) => st.step === "dryFish");

  // Kai gives a fish if the bag has none; it hangs on the rack.
  if (!((await state(page)).bag.fish)) {
    await at(page, "kai");
    await page.keyboard.press("KeyE");
    await until(page, "Kai gave a fish", (st) => (st.bag.fish ?? 0) > 0 && (st.screen === "game" && st.mode === "explore" && !st.line && !st.prompt));
  }
  await at(page, rack.id);
  await page.keyboard.press("KeyE");
  await answer(page, "dryFish");
  await until(page, "fish hanging", (st) => st.chapterTwo.fishDried === 1 && st.step === "sleep");
  s = await state(page);
  expect((s.buildings.find((b) => b.id === rack.id) as Built).fish?.length).toBe(1);
  expect(errors).toEqual([]);
});

test("Day 8: rain, the barrel, the rain catcher test and boiling rain water", async ({ page }) => {
  const errors = await precondition("game boot", () => boot(page));
  await hook(page, "setMic", false);
  await hook(page, "startDay", 8);
  await until(page, "How's the weather?", (s) => s.day === 8 && s.prompt?.question === "How's the weather?");
  expect((await state(page)).chapterTwo.rainK).toBeGreaterThan(0);
  await tap(page, "raining");
  await answer(page, "weNeedWater");
  await until(page, "Day 8 morning done", (s) => (s.bag.catcher ?? 0) === 1 && (s.screen === "game" && s.mode === "explore" && !s.line && !s.prompt) && s.step === "poles");
  // The open fire went out in the rain.
  expect((await state(page)).buildings.some((b) => b.type === "campfire" && b.lit)).toBe(false);

  await poles(page, 4);
  expect((await state(page)).step).toBe("barrel");

  // The barrel is carried alone.
  await at(page, "coveBarrel");
  await page.keyboard.press("KeyE");
  await answer(page, "carryBarrel");
  await until(page, "carrying the barrel", (s) => s.chapterTwo.carry === "barrel" && s.mode === "explore");
  const tent = (await state(page)).buildings.find((b) => b.type === "shelter")!;
  await hook(page, "goto", tent.x + 6, tent.z + 6, tent.x + 6, tent.z + 8);
  await until(page, "put-down focus with the barrel", (s) => s.focus?.kind === "putDown");
  await page.keyboard.press("KeyE");
  await until(page, "barrel at camp", (s) => s.buildings.some((b) => b.type === "barrel") && s.chapterTwo.carry === null && s.step === "catcherSite");

  await placeKit(page, "catcher", -1, 13);
  await fill(page, "catcher", (p) => p.includes("canvas"), "rain catcher");
  await until(page, "catcher built", (s) => s.step === "catchRain" && (s.screen === "game" && s.mode === "explore" && !s.line && !s.prompt));
  const catcher = (await building(page, "catcher"))!;
  expect(catcher.heights).toEqual([1, 1, 1, 1]);

  // A flat canvas: the test says it doesn't work, then "Let's try again." and a hint.
  await at(page, `${catcher.id}:test`);
  await page.keyboard.press("KeyE");
  await until(page, "How is it?", (s) => s.prompt?.question === "How is it?");
  await tap(page, "notWork");
  await answer(page, "tryAgain");
  await until(page, "hint after the flat test", idle);

  // Corner 2 stays the lowest: raise the other three ("Make it higher.").
  for (const c of [0, 1, 3]) {
    await at(page, `${catcher.id}:c${c}`);
    await page.keyboard.press("KeyE");
    await answer(page, "higher");
    await until(page, `corner ${c} raised`, (s, a) => ((s.buildings.find((b) => b.id === a.id) as Built).heights ?? [])[a.c] === 2, { id: catcher.id, c });
  }
  // The barrel goes under corner 2's stream (moving it left and right is covered by unit tests).
  await hook(page, "standBarrelUnder", catcher.id, 2);
  await at(page, `${catcher.id}:test`);
  await page.keyboard.press("KeyE");
  await until(page, "How is it? (working)", (s) => s.prompt?.question === "How is it?");
  await tap(page, "flowing");
  await until(page, "rain caught", (s) => s.chapterTwo.rainCaught > 0, undefined, 60_000);
  expect((await state(page)).chapterTwo.flows[catcher.id].problem).toBeNull();
  await until(page, "rain stopped", (s) => s.chapterTwo.rainDone && s.step === "boilRain", undefined, 60_000);

  // Water from the barrel, a new fire, then "Boil the water."
  // The barrel stands under a corner: walk up to it from outside the catcher, where it is nearer than the corner.
  const barrel = (await building(page, "barrel"))!;
  const out = { x: barrel.x - catcher.x, z: barrel.z - catcher.z };
  const len = Math.hypot(out.x, out.z);
  await until(page, "exploring before the barrel", idle);
  await hook(page, "goto", barrel.x + (out.x / len) * 1.3, barrel.z + (out.z / len) * 1.3, barrel.x, barrel.z);
  await until(page, "barrel focused", (s, id) => s.focus?.id === id, barrel.id);
  await page.keyboard.press("KeyE");
  await answer(page, "getWater");
  await until(page, "rain water in the bag", (s) => (s.bag.water ?? 0) > 0 && (s.screen === "game" && s.mode === "explore" && !s.line && !s.prompt));
  // A fire will not light while the rain is still heavy; it eases off over a few seconds.
  await until(page, "rain eased", (s) => s.chapterTwo.rainK < 0.3);
  const fire = (await state(page)).buildings.find((b) => b.type === "campfire")!;
  await at(page, fire.id);
  await use(page, "makeFire", true);
  await until(page, "fire relit", (s, id) => Boolean(s.buildings.find((b) => b.id === id)?.lit) && (s.screen === "game" && s.mode === "explore" && !s.line && !s.prompt), fire.id);
  await at(page, fire.id);
  await use(page, "boilWater", false);
  await until(page, "rain water boiled", (s) => s.chapterTwo.boiledDay >= 8 && (s.bag.boiledWater ?? 0) > 0 && s.step === "sleep");
  expect(errors).toEqual([]);
});

test("a v3 free-play save resumes at the Chapter 2 Day 6 morning; its water becomes boiled water", async ({ page }) => {
  const errors = await precondition("game boot", () => boot(page));
  await hook(page, "setMic", false);
  await hook(page, "startDay", 4);
  await until(page, "Day 4 morning question", (s) => s.day === 4 && s.prompt?.question === "Can you make a torch?");
  await page.getByTestId("btn-settings").click();
  await page.getByTestId("settings-title").click();
  await precondition("create a v3 free-play fixture", () => page.evaluate(() => {
    const saved = localStorage.getItem("si.save.v5");
    if (!saved) throw new Error("v5 source save missing");
    const old = JSON.parse(saved);
    for (const field of ["radioTried", "reachedUpper", "stairsOpen", "bucketFilled", "tankFilled", "water", "boiled", "boiledDay", "coveOpen", "groveOpen", "reachedCove", "coveBoxOpened", "asked", "chestTaken", "barrelTaken", "carry", "fishDried", "rainCaught", "rainDone"]) delete old[field];
    Object.assign(old, {
      v: 3, quest: { day: 7, done: [], complete: false }, sleptDay: 6, t: 0.4, rescued: true, signalLit: true,
      cliffOpen: true, reachedClifftop: true, kaiStage: "clifftop", bag: { ...old.bag, water: 2 }
    });
    delete old.bag.boiledWater;
    localStorage.removeItem("si.save.v5");
    localStorage.setItem("si.save.v3", JSON.stringify(old));
  }));
  await page.reload();
  await precondition("v3 save Continue available", () => expect(page.getByTestId("continue")).toBeVisible());
  await page.evaluate(() => { (window as unknown as { __micUnavailable: boolean }).__micUnavailable = true; });
  await page.getByTestId("continue").click();
  await expect(page.getByTestId("mic-startup-overlay")).toBeVisible();
  await page.getByTestId("teacher-options").click();
  await page.getByTestId("teacher-tap").click();
  await until(page, "Day 6 cove morning after migration", (s) => s.day === 6 && s.chapterTwo.coveOpen && s.step === "cove" && (s.screen === "game" && s.mode === "explore" && !s.line && !s.prompt));
  const s = await state(page);
  // The old rescue is now the tried radio call (the rescue ends the whole story).
  expect(s.radioTried).toBe(true);
  expect(s.rescued).toBe(false);
  expect(s.bag.boiledWater).toBe(2);
  expect(s.bag.water ?? 0).toBe(0);
  expect(s.freePlay).toBe(false);
  expect(await page.evaluate(() => localStorage.getItem("si.save.v5") !== null)).toBe(true);
  expect(errors).toEqual([]);
});
