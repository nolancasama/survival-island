import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Palm } from "../../game/world/island";
import { groundY } from "../../game/world/island";
import { VEGETATION_PALETTE } from "./nature";

type V3 = [number, number, number];

/** These crown proportions vary silhouettes without moving gameplay's trunk or crown anchors. */
const CROWNS = [
  { name: "tall elegant", fronds: 10, length: 3.05, rise: 0.86, droop: 0.86, spread: 0.66, wind: 0 },
  { name: "short full", fronds: 11, length: 2.7, rise: 0.8, droop: 1.02, spread: 0.72, wind: 0 },
  { name: "leaning beach", fronds: 10, length: 3.25, rise: 0.64, droop: 1.08, spread: 0.65, wind: 0.2 },
  { name: "windswept", fronds: 11, length: 3.05, rise: 0.72, droop: 0.94, spread: 0.7, wind: 0.72 }
] as const;

/** A small non-indexed, vertex-coloured triangle writer; back faces need no second material. */
class PalmSurface {
  private positions: number[] = [];
  private colors: number[] = [];

  triangle(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, color: THREE.Color) {
    for (const p of [a, b, c]) {
      this.positions.push(p.x, p.y, p.z);
      this.colors.push(color.r, color.g, color.b);
    }
  }

  leaf(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, top: THREE.Color, underside: THREE.Color) {
    this.triangle(a, b, c, top);
    // Separate reversed vertices let computeVertexNormals produce opposing back normals.
    this.triangle(c, b, a, underside);
  }

  build() {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(this.colors, 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(this.positions.length / 3 * 2), 2));
    geometry.computeVertexNormals();
    return geometry;
  }
}

/** Exact original curve: coconut nodes and other gameplay consumers share these anchors. */
export function palmAt(palm: Palm, t: number): V3 {
  const base = groundY(palm.x, palm.z) - 0.1;
  const off = palm.lean * palm.height * Math.pow(t, 1.7);
  return [palm.x + Math.sin(palm.dir) * off, base + palm.height * t, palm.z + Math.cos(palm.dir) * off];
}

function coloredIcosahedron(radius: number, color: string, scale: V3, position: V3) {
  const geometry = new THREE.IcosahedronGeometry(radius, 0);
  geometry.scale(...scale);
  geometry.translate(...position);
  const p = geometry.getAttribute("position");
  const base = new THREE.Color(color);
  const colors = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const shade = 0.88 + 0.12 * THREE.MathUtils.clamp((p.getY(i) - position[1]) / radius + 0.5, 0, 1);
    colors[i * 3] = base.r * shade;
    colors[i * 3 + 1] = base.g * shade;
    colors[i * 3 + 2] = base.b * shade;
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(p.count * 2), 2));
  return geometry;
}

/**
 * Ten/eleven feather fronds: eight broad spine strips and nine overlapping leaflet pairs.
 * Each wide pointed blade folds across its ridge, with a bright green reverse face.
 * 1,060–1,164 crown triangles including the hub; all crowns share the fade material.
 * Call once for a scenery build, reuse these four prototypes, then dispose them.
 */
export function createPalmCrowns(): THREE.BufferGeometry[] {
  return CROWNS.map((spec) => {
    const surface = new PalmSurface();
    const palette = VEGETATION_PALETTE.palm;
    for (let i = 0; i < spec.fronds; i++) {
      const angle = i / spec.fronds * Math.PI * 2 + Math.sin(i * 4.31) * 0.12;
      const radial = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
      const sideways = new THREE.Vector3(-Math.sin(angle), 0, Math.cos(angle));
      const age = i % 3;
      const length = spec.length * (age === 0 ? 0.84 : 1) * (0.96 + 0.05 * Math.sin(i * 2.6));
      const rise = spec.rise + (age === 0 ? 0.38 : age === 2 ? -0.12 : 0);
      const droop = spec.droop * (age === 0 ? 0.64 : age === 2 ? 1.12 : 1);
      const top = new THREE.Color(age === 0 ? palette.light : age === 1 ? palette.mid : palette.dark);
      const underside = new THREE.Color(palette.mid).lerp(new THREE.Color(palette.light), 0.35);
      const at = (t: number) => radial.clone().multiplyScalar(length * t)
        .addScaledVector(sideways, Math.sin(t * Math.PI) * Math.sin(i * 1.9) * 0.12)
        .add(new THREE.Vector3(spec.wind * t * t, 0.08 + Math.sin(t * Math.PI) * rise - droop * t * t, 0));
      const across = (t: number) => sideways.clone().multiplyScalar(0.11 * (1 - t) + 0.015)
        .add(new THREE.Vector3(0, Math.sin(t * Math.PI + i) * 0.025, 0));
      for (let j = 0; j < 8; j++) {
        const t0 = j / 8;
        const t1 = (j + 1) / 8;
        const a = at(t0).sub(across(t0));
        const b = at(t0).add(across(t0));
        const c = at(t1).add(across(t1));
        const d = at(t1).sub(across(t1));
        surface.leaf(a, b, c, top, underside);
        surface.leaf(a, c, d, top, underside);
      }
      for (let j = 0; j < 9; j++) {
        const t = 0.08 + j * 0.1;
        // Short basal and terminal blades give the frond its tapered feather outline.
        const bladeLength = spec.spread * (0.32 + Math.pow(Math.sin(t * Math.PI), 0.8) * 0.9);
        for (const side of [-1, 1]) {
          const root = at(t);
          const tip = root.clone().addScaledVector(sideways, side * bladeLength)
            .addScaledVector(radial, bladeLength * (0.3 + t * 0.25));
          tip.y -= 0.12 + t * 0.14 + (age === 2 ? 0.06 : 0);
          const middle = root.clone().lerp(tip, 0.48);
          const bladeAxis = tip.clone().sub(root).normalize();
          const breadth = new THREE.Vector3(-bladeAxis.z, 0, bladeAxis.x).multiplyScalar(0.155 + bladeLength * 0.085);
          const left = middle.clone().add(breadth);
          const right = middle.clone().sub(breadth);
          left.y -= 0.025;
          right.y -= 0.025;
          surface.leaf(root, left, tip, top, underside);
          surface.leaf(root, tip, right, top.clone().multiplyScalar(0.94), underside);
        }
      }
    }
    const feathers = surface.build();
    const hub = coloredIcosahedron(0.36, VEGETATION_PALETTE.palm.dark, [1, 0.7, 1], [0, 0.08, 0]);
    const geometry = mergeGeometries([feathers, hub], false)!;
    feathers.dispose();
    hub.dispose();
    geometry.computeBoundingSphere();
    return geometry;
  });
}

/** Continuous tapered sweep, ten rings × eight sides: 160 triangles including caps. */
function palmTrunk(palm: Palm) {
  const surface = new PalmSurface();
  const rings: THREE.Vector3[][] = [];
  const ringCount = 10;
  const sides = 8;
  for (let i = 0; i < ringCount; i++) {
    const t = i / (ringCount - 1);
    const center = new THREE.Vector3(...palmAt(palm, t));
    const tangent = new THREE.Vector3(...palmAt(palm, Math.min(1, t + 0.001)))
      .sub(new THREE.Vector3(...palmAt(palm, Math.max(0, t - 0.001)))).normalize();
    const right = new THREE.Vector3(1, 0, 0).addScaledVector(tangent, -tangent.x).normalize();
    const forward = new THREE.Vector3().crossVectors(tangent, right).normalize();
    const radius = 0.27 - t * 0.1 + (i > 0 && i < ringCount - 1 && i % 2 ? 0.012 : 0);
    rings.push(Array.from({ length: sides }, (_, j) => center.clone()
      .addScaledVector(right, Math.cos(j / sides * Math.PI * 2) * radius)
      .addScaledVector(forward, Math.sin(j / sides * Math.PI * 2) * radius)));
  }
  const browns = [VEGETATION_PALETTE.trunk.mid, VEGETATION_PALETTE.trunk.light];
  for (let i = 0; i < ringCount - 1; i++) {
    const color = new THREE.Color(browns[i % 2]).lerp(new THREE.Color(VEGETATION_PALETTE.trunk.mid), 0.65);
    for (let j = 0; j < sides; j++) {
      const next = (j + 1) % sides;
      const shade = color.clone().multiplyScalar(0.92 + Math.sin(j * 1.8) * 0.04);
      surface.triangle(rings[i][j], rings[i][next], rings[i + 1][next], shade);
      surface.triangle(rings[i][j], rings[i + 1][next], rings[i + 1][j], shade);
    }
  }
  const cap = new THREE.Color(VEGETATION_PALETTE.trunk.mid);
  for (let j = 0; j < sides; j++) {
    const next = (j + 1) % sides;
    surface.triangle(new THREE.Vector3(...palmAt(palm, 0)), rings[0][next], rings[0][j], cap);
    surface.triangle(new THREE.Vector3(...palmAt(palm, 1)), rings[ringCount - 1][j], rings[ringCount - 1][next], cap);
  }
  return surface.build();
}

/** World-space palm; silhouette index is deterministic and never consumes the placement RNG. */
export function palmGeometry(palm: Palm, silhouette: number, crown?: THREE.BufferGeometry): THREE.BufferGeometry {
  const ownCrowns = crown ? undefined : createPalmCrowns();
  const top = palmAt(palm, 1);
  const crownGeometry = (crown ?? ownCrowns![((silhouette % 4) + 4) % 4]).clone();
  crownGeometry.rotateY(palm.dir);
  crownGeometry.translate(...top);
  const parts = [palmTrunk(palm), crownGeometry];
  if (palm.coconuts) {
    for (let k = 0; k < 3; k++) {
      const angle = k * 2.1 + palm.dir;
      parts.push(coloredIcosahedron(0.18, VEGETATION_PALETTE.trunk.dark, [1, 1.12, 1],
        [top[0] + Math.cos(angle) * 0.26, top[1] - 0.22, top[2] + Math.sin(angle) * 0.26]));
    }
  }
  const geometry = mergeGeometries(parts, false)!;
  parts.forEach((part) => part.dispose());
  ownCrowns?.forEach((prototype) => prototype.dispose());
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

/** Existing callers can still request a single merged palm geometry. */
export function palmsGeometry(palms: Palm[], _seed = 7): THREE.BufferGeometry {
  if (!palms.length) return new THREE.BufferGeometry();
  const crowns = createPalmCrowns();
  const parts = palms.map((palm, i) => palmGeometry(palm, i % crowns.length, crowns[i % crowns.length]));
  const geometry = mergeGeometries(parts, false)!;
  parts.forEach((part) => part.dispose());
  crowns.forEach((prototype) => prototype.dispose());
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
