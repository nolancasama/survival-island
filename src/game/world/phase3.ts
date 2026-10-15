import type { NodeDef } from "./island";

/** The cave is a separate set, beyond the island's far plane. */
export const CAVE_CHAMBER = { x: 1000, z: 980, width: 12, depth: 16, y: 0 };
export const CAVE_CORRIDOR = { x0: 992, x1: 998, z0: 984, z1: 1000 };
export const CAVE_ENTRY = { x: 994, z: 995, yaw: Math.PI };
export const CAVE_EXIT = { id: "caveExit", x: 994, z: 998, r: 0.9 };
export const CAVE_OUTSIDE = { x: 22, z: -41.7, yaw: 0 };
export const CAVE_BOX = { id: "caveBox", x: 1002, z: 974, rot: 0.15 };
export const METAL_NODES: NodeDef[] = [
  { id: "metal-1", kind: "metal", x: 996, z: 981, rot: 0.3 },
  { id: "metal-2", kind: "metal", x: 1003, z: 984, rot: 1.2 },
  { id: "metal-3", kind: "metal", x: 999, z: 976, rot: 2.1 }
];

export function isCaveInterior(x: number, z: number): boolean {
  return x > 980 && x < 1020 && z > 960 && z < 1020;
}

export const ROCKFALL = { id: "rockfall", x: 7, z: -41 };
export const CLIFF_PATH = [
  { x: 7, z: -41, y: 3 },
  { x: 7, z: -49, y: 7 },
  { x: 3, z: -54, y: 10 },
  { x: 18, z: -63, y: 16 },
  { x: 24, z: -71, y: 25 },
  { x: 26, z: -74, y: 25 }
];
export const CLIFF_PATH_R = 2.2;
export const CLIFFTOP = { id: "clifftop", x: 26, z: -78, r: 7, y: 25 };
export const SIGNAL_PAD = { id: "signalPad", x: 22, z: -79, r: 1.3 };
export const HELICOPTER_PAD = { x: 30, z: -75, y: 25 };
export const RESCUE_SECONDS = 12;
export const RESCUE_SHOT = { pos: { x: 43, y: 34, z: -56 }, target: { x: 26, y: 28, z: -77 } };

export function isOnClifftop(x: number, z: number): boolean {
  return Math.hypot(x - CLIFFTOP.x, z - CLIFFTOP.z) <= CLIFFTOP.r - 0.35;
}

export const KAI_ROUTES: Record<"toRockfall" | "toClifftop", Array<{ x: number; z: number }>> = {
  toRockfall: [
    { x: -12, z: 3 }, { x: -9, z: 0 }, { x: -9, z: -5 },
    { x: -5, z: -15 }, { x: 1, z: -29 }, { x: 5.5, z: -40.5 }
  ],
  toClifftop: [
    { x: 7, z: -41 }, ...CLIFF_PATH.slice(1).map(({ x, z }) => ({ x, z })),
    { x: 24, z: -76 }, { x: 23, z: -77 }
  ]
};

export function nearestOnSegment(x: number, z: number, a: { x: number; z: number }, b: { x: number; z: number }) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz)));
  const point = { x: a.x + dx * t, z: a.z + dz * t };
  return { ...point, t, d: Math.hypot(x - point.x, z - point.z) };
}

const smooth = (t: number) => {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
};

/** Blend the authored ramp into the existing hillside without terrain seams. */
export function cliffGroundY(x: number, z: number, original: number): number {
  let weightedY = 0;
  let weight = 0;
  let influence = 0;
  for (let i = 1; i < CLIFF_PATH.length; i++) {
    const a = CLIFF_PATH[i - 1];
    const b = CLIFF_PATH[i];
    const p = nearestOnSegment(x, z, a, b);
    const w = 1 - smooth((p.d - CLIFF_PATH_R) / 1.8);
    // Nearby segments dominate, so a bend does not average in the height of
    // the preceding/following landing and create a steep lip on the trail.
    const proximity = w / Math.pow(p.d + 0.1, 4);
    weightedY += (a.y + (b.y - a.y) * p.t) * proximity;
    weight += proximity;
    influence = Math.max(influence, w);
  }
  let y = weight > 0 ? original + (weightedY / weight - original) * influence * smooth((-42 - z) / 2) : original;
  const plateau = 1 - smooth((Math.hypot(x - CLIFFTOP.x, z - CLIFFTOP.z) - CLIFFTOP.r) / 4);
  y += (CLIFFTOP.y - y) * plateau;
  return y;
}
