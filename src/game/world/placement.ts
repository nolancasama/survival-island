import type { BuildingId } from "../types";
import { BRIDGE, FALLEN_TREE, POND, STREAM, shoreZ } from "./island";
import { CLOSED_GATES, isWalkable, overlaps, type Obstacles, type WorldGates } from "./collision";
import { isUpperWater } from "./chapter3";

/**
 * Building placement: a grid-snapped preview in front of the player, checked
 * against water, the beach edge and everything already standing. Kept simple
 * on purpose: rotate in quarter turns, place on a 1 m grid.
 */

export const GRID = 1;
/** How far in front of the player the preview sits. */
export const PLACE_AHEAD = 3.2;

export const FOOTPRINT: Record<BuildingId, number> = {
  campfire: 0.8,
  shelter: 1.8,
  storage: 0.7,
  cooking: 0.9,
  fence: 0.6,
  // Chapter 2: the drying rack (2 × 1 m), the rain catcher (2.4 m square) and the barrel.
  rack: 1.25,
  catcher: 1.75,
  barrel: 0.45,
  // Chapter 3: Kai's bucket and the camp's water tank (logic: world/chapter3.ts CONTAINER_SPECS).
  bucket: 0.32,
  tank: 0.85
};

export interface PlacedBuilding {
  id: string;
  type: BuildingId;
  x: number;
  z: number;
  rot: number;
  lit?: boolean;
  /** Shelter only: false while it is a placed frame, true after "Build a shelter." */
  built?: boolean;
  /** Rack and rain catcher: the sockets filled so far (see logic/structures.ts). */
  parts?: string[];
  /** Rain catcher: the lashing notch of each corner post. */
  heights?: number[];
  /** Barrel: cups of collected rain water. */
  water?: number;
  /** Rack: seconds left on each hanging fish (0 = dried). */
  fish?: number[];
}

/** Structures are open frames: their solid parts are rects (the rack) and posts (the catcher). */
export function buildingObstacles(buildings: readonly PlacedBuilding[]): Obstacles {
  const circles: Obstacles["circles"] = [];
  const rects: Obstacles["rects"] = [];
  for (const b of buildings) {
    if (b.type === "rack") {
      rects.push({ x: b.x, z: b.z, hw: 1.0, hd: 0.5, rot: b.rot });
    } else if (b.type === "catcher") {
      // Only the four posts stop you; the barrel stands at a corner, under the canvas edge.
      const c = Math.cos(b.rot);
      const s = Math.sin(b.rot);
      for (const [lx, lz] of [[-1.2, -1.2], [1.2, -1.2], [1.2, 1.2], [-1.2, 1.2]]) {
        circles.push({ x: b.x + lx * c + lz * s, z: b.z - lx * s + lz * c, r: 0.14 });
      }
    } else {
      circles.push({ x: b.x, z: b.z, r: FOOTPRINT[b.type] * 0.85 });
    }
  }
  return { circles, rects };
}

export type PlaceProblem = "water" | "edge" | "blocked";

export function snap(v: number): number {
  return Math.round(v / GRID) * GRID;
}

/**
 * Snapped preview position ahead of the player. `yaw` is the direction to
 * look ahead in: the game passes the camera's forward direction, so the
 * preview always appears above the player on screen (never hidden under the
 * panels at the bottom when the player faces the camera).
 */
export function previewSpot(px: number, pz: number, yaw: number): { x: number; z: number } {
  return { x: snap(px + Math.sin(yaw) * PLACE_AHEAD), z: snap(pz + Math.cos(yaw) * PLACE_AHEAD) };
}

/** Ground direction the camera looks along (as a yaw for previewSpot). */
export function cameraForwardYaw(cameraYaw: number): number {
  return cameraYaw + Math.PI;
}


/**
 * Why a building cannot go here, or null if it can.
 * `keepClear` holds things that must stay reachable (resource nodes, Kai, the player).
 */
export function placeProblem(
  type: BuildingId,
  x: number,
  z: number,
  obstacles: Obstacles[],
  keepClear: ReadonlyArray<{ x: number; z: number; r: number }>,
  gates: WorldGates = CLOSED_GATES
): PlaceProblem | null {
  const r = FOOTPRINT[type];
  if (z + r > shoreZ(x) - 1.2) return "water";
  if (Math.hypot(x - POND.x, z - POND.z) < POND.r + r + 0.25) return "water";
  if (Math.abs(x - STREAM.x) < STREAM.width * 0.5 + r && z > STREAM.z0 - r && z < STREAM.z1 + r) return "water";
  if (isUpperWater(x, z, r)) return "water";

  // Keep both gates and their approaches unobstructed in every state.
  if (Math.abs(x - FALLEN_TREE.x) < 2.5 + r && Math.abs(z - FALLEN_TREE.z) < 2.2 + r) return "blocked";
  if (Math.abs(x - BRIDGE.x) < 4 + r && Math.abs(z - BRIDGE.z) < 2.2 + r) return "blocked";
  if (!isWalkable(x, z, gates, r + 0.4)) return "edge";
  if (overlaps(x, z, r, obstacles)) return "blocked";
  if (keepClear.some((c) => Math.hypot(c.x - x, c.z - z) < c.r + r)) return "blocked";
  return null;
}
