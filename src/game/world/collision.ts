import { BOULDERS, BOUNDS, BRIDGE, CRATE, KAI_HOME, LEAN_TO, NODES, PALMS, POND, WRECK, maxZ } from "./island";

export interface Circle {
  x: number;
  z: number;
  r: number;
}

/** Oriented rectangle: centre, half sizes, rotation around y. */
export interface Rect {
  x: number;
  z: number;
  hw: number;
  hd: number;
  rot: number;
}

export interface Obstacles {
  circles: Circle[];
  rects: Rect[];
}

export interface WorldGates {
  pathCleared: boolean;
  bridgeBuilt: boolean;
}

export const CLOSED_GATES: Readonly<WorldGates> = { pathCleared: false, bridgeBuilt: false };
export const PLAYER_R = 0.35;

const FOREST = { x0: -28, x1: 27, z0: -42, z1: -3.1 };
const GAP = { x0: -11.2, x1: -6.8, z0: -5.5, z1: -1.5 };
const BRIDGE_DECK = { x0: BRIDGE.x - 3.6, x1: BRIDGE.x + 3.6, z0: BRIDGE.z - 1.4, z1: BRIDGE.z + 1.4 };
const POND_CLEARING = { x: -45.5, z: -24, rx: 12.5, rz: 11 };

/** Fixed obstacles. Buildings and Kai are added at runtime. */
export const STATIC_OBSTACLES: Obstacles = {
  circles: [
    ...PALMS.map((p) => ({ x: p.x, z: p.z, r: 0.42 })),
    ...BOULDERS.map((b) => ({ x: b.x, z: b.z, r: b.r * 0.92 })),
    ...NODES.filter((n) => n.kind === "tree").map((n) => ({ x: n.x, z: n.z, r: 0.45 })),
    { x: LEAN_TO.x, z: LEAN_TO.z, r: LEAN_TO.r },
    { x: KAI_HOME.x - 1.2, z: KAI_HOME.z + 1.3, r: 0.55 }
  ],
  rects: [WRECK, { x: CRATE.x, z: CRATE.z, hw: CRATE.half, hd: CRATE.half, rot: CRATE.rot }]
};

function inRect(x: number, z: number, rect: { x0: number; x1: number; z0: number; z1: number }, margin: number): boolean {
  return x >= rect.x0 + margin && x <= rect.x1 - margin && z >= rect.z0 + margin && z <= rect.z1 - margin;
}

function inPondClearing(x: number, z: number, margin: number): boolean {
  const rx = POND_CLEARING.rx - margin;
  const rz = POND_CLEARING.rz - margin;
  if (rx <= 0 || rz <= 0) return false;
  const dx = (x - POND_CLEARING.x) / rx;
  const dz = (z - POND_CLEARING.z) / rz;
  return dx * dx + dz * dz <= 1 && Math.hypot(x - POND.x, z - POND.z) >= POND.r + margin;
}

export function isPondWater(x: number, z: number, margin = 0): boolean {
  return Math.hypot(x - POND.x, z - POND.z) < POND.r + margin;
}

/** True when the whole requested radius fits a currently reachable land region. */
export function isWalkable(x: number, z: number, gates: WorldGates = CLOSED_GATES, margin = 0): boolean {
  const beach = x >= BOUNDS.x0 + margin && x <= BOUNDS.x1 - margin && z >= BOUNDS.z0 + margin && z <= maxZ(x) - margin;
  if (beach) return true;
  if (!gates.pathCleared) return false;
  if (inRect(x, z, GAP, margin) || inRect(x, z, FOREST, margin)) return true;
  if (!gates.bridgeBuilt) return false;
  return inRect(x, z, BRIDGE_DECK, margin) || inPondClearing(x, z, margin);
}

function toLocal(r: Rect, x: number, z: number): { lx: number; lz: number } {
  const dx = x - r.x;
  const dz = z - r.z;
  const c = Math.cos(-r.rot);
  const s = Math.sin(-r.rot);
  return { lx: dx * c + dz * s, lz: -dx * s + dz * c };
}

function toWorld(r: Rect, lx: number, lz: number): { x: number; z: number } {
  const c = Math.cos(r.rot);
  const s = Math.sin(r.rot);
  return { x: r.x + lx * c + lz * s, z: r.z - lx * s + lz * c };
}

/** Distance from a point to the edge of a rect (negative inside). */
export function rectDistance(r: Rect, x: number, z: number): number {
  const { lx, lz } = toLocal(r, x, z);
  const qx = Math.abs(lx) - r.hw;
  const qz = Math.abs(lz) - r.hd;
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qz, 0));
  return outside + Math.min(Math.max(qx, qz), 0);
}

function clampRect(x: number, z: number, r: number, rect: { x0: number; x1: number; z0: number; z1: number }): { x: number; z: number } {
  return {
    x: Math.max(rect.x0 + r, Math.min(rect.x1 - r, x)),
    z: Math.max(rect.z0 + r, Math.min(rect.z1 - r, z))
  };
}

function clampPondClearing(x: number, z: number, r: number): { x: number; z: number } {
  const rx = POND_CLEARING.rx - r;
  const rz = POND_CLEARING.rz - r;
  let dx = x - POND_CLEARING.x;
  let dz = z - POND_CLEARING.z;
  const ellipseD = Math.hypot(dx / rx, dz / rz);
  if (ellipseD > 1) {
    dx /= ellipseD;
    dz /= ellipseD;
  }
  let px = POND_CLEARING.x + dx;
  let pz = POND_CLEARING.z + dz;
  const waterD = Math.hypot(px - POND.x, pz - POND.z);
  const dryR = POND.r + r;
  if (waterD < dryR) {
    const ux = waterD > 0.0001 ? (px - POND.x) / waterD : 1;
    const uz = waterD > 0.0001 ? (pz - POND.z) / waterD : 0;
    px = POND.x + ux * dryR;
    pz = POND.z + uz * dryR;
  }
  return { x: px, z: pz };
}

/** Nearest point in the union of currently open island regions. */
export function clampToWalkable(x: number, z: number, r = 0, gates: WorldGates = CLOSED_GATES): { x: number; z: number } {
  if (isWalkable(x, z, gates, r)) return { x, z };

  const bx = Math.max(BOUNDS.x0 + r, Math.min(BOUNDS.x1 - r, x));
  const candidates = [{ x: bx, z: Math.max(BOUNDS.z0 + r, Math.min(maxZ(bx) - r, z)) }];
  if (gates.pathCleared) {
    candidates.push(clampRect(x, z, r, GAP), clampRect(x, z, r, FOREST));
    if (gates.bridgeBuilt) candidates.push(clampRect(x, z, r, BRIDGE_DECK), clampPondClearing(x, z, r));
  }

  let best = candidates[0];
  let bestD = Infinity;
  for (const candidate of candidates) {
    if (!isWalkable(candidate.x, candidate.z, gates, Math.max(0, r - 1e-6))) continue;
    const d = (candidate.x - x) ** 2 + (candidate.z - z) ** 2;
    if (d < bestD) {
      best = candidate;
      bestD = d;
    }
  }
  return best;
}

/** Push a circle out of obstacles and back into the currently open regions. */
export function resolveCollisions(
  x: number,
  z: number,
  r: number,
  obstacles: Obstacles[],
  gates: WorldGates = CLOSED_GATES
): { x: number; z: number } {
  let px = x;
  let pz = z;
  for (let iter = 0; iter < 3; iter++) {
    for (const set of obstacles) {
      for (const c of set.circles) {
        const dx = px - c.x;
        const dz = pz - c.z;
        const min = c.r + r;
        const d2 = dx * dx + dz * dz;
        if (d2 < min * min) {
          if (d2 < 1e-10) {
            pz = c.z + min;
            continue;
          }
          const d = Math.sqrt(d2);
          px = c.x + (dx / d) * min;
          pz = c.z + (dz / d) * min;
        }
      }
      for (const rect of set.rects) {
        const { lx, lz } = toLocal(rect, px, pz);
        const cx = Math.max(-rect.hw, Math.min(rect.hw, lx));
        const cz = Math.max(-rect.hd, Math.min(rect.hd, lz));
        const dx = lx - cx;
        const dz = lz - cz;
        const d = Math.hypot(dx, dz);
        if (d < r) {
          let nx: number;
          let nz: number;
          if (d > 0.0001) {
            nx = cx + (dx / d) * r;
            nz = cz + (dz / d) * r;
          } else {
            const ex = rect.hw - Math.abs(lx);
            const ez = rect.hd - Math.abs(lz);
            if (ex < ez) {
              nx = Math.sign(lx || 1) * (rect.hw + r);
              nz = lz;
            } else {
              nx = lx;
              nz = Math.sign(lz || 1) * (rect.hd + r);
            }
          }
          const w = toWorld(rect, nx, nz);
          px = w.x;
          pz = w.z;
        }
      }
    }
    const bounded = clampToWalkable(px, pz, r, gates);
    px = bounded.x;
    pz = bounded.z;
  }
  return { x: px, z: pz };
}

/** True if a circle at (x, z) overlaps any obstacle. */
export function overlaps(x: number, z: number, r: number, obstacles: Obstacles[]): boolean {
  for (const set of obstacles) {
    for (const c of set.circles) if (Math.hypot(x - c.x, z - c.z) < c.r + r) return true;
    for (const rect of set.rects) if (rectDistance(rect, x, z) < r) return true;
  }
  return false;
}
