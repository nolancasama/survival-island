// Phase 2–3 world visual check. Saves deterministic views to .tmp/shots/world.
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
await call("setGates", { pathCleared: false, bridgeBuilt: false, cliffOpen: false });
await call("setInCave", false);
await call("setWorldFacts", { signalLit: false, rescued: false, kaiStage: "camp", caveBoxOpened: false });
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

// Phase 3 starts after the original fifteen views, with independent world facts.
await call("setGates", { pathCleared: true, bridgeBuilt: true, cliffOpen: false });
await requireState("Phase 3 island gates were not staged", (s) => s.pathCleared && s.bridgeBuilt && !s.cliffOpen && !s.inCave);
await frame(world.caveOutside.x, world.caveOutside.z + 1.3, world.caveMouth.x, world.caveMouth.z, 0.4, 8);
await shot("phase3-cave-mouth");

await call("setInCave", true);
await requireState("cave entry teleport did not complete", (s, p) => s.inCave && Math.hypot(s.player.x - p.x, s.player.z - p.z) < 0.5, world.caveEntry);
await frame(world.caveEntry.x, world.caveEntry.z, world.caveChamber.x, world.caveChamber.z, 0.38, 7);
await shot("cave-entry");
const metal = world.nodes.filter((n) => n.kind === "metal");
if (metal.length !== 3) throw new Error("HARNESS_PRECONDITION_FAILED: expected three cave metal nodes");
for (const node of metal) await call("setTaken", node.id, false);
await requireState("cave metal nodes were not restored", (s, ids) => ids.every((id) => !s.taken.includes(id)), metal.map((n) => n.id));
await frame(world.caveChamber.x, world.caveChamber.z + 4, world.caveBox.x, world.caveBox.z, 0.48, 9);
await shot("cave-chamber-metal-and-box");
await perfAt("cave chamber");
await call("goTo", world.caveBox.id);
const boxPlayer = (await state()).player;
await call("setCameraFollow", Math.atan2(world.caveBox.x - boxPlayer.x, world.caveBox.z - boxPlayer.z) + Math.PI + 0.6, 0.5, 6.2);
await call("setWorldFacts", { caveBoxOpened: true });
await requireState("old box did not finish opening", (s) => s.inCave && s.caveBoxOpened && s.time >= s.worldAnimation.caveBoxOpenT0 + 1.5);
await shot("cave-box-open");

await call("setInCave", false);
await requireState("cave exit teleport did not complete", (s, p) => !s.inCave && Math.hypot(s.player.x - p.x, s.player.z - p.z) < 0.5, world.caveOutside);
await frame(world.rockfall.x, world.rockfall.z + 3.5, world.rockfall.x, world.rockfall.z - 4, 0.42, 9.5);
await requireState("closed rockfall was not staged", (s) => !s.cliffOpen);
await shot("rockfall-closed");
await perfAt("rockfall closed");
await call("setGates", { cliffOpen: true });
await requireState("rockfall did not finish clearing", (s) => s.cliffOpen && s.time >= s.worldAnimation.cliffOpenT0 + 2);
await shot("rockfall-cleared");
await perfAt("rockfall cleared");

const halfway = world.cliffPath[Math.floor(world.cliffPath.length / 2)];
const uphill = world.cliffPath[Math.min(world.cliffPath.length - 1, Math.floor(world.cliffPath.length / 2) + 1)];
if (!halfway || !uphill) throw new Error("HARNESS_PRECONDITION_FAILED: no cliff path waypoints");
await frame(halfway.x, halfway.z, uphill.x, uphill.z, 0.44, 10);
await requireState("halfway cliff path was not reached", (s, p) => s.cliffOpen && Math.hypot(s.player.x - p.x, s.player.z - p.z) < 1, halfway);
await shot("halfway-up-cliff-path");
await perfAt("halfway up the path");

await frame(world.clifftop.x, world.clifftop.z + 1, 0, -10, 0.44, 10);
await requireState("clifftop camera subject was not reached", (s, p) => s.cliffOpen && Math.hypot(s.player.x - p.x, s.player.z - p.z) < p.r, world.clifftop);
await shot("clifftop-looking-over-island");
await perfAt("clifftop looking over the island");
await frame(world.signalPad.x, world.signalPad.z + 4, world.signalPad.x, world.signalPad.z, 0.4, 9.2);
await requireState("empty signal pad was not staged", (s) => !s.signalLit && !s.inCave && s.cliffOpen);
await shot("signal-pad-empty");
await call("setClock", 1);
await call("setWorldFacts", { signalLit: true });
await requireState("signal fire did not grow in at night", (s) => s.signalLit && s.isNight && s.time >= s.worldAnimation.signalLitT0 + 3);
await shot("signal-fire-burning-smoke");
await perfAt("lit signal fire");

await call("setClock", 0.05);
await call("setCameraShot", world.rescueShot.pos, world.rescueShot.target);
await call("startRescue");
await requireState("rescue helicopter did not reach mid-flight", (s) => s.rescue.phase === "flight" && s.rescue.elapsed >= 5 && s.rescue.elapsed < s.rescue.duration - 1);
await shot("rescue-helicopter-mid-flight");
await perfAt("helicopter landing approach");
await requireState("rescue helicopter did not land", (s) => s.rescue.phase === "landed");
await shot("rescue-helicopter-landed");
await perfAt("helicopter landed");

await call("setWorldFacts", { kaiStage: "camp" });
const kaiStart = (await state()).kaiAt;
await call("kaiRoute", "toRockfall");
await requireState("Kai route did not start", (s) => !s.kaiRouteEmpty);
await requireState("Kai did not walk partway to the rockfall", (s, p) => !s.kaiRouteEmpty && Math.hypot(s.kaiAt.x - p.x, s.kaiAt.z - p.z) >= 8, kaiStart);
const kai = (await state()).kaiAt;
await frame(kai.x + 2, kai.z + 4, kai.x, kai.z, 0.4, 8);
await requireState("Kai route ended before its partway view", (s) => !s.kaiRouteEmpty);
await shot("kai-walking-to-rockfall");

console.log(logs.length ? logs.join("\n") : "no console errors");
await browser.close();
