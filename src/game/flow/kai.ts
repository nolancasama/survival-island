import { getGame, setGame, toast } from "../store";
import { rt, floatText } from "../runtime";
import { addItem, count } from "../logic/inventory";
import { currentStep, readyToSleep } from "../logic/quest";
import { FALLEN_TREE } from "../world/island";
import type { CraftId } from "../types";
import { ask, say } from "./ask";
import { refreshQuest, showBeacons, showPlaces } from "./session";
import { sleepPlace } from "./days";
import { audio } from "../../audio/audio";

/**
 * Kai: the other survivor. He teaches the recipes (the campfire on Day 1, the
 * stone axe on Day 2), and the player's answers change what he says and
 * gives. Questions are target English (no Japanese); his other lines have
 * optional Japanese help.
 */

function frameConversation() {
  const p = rt.player;
  const k = rt.kai;
  rt.kai.yaw = Math.atan2(p.x - k.x, p.z - k.z);
  p.yaw = Math.atan2(k.x - p.x, k.z - p.z);
  // Over the player's shoulder, Kai in view.
  const dx = p.x - k.x;
  const dz = p.z - k.z;
  const d = Math.hypot(dx, dz) || 1;
  const ux = dx / d;
  const uz = dz / d;
  // Right of the player's view direction.
  const rx = -uz;
  const rz = ux;
  rt.camera.mode = "shot";
  rt.camera.shot = {
    pos: { x: p.x + ux * 3.4 + rx * 1.5, y: 2.6, z: p.z + uz * 3.4 + rz * 1.5 },
    target: { x: (p.x + k.x) / 2 - ux * 0.4, y: 1.15, z: (p.z + k.z) / 2 - uz * 0.4 }
  };
}

function endConversation() {
  rt.camera.mode = "follow";
  rt.camera.shot = null;
  rt.kai.talking = false;
  setGame({ mode: "explore" });
}

function give(item: "coconut" | "wood" | "stone") {
  setGame({ bag: addItem(getGame().bag, item, 1).bag });
  audio.play(item);
  floatText(`+1 ${item}`, rt.player.x, rt.player.y + 2.1, rt.player.z);
}

export async function talkToKai() {
  setGame({ mode: "talk", focus: null });
  rt.kai.talking = true;
  frameConversation();
  try {
    const g = getGame();
    if (!g.metKai) await firstMeeting();
    else if (readyToSleep(g.quest)) await bedtime();
    else if (g.quest.day === 1) await helpAgain();
    else if (g.quest.day === 2) await helpDayTwo();
    else await whatDoYouNeed();
  } finally {
    endConversation();
    refreshQuest();
  }
}

/** Kai's talk when a new day starts (after the day title). */
export async function morningTalk(day: number) {
  setGame({ mode: "talk", focus: null });
  rt.kai.talking = true;
  frameConversation();
  try {
    if (day === 2) await dayTwoMorning();
    else await say("kai", "Good morning! Let's explore the island!", "おはよう！ しまを たんけんしよう！");
  } finally {
    endConversation();
    refreshQuest();
  }
}

function unlock(id: CraftId, en: string, ja: string) {
  const g = getGame();
  if (!g.unlocked.includes(id)) setGame({ unlocked: [...g.unlocked, id] });
  setGame({ craftPulse: true });
  audio.play("unlock");
  toast({ en: `New recipe: ${en}`, ja: `あたらしい レシピ: ${ja}`, icon: id, tone: "good" }, 3500);
}

/** Only Sleep is left today. */
async function bedtime() {
  const bed = sleepPlace();
  if (bed) showPlaces([bed.id]);
  if (bed?.type === "shelter") await say("kai", "It's getting dark. Let's sleep in the shelter!", "くらく なって きたね。 こやで ねよう！");
  else await say("kai", "It's late. Let's sleep by the fire.", "もう おそいね。 火の そばで ねよう。");
}

async function dayTwoMorning() {
  await say("kai", "Good morning!", "おはよう！");
  await say("kai", "Brr! The sand was cold.", "ブルル！ すなの うえは さむかったね。");
  await say("kai", "Let's make a shelter.", "こやを つくろう。");
  showPlaces([FALLEN_TREE.id]);
  await say("kai", "Leaves are in the forest. But a big tree is in the way.", "もりに はっぱが あるよ。 でも おおきな 木が じゃまなんだ。");
  const can = await ask({
    kind: "choice",
    options: ["yesICan", "noICant"],
    question: { en: "Can you make a stone axe?", by: "kai" },
    picture: "axe",
    readQuestion: true
  });
  if (can === "yesICan") {
    setGame({ kai: { ...getGame().kai, canAxe: true } });
    await say("kai", "Great! Show me!", "すごい！ みせて！");
  } else {
    setGame({ kai: { ...getGame().kai, canAxe: false } });
    give("stone");
    await say("kai", "That's OK. Here's a stone.", "だいじょうぶ。 はい、 石を どうぞ。");
  }
  await say("kai", "You need two wood and one stone.", "木が 2つと、 石が 1つ いるよ。", {
    icons: [
      { item: "wood", n: 2 },
      { item: "stone", n: 1 }
    ]
  });
  unlock("axe", "stone axe", "石の おの");
}

/** Later visits on Day 2: a hint for the open step, with the beacons that go with it. */
async function helpDayTwo() {
  const g = getGame();
  const step = currentStep(g.quest)?.id;
  const shelter = g.buildings.find((b) => b.type === "shelter" && !b.built);
  switch (step) {
    case "axe":
      if (count(g.bag, "wood") >= 2 && count(g.bag, "stone") >= 1) {
        await say("kai", "Make a stone axe. Then cut the big tree!", "石の おのを つくろう。 それから おおきな 木を きろう！");
        return;
      }
      return whatDoYouNeed();
    case "path":
      showPlaces([FALLEN_TREE.id]);
      await say("kai", "Cut the big tree with your axe!", "おので おおきな 木を きろう！");
      return;
    case "leaves":
      showBeacons("leaves");
      await say("kai", "Leaves are in the forest. Look!", "はっぱは もりに あるよ。 みて！");
      return;
    case "wood":
      showBeacons(count(g.bag, "axe") > 0 ? ["tree", "wood"] : "wood");
      await say("kai", "Cut the trees with your axe!", "おので 木を きろう！");
      return;
    case "shelter":
      await say("kai", "You have wood and leaves! Make a shelter.", "木と はっぱが あるね！ こやを つくろう。");
      return;
    case "build":
      if (shelter) {
        showPlaces([shelter.id]);
        await say("kai", "Now build the shelter!", "さあ、 こやを たてよう！");
      } else {
        await say("kai", "Put the shelter down. Then build it!", "こやを おいてから、 たてよう！");
      }
      return;
    default:
      return whatDoYouNeed();
  }
}

/** Kai's repeatable question, with the needs that matter now. */
async function whatDoYouNeed() {
  const g = getGame();
  const leaves = g.pathCleared || g.unlocked.includes("shelter");
  const need = await ask({
    kind: "choice",
    options: leaves ? ["needWood", "needStone", "needLeaves"] : ["needWood", "needStone", "needFood"],
    question: { en: "What do you need?", by: "kai" },
    readQuestion: true
  });
  if (need === "needWood") {
    showBeacons(count(getGame().bag, "axe") > 0 ? ["wood", "tree"] : "wood");
    await say("kai", "Look! Wood is over there.", "みて！ 木は あそこだよ。");
  } else if (need === "needStone") {
    showBeacons("stone");
    await say("kai", "Look! Stones are over there.", "みて！ 石は あそこだよ。");
  } else if (need === "needLeaves") {
    showBeacons("leaves");
    await say("kai", "Look! Leaves are over there.", "みて！ はっぱは あそこだよ。");
  } else {
    showBeacons("coconut");
    await say("kai", "Coconuts are under the palm trees.", "ココナッツは ヤシの 木の したに あるよ。");
  }
}

async function firstMeeting() {
  await say("kai", "Hi! I'm Kai.", "やあ！ ぼくは カイ。");
  await say("kai", "My boat broke, too.", "ぼくの ふねも こわれたんだ。");
  const need = await ask({
    kind: "choice",
    options: ["needWater", "needFood", "needWood"],
    question: { en: "What do you need?", by: "kai" },
    readQuestion: true
  });
  if (need === "needWater") {
    setGame({ kai: { ...getGame().kai, need: "water" } });
    await say("kai", "The pond has water. But the bridge is broken.", "いけに みずが あるけど、 はしが こわれているんだ。");
    give("coconut");
    await say("kai", "Here. Drink this coconut!", "はい。 この ココナッツを のんで！");
  } else if (need === "needFood") {
    setGame({ kai: { ...getGame().kai, need: "food" } });
    showBeacons("coconut");
    await say("kai", "Coconuts are good. Look under the palm trees!", "ココナッツが おいしいよ。 ヤシの 木の したを みて！");
    give("coconut");
    await say("kai", "Here, take one!", "はい、 ひとつ どうぞ！");
  } else {
    setGame({ kai: { ...getGame().kai, need: "wood" } });
    showBeacons("wood");
    await say("kai", "Wood is on the beach. Look!", "木は はまに あるよ。 みて！");
    give("wood");
    await say("kai", "Here, take this!", "はい、 これ どうぞ！");
  }
  setGame({ metKai: true });
  refreshQuest();
  await say("kai", "It's getting dark.", "もうすぐ くらく なるね。");
  const can = await ask({
    kind: "choice",
    options: ["yesICan", "noICant"],
    question: { en: "Can you make a fire?", by: "kai" },
    picture: "fire",
    readQuestion: true
  });
  if (can === "yesICan") {
    setGame({ kai: { ...getGame().kai, canFire: true } });
    await say("kai", "Great! Show me!", "すごい！ みせて！");
  } else {
    setGame({ kai: { ...getGame().kai, canFire: false } });
    await say("kai", "That's OK. I can help you!", "だいじょうぶ。 てつだうよ！");
    give("stone");
    await say("kai", "Here's a stone.", "はい、 石を どうぞ。");
  }
  await say("kai", "You need three wood and two stones.", "木が 3つと、 石が 2つ いるよ。", {
    icons: [
      { item: "wood", n: 3 },
      { item: "stone", n: 2 }
    ]
  });
  setGame({ unlocked: ["campfire"], craftPulse: true });
  audio.play("unlock");
  toast({ en: "New recipe: campfire", ja: "あたらしい レシピ: たきび", icon: "campfire", tone: "good" }, 3500);
}

/** Later visits: a hint for where you are, and Kai's repeatable "What do you need?". */
async function helpAgain() {
  const g = getGame();
  const placed = g.buildings.some((b) => b.type === "campfire");
  const crafted = g.crafted.includes("campfire");
  if (placed) {
    await say("kai", "Now make a fire!", "さあ、 火を つけよう！");
    return;
  }
  if (crafted) {
    await say("kai", "Put the campfire on the sand.", "たきびを すなの うえに おこう。");
    return;
  }
  if (count(g.bag, "wood") >= 3 && count(g.bag, "stone") >= 2) {
    await say("kai", "You have wood and stones! Now make a campfire.", "木と 石が あるね！ たきびを つくろう。");
    return;
  }
  const need = await ask({
    kind: "choice",
    options: ["needWood", "needStone", "needFood"],
    question: { en: "What do you need?", by: "kai" },
    readQuestion: true
  });
  if (need === "needWood") {
    showBeacons("wood");
    await say("kai", "Look! Wood is over there.", "みて！ 木は あそこだよ。");
  } else if (need === "needStone") {
    showBeacons("stone");
    await say("kai", "Look! Stones are over there.", "みて！ 石は あそこだよ。");
  } else {
    showBeacons("coconut");
    await say("kai", "Coconuts are under the palm trees.", "ココナッツは ヤシの 木の したに あるよ。");
  }
}
