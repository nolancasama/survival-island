import * as THREE from "three";
import { BRIDGE } from "../../game/world/island";
import { BRIDGE_BASE_Y, BRIDGE_SURFACE, walkingSurfaceY } from "../../game/world/surface";
import { PartBuilder } from "../partBuilder";

/** Low wooden bank approaches share the existing rail mesh and draw call. */
export function bridgeApproachGeometry(): THREE.BufferGeometry {
  const b = new PartBuilder(0);
  const rows = 7;
  const step = (BRIDGE_SURFACE.approachEnd - BRIDGE_SURFACE.halfLength) / rows;
  for (const side of [-1, 1]) {
    for (let row = 0; row < rows; row++) {
      const x0 = side * (BRIDGE_SURFACE.halfLength + row * step);
      const x1 = side * (BRIDGE_SURFACE.halfLength + (row + 1) * step);
      const vertices: number[] = [];
      const top = (x: number, z: number) => [x, walkingSurfaceY(BRIDGE.x + x, BRIDGE.z + z, true) - BRIDGE_BASE_Y, z];
      const a = top(x0, -BRIDGE_SURFACE.halfWidth);
      const c = top(x1, BRIDGE_SURFACE.halfWidth);
      const d = top(x0, BRIDGE_SURFACE.halfWidth);
      const e = top(x1, -BRIDGE_SURFACE.halfWidth);
      // Ensure both banks have upward-facing tops, plus economical dark edges.
      const corners = side > 0 ? [a, d, c, e] : [e, c, d, a];
      const triangle = (...points: number[][]) => points.forEach((p) => vertices.push(...p));
      triangle(corners[0], corners[1], corners[2]);
      triangle(corners[0], corners[2], corners[3]);
      for (let i = 0; i < 4; i++) {
        const p = corners[i];
        const q = corners[(i + 1) % 4];
        const lowP = [p[0], p[1] - 0.09, p[2]];
        const lowQ = [q[0], q[1] - 0.09, q[2]];
        triangle(p, lowP, lowQ, p, lowQ, q);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
      geo.computeVertexNormals();
      b.add(geo, row % 2 ? "#ad7b45" : "#bd8950", [0, 0, 0], [0, 0, 0], [1, 1, 1], { flatAo: true });
    }
  }
  return b.build();
}
