import { create } from "zustand";
import type { Bag, CraftId, ItemId } from "./types";
import type { PhraseId } from "./logic/english";
import type { QuestState } from "./logic/quest";
import { START_QUEST } from "./logic/quest";
import type { Stats } from "./logic/stats";
import { START_STATS } from "./logic/stats";
import type { PlacedBuilding, PlaceProblem } from "./world/placement";
import type { IconId } from "../ui/icons";
import { EMPTY_NETWORK, type Network, type PieceKind, type PieceProblem } from "./logic/waterworks";

export type Screen = "title" | "game" | "dayEnd";

/**
 * explore: walking around.  ask: an English prompt is open.  talk: a line of
 * dialogue is showing.  craft: the Craft menu.  place: the building preview.
 * busy: a scripted moment (intro, fainting, the celebration, sleeping, the morning).
 * pipe: Chapter 3 water pipes — laying a new piece (walking aims it) or changing a post.
 */
export type Mode = "explore" | "ask" | "talk" | "craft" | "place" | "busy" | "pipe";

/** The pipe bar and post panel (Chapter 3). The per-frame preview lives in rt.pipe. */
export type PipeUi =
  | {
      kind: "lay";
      /** The open end the new piece leaves from (a joint or an intake). */
      from: string;
      len: PieceKind;
      notch: number;
      problem: PieceProblem | null;
      slope: "down" | "level" | "up";
      snap: "container" | "joint" | null;
      /** Snapped onto a container but the end is under its rim. */
      underRim: boolean;
    }
  | { kind: "edit"; joint: string; notch: number; end: boolean; canTurn: boolean; canAdd: boolean };

export interface Settings {
  /** Speak into the microphone (off = tap the sentences). A teacher setting. */
  mic: boolean;
  music: number;
  sfx: number;
  /** Japanese help for instructions and story lines. */
  japanese: boolean;
  slowVoice: boolean;
  cameraSensitivity: number;
  /** Classroom pace: smaller counts, a faster clock, automatic hints. A teacher setting. */
  classroom: boolean;
}

export type MicState = "unknown" | "ready" | "blocked" | "unsupported";

export type Speaker = "kai" | "self" | "game" | "radio";

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
  kind:
    | "node" | "crate" | "kai" | "campfire" | "shelter" | "fallenTree" | "sign" | "bridge" | "water" | "fish" | "caveMouth" | "caveBox" | "rockfall" | "signalPad"
    // Chapter 2: asking Kai about salvage, the cove crate, the big things you carry, the
    // bamboo thicket, a frame's open socket, a rain-catcher corner, the catcher test, a rack, a barrel.
    | "ask" | "coveCrate" | "carry" | "putDown" | "groveGate" | "socket" | "corner" | "test" | "rack" | "barrel"
    // Chapter 3: the fallen bamboo on the stairs, an intake's lip, a post of the pipe, the bucket and the tank.
    | "tangle" | "intake" | "joint" | "container";
  verb: string;
  noun: string;
  icon: IconId;
}

export interface Toast {
  id: number;
  en: string;
  ja?: string;
  icon?: IconId;
  icons?: Array<{ item: ItemId; n: number }>;
  tone: "good" | "info" | "warn";
}

export type HintKey =
  | "move"
  | "coconut"
  | "eat"
  | "kai"
  | "gather"
  | "craft"
  | "place"
  | "light"
  | "axe"
  | "path"
  | "leaves"
  | "wood2"
  | "shelter"
  | "build"
  | "placeShelter"
  | "sleep"
  | "bridge"
  | "container"
  | "water"
  | "drink"
  | "rod"
  | "fish"
  | "cook"
  | "torch"
  | "cave"
  | "metal"
  | "radio"
  | "showKai"
  | "cliffWait"
  | "cliff"
  | "signalFire"
  | "clifftop"
  | "signal"
  | "help"
  | "micBlocked"
  | "boil"
  // Chapter 2 (Days 6–8).
  | "cove"
  | "askKai"
  | "coveBox"
  | "canvas"
  | "carryBox"
  | "carrying"
  | "grove"
  | "poles"
  | "rackSite"
  | "rackFrame"
  | "rackStrong"
  | "dryFish"
  | "barrel"
  | "catcherSite"
  | "catcherBuilt"
  | "catchRain"
  | "boilRain"
  // Chapter 3 (Days 9–10).
  | "upper"
  | "pipePlan"
  | "tangle"
  | "bucket"
  | "pipeCamp"
  | "fillTank"
  | "boilTank"
  | "laying"
  | null;

/** The student's answers to Kai's questions (each answer changes what he says and gives). */
export interface KaiMemory {
  /** "What do you need?" on Day 1. */
  need?: "water" | "food" | "wood";
  /** "Can you make a fire?" on Day 1. */
  canFire?: boolean;
  /** "Can you make a stone axe?" on Day 2. */
  canAxe?: boolean;
  /** "What do you want to do?" on Day 3: get water or catch a fish. */
  want?: "water" | "fish";
  /** "Can you make a torch?" on Day 4. */
  canTorch?: boolean;
  /** "What do you have?" on Day 4: the radio or the metal. */
  have?: "radio" | "metal";
  /** Day 5's morning talk completed before Kai began walking. */
  escapeMorning?: boolean;
  /** Chapter 2: Day 6's morning talk finished (Kai set off for the cove). */
  coveMorning?: boolean;
  /** Chapter 2: "What did you find?" on Day 6. */
  found?: "rope" | "canvas" | "box";
  /** Chapter 2: Day 7's morning talk finished. */
  groveMorning?: boolean;
  /** Chapter 2: "Let's build a rack." was said and Kai gave the rack frame. */
  rackPlan?: boolean;
  /** Chapter 2: Day 8's morning talk finished (the rain-catcher frame given). */
  rainMorning?: boolean;
  /** Chapter 3: Day 9's morning talk finished (Kai set off for the waterfall). */
  upperMorning?: boolean;
  /** Chapter 3: the answer to "What can you see?" on the shelf. */
  seen?: "waterfall" | "stream" | "rocks";
  /** Chapter 3: "Let's build a pipe." was said (Kai's bucket is on the table rock). */
  pipePlan?: boolean;
  /** Chapter 3: Day 10's morning talk finished (Kai's tank stands at camp). */
  tankMorning?: boolean;
}

/** Where Kai is in the story (he walks between these): Day 5's rockfall and clifftop, Day 6's cove, Day 9's shelf. */
export type KaiStage = "camp" | "rockfall" | "clifftop" | "cove" | "upper";

/** What the player carries: the chest or the tank with Kai, or the barrel alone. */
export type CarryKind = "chest" | "barrel" | "tank";

export interface GameState {
  screen: Screen;
  mode: Mode;
  settings: Settings;
  micState: MicState;
  /** Only startup may display microphone assistance. */
  micStartupProblem: boolean;
  touch: boolean;
  settingsOpen: boolean;
  fade: number;
  hasSave: boolean;

  stats: Stats;
  bag: Bag;
  quest: QuestState;
  known: PhraseId[];
  said: PhraseId[];
  /** Sentences used during the current day, for its end card. */
  daySaid: PhraseId[];
  /** Current-day sentences that were also first-ever successes. */
  dayNew: PhraseId[];
  unlocked: CraftId[];
  crafted: CraftId[];
  buildings: PlacedBuilding[];
  crateOpened: boolean;
  metKai: boolean;
  ate: number;
  kai: KaiMemory;
  /** World gates (Phase 2). The fallen palm in the forest gap has been cut. */
  pathCleared: boolean;
  /** The bridge over the stream to the pond has been built. */
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
  /** Phase 3 world facts (saved). The player has been inside the cave. */
  enteredCave: boolean;
  /** The old box in the cave has been opened (the radio taken). */
  caveBoxOpened: boolean;
  /** Kai helped clear the rockfall: the cliff path is open (a world gate). */
  cliffOpen: boolean;
  /** The player has stood on the clifftop plateau. */
  reachedClifftop: boolean;
  /** The signal fire is on the pad and burning. */
  signalLit: boolean;
  /** Day 5's radio call has ended (it did not get through). */
  radioTried: boolean;
  /** The helicopter rescue has happened (kept for the final chapter; never set by the story yet). */
  rescued: boolean;
  kaiStage: KaiStage;
  /** Safe water: times collected water was boiled, and the last day it happened. */
  boiled: number;
  boiledDay: number;
  /** Chapter 2 world facts (saved). Low tide: the cove passage is open. */
  coveOpen: boolean;
  /** The bamboo thicket on the grove trail is cut. */
  groveOpen: boolean;
  reachedCove: boolean;
  coveBoxOpened: boolean;
  /** Salvage kinds asked about with "What is this?". */
  asked: string[];
  /** The sea chest / the barrel have left their places in the cove. */
  chestTaken: boolean;
  barrelTaken: boolean;
  /** What the player is carrying (the chest or the tank with Kai, or the barrel alone). */
  carry: CarryKind | null;
  fishDried: number;
  rainCaught: number;
  /** Day 8's rain has stopped. */
  rainDone: boolean;
  /** Chapter 3 world facts (saved). The player has been up on the Upper Stream on Day 9 or later. */
  reachedUpper: boolean;
  /** The fallen bamboo at the top of the rock stairs is cut (a world gate). */
  stairsOpen: boolean;
  /** Kai's bucket has had water; the tank at camp has been full. */
  bucketFilled: boolean;
  tankFilled: boolean;
  /** The player's water network: posts and pipes (logic/waterworks.ts). */
  water: Network;
  /** The player is in the cave interior (transient: a save resumes at the cave mouth). */
  inCave: boolean;
  /** Time through the day, from sunrise (0) to held night (1). */
  t: number;
  /** Large transient title shown between morning wake-up and Kai's talk. */
  dayTitle: number | null;
  /** Starry overlay shown during the sleep fade. */
  sleeping: boolean;

  focus: Focus | null;
  prompt: PromptUi | null;
  line: Line | null;
  craftOpen: boolean;
  placing: { item: ItemId; rot: number; problem: PlaceProblem | null } | null;
  pipe: PipeUi | null;
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
  cameraSensitivity: 1,
  classroom: false
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
    daySaid: [] as PhraseId[],
    dayNew: [] as PhraseId[],
    unlocked: [] as CraftId[],
    crafted: [] as CraftId[],
    buildings: [] as PlacedBuilding[],
    crateOpened: false,
    metKai: false,
    ate: 0,
    kai: {} as KaiMemory,
    pathCleared: false,
    bridgeBuilt: false,
    gotWater: 0,
    drank: 0,
    caught: 0,
    cooked: 0,
    sleptDay: 0,
    enteredCave: false,
    caveBoxOpened: false,
    cliffOpen: false,
    reachedClifftop: false,
    signalLit: false,
    radioTried: false,
    rescued: false,
    kaiStage: "camp" as KaiStage,
    boiled: 0,
    boiledDay: 0,
    coveOpen: false,
    groveOpen: false,
    reachedCove: false,
    coveBoxOpened: false,
    asked: [] as string[],
    chestTaken: false,
    barrelTaken: false,
    carry: null as CarryKind | null,
    fishDried: 0,
    rainCaught: 0,
    rainDone: false,
    reachedUpper: false,
    stairsOpen: false,
    bucketFilled: false,
    tankFilled: false,
    water: EMPTY_NETWORK,
    inCave: false,
    t: 0.05,
    dayTitle: null as number | null,
    sleeping: false
  };
}

export const useGame = create<GameState>(() => ({
  screen: "title",
  mode: "busy",
  settings: loadSettings(),
  micState: "unknown",
  micStartupProblem: false,
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
  pipe: null,
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
