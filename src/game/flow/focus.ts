import { NODES, CRATE, FOREST_GAP, CAVE_SIGN, CLIFF_SIGN, FALLEN_TREE, BRIDGE, FISH_SPOTS, WATER_SPOTS, INTERACT_RANGE } from "../world/island";
import { ITEMS, NODE_YIELD } from "../types";
import { rt } from "../runtime";
import { getGame, type Focus } from "../store";
import { targetPosition, targetReachable } from "./places";
import { CAVE_MOUTH } from "../world/island";
import { CAVE_BOX, ROCKFALL, SIGNAL_PAD } from "../world/phase3";
import { canSleepNow } from "./days";
import { count } from "../logic/inventory";

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
  if (!g.cliffOpen) {
    out.push({
      focus: { id: ROCKFALL.id, kind: "rockfall", verb: g.quest.day === 5 ? "Clear" : "Look at", noun: "the rocks", icon: "stone" },
      x: ROCKFALL.x,
      z: ROCKFALL.z,
      reach: INTERACT_RANGE + 0.6
    });
  }
  if (g.cliffOpen && !g.signalLit) {
    out.push({
      focus: { id: SIGNAL_PAD.id, kind: "signalPad", verb: "Make", noun: "a signal fire", icon: "signalFire" },
      x: SIGNAL_PAD.x,
      z: SIGNAL_PAD.z,
      reach: INTERACT_RANGE + 0.5
    });
  }
  if (!g.inCave) {
    out.push({ focus: { id: "caveMouth", kind: "caveMouth", verb: "Go in", noun: "the cave", icon: "torch" }, x: CAVE_MOUTH.x, z: CAVE_MOUTH.z, reach: INTERACT_RANGE });
  } else if (!g.caveBoxOpened) {
    out.push({ focus: { id: CAVE_BOX.id, kind: "caveBox", verb: "Open", noun: "the box", icon: "box" }, x: CAVE_BOX.x, z: CAVE_BOX.z, reach: INTERACT_RANGE });
  }
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
  if (!g.bridgeBuilt) {
    out.push({
      focus: { id: BRIDGE.id, kind: "bridge", verb: "Build", noun: "a bridge", icon: "bridge" },
      x: BRIDGE.beachSide.x,
      z: BRIDGE.beachSide.z,
      reach: INTERACT_RANGE + 0.6
    });
  }
  for (const s of WATER_SPOTS) {
    out.push({ focus: { id: s.id, kind: "water", verb: "Get", noun: "water", icon: "water" }, x: s.x, z: s.z, reach: INTERACT_RANGE });
  }
  for (const s of FISH_SPOTS) {
    // Resting spots disappear briefly so a nearby water spot can still be used.
    if (rt.taken.has(s.id)) continue;
    out.push({ focus: { id: s.id, kind: "fish", verb: "Catch", noun: "a fish", icon: "fish" }, x: s.x, z: s.z, reach: INTERACT_RANGE });
  }
  const kaiAtRockfall = !g.cliffOpen && Math.hypot(rt.kai.x - ROCKFALL.x, rt.kai.z - ROCKFALL.z) < INTERACT_RANGE + 0.5;
  if (!rt.kai.route.length && !kaiAtRockfall) {
    out.push({ focus: { id: "kai", kind: "kai", verb: "Talk to", noun: "Kai", icon: "needs" }, x: rt.kai.x, z: rt.kai.z, reach: INTERACT_RANGE + 0.5 });
  }
  const hasShelter = g.buildings.some((b) => b.type === "shelter" && b.built);
  for (const b of g.buildings) {
    if (b.type === "campfire" && !b.lit) {
      out.push({ focus: { id: b.id, kind: "campfire", verb: "Make", noun: "a fire", icon: "fire" }, x: b.x, z: b.z, reach: INTERACT_RANGE + 0.5 });
    } else if (b.type === "campfire" && count(g.bag, "fish") > 0) {
      out.push({ focus: { id: b.id, kind: "campfire", verb: "Cook", noun: "the fish", icon: "grilledFish" }, x: b.x, z: b.z, reach: INTERACT_RANGE + 0.5 });
    } else if (b.type === "campfire" && !hasShelter && canSleepNow()) {
      // No shelter yet: a lit fire is the place to sleep.
      out.push({ focus: { id: b.id, kind: "campfire", verb: "Sleep", noun: "by the fire", icon: "moon" }, x: b.x, z: b.z, reach: INTERACT_RANGE + 0.5 });
    } else if (b.type === "shelter") {
      const focus: Focus = b.built
        ? { id: b.id, kind: "shelter", verb: "Sleep", noun: "in the tent", icon: "moon" }
        : { id: b.id, kind: "shelter", verb: "Build", noun: "the tent", icon: "shelter" };
      out.push({ focus, x: b.x, z: b.z, reach: INTERACT_RANGE + 1.1 });
    }
  }
  for (const s of SIGNS) {
    if (s.id === CLIFF_SIGN.id && (g.quest.day === 5 || g.cliffOpen)) continue;
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
    if (!targetReachable(c.focus.id)) continue;
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
