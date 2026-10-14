import { NODES, CRATE, FOREST_GAP, CAVE_SIGN, CLIFF_SIGN, FALLEN_TREE, INTERACT_RANGE } from "../world/island";
import { ITEMS, NODE_YIELD } from "../types";
import { rt } from "../runtime";
import { getGame, type Focus } from "../store";
import { targetPosition } from "./places";
import { canSleepNow } from "./days";

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

const SIGNS = [FOREST_GAP.sign, CAVE_SIGN, CLIFF_SIGN];

function candidates(): Candidate[] {
  const g = getGame();
  const out: Candidate[] = [];
  for (const n of NODES) {
    if (rt.taken.has(n.id)) continue;
    if (n.kind === "tree") {
      out.push({ focus: { id: n.id, kind: "node", verb: "Cut", noun: "the tree", icon: "tree" }, x: n.x, z: n.z, reach: INTERACT_RANGE + 0.3 });
      continue;
    }
    const item = NODE_YIELD[n.kind].item;
    out.push({ focus: { id: n.id, kind: "node", verb: "Get", noun: ITEMS[item].en, icon: item }, x: n.x, z: n.z, reach: INTERACT_RANGE });
  }
  if (!g.crateOpened) out.push({ focus: { id: CRATE.id, kind: "crate", verb: "Open", noun: "box", icon: "box" }, x: CRATE.x, z: CRATE.z, reach: INTERACT_RANGE + 0.4 });
  if (!g.pathCleared) {
    out.push({
      focus: { id: FALLEN_TREE.id, kind: "fallenTree", verb: "Cut", noun: "the tree", icon: "tree" },
      x: FALLEN_TREE.x,
      z: FALLEN_TREE.z,
      reach: INTERACT_RANGE + 0.6
    });
  }
  out.push({ focus: { id: "kai", kind: "kai", verb: "Talk to", noun: "Kai", icon: "needs" }, x: rt.kai.x, z: rt.kai.z, reach: INTERACT_RANGE + 0.5 });
  const hasShelter = g.buildings.some((b) => b.type === "shelter" && b.built);
  for (const b of g.buildings) {
    if (b.type === "campfire" && !b.lit) {
      out.push({ focus: { id: b.id, kind: "campfire", verb: "Make", noun: "a fire", icon: "fire" }, x: b.x, z: b.z, reach: INTERACT_RANGE + 0.5 });
    } else if (b.type === "campfire" && !hasShelter && canSleepNow()) {
      // No shelter yet: a lit fire is the place to sleep.
      out.push({ focus: { id: b.id, kind: "campfire", verb: "Sleep", noun: "by the fire", icon: "moon" }, x: b.x, z: b.z, reach: INTERACT_RANGE + 0.5 });
    } else if (b.type === "shelter") {
      const focus: Focus = b.built
        ? { id: b.id, kind: "shelter", verb: "Sleep", noun: "in the shelter", icon: "moon" }
        : { id: b.id, kind: "shelter", verb: "Build", noun: "the shelter", icon: "shelter" };
      out.push({ focus, x: b.x, z: b.z, reach: INTERACT_RANGE + 1.1 });
    }
  }
  for (const s of SIGNS) {
    out.push({ focus: { id: s.id, kind: "sign", verb: "Read", noun: "sign", icon: "sign" }, x: s.x, z: s.z, reach: INTERACT_RANGE });
  }
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
  return targetPosition(f.id);
}
