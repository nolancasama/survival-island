import type { Bag, BuildingId, CraftId } from "../types";
import { count } from "./inventory";
import { recipeNeeds } from "./pace";

/**
 * Story progression as data. A step is done when its condition holds once,
 * and stays done ("sticky"), so spending wood on the campfire never un-ticks
 * "Get wood". Steps can complete in any order; the objective card shows the
 * first open one. Dependencies come from the world, not from the checklist.
 */

export type StepId =
  | "eat" | "kai" | "wood" | "stone" | "craft" | "place" | "light" | "sleep"
  | "axe" | "path" | "leaves" | "shelter" | "build"
  | "bridge" | "container" | "water" | "drink" | "rod" | "fish" | "cook"
  | "torch" | "cave" | "metal" | "radio" | "showKai"
  | "cliff" | "signalFire" | "clifftop" | "signal" | "help"
  // Safe water (Day 3 and Day 8) and Chapter 2 (Days 6–8).
  | "boil"
  | "cove" | "askKai" | "coveBox" | "canvas" | "carryBox"
  | "grove" | "poles" | "rackSite" | "rackFrame" | "rackStrong" | "dryFish"
  | "barrel" | "catcherSite" | "catcherBuilt" | "catchRain" | "boilRain";
export interface Facts {
  ate: number;
  metKai: boolean;
  bag: Bag;
  crafted: readonly CraftId[];
  placed: readonly BuildingId[];
  litFires: number;
  /** Whether the forest path is cleared. */
  pathCleared: boolean;
  /** Whether the bridge to the pond is built. */
  bridgeBuilt: boolean;
  /** Number of shelters built. */
  builtShelters: number;
  /** Number of water collections. */
  gotWater: number;
  /** Number of drinks. */
  drank: number;
  /** Number of fish caught. */
  caught: number;
  /** Number of fish cooked. */
  cooked: number;
  /** Most recent day completed by sleeping. */
  sleptDay: number;
  /** Phase 3 world facts. The player has been inside the cave. */
  enteredCave?: boolean;
  /** The old box in the cave has been opened (the radio taken). */
  caveBoxOpened?: boolean;
  /** The answer to Kai's "What do you have?" on Day 4. */
  kaiHave?: "radio" | "metal";
  /** Kai helped clear the rockfall. */
  cliffOpen?: boolean;
  reachedClifftop?: boolean;
  signalLit?: boolean;
  rescued?: boolean;
  /** Classroom pace: counted goals follow its smaller recipes. */
  classroom?: boolean;
  /** Times collected water was boiled (Day 3), and the last day it happened (Day 8). */
  boiled?: number;
  boiledDay?: number;
  /** Chapter 2 world facts (Days 6–8). */
  reachedCove?: boolean;
  /** "What is this?" was asked about at least one thing in the cove. */
  askedKai?: boolean;
  coveBoxOpened?: boolean;
  /** The sea chest stands as the storage box within reach of the camp. */
  storageAtCamp?: boolean;
  groveOpen?: boolean;
  rackPlaced?: boolean;
  rackFrame?: boolean;
  rackStable?: boolean;
  /** Fish ever hung on a rack to dry. */
  fishDried?: number;
  barrelAtCamp?: boolean;
  catcherPlaced?: boolean;
  catcherBuilt?: boolean;
  /** Cups caught by a catcher while every stream fell into the barrel. */
  rainCaught?: number;
}

type GoalItem = "wood" | "stone" | "leaves" | "metal" | "canvas" | "pole";

export interface StepDef {
  id: StepId;
  en: string;
  ja: string;
  /**
   * For counted steps: what is counted, and either the recipe whose need sets
   * the goal or a fixed count per pace (n is the normal pace).
   */
  goal?: { item: GoalItem; n: number; recipe?: CraftId; count?: { normal: number; classroom: number } };
  done(f: Facts): boolean;
}

export interface DayDef {
  day: number;
  en: string;
  ja: string;
  steps: StepDef[];
}

const made = (id: CraftId) => (f: Facts) => f.crafted.includes(id);
const sleep = (day: number) => (f: Facts) => f.sleptDay >= day;
const goal = (item: GoalItem, recipe: CraftId): NonNullable<StepDef["goal"]> => ({ item, recipe, n: recipeNeeds(recipe, false)[item] ?? 0 });

/** A counted step with a fixed goal per pace (Chapter 2 gathering). */
const fixedGoal = (item: GoalItem, normal: number, classroom: number): NonNullable<StepDef["goal"]> => ({ item, n: normal, count: { normal, classroom } });

/** Resolve a counted-step goal for the active teacher pace. */
export function stepGoal(step: StepDef, classroom: boolean): { item: GoalItem; n: number } | undefined {
  if (!step.goal) return undefined;
  if (step.goal.count) return { item: step.goal.item, n: classroom ? step.goal.count.classroom : step.goal.count.normal };
  return { item: step.goal.item, n: step.goal.recipe ? recipeNeeds(step.goal.recipe, classroom)[step.goal.item] ?? 0 : step.goal.n };
}

/** The bag holds enough of an item for the recipe at the facts' pace. */
const hasGoal = (item: GoalItem, recipe: CraftId) => (f: Facts) => count(f.bag, item) >= (recipeNeeds(recipe, f.classroom)[item] ?? 0);
/** A counted step: done once the recipe it feeds is made, or the bag holds enough. */
const counted = (item: GoalItem, recipe: CraftId) => (f: Facts) => made(recipe)(f) || hasGoal(item, recipe)(f);
/** A fixed-goal counted step: the bag holds enough at the facts' pace, or what it feeds already exists. */
const countedFixed = (item: GoalItem, normal: number, classroom: number, fed: (f: Facts) => boolean = () => false) =>
  (f: Facts) => fed(f) || count(f.bag, item) >= (f.classroom ? classroom : normal);

/** The Day 6 canvas goal is what the rain catcher will need. */
export const CANVAS_GOAL = { normal: 2, classroom: 1 } as const;
/** Long poles for a stable rack: 4 legs, 2 long bars, 2 braces, and one cut into the 2 short bars. */
export const RACK_POLES = 9;
/** Long poles for the rain catcher's four corner posts. */
export const CATCHER_POLES = 4;

export const DAYS: DayDef[] = [
  { day: 1, en: "Day 1: Survive", ja: "1にちめ: いきのびよう", steps: [
    { id: "eat", en: "Eat something", ja: "なにか たべよう", done: f => f.ate > 0 },
    { id: "kai", en: "Meet Kai", ja: "カイに あおう", done: f => f.metKai },
    { id: "wood", en: "Get wood", ja: "木を あつめよう", goal: goal("wood", "campfire"), done: counted("wood", "campfire") },
    { id: "stone", en: "Get stones", ja: "石を あつめよう", goal: goal("stone", "campfire"), done: counted("stone", "campfire") },
    { id: "craft", en: "Make a campfire", ja: "たきびを つくろう", done: made("campfire") },
    { id: "place", en: "Put the campfire down", ja: "たきびを おこう", done: f => f.placed.includes("campfire") },
    { id: "light", en: "Make a fire", ja: "火を つけよう", done: f => f.litFires > 0 },
    { id: "sleep", en: "Sleep", ja: "ねむろう", done: sleep(1) }
  ] },
  { day: 2, en: "Day 2: Make Camp", ja: "2にちめ: キャンプを つくろう", steps: [
    { id: "axe", en: "Make a stone axe", ja: "石の おのを つくろう", done: made("axe") },
    { id: "path", en: "Cut the big tree", ja: "おおきな 木を きろう", done: f => f.pathCleared },
    { id: "leaves", en: "Get leaves", ja: "はっぱを あつめよう", goal: goal("leaves", "shelter"), done: counted("leaves", "shelter") },
    { id: "wood", en: "Get wood", ja: "木を あつめよう", goal: goal("wood", "shelter"), done: counted("wood", "shelter") },
    { id: "shelter", en: "Make a tent", ja: "テントを つくろう", done: made("shelter") },
    { id: "build", en: "Build the tent", ja: "テントを たてよう", done: f => f.builtShelters > 0 },
    { id: "sleep", en: "Sleep", ja: "ねむろう", done: sleep(2) }
  ] },
  { day: 3, en: "Day 3: Explore", ja: "3にちめ: たんけんしよう", steps: [
    { id: "bridge", en: "Build the bridge", ja: "はしを つくろう", done: f => f.bridgeBuilt },
    { id: "container", en: "Make a cup", ja: "カップを つくろう", done: made("container") },
    { id: "water", en: "Get water", ja: "みずを くもう", done: f => f.gotWater > 0 },
    // Safe water: all collected water is boiled before drinking (2026-11-23).
    { id: "boil", en: "Boil the water", ja: "みずを わかそう", done: f => (f.boiled ?? 0) > 0 },
    { id: "drink", en: "Drink water", ja: "みずを のもう", done: f => f.drank > 0 },
    { id: "rod", en: "Make a fishing rod", ja: "つりざおを つくろう", done: made("rod") },
    { id: "fish", en: "Catch a fish", ja: "さかなを つろう", done: f => f.caught > 0 },
    { id: "cook", en: "Cook the fish", ja: "さかなを やこう", done: f => f.cooked > 0 },
    { id: "sleep", en: "Sleep", ja: "ねむろう", done: sleep(3) }
  ] },
  { day: 4, en: "Day 4: Discover", ja: "4にちめ: はっけんしよう", steps: [
    { id: "torch", en: "Make a torch", ja: "たいまつを つくろう", done: made("torch") },
    { id: "cave", en: "Go in the cave", ja: "どうくつに はいろう", done: f => !!f.enteredCave },
    { id: "metal", en: "Get metal", ja: "てつを あつめよう", goal: goal("metal", "signalFire"), done: counted("metal", "signalFire") },
    { id: "radio", en: "Find the radio", ja: "ラジオを さがそう", done: f => !!f.caveBoxOpened },
    { id: "showKai", en: "Show Kai", ja: "カイに みせよう", done: f => f.kaiHave !== undefined },
    { id: "sleep", en: "Sleep", ja: "ねむろう", done: sleep(4) }
  ] },
  // Day 5 ends with the rescue, not with sleep.
  { day: 5, en: "Day 5: Escape", ja: "5にちめ: だっしゅつしよう", steps: [
    { id: "cliff", en: "Clear the path", ja: "みちを あけよう", done: f => !!f.cliffOpen },
    { id: "wood", en: "Get wood", ja: "木を あつめよう", goal: goal("wood", "signalFire"), done: counted("wood", "signalFire") },
    { id: "leaves", en: "Get leaves", ja: "はっぱを あつめよう", goal: goal("leaves", "signalFire"), done: counted("leaves", "signalFire") },
    { id: "signalFire", en: "Make a signal fire", ja: "のろしを つくろう", done: made("signalFire") },
    { id: "clifftop", en: "Go to the clifftop", ja: "がけの うえへ いこう", done: f => !!f.reachedClifftop },
    { id: "signal", en: "Light the signal fire", ja: "のろしに 火を つけよう", done: f => !!f.signalLit },
    { id: "help", en: "Call for help", ja: "たすけを よぼう", done: f => !!f.rescued }
  ] },
  // Chapter 2 "A Better Camp" (Milestones 1–3 of EXPANSION_PLAN.md).
  { day: 6, en: "Day 6: Shipwreck Cove", ja: "6にちめ: なんぱせんの いりえ", steps: [
    { id: "cove", en: "Go to the cove", ja: "いりえへ いこう", done: f => !!f.reachedCove },
    { id: "askKai", en: "Ask Kai about things", ja: "カイに きこう", done: f => !!f.askedKai },
    { id: "coveBox", en: "Open the box", ja: "はこを あけよう", done: f => !!f.coveBoxOpened },
    { id: "canvas", en: "Get canvas", ja: "ぬのを あつめよう", goal: fixedGoal("canvas", CANVAS_GOAL.normal, CANVAS_GOAL.classroom),
      done: countedFixed("canvas", CANVAS_GOAL.normal, CANVAS_GOAL.classroom, f => !!f.catcherBuilt) },
    { id: "carryBox", en: "Bring the big box to camp", ja: "おおきな はこを キャンプへ はこぼう", done: f => !!f.storageAtCamp },
    { id: "sleep", en: "Sleep", ja: "ねむろう", done: sleep(6) }
  ] },
  { day: 7, en: "Day 7: Bamboo Grove", ja: "7にちめ: たけの はやし", steps: [
    { id: "grove", en: "Cut the bamboo", ja: "たけを きろう", done: f => !!f.groveOpen },
    { id: "poles", en: "Get bamboo poles", ja: "たけの ぼうを あつめよう", goal: fixedGoal("pole", RACK_POLES, RACK_POLES),
      done: countedFixed("pole", RACK_POLES, RACK_POLES, f => !!f.rackStable) },
    { id: "rackSite", en: "Put the rack down", ja: "ほしだなを おこう", done: f => !!f.rackPlaced },
    { id: "rackFrame", en: "Build the rack", ja: "ほしだなを くみたてよう", done: f => !!f.rackFrame },
    { id: "rackStrong", en: "Make it strong", ja: "じょうぶに しよう", done: f => !!f.rackStable },
    { id: "dryFish", en: "Dry a fish", ja: "さかなを ほそう", done: f => (f.fishDried ?? 0) > 0 },
    { id: "sleep", en: "Sleep", ja: "ねむろう", done: sleep(7) }
  ] },
  { day: 8, en: "Day 8: Rain", ja: "8にちめ: あめ", steps: [
    { id: "poles", en: "Get bamboo poles", ja: "たけの ぼうを あつめよう", goal: fixedGoal("pole", CATCHER_POLES, CATCHER_POLES),
      done: countedFixed("pole", CATCHER_POLES, CATCHER_POLES, f => !!f.catcherBuilt) },
    { id: "barrel", en: "Bring the barrel to camp", ja: "たるを キャンプへ はこぼう", done: f => !!f.barrelAtCamp },
    { id: "catcherSite", en: "Put the rain catcher down", ja: "あまみず あつめを おこう", done: f => !!f.catcherPlaced },
    { id: "catcherBuilt", en: "Build the rain catcher", ja: "あまみず あつめを つくろう", done: f => !!f.catcherBuilt },
    { id: "catchRain", en: "Catch the rain", ja: "あまみずを ためよう", done: f => (f.rainCaught ?? 0) > 0 },
    { id: "boilRain", en: "Boil the water", ja: "みずを わかそう", done: f => (f.boiledDay ?? 0) >= 8 },
    { id: "sleep", en: "Sleep", ja: "ねむろう", done: sleep(8) }
  ] }
];
/** The final authored story day; later days are free play. Day 5 ends Chapter 1 with the rescue. */
export const LAST_STORY_DAY = 8;
/** The rescue day: the end of Chapter 1. */
export const RESCUE_DAY = 5;
/** Chapter 2 "A Better Camp" days. */
export const CHAPTER_TWO_FIRST_DAY = 6;
export interface QuestState {
  day: number;
  done: StepId[];
  /** Every step of the day is done. */
  complete: boolean;
}
export const START_QUEST: QuestState = { day: 1, done: [], complete: false };
const freeDay = (day: number): DayDef => ({ day, en: "Free time: explore the island!", ja: "じゆうに しまを たんけんしよう！", steps: [] });
export function dayDef(day: number): DayDef {
  return DAYS.find((d) => d.day === day) ?? freeDay(day);
}

/** Return whether a day has authored story steps. */
export function isStoryDay(day: number): boolean {
  return day >= 1 && day <= LAST_STORY_DAY;
}

/** Tick every step whose condition holds now. Returns the same object if nothing changed. */
export function evaluate(q: QuestState, f: Facts): QuestState {
  const def = dayDef(q.day);
  if (!def.steps.length) return q;
  const add = def.steps.filter((s) => !q.done.includes(s.id) && s.done(f)).map((s) => s.id);
  if (!add.length) return q;
  const done = [...q.done, ...add];
  return { ...q, done, complete: def.steps.every((s) => done.includes(s.id)) };
}

/** The step the objective card points at. */
export function currentStep(q: QuestState): StepDef | null {
  return dayDef(q.day).steps.find((s) => !q.done.includes(s.id)) ?? null;
}

/** Steps newly completed between two states (for ticks and sounds). */
export function newlyDone(before: QuestState, after: QuestState): StepId[] {
  return after.done.filter((s) => !before.done.includes(s));
}

/** Return whether all authored tasks except sleep are complete (never on a day without a sleep step). */
export function readyToSleep(q: QuestState): boolean {
  const steps = dayDef(q.day).steps;
  return steps.some((s) => s.id === "sleep") && steps.filter((s) => s.id !== "sleep").every((s) => q.done.includes(s.id));
}

/** Move to the next day and evaluate facts already carried forward. */
export function advanceDay(q: QuestState, facts: Facts): QuestState {
  return evaluate({ day: q.day + 1, done: [], complete: false }, facts);
}
