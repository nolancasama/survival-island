import { getGame, setGame, toast } from "../store";
import { rt } from "../runtime";
import { advanceDay, isStoryDay, readyToSleep } from "../logic/quest";
import { afterSleep } from "../logic/stats";
import { canSleepAt, dayStartT, lightAt } from "../logic/clock";
import { resolveCollisions, PLAYER_R, STATIC_OBSTACLES } from "../world/collision";
import { buildingObstacles, type PlacedBuilding } from "../world/placement";
import { KAI_HOME } from "../world/island";
import { ask, fastMode, say } from "./ask";
import { currentGates } from "./places";
import { facts, refreshQuest, save, setMood, showPlaces, syncStats, updateHint, wait } from "./session";
import { dayThreeThanks, morningTalk } from "./kai";
import { audio } from "../../audio/audio";

/**
 * The shape of a day: the evening (Day 1's celebration, or Kai's evening line
 * on later days), sleeping, the day-end card and the next morning. Every day
 * ends with "I want to sleep."; the card comes after sleeping, not after the
 * last task.
 */

const near = (b: PlacedBuilding) => Math.hypot(b.x - rt.player.x, b.z - rt.player.z);

/** Where the player sleeps: the nearest built shelter, else the nearest lit campfire. */
export function sleepPlace(): PlacedBuilding | null {
  const bs = getGame().buildings;
  const shelters = bs.filter((b) => b.type === "shelter" && b.built).sort((a, b) => near(a) - near(b));
  if (shelters.length) return shelters[0];
  const fires = bs.filter((b) => b.type === "campfire" && b.lit).sort((a, b) => near(a) - near(b));
  return fires[0] ?? null;
}

/** Sleeping is allowed from the evening on, and on a story day only once every other step is done. */
export function canSleepNow(): boolean {
  const q = getGame().quest;
  if (!canSleepAt(rt.clock)) return false;
  return !isStoryDay(q.day) || readyToSleep(q);
}

/** Kai stands beside the camp (the shelter or the fire), or at home before there is one. */
export function placeKaiAtCamp() {
  const bed = sleepPlace();
  const want = bed ? { x: bed.x - 1.8, z: bed.z + 1.6 } : { x: KAI_HOME.x, z: KAI_HOME.z };
  const spot = resolveCollisions(want.x, want.z, 0.4, [STATIC_OBSTACLES, buildingObstacles(getGame().buildings)], currentGates());
  rt.kai.x = spot.x;
  rt.kai.z = spot.z;
  rt.kai.walkTo = null;
  rt.kai.yaw = bed ? Math.atan2(bed.x - spot.x, bed.z - spot.z) : KAI_HOME.yaw;
}

// --------------------------------------------------------------- evening

/** Day 1: the fire is lit. Kai comes over, it is night, and the day ends with sleep by the fire. */
export async function celebrate() {
  rt.eveningDay = 1;
  setGame({ mode: "busy", focus: null });
  const fire = getGame().buildings.find((b) => b.lit);
  rt.celebrateT0 = rt.time;
  audio.play("fanfare");
  setMood("dusk");
  rt.clock = 1; // night falls during the celebration
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
  if (rt.kai.walkTo) placeKaiAtCamp();
  rt.kai.walkTo = null;
  await say("kai", "You can make a fire! Great job!", "火を つけられたね！ すごい！");
  await say("kai", "It's late. Let's sleep.", "もう おそいね。 ねよう。");
  rt.camera.mode = "follow";
  rt.camera.shot = null;
  setMood("night");
  await ask({ kind: "command", options: ["sleep"], picture: "moon", readSentence: true });
  await sleepTonight(fire ?? null);
}

/** Day 2+: only Sleep is left. Evening falls by the clock; Kai says where to sleep. */
export async function eveningCue() {
  const day = getGame().quest.day;
  rt.eveningDay = day;
  // Let the moment that finished the day play out, and never cut into a prompt or a talk.
  await wait(700);
  for (let i = 0; i < 100 && getGame().mode !== "explore"; i++) await wait(150);
  const g = getGame();
  if (g.screen !== "game" || g.mode !== "explore" || g.quest.day !== day) return;
  setGame({ mode: "busy", focus: null });
  audio.play("fanfare");
  const bed = sleepPlace();
  if (bed) showPlaces([bed.id]);
  await dayThreeThanks();
  await say("kai", "It's getting dark. Let's sleep in the shelter!", "くらく なって きたね。 こやで ねよう！");
  setGame({ mode: "explore" });
  updateHint();
}

// ---------------------------------------------------------------- sleep

/** The shelter or a lit fire was used: sleep if it is time, otherwise say it is still day. */
export async function trySleep(bed: PlacedBuilding) {
  if (!canSleepNow()) {
    audio.play("full");
    toast({ en: "It's not night yet!", ja: "まだ よるじゃ ないよ。", icon: "moon", tone: "info" });
    return;
  }
  // Asked every evening: once a day is not repetition.
  const said = await ask({ kind: "command", options: ["sleep"], picture: "moon", cancellable: true, readSentence: true });
  if (!said) return;
  await sleepTonight(bed);
}

/** Lie down and recover; story days show a card, free days wake straight into the next morning. */
export async function sleepTonight(bed: PlacedBuilding | null) {
  setGame({ mode: "busy", focus: null, needsPulse: false });
  rt.beacons = { ids: [], until: 0 };
  const p = rt.player;
  if (bed) p.yaw = Math.atan2(bed.x - p.x, bed.z - p.z);
  audio.play("sleep");
  p.lyingTarget = 1;
  await wait(1100);
  setGame({ fade: 1 });
  await wait(900);
  setGame({ sleeping: true });
  await wait(2500);
  rt.stats = afterSleep(rt.stats);
  syncStats();
  const g = getGame();
  setGame({ sleptDay: Math.max(g.sleptDay, g.quest.day) });
  refreshQuest();
  if (!isStoryDay(g.quest.day)) {
    await nextDay();
    return;
  }
  setGame({ screen: "dayEnd", mode: "busy", sleeping: false, fade: 0, focus: null, hint: getGame().hint === "micBlocked" ? "micBlocked" : null });
  save();
}

// -------------------------------------------------------------- morning

let advancing = false;

/** "Day N+1 →" on the card (or resuming after it): the next morning. */
export async function nextDay() {
  if (advancing) return;
  advancing = true;
  try {
    const previousDay = getGame().quest.day;
    const q = advanceDay(getGame().quest, facts());
    rt.clock = dayStartT(q.day);
    rt.light = rt.lightTarget = lightAt(rt.clock);
    rt.eveningDay = 0;
    rt.stepIdleSeconds = 0;
    rt.lastAutomaticHintAt = rt.simTime;
    rt.beacons = { ids: [], until: 0 };
    setGame({
      quest: q,
      t: rt.clock,
      daySaid: [],
      dayNew: [],
      screen: "game",
      mode: "busy",
      focus: null,
      prompt: null,
      line: null,
      craftOpen: false,
      placing: null,
      sleeping: false,
      dayTitle: null,
      fade: 1
    });
    wakeAtCamp();
    setMood("day");
    save();
    await wait(500);
    audio.play("morning");
    setGame({ fade: 0, dayTitle: q.day });
    await wait(2600);
    setGame({ dayTitle: null });
    rt.player.lyingTarget = 0;
    await wait(900);
    if (isStoryDay(previousDay)) await morningTalk(q.day);
    setGame({ mode: "explore" });
    refreshQuest();
    updateHint();
    save();
  } finally {
    advancing = false;
  }
}

/** A migrated free-play save begins Day 4's story without advancing the day number. */
export async function resumeDayFourMorning() {
  setGame({ mode: "busy", focus: null, dayTitle: 4, daySaid: [], dayNew: [] });
  wakeAtCamp();
  audio.play("morning");
  await wait(2600);
  setGame({ dayTitle: null });
  rt.player.lyingTarget = 0;
  await wait(900);
  await morningTalk(4);
  refreshQuest();
}

/** The player wakes lying beside the shelter (or fire); Kai is up already, next to the camp. */
function wakeAtCamp() {
  const bed = sleepPlace();
  const p = rt.player;
  const base = bed ?? { x: p.x, z: p.z };
  const spot = resolveCollisions(base.x + 1.2, base.z + 2.2, PLAYER_R, [STATIC_OBSTACLES, buildingObstacles(getGame().buildings)], currentGates());
  p.x = spot.x;
  p.z = spot.z;
  p.vx = p.vz = 0;
  p.action = null;
  p.lying = p.lyingTarget = 1;
  placeKaiAtCamp();
  p.yaw = Math.atan2(rt.kai.x - p.x, rt.kai.z - p.z);
  rt.camera.mode = "follow";
  rt.camera.shot = null;
  rt.camera.yaw = 0.35;
  rt.camera.pitch = 0.5;
  rt.camera.snap = true;
}
