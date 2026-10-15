import { getGame, setGame, freshGameData, toast, type HintKey } from "../store";
import { rt, resetRuntime } from "../runtime";
import { evaluate, newlyDone, currentStep, dayDef, readyToSleep, isStoryDay, type Facts } from "../logic/quest";
import { tickStats, afterFaint, RUN_AGAIN_AT, type Stats } from "../logic/stats";
import { advanceClock, storyFloor, lightAt, isNight, faintPenalty, CAP } from "../logic/clock";
import { SAVE_KEY, V2_SAVE_KEY, V1_SAVE_KEY, SAVE_VERSION, loadSaveText, serialize, type SaveData } from "../logic/save";
import { checkCraft } from "../logic/crafting";
import { pace, recipeNeeds } from "../logic/pace";
import { NODE_BY_ID, NODES, FALLEN_TREE, FISH_SPOTS, WATER_SPOTS, BRIDGE, CRATE } from "../world/island";
import { CAVE_BOX, CAVE_OUTSIDE } from "../world/phase3";
import { resolveCollisions, PLAYER_R, STATIC_OBSTACLES } from "../world/collision";
import { buildingObstacles } from "../world/placement";
import { count } from "../logic/inventory";
import { ask, fastMode, say } from "./ask";
import { currentGates, targetReachable } from "./places";
import { celebrate, eveningCue, nextDay, placeKaiAtCamp, resumeDayFourMorning, sleepPlace } from "./days";
import { checkCaveExit } from "./cave";
import { audio } from "../../audio/audio";
import { tts } from "../../audio/tts";
import { recognition, requestMicPermission } from "../../audio/recognition";
import { NODE_YIELD, type CraftId, type ItemId, type NodeKind } from "../types";

export const wait = (ms: number) => new Promise<void>((r) => window.setTimeout(r, fastMode() ? Math.min(ms, 40) : ms));

// ------------------------------------------------------------------ save

export function hasSaved(): boolean {
  try {
    return loadSaveText(localStorage.getItem(SAVE_KEY), localStorage.getItem(V2_SAVE_KEY), localStorage.getItem(V1_SAVE_KEY)) !== null;
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
    player: g.inCave ? { ...CAVE_OUTSIDE } : { x: rt.player.x, z: rt.player.z, yaw: rt.player.yaw },
    light: rt.lightTarget,
    said: g.said,
    daySaid: g.daySaid,
    dayNew: g.dayNew,
    t: Math.max(0, Math.min(1, rt.clock)),
    pathCleared: g.pathCleared,
    bridgeBuilt: g.bridgeBuilt,
    gotWater: g.gotWater,
    drank: g.drank,
    caught: g.caught,
    cooked: g.cooked,
    sleptDay: g.sleptDay,
    enteredCave: g.enteredCave,
    caveBoxOpened: g.caveBoxOpened,
    cliffOpen: g.cliffOpen,
    reachedClifftop: g.reachedClifftop,
    signalLit: g.signalLit,
    rescued: g.rescued,
    kaiStage: g.kaiStage
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
  setMood(moodAt(rt.clock), true);
  tts.setRate(s.slowVoice ? 0.8 : 1);
}

function enterGame() {
  setGame({ screen: "game", focus: null, prompt: null, line: null, craftOpen: false, placing: null, selected: null, toasts: [], dayTitle: null, sleeping: false });
}

/** Start button (a user gesture: audio and the mic prompt are allowed here). */
export async function newGame() {
  clearSave();
  resetRuntime();
  startAudio();
  setGame({ ...freshGameData(), hint: null, needsPulse: false, craftPulse: false, fade: 1, mode: "busy" });
  enterGame();
  rt.player.lying = rt.player.lyingTarget = 1;
  await prepareMic();
  await intro();
}

export async function continueGame() {
  const data = (() => {
    try {
      return loadSaveText(localStorage.getItem(SAVE_KEY), localStorage.getItem(V2_SAVE_KEY), localStorage.getItem(V1_SAVE_KEY));
    } catch {
      return null;
    }
  })();
  if (!data) return newGame();
  resetRuntime();
  // The clock is restored as saved: resuming in the evening or at night never jumps to daylight.
  rt.clock = data.t;
  rt.light = rt.lightTarget = lightAt(data.t);
  startAudio();
  setGame({
    ...freshGameData(),
    quest: data.quest,
    bag: data.bag,
    known: data.known,
    said: data.said,
    daySaid: data.daySaid ?? [],
    dayNew: data.dayNew ?? [],
    unlocked: data.unlocked,
    crafted: data.crafted,
    buildings: data.buildings,
    crateOpened: data.crateOpened,
    metKai: data.metKai,
    ate: data.ate,
    kai: data.kai,
    pathCleared: data.pathCleared,
    bridgeBuilt: data.bridgeBuilt,
    gotWater: data.gotWater,
    drank: data.drank,
    caught: data.caught,
    cooked: data.cooked,
    sleptDay: data.sleptDay,
    enteredCave: data.enteredCave,
    caveBoxOpened: data.caveBoxOpened,
    cliffOpen: data.cliffOpen,
    reachedClifftop: data.reachedClifftop,
    signalLit: data.signalLit,
    rescued: data.rescued,
    kaiStage: data.kaiStage,
    t: data.t,
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
  for (const [id, left] of Object.entries(data.taken)) {
    if (NODE_BY_ID.has(id) || FISH_SPOTS.some((spot) => spot.id === id)) rt.taken.set(id, left);
  }
  for (const b of data.buildings) if (b.lit) rt.fireT0.set(b.id, -10);
  if (data.metKai && !data.unlocked.includes("campfire")) setGame({ unlocked: ["campfire", ...data.unlocked] });
  // The evening cue has already played for a day that is waiting for sleep.
  if (readyToSleep(data.quest)) rt.eveningDay = data.quest.day;
  if (data.quest.day > 1 || readyToSleep(data.quest)) placeKaiAtCamp();
  enterGame();
  updateHint();
  // A day that ended with sleep (the card was showing) goes straight on to the next morning.
  if (data.sleptDay >= data.quest.day) {
    setGame({ mode: "busy" });
    void nextDay();
    return;
  }
  // Keep controls paused while an unfinished morning waits for microphone preparation.
  const needsMorning = data.quest.day === 4 && (getGame().kai.canTorch === undefined || !getGame().unlocked.includes("torch"));
  if (needsMorning) setGame({ mode: "busy" });
  await prepareMic();
  if (needsMorning) {
    await resumeDayFourMorning();
  }
}

export function toTitle() {
  save();
  tts.cancel();
  audio.stopFire();
  setGame({ screen: "title", settingsOpen: false, mode: "busy", prompt: null, line: null, craftOpen: false, placing: null, hasSave: hasSaved(), toasts: [], dayTitle: null, sleeping: false });
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

const BEACON_S = 14;

/** Light up places by id (nodes, the fallen tree, the bridge, water, buildings). */
export function showPlaces(ids: string[]) {
  if (!ids.length) return;
  rt.beacons = { ids: ids.slice(0, 3), until: rt.time + BEACON_S };
  audio.play("ping");
}

/**
 * Light up the nearest reachable nodes of a kind ("I need ___"). When every
 * one of them is behind a closed gate, the gate is lit instead (the fallen
 * palm for the forest, the bridge for the pond), so the help always shows the
 * way to what was asked for.
 */
export function showBeacons(kind: NodeKind | NodeKind[], n = 2): boolean {
  const kinds = Array.isArray(kind) ? kind : [kind];
  const gates = currentGates();
  const p = rt.player;
  const avail = NODES.filter((x) => kinds.includes(x.kind) && !rt.taken.has(x.id) && targetReachable(x.id, gates))
    .sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))
    .slice(0, n);
  if (avail.length) {
    showPlaces(avail.map((x) => x.id));
    return true;
  }
  const behindGate = NODES.some((x) => kinds.includes(x.kind) && !targetReachable(x.id, gates));
  if (!getGame().inCave && behindGate && !gates.pathCleared) {
    showPlaces([FALLEN_TREE.id]);
    return true;
  }
  if (!getGame().inCave && kinds.includes("metal")) {
    showPlaces(["caveMouth"]);
    return true;
  }
  if (getGame().inCave && behindGate && !kinds.includes("metal")) {
    showPlaces(["caveExit"]);
    return true;
  }
  toast({ en: "None now. Wait a little!", ja: "いまは ないよ。すこし まってね。", icon: NODE_YIELD[kinds[0]].item, tone: "info" });
  return false;
}

/** Automatic help uses the same reachable places and resource beacons as voluntary help. */
export function showStepTarget(): boolean {
  const g = getGame();
  const step = currentStep(g.quest);
  if (!step) return false;
  const point = (ids: string[]) => {
    if (!ids.length) return false;
    if (g.inCave && ids.some((id) => !targetReachable(id))) showPlaces(["caveExit"]);
    else if (!g.pathCleared && ids.some((id) => !targetReachable(id))) showPlaces([FALLEN_TREE.id]);
    else if (!g.bridgeBuilt && ids.some((id) => !targetReachable(id))) showPlaces([BRIDGE.id]);
    else showPlaces(ids);
    return true;
  };
  const recipes: Partial<Record<string, CraftId>> = {
    craft: "campfire", axe: "axe", shelter: "shelter", container: "container", rod: "rod", torch: "torch", signalFire: "signalFire"
  };
  const recipe = recipes[step.id];
  if (recipe) {
    if (!g.unlocked.includes(recipe)) return point(["kai"]);
    const needs = recipeNeeds(recipe, g.settings.classroom);
    for (const item of Object.keys(needs) as ItemId[]) {
      if (count(g.bag, item) >= needs[item]!) continue;
      if (item === "rope") return point([CRATE.id]);
      if (item === "wood") return showBeacons(count(g.bag, "axe") > 0 ? ["wood", "tree"] : "wood");
      if (item === "stone" || item === "leaves" || item === "coconut" || item === "metal") return showBeacons(item);
    }
    // Ready-to-craft actions live in the UI, so pulse that target instead of a world place.
    setGame({ craftPulse: true });
    return true;
  }
  switch (step.id) {
    case "eat":
      if (count(g.bag, "coconut") === 0) return showBeacons("coconut");
      setGame({ needsPulse: true });
      return true;
    case "kai":
      return point(["kai"]);
    case "wood":
      return showBeacons(count(g.bag, "axe") > 0 ? ["wood", "tree"] : "wood");
    case "stone":
    case "leaves":
    case "metal":
      return showBeacons(step.id);
    case "path":
      return point([FALLEN_TREE.id]);
    case "bridge":
      return count(g.bag, "wood") < pace(g.settings.classroom).bridgeNeeds.wood! ? showBeacons(["wood", "tree"]) : point([BRIDGE.id]);
    case "place":
      setGame({ selected: "campfire" });
      return true;
    case "build": {
      const shelter = g.buildings.find((b) => b.type === "shelter" && !b.built);
      if (shelter) return point([shelter.id]);
      setGame({ selected: "shelter" });
      return true;
    }
    case "light":
    case "cook":
      return point(g.buildings.filter((b) => b.type === "campfire").map((b) => b.id));
    case "water":
    case "drink":
      if (step.id === "drink" && count(g.bag, "water") > 0) {
        setGame({ selected: "water" });
        return true;
      }
      return point(WATER_SPOTS.map((s) => s.id));
    case "fish":
      return point(FISH_SPOTS.map((s) => s.id));
    case "cave":
      return point(["caveMouth"]);
    case "radio":
      return g.inCave ? point([CAVE_BOX.id]) : point(["caveMouth"]);
    case "showKai":
      return point(["kai"]);
    case "sleep": {
      const bed = sleepPlace();
      return bed ? point([bed.id]) : false;
    }
    default:
      return false;
  }
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
    litFires: g.buildings.filter((b) => b.lit).length,
    pathCleared: g.pathCleared,
    bridgeBuilt: g.bridgeBuilt,
    builtShelters: g.buildings.filter((b) => b.type === "shelter" && b.built).length,
    gotWater: g.gotWater,
    drank: g.drank,
    caught: g.caught,
    cooked: g.cooked,
    sleptDay: g.sleptDay,
    enteredCave: g.enteredCave,
    caveBoxOpened: g.caveBoxOpened,
    kaiHave: g.kai.have,
    cliffOpen: g.cliffOpen,
    reachedClifftop: g.reachedClifftop,
    signalLit: g.signalLit,
    rescued: g.rescued,
    classroom: g.settings.classroom
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
      if (step && step.id !== "sleep") toast({ en: `✓ ${step.en}`, ja: step.ja, tone: "good" });
    }
    if (added.length) {
      audio.play("sparkle");
      rt.stepIdleSeconds = 0;
      rt.lastAutomaticHintAt = rt.simTime;
    }
    // Each finished step pushes the sun on (it never waits past golden hour).
    if (!g.inCave) rt.clock = Math.max(rt.clock, storyFloor(q.done.length, day.steps.length));
    if (readyToSleep(q) && !readyToSleep(g.quest) && rt.eveningDay !== q.day) {
      if (q.day === 1) void celebrate();
      else void eveningCue();
    }
  }
  const now = getGame();
  const craftable = now.unlocked.some((id) => !now.crafted.includes(id) && checkCraft(now.bag, id, now.unlocked, now.settings.classroom) === "ok");
  if (craftable && !now.craftPulse) setGame({ craftPulse: true });
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
        if (g.quest.day === 1) hint = g.metKai ? "gather" : "kai";
        else hint = "wood2";
        break;
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
      case "axe":
        hint = "axe";
        break;
      case "path":
        hint = "path";
        break;
      case "leaves":
        hint = "leaves";
        break;
      case "shelter":
        hint = "shelter";
        break;
      case "build":
        hint = g.buildings.some((b) => b.type === "shelter") ? "build" : "placeShelter";
        break;
      case "sleep":
        hint = "sleep";
        break;
      case "bridge":
      case "container":
      case "water":
      case "drink":
      case "rod":
      case "fish":
      case "cook":
      case "torch":
      case "cave":
      case "metal":
      case "radio":
      case "showKai":
        hint = step.id;
        break;
    }
  }
  if (hint !== g.hint) setGame({ hint });
}

// ------------------------------------------------------------ simulation

const roundStats = (s: Stats): Stats => ({ hp: Math.round(s.hp), stamina: Math.round(s.stamina), food: Math.round(s.food) });
let mirrorT = 0;
let saveT = 0;
let mood: "day" | "dusk" | "night" | null = null;

export function litFireNear(x: number, z: number, r: number): boolean {
  return getGame().buildings.some((b) => b.lit && Math.hypot(b.x - x, b.z - z) < r);
}

/** A finished shelter within r metres (it warms like a fire by day). */
export function builtShelterNear(x: number, z: number, r: number): boolean {
  return getGame().buildings.some((b) => b.type === "shelter" && b.built && Math.hypot(b.x - x, b.z - z) < r);
}

/** Music for a time of day: the tune slows at golden hour and goes quiet at night. */
function moodAt(t: number): "day" | "dusk" | "night" {
  return isNight(t) ? "night" : t >= CAP ? "dusk" : "day";
}

export function setMood(next: "day" | "dusk" | "night", force = false) {
  if (next === mood && !force) return;
  mood = next;
  audio.startMusic(next);
}

/** The sun waits on a story day until only Sleep is left. */
export function clockCapped(): boolean {
  const q = getGame().quest;
  return isStoryDay(q.day) && !readyToSleep(q);
}

/** Called every frame by the scene. */
export function tick(dt: number) {
  const g = getGame();
  if (g.screen === "title") return;
  rt.lightTarget = lightAt(rt.clock);
  rt.light += (rt.lightTarget - rt.light) * Math.min(1, dt * 0.4);
  audio.setDaylight(rt.light);
  const live = g.screen === "game" && (g.mode === "explore" || g.mode === "place") && !g.settingsOpen;
  if (!live) return;
  rt.simTime += dt;
  rt.stepIdleSeconds += dt;
  const gamePace = pace(g.settings.classroom);
  if (!g.inCave) rt.clock = advanceClock(rt.clock, dt, { capped: clockCapped() }, gamePace.daySeconds, gamePace.eveningSeconds);
  setMood(moodAt(rt.clock));
  checkCaveExit();
  const hintDelay = gamePace.automaticHintDelay;
  if (hintDelay !== null && rt.stepIdleSeconds >= hintDelay && rt.simTime - rt.lastAutomaticHintAt >= hintDelay
    && g.mode === "explore" && !g.prompt && !g.line && !g.craftOpen && !g.placing && !g.sleeping && getGame().mode === "explore") {
    rt.lastAutomaticHintAt = rt.simTime;
    if (showStepTarget()) rt.automaticHintCount++;
  }

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
  const { stats, events } = tickStats(rt.stats, {
    dt,
    moving,
    running: moving && p.running,
    nearFire: litFireNear(p.x, p.z, 3.5),
    night: isNight(rt.clock),
    nearShelter: builtShelterNear(p.x, p.z, 3.5),
    foodMultiplier: gamePace.foodDrainMultiplier
  });
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
    const t = Math.round(rt.clock * 1000) / 1000;
    if (t !== g.t) setGame({ t });
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

// ------------------------------------------------------------------ faint

async function faint() {
  setGame({ mode: "busy", focus: null });
  audio.play("faint");
  rt.player.lyingTarget = 1;
  await wait(1300);
  setGame({ fade: 1 });
  await wait(800);
  // Wake at the shelter, else by a lit fire, else next to Kai.
  const camp = sleepPlace();
  const home = camp ? { x: camp.x + 1.6, z: camp.z + 1.9 } : { x: rt.kai.x + 1.4, z: rt.kai.z + 1.8 };
  setGame({ inCave: false });
  const at = resolveCollisions(home.x, home.z, PLAYER_R, [STATIC_OBSTACLES, buildingObstacles(getGame().buildings)], currentGates());
  rt.player.x = at.x;
  rt.player.z = at.z;
  rt.stats = afterFaint();
  syncStats();
  rt.camera.snap = true;
  rt.clock = faintPenalty(rt.clock, clockCapped()); // a little time has passed
  setGame({ fade: 0 });
  await wait(700);
  await say("game", "You fainted. Kai helped you.", "たおれて しまった。 カイが たすけて くれたよ。");
  await say("kai", "Eat coconuts. Then you feel good!", "ココナッツを たべてね。 げんきに なるよ！");
  rt.player.lyingTarget = 0;
  await wait(600);
  setGame({ mode: "explore" });
  save();
}
