import { describe, expect, it } from "vitest";
import { parseSave, serialize, type SaveData } from "./save";
import { START_QUEST } from "./quest";
import { START_STATS } from "./stats";

const sample = (): SaveData => ({
  v: 2,
  savedAt: 1,
  quest: { ...START_QUEST, done: ["eat", "kai"] },
  bag: { wood: 2, coconut: 1 },
  stats: { ...START_STATS },
  known: ["getWood", "eatCoconut"],
  unlocked: ["campfire"],
  crafted: [],
  buildings: [{ id: "b1", type: "campfire", x: 1, z: 2, rot: 0, lit: false }],
  taken: { "wood-1": 30 },
  crateOpened: true,
  metKai: true,
  ate: 1,
  kai: { need: "food", canFire: true },
  player: { x: 1, z: 2, yaw: 0.5 },
  light: 0.8,
  said: ["hungry", "getWood"]
  ,t: 0.2,
  pathCleared: false,
  bridgeBuilt: false,
  gotWater: 0,
  drank: 0,
  caught: 0,
  cooked: 0,
  sleptDay: 0
});

describe("save", () => {
  it("round-trips", () => {
    const s = sample();
    expect(parseSave(serialize(s))).toEqual(s);
  });

  it("discards other versions, junk and missing fields whole", () => {
    expect(parseSave(null)).toBeNull();
    expect(parseSave("not json")).toBeNull();
    expect(parseSave(JSON.stringify({ ...sample(), v: 3 }))).toBeNull();
    const broken = sample() as unknown as Record<string, unknown>;
    delete broken.stats;
    expect(parseSave(JSON.stringify(broken))).toBeNull();
    expect(parseSave(JSON.stringify({ ...sample(), bag: { gold: 5 } }))).toBeNull();
    expect(parseSave(JSON.stringify({ ...sample(), known: ["sing"] }))).toBeNull();
  });
});
