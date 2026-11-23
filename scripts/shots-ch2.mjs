// Chapter 2 visual check (cove, grove, structures, rain). Saves views to .tmp/shots/chapter2.
// Usage: node scripts/shots-world.mjs [baseUrl] [viewport WxH]
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const base = process.argv[2] ?? "http://127.0.0.1:5287/";
const [vw, vh] = (process.argv[3] ?? "1024x768").split("x").map(Number);
const outDir = path.join(root, ".tmp", "shots", "chapter2");
fs.mkdirSync(outDir, { recursive: true });

const stubsSrc = fs.readFileSync(path.join(root, "tests", "e2e", "stubs.ts"), "utf8");
const stubs = stubsSrc.slice(stubsSrc.indexOf("`") + 1, stubsSrc.lastIndexOf("`"));

const browser = await chromium.launch({
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"]
});
const context = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: 1 });
const page = await context.newPage();
const logs = [];
page.on("console", (m) => {
  if (m.type() === "error" || m.type() === "warning") logs.push(`[${m.type()}] ${m.text()}`);
});
page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message}`));
await page.addInitScript(stubs);

const call = (name, ...args) =>
  page.evaluate(
    ([method, values]) => window.__si[method](...values),
    [name, args]
  );
const state = () => page.evaluate(() => window.__si.state());
const requireState = async (label, predicate, arg = null, timeout = 20_000) => {
  try {
    await page.waitForFunction(
      ([source, value]) => {
        const s = window.__si.state();
        return new Function("s", "arg", `return (${source})(s, arg);`)(s, value);
      },
      [predicate.toString(), arg],
      { timeout, polling: 30 }
    );
  } catch (error) {
    throw new Error(`HARNESS_PRECONDITION_FAILED: ${label}`, { cause: error });
  }
};
const settle = async (seconds = 0.22) => {
  const until = (await state()).time + seconds;
  await requireState("render clock did not advance", (s, t) => s.time >= t, until);
};

let shotNumber = 0;
const shot = async (name) => {
  const file = path.join(outDir, `${String(++shotNumber).padStart(2, "0")}-${name}.png`);
  await page.screenshot({ path: file });
  console.log("saved", path.relative(root, file));
};
const perfAt = async (name) => {
  await settle(0.35);
  console.log(`perf (${name}):`, JSON.stringify(await call("perf")));
};
const frame = async (x, z, faceX, faceZ, pitch = 0.42, dist = 9.5) => {
  const p = await call("goto", x, z, faceX, faceZ);
  const faceYaw = Math.atan2(faceX - p.x, faceZ - p.z);
  await call("setCameraFollow", faceYaw + Math.PI, pitch, dist);
  await settle();
  return p;
};
const frameNode = async (node) => {
  await call("goTo", node.id);
  const p = (await state()).player;
  const faceYaw = Math.atan2(node.x - p.x, node.z - p.z);
  // Keep the player beside the resource instead of directly covering it.
  await call("setCameraFollow", faceYaw + Math.PI + 0.7, 0.43, 7.2);
  await settle();
};

await page.goto(`${base}?e2e=1&seed=3`);
await page.waitForFunction(() => Boolean(window.__si), null, { timeout: 20_000 });
await call("showWorld");
await requireState("world view did not open", (s) => s.screen === "game" && s.mode === "explore");
await call("setClock", 0.1);
await call("setGates", { pathCleared: true, bridgeBuilt: true, cliffOpen: false, coveOpen: false, groveOpen: false });
await call("setInCave", false);
await call("setBuildings", []);
const world = await call("world");
const pass = world.covePassage;

// The tidal passage: flooded, then low tide.
await frame(pass[0].x - 4, pass[0].z + 3, pass[2].x, pass[2].z, 0.42, 10);
await shot("passage-high-tide");
const tideAt = (await state()).time;
await call("setGates", { coveOpen: true });
await requireState("tide did not go out", (s, t) => s.time >= t + 3.2, tideAt);
await shot("passage-low-tide");
await perfAt("passage");

// The cove from the passage's end, and its props.
await frame(pass[3].x, pass[3].z, world.cove.x + 4, world.cove.z - 2, 0.38, 11);
await shot("cove-overview");
await perfAt("cove overview");
await frame(world.cove.x - 2, world.cove.z + 6, world.cove.x + 4, world.cove.z - 4, 0.5, 14);
await shot("cove-from-sea");
await perfAt("cove from sea");
await frame(world.coveCrate.x - 1.6, world.coveCrate.z + 1.6, world.coveCrate.x, world.coveCrate.z, 0.45, 6);
await shot("cove-crate");
await call("setChapterTwo", { coveBoxOpened: true });
await settle(0.9);
await shot("cove-crate-open");
await frame(world.seaChest.x - 1.5, world.seaChest.z + 1.8, world.seaChest.x, world.seaChest.z, 0.45, 6.5);
await shot("sea-chest");
await frame(world.coveBarrel.x - 1.5, world.coveBarrel.z + 1.8, world.coveBarrel.x, world.coveBarrel.z, 0.45, 6.5);
await shot("barrel");

// Carrying the chest with Kai.
await frame(world.seaChest.x - 1.2, world.seaChest.z + 0.4, world.seaChest.x - 6, world.seaChest.z, 0.45, 6.5);
await call("setChapterTwo", { carry: "chest", chestTaken: true });
await page.keyboard.down("KeyA");
await settle(1.6);
await page.keyboard.up("KeyA");
await settle(0.6);
await shot("carry-chest");
await call("setChapterTwo", { carry: null });

// The grove: thicket, cut, clearing.
await frame(world.groveGate.x - 6, world.groveGate.z + 2.5, world.groveGate.x, world.groveGate.z, 0.38, 9);
await shot("grove-thicket");
const cutAt = (await state()).time;
await call("setGates", { groveOpen: true });
await requireState("thicket did not fall", (s, t) => s.time >= t + 1.2, cutAt);
await shot("grove-thicket-cut");
await frame(world.grove.x - 4, world.grove.z + 3, world.grove.x + 3, world.grove.z - 3, 0.45, 11);
await shot("grove-clearing");
await perfAt("grove");

// Camp structures.
const cx = -2.5, cz = 9.5;
const rackParts = ["leg1", "leg2", "leg3", "leg4", "barN", "barS", "barW", "barE"];
await call("setBuildings", [
  { id: "f1", type: "campfire", x: 2, z: 5, rot: 0, lit: true },
  { id: "t1", type: "shelter", x: -3, z: 5, rot: 0, built: true },
  { id: "s1", type: "storage", x: 3.2, z: 2.6, rot: 0.3 },
  { id: "r1", type: "rack", x: cx, z: cz, rot: 0.2, parts: rackParts, fish: [] },
  { id: "c1", type: "catcher", x: cx + 5.5, z: cz - 1, rot: 0, parts: ["post1", "post2", "post3", "post4", "canvas"], heights: [1, 1, 0, 1] },
  { id: "w1", type: "barrel", x: cx + 5.5 + 1.32, z: cz - 1 + 1.32, rot: 0, water: 5 }
]);
await frame(cx - 1, cz + 5, cx + 2, cz - 1, 0.4, 9);
await shot("camp-rack-unbraced");
await call("setBuildings", [
  { id: "f1", type: "campfire", x: 2, z: 5, rot: 0, lit: true },
  { id: "t1", type: "shelter", x: -3, z: 5, rot: 0, built: true },
  { id: "s1", type: "storage", x: 3.2, z: 2.6, rot: 0.3 },
  { id: "r1", type: "rack", x: cx, z: cz, rot: 0.2, parts: [...rackParts, "braceN", "braceW", "shelfN", "shelfS"], fish: [30, 0, 0, 12] },
  { id: "c1", type: "catcher", x: cx + 5.5, z: cz - 1, rot: 0, parts: ["post1", "post2", "post3", "post4", "canvas"], heights: [1, 1, 3, 1] },
  { id: "w1", type: "barrel", x: cx + 5.5 + 1.32, z: cz - 1 + 1.32, rot: 0, water: 5 }
]);
await frame(cx - 0.5, cz + 3.2, cx, cz, 0.35, 5.5);
await shot("rack-braced-fish");
await frame(cx + 3, cz + 4.5, cx + 5.5, cz - 1, 0.35, 7);
await shot("catcher-dry");
await call("setRain", 1);
await settle(0.5);
await shot("catcher-rain-missed");
await perfAt("camp rain");
await call("setBuildings", [
  { id: "f1", type: "campfire", x: 2, z: 5, rot: 0, lit: false },
  { id: "t1", type: "shelter", x: -3, z: 5, rot: 0, built: true },
  { id: "s1", type: "storage", x: 3.2, z: 2.6, rot: 0.3 },
  { id: "r1", type: "rack", x: cx, z: cz, rot: 0.2, parts: [...rackParts, "braceN", "braceW"], fish: [] },
  { id: "c1", type: "catcher", x: cx + 5.5, z: cz - 1, rot: 0, parts: ["post1", "post2", "post3", "post4", "canvas"], heights: [2, 2, 1, 2] },
  { id: "w1", type: "barrel", x: cx + 5.5 + 1.32, z: cz - 1 + 1.32, rot: 0, water: 8 }
]);
await call("setRain", 1);
await settle(0.5);
await shot("catcher-rain-caught");
console.log("flows:", JSON.stringify((await state()).chapterTwo.flows));
await frame(cx - 4, cz + 8, cx + 3, cz - 2, 0.42, 12);
await call("setRain", 1);
await settle(0.4);
await shot("camp-rain-wide");
await perfAt("camp rain wide");

// Worst cases for the draw-call budget: a full Chapter 2 camp seen from the clifftop, and at night.
const fullCamp = [
  { id: "f1", type: "campfire", x: -6, z: 4.5, rot: 0, lit: true },
  { id: "t1", type: "shelter", x: -2.5, z: 7, rot: 0, built: true },
  { id: "s1", type: "storage", x: 0.5, z: 9.5, rot: 0.3 },
  { id: "r1", type: "rack", x: -8, z: 9, rot: 0.2, parts: [...rackParts, "braceN", "braceW", "shelfN", "shelfS"], fish: [30, 0, 0, 12, 5, 0] },
  { id: "c1", type: "catcher", x: 3.5, z: 11, rot: 0, parts: ["post1", "post2", "post3", "post4", "canvas"], heights: [2, 2, 1, 2] },
  { id: "w1", type: "barrel", x: 3.5 + 1.32, z: 11 + 1.32, rot: 0, water: 8 }
];
await call("setBuildings", fullCamp);
await call("setGates", { cliffOpen: true });
await call("setRain", 0);
await call("setClock", 0.1);
await frame(world.clifftop?.x ?? 26, (world.clifftop?.z ?? -78) + 1, 0, -10, 0.44, 10);
await shot("clifftop-full-camp");
await perfAt("clifftop with the full Chapter 2 camp");
await call("setClock", 0.97);
await frame(-2, 15, -3, 6, 0.42, 9.5);
await shot("full-camp-night");
await perfAt("full Chapter 2 camp at night");

console.log(logs.length ? logs.join("\n") : "no console errors");
await browser.close();
