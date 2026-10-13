/** Things that can sit in the bag. Resources, food, and crafted kits. */
export type ItemId =
  | "wood"
  | "stone"
  | "leaves"
  | "rope"
  | "coconut"
  | "fish"
  | "water"
  | "metal"
  | "axe"
  | "rod"
  | "container"
  | "torch"
  | "campfire"
  | "shelter"
  | "signalFire";

/** Craftable outputs (each recipe makes one of these). */
export type CraftId = "axe" | "campfire" | "rod" | "container" | "shelter" | "torch" | "signalFire";

/** Things placed in the world with the building preview. */
export type BuildingId = "campfire" | "shelter" | "storage" | "cooking" | "fence";

/** Collectible node kinds in the world. */
export type NodeKind = "wood" | "stone" | "coconut";

export type Bag = Partial<Record<ItemId, number>>;

export interface ItemDef {
  id: ItemId;
  /** English word shown under the icon ("wood", "stone", "coconut"). */
  en: string;
  ja: string;
  kind: "resource" | "food" | "tool" | "building";
  /** Food restored when eaten. */
  food?: number;
  /** Placed in the world instead of used from the bag. */
  places?: BuildingId;
}

export const ITEMS: Record<ItemId, ItemDef> = {
  wood: { id: "wood", en: "wood", ja: "き", kind: "resource" },
  stone: { id: "stone", en: "stone", ja: "いし", kind: "resource" },
  leaves: { id: "leaves", en: "leaves", ja: "はっぱ", kind: "resource" },
  rope: { id: "rope", en: "rope", ja: "ロープ", kind: "resource" },
  coconut: { id: "coconut", en: "coconut", ja: "ココナッツ", kind: "food", food: 30 },
  fish: { id: "fish", en: "fish", ja: "さかな", kind: "food", food: 25 },
  water: { id: "water", en: "water", ja: "みず", kind: "food", food: 10 },
  metal: { id: "metal", en: "metal", ja: "てつ", kind: "resource" },
  axe: { id: "axe", en: "stone axe", ja: "いしの おの", kind: "tool" },
  rod: { id: "rod", en: "fishing rod", ja: "つりざお", kind: "tool" },
  container: { id: "container", en: "water container", ja: "みずいれ", kind: "tool" },
  torch: { id: "torch", en: "torch", ja: "たいまつ", kind: "tool" },
  campfire: { id: "campfire", en: "campfire", ja: "たきび", kind: "building", places: "campfire" },
  shelter: { id: "shelter", en: "shelter", ja: "こや", kind: "building", places: "shelter" },
  signalFire: { id: "signalFire", en: "signal fire", ja: "のろし", kind: "building", places: "campfire" }
};

/** Order of items in the hotbar. */
export const ITEM_ORDER: ItemId[] = [
  "coconut",
  "fish",
  "water",
  "wood",
  "stone",
  "leaves",
  "rope",
  "metal",
  "campfire",
  "shelter",
  "signalFire",
  "axe",
  "rod",
  "container",
  "torch"
];

export interface Vec2 {
  x: number;
  z: number;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}
