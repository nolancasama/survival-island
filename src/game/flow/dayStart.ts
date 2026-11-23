import type { GameState } from "../store";
import { rt } from "../runtime";
import { DAYS } from "../logic/quest";
import type { PhraseId } from "../logic/english";
import { pourPoint, toWorld } from "../logic/structures";
import type { Bag, CraftId } from "../types";
import type { PlacedBuilding } from "../world/placement";

/**
 * The story as if days 1..n-1 had been played, for the debug day picker
 * (?debug=1) and the test hook: their facts, recipes and English, a lit
 * campfire on the beach, a built tent from Day 3 on, the Chapter 2 camp as it
 * grows, and a typical bag. The quest is the day before, complete, so
 * nextDay() then plays day n's real morning.
 */

/** English a student has used by the end of each story day. */
export const KNOWN_BY_DAY: Record<number, PhraseId[]> = {
  1: ["hungry", "getCoconut", "eatCoconut", "needWood", "yesICan", "getWood", "getStone", "craftCampfire", "makeFire", "sleep"],
  2: ["yesICan", "craftAxe", "cutTree", "getLeaves", "craftShelter", "buildShelter", "sleep"],
  3: ["wantWater", "openBox", "buildBridge", "craftContainer", "getWater", "boilWater", "drinkWater", "craftRod", "catchFish", "cookFish", "eatFish", "sleep"],
  4: ["yesICan", "craftTorch", "goCave", "getMetal", "openBox", "haveRadio", "sleep"],
  5: ["canHelp", "craftSignalFire", "makeFire", "needHelp"],
  6: ["askWhat", "openBox", "getCanvas", "getRope", "carryBox", "tooHeavy", "canHelp", "goBack", "putHere", "foundBox", "sleep"],
  7: ["cutBamboo", "buildRack", "putHere", "tooLong", "dryFish", "sleep"],
  8: ["raining", "weNeedWater", "carryBarrel", "higher", "lower", "flowing", "notWork", "tryAgain", "boilWater", "sleep"]
};
const UNLOCKED_BY_DAY: Record<number, CraftId[]> = { 1: ["campfire"], 2: ["axe", "shelter"], 3: ["container", "rod"], 4: ["torch", "signalFire"] };

/** Where the camp stands: the Day 1 fire on the beach, the tent beside it (ids are kept for the e2e specs). */
export const CAMP_FIRE = { id: "bE2eFire", x: 2, z: 5 } as const;
export const CAMP_SHELTER = { id: "bE2eShelter", x: -3, z: 5 } as const;

/** Story state at the start of day n (2–9). UI fields (screen, mode, prompts) are the caller's. */
export function dayStartState(n: number): Partial<GameState> {
  const before = Math.max(1, n - 1);
  const known: PhraseId[] = [];
  const unlocked: CraftId[] = [];
  for (let d = 1; d <= before; d++) {
    for (const p of KNOWN_BY_DAY[d] ?? []) if (!known.includes(p)) known.push(p);
    for (const c of UNLOCKED_BY_DAY[d] ?? []) if (!unlocked.includes(c)) unlocked.push(c);
  }
  const buildings: PlacedBuilding[] = [{ id: CAMP_FIRE.id, type: "campfire", x: CAMP_FIRE.x, z: CAMP_FIRE.z, rot: 0, lit: true }];
  if (n >= 3) buildings.push({ id: CAMP_SHELTER.id, type: "shelter", x: CAMP_SHELTER.x, z: CAMP_SHELTER.z, rot: 0, built: true });
  const bag: Bag = n >= 4 ? { coconut: 1, wood: 1, axe: 1, container: 1, rod: 1 } : n >= 3 ? { coconut: 1, wood: 1, axe: 1 } : { coconut: 1 };
  const crafted: CraftId[] = n >= 4 ? ["campfire", "axe", "shelter", "container", "rod"] : n >= 3 ? ["campfire", "axe", "shelter"] : ["campfire"];
  if (n >= 5) {
    Object.assign(bag, { torch: 1, radio: 1, metal: 2 });
    crafted.push("torch");
  }
  // Chapter 2 days: the rescue is done; Day 7 has the storage box, Day 8 the strong rack, Day 9 the rain catcher.
  if (n >= 6) crafted.push("signalFire");
  if (n >= 7) {
    buildings.push({ id: "bE2eStorage", type: "storage", x: CAMP_FIRE.x + 2.6, z: CAMP_FIRE.z - 1.8, rot: 0 });
    Object.assign(bag, { canvas: 2, rope: 2 });
  }
  if (n >= 8) {
    buildings.push({
      id: "bE2eRack", type: "rack", x: CAMP_FIRE.x + 5, z: CAMP_FIRE.z + 1.5, rot: 0,
      parts: ["leg1", "leg2", "leg3", "leg4", "barN", "barS", "barW", "barE", "braceN", "braceW"], fish: []
    });
    Object.assign(bag, { driedFish: 1 });
  }
  if (n >= 9) {
    // The working rain catcher: corner 2 lowest, the barrel under its stream, some rain water in it.
    const catcher: PlacedBuilding = {
      id: "bE2eCatcher", type: "catcher", x: CAMP_SHELTER.x + 2, z: CAMP_SHELTER.z + 5, rot: 0,
      parts: ["post1", "post2", "post3", "post4", "canvas"], heights: [2, 2, 1, 2]
    };
    const under = pourPoint(2);
    const at = toWorld(catcher, under.x, under.z);
    buildings.push(catcher, { id: "bE2eBarrel", type: "barrel", x: at.x, z: at.z, rot: 0, water: 4 });
    Object.assign(bag, { boiledWater: 1 });
  }
  const lastDay = DAYS.find((d) => d.day === before);
  return {
    quest: { day: before, done: lastDay ? lastDay.steps.map((s) => s.id) : [], complete: Boolean(lastDay) },
    ate: 1,
    metKai: true,
    kai: n >= 7 ? { need: "wood", canFire: true, canAxe: true, want: "water", canTorch: true, have: "radio", escapeMorning: true, found: "box" }
      : n >= 6 ? { need: "wood", canFire: true, canAxe: true, want: "water", canTorch: true, have: "radio", escapeMorning: true }
      : n >= 5 ? { need: "wood", canFire: true, canAxe: true, want: "water", canTorch: true, have: "radio" }
      : n >= 4 ? { need: "wood", canFire: true, canAxe: true, want: "water" }
      : n >= 3 ? { need: "wood", canFire: true, canAxe: true } : { need: "wood", canFire: true },
    known,
    said: [...known],
    unlocked,
    crafted,
    buildings,
    bag,
    pathCleared: n >= 3,
    bridgeBuilt: n >= 4,
    crateOpened: n >= 4,
    enteredCave: n >= 5,
    caveBoxOpened: n >= 5,
    gotWater: n >= 4 ? 1 : 0,
    drank: n >= 4 ? 1 : 0,
    caught: n >= 4 ? 1 : 0,
    cooked: n >= 4 ? 1 : 0,
    boiled: n >= 9 ? 2 : n >= 4 ? 1 : 0,
    boiledDay: n >= 9 ? 8 : n >= 4 ? 3 : 0,
    cliffOpen: n >= 6,
    reachedClifftop: n >= 6,
    signalLit: n >= 6,
    rescued: n >= 6,
    coveOpen: n >= 7,
    reachedCove: n >= 7,
    coveBoxOpened: n >= 7,
    chestTaken: n >= 7,
    asked: n >= 7 ? ["chest", "barrel", "canvas", "rope", "metal"] : [],
    groveOpen: n >= 8,
    fishDried: n >= 8 ? 1 : 0,
    barrelTaken: n >= 9,
    rainCaught: n >= 9 ? 1 : 0,
    rainDone: n >= 9,
    sleptDay: before
  };
}

/** The live side of a day start: the camp fire burning, the player beside it, the movement hint done. */
export function placeAtStartCamp() {
  rt.fireT0.set(CAMP_FIRE.id, -10);
  rt.walked = 99;
  rt.player.x = CAMP_FIRE.x + 1.2;
  rt.player.z = CAMP_FIRE.z + 2.2;
}
