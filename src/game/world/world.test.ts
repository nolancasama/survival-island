import { describe, expect, it } from "vitest";
import {
  BOUNDS,
  BRIDGE,
  CAVE_SIGN,
  CLIFF_SIGN,
  CRATE,
  FALLEN_TREE,
  FISH_SPOTS,
  INTERACT_RANGE,
  KAI_HOME,
  NODES,
  POND,
  SPAWN,
  STREAM,
  WATER_SPOTS,
  groundY,
  maxZ,
  shoreZ
} from "./island";
import { PLAYER_R, STATIC_OBSTACLES, isWalkable, overlaps, resolveCollisions, type WorldGates } from "./collision";
import { FOOTPRINT, buildingObstacles, placeProblem, previewSpot } from "./placement";

const closed: WorldGates = { pathCleared: false, bridgeBuilt: false };
const forestOpen: WorldGates = { pathCleared: true, bridgeBuilt: false };
const allOpen: WorldGates = { pathCleared: true, bridgeBuilt: true };

const PHASE_1_NODES = [
  ["wood-1", "wood", -29, 13.929580297626595, 0.4],
  ["wood-2", "wood", -20.5, 12.866671528129038, -0.7],
  ["wood-3", "wood", -11.5, 11.729547791045443, 0.2],
  ["wood-4", "wood", -1.5, 16.05160569346981, 1.1],
  ["wood-5", "wood", 7.5, 14.831751489008344, -0.3],
  ["wood-6", "wood", -16.5, 4.6, 2.2],
  ["stone-1", "stone", -31, 5, 0.3],
  ["stone-2", "stone", -23, -0.4, 1.2],
  ["stone-3", "stone", -7.5, 4.8, 2.6],
  ["stone-4", "stone", 2.5, -0.6, 0.8],
  ["stone-5", "stone", 19, 2.2, 1.9],
  ["stone-6", "stone", 30, 8, 0.1],
  ["coconut-1", "coconut", 6.3, 9.3, 0],
  ["coconut-2", "coconut", 4.2, 9.9, 1],
  ["coconut-3", "coconut", -5.1, 13.1, 2],
  ["coconut-4", "coconut", -19, 5.3, 0.5],
  ["coconut-5", "coconut", -27, 11.3, 1.5],
  ["coconut-6", "coconut", 16.9, 5.2, 2.5]
] as const;

function reachableWithin(point: { x: number; z: number }): boolean {
  for (let d = 0; d <= INTERACT_RANGE; d += 0.2) {
    for (let i = 0; i < 32; i++) {
      const a = (i / 32) * Math.PI * 2;
      const x = point.x + Math.cos(a) * d;
      const z = point.z + Math.sin(a) * d;
      if (isWalkable(x, z, allOpen, PLAYER_R) && !overlaps(x, z, PLAYER_R, [STATIC_OBSTACLES])) return true;
    }
  }
  return false;
}

describe("island layout", () => {
  it("preserves every Phase 1 resource id and position", () => {
    expect(NODES.slice(0, PHASE_1_NODES.length).map((n) => [n.id, n.kind, n.x, n.z, n.rot])).toEqual(PHASE_1_NODES);
  });

  it("keeps node ids unique and supplies the Phase 2 resources", () => {
    expect(new Set(NODES.map((n) => n.id)).size).toBe(NODES.length);
    expect(NODES.filter((n) => n.kind === "leaves")).toHaveLength(13);
    expect(NODES.filter((n) => n.kind === "tree")).toHaveLength(8);
    expect(NODES.filter((n) => n.id.startsWith("log-")).length).toBeGreaterThanOrEqual(4);
    expect(NODES.filter((n) => /^stone-[789]$/.test(n.id))).toHaveLength(3);
  });

  it("keeps representative Phase 1 beach points walkable", () => {
    for (const point of [SPAWN, KAI_HOME, { x: -30, z: 8 }, { x: 0, z: 7 }, { x: 30, z: 10 }]) {
      expect(isWalkable(point.x, point.z, closed, PLAYER_R), `${point.x},${point.z}`).toBe(true);
    }
    expect(groundY(0, -2.4)).toBeCloseTo(0.6926704271131512, 10);
  });

  it("opens the forest only after the fallen-tree gate", () => {
    expect(isWalkable(0, -16, closed, PLAYER_R)).toBe(false);
    expect(isWalkable(FALLEN_TREE.x, FALLEN_TREE.z, closed, PLAYER_R)).toBe(false);
    expect(isWalkable(FALLEN_TREE.x, FALLEN_TREE.z, forestOpen, PLAYER_R)).toBe(true);
    expect(isWalkable(0, -16, forestOpen, PLAYER_R)).toBe(true);
  });

  it("keeps the pond side closed until the bridge is built", () => {
    expect(isWalkable(-51, -18, forestOpen, PLAYER_R)).toBe(false);
    expect(isWalkable(-51, -18, allOpen, PLAYER_R)).toBe(true);
    expect(isWalkable(BRIDGE.x, BRIDGE.z, forestOpen, PLAYER_R)).toBe(false);
    expect(isWalkable(BRIDGE.x, BRIDGE.z, allOpen, PLAYER_R)).toBe(true);
    for (let x = -33.4; x <= -27.4; x += 0.1) expect(isWalkable(x, BRIDGE.z, allOpen, PLAYER_R), `bridge x ${x}`).toBe(true);
  });

  it("never permits the stream, pond water, cave interior or cliff path", () => {
    for (const z of [-6, -12, -31, -40]) expect(isWalkable(STREAM.x, z, allOpen, PLAYER_R), `stream z ${z}`).toBe(false);
    expect(isWalkable(POND.x, POND.z, allOpen, PLAYER_R)).toBe(false);
    expect(isWalkable(22, -45, allOpen, PLAYER_R)).toBe(false);
    expect(isWalkable(6, -46, allOpen, PLAYER_R)).toBe(false);
  });

  it("puts every resource and future interaction anchor within reach of open land", () => {
    const points = [
      ...NODES,
      ...WATER_SPOTS,
      ...FISH_SPOTS,
      CAVE_SIGN,
      CLIFF_SIGN,
      FALLEN_TREE,
      BRIDGE.beachSide
    ];
    for (const point of points) expect(reachableWithin(point), "id" in point ? String(point.id) : `${point.x},${point.z}`).toBe(true);
  });

  it("spawn, Kai and the crate remain reachable around their obstacles", () => {
    expect(overlaps(SPAWN.x, SPAWN.z, PLAYER_R, [STATIC_OBSTACLES])).toBe(false);
    expect(overlaps(KAI_HOME.x, KAI_HOME.z, 0.4, [STATIC_OBSTACLES])).toBe(false);
    const nearCrate = resolveCollisions(CRATE.x - 1, CRATE.z, PLAYER_R, [STATIC_OBSTACLES]);
    expect(Math.hypot(nearCrate.x - CRATE.x, nearCrate.z - CRATE.z)).toBeLessThan(INTERACT_RANGE);
  });

  it("resolves the island edge and fixed beach obstacles", () => {
    const deep = resolveCollisions(0, 40, PLAYER_R, [STATIC_OBSTACLES]);
    expect(deep.z).toBeLessThanOrEqual(maxZ(deep.x) + 1e-6);
    const forest = resolveCollisions(0, -20, PLAYER_R, [STATIC_OBSTACLES]);
    expect(forest.z).toBeGreaterThanOrEqual(BOUNDS.z0);
    const palm = resolveCollisions(5, 8.5, PLAYER_R, [STATIC_OBSTACLES]);
    expect(Math.hypot(palm.x - 5, palm.z - 8.5)).toBeGreaterThanOrEqual(0.42 + PLAYER_R - 1e-6);
  });
});

describe("placement", () => {
  const clear: Array<{ x: number; z: number; r: number }> = [];

  it("snaps the preview to the grid in front of the player", () => {
    const s = previewSpot(0.2, 0.3, 0);
    expect(Number.isInteger(s.x)).toBe(true);
    expect(Number.isInteger(s.z)).toBe(true);
    expect(s.z).toBeGreaterThan(0.3);
  });

  it("allows beach and forest clearings and rejects water and island edges", () => {
    expect(placeProblem("campfire", 2, 7, [STATIC_OBSTACLES], clear)).toBeNull();
    expect(placeProblem("shelter", 5, -31, [STATIC_OBSTACLES], clear, allOpen)).toBeNull();
    expect(placeProblem("campfire", 0, shoreZ(0), [STATIC_OBSTACLES], clear, allOpen)).toBe("water");
    expect(placeProblem("campfire", POND.x, POND.z, [STATIC_OBSTACLES], clear, allOpen)).toBe("water");
    expect(placeProblem("campfire", STREAM.x, -12, [STATIC_OBSTACLES], clear, allOpen)).toBe("water");
    expect(placeProblem("campfire", 40, 0, [STATIC_OBSTACLES], clear, allOpen)).toBe("edge");
  });

  it("keeps both gates and their approaches clear", () => {
    expect(placeProblem("campfire", FALLEN_TREE.x, FALLEN_TREE.z, [STATIC_OBSTACLES], clear, allOpen)).toBe("blocked");
    expect(placeProblem("campfire", BRIDGE.x, BRIDGE.z, [STATIC_OBSTACLES], clear, allOpen)).not.toBeNull();
    expect(placeProblem("campfire", BRIDGE.beachSide.x, BRIDGE.beachSide.z, [STATIC_OBSTACLES], clear, allOpen)).toBe("blocked");
  });

  it("rejects obstacles, keep-clear points and other buildings", () => {
    expect(placeProblem("campfire", 5, 8.5, [STATIC_OBSTACLES], clear)).toBe("blocked");
    expect(placeProblem("campfire", 2, 7, [STATIC_OBSTACLES], [{ x: 2.5, z: 7, r: 0.4 }])).toBe("blocked");
    const placed = [{ id: "a", type: "campfire" as const, x: 2, z: 7, rot: 0 }];
    expect(placeProblem("campfire", 2, 7 + FOOTPRINT.campfire, [STATIC_OBSTACLES, buildingObstacles(placed)], clear)).toBe("blocked");
    expect(placeProblem("campfire", 2, 10, [STATIC_OBSTACLES, buildingObstacles(placed)], clear)).toBeNull();
  });
});
