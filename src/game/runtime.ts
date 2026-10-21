import type { Vec3 } from "./types";
import { KAI_HOME, SPAWN } from "./world/island";
import { START_STATS, type Stats } from "./logic/stats";

/**
 * Mutable per-frame state shared by the scene, input and game flow. Kept out
 * of React so 60 fps updates never re-render components.
 */

export interface CameraShot {
  pos: Vec3;
  target: Vec3;
}

export interface Floater {
  id: number;
  text: string;
  x: number;
  y: number;
  z: number;
  t0: number;
}

export const rt = {
  /** Real seconds since load (animation). */
  time: 0,
  player: {
    x: SPAWN.x,
    z: SPAWN.z,
    y: 0,
    yaw: SPAWN.yaw,
    vx: 0,
    vz: 0,
    speed: 0,
    step: 0,
    running: false,
    /** Ran out of stamina: no running until it recovers a little. */
    exhausted: false,
    /** 1 = lying on the sand (intro / fainted), 0 = standing. */
    lying: 0,
    lyingTarget: 0,
    /** Short action animation (cooking shares craft). */
    action: null as null | { kind: "gather" | "eat" | "drink" | "craft" | "chop" | "build"; t0: number },
    frozenUntil: 0
  },
  /** Keyboard + joystick intent, camera space: x = right, y = forward. */
  joy: { x: 0, y: 0, active: false },
  /** Touch "run" toggle. */
  runToggle: false,
  camera: {
    yaw: 0.35,
    pitch: 0.42,
    dist: 9.5,
    mode: "follow" as "follow" | "shot",
    shot: null as CameraShot | null,
    snap: false,
    pos: { x: 0, y: 6, z: 6 } as Vec3,
    target: { x: 0, y: 1, z: 0 } as Vec3
  },
  kai: {
    x: KAI_HOME.x,
    z: KAI_HOME.z,
    yaw: KAI_HOME.yaw,
    walkTo: null as null | { x: number; z: number; face: { x: number; z: number } },
    route: [] as Array<{ x: number; z: number }>,
    talking: false,
    speed: 0,
    step: 0
  },
  /** Taken resource nodes: id -> seconds until it grows back. */
  taken: new Map<string, number>(),
  /** Active cast; each phase starts at t0. Spot rests share the saved taken map. */
  fishing: null as null | {
    spotId: string;
    phase: "cast" | "wait" | "bite" | "reel";
    t0: number;
    /** Where the bobber lands (in open water, not at the spot). */
    x: number;
    z: number;
    /** The way the player faces while fishing. */
    yaw: number;
  },
  /** Node id -> time it reappeared (pop-in animation). */
  regrown: new Map<string, number>(),
  /** Glowing markers from "I need ___": node ids and when they end. */
  beacons: { ids: [] as string[], until: 0 },
  /** The building preview while placing. */
  place: { x: 0, z: 0, rot: 0, ok: false, visible: false },
  /** Building id -> time it was lit. */
  fireT0: new Map<string, number>(),
  /** Story light: 1 = midday, 0 = night. Eases toward lightTarget. */
  light: 0.95,
  lightTarget: 0.95,
  /** Authoritative live day clock. The store receives a throttled HUD/save copy. */
  clock: 0.05,
  /** Story day whose one-off evening cue has already started. */
  eveningDay: 0,
  crateOpenT0: -1,
  /** When the fallen palm was cut / the bridge was built (-1 = not yet, or already done before load). */
  pathClearedT0: -1,
  bridgeBuiltT0: -1,
  cliffOpenT0: -1,
  /** Shared short push pose for both survivors at the rockfall. */
  pushT0: -1,
  caveBoxOpenT0: -1,
  signalLitT0: -1,
  rescueT0: -1,
  /** Actual flame position, shared by the held prop and the fixed fire light. */
  torchTip: { x: 0, y: 0, z: 0 },
  /** Building id -> time a shelter was built (roof animation). */
  builtT0: new Map<string, number>(),
  floaters: [] as Floater[],
  celebrateT0: -100,
  /** Seconds the game has been running (paused in menus and dialogue). */
  simTime: 0,
  /** Live seconds without a newly completed checklist step. */
  stepIdleSeconds: 0,
  /** Live time of the last automatic hint (also reset by a step tick). */
  lastAutomaticHintAt: 0,
  automaticHintCount: 0,
  /** Live (unrounded) survival stats; the store holds a rounded copy for the HUD. */
  stats: { ...START_STATS } as Stats,
  /** Metres walked since the start (hides the movement hint). */
  walked: 0
};

let floaterId = 1;
/** Floating word at a world point ("+1 wood"). */
export function floatText(text: string, x: number, y: number, z: number) {
  rt.floaters.push({ id: floaterId++, text, x, y, z, t0: rt.time });
  if (rt.floaters.length > 6) rt.floaters.shift();
}

export function resetRuntime() {
  const p = rt.player;
  p.x = SPAWN.x;
  p.z = SPAWN.z;
  p.yaw = SPAWN.yaw;
  p.vx = p.vz = p.speed = 0;
  p.running = false;
  p.exhausted = false;
  p.lying = 0;
  p.lyingTarget = 0;
  p.action = null;
  p.frozenUntil = 0;
  rt.joy.x = rt.joy.y = 0;
  rt.runToggle = false;
  rt.camera.mode = "follow";
  rt.camera.shot = null;
  rt.camera.yaw = 0.35;
  rt.camera.pitch = 0.42;
  rt.camera.snap = true;
  rt.kai.x = KAI_HOME.x;
  rt.kai.z = KAI_HOME.z;
  rt.kai.yaw = KAI_HOME.yaw;
  rt.kai.walkTo = null;
  rt.kai.route = [];
  rt.kai.speed = rt.kai.step = 0;
  rt.kai.talking = false;
  rt.taken.clear();
  rt.fishing = null;
  rt.regrown.clear();
  rt.beacons = { ids: [], until: 0 };
  rt.place.visible = false;
  rt.fireT0.clear();
  rt.light = rt.lightTarget = 0.95;
  rt.clock = 0.05;
  rt.eveningDay = 0;
  rt.crateOpenT0 = -1;
  rt.pathClearedT0 = -1;
  rt.bridgeBuiltT0 = -1;
  rt.cliffOpenT0 = -1;
  rt.pushT0 = -1;
  rt.caveBoxOpenT0 = -1;
  rt.signalLitT0 = -1;
  rt.rescueT0 = -1;
  rt.builtT0.clear();
  rt.floaters = [];
  rt.celebrateT0 = -100;
  rt.simTime = 0;
  rt.stepIdleSeconds = 0;
  rt.lastAutomaticHintAt = 0;
  rt.automaticHintCount = 0;
  rt.stats = { ...START_STATS };
  rt.walked = 0;
}
