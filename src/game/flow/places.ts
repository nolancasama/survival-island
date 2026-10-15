import { CAVE_SIGN, CLIFF_SIGN, CRATE, BRIDGE, FALLEN_TREE, FISH_SPOTS, FOREST_GAP, NODE_BY_ID, WATER_SPOTS } from "../world/island";
import { CAVE_BOX, CAVE_EXIT, CLIFFTOP, ROCKFALL, SIGNAL_PAD, isCaveInterior } from "../world/phase3";
import { CAVE_MOUTH } from "../world/island";
import { isReachable } from "../world/reach";
import type { WorldGates } from "../world/collision";
import { getGame } from "../store";
import { rt } from "../runtime";

/**
 * Places the game can point at: resource nodes plus the fixed spots of the
 * bigger world (the fallen palm, the bridge, the pond's water and fishing
 * spots, signs) and the player's own buildings. Beacons, focus labels, edge
 * arrows and the test hook all resolve ids through here.
 */

const FIXED = new Map<string, { x: number; z: number }>([
  [FALLEN_TREE.id, { x: FALLEN_TREE.x, z: FALLEN_TREE.z }],
  // The bridge is used from its forest-side end (where it is built from).
  [BRIDGE.id, { x: BRIDGE.beachSide.x, z: BRIDGE.beachSide.z }],
  [CRATE.id, { x: CRATE.x, z: CRATE.z }],
  [FOREST_GAP.sign.id, { x: FOREST_GAP.sign.x, z: FOREST_GAP.sign.z }],
  [CAVE_SIGN.id, { x: CAVE_SIGN.x, z: CAVE_SIGN.z }],
  [CLIFF_SIGN.id, { x: CLIFF_SIGN.x, z: CLIFF_SIGN.z }],
  ["caveMouth", CAVE_MOUTH],
  [CAVE_BOX.id, CAVE_BOX],
  [CAVE_EXIT.id, CAVE_EXIT],
  [ROCKFALL.id, ROCKFALL],
  [SIGNAL_PAD.id, SIGNAL_PAD],
  [CLIFFTOP.id, CLIFFTOP],
  ...WATER_SPOTS.map((s) => [s.id, { x: s.x, z: s.z }] as const),
  ...FISH_SPOTS.map((s) => [s.id, { x: s.x, z: s.z }] as const)
]);

/** World position of a node, place, building or Kai; null for an unknown id. */
export function targetPosition(id: string): { x: number; z: number } | null {
  const n = NODE_BY_ID.get(id);
  if (n) return { x: n.x, z: n.z };
  const p = FIXED.get(id);
  if (p) return p;
  if (id === "kai") return { x: rt.kai.x, z: rt.kai.z };
  const b = getGame().buildings.find((x) => x.id === id);
  return b ? { x: b.x, z: b.z } : null;
}

/** The world gates as they stand now. */
export function currentGates(): WorldGates {
  const g = getGame();
  return { pathCleared: g.pathCleared, bridgeBuilt: g.bridgeBuilt, cliffOpen: g.cliffOpen };
}

/** The player can get within reach of this target with the gates as they are. */
export function targetReachable(id: string, gates: WorldGates = currentGates()): boolean {
  const p = targetPosition(id);
  return p !== null && isCaveInterior(p.x, p.z) === getGame().inCave && isReachable(p.x, p.z, gates);
}
