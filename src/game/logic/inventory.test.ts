import { describe, expect, it } from "vitest";
import { BASE_STACK, addItem, count, hasAll, isFull, missing, removeAll } from "./inventory";

describe("inventory", () => {
  it("adds and counts", () => {
    const { bag, added } = addItem({}, "wood", 2);
    expect(added).toBe(2);
    expect(count(bag, "wood")).toBe(2);
    expect(count(bag, "stone")).toBe(0);
  });

  it("never goes past the stack limit and reports what fitted", () => {
    let bag = addItem({}, "stone", BASE_STACK - 1).bag;
    const r = addItem(bag, "stone", 5);
    expect(r.added).toBe(1);
    expect(count(r.bag, "stone")).toBe(BASE_STACK);
    bag = r.bag;
    expect(isFull(bag, "stone")).toBe(true);
    const again = addItem(bag, "stone", 1);
    expect(again.added).toBe(0);
    expect(again.bag).toBe(bag);
  });

  it("does not mutate the original bag", () => {
    const bag = { wood: 1 };
    addItem(bag, "wood", 1);
    expect(bag.wood).toBe(1);
  });

  it("checks and lists what is missing", () => {
    const bag = { wood: 3, stone: 1 };
    expect(hasAll(bag, { wood: 3 })).toBe(true);
    expect(hasAll(bag, { wood: 3, stone: 2 })).toBe(false);
    expect(missing(bag, { wood: 2, stone: 2, rope: 1 })).toEqual({ stone: 1, rope: 1 });
  });

  it("removes all or nothing", () => {
    expect(removeAll({ wood: 3, stone: 2 }, { wood: 3, stone: 1 })).toEqual({ stone: 1 });
    expect(removeAll({ wood: 2 }, { wood: 3 })).toBeNull();
  });
});
