import type { Bag, CraftId } from "../types";

export interface Pace {
  readonly recipes: Readonly<Record<CraftId, Bag>>;
  readonly bridgeNeeds: Readonly<Pick<Bag, "wood">>;
  readonly daySeconds: number;
  readonly eveningSeconds: number;
  readonly foodDrainMultiplier: number;
  readonly automaticHintDelay: number | null;
}

const normal: Pace = Object.freeze({
  recipes: Object.freeze({
    campfire: Object.freeze({ wood: 3, stone: 2 }), axe: Object.freeze({ wood: 2, stone: 1 }),
    shelter: Object.freeze({ wood: 4, leaves: 4 }), container: Object.freeze({ coconut: 1, leaves: 2 }),
    rod: Object.freeze({ wood: 2, rope: 1 }), torch: Object.freeze({ wood: 1, leaves: 1 }),
    signalFire: Object.freeze({ wood: 4, leaves: 3, metal: 2 })
  }),
  bridgeNeeds: Object.freeze({ wood: 4 }), daySeconds: 420, eveningSeconds: 30,
  foodDrainMultiplier: 1, automaticHintDelay: null
});

const classroom: Pace = Object.freeze({
  recipes: Object.freeze({
    campfire: Object.freeze({ wood: 2, stone: 1 }), axe: Object.freeze({ wood: 1, stone: 1 }),
    shelter: Object.freeze({ wood: 2, leaves: 2 }), container: Object.freeze({ coconut: 1, leaves: 1 }),
    rod: Object.freeze({ wood: 1, rope: 1 }), torch: Object.freeze({ wood: 1, leaves: 1 }),
    signalFire: Object.freeze({ wood: 2, leaves: 2, metal: 1 })
  }),
  bridgeNeeds: Object.freeze({ wood: 2 }), daySeconds: 240, eveningSeconds: 15,
  foodDrainMultiplier: 0.6, automaticHintDelay: 20
});

/** All numbers that differ between normal and classroom play. */
export const pace = (isClassroom: boolean): Pace => isClassroom ? classroom : normal;
export const recipeNeeds = (id: CraftId, isClassroom = false): Bag => pace(isClassroom).recipes[id];
