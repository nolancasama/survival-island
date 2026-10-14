import type { Bag, CraftId } from "../types";
import type { PhraseId } from "./english";
import { addItem, hasAll, removeAll } from "./inventory";

export interface Recipe {
  id: CraftId;
  needs: Bag;
  /** What the student says to make it. */
  phrase: PhraseId;
  purpose: { en: string; ja: string };
}

/**
 * The brief's crafting table. Two pairs share ingredients on purpose (axe and
 * campfire; shelter and torch): the student chooses what to make. Amounts are
 * small and shown as icons with a tick, never as arithmetic.
 */
export const RECIPES: Record<CraftId, Recipe> = {
  campfire: { id: "campfire", needs: { wood: 3, stone: 2 }, phrase: "craftCampfire", purpose: { en: "Cook food. Light at night.", ja: "りょうりが できる。よるも あかるい。" } },
  axe: { id: "axe", needs: { wood: 2, stone: 1 }, phrase: "craftAxe", purpose: { en: "Cut wood faster.", ja: "木が はやく きれる。" } },
  rod: { id: "rod", needs: { wood: 2, rope: 1 }, phrase: "craftRod", purpose: { en: "Catch fish.", ja: "さかなが つれる。" } },
  container: { id: "container", needs: { coconut: 1, leaves: 2 }, phrase: "craftContainer", purpose: { en: "Carry water.", ja: "みずを はこべる。" } },
  shelter: { id: "shelter", needs: { wood: 4, leaves: 4 }, phrase: "craftShelter", purpose: { en: "Sleep. Get stamina back.", ja: "ねむれる。げんきが もどる。" } },
  torch: { id: "torch", needs: { wood: 1, leaves: 1 }, phrase: "craftTorch", purpose: { en: "See in the cave.", ja: "どうくつが みえる。" } },
  signalFire: { id: "signalFire", needs: { wood: 4, leaves: 3, metal: 2 }, phrase: "craftSignalFire", purpose: { en: "Call for rescue.", ja: "たすけを よぶ。" } }
};

/** The bridge is repaired in the world, not crafted into the bag. */
export const BRIDGE_NEEDS = { wood: 4 } as const;

/** Recipes shown in the Craft menu, in this order, once unlocked. */
export const RECIPE_ORDER: CraftId[] = ["campfire", "axe", "rod", "container", "shelter", "torch", "signalFire"];

export type CraftCheck = "ok" | "locked" | "missing";

export function checkCraft(bag: Bag, id: CraftId, unlocked: readonly CraftId[]): CraftCheck {
  if (!unlocked.includes(id)) return "locked";
  return hasAll(bag, RECIPES[id].needs) ? "ok" : "missing";
}

/** Consume the ingredients and add the made thing. Null if it cannot be made. */
export function craft(bag: Bag, id: CraftId, unlocked: readonly CraftId[]): Bag | null {
  if (checkCraft(bag, id, unlocked) !== "ok") return null;
  const after = removeAll(bag, RECIPES[id].needs);
  if (!after) return null;
  return addItem(after, id, 1, Infinity).bag;
}

/** Cook one fish and return the changed bag, or null when no fish is available. */
export function cookFish(bag: Bag): Bag | null {
  const after = removeAll(bag, { fish: 1 });
  return after ? addItem(after, "grilledFish", 1).bag : null;
}
