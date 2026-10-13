import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { rt } from "../game/runtime";
import { getGame } from "../game/store";
import { groundY } from "../game/world/island";

/** The live camera, for projecting world labels to the screen. */
export const cameraRef: { current: THREE.PerspectiveCamera | null } = { current: null };

/**
 * Third-person camera: steady, smoothed, no bobbing or automatic spinning.
 * Drag turns it. Scripted shots (Kai conversations, the celebration) ease in.
 */
export function CameraRig() {
  const { camera } = useThree();
  const pos = useRef(new THREE.Vector3(0, 6, 20));
  const look = useRef(new THREE.Vector3());
  const want = useRef(new THREE.Vector3());
  const wantLook = useRef(new THREE.Vector3());
  const ready = useRef(false);

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
    c.pos.x = pos.current.x;
    c.pos.y = pos.current.y;
    c.pos.z = pos.current.z;
    c.target.x = look.current.x;
    c.target.y = look.current.y;
    c.target.z = look.current.z;
  });
  return null;
}
