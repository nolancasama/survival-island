import { useEffect, useRef } from "react";
import * as THREE from "three";
import { getGame, type Focus } from "../game/store";
import { rt } from "../game/runtime";
import { focusPosition } from "../game/flow/focus";
import { targetPosition } from "../game/flow/places";
import { groundY } from "../game/world/island";
import { cameraRef } from "../scene/CameraRig";

/** Label height above the ground for each kind of focus target. */
function labelHeight(f: Focus): number {
  if (f.kind === "kai") return 2.55;
  if (f.kind === "sign") return 2.3;
  if (f.kind === "shelter") return 2.6;
  if (f.kind === "node" && f.icon === "tree") return 2.2;
  return 1.25;
}

/** Beacons further than this from the camera get an arrow even when on screen (fog starts at 60 m). */
const FAR = 60;
/** Screen margins for edge arrows: clear of the hint at the top and the bag and prompt at the bottom. */
const EDGE = { x: 56, top: 90, bottom: 150 };
const ARROWS = 3;

/**
 * DOM labels anchored to the 3D world: the "E Get wood" hint over the thing
 * in reach, floating words ("+1 wood", "Yum!"), and arrows for beacons that
 * are off screen or far away (at the screen edge, pointing the way; over the
 * target when it is on screen but lost in the fog). Positioned imperatively
 * every animation frame so React never re-renders at 60 fps.
 */
export function WorldOverlay() {
  const label = useRef<HTMLDivElement>(null);
  const floatLayer = useRef<HTMLDivElement>(null);
  const arrowLayer = useRef<HTMLDivElement>(null);

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
    const arrows: HTMLDivElement[] = [];
    if (arrowLayer.current) {
      for (let i = 0; i < ARROWS; i++) {
        const a = document.createElement("div");
        a.className = "edge-arrow";
        a.dataset.testid = "edge-arrow";
        // A block arrow with a shaft: a bare triangle reads the wrong way at some angles.
        // Only the inner span turns, so the circle's shadow stays below it.
        a.innerHTML =
          '<span class="dir"><svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path d="M2 9.5 H12 V4 L22.5 12 L12 20 V14.5 H2 Z" fill="#3b2a1c" /></svg></span>';
        arrowLayer.current.appendChild(a);
        arrows.push(a);
      }
    }

    /** Place an arrow at screen point (sx, sy), turned to `angle` (radians, 0 = right, clockwise). */
    const setArrow = (a: HTMLDivElement, sx: number, sy: number, angle: number) => {
      a.style.transform = `translate(${sx}px, ${sy}px) translate(-50%, -50%)`;
      (a.firstElementChild as HTMLElement).style.transform = `rotate(${angle}rad)`;
    };

    /** Place arrow i for a beacon target, or hide it when the target is close and in view. */
    const pointAt = (a: HTMLDivElement, x: number, z: number) => {
      const cam = cameraRef.current;
      if (!cam) return false;
      const y = groundY(x, z) + 1.5;
      const dist = cam.position.distanceTo(v.set(x, y, z));
      v.project(cam);
      const behind = v.z > 1;
      const w = window.innerWidth;
      const h = window.innerHeight;
      const onScreen = !behind && Math.abs(v.x) <= 0.92 && Math.abs(v.y) <= 0.9;
      if (onScreen && dist <= FAR) return false;
      if (onScreen) {
        // In view but in the fog: a marker over the target, pointing down at it.
        const sx = ((v.x + 1) / 2) * w;
        const sy = ((1 - v.y) / 2) * h;
        setArrow(a, sx, sy - 30, Math.PI / 2);
        a.classList.add("far");
        return true;
      }
      // Off screen (or behind the camera): an arrow at the edge, pointing the way.
      let dx = v.x;
      let dy = -v.y;
      if (behind) {
        dx = -dx;
        dy = -dy;
      }
      if (Math.hypot(dx, dy) < 1e-3) dy = 1;
      // From the centre of the free area along the direction, out to its edge.
      const cx = w / 2;
      const cy = (EDGE.top + h - EDGE.bottom) / 2;
      const hw = w / 2 - EDGE.x;
      const hh = (h - EDGE.bottom - EDGE.top) / 2;
      const k = Math.min(hw / Math.max(1e-6, Math.abs(dx)), hh / Math.max(1e-6, Math.abs(dy)));
      const sx = cx + dx * k;
      const sy = cy + dy * k;
      setArrow(a, sx, sy, Math.atan2(dy, dx));
      a.classList.remove("far");
      return true;
    };

    const loop = () => {
      raf = requestAnimationFrame(loop);
      const g = getGame();
      const el = label.current;
      if (el) {
        const f = g.screen === "game" && g.mode === "explore" ? g.focus : null;
        const pos = f ? focusPosition(f) : null;
        const s = pos && f ? project(pos.x, groundY(pos.x, pos.z) + labelHeight(f), pos.z) : null;
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
      // Arrows toward far or hidden beacons, for as long as the beacons last.
      const active = g.screen === "game" && rt.time < rt.beacons.until;
      for (let i = 0; i < arrows.length; i++) {
        const id = active ? rt.beacons.ids[i] : undefined;
        const at = id && !rt.taken.has(id) ? targetPosition(id) : null;
        const shown = Boolean(at && pointAt(arrows[i], at.x, at.z));
        arrows[i].style.opacity = shown ? "1" : "0";
        arrows[i].dataset.shown = shown ? "1" : "0";
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
    return () => {
      cancelAnimationFrame(raf);
      for (const a of arrows) a.remove();
    };
  }, []);

  return (
    <>
      <div ref={label} className="world-label" data-testid="world-label" />
      <div ref={floatLayer} className="float-layer" />
      <div ref={arrowLayer} className="float-layer arrow-layer" />
    </>
  );
}
