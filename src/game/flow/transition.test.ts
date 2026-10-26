import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { rt, resetRuntime } from "../runtime";
import { getGame, setGame } from "../store";
import { changePose, FADE_MS } from "./transition";

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("window", globalThis);
  resetRuntime();
  setGame({ fade: 0 });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

it.each([0, 1] as const)("changes to pose %i only after full black, then reveals it", async (target) => {
  rt.player.lying = rt.player.lyingTarget = target === 1 ? 0 : 1;
  const original = rt.player.lying;
  const done = changePose(target);
  expect(getGame().fade).toBe(1);
  await vi.advanceTimersByTimeAsync(FADE_MS - 1);
  expect(rt.player.lying).toBe(original);
  await vi.advanceTimersByTimeAsync(51);
  expect(rt.player.lying).toBe(target);
  expect(rt.player.lyingTarget).toBe(target);
  expect(rt.camera.snap).toBe(true);
  expect(getGame().fade).toBe(0);
  await vi.runAllTimersAsync();
  await done;
});
