import { useCallback, useEffect, useSyncExternalStore } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { rt } from "../../game/runtime";
import { MODEL_PATHS, type ModelKey } from "./manifest";

interface ModelEntry {
  promise: Promise<THREE.BufferGeometry | null>;
  geometry: THREE.BufferGeometry | null;
}

const cache = new Map<ModelKey, ModelEntry>();
const listeners = new Set<() => void>();
let pending = 0;

/**
 * One request per key, including failures. Only geometry survives loading: the
 * scene always supplies occluderMat. A failed/blocked request settles to null,
 * leaving the procedural island usable, and never retries each React render.
 */
export function loadModelGeometry(key: ModelKey): Promise<THREE.BufferGeometry | null> {
  const existing = cache.get(key);
  if (existing) return existing.promise;
  pending++;
  rt.modelsReady = false;
  const entry: ModelEntry = { geometry: null, promise: Promise.resolve(null) };
  cache.set(key, entry);
  entry.promise = (async () => {
    const parts: THREE.BufferGeometry[] = [];
    try {
      // BASE_URL is './': resolve against the document, including Pages folders.
      const url = new URL(`${import.meta.env.BASE_URL}${MODEL_PATHS[key]}`, document.baseURI);
      const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const gltf = await new GLTFLoader().parseAsync(await response.arrayBuffer(), new URL(".", url).href);
      gltf.scene.updateMatrixWorld(true);
      gltf.scene.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        // Normalize attributes/indexing so swapped multi-mesh files can merge.
        const g = object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone();
        g.applyMatrix4(object.matrixWorld);
        const p = g.getAttribute("position");
        const colors = new Float32Array(p.count * 3);
        const color = g.getAttribute("color");
        for (let i = 0; i < p.count; i++) {
          colors.set(color ? [color.getX(i), color.getY(i), color.getZ(i)] : [1, 1, 1], i * 3);
        }
        // A merged mesh loses the source object's mirrored winding flag.
        if (object.matrixWorld.determinant() < 0) {
          for (let i = 0; i < p.count; i += 3) {
            const a = [p.getX(i + 1), p.getY(i + 1), p.getZ(i + 1)];
            p.setXYZ(i + 1, p.getX(i + 2), p.getY(i + 2), p.getZ(i + 2));
            p.setXYZ(i + 2, a[0], a[1], a[2]);
            for (let c = 0; c < 3; c++) {
              const value = colors[(i + 1) * 3 + c];
              colors[(i + 1) * 3 + c] = colors[(i + 2) * 3 + c];
              colors[(i + 2) * 3 + c] = value;
            }
          }
        }
        for (const name of Object.keys(g.attributes)) if (name !== "position") g.deleteAttribute(name);
        g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
        parts.push(g);
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) {
          for (const value of Object.values(material)) if (value instanceof THREE.Texture) value.dispose();
          material.dispose();
        }
      });
      if (!parts.length) throw new Error("No mesh geometry");
      const geometry = mergeGeometries(parts, false);
      if (!geometry) throw new Error("Incompatible mesh geometry");
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
      const bounds = geometry.boundingBox!;
      if (!Number.isFinite(bounds.max.y) || bounds.max.y <= bounds.min.y) {
        geometry.dispose();
        throw new Error("Empty model bounds");
      }
      entry.geometry = geometry;
      return geometry;
    } catch (error) {
      console.warn(`Pirate model ${key} unavailable; using procedural scenery.`, error);
      return null;
    } finally {
      parts.forEach((part) => part.dispose());
      rt.modelsReady = --pending === 0;
      listeners.forEach((notify) => notify());
    }
  })();
  return entry.promise;
}

/** Start independent loads at boot; ready means settled, including failures. */
export function preloadModels(keys: readonly ModelKey[]): Promise<unknown> {
  return Promise.all(keys.map(loadModelGeometry));
}

const subscribe = (notify: () => void) => {
  listeners.add(notify);
  return () => { listeners.delete(notify); };
};

/** Shared cache snapshots avoid stale geometry when a caller changes its key. */
export function useModelGeometry(key: ModelKey): THREE.BufferGeometry | null {
  useEffect(() => { void loadModelGeometry(key); }, [key]);
  const snapshot = useCallback(() => cache.get(key)?.geometry ?? null, [key]);
  return useSyncExternalStore(subscribe, snapshot, () => null);
}
