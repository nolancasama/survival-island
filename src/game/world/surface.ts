import { BRIDGE, groundY } from "./island";

/** Shared dimensions of the nine 0.48 m planks and their bank approaches. */
export const BRIDGE_SURFACE = {
  halfLength: 2.16,
  halfWidth: 0.75,
  approachEnd: 3.85,
  plankY: 0.24,
  plankTop: 0.1475
};

export const BRIDGE_BASE_Y = Math.max(groundY(BRIDGE.x - 2.3, BRIDGE.z), groundY(BRIDGE.x + 2.3, BRIDGE.z)) + 0.05;
export const BRIDGE_DECK_Y = BRIDGE_BASE_Y + BRIDGE_SURFACE.plankY + BRIDGE_SURFACE.plankTop;

/** Feet/shadows use the built deck; authored terrain and saved placements stay unchanged. */
export function walkingSurfaceY(x: number, z: number, bridgeBuilt: boolean): number {
  const terrain = groundY(x, z);
  if (!bridgeBuilt || Math.abs(z - BRIDGE.z) > BRIDGE_SURFACE.halfWidth) return terrain;
  const along = Math.abs(x - BRIDGE.x);
  if (along > BRIDGE_SURFACE.approachEnd) return terrain;
  if (along <= BRIDGE_SURFACE.halfLength) return BRIDGE_DECK_Y;
  const t = (along - BRIDGE_SURFACE.halfLength) / (BRIDGE_SURFACE.approachEnd - BRIDGE_SURFACE.halfLength);
  const blend = t * t * (3 - 2 * t);
  return BRIDGE_DECK_Y + (terrain - BRIDGE_DECK_Y) * blend;
}
