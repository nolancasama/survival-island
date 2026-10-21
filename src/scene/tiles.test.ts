import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { bucketByTile, splitGeometryByTiles } from "./tiles";

describe("bucketByTile", () => {
  const items = [
    { x: 1, z: 1, id: "a" }, { x: 40, z: 1, id: "b" }, { x: 2, z: 3, id: "c" },
    { x: -5, z: -70, id: "d" }, { x: 31.99, z: 0, id: "e" }
  ];

  it("partitions every item into exactly one non-empty tile", () => {
    const tiles = bucketByTile(items, 32);
    expect(tiles.every((t) => t.length > 0)).toBe(true);
    expect(tiles.flat().map((i) => i.id).sort()).toEqual(["a", "b", "c", "d", "e"]);
    expect(tiles.find((t) => t.some((i) => i.id === "a"))!.map((i) => i.id)).toEqual(["a", "c", "e"]);
  });

  it("is deterministic regardless of input order", () => {
    const ids = (t: typeof items[]) => t.map((tile) => tile.map((i) => i.id).sort().join("")).sort();
    expect(ids(bucketByTile(items, 32))).toEqual(ids(bucketByTile([...items].reverse(), 32)));
  });
});

describe("splitGeometryByTiles", () => {
  const plane = () => {
    const g = new THREE.PlaneGeometry(100, 60, 20, 12);
    g.rotateX(-Math.PI / 2);
    const colors = new Float32Array(g.attributes.position.count * 3).map((_, i) => (i % 7) / 7);
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return g;
  };
  const triangles = (g: THREE.BufferGeometry) => {
    const p = g.getAttribute("position");
    const c = g.getAttribute("color");
    const out: string[] = [];
    for (let k = 0; k < g.index!.count; k += 3) {
      const v = [0, 1, 2].map((j) => g.index!.getX(k + j));
      out.push(v.map((i) => [p.getX(i), p.getY(i), p.getZ(i), c.getX(i)].map((n) => n.toFixed(4)).join(",")).join("|"));
    }
    return out;
  };

  it("keeps every triangle exactly once, with identical vertices and attributes", () => {
    const g = plane();
    const tiles = splitGeometryByTiles(g, 32);
    expect(tiles.length).toBeGreaterThan(4);
    expect(tiles.flatMap(triangles).sort()).toEqual(triangles(g).sort());
    for (const t of tiles) expect(t.boundingSphere!.radius).toBeLessThan(40);
  });

  it("drops zero-area triangles", () => {
    const g = plane();
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) if (p.getZ(i) < -20) p.setZ(i, -20);
    const kept = splitGeometryByTiles(g, 32).reduce((n, t) => n + t.index!.count / 3, 0);
    expect(kept).toBeLessThan(g.index!.count / 3);
    expect(kept).toBe(triangles(g).filter((_, k) => {
      const v = [0, 1, 2].map((j) => g.index!.getX(k * 3 + j)).map((i) => new THREE.Vector3().fromBufferAttribute(p, i));
      return v[1].clone().sub(v[0]).cross(v[2].clone().sub(v[0])).lengthSq() >= 1e-12;
    }).length);
  });
});
