/**
 * Chapter 3 geography (EXPANSION_PLAN.md Milestone 4): the Upper Stream, a
 * rocky shelf about 4 m above the beach's west headland. Its stream runs east
 * from a pool under the high waterfall to the lower falls, which drop into a
 * plunge pool beside the old lowland stream. The long way up is a path from
 * the pond clearing; the short way is the rock stairs down to the beach's west
 * end, blocked at the top by fallen bamboo until Day 9.
 *
 * Kept free of island.ts imports (island.ts reads the shaping from here).
 * Ground changes only west of the beach's walkable edge and outside the pond
 * clearing, where nothing could ever stand. Coordinates: +x east, +z south.
 */

const smooth = (t: number) => {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
};

type P = { x: number; z: number };

/** Distance from (x, z) to segment a–b, and how far along it lies (0..1). */
function seg(x: number, z: number, a: P, b: P): { d: number; t: number } {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const l2 = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / l2));
  return { d: Math.hypot(a.x + dx * t - x, a.z + dz * t - z), t };
}

/** Distance to a polyline, and the arc length along it of the nearest point. */
function polyline(x: number, z: number, pts: readonly P[]): { d: number; s: number } {
  let best = { d: Infinity, s: 0 };
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const len = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
    const p = seg(x, z, pts[i - 1], pts[i]);
    if (p.d < best.d) best = { d: p.d, s: acc + p.t * len };
    acc += len;
  }
  return best;
}

const lengthOf = (pts: readonly P[]) => pts.slice(1).reduce((sum, p, i) => sum + Math.hypot(p.x - pts[i].x, p.z - pts[i].z), 0);

// ------------------------------------------------------------------ the shelf

/** The walkable shelf (an ellipse; its stream and pool are obstacles). */
export const SHELF = { x: -50, z: -6.5, rx: 10, rz: 5 } as const;
/** Shelf height at its middle, and how much it falls per metre east (the stream runs east). */
export const SHELF_Y = 4;
const SHELF_SLOPE = 0.035;
/** The pool under the high waterfall, and the stream from it to the lower falls. */
export const UPPER_POOL = { x: -56.5, z: -6.6, r: 2.3 } as const;
export const SHELF_STREAM: readonly P[] = [
  { x: -54.4, z: -6.8 },
  { x: -51, z: -7.4 },
  { x: -47.5, z: -7.1 },
  { x: -44, z: -6.3 },
  { x: -40.3, z: -6.0 }
];
export const SHELF_STREAM_HALF = 0.85;
/** Stepping stones across the stream. */
export const FORD = { x: -46.6, z: -6.95, half: 0.75 } as const;
/** The high waterfall: from the west cliff's lip down into the upper pool. */
export const HIGH_FALLS = { x: -59.3, z: -6.6, top: 11.6, width: 1.7 } as const;
/** The lower falls at the shelf's east edge, and the plunge pool below. */
export const LOWER_FALLS = { x: -40.3, z: -6.0, width: 1.5 } as const;
export const PLUNGE_POOL = { x: -37.5, z: -6.1, r: 1.5, y: 0.22 } as const;
/** The plunge pool drains into the old lowland stream. */
export const BROOK: readonly P[] = [{ x: -36.2, z: -5.8 }, { x: -34.2, z: -5.1 }, { x: -32.3, z: -4.6 }];
/** A flat table rock on the north bank where Kai's bucket stands (Day 9). */
export const TABLE_ROCK = { x: -49, z: -9.6, r: 1.15, h: 0.5 } as const;

/** Where water can enter a pipe: rock lips where part of the stream spills over (height above the bank). */
export const INTAKE_SPOTS: ReadonlyArray<{ id: string; x: number; z: number; lip: number; name: string }> = [
  { id: "i:upper", x: -53.2, z: -8.35, lip: 1.3, name: "upper" },
  { id: "i:lower", x: -44.4, z: -5.05, lip: 1.1, name: "lower" }
];
/** Where the water comes from at each lip (a point in the stream). */
export const INTAKE_SOURCES: Readonly<Record<string, P>> = {
  "i:upper": { x: -53.25, z: -7.35 },
  "i:lower": { x: -44.3, z: -6.0 }
};

/** Standing rocks on the shelf (landmarks and route obstacles): x, z, radius, height. */
export const SHELF_ROCKS: ReadonlyArray<{ x: number; z: number; r: number; h: number }> = [
  // The split boulder in the middle of the south side.
  { x: -51.6, z: -4.0, r: 1.2, h: 2.7 },
  { x: -55.2, z: -3.7, r: 0.95, h: 1.7 },
  { x: -45.2, z: -9.7, r: 0.9, h: 1.9 },
  { x: -58.2, z: -9.2, r: 1.0, h: 2.3 },
  { x: -41.8, z: -8.3, r: 0.9, h: 2.1 },
  // A short pillar beside the top of the stairs.
  { x: -45.2, z: -3.0, r: 0.6, h: 1.5 }
];
/** A bamboo clump by the upper pool (scenery; the Day 9 poles come from the fallen bamboo). */
export const SHELF_BAMBOO = { x: -54.2, z: -3.2, r: 0.8 } as const;

// ------------------------------------------------------------- ways up and down

/** The rock stairs from the shelf's south-east corner down to the beach's west end (22.5° south of east). */
export const STAIRS: readonly P[] = [{ x: -43.6, z: -4.5 }, { x: -34.0, z: -0.52 }];
export const STAIRS_R = 1.25;
/** Where the stairs meet the beach (the ramp ends here; the beach is never reshaped). */
const STAIRS_EDGE_X = -35.2;
/** Fallen bamboo across the top of the stairs (Day 9: "Cut the bamboo.", gate `stairsOpen`). */
export const TANGLE = { id: "tangle", x: -41.6, z: -3.65, rot: 0.39 } as const;
/** Where the player stands to cut it (on the shelf side). */
export const TANGLE_SPOT = { x: -42.6, z: -4.1 } as const;
/** Bamboo from the tangle. */
export const TANGLE_POLES = 4;

/** The long way: a path climbing from the pond clearing's south-west side to the shelf's west end. */
export const CLIMB_PATH: readonly P[] = [
  { x: -52.4, z: -18.6 },
  { x: -56.2, z: -16.2 },
  { x: -57.2, z: -12.6 },
  { x: -56.6, z: -9.6 }
];
export const CLIMB_R = 1.35;

/** The pond clearing's ellipse (collision.ts owns the walkable test; the ground here never changes). */
const CLEARING = { x: -45.5, z: -24, rx: 12.5, rz: 11 } as const;
const clearingE = (x: number, z: number) => Math.hypot((x - CLEARING.x) / CLEARING.rx, (z - CLEARING.z) / CLEARING.rz);

// ----------------------------------------------------------------- the ground

/** Top of the shelf (before it is blended into the island), with its water carved in. */
function shelfTop(x: number, z: number): number {
  let y = SHELF_Y + (SHELF.x - x) * SHELF_SLOPE;
  // The west cliff the high waterfall comes over.
  if (x < -58.4) y += Math.min(8.4, (-58.4 - x) * 3.4) * (1 - smooth((Math.abs(z - SHELF.z) - 6) / 3));
  const pool = Math.hypot(x - UPPER_POOL.x, z - UPPER_POOL.z);
  y -= 0.7 * (1 - smooth((pool - (UPPER_POOL.r - 0.7)) / 1.1));
  const stream = polyline(x, z, SHELF_STREAM).d;
  y -= 0.5 * (1 - smooth((stream - (SHELF_STREAM_HALF - 0.4)) / 0.7));
  const table = Math.hypot(x - TABLE_ROCK.x, z - TABLE_ROCK.z);
  y += TABLE_ROCK.h * (1 - smooth((table - (TABLE_ROCK.r - 0.3)) / 0.35));
  return y + 0.05 * Math.sin(x * 1.3 + z * 0.7) + 0.04 * Math.sin(x * 0.45 - z * 1.7);
}

/** Shelf ground at its top (for heights that must match the blended ground on the shelf). */
export const shelfGround = shelfTop;

/** Water surface of the shelf's stream and pools, a little under the banks. */
export function shelfWaterY(x: number): number {
  return SHELF_Y + (SHELF.x - x) * SHELF_SLOPE - 0.16;
}

const STAIRS_TOP_Y = shelfTop(STAIRS[0].x, STAIRS[0].z);
const STAIRS_LEN = Math.hypot(STAIRS[1].x - STAIRS[0].x, STAIRS[1].z - STAIRS[0].z);
const STAIRS_EDGE_T = (STAIRS_EDGE_X - STAIRS[0].x) / (STAIRS[1].x - STAIRS[0].x);
const CLIMB_LEN = lengthOf(CLIMB_PATH);
const CLIMB_TOP_Y = shelfTop(CLIMB_PATH[CLIMB_PATH.length - 1].x, CLIMB_PATH[CLIMB_PATH.length - 1].z);
/** Arc length where the climb path leaves the pond clearing (its ground starts rising there). */
const CLIMB_START_S = (() => {
  let s = 0;
  for (let i = 1; i < CLIMB_PATH.length; i++) {
    const a = CLIMB_PATH[i - 1];
    const b = CLIMB_PATH[i];
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    for (let k = 0; k <= 20; k++) {
      const t = k / 20;
      if (clearingE(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t) >= 0.97) return s + len * t;
    }
    s += len;
  }
  return 0;
})();

/**
 * Ground shaping for the Upper Stream, given the island's own height there.
 * `beachEdge` is the island's height where the stairs meet the beach, and
 * `climbBase` its height where the climb path leaves the pond clearing.
 */
export function upperGroundY(x: number, z: number, base: number, beachEdge: number, climbBase: number): number {
  if (x > -31.8 || x < -68 || z > 2.5 || z < -21) return base;
  // Never inside the pond clearing, and never on the walkable beach.
  const guard = smooth((clearingE(x, z) - 1.0) / 0.12) * (z > -2.4 ? 1 - smooth((x - STAIRS_EDGE_X + 0.4) / 0.4) : 1);
  if (guard <= 0) return base;
  let y = base;

  // The shelf and its cliffs.
  const e = Math.hypot((x - SHELF.x) / SHELF.rx, (z - SHELF.z) / SHELF.rz);
  const shelfW = (1 - smooth((e - 1) / 0.3)) * guard;
  if (shelfW > 0) y += (shelfTop(x, z) - y) * shelfW;

  // The plunge pool under the lower falls, and its brook to the lowland stream.
  const kPool = 1 - smooth((Math.hypot(x - PLUNGE_POOL.x, z - PLUNGE_POOL.z) - (PLUNGE_POOL.r - 0.4)) / 1.0);
  if (kPool > 0) y += (PLUNGE_POOL.y - 0.3 - y) * kPool * guard;
  const kBrook = 1 - smooth((polyline(x, z, BROOK).d - 0.3) / 0.6);
  if (kBrook > 0) y -= 0.3 * kBrook * guard;

  // The rock stairs: a straight ramp from the shelf to the beach's edge.
  const st = seg(x, z, STAIRS[0], STAIRS[1]);
  const stairsW = (1 - smooth((st.d - STAIRS_R) / 1.3)) * guard;
  if (stairsW > 0) {
    const t = Math.min(1, (st.t * STAIRS_LEN) / (STAIRS_EDGE_T * STAIRS_LEN));
    y += (STAIRS_TOP_Y + (beachEdge - STAIRS_TOP_Y) * t - y) * stairsW;
  }

  // The climbing path from the clearing.
  const cl = polyline(x, z, CLIMB_PATH);
  const climbW = (1 - smooth((cl.d - CLIMB_R) / 1.4)) * guard;
  if (climbW > 0) {
    const u = smooth((cl.s - CLIMB_START_S) / (CLIMB_LEN - CLIMB_START_S));
    y += (climbBase + (CLIMB_TOP_Y - climbBase) * u - y) * climbW;
  }
  return y;
}

/** Points the island needs for upperGroundY's blends (heights of the unshaped island there). */
export const UPPER_ANCHORS = {
  beachEdge: { x: STAIRS_EDGE_X, z: STAIRS[0].z + (STAIRS[1].z - STAIRS[0].z) * STAIRS_EDGE_T },
  climbBase: (() => {
    let acc = 0;
    for (let i = 1; i < CLIMB_PATH.length; i++) {
      const a = CLIMB_PATH[i - 1];
      const b = CLIMB_PATH[i];
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      if (acc + len >= CLIMB_START_S) {
        const t = (CLIMB_START_S - acc) / len;
        return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };
      }
      acc += len;
    }
    return CLIMB_PATH[0];
  })()
};

// ------------------------------------------------------------------ walking

/** On the shelf (its water is in UPPER_WATER, an obstacle). */
export function inShelf(x: number, z: number, margin: number): boolean {
  const rx = SHELF.rx - margin;
  const rz = SHELF.rz - margin;
  if (rx <= 0 || rz <= 0) return false;
  return Math.hypot((x - SHELF.x) / rx, (z - SHELF.z) / rz) <= 1;
}

export function inStairs(x: number, z: number, margin: number): boolean {
  return seg(x, z, STAIRS[0], STAIRS[1]).d <= STAIRS_R - margin;
}

export function inClimbPath(x: number, z: number, margin: number): boolean {
  return polyline(x, z, CLIMB_PATH).d <= CLIMB_R - margin;
}

/** The player is up on the Upper Stream (for the Day 9 arrival). */
export function onUpperStream(x: number, z: number): boolean {
  return inShelf(x, z, 0.6);
}

/**
 * The shelf's water as circles: the upper pool and a chain along the stream,
 * with a gap at the ford. Movement treats them as obstacles; a pipe may span
 * them but no post may stand in them.
 */
export const UPPER_WATER: ReadonlyArray<{ x: number; z: number; r: number }> = (() => {
  const out: Array<{ x: number; z: number; r: number }> = [{ x: UPPER_POOL.x, z: UPPER_POOL.z, r: UPPER_POOL.r }];
  for (let i = 1; i < SHELF_STREAM.length; i++) {
    const a = SHELF_STREAM[i - 1];
    const b = SHELF_STREAM[i];
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const n = Math.ceil(len / 0.6);
    for (let k = 0; k < n; k++) {
      const x = a.x + ((b.x - a.x) * k) / n;
      const z = a.z + ((b.z - a.z) * k) / n;
      // Circles taper beside the ford so the stepping stones stay clear.
      const r = Math.min(SHELF_STREAM_HALF, Math.abs(x - FORD.x) - FORD.half + 0.1);
      if (r < 0.12) continue;
      out.push({ x, z, r });
    }
  }
  return out;
})();

/** In the shelf's water (pool or stream, the ford's stepping stones included). */
export function isUpperWater(x: number, z: number, margin = 0): boolean {
  if (Math.hypot(x - UPPER_POOL.x, z - UPPER_POOL.z) < UPPER_POOL.r + margin) return true;
  return polyline(x, z, SHELF_STREAM).d < SHELF_STREAM_HALF + margin && inShelf(x, z, -1);
}

/** Decorative trees and bushes are skipped (never rerolled) on the shelf, its cliffs, the stairs, the path and the pools. */
export function clearForUpper(x: number, z: number): boolean {
  if (Math.hypot((x - SHELF.x) / SHELF.rx, (z - SHELF.z) / SHELF.rz) < 1.4) return true;
  if (seg(x, z, STAIRS[0], STAIRS[1]).d < STAIRS_R + 1.6) return true;
  if (polyline(x, z, CLIMB_PATH).d < CLIMB_R + 1.5) return true;
  if (Math.hypot(x - PLUNGE_POOL.x, z - PLUNGE_POOL.z) < PLUNGE_POOL.r + 2.2) return true;
  if (polyline(x, z, BROOK).d < 1.4) return true;
  return x < -58 && z > -14 && z < 1;
}

// --------------------------------------------------------------------- Kai

/** Where Kai waits on the shelf (Day 9), a step west of the table rock (clear of the bucket's pipe). */
export const KAI_UPPER = { x: -51.8, z: -10.0 } as const;

/** Kai's walk from camp to the shelf, the long way (he ignores collisions on authored routes). */
export const KAI_UPPER_ROUTE: readonly P[] = [
  { x: -12, z: 3 }, { x: -9, z: 0 }, { x: -9, z: -5 }, { x: -8, z: -20 }, { x: -20, z: -21.5 },
  { x: -27.4, z: -22 }, { x: -33.3, z: -22 }, { x: -40.5, z: -18.2 }, { x: -50.5, z: -18.9 },
  ...CLIMB_PATH, KAI_UPPER
];

/** Kai's walk home down the stairs (after the bucket works). */
export const KAI_STAIRS_ROUTE: readonly P[] = [
  KAI_UPPER, { x: -47.6, z: -8.7 }, { x: FORD.x, z: FORD.z }, { x: -45.8, z: -5.4 }, STAIRS[0], STAIRS[1], { x: -24, z: 1.6 }, { x: -15.4, z: 2.8 }
];

/** Where Kai's water tank stands at camp on the Day 10 morning (west of his lean-to, toward the stairs). */
export const KAI_TANK_SPOT = { x: -24.5, z: 1.6 } as const;

/**
 * The containers a pipe can fill, by building type (metres; rim and mouth are
 * above the container's ground). The tank is wide and knee-high, so a line from
 * the stairs can reach it at camp if the water is kept high.
 */
export const CONTAINER_SPECS = {
  bucket: { radius: 0.3, rim: 0.45, mouth: 0.24, capacity: 3 },
  tank: { radius: 0.8, rim: 0.8, mouth: 0.68, capacity: 12 },
  barrel: { radius: 0.4, rim: 0.95, mouth: 0.32, capacity: 12 }
} as const;

/** Fixed place ids the game points at in Chapter 3. */
export const CHAPTER_THREE_PLACES: ReadonlyArray<readonly [string, P]> = [
  [TANGLE.id, TANGLE_SPOT],
  ["climbPath", CLIMB_PATH[0]],
  ["stairsFoot", STAIRS[1]],
  ["highFalls", { x: UPPER_POOL.x + 1.6, z: UPPER_POOL.z - 1.6 }],
  ...INTAKE_SPOTS.map((i) => [i.id, { x: i.x, z: i.z }] as const)
];
