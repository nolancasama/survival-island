import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { rt } from "../game/runtime";
import { getGame } from "../game/store";
import { groundY } from "../game/world/island";
import { updateOccluderFade } from "./materials";

/** The live camera, for projecting world labels to the screen. */
export const cameraRef: { current: THREE.PerspectiveCamera | null } = { current: null };

/**
 * Third-person camera: steady, smoothed, no bobbing or automatic spinning.
 * Drag turns it. Scripted shots (Kai conversations, the celebration) ease in.
 */
export function CameraRig() {
  const { camera, scene } = useThree();
  const pos = useRef(new THREE.Vector3(0, 6, 20));
  const look = useRef(new THREE.Vector3());
  const want = useRef(new THREE.Vector3());
  const wantLook = useRef(new THREE.Vector3());
  const probe = useMemo(() => new THREE.Vector3(), []);
  const ray = useMemo(() => new THREE.Raycaster(), []);
  const colliders = useRef<THREE.Object3D[]>([]);
  const ready = useRef(false);

  useEffect(() => {
    colliders.current = [];
    scene.traverse((object) => {
      if (object.userData.cameraCollider) colliders.current.push(object);
    });
  }, [scene]);

  /** Raise the endpoint until the whole player-to-camera ray clears the land. */
  const terrainLift = (target: THREE.Vector3, candidate: THREE.Vector3): number => {
    let lift = 0;
    for (let i = 2; i <= 16; i++) {
      const u = i / 16;
      probe.lerpVectors(target, candidate, u);
      const floor = groundY(probe.x, probe.z) + 0.78;
      const lineY = probe.y + lift * u;
      if (lineY < floor) lift += (floor - lineY) / u;
    }
    return Math.min(lift, 10);
  };

  /** True when authored cliff/headland geometry crosses the short camera ray. */
  const firstTerrainHit = (target: THREE.Vector3, candidate: THREE.Vector3): THREE.Intersection | undefined => {
    probe.subVectors(candidate, target);
    const distance = probe.length();
    if (distance < 0.1 || !colliders.current.length) return undefined;
    ray.set(target, probe.multiplyScalar(1 / distance));
    ray.near = 0.65;
    ray.far = distance;
    return ray.intersectObjects(colliders.current, false)[0];
  };

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    cameraRef.current = camera as THREE.PerspectiveCamera;
    const c = rt.camera;
    const g = getGame();
    if (g.screen === "title") {
      // Slow drift along the beach behind the title card.
      const t = rt.time * 0.05;
      want.current.set(Math.sin(t) * 14 - 2, 5.2, 26 + Math.cos(t * 0.7) * 2);
      wantLook.current.set(Math.sin(t) * 10 - 4, 2.4, 4);
    } else if (g.screen === "dayEnd") {
      const fire = g.buildings.find((b) => b.lit);
      const cx = fire?.x ?? rt.player.x;
      const cz = fire?.z ?? rt.player.z;
      const t = rt.time * 0.08;
      want.current.set(cx + Math.sin(t) * 8, 3.6, cz + Math.cos(t) * 8);
      wantLook.current.set(cx, 1, cz);
    } else if (c.mode === "shot" && c.shot) {
      want.current.set(c.shot.pos.x, c.shot.pos.y, c.shot.pos.z);
      wantLook.current.set(c.shot.target.x, c.shot.target.y, c.shot.target.z);
    } else {
      const p = rt.player;
      const ty = p.y + 1.15 + rt.player.lying * -0.5;
      const horiz = c.dist * Math.cos(c.pitch);
      want.current.set(p.x + Math.sin(c.yaw) * horiz, ty + c.dist * Math.sin(c.pitch), p.z + Math.cos(c.yaw) * horiz);
      wantLook.current.set(p.x, ty, p.z);

      // The ground cannot use the visual fade. Lift over analytical terrain,
      // then try a few low-cost clear rays over the authored cliff meshes.
      want.current.y += terrainLift(wantLook.current, want.current);
      let hit = firstTerrainHit(wantLook.current, want.current);
      if (hit) {
        const baseY = want.current.y;
        for (const extra of g.inCave ? [] : [1.5, 3, 5, 8]) {
          want.current.y = baseY + extra;
          hit = firstTerrainHit(wantLook.current, want.current);
          if (!hit) break;
        }
        if (hit) {
          probe.subVectors(want.current, wantLook.current);
          const distance = probe.length();
          const safeDistance = Math.max(g.inCave ? 0.6 : 2.6, hit.distance - 0.9);
          want.current.copy(wantLook.current).addScaledVector(probe, safeDistance / distance);
          want.current.y += terrainLift(wantLook.current, want.current);
        }
      }
    }
    // Never dip under the sand or the sea.
    const floor = Math.max(groundY(want.current.x, want.current.z), -0.45) + 0.8;
    if (want.current.y < floor) want.current.y = floor;
    if (!ready.current || c.snap) {
      pos.current.copy(want.current);
      look.current.copy(wantLook.current);
      ready.current = true;
      c.snap = false;
    }
    const k = 1 - Math.exp(-dt * (c.mode === "follow" && g.screen === "game" ? 6 : 2.6));
    pos.current.lerp(want.current, k);
    look.current.lerp(wantLook.current, k);
    camera.position.copy(pos.current);
    camera.lookAt(look.current);
    updateOccluderFade(
      camera,
      probe.set(rt.player.x, rt.player.y + 1.05 + rt.player.lying * -0.5, rt.player.z),
      c.mode === "follow" && g.screen === "game"
    );
    c.pos.x = pos.current.x;
    c.pos.y = pos.current.y;
    c.pos.z = pos.current.z;
    c.target.x = look.current.x;
    c.target.y = look.current.y;
    c.target.z = look.current.z;
  });
  return null;
}
