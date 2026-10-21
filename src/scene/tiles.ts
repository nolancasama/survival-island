import * as THREE from "three";

/**
 * Spatial tiles for static scenery. A single island-wide mesh or instanced
 * batch is always partly on screen, so three.js draws all of it; split into
 * square XZ tiles, each piece gets its own bounding sphere and the renderer's
 * frustum culling skips the tiles behind and beside the camera. Larger tiles
 * mean fewer extra draw calls in the clifftop view (which sees everything) but
 * coarser culling elsewhere; 40 m measured best against the 120-call budget.
 */
export const TILE_SIZE = 40;

const tileKey = (x: number, z: number, size: number) => `${Math.floor(x / size)},${Math.floor(z / size)}`;

/** Group items by the tile under their x/z. Every item lands in exactly one
 * group, empty tiles are omitted, and order is deterministic (tile key order,
 * then input order). */
export function bucketByTile<T extends { x: number; z: number }>(items: readonly T[], size = TILE_SIZE): T[][] {
  const tiles = new Map<string, T[]>();
  for (const item of items) {
    const key = tileKey(item.x, item.z, size);
    const tile = tiles.get(key);
    if (tile) tile.push(item);
    else tiles.set(key, [item]);
  }
  return [...tiles.keys()].sort().map((key) => tiles.get(key)!);
}

/**
 * Split a static geometry into per-tile geometries by triangle centroid. Each
 * piece copies its vertices exactly (every attribute), so neighbouring tiles
 * meet without seams and flat shading is unchanged. Zero-area triangles are
 * dropped: they draw nothing.
 */
export function splitGeometryByTiles(geometry: THREE.BufferGeometry, size = TILE_SIZE): THREE.BufferGeometry[] {
  const position = geometry.getAttribute("position");
  const index = geometry.index;
  const triCount = (index ? index.count : position.count) / 3;
  const vertexAt = (corner: number) => (index ? index.getX(corner) : corner);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const tiles = new Map<string, number[]>();
  for (let t = 0; t < triCount; t++) {
    const ia = vertexAt(t * 3);
    const ib = vertexAt(t * 3 + 1);
    const ic = vertexAt(t * 3 + 2);
    a.fromBufferAttribute(position, ia);
    b.fromBufferAttribute(position, ib);
    c.fromBufferAttribute(position, ic);
    if (b.clone().sub(a).cross(c.clone().sub(a)).lengthSq() < 1e-12) continue;
    const key = tileKey((a.x + b.x + c.x) / 3, (a.z + b.z + c.z) / 3, size);
    const list = tiles.get(key);
    if (list) list.push(ia, ib, ic);
    else tiles.set(key, [ia, ib, ic]);
  }
  const names = Object.keys(geometry.attributes);
  return [...tiles.keys()].sort().map((key) => {
    const corners = tiles.get(key)!;
    const remap = new Map<number, number>();
    const used: number[] = [];
    const newIndex = corners.map((v) => {
      let n = remap.get(v);
      if (n === undefined) {
        n = used.length;
        remap.set(v, n);
        used.push(v);
      }
      return n;
    });
    const piece = new THREE.BufferGeometry();
    for (const name of names) {
      const src = geometry.getAttribute(name) as THREE.BufferAttribute;
      const array = new (src.array.constructor as new (n: number) => THREE.TypedArray)(used.length * src.itemSize);
      used.forEach((v, i) => {
        for (let k = 0; k < src.itemSize; k++) array[i * src.itemSize + k] = src.array[v * src.itemSize + k];
      });
      piece.setAttribute(name, new THREE.BufferAttribute(array, src.itemSize, src.normalized));
    }
    piece.setIndex(newIndex);
    piece.computeBoundingBox();
    piece.computeBoundingSphere();
    return piece;
  });
}
