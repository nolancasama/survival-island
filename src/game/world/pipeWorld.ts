import type { Container, Env, Intake, Network, WorldCheck } from "../logic/waterworks";
import { BRIDGE, FALLEN_TREE, POND, STREAM, groundY, shoreZ } from "./island";
import { CONTAINER_SPECS, INTAKE_SPOTS, PLUNGE_POOL, UPPER_WATER, isUpperWater } from "./chapter3";
import { STATIC_OBSTACLES, isWalkable, overlaps, rectDistance, type Circle, type Obstacles, type WorldGates } from "./collision";
import { buildingObstacles, type PlacedBuilding } from "./placement";

/**
 * The real world as the water network sees it (logic/waterworks.ts is pure):
 * the intakes' water heights, the containers standing in the world, and what
 * stops a post or a channel. Shared by the game, the scene and the tests.
 */

export const INTAKES: readonly Intake[] = INTAKE_SPOTS.map((i) => ({ id: i.id, x: i.x, z: i.z, y: groundY(i.x, i.z) + i.lip }));
export const INTAKE_IDS: readonly string[] = INTAKES.map((i) => i.id);

export type ContainerType = keyof typeof CONTAINER_SPECS;
export const isContainer = (type: string): type is ContainerType => type in CONTAINER_SPECS;

/** Containers a pipe can fill: buckets, tanks and barrels standing in the world. */
export function containersOf(buildings: readonly PlacedBuilding[]): Container[] {
  return buildings.flatMap((b) => {
    if (!isContainer(b.type)) return [];
    const spec = CONTAINER_SPECS[b.type];
    return [{ id: b.id, x: b.x, z: b.z, ground: groundY(b.x, b.z), radius: spec.radius, rim: spec.rim, mouth: spec.mouth }];
  });
}

export function pipeEnv(buildings: readonly PlacedBuilding[]): Env {
  return { ground: groundY, intakes: INTAKES, containers: containersOf(buildings) };
}

/** A post's own footprint (posts are also obstacles to walking). */
export const POST_R = 0.12;

/** The posts as obstacles to walking (cached per network). */
let postCache: { net: Network; obstacles: Obstacles } | null = null;
export function pipeObstacles(net: Network): Obstacles {
  if (postCache?.net !== net) postCache = { net, obstacles: { circles: net.joints.map((j) => ({ x: j.x, z: j.z, r: POST_R })), rects: [] } };
  return postCache.obstacles;
}

/** Solid things a channel cannot pass through. The shelf's water is spanned; small things (signs) a channel passes over. */
const solid: Circle[] = STATIC_OBSTACLES.circles.filter((c) => c.r >= 0.3 && !UPPER_WATER.some((w) => w.x === c.x && w.z === c.z && w.r === c.r));

/** In any water a post cannot stand in: the sea, the pond, both streams and the plunge pool. */
export function inWater(x: number, z: number, r = POST_R): boolean {
  if (z + r > shoreZ(x) - 0.6) return true;
  if (Math.hypot(x - POND.x, z - POND.z) < POND.r + r) return true;
  if (Math.abs(x - STREAM.x) < STREAM.width * 0.5 + r && z > STREAM.z0 - r && z < STREAM.z1 + r) return true;
  if (Math.hypot(x - PLUNGE_POOL.x, z - PLUNGE_POOL.z) < PLUNGE_POOL.r + r) return true;
  return isUpperWater(x, z, r);
}

/** What stops a post or a channel, with the gates and buildings as they are. */
export function pipeCheck(gates: WorldGates, buildings: readonly PlacedBuilding[]): WorldCheck {
  const built = buildingObstacles(buildings.filter((b) => !isContainer(b.type)));
  const containers = containersOf(buildings);
  return {
    post(x, z) {
      if (inWater(x, z)) return "water";
      if (!isWalkable(x, z, gates, POST_R)) return "edge";
      // Keep the forest gap and the bridge's approaches clear.
      if (Math.abs(x - FALLEN_TREE.x) < 2 && Math.abs(z - FALLEN_TREE.z) < 2) return "blocked";
      if (Math.abs(x - BRIDGE.x) < 4 && Math.abs(z - BRIDGE.z) < 2) return "blocked";
      if (overlaps(x, z, POST_R, [STATIC_OBSTACLES, built])) return "blocked";
      if (containers.some((c) => Math.hypot(c.x - x, c.z - z) < c.radius + POST_R + 0.02)) return "blocked";
      return null;
    },
    segmentBlocked(ax, az, bx, bz) {
      const len = Math.hypot(bx - ax, bz - az);
      const n = Math.max(2, Math.ceil(len / 0.35));
      for (let i = 1; i < n; i++) {
        const t = i / n;
        if (t * len < 0.3 || (1 - t) * len < 0.3) continue;
        const x = ax + (bx - ax) * t;
        const z = az + (bz - az) * t;
        if (solid.some((c) => Math.hypot(x - c.x, z - c.z) < c.r * 0.85)) return true;
        if (STATIC_OBSTACLES.rects.some((r) => rectDistance(r, x, z) < 0)) return true;
      }
      return false;
    }
  };
}
