import type { NodeDef } from "./island";

/**
 * Chapter 2 geography (EXPANSION_PLAN.md Milestones 1–3): Shipwreck Cove,
 * east of the beach through a tidal passage in the east headland, and the
 * Bamboo Grove, on a new trail branching east off the forest.
 *
 * Kept free of island.ts imports (island.ts reads the cove's ground shaping
 * and salvage nodes from here). Coordinates: +x east, +z south (the sea).
 */

// ---------------------------------------------------------------- the cove

/** The cove's sandy basin: an ellipse, clipped by the waterline and its cliffs. */
export const COVE = { x: 64, z: 7.5, rx: 11.5, rz: 13, north: -4.2 } as const;

/**
 * The tidal passage from the beach's east end through the headland. Flooded
 * in Chapter 1 (the sea covers it); walkable once `coveOpen` (low tide, Day 6).
 */
export const COVE_PASSAGE: ReadonlyArray<{ x: number; z: number }> = [
  { x: 33.2, z: 9.6 },
  { x: 41, z: 9.9 },
  { x: 48.5, z: 9.8 },
  { x: 54.5, z: 9.1 }
];
export const COVE_PASSAGE_R = 1.6;
/** Where the sea covers the passage in Chapter 1 (x range, z middle and half width). */
export const TIDE_WATER = { x0: 36.4, x1: 53.2, z: 9.75, half: 2.3 } as const;

export const COVE_SIGN = { id: "coveSign", x: 32.2, z: 6.6 } as const;
export const CAMP_SIGN = { id: "campSign", x: 56.4, z: 6.0 } as const;
/** The half-buried cove crate ("Open the box."). */
export const COVE_CRATE = { id: "coveCrate", x: 58.9, z: 2.4, rot: 0.45, half: 0.55 } as const;
/** The heavy sea chest that becomes the storage box (carried with Kai). */
export const SEA_CHEST = { id: "seaChest", x: 66.8, z: 10.2, rot: -0.3 } as const;
/** The empty barrel for the rain catcher (carried alone, Day 8). */
export const COVE_BARREL = { id: "coveBarrel", x: 71.6, z: 7.8, rot: 0.2 } as const;
/** A broken hull section lying on its side (an oriented box the player walks around). */
export const COVE_HULL = { x: 70.2, z: 0.6, rot: 0.32, hw: 4.6, hd: 1.7 } as const;
/** The snapped mast and its torn sail across the west of the cove. */
export const COVE_MAST = { x: 60.6, z: -1.6, rot: -0.38, length: 8.5 } as const;
/** Where Kai waits in the cove on Day 6. */
export const KAI_COVE = { x: 61.6, z: 7.2 } as const;

/** Kai's walk from camp to the cove (he ignores collisions on authored routes). */
export const KAI_COVE_ROUTE: ReadonlyArray<{ x: number; z: number }> = [
  { x: 19.5, z: 10.4 },
  { x: 30.5, z: 9.4 },
  ...COVE_PASSAGE,
  KAI_COVE
];

/** Rocks closing the cove (north and east walls) and lining the passage: x, z, radius, height. */
export const COVE_ROCKS: ReadonlyArray<{ x: number; z: number; r: number; h: number }> = [
  // North wall, west to east.
  { x: 53.5, z: -6.4, r: 3.4, h: 5.2 },
  { x: 58.6, z: -8.2, r: 3.8, h: 6.4 },
  { x: 64.2, z: -8.6, r: 4.2, h: 7.2 },
  { x: 70.4, z: -8.0, r: 3.9, h: 6.6 },
  { x: 75.8, z: -6.4, r: 3.6, h: 5.8 },
  // East wall, running into the sea.
  { x: 79.6, z: -1.6, r: 3.5, h: 6.0 },
  { x: 80.6, z: 4.6, r: 3.3, h: 5.4 },
  { x: 80.4, z: 10.8, r: 3.2, h: 4.8 },
  { x: 79.4, z: 16.6, r: 2.9, h: 3.8 },
  { x: 77.6, z: 21.4, r: 2.4, h: 2.6 },
  // The passage: low rocks on both sides.
  { x: 39.6, z: 6.4, r: 1.5, h: 1.5 },
  { x: 44.2, z: 12.9, r: 1.4, h: 1.3 },
  { x: 51.6, z: 6.1, r: 1.6, h: 1.8 },
  { x: 52.4, z: 13.1, r: 1.5, h: 1.4 }
];

/** The cove's walkable sand (before obstacles), given the island's waterline. */
export function inCove(x: number, z: number, margin: number, maxZ: (x: number) => number): boolean {
  const rx = COVE.rx - margin;
  const rz = COVE.rz - margin;
  if (rx <= 0 || rz <= 0) return false;
  const dx = (x - COVE.x) / rx;
  const dz = (z - COVE.z) / rz;
  return dx * dx + dz * dz <= 1 && z >= COVE.north + margin && z <= maxZ(x) - margin;
}

/** The passage corridor (a chain of capsules). */
export function inCovePassage(x: number, z: number, margin: number): boolean {
  for (let i = 1; i < COVE_PASSAGE.length; i++) {
    if (segmentDistance(x, z, COVE_PASSAGE[i - 1], COVE_PASSAGE[i]) <= COVE_PASSAGE_R - margin) return true;
  }
  return false;
}

/** The player has arrived in the cove proper (for the Day 6 step). */
export function reachedCoveAt(x: number, z: number): boolean {
  return x > 56.5 && inCove(x, z, 0, () => 99);
}

/**
 * Ground shaping east of the old beach (nothing could stand here before, so
 * saved placements never move): the cove's back rises into its north cliffs,
 * and the east end climbs to the rocks that close the island.
 */
export function coveGroundY(x: number, z: number, y: number): number {
  if (x < 50) return y;
  const k = Math.min(1, (x - 50) / 4);
  let lift = 0;
  if (z < -3.6) lift += Math.pow(-3.6 - z, 1.25) * 0.85;
  if (x > 75.5) lift += (x - 75.5) * 0.7 * Math.max(0, Math.min(1, (18 - z) / 6));
  return y + lift * k;
}

// ---------------------------------------------------------- the bamboo grove

/** The grove's clearing. */
export const GROVE = { x: 40.2, z: -24.2, rx: 9.4, rz: 8 } as const;
/** The trail from the forest centre east to the grove; the thicket closes it at the gate. */
export const GROVE_TRAIL: ReadonlyArray<{ x: number; z: number }> = [
  { x: 5.6, z: -21.6 },
  { x: 15.8, z: -23.2 },
  { x: 26.6, z: -23.6 },
  { x: 32.6, z: -24.0 }
];
export const GROVE_TRAIL_R = 1.6;
/** Beyond this x the trail is behind the thicket (closed until `groveOpen`). */
export const GROVE_GATE_X = 27.2;
export const GROVE_GATE = { id: "groveGate", x: 28.4, z: -23.6 } as const;
export const GROVE_SIGN = { id: "groveSign", x: 23.2, z: -20.9 } as const;

/** Inside the clearing (before obstacles). */
export function inGrove(x: number, z: number, margin: number): boolean {
  const rx = GROVE.rx - margin;
  const rz = GROVE.rz - margin;
  if (rx <= 0 || rz <= 0) return false;
  const dx = (x - GROVE.x) / rx;
  const dz = (z - GROVE.z) / rz;
  return dx * dx + dz * dz <= 1;
}

/** On the closed part of the trail, between the thicket and the clearing. */
export function inGroveTrail(x: number, z: number, margin: number): boolean {
  if (x < GROVE_GATE_X - 0.4) return false;
  const last = GROVE_TRAIL.length - 1;
  return segmentDistance(x, z, GROVE_TRAIL[last - 1], GROVE_TRAIL[last]) <= GROVE_TRAIL_R - margin;
}

/** Decorative forest trees are skipped (never rerolled) along the new trail and in the grove. */
export function clearForGrove(x: number, z: number): boolean {
  for (let i = 1; i < GROVE_TRAIL.length; i++) {
    if (segmentDistance(x, z, GROVE_TRAIL[i - 1], GROVE_TRAIL[i]) < 2.7) return true;
  }
  return inGrove(x, z, -2);
}

// --------------------------------------------------------------- salvage

/** Salvage in the cove and bamboo in the grove, appended to the island's NODES. */
export const CHAPTER_TWO_NODES: NodeDef[] = [
  { id: "canvas-1", kind: "canvas", x: 62.4, z: -0.3, rot: 0.6 },
  { id: "canvas-2", kind: "canvas", x: 73.6, z: 4.4, rot: 2.2 },
  { id: "rope-1", kind: "rope", x: 64.8, z: 2.6, rot: 1.1 },
  { id: "rope-2", kind: "rope", x: 69.6, z: 13.6, rot: 0.3 },
  { id: "metal-4", kind: "metal", x: 75.2, z: 9.4, rot: 1.7 },
  { id: "metal-5", kind: "metal", x: 66.4, z: -2.0, rot: 0.4 },
  { id: "wood-7", kind: "wood", x: 57.8, z: 12.6, rot: 0.9 },
  { id: "wood-8", kind: "wood", x: 74.4, z: 14.2, rot: 2.6 },
  // Bamboo stalks round the grove's edge (cut with the axe; they grow back).
  { id: "bamboo-1", kind: "bamboo", x: 34.0, z: -27.6, rot: 0.2 },
  { id: "bamboo-2", kind: "bamboo", x: 37.4, z: -30.6, rot: 1.4 },
  { id: "bamboo-3", kind: "bamboo", x: 43.6, z: -30.2, rot: 2.5 },
  { id: "bamboo-4", kind: "bamboo", x: 47.6, z: -25.8, rot: 0.8 },
  { id: "bamboo-5", kind: "bamboo", x: 46.0, z: -19.4, rot: 1.9 },
  { id: "bamboo-6", kind: "bamboo", x: 39.6, z: -17.8, rot: 2.9 }
];

/** Fixed place ids the game points at in Chapter 2. */
export const CHAPTER_TWO_PLACES: ReadonlyArray<readonly [string, { x: number; z: number }]> = [
  [COVE_SIGN.id, COVE_SIGN],
  [CAMP_SIGN.id, CAMP_SIGN],
  [COVE_CRATE.id, COVE_CRATE],
  [SEA_CHEST.id, SEA_CHEST],
  [COVE_BARREL.id, COVE_BARREL],
  [GROVE_GATE.id, GROVE_GATE],
  [GROVE_SIGN.id, GROVE_SIGN],
  // The cove's mouth on the beach side, for "I need a box." from the beach.
  ["covePassage", COVE_PASSAGE[0]]
];

/** Distance from (x, z) to segment a–b. */
export function segmentDistance(x: number, z: number, a: { x: number; z: number }, b: { x: number; z: number }): number {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const l2 = dx * dx + dz * dz || 1;
  const u = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / l2));
  return Math.hypot(a.x + dx * u - x, a.z + dz * u - z);
}
