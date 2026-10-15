import { describe, expect, it } from "vitest";
import { BRIDGE, FALLEN_TREE, NODES, WATER_SPOTS } from "./island";
import type { WorldGates } from "./collision";
import { isReachable } from "./reach";

const closed: WorldGates = { pathCleared: false, bridgeBuilt: false, cliffOpen: false };
const forestOpen: WorldGates = { pathCleared: true, bridgeBuilt: false, cliffOpen: false };
const allOpen: WorldGates = { pathCleared: true, bridgeBuilt: true, cliffOpen: false };

function node(id: string): { x: number; z: number } {
  const result = NODES.find((candidate) => candidate.id === id);
  if (!result) throw new Error(`Missing test node: ${id}`);
  return result;
}

describe("isReachable", () => {
  it("keeps beach targets reachable while the forest gate is closed", () => {
    const wood = node("wood-1");
    expect(isReachable(wood.x, wood.z, closed)).toBe(true);
  });

  it("reaches the fallen palm from the beach, so it can be cut while the gate is closed", () => {
    expect(isReachable(FALLEN_TREE.x, FALLEN_TREE.z, closed)).toBe(true);
  });

  it("opens forest targets only after the fallen tree is cleared", () => {
    const leaves = node("leaves-1");
    const tree = NODES.find((n) => n.kind === "tree")!;
    expect(isReachable(leaves.x, leaves.z, closed)).toBe(false);
    expect(isReachable(tree.x, tree.z, closed)).toBe(false);
    expect(isReachable(leaves.x, leaves.z, forestOpen)).toBe(true);
    expect(isReachable(tree.x, tree.z, forestOpen)).toBe(true);
  });

  it("reaches the broken bridge from the forest side before it is built", () => {
    expect(isReachable(BRIDGE.beachSide.x, BRIDGE.beachSide.z, forestOpen)).toBe(true);
    expect(isReachable(BRIDGE.beachSide.x, BRIDGE.beachSide.z, closed)).toBe(false);
  });

  it("opens pond targets only when both routes to them are open", () => {
    const water = WATER_SPOTS[0];
    const bridgeWithoutPath: WorldGates = { pathCleared: false, bridgeBuilt: true, cliffOpen: false };
    expect(isReachable(water.x, water.z, forestOpen)).toBe(false);
    expect(isReachable(water.x, water.z, bridgeWithoutPath)).toBe(false);
    expect(isReachable(water.x, water.z, allOpen)).toBe(true);
  });

  it("rejects positions outside the reachable island regions", () => {
    expect(isReachable(100, 100, allOpen)).toBe(false);
  });
});
