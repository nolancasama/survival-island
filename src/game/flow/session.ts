import { getGame, setGame, freshGameData, toast, type HintKey } from "../store";
import { rt, resetRuntime } from "../runtime";
import { evaluate, newlyDone, currentStep, dayDef, type Facts, type QuestState } from "../logic/quest";
import { tickStats, afterFaint, RUN_AGAIN_AT, type Stats } from "../logic/stats";
import { SAVE_KEY, SAVE_VERSION, parseSave, serialize, type SaveData } from "../logic/save";
import { NODE_BY_ID, KAI_HOME, NODES } from "../world/island";
import { resolveCollisions, PLAYER_R, STATIC_OBSTACLES } from "../world/collision";
import { buildingObstacles } from "../world/placement";
import { count } from "../logic/inventory";
import { ask, fastMode, say } from "./ask";
import { audio } from "../../audio/audio";
import { tts } from "../../audio/tts";
import { recognition, requestMicPermission } from "../../audio/recognition";
import type { NodeKind } from "../types";

/** Story light per number of finished Day 1 steps (midday -> golden hour). */
const LIGHT_STEPS = [0.95, 0.88, 0.8, 0.72, 0.64, 0.56, 0.48];
const NIGHT_WITH_FIRE = 0.14;

export const wait = (ms: number) => new Promise<void>((r) => window.setTimeout(r, fastMode() ? Math.min(ms, 40) : ms));

function lightFor(q: QuestState): number {
  if (q.complete) return NIGHT_WITH_FIRE;
  return LIGHT_STEPS[Math.min(q.done.length, LIGHT_STEPS.length - 1)];
}

// ------------------------------------------------------------------ save

export function hasSaved(): boolean {
  try {
    return parseSave(localStorage.getItem(SAVE_KEY)) !== null;
  } catch {
    return false;
  }
}

export function save() {
  const g = getGame();
  if (g.screen === "title") return;
  const taken: Record<string, number> = {};
  for (const [id, left] of rt.taken) taken[id] = Math.round(left);
  const data: SaveData = {
    v: SAVE_VERSION,
    savedAt: Date.now(),
    quest: g.quest,
    bag: g.bag,
    stats: { ...rt.stats },
    known: g.known,
    unlocked: g.unlocked,
    crafted: g.crafted,
    buildings: g.buildings,
    taken,
    crateOpened: g.crateOpened,
    metKai: g.metKai,
    ate: g.ate,
    kai: g.kai,
    player: { x: rt.player.x, z: rt.player.z, yaw: rt.player.yaw },
    light: rt.lightTarget,
    said: g.said
  };
  try {
    localStorage.setItem(SAVE_KEY, serialize(data));
  } catch {
    /* storage blocked: the game still plays */
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* ignore */
  }
  setGame({ hasSave: false });
}

// ---------------------------------------------------------------- startup

async function prepareMic() {
  const g = getGame();
  if (!recognition.supported) {
    setGame({ micState: "unsupported" });
    return;
  }
  if (!g.settings.mic || g.micState === "ready") return;
  const r = await requestMicPermission(8000);
  setGame({ micState: r === "granted" || r === "timeout" ? "ready" : "blocked" });
  if (r === "denied" || r === "unavailable") setGame({ hint: "micBlocked" });
}

function startAudio() {
  audio.unlock();
  const s = getGame().settings;
  audio.setVolumes(s.music, s.sfx);
  audio.startAmbience();
  audio.startMusic("day");
  tts.setRate(s.slowVoice ? 0.8 : 1);
}

function enterGame() {
  setGame({ screen: "game", focus: null, prompt: null, line: null, craftOpen: false, placing: null, selected: null, toasts: [] });
}

/** Start button (a user gesture: audio and the mic prompt are allowed here). */
export async function newGame() {
  startAudio();
  clearSave();
  resetRuntime();
  setGame({ ...freshGameData(), hint: null, needsPulse: false, craftPulse: false, fade: 1, mode: "busy" });
  enterGame();
  rt.player.lying = rt.player.lyingTarget = 1;
  await prepareMic();
  await intro();
}

export async function continueGame() {
  const data = (() => {
    try {
      return parseSave(localStorage.getItem(SAVE_KEY));
    } catch {
      return null;
    }
  })();
  if (!data) return newGame();
  startAudio();
  resetRuntime();
  setGame({
    ...freshGameData(),
    quest: data.quest,
    bag: data.bag,
    known: data.known,
    said: data.said,
    unlocked: data.unlocked,
    crafted: data.crafted,
    buildings: data.buildings,
    crateOpened: data.crateOpened,
    metKai: data.metKai,
    ate: data.ate,
    kai: data.kai,
    stats: roundStats(data.stats),
    fade: 0,
    mode: "explore",
    hint: null
  });
  rt.stats = { ...data.stats };
  rt.player.x = data.player.x;
  rt.player.z = data.player.z;
  rt.player.yaw = data.player.yaw;
  rt.camera.yaw = data.player.yaw + Math.PI;
  rt.camera.snap = true;
  rt.walked = 99;
  for (const [id, left] of Object.entries(data.taken)) if (NODE_BY_ID.has(id)) rt.taken.set(id, left);
  for (const b of data.buildings) if (b.lit) rt.fireT0.set(b.id, -10);
  rt.light = rt.lightTarget = data.quest.complete ? NIGHT_WITH_FIRE : data.light;
  if (data.metKai && !data.unlocked.includes("campfire")) setGame({ unlocked: ["campfire"] });
  if (data.quest.complete) placeKaiAtFire();
  enterGame();
  updateHint();
  await prepareMic();
}

export function toTitle() {
  save();
  tts.cancel();
  audio.stopFire();
  setGame({ screen: "title", settingsOpen: false, mode: "busy", prompt: null, line: null, craftOpen: false, placing: null, hasSave: hasSaved(), toasts: [] });
}

// ------------------------------------------------------------------ intro

async function intro() {
  rt.camera.yaw = 0.35;
  rt.camera.pitch = 0.55;
  rt.camera.snap = true;
  await wait(200);
  setGame({ fade: 0 });
  await wait(1500);
  rt.player.lyingTarget = 0;
  await wait(1000);
  await say("self", "Where am I?", "ここは どこ？");
  await say("game", "A storm broke your ship. You are on an island!", "あらしで ふねが こわれて、しまに ながれついた！");
  await ask({
    kind: "command",
    options: ["hungry"],
    picture: "tummy",
    question: { en: "Grrr… How do you feel?", ja: "おなかが グーッ。どんな きもち？", by: "game" },
    readSentence: true
  });
  setGame({ mode: "explore" });
  showBeacons("coconut");
  updateHint();
}

// -------------------------------------------------------------- beacons

/** Light up the nearest available nodes of a kind ("I need ___"). */
export function showBeacons(kind: NodeKind, n = 2): boolean {
  const p = rt.player;
  const avail = NODES.filter((x) => x.kind === kind && !rt.taken.has(x.id))
    .sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))
    .slice(0, n);
  if (!avail.length) {
    toast({ en: "None now. Wait a little!", ja: "いまは ないよ。すこし まってね。", icon: kind, tone: "info" });
    return false;
  }
  rt.beacons = { ids: avail.map((x) => x.id), until: rt.time + 14 };
  audio.play("ping");
  return true;
}

// ------------------------------------------------------------------ quest

export function facts(): Facts {
  const g = getGame();
  return {
    ate: g.ate,
    metKai: g.metKai,
    bag: g.bag,
    crafted: g.crafted,
    placed: g.buildings.map((b) => b.type),
    litFires: g.buildings.filter((b) => b.lit).length
  };
}

/** Re-check the story after anything changed. */
export function refreshQuest() {
  const g = getGame();
  const q = evaluate(g.quest, facts());
  if (q !== g.quest) {
    const added = newlyDone(g.quest, q);
    setGame({ quest: q });
    const day = dayDef(q.day);
    for (const id of added) {
      const step = day.steps.find((s) => s.id === id);
      if (step) toast({ en: `✓ ${step.en}`, ja: step.ja, tone: "good" });
    }
    if (added.length) audio.play("sparkle");
    rt.lightTarget = lightFor(q);
    if (q.complete && !g.quest.complete) void celebrate();
  }
  const craftable = g.unlocked.includes("campfire") && !g.crafted.includes("campfire") && count(g.bag, "wood") >= 3 && count(g.bag, "stone") >= 2;
  if (craftable && !getGame().craftPulse && !getGame().quest.done.includes("craft")) setGame({ craftPulse: true });
  updateHint();
  save();
}

export function updateHint() {
  const g = getGame();
  if (g.hint === "micBlocked") return;
  let hint: HintKey = null;
  const step = currentStep(g.quest);
  if (rt.walked < 4 && g.mode === "explore") hint = "move";
  else if (g.mode === "place") hint = null; // the place bar explains itself
  else if (step) {
    switch (step.id) {
      case "eat":
        hint = count(g.bag, "coconut") > 0 ? "eat" : "coconut";
        break;
      case "kai":
        hint = "kai";
        break;
      case "wood":
      case "stone":
        hint = g.metKai ? "gather" : "kai";
        break;
      case "craft":
        hint = "craft";
        break;
      case "place":
        hint = "place";
        break;
      case "light":
        hint = "light";
        break;
    }
  }
  if (hint !== g.hint) setGame({ hint });
}

// ------------------------------------------------------------ simulation

const roundStats = (s: Stats): Stats => ({ hp: Math.round(s.hp), stamina: Math.round(s.stamina), food: Math.round(s.food) });
let mirrorT = 0;
let saveT = 0;

export function litFireNear(x: number, z: number, r: number): boolean {
  return getGame().buildings.some((b) => b.lit && Math.hypot(b.x - x, b.z - z) < r);
}

/** Called every frame by the scene. */
export function tick(dt: number) {
  const g = getGame();
  if (g.screen === "title") return;
  rt.light += (rt.lightTarget - rt.light) * Math.min(1, dt * 0.4);
  audio.setDaylight(rt.light);
  const live = g.screen === "game" && (g.mode === "explore" || g.mode === "place") && !g.settingsOpen;
  if (!live) return;
  rt.simTime += dt;

  // Resources grow back, but never right in front of the player.
  for (const [id, left] of rt.taken) {
    const l = left - dt;
    if (l > 0) {
      rt.taken.set(id, l);
      continue;
    }
    const n = NODE_BY_ID.get(id);
    if (!n || Math.hypot(n.x - rt.player.x, n.z - rt.player.z) > 7) {
      rt.taken.delete(id);
      rt.regrown.set(id, rt.time);
    } else {
      rt.taken.set(id, 0);
    }
  }

  const p = rt.player;
  const moving = p.speed > 0.4;
  const { stats, events } = tickStats(rt.stats, { dt, moving, running: moving && p.running, nearFire: litFireNear(p.x, p.z, 3.5) });
  rt.stats = stats;
  if (stats.stamina <= 0.5) p.exhausted = true;
  else if (p.exhausted && stats.stamina >= RUN_AGAIN_AT) p.exhausted = false;

  for (const e of events) {
    if (e === "hungry") {
      setGame({ needsPulse: true });
      toast({ en: "I'm hungry…", ja: "おなかが すいた… Q で「I'm hungry.」", icon: "tummy", tone: "warn" }, 4000);
    } else if (e === "starving") {
      toast({ en: "Eat something! Your HP is going down.", ja: "なにか たべよう！ HP が へっているよ", icon: "heart", tone: "warn" }, 4500);
    } else if (e === "faint") {
      void faint();
    }
  }

  mirrorT += dt;
  if (mirrorT > 0.25) {
    mirrorT = 0;
    const r = roundStats(stats);
    const s = g.stats;
    if (r.hp !== s.hp || r.stamina !== s.stamina || r.food !== s.food) setGame({ stats: r });
    if (g.hint === "move" && rt.walked >= 4) updateHint();
  }
  saveT += dt;
  if (saveT > 15) {
    saveT = 0;
    save();
  }
}

/** Push the rounded stats to the HUD now (after eating etc.). */
export function syncStats() {
  setGame({ stats: roundStats(rt.stats) });
}

// ----------------------------------------------------------- faint, win

async function faint() {
  setGame({ mode: "busy", focus: null });
  audio.play("faint");
  rt.player.lyingTarget = 1;
  await wait(1300);
  setGame({ fade: 1 });
  await wait(800);
  const fire = getGame().buildings.find((b) => b.lit);
  const home = fire ? { x: fire.x + 1.6, z: fire.z + 1.2 } : { x: KAI_HOME.x + 1.4, z: KAI_HOME.z + 1.8 };
  const at = resolveCollisions(home.x, home.z, PLAYER_R, [STATIC_OBSTACLES, buildingObstacles(getGame().buildings)]);
  rt.player.x = at.x;
  rt.player.z = at.z;
  rt.stats = afterFaint();
  syncStats();
  rt.camera.snap = true;
  rt.lightTarget = Math.max(NIGHT_WITH_FIRE, rt.lightTarget - 0.04); // a little time has passed
  setGame({ fade: 0 });
  await wait(700);
  await say("game", "You fainted. Kai helped you.", "たおれて しまった。 カイが たすけて くれたよ。");
  await say("kai", "Eat coconuts. Then you feel good!", "ココナッツを たべてね。 げんきに なるよ！");
  rt.player.lyingTarget = 0;
  await wait(600);
  setGame({ mode: "explore" });
  save();
}

function placeKaiAtFire() {
  const fire = getGame().buildings.find((b) => b.lit);
  if (!fire) return;
  const spot = resolveCollisions(fire.x - 1.8, fire.z - 0.6, 0.4, [STATIC_OBSTACLES, buildingObstacles(getGame().buildings)]);
  rt.kai.x = spot.x;
  rt.kai.z = spot.z;
  rt.kai.yaw = Math.atan2(fire.x - spot.x, fire.z - spot.z);
}

async function celebrate() {
  setGame({ mode: "busy", focus: null });
  const fire = getGame().buildings.find((b) => b.lit);
  rt.celebrateT0 = rt.time;
  audio.play("fanfare");
  audio.startMusic("dusk");
  rt.lightTarget = NIGHT_WITH_FIRE;
  if (fire) {
    // Camera from the sea side, looking up the beach at the fire.
    rt.camera.mode = "shot";
    rt.camera.shot = { pos: { x: fire.x + 3.2, y: 3.4, z: fire.z + 7.2 }, target: { x: fire.x - 0.4, y: 0.9, z: fire.z } };
    const spot = resolveCollisions(fire.x - 1.8, fire.z - 0.6, 0.4, [STATIC_OBSTACLES, buildingObstacles(getGame().buildings)]);
    rt.kai.walkTo = { x: spot.x, z: spot.z, face: { x: fire.x, z: fire.z } };
    const p = rt.player;
    p.yaw = Math.atan2(fire.x - p.x, fire.z - p.z);
  }
  await wait(3200);
  if (!fastMode()) {
    // Give Kai time to arrive (he walks across the beach).
    for (let i = 0; i < 40 && rt.kai.walkTo; i++) await wait(200);
  }
  if (rt.kai.walkTo) placeKaiAtFire();
  rt.kai.walkTo = null;
  await say("kai", "You can make a fire! Great job!", "火を つけられたね！ すごい！");
  await say("kai", "Let's rest. Tomorrow, we go to the forest!", "きょうは やすもう。 あしたは もりへ いこう！");
  rt.camera.mode = "follow";
  rt.camera.shot = null;
  setGame({ screen: "dayEnd", mode: "busy" });
  save();
}

/** "Keep playing" on the day-end card. */
export function keepPlaying() {
  setGame({ screen: "game", mode: "explore" });
  updateHint();
}
