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
import { additiveSprite, occluderMat } from "./materials";
import { between } from "./models/nature";

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

/** Bare A-frame placed before the shelter is built. Local +z is the open front. */
export function shelterFrameGeometry(): THREE.BufferGeometry {
  const b = new PartBuilder(0.35);
  const wood = "#7a5532";
  for (const z of [-1.15, 1.15]) {
    between(b, [-1.45, 0, z], [0, 2.45, z], 0.09, 0.07, wood, 6);
    between(b, [1.45, 0, z], [0, 2.45, z], 0.09, 0.07, wood, 6);
  }
  between(b, [0, 2.45, -1.35], [0, 2.45, 1.35], 0.08, 0.08, "#6a4527", 6);
  between(b, [-1.2, 0.38, -1.2], [-1.2, 0.38, 1.2], 0.06, 0.06, wood, 5);
  between(b, [1.2, 0.38, -1.2], [1.2, 0.38, 1.2], 0.06, 0.06, wood, 5);
  return b.build();
}

/** Leaf roof only; kept separate so it can drop onto the frame. */
export function shelterRoofGeometry(): THREE.BufferGeometry {
  const b = new PartBuilder(0.2);
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < 7; i++) {
      const z = -1.35 + i * 0.45;
      b.boxAt(1.72, 0.07, 0.52, [side * 0.72, 1.68, z], [0, 0, side * -0.88], i % 2 ? "#4fa046" : "#3e8d3e");
    }
  }
  return b.build();
}

function ShelterRoof({ b, geometry }: { b: PlacedBuilding; geometry: THREE.BufferGeometry }) {
  const roof = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (!roof.current) return;
    const t0 = rt.builtT0.get(b.id);
    const t = t0 === undefined || t0 < 0 ? 1 : Math.max(0, Math.min(1, (rt.time - t0) / 0.9));
    const eased = 1 - Math.pow(1 - t, 3);
    roof.current.position.y = (1 - eased) * 1.8;
    roof.current.scale.set(0.82 + eased * 0.18, Math.max(0.04, eased), 0.82 + eased * 0.18);
  });
  return <mesh ref={roof} geometry={geometry} material={occluderMat} />;
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
  const fireGeo = useMemo(campfireGeometry, []);
  const shelterFrame = useMemo(shelterFrameGeometry, []);
  const shelterRoof = useMemo(shelterRoofGeometry, []);
  return (
    <group>
      {buildings.map((b) => {
        const shelter = b.type === "shelter";
        return (
          <group key={b.id} position={[b.x, groundY(b.x, b.z), b.z]} rotation={[0, b.rot, 0]}>
            <mesh geometry={shelter ? shelterFrame : fireGeo} material={occluderMat} />
            {shelter && b.built && <ShelterRoof b={b} geometry={shelterRoof} />}
            {!shelter && b.lit && <Flame b={b} />}
          </group>
        );
      })}
      <FireLight />
      <Preview fireGeo={fireGeo} shelterFrame={shelterFrame} shelterRoof={shelterRoof} />
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
function Preview({
  fireGeo,
  shelterFrame,
  shelterRoof
}: {
  fireGeo: THREE.BufferGeometry;
  shelterFrame: THREE.BufferGeometry;
  shelterRoof: THREE.BufferGeometry;
}) {
  const root = useRef<THREE.Group>(null);
  const fire = useRef<THREE.Mesh>(null);
  const frame = useRef<THREE.Mesh>(null);
  const roof = useRef<THREE.Mesh>(null);
  const footprintRing = useRef<THREE.Mesh>(null);
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
    if (fire.current) fire.current.visible = type !== "shelter";
    if (frame.current) frame.current.visible = type === "shelter";
    if (roof.current) roof.current.visible = type === "shelter";
    const p = rt.player;
    const spot = previewSpot(p.x, p.z, cameraForwardYaw(rt.camera.yaw));
    const keepClear = [
      ...NODES.filter((n) => !rt.taken.has(n.id)).map((n) => ({ x: n.x, z: n.z, r: 0.45 })),
      { x: rt.kai.x, z: rt.kai.z, r: 0.6 },
      { x: p.x, z: p.z, r: 0.4 },
      { x: CRATE.x, z: CRATE.z, r: 0.8 }
    ];
    const problem = placeProblem(
      type,
      spot.x,
      spot.z,
      [STATIC_OBSTACLES, buildingObstacles(g.buildings)],
      keepClear,
      { pathCleared: g.pathCleared, bridgeBuilt: g.bridgeBuilt }
    );
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
    footprintRing.current?.scale.setScalar(FOOTPRINT[type]);
  });
  return (
    <group ref={root} visible={false}>
      <mesh ref={fire} geometry={fireGeo} material={ghost} />
      <mesh ref={frame} geometry={shelterFrame} material={ghost} visible={false} />
      <mesh ref={roof} geometry={shelterRoof} material={ghost} visible={false} />
      <mesh ref={footprintRing} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} material={ring}>
        <ringGeometry args={[0.92, 1, 32]} />
      </mesh>
    </group>
  );
}
