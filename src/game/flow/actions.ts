import { getGame, setGame, toast } from "../store";
import { rt, floatText } from "../runtime";
import { ITEMS, ITEM_ORDER, NODE_YIELD, type Bag, type CraftId, type ItemId, type NodeKind } from "../types";
import type { PhraseId } from "../logic/english";
import { addItem, count, isFull, missing, removeAll } from "../logic/inventory";
import { RECIPES, checkCraft, craft } from "../logic/crafting";
import { eat, spend } from "../logic/stats";
import { dayDef } from "../logic/quest";
import { BRIDGE, CAVE_SIGN, CLIFF_SIGN, CRATE, FALLEN_TREE, NODE_BY_ID, RESPAWN_S, WATER_SPOTS, groundY } from "../world/island";
import type { PlacedBuilding } from "../world/placement";
import { ask, say } from "./ask";
import { refreshQuest, save, showBeacons, showPlaces, syncStats, updateHint, wait } from "./session";
import { canSleepNow, sleepPlace, trySleep } from "./days";
import { talkToKai } from "./kai";
import { focusPosition } from "./focus";
import { audio } from "../../audio/audio";
import { UI } from "../../ui/i18n";

/** What the student says to collect from a node, until it is known (then it is quick). */
const GATHER: Record<NodeKind, PhraseId> = { wood: "getWood", stone: "getStone", coconut: "getCoconut", leaves: "getLeaves", tree: "cutTree" };
const EAT: Partial<Record<ItemId, PhraseId>> = { coconut: "eatCoconut" };
const GATHER_SOUND: Record<NodeKind, "wood" | "stone" | "coconut" | "leaves" | "chop"> = {
  wood: "wood",
  stone: "stone",
  coconut: "coconut",
  leaves: "leaves",
  tree: "chop"
};

const canAct = () => {
  const g = getGame();
  return g.screen === "game" && g.mode === "explore" && !g.settingsOpen;
};

function faceTarget(x: number, z: number) {
  const p = rt.player;
  p.yaw = Math.atan2(x - p.x, z - p.z);
}

/** E / the hand button: use whatever is in focus. */
export async function interact() {
  const g = getGame();
  if (!canAct() || !g.focus) return;
  const f = g.focus;
  const pos = focusPosition(f);
  if (pos) faceTarget(pos.x, pos.z);
  switch (f.kind) {
    case "node":
      return gather(f.id);
    case "crate":
      return openCrate();
    case "kai":
      return talkToKai();
    case "campfire":
      return useCampfire(f.id);
    case "shelter":
      return useShelter(f.id);
    case "fallenTree":
      return cutFallenTree();
    case "sign":
      return readSign(f.id);
  }
}

/** Standing trees and the fallen palm need the stone axe; without it there is no prompt. */
function needAxe(): boolean {
  if (count(getGame().bag, "axe") > 0) return false;
  audio.play("error");
  toast({ en: "You need a stone axe.", ja: "石の おのが ひつようだよ。", icon: "axe", tone: "warn" });
  return true;
}

async function gather(nodeId: string) {
  const n = NODE_BY_ID.get(nodeId);
  if (!n || rt.taken.has(nodeId)) return;
  const { item, n: amount } = NODE_YIELD[n.kind];
  if (isFull(getGame().bag, item)) {
    audio.play("full");
    toast({ ...UI.full, icon: item, tone: "warn" });
    return;
  }
  if (n.kind === "tree" && needAxe()) return;
  const phrase = GATHER[n.kind];
  if (!getGame().known.includes(phrase)) {
    const said = await ask({ kind: "command", options: [phrase], picture: n.kind === "tree" ? "tree" : item, cancellable: true, readSentence: true });
    if (!said) return;
  }
  if (rt.taken.has(nodeId)) return;
  rt.taken.set(nodeId, RESPAWN_S[n.kind]);
  rt.beacons.ids = rt.beacons.ids.filter((id) => id !== nodeId);
  const chop = n.kind === "tree";
  rt.player.action = { kind: chop ? "chop" : "gather", t0: rt.time };
  rt.player.frozenUntil = rt.time + (chop ? 0.75 : 0.45);
  rt.stats = spend(rt.stats, chop ? 4 : 3);
  const added = addItem(getGame().bag, item, amount);
  setGame({ bag: added.bag });
  audio.play(GATHER_SOUND[n.kind]);
  floatText(`+${added.added} ${ITEMS[item].en}`, n.x, groundY(n.x, n.z) + (chop ? 1.8 : 1.1), n.z);
  refreshQuest();
  if (item === "leaves" && !getGame().unlocked.includes("shelter")) await discoverShelter();
}

/** The first leaves: "Leaves! I can make a shelter!" The student finds the recipe by saying "I can ___". */
async function discoverShelter() {
  setGame({ mode: "busy", focus: null });
  await wait(500);
  await say("self", "Leaves! I can make a shelter!", "はっぱだ！ こやが つくれる！");
  setGame({ unlocked: [...getGame().unlocked, "shelter"], craftPulse: true, mode: "explore" });
  audio.play("unlock");
  toast({ en: "New recipe: shelter", ja: "あたらしい レシピ: こや", icon: "shelter", tone: "good" }, 3500);
  updateHint();
  save();
}

/** The fallen palm in the forest gap: "Cut the tree." opens the forest. */
async function cutFallenTree() {
  if (getGame().pathCleared || needAxe()) return;
  const said = await ask({ kind: "command", options: ["cutTree"], picture: "tree", cancellable: true, readSentence: true });
  if (!said || getGame().pathCleared) return;
  setGame({ mode: "busy", focus: null });
  const p = rt.player;
  p.action = { kind: "chop", t0: rt.time };
  p.frozenUntil = rt.time + 0.8;
  rt.stats = spend(rt.stats, 4);
  audio.play("chop");
  await wait(450);
  rt.pathClearedT0 = rt.time;
  setGame({ pathCleared: true, bag: addItem(getGame().bag, "wood", 2).bag });
  floatText("+2 wood", FALLEN_TREE.x, groundY(FALLEN_TREE.x, FALLEN_TREE.z) + 1.4, FALLEN_TREE.z);
  refreshQuest();
  // A short look into the forest that just opened.
  const y = groundY(FALLEN_TREE.x, FALLEN_TREE.z);
  rt.camera.mode = "shot";
  rt.camera.shot = {
    pos: { x: FALLEN_TREE.x + 2.2, y: y + 3.1, z: FALLEN_TREE.z + 6.5 },
    target: { x: FALLEN_TREE.x - 0.6, y: y + 1.6, z: FALLEN_TREE.z - 12 }
  };
  await wait(1700);
  await say("self", "Wow! The forest!", "わあ！ もりだ！");
  rt.camera.mode = "follow";
  rt.camera.shot = null;
  setGame({ mode: "explore" });
  updateHint();
  save();
}

/** A shelter frame is built with "Build a shelter."; a finished shelter is where you sleep. */
async function useShelter(id: string) {
  const b = getGame().buildings.find((x) => x.id === id);
  if (!b || b.type !== "shelter") return;
  if (b.built) return trySleep(b);
  const said = await ask({ kind: "command", options: ["buildShelter"], picture: "shelter", cancellable: true, readSentence: true });
  if (!said) return;
  rt.player.action = { kind: "build", t0: rt.time };
  rt.player.frozenUntil = rt.time + 0.9;
  rt.stats = spend(rt.stats, 4);
  audio.play("build");
  setGame({ buildings: getGame().buildings.map((x) => (x.id === id ? { ...x, built: true } : x)) });
  rt.builtT0.set(id, rt.time);
  floatText("Shelter!", b.x, groundY(b.x, b.z) + 2.6, b.z);
  refreshQuest();
  save();
}

/** An unlit campfire is lit with "Make a fire."; a lit one is a place to sleep when there is no shelter. */
function useCampfire(id: string) {
  const b = getGame().buildings.find((x) => x.id === id);
  if (!b) return;
  if (!b.lit) return lightFire(id);
  return trySleep(b);
}

/** F: eat the first food in the bag (in hotbar order). Water is drunk, not eaten. */
export function eatFirst() {
  const bag = getGame().bag;
  const food = ITEM_ORDER.find((id) => ITEMS[id].food && id !== "water" && count(bag, id) > 0);
  return eatItem(food ?? "coconut");
}

/** F / tapping food in the bag. */
export async function eatItem(item: ItemId = "coconut") {
  if (!canAct()) return;
  const def = ITEMS[item];
  if (!def.food || count(getGame().bag, item) === 0) return;
  setGame({ selected: null });
  if (rt.stats.food >= 97) {
    audio.play("full");
    toast({ ...UI.imFull, icon: "food", tone: "info" });
    return;
  }
  const phrase = EAT[item];
  if (phrase && !getGame().known.includes(phrase)) {
    const said = await ask({ kind: "command", options: [phrase], picture: "eat", cancellable: true, readSentence: true });
    if (!said) return;
  }
  const bag = removeAll(getGame().bag, { [item]: 1 });
  if (!bag) return;
  rt.stats = eat(rt.stats, def.food);
  syncStats();
  rt.player.action = { kind: "eat", t0: rt.time };
  rt.player.frozenUntil = rt.time + 0.6;
  setGame({ bag, ate: getGame().ate + 1, needsPulse: false });
  audio.play("munch");
  floatText("Yum!", rt.player.x, rt.player.y + 2.1, rt.player.z);
  refreshQuest();
}

async function openCrate() {
  if (getGame().crateOpened) return;
  const said = await ask({ kind: "command", options: ["openBox"], picture: "box", cancellable: true, readSentence: true });
  if (!said) return;
  rt.crateOpenT0 = rt.time;
  rt.player.action = { kind: "gather", t0: rt.time };
  audio.play("box");
  let bag = addItem(getGame().bag, "rope", 2).bag;
  bag = addItem(bag, "coconut", 1).bag;
  setGame({ bag, crateOpened: true });
  const y = groundY(CRATE.x, CRATE.z) + 1.3;
  floatText("+2 rope", CRATE.x, y + 0.5, CRATE.z);
  window.setTimeout(() => floatText("+1 coconut", CRATE.x, y, CRATE.z), 700);
  toast({ en: "Rope! Keep it for later.", ja: "ロープだ！ あとで つかえるよ。", icon: "rope", tone: "info" });
  refreshQuest();
}

async function readSign(id: string) {
  const g = getGame();
  setGame({ mode: "talk" });
  if (id === CAVE_SIGN.id) {
    await say("game", "CAVE → It's very dark inside. Not yet!", "どうくつ → なかは まっくら。 まだ はいれないよ！");
  } else if (id === CLIFF_SIGN.id) {
    await say("game", "CLIFF PATH → Big rocks are in the way.", "がけの みち → おおきな いわで とおれないよ。");
  } else if (g.pathCleared) {
    await say("game", "FOREST → Trees, leaves and more!", "もり → 木や はっぱが あるよ！");
  } else if (g.quest.day >= 2) {
    await say("game", "FOREST → A big tree is in the way. Cut it with an axe!", "もり → おおきな 木が じゃま。 おので きろう！");
  } else if (g.quest.done.includes("light")) {
    await say("game", "FOREST → Tomorrow, with Kai!", "もり → あした カイと いこう！");
  } else {
    await say("game", "FOREST → It's dark in there. Make a fire first!", "もり → なかは くらいよ。 まず 火を つくろう！");
  }
  setGame({ mode: "explore" });
}

// ---------------------------------------------------------------- crafting

export function openCraft() {
  if (!canAct()) return;
  audio.play("tick");
  setGame({ craftOpen: true, mode: "craft", craftPulse: false, selected: null });
}

export function closeCraft() {
  if (getGame().mode !== "craft") return;
  setGame({ craftOpen: false, mode: "explore" });
}

export async function makeItem(id: CraftId) {
  const g = getGame();
  if (g.mode !== "craft" || checkCraft(g.bag, id, g.unlocked) !== "ok") return;
  const recipe = RECIPES[id];
  const first = !g.known.includes(recipe.phrase);
  setGame({ craftOpen: false });
  const said = await ask({
    kind: "command",
    options: [recipe.phrase],
    picture: id,
    question: { en: "What do you want to make?", by: "game" },
    cancellable: true,
    readQuestion: first,
    readSentence: first
  });
  if (!said) {
    setGame({ craftOpen: true, mode: "craft" });
    return;
  }
  const now = getGame();
  const bag = craft(now.bag, id, now.unlocked);
  if (!bag) return;
  setGame({ bag, crafted: now.crafted.includes(id) ? now.crafted : [...now.crafted, id] });
  rt.player.action = { kind: "craft", t0: rt.time };
  rt.player.frozenUntil = rt.time + 0.9;
  audio.play("craft");
  floatText(`${ITEMS[id].en}!`, rt.player.x, rt.player.y + 2.1, rt.player.z);
  refreshQuest();
  if (ITEMS[id].places) startPlacing(id);
}

// ---------------------------------------------------------------- building

export function startPlacing(item: ItemId) {
  const g = getGame();
  if (!ITEMS[item].places || count(g.bag, item) === 0) return;
  if (g.mode !== "explore" && g.mode !== "craft") return;
  rt.place.rot = 0;
  rt.place.visible = true;
  // Not placeable until the preview has been checked on its first frame (never a stale "ok").
  rt.place.ok = false;
  setGame({ mode: "place", placing: { item, rot: 0, problem: null }, selected: null, craftOpen: false });
  updateHint();
}

export function rotatePlacing() {
  const g = getGame();
  if (g.mode !== "place" || !g.placing) return;
  rt.place.rot = (rt.place.rot + Math.PI / 2) % (Math.PI * 2);
  audio.play("rotate");
  setGame({ placing: { ...g.placing, rot: rt.place.rot } });
}

export function cancelPlacing() {
  if (getGame().mode !== "place") return;
  rt.place.visible = false;
  setGame({ mode: "explore", placing: null });
  updateHint();
}

let buildingSeq = 1;

export function confirmPlacing() {
  const g = getGame();
  if (g.mode !== "place" || !g.placing) return;
  if (!rt.place.ok) {
    audio.play("error");
    const why = g.placing.problem;
    toast(
      why === "water"
        ? { en: "Not in the water!", ja: "みずの なかは だめ！", tone: "warn" }
        : why === "edge"
          ? { en: "Too close to the edge.", ja: "はしっこすぎるよ。", tone: "warn" }
          : { en: "Something is in the way.", ja: "じゃまな ものが あるよ。", tone: "warn" }
    );
    return;
  }
  const item = g.placing.item;
  const type = ITEMS[item].places!;
  const bag = removeAll(g.bag, { [item]: 1 });
  if (!bag) return;
  const b: PlacedBuilding = { id: `b${Date.now().toString(36)}${buildingSeq++}`, type, x: rt.place.x, z: rt.place.z, rot: rt.place.rot, lit: false };
  rt.place.visible = false;
  setGame({ bag, buildings: [...g.buildings, b], mode: "explore", placing: null });
  audio.play("place");
  refreshQuest();
}

async function lightFire(id: string) {
  const b = getGame().buildings.find((x) => x.id === id);
  if (!b || b.lit) return;
  const said = await ask({ kind: "command", options: ["makeFire"], picture: "fire", cancellable: true, readSentence: true });
  if (!said) return;
  setGame({ buildings: getGame().buildings.map((x) => (x.id === id ? { ...x, lit: true } : x)) });
  rt.fireT0.set(id, rt.time);
  audio.play("ignite");
  refreshQuest();
  save();
}

// -------------------------------------------------------------- "I need..."

const NEED_KIND: Partial<Record<PhraseId, NodeKind>> = { hungry: "coconut", needWood: "wood", needStone: "stone", needFood: "coconut", needLeaves: "leaves" };
/** Recipe behind each "make" step, for what it is still short of. */
const STEP_RECIPE: Partial<Record<string, CraftId>> = { craft: "campfire", axe: "axe", shelter: "shelter", container: "container", rod: "rod" };
const SHORT_NEED: Partial<Record<ItemId, PhraseId>> = { wood: "needWood", stone: "needStone", leaves: "needLeaves" };

/** "I need ___" sentences for the open steps of the day, in step order. */
function stepNeeds(): PhraseId[] {
  const g = getGame();
  const out: PhraseId[] = [];
  const add = (id: PhraseId | undefined) => {
    if (id && !out.includes(id)) out.push(id);
  };
  for (const step of dayDef(g.quest.day).steps) {
    if (g.quest.done.includes(step.id)) continue;
    if (step.goal) add(SHORT_NEED[step.goal.item]);
    const recipe = STEP_RECIPE[step.id];
    if (recipe) {
      const short: Bag = missing(g.bag, RECIPES[recipe].needs);
      for (const item of Object.keys(short) as ItemId[]) add(SHORT_NEED[item]);
    }
    if (step.id === "bridge") add("needWood");
    if (step.id === "water" || step.id === "drink") add("needWater");
  }
  return out;
}

/**
 * The "I need…" choices, at most four, by relevance: at night "I want to
 * sleep." first, then "I'm hungry.", then what the open steps need.
 */
function needOptions(): PhraseId[] {
  const options: PhraseId[] = [];
  if (canSleepNow()) options.push("sleep");
  options.push("hungry");
  for (const id of stepNeeds()) if (options.length < 4) options.push(id);
  for (const id of ["needWood", "needStone"] as PhraseId[]) if (options.length < 3 && !options.includes(id)) options.push(id);
  return options;
}

/** Q / the speech bubble: say what you need, and the island shows you. */
export async function needs() {
  if (!canAct()) return;
  setGame({ needsPulse: false });
  const said = await ask({
    kind: "choice",
    options: needOptions(),
    picture: "needs",
    question: { en: "What do you need?", by: "self" },
    cancellable: true
  });
  if (!said) return;
  const look = (icon: ItemId | "moon") => toast({ en: "Look!", ja: "ひかっている ところを みて！", icon, tone: "info" });
  if (said === "sleep") {
    const bed = sleepPlace();
    if (bed) {
      showPlaces([bed.id]);
      look("moon");
    }
    return;
  }
  if (said === "needWater") {
    // The pond's water spots; while a gate is closed, the gate on the way there.
    const g = getGame();
    showPlaces(!g.pathCleared ? [FALLEN_TREE.id] : !g.bridgeBuilt ? [BRIDGE.id] : WATER_SPOTS.map((s) => s.id));
    look("water");
    return;
  }
  const kind = NEED_KIND[said];
  if (!kind) return;
  const kinds: NodeKind[] = kind === "wood" && count(getGame().bag, "axe") > 0 ? ["wood", "tree"] : [kind];
  if (showBeacons(kinds)) look(NODE_YIELD[kind].item);
}

/** Hotbar click: food is eaten, buildings are placed. */
export function useItem(item: ItemId) {
  const def = ITEMS[item];
  if (def.food) return eatItem(item);
  if (def.places) return startPlacing(item);
  const g = getGame();
  setGame({ selected: g.selected === item ? null : item });
}
