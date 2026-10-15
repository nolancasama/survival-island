import * as THREE from "three";
import { groundY } from "../../game/world/island";
import { CLIFF_PATH, CLIFF_PATH_R, CLIFFTOP, nearestOnSegment } from "../../game/world/phase3";
import { makeRng } from "../../game/logic/rng";

const grass = new THREE.Color("#4f8f45");
const forest = new THREE.Color("#3f7a3a");
const dirt = new THREE.Color("#b39464");
const stone = new THREE.Color("#9d9d8e");
const forestPath = new THREE.Color("#78985b");

function trailAt(x: number, z: number) {
  let nearest = { d: Infinity, t: 0, segment: 0 };
  for (let i = 1; i < CLIFF_PATH.length; i++) {
    const p = nearestOnSegment(x, z, CLIFF_PATH[i - 1], CLIFF_PATH[i]);
    if (p.d < nearest.d) nearest = { d: p.d, t: p.t, segment: i };
  }
  return nearest;
}

/** The ribbon shares the hillside's vertices: no boxes, seams, or floating edges.
 * Extra tessellation near the trail carries groundY through the switchback. */
export function cliffTerrainGeometry(): THREE.BufferGeometry {
  const xs: number[] = [];
  for (let x = -80; x <= 80; x += x >= -2.5 && x < 37.5 ? 0.625 : 1.25) xs.push(x);
  const zs: number[] = [];
  for (let z = -95; z <= -41; z += 0.5) zs.push(z);
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const c = new THREE.Color();
  for (const z of zs) for (const x of xs) {
    // Match the coarse southern terrain edge exactly at the join.
    const x0 = Math.floor(x / 1.25) * 1.25;
    const edgeY = THREE.MathUtils.lerp(groundY(x0, -41), groundY(x0 + 1.25, -41), (x - x0) / 1.25);
    const y = z === -41 ? edgeY : groundY(x, z);
    positions.push(x, y, z);
    const p = trailAt(x, z);
    const variation = Math.sin(x * 0.43 + z * 0.27) * Math.cos(z * 0.36 - x * 0.21);
    c.copy(forest).lerp(grass, 0.65 + variation * 0.22);
    const plateauD = Math.hypot(x - CLIFFTOP.x, z - CLIFFTOP.z);
    // The existing sandy clearing and its low rock rim remain the destination.
    c.lerp(dirt, 1 - THREE.MathUtils.smoothstep(plateauD, CLIFFTOP.r - 0.65, CLIFFTOP.r + 0.65));
    const width = CLIFF_PATH_R * 0.69 + Math.sin(z * 1.7 + x) * 0.1;
    const trail = 1 - THREE.MathUtils.smoothstep(p.d, width - 0.35, width + 0.55);
    c.lerp(dirt, trail);
    // Feather into the existing forest trail at the southern terrain join.
    const approach = nearestOnSegment(x, z, { x: 5, z: -34 }, { x: 7.2, z: -42.2 });
    const edge = forest.clone().lerp(forestPath, 1 - THREE.MathUtils.smoothstep(approach.d, 1.25, 2.8));
    c.lerp(edge, 1 - THREE.MathUtils.smoothstep(-z, 41, 43));
    // Inset stone treads on the steep final ascent only; same surface, never airborne.
    if (p.segment === 4 && p.t > 0.12 && p.t < 0.85 && p.d < width - 0.15) {
      const along = p.t * 10;
      const tread = 1 - THREE.MathUtils.smoothstep(Math.abs((along + x * 0.025) % 1.9 - 0.95), 0.3, 0.6);
      c.lerp(stone, tread * trail * 0.85);
    }
    c.multiplyScalar(0.97 + variation * 0.035);
    colors.push(c.r, c.g, c.b);
  }
  const row = xs.length;
  for (let j = 0; j < zs.length - 1; j++) for (let i = 0; i < row - 1; i++) {
    const a = j * row + i;
    indices.push(a, a + row, a + 1, a + 1, a + row, a + row + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

export interface CliffSpot { x: number; z: number; s: number; r: number }

/** Sparse clusters flank the route; the plateau and its southern vista stay clear. */
export function cliffDressingSpots(): { rocks: CliffSpot[]; bushes: CliffSpot[]; trees: CliffSpot[] } {
  const rand = makeRng(715);
  const rocks: CliffSpot[] = [];
  const bushes: CliffSpot[] = [];
  const trees: CliffSpot[] = [];
  for (let i = 0; i < 250; i++) {
    const x = -12 + rand() * 58;
    const z = -45 - rand() * 43;
    const p = trailAt(x, z);
    const plateauD = Math.hypot(x - CLIFFTOP.x, z - CLIFFTOP.z);
    if (p.d < CLIFF_PATH_R + 1.25 || plateauD < CLIFFTOP.r + 1.8) continue;
    const spot = { x, z, s: 0.65 + rand() * 0.7, r: rand() * Math.PI * 2 };
    if (i % 4 === 0) rocks.push({ ...spot, s: spot.s * 1.7 });
    else if (i % 13 === 0 && p.d < 9 && z > -72) trees.push({ ...spot, s: spot.s * 0.65 });
    else if (i % 2 === 0) bushes.push(spot);
  }
  return { rocks, bushes, trees };
}
