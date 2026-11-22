import { afterEach, describe, expect, it } from "vitest";
import {
  BARREL, CATCHER_SOCKETS, RACK_SOCKETS, START_HEIGHTS, catcherBuilt, catcherFlow, dryFish, fillBarrel, flowAnswer, openSockets,
  pourPoint, rackFrameComplete, rackSlots, rackStable, rackSway, toLocal, toWorld
} from "./structures";
import { FIRE_OUT_SECONDS, RAIN_DAY, SHOWER, easeRain, rainWanted } from "./weather";
import { BASE_STACK, STORAGE_STACK, addItem, setStackLimit, stackLimit } from "./inventory";

const FRAME = ["leg1", "leg2", "leg3", "leg4", "barN", "barS", "barW", "barE"];

describe("drying rack", () => {
  it("opens legs first, then bars resting on them, then braces on their bars", () => {
    expect(openSockets(RACK_SOCKETS, []).map((s) => s.id)).toEqual(["leg1", "leg2", "leg3", "leg4"]);
    const afterTwoLegs = openSockets(RACK_SOCKETS, ["leg1", "leg2"]).map((s) => s.id);
    expect(afterTwoLegs).toContain("barN");
    expect(afterTwoLegs).toContain("shelfN");
    expect(afterTwoLegs).not.toContain("barS");
    expect(afterTwoLegs).not.toContain("braceN");
    expect(openSockets(RACK_SOCKETS, FRAME).map((s) => s.id)).toEqual(["braceN", "braceS", "braceW", "braceE", "shelfN", "shelfS"]);
  });

  it("uses short poles only for the two end bars", () => {
    expect(RACK_SOCKETS.filter((s) => s.uses === "shortPole").map((s) => s.id).sort()).toEqual(["barE", "barW"]);
  });

  it("is a frame with four legs and four bars", () => {
    expect(rackFrameComplete(FRAME)).toBe(true);
    expect(rackFrameComplete(FRAME.slice(0, 7))).toBe(false);
  });

  it("only stops racking when braced on a long face and a short face", () => {
    expect(rackStable(FRAME)).toBe(false);
    expect(rackStable([...FRAME, "braceN", "braceS"])).toBe(false);
    expect(rackStable([...FRAME, "braceW", "braceE"])).toBe(false);
    expect(rackStable([...FRAME, "braceN", "braceE"])).toBe(true);
    expect(rackStable([...FRAME.slice(1), "braceN", "braceE"])).toBe(false);
  });

  it("sways in each direction that is not braced", () => {
    expect(rackSway(FRAME)).toEqual({ along: true, across: true });
    expect(rackSway([...FRAME, "braceS"])).toEqual({ along: false, across: true });
    expect(rackSway([...FRAME, "braceW"])).toEqual({ along: true, across: false });
    expect(rackSway([...FRAME, "braceS", "braceW"])).toEqual({ along: false, across: false });
    expect(rackSway([])).toEqual({ along: false, across: false });
  });

  it("has four drying places, and one more per shelf bar", () => {
    expect(rackSlots(FRAME.slice(0, 6))).toBe(0);
    expect(rackSlots(FRAME)).toBe(4);
    expect(rackSlots([...FRAME, "shelfN"])).toBe(5);
    expect(rackSlots([...FRAME, "shelfN", "shelfS"])).toBe(6);
  });

  it("dries fish with live time and never below zero", () => {
    expect(dryFish([45, 10, 0], 12)).toEqual([33, 0, 0]);
    expect(dryFish([5], -3)).toEqual([5]);
  });
});

describe("rain catcher flow", () => {
  const posts = ["post1", "post2", "post3", "post4"];
  // The barrel under corner 2's outlet.
  const under2 = pourPoint(2);

  it("needs four posts before the canvas", () => {
    expect(openSockets(CATCHER_SOCKETS, ["post1", "post2", "post3"]).map((s) => s.id)).toEqual(["post4"]);
    expect(openSockets(CATCHER_SOCKETS, posts).map((s) => s.id)).toEqual(["canvas"]);
    expect(catcherBuilt(posts)).toBe(false);
    expect(catcherBuilt([...posts, "canvas"])).toBe(true);
  });

  it("keeps the water on a flat canvas", () => {
    const f = catcherFlow(START_HEIGHTS, under2);
    expect(f).toMatchObject({ flat: true, streams: [], efficiency: 0, problem: "flat" });
    expect(flowAnswer(f)).toBe("notWork");
  });

  it("pours from the single lowest corner into a barrel under it", () => {
    const f = catcherFlow([2, 2, 1, 2], under2);
    expect(f.streams).toHaveLength(1);
    expect(f.streams[0]).toMatchObject({ corner: 2, share: 1, caught: true, tooLow: false });
    expect(f.efficiency).toBe(1);
    expect(f.problem).toBeNull();
    expect(flowAnswer(f)).toBe("flowing");
  });

  it("works at any corner when the barrel is under that corner", () => {
    for (let c = 0; c < 4; c++) {
      const heights = [2, 2, 2, 2];
      heights[c] = 1;
      expect(catcherFlow(heights, pourPoint(c)).problem).toBeNull();
    }
  });

  it("misses when the barrel is not under the outlet, or not there at all", () => {
    expect(catcherFlow([2, 2, 1, 2], pourPoint(0)).problem).toBe("missed");
    expect(catcherFlow([2, 2, 1, 2], null)).toMatchObject({ problem: "missed", efficiency: 0 });
    // Just inside the mouth's slack still counts.
    const edge = { x: under2.x + BARREL.mouth + BARREL.slack - 0.01, z: under2.z };
    expect(catcherFlow([2, 2, 1, 2], edge).efficiency).toBe(1);
  });

  it("splits the water between equally low corners", () => {
    const f = catcherFlow([1, 1, 2, 2], pourPoint(0));
    expect(f.streams.map((s) => s.share)).toEqual([0.5, 0.5]);
    expect(f.efficiency).toBe(0.5);
    expect(f.problem).toBe("split");
    expect(flowAnswer(f)).toBe("notWork");
  });

  it("calls a corner below the barrel's rim too low, even right over it", () => {
    const f = catcherFlow([2, 2, 0, 2], under2);
    expect(f.streams[0]).toMatchObject({ tooLow: true, caught: false });
    expect(f.problem).toBe("tooLow");
    expect(flowAnswer(f)).toBe("tooLow");
  });

  it("fills the barrel by efficiency and rain, up to its capacity", () => {
    expect(fillBarrel(0, 6, 1, 1)).toBeCloseTo(1);
    expect(fillBarrel(0, 6, 1, 0.5)).toBeCloseTo(0.5);
    expect(fillBarrel(0, 6, 0, 1)).toBe(0);
    expect(fillBarrel(11.9, 60, 1, 1)).toBe(BARREL.capacity);
  });

  it("converts between a structure's frame and the world", () => {
    const b = { x: 4, z: -2, rot: 0.7 };
    const w = toWorld(b, 1.2, -0.5);
    const back = toLocal(b, w.x, w.z);
    expect(back.x).toBeCloseTo(1.2);
    expect(back.z).toBeCloseTo(-0.5);
  });
});

describe("weather", () => {
  it("is dry on Days 1–7 and rains on Day 8 until it stops", () => {
    for (let day = 1; day < RAIN_DAY; day++) expect(rainWanted(day, 0.3, false)).toBe(false);
    expect(rainWanted(RAIN_DAY, 0, false)).toBe(true);
    expect(rainWanted(RAIN_DAY, 0.9, false)).toBe(true);
    expect(rainWanted(RAIN_DAY, 0, true)).toBe(false);
  });

  it("has one fixed shower a day in free play", () => {
    expect(rainWanted(9, SHOWER.from - 0.01, false)).toBe(false);
    expect(rainWanted(9, SHOWER.from, false)).toBe(true);
    expect(rainWanted(12, (SHOWER.from + SHOWER.to) / 2, false)).toBe(true);
    expect(rainWanted(9, SHOWER.to, false)).toBe(false);
  });

  it("eases in over about 3 s and out over about 5 s", () => {
    expect(easeRain(0, true, 1.5)).toBeCloseTo(0.5);
    expect(easeRain(0, true, 10)).toBe(1);
    expect(easeRain(1, false, 2.5)).toBeCloseTo(0.5);
    expect(easeRain(0.2, false, 10)).toBe(0);
    expect(FIRE_OUT_SECONDS).toBeGreaterThan(0);
  });
});

describe("stack limit", () => {
  afterEach(() => setStackLimit(BASE_STACK));

  it("doubles with a storage box", () => {
    expect(stackLimit()).toBe(BASE_STACK);
    expect(addItem({ wood: 9 }, "wood", 5).added).toBe(1);
    setStackLimit(STORAGE_STACK);
    expect(addItem({ wood: 9 }, "wood", 5)).toEqual({ bag: { wood: 14 }, added: 5 });
    expect(addItem({ wood: 19 }, "wood", 5).added).toBe(1);
  });
});
