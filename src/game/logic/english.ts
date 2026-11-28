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
  tent: ["tent", "tents", "tent's", "tento"],
  cup: ["cup", "cups", "cup's", "kappu"],
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
  help: ["help", "helps", "helped", "health", "hell", "herb", "heap"],
  // Chapter 2 (Days 6–8).
  what: ["what", "what's", "whats", "wat", "watt", "white"],
  this: ["this", "these", "dis", "thiz", "is"],
  canvas: ["canvas", "canvases", "campus", "canvass", "kanbasu", "cloth", "sail"],
  rope: ["rope", "ropes", "robe", "roup", "lope", "loop"],
  carry: ["carry", "carries", "carried", "carrying", "kerry", "cary", "curry", "pick", "lift", "take"],
  heavy: ["heavy", "heavier", "heavey", "hebby", "hevy", "heavily", "evie"],
  back: ["back", "bag", "pack", "buck", "bak", "home", "camp"],
  put: ["put", "puts", "putting", "but", "pot", "putt", "place"],
  here: ["here", "hear", "hair", "hia", "heer", "there"],
  found: ["found", "find", "finds", "fond", "fund", "faund"],
  bamboo: ["bamboo", "bamboos", "bambu", "banbu", "panda"],
  rack: ["rack", "racks", "rock", "rag", "lack", "rak", "wreck"],
  long: ["long", "longer", "wrong", "lung", "lawn", "rong"],
  short: ["short", "shorter", "shot", "shoot", "shorts", "sort"],
  pole: ["pole", "poles", "pool", "paul", "pole's", "pour", "poll", "bamboo"],
  rain: ["rain", "raining", "rains", "rainy", "lane", "rein", "reign", "rainin"],
  barrel: ["barrel", "barrels", "barre", "baral", "bareru", "beryl"],
  high: ["higher", "high", "hire", "hyer", "taller", "up"],
  low: ["lower", "low", "lou", "rower", "down"],
  tooLow: ["low", "lou", "row", "law"],
  move: ["move", "moves", "moving", "moo", "moob", "push"],
  left: ["left", "lift", "lef", "reft"],
  right: ["right", "write", "rite", "light", "wright", "ride"],
  flow: ["flowing", "flow", "flows", "floating", "floor", "flowin", "blowing", "running", "going", "works", "working"],
  work: ["work", "works", "working", "walk", "wark", "worked"],
  not: ["doesn't", "dosent", "does", "not", "don't", "dont", "isn't", "no"],
  try: ["try", "tries", "trying", "tried", "tri", "chai", "cry", "again"],
  boil: ["boil", "boils", "boiled", "boiling", "boy", "bowl", "foil", "oil", "spoil"],
  // Chapter 3 (Days 9–10).
  see: ["see", "sea", "she", "si", "seeing", "saw", "look", "looking", "watch"],
  waterfall: ["waterfall", "waterfalls", "falls", "fall", "fool", "foll", "watafall"],
  stream: ["stream", "streams", "string", "strim", "scream", "river"],
  bigRock: ["rocks", "rock", "stones", "stone", "lock", "locks", "big"],
  pipe: ["pipe", "pipes", "pie", "pipe's", "type", "paip", "bipe", "piping"],
  turn: ["turn", "turns", "turned", "turning", "tan", "tern", "tarn", "rotate"],
  connect: ["connect", "connects", "connected", "connecting", "collect", "kinekt", "konekuto", "join", "attach"],
  tooHigh: ["high", "hi", "hai", "hire", "height", "tall"],
  full: ["full", "fool", "fur", "fall", "foo", "fuller"],
  tank: ["tank", "tanks", "thank", "tang", "tunk", "tanku"]
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
  | "needMetal"
  | "askWhat"
  | "getCanvas"
  | "getRope"
  | "carryBox"
  | "tooHeavy"
  | "goBack"
  | "putHere"
  | "foundRope"
  | "foundCanvas"
  | "foundBox"
  | "needBox"
  | "cutBamboo"
  | "buildRack"
  | "tooLong"
  | "tooShort"
  | "dryFish"
  | "needPoles"
  | "raining"
  | "weNeedWater"
  | "carryBarrel"
  | "higher"
  | "lower"
  | "moveLeft"
  | "moveRight"
  | "flowing"
  | "notWork"
  | "tooLow"
  | "tryAgain"
  | "boilWater"
  | "seeWaterfall"
  | "seeStream"
  | "seeRocks"
  | "buildPipe"
  | "turnIt"
  | "connect"
  | "tooHigh"
  | "tankFull"
  | "needBamboo"
  | "carryTank";

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
    en: "I want to make a cup.",
    keys: [[...W.want, ...W.make], W.cup],
    distractors: ["craftRod", "craftCampfire"]
  },
  craftShelter: {
    id: "craftShelter",
    en: "I want to make a tent.",
    keys: [[...W.want, ...W.make], W.tent]
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
  buildShelter: { id: "buildShelter", en: "Build a tent.", keys: [W.build, W.tent], distractors: ["buildBridge", "getLeaves"] },
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
  wantFish: { id: "wantFish", en: "I want to catch a fish.", keys: [[...W.want, ...W.catch], W.fish], distractors: ["wantWater", "needWater"] },

  // Chapter 2: Shipwreck Cove (Day 6).
  askWhat: { id: "askWhat", en: "What is this?", keys: [W.what], distractors: ["openBox", "canHelp"] },
  getCanvas: { id: "getCanvas", en: "Get the canvas.", keys: [W.get, W.canvas], distractors: ["getRope", "openBox"] },
  getRope: { id: "getRope", en: "Get the rope.", keys: [W.get, W.rope], distractors: ["getCanvas", "getWood"] },
  carryBox: { id: "carryBox", en: "Carry the box.", keys: [W.carry, W.box], distractors: ["openBox", "getWood"] },
  tooHeavy: { id: "tooHeavy", en: "It's too heavy.", keys: [W.heavy], distractors: ["tooLong", "hungry"] },
  goBack: { id: "goBack", en: "Let's go back.", keys: [W.go, W.back], distractors: ["putHere", "goCave"] },
  putHere: { id: "putHere", en: "Put it here.", keys: [W.put, W.here], distractors: ["goBack", "openBox"] },
  foundRope: { id: "foundRope", en: "I found a rope.", keys: [W.found, W.rope] },
  foundCanvas: { id: "foundCanvas", en: "I found canvas.", keys: [W.found, W.canvas] },
  foundBox: { id: "foundBox", en: "I found a box.", keys: [W.found, W.box] },
  needBox: { id: "needBox", en: "I need a box.", keys: [W.need, W.box], distractors: ["needWood", "needPoles"] },
  // Chapter 2: the Bamboo Grove (Day 7).
  cutBamboo: { id: "cutBamboo", en: "Cut the bamboo.", keys: [W.cut, W.bamboo], distractors: ["cutTree", "getWood"] },
  buildRack: { id: "buildRack", en: "Let's build a rack.", keys: [W.build, W.rack], distractors: ["buildShelter", "buildBridge"] },
  tooLong: { id: "tooLong", en: "It's too long.", keys: [W.long], forbid: W.short, distractors: ["tooShort", "tooHeavy"] },
  tooShort: { id: "tooShort", en: "It's too short.", keys: [W.short], forbid: W.long, distractors: ["tooLong", "tooHeavy"] },
  dryFish: { id: "dryFish", en: "Put the fish on the rack.", keys: [W.put, W.fish], distractors: ["cookFish", "eatFish"] },
  needPoles: { id: "needPoles", en: "I need poles.", keys: [W.need, W.pole], distractors: ["needWood", "needBox"] },
  // Chapter 2: rain (Day 8).
  raining: { id: "raining", en: "It's raining.", keys: [W.rain], distractors: ["tooHeavy", "hungry"] },
  weNeedWater: { id: "weNeedWater", en: "We need water.", keys: [W.need, W.water], distractors: ["needBox", "needPoles"] },
  carryBarrel: { id: "carryBarrel", en: "Carry the barrel.", keys: [W.carry, W.barrel], distractors: ["carryBox", "getWater"] },
  higher: { id: "higher", en: "Make it higher.", keys: [W.high], forbid: ["lower", "low"] },
  lower: { id: "lower", en: "Make it lower.", keys: [W.low], forbid: ["higher", "high"] },
  moveLeft: { id: "moveLeft", en: "Move it left.", keys: [W.left], forbid: ["right"] },
  moveRight: { id: "moveRight", en: "Move it right.", keys: [W.right], forbid: ["left"] },
  flowing: { id: "flowing", en: "The water is flowing.", keys: [W.flow], forbid: ["doesn't", "not", "low"] },
  notWork: { id: "notWork", en: "It doesn't work.", keys: [W.work], forbid: ["low", "flowing"] },
  tooLow: { id: "tooLow", en: "It's too low.", keys: [W.tooLow], forbid: ["flowing", "work"] },
  tryAgain: { id: "tryAgain", en: "Let's try again.", keys: [W.try], distractors: ["goBack", "putHere"] },
  boilWater: { id: "boilWater", en: "Boil the water.", keys: [W.boil, W.water], distractors: ["drinkWater", "cookFish"] },

  // Chapter 3: the Upper Stream (Days 9–10).
  seeWaterfall: { id: "seeWaterfall", en: "I see a waterfall.", keys: [W.see, W.waterfall] },
  seeStream: { id: "seeStream", en: "I see a stream.", keys: [W.see, W.stream] },
  seeRocks: { id: "seeRocks", en: "I see big rocks.", keys: [W.see, W.bigRock] },
  buildPipe: { id: "buildPipe", en: "Let's build a pipe.", keys: [W.build, W.pipe], distractors: ["buildRack", "buildBridge"] },
  turnIt: { id: "turnIt", en: "Turn it.", keys: [W.turn], distractors: ["putHere", "connect"] },
  connect: { id: "connect", en: "Connect them.", keys: [W.connect], distractors: ["putHere", "turnIt"] },
  tooHigh: { id: "tooHigh", en: "It's too high.", keys: [W.tooHigh], forbid: ["low", "lower", "flowing", "work"], distractors: ["tooLow", "tooShort"] },
  tankFull: { id: "tankFull", en: "The tank is full.", keys: [W.full], forbid: ["empty", "not"], distractors: ["flowing", "notWork"] },
  needBamboo: { id: "needBamboo", en: "I need more bamboo.", keys: [W.need, W.bamboo], distractors: ["needWood", "needBox"] },
  carryTank: { id: "carryTank", en: "Carry the tank.", keys: [W.carry, W.tank], distractors: ["carryBox", "carryBarrel"] }
};

export function phrase(id: PhraseId): Phrase {
  return PHRASES[id];
}
