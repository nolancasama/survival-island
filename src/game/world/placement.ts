import type { BuildingId } from "../types";
import { BOUNDS, shoreZ } from "./island";
import { overlaps, type Obstacles } from "./collision";

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
  fence: 0.6
};

export interface PlacedBuilding {
  id: string;
  type: BuildingId;
  x: number;
  z: number;
  rot: number;
  lit?: boolean;
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

export function buildingObstacles(buildings: readonly PlacedBuilding[]): Obstacles {
  return { circles: buildings.map((b) => ({ x: b.x, z: b.z, r: FOOTPRINT[b.type] * 0.85 })), rects: [] };
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
  keepClear: ReadonlyArray<{ x: number; z: number; r: number }>
): PlaceProblem | null {
  const r = FOOTPRINT[type];
  if (z + r > shoreZ(x) - 1.2) return "water";
  if (x - r < BOUNDS.x0 + 0.5 || x + r > BOUNDS.x1 - 0.5 || z - r < BOUNDS.z0 + 0.4) return "edge";
  if (overlaps(x, z, r, obstacles)) return "blocked";
  if (keepClear.some((c) => Math.hypot(c.x - x, c.z - z) < c.r + r)) return "blocked";
  return null;
}
