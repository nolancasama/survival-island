/**
 * Chapter 3 water network as data (EXPANSION_PLAN.md Milestone 4).
 *
 * A network is joints (posts with a lashing notch) and pipes (split bamboo
 * channels) between them. Water enters at fixed intakes (rock lips on the
 * Upper Stream), runs along every pipe that does not climb, and pours out of
 * open ends. Everything is deterministic and pure: the world (ground height,
 * what is in the way) is passed in, so the flow, the placement rules and the
 * tests share one model. Several pipes may leave one joint (branches, for
 * later valves and irrigation); the game only builds from open ends for now.
 */

/** Post heights above the ground, one per lashing notch. */
export const NOTCHES = [0.3, 0.7, 1.1, 1.5, 1.9] as const;
/** A pipe from an intake starts its first post at the middle notch. */
export const DEFAULT_NOTCH = 2;
/** Nominal horizontal span of each piece (a snapped piece is fitted). */
export const PIECE_LENGTH = { long: 4, short: 2 } as const;
export type PieceKind = keyof typeof PIECE_LENGTH;
/** A pipe may rise this much and still flow (it reads as level). */
export const LEVEL_TOLERANCE = 0.05;
/** Water leaves an open end this far beyond its post. */
export const POUR_REACH = 0.35;
/** A pour still lands in a container this far outside its mouth. */
export const CATCH_SLACK = 0.08;
/** The end must be this much above a container's rim to pour into it. */
export const RIM_CLEARANCE = 0.03;
/** Aiming directions (22.5° apart). */
export const DIRECTIONS = 16;
/** What an intake gives, shared between its lines (cups per second). */
export const CUPS_PER_SECOND = 1;
/** How fast new water runs along the pipes (m/s, for the arrival of the water). */
export const WATER_SPEED = 3;
/** A channel must clear the ground by this much between its posts. */
export const GROUND_CLEARANCE = 0.04;

export interface Joint {
  id: string;
  x: number;
  z: number;
  notch: number;
}

export interface Pipe {
  id: string;
  /** Upstream end: a joint id or an intake id ("i:…"). */
  from: string;
  to: string;
  kind: PieceKind;
}

export interface Network {
  joints: Joint[];
  pipes: Pipe[];
  /** Next id number. */
  next: number;
}

export const EMPTY_NETWORK: Network = { joints: [], pipes: [], next: 1 };

/** A fixed place where water can enter a pipe: its lip's water height is y. */
export interface Intake {
  id: string;
  x: number;
  z: number;
  y: number;
}

/** Something that holds water (bucket, tank, barrel). Heights are above its ground. */
export interface Container {
  id: string;
  x: number;
  z: number;
  ground: number;
  radius: number;
  rim: number;
  mouth: number;
}

export interface Env {
  ground(x: number, z: number): number;
  intakes: readonly Intake[];
  containers: readonly Container[];
}

export const isIntake = (id: string) => id.startsWith("i:");

export interface NodePoint {
  id: string;
  x: number;
  z: number;
  /** Height of the channel (or the intake's water) here. */
  y: number;
  intake: boolean;
  notch: number;
}

/** A joint or intake with its channel height, or null. */
export function nodeOf(net: Network, env: Env, id: string): NodePoint | null {
  if (isIntake(id)) {
    const i = env.intakes.find((x) => x.id === id);
    return i ? { id, x: i.x, z: i.z, y: i.y, intake: true, notch: -1 } : null;
  }
  const j = net.joints.find((x) => x.id === id);
  if (!j) return null;
  return { id, x: j.x, z: j.z, y: env.ground(j.x, j.z) + NOTCHES[clampNotch(j.notch)], intake: false, notch: clampNotch(j.notch) };
}

export const clampNotch = (n: number) => Math.max(0, Math.min(NOTCHES.length - 1, Math.round(n)));

export const outgoing = (net: Network, id: string) => net.pipes.filter((p) => p.from === id);
export const incoming = (net: Network, id: string) => net.pipes.find((p) => p.to === id) ?? null;

/** Unit vector of a direction index (0 = +z, clockwise seen from above: 4 = +x). */
export function dirVector(i: number): { x: number; z: number } {
  const a = (((i % DIRECTIONS) + DIRECTIONS) % DIRECTIONS) * ((Math.PI * 2) / DIRECTIONS);
  return { x: Math.sin(a), z: Math.cos(a) };
}

/** The nearest direction index to a vector. */
export function dirIndex(dx: number, dz: number): number {
  const a = Math.atan2(dx, dz);
  return ((Math.round(a / ((Math.PI * 2) / DIRECTIONS)) % DIRECTIONS) + DIRECTIONS) % DIRECTIONS;
}

// ---------------------------------------------------------------- the flow

export interface WetPipe {
  id: string;
  share: number;
  /** Distance along the water's path from the intake to this pipe's ends. */
  d0: number;
  d1: number;
}

export interface Pour {
  /** The open end the water leaves. */
  at: string;
  x: number;
  z: number;
  /** End height (the falling water starts here). */
  y: number;
  /** Where it lands. */
  px: number;
  pz: number;
  dirX: number;
  dirZ: number;
  share: number;
  /** Distance from the intake (the water arrives after d / WATER_SPEED). */
  d: number;
  /** Container it falls into, or null. */
  into: string | null;
  /** It lands in this container's mouth, but the end is below the rim. */
  tooLowFor: string | null;
}

export interface Overflow {
  /** The joint where the water stops and spills over. */
  at: string;
  x: number;
  z: number;
  y: number;
  /** The joint that is too high (the far end of the climbing pipe). */
  tooHigh: string;
  pipe: string;
  share: number;
  d: number;
}

export interface Flow {
  wet: WetPipe[];
  wetJoints: string[];
  pours: Pour[];
  overflows: Overflow[];
  /** Container id -> share of an intake's water it receives. */
  fills: Record<string, number>;
}

/** Where all the water goes, right now. */
export function solveFlow(net: Network, env: Env): Flow {
  const wet: WetPipe[] = [];
  const wetJoints: string[] = [];
  const pours: Pour[] = [];
  const overflows: Overflow[] = [];
  const fills: Record<string, number> = {};
  const seen = new Set<string>();
  type Item = { id: string; share: number; d: number; dir: { x: number; z: number } | null };
  const queue: Item[] = env.intakes.filter((i) => outgoing(net, i.id).length).map((i) => ({ id: i.id, share: 1, d: 0, dir: null }));
  while (queue.length) {
    const item = queue.shift()!;
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    const here = nodeOf(net, env, item.id);
    if (!here) continue;
    wetJoints.push(here.id);
    const outs = outgoing(net, here.id);
    if (!outs.length) {
      if (here.intake || !item.dir) continue;
      const px = here.x + item.dir.x * POUR_REACH;
      const pz = here.z + item.dir.z * POUR_REACH;
      let into: string | null = null;
      let tooLowFor: string | null = null;
      for (const c of env.containers) {
        if (Math.hypot(px - c.x, pz - c.z) > c.mouth + CATCH_SLACK) continue;
        if (here.y >= c.ground + c.rim + RIM_CLEARANCE) into = c.id;
        else tooLowFor = c.id;
        break;
      }
      if (into) fills[into] = (fills[into] ?? 0) + item.share;
      pours.push({ at: here.id, x: here.x, z: here.z, y: here.y, px, pz, dirX: item.dir.x, dirZ: item.dir.z, share: item.share, d: item.d, into, tooLowFor });
      continue;
    }
    const part = item.share / outs.length;
    for (const p of outs) {
      const to = nodeOf(net, env, p.to);
      if (!to) continue;
      const len = Math.hypot(to.x - here.x, to.z - here.z) || 1;
      if (to.y > here.y + LEVEL_TOLERANCE) {
        overflows.push({ at: here.id, x: here.x, z: here.z, y: here.y, tooHigh: to.id, pipe: p.id, share: part, d: item.d });
        continue;
      }
      wet.push({ id: p.id, share: part, d0: item.d, d1: item.d + len });
      queue.push({ id: to.id, share: part, d: item.d + len, dir: { x: (to.x - here.x) / len, z: (to.z - here.z) / len } });
    }
  }
  return { wet, wetJoints, pours, overflows, fills };
}

// ------------------------------------------------------------- diagnosis

export type Problem = "none" | "tooHigh" | "tooLow" | "missed" | "tooShort" | "gap" | "far" | "noPipe";

export interface Diagnosis {
  problem: Problem;
  /** The joint to point at (the too-high post, or the end that pours). */
  at: string | null;
  /** The true answer to "How is it?". */
  answer: "flowing" | "tooHigh" | "tooLow" | "notWork";
}

/**
 * What is wrong for one container, as the student can see it. The water
 * nearest the container is the line that is meant for it.
 */
export function diagnose(net: Network, env: Env, flow: Flow, target: string): Diagnosis {
  if ((flow.fills[target] ?? 0) > 0) return { problem: "none", at: null, answer: "flowing" };
  const c = env.containers.find((x) => x.id === target);
  if (!c || !env.intakes.some((i) => outgoing(net, i.id).length)) return { problem: "noPipe", at: null, answer: "notWork" };
  type Spot = { x: number; z: number; kind: "pour"; pour: Pour } | { x: number; z: number; kind: "overflow"; overflow: Overflow };
  const spots: Spot[] = [
    ...flow.pours.map((pour): Spot => ({ x: pour.px, z: pour.pz, kind: "pour", pour })),
    ...flow.overflows.map((overflow): Spot => ({ x: overflow.x, z: overflow.z, kind: "overflow", overflow }))
  ];
  if (!spots.length) return { problem: "noPipe", at: null, answer: "notWork" };
  spots.sort((a, b) => Math.hypot(a.x - c.x, a.z - c.z) - Math.hypot(b.x - c.x, b.z - c.z));
  const best = spots[0];
  if (best.kind === "overflow") return { problem: "tooHigh", at: best.overflow.tooHigh, answer: "tooHigh" };
  const pour = best.pour;
  if (pour.tooLowFor === target) return { problem: "tooLow", at: pour.at, answer: "tooLow" };
  const dx = c.x - pour.x;
  const dz = c.z - pour.z;
  // Water that falls short of a dry line ahead of it: the two are not connected.
  const wet = new Set(flow.wetJoints);
  const toTarget = Math.hypot(dx, dz);
  const dry = net.joints.find((j) => {
    if (wet.has(j.id) || !outgoing(net, j.id).length) return false;
    const jx = j.x - pour.x;
    const jz = j.z - pour.z;
    const ahead = jx * pour.dirX + jz * pour.dirZ;
    return Math.hypot(jx, jz) < PIECE_LENGTH.long + 0.6 && ahead > 0.3 && Math.hypot(c.x - j.x, c.z - j.z) < toTarget;
  });
  if (dry) return { problem: "gap", at: pour.at, answer: "notWork" };
  const along = dx * pour.dirX + dz * pour.dirZ;
  const across = Math.abs(dx * pour.dirZ - dz * pour.dirX);
  const away = Math.hypot(c.x - pour.px, c.z - pour.pz);
  if (away < 2.6) {
    if (along > POUR_REACH + c.mouth && across < c.radius + 0.3) return { problem: "tooShort", at: pour.at, answer: "notWork" };
    return { problem: "missed", at: pour.at, answer: "notWork" };
  }
  return { problem: "far", at: pour.at, answer: "notWork" };
}

// ------------------------------------------------------------- placement

/** World checks the model cannot know about (water, rocks, paths, buildings). */
export interface WorldCheck {
  /** Why a post cannot stand here, or null. */
  post(x: number, z: number): "water" | "blocked" | "edge" | null;
  /** Something solid (a tree, a boulder) is in the channel's way. */
  segmentBlocked(ax: number, az: number, bx: number, bz: number): boolean;
}

export type PieceProblem = "water" | "blocked" | "edge" | "ground" | "crowded";

export interface PiecePlan {
  from: string;
  kind: PieceKind;
  /** Where the new post goes (or the joint it snaps onto). */
  x: number;
  z: number;
  y: number;
  notch: number;
  length: number;
  snap: { kind: "container" | "joint"; id: string } | null;
  slope: "down" | "level" | "up";
  problem: PieceProblem | null;
}

/** Joints this close together would share one post. */
const MIN_JOINT_GAP = 0.6;

/** The channel between two heights clears the ground along its length. */
export function clearsGround(env: Env, a: { x: number; z: number; y: number }, b: { x: number; z: number; y: number }): boolean {
  const len = Math.hypot(b.x - a.x, b.z - a.z);
  const n = Math.max(3, Math.ceil(len / 0.4));
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const x = a.x + (b.x - a.x) * t;
    const z = a.z + (b.z - a.z) * t;
    if (a.y + (b.y - a.y) * t < env.ground(x, z) + GROUND_CLEARANCE) return false;
  }
  return true;
}

/**
 * The piece that would go from an open end in a direction: its new post, what
 * it snaps to, and why it cannot go there (null = it can).
 */
export function planPiece(net: Network, env: Env, check: WorldCheck, from: string, dir: number, kind: PieceKind, notch: number): PiecePlan | null {
  const start = nodeOf(net, env, from);
  if (!start) return null;
  const d = dirVector(dir);
  const len = PIECE_LENGTH[kind];
  let x = start.x + d.x * len;
  let z = start.z + d.z * len;
  let snap: PiecePlan["snap"] = null;
  let n = clampNotch(notch);

  // Snap onto a container: the water lands in its mouth, the post stands outside it.
  const px = x + d.x * POUR_REACH;
  const pz = z + d.z * POUR_REACH;
  for (const c of env.containers) {
    if (Math.hypot(px - c.x, pz - c.z) > 1.3) continue;
    const toC = Math.hypot(c.x - start.x, c.z - start.z);
    if (toC < 0.5) continue;
    const ux = (c.x - start.x) / toC;
    const uz = (c.z - start.z) / toC;
    const standoff = c.radius + 0.15;
    const fitted = toC - standoff;
    const turn = Math.acos(Math.max(-1, Math.min(1, ux * d.x + uz * d.z)));
    if (fitted < Math.max(0.8, len - 1.2) || fitted > len + 1.0 || turn > (30 * Math.PI) / 180) continue;
    x = c.x - ux * standoff;
    z = c.z - uz * standoff;
    snap = { kind: "container", id: c.id };
    break;
  }
  // Snap onto a dry joint that nothing feeds yet ("Connect them.").
  if (!snap) {
    for (const j of net.joints) {
      if (j.id === from || incoming(net, j.id) || Math.hypot(j.x - x, j.z - z) > 0.9) continue;
      const span = Math.hypot(j.x - start.x, j.z - start.z);
      if (span < len - 1 || span > len + 1) continue;
      x = j.x;
      z = j.z;
      n = clampNotch(j.notch);
      snap = { kind: "joint", id: j.id };
      break;
    }
  }
  const y = env.ground(x, z) + NOTCHES[n];
  const length = Math.hypot(x - start.x, z - start.z);
  const rise = y - start.y;
  const slope = rise > LEVEL_TOLERANCE ? "up" : rise < -LEVEL_TOLERANCE ? "down" : "level";
  const plan: PiecePlan = { from, kind, x, z, y, notch: n, length, snap, slope, problem: null };
  if (snap?.kind !== "joint") {
    const why = check.post(x, z);
    if (why) return { ...plan, problem: why };
    const crowded = net.joints.some((j) => j.id !== from && Math.hypot(j.x - x, j.z - z) < MIN_JOINT_GAP)
      || env.intakes.some((i) => Math.hypot(i.x - x, i.z - z) < MIN_JOINT_GAP);
    if (crowded) return { ...plan, problem: "crowded" };
  }
  if (check.segmentBlocked(start.x, start.z, x, z)) return { ...plan, problem: "blocked" };
  if (!clearsGround(env, start, { x, z, y })) return { ...plan, problem: "ground" };
  return plan;
}

/** Add a planned piece (the plan must have no problem). */
export function addPiece(net: Network, plan: PiecePlan): { net: Network; joint: string; pipe: string } {
  let next = net.next;
  let joints = net.joints;
  let to: string;
  if (plan.snap?.kind === "joint") {
    to = plan.snap.id;
  } else {
    to = `j${next++}`;
    joints = [...joints, { id: to, x: plan.x, z: plan.z, notch: plan.notch }];
  }
  const pipe = `p${next++}`;
  return { net: { joints, pipes: [...net.pipes, { id: pipe, from: plan.from, to, kind: plan.kind }], next }, joint: to, pipe };
}

/** Take a pipe off. Posts left with no pipe at all go too. Returns the piece's kind. */
export function removePipe(net: Network, pipeId: string): { net: Network; kind: PieceKind } | null {
  const pipe = net.pipes.find((p) => p.id === pipeId);
  if (!pipe) return null;
  const pipes = net.pipes.filter((p) => p.id !== pipeId);
  const used = new Set(pipes.flatMap((p) => [p.from, p.to]));
  const joints = net.joints.filter((j) => used.has(j.id));
  return { net: { ...net, joints, pipes }, kind: pipe.kind };
}

/** Pipes touching a joint (for checking a height change). */
export const pipesAt = (net: Network, id: string) => net.pipes.filter((p) => p.from === id || p.to === id);

/** Change a post's notch; returns null when a channel would then cut into the ground. */
export function setNotch(net: Network, env: Env, jointId: string, notch: number): Network | null {
  const n = clampNotch(notch);
  const joints = net.joints.map((j) => (j.id === jointId ? { ...j, notch: n } : j));
  const next = { ...net, joints };
  for (const p of pipesAt(next, jointId)) {
    const a = nodeOf(next, env, p.from);
    const b = nodeOf(next, env, p.to);
    if (a && b && !clearsGround(env, a, b)) return null;
  }
  return next;
}

/**
 * Turn the last piece of a line round its upstream post by one direction
 * step (±1). Only an open end can turn: its post moves with it.
 */
export function turnEnd(net: Network, env: Env, check: WorldCheck, jointId: string, step: number): { net: Network } | { problem: PieceProblem } | null {
  const pipe = incoming(net, jointId);
  const joint = net.joints.find((j) => j.id === jointId);
  if (!pipe || !joint || outgoing(net, jointId).length) return null;
  const start = nodeOf(net, env, pipe.from);
  if (!start) return null;
  const len = Math.hypot(joint.x - start.x, joint.z - start.z);
  // Exactly one aiming step from where it points now (a piece fitted to a container is not on the grid).
  const angle = Math.atan2(joint.x - start.x, joint.z - start.z) + step * ((Math.PI * 2) / DIRECTIONS);
  const x = start.x + Math.sin(angle) * len;
  const z = start.z + Math.cos(angle) * len;
  const others = { ...net, joints: net.joints.filter((j) => j.id !== jointId) };
  const why = check.post(x, z);
  if (why) return { problem: why };
  if (others.joints.some((j) => j.id !== pipe.from && Math.hypot(j.x - x, j.z - z) < MIN_JOINT_GAP)) return { problem: "crowded" };
  if (check.segmentBlocked(start.x, start.z, x, z)) return { problem: "blocked" };
  const y = env.ground(x, z) + NOTCHES[clampNotch(joint.notch)];
  if (!clearsGround(env, start, { x, z, y })) return { problem: "ground" };
  return { net: { ...net, joints: net.joints.map((j) => (j.id === jointId ? { ...j, x, z } : j)) } };
}

/** New water in each container after dt seconds of flow (each never above its capacity). */
export function fillContainers(water: Readonly<Record<string, number>>, flow: Flow, dt: number, capacity: (id: string) => number, arrived: (id: string) => boolean = () => true): Record<string, number> {
  const out: Record<string, number> = { ...water };
  for (const [id, share] of Object.entries(flow.fills)) {
    if (!arrived(id)) continue;
    out[id] = Math.min(capacity(id), (out[id] ?? 0) + Math.max(0, dt) * share * CUPS_PER_SECOND);
  }
  return out;
}

/** Drop pipes whose ends no longer exist, and joints no pipe uses (save repair). */
export function sanitizeNetwork(net: Network, intakeIds: readonly string[]): Network {
  const jointIds = new Set(net.joints.map((j) => j.id));
  const exists = (id: string) => jointIds.has(id) || intakeIds.includes(id);
  const pipes = net.pipes.filter((p) => exists(p.from) && exists(p.to) && p.from !== p.to && !isIntake(p.to));
  const used = new Set(pipes.flatMap((p) => [p.from, p.to]));
  const joints = net.joints.filter((j) => used.has(j.id));
  const maxId = Math.max(0, ...[...joints.map((j) => j.id), ...pipes.map((p) => p.id)].map((id) => Number(id.slice(1)) || 0));
  return { joints, pipes, next: Math.max(net.next, maxId + 1) };
}
