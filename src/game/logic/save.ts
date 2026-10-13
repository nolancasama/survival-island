import type { Bag, CraftId, ItemId } from "../types";
import { ITEMS } from "../types";
import type { PhraseId } from "./english";
import { PHRASES } from "./english";
import type { QuestState, StepId } from "./quest";
import type { Stats } from "./stats";
import type { PlacedBuilding } from "../world/placement";
import { RECIPES } from "./crafting";

/**
 * Save data for resume (localStorage). Versioned: anything that does not
 * validate is discarded whole, never half-loaded.
 */

export const SAVE_KEY = "si.save.v1";
export const SAVE_VERSION = 1;

export interface SaveData {
  v: 1;
  savedAt: number;
  quest: QuestState;
  bag: Bag;
  stats: Stats;
  /** Sentences already said successfully (their actions are now quick). */
  known: PhraseId[];
  unlocked: CraftId[];
  crafted: CraftId[];
  buildings: PlacedBuilding[];
  /** Node id -> seconds of respawn left (only taken nodes). */
  taken: Record<string, number>;
  crateOpened: boolean;
  metKai: boolean;
  ate: number;
  /** Kai's answers so far (choices change what he says later). */
  kai: { need?: "water" | "food" | "wood"; canFire?: boolean };
  player: { x: number; z: number; yaw: number };
  /** Story light, 1 = midday, 0 = night. */
  light: number;
  /** Every sentence said this adventure (for the end-of-day card). */
  said: PhraseId[];
}

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const STEP_IDS: StepId[] = ["eat", "kai", "wood", "stone", "craft", "place", "light"];

function validBag(v: unknown): v is Bag {
  return isObj(v) && Object.entries(v).every(([k, n]) => k in ITEMS && isNum(n) && n >= 0);
}

function validPhrases(v: unknown): v is PhraseId[] {
  return Array.isArray(v) && v.every((p) => typeof p === "string" && p in PHRASES);
}

function validCrafts(v: unknown): v is CraftId[] {
  return Array.isArray(v) && v.every((p) => typeof p === "string" && p in RECIPES);
}

export function validateSave(raw: unknown): SaveData | null {
  if (!isObj(raw) || raw.v !== SAVE_VERSION) return null;
  const q = raw.quest;
  if (!isObj(q) || !isNum(q.day) || !Array.isArray(q.done) || !q.done.every((s) => STEP_IDS.includes(s as StepId))) return null;
  if (!validBag(raw.bag)) return null;
  const st = raw.stats;
  if (!isObj(st) || !isNum(st.hp) || !isNum(st.stamina) || !isNum(st.food)) return null;
  if (!validPhrases(raw.known) || !validPhrases(raw.said)) return null;
  if (!validCrafts(raw.unlocked) || !validCrafts(raw.crafted)) return null;
  if (!Array.isArray(raw.buildings)) return null;
  for (const b of raw.buildings) {
    if (!isObj(b) || typeof b.id !== "string" || typeof b.type !== "string" || !isNum(b.x) || !isNum(b.z) || !isNum(b.rot)) return null;
  }
  if (!isObj(raw.taken) || !Object.values(raw.taken).every(isNum)) return null;
  const p = raw.player;
  if (!isObj(p) || !isNum(p.x) || !isNum(p.z) || !isNum(p.yaw)) return null;
  if (!isNum(raw.light) || !isNum(raw.ate) || typeof raw.metKai !== "boolean" || typeof raw.crateOpened !== "boolean") return null;
  if (!isObj(raw.kai)) return null;
  return raw as unknown as SaveData;
}

export function serialize(data: SaveData): string {
  return JSON.stringify(data);
}

export function parseSave(text: string | null): SaveData | null {
  if (!text) return null;
  try {
    return validateSave(JSON.parse(text));
  } catch {
    return null;
  }
}

/** Bag entries in a stable order (for display and tests). */
export function bagItems(bag: Bag): Array<[ItemId, number]> {
  return (Object.entries(bag) as Array<[ItemId, number]>).filter(([, n]) => n > 0);
}
