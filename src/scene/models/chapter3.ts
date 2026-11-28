import * as THREE from "three";
import { PartBuilder } from "../partBuilder";
import { rockGeometry } from "./nature";
import { bambooPole, cylinderBetween, leafSpray } from "./chapter2";
import { groundY } from "../../game/world/island";
import {
  BROOK, CLIMB_PATH, CONTAINER_SPECS, FORD, HIGH_FALLS, INTAKE_SOURCES, INTAKE_SPOTS, LOWER_FALLS, PLUNGE_POOL, SHELF, SHELF_BAMBOO, SHELF_ROCKS,
  SHELF_STREAM, SHELF_STREAM_HALF, STAIRS, STAIRS_R, TABLE_ROCK, TANGLE, UPPER_POOL, shelfWaterY
} from "../../game/world/chapter3";
import { INTAKES } from "../../game/world/pipeWorld";
import { makeRng } from "../../game/logic/rng";
import { POUR_REACH, nodeOf, outgoing, type Env, type Network } from "../../game/logic/waterworks";

/**
 * Chapter 3 models (EXPANSION_PLAN.md Milestone 4): the Upper Stream's rocks,
 * cliffs, stairs and plants, its water and falls, the fallen bamboo on the
 * stairs, the bucket and the tank, and the player's bamboo pipes. Procedural,
 * merged per model, in the island's low-poly palette.
 */

const ROCK = "#8b9096";
const ROCK_DARK = "#6f757c";
const ROCK_WARM = "#9a9286";
const MOSS = "#6f9a45";
const FERN = "#4f8f45";
const FERN_LIGHT = "#79ad45";
const BAMBOO = "#a9bf52";
const BAMBOO_DARK = "#7e9437";
const BAMBOO_INSIDE = "#c4c46c";
const ROPE = "#7a5a34";
const STEP = "#a39a8a";

type V3 = [number, number, number];

function rock(b: PartBuilder, x: number, z: number, r: number, h: number, seed: number, color: THREE.ColorRepresentation = ROCK, sink = 0.25) {
  b.add(rockGeometry(r, h, seed, 1), color, [x, groundY(x, z) - sink, z], [0, seed * 1.7, 0]);
}

// ------------------------------------------------------------- the shelf

/** Everything on and around the shelf that never moves, in one mesh. */
export function upperSceneryGeometry(): THREE.BufferGeometry {
  const b = new PartBuilder(0.9);
  const rand = makeRng(91);
  // The standing rocks; the split boulder is two halves with a gap.
  SHELF_ROCKS.forEach((r, i) => {
    if (i === 0) {
      rock(b, r.x - 0.45, r.z - 0.1, r.r * 0.75, r.h, 11, ROCK_WARM);
      rock(b, r.x + 0.55, r.z + 0.15, r.r * 0.7, r.h * 0.92, 12, ROCK_WARM);
      return;
    }
    rock(b, r.x, r.z, r.r, r.h * 0.55, 20 + i, i % 2 ? ROCK : ROCK_DARK, 0.2);
  });
  // Cliff dressing on the faces below the shelf's rim (their tops stay under the edge), leaving the stairs, the climb path and the lower falls open.
  for (let i = 0; i < 56; i++) {
    const a = (i / 56) * Math.PI * 2;
    const ex = SHELF.x + Math.cos(a) * SHELF.rx;
    const ez = SHELF.z + Math.sin(a) * SHELF.rz;
    const nl = Math.hypot(Math.cos(a) / SHELF.rx, Math.sin(a) / SHELF.rz);
    const nx = Math.cos(a) / SHELF.rx / nl;
    const nz = Math.sin(a) / SHELF.rz / nl;
    const nearStairs = Math.hypot(ex - STAIRS[0].x, ez - STAIRS[0].z) < 4.4 && ez > SHELF.z;
    const nearClimb = Math.hypot(ex - CLIMB_PATH[3].x, ez - CLIMB_PATH[3].z) < 2.6;
    const nearFalls = Math.hypot(ex - LOWER_FALLS.x, ez - LOWER_FALLS.z) < 1.8;
    if (nearStairs || nearClimb || nearFalls || ex < SHELF.x - SHELF.rx * 0.85) continue;
    const top = groundY(ex - nx * 0.5, ez - nz * 0.5) - 0.2;
    const r = 0.8 + rand() * 0.5;
    const cx = ex + nx * (r * 0.95 + 0.25);
    const cz = ez + nz * (r * 0.95 + 0.25);
    const base = groundY(cx, cz) - 0.3;
    const h = (top - base) / 1.16;
    if (h < 0.4) continue;
    b.add(rockGeometry(r, h, 40 + i, 1), rand() > 0.5 ? ROCK : ROCK_DARK, [cx, base, cz], [0, rand() * 6, 0]);
  }
  // The west cliff behind the high waterfall: stacked slabs, with the falls' notch.
  for (let k = 0; k < 9; k++) {
    const z = SHELF.z - 5.6 + k * 1.45;
    if (Math.abs(z - HIGH_FALLS.z) < 1.1) continue;
    for (let row = 0; row < 3; row++) {
      const x = HIGH_FALLS.x - 0.7 - row * 0.9 + rand() * 0.3;
      const y = 3.4 + row * 2.8;
      b.add(rockGeometry(1.1 + rand() * 0.5, 1.8, 70 + k * 3 + row, 1), row % 2 ? ROCK_DARK : ROCK, [x, y, z], [0, rand() * 6, 0], [1, 1.2, 1]);
    }
  }
  // The lip the high waterfall comes over, and its pool's rim.
  b.add(rockGeometry(1.4, 0.7, 88, 1), ROCK_DARK, [HIGH_FALLS.x - 0.6, HIGH_FALLS.top - 0.35, HIGH_FALLS.z], [0, 0.4, 0], [1, 1, 1.4]);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + 0.3;
    if (Math.cos(a) > 0.82) continue; // the pool's outflow into the stream
    const x = UPPER_POOL.x + Math.cos(a) * (UPPER_POOL.r + 0.25);
    const z = UPPER_POOL.z + Math.sin(a) * (UPPER_POOL.r + 0.25);
    rock(b, x, z, 0.45 + rand() * 0.25, 0.45, 100 + i, i % 2 ? ROCK : MOSS, 0.15);
  }
  // Bank stones along the stream, and the ford's stepping stones.
  for (let i = 1; i < SHELF_STREAM.length; i++) {
    const a = SHELF_STREAM[i - 1];
    const c = SHELF_STREAM[i];
    const len = Math.hypot(c.x - a.x, c.z - a.z);
    const nx = -(c.z - a.z) / len;
    const nz = (c.x - a.x) / len;
    for (let t = 0.2; t < 1; t += 0.45) {
      const side = rand() > 0.5 ? 1 : -1;
      const x = a.x + (c.x - a.x) * t + nx * side * (SHELF_STREAM_HALF + 0.2);
      const z = a.z + (c.z - a.z) * t + nz * side * (SHELF_STREAM_HALF + 0.2);
      if (Math.abs(x - FORD.x) < FORD.half + 0.4) continue;
      rock(b, x, z, 0.28 + rand() * 0.2, 0.3, 130 + i * 7 + Math.round(t * 10), rand() > 0.6 ? MOSS : ROCK, 0.1);
    }
  }
  for (let k = -1; k <= 1; k++) {
    const z = FORD.z + k * 0.72;
    const x = FORD.x + (k === 0 ? 0.08 : -0.06);
    b.add(new THREE.CylinderGeometry(0.34, 0.4, 0.22, 7), STEP, [x, shelfWaterY(x) + 0.06, z], [0, k, 0]);
  }
  // The flat table rock for Kai's bucket.
  b.add(new THREE.CylinderGeometry(TABLE_ROCK.r, TABLE_ROCK.r + 0.15, TABLE_ROCK.h + 0.35, 9), ROCK_WARM,
    [TABLE_ROCK.x, groundY(TABLE_ROCK.x, TABLE_ROCK.z) - (TABLE_ROCK.h + 0.35) / 2 + 0.03, TABLE_ROCK.z], [0, 0.3, 0]);
  // The intakes: a rock lip in the stream, with a stone gutter where a pipe can start.
  for (const spot of INTAKE_SPOTS) {
    const src = INTAKE_SOURCES[spot.id];
    const lipY = INTAKES.find((i) => i.id === spot.id)!.y;
    const dx = spot.x - src.x;
    const dz = spot.z - src.z;
    const yaw = Math.atan2(dx, dz);
    b.add(rockGeometry(0.62, Math.max(0.6, lipY - shelfWaterY(src.x) + 0.3), 150 + spot.lip * 10, 1), ROCK_DARK, [src.x, shelfWaterY(src.x) - 0.25, src.z], [0, yaw, 0], [1, 1, 0.8]);
    b.add(new THREE.BoxGeometry(0.34, 0.1, Math.hypot(dx, dz) * 0.7), ROCK_DARK, [src.x + dx * 0.45, lipY - 0.07, src.z + dz * 0.45], [0.1, yaw, 0]);
  }
  // The rock stairs: stone steps down the ramp.
  const sx = STAIRS[1].x - STAIRS[0].x;
  const sz = STAIRS[1].z - STAIRS[0].z;
  const slen = Math.hypot(sx, sz);
  const syaw = Math.atan2(sx, sz);
  for (let d = 0.6; d < slen - 0.6; d += 0.75) {
    const x = STAIRS[0].x + (sx / slen) * d;
    const z = STAIRS[0].z + (sz / slen) * d;
    b.add(new THREE.BoxGeometry(STAIRS_R * 1.6, 0.16, 0.5), STEP, [x, groundY(x, z) + 0.02, z], [0, syaw, 0]);
  }
  for (let d = 0.4; d < slen; d += 1.6) {
    for (const side of [-1, 1]) {
      const x = STAIRS[0].x + (sx / slen) * d + (sz / slen) * side * (STAIRS_R + 0.45);
      const z = STAIRS[0].z + (sz / slen) * d - (sx / slen) * side * (STAIRS_R + 0.45);
      rock(b, x, z, 0.4 + rand() * 0.3, 0.6, 170 + Math.round(d * 3) + side, side > 0 ? ROCK : ROCK_DARK, 0.2);
    }
  }
  // Rocks round the plunge pool and along the brook.
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    if (Math.cos(a) < -0.7) continue;
    rock(b, PLUNGE_POOL.x + Math.cos(a) * (PLUNGE_POOL.r + 0.3), PLUNGE_POOL.z + Math.sin(a) * (PLUNGE_POOL.r + 0.3), 0.5 + rand() * 0.3, 0.6, 190 + i, ROCK, 0.2);
  }
  // Ferns and moss on the shelf, kept off the water, the paths and the stairs.
  for (let i = 0; i < 46; i++) {
    const a = rand() * Math.PI * 2;
    const rr = Math.sqrt(rand()) * 0.92;
    const x = SHELF.x + Math.cos(a) * SHELF.rx * rr;
    const z = SHELF.z + Math.sin(a) * SHELF.rz * rr;
    const tooWet = SHELF_STREAM.some((p, k) => k > 0 && segDist(x, z, SHELF_STREAM[k - 1], p) < SHELF_STREAM_HALF + 0.5) || Math.hypot(x - UPPER_POOL.x, z - UPPER_POOL.z) < UPPER_POOL.r + 0.6;
    const inWay = Math.hypot(x - FORD.x, z - FORD.z) < 2.2 || segDist(x, z, STAIRS[0], STAIRS[1]) < STAIRS_R + 0.4 || Math.hypot(x - TABLE_ROCK.x, z - TABLE_ROCK.z) < TABLE_ROCK.r + 0.6
      || INTAKE_SPOTS.some((s) => Math.hypot(x - s.x, z - s.z) < 1.6) || Math.hypot(x - CLIMB_PATH[3].x, z - CLIMB_PATH[3].z) < 1.6;
    if (tooWet || inWay) continue;
    const y = groundY(x, z);
    if (i % 3 === 0) {
      b.add(new THREE.SphereGeometry(0.32 + rand() * 0.2, 6, 4), MOSS, [x, y + 0.02, z], [0, 0, 0], [1.3, 0.35, 1]);
      continue;
    }
    const s = 0.5 + rand() * 0.45;
    for (let k = 0; k < 5; k++) {
      const fa = (k / 5) * Math.PI * 2 + rand();
      b.add(new THREE.ConeGeometry(0.07 * s, 0.7 * s, 3), k % 2 ? FERN : FERN_LIGHT, [x + Math.sin(fa) * 0.18 * s, y + 0.24 * s, z + Math.cos(fa) * 0.18 * s], [0.9, fa, 0], [1, 1, 0.35]);
    }
  }
  // A bamboo clump by the upper pool.
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    const x = SHELF_BAMBOO.x + Math.cos(a) * 0.45;
    const z = SHELF_BAMBOO.z + Math.sin(a) * 0.45;
    const y = groundY(x, z);
    const h = 4.2 + (k % 3) * 0.9;
    const lean = 0.25 + (k % 2) * 0.15;
    const top: V3 = [x + Math.cos(a) * lean, y + h, z + Math.sin(a) * lean];
    bambooPole(b, [x, y - 0.1, z], top, 0.07, 0.92 + (k % 3) * 0.05, 0.6);
    leafSpray(b, top[0], top[1], top[2], 0.9, a);
    leafSpray(b, (x + top[0]) / 2 + 0.1, y + h * 0.7, (z + top[2]) / 2, 0.7, a + 1);
  }
  // Edge rocks along the climbing path.
  for (let i = 1; i < CLIMB_PATH.length; i++) {
    const a = CLIMB_PATH[i - 1];
    const c = CLIMB_PATH[i];
    const len = Math.hypot(c.x - a.x, c.z - a.z);
    for (let d = 0.8; d < len; d += 1.9) {
      const t = d / len;
      const side = (i + Math.round(d)) % 2 ? 1 : -1;
      const x = a.x + (c.x - a.x) * t - ((c.z - a.z) / len) * side * 1.9;
      const z = a.z + (c.z - a.z) * t + ((c.x - a.x) / len) * side * 1.9;
      rock(b, x, z, 0.45 + rand() * 0.3, 0.6, 210 + i * 9 + Math.round(d), ROCK_DARK, 0.25);
    }
  }
  return b.build();
}

function segDist(x: number, z: number, a: { x: number; z: number }, c: { x: number; z: number }): number {
  const dx = c.x - a.x;
  const dz = c.z - a.z;
  const l2 = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / l2));
  return Math.hypot(a.x + dx * t - x, a.z + dz * t - z);
}

// ---------------------------------------------------------------- water

/** A flat ribbon along a polyline at a given height (stream and brook surfaces). */
function ribbon(points: ReadonlyArray<{ x: number; z: number }>, half: (i: number) => number, y: (x: number, z: number) => number): THREE.BufferGeometry {
  const pos: number[] = [];
  const idx: number[] = [];
  const steps: Array<{ x: number; z: number }> = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const c = points[i];
    const n = Math.ceil(Math.hypot(c.x - a.x, c.z - a.z) / 0.8);
    for (let k = 0; k < n; k++) steps.push({ x: a.x + ((c.x - a.x) * k) / n, z: a.z + ((c.z - a.z) * k) / n });
  }
  steps.push(points[points.length - 1]);
  steps.forEach((p, i) => {
    const q = steps[Math.min(steps.length - 1, i + 1)];
    const o = steps[Math.max(0, i - 1)];
    const dx = q.x - o.x;
    const dz = q.z - o.z;
    const len = Math.hypot(dx, dz) || 1;
    const nx = -dz / len;
    const nz = dx / len;
    const h = half(i / (steps.length - 1));
    pos.push(p.x + nx * h, y(p.x, p.z), p.z + nz * h, p.x - nx * h, y(p.x, p.z), p.z - nz * h);
    if (i < steps.length - 1) idx.push(i * 2, i * 2 + 2, i * 2 + 1, i * 2 + 1, i * 2 + 2, i * 2 + 3);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function disc(x: number, y: number, z: number, r: number): THREE.BufferGeometry {
  const g = new THREE.CircleGeometry(r, 20);
  g.rotateX(-Math.PI / 2);
  g.translate(x, y, z);
  g.deleteAttribute("uv");
  return g.toNonIndexed();
}

/** The shelf's pool and stream, the plunge pool and its brook (one water material). */
export function upperWaterGeometries(): THREE.BufferGeometry[] {
  const stream = ribbon([{ x: UPPER_POOL.x + UPPER_POOL.r - 0.6, z: UPPER_POOL.z }, ...SHELF_STREAM], (t) => SHELF_STREAM_HALF * (0.92 + Math.sin(t * 9) * 0.06), (x) => shelfWaterY(x));
  const brookY = (x: number) => PLUNGE_POOL.y - ((x - BROOK[0].x) / (BROOK[2].x - BROOK[0].x)) * 0.25;
  const brook = ribbon([{ x: PLUNGE_POOL.x + 0.6, z: PLUNGE_POOL.z }, ...BROOK], () => 0.38, (x) => brookY(x));
  return [
    stream.toNonIndexed(),
    brook.toNonIndexed(),
    disc(UPPER_POOL.x, shelfWaterY(UPPER_POOL.x), UPPER_POOL.z, UPPER_POOL.r),
    disc(PLUNGE_POOL.x, PLUNGE_POOL.y, PLUNGE_POOL.z, PLUNGE_POOL.r)
  ];
}

/** A curtain of falling water from a lip to a pool, with v running down it (for the scrolling streaks). */
function curtain(top: V3, bottom: V3, width: number, out: number, segments = 6): THREE.BufferGeometry {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const dx = bottom[0] - top[0];
  const dz = bottom[2] - top[2];
  const across = new THREE.Vector3(-dz, 0, dx).normalize();
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    // Water leaves the lip forward, then falls: a short arc.
    const arc = Math.sin(t * Math.PI * 0.5);
    const x = top[0] + dx * arc + (dx === 0 ? out * arc : 0);
    const z = top[2] + dz * arc;
    const y = top[1] + (bottom[1] - top[1]) * t * t * 0.4 + (bottom[1] - top[1]) * t * 0.6;
    const w = width * (0.9 + t * 0.25);
    pos.push(x + across.x * w / 2, y, z + across.z * w / 2, x - across.x * w / 2, y, z - across.z * w / 2);
    uv.push(0, 1 - t * 2, 1, 1 - t * 2);
    if (i < segments) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g.toNonIndexed();
}

/** Both waterfalls and the little spills at the intake lips. */
export function fallsGeometries(): THREE.BufferGeometry[] {
  const pool = shelfWaterY(UPPER_POOL.x);
  const lip = shelfWaterY(LOWER_FALLS.x);
  const list = [
    curtain([HIGH_FALLS.x - 0.4, HIGH_FALLS.top, HIGH_FALLS.z], [UPPER_POOL.x - 1.1, pool, UPPER_POOL.z], HIGH_FALLS.width, 0, 8),
    curtain([LOWER_FALLS.x, lip, LOWER_FALLS.z], [PLUNGE_POOL.x - 0.6, PLUNGE_POOL.y, PLUNGE_POOL.z], LOWER_FALLS.width, 0, 6)
  ];
  for (const spot of INTAKE_SPOTS) {
    const src = INTAKE_SOURCES[spot.id];
    const y = INTAKES.find((i) => i.id === spot.id)!.y;
    list.push(curtain([src.x + (spot.x - src.x) * 0.35, y + 0.08, src.z + (spot.z - src.z) * 0.35], [src.x + (spot.x - src.x) * 0.15, shelfWaterY(src.x), src.z + (spot.z - src.z) * 0.15], 0.22, 0, 3));
  }
  return list;
}

/** Streaks for the falls' scrolling texture. */
export function fallsTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 128;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#9fdcf2";
  ctx.fillRect(0, 0, 64, 128);
  const rand = makeRng(7);
  for (let i = 0; i < 26; i++) {
    ctx.fillStyle = rand() > 0.5 ? "rgba(255,255,255,0.85)" : "rgba(214,243,255,0.8)";
    const x = rand() * 64;
    ctx.fillRect(x, rand() * 128, 2 + rand() * 4, 18 + rand() * 40);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ------------------------------------------------------------- Day 5's wreckage

/** Wreckage floating off the east headland, drifting toward the next cove (seen from the clifftop on Day 5). */
export function driftingWreckageGeometry(): THREE.BufferGeometry {
  const b = new PartBuilder(0.2);
  const crate = (x: number, z: number, s: number, yaw: number, tilt: number) => {
    b.add(new THREE.BoxGeometry(s, s * 0.78, s), "#c08a4a", [x, 0.1, z], [tilt, yaw, tilt * 0.6]);
    b.add(new THREE.BoxGeometry(s * 1.04, s * 0.08, s * 1.04), "#8a5a2c", [x, 0.1 + s * 0.2, z], [tilt, yaw, tilt * 0.6]);
  };
  crate(0, 0, 1.3, 0.4, 0.15);
  crate(3.4, 2.1, 1.0, 1.1, -0.2);
  crate(-2.6, 3.2, 1.15, 2.2, 0.1);
  crate(5.6, -1.6, 0.9, 0.2, 0.25);
  for (const [x, z, len, yaw] of [[1.6, -2.4, 4.2, 0.3], [-3.4, -0.6, 3.4, 1.4], [4.2, 4.6, 3.8, 2.6], [-0.6, 5.4, 2.8, 0.9]] as const) {
    b.add(new THREE.BoxGeometry(0.42, 0.14, len), "#8a6038", [x, 0.02, z], [0, yaw, 0.08]);
  }
  // A broken spar with a scrap of sail.
  b.add(new THREE.CylinderGeometry(0.16, 0.2, 6.5, 7), "#6b4628", [-5.6, 0.1, 1.2], [Math.PI / 2, 0.7, 0]);
  b.add(new THREE.PlaneGeometry(2.6, 1.8), "#ece2c6", [-5.2, 0.35, 1.4], [-Math.PI / 2 + 0.25, 0, 0.7]);
  b.add(new THREE.PlaneGeometry(2.6, 1.8), "#ece2c6", [-5.2, 0.34, 1.4], [Math.PI / 2 + 0.25, 0, 0.7]);
  return b.build();
}

// ------------------------------------------------------------- the tangle

/** Fallen bamboo lying across the top of the stairs (local frame: x across the stairs). */
export function tangleGeometry(): THREE.BufferGeometry {
  const b = new PartBuilder(0.4);
  const culms: Array<[V3, V3]> = [
    [[-1.9, 0.25, -0.3], [1.8, 0.7, 0.4]],
    [[-1.7, 0.75, 0.5], [1.9, 0.3, -0.2]],
    [[-1.5, 0.45, -0.7], [1.6, 1.05, 0.2]],
    [[-1.9, 1.1, 0.1], [1.7, 0.5, 0.6]]
  ];
  culms.forEach(([a, c], i) => {
    bambooPole(b, a, c, 0.085, 0.82 + i * 0.05, 0.55);
    leafSpray(b, c[0], c[1] + 0.1, c[2], 0.75, i * 1.3, "#8d9a4a");
  });
  return b.build();
}

export const TANGLE_YAW = TANGLE.rot;

// --------------------------------------------------------------- containers

/** Kai's bucket: a short section of a big bamboo culm with a rope handle (its water is a separate disc). */
export function bucketGeometry(): THREE.BufferGeometry {
  const s = CONTAINER_SPECS.bucket;
  const b = new PartBuilder(0.3);
  b.add(new THREE.CylinderGeometry(s.radius, s.radius * 0.94, s.rim, 10, 1, true), BAMBOO, [0, s.rim / 2, 0]);
  b.add(new THREE.CylinderGeometry(s.radius * 0.9, s.radius * 0.86, s.rim - 0.03, 10, 1, true).scale(-1, 1, 1), BAMBOO_INSIDE, [0, s.rim / 2 + 0.01, 0]);
  b.add(new THREE.CylinderGeometry(s.radius * 0.93, s.radius * 0.93, 0.04, 10), BAMBOO_DARK, [0, 0.03, 0]);
  b.torus(s.radius * 1.02, 0.02, [0, s.rim * 0.35, 0], [Math.PI / 2, 0, 0], BAMBOO_DARK);
  b.torus(s.radius * 1.01, 0.018, [0, s.rim - 0.02, 0], [Math.PI / 2, 0, 0], BAMBOO_DARK);
  b.add(new THREE.TorusGeometry(s.radius * 0.9, 0.018, 4, 12, Math.PI), ROPE, [0, s.rim, 0], [0, 0, 0]);
  return b.build();
}

/** The camp's water tank: bamboo staves bound with rope round a canvas lining, knee-high and wide. */
export function tankGeometry(): THREE.BufferGeometry {
  const s = CONTAINER_SPECS.tank;
  const b = new PartBuilder(0.5);
  b.add(new THREE.CylinderGeometry(s.radius * 0.97, s.radius * 0.97, s.rim - 0.04, 16, 1, true).scale(-1, 1, 1), "#e3d8b8", [0, s.rim / 2 + 0.02, 0]);
  b.add(new THREE.CylinderGeometry(s.radius * 0.96, s.radius * 0.96, 0.05, 16), "#cfc3a0", [0, 0.04, 0]);
  const staves = 16;
  for (let i = 0; i < staves; i++) {
    const a = (i / staves) * Math.PI * 2;
    const x = Math.sin(a) * s.radius;
    const z = Math.cos(a) * s.radius;
    b.add(new THREE.CylinderGeometry(0.075, 0.08, s.rim + (i % 2) * 0.06, 6), i % 3 ? BAMBOO : BAMBOO_DARK, [x, (s.rim + (i % 2) * 0.06) / 2, z]);
  }
  for (const y of [0.18, s.rim * 0.62]) b.torus(s.radius + 0.07, 0.035, [0, y, 0], [Math.PI / 2, 0, 0], ROPE);
  return b.build();
}

// ------------------------------------------------------------------ pipes

const TROUGH_R = 0.1;
const TROUGH_SEG = 5;

/** An open-topped half-pipe from a to b (inside and outside faces, joined at the rims). */
function trough(b: PartBuilder, a: THREE.Vector3, c: THREE.Vector3, tint: number) {
  const f = c.clone().sub(a);
  const len = f.length();
  if (len < 0.05) return;
  f.divideScalar(len);
  const right = new THREE.Vector3().crossVectors(f, new THREE.Vector3(0, 1, 0));
  if (right.lengthSq() < 1e-6) right.set(1, 0, 0);
  right.normalize();
  const up = new THREE.Vector3().crossVectors(right, f).normalize();
  const pos: number[] = [];
  const col: number[] = [];
  const outer = new THREE.Color(BAMBOO).multiplyScalar(tint);
  const inner = new THREE.Color(BAMBOO_INSIDE).multiplyScalar(tint);
  const ring = (p: THREE.Vector3, r: number) => Array.from({ length: TROUGH_SEG + 1 }, (_, k) => {
    const phi = (k / TROUGH_SEG) * Math.PI;
    return p.clone().addScaledVector(right, Math.cos(phi) * r).addScaledVector(up, -Math.sin(phi) * r);
  });
  const quad = (p0: THREE.Vector3, p1: THREE.Vector3, p2: THREE.Vector3, p3: THREE.Vector3, color: THREE.Color) => {
    for (const p of [p0, p1, p2, p0, p2, p3]) pos.push(p.x, p.y, p.z);
    for (let i = 0; i < 6; i++) col.push(color.r, color.g, color.b);
  };
  const aIn = ring(a, TROUGH_R);
  const cIn = ring(c, TROUGH_R);
  const aOut = ring(a, TROUGH_R + 0.025);
  const cOut = ring(c, TROUGH_R + 0.025);
  for (let k = 0; k < TROUGH_SEG; k++) {
    quad(aIn[k], aIn[k + 1], cIn[k + 1], cIn[k], inner);
    quad(aOut[k], cOut[k], cOut[k + 1], aOut[k + 1], outer);
  }
  quad(aIn[0], cIn[0], cOut[0], aOut[0], inner);
  quad(aOut[TROUGH_SEG], cOut[TROUGH_SEG], cIn[TROUGH_SEG], aIn[TROUGH_SEG], inner);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array((pos.length / 3) * 2), 2));
  g.computeVertexNormals();
  b.add(g, "#ffffff", [0, 0, 0], [0, 0, 0], [1, 1, 1], { vary: false, flatAo: true });
  // Node rings on the outside.
  for (const t of [0.33, 0.66]) {
    const p = a.clone().lerp(c, t);
    cylinderBetween(b, p.clone().addScaledVector(f, -0.02).addScaledVector(up, -0.04).toArray() as V3, p.clone().addScaledVector(f, 0.02).addScaledVector(up, -0.04).toArray() as V3, TROUGH_R * 0.95, BAMBOO_DARK, 6, true);
  }
}

/** A post with a fork at the top where the channel rests, and its rope lashing. */
function post(b: PartBuilder, x: number, z: number, top: number) {
  const g = groundY(x, z);
  const h = top - g - 0.08;
  if (h > 0.05) b.add(new THREE.CylinderGeometry(0.045, 0.055, h, 6), BAMBOO_DARK, [x, g + h / 2, z]);
  b.add(new THREE.CylinderGeometry(0.03, 0.03, 0.34, 5), BAMBOO_DARK, [x, top - 0.1, z], [0, 0, 0.75]);
  b.add(new THREE.CylinderGeometry(0.03, 0.03, 0.34, 5), BAMBOO_DARK, [x, top - 0.1, z], [0, 0, -0.75]);
  b.torus(0.06, 0.02, [x, top - 0.16, z], [Math.PI / 2, 0, 0], ROPE);
}

/** The player's whole network as one mesh: channels, posts, lashings and elbows. */
export function pipeNetworkGeometry(net: Network, env: Env): THREE.BufferGeometry {
  const b = new PartBuilder(0.4);
  const rim = (y: number) => y + TROUGH_R * 0.15;
  for (const p of net.pipes) {
    const a = nodeOf(net, env, p.from);
    const c = nodeOf(net, env, p.to);
    if (!a || !c) continue;
    const len = Math.hypot(c.x - a.x, c.z - a.z) || 1;
    const ux = (c.x - a.x) / len;
    const uz = (c.z - a.z) / len;
    // An open end runs on past its post to the spout.
    const end = outgoing(net, p.to).length ? 0.05 : POUR_REACH;
    const start = a.intake ? -0.15 : 0.05;
    trough(b, new THREE.Vector3(a.x - ux * start, rim(a.y), a.z - uz * start), new THREE.Vector3(c.x + ux * end, rim(c.y), c.z + uz * end), p.kind === "short" ? 0.95 : 1);
  }
  for (const j of net.joints) {
    const n = nodeOf(net, env, j.id)!;
    post(b, n.x, n.z, n.y);
    // An elbow where the line turns.
    const inn = net.pipes.find((p) => p.to === j.id);
    const out = outgoing(net, j.id)[0];
    if (inn && out) {
      const a = nodeOf(net, env, inn.from);
      const c = nodeOf(net, env, out.to);
      if (a && c) {
        const d1 = Math.atan2(n.x - a.x, n.z - a.z);
        const d2 = Math.atan2(c.x - n.x, c.z - n.z);
        if (Math.abs(Math.atan2(Math.sin(d2 - d1), Math.cos(d2 - d1))) > 0.15) b.add(new THREE.CylinderGeometry(TROUGH_R + 0.04, TROUGH_R + 0.04, 0.12, 8), BAMBOO_DARK, [n.x, rim(n.y) - 0.04, n.z]);
      }
    }
  }
  return b.build();
}

