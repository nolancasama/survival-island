import * as THREE from "three";
import { PartBuilder } from "../partBuilder";
import { between, rockGeometry } from "./nature";

/** The shipwreck, built along local +x (matches the collision rect). */
export function wreckGeometry(): THREE.BufferGeometry {
  const b = new PartBuilder(1.2);
  const hull = "#7b4e2c";
  const plank = "#9a6a3f";
  // Hull body (open top), lying on its side a little.
  b.box(8.6, 2.1, 3.4, -0.6, -0.6, 0, hull);
  for (let i = 0; i < 4; i++) b.box(8.7, 0.12, 3.5, -0.6, -0.4 + i * 0.5, 0, i % 2 ? plank : "#86592f");
  // Bow wedge.
  b.add(new THREE.CylinderGeometry(0.1, 1.75, 2.1, 4, 1), hull, [4.4, 0.45, 0], [0, Math.PI / 4, -Math.PI / 2], [1, 1, 1]);
  // Deck (tilted planks) and a dark hole in the side.
  b.boxAt(7.6, 0.14, 3.1, [-0.6, 1.5, 0], [0, 0, 0], "#b9895a");
  b.boxAt(1.6, 1.0, 0.1, [-2.2, 0.4, 1.73], [0, 0, 0.15], "#2b1d14");
  // Broken mast with a torn sail.
  between(b, [-1.2, 1.5, 0], [-2.8, 5.4, 0.8], 0.2, 0.15, "#6a4527", 7);
  b.boxAt(0.08, 2.0, 2.2, [-2.3, 3.9, 0.55], [0.1, 0.3, 0.42], "#efe6d0");
  b.boxAt(0.08, 1.1, 1.3, [-1.9, 2.9, 1.5], [0.4, 0.5, 0.6], "#e6dbc2");
  // Railing posts.
  for (let i = 0; i < 6; i++) b.cyl(0.06, 0.06, 0.6, -4.4 + i * 1.5, 1.55, 1.5, "#6a4527", 5);
  return b.build();
}

/** Bits of the wreck washed up around it (decor, not collectible). */
export function debrisGeometry(): THREE.BufferGeometry {
  const b = new PartBuilder(0.4);
  const planks: Array<[number, number, number]> = [
    [20.5, 17.6, 0.4],
    [22.8, 18.6, -0.8],
    [29.4, 11.2, 1.2],
    [14.4, 15.1, 2.3]
  ];
  for (const [x, z, r] of planks) b.boxAt(1.5, 0.08, 0.32, [x, 0.12, z], [0, r, 0.05], "#a77a4b");
  // Barrels.
  b.cyl(0.38, 0.38, 0.95, 19.4, 0, 9.6, "#8a5a33", 10);
  b.cyl(0.4, 0.4, 0.06, 19.4, 0.3, 9.6, "#4a4a4a", 10);
  b.cyl(0.4, 0.4, 0.06, 19.4, 0.7, 9.6, "#4a4a4a", 10);
  b.cylAt(0.38, 0.95, [21.4, 0.38, 11.4], [Math.PI / 2, 0.7, 0], "#7f532f", 10);
  return b.build();
}

export function crateBodyGeometry(): THREE.BufferGeometry {
  const b = new PartBuilder(0.3);
  b.box(1, 0.78, 1, 0, 0, 0, "#c08a4a");
  for (const y of [0.2, 0.45, 0.7]) b.box(1.03, 0.06, 1.03, 0, y, 0, "#8a5a2c");
  for (const x of [-0.48, 0.48]) for (const z of [-0.48, 0.48]) b.box(0.08, 0.8, 0.08, x, 0, z, "#8a5a2c");
  return b.build();
}

export function crateLidGeometry(): THREE.BufferGeometry {
  const b = new PartBuilder(0);
  // Hinged at the back edge: geometry extends forward (+z) from the hinge.
  b.box(1.06, 0.12, 1.06, 0, 0, 0.53, "#d79c58");
  b.box(1.08, 0.04, 0.1, 0, 0.12, 0.53, "#8a5a2c");
  return b.build();
}

/** Kai's lean-to, log seat and bedroll. Positions are world coordinates. */
export function kaiCampGeometry(lean: { x: number; z: number }, seat: { x: number; z: number }, y: number): THREE.BufferGeometry {
  const b = new PartBuilder(0.4);
  const { x, z } = lean;
  // Two Y posts and a ridge pole.
  between(b, [x - 1.2, y, z + 0.6], [x - 1.2, y + 1.7, z + 0.6], 0.07, 0.06, "#6a4527", 5);
  between(b, [x + 1.2, y, z + 0.6], [x + 1.2, y + 1.7, z + 0.6], 0.07, 0.06, "#6a4527", 5);
  between(b, [x - 1.4, y + 1.7, z + 0.6], [x + 1.4, y + 1.7, z + 0.6], 0.07, 0.07, "#7a5532", 5);
  // Sloping roof of big leaves down to the back.
  for (let i = 0; i < 6; i++) {
    const px = x - 1.25 + i * 0.5;
    b.boxAt(0.55, 0.06, 2.0, [px, y + 0.95, z - 0.25], [0.95, 0, 0], i % 2 ? "#4fa046" : "#3f8f3f");
  }
  // Bedroll under it.
  b.cylAt(0.18, 1.3, [x, y + 0.18, z + 0.2], [0, 0, Math.PI / 2], "#c8584a", 8);
  // Log seat.
  b.cylAt(0.26, 1.4, [seat.x, y + 0.24, seat.z], [0, 0.4, Math.PI / 2], "#8a6238", 8);
  // A little pile of shells and a spear leaning on the post.
  between(b, [x + 1.35, y, z + 0.9], [x + 1.15, y + 2.1, z + 0.5], 0.03, 0.025, "#9a7a52", 4);
  b.add(rockGeometry(0.12, 0.08, 3, 0), "#f2e6d8", [x + 0.9, y + 0.05, z + 1.6]);
  b.add(rockGeometry(0.1, 0.07, 4, 0), "#f7d9d0", [x + 1.1, y + 0.05, z + 1.75]);
  return b.build();
}

/** Fallen palm across the forest path, and the sign post. */
export function forestGapGeometry(gap: { x: number; z: number }, sign: { x: number; z: number }, y: number, signY: number): THREE.BufferGeometry {
  const b = new PartBuilder(0.3);
  void gap;
  void y;
  b.box(0.16, 1.5, 0.16, sign.x, signY, sign.z, "#7a5532");
  b.boxAt(1.5, 0.56, 0.08, [sign.x, signY + 1.55, sign.z + 0.06], [0, -0.25, 0], "#b77f45");
  return b.build();
}

/** One half of the cut palm gate, centred at the cut end for the clearing animation. */
export function fallenPalmHalfGeometry(crown: boolean): THREE.BufferGeometry {
  const b = new PartBuilder(0.25);
  const x0 = crown ? 0 : -3.2;
  const x1 = crown ? 3.2 : 0;
  between(b, [x0, 0.3, 0], [x1, 0.34, 0], 0.28, crown ? 0.2 : 0.34, "#8a6238", 8);
  b.cylAt(0.29, 0.035, [0, 0.32, 0], [0, 0, Math.PI / 2], "#d6b174", 8);
  if (crown) {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      b.add(new THREE.ConeGeometry(0.42, 2.2, 4), i % 2 ? "#4e8f3f" : "#5aa247", [3.25, 0.45, 0], [Math.PI / 2, a, 0], [1, 1, 0.17]);
    }
  } else {
    b.add(rockGeometry(0.68, 0.55, 31, 0), "#6a4a2c", [-3.3, 0.38, 0]);
  }
  return b.build();
}

export function bridgePostsGeometry(): THREE.BufferGeometry {
  const b = new PartBuilder(0.25);
  for (const x of [-2.15, 2.15]) {
    for (const z of [-0.82, 0.82]) b.cyl(0.1, 0.14, 1.25, x, 0, z, "#6f4a29", 6);
    b.boxAt(0.22, 0.18, 1.85, [x, 0.22, 0], [0, 0, 0], "#76502d");
  }
  return b.build();
}

export function bridgePlankGeometry(): THREE.BufferGeometry {
  const b = new PartBuilder(0.12);
  b.box(0.48, 0.13, 1.5, 0, 0, 0, "#ad7b45");
  b.boxAt(0.43, 0.035, 1.38, [0, 0.13, 0], [0, 0.03, 0], "#c38d50");
  return b.build();
}

export function bridgeRailsGeometry(): THREE.BufferGeometry {
  const b = new PartBuilder(0.2);
  for (const z of [-0.82, 0.82]) {
    for (const x of [-1.65, -0.55, 0.55, 1.65]) b.cyl(0.055, 0.065, 0.72, x, 0.24, z, "#76502d", 5);
    between(b, [-2.05, 0.9, z], [2.05, 0.9, z], 0.055, 0.055, "#76502d", 5);
  }
  return b.build();
}

/** Reeds and lily pads around a pond centred at the origin. */
export function pondDetailsGeometry(r: number): THREE.BufferGeometry {
  const b = new PartBuilder(0.2);
  const reeds: Array<[number, number]> = [
    [-r * 0.72, -r * 0.55], [-r * 0.85, -r * 0.2], [r * 0.78, -r * 0.48],
    [r * 0.86, 0.24], [-r * 0.58, r * 0.67], [r * 0.52, r * 0.72]
  ];
  reeds.forEach(([x, z], i) => {
    for (let k = 0; k < 4; k++) {
      const ox = (k - 1.5) * 0.12;
      between(b, [x + ox, 0.03, z + (k % 2) * 0.1], [x + ox * 0.7, 0.75 + (k % 3) * 0.13, z], 0.025, 0.012, i % 2 ? "#699744" : "#7aa64b", 4);
    }
  });
  const pads: Array<[number, number, number]> = [[-1.1, 0.9, 0.48], [0.5, -1.25, 0.38], [1.35, 0.45, 0.34], [-0.3, 1.7, 0.3]];
  pads.forEach(([x, z, s], i) => b.add(new THREE.CircleGeometry(s, 10, 0.35, Math.PI * 1.82), i % 2 ? "#69a84b" : "#75b556", [x, 0.055, z], [-Math.PI / 2, 0, i]));
  return b.build();
}

export function fishingRockGeometry(): THREE.BufferGeometry {
  const b = new PartBuilder(0.15);
  b.add(rockGeometry(1.05, 0.42, 88, 0), "#8e918b", [0, 0.08, 0], [0, 0.3, 0], [1, 0.55, 0.8]);
  return b.build();
}

/** Dock points along local -z, with its first plank on shore. */
export function fishingDockGeometry(): THREE.BufferGeometry {
  const b = new PartBuilder(0.2);
  for (let i = 0; i < 6; i++) b.boxAt(1.15, 0.1, 0.42, [0, 0.2, -i * 0.4], [0, 0.04 * (i % 2), 0], i % 2 ? "#a97945" : "#bd8a50");
  for (const z of [0.05, -2.05]) for (const x of [-0.62, 0.62]) b.cyl(0.045, 0.065, 0.75, x, -0.2, z, "#6f4a29", 5);
  return b.build();
}

export function caveFaceGeometry(): THREE.BufferGeometry {
  const b = new PartBuilder(0.7);
  const rocks: Array<[number, number, number, number, number]> = [
    [-2.6, 0.8, 0, 1.5, 1.7], [2.6, 0.8, 0, 1.5, 1.7],
    [-2.15, 2.6, -0.05, 1.45, 1.5], [2.15, 2.6, -0.05, 1.45, 1.5],
    [-1.05, 3.7, -0.1, 1.55, 1.2], [0.7, 3.85, -0.1, 1.6, 1.2],
    [-4, 1.3, -0.5, 2.2, 2.4], [4.1, 1.4, -0.7, 2.1, 2.5]
  ];
  rocks.forEach(([x, y, z, r, h], i) => b.add(rockGeometry(r, h, 110 + i, 0), i % 2 ? "#77786f" : "#85847a", [x, y, z], [0, i * 0.5, 0]));
  return b.build();
}

export function rockfallGeometry(): THREE.BufferGeometry {
  const b = new PartBuilder(0.5);
  // A long pale trail climbs the analytical northern slope toward the tower.
  b.boxAt(4.6, 0.14, 21, [0, 6.05, -10.1], [0.52, 0, 0], "#9c825a");
  const rocks: Array<[number, number, number, number]> = [
    [-1.65, 0, 0.25, 1.4], [0, 0, -0.3, 1.7], [1.65, 0, 0.25, 1.35],
    [-0.9, 0.85, 0, 1.05], [0.7, 1.05, -0.15, 0.98], [2.25, 0, -0.45, 0.82]
  ];
  rocks.forEach(([x, y, z, r], i) => b.add(rockGeometry(r, r * 0.9, 130 + i, 0), i % 2 ? "#8a887f" : "#74766f", [x, y + r * 0.25, z], [0, i, 0]));
  return b.build();
}

export function signPostGeometry(): THREE.BufferGeometry {
  const b = new PartBuilder(0.15);
  b.box(0.14, 1.45, 0.14, 0, 0, 0, "#73502f");
  b.boxAt(1.42, 0.52, 0.09, [0, 1.45, 0.05], [0, 0, 0], "#b77f45");
  return b.build();
}
