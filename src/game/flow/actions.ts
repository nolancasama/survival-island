import { getGame, setGame, toast } from "../store";
import { rt, floatText } from "../runtime";
import { ITEMS, type CraftId, type ItemId, type NodeKind } from "../types";
import type { PhraseId } from "../logic/english";
import { addItem, count, isFull, removeAll } from "../logic/inventory";
import { RECIPES, checkCraft, craft } from "../logic/crafting";
import { eat, spend } from "../logic/stats";
import { CRATE, NODE_BY_ID, RESPAWN_S, groundY } from "../world/island";
import type { PlacedBuilding } from "../world/placement";
import { ask, say } from "./ask";
import { refreshQuest, save, showBeacons, syncStats, updateHint } from "./session";
import { talkToKai } from "./kai";
import { focusPosition } from "./focus";
import { audio } from "../../audio/audio";
import { UI } from "../../ui/i18n";

const GATHER: Record<NodeKind, PhraseId> = { wood: "getWood", stone: "getStone", coconut: "getCoconut" };
const EAT: Partial<Record<ItemId, PhraseId>> = { coconut: "eatCoconut" };

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
      return lightFire(f.id);
    case "sign":
      return readSign();
  }
}

async function gather(nodeId: string) {
  const n = NODE_BY_ID.get(nodeId);
  if (!n || rt.taken.has(nodeId)) return;
  const item: ItemId = n.kind;
  if (isFull(getGame().bag, item)) {
    audio.play("full");
    toast({ ...UI.full, icon: item, tone: "warn" });
    return;
  }
  const phrase = GATHER[n.kind];
  if (!getGame().known.includes(phrase)) {
    const said = await ask({ kind: "command", options: [phrase], picture: item, cancellable: true, readSentence: true });
    if (!said) return;
  }
  if (rt.taken.has(nodeId)) return;
  rt.taken.set(nodeId, RESPAWN_S[n.kind]);
  rt.beacons.ids = rt.beacons.ids.filter((id) => id !== nodeId);
  rt.player.action = { kind: "gather", t0: rt.time };
  rt.player.frozenUntil = rt.time + 0.45;
  rt.stats = spend(rt.stats, 3);
  setGame({ bag: addItem(getGame().bag, item, 1).bag });
  audio.play(n.kind);
  floatText(`+1 ${ITEMS[item].en}`, n.x, groundY(n.x, n.z) + 1.1, n.z);
  refreshQuest();
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

async function readSign() {
  setGame({ mode: "talk" });
  if (getGame().quest.complete) await say("game", "FOREST → Tomorrow, with Kai!", "もり → あした カイと いこう！");
  else await say("game", "FOREST → It's dark in there. Make a fire first!", "もり → なかは くらいよ。 まず 火を つくろう！");
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

const NEED_KIND: Partial<Record<PhraseId, NodeKind>> = { hungry: "coconut", needWood: "wood", needStone: "stone", needFood: "coconut" };

/** Q / the speech bubble: say what you need, and the island shows you. */
export async function needs() {
  if (!canAct()) return;
  setGame({ needsPulse: false });
  const said = await ask({
    kind: "choice",
    options: ["hungry", "needWood", "needStone"],
    picture: "needs",
    question: { en: "What do you need?", by: "self" },
    cancellable: true
  });
  if (!said) return;
  const kind = NEED_KIND[said];
  if (kind && showBeacons(kind)) {
    toast({ en: "Look!", ja: "ひかっている ところを みて！", icon: kind, tone: "info" });
  }
}

/** Hotbar click: food is eaten, buildings are placed. */
export function useItem(item: ItemId) {
  const def = ITEMS[item];
  if (def.food) return eatItem(item);
  if (def.places) return startPlacing(item);
  const g = getGame();
  setGame({ selected: g.selected === item ? null : item });
}
