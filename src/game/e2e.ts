import { freshGameData, getGame, setGame } from "./store";
import { resetRuntime, rt } from "./runtime";
import { seedChoices } from "./flow/ask";
import { syncStats } from "./flow/session";
import { nextDay } from "./flow/days";
import { currentGates, targetPosition } from "./flow/places";
import {
  BRIDGE,
  CAVE_SIGN,
  CLIFF_SIGN,
  CRATE,
  FALLEN_TREE,
  FISH_SPOTS,
  FOREST_GAP,
  KAI_HOME,
  NODES,
  NODE_BY_ID,
  POND,
  SPAWN,
  WATER_SPOTS
} from "./world/island";
import { isWalkable, overlaps, resolveCollisions, PLAYER_R, STATIC_OBSTACLES } from "./world/collision";
import { isReachable } from "./world/reach";
import { buildingObstacles, type PlacedBuilding } from "./world/placement";
import { currentStep, DAYS } from "./logic/quest";
import { isNight, lightAt } from "./logic/clock";
import type { PhraseId } from "./logic/english";
import type { Bag, CraftId } from "./types";
import { recognition } from "../audio/recognition";
import { cameraRef } from "../scene/CameraRig";
import { perf } from "../scene/GameScene";
import * as THREE from "three";

/** English a student has used by the end of each story day (for startDay). */
const KNOWN_BY_DAY: Record<number, PhraseId[]> = {
  1: ["hungry", "getCoconut", "eatCoconut", "needWood", "yesICan", "getWood", "getStone", "craftCampfire", "makeFire", "sleep"],
  2: ["yesICan", "craftAxe", "cutTree", "getLeaves", "craftShelter", "buildShelter", "sleep"]
};
const UNLOCKED_BY_DAY: Record<number, CraftId[]> = { 1: ["campfire"], 2: ["axe", "shelter"] };
/** Where startDay puts the camp: the Day 1 fire on the beach, the Day 2 shelter beside it. */
const CAMP_FIRE = { x: 2, z: 5 };
const CAMP_SHELTER = { x: -3, z: 5 };

/**
 * Test hook (only with ?e2e=1): read game state and put the player next to
 * things, so Playwright drives the real UI (keys, clicks) without steering.
 */
export function installE2eHook(seed: number) {
  seedChoices(seed);
  const place = (x: number, z: number, faceX: number, faceZ: number) => {
    const g = getGame();
    const p = resolveCollisions(
      x,
      z,
      PLAYER_R,
      [STATIC_OBSTACLES, buildingObstacles(g.buildings)],
      { pathCleared: g.pathCleared, bridgeBuilt: g.bridgeBuilt }
    );
    rt.player.x = p.x;
    rt.player.z = p.z;
    rt.player.vx = rt.player.vz = 0;
    rt.player.yaw = Math.atan2(faceX - p.x, faceZ - p.z);
    rt.walked = Math.max(rt.walked, 10);
    return p;
  };
  const api = {
    state() {
      const g = getGame();
      return {
        screen: g.screen,
        mode: g.mode,
        micState: g.micState,
        stats: g.stats,
        live: { ...rt.stats },
        bag: g.bag,
        quest: g.quest,
        step: currentStep(g.quest)?.id ?? null,
        known: g.known,
        said: g.said,
        unlocked: g.unlocked,
        crafted: g.crafted,
        buildings: g.buildings,
        metKai: g.metKai,
        kai: g.kai,
        ate: g.ate,
        crateOpened: g.crateOpened,
        focus: g.focus,
        prompt: g.prompt
          ? {
              id: g.prompt.id,
              kind: g.prompt.kind,
              status: g.prompt.status,
              buttons: g.prompt.buttons,
              misses: g.prompt.misses,
              sentences: g.prompt.sentences.map((s) => s.en),
              choices: g.prompt.choices.map((c) => c.id),
              question: g.prompt.question?.en ?? null
            }
          : null,
        line: g.line ? { by: g.line.by, en: g.line.en } : null,
        placing: g.placing,
        /** The preview has been checked this placement and fits (E would place it). */
        placeOk: g.mode === "place" && rt.place.ok,
        hint: g.hint,
        player: { x: rt.player.x, z: rt.player.z, yaw: rt.player.yaw },
        taken: [...rt.taken.keys()],
        beacons: rt.time < rt.beacons.until ? rt.beacons.ids : [],
        pathCleared: g.pathCleared,
        bridgeBuilt: g.bridgeBuilt,
        light: rt.light,
        lightTarget: rt.lightTarget,
        time: rt.time,
        hasSave: g.hasSave,
        day: g.quest.day,
        clock: rt.clock,
        isNight: isNight(rt.clock),
        sleptDay: g.sleptDay,
        daySaid: g.daySaid,
        dayNew: g.dayNew,
        dayTitle: g.dayTitle,
        sleeping: g.sleeping,
        toasts: g.toasts.map((t) => t.en),
        counters: { gotWater: g.gotWater, drank: g.drank, caught: g.caught, cooked: g.cooked },
        kaiAt: { x: rt.kai.x, z: rt.kai.z }
      };
    },
    /** Stand next to a node / the crate / Kai / a sign / a place / a building, facing it. */
    goTo(id: string) {
      const n = NODE_BY_ID.get(id);
      if (n) return place(n.x, n.z + (n.kind === "tree" ? 1.5 : 1.2), n.x, n.z);
      if (id === "crate") return place(CRATE.x - 1.3, CRATE.z + 0.2, CRATE.x, CRATE.z);
      if (id === "kai") return place(rt.kai.x + 0.4, rt.kai.z + 1.5, rt.kai.x, rt.kai.z);
      if (id === "sign") return place(FOREST_GAP.sign.x + 0.3, FOREST_GAP.sign.z + 1.3, FOREST_GAP.sign.x, FOREST_GAP.sign.z);
      if (id === FALLEN_TREE.id) return place(FALLEN_TREE.x, FALLEN_TREE.z + 1.6, FALLEN_TREE.x, FALLEN_TREE.z);
      const b = getGame().buildings.find((x) => x.id === id);
      if (b) return place(b.x, b.z + (b.type === "shelter" ? 2.3 : 1.6), b.x, b.z);
      const at = targetPosition(id);
      if (!at) throw new Error(`no target ${id}`);
      // Any free, walkable spot about 1.4 m from the place, south side first.
      const gates = currentGates();
      const solid = [STATIC_OBSTACLES, buildingObstacles(getGame().buildings)];
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        const x = at.x + Math.sin(a) * 1.4;
        const z = at.z + Math.cos(a) * 1.4;
        if (isWalkable(x, z, gates, PLAYER_R) && !overlaps(x, z, PLAYER_R, solid)) return place(x, z, at.x, at.z);
      }
      return place(at.x, at.z + 1.4, at.x, at.z);
    },
    /**
     * Start at the real morning of day n, as if the earlier days were played:
     * their facts, recipes and English, a lit campfire on the beach, a built
     * shelter from Day 3 on, and a typical bag. Returns at once; the morning
     * (title, Kai's talk) then plays as in a real game.
     */
    startDay(n: number) {
      const before = Math.max(1, n - 1);
      const known: PhraseId[] = [];
      const unlocked: CraftId[] = [];
      for (let d = 1; d <= before; d++) {
        for (const p of KNOWN_BY_DAY[d] ?? []) if (!known.includes(p)) known.push(p);
        for (const c of UNLOCKED_BY_DAY[d] ?? []) if (!unlocked.includes(c)) unlocked.push(c);
      }
      const fire: PlacedBuilding = { id: "bE2eFire", type: "campfire", x: CAMP_FIRE.x, z: CAMP_FIRE.z, rot: 0, lit: true };
      const buildings: PlacedBuilding[] = [fire];
      if (n >= 3) buildings.push({ id: "bE2eShelter", type: "shelter", x: CAMP_SHELTER.x, z: CAMP_SHELTER.z, rot: 0, built: true });
      const bag: Bag = n >= 3 ? { coconut: 1, wood: 1, axe: 1 } : { coconut: 1 };
      const crafted: CraftId[] = n >= 3 ? ["campfire", "axe", "shelter"] : ["campfire"];
      const lastDay = DAYS.find((d) => d.day === before);
      resetRuntime();
      setGame({
        ...freshGameData(),
        screen: "dayEnd",
        mode: "busy",
        micState: recognition.supported ? "ready" : "unsupported",
        quest: { day: before, done: lastDay ? lastDay.steps.map((s) => s.id) : [], complete: Boolean(lastDay) },
        ate: 1,
        metKai: true,
        kai: n >= 3 ? { need: "wood", canFire: true, canAxe: true } : { need: "wood", canFire: true },
        known,
        said: [...known],
        unlocked,
        crafted,
        buildings,
        bag,
        pathCleared: n >= 3,
        sleptDay: before,
        hint: null,
        fade: 0,
        prompt: null,
        line: null
      });
      rt.fireT0.set(fire.id, -10);
      rt.walked = 99;
      rt.player.x = fire.x + 1.2;
      rt.player.z = fire.z + 2.2;
      void nextDay();
      return true;
    },
    /** Jump the day clock (0 = sunrise, CAP = golden hour, 1 = held night). */
    setClock(t: number) {
      rt.clock = Math.max(0, Math.min(1, t));
      rt.light = rt.lightTarget = lightAt(rt.clock);
      setGame({ t: rt.clock });
      return rt.clock;
    },
    teleport(x: number, z: number, yaw = 0) {
      const p = place(x, z, x + Math.sin(yaw), z + Math.cos(yaw));
      rt.player.yaw = yaw;
      return p;
    },
    /** Put the player at a world point, facing another world point. */
    goto(x: number, z: number, faceX: number, faceZ: number) {
      return place(x, z, faceX, faceZ);
    },
    /** Untaken nodes of a kind that can be reached with the gates as they are, nearest first. */
    nodes(kind?: string) {
      const gates = currentGates();
      const p = rt.player;
      return NODES.filter((n) => (!kind || n.kind === kind) && !rt.taken.has(n.id) && isReachable(n.x, n.z, gates))
        .sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))
        .map((n) => n.id);
    },
    /** Whether a node or place can be reached with the gates as they are. */
    reachable(id: string) {
      const at = targetPosition(id);
      return at !== null && isReachable(at.x, at.z, currentGates());
    },
    setStats(s: Partial<{ hp: number; stamina: number; food: number }>) {
      rt.stats = { ...rt.stats, ...s };
      syncStats();
    },
    kaiHome() {
      return KAI_HOME;
    },
    /** Screen position (CSS px) of a world point. */
    screenOf(x: number, y: number, z: number) {
      const cam = cameraRef.current;
      if (!cam) return null;
      const v = new THREE.Vector3(x, y, z).project(cam);
      return { x: ((v.x + 1) / 2) * window.innerWidth, y: ((1 - v.y) / 2) * window.innerHeight };
    },
    setCameraYaw(yaw: number) {
      rt.camera.yaw = yaw;
      rt.camera.mode = "follow";
      rt.camera.snap = true;
    },
    setCameraFollow(yaw: number, pitch = 0.42, dist = 9.5) {
      rt.camera.mode = "follow";
      rt.camera.shot = null;
      rt.camera.yaw = yaw;
      rt.camera.pitch = pitch;
      rt.camera.dist = dist;
      rt.camera.snap = true;
    },
    setCameraShot(pos: { x: number; y: number; z: number }, target: { x: number; y: number; z: number }) {
      rt.camera.mode = "shot";
      rt.camera.shot = { pos: { ...pos }, target: { ...target } };
      rt.camera.snap = true;
    },
    /** Test-only world setup used by deterministic visual captures. */
    showWorld() {
      setGame({
        screen: "game",
        mode: "explore",
        fade: 0,
        settingsOpen: false,
        focus: null,
        prompt: null,
        line: null,
        craftOpen: false,
        placing: null,
        hint: null
      });
      rt.player.lying = rt.player.lyingTarget = 0;
      rt.walked = Math.max(rt.walked, 10);
    },
    setGates(next: { pathCleared?: boolean; bridgeBuilt?: boolean }) {
      const g = getGame();
      const pathCleared = next.pathCleared ?? g.pathCleared;
      const bridgeBuilt = next.bridgeBuilt ?? g.bridgeBuilt;
      if (pathCleared !== g.pathCleared) rt.pathClearedT0 = pathCleared ? rt.time : -1;
      if (bridgeBuilt !== g.bridgeBuilt) rt.bridgeBuiltT0 = bridgeBuilt ? rt.time : -1;
      setGame({ pathCleared, bridgeBuilt });
      return { pathCleared, bridgeBuilt };
    },
    setLight(light: number, target = light) {
      rt.light = Math.max(0, Math.min(1, light));
      rt.lightTarget = Math.max(0, Math.min(1, target));
      return { light: rt.light, lightTarget: rt.lightTarget };
    },
    setTaken(id: string, taken: boolean) {
      if (!NODE_BY_ID.has(id)) throw new Error(`no node ${id}`);
      if (taken) {
        rt.taken.set(id, 10_000);
        rt.regrown.delete(id);
      } else {
        rt.taken.delete(id);
        rt.regrown.delete(id);
      }
    },
    setBuildings(buildings: PlacedBuilding[], animate = false) {
      rt.fireT0.clear();
      rt.builtT0.clear();
      for (const b of buildings) {
        if (animate && b.lit) rt.fireT0.set(b.id, rt.time);
        if (animate && b.type === "shelter" && b.built) rt.builtT0.set(b.id, rt.time);
      }
      setGame({ buildings: buildings.map((b) => ({ ...b })) });
    },
    /** Stable, read-only coordinates for visual harnesses. */
    world() {
      return {
        spawn: { ...SPAWN },
        fallenTree: { ...FALLEN_TREE },
        bridge: { ...BRIDGE, beachSide: { ...BRIDGE.beachSide } },
        pond: { ...POND },
        waterSpots: WATER_SPOTS.map((p) => ({ ...p })),
        fishSpots: FISH_SPOTS.map((p) => ({ ...p })),
        caveSign: { ...CAVE_SIGN },
        cliffSign: { ...CLIFF_SIGN },
        nodes: NODES.map((n) => ({ ...n }))
      };
    },
    setMic(on: boolean) {
      setGame({ settings: { ...getGame().settings, mic: on } });
    },
    perf() {
      return { ...perf };
    },
    timeScale() {
      return rt.time;
    }
  };
  (window as unknown as { __si: typeof api }).__si = api;
}
