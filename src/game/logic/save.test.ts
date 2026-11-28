import { describe, expect, it } from "vitest";
import { loadSaveText, parseSave, serialize, type SaveData } from "./save";
import { START_QUEST } from "./quest";
import { START_STATS } from "./stats";

const sample = (): SaveData => ({
  v: 5,
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
  kaiStage: "camp",
  boiled: 0,
  boiledDay: 0,
  coveOpen: false,
  groveOpen: false,
  reachedCove: false,
  coveBoxOpened: false,
  asked: [],
  chestTaken: false,
  barrelTaken: false,
  carry: null,
  fishDried: 0,
  rainCaught: 0,
  rainDone: false,
  radioTried: false,
  reachedUpper: false,
  stairsOpen: false,
  bucketFilled: false,
  tankFilled: false,
  water: { joints: [], pipes: [], next: 1 }
});

const V5_KEYS = ["radioTried", "reachedUpper", "stairsOpen", "bucketFilled", "tankFilled", "water"];
/** The sample as a Chapter 2 (v4) save. */
const sampleV4 = (): Record<string, unknown> => {
  const old = { ...sample(), v: 4 } as Record<string, unknown>;
  for (const key of V5_KEYS) delete old[key];
  return old;
};
const V4_KEYS = ["boiled", "boiledDay", "coveOpen", "groveOpen", "reachedCove", "coveBoxOpened", "asked", "chestTaken", "barrelTaken", "carry", "fishDried", "rainCaught", "rainDone"];
/** The sample as a Phase 3 (v3) save. */
const sampleV3 = (): Record<string, unknown> => {
  const old = { ...sampleV4(), v: 3 } as Record<string, unknown>;
  for (const key of V4_KEYS) delete old[key];
  return old;
};

describe("save", () => {
  it("round-trips", () => {
    const s = sample();
    expect(parseSave(serialize(s))).toEqual(s);
  });

  it("loads existing tent and cup saves with their original identifiers", () => {
    const old = sample();
    old.bag = { container: 1, shelter: 1, water: 1 };
    old.buildings.push({ id: "old-tent", type: "shelter", x: 6, z: 5, rot: 0, built: true });
    old.known = old.said = ["craftShelter", "buildShelter", "craftContainer"];
    old.unlocked = old.crafted = ["shelter", "container"];
    expect(parseSave(serialize(old))).toEqual(old);
  });

  it("preserves Escape morning completion and rejects a malformed completion flag", () => {
    const s = sample();
    s.quest = { day: 5, done: [], complete: false };
    s.kai.escapeMorning = true;
    expect(parseSave(serialize(s))?.kai.escapeMorning).toBe(true);
    expect(parseSave(JSON.stringify({ ...s, kai: { ...s.kai, escapeMorning: "yes" } }))).toBeNull();
  });

  it("discards other versions, junk and missing fields whole", () => {
    expect(parseSave(null)).toBeNull();
    expect(parseSave("not json")).toBeNull();
    expect(parseSave(JSON.stringify({ ...sample(), v: 4 }))).toBeNull();
    expect(parseSave(JSON.stringify({ ...sample(), water: { joints: [{ id: "j1", x: 0 }], pipes: [], next: 2 } }))).toBeNull();
    expect(parseSave(JSON.stringify({ ...sample(), kaiStage: "moon" }))).toBeNull();
    expect(parseSave(JSON.stringify({ ...sample(), carry: "boat" }))).toBeNull();
    const broken = sample() as unknown as Record<string, unknown>;
    delete broken.stats;
    expect(parseSave(JSON.stringify(broken))).toBeNull();
    expect(parseSave(JSON.stringify({ ...sample(), bag: { gold: 5 } }))).toBeNull();
    expect(parseSave(JSON.stringify({ ...sample(), known: ["sing"] }))).toBeNull();
  });

  it("migrates a v3 save: its water becomes boiled water and the boil step counts as done", () => {
    const old = { ...sampleV3(), bag: { water: 2, wood: 1 }, quest: { day: 3, done: ["eat"], complete: false } };
    const migrated = loadSaveText(null, null, JSON.stringify(old));
    expect(migrated).toMatchObject({ v: 5, bag: { boiledWater: 2, wood: 1 }, boiled: 1, quest: { day: 3 }, carry: null, coveOpen: false, asked: [] });
    expect(migrated?.bag.water).toBeUndefined();
  });

  it("resumes v3 free play at the Day 6 morning", () => {
    const old = { ...sampleV3(), quest: { day: 7, done: [], complete: false }, rescued: true, kaiStage: "clifftop" };
    const migrated = loadSaveText(null, null, JSON.stringify(old));
    // The old rescue counts as the radio call; the rescue itself is now the ending.
    expect(migrated).toMatchObject({ v: 5, quest: { day: 6, done: [], complete: false }, sleptDay: 5, kaiStage: "camp", radioTried: true, rescued: false });
  });

  it("migrates a v4 save: the rescue becomes the tried radio call, with an empty network", () => {
    const old = { ...sampleV4(), quest: { day: 7, done: ["grove"], complete: false }, rescued: true, sleptDay: 6, carry: "chest" };
    const migrated = loadSaveText(null, JSON.stringify(old));
    expect(migrated).toMatchObject({ v: 5, quest: { day: 7, done: ["grove"] }, radioTried: true, rescued: false, carry: "chest", stairsOpen: false, water: { joints: [], pipes: [] } });
  });

  it("resumes v4 free play at the Day 9 morning, and keeps a Day 5 save waiting for its radio call", () => {
    const free = loadSaveText(null, JSON.stringify({ ...sampleV4(), quest: { day: 12, done: [], complete: false }, rescued: true, sleptDay: 11 }));
    expect(free).toMatchObject({ quest: { day: 9, done: [], complete: false }, sleptDay: 8, kaiStage: "camp", radioTried: true });
    const lit = loadSaveText(null, JSON.stringify({ ...sampleV4(), quest: { day: 5, done: ["cliff"], complete: false }, signalLit: true, rescued: false }));
    expect(lit).toMatchObject({ quest: { day: 5 }, signalLit: true, radioTried: false });
  });

  it("round-trips a water network, the tank carry and Kai on the shelf", () => {
    const s = sample();
    s.water = { joints: [{ id: "j1", x: -42.5, z: -4.3, notch: 2 }], pipes: [{ id: "p2", from: "i:lower", to: "j1", kind: "short" }], next: 3 };
    s.carry = "tank";
    s.kaiStage = "upper";
    s.kai = { ...s.kai, upperMorning: true, seen: "waterfall", pipePlan: true };
    s.buildings.push({ id: "bk", type: "bucket", x: -49, z: -9.6, rot: 0, water: 2 });
    expect(parseSave(serialize(s))).toEqual(s);
    expect(parseSave(JSON.stringify({ ...s, kai: { ...s.kai, seen: "moon" } }))).toBeNull();
  });

  it("prefers a valid v5 save over an older key", () => {
    expect(loadSaveText(serialize(sample()), JSON.stringify(sampleV4()))?.v).toBe(5);
  });

  it("migrates a valid v2 save and resets its old free play to Day 4 morning", () => {
    const old = { ...sampleV3(), v: 2, quest: { day: 4, done: [], complete: false } };
    delete (old as Partial<SaveData>).enteredCave; delete (old as Partial<SaveData>).caveBoxOpened; delete (old as Partial<SaveData>).cliffOpen;
    delete (old as Partial<SaveData>).reachedClifftop; delete (old as Partial<SaveData>).signalLit; delete (old as Partial<SaveData>).rescued; delete (old as Partial<SaveData>).kaiStage;
    const migrated = loadSaveText(null, null, null, JSON.stringify(old));
    expect(migrated).toMatchObject({ v: 5, quest: { day: 4, done: [], complete: false }, t: 0, sleptDay: 3, enteredCave: false, kaiStage: "camp" });
  });

  it("migrates v1 through v2", () => {
    const old: Record<string, unknown> = { ...sampleV3(), v: 1 };
    for (const key of ["t", "pathCleared", "bridgeBuilt", "gotWater", "drank", "caught", "cooked", "sleptDay", "enteredCave", "caveBoxOpened", "cliffOpen", "reachedClifftop", "signalLit", "rescued", "kaiStage"]) delete old[key];
    expect(loadSaveText(null, null, null, null, JSON.stringify(old))?.v).toBe(5);
  });
});
