import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { shelterRoofGeometry } from "../Buildings";
import { wreckGeometry } from "./props";

const triangles = (g: THREE.BufferGeometry) => (g.index?.count ?? g.getAttribute("position").count) / 3;

describe("polished scenery geometry", () => {
  it("keeps both detailed models merged and inside their scenery budgets", () => {
    const wreck = wreckGeometry();
    const roof = shelterRoofGeometry();
    expect(triangles(wreck)).toBeLessThanOrEqual(1500);
    expect(triangles(roof)).toBeLessThanOrEqual(1000);
    for (const g of [wreck, roof]) {
      expect(g.groups).toHaveLength(0);
      const p = g.getAttribute("position");
      expect(g.getAttribute("color").count).toBe(p.count);
      for (const value of p.array) expect(Number.isFinite(value)).toBe(true);
      g.computeBoundingBox();
    }
    expect(wreck.boundingBox!.min.x).toBeGreaterThanOrEqual(-5.2);
    expect(wreck.boundingBox!.max.x).toBeLessThanOrEqual(5.3);
    expect(wreck.boundingBox!.max.z).toBeLessThanOrEqual(2.35);
    expect(wreck.boundingBox!.max.y).toBeLessThanOrEqual(5.5);
    expect(roof.boundingBox!.max.x).toBeLessThanOrEqual(1.65);
    expect(roof.boundingBox!.max.z).toBeLessThanOrEqual(1.65);
    wreck.dispose();
    roof.dispose();
  });

  it("covers both roof slopes and the complete ridge without light leaks", () => {
    const g = shelterRoofGeometry();
    const mat = new THREE.MeshBasicMaterial();
    const mesh = new THREE.Mesh(g, mat);
    mesh.updateMatrixWorld(true);
    const ray = new THREE.Raycaster();
    for (const x of [-1.4, -0.7, -0.02, 0, 0.02, 0.7, 1.4]) {
      for (const z of [-1.48, -0.75, 0, 0.75, 1.48]) {
        ray.set(new THREE.Vector3(x, 4, z), new THREE.Vector3(0, -1, 0));
        const hit = ray.intersectObject(mesh)[0];
        expect(hit, `roof at x=${x}, z=${z}`).toBeDefined();
        expect(hit.point.y).toBeGreaterThanOrEqual(2.48 - 2.4 * Math.abs(x) / 1.49);
      }
    }
    g.dispose();
    mat.dispose();
  });

  it("has a genuinely open broken stern instead of a closed box deck", () => {
    const g = wreckGeometry();
    const mat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(g, mat);
    mesh.updateMatrixWorld(true);
    const ray = new THREE.Raycaster(new THREE.Vector3(-2.7, 5.5, 0), new THREE.Vector3(0, -1, 0));
    const hit = ray.intersectObject(mesh)[0];
    expect(hit).toBeDefined();
    expect(hit.point.y).toBeLessThan(0.3);
    g.dispose();
    mat.dispose();
  });
});
