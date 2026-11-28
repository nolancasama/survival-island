import { getGame, setGame, toast, type CarryKind } from "../store";
import { rt, floatText } from "../runtime";
import { ITEMS, type Bag, type ItemId } from "../types";
import type { PhraseId } from "../logic/english";
import { addItem, count, hasAll, removeAll, stackLimit } from "../logic/inventory";
import { pace } from "../logic/pace";
import { currentStep, CATCHER_POLES, RACK_POLES } from "../logic/quest";
import { spend } from "../logic/stats";
import { HEAVY, FIRE_OUT_SECONDS, RAIN_DAY, easeRain, rainWanted } from "../logic/weather";
import {
  START_HEIGHTS, catcherBuilt, catcherFlow, dryFish, fillBarrel, flowAnswer, openSockets, rackFrameComplete, rackSlots,
  rackStable, toLocal, type Flow, type FlowProblem
} from "../logic/structures";
import { groundY, KAI_HOME } from "../world/island";
import {
  COVE_BARREL, COVE_CRATE, COVE_PASSAGE, GROVE, GROVE_GATE, KAI_COVE, KAI_COVE_ROUTE, SEA_CHEST, reachedCoveAt
} from "../world/chapter2";
import { STATIC_OBSTACLES } from "../world/collision";
import { buildingObstacles, placeProblem, type PlacedBuilding } from "../world/placement";
import { pipeObstacles } from "../world/pipeWorld";
import { ask, say } from "./ask";
import { refreshQuest, save, showBeacons, showPlaces, updateHint, wait } from "./session";
import { currentGates, worldPropObstacles } from "./places";
import { socketsOf, type AskKind } from "./chapter2Focus";
import { walkKaiRoute } from "../kaiRoute";
import { audio } from "../../audio/audio";

/**
 * Chapter 2 "A Better Camp" (Days 6–8; EXPANSION_PLAN.md Milestones 1–3).
 * The design is frozen in DESIGN_DECISIONS.md, "2026-11-23 — Chapter 2".
 */

/** Camp reach: a storage box or barrel this close to a tent or campfire is "at camp". */
export const CAMP_RADIUS = 15;

const known = (id: PhraseId) => getGame().known.includes(id);

function face(x: number, z: number) {
  rt.player.yaw = Math.atan2(x - rt.player.x, z - rt.player.z);
}

function give(item: ItemId, n: number, at?: { x: number; z: number }) {
  const added = addItem(getGame().bag, item, n);
  setGame({ bag: added.bag });
  const p = at ?? rt.player;
  if (added.added) floatText(`+${added.added} ${ITEMS[item].en}`, p.x, groundY(p.x, p.z) + 1.6, p.z);
  return added.added;
}

function updateBuilding(id: string, patch: Partial<PlacedBuilding>) {
  setGame({ buildings: getGame().buildings.map((b) => (b.id === id ? { ...b, ...patch } : b)) });
}

/** Within camp reach of a tent or campfire. */
export function nearCamp(x: number, z: number, buildings: readonly PlacedBuilding[] = getGame().buildings): boolean {
  return buildings.some((b) => (b.type === "shelter" || b.type === "campfire") && Math.hypot(b.x - x, b.z - z) <= CAMP_RADIUS);
}

/** A storage box at camp, as the Day 6 step counts it. */
export function storageAtCamp(buildings: readonly PlacedBuilding[]): boolean {
  return buildings.some((b) => b.type === "storage" && nearCamp(b.x, b.z, buildings));
}

let buildingSeq = 1;
const newId = () => `b${Date.now().toString(36)}${buildingSeq++}`;

// ------------------------------------------------------------ morning talks

/** Day 6: low tide opens the passage, and Kai sets off for the cove. */
export async function coveMorning() {
  await say("kai", "Good morning! Remember the boxes we saw? Let's make our camp better!", "おはよう！ みた はこ、 おぼえてる？ キャンプを もっと よく しよう！");
  await say("kai", "Our bags are full. We need a big box.", "かばんが いっぱいだね。 おおきな はこが いるよ。");
  setGame({ coveOpen: true });
  rt.coveOpenT0 = rt.time;
  // A short look along the passage from the beach end: the sea has gone out and the way to the cove is open.
  const start = COVE_PASSAGE[0];
  const end = COVE_PASSAGE[COVE_PASSAGE.length - 1];
  rt.camera.mode = "shot";
  rt.camera.shot = { pos: { x: start.x - 5.5, y: 8.5, z: start.z + 6.5 }, target: { x: end.x - 2, y: 0.4, z: end.z } };
  await wait(1200);
  await say("kai", "Look! The water is low. We can walk to the next cove!", "みて！ みずが ひいたよ。 となりの いりえまで あるけるね！");
  rt.camera.mode = "follow";
  rt.camera.shot = null;
  await say("kai", "Let's go! I'll meet you there.", "いこう！ むこうで まってるね。");
  setGame({ kai: { ...getGame().kai, coveMorning: true }, kaiStage: "cove" });
  walkKaiRoute(KAI_COVE_ROUTE);
  showPlaces(["covePassage"]);
  save();
}

/** Day 7: the rack plan and the bamboo thicket. */
export async function groveMorning() {
  await say("kai", "Good morning! Fish go bad fast. Let's dry fish on a rack!", "おはよう！ さかなは すぐ いたむね。 ほしだなで ほそう！");
  await say("kai", `We need bamboo poles. Get ${RACK_POLES === 9 ? "nine" : String(RACK_POLES)} poles.`, `たけの ぼうが ${RACK_POLES}ほん いるよ。`, {
    icons: [{ item: "pole", n: RACK_POLES }]
  });
  await say("kai", "Bamboo grows in the forest. But it's very thick.", "たけは もりに あるよ。 でも すごく しげってる。");
  setGame({ kai: { ...getGame().kai, groveMorning: true } });
  showPlaces([getGame().groveOpen ? "bamboo-1" : GROVE_GATE.id]);
  save();
}

/** Day 8: it is raining, the fire is out, and the rain is water. */
export async function rainMorning() {
  await say("kai", "Good morning! … Oh!", "おはよう！ …あっ！");
  await ask({ kind: "command", options: ["raining"], picture: "rain", question: { en: "How's the weather?", by: "kai" }, readQuestion: true, readSentence: true });
  await say("kai", "Our fire is out. And the pond is far.", "たきびが きえちゃった。 それに いけは とおいね。");
  await ask({ kind: "command", options: ["weNeedWater"], picture: "boiledWater", question: { en: "What do we need?", by: "kai" }, readQuestion: true, readSentence: true });
  await say("kai", "Rain is water! Let's catch the rain!", "あめは みずだ！ あめを ためよう！");
  if (count(getGame().bag, "catcher") === 0 && !getGame().buildings.some((b) => b.type === "catcher")) {
    setGame({ bag: addItem(getGame().bag, "catcher", 1, Infinity).bag });
    audio.play("unlock");
    toast({ en: "New: rain catcher", ja: "あたらしい: あまみず あつめ", icon: "catcher", tone: "good" }, 3500);
  }
  const needs = pace(getGame().settings.classroom).catcherCanvas;
  await say("kai", `We need four poles, ${needs.canvas === 1 ? "one canvas" : "two canvas"} and one rope. And the barrel from the cove!`, `ぼう 4ほん、ぬの ${needs.canvas}まい、ロープ 1ほん。 それと いりえの たる！`, {
    icons: [{ item: "pole", n: CATCHER_POLES }, { item: "canvas", n: needs.canvas! }, { item: "rope", n: needs.rope! }]
  });
  setGame({ kai: { ...getGame().kai, rainMorning: true } });
  save();
}

// ---------------------------------------------------------------- Kai's help

const numberWords = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];

/** Repeatable hints on Days 6–8, matching the step targets. */
export async function helpChapterTwo(day: number) {
  const g = getGame();
  const step = currentStep(g.quest)?.id;
  showChapterTwoTarget();
  if (day === 6) {
    switch (step) {
      case "cove":
        await say("kai", "Come to the cove! Walk between the rocks.", "いりえに おいで！ いわの あいだを とおってね。");
        return;
      case "askKai":
        await say("kai", "Look around! Ask me: What is this?", "まわりを みて！ 「What is this?」って きいてね。");
        return;
      case "coveBox":
        await say("kai", "There is a box in the sand. Open it!", "すなに はこが あるよ。 あけてみて！");
        return;
      case "canvas":
        await say("kai", "Get canvas from the old sails!", "ふるい ほから ぬのを とろう！");
        return;
      case "carryBox":
        if (g.chestTaken) await say("kai", "Let's take the big box to our camp!", "おおきな はこを キャンプに はこぼう！");
        else await say("kai", "Let's carry the big box! It's heavy.", "おおきな はこを はこぼう！ おもいよ。");
        return;
    }
  }
  if (day === 7) {
    if (step === "rackSite" || (step === "poles" && count(g.bag, "pole") >= RACK_POLES)) {
      if (!g.kai.rackPlan && count(g.bag, "rack") === 0 && !g.buildings.some((b) => b.type === "rack")) return planRack();
    }
    switch (step) {
      case "grove":
        await say("kai", "Cut the bamboo with your axe!", "おので たけを きろう！");
        return;
      case "poles":
        await say("kai", `Get ${numberWords[RACK_POLES]} bamboo poles.`, `たけの ぼうを ${RACK_POLES}ほん あつめよう。`, { icons: [{ item: "pole", n: RACK_POLES }] });
        return;
      case "rackSite":
        await say("kai", "Put the rack down. Choose a good place!", "ほしだなを おこう。 いい ばしょを えらんでね！");
        return;
      case "rackFrame":
        await say("kai", "Put the four legs in first. Then the bars on top.", "さきに あし 4ほん。 それから うえの ぼう。");
        return;
      case "rackStrong":
        await say("kai", "It's shaking! Put a pole across a long side and a short side.", "ぐらぐら してる！ ながい がわと みじかい がわに ななめの ぼうを いれよう。");
        return;
      case "dryFish":
        if (count(getGame().bag, "fish") === 0) {
          give("fish", 1);
          await say("kai", "Here is a fish!", "はい、 さかな！");
        }
        await say("kai", "Put the fish on the rack. The sun dries it.", "さかなを ほしだなに かけよう。 おひさまが ほして くれるよ。");
        return;
    }
  }
  if (day === 8) {
    switch (step) {
      case "poles":
        await say("kai", "Get four bamboo poles.", "たけの ぼうを 4ほん あつめよう。", { icons: [{ item: "pole", n: CATCHER_POLES }] });
        return;
      case "barrel":
        await say("kai", "Bring the barrel from the cove!", "いりえから たるを もってこよう！");
        return;
      case "catcherSite":
        if (count(getGame().bag, "catcher") === 0 && !getGame().buildings.some((b) => b.type === "catcher")) {
          setGame({ bag: addItem(getGame().bag, "catcher", 1, Infinity).bag });
        }
        await say("kai", "Put the rain catcher down near the tent.", "テントの ちかくに あまみず あつめを おこう。");
        return;
      case "catcherBuilt":
        await say("kai", "Put up four posts. Then put the canvas on top.", "はしらを 4ほん たてよう。 それから うえに ぬの。");
        return;
      case "catchRain":
        await say("kai", "Make one corner the lowest. Put the barrel under it!", "かどを ひとつだけ いちばん ひくく しよう。 その したに たる！");
        return;
      case "boilRain":
        if (!getGame().buildings.some((b) => b.type === "campfire" && b.lit)) {
          await say("kai", "The rain stopped. Make a fire. Then boil the water.", "あめが やんだ。 火を つけて、 みずを わかそう。");
        } else {
          await say("kai", "Boil the water at the fire. Then it's safe.", "火で みずを わかそう。 そうすれば あんぜん。");
        }
        return;
    }
  }
  await say("kai", "Look! Over there.", "みて！ あそこだよ。");
}

/** "What do you want to make?" → "Let's build a rack." Kai gives the rack frame. */
async function planRack() {
  await ask({ kind: "command", options: ["buildRack"], picture: "rack", question: { en: "What do you want to make?", by: "kai" }, readQuestion: true, readSentence: true });
  await say("kai", "Good idea! Put it near the tent.", "いいね！ テントの ちかくに おこう。");
  setGame({ bag: addItem(getGame().bag, "rack", 1, Infinity).bag, kai: { ...getGame().kai, rackPlan: true }, craftPulse: true });
  audio.play("unlock");
  toast({ en: "New: drying rack", ja: "あたらしい: ほしだな", icon: "rack", tone: "good" }, 3500);
}

/** Beacons for the open Chapter 2 step (Kai's hints and classroom automatic help). */
export function showChapterTwoTarget(): boolean {
  const g = getGame();
  const step = currentStep(g.quest)?.id;
  const kit = (type: "rack" | "catcher") => g.buildings.find((b) => b.type === type);
  switch (step) {
    case "cove":
      showPlaces(["covePassage"]);
      return true;
    case "askKai":
      showPlaces([SEA_CHEST.id, "canvas-1"]);
      return true;
    case "coveBox":
      showPlaces([COVE_CRATE.id]);
      return true;
    case "canvas":
      return showBeacons("canvas");
    case "carryBox":
      if (!g.chestTaken) showPlaces([SEA_CHEST.id]);
      else showPlaces(g.buildings.filter((b) => b.type === "storage").map((b) => b.id));
      return true;
    case "grove":
      showPlaces([GROVE_GATE.id]);
      return true;
    case "poles":
      if (!g.groveOpen) showPlaces([GROVE_GATE.id]);
      else return showBeacons("bamboo");
      return true;
    case "rackSite":
      if (count(g.bag, "rack") > 0) setGame({ selected: "rack" });
      else showPlaces(["kai"]);
      return true;
    case "rackFrame":
    case "rackStrong": {
      const rack = kit("rack");
      if (rack) showPlaces([rack.id]);
      return true;
    }
    case "dryFish": {
      const rack = kit("rack");
      showPlaces(rack ? [rack.id] : ["kai"]);
      return true;
    }
    case "barrel":
      showPlaces(g.barrelTaken ? g.buildings.filter((b) => b.type === "barrel").map((b) => b.id) : ["covePassage", COVE_BARREL.id]);
      return true;
    case "catcherSite":
      if (count(g.bag, "catcher") > 0) setGame({ selected: "catcher" });
      else showPlaces(["kai"]);
      return true;
    case "catcherBuilt":
    case "catchRain": {
      const catcher = kit("catcher");
      if (catcher) showPlaces([catcher.id]);
      return true;
    }
    case "boilRain":
      showPlaces(g.buildings.filter((b) => b.type === "campfire").map((b) => b.id));
      return true;
  }
  return false;
}

// -------------------------------------------------------------- the cove

const ANSWERS: Record<AskKind, { en: string; ja: string }> = {
  chest: { en: "It's a big box! We can keep our things in it.", ja: "おおきな はこだ！ ものを しまえるよ。" },
  barrel: { en: "It's a barrel. It can hold water!", ja: "たるだよ。 みずを ためられるね！" },
  canvas: { en: "It's canvas. It keeps the rain out.", ja: "ぬのだよ。 あめを ふせげるよ。" },
  rope: { en: "It's rope. We can tie things with it.", ja: "ロープだよ。 ものを しばれるね。" },
  metal: { en: "It's metal from the ship.", ja: "ふねの てつだね。" }
};

/** "What is this?" at a piece of salvage, with Kai in the cove. */
export async function askAbout(id: string, kind: AskKind, at: { x: number; z: number }) {
  face(at.x, at.z);
  const said = await ask({ kind: "command", options: ["askWhat"], picture: "question", cancellable: true, readSentence: !known("askWhat") });
  if (!said) return;
  setGame({ mode: "talk", focus: null });
  rt.kai.yaw = Math.atan2(at.x - rt.kai.x, at.z - rt.kai.z);
  showPlaces([id]);
  const answer = ANSWERS[kind];
  await say("kai", answer.en, answer.ja);
  setGame({ asked: [...getGame().asked.filter((k) => k !== kind), kind], mode: "explore" });
  refreshQuest();
}

/** The half-buried crate in the cove: a new box, so it always asks. */
export async function openCoveCrate() {
  if (getGame().coveBoxOpened) return;
  const said = await ask({ kind: "command", options: ["openBox"], picture: "box", cancellable: true, readSentence: true });
  if (!said || getGame().coveBoxOpened) return;
  rt.coveBoxOpenT0 = rt.time;
  rt.player.action = { kind: "gather", t0: rt.time };
  rt.player.frozenUntil = rt.time + 0.5;
  audio.play("box");
  let bag = addItem(getGame().bag, "rope", 2).bag;
  bag = addItem(bag, "canvas", 1).bag;
  setGame({ bag, coveBoxOpened: true });
  const y = groundY(COVE_CRATE.x, COVE_CRATE.z) + 1.3;
  floatText("+2 rope", COVE_CRATE.x, y + 0.5, COVE_CRATE.z);
  window.setTimeout(() => floatText("+1 canvas", COVE_CRATE.x, y, COVE_CRATE.z), 700);
  refreshQuest();
}

// ------------------------------------------------------------------ carrying

/** Kai comes to stand at the far end of the box (he walks; slow renders are not waited on forever). */
async function kaiTo(x: number, z: number, faceX: number, faceZ: number) {
  rt.kai.route = [];
  rt.kai.walkTo = { x, z, face: { x: faceX, z: faceZ } };
  for (let i = 0; i < 45 && rt.kai.walkTo; i++) await wait(150);
  if (rt.kai.walkTo) {
    rt.kai.x = x;
    rt.kai.z = z;
    rt.kai.walkTo = null;
  }
  rt.kai.yaw = Math.atan2(faceX - rt.kai.x, faceZ - rt.kai.z);
}

/** The chest and the tank are carried by the pair; the barrel alone. */
export const twoCarry = (kind: CarryKind | null) => kind === "chest" || kind === "tank";

/** The tank has been lifted with Kai this session ("It's too heavy." is asked the first time). */
let liftedTank = false;

function startCarry(kind: CarryKind) {
  rt.carry.liftT0 = rt.time;
  rt.carry.trail = [{ x: rt.player.x, z: rt.player.z }];
  setGame({ carry: kind, focus: null });
  audio.play("box");
}

/**
 * "Carry the box." / "Carry the barrel." The sea chest is too heavy alone:
 * "It's too heavy." then "Can you help me?", and Kai takes the other end.
 */
export async function carry(id: string) {
  const g = getGame();
  if (g.carry) return;
  const building = g.buildings.find((b) => b.id === id);
  const tank = building?.type === "tank";
  const chest = id === SEA_CHEST.id || building?.type === "storage";
  const at = building ?? (chest ? SEA_CHEST : COVE_BARREL);
  face(at.x, at.z);
  if (!chest && !tank) {
    if (!known("carryBarrel")) {
      const said = await ask({ kind: "command", options: ["carryBarrel"], picture: "barrel", cancellable: true, readSentence: true });
      if (!said) return;
    }
    if (building) {
      if ((building.water ?? 0) >= 1) toast({ en: "You poured out the water to carry it.", ja: "はこぶ まえに みずを すてたよ。", icon: "water", tone: "info" });
      setGame({ buildings: getGame().buildings.filter((b) => b.id !== id) });
    } else {
      setGame({ barrelTaken: true });
    }
    startCarry("barrel");
    setGame({ mode: "explore" });
    refreshQuest();
    save();
    return;
  }
  // The heavy sea chest, or Chapter 3's water tank: Kai takes the other side.
  const phrase: PhraseId = tank ? "carryTank" : "carryBox";
  if (!known(phrase)) {
    const said = await ask({ kind: "command", options: [phrase], picture: tank ? "tank" : "box", cancellable: true, readSentence: true });
    if (!said) return;
  }
  setGame({ mode: "busy", focus: null });
  const first = tank ? !liftedTank : !getGame().chestTaken;
  if (first) {
    rt.carry.strainT0 = rt.time;
    audio.play("full");
    await wait(1100);
    await ask({ kind: "command", options: ["tooHeavy"], picture: tank ? "tank" : "box", readSentence: !known("tooHeavy") });
  }
  setGame({ mode: "busy" });
  const said = await ask({ kind: "command", options: ["canHelp"], picture: "kai", question: { en: "Ask Kai for help!", ja: "カイに たのもう！", by: "game" }, readSentence: !known("canHelp") });
  if (!said) {
    setGame({ mode: "explore" });
    return;
  }
  // Kai comes to the far side of the chest from the player.
  const away = Math.atan2(at.x - rt.player.x, at.z - rt.player.z);
  await kaiTo(at.x + Math.sin(away) * 1.0, at.z + Math.cos(away) * 1.0, at.x, at.z);
  rt.kai.talking = true;
  await say("kai", "Yes, I can! One, two, three!", "いいよ！ いち、 に、 さん！");
  rt.kai.talking = false;
  if (building) {
    if (tank && (building.water ?? 0) >= 1) toast({ en: "You poured out the water to carry it.", ja: "はこぶ まえに みずを すてたよ。", icon: "water", tone: "info" });
    setGame({ buildings: getGame().buildings.filter((b) => b.id !== id) });
  }
  if (tank) {
    liftedTank = true;
    setGame({ kaiStage: "camp" });
  } else {
    setGame({ chestTaken: true, kaiStage: "camp" });
  }
  startCarry(tank ? "tank" : "chest");
  // Kai holds the far end: he starts behind the player and follows their path.
  const back = rt.player.yaw + Math.PI;
  rt.carry.trail = [{ x: rt.player.x + Math.sin(back) * 1.8, z: rt.player.z + Math.cos(back) * 1.8 }, { x: rt.player.x, z: rt.player.z }];
  if (first && !tank) {
    await ask({ kind: "command", options: ["goBack"], picture: "shelter", readSentence: true });
    await say("kai", "OK! Let's take it to our camp.", "うん！ キャンプに もっていこう。");
    showPlaces(g.buildings.filter((b) => b.type === "shelter").map((b) => b.id));
  } else if (first) {
    await say("kai", "Let's put it under the pipe!", "パイプの したに おこう！");
  }
  setGame({ mode: "explore" });
  refreshQuest();
  save();
}

/** Where a carried thing comes down: the chest or tank between the pair, the barrel in front. */
function putDownSpot(kind: CarryKind): { x: number; z: number } {
  const p = rt.player;
  if (twoCarry(kind)) return { x: (p.x + rt.kai.x) / 2, z: (p.z + rt.kai.z) / 2 };
  return { x: p.x + Math.sin(p.yaw) * 0.95, z: p.z + Math.cos(p.yaw) * 0.95 };
}

/** E while carrying: "Put it here." — the chest becomes the storage box; the barrel stands on its own. */
export async function putDown() {
  const g = getGame();
  const kind = g.carry;
  if (!kind) return;
  const spot = putDownSpot(kind);
  const type = kind === "chest" ? "storage" : kind;
  // The chest and tank come down between the pair, at the player's hands: only the barrel keeps clear of their feet.
  const keepClear = twoCarry(kind) ? [] : [{ x: rt.player.x, z: rt.player.z, r: 0.3 }];
  const problem = placeProblem(type, spot.x, spot.z, [STATIC_OBSTACLES, buildingObstacles(g.buildings), pipeObstacles(g.water), worldPropObstacles()], keepClear, currentGates());
  if (problem) {
    audio.play("error");
    toast({ en: problem === "water" ? "Not in the water!" : "Not here. Try another place!", ja: problem === "water" ? "みずの なかは だめ！" : "ここは だめ。 ほかの ばしょで！", tone: "warn" });
    return;
  }
  if (!known("putHere")) {
    const said = await ask({ kind: "command", options: ["putHere"], picture: kind === "chest" ? "box" : kind, cancellable: true, readSentence: true });
    if (!said || getGame().carry !== kind) return;
  }
  const yaw = twoCarry(kind) ? Math.atan2(rt.kai.x - rt.player.x, rt.kai.z - rt.player.z) + Math.PI / 2 : rt.player.yaw;
  const b: PlacedBuilding = { id: newId(), type, x: spot.x, z: spot.z, rot: yaw, ...(kind !== "chest" ? { water: 0 } : {}) };
  rt.carry.liftT0 = -100;
  rt.carry.trail = [];
  setGame({ carry: null, buildings: [...getGame().buildings, b] });
  audio.play("place");
  rt.player.action = { kind: "gather", t0: rt.time };
  refreshQuest();
  save();
  if (kind === "chest" && getGame().quest.day === 6 && storageAtCamp(getGame().buildings) && !getGame().kai.found) await chestHome();
  else if (kind === "chest" && getGame().quest.day === 6 && !storageAtCamp(getGame().buildings)) {
    toast({ en: "Take it to the camp!", ja: "キャンプまで はこぼう！", icon: "shelter", tone: "info" });
  }
}

/** The box is home: the bag holds more, and Kai asks what you found. */
async function chestHome() {
  setGame({ mode: "talk", focus: null });
  rt.kai.talking = true;
  rt.kai.yaw = Math.atan2(rt.player.x - rt.kai.x, rt.player.z - rt.kai.z);
  audio.play("fanfare");
  await say("kai", "Now we have a box for our things!", "これで ものを しまう はこが できたね！");
  toast({ en: `Your bag can hold ${stackLimit()} of each thing now!`, ja: `かばんに ${stackLimit()}こずつ はいるように なったよ！`, icon: "bag", tone: "good" }, 4000);
  const found = await ask({ kind: "choice", options: ["foundRope", "foundCanvas", "foundBox"], question: { en: "What did you find?", by: "kai" }, readQuestion: true });
  if (found === "foundRope") {
    await say("kai", "Rope! Good for tying things.", "ロープ！ しばるのに いいね。");
  } else if (found === "foundCanvas") {
    await say("kai", "Canvas! It keeps the rain out. Keep it!", "ぬの！ あめを ふせげるよ。 とって おこう！");
  } else {
    await say("kai", "A box! And now it's our storage box!", "はこ！ もう ぼくたちの ものいれだね！");
  }
  setGame({ kai: { ...getGame().kai, found: found === "foundRope" ? "rope" : found === "foundCanvas" ? "canvas" : "box" } });
  rt.kai.talking = false;
  setGame({ mode: "explore" });
  refreshQuest();
  save();
}

/**
 * Something was being carried when the player fainted or the game saved: it
 * comes down where they stand (a dropped chest is still the storage box).
 */
export function dropCarried(at: { x: number; z: number } = { x: rt.player.x, z: rt.player.z }): PlacedBuilding | null {
  const kind = getGame().carry;
  if (!kind) return null;
  const b: PlacedBuilding = { id: newId(), type: kind === "chest" ? "storage" : kind, x: at.x, z: at.z, rot: rt.player.yaw, ...(kind !== "chest" ? { water: 0 } : {}) };
  rt.carry.liftT0 = -100;
  rt.carry.trail = [];
  setGame({ carry: null, buildings: [...getGame().buildings, b] });
  return b;
}

// ------------------------------------------------------------------ the grove

/** Standing bamboo needs the stone axe. */
export function needAxe(): boolean {
  if (count(getGame().bag, "axe") > 0) return false;
  audio.play("error");
  toast({ en: "You need a stone axe.", ja: "石の おのが ひつようだよ。", icon: "axe", tone: "warn" });
  return true;
}

/** "Cut the bamboo." at the thicket opens the trail to the grove (Day 7). */
export async function cutGroveGate() {
  if (getGame().groveOpen || needAxe()) return;
  const said = await ask({ kind: "command", options: ["cutBamboo"], picture: "pole", cancellable: true, readSentence: true });
  if (!said || getGame().groveOpen) return;
  setGame({ mode: "busy", focus: null });
  const p = rt.player;
  p.action = { kind: "chop", t0: rt.time };
  p.frozenUntil = rt.time + 0.8;
  rt.stats = spend(rt.stats, 4);
  audio.play("chop");
  await wait(450);
  rt.groveOpenT0 = rt.time;
  setGame({ groveOpen: true });
  give("pole", 2, GROVE_GATE);
  refreshQuest();
  const y = groundY(GROVE_GATE.x, GROVE_GATE.z);
  rt.camera.mode = "shot";
  rt.camera.shot = { pos: { x: GROVE_GATE.x - 6, y: y + 3.4, z: GROVE_GATE.z + 4.5 }, target: { x: GROVE.x - 2, y: y + 2.4, z: GROVE.z } };
  await wait(1700);
  await say("self", "Wow! Bamboo!", "わあ！ たけだ！");
  rt.camera.mode = "follow";
  rt.camera.shot = null;
  setGame({ mode: "explore" });
  updateHint();
  save();
}

// ---------------------------------------------------------- frames (sockets)

function partOf(id: string): { b: PlacedBuilding; part: string } | null {
  const sep = id.indexOf(":");
  if (sep < 0) return null;
  const b = getGame().buildings.find((x) => x.id === id.slice(0, sep));
  return b ? { b, part: id.slice(sep + 1) } : null;
}

/** A pole that is too long for the open socket is shown sticking out (`rt.partT0` key `long:<id>`). */
function cue(kind: "long" | "short", id: string) {
  rt.partT0.set(`${kind}:${id}`, rt.time);
}

/** E at a glowing socket: "Put it here." Short bars cut a long pole in two ("It's too long."). */
export async function useSocket(id: string) {
  const found = partOf(id);
  if (!found) return;
  const { b, part } = found;
  const socket = openSockets(socketsOf(b), b.parts ?? []).find((s) => s.id === part);
  if (!socket) return;
  const classroom = getGame().settings.classroom;
  // The first part ever is the "Put it here." moment.
  if (!known("putHere")) {
    const said = await ask({ kind: "command", options: ["putHere"], picture: socket.uses === "canvas" ? "canvas" : "pole", cancellable: true, readSentence: true });
    if (!said) return;
  }
  let bag: Bag = getGame().bag;
  if (socket.uses === "canvas") {
    const needs = pace(classroom).catcherCanvas;
    if (!hasAll(bag, needs)) {
      audio.play("error");
      toast({ en: `You need ${needs.canvas === 1 ? "one canvas" : "two canvas"} and one rope.`, ja: `ぬの ${needs.canvas}まいと ロープ 1ほんが いるよ。`, icons: [{ item: "canvas", n: needs.canvas! }, { item: "rope", n: needs.rope! }], tone: "warn" });
      return;
    }
    bag = removeAll(bag, needs)!;
  } else if (socket.uses === "shortPole") {
    if (count(bag, "shortPole") === 0) {
      if (count(bag, "pole") === 0) return needPoles();
      cue("long", id);
      if (!known("tooLong")) {
        const said = await ask({ kind: "command", options: ["tooLong"], picture: "pole", cancellable: true, readSentence: true });
        if (!said) return;
      }
      // Cut it in two: one long pole makes two short ones.
      setGame({ mode: "busy", focus: null });
      rt.player.action = { kind: "chop", t0: rt.time };
      rt.player.frozenUntil = rt.time + 0.75;
      audio.play("chop");
      bag = addItem(removeAll(getGame().bag, { pole: 1 })!, "shortPole", 2, Infinity).bag;
      floatText("Cut! 2 short poles", rt.player.x, rt.player.y + 2.1, rt.player.z);
      setGame({ bag });
      await wait(750);
      setGame({ mode: "explore" });
    }
    bag = removeAll(getGame().bag, { shortPole: 1 })!;
  } else {
    if (count(bag, "pole") === 0) {
      if (count(bag, "shortPole") > 0) {
        cue("short", id);
        if (!known("tooShort")) await ask({ kind: "command", options: ["tooShort"], picture: "shortPole", cancellable: true, readSentence: true });
        toast({ en: "You need a long bamboo pole.", ja: "ながい たけの ぼうが いるよ。", icon: "pole", tone: "warn" });
        return;
      }
      return needPoles();
    }
    bag = removeAll(bag, { pole: 1 })!;
  }
  // The building may have changed while a prompt was open.
  const now = getGame().buildings.find((x) => x.id === b.id);
  if (!now || (now.parts ?? []).includes(part)) return;
  const before = now.parts ?? [];
  const parts = [...before, part];
  const patch: Partial<PlacedBuilding> = { parts };
  if (b.type === "catcher" && part === "canvas") patch.heights = [...START_HEIGHTS];
  setGame({ bag, buildings: getGame().buildings.map((x) => (x.id === b.id ? { ...x, ...patch } : x)) });
  rt.partT0.set(id, rt.time);
  rt.player.action = { kind: "build", t0: rt.time };
  rt.player.frozenUntil = rt.time + 0.6;
  rt.stats = spend(rt.stats, 2);
  audio.play("build");
  refreshQuest();
  save();
  await afterPart(b, before, parts);
}

function needPoles() {
  audio.play("error");
  toast({ en: "You need bamboo poles.", ja: "たけの ぼうが いるよ。", icon: "pole", tone: "warn" });
}

/** Milestones of a frame: complete-but-shaking, strong, posts up, canvas on. */
async function afterPart(b: PlacedBuilding, before: string[], parts: string[]) {
  const pos = { x: b.x, y: groundY(b.x, b.z) + 2.2, z: b.z };
  if (b.type === "rack") {
    if (!rackFrameComplete(before) && rackFrameComplete(parts)) {
      floatText(rackStable(parts) ? "Rack!" : "It's shaking!", pos.x, pos.y, pos.z);
      if (!rackStable(parts)) toast({ en: "It's shaking! Put a pole across a long side and a short side.", ja: "ぐらぐら！ ながい がわと みじかい がわに ななめの ぼうを いれよう。", icon: "pole", tone: "info" }, 4500);
    }
    if (!rackStable(before) && rackStable(parts)) {
      rt.steadyT0.set(b.id, rt.time);
      audio.play("sparkle");
      floatText("Strong!", pos.x, pos.y + 0.3, pos.z);
      if (Math.hypot(rt.kai.x - b.x, rt.kai.z - b.z) < 14) {
        await say("kai", "Great! It's strong now!", "すごい！ じょうぶに なったね！");
        // say() leaves the game in talk mode; hand control back.
        if (getGame().mode === "talk") setGame({ mode: "explore" });
      }
    }
    return;
  }
  const posts = ["post1", "post2", "post3", "post4"];
  if (!posts.every((p) => before.includes(p)) && posts.every((p) => parts.includes(p))) {
    toast({ en: "Now put the canvas on top!", ja: "つぎは うえに ぬのを はろう！", icon: "canvas", tone: "info" });
  }
  if (!before.includes("canvas") && parts.includes("canvas")) {
    audio.play("sparkle");
    floatText("Rain catcher!", pos.x, pos.y, pos.z);
    toast({ en: "Test it! Does the rain go into the barrel?", ja: "ためしてみよう！ あまみずは たるに はいるかな？", icon: "rain", tone: "info" }, 4500);
  }
}

// ------------------------------------------------------------------ the rack

/** At a finished rack: hang a fish ("Put the fish on the rack."), or take the dried fish. */
export async function useRack(id: string) {
  const b = getGame().buildings.find((x) => x.id === id);
  if (!b || b.type !== "rack") return;
  const parts = b.parts ?? [];
  if (!rackStable(parts)) {
    rt.steadyT0.set(`shake:${b.id}`, rt.time);
    audio.play("error");
    toast({ en: "It's shaking! Put a pole across a long side and a short side.", ja: "ぐらぐら！ ながい がわと みじかい がわに ななめの ぼうを いれよう。", icon: "pole", tone: "warn" }, 4000);
    return;
  }
  const fish = b.fish ?? [];
  const dried = fish.filter((left) => left <= 0).length;
  if (dried > 0) {
    const added = addItem(getGame().bag, "driedFish", dried);
    if (!added.added) {
      audio.play("full");
      toast({ en: "Your bag is full.", ja: "かばんが いっぱい。", icon: "driedFish", tone: "warn" });
      return;
    }
    let left = added.added;
    const keep = fish.filter((t) => (t <= 0 && left-- > 0 ? false : true));
    setGame({ bag: added.bag });
    updateBuilding(b.id, { fish: keep });
    audio.play("leaves");
    floatText(`+${added.added} dried fish`, b.x, groundY(b.x, b.z) + 1.8, b.z);
    refreshQuest();
    return;
  }
  if (count(getGame().bag, "fish") === 0) {
    toast({ en: "Catch a fish first!", ja: "さきに さかなを つろう！", icon: "fish", tone: "info" });
    return;
  }
  if (fish.length >= rackSlots(parts)) {
    toast({ en: "The rack is full.", ja: "ほしだなが いっぱい。", icon: "rack", tone: "info" });
    return;
  }
  if (!known("dryFish")) {
    const said = await ask({ kind: "command", options: ["dryFish"], picture: "fish", cancellable: true, readSentence: true });
    if (!said) return;
  }
  const bag = removeAll(getGame().bag, { fish: 1 });
  const now = getGame().buildings.find((x) => x.id === id);
  if (!bag || !now) return;
  setGame({ bag, fishDried: getGame().fishDried + 1 });
  updateBuilding(id, { fish: [...(now.fish ?? []), pace(getGame().settings.classroom).drySeconds] });
  rt.player.action = { kind: "gather", t0: rt.time };
  audio.play("leaves");
  floatText("Drying…", b.x, groundY(b.x, b.z) + 1.8, b.z);
  refreshQuest();
  save();
}

// --------------------------------------------------------- the rain catcher

/** The barrel standing at this catcher (its middle within 3.4 m), with its local position. */
export function catcherBarrel(c: PlacedBuilding, buildings: readonly PlacedBuilding[] = getGame().buildings): { barrel: PlacedBuilding; local: { x: number; z: number } } | null {
  let best: { barrel: PlacedBuilding; local: { x: number; z: number } } | null = null;
  let bestD = 3.4;
  for (const b of buildings) {
    if (b.type !== "barrel") continue;
    const d = Math.hypot(b.x - c.x, b.z - c.z);
    if (d < bestD) {
      bestD = d;
      best = { barrel: b, local: toLocal(c, b.x, b.z) };
    }
  }
  return best;
}

/** Where the rain on this catcher goes right now. */
export function flowOf(c: PlacedBuilding, buildings: readonly PlacedBuilding[] = getGame().buildings): Flow {
  const near = catcherBarrel(c, buildings);
  return catcherFlow(c.heights ?? START_HEIGHTS, near ? near.local : null);
}

/** E at a corner post: "Make it higher." / "Make it lower." (said or tapped every time: each is a choice). */
export async function useCorner(id: string) {
  const found = partOf(id);
  if (!found || found.b.type !== "catcher") return;
  const corner = Number(found.part.slice(1));
  const said = await ask({ kind: "choice", options: ["higher", "lower"], picture: "catcher", cancellable: true });
  if (!said) return;
  const b = getGame().buildings.find((x) => x.id === found.b.id);
  if (!b) return;
  const heights = [...(b.heights ?? START_HEIGHTS)];
  const next = heights[corner] + (said === "higher" ? 1 : -1);
  if (next < 0 || next > 3) {
    audio.play("full");
    toast({ en: next < 0 ? "It's already at the bottom!" : "It's already at the top!", ja: next < 0 ? "もう いちばん したまで さがってるよ！" : "もう いちばん うえまで あがってるよ！", tone: "info" });
    return;
  }
  heights[corner] = next;
  updateBuilding(b.id, { heights });
  rt.partT0.set(id, rt.time);
  rt.player.action = { kind: "build", t0: rt.time };
  rt.player.frozenUntil = rt.time + 0.5;
  audio.play("rope");
  save();
}

const HINTS: Record<Exclude<FlowProblem, null>, { en: string; ja: string }> = {
  flat: { en: "The canvas is flat. The water stays on top. Make some corners higher!", ja: "ぬのが たいらだね。 みずが うえに たまるよ。 かどを たかく しよう！" },
  tooLow: { en: "The low corner is under the top of the barrel. Make it higher!", ja: "ひくい かどが たるの ふちより したに あるよ。 たかく しよう！" },
  split: { en: "The water goes two ways. Make only one corner the lowest!", ja: "みずが ふたつに わかれてる。 いちばん ひくい かどを ひとつに しよう！" },
  missed: { en: "The water falls on the sand. Move the barrel under the water!", ja: "みずが すなに おちてる。 たるを みずの したに うごかそう！" }
};

/** E under the canvas: Kai pours a cup (or the rain falls) and asks "How is it?". */
export async function testCatcher(id: string) {
  const found = partOf(id);
  if (!found || found.b.type !== "catcher" || !catcherBuilt(found.b.parts ?? [])) return;
  const b = found.b;
  setGame({ mode: "busy", focus: null });
  rt.test = { id: b.id, t0: rt.time };
  face(b.x, b.z);
  audio.play("fill");
  await wait(1800);
  const flow = flowOf(b);
  const truth = flowAnswer(flow);
  const kaiNear = Math.hypot(rt.kai.x - b.x, rt.kai.z - b.z) < 14;
  const by = kaiNear ? "kai" : "self";
  const answer = await ask({ kind: "choice", options: ["flowing", "notWork", "tooLow"], picture: "rain", question: { en: "How is it?", by }, readQuestion: true });
  setGame({ mode: "talk" });
  if (answer === "flowing" && truth === "flowing") {
    await say(by, "Yes! The water is flowing into the barrel!", "そう！ みずが たるに ながれて いるね！");
  } else if (truth === "flowing") {
    await say(by, "Look again! The water goes into the barrel. It works!", "よく みて！ みずが たるに はいってる。 うまく いってるよ！");
  } else {
    if (answer === truth) await say(by, "You're right.", "その とおり。");
    else await say(by, "Look again! The water is not going into the barrel.", "よく みて！ みずが たるに はいって いないよ。");
    await ask({ kind: "command", options: ["tryAgain"], picture: "rain", readSentence: !known("tryAgain") });
    const problem = flow.problem && flow.problem === "missed" && !catcherBarrel(b) ? null : flow.problem;
    const hint = problem ? HINTS[problem] : { en: "We need the barrel under the water!", ja: "みずの したに たるが いるよ！" };
    await say(by, hint.en, hint.ja);
  }
  setGame({ mode: "explore" });
  updateHint();
}

/** E at a barrel: take water, move it left or right beside a catcher, or carry it. */
export async function useBarrel(id: string) {
  const b = getGame().buildings.find((x) => x.id === id);
  if (!b || b.type !== "barrel") return;
  const catcher = getGame().buildings.find((c) => c.type === "catcher" && Math.hypot(c.x - b.x, c.z - b.z) < 3.4);
  const options: PhraseId[] = [];
  if ((b.water ?? 0) >= 1 && count(getGame().bag, "container") > 0) options.push("getWater");
  if (catcher) options.push("moveLeft", "moveRight");
  options.push("carryBarrel");
  if (options.length === 1) return carry(id);
  const said = await ask({ kind: "choice", options, picture: "barrel", cancellable: true });
  if (!said) return;
  if (said === "carryBarrel") return carry(id);
  if (said === "getWater") return waterFromBarrel(id);
  // Left and right as the student sees it: along the camera's right.
  const yaw = rt.camera.yaw;
  const sign = said === "moveLeft" ? -1 : 1;
  const nx = b.x + Math.cos(yaw) * 0.4 * sign;
  const nz = b.z - Math.sin(yaw) * 0.4 * sign;
  const others = getGame().buildings.filter((x) => x.id !== id);
  const problem = placeProblem("barrel", nx, nz, [STATIC_OBSTACLES, buildingObstacles(others), pipeObstacles(getGame().water), worldPropObstacles()], [{ x: rt.player.x, z: rt.player.z, r: 0.25 }], currentGates());
  if (problem) {
    audio.play("error");
    toast({ en: "It can't go there.", ja: "そこには うごかせないよ。", tone: "warn" });
    return;
  }
  updateBuilding(id, { x: nx, z: nz });
  rt.partT0.set(`move:${id}`, rt.time);
  rt.player.action = { kind: "gather", t0: rt.time };
  audio.play("place");
  save();
}

async function waterFromBarrel(id: string) {
  const b = getGame().buildings.find((x) => x.id === id);
  if (!b || (b.water ?? 0) < 1) return;
  if (!known("getWater")) {
    const said = await ask({ kind: "command", options: ["getWater"], picture: "water", cancellable: true, readSentence: true });
    if (!said) return;
  }
  const added = addItem(getGame().bag, "water", 1);
  if (!added.added) {
    audio.play("full");
    toast({ en: "Your bag is full.", ja: "かばんが いっぱい。", icon: "water", tone: "warn" });
    return;
  }
  setGame({ bag: added.bag, gotWater: getGame().gotWater + 1 });
  updateBuilding(id, { water: Math.max(0, (b.water ?? 0) - 1) });
  rt.player.action = { kind: "gather", t0: rt.time };
  audio.play("fill");
  floatText("+1 water", b.x, groundY(b.x, b.z) + 1.4, b.z);
  refreshQuest();
}

// ------------------------------------------------------------------- water

/** Safe water: "Boil the water." at a lit campfire turns all collected water into boiled water. */
export async function boilWater(fireId: string) {
  const fire = getGame().buildings.find((b) => b.id === fireId && b.type === "campfire" && b.lit);
  if (!fire || count(getGame().bag, "water") === 0) return;
  if (!known("boilWater")) {
    const said = await ask({ kind: "command", options: ["boilWater"], picture: "boiledWater", cancellable: true, readSentence: true });
    if (!said) return;
  }
  const raw = count(getGame().bag, "water");
  const added = addItem(getGame().bag, "boiledWater", raw);
  if (!added.added) {
    audio.play("full");
    toast({ en: "Your bag is full of boiled water.", ja: "わかした みずで いっぱい。", icon: "boiledWater", tone: "warn" });
    return;
  }
  const bag = removeAll(added.bag, { water: added.added })!;
  setGame({ mode: "busy", focus: null, bag, boiled: getGame().boiled + 1, boiledDay: Math.max(getGame().boiledDay, getGame().quest.day) });
  rt.player.action = { kind: "craft", t0: rt.time };
  rt.player.frozenUntil = rt.time + 1.1;
  audio.play("sizzle");
  refreshQuest();
  await wait(1100);
  setGame({ mode: "explore" });
  floatText(added.added > 1 ? `${added.added} boiled water!` : "Boiled water!", fire.x, groundY(fire.x, fire.z) + 1.4, fire.z);
}

/** Lighting a fire in the rain fails (true = it is raining too hard). */
export function rainingOnFire(): boolean {
  if (rt.rain.k < HEAVY) return false;
  audio.play("error");
  toast({ en: "It's raining! The fire won't light.", ja: "あめで 火が つかないよ。", icon: "rain", tone: "warn" });
  return true;
}

// -------------------------------------------------------------------- ticks

/** Every frame (also in menus and talk): the rain weight follows the script. */
export function weatherFrame(dt: number) {
  const g = getGame();
  const wanted = g.screen === "game" && rainWanted(g.quest.day, rt.clock, g.rainDone);
  rt.rain.k = easeRain(rt.rain.k, wanted, dt);
  audio.setRain(g.inCave ? rt.rain.k * 0.3 : rt.rain.k);
}

let syncT = 0;
let fullCatch = 0;

/** Live play only: fires going out, barrels filling, fish drying, arriving in the cove, Day 8's rain stopping. */
export function tickChapterTwo(dt: number) {
  const g = getGame();
  if (!g.reachedCove && g.coveOpen && reachedCoveAt(rt.player.x, rt.player.z)) {
    setGame({ reachedCove: true });
    toast({ en: "Shipwreck Cove!", ja: "なんぱせんの いりえ！", icon: "box", tone: "good" });
    refreshQuest();
  }
  // Kai's walk to the cove ends at his waiting spot.
  if (g.kaiStage === "cove" && !rt.kai.route.length && !rt.kai.walkTo && !g.carry && Math.hypot(rt.kai.x - KAI_COVE.x, rt.kai.z - KAI_COVE.z) > 30) {
    rt.kai.x = KAI_COVE.x;
    rt.kai.z = KAI_COVE.z;
  }
  const heavy = rt.rain.k >= HEAVY;
  let buildings = g.buildings;
  let changed = false;
  // Rain puts out a campfire standing in the open.
  for (const b of buildings) {
    if (b.type !== "campfire" || !b.lit) continue;
    const wet = heavy ? (rt.rain.onFire.get(b.id) ?? 0) + dt : 0;
    rt.rain.onFire.set(b.id, wet);
    if (wet >= FIRE_OUT_SECONDS) {
      buildings = buildings.map((x) => (x.id === b.id ? { ...x, lit: false } : x));
      changed = true;
      rt.fireT0.delete(b.id);
      rt.rain.onFire.delete(b.id);
      audio.play("sizzle");
      toast({ en: "The rain put out the fire!", ja: "あめで 火が きえちゃった！", icon: "rain", tone: "warn" }, 3500);
    }
  }
  // Rain runs off each catcher into its barrel (when the set-up is right).
  if (rt.rain.k > 0.05) {
    for (const c of buildings) {
      if (c.type !== "catcher" || !catcherBuilt(c.parts ?? [])) continue;
      const near = catcherBarrel(c, buildings);
      if (!near) continue;
      const flow = catcherFlow(c.heights ?? START_HEIGHTS, near.local);
      if (flow.efficiency <= 0) continue;
      const water = near.barrel.water ?? 0;
      const next = fillBarrel(water, dt, rt.rain.k, flow.efficiency);
      if (next === water) continue;
      if (flow.efficiency >= 0.999) fullCatch += next - water;
      buildings = buildings.map((x) => (x.id === near.barrel.id ? { ...x, water: next } : x));
      changed = true;
    }
  }
  // Fish dry in the sun (not in the rain).
  if (!heavy) {
    for (const r of buildings) {
      if (r.type !== "rack" || !(r.fish ?? []).some((left) => left > 0)) continue;
      const before = r.fish ?? [];
      const after = dryFish(before, dt);
      if (after.some((left, i) => left <= 0 && before[i] > 0)) {
        audio.play("sparkle");
        floatText("Dried fish!", r.x, groundY(r.x, r.z) + 1.8, r.z);
      }
      buildings = buildings.map((x) => (x.id === r.id ? { ...x, fish: after } : x));
      changed = true;
    }
  }
  syncT += dt;
  const caught = Math.floor(fullCatch + 1e-6);
  if (changed && (syncT > 0.25 || caught > g.rainCaught)) {
    syncT = 0;
    setGame({ buildings, ...(caught > g.rainCaught ? { rainCaught: caught } : {}) });
    if (caught > g.rainCaught) refreshQuest();
  }
  // Day 8: the rain keeps falling until the catcher works, then a little longer.
  if (g.quest.day === RAIN_DAY && !g.rainDone && g.rainCaught > 0) {
    if (rt.catcherWorkedAt < 0) rt.catcherWorkedAt = rt.simTime;
    if (rt.simTime - rt.catcherWorkedAt >= pace(g.settings.classroom).rainStopSeconds) {
      setGame({ rainDone: true });
      toast({ en: "The rain stopped!", ja: "あめが やんだ！", icon: "rain", tone: "good" }, 3500);
      save();
    }
  }
}

/** Carried-over catch progress: a fresh session counts from the saved total. */
export function resetCatchCounter(saved: number) {
  fullCatch = saved;
}

// ------------------------------------------------------------ restore/start

/** After loading a save: Kai in the cove, the carry, the rain already falling. */
export function restoreChapterTwo() {
  const g = getGame();
  resetCatchCounter(g.rainCaught);
  if (g.kaiStage === "cove") {
    rt.kai.x = KAI_COVE.x;
    rt.kai.z = KAI_COVE.z;
    rt.kai.route = [];
  }
  if (g.carry) {
    rt.carry.liftT0 = rt.time - 5;
    const back = rt.player.yaw + Math.PI;
    rt.carry.trail = [{ x: rt.player.x + Math.sin(back) * 1.8, z: rt.player.z + Math.cos(back) * 1.8 }, { x: rt.player.x, z: rt.player.z }];
    if (twoCarry(g.carry)) {
      rt.kai.x = rt.carry.trail[0].x;
      rt.kai.z = rt.carry.trail[0].z;
    }
  }
  if (rainWanted(g.quest.day, rt.clock, g.rainDone)) rt.rain.k = 1;
}

/** Day 8 dawns raining: any campfire left in the open is out. */
export function rainDawn() {
  const g = getGame();
  rt.rain.k = 1;
  rt.catcherWorkedAt = -1;
  setGame({ buildings: g.buildings.map((b) => (b.type === "campfire" && b.lit ? { ...b, lit: false } : b)) });
  for (const b of g.buildings) if (b.type === "campfire") rt.fireT0.delete(b.id);
}

/** The camp a Chapter 2 start begins with: a lit campfire and a built tent near Kai's lean-to. */
export const CHAPTER_TWO_CAMP: ReadonlyArray<PlacedBuilding> = [
  { id: "ch2-fire", type: "campfire", x: -6, z: 4.5, rot: 0, lit: true },
  { id: "ch2-tent", type: "shelter", x: -2.5, z: 7, rot: 0, built: true }
];

/** Chapter 1's sentences, all known after the rescue (a Chapter 2 start begins with them). */
export const CHAPTER_ONE_PHRASES: PhraseId[] = [
  "hungry", "getCoconut", "eatCoconut", "needWater", "getWood", "getStone", "yesICan", "craftCampfire", "makeFire", "sleep",
  "craftAxe", "cutTree", "getLeaves", "craftShelter", "buildShelter", "openBox", "wantWater", "buildBridge", "craftContainer", "getWater",
  "boilWater", "drinkWater", "craftRod", "catchFish", "cookFish", "eatFish", "craftTorch", "goCave", "getMetal", "haveRadio",
  "canHelp", "craftSignalFire", "needHelp"
];

/** Kai's home, used when a Chapter 2 start has to place him before the morning. */
export const KAI_START = { x: KAI_HOME.x, z: KAI_HOME.z };
