import { makeRng } from "../logic/rng";
import {
  BOULDERS, BRIDGE, CAVE_MOUTH, CAVE_SIGN, CLIFF_SIGN, CRATE, FALLEN_TREE,
  FISH_SPOTS, FOREST_GAP, KAI_HOME, LEAN_TO, NODES, PALMS, POND, SPAWN,
  STREAM, WATER_SPOTS, WRECK, shoreZ, type Palm
} from "./island";
import { CLIFF_PATH, CLIFF_PATH_R, KAI_ROUTES, nearestOnSegment } from "./phase3";

type Point = { x: number; z: number };
export type PalmVariant = "palmA" | "palmB" | "palmC";
export type DecorKey = "rockA" | "rockB" | "rockC" | "rockD" | "rockE" | "barrel" | "bucket" | "bottle" | "post";
export interface DecorPalm extends Palm {
  id: string;
  variant: PalmVariant;
  yaw: number;
}
export interface DecorItem extends Point {
  id: string;
  key: DecorKey;
  height: number;
  yaw: number;
  /** Ground footprint collider, about 80% of the visible base; bottles have none. */
  r: number;
}
type Candidate = Point & { r: number; key?: DecorKey };

const PATHS = [
  [-9, -3, -8, -20, 3.1], [-8, -20, 5, -34, 3.1],
  [-8, -20, -27.5, -22, 3.1], [5, -34, 20, -39, 3],
  [18, -36, 22, -44, 4], [8, -36, 7.2, -42.2, 4]
];

/** The same readable forest corridors used by the procedural tree layout. */
export function onForestPath(x: number, z: number, margin = 0): boolean {
  return PATHS.some(([ax, az, bx, bz, width]) =>
    nearestOnSegment(x, z, { x: ax, z: az }, { x: bx, z: bz }).d < width + margin
  ) || Math.hypot(x - 2, z + 20) < 4.4 + margin;
}

function rectDistance(point: Point, rect: Point & { hw: number; hd: number; rot: number }): number {
  const dx = point.x - rect.x;
  const dz = point.z - rect.z;
  const c = Math.cos(-rect.rot);
  const s = Math.sin(-rect.rot);
  const qx = Math.abs(dx * c + dz * s) - rect.hw;
  const qz = Math.abs(-dx * s + dz * c) - rect.hd;
  return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0);
}

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z);
const beachRoutes = [[SPAWN, CRATE], [SPAWN, KAI_HOME], [KAI_HOME, FOREST_GAP]];

/**
 * Central placement contract, checked during seeded generation and by tests.
 * The entire footprint stays inland and away from interaction approaches,
 * authored walking routes and the open beach space used to place buildings.
 * Pure world data: no renderer or collision-module dependency here.
 */
export function sceneryExclusion(item: Candidate): string | null {
  const { x, z, r } = item;
  if (dist(item, SPAWN) < 4 + r) return "spawn";
  if (z + r > shoreZ(x) - 1.5) return "shore";
  if (NODES.some((n) => dist(item, n) < (item.key?.startsWith("rock") && n.kind === "stone" ? 3 : 2.25) + r)) return "node";
  if (dist(item, KAI_HOME) < 3.5 + r || dist(item, LEAN_TO) < LEAN_TO.r + 2 + r) return "camp";
  if (dist(item, CRATE) < 2.5 + r) return "crate";
  if (rectDistance(item, WRECK) < 1 + r) return "wreck";
  if (Math.abs(x - FOREST_GAP.x) < 2.6 + r && z < 1 + r && z > -11 - r) return "forest gap";
  if (dist(item, FALLEN_TREE) < 3 + r) return "fallen tree";
  if (Math.abs(x - BRIDGE.x) < 4.4 + r && Math.abs(z - BRIDGE.z) < 2.6 + r) return "bridge";
  if (dist(item, POND) < POND.r + 1 + r) return "pond";
  if (Math.abs(x - STREAM.x) < STREAM.width / 2 + r && z > STREAM.z0 - r && z < STREAM.z1 + r) return "stream";
  if ([...WATER_SPOTS, ...FISH_SPOTS, FOREST_GAP.sign, CAVE_SIGN, CLIFF_SIGN, CAVE_MOUTH].some((p) => dist(item, p) < 2.5 + r)) return "interaction";
  if (CLIFF_PATH.some((p, i) => i > 0 && nearestOnSegment(x, z, CLIFF_PATH[i - 1], p).d < CLIFF_PATH_R + 1 + r)) return "cliff path";
  if (onForestPath(x, z, r)) return "forest path";
  if (Object.values(KAI_ROUTES).some((route) => route.some((p, i) => i > 0 && nearestOnSegment(x, z, route[i - 1], p).d < 1.5 + r))) return "Kai route";
  if (beachRoutes.some(([a, b]) => nearestOnSegment(x, z, a, b).d < 2.4 + r)) return "beach route";
  if (x > -5 - r && x < 8 + r && z > 3 - r && z < 7.8 + r) return "building clearing";
  if (PALMS.some((p) => dist(item, p) < 0.42 + r + 0.5)) return "palm";
  if (BOULDERS.some((b) => dist(item, b) < b.r + r + 0.3)) return "boulder";
  return null;
}

// Irregular, hand-curated groups establish the composition; the seeded jitter
// changes spacing, height and yaw without ever moving an item into a keep-clear.
// West grove has six palms; its tallest leaning silhouette is the landmark.
const PALM_ANCHORS = [
  [-32.4, 7.7], [-31.3, 10.3], [-30.1, 7.9], [-28.5, 6.8], [-26.1, 7.5], [-24.2, 9.2],
  [-21.5, 8.8], [-18.4, 9.3],
  [29.1, 1.2], [31.6, 2.6], [32.4, -0.5],
  [21.3, -0.8], [6.8, -1.8],
  [-23.7, -4.4], [24.3, -4.5],
  [-25.3, -13], [24.3, -17], [-43, -32.6]
];
const ITEM_ANCHORS: Array<[DecorKey, number, number, number, number]> = [
  ["rockA", -32.4, 13, 1.4, 0.9], ["rockB", -23.4, 6.4, 1.15, 0.85],
  ["rockC", 31.5, 11.3, 1.35, 0.95], ["rockD", 29, -1.7, 1.25, 0.9],
  ["rockE", -25.7, -31.2, 1.35, 0.9], ["rockA", 24.3, -27, 1.15, 0.8],
  ["barrel", 24.5, 10.2, 1.1, 0.38], ["bucket", 26.2, 10.4, 0.5, 0.25],
  ["bottle", 25.5, 9.8, 0.35, 0], ["post", 28.1, 10.8, 1.35, 0.16]
];

export function makeScenery(seed = 20261022): { palms: DecorPalm[]; items: DecorItem[] } {
  const rand = makeRng(seed);
  const palms: DecorPalm[] = [];
  const items: DecorItem[] = [];
  const accepted: Candidate[] = [];
  function spot(x: number, z: number, r: number, key?: DecorKey): Point | null {
    for (let attempt = 0; attempt < 80; attempt++) {
      const spread = attempt < 24 ? 0.7 : 1.8;
      const p = { x: x + (rand() - 0.5) * spread, z: z + (rand() - 0.5) * spread, r, key };
      if (sceneryExclusion(p) || accepted.some((a) => dist(a, p) < a.r + r + 0.6)) continue;
      accepted.push(p);
      return p;
    }
    return null;
  }
  PALM_ANCHORS.forEach(([x, z], i) => {
    const p = spot(x, z, 0.42);
    if (!p) return;
    palms.push({
      ...p, id: `decor-palm-${i + 1}`, variant: (["palmA", "palmB", "palmC"] as const)[i % 3],
      height: (i === 1 ? 8.1 : 6) * (0.88 + rand() * 0.24),
      lean: i === 1 ? 0.55 : 0.17 + rand() * 0.17,
      dir: (rand() - 0.5) * 0.8, yaw: rand() * Math.PI * 2, coconuts: false
    });
  });
  ITEM_ANCHORS.forEach(([key, x, z, height, r], i) => {
    const p = spot(x, z, r, key);
    if (p) items.push({ ...p, id: `decor-${key}-${i}`, key, height, r, yaw: rand() * Math.PI * 2 });
  });
  return { palms, items };
}

const layout = makeScenery();
export const DECOR_PALMS = layout.palms;
export const DECOR_ITEMS = layout.items;
export const SCENERY_COLLIDERS = [
  ...DECOR_PALMS.map((p) => ({ x: p.x, z: p.z, r: 0.42 })),
  ...DECOR_ITEMS.filter((p) => p.r > 0).map((p) => ({ x: p.x, z: p.z, r: p.r }))
];
