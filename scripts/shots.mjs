// Visual check: plays Day 1 in Chromium with speech stubs and saves screenshots to .tmp/shots.
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
await next();
await waitFor(() => window.__si.state().screen === "dayEnd", null, 30000);
await page.waitForTimeout(1500);
await shot("day-end");
await page.getByTestId("keep-playing").click();
await page.waitForTimeout(1500);
await shot("night-free-play");
console.log("perf (night, fire):", JSON.stringify(await page.evaluate(() => window.__si.perf())));

const s = await st();
console.log("final:", JSON.stringify({ quest: s.quest, said: s.said, bag: s.bag, stats: s.stats, kai: s.kai }));
console.log(logs.length ? logs.join("\n") : "no console errors");
await browser.close();
