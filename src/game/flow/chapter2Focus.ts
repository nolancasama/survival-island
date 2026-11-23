import { getGame, type Focus } from "../store";
import { rt } from "../runtime";
import { count } from "../logic/inventory";
import { INTERACT_RANGE } from "../world/island";
import { COVE_BARREL, COVE_CRATE, GROVE_GATE, KAI_COVE, SEA_CHEST } from "../world/chapter2";
import {
  CATCHER, CATCHER_CORNERS, CATCHER_SOCKETS, RACK_SOCKETS, catcherBuilt, openSockets, rackFrameComplete, rackSlots, rackStable, socketMiddle, toWorld, type Socket
} from "../logic/structures";
import type { PlacedBuilding } from "../world/placement";
import type { NodeKind } from "../types";

/**
 * What the player can use in Chapter 2, as focus candidates (see focus.ts).
 * Compound ids name parts of a structure: `b123:leg2` (an open socket),
 * `b123:c0` (a rain-catcher corner), `b123:test` (the catcher's middle).
 */

export interface Candidate {
  focus: Focus;
  x: number;
  z: number;
  reach: number;
  /** Preferred over nearer candidates by this many metres (see focus.ts). */
  bias?: number;
}

/** Salvage kinds Kai can name in the cove ("What is this?"). */
export type AskKind = "chest" | "barrel" | "canvas" | "rope" | "metal";

const SOCKET_NOUN: Record<Socket["kind"], string> = {
  leg: "a leg", bar: "a bar", brace: "a brace", shelf: "a shelf bar", post: "a post", canvas: "the canvas"
};

/** Kai stands in the cove (Day 6, before the chest goes home), close enough to answer. */
export function kaiInCove(): boolean {
  const g = getGame();
  return g.kaiStage === "cove" && !g.carry && Math.hypot(rt.kai.x - KAI_COVE.x, rt.kai.z - KAI_COVE.z) < 2.5;
}

/** "What is this?" is offered for a kind Kai has not named yet, while he is near in the cove. */
export function canAsk(kind: AskKind, x: number, z: number): boolean {
  const g = getGame();
  return g.quest.day === 6 && g.kaiStage === "cove" && !g.carry && !g.asked.includes(kind) && Math.hypot(rt.kai.x - x, rt.kai.z - z) < 16;
}

export function askKindOf(nodeKind: NodeKind): AskKind | null {
  return nodeKind === "canvas" || nodeKind === "rope" || nodeKind === "metal" ? nodeKind : null;
}

/** World position of a structure part id, or null. */
export function partPosition(id: string): { x: number; z: number } | null {
  const sep = id.indexOf(":");
  if (sep < 0) return null;
  const b = getGame().buildings.find((x) => x.id === id.slice(0, sep));
  if (!b) return null;
  const part = id.slice(sep + 1);
  if (part === "test") return { x: b.x, z: b.z };
  if (/^c[0-3]$/.test(part)) {
    const [lx, lz] = CATCHER_CORNERS[Number(part[1])];
    return toWorld(b, lx, lz);
  }
  const socket = socketsOf(b).find((s) => s.id === part);
  if (!socket) return null;
  const m = socketMiddle(socket);
  return toWorld(b, m.x, m.z);
}

/** The open sockets the player is offered: shelves once the frame stands, no spare braces once the rack is strong. */
export function offeredSockets(b: PlacedBuilding): Socket[] {
  const parts = b.parts ?? [];
  const stable = b.type === "rack" && rackStable(parts);
  return openSockets(socketsOf(b), parts).filter((s) =>
    b.type === "catcher" || ((s.kind !== "shelf" || rackFrameComplete(parts)) && !(stable && s.kind === "brace")));
}

export function socketsOf(b: PlacedBuilding): readonly Socket[] {
  return b.type === "rack" ? RACK_SOCKETS : b.type === "catcher" ? CATCHER_SOCKETS : [];
}

/** Chapter 2 candidates. While carrying, only putting it down is offered. */
export function chapterTwoCandidates(): Candidate[] {
  const g = getGame();
  const out: Candidate[] = [];
  const p = rt.player;
  if (g.carry) {
    const noun = g.carry === "chest" ? "the box" : "the barrel";
    out.push({ focus: { id: "putDown", kind: "putDown", verb: "Put down", noun, icon: g.carry === "chest" ? "box" : "barrel" }, x: p.x, z: p.z, reach: 99 });
    return out;
  }
  // The cove's crate, the sea chest and the barrel.
  if (g.coveOpen) {
    if (!g.coveBoxOpened) {
      out.push({ focus: { id: COVE_CRATE.id, kind: "coveCrate", verb: "Open", noun: "the box", icon: "box" }, x: COVE_CRATE.x, z: COVE_CRATE.z, reach: INTERACT_RANGE + 0.4 });
    }
    if (!g.chestTaken) {
      const ask = canAsk("chest", SEA_CHEST.x, SEA_CHEST.z);
      out.push({
        focus: ask ? { id: SEA_CHEST.id, kind: "ask", verb: "Ask Kai about", noun: "this", icon: "question" } : { id: SEA_CHEST.id, kind: "carry", verb: "Carry", noun: "the box", icon: "box" },
        x: SEA_CHEST.x, z: SEA_CHEST.z, reach: INTERACT_RANGE + 0.5
      });
    }
    if (!g.barrelTaken) {
      const ask = canAsk("barrel", COVE_BARREL.x, COVE_BARREL.z);
      const carry = g.quest.day >= 8;
      if (ask || carry) {
        out.push({
          focus: ask ? { id: COVE_BARREL.id, kind: "ask", verb: "Ask Kai about", noun: "this", icon: "question" } : { id: COVE_BARREL.id, kind: "carry", verb: "Carry", noun: "the barrel", icon: "barrel" },
          x: COVE_BARREL.x, z: COVE_BARREL.z, reach: INTERACT_RANGE + 0.3
        });
      }
    }
  }
  // The bamboo thicket: a story gate from Day 7 (before that it is only scenery).
  if (!g.groveOpen && g.pathCleared && g.quest.day >= 7) {
    out.push({ focus: { id: GROVE_GATE.id, kind: "groveGate", verb: "Cut", noun: "the bamboo", icon: "pole" }, x: GROVE_GATE.x, z: GROVE_GATE.z, reach: INTERACT_RANGE + 0.8 });
  }
  for (const b of g.buildings) {
    if (b.type === "storage") {
      out.push({ focus: { id: b.id, kind: "carry", verb: "Carry", noun: "the box", icon: "box" }, x: b.x, z: b.z, reach: INTERACT_RANGE + 0.3 });
    } else if (b.type === "barrel") {
      out.push({ focus: { id: b.id, kind: "barrel", verb: barrelVerb(b), noun: "the barrel", icon: "barrel" }, x: b.x, z: b.z, reach: INTERACT_RANGE + 0.2 });
    } else if (b.type === "rack" || b.type === "catcher") {
      const parts = b.parts ?? [];
      const stable = b.type === "rack" && rackStable(parts);
      for (const s of offeredSockets(b)) {
        const m = socketMiddle(s);
        const w = toWorld(b, m.x, m.z);
        out.push({ focus: { id: `${b.id}:${s.id}`, kind: "socket", verb: "Put", noun: SOCKET_NOUN[s.kind], icon: s.uses === "canvas" ? "canvas" : "pole" }, x: w.x, z: w.z, reach: INTERACT_RANGE + 0.6 });
      }
      if (b.type === "rack" && rackFrameComplete(parts)) {
        // Its sockets are always nearer than its middle: with a fish to hang or to take, the rack wins.
        const busy = stable && (rackHasDried(b) || (count(getGame().bag, "fish") > 0 && (b.fish ?? []).length < rackSlots(parts)));
        out.push({ focus: { id: b.id, kind: "rack", verb: rackVerb(b), noun: "the rack", icon: "rack" }, x: b.x, z: b.z, reach: INTERACT_RANGE + 1.0, bias: busy ? 2 : 0 });
      }
      if (b.type === "catcher" && catcherBuilt(parts)) {
        CATCHER_CORNERS.forEach(([lx, lz], i) => {
          const w = toWorld(b, lx, lz);
          out.push({ focus: { id: `${b.id}:c${i}`, kind: "corner", verb: "Change", noun: "this corner", icon: "catcher" }, x: w.x, z: w.z, reach: 1.7 });
        });
        out.push({ focus: { id: `${b.id}:test`, kind: "test", verb: "Test", noun: "the rain catcher", icon: "rain" }, x: b.x, z: b.z, reach: CATCHER.half + 0.9 });
      }
    }
  }
  return out;
}

function barrelVerb(b: PlacedBuilding): string {
  return (b.water ?? 0) >= 1 && count(getGame().bag, "container") > 0 ? "Use" : "Move";
}

const rackHasDried = (b: PlacedBuilding) => (b.fish ?? []).some((left) => left <= 0);

function rackVerb(b: PlacedBuilding): string {
  if (rackHasDried(b)) return "Get fish from";
  return count(getGame().bag, "fish") > 0 ? "Hang fish on" : "Look at";
}
