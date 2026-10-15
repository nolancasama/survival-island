import type { NodeKind } from "../types";
import { cliffGroundY, isCaveInterior, METAL_NODES } from "./phase3";

/**
 * The handcrafted island (Phase 1: the beach). +x is east, +z is south toward
 * the sea. Heights and the shoreline are functions so the ground mesh, the
 * player, placement checks and object positions all agree.
 */

export const SEA_Y = -0.45;

/** Where dry sand meets the sea (z of the waterline) at a given x. */
export function shoreZ(x: number): number {
  return 18 + 1.8 * Math.sin(x * 0.11 + 0.6) + 0.9 * Math.sin(x * 0.27 + 2.1);
}

const smooth = (t: number) => {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
};

/** Phase 1 beach height. Keep this exact: saved placements rely on it. */
function beachGroundY(x: number, z: number): number {
  const d = z - shoreZ(x);
  const inland = 0.4;
  let y: number;
  if (d < 0) y = inland + (SEA_Y - inland) * smooth((d + 8) / 8);
  else y = Math.max(-3, SEA_Y - d * 0.22);
  const dunes = 0.16 * Math.sin(x * 0.23 + z * 0.11) + 0.1 * Math.sin(x * 0.07 - z * 0.31 + 1.3);
  y += dunes * (1 - smooth((d + 10) / 6));
  if (z < 1) y += Math.pow(1 - z, 1.3) * 0.05;
  return y;
}

/** Where the cave opening stands, at the north end of the path past CAVE_SIGN (closed until Phase 3). */
export const CAVE_MOUTH = { x: 22, z: -43.1 };

/**
 * Ground height across the island. The Phase 1 beach (z >= BOUNDS.z0) is
 * untouched; north of it the forest rises gently before the clifftop climb.
 */
export function groundY(x: number, z: number): number {
  if (isCaveInterior(x, z)) return 0;
  if (z >= -2.4) return beachGroundY(x, z);

  const north = -2.4 - z;
  let y = beachGroundY(x, -2.4) + north * 0.047;
  y += (0.18 * Math.sin(x * 0.17 + z * 0.12) + 0.11 * Math.sin(x * 0.31 - z * 0.09)) * smooth(north / 5);

  // The pond and stream sit in shallow basins, while the closed northern
  // country climbs steeply enough to carry the signal tower at y=25.
  const pondD = Math.hypot(x + 45.5, z + 24);
  y -= 0.75 * (1 - smooth((pondD - 2.8) / 2.2));
  const streamD = Math.abs(x + 30.5);
  if (z < -3 && z > -44) y -= 0.65 * (1 - smooth((streamD - 0.7) / 1.5));
  if (z < -42) {
    // The cave mouth sits in a level notch cut into the climb, so the ramp
    // never rises in front of the opening; the hill resumes behind the rock face.
    const notch = (1 - smooth((Math.abs(x - CAVE_MOUTH.x) - 2.4) / 1.4)) * (1 - smooth((-44 - z) / 1.2));
    y += (-42 - z) * 0.58 * (1 - notch);
  }
  return cliffGroundY(x, z, y);
}

/** Walkable area of the Phase 1 beach. */
export const BOUNDS = { x0: -35, x1: 35, z0: -2.4, wade: 1.1 };

export function maxZ(x: number): number {
  return shoreZ(x) + BOUNDS.wade;
}

export interface NodeDef {
  id: string;
  kind: NodeKind;
  x: number;
  z: number;
  rot: number;
}

export const RESPAWN_S: Record<NodeKind, number> = { wood: 60, stone: 75, coconut: 50, leaves: 60, tree: 90, metal: 75 };

/** Driftwood lies a few metres above the waterline. */
const driftwood = (id: string, x: number, rot: number, inset = 3.6): NodeDef => ({ id, kind: "wood", x, z: shoreZ(x) - inset, rot });

export const NODES: NodeDef[] = [
  driftwood("wood-1", -29, 0.4),
  driftwood("wood-2", -20.5, -0.7),
  driftwood("wood-3", -11.5, 0.2, 4.4),
  driftwood("wood-4", -1.5, 1.1),
  driftwood("wood-5", 7.5, -0.3, 4.2),
  { id: "wood-6", kind: "wood", x: -16.5, z: 4.6, rot: 2.2 },
  { id: "stone-1", kind: "stone", x: -31, z: 5, rot: 0.3 },
  { id: "stone-2", kind: "stone", x: -23, z: -0.4, rot: 1.2 },
  { id: "stone-3", kind: "stone", x: -7.5, z: 4.8, rot: 2.6 },
  { id: "stone-4", kind: "stone", x: 2.5, z: -0.6, rot: 0.8 },
  { id: "stone-5", kind: "stone", x: 19, z: 2.2, rot: 1.9 },
  { id: "stone-6", kind: "stone", x: 30, z: 8, rot: 0.1 },
  { id: "coconut-1", kind: "coconut", x: 6.3, z: 9.3, rot: 0 },
  { id: "coconut-2", kind: "coconut", x: 4.2, z: 9.9, rot: 1 },
  { id: "coconut-3", kind: "coconut", x: -5.1, z: 13.1, rot: 2 },
  { id: "coconut-4", kind: "coconut", x: -19, z: 5.3, rot: 0.5 },
  { id: "coconut-5", kind: "coconut", x: -27, z: 11.3, rot: 1.5 },
  { id: "coconut-6", kind: "coconut", x: 16.9, z: 5.2, rot: 2.5 },

  // Forest resources. Paths remain open through the centre and to the bridge.
  { id: "leaves-1", kind: "leaves", x: -17, z: -8, rot: 0.2 },
  { id: "leaves-2", kind: "leaves", x: -4, z: -9, rot: 1.1 },
  { id: "leaves-3", kind: "leaves", x: 8, z: -7, rot: 2.3 },
  { id: "leaves-4", kind: "leaves", x: 20, z: -10, rot: 0.7 },
  { id: "leaves-5", kind: "leaves", x: -22, z: -16, rot: 1.8 },
  { id: "leaves-6", kind: "leaves", x: -10, z: -18, rot: 2.8 },
  { id: "leaves-7", kind: "leaves", x: 4, z: -17, rot: 0.4 },
  { id: "leaves-8", kind: "leaves", x: 18, z: -21, rot: 1.4 },
  { id: "leaves-9", kind: "leaves", x: -18, z: -30, rot: 2.1 },
  { id: "leaves-10", kind: "leaves", x: 12, z: -31, rot: 0.9 },
  { id: "tree-1", kind: "tree", x: -21, z: -10, rot: 0.5 },
  { id: "tree-2", kind: "tree", x: -2, z: -12, rot: 1.7 },
  { id: "tree-3", kind: "tree", x: 14, z: -11, rot: 2.4 },
  { id: "tree-4", kind: "tree", x: -18, z: -22, rot: 0.1 },
  { id: "tree-5", kind: "tree", x: -7, z: -25, rot: 2.9 },
  { id: "tree-6", kind: "tree", x: 13, z: -25, rot: 1.2 },
  { id: "tree-7", kind: "tree", x: -20, z: -36, rot: 2.2 },
  { id: "tree-8", kind: "tree", x: 17, z: -36, rot: 0.8 },
  { id: "log-1", kind: "wood", x: -13, z: -14, rot: 0.3 },
  { id: "log-2", kind: "wood", x: 8, z: -20, rot: 1.5 },
  { id: "log-3", kind: "wood", x: -15, z: -34, rot: 2.4 },
  { id: "log-4", kind: "wood", x: 22, z: -29, rot: 0.9 },

  // Pond-clearing resources (three leaf bushes and three stones).
  { id: "leaves-11", kind: "leaves", x: -51, z: -19, rot: 0.6 },
  { id: "leaves-12", kind: "leaves", x: -52, z: -27, rot: 1.9 },
  { id: "leaves-13", kind: "leaves", x: -40, z: -30, rot: 2.7 },
  { id: "stone-7", kind: "stone", x: -50, z: -20.5, rot: 0.5 },
  { id: "stone-8", kind: "stone", x: -51.5, z: -24.5, rot: 1.6 },
  { id: "stone-9", kind: "stone", x: -48, z: -30, rot: 2.4 },
  ...METAL_NODES
];

export interface Palm {
  x: number;
  z: number;
  height: number;
  lean: number;
  /** Direction of the lean (radians around y). */
  dir: number;
  coconuts: boolean;
}

export const PALMS: Palm[] = [
  { x: 5, z: 8.5, height: 6.2, lean: 0.25, dir: 2.6, coconuts: true },
  { x: -6, z: 12, height: 5.6, lean: 0.32, dir: 3.0, coconuts: true },
  { x: -20, z: 4, height: 6.6, lean: 0.2, dir: 2.2, coconuts: true },
  { x: -28, z: 10, height: 5.8, lean: 0.3, dir: 3.4, coconuts: true },
  { x: 16, z: 4, height: 6.4, lean: 0.22, dir: 2.8, coconuts: true },
  { x: 27.5, z: 5.5, height: 5.4, lean: 0.35, dir: 3.6, coconuts: false },
  { x: -33, z: 3, height: 6.0, lean: 0.18, dir: 2.0, coconuts: false },
  { x: -1, z: 0.4, height: 6.8, lean: 0.15, dir: 2.9, coconuts: false },
  { x: 11.5, z: -0.6, height: 5.9, lean: 0.24, dir: 3.3, coconuts: false },
  { x: -13.5, z: 9.5, height: 5.2, lean: 0.38, dir: 2.5, coconuts: false }
];

export interface Boulder {
  x: number;
  z: number;
  r: number;
  h: number;
  rot: number;
}

export const BOULDERS: Boulder[] = [
  // West headland
  { x: -36.5, z: 4, r: 2.4, h: 2.6, rot: 0.2 },
  { x: -37, z: 9, r: 2.8, h: 3.2, rot: 1.1 },
  { x: -36, z: 14, r: 2.2, h: 2.2, rot: 2.3 },
  { x: -35.5, z: 18.5, r: 1.8, h: 1.6, rot: 0.7 },
  { x: -34.5, z: -1, r: 2, h: 2.4, rot: 1.9 },
  // East, beyond the wreck
  { x: 36.5, z: 3, r: 2.5, h: 2.8, rot: 0.4 },
  { x: 37, z: 8.5, r: 2.2, h: 2.2, rot: 1.4 },
  { x: 36, z: 13.5, r: 2.6, h: 2.4, rot: 2.8 },
  { x: 35.5, z: -1.5, r: 2.1, h: 2.6, rot: 0.9 },
  // Scattered on the beach
  { x: -24.5, z: 13.5, r: 1.1, h: 0.9, rot: 0.5 },
  { x: -9.5, z: 8.2, r: 0.8, h: 0.7, rot: 1.6 },
  { x: 22, z: 7.5, r: 1.2, h: 1.1, rot: 2.1 },
  { x: -15, z: 15.6, r: 0.9, h: 0.6, rot: 0.2 },
  { x: 13, z: 10.5, r: 0.7, h: 0.55, rot: 2.9 }
];

/** The wreck: an oriented box the player walks around. */
export const WRECK = { x: 25.5, z: 14.5, rot: -0.55, hw: 5.2, hd: 1.9 };

export const CRATE = { id: "crate", x: 17.2, z: 12.4, rot: 0.35, half: 0.5 };

export const KAI_HOME = { x: -13, z: 1.6, yaw: 0.35 };
/** Kai's lean-to beside him. */
export const LEAN_TO = { x: -16, z: 0.2, r: 1.5 };

/** Gap in the tree line toward the forest (Phase 2), closed by a fallen palm. */
export const FOREST_GAP = { x: -9, z: -2.2, sign: { id: "sign", x: -7.2, z: -1.2 } };

/** Phase 2 place anchors. Rotations use the usual y-axis radians. */
export const FALLEN_TREE = { id: "fallenTree", x: -9, z: -3.6 };
export const BRIDGE = { id: "bridge", x: -30.25, z: -22, rot: 0, beachSide: { x: -27.2, z: -22 } };
export const STREAM = { x: -30.5, z0: -44, z1: -3, width: 4 };
export const POND = { x: -45.5, z: -24, r: 4.2 };
export const WATER_SPOTS = [
  { id: "water-1", x: -40.8, z: -24 },
  { id: "water-2", x: -45.5, z: -18.9 },
  { id: "water-3", x: -49.1, z: -27.8 }
];
export const FISH_SPOTS = [
  { id: "fish-1", x: -49.5, z: -28.1, yaw: Math.PI * 0.25 },
  { id: "fish-2", x: -40.8, z: -22, yaw: -Math.PI * 0.5 }
];
export const CAVE_SIGN = { id: "caveSign", x: 21, z: -40 };
export const CLIFF_SIGN = { id: "cliffSign", x: 6, z: -40 };

export const SPAWN = { x: 10.5, z: 13, yaw: -2.4 };

/** Small offset in front of an object where the player stands to use it. */
export const INTERACT_RANGE = 2.1;

export const NODE_BY_ID = new Map(NODES.map((n) => [n.id, n]));
