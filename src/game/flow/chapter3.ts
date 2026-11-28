import { getGame, setGame, toast, type PipeUi } from "../store";
import { rt, floatText } from "../runtime";
import { ITEMS } from "../types";
import type { PhraseId } from "../logic/english";
import { addItem, count, removeAll } from "../logic/inventory";
import { currentStep, PIPE_POLES } from "../logic/quest";
import { spend } from "../logic/stats";
import {
  DEFAULT_NOTCH, NOTCHES, WATER_SPEED, addPiece, diagnose, dirIndex, incoming, isIntake, nodeOf, outgoing, planPiece,
  removePipe, setNotch, solveFlow, turnEnd, type Diagnosis, type Env, type Flow, type Network, type PieceKind, type PiecePlan, type Problem
} from "../logic/waterworks";
import { groundY, LEAN_TO } from "../world/island";
import {
  CONTAINER_SPECS, INTAKE_SPOTS, KAI_STAIRS_ROUTE, KAI_TANK_SPOT, KAI_UPPER, KAI_UPPER_ROUTE, STAIRS, TABLE_ROCK, TANGLE, TANGLE_POLES, TANGLE_SPOT,
  UPPER_POOL, onUpperStream
} from "../world/chapter3";
import { STATIC_OBSTACLES } from "../world/collision";
import { buildingObstacles, placeProblem, type PlacedBuilding } from "../world/placement";
import { isContainer, pipeCheck, pipeEnv, type ContainerType } from "../world/pipeWorld";
import { ask, say } from "./ask";
import { refreshQuest, save, showBeacons, showPlaces, updateHint, wait } from "./session";
import { currentGates, worldPropObstacles } from "./places";
import { CAMP_RADIUS, carry, needAxe } from "./chapter2";
import { walkKaiRoute } from "../kaiRoute";
import { audio } from "../../audio/audio";

/**
 * Chapter 3 "Running Water" (Days 9–10; EXPANSION_PLAN.md Milestone 4). The
 * design is frozen in DESIGN_DECISIONS.md, "2026-11-28 — Narrative correction
 * and Chapter 3". The water itself is logic/waterworks.ts; this file is the
 * story, the building controls and the live water.
 */

const known = (id: PhraseId) => getGame().known.includes(id);

function updateBuilding(id: string, patch: Partial<PlacedBuilding>) {
  setGame({ buildings: getGame().buildings.map((b) => (b.id === id ? { ...b, ...patch } : b)) });
}

/** Camp reach for Chapter 3: a tent, a campfire, the storage box, or Kai's lean-to. */
export function atCamp(x: number, z: number, buildings: readonly PlacedBuilding[] = getGame().buildings): boolean {
  if (Math.hypot(x - LEAN_TO.x, z - LEAN_TO.z) <= CAMP_RADIUS) return true;
  return buildings.some((b) => (b.type === "shelter" || b.type === "campfire" || b.type === "storage") && Math.hypot(b.x - x, b.z - z) <= CAMP_RADIUS);
}

let seq = 1;
const newId = (kind: string) => `${kind}${Date.now().toString(36)}${seq++}`;

// ----------------------------------------------------------------- the water

/** The flow, recomputed only when the network or the buildings change. */
let cache: { net: Network; buildings: readonly PlacedBuilding[]; env: Env; flow: Flow } | null = null;

export function currentFlow(): { env: Env; flow: Flow } {
  const g = getGame();
  if (!cache || cache.net !== g.water || cache.buildings !== g.buildings) {
    const env = pipeEnv(g.buildings);
    cache = { net: g.water, buildings: g.buildings, env, flow: solveFlow(g.water, env) };
  }
  return cache;
}

/** What stops a post or a channel right now. */
function check() {
  return pipeCheck(currentGates(), getGame().buildings);
}

/**
 * When water reaches each wet pipe (it runs from the intake at WATER_SPEED),
 * so it can be seen arriving. Container ids get the time their pour lands.
 */
function updateArrivals(flow: Flow) {
  const w = rt.water;
  const now = rt.time;
  const net = getGame().water;
  const wet = new Set(flow.wet.map((p) => p.id));
  for (const id of [...w.start.keys()]) if (!wet.has(id)) w.start.delete(id);
  for (const p of [...flow.wet].sort((a, b) => a.d0 - b.d0)) {
    if (w.start.has(p.id)) continue;
    const pipe = net.pipes.find((x) => x.id === p.id);
    const up = pipe ? incoming(net, pipe.from) : null;
    const upTiming = up ? w.start.get(up.id) : undefined;
    const start = upTiming ? Math.max(now, upTiming.t + upTiming.dur) : now;
    w.start.set(p.id, { t: start, dur: Math.max(0.15, (p.d1 - p.d0) / WATER_SPEED) });
  }
}

/** The time water starts pouring from an open end (Infinity while it is still on its way). */
export function pourArrival(at: string): number {
  const p = incoming(getGame().water, at);
  if (!p) return Infinity;
  const timing = rt.water.start.get(p.id);
  return timing ? timing.t + timing.dur : Infinity;
}

/** Each container's pour has arrived (water lands in it now). */
function arrivedInto(flow: Flow, id: string): boolean {
  return flow.pours.some((p) => p.into === id && rt.time >= pourArrival(p.at));
}

// -------------------------------------------------------------- morning talks

/** Day 9: the barrel depends on rain; the waterfall never stops. Kai sets off the long way. */
export async function upperMorning() {
  await say("kai", "Good morning! Our barrel is almost empty. Rain doesn't come every day.", "おはよう！ たるの みずが もう すこししか ない。 あめは まいにち ふらないね。");
  rt.camera.mode = "shot";
  rt.camera.shot = { pos: { x: -33, y: 6.5, z: 8 }, target: { x: UPPER_POOL.x - 1.5, y: 7.5, z: UPPER_POOL.z } };
  await wait(1300);
  await say("kai", "Look! A waterfall! The water up there never stops.", "みて！ たきだ！ あそこの みずは とまらないよ。");
  rt.camera.mode = "follow";
  rt.camera.shot = null;
  await say("kai", "There is a path near the pond. I'll meet you at the waterfall!", "いけの ちかくに みちが あるよ。 たきで まってるね！");
  setGame({ kai: { ...getGame().kai, upperMorning: true }, kaiStage: "upper" });
  walkKaiRoute(KAI_UPPER_ROUTE);
  showPlaces(["climbPath"]);
  save();
}

/** Day 10: Kai has made a big tank at camp. */
export async function tankMorning() {
  let g = getGame();
  if (!g.buildings.some((b) => b.type === "tank")) {
    setGame({ buildings: [...g.buildings, { id: newId("tank"), type: "tank", x: KAI_TANK_SPOT.x, z: KAI_TANK_SPOT.z, rot: 0, water: 0 }] });
    g = getGame();
  }
  const tank = g.buildings.find((b) => b.type === "tank")!;
  rt.camera.mode = "shot";
  rt.camera.shot = { pos: { x: tank.x + 3.4, y: groundY(tank.x, tank.z) + 3, z: tank.z + 5 }, target: { x: tank.x, y: groundY(tank.x, tank.z) + 0.6, z: tank.z } };
  await say("kai", "Good morning! Look! I made a big water tank!", "おはよう！ みて！ おおきな みずの タンクを つくったよ！");
  rt.camera.mode = "follow";
  rt.camera.shot = null;
  await say("kai", "Let's bring water from the waterfall to our tank!", "たきから タンクまで みずを ひこう！");
  await say("kai", "We need bamboo poles. Get six poles.", `たけの ぼうが ${PIPE_POLES}ほん いるよ。`, { icons: [{ item: "pole", n: PIPE_POLES }] });
  setGame({ kai: { ...getGame().kai, tankMorning: true } });
  showPlaces([getGame().groveOpen ? "bamboo-1" : "groveGate", tank.id]);
  save();
}

/** Free play after Chapter 3. */
export async function freePlayMorning() {
  const tank = getGame().buildings.find((b) => b.type === "tank");
  if (tank && (tank.water ?? 0) >= 1) await say("kai", "Good morning! Our tank has water. Boil it before you drink!", "おはよう！ タンクに みずが あるよ。 のむ まえに わかしてね！");
  else await say("kai", "Good morning! Let's explore the island!", "おはよう！ しまを たんけんしよう！");
}

// ------------------------------------------------------------ talking to Kai

/** Kai's talk on Days 9–10: the plan on the shelf, the test, or a hint. */
export async function talkChapterThree(day: number) {
  const g = getGame();
  if (day === 9 && !g.kai.pipePlan && g.kaiStage === "upper") {
    if (Math.hypot(rt.kai.x - KAI_UPPER.x, rt.kai.z - KAI_UPPER.z) < 4) return planPipe();
    await say("kai", "Come to the waterfall! Go by the pond.", "たきに おいで！ いけの ほうから いこう。");
    showChapterThreeTarget();
    return;
  }
  const target = testTarget();
  if (target && hasPipe()) return testPipe(target.id);
  await helpChapterThree(day);
}

/** The container the day is about (the bucket on Day 9, the tank on Day 10 and later). */
function testTarget(): PlacedBuilding | null {
  const g = getGame();
  const type = g.quest.day === 9 && !g.bucketFilled ? "bucket" : "tank";
  return g.buildings.find((b) => b.type === type) ?? null;
}

/** There is a pipe from an intake (a test only makes sense once one exists). */
function hasPipe(): boolean {
  const net = getGame().water;
  return INTAKE_SPOTS.some((i) => outgoing(net, i.id).length > 0);
}

/** On the shelf: "What can you see?", the plan, and Kai's bucket on the table rock. */
async function planPipe() {
  const seen = await ask({ kind: "choice", options: ["seeWaterfall", "seeStream", "seeRocks"], question: { en: "What can you see?", by: "kai" }, readQuestion: true, picture: "waterfall" });
  if (seen === "seeStream") await say("kai", "Yes! The stream is fast and clean.", "うん！ ながれが はやくて きれいだね。");
  else if (seen === "seeRocks") await say("kai", "Big rocks! And water between them.", "おおきな いわ！ あいだを みずが ながれてる。");
  else await say("kai", "Yes! A big waterfall. The water is high up here.", "うん！ おおきな たき。 ここは みずが たかい ところに あるね。");
  setGame({ kai: { ...getGame().kai, seen: seen === "seeStream" ? "stream" : seen === "seeRocks" ? "rocks" : "waterfall" } });
  await say("kai", "Water flows down. Always down! And our camp is down there.", "みずは したへ ながれる。 いつも したへ！ キャンプは した に あるね。");
  await ask({ kind: "command", options: ["buildPipe"], picture: "pipe", question: { en: "What do you want to make?", by: "kai" }, readQuestion: true, readSentence: true });
  await say("kai", "Good idea! Bamboo pipes!", "いいね！ たけの パイプ！");
  const g = getGame();
  if (!g.buildings.some((b) => b.type === "bucket")) {
    setGame({ buildings: [...g.buildings, { id: newId("bucket"), type: "bucket", x: TABLE_ROCK.x, z: TABLE_ROCK.z, rot: 0, water: 0 }] });
  }
  audio.play("place");
  await say("kai", "First, let's try. Make a pipe from the rock with the water to my bucket!", "まずは ためそう。 みずが おちる いわから バケツまで パイプを つくって！");
  setGame({ kai: { ...getGame().kai, pipePlan: true } });
  if (!getGame().stairsOpen) {
    await say("kai", "We need bamboo. Look! Old bamboo is over there.", "たけが いるね。 みて！ あそこに ふるい たけが あるよ。");
    showPlaces([TANGLE.id]);
  } else {
    showPlaces(["i:upper", getGame().buildings.find((b) => b.type === "bucket")!.id]);
  }
  refreshQuest();
  save();
}

const HINT_LINES: Record<Exclude<Problem, "none">, (what: string) => { en: string; ja: string }> = {
  tooHigh: () => ({ en: "This post is too high. Water can't go up! Make it lower.", ja: "この はしらが たかすぎる。 みずは のぼれないよ！ ひくく しよう。" }),
  tooLow: (what) => ({ en: `The pipe is lower than the top of the ${what}. Make the posts higher. Start at the top!`, ja: `パイプが ${what === "tank" ? "タンク" : "バケツ"}の ふちより ひくいよ。 うえの ほうから はしらを たかく しよう！` }),
  missed: (what) => ({ en: `The water falls next to the ${what}. Put the ${what} under the pipe!`, ja: `みずが ${what === "tank" ? "タンク" : "バケツ"}の よこに おちてる。 パイプの したに おこう！` }),
  tooShort: () => ({ en: "It's too short! Put one more pipe.", ja: "みじかすぎる！ もう ひとつ パイプを つなごう。" }),
  gap: () => ({ en: "Look! There is a gap. Connect them!", ja: "みて！ すきまが あるよ。 つなごう！" }),
  far: (what) => ({ en: `The water falls far from the ${what}. Bring the pipe to it, or carry the ${what} to the pipe!`, ja: "みずが とおくに おちてる。 パイプを のばすか、 パイプの ところへ はこぼう！" }),
  noPipe: () => ({ en: "Start at a rock with water. Make a pipe!", ja: "みずが おちる いわから パイプを つくろう！" })
};

/** Kai looks at the water: "How is it?" The true answer is what the student can see. */
export async function testPipe(targetId: string) {
  const target = getGame().buildings.find((b) => b.id === targetId);
  if (!target) return;
  const { env, flow } = currentFlow();
  const d: Diagnosis = diagnose(getGame().water, env, flow, targetId);
  const what = target.type === "tank" ? "tank" : "bucket";
  const answer = await ask({ kind: "choice", options: ["flowing", "notWork", "tooHigh", "tooLow"], picture: "pipe", question: { en: "How is it?", by: "kai" }, readQuestion: true });
  setGame({ mode: "talk" });
  if (d.problem === "none") {
    if (answer === "flowing") await say("kai", `Yes! The water is flowing into the ${what}!`, "そう！ みずが ながれて いるね！");
    else await say("kai", `Look again! The water goes into the ${what}. It works!`, "よく みて！ みずが はいってる。 うまく いってるよ！");
    return;
  }
  if (answer === d.answer || (answer === "notWork" && d.answer !== "flowing")) await say("kai", "You're right.", "その とおり。");
  else await say("kai", `Look again! The water is not going into the ${what}.`, "よく みて！ みずが はいって いないよ。");
  await ask({ kind: "command", options: ["tryAgain"], picture: "pipe", readSentence: !known("tryAgain") });
  const hint = HINT_LINES[d.problem](what);
  await say("kai", hint.en, hint.ja);
  if (d.at) showPlaces([d.at]);
  else showChapterThreeTarget();
}

const numberWords = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];

/** Repeatable hints on Days 9–10, matching the step targets. */
export async function helpChapterThree(day: number) {
  const g = getGame();
  const step = currentStep(g.quest)?.id;
  showChapterThreeTarget();
  switch (step) {
    case "upper":
      await say("kai", "Go to the pond. A path goes up to the waterfall.", "いけへ いこう。 たきへ のぼる みちが あるよ。");
      return;
    case "tangle":
      await say("kai", "Cut the old bamboo with your axe!", "おので ふるい たけを きろう！");
      return;
    case "bucket":
      await say("kai", "Start at the rock with the water. Make a pipe to the bucket!", "みずが おちる いわから バケツまで パイプを つくろう！");
      return;
    case "poles":
      await say("kai", `Get ${numberWords[PIPE_POLES]} bamboo poles.`, `たけの ぼうを ${PIPE_POLES}ほん あつめよう。`, { icons: [{ item: "pole", n: PIPE_POLES }] });
      return;
    case "pipeCamp":
      await say("kai", "Make a pipe from the waterfall down the stairs to our camp!", "たきから かいだんを おりて キャンプまで パイプを つくろう！");
      return;
    case "fillTank":
      await say("kai", "Put the tank under the pipe! I can help you carry it.", "パイプの したに タンクを おこう！ はこぶのを てつだうよ。");
      return;
    case "boilTank":
      await say("kai", "Get water from the tank. Then boil it at the fire.", "タンクから みずを とって、 火で わかそう。");
      return;
  }
  if (day === 9 && g.kaiStage === "camp") await say("kai", "Water flows down a pipe! Tomorrow, a long pipe to our camp!", "みずは パイプを ながれるね！ あしたは キャンプまで ながい パイプ！");
  else await say("kai", "Look! Over there.", "みて！ あそこだよ。");
}

/** Beacons for the open Chapter 3 step (Kai's hints and classroom automatic help). */
export function showChapterThreeTarget(): boolean {
  const g = getGame();
  const step = currentStep(g.quest)?.id;
  const ids = (type: "bucket" | "tank") => g.buildings.filter((b) => b.type === type).map((b) => b.id);
  const firstIntake = INTAKE_SPOTS.find((i) => !outgoing(g.water, i.id).length);
  switch (step) {
    case "upper":
      showPlaces(onUpperStream(rt.player.x, rt.player.z) ? ["kai"] : ["climbPath"]);
      return true;
    case "pipePlan":
      showPlaces(["kai"]);
      return true;
    case "tangle":
      showPlaces([TANGLE.id]);
      return true;
    case "bucket": {
      const end = openEnds()[0];
      showPlaces([...(end ? [end] : firstIntake ? ["i:upper"] : []), ...ids("bucket")]);
      return true;
    }
    case "poles":
      if (!g.groveOpen) showPlaces(["groveGate"]);
      else return showBeacons("bamboo");
      return true;
    case "pipeCamp": {
      const end = openEnds()[0];
      showPlaces(end ? [end, "stairsFoot"] : [firstIntake?.id ?? "i:lower"]);
      return true;
    }
    case "fillTank":
      showPlaces([...ids("tank"), ...openEnds().slice(0, 1)]);
      return true;
    case "boilTank": {
      const g2 = getGame();
      showPlaces(count(g2.bag, "water") > 0 ? g2.buildings.filter((b) => b.type === "campfire").map((b) => b.id) : ids("tank"));
      return true;
    }
  }
  return false;
}

/** Joints with nothing leaving them (where a pipe can grow). */
function openEnds(): string[] {
  const net = getGame().water;
  return net.joints.filter((j) => !outgoing(net, j.id).length).map((j) => j.id);
}

// ------------------------------------------------------- the rock stairs

/** "Cut the bamboo." at the fallen bamboo on top of the stairs: poles, and the short way down. */
export async function cutTangle() {
  if (getGame().stairsOpen || needAxe()) return;
  const said = await ask({ kind: "command", options: ["cutBamboo"], picture: "pole", cancellable: true, readSentence: !known("cutBamboo") });
  if (!said || getGame().stairsOpen) return;
  setGame({ mode: "busy", focus: null });
  const p = rt.player;
  p.action = { kind: "chop", t0: rt.time };
  p.frozenUntil = rt.time + 0.8;
  rt.stats = spend(rt.stats, 4);
  audio.play("chop");
  await wait(450);
  rt.stairsOpenT0 = rt.time;
  const added = addItem(getGame().bag, "pole", TANGLE_POLES);
  setGame({ stairsOpen: true, bag: added.bag });
  floatText(`+${added.added} bamboo pole`, TANGLE_SPOT.x, groundY(TANGLE_SPOT.x, TANGLE_SPOT.z) + 1.6, TANGLE_SPOT.z);
  refreshQuest();
  const top = STAIRS[0];
  const foot = STAIRS[1];
  rt.camera.mode = "shot";
  rt.camera.shot = { pos: { x: top.x - 3.5, y: groundY(top.x, top.z) + 3.2, z: top.z - 2.5 }, target: { x: foot.x, y: groundY(foot.x, foot.z) + 0.5, z: foot.z } };
  await wait(1600);
  await say("self", "Wow! A way down to the beach!", "わあ！ ビーチへの ちかみちだ！");
  rt.camera.mode = "follow";
  rt.camera.shot = null;
  setGame({ mode: "explore" });
  updateHint();
  save();
}

// ------------------------------------------------------------- laying pipes

/** E at an intake (no pipe yet) or at an open end: lay a new piece from it. */
export function startLaying(from: string) {
  const g = getGame();
  if (g.carry) return;
  const node = nodeOf(g.water, currentFlow().env, from);
  if (!node) return;
  const notch = node.intake ? DEFAULT_NOTCH : node.notch;
  rt.pipe.dir = dirIndex(Math.sin(rt.player.yaw), Math.cos(rt.player.yaw));
  rt.pipe.plan = null;
  setGame({ mode: "pipe", focus: null, pipe: { kind: "lay", from, len: "long", notch, problem: null, slope: "level", snap: null, underRim: false } });
  updateHint();
}

let planCache: { key: string; water: Network | null; buildings: readonly PlacedBuilding[] | null; plan: PiecePlan | null } = { key: "", water: null, buildings: null, plan: null };

/** Per frame while laying: the piece points from the open end toward where the player walks. */
export function framePipe() {
  const g = getGame();
  const ui = g.pipe;
  if (g.mode !== "pipe" || ui?.kind !== "lay") {
    rt.pipe.plan = null;
    return;
  }
  const { env } = currentFlow();
  const start = nodeOf(g.water, env, ui.from);
  if (!start) return;
  if (rt.pipe.forceDir !== null) {
    rt.pipe.dir = rt.pipe.forceDir;
  } else {
    const p = rt.player;
    const ax = p.x + Math.sin(p.yaw) * 1.5 - start.x;
    const az = p.z + Math.cos(p.yaw) * 1.5 - start.z;
    if (Math.hypot(ax, az) > 0.6) rt.pipe.dir = dirIndex(ax, az);
  }
  // Plan only when something it depends on changed (the network, buildings, gates or the piece).
  const key = `${ui.from}|${rt.pipe.dir}|${ui.len}|${ui.notch}|${g.stairsOpen}`;
  if (planCache.key !== key || planCache.water !== g.water || planCache.buildings !== g.buildings) {
    planCache = { key, water: g.water, buildings: g.buildings, plan: planPiece(g.water, env, check(), ui.from, rt.pipe.dir, ui.len, ui.notch) };
  }
  const plan = planCache.plan;
  rt.pipe.plan = plan;
  if (!plan) return;
  const c = plan.snap?.kind === "container" ? env.containers.find((x) => x.id === plan.snap!.id) : null;
  const underRim = !!c && plan.y < c.ground + c.rim + 0.03;
  const snap = plan.snap?.kind ?? null;
  if (plan.problem !== ui.problem || plan.slope !== ui.slope || snap !== ui.snap || underRim !== ui.underRim) {
    setGame({ pipe: { ...ui, problem: plan.problem, slope: plan.slope, snap, underRim } });
  }
}

export function cycleLength() {
  const ui = getGame().pipe;
  if (ui?.kind !== "lay") return;
  audio.play("rotate");
  setGame({ pipe: { ...ui, len: ui.len === "long" ? "short" : "long" } });
}

/** Higher / lower: the new piece's post while laying, or the chosen post while changing it. */
export function nudgeNotch(step: 1 | -1) {
  const g = getGame();
  const ui = g.pipe;
  if (!ui) return;
  if (ui.kind === "lay") {
    const notch = ui.notch + step;
    if (notch < 0 || notch >= NOTCHES.length) return topOrBottom(notch < 0);
    audio.play("rope");
    setGame({ pipe: { ...ui, notch } });
    return;
  }
  const notch = ui.notch + step;
  if (notch < 0 || notch >= NOTCHES.length) return topOrBottom(notch < 0);
  const next = setNotch(g.water, currentFlow().env, ui.joint, notch);
  if (!next) {
    audio.play("error");
    toast({ en: "It hits the ground!", ja: "じめんに あたって しまうよ！", icon: "pipe", tone: "warn" });
    return;
  }
  rt.partT0.set(`joint:${ui.joint}`, rt.time);
  rt.player.action = { kind: "build", t0: rt.time };
  audio.play("rope");
  setGame({ water: next, pipe: { ...ui, notch } });
  save();
}

function topOrBottom(bottom: boolean) {
  audio.play("full");
  toast({ en: bottom ? "It's already at the bottom!" : "It's already at the top!", ja: bottom ? "もう いちばん したまで さがってるよ！" : "もう いちばん うえまで あがってるよ！", tone: "info" });
}

const PROBLEM_TEXT: Record<string, { en: string; ja: string }> = {
  water: { en: "A post can't stand in the water!", ja: "みずの なかには はしらを たてられないよ！" },
  edge: { en: "There's no ground for the post.", ja: "はしらを たてる じめんが ないよ。" },
  blocked: { en: "Something is in the way.", ja: "じゃまな ものが あるよ。" },
  crowded: { en: "Too close to another post.", ja: "ほかの はしらに ちかすぎるよ。" },
  ground: { en: "It hits the ground. Make it higher!", ja: "じめんに あたるよ。 たかく しよう！" }
};

let putting = false;

/** E / Put: put the previewed piece in. A piece that cannot reach asks "It's too short." (or too long) and swaps. */
export async function confirmPiece() {
  if (putting) return;
  const g = getGame();
  const ui = g.pipe;
  if (g.mode !== "pipe" || ui?.kind !== "lay") return;
  // Plan again from what is true now: the frame's preview can be a frame behind a key press or the last put.
  const plan = planPiece(g.water, currentFlow().env, check(), ui.from, rt.pipe.dir, ui.len, ui.notch);
  rt.pipe.plan = plan;
  if (!plan) return;
  putting = true;
  try {
    if (plan.problem) {
      const other: PieceKind = ui.len === "long" ? "short" : "long";
      const alt = plan.problem !== "ground" ? planPiece(g.water, currentFlow().env, check(), ui.from, rt.pipe.dir, other, ui.notch) : null;
      if (alt && !alt.problem) {
        // The judgement is the English: the student says why this piece will not do.
        const phrase: PhraseId = ui.len === "short" ? "tooShort" : "tooLong";
        rt.partT0.set(`${ui.len === "short" ? "short" : "long"}:preview`, rt.time);
        if (!known(phrase)) {
          const said = await ask({ kind: "command", options: [phrase], picture: ui.len === "short" ? "shortPole" : "pole", cancellable: true, readSentence: true });
          if (!said) return;
        }
        setGame({ mode: "pipe", pipe: { ...ui, len: other } });
        toast({ en: other === "long" ? "A long pipe!" : "A short pipe!", ja: other === "long" ? "ながい パイプ！" : "みじかい パイプ！", icon: other === "long" ? "pole" : "shortPole", tone: "info" });
        return;
      }
      audio.play("error");
      toast({ ...PROBLEM_TEXT[plan.problem], icon: "pipe", tone: "warn" });
      return;
    }
    if (!(await takeMaterial(plan.kind))) return;
    // First connections are the "Connect them." moment.
    if (plan.snap && !known("connect")) {
      const said = await ask({ kind: "command", options: ["connect"], picture: "pipe", cancellable: true, readSentence: true });
      if (!said) {
        giveBack(plan.kind);
        return;
      }
    } else if (!known("putHere")) {
      const said = await ask({ kind: "command", options: ["putHere"], picture: "pipe", cancellable: true, readSentence: true });
      if (!said) {
        giveBack(plan.kind);
        return;
      }
    }
    putPiece(plan);
  } finally {
    putting = false;
  }
}

/** One long pole for a long piece; a short piece uses a short pole (a long one is cut in two). */
async function takeMaterial(kind: PieceKind): Promise<boolean> {
  let bag = getGame().bag;
  if (kind === "short" && count(bag, "shortPole") === 0 && count(bag, "pole") > 0) {
    bag = addItem(removeAll(bag, { pole: 1 })!, "shortPole", 2, Infinity).bag;
    audio.play("chop");
    floatText("Cut! 2 short poles", rt.player.x, rt.player.y + 2.1, rt.player.z);
  }
  const item = kind === "long" ? "pole" : "shortPole";
  if (count(bag, item) === 0) {
    setGame({ bag });
    await needBamboo();
    return false;
  }
  setGame({ bag: removeAll(bag, { [item]: 1 })! });
  return true;
}

function giveBack(kind: PieceKind) {
  setGame({ bag: addItem(getGame().bag, kind === "long" ? "pole" : "shortPole", 1, Infinity).bag });
}

/** Out of bamboo while building: "I need more bamboo." (the first time each day), and the grove lights up. */
async function needBamboo() {
  audio.play("error");
  const day = getGame().quest.day;
  if (rt.pipe.askedBambooDay !== day) {
    rt.pipe.askedBambooDay = day;
    const said = await ask({ kind: "command", options: ["needBamboo"], picture: "pole", cancellable: true, readSentence: !known("needBamboo") });
    if (said) {
      setGame({ mode: "pipe" });
      toast({ en: "Bamboo grows in the grove!", ja: "たけは たけやぶに あるよ！", icon: "pole", tone: "info" }, 3500);
      if (getGame().groveOpen) showBeacons("bamboo");
      else showPlaces(["groveGate"]);
      return;
    }
  }
  toast({ en: "You need bamboo poles.", ja: "たけの ぼうが いるよ。", icon: "pole", tone: "warn" });
}

function putPiece(plan: PiecePlan) {
  const g = getGame();
  const added = addPiece(g.water, plan);
  rt.partT0.set(`joint:${added.joint}`, rt.time);
  rt.partT0.set(`pipe:${added.pipe}`, rt.time);
  rt.player.action = { kind: "build", t0: rt.time };
  rt.player.frozenUntil = rt.time + 0.5;
  rt.stats = spend(rt.stats, 2);
  audio.play("build");
  const ui = getGame().pipe;
  const next: PipeUi | null = plan.snap ? null : ui?.kind === "lay" ? { ...ui, from: added.joint, problem: null } : null;
  setGame({ water: added.net, ...(next ? { pipe: next } : { pipe: null, mode: "explore" }) });
  if (plan.snap?.kind === "container") floatText("Connected!", plan.x, plan.y + 0.6, plan.z);
  else if (plan.snap?.kind === "joint") floatText("Connected!", plan.x, plan.y + 0.6, plan.z);
  refreshQuest();
  save();
}

/** Esc / Done: stop laying or changing. */
export function stopPipe() {
  if (getGame().mode !== "pipe") return;
  rt.pipe.plan = null;
  setGame({ mode: "explore", pipe: null });
  updateHint();
}

/** Back (while laying): take off the piece just put, and lay again from the post before it. */
export function undoPiece() {
  const g = getGame();
  const ui = g.pipe;
  if (ui?.kind !== "lay") return;
  const pipe = incoming(g.water, ui.from);
  if (!pipe) return stopPipe();
  const removed = removePipe(g.water, pipe.id);
  if (!removed) return;
  giveBack(removed.kind);
  audio.play("wood");
  setGame({ water: removed.net, pipe: { ...ui, from: pipe.from } });
  save();
}

// ------------------------------------------------------------ changing posts

/** E at a post: its panel (higher, lower, turn and take off the last piece, or add a pipe). */
export function openJoint(id: string) {
  const g = getGame();
  if (isIntake(id)) {
    if (!outgoing(g.water, id).length) startLaying(id);
    else toast({ en: "The water goes into the pipe here.", ja: "ここから みずが パイプに はいるよ。", icon: "pipe", tone: "info" });
    return;
  }
  const j = g.water.joints.find((x) => x.id === id);
  if (!j) return;
  const end = outgoing(g.water, id).length === 0;
  setGame({ mode: "pipe", focus: null, pipe: { kind: "edit", joint: id, notch: j.notch, end, canTurn: end && !!incoming(g.water, id), canAdd: end } });
  updateHint();
}

export async function turnPiece(step: 1 | -1) {
  const g = getGame();
  const ui = g.pipe;
  if (ui?.kind !== "edit" || !ui.canTurn) return;
  if (!known("turnIt")) {
    const said = await ask({ kind: "command", options: ["turnIt"], picture: "rotate", cancellable: true, readSentence: true });
    setGame({ mode: "pipe", pipe: ui });
    if (!said) return;
  }
  const turned = turnEnd(getGame().water, currentFlow().env, check(), ui.joint, step);
  if (!turned) return;
  if ("problem" in turned) {
    audio.play("error");
    toast({ ...PROBLEM_TEXT[turned.problem], icon: "pipe", tone: "warn" });
    return;
  }
  rt.partT0.set(`joint:${ui.joint}`, rt.time);
  audio.play("rotate");
  setGame({ water: turned.net });
  save();
}

/** Take off the piece that ends at this post (its pole comes back). */
export function takeOffPiece() {
  const g = getGame();
  const ui = g.pipe;
  if (ui?.kind !== "edit") return;
  const pipe = incoming(g.water, ui.joint);
  if (!pipe) return;
  const removed = removePipe(g.water, pipe.id);
  if (!removed) return;
  giveBack(removed.kind);
  audio.play("wood");
  floatText(`+1 ${ITEMS[removed.kind === "long" ? "pole" : "shortPole"].en}`, rt.player.x, rt.player.y + 2, rt.player.z);
  const still = removed.net.joints.find((j) => j.id === ui.joint);
  setGame({ water: removed.net });
  if (still) setGame({ pipe: { ...ui, end: outgoing(removed.net, ui.joint).length === 0, canTurn: false, canAdd: outgoing(removed.net, ui.joint).length === 0 } });
  else stopPipe();
  refreshQuest();
  save();
}

export function addFromJoint() {
  const ui = getGame().pipe;
  if (ui?.kind !== "edit" || !ui.canAdd) return;
  startLaying(ui.joint);
}

// --------------------------------------------------------------- containers

/** E at the bucket or the tank: take water, move it left or right, or carry the tank (with Kai). */
export async function useContainer(id: string) {
  const b = getGame().buildings.find((x) => x.id === id);
  if (!b || !isContainer(b.type)) return;
  const type: ContainerType = b.type;
  const options: PhraseId[] = [];
  if ((b.water ?? 0) >= 1 && count(getGame().bag, "container") > 0) options.push("getWater");
  options.push("moveLeft", "moveRight");
  if (b.type === "tank") options.push("carryTank");
  const said = await ask({ kind: "choice", options, picture: type === "tank" ? "tank" : "bucket", cancellable: true });
  if (!said) return;
  if (said === "carryTank") return carry(id);
  if (said === "getWater") return waterFrom(id);
  // Left and right as the student sees it: along the camera's right.
  const yaw = rt.camera.yaw;
  const sign = said === "moveLeft" ? -1 : 1;
  const nx = b.x + Math.cos(yaw) * 0.4 * sign;
  const nz = b.z - Math.sin(yaw) * 0.4 * sign;
  const others = getGame().buildings.filter((x) => x.id !== id);
  const problem = placeProblem(type, nx, nz, [STATIC_OBSTACLES, buildingObstacles(others), worldPropObstacles()], [{ x: rt.player.x, z: rt.player.z, r: 0.25 }], currentGates());
  const onPost = getGame().water.joints.some((j) => Math.hypot(j.x - nx, j.z - nz) < CONTAINER_SPECS[type].radius + 0.14);
  if (problem || onPost) {
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

async function waterFrom(id: string) {
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
  floatText("+1 water", b.x, groundY(b.x, b.z) + 1.2, b.z);
  refreshQuest();
}

// -------------------------------------------------------------------- ticks

let syncT = 0;
/** A pipe pours (with its water arrived) within camp reach. */
let pourAtCamp = false;
export const pipeAtCamp = () => pourAtCamp;
let scene: Promise<void> | null = null;

/** Live play only: arriving on the shelf, Kai's walks, water arriving and filling containers, the big moments. */
export function tickChapterThree(dt: number) {
  const g = getGame();
  if (!g.reachedUpper && g.quest.day >= 9 && onUpperStream(rt.player.x, rt.player.z)) {
    setGame({ reachedUpper: true });
    toast({ en: "The Upper Stream!", ja: "たきの うえの ながれ！", icon: "waterfall", tone: "good" });
    refreshQuest();
    if (g.mode === "explore") void arrivalLine();
  }
  // Kai's walk to the shelf ends at his waiting spot.
  if (g.kaiStage === "upper" && !rt.kai.route.length && !rt.kai.walkTo && !g.carry && Math.hypot(rt.kai.x - KAI_UPPER.x, rt.kai.z - KAI_UPPER.z) > 30) {
    rt.kai.x = KAI_UPPER.x;
    rt.kai.z = KAI_UPPER.z;
  }
  framePipe();
  const { flow } = currentFlow();
  updateArrivals(flow);

  // Containers fill once the water has arrived; full ones overflow.
  let buildings = g.buildings;
  let changed = false;
  for (const [id, share] of Object.entries(flow.fills)) {
    if (!arrivedInto(flow, id)) continue;
    const b = buildings.find((x) => x.id === id);
    if (!b || !isContainer(b.type)) continue;
    const cap = CONTAINER_SPECS[b.type].capacity;
    const water = b.water ?? 0;
    const next = Math.min(cap, water + dt * share);
    if (next === water) continue;
    buildings = buildings.map((x) => (x.id === id ? { ...x, water: next } : x));
    changed = true;
  }
  syncT += dt;
  if (changed && syncT > 0.25) {
    syncT = 0;
    setGame({ buildings });
  }
  const camp = flow.pours.some((p) => rt.time >= pourArrival(p.at) && atCamp(p.px, p.pz, getGame().buildings));
  if (camp !== pourAtCamp) {
    pourAtCamp = camp;
    refreshQuest();
  }
  if (!scene && getGame().mode === "explore") {
    const now = getGame();
    const bucket = now.buildings.find((b) => b.type === "bucket");
    const tank = now.buildings.find((b) => b.type === "tank" && atCamp(b.x, b.z, now.buildings));
    if (now.quest.day >= 9 && !now.bucketFilled && bucket && (bucket.water ?? 0) >= 1) scene = bucketWorks().finally(() => (scene = null));
    else if (now.quest.day >= 10 && !now.tankFilled && tank && !rt.water.tankShown && arrivedInto(flow, tank.id)) scene = waterArrives(tank.id).finally(() => (scene = null));
    else if (now.quest.day >= 10 && !now.tankFilled && tank && (tank.water ?? 0) >= CONTAINER_SPECS.tank.capacity - 0.01) scene = tankFull(tank.id).finally(() => (scene = null));
  }
}

async function arrivalLine() {
  setGame({ mode: "talk", focus: null });
  await say("self", "Wow! A waterfall! And a stream up high!", "わあ！ たきだ！ たかい ところに ながれが ある！");
  setGame({ mode: "explore" });
  updateHint();
}

/** Day 9: the first water in Kai's bucket. */
async function bucketWorks() {
  stopPipe();
  setGame({ mode: "talk", focus: null });
  const bucket = getGame().buildings.find((b) => b.type === "bucket");
  if (bucket) floatText("It works!", bucket.x, groundY(bucket.x, bucket.z) + 1.2, bucket.z);
  audio.play("fanfare");
  const kaiNear = Math.hypot(rt.kai.x - rt.player.x, rt.kai.z - rt.player.z) < 16;
  await say(kaiNear ? "kai" : "self", "Look! It works!", "みて！ うまく いった！");
  await ask({ kind: "command", options: ["flowing"], picture: "pipe", readSentence: !known("flowing") });
  setGame({ bucketFilled: true });
  refreshQuest();
  if (kaiNear) {
    setGame({ mode: "talk" });
    await say("kai", "Water goes down the pipe. Tomorrow, let's make a long pipe to our camp!", "みずは パイプを したへ ながれる。 あしたは キャンプまで ながい パイプを つくろう！");
    await say("kai", "Let's go home. The stairs are fast!", "かえろう。 かいだんが ちかみちだよ！");
  }
  setGame({ kaiStage: "camp", mode: "explore" });
  walkKaiRoute(KAI_STAIRS_ROUTE);
  updateHint();
  save();
}

/**
 * Day 10: the water reaches the tank. The camera follows the water down the
 * whole pipe from the waterfall (it runs again, quicker), then holds on the tank.
 */
async function waterArrives(tankId: string) {
  rt.water.tankShown = true;
  stopPipe();
  setGame({ mode: "busy", focus: null });
  const path = pathTo(tankId);
  if (path.length > 1) {
    const speed = WATER_SPEED * 2.4;
    const t0 = rt.time + 0.4;
    let acc = 0;
    const net = getGame().water;
    for (let i = 1; i < path.length; i++) {
      const len = Math.hypot(path[i].x - path[i - 1].x, path[i].z - path[i - 1].z);
      const pipe = net.pipes.find((p) => p.from === path[i - 1].id && p.to === path[i].id);
      if (pipe) rt.water.start.set(pipe.id, { t: t0 + acc / speed, dur: len / speed });
      acc += len;
    }
    rt.water.flyover = { t0, speed, path, total: acc };
    rt.camera.mode = "shot";
    rt.camera.shot = flyoverShot(0);
    await wait(400 + (acc / speed) * 1000 + 600);
  }
  rt.water.flyover = null;
  const tank = getGame().buildings.find((b) => b.id === tankId);
  if (tank) {
    const y = groundY(tank.x, tank.z);
    rt.camera.mode = "shot";
    rt.camera.shot = { pos: { x: tank.x + 3, y: y + 2.6, z: tank.z + 4.4 }, target: { x: tank.x, y: y + 0.7, z: tank.z } };
  }
  audio.play("sparkle");
  setGame({ mode: "talk" });
  const kaiNear = Math.hypot(rt.kai.x - (tank?.x ?? 0), rt.kai.z - (tank?.z ?? 0)) < 18;
  await say(kaiNear ? "kai" : "self", "Look! The water is coming!", "みて！ みずが きた！");
  await ask({ kind: "command", options: ["flowing"], picture: "pipe", readSentence: !known("flowing") });
  rt.camera.mode = "follow";
  rt.camera.shot = null;
  setGame({ mode: "explore" });
  updateHint();
}

/** Day 10: the tank is full. */
async function tankFull(tankId: string) {
  const tank = getGame().buildings.find((b) => b.id === tankId);
  if (!tank) return;
  if (Math.hypot(rt.player.x - tank.x, rt.player.z - tank.z) > 26) return;
  stopPipe();
  setGame({ mode: "talk", focus: null });
  audio.play("fanfare");
  floatText("Full!", tank.x, groundY(tank.x, tank.z) + 1.5, tank.z);
  await ask({ kind: "command", options: ["tankFull"], picture: "tank", readSentence: !known("tankFull") });
  setGame({ tankFilled: true });
  refreshQuest();
  setGame({ mode: "talk" });
  await say("kai", "We did it! Water at our camp, every day!", "やったね！ まいにち キャンプに みずが くる！");
  await say("kai", "Remember: boil it before you drink.", "わすれないで： のむ まえに わかそう。");
  setGame({ mode: "explore" });
  updateHint();
  save();
}

/** The joints from an intake down to the end that pours into a container. */
function pathTo(containerId: string): Array<{ id: string; x: number; z: number; y: number }> {
  const { env, flow } = currentFlow();
  const pour = flow.pours.find((p) => p.into === containerId);
  if (!pour) return [];
  const net = getGame().water;
  const out: Array<{ id: string; x: number; z: number; y: number }> = [];
  let at: string | null = pour.at;
  for (let guard = 0; at && guard < 200; guard++) {
    const n = nodeOf(net, env, at);
    if (!n) break;
    out.unshift({ id: n.id, x: n.x, z: n.z, y: n.y });
    at = incoming(net, at)?.from ?? null;
  }
  return out;
}

/** The camera beside the water's front, s seconds into the flyover. */
export function flyoverShot(s: number) {
  const f = rt.water.flyover;
  if (!f) return null;
  let d = Math.max(0, Math.min(f.total, s * f.speed));
  let i = 1;
  for (; i < f.path.length; i++) {
    const len = Math.hypot(f.path[i].x - f.path[i - 1].x, f.path[i].z - f.path[i - 1].z);
    if (d <= len || i === f.path.length - 1) break;
    d -= len;
  }
  const a = f.path[i - 1];
  const b = f.path[Math.min(i, f.path.length - 1)];
  const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
  const t = Math.min(1, d / len);
  const x = a.x + (b.x - a.x) * t;
  const z = a.z + (b.z - a.z) * t;
  const y = a.y + (b.y - a.y) * t;
  // Behind and to the side of the front, looking along the water.
  const ux = (b.x - a.x) / len;
  const uz = (b.z - a.z) / len;
  return { pos: { x: x - ux * 4.5 - uz * 2.5, y: y + 3.2, z: z - uz * 4.5 + ux * 2.5 }, target: { x: x + ux * 1.5, y: y - 0.2, z: z + uz * 1.5 } };
}

/** The flyover camera follows the water (called every frame by the camera rig). */
export function frameFlyover() {
  const f = rt.water.flyover;
  if (!f || rt.camera.mode !== "shot") return;
  const shot = flyoverShot(rt.time - f.t0);
  if (shot) rt.camera.shot = shot;
}

// ------------------------------------------------------------ restore/start

/** After loading a save: Kai on the shelf, fresh water timings, the scenes not yet replayed. */
export function restoreChapterThree() {
  const g = getGame();
  rt.water.start.clear();
  rt.water.flyover = null;
  rt.water.tankShown = g.tankFilled;
  pourAtCamp = false;
  cache = null;
  if (g.kaiStage === "upper") {
    rt.kai.x = KAI_UPPER.x;
    rt.kai.z = KAI_UPPER.z;
    rt.kai.route = [];
  }
}

