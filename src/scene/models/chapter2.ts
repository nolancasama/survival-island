import * as THREE from "three";
import { PartBuilder } from "../partBuilder";
import { rockGeometry } from "./nature";
import { groundY } from "../../game/world/island";
import { COVE, COVE_HULL, COVE_MAST, COVE_ROCKS, GROVE, GROVE_GATE } from "../../game/world/chapter2";
import { makeRng } from "../../game/logic/rng";

/**
 * Chapter 2 models (EXPANSION_PLAN.md Milestones 1–3): Shipwreck Cove, the
 * Bamboo Grove and the bamboo structures. Procedural, merged per model (one
 * draw call each), in the island's low-poly palette.
 */

const BAMBOO = "#a9bf52";
const BAMBOO_DARK = "#7e9437";
const BAMBOO_LEAF = "#79ad45";
const WOOD_DARK = "#6b4628";
const WOOD = "#8a6038";
const IRON = "#646b73";
const SAIL = "#ece2c6";

/** A cylinder from a to b (used for poles, masts and bars). */
export function cylinderBetween(
  b: PartBuilder,
  a: readonly [number, number, number],
  c: readonly [number, number, number],
  radius: number,
  color: THREE.ColorRepresentation,
  seg = 7
) {
  const from = new THREE.Vector3(...a);
  const to = new THREE.Vector3(...c);
  const dir = to.clone().sub(from);
  const len = dir.length();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  const e = new THREE.Euler().setFromQuaternion(q);
  const mid = from.add(to).multiplyScalar(0.5);
  b.add(new THREE.CylinderGeometry(radius, radius, len, seg, 1), color, [mid.x, mid.y, mid.z], [e.x, e.y, e.z]);
}

/** A bamboo pole from a to b: a green culm with darker node rings. */
export function bambooPole(b: PartBuilder, a: readonly [number, number, number], c: readonly [number, number, number], radius = 0.045, tint = 1) {
  const color = new THREE.Color(BAMBOO).multiplyScalar(tint);
  cylinderBetween(b, a, c, radius, color, 6);
  const len = Math.hypot(c[0] - a[0], c[1] - a[1], c[2] - a[2]);
  const rings = Math.max(1, Math.floor(len / 0.42));
  for (let i = 1; i <= rings; i++) {
    const t = i / (rings + 1);
    const p: [number, number, number] = [a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t, a[2] + (c[2] - a[2]) * t];
    const ringA: [number, number, number] = [p[0] - (c[0] - a[0]) * 0.012, p[1] - (c[1] - a[1]) * 0.012, p[2] - (c[2] - a[2]) * 0.012];
    const ringB: [number, number, number] = [p[0] + (c[0] - a[0]) * 0.012, p[1] + (c[1] - a[1]) * 0.012, p[2] + (c[2] - a[2]) * 0.012];
    cylinderBetween(b, ringA, ringB, radius * 1.18, BAMBOO_DARK, 6);
  }
}

// ---------------------------------------------------------------- the cove

/** The cove's cliffs and the passage rocks, blue-grey and wave-worn. */
export function coveRocksGeometry(): THREE.BufferGeometry {
  const b = new PartBuilder(0.9);
  COVE_ROCKS.forEach((r, i) => {
    const y = groundY(r.x, r.z);
    b.add(rockGeometry(r.r, r.h * 0.75, 60 + i), i % 2 ? "#7f8791" : "#8b9198", [r.x, y + r.h * 0.18, r.z], [0, i * 1.3, 0]);
  });
  // Low weed-green rocks along the waterline and a few tide pools' rims.
  const rand = makeRng(77);
  for (let i = 0; i < 10; i++) {
    const x = COVE.x - 9 + rand() * 18;
    const z = 15.2 + rand() * 2.5;
    b.add(rockGeometry(0.35 + rand() * 0.5, 0.35 + rand() * 0.3, 80 + i, 0), i % 3 ? "#6f7a6a" : "#7b8379", [x, groundY(x, z) + 0.05, z], [0, rand() * 6, 0]);
  }
  return b.build();
}

/** Seaweed strands and tide pools on the cove's wet sand (one mesh). */
export function coveShoreGeometry(): THREE.BufferGeometry {
  const b = new PartBuilder(0);
  const rand = makeRng(91);
  for (let i = 0; i < 26; i++) {
    const x = COVE.x - 10 + rand() * 20;
    const z = 12.5 + rand() * 5.5;
    const y = groundY(x, z) + 0.03;
    b.boxAt(0.5 + rand() * 0.6, 0.03, 0.12, [x, y, z], [0, rand() * 3.1, 0], i % 2 ? "#3f6b3a" : "#4d7d3d");
  }
  for (const [x, z, r] of [[59.5, 13.5, 0.9], [69.5, 16.2, 1.2], [74.2, 12.2, 0.7]] as const) {
    const y = groundY(x, z) + 0.02;
    b.add(new THREE.CircleGeometry(r, 10), "#4fb7c6", [x, y + 0.02, z], [-Math.PI / 2, 0, 0], [1, 1, 1], { flatAo: true });
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      b.add(rockGeometry(0.16, 0.12, 120 + k, 0), "#868d93", [x + Math.cos(a) * r, y + 0.04, z + Math.sin(a) * r]);
    }
  }
  return b.build();
}

/** A broken hull section lying on its side: ribs, planks with gaps, a torn edge. */
export function coveHullGeometry(): THREE.BufferGeometry {
  const b = new PartBuilder(0.4);
  const L = COVE_HULL.hw * 2;
  // Keel along x, the hull curving up on the seaward side (z+).
  b.boxAt(L, 0.32, 0.4, [0, 0.16, -0.9], [0, 0, 0.04], WOOD_DARK);
  const planks = 7;
  for (let i = 0; i < planks; i++) {
    const a = (i / (planks - 1)) * 1.45;
    const y = 0.25 + Math.sin(a) * 1.9;
    const z = -0.9 + (1 - Math.cos(a)) * 2.0;
    const len = L * (0.96 - (i % 3 === 2 ? 0.28 : 0)) ;
    const off = i % 3 === 2 ? -L * 0.12 : 0;
    if (i === 4) continue; // a missing plank: the hole you can see through
    b.boxAt(len, 0.12, 0.52, [off, y, z], [a, 0, 0], i % 2 ? WOOD : "#7a5232");
  }
  for (let r = 0; r < 6; r++) {
    const x = -L / 2 + 0.6 + r * ((L - 1.2) / 5);
    for (let s = 0; s < 4; s++) {
      const a0 = (s / 4) * 1.45;
      const a1 = ((s + 1) / 4) * 1.45;
      cylinderBetween(b, [x, 0.25 + Math.sin(a0) * 1.85, -0.9 + (1 - Math.cos(a0)) * 1.95], [x, 0.25 + Math.sin(a1) * 1.85, -0.9 + (1 - Math.cos(a1)) * 1.95], 0.09, "#5b3b20", 5);
    }
  }
  // A broken stern post and a rail.
  b.boxAt(0.28, 2.6, 0.28, [L / 2 - 0.3, 1.2, 0.3], [0.2, 0, -0.35], WOOD_DARK);
  b.boxAt(L * 0.7, 0.14, 0.14, [-0.4, 2.15, 1.35], [0.15, 0, 0.05], "#9a7048");
  // Barnacle grey along the keel.
  for (let i = 0; i < 9; i++) b.sphere(0.12, -L / 2 + 0.5 + i * (L / 9), 0.08, -0.7, "#b9b4a8", [1, 0.5, 1], 6);
  return b.build();
}

/** The snapped mast lying across the sand with its torn sail hanging off it. */
export function coveMastGeometry(): THREE.BufferGeometry {
  const b = new PartBuilder(0.2);
  const half = COVE_MAST.length / 2;
  cylinderBetween(b, [-half, 0.32, 0], [half, 0.42, 0], 0.22, "#7a5532", 9);
  cylinderBetween(b, [half - 0.2, 0.42, 0], [half + 0.4, 0.52, 0.18], 0.16, "#946a40", 7);
  // The yard (cross spar) leaning on the mast.
  cylinderBetween(b, [-1.2, 0.2, -1.6], [0.8, 0.9, 1.4], 0.1, "#7a5532", 7);
  // Rope round the mast.
  for (const x of [-1.6, 1.9]) b.torus(0.25, 0.05, [x, 0.36, 0], [0, Math.PI / 2, 0], "#c9a464");
  return b.build();
}

/** A torn sail draped on the sand (the canvas salvage node's look). */
export function canvasNodeGeometry(): THREE.BufferGeometry {
  const b = new PartBuilder(0);
  const shape = new THREE.Shape();
  shape.moveTo(-0.9, -0.6);
  shape.lineTo(0.95, -0.7);
  shape.lineTo(1.05, 0.3);
  shape.lineTo(0.6, 0.45);
  shape.lineTo(0.75, 0.75);
  shape.lineTo(-0.2, 0.6);
  shape.lineTo(-0.5, 0.85);
  shape.lineTo(-1.0, 0.4);
  shape.closePath();
  const sheet = new THREE.ShapeGeometry(shape, 1);
  const p = sheet.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, 0.06 * Math.sin(p.getX(i) * 3.1) + 0.05 * Math.cos(p.getY(i) * 4.3));
  b.add(sheet, SAIL, [0, 0.09, 0], [-Math.PI / 2, 0, 0], [1, 1, 1], { flatAo: true });
  b.add(sheet.clone(), "#d9cda9", [0, 0.07, 0], [Math.PI / 2, 0, 0], [1, 1, 1], { flatAo: true });
  cylinderBetween(b, [-0.95, 0.12, -0.62], [1.0, 0.12, -0.72], 0.05, "#8a6038", 6);
  return b.build();
}

/** A coil of ship's rope. */
export function ropeCoilGeometry(): THREE.BufferGeometry {
  const b = new PartBuilder(0);
  for (let i = 0; i < 4; i++) b.torus(0.32 - i * 0.025, 0.055, [0, 0.06 + i * 0.09, 0], [Math.PI / 2, 0, i * 0.4], i % 2 ? "#c9a464" : "#d9b779");
  cylinderBetween(b, [0.3, 0.06, 0], [0.75, 0.05, 0.35], 0.05, "#c9a464", 5);
  return b.build();
}

/** The sea chest / storage box: banded planks, iron corners and rope handles. */
export function seaChestGeometry(): THREE.BufferGeometry {
  const b = new PartBuilder(0.3);
  b.box(1.2, 0.62, 0.76, 0, 0, 0, "#6e4a2c");
  b.boxAt(1.24, 0.22, 0.8, [0, 0.72, 0], [0, 0, 0], "#7d5533");
  for (const x of [-0.42, 0.42]) {
    b.boxAt(0.1, 0.86, 0.8, [x, 0.42, 0], [0, 0, 0], IRON);
  }
  b.boxAt(0.18, 0.2, 0.06, [0, 0.62, 0.41], [0, 0, 0], "#c9a24a");
  for (const x of [-0.62, 0.62]) b.torus(0.1, 0.025, [x, 0.42, 0], [0, Math.PI / 2, 0], "#c9a464");
  return b.build();
}

/** A wooden barrel with iron hoops (open at the top: its water shows). */
export function barrelGeometry(): THREE.BufferGeometry {
  const b = new PartBuilder(0.4);
  b.add(new THREE.CylinderGeometry(0.36, 0.33, 0.95, 12, 1, true), "#a8693a", [0, 0.475, 0]);
  b.add(new THREE.CylinderGeometry(0.33, 0.33, 0.04, 12), "#8a5530", [0, 0.06, 0]);
  b.add(new THREE.CylinderGeometry(0.385, 0.385, 0.06, 12, 1, true), IRON, [0, 0.2, 0]);
  b.add(new THREE.CylinderGeometry(0.385, 0.385, 0.06, 12, 1, true), IRON, [0, 0.78, 0]);
  b.add(new THREE.TorusGeometry(0.355, 0.03, 4, 14), "#7a4a24", [0, 0.95, 0], [Math.PI / 2, 0, 0]);
  return b.build();
}

/** A half-buried crate (the cove's crate body; its lid opens). */
export function buriedSandGeometry(): THREE.BufferGeometry {
  const b = new PartBuilder(0);
  b.add(new THREE.CylinderGeometry(0.95, 1.15, 0.3, 10), "#d9c9a1", [0, 0.1, 0]);
  return b.build();
}

/** Small scattered planks and a broken oar in the cove. */
export function coveDebrisGeometry(): THREE.BufferGeometry {
  const b = new PartBuilder(0);
  const rand = makeRng(5);
  for (let i = 0; i < 12; i++) {
    const x = COVE.x - 9 + rand() * 18;
    const z = COVE.z - 6 + rand() * 12;
    b.boxAt(0.9 + rand() * 0.8, 0.06, 0.18, [x, groundY(x, z) + 0.05, z], [0, rand() * 3.1, (rand() - 0.5) * 0.1], i % 2 ? "#9a7048" : "#7a5232");
  }
  return b.build();
}

// ------------------------------------------------------------ bamboo

/** A cluster of three tall culms (a harvestable stalk node), rooted at the origin. */
export function bambooStalkGeometry(): THREE.BufferGeometry {
  const b = new PartBuilder(0.3);
  const culms: Array<[number, number, number, number]> = [[0, 0, 7.4, 0.07], [0.32, 0.18, 6.4, 0.06], [-0.24, 0.26, 5.6, 0.055]];
  culms.forEach(([x, z, h, r], i) => {
    const lean = 0.04 * (i - 1);
    bambooPole(b, [x, 0, z], [x + lean * h, h, z + lean * 0.5 * h], r, 1 - i * 0.04);
    for (let k = 0; k < 3; k++) {
      const t = 0.55 + k * 0.17;
      const y = h * t;
      b.add(new THREE.ConeGeometry(0.42, 0.9, 5), BAMBOO_LEAF, [x + lean * y + 0.2, y, z], [0, k * 2.1, 1.2 + k * 0.3], [1, 1, 0.35]);
      b.add(new THREE.ConeGeometry(0.38, 0.8, 5), "#6a9e3d", [x + lean * y - 0.18, y + 0.25, z + 0.1], [0, k * 2.1 + 1, -1.1], [1, 1, 0.35]);
    }
  });
  return b.build();
}

/** A cut bamboo stalk: three short stumps. */
export function bambooStumpGeometry(): THREE.BufferGeometry {
  const b = new PartBuilder(0);
  for (const [x, z, h] of [[0, 0, 0.5], [0.32, 0.18, 0.42], [-0.24, 0.26, 0.36]] as const) {
    b.cyl(0.07, 0.075, h, x, 0, z, BAMBOO_DARK, 6);
    b.cyl(0.055, 0.055, 0.01, x, h, z, "#e6dfa8", 6);
  }
  return b.build();
}

/** The dense bamboo ring that gives the grove its look (decorative, outside the clearing). */
export function groveDecorGeometry(): THREE.BufferGeometry {
  const b = new PartBuilder(0.4);
  const rand = makeRng(2026);
  for (let i = 0; i < 120; i++) {
    const a = rand() * Math.PI * 2;
    const ring = 1.05 + rand() * 0.55;
    const x = GROVE.x + Math.cos(a) * GROVE.rx * ring;
    const z = GROVE.z + Math.sin(a) * GROVE.rz * ring;
    // Keep the trail's opening clear on the west side.
    if (x < GROVE.x - 6 && Math.abs(z - GROVE_GATE.z) < 3) continue;
    const h = 5 + rand() * 4;
    const y = groundY(x, z);
    const lean = (rand() - 0.5) * 0.12;
    bambooPole(b, [x, y, z], [x + lean * h, y + h, z + lean * h * 0.5], 0.05 + rand() * 0.03, 0.85 + rand() * 0.2);
    b.add(new THREE.ConeGeometry(0.6, 1.4, 5), rand() > 0.5 ? BAMBOO_LEAF : "#5f9339", [x + lean * h, y + h - 0.3, z + lean * h * 0.5], [0, rand() * 3, Math.PI], [1, 1, 0.5]);
  }
  return b.build();
}

/** The thicket closing the trail before Day 7: tightly packed culms, cut and fallen aside after. */
export function thicketGeometry(): { standing: THREE.BufferGeometry; fallen: THREE.BufferGeometry } {
  const standing = new PartBuilder(0.3);
  const fallen = new PartBuilder(0.1);
  const rand = makeRng(17);
  for (let i = 0; i < 22; i++) {
    const dz = -2.2 + rand() * 4.4;
    const dx = -0.8 + rand() * 1.6;
    const h = 4 + rand() * 3.5;
    const lean = (rand() - 0.5) * 0.3;
    bambooPole(standing, [dx, 0, dz], [dx + lean, h, dz + lean * 0.6], 0.05 + rand() * 0.02);
    standing.add(new THREE.ConeGeometry(0.55, 1.2, 5), BAMBOO_LEAF, [dx + lean, h - 0.2, dz], [0, rand() * 3, Math.PI], [1, 1, 0.5]);
    // Fallen culms lie along the trail edges.
    const side = i % 2 ? 1 : -1;
    const len = 2.5 + rand() * 2;
    bambooPole(fallen, [dx, 0.08, side * (1.9 + rand() * 0.6)], [dx + len, 0.1, side * (2.2 + rand() * 1.4)], 0.05);
  }
  for (let i = 0; i < 8; i++) fallen.cyl(0.06, 0.065, 0.35, -0.6 + (i % 4) * 0.4, 0, -1.2 + Math.floor(i / 4) * 2.2, BAMBOO_DARK, 6);
  return { standing: standing.build(), fallen: fallen.build() };
}

/** One bamboo pole lying flat (the bundle on the player's shoulder is made of these). */
export function poleBundleGeometry(count: number): THREE.BufferGeometry {
  const b = new PartBuilder(0);
  const n = Math.max(1, Math.min(6, count));
  for (let i = 0; i < n; i++) {
    const r = Math.floor(i / 3);
    const c = i % 3;
    bambooPole(b, [-1.05, r * 0.08, (c - 1) * 0.08], [1.05, r * 0.08, (c - 1) * 0.08], 0.035);
  }
  return b.build();
}
