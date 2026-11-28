import { expect, test, type Page } from "@playwright/test";
import { boot, goTo, hook, speak, state, tap, waitFor, type SiState } from "./helpers";

/** Missing setup is a harness error, never a product pass or failure. */
async function precondition<T>(label: string, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    throw new Error(`HARNESS_PRECONDITION_FAILED: ${label}`, { cause: error });
  }
}

async function until<A = undefined>(page: Page, label: string, pred: (s: SiState, arg: A) => boolean, arg?: A, timeout = 40_000) {
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

async function line(page: Page, en: string) {
  await until(page, `line: ${en}`, (s, text) => s.line?.en === text, en);
  await page.keyboard.press("KeyE");
}

/** Read through whatever Kai or the narrator is saying. */
async function skipLines(page: Page) {
  for (let i = 0; i < 12; i++) {
    const s = await state(page);
    if (!s.line) return;
    await page.keyboard.press("KeyE");
    await page.waitForTimeout(80);
  }
}

async function fast(page: Page, on: boolean) {
  await page.evaluate((enabled) => {
    const url = new URL(location.href);
    url.searchParams.set("fast", enabled ? "1" : "0");
    history.replaceState(null, "", url);
  }, on);
}

const pipes = (s: SiState) => s.chapterThree.water.pipes.length;
const tankOf = (s: SiState) => s.chapterThree.containers.find((c) => c.type === "tank");

/**
 * Lay one piece with the real controls: aim (the hook fixes the direction the
 * player would walk toward), T for long/short, X/Z for the post, E to put.
 */
async function layPiece(page: Page, dir: number, len: "long" | "short", notch: number) {
  await until(page, "laying", (s) => s.mode === "pipe" && s.chapterThree.pipe?.kind === "lay" && !s.prompt);
  await hook(page, "setPipeDir", dir);
  for (let i = 0; i < 3; i++) {
    const ui = (await state(page)).chapterThree.pipe;
    if (ui?.kind === "lay" && ui.len !== len) await page.keyboard.press("KeyT");
  }
  for (let i = 0; i < 6; i++) {
    const ui = (await state(page)).chapterThree.pipe;
    if (ui?.kind !== "lay" || ui.notch === notch) break;
    await page.keyboard.press(ui.notch < notch ? "KeyX" : "KeyZ");
  }
  await until(page, "the preview has this piece", (s, want) => {
    const ui = s.chapterThree.pipe;
    return ui?.kind === "lay" && ui.len === want.len && ui.notch === want.notch && s.chapterThree.plan?.from === ui.from && s.chapterThree.dir === want.dir;
  }, { len, notch, dir });
  const before = pipes(await state(page));
  await page.keyboard.press("KeyE");
  // A first connection asks "Connect them."
  for (let k = 0; k < 40; k++) {
    const s = await state(page);
    if (pipes(s) > before) break;
    if (s.prompt?.buttons && s.prompt.status !== "correct" && s.prompt.choices.includes("connect")) await tap(page, "connect");
    else await page.waitForTimeout(100);
  }
  await until(page, "piece put", (s, b) => s.chapterThree.water.pipes.length > b, before);
}

test("Chapter 3 title start and Day 9: the waterfall, the plan, the stairs, and a test pipe that is too high, then fixed", async ({ page }) => {
  const errors = await precondition("game boot", () => boot(page));
  await fast(page, false);
  await page.getByTestId("chapter-three").click();
  await until(page, "Day 9 morning", (s) => s.day === 9 && s.line?.en === "Good morning! Our barrel is almost empty. Rain doesn't come every day.");
  await page.keyboard.press("KeyE");
  await line(page, "Look! A waterfall! The water up there never stops.");
  await line(page, "There is a path near the pond. I'll meet you at the waterfall!");
  await until(page, "Kai sets off the long way", (s) => (s.screen === "game" && s.mode === "explore" && !s.line && !s.prompt) && s.kaiStage === "upper" && !s.kaiRouteEmpty && s.step === "upper");
  let s = await state(page);
  expect(s.beacons).toContain("climbPath");
  expect(s.chapterThree.stairsOpen).toBe(false);
  expect(s.buildings.some((b) => b.type === "catcher")).toBe(true);

  // The long way up ends on the shelf (the climb path is open: the bridge is built).
  await hook(page, "finishKaiRoute");
  const world = await hook<{ climbPath: Array<{ x: number; z: number }>; kaiUpper: { x: number; z: number }; tangle: { x: number; z: number } }>(page, "world");
  const top = world.climbPath[world.climbPath.length - 1];
  await hook(page, "goto", top.x, top.z, -50, -6.5);
  await until(page, "arrived at the Upper Stream", (st) => st.chapterThree.reachedUpper && st.step === "pipePlan");
  await line(page, "Wow! A waterfall! And a stream up high!");

  // Kai: "What can you see?" and the plan (spoken with the microphone).
  await at(page, "kai");
  await page.keyboard.press("KeyE");
  await until(page, "Kai asks what you can see", (st) => st.prompt?.question === "What can you see?");
  expect((await state(page)).prompt?.choices).toEqual(["seeWaterfall", "seeStream", "seeRocks"]);
  await speak(page, "I see a waterfall");
  await line(page, "Yes! A big waterfall. The water is high up here.");
  await line(page, "Water flows down. Always down! And our camp is down there.");
  await until(page, "the plan prompt", (st) => st.prompt?.question === "What do you want to make?");
  await speak(page, "Let's build a pipe");
  await line(page, "Good idea! Bamboo pipes!");
  await line(page, "First, let's try. Make a pipe from the rock with the water to my bucket!");
  await line(page, "We need bamboo. Look! Old bamboo is over there.");
  await until(page, "plan made, bucket on the table rock", (st) => (st.screen === "game" && st.mode === "explore" && !st.line && !st.prompt) && st.chapterThree.pipePlan && st.step === "tangle");
  s = await state(page);
  expect(s.chapterThree.seen).toBe("waterfall");
  expect(s.beacons).toContain("tangle");
  const bucket = s.chapterThree.containers.find((c) => c.type === "bucket")!;
  expect(bucket).toBeTruthy();

  // The fallen bamboo at the top of the stairs: "Cut the bamboo." gives poles and opens the stairs.
  const poles = s.bag.pole ?? 0;
  await at(page, "tangle");
  await page.keyboard.press("KeyE");
  await speak(page, "Cut the bamboo");
  await line(page, "Wow! A way down to the beach!");
  await until(page, "stairs open", (st) => (st.screen === "game" && st.mode === "explore" && !st.line && !st.prompt) && st.chapterThree.stairsOpen && st.step === "bucket");
  expect((await state(page)).bag.pole).toBe(poles + 4);

  // The test pipe: from the upper intake toward the bucket, it snaps onto it ("Connect them.").
  await at(page, "i:upper");
  await page.keyboard.press("KeyE");
  await until(page, "laying from the upper intake", (st) => st.mode === "pipe" && st.chapterThree.pipe?.kind === "lay");
  await expect(page.getByTestId("pipe-bar")).toBeVisible();
  await hook(page, "setPipeDir", 5);
  await until(page, "the preview snaps to the bucket and climbs", (st) => st.chapterThree.plan?.snap?.kind === "container" && st.chapterThree.plan.slope === "up");
  await expect(page.getByTestId("slope-up")).toBeVisible();
  await page.getByTestId("pipe-put").click();
  await until(page, "Connect them.", (st) => st.prompt?.sentences[0] === "Connect them.");
  await speak(page, "Connect them");
  await until(page, "piece put; laying ends at the bucket", (st) => st.chapterThree.water.pipes.length === 1 && st.mode === "explore");
  // The post on the table rock is higher than the lip: the water spills at the intake.
  await hook(page, "settleWater");
  s = await state(page);
  const post = s.chapterThree.water.joints[0].id;
  expect(s.chapterThree.overflows).toEqual([{ at: "i:upper", tooHigh: post }]);
  expect(s.chapterThree.containers.find((c) => c.type === "bucket")!.problem).toBe("tooHigh");

  // Kai looks: "How is it?" — "It's too high."
  await at(page, "kai");
  await page.keyboard.press("KeyE");
  await until(page, "the test question", (st) => st.prompt?.question === "How is it?");
  expect((await state(page)).prompt?.choices).toEqual(["flowing", "notWork", "tooHigh", "tooLow"]);
  await speak(page, "It's too high");
  await line(page, "You're right.");
  await speak(page, "Let's try again");
  await line(page, "This post is too high. Water can't go up! Make it lower.");
  await until(page, "the too-high post is lit", (st, id) => st.beacons.includes(id), post);

  // The post's panel: one notch lower, and the water flows into the bucket.
  await at(page, post);
  await page.keyboard.press("KeyE");
  await until(page, "the post's panel", (st) => st.mode === "pipe" && st.chapterThree.pipe?.kind === "edit");
  await expect(page.getByTestId("joint-panel")).toBeVisible();
  await page.getByTestId("joint-lower").click();
  await until(page, "lowered and flowing", (st) => st.chapterThree.overflows.length === 0 && (st.chapterThree.fills[st.chapterThree.containers.find((c) => c.type === "bucket")!.id] ?? 0) > 0);
  await page.getByTestId("joint-done").click();
  await hook(page, "settleWater");
  await until(page, "it works", (st) => st.line?.en === "Look! It works!");
  await page.keyboard.press("KeyE");
  await speak(page, "The water is flowing");
  await line(page, "Water goes down the pipe. Tomorrow, let's make a long pipe to our camp!");
  await line(page, "Let's go home. The stairs are fast!");
  await until(page, "Day 9 done but sleep", (st) => (st.screen === "game" && st.mode === "explore" && !st.line && !st.prompt) && st.chapterThree.bucketFilled && st.step === "sleep" && st.kaiStage === "camp");
  expect(errors).toEqual([]);
});

test("Day 10: poles, a line down the stairs built with keys and buttons, save and resume, the tank fills, boil, the Chapter 3 card", async ({ page }) => {
  const errors = await precondition("game boot", () => boot(page));
  await hook(page, "setMic", false);
  await fast(page, false);
  await hook(page, "startDay", 10);
  await until(page, "Day 10 morning", (s) => s.day === 10 && s.line?.en === "Good morning! Look! I made a big water tank!");
  await page.keyboard.press("KeyE");
  await line(page, "Let's bring water from the waterfall to our tank!");
  await line(page, "We need bamboo poles. Get six poles.");
  await until(page, "Day 10 exploring", (s) => (s.screen === "game" && s.mode === "explore" && !s.line && !s.prompt) && s.step === "poles");
  let s = await state(page);
  const tank = tankOf(s)!;
  expect(tank).toBeTruthy();
  expect(s.chapterThree.stairsOpen && s.chapterThree.bucketFilled).toBe(true);
  expect(s.bag.pole).toBe(3);

  // Backtracking to the grove for bamboo.
  const ids = await hook<string[]>(page, "nodes", "bamboo");
  await at(page, ids[0]);
  await page.keyboard.press("KeyE");
  await until(page, "bamboo cut", (st) => (st.bag.pole ?? 0) >= 6 && st.step === "pipeCamp");

  // The line from the lower intake down the rock stairs, its posts kept high.
  await at(page, "i:lower");
  await page.keyboard.press("KeyE");
  await layPiece(page, 3, "short", 3);
  s = await state(page);
  expect(s.bag.shortPole).toBe(1);
  await layPiece(page, 3, "long", 4);
  await layPiece(page, 3, "long", 4);
  // Save mid-build and come back.
  await page.keyboard.press("Escape");
  await until(page, "laying stopped", idle);
  const end = (await state(page)).chapterThree.water.joints.at(-1)!.id;
  await page.getByTestId("btn-settings").click();
  await page.getByTestId("settings-title").click();
  await until(page, "saved to title", (st) => st.screen === "title");
  await page.reload();
  await precondition("Continue available", () => expect(page.getByTestId("continue")).toBeVisible());
  await page.evaluate(() => { (window as unknown as { __micUnavailable: boolean }).__micUnavailable = true; });
  await page.getByTestId("continue").click();
  await expect(page.getByTestId("mic-startup-overlay")).toBeVisible();
  await page.getByTestId("teacher-options").click();
  await page.getByTestId("teacher-tap").click();
  await until(page, "resumed with the half-built line", (st) => (st.screen === "game" && st.mode === "explore" && !st.line && !st.prompt) && st.day === 10 && st.chapterThree.water.pipes.length === 4);
  s = await state(page);
  expect(s.chapterThree.pipe).toBeNull();
  // The open end's panel: "add" lays on from it.
  await at(page, end);
  await page.keyboard.press("KeyE");
  await until(page, "the end's panel", (st) => st.chapterThree.pipe?.kind === "edit" && st.chapterThree.pipe.canAdd);
  await page.getByTestId("joint-add").click();
  await layPiece(page, 3, "long", 4);
  await layPiece(page, 3, "long", 3);
  await layPiece(page, 4, "short", 2);
  await until(page, "the line ends at the tank", (st) => st.mode !== "pipe" && st.chapterThree.water.pipes.length === 7);
  s = await state(page);
  expect(s.chapterThree.containers.find((c) => c.id === tank.id)!.problem).toBe("none");

  // The water runs down to the tank: the camera follows it, then "The water is flowing."
  await hook(page, "goto", tank.x + 2, tank.z + 2.5, tank.x, tank.z);
  await until(page, "the water arrives", (st) => st.line?.en === "Look! The water is coming!", undefined, 60_000);
  await page.keyboard.press("KeyE");
  await answer(page, "flowing");
  await until(page, "water at camp", (st) => (st.screen === "game" && st.mode === "explore" && !st.line && !st.prompt) && st.quest.done.includes("pipeCamp") && st.step === "fillTank");
  await hook(page, "setContainerWater", tank.id, 11.9);
  await until(page, "the tank is full", (st) => Boolean(st.prompt?.choices.includes("tankFull")));
  await answer(page, "tankFull");
  await line(page, "We did it! Water at our camp, every day!");
  await line(page, "Remember: boil it before you drink.");
  await until(page, "tank filled", (st) => (st.screen === "game" && st.mode === "explore" && !st.line && !st.prompt) && st.chapterThree.tankFilled && st.step === "boilTank");

  // Safe water: from the tank, then boiled at the fire.
  await at(page, tank.id);
  await page.keyboard.press("KeyE");
  await answer(page, "getWater");
  await until(page, "water from the tank", (st) => (st.bag.water ?? 0) >= 1 && (st.screen === "game" && st.mode === "explore" && !st.line && !st.prompt));
  await at(page, "bE2eFire");
  await page.keyboard.press("KeyE");
  await until(page, "boiled", (st) => st.step === "sleep" && (st.bag.boiledWater ?? 0) >= 1);
  // The evening: Kai looks back at the day.
  await line(page, "Water at our camp, every day! We did it!");
  await line(page, "It's getting dark. Let's sleep in the tent!");

  // Sleep: the Chapter 3 card.
  await hook(page, "setClock", 0.95);
  await until(page, "night", (st) => st.isNight && (st.screen === "game" && st.mode === "explore" && !st.line && !st.prompt));
  await at(page, "bE2eShelter");
  await page.keyboard.press("KeyE");
  await answer(page, "sleep");
  await until(page, "Chapter 3 card", (st) => st.screen === "dayEnd" && st.sleptDay === 10);
  await expect(page.getByRole("heading", { name: /Chapter 3 complete!/ })).toBeVisible();
  await expect(page.getByTestId("next-chapter")).toContainText("Keep playing");
  expect(errors).toEqual([]);
});

test("free play: a gap and a reconnection, turning the end, carrying the tank with Kai, and water every day", async ({ page }) => {
  const errors = await precondition("game boot", () => boot(page));
  await hook(page, "setMic", false);
  await fast(page, false);
  await hook(page, "startDay", 11);
  await line(page, "Good morning! Our tank has water. Boil it before you drink!");
  await until(page, "Day 11 free play", (s) => s.day === 11 && s.freePlay && (s.screen === "game" && s.mode === "explore" && !s.line && !s.prompt));
  let s = await state(page);
  const tank = tankOf(s)!;
  expect(tank.problem).toBe("none");
  const line5 = s.chapterThree.water.pipes.filter((p) => p.from === "i:lower" || s.chapterThree.water.pipes.some((q) => q.to === p.from));
  expect(line5.length).toBeGreaterThanOrEqual(4);

  // Take a middle piece off: the water pours out at the gap, and the rest of the line is dry.
  const lower = s.chapterThree.water.pipes.find((p) => p.from === "i:lower")!;
  const second = s.chapterThree.water.pipes.find((p) => p.from === lower.to)!;
  const poles = s.bag.pole ?? 0;
  await at(page, second.to);
  await page.keyboard.press("KeyE");
  await until(page, "post panel", (st) => st.chapterThree.pipe?.kind === "edit");
  await page.keyboard.press("Delete");
  await until(page, "piece off", (st, id) => !st.chapterThree.water.pipes.some((p) => p.id === id), second.id);
  expect((await state(page)).bag.pole).toBe(poles + 1);
  await page.keyboard.press("Escape");
  await hook(page, "settleWater");
  await until(page, "a gap", (st, id) => st.chapterThree.containers.find((c) => c.id === id)!.problem === "gap", tank.id);

  // Lay a piece from the end before the gap: it snaps onto the dry post ("Connect them." is known now).
  await at(page, lower.to);
  await page.keyboard.press("KeyE");
  await until(page, "end panel", (st) => st.chapterThree.pipe?.kind === "edit" && st.chapterThree.pipe.canAdd);
  await page.keyboard.press("KeyE");
  await layPiece(page, 3, "long", 2);
  await hook(page, "settleWater");
  await until(page, "connected again", (st, id) => st.chapterThree.containers.find((c) => c.id === id)!.problem === "none" && st.mode === "explore", tank.id);

  // Turn the last piece: "Turn it." — it misses the tank; turning back fixes it.
  s = await state(page);
  const last = s.chapterThree.water.pipes.find((p) => !s.chapterThree.water.pipes.some((q) => q.from === p.to) && p.from !== "i:upper" && s.chapterThree.water.joints.some((j) => j.id === p.to && Math.hypot(j.x - tank.x, j.z - tank.z) < 2))!;
  await at(page, last.to);
  await page.keyboard.press("KeyE");
  await until(page, "end panel to turn", (st) => st.chapterThree.pipe?.kind === "edit" && st.chapterThree.pipe.canTurn);
  await page.keyboard.press("KeyR");
  await answer(page, "turnIt");
  await hook(page, "settleWater");
  await until(page, "turned off the tank", (st, id) => st.chapterThree.containers.find((c) => c.id === id)!.problem !== "none", tank.id);
  await page.getByTestId("joint-turn-left").click();
  await page.getByTestId("joint-done").click();
  await hook(page, "settleWater");
  await until(page, "turned back over the tank", (st, id) => st.chapterThree.containers.find((c) => c.id === id)!.problem === "none", tank.id);

  // Carry the tank with Kai: "It's too heavy." then "Can you help me?".
  await hook(page, "finishKaiRoute");
  await at(page, tank.id);
  await page.keyboard.press("KeyE");
  await answer(page, "carryTank");
  await answer(page, "tooHeavy");
  await answer(page, "canHelp");
  await line(page, "Yes, I can! One, two, three!");
  await line(page, "Let's put it under the pipe!");
  await until(page, "carrying the tank", (st) => st.chapterTwo.carry === "tank" && (st.screen === "game" && st.mode === "explore" && !st.line && !st.prompt));
  expect(tankOf(await state(page))).toBeUndefined();
  // Walk a little way toward the sea with it, then put it down.
  await page.keyboard.down("KeyS");
  await page.waitForTimeout(1200); // timed-mechanic: walking while carrying
  await page.keyboard.up("KeyS");
  await page.keyboard.press("KeyE");
  await until(page, "the tank is down again", (st) => st.chapterTwo.carry === null && st.chapterThree.containers.some((c) => c.type === "tank") && (st.screen === "game" && st.mode === "explore" && !st.line && !st.prompt));

  // The network keeps working the next day.
  await hook(page, "setClock", 0.95);
  await until(page, "night", (st) => st.isNight && (st.screen === "game" && st.mode === "explore" && !st.line && !st.prompt));
  await at(page, "bE2eShelter");
  await page.keyboard.press("KeyE");
  await answer(page, "sleep");
  await until(page, "Day 12 morning", (st) => st.day === 12 && st.screen === "game" && (Boolean(st.line) || (st.screen === "game" && st.mode === "explore" && !st.line && !st.prompt)), undefined, 60_000);
  await skipLines(page);
  await until(page, "Day 12", (st) => st.day === 12 && (st.screen === "game" && st.mode === "explore" && !st.line && !st.prompt));
  s = await state(page);
  expect(s.chapterThree.water.pipes.length).toBe(5);
  expect(s.chapterThree.wet.length).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});
