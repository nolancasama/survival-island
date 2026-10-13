import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { rt } from "../game/runtime";
import { getGame } from "../game/store";
import { CRATE, NODES, NODE_BY_ID, groundY } from "../game/world/island";
import type { NodeKind } from "../game/types";
import { additiveSprite, flatMat, shadowMaterial } from "./materials";
import { coconutGeometry, driftwoodGeometry, stonePileGeometry } from "./models/nature";
import { crateBodyGeometry, crateLidGeometry } from "./models/props";

/**
 * Collectible resources. Each node is its own small mesh so it can vanish when
 * taken and pop back in when it regrows. A periodic glint helps children spot
 * them; the focused one bobs gently.
 */
export function ResourceNodes() {
  const geos = useMemo<Record<NodeKind, THREE.BufferGeometry>>(
    () => ({ wood: driftwoodGeometry(), stone: stonePileGeometry(), coconut: coconutGeometry() }),
    []
  );
  const refs = useRef<Array<THREE.Group | null>>([]);
  const glints = useRef<Array<THREE.Sprite | null>>([]);
  const glintMat = useMemo(() => NODES.map(() => additiveSprite("#fff6c8", 0)), []);
  const shadow = useMemo(() => shadowMaterial(0.22), []);

  useFrame(() => {
    const focus = getGame().focus;
    NODES.forEach((n, i) => {
      const g = refs.current[i];
      if (!g) return;
      const taken = rt.taken.has(n.id);
      g.visible = !taken;
      if (taken) return;
      const regrow = rt.regrown.get(n.id);
      let s = 1;
      if (regrow !== undefined) {
        const t = (rt.time - regrow) / 0.45;
        if (t >= 1) rt.regrown.delete(n.id);
        else s = t < 0.7 ? (t / 0.7) * 1.15 : 1.15 - ((t - 0.7) / 0.3) * 0.15;
      }
      const focused = focus?.kind === "node" && focus.id === n.id;
      const bob = focused ? 0.05 + Math.sin(rt.time * 5) * 0.04 : 0;
      g.scale.setScalar(Math.max(0.001, s * (focused ? 1.08 : 1)));
      g.position.y = groundY(n.x, n.z) + bob;
      // Glint: a short twinkle every few seconds, offset per node.
      const phase = (rt.time * 0.45 + i * 0.37) % 3;
      const tw = phase < 0.35 ? Math.sin((phase / 0.35) * Math.PI) : 0;
      glintMat[i].opacity = tw * 0.9;
      const sp = glints.current[i];
      if (sp) sp.scale.setScalar(0.25 + tw * 0.5);
    });
  });

  return (
    <group>
      {NODES.map((n, i) => (
        <group key={n.id} ref={(el) => void (refs.current[i] = el)} position={[n.x, groundY(n.x, n.z), n.z]}>
          <mesh geometry={geos[n.kind]} material={flatMat} rotation={[0, n.rot, 0]} />
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} material={shadow}>
            <planeGeometry args={[n.kind === "wood" ? 2 : 1.1, n.kind === "wood" ? 1 : 1.1]} />
          </mesh>
          <sprite
            ref={(el) => void (glints.current[i] = el)}
            material={glintMat[i]}
            position={[0.15, n.kind === "wood" ? 0.45 : 0.5, 0.1]}
            scale={[0.4, 0.4, 1]}
          />
        </group>
      ))}
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
      <mesh geometry={body} material={flatMat} />
      <group ref={lidRef} position={[0, 0.78, -0.53]}>
        <mesh geometry={lid} material={flatMat} />
      </group>
    </group>
  );
}

const BEACON_COUNT = 3;

/** Light pillars and bobbing arrows over the nodes asked for with "I need ___". */
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
      const n = id ? NODE_BY_ID.get(id) : undefined;
      g.visible = Boolean(active && n && !rt.taken.has(n.id));
      if (!g.visible || !n) continue;
      g.position.set(n.x, groundY(n.x, n.z), n.z);
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
