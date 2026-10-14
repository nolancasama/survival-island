import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { rt } from "../game/runtime";
import { getGame } from "../game/store";
import { CRATE, NODES, groundY } from "../game/world/island";
import { targetPosition } from "../game/flow/places";
import type { NodeKind } from "../game/types";
import { glowTexture, occluderMat, shadowMaterial } from "./materials";
import {
  choppableTreeGeometry,
  coconutGeometry,
  driftwoodGeometry,
  leafBushGeometry,
  stonePileGeometry,
  stumpGeometry
} from "./models/nature";
import { crateBodyGeometry, crateLidGeometry } from "./models/props";

/**
 * Collectible resources. Each node is its own small mesh so it can vanish when
 * taken and pop back in when it regrows. A periodic glint helps children spot
 * them; the focused one bobs gently.
 */
export function ResourceNodes() {
  const geos = useMemo<Record<NodeKind, THREE.BufferGeometry>>(
    () => ({
      wood: driftwoodGeometry(),
      stone: stonePileGeometry(),
      coconut: coconutGeometry(),
      leaves: leafBushGeometry(),
      tree: choppableTreeGeometry()
    }),
    []
  );
  const stump = useMemo(stumpGeometry, []);
  const kinds = useMemo(() => (["wood", "stone", "coconut", "leaves"] as NodeKind[]), []);
  const byKind = useMemo(() => new Map(kinds.map((kind) => [kind, NODES.filter((n) => n.kind === kind)])), [kinds]);
  const instances = useRef(new Map<NodeKind, THREE.InstancedMesh>());
  const shadows = useRef<THREE.InstancedMesh>(null);
  const treeRoots = useRef<Array<THREE.Group | null>>([]);
  const treeCrowns = useRef<Array<THREE.Mesh | null>>([]);
  const glints = useRef<THREE.Points>(null);
  const treeNodes = useMemo(() => NODES.filter((n) => n.kind === "tree"), []);
  const shadow = useMemo(() => shadowMaterial(0.22), []);
  const glintGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(NODES.length * 3), 3));
    geo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(NODES.length * 3), 3));
    return geo;
  }, []);
  const glintMat = useMemo(
    () => new THREE.PointsMaterial({
      map: glowTexture(), color: "#fff6c8", size: 0.65, sizeAttenuation: true,
      transparent: true, opacity: 0.9, vertexColors: true, blending: THREE.AdditiveBlending,
      depthWrite: false, alphaTest: 0.02
    }),
    []
  );
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame(() => {
    const focus = getGame().focus;
    const scaleFor = (id: string, focused: boolean) => {
      const regrow = rt.regrown.get(id);
      let s = 1;
      if (regrow !== undefined) {
        const t = (rt.time - regrow) / 0.45;
        if (t >= 1) rt.regrown.delete(id);
        else s = t < 0.7 ? (t / 0.7) * 1.15 : 1.15 - ((t - 0.7) / 0.3) * 0.15;
      }
      return Math.max(0.001, s * (focused ? 1.08 : 1));
    };
    for (const kind of kinds) {
      const mesh = instances.current.get(kind);
      const nodes = byKind.get(kind);
      if (!mesh || !nodes) continue;
      nodes.forEach((n, i) => {
        const focused = focus?.kind === "node" && focus.id === n.id;
        const s = rt.taken.has(n.id) ? 0.001 : scaleFor(n.id, focused);
        const bob = focused ? 0.05 + Math.sin(rt.time * 5) * 0.04 : 0;
        dummy.position.set(n.x, groundY(n.x, n.z) + bob, n.z);
        dummy.rotation.set(0, n.rot, 0);
        dummy.scale.setScalar(s);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
    }
    treeNodes.forEach((n, i) => {
      const root = treeRoots.current[i];
      const crown = treeCrowns.current[i];
      if (!root || !crown) return;
      const taken = rt.taken.has(n.id);
      root.position.y = groundY(n.x, n.z);
      root.scale.setScalar(taken ? 1 : scaleFor(n.id, focus?.kind === "node" && focus.id === n.id));
      crown.visible = !taken;
      root.children[1].visible = taken;
    });
    if (shadows.current) {
      NODES.forEach((n, i) => {
        const show = !rt.taken.has(n.id) || n.kind === "tree";
        const sx = n.kind === "tree" || n.kind === "leaves" ? 1.7 : n.kind === "wood" ? 2 : 1.1;
        dummy.position.set(n.x, groundY(n.x, n.z) + 0.025, n.z);
        dummy.rotation.set(-Math.PI / 2, 0, n.rot);
        dummy.scale.set(show ? sx : 0.001, show ? (n.kind === "wood" ? 1 : sx) : 0.001, 1);
        dummy.updateMatrix();
        shadows.current!.setMatrixAt(i, dummy.matrix);
      });
      shadows.current.instanceMatrix.needsUpdate = true;
    }
    const gp = glintGeo.attributes.position as THREE.BufferAttribute;
    const gc = glintGeo.attributes.color as THREE.BufferAttribute;
    NODES.forEach((n, i) => {
      const visible = !rt.taken.has(n.id);
      const phase = (rt.time * 0.45 + i * 0.37) % 3;
      const tw = visible && phase < 0.35 ? Math.sin((phase / 0.35) * Math.PI) : 0;
      gp.setXYZ(i, n.x + 0.15, groundY(n.x, n.z) + (n.kind === "tree" ? 3.4 : n.kind === "leaves" ? 1.05 : 0.5), n.z + 0.1);
      gc.setXYZ(i, tw, tw * 0.96, tw * 0.74);
    });
    gp.needsUpdate = true;
    gc.needsUpdate = true;
  });

  return (
    <group>
      {kinds.map((kind) => (
        <instancedMesh
          key={kind}
          ref={(el) => { if (el) instances.current.set(kind, el); else instances.current.delete(kind); }}
          args={[geos[kind], occluderMat, byKind.get(kind)?.length ?? 0]}
          frustumCulled={false}
        />
      ))}
      {treeNodes.map((n, i) => (
        <group key={n.id} ref={(el) => void (treeRoots.current[i] = el)} position={[n.x, groundY(n.x, n.z), n.z]} rotation={[0, n.rot, 0]}>
          <mesh ref={(el) => void (treeCrowns.current[i] = el)} geometry={geos.tree} material={occluderMat} />
          <mesh geometry={stump} material={occluderMat} visible={false} />
        </group>
      ))}
      <instancedMesh ref={shadows} args={[undefined, shadow, NODES.length]} frustumCulled={false}>
        <planeGeometry args={[1, 1]} />
      </instancedMesh>
      <points ref={glints} geometry={glintGeo} material={glintMat} frustumCulled={false} />
    </group>
  );
}

export function Crate() {
  const body = useMemo(crateBodyGeometry, []);
  const lid = useMemo(crateLidGeometry, []);
  const lidRef = useRef<THREE.Group>(null);
  const root = useRef<THREE.Group>(null);
  const y = groundY(CRATE.x, CRATE.z);
  useFrame(() => {
    const opened = getGame().crateOpened;
    const t = rt.crateOpenT0 >= 0 ? Math.min(1, (rt.time - rt.crateOpenT0) / 0.5) : opened ? 1 : 0;
    if (lidRef.current) lidRef.current.rotation.x = -t * 1.9;
    const focused = getGame().focus?.kind === "crate";
    if (root.current) root.current.position.y = y + (focused ? 0.04 + Math.sin(rt.time * 5) * 0.03 : 0);
  });
  return (
    <group ref={root} position={[CRATE.x, y, CRATE.z]} rotation={[0, CRATE.rot, 0]}>
      <mesh geometry={body} material={occluderMat} />
      <group ref={lidRef} position={[0, 0.78, -0.53]}>
        <mesh geometry={lid} material={occluderMat} />
      </group>
    </group>
  );
}

const BEACON_COUNT = 3;

/** Light pillars and bobbing arrows over the nodes and places asked for with "I need ___" (or lit by Kai). */
export function Beacons() {
  const pillarGeo = useMemo(() => {
    const g = new THREE.CylinderGeometry(0.45, 0.6, 9, 12, 1, true);
    g.translate(0, 4.5, 0);
    const p = g.attributes.position;
    const colors = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const k = 1 - p.getY(i) / 9;
      colors.set([k, k, k], i * 3);
    }
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return g;
  }, []);
  const pillarMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: "#ffe680",
        vertexColors: true,
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        fog: false
      }),
    []
  );
  const arrowMat = useMemo(() => new THREE.MeshLambertMaterial({ color: "#ffd23a", emissive: "#b8860b" }), []);
  const refs = useRef<Array<THREE.Group | null>>([]);
  useFrame(() => {
    const active = rt.time < rt.beacons.until;
    const fade = active ? Math.min(1, (rt.beacons.until - rt.time) / 1.5) : 0;
    for (let i = 0; i < BEACON_COUNT; i++) {
      const g = refs.current[i];
      if (!g) continue;
      const id = rt.beacons.ids[i];
      const at = id ? targetPosition(id) : null;
      g.visible = Boolean(active && at && !rt.taken.has(id));
      if (!g.visible || !at) continue;
      g.position.set(at.x, groundY(at.x, at.z), at.z);
      const arrow = g.children[1];
      arrow.position.y = 2.1 + Math.sin(rt.time * 4 + i) * 0.25;
      arrow.rotation.y = rt.time * 2;
    }
    pillarMat.opacity = 0.5 * fade + Math.sin(rt.time * 6) * 0.06 * fade;
  });
  return (
    <group>
      {Array.from({ length: BEACON_COUNT }, (_, i) => (
        <group key={i} ref={(el) => void (refs.current[i] = el)} visible={false}>
          <mesh geometry={pillarGeo} material={pillarMat} />
          <mesh material={arrowMat} rotation={[Math.PI, 0, 0]}>
            <coneGeometry args={[0.32, 0.6, 4]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
