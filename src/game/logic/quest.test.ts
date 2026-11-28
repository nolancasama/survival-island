import { describe, expect, it } from "vitest";
import { START_QUEST, advanceDay, currentStep, dayDef, evaluate, newlyDone, readyToSleep, stepGoal, type Facts } from "./quest";
import { craft } from "./crafting";
import type { Bag } from "../types";

const facts = (f: Partial<Facts> = {}): Facts => ({ ate: 0, metKai: false, bag: {}, crafted: [], placed: [], litFires: 0, pathCleared: false, bridgeBuilt: false, builtShelters: 0, gotWater: 0, drank: 0, caught: 0, cooked: 0, sleptDay: 0, ...f });

describe("quest (Day 1)", () => {
  it("starts at 'Eat something'", () => {
    expect(currentStep(START_QUEST)?.id).toBe("eat");
  });

  it("plays through the whole day in order", () => {
    let q = START_QUEST;
    let bag: Bag = {};
    q = evaluate(q, facts({ ate: 1 }));
    expect(currentStep(q)?.id).toBe("kai");
    q = evaluate(q, facts({ ate: 1, metKai: true }));
    expect(currentStep(q)?.id).toBe("wood");
    bag = { wood: 3, stone: 2 };
    q = evaluate(q, facts({ ate: 1, metKai: true, bag }));
    expect(currentStep(q)?.id).toBe("craft");
    bag = craft(bag, "campfire", ["campfire"])!;
    q = evaluate(q, facts({ ate: 1, metKai: true, bag, crafted: ["campfire"] }));
    expect(currentStep(q)?.id).toBe("place");
    expect(q.complete).toBe(false);
    q = evaluate(q, facts({ ate: 1, metKai: true, bag: {}, crafted: ["campfire"], placed: ["campfire"] }));
    expect(currentStep(q)?.id).toBe("light");
    q = evaluate(q, facts({ ate: 1, metKai: true, crafted: ["campfire"], placed: ["campfire"], litFires: 1 }));
    expect(currentStep(q)?.id).toBe("sleep");
    q = evaluate(q, facts({ ate: 1, metKai: true, crafted: ["campfire"], placed: ["campfire"], litFires: 1, sleptDay: 1 }));
    expect(q.complete).toBe(true);
    expect(currentStep(q)).toBeNull();
  });

  it("steps are sticky: spending wood on the campfire never un-ticks 'Get wood'", () => {
    let q = evaluate(START_QUEST, facts({ bag: { wood: 3 } }));
    expect(q.done).toContain("wood");
    q = evaluate(q, facts({ bag: {} }));
    expect(q.done).toContain("wood");
  });

  it("steps can finish out of order (gathering before meeting Kai)", () => {
    const q = evaluate(START_QUEST, facts({ bag: { wood: 3, stone: 2 } }));
    expect(q.done).toEqual(["wood", "stone"]);
    expect(currentStep(q)?.id).toBe("eat");
  });

  it("returns the same object when nothing changed (no needless re-renders)", () => {
    const q = evaluate(START_QUEST, facts({ ate: 1 }));
    expect(evaluate(q, facts({ ate: 1 }))).toBe(q);
  });

  it("reports newly done steps", () => {
    const a = evaluate(START_QUEST, facts({ ate: 1 }));
    const b = evaluate(a, facts({ ate: 1, metKai: true, bag: { wood: 4 } }));
    expect(newlyDone(a, b)).toEqual(["kai", "wood"]);
  });
});

describe("quest (Days 4–5)", () => {
  it("ticks Day 4 in order and keeps metal after crafting", () => {
    let q: import("./quest").QuestState = { day: 4, done: [], complete: false };
    q = evaluate(q, facts({ crafted: ["torch"] }));
    q = evaluate(q, facts({ crafted: ["torch"], enteredCave: true }));
    q = evaluate(q, facts({ crafted: ["torch"], enteredCave: true, bag: { metal: 2 } }));
    q = evaluate(q, facts({ crafted: ["torch"], enteredCave: true, caveBoxOpened: true, bag: { metal: 2 } }));
    q = evaluate(q, facts({ crafted: ["torch"], enteredCave: true, caveBoxOpened: true, kaiHave: "radio", bag: { metal: 2 } }));
    expect(q.done).toEqual(["torch", "cave", "metal", "radio", "showKai"]);
    q = evaluate(q, facts({ sleptDay: 4 }));
    expect(q.complete).toBe(true);
  });

  it("is order-independent, uses classroom counts, and ends Day 5 on the radio call (no sleep)", () => {
    const day4 = evaluate({ day: 4, done: [], complete: false }, facts({ enteredCave: true, caveBoxOpened: true, kaiHave: "metal", bag: { metal: 1 }, crafted: ["torch"], classroom: true }));
    expect(day4.done).toEqual(["torch", "cave", "metal", "radio", "showKai"]);
    const q = evaluate({ day: 5, done: [], complete: false }, facts({ cliffOpen: true, bag: { wood: 4, leaves: 3 }, crafted: ["signalFire"], reachedClifftop: true, signalLit: true, radioTried: true }));
    expect(q.complete).toBe(true);
    // The rescue is the final chapter now: a rescue alone does not finish Day 5.
    expect(evaluate({ day: 5, done: [], complete: false }, facts({ cliffOpen: true, bag: { wood: 4, leaves: 3 }, crafted: ["signalFire"], reachedClifftop: true, signalLit: true, rescued: true })).complete).toBe(false);
    expect(readyToSleep(q)).toBe(false);
    expect(stepGoal(dayDef(5).steps.find(s => s.id === "wood")!, true)).toEqual({ item: "wood", n: 2 });
  });

  it("advances into Days 4 and 5, then Chapters 2 and 3, and free play after Day 10", () => {
    expect(advanceDay({ day: 3, done: [], complete: true }, facts()).day).toBe(4);
    expect(advanceDay({ day: 4, done: [], complete: true }, facts()).day).toBe(5);
    expect(dayDef(6).steps.map((s) => s.id)).toContain("cove");
    expect(dayDef(8).steps.map((s) => s.id)).toContain("catchRain");
    expect(dayDef(9).steps.map((s) => s.id)).toEqual(["upper", "pipePlan", "tangle", "bucket", "sleep"]);
    expect(dayDef(10).steps.map((s) => s.id)).toEqual(["poles", "pipeCamp", "fillTank", "boilTank", "sleep"]);
    expect(dayDef(11).steps).toEqual([]);
  });
});

describe("quest (Chapter 3)", () => {
  it("ticks Day 9 from the world facts, and Day 10's poles stay done once water reaches camp", () => {
    const day9 = evaluate({ day: 9, done: [], complete: false }, facts({ reachedUpper: true, pipePlan: true, stairsOpen: true, bucketFilled: true }));
    expect(day9.done).toEqual(["upper", "pipePlan", "tangle", "bucket"]);
    expect(readyToSleep(day9)).toBe(true);
    const day10 = evaluate({ day: 10, done: [], complete: false }, facts({ pipeAtCamp: true, tankFilled: true, boiledDay: 10, bag: {} }));
    expect(day10.done).toEqual(["poles", "pipeCamp", "fillTank", "boilTank"]);
    expect(stepGoal(dayDef(10).steps[0], true)).toEqual({ item: "pole", n: 6 });
  });
});
