import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { rt } from "../game/runtime";
import { getGame } from "../game/store";
import { groundY } from "../game/world/island";
import { additiveSprite } from "./materials";

const COUNT = 36;
const COLORS = ["#ffd23a", "#ff7a59", "#7ad7ff", "#9dff8a", "#ffffff", "#ff9ad5"];

/** Celebration: sparkles burst up from the campfire and drift down. */
export function Celebration() {
  const mats = useMemo(() => COLORS.map((c) => additiveSprite(c, 1)), []);
  const seeds = useMemo(
    () =>
      Array.from({ length: COUNT }, (_, i) => ({
        a: (i / COUNT) * Math.PI * 2 + (i % 5) * 0.3,
        v: 3.5 + (i % 7) * 0.45,
        up: 5 + (i % 4) * 1.1,
        delay: (i % 6) * 0.12,
        m: i % COLORS.length
      })),
    []
  );
  const refs = useRef<Array<THREE.Sprite | null>>([]);
  useFrame(() => {
    const t = rt.time - rt.celebrateT0;
    const on = t >= 0 && t < 4.5;
    const fire = getGame().buildings.find((b) => b.lit);
    seeds.forEach((s, i) => {
      const sp = refs.current[i];
      if (!sp) return;
      const tt = t - s.delay;
      sp.visible = on && tt > 0 && Boolean(fire);
      if (!sp.visible || !fire) return;
      const x = fire.x + Math.cos(s.a) * s.v * Math.min(tt, 1.6) * 0.5;
      const z = fire.z + Math.sin(s.a) * s.v * Math.min(tt, 1.6) * 0.5;
      const y = groundY(fire.x, fire.z) + 0.8 + s.up * tt - 4.2 * tt * tt * 0.5;
      sp.position.set(x, Math.max(0.2, y), z);
      sp.scale.setScalar(0.3 * Math.max(0, 1 - tt / 4) + 0.05);
      mats[s.m].opacity = 1;
    });
  });
  return (
    <group>
      {seeds.map((s, i) => (
        <sprite key={i} ref={(el) => void (refs.current[i] = el)} material={mats[s.m]} visible={false} />
      ))}
    </group>
  );
}
