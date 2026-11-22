import type { ItemId } from "../types";

/**
 * Chapter 2 structures as data (EXPANSION_PLAN.md Milestones 2–3).
 *
 * A structure is a placed footprint plus parts that go into sockets. A socket
 * is open once the parts it rests on are in place; the player fills the open
 * socket nearest to them, so walking round the frame chooses the side. All
 * geometry is in the structure's local frame (x along its length, z across,
 * y up, metres) and is shared by the renderer, the focus code and the tests.
 *
 * The rain catcher's water is a deterministic model, not a fluid simulation:
 * rain runs to the lowest corner(s) of the canvas and pours just outside them.
 */

export type Vec3Tuple = readonly [number, number, number];

export type PartKind = "leg" | "bar" | "brace" | "shelf" | "post" | "canvas";

export interface Socket {
  id: string;
  kind: PartKind;
  /** What the part is made of. Canvas also needs rope (see pace.catcherCanvas). */
  uses: ItemId;
  /** Sockets that must already be filled. */
  needs: readonly string[];
  /** Braces only: which kind of face they stiffen. */
  face?: "long" | "short";
  /** The part runs from a to b (its middle is where the player puts it). */
  a: Vec3Tuple;
  b: Vec3Tuple;
}

// ------------------------------------------------------------------ rack

/** Rack footprint: 2 m long, 1 m wide; the top frame is the drying bar. */
export const RACK = { halfLength: 0.95, halfWidth: 0.45, top: 1.3, shelf: 0.68, footprint: 1.25 } as const;

const L = RACK.halfLength;
const W = RACK.halfWidth;
const T = RACK.top;
const S = RACK.shelf;

export const RACK_SOCKETS: readonly Socket[] = [
  // Legs stand at the four corners (long poles).
  { id: "leg1", kind: "leg", uses: "pole", needs: [], a: [-L, 0, -W], b: [-L, T + 0.12, -W] },
  { id: "leg2", kind: "leg", uses: "pole", needs: [], a: [L, 0, -W], b: [L, T + 0.12, -W] },
  { id: "leg3", kind: "leg", uses: "pole", needs: [], a: [L, 0, W], b: [L, T + 0.12, W] },
  { id: "leg4", kind: "leg", uses: "pole", needs: [], a: [-L, 0, W], b: [-L, T + 0.12, W] },
  // Top bars: the two long sides take long poles, the two short ends take short pieces.
  { id: "barN", kind: "bar", uses: "pole", needs: ["leg1", "leg2"], a: [-L - 0.12, T, -W], b: [L + 0.12, T, -W] },
  { id: "barS", kind: "bar", uses: "pole", needs: ["leg4", "leg3"], a: [-L - 0.12, T, W], b: [L + 0.12, T, W] },
  { id: "barW", kind: "bar", uses: "shortPole", needs: ["leg1", "leg4"], a: [-L, T + 0.05, -W - 0.1], b: [-L, T + 0.05, W + 0.1] },
  { id: "barE", kind: "bar", uses: "shortPole", needs: ["leg2", "leg3"], a: [L, T + 0.05, -W - 0.1], b: [L, T + 0.05, W + 0.1] },
  // Diagonal braces stop the frame racking: long faces and short faces each need one.
  { id: "braceN", kind: "brace", uses: "pole", face: "long", needs: ["barN"], a: [-L, 0.12, -W - 0.04], b: [L, T - 0.06, -W - 0.04] },
  { id: "braceS", kind: "brace", uses: "pole", face: "long", needs: ["barS"], a: [L, 0.12, W + 0.04], b: [-L, T - 0.06, W + 0.04] },
  { id: "braceW", kind: "brace", uses: "pole", face: "short", needs: ["barW"], a: [-L - 0.04, 0.12, W], b: [-L - 0.04, T - 0.06, -W] },
  { id: "braceE", kind: "brace", uses: "pole", face: "short", needs: ["barE"], a: [L + 0.04, 0.12, -W], b: [L + 0.04, T - 0.06, W] },
  // An optional lower shelf: two more long bars, two more drying places.
  { id: "shelfN", kind: "shelf", uses: "pole", needs: ["leg1", "leg2"], a: [-L - 0.1, S, -W], b: [L + 0.1, S, -W] },
  { id: "shelfS", kind: "shelf", uses: "pole", needs: ["leg4", "leg3"], a: [-L - 0.1, S, W], b: [L + 0.1, S, W] }
];

const RACK_FRAME = ["leg1", "leg2", "leg3", "leg4", "barN", "barS", "barW", "barE"];

/** All four legs and all four top bars are in. */
export function rackFrameComplete(parts: readonly string[]): boolean {
  return RACK_FRAME.every((id) => parts.includes(id));
}

/**
 * A frame only stops racking (leaning over like a parallelogram) in a
 * direction it is braced in: one brace on a long face and one on a short face.
 */
export function rackStable(parts: readonly string[]): boolean {
  if (!rackFrameComplete(parts)) return false;
  const braced = (face: "long" | "short") => RACK_SOCKETS.some((s) => s.face === face && parts.includes(s.id));
  return braced("long") && braced("short");
}

/** Which way an unstable frame sways (for the wobble): along its length, across it, or both. */
export function rackSway(parts: readonly string[]): { along: boolean; across: boolean } {
  if (!rackFrameComplete(parts)) return { along: false, across: false };
  const braced = (face: "long" | "short") => RACK_SOCKETS.some((s) => s.face === face && parts.includes(s.id));
  // A brace in a long face stops sway along the length; a brace in a short face stops it across.
  return { along: !braced("long"), across: !braced("short") };
}

/** Drying places: four on the top bars, one more per shelf bar. */
export function rackSlots(parts: readonly string[]): number {
  if (!rackFrameComplete(parts)) return 0;
  return 4 + (parts.includes("shelfN") ? 1 : 0) + (parts.includes("shelfS") ? 1 : 0);
}

// ------------------------------------------------------------- rain catcher

/** The canvas square's half size, and the four lashing heights on each post. */
export const CATCHER = { half: 1.2, footprint: 1.75 } as const;
export const LASH_HEIGHTS = [0.7, 1.1, 1.5, 1.9] as const;
/** A new catcher's canvas is tied level at the second notch. */
export const START_HEIGHTS: readonly number[] = [1, 1, 1, 1];

/** The barrel: its rim, the mouth a stream must land in, and how many cups it holds. */
export const BARREL = { rim: 0.95, mouth: 0.32, slack: 0.1, capacity: 12, radius: 0.4 } as const;

const H = CATCHER.half;
/** Corners in order: (-x,-z), (+x,-z), (+x,+z), (-x,+z). */
export const CATCHER_CORNERS: readonly (readonly [number, number])[] = [[-H, -H], [H, -H], [H, H], [-H, H]];

export const CATCHER_SOCKETS: readonly Socket[] = [
  ...CATCHER_CORNERS.map(([x, z], i): Socket => ({ id: `post${i + 1}`, kind: "post", uses: "pole", needs: [], a: [x, 0, z], b: [x, LASH_HEIGHTS[3] + 0.2, z] })),
  { id: "canvas", kind: "canvas", uses: "canvas", needs: ["post1", "post2", "post3", "post4"], a: [-H, 1.1, 0], b: [H, 1.1, 0] }
];

export function catcherBuilt(parts: readonly string[]): boolean {
  return CATCHER_SOCKETS.every((s) => parts.includes(s.id));
}

/** Where a corner's stream pours: just outside the corner, where the canvas hangs over. */
export function pourPoint(corner: number): { x: number; z: number } {
  const [x, z] = CATCHER_CORNERS[corner];
  return { x: x * 1.1, z: z * 1.1 };
}

export interface Stream {
  corner: number;
  /** Share of the rain that runs to this corner. */
  share: number;
  /** Local position where it pours, and the corner's height. */
  x: number;
  z: number;
  y: number;
  caught: boolean;
  /** The corner is below the barrel's rim: the water runs down the barrel's side. */
  tooLow: boolean;
}

/** What is wrong with a catcher, as the student sees it (null when every stream is caught). */
export type FlowProblem = "flat" | "tooLow" | "split" | "missed" | null;

export interface Flow {
  flat: boolean;
  streams: Stream[];
  /** Caught share of the rain: 1, 1/2, 1/3 or 0. */
  efficiency: number;
  problem: FlowProblem;
}

/**
 * Where the rain goes. `heights` are lashing notches (indexes into
 * LASH_HEIGHTS), one per corner; `barrel` is the barrel's middle in the
 * catcher's local frame, or null when there is none beside it.
 */
export function catcherFlow(heights: readonly number[], barrel: { x: number; z: number } | null): Flow {
  const ys = heights.map((h) => LASH_HEIGHTS[Math.max(0, Math.min(LASH_HEIGHTS.length - 1, Math.round(h)))]);
  const low = Math.min(...ys);
  const flat = ys.every((y) => y === low);
  if (flat) return { flat: true, streams: [], efficiency: 0, problem: "flat" };
  const outlets = ys.map((y, i) => ({ y, i })).filter((c) => c.y === low);
  const share = 1 / outlets.length;
  const streams = outlets.map(({ y, i }): Stream => {
    const p = pourPoint(i);
    const tooLow = y <= BARREL.rim;
    const under = barrel !== null && Math.hypot(p.x - barrel.x, p.z - barrel.z) <= BARREL.mouth + BARREL.slack;
    return { corner: i, share, x: p.x, z: p.z, y, caught: under && !tooLow, tooLow };
  });
  const efficiency = streams.reduce((sum, s) => sum + (s.caught ? s.share : 0), 0);
  const problem: FlowProblem = streams.some((s) => s.tooLow) ? "tooLow" : efficiency >= 0.999 ? null : streams.length > 1 ? "split" : "missed";
  return { flat: false, streams, efficiency, problem };
}

/** The sentence that is true of a catcher at the test ("How is it?"). */
export function flowAnswer(flow: Flow): "flowing" | "tooLow" | "notWork" {
  if (flow.problem === null) return "flowing";
  return flow.problem === "tooLow" ? "tooLow" : "notWork";
}

/** Seconds of full rain per cup the catcher fills, before its efficiency. */
export const SECONDS_PER_CUP = 6;

/** New barrel water after dt seconds of rain (rainK 0..1) at an efficiency; never above capacity. */
export function fillBarrel(water: number, dt: number, rainK: number, efficiency: number): number {
  return Math.min(BARREL.capacity, water + (Math.max(0, dt) * Math.max(0, rainK) * Math.max(0, efficiency)) / SECONDS_PER_CUP);
}

// ------------------------------------------------------------------ drying

/** Seconds left on each hanging fish after dt of live play (0 = dried, waiting to be taken). */
export function dryFish(timers: readonly number[], dt: number): number[] {
  return timers.map((left) => Math.max(0, left - Math.max(0, dt)));
}

/** World point of a structure's local point. */
export function toWorld(b: { x: number; z: number; rot: number }, lx: number, lz: number): { x: number; z: number } {
  const c = Math.cos(b.rot);
  const s = Math.sin(b.rot);
  return { x: b.x + lx * c + lz * s, z: b.z - lx * s + lz * c };
}

/** A world point in a structure's local frame. */
export function toLocal(b: { x: number; z: number; rot: number }, x: number, z: number): { x: number; z: number } {
  const dx = x - b.x;
  const dz = z - b.z;
  const c = Math.cos(b.rot);
  const s = Math.sin(b.rot);
  return { x: dx * c - dz * s, z: dx * s + dz * c };
}

/** The open sockets: not yet filled and resting on parts that are. */
export function openSockets(sockets: readonly Socket[], parts: readonly string[]): Socket[] {
  return sockets.filter((s) => !parts.includes(s.id) && s.needs.every((n) => parts.includes(n)));
}

/** The middle of a socket's part, in local coordinates. */
export function socketMiddle(s: Socket): { x: number; y: number; z: number } {
  return { x: (s.a[0] + s.b[0]) / 2, y: (s.a[1] + s.b[1]) / 2, z: (s.a[2] + s.b[2]) / 2 };
}
