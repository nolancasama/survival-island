import type { Bag, CraftId, ItemId } from "../types";
import { ITEMS } from "../types";
import type { PhraseId } from "./english";
import { PHRASES } from "./english";
import type { QuestState, StepId } from "./quest";
import type { Stats } from "./stats";
import type { PlacedBuilding } from "../world/placement";
import { RECIPES } from "./crafting";
import { dayStartT } from "./clock";
import type { Network } from "./waterworks";

/**
 * Save data for resume (localStorage). Versioned: anything that does not
 * validate is discarded whole, never half-loaded. Valid older saves (v4, v3,
 * v2, v1) are migrated forward one version at a time.
 */

export const SAVE_KEY = "si.save.v5";
/** Previous save keys used for migration. */
export const V4_SAVE_KEY = "si.save.v4";
export const V3_SAVE_KEY = "si.save.v3";
export const V2_SAVE_KEY = "si.save.v2";
export const V1_SAVE_KEY = "si.save.v1";
/** Current save schema version. */
export const SAVE_VERSION = 5;

/** Kai's answers and story flags so far (choices change what he says later). */
export interface KaiSave {
  need?: "water" | "food" | "wood";
  canFire?: boolean;
  canAxe?: boolean;
  want?: "water" | "fish";
  canTorch?: boolean;
  have?: "radio" | "metal";
  escapeMorning?: boolean;
  /** Chapter 2: Day 6's morning talk finished (Kai set off for the cove). */
  coveMorning?: boolean;
  /** Chapter 2: the answer to "What did you find?". */
  found?: "rope" | "canvas" | "box";
  /** Chapter 2: Day 7's morning talk finished. */
  groveMorning?: boolean;
  /** Chapter 2: "Let's build a rack." was said and Kai gave the frame. */
  rackPlan?: boolean;
  /** Chapter 2: Day 8's morning talk finished (the catcher frame given). */
  rainMorning?: boolean;
  /** Chapter 3: Day 9's morning talk finished; the answer to "What can you see?"; the pipe plan; Day 10's morning. */
  upperMorning?: boolean;
  seen?: "waterfall" | "stream" | "rocks";
  pipePlan?: boolean;
  tankMorning?: boolean;
}

export type KaiStageSave = "camp" | "rockfall" | "clifftop" | "cove" | "upper";

export interface SaveData {
  v: 5;
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
  kai: KaiSave;
  player: { x: number; z: number; yaw: number };
  /** Story light, 1 = midday, 0 = night. */
  light: number;
  /** Every sentence said this adventure (for the end-of-day card). */
  said: PhraseId[];
  /** Optional for compatibility with Phase 2 saves written before per-day cards. */
  daySaid?: PhraseId[];
  dayNew?: PhraseId[];
  /** Time through the day, from sunrise to held night. */
  t: number;
  /** Whether the forest path is cleared. */
  pathCleared: boolean;
  /** Whether the bridge to the pond is built. */
  bridgeBuilt: boolean;
  /** Water collected (pond or barrel). */
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
  kaiStage: KaiStageSave;
  // ---- v4: safe water and Chapter 2 (Days 6–8)
  /** Times collected water was boiled, and the last day it happened. */
  boiled: number;
  boiledDay: number;
  /** World gates: low tide at the cove passage, the bamboo thicket cut. */
  coveOpen: boolean;
  groveOpen: boolean;
  reachedCove: boolean;
  coveBoxOpened: boolean;
  /** Salvage kinds asked about with "What is this?". */
  asked: string[];
  /** The sea chest and the barrel have left their places in the cove. */
  chestTaken: boolean;
  barrelTaken: boolean;
  /** What the player was carrying (restored on resume). */
  carry: "chest" | "barrel" | "tank" | null;
  /** Fish ever hung on a rack. */
  fishDried: number;
  /** Cups caught while every stream fell into the barrel. */
  rainCaught: number;
 /** Day 8's rain has stopped. */
  rainDone: boolean;
  // ---- v5: the moved rescue and Chapter 3 (Days 9–10)
  /** Day 5's radio call has ended (it did not get through). */
  radioTried: boolean;
  /** World facts: up on the Upper Stream, the stairs' fallen bamboo cut, the bucket and the tank filled. */
  reachedUpper: boolean;
  stairsOpen: boolean;
  bucketFilled: boolean;
  tankFilled: boolean;
  /** The water network the player built. */
  water: Network;
}

type V4 = Omit<SaveData, "v" | "kaiStage" | "carry" | "radioTried" | "reachedUpper" | "stairsOpen" | "bucketFilled" | "tankFilled" | "water">
  & { v: 4; kaiStage: "camp" | "rockfall" | "clifftop" | "cove"; carry: "chest" | "barrel" | null };
type V3 = Omit<V4, "v" | "kaiStage" | "boiled" | "boiledDay" | "coveOpen" | "groveOpen" | "reachedCove" | "coveBoxOpened" | "asked" | "chestTaken" | "barrelTaken" | "carry" | "fishDried" | "rainCaught" | "rainDone">
  & { v: 3; kaiStage: "camp" | "rockfall" | "clifftop" };
type V2 = Omit<V3, "v" | "enteredCave" | "caveBoxOpened" | "cliffOpen" | "reachedClifftop" | "signalLit" | "rescued" | "kaiStage"> & { v: 2; kai: { need?: "water" | "food" | "wood"; canFire?: boolean; canAxe?: boolean; want?: "water" | "fish" } };
type V1 = Omit<V2, "v" | "t" | "pathCleared" | "bridgeBuilt" | "gotWater" | "drank" | "caught" | "cooked" | "sleptDay"> & { v: 1; kai: { need?: "water" | "food" | "wood"; canFire?: boolean } };

const STEP_IDS: StepId[] = [
  "eat", "kai", "wood", "stone", "craft", "place", "light", "sleep", "axe", "path", "leaves", "shelter", "build", "bridge", "container", "water",
  "drink", "rod", "fish", "cook", "torch", "cave", "metal", "radio", "showKai", "cliff", "signalFire", "clifftop", "signal", "help",
  "boil", "cove", "askKai", "coveBox", "canvas", "carryBox", "grove", "poles", "rackSite", "rackFrame", "rackStrong", "dryFish",
  "barrel", "catcherSite", "catcherBuilt", "catchRain", "boilRain",
  "upper", "pipePlan", "tangle", "bucket", "pipeCamp", "fillTank", "boilTank"
];
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isBool = (v: unknown): v is boolean => typeof v === "boolean";
const validBag = (v: unknown): v is Bag => isObj(v) && Object.entries(v).every(([k, n]) => k in ITEMS && isNum(n) && n >= 0);
const validPhrases = (v: unknown): v is PhraseId[] => Array.isArray(v) && v.every(p => typeof p === "string" && p in PHRASES);
const validCrafts = (v: unknown): v is CraftId[] => Array.isArray(v) && v.every(p => typeof p === "string" && p in RECIPES);
const numList = (v: unknown) => Array.isArray(v) && v.every(isNum);
const strList = (v: unknown) => Array.isArray(v) && v.every((s) => typeof s === "string");
/** Optional Chapter 2 building fields (frames' parts, corner heights, barrel water, drying fish). */
const validStructure = (b: Record<string, unknown>) =>
  (b.parts === undefined || strList(b.parts))
  && (b.heights === undefined || (numList(b.heights) && (b.heights as number[]).length === 4))
  && (b.water === undefined || (isNum(b.water) && b.water >= 0))
  && (b.fish === undefined || numList(b.fish));
function validBase(raw: Record<string, unknown>): boolean {
  const q = raw.quest, st = raw.stats, p = raw.player;
  if (!isObj(q) || !isNum(q.day) || typeof q.complete !== "boolean" || !Array.isArray(q.done) || !q.done.every(s => STEP_IDS.includes(s as StepId))) return false;
  if (!validBag(raw.bag) || !isObj(st) || !isNum(st.hp) || !isNum(st.stamina) || !isNum(st.food) || !validPhrases(raw.known) || !validPhrases(raw.said) || !validCrafts(raw.unlocked) || !validCrafts(raw.crafted)) return false;
  if (!Array.isArray(raw.buildings) || !raw.buildings.every(b => isObj(b) && typeof b.id === "string" && typeof b.type === "string" && isNum(b.x) && isNum(b.z) && isNum(b.rot) && (b.lit === undefined || typeof b.lit === "boolean") && (b.built === undefined || typeof b.built === "boolean") && validStructure(b))) return false;
  if (!isObj(raw.taken) || !Object.values(raw.taken).every(isNum) || !isObj(p) || !isNum(p.x) || !isNum(p.z) || !isNum(p.yaw) || !isNum(raw.light) || !isNum(raw.ate) || typeof raw.metKai !== "boolean" || typeof raw.crateOpened !== "boolean" || !isObj(raw.kai) || !isNum(raw.savedAt)) return false;
  return true;
}
/** Phase 2 fields shared by v2, v3 and v4. */
function validPhaseTwo(raw: Record<string, unknown>): boolean {
  if (!isNum(raw.t) || raw.t < 0 || raw.t > 1 || typeof raw.pathCleared !== "boolean" || typeof raw.bridgeBuilt !== "boolean" || !["gotWater", "drank", "caught", "cooked", "sleptDay"].every(k => isNum(raw[k]) && (raw[k] as number) >= 0)) return false;
  if (raw.daySaid !== undefined && !validPhrases(raw.daySaid)) return false;
  if (raw.dayNew !== undefined && !validPhrases(raw.dayNew)) return false;
  return true;
}
function validKai(k: Record<string, unknown>, chapterTwo: boolean, chapterThree = false): boolean {
  if (chapterThree) {
    if (k.seen !== undefined && !["waterfall", "stream", "rocks"].includes(k.seen as string)) return false;
    if (!["upperMorning", "pipePlan", "tankMorning"].every((key) => k[key] === undefined || typeof k[key] === "boolean")) return false;
  }
  if ((k.need !== undefined && !["water", "food", "wood"].includes(k.need as string)) || (k.canFire !== undefined && typeof k.canFire !== "boolean") || (k.canAxe !== undefined && typeof k.canAxe !== "boolean") || (k.want !== undefined && !["water", "fish"].includes(k.want as string)) || (k.canTorch !== undefined && typeof k.canTorch !== "boolean") || (k.have !== undefined && !["radio", "metal"].includes(k.have as string))) return false;
  if (k.escapeMorning !== undefined && typeof k.escapeMorning !== "boolean") return false;
  if (!chapterTwo) return true;
  if (k.found !== undefined && !["rope", "canvas", "box"].includes(k.found as string)) return false;
  return ["coveMorning", "groveMorning", "rackPlan", "rainMorning"].every((key) => k[key] === undefined || typeof k[key] === "boolean");
}
const PHASE_THREE = ["enteredCave", "caveBoxOpened", "cliffOpen", "reachedClifftop", "signalLit", "rescued"];

/** Chapter 2 fields shared by v4 and v5. */
function validChapterTwo(raw: Record<string, unknown>): boolean {
  if (!["coveOpen", "groveOpen", "reachedCove", "coveBoxOpened", "chestTaken", "barrelTaken", "rainDone"].every(key => isBool(raw[key]))) return false;
  if (!["boiled", "boiledDay", "fishDried", "rainCaught"].every(key => isNum(raw[key]) && (raw[key] as number) >= 0)) return false;
  return strList(raw.asked);
}
/** A saved water network: posts with notches, pipes between ids. References are repaired on load. */
function validNetwork(v: unknown): v is Network {
  if (!isObj(v) || !isNum(v.next) || !Array.isArray(v.joints) || !Array.isArray(v.pipes)) return false;
  return v.joints.every((j) => isObj(j) && typeof j.id === "string" && isNum(j.x) && isNum(j.z) && isNum(j.notch))
    && v.pipes.every((p) => isObj(p) && typeof p.id === "string" && typeof p.from === "string" && typeof p.to === "string" && (p.kind === "long" || p.kind === "short"));
}

/** Validate a version 5 save. */
export function validateSave(raw: unknown): SaveData | null {
  if (!isObj(raw) || raw.v !== 5 || !validBase(raw) || !validPhaseTwo(raw) || !validKai(raw.kai as Record<string, unknown>, true, true)) return null;
  if (!PHASE_THREE.every(key => isBool(raw[key])) || !["camp", "rockfall", "clifftop", "cove", "upper"].includes(raw.kaiStage as string)) return null;
  if (!validChapterTwo(raw) || !(raw.carry === null || raw.carry === "chest" || raw.carry === "barrel" || raw.carry === "tank")) return null;
  if (!["radioTried", "reachedUpper", "stairsOpen", "bucketFilled", "tankFilled"].every(key => isBool(raw[key])) || !validNetwork(raw.water)) return null;
  return raw as unknown as SaveData;
}
function validateV4(raw: unknown): V4 | null {
  if (!isObj(raw) || raw.v !== 4 || !validBase(raw) || !validPhaseTwo(raw) || !validKai(raw.kai as Record<string, unknown>, true)) return null;
  if (!PHASE_THREE.every(key => isBool(raw[key])) || !["camp", "rockfall", "clifftop", "cove"].includes(raw.kaiStage as string)) return null;
  if (!validChapterTwo(raw) || !(raw.carry === null || raw.carry === "chest" || raw.carry === "barrel")) return null;
  return raw as unknown as V4;
}
function validateV3(raw: unknown): V3 | null {
  if (!isObj(raw) || raw.v !== 3 || !validBase(raw) || !validPhaseTwo(raw) || !validKai(raw.kai as Record<string, unknown>, false)) return null;
  if (!PHASE_THREE.every(key => isBool(raw[key])) || !["camp", "rockfall", "clifftop"].includes(raw.kaiStage as string)) return null;
  return raw as unknown as V3;
}
function validateV2(raw: unknown): V2 | null {
  if (!isObj(raw) || raw.v !== 2 || !validBase(raw) || !validPhaseTwo(raw)) return null;
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
/** Convert a valid Phase 2 save to the current schema (through version 3). */
export function migrateV2(raw: unknown): SaveData | null {
  const old = validateV2(raw);
  if (!old) return null;
  const reset = old.quest.day >= 4;
  return migrateV3({ ...old, v: 3, quest: reset ? { day: 4, done: [], complete: false } : old.quest, t: reset ? dayStartT(4) : old.t, sleptDay: reset ? 3 : old.sleptDay, kai: { ...old.kai }, enteredCave: false, caveBoxOpened: false, cliffOpen: false, reachedClifftop: false, signalLit: false, rescued: false, kaiStage: "camp" });
}
/**
 * Convert a valid Phase 3 save. Its water was drinkable, so it becomes boiled
 * water, and a save that already had or drank water counts its boil step as
 * done. A free-play save (Day 6 or later, from before Chapter 2) resumes at
 * the Day 6 morning with everything it had.
 */
export function migrateV3(raw: unknown): SaveData | null {
  const old = validateV3(raw);
  if (!old) return null;
  return migrateV4(migrateV3ToV4(old));
}
function migrateV3ToV4(old: V3): V4 {
  const bag: Bag = { ...old.bag };
  const oldWater = bag.water ?? 0;
  if (oldWater > 0) {
    bag.boiledWater = (bag.boiledWater ?? 0) + oldWater;
    delete bag.water;
  }
  const freePlay = old.quest.day >= 6;
  return {
    ...old,
    v: 4 as const,
    bag,
    kai: { ...old.kai },
    quest: freePlay ? { day: 6, done: [], complete: false } : old.quest,
    t: freePlay ? dayStartT(6) : old.t,
    sleptDay: freePlay ? 5 : old.sleptDay,
    kaiStage: freePlay ? "camp" : old.kaiStage,
    boiled: old.drank > 0 || oldWater > 0 ? 1 : 0,
    boiledDay: 0,
    coveOpen: false,
    groveOpen: false,
    reachedCove: false,
    coveBoxOpened: false,
    asked: [],
    chestTaken: false,
    barrelTaken: false,
    carry: null,
    fishDried: 0,
    rainCaught: 0,
    rainDone: false
  };
}
/**
 * Convert a valid Chapter 2 save. The rescue now ends the whole story, so a
 * save that had been rescued keeps the radio call as tried (and is not rescued
 * any more). A free-play save (Day 9 or later, from before Chapter 3) resumes
 * at the Day 9 morning with everything it had.
 */
export function migrateV4(raw: unknown): SaveData | null {
  const old = validateV4(raw);
  if (!old) return null;
  const freePlay = old.quest.day >= 9;
  return {
    ...old,
    v: 5,
    kai: { ...old.kai },
    quest: freePlay ? { day: 9, done: [], complete: false } : old.quest,
    t: freePlay ? dayStartT(9) : old.t,
    sleptDay: freePlay ? 8 : old.sleptDay,
    kaiStage: freePlay ? "camp" : old.kaiStage,
    radioTried: old.rescued,
    rescued: false,
    reachedUpper: false,
    stairsOpen: false,
    bucketFilled: false,
    tankFilled: false,
    water: { joints: [], pipes: [], next: 1 }
  };
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

/** Load v5, then safely migrate v4, v3, v2 and v1 (each argument is that key's stored text). */
export function loadSaveText(v5Text: string | null, v4Text?: string | null, v3Text?: string | null, v2Text?: string | null, v1Text?: string | null): SaveData | null {
  const v5 = parseSave(v5Text);
  if (v5) return v5;
  for (const [text, migrate] of [[v4Text, migrateV4], [v3Text, migrateV3], [v2Text, migrateV2], [v1Text, migrateV1]] as const) {
    try {
      const migrated = migrate(JSON.parse(text ?? ""));
      if (migrated) return migrated;
    } catch {
      /* try the next older key */
    }
  }
  return null;
}

/** Bag entries in a stable order (for display and tests). */
export function bagItems(bag: Bag): Array<[ItemId, number]> {
  return (Object.entries(bag) as Array<[ItemId, number]>).filter(([, n]) => n > 0);
}
