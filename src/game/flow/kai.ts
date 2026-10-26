import { getGame, setGame, toast } from "../store";
import { rt, floatText } from "../runtime";
import { addItem, count } from "../logic/inventory";
import { currentStep, readyToSleep } from "../logic/quest";
import { pace, recipeNeeds } from "../logic/pace";
import { BRIDGE, CRATE, FALLEN_TREE, FISH_SPOTS, WATER_SPOTS, groundY } from "../world/island";
import { CAVE_BOX } from "../world/phase3";
import type { CraftId } from "../types";
import { ask, say } from "./ask";
import { refreshQuest, save, showBeacons, showPlaces, showStepTarget } from "./session";
import { sendKaiAhead } from "./escape";
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
  const y = groundY(p.x, p.z);
  rt.camera.mode = "shot";
  rt.camera.shot = {
    pos: { x: p.x + ux * 3.4 + rx * 1.5, y: y + 2.6, z: p.z + uz * 3.4 + rz * 1.5 },
    target: { x: (p.x + k.x) / 2 - ux * 0.4, y: y + 1.15, z: (p.z + k.z) / 2 - uz * 0.4 }
  };
}

function endConversation() {
  rt.camera.mode = "follow";
  rt.camera.shot = null;
  rt.kai.talking = false;
  setGame({ mode: "explore" });
}

function give(item: "coconut" | "wood" | "stone" | "leaves") {
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
    else if (g.quest.day === 3) await helpDayThree();
    else if (g.quest.day === 4) await helpDayFour();
    else if (g.quest.day === 5) await helpDayFive();
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
    else if (day === 3) await dayThreeMorning();
    else if (day === 4) await dayFourMorning();
    else if (day === 5) await dayFiveMorning();
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
  await dayThreeThanks();
  const bed = sleepPlace();
  if (bed) showPlaces([bed.id]);
  if (bed?.type === "shelter") await say("kai", "It's getting dark. Let's sleep in the tent!", "くらく なって きたね。 テントで ねよう！");
  else await say("kai", "It's late. Let's sleep by the fire.", "もう おそいね。 火の そばで ねよう。");
}

/** The evening remembers Day 3's choice, then looks ahead on Day 4. */
export async function dayThreeThanks() {
  const g = getGame();
  if (g.quest.day === 4) {
    await say("kai", "Tomorrow we go home!", "あしたは いえに かえろう！");
    return;
  }
  if (g.quest.day !== 3) return;
  if (g.kai.want === "fish") {
    await say("kai", "Fish for dinner! Yum!", "ゆうごはんは さかな！ おいしいね！");
  } else {
    await say("kai", "Fresh water! Thank you!", "きれいな みず！ ありがとう！");
  }
}

async function dayTwoMorning() {
  await say("kai", "Good morning!", "おはよう！");
  await say("kai", "Brr! The sand was cold.", "ブルル！ すなの うえは さむかったね。");
  await say("kai", "Let's make a tent.", "テントを つくろう。");
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
  const needs = recipeNeeds("axe", getGame().settings.classroom);
  await say("kai", `You need ${numberWord(needs.wood!)} wood and ${numberWord(needs.stone!)} stone.`, `木が ${needs.wood}つと、 石が ${needs.stone}つ いるよ。`, {
    icons: [{ item: "wood", n: needs.wood! }, { item: "stone", n: needs.stone! }]
  });
  unlock("axe", "stone axe", "石の おの");
}

async function dayThreeMorning() {
  await say("kai", "Good morning!", "おはよう！");
  await say("kai", "I'm thirsty.", "のどが かわいたな。");
  await say("kai", "The pond has water and fish. But the bridge is broken.", "いけには みずと さかなが あるよ。 でも はしが こわれているんだ。");
  const want = await ask({
    kind: "choice",
    options: ["wantWater", "wantFish"],
    question: { en: "What do you want to do?", by: "kai" },
    picture: "water",
    readQuestion: true
  });
  const waterFirst = want === "wantWater";
  setGame({ kai: { ...getGame().kai, want: waterFirst ? "water" : "fish" } });
  if (waterFirst) {
    give("coconut");
    await say("kai", "A coconut can carry water!", "ココナッツで みずを はこべるよ！");
    await teachContainer();
    await teachRod();
  } else {
    await teachRod();
    if (!getGame().crateOpened) {
      showPlaces([CRATE.id]);
      await say("kai", "Open the box on the beach. There is rope!", "はまの はこを あけてね。 ロープが あるよ！");
    }
    await teachContainer();
  }
  const targets = !waterFirst && !getGame().crateOpened ? [BRIDGE.id, CRATE.id] : [BRIDGE.id];
  showPlaces(targets);
  await bridgeNeedsLine();
}

/** Recipe quantities always follow the active teacher setting. */
function numberWord(n: number): string {
  return ["zero", "one", "two", "three", "four"][n] ?? String(n);
}

async function bridgeNeedsLine() {
  const wood = pace(getGame().settings.classroom).bridgeNeeds.wood!;
  await say("kai", `You need ${numberWord(wood)} wood for the bridge.`, `はしには 木が ${wood}つ いるよ。`, {
    icons: [{ item: "wood", n: wood }]
  });
}

async function containerNeedsLine() {
  const needs = recipeNeeds("container", getGame().settings.classroom);
  const leaves = needs.leaves!;
  await say("kai", `Make a cup with a coconut and ${leaves === 1 ? "one leaf" : `${numberWord(leaves)} leaves`}.`, `ココナッツ ${needs.coconut}つと はっぱ ${leaves}つで カップを つくろう。`, {
    icons: [{ item: "coconut", n: needs.coconut! }, { item: "leaves", n: leaves }]
  });
}

async function rodNeedsLine() {
  const needs = recipeNeeds("rod", getGame().settings.classroom);
  await say("kai", `Make a fishing rod with ${numberWord(needs.wood!)} wood and ${numberWord(needs.rope!)} rope.`, `木 ${needs.wood}つと ロープ ${needs.rope}つで つりざおを つくろう。`, {
    icons: [{ item: "wood", n: needs.wood! }, { item: "rope", n: needs.rope! }]
  });
}

async function teachContainer() {
  await containerNeedsLine();
  unlock("container", "cup", "カップ");
}

async function teachRod() {
  await rodNeedsLine();
  unlock("rod", "fishing rod", "つりざお");
}

async function dayFourMorning() {
  await say("kai", "Good morning! Look at the cave.", "おはよう！ どうくつを みて。");
  await say("kai", "The cave is dark.", "どうくつは くらいね。");
  const can = await ask({
    kind: "choice",
    options: ["yesICan", "noICant"],
    question: { en: "Can you make a torch?", by: "kai" },
    picture: "torch",
    readQuestion: true
  });
  setGame({ kai: { ...getGame().kai, canTorch: can === "yesICan" } });
  if (can === "yesICan") {
    await say("kai", "Show me!", "みせて！");
  } else {
    give("leaves");
    await say("kai", "Here are some leaves.", "はい、 はっぱを どうぞ。");
  }
  unlock("torch", "torch", "たいまつ");
  showPlaces(["caveMouth"]);
}

async function dayFiveMorning() {
  await say("kai", "Today we go home!", "きょうは いえに かえろう！");
  await say("kai", "Let's go to the clifftop. But rocks are on the path.", "がけの うえへ いこう。 でも みちに いわが あるんだ。");
  await say("kai", "I'll meet you there.", "そこで あおうね。");
  setGame({ kai: { ...getGame().kai, escapeMorning: true } });
  sendKaiAhead();
  showPlaces(["rockfall"]);
  save();
}

/** Repeatable Day 5 hints share their targets with classroom automatic help. */
async function helpDayFive() {
  const g = getGame();
  showStepTarget();
  switch (currentStep(g.quest)?.id) {
    case "cliff":
      await say("kai", "Ask me at the rocks: Can you help me?", "いわの ところで、たすけを たのんでね。");
      return;
    case "wood":
      await say("kai", "Get wood for the signal fire!", "のろしの 木を あつめよう！");
      return;
    case "leaves":
      await say("kai", "Get leaves for the signal fire!", "のろしの はっぱを あつめよう！");
      return;
    case "signalFire": {
      const needs = recipeNeeds("signalFire", g.settings.classroom);
      await say("kai", `Make a signal fire with ${numberWord(needs.wood!)} wood, ${numberWord(needs.leaves!)} leaves and ${numberWord(needs.metal!)} metal.`, `木 ${needs.wood}つ、はっぱ ${needs.leaves}つ、てつ ${needs.metal}つで のろしを つくろう。`, {
        icons: [{ item: "wood", n: needs.wood! }, { item: "leaves", n: needs.leaves! }, { item: "metal", n: needs.metal! }]
      });
      return;
    }
    case "clifftop":
      await say("kai", "Follow the path to the clifftop!", "みちを のぼって がけの うえへ いこう！");
      return;
    case "signal":
      await say("kai", "Make a fire on the stone pad!", "いしの だいで 火を つけよう！");
      return;
    case "help":
      await say("kai", "Use the radio. Tell them what you need!", "ラジオで、ひつような ものを つたえよう！");
      return;
  }
}

/** Before the radio is found, Kai points toward the cave's next discovery. */
async function helpDayFour() {
  const g = getGame();
  if (count(g.bag, "radio") > 0 && g.kai.have === undefined) {
    const have = await ask({
      kind: "choice",
      options: ["haveRadio", "haveMetal"],
      question: { en: "What do you have?", by: "kai" },
      picture: "radio",
      readQuestion: true
    });
    if (have === "haveRadio") {
      await say("kai", "A radio! We can call for help!", "ラジオだ！ たすけを よべるよ！");
    } else {
      await say("kai", "Metal! Good for a signal fire.", "てつだ！ のろしに つかえるね。");
      await say("kai", "And a radio? Wow!", "ラジオも？ すごい！");
    }
    await say("kai", "Tomorrow, let's go to the clifftop. We can make a signal fire there.", "あしたは がけの うえに いこう。 そこで のろしを つくれるよ。");
    unlock("signalFire", "signal fire", "のろし");
    setGame({ kai: { ...getGame().kai, have: have === "haveRadio" ? "radio" : "metal" } });
    return;
  }
  if (!g.inCave) {
    showPlaces(["caveMouth"]);
    await say("kai", "Look in the cave with your torch!", "たいまつを もって どうくつを しらべよう！");
  } else if (currentStep(g.quest)?.id === "metal") {
    showBeacons("metal");
    await say("kai", "Look! There is metal in the cave.", "みて！ どうくつに てつが あるよ。");
  } else {
    showPlaces([CAVE_BOX.id]);
    await say("kai", "Look! There is an old box in the cave.", "みて！ どうくつに ふるい はこが あるよ。");
  }
}

/** Pond hints point at the closed gate first, just like the voluntary needs menu. */
function showPond(ids: string[]) {
  const g = getGame();
  showPlaces(!g.pathCleared ? [FALLEN_TREE.id] : !g.bridgeBuilt ? [BRIDGE.id] : ids);
}

/** Later visits on Day 2: a hint for the open step, with the beacons that go with it. */
async function helpDayTwo() {
  const g = getGame();
  const step = currentStep(g.quest)?.id;
  const shelter = g.buildings.find((b) => b.type === "shelter" && !b.built);
  const axeNeeds = recipeNeeds("axe", g.settings.classroom);
  switch (step) {
    case "axe":
      if (count(g.bag, "wood") >= axeNeeds.wood! && count(g.bag, "stone") >= axeNeeds.stone!) {
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
      await say("kai", "You have wood and leaves! Make a tent.", "木と はっぱが あるね！ テントを つくろう。");
      return;
    case "build":
      if (shelter) {
        showPlaces([shelter.id]);
        await say("kai", "Now build the tent!", "さあ、 テントを たてよう！");
      } else {
        await say("kai", "Put the tent down. Then build it!", "テントを おいてから、 たてよう！");
      }
      return;
    default:
      return whatDoYouNeed();
  }
}

/** Later Day 3 visits follow the current objective without requiring a choice. */
async function helpDayThree() {
  const g = getGame();
  switch (currentStep(g.quest)?.id) {
    case "bridge":
      showPond([BRIDGE.id]);
      await bridgeNeedsLine();
      return;
    case "container":
      if (count(g.bag, "coconut") === 0) showBeacons("coconut");
      else if (count(g.bag, "leaves") < recipeNeeds("container", g.settings.classroom).leaves!) showBeacons("leaves");
      await containerNeedsLine();
      return;
    case "water":
      showPond(WATER_SPOTS.map((spot) => spot.id));
      await say("kai", "Get some water at the pond!", "いけで みずを くもう！");
      return;
    case "drink":
      if (count(g.bag, "water") === 0) showPond(WATER_SPOTS.map((spot) => spot.id));
      await say("kai", "Drink the water from your bag!", "かばんの みずを のもう！");
      return;
    case "rod":
      if (count(g.bag, "rope") === 0 && !g.crateOpened) {
        showPlaces([CRATE.id]);
        await say("kai", "Open the box on the beach. There is rope!", "はまの はこを あけてね。 ロープが あるよ！");
      } else {
        if (count(g.bag, "wood") < recipeNeeds("rod", g.settings.classroom).wood!) showBeacons(count(g.bag, "axe") > 0 ? ["wood", "tree"] : "wood");
        await rodNeedsLine();
      }
      return;
    case "fish":
      showPond(FISH_SPOTS.map((spot) => spot.id));
      await say("kai", "Catch a fish at the pond!", "いけで さかなを つろう！");
      return;
    case "cook": {
      const fire = g.buildings.find((b) => b.type === "campfire" && b.lit);
      if (fire) showPlaces([fire.id]);
      await say("kai", "Cook the fish at the fire!", "火で さかなを やこう！");
      return;
    }
    case "sleep":
      return bedtime();
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
    options: g.quest.day >= 3 ? ["needWater", "needFood", "needWood", "needLeaves"] : leaves ? ["needWood", "needStone", "needLeaves"] : ["needWood", "needStone", "needFood"],
    question: { en: "What do you need?", by: "kai" },
    readQuestion: true
  });
  if (need === "needWater") {
    showPond(WATER_SPOTS.map((spot) => spot.id));
    await say("kai", "The pond has water. Look!", "いけに みずが あるよ。 みて！");
  } else if (need === "needWood") {
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
  const needs = recipeNeeds("campfire", getGame().settings.classroom);
  await say("kai", `You need ${numberWord(needs.wood!)} wood and ${numberWord(needs.stone!)} ${needs.stone === 1 ? "stone" : "stones"}.`, `木が ${needs.wood}つと、 石が ${needs.stone}つ いるよ。`, {
    icons: [{ item: "wood", n: needs.wood! }, { item: "stone", n: needs.stone! }]
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
  const needs = recipeNeeds("campfire", g.settings.classroom);
  if (count(g.bag, "wood") >= needs.wood! && count(g.bag, "stone") >= needs.stone!) {
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
