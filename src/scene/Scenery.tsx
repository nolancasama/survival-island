import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { PALMS, groundY, type Palm } from "../game/world/island";
import { DECOR_ITEMS, DECOR_PALMS } from "../game/world/scenery";
import { type ModelKey } from "./assets/manifest";
import { useModelGeometry } from "./assets/models";
import { occluderMat } from "./materials";
import { palmsGeometry, rockGeometry } from "./models/nature";
import { PartBuilder } from "./partBuilder";

const PALM_KEYS = ["palmA", "palmB", "palmC"] as const;
const ALL_PALMS = [...PALMS, ...DECOR_PALMS];

function PalmInstances({ variant, palms }: { variant: typeof PALM_KEYS[number]; palms: Palm[] }) {
  const geometry = useModelGeometry(variant);
  const fallback = useMemo(() => palmsGeometry(palms), [palms]);
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    if (!geometry || !ref.current) return;
    const height = geometry.boundingBox!.max.y - geometry.boundingBox!.min.y;
    const object = new THREE.Object3D();
    const axis = new THREE.Vector3();
    const yaw = new THREE.Quaternion();
    palms.forEach((palm, i) => {
      object.position.set(palm.x, groundY(palm.x, palm.z) - 0.06, palm.z);
      // Tilt about the trunk base toward dir (+z is sea), then vary crown yaw.
      axis.set(Math.cos(palm.dir), 0, -Math.sin(palm.dir));
      object.quaternion.setFromAxisAngle(axis, Math.atan(palm.lean));
      yaw.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, palm.yaw ?? ((palm.x * 17.3 + palm.z * 9.7) % (Math.PI * 2)));
      object.quaternion.multiply(yaw);
      object.scale.setScalar(palm.height / height);
      object.updateMatrix();
      ref.current!.setMatrixAt(i, object.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
    ref.current.computeBoundingSphere();
  }, [geometry, palms]);
  if (!geometry) return <mesh geometry={fallback} material={occluderMat} />;
  return <instancedMesh ref={ref} args={[geometry, occluderMat, palms.length]} />;
}

/** All standing palms share three batches, including the coconut landmarks.
 * Procedural palms stay merged per variant while each GLB is unavailable.
 * occluderMat preserves the existing camera-to-player screen-door fade.
 */
export function Palms() {
  const groups = useMemo(() => PALM_KEYS.map((key) => ALL_PALMS.filter((palm, i) => (palm.variant ?? PALM_KEYS[i % 3]) === key)), []);
  return <group dispose={null}>{PALM_KEYS.map((key, i) => <PalmInstances key={key} variant={key} palms={groups[i]} />)}</group>;
}

/** Small procedural counterparts keep scenery/colliders readable offline too. */
function propFallback(key: ModelKey): THREE.BufferGeometry {
  const b = new PartBuilder();
  if (key.startsWith("rock")) {
    b.add(rockGeometry(1, 1, key.charCodeAt(4)), "#96958b", [0, 0.35, 0]);
  } else if (key === "barrel") {
    b.cyl(0.4, 0.4, 1, 0, 0, 0, "#9b6e43", 10);
    for (const y of [0.12, 0.78]) b.cyl(0.415, 0.415, 0.1, 0, y, 0, "#626a68", 10);
  } else if (key === "bucket") {
    b.cyl(0.37, 0.28, 0.65, 0, 0, 0, "#9b7753", 10);
    b.cyl(0.38, 0.38, 0.05, 0, 0.65, 0, "#65706b", 10);
    b.cyl(0.3, 0.3, 0.015, 0, 0.695, 0, "#3d3a31", 10);
  } else if (key === "bottle") {
    b.cyl(0.18, 0.18, 0.45, 0, 0, 0, "#448b72", 8);
    b.cyl(0.07, 0.12, 0.22, 0, 0.45, 0, "#448b72", 8);
  } else {
    b.cyl(0.15, 0.17, 1.3, 0, 0, 0, "#8f7153", 7);
  }
  return b.build();
}

type DecorItem = typeof DECOR_ITEMS[number];

function DecorInstances({ modelKey, items }: { modelKey: ModelKey; items: DecorItem[] }) {
  const loaded = useModelGeometry(modelKey);
  const fallback = useMemo(() => propFallback(modelKey), [modelKey]);
  const geometry = loaded ?? fallback;
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    if (!ref.current) return;
    geometry.computeBoundingBox();
    const box = geometry.boundingBox!;
    const h = box.max.y - box.min.y;
    const p = geometry.getAttribute("position");
    let footprint = 0.01;
    // Low-half footprint, rather than a tall post's top or an entire canopy.
    for (let i = 0; i < p.count; i++) {
      if (p.getY(i) <= box.min.y + h * 0.55) footprint = Math.max(footprint, Math.hypot(p.getX(i), p.getZ(i)));
    }
    const object = new THREE.Object3D();
    items.forEach((item, i) => {
      const widthScale = (item.r > 0 ? item.r / 0.8 : 0.12) / footprint;
      object.scale.set(widthScale, item.height / h, widthScale);
      object.position.set(item.x, groundY(item.x, item.z) - box.min.y * object.scale.y - 0.035, item.z);
      object.rotation.set(0, item.yaw, 0);
      object.updateMatrix();
      ref.current!.setMatrixAt(i, object.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
    ref.current.computeBoundingSphere();
  }, [geometry, items]);
  return <instancedMesh ref={ref} args={[geometry, occluderMat, items.length]} />;
}

/** Rocks and the small wreck POI batch by model; no camera collision changes. */
export function PirateScenery() {
  const groups = useMemo(() => [...new Set(DECOR_ITEMS.map((item) => item.key))].map((key) => ({ key, items: DECOR_ITEMS.filter((item) => item.key === key) })), []);
  return <group dispose={null}>{groups.map(({ key, items }) => <DecorInstances key={key} modelKey={key} items={items} />)}</group>;
}
