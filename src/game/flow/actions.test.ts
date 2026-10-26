import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AskRequest } from "./ask";
import type { PhraseId } from "../logic/english";

const prompts = vi.hoisted(() => ({
  ask: vi.fn<(request: AskRequest) => Promise<PhraseId | null>>(),
  say: vi.fn().mockResolvedValue(undefined)
}));

vi.mock("./ask", () => ({ ...prompts, fastMode: () => false }));
vi.mock("./kai", () => ({ talkToKai: vi.fn() }));
vi.mock("./days", () => ({
  canSleepNow: () => true,
  sleepPlace: () => null,
  trySleep: vi.fn(),
  celebrate: vi.fn(),
  eveningCue: vi.fn(),
  nextDay: vi.fn(),
  placeKaiAtCamp: vi.fn()
}));
vi.mock("../../audio/audio", () => ({
  audio: {
    unlock: vi.fn(),
    play: vi.fn(),
    setVolumes: vi.fn(),
    startAmbience: vi.fn(),
    startMusic: vi.fn(),
    setDaylight: vi.fn()
  }
}));
vi.mock("../../audio/tts", () => ({ tts: { setRate: vi.fn() } }));
vi.mock("../../audio/recognition", () => ({ recognition: { supported: false }, requestMicPermission: vi.fn() }));

import { freshGameData, getGame, setGame, type Focus } from "../store";
import { resetRuntime, rt } from "../runtime";
import { BRIDGE, FISH_SPOTS, WATER_SPOTS } from "../world/island";
import { isWalkable, overlaps, PLAYER_R, STATIC_OBSTACLES } from "../world/collision";
import { SAVE_KEY, loadSaveText } from "../logic/save";
import { eatFirst, eatItem, interact, useItem } from "./actions";
import { continueGame, save, tick } from "./session";
import { findFocus } from "./focus";

function focus(kind: Focus["kind"], id: string) {
  setGame({ focus: { id, kind, verb: "Use", noun: "target", icon: "hand" } });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  const storage = new Map<string, string>();
  vi.stubGlobal("window", { setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout });
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key)
  });
  resetRuntime();
  setGame({
    ...freshGameData(),
    screen: "game",
    mode: "explore",
    settingsOpen: false,
    quest: { day: 3, done: [], complete: false },
    pathCleared: true,
    focus: null,
    toasts: [],
    hint: null
  });
  prompts.ask.mockImplementation(async (request) => {
    const phrase = request.options[0];
    setGame({ known: [...getGame().known, phrase] });
    return phrase;
  });
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("Day 3 actions", () => {
  it("refuses the bridge without wood and builds it before Day 3 when supplied", async () => {
    setGame({ quest: { day: 2, done: [], complete: false } });
    focus("bridge", BRIDGE.id);
    await interact();
    expect(getGame().bridgeBuilt).toBe(false);
    expect(getGame().toasts.at(-1)?.en).toBe("You need four wood.");
    expect(prompts.ask).not.toHaveBeenCalled();

    setGame({ bag: { wood: 4, coconut: 1 } });
    const building = interact();
    await vi.runAllTimersAsync();
    await building;
    expect(getGame().bridgeBuilt).toBe(true);
    expect(getGame().bag).toEqual({ coconut: 1 });
    expect(prompts.ask).toHaveBeenCalledWith(expect.objectContaining({ options: ["buildBridge"] }));
  });

  it("refuses water and fishing without their tools, without opening English prompts", async () => {
    setGame({ bridgeBuilt: true });
    focus("water", WATER_SPOTS[0].id);
    await interact();
    expect(getGame().toasts.at(-1)?.en).toBe("You need a cup.");
    focus("fish", FISH_SPOTS[0].id);
    await interact();
    expect(getGame().toasts.at(-1)?.en).toBe("You need a fishing rod.");
    expect(getGame().gotWater).toBe(0);
    expect(getGame().caught).toBe(0);
    expect(prompts.ask).not.toHaveBeenCalled();
  });

  it("learns filling and drinking separately, then makes each quick even with full food", async () => {
    setGame({ bridgeBuilt: true, bag: { container: 1 } });
    rt.stats = { hp: 80, food: 100, stamina: 15 };
    focus("water", WATER_SPOTS[0].id);
    await interact();
    await interact();
    expect(getGame().gotWater).toBe(2);
    expect(getGame().bag.water).toBe(2);
    expect(prompts.ask).toHaveBeenCalledTimes(1);

    await eatItem("water");
    expect(getGame().drank).toBe(1);
    expect(rt.stats.stamina).toBe(45);
    await eatFirst();
    expect(getGame().drank).toBe(2);
    expect(getGame().bag.water).toBeUndefined();
    expect(rt.stats.stamina).toBe(75);
    expect(getGame().quest.done).toEqual(expect.arrayContaining(["water", "drink"]));
    expect(prompts.ask.mock.calls.map(([request]) => request.options[0])).toEqual(["getWater", "drinkWater"]);
  });

  it("catches automatically after a visible wait, rests the spot and permits another known cast later", async () => {
    setGame({ bridgeBuilt: true, bag: { rod: 1 } });
    focus("fish", FISH_SPOTS[0].id);
    const first = interact();
    await vi.advanceTimersByTimeAsync(0);
    expect(rt.fishing?.phase).toBe("cast");
    expect(getGame().caught).toBe(0);
    await vi.advanceTimersByTimeAsync(380);
    expect(rt.fishing?.phase).toBe("wait");
    await vi.advanceTimersByTimeAsync(1700);
    expect(rt.fishing?.phase).toBe("bite");
    await vi.advanceTimersByTimeAsync(250);
    expect(rt.fishing?.phase).toBe("reel");
    expect(getGame().caught).toBe(0);
    await vi.advanceTimersByTimeAsync(450);
    await first;
    expect(rt.fishing).toBeNull();
    expect(getGame().bag.fish).toBe(1);
    expect(getGame().caught).toBe(1);
    expect(getGame().quest.done).toContain("fish");
    expect(rt.taken.get(FISH_SPOTS[0].id)).toBe(15);

    focus("fish", FISH_SPOTS[0].id);
    await interact();
    expect(getGame().caught).toBe(1);
    expect(prompts.ask).toHaveBeenCalledTimes(1);
    rt.player.x = FISH_SPOTS[0].x;
    rt.player.z = FISH_SPOTS[0].z;
    tick(15);
    expect(rt.taken.has(FISH_SPOTS[0].id)).toBe(false);
    const second = interact();
    await vi.runAllTimersAsync();
    await second;
    expect(getGame().caught).toBe(2);
    expect(prompts.ask).toHaveBeenCalledTimes(1);
  });

  it("keeps raw fish in the bag until cooking, then teaches eating the grilled fish", async () => {
    setGame({ bag: { fish: 2 }, buildings: [{ id: "fire", type: "campfire", x: 0, z: 10, rot: 0, lit: true }] });
    useItem("fish");
    expect(getGame().toasts.at(-1)?.en).toBe("Cook it first!");
    expect(getGame().bag.fish).toBe(2);
    expect(prompts.ask).not.toHaveBeenCalled();

    focus("campfire", "fire");
    const cooking = interact();
    await vi.advanceTimersByTimeAsync(0);
    const duringCooking = loadSaveText(localStorage.getItem(SAVE_KEY), null);
    expect(getGame().mode).toBe("busy");
    expect(duringCooking?.bag.grilledFish).toBe(1);
    expect(duringCooking?.quest.done).toContain("cook");
    await vi.runAllTimersAsync();
    await cooking;
    expect(getGame().cooked).toBe(1);
    expect(getGame().bag).toEqual({ fish: 1, grilledFish: 1 });
    expect(getGame().quest.done).toContain("cook");
    await eatItem("grilledFish");
    expect(getGame().bag.grilledFish).toBeUndefined();
    expect(getGame().ate).toBe(1);
    expect(prompts.ask.mock.calls.map(([request]) => request.options[0])).toEqual(["cookFish", "eatFish"]);

    focus("campfire", "fire");
    const again = interact();
    await vi.runAllTimersAsync();
    await again;
    expect(getGame().cooked).toBe(2);
    expect(prompts.ask).toHaveBeenCalledTimes(2);
  });

  it("restores a Day 3 night, built bridge, mixed fish and a resting spot", async () => {
    setGame({ bridgeBuilt: true, bag: { container: 1, rod: 1, fish: 1, grilledFish: 1 }, gotWater: 2, drank: 1, caught: 2, cooked: 1 });
    rt.clock = 0.95;
    rt.taken.set(FISH_SPOTS[0].id, 12);
    save();
    const saved = loadSaveText(localStorage.getItem(SAVE_KEY), null);
    expect(saved?.taken[FISH_SPOTS[0].id]).toBe(12);
    setGame({ bridgeBuilt: false, bag: {}, gotWater: 0, caught: 0 });
    rt.taken.clear();
    rt.clock = 0.1;
    await continueGame();
    expect(getGame().quest.day).toBe(3);
    expect(getGame().bridgeBuilt).toBe(true);
    expect(getGame().bag).toEqual({ container: 1, rod: 1, fish: 1, grilledFish: 1 });
    expect(getGame().gotWater).toBe(2);
    expect(getGame().drank).toBe(1);
    expect(getGame().caught).toBe(2);
    expect(getGame().cooked).toBe(1);
    expect(rt.clock).toBe(0.95);
    expect(rt.taken.get(FISH_SPOTS[0].id)).toBe(12);
  });
});

describe("pond focus", () => {
  it("offers every water and fish target from a walkable approach despite nearby spots", () => {
    setGame({ bridgeBuilt: true });
    const gates = { pathCleared: true, bridgeBuilt: true };
    for (const spot of [...WATER_SPOTS, ...FISH_SPOTS]) {
      const approaches = Array.from({ length: 16 }, (_, i) => {
        const angle = (i / 16) * Math.PI * 2;
        const x = spot.x + Math.sin(angle) * 1.4;
        const z = spot.z + Math.cos(angle) * 1.4;
        const yaw = Math.atan2(spot.x - x, spot.z - z);
        return isWalkable(x, z, gates, PLAYER_R) && !overlaps(x, z, PLAYER_R, [STATIC_OBSTACLES]) && findFocus(x, z, yaw)?.id === spot.id;
      });
      expect(approaches.some(Boolean), `walkable approach for ${spot.id}`).toBe(true);
    }
  });
});
