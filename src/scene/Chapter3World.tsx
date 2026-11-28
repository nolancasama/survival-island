import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { rt } from "../game/runtime";
import { getGame, useGame } from "../game/store";
import { SEA_Y, groundY } from "../game/world/island";
import { CLIMB_PATH, CONTAINER_SPECS, FORD, PLUNGE_POOL, SHELF, TANGLE, UPPER_POOL, isUpperWater, shelfWaterY } from "../game/world/chapter3";
import { isContainer, pipeEnv } from "../game/world/pipeWorld";
import { POUR_REACH, WATER_SPEED, nodeOf, type Network } from "../game/logic/waterworks";
import { currentFlow, pourArrival } from "../game/flow/chapter3";
import { flatMat, occluderMat } from "./materials";
import { labelTexture } from "./Environment";
import { signPostGeometry } from "./models/props";
import {
  bucketGeometry, driftingWreckageGeometry, fallsGeometries, fallsTexture, pipeNetworkGeometry, tangleGeometry, tankGeometry, upperSceneryGeometry, upperWaterGeometries
} from "./models/chapter3";

/**
 * Chapter 3 in the scene (EXPANSION_PLAN.md Milestone 4): the Upper Stream
 * and its falls, the fallen bamboo on the stairs, the bucket and the tank, the
 * player's pipes, the water running in them, and the laying preview. Static
 * scenery is a few merged meshes drawn near the shelf (one cheap far mesh
 * keeps the high waterfall as a landmark); all moving water is one instanced
 * mesh, so the network costs the same few draw calls however big it gets.
 */

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const smooth = (v: number) => {
  const t = clamp01(v);
  return t * t * (3 - 2 * t);
};
/** The shelf's detail is drawn only with the camera this close to it (draw-call budget). */
const NEAR = 90;
const SHELF_CENTRE = { x: SHELF.x, z: SHELF.z };
/**
 * Pipes, water, containers and the fallen bamboo are small: from farther than
 * this (the clifftop is about 97 m away) they are not drawn at all.
 */
const nearUpper = (camera: THREE.Camera) => Math.hypot(camera.position.x - (SHELF_CENTRE.x + 12), camera.position.z - (SHELF_CENTRE.z + 4)) < NEAR;

function merged(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const g = mergeGeometries(parts, false)!;
  parts.forEach((p) => p.dispose());
  g.computeBoundingSphere();
  return g;
}

// ------------------------------------------------------------ the Upper Stream

/** Signs at both ways up: the stairs' foot on the beach, and the climb's start by the pond. */
const SIGNS = [
  { x: -35.9, z: 0.5, yaw: 1.2 },
  { x: CLIMB_PATH[0].x - 5, z: CLIMB_PATH[0].z + 0.2, yaw: 0.9 }
] as const;

function UpperStream() {
  const camera = useThree((st) => st.camera);
  const scenery = useMemo(() => merged([
    upperSceneryGeometry(),
    ...SIGNS.map((s) => signPostGeometry().rotateY(s.yaw).translate(s.x, groundY(s.x, s.z), s.z))
  ]), []);
  const water = useMemo(() => merged(upperWaterGeometries()), []);
  const falls = useMemo(() => merged(fallsGeometries()), []);
  const far = useMemo(() => merged([fallsGeometries()[0]]), []);
  const waterMat = useMemo(() => new THREE.MeshLambertMaterial({ color: "#4fb1bb", transparent: true, opacity: 0.84, depthWrite: false }), []);
  const fallsMat = useMemo(() => new THREE.MeshBasicMaterial({ map: fallsTexture(), transparent: true, opacity: 0.88, depthWrite: false, side: THREE.DoubleSide }), []);
  const labels = useMemo(() => {
    const label = labelTexture("WATERFALL");
    const parts = SIGNS.map((s) => {
      const plane = new THREE.PlaneGeometry(1.32, 0.42);
      plane.translate(0, 1.46, 0.101);
      return plane.rotateY(s.yaw).translate(s.x, groundY(s.x, s.z), s.z);
    });
    return { geometry: merged(parts), material: new THREE.MeshLambertMaterial({ map: label }) };
  }, []);
  // White water where the falls land.
  const foam = useRef<THREE.InstancedMesh>(null);
  const foamMat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#f4fbff", transparent: true, opacity: 0.7, depthWrite: false }), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const near = useRef<THREE.Group>(null);
  const farMesh = useRef<THREE.Mesh>(null);
  const signMesh = useRef<THREE.Mesh>(null);
  const spots = useMemo(() => [
    { x: UPPER_POOL.x - 1.1, y: shelfWaterY(UPPER_POOL.x) + 0.03, z: UPPER_POOL.z, r: 1.0 },
    { x: PLUNGE_POOL.x - 0.6, y: PLUNGE_POOL.y + 0.03, z: PLUNGE_POOL.z, r: 0.85 },
    { x: FORD.x, y: shelfWaterY(FORD.x) + 0.02, z: FORD.z, r: 0.5 }
  ], []);
  useFrame(() => {
    const d = Math.hypot(camera.position.x - SHELF_CENTRE.x, camera.position.z - SHELF_CENTRE.z);
    const isNear = d < NEAR && !getGame().inCave;
    if (near.current) near.current.visible = isNear;
    if (farMesh.current) farMesh.current.visible = !isNear && !getGame().inCave;
    if (signMesh.current) signMesh.current.visible = SIGNS.some((s) => Math.hypot(camera.position.x - s.x, camera.position.z - s.z) < 45);
    fallsMat.map!.offset.y = (rt.time * 1.4) % 1;
    waterMat.opacity = 0.8 + Math.sin(rt.time * 0.7) * 0.04;
    const f = foam.current;
    if (!f || !isNear) return;
    for (let i = 0; i < spots.length * 2; i++) {
      const s = spots[i % spots.length];
      const phase = (rt.time * 0.9 + i * 0.37) % 1;
      dummy.position.set(s.x + Math.sin(i * 2.1) * 0.2, s.y, s.z + Math.cos(i * 1.7) * 0.2);
      dummy.rotation.set(-Math.PI / 2, 0, 0);
      dummy.scale.setScalar(s.r * (0.5 + phase * 0.7));
      dummy.updateMatrix();
      f.setMatrixAt(i, dummy.matrix);
    }
    f.instanceMatrix.needsUpdate = true;
    foamMat.opacity = 0.55;
  });
  return (
    <group>
      <group ref={near}>
        <mesh geometry={scenery} material={occluderMat} userData={{ cameraCollider: true }} />
        <mesh geometry={water} material={waterMat} renderOrder={1} />
        <mesh geometry={falls} material={fallsMat} renderOrder={2} />
        <instancedMesh ref={foam} args={[undefined, foamMat, 6]} frustumCulled={false} renderOrder={3}>
          <circleGeometry args={[1, 10]} />
        </instancedMesh>
      </group>
      <mesh ref={farMesh} geometry={far} material={fallsMat} visible={false} />
      <mesh ref={signMesh} geometry={labels.geometry} material={labels.material} />
    </group>
  );
}

// ------------------------------------------------------------- Day 5's wreckage

/** Wreckage drifting off the east headland toward the next cove. In the cove from Chapter 2 on, so drawn only before then. */
export const DRIFT = { x: 66, z: 27 } as const;

function DriftingWreckage() {
  const geo = useMemo(driftingWreckageGeometry, []);
  const m = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const mesh = m.current;
    if (!mesh) return;
    const g = getGame();
    mesh.visible = !g.coveOpen && g.quest.day <= 5 && g.screen !== "title";
    if (!mesh.visible) return;
    mesh.position.set(DRIFT.x, SEA_Y + Math.sin(rt.time * 0.8) * 0.06, DRIFT.z);
    mesh.rotation.set(Math.sin(rt.time * 0.6) * 0.02, 0.3, Math.cos(rt.time * 0.5) * 0.02);
  });
  return <mesh ref={m} geometry={geo} material={flatMat} visible={false} />;
}

// ------------------------------------------------------------------ the tangle

/** The fallen bamboo across the top of the stairs. Cutting it rolls it aside, where it stays. */
function Tangle() {
  const geo = useMemo(tangleGeometry, []);
  const g = useRef<THREE.Group>(null);
  const base = useMemo(() => ({ x: TANGLE.x, y: groundY(TANGLE.x, TANGLE.z), z: TANGLE.z }), []);
  const camera = useThree((st) => st.camera);
  useFrame(() => {
    const m = g.current;
    if (!m) return;
    m.visible = nearUpper(camera);
    const open = getGame().stairsOpen;
    const k = !open ? 0 : rt.stairsOpenT0 < 0 ? 1 : smooth((rt.time - rt.stairsOpenT0) / 0.9);
    // Aside: pushed off the stairs toward the cliff edge, lying lower.
    const side = { x: Math.sin(TANGLE.rot + Math.PI / 2) * 2.4, z: Math.cos(TANGLE.rot + Math.PI / 2) * 2.4 };
    m.position.set(base.x + side.x * k, base.y - 0.35 * k + Math.sin(k * Math.PI) * 0.4, base.z + side.z * k);
    m.rotation.set(0, TANGLE.rot + k * 0.6, k * 0.3);
  });
  return (
    <group ref={g}>
      <mesh geometry={geo} material={occluderMat} />
    </group>
  );
}

// ------------------------------------------------------------- containers

function Containers() {
  const buildings = useGame((s) => s.buildings);
  const containers = buildings.filter((b) => b.type === "bucket" || b.type === "tank");
  return <>{containers.map((b) => <Container key={b.id} id={b.id} />)}</>;
}

const containerWater = new THREE.MeshLambertMaterial({ color: "#59b8d6", transparent: true, opacity: 0.86, depthWrite: false });

/** A bucket or tank, its water rising with what it holds. */
function Container({ id }: { id: string }) {
  const type = useGame((s) => s.buildings.find((b) => b.id === id)?.type);
  const model = useMemo(() => (type === "tank" ? tankGeometry() : bucketGeometry()), [type]);
  const g = useRef<THREE.Group>(null);
  const water = useRef<THREE.Mesh>(null);
  const camera = useThree((st) => st.camera);
  useFrame(() => {
    const b = getGame().buildings.find((x) => x.id === id);
    const m = g.current;
    if (!b || !m || !isContainer(b.type)) return;
    // Like the cove's props: not drawn from far away (the clifftop's draw-call budget).
    m.visible = Math.hypot(camera.position.x - b.x, camera.position.z - b.z) < 70;
    const spec = CONTAINER_SPECS[b.type];
    m.position.set(b.x, groundY(b.x, b.z), b.z);
    m.rotation.y = b.rot;
    const w = water.current;
    if (w) {
      const level = clamp01((b.water ?? 0) / spec.capacity);
      w.visible = level > 0.01;
      w.position.y = 0.06 + level * (spec.rim - 0.1);
      w.scale.setScalar(spec.radius * 0.9);
    }
  });
  return (
    <group ref={g}>
      <mesh geometry={model} material={flatMat} />
      <mesh ref={water} material={containerWater} rotation={[-Math.PI / 2, 0, 0]} renderOrder={1}>
        <circleGeometry args={[1, 16]} />
      </mesh>
    </group>
  );
}

/** The tank between the player and Kai while they carry it. */
function CarriedTank() {
  const geo = useMemo(tankGeometry, []);
  const m = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const mesh = m.current;
    const g = getGame();
    if (!mesh) return;
    mesh.visible = g.carry === "tank" && !g.inCave;
    if (!mesh.visible) return;
    const p = rt.player;
    const k = rt.kai;
    const lift = smooth((rt.time - rt.carry.liftT0) / 0.5);
    const x = (p.x + k.x) / 2;
    const z = (p.z + k.z) / 2;
    mesh.position.set(x, groundY(x, z) + 0.05 + lift * 0.45 + Math.sin(p.step * 2) * 0.02 * Math.min(1, p.speed), z);
    mesh.rotation.set(0, Math.atan2(k.x - p.x, k.z - p.z), 0);
    mesh.scale.setScalar(0.85);
  });
  return <mesh ref={m} geometry={geo} material={flatMat} visible={false} />;
}

// ------------------------------------------------------------------ pipes

/** The network as one mesh, rebuilt only when the network changes. */
function Pipes() {
  const water = useGame((s) => s.water);
  // The pipes' shape depends only on the network and the ground (not on containers filling).
  const geo = useMemo(() => pipeNetworkGeometry(water, pipeEnv([])), [water]);
  useEffect(() => () => geo.dispose(), [geo]);
  const camera = useThree((st) => st.camera);
  const mesh = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (mesh.current) mesh.current.visible = nearUpper(camera);
  });
  return <mesh ref={mesh} geometry={geo} material={flatMat} />;
}

const FX = 220;
const WATER_COLOR = new THREE.Color("#4fb8e6");
const SPARKLE = new THREE.Color("#e9f8ff");
const SPLASH = new THREE.Color("#cfefff");

/**
 * Every moving bit of water in one instanced mesh: the water running along
 * each wet pipe (it arrives from the intake), little bright ripples showing
 * which way it flows, pours from open ends, overflows at a climbing pipe, and
 * splashes where water lands.
 */
function WaterFx() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.9, depthWrite: false }), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const a = useMemo(() => new THREE.Vector3(), []);
  const c = useMemo(() => new THREE.Vector3(), []);
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const camera = useThree((st) => st.camera);
  useFrame(() => {
    const m = mesh.current;
    if (!m) return;
    const g = getGame();
    let n = 0;
    const put = (color: THREE.Color) => {
      dummy.updateMatrix();
      m.setMatrixAt(n, dummy.matrix);
      m.setColorAt(n, color);
      n++;
    };
    /** A thin box from p to q. */
    const bar = (p: THREE.Vector3, q: THREE.Vector3, w: number, h: number, color: THREE.Color) => {
      if (n >= FX) return;
      const len = p.distanceTo(q);
      if (len < 0.01) return;
      dummy.position.copy(p).add(q).multiplyScalar(0.5);
      dummy.quaternion.setFromUnitVectors(up, q.clone().sub(p).normalize());
      dummy.scale.set(w, len, h);
      put(color);
    };
    const splash = (x: number, y: number, z: number, size: number, i: number) => {
      if (n >= FX) return;
      const phase = (rt.time * 2.2 + i * 0.31) % 1;
      dummy.position.set(x, y + 0.02, z);
      dummy.quaternion.identity();
      dummy.scale.set(size * (0.4 + phase), 0.012, size * (0.4 + phase));
      put(SPLASH);
    };
    const landing = (x: number, z: number, into: string | null) => {
      const b = into ? g.buildings.find((x2) => x2.id === into) : null;
      if (b && isContainer(b.type)) {
        const spec = CONTAINER_SPECS[b.type];
        return groundY(b.x, b.z) + 0.06 + clamp01((b.water ?? 0) / spec.capacity) * (spec.rim - 0.1);
      }
      return isUpperWater(x, z) ? shelfWaterY(x) : groundY(x, z) + 0.02;
    };
    const visible = !g.inCave && g.water.pipes.length > 0;
    if (visible) {
      const { env, flow } = currentFlow();
      const net = g.water;
      const now = rt.time;
      // Water along the pipes, as far as it has run.
      for (const w of flow.wet) {
        const pipe = net.pipes.find((p) => p.id === w.id);
        const timing = rt.water.start.get(w.id);
        if (!pipe || !timing) continue;
        const from = nodeOf(net, env, pipe.from);
        const to = nodeOf(net, env, pipe.to);
        if (!from || !to) continue;
        const k = clamp01((now - timing.t) / timing.dur);
        if (k <= 0) continue;
        a.set(from.x, from.y + 0.035, from.z);
        c.set(to.x, to.y + 0.035, to.z);
        const end = a.clone().lerp(c, k);
        bar(a, end, 0.11, 0.025, WATER_COLOR);
        // Ripples moving down the pipe.
        if (k >= 1) {
          const len = Math.hypot(to.x - from.x, to.z - from.z);
          for (let r = 0; r < 2; r++) {
            const s = ((now * WATER_SPEED + r * len * 0.5 + w.d0) % len) / len;
            const p0 = a.clone().lerp(c, s);
            const p1 = a.clone().lerp(c, Math.min(1, s + 0.06));
            p0.y += 0.012;
            p1.y += 0.012;
            bar(p0, p1, 0.045, 0.012, SPARKLE);
          }
        }
      }
      // Pours from open ends.
      flow.pours.forEach((pour, i) => {
        if (now < pourArrival(pour.at)) return;
        const y0 = pour.y + 0.02;
        const y1 = landing(pour.px, pour.pz, pour.into);
        a.set(pour.x + pour.dirX * POUR_REACH * 0.8, y0, pour.z + pour.dirZ * POUR_REACH * 0.8);
        c.set(pour.px, Math.min(y0 - 0.05, y1), pour.pz);
        bar(a, c, 0.06, 0.06, WATER_COLOR);
        for (let d = 0; d < 3; d++) {
          const t = (now * 1.8 + d / 3 + i * 0.2) % 1;
          const p = a.clone().lerp(c, t);
          p.x += Math.sin(d * 7 + i) * 0.04;
          dummy.position.copy(p);
          dummy.quaternion.identity();
          dummy.scale.setScalar(0.05);
          if (n < FX) put(SPARKLE);
        }
        splash(pour.px, y1, pour.pz, 0.35, i);
      });
      // A climbing pipe: the water spills over at the post before it, on both sides.
      flow.overflows.forEach((o, i) => {
        const inPipe = net.pipes.find((p) => p.to === o.at);
        const timing = inPipe ? rt.water.start.get(inPipe.id) : null;
        if (timing && now < timing.t + timing.dur) return;
        const pipe = net.pipes.find((p) => p.id === o.pipe);
        const to = pipe ? nodeOf(net, env, pipe.to) : null;
        const dx = to ? to.x - o.x : 1;
        const dz = to ? to.z - o.z : 0;
        const len = Math.hypot(dx, dz) || 1;
        for (const side of [-1, 1]) {
          const sx = o.x + (-dz / len) * side * 0.16;
          const sz = o.z + (dx / len) * side * 0.16;
          const yl = landing(sx, sz, null);
          a.set(sx, o.y + 0.02, sz);
          c.set(sx + (-dz / len) * side * 0.12, yl, sz + (dx / len) * side * 0.12);
          bar(a, c, 0.05, 0.05, WATER_COLOR);
          splash(c.x, yl, c.z, 0.3, i * 2 + side);
        }
      });
    }
    m.count = n;
    m.visible = n > 0 && nearUpper(camera);
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });
  return (
    <instancedMesh ref={mesh} args={[undefined, mat, FX]} frustumCulled={false} renderOrder={4}>
      <cylinderGeometry args={[0.5, 0.5, 1, 6]} />
    </instancedMesh>
  );
}

// --------------------------------------------------------------- preview

const OK = new THREE.Color("#6dff8a");
const UPHILL = new THREE.Color("#ffb13a");
const BAD = new THREE.Color("#ff5a4a");

/** The piece being laid (a ghost from the open end), and the post being changed. */
function PipePreview() {
  const ghost = useMemo(() => new THREE.MeshBasicMaterial({ color: "#6dff8a", transparent: true, opacity: 0.5, depthWrite: false }), []);
  const ring = useMemo(() => new THREE.MeshBasicMaterial({ color: "#ffe066", transparent: true, opacity: 0.85, depthWrite: false }), []);
  const mesh = useRef<THREE.Mesh>(null);
  const marker = useRef<THREE.Mesh>(null);
  const key = useRef("");
  useFrame(() => {
    const g = getGame();
    const m = mesh.current;
    const mk = marker.current;
    if (!m || !mk) return;
    const ui = g.pipe;
    const plan = rt.pipe.plan;
    m.visible = g.mode === "pipe" && ui?.kind === "lay" && !!plan;
    if (m.visible && plan) {
      // Rebuild the ghost only when the plan changes.
      const k = `${plan.from}|${plan.x.toFixed(2)}|${plan.z.toFixed(2)}|${plan.notch}|${plan.kind}|${plan.snap?.id ?? ""}`;
      if (k !== key.current) {
        key.current = k;
        const from = g.water.joints.find((j) => j.id === plan.from);
        const temp: Network = {
          joints: [...(from ? [from] : []), { id: "jPreview", x: plan.x, z: plan.z, notch: plan.notch }],
          pipes: [{ id: "pPreview", from: plan.from, to: "jPreview", kind: plan.kind }],
          next: 1
        };
        m.geometry.dispose();
        m.geometry = pipeNetworkGeometry(temp, pipeEnv(g.buildings));
      }
      const color = plan.problem ? BAD : ui?.kind === "lay" && (ui.slope === "up" || ui.underRim) ? UPHILL : OK;
      ghost.color.copy(color);
      ghost.opacity = 0.45 + Math.sin(rt.time * 6) * 0.1;
    }
    // A ring at the post being changed, or at the open end being built from.
    const at = ui?.kind === "edit" ? ui.joint : ui?.kind === "lay" ? ui.from : null;
    const node = at ? nodeOf(g.water, currentFlow().env, at) : null;
    mk.visible = g.mode === "pipe" && !!node;
    if (node) {
      mk.position.set(node.x, node.y + 0.12, node.z);
      mk.rotation.set(-Math.PI / 2, 0, rt.time);
      mk.scale.setScalar(1 + Math.sin(rt.time * 5) * 0.08);
    }
  });
  return (
    <group>
      <mesh ref={mesh} material={ghost} visible={false} renderOrder={5} />
      <mesh ref={marker} material={ring} visible={false} renderOrder={5}>
        <ringGeometry args={[0.2, 0.28, 20]} />
      </mesh>
    </group>
  );
}

// ------------------------------------------------------------------

export function Chapter3World() {
  const inCave = useGame((s) => s.inCave);
  return (
    <group visible={!inCave}>
      <UpperStream />
      <DriftingWreckage />
      <Tangle />
      <Containers />
      <CarriedTank />
      <Pipes />
      <WaterFx />
      <PipePreview />
    </group>
  );
}

