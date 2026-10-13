import { describe, expect, it } from "vitest";
import { BOUNDS, CRATE, KAI_HOME, NODES, SPAWN, groundY, maxZ, shoreZ, SEA_Y } from "./island";
import { PLAYER_R, STATIC_OBSTACLES, overlaps, resolveCollisions } from "./collision";
import { FOOTPRINT, buildingObstacles, placeProblem, previewSpot } from "./placement";
import { INTERACT_RANGE } from "./island";

describe("island layout", () => {
  it("every resource node is on dry sand inside the beach and reachable", () => {
    for (const n of NODES) {
      expect(n.x, n.id).toBeGreaterThan(BOUNDS.x0);
      expect(n.x, n.id).toBeLessThan(BOUNDS.x1);
      expect(n.z, n.id).toBeGreaterThan(BOUNDS.z0);
      expect(n.z, n.id).toBeLessThan(shoreZ(n.x) - 1);
      expect(groundY(n.x, n.z), n.id).toBeGreaterThan(SEA_Y);
      // The player can stand within reach of it.
      const p = resolveCollisions(n.x, n.z + 1.2, PLAYER_R, [STATIC_OBSTACLES]);
      expect(Math.hypot(p.x - n.x, p.z - n.z), n.id).toBeLessThan(INTERACT_RANGE);
    }
  });

  it("there are enough nodes for the campfire even before respawn", () => {
    expect(NODES.filter((n) => n.kind === "wood").length).toBeGreaterThanOrEqual(5);
    expect(NODES.filter((n) => n.kind === "stone").length).toBeGreaterThanOrEqual(4);
    expect(NODES.filter((n) => n.kind === "coconut").length).toBeGreaterThanOrEqual(4);
  });

  it("spawn, Kai and the crate are free of obstacles", () => {
    expect(overlaps(SPAWN.x, SPAWN.z, PLAYER_R, [STATIC_OBSTACLES])).toBe(false);
    expect(overlaps(KAI_HOME.x, KAI_HOME.z, 0.4, [STATIC_OBSTACLES])).toBe(false);
    const nearCrate = resolveCollisions(CRATE.x - 1, CRATE.z, PLAYER_R, [STATIC_OBSTACLES]);
    expect(Math.hypot(nearCrate.x - CRATE.x, nearCrate.z - CRATE.z)).toBeLessThan(INTERACT_RANGE);
  });

  it("the player cannot walk into the sea or the forest", () => {
    const deep = resolveCollisions(0, 40, PLAYER_R, [STATIC_OBSTACLES]);
    expect(deep.z).toBeLessThanOrEqual(maxZ(deep.x) + 1e-6);
    const forest = resolveCollisions(0, -20, PLAYER_R, [STATIC_OBSTACLES]);
    expect(forest.z).toBeGreaterThanOrEqual(BOUNDS.z0);
  });

  it("the player is pushed out of palms and the wreck", () => {
    const p = resolveCollisions(5, 8.5, PLAYER_R, [STATIC_OBSTACLES]);
    expect(Math.hypot(p.x - 5, p.z - 8.5)).toBeGreaterThanOrEqual(0.42 + PLAYER_R - 1e-6);
    const w = resolveCollisions(25.5, 14.5, PLAYER_R, [STATIC_OBSTACLES]);
    expect(overlaps(w.x, w.z, PLAYER_R - 0.01, [STATIC_OBSTACLES])).toBe(false);
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

  it("allows open sand, refuses water, edges and obstacles", () => {
    expect(placeProblem("campfire", 2, 7, [STATIC_OBSTACLES], clear)).toBeNull();
    expect(placeProblem("campfire", 0, shoreZ(0), [STATIC_OBSTACLES], clear)).toBe("water");
    expect(placeProblem("campfire", 0, BOUNDS.z0, [STATIC_OBSTACLES], clear)).toBe("edge");
    expect(placeProblem("campfire", 5, 8.5, [STATIC_OBSTACLES], clear)).toBe("blocked");
    expect(placeProblem("campfire", 2, 7, [STATIC_OBSTACLES], [{ x: 2.5, z: 7, r: 0.4 }])).toBe("blocked");
  });

  it("buildings block each other", () => {
    const placed = [{ id: "a", type: "campfire" as const, x: 2, z: 7, rot: 0 }];
    expect(placeProblem("campfire", 2, 7 + FOOTPRINT.campfire, [STATIC_OBSTACLES, buildingObstacles(placed)], clear)).toBe("blocked");
    expect(placeProblem("campfire", 2, 10, [STATIC_OBSTACLES, buildingObstacles(placed)], clear)).toBeNull();
  });
});
