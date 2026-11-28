// Chapter 3 visual check (the Upper Stream, the stairs, pipes, water, the tank) and its draw-call worst cases.
// Saves views to .tmp/shots/chapter3. Usage: node scripts/shots-ch3.mjs [baseUrl] [viewport WxH]
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const base = process.argv[2] ?? "http://127.0.0.1:5287/";
const [vw, vh] = (process.argv[3] ?? "1024x768").split("x").map(Number);
const outDir = path.join(root, ".tmp", "shots", "chapter3");
fs.mkdirSync(outDir, { recursive: true });
const only = process.env.ONLY ? new Set(process.env.ONLY.split(",")) : null;

const stubsSrc = fs.readFileSync(path.join(root, "tests", "e2e", "stubs.ts"), "utf8");
const stubs = stubsSrc.slice(stubsSrc.indexOf("`") + 1, stubsSrc.lastIndexOf("`"));
const swift = process.env.CB_SWIFTSHADER === "1";
const browser = await chromium.launch({
  channel: swift ? undefined : "chromium",
  args: [...(swift ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] : []), "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"]
});
const context = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: 1 });
const page = await context.newPage();
const logs = [];
page.on("console", (m) => {
  if (m.type() === "error" || m.type() === "warning") logs.push(`[${m.type()}] ${m.text()}`);
});
page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message}`));
await page.addInitScript(stubs);

const call = (name, ...args) => page.evaluate(([method, values]) => window.__si[method](...values), [name, args]);
const state = () => page.evaluate(() => window.__si.state());
const settle = async (seconds = 0.25) => {
  const until = (await state()).time + seconds;
  await page.waitForFunction((t) => window.__si.state().time >= t, until, { timeout: 20_000, polling: 30 });
};
let shotNumber = 0;
const shot = async (name) => {
  shotNumber++;
  if (only && !only.has(name)) return;
  const file = path.join(outDir, `${String(shotNumber).padStart(2, "0")}-${name}.png`);
  await page.screenshot({ path: file });
  console.log("saved", path.relative(root, file));
};
const perfAt = async (name) => {
  await settle(0.35);
  console.log(`perf (${name}):`, JSON.stringify(await call("perf")));
};
const frame = async (x, z, faceX, faceZ, pitch = 0.42, dist = 9.5) => {
  const p = await call("goto", x, z, faceX, faceZ);
  await call("setCameraFollow", Math.atan2(faceX - p.x, faceZ - p.z) + Math.PI, pitch, dist);
  await settle();
  return p;
};
const cam = async (pos, target, wait = 0.3) => {
  await call("setCameraShot", pos, target);
  await settle(wait);
};

await page.goto(`${base}?e2e=1&seed=3`);
await page.waitForFunction(() => Boolean(window.__si), null, { timeout: 20_000 });
const renderer = await page.evaluate(() => {
  const gl = document.createElement("canvas").getContext("webgl");
  const ext = gl && gl.getExtension("WEBGL_debug_renderer_info");
  return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : "unknown";
});
console.log(`[WebGL UNMASKED_RENDERER] ${renderer}`);
await call("showWorld");
await call("setClock", 0.12);
await call("setGates", { pathCleared: true, bridgeBuilt: true, cliffOpen: true, coveOpen: true, groveOpen: true });
await call("setInCave", false);
const world = await call("world");
const camp = [
  { id: "f1", type: "campfire", x: -6, z: 4.5, rot: 0, lit: true },
  { id: "t1", type: "shelter", x: -2.5, z: 7, rot: 0, built: true },
  { id: "s1", type: "storage", x: 0.5, z: 9.5, rot: 0.3 }
];
await call("setBuildings", camp);
await call("setWater", { joints: [], pipes: [], next: 1 });

// Landmark: the high waterfall from the beach's west end and from camp.
await frame(-30, 3, -50, -6, 0.32, 10);
await shot("beach-west-to-falls");
await perfAt("beach west end");
await frame(-6, 6.5, -40, -4, 0.3, 9);
await shot("camp-to-falls");

// The long way: the climbing path from the pond clearing.
await frame(world.climbPath[0].x + 3, world.climbPath[0].z - 2, world.climbPath[2].x, world.climbPath[2].z, 0.38, 10);
await shot("climb-path-from-pond");
// The shelf.
await frame(-44.5, -8.4, -54, -6.5, 0.5, 14);
await shot("shelf-overview");
await perfAt("shelf overview");
await frame(-52.6, -4.6, -57, -6.8, 0.22, 8);
await shot("upper-pool-high-falls");
await frame(-49, -9.4, -42, -6, 0.5, 9);
await shot("shelf-east-from-table-rock");
for (const i of world.intakes) {
  await cam({ x: i.x + 1.8, y: i.y + 1.6, z: i.z + 2.6 }, { x: i.x, y: i.y - 0.3, z: i.z });
  await shot(`intake-${i.name}`);
}
// The fallen bamboo on the stairs, then cut.
await frame(world.tangle.x - 2.2, world.tangle.z - 1.6, world.tangle.x + 1, world.tangle.z + 0.4, 0.4, 7);
await shot("tangle");
await call("setChapterThree", { stairsOpen: true });
await settle(1.2);
await shot("tangle-cut");
await frame(world.stairs[0].x + 1, world.stairs[0].z + 0.2, world.stairs[1].x, world.stairs[1].z, 0.45, 8);
await shot("stairs-from-top-lower-falls");
await frame(world.stairs[1].x + 2.5, world.stairs[1].z + 3, world.stairs[0].x, world.stairs[0].z, 0.3, 9);
await shot("stairs-from-beach");

// Day 9: the bucket on the table rock and a test pipe, too high then right.
const bucket = { id: "bk", type: "bucket", x: world.tableRock.x, z: world.tableRock.z, rot: 0, water: 0 };
await call("setBuildings", [...camp, bucket]);
const toward = 5;
await call("buildLine", "i:upper", [[toward, "long", 2]]);
await settle(2.5);
await cam({ x: world.tableRock.x - 1.5, y: 6.8, z: world.tableRock.z + 4.5 }, { x: world.tableRock.x - 2.2, y: 4.6, z: world.tableRock.z });
await shot("bucket-pipe-too-high");
console.log("too high:", JSON.stringify((await state()).chapterThree.overflows));
await call("setWater", { joints: [], pipes: [], next: 1 });
await call("buildLine", "i:upper", [[toward, "long", 1]]);
await settle(2.5);
await shot("bucket-pipe-flowing");
console.log("bucket:", JSON.stringify((await state()).chapterThree.containers));

// Day 10: the line from the lower intake down the stairs into the tank at camp.
const tank = { id: "tk", type: "tank", x: -30.4, z: 0, rot: 0, water: 6 };
await call("setBuildings", [...camp, { ...bucket, water: 3 }, tank]);
await call("buildLine", "i:lower", [[3, "short", 2], [3, "long", 2], [3, "long", 4], [4, "long", 3]]);
await settle(0.4);
await call("settleWater");
await settle(0.6);
await cam({ x: -27, y: 5, z: 6 }, { x: -36, y: 1.8, z: -2.2 });
await shot("pipe-down-stairs-to-tank");
await cam({ x: -28.2, y: 2.6, z: 2.6 }, { x: -30.6, y: 1.0, z: -0.2 });
await shot("tank-filling");
await cam({ x: -40, y: 8, z: 1 }, { x: -43.5, y: 4.2, z: -5 });
await shot("pipe-start-at-intake");
console.log("tank line:", JSON.stringify((await state()).chapterThree.containers));
// A line left at the middle notch, climbing onto the beach: the water spills at the foot of the stairs.
await call("setWater", { joints: [], pipes: [], next: 1 });
await call("setBuildings", [...camp, { ...bucket, water: 3 }, { ...tank, x: world.kaiTank.x, z: world.kaiTank.z, water: 0 }]);
await call("buildLine", "i:lower", [[3, "short", 2], [3, "long", 2], [3, "long", 2], [3, "long", 2], [3, "long", 2], [4, "short", 2]]);
await settle(0.4);
await call("settleWater");
await settle(0.6);
await cam({ x: -31, y: 3.2, z: 4.5 }, { x: -34, y: 1, z: -0.6 });
await shot("overflow-climbing-pipe");
console.log("overflow:", JSON.stringify((await state()).chapterThree.overflows));

// The laying preview, driven by the real keys.
await call("setWater", { joints: [], pipes: [], next: 1 });
await call("setBuildings", [...camp, { ...bucket, water: 0 }]);
await call("setChapterThree", { stairsOpen: true, pipePlan: true });
await call("goTo", "i:upper");
const pu = (await state()).player;
await call("setCameraFollow", Math.atan2(world.tableRock.x - pu.x, world.tableRock.z - pu.z) + Math.PI + 0.5, 0.5, 8);
await settle(0.4);
const f = (await state()).focus;
console.log("focus at upper intake:", JSON.stringify(f));
await page.evaluate(() => {
  const g = window.__si.state();
  return g;
});
await page.keyboard.press("KeyE");
await settle(0.4);
await call("setPipeDir", toward);
await settle(0.4);
await shot("laying-preview");
console.log("pipe ui:", JSON.stringify((await state()).chapterThree.pipe));
await page.keyboard.press("Escape");
await call("setPipeDir", null);

// Worst cases for the draw-call budget with a full Chapter 3 network.
await call("setWater", { joints: [], pipes: [], next: 1 });
await call("setBuildings", [...camp, { ...bucket, water: 3 }, tank]);
await call("buildLine", "i:upper", [[toward, "long", 1]]);
await call("buildLine", "i:lower", [[3, "short", 2], [3, "long", 2], [3, "long", 4], [4, "long", 3]]);
await call("settleWater");
await frame(world.stairs[1].x + 3, world.stairs[1].z + 2.5, -44, -6, 0.4, 11);
await shot("network-from-stairs-foot");
await perfAt("stairs foot, full network");
await frame(-50, -5, -36, -1, 0.5, 13);
await perfAt("shelf, full network");
await frame(26, -77, 0, -10, 0.44, 10);
await shot("clifftop-view");
await perfAt("clifftop");
await call("setClock", 0.97);
await frame(-2, 15, -3, 6, 0.42, 9.5);
await shot("camp-night");
await perfAt("camp at night");
await call("setClock", 0.12);
await frame(-12, 8, -36, -4, 0.38, 10);
await perfAt("camp looking west");

console.log(logs.length ? logs.join("\n") : "no console errors");
await browser.close();
