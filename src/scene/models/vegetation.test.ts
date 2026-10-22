import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { PALMS, groundY } from "../../game/world/island";
import { bucketByTile } from "../tiles";
import {
  bushGeometry, choppableTreeGeometry, createPalmCrowns, jungleTreeGeometry,
  leafBushGeometry, palmAt, palmGeometry, stumpGeometry
} from "./nature";
import { bakeVegetationSpot, treeSpots, vegetationHash, vegetationStretch, vegetationTiles } from "./vegetationLayout";

const checksum = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const triangles = (g: THREE.BufferGeometry) => (g.index?.count ?? g.getAttribute("position").count) / 3;

describe("vegetation placement regression", () => {
  it("preserves the original RNG stream, including scales, rotations and tints", () => {
    // Captured from the unmodified Environment.tsx before extracting treeSpots.
    const { trees, bushes } = treeSpots();
    expect(trees).toHaveLength(139);
    expect(bushes).toHaveLength(21);
    expect(checksum(trees)).toBe("354bf8b779d0e4068a47b2de0df7ed49a3cd6d55b48c4c932c29ce61c14e176d");
    expect(checksum(bushes)).toBe("df20ccb71fa9b0de58051c76fe3d15b30bd875a666b98a33aa87220ed2e86e81");
    expect(checksum(trees.map(({ x, z }) => [x, z]))).toBe("ab37c62992f9c37494d59096b0cc00bf5ecb061f478eaed773ce0a1c39da8620");
    expect(checksum(bushes.map(({ x, z }) => [x, z]))).toBe("6b232e63e00be4feacb73d59a7d1e35ef9ebd027a03151016f7091cb3fecb204");
  });

  it("bakes the original instance tint and world transform without mutating prototypes", () => {
    const prototype = new THREE.BufferGeometry();
    prototype.setAttribute("position", new THREE.Float32BufferAttribute([1, 2, 3], 3));
    prototype.setAttribute("color", new THREE.Float32BufferAttribute([0.4, 0.6, 0.2], 3));
    for (let index = 0; index < 3; index++) {
      const spot = { x: 6, z: 10, s: 1.2, r: Math.PI / 2, tint: 0.9 };
      const baked = bakeVegetationSpot(prototype, spot, index);
      const c = baked.getAttribute("color");
      expect(c.getX(0)).toBeCloseTo(0.4 * spot.tint);
      expect(c.getY(0)).toBeCloseTo(0.6 * spot.tint * (0.95 + index * 0.04));
      expect(c.getZ(0)).toBeCloseTo(0.2 * spot.tint);
      const [sx, sy, sz] = vegetationStretch(index);
      const p = baked.getAttribute("position");
      expect(p.getX(0)).toBeCloseTo(spot.x + 3 * spot.s * sz);
      expect(p.getY(0)).toBeCloseTo(groundY(spot.x, spot.z) + 2 * spot.s * sy);
      expect(p.getZ(0)).toBeCloseTo(spot.z - spot.s * sx);
      baked.dispose();
    }
    expect(Array.from(prototype.getAttribute("position").array)).toEqual([1, 2, 3]);
    prototype.dispose();
  });
});

describe("vegetation geometry contracts", () => {
  it("keeps jungle crowns above paths and within the silhouette and triangle budgets", () => {
    const counts: number[][] = [];
    const signatures = new Set<string>();
    for (let archetype = 0; archetype < 5; archetype++) {
      counts[archetype] = [];
      for (let variant = 0; variant < 3; variant++) {
        const g = jungleTreeGeometry(archetype, variant);
        const p = g.getAttribute("position");
        const c = g.getAttribute("color");
        counts[archetype][variant] = triangles(g);
        expect(triangles(g)).toBeLessThanOrEqual(600);
        signatures.add(checksum(Array.from(p.array)));
        let foliageVertices = 0;
        for (let i = 0; i < p.count; i++) {
          expect(Number.isFinite(p.getX(i) + p.getY(i) + p.getZ(i))).toBe(true);
          if (c.getY(i) > c.getX(i) && c.getY(i) > c.getZ(i)) {
            foliageVertices++;
            expect(p.getY(i) * 0.97).toBeGreaterThanOrEqual(1.8);
            expect(Math.hypot(p.getX(i), p.getZ(i)) * 1.04).toBeLessThanOrEqual(2.53);
          }
        }
        expect(foliageVertices).toBeGreaterThan(100);
        g.dispose();
      }
    }
    const usedCounts = treeSpots().trees.map((_, index) => {
      const h = vegetationHash(index);
      return counts[h % 5][(h >>> 8) % 3];
    });
    expect(usedCounts.reduce((a, b) => a + b, 0) / usedCounts.length).toBeLessThanOrEqual(450);
    expect(signatures.size).toBe(15);
  });

  it("keeps resource and decorative silhouettes in their existing footprints", () => {
    const decor = [0, 1, 2].map(bushGeometry);
    decor.forEach((g) => expect(triangles(g)).toBeLessThanOrEqual(250));
    expect(new Set(decor.map((g) => checksum(Array.from(g.getAttribute("position").array)))).size).toBe(3);
    const leaf = leafBushGeometry();
    expect(triangles(leaf)).toBeLessThanOrEqual(400);
    leaf.computeBoundingBox();
    expect(leaf.boundingBox!.max.y).toBeGreaterThan(1);
    expect(leaf.boundingBox!.max.y).toBeLessThan(1.2);
    const p = leaf.getAttribute("position");
    for (let i = 0; i < p.count; i++) expect(Math.hypot(p.getX(i), p.getZ(i))).toBeLessThanOrEqual(1.05);
    // Every blade face has an explicit reverse face for FrontSide occluderMat.
    const normal = leaf.getAttribute("normal");
    for (let i = 0; i < normal.count; i += 6) {
      const a = new THREE.Vector3().fromBufferAttribute(normal, i);
      const b = new THREE.Vector3().fromBufferAttribute(normal, i + 3);
      expect(a.dot(b)).toBeLessThan(-0.99);
    }
    const chop = choppableTreeGeometry();
    chop.computeBoundingBox();
    expect(chop.boundingBox!.min.y).toBeGreaterThan(-0.02);
    expect(chop.boundingBox!.max.y).toBeGreaterThan(3.8);
    expect(chop.boundingBox!.max.y).toBeLessThan(5.1);
    const stump = stumpGeometry();
    stump.computeBoundingBox();
    expect(stump.boundingBox!.max.y).toBeLessThan(0.5);
    [...decor, leaf, chop, stump].forEach((g) => g.dispose());
  });

  it("preserves palm curves and keeps continuous closed trunks and two-sided crowns under budget", () => {
    const crowns = createPalmCrowns();
    for (let silhouette = 0; silhouette < 4; silhouette++) {
      const normal = crowns[silhouette].getAttribute("normal");
      // The last 20 triangles are the solid hub; the rest are paired leaf faces.
      for (let i = 0; i < normal.count - 60; i += 6) {
        const a = new THREE.Vector3().fromBufferAttribute(normal, i);
        const b = new THREE.Vector3().fromBufferAttribute(normal, i + 3);
        expect(a.dot(b)).toBeLessThan(-0.99);
      }
    }
    PALMS.forEach((palm, index) => {
      for (const t of [0, 0.2, 0.5, 0.8, 1]) {
        const off = palm.lean * palm.height * Math.pow(t, 1.7);
        expect(palmAt(palm, t)).toEqual([
          palm.x + Math.sin(palm.dir) * off, groundY(palm.x, palm.z) - 0.1 + palm.height * t,
          palm.z + Math.cos(palm.dir) * off
        ]);
      }
      const g = palmGeometry(palm, index % 4, crowns[index % 4]);
      expect(triangles(g)).toBeLessThanOrEqual(1400);
      const p = g.getAttribute("position");
      const edges = new Map<string, number>();
      const vertex = (i: number) => [p.getX(i), p.getY(i), p.getZ(i)].map((v) => v.toFixed(5)).join(",");
      // First 160 triangles form the swept trunk and both caps. Every edge is shared.
      for (let i = 0; i < 160 * 3; i += 3) {
        for (let side = 0; side < 3; side++) {
          const key = [vertex(i + side), vertex(i + (side + 1) % 3)].sort().join("|");
          edges.set(key, (edges.get(key) ?? 0) + 1);
        }
      }
      expect([...edges.values()].every((count) => count === 2)).toBe(true);
      g.dispose();
    });
    crowns.forEach((g) => g.dispose());
  });
});

describe("static vegetation tiles", () => {
  it("merges all kinds into one bounded geometry per occupied 40 m tile", () => {
    const { trees, bushes } = treeSpots();
    const tiles = vegetationTiles();
    expect(tiles).toHaveLength(bucketByTile([...trees, ...bushes, ...PALMS]).length);
    expect(tiles.length).toBeLessThan(bucketByTile(trees).length + PALMS.length + 1);
    const crowns = createPalmCrowns();
    let expected = 0;
    trees.forEach((_, i) => {
      const h = vegetationHash(i);
      const g = jungleTreeGeometry(h % 5, (h >>> 8) % 3);
      expected += triangles(g);
      g.dispose();
    });
    bushes.forEach((_, i) => {
      const g = bushGeometry(vegetationHash(i) % 3);
      expected += triangles(g);
      g.dispose();
    });
    PALMS.forEach((palm, i) => {
      const g = palmGeometry(palm, i % 4, crowns[i % 4]);
      expected += triangles(g);
      g.dispose();
    });
    expect(tiles.reduce((sum, g) => sum + triangles(g), 0)).toBe(expected);
    for (const g of tiles) {
      expect(g.groups).toHaveLength(0);
      expect(g.boundingSphere!.radius).toBeGreaterThan(0);
      expect(Number.isFinite(g.boundingSphere!.radius)).toBe(true);
      expect(g.getAttribute("color").count).toBe(g.getAttribute("position").count);
    }
    [...tiles, ...crowns].forEach((g) => g.dispose());
  });
});
