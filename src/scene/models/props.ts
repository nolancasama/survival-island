import * as THREE from "three";
import { PartBuilder } from "../partBuilder";
import { between, rockGeometry } from "./nature";

/** The shipwreck, built along local +x (matches the collision rect). */
export function wreckGeometry(): THREE.BufferGeometry {
  const b = new PartBuilder(0.9);
  type Point = [number, number, number];
  // Thin solid planks give genuine gaps and visible cut edges, rather than
  // painting a black rectangle onto a closed box. Everything is still merged.
  const panel = (points: Point[], color: string, thickness: number) => {
    const positions: number[] = [];
    const back = points.map(([x, y, z]): Point => [x, y, z - thickness]);
    for (let i = 1; i < points.length - 1; i++) {
      positions.push(...points[0], ...points[i], ...points[i + 1]);
      positions.push(...back[0], ...back[i + 1], ...back[i]);
    }
    points.forEach((p, i) => {
      const j = (i + 1) % points.length;
      positions.push(...p, ...back[i], ...points[j], ...points[j], ...back[i], ...back[j]);
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    g.computeVertexNormals();
    b.add(g, color, [0, 0, 0]);
  };
  const sections = [
    [-4.7, 0.72], [-3.35, 1.38], [-1.7, 1.64], [0, 1.68],
    [1.65, 1.5], [3.1, 1.02], [4.8, 0.12]
  ];
  const colors = ["#7c5133", "#986a43", "#ad7b4e", "#8b5c37"];
  const widths = [0.35, 0.65, 0.88, 1, 1.02];
  // Faceted, tapering hull, with a missing stern and fractured starboard side.
  for (const side of [-1, 1]) {
    for (let row = 0; row < 4; row++) {
      for (let i = 0; i < sections.length - 1; i++) {
        if (side === 1 && i === 1 && row >= 1) continue;
        if (i === 0 && row === 3) continue;
        const [x0, w0] = sections[i];
        const [x1, w1] = sections[i + 1];
        const y = -0.66 + row * 0.55;
        const tip = side === 1 && i === 2 && row >= 1 ? 0.38 : 0;
        panel([
          [x0 + tip, y, side * w0 * widths[row]],
          [x1, y + (i === 5 ? 0.16 : 0), side * w1 * widths[row]],
          [x1, y + 0.49 + (i === 5 ? 0.16 : 0), side * w1 * widths[row + 1]],
          [x0 + tip * 0.15, y + 0.49, side * w0 * widths[row + 1]]
        ], colors[(row + i + (side === 1 ? 1 : 0)) % colors.length], side * 0.075);
      }
    }
  }
  between(b, [-4.65, -0.52, 0], [4.78, -0.47, 0], 0.13, 0.1, "#4e3524", 5);
  // Exposed U-shaped ribs and the dark, open interior remain visible through
  // the broken planks and missing deck from both approach directions.
  for (const [x, w] of sections.slice(1, -1)) {
    for (const side of [-1, 1]) {
      between(b, [x, -0.5, 0], [x, -0.03, side * w * 0.62], 0.075, 0.07, "#5a3d28", 5);
      between(b, [x, -0.03, side * w * 0.62], [x, 1.58, side * w], 0.07, 0.065, "#c39a68", 5);
    }
  }
  for (let i = 0; i < 5; i++) {
    b.boxAt(5.7 - (i % 2) * 0.7, 0.09, 0.25, [-0.8, -0.14, (i - 2) * 0.28], [0, 0, 0.015 * i], "#62452e");
  }
  for (let i = 0; i < 5; i++) {
    b.boxAt(3.4 - (i % 3) * 0.36, 0.11, 0.3, [1.45 + (i % 2) * 0.2, 1.32, (i - 2) * 0.32], [0, (i - 2) * 0.025, 0.02], i % 2 ? "#c08e59" : "#a77749");
  }
  b.boxAt(2.25, 0.11, 0.33, [-3.18, 0.56, 0.68], [0.12, -0.3, -0.4], "#bc8f5c");
  b.boxAt(1.4, 0.1, 0.28, [-3.85, 0.12, -0.55], [0, 0.45, 0.22], "#9d754b");
  // Leaning snapped mast, broken spar, and an irregular billowing sail. The
  // sail uses explicit reverse faces, with no transparent material or texture.
  between(b, [-0.85, -0.1, 0], [-2.25, 5.25, 0.6], 0.2, 0.12, "#6a4527", 7);
  between(b, [-2.24, 5.24, 0.6], [-1.55, 4.72, 0.76], 0.09, 0.025, "#c29968", 5);
  between(b, [-4.0, 4.45, 0.48], [0.15, 4.37, 0.66], 0.065, 0.05, "#785234", 5);
  const sail: Point[] = [
    [-3.9, 4.4, 0.5], [-0.05, 4.32, 0.66], [-0.12, 3.76, 0.76],
    [-0.46, 3.86, 0.8], [-0.2, 3.13, 0.88], [-0.9, 3.35, 0.94],
    [-0.62, 2.68, 0.94], [-1.43, 2.98, 1.02], [-1.73, 2.53, 1.02],
    [-2.35, 2.97, 0.92], [-2.91, 2.72, 0.78], [-3.6, 3.38, 0.58],
    [-3.28, 3.74, 0.58]
  ];
  const sailPositions: number[] = [];
  const centre: Point = [-2.12, 3.75, 1.08];
  sail.forEach((p, i) => {
    const next = sail[(i + 1) % sail.length];
    sailPositions.push(...centre, ...p, ...next, ...centre, ...next, ...p);
  });
  const cloth = new THREE.BufferGeometry();
  cloth.setAttribute("position", new THREE.Float32BufferAttribute(sailPositions, 3));
  cloth.computeVertexNormals();
  b.add(cloth, "#e5d6b7", [0, 0, 0]);
  // Rails survive only in short, uneven fragments.
  for (const [x, z, tilt] of [[-3.5, -1.35, -0.2], [-1.8, -1.62, 0.1], [0.3, -1.65, 0.22], [2.2, 1.28, -0.35]]) {
    b.cylAt(0.06, 0.64, [x, 1.73, z], [0, 0, tilt], "#6a4527", 5);
  }
  between(b, [-3.56, 2.02, -1.35], [-1.76, 2.06, -1.62], 0.055, 0.045, "#94704b", 5);
  between(b, [0.37, 2.02, -1.65], [1.35, 1.81, -1.46], 0.055, 0.025, "#a27a4e", 5);
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
