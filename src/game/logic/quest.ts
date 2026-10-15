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
  | "cliff" | "signalFire" | "clifftop" | "signal" | "help";
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
}

type GoalItem = "wood" | "stone" | "leaves" | "metal";

export interface StepDef {
  id: StepId;
  en: string;
  ja: string;
  /** For counted steps: what is counted, and the recipe whose need sets the goal (n is the normal pace). */
  goal?: { item: GoalItem; n: number; recipe: CraftId };
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

/** Resolve a counted-step goal for the active teacher pace. */
export function stepGoal(step: StepDef, classroom: boolean): { item: GoalItem; n: number } | undefined {
  return step.goal && { item: step.goal.item, n: recipeNeeds(step.goal.recipe, classroom)[step.goal.item] ?? 0 };
}

/** The bag holds enough of an item for the recipe at the facts' pace. */
const hasGoal = (item: GoalItem, recipe: CraftId) => (f: Facts) => count(f.bag, item) >= (recipeNeeds(recipe, f.classroom)[item] ?? 0);
/** A counted step: done once the recipe it feeds is made, or the bag holds enough. */
const counted = (item: GoalItem, recipe: CraftId) => (f: Facts) => made(recipe)(f) || hasGoal(item, recipe)(f);

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
    { id: "shelter", en: "Make a shelter", ja: "こやを つくろう", done: made("shelter") },
    { id: "build", en: "Build the shelter", ja: "こやを たてよう", done: f => f.builtShelters > 0 },
    { id: "sleep", en: "Sleep", ja: "ねむろう", done: sleep(2) }
  ] },
  { day: 3, en: "Day 3: Explore", ja: "3にちめ: たんけんしよう", steps: [
    { id: "bridge", en: "Build the bridge", ja: "はしを つくろう", done: f => f.bridgeBuilt },
    { id: "container", en: "Make a water container", ja: "みずいれを つくろう", done: made("container") },
    { id: "water", en: "Get water", ja: "みずを くもう", done: f => f.gotWater > 0 },
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
  ] }
];
/** The final authored story day; later days are free play. */
export const LAST_STORY_DAY = 5;
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
