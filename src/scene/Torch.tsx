import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { rt } from "../game/runtime";
import { getGame } from "../game/store";
import { PartBuilder } from "./partBuilder";
import { smoothMat } from "./materials";

export function Torch() {
  const root = useRef<THREE.Group>(null);
  const flame = useRef<THREE.Group>(null);
  const tip = useMemo(() => new THREE.Vector3(), []);
  const handle = useMemo(() => {
    const b = new PartBuilder(0);
    b.cyl(0.035, 0.045, 0.62, 0, -0.15, 0, "#815332", 7);
    b.cyl(0.09, 0.07, 0.17, 0, 0.38, 0, "#c59c66", 7);
    for (const y of [0.4, 0.46, 0.52]) b.torus(0.085, 0.012, [0, y, 0], [Math.PI / 2, 0, 0], "#755038");
    return b.build();
  }, []);
  useFrame(() => {
    if (!root.current || !flame.current) return;
    root.current.visible = getGame().inCave;
    if (!root.current.visible) return;
    const f = 1 + Math.sin(rt.time * 11) * 0.12 + Math.sin(rt.time * 19) * 0.06;
    flame.current.scale.set(1 / Math.sqrt(f), f, 1 / Math.sqrt(f));
    root.current.updateWorldMatrix(true, true);
    flame.current.getWorldPosition(tip);
    Object.assign(rt.torchTip, { x: tip.x, y: tip.y, z: tip.z });
  });
  return (
    <group ref={root} rotation={[1.15, 0, 0]} visible={false}>
      <mesh geometry={handle} material={smoothMat} />
      <group ref={flame} position={[0, 0.62, 0]}>
        <mesh>
          <coneGeometry args={[0.12, 0.34, 7]} />
          <meshBasicMaterial color="#ff8125" transparent opacity={0.9} depthWrite={false} />
        </mesh>
        <mesh position={[0, -0.045, 0.025]}>
          <coneGeometry args={[0.065, 0.22, 6]} />
          <meshBasicMaterial color="#ffe383" />
        </mesh>
      </group>
    </group>
  );
}
