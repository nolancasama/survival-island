import { getGame } from "../store";
import { count } from "../logic/inventory";
import { outgoing } from "../logic/waterworks";
import { INTAKE_SPOTS, TANGLE, TANGLE_SPOT } from "../world/chapter3";
import { CONTAINER_SPECS } from "../world/chapter3";
import { isContainer } from "../world/pipeWorld";
import type { Candidate } from "./chapter2Focus";

/**
 * What the player can use in Chapter 3, as focus candidates (see focus.ts):
 * the fallen bamboo on the stairs, an intake with no pipe yet, each post of
 * the water pipe, and the bucket and tank.
 */
export function chapterThreeCandidates(): Candidate[] {
  const g = getGame();
  const out: Candidate[] = [];
  // The fallen bamboo: a story gate from Day 9 (before that it is only scenery).
  if (!g.stairsOpen && g.quest.day >= 9) {
    out.push({ focus: { id: TANGLE.id, kind: "tangle", verb: "Cut", noun: "the bamboo", icon: "pole" }, x: TANGLE_SPOT.x, z: TANGLE_SPOT.z, reach: 2.4 });
  }
  // Pipes can start once Kai has the plan (and always in free play).
  const building = g.kai.pipePlan || g.quest.day > 10;
  if (building) {
    for (const i of INTAKE_SPOTS) {
      if (outgoing(g.water, i.id).length) continue;
      out.push({ focus: { id: i.id, kind: "intake", verb: "Build", noun: "a pipe", icon: "pipe" }, x: i.x, z: i.z, reach: 1.9 });
    }
  }
  for (const j of g.water.joints) {
    const end = outgoing(g.water, j.id).length === 0;
    out.push({ focus: { id: j.id, kind: "joint", verb: end ? "Build" : "Change", noun: end ? "the pipe" : "the post", icon: "pipe" }, x: j.x, z: j.z, reach: 1.5 });
  }
  for (const b of g.buildings) {
    if (!isContainer(b.type) || b.type === "barrel") continue;
    const noun = b.type === "tank" ? "the tank" : "the bucket";
    const verb = (b.water ?? 0) >= 1 && count(g.bag, "container") > 0 ? "Use" : "Move";
    out.push({ focus: { id: b.id, kind: "container", verb, noun, icon: b.type }, x: b.x, z: b.z, reach: CONTAINER_SPECS[b.type].radius + 1.2 });
  }
  return out;
}
