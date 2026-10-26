import { describe, expect, it } from "vitest";
import { BRIDGE, groundY } from "./island";
import { PLAYER_R, isWalkable, resolveCollisions } from "./collision";
import { BRIDGE_BASE_Y, BRIDGE_DECK_Y, BRIDGE_SURFACE, walkingSurfaceY } from "./surface";
import { CAVE_ENTRY, CAVE_CHAMBER, CAVE_CORRIDOR, isAtCaveExit } from "./phase3";
import { bridgePlankGeometry } from "../../scene/models/props";

const built = { pathCleared: true, bridgeBuilt: true };

describe("bridge walking surface", () => {
  it("matches the top of the actual rendered plank geometry", () => {
    const plank = bridgePlankGeometry();
    plank.computeBoundingBox();
    expect(walkingSurfaceY(BRIDGE.x, BRIDGE.z, true)).toBeCloseTo(
      BRIDGE_BASE_Y + BRIDGE_SURFACE.plankY + plank.boundingBox!.max.y, 7
    );
    plank.dispose();
  });
  it("uses the actual plank top across the full usable deck width", () => {
    for (const z of [-0.4, 0, 0.4]) {
      for (let x = -2.16; x <= 2.16; x += 0.24) {
        expect(walkingSurfaceY(BRIDGE.x + x, BRIDGE.z + z, true)).toBeCloseTo(BRIDGE_DECK_Y, 10);
        expect(isWalkable(BRIDGE.x + x, BRIDGE.z + z, built, PLAYER_R)).toBe(true);
      }
    }
    expect(BRIDGE_DECK_Y - groundY(BRIDGE.x, BRIDGE.z)).toBeGreaterThan(0.6);
  });

  it("joins both banks continuously and leaves terrain and unbuilt/outside surfaces intact", () => {
    for (const side of [-1, 1]) {
      for (const join of [BRIDGE_SURFACE.halfLength, BRIDGE_SURFACE.approachEnd]) {
        const x = BRIDGE.x + side * join;
        expect(Math.abs(walkingSurfaceY(x - 0.001, BRIDGE.z, true) - walkingSurfaceY(x + 0.001, BRIDGE.z, true))).toBeLessThan(0.002);
      }
      const x = BRIDGE.x + side * BRIDGE_SURFACE.approachEnd;
      expect(walkingSurfaceY(x, BRIDGE.z, true)).toBeCloseTo(groundY(x, BRIDGE.z), 10);
    }
    expect(walkingSurfaceY(BRIDGE.x, BRIDGE.z, false)).toBe(groundY(BRIDGE.x, BRIDGE.z));
    expect(walkingSurfaceY(BRIDGE.x, BRIDGE.z + 0.8, true)).toBe(groundY(BRIDGE.x, BRIDGE.z + 0.8));
    expect(isWalkable(BRIDGE.x, BRIDGE.z + 0.8, built, PLAYER_R)).toBe(false);
    expect(isWalkable(BRIDGE.x, BRIDGE.z, { ...built, bridgeBuilt: false }, PLAYER_R)).toBe(false);
  });

  it("allows movement across both approaches in either direction without a water-height dip", () => {
    for (const side of [-1, 1]) {
      for (const z of [-0.4, 0.4]) {
        let at = { x: BRIDGE.x + side * 3.3, z: BRIDGE.z + z };
        for (let step = 0; step < 66; step++) {
          at = resolveCollisions(at.x - side * 0.1, at.z, PLAYER_R, [], built);
          if (Math.abs(at.x - BRIDGE.x) < BRIDGE_SURFACE.halfLength) {
            expect(walkingSurfaceY(at.x, at.z, true)).toBeCloseTo(BRIDGE_DECK_Y, 8);
          }
        }
        expect(at.x).toBeCloseTo(BRIDGE.x - side * 3.3, 5);
      }
    }
  });
});

describe("cave entrance trigger", () => {
  it("covers the visible opening, including corridor-centre and edge routes", () => {
    for (const x of [CAVE_CORRIDOR.x0 + PLAYER_R, 995, CAVE_CORRIDOR.x1 - PLAYER_R]) {
      expect(isAtCaveExit(x, 997.3)).toBe(true);
      expect(isWalkable(x, 997.3, built, PLAYER_R)).toBe(true);
    }
  });
  it("excludes the arrival point, chamber and other corridor exploration", () => {
    expect(isAtCaveExit(CAVE_ENTRY.x, CAVE_ENTRY.z)).toBe(false);
    expect(isAtCaveExit(CAVE_CHAMBER.x, CAVE_CHAMBER.z)).toBe(false);
    expect(isAtCaveExit(995, 992)).toBe(false);
    expect(isAtCaveExit(1002, 998)).toBe(false);
  });
});
