import * as THREE from "three";
import { PartBuilder } from "../partBuilder";
import type { Boulder } from "../../game/world/island";
import { groundY } from "../../game/world/island";

type V3 = [number, number, number];

const UP = new THREE.Vector3(0, 1, 0);

/** Cylinder from point a to point b. */
export function between(b: PartBuilder, a: V3, c: V3, r0: number, r1: number, color: THREE.ColorRepresentation, seg = 7) {
  const va = new THREE.Vector3(...a);
  const vc = new THREE.Vector3(...c);
  const dir = vc.clone().sub(va);
  const len = dir.length();
  const q = new THREE.Quaternion().setFromUnitVectors(UP, dir.normalize());
  const e = new THREE.Euler().setFromQuaternion(q);
  const mid = va.clone().add(vc).multiplyScalar(0.5);
  b.add(new THREE.CylinderGeometry(r1, r0, len, seg), color, [mid.x, mid.y, mid.z], [e.x, e.y, e.z]);
}

/** Deterministic lumpy rock (shared vertices get the same jitter, so faces stay closed). */
export function rockGeometry(r: number, h: number, seed: number, detail = 1): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(1, detail);
  const p = g.attributes.position;
  const rand = (x: number, y: number, z: number) => {
    const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719 + seed * 4.1) * 43758.5453;
    return s - Math.floor(s);
  };
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const k = 0.78 + rand(Math.round(x * 100), Math.round(y * 100), Math.round(z * 100)) * 0.38;
    p.setXYZ(i, x * r * k, Math.max(-0.35, y) * h * k, z * r * k);
  }
  return g;
}

/**
 * One palette for every procedural vegetation kind. Warm bark and cool shade
 * keep silhouettes readable; yellow-green upper leaves catch the island sun.
 */
export const VEGETATION_PALETTE = {
  trunk: { dark: "#68452f", mid: "#8e603b", light: "#ad7d4e", cut: "#d5ae72" },
  foliage: { dark: "#4c8c64", mid: "#549b50", light: "#88ba58", highlight: "#a2cc68" },
  palm: { dark: "#316f43", mid: "#4b9746", light: "#79b653", dead: "#8b944c" },
  leafBush: { dark: "#7dcc52", mid: "#8fd45a", light: "#b5e66a" }
} as const;

export {
  jungleTreeGeometry, bushGeometry, leafBushGeometry,
  choppableTreeGeometry, stumpGeometry
} from "./vegetationBroadleaf";
export { palmAt, palmGeometry, palmsGeometry, createPalmCrowns } from "./vegetationPalms";

export function bouldersGeometry(list: Boulder[]): THREE.BufferGeometry {
  const b = new PartBuilder(0.9);
  list.forEach((r, i) => {
    const y = groundY(r.x, r.z);
    b.add(rockGeometry(r.r, r.h * 0.75, i + 1), i % 3 ? "#9b958b" : "#8d8a84", [r.x, y + r.h * 0.18, r.z], [0, r.rot, 0]);
  });
  return b.build();
}

export function driftwoodGeometry(): THREE.BufferGeometry {
  const b = new PartBuilder(0.25);
  b.cylAt(0.15, 1.7, [0, 0.14, 0], [0, 0, Math.PI / 2 + 0.05], "#b29676", 8);
  b.cylAt(0.152, 0.02, [0.86, 0.15, 0], [0, 0, Math.PI / 2], "#e2cfae", 8);
  b.cylAt(0.152, 0.02, [-0.86, 0.13, 0], [0, 0, Math.PI / 2], "#e2cfae", 8);
  b.cylAt(0.1, 1.1, [0.1, 0.27, 0.12], [0.2, 0.9, Math.PI / 2], "#a3896b", 7);
  b.cylAt(0.05, 0.45, [-0.35, 0.3, -0.12], [0.6, 0, 0.5], "#a3896b", 5);
  return b.build();
}

export function stonePileGeometry(): THREE.BufferGeometry {
  const b = new PartBuilder(0.3);
  b.add(rockGeometry(0.3, 0.26, 11, 0), "#a7adb6", [0, 0.16, 0]);
  b.add(rockGeometry(0.24, 0.2, 12, 0), "#959ba5", [0.36, 0.12, 0.12]);
  b.add(rockGeometry(0.2, 0.18, 13, 0), "#b5bbc4", [-0.3, 0.1, 0.18]);
  b.add(rockGeometry(0.17, 0.15, 14, 0), "#9aa0aa", [0.08, 0.3, 0.05]);
  return b.build();
}

export function coconutGeometry(): THREE.BufferGeometry {
  const b = new PartBuilder(0.15);
  b.sphere(0.2, 0, 0.19, 0, "#7a4f2c", [1, 0.95, 1], 10);
  b.sphere(0.17, 0.3, 0.16, 0.12, "#6d4626", [1, 0.95, 1], 10);
  b.add(new THREE.ConeGeometry(0.12, 0.6, 4), "#58b447", [-0.25, 0.05, -0.15], [Math.PI / 2, 0.6, 0], [1, 1, 0.2]);
  return b.build();
}

/** Hills and cliffs behind the forest (the rest of the island, for later phases). */
export function farIslandGeometry(): THREE.BufferGeometry {
  const b = new PartBuilder(4);
  // Footprints stay north of the walkable forest and pond clearing (z > -42):
  // the terrain's own northern climb encloses the forest, and a hill poking up
  // through the forest floor would read as a wall (and be cut by the line-of-sight fade).
  const hills: Array<[number, number, number, number, string]> = [
    [-66, -60, 24, 14, "#4f8f4a"],
    [-30, -74, 28, 18, "#457f42"],
    [6, -82, 27, 20, "#4a8a45"],
    [44, -72, 26, 16, "#4f8f4a"],
    [70, -45, 24, 10, "#559650"],
    [-82, -30, 22, 8, "#5a9a52"],
    [86, -24, 18, 7, "#5a9a52"]
  ];
  hills.forEach(([x, z, r, h, c], i) => b.add(rockGeometry(r, h, 20 + i, 1), c, [x, -1, z]));
  // The walkable northern terrain now carries the signal tower plateau.
  // Headlands at both ends of the beach.
  b.add(rockGeometry(9, 6, 50, 1), "#8f8a7f", [-46, -1, 10]);
  b.add(rockGeometry(7, 9, 51, 1), "#4f8f4a", [-48, 1.5, -2]);
  b.add(rockGeometry(9, 6, 52, 1), "#8f8a7f", [46, -1, 12]);
  b.add(rockGeometry(8, 9, 53, 1), "#4f8f4a", [48, 1.5, 0]);
  return b.build();
}

/** The abandoned signal tower on the clifftop (the story's last goal). */
export function towerGeometry(): THREE.BufferGeometry {
  const b = new PartBuilder(0);
  const h = 11;
  const legs: Array<[number, number]> = [
    [-1.6, -1.6],
    [1.6, -1.6],
    [1.6, 1.6],
    [-1.6, 1.6]
  ];
  for (const [x, z] of legs) between(b, [x, 0, z], [x * 0.35, h, z * 0.35], 0.18, 0.12, "#6d5b4a", 5);
  for (let k = 1; k <= 3; k++) {
    const y = (h / 4) * k;
    const s = 1 - (0.65 * y) / h;
    for (let i = 0; i < 4; i++) {
      const [ax, az] = legs[i];
      const [bx, bz] = legs[(i + 1) % 4];
      between(b, [ax * s, y, az * s], [bx * s, y, bz * s], 0.07, 0.07, "#7d6a58", 4);
    }
  }
  b.box(2.2, 0.25, 2.2, 0, h, 0, "#7d6a58");
  b.box(1.2, 1.1, 1.2, 0, h + 0.25, 0, "#a35a3c");
  b.cyl(0.05, 0.05, 2.2, 0, h + 1.35, 0, "#3b3b3b", 5);
  return b.build();
}
