import { BOULDERS, BOUNDS, CRATE, KAI_HOME, LEAN_TO, PALMS, WRECK, maxZ } from "./island";

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

export const PLAYER_R = 0.35;

/** Fixed obstacles of the beach. Buildings and Kai are added at runtime. */
export const STATIC_OBSTACLES: Obstacles = {
  circles: [
    ...PALMS.map((p) => ({ x: p.x, z: p.z, r: 0.42 })),
    ...BOULDERS.map((b) => ({ x: b.x, z: b.z, r: b.r * 0.92 })),
    { x: LEAN_TO.x, z: LEAN_TO.z, r: LEAN_TO.r },
    { x: KAI_HOME.x - 1.2, z: KAI_HOME.z + 1.3, r: 0.55 } // log seat
  ],
  rects: [WRECK, { x: CRATE.x, z: CRATE.z, hw: CRATE.half, hd: CRATE.half, rot: CRATE.rot }]
};

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

export function clampToBounds(x: number, z: number, margin = 0): { x: number; z: number } {
  const cx = Math.max(BOUNDS.x0 + margin, Math.min(BOUNDS.x1 - margin, x));
  const cz = Math.max(BOUNDS.z0 + margin, Math.min(maxZ(cx) - margin, z));
  return { x: cx, z: cz };
}

/** Push a circle of radius `r` out of every obstacle and back inside the beach. */
export function resolveCollisions(x: number, z: number, r: number, obstacles: Obstacles[]): { x: number; z: number } {
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
            // Exactly on the centre: leave toward the sea side.
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
            // Centre inside the rect: leave by the nearest side.
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
    const b = clampToBounds(px, pz);
    px = b.x;
    pz = b.z;
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
