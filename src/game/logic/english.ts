/**
 * Every English sentence the student says or chooses, with the key words the
 * speech judge listens for. Display text is exactly what a child reads; the
 * keys are what must be heard (each group = any one of its words).
 *
 * Variant lists hold synonyms a teacher would accept (take/grab for get, rock
 * for stone) and common mishearings of Japanese-accented English by browser
 * recognisers (would -> wood, it -> eat, angry -> hungry, know -> no). Two-word
 * forms are written joined ("campfire"); the judge also joins adjacent words.
 */

const W = {
  get: ["get", "gets", "got", "getting", "gate", "git", "getto", "geto", "take", "takes", "grab", "pick", "picks", "collect", "gather"],
  wood: ["wood", "woods", "would", "wooden", "word", "woody", "wud"],
  stone: ["stone", "stones", "stoned", "stony", "stoner", "rock", "rocks"],
  coconut: ["coconut", "coconuts", "coconut's", "coco", "cocoa", "cocanut", "cocoanut", "kokonut", "coconuts'"],
  eat: ["eat", "eats", "eating", "ate", "it", "eat's", "eet", "eats'"],
  open: ["open", "opens", "opened", "opening", "oben"],
  box: ["box", "boxes", "bucks", "bocks", "boks", "box's", "crate", "chest"],
  make: ["make", "makes", "made", "making", "mate", "maker", "meik"],
  fire: ["fire", "fires", "fired", "fyre", "fier", "fair", "far", "fiya", "fiyah", "campfire", "bonfire", "fireplace"],
  campfire: ["campfire", "campfires", "campfire's", "camp", "fire", "fires", "bonfire"],
  want: ["want", "wants", "wanna", "wanted", "won't", "wont", "won", "wand"],
  need: ["need", "needs", "needed", "neat", "knead", "kneed", "knee", "niid", "nead"],
  hungry: ["hungry", "hungary", "hungrier", "angry", "hangry", "hunger", "hungy"],
  water: ["water", "waters", "wata", "watah", "waiter", "walter", "warter", "wauter"],
  food: ["food", "foods", "foot", "fruit", "fruits", "fuud", "fude"],
  yes: ["yes", "yeah", "yep", "yup", "ya", "yah", "yess", "yea", "can", "sure", "ok", "okay"],
  no: ["no", "nope", "know", "nah", "can't", "cant", "cannot", "not", "don't", "dont"],
  cut: ["cut", "cuts", "cutting", "cat", "cot", "cart", "chop"],
  tree: ["tree", "trees", "three", "tri"],
  leaves: ["leaves", "leaf", "leafs", "lives", "leave", "reeves"],
  build: ["build", "builds", "building", "built", "bill", "bild", "make", "makes", "made", "fix", "repair"],
  bridge: ["bridge", "bridges", "brij", "ridge", "fridge"],
  drink: ["drink", "drinks", "drank", "drunk", "drinking", "dink", "trink"],
  catch: ["catch", "catches", "caught", "cash", "ketch", "get", "gets", "got", "getting"],
  fish: ["fish", "fishes", "fishing", "fist", "fresh", "feesh"],
  cook: ["cook", "cooks", "cooked", "cooking", "cuke", "kook", "coke"],
  sleep: ["sleep", "sleeps", "sleepy", "slept", "sleeping", "slip", "sheep"],
  go: ["go", "goes", "going", "went", "goal", "gold", "goh"],
  cave: ["cave", "caves", "cape", "cafe", "kev", "cage"],
  metal: ["metal", "metals", "medal", "middle", "meadow", "iron", "metaru"],
  have: ["have", "has", "had", "half", "hab"],
  radio: ["radio", "radios", "rajio", "radial", "video"],
  help: ["help", "helps", "helped", "health", "hell", "herb", "heap"]
} as const;

export type PhraseId =
  | "getWood"
  | "getStone"
  | "getCoconut"
  | "eatCoconut"
  | "openBox"
  | "makeFire"
  | "craftCampfire"
  | "craftAxe"
  | "craftTorch"
  | "craftRod"
  | "craftContainer"
  | "craftShelter"
  | "craftSignalFire"
  | "hungry"
  | "needWood"
  | "needStone"
  | "needWater"
  | "needFood"
  | "yesICan"
  | "noICant"
  | "cutTree"
  | "getLeaves"
  | "buildShelter"
  | "buildBridge"
  | "getWater"
  | "drinkWater"
  | "catchFish"
  | "cookFish"
  | "eatFish"
  | "sleep"
  | "needLeaves"
  | "wantWater"
  | "wantFish"
  | "getMetal"
  | "goCave"
  | "haveRadio"
  | "haveMetal"
  | "canHelp"
  | "needHelp"
  | "needMetal";

export interface Phrase {
  id: PhraseId;
  en: string;
  /** All groups must be heard; each group is satisfied by any one of its words. */
  keys: ReadonlyArray<readonly string[]>;
  /** If any of these is heard, the phrase does not match ("No, I can't" is never "yes"). */
  forbid?: readonly string[];
  /** Wrong-but-plausible sentences offered beside this one in mic-free mode. */
  distractors?: PhraseId[];
}

export const PHRASES: Record<PhraseId, Phrase> = {
  getWood: { id: "getWood", en: "Get the wood.", keys: [W.get, W.wood], distractors: ["getStone", "eatCoconut"] },
  getStone: { id: "getStone", en: "Get the stone.", keys: [W.get, W.stone], distractors: ["getWood", "openBox"] },
  getCoconut: { id: "getCoconut", en: "Get the coconut.", keys: [W.get, W.coconut], distractors: ["getStone", "makeFire"] },
  eatCoconut: { id: "eatCoconut", en: "Eat the coconut.", keys: [W.eat, W.coconut], distractors: ["getWood", "openBox"] },
  openBox: { id: "openBox", en: "Open the box.", keys: [W.open, W.box], distractors: ["getStone", "eatCoconut"] },
  makeFire: { id: "makeFire", en: "Make a fire.", keys: [W.make, W.fire], distractors: ["getWood", "eatCoconut"] },
  craftCampfire: {
    id: "craftCampfire",
    en: "I want to make a campfire.",
    keys: [[...W.want, ...W.make], W.campfire],
    distractors: ["craftAxe", "craftTorch"]
  },
  craftAxe: { id: "craftAxe", en: "I want to make a stone axe.", keys: [[...W.want, ...W.make], ["axe", "axes", "ax", "acts", "ox"]] },
  craftTorch: { id: "craftTorch", en: "I want to make a torch.", keys: [[...W.want, ...W.make], ["torch", "torches", "touch", "torch's"]], distractors: ["craftCampfire", "craftAxe"] },
  craftRod: {
    id: "craftRod",
    en: "I want to make a fishing rod.",
    keys: [[...W.want, ...W.make], ["rod", "rods", "fishingrod", "fishing", "road", "rad"]],
    distractors: ["craftContainer", "craftShelter"]
  },
  craftContainer: {
    id: "craftContainer",
    en: "I want to make a water container.",
    keys: [[...W.want, ...W.make], ["container", "containers", "contain", "contena", "watercontainer"]],
    distractors: ["craftRod", "craftCampfire"]
  },
  craftShelter: {
    id: "craftShelter",
    en: "I want to make a shelter.",
    keys: [[...W.want, ...W.make], ["shelter", "shelters", "sheltar", "shelta", "shoulder", "helter"]]
  },
  craftSignalFire: {
    id: "craftSignalFire",
    en: "I want to make a signal fire.",
    keys: [[...W.want, ...W.make], ["signal", "signals", "signalfire", "single", "signo"]],
    distractors: ["craftTorch", "craftAxe"]
  },
  hungry: { id: "hungry", en: "I'm hungry.", keys: [W.hungry], distractors: ["needWood", "needStone"] },
  needWood: { id: "needWood", en: "I need wood.", keys: [W.need, W.wood] },
  needStone: { id: "needStone", en: "I need stones.", keys: [W.need, W.stone] },
  needWater: { id: "needWater", en: "I need water.", keys: [W.need, W.water] },
  needFood: { id: "needFood", en: "I need food.", keys: [W.need, W.food] },
  yesICan: { id: "yesICan", en: "Yes, I can.", keys: [W.yes], forbid: W.no },
  noICant: { id: "noICant", en: "No, I can't.", keys: [W.no] },
  cutTree: { id: "cutTree", en: "Cut the tree.", keys: [W.cut, W.tree], distractors: ["getLeaves", "buildShelter"] },
  getLeaves: { id: "getLeaves", en: "Get the leaves.", keys: [W.get, W.leaves], distractors: ["cutTree", "getWater"] },
  buildShelter: { id: "buildShelter", en: "Build a shelter.", keys: [W.build, ["shelter", "shelters", "sheltar", "shelta", "shoulder", "helter"]], distractors: ["buildBridge", "getLeaves"] },
  buildBridge: { id: "buildBridge", en: "Build a bridge.", keys: [W.build, W.bridge], distractors: ["buildShelter", "getWater"] },
  getWater: { id: "getWater", en: "Get some water.", keys: [W.get, W.water], distractors: ["getLeaves", "catchFish"] },
  drinkWater: { id: "drinkWater", en: "Drink the water.", keys: [W.drink, W.water], distractors: ["getWater", "eatFish"] },
  catchFish: { id: "catchFish", en: "Catch a fish.", keys: [W.catch, W.fish], distractors: ["getWater", "cookFish"] },
  cookFish: { id: "cookFish", en: "Cook the fish.", keys: [W.cook, W.fish], distractors: ["catchFish", "eatFish"] },
  eatFish: { id: "eatFish", en: "Eat the fish.", keys: [W.eat, W.fish], distractors: ["cookFish", "drinkWater"] },
  sleep: { id: "sleep", en: "I want to sleep.", keys: [W.want, W.sleep], distractors: ["hungry", "needLeaves"] },
  needLeaves: { id: "needLeaves", en: "I need leaves.", keys: [W.need, W.leaves], distractors: ["needWood", "needWater"] },
  wantWater: { id: "wantWater", en: "I want to get water.", keys: [[...W.want, ...W.get], W.water], distractors: ["wantFish", "needWater"] },
  getMetal: { id: "getMetal", en: "Get the metal.", keys: [W.get, W.metal], distractors: ["getStone", "openBox"] },
  goCave: { id: "goCave", en: "Go in the cave.", keys: [W.go, W.cave], distractors: ["openBox", "getMetal"] },
  haveRadio: { id: "haveRadio", en: "I have a radio.", keys: [W.have, W.radio] },
  haveMetal: { id: "haveMetal", en: "I have metal.", keys: [W.have, W.metal] },
  canHelp: { id: "canHelp", en: "Can you help me?", keys: [W.help], distractors: ["cutTree", "getStone"] },
  needHelp: { id: "needHelp", en: "I need help.", keys: [W.need, W.help], distractors: ["needWater", "sleep"] },
  needMetal: { id: "needMetal", en: "I need metal.", keys: [W.need, W.metal], distractors: ["needWood", "needStone"] },
  wantFish: { id: "wantFish", en: "I want to catch a fish.", keys: [[...W.want, ...W.catch], W.fish], distractors: ["wantWater", "needWater"] }
};

export function phrase(id: PhraseId): Phrase {
  return PHRASES[id];
}
