import { describe, expect, it } from "vitest";
import { dayStartState, KNOWN_BY_DAY } from "./dayStart";
import { catcherFlow, toLocal } from "../logic/structures";
import { DAYS } from "../logic/quest";

describe("debug day start", () => {
  it("leaves each day's previous day complete, so the next morning plays", () => {
    for (let n = 2; n <= 9; n++) {
      const s = dayStartState(n);
      expect(s.quest).toEqual({ day: n - 1, done: DAYS.find((d) => d.day === n - 1)!.steps.map((x) => x.id), complete: true });
      expect(s.sleptDay).toBe(n - 1);
    }
  });

  it("knows only the English of the days before", () => {
    const day2 = dayStartState(2);
    expect(day2.known).toEqual(expect.arrayContaining(KNOWN_BY_DAY[1]));
    expect(day2.known).not.toContain("craftAxe");
    expect(dayStartState(8).known).toEqual(expect.arrayContaining(["putHere", "tooLong", "dryFish"]));
  });

  it("grows the camp with the story", () => {
    const types = (n: number) => dayStartState(n).buildings!.map((b) => b.type).sort();
    expect(types(2)).toEqual(["campfire"]);
    expect(types(3)).toEqual(["campfire", "shelter"]);
    expect(types(7)).toEqual(["campfire", "shelter", "storage"]);
    expect(types(8)).toEqual(["campfire", "rack", "shelter", "storage"]);
    expect(types(9)).toEqual(["barrel", "campfire", "catcher", "rack", "shelter", "storage"]);
    const seven = dayStartState(7);
    expect(seven).toMatchObject({ rescued: true, coveOpen: true, chestTaken: true, groveOpen: false });
    expect(dayStartState(8)).toMatchObject({ groveOpen: true, barrelTaken: false });
  });

  it("puts Day 9's barrel under the working catcher's stream", () => {
    const b = dayStartState(9).buildings!;
    const catcher = b.find((x) => x.type === "catcher")!;
    const barrel = b.find((x) => x.type === "barrel")!;
    expect(catcherFlow(catcher.heights!, toLocal(catcher, barrel.x, barrel.z)).problem).toBeNull();
  });
});
