import type { Bag, ItemId } from "../types";

/** Most of one thing the bag holds before a storage box is built. */
export const BASE_STACK = 10;

export function count(bag: Bag, item: ItemId): number {
  return bag[item] ?? 0;
}

/** Add up to `n` of an item. Never exceeds `limit`; reports how many fitted. */
export function addItem(bag: Bag, item: ItemId, n = 1, limit = BASE_STACK): { bag: Bag; added: number } {
  const have = count(bag, item);
  const added = Math.max(0, Math.min(n, limit - have));
  if (added === 0) return { bag, added: 0 };
  return { bag: { ...bag, [item]: have + added }, added };
}

export function hasAll(bag: Bag, needs: Bag): boolean {
  return (Object.entries(needs) as Array<[ItemId, number]>).every(([item, n]) => count(bag, item) >= n);
}

/** What is still missing for `needs` (item -> how many more). */
export function missing(bag: Bag, needs: Bag): Bag {
  const out: Bag = {};
  for (const [item, n] of Object.entries(needs) as Array<[ItemId, number]>) {
    const short = n - count(bag, item);
    if (short > 0) out[item] = short;
  }
  return out;
}

/** Take items out. Returns null (bag untouched) if anything is short. */
export function removeAll(bag: Bag, needs: Bag): Bag | null {
  if (!hasAll(bag, needs)) return null;
  const out: Bag = { ...bag };
  for (const [item, n] of Object.entries(needs) as Array<[ItemId, number]>) {
    const left = count(out, item) - n;
    if (left > 0) out[item] = left;
    else delete out[item];
  }
  return out;
}

export function isFull(bag: Bag, item: ItemId, limit = BASE_STACK): boolean {
  return count(bag, item) >= limit;
}
