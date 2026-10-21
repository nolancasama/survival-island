import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { rt } from "../game/runtime";
import { getGame, useGame } from "../game/store";
import {
  BOULDERS,
  BRIDGE,
  CAVE_MOUTH,
  CAVE_SIGN,
  CLIFF_SIGN,
  FALLEN_TREE,
  FISH_SPOTS,
  FOREST_GAP,
  KAI_HOME,
  LEAN_TO,
  NODES,
  PALMS,
  POND,
  SEA_Y,
  STREAM,
  WRECK,
  groundY,
  shoreZ
} from "../game/world/island";
import { makeRng } from "../game/logic/rng";
import { flatMat, occluderMat, signTexture, smoothMat } from "./materials";
import { bucketByTile, splitGeometryByTiles } from "./tiles";
import { cliffTerrainGeometry } from "./models/cliffTrail";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {
  bouldersGeometry,
  bushGeometry,
  farIslandGeometry,
  jungleTreeGeometry,
  palmsGeometry,
  towerGeometry
} from "./models/nature";
import {
  bridgePlankGeometry,
  bridgePostsGeometry,
  bridgeRailsGeometry,
  caveFaceGeometry,
  debrisGeometry,
  fallenPalmHalfGeometry,
  fishingDockGeometry,
  fishingRockGeometry,
  forestGapGeometry,
  kaiCampGeometry,
  pondDetailsGeometry,
  signPostGeometry,
  wreckGeometry
} from "./models/props";

// ------------------------------------------------------------------ light

interface LightKey {
  l: number;
  top: string;
  horizon: string;
  sun: string;
  sunI: number;
  sky: string;
  ground: string;
  hemiI: number;
  sea: string;
}

/** Story light keyframes: night, dusk, golden hour, afternoon, midday. */
const KEYS: LightKey[] = [
  { l: 0, top: "#08152f", horizon: "#273e69", sun: "#b9cbff", sunI: 0.42, sky: "#7899d5", ground: "#26334a", hemiI: 0.72, sea: "#294b75" },
  { l: 0.15, top: "#102650", horizon: "#415f88", sun: "#cfdbff", sunI: 0.52, sky: "#89a7dc", ground: "#35445a", hemiI: 0.78, sea: "#3d648b" },
  { l: 0.3, top: "#293f78", horizon: "#d2786a", sun: "#ffa86e", sunI: 0.9, sky: "#a594c8", ground: "#5a4a4d", hemiI: 0.86, sea: "#7184ae" },
  { l: 0.45, top: "#4a7fd0", horizon: "#ffcf96", sun: "#ffd29a", sunI: 1.7, sky: "#bcd2f2", ground: "#a08a60", hemiI: 1.0, sea: "#d8e8f0" },
  { l: 0.75, top: "#3f8fe2", horizon: "#cdeaff", sun: "#fff1d6", sunI: 2.2, sky: "#cfe8ff", ground: "#b49a6a", hemiI: 1.08, sea: "#ffffff" },
  { l: 1, top: "#3a8ee6", horizon: "#d6efff", sun: "#ffffff", sunI: 2.4, sky: "#d8ecff", ground: "#b8a070", hemiI: 1.12, sea: "#ffffff" }
];

const c1 = new THREE.Color();
const c2 = new THREE.Color();

function sample(l: number) {
  let i = 0;
  while (i < KEYS.length - 2 && l > KEYS[i + 1].l) i++;
  const a = KEYS[i];
  const b = KEYS[i + 1];
  const t = Math.max(0, Math.min(1, (l - a.l) / (b.l - a.l)));
  const mix = (x: string, y: string, out: THREE.Color) => out.set(x).lerp(c2.set(y), t);
  return {
    top: mix(a.top, b.top, new THREE.Color()),
    horizon: mix(a.horizon, b.horizon, new THREE.Color()),
    sun: mix(a.sun, b.sun, new THREE.Color()),
    sky: mix(a.sky, b.sky, new THREE.Color()),
    ground: mix(a.ground, b.ground, new THREE.Color()),
    sea: mix(a.sea, b.sea, new THREE.Color()),
    sunI: a.sunI + (b.sunI - a.sunI) * t,
    hemiI: a.hemiI + (b.hemiI - a.hemiI) * t
  };
}

function Stars() {
  const points = useRef<THREE.Points>(null);
  const material = useMemo(
    () => new THREE.PointsMaterial({ color: "#dce8ff", size: 1.15, sizeAttenuation: true, transparent: true, opacity: 0, depthWrite: false, fog: false }),
    []
  );
  const geometry = useMemo(() => {
    const rand = makeRng(913);
    const a = new Float32Array(420 * 3);
    for (let i = 0; i < 420; i++) {
      const yaw = rand() * Math.PI * 2;
      const elev = 0.12 + rand() * 1.25;
      const r = 350;
      a[i * 3] = Math.cos(yaw) * Math.cos(elev) * r;
      a[i * 3 + 1] = Math.sin(elev) * r;
      a[i * 3 + 2] = Math.sin(yaw) * Math.cos(elev) * r;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(a, 3));
    return g;
  }, []);
  useFrame(() => {
    material.opacity = THREE.MathUtils.smoothstep(0.36 - rt.light, 0, 0.28) * 0.92;
    if (points.current) points.current.rotation.y = rt.time * 0.0015;
  });
  return <points ref={points} geometry={geometry} material={material} renderOrder={-8} />;
}

/** Sky dome, sun, and the fixed light set (hemisphere + sun + ambient). */
export function SkyAndLights({ seaMat }: { seaMat: THREE.MeshLambertMaterial }) {
  const { scene, gl } = useThree();
  const inCave = useGame((s) => s.inCave);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const sun = useRef<THREE.DirectionalLight>(null);
  const ambient = useRef<THREE.AmbientLight>(null);
  const sunDisc = useRef<THREE.Mesh>(null);
  const last = useRef(-1);
  const background = useMemo(() => new THREE.Color("#d6efff"), []);
  const dome = useMemo(() => {
    const g = new THREE.SphereGeometry(420, 24, 14);
    g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 3), 3));
    return g;
  }, []);
  const domeMat = useMemo(() => new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }), []);
  const discMat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#fff4d6", fog: false, transparent: true, opacity: 0.95 }), []);

  useEffect(() => {
    scene.background = background;
    scene.fog = new THREE.Fog("#d6efff", 60, 230);
  }, [scene, background]);

  useFrame(() => {
    const cave = getGame().inCave;
    const l = rt.light;
    if (!cave && scene.fog) {
      // Thin the lowland haze as the trail rises, keeping the island below
      // legible from the summit without altering the story's light keyframes.
      const height = THREE.MathUtils.smoothstep(rt.player.y, 4, 24);
      const north = THREE.MathUtils.smoothstep(-rt.player.z, 42, 54);
      const clear = height * north;
      const fog = scene.fog as THREE.Fog;
      fog.near = 60 + clear * 65;
      fog.far = 230 + clear * 150;
    }
    const key = cave ? -2 : l;
    if (Math.abs(key - last.current) < 0.0015) return;
    last.current = key;
    if (cave) {
      if (scene.fog) {
        const fog = scene.fog as THREE.Fog;
        fog.color.set("#130e0a");
        fog.near = 20;
        fog.far = 48;
      }
      background.set("#130e0a");
      gl.setClearColor(background);
      if (hemi.current) {
        hemi.current.color.set("#d3b99b");
        hemi.current.groundColor.set("#68617b");
        hemi.current.intensity = 0.52;
      }
      if (ambient.current) {
        ambient.current.color.set("#efd8ba");
        ambient.current.intensity = 0.22;
      }
      if (sun.current) sun.current.intensity = 0;
      return;
    }
    if (ambient.current) {
      ambient.current.color.set("#ffffff");
      ambient.current.intensity = 0.18;
    }
    const s = sample(l);
    // Dome gradient: horizon colour near y = 0, top colour overhead.
    const pos = dome.attributes.position;
    const col = dome.attributes.color as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const h = Math.max(0, pos.getY(i) / 420);
      const t = Math.pow(Math.min(1, h * 1.6), 0.75);
      c1.copy(s.horizon).lerp(s.top, t);
      col.setXYZ(i, c1.r, c1.g, c1.b);
    }
    col.needsUpdate = true;
    if (scene.fog) (scene.fog as THREE.Fog).color.copy(s.horizon);
    background.copy(s.horizon);
    gl.setClearColor(background);
    if (hemi.current) {
      hemi.current.color.copy(s.sky);
      hemi.current.groundColor.copy(s.ground);
      hemi.current.intensity = s.hemiI;
    }
    const elev = 0.06 + l * 1.05;
    const dir = new THREE.Vector3(-Math.cos(elev) * 0.9, Math.sin(elev), Math.cos(elev) * 0.42).normalize();
    if (sun.current) {
      sun.current.color.copy(s.sun);
      sun.current.intensity = s.sunI;
      sun.current.position.copy(dir).multiplyScalar(60);
    }
    if (sunDisc.current) {
      sunDisc.current.position.copy(dir).multiplyScalar(380);
      sunDisc.current.lookAt(0, 0, 0);
      discMat.color.copy(s.sun).lerp(c1.set("#ffffff"), 0.4);
      sunDisc.current.visible = l > 0.08;
    }
    seaMat.color.copy(s.sea);
  });

  return (
    <group>
      <group visible={!inCave}>
        <mesh geometry={dome} material={domeMat} renderOrder={-10} />
        <Stars />
        <mesh ref={sunDisc} material={discMat} renderOrder={-9}>
          <circleGeometry args={[14, 24]} />
        </mesh>
      </group>
      <hemisphereLight ref={hemi} args={["#d8ecff", "#b8a070", 1.1]} />
      <directionalLight ref={sun} color="#ffffff" intensity={2.3} position={[-40, 50, 20]} />
      <ambientLight ref={ambient} color="#ffffff" intensity={0.18} />
    </group>
  );
}

// ---------------------------------------------------------------- terrain

const SAND = new THREE.Color("#f2dcaa");
const WET = new THREE.Color("#c9a675");
const UNDER = new THREE.Color("#a99a72");
const GRASS = new THREE.Color("#8cbf62");
const FOREST = new THREE.Color("#4f8f45");
const DEEP_FOREST = new THREE.Color("#3f7a3a");
const FOREST_PATH = new THREE.Color("#78985b");

const sstep = (a: number, b: number, v: number) => {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function terrainGeometry(): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(160, 84, 128, 68);
  g.rotateX(-Math.PI / 2);
  g.translate(0, 0, -9);
  const p = g.attributes.position;
  const colors = new Float32Array(p.count * 3);
  const c = new THREE.Color();
  const rand = makeRng(3);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    // Keep the original lowland tessellation; collapse its unused northern
    // rows onto the join with the detailed cliff terrain.
    const z = Math.max(-41, p.getZ(i));
    p.setZ(i, z);
    p.setY(i, groundY(x, z));
    const d = z - shoreZ(x);
    c.copy(SAND);
    c.lerp(WET, sstep(-2.8, -0.6, d));
    c.lerp(UNDER, sstep(0, 3, d));
    c.lerp(GRASS, sstep(1.8, -1.5, z));
    c.lerp(FOREST, sstep(-2, -5, z));
    c.lerp(DEEP_FOREST, sstep(-8, -14, z));
    if (z < -2.4) {
      const pathD = Math.min(
        segDist(-9, -3, -8, -20, x, z).d,
        segDist(-8, -20, 5, -34, x, z).d,
        segDist(-8, -20, -27.5, -22, x, z).d,
        segDist(5, -34, 20, -39, x, z).d,
        segDist(18, -36, 22, -44, x, z).d,
        segDist(5, -34, 7.2, -42.2, x, z).d
      );
      c.lerp(FOREST_PATH, 1 - sstep(1.25, 2.8, pathD));
    }
    const k = 0.95 + rand() * 0.07;
    colors[i * 3] = c.r * k;
    colors[i * 3 + 1] = c.g * k;
    colors[i * 3 + 2] = c.b * k;
  }
  g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return g;
}

/**
 * The lowland ground and the Phase 3 hillside share flatMat, so they are
 * merged and cut into one set of 40 m tiles (exactly four columns across the
 * 160 m terrain): off-screen land is frustum culled without doubling the draw
 * calls the clifftop view pays for seeing everything.
 */
function terrainTiles(): THREE.BufferGeometry[] {
  const lowland = terrainGeometry();
  lowland.deleteAttribute("uv");
  const merged = mergeGeometries([lowland, cliffTerrainGeometry()]);
  if (!merged) throw new Error("terrain attributes do not match");
  return splitGeometryByTiles(merged, 40);
}

export function Terrain() {
  const tiles = useMemo(terrainTiles, []);
  return <>{tiles.map((geo, i) => <mesh key={i} geometry={geo} material={flatMat} />)}</>;
}

// ------------------------------------------------------------------ ocean

export function Ocean({ seaMat }: { seaMat: THREE.MeshLambertMaterial }) {
  const near = useMemo(() => {
    const g = new THREE.PlaneGeometry(300, 150, 72, 36);
    g.rotateX(-Math.PI / 2);
    g.translate(0, SEA_Y, 82);
    const p = g.attributes.position;
    const colors = new Float32Array(p.count * 3);
    const c = new THREE.Color();
    const shallow = new THREE.Color("#5fd3cf");
    const mid = new THREE.Color("#2aa2c9");
    const deep = new THREE.Color("#1d6aa6");
    for (let i = 0; i < p.count; i++) {
      const d = p.getZ(i) - shoreZ(p.getX(i));
      c.copy(shallow).lerp(mid, sstep(1, 14, d)).lerp(deep, sstep(14, 70, d));
      colors.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return g;
  }, []);
  const base = useMemo(() => Float32Array.from(near.attributes.position.array as Float32Array), [near]);
  const far = useMemo(() => {
    const g = new THREE.PlaneGeometry(1600, 900, 1, 1);
    g.rotateX(-Math.PI / 2);
    g.translate(0, SEA_Y - 0.05, 600);
    const colors = new Float32Array(4 * 3);
    const c = new THREE.Color("#1d6aa6");
    for (let i = 0; i < 4; i++) colors.set([c.r, c.g, c.b], i * 3);
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return g;
  }, []);
  const sides = useMemo(() => {
    // Sea wrapping round the headlands to the east and west.
    const g = new THREE.PlaneGeometry(400, 200, 1, 1);
    g.rotateX(-Math.PI / 2);
    const colors = new Float32Array(4 * 3);
    const c = new THREE.Color("#1d6aa6");
    for (let i = 0; i < 4; i++) colors.set([c.r, c.g, c.b], i * 3);
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return g;
  }, []);

  const foam = useFoam();

  useFrame(() => {
    const t = rt.time;
    const p = near.attributes.position as THREE.BufferAttribute;
    const arr = p.array as Float32Array;
    for (let i = 0; i < p.count; i++) {
      const x = base[i * 3];
      const z = base[i * 3 + 2];
      const d = z - shoreZ(x);
      const k = sstep(-1, 10, d);
      arr[i * 3 + 1] = SEA_Y + k * (0.11 * Math.sin(x * 0.31 + t * 1.1) + 0.08 * Math.sin(z * 0.45 - t * 1.4) + 0.05 * Math.sin((x + z) * 0.8 + t * 2.1));
    }
    p.needsUpdate = true;
    foam.update(t);
  });

  return (
    <group>
      <mesh geometry={near} material={seaMat} />
      <mesh geometry={far} material={seaMat} />
      <mesh geometry={sides} material={seaMat} position={[-260, SEA_Y - 0.05, -20]} />
      <mesh geometry={sides} material={seaMat} position={[260, SEA_Y - 0.05, -20]} />
      <mesh geometry={foam.geo[0]} material={foam.mat[0]} />
      <mesh geometry={foam.geo[1]} material={foam.mat[1]} />
    </group>
  );
}

/** Two foam ribbons that wash up and down the sand along the waterline. */
function useFoam() {
  return useMemo(() => {
    const N = 150;
    const x0 = -75;
    const mk = () => {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(new Float32Array((N + 1) * 2 * 3), 3));
      const idx: number[] = [];
      for (let i = 0; i < N; i++) {
        const a = i * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
      g.setIndex(idx);
      return g;
    };
    const geo = [mk(), mk()];
    const mat = [0, 1].map(
      () => new THREE.MeshBasicMaterial({ color: "#fbfdff", transparent: true, opacity: 0.6, depthWrite: false, fog: true })
    );
    const update = (t: number) => {
      for (let k = 0; k < 2; k++) {
        // k = 0: the wash line sliding up and down the sand; k = 1: a wave crest out in the water.
        const phase = t * 0.55 + k * 1.3;
        const wash = Math.sin(phase);
        const off = k === 0 ? 0.1 - (wash * 0.5 + 0.5) * 1.3 : 1.6 + wash * 0.7;
        const w = k === 0 ? 0.09 + 0.05 * (1 - Math.abs(wash)) : 0.07;
        mat[k].opacity = k === 0 ? 0.55 + 0.35 * (0.5 + 0.5 * Math.cos(phase)) : 0.3 + 0.25 * Math.max(0, wash);
        const arr = geo[k].attributes.position.array as Float32Array;
        for (let i = 0; i <= N; i++) {
          const x = x0 + i;
          const wobble = 0.3 * Math.sin(x * 0.7 + t * 0.8 + k * 2) + 0.18 * Math.sin(x * 1.9 - t * 0.5);
          const zc = shoreZ(x) + off + wobble;
          // Uneven width breaks the line into foamy blobs.
          const ww = w * Math.max(0.15, 0.7 + 0.6 * Math.sin(x * 1.3 + t * 0.9 + k) * Math.sin(x * 0.37 - t * 0.4));
          for (let s = 0; s < 2; s++) {
            const z = zc + (s ? ww : -ww);
            const y = Math.max(SEA_Y + 0.05, groundY(x, z) + 0.03);
            arr.set([x, y, z], (i * 2 + s) * 3);
          }
        }
        geo[k].attributes.position.needsUpdate = true;
      }
    };
    return { geo, mat, update };
  }, []);
}

// -------------------------------------------------------------- vegetation

interface TreeSpot {
  x: number;
  z: number;
  s: number;
  r: number;
  tint: number;
}

function treeSpots(): { trees: TreeSpot[]; bushes: TreeSpot[] } {
  const rand = makeRng(42);
  const trees: TreeSpot[] = [];
  const bushes: TreeSpot[] = [];
  const inGap = (x: number, z: number) => Math.abs(x - FOREST_GAP.x) < 2.4 && z > -11;
  const onPath = (x: number, z: number) =>
    segDist(-9, -3, -8, -20, x, z).d < 3.1 ||
    segDist(-8, -20, 5, -34, x, z).d < 3.1 ||
    segDist(-8, -20, -27.5, -22, x, z).d < 3.1 ||
    segDist(5, -34, 20, -39, x, z).d < 3 ||
    segDist(18, -36, 22, -44, x, z).d < 4 ||
    segDist(8, -36, 7.2, -42.2, x, z).d < 4 ||
    Math.hypot(x - 2, z + 20) < 4.4;
  const byNode = (x: number, z: number) => NODES.some((n) => Math.hypot(n.x - x, n.z - z) < 2.25);
  // The original south tree line remains dense, with the single forest gap.
  for (let x = -40; x < 40; x += 2.8 + rand() * 1.4) {
    const px = x + (rand() - 0.5) * 1.2;
    const pz = -4.3 - rand() * 1.2;
    if (!inGap(px, pz)) trees.push({ x: px, z: pz, s: 0.85 + rand() * 0.45, r: rand() * 6.28, tint: 0.88 + rand() * 0.22 });
  }
  // Forest trees are clustered away from the readable three-metre path corridors.
  for (let i = 0; i < 230; i++) {
    const px = -27 + rand() * 54;
    const pz = -7 - rand() * 35;
    if (inGap(px, pz) || onPath(px, pz) || byNode(px, pz)) continue;
    const edge = Math.min(px + 27, 27 - px, -7 - pz, pz + 42);
    if (rand() > (edge < 4 ? 0.9 : 0.54)) continue;
    trees.push({ x: px, z: pz, s: 0.72 + rand() * 0.48, r: rand() * 6.28, tint: 0.82 + rand() * 0.25 });
  }
  for (let x = -40; x < 40; x += 2.2 + rand() * 2.5) {
    if (inGap(x, -3)) continue;
    bushes.push({ x, z: -3.2 - rand() * 0.9, s: 0.7 + rand() * 0.6, r: rand() * 6, tint: 0.85 + rand() * 0.3 });
  }
  // A soft vegetation rim defines the pond clearing without hiding its shore.
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2 + rand() * 0.18;
    const rr = POND.r + 3.2 + rand() * 2.2;
    const x = POND.x + Math.cos(a) * rr;
    const z = POND.z + Math.sin(a) * rr;
    if (x > STREAM.x - 1 || onPath(x, z) || byNode(x, z)) continue;
    trees.push({ x, z, s: 0.72 + rand() * 0.3, r: rand() * 6.28, tint: 0.86 + rand() * 0.2 });
  }
  // Headland trees.
  for (const side of [-1, 1]) {
    for (let i = 0; i < 9; i++) {
      trees.push({ x: side * (42 + rand() * 8), z: -6 + rand() * 12, s: 0.9 + rand() * 0.4, r: rand() * 6, tint: 0.9 + rand() * 0.2 });
    }
  }
  return { trees, bushes };
}

/** One frustum-culled instanced batch per spatial tile. Each spot keeps its
 * index in the full list, so per-instance tints match the untiled layout. */
function Instanced({ geometry, spots, tile }: { geometry: THREE.BufferGeometry; spots: TreeSpot[]; tile?: number }) {
  const tiles = useMemo(() => {
    const indexed = spots.map((s, i) => ({ ...s, i }));
    return tile ? bucketByTile(indexed, tile) : [indexed];
  }, [spots, tile]);
  return <>{tiles.map((tile, k) => <InstancedTile key={k} geometry={geometry} spots={tile} />)}</>;
}

function InstancedTile({ geometry, spots }: { geometry: THREE.BufferGeometry; spots: (TreeSpot & { i: number })[] }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new THREE.Object3D();
    const c = new THREE.Color();
    spots.forEach((s, slot) => {
      const i = s.i;
      o.position.set(s.x, groundY(s.x, s.z), s.z);
      o.rotation.set(0, s.r, 0);
      o.scale.setScalar(s.s);
      o.updateMatrix();
      m.setMatrixAt(slot, o.matrix);
      m.setColorAt(slot, c.setRGB(s.tint, s.tint * (0.95 + (i % 3) * 0.04), s.tint));
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
  }, [spots]);
  return <instancedMesh ref={ref} args={[geometry, occluderMat, spots.length]} />;
}

/** Distance from point (px, pz) to segment a->b in XZ, and how far along it lies (0..1). */
function segDist(ax: number, az: number, bx: number, bz: number, px: number, pz: number) {
  const dx = bx - ax;
  const dz = bz - az;
  const l2 = dx * dx + dz * dz || 1;
  const u = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / l2));
  return { d: Math.hypot(ax + dx * u - px, az + dz * u - pz), u };
}

/** Palms share the general line-of-sight material with the other vegetation. */
function Palms() {
  const items = useMemo(
    () =>
      PALMS.map((palm, i) => ({
        geo: palmsGeometry([palm], 7 + i)
      })),
    []
  );
  return (
    <group>
      {items.map((it, i) => (
        <mesh key={i} geometry={it.geo} material={occluderMat} />
      ))}
    </group>
  );
}

export function Vegetation() {
  const tree = useMemo(jungleTreeGeometry, []);
  const bush = useMemo(bushGeometry, []);
  const { trees, bushes } = useMemo(treeSpots, []);
  return (
    <group>
      <Palms />
      {/* Trees are tiled; the 21 bushes (~1.3k tris) stay one culled batch. */}
      <Instanced geometry={tree} spots={trees} tile={40} />
      <Instanced geometry={bush} spots={bushes} />
    </group>
  );
}

// ------------------------------------------------------------ the rest

function inlandWaterMaterial() {
  return new THREE.MeshLambertMaterial({ color: "#4a9fa5", transparent: true, opacity: 0.86, depthWrite: false });
}

function streamCrossSection(t: number) {
  const z = STREAM.z0 + (STREAM.z1 - STREAM.z0) * t;
  const x = STREAM.x + Math.sin(t * 8.2) * 0.42 + Math.sin(t * 19) * 0.12;
  const half = STREAM.width * (0.4 + Math.sin(t * 5.4 + 1) * 0.025);
  return { x, z, half, y: groundY(x, z) + 0.42 };
}

function StreamAndPond() {
  const stream = useMemo(() => {
    const n = 42;
    const positions = new Float32Array((n + 1) * 2 * 3);
    const indices: number[] = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const { x, z, half, y } = streamCrossSection(t);
      for (let side = 0; side < 2; side++) {
        const px = x + (side ? half : -half);
        positions.set([px, y, z], (i * 2 + side) * 3);
      }
      if (i < n) {
        const a = i * 2;
        indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.setIndex(indices);
    g.computeVertexNormals();
    return g;
  }, []);
  const banks = useMemo(() => {
    const n = 42;
    const positions = new Float32Array((n + 1) * 4 * 3);
    const colors = new Float32Array((n + 1) * 4 * 3);
    const indices: number[] = [];
    const mud = new THREE.Color("#8b7048");
    const sand = new THREE.Color("#b69462");
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const { x, z, half, y } = streamCrossSection(t);
      const xs = [x - STREAM.width * 0.5, x - half, x + half, x + STREAM.width * 0.5];
      for (let side = 0; side < 4; side++) {
        const inner = side === 1 || side === 2;
        const py = inner ? y + 0.035 : groundY(xs[side], z) + 0.035;
        positions.set([xs[side], py, z], (i * 4 + side) * 3);
        const color = inner ? mud : sand;
        colors.set([color.r, color.g, color.b], (i * 4 + side) * 3);
      }
      if (i < n) {
        for (const side of [0, 2]) {
          const a = i * 4 + side;
          indices.push(a, a + 4, a + 1, a + 1, a + 4, a + 5);
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    g.setIndex(indices);
    g.computeVertexNormals();
    return g;
  }, []);
  const water = useMemo(inlandWaterMaterial, []);
  const pondY = groundY(POND.x, POND.z) + 0.56;
  const details = useMemo(() => pondDetailsGeometry(POND.r), []);
  const rock = useMemo(fishingRockGeometry, []);
  const dock = useMemo(fishingDockGeometry, []);
  const fish = useRef<THREE.InstancedMesh>(null);
  const fishMat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#173c46", transparent: true, opacity: 0.48, depthWrite: false }), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useFrame(() => {
    water.opacity = 0.8 + Math.sin(rt.time * 0.6) * 0.04;
    if (!fish.current) return;
    for (let i = 0; i < 4; i++) {
      const spot = FISH_SPOTS[i % FISH_SPOTS.length];
      const dx = POND.x - spot.x;
      const dz = POND.z - spot.z;
      const len = Math.hypot(dx, dz) || 1;
      const phase = rt.time * (0.25 + i * 0.025) + i * 2.1;
      dummy.position.set(spot.x + (dx / len) * (1.45 + i * 0.22) + Math.cos(phase) * 0.45, pondY + 0.025, spot.z + (dz / len) * (1.45 + i * 0.22) + Math.sin(phase) * 0.35);
      dummy.rotation.set(-Math.PI / 2, 0, phase + 0.5);
      dummy.scale.set(0.55 + (i % 2) * 0.15, 0.2, 1);
      dummy.updateMatrix();
      fish.current.setMatrixAt(i, dummy.matrix);
    }
    fish.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <group>
      <mesh geometry={banks} material={flatMat} />
      <mesh geometry={stream} material={water} renderOrder={1} />
      <mesh position={[POND.x, pondY, POND.z]} rotation={[-Math.PI / 2, 0, 0]} material={water} renderOrder={1}>
        <circleGeometry args={[POND.r, 40]} />
      </mesh>
      <mesh geometry={details} material={occluderMat} position={[POND.x, pondY, POND.z]} />
      <mesh geometry={rock} material={occluderMat} position={[FISH_SPOTS[0].x, groundY(FISH_SPOTS[0].x, FISH_SPOTS[0].z), FISH_SPOTS[0].z]} rotation={[0, FISH_SPOTS[0].yaw, 0]} />
      <mesh geometry={dock} material={occluderMat} position={[FISH_SPOTS[1].x, groundY(FISH_SPOTS[1].x, FISH_SPOTS[1].z), FISH_SPOTS[1].z]} rotation={[0, -FISH_SPOTS[1].yaw, 0]} />
      <instancedMesh ref={fish} args={[undefined, fishMat, 4]} frustumCulled={false} renderOrder={2}>
        <circleGeometry args={[1, 8]} />
      </instancedMesh>
    </group>
  );
}

function FallenPalm() {
  const cleared = useGame((s) => s.pathCleared);
  const left = useRef<THREE.Group>(null);
  const right = useRef<THREE.Group>(null);
  const base = useMemo(() => fallenPalmHalfGeometry(false), []);
  const crown = useMemo(() => fallenPalmHalfGeometry(true), []);
  useFrame(() => {
    const t = cleared ? (rt.pathClearedT0 < 0 ? 1 : THREE.MathUtils.smoothstep((rt.time - rt.pathClearedT0) / 1.2, 0, 1)) : 0;
    if (left.current) {
      left.current.position.set(-t * 0.8, 0, t * 1.65);
      left.current.rotation.y = t * 0.3;
      left.current.rotation.z = -t * 0.08;
    }
    if (right.current) {
      right.current.position.set(t * 0.8, 0, -t * 1.65);
      right.current.rotation.y = -t * 0.3;
      right.current.rotation.z = t * 0.08;
    }
  });
  return (
    <group position={[FALLEN_TREE.x, groundY(FALLEN_TREE.x, FALLEN_TREE.z), FALLEN_TREE.z]}>
      <group ref={left}><mesh geometry={base} material={occluderMat} /></group>
      <group ref={right}><mesh geometry={crown} material={occluderMat} /></group>
    </group>
  );
}

function BridgeModel() {
  const built = useGame((s) => s.bridgeBuilt);
  const planks = useRef<THREE.InstancedMesh>(null);
  const dangling = useRef<THREE.Mesh>(null);
  const posts = useMemo(bridgePostsGeometry, []);
  const plank = useMemo(bridgePlankGeometry, []);
  const rails = useMemo(bridgeRailsGeometry, []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const y = Math.max(groundY(BRIDGE.x - 2.3, BRIDGE.z), groundY(BRIDGE.x + 2.3, BRIDGE.z)) + 0.05;
  useFrame(() => {
    const t = built ? (rt.bridgeBuiltT0 < 0 ? 1 : THREE.MathUtils.smoothstep((rt.time - rt.bridgeBuiltT0) / 1.2, 0, 1)) : 0;
    for (let i = 0; i < 9; i++) {
      const delay = i / 11;
      const p = Math.max(0, Math.min(1, (t - delay) * 3.6));
      dummy.position.set(-1.92 + i * 0.48, 0.24 + (1 - p) * 2.4, 0);
      dummy.rotation.set(0, 0, (1 - p) * 0.45 * (i % 2 ? 1 : -1));
      dummy.scale.setScalar(Math.max(0.001, p));
      dummy.updateMatrix();
      planks.current?.setMatrixAt(i, dummy.matrix);
    }
    if (planks.current) planks.current.instanceMatrix.needsUpdate = true;
    if (dangling.current) dangling.current.visible = !built;
  });
  return (
    <group position={[BRIDGE.x, y, BRIDGE.z]} rotation={[0, BRIDGE.rot, 0]}>
      <mesh geometry={posts} material={occluderMat} />
      <instancedMesh ref={planks} args={[plank, occluderMat, 9]} frustumCulled={false} />
      <mesh geometry={rails} material={occluderMat} visible={built} position={[0, 0, 0]} />
      <mesh ref={dangling} geometry={plank} material={occluderMat} position={[-1.7, -0.15, 0]} rotation={[1.15, 0, 0]} />
    </group>
  );
}

function labelTexture(label: string) {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 96;
  const g = c.getContext("2d")!;
  g.fillStyle = "#d79c58";
  g.fillRect(0, 0, 256, 96);
  g.fillStyle = "#4a2a12";
  g.font = "bold 42px system-ui, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(label, 128, 50);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function ClosedNorth() {
  const cave = useMemo(caveFaceGeometry, []);
  const caveOpening = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-1.55, 0);
    shape.lineTo(1.55, 0);
    shape.lineTo(1.55, 2.05);
    shape.bezierCurveTo(1.55, 3.35, 0.9, 4.15, 0, 4.15);
    shape.bezierCurveTo(-0.9, 4.15, -1.55, 3.35, -1.55, 2.05);
    shape.closePath();
    return new THREE.ShapeGeometry(shape, 12);
  }, []);
  const post = useMemo(signPostGeometry, []);
  const caveLabel = useMemo(() => new THREE.MeshLambertMaterial({ map: labelTexture("CAVE") }), []);
  const cliffLabel = useMemo(() => new THREE.MeshLambertMaterial({ map: labelTexture("CLIFF") }), []);
  const dark = useMemo(() => new THREE.MeshBasicMaterial({ color: "#111925", fog: true }), []);
  // The threshold stands in the level notch groundY cuts for it; the terrain
  // rises sharply behind the rock face.
  const caveY = groundY(CAVE_MOUTH.x, CAVE_MOUTH.z);
  return (
    <group>
      <mesh geometry={cave} material={occluderMat} position={[CAVE_MOUTH.x, caveY, CAVE_MOUTH.z - 0.58]} userData={{ cameraCollider: true }} />
      <mesh geometry={caveOpening} material={dark} position={[CAVE_MOUTH.x, caveY + 0.03, CAVE_MOUTH.z]} />
      <group position={[CAVE_SIGN.x, groundY(CAVE_SIGN.x, CAVE_SIGN.z), CAVE_SIGN.z]} rotation={[0, -0.12, 0]}>
        <mesh geometry={post} material={flatMat} />
        <mesh material={caveLabel} position={[0, 1.46, 0.101]}><planeGeometry args={[1.32, 0.42]} /></mesh>
      </group>
      <group position={[CLIFF_SIGN.x, groundY(CLIFF_SIGN.x, CLIFF_SIGN.z), CLIFF_SIGN.z]} rotation={[0, 0.14, 0]}>
        <mesh geometry={post} material={flatMat} />
        <mesh material={cliffLabel} position={[0, 1.46, 0.101]}><planeGeometry args={[1.32, 0.42]} /></mesh>
      </group>
    </group>
  );
}

export function Landmarks() {
  const boulders = useMemo(() => bouldersGeometry(BOULDERS), []);
  const far = useMemo(farIslandGeometry, []);
  const tower = useMemo(towerGeometry, []);
  const wreck = useMemo(wreckGeometry, []);
  const debris = useMemo(debrisGeometry, []);
  const camp = useMemo(() => kaiCampGeometry(LEAN_TO, { x: KAI_HOME.x - 1.2, z: KAI_HOME.z + 1.3 }, groundY(KAI_HOME.x, KAI_HOME.z)), []);
  const signY = groundY(FOREST_GAP.sign.x, FOREST_GAP.sign.z);
  const gap = useMemo(() => forestGapGeometry(FOREST_GAP, FOREST_GAP.sign, groundY(FOREST_GAP.x, FOREST_GAP.z), signY), [signY]);
  const signMat = useMemo(() => new THREE.MeshLambertMaterial({ map: signTexture() }), []);
  const sa = -0.25;
  return (
    <group>
      <mesh geometry={boulders} material={occluderMat} userData={{ cameraCollider: true }} />
      <mesh geometry={far} material={occluderMat} userData={{ cameraCollider: true }} />
      <mesh geometry={tower} material={occluderMat} position={[26, 25, -78]} />
      <group position={[WRECK.x, groundY(WRECK.x, WRECK.z), WRECK.z]} rotation={[0, WRECK.rot, 0.12]}>
        <mesh geometry={wreck} material={occluderMat} />
      </group>
      <mesh geometry={debris} material={occluderMat} />
      <mesh geometry={camp} material={occluderMat} />
      <mesh geometry={gap} material={occluderMat} />
      <StreamAndPond />
      <FallenPalm />
      <BridgeModel />
      <ClosedNorth />
      <mesh
        position={[FOREST_GAP.sign.x + Math.sin(sa) * 0.11, signY + 1.55, FOREST_GAP.sign.z + 0.06 + Math.cos(sa) * 0.11]}
        rotation={[0, sa, 0]}
        material={signMat}
      >
        <planeGeometry args={[1.42, 0.5]} />
      </mesh>
    </group>
  );
}

export function useSeaMaterial() {
  return useMemo(() => new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, transparent: true, opacity: 0.92 }), []);
}

export { smoothMat };
