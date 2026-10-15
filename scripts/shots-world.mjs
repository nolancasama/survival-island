// Phase 2 world visual check. Saves deterministic views to .tmp/shots/world.
// Usage: node scripts/shots-world.mjs [baseUrl] [viewport WxH]
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const base = process.argv[2] ?? "http://127.0.0.1:5287/";
const [vw, vh] = (process.argv[3] ?? "1024x768").split("x").map(Number);
const outDir = path.join(root, ".tmp", "shots", "world");
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
await call("setClock", 0.05);
await call("setGates", { pathCleared: false, bridgeBuilt: false });
await call("setBuildings", []);
const world = await call("world");

// Required performance point: the original beach spawn.
await frame(world.spawn.x, world.spawn.z, world.spawn.x, world.spawn.z - 8);
await perfAt("beach spawn");

// Fallen palm gate, closed then open toward the forest.
await frame(world.fallenTree.x, world.fallenTree.z + 4.2, world.fallenTree.x, world.fallenTree.z - 3);
await shot("gap-closed");
const gapOpenedAt = (await state()).time;
await call("setGates", { pathCleared: true });
await requireState("forest gate did not open", (s, t) => s.pathCleared && s.time >= t + 1.3, gapOpenedAt);
await shot("gap-open-looking-forest");
await perfAt("forest gap");

// Forest centre and its distinct resource models.
await frame(0, -22, 0, -31, 0.46, 10.5);
await shot("forest-centre");
await perfAt("forest centre");

const tree = world.nodes.find((n) => n.kind === "tree");
if (!tree) throw new Error("HARNESS_PRECONDITION_FAILED: no choppable tree node");
await call("setTaken", tree.id, false);
await frameNode(tree);
await shot("choppable-tree");
await call("setTaken", tree.id, true);
await settle();
await requireState("tree did not become taken", (s, id) => s.taken.includes(id), tree.id);
await shot("choppable-tree-stump");

const leaves = world.nodes.find((n) => n.kind === "leaves");
if (!leaves) throw new Error("HARNESS_PRECONDITION_FAILED: no leaf bush node");
await frameNode(leaves);
await shot("leaf-bush");

// Stream crossing in both semantic states.
await call("setGates", { pathCleared: true, bridgeBuilt: false });
await frame(world.bridge.beachSide.x, world.bridge.beachSide.z, world.bridge.x, world.bridge.z, 0.38, 8.7);
await shot("bridge-broken");
const bridgeBuiltAt = (await state()).time;
await call("setGates", { bridgeBuilt: true });
await requireState("bridge did not finish building", (s, t) => s.bridgeBuilt && s.time >= t + 1.3, bridgeBuiltAt);
await shot("bridge-built");
await perfAt("bridge");

// Pond: use the authored casting yaw so the dock, rock and fish water read together.
const fish = world.fishSpots[1] ?? world.fishSpots[0];
if (!fish) throw new Error("HARNESS_PRECONDITION_FAILED: no fishing spot");
await frame(fish.x, fish.z, fish.x + Math.sin(fish.yaw) * 5, fish.z + Math.cos(fish.yaw) * 5, 0.52, 8.8);
await shot("pond-dock-and-fish-spots");
await perfAt("pond");

// Closed Phase 3 landmarks.
await frame(world.caveSign.x - 2.2, world.caveSign.z + 2.4, world.caveSign.x + 1, world.caveSign.z - 3.4, 0.42, 8.8);
await shot("cave-mouth");
await frame(world.cliffSign.x + 2.2, world.cliffSign.z + 2.4, world.cliffSign.x + 1.2, world.cliffSign.z - 2.2, 0.42, 8.8);
await shot("cliff-path-rockfall");

// Staged test buildings keep these model checks independent of story progression.
const shelter = { id: "shot-shelter", type: "shelter", x: -2, z: 6, rot: 0, built: false };
await call("setBuildings", [shelter]);
await frame(shelter.x, shelter.z + 5, shelter.x, shelter.z, 0.38, 8.5);
await shot("shelter-frame");
await call("setBuildings", [{ ...shelter, built: true }]);
await requireState("built shelter was not staged", (s, id) => s.buildings.some((b) => b.id === id && b.built), shelter.id);
await settle();
await shot("shelter-built");

const fire = { id: "shot-fire", type: "campfire", x: 2, z: 7, rot: 0, lit: true };
await call("setBuildings", [{ ...shelter, built: true }, fire]);
// Light follows the day clock, so stage night through the clock rather than setLight.
await call("setClock", 1);
await requireState("night lighting or lit fire was not staged", (s, id) => s.isNight && s.light <= 0.15 && s.buildings.some((b) => b.id === id && b.lit), fire.id);
await frame(0, 13, 0, 6, 0.34, 10.5);
await settle(0.5);
await shot("camp-at-night-lit-fire");
await perfAt("camp at night");

// High authored camera verifies the complete landform and its spatial relationships.
await call("setClock", 0.05);
await call("setCameraShot", { x: 8, y: 100, z: 58 }, { x: -7, y: 0, z: -22 });
await settle(0.35);
await shot("overview-high-above");

console.log(logs.length ? logs.join("\n") : "no console errors");
await browser.close();
