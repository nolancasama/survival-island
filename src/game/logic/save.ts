import type { Bag, CraftId, ItemId } from "../types";
import { ITEMS } from "../types";
import type { PhraseId } from "./english";
import { PHRASES } from "./english";
import type { QuestState, StepId } from "./quest";
import type { Stats } from "./stats";
import type { PlacedBuilding } from "../world/placement";
import { RECIPES } from "./crafting";
import { dayStartT } from "./clock";

/**
 * Save data for resume (localStorage). Versioned: anything that does not
 * validate is discarded whole, never half-loaded. Version 2 also migrates
 * valid version 1 saves.
 */

export const SAVE_KEY = "si.save.v3";
/** The previous save key used for migration. */
export const V2_SAVE_KEY = "si.save.v2";
/** The previous save key used for migration. */
export const V1_SAVE_KEY = "si.save.v1";
/** Current save schema version. */
export const SAVE_VERSION = 3;
export interface SaveData {
  v: 3;
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
  kai: { need?: "water" | "food" | "wood"; canFire?: boolean; canAxe?: boolean; want?: "water" | "fish" };
  player: { x: number; z: number; yaw: number };
  /** Story light, 1 = midday, 0 = night. */
  light: number;
  /** Every sentence said this adventure (for the end-of-day card). */
  said: PhraseId[];
  /** Optional for compatibility with Phase 2 saves written before per-day cards. */
  daySaid?: PhraseId[];
  dayNew?: PhraseId[];
  /** Clock time through the day. */
  /** Time through the day, from sunrise to held night. */
  t: number;
  /** Whether the forest path is cleared. */
  pathCleared: boolean;
  /** Whether the bridge to the pond is built. */
  bridgeBuilt: boolean;
  /** Water collected from the pond. */
  gotWater: number;
  /** Water consumed by the player. */
  drank: number;
  /** Fish caught by the player. */
  caught: number;
  /** Fish cooked by the player. */
  cooked: number;
  /** Most recent day completed by sleeping. */
  sleptDay: number;
  enteredCave: boolean;
  caveBoxOpened: boolean;
  cliffOpen: boolean;
  reachedClifftop: boolean;
  signalLit: boolean;
  rescued: boolean;
  kaiStage: "camp" | "rockfall" | "clifftop";
}
type V2 = Omit<SaveData, "v" | "enteredCave" | "caveBoxOpened" | "cliffOpen" | "reachedClifftop" | "signalLit" | "rescued" | "kaiStage"> & { v: 2; kai: { need?: "water" | "food" | "wood"; canFire?: boolean; canAxe?: boolean; want?: "water" | "fish" } };
type V1 = Omit<V2, "v" | "t" | "pathCleared" | "bridgeBuilt" | "gotWater" | "drank" | "caught" | "cooked" | "sleptDay"> & { v: 1; kai: { need?: "water" | "food" | "wood"; canFire?: boolean } };
const STEP_IDS: StepId[] = ["eat", "kai", "wood", "stone", "craft", "place", "light", "sleep", "axe", "path", "leaves", "shelter", "build", "bridge", "container", "water", "drink", "rod", "fish", "cook", "torch", "cave", "metal", "radio", "showKai", "cliff", "signalFire", "clifftop", "signal", "help"];
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const validBag = (v: unknown): v is Bag => isObj(v) && Object.entries(v).every(([k, n]) => k in ITEMS && isNum(n) && n >= 0);
const validPhrases = (v: unknown): v is PhraseId[] => Array.isArray(v) && v.every(p => typeof p === "string" && p in PHRASES);
const validCrafts = (v: unknown): v is CraftId[] => Array.isArray(v) && v.every(p => typeof p === "string" && p in RECIPES);
function validBase(raw: Record<string, unknown>): boolean {
  const q = raw.quest, st = raw.stats, p = raw.player;
  if (!isObj(q) || !isNum(q.day) || typeof q.complete !== "boolean" || !Array.isArray(q.done) || !q.done.every(s => STEP_IDS.includes(s as StepId))) return false;
  if (!validBag(raw.bag) || !isObj(st) || !isNum(st.hp) || !isNum(st.stamina) || !isNum(st.food) || !validPhrases(raw.known) || !validPhrases(raw.said) || !validCrafts(raw.unlocked) || !validCrafts(raw.crafted)) return false;
  if (!Array.isArray(raw.buildings) || !raw.buildings.every(b => isObj(b) && typeof b.id === "string" && typeof b.type === "string" && isNum(b.x) && isNum(b.z) && isNum(b.rot) && (b.lit === undefined || typeof b.lit === "boolean") && (b.built === undefined || typeof b.built === "boolean"))) return false;
  if (!isObj(raw.taken) || !Object.values(raw.taken).every(isNum) || !isObj(p) || !isNum(p.x) || !isNum(p.z) || !isNum(p.yaw) || !isNum(raw.light) || !isNum(raw.ate) || typeof raw.metKai !== "boolean" || typeof raw.crateOpened !== "boolean" || !isObj(raw.kai) || !isNum(raw.savedAt)) return false;
  return true;
}
/** Validate a version 3 save. */
export function validateSave(raw: unknown): SaveData | null {
  if (!isObj(raw) || raw.v !== 3 || !validBase(raw) || !isNum(raw.t) || raw.t < 0 || raw.t > 1 || typeof raw.pathCleared !== "boolean" || typeof raw.bridgeBuilt !== "boolean" || !["gotWater", "drank", "caught", "cooked", "sleptDay"].every(k => isNum(raw[k]) && (raw[k] as number) >= 0)) return null;
  if (raw.daySaid !== undefined && !validPhrases(raw.daySaid)) return null;
  if (raw.dayNew !== undefined && !validPhrases(raw.dayNew)) return null;
  const k = raw.kai as Record<string, unknown>; if ((k.need !== undefined && !["water", "food", "wood"].includes(k.need as string)) || (k.canFire !== undefined && typeof k.canFire !== "boolean") || (k.canAxe !== undefined && typeof k.canAxe !== "boolean") || (k.want !== undefined && !["water", "fish"].includes(k.want as string)) || (k.canTorch !== undefined && typeof k.canTorch !== "boolean") || (k.have !== undefined && !["radio", "metal"].includes(k.have as string))) return null;
  if (!["enteredCave", "caveBoxOpened", "cliffOpen", "reachedClifftop", "signalLit", "rescued"].every(key => typeof raw[key] === "boolean") || !["camp", "rockfall", "clifftop"].includes(raw.kaiStage as string)) return null;
  return raw as unknown as SaveData;
}
function validateV2(raw: unknown): V2 | null {
  if (!isObj(raw) || raw.v !== 2 || !validBase(raw) || !isNum(raw.t) || raw.t < 0 || raw.t > 1 || typeof raw.pathCleared !== "boolean" || typeof raw.bridgeBuilt !== "boolean" || !["gotWater", "drank", "caught", "cooked", "sleptDay"].every(k => isNum(raw[k]) && (raw[k] as number) >= 0)) return null;
  if (raw.daySaid !== undefined && !validPhrases(raw.daySaid) || raw.dayNew !== undefined && !validPhrases(raw.dayNew)) return null;
  const k = raw.kai as Record<string, unknown>;
  if ((k.need !== undefined && !["water", "food", "wood"].includes(k.need as string)) || (k.canFire !== undefined && typeof k.canFire !== "boolean") || (k.canAxe !== undefined && typeof k.canAxe !== "boolean") || (k.want !== undefined && !["water", "fish"].includes(k.want as string))) return null;
  return raw as unknown as V2;
}
function validateV1(raw: unknown): V1 | null {
  return isObj(raw) && raw.v === 1 && validBase(raw) ? raw as unknown as V1 : null;
}

/** Convert a valid version 1 save to the current schema. */
export function migrateV1(raw: unknown): SaveData | null {
  const old = validateV1(raw);
  if (!old) return null;
  const complete = old.quest.day === 1 && old.quest.complete;
  return migrateV2({ ...old, v: 2, quest: complete ? { day: 1, done: ["eat", "kai", "wood", "stone", "craft", "place", "light"], complete: false } : old.quest, t: complete ? 1 : 0.05, pathCleared: false, bridgeBuilt: false, gotWater: 0, drank: 0, caught: 0, cooked: 0, sleptDay: 0, kai: { ...old.kai } });
}
/** Convert a valid Phase 2 save to the current schema. */
export function migrateV2(raw: unknown): SaveData | null {
  const old = validateV2(raw);
  if (!old) return null;
  const reset = old.quest.day >= 4;
  return { ...old, v: 3, quest: reset ? { day: 4, done: [], complete: false } : old.quest, t: reset ? dayStartT(4) : old.t, sleptDay: reset ? 3 : old.sleptDay, kai: { ...old.kai }, enteredCave: false, caveBoxOpened: false, cliffOpen: false, reachedClifftop: false, signalLit: false, rescued: false, kaiStage: "camp" };
}
/** Serialize current save data. */
export const serialize = (data: SaveData) => JSON.stringify(data);

/** Parse and validate a current save string. */
export function parseSave(text: string | null): SaveData | null {
  if (!text) return null;
  try {
    return validateSave(JSON.parse(text));
  } catch {
    return null;
  }
}

/** Load v3, then safely migrate v2 and v1. */
export function loadSaveText(v3Text: string | null, v2Text?: string | null, v1Text?: string | null): SaveData | null {
  const v3 = parseSave(v3Text);
  if (v3) return v3;
  // Kept for callers compiled against the former (v2, v1) signature.
  if (v1Text === undefined) { v1Text = v2Text; v2Text = v3Text; v3Text = null; }
  try { const v2 = migrateV2(JSON.parse(v2Text ?? "")); if (v2) return v2; } catch { /* try v1 */ }
  try { return migrateV1(JSON.parse(v1Text ?? "")); } catch { return null; }
}

/** Bag entries in a stable order (for display and tests). */
export function bagItems(bag: Bag): Array<[ItemId, number]> {
  return (Object.entries(bag) as Array<[ItemId, number]>).filter(([, n]) => n > 0);
}
