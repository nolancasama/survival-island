import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { rt } from "../game/runtime";
import { useGame } from "../game/store";
import { groundY } from "../game/world/island";
import {
  CAVE_BOX, CAVE_CHAMBER, CAVE_EXIT, CLIFF_PATH, CLIFF_PATH_R,
  CLIFFTOP, HELICOPTER_PAD, RESCUE_SECONDS, ROCKFALL, SIGNAL_PAD
} from "../game/world/phase3";
import { PartBuilder } from "./partBuilder";
import { flatMat, glowTexture, occluderMat } from "./materials";
import { rockGeometry } from "./models/nature";
import {
  caveCrystalsGeometry, caveShellGeometry, helicopterGeometry,
  helicopterRotorGeometry, oldBoxGeometry, signalFireGeometry, signalPadGeometry
} from "./models/phase3";

function CaveInterior() {
  const opened = useGame((s) => s.caveBoxOpened);
  const lid = useRef<THREE.Group>(null);
  const shell = useMemo(() => caveShellGeometry(CAVE_CHAMBER.x, CAVE_CHAMBER.z), []);
  const crystals = useMemo(() => caveCrystalsGeometry(CAVE_CHAMBER.x, CAVE_CHAMBER.z), []);
  const crystalMat = useMemo(() => new THREE.MeshLambertMaterial({ vertexColors: true, emissive: "#3a7895", emissiveIntensity: 0.72, flatShading: true }), []);
  const daylight = useMemo(() => new THREE.MeshBasicMaterial({ color: "#c6e1dd", map: glowTexture(), transparent: true, opacity: 0.48, depthWrite: false, side: THREE.DoubleSide }), []);
  const base = useMemo(() => oldBoxGeometry(false), []);
  const top = useMemo(() => oldBoxGeometry(true), []);
  useFrame(() => {
    const t = opened ? (rt.caveBoxOpenT0 < 0 ? 1 : THREE.MathUtils.smoothstep(rt.time - rt.caveBoxOpenT0, 0, 0.9)) : 0;
    if (lid.current) lid.current.rotation.x = -t * 1.85;
  });
  return (
    <group>
      <mesh geometry={shell} material={occluderMat} userData={{ cameraCollider: true }} />
      <mesh geometry={crystals} material={crystalMat} />
      <mesh material={daylight} position={[CAVE_EXIT.x, 0.035, CAVE_EXIT.z - 1.2]} rotation={[-Math.PI / 2, 0, 0]} scale={[6, 8, 1]}><planeGeometry args={[1, 1]} /></mesh>
      <mesh material={daylight} position={[CAVE_EXIT.x, 1.6, CAVE_EXIT.z + 0.9]} scale={[4, 4.5, 1]}><planeGeometry args={[1, 1]} /></mesh>
      <group position={[CAVE_BOX.x, 0, CAVE_BOX.z]} rotation={[0, CAVE_BOX.rot, 0]}>
        <mesh geometry={base} material={flatMat} />
        <group ref={lid} position={[0, 0.86, -0.54]}><mesh geometry={top} material={flatMat} /></group>
      </group>
    </group>
  );
}

function northTerrainGeometry(): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(160, 44, 128, 60);
  g.rotateX(-Math.PI / 2);
  g.translate(0, 0, -73);
  const p = g.attributes.position;
  const colors = new Float32Array(p.count * 3);
  const color = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const z = p.getZ(i);
    p.setY(i, groundY(x, z));
    const plateau = Math.hypot(x - CLIFFTOP.x, z - CLIFFTOP.z) < CLIFFTOP.r + 0.8;
    color.set(plateau ? "#b6a57b" : "#7c8670").multiplyScalar(0.96 + Math.sin(i * 19.3) * 0.035);
    colors.set([color.r, color.g, color.b], i * 3);
  }
  g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return g;
}

function cliffDetailsGeometry(): THREE.BufferGeometry {
  const b = new PartBuilder(0.2);
  for (let i = 1; i < CLIFF_PATH.length; i++) {
    const a = CLIFF_PATH[i - 1];
    const c = CLIFF_PATH[i];
    const distance = Math.hypot(c.x - a.x, c.z - a.z);
    const steps = Math.ceil(distance / 0.65);
    for (let k = 0; k < steps; k++) {
      const u = (k + 0.5) / steps;
      const x = a.x + (c.x - a.x) * u;
      const z = a.z + (c.z - a.z) * u;
      b.boxAt(CLIFF_PATH_R * 1.85, 0.055, distance / steps + 0.03, [x, groundY(x, z) + 0.035, z], [0, Math.atan2(c.x - a.x, c.z - a.z), 0], k % 3 ? "#b7a080" : "#c1ac89");
    }
  }
  for (let i = 0; i < 36; i++) {
    const a = i * Math.PI / 18;
    const x = CLIFFTOP.x + Math.cos(a) * (CLIFFTOP.r + 0.1);
    const z = CLIFFTOP.z + Math.sin(a) * (CLIFFTOP.r + 0.1);
    if (z > -73.6 && x < 27.5) continue;
    b.add(rockGeometry(0.58, 0.72, 410 + i, 0), i % 2 ? "#aaa898" : "#8d9586", [x, groundY(x, z) + 0.05, z], [0, a, 0]);
  }
  return b.build();
}

function Rockfall() {
  const opened = useGame((s) => s.cliffOpen);
  const mesh = useRef<THREE.InstancedMesh>(null);
  const rock = useMemo(() => {
    const b = new PartBuilder(0.3);
    b.add(rockGeometry(1, 1, 432, 0), "#93958a", [0, 0, 0]);
    return b.build();
  }, []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useFrame(() => {
    if (!mesh.current) return;
    const t = opened ? (rt.cliffOpenT0 < 0 ? 1 : THREE.MathUtils.smoothstep(rt.time - rt.cliffOpenT0, 0, 1.8)) : 0;
    for (let i = 0; i < 7; i++) {
      const side = i % 2 ? 1 : -1;
      const x = ROCKFALL.x + side * (0.25 + (i % 3) * 0.65 + t * (2.9 + (i % 2) * 0.5));
      const z = ROCKFALL.z - 1.1 - Math.floor(i / 2) * 0.55 + t * (i % 3 - 1) * 0.6;
      const size = i < 3 ? 1.3 : 0.85;
      dummy.position.set(x, groundY(x, z) + size * 0.3 + Math.sin(t * Math.PI) * 0.25, z);
      dummy.rotation.set(t * side * 1.7, i * 1.5, t * side * 1.2);
      dummy.scale.set(size, size * 0.9, size);
      dummy.updateMatrix();
      mesh.current.setMatrixAt(i, dummy.matrix);
    }
    mesh.current.instanceMatrix.needsUpdate = true;
    mesh.current.computeBoundingSphere();
  });
  return <instancedMesh ref={mesh} args={[rock, occluderMat, 7]} frustumCulled={false} userData={{ cameraCollider: true }} />;
}

function SignalFire() {
  const lit = useGame((s) => s.signalLit);
  const group = useRef<THREE.Group>(null);
  const flame = useRef<THREE.InstancedMesh>(null);
  const smoke = useRef<THREE.InstancedMesh>(null);
  const pad = useMemo(signalPadGeometry, []);
  const logs = useMemo(signalFireGeometry, []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const flameMat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#ffae38", transparent: true, opacity: 0.9 }), []);
  const smokeGeo = useMemo(() => {
    const g = new THREE.PlaneGeometry(1, 1);
    g.setAttribute("puffAlpha", new THREE.InstancedBufferAttribute(new Float32Array(32), 1));
    return g;
  }, []);
  const smokeMat = useMemo(() => {
    const mat = new THREE.MeshBasicMaterial({ color: "#b4b4aa", map: glowTexture(), transparent: true, depthWrite: false, opacity: 0.65 });
    mat.onBeforeCompile = (shader) => {
      shader.vertexShader = "attribute float puffAlpha; varying float vPuffAlpha;\n" + shader.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\nvPuffAlpha = puffAlpha;");
      shader.fragmentShader = "varying float vPuffAlpha;\n" + shader.fragmentShader.replace("#include <color_fragment>", "#include <color_fragment>\ndiffuseColor.a *= vPuffAlpha;");
    };
    return mat;
  }, []);
  useFrame(({ camera }) => {
    if (!group.current || !flame.current || !smoke.current) return;
    const grow = !lit ? 0 : rt.signalLitT0 < 0 ? 1 : THREE.MathUtils.smoothstep(rt.time - rt.signalLitT0, 0, 1.4);
    group.current.visible = lit;
    group.current.scale.setScalar(Math.max(0.001, grow));
    if (!lit) return;
    for (let i = 0; i < 9; i++) {
      const a = i * 2.4;
      const flicker = 0.85 + Math.sin(rt.time * (9 + i) + i) * 0.15;
      dummy.position.set(Math.cos(a) * (i % 3) * 0.21, 1.05 + (i % 2) * 0.2, Math.sin(a) * (i % 3) * 0.21);
      dummy.rotation.set(0.12 * Math.sin(rt.time * 5 + i), a, 0.12 * Math.cos(rt.time * 6 + i));
      dummy.scale.set(0.45 * flicker, (1.4 + (i % 3) * 0.4) * flicker, 0.45 * flicker);
      dummy.updateMatrix();
      flame.current.setMatrixAt(i, dummy.matrix);
    }
    flame.current.instanceMatrix.needsUpdate = true;
    const alpha = smokeGeo.attributes.puffAlpha as THREE.InstancedBufferAttribute;
    for (let i = 0; i < 32; i++) {
      const age = (rt.time * 0.14 + i / 32) % 1;
      const size = 0.9 + age * 4.4;
      dummy.position.set(age * 3.2 + Math.sin(i * 2.4 + rt.time * 0.2) * age, 2.2 + age * 16, Math.cos(i * 2.1) * age * 0.8);
      dummy.quaternion.copy(camera.quaternion);
      dummy.scale.set(size, size * 1.3, size);
      dummy.updateMatrix();
      smoke.current.setMatrixAt(i, dummy.matrix);
      alpha.setX(i, Math.sin(age * Math.PI) * 0.72 * grow);
    }
    alpha.needsUpdate = true;
    smoke.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <group position={[SIGNAL_PAD.x, groundY(SIGNAL_PAD.x, SIGNAL_PAD.z), SIGNAL_PAD.z]}>
      <mesh geometry={pad} material={flatMat} />
      <group ref={group} visible={lit}>
        <mesh geometry={logs} material={flatMat} />
        <instancedMesh ref={flame} args={[undefined, flameMat, 9]} frustumCulled={false}><coneGeometry args={[1, 1, 6]} /></instancedMesh>
        <instancedMesh ref={smoke} args={[smokeGeo, smokeMat, 32]} frustumCulled={false} />
      </group>
    </group>
  );
}

export function Helicopter() {
  const group = useRef<THREE.Group>(null);
  const rotor = useRef<THREE.Mesh>(null);
  const tail = useRef<THREE.Mesh>(null);
  const body = useMemo(helicopterGeometry, []);
  const mainRotor = useMemo(() => helicopterRotorGeometry(), []);
  const tailRotor = useMemo(() => helicopterRotorGeometry(true), []);
  useFrame(() => {
    if (!group.current) return;
    group.current.visible = rt.rescueT0 >= 0;
    if (rt.rescueT0 < 0) return;
    const t = Math.max(0, rt.time - rt.rescueT0);
    const p = HELICOPTER_PAD;
    let x = p.x;
    let z = p.z;
    const landingY = p.y - 0.16;
    let y = landingY;
    let yaw = 0;
    let bank = 0;
    if (t < 3) {
      const u = THREE.MathUtils.smoothstep(t, 0, 3);
      x = p.x + (1 - u) * 12;
      z = p.z + 15 + (1 - u) * 120;
      y = landingY + 15 + (1 - u) * 10;
      yaw = THREE.MathUtils.lerp(0.1, -Math.PI / 2, THREE.MathUtils.smoothstep(t, 2, 3));
      bank = -0.16 * THREE.MathUtils.smoothstep(t, 2.5, 3);
    } else if (t < 8.5) {
      const a = (t - 3) / 5.5 * Math.PI * 2;
      x = p.x + Math.sin(a) * 15;
      z = p.z + Math.cos(a) * 15;
      y = landingY + 15 - (t - 3) / 5.5 * 6;
      yaw = a - Math.PI / 2;
      bank = -0.16 * (1 - THREE.MathUtils.smoothstep(t, 8, 8.5));
    } else if (t < RESCUE_SECONDS) {
      const u = THREE.MathUtils.smoothstep(t, 8.5, RESCUE_SECONDS);
      z = p.z + (1 - u) * 15;
      y = landingY + (1 - u) * 9;
      yaw = -Math.PI / 2 * (1 - u);
    }
    group.current.position.set(x, y, z);
    group.current.rotation.set(0, yaw, bank);
    if (rotor.current) rotor.current.rotation.y = rt.time * 44;
    if (tail.current) tail.current.rotation.y = rt.time * 58;
  });
  return (
    <group ref={group} visible={false} scale={0.72}>
      <mesh geometry={body} material={flatMat} />
      <mesh ref={rotor} geometry={mainRotor} material={flatMat} position={[0, 2.98, 0]} />
      <group position={[0.18, 2.55, 5]} rotation={[0, 0, Math.PI / 2]}><mesh ref={tail} geometry={tailRotor} material={flatMat} /></group>
    </group>
  );
}

export function Phase3World() {
  const inCave = useGame((s) => s.inCave);
  const terrain = useMemo(northTerrainGeometry, []);
  const details = useMemo(cliffDetailsGeometry, []);
  return (
    <>
      <group visible={inCave}><CaveInterior /></group>
      <group visible={!inCave}>
        <mesh geometry={terrain} material={flatMat} />
        <mesh geometry={details} material={occluderMat} />
        <Rockfall />
        <SignalFire />
        <Helicopter />
      </group>
    </>
  );
}
