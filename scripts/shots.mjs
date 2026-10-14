// Visual check: plays Days 1–3 and free play in Chromium with speech stubs and saves screenshots to .tmp/shots.
// Usage: node scripts/shots.mjs [baseUrl] [viewport WxH] [--touch] [--tap]
//   --tap: play in mic-free mode (tap the sentences)
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const base = process.argv[2] ?? "http://127.0.0.1:5287/";
const [vw, vh] = (process.argv[3] ?? "1366x768").split("x").map(Number);
const touch = process.argv.includes("--touch");
const tap = process.argv.includes("--tap");
const outDir = path.join(root, ".tmp", "shots");
fs.mkdirSync(outDir, { recursive: true });

const stubsSrc = fs.readFileSync(path.join(root, "tests", "e2e", "stubs.ts"), "utf8");
const stubs = stubsSrc.slice(stubsSrc.indexOf("`") + 1, stubsSrc.lastIndexOf("`"));

const browser = await chromium.launch({
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"]
});
const context = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: 1, hasTouch: touch, isMobile: false });
const page = await context.newPage();
const logs = [];
page.on("console", (m) => {
  if (m.type() === "error" || m.type() === "warning") logs.push(`[${m.type()}] ${m.text()}`);
});
page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message}`));
await page.addInitScript(stubs);

const tag = `${vw}x${vh}${touch ? "-touch" : ""}${tap ? "-tap" : ""}`;
let n = 0;
const shot = async (name) => {
  const file = path.join(outDir, `${tag}-${String(++n).padStart(2, "0")}-${name}.png`);
  await page.screenshot({ path: file });
  console.log("saved", path.relative(root, file));
};
const st = () => page.evaluate(() => window.__si.state());
const waitFor = (fn, arg, timeout = 20000) => page.waitForFunction(fn, arg, { timeout });
const waitMode = (mode) => waitFor((m) => window.__si.state().mode === m, mode);
const waitLine = () => waitFor(() => window.__si.state().line !== null, null);
const waitPrompt = () => waitFor(() => { const p = window.__si.state().prompt; return p !== null && p.status !== "correct"; }, null);
const next = async () => {
  await waitLine();
  await page.keyboard.press("KeyE");
  await page.waitForTimeout(150);
};
/** Answer the open prompt: speak (stubbed) or tap the right choice. */
const answer = async (sayText, choiceId) => {
  await waitPrompt();
  if (tap) {
    await page.locator(`[data-testid=choice][data-id=${choiceId}]`).click();
  } else {
    await page.evaluate((s) => (window.__speech.say = s), sayText);
    await page.keyboard.press("Space");
  }
  await waitFor(() => { const p = window.__si.state().prompt; return p === null || p.status === "correct"; }, null);
  await page.waitForTimeout(800);
};
const goTo = async (id) => {
  await page.evaluate((x) => window.__si.goTo(x), id);
  await page.waitForTimeout(400);
};

await page.goto(`${base}?e2e=1&seed=3`);
await page.waitForTimeout(3000);
if (tap) await page.getByTestId("mode-tap").click();
await shot("title");

await page.getByTestId("start").click();
await waitLine();
await page.waitForTimeout(900);
await shot("intro-where-am-i");
await next();
await next();
await waitPrompt();
await page.waitForTimeout(500);
await shot("hungry-prompt");
await answer("I'm hungry", "hungry");
await waitMode("explore");
await page.waitForTimeout(700);
await shot("beacons");

// Walk a little.
await page.keyboard.down("KeyW");
await page.waitForTimeout(800);
await page.keyboard.up("KeyW");
await page.waitForTimeout(400);
await shot("walked");
console.log("perf (beach view):", JSON.stringify(await page.evaluate(() => window.__si.perf())));

// Coconut.
await goTo("coconut-1");
await shot("near-coconut");
await page.keyboard.press("KeyE");
await waitPrompt();
await page.waitForTimeout(500);
await shot("get-coconut-prompt");
await answer("get the coconut", "getCoconut");
await shot("got-coconut");
await page.keyboard.press("KeyF");
await waitPrompt();
await answer("eat the coconut", "eatCoconut");
await shot("ate");

// Kai.
await goTo("kai");
await shot("near-kai");
await page.keyboard.press("KeyE");
await waitLine();
await page.waitForTimeout(1500);
await shot("kai-hi");
await next();
await next();
await waitPrompt();
await page.waitForTimeout(500);
await shot("kai-what-do-you-need");
await answer("I need food", "needFood");
await next();
await next();
await next(); // It's getting dark.
await waitPrompt();
await shot("kai-can-you");
await answer("no I can't", "noICant");
await next();
await next();
await waitLine();
await shot("kai-recipe");
await next();
await waitMode("explore");
await page.waitForTimeout(600);
await shot("after-kai");

// Gather wood and stones (first one spoken, the rest quick).
const gather = async (kind, need, sayText, phrase) => {
  for (let i = 0; i < 6; i++) {
    const s = await st();
    if ((s.bag[kind] ?? 0) >= need) return;
    const id = (await page.evaluate((k) => window.__si.nodes(k), kind))[0];
    await goTo(id);
    await page.keyboard.press("KeyE");
    await page.waitForTimeout(300);
    if ((await st()).prompt) await answer(sayText, phrase);
    await page.waitForTimeout(600);
  }
};
await gather("wood", 3, "get the wood", "getWood");
await shot("wood");
await gather("stone", 2, "get the stone", "getStone");
await shot("stones");

// Crate.
await goTo("crate");
await page.keyboard.press("KeyE");
await answer("open the box", "openBox");
await page.waitForTimeout(500);
await shot("crate");

// Craft.
await page.evaluate(() => window.__si.teleport(1, 6, 0));
await page.waitForTimeout(500);
await page.keyboard.press("KeyC");
await page.waitForTimeout(500);
await shot("craft-menu");
await page.getByTestId("make-campfire").click();
await waitPrompt();
await page.waitForTimeout(400);
await shot("craft-prompt");
await answer("I want to make a campfire", "craftCampfire");
await waitMode("place");
await page.waitForTimeout(600);
await shot("placing");
await page.keyboard.press("KeyE");
await waitMode("explore");
await page.waitForTimeout(600);
await shot("placed");

// Light it.
const b = (await st()).buildings[0];
await goTo(b.id);
await page.keyboard.press("KeyE");
await answer("make a fire", "makeFire");
await page.waitForTimeout(1500);
await shot("fire-lit");
await waitLine();
await page.waitForTimeout(1200);
await shot("celebrate-kai");
await next();
await waitLine();
await page.waitForTimeout(600);
await shot("its-late");
await next();

// Day 1 ends with "I want to sleep." by the fire.
await waitPrompt();
await page.waitForTimeout(500);
await shot("sleep-prompt");
console.log("perf (night, fire):", JSON.stringify(await page.evaluate(() => window.__si.perf())));
await answer("I want to sleep", "sleep");
await waitFor(() => window.__si.state().sleeping, null, 10000);
await page.waitForTimeout(900);
await shot("sleeping");
await waitFor(() => window.__si.state().screen === "dayEnd", null, 30000);
await page.waitForTimeout(1500);
await shot("day1-end");

// Day 2 morning: the day title, then Kai's talk.
await page.getByTestId("next-day").click();
await waitFor(() => window.__si.state().dayTitle === 2, null, 10000);
await page.waitForTimeout(1100);
await shot("day2-title");
await waitLine();
await page.waitForTimeout(900);
await shot("day2-good-morning");
await next();
await next();
await next();
await waitLine();
await page.waitForTimeout(600);
await shot("day2-tree-in-the-way");
await next();
await waitPrompt();
await page.waitForTimeout(500);
await shot("day2-can-you-axe");
await answer("yes I can", "yesICan");
await next(); // Great! Show me!
await waitLine();
await shot("day2-axe-recipe");
await next();
await waitMode("explore");
await page.waitForTimeout(600);
await shot("day2-explore");

/** Click through any scripted lines until play resumes (a line can follow an action after a pause). */
const settle = async () => {
  for (let i = 0; i < 60; i++) {
    const s = await st();
    if (s.line) {
      if (s.line.en.startsWith("Leaves!")) await shot("day2-leaves-discovery");
      await next();
      continue;
    }
    if (s.mode === "explore" && !s.prompt && i > 3) return;
    await page.waitForTimeout(200);
  }
  throw new Error("play did not resume");
};

/** Collect `item` from nodes of `kind` until the bag holds `need` (the first one may be spoken). */
const gatherItem = async (kind, item, need, sayText, phrase) => {
  for (let i = 0; i < 6; i++) {
    const s = await st();
    if ((s.bag[item] ?? 0) >= need) return;
    const id = (await page.evaluate((k) => window.__si.nodes(k), kind))[0];
    await goTo(id);
    await page.keyboard.press("KeyE");
    await page.waitForTimeout(300);
    if ((await st()).prompt) await answer(sayText, phrase);
    await settle();
  }
};

// The stone axe.
await gatherItem("wood", "wood", 2, "get the wood", "getWood");
await gatherItem("stone", "stone", 1, "get the stone", "getStone");
await page.keyboard.press("KeyC");
await page.waitForTimeout(500);
await shot("day2-craft-axe");
await page.getByTestId("make-axe").click();
await answer("I want to make a stone axe", "craftAxe");
await waitMode("explore");

// The fallen palm.
await goTo("fallenTree");
await page.waitForTimeout(300);
await shot("day2-fallen-palm");
await page.keyboard.press("KeyE");
await waitPrompt();
await page.waitForTimeout(400);
await shot("day2-cut-prompt");
await answer("cut the tree", "cutTree");
await page.waitForTimeout(1400);
await shot("day2-forest-opens");
await next(); // Wow! The forest!
await waitMode("explore");

// "I need leaves." with the camera turned to the sea: arrows at the edge point to the forest.
await page.evaluate(() => window.__si.teleport(14, 9, 0));
await page.evaluate(() => window.__si.setCameraYaw(Math.PI));
await page.waitForTimeout(500);
await page.keyboard.press("KeyQ");
await waitPrompt();
await page.waitForTimeout(400);
await shot("day2-needs-menu");
await answer("I need leaves", "needLeaves");
await page.waitForTimeout(800);
await shot("day2-edge-arrows");
await page.evaluate(() => window.__si.setCameraYaw(0.35));

// Leaves: the first discovers the shelter.
await gatherItem("leaves", "leaves", 2, "get the leaves", "getLeaves");
await shot("day2-leaves");
await gatherItem("leaves", "leaves", 4, "get the leaves", "getLeaves");
await shot("day2-forest");
console.log("perf (forest):", JSON.stringify(await page.evaluate(() => window.__si.perf())));

// Trees need the axe (+2 wood).
const tree = (await page.evaluate(() => window.__si.nodes("tree")))[0];
await goTo(tree);
await page.waitForTimeout(300);
await shot("day2-tree-label");
await page.keyboard.press("KeyE");
await page.waitForTimeout(260);
await shot("day2-chop");
await waitMode("explore");
await gatherItem("tree", "wood", 4, "cut the tree", "cutTree");

// The shelter: make, place, build.
await page.evaluate(() => window.__si.teleport(9, 9.5, Math.PI));
await page.evaluate(() => window.__si.setCameraYaw(0));
await page.waitForTimeout(500);
await page.keyboard.press("KeyC");
await page.waitForTimeout(500);
await shot("day2-craft-shelter");
await page.getByTestId("make-shelter").click();
await answer("I want to make a shelter", "craftShelter");
await waitMode("place");
await waitFor(() => window.__si.state().placeOk, null);
await page.waitForTimeout(400);
await shot("day2-placing-shelter");
await page.keyboard.press("KeyE");
await waitMode("explore");
const frame = (await st()).buildings.find((x) => x.type === "shelter");
await goTo(frame.id);
await page.waitForTimeout(400);
await shot("day2-shelter-frame");
await page.keyboard.press("KeyE");
await answer("build a shelter", "buildShelter");
await page.waitForTimeout(1300);
await shot("day2-shelter-built");

// Evening: Kai's line, then night by the clock.
await waitLine();
await page.waitForTimeout(600);
await shot("day2-evening-kai");
await next();
await waitMode("explore");
await page.waitForTimeout(4000);
await shot("day2-evening");
await page.evaluate(() => window.__si.setClock(0.95));
await page.waitForTimeout(800);
await shot("day2-night");
console.log("perf (night, shelter):", JSON.stringify(await page.evaluate(() => window.__si.perf())));
await goTo(frame.id);
await page.waitForTimeout(300);
await shot("day2-sleep-label");
await page.keyboard.press("KeyE");
await answer("I want to sleep", "sleep");
await waitFor(() => window.__si.state().screen === "dayEnd", null, 30000);
await page.waitForTimeout(1500);
await shot("day2-end");

/** New captures require the live semantic state; a missing setup is a harness error. */
const stage = async (name, predicate, arg = null, timeout = 20000) => {
  try {
    await waitFor(predicate, arg, timeout);
  } catch (error) {
    throw new Error(`HARNESS_PRECONDITION_FAILED: ${name}`, { cause: error });
  }
};
const day3Target = async (id) => {
  await stage(`exploring before approaching ${id}`, () => window.__si.state().mode === "explore");
  await page.evaluate((target) => window.__si.goTo(target), id);
  await stage(`focus on ${id}`, (target) => window.__si.state().focus?.id === target, id);
};
/** Submit without the usual settling delay so the brief action animation can be captured. */
const answerForAnimation = async (sayText, choiceId) => {
  await stage(`prompt offers ${choiceId}`, (id) => {
    const prompt = window.__si.state().prompt;
    return prompt !== null && prompt.status !== "correct" && prompt.choices.includes(id);
  }, choiceId);
  if (tap) {
    await page.locator(`[data-testid=choice][data-id=${choiceId}]`).click();
  } else {
    await page.evaluate((text) => (window.__speech.say = text), sayText);
    await page.keyboard.press("Space");
  }
};
const day3Gather = async (kind, item, need, sentence, phrase) => {
  await stage(`${kind} has enough reachable sources`, ([source, target, required]) => {
    return (window.__si.state().bag[target] ?? 0) >= required || window.__si.nodes(source).length > 0;
  }, [kind, item, need]);
  await gatherItem(kind, item, need, sentence, phrase);
  await stage(`${need} ${item} gathered`, ([target, required]) => (window.__si.state().bag[target] ?? 0) >= required, [item, need]);
};

// Day 3: choose water, then teach both recipes and the bridge.
await page.getByTestId("next-day").click();
await stage("Day 3 title", () => window.__si.state().dayTitle === 3);
await shot("day3-title");
await stage("Day 3 good morning", () => window.__si.state().line?.en === "Good morning!");
await next();
await stage("Kai is thirsty", () => window.__si.state().line?.en === "I'm thirsty.");
await shot("day3-thirsty");
await next();
await stage("Kai explains the broken bridge", () => window.__si.state().line?.en.startsWith("The pond has water and fish."));
await next();
await stage("Day 3 water/fish choice", () => window.__si.state().prompt?.question === "What do you want to do?");
await shot("day3-morning-choice");
await answer("I want to get water", "wantWater");
await stage("coconut carries water", () => window.__si.state().line?.en === "A coconut can carry water!");
await shot("day3-coconut-container");
await next();
await stage("container recipe lesson", () => window.__si.state().line?.en.startsWith("Make a water container"));
await shot("day3-container-recipe");
await next();
await stage("rod recipe lesson", () => window.__si.state().line?.en.startsWith("Make a fishing rod"));
await next();
await stage("bridge lesson", () => window.__si.state().line?.en === "You need four wood for the bridge.");
await shot("day3-bridge-lesson");
await next();
await stage("Day 3 recipes unlocked", () => {
  const s = window.__si.state();
  return s.mode === "explore" && s.unlocked.includes("container") && s.unlocked.includes("rod");
});
const world = await page.evaluate(() => window.__si.world());

// Build the bridge, using the existing real collection and command flows.
await day3Gather("tree", "wood", 4, "cut the tree", "cutTree");
await day3Target(world.bridge.id);
await page.evaluate(() => window.__si.setCameraFollow(Math.PI / 2, 0.48, 8));
await shot("day3-broken-bridge");
await page.keyboard.press("KeyE");
await stage("bridge command", () => window.__si.state().prompt?.choices.includes("buildBridge"));
await shot("day3-bridge-prompt");
await answerForAnimation("build a bridge", "buildBridge");
await stage("bridge building animation", () => {
  const s = window.__si.state();
  return s.bridgeBuilt && s.action?.kind === "build";
});
await shot("day3-bridge-build");
await stage("bridge complete", () => window.__si.state().mode === "explore" && window.__si.state().quest.done.includes("bridge"));
await shot("day3-built-bridge");

// Make a container, fill it at the shore, and drink from the bag.
await day3Gather("coconut", "coconut", 1, "get the coconut", "getCoconut");
await day3Gather("leaves", "leaves", 2, "get the leaves", "getLeaves");
await page.keyboard.press("KeyC");
await shot("day3-craft-menu");
await page.getByTestId("make-container").click();
await answer("I want to make a water container", "craftContainer");
await stage("water container crafted", () => window.__si.state().bag.container === 1 && window.__si.state().mode === "explore");
const waterSpot = world.waterSpots[1];
await stage("water shore reachable across bridge", (id) => window.__si.reachable(id), waterSpot.id);
await day3Target(waterSpot.id);
await page.evaluate(() => window.__si.setCameraFollow(0.25, 0.5, 8));
await shot("day3-water-shore");
await page.keyboard.press("KeyE");
await answer("get some water", "getWater");
await stage("water collected", () => window.__si.state().counters.gotWater >= 1 && window.__si.state().bag.water >= 1);
await shot("day3-got-water");
await page.getByTestId("slot-water").click();
await answerForAnimation("drink the water", "drinkWater");
await stage("drinking animation", () => window.__si.state().counters.drank >= 1 && window.__si.state().action?.kind === "drink");
await shot("day3-drinking");
await stage("drinking complete", () => window.__si.state().mode === "explore" && window.__si.state().action === null);

// Make the rod and wait automatically for the fish to bite.
await day3Gather("tree", "wood", 2, "cut the tree", "cutTree");
if (!(await st()).crateOpened) {
  await day3Target("crate");
  await page.keyboard.press("KeyE");
  await answer("open the box", "openBox");
}
await stage("rope available for rod", () => (window.__si.state().bag.rope ?? 0) >= 1);
await page.keyboard.press("KeyC");
await page.getByTestId("make-rod").click();
await answer("I want to make a fishing rod", "craftRod");
await stage("rod crafted", () => window.__si.state().bag.rod === 1 && window.__si.state().mode === "explore");
// The dock is separated from the water targets, so its focus is unambiguous.
const fishSpot = world.fishSpots[1];
await day3Target(fishSpot.id);
await page.evaluate(() => window.__si.setCameraFollow(Math.PI / 2, 0.45, 7));
await shot("day3-fishing-spot");
await page.keyboard.press("KeyE");
await stage("catch fish prompt", () => window.__si.state().prompt?.choices.includes("catchFish"));
await shot("day3-fishing-prompt");
await answerForAnimation("catch a fish", "catchFish");
await stage("fishing wait with bobber", () => window.__si.state().fishing?.phase === "wait");
await shot("day3-fishing-bobber");
await stage("raw fish caught and spot resting", (id) => {
  const s = window.__si.state();
  return s.mode === "explore" && s.counters.caught >= 1 && s.bag.fish >= 1 && s.fishRests[id] > 0;
}, fishSpot.id);
await shot("day3-caught-fish");

// Raw fish asks to be cooked; the lit campfire transforms it.
await page.getByTestId("slot-fish").click();
await stage("raw fish cooking reminder", () => window.__si.state().toasts.includes("Cook it first!"));
await shot("day3-cook-it-first");
const cookingFire = (await st()).buildings.find((building) => building.type === "campfire" && building.lit);
if (!cookingFire) throw new Error("HARNESS_PRECONDITION_FAILED: lit cooking campfire exists");
await day3Target(cookingFire.id);
await page.evaluate(() => window.__si.setCameraFollow(0.4, 0.42, 7));
await page.keyboard.press("KeyE");
await stage("cook fish prompt", () => window.__si.state().prompt?.choices.includes("cookFish"));
await shot("day3-cooking-prompt");
// Arm the action observer before answering so capture starts on the first cooking frame.
await Promise.all([
  stage("cooking animation", () => window.__si.state().counters.cooked >= 1 && window.__si.state().action?.kind === "craft")
    .then(() => shot("day3-cooking")),
  answerForAnimation("cook the fish", "cookFish")
]);
await stage("Kai thanks the water choice", () => window.__si.state().line?.en === "Fresh water! Thank you!");
await shot("day3-evening-thanks");
await next();
await stage("Kai says sleep in shelter", () => window.__si.state().line?.en.startsWith("It's getting dark. Let's sleep"));
await next();
await stage("evening conversation finished", () => window.__si.state().mode === "explore");
await page.getByTestId("slot-grilledFish").click();
await stage("eat grilled fish prompt", () => window.__si.state().prompt?.choices.includes("eatFish"));
await shot("day3-eat-fish-prompt");
await answer("eat the fish", "eatFish");
await stage("grilled fish eaten", () => window.__si.state().known.includes("eatFish") && !window.__si.state().bag.grilledFish);
await page.evaluate(() => window.__si.setClock(0.95));
await stage("Day 3 night", () => window.__si.state().day === 3 && window.__si.state().isNight);
await day3Target(frame.id);
await shot("day3-night");
await page.keyboard.press("KeyE");
await answer("I want to sleep", "sleep");
await stage("Day 3 complete card", () => window.__si.state().day === 3 && window.__si.state().screen === "dayEnd", null, 30000);
await page.waitForTimeout(1500);
await shot("day3-end");

// Keep playing opens Day 4 with the free-time objective and no story checklist.
await page.getByTestId("next-day").click();
await stage("Day 4 free-time title", () => window.__si.state().dayTitle === 4 && window.__si.state().freePlay);
await shot("day4-title");
await stage("free-play morning talk", () => window.__si.state().line?.en === "Good morning! Let's explore the island!");
await next();
await stage("free play without a checklist", () => {
  const s = window.__si.state();
  return s.day === 4 && s.freePlay && s.mode === "explore" && s.step === null;
});
await page.evaluate(() => window.__si.setCameraFollow(0.35, 0.42, 9.5));
await shot("day4-free-play");

const s = await st();
console.log("final:", JSON.stringify({ quest: s.quest, daySaid: s.daySaid, dayNew: s.dayNew, bag: s.bag, stats: s.stats, kai: s.kai }));
console.log(logs.length ? logs.join("\n") : "no console errors");
await browser.close();
