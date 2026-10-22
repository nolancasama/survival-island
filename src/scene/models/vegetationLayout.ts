import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { FOREST_GAP, NODES, PALMS, POND, STREAM, groundY } from "../../game/world/island";
import { makeRng } from "../../game/logic/rng";
import { bucketByTile } from "../tiles";
import { bushGeometry, jungleTreeGeometry, palmGeometry, createPalmCrowns } from "./nature";

export interface TreeSpot {
  x: number;
  z: number;
  s: number;
  r: number;
  tint: number;
}

export function treeSpots(): { trees: TreeSpot[]; bushes: TreeSpot[] } {
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


/** Distance from point (px, pz) to segment a->b in XZ, and how far along it lies (0..1). */
function segDist(ax: number, az: number, bx: number, bz: number, px: number, pz: number) {
  const dx = bx - ax;
  const dz = bz - az;
  const l2 = dx * dx + dz * dz || 1;
  const u = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / l2));
  return { d: Math.hypot(ax + dx * u - px, az + dz * u - pz), u };
}


/** Stable integer hash: visual variants never consume the placement RNG. */
export function vegetationHash(index: number): number {
  let h = Math.imul(index + 1, 0x45d9f3b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  return (h ^ (h >>> 16)) >>> 0;
}

/** Mild independent stretch preserves the authored paths and trunk clearance. */
export function vegetationStretch(index: number): [number, number, number] {
  const h = vegetationHash(index);
  return [0.96 + (h & 255) / 255 * 0.08, 0.97 + ((h >>> 8) & 255) / 255 * 0.07, 0.96 + ((h >>> 16) & 255) / 255 * 0.08];
}

/** Bake the former instance colour exactly, including its original list index. */
export function bakeVegetationSpot(prototype: THREE.BufferGeometry, spot: TreeSpot, index: number): THREE.BufferGeometry {
  const geometry = prototype.clone();
  const [sx, sy, sz] = vegetationStretch(index);
  const transform = new THREE.Matrix4().compose(
    new THREE.Vector3(spot.x, groundY(spot.x, spot.z), spot.z),
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), spot.r),
    new THREE.Vector3(spot.s * sx, spot.s * sy, spot.s * sz)
  );
  geometry.applyMatrix4(transform);
  const color = geometry.getAttribute("color");
  const green = spot.tint * (0.95 + (index % 3) * 0.04);
  for (let v = 0; v < color.count; v++) {
    color.setXYZ(v, color.getX(v) * spot.tint, color.getY(v) * green, color.getZ(v) * spot.tint);
  }
  return geometry;
}

/**
 * One static mesh per 40 m tile, shared by trees, palms and decorative bushes.
 * Build 5 x 3 tree, 3 bush and 4 crown prototypes once in Vegetation's useMemo;
 * clone/bake the spots, then release both prototypes and intermediate copies.
 * Palms keep authored palmAt curves (no stretching of coconut anchors).
 */
export function vegetationTiles(): THREE.BufferGeometry[] {
  const { trees, bushes } = treeSpots();
  const treeLibrary = Array.from({ length: 5 }, (_, archetype) =>
    Array.from({ length: 3 }, (_, variant) => jungleTreeGeometry(archetype, variant)));
  const bushLibrary = Array.from({ length: 3 }, (_, variant) => bushGeometry(variant));
  const crowns = createPalmCrowns();
  const parts: { x: number; z: number; geometry: THREE.BufferGeometry }[] = [];
  try {
    trees.forEach((spot, index) => {
      const hash = vegetationHash(index);
      parts.push({ ...spot, geometry: bakeVegetationSpot(treeLibrary[hash % 5][(hash >>> 8) % 3], spot, index) });
    });
    bushes.forEach((spot, index) => {
      parts.push({ ...spot, geometry: bakeVegetationSpot(bushLibrary[vegetationHash(index) % 3], spot, index) });
    });
    PALMS.forEach((palm, index) => {
      parts.push({ x: palm.x, z: palm.z, geometry: palmGeometry(palm, index % 4, crowns[index % 4]) });
    });
    return bucketByTile(parts).map((tile) => {
      const geometry = mergeGeometries(tile.map((part) => part.geometry), false);
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
      return geometry;
    });
  } finally {
    parts.forEach((part) => part.geometry.dispose());
    [...treeLibrary.flat(), ...bushLibrary, ...crowns].forEach((geometry) => geometry.dispose());
  }
}

