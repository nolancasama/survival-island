import { NODES, CRATE, FOREST_GAP, INTERACT_RANGE, NODE_BY_ID } from "../world/island";
import { ITEMS } from "../types";
import { rt } from "../runtime";
import { getGame, type Focus } from "../store";

/**
 * What the player can use right now: the nearest usable thing within reach,
 * preferring what is in front of them.
 */

interface Candidate {
  focus: Focus;
  x: number;
  z: number;
  reach: number;
}

function candidates(): Candidate[] {
  const g = getGame();
  const out: Candidate[] = [];
  for (const n of NODES) {
    if (rt.taken.has(n.id)) continue;
    out.push({ focus: { id: n.id, kind: "node", verb: "Get", noun: ITEMS[n.kind].en, icon: n.kind }, x: n.x, z: n.z, reach: INTERACT_RANGE });
  }
  if (!g.crateOpened) out.push({ focus: { id: CRATE.id, kind: "crate", verb: "Open", noun: "box", icon: "box" }, x: CRATE.x, z: CRATE.z, reach: INTERACT_RANGE + 0.4 });
  out.push({ focus: { id: "kai", kind: "kai", verb: "Talk to", noun: "Kai", icon: "needs" }, x: rt.kai.x, z: rt.kai.z, reach: INTERACT_RANGE + 0.5 });
  for (const b of g.buildings) {
    if (b.type === "campfire" && !b.lit) {
      out.push({ focus: { id: b.id, kind: "campfire", verb: "Make", noun: "a fire", icon: "fire" }, x: b.x, z: b.z, reach: INTERACT_RANGE + 0.5 });
    }
  }
  out.push({ focus: { id: FOREST_GAP.sign.id, kind: "sign", verb: "Read", noun: "sign", icon: "sign" }, x: FOREST_GAP.sign.x, z: FOREST_GAP.sign.z, reach: INTERACT_RANGE });
  return out;
}

export function findFocus(px: number, pz: number, yaw: number): Focus | null {
  const fx = Math.sin(yaw);
  const fz = Math.cos(yaw);
  let best: Focus | null = null;
  let bestScore = Infinity;
  for (const c of candidates()) {
    const dx = c.x - px;
    const dz = c.z - pz;
    const d = Math.hypot(dx, dz);
    if (d > c.reach) continue;
    // Prefer things in front; behind still counts when very close.
    const facing = d > 0.01 ? (dx * fx + dz * fz) / d : 1;
    if (facing < -0.2 && d > 1.1) continue;
    const score = d - facing * 0.8;
    if (score < bestScore) {
      bestScore = score;
      best = c.focus;
    }
  }
  return best;
}

/** World position of a focus target (for labels and facing). */
export function focusPosition(f: Focus): { x: number; z: number } | null {
  if (f.kind === "node") {
    const n = NODE_BY_ID.get(f.id);
    return n ? { x: n.x, z: n.z } : null;
  }
  if (f.kind === "crate") return { x: CRATE.x, z: CRATE.z };
  if (f.kind === "kai") return { x: rt.kai.x, z: rt.kai.z };
  if (f.kind === "sign") return { x: FOREST_GAP.sign.x, z: FOREST_GAP.sign.z };
  const b = getGame().buildings.find((x) => x.id === f.id);
  return b ? { x: b.x, z: b.z } : null;
}
