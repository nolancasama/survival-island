import * as THREE from "three";

/**
 * Shared materials. Everything is vertex-coloured Lambert: cheap on
 * Chromebooks, and flat shading gives the faceted low-poly look for free
 * (normals come from screen-space derivatives, so animated meshes need no
 * normal updates).
 */

export const flatMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
export const smoothMat = new THREE.MeshLambertMaterial({ vertexColors: true });

let glow: THREE.CanvasTexture | null = null;
/** Soft radial dot (beacons, embers, blob shadows, sparkles). */
export function glowTexture(): THREE.CanvasTexture {
  if (glow) return glow;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.35, "rgba(255,255,255,0.55)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  glow = new THREE.CanvasTexture(c);
  glow.colorSpace = THREE.SRGBColorSpace;
  return glow;
}

export function shadowMaterial(opacity = 0.32): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ map: glowTexture(), color: "#3a2a10", transparent: true, opacity, depthWrite: false });
}

export function additiveSprite(color: THREE.ColorRepresentation, opacity = 1): THREE.SpriteMaterial {
  return new THREE.SpriteMaterial({
    map: glowTexture(),
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
}

/** The forest sign's painted text. */
export function signTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 96;
  const g = c.getContext("2d")!;
  g.fillStyle = "#d79c58";
  g.fillRect(0, 0, 256, 96);
  g.strokeStyle = "rgba(90,50,20,0.35)";
  g.lineWidth = 3;
  for (let y = 18; y < 96; y += 26) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(256, y + 4);
    g.stroke();
  }
  g.fillStyle = "#4a2a12";
  g.font = "bold 46px system-ui, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText("FOREST →", 128, 50);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
