import { describe, expect, it } from "vitest";
import {
  CUPS_PER_SECOND, DIRECTIONS, EMPTY_NETWORK, NOTCHES, POUR_REACH, addPiece, diagnose, dirIndex, dirVector, fillContainers, incoming,
  nodeOf, planPiece, removePipe, sanitizeNetwork, setNotch, solveFlow, turnEnd, type Container, type Env, type Network, type WorldCheck
} from "./waterworks";

// A small test world: flat ground at 0, except a raised ledge east of x = 4.2
// (0.5 m) and a hump across x = 10 (for the ground-clearance rule).
const ground = (x: number, z: number) => (x > 4.2 && x < 8 && Math.abs(z) < 2 ? 0.5 : 0) + (Math.abs(x - 10) < 0.6 && z > 3 ? 1.2 : 0);
const INTAKE = { id: "i:test", x: 0, z: 0, y: 1.3 };
const bucket = (x: number, z: number): Container => ({ id: "bucket", x, z, ground: ground(x, z), radius: 0.3, rim: 0.45, mouth: 0.24 });
const tank = (x: number, z: number): Container => ({ id: "tank", x, z, ground: ground(x, z), radius: 0.75, rim: 0.95, mouth: 0.62 });
const envWith = (...containers: Container[]): Env => ({ ground, intakes: [INTAKE], containers });
const open: WorldCheck = { post: () => null, segmentBlocked: () => false };
const EAST = 4;
const SOUTH = 0;

/** Lay pieces from an end, one after another (each must fit). */
function lay(net: Network, env: Env, from: string, steps: Array<{ dir: number; kind: "long" | "short"; notch: number }>, check = open) {
  let at = from;
  let n = net;
  for (const s of steps) {
    const plan = planPiece(n, env, check, at, s.dir, s.kind, s.notch);
    expect(plan?.problem).toBeNull();
    const added = addPiece(n, plan!);
    n = added.net;
    at = added.joint;
  }
  return { net: n, end: at };
}

describe("directions", () => {
  it("round-trips the sixteen aiming directions", () => {
    for (let i = 0; i < DIRECTIONS; i++) {
      const v = dirVector(i);
      expect(dirIndex(v.x, v.z)).toBe(i);
    }
    expect(dirVector(EAST).x).toBeCloseTo(1);
    expect(dirVector(SOUTH).z).toBeCloseTo(1);
  });
});

describe("water flow", () => {
  it("runs down a line and pours into a container under its end", () => {
    const env = envWith(tank(0, 8.35));
    // Two long pieces south, the second snaps onto the tank.
    const { net } = lay(EMPTY_NETWORK, env, INTAKE.id, [{ dir: SOUTH, kind: "long", notch: 2 }, { dir: SOUTH, kind: "long", notch: 2 }]);
    const flow = solveFlow(net, env);
    expect(flow.wet).toHaveLength(2);
    expect(flow.overflows).toHaveLength(0);
    expect(flow.pours).toHaveLength(1);
    expect(flow.pours[0].into).toBe("tank");
    expect(flow.fills.tank).toBe(1);
    expect(diagnose(net, env, flow, "tank")).toEqual({ problem: "none", at: null, answer: "flowing" });
  });

  it("stops at a climbing pipe: it spills at the lower post, and the far post is too high", () => {
    const env = envWith(bucket(4.9, 0));
    // The ledge is 0.5 m higher: a post at the middle notch there is 1.6 m, above the 1.3 m intake.
    const plan = planPiece(EMPTY_NETWORK, env, open, INTAKE.id, EAST, "long", 2)!;
    expect(plan.snap).toEqual({ kind: "container", id: "bucket" });
    expect(plan.slope).toBe("up");
    const { net, joint } = addPiece(EMPTY_NETWORK, plan);
    const flow = solveFlow(net, env);
    expect(flow.wet).toHaveLength(0);
    expect(flow.overflows).toEqual([expect.objectContaining({ at: INTAKE.id, tooHigh: joint })]);
    expect(diagnose(net, env, flow, "bucket")).toEqual({ problem: "tooHigh", at: joint, answer: "tooHigh" });

    // Lowering that post one notch makes it 1.2 m: downhill, and above the bucket's 0.95 m rim.
    const lowered = setNotch(net, env, joint, 1)!;
    const ok = solveFlow(lowered, env);
    expect(ok.fills.bucket).toBe(1);
    // Lowering it again (0.8 m) puts the end below the rim: the water runs down the bucket's side.
    const tooLow = setNotch(lowered, env, joint, 0)!;
    const low = solveFlow(tooLow, env);
    expect(low.fills.bucket).toBeUndefined();
    expect(low.pours[0].tooLowFor).toBe("bucket");
    expect(diagnose(tooLow, env, low, "bucket")).toEqual({ problem: "tooLow", at: joint, answer: "tooLow" });
  });

  it("lets a level pipe flow, within the tolerance", () => {
    const env = envWith();
    const net = addPiece(EMPTY_NETWORK, planPiece(EMPTY_NETWORK, env, open, INTAKE.id, SOUTH, "long", 2)!).net;
    // 1.1 m post on flat ground, 1.3 m intake: downhill. Now a level piece and a slight rise of 0 (same notch).
    const { net: two } = lay(net, env, "j1", [{ dir: SOUTH, kind: "long", notch: 2 }]);
    const flow = solveFlow(two, env);
    expect(flow.wet).toHaveLength(2);
    expect(flow.pours).toHaveLength(1);
  });

  it("finds an end that stops short of the tank, and one that pours beside it", () => {
    const env = envWith(tank(8.8, 0));
    const { net } = lay(EMPTY_NETWORK, env, INTAKE.id, [{ dir: EAST, kind: "long", notch: 2 }, { dir: EAST, kind: "short", notch: 0 }]);
    const flow = solveFlow(net, env);
    // The end is at x = 6 (on the ledge), the tank nearly 3 m further on: too short.
    expect(diagnose(net, env, flow, "tank").problem).toBe("tooShort");

    const env2 = envWith(tank(4.4, 3.4));
    const { net: beside } = lay(EMPTY_NETWORK, env2, INTAKE.id, [{ dir: SOUTH, kind: "short", notch: 2 }, { dir: EAST, kind: "long", notch: 2 }]);
    const flow2 = solveFlow(beside, env2);
    expect(flow2.fills.tank).toBeUndefined();
    expect(diagnose(beside, env2, flow2, "tank").problem).toBe("missed");
  });

  it("leaves the part after a missing piece dry, and joins it again with a snap", () => {
    const env = envWith();
    const { net } = lay(EMPTY_NETWORK, env, INTAKE.id, [
      { dir: SOUTH, kind: "long", notch: 2 }, { dir: SOUTH, kind: "long", notch: 1 }, { dir: SOUTH, kind: "long", notch: 0 }
    ]);
    const middle = incoming(net, "j3")!.id;
    const cut = removePipe(net, middle)!;
    expect(cut.kind).toBe("long");
    // j3's pipe to j5 is still there; j3 has nothing feeding it.
    const flow = solveFlow(cut.net, env);
    expect(flow.wet.map((w) => w.id)).toEqual([incoming(net, "j1")!.id]);
    expect(flow.pours[0].at).toBe("j1");
    const tank3 = { ...tank(0, 12), id: "far" };
    expect(diagnose(cut.net, { ...env, containers: [tank3] }, flow, "far").problem).toBe("gap");
    // Building from j1 again snaps onto the dry j3 ("Connect them.").
    const plan = planPiece(cut.net, env, open, "j1", SOUTH, "long", 2)!;
    expect(plan.snap).toEqual({ kind: "joint", id: "j3" });
    const joined = addPiece(cut.net, plan).net;
    expect(solveFlow(joined, env).wet).toHaveLength(3);
  });

  it("accepts different layouts that all reach the same tank", () => {
    const env = envWith(tank(4.35, 4.35));
    // Route A: straight south-east — a short piece and a fitted long one.
    const a = lay(EMPTY_NETWORK, env, INTAKE.id, [{ dir: 2, kind: "short", notch: 2 }, { dir: 2, kind: "long", notch: 2 }]);
    // Route B: east first, then south.
    const b = lay(EMPTY_NETWORK, env, INTAKE.id, [{ dir: EAST, kind: "long", notch: 2 }, { dir: SOUTH, kind: "long", notch: 2 }]);
    // Route C: south first in short pieces, then east.
    const c = lay(EMPTY_NETWORK, env, INTAKE.id, [{ dir: SOUTH, kind: "short", notch: 2 }, { dir: SOUTH, kind: "short", notch: 2 }, { dir: EAST, kind: "long", notch: 2 }]);
    for (const { net } of [a, b, c]) expect(solveFlow(net, env).fills.tank).toBe(1);
  });

  it("splits the water between branches", () => {
    const env = envWith(bucket(-4.6, 0), { ...bucket(4.6, 0), id: "b2", ground: 0 });
    const left = addPiece(EMPTY_NETWORK, planPiece(EMPTY_NETWORK, env, open, INTAKE.id, 12, "long", 2)!);
    const right = addPiece(left.net, planPiece(left.net, env, open, INTAKE.id, EAST, "long", 2)!);
    const flow = solveFlow(right.net, env);
    expect(flow.fills.bucket).toBe(0.5);
    expect(flow.fills.b2).toBe(0.5);
  });
});

describe("placing pieces", () => {
  it("keeps a snapped post outside the container and the water inside its mouth", () => {
    const env = envWith(tank(5, 1));
    const plan = planPiece(EMPTY_NETWORK, env, open, INTAKE.id, EAST, "long", 2)!;
    expect(plan.snap?.kind).toBe("container");
    expect(Math.hypot(plan.x - 5, plan.z - 1)).toBeGreaterThan(0.75);
    const net = addPiece(EMPTY_NETWORK, plan).net;
    const pour = solveFlow(net, env).pours[0];
    expect(Math.hypot(pour.px - 5, pour.pz - 1)).toBeLessThan(0.62);
    expect(Math.hypot(pour.px - pour.x, pour.pz - pour.z)).toBeCloseTo(POUR_REACH);
  });

  it("reports what the world says about the new post and the channel", () => {
    const env = envWith();
    const wet: WorldCheck = { post: (x) => (x > 1.5 && x < 2.5 ? "water" : null), segmentBlocked: () => false };
    expect(planPiece(EMPTY_NETWORK, env, wet, INTAKE.id, EAST, "short", 2)!.problem).toBe("water");
    // The long piece spans the water.
    expect(planPiece(EMPTY_NETWORK, env, wet, INTAKE.id, EAST, "long", 2)!.problem).toBeNull();
    const rock: WorldCheck = { post: () => null, segmentBlocked: () => true };
    expect(planPiece(EMPTY_NETWORK, env, rock, INTAKE.id, EAST, "long", 2)!.problem).toBe("blocked");
  });

  it("refuses a channel that would cut into the ground, and a post too close to another", () => {
    const env = envWith();
    // From (8, 4) east over the 1.2 m hump at x = 10, with low posts.
    const start = lay(EMPTY_NETWORK, env, INTAKE.id, [{ dir: EAST, kind: "long", notch: 4 }, { dir: SOUTH, kind: "long", notch: 4 }, { dir: EAST, kind: "long", notch: 4 }]);
    expect(nodeOf(start.net, env, start.end)!.x).toBeCloseTo(8);
    expect(planPiece(start.net, env, open, start.end, EAST, "long", 0)!.problem).toBe("ground");
    // Doubling back onto the intake's spot is crowded.
    const back = lay(EMPTY_NETWORK, env, INTAKE.id, [{ dir: SOUTH, kind: "short", notch: 2 }]);
    expect(planPiece(back.net, env, open, back.end, 8, "short", 1)!.problem).toBe("crowded");
  });

  it("refuses a height change that makes a channel cut into the ground", () => {
    const env = envWith();
    const line = lay(EMPTY_NETWORK, env, INTAKE.id, [{ dir: EAST, kind: "long", notch: 4 }, { dir: SOUTH, kind: "long", notch: 4 }, { dir: EAST, kind: "long", notch: 4 }]);
    const over = planPiece(line.net, env, open, line.end, EAST, "long", 4)!;
    expect(over.problem).toBeNull();
    const net = addPiece(line.net, over).net;
    // Lowering the post before the hump to 0.3 m would take the channel through it.
    expect(setNotch(net, env, line.end, 0)).toBeNull();
    expect(setNotch(net, env, line.end, 3)).not.toBeNull();
  });

  it("turns the last piece round its post, and only the last piece", () => {
    const env = envWith();
    const { net, end } = lay(EMPTY_NETWORK, env, INTAKE.id, [{ dir: SOUTH, kind: "long", notch: 2 }, { dir: SOUTH, kind: "long", notch: 2 }]);
    const turned = turnEnd(net, env, open, end, 4);
    expect(turned && "net" in turned).toBe(true);
    const j = (turned as { net: Network }).net.joints.find((x) => x.id === end)!;
    expect(j.x).toBeCloseTo(4);
    expect(j.z).toBeCloseTo(4);
    expect(turnEnd(net, env, open, "j1", 1)).toBeNull();
  });

  it("turns back exactly where it was, even a piece fitted to a container", () => {
    const env = envWith(tank(1.2, 8.3));
    const { net, end } = lay(EMPTY_NETWORK, env, INTAKE.id, [{ dir: SOUTH, kind: "long", notch: 2 }, { dir: SOUTH, kind: "long", notch: 2 }]);
    expect(solveFlow(net, env).fills.tank).toBe(1);
    const right = turnEnd(net, env, open, end, 1) as { net: Network };
    expect(solveFlow(right.net, env).fills.tank).toBeUndefined();
    const back = turnEnd(right.net, env, open, end, -1) as { net: Network };
    expect(solveFlow(back.net, env).fills.tank).toBe(1);
  });
});

describe("containers and saves", () => {
  it("fills by the shared flow and never past capacity", () => {
    const env = envWith(bucket(4.9, 0));
    const plan = planPiece(EMPTY_NETWORK, env, open, INTAKE.id, EAST, "long", 1)!;
    const net = addPiece(EMPTY_NETWORK, plan).net;
    const flow = solveFlow(net, env);
    const after = fillContainers({ bucket: 0 }, flow, 2, () => 3);
    expect(after.bucket).toBeCloseTo(2 * CUPS_PER_SECOND);
    expect(fillContainers(after, flow, 10, () => 3).bucket).toBe(3);
    expect(fillContainers({ bucket: 0 }, flow, 2, () => 3, () => false).bucket).toBe(0);
  });

  it("drops broken references from a saved network", () => {
    const broken: Network = {
      joints: [{ id: "j1", x: 0, z: 4, notch: 2 }, { id: "j7", x: 9, z: 9, notch: 9 }],
      pipes: [{ id: "p2", from: "i:test", to: "j1", kind: "long" }, { id: "p3", from: "j1", to: "j9", kind: "short" }],
      next: 1
    };
    const fixed = sanitizeNetwork(broken, ["i:test"]);
    expect(fixed.pipes.map((p) => p.id)).toEqual(["p2"]);
    expect(fixed.joints.map((j) => j.id)).toEqual(["j1"]);
    expect(fixed.next).toBe(3);
    expect(NOTCHES).toHaveLength(5);
  });
});
