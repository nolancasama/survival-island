import { isWalkable, PLAYER_R, type WorldGates } from "./collision";
import { INTERACT_RANGE } from "./island";

/**
 * True when the player can stand within interaction range of a target with the
 * current world gates. Targets themselves often stand off the walkable ground
 * (the fallen palm in the gap, a tree trunk, the broken bridge), so this asks
 * whether any walkable spot near the target exists, not whether the target is.
 */
export function isReachable(x: number, z: number, gates: WorldGates, range = INTERACT_RANGE - 0.3): boolean {
  if (isWalkable(x, z, gates, PLAYER_R)) return true;
  for (let ring = 1; ring <= 3; ring++) {
    const r = (range * ring) / 3;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      if (isWalkable(x + Math.cos(a) * r, z + Math.sin(a) * r, gates, PLAYER_R)) return true;
    }
  }
  return false;
}
