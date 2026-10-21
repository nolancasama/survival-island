import { describe, expect, it } from "vitest";
import {
  BRIDGE, CAVE_MOUTH, CAVE_SIGN, CLIFF_SIGN, CRATE, FALLEN_TREE,
  FISH_SPOTS, FOREST_GAP, INTERACT_RANGE, KAI_HOME, NODES, SPAWN, WATER_SPOTS
} from "./island";
import { CLIFF_PATH } from "./phase3";
import { isReachable } from "./reach";
import { isWalkable, overlaps, PLAYER_R, STATIC_OBSTACLES, type Obstacles, type WorldGates } from "./collision";
import { DECOR_ITEMS, DECOR_PALMS, makeScenery, sceneryExclusion, SCENERY_COLLIDERS } from "./scenery";

const baseline: Obstacles = {
  circles: STATIC_OBSTACLES.circles.filter((c) => !SCENERY_COLLIDERS.includes(c)),
  rects: STATIC_OBSTACLES.rects
};

/** Flood actual walkable, collision-free land, rather than just a target's vicinity. */
function flood(gates: WorldGates, obstacles: Obstacles): Array<{ x: number; z: number }> {
  const step = 0.5;
  const width = 193;
  const depth = 221;
  const x0 = -59;
  const z0 = -86;
  const seen = new Uint8Array(width * depth);
  const startX = Math.round((SPAWN.x - x0) / step);
  const startZ = Math.round((SPAWN.z - z0) / step);
  const queue = [startZ * width + startX];
  const points: Array<{ x: number; z: number }> = [];
  seen[queue[0]] = 1;
  for (let next = 0; next < queue.length; next++) {
    const index = queue[next];
    const ix = index % width;
    const iz = Math.floor(index / width);
    points.push({ x: x0 + ix * step, z: z0 + iz * step });
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = ix + dx;
      const nz = iz + dz;
      if (nx < 0 || nx >= width || nz < 0 || nz >= depth) continue;
      const ni = nz * width + nx;
      if (seen[ni]) continue;
      const x = x0 + nx * step;
      const z = z0 + nz * step;
      // Check the midpoint too, so a grid edge cannot jump a thin obstacle.
      const mx = x - dx * step / 2;
      const mz = z - dz * step / 2;
      if (!isWalkable(x, z, gates, PLAYER_R) || !isWalkable(mx, mz, gates, PLAYER_R)) continue;
      if (overlaps(x, z, PLAYER_R, [obstacles]) || overlaps(mx, mz, PLAYER_R, [obstacles])) continue;
      seen[ni] = 1;
      queue.push(ni);
    }
  }
  return points;
}

describe("decorative island scenery", () => {
  it("keeps curated placements and seeded variation deterministic", () => {
    expect(makeScenery()).toEqual(makeScenery());
    expect(makeScenery()).toEqual({ palms: DECOR_PALMS, items: DECOR_ITEMS });
    expect(makeScenery(12)).not.toEqual(makeScenery(13));
    expect(DECOR_PALMS.length).toBeGreaterThanOrEqual(16);
    expect(DECOR_PALMS.length).toBeLessThanOrEqual(20);
    expect(DECOR_ITEMS.filter((item) => item.key.startsWith("rock")).length).toBeGreaterThanOrEqual(5);
    for (const key of ["barrel", "bucket", "bottle", "post"]) expect(DECOR_ITEMS.some((item) => item.key === key), key).toBe(true);
    const grove = DECOR_PALMS.filter((p) => p.x < -23 && p.z > 6);
    expect(grove.length).toBeGreaterThanOrEqual(5);
    expect(grove.some((p) => p.height > 7 && p.lean > 0.5)).toBe(true);
  });

  it("enforces all placement exclusions for every decorative base", () => {
    for (const palm of DECOR_PALMS) expect(sceneryExclusion({ ...palm, r: 0.42 }), palm.id).toBeNull();
    for (const item of DECOR_ITEMS) expect(sceneryExclusion(item), item.id).toBeNull();
    // Guard the contract itself against accidentally removing a keep-clear.
    for (const p of [SPAWN, CRATE, KAI_HOME, FOREST_GAP, FALLEN_TREE, BRIDGE, CAVE_MOUTH, CAVE_SIGN, CLIFF_SIGN, ...NODES, ...WATER_SPOTS, ...FISH_SPOTS]) {
      expect(sceneryExclusion({ ...p, r: 0.42 }), `${p.x},${p.z}`).not.toBeNull();
    }
  });

  it("never overlaps decorative colliders with each other or existing obstacles", () => {
    SCENERY_COLLIDERS.forEach((circle, index) => {
      const otherScenery = SCENERY_COLLIDERS.filter((_, i) => i !== index);
      expect(overlaps(circle.x, circle.z, circle.r, [baseline, { circles: otherScenery, rects: [] }]), `${circle.x},${circle.z}`).toBe(false);
      expect(STATIC_OBSTACLES.circles).toContain(circle);
    });
    const bottle = DECOR_ITEMS.find((item) => item.key === "bottle")!;
    expect(SCENERY_COLLIDERS.some((circle) => circle.x === bottle.x && circle.z === bottle.z)).toBe(false);
  });

  it("preserves access from spawn to every previously reachable interaction at each gate state", () => {
    const anchors = [...NODES, CRATE, KAI_HOME, FOREST_GAP.sign, FALLEN_TREE, CAVE_SIGN, CLIFF_SIGN, BRIDGE.beachSide, ...WATER_SPOTS, ...FISH_SPOTS, CAVE_MOUTH, CLIFF_PATH[0]];
    const states: WorldGates[] = [
      { pathCleared: false, bridgeBuilt: false, cliffOpen: false },
      { pathCleared: true, bridgeBuilt: false, cliffOpen: false },
      { pathCleared: true, bridgeBuilt: true, cliffOpen: false },
      { pathCleared: true, bridgeBuilt: true, cliffOpen: true }
    ];
    for (const gates of states) {
      const before = flood(gates, baseline);
      const after = flood(gates, STATIC_OBSTACLES);
      for (const anchor of anchors) {
        if (!isReachable(anchor.x, anchor.z, gates)) continue;
        const inRange = (p: { x: number; z: number }) => Math.hypot(p.x - anchor.x, p.z - anchor.z) < INTERACT_RANGE - 0.15;
        if (!before.some(inRange)) continue; // Cave interior uses the existing teleport.
        expect(after.some(inRange), `${anchor.x},${anchor.z}, gates=${JSON.stringify(gates)}`).toBe(true);
      }
    }
  });
});
