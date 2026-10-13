import { getGame, setGame } from "./store";
import { rt } from "./runtime";
import { seedChoices } from "./flow/ask";
import { syncStats } from "./flow/session";
import { CRATE, KAI_HOME, NODES, NODE_BY_ID, FOREST_GAP } from "./world/island";
import { resolveCollisions, PLAYER_R, STATIC_OBSTACLES } from "./world/collision";
import { buildingObstacles } from "./world/placement";
import { currentStep } from "./logic/quest";
import { cameraRef } from "../scene/CameraRig";
import { perf } from "../scene/GameScene";
import * as THREE from "three";

/**
 * Test hook (only with ?e2e=1): read game state and put the player next to
 * things, so Playwright drives the real UI (keys, clicks) without steering.
 */
export function installE2eHook(seed: number) {
  seedChoices(seed);
  const place = (x: number, z: number, faceX: number, faceZ: number) => {
    const p = resolveCollisions(x, z, PLAYER_R, [STATIC_OBSTACLES, buildingObstacles(getGame().buildings)]);
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
        hint: g.hint,
        player: { x: rt.player.x, z: rt.player.z, yaw: rt.player.yaw },
        taken: [...rt.taken.keys()],
        beacons: rt.time < rt.beacons.until ? rt.beacons.ids : [],
        light: rt.light,
        lightTarget: rt.lightTarget,
        hasSave: g.hasSave
      };
    },
    /** Stand next to a node / the crate / Kai / the sign / a building, facing it. */
    goTo(id: string) {
      const n = NODE_BY_ID.get(id);
      if (n) return place(n.x, n.z + 1.2, n.x, n.z);
      if (id === "crate") return place(CRATE.x - 1.3, CRATE.z + 0.2, CRATE.x, CRATE.z);
      if (id === "kai") return place(rt.kai.x + 0.4, rt.kai.z + 1.5, rt.kai.x, rt.kai.z);
      if (id === "sign") return place(FOREST_GAP.sign.x + 0.3, FOREST_GAP.sign.z + 1.3, FOREST_GAP.sign.x, FOREST_GAP.sign.z);
      const b = getGame().buildings.find((x) => x.id === id);
      if (b) return place(b.x, b.z + 1.6, b.x, b.z);
      throw new Error(`no target ${id}`);
    },
    teleport(x: number, z: number, yaw = 0) {
      const p = place(x, z, x + Math.sin(yaw), z + Math.cos(yaw));
      rt.player.yaw = yaw;
      return p;
    },
    nodes(kind?: string) {
      return NODES.filter((n) => (!kind || n.kind === kind) && !rt.taken.has(n.id)).map((n) => n.id);
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
