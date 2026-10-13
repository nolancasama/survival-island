import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { rt } from "../game/runtime";
import {
  BOULDERS,
  FOREST_GAP,
  KAI_HOME,
  LEAN_TO,
  PALMS,
  SEA_Y,
  WRECK,
  groundY,
  shoreZ
} from "../game/world/island";
import { makeRng } from "../game/logic/rng";
import { flatMat, signTexture, smoothMat } from "./materials";
import {
  bouldersGeometry,
  bushGeometry,
  farIslandGeometry,
  jungleTreeGeometry,
  palmAt,
  palmsGeometry,
  towerGeometry
} from "./models/nature";
import { debrisGeometry, forestGapGeometry, kaiCampGeometry, wreckGeometry } from "./models/props";

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
  { l: 0, top: "#0b1430", horizon: "#27305e", sun: "#6b7bd6", sunI: 0.3, sky: "#5a6ab0", ground: "#1d2238", hemiI: 0.62, sea: "#28356a" },
  { l: 0.15, top: "#1b2358", horizon: "#e47c5c", sun: "#ff9a5a", sunI: 0.6, sky: "#9686c4", ground: "#4a3a40", hemiI: 0.78, sea: "#5a6ab0" },
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

/** Sky dome, sun, and the fixed light set (hemisphere + sun + ambient). */
export function SkyAndLights({ seaMat }: { seaMat: THREE.MeshLambertMaterial }) {
  const { scene, gl } = useThree();
  const hemi = useRef<THREE.HemisphereLight>(null);
  const sun = useRef<THREE.DirectionalLight>(null);
  const sunDisc = useRef<THREE.Mesh>(null);
  const last = useRef(-1);
  const dome = useMemo(() => {
    const g = new THREE.SphereGeometry(420, 24, 14);
    g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 3), 3));
    return g;
  }, []);
  const domeMat = useMemo(() => new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }), []);
  const discMat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#fff4d6", fog: false, transparent: true, opacity: 0.95 }), []);

  useEffect(() => {
    scene.fog = new THREE.Fog("#d6efff", 60, 230);
  }, [scene]);

  useFrame(() => {
    const l = rt.light;
    if (Math.abs(l - last.current) < 0.0015) return;
    last.current = l;
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
    gl.setClearColor(s.horizon);
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
      <mesh geometry={dome} material={domeMat} renderOrder={-10} />
      <mesh ref={sunDisc} material={discMat} renderOrder={-9}>
        <circleGeometry args={[14, 24]} />
      </mesh>
      <hemisphereLight ref={hemi} args={["#d8ecff", "#b8a070", 1.1]} />
      <directionalLight ref={sun} color="#ffffff" intensity={2.3} position={[-40, 50, 20]} />
      <ambientLight color="#ffffff" intensity={0.18} />
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
    const z = p.getZ(i);
    p.setY(i, groundY(x, z));
    const d = z - shoreZ(x);
    c.copy(SAND);
    c.lerp(WET, sstep(-2.8, -0.6, d));
    c.lerp(UNDER, sstep(0, 3, d));
    c.lerp(GRASS, sstep(1.8, -1.5, z));
    c.lerp(FOREST, sstep(-2, -5, z));
    c.lerp(DEEP_FOREST, sstep(-8, -14, z));
    const k = 0.95 + rand() * 0.07;
    colors[i * 3] = c.r * k;
    colors[i * 3 + 1] = c.g * k;
    colors[i * 3 + 2] = c.b * k;
  }
  g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return g;
}

export function Terrain() {
  const geo = useMemo(terrainGeometry, []);
  return <mesh geometry={geo} material={flatMat} />;
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
  for (let z = -4.6; z > -26; z -= 2.6 + rand() * 0.8) {
    const rowDensity = z > -12 ? 2.9 : 4.2;
    for (let x = -74; x < 74; x += rowDensity + rand() * 1.4) {
      const px = x + (rand() - 0.5) * 1.6;
      const pz = z + (rand() - 0.5) * 1.4;
      if (inGap(px, pz)) continue;
      trees.push({ x: px, z: pz, s: 0.85 + rand() * 0.55, r: rand() * Math.PI * 2, tint: 0.85 + rand() * 0.3 });
    }
  }
  for (let x = -40; x < 40; x += 2.2 + rand() * 2.5) {
    if (inGap(x, -3)) continue;
    bushes.push({ x, z: -3.2 - rand() * 0.9, s: 0.7 + rand() * 0.6, r: rand() * 6, tint: 0.85 + rand() * 0.3 });
  }
  // Headland trees.
  for (const side of [-1, 1]) {
    for (let i = 0; i < 9; i++) {
      trees.push({ x: side * (42 + rand() * 8), z: -6 + rand() * 12, s: 0.9 + rand() * 0.4, r: rand() * 6, tint: 0.9 + rand() * 0.2 });
    }
  }
  return { trees, bushes };
}

function Instanced({ geometry, spots, yOffset = 0 }: { geometry: THREE.BufferGeometry; spots: TreeSpot[]; yOffset?: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new THREE.Object3D();
    const c = new THREE.Color();
    spots.forEach((s, i) => {
      o.position.set(s.x, groundY(s.x, s.z) + yOffset, s.z);
      o.rotation.set(0, s.r, 0);
      o.scale.setScalar(s.s);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
      m.setColorAt(i, c.setRGB(s.tint, s.tint * (0.95 + (i % 3) * 0.04), s.tint));
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
  }, [spots, yOffset]);
  return <instancedMesh ref={ref} args={[geometry, flatMat, spots.length]} frustumCulled={false} />;
}

/** Distance from point (px, pz) to segment a->b in XZ, and how far along it lies (0..1). */
function segDist(ax: number, az: number, bx: number, bz: number, px: number, pz: number) {
  const dx = bx - ax;
  const dz = bz - az;
  const l2 = dx * dx + dz * dz || 1;
  const u = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / l2));
  return { d: Math.hypot(ax + dx * u - px, az + dz * u - pz), u };
}

/**
 * Palms are separate meshes so one standing between the camera and the
 * player can fade out (a giant frond across the screen hides everything).
 */
function Palms() {
  const items = useMemo(
    () =>
      PALMS.map((palm, i) => ({
        geo: palmsGeometry([palm], 7 + i),
        mat: new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, transparent: true }),
        base: palmAt(palm, 0),
        top: palmAt(palm, 1),
        fade: 1
      })),
    []
  );
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const c = rt.camera.pos;
    const t = rt.camera.target;
    for (const it of items) {
      const crown = segDist(c.x, c.z, t.x, t.z, it.top[0], it.top[2]);
      const lineY = c.y + (t.y - c.y) * crown.u;
      const crownBlocks = crown.u > 0.02 && crown.u < 0.97 && crown.d < 2.6 && Math.abs(lineY - it.top[1]) < 2.4;
      const trunk = segDist(c.x, c.z, t.x, t.z, it.base[0], it.base[2]);
      const trunkBlocks = trunk.u > 0.05 && trunk.u < 0.9 && trunk.d < 0.7;
      const nearCam = Math.hypot(c.x - it.top[0], c.y - it.top[1], c.z - it.top[2]) < 3.2;
      const want = crownBlocks || trunkBlocks || nearCam ? 0.18 : 1;
      it.fade += (want - it.fade) * Math.min(1, dt * 7);
      it.mat.opacity = it.fade;
      it.mat.depthWrite = it.fade > 0.97;
    }
  });
  return (
    <group>
      {items.map((it, i) => (
        <mesh key={i} geometry={it.geo} material={it.mat} />
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
      <Instanced geometry={tree} spots={trees} />
      <Instanced geometry={bush} spots={bushes} />
    </group>
  );
}

// ------------------------------------------------------------ the rest

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
      <mesh geometry={boulders} material={flatMat} />
      <mesh geometry={far} material={flatMat} />
      <mesh geometry={tower} material={flatMat} position={[26, 25, -78]} />
      <group position={[WRECK.x, groundY(WRECK.x, WRECK.z), WRECK.z]} rotation={[0, WRECK.rot, 0.12]}>
        <mesh geometry={wreck} material={flatMat} />
      </group>
      <mesh geometry={debris} material={flatMat} />
      <mesh geometry={camp} material={flatMat} />
      <mesh geometry={gap} material={flatMat} />
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
