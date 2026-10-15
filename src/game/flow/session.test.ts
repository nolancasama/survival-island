import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, freshGameData, getGame, setGame } from "../store";
import { resetRuntime, rt } from "../runtime";
import { CAVE_ENTRY, CAVE_OUTSIDE } from "../world/phase3";
import { NODE_BY_ID } from "../world/island";
import { parseSave, SAVE_KEY } from "../logic/save";
import { targetReachable } from "./places";
import { refreshQuest, save, showBeacons, tick } from "./session";

describe("story session and classroom help", () => {
  let storage: Map<string, string>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("window", globalThis);
    storage = new Map();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value)
    });
    resetRuntime();
    setGame({
      ...freshGameData(),
      screen: "game",
      mode: "explore",
      settings: { ...DEFAULT_SETTINGS, mic: false },
      settingsOpen: false,
      prompt: null,
      line: null,
      craftOpen: false,
      placing: null,
      hint: null,
      toasts: []
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("holds the cave clock through live play and newly completed checklist steps", () => {
    setGame({
      inCave: true,
      enteredCave: true,
      pathCleared: true,
      quest: { day: 4, done: ["torch", "cave"], complete: false },
      bag: { torch: 1, metal: 2 }
    });
    Object.assign(rt.player, CAVE_ENTRY);
    rt.clock = 0.2;
    tick(2);
    refreshQuest();
    expect(getGame().quest.done).toContain("metal");
    expect(rt.clock).toBe(0.2);
    setGame({ inCave: false });
    tick(1);
    expect(rt.clock).toBeGreaterThan(0.2);
  });

  it("saves cave discoveries and Kai's branch while storing the outside arrival", () => {
    setGame({
      inCave: true,
      enteredCave: true,
      caveBoxOpened: true,
      bag: { torch: 1, radio: 1, metal: 2 },
      kai: { canTorch: false, have: "metal" }
    });
    Object.assign(rt.player, CAVE_ENTRY);
    save();
    const saved = parseSave(storage.get(SAVE_KEY) ?? null);
    expect(saved).toMatchObject({
      player: CAVE_OUTSIDE,
      enteredCave: true,
      caveBoxOpened: true,
      bag: { torch: 1, radio: 1, metal: 2 },
      kai: { canTorch: false, have: "metal" }
    });
    expect(saved).not.toHaveProperty("inCave");
    expect(rt.player.x).toBe(CAVE_ENTRY.x);
  });

  it("points to the cave gate outside and reachable metal inside", () => {
    setGame({ pathCleared: true });
    showBeacons("metal");
    expect(rt.beacons.ids).toEqual(["caveMouth"]);
    expect(targetReachable("caveMouth")).toBe(true);
    setGame({ inCave: true });
    Object.assign(rt.player, CAVE_ENTRY);
    showBeacons("metal");
    expect(rt.beacons.ids.length).toBeGreaterThan(0);
    expect(rt.beacons.ids.every((id) => NODE_BY_ID.get(id)?.kind === "metal" && targetReachable(id))).toBe(true);
    showBeacons("wood");
    expect(rt.beacons.ids).toEqual(["caveExit"]);
  });

  it("fires hints only during free live play, spaces repeats, and resets on a step tick", () => {
    setGame({
      settings: { ...DEFAULT_SETTINGS, classroom: true },
      ate: 1,
      metKai: true,
      quest: { day: 1, done: ["eat", "kai"], complete: false },
      mode: "craft",
      craftOpen: true
    });
    tick(21);
    expect(rt.stepIdleSeconds).toBe(0);
    expect(rt.automaticHintCount).toBe(0);
    setGame({ mode: "place", craftOpen: false, placing: { item: "campfire", rot: 0, problem: null } });
    tick(21);
    expect(rt.automaticHintCount).toBe(0);
    setGame({ mode: "explore", placing: null });
    tick(0.1);
    expect(rt.automaticHintCount).toBe(1);
    expect(rt.beacons.ids.every((id) => NODE_BY_ID.get(id)?.kind === "wood" && targetReachable(id))).toBe(true);
    tick(19);
    expect(rt.automaticHintCount).toBe(1);
    setGame({ bag: { wood: 2 } });
    refreshQuest();
    expect(getGame().quest.done).toContain("wood");
    expect(rt.stepIdleSeconds).toBe(0);
    tick(1.1);
    expect(rt.automaticHintCount).toBe(1);
    tick(19);
    expect(rt.automaticHintCount).toBe(2);
    expect(rt.beacons.ids.every((id) => NODE_BY_ID.get(id)?.kind === "stone")).toBe(true);
  });

  it("never emits automatic hints in normal mode", () => {
    tick(25);
    expect(rt.stepIdleSeconds).toBe(25);
    expect(rt.automaticHintCount).toBe(0);
    expect(rt.beacons.ids).toEqual([]);
  });
});
