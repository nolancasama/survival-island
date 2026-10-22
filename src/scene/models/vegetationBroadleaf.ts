import * as THREE from "three";
import { VEGETATION_PALETTE } from "./nature";

type V3 = [number, number, number];
type Clump = [x: number, y: number, z: number, radius: number, height: number];
type TreeArchetype = {
  name: string;
  height: number;
  trunkRadius: number;
  lean: V3;
  branchCount: number;
  clumps: Clump[];
};

/**
 * Dimensions are metres at scale 1. Crowns use overlapping 48-triangle lobes,
 * with rounded domes and gently flattened undersides. All archetypes stay within
 * a 2.3 m crown radius and above 1.9 m, leaving room for the baked mild stretch.
 * Branches terminate inside their assigned lobe; variant changes are small,
 * deterministic phase/shape changes, independent of the placement RNG.
 */
export const JUNGLE_ARCHETYPES: readonly TreeArchetype[] = [
  {
    name: "elevated broad crown", height: 4.5, trunkRadius: 0.29,
    lean: [0.12, 0, -0.06], branchCount: 4,
    clumps: [[0, 4.8, 0, 1.45, 1.35], [-0.94, 4.25, 0.17, 1.2, 1.12], [0.87, 4.45, 0.38, 1.2, 1.2], [0.05, 4.3, -0.9, 1.15, 1.08], [-0.1, 5.35, -0.05, 0.9, 0.95]]
  },
  {
    name: "asymmetric spreading crown", height: 2.95, trunkRadius: 0.3,
    lean: [-0.45, 0, 0.13], branchCount: 4,
    clumps: [[-0.65, 3.45, 0.13, 1.3, 1.15], [0.48, 2.95, 0.33, 0.9, 0.9], [-1.15, 3.85, -0.37, 1.1, 1.05], [-0.55, 4.15, -0.35, 1.05, 1.0], [-0.65, 3.05, 0.86, 1.0, 0.98]]
  },
  {
    name: "dense rounded crown", height: 2.8, trunkRadius: 0.31,
    lean: [0.04, 0, 0.06], branchCount: 3,
    clumps: [[0, 3.25, 0, 1.5, 1.38], [-0.78, 2.85, 0.1, 1.12, 1.08], [0.73, 2.9, 0.49, 1.12, 1.1], [0.24, 2.9, -0.78, 1.1, 1.08], [-0.12, 3.85, -0.1, 1.0, 1.02]]
  },
  {
    name: "slender branching tree", height: 5.25, trunkRadius: 0.23,
    lean: [0.19, 0, 0.06], branchCount: 3,
    clumps: [[0.13, 5.5, -0.08, 0.82, 0.82], [-0.5, 2.65, 0.12, 0.7, 0.72], [0.5, 4.05, 0.2, 0.73, 0.74]]
  },
  {
    name: "wide two-tier crown", height: 4.65, trunkRadius: 0.28,
    lean: [-0.08, 0, -0.08], branchCount: 5,
    clumps: [[-0.9, 2.95, 0.22, 1.18, 0.98], [0.88, 3.08, 0.26, 1.18, 1.0], [0.08, 3.0, -0.94, 1.12, 0.96], [0.35, 4.95, -0.08, 1.25, 1.0], [-0.58, 5.12, 0.11, 1.0, 0.94]]
  }
];

/** Minimal flat-shaded, vertex-coloured builder. No material or mesh per part. */
class VegetationBuilder {
  private positions: number[] = [];
  private colors: number[] = [];

  triangle(a: V3, b: V3, c: V3, ca: THREE.Color, cb = ca, cc = ca) {
    this.positions.push(...a, ...b, ...c);
    this.colors.push(ca.r, ca.g, ca.b, cb.r, cb.g, cb.b, cc.r, cc.g, cc.b);
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.positions, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(this.colors, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(this.positions.length / 3 * 2), 2));
    g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
  }
}

function noise(seed: number): number {
  const n = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return n - Math.floor(n);
}

/** Open tapered tube; ends are buried inside a trunk, crown, or the ground. */
function wood(b: VegetationBuilder, points: V3[], radii: number[], sides = 7, capTop = false) {
  const palette = VEGETATION_PALETTE.trunk;
  const rings = points.map((p, j) => {
    const tangent = new THREE.Vector3(...points[Math.min(j + 1, points.length - 1)])
      .sub(new THREE.Vector3(...points[Math.max(0, j - 1)])).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent);
    return Array.from({ length: sides }, (_, i): V3 => {
      const a = i / sides * Math.PI * 2;
      const v = new THREE.Vector3(Math.cos(a) * radii[j], 0, Math.sin(a) * radii[j]).applyQuaternion(q);
      return [p[0] + v.x, p[1] + v.y, p[2] + v.z];
    });
  });
  for (let j = 0; j < rings.length - 1; j++) {
    for (let i = 0; i < sides; i++) {
      const next = (i + 1) % sides;
      const c = new THREE.Color(i % 3 === 0 ? palette.light : i % 3 === 1 ? palette.mid : palette.dark);
      b.triangle(rings[j][i], rings[j + 1][i], rings[j][next], c);
      b.triangle(rings[j][next], rings[j + 1][i], rings[j + 1][next], c);
    }
  }
  if (capTop) {
    const ring = rings[rings.length - 1];
    const center = points[points.length - 1];
    for (let i = 0; i < sides; i++) b.triangle(center, ring[(i + 1) % sides], ring[i], new THREE.Color(palette.cut));
  }
}

/** Broad, scalloped lobe: 8 sides, three shoulder rings, 48 triangles. */
function foliage(b: VegetationBuilder, clump: Clump, seed: number, bright = false, groundCover = false) {
  const [x, y, z, r, h] = clump;
  const palette = VEGETATION_PALETTE.foliage;
  // Resource trees keep a light underside too; forest shade stays cool green.
  const hue = (noise(seed + 61) - 0.5) * 0.025;
  const tint = (color: string) => new THREE.Color(color).offsetHSL(hue, 0, 0);
  const dark = tint(bright ? "#80bf60" : palette.dark);
  const mid = tint(bright ? "#9bd363" : palette.mid);
  const top = tint(bright ? "#b7df79" : palette.light);
  const highlight = tint(bright ? "#c4e88a" : palette.highlight);
  const phase = noise(seed + 3) * Math.PI * 2;
  const profile = groundCover ? [[0.52, 0.64], [0.06, 1], [-0.31, 0.8]] : [[0.65, 0.68], [0, 1], [-0.5, 0.72]];
  const rings = profile.map(([height, width], layer) =>
    Array.from({ length: 8 }, (_, i): V3 => {
      const a = i / 8 * Math.PI * 2 + phase;
      const swell = 0.94 + noise(seed + i * 7) * 0.1;
      let px = x + Math.cos(a) * r * width * swell;
      let pz = z + Math.sin(a) * r * width * swell * (0.88 + noise(seed + 5) * 0.1);
      if (!groundCover) {
        const radial = Math.hypot(px, pz);
        if (radial > 2.3) { px *= 2.3 / radial; pz *= 2.3 / radial; }
      }
      return [px, y + height * h + (noise(seed + i * 11 + layer * 17) - 0.5) * h * 0.12, pz];
    })
  );
  const apex: V3 = [x + r * 0.07, y + h * (groundCover ? 0.86 : 1), z - r * 0.08];
  const base: V3 = [x, y - h * (groundCover ? 0.4 : 0.68), z];
  for (let i = 0; i < 8; i++) {
    const n = (i + 1) % 8;
    b.triangle(apex, rings[0][n], rings[0][i], highlight, top, top);
    b.triangle(rings[0][i], rings[0][n], rings[1][i], top, top, mid);
    b.triangle(rings[0][n], rings[1][n], rings[1][i], top, mid, mid);
    b.triangle(rings[1][i], rings[1][n], rings[2][i], mid, mid, dark);
    b.triangle(rings[1][n], rings[2][n], rings[2][i], mid, dark, dark);
    b.triangle(base, rings[2][i], rings[2][n], dark);
  }
}

export function jungleTreeGeometry(archetype = 0, variant = 0): THREE.BufferGeometry {
  const spec = JUNGLE_ARCHETYPES[((archetype % JUNGLE_ARCHETYPES.length) + JUNGLE_ARCHETYPES.length) % JUNGLE_ARCHETYPES.length];
  const b = new VegetationBuilder();
  const seed = archetype * 41 + variant * 137 + 19;
  const phase = (variant % 3 - 1) * 0.12;
  const [lx, , lz] = spec.lean;
  const crown: V3 = [lx, spec.height, lz];
  wood(b, [[0, 0, 0], [lx * 0.2, 0.35, lz * 0.2], [lx * 0.5, spec.height * 0.58, lz * 0.5], crown], [spec.trunkRadius * 1.22, spec.trunkRadius, spec.trunkRadius * 0.73, 0.095]);
  for (let i = 0; i < 3; i++) {
    const a = i * Math.PI * 2 / 3 + phase;
    wood(b, [[Math.cos(a) * 0.49, 0.015, Math.sin(a) * 0.49], [0, 0.43, 0]], [0.035, spec.trunkRadius * 0.54], 4);
  }
  const clumps = spec.clumps.map(([x, y, z, r, h], i): Clump => [
    x * Math.cos(phase) - z * Math.sin(phase), y + (noise(seed + i) - 0.5) * 0.12,
    x * Math.sin(phase) + z * Math.cos(phase), r * (0.97 + noise(seed + i * 5) * 0.05), h
  ]);
  for (let i = 0; i < spec.branchCount; i++) {
    const c = clumps[(i + 1) % clumps.length];
    const start: V3 = [lx * 0.5, Math.min(spec.height * 0.7 + i * 0.12, c[1] - c[4] * 0.8), lz * 0.5];
    const end: V3 = [c[0], c[1] - c[4] * 0.04, c[2]];
    const elbow: V3 = [end[0] * 0.65, start[1] + (end[1] - start[1]) * 0.45, end[2] * 0.65];
    wood(b, [start, elbow, end], [0.12 - i * 0.009, 0.077, 0.035], 5);
  }
  clumps.forEach((c, i) => foliage(b, c, seed + i * 23));
  return b.build();
}

/** Low dark layered undergrowth. Three variants; 212 triangles each. */
export function bushGeometry(variant = 0): THREE.BufferGeometry {
  const b = new VegetationBuilder();
  const phase = variant * 0.87;
  const clumps: Clump[] = [[0, 0.43, 0, 0.74, 0.5], [-0.48, 0.3, 0.1, 0.56, 0.34], [0.42, 0.32, 0.2, 0.58, 0.38], [0.1, 0.4, -0.43, 0.51, 0.4]];
  clumps.forEach(([x, y, z, r, h], i) => foliage(b, [x * Math.cos(phase) - z * Math.sin(phase), y * (1 + variant * 0.025), x * Math.sin(phase) + z * Math.cos(phase), r, h], variant * 71 + i * 19, false, true));
  wood(b, [[0, 0.02, 0], [-0.23, 0.34, 0.05], [0.2, 0.49, -0.03]], [0.08, 0.05, 0.015], 5);
  return b.build();
}

/** Broad pointed leaves, raised midribs and explicitly reversed back faces. */
function broadLeaf(b: VegetationBuilder, angle: number, radius: number, tipY: number, width: number, young: boolean) {
  const palette = VEGETATION_PALETTE.leafBush;
  const edgeColor = new THREE.Color(young ? palette.mid : palette.dark);
  const ridgeColor = new THREE.Color(young ? palette.light : palette.mid);
  const side = new THREE.Vector3(-Math.sin(angle), 0, Math.cos(angle));
  const rootY = young ? 0.18 : 0.11;
  const rows = [0, 0.38, 0.72, 1].map((t, i) => {
    const spread = [0, 1, 0.82, 0][i] * width;
    const y = rootY + (tipY - rootY) * t + Math.sin(t * Math.PI) * 0.22;
    const center: V3 = [Math.cos(angle) * radius * t, y + Math.sin(t * Math.PI) * 0.045, Math.sin(angle) * radius * t];
    const left: V3 = [center[0] + side.x * spread, y - spread * 0.14, center[2] + side.z * spread];
    const right: V3 = [center[0] - side.x * spread, y + spread * 0.07, center[2] - side.z * spread];
    return { center, left, right };
  });
  for (let i = 0; i < rows.length - 1; i++) {
    const a = rows[i]; const c = rows[i + 1];
    // At the root/tip the collapsed triangles are omitted: 16 triangles per leaf.
    const face = (p: V3, q: V3, r: V3, cp: THREE.Color, cq: THREE.Color, cr: THREE.Color) => {
      b.triangle(p, q, r, cp, cq, cr);
      // Reversed winding gives the back its own opposite normal. Light green
      // backs compensate for the reduced direct light under the broad blades.
      const back = new THREE.Color(palette.light);
      b.triangle(r, q, p, cr.clone().lerp(back, 0.35), cq.clone().lerp(back, 0.35), cp.clone().lerp(back, 0.35));
    };
    if (i !== 0) {
      face(a.center, a.left, c.center, ridgeColor, edgeColor, ridgeColor);
      face(a.right, a.center, c.center, edgeColor, ridgeColor, ridgeColor);
    }
    if (i !== rows.length - 2) {
      face(a.left, c.left, c.center, edgeColor, edgeColor, ridgeColor);
      face(c.center, c.right, a.right, ridgeColor, edgeColor, edgeColor);
    }
  }
}

/** Harvestable rosette: 13 yellow-green blades, ~0.9 m radius and 1.1 m tall. */
export function leafBushGeometry(): THREE.BufferGeometry {
  const b = new VegetationBuilder();
  for (let i = 0; i < 6; i++) broadLeaf(b, i * Math.PI / 3 + 0.16, 0.88 + noise(i) * 0.07, 0.48 + noise(i + 9) * 0.14, 0.54, false);
  for (let i = 0; i < 4; i++) broadLeaf(b, i * Math.PI / 2 + 0.7, 0.66, 0.8 + noise(i + 25) * 0.1, 0.54, true);
  for (let i = 0; i < 3; i++) broadLeaf(b, i * Math.PI * 2 / 3 + 0.25, 0.36, 1.04 + noise(i + 41) * 0.055, 0.5, true);
  return b.build();
}

/** Friendly round resource crown; base radius .28 m, crown centred at 3.4 m. */
export function choppableTreeGeometry(): THREE.BufferGeometry {
  const b = new VegetationBuilder();
  wood(b, [[0, 0, 0], [0, 0.35, 0], [0, 2.28, 0], [0, 3.27, 0]], [0.28, 0.245, 0.16, 0.085]);
  const clumps: Clump[] = [[0, 3.4, 0, 1.26, 1.18], [-0.5, 3.27, 0.02, 0.85, 0.85], [0.5, 3.35, 0.19, 0.85, 0.87], [0.09, 3.35, -0.48, 0.82, 0.84], [-0.05, 3.8, -0.01, 0.8, 0.76]];
  for (let i = 1; i < 4; i++) {
    const [x, y, z] = clumps[i];
    wood(b, [[-0.025, 2.07 + i * 0.09, 0], [x * 0.6, 2.56, z * 0.6], [x, y, z]], [0.105, 0.07, 0.03], 5);
  }
  clumps.forEach((c, i) => foliage(b, c, 171 + i * 11, true));
  return b.build();
}

export function stumpGeometry(): THREE.BufferGeometry {
  const b = new VegetationBuilder();
  wood(b, [[0, 0, 0], [0, 0.38, 0], [0, 0.44, 0]], [0.3, 0.23, 0.225], 7, true);
  wood(b, [[0.08, 0.08, 0], [0.58, 0.03, 0.28]], [0.08, 0.03], 5);
  wood(b, [[-0.08, 0.08, 0], [-0.48, 0.03, -0.35]], [0.08, 0.03], 5);
  return b.build();
}
