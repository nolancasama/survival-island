import { rt } from "../runtime";
import { setGame } from "../store";
import { fastMode } from "./ask";

/** Shared screen fade. App's overlay uses this duration too. */
export const FADE_MS = 900;
export const fadeDuration = () => fastMode() ? 40 : FADE_MS;

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

async function finishFade(target: 0 | 1) {
  await new Promise<void>((resolve) => window.setTimeout(resolve, fadeDuration() + 50));
  if (typeof document === "undefined") return;
  const overlay = document.querySelector(".fade");
  if (!overlay) return;
  // A slow frame can delay React's CSS update. Wait for the rendered overlay,
  // not just the nominal duration, before changing anything behind it.
  while (Math.abs(Number(getComputedStyle(overlay).opacity) - target) > 0.001) await nextFrame();
}

export async function fadeToBlack() {
  setGame({ fade: 1 });
  // Include a frame margin so the pose/teleport never precedes full coverage.
  await finishFade(1);
}

export async function fadeFromBlack() {
  if (typeof document !== "undefined") {
    // Draw pose/scene/camera changes while the overlay is still opaque.
    await nextFrame();
    await nextFrame();
  }
  setGame({ fade: 0 });
  await finishFade(0);
}

/** Call while controls are paused; the completed pose is the only visible change. */
export async function changePose(lying: 0 | 1) {
  await fadeToBlack();
  rt.player.lying = rt.player.lyingTarget = lying;
  rt.player.vx = rt.player.vz = rt.player.speed = 0;
  rt.player.action = null;
  rt.camera.snap = true;
  await fadeFromBlack();
}
