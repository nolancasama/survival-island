import { describe, expect, it } from "vitest";
import { CAP, DUSK, EVENING_SECONDS, advanceClock, canSleepAt, dayStartT, faintPenalty, isNight, lightAt, storyFloor } from "./clock";
import { advanceDay, evaluate, readyToSleep, type Facts } from "./quest";
import { cookFish } from "./crafting";
import { afterSleep, consume, tickStats } from "./stats";
import { loadSaveText } from "./save";

const facts = (x: Partial<Facts> = {}): Facts => ({ ate: 1, metKai: true, bag: {}, crafted: [], placed: [], litFires: 1, pathCleared: false, bridgeBuilt: false, builtShelters: 0, gotWater: 0, drank: 0, caught: 0, cooked: 0, sleptDay: 0, ...x });
describe("Phase 2 quest and clock", () => {
  it("supports ordered and out-of-order Day 2 progress and sleep", () => {
    const q = evaluate({ day: 2, done: [], complete: false }, facts({ bag: { wood: 4, leaves: 4 }, crafted: ["axe", "shelter"], pathCleared: true, builtShelters: 1 }));
    expect(readyToSleep(q)).toBe(true); expect(q.done).toEqual(expect.arrayContaining(["axe", "path", "leaves", "wood", "shelter", "build"]));
    expect(evaluate(q, facts({ sleptDay: 2 })).complete).toBe(true);
  });
  it("makes bridge sticky when advancing to Day 3 and Day 4 is free play", () => {
    const q = advanceDay({ day: 2, done: [], complete: true }, facts({ bridgeBuilt: true }));
    expect(q.done).toContain("bridge"); const free = advanceDay({ day: 3, done: [], complete: true }, facts()); expect(readyToSleep(free)).toBe(false); expect(free.complete).toBe(false);
  });
  it("caps daylight, reaches night after evening, and supplies scene values", () => {
    expect(advanceClock(CAP - .01, 99, { capped: true })).toBe(CAP); expect(advanceClock(CAP, EVENING_SECONDS, { capped: false })).toBeCloseTo(1); expect(isNight(DUSK)).toBe(true); expect(canSleepAt(CAP)).toBe(true); expect(storyFloor(3, 7)).toBeCloseTo(CAP / 2); expect(dayStartT(1)).toBeGreaterThan(0); expect(dayStartT(2)).toBe(0); expect(lightAt(0)).toBeGreaterThan(lightAt(1)); expect(faintPenalty(CAP - .01, true)).toBe(CAP);
  });
  it("does not move the clock backwards when it is already past a cap", () => {
    expect(advanceClock(CAP + 0.1, 1, { capped: true })).toBe(CAP + 0.1);
  });
});
describe("Phase 2 survival", () => {
  it("slows cold night rest, shelters restore by day, and sleep has a food floor", () => {
    const base = { hp: 80, stamina: 10, food: 80 }; const night = tickStats(base, { dt: 1, moving: false, running: false, nearFire: false, night: true }).stats.stamina; const shelter = tickStats(base, { dt: 1, moving: false, running: false, nearFire: false, nearShelter: true }).stats.stamina;
    expect(night).toBeLessThan(20); expect(shelter).toBe(35); expect(afterSleep({ hp: 2, stamina: 2, food: 10 })).toEqual({ hp: 100, stamina: 100, food: 30 }); expect(consume(base, { food: 5, stamina: 30 }).stamina).toBe(40);
  });
  it("cooks fish once", () => { expect(cookFish({ fish: 1 })).toEqual({ grilledFish: 1 }); expect(cookFish({})).toBeNull(); });
});
describe("v1 migration", () => {
  it("loads a valid v1 into v3 defaults, including completed Day 1 at night", () => {
    const old = { v: 1, savedAt: 1, quest: { day: 1, done: ["eat", "kai", "wood", "stone", "craft", "place", "light"], complete: true }, bag: {}, stats: { hp: 1, stamina: 2, food: 3 }, known: [], unlocked: [], crafted: [], buildings: [], taken: {}, crateOpened: false, metKai: false, ate: 0, kai: {}, player: { x: 0, z: 0, yaw: 0 }, light: .5, said: [] };
    const got = loadSaveText(null, JSON.stringify(old)); expect(got?.v).toBe(3); expect(got?.t).toBe(1); expect(got?.quest.done).not.toContain("sleep"); expect(loadSaveText(JSON.stringify({ v: 99 }), JSON.stringify({}))).toBeNull();
  });
});
