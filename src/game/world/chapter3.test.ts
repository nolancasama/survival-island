import { describe, expect, it } from "vitest";
import { groundY } from "./island";
import { CLOSED_GATES, PLAYER_R, STATIC_OBSTACLES, isWalkable, overlaps, type WorldGates } from "./collision";
import {
  CLIMB_PATH, FORD, INTAKE_SPOTS, KAI_TANK_SPOT, KAI_UPPER, SHELF, SHELF_STREAM, STAIRS, TABLE_ROCK, TANGLE_SPOT, UPPER_POOL,
  isUpperWater, upperGroundY
} from "./chapter3";
import { INTAKES, inWater, pipeCheck, pipeEnv } from "./pipeWorld";
import { LEAN_TO } from "./island";
import type { PlacedBuilding } from "./placement";
import { EMPTY_NETWORK, addPiece, diagnose, planPiece, setNotch, solveFlow, type Network } from "../logic/waterworks";

const forest: WorldGates = { ...CLOSED_GATES, pathCleared: true };
const pond: WorldGates = { ...forest, bridgeBuilt: true };
const stairs: WorldGates = { ...CLOSED_GATES, stairsOpen: true };
const all: WorldGates = { pathCleared: true, bridgeBuilt: true, cliffOpen: true, coveOpen: true, groveOpen: true, stairsOpen: true };
const free = (x: number, z: number, gates: WorldGates) => isWalkable(x, z, gates, PLAYER_R) && !overlaps(x, z, PLAYER_R, [STATIC_OBSTACLES]);

const ESE = 3;
const EAST = 4;
const SOUTH = 0;

describe("Upper Stream ground", () => {
  it("never reshapes the walkable beach or the pond clearing", () => {
    for (const [x, z] of [[-34.6, -2.2], [-34.6, 4], [-30, -2.3], [-20, 0], [-34.7, 12]]) expect(upperGroundY(x, z, 0.123, 9, 9)).toBe(0.123);
    for (const [x, z] of [[-45.5, -14.2], [-52, -19], [-56, -22], [-40, -16]]) expect(upperGroundY(x, z, 0.456, 9, 9)).toBe(0.456);
  });

  it("puts the shelf about four metres up, with water below its banks", () => {
    expect(groundY(SHELF.x, -5)).toBeGreaterThan(3.6);
    expect(groundY(SHELF.x, -5)).toBeLessThan(4.4);
    expect(groundY(-36, 4)).toBeLessThan(1);
    expect(groundY(UPPER_POOL.x, UPPER_POOL.z)).toBeLessThan(groundY(UPPER_POOL.x + 3.6, UPPER_POOL.z + 3) - 0.4);
    expect(groundY(-60.5, -6.6)).toBeGreaterThan(10);
  });

  it("runs the stairs smoothly down to the beach", () => {
    let last = Infinity;
    for (let t = 0; t <= 1.0001; t += 0.1) {
      const x = STAIRS[0].x + (STAIRS[1].x - STAIRS[0].x) * t;
      const z = STAIRS[0].z + (STAIRS[1].z - STAIRS[0].z) * t;
      const y = groundY(x, z);
      expect(y).toBeLessThanOrEqual(last + 0.02);
      if (t > 0) expect(last - y).toBeLessThan(0.55);
      last = y;
    }
    expect(last).toBeLessThan(0.5);
  });
});

describe("Upper Stream walking", () => {
  it("is shut until the bridge is built or the stairs are cut open", () => {
    expect(free(-50, -5, CLOSED_GATES)).toBe(false);
    expect(free(-50, -5, forest)).toBe(false);
    expect(free(-50, -5, pond)).toBe(true);
    expect(free(-50, -5, stairs)).toBe(true);
    const mid = { x: (STAIRS[0].x + STAIRS[1].x) / 2, z: (STAIRS[0].z + STAIRS[1].z) / 2 };
    expect(free(mid.x, mid.z, pond)).toBe(false);
    expect(free(mid.x, mid.z, stairs)).toBe(true);
    for (const p of CLIMB_PATH.slice(1)) expect(free(p.x, p.z, pond), `climb ${p.x},${p.z}`).toBe(true);
    expect(free(CLIMB_PATH[2].x, CLIMB_PATH[2].z, forest)).toBe(false);
  });

  it("keeps the stream and pool out of reach, except at the ford", () => {
    for (const p of SHELF_STREAM.slice(0, -1)) expect(free(p.x, p.z, all), `stream ${p.x},${p.z}`).toBe(false);
    expect(free(UPPER_POOL.x, UPPER_POOL.z, all)).toBe(false);
    for (const z of [-8.6, -6.95, -5.4]) expect(free(FORD.x, z, all), `ford z ${z}`).toBe(true);
    expect(isUpperWater(FORD.x, FORD.z)).toBe(true);
  });

  it("lets the player reach everything Chapter 3 uses", () => {
    for (const p of [TANGLE_SPOT, KAI_UPPER, { x: TABLE_ROCK.x + 1.4, z: TABLE_ROCK.z + 0.6 }, STAIRS[1], KAI_TANK_SPOT]) {
      expect(free(p.x, p.z, all), `${p.x},${p.z}`).toBe(true);
    }
    for (const i of INTAKE_SPOTS) expect(free(i.x, i.z, all), i.id).toBe(true);
  });
});

/** Lay pieces from an end with the real world checks; every piece must fit. */
function lay(net: Network, buildings: PlacedBuilding[], from: string, steps: Array<{ dir: number; kind: "long" | "short"; notch: number }>) {
  const env = pipeEnv(buildings);
  const check = pipeCheck(all, buildings);
  let at = from;
  let n = net;
  for (const s of steps) {
    const plan = planPiece(n, env, check, at, s.dir, s.kind, s.notch)!;
    expect(plan.problem, `${at} dir ${s.dir} ${s.kind}: ${JSON.stringify(plan)}`).toBeNull();
    const added = addPiece(n, plan);
    n = added.net;
    at = added.joint;
  }
  return { net: n, end: at, env };
}

describe("Day 9: the bucket on the table rock", () => {
  const bucket: PlacedBuilding = { id: "bucket", type: "bucket", x: TABLE_ROCK.x, z: TABLE_ROCK.z, rot: 0, water: 0 };
  // From the upper intake, one long piece toward the bucket snaps onto it.
  const toward = Math.round((Math.atan2(TABLE_ROCK.x - INTAKES[0].x, TABLE_ROCK.z - INTAKES[0].z) / (Math.PI * 2)) * 16 + 16) % 16;

  it("climbs at the middle notch, works one lower, and is too low two lower", () => {
    const env = pipeEnv([bucket]);
    const plan = planPiece(EMPTY_NETWORK, env, pipeCheck(all, [bucket]), "i:upper", toward, "long", 2)!;
    expect(plan.problem).toBeNull();
    expect(plan.snap).toEqual({ kind: "container", id: "bucket" });
    expect(plan.slope).toBe("up");
    const { net, joint } = addPiece(EMPTY_NETWORK, plan);
    expect(diagnose(net, env, solveFlow(net, env), "bucket").problem).toBe("tooHigh");
    const one = setNotch(net, env, joint, 1)!;
    expect(solveFlow(one, env).fills.bucket).toBe(1);
    const two = setNotch(one, env, joint, 0)!;
    expect(diagnose(two, env, solveFlow(two, env), "bucket").problem).toBe("tooLow");
  });
});

describe("Day 10: lines to a tank at camp", () => {
  const atCamp = (x: number, z: number) => Math.hypot(x - LEAN_TO.x, z - LEAN_TO.z) <= 15;

  it("works from the lower intake down the stairs, with the tank carried to the stairs' end of camp", () => {
    const tank: PlacedBuilding = { id: "tank", type: "tank", x: -30.4, z: 0, rot: 0, water: 0 };
    expect(atCamp(tank.x, tank.z)).toBe(true);
    const { net, env } = lay(EMPTY_NETWORK, [tank], "i:lower", [
      { dir: ESE, kind: "short", notch: 2 },
      { dir: ESE, kind: "long", notch: 2 },
      { dir: ESE, kind: "long", notch: 4 },
      { dir: EAST, kind: "long", notch: 3 }
    ]);
    const flow = solveFlow(net, env);
    expect(flow.overflows).toEqual([]);
    expect(flow.fills.tank).toBe(1);
  });

  it("needs the water kept high to reach Kai's tank: at the middle notch the line climbs the rising beach", () => {
    const tank: PlacedBuilding = { id: "tank", type: "tank", x: KAI_TANK_SPOT.x, z: KAI_TANK_SPOT.z, rot: 0, water: 0 };
    expect(atCamp(tank.x, tank.z)).toBe(true);
    const { net, env } = lay(EMPTY_NETWORK, [tank], "i:lower", [
      { dir: ESE, kind: "short", notch: 2 },
      { dir: ESE, kind: "long", notch: 2 },
      { dir: ESE, kind: "long", notch: 2 },
      { dir: ESE, kind: "long", notch: 2 },
      { dir: ESE, kind: "long", notch: 2 },
      { dir: EAST, kind: "short", notch: 2 }
    ]);
    expect(diagnose(net, env, solveFlow(net, env), "tank").problem).toBe("tooHigh");
  });

  it("reaches Kai's tank where he left it when the stairs are kept high", () => {
    const tank: PlacedBuilding = { id: "tank", type: "tank", x: KAI_TANK_SPOT.x, z: KAI_TANK_SPOT.z, rot: 0, water: 0 };
    const { net, env } = lay(EMPTY_NETWORK, [tank], "i:lower", [
      { dir: ESE, kind: "short", notch: 3 },
      { dir: ESE, kind: "long", notch: 4 },
      { dir: ESE, kind: "long", notch: 4 },
      { dir: ESE, kind: "long", notch: 4 },
      { dir: ESE, kind: "long", notch: 3 },
      { dir: EAST, kind: "short", notch: 2 }
    ]);
    expect(solveFlow(net, env).fills.tank).toBe(1);
  });

  it("works from the upper intake too: a long piece spans the stream where a short one would stand in it", () => {
    const tank: PlacedBuilding = { id: "tank", type: "tank", x: -30.4, z: 0, rot: 0, water: 0 };
    const env = pipeEnv([tank]);
    const check = pipeCheck(all, [tank]);
    expect(planPiece(EMPTY_NETWORK, env, check, "i:upper", SOUTH, "short", 2)!.problem).toBe("water");
    expect(planPiece(EMPTY_NETWORK, env, check, "i:upper", SOUTH, "long", 2)!.problem).toBeNull();
    // The split boulder stands in the way east of the crossing, so this line crosses diagonally.
    expect(planPiece(addPiece(EMPTY_NETWORK, planPiece(EMPTY_NETWORK, env, check, "i:upper", SOUTH, "long", 2)!).net, env, check, "j1", EAST, "long", 2)!.problem).toBe("blocked");
    const { net } = lay(EMPTY_NETWORK, [tank], "i:upper", [
      { dir: 2, kind: "long", notch: 2 },
      { dir: EAST, kind: "long", notch: 2 },
      { dir: ESE, kind: "long", notch: 2 },
      { dir: ESE, kind: "long", notch: 3 },
      { dir: ESE, kind: "long", notch: 4 },
      { dir: EAST, kind: "long", notch: 3 }
    ]);
    expect(solveFlow(net, env).fills.tank).toBe(1);
  });

  it("never lets a post stand in the sea, a stream or a pool", () => {
    expect(inWater(UPPER_POOL.x, UPPER_POOL.z)).toBe(true);
    expect(inWater(-30.5, -10)).toBe(true);
    expect(inWater(-10, 20)).toBe(true);
    expect(inWater(-30, 1)).toBe(false);
  });
});
