import { describe, expect, it } from "vitest";
import { loadSaveText, parseSave, serialize, type SaveData } from "./save";
import { START_QUEST } from "./quest";
import { START_STATS } from "./stats";

const sample = (): SaveData => ({
  v: 3,
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
  sleptDay: 0,
  enteredCave: false,
  caveBoxOpened: false,
  cliffOpen: false,
  reachedClifftop: false,
  signalLit: false,
  rescued: false,
  kaiStage: "camp"
});

describe("save", () => {
  it("round-trips", () => {
    const s = sample();
    expect(parseSave(serialize(s))).toEqual(s);
  });

  it("discards other versions, junk and missing fields whole", () => {
    expect(parseSave(null)).toBeNull();
    expect(parseSave("not json")).toBeNull();
    expect(parseSave(JSON.stringify({ ...sample(), v: 4 }))).toBeNull();
    const broken = sample() as unknown as Record<string, unknown>;
    delete broken.stats;
    expect(parseSave(JSON.stringify(broken))).toBeNull();
    expect(parseSave(JSON.stringify({ ...sample(), bag: { gold: 5 } }))).toBeNull();
    expect(parseSave(JSON.stringify({ ...sample(), known: ["sing"] }))).toBeNull();
  });

  it("migrates a valid v2 save and resets its old free play to Day 4 morning", () => {
    const old = { ...sample(), v: 2, quest: { day: 4, done: [], complete: false } };
    delete (old as Partial<SaveData>).enteredCave; delete (old as Partial<SaveData>).caveBoxOpened; delete (old as Partial<SaveData>).cliffOpen;
    delete (old as Partial<SaveData>).reachedClifftop; delete (old as Partial<SaveData>).signalLit; delete (old as Partial<SaveData>).rescued; delete (old as Partial<SaveData>).kaiStage;
    const migrated = loadSaveText(null, JSON.stringify(old), null);
    expect(migrated).toMatchObject({ v: 3, quest: { day: 4, done: [], complete: false }, t: 0, sleptDay: 3, enteredCave: false, kaiStage: "camp" });
  });

  it("migrates v1 through v2", () => {
    const old = { ...sample(), v: 1 } as Record<string, unknown>;
    for (const key of ["t", "pathCleared", "bridgeBuilt", "gotWater", "drank", "caught", "cooked", "sleptDay", "enteredCave", "caveBoxOpened", "cliffOpen", "reachedClifftop", "signalLit", "rescued", "kaiStage"]) delete old[key];
    expect(loadSaveText(null, null, JSON.stringify(old))?.v).toBe(3);
  });
});
