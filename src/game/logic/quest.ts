import type { Bag, BuildingId, CraftId } from "../types";
import { count } from "./inventory";
import { RECIPES } from "./crafting";

/**
 * Story progression as data. A step is done when its condition holds once,
 * and stays done ("sticky"), so spending wood on the campfire never un-ticks
 * "Get wood". Steps can complete in any order; the objective card shows the
 * first open one. Dependencies come from the world (no campfire recipe before
 * Kai teaches it), not from the checklist.
 */

export type StepId = "eat" | "kai" | "wood" | "stone" | "craft" | "place" | "light";

export interface Facts {
  ate: number;
  metKai: boolean;
  bag: Bag;
  crafted: readonly CraftId[];
  placed: readonly BuildingId[];
  litFires: number;
}

export interface StepDef {
  id: StepId;
  en: string;
  ja: string;
  /** For counted steps: what is counted, and the goal. */
  goal?: { item: "wood" | "stone"; n: number };
  done(f: Facts): boolean;
}

export interface DayDef {
  day: number;
  en: string;
  ja: string;
  steps: StepDef[];
}

const CAMPFIRE = RECIPES.campfire.needs;
const madeCampfire = (f: Facts) => f.crafted.includes("campfire");

export const DAYS: DayDef[] = [
  {
    day: 1,
    en: "Day 1: Survive",
    ja: "1にちめ: いきのびよう",
    steps: [
      { id: "eat", en: "Eat something", ja: "なにか たべよう", done: (f) => f.ate > 0 },
      { id: "kai", en: "Meet Kai", ja: "カイに あおう", done: (f) => f.metKai },
      {
        id: "wood",
        en: "Get wood",
        ja: "木を あつめよう",
        goal: { item: "wood", n: CAMPFIRE.wood ?? 3 },
        done: (f) => madeCampfire(f) || count(f.bag, "wood") >= (CAMPFIRE.wood ?? 3)
      },
      {
        id: "stone",
        en: "Get stones",
        ja: "石を あつめよう",
        goal: { item: "stone", n: CAMPFIRE.stone ?? 2 },
        done: (f) => madeCampfire(f) || count(f.bag, "stone") >= (CAMPFIRE.stone ?? 2)
      },
      { id: "craft", en: "Make a campfire", ja: "たきびを つくろう", done: madeCampfire },
      { id: "place", en: "Put the campfire down", ja: "たきびを おこう", done: (f) => f.placed.includes("campfire") },
      { id: "light", en: "Make a fire", ja: "火を つけよう", done: (f) => f.litFires > 0 }
    ]
  }
];

export interface QuestState {
  day: number;
  done: StepId[];
  /** Every step of the day is done. */
  complete: boolean;
}

export const START_QUEST: QuestState = { day: 1, done: [], complete: false };

export function dayDef(day: number): DayDef {
  return DAYS.find((d) => d.day === day) ?? DAYS[DAYS.length - 1];
}

/** Tick every step whose condition holds now. Returns the same object if nothing changed. */
export function evaluate(q: QuestState, f: Facts): QuestState {
  const def = dayDef(q.day);
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
