import * as THREE from "three";
import { PartBuilder } from "../partBuilder";
import { between, rockGeometry } from "./nature";

export function caveShellGeometry(x: number, z: number): THREE.BufferGeometry {
  const b = new PartBuilder(0.7);
  // A high roof stays above the follow camera; the south wall is a low cutaway.
  b.box(14, 0.5, 18, x, 13.5, z, "#615e60");
  for (const side of [-1, 1]) {
    for (let i = 0; i < 8; i++) {
      if (side < 0 && i > 4) continue;
      b.add(rockGeometry(1.7, 6, 221 + i, 0), i % 2 ? "#66666b" : "#777076", [x + side * 6.9, 2, z - 8 + i * 2.3], [0, i * 0.7, 0], [0.8, 1, 1]);
    }
  }
  for (let i = 0; i < 7; i++) {
    b.add(rockGeometry(1.55, 6, 250 + i, 0), "#68666d", [x - 6 + i * 2, 2, z - 9], [0, i, 0]);
    if (i > 2) b.add(rockGeometry(1.4, 1.0, 270 + i, 0), "#777076", [x - 6 + i * 2, 0.2, z + 9.2]);
  }
  // The entrance bends around the west end of the chamber's low front wall.
  b.box(2, 1.15, 10, x - 1, 0, z + 15, "#726e73");
  b.box(2, 1.15, 14, x - 9, 0, z + 13, "#69666d");
  for (let i = 0; i < 16; i++) b.add(rockGeometry(0.3, 0.15, 300 + i, 0), "#91857b", [x - 5 + (i * 3.7) % 10, 0.01, z - 7 + (i * 5.3) % 14]);
  return b.build();
}

/** Ground must remain opaque: the wall occlusion shader otherwise cuts a dark hole below the player. */
export function caveFloorGeometry(x: number, z: number): THREE.BufferGeometry {
  const b = new PartBuilder(0.7);
  b.box(14, 0.45, 18, x, -0.45, z, "#a28c72");
  b.box(6, 0.4, 16, x - 5, -0.4, z + 12, "#ad957a");
  return b.build();
}

export function caveCrystalsGeometry(x: number, z: number): THREE.BufferGeometry {
  const b = new PartBuilder(0);
  for (const [dx, dz] of [[-5.5, 4], [5.8, -2], [-4.8, -7]]) {
    for (let k = 0; k < 3; k++) b.add(new THREE.ConeGeometry(0.16 + k * 0.035, 0.7 + k * 0.22, 5), "#87cbdc", [x + dx + (k - 1) * 0.23, 0.35 + k * 0.11, z + dz], [0.1, k, (k - 1) * 0.25], [1, 1, 1], { flatAo: true });
  }
  return b.build();
}

export function oldBoxGeometry(lid: boolean): THREE.BufferGeometry {
  const b = new PartBuilder(0.2);
  if (lid) {
    b.box(1.65, 0.16, 1.08, 0, 0, 0.54, "#8e6849");
    for (const x of [-0.64, 0.64]) b.box(0.1, 0.05, 1.1, x, 0.16, 0.54, "#63757a");
  } else {
    b.box(1.6, 0.15, 1.05, 0, 0, 0, "#5e4939");
    for (const x of [-0.74, 0.74]) b.box(0.13, 0.75, 1.05, x, 0.08, 0, "#806044");
    for (const z of [-0.46, 0.46]) b.box(1.6, 0.75, 0.13, 0, 0.08, z, "#9a7650");
    for (const x of [-0.64, 0.64]) for (const z of [-0.54, 0.54]) b.box(0.1, 0.8, 0.035, x, 0.03, z, "#617277");
    b.box(0.19, 0.22, 0.07, 0, 0.5, 0.56, "#bbc1b5");
    b.box(0.66, 0.3, 0.32, 0, 0.2, 0, "#506d66");
    b.box(0.26, 0.16, 0.03, -0.13, 0.3, 0.18, "#c6d3aa");
    between(b, [0.2, 0.48, 0], [0.37, 0.77, 0], 0.016, 0.01, "#b5bdba", 4);
  }
  return b.build();
}

export function signalPadGeometry(): THREE.BufferGeometry {
  const b = new PartBuilder(0.2);
  b.cyl(1.75, 1.8, 0.07, 0, 0, 0, "#b09a75", 18);
  for (let i = 0; i < 12; i++) {
    const a = i * Math.PI / 6;
    b.add(rockGeometry(0.35, 0.35, 350 + i, 0), i % 2 ? "#b7b3a2" : "#95988b", [Math.cos(a) * 1.6, 0.13, Math.sin(a) * 1.6], [0, a, 0]);
  }
  return b.build();
}

export function signalFireGeometry(): THREE.BufferGeometry {
  const b = new PartBuilder(0.2);
  b.boxAt(2.25, 0.06, 1.9, [0, 0.12, 0], [0, 0.2, 0], "#7b989c");
  for (let level = 0; level < 3; level++) {
    for (const side of [-1, 1]) b.cylAt(0.18, 2.15 - level * 0.25, [level % 2 ? side * 0.5 : 0, 0.34 + level * 0.3, level % 2 ? 0 : side * 0.5], level % 2 ? [Math.PI / 2, 0, 0] : [0, 0, Math.PI / 2], level % 2 ? "#694126" : "#8c5631", 7);
  }
  return b.build();
}

export function helicopterGeometry(): THREE.BufferGeometry {
  const b = new PartBuilder(0.25);
  b.sphere(1, 0, 1.55, 0, "#f3a727", [1.1, 1, 1.8], 12);
  b.sphere(1, 0, 1.78, -1.1, "#8ed4e0", [0.95, 0.7, 0.85], 10);
  b.box(2.16, 0.26, 1.65, 0, 1.13, 0.15, "#f5e9cb");
  b.box(0.12, 0.9, 1.02, -1.06, 1.2, 0.2, "#e67c27");
  b.box(0.12, 0.9, 1.02, 1.06, 1.2, 0.2, "#e67c27");
  for (const side of [-1, 1]) {
    b.box(0.08, 0.4, 0.14, side * 1.14, 1.5, 0.7, "#f5e9cb");
    b.box(0.08, 0.14, 0.4, side * 1.14, 1.63, 0.7, "#f5e9cb");
    between(b, [side * 0.8, 0.9, -0.75], [side * 1.15, 0.3, -0.75], 0.06, 0.06, "#d7d9d0", 5);
    between(b, [side * 0.8, 0.9, 0.75], [side * 1.15, 0.3, 0.75], 0.06, 0.06, "#d7d9d0", 5);
    b.cylAt(0.075, 3.5, [side * 1.15, 0.22, 0], [Math.PI / 2, 0, 0], "#45545a", 6);
  }
  between(b, [0, 1.65, 1.15], [0, 2.1, 5.2], 0.4, 0.12, "#e78527", 7);
  b.boxAt(0.15, 1.5, 0.9, [0, 2.65, 4.9], [-0.2, 0, 0], "#edb83d");
  b.box(2.1, 0.12, 0.65, 0, 2.02, 4, "#f5e9cb");
  b.cyl(0.1, 0.16, 0.55, 0, 2.4, 0, "#47555a", 6);
  return b.build();
}

export function helicopterRotorGeometry(tail = false): THREE.BufferGeometry {
  const b = new PartBuilder(0);
  const r = tail ? 1.05 : 4.15;
  b.box(r * 2, 0.055, tail ? 0.12 : 0.22, 0, 0, 0, "#45545a");
  b.box(tail ? 0.12 : 0.22, 0.055, r * 2, 0, 0, 0, "#556269");
  b.cyl(0.15, 0.15, 0.13, 0, -0.04, 0, "#d9d7c4", 7);
  return b.build();
}
