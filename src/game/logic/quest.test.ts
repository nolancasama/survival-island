import { describe, expect, it } from "vitest";
import { START_QUEST, currentStep, evaluate, newlyDone, type Facts } from "./quest";
import { craft } from "./crafting";
import type { Bag } from "../types";

const facts = (f: Partial<Facts> = {}): Facts => ({ ate: 0, metKai: false, bag: {}, crafted: [], placed: [], litFires: 0, ...f });

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
