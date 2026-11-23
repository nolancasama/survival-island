import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { rt } from "../game/runtime";
import { getGame, useGame } from "../game/store";
import { NODE_BY_ID, SEA_Y, groundY } from "../game/world/island";
import {
  CAMP_SIGN, COVE, COVE_BARREL, COVE_CRATE, COVE_HULL, COVE_MAST, COVE_SIGN, DETAIL_DISTANCE, GROVE_GATE, GROVE_SIGN, SEA_CHEST, TIDE_WATER
} from "../game/world/chapter2";
import {
  BARREL, CATCHER, CATCHER_CORNERS, CATCHER_SOCKETS, LASH_HEIGHTS, RACK, RACK_SOCKETS, START_HEIGHTS, rackStable, rackSway, toWorld,
  type Socket
} from "../game/logic/structures";
import { flowOf } from "../game/flow/chapter2";
import { socketsOf } from "../game/flow/chapter2Focus";
import type { PlacedBuilding } from "../game/world/placement";
import { PartBuilder } from "./partBuilder";
import { flatMat, occluderMat } from "./materials";
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

// ------------------------------------------------------------- static scenery

/** A model moved into place, for merging static scenery into one mesh. */
function placed(geo: THREE.BufferGeometry, x: number, y: number, z: number, yaw = 0): THREE.BufferGeometry {
  const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(UP, yaw), new THREE.Vector3(1, 1, 1));
  return geo.applyMatrix4(m);
}

function merged(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const g = mergeGeometries(parts, false)!;
  parts.forEach((p) => p.dispose());
  g.computeBoundingSphere();
  return g;
}

const UP = new THREE.Vector3(0, 1, 0);

/** The new signs: posts join their area's static mesh, and the labels share one texture (one draw call). */
const SIGNS = [
  { at: COVE_SIGN, label: "COVE", yaw: -1.15 },
  { at: CAMP_SIGN, label: "CAMP", yaw: 1.25 },
  { at: GROVE_SIGN, label: "BAMBOO", yaw: -1.2 }
] as const;

const signPost = (i: number) => {
  const s = SIGNS[i];
  return placed(signPostGeometry(), s.at.x, groundY(s.at.x, s.at.z), s.at.z, s.yaw);
};

function SignLabels() {
  const { geometry, material } = useMemo(() => {
    const row = 96;
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = row * SIGNS.length;
    const ctx = canvas.getContext("2d")!;
    const parts = SIGNS.map((s, i) => {
      const label = labelTexture(s.label);
      ctx.drawImage(label.image as HTMLCanvasElement, 0, i * row);
      label.dispose();
      // Each plane shows its own row of the atlas (texture v runs bottom to top).
      const plane = new THREE.PlaneGeometry(1.32, 0.42);
      const uv = plane.attributes.uv;
      for (let k = 0; k < uv.count; k++) uv.setY(k, 1 - (i + 1) / SIGNS.length + uv.getY(k) / SIGNS.length);
      plane.translate(0, 1.46, 0.101);
      return placed(plane, s.at.x, groundY(s.at.x, s.at.z), s.at.z, s.yaw);
    });
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    return { geometry: merged(parts), material: new THREE.MeshLambertMaterial({ map }) };
  }, []);
  const camera = useThree((st) => st.camera);
  const mesh = useRef<THREE.Mesh>(null);
  useFrame(() => {
    // Unreadable from afar: drawn only with the camera within reading distance of one of the signs.
    if (mesh.current) mesh.current.visible = SIGNS.some((sg) => Math.hypot(camera.position.x - sg.at.x, camera.position.z - sg.at.z) < 45);
  });
  return <mesh ref={mesh} geometry={geometry} material={material} />;
}

// ------------------------------------------------------------------ the cove

function Cove() {
  const coveOpen = useGame((s) => s.coveOpen);
  const coveBoxOpened = useGame((s) => s.coveBoxOpened);
  const crateY = groundY(COVE_CRATE.x, COVE_CRATE.z);
  // Everything in the cove that never moves, in one mesh (the camera keeps out of it; nothing in it is low enough to matter).
  const scenery = useMemo(() => merged([
    coveRocksGeometry(),
    placed(coveHullGeometry(), COVE_HULL.x, groundY(COVE_HULL.x, COVE_HULL.z) - 0.1, COVE_HULL.z, COVE_HULL.rot),
    coveShoreGeometry(),
    coveDebrisGeometry(),
    placed(coveMastGeometry(), COVE_MAST.x, groundY(COVE_MAST.x, COVE_MAST.z), COVE_MAST.z, COVE_MAST.rot),
    placed(buriedSandGeometry(), COVE_CRATE.x, crateY, COVE_CRATE.z, COVE_CRATE.rot),
    placed(crateBodyGeometry().translate(0, -0.3, 0), COVE_CRATE.x, crateY, COVE_CRATE.z, COVE_CRATE.rot),
    signPost(0),
    signPost(1)
  ]), [crateY]);
  const crateLid = useMemo(crateLidGeometry, []);
  const chest = useMemo(seaChestGeometry, []);
  const barrel = useMemo(barrelGeometry, []);
  const camera = useThree((st) => st.camera);
  const props = useRef<THREE.Group>(null);
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

  useFrame(() => {
    const g = getGame();
    // Small props are a few pixels from afar (the clifftop): only drawn near the cove.
    if (props.current) props.current.visible = Math.hypot(camera.position.x - COVE.x, camera.position.z - COVE.z) < DETAIL_DISTANCE;
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
      <mesh geometry={scenery} material={occluderMat} userData={{ cameraCollider: true }} />
      <group ref={props}>
        <group position={[COVE_CRATE.x, crateY, COVE_CRATE.z]} rotation={[0, COVE_CRATE.rot, 0]}>
          <group ref={lid} position={[0, 0.48, -0.53]} rotation={[coveBoxOpened ? -1.9 : 0, 0, 0]}>
            <mesh geometry={crateLid} material={flatMat} />
          </group>
        </group>
        <mesh ref={chestMesh} geometry={chest} material={flatMat}
          position={[SEA_CHEST.x, groundY(SEA_CHEST.x, SEA_CHEST.z), SEA_CHEST.z]} rotation={[0, SEA_CHEST.rot, 0]} />
        <mesh ref={barrelMesh} geometry={barrel} material={flatMat}
          position={[COVE_BARREL.x, groundY(COVE_BARREL.x, COVE_BARREL.z), COVE_BARREL.z]} rotation={[0, COVE_BARREL.rot, 0]} />
      </group>
      <mesh ref={tide} material={tideMat} visible={!coveOpen}
        position={[(TIDE_WATER.x0 + TIDE_WATER.x1) / 2, tideY, TIDE_WATER.z]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={1}>
        <planeGeometry args={[TIDE_WATER.x1 - TIDE_WATER.x0 + 2, TIDE_WATER.half * 2 + 1.5]} />
      </mesh>
    </group>
  );
}

// ------------------------------------------------------------------ the grove

function Grove() {
  const groveOpen = useGame((s) => s.groveOpen);
  // The bamboo ring and the BAMBOO sign's post: one static mesh.
  const decor = useMemo(() => merged([groveDecorGeometry(), signPost(2)]), []);
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
    </group>
  );
}

// ------------------------------------------------------------------ structures

/** A structure's filled sockets as bamboo poles with rope lashings, added to a builder. */
function addParts(b: PartBuilder, sockets: readonly Socket[], parts: readonly string[], skip: (s: Socket) => boolean = () => false) {
  for (const s of sockets) {
    if (!parts.includes(s.id) || skip(s)) continue;
    const r = s.kind === "leg" || s.kind === "post" ? 0.05 : 0.04;
    bambooPole(b, s.a, s.b, r);
    // A rope lashing where a bar or brace meets the frame.
    if (s.kind !== "leg" && s.kind !== "post") {
      for (const e of [s.a, s.b]) b.sphere(0.06, e[0], e[1], e[2], "#c9a464", [1, 0.8, 1], 6);
    }
  }
}

/** Hidden with the camera far away: small camp things are a few pixels from the clifftop (draw-call budget). */
function useNearCamera(ref: React.RefObject<THREE.Object3D | null>, x: number, z: number) {
  const camera = useThree((st) => st.camera);
  useFrame(() => {
    if (ref.current) ref.current.visible = Math.hypot(camera.position.x - x, camera.position.z - z) < DETAIL_DISTANCE;
  });
}

/** Where the dried fish hang on a rack (local), top bars first. */
const FISH_SLOTS: ReadonlyArray<readonly [number, number, number]> = [
  [-0.45, RACK.top, -RACK.halfWidth], [0.45, RACK.top, -RACK.halfWidth],
  [-0.45, RACK.top, RACK.halfWidth], [0.45, RACK.top, RACK.halfWidth],
  [0, RACK.shelf, -RACK.halfWidth], [0, RACK.shelf, RACK.halfWidth]
];

const DRIED = new THREE.Color("#a8692f");

/** The rack's frame and its hanging fish (fresh or dried) as one mesh. */
function rackGeometry(parts: readonly string[], fish: readonly number[], fishGeo: THREE.BufferGeometry): THREE.BufferGeometry {
  const b = new PartBuilder(0.2);
  addParts(b, RACK_SOCKETS, parts);
  const frame = b.build();
  const hung = fish.slice(0, FISH_SLOTS.length).map((left, i) => {
    const s = FISH_SLOTS[i];
    const g = fishGeo.clone();
    if (left <= 0) {
      // Dried: flatter and brown.
      g.scale(0.9, 0.7, 0.95);
      const c = g.attributes.color;
      for (let k = 0; k < c.count; k++) c.setXYZ(k, c.getX(k) * 0.25 + DRIED.r * 0.75, c.getY(k) * 0.25 + DRIED.g * 0.75, c.getZ(k) * 0.25 + DRIED.b * 0.75);
    }
    g.rotateX(-Math.PI / 2);
    g.translate(s[0], s[1] - 0.26, s[2]);
    return g;
  });
  return hung.length ? merged([frame, ...hung]) : frame;
}

function Rack({ b, fishGeo }: { b: PlacedBuilding; fishGeo: THREE.BufferGeometry }) {
  const parts = b.parts ?? [];
  const fish = b.fish ?? [];
  const key = parts.join(",") + "|" + fish.map((left) => (left > 0 ? "f" : "d")).join("");
  const geo = useMemo(() => rackGeometry(parts, fish, fishGeo), [key, fishGeo]);
  const frame = useRef<THREE.Group>(null);
  useFrame(() => {
    const f = frame.current;
    if (!f) return;
    const sway = rackSway(parts);
    // An unbraced frame racks over when touched; a braced one settles.
    const settle = rt.steadyT0.get(b.id);
    const after = settle === undefined ? 1 : clamp01((rt.time - settle) / 1.2);
    const loose = rackStable(parts) ? (1 - after) * 0.6 : 1;
    const w = Math.sin(rt.time * 3.1) * 0.05 * loose;
    f.rotation.z = sway.along || loose < 1 ? w : 0;
    f.rotation.x = sway.across || loose < 1 ? w * 0.8 : 0;
  });
  return (
    <group position={[b.x, groundY(b.x, b.z), b.z]} rotation={[0, b.rot, 0]}>
      <group ref={frame}>
        <mesh geometry={geo} material={flatMat} />
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

function Catcher({ b, waterMat }: { b: PlacedBuilding; waterMat: THREE.Material }) {
  const parts = b.parts ?? [];
  const heights = b.heights ?? START_HEIGHTS;
  const key = parts.join(",");
  const hKey = heights.join(",");
  const hasCanvas = parts.includes("canvas");
  // Posts, lashing knots and the canvas (both faces) as one mesh, rebuilt when a part or a corner height changes.
  const geo = useMemo(() => {
    const k = new PartBuilder(0.2);
    addParts(k, CATCHER_SOCKETS, parts, (s) => s.kind === "canvas");
    if (hasCanvas) {
      heights.forEach((h, i) => {
        const [x, z] = CATCHER_CORNERS[i];
        k.sphere(0.08, x, LASH_HEIGHTS[Math.max(0, Math.min(3, Math.round(h)))], z, "#c9a464", [1, 1.3, 1], 6);
      });
      k.add(canvasGeometry(heights), "#ece2c6", [0, 0, 0], [0, 0, 0], [1, 1, 1], { flatAo: true, vary: false });
      const under = canvasGeometry(heights);
      const idx = under.index!;
      for (let i = 0; i < idx.count; i += 3) {
        const a = idx.getX(i + 1);
        idx.setX(i + 1, idx.getX(i + 2));
        idx.setX(i + 2, a);
      }
      k.add(under, "#d3c7a3", [0, -0.004, 0], [0, 0, 0], [1, 1, 1], { flatAo: true, vary: false });
    }
    return k.build();
  }, [key, hKey]);
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
      <mesh geometry={geo} material={flatMat} />
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
  const root = useRef<THREE.Group>(null);
  const water = useRef<THREE.Mesh>(null);
  useNearCamera(root, b.x, b.z);
  useFrame(() => {
    const m = water.current;
    if (!m) return;
    const me = getGame().buildings.find((x) => x.id === b.id);
    const cups = me?.water ?? 0;
    m.visible = cups > 0.05;
    m.position.y = 0.1 + (Math.min(BARREL.capacity, cups) / BARREL.capacity) * 0.8;
  });
  return (
    <group ref={root} position={[b.x, groundY(b.x, b.z), b.z]} rotation={[0, b.rot, 0]}>
      <mesh geometry={geo} material={flatMat} />
      <mesh ref={water} material={waterMat} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <circleGeometry args={[0.34, 12]} />
      </mesh>
    </group>
  );
}

function StorageBox({ b, geo }: { b: PlacedBuilding; geo: THREE.BufferGeometry }) {
  const box = useRef<THREE.Mesh>(null);
  useNearCamera(box, b.x, b.z);
  return <mesh ref={box} geometry={geo} material={flatMat} position={[b.x, groundY(b.x, b.z), b.z]} rotation={[0, b.rot, 0]} />;
}

function Structures() {
  const buildings = useGame((s) => s.buildings);
  const chest = useMemo(seaChestGeometry, []);
  const barrel = useMemo(barrelGeometry, []);
  const fishGeo = useMemo(caughtFishGeometry, []);
  const waterMat = useMemo(() => new THREE.MeshLambertMaterial({ color: "#7fd3ea", transparent: true, opacity: 0.75, depthWrite: false }), []);
  return (
    <group>
      {buildings.map((b) => {
        if (b.type === "storage") return <StorageBox key={b.id} b={b} geo={chest} />;
        if (b.type === "rack") return <Rack key={b.id} b={b} fishGeo={fishGeo} />;
        if (b.type === "catcher") return <Catcher key={b.id} b={b} waterMat={waterMat} />;
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
        <SignLabels />
        <Structures />
        <Carried />
      </group>
      <Rain />
    </>
  );
}
