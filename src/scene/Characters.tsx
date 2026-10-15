import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { rt } from "../game/runtime";
import { getGame, setGame } from "../game/store";
import { keyboardMove, keys } from "../input/keyboard";
import { groundY, POND, shoreZ } from "../game/world/island";
import { PLAYER_R, STATIC_OBSTACLES, resolveCollisions, type Obstacles } from "../game/world/collision";
import { buildingObstacles } from "../game/world/placement";
import { canRun } from "../game/logic/stats";
import { findFocus } from "../game/flow/focus";
import { audio } from "../audio/audio";
import { tts } from "../audio/tts";
import { smoothMat, shadowMaterial } from "./materials";
import { KAI_OUTFIT, PLAYER_OUTFIT, armGeometry, bodyGeometry, legGeometry, type Outfit } from "./models/people";
import { PartBuilder } from "./partBuilder";
import { Torch } from "./Torch";

const WALK = 4.2;
const RUN = 6.8;

function useKid(outfit: Outfit) {
  return useMemo(() => ({ body: bodyGeometry(outfit), leg: legGeometry(outfit), arm: armGeometry(outfit) }), [outfit]);
}

interface Rig {
  root: React.RefObject<THREE.Group | null>;
  pose: React.RefObject<THREE.Group | null>;
  legL: React.RefObject<THREE.Group | null>;
  legR: React.RefObject<THREE.Group | null>;
  armL: React.RefObject<THREE.Group | null>;
  armR: React.RefObject<THREE.Group | null>;
  axe: React.RefObject<THREE.Group | null>;
  rod: React.RefObject<THREE.Group | null>;
  rodTip: React.RefObject<THREE.Group | null>;
  cup: React.RefObject<THREE.Group | null>;
}

function useRig(): Rig {
  return {
    root: useRef<THREE.Group>(null),
    pose: useRef<THREE.Group>(null),
    legL: useRef<THREE.Group>(null),
    legR: useRef<THREE.Group>(null),
    armL: useRef<THREE.Group>(null),
    armR: useRef<THREE.Group>(null),
    axe: useRef<THREE.Group>(null),
    rod: useRef<THREE.Group>(null),
    rodTip: useRef<THREE.Group>(null),
    cup: useRef<THREE.Group>(null)
  };
}

function axeGeometry(): THREE.BufferGeometry {
  const b = new PartBuilder(0);
  b.cylAt(0.026, 0.54, [0, -0.22, 0], [0, 0, 0], "#8a5835", 8);
  b.boxAt(0.24, 0.13, 0.08, [-0.065, -0.43, 0], [0, 0, -0.12], "#777b78");
  return b.build();
}

/** Handheld tools share the character's arm pivot and need no loaded models. */
function rodGeometry(): THREE.BufferGeometry {
  const b = new PartBuilder(0);
  b.add(new THREE.CylinderGeometry(0.012, 0.026, 1.55, 8), "#d2a265", [0, -0.72, 0]);
  b.cylAt(0.038, 0.2, [0, -0.025, 0], [0, 0, 0], "#714a32", 8);
  b.torus(0.06, 0.018, [0, -0.16, -0.04], [0, Math.PI / 2, 0], "#ddd1a5");
  return b.build();
}

function cupGeometry(): THREE.BufferGeometry {
  const b = new PartBuilder(0);
  b.sphere(0.12, 0, -0.04, 0.02, "#785133", [1, 0.75, 1]);
  b.cyl(0.11, 0.11, 0.018, 0, 0.015, 0.02, "#e4d5ad", 12);
  b.cyl(0.085, 0.085, 0.006, 0, 0.034, 0.02, "#72bfda", 12);
  return b.build();
}

function KidMesh({ outfit, rig, scale = 1, torch = false }: { outfit: Outfit; rig: Rig; scale?: number; torch?: boolean }) {
  const g = useKid(outfit);
  const axe = useMemo(() => axeGeometry(), []);
  const rod = useMemo(() => rodGeometry(), []);
  const cup = useMemo(() => cupGeometry(), []);
  const shadow = useMemo(() => shadowMaterial(0.35), []);
  return (
    <group ref={rig.root}>
      <group scale={scale}>
        <group ref={rig.pose}>
          <mesh geometry={g.body} material={smoothMat} />
          <group ref={rig.legL} position={[-0.09, 0.5, 0]}>
            <mesh geometry={g.leg} material={smoothMat} />
          </group>
          <group ref={rig.legR} position={[0.09, 0.5, 0]}>
            <mesh geometry={g.leg} material={smoothMat} />
          </group>
          <group ref={rig.armL} position={[-0.27, 0.98, 0]} rotation={[0, 0, -0.12]}>
            <mesh geometry={g.arm} material={smoothMat} />
          </group>
          <group ref={rig.armR} position={[0.27, 0.98, 0]} rotation={[0, 0, 0.12]}>
            <mesh geometry={g.arm} material={smoothMat} />
            {torch && <group position={[0, -0.37, 0.035]}><Torch /></group>}
            <group ref={rig.axe} position={[0, -0.37, 0.01]} visible={false}>
              <mesh geometry={axe} material={smoothMat} />
            </group>
            <group ref={rig.rod} position={[0, -0.37, 0.01]} visible={false}>
              <mesh geometry={rod} material={smoothMat} />
              <group ref={rig.rodTip} position={[0, -1.5, 0]} />
            </group>
            <group ref={rig.cup} position={[0, -0.37, 0.035]} visible={false}>
              <mesh geometry={cup} material={smoothMat} />
            </group>
          </group>
        </group>
      </group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} material={shadow}>
        <planeGeometry args={[1.1, 1.1]} />
      </mesh>
    </group>
  );
}

const ease = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : Math.sin(t * Math.PI));

function caughtFishGeometry(): THREE.BufferGeometry {
  const b = new PartBuilder(0);
  b.sphere(0.16, 0, 0, 0, "#66b7b4", [0.7, 1, 1.75]);
  b.sphere(0.12, 0, -0.035, 0.04, "#d5e6c9", [0.72, 0.65, 1.5]);
  b.add(new THREE.ConeGeometry(0.16, 0.22, 3), "#438e9e", [0, 0, -0.3], [Math.PI / 2, 0, 0]);
  b.sphere(0.028, 0.085, 0.045, 0.15, "#182b32", [0.5, 1, 1], 8);
  b.sphere(0.028, -0.085, 0.045, 0.15, "#182b32", [0.5, 1, 1], 8);
  return b.build();
}

/** World-space tackle follows the live fishing phases, without React updates. */
function FishingTackle({ rig }: { rig: Rig }) {
  const group = useRef<THREE.Group>(null);
  const bobber = useRef<THREE.Group>(null);
  const fish = useRef<THREE.Mesh>(null);
  const ripple = useRef<THREE.Mesh>(null);
  const fishGeometry = useMemo(() => caughtFishGeometry(), []);
  const tip = useMemo(() => new THREE.Vector3(), []);
  const line = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(9), 3));
    return new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: "#fff3cf", transparent: true, opacity: 0.9 }));
  }, []);
  const waterY = groundY(POND.x, POND.z) + 0.59;

  useFrame(() => {
    const f = rt.fishing;
    if (!group.current) return;
    group.current.visible = f !== null;
    if (!f || !rig.rodTip.current) return;
    const age = Math.max(0, rt.time - f.t0);
    let bx = f.x;
    let bz = f.z;
    let by = waterY + Math.sin(rt.time * 5) * 0.025;
    rig.rodTip.current.updateWorldMatrix(true, false);
    rig.rodTip.current.getWorldPosition(tip);
    if (f.phase === "cast") {
      const t = Math.min(1, age / 0.38);
      bx = THREE.MathUtils.lerp(tip.x, bx, t);
      bz = THREE.MathUtils.lerp(tip.z, bz, t);
      by = THREE.MathUtils.lerp(tip.y, waterY, t) + Math.sin(t * Math.PI) * 0.7;
    } else if (f.phase === "bite") {
      by -= Math.min(1, age / 0.12) * 0.12;
    }
    if (bobber.current) {
      bobber.current.position.set(bx, by, bz);
      bobber.current.visible = f.phase !== "reel";
    }
    const points = line.geometry.getAttribute("position") as THREE.BufferAttribute;
    points.setXYZ(0, tip.x, tip.y, tip.z);
    points.setXYZ(1, (tip.x + bx) / 2, (tip.y + by) / 2 - 0.12, (tip.z + bz) / 2);
    points.setXYZ(2, bx, by, bz);
    points.needsUpdate = true;
    line.geometry.computeBoundingSphere();
    if (fish.current) {
      fish.current.visible = f.phase === "reel";
      const t = Math.min(1, age / 0.45);
      fish.current.position.set(
        THREE.MathUtils.lerp(bx, rt.player.x, t * 0.7),
        waterY + 0.12 + Math.sin(t * Math.PI) * 1.15,
        THREE.MathUtils.lerp(bz, rt.player.z, t * 0.7)
      );
      fish.current.rotation.set(Math.sin(t * Math.PI * 2) * 0.65, f.yaw, Math.sin(t * Math.PI * 4) * 0.25);
    }
    if (ripple.current) {
      ripple.current.visible = f.phase === "bite" || f.phase === "reel";
      ripple.current.position.set(bx, waterY + 0.01, bz);
      ripple.current.scale.setScalar(0.35 + Math.min(age, 0.8) * 1.4);
    }
  });

  return (
    <group ref={group} visible={false}>
      <primitive object={line} />
      <group ref={bobber}>
        <mesh position={[0, 0.035, 0]}>
          <sphereGeometry args={[0.085, 10, 8]} />
          <meshLambertMaterial color="#f36b46" />
        </mesh>
        <mesh position={[0, 0.13, 0]}>
          <cylinderGeometry args={[0.019, 0.019, 0.17, 6]} />
          <meshLambertMaterial color="#fff3ce" />
        </mesh>
      </group>
      <mesh ref={fish} geometry={fishGeometry} material={smoothMat} visible={false} />
      <mesh ref={ripple} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <ringGeometry args={[0.32, 0.37, 24]} />
        <meshBasicMaterial color="#d7f1eb" transparent opacity={0.6} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

export function Player() {
  const rig = useRig();
  const lastStep = useRef(0);
  const focusT = useRef(0);
  const seaT = useRef(0);
  const kaiObstacle = useMemo<Obstacles>(() => ({ circles: [{ x: 0, z: 0, r: 0.4 }], rects: [] }), []);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const p = rt.player;
    const g = getGame();
    const canMove =
      g.screen === "game" && (g.mode === "explore" || g.mode === "place") && !g.settingsOpen && rt.time >= p.frozenUntil && p.lying < 0.05;

    let mx = 0;
    let my = 0;
    if (canMove) {
      const k = keyboardMove();
      mx = Math.max(-1, Math.min(1, k.x + rt.joy.x));
      my = Math.max(-1, Math.min(1, k.y + rt.joy.y));
    }
    const yaw = rt.camera.yaw;
    const fx = -Math.sin(yaw);
    const fz = -Math.cos(yaw);
    const rx = Math.cos(yaw);
    const rz = -Math.sin(yaw);
    let dx = rx * mx + fx * my;
    let dz = rz * mx + fz * my;
    const len = Math.hypot(dx, dz);
    if (len > 1) {
      dx /= len;
      dz /= len;
    }
    const wantRun = keys.has("ShiftLeft") || keys.has("ShiftRight") || rt.runToggle;
    p.running = wantRun && len > 0.1 && canRun(rt.stats.stamina, p.exhausted);
    const top = p.running ? RUN : WALK;
    const accel = Math.min(1, dt * 10);
    p.vx += (dx * top - p.vx) * accel;
    p.vz += (dz * top - p.vz) * accel;
    if (!canMove) {
      p.vx *= 0.6;
      p.vz *= 0.6;
    }
    const speed = Math.hypot(p.vx, p.vz);
    p.speed = speed;
    if (speed > 0.01) {
      kaiObstacle.circles[0].x = rt.kai.x;
      kaiObstacle.circles[0].z = rt.kai.z;
      const obstacles = [STATIC_OBSTACLES, buildingObstacles(g.buildings), kaiObstacle];
      const steps = Math.max(1, Math.ceil((speed * dt) / 0.1));
      const ox = p.x;
      const oz = p.z;
      for (let i = 0; i < steps; i++) {
        const r = resolveCollisions(p.x + (p.vx * dt) / steps, p.z + (p.vz * dt) / steps, PLAYER_R, obstacles, {
          pathCleared: g.pathCleared,
          bridgeBuilt: g.bridgeBuilt,
          cliffOpen: g.cliffOpen
        });
        p.x = r.x;
        p.z = r.z;
      }
      rt.walked += Math.hypot(p.x - ox, p.z - oz);
    }
    if (speed > 0.3) {
      const target = Math.atan2(p.vx, p.vz);
      let d = target - p.yaw;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      p.yaw += d * Math.min(1, dt * 11);
    }
    p.y = groundY(p.x, p.z);
    p.lying += (p.lyingTarget - p.lying) * Math.min(1, dt * 2.2);

    // ---- animation
    const moving = Math.min(1, speed / WALK);
    const runK = Math.max(0, Math.min(1, (speed - WALK) / (RUN - WALK)));
    p.step += dt * speed * 2.7;
    const swing = Math.sin(p.step) * (0.55 + runK * 0.35) * moving;
    let armLx = -swing * 0.8;
    let armRx = swing * 0.8;
    let bend = runK * 0.18;
    let bodyY = Math.abs(Math.cos(p.step)) * (0.04 + runK * 0.05) * moving + Math.sin(rt.time * 2.2) * 0.006;
    const act = p.action;
    if (act) {
      const actionKind: string = act.kind;
      const duration = actionKind === "craft" || actionKind === "build" ? 0.9 : actionKind === "chop" || actionKind === "drink" ? 0.75 : 0.55;
      const t = (rt.time - act.t0) / duration;
      if (t >= 1) p.action = null;
      else if (actionKind === "gather") {
        const e = ease(t);
        bend = 0.75 * e;
        bodyY -= 0.2 * e;
        armLx = armRx = -1.2 * e;
      } else if (actionKind === "eat") {
        armRx = -2.3 * ease(Math.min(1, t * 1.6));
        bodyY += Math.sin(t * Math.PI * 6) * 0.01;
      } else if (actionKind === "drink") {
        const lift = Math.min(1, t / 0.25, (1 - t) / 0.2);
        armRx = -2.35 * lift;
        bend = -0.08 * lift;
      } else if (actionKind === "chop") {
        const smooth = (v: number) => v * v * (3 - 2 * v);
        if (t < 0.3) {
          armRx = THREE.MathUtils.lerp(0, -2.65, smooth(t / 0.3));
        } else if (t < 0.62) {
          armRx = THREE.MathUtils.lerp(-2.65, 0.5, smooth((t - 0.3) / 0.32));
        } else {
          armRx = THREE.MathUtils.lerp(0.5, 0, smooth((t - 0.62) / 0.38));
        }
        armLx = -1.05 * ease(t);
        bend = 0.3 * ease(t);
      } else if (actionKind === "craft" || actionKind === "build") {
        const hit = Math.abs(Math.sin(t * Math.PI * 3));
        armRx = -1.6 + hit * 0.9;
        armLx = -0.7;
        bend = 0.25;
      }
    }
    if (rt.pushT0 >= 0 && rt.time - rt.pushT0 < 1.4) {
      armLx = armRx = -1.5;
      bend = 0.35;
    }
    if (g.inCave) armRx = -1.15;
    const activeKind: string | undefined = act?.kind;
    if (rig.axe.current) rig.axe.current.visible = activeKind === "chop" && act !== null && (rt.time - act.t0) / 0.75 < 1;
    if (rig.cup.current) rig.cup.current.visible = activeKind === "drink" && p.action !== null;
    if (rig.rod.current) rig.rod.current.visible = rt.fishing !== null;
    if (rt.fishing) {
      const f = rt.fishing;
      const age = Math.max(0, rt.time - f.t0);
      armLx = -1.05;
      if (f.phase === "cast") {
        armRx = THREE.MathUtils.lerp(-2.8, -1.4, Math.min(1, age / 0.38));
      } else if (f.phase === "reel") {
        armRx = -1.9 + Math.sin(age * 16) * 0.15;
        bend = -0.08;
      } else {
        armRx = -1.4 + Math.sin(rt.time * 2) * 0.025;
      }
    }
    if (rig.legL.current) rig.legL.current.rotation.x = swing;
    if (rig.legR.current) rig.legR.current.rotation.x = -swing;
    if (rig.armL.current) rig.armL.current.rotation.x = armLx;
    if (rig.armR.current) rig.armR.current.rotation.x = armRx;
    if (rig.pose.current) {
      rig.pose.current.rotation.x = bend - p.lying * (Math.PI / 2 - 0.05);
      rig.pose.current.position.y = bodyY + p.lying * 0.2;
      rig.pose.current.position.z = -p.lying * 0.6;
    }
    if (rig.root.current) {
      rig.root.current.position.set(p.x, p.y, p.z);
      rig.root.current.rotation.y = p.yaw;
    }
    const stepIndex = Math.floor(p.step / Math.PI);
    if (stepIndex !== lastStep.current) {
      lastStep.current = stepIndex;
      if (moving > 0.3) audio.play("step");
    }

    // ---- what can be used from here (a few times a second is enough)
    focusT.current += dt;
    if (focusT.current > 0.1) {
      focusT.current = 0;
      const focus = g.screen === "game" && g.mode === "explore" ? findFocus(p.x, p.z, p.yaw) : null;
      if ((focus?.id ?? null) !== (g.focus?.id ?? null)) setGame({ focus });
    }
    seaT.current += dt;
    if (seaT.current > 0.5) {
      seaT.current = 0;
      audio.setSeaNearness(Math.max(0, Math.min(1, 1 - (shoreZ(p.x) - p.z) / 16)));
    }
  });

  return (
    <group>
      <KidMesh outfit={PLAYER_OUTFIT} rig={rig} torch />
      <FishingTackle rig={rig} />
    </group>
  );
}

/** "!" bubble texture over Kai until you have met him. */
function bangTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  g.fillStyle = "#ffd23a";
  g.strokeStyle = "#3b2a1c";
  g.lineWidth = 5;
  g.beginPath();
  g.arc(32, 30, 24, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  g.fillStyle = "#3b2a1c";
  g.font = "bold 38px system-ui, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText("!", 32, 32);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function Kai() {
  const rig = useRig();
  const bang = useRef<THREE.Sprite>(null);
  const bangMat = useMemo(() => new THREE.SpriteMaterial({ map: bangTexture(), depthTest: false, transparent: true }), []);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const k = rt.kai;
    const p = rt.player;
    const g = getGame();
    let moving = 0;
    if (k.route.length && !g.inCave) {
      let remaining = WALK * dt;
      while (remaining > 0 && k.route.length) {
        const point = k.route[0];
        const ax = point.x - k.x;
        const az = point.z - k.z;
        const d = Math.hypot(ax, az);
        const step = Math.min(remaining, d);
        if (d > 0.0001) {
          k.x += ax / d * step;
          k.z += az / d * step;
          k.yaw = Math.atan2(ax, az);
          moving = 1;
        }
        remaining -= step;
        if (d <= step + 0.0001) k.route.shift();
        else break;
      }
    } else if (k.walkTo && !g.inCave) {
      const ax = k.walkTo.x - k.x;
      const az = k.walkTo.z - k.z;
      const d = Math.hypot(ax, az);
      if (d < 0.08) {
        k.yaw = Math.atan2(k.walkTo.face.x - k.x, k.walkTo.face.z - k.z);
        k.walkTo = null;
      } else {
        const v = Math.min(2.8, d * 3) * dt;
        const r = resolveCollisions(k.x + (ax / d) * v, k.z + (az / d) * v, 0.35, [STATIC_OBSTACLES, buildingObstacles(g.buildings)], {
          pathCleared: g.pathCleared,
          bridgeBuilt: g.bridgeBuilt,
          cliffOpen: g.cliffOpen
        });
        k.x = r.x;
        k.z = r.z;
        k.yaw = Math.atan2(ax, az);
        moving = 1;
      }
    } else {
      // Turn to watch the player when they are near.
      const dp = Math.hypot(p.x - k.x, p.z - k.z);
      if (dp < 7 || k.talking) {
        const target = Math.atan2(p.x - k.x, p.z - k.z);
        let d = target - k.yaw;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        k.yaw += d * Math.min(1, dt * 3);
      }
    }
    k.speed = moving ? (k.walkTo ? 2.8 : WALK) : 0;
    k.step += dt * (moving ? 7.5 : 0);
    const swing = Math.sin(k.step) * 0.55 * moving;
    const wave = !g.metKai && !k.talking && g.screen === "game" && Math.hypot(p.x - k.x, p.z - k.z) < 30;
    const talking = k.talking && tts.isSpeaking();
    if (rig.legL.current) rig.legL.current.rotation.x = swing;
    if (rig.legR.current) rig.legR.current.rotation.x = -swing;
    if (rig.armL.current) rig.armL.current.rotation.x = -swing * 0.8;
    if (rig.armR.current) {
      if (wave && !moving) {
        rig.armR.current.rotation.x = -2.6;
        rig.armR.current.rotation.z = 0.5 + Math.sin(rt.time * 9) * 0.35;
      } else {
        rig.armR.current.rotation.x = talking ? -0.5 + Math.sin(rt.time * 5) * 0.25 : swing * 0.8;
        rig.armR.current.rotation.z = 0.12;
      }
    }
    if (rig.pose.current) {
      rig.pose.current.position.y = Math.sin(rt.time * 2) * 0.012 + (talking ? Math.abs(Math.sin(rt.time * 9)) * 0.015 : 0);
      const pushing = rt.pushT0 >= 0 && rt.time - rt.pushT0 < 1.4;
      rig.pose.current.rotation.x = pushing ? 0.35 : 0;
      if (pushing) {
        if (rig.armL.current) rig.armL.current.rotation.x = -1.5;
        if (rig.armR.current) rig.armR.current.rotation.x = -1.5;
      }
    }
    const y = groundY(k.x, k.z);
    if (rig.root.current) {
      rig.root.current.visible = !g.inCave;
      rig.root.current.position.set(k.x, y, k.z);
      rig.root.current.rotation.y = k.yaw;
    }
    if (bang.current) {
      bang.current.visible = !g.inCave && !g.metKai && !k.talking && g.screen === "game";
      bang.current.position.set(k.x, y + 2.25 + Math.sin(rt.time * 3) * 0.08, k.z);
    }
  });

  return (
    <group>
      <KidMesh outfit={KAI_OUTFIT} rig={rig} scale={1.1} />
      <sprite ref={bang} material={bangMat} scale={[0.6, 0.6, 1]} renderOrder={5} />
    </group>
  );
}
