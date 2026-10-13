import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { rt } from "../game/runtime";
import { getGame, setGame } from "../game/store";
import { keyboardMove, keys } from "../input/keyboard";
import { groundY, shoreZ } from "../game/world/island";
import { PLAYER_R, STATIC_OBSTACLES, resolveCollisions, type Obstacles } from "../game/world/collision";
import { buildingObstacles } from "../game/world/placement";
import { canRun } from "../game/logic/stats";
import { findFocus } from "../game/flow/focus";
import { audio } from "../audio/audio";
import { tts } from "../audio/tts";
import { smoothMat, shadowMaterial } from "./materials";
import { KAI_OUTFIT, PLAYER_OUTFIT, armGeometry, bodyGeometry, legGeometry, type Outfit } from "./models/people";

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
}

function useRig(): Rig {
  return {
    root: useRef<THREE.Group>(null),
    pose: useRef<THREE.Group>(null),
    legL: useRef<THREE.Group>(null),
    legR: useRef<THREE.Group>(null),
    armL: useRef<THREE.Group>(null),
    armR: useRef<THREE.Group>(null)
  };
}

function KidMesh({ outfit, rig, scale = 1 }: { outfit: Outfit; rig: Rig; scale?: number }) {
  const g = useKid(outfit);
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
        const r = resolveCollisions(p.x + (p.vx * dt) / steps, p.z + (p.vz * dt) / steps, PLAYER_R, obstacles);
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
      const t = (rt.time - act.t0) / (act.kind === "craft" ? 0.9 : 0.55);
      if (t >= 1) p.action = null;
      else if (act.kind === "gather") {
        const e = ease(t);
        bend = 0.75 * e;
        bodyY -= 0.2 * e;
        armLx = armRx = -1.2 * e;
      } else if (act.kind === "eat") {
        armRx = -2.3 * ease(Math.min(1, t * 1.6));
        bodyY += Math.sin(t * Math.PI * 6) * 0.01;
      } else {
        const hit = Math.abs(Math.sin(t * Math.PI * 3));
        armRx = -1.6 + hit * 0.9;
        armLx = -0.7;
        bend = 0.25;
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

  return <KidMesh outfit={PLAYER_OUTFIT} rig={rig} />;
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
    if (k.walkTo) {
      const ax = k.walkTo.x - k.x;
      const az = k.walkTo.z - k.z;
      const d = Math.hypot(ax, az);
      if (d < 0.08) {
        k.yaw = Math.atan2(k.walkTo.face.x - k.x, k.walkTo.face.z - k.z);
        k.walkTo = null;
      } else {
        const v = Math.min(2.8, d * 3) * dt;
        const r = resolveCollisions(k.x + (ax / d) * v, k.z + (az / d) * v, 0.35, [STATIC_OBSTACLES, buildingObstacles(g.buildings)]);
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
    }
    const y = groundY(k.x, k.z);
    if (rig.root.current) {
      rig.root.current.position.set(k.x, y, k.z);
      rig.root.current.rotation.y = k.yaw;
    }
    if (bang.current) {
      bang.current.visible = !g.metKai && !k.talking && g.screen === "game";
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
