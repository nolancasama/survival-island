import { describe, expect, it } from "vitest";
import { BRIDGE, FALLEN_TREE, WATER_SPOTS } from "../world/island";
import type { WorldGates } from "../world/collision";
import { setGame } from "../store";
import { targetPosition, targetReachable } from "./places";

const closed: WorldGates = { pathCleared: false, bridgeBuilt: false };
const forestOpen: WorldGates = { pathCleared: true, bridgeBuilt: false };
const allOpen: WorldGates = { pathCleared: true, bridgeBuilt: true };

describe("targetPosition", () => {
  it("resolves nodes, fixed places and buildings by id", () => {
    expect(targetPosition("wood-1")).not.toBeNull();
    expect(targetPosition(FALLEN_TREE.id)).toEqual({ x: FALLEN_TREE.x, z: FALLEN_TREE.z });
    expect(targetPosition(BRIDGE.id)).toEqual(BRIDGE.beachSide);
    expect(targetPosition(WATER_SPOTS[1].id)).toEqual({ x: WATER_SPOTS[1].x, z: WATER_SPOTS[1].z });
    setGame({ buildings: [{ id: "b1", type: "shelter", x: 3, z: 4, rot: 0, built: true }] });
    expect(targetPosition("b1")).toEqual({ x: 3, z: 4 });
    expect(targetPosition("nothing")).toBeNull();
  });
});

describe("targetReachable", () => {
  it("follows the gates: the fallen tree from the beach, the bridge from the forest, water across the bridge", () => {
    expect(targetReachable(FALLEN_TREE.id, closed)).toBe(true);
    expect(targetReachable("leaves-1", closed)).toBe(false);
    expect(targetReachable("leaves-1", forestOpen)).toBe(true);
    expect(targetReachable(BRIDGE.id, closed)).toBe(false);
    expect(targetReachable(BRIDGE.id, forestOpen)).toBe(true);
    expect(targetReachable(WATER_SPOTS[0].id, forestOpen)).toBe(false);
    expect(targetReachable(WATER_SPOTS[0].id, allOpen)).toBe(true);
  });
});
