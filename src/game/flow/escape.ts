import { getGame, setGame, toast } from "../store";
import { rt } from "../runtime";
import { count, removeAll } from "../logic/inventory";
import { COVE_LOOK_SHOT, KAI_ROUTES, RESCUE_SECONDS, RESCUE_SHOT, ROCKFALL, isOnClifftop } from "../world/phase3";
import { walkKaiRoute } from "../kaiRoute";
import { ask, fastMode, say } from "./ask";
import { refreshQuest, save, showPlaces, updateHint, wait } from "./session";
import { audio } from "../../audio/audio";

/** Day 5's authored journeys finish independently of the player's current action. */
export function sendKaiAhead() {
  walkKaiRoute(getGame().cliffOpen ? KAI_ROUTES.toClifftop : KAI_ROUTES.toRockfall);
}

/** An interrupted walk resumes at its destination, never halfway along the trail. */
export function restoreEscapeKai() {
  const route = getGame().cliffOpen ? KAI_ROUTES.toClifftop : KAI_ROUTES.toRockfall;
  const end = route[route.length - 1];
  rt.kai.x = end.x;
  rt.kai.z = end.z;
  rt.kai.route = [];
  rt.kai.walkTo = null;
  setGame({ kaiStage: getGame().cliffOpen ? "clifftop" : "rockfall" });
}

/** Observe arrival facts during live play; each is sticky and saved immediately. */
export function checkEscapeArrivals() {
  const g = getGame();
  if (g.quest.day !== 5 || g.radioTried) return;
  const destination = g.cliffOpen ? "clifftop" : "rockfall";
  if (g.kai.escapeMorning && !rt.kai.route.length && g.kaiStage !== destination) {
    setGame({ kaiStage: destination });
    updateHint();
    save();
  }
  if (!g.inCave && g.cliffOpen && !g.reachedClifftop && isOnClifftop(rt.player.x, rt.player.z)) {
    setGame({ reachedClifftop: true, mode: "talk", focus: null });
    refreshQuest();
    void arrivalLine();
  }
}

async function arrivalLine() {
  await say("self", "Wow! I can see the whole island!", "わあ！ しまが ぜんぶ みえる！");
  setGame({ mode: "explore" });
}

/** Both survivors push together; the authored world animation rolls the rocks away. */
export async function clearRockfall() {
  const g = getGame();
  if (g.cliffOpen) return;
  if (g.quest.day !== 5) {
    setGame({ mode: "talk" });
    await say("game", "CLIFF → Rocks fell. The path is closed.", "がけ → いわが おちた。 みちは とおれないよ。");
    setGame({ mode: "explore" });
    return;
  }
  if (g.kaiStage !== "rockfall" || rt.kai.route.length) {
    toast({ en: "Kai is coming!", ja: "カイが くるよ！ まってね。", icon: "needs", tone: "info" });
    return;
  }
  const said = await ask({ kind: "command", options: ["canHelp"], picture: "stone", cancellable: true, readSentence: true });
  if (!said) return;
  setGame({ mode: "busy", focus: null });
  await say("kai", "Yes, I can! One, two, three!", "もちろん！ いち、に、さん！");
  rt.kai.yaw = Math.atan2(ROCKFALL.x - rt.kai.x, ROCKFALL.z - rt.kai.z);
  rt.player.yaw = Math.atan2(ROCKFALL.x - rt.player.x, ROCKFALL.z - rt.player.z);
  rt.pushT0 = rt.time;
  await wait(600);
  audio.play("rumble");
  rt.cliffOpenT0 = rt.time;
  setGame({ cliffOpen: true });
  refreshQuest();
  await wait(1500);
  sendKaiAhead();
  showPlaces(["clifftop"]);
  setGame({ mode: "explore" });
  updateHint();
  save();
}

/** The bag item can only be lit here, and this climax always asks the familiar command. */
export async function useSignalPad() {
  const g = getGame();
  if (!g.cliffOpen || g.quest.day < 5) return;
  if (g.signalLit) {
    if (!g.radioTried) await radioCall();
    return;
  }
  if (count(g.bag, "signalFire") === 0) {
    setGame({ mode: "talk", focus: null });
    await say("self", "We need a signal fire.", "のろしが ひつようだね。");
    setGame({ mode: "explore" });
    return;
  }
  const said = await ask({ kind: "command", options: ["makeFire"], picture: "signalFire", cancellable: true, readSentence: true });
  if (!said || getGame().signalLit) return;
  const bag = removeAll(getGame().bag, { signalFire: 1 });
  if (!bag) return;
  setGame({ bag, signalLit: true, mode: "busy", focus: null });
  rt.signalLitT0 = rt.time;
  audio.play("signalWhoosh");
  refreshQuest();
  await wait(1400);
  await say("kai", "Look at the smoke!", "けむりを みて！");
  await radioCall();
}

/**
 * The radio answers once, then fades out: the old radio is too weak for
 * anyone to hear. Every offered answer is accepted. Then, from the clifftop,
 * Kai sees the shipwreck's wood and boxes in the next cove, and Chapter 1 ends.
 * (The helicopter rescue is kept for the final chapter: see rescue().)
 */
export async function radioCall() {
  if (getGame().radioTried) return;
  setGame({ mode: "busy", focus: null });
  audio.play("radioStatic");
  await wait(700);
  const answer = await ask({
    kind: "choice",
    options: ["needHelp", "needWater", "sleep"],
    question: { en: "Hello? Hello? What do you need?", by: "radio" },
    picture: "radio",
    readQuestion: true
  });
  setGame({ mode: "busy" });
  audio.play("radioStatic");
  const heard = answer === "needWater" ? "Water?" : answer === "sleep" ? "Sleep?" : "Help?";
  await say("radio", `${heard} … I can't … hear … you …`, "…よく きこえない…");
  await wait(900);
  await say("kai", "Hello? Hello? … Oh no. The radio is too weak.", "もしもし？ もしもし？ …ああ。 ラジオが よわすぎるんだ。");
  await say("kai", "We need a better radio. Then we can try again.", "もっと いい ラジオが いるね。 そうしたら また ためそう。");
  setGame({ radioTried: true });
  refreshQuest();
  save();
  await seeTheCove();
}

/** From the clifftop: the shipwreck's wood and boxes in the next cove. Then the Chapter 1 card. */
async function seeTheCove() {
  rt.camera.mode = "shot";
  rt.camera.shot = COVE_LOOK_SHOT;
  await wait(1400);
  await say("kai", "Look! What's that?", "みて！ あれは なに？");
  await say("kai", "Wood and boxes from a ship! In the next cove!", "ふねの 木や はこだ！ となりの いりえに あるよ！");
  await say("kai", "Let's make our camp better. Then we can try the radio again.", "キャンプを もっと よく しよう。 それから また ラジオを ためそう。");
  rt.camera.mode = "follow";
  rt.camera.shot = null;
  setGame({ screen: "dayEnd", mode: "busy", focus: null, hint: null });
  save();
}

/**
 * The final chapter's ending, kept from Chapter 1: the helicopter flies in,
 * lands on the plateau and the rescue card follows. The story does not reach
 * it yet; the test hook plays it so it keeps working.
 */
export async function rescue() {
  setGame({ rescued: true, mode: "busy", focus: null, prompt: null, line: null });
  rt.rescueT0 = rt.time;
  rt.camera.mode = "shot";
  rt.camera.shot = RESCUE_SHOT;
  audio.startRescueMusic();
  audio.startRotor(RESCUE_SECONDS);
  if (fastMode()) {
    await wait(RESCUE_SECONDS * 1000);
    rt.rescueT0 = rt.time - RESCUE_SECONDS;
  } else {
    while (rt.time - rt.rescueT0 < RESCUE_SECONDS) await wait(100);
  }
  audio.stopRotor();
  await say("kai", "We did it! We're going home!", "やったね！ いえに かえれるよ！");
  setGame({ screen: "dayEnd", mode: "busy", focus: null, hint: null });
  save();
}
