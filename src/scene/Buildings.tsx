import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { rt } from "../game/runtime";
import { getGame, setGame, useGame } from "../game/store";
import { ITEMS } from "../game/types";
import { CRATE, NODES, groundY } from "../game/world/island";
import { STATIC_OBSTACLES } from "../game/world/collision";
import { FOOTPRINT, buildingObstacles, cameraForwardYaw, placeProblem, previewSpot, type PlacedBuilding } from "../game/world/placement";
import { audio } from "../audio/audio";
import { PartBuilder } from "./partBuilder";
import { additiveSprite, flatMat } from "./materials";

export function campfireGeometry(): THREE.BufferGeometry {
  const b = new PartBuilder(0.2);
  b.cyl(0.62, 0.66, 0.03, 0, 0, 0, "#5a4a3a", 14);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    b.sphere(0.17, Math.cos(a) * 0.6, 0.1, Math.sin(a) * 0.6, i % 2 ? "#9aa0aa" : "#b5bbc4", [1, 0.75, 1], 7);
  }
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    // Teepee: each log's top leans in toward the centre.
    b.cylAt(0.08, 1.0, [Math.cos(a) * 0.2, 0.36, Math.sin(a) * 0.2], [-0.55 * Math.sin(a), 0, 0.55 * Math.cos(a)], i % 2 ? "#a8693a" : "#8a5a33", 6);
  }
  return b.build();
}

/** Flickering flame cones, embers and a glow (one lit campfire). */
function Flame({ b }: { b: PlacedBuilding }) {
  const group = useRef<THREE.Group>(null);
  const cones = useRef<Array<THREE.Mesh | null>>([]);
  const embers = useRef<Array<THREE.Sprite | null>>([]);
  const outer = useMemo(() => new THREE.MeshBasicMaterial({ color: "#ff7a1a", transparent: true, opacity: 0.9, depthWrite: false }), []);
  const inner = useMemo(() => new THREE.MeshBasicMaterial({ color: "#ffd84a", transparent: true, opacity: 0.95, depthWrite: false }), []);
  const glowMat = useMemo(() => additiveSprite("#ff9a3a", 0.7), []);
  const emberMat = useMemo(() => additiveSprite("#ffb54a", 1), []);
  const seeds = useMemo(() => Array.from({ length: 8 }, (_, i) => ({ a: i * 2.4, s: 0.6 + (i % 3) * 0.25, o: i * 0.37 })), []);
  useFrame(() => {
    const t0 = rt.fireT0.get(b.id) ?? -10;
    const grow = Math.min(1, (rt.time - t0) / 0.8);
    const t = rt.time;
    if (group.current) group.current.scale.setScalar(Math.max(0.01, grow));
    cones.current.forEach((c, i) => {
      if (!c) return;
      const f = 1 + Math.sin(t * (9 + i * 2.3) + i) * 0.12 + Math.sin(t * 17 + i * 3) * 0.06;
      c.scale.set(1, f, 1);
      c.rotation.y = t * (i % 2 ? 1.5 : -1.2);
    });
    embers.current.forEach((e, i) => {
      if (!e) return;
      const sd = seeds[i];
      const life = ((t * sd.s + sd.o) % 1 + 1) % 1;
      e.position.set(Math.sin(sd.a + t) * 0.25 * life, 0.4 + life * 2.2, Math.cos(sd.a + t * 0.7) * 0.25 * life);
      e.scale.setScalar(0.12 * (1 - life));
    });
    emberMat.opacity = 0.9;
  });
  return (
    <group ref={group} position={[0, 0.15, 0]}>
      <mesh ref={(el) => void (cones.current[0] = el)} material={outer} position={[0, 0.42, 0]}>
        <coneGeometry args={[0.38, 0.95, 7]} />
      </mesh>
      <mesh ref={(el) => void (cones.current[1] = el)} material={outer} position={[0.12, 0.3, 0.05]}>
        <coneGeometry args={[0.24, 0.65, 6]} />
      </mesh>
      <mesh ref={(el) => void (cones.current[2] = el)} material={inner} position={[0, 0.32, 0]}>
        <coneGeometry args={[0.22, 0.6, 6]} />
      </mesh>
      <sprite material={glowMat} position={[0, 0.45, 0]} scale={[2.6, 2.6, 1]} />
      {seeds.map((_, i) => (
        <sprite key={i} ref={(el) => void (embers.current[i] = el)} material={emberMat} />
      ))}
    </group>
  );
}

export function Buildings() {
  const buildings = useGame((s) => s.buildings);
  const geo = useMemo(campfireGeometry, []);
  return (
    <group>
      {buildings.map((b) => (
        <group key={b.id} position={[b.x, groundY(b.x, b.z), b.z]} rotation={[0, b.rot, 0]}>
          <mesh geometry={geo} material={flatMat} />
          {b.lit && <Flame b={b} />}
        </group>
      ))}
      <FireLight />
      <Preview geo={geo} />
    </group>
  );
}

/** One point light, always present (changing light counts recompiles shaders), at the nearest lit fire. */
function FireLight() {
  const light = useRef<THREE.PointLight>(null);
  useFrame(() => {
    const l = light.current;
    if (!l) return;
    const lit = getGame().buildings.filter((b) => b.lit);
    if (!lit.length) {
      l.intensity = 0;
      audio.setFire(0);
      return;
    }
    const p = rt.player;
    let best = lit[0];
    let bd = Infinity;
    for (const b of lit) {
      const d = Math.hypot(b.x - p.x, b.z - p.z);
      if (d < bd) {
        bd = d;
        best = b;
      }
    }
    const t0 = rt.fireT0.get(best.id) ?? -10;
    const grow = Math.min(1, (rt.time - t0) / 0.8);
    const night = 1 - rt.light;
    l.position.set(best.x, groundY(best.x, best.z) + 1.1, best.z);
    l.intensity = grow * (4 + night * 14) * (1 + Math.sin(rt.time * 13) * 0.06 + Math.sin(rt.time * 7.3) * 0.05);
    l.distance = 9 + night * 8;
    audio.setFire(Math.max(0, 1 - bd / 14));
  });
  return <pointLight ref={light} color="#ff9a4a" intensity={0} distance={12} decay={1.4} />;
}

/** Transparent preview while placing: green where it fits, red where it does not. */
function Preview({ geo }: { geo: THREE.BufferGeometry }) {
  const root = useRef<THREE.Group>(null);
  const ghost = useMemo(() => new THREE.MeshBasicMaterial({ color: "#6dff8a", transparent: true, opacity: 0.55, depthWrite: false }), []);
  const ring = useMemo(() => new THREE.MeshBasicMaterial({ color: "#6dff8a", transparent: true, opacity: 0.5, depthWrite: false }), []);
  const green = useMemo(() => new THREE.Color("#6dff8a"), []);
  const red = useMemo(() => new THREE.Color("#ff5a4a"), []);
  useFrame(() => {
    const g = getGame();
    const r = root.current;
    if (!r) return;
    const placing = g.mode === "place" && g.placing && rt.place.visible;
    r.visible = Boolean(placing);
    if (!placing || !g.placing) return;
    const type = ITEMS[g.placing.item].places!;
    const p = rt.player;
    const spot = previewSpot(p.x, p.z, cameraForwardYaw(rt.camera.yaw));
    const keepClear = [
      ...NODES.filter((n) => !rt.taken.has(n.id)).map((n) => ({ x: n.x, z: n.z, r: 0.45 })),
      { x: rt.kai.x, z: rt.kai.z, r: 0.6 },
      { x: p.x, z: p.z, r: 0.4 },
      { x: CRATE.x, z: CRATE.z, r: 0.8 }
    ];
    const problem = placeProblem(type, spot.x, spot.z, [STATIC_OBSTACLES, buildingObstacles(g.buildings)], keepClear);
    rt.place.x = spot.x;
    rt.place.z = spot.z;
    rt.place.ok = problem === null;
    if (problem !== g.placing.problem) setGame({ placing: { ...g.placing, problem } });
    const c = problem ? red : green;
    ghost.color.copy(c);
    ring.color.copy(c);
    ghost.opacity = 0.45 + Math.sin(rt.time * 6) * 0.1;
    r.position.set(spot.x, groundY(spot.x, spot.z) + 0.02, spot.z);
    r.rotation.y = rt.place.rot;
    r.children[1].scale.setScalar(FOOTPRINT[type]);
  });
  return (
    <group ref={root} visible={false}>
      <mesh geometry={geo} material={ghost} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} material={ring}>
        <ringGeometry args={[0.92, 1, 32]} />
      </mesh>
    </group>
  );
}
