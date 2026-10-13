import { create } from "zustand";
import type { Bag, CraftId, ItemId } from "./types";
import type { PhraseId } from "./logic/english";
import type { QuestState } from "./logic/quest";
import { START_QUEST } from "./logic/quest";
import type { Stats } from "./logic/stats";
import { START_STATS } from "./logic/stats";
import type { PlacedBuilding, PlaceProblem } from "./world/placement";
import type { IconId } from "../ui/icons";

export type Screen = "title" | "game" | "dayEnd";

/**
 * explore: walking around.  ask: an English prompt is open.  talk: a line of
 * dialogue is showing.  craft: the Craft menu.  place: the building preview.
 * busy: a scripted moment (intro, fainting, the celebration).
 */
export type Mode = "explore" | "ask" | "talk" | "craft" | "place" | "busy";

export interface Settings {
  /** Speak into the microphone (off = tap the sentences). A teacher setting. */
  mic: boolean;
  music: number;
  sfx: number;
  /** Japanese help for instructions and story lines. */
  japanese: boolean;
  slowVoice: boolean;
  cameraSensitivity: number;
}

export type MicState = "unknown" | "ready" | "blocked" | "unsupported";

export type Speaker = "kai" | "self" | "game";

export interface Choice {
  id: PhraseId;
  en: string;
}

export interface PromptUi {
  id: number;
  kind: "command" | "choice";
  question: { en: string; ja?: string; by: Speaker } | null;
  picture: IconId | null;
  /** Sentences shown to read aloud. */
  sentences: Choice[];
  /** Tappable sentences (mic-free, or the rescue after three misses). */
  choices: Choice[];
  status: "ready" | "listening" | "miss" | "unclear" | "correct" | "wrong";
  heard: string;
  misses: number;
  buttons: boolean;
  wrongId: PhraseId | null;
  matched: PhraseId | null;
  cancellable: boolean;
  /** The sentence is being read aloud (it pulses). */
  reading: boolean;
}

export interface Line {
  id: number;
  by: Speaker;
  en: string;
  ja?: string;
  /** Target English (a question to understand): never glossed in Japanese. */
  target?: boolean;
  /** Small item icons shown with the line ("three wood and two stones"). */
  icons?: Array<{ item: ItemId; n: number }>;
}

export interface Focus {
  id: string;
  kind: "node" | "crate" | "kai" | "campfire" | "sign";
  verb: string;
  noun: string;
  icon: IconId;
}

export interface Toast {
  id: number;
  en: string;
  ja?: string;
  icon?: IconId;
  tone: "good" | "info" | "warn";
}

export type HintKey = "move" | "coconut" | "eat" | "kai" | "gather" | "craft" | "place" | "light" | "micBlocked" | null;

export interface KaiMemory {
  need?: "water" | "food" | "wood";
  canFire?: boolean;
}

export interface GameState {
  screen: Screen;
  mode: Mode;
  settings: Settings;
  micState: MicState;
  touch: boolean;
  settingsOpen: boolean;
  fade: number;
  hasSave: boolean;

  stats: Stats;
  bag: Bag;
  quest: QuestState;
  known: PhraseId[];
  said: PhraseId[];
  unlocked: CraftId[];
  crafted: CraftId[];
  buildings: PlacedBuilding[];
  crateOpened: boolean;
  metKai: boolean;
  ate: number;
  kai: KaiMemory;

  focus: Focus | null;
  prompt: PromptUi | null;
  line: Line | null;
  craftOpen: boolean;
  placing: { item: ItemId; rot: number; problem: PlaceProblem | null } | null;
  toasts: Toast[];
  hint: HintKey;
  /** The "I need..." button pulses (food is low). */
  needsPulse: boolean;
  /** The Craft button pulses (a new recipe, or something can be made). */
  craftPulse: boolean;
  /** Item picked in the hotbar (its actions are open). */
  selected: ItemId | null;
}

const SETTINGS_KEY = "si.settings.v1";

export const DEFAULT_SETTINGS: Settings = {
  mic: true,
  music: 0.35,
  sfx: 0.75,
  japanese: true,
  slowVoice: false,
  cameraSensitivity: 1
};

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    /* storage blocked on some managed devices */
  }
  return { ...DEFAULT_SETTINGS };
}

export function saveSettings(s: Settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

export function freshGameData() {
  return {
    stats: { ...START_STATS },
    bag: {} as Bag,
    quest: { ...START_QUEST, done: [] },
    known: [] as PhraseId[],
    said: [] as PhraseId[],
    unlocked: [] as CraftId[],
    crafted: [] as CraftId[],
    buildings: [] as PlacedBuilding[],
    crateOpened: false,
    metKai: false,
    ate: 0,
    kai: {} as KaiMemory
  };
}

export const useGame = create<GameState>(() => ({
  screen: "title",
  mode: "busy",
  settings: loadSettings(),
  micState: "unknown",
  touch: false,
  settingsOpen: false,
  fade: 0,
  hasSave: false,
  ...freshGameData(),
  focus: null,
  prompt: null,
  line: null,
  craftOpen: false,
  placing: null,
  toasts: [],
  hint: null,
  needsPulse: false,
  craftPulse: false,
  selected: null
}));

export const setGame = useGame.setState;
export const getGame = useGame.getState;

let toastId = 1;
/** Short message in the top-centre stack; disappears by itself. */
export function toast(t: Omit<Toast, "id">, ms = 2600) {
  const id = toastId++;
  setGame((s) => ({ toasts: [...s.toasts.slice(-2), { ...t, id }] }));
  window.setTimeout(() => setGame((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })), ms);
}
