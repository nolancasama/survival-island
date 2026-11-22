import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { rt } from "../game/runtime";
import { getGame, useGame } from "../game/store";
import { NODE_BY_ID, SEA_Y, groundY } from "../game/world/island";
import {
  CAMP_SIGN, COVE_BARREL, COVE_CRATE, COVE_HULL, COVE_MAST, COVE_SIGN, GROVE_GATE, GROVE_SIGN, SEA_CHEST, TIDE_WATER
} from "../game/world/chapter2";
import {
  BARREL, CATCHER, CATCHER_CORNERS, CATCHER_SOCKETS, LASH_HEIGHTS, RACK, RACK_SOCKETS, START_HEIGHTS, rackStable, rackSway, toWorld,
  type Socket
} from "../game/logic/structures";
import { flowOf } from "../game/flow/chapter2";
import { socketsOf } from "../game/flow/chapter2Focus";
import type { PlacedBuilding } from "../game/world/placement";
import { PartBuilder } from "./partBuilder";
import { flatMat, occluderMat, smoothMat } from "./materials";
import { labelTexture } from "./Environment";
import { caughtFishGeometry } from "./Characters";
import { crateBodyGeometry, crateLidGeometry, signPostGeometry } from "./models/props";
import {
  bambooPole, bambooStalkGeometry, barrelGeometry, buriedSandGeometry, coveDebrisGeometry, coveHullGeometry, coveMastGeometry,
  coveRocksGeometry, coveShoreGeometry, groveDecorGeometry, seaChestGeometry, thicketGeometry
} from "./models/chapter2";

/**
 * Chapter 2 in the scene (EXPANSION_PLAN.md Milestones 1–3): Shipwreck Cove
 * and its tide, the Bamboo Grove and its thicket, the camp structures (storage
 * box, drying rack, rain catcher, barrel), the thing being carried, and rain.
 * Static scenery is one merged mesh per model; structures rebuild their merged
 * mesh only when their parts change.
 */

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const smooth = (v: number) => {
  const t = clamp01(v);
  return t * t * (3 - 2 * t);
};

// ------------------------------------------------------------------ the cove

function Cove() {
  const coveOpen = useGame((s) => s.coveOpen);
  const coveBoxOpened = useGame((s) => s.coveBoxOpened);
  const rocks = useMemo(coveRocksGeometry, []);
  const shore = useMemo(coveShoreGeometry, []);
  const hull = useMemo(coveHullGeometry, []);
  const mast = useMemo(coveMastGeometry, []);
  const debris = useMemo(coveDebrisGeometry, []);
  const crateBody = useMemo(crateBodyGeometry, []);
  const crateLid = useMemo(crateLidGeometry, []);
  const sand = useMemo(buriedSandGeometry, []);
  const chest = useMemo(seaChestGeometry, []);
  const barrel = useMemo(barrelGeometry, []);
  const lid = useRef<THREE.Group>(null);
  const chestMesh = useRef<THREE.Mesh>(null);
  const barrelMesh = useRef<THREE.Mesh>(null);
  const tide = useRef<THREE.Mesh>(null);
  const tideMat = useMemo(() => new THREE.MeshLambertMaterial({ color: "#3fb6c9", transparent: true, opacity: 0.88, depthWrite: false }), []);
  // The sea over the passage sits just above its highest sand.
  const tideY = useMemo(() => {
    let top = SEA_Y;
    for (let x = TIDE_WATER.x0; x <= TIDE_WATER.x1; x += 0.5) {
      for (let dz = -TIDE_WATER.half; dz <= TIDE_WATER.half; dz += 0.5) top = Math.max(top, groundY(x, TIDE_WATER.z + dz));
    }
    return top + 0.12;
  }, []);
  const crateY = groundY(COVE_CRATE.x, COVE_CRATE.z);

  useFrame(() => {
    const g = getGame();
    if (lid.current) {
      const t = g.coveBoxOpened ? (rt.coveBoxOpenT0 < 0 ? 1 : smooth((rt.time - rt.coveBoxOpenT0) / 0.7)) : 0;
      lid.current.rotation.x = -1.9 * t;
    }
    if (chestMesh.current) chestMesh.current.visible = !g.chestTaken && g.carry !== "chest";
    if (barrelMesh.current) barrelMesh.current.visible = !g.barrelTaken && g.carry !== "barrel";
    const w = tide.current;
    if (w) {
      // Low tide (Day 6): the water drains off the passage over a few seconds.
      const out = g.coveOpen ? (rt.coveOpenT0 < 0 ? 1 : smooth((rt.time - rt.coveOpenT0) / 3)) : 0;
      w.visible = out < 1;
      w.position.y = tideY - out * 0.6 + Math.sin(rt.time * 1.3) * 0.03;
      tideMat.opacity = 0.88 * (1 - out * 0.7);
    }
  });

  return (
    <group>
      <mesh geometry={rocks} material={occluderMat} userData={{ cameraCollider: true }} />
      <mesh geometry={shore} material={flatMat} />
      <mesh geometry={debris} material={flatMat} />
      <group position={[COVE_HULL.x, groundY(COVE_HULL.x, COVE_HULL.z) - 0.1, COVE_HULL.z]} rotation={[0, COVE_HULL.rot, 0]}>
        <mesh geometry={hull} material={occluderMat} />
      </group>
      <group position={[COVE_MAST.x, groundY(COVE_MAST.x, COVE_MAST.z), COVE_MAST.z]} rotation={[0, COVE_MAST.rot, 0]}>
        <mesh geometry={mast} material={flatMat} />
      </group>
      <group position={[COVE_CRATE.x, crateY, COVE_CRATE.z]} rotation={[0, COVE_CRATE.rot, 0]}>
        <mesh geometry={sand} material={flatMat} />
        <mesh geometry={crateBody} material={flatMat} position={[0, -0.3, 0]} />
        <group ref={lid} position={[0, 0.48, -0.53]} rotation={[coveBoxOpened ? -1.9 : 0, 0, 0]}>
          <mesh geometry={crateLid} material={flatMat} />
        </group>
      </group>
      <mesh ref={chestMesh} geometry={chest} material={flatMat}
        position={[SEA_CHEST.x, groundY(SEA_CHEST.x, SEA_CHEST.z), SEA_CHEST.z]} rotation={[0, SEA_CHEST.rot, 0]} />
      <mesh ref={barrelMesh} geometry={barrel} material={flatMat}
        position={[COVE_BARREL.x, groundY(COVE_BARREL.x, COVE_BARREL.z), COVE_BARREL.z]} rotation={[0, COVE_BARREL.rot, 0]} />
      <mesh ref={tide} material={tideMat} visible={!coveOpen}
        position={[(TIDE_WATER.x0 + TIDE_WATER.x1) / 2, tideY, TIDE_WATER.z]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={1}>
        <planeGeometry args={[TIDE_WATER.x1 - TIDE_WATER.x0 + 2, TIDE_WATER.half * 2 + 1.5]} />
      </mesh>
      <Sign at={COVE_SIGN} label="COVE" yaw={-1.15} />
      <Sign at={CAMP_SIGN} label="CAMP" yaw={1.25} />
    </group>
  );
}

function Sign({ at, label, yaw }: { at: { x: number; z: number }; label: string; yaw: number }) {
  const post = useMemo(signPostGeometry, []);
  const mat = useMemo(() => new THREE.MeshLambertMaterial({ map: labelTexture(label) }), [label]);
  return (
    <group position={[at.x, groundY(at.x, at.z), at.z]} rotation={[0, yaw, 0]}>
      <mesh geometry={post} material={flatMat} />
      <mesh material={mat} position={[0, 1.46, 0.101]}><planeGeometry args={[1.32, 0.42]} /></mesh>
    </group>
  );
}

// ------------------------------------------------------------------ the grove

function Grove() {
  const groveOpen = useGame((s) => s.groveOpen);
  const decor = useMemo(groveDecorGeometry, []);
  const thicket = useMemo(thicketGeometry, []);
  const stalk = useMemo(bambooStalkGeometry, []);
  const standing = useRef<THREE.Group>(null);
  const falling = useRef<THREE.Group>(null);
  const gateY = groundY(GROVE_GATE.x, GROVE_GATE.z);

  useFrame(() => {
    const g = getGame();
    const s = standing.current;
    if (s) {
      // Cut on Day 7: the culms tip over away from the player, then lie aside.
      const t = g.groveOpen ? (rt.groveOpenT0 < 0 ? 1 : clamp01((rt.time - rt.groveOpenT0) / 0.9)) : 0;
      s.visible = t < 1;
      s.rotation.z = -t * t * 1.45;
    }
    const f = falling.current;
    if (f) {
      // The most recently cut stalk tips over where it stood.
      let id = "";
      let t0 = -1;
      for (const [k, v] of rt.bambooFall) if (v > t0) [id, t0] = [k, v];
      const n = id ? NODE_BY_ID.get(id) : undefined;
      const t = n ? (rt.time - t0) / 1.3 : 1;
      f.visible = !!n && t < 1;
      if (n && t < 1) {
        f.position.set(n.x, groundY(n.x, n.z) + 0.5, n.z);
        f.rotation.set(0, n.rot, -Math.min(1.5, t * t * 2.2));
        f.scale.setScalar(t > 0.8 ? 1 - (t - 0.8) * 5 : 1);
      }
    }
  });

  return (
    <group>
      <mesh geometry={decor} material={occluderMat} />
      <group position={[GROVE_GATE.x, gateY, GROVE_GATE.z]}>
        <group ref={standing} visible={!groveOpen}>
          <mesh geometry={thicket.standing} material={occluderMat} />
        </group>
        <mesh geometry={thicket.fallen} material={flatMat} visible={groveOpen} />
      </group>
      <group ref={falling} visible={false}>
        <mesh geometry={stalk} material={occluderMat} />
      </group>
      <Sign at={GROVE_SIGN} label="BAMBOO" yaw={-1.2} />
    </group>
  );
}

// ------------------------------------------------------------------ structures

/** One merged mesh of a structure's filled sockets. */
function partsGeometry(sockets: readonly Socket[], parts: readonly string[], skip: (s: Socket) => boolean = () => false) {
  const b = new PartBuilder(0.2);
  for (const s of sockets) {
    if (!parts.includes(s.id) || skip(s)) continue;
    const r = s.kind === "leg" || s.kind === "post" ? 0.05 : 0.04;
    bambooPole(b, s.a, s.b, r);
    // A rope lashing where a bar or brace meets the frame.
    if (s.kind !== "leg" && s.kind !== "post") {
      for (const e of [s.a, s.b]) b.sphere(0.06, e[0], e[1], e[2], "#c9a464", [1, 0.8, 1], 6);
    }
  }
  return b.build();
}

/** Where the dried fish hang on a rack (local), top bars first. */
const FISH_SLOTS: ReadonlyArray<readonly [number, number, number]> = [
  [-0.45, RACK.top, -RACK.halfWidth], [0.45, RACK.top, -RACK.halfWidth],
  [-0.45, RACK.top, RACK.halfWidth], [0.45, RACK.top, RACK.halfWidth],
  [0, RACK.shelf, -RACK.halfWidth], [0, RACK.shelf, RACK.halfWidth]
];

function Rack({ b, fishGeo, driedMat }: { b: PlacedBuilding; fishGeo: THREE.BufferGeometry; driedMat: THREE.Material }) {
  const key = (b.parts ?? []).join(",");
  const geo = useMemo(() => partsGeometry(RACK_SOCKETS, b.parts ?? []), [key]);
  const frame = useRef<THREE.Group>(null);
  useFrame(() => {
    const f = frame.current;
    if (!f) return;
    const parts = b.parts ?? [];
    const sway = rackSway(parts);
    // An unbraced frame racks over when touched; a braced one settles.
    const settle = rt.steadyT0.get(b.id);
    const after = settle === undefined ? 1 : clamp01((rt.time - settle) / 1.2);
    const loose = rackStable(parts) ? (1 - after) * 0.6 : 1;
    const w = Math.sin(rt.time * 3.1) * 0.05 * loose;
    f.rotation.z = sway.along || loose < 1 ? w : 0;
    f.rotation.x = sway.across || loose < 1 ? w * 0.8 : 0;
  });
  const fish = b.fish ?? [];
  return (
    <group position={[b.x, groundY(b.x, b.z), b.z]} rotation={[0, b.rot, 0]}>
      <group ref={frame}>
        <mesh geometry={geo} material={flatMat} />
        {fish.map((left, i) => {
          const s = FISH_SLOTS[i];
          if (!s) return null;
          return (
            <mesh key={i} geometry={fishGeo} material={left > 0 ? smoothMat : driedMat}
              position={[s[0], s[1] - 0.26, s[2]]} rotation={[-Math.PI / 2, 0, 0]} scale={left > 0 ? 1 : [0.9, 0.7, 0.95]} />
          );
        })}
      </group>
    </group>
  );
}

/** The canvas as a 6×6 grid tied at four corner heights, sagging a little in the middle. */
function canvasGeometry(heights: readonly number[]): THREE.BufferGeometry {
  const n = 6;
  const g = new THREE.PlaneGeometry(CATCHER.half * 2, CATCHER.half * 2, n, n);
  g.rotateX(-Math.PI / 2);
  const ys = heights.map((h) => LASH_HEIGHTS[Math.max(0, Math.min(3, Math.round(h)))]);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const u = (p.getX(i) / CATCHER.half + 1) / 2;
    const v = (p.getZ(i) / CATCHER.half + 1) / 2;
    // Corners: 0 (-x,-z), 1 (+x,-z), 2 (+x,+z), 3 (-x,+z).
    const y = ys[0] * (1 - u) * (1 - v) + ys[1] * u * (1 - v) + ys[2] * u * v + ys[3] * (1 - u) * v;
    const sag = Math.sin(u * Math.PI) * Math.sin(v * Math.PI) * 0.12;
    p.setY(i, y - sag);
  }
  g.computeVertexNormals();
  return g;
}

function Catcher({ b, canvasMat, waterMat }: { b: PlacedBuilding; canvasMat: THREE.Material; waterMat: THREE.Material }) {
  const parts = b.parts ?? [];
  const heights = b.heights ?? START_HEIGHTS;
  const key = parts.join(",");
  const hKey = heights.join(",");
  const posts = useMemo(() => partsGeometry(CATCHER_SOCKETS, parts, (s) => s.kind === "canvas"), [key]);
  const sheet = useMemo(() => canvasGeometry(heights), [hKey]);
  const knots = useMemo(() => {
    const k = new PartBuilder(0);
    heights.forEach((h, i) => {
      const [x, z] = CATCHER_CORNERS[i];
      k.sphere(0.08, x, LASH_HEIGHTS[Math.max(0, Math.min(3, Math.round(h)))], z, "#c9a464", [1, 1.3, 1], 6);
    });
    return k.build();
  }, [hKey]);
  const hasCanvas = parts.includes("canvas");
  const streams = useRef<Array<THREE.Mesh | null>>([]);
  const puddles = useRef<Array<THREE.Mesh | null>>([]);

  useFrame(() => {
    const g = getGame();
    const me = g.buildings.find((x) => x.id === b.id);
    const testing = rt.test.id === b.id && rt.time - rt.test.t0 < (g.mode === "explore" ? 2.2 : 60);
    const k = hasCanvas && me ? Math.max(rt.rain.k, testing ? 1 : 0) : 0;
    const flow = k > 0.02 && me ? flowOf(me) : null;
    for (let i = 0; i < 4; i++) {
      const m = streams.current[i];
      const pd = puddles.current[i];
      const s = flow?.streams[i];
      if (m) m.visible = !!s;
      if (pd) pd.visible = !!s && !s.caught;
      if (!s || !m) continue;
      // Caught: it stops at the barrel's water. Missed or too low: it reaches the sand.
      const bottom = s.caught ? BARREL.rim - 0.05 : 0.02;
      const len = Math.max(0.05, s.y - bottom);
      const wob = 1 + Math.sin(rt.time * 23 + i) * 0.15;
      m.position.set(s.x, bottom + len / 2, s.z);
      m.scale.set(wob * (0.5 + s.share * 0.5) * Math.min(1, k * 1.5), len, wob * (0.5 + s.share * 0.5) * Math.min(1, k * 1.5));
      if (pd) {
        pd.position.set(s.x, 0.04, s.z);
        pd.scale.setScalar(0.5 + Math.sin(rt.time * 9 + i) * 0.05 + k * 0.4);
      }
    }
  });

  return (
    <group position={[b.x, groundY(b.x, b.z), b.z]} rotation={[0, b.rot, 0]}>
      <mesh geometry={posts} material={flatMat} />
      {hasCanvas && <mesh geometry={sheet} material={canvasMat} />}
      {hasCanvas && <mesh geometry={knots} material={flatMat} />}
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} ref={(el) => void (streams.current[i] = el)} material={waterMat} visible={false}>
          <cylinderGeometry args={[0.035, 0.05, 1, 6, 1, true]} />
        </mesh>
      ))}
      {[0, 1, 2, 3].map((i) => (
        <mesh key={`p${i}`} ref={(el) => void (puddles.current[i] = el)} material={waterMat} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
          <circleGeometry args={[0.45, 10]} />
        </mesh>
      ))}
    </group>
  );
}

function Barrel({ b, geo, waterMat }: { b: PlacedBuilding; geo: THREE.BufferGeometry; waterMat: THREE.Material }) {
  const water = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const m = water.current;
    if (!m) return;
    const me = getGame().buildings.find((x) => x.id === b.id);
    const cups = me?.water ?? 0;
    m.visible = cups > 0.05;
    m.position.y = 0.1 + (Math.min(BARREL.capacity, cups) / BARREL.capacity) * 0.8;
  });
  return (
    <group position={[b.x, groundY(b.x, b.z), b.z]} rotation={[0, b.rot, 0]}>
      <mesh geometry={geo} material={flatMat} />
      <mesh ref={water} material={waterMat} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <circleGeometry args={[0.34, 12]} />
      </mesh>
    </group>
  );
}

function Structures() {
  const buildings = useGame((s) => s.buildings);
  const chest = useMemo(seaChestGeometry, []);
  const barrel = useMemo(barrelGeometry, []);
  const fishGeo = useMemo(caughtFishGeometry, []);
  const driedMat = useMemo(() => new THREE.MeshLambertMaterial({ color: "#b8793c" }), []);
  const canvasMat = useMemo(() => new THREE.MeshLambertMaterial({ color: "#ece2c6", side: THREE.DoubleSide }), []);
  const waterMat = useMemo(() => new THREE.MeshLambertMaterial({ color: "#7fd3ea", transparent: true, opacity: 0.75, depthWrite: false }), []);
  return (
    <group>
      {buildings.map((b) => {
        if (b.type === "storage") {
          return <mesh key={b.id} geometry={chest} material={flatMat} position={[b.x, groundY(b.x, b.z), b.z]} rotation={[0, b.rot, 0]} />;
        }
        if (b.type === "rack") return <Rack key={b.id} b={b} fishGeo={fishGeo} driedMat={driedMat} />;
        if (b.type === "catcher") return <Catcher key={b.id} b={b} canvasMat={canvasMat} waterMat={waterMat} />;
        if (b.type === "barrel") return <Barrel key={b.id} b={b} geo={barrel} waterMat={waterMat} />;
        return null;
      })}
      <SocketGhost />
    </group>
  );
}

/** A see-through pole (or canvas) where the focused socket's part will go. */
function SocketGhost() {
  const pole = useRef<THREE.Mesh>(null);
  const sheet = useRef<THREE.Mesh>(null);
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#6dff8a", transparent: true, opacity: 0.45, depthWrite: false }), []);
  const from = useMemo(() => new THREE.Vector3(), []);
  const to = useMemo(() => new THREE.Vector3(), []);
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  useFrame(() => {
    const g = getGame();
    const f = g.focus;
    let socket: Socket | undefined;
    let b: PlacedBuilding | undefined;
    if (f?.kind === "socket") {
      const sep = f.id.indexOf(":");
      b = g.buildings.find((x) => x.id === f.id.slice(0, sep));
      socket = b ? socketsOf(b).find((s) => s.id === f.id.slice(sep + 1)) : undefined;
    }
    const p = pole.current;
    const s = sheet.current;
    if (!p || !s) return;
    p.visible = s.visible = false;
    if (!socket || !b) return;
    mat.opacity = 0.35 + Math.sin(rt.time * 5) * 0.12;
    const y0 = groundY(b.x, b.z);
    if (socket.kind === "canvas") {
      s.visible = true;
      s.position.set(b.x, y0 + LASH_HEIGHTS[1], b.z);
      s.rotation.set(-Math.PI / 2, 0, b.rot);
      return;
    }
    const a = toWorld(b, socket.a[0], socket.a[2]);
    const c = toWorld(b, socket.b[0], socket.b[2]);
    from.set(a.x, y0 + socket.a[1], a.z);
    to.set(c.x, y0 + socket.b[1], c.z);
    const len = from.distanceTo(to);
    p.visible = true;
    p.position.copy(from).add(to).multiplyScalar(0.5);
    p.quaternion.setFromUnitVectors(up, to.clone().sub(from).normalize());
    p.scale.set(1, len, 1);
  });
  return (
    <group>
      <mesh ref={pole} material={mat} visible={false} renderOrder={3}>
        <cylinderGeometry args={[0.06, 0.06, 1, 7]} />
      </mesh>
      <mesh ref={sheet} material={mat} visible={false} renderOrder={3}>
        <planeGeometry args={[CATCHER.half * 2, CATCHER.half * 2]} />
      </mesh>
    </group>
  );
}

// ------------------------------------------------------------------ carrying

/** The chest between the player and Kai, or the barrel in the player's arms. */
function Carried() {
  const chestGeo = useMemo(seaChestGeometry, []);
  const barrelGeo = useMemo(barrelGeometry, []);
  const chest = useRef<THREE.Mesh>(null);
  const barrel = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const g = getGame();
    const p = rt.player;
    const k = rt.kai;
    const lift = smooth((rt.time - rt.carry.liftT0) / 0.5);
    if (chest.current) {
      const m = chest.current;
      m.visible = g.carry === "chest" && !g.inCave;
      if (m.visible) {
        const x = (p.x + k.x) / 2;
        const z = (p.z + k.z) / 2;
        const bob = Math.sin(p.step * 2) * 0.02 * Math.min(1, p.speed);
        m.position.set(x, groundY(x, z) + 0.05 + lift * 0.55 + bob, z);
        // The long side runs between the two carriers.
        m.rotation.set(0, Math.atan2(k.x - p.x, k.z - p.z) + Math.PI / 2, 0);
      }
    }
    if (barrel.current) {
      const m = barrel.current;
      m.visible = g.carry === "barrel" && !g.inCave;
      if (m.visible) {
        const x = p.x + Math.sin(p.yaw) * 0.55;
        const z = p.z + Math.cos(p.yaw) * 0.55;
        m.position.set(x, p.y + 0.05 + lift * 0.4 + Math.sin(p.step * 2) * 0.02 * Math.min(1, p.speed), z);
        m.rotation.set(0, p.yaw, 0);
        m.scale.setScalar(0.85);
      }
    }
  });
  return (
    <group>
      <mesh ref={chest} geometry={chestGeo} material={flatMat} visible={false} />
      <mesh ref={barrel} geometry={barrelGeo} material={flatMat} visible={false} />
    </group>
  );
}

// ------------------------------------------------------------------ rain

const DROPS = 700;
const RAIN_BOX = 26;

/** Rain streaks in a box that follows the camera; their opacity is the rain weight. */
function Rain() {
  const camera = useThree((s) => s.camera);
  const lines = useRef<THREE.LineSegments>(null);
  const seeds = useMemo(() => {
    const a = new Float32Array(DROPS * 3);
    for (let i = 0; i < DROPS; i++) {
      a[i * 3] = (Math.random() - 0.5) * RAIN_BOX;
      a[i * 3 + 1] = Math.random() * 14;
      a[i * 3 + 2] = (Math.random() - 0.5) * RAIN_BOX;
    }
    return a;
  }, []);
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(DROPS * 6), 3));
    return g;
  }, []);
  const mat = useMemo(() => new THREE.LineBasicMaterial({ color: "#cfe3f0", transparent: true, opacity: 0, depthWrite: false }), []);
  useFrame(() => {
    const l = lines.current;
    if (!l) return;
    const k = getGame().inCave ? 0 : rt.rain.k;
    l.visible = k > 0.02;
    if (!l.visible) return;
    mat.opacity = 0.45 * k;
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const cx = camera.position.x;
    const cy = camera.position.y;
    const cz = camera.position.z;
    const fall = rt.time * 16;
    for (let i = 0; i < DROPS; i++) {
      const y = 14 - ((seeds[i * 3 + 1] + fall) % 14);
      const x = cx + seeds[i * 3];
      const z = cz + seeds[i * 3 + 2];
      const top = cy - 6 + y;
      pos.setXYZ(i * 2, x, top, z);
      pos.setXYZ(i * 2 + 1, x - 0.04, top - 0.55, z + 0.02);
    }
    pos.needsUpdate = true;
  });
  return <lineSegments ref={lines} geometry={geo} material={mat} frustumCulled={false} visible={false} />;
}

// ------------------------------------------------------------------

export function Chapter2World() {
  const inCave = useGame((s) => s.inCave);
  return (
    <>
      <group visible={!inCave}>
        <Cove />
        <Grove />
        <Structures />
        <Carried />
      </group>
      <Rain />
    </>
  );
}
