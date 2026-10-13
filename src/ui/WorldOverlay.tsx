import { useEffect, useRef } from "react";
import * as THREE from "three";
import { getGame } from "../game/store";
import { rt } from "../game/runtime";
import { focusPosition } from "../game/flow/focus";
import { groundY } from "../game/world/island";
import { cameraRef } from "../scene/CameraRig";

/**
 * DOM labels anchored to the 3D world: the "E Get wood" hint over the thing
 * in reach, and floating words ("+1 wood", "Yum!"). Positioned imperatively
 * every animation frame so React never re-renders at 60 fps.
 */
export function WorldOverlay() {
  const label = useRef<HTMLDivElement>(null);
  const floatLayer = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    const v = new THREE.Vector3();
    const nodes = new Map<number, HTMLDivElement>();
    let lastText = "";
    const project = (x: number, y: number, z: number) => {
      const cam = cameraRef.current;
      if (!cam) return null;
      v.set(x, y, z).project(cam);
      if (v.z > 1) return null;
      return { x: ((v.x + 1) / 2) * window.innerWidth, y: ((1 - v.y) / 2) * window.innerHeight };
    };
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const g = getGame();
      const el = label.current;
      if (el) {
        const f = g.screen === "game" && g.mode === "explore" ? g.focus : null;
        const pos = f ? focusPosition(f) : null;
        const s = pos && f ? project(pos.x, groundY(pos.x, pos.z) + (f.kind === "kai" ? 2.55 : f.kind === "sign" ? 2.3 : 1.25), pos.z) : null;
        if (s && f) {
          const text = `${g.touch ? "" : "E|"}${f.verb} ${f.noun}`;
          if (text !== lastText) {
            lastText = text;
            const [key, words] = text.includes("|") ? text.split("|") : ["", text];
            el.innerHTML = `${key ? `<kbd>${key}</kbd>` : ""}<span>${words}</span>`;
          }
          el.style.transform = `translate(${s.x}px, ${s.y}px) translate(-50%, -100%)`;
          el.style.opacity = "1";
        } else {
          el.style.opacity = "0";
        }
      }
      // Floating words.
      const layer = floatLayer.current;
      if (layer) {
        const alive = new Set<number>();
        for (const fl of rt.floaters) {
          const age = rt.time - fl.t0;
          if (age > 1.4) continue;
          alive.add(fl.id);
          let n = nodes.get(fl.id);
          if (!n) {
            n = document.createElement("div");
            n.className = "floater";
            n.textContent = fl.text;
            layer.appendChild(n);
            nodes.set(fl.id, n);
          }
          const s = project(fl.x, fl.y + age * 0.9, fl.z);
          if (s) {
            n.style.transform = `translate(${s.x}px, ${s.y}px) translate(-50%, -50%) scale(${1 + Math.min(age, 0.15) * 2 - 0.3})`;
            n.style.opacity = String(Math.max(0, 1 - Math.max(0, age - 0.8) / 0.6));
          } else n.style.opacity = "0";
        }
        for (const [id, n] of nodes) {
          if (!alive.has(id)) {
            n.remove();
            nodes.delete(id);
          }
        }
        rt.floaters = rt.floaters.filter((fl) => rt.time - fl.t0 <= 1.4);
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <>
      <div ref={label} className="world-label" data-testid="world-label" />
      <div ref={floatLayer} className="float-layer" />
    </>
  );
}
