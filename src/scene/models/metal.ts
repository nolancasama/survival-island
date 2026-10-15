import * as THREE from "three";
import { PartBuilder } from "../partBuilder";

/** Salvaged plate, broken pipe and wheel rim: three recognisable ship parts. */
export function metalGeometry(shape: number): THREE.BufferGeometry {
  const b = new PartBuilder(0.12);
  const steel = "#a5b6bd";
  const rust = "#946448";
  if (shape === 0) {
    b.boxAt(0.75, 0.07, 0.7, [-0.23, 0.13, 0], [0, 0.1, -0.15], steel);
    b.boxAt(0.45, 0.07, 0.7, [0.32, 0.26, 0], [0, 0.1, 0.65], "#83999f");
    for (const z of [-0.25, 0.25]) b.sphere(0.04, -0.45, 0.23, z, rust, [1, 0.4, 1], 6);
    b.boxAt(0.2, 0.012, 0.32, [-0.17, 0.18, 0.1], [0, 0.1, -0.15], rust);
  } else if (shape === 1) {
    b.add(new THREE.CylinderGeometry(0.19, 0.19, 1.15, 10, 1, true), steel, [0, 0.21, 0], [0, 0, Math.PI / 2]);
    for (const x of [-0.57, 0.57]) b.torus(0.19, 0.04, [x, 0.21, 0], [0, Math.PI / 2, 0], rust);
    b.cylAt(0.22, 0.09, [0.25, 0.21, 0], [0, 0, Math.PI / 2], "#7a8c91", 10);
  } else {
    b.torus(0.45, 0.065, [0, 0.15, 0], [Math.PI / 2 - 0.2, 0, 0], steel);
    b.torus(0.37, 0.035, [0, 0.15, 0], [Math.PI / 2 - 0.2, 0, 0], rust);
    b.cyl(0.12, 0.13, 0.18, 0, 0.1, 0, "#83979e", 10);
    for (let i = 0; i < 5; i++) {
      const a = i / 5 * Math.PI * 2;
      b.boxAt(0.76, 0.035, 0.045, [0, 0.16, 0], [0, a, 0], steel);
    }
  }
  return b.build();
}
